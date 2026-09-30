<#
.SYNOPSIS
  Install the prompt-polish plugin into any DSH profile (works for every user).
.PARAMETER ProfileName
  Profile name under %USERPROFILE%\.dsh\profiles (default: desktop).
.PARAMETER DshHome
  Alternative DSH home directory (default: %USERPROFILE%\.dsh).
.EXAMPLE
  pwsh -File install-plugin.ps1                # installs into the desktop profile
  pwsh -File install-plugin.ps1 -Profile web   # installs into the web profile
#>
param(
  [string]$TargetProfile = 'desktop',
  [string]$DshHome = (Join-Path $env:USERPROFILE '.dsh')
)
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$dst = Join-Path $DshHome ('profiles\' + $TargetProfile + '\node_modules\@mimo-ai\dsh-client-ui-prompt-polish')

New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item -Path (Join-Path $src 'package.json') -Destination $dst -Force
New-Item -ItemType Directory -Force -Path (Join-Path $dst 'lib') | Out-Null
Copy-Item -Path (Join-Path $src 'lib\*') -Destination (Join-Path $dst 'lib') -Force
"installed -> $dst"

foreach ($f in @('mustache.js','processor.js','extraction.js','templates-generated.js','prompts.js','index.js','client.js')) {
  node --check (Join-Path $dst "lib\$f")
  if ($LASTEXITCODE -ne 0) { throw "syntax error in $f" }
}
'syntax ok'

# Append the plugin row to the profile's cordis.patch.yml when absent.
$patch = Join-Path $DshHome ('profiles\' + $TargetProfile + '\cordis.patch.yml')
$row = @('', '- insert:', '    - id: prompt-polish', '      name: "@mimo-ai/dsh-client-ui-prompt-polish"')
if (-not (Test-Path $patch)) {
  Set-Content -Path $patch -Value ($row | Select-Object -Skip 1) -Encoding UTF8
  "created $patch with the plugin row"
} elseif (-not (Select-String -Path $patch -Pattern 'prompt-polish' -Quiet)) {
  Add-Content -Path $patch -Value ($row -join "`r`n") -Encoding UTF8
  "appended the plugin row to $patch"
} else {
  "patch row already present in $patch"
}

'All done. Restart DSH to load the plugin.'
'Note: a pnpm install inside the profile may prune hand-placed packages; re-run this script to restore.'
