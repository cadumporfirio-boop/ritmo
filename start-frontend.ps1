$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'frontend')
node node_modules/@angular/cli/bin/ng.js serve --host 127.0.0.1 --port 4200
