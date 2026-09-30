$ErrorActionPreference = 'Stop'
$repoPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $repoPath
$env:PYINSTALLER_CONFIG_DIR = Join-Path $repoPath '.mt5-pyinstaller/cache'
$tclTarget = Join-Path $repoPath '.mt5-build/tcl'
if (!(Test-Path -LiteralPath (Join-Path $tclTarget 'tcl8.6/init.tcl'))) {
  $pythonBase = & '.\.mt5-build\Scripts\python.exe' -c 'import sys; print(sys.base_prefix)'
  Copy-Item -LiteralPath (Join-Path $pythonBase 'tcl') -Destination $tclTarget -Recurse -Force
}
$env:TCL_LIBRARY = Join-Path $tclTarget 'tcl8.6'
$env:TK_LIBRARY = Join-Path $tclTarget 'tk8.6'
& '.\.mt5-build\Scripts\python.exe' -m PyInstaller --noconfirm --clean --onefile --windowed --hidden-import numpy --icon public/icon-48.png --add-data 'public/icon-48.png;.' --add-data 'public/metatrader/LICENSES.txt;.' --name DAYRIS-MT5 --distpath public/metatrader --workpath .mt5-pyinstaller public/metatrader/companion.py
if ($LASTEXITCODE -ne 0) { throw 'Companion build failed' }
Get-FileHash -LiteralPath 'public/metatrader/DAYRIS-MT5.exe' -Algorithm SHA256
