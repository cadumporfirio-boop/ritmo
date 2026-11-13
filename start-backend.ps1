$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'backend')
$portablePhpPath = Join-Path $PSScriptRoot 'tools/php/php.exe'
if (Test-Path -LiteralPath $portablePhpPath) {
    & $portablePhpPath artisan serve --host=127.0.0.1 --port=8000
} else {
    php artisan serve --host=127.0.0.1 --port=8000
}
