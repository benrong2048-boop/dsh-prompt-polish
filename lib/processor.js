/**
 * The template processor: turns a template plus a request into LLM messages.
 *
 * Ported from prompt-optimizer `packages/core/src/services/template/processor.ts`
 * and the context assembly in `services/prompt/service.ts` (AGPL-3.0). The
 * original imports the `mustache` package and a `TemplateManager`; here the
 * engine is the local subset in `./mustache.js` and the registry is `TEMPLATES`
 * in `./prompts.js`.
 *
 * The part worth reading twice is `buildMessages`. Upstream treats the two
 * template shapes **differently**, and not cosmetically:
 *
 *   - `content` is a **string** → the string becomes the **system** message
 *     verbatim, with **no template rendering at all**, and the prompt to optimise
 *     is appended as a **separate user message**. Rendering is skipped because a
 *     LangGPT skeleton is full of literal `{{variable}}` slots meant for the
 *     *model* to fill in — rendering would eat them.
 *   - `content` is a **message array** → every message goes through mustache with
 *     the full `TemplateContext` plus `helpers`, so `{{#hasFocus}}`-style
 *     branches and `{{#helpers.toJson}}` framing work.
 *
 * So "is the target prompt JSON-framed?" is a property of the template family,
 * not a global rule. Anything that flattens the two shapes is wrong.
 *
 * @module @benrong/dsh-prompt-polish/processor
 */

import { parse, render as mustacheRender, validate as validateMustache } from "./mustache.js";

/**
 * The single built-in helper upstream registers
 * (`TemplateProcessor.createBuiltInHelpers`). Written as a two-step lambda: the
 * value mustache looks up is a function whose result is the real section lambda.
 */
const HELPERS = {
	toJson: () => (text, render) => JSON.stringify(render(text))
};

/**
 * @param template - a registered template.
 * @returns true when `content` is a bare string (the LangGPT-style shape).
 */
function isSimpleTemplate(template) {
	return typeof template.content === "string";
}

/**
 * Reject a template that cannot be used, at registration time.
 * @param template - the candidate.
 * @throws when content is missing, an empty array, or holds unparsable mustache.
 */
function validateTemplate(template) {
	if (template === void 0 || template === null || !template.content) {
		throw new Error(`模板 ${template?.id ?? "(未命名)"} 缺少 content`);
	}
	if (Array.isArray(template.content)) {
		if (template.content.length === 0) throw new Error(`模板 ${template.id} 的 content 是空数组`);
		for (const message of template.content) {
			if (typeof message.content !== "string") throw new Error(`模板 ${template.id} 有一条消息的 content 不是字符串`);
			validateMustache(message.content);
		}
		return;
	}
	if (typeof template.content !== "string") throw new Error(`模板 ${template.id} 的 content 既不是字符串也不是消息数组`);
}

/**
 * Every context name a template reads, collected from the parsed tree rather
 * than a hand-maintained list. `helpers.*` is excluded because it is supplied by
 * the renderer, not by the caller.
 *
 * Simple (string) templates return an empty set: they are never rendered.
 * @param template - a registered template.
 * @returns sorted variable names.
 */
function referencedVariables(template) {
	const found = new Set();
	if (!Array.isArray(template.content)) return [];
	const walk = (nodes) => {
		for (const node of nodes) {
			if (node.type === "name" || node.type === "section") {
				if (!node.name.startsWith("helpers.") && node.name !== ".") found.add(node.name.split(".")[0]);
			}
			if (node.children !== void 0) walk(node.children);
		}
	};
	for (const message of template.content) walk(parse(message.content).children);
	return [...found].sort();
}

/**
 * Build the message array to send. Mirrors `buildMessages` in the original.
 * @param template - a registered template.
 * @param context - a `TemplateContext` from {@link createTemplateContext}.
 * @returns `[{ role, content }]`.
 */
function buildMessages(template, context) {
	validateTemplate(template);
	if (isSimpleTemplate(template)) {
		const messages = [{ role: "system", content: template.content }];
		// Passed through with no template replacement — the user's text, as typed.
		if (context.originalPrompt) messages.push({ role: "user", content: context.originalPrompt });
		return messages;
	}
	const view = { ...context, helpers: HELPERS };
	return template.content.map((message) => ({ role: message.role, content: mustacheRender(message.content, view) }));
}

/**
 * `ToolDefinition[]` → text, for the `{{toolsContext}}` slot.
 * @param tools - OpenAI-style tool definitions.
 * @returns the formatted block, or "" when there are none.
 */
function formatToolsAsText(tools) {
	if (!Array.isArray(tools) || tools.length === 0) return "";
	return tools
		.map((tool) => {
			const func = tool.function ?? {};
			let text = `Tool name: ${func.name}`;
			if (func.description) text += `\nDescription: ${func.description}`;
			if (func.parameters) text += `\nParameters: ${JSON.stringify(func.parameters, null, 2)}`;
			return text;
		})
		.join("\n\n");
}

/**
 * `ConversationMessage[]` → `ROLE: content` blocks, for `{{conversationContext}}`.
 * @param messages - conversation history.
 * @returns the formatted block, or "" when there are none.
 */
function formatConversationAsText(messages) {
	if (!Array.isArray(messages) || messages.length === 0) return "";
	return messages.map((message) => `${String(message.role).toUpperCase()}: ${message.content}`).join("\n\n");
}

/**
 * The image manifest templates see. Metadata only — bytes travel with the model
 * request, never through the prompt text.
 * @param images - `[{ mimeType }]`.
 * @returns a JSON string, `"[]"` when empty.
 */
function buildInputImagesManifest(images) {
	if (!Array.isArray(images) || images.length === 0) return "[]";
	return JSON.stringify(images.map((image, index) => ({ index: index + 1, label: `Image ${index + 1}`, mimeType: image.mimeType || "image/png" })));
}

/**
 * Merge caller-supplied variables over the base context.
 *
 * The precedence is upstream's and it is deliberate: a custom variable may not
 * shadow a built-in one (`if (extended[key] === undefined)`), so a user template
 * cannot redefine `originalPrompt` from the variables bag.
 * @param base - the built-in context.
 * @param customVariables - user variables.
 * @param conversationMessages - raw messages exposed to loops.
 * @returns the extended context.
 */
function createExtendedContext(base, customVariables, conversationMessages) {
	const extended = { ...base, customVariables, conversationMessages };
	if (customVariables !== void 0) {
		for (const [key, value] of Object.entries(customVariables)) {
			if (extended[key] === void 0) extended[key] = value;
		}
	}
	return extended;
}

/**
 * Assemble the whole `TemplateContext` the way `resolveOptimizationMessages`
 * does: built-ins first, then custom variables and messages, then the two
 * derived text blocks.
 * @param input - request fields.
 * @returns the context to hand {@link buildMessages}.
 */
function createTemplateContext(input) {
	const images = Array.isArray(input.inputImages) ? input.inputImages : [];
	const base = {
		originalPrompt: input.targetPrompt,
		optimizationMode: input.optimizationMode,
		contextMode: input.contextMode,
		renderPhase: input.renderPhase ?? "optimize",
		tools: input.tools,
		hasInputImages: images.length > 0,
		inputImageCount: images.length,
		inputImagesJson: buildInputImagesManifest(images)
	};
	if (input.lastOptimizedPrompt !== void 0) base.lastOptimizedPrompt = input.lastOptimizedPrompt;
	if (input.iterateInput !== void 0) base.iterateInput = input.iterateInput;
	if (input.promptContent !== void 0) base.promptContent = input.promptContent;
	const context = createExtendedContext(base, input.variables, input.messages);
	if (Array.isArray(input.messages) && input.messages.length > 0) context.conversationContext = formatConversationAsText(input.messages);
	if (Array.isArray(input.tools) && input.tools.length > 0) context.toolsContext = formatToolsAsText(input.tools);
	return context;
}

export {
	HELPERS,
	buildInputImagesManifest,
	buildMessages,
	createExtendedContext,
	createTemplateContext,
	formatConversationAsText,
	formatToolsAsText,
	isSimpleTemplate,
	referencedVariables,
	validateTemplate
};
