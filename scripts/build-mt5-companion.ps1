$ErrorActionPreference = 'Stop'
$repoPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $repoPath
$env:PYINSTALLER_CONFIG_DIR = Join-Path $repoPath '.mt5-pyinstaller/cache'
& '.\.mt5-build\Scripts\python.exe' -m PyInstaller --noconfirm --clean --onefile --console --hidden-import numpy --add-data 'public/metatrader/LICENSES.txt;.' --name DAYRIS-MT5 --distpath public/metatrader --workpath .mt5-pyinstaller public/metatrader/companion.py
if ($LASTEXITCODE -ne 0) { throw 'Companion build failed' }
Get-FileHash -LiteralPath 'public/metatrader/DAYRIS-MT5.exe' -Algorithm SHA256
