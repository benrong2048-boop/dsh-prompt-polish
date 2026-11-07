#!/usr/bin/env node
/**
 * DSH compatibility audit — does this plugin's host/client contract still exist
 * in the DSH build you are running?
 *
 * The desktop app ships as a single app.asar, so the checks below read that
 * archive directly (no Electron required): the asar header is a Chromium pickle
 * whose JSON directory points at byte ranges inside the same file.
 *
 * Usage:
 *   node compat.mjs                 # auto-detect the installed desktop app
 *   node compat.mjs --asar <path>   # point at any app.asar
 *   DSH_ASAR=<path> node compat.mjs
 *
 * Exit code 0 = every contract this plugin relies on is present, 1 = something
 * changed and the plugin needs work.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Every host-side contract lib/index.js calls, as a literal the asar carries. */
const HOST_CHECKS = [
	["webServer.register(route: WebRoute)", "register(route: WebRoute"],
	["webServer route kind 'exact'", "kind: 'exact'"],
	["llm.stream(options: GenerateOptions)", "stream(options: GenerateOptions)"],
	["GenerateOptions.maxTokens", "maxTokens?: number"],
	["llm.listProviders()", "listProviders()"],
	["llm.listModels(provider)", "listModels(provider"],
	["agentDefaultModel.currentSelection()", "currentSelection(): ModelSelection"],
	["connection.requestRejection(request)", "requestRejection"],
	["stream chunk 'text-delta'", "text-delta"],
];

/** Every client-side contract lib/client.js relies on. */
const CLIENT_CHECKS = [
	["module loader global", "__ModuleLoader__"],
	["slot conversation.input.right", "conversation.input.right"],
	["dsh.client manifest scan", "dsh.client"],
	/**
	 * A symbol check cannot see CSS containment, which was exactly the miss:
	 * 0.2.2 turned the docked composer into a containment context and the
	 * fixed panel silently moved with it. DSH documents the requirement in the
	 * slot contract, so treat that sentence as part of the surface we depend on.
	 */
	["docked composer requires portalled overlays", "must portal to the document body"],
];

/** Client packages our package.json declares in dsh.client.inject. */
const INJECT_PACKAGES = [
	"@deepseek-ai/dsh-client-ui-conversation",
	"@deepseek-ai/dsh-client-ui-renderer",
	"@deepseek-ai/dsh-api-session-controller",
];

/** Candidate install locations for the desktop build, first hit wins. */
function candidateAsarPaths() {
	const out = [];
	const local = process.env.LOCALAPPDATA;
	if (local) out.push(join(local, "Programs", "DeepSeek Harness", "resources", "app.asar"));
	if (process.env.ProgramFiles) out.push(join(process.env.ProgramFiles, "DeepSeek Harness", "resources", "app.asar"));
	out.push("D:\\DSH Hareness\\resources\\app.asar");
	return out;
}

function resolveAsarPath(argv) {
	const i = argv.indexOf("--asar");
	if (i !== -1 && argv[i + 1]) return argv[i + 1];
	if (process.env.DSH_ASAR) return process.env.DSH_ASAR;
	for (const p of candidateAsarPaths()) if (existsSync(p)) return p;
	return null;
}

/**
 * Parse the archive's directory once, then pull single files out of it.
 *
 * The header is a Chromium pickle: [uint32 4][uint32 headerSize][pickled string].
 * Older Electron builds put the JSON straight after 8 bytes, newer ones after a
 * second framing word at 16 — so the start is detected by trial parse. File
 * offsets are relative to the byte after the header, in both layouts.
 * @param buffer - the whole archive.
 * @returns { entry(name): Buffer | null } reader over the archive.
 */
function asarReader(buffer) {
	const headerSize = buffer.readUInt32LE(4);
	const dataStart = 8 + headerSize;
	let header = null;
	for (const start of [16, 8]) {
		const length = buffer.readUInt32LE(start - 4);
		try {
			header = JSON.parse(buffer.toString("utf8", start, start + length));
			break;
		} catch {
			// Try the next layout before giving up.
		}
	}
	if (header === null) throw new Error("compat: unreadable asar header");
	return (name) => {
		let node = header;
		for (const part of name.split("/")) {
			if (node === null || typeof node !== "object" || node.files === undefined) return null;
			node = node.files[part] ?? null;
		}
		if (node === null || typeof node !== "object" || node.size === undefined) return null;
		const start = dataStart + Number(node.offset);
		return buffer.subarray(start, start + Number(node.size));
	};
}

const asarPath = resolveAsarPath(process.argv.slice(2));
if (asarPath === null) {
	console.error("compat: no app.asar found. Pass --asar <path> or set DSH_ASAR.");
	process.exit(1);
}

const bytes = readFileSync(asarPath);
const entry = asarReader(bytes);
const text = bytes.toString("latin1");

/** Version of the runtime, read from the archive rather than guessed. */
let version = "(unknown)";
try {
	const pkg = JSON.parse(entry("dsh/package.json").toString("utf8"));
	version = `${pkg.name}@${pkg.version}`;
} catch {
	// Version is informational — a miss must not fail the audit.
}

let failures = 0;
function line(ok, label, extra) {
	if (!ok) failures += 1;
	console.log(`    ${ok ? "ok  " : "MISS"} ${label}${extra ? "  " + extra : ""}`);
}

console.log("DSH compat audit");
console.log("  asar:    " + asarPath + " (" + (bytes.length / 1048576).toFixed(1) + " MB)");
console.log("  runtime: " + version);
console.log("");
console.log("  host surface");
for (const [label, needle] of HOST_CHECKS) line(text.includes(needle), label);
console.log("");
console.log("  client surface");
for (const [label, needle] of CLIENT_CHECKS) line(text.includes(needle), label);
console.log("");
console.log("  injected client packages");
for (const name of INJECT_PACKAGES) {
	let found = "(missing)";
	try {
		const pkg = JSON.parse(entry(`dsh/node_modules/${name}/package.json`).toString("utf8"));
		found = "v" + pkg.version;
	} catch {
		found = "(missing)";
	}
	line(found !== "(missing)", name, found);
}

const total = HOST_CHECKS.length + CLIENT_CHECKS.length + INJECT_PACKAGES.length;
console.log("");
if (failures === 0) {
	console.log(`  ${total}/${total} checks passed — this plugin's contract is intact on ${version}.`);
} else {
	console.log(`  ${total - failures}/${total} checks passed — ${failures} missing. Re-check lib/index.js (host) and lib/client.js (client) against the new API.`);
}
/**
 * A symbol audit cannot detect a layout regression: the 0.2.2 containment
 * change kept every string above present while the panel silently shifted
 * right. State the CSS fact explicitly so the next DSH update is read with the
 * right question in mind, and keep the requirement next to the verdict.
 */
console.log("");
console.log("  overlay rule: the docked composer is a CSS containment context;");
console.log("  fixed overlays MUST be portalled to document.body (lib/client.js does this).");
process.exit(failures === 0 ? 0 : 1);
