/**
 * bench.mjs — 性能基准（修改前/修改后各跑一次，同一脚本同一口径）。
 *
 * 量四件事，全部是真实代码路径，不是玩具复刻：
 *  B1 宿主半冷导入      —— 插件给应用启动增加的模块加载成本（新进程 ×5 取最小）
 *  B2 catalog 组装      —— 面板每次打开时 GET /models 里模板目录的 CPU 成本
 *  B3 单次优化的渲染成本 —— createTemplateContext + buildMessages，10 个模板全量
 *  B4 流式渲染次数      —— 桩件 React 驱动真实 client.js，300 delta × 4ms 间隔，
 *                         数"点击开始优化 → done"之间的组件渲染次数
 *
 * 口径说明（写进报告）：
 *  - B4 的桩件对每次 setState 同步重渲染；真 React 18 会把同一 task 里的多个
 *    setState 合批，所以桩件数出的渲染次数是上界，但"每 delta 一次 setState 各占
 *    一个 task"这一结构性事实在两边一致，前后对比有效。
 *  - 真实 GUI 里的首屏绘制/网络往返无法从这里测量，报告中如实标注。
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { sep } from "node:path";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const LIB = ROOT + "lib" + sep;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- B1 宿主冷导入 ---------------- */
function coldImport(target) {
	const runs = [];
	for (let i = 0; i < 5; i++) {
		const script = target === null
			? "console.log(0)"
			: `const t0=performance.now();await import(${JSON.stringify(target)});console.log(performance.now()-t0)`;
		const out = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
		if (out.status !== 0) throw new Error("cold import failed: " + (out.stderr || "").slice(0, 400));
		runs.push(Number(out.stdout.trim().split("\n").pop()));
	}
	return Math.min(...runs);
}

/* ---------------- B2/B3 宿主热路径 ---------------- */
async function hostHotPaths() {
	const { TEMPLATES, templateVariables, OPTIMIZATION_MODES } = await import(pathToFileURL(LIB + "prompts.js").href);
	const { buildMessages, createTemplateContext, isSimpleTemplate } = await import(pathToFileURL(LIB + "processor.js").href);

	// B2: models 路由里的模板目录映射（templateVariables 会解析每个模板正文）
	const assemble = () => Object.values(TEMPLATES)
		.filter((t) => t.optimizationMode !== void 0)
		.map((t) => ({ id: t.id, label: t.label, optimizationMode: t.optimizationMode, templateType: t.templateType, simple: isSimpleTemplate(t), variables: templateVariables(t), fields: t.fields }));
	for (let i = 0; i < 200; i++) assemble();
	let t0 = performance.now();
	const N2 = 2000;
	for (let i = 0; i < N2; i++) assemble();
	const catalogUs = ((performance.now() - t0) * 1000) / N2;

	// B3: 一次优化点击的模板渲染（全部 10 个模板，取总和与均值）
	const context = createTemplateContext({
		optimizationMode: "user",
		targetPrompt: "根据我的硕论选题，帮我看看学界已有研究，判断选题是否合理，并给出修改建议。".repeat(4),
		contextMode: void 0,
		lastOptimizedPrompt: void 0,
		iterateInput: void 0,
		variables: void 0,
		messages: void 0,
		tools: void 0
	});
	const templates = Object.values(TEMPLATES);
	for (const t of templates) for (let i = 0; i < 20; i++) buildMessages(t, context);
	t0 = performance.now();
	const N3 = 200;
	for (let i = 0; i < N3; i++) for (const t of templates) buildMessages(t, context);
	const renderUs = ((performance.now() - t0) * 1000) / (N3 * templates.length);
	return { catalogUs, renderUs, modes: OPTIMIZATION_MODES.length, templates: templates.length };
}

/* ---------------- B4 客户端流式渲染 ---------------- */
async function clientStream() {
	const source = readFileSync(LIB + "client.js", "utf8");
	const bytes = Buffer.byteLength(source);

	// 目录直接取真注册表，和宿主 /models 同构
	const { TEMPLATES, OPTIMIZATION_MODES } = await import(pathToFileURL(LIB + "prompts.js").href);
	const { templateVariables, } = await import(pathToFileURL(LIB + "prompts.js").href);
	const catalog = {
		current: { provider: "amazon-bedrock", model: "qwen3.8-flash" },
		groups: [{ provider: "amazon-bedrock", name: "Amazon Bedrock", models: [{ id: "qwen3.8-flash", name: "qwen3.8-flash" }] }],
		modes: OPTIMIZATION_MODES,
		templates: Object.values(TEMPLATES).filter((t) => t.optimizationMode !== void 0).map((t) => ({ id: t.id, label: t.label, optimizationMode: t.optimizationMode, templateType: t.templateType, simple: typeof t.content === "string", variables: t.fields, fields: t.fields })),
		extraction: true
	};

	// —— 桩件 React：每次 setState 同步重渲染（口径见文件头） ——
	let store, hookIndex, renders, Component, effectFns;
	const makeH = () => function h(type, props, ...children) {
		return { type, props: props ?? {}, children: children.flat(Infinity).filter((c) => c !== null && c !== false && c !== void 0) };
	};
	const h = makeH();
	function resetHooks() { hookIndex = 0; }
	const reactStub = {
		createElement: h,
		useState(initial) {
			const i = hookIndex++;
			if (!(i in store)) store[i] = typeof initial === "function" ? initial() : initial;
			const set = (v) => {
				store[i] = typeof v === "function" ? v(store[i]) : v;
				renders++;
				if (Component) { resetHooks(); walk(Component(PROPSTUB)); }
			};
			return [store[i], set];
		},
		useRef(initial) {
			const i = hookIndex++;
			if (!(i in store)) store[i] = { current: initial };
			return store[i];
		},
		useEffect(fn) { try { fn(); } catch {} },
		useCallback(fn) { return fn; },
		useMemo(fn) { return fn(); }
	};
	function walk(node) {
		if (node === null || typeof node !== "object") return node;
		if (Array.isArray(node)) return node.map(walk);
		if (node.children) node.children = walk(node.children);
		return node;
	}

	// —— 桩件 window / fetch ——
	let optimizeStarted = null;
	globalThis.window = {
		addEventListener() {}, removeEventListener() {},
		innerWidth: 1440, innerHeight: 900,
		__ModuleLoader__: { load(def) { Component = def.factory((name) => name === "react" ? reactStub : (() => ({}))).PromptPolish; } }
	};
	const DRAFT = "根据我的硕论选题，帮我根据学界的已有研究，看看是否合理，并给出修改建议。";
	const PROPSTUB = {
		useInput: (sel) => sel({ draft: DRAFT, attachmentIds: [], draftRev: 1, phase: "plain" }),
		inputActions: { setDraft() {}, submit() {} }
	};
	const DELTAS = 300;
	globalThis.fetch = async (url, options) => {
		if (String(url).endsWith("/models")) return { ok: true, json: async () => catalog };
		optimizeStarted = performance.now();
		let sent = 0;
		const encoder = new TextEncoder();
		const reader = {
			async read() {
				if (sent < DELTAS) {
					await sleep(4);
					sent++;
					const line = JSON.stringify({ type: "delta", text: "优化" + sent + "；" }) + "\n";
					return { done: false, value: encoder.encode(line) };
				}
				if (sent === DELTAS) {
					sent++;
					const line = JSON.stringify({ type: "done", text: "最终优化稿".repeat(20), model: "amazon-bedrock/qwen3.8-flash" }) + "\n";
					return { done: false, value: encoder.encode(line) };
				}
				return { done: true, value: void 0 };
			},
			cancel() {}
		};
		return { ok: true, status: 200, body: { getReader: () => reader }, json: async () => ({}) };
	};

	// —— 加载真实 client.js ——
	const loadEval = (function loadFactory() {
		const fn = new Function("window", source);
		const t = performance.now();
		fn(globalThis.window);
		return performance.now() - t;
	})();

	// —— 挂载并点击运行 ——
	store = {}; renders = 0;
	resetHooks();
	let tree = walk(Component(PROPSTUB)); // 首次渲染（seat）
	await sleep(10);
	resetHooks();
	tree = walk(Component(PROPSTUB)); // catalog 到位后再渲染 → 面板可开
	// 找到 seat 按钮（className pp-seat）并点击
	function findByClass(node, cls, out = []) {
		if (node === null || typeof node !== "object") return out;
		if (Array.isArray(node)) { for (const c of node) findByClass(c, cls, out); return out; }
		if (node.props && String(node.props.className ?? "").split(" ").includes(cls)) out.push(node);
		if (node.children) findByClass(node.children, cls, out);
		return out;
	}
	const seat = findByClass(tree, "pp-seat")[0];
	if (!seat) throw new Error("seat not found");
	renders = 0;
	const clickAt = performance.now();
	seat.props.onClick();
	// 等 done：不硬编码钩子索引，扫 store 里出现 done/error 状态值为止
	let status = "";
	for (let i = 0; i < 4000; i++) {
		await sleep(5);
		const values = Object.values(store);
		if (values.includes("error")) { status = "error"; break; }
		if (values.includes("done")) { status = "done"; break; }
	}
	const wallMs = performance.now() - clickAt;
	const streamRenders = renders;
	return { bytes, loadEvalMs: loadEval, streamRenders, deltas: DELTAS, wallMs, status };
}

/* ---------------- main ---------------- */
const b1empty = coldImport(null);
const b1 = coldImport(pathToFileURL(LIB + "index.js").href);
const b23 = await hostHotPaths();
const b4 = await clientStream();
console.log(JSON.stringify({
	B1_cold_import: { node_startup_ms: +b1empty.toFixed(1), with_plugin_ms: +(b1empty + b1).toFixed(1), plugin_module_ms: +b1.toFixed(2) },
	B2_catalog_assemble: { us_per_call: +b23.catalogUs.toFixed(1), templates: b23.templates },
	B3_build_messages: { us_per_template: +b23.renderUs.toFixed(1) },
	B4_client_stream: b4
}, null, 2));
