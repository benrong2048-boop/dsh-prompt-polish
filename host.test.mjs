/**
 * End-to-end test of the host half with the composition faked.
 *
 * Registers the real plugin `apply` against stand-in `webServer`, `connection`,
 * `llm` and `agentDefaultModel` services, then drives the captured route
 * handlers with real request bodies and a writable-response double. This
 * exercises the whole server path — trust fence, body validation, model-route
 * resolution, template rendering, NDJSON streaming and failure reporting — with
 * no running DSH.
 *
 * The wire contract is upstream's `OptimizationRequest` shape
 * (`optimizationMode` + `targetPrompt` + optional `templateId` /
 * `advancedContext` / `contextMode`), NOT a flat `{ mode, variables }` pair, so
 * these fixtures read like the original's own call sites.
 */
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

const PROFILE = "C:/Users/23528/.dsh/profiles/desktop/node_modules/@benrong/dsh-prompt-polish";
const mod = await import(pathToFileURL(`${PROFILE}/lib/index.js`).href);
const { apply, inject, name, OPTIMIZE_ROUTE, MODELS_ROUTE, EXTRACT_ROUTE } = mod;
const { getTemplate, registerTemplate, TEMPLATES } = await import(pathToFileURL(`${PROFILE}/lib/prompts.js`).href);

const fail = [];
const known = [];
const ok = (label, cond, extra) => {
	console.log((cond ? "PASS " : "FAIL ") + label + (cond || extra === void 0 ? "" : " -> " + JSON.stringify(extra)));
	if (!cond) fail.push(label);
};
/** A known lib-side defect: printed as BUG, never red, flips to RESOLVED when fixed. */
const bug = (label, isCorrect, detail) => {
	console.log((isCorrect ? "RESOLVED (was a known lib bug) " : "BUG  ") + label + (isCorrect || detail === void 0 ? "" : " -> " + JSON.stringify(detail)));
	if (!isCorrect) known.push(label);
};

ok("plugin name", name === "prompt-polish", name);
ok("declares its four services", inject.join(",") === "webServer,connection,llm,agentDefaultModel", inject.join(","));
ok("exports all three route paths", [OPTIMIZE_ROUTE, MODELS_ROUTE, EXTRACT_ROUTE].join(",") === "/prompt-polish/optimize,/prompt-polish/models,/prompt-polish/extract-variables", `${OPTIMIZE_ROUTE}|${MODELS_ROUTE}|${EXTRACT_ROUTE}`);

/* -------------------------------------------------------------------------- *
 * Composition fakes
 * -------------------------------------------------------------------------- */
const routes = {};
const effects = [];
const seenSystem = [];
const seenMessages = [];
const seenOptions = [];
let streamBehaviour = "happy";
let replyChunks = null;

function setBehaviour(next) { streamBehaviour = next; replyChunks = null; }
/** Feed the model's exact output instead of the canned rewrite. */
function setReply(text) { streamBehaviour = "reply"; replyChunks = [text]; }

const ctx = {
	effect: (fn, label) => { effects.push(label); return fn(); },
	webServer: { register: (row) => { routes[row.path] = row; return () => { delete routes[row.path]; }; } },
	connection: { requestRejection: () => void 0 },
	agentDefaultModel: { currentSelection: () => ({ provider: "amazon-bedrock", model: "qwen3.8-flash" }) },
	llm: {
		listProviders: () => [{ id: "amazon-bedrock", name: "Amazon Bedrock" }, { id: "broken", name: "Broken" }],
		listModels: async (provider) => {
			if (provider === "broken") throw new Error("provider cannot enumerate");
			return [{ provider, id: "qwen3.8-flash", name: "qwen3.8-flash" }, { provider, id: "wan2.7-image", name: "wan2.7-image" }];
		},
		stream: async function* (options) {
			seenSystem.push(options.system);
			seenMessages.push(options.messages);
			seenOptions.push(options);
			if (streamBehaviour === "rejects-image-model" && options.model === "wan2.7-image") {
				yield { type: "finish", reason: { kind: "error", failure: { code: "PI_AI_ERROR", message: "InvalidParameter: Unsupported model: 'wan2.7-image'" } } };
				return;
			}
			if (streamBehaviour === "throws") throw new Error("RATE_LIMIT: too many requests");
			if (streamBehaviour === "aborted") { yield { type: "finish", reason: { kind: "aborted", failure: { message: "aborted by caller" } } }; return; }
			/** `reason` is a FinishReason: a discriminated object, never a bare string. */
			if (streamBehaviour === "empty") { yield { type: "finish", reason: { kind: "error", failure: { code: "NO_API_KEY", message: "缺少 AMAZON_BEDROCK_API_KEY" } } }; return; }
			if (streamBehaviour === "thinking-only") {
				yield { type: "reasoning-delta", index: 0, text: "思考中……" };
				yield { type: "finish", reason: { kind: "max-tokens" } };
				return;
			}
			if (streamBehaviour === "thinking-with-text") {
				yield { type: "reasoning-delta", index: 0, text: "想了一下" };
				for (const piece of ["# Role：X\n"]) yield { type: "text-delta", index: 0, text: piece };
				yield { type: "finish", reason: { kind: "max-tokens" } };
				return;
			}
			if (streamBehaviour === "fenced") {
				for (const piece of ["```markdown\n", "# Role：周报助手\n", "## Goals：\n- 总结本周\n```"]) yield { type: "text-delta", index: 0, text: piece };
				yield { type: "finish", reason: { kind: "stop" } };
				return;
			}
			if (streamBehaviour === "reply") {
				for (const piece of replyChunks) yield { type: "text-delta", index: 0, text: piece };
				yield { type: "finish", reason: { kind: "stop" } };
				return;
			}
			for (const piece of ["# Role：", "周报助手\n", "## Goals：\n- 汇总本周进展"]) yield { type: "text-delta", index: 0, text: piece };
			/** The host's StreamChunk union carries usage as its own chunk type. */
			yield { type: "usage", index: 0, usage: { totalTokens: 30, inputTokens: 18, outputTokens: 12, thoughtTokens: null } };
			yield { type: "finish", reason: { kind: "stop" } };
		}
	}
};
apply(ctx);

const optimize = routes[OPTIMIZE_ROUTE];
const modelsRoute = routes[MODELS_ROUTE];
const extract = routes[EXTRACT_ROUTE];
ok("apply registers all three routes", effects.length === 3 && optimize && modelsRoute && extract, effects);
ok("optimize route is exact POST", optimize?.kind === "exact" && optimize?.path === OPTIMIZE_ROUTE, optimize?.path);
ok("models route is exact GET", modelsRoute?.kind === "exact" && modelsRoute?.path === MODELS_ROUTE, modelsRoute?.path);
ok("extract route is exact POST", extract?.kind === "exact" && extract?.path === EXTRACT_ROUTE, extract?.path);

/* -------------------------------------------------------------------------- *
 * Transport doubles
 * -------------------------------------------------------------------------- */
function makeRes() {
	const written = [];
	return {
		statusCode: 0, headers: {}, writableEnded: false,
		setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
		write(chunk) { written.push(String(chunk)); return true; },
		end(chunk) { if (chunk !== void 0) written.push(Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk)); this.writableEnded = true; },
		on() {},
		body: () => written.join("")
	};
}
function makeReq(payload, method = "POST", headers = { "content-type": "application/json" }) {
	const body = typeof payload === "string" ? payload : JSON.stringify(payload);
	const stream = Readable.from([Buffer.from(body, "utf8")]);
	stream.method = method;
	stream.headers = headers;
	return stream;
}
/** Parse an NDJSON reply into events. */
const events = (body) => body.split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line));
/** Text of the nth message the plugin handed the model, flattened like the adapter does. */
const sentText = (messageIndex) => seenMessages.at(-1)[messageIndex].content.map((block) => block.text).join("");
const lastCall = () => seenMessages.length - 1;

async function run(body) {
	const res = makeRes();
	await optimize.handler(makeReq(body), res);
	return res;
}

/* The draft every framing assertion runs through: quotes, braces, a fence, HTML
 * and the user's own placeholders. */
const HOSTILE = "写一个{{lang}}周报，要求：\"简洁\"、保留 {{date}}、用 ``` 代码块演示\n第二行 <b>x</b>";

/* -------------------------------------------------------------------------- *
 * 1. The user family over HTTP (message-array template → rendered)
 * -------------------------------------------------------------------------- */
let res = await run({ optimizationMode: "user", targetPrompt: HOSTILE });
ok("200", res.statusCode === 200, res.statusCode);
ok("NDJSON content type", String(res.headers["content-type"]).includes("ndjson"), res.headers["content-type"]);
let evs = events(res.body());
ok("streamed several deltas", evs.filter((e) => e.type === "delta").length >= 3, evs.length);
ok("terminated with done", evs.at(-1)?.type === "done", evs.at(-1));
ok("done carries the assembled prompt", evs.at(-1)?.text === "# Role：周报助手\n## Goals：\n- 汇总本周进展", evs.at(-1)?.text);
ok("done names the model used", evs.at(-1)?.model === "amazon-bedrock/qwen3.8-flash", evs.at(-1)?.model);
ok("done reports not truncated", evs.at(-1)?.truncated === false, evs.at(-1)?.truncated);
ok("done relays the stream's token usage", JSON.stringify(evs.at(-1)?.usage) === JSON.stringify({ inputTokens: 18, outputTokens: 12, totalTokens: 30 }), JSON.stringify(evs.at(-1)?.usage));
ok("omitting templateId resolves the documented family default (专业优化)", sentText(0).startsWith("# Role: 用户提示词精准描述专家"), sentText(0).slice(0, 40));
ok("the user family sends exactly two messages", seenMessages.at(-1).length === 2, seenMessages.at(-1).length);

/* Semantics 5 — the single most load-bearing assertion in this file. */
ok("options.system is NEVER passed", seenSystem.at(-1) === undefined, String(seenSystem.at(-1)));
ok("the persona rides as a LEADING system message", seenMessages.at(-1)[0].role === "system");
ok("no maxTokens override leaks the composer's model", seenOptions.at(-1).maxTokens > 0, seenOptions.at(-1).maxTokens);
ok("messages are deep-frozen", Object.isFrozen(seenMessages.at(-1)[0]) && Object.isFrozen(seenMessages.at(-1)[0].content));
ok("message source is tagged to this plugin", seenMessages.at(-1)[0].source.plugin === "prompt-polish" && seenMessages.at(-1)[0].source.kind === "plugin");
ok("content is a BLOCK ARRAY, not a string", Array.isArray(seenMessages.at(-1)[0].content) && seenMessages.at(-1)[0].content[0].type === "text");
ok("anti-execution rule is in the user turn, not the system turn", sentText(1).includes("而不是回答或执行提示词的内容") && !sentText(0).includes("而不是回答或执行提示词的内容"));
ok("the hostile draft reaches the model as parseable JSON", JSON.parse(sentText(1).match(/"originalPrompt":\s*("(?:[^"\\]|\\.)*")/)[1]) === HOSTILE, sentText(1).slice(-90));
ok("triple-brace value is not html-escaped on the wire", sentText(1).includes("<b>x</b>") && !sentText(1).includes("&lt;"));
ok("no unsubstituted mustache reaches the model", !/\{\{[a-zA-Z#/]/.test(sentText(1).replace(HOSTILE, "X").replace(JSON.stringify(HOSTILE), "X")), sentText(1).match(/\{\{[^{}]*\}\}/g)?.join(" "));

/* -------------------------------------------------------------------------- *
 * 2. The system family over HTTP (bare-string template → NOT rendered)
 * -------------------------------------------------------------------------- */
res = await run({ optimizationMode: "system", targetPrompt: "写个翻译器" });
ok("system mode accepted", res.statusCode === 200, res.statusCode);
ok("general-optimize resolves as the default for mode=system", sentText(0) === getTemplate("general-optimize").content);
ok("its system turn is UNRENDERED: literal {{...}} slots survive to the wire", (() => {
	const before = (getTemplate("general-optimize").content.match(/\{\{[^{}]*\}\}/g) ?? []);
	const after = (sentText(0).match(/\{\{[^{}]*\}\}/g) ?? []);
	return before.length > 0 && before.length === after.length && before.join("|") === after.join("|");
})(), JSON.stringify({ before: (getTemplate("general-optimize").content.match(/\{\{[^{}]*\}\}/g) ?? []).length, after: (sentText(0).match(/\{\{[^{}]*\}\}/g) ?? []).length }));
ok("its bracketed LangGPT slots are intact too", sentText(0).includes("[角色名称]"), sentText(0).slice(0, 40));
ok("the user turn is the raw target prompt, byte for byte", sentText(1) === "写个翻译器", JSON.stringify(sentText(1)));
ok("nothing is appended to or wrapped around it", !sentText(1).startsWith("\"") && seenMessages.at(-1).length === 2);
res = await run({ optimizationMode: "system", targetPrompt: HOSTILE, templateId: "general-optimize" });
ok("an explicit templateId matches the default resolution", sentText(0) === getTemplate("general-optimize").content && sentText(1) === HOSTILE);
ok("both families keep options.system unset", seenSystem.at(-1) === undefined);

/* -------------------------------------------------------------------------- *
 * 3. Iterate mode carries its own two fields
 * -------------------------------------------------------------------------- */
res = await run({ optimizationMode: "iterate", targetPrompt: "V0", lastOptimizedPrompt: "V1", iterateInput: "更简洁" });
ok("iterate accepted", res.statusCode === 200, res.statusCode);
ok("iterate sends system,user", seenMessages.at(-1).map((m) => m.role).join(",") === "system,user");
const evidence = sentText(1).match(/\{[\s\S]*\}/);
let parsed = null;
try { parsed = JSON.parse(evidence[0]); } catch (error) { ok("iterate evidence parses as JSON", false, error.message); }
ok("iterate evidence block parses as JSON", parsed !== null, evidence?.[0]?.slice(0, 120));
ok("iterate carries lastOptimizedPrompt", parsed?.lastOptimizedPrompt === "V1", JSON.stringify(parsed));
ok("iterate carries iterateInput", parsed?.iterateInput === "更简洁");
ok("iterate does not leak originalPrompt into the evidence object", parsed?.originalPrompt === void 0);
ok("iterate persona is a leading system message", seenMessages.at(-1)[0].role === "system" && sentText(0).includes("迭代"));

/* -------------------------------------------------------------------------- *
 * 4. advancedContext reaches the model
 * -------------------------------------------------------------------------- */
registerTemplate({
	id: "host-probe",
	label: "探针",
	templateType: "userOptimize",
	optimizationMode: "user",
	version: "1.0.0",
	fields: ["topic", "conversationContext", "toolsContext"],
	content: [{ role: "system", content: "S" }, { role: "user", content: "主题={{topic}}\n对话:\n{{{conversationContext}}}\n工具:\n{{{toolsContext}}}" }]
});
res = await run({
	optimizationMode: "user",
	targetPrompt: "T",
	templateId: "host-probe",
	contextMode: "system",
	advancedContext: {
		variables: { topic: "<天气>" },
		messages: [{ role: "user", content: "上一轮" }, { role: "assistant", content: "上一答" }],
		tools: [{ function: { name: "get_weather", description: "查天气", parameters: { type: "object", properties: { city: { type: "string" } } } } }]
	}
});
ok("advancedContext request accepted", res.statusCode === 200, events(res.body()).at(-1));
ok("triple-brace blocks are not escaped on the wire", sentText(1).includes("USER: 上一轮") && sentText(1).includes('"city"'), sentText(1));
ok("toolsContext renders the tool name, description and pretty parameters", sentText(1).includes("Tool name: get_weather\nDescription: 查天气\nParameters: {"), sentText(1));
ok("conversationContext is formatted as ROLE: text joined by a blank line", sentText(1).includes("USER: 上一轮\n\nASSISTANT: 上一答"), sentText(1));
/* Directive: the two brace forms differ ON PURPOSE, like upstream. Same template,
 * `topic` referenced with double braces, so it escapes while the blocks above do not. */
ok("double-brace variable IS escaped in the same message", sentText(1).includes("主题=&lt;天气&gt;") && !sentText(1).includes("主题=<天气>"), sentText(1).slice(0, 40));
ok("the built-in originalPrompt survives the variables bag", sentText(1).includes("对话:") && !sentText(1).includes("undefined"));
delete TEMPLATES["host-probe"];
ok("probe template cleaned up", getTemplate("host-probe") === void 0 && Object.keys(TEMPLATES).length === 10, String(Object.keys(TEMPLATES).length));

/* -------------------------------------------------------------------------- *
 * 5. Request validation
 * -------------------------------------------------------------------------- */
async function expect(label, body, status, code, includes) {
	const local = await run(body);
	const payload = code === void 0 ? {} : JSON.parse(local.body());
	const detail = `status=${local.statusCode} code=${payload.code} message=${payload.message}`;
	ok(label, local.statusCode === status && (code === void 0 || payload.code === code) && (includes === void 0 || String(payload.message).includes(includes)), detail);
}
await expect("missing optimizationMode -> 400 bad-request", { targetPrompt: "x" }, 400, "bad-request");
await expect("unknown optimizationMode -> 400", { optimizationMode: "style", targetPrompt: "x" }, 400, "bad-request");
await expect("the 400 body documents the accepted shape", { optimizationMode: "x" }, 400, "bad-request", "optimizationMode");
await expect("blank targetPrompt -> 400", { optimizationMode: "user", targetPrompt: "   " }, 400, "bad-request");
await expect("missing targetPrompt -> 400", { optimizationMode: "user" }, 400, "bad-request");
await expect("non-string targetPrompt -> 400", { optimizationMode: "user", targetPrompt: 7 }, 400, "bad-request");
await expect("an array body -> 400", [], 400, "bad-request");
await expect("malformed json -> 400", "{oops", 400, "bad-request");
await expect("oversized targetPrompt -> 400", { optimizationMode: "user", targetPrompt: "字".repeat(60_001) }, 400, "bad-request");
await expect("bogus contextMode -> 400", { optimizationMode: "user", targetPrompt: "x", contextMode: "both" }, 400, "bad-request");
await expect("contextMode=system accepted", { optimizationMode: "user", targetPrompt: "x", contextMode: "system" }, 200);
await expect("iterate without lastOptimizedPrompt -> 400", { optimizationMode: "iterate", targetPrompt: "x", iterateInput: "i" }, 400, "bad-request");
await expect("iterate without iterateInput -> 400", { optimizationMode: "iterate", targetPrompt: "x", lastOptimizedPrompt: "p" }, 400, "bad-request");
await expect("iterate with a blank iterateInput -> 400", { optimizationMode: "iterate", targetPrompt: "x", lastOptimizedPrompt: "p", iterateInput: "  " }, 400, "bad-request");
await expect("unknown templateId -> 400", { optimizationMode: "user", targetPrompt: "x", templateId: "nope" }, 400, "bad-request");
await expect("non-string templateId -> 400", { optimizationMode: "user", targetPrompt: "x", templateId: 5 }, 400, "bad-request");
await expect("templateId from the wrong family -> 400 unsupported", { optimizationMode: "user", targetPrompt: "x", templateId: "general-optimize" }, 400, "unsupported", "模板与优化对象不一致");
await expect("the iterate template refused under mode=user too", { optimizationMode: "user", targetPrompt: "x", templateId: "iterate" }, 400, "unsupported");
await expect("the extraction template is not selectable as an optimization mode", { optimizationMode: "user", targetPrompt: "x", templateId: "variable-extraction" }, 400, "unsupported");
await expect("malformed advancedContext -> 400", { optimizationMode: "user", targetPrompt: "x", advancedContext: "nope" }, 400, "bad-request");
await expect("advancedContext.variables must be an object", { optimizationMode: "user", targetPrompt: "x", advancedContext: { variables: ["a"] } }, 400, "bad-request");
await expect("a non-string custom variable -> 400", { optimizationMode: "user", targetPrompt: "x", advancedContext: { variables: { a: 3 } } }, 400, "bad-request");
await expect("advancedContext.messages must be an array", { optimizationMode: "user", targetPrompt: "x", advancedContext: { messages: {} } }, 400, "bad-request");
await expect("a message without content -> 400", { optimizationMode: "user", targetPrompt: "x", advancedContext: { messages: [{ role: "user" }] } }, 400, "bad-request");
await expect("too many context messages -> 400", { optimizationMode: "user", targetPrompt: "x", advancedContext: { messages: Array.from({ length: 51 }, (_, i) => ({ role: "user", content: `m${i}` })) } }, 400, "bad-request");
await expect("context messages over the char budget -> 400", { optimizationMode: "user", targetPrompt: "x", advancedContext: { messages: [{ role: "user", content: "y".repeat(200_001) }] } }, 400, "bad-request");
await expect("advancedContext.tools must be an array", { optimizationMode: "user", targetPrompt: "x", advancedContext: { tools: {} } }, 400, "bad-request");
await expect("a tool with an EMPTY name -> 400", { optimizationMode: "user", targetPrompt: "x", advancedContext: { tools: [{ function: { name: "" } }] } }, 400, "bad-request");
await expect("a tool with a whitespace name -> 400", { optimizationMode: "user", targetPrompt: "x", advancedContext: { tools: [{ function: { name: "  " } }] } }, 400, "bad-request");
await expect("a tool with no function object -> 400", { optimizationMode: "user", targetPrompt: "x", advancedContext: { tools: [{ name: "get_weather" }] } }, 400, "bad-request");
await expect("an empty tools array is fine", { optimizationMode: "user", targetPrompt: "x", advancedContext: { tools: [] } }, 200);
await expect("images are refused, not silently dropped", { optimizationMode: "user", targetPrompt: "x", inputImages: [{ mimeType: "image/png", data: "AAEC" }] }, 400, "unsupported", "暂不支持图片输入");
await expect("the image refusal tells the user what to do instead", { optimizationMode: "user", targetPrompt: "x", inputImages: [{}] }, 400, "unsupported", "文字描述");
await expect("an EMPTY inputImages array is not a refusal", { optimizationMode: "user", targetPrompt: "x", inputImages: [] }, 200);

/* ---- transport-level rejections ---- */
res = makeRes();
await optimize.handler(makeReq({}, "GET"), res);
ok("GET on the optimize route -> 405 Allow: POST", res.statusCode === 405 && res.headers.allow === "POST", res.statusCode);
res = makeRes();
await optimize.handler(makeReq({ optimizationMode: "user", targetPrompt: "x" }, "POST", { "content-type": "text/plain" }), res);
ok("wrong media type -> 415", res.statusCode === 415 && JSON.parse(res.body()).code === "unsupported-media-type", res.statusCode);
res = makeRes();
await optimize.handler(makeReq({ optimizationMode: "user", targetPrompt: "x" }, "POST", {}), res);
ok("a missing content-type is refused, not guessed", res.statusCode === 415 && JSON.parse(res.body()).code === "unsupported-media-type", res.statusCode);
res = makeRes();
await optimize.handler(makeReq({ optimizationMode: "user", targetPrompt: "x" }, "POST", { "content-type": "application/json; charset=utf-8" }), res);
ok("a content-type with a charset parameter is accepted", res.statusCode === 200, res.statusCode);
res = makeRes();
await optimize.handler(makeReq({ optimizationMode: "user", targetPrompt: "x", filler: "z".repeat(1024 * 1024 + 64) }), res);
ok("an oversized BODY -> 413 payload-too-large", res.statusCode === 413 && JSON.parse(res.body()).code === "payload-too-large", res.statusCode);

/* ---- the trust fence runs before any model call ---- */
ctx.connection.requestRejection = () => 401;
const callsBefore = seenSystem.length;
res = await run({ optimizationMode: "user", targetPrompt: "x" });
ok("untrusted request is rejected with no model call", res.statusCode === 401 && seenSystem.length === callsBefore, { status: res.statusCode, calls: seenSystem.length - callsBefore });
res = makeRes();
await extract.handler(makeReq({ promptContent: "x" }), res);
ok("the extract route is behind the same fence", res.statusCode === 401 && seenSystem.length === callsBefore, res.statusCode);
ctx.connection.requestRejection = () => void 0;

/* -------------------------------------------------------------------------- *
 * 6. Streaming failure paths
 * -------------------------------------------------------------------------- */
setBehaviour("throws");
evs = events((await run({ optimizationMode: "user", targetPrompt: "x" })).body());
ok("a throwing generator becomes an error event", evs.at(-1).type === "error", evs.at(-1));
ok("the provider's own words survive", String(evs.at(-1).message).includes("RATE_LIMIT"), evs.at(-1));

setBehaviour("empty");
evs = events((await run({ optimizationMode: "user", targetPrompt: "x" })).body());
ok("an error finish surfaces the failure verbatim", evs.at(-1).type === "error" && String(evs.at(-1).message).includes("缺少 AMAZON_BEDROCK_API_KEY"), evs.at(-1));
ok("every failure names the model tried", String(evs.at(-1).message).includes("amazon-bedrock/qwen3.8-flash"), evs.at(-1).message);

setBehaviour("thinking-only");
evs = events((await run({ optimizationMode: "user", targetPrompt: "x" })).body());
ok("max-tokens with no body is named, not reported as empty", evs.at(-1).type === "error" && String(evs.at(-1).message).includes("全花在推理上"), evs.at(-1));

setBehaviour("aborted");
evs = events((await run({ optimizationMode: "user", targetPrompt: "x" })).body());
ok("an abort reads as a cancel, not a failure", evs.at(-1).type === "error" && evs.at(-1).message === "润色已取消。", evs.at(-1));

setBehaviour("thinking-with-text");
evs = events((await run({ optimizationMode: "user", targetPrompt: "x" })).body());
ok("a truncated but useful answer still completes", evs.at(-1).type === "done" && evs.at(-1).text === "# Role：X", evs.at(-1));
ok("and says so", evs.at(-1).truncated === true, evs.at(-1));

setBehaviour("fenced");
evs = events((await run({ optimizationMode: "system", targetPrompt: "写个翻译器" })).body());
ok("a wrapping fence is stripped from the final text", evs.at(-1).text === "# Role：周报助手\n## Goals：\n- 总结本周", JSON.stringify(evs.at(-1).text));
ok("but the streamed deltas are untouched", evs[0].text === "```markdown\n", JSON.stringify(evs[0]));

setBehaviour("rejects-image-model");
evs = events((await run({ optimizationMode: "user", targetPrompt: "x", provider: "amazon-bedrock", model: "wan2.7-image" })).body());
ok("a pinned route overrides the composer selection", String(evs.at(-1).message).includes("amazon-bedrock/wan2.7-image"), evs.at(-1).message);
ok("an unsupported-model failure is readable", String(evs.at(-1).message).includes("Unsupported model"), evs.at(-1).message);

setBehaviour("happy");
res = await run({ optimizationMode: "user", targetPrompt: "x", provider: "amazon-bedrock", model: "qwen3.8-flash" });
ok("a full pin is honoured", events(res.body()).at(-1).model === "amazon-bedrock/qwen3.8-flash");
res = await run({ optimizationMode: "user", targetPrompt: "x", provider: "amazon-bedrock" });
ok("provider without model falls back to the selection", events(res.body()).at(-1).model === "amazon-bedrock/qwen3.8-flash", events(res.body()).at(-1));
res = await run({ optimizationMode: "user", targetPrompt: "x", model: "qwen3.8-flash" });
ok("model without provider falls back too", events(res.body()).at(-1).model === "amazon-bedrock/qwen3.8-flash");
res = await run({ optimizationMode: "user", targetPrompt: "x", provider: 5, model: 5 });
ok("a non-string pin is rejected", res.statusCode === 400, res.statusCode);

/* -------------------------------------------------------------------------- *
 * 7. Models route — the catalog the panel renders
 * -------------------------------------------------------------------------- */
res = makeRes();
await modelsRoute.handler(makeReq("", "GET"), res);
ok("models route answers 200", res.statusCode === 200, res.statusCode);
const listed = JSON.parse(res.body());
ok("it reports the current selection", listed.current?.model === "qwen3.8-flash", listed.current);
ok("one failing provider does not empty the picker", listed.groups.length === 1 && listed.groups[0].provider === "amazon-bedrock", listed.groups);
ok("it lists both models", listed.groups[0].models.map((m) => m.id).join(",") === "qwen3.8-flash,wan2.7-image");
ok("it exposes the optimizationMode axis", listed.modes.map((m) => m.id).join(",") === "system,user,iterate", JSON.stringify(listed.modes));
ok("it advertises the extraction call", listed.extraction === true, listed.extraction);
ok("templates carry only the axis members", listed.templates.map((t) => t.id).join(",") === "general-optimize,user-prompt-basic,user-prompt-professional,iterate,analytical-optimize,soul-hermes-compose,soul-openclaw-compose,user-prompt-planning,soul-iterate", listed.templates.map((t) => t.id).join(","));
ok("the extraction template is not offered as a mode", !listed.templates.some((t) => t.id === "variable-extraction"));
ok("the catalog names each mode's documented default template", JSON.stringify(listed.defaults) === JSON.stringify({ system: "general-optimize", user: "user-prompt-professional", iterate: "iterate" }), JSON.stringify(listed.defaults));
ok("each template declares its family", listed.templates.every((t) => typeof t.optimizationMode === "string" && typeof t.templateType === "string"));
ok("`simple` marks exactly the bare-string templates", listed.templates.map((t) => `${t.id}:${t.simple}`).join(",") === "general-optimize:true,user-prompt-basic:false,user-prompt-professional:false,iterate:false,analytical-optimize:false,soul-hermes-compose:true,soul-openclaw-compose:true,user-prompt-planning:false,soul-iterate:false", listed.templates.map((t) => `${t.id}:${t.simple}`).join(","));
ok("variables are derived by parsing, not hand-written", listed.templates.find((t) => t.id === "user-prompt-basic").variables.join(",") === "originalPrompt", JSON.stringify(listed.templates.find((t) => t.id === "user-prompt-basic").variables));
ok("the bare-string template declares no variables to fill", listed.templates.find((t) => t.id === "general-optimize").variables.join(",") === "");
ok("iterate's catalog entry offers both of its inputs", ["iterateInput", "lastOptimizedPrompt"].every((n) => listed.templates.find((t) => t.id === "iterate").variables.includes(n)), JSON.stringify(listed.templates.find((t) => t.id === "iterate").variables));
ok("no catalog entry leaks a prose placeholder or an empty name", listed.templates.every((t) => t.variables.every((v) => v !== "" && v !== "location_theme" && v !== "...")), listed.templates.map((t) => `${t.id}=[${t.variables.join(",")}]`).join(" "));
ok("the catalog never leaks template bodies", listed.templates.every((t) => t.content === void 0 && t.version === void 0 ? true : t.content === void 0));
res = makeRes();
await modelsRoute.handler(makeReq({}, "POST"), res);
ok("models route rejects POST with 405 Allow: GET", res.statusCode === 405 && res.headers.allow === "GET", res.statusCode);

/* -------------------------------------------------------------------------- *
 * 8. The variable-extraction call
 * -------------------------------------------------------------------------- */
/* Any prompt the canned EXTRACTION_OK can be applied to: it points at 杭州. */
const HANGZHOU = "帮我写一份介绍杭州的文案";
const EXTRACTION_OK = "```json\n" + JSON.stringify({
	variables: [{ name: "城市", value: "杭州", position: { originalText: "杭州", occurrence: 1 }, reason: "可替换", category: "地点" }],
	summary: "共识别出1个变量"
}) + "\n```";
async function runExtract(body, method = "POST") {
	const local = makeRes();
	await extract.handler(makeReq(body, method), local);
	return local;
}
setReply(EXTRACTION_OK);
res = await runExtract({ promptContent: HANGZHOU });
ok("extract route answers 200", res.statusCode === 200, res.body().slice(0, 200));
let payload = JSON.parse(res.body());
ok("it returns the variables", payload.variables?.[0]?.name === "城市", JSON.stringify(payload.variables));
ok("it returns the summary", payload.summary === "共识别出1个变量", payload.summary);
ok("it returns the templated text", payload.templated === "帮我写一份介绍{{城市}}的文案", JSON.stringify(payload.templated));
ok("it names the model that answered", payload.model === "amazon-bedrock/qwen3.8-flash", payload.model);
ok("extraction keeps options.system unset", seenSystem.at(-1) === undefined);
ok("extraction sends the persona as a leading system message", seenMessages.at(-1)[0].role === "system" && seenMessages.at(-1)[0].content[0].text.startsWith("你是一个专业的提示词变量提取专家"));
ok("the Set Delimiter example survives to the wire", seenMessages.at(-1)[0].content[0].text.includes("{{变量}}"), seenMessages.at(-1)[0].content[0].text.match(/.{0,10}已有.{0,14}/)?.[0]);
ok("the prompt under analysis is in the user turn", seenMessages.at(-1)[1].content[0].text.includes(HANGZHOU));
ok("with no existing names the dedupe branch is absent", !seenMessages.at(-1)[0].content[0].text.includes("避免与现有变量重名"));
res = await runExtract({ promptContent: HANGZHOU, existingVariableNames: ["城市", "风格"] });
ok("existing names switch the dedupe branch on", seenMessages.at(-1)[0].content[0].text.includes("避免与现有变量重名: 城市, 风格"), seenMessages.at(-1)[0].content[0].text.match(/避免与现有变量重名.*/)?.[0]);
res = await runExtract({ promptContent: HANGZHOU, existingVariableNames: ["a", 3, "", "b"] });
ok("non-string and empty names are filtered, not stringified", seenMessages.at(-1)[0].content[0].text.includes("避免与现有变量重名: a, b"), seenMessages.at(-1)[0].content[0].text.match(/避免与现有变量重名.*/)?.[0]);
res = await runExtract({ promptContent: HANGZHOU, existingVariableNames: "城市" });
ok("a non-array existingVariableNames is ignored, not a 400", res.statusCode === 200 && !seenMessages.at(-1)[0].content[0].text.includes("避免与现有变量重名"), res.statusCode);
res = await runExtract({ promptContent: HANGZHOU, provider: "amazon-bedrock", model: "qwen3.8-flash" });
ok("extraction honours a pinned route", res.statusCode === 200 && JSON.parse(res.body()).model === "amazon-bedrock/qwen3.8-flash", res.body().slice(0, 120));

/* ---- extraction failure paths ---- */
setReply("我觉得这段没有可提取的变量。");
res = await runExtract({ promptContent: "x" });
payload = (() => { try { return JSON.parse(res.body()); } catch { return {}; } })();
ok("an unparseable model answer -> 502 bad-model-output", res.statusCode === 502 && payload.code === "bad-model-output", { status: res.statusCode, body: res.body().slice(0, 160) });
ok("the failure says parsing failed", String(payload.message).includes("无法解析"), payload.message);
ok("and dumps the chunk histogram for diagnosis", String(payload.message).includes("text-delta"), payload.message);

setReply("```json\n{\"variables\": [{\"name\":\"n\",\"value\":\"v\",\"position\":{\"originalText\":\"不存在的原文\",\"occurrence\":1},\"reason\":\"r\"}], \"summary\":\"s\"}\n```");
res = await runExtract({ promptContent: "帮我写一份介绍杭州的文案" });
payload = JSON.parse(res.body());
/* Contract as of the 12:10 index.js change: a bad position is NOT a failed call.
 * The answer still ships the variables and the summary, but `templated` is null
 * plus a reason, so the panel can disable 写回模板 instead of losing the work. */
ok("a position that misses the source still answers 200", res.statusCode === 200, { status: res.statusCode, body: res.body().slice(0, 160) });
ok("but templated is null, never a half-applied string", payload.templated === null, JSON.stringify(payload.templated));
ok("and the reason is reported verbatim", String(payload.templatedError).includes("对不上"), payload.templatedError);
ok("the variables still come back so positions can be fixed", payload.variables?.[0]?.name === "n", JSON.stringify(payload.variables));
ok("the summary still comes back", payload.summary === "s", payload.summary);
setReply("```json\n{\"variables\": [{\"name\":\"a\",\"value\":\"1\",\"position\":{\"originalText\":\"杭州\",\"occurrence\":1},\"reason\":\"r\"},{\"name\":\"b\",\"value\":\"2\",\"position\":{\"originalText\":\"不存在的原文\",\"occurrence\":1},\"reason\":\"r\"}], \"summary\":\"s\"}\n```");
res = await runExtract({ promptContent: HANGZHOU });
payload = JSON.parse(res.body());
ok("one good plus one bad position is still all-or-nothing", payload.templated === null && String(payload.templatedError).includes("b"), JSON.stringify(payload).slice(0, 170));

setReply("```json\n{\"variables\": [{\"name\":\"a\",\"value\":\"v\",\"position\":{\"originalText\":\"杭州\",\"occurrence\":1},\"reason\":\"r\"}], \"summary\":\"s\",}");
res = await runExtract({ promptContent: "帮我写一份介绍杭州的文案" });
ok("a trailing comma and an unclosed fence are still parsed", res.statusCode === 200 && JSON.parse(res.body()).templated === "帮我写一份介绍{{a}}的文案", res.body().slice(0, 160));

setBehaviour("throws");
res = await runExtract({ promptContent: "x" });
payload = JSON.parse(res.body());
ok("a failing model call -> 502 model-failure", res.statusCode === 502 && payload.code === "model-failure", { status: res.statusCode, code: payload.code });
ok("model-failure names the route", String(payload.message).includes("amazon-bedrock/qwen3.8-flash") && String(payload.message).includes("RATE_LIMIT"), payload.message);

setBehaviour("empty");
res = await runExtract({ promptContent: "x" });
payload = JSON.parse(res.body());
ok("an empty completion is a bad-model-output, not a silent 200", res.statusCode === 502 && payload.code === "bad-model-output", { status: res.statusCode, code: payload.code, message: payload.message });

await (async () => {
	const local = await runExtract({});
	ok("missing promptContent -> 400", local.statusCode === 400 && JSON.parse(local.body()).code === "bad-request", local.statusCode);
})();
res = await runExtract({ promptContent: "   " });
ok("blank promptContent -> 400", res.statusCode === 400, res.statusCode);
res = await runExtract({ promptContent: "字".repeat(60_001) });
ok("oversized promptContent -> 400", res.statusCode === 400, res.statusCode);
res = await runExtract({ promptContent: HANGZHOU }, "GET");
ok("GET on the extract route -> 405 Allow: POST", res.statusCode === 405 && res.headers.allow === "POST", res.statusCode);
res = makeRes();
await extract.handler(makeReq({ promptContent: "x" }, "POST", { "content-type": "text/plain" }), res);
ok("extract rejects a wrong media type with 415", res.statusCode === 415, res.statusCode);
res = makeRes();
await extract.handler(makeReq({ promptContent: "x", filler: "z".repeat(1024 * 1024 + 64) }), res);
ok("extract enforces the body limit with 413", res.statusCode === 413, res.statusCode);
res = makeRes();
await extract.handler(makeReq("not json{"), res);
ok("extract rejects malformed json", res.statusCode === 400, res.statusCode);

/* -------------------------------------------------------------------------- *
 * 9. No model configured at all
 * -------------------------------------------------------------------------- */
setBehaviour("happy");
ctx.agentDefaultModel.currentSelection = () => void 0;
res = await run({ optimizationMode: "user", targetPrompt: "x" });
ok("optimize with no default model -> 503 no-model", res.statusCode === 503 && JSON.parse(res.body()).code === "no-model", res.statusCode);
res = await runExtract({ promptContent: "x" });
ok("extract with no default model -> 503 no-model", res.statusCode === 503 && JSON.parse(res.body()).code === "no-model", res.statusCode);
res = await run({ optimizationMode: "user", targetPrompt: "x", provider: "amazon-bedrock", model: "qwen3.8-flash" });
ok("an explicit pin still works with no default model", events(res.body()).at(-1).model === "amazon-bedrock/qwen3.8-flash", res.statusCode);
ctx.agentDefaultModel.currentSelection = () => ({ provider: "amazon-bedrock", model: "qwen3.8-flash" });

/* -------------------------------------------------------------------------- *
 * 10. Teardown: the effect registrations are disposable
 * -------------------------------------------------------------------------- */
for (const path of [MODELS_ROUTE, OPTIMIZE_ROUTE, EXTRACT_ROUTE]) routes[path]?.handler === void 0 ? ok(`${path} has a handler`, false) : ok(`${path} registered a handler`, true);
delete TEMPLATES["host-probe"];
ok("registry is back to the shipped manifest", Object.keys(TEMPLATES).length === 10, Object.keys(TEMPLATES).join(","));

console.log(fail.length === 0 ? "\nALL PASS" : "\nFAILURES (" + fail.length + "): " + fail.join(" | "));
if (known.length > 0) console.log(`KNOWN BUGS (${known.length}) — lib-side, reported to the owner, not counted as test failures:\n  - ${known.join("\n  - ")}`);
if (fail.length > 0) process.exitCode = 1;
