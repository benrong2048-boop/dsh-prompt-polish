/**
 * Emit registry entries straight from upstream's template files.
 *
 * Hand-copying is what put the placeholder-eaten bugs into this port: a human
 * retyping `{{=<% %>=}}{{x}}<%={{ }}=%>` will drop the guard, and a dropped
 * guard silently rewrites an instruction. So the text is extracted, not
 * transcribed, and `compare-upstream.mjs` then proves the result is byte-equal.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Same parser the runtime uses, so "what this template reads" is one definition. */
const { referencedVariables } = await import(pathToFileURL(`${process.env.LIB}/processor.js`).href);

const T = process.env.UP;
const walk = (dir, acc = []) => {
	for (const e of readdirSync(dir)) {
		const p = join(dir, e);
		if (statSync(p).isDirectory()) walk(p, acc);
		else acc.push(p);
	}
	return acc;
};
const ALL = walk(T);

/**
 * Not ported, with the reason. `output-format-optimize` reads
 * `selectedMessage`, `conversationMessages`, `index`, `roleLabel`, `isSelected`
 * and `contentTooLong` — the conversation-message flow's variables. This
 * plugin's optimize contract carries a single target prompt, so mounting it
 * would render a template of empty sections, which is worse than not offering it.
 */
const NOT_PORTED = {
	"output-format-optimize": "需要会话选取变量（selectedMessage/conversationMessages/contentTooLong），本插件线协议不携带"
};
const WANT = [
	"analytical-optimize",
	"soul-hermes-compose",
	"soul-openclaw-compose",
	"user-prompt-planning",
	"soul-iterate"
];

/** One balanced backtick literal starting at the index of its opening backtick. */
function readTemplateLiteral(src, open) {
	let i = open + 1;
	let out = "";
	while (i < src.length) {
		const c = src[i];
		if (c === "\\") { out += src[i] + (src[i + 1] ?? ""); i += 2; continue; }
		if (c === "`") return { text: out, end: i };
		if (c === "$" && src[i + 1] === "{") throw new Error("上游模板里有 JS 插值 ${，需要人工决定怎么处理");
		out += c;
		i += 1;
	}
	throw new Error("未闭合的模板字面量");
}

/** The upstream folder is what carries the family; the files have no templateType. */
const MODE_FOR = (file) => {
	const p = file.replace(/\\/g, "/");
	if (p.includes("/user-optimize/")) return "user";
	if (p.includes("/iterate/")) return "iterate";
	if (p.includes("/optimize/")) return "system";
	throw new Error(`无法从路径判断族: ${p}`);
};
const entries = [];
for (const id of WANT) {
	/**
	 * Anchor on the path separator. A bare `endsWith("user-prompt-planning.ts")`
	 * also matches upstream's `context-user-prompt-planning.ts`, whose text is a
	 * different (shorter) template — and `find` returns whichever the directory
	 * walk met first, so the wrong one silently won for one id and not the others.
	 */
	const files = ALL.filter((p) => (p.endsWith(`\\${id}.ts`) || p.endsWith(`/${id}.ts`)) && !p.includes("_en"));
	if (files.length !== 1) { console.log(`## ${id}: expected 1 upstream file, found ${files.length}`); continue; }
	const file = files[0];
	const src = readFileSync(file, "utf8");
	const name = (src.match(/name:\s*'([^']*)'/) ?? src.match(/name:\s*"([^"]*)"/) ?? [])[1] ?? id;
	const desc = (src.match(/description:\s*'([^']*)'/) ?? src.match(/description:\s*"([^"]*)"/) ?? [])[1] ?? "";
	const version = (src.match(/version:\s*['"]([^'"]*)['"]/) ?? [])[1] ?? "";
	const contentStart = src.indexOf("content:");
	if (contentStart < 0) { console.log(`## ${id}: no content`); continue; }
	const isArray = /\[\s*\{/.test(src.slice(contentStart, contentStart + 40));
	const parts = [];
	if (isArray) {
		const re = /role:\s*'([a-z]+)'[\s\S]{0,40}?content:\s*`(?=[^])/g;
		let m;
		while ((m = re.exec(src))) {
			const open = src.indexOf("`", m.index);
			const { text } = readTemplateLiteral(src, open);
			parts.push({ role: m[1], text });
		}
	} else {
		const open = src.indexOf("`", contentStart);
		parts.push({ role: null, text: readTemplateLiteral(src, open).text });
	}
	const unescape = (s) => s.replace(/\\`/g, "`").replace(/\\\\/g, "\\");
	const content = parts.length === 1 && parts[0].role === null
		? unescape(parts[0].text)
		: parts.map((p) => ({ role: p.role, content: unescape(p.text) }));
	const chars = typeof content === "string" ? content.length : content.map((c) => c.content.length).join("+");
	/**
	 * Fields come from parsing the extracted text, never from a hand-written list:
	 * if upstream had an unguarded literal `{{example}}` in a rendered family, it
	 * would show up here as a bogus field and we would see it in the summary.
	 */
	const fields = typeof content === "string" ? ["originalPrompt"] : [...new Set(referencedVariables({ content }))].sort();
	const mode = MODE_FOR(file);
	entries.push({
		id,
		label: name,
		...(desc ? { description: desc } : {}),
		optimizationMode: mode,
		/**
		 * The family name upstream groups and falls back by, derived from the
		 * folder like the mode is. Without it the catalog cannot say which family a
		 * template belongs to and `getDefaultTemplateId` has no axis to work on.
		 */
		templateType: mode === "system" ? "optimize" : mode === "user" ? "userOptimize" : "iterate",
		version,
		isBuiltin: true,
		fields,
		content
	});
	console.log(`## ${id.padEnd(26)} mode=${MODE_FOR(file).padEnd(7)} msgs=${typeof content === "string" ? 1 : content.length} chars=${chars} fields=${fields.join(",")}`);
}

const banner = [
	"/**",
	" * GENERATED by gen-templates.mjs - do not hand-edit.",
	" *",
	" * Every string here was extracted from the upstream template.ts files, so the text",
	" * cannot drift the way a transcription does: a dropped Set-Delimiter guard silently",
	" * rewrites an instruction. Re-run the generator to refresh, and",
	" * compare-upstream.mjs to prove equality.",
	" */",
	"export const GENERATED_TEMPLATES ="
].join("\n") + " ";
writeFileSync(
	process.env.OUT,
	`${banner}${JSON.stringify(entries, (k, v) => (v === void 0 ? undefined : v), "\t").replace(/\t/g, "  ")}\n`
);
console.log(`\nwrote ${entries.length} templates -> ${process.env.OUT}`);
