import { render, validate, escapeHTML } from "../prompt-polish/lib/mustache.js";

const fail = [];
const ok = (label, cond, extra) => { console.log((cond ? "PASS " : "FAIL ") + label + (cond || extra === void 0 ? "" : " -> " + JSON.stringify(extra))); if (!cond) fail.push(label); };

/** Upstream's helper, copied exactly: processor.ts createBuiltInHelpers(). */
const helpers = { toJson: () => (text, r) => JSON.stringify(r(text)) };
const ctx = (extra) => ({ helpers, ...extra });

ok("plain interpolation escapes", render("{{v}}", ctx({ v: '<a & "b">' })) === "&lt;a &amp; &quot;b&quot;&gt;", render("{{v}}", ctx({ v: '<a & "b">' })));
ok("triple stash is raw", render("{{{v}}}", ctx({ v: '<a>' })) === "<a>");
ok("ampersand form is raw", render("{{&v}}", ctx({ v: '<a>' })) === "<a>");

// The token upstream's shipped templates use everywhere.
const token = `{ "originalPrompt": {{#helpers.toJson}}{{{originalPrompt}}}{{/helpers.toJson}} }`;
const nasty = 'he said "hi"\nand {{slot}}';
const encoded = render(token, ctx({ originalPrompt: nasty }));
ok("toJson produces valid JSON", JSON.parse(encoded).originalPrompt === nasty, encoded);

// Load-bearing: the user's own placeholder must survive the lambda round trip.
const kept = render(token, ctx({ originalPrompt: "写一首{{风格}}的歌" }));
ok("lambda output is NOT re-rendered (placeholder survives)", kept.includes("{{风格}}"), kept);

ok("section renders when truthy", render("{{#a}}yes{{/a}}", ctx({ a: true })) === "yes");
ok("section hidden when false", render("{{#a}}yes{{/a}}", ctx({ a: false })) === "");
ok("section hidden when missing", render("{{#a}}yes{{/a}}", ctx({})) === "");
ok("section hidden for empty array", render("{{#a}}yes{{/a}}", ctx({ a: [] })) === "");
ok("inverted section renders for missing", render("{{^a}}no{{/a}}", ctx({})) === "no");
ok("inverted section hidden for truthy", render("{{^a}}no{{/a}}", ctx({ a: 1 })) === "");
ok("comment dropped", render("a{{! note }}b", ctx({})) === "ab");

// Real branch from extraction_en.ts.
const conditional = `{{#hasExistingVariables}}- Avoid duplicates: {{existingVariableNames}}{{/hasExistingVariables}}`;
ok("upstream conditional renders when flag set", render(conditional, ctx({ hasExistingVariables: true, existingVariableNames: "a, b" })) === "- Avoid duplicates: a, b");
ok("upstream conditional hidden when flag unset", render(conditional, ctx({ hasExistingVariables: false })) === "");

// Arrays and the context stack.
ok("array section iterates", render("{{#xs}}[{{.}}]{{/xs}}", ctx({ xs: ["a", "b"] })) === "[a][b]");
ok("object section pushes context", render("{{#u}}{{name}}/{{city}}{{/u}}", ctx({ u: { name: "n", city: "c" } })) === "n/c");
ok("inner lookup falls back to outer stack", render("{{#u}}{{name}}-{{outer}}{{/u}}", ctx({ outer: "O", u: { name: "N" } })) === "N-O");
ok("dotted lookup", render("{{a.b}}", ctx({ a: { b: "deep" } })) === "deep");
ok("missing dotted is empty", render("[{{a.b.c}}]", ctx({ a: {} })) === "[]");
ok("whitespace inside tags tolerated", render("{{  v  }}", ctx({ v: "x" })) === "x");
ok("literal braces with no tag survive", render("cost is $100}}", ctx({})) === "cost is $100}}");

// Unclosed tags must be caught at registration, not at use.
let threw = "";
try { validate("{{#a}}unclosed"); } catch (e) { threw = e.message; }
ok("validate rejects an unclosed section", threw.includes("没有闭合"), threw);
threw = "";
try { validate("{{/nope}}"); } catch (e) { threw = e.message; }
ok("validate rejects a stray close", threw.includes("未匹配"), threw);

ok("escapeHTML covers the mustache set", escapeHTML("&<>\"'`=") === "&amp;&lt;&gt;&quot;&#39;&#x60;&#x3D;", escapeHTML("&<>\"'`="));
ok("undefined interpolates to empty", render("[{{v}}]", ctx({})) === "[]");
ok("null interpolates to empty", render("[{{v}}]", ctx({ v: null })) === "[]");
ok("zero is falsy for sections, as mustache treats it", render("{{#v}}y{{/v}}", ctx({ v: 0 })) === "");
ok("empty string is falsy for sections", render("{{#v}}y{{/v}}", ctx({ v: "" })) === "");

// Set Delimiter, straight out of the shipped extraction template.
const swap = "如果原文中已有 {{=<% %>=}}{{变量}}<%={{ }}=%>,不要重复提取";
ok("set delimiter keeps a literal placeholder", render(swap, ctx({})) === "如果原文中已有 {{变量}},不要重复提取", render(swap, ctx({})));
ok("delimiters are restored for later tags", render(`${swap} {{v}}`, ctx({ v: "<x>" })) === "如果原文中已有 {{变量}},不要重复提取 &lt;x&gt;", render(`${swap} {{v}}`, ctx({ v: "<x>" })));
ok("swapped delimiters actually swap", render("{{=<% %>=}}<% v %>", ctx({ v: "on" })) === "on");
threw = "";
try { validate("{{=bad=}}"); } catch (e) { threw = e.message; }
ok("validate rejects a malformed delimiter tag", threw.includes("分隔符"), threw);

// A lambda whose body nests an inverted section: reconstructing that body for
// the lambda must re-open it with `^`, and rendering must not re-parse a
// section literally named "^miss".
const wrap = () => (text, r) => "«" + r(text) + "»";
ok("lambda body can hold an inverted section", render("{{#w}}{{^miss}}kept{{/miss}}:{{{v}}}{{/w}}", ctx({ w: wrap, v: "<x>" })) === "«kept:<x>»", render("{{#w}}{{^miss}}kept{{/miss}}:{{{v}}}{{/w}}", ctx({ w: wrap, v: "<x>" })));
ok("lambda body sees a present inverted-section variable as false", render("{{#w}}{{^v}}gone{{/v}}{{/w}}", ctx({ w: wrap, v: true })) === "«»");

console.log(fail.length === 0 ? "\nALL PASS" : "\nFAILURES (" + fail.length + "): " + fail.join(" | "));
if (fail.length > 0) process.exitCode = 1;
