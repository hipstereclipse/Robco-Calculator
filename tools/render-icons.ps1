# Generates Pip-Boy launcher icons in Espruino "image string" format.
#
# The Pip-Boy launcher (.bootcde) reads each app's APPINFO/*.info "icon" file
# and hands the raw bytes straight to g.drawImage(). It does NOT decode PNG --
# it parses the bytes as Espruino's compact image format:
#
#   byte 0 : width
#   byte 1 : height
#   byte 2 : bpp, OR'd with 0x80 if a transparent colour byte follows,
#                 OR'd with 0x40 if a palette follows
#   [byte 3 : transparent colour index]        (present when 0x80 is set)
#   [palette : 2^bpp little-endian RGB565 u16]  (present when 0x40 is set)
#   pixel data : <bpp> bits per pixel, MSB first, packed continuously
#
# Feeding it a real PNG makes it read PNG magic byte 0x4E as the bpp byte
# (0x40 palette flag + bpp 14) and throw "Can't have palette on >8 bit images".
#
# We emit 4bpp images WITH an embedded 16-entry green-ramp palette. The earlier
# build emitted 4bpp with NO palette and relied on the launcher's default
# palette being a 16-level green ramp -- on the actual device that assumption is
# wrong, so every index resolved to ~black and the icons were invisible.
# Embedding the palette makes the icon carry its own colours: index 0 is the
# transparent colour (rounded-corner background drops out) and opaque pixels map
# to 1..15 by luminance, each a brighter shade of phosphor green.

param(
  [int]$Size = 96
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$Dir = Join-Path $Root "APPINFO"

Add-Type -AssemblyName System.Drawing

$icons = @("CALC", "GRAPH", "CALCULUS", "CIRC", "CONV", "CONST", "REF", "VAC", "TAPE")

function Convert-Icon([string]$Name) {
  $pngPath = Join-Path $Dir "$Name.png"
  $imgPath = Join-Path $Dir "$Name.img"
  if (-not (Test-Path $pngPath)) { throw "Missing source art: $pngPath" }

  $src = [System.Drawing.Image]::FromFile($pngPath)
  $small = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($small)
  try {
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($src, 0, 0, $Size, $Size)
  } finally {
    $g.Dispose(); $src.Dispose()
  }

  # bpp 4, transparent colour byte follows (0x80), palette follows (0x40).
  $bytes = [System.Collections.Generic.List[byte]]::new()
  $bytes.Add([byte]$Size)
  $bytes.Add([byte]$Size)
  $bytes.Add([byte](4 -bor 0x80 -bor 0x40))
  $bytes.Add([byte]0)

  # 16-entry phosphor-green ramp in little-endian RGB565. Index 0 is unused
  # (transparent); 1..15 climb from near-black to full green so the luminance
  # mapping below reads as a shaded green icon on any display depth.
  for ($i = 0; $i -lt 16; $i++) {
    $g6 = [int][Math]::Round($i / 15.0 * 63.0)   # 6-bit green channel
    $rgb565 = ($g6 -shl 5) -band 0xFFFF          # R=0, G=g6, B=0
    $bytes.Add([byte]($rgb565 -band 0xFF))       # low byte first (LE)
    $bytes.Add([byte](($rgb565 -shr 8) -band 0xFF))
  }

  $nibbleHigh = $true
  $acc = 0
  for ($y = 0; $y -lt $Size; $y++) {
    for ($x = 0; $x -lt $Size; $x++) {
      $p = $small.GetPixel($x, $y)
      if ($p.A -lt 128) {
        $idx = 0
      } else {
        $lum = (0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B) / 255.0
        $idx = 1 + [int][Math]::Round($lum * 14)
        if ($idx -lt 1) { $idx = 1 }
        if ($idx -gt 15) { $idx = 15 }
      }
      if ($nibbleHigh) {
        $acc = $idx -shl 4
        $nibbleHigh = $false
      } else {
        $bytes.Add([byte]($acc -bor $idx))
        $nibbleHigh = $true
      }
    }
  }
  if (-not $nibbleHigh) { $bytes.Add([byte]$acc) } # odd pixel count tail

  $small.Dispose()
  [System.IO.File]::WriteAllBytes($imgPath, $bytes.ToArray())
  Write-Host ("{0,-9} -> {1}.img  ({2} bytes, {3}x{3} 4bpp)" -f $Name, $Name, $bytes.Count, $Size)
}

foreach ($name in $icons) { Convert-Icon $name }
Write-Host "Done. $($icons.Count) launcher icons written to APPINFO/*.img"
