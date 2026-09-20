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

# Opaque mobile files must fill the icon slot, but adaptive icons still need
# enough room for the four-button motif to survive the minimum safe circle.
$mobileCases = @(
    @{ Name='apple-touch-icon-152-v5.png'; Size=152; Min=0.96; Max=1.0 },
    @{ Name='apple-touch-icon-167-v5.png'; Size=167; Min=0.96; Max=1.0 },
    @{ Name='apple-touch-icon-180-v5.png'; Size=180; Min=0.96; Max=1.0 },
    @{ Name='icon-maskable-192-v5.png'; Size=192; Min=0.77; Max=0.84 },
    @{ Name='icon-maskable-512-v5.png'; Size=512; Min=0.77; Max=0.84 }
)
foreach ($case in $mobileCases) {
    $bitmap = [System.Drawing.Bitmap]::FromFile((Join-Path $projectPath "public/$($case.Name)"))
    try {
        $size = $case.Size
        if ($bitmap.Width -ne $size -or $bitmap.Height -ne $size) { throw "Wrong size: $($case.Name)" }
        $middle = [int][Math]::Floor($size / 2)
        foreach ($axis in @('horizontal', 'vertical')) {
            $first = $size; $last = -1
            for ($position = 0; $position -lt $size; $position++) {
                $pixel = if ($axis -eq 'horizontal') { $bitmap.GetPixel($position, $middle) } else { $bitmap.GetPixel($middle, $position) }
                if ($pixel.A -ne 255) { throw "Transparent mobile pixel: $($case.Name)" }
                if ([Math]::Abs([int]$pixel.R - 9) -gt 16 -or [Math]::Abs([int]$pixel.G - 9) -gt 16 -or [Math]::Abs([int]$pixel.B - 11) -gt 16) {
                    $first = [Math]::Min($first, $position); $last = [Math]::Max($last, $position)
                }
            }
            $coverage = ($last - $first + 1) / $size
            if ($coverage -lt $case.Min -or $coverage -gt $case.Max) {
                throw "Bad mobile framing: $($case.Name), $axis, $coverage"
            }
        }
        foreach ($x in @(0, ($size - 1))) {
            foreach ($y in @(0, ($size - 1))) {
                if ($bitmap.GetPixel($x, $y).A -ne 255) { throw "Transparent mobile corner: $($case.Name)" }
            }
        }
        Write-Output "PASS $($case.Name) : mobile framing and opacity"
    } finally { $bitmap.Dispose() }
}
