<#
.SYNOPSIS
  Reinstall the prompt-polish plugin into the desktop profile.
.DESCRIPTION
  The package lives in this folder as the source of truth and is copied into the
  profile's own node_modules. A `pnpm install` in the profile (e.g. triggered by
  installing another bundle) can prune that hand-placed folder; run this again to
  restore it. Copies, syntax-checks, validates the patch row, and runs the suites.
  Host code changes need a DSH restart to load; client changes need one too —
  this shell binds no reload accelerator and no dev:web watcher is running.
#>
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$dst = Join-Path $env:USERPROFILE '.dsh\profiles\desktop\node_modules\@mimo-ai\dsh-client-ui-prompt-polish'

New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
Copy-Item -Path (Join-Path $src 'package.json') -Destination $dst -Force
New-Item -ItemType Directory -Force -Path (Join-Path $dst 'lib') | Out-Null
Copy-Item -Path (Join-Path $src 'lib\*') -Destination (Join-Path $dst 'lib') -Force
"installed -> $dst"

foreach ($f in @('mustache.js', 'processor.js', 'extraction.js', 'templates-generated.js', 'prompts.js', 'index.js', 'client.js')) {
  node --check (Join-Path $dst "lib\$f")
  if ($LASTEXITCODE -ne 0) { throw "syntax error in $f" }
}
'syntax ok'

node (Join-Path $src 'check-patch.mjs')
if ($LASTEXITCODE -ne 0) { throw 'cordis.patch.yml is not valid; fix it before restarting DSH' }

# The activation self-test is gone; keep the suite from writing into the installed copy.
$env:DSH_PROMPT_POLISH_SELFTEST = 'off'
foreach ($t in @('mustache.test.mjs', 'smoke.mjs', 'contract.test.mjs', 'host.test.mjs')) {
  $out = node (Join-Path $src $t) 2>&1
  $passed = @($out | Where-Object { $_ -match '^PASS ' }).Count
  $tail = $out | Select-Object -Last 1
  '{0,-18} pass={1,-3} {2}' -f $t, $passed, $tail
  if ($LASTEXITCODE -ne 0 -or $tail -notmatch 'ALL PASS') { throw "$t failed" }
}

''
# There is no Ctrl+R here: the shell calls setMenu(null) so no reload accelerator
# exists, and no `pnpm run dev:web` watcher is running to push client changes.
# Both halves need a full restart of the application.
'Applied on the next full restart of the app (Ctrl+R is not bound in this shell).'
