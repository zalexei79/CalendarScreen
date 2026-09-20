$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectPath = Split-Path $PSScriptRoot -Parent

# Check the visible, substantially opaque silhouette, not transparent PNG bounds.
# This catches the small desktop-icon regression even when PNG dimensions match.
foreach ($size in @(16, 32, 48, 192, 512)) {
    $iconPath = Join-Path $projectPath "public/icon-$size.png"
    $bitmap = [System.Drawing.Bitmap]::FromFile($iconPath)
    try {
        if ($bitmap.Width -ne $size -or $bitmap.Height -ne $size) {
            throw "Wrong dimensions: $iconPath"
        }
        $minX = $size; $minY = $size; $maxX = -1; $maxY = -1
        for ($y = 0; $y -lt $size; $y++) {
            for ($x = 0; $x -lt $size; $x++) {
                if ($bitmap.GetPixel($x, $y).A -ge 128) {
                    $minX = [Math]::Min($minX, $x); $maxX = [Math]::Max($maxX, $x)
                    $minY = [Math]::Min($minY, $y); $maxY = [Math]::Max($maxY, $y)
                }
            }
        }
        $width = $maxX - $minX + 1
        $height = $maxY - $minY + 1
        if ($width -lt [Math]::Floor($size * 0.94) -or $height -lt [Math]::Floor($size * 0.94)) {
            throw "Excess padding: icon-$size.png has a $width x $height mark"
        }
        foreach ($x in @(0, ($size - 1))) {
            foreach ($y in @(0, ($size - 1))) {
                if ($bitmap.GetPixel($x, $y).A -ne 0) {
                    throw "Opaque outer corner: icon-$size.png"
                }
            }
        }
        Write-Output "PASS icon-$size.png : visible $width x $height; transparent corners"
    } finally {
        $bitmap.Dispose()
    }
}
