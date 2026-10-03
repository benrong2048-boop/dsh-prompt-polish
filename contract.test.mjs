/**
 * Contract test for the hand-authored browser bundle.
 *
 * Loads `lib/client.js` exactly as the DSH module system does (a
 * `window.__ModuleLoader__.load` call handing back a `require`-based factory),
 * then drives it with a React stand-in whose `useState` holds across renders and
 * whose `useEffect` actually runs, against a fake `fetch` answering both host
 * routes. The template catalog in that answer is imported from the real
 * `prompts.js`, so the fixture cannot drift from what the server accepts.
 *
 * Everything asserted here is reached by clicking a rendered control — an
 * earlier revision called `inputActions.setDraft()` by hand and reported a green
 * pass while the button itself was never exercised.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const PROFILE = "C:/Users/23528/.dsh/profiles/desktop/node_modules/@benrong/dsh-prompt-polish";
const BUNDLE = `${PROFILE}/lib/client.js`;
const PACKAGE_ID = "@benrong/dsh-prompt-polish";
const { OPTIMIZATION_MODES, TEMPLATES } = await import(pathToFileURL(`${PROFILE}/lib/prompts.js`).href);

const fail = [];
const ok = (label, cond, extra) => {
	console.log((cond ? "PASS " : "FAIL ") + label + (cond || extra === void 0 ? "" : " -> " + extra));
	if (!cond) fail.push(label);
};

/* ---- the catalog the host really serves ---------------------------------- */
const CATALOG = {
	current: { provider: "amazon-bedrock", model: "qwen3.8-flash" },
	groups: [{
		provider: "amazon-bedrock",
		name: "Amazon Bedrock",
		models: [{ id: "qwen3.8-flash", name: "qwen3.8-flash" }, { id: "wan2.7-image", name: "wan2.7-image" }]
	}],
	modes: OPTIMIZATION_MODES,
	templates: Object.values(TEMPLATES).filter((template) => template.optimizationMode !== void 0).map((template) => ({
		id: template.id,
		label: template.label,
		optimizationMode: template.optimizationMode,
		templateType: template.templateType,
		simple: typeof template.content === "string",
		variables: template.fields,
		fields: template.fields
	})),
	defaults: { system: "general-optimize", user: "user-prompt-professional", iterate: "iterate" },
	extraction: true
};
const POLISHED = "# Role：周报助手\n## Goals：\n- 汇总本周";
const EXTRACTED = {
	variables: [{ name: "时间范围", value: "本周", position: { originalText: "本周", occurrence: 1 }, reason: "常换" }],
	summary: "共识别出1个可参数化的变量",
	templated: "# Role：周报助手\n## Goals：\n- 汇总{{时间范围}}",
	model: "amazon-bedrock/qwen3.8-flash"
};
const posted = [];
const extracted = [];
/** Swappable so one test can answer extraction with a failed substitution. */
let extractResponse = EXTRACTED;
let failNextRun = false;
const encoder = new TextEncoder();
function ndjson(text) {
	const bytes = encoder.encode(text);
	let sent = false;
	return { read: async () => sent ? { done: true, value: void 0 } : (sent = true, { done: false, value: bytes }) };
}
async function fakeFetch(url, options) {
	if (url === "/prompt-polish/models") return { ok: true, status: 200, json: async () => CATALOG };
	if (url === "/prompt-polish/extract-variables") {
		const body = JSON.parse(options.body);
		extracted.push(body);
		return { ok: true, status: 200, json: async () => extractResponse };
	}
	if (url === "/prompt-polish/optimize") {
		if (failNextRun) return { ok: false, status: 500, json: async () => ({ message: "模型没有返回可用内容。" }) };
		const body = JSON.parse(options.body);
		posted.push(body);
		const events = [{ type: "delta", text: POLISHED }, { type: "done", text: POLISHED, model: "amazon-bedrock/qwen3.8-flash", usage: { inputTokens: 120, outputTokens: 45, totalTokens: 165 } }].map((event) => JSON.stringify(event)).join("\n") + "\n";
		return { ok: true, status: 200, body: { getReader: () => ndjson(events) } };
	}
	return { ok: false, status: 404, json: async () => ({}) };
}
/** Let queued promise callbacks land between renders. */
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };

/* ---- the module system's own contract ---------------------------------- */
let registered = null;
const sandboxWindow = {
	__ModuleLoader__: { load: (row) => { registered = row; } },
	addEventListener: () => {},
	removeEventListener: () => {},
	innerWidth: 1280,
	innerHeight: 900
};
/**
 * The browser globals the client may touch. A vm context provides NONE of them,
 * and a missing `setTimeout` once silently rerouted every fake run through the
 * error path (the delta text equalled the final text, so result assertions still
 * passed) — so the harness must mirror the browser surface the client is written
 * against, and the anti-masking assertion below must stay.
 */
const copiedTexts = [];
const sandboxNavigator = { clipboard: { writeText: async (text) => { copiedTexts.push(text); } } };
/**
 * The client keeps the polish history in localStorage, so the harness must
 * provide one or every history assertion would silently read nothing. The Map
 * stays visible to the test body, which is how the assertions inspect what a
 * finished run actually persisted.
 */
const localStorageStore = new Map();
const fakeLocalStorage = {
	getItem: (key) => (localStorageStore.has(key) ? localStorageStore.get(key) : null),
	setItem: (key, value) => { localStorageStore.set(key, String(value)); },
	removeItem: (key) => { localStorageStore.delete(key); },
	clear: () => { localStorageStore.clear(); }
};
const sandbox = vm.createContext({ window: sandboxWindow, document: undefined, console, TextDecoder, TextEncoder, fetch: fakeFetch, AbortController, setTimeout, clearTimeout, navigator: sandboxNavigator, localStorage: fakeLocalStorage });
new vm.Script(readFileSync(BUNDLE, "utf8"), { filename: "client.js" }).runInContext(sandbox);

ok("bundle self-registers via window.__ModuleLoader__.load", registered !== null);
ok("registration id matches the package name", registered?.id === PACKAGE_ID, String(registered?.id));
ok("registration supplies a factory function", typeof registered?.factory === "function");

/* ---- a React stand-in that holds state and really runs effects ---------- */
const state = [];
const effectErrors = [];
let cursor = 0;
function resetHooks() { cursor = 0; }
const React = {
	createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
	useState: (init) => {
		const i = cursor++;
		if (state[i] === void 0) state[i] = { value: typeof init === "function" ? init() : init };
		return [state[i].value, (next) => { state[i].value = typeof next === "function" ? next(state[i].value) : next; }];
	},
	useRef: (init) => { const i = cursor++; if (state[i] === void 0) state[i] = { current: init }; return state[i]; },
	/** Runs on every render; that is what makes the on-mount catalog fetch happen. */
	useEffect: (fn) => { try { fn(); } catch (error) { effectErrors.push(error.message); } },
	useCallback: (fn) => fn,
	useMemo: (fn) => fn()
};
const requires = [];
const plugin = registered.factory((spec) => {
	requires.push(spec);
	if (spec === "react") return React;
	throw new Error("unexpected require: " + spec);
});
ok("bundle requires only react", requires.join(",") === "react", requires.join(","));
ok("bundle exports apply", typeof plugin.apply === "function");
ok("bundle exports inject", Array.isArray(plugin.inject) && plugin.inject.includes("slots"), JSON.stringify(plugin.inject));

/* ---- pure helpers behind the new features ------------------------------- */
const scoreDraft = plugin.__scoreDraft;
const analyzeChange = plugin.__analyzeChange;
const usageText = plugin.__usageText;
ok("the hint scorer is exported for direct testing", typeof scoreDraft === "function");
ok("the structure analyzer is exported for direct testing", typeof analyzeChange === "function");
ok("the usage sentence builder is exported for direct testing", typeof usageText === "function");

/* the flame: quiet on empty and complete drafts, burning on vague ones */
ok("an empty draft keeps the flame quiet", scoreDraft("").level === "quiet" && scoreDraft("   ").level === "quiet", JSON.stringify(scoreDraft("")));
ok("a vague one-liner burns", scoreDraft("帮我优化一下").level === "burn", JSON.stringify(scoreDraft("帮我优化一下")));
ok("vagueness names its reasons", JSON.stringify(scoreDraft("随便写个东西").reasons).includes("要求比较模糊"), JSON.stringify(scoreDraft("随便写个东西")));
ok("a structured long prompt stays quiet", scoreDraft("请帮我分析这份销售数据。背景：本周华东区环比下降 5%。要求：输出 Markdown 表格，按大区列出原因、环比、建议三列，不超过 300 字，最后给三条行动建议。受众是区域经理。").level === "quiet", JSON.stringify(scoreDraft("请帮我分析这份销售数据。背景：本周华东区环比下降 5%。要求：输出 Markdown 表格，按大区列出原因、环比、建议三列，不超过 300 字，最后给三条行动建议。受众是区域经理。")));
ok("a complete short draft only embers", scoreDraft("请把这份销售数据按大区整理成 Markdown 表格，背景是本周华东区环比下降，给区域经理看，不超过 300 字").level === "ember" && scoreDraft("请把这份销售数据按大区整理成 Markdown 表格，背景是本周华东区环比下降，给区域经理看，不超过 300 字").reasons.join("") === "内容较短", JSON.stringify(scoreDraft("请把这份销售数据按大区整理成 Markdown 表格，背景是本周华东区环比下降，给区域经理看，不超过 300 字")));
ok("a raw code line is treated as an unfinished ask and burns", scoreDraft("function sum(a,b){return a+b;}").level === "burn", JSON.stringify(scoreDraft("function sum(a,b){return a+b;}")));

/* the local structure analysis */
const cmpA = analyzeChange("帮我写个周报", "# Role：周报助手\n## Goals：\n- 汇总本周，输出 Markdown 表格");
ok("the analyzer counts line changes and flags gained/lost structure", cmpA.addedLines === 3 && cmpA.removedLines === 1 && cmpA.gained.includes("输出格式") && cmpA.gained.includes("背景") && cmpA.lost.includes("目标/动作"), JSON.stringify(cmpA));
ok("identical text yields a zero diff", (() => { const z = analyzeChange("同一段文字", "同一段文字"); return z.addedLines === 0 && z.removedLines === 0 && z.gained.length === 0 && z.lost.length === 0; })(), "");

/* the token sentence: honest absence, never a fake 0 */
ok("usage absent reads as 未提供, not 0", usageText(void 0) === "本次用量未提供", usageText(void 0));
ok("usage present reads the three numbers", usageText({ inputTokens: 120, outputTokens: 45, totalTokens: 165 }) === "本次 120 输入 + 45 输出 = 165 tokens", usageText({ inputTokens: 120, outputTokens: 45, totalTokens: 165 }));

/* ---- registration into the seat beside the model ------------------------ */
const injected = [];
let registeredOptions = null;
let Component = null;
plugin.apply({
	effect: (fn, label) => { fn(); },
	get slots() {
		return {
			inject: (name, callback) => { injected.push(name); callback(); return () => {}; },
			register: (options, component) => { registeredOptions = options; Component = component; }
		};
	}
});
ok("injects into conversation.input.right (the seat before the model selector)", injected.join(",") === "conversation.input.right", injected.join(","));
ok("registration names its target slot", registeredOptions?.name === "conversation.input.right");
ok("registration carries a list-slot id", typeof registeredOptions?.id === "string" && registeredOptions.id.length > 0);
ok("registration component is a function", typeof Component === "function");

/* ---- helpers over the rendered tree ------------------------------------- */
function walk(node, out = []) {
	if (node === null || node === void 0 || typeof node !== "object") return out;
	if (Array.isArray(node)) { for (const child of node) walk(child, out); return out; }
	out.push(node);
	walk(node.children, out);
	return out;
}
const calls = [];
/** Mutable so the disable-condition tests can empty the composer mid-suite. */
let DRAFT = "帮我写个周报";
const props = {
	useInput: (selector) => selector({ draft: DRAFT, attachmentIds: [], draftRev: 1, phase: "plain" }),
	inputActions: {
		setDraft: (text) => { calls.push(["setDraft", text]); },
		submit: () => { calls.push(["submit"]); }
	}
};
function render() { resetHooks(); return walk(Component(props)); }
/** Fresh component: every useState slot is dropped, so the catalog refetches. */
function rebuild() { state.length = 0; posted.length = 0; extracted.length = 0; calls.length = 0; }
const byClass = (tree, className) => tree.filter((node) => node.props?.className === className);
const labelled = (tree, className, label) => tree.find((node) => node.props?.className === className && node.children.join("") === label);
async function openAndRun() {
	let tree = render();
	await settle();
	tree = render();
	byClass(tree, "pp-seat")[0].props.onClick();
	await settle();
	return render();
}

/* ---- mount --------------------------------------------------------------- */
let tree = render();
const seat = byClass(tree, "pp-seat")[0];
ok("renders a pp-seat control", seat !== undefined);
ok("seat is a real <button>", seat?.type === "button");
ok("seat is labelled for Chinese users", JSON.stringify(seat?.children ?? []).includes("润色"));
ok("seat wears the glow-button wrapper (two layers + spark)", byClass(tree, "pp-seatwrap").length === 1 && byClass(tree, "pp-seat-layer").length === 2 && byClass(tree, "pp-seat-spark").length === 1);
ok("the seat carries no decorative label overlay", byClass(tree, "pp-seat-text").length === 0);
await settle();
tree = render();
ok("no effect threw on mount", effectErrors.length === 0, effectErrors.join(" | "));
ok("the panel stays closed until the seat is clicked", byClass(tree, "pp-panel").length === 0);

/* ---- the optimizationMode axis (rendered inside the panel) -------------- */
calls.length = 0;
/**
 * Click the seat from the CURRENT tree: an earlier render closed over a null
 * catalog and would refuse to run, which is exactly the stale-closure bug the
 * on-mount fetch removed in the component.
 */
byClass(tree, "pp-seat")[0].props.onClick();
await settle();
tree = render();
ok("clicking the seat opens the panel", byClass(tree, "pp-panel").length === 1);
const tabLabels = byClass(tree, "pp-tab").map((node) => node.children.join(""));
ok("tabs are the optimizationMode axis, not a style axis", tabLabels.join("|") === "系统提示词|用户提示词|迭代优化", tabLabels.join("|"));
/**
 * The option values of the template picker, as a set. Derived from the registry
 * rather than a whitelist of ids: a filter that names the ids it expects cannot
 * notice a template that stopped being offered, which is the whole thing this
 * assertion exists to catch.
 */
const templateIdsOf = (mode) => Object.values(TEMPLATES).filter((t) => t.optimizationMode === mode).map((t) => t.id);
const pickerValues = (node) => byClass(node, "pp-sel")
	.flatMap((sel) => (sel.children ?? []).map((child) => child?.props?.value))
	.filter((value) => typeof value === "string" && value !== "");
const systemFamily = templateIdsOf("system");
ok("system family offers every template the registry has for it", (() => {
	const shown = pickerValues(tree).filter((value) => systemFamily.includes(value));
	return shown.length === systemFamily.length && systemFamily.every((id) => shown.includes(id));
})(), pickerValues(tree).join(","));
ok("the axis comes from the server catalog, not a hardcoded list", !tabLabels.includes("快速润色") && !tabLabels.includes("结构化重写"));
ok("the streamed result is rendered", JSON.stringify(byClass(tree, "pp-out")[0]?.children ?? "").includes("周报助手"));
ok("a run posts upstream's OptimizationRequest shape", posted.length === 1 && posted[0].optimizationMode === "system" && posted[0].targetPrompt === "帮我写个周报" && posted[0].templateId === "general-optimize", JSON.stringify(posted));
ok("the invented variables bag is gone", posted[0].variables === void 0 && posted[0].mode === void 0 && posted[0].prompt === void 0);
const footLabels = byClass(tree, "pp-btn").map((node) => node.children.join(""));
ok("footer labels stay a coherent four-character set", footLabels.join("|") === "重新生成|发送草稿|提取变量|替换草稿", footLabels.join("|"));

/* ---- anti-masking: a successful run must not ride the error path --------- */
ok("a successful run paints no pp-err banner", byClass(tree, "pp-err").length === 0, JSON.stringify(byClass(tree, "pp-err").map((node) => node.children)));
const metaText0 = byClass(tree, "pp-meta")[0]?.children.join("") ?? "";
ok("meta names the model that answered", metaText0.includes("模型 amazon-bedrock/qwen3.8-flash"), metaText0);
ok("meta carries the stream's token usage", metaText0.includes("tok 120→45"), metaText0);
ok("meta reports the result size in 字", /\d+ 字/.test(metaText0), metaText0);
ok("meta's full text rides in its title (the footer ellipsizes)", byClass(tree, "pp-meta")[0]?.props?.title === metaText0, byClass(tree, "pp-meta")[0]?.props?.title);

/* ---- the result-area copy button (doc: 优化并复制结果) -------------------- */
const copyBtn = labelled(tree, "pp-btn pp-mini", "复制草稿");
ok("the result area carries a 复制草稿 button", copyBtn !== undefined, JSON.stringify(byClass(tree, "pp-btn pp-mini").map((n) => n.children.join(""))));
copiedTexts.length = 0;
calls.length = 0;
copyBtn.props.onClick();
await settle();
tree = render();
ok("复制草稿 copies the result text to the clipboard", copiedTexts.length === 1 && copiedTexts[0] === POLISHED, JSON.stringify(copiedTexts.map((t) => t.slice(0, 10))));
ok("and touches neither draft nor send queue", calls.length === 0, JSON.stringify(calls));
ok("it flips to a confirmed state", labelled(tree, "pp-btn pp-mini", "已复制 ✓") !== undefined, JSON.stringify(byClass(tree, "pp-btn pp-mini").map((n) => n.children.join(""))));

/* ---- switching the axis selects the other family ------------------------- */
posted.length = 0;
labelled(tree, "pp-tab", "用户提示词").props.onClick();
await settle();
tree = render();
ok("用户提示词 starts on the documented default 专业优化", posted.at(-1)?.templateId === "user-prompt-professional", JSON.stringify(posted));
ok("that family still carries the draft as targetPrompt", posted.at(-1)?.targetPrompt === "帮我写个周报" && posted.at(-1)?.optimizationMode === "user");
const userFamily = templateIdsOf("user");
const shownUser = pickerValues(tree).filter((value) => userFamily.includes(value));
ok("the user family exposes every one of its templates", shownUser.length === userFamily.length && userFamily.every((id) => shownUser.includes(id)), shownUser.join("|"));

/* ---- picking the second template in a family re-runs -------------------- */
posted.length = 0;
const tplSelect = byClass(tree, "pp-sel").find((node) => node.props?.title === "使用哪个优化模板");
ok("a template picker exists", tplSelect !== undefined);
tplSelect.props.onChange({ target: { value: "user-prompt-basic" } });
await settle();
ok("choosing 基础优化 away from the default posts that template", posted.at(-1)?.templateId === "user-prompt-basic", JSON.stringify(posted.at(-1)));

/* ---- the send path ------------------------------------------------------- */
calls.length = 0;
tree = render();
const sendBtn = labelled(tree, "pp-btn", "发送草稿");
ok("发送草稿 exists", sendBtn !== undefined);
sendBtn.props.onClick();
ok("发送草稿 writes the polished text then submits, in that order", JSON.stringify(calls) === JSON.stringify([["setDraft", POLISHED], ["submit"]]), JSON.stringify(calls));

/* ---- 替换草稿 writes back without sending -------------------------------- */
rebuild();
tree = await openAndRun();
calls.length = 0;
const replaceBtn = labelled(tree, "pp-btn", "替换草稿");
ok("替换草稿 exists", replaceBtn !== undefined);
replaceBtn.props.onClick();
ok("替换草稿 writes the result into the draft", calls.length === 1 && calls[0][0] === "setDraft" && calls[0][1] === POLISHED, JSON.stringify(calls));
ok("替换草稿 does not submit", !calls.some((c) => c[0] === "submit"), JSON.stringify(calls));

/* ---- the iterate path from an empty result (the dead end this fixed) ----- */
rebuild();
failNextRun = true;
tree = await openAndRun();
failNextRun = false;
ok("a failed run leaves no result to iterate on", labelled(tree, "pp-btn", "发送草稿") === undefined);
labelled(tree, "pp-tab", "迭代优化").props.onClick();
await settle();
tree = render();
const startBtn = labelled(tree, "pp-btn", "开始优化");
ok("with no result the run button reads 开始优化", startBtn !== undefined, byClass(tree, "pp-btn").map((node) => node.children.join("")).join("|"));
/**
 * Doc-aligned disable: grey is allowed, silent grey is not — the title must name
 * the missing precondition, and filling it must re-enable the button (that is
 * what separates this from the old dead end, which had no way forward at all).
 * Note `props.disabled`: reading `node.disabled` off the h() stub is undefined
 * and would pass vacuously — the old assertion here did exactly that.
 */
ok("iterate without a revision note is disabled — and the title says why", startBtn !== undefined && startBtn.props.disabled === true && String(startBtn.props.title).includes("改进意见"), String(startBtn?.props?.title));
posted.length = 0;
startBtn.props.onClick(); // a programmatic click still meets run()'s own guard
await settle();
tree = render();
ok("iterating without a revision note is refused, not sent", posted.length === 0 && JSON.stringify(byClass(tree, "pp-err")[0]?.children ?? "").includes("改进意见"), JSON.stringify(posted));
byClass(tree, "pp-ta")[0].props.onChange({ target: { value: "再简洁一些" } });
posted.length = 0;
tree = render();
ok("typing the revision note re-enables the run button", labelled(tree, "pp-btn", "开始优化")?.props?.disabled !== true);
(labelled(tree, "pp-btn", "开始优化") ?? labelled(tree, "pp-btn", "重新生成")).props.onClick();
await settle();
const iterated = posted.at(-1);
ok("iterate posts its own template", iterated?.templateId === "iterate", JSON.stringify(iterated));
ok("iterate carries iterateInput", iterated?.iterateInput === "再简洁一些");
ok("iterate carries a lastOptimizedPrompt string", typeof iterated?.lastOptimizedPrompt === "string" && iterated.lastOptimizedPrompt !== "");
ok("iterate still names the mode it belongs to", iterated?.optimizationMode === "iterate");

/* ---- variable extraction is its own call, and its own write-back -------- */
rebuild();
tree = await openAndRun();
extracted.length = 0;
calls.length = 0;
const extractBtn = labelled(tree, "pp-btn", "提取变量");
ok("提取变量 appears once there is something to analyse", extractBtn !== undefined, byClass(tree, "pp-btn").map((node) => node.children.join("")).join("|"));
extractBtn.props.onClick();
await settle();
tree = render();
ok("extraction posts the result as promptContent", extracted.length === 1 && extracted[0].promptContent === POLISHED, JSON.stringify(extracted));
ok("it is a separate route from optimize", posted.length === 1 && posted[0].templateId !== void 0);
const list = byClass(tree, "pp-vlist")[0];
ok("extracted variables are listed with their slots", JSON.stringify(list?.children ?? []).includes("{{时间范围}}"), JSON.stringify(list?.children ?? []).slice(0, 120));
ok("the summary is shown", JSON.stringify(byClass(tree, "pp-vars")[0]?.children ?? "").includes("共识别出1个"));
const applyBtn = labelled(tree, "pp-btn", "写回模板");
ok("写回模板 appears after extraction", applyBtn !== undefined);
calls.length = 0;
applyBtn.props.onClick();
ok("写回模板 writes the templated text, not the plain result", calls.length === 1 && calls[0][0] === "setDraft" && calls[0][1] === EXTRACTED.templated, JSON.stringify(calls));
ok("写回模板 does not submit", !calls.some((c) => c[0] === "submit"), JSON.stringify(calls));

/* ---- a failed substitution keeps the list and disables only the write-back */
extractResponse = {
	...EXTRACTED,
	templated: null,
	templatedError: "变量 时间范围 的位置对不上：原文里找不到第 2 次出现的「本周」。"
};
rebuild();
tree = await openAndRun();
calls.length = 0;
labelled(tree, "pp-btn", "提取变量").props.onClick();
await settle();
tree = render();
ok("the variables are still listed when the substitution failed", JSON.stringify(byClass(tree, "pp-vlist")[0]?.children ?? []).includes("{{时间范围}}"));
const deadApply = labelled(tree, "pp-btn", "写回模板");
ok("写回模板 stays visible but disabled", deadApply !== undefined && deadApply.props.disabled === true, String(deadApply?.props.disabled));
ok("its title carries the host's reason, not a generic hint", String(deadApply?.props.title).includes("位置对不上"), deadApply?.props.title);
calls.length = 0;
deadApply.props.onClick();
ok("a disabled write-back touches nothing", calls.length === 0, JSON.stringify(calls));
ok("and the plain 替换草稿 path still works alongside it", labelled(tree, "pp-btn", "替换草稿").props.disabled !== true);
extractResponse = EXTRACTED;

/* ---- doc-aligned disable: an empty composer blocks the run, with a reason */
rebuild();
DRAFT = "";
tree = await openAndRun();
ok("an empty draft posts nothing on open", posted.length === 0, JSON.stringify(posted));
const idleBtn = labelled(tree, "pp-btn", "开始优化");
ok("开始优化 is disabled while the composer is empty", idleBtn !== undefined && idleBtn.props.disabled === true, String(idleBtn?.props?.disabled));
ok("and its title names the missing precondition", String(idleBtn?.props?.title).includes("输入框"), String(idleBtn?.props?.title));
ok("the refusal is also explained in the panel", JSON.stringify(byClass(tree, "pp-err")[0]?.children ?? "").includes("还没有内容"), JSON.stringify(byClass(tree, "pp-err")[0]?.children ?? ""));
ok("with nothing generated there is no result-area copy button", labelled(tree, "pp-btn pp-mini", "复制草稿") === undefined, JSON.stringify(byClass(tree, "pp-btn pp-mini").map((n) => n.children.join(""))));
DRAFT = "帮我写个周报";

/* ---- history v2: consent, version chain, 对比 --------------------------- */
rebuild();
localStorageStore.clear();
tree = await openAndRun();
/**
 * Consent gates persistence: with consent undecided the run must NOT have been
 * written to disk, and the card must be up, naming exactly what stays local.
 */
ok("no consent means nothing was persisted", localStorageStore.get("dsh.prompt-polish/history") === null || JSON.parse(localStorageStore.get("dsh.prompt-polish/history") ?? "{\"consent\":\"unknown\"}").consent === "unknown", String(localStorageStore.get("dsh.prompt-polish/history")));
ok("the consent card is up after the first run", byClass(tree, "pp-consent").length >= 1, JSON.stringify(byClass(tree, "pp-consent").map((n) => n.children).slice(0, 1)));
ok("the consent card names local-only storage", JSON.stringify(byClass(tree, "pp-consent").map((n) => n.children ?? "")).includes("这台设备"), "");
var histBtn = labelled(tree, "pp-btn pp-mini", "历史");
ok("the panel head carries a 历史 switch", histBtn !== undefined);
histBtn.props.onClick();
await settle();
tree = render();
const grantBtn = labelled(tree, "pp-btn pp-mini", "开启历史");
ok("the consent card offers 开启历史 and 不保存", grantBtn !== undefined && labelled(tree, "pp-btn pp-mini", "不保存") !== undefined);
grantBtn.props.onClick();
await settle();
tree = render();
const stored = JSON.parse(localStorageStore.get("dsh.prompt-polish/history") ?? "{}");
ok("granting consent persists the envelope with the pending run", stored.consent === "granted" && Array.isArray(stored.entries) && stored.entries.length === 1 && stored.entries[0].input === DRAFT && stored.entries[0].output === POLISHED, JSON.stringify(stored).slice(0, 160));
ok("each record names its template and has a chain id", stored.entries[0]?.template === "通用优化" && typeof stored.entries[0]?.id === "string" && stored.entries[0]?.rootId === stored.entries[0]?.id, JSON.stringify(stored.entries[0]).slice(0, 120));
ok("the consent card is gone once decided", byClass(tree, "pp-consent").length === 0, String(byClass(tree, "pp-consent").length));
ok("the history view lists one collapsed card", byClass(tree, "pp-hitem").length === 1 && byClass(tree, "pp-hpre").length === 0, String(byClass(tree, "pp-hitem").length));
ok("the live footer steps aside while history is open", byClass(tree, "pp-foot").length === 0);
byClass(tree, "pp-hhead")[0].props.onClick();
await settle();
tree = render();
const pres = byClass(tree, "pp-hpre").map((node) => node.children.join(""));
ok("expanding shows that run's input and its optimized output", JSON.stringify(pres) === JSON.stringify([DRAFT, POLISHED]), JSON.stringify(pres).slice(0, 90));
ok("the version card shows the token sentence", JSON.stringify(byClass(tree, "pp-usage").map((n) => n.children.join(""))).includes("本次 120 输入 + 45 输出 = 165 tokens"), JSON.stringify(byClass(tree, "pp-usage").map((n) => n.children.join(""))));
calls.length = 0;
copiedTexts.length = 0;
labelled(tree, "pp-btn pp-mini", "复制结果").props.onClick();
await settle();
ok("复制结果 copies that record without touching the composer", copiedTexts.join("") === POLISHED && calls.length === 0, JSON.stringify(copiedTexts));
/** 写回会收起面板，所以先进对比，再做会关面板的写回动作。 */
tree = render();
const cmpBtn = labelled(tree, "pp-btn pp-mini", "对比版本链");
ok("the expanded card offers 对比版本链", cmpBtn !== undefined);
cmpBtn.props.onClick();
await settle();
tree = render();
const cols = byClass(tree, "pp-ccol");
ok("对比 shows 原稿 / 所选版本 / 最新版本 three columns", cols.length === 3, String(cols.length));
ok("原稿 column carries the original draft", JSON.stringify(cols[0]?.children ?? "").includes(DRAFT.slice(0, 6)), JSON.stringify(cols[0]?.children ?? "").slice(0, 80));
	const csum = JSON.stringify(byClass(tree, "pp-csum")[0]?.children ?? []);
ok("结构变化 is labelled a local analysis with correct line counts", csum.includes("本机分析") && csum.includes("新增 3 行") && csum.includes("删除 1 行"), csum);
ok("the summary names the gained structure", csum.includes("补上了"), csum);
ok("the chain total names the tokens", csum.includes("整条链共 120 输入 + 45 输出 = 165 tokens"), csum);
labelled(tree, "pp-btn pp-mini", "← 历史").props.onClick();
await settle();
tree = render();
ok("← 历史 returns to the record list", byClass(tree, "pp-hitem").length === 1, String(byClass(tree, "pp-hitem").length));
if (byClass(tree, "pp-hpre").length === 0) {
	byClass(tree, "pp-hhead")[0].props.onClick();
	await settle();
	tree = render();
}
const writeBackBtn = labelled(tree, "pp-btn pp-mini", "写回输入框");
if (writeBackBtn === void 0) throw new Error("写回输入框 not rendered after expand");
writeBackBtn.props.onClick();
ok("写回输入框 puts that record's output back into the draft", calls.length === 1 && calls[0][0] === "setDraft" && calls[0][1] === POLISHED, JSON.stringify(calls));

/* ---- iterate builds a child version inside the same chain --------------- */
/** 写回收起了面板：重新点 seat 会再跑一次（作为链条第二版），然后迭代出第三版。 */
tree = render();
byClass(tree, "pp-seat")[0].props.onClick();
await settle();
tree = render();
const iterTab = labelled(tree, "pp-tab", "迭代优化");
iterTab.props.onClick();
await settle();
tree = render();
byClass(tree, "pp-ta")[0].props.onChange({ target: { value: "再简洁一些" } });
await settle();
tree = render();
posted.length = 0;
(labelled(tree, "pp-btn", "开始优化") ?? labelled(tree, "pp-btn", "重新生成")).props.onClick();
await settle();
tree = render();
const stored2 = JSON.parse(localStorageStore.get("dsh.prompt-polish/history") ?? "{}");
const iterEntry = stored2.entries.find((e) => e.mode === "iterate");
const rootEntry = stored2.entries.find((e) => e.mode === "system" && iterEntry && e.id === iterEntry.parentId);
ok("the iterate run lands as a child of the version it revised", iterEntry !== void 0 && rootEntry !== void 0 && iterEntry.parentId === rootEntry.id && iterEntry.rootId === rootEntry.rootId, JSON.stringify(stored2.entries.map((e) => ({ id: e.id, mode: e.mode, parent: e.parentId, root: e.rootId })))); 
ok("the chain now holds the original, its child, and the fresh root", stored2.entries.length === 3, String(stored2.entries.length));
ok("the iterated version records its own usage", iterEntry?.usage?.inputTokens === 120 && iterEntry?.usage?.outputTokens === 45, JSON.stringify(iterEntry?.usage));

/* ---- version deletion keeps the chain walkable -------------------------- */
labelled(tree, "pp-btn pp-mini", "历史").props.onClick();
await settle();
tree = render();
byClass(tree, "pp-hhead")[0].props.onClick();
await settle();
tree = render();
labelled(tree, "pp-btn pp-mini", "删除此版").props.onClick();
await settle();
tree = render();
const stored3 = JSON.parse(localStorageStore.get("dsh.prompt-polish/history") ?? "{}");
ok("删除此版 removes exactly that version", stored3.entries.length === 2, String(stored3.entries.length));
ok("删除此版 keeps the rest of the chain walkable", stored3.entries.some((e) => e.mode === "system") === true, JSON.stringify(stored3.entries.map((e) => e.mode)));
byClass(tree, "pp-hhead")[0].props.onClick();
await settle();
tree = render();
labelled(tree, "pp-btn pp-mini", "删除整条链").props.onClick();
await settle();
tree = render();
const stored4 = JSON.parse(localStorageStore.get("dsh.prompt-polish/history") ?? "{}");
ok("删除整条链 empties that chain but keeps consent and other chains", stored4.consent === "granted" && stored4.entries.every((e) => e.rootId !== stored3.entries[0].rootId), JSON.stringify({ consent: stored4.consent, n: stored4.entries.length }));
/** 还剩另一条链的 1 条记录：展开它，走删除与授权流程。 */
byClass(tree, "pp-hhead")[0].props.onClick();
await settle();
tree = render();
labelled(tree, "pp-btn pp-mini", "删除此版").props.onClick();
await settle();
tree = render();
const storedEmpty = JSON.parse(localStorageStore.get("dsh.prompt-polish/history") ?? "{}");
ok("the last chain deletes down to a truly empty store", storedEmpty.entries.length === 0, String(storedEmpty.entries.length));
ok("an empty history explains itself instead of looking broken", JSON.stringify(byClass(tree, "pp-note").map((n) => n.children.join(""))).includes("还没有润色记录"), JSON.stringify(byClass(tree, "pp-note").map((n) => n.children.join(""))));

/* ---- 不保存 wipes and stops nagging; 历史页 can re-enable --------------- */
/** A fresh user (new mount, empty store) runs once and picks 不保存. */
rebuild();
localStorageStore.clear();
tree = await openAndRun();
const declineBtn = labelled(tree, "pp-btn pp-mini", "不保存");
ok("the fresh consent card offers 不保存", declineBtn !== undefined);
declineBtn.props.onClick();
await settle();
tree = render();
const declined = JSON.parse(localStorageStore.get("dsh.prompt-polish/history") ?? "{}");
ok("不保存 marks consent declined and wipes entries", declined.consent === "declined" && declined.entries.length === 0, JSON.stringify(declined));
/** The declined user can re-enable from the history view without being nagged again. */
labelled(tree, "pp-btn pp-mini", "历史").props.onClick();
await settle();
tree = render();
ok("the declined view offers 开启历史 again", labelled(tree, "pp-btn pp-mini", "开启历史") !== undefined);
labelled(tree, "pp-btn pp-mini", "历史").props.onClick();
await settle();
/** Leave the panel in its live view for whatever assertion follows. */
labelled(tree, "pp-btn pp-mini", "历史").props.onClick();
await settle();

/* ---- absent props must not crash the composer row ----------------------- */
let crashed = null;
try { resetHooks(); walk(Component({})); } catch (error) { crashed = error.message; }
ok("tolerates absent input props without throwing", crashed === null, crashed);

console.log(fail.length === 0 ? "\nALL PASS" : "\nFAILURES (" + fail.length + "): " + fail.join(" | "));
if (fail.length > 0) process.exitCode = 1;
