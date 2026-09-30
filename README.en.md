# dsh-prompt-polish

You type "帮我写个周报" into DSH, hit Enter, and get a generic answer. You know the model *could* do it well — if only the prompt had a role, a goal, the data you have, and an output format. Writing all that out every time is the boring part.

This plugin adds a ✨ **润色 (Polish)** button right next to the model selector in the DSH composer. Click it, and your rough draft is rewritten in-place — streamed into a panel — into a structured prompt. You decide what happens next: write it back into the composer (default, nothing is sent), send it directly, or just copy it.

Nothing about the polish is silent: you see the result, the model that produced it, how long it took, and what it cost in tokens.

## What it actually does

**1. Rewrites your draft, you keep control.**
The optimized prompt lands in a panel, not in your composer. Three buttons decide its fate:
- **替换草稿** (Replace draft) — writes the result into the composer. Nothing is sent; you still read and edit it. This is the default path and the whole point: the AI prepared it, *you* pull the trigger.
- **发送草稿** (Send draft) — writes it back AND sends, one click fewer.
- **复制草稿** (Copy) — clipboard only.

**2. Knows the difference between a system prompt and a user prompt.**
The panel top row is not a style picker — it picks which *template family* rewrites your text: 系统提示词 (you are writing an AI's instructions), 用户提示词 (you are asking for work), or 迭代优化 (revise the previous result: make it shorter, add an example, tone it down for newbies — the revision note is required, and the button tells you so if you skip it).

**3. Shows what each polish cost.**
Every finished run reports: model, wall time, result length, and token usage (120 in + 45 out = 165 tokens) when the provider reports it. When the provider does not, it says not-provided — it never invents a zero.

**4. Keeps a local history you explicitly opt into.**
The first time a run finishes, a card asks: history stays on this device, contains inputs/results/models/tokens, and can be wiped anytime. 开启历史 saves; 不保存 keeps nothing and never nags again (re-enable any time from the History view). With consent, each run becomes a *version*, and revising a version chains them, so you can:
- re-read any run's original input, output, and token cost;
- open 对比版本链: original | selected | latest side by side, plus a local (deterministic, no-model-call) structural analysis — lines added/removed, and whether goal/background/constraints/output-format coverage appeared or disappeared;
- delete one version, delete a whole chain, or clear everything.

**5. Extracts variables.**
One click asks the model which spans of the finished prompt are the changeable parts (time range, audience…) and rewrites them into {{变量}} slots — a reusable template you write back.

## When it is worth using (and when it is not)

Worth it: short or vague drafts; recurring task types (reports, analyses, code requests); when you keep re-explaining what you want.

Skip it: prompts that are already structured (role + context + constraints + format); code snippets where you do not want the model rewording you; anything where you do not want an extra model call — the polish **is** a model call, and on a slow model you will wait.

Honest limitations: the result is only as good as the template and model behind it — it adds structure but cannot know facts you forgot to include; iteration is one revision per call, not a chat; and every click costs tokens (typically a few hundred, shown before you commit).

## Where it came from

The optimization engine is a faithful port of
[linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) (AGPL-3.0):
the three optimizationMode families, the template texts (kept verbatim, 10/10 byte-checked
against upstream), the mustache rendering subset, the template registry with bidirectional
field/reference validation, and the variable-extraction flow. The composer button, panel UI,
history/version chain, comparison, and token reporting are new in this repo.

## Install

DSH (desktop or web profile) + Node.js 18+.

```powershell
git clone https://github.com/benrong2048-boop/dsh-prompt-polish.git
cd dsh-prompt-polish
pwsh -File install-plugin.ps1 -ProfileName desktop   # or -ProfileName web
```

The script copies the package into %USERPROFILE%\.dsh\profiles\<profile>\node_modules\,
syntax-checks it, and appends the plugin row to that profile's cordis.patch.yml
(it prints the exact lines it writes). Then **restart DSH** — a full restart; the
desktop app has no reload key, and Ctrl+R does nothing.

Manual install, if you would rather see everything it touches:

1. Copy this folder to %USERPROFILE%\.dsh\profiles\<profile>\node_modules\@mimo-ai\dsh-client-ui-prompt-polish.
2. Append to %USERPROFILE%\.dsh\profiles\<profile>\cordis.patch.yml:

```yaml
- insert:
    - id: prompt-polish
      name: "@mimo-ai/dsh-client-ui-prompt-polish"
```

3. Restart DSH.

Uninstall: delete the package folder and the insert block above, restart DSH.

## Cost and privacy

- **Model calls**: one streaming call per polish click, one per 迭代优化 revision, one per 提取变量. Nothing runs in the background; opening the panel costs nothing. Token counts are shown per run and per version chain.
- **Privacy**: history (if you consent) lives in the browser localStorage on your machine. No telemetry, no uploads, no account. Deleting history is real deletion.
- **Disk**: the package is ~100 KB plus tests; localStorage history is capped at 50 entries with 4,000-character clipping per field.

## Tests

```powershell
node mustache.test.mjs    # rendering engine semantics (34)
node smoke.mjs            # template layer (219)
node contract.test.mjs    # browser half, real useEffect + fake streaming fetch (117)
node host.test.mjs        # host half, three routes + failure paths (164)
node compare-upstream.mjs # audit: template texts vs upstream (needs $env:UP=<upstream checkout>)
```

534 assertions, all green at publish time.

## Submit to dshmarket

A ready-to-paste catalog entry lives in [market/plugins-entry.json](./market/plugins-entry.json),
with a step-by-step guide in [market/SUBMITTING.zh.md](./market/SUBMITTING.zh.md)
(publish to npm, then PR the entry to the awesome-dsh-plugin catalog).

## License

AGPL-3.0-or-later. See [LICENSE](./LICENSE). Upstream template texts and flows come from
[linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer), also AGPL-3.0 —
the license is inherited, and their authorship is credited.
