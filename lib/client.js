window.__ModuleLoader__.load({
	id: "@benrong/dsh-prompt-polish",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		const R = typeof react.useState === "function" ? react : react.default;
		const h = R.createElement;
		const useState = R.useState;
		const useRef = R.useRef;
		const useEffect = R.useEffect;
		const useCallback = R.useCallback;
		const useMemo = R.useMemo;
		//#region styles.js
		var STYLE_ID = "dsh-prompt-polish-style";
		/**
		 * One stylesheet, injected once and shared by every occurrence. Theme tokens
		 * only, so the panel follows light/dark and the rest of the composer.
		 */
		/**
		 * 控件规范（全部走 --dsw 主题 token，浅/深色自动跟随）：
		 *   高度三档   seat 26 / 常规控件 28 / mini 24（结果区小按钮）
		 *   圆角       面板 14、控件 8、tab 组 9、tab/关闭 7
		 *   字号       面板 13、按钮/seat/tab 12、sel/meta/mini 11.5
		 *   内边距     按钮 0 12px、mini 0 8px、tab 0 10px
		 *   间距       footer gap 8、head gap 6
		 *   交互态     默认 / hover(bg-layer-2 + border-l2) / active(border-l1 当底色，
		 *              主按钮走 brightness) / disabled(opacity .45 + not-allowed + title 说明原因)
		 *              / loading(主按钮换"停止"、抽取换文案并禁用、输出区闪标) / focus-visible(品牌色描边)
		 *   防裁切     按钮 white-space:nowrap + flex:0 0 auto（永不被挤扁换行），
		 *              让 meta 文本(ellipsis)和 select(min-width 72px)去承担收缩
		 */
		var CSS = [
			".pp-seatwrap{--flame-edge:255,92,44;--flame-mid:255,158,64;--flame-core:255,243,190;position:relative;display:inline-flex;align-items:center;justify-content:center;overflow:clip;overflow-clip-margin:3px;border:1px solid rgba(var(--flame-mid),.6);border-radius:14px;background:radial-gradient(130% 170% at 50% 122%,rgb(var(--flame-edge)),rgb(var(--flame-mid)) 40%,#3a1a06 74%,#1c0c04 100%);box-shadow:0 0 9px rgba(var(--flame-mid),.5),0 0 18px rgba(var(--flame-edge),.32);transition:border-color .16s ease;animation:pp-seat-breathe 3.4s ease-in-out infinite}",
			".pp-seatwrap:hover{border-color:rgba(var(--flame-core),.9);animation-duration:1.6s}",
			".pp-seatwrap:active{filter:brightness(.82) saturate(1.2) !important}",
			".pp-seatwrap:has(.pp-seat:focus-visible){outline:2px solid rgba(var(--flame-mid),.9);outline-offset:2px}",
			".pp-seatwrap[data-open=\"1\"]{border-color:rgba(var(--flame-core),.95)}",
			".pp-seatwrap[data-busy=\"1\"]{animation:pp-seat-breathe .9s ease-in-out infinite}",
			".pp-seat{position:relative;z-index:2;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 12px;border:none;border-radius:14px;background:transparent;color:#fff4e2;text-shadow:0 1px 2px rgba(60,20,0,.75);font-size:12px;font-weight:600;letter-spacing:.04em;line-height:1;cursor:pointer;font-family:inherit;white-space:nowrap}",
			".pp-seat:disabled{cursor:not-allowed;opacity:.7}",
			".pp-seat-layer{position:absolute;left:50%;top:50%;width:230%;aspect-ratio:1;pointer-events:none;z-index:1;transform:translate(-50%,-50%);opacity:.6;background:radial-gradient(closest-side,rgba(var(--flame-core),.9),rgba(var(--flame-mid),.55) 42%,transparent 72%);mix-blend-mode:screen;animation:pp-flame-a 2.3s ease-in-out infinite}",
			".pp-seat-layer:last-of-type{width:120%;top:64%;background:radial-gradient(closest-side,rgba(255,255,255,.85),rgba(var(--flame-core),.6) 34%,transparent 70%);animation:pp-flame-b 3.9s ease-in-out infinite}",
			".pp-seat-spark{position:absolute;left:8%;top:2px;width:84%;height:8px;border-radius:99px;pointer-events:none;z-index:3;opacity:.35;background:linear-gradient(180deg,rgba(var(--flame-core),.9),transparent);filter:blur(2px)}",
			"@keyframes pp-seat-breathe{0%,100%{filter:brightness(.92) saturate(1.05);box-shadow:0 0 7px rgba(var(--flame-mid),.42),0 0 15px rgba(var(--flame-edge),.28)}50%{filter:brightness(1.16) saturate(1.15);box-shadow:0 0 13px rgba(var(--flame-mid),.68),0 0 26px rgba(var(--flame-edge),.46)}}",
			"@keyframes pp-flame-a{0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)}50%{opacity:.85;transform:translate(-50%,-50%) scale(1.12)}}",
			"@keyframes pp-flame-b{0%{opacity:.55;transform:translate(-52%,-50%) scale(.96)}50%{opacity:.9;transform:translate(-48%,-50%) scale(1.08)}100%{opacity:.55;transform:translate(-52%,-50%) scale(.96)}}",
			"@media (prefers-reduced-motion:reduce){.pp-seatwrap,.pp-seat-layer,.pp-seat-layer:last-of-type{animation:none}}",
			".pp-glyph{font-size:12px;line-height:1}",
			".pp-btn[data-on=\"1\"]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-weight:600}",
			".pp-hist{display:flex;flex-direction:column;gap:8px}",
			".pp-hitem{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}",
			".pp-hhead{display:flex;align-items:center;gap:6px;padding:7px 10px;font-size:11.5px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none;min-width:0}",
			".pp-hhead:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);color:var(--dsw-alias-label-primary)}",
			".pp-htime{color:var(--dsw-alias-label-primary);font-weight:600;flex:0 0 auto}",
			".pp-hwhat{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
			".pp-harrow{margin-left:auto;flex:0 0 auto}",
			".pp-hbody{padding:0 10px 8px;border-top:1px dashed var(--dsw-alias-border-l1)}",
			".pp-hlabel{font-size:11px;color:var(--dsw-alias-label-secondary);margin:8px 0 3px}",
			".pp-hpre{white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.55;margin:0;font-family:inherit;color:var(--dsw-alias-label-primary);max-height:170px;overflow:auto;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:7px;padding:6px 8px}",
			".pp-hrow{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}",
			".pp-consent{margin:0 0 10px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-2)}",
			".pp-consent p{margin:0 0 8px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-primary)}",
			".pp-consent .pp-hrow{margin-top:0}",
			".pp-usage{font-size:11.5px;color:var(--dsw-alias-label-secondary);margin:0 0 6px}",
			".pp-cmpbar{display:flex;align-items:center;gap:6px;margin:0 0 8px;min-width:0}",
			".pp-cmp{display:flex;gap:6px;align-items:stretch}",
			".pp-ccol{flex:1 1 0;min-width:0;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}",
			".pp-chead{display:flex;align-items:center;gap:4px;padding:5px 8px;font-size:11px;color:var(--dsw-alias-label-secondary);border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}",
			".pp-ctitle{font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".pp-csize{margin-left:auto;flex:0 0 auto}",
			".pp-cbody{margin:0;padding:6px 8px;font-size:11.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;font-family:inherit;color:var(--dsw-alias-label-primary);overflow:auto;max-height:230px;flex:1 1 auto}",
			".pp-cmp[data-stack=\"1\"]{flex-direction:column}",
			".pp-cmp[data-stack=\"1\"] .pp-cbody{max-height:110px}",
			".pp-csum{margin:8px 0 0;padding:8px 10px;border:1px dashed var(--dsw-alias-border-l1);border-radius:9px;font-size:11.5px;line-height:1.7;color:var(--dsw-alias-label-secondary)}",
			".pp-csum b{color:var(--dsw-alias-label-primary);font-weight:600}",
			".pp-panel{position:fixed;z-index:1200;width:560px;max-width:calc(100vw - 24px);max-height:min(66vh,560px);display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-overlay);box-shadow:0 18px 48px rgba(0,0,0,.28);overflow:hidden;font-size:13px;color:var(--dsw-alias-label-primary)}",
			".pp-head{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-width:0}",
			".pp-tabs{display:inline-flex;gap:2px;padding:2px;border-radius:9px;background:var(--dsw-alias-bg-base);flex:0 0 auto}",
			".pp-tab{height:24px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap;transition:background .12s ease,color .12s ease}",
			".pp-tab:hover:not(:disabled):not([data-on=\"1\"]){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}",
			".pp-tab:active:not(:disabled){background:var(--dsw-alias-border-l1)}",
			".pp-tab[data-on=\"1\"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600}",
			".pp-tab:disabled{opacity:.45;cursor:not-allowed}",
			".pp-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}",
			".pp-spacer{flex:1 1 auto}",
			".pp-x{width:24px;height:24px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:15px;line-height:1;flex:0 0 auto;transition:background .12s ease,color .12s ease}",
			".pp-x:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}",
			".pp-x:active{background:var(--dsw-alias-border-l1)}",
			".pp-x:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}",
			".pp-body{flex:1 1 auto;overflow:auto;padding:12px 14px}",
			".pp-note{color:var(--dsw-alias-label-secondary);font-size:12px;margin:0 0 8px}",
			".pp-ta{width:100%;min-height:64px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:12.5px;font-family:inherit;resize:vertical;box-sizing:border-box;outline:none;transition:border-color .12s ease}",
			".pp-ta:focus{border-color:var(--dsw-alias-brand-primary)}",
			".pp-outbar{display:flex;justify-content:flex-end;margin:0 0 6px}",
			".pp-out{white-space:pre-wrap;word-break:break-word;font-size:12.5px;line-height:1.62;margin:0;font-family:inherit;color:var(--dsw-alias-label-primary)}",
			".pp-out:empty::before{content:attr(data-placeholder);color:var(--dsw-alias-label-secondary)}",
			".pp-caret{display:inline-block;width:6px;height:14px;margin-left:2px;vertical-align:-2px;background:var(--dsw-alias-brand-primary);animation:pp-blink 1s steps(2,start) infinite}",
			"@keyframes pp-blink{to{visibility:hidden}}",
			".pp-err{padding:8px 10px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary);font-size:12px;margin-bottom:8px;white-space:pre-wrap}",
			".pp-foot{display:flex;align-items:center;gap:8px;padding:9px 12px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-width:0}",
			".pp-meta{color:var(--dsw-alias-label-secondary);font-size:11.5px;flex:0 1 auto;min-width:0;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".pp-vars{margin-top:8px;padding-top:8px;border-top:1px dashed var(--dsw-alias-border-l1)}",
			".pp-vlist{list-style:none;padding:0;margin:0 0 8px;display:flex;flex-direction:column;gap:4px}",
			".pp-vlist li{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-primary)}",
			".pp-vlist code{padding:1px 5px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);font-size:11.5px}",
			".pp-vwhy{color:var(--dsw-alias-label-secondary)}",
			".pp-btn{height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:linear-gradient(180deg,color-mix(in srgb,var(--dsw-alias-label-primary) 8%,var(--dsw-alias-bg-base)),var(--dsw-alias-bg-base));box-shadow:inset 0 1px 0 color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent),0 1px 4px rgba(0,0,0,.22);color:var(--dsw-alias-label-primary);font-size:12px;line-height:26px;cursor:pointer;font-family:inherit;white-space:nowrap;flex:0 0 auto;transition:background .12s ease,border-color .12s ease,color .12s ease,filter .12s ease,box-shadow .18s ease}",
			".pp-btn:hover:not(:disabled){background:linear-gradient(180deg,color-mix(in srgb,var(--dsw-alias-label-primary) 14%,var(--dsw-alias-bg-layer-2)),var(--dsw-alias-bg-layer-2));border-color:var(--dsw-alias-border-l2);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--dsw-alias-label-primary) 20%,transparent),0 2px 8px rgba(0,0,0,.26)}",
			".pp-btn:active:not(:disabled){background:var(--dsw-alias-border-l1)}",
			".pp-btn:disabled{opacity:.45;cursor:not-allowed}",
			".pp-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}",
			".pp-btn[data-primary=\"1\"]{background:linear-gradient(180deg,color-mix(in srgb,var(--dsw-alias-label-primary) 16%,var(--dsw-alias-brand-primary)),var(--dsw-alias-brand-primary));border-color:var(--dsw-alias-brand-primary);color:#fff;font-weight:600;box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 22%,transparent),0 0 12px color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent)}",
			".pp-btn[data-primary=\"1\"]:hover:not(:disabled){background:linear-gradient(180deg,color-mix(in srgb,var(--dsw-alias-label-primary) 16%,var(--dsw-alias-brand-primary)),var(--dsw-alias-brand-primary));filter:brightness(1.14);box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 30%,transparent),0 0 16px color-mix(in srgb,var(--dsw-alias-brand-primary) 60%,transparent)}",
			".pp-btn[data-primary=\"1\"]:active:not(:disabled){background:var(--dsw-alias-brand-primary);filter:brightness(.88)}",
			".pp-mini{height:24px;padding:0 8px;font-size:11.5px;line-height:22px}",
			".pp-sel{height:28px;flex:0 1 auto;min-width:72px;max-width:190px;padding:0 6px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:linear-gradient(180deg,color-mix(in srgb,var(--dsw-alias-label-primary) 6%,var(--dsw-alias-bg-base)),var(--dsw-alias-bg-base));box-shadow:inset 0 1px 0 color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);color:var(--dsw-alias-label-secondary);font-size:11.5px;font-family:inherit;cursor:pointer;outline:none;transition:background .12s ease,color .12s ease,border-color .12s ease}",
			".pp-sel:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}",
			".pp-sel:disabled{opacity:.45;cursor:not-allowed}",
			".pp-sel:focus{border-color:var(--dsw-alias-brand-primary)}",
			".pp-sel:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}"
		].join("\n");
		function ensureStyle() {
			if (typeof document === "undefined" || document.getElementById(STYLE_ID) !== null) return;
			var tag = document.createElement("style");
			tag.id = STYLE_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region api.js
		var OPTIMIZE_ROUTE = "/prompt-polish/optimize";
		var MODELS_ROUTE = "/prompt-polish/models";
		var EXTRACT_ROUTE = "/prompt-polish/extract-variables";
		/**
		 * Where the pinned polish model lives. The composer's own model can be an
		 * image model, which cannot answer a text rewrite, so the panel keeps a
		 * choice of its own and empty means "follow the composer".
		 */
		var PIN_KEY = "dsh.prompt-polish/model";
		function readPin() {
			try {
				var raw = localStorage.getItem(PIN_KEY);
				return typeof raw === "string" ? raw : "";
			} catch {
				return "";
			}
		}
		function writePin(value) {
			try {
				if (value === "") localStorage.removeItem(PIN_KEY);
				else localStorage.setItem(PIN_KEY, value);
			} catch {}
		}
		/**
		 * Polish history, v2: a consent-gated, version-chained local record.
		 *
		 * The envelope is `{ schemaVersion, consent, entries }`. consent gates
		 * persistence: "unknown" saves nothing and raises the consent card after
		 * the first successful run; "granted" persists; "declined" persists
		 * nothing and wipes what was there. Entries form chains — an iterate run
		 * points at the version it revised via parentId/rootId — so 对比 and
		 * 删除整条链 operate on something honest. A legacy bare-array store (the
		 * first shipped format) migrates to consent:"granted" with normalized
		 * entries, preserving what the user already had. Any storage failure
		 * degrades to no-persistence rather than breaking a run.
		 */
		var HISTORY_KEY = "dsh.prompt-polish/history";
		var HISTORY_SCHEMA = 2;
		var HISTORY_MAX = 50;
		var HISTORY_CLIP = 4000;
		function clip(text) {
			if (typeof text !== "string") return "";
			return text.length > HISTORY_CLIP ? text.slice(0, HISTORY_CLIP) + "…" : text;
		}
		function emptyHistoryStore() {
			return { schemaVersion: HISTORY_SCHEMA, consent: "unknown", entries: [] };
		}
		/** Timestamps collide; the random tail keeps entry ids unique. */
		function newEntryId() {
			return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
		}
		/** Fill in fields older formats lack, so views never branch on shape. */
		function normalizeEntry(entry) {
			var e = entry && typeof entry === "object" ? entry : {};
			var id = typeof e.id === "string" && e.id !== "" ? e.id : String(e.id === void 0 || e.id === null ? newEntryId() : e.id);
			return {
				id: id,
				rootId: typeof e.rootId === "string" && e.rootId !== "" ? e.rootId : id,
				parentId: typeof e.parentId === "string" ? e.parentId : null,
				at: typeof e.at === "number" ? e.at : typeof e.id === "number" ? e.id : Date.now(),
				mode: typeof e.mode === "string" ? e.mode : "",
				template: typeof e.template === "string" ? e.template : "",
				templateId: typeof e.templateId === "string" ? e.templateId : "",
				model: typeof e.model === "string" ? e.model : "",
				input: typeof e.input === "string" ? e.input : "",
				output: typeof e.output === "string" ? e.output : "",
				usage: e.usage && typeof e.usage === "object" ? e.usage : void 0,
				elapsedMs: typeof e.elapsedMs === "number" ? e.elapsedMs : 0,
				source: typeof e.source === "string" ? e.source : "run"
			};
		}
		function readHistoryStore() {
			try {
				var raw = localStorage.getItem(HISTORY_KEY);
				if (typeof raw !== "string" || raw === "") return emptyHistoryStore();
				var parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					return { schemaVersion: HISTORY_SCHEMA, consent: "granted", entries: parsed.map(normalizeEntry) };
				}
				if (parsed === null || typeof parsed !== "object") return emptyHistoryStore();
				return {
					schemaVersion: HISTORY_SCHEMA,
					consent: parsed.consent === "granted" || parsed.consent === "declined" ? parsed.consent : "unknown",
					entries: Array.isArray(parsed.entries) ? parsed.entries.map(normalizeEntry) : []
				};
			} catch {
				return emptyHistoryStore();
			}
		}
		function writeHistoryStore(store) {
			try {
				localStorage.setItem(HISTORY_KEY, JSON.stringify(store));
			} catch {}
		}
		/**
		 * Over-capacity prune: drop whole oldest chains first (the newest chain is
		 * never dropped wholesale), then trim tail entries one by one, re-parenting
		 * their children so every surviving chain stays walkable.
		 */
		function pruneEntries(entries) {
			if (entries.length <= HISTORY_MAX) return entries;
			var roots = [];
			var seen = {};
			for (var i = 0; i < entries.length; i++) {
				var r = entries[i].rootId || entries[i].id;
				if (!seen[r]) {
					seen[r] = true;
					roots.push(r);
				}
			}
			var dropped = {};
			var remaining = entries.length;
			for (var k = roots.length - 1; k >= 1 && remaining > HISTORY_MAX; k--) {
				var size = 0;
				for (var i2 = 0; i2 < entries.length; i2++) if ((entries[i2].rootId || entries[i2].id) === roots[k]) size++;
				remaining -= size;
				dropped[roots[k]] = true;
			}
			var result = [];
			for (var i3 = 0; i3 < entries.length; i3++) {
				if (!dropped[entries[i3].rootId || entries[i3].id]) result.push(entries[i3]);
			}
			while (result.length > HISTORY_MAX) {
				var oldest = result.pop();
				for (var j = 0; j < result.length; j++) {
					if (result[j].parentId === oldest.id) {
						result[j].parentId = oldest.parentId || null;
						if (result[j].parentId === null) result[j].rootId = result[j].id;
					}
				}
			}
			return result;
		}
		function appendEntry(store, entry) {
			return {
				schemaVersion: HISTORY_SCHEMA,
				consent: store.consent,
				entries: pruneEntries([entry].concat(store.entries))
			};
		}
		/** Remove one version; its children splice up to the removed node's parent. */
		function dropEntry(entries, id) {
			var removed = null;
			var next = [];
			for (var i = 0; i < entries.length; i++) {
				if (entries[i].id === id) removed = entries[i];
				else next.push(entries[i]);
			}
			if (removed === null) return entries;
			for (var j = 0; j < next.length; j++) {
				if (next[j].parentId === id) {
					next[j].parentId = removed.parentId;
					if (next[j].parentId === null) next[j].rootId = next[j].id;
				}
			}
			return next;
		}
		function dropChain(entries, rootId) {
			return entries.filter(function(entry) {
				return entry.rootId !== rootId;
			});
		}
		/** One chain, oldest first: 原稿 → 每一次润色. */
		function chainOf(entries, rootId) {
			var chain = [];
			for (var i = 0; i < entries.length; i++) {
				if (entries[i].rootId === rootId) chain.push(entries[i]);
			}
			return chain.reverse();
		}
		/** Token sentence used by the result area, history cards and 对比. */
		function usageText(usage) {
			if (usage && typeof usage.inputTokens === "number" && typeof usage.outputTokens === "number") {
				return "本次 " + usage.inputTokens + " 输入 + " + usage.outputTokens + " 输出 = " + (typeof usage.totalTokens === "number" ? usage.totalTokens : usage.inputTokens + usage.outputTokens) + " tokens";
			}
			return "本次用量未提供";
		}
		/** Local "Sep 28 14:03" stamp without leaning on locale surprises. */
		function formatWhen(ms) {
			var d = new Date(ms);
			var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			var pad = function(n) {
				return (n < 10 ? "0" : "") + n;
			};
			return months[d.getMonth()] + " " + d.getDate() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
		}
		/**
		 * 智能火苗的判分：纯本地、纯字符串，绝不调用模型。
		 * 分数越高代表草稿越可能“没说清”，达到阈值火才烧起来：
		 *   burn ≥ 4：短、缺动作/背景/输出形式或用词模糊，最值得润色；
		 *   ember 2-3：介于两者之间，火调暗；
		 *   quiet：空草稿、长而完整的草稿，或者刚润色过的同一份文本。
		 */
		var HINT_INTENT = /帮我|请|给我|写一|写个|做个|来一|生成|翻译|总结|分析|优化|起草|列出|设计|实现|检查|改写|润色|回答|解释|评估|编写|拟/;
		var HINT_OUTPUT = /格式|表格|列表|要点|步骤|json|JSON|Markdown|markdown|字数|字以内|字左右|正式|口语|风格|结构|分点|大纲|一段|一篇|条理/;
		var HINT_CONTEXT = /背景|目标|因为|由于|需要|用途|场景|对象|受众|上周|本周|今天|明天|昨天|项目|公司|客户|领导|老师|数据|主题|题目|时间/;
		var HINT_VAGUE = /随便|简单写|大概|看看|试试|优化一下|来一个|帮我写个|写个.{0,6}就行/;
		function scoreDraft(text) {
			var raw = typeof text === "string" ? text : "";
			if (raw.trim() === "") return { level: "quiet", score: 0, reasons: [] };
			var compact = raw.replace(/\s+/g, "");
			var score = 0;
			var reasons = [];
			if (compact.length < 80) {
				score += 2;
				reasons.push("内容较短");
			}
			if (!HINT_INTENT.test(raw)) {
				score += 1;
				reasons.push("没有明确的动作要求");
			}
			if (!HINT_OUTPUT.test(raw)) {
				score += 1;
				reasons.push("没有说清输出形式");
			}
			if (!HINT_CONTEXT.test(raw)) {
				score += 1;
				reasons.push("缺少背景或对象");
			}
			if (HINT_VAGUE.test(raw)) {
				score += 2;
				reasons.push("要求比较模糊");
			}
			if (compact.length > 600) {
				score -= 3;
				reasons.push("内容已经比较完整");
			}
			var level = score >= 4 ? "burn" : score >= 2 ? "ember" : "quiet";
			return { level: level, score: score, reasons: reasons };
		}
		/**
		 * 结构变化：确定性的前后对照，行级 LCS 加上“目标/背景/约束/输出格式”
		 * 四个角色标记的有无——全部本地计算，展示为“本机分析”，绝不冒充模型判断。
		 */
		var DIFF_LINE_CAP = 400;
		function splitLines(text) {
			var t = String(text === void 0 || text === null ? "" : text).replace(/\r\n?/g, "\n").replace(/\s+$/, "");
			return t === "" ? [] : t.split("\n");
		}
		function lineDiffCounts(a, b) {
			if (a.length > DIFF_LINE_CAP || b.length > DIFF_LINE_CAP) {
				return { added: Math.max(0, b.length - a.length), removed: Math.max(0, a.length - b.length), approximate: true };
			}
			var n = a.length;
			var m = b.length;
			var width = m + 1;
			var table = new Int32Array((n + 1) * width);
			for (var i = n - 1; i >= 0; i--) {
				var row = i * width;
				var below = row + width;
				for (var j = m - 1; j >= 0; j--) {
					table[row + j] = a[i] === b[j] ? table[below + j + 1] + 1 : Math.max(table[below + j], table[row + j + 1]);
				}
			}
			var common = 0;
			var x = 0;
			var y = 0;
			while (x < n && y < m) {
				if (a[x] === b[y]) {
					common++;
					x++;
					y++;
				} else if (table[(x + 1) * width + y] >= table[x * width + y + 1]) {
					x++;
				} else {
					y++;
				}
			}
			return { added: m - common, removed: n - common, approximate: false };
		}
		var STRUCT_ROLES = [
			["goal", "目标/动作", /帮我|请|给我|目标是|需要你|你要|任务|帮我做/],
			["context", "背景", /背景|上下文|因为|由于|对象|受众|场景|用途|上周|本周|今天|数据|项目/],
			["constraints", "约束", /不要|不能|必须|限制|不超过|至少|避免|禁止|只能|仅限/],
			["format", "输出格式", /格式|表格|列表|要点|步骤|json|JSON|Markdown|markdown|字数|分点|大纲|一段|正式|口语/]
		];
		function analyzeChange(before, after) {
			var a = splitLines(before);
			var b = splitLines(after);
			var counts = lineDiffCounts(a, b);
			var beforeText = typeof before === "string" ? before : "";
			var afterText = typeof after === "string" ? after : "";
			var gained = [];
			var lost = [];
			for (var i = 0; i < STRUCT_ROLES.length; i++) {
				var role = STRUCT_ROLES[i];
				var had = role[2].test(beforeText);
				var has = role[2].test(afterText);
				if (!had && has) gained.push(role[1]);
				else if (had && !has) lost.push(role[1]);
			}
			return {
				beforeChars: beforeText.replace(/\s+/g, "").length,
				afterChars: afterText.replace(/\s+/g, "").length,
				addedLines: counts.added,
				removedLines: counts.removed,
				approximate: counts.approximate,
				gained: gained,
				lost: lost
			};
		}
		function formatWhen(ms) {
			var d = new Date(ms);
			var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			var pad = function(n) {
				return (n < 10 ? "0" : "") + n;
			};
			return months[d.getMonth()] + " " + d.getDate() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
		}
		/**
		 * Ask the host half which models the panel may pin.
		 * @returns the current selection plus provider-grouped models.
		 */
		async function fetchModels() {
			var response = await fetch(MODELS_ROUTE, {
				method: "GET",
				credentials: "same-origin"
			});
			if (!response.ok) throw new Error("HTTP " + response.status);
			return await response.json();
		}
		/**
		 * Module-level catalog cache with a short TTL + in-flight dedup.
		 *
		 * Every composer mount used to re-fetch `/models`, so switching sessions
		 * re-paid the round trip even though the template half of the answer never
		 * changes within a run. 30s keeps the model half fresh enough for a
		 * mid-session provider addition while making re-mounts instant, and the
		 * shared promise stops two composers mounting at once from firing twice.
		 * Failures are NOT cached: the next mount retries.
		 */
		var CATALOG_TTL_MS = 30000;
		var catalogCache = null;
		var catalogInflight = null;
		function loadCatalog() {
			if (catalogCache !== null && Date.now() - catalogCache.at < CATALOG_TTL_MS) return Promise.resolve(catalogCache.data);
			if (catalogInflight === null) {
				catalogInflight = fetchModels().then(function(data) {
					catalogCache = {
						at: Date.now(),
						data
					};
					catalogInflight = null;
					return data;
				}, function(cause) {
					catalogInflight = null;
					throw cause;
				});
			}
			return catalogInflight;
		}
		/**
		 * The tab row and the template picker are NOT hardcoded here. They come from
		 * `GET ${MODELS_ROUTE}`, which mirrors the host's own template library, so a
		 * new template or a new `optimizationMode` cannot drift out of sync with the
		 * ids the optimize route will accept.
		 */
		/**
		 * Stream one optimization from the host half.
		 * @param body - the request payload.
		 * @param onDelta - called per received text delta.
		 * @param signal - aborts the run.
		 * @returns the final text and the model that produced it.
		 */
		async function stream(body, onDelta, signal) {
			var response = await fetch(OPTIMIZE_ROUTE, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
				credentials: "same-origin",
				signal
			});
			if (!response.ok) {
				var detail = "";
				try {
					var failure = await response.json();
					detail = typeof failure.message === "string" ? failure.message : "";
				} catch {}
				throw new Error(detail !== "" ? detail : "请求失败（HTTP " + response.status + "）");
			}
			var reader = response.body.getReader();
			var decoder = new TextDecoder();
			var buffer = "";
			var finalText = "";
			var model = "";
			var usage = null;
			while (true) {
				var _ref = await reader.read(), done = _ref.done, value = _ref.value;
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				var lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (var _i = 0, _lines = lines; _i < _lines.length; _i++) {
					var line = _lines[_i];
					if (line.trim() === "") continue;
					var event = void 0;
					try {
						event = JSON.parse(line);
					} catch {
						continue;
					}
					if (event.type === "delta") {
						finalText += event.text;
						onDelta(event.text);
					} else if (event.type === "error") {
						throw new Error(event.message || "优化失败");
					} else if (event.type === "done") {
						finalText = event.text;
						model = event.model || "";
						usage = event.usage && typeof event.usage === "object" ? event.usage : null;
					}
				}
			}
			if (finalText.trim() === "") throw new Error("模型没有返回可用内容。");
			return {
				text: finalText,
				model,
				usage
			};
		}
		/**
		 * One non-streaming call: ask the host to find the parameterisable spans in a
		 * finished prompt. The host answers with the parsed list AND the templated
		 * text, because substituting the spans needs the occurrence arithmetic that
		 * lives server-side; a wrong offset there would silently rewrite the prompt.
		 * @param promptContent - the text to analyse.
		 * @param pin - optional `{ provider, model }` override.
		 * @param signal - aborts the request.
		 * @returns `{ variables, summary, templated, model }`.
		 */
		async function extractVariables(promptContent, pin, signal) {
			var body = { promptContent };
			if (pin !== null) {
				body.provider = pin.provider;
				body.model = pin.model;
			}
			var response = await fetch(EXTRACT_ROUTE, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
				credentials: "same-origin",
				signal
			});
			var payload = void 0;
			try {
				payload = await response.json();
			} catch {}
			if (!response.ok) {
				var detail = payload && typeof payload.message === "string" ? payload.message : "";
				throw new Error(detail !== "" ? detail : "提取失败（HTTP " + response.status + "）");
			}
			return payload;
		}
		//#endregion
		//#region view.js
		/**
		 * The composer seat beside the model selector, and the panel it opens.
		 *
		 * Reads and writes the draft through the slot's own session props, so the
		 * button always acts on the composer it is rendered in — including a
		 * subagent composer — without holding a session id of its own.
		 * @param props - the session slot props (`useInput`, `inputActions`).
		 */
		function PromptPolish(props) {
			ensureStyle();
			var useInput = props.useInput;
			var inputActions = props.inputActions;
			var draft = typeof useInput === "function" ? useInput(function(state) {
				return state.draft;
			}) : "";
			var draftRef = useRef(draft);
			draftRef.current = draft;
			var _s1 = useState(false), open = _s1[0], setOpen = _s1[1];
			var _s2 = useState("system"), mode = _s2[0], setMode = _s2[1];
			var _s2b = useState(""), templateId = _s2b[0], setTemplateId = _s2b[1];
			var _s3 = useState(""), feedback = _s3[0], setFeedback = _s3[1];
			var _s4 = useState(""), result = _s4[0], setResult = _s4[1];
			var _s5 = useState("idle"), status = _s5[0], setStatus = _s5[1];
			var _s6 = useState(""), error = _s6[0], setError = _s6[1];
			var _s7 = useState(""), modelUsed = _s7[0], setModelUsed = _s7[1];
			var _s9 = useState(null), anchor = _s9[0], setAnchor = _s9[1];
			var _s10 = useState(readPin), pin = _s10[0], setPin = _s10[1];
			var _s11 = useState(null), catalog = _s11[0], setCatalog = _s11[1];
			/** Extraction result for the current output, or null when not extracted. */
			var _s12 = useState(null), vars = _s12[0], setVars = _s12[1];
			var _s13 = useState(false), extracting = _s13[0], setExtracting = _s13[1];
			/** Token usage reported by the stream's usage chunk; null when absent. */
			var _s14 = useState(null), usage = _s14[0], setUsage = _s14[1];
			/** Wall-clock ms of the last finished run; 0 until one finishes. */
			var _s15 = useState(0), elapsedMs = _s15[0], setElapsedMs = _s15[1];
			/** Transient "已复制" feedback on the result-area copy button. */
			var _s16 = useState(""), copied = _s16[0], setCopied = _s16[1];
			/** Whether the panel body is showing history instead of the live run. */
			var _s17 = useState(false), historyOpen = _s17[0], setHistoryOpen = _s17[1];
			/** Retained slot: superseded by the v2 store state right below. */
			var _s18 = useState(null), historyLegacy = _s18[0], setHistory = _s18[1];
			/** Id of the one expanded record, or "" when collapsed. */
			var _s19 = useState(0), openId = _s19[0], setOpenId = _s19[1];
			/**
			 * The persisted history envelope (consent + entries), kept in state so
			 * consent changes and new runs re-render in the same tick they persist.
			 */
			var _s20 = useState(readHistoryStore), store = _s20[0], setStore = _s20[1];
			/** Consent card stays up until the user picks 开启/不保存. */
			var _s21 = useState(store.consent === "unknown"), consentOpen = _s21[0], setConsentOpen = _s21[1];
			/** Which chain the 对比 view walks, and whether it is open at all. */
			var _s22 = useState(""), chainView = _s22[0], setChainView = _s22[1];
			/** 对比's middle column: which version sits next to 原稿. */
			var _s23 = useState(""), cmpId = _s23[0], setCmpId = _s23[1];
			/**
			 * Draft-quality scoring stays available (exported as __scoreDraft and kept
			 * under test); the visual design settled on the always-lit flame, so the
			 * hint state is computed only for the tooltip experiment, not the render.
			 */
			var hintLevel = scoreDraft(draft).level;
			/** The version chain 对比 walks; "" until the user opens it. */
			var chain = useMemo(function() {
				if (chainView === "") return [];
				return chainOf(store.entries, chainView);
			}, [chainView, store.entries]);
			/** 对比's middle column falls back to the newest version of the chain. */
			var cmpEntry = useMemo(function() {
				if (chain.length === 0) return null;
				for (var i = 0; i < chain.length; i++) if (chain[i].id === cmpId) return chain[i];
				return chain[chain.length - 1];
			}, [chain, cmpId]);
			/** 原稿 = the chain's first entry's input; 对比 needs at least one version. */
			var cmpOriginal = chain.length > 0 ? chain[0].input : "";
			var cmpAnalysis = useMemo(function() {
				if (cmpEntry === null) return null;
				return analyzeChange(cmpOriginal, cmpEntry.output);
			}, [cmpOriginal, cmpEntry]);
			/** Chain-level token sentence; honest when some runs lack usage. */
			var cmpUsage = useMemo(function() {
				var input = 0;
				var output = 0;
				var total = 0;
				var missing = 0;
				for (var i = 0; i < chain.length; i++) {
					var u = chain[i].usage;
					if (u && typeof u.inputTokens === "number" && typeof u.outputTokens === "number") {
						input += u.inputTokens;
						output += u.outputTokens;
						total += typeof u.totalTokens === "number" ? u.totalTokens : u.inputTokens + u.outputTokens;
					} else {
						missing++;
					}
				}
				if (chain.length === 0) return "";
				if (missing > 0) return "整条链共 " + missing + " 次未提供用量（部分模型不上报），其余 " + (input + output) + " tokens";
				return "整条链共 " + input + " 输入 + " + output + " 输出 = " + total + " tokens";
			}, [chain]);
			var seatRef = useRef(null);
			var panelRef = useRef(null);
			var abortRef = useRef(null);
			var extractRef = useRef(null);
			var copyTimerRef = useRef(null);
			/** Split "provider/model" into the pair the host half expects. */
			var pinned = useMemo(function() {
				var at = pin.indexOf("/");
				if (pin === "" || at <= 0) return null;
				return {
					provider: pin.slice(0, at),
					model: pin.slice(at + 1)
				};
			}, [pin]);
			/** Load the picker once per session; a failure just leaves it empty. */
			/**
			 * Fetched on mount, not on first open: the seat's click also starts a run in
			 * the same tick, and that run needs a template. Waiting for the panel would
			 * make the very first click fail with "catalog not loaded" for no reason.
			 */
			useEffect(function() {
				if (catalog !== null) return;
				var cancelled = false;
				loadCatalog().then(function(data) {
					if (!cancelled) setCatalog(data);
				}, function() {
					if (!cancelled) setCatalog({
						current: null,
						groups: [],
						modes: [],
						templates: []
					});
				});
				return function() {
					cancelled = true;
				};
			}, [catalog]);
			/** Templates the server offers for the selected `optimizationMode`. */
			var family = useMemo(function() {
				var list = catalog === null || catalog.templates === void 0 ? [] : catalog.templates;
				return list.filter(function(entry) {
					return entry.optimizationMode === mode;
				});
			}, [catalog, mode]);
			/** Falls back to the family's first entry so a stale id never blocks a run. */
			var template = useMemo(function() {
				for (var i = 0; i < family.length; i++) {
					if (family[i].id === templateId) return family[i];
				}
				return family.length > 0 ? family[0] : null;
			}, [family, templateId]);
			/** The text a run should optimize: the draft, or the last result when iterating. */
			var sourceFor = useCallback(function(nextMode) {
				if (nextMode === "iterate" && result !== "") return result;
				return draftRef.current ?? "";
			}, [result]);
			var place = useCallback(function() {
				var seat = seatRef.current;
				if (seat === null) return;
				var box = seat.getBoundingClientRect();
				var width = Math.min(560, window.innerWidth - 24);
				var left = Math.max(12, Math.min(box.left - 8, window.innerWidth - width - 12));
				setAnchor({
					left,
					width,
					bottom: Math.max(12, window.innerHeight - box.top + 8)
				});
			}, []);
			useEffect(function() {
				if (!open) return;
				place();
				var onMove = function() {
					place();
				};
				var onKey = function(event) {
					if (event.key === "Escape") close();
				};
				var onDown = function(event) {
					var target = event.target;
					if (panelRef.current !== null && panelRef.current.contains(target)) return;
					if (seatRef.current !== null && seatRef.current.contains(target)) return;
					close();
				};
				function close() {
					setOpen(false);
				}
				window.addEventListener("resize", onMove);
				window.addEventListener("keydown", onKey);
				window.addEventListener("mousedown", onDown, true);
				return function() {
					window.removeEventListener("resize", onMove);
					window.removeEventListener("keydown", onKey);
					window.removeEventListener("mousedown", onDown, true);
				};
			}, [open, place]);
			var stop = useCallback(function() {
				if (abortRef.current !== null) abortRef.current.abort();
			}, []);
			useEffect(function() {
				return stop;
			}, [stop]);
			var run = useCallback(function(nextMode, nextTemplate) {
				if (nextTemplate === null) {
					setError("模板目录还没载入，请稍后重试。");
					return;
				}
				var source = sourceFor(nextMode);
				if (typeof source !== "string" || source.trim() === "") {
					setError("输入框里还没有内容可润色。");
					setResult("");
					return;
				}
				if (nextMode === "iterate" && feedback.trim() === "") {
					setError("迭代优化要先填改进意见。");
					setResult("");
					return;
				}
				setError("");
				setResult("");
				setModelUsed("");
				setVars(null);
				setUsage(null);
				setElapsedMs(0);
				setHistoryOpen(false);
				setStatus("running");
				setOpen(true);
				var startedAt = Date.now();
				var controller = new AbortController();
				abortRef.current = controller;
				var carried = "";
				/**
				 * Delta batching. One `setResult` per token re-rendered the whole panel
				 * per token (bench: 300 deltas → 310 renders); a reasoning model at
				 * 50-100 tok/s turns that into visible stutter. Flush at most every
				 * 60ms instead — still far faster than the eye reads — and let the
				 * terminal handlers write the exact final text unconditionally, so
				 * throttling can never cost accuracy or strand the tail on abort.
				 */
				var flushTimer = null;
				var dropFlush = function() {
					if (flushTimer !== null) {
						clearTimeout(flushTimer);
						flushTimer = null;
					}
				};
				/**
				 * The wire is upstream's `OptimizationRequest`, not a bag of template
				 * variables: `targetPrompt` is always the text being optimized, and the
				 * iterate family names its two extra inputs explicitly. Which slot each
				 * template reads is the server's business — it renders the template.
				 */
				var body = {
					optimizationMode: nextMode,
					targetPrompt: source,
					templateId: nextTemplate.id
				};
				if (nextMode === "iterate") {
					body.lastOptimizedPrompt = result !== "" ? result : source;
					body.iterateInput = feedback;
				}
				if (pinned !== null) {
					body.provider = pinned.provider;
					body.model = pinned.model;
				}
				stream(body, function(text) {
					carried += text;
					if (flushTimer === null) {
						flushTimer = setTimeout(function() {
							flushTimer = null;
							setResult(carried);
						}, 60);
					}
				}, controller.signal).then(function(out) {
					dropFlush();
					setResult(out.text);
					setModelUsed(out.model);
					setUsage(out.usage);
					setElapsedMs(Date.now() - startedAt);
					setStatus("done");
					/**
					 * A finished run becomes a version: granted persists it, unknown
					 * raises the consent card and keeps the run in memory only, declined
					 * keeps nothing. Iterating a previous version links parent/root so
					 * 对比 and 删除整条链 operate on the real chain.
					 */
					var entry = {
						id: newEntryId(),
						at: Date.now(),
						mode: nextMode,
						template: nextTemplate.label || nextTemplate.id,
						templateId: nextTemplate.id,
						model: out.model,
						input: clip(source),
						output: clip(out.text),
						usage: out.usage !== null && out.usage !== void 0 ? { inputTokens: out.usage.inputTokens, outputTokens: out.usage.outputTokens, totalTokens: out.usage.totalTokens } : void 0,
						elapsedMs: Date.now() - startedAt,
						source: "run"
					};
					if (baseEntry !== null && nextMode === "iterate") {
						entry.parentId = baseEntry.id;
						entry.rootId = baseEntry.rootId;
					} else {
						entry.parentId = null;
						entry.rootId = entry.id;
						lastRunIdRef.current = entry.id;
					}
					if (store.consent === "granted") {
						var nextStore = appendEntry(store, entry);
						writeHistoryStore(nextStore);
						setStore(nextStore);
					} else if (store.consent === "unknown") {
						/** Hold the pending entry aside; it lands on disk only if granted. */
						pendingEntryRef.current = entry;
						setConsentOpen(true);
					}
				}, function(cause) {
					dropFlush();
					if (controller.signal.aborted) {
						/** A stopped run keeps whatever already arrived, tail included. */
						if (carried !== "") {
							setResult(carried);
							setElapsedMs(Date.now() - startedAt);
						}
						setStatus(carried !== "" ? "done" : "idle");
						return;
					}
					if (carried !== "") setResult(carried);
					setElapsedMs(Date.now() - startedAt);
					setError(cause instanceof Error ? cause.message : String(cause));
					setStatus("error");
				}).finally(function() {
					if (abortRef.current === controller) abortRef.current = null;
				});
			}, [feedback, result, sourceFor, pinned, store, baseEntry]);
			var choose = useCallback(function(nextMode) {
				setMode(nextMode);
				setError("");
				var list = catalog === null || catalog.templates === void 0 ? [] : catalog.templates.filter(function(entry) {
					return entry.optimizationMode === nextMode;
				});
				/**
				 * First pick is the server's documented default for the family
				 * (`catalog.defaults`, e.g. 专业优化 for user prompts per the upstream
				 * quick-start), falling back to list order — never a client-side
				 * hardcoded id, so the server stays the single source of truth.
				 */
				var preferred = catalog !== null && catalog.defaults !== void 0 ? catalog.defaults[nextMode] : void 0;
				var next = null;
				if (typeof preferred === "string") {
					for (var i = 0; i < list.length; i++) {
						if (list[i].id === preferred) {
							next = list[i];
							break;
						}
					}
				}
				if (next === null && list.length > 0) next = list[0];
				setTemplateId(next === null ? "" : next.id);
				// Iterate needs the revision note first, so it waits for the run button.
				if (nextMode !== "iterate" && next !== null) run(nextMode, next);
			}, [run, catalog]);
			/** Picking another template in the same family re-runs, like the tabs do. */
			var pickTemplate = useCallback(function(entry) {
				setTemplateId(entry.id);
				setError("");
				if (mode !== "iterate") run(mode, entry);
			}, [mode, run]);
			var accept = useCallback(function() {
				if (result === "" || inputActions === void 0) return;
				inputActions.setDraft(result);
				setOpen(false);
				setResult("");
				setVars(null);
				setStatus("idle");
			}, [inputActions, result]);
			/**
			 * Write the result back and submit it in one go.
			 *
			 * Calling `submit()` immediately after `setDraft()` is safe: the draft write
			 * is a discrete Lexical update, which flushes its update listener — and with
			 * it `projection.clipboardText`, the field `submit()` reads — before returning.
			 * `submit()` takes the composer's normal Enter path, so while a turn is
			 * running the message queues instead of interrupting it.
			 */
			var send = useCallback(function() {
				if (result === "" || inputActions === void 0) return;
				inputActions.setDraft(result);
				inputActions.submit();
				setOpen(false);
				setResult("");
				setVars(null);
				setStatus("idle");
			}, [inputActions, result]);
			/**
			 * Ask the host which spans of the current output are parameterisable. Its
			 * own call with its own template — not a mode of the optimizer, matching
			 * upstream's separate `VariableExtractionService`.
			 */
			var extract = useCallback(function() {
				if (result === "" || extracting) return;
				setError("");
				setVars(null);
				setExtracting(true);
				var controller = new AbortController();
				extractRef.current = controller;
				extractVariables(result, pinned, controller.signal).then(function(out) {
					setVars(out);
				}, function(cause) {
					if (controller.signal.aborted) return;
					setError(cause instanceof Error ? cause.message : String(cause));
				}).finally(function() {
					setExtracting(false);
					if (extractRef.current === controller) extractRef.current = null;
				});
			}, [result, pinned, extracting]);
			/**
			 * Write the slot-substituted text back. Deliberately does not send: a
			 * templated prompt is a draft with holes, and the point of extracting
			 * variables is to keep editing it.
			 */
			var applyTemplate = useCallback(function() {
				if (vars === null || typeof vars.templated !== "string" || inputActions === void 0) return;
				inputActions.setDraft(vars.templated);
				setOpen(false);
				setResult("");
				setVars(null);
			}, [inputActions, vars]);
			/**
			 * Copy the finished result to the clipboard — the doc-level 「优化并复制
			 * 结果」 action: upstream's result workspace carries its own copy button,
			 * and this one touches neither the draft nor the send queue. Purely
			 * additive; falls back to the legacy execCommand path for renderers
			 * without the async Clipboard API.
			 */
			/**
			 * Copy any text to the clipboard; `flash` names which button should
			 * briefly show 已复制 ✓. Falls back to the legacy execCommand path for
			 * renderers without the async Clipboard API.
			 */
			var copyText = useCallback(function(text, flash) {
				if (typeof text !== "string" || text === "") return;
				var mark = function() {
					setCopied(flash);
					if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
					copyTimerRef.current = setTimeout(function() {
						copyTimerRef.current = null;
						setCopied("");
					}, 1500);
				};
				var fail = function() {
					setError("复制到剪贴板失败，请手动选中结果文本复制。");
				};
				var legacy = function() {
					try {
						var ta = document.createElement("textarea");
						ta.value = text;
						ta.style.position = "fixed";
						ta.style.opacity = "0";
						document.body.appendChild(ta);
						ta.select();
						var ok = document.execCommand("copy");
						document.body.removeChild(ta);
						if (ok) mark();
						else fail();
					} catch {
						fail();
					}
				};
				if (typeof navigator !== "undefined" && navigator.clipboard !== void 0 && typeof navigator.clipboard.writeText === "function") {
					navigator.clipboard.writeText(text).then(mark, legacy);
				} else {
					legacy();
				}
			}, []);
			var copyResult = useCallback(function() {
				copyText(result, "result");
			}, [copyText, result]);
			/** 开启本机历史：之前的记录（含授权前那次）一起落盘。 */
			var grantConsent = useCallback(function() {
				var base = pendingEntryRef.current !== null ? appendEntry(store, pendingEntryRef.current) : store;
				pendingEntryRef.current = null;
				var nextStore = { schemaVersion: HISTORY_SCHEMA, consent: "granted", entries: pruneEntries(base.entries) };
				writeHistoryStore(nextStore);
				setStore(nextStore);
				setConsentOpen(false);
			}, [store]);
			/** 不保存：清掉待定记录，之后也不再弹询问；历史视图里可重新开启。 */
			var declineConsent = useCallback(function() {
				pendingEntryRef.current = null;
				var nextStore = { schemaVersion: HISTORY_SCHEMA, consent: "declined", entries: [] };
				writeHistoryStore(nextStore);
				setStore(nextStore);
				setConsentOpen(false);
				setOpenId("");
				setChainView("");
			}, []);
			/** 删除单个版本：子版本上移一位，链条保持可走。 */
			var dropHistoryEntry = useCallback(function(id) {
				var next = dropEntry(store.entries, id);
				var nextStore = { schemaVersion: HISTORY_SCHEMA, consent: store.consent, entries: next };
				writeHistoryStore(nextStore);
				setStore(nextStore);
				if (openId === id) setOpenId("");
				if (chainView !== "" && chainOf(next, chainView).length === 0) setChainView("");
			}, [store, openId, chainView]);
			/** 清空全部：只清记录，不改授权状态。 */
			var wipeHistory = useCallback(function() {
				var nextStore = { schemaVersion: HISTORY_SCHEMA, consent: store.consent, entries: [] };
				writeHistoryStore(nextStore);
				setStore(nextStore);
				setOpenId("");
				setChainView("");
			}, [store]);
			/** 打开某条链的对比视图；中间列默认最新版本。 */
			var openCompare = useCallback(function(rootId) {
				setChainView(rootId);
				setCmpId("");
				setError("");
			}, []);
			/** 把历史里的某个版本写回输入框（不发送），面板收起。 */
			var restoreVersion = useCallback(function(entry) {
				if (inputActions === void 0 || typeof entry.output !== "string" || entry.output === "") return;
				inputActions.setDraft(entry.output);
				setOpen(false);
			}, [inputActions]);
			/**
			 * The version an iterate run builds on: the entry the panel last produced
			 * (matched by output), or the one restored from history. A fresh draft run
			 * starts a new chain.
			 */
			var baseEntry = useMemo(function() {
				if (result === "") return null;
				for (var j = store.entries.length - 1; j >= 0; j--) {
					if (store.entries[j].output === result) return store.entries[j];
				}
				return null;
			}, [result, store.entries]);
			var lastRunIdRef = useRef(null);
			/** The not-yet-persisted run waiting on the consent decision. */
			var pendingEntryRef = useRef(null);
			var busy = status === "running";
			/**
			 * The disable reason rides on the button itself — upstream's troubleshooting
			 * doc treats "为什么是灰的" as a first-class question, so a disabled control
			 * must name what is missing (empty draft / no feedback / catalog not loaded)
			 * instead of failing silently on click.
			 */
			var sourceNow = sourceFor(mode);
			var runBlock = template === null ? "模板目录还没载入" : typeof sourceNow !== "string" || sourceNow.trim() === "" ? "输入框里还没有内容可润色" : mode === "iterate" && feedback.trim() === "" ? "先填改进意见，再点开始迭代" : "";
			var canRun = runBlock === "";
			/** Doc-aligned result metadata: model, wall time, size, token usage. */
			var metaText = "";
			if (busy) {
				metaText = "生成中…";
			} else if (modelUsed !== "") {
				metaText = "模型 " + modelUsed;
				if (elapsedMs > 0) metaText += " · 耗时 " + (elapsedMs / 1000).toFixed(1) + "s";
				if (result !== "") metaText += " · " + result.length + " 字";
				if (usage !== null && typeof usage.inputTokens === "number" && typeof usage.outputTokens === "number") metaText += " · tok " + usage.inputTokens + "→" + usage.outputTokens;
			} else if (result !== "") {
				metaText = "已生成";
			}
			/**
			 * A living-flame seat, per the user's ask: it burns at rest — a warm
			 * radial body (red at the base, orange, a near-white core), two light
			 * layers breathing on offset 2.3s/3.9s cycles so the flicker never
			 * looks like a loop, and the whole pill brightening on a slower 3.4s
			 * breath. Hover hurries the fire up, a live run makes it dance fast.
			 * Fixed warm palette here on purpose: fire is warm in every theme;
			 * everything else in the panel still rides the theme tokens.
			 */
			var seat = h("span", {
				ref: seatRef,
				className: "pp-seatwrap",
				"data-open": open ? "1" : "0",
				"data-busy": busy ? "1" : "0"
			}, h("button", {
				type: "button",
				className: "pp-seat",
				title: "润色输入框里的提示词（生成后可选择写回或发送）",
				"aria-haspopup": "dialog",
				"aria-expanded": open,
				onMouseDown: function(event) {
					event.preventDefault();
					event.stopPropagation();
				},
				onClick: function() {
					if (busy) {
						setOpen(function(v) {
							return !v;
						});
						return;
					}
					if (open) {
						setOpen(false);
						return;
					}
					setOpen(true);
					run(mode, template);
				}
			}, h("span", { className: "pp-glyph" }, busy ? "⋯" : "✨"), h("span", null, busy ? "润色中" : "润色")), h("span", { className: "pp-seat-layer" }), h("span", { className: "pp-seat-layer" }), h("span", { className: "pp-seat-spark" }));
			if (!open) return seat;
			/**
			 * Polish model picker. Empty value means "follow the composer", which is
			 * the right default; the list exists so an image model in the composer
			 * does not silently break polishing.
			 */
			var picker = h("select", {
				key: "pp-model",
				className: "pp-sel",
				value: pin,
				disabled: busy,
				title: "润色用哪个模型（默认跟随输入框）",
				onChange: function(event) {
					setPin(event.target.value);
					writePin(event.target.value);
				}
			}, h("option", {
				value: ""
			}, catalog !== null && catalog.current ? "跟随当前 · " + catalog.current.model : "跟随当前模型"), catalog === null ? null : catalog.groups.map(function(group) {
				return h("optgroup", {
					key: group.provider,
					label: group.name
				}, group.models.map(function(entry) {
					return h("option", {
						key: group.provider + "/" + entry.id,
						value: group.provider + "/" + entry.id
					}, entry.name);
				}));
			}));
			var modes = catalog === null || catalog.modes === void 0 ? [] : catalog.modes;
			/**
			 * Which template the chosen `optimizationMode` will use. Rendered even when
			 * the family holds one entry: showing the active template is information,
			 * and a family that gains templates needs no markup change.
			 */
			var tplSelect = h("select", {
				key: "pp-template",
				className: "pp-sel",
				value: template === null ? "" : template.id,
				disabled: busy || family.length === 0,
				title: "使用哪个优化模板",
				onChange: function(event) {
					for (var i = 0; i < family.length; i++) {
						if (family[i].id === event.target.value) {
							pickTemplate(family[i]);
							return;
						}
					}
				}
			}, family.length === 0 ? h("option", { value: "" }, "无可用模板") : family.map(function(entry) {
				return h("option", { key: entry.id, value: entry.id }, entry.label);
			}));
			/**
			 * History view: one card per finished run, newest first. The collapsed
			 * head already answers "what did I polish when"; expanding shows the
			 * two things the user asked to be able to reread — the input at that
			 * time and the optimized output — plus per-record 复制 / 写回输入框 /
			 * 删除. Records survive reloads (localStorage), capped at 50.
			 */
			/** 授权卡：首次成功生成后、写入磁盘前问一次，只问这一次。 */
			var consentCard = h("div", { className: "pp-consent" }, h("p", null, "润色历史只保存在这台设备上：记录输入、结果、模型和 token 消耗，不上传。可随时在历史页清空或删除单条。"), h("div", { className: "pp-hrow" }, h("button", {
				type: "button", className: "pp-btn pp-mini", "data-primary": "1", title: "开始在本机保存润色历史", onClick: grantConsent
			}, "开启历史"), h("button", {
				type: "button", className: "pp-btn pp-mini", title: "不保存历史（也不会再询问；可在历史页重新开启）", onClick: declineConsent
			}, "不保存")));
			/**
			 * History view: consent card first when undecided, then one card per
			 * version, newest first. Expanded cards expose the run's tokens and the
			 * chain actions — 对比版本链 / 删除此版 / 删除整条链 — so the version
			 * story and its cleanup live where the versions live.
			 */
			var historyView = h("div", { className: "pp-body pp-hist" },
				(store.consent === "unknown" && store.entries.length > 0) || consentOpen ? consentCard : null,
				store.consent === "declined" ? h("div", { className: "pp-consent" }, h("p", null, "历史记录已关闭，本机没有保存任何润色内容。"), h("div", { className: "pp-hrow" }, h("button", { type: "button", className: "pp-btn pp-mini", title: "开始在本机保存润色历史", onClick: grantConsent }, "开启历史"))) : null,
				store.consent !== "declined" && store.entries.length === 0 ? h("p", { className: "pp-note" }, "还没有润色记录。每完成一次生成，这里会存一条：当时的输入、结果和 token 消耗，重启后也还在。") : null,
				store.entries.map(function(entry, index) {
					var on = openId === entry.id;
					var snippet = String(entry.input || "").replace(/\s+/g, " ").slice(0, 26);
					return h("div", {
						key: entry.id + "-" + index,
						className: "pp-hitem"
					}, h("div", {
						className: "pp-hhead",
						title: "展开看这次润色的输入、结果和 token 消耗",
						onClick: function() {
							setOpenId(on ? "" : entry.id);
						}
					}, h("span", { className: "pp-htime" }, formatWhen(entry.at)), h("span", { className: "pp-hwhat" }, (entry.template || "润色") + " · " + snippet + (snippet.length >= 26 ? "…" : "")), on ? null : h("button", {
						type: "button",
						className: "pp-btn pp-mini",
						title: "删除这一条记录（展开后还有更多操作）",
						onClick: function(event) {
							event.stopPropagation();
							dropHistoryEntry(entry.id);
						}
					}, "删除"), h("span", { className: "pp-harrow" }, on ? "收起 ▴" : "展开 ▾")), on ? h("div", { className: "pp-hbody" }, h("p", { className: "pp-hlabel" }, "当时的输入"), h("pre", { className: "pp-hpre" }, entry.input), h("p", { className: "pp-hlabel" }, "优化后的结果"), h("pre", { className: "pp-hpre" }, entry.output), h("p", { className: "pp-usage" }, usageText(entry.usage)), h("div", { className: "pp-hrow" }, h("button", {
						type: "button", className: "pp-btn pp-mini", title: "把这条结果复制到剪贴板",
						onClick: function() { copyText(entry.output, entry.id); }
					}, copied === entry.id ? "已复制 ✓" : "复制结果"), h("button", {
						type: "button", className: "pp-btn pp-mini", title: "把这条结果写回输入框（不发送，供你自己检查）",
						onClick: function() { restoreVersion(entry); }
					}, "写回输入框"), h("button", {
						type: "button", className: "pp-btn pp-mini", title: "原稿与各版本的并排对比，附本机结构分析",
						onClick: function() { openCompare(entry.rootId); }
					}, "对比版本链"), h("button", {
						type: "button", className: "pp-btn pp-mini", title: "删除这一条版本（它的下一条会接回上一版）",
						onClick: function() { dropHistoryEntry(entry.id); }
					}, "删除此版"), h("button", {
						type: "button", className: "pp-btn pp-mini", title: "删除这条链上的全部版本（含原稿）",
						onClick: function() { setStore({ schemaVersion: HISTORY_SCHEMA, consent: store.consent, entries: dropChain(store.entries, entry.rootId) }); writeHistoryStore({ schemaVersion: HISTORY_SCHEMA, consent: store.consent, entries: dropChain(store.entries, entry.rootId) }); if (chainView === entry.rootId) setChainView(""); }
					}, "删除整条链"))) : null);
				}), store.entries.length > 0 && store.consent === "granted" ? h("div", { className: "pp-hrow" }, h("button", {
					type: "button", className: "pp-btn pp-mini", title: "清空所有历史记录（授权保持不变）",
					onClick: wipeHistory
				}, "清空全部")) : null);
			/**
			 * 对比版本链：原稿 | 所选版本 | 最新版本，三列并排；窄面板自动叠放。
			 * 结构变化摘要是本机确定性计算（长度/行数/角色标记），不冒充模型判断。
			 */
			var compareView = cmpEntry === null ? null : h("div", { className: "pp-body" },
				h("div", { className: "pp-cmpbar" },
					h("button", { type: "button", className: "pp-btn pp-mini", title: "回到历史列表", onClick: function() { setChainView(""); } }, "← 历史"),
					h("span", { className: "pp-note", style: { margin: "0" } }, "对比版本链 · " + formatWhen(cmpEntry.at)),
					chain.length > 1 ? h("select", {
						className: "pp-sel", value: cmpEntry.id, style: { marginLeft: "auto", maxWidth: "180px" },
						title: "选中间列显示哪个版本", onChange: function(event) { setCmpId(event.target.value); }
					}, chain.map(function(entry, index) {
						return h("option", { key: entry.id, value: entry.id }, "v" + (index + 1) + " · " + formatWhen(entry.at));
					})) : null
				),
				h("div", { className: "pp-cmp", "data-stack": anchor !== null && anchor.width < 760 ? "1" : "0" },
					h("div", { className: "pp-ccol" }, h("div", { className: "pp-chead" }, h("span", { className: "pp-ctitle" }, "原稿"), h("span", { className: "pp-csize" }, cmpAnalysis.beforeChars + " 字")), h("pre", { className: "pp-cbody" }, cmpOriginal)),
					h("div", { className: "pp-ccol" }, h("div", { className: "pp-chead" }, h("span", { className: "pp-ctitle" }, "所选版本"), h("span", { className: "pp-csize" }, cmpAnalysis.afterChars + " 字")), h("pre", { className: "pp-cbody" }, cmpEntry.output)),
					h("div", { className: "pp-ccol" }, h("div", { className: "pp-chead" }, h("span", { className: "pp-ctitle" }, "最新版本"), h("span", { className: "pp-csize" }, (chain[chain.length - 1].output || "").replace(/\s+/g, "").length + " 字")), h("pre", { className: "pp-cbody" }, chain[chain.length - 1].output))
				),
				h("div", { className: "pp-csum" },
					h("b", null, "结构变化（本机分析）"), "：输入 " + cmpAnalysis.beforeChars + " 字 → " + cmpAnalysis.afterChars + " 字；新增 " + cmpAnalysis.addedLines + " 行，删除 " + cmpAnalysis.removedLines + " 行" + (cmpAnalysis.approximate ? "（超长文本按行数估算）" : "") + "。",
					cmpAnalysis.gained.length > 0 ? h("span", null, "补上了 " + cmpAnalysis.gained.join("、") + "。") : null,
					cmpAnalysis.lost.length > 0 ? h("span", null, "丢了 " + cmpAnalysis.lost.join("、") + "。") : null,
					cmpAnalysis.gained.length === 0 && cmpAnalysis.lost.length === 0 ? h("span", null, "目标/背景/约束/输出格式 的覆盖没有变化。") : null,
					h("span", null, cmpUsage)
				)
			);
			var panel = h("div", {
				ref: panelRef,
				className: "pp-panel",
				role: "dialog",
				"aria-label": "提示词润色",
				style: anchor === null ? {
					display: "none"
				} : {
					left: anchor.left,
					width: anchor.width,
					bottom: anchor.bottom
				},
				onMouseDown: function(event) {
					event.stopPropagation();
				}
			}, h("div", { className: "pp-head" }, h("div", { className: "pp-tabs" }, modes.length === 0 ? h("span", { className: "pp-tab" }, "载入中…") : modes.map(function(entry) {
				return h("button", {
					key: entry.id,
					type: "button",
					className: "pp-tab",
					"data-on": mode === entry.id ? "1" : "0",
					title: "优化对象是" + entry.label,
					disabled: busy,
					onClick: function() {
						choose(entry.id);
					}
				}, entry.label);
			})), tplSelect, h("span", { className: "pp-spacer" }), h("button", {
				type: "button",
				className: "pp-btn pp-mini",
				"data-on": historyOpen ? "1" : "0",
				title: historyOpen ? "收起历史，回到当前润色" : "查看历史的输入和优化结果（每次成功生成自动记一条）",
				onClick: function() {
					setHistoryOpen(!historyOpen);
					setError("");
				}
			}, "历史"), h("button", {
				type: "button",
				className: "pp-x",
				title: "关闭",
				onClick: function() {
					setOpen(false);
				}
			}, "×")), historyOpen && chainView !== "" && compareView !== null ? compareView : historyOpen ? historyView : h("div", { className: "pp-body" }, error !== "" ? h("div", { className: "pp-err" }, error) : null, (store.consent === "unknown" || consentOpen) && status === "done" ? consentCard : null, mode === "iterate" ? h("div", null, h("p", { className: "pp-note" }, "在当前版本上继续改进（必填：说明这次要改什么）"), h("textarea", {
				className: "pp-ta",
				value: feedback,
				placeholder: "例如：再简洁一些；补一个输出示例；把语气改成面向新手……",
				onChange: function(event) {
					setFeedback(event.target.value);
				}
			})) : null, result !== "" ? h("div", { className: "pp-outbar" }, h("button", {
				type: "button",
				className: "pp-btn pp-mini",
				title: "把润色结果复制到剪贴板（不改动输入框、不发送）",
				onClick: copyResult
			}, copied === "result" ? "已复制 ✓" : "复制草稿")) : null, result !== "" && !busy ? h("p", { className: "pp-usage" }, usageText(usage)) : null, h("div", { className: "pp-out", "data-placeholder": busy ? "正在生成……" : "还没有生成内容。" }, result, busy ? h("span", { className: "pp-caret" }) : null), extracting ? h("p", { className: "pp-note" }, "正在提取变量……") : null, vars !== null ? h("div", { className: "pp-vars" }, h("p", { className: "pp-note" }, vars.summary), h("ul", { className: "pp-vlist" }, (Array.isArray(vars.variables) ? vars.variables : []).map(function(entry, index) {
				return h("li", { key: `${entry.name}-${index}` }, h("code", null, `{{${entry.name}}}`), " = ", entry.value, entry.reason ? h("span", { className: "pp-vwhy" }, ` · ${entry.reason}`) : null);
			}))) : null), historyOpen ? null : h("div", { className: "pp-foot" }, h("span", { className: "pp-meta", title: metaText }, metaText), picker, h("span", { className: "pp-spacer" }), busy ? h("button", {
				type: "button",
				className: "pp-btn",
				title: "停止本次生成（已生成的部分会保留）",
				onClick: stop
			}, "停止") : h("button", {
				type: "button",
				className: "pp-btn",
				/**
				 * Must not require a previous result: entering the 迭代优化 family with
				 * nothing generated yet would otherwise be a dead end, even though
				 * iterating falls back to the draft as its base text. Disabled only for
				 * a missing precondition, and then the title names it.
				 */
				disabled: !canRun,
				title: canRun ? "按当前模板生成一版新的" : runBlock,
				onClick: function() {
					run(mode, template);
				}
			}, result === "" ? "开始优化" : "重新生成"), result !== "" && !busy ? h("button", {
				type: "button",
				className: "pp-btn",
				title: "把润色结果写回输入框并直接发送（输入框忙时按回车语义排队）",
				onClick: send
			}, "发送草稿") : null, result !== "" && !busy ? h("button", {
				type: "button",
				className: "pp-btn",
				disabled: extracting,
				title: "让模型指出这份结果里哪些部分可以参数化（另一次调用，用上游的变量提取模板）",
				onClick: extract
			}, extracting ? "提取中…" : "提取变量") : null, vars !== null ? h("button", {
				type: "button",
				className: "pp-btn",
				/**
				 * The list and the substitution are separate outcomes: a span that no
				 * longer matches the text still leaves useful variable names, so the
				 * panel keeps them and disables only the write-back, naming why.
				 */
				disabled: typeof vars.templated !== "string",
				title: typeof vars.templated === "string" ? "把提取出的片段替换成 {{变量}} 占位并写回输入框，不发送" : vars.templatedError || "模型给出的位置对不上原文，无法套成模板。",
				onClick: applyTemplate
			}, "写回模板") : null, h("button", {
				type: "button",
				className: "pp-btn",
				"data-primary": "1",
				title: "把润色结果写回输入框，不发送，供你自己检查后再按回车",
				disabled: result === "" || busy,
				onClick: accept
			}, "替换草稿")));
			return h("div", { style: { display: "contents" } }, seat, panel);
		}
		//#endregion
		var inject = ["slots"];
		/**
		 * Register the composer seat. Automatic priority places the button into the
		 * compact-control row that renders immediately before the model selector.
		 * @param ctx - the plugin context.
		 */
		function apply(ctx) {
			ctx.effect(function() {
				return ctx.slots.inject("conversation.input.right", function() {
					return ctx.slots.register({
						name: "conversation.input.right",
						id: "prompt-polish",
						order: 5
					}, PromptPolish);
				});
			}, "prompt-polish: composer seat");
		}
		/** Exposed for the contract test: the new features are pure logic worth driving directly. */
		exports.__scoreDraft = scoreDraft;
		exports.__analyzeChange = analyzeChange;
		exports.__usageText = usageText;
		exports.PromptPolish = PromptPolish;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
