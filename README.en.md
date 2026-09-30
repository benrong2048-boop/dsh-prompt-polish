# dsh-prompt-polish

A "polish my prompt" button that lives **inside the DSH composer**, next to the model selector. Write a rough prompt, hit the ✨ button, and the panel streams a better-structured prompt you can copy, write back into the composer, or send.

Ported from [linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) (AGPL-3.0): the optimizationMode axis, template texts, the mustache template engine, the template registry (with bidirectional field/reference checks) and the variable-extraction flow are preserved from upstream. See [README.md](./README.md) (Chinese) for the full porting notes.

## Features

- ✨ One-click prompt polish inside the DSH composer (system / user / iterate modes)
- Streaming results with copy / write-back (never auto-sends) / send
- Per-run metadata: model, wall time, length, token usage (when the provider reports it)
- Local-only history: explicit consent, version chains, per-version and per-chain delete, clear-all — nothing leaves the machine
- Version-chain comparison: original | selected | latest, plus a local structural analysis (line adds/removes, goal/context/constraints/format coverage) — no extra model calls
- Variable extraction: turn changeable spans into {{variables}} and write the template back

## Install

Requirements: DSH (desktop or web profile), Node.js 18+.

```powershell
git clone https://github.com/benrong2048-boop/dsh-prompt-polish.git
cd dsh-prompt-polish
pwsh -File install-plugin.ps1 -ProfileName desktop   # or -ProfileName web
```

The script copies the package into `%USERPROFILE%\.dsh\profiles\<profile>\node_modules\`, syntax-checks it, and appends the plugin row to that profile's `cordis.patch.yml`. Restart DSH afterwards (a full restart is required; the desktop app binds no reload key).

Manual install, if you prefer:

1. Copy this folder into `%USERPROFILE%\.dsh\profiles\<profile>\node_modules\@mimo-ai\dsh-client-ui-prompt-polish`.
2. Append to `%USERPROFILE%\.dsh\profiles\<profile>\cordis.patch.yml`:

```yaml
- insert:
    - id: prompt-polish
      name: "@mimo-ai/dsh-client-ui-prompt-polish"
```

3. Restart DSH.

## Tests

```powershell
node mustache.test.mjs    # rendering engine semantics (34)
node smoke.mjs            # template layer (219)
node contract.test.mjs    # browser half, real useEffect + fake streaming fetch (117)
node host.test.mjs        # host half, three routes + failure paths (164)
node compare-upstream.mjs # audit: template texts vs upstream (needs $env:UP=<upstream checkout>)
```

## Submit to dshmarket

A ready-to-paste catalog entry lives in [market/plugins-entry.json](./market/plugins-entry.json),
with a step-by-step guide in [market/SUBMITTING.zh.md](./market/SUBMITTING.zh.md)
(publish to npm, then PR the entry to the awesome-dsh-plugin catalog).

## License

AGPL-3.0-or-later. See [LICENSE](./LICENSE). Upstream template texts and flows come from [linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer), also AGPL-3.0.
