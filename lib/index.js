/**
 * Host half of the prompt-polish plugin.
 *
 * Serves one streaming route that the composer button
 * (`@deepseek-ai/dsh-client-ui-prompt-polish/client`) posts to. The route owns
 * the model call: the browser holds no credential and never talks to a provider.
 *
 * The reply is newline-delimited JSON events rather than a bare body, so the
 * panel can render tokens as they arrive — the visible half of what makes
 * prompt-optimizer feel live — and so a failure mid-generation is reportable
 * instead of looking like a truncated prompt.
 *
 * Security has one home: every request passes the composition's `connection`
 * trust fence (Host/Origin plus the browser session cookie) before any model
 * call is spent.
 *
 * @module @mimo-ai/dsh-client-ui-prompt-polish
 */
import { randomUUID } from "node:crypto";
import { OPTIMIZATION_MODES, extractPrompt, getDefaultTemplateId, getTemplate, templateVariables, TEMPLATES } from "./prompts.js";
import { buildMessages, createTemplateContext, isSimpleTemplate } from "./processor.js";
import { applyVariables, parseExtractionResult } from "./extraction.js";

/** The three `OptimizationMode` ids the wire accepts. */
const MODE_IDS = new Set(OPTIMIZATION_MODES.map((mode) => mode.id));

/** Cordis function-plugin name. */
const name = "prompt-polish";

/** The route carrier, the trust fence, the model runtime, and the default route. */
const inject = ["webServer", "connection", "llm", "agentDefaultModel"];

/** POST route answering one optimization request as an NDJSON event stream. */
const OPTIMIZE_ROUTE = "/prompt-polish/optimize";

/**
 * GET route listing selectable models.
 *
 * The composer's current model is only a sane default: a user may have it on an
 * image model, which cannot answer a text rewrite at all. The panel needs its
 * own choice, and the browser cannot enumerate models by itself.
 */
const MODELS_ROUTE = "/prompt-polish/models";

/**
 * Variable extraction: its own model call, because upstream treats it as one —
 * `VariableExtractionService` is a separate service with its own template, its
 * own response schema, and its own error types. It is not a mode of the
 * optimizer and does not stream.
 */
const EXTRACT_ROUTE = "/prompt-polish/extract-variables";

/** Drafts plus a revision note are small; anything larger is hostile or a bug. */
const MAX_BODY_BYTES = 1024 * 1024;

/** Per-field ceiling. The body cap is the transport limit; this is the sane one. */
const MAX_FIELD_CHARS = 60_000;

/**
 * Output ceiling. This must cover the model's reasoning tokens *and* the
 * rewritten prompt: a reasoning model that spends the budget thinking emits no
 * answer at all, which the browser would see as an empty result.
 */
const MAX_TOKENS = 16384;

/**
 * Resolve the model route for one call.
 *
 * The profile's agent default model is the source of truth, which is what makes
 * the button follow whatever the user last picked in Settings without the
 * browser having to say so. A composition without that service falls back to
 * nothing and the caller answers 503 rather than guessing a provider.
 * @param ctx - the plugin context.
 * @returns the provider/model pair, or undefined when none is configured.
 */
function resolveRoute(ctx) {
	const defaults = ctx.agentDefaultModel ?? (ctx.get === void 0 ? void 0 : ctx.get("agentDefaultModel"));
	if (defaults === void 0 || typeof defaults.currentSelection !== "function") return void 0;
	const selection = defaults.currentSelection();
	if (selection === void 0 || typeof selection.provider !== "string" || typeof selection.model !== "string") return void 0;
	return selection;
}

/** JSON response (no-store: every answer is a fresh model generation). */
function sendJson(res, status, payload) {
	res.statusCode = status;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.setHeader("cache-control", "no-store");
	res.end(JSON.stringify(payload));
}

/** 405 with the route's one supported method. */
function sendMethodNotAllowed(res, allow) {
	res.statusCode = 405;
	res.setHeader("allow", allow);
	res.end();
}

/** Collect a bounded request body as UTF-8 text; null past the ceiling. */
async function readBoundedBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.byteLength;
		if (size > MAX_BODY_BYTES) {
			req.resume();
			return null;
		}
		chunks.push(chunk);
	}
	return Buffer.concat(chunks, size).toString("utf8");
}

/**
 * Validate the wire body at the boundary.
 * @param text - raw JSON text.
 * @returns the parsed request, or null when malformed.
 */
/** Cap on history messages and tool definitions folded into one request. */
const MAX_CONTEXT_MESSAGES = 50;
const MAX_CONTEXT_CHARS = 200_000;

/**
 * Validate a request and resolve it to `{ template, context, route }`.
 *
 * The field names mirror upstream's `OptimizationRequest`
 * (`optimizationMode`, `targetPrompt`, `templateId`, `contextMode`,
 * `advancedContext`) on purpose: the wire is then the same object the ported
 * processor consumes, so there is no translation layer to drift from upstream.
 *
 * `templateId` is optional exactly as it is upstream — when absent the family
 * default is resolved through the fallback chain. When present it must agree
 * with `optimizationMode`, because a client that mixes the two would otherwise
 * get a system-family answer for a user-family question and never notice.
 */
function parseBody(text) {
	let body;
	try {
		body = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof body !== "object" || body === null) return null;
	if (Array.isArray(body)) return null;
	const { optimizationMode, targetPrompt, templateId, lastOptimizedPrompt, iterateInput, contextMode, advancedContext, inputImages, provider, model } = body;
	if (typeof optimizationMode !== "string" || !MODE_IDS.has(optimizationMode)) return null;
	if (typeof targetPrompt !== "string" || targetPrompt.trim() === "" || targetPrompt.length > MAX_FIELD_CHARS) return null;
	if (contextMode !== void 0 && contextMode !== "system" && contextMode !== "user") return null;
	/**
	 * Images are a separate carrier upstream hands to a vision model in one
	 * call. Until this plugin can reach attachment bytes, accepting them and
	 * quietly dropping them would be worse than refusing.
	 */
	if (Array.isArray(inputImages) && inputImages.length > 0) return { unsupported: "inputImages" };
	if (optimizationMode === "iterate") {
		if (typeof lastOptimizedPrompt !== "string" || lastOptimizedPrompt.trim() === "") return null;
		if (typeof iterateInput !== "string" || iterateInput.trim() === "") return null;
		if (lastOptimizedPrompt.length > MAX_FIELD_CHARS || iterateInput.length > MAX_FIELD_CHARS) return null;
	}
	const family = optimizationMode === "user" ? "userOptimize" : optimizationMode === "iterate" ? "iterate" : "optimize";
	let template;
	if (templateId === void 0) {
		template = getTemplate(getDefaultTemplateId(family));
	} else {
		if (typeof templateId !== "string") return null;
		template = getTemplate(templateId);
		if (template === void 0) return null;
		if (template.optimizationMode !== optimizationMode) return { unsupported: "mode-template-mismatch" };
	}
	/**
	 * Validate the optional context bags BEFORE handing them to the processor:
	 * `createExtendedContext` distinguishes "absent" (`undefined`) from "present
	 * but empty" and would call `Object.entries(null)` on a null here, which
	 * throws instead of answering 400.
	 */
	const variables = parseVariables(advancedContext);
	const messages = parseMessages(advancedContext);
	const tools = parseTools(advancedContext);
	if (variables === null || messages === null || tools === null) return null;
	const context = createTemplateContext({
		optimizationMode,
		targetPrompt,
		contextMode,
		lastOptimizedPrompt,
		iterateInput,
		variables,
		messages,
		tools
	});
	/**
	 * An optional pinned route. Both halves must be present: a model id without
	 * its provider would silently be tried against the composer's provider,
	 * which is a worse failure than falling back to the current selection.
	 */
	if (provider !== void 0 && model !== void 0) {
		if (typeof provider !== "string" || typeof model !== "string") return null;
		if (provider.length > 200 || model.length > 200) return null;
	}
	return {
		template,
		context,
		route: provider !== void 0 && model !== void 0 ? {
			provider,
			model
		} : void 0
	};
}

/** @returns `advancedContext.variables`, or null when malformed. */
function parseVariables(advancedContext) {
	if (advancedContext === void 0 || advancedContext === null) return void 0;
	if (typeof advancedContext !== "object") return null;
	const source = advancedContext.variables;
	if (source === void 0) return void 0;
	if (typeof source !== "object" || source === null || Array.isArray(source)) return null;
	const out = {};
	for (const [key, value] of Object.entries(source)) {
		if (typeof value !== "string" || value.length > MAX_FIELD_CHARS) return null;
		out[key] = value;
	}
	return out;
}

/** @returns `advancedContext.messages`, or null when malformed. */
function parseMessages(advancedContext) {
	if (advancedContext === void 0 || advancedContext === null) return void 0;
	const source = advancedContext.messages;
	if (source === void 0) return void 0;
	if (!Array.isArray(source) || source.length > MAX_CONTEXT_MESSAGES) return null;
	let total = 0;
	for (const message of source) {
		if (typeof message !== "object" || message === null) return null;
		if (typeof message.role !== "string" || typeof message.content !== "string") return null;
		total += message.content.length;
	}
	if (total > MAX_CONTEXT_CHARS) return null;
	return source.map((message) => ({ role: message.role, content: message.content }));
}

/** @returns `advancedContext.tools`, or null when malformed. */
function parseTools(advancedContext) {
	if (advancedContext === void 0 || advancedContext === null) return void 0;
	const source = advancedContext.tools;
	if (source === void 0) return void 0;
	if (!Array.isArray(source) || source.length > MAX_CONTEXT_MESSAGES) return null;
	for (const tool of source) {
		/**
		 * `formatToolsAsText` interpolates the name unguarded, so an empty one would
		 * render as `Tool name: ` and hand the model a blank identity to reason about.
		 */
		if (typeof tool !== "object" || tool === null) return null;
		if (typeof tool.function?.name !== "string" || tool.function.name.trim() === "") return null;
	}
	return JSON.parse(JSON.stringify(source));
}

/** Deep-freeze one value in place and hand it back (the message creation contract). */
function deepFreeze(value) {
	if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const nested of Object.values(value)) deepFreeze(nested);
	}
	return value;
}

/**
 * Build one chat message by hand.
 *
 * `@deepseek-ai/dsh-llm` is not imported here on purpose: this package lives
 * under the profile's own `node_modules`, while the DSH packages live inside a
 * read-only `app.asar`, so a bare import of a DSH package has no resolution
 * root from this file and would fail activation. The message contract is data
 * — `role`, `content` blocks, and a `source` tag whose `form` is optional — so
 * the literal below satisfies it without reaching for the helper. `content`
 * must be a BLOCK ARRAY: the adapter's `flattenText` calls
 * `message.content.filter(...)`, so a bare string throws there.
 * @param role - `"system"` or `"user"`.
 * @param text - the rendered message text.
 * @returns a frozen message carrying this plugin's source tag.
 */
function pluginMessage(role, text) {
	return deepFreeze({
		id: "prompt-polish-" + randomUUID(),
		role,
		content: [{
			type: "text",
			text
		}],
		source: {
			kind: "plugin",
			plugin: name
		}
	});
}

/** Render a chunk-type histogram as `text-delta×12 finish×1`. */
function summarize(seen) {
	return [ ...seen ].map(([type, count]) => `${type}×${count}`).join(" ");
}

/**
 * Run one completion to the end without streaming it to a caller.
 *
 * Extraction wants the whole document before it can be parsed, so it has no use
 * for the delta pump the optimize route runs. Same fence rules apply: the
 * persona stays a leading `system` message and `options.system` is left unset.
 * @param ctx - the plugin context.
 * @param route - `{ provider, model }`.
 * @param messages - already-built `{ role, content }` list.
 * @returns the assembled text plus the terminal reason.
 */
async function collectCompletion(ctx, route, messages) {
	let assembled = "";
	let terminal;
	const seen = new Map();
	for await (const chunk of ctx.llm.stream({
		provider: route.provider,
		model: route.model,
		messages,
		maxTokens: MAX_TOKENS
	})) {
		seen.set(chunk.type, (seen.get(chunk.type) ?? 0) + 1);
		if (chunk.type === "text-delta") assembled += chunk.text;
		if (chunk.type === "finish") terminal = chunk;
	}
	return {
		text: assembled,
		reason: terminal?.reason ?? { kind: "stop" },
		seen
	};
}

/**
 * Register the optimize route behind the connection trust fence.
 * @param ctx - the plugin context.
 */
function apply(ctx) {
	/** Answer an untrusted or unauthenticated request; true when it was rejected. */
	const rejected = (req, res) => {
		const rejection = ctx.connection.requestRejection(req);
		if (rejection === void 0) return false;
		res.statusCode = rejection;
		res.end();
		return true;
	};
	/**
	 * Enumerate models the panel may pin. `listModels` is adapter-backed and may
	 * reject for a provider that cannot answer, so one failing provider is
	 * skipped rather than emptying the whole picker.
	 */
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: MODELS_ROUTE,
		handler: async (req, res) => {
			if (rejected(req, res)) return;
			if (req.method !== "GET") {
				sendMethodNotAllowed(res, "GET");
				return;
			}
			const groups = [];
			for (const provider of ctx.llm.listProviders?.() ?? []) {
				try {
					const models = await ctx.llm.listModels(provider.id);
					groups.push({
						provider: provider.id,
						name: provider.name,
						models: models.map((entry) => ({
							id: entry.id,
							name: entry.name ?? entry.id
						}))
					});
				} catch {
					continue;
				}
			}
			sendJson(res, 200, {
				current: resolveRoute(ctx) ?? null,
				groups,
				/**
				 * The template catalog rides along so the panel renders the real
				 * `optimizationMode` axis from the server's own data instead of a second
				 * hardcoded list that can drift from these templates.
				 */
				modes: OPTIMIZATION_MODES,
				/**
				 * `variables` is derived by parsing each template, not hand-written, so
				 * the panel can never be told a template needs a field it does not read.
				 * `simple` marks the bare-string family, whose target prompt travels as
				 * its own user message rather than as a JSON slot.
				 */
				templates: Object.values(TEMPLATES).filter((template) => template.optimizationMode !== void 0).map((template) => ({
					id: template.id,
					label: template.label,
					optimizationMode: template.optimizationMode,
					templateType: template.templateType,
					simple: isSimpleTemplate(template),
					variables: templateVariables(template),
					fields: template.fields
				})),
				/**
				 * Which template each mode starts on, resolved through the same
				 * `getDefaultTemplateId` the optimize route falls back to — so the
				 * panel's first pick follows the documented upstream default (the
				 * user family opens on 专业优化) instead of registry order, and the
				 * client never hardcodes an id.
				 */
				defaults: {
					system: getDefaultTemplateId("optimize"),
					user: getDefaultTemplateId("userOptimize"),
					iterate: getDefaultTemplateId("iterate")
				},
				extraction: getTemplate("variable-extraction") !== void 0
			});
		}
	}), `prompt-polish: GET ${MODELS_ROUTE}`);
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: OPTIMIZE_ROUTE,
		handler: async (req, res) => {
			if (rejected(req, res)) return;
			if (req.method !== "POST") {
				sendMethodNotAllowed(res, "POST");
				return;
			}
			if (String(req.headers["content-type"]).split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
				sendJson(res, 415, {
					code: "unsupported-media-type",
					message: "content-type must be application/json"
				});
				return;
			}
			let text;
			try {
				text = await readBoundedBody(req);
			} catch {
				sendJson(res, 400, {
					code: "bad-request",
					message: "request body unreadable"
				});
				return;
			}
			if (text === null) {
				sendJson(res, 413, {
					code: "payload-too-large",
					message: "request body is too large"
				});
				return;
			}
			const request = parseBody(text);
			if (request === null) {
				sendJson(res, 400, {
					code: "bad-request",
					message: 'body must be JSON: { optimizationMode: "system" | "user" | "iterate", targetPrompt: string, templateId?, lastOptimizedPrompt?, iterateInput?, contextMode?, advancedContext? }'
				});
				return;
			}
			if (request.unsupported !== void 0) {
				sendJson(res, 400, {
					code: "unsupported",
					message: request.unsupported === "inputImages" ?
						"暂不支持图片输入：附件字节还取不到，请先用文字描述图片内容。" :
						"模板与优化对象不一致：请重新选择一个匹配当前优化对象的模板。"
				});
				return;
			}
			/** A pinned panel choice wins; otherwise follow the composer. */
			const route = request.route ?? resolveRoute(ctx);
			if (route === void 0) {
				sendJson(res, 503, {
					code: "no-model",
					message: "没有可用的默认模型：请在设置里选择 agent default model，或在面板里指定一个模型后重试。"
				});
				return;
			}
			/**
			 * `buildMessages` is where the two template families diverge, and the
			 * divergence is preserved on purpose: a bare-string template becomes the
			 * system message **unrendered** plus the raw target as a user turn, while a
			 * message-array template is mustache-rendered with the full context. See
			 * `processor.js`.
			 *
			 * System placement is load-bearing. The pi-ai adapter takes the system
			 * prompt from `options.system` when that is defined, and then FOLDS any
			 * `system` message inside `messages` into a plain `user` turn — so passing
			 * both would silently demote the template's persona. Only with
			 * `options.system` omitted does a LEADING `system` message become the real
			 * `systemPrompt`, which is exactly what the ported templates expect.
			 */
			const messages = buildMessages(request.template, request.context).map((message) => pluginMessage(message.role, message.content));
			res.statusCode = 200;
			res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
			res.setHeader("cache-control", "no-store");
			res.setHeader("x-accel-buffering", "no");
			/** One JSON document per line; the browser parses incrementally. */
			const emit = (event) => {
				if (!res.writableEnded) res.write(JSON.stringify(event) + "\n");
			};
			/** The client stopped watching: stop paying for tokens. */
			const abort = new AbortController();
			req.on("aborted", () => abort.abort());
			res.on("close", () => abort.abort());
			let assembled = "";
			let terminal;
			let usage;
			/**
			 * Chunk-type histogram. An empty result is otherwise indistinguishable from
			 * a silent provider failure, and this composition writes no log file to
			 * tell them apart — so the diagnosis rides back to the panel instead.
			 */
			const seen = new Map();
			try {
				for await (const chunk of ctx.llm.stream({
					provider: route.provider,
					model: route.model,
					messages,
					/**
					 * No `temperature`: this provider serves a reasoning model through the
					 * Responses API, and a sampling parameter it declines to accept would
					 * fail the call outright. The rewrite is deterministic enough without it.
					 */
					maxTokens: MAX_TOKENS,
					signal: abort.signal
				})) {
					seen.set(chunk.type, (seen.get(chunk.type) ?? 0) + 1);
					if (chunk.type === "text-delta") {
						assembled += chunk.text;
						emit({
							type: "delta",
							text: chunk.text
						});
						continue;
					}
					/**
					 * The stream carries token counts as their own chunk type
					 * (`{ type:'usage', usage: TokenUsage }` in the host's StreamChunk
					 * union). Relayed on the done event so the panel can show the
					 * doc-standard result metadata; providers that report nothing
					 * simply leave it absent.
					 */
					if (chunk.type === "usage") {
						usage = chunk.usage;
						continue;
					}
					if (chunk.type === "finish") terminal = chunk;
				}
			} catch (error) {
				emit({
					type: "error",
					message: error instanceof Error ? error.message : String(error)
				});
				res.end();
				return;
			}
			/**
			 * `reason` is a discriminated object (`{ kind, failure? }`), not a string —
			 * comparing it to `"error"` silently hid every real failure behind the
			 * empty-result message. Switch on `kind` and surface the provider's own
			 * words, since this composition writes no log to consult afterwards.
			 */
			const reason = terminal?.reason ?? { kind: "stop" };
			const cleaned = extractPrompt(assembled);
			const where = `${route.provider}/${route.model}`;
			if (cleaned === "") {
				const detail = "failure" in reason && reason.failure !== void 0 ? `：${reason.failure.message}` : "";
				emit({
					type: "error",
					/**
					 * Name the model in every failure. A provider that rejects an image
					 * model for a text call says so in its own words, which means
					 * nothing unless the user can see which model was tried.
					 */
					message: reason.kind === "aborted" ? "润色已取消。" : reason.kind === "error" ? `模型调用失败（${where}）${detail}` : reason.kind === "max-tokens" ? `${where} 把输出预算全花在推理上，没有产出正文。换个模型或缩短输入。` : `${where} 没有返回正文（finish=${reason.kind}；${summarize(seen) || "无任何 chunk"}）`
				});
			} else {
				emit({
					type: "done",
					text: cleaned,
					model: `${route.provider}/${route.model}`,
					truncated: reason.kind === "max-tokens",
					usage: usage === void 0 || usage === null ? void 0 : {
						inputTokens: usage.inputTokens,
						outputTokens: usage.outputTokens,
						totalTokens: usage.totalTokens
					}
				});
			}
			res.end();
		}
	}), `prompt-polish: POST ${OPTIMIZE_ROUTE}`);
	/**
	 * Extract parameterisable variables from a finished prompt. Separate route,
	 * separate call, JSON in / JSON out — mirroring the way upstream splits this
	 * off into `VariableExtractionService` instead of a mode of the optimizer.
	 */
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: EXTRACT_ROUTE,
		handler: async (req, res) => {
			if (rejected(req, res)) return;
			if (req.method !== "POST") {
				sendMethodNotAllowed(res, "POST");
				return;
			}
			if (String(req.headers["content-type"]).split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
				sendJson(res, 415, {
					code: "unsupported-media-type",
					message: "content-type must be application/json"
				});
				return;
			}
			const text = await readBoundedBody(req);
			if (text === null) {
				sendJson(res, 413, {
					code: "payload-too-large",
					message: "request body is too large"
				});
				return;
			}
			let body;
			try {
				body = JSON.parse(text);
			} catch {
				body = null;
			}
			if (typeof body !== "object" || body === null || Array.isArray(body)) {
				sendJson(res, 400, {
					code: "bad-request",
					message: "body must be JSON: { promptContent: string, existingVariableNames?: string[] }"
				});
				return;
			}
			const promptContent = body.promptContent;
			if (typeof promptContent !== "string" || promptContent.trim() === "" || promptContent.length > MAX_FIELD_CHARS) {
				sendJson(res, 400, {
					code: "bad-request",
					message: "promptContent 必须是非空字符串。"
				});
				return;
			}
			const names = Array.isArray(body.existingVariableNames) ? body.existingVariableNames.filter((entry) => typeof entry === "string" && entry !== "") : [];
			const route = typeof body.provider === "string" && typeof body.model === "string" ? {
				provider: body.provider,
				model: body.model
			} : resolveRoute(ctx);
			if (route === void 0) {
				sendJson(res, 503, {
					code: "no-model",
					message: "没有可用的默认模型：请在设置里选择 agent default model，或在面板里指定一个模型后重试。"
				});
				return;
			}
			const template = getTemplate("variable-extraction");
			/**
			 * Upstream's exact context trio. `existingVariableNames` is a joined string
			 * with the literal "None" default, and the boolean drives the
			 * `{{#hasExistingVariables}}` branch in the system message.
			 */
			const context = createTemplateContext({
				promptContent,
				variables: {
					existingVariableNames: names.length > 0 ? names.join(", ") : "None",
					hasExistingVariables: names.length > 0
				}
			});
			let completion;
			try {
				completion = await collectCompletion(ctx, route, buildMessages(template, context).map((message) => pluginMessage(message.role, message.content)));
			} catch (error) {
				sendJson(res, 502, {
					code: "model-failure",
					message: `变量提取调用失败（${route.provider}/${route.model}）：${error instanceof Error ? error.message : String(error)}`
				});
				return;
			}
			let result;
			try {
				result = parseExtractionResult(completion.text);
			} catch (error) {
				sendJson(res, 502, {
					code: "bad-model-output",
					message: `${error instanceof Error ? error.message : String(error)}（${summarize(completion.seen) || "无任何 chunk"}）`
				});
				return;
			}
			/**
			 * Substituting the spans is part of the same answer: the browser would
			 * otherwise need its own copy of the occurrence arithmetic, and a wrong
			 * offset silently rewrites the user's text. A position that does not match
			 * the source fails the call rather than returning a half-templated prompt.
			 */
			/**
			 * Substituting the spans is best-effort, NOT another gate. The names and
			 * values are useful on their own; failing the whole call because one span
			 * drifted would throw away a good answer. So a mismatch comes back as
			 * `templated: null` with the reason, and the panel disables 写回模板 instead
			 * of showing nothing.
			 */
			let templated = null;
			let templatedError = "";
			try {
				templated = applyVariables(promptContent, result.variables);
			} catch (error) {
				templatedError = error instanceof Error ? error.message : String(error);
			}
			sendJson(res, 200, {
				...result,
				templated,
				...(templatedError === "" ? {} : { templatedError }),
				model: `${route.provider}/${route.model}`
			});
		}
	}), `prompt-polish: POST ${EXTRACT_ROUTE}`);
}

export { EXTRACT_ROUTE, MODELS_ROUTE, OPTIMIZE_ROUTE, apply, inject, name };
