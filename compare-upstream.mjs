/**
 * Compare the ported template text against upstream's, byte for byte after
 * normalising line endings and trailing space. Any difference here is a
 * difference in what the model is actually told, so it is a difference in
 * 效果 and not a styling question.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const UP_ROOT = process.env.UP; // .../packages/core/src
const LIB = "C:/Users/23528/.dsh/profiles/desktop/node_modules/@benrong/dsh-prompt-polish/lib";
const { TEMPLATES } = await import(pathToFileURL(LIB + "/prompts.js").href);

const walk = (dir, acc = []) => {
	for (const e of readdirSync(dir)) {
		const p = join(dir, e);
		if (statSync(p).isDirectory()) walk(p, acc);
		else if (e.endsWith(".ts") && !e.includes("_en")) acc.push(p);
	}
	return acc;
};
const ALL = walk(UP_ROOT);
const byBase = (base) => ALL.filter((p) => p.endsWith("\\" + base) || p.endsWith("/" + base));

/** Every `content:` template literal in a file, in order. */
function upstreamLiterals(file) {
	const src = readFileSync(file, "utf8");
	const out = [];
	/**
	 * A TS template literal cannot contain an unescaped backtick, so the body is
	 * exactly "non-backslash-non-backtick or an escape pair". Allowing a bare
	 * backtick here made the match overrun into the next literal and report a
	 * phantom difference on the last line.
	 */
	const re = /content:\s*`((?:[^`\\]|\\[\s\S])*)`/g;
	let m;
	while ((m = re.exec(src))) out.push(m[1]);
	return out.map((s) => s.replace(/\\`/g, "`").replace(/\\\$\{/g, "${").replace(/\\\\/g, "\\"));
}

const norm = (s) => String(s).replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").replace(/^\n+|\n+$/g, "");
/** The few templates whose id is not their file name. */
const FILE_FOR = { "variable-extraction": "extraction.ts" };
const ids = Object.keys(TEMPLATES).filter((id) => id !== "index");
const MINE = Object.fromEntries(ids.map((id) => [id, FILE_FOR[id] ?? `${id}.ts`]));

let diffs = 0;
for (const [id, base] of Object.entries(MINE)) {
	const files = byBase(base);
	if (files.length !== 1) {
		diffs++;
		console.log(`${id.padEnd(26)} UPSTREAM FILE AMBIGUOUS/MISSING (${base}) -> ${files.length} match(es)`);
		continue;
	}
	const up = upstreamLiterals(files[0]).map(norm);
	const mine = (Array.isArray(TEMPLATES[id].content) ? TEMPLATES[id].content.map((m) => m.content) : [TEMPLATES[id].content]).map(norm);
	if (up.length !== mine.length) {
		diffs++;
		console.log(`${id.padEnd(26)} MESSAGE-COUNT DIFFERS upstream=${up.length} mine=${mine.length}`);
		continue;
	}
	let clean = true;
	for (let i = 0; i < up.length; i += 1) {
		if (up[i] === mine[i]) continue;
		clean = false; diffs++;
		console.log(`${id.padEnd(26)} message[${i}] DIFFERS  upstream=${up[i].length} mine=${mine[i].length}`);
		const a = up[i].split("\n");
		const b = mine[i].split("\n");
		for (let j = 0; j < Math.max(a.length, b.length); j += 1) {
			if (a[j] === b[j]) continue;
			console.log(`   first divergence at line ${j + 1}:`);
			console.log(`     up  : ${JSON.stringify(a[j] ?? "<none>")}`);
			console.log(`     mine: ${JSON.stringify(b[j] ?? "<none>")}`);
			break;
		}
	}
	if (clean) console.log(`${id.padEnd(26)} IDENTICAL (${up.length} message(s): ${up.map((s) => s.length).join("+")} chars)`);
}
console.log(diffs === 0 ? "\nALL TEMPLATES MATCH UPSTREAM" : `\n${diffs} template(s) differ from upstream`);
