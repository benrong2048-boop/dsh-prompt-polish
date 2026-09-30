/**
 * A mustache-subset renderer, faithful to the semantics prompt-optimizer relies
 * on. Upstream imports the real `mustache` package; this profile cannot — its
 * `node_modules` has no mustache and `pnpm install` there prunes hand-copied
 * packages — so the subset is implemented here instead.
 *
 * Supported: `{{name}}` (HTML-escaped), `{{{name}}}` and `{{&name}}` (raw),
 * `{{#name}}…{{/name}}` sections, `{{^name}}…{{/name}}` inverted sections,
 * `{{!comment}}`, `{{>partial}}`, `{{.}}` and dotted `{{a.b}}` lookups, and the
 * context stack a section pushes onto.
 *
 * Two decisions here are load-bearing for prompt work and worth stating:
 *
 * 1. **A lambda's return value is inserted verbatim; it is never re-rendered.**
 *    A prompt that legitimately contains `{{风格}}` must survive a lambda round
 *    trip. Re-rendering lambda output would look that up as a slot and, finding
 *    nothing, delete the user's placeholder — the exact failure upstream
 *    documents as "自动保留值中的占位符".
 * 2. **Section lambdas may be two-step.** `helpers.toJson` is written as
 *    `() => (text, render) => …`: the value is a function whose result is
 *    another function. Both are called with `(rawText, render)` before the value
 *    is used, which is what makes
 *    `{ "k": {{#helpers.toJson}}{{{v}}}{{/helpers.toJson}} }` produce
 *    `JSON.stringify(theRawValue)`.
 *
 * Falsy/empty handling follows mustache: `undefined`, `null`, `false` and an
 * empty array render nothing, and an inverted section renders for exactly those.
 *
 * @module @mimo-ai/dsh-client-ui-prompt-polish/mustache
 */

/** mustache >= 4.1 entity set, backtick and `=` included. */
const HTML_ESCAPES = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
	"`": "&#x60;",
	"=": "&#x3D;"
};

/**
 * @param value - anything.
 * @returns the HTML-escaped text mustache would emit.
 */
function escapeHTML(value) {
	return String(value).replace(/[&<>"'`=]/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * @param value - a context value about to be interpolated.
 * @returns the string form mustache uses (null/undefined become empty).
 */
function stringify(value) {
	if (value === null || value === void 0) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

/**
 * Reject a tag whose name cannot possibly resolve. Deliberately permissive about
 * the alphabet — a user template may name a slot `{{城市}}` — but an empty name or
 * one still holding a sigil means the template is malformed, and interpolating
 * that as the empty string would hide the mistake.
 * @param name - a tag body after trimming.
 * @returns the same name.
 * @throws when it is not a usable identifier.
 */
function checkName(name) {
	if (name === "" || !/\S/.test(name) || /[{}#^&=/!]/.test(name)) {
		throw new Error(`mustache: 非法的变量名 "${name}"`);
	}
	return name;
}

/**
 * Tokenize into a node tree.
 * @param src - template text.
 * @returns the root node.
 */
function parse(src) {
	const root = { type: "root", children: [] };
	const stack = [root];
	// Mutable because `{{=@ @=}}` can swap them mid-template.
	let openDelim = "{{";
	let closeDelim = "}}";
	let text = "";
	let i = 0;
	const emitText = () => {
		if (text !== "") {
			stack[stack.length - 1].children.push({ type: "text", value: text });
			text = "";
		}
	};
	const push = (node) => {
		if (node.name !== void 0) node.name = checkName(node.name);
		emitText();
		stack[stack.length - 1].children.push(node);
	};
	const openSection = (name, inverted) => {
		emitText();
		const top = { type: "section", name: checkName(name), children: [], inverted, original: "" };
		stack[stack.length - 1].children.push(top);
		stack.push(top);
	};
	while (i < src.length) {
		const open = src.indexOf(openDelim, i);
		if (open < 0) {
			text += src.slice(i);
			break;
		}
		text += src.slice(i, open);
		const triple = openDelim === "{{" && src.startsWith("{{{", open);
		const skip = triple ? 3 : 2;
		const close = src.indexOf(triple ? "}}}" : closeDelim, open + skip);
		if (close < 0) {
			// An unclosed tag stays literal text, as mustache tolerates it.
			text += src.slice(open);
			break;
		}
		const body = src.slice(open + skip, close).trim();
		i = close + skip;
		// Set Delimiter (`{{=@ @=}}`), part of the mustache spec and used by the
		// shipped templates to write a literal `{{变量}}` inside the text they
		// hand to the model. Without it that placeholder would be parsed as a slot
		// and silently render empty.
		if (body.startsWith("=")) {
			const next = /^=\s*(\S+)\s+(\S+)\s*=$/.exec(body);
			if (next === null) throw new Error(`mustache: 非法的分隔符标签 {{${body}}}`);
			openDelim = next[1];
			closeDelim = next[2];
			continue;
		}
		if (triple) {
			push({ type: "name", name: body, escapeText: false });
			continue;
		}
		const sigil = body[0];
		if (sigil === "!") continue;
		if (sigil === "#" || sigil === "^") {
			openSection(body.slice(1).trim(), sigil === "^");
			continue;
		}
		if (sigil === "/") {
			const expected = body.slice(1).trim();
			const top = stack[stack.length - 1];
			if (top.type !== "section" || top.name !== expected) {
				throw new Error(`mustache: 未匹配的闭合标签 {{/${expected}}}`);
			}
			// Flush the text running up to the close INTO the section; clearing it
			// here silently truncates every block body at its last tag.
			emitText();
			stack.pop();
			continue;
		}
		if (sigil === "&") {
			push({ type: "name", name: body.slice(1).trim(), escapeText: false });
			continue;
		}
		if (sigil === ">") {
			push({ type: "partial", name: body.slice(1).trim() });
			continue;
		}
		push({ type: "name", name: body, escapeText: true });
	}
	if (stack.length !== 1) {
		throw new Error(`mustache: 区块 {{#${stack[stack.length - 1].name}}} 没有闭合`);
	}
	emitText();
	return root;
}

/**
 * Resolve one path segment by walking the context stack innermost-first.
 * @param stack - the context stack.
 * @param name - a bare key or `.`.
 * @returns `{ found, value }`.
 */
function lookupOne(stack, name) {
	if (name === ".") return { found: true, value: stack[stack.length - 1] };
	for (let i = stack.length - 1; i >= 0; i -= 1) {
		const view = stack[i];
		if (view !== null && typeof view === "object" && Object.prototype.hasOwnProperty.call(view, name)) {
			return { found: true, value: view[name] };
		}
	}
	return { found: false, value: void 0 };
}

/**
 * Resolve a possibly dotted name: the first segment walks the stack, the rest
 * are plain property reads — how mustache resolves `a.b`.
 * @param stack - the context stack.
 * @param name - the tag body.
 * @returns the resolved value, or undefined.
 */
function lookup(stack, name) {
	// Checked before splitting: "." is mustache's implicit iterator, and
	// ".".split(".") would otherwise become ["", ""] and resolve to nothing.
	if (name === ".") return stack[stack.length - 1];
	const parts = name.split(".");
	const value = lookupOne(stack, parts[0]).value;
	if (parts.length === 1) return value;
	let current = value;
	for (let i = 1; i < parts.length && current !== null && current !== void 0; i += 1) current = current[parts[i]];
	return current;
}

/**
 * Truthiness a section tests, per mustache.
 * @param value - the resolved section value.
 * @returns whether the section should render.
 */
function sectionRenders(value) {
	if (Array.isArray(value)) return value.length > 0;
	if (value === null || value === void 0 || value === false) return false;
	if (typeof value === "function") return true;
	return Boolean(value);
}

/**
 * Run a value through the lambda steps. A plain value comes back untouched; a
 * function is called with `(rawSectionText, render)`, and if it returns another
 * function, that one is called the same way.
 */
function resolveCallable(value, stack, rawText, renderFn) {
	if (typeof value !== "function") return value;
	const view = stack[stack.length - 1];
	const outer = (template) => renderFn(template, stack);
	let out = value.call(view, rawText, outer);
	if (typeof out === "function") out = out.call(view, rawText, outer);
	return out;
}

function renderNodes(nodes, stack, partials, renderFn) {
	let out = "";
	for (const node of nodes) {
		if (node.type === "text") {
			out += node.value;
			continue;
		}
		if (node.type === "name") {
			const value = resolveCallable(lookup(stack, node.name), stack, "", renderFn);
			out += node.escapeText ? escapeHTML(stringify(value)) : stringify(value);
			continue;
		}
		if (node.type === "partial") {
			const named = partials === void 0 ? void 0 : partials[node.name];
			if (typeof named === "string") out += renderFn(named, stack);
			continue;
		}
		const raw = sectionText(node);
		const value = resolveCallable(lookup(stack, node.name), stack, raw, renderFn);
		if (node.inverted) {
			if (!sectionRenders(value)) out += renderNodes(node.children, stack, partials, renderFn);
			continue;
		}
		// A lambda that produced text is inserted verbatim; see the module note.
		if (typeof value === "string") {
			out += value;
			continue;
		}
		if (!sectionRenders(value)) continue;
		if (Array.isArray(value)) {
			for (const item of value) {
				stack.push(item);
				out += renderNodes(node.children, stack, partials, renderFn);
				stack.pop();
			}
			continue;
		}
		if (typeof value === "object") {
			stack.push(value);
			out += renderNodes(node.children, stack, partials, renderFn);
			stack.pop();
			continue;
		}
		out += renderNodes(node.children, stack, partials, renderFn);
	}
	return out;
}

/** The raw source a section covers, so a lambda can see its own body. */
function sectionText(node) {
	let out = "";
	for (const child of node.children) {
		if (child.type === "text") out += child.value;
		else if (child.type === "name") out += child.escapeText ? `{{${child.name}}}` : `{{{${child.name}}}}`;
		else if (child.type === "partial") out += `{{>${child.name}}}`;
		// An inverted section re-opens with `^`, not `#^` — the latter would
		// re-parse as a section literally named "^name".
		else out += `{{${child.inverted ? "^" : "#"}${child.name}}}${sectionText(child)}{{/${child.name}}}`;
	}
	return out;
}

const cache = new Map();

/**
 * Render a mustache template.
 * @param template - the template text.
 * @param view - the top context object.
 * @param partials - optional name → text map for `{{>name}}`.
 * @returns the rendered text.
 */
function render(template, view, partials) {
	const source = String(template);
	let tree = cache.get(source);
	if (tree === void 0) {
		tree = parse(source);
		if (cache.size > 200) cache.clear();
		cache.set(source, tree);
	}
	// Recursive entry used by lambdas and partials; the top-level call above is
	// the only place a cached tree applies, so reuse it instead of re-parsing.
	const renderFn = (text, stack) => renderNodes(parse(text).children, stack, partials, renderFn);
	return renderNodes(tree.children, [view ?? {}], partials, renderFn);
}

/**
 * Cheap syntax probe, so a broken template is rejected when it is registered
 * rather than when someone finally tries to use it.
 * @param template - the template text.
 * @throws when tags are unbalanced.
 */
function validate(template) {
	parse(String(template));
}

export { escapeHTML, parse, render, validate };
