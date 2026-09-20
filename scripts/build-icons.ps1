param(
    [string]$SourcePath = (Join-Path $PSScriptRoot '../assets/brand/dayris-transparent.png')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectPath = Split-Path $PSScriptRoot -Parent
$source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $SourcePath))

try {
    if ($source.Width -ne 1254 -or $source.Height -ne 1254) {
        throw 'Expected the 1254 x 1254 transparent DAYRIS master.'
    }

    # Preserve the transparent contour, including the complete outer rim.
    $crop = [System.Drawing.RectangleF]::new(107, 93, 1040, 1040)
    function Export-Icon([string]$RelativePath, [int]$Size, [double]$Scale = 1.0, [bool]$Opaque = $false) {
        $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $attributes = [System.Drawing.Imaging.ImageAttributes]::new()
        try {
            $background = if ($Opaque) { [System.Drawing.Color]::FromArgb(255, 9, 9, 11) } else { [System.Drawing.Color]::Transparent }
            $graphics.Clear($background)
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
            $edge = [int][Math]::Round($Size * $Scale)
            $offset = [int][Math]::Floor(($Size - $edge) / 2)
            $destination = [System.Drawing.Rectangle]::new($offset, $offset, $edge, $edge)
            $graphics.DrawImage($source, $destination, $crop.X, $crop.Y, $crop.Width, $crop.Height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
            $outputPath = Join-Path $projectPath $RelativePath
            $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
            Write-Output "$RelativePath ($Size x $Size)"
        } finally {
            $attributes.Dispose()
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }

    # Browser tabs have only 16 logical pixels: use the full transparent crop.
    foreach ($size in @(16, 32, 48)) {
        Export-Icon "public/icon-$size.png" $size 1.0
    }
    # Desktop/PWA icons need the same full-size silhouette as favicons.
    # Only adaptive Android icons below require extra safety padding.
    foreach ($size in @(192, 512)) {
        Export-Icon "public/icon-$size.png" $size
    }
    # iOS and adaptive launchers use opaque square canvases; desktop/PWA do not.
    # Almost edge-to-edge artwork: remove the former nested black frame on iOS.
    # The OS applies its own rounded mask, so export opaque square PNGs.
    Export-Icon 'public/icon-180.png' 180 1.02 $true
    Export-Icon 'public/apple-touch-icon.png' 180 1.02 $true
    foreach ($size in @(152, 167, 180)) {
        Export-Icon "public/apple-touch-icon-$size-v5.png" $size 1.02 $true
    }
    Export-Icon 'public/brand-mark-192.png' 192 1.0
    # The four buttons fit inside the r=40% safe circle at 82% scale.
    # The decorative outer rim may be masked by more aggressive launcher shapes.
    foreach ($size in @(192, 512)) {
        Export-Icon "public/icon-maskable-$size.png" $size 0.82 $true
        Export-Icon "public/icon-maskable-$size-v5.png" $size 0.82 $true
    }
    Export-Icon 'assets/brand/dayris-play-store-512.png' 512 0.9 $true
} finally {
    $source.Dispose()
}
