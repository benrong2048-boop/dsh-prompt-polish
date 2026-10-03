/**
 * Variable-extraction response handling.
 *
 * Ported from prompt-optimizer `packages/core/src/services/variable-extraction/`
 * (AGPL-3.0): the model is asked for a fenced JSON document, the fence is
 * peeled, the text is repaired and parsed, and every field is validated
 * individually rather than trusted.
 *
 * One substitution: upstream calls the `jsonrepair` package. This profile cannot
 * install it, so {@link repairJson} is a deliberately narrower stand-in —
 * trailing commas, a stray code fence, and text before/after the outermost
 * object. If a model emits something beyond that, the parse fails loudly, which
 * is the correct outcome for a schema this strict: a silently "repaired"
 * variable list would put wrong text into the user's prompt.
 *
 * `applyVariables` is **not** upstream code — upstream applies extraction in its
 * app layer. Replacing by `position.originalText` + `occurrence` is implemented
 * here because the feature is pointless without it, and it is the one step where
 * an off-by-one would corrupt a prompt, so it is written to fail loudly on a
 * position that does not match the text.
 *
 * @module @benrong/dsh-prompt-polish/extraction
 */

/** ```json … ``` — same pattern the original uses. */
const JSON_FENCE = /```json\s*([\s\S]*?)\s*```/i;

/**
 * Best-effort tidy-up before `JSON.parse`.
 * @param text - candidate JSON text.
 * @returns the cleaned text.
 */
function repairJson(text) {
	let out = String(text).trim();
	const fence = JSON_FENCE.exec(out);
	if (fence !== null) out = fence[1].trim();
	/* Drop prose outside the outermost object. */
	const start = out.indexOf("{");
	const end = out.lastIndexOf("}");
	if (start >= 0 && end > start) out = out.slice(start, end + 1);
	/* Trailing commas before } or ] (outside strings). */
	out = out.replace(/,\s*([}\]])/g, "$1");
	return out;
}

/**
 * Parse the model's reply into `{ variables, summary }`.
 * @param content - raw model output.
 * @returns the normalized response.
 * @throws when no JSON, or the JSON is not an object.
 */
function parseExtractionResult(content) {
	const fenced = JSON_FENCE.exec(String(content ?? ""));
	const jsonText = fenced !== null ? fenced[1] : String(content ?? "");
	try {
		return normalizeExtractionResponse(JSON.parse(repairJson(jsonText)));
	} catch (error) {
		try {
			return normalizeExtractionResponse(JSON.parse(jsonText));
		} catch {
			throw new Error(`无法解析模型返回的变量 JSON：${error instanceof Error ? error.message : String(error)}（响应长度 ${String(content ?? "").length} 字）`);
		}
	}
}

/**
 * Field-by-field validation, mirroring `normalizeExtractionResponse`.
 * @param data - a parsed candidate.
 * @returns `{ variables, summary }` with every entry normalized.
 * @throws naming the offending index and field.
 */
function normalizeExtractionResponse(data) {
	if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("变量提取结果不是一个对象。");
	if (!Array.isArray(data.variables)) throw new Error('变量提取结果缺少 "variables" 数组。');
	if (typeof data.summary !== "string") throw new Error('变量提取结果缺少 "summary" 字符串。');
	const variables = data.variables.map((variable, index) => {
		if (!variable || typeof variable !== "object") throw new Error(`variables[${index}] 不是对象。`);
		if (typeof variable.name !== "string" || variable.name.trim() === "") throw new Error(`variables[${index}] 缺少有效的 "name"。`);
		if (typeof variable.value !== "string") throw new Error(`variables[${index}] 缺少有效的 "value"。`);
		if (!variable.position || typeof variable.position !== "object") throw new Error(`variables[${index}] 缺少有效的 "position" 对象。`);
		if (typeof variable.position.originalText !== "string" || variable.position.originalText === "") {
			throw new Error(`variables[${index}].position 缺少有效的 "originalText"。`);
		}
		if (typeof variable.position.occurrence !== "number" || !Number.isInteger(variable.position.occurrence) || variable.position.occurrence < 1) {
			throw new Error(`variables[${index}].position 缺少有效的 "occurrence" 整数。`);
		}
		if (typeof variable.reason !== "string") throw new Error(`variables[${index}] 缺少有效的 "reason"。`);
		return {
			name: variable.name.trim(),
			value: variable.value,
			position: { originalText: variable.position.originalText, occurrence: variable.position.occurrence },
			reason: variable.reason,
			...(typeof variable.category === "string" ? { category: variable.category } : {})
		};
	});
	return { variables, summary: data.summary };
}

/**
 * Turn the named spans into `{{name}}` slots.
 *
 * Every position must land: if `originalText` does not occur that many times,
 * the whole call throws instead of half-rewriting the prompt. Positions are
 * resolved against the **original** text and applied back-to-front, so earlier
 * replacements never shift later offsets.
 * @param text - the prompt the model analysed.
 * @param variables - normalized extraction entries.
 * @returns the templated text.
 * @throws when a position cannot be located.
 */
function applyVariables(text, variables) {
	const source = String(text ?? "");
	const found = variables.map((variable) => {
		const at = nthOccurrence(source, variable.position.originalText, variable.position.occurrence);
		if (at < 0) {
			throw new Error(`变量 ${variable.name} 的位置对不上：原文里找不到第 ${variable.position.occurrence} 次出现的「${variable.position.originalText}」。`);
		}
		return { at, length: variable.position.originalText.length, name: variable.name };
	});
	/**
	 * Reject overlapping spans. The model can return "春天" and "春天的河" as two
	 * variables, and both positions are individually correct — but substituting
	 * one into the middle of the other interleaves `{{name}}` into a word and
	 * silently corrupts the prompt. Choosing which one wins is a judgement call
	 * that belongs to the user, so it fails loudly instead.
	 */
	const ordered = [...found].sort((a, b) => a.at - b.at);
	for (let i = 1; i < ordered.length; i += 1) {
		const previous = ordered[i - 1];
		const current = ordered[i];
		if (current.at < previous.at + previous.length) {
			throw new Error(`变量 ${previous.name} 与 ${current.name} 在原文里重叠，无法套成模板。请只保留其中一个后重试。`);
		}
	}
	let out = source;
	for (const hit of ordered.sort((a, b) => b.at - a.at)) {
		out = `${out.slice(0, hit.at)}{{${hit.name}}}${out.slice(hit.at + hit.length)}`;
	}
	return out;
}

/**
 * @param haystack - the text to search.
 * @param needle - the span to locate.
 * @param occurrence - 1-based which occurrence.
 * @returns the index, or -1.
 */
function nthOccurrence(haystack, needle, occurrence) {
	let at = -1;
	for (let i = 0; i < occurrence; i += 1) {
		at = haystack.indexOf(needle, at + 1);
		if (at < 0) return -1;
	}
	return at;
}

export { applyVariables, normalizeExtractionResponse, parseExtractionResult, repairJson };
