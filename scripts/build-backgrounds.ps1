# Build shipped wallpapers from the raw originals in art-source/backgrounds/.
# Downscales anything wider than $MaxWidth and re-encodes as JPEG q80 into
# assets/backgrounds/ (the Vite publicDir), keeping the web zip small.
# Re-run after adding originals; then update WALLPAPERS in src/ui/BackgroundCycler.ts.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$srcDir = Join-Path $root 'art-source/backgrounds'
$outDir = Join-Path $root 'assets/backgrounds'
$MaxWidth = 1600
$Quality = 80

New-Item -ItemType Directory -Force $outDir | Out-Null
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

foreach ($file in Get-ChildItem $srcDir -Filter *.jpg) {
  $img = [System.Drawing.Image]::FromFile($file.FullName)
  try {
    $outPath = Join-Path $outDir $file.Name
    if ($img.Width -le $MaxWidth) {
      $img.Save($outPath, $jpegCodec, $encoderParams)
    } else {
      $height = [int]($img.Height * ($MaxWidth / $img.Width))
      $resized = New-Object System.Drawing.Bitmap($MaxWidth, $height)
      $gfx = [System.Drawing.Graphics]::FromImage($resized)
      $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $gfx.DrawImage($img, 0, 0, $MaxWidth, $height)
      $gfx.Dispose()
      $resized.Save($outPath, $jpegCodec, $encoderParams)
      $resized.Dispose()
    }
    "{0} -> {1:N0} KB" -f $file.Name, ((Get-Item $outPath).Length / 1KB)
  } finally {
    $img.Dispose()
  }
}
