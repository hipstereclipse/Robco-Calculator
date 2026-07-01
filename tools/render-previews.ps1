param(
  [int]$Scale = 2
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$OutDir = Join-Path $Root "screenshots"
$OpsPath = Join-Path $OutDir "_screen_ops.json"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

& node (Join-Path $ScriptDir "capture-preview-ops.js") $OpsPath
if ($LASTEXITCODE -ne 0) {
  throw "Preview capture failed with exit code $LASTEXITCODE"
}

Add-Type -AssemblyName System.Drawing
$data = Get-Content -Raw $OpsPath | ConvertFrom-Json

$bg = [System.Drawing.Color]::FromArgb(0, 10, 5)
$fg = [System.Drawing.Color]::FromArgb(26, 255, 128)

# Device parity: apps draw with h.setColor(index) into the firmware's native
# 16-step green scanline ramp (index 0 = black .. index 15 = full brightness;
# see jswrap_pipboy.c). Approximate that whole ramp here rather than just the
# four indices our draw code actually uses (0/7/11/15, i.e. BG/DIM/MID/FG),
# so any future index still renders something sane.
function Get-PipColor($Index) {
  $i = [int]$Index
  if ($i -lt 0) { $i = 0 }
  if ($i -gt 15) { $i = 15 }
  $l = $i / 15.0
  return [System.Drawing.Color]::FromArgb([int](26 * $l), [int](255 * $l), [int](128 * $l))
}

function New-Brush($Color) {
  return [System.Drawing.SolidBrush]::new($Color)
}

function Get-Rect($op) {
  $x0 = [single]$op.x0
  $y0 = [single]$op.y0
  $x1 = [single]$op.x1
  $y1 = [single]$op.y1
  $x = [Math]::Min($x0, $x1)
  $y = [Math]::Min($y0, $y1)
  $w = [Math]::Abs($x1 - $x0) + 1
  $h = [Math]::Abs($y1 - $y0) + 1
  return [System.Drawing.RectangleF]::new($x, $y, $w, $h)
}

function Render-Screen($screen, $path) {
  $w = [int]$screen.width
  $h = [int]$screen.height
  $bmp = [System.Drawing.Bitmap]::new($w * $Scale, $h * $Scale)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $font = $null
  $fontSmall = $null

  try {
    $g.Clear($bg)
    $g.ScaleTransform($Scale, $Scale)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    # Two sizes: the device draws headings/rows in Monofonto23 and the footer
    # plus compact readouts in a small font, so map "6x8" ops to a smaller face.
    $font = [System.Drawing.Font]::new("Consolas", 18, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $fontSmall = [System.Drawing.Font]::new("Consolas", 12, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

    foreach ($op in $screen.ops) {
      switch ($op.type) {
        "clear" {
          $brush = New-Brush $bg
          try {
            $g.FillRectangle($brush, 0, 0, $w, $h)
          } finally {
            $brush.Dispose()
          }
        }
        "fillRect" {
          $brush = New-Brush (Get-PipColor $op.color)
          try {
            $g.FillRectangle($brush, (Get-Rect $op))
          } finally {
            $brush.Dispose()
          }
        }
        "drawRect" {
          $pen = [System.Drawing.Pen]::new((Get-PipColor $op.color), 1)
          try {
            $rect = Get-Rect $op
            $g.DrawRectangle($pen, $rect.X, $rect.Y, $rect.Width, $rect.Height)
          } finally {
            $pen.Dispose()
          }
        }
        "drawLine" {
          $pen = [System.Drawing.Pen]::new((Get-PipColor $op.color), 1)
          try {
            $g.DrawLine($pen, [single]$op.x0, [single]$op.y0, [single]$op.x1, [single]$op.y1)
          } finally {
            $pen.Dispose()
          }
        }
        "text" {
          $brush = New-Brush (Get-PipColor $op.color)
          try {
            $text = [string]$op.text
            $useFont = if ([string]$op.font -eq "6x8") { $fontSmall } else { $font }
            $size = $g.MeasureString($text, $useFont)
            $x = [single]$op.x
            $y = [single]$op.y

            if ([int]$op.alignX -eq 0) {
              $x -= $size.Width / 2
            } elseif ([int]$op.alignX -eq 1) {
              $x -= $size.Width
            }

            if ([int]$op.alignY -eq 0) {
              $y -= $size.Height / 2
            } elseif ([int]$op.alignY -eq 1) {
              $y -= $size.Height
            }

            $g.DrawString($text, $useFont, $brush, $x, $y)
          } finally {
            $brush.Dispose()
          }
        }
      }
    }

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    if ($font) { $font.Dispose() }
    if ($fontSmall) { $fontSmall.Dispose() }
    $g.Dispose()
    $bmp.Dispose()
  }
}

foreach ($screen in $data.screens) {
  Render-Screen $screen (Join-Path $OutDir "$($screen.name).png")
}

$thumbW = [int](480 * 0.8)
$thumbH = [int](320 * 0.8)
$labelH = 36
$gap = 20
$cols = 2
$rows = [Math]::Ceiling($data.screens.Count / $cols)
$sheetW = ($thumbW * $cols) + ($gap * ($cols + 1))
$sheetH = (($thumbH + $labelH) * $rows) + ($gap * ($rows + 1))
$sheet = [System.Drawing.Bitmap]::new($sheetW, $sheetH)
$sg = [System.Drawing.Graphics]::FromImage($sheet)
$labelFont = $null
$smallFont = $null

try {
  $sg.Clear($bg)
  $sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $sg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $labelFont = [System.Drawing.Font]::new("Consolas", 16, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $smallFont = [System.Drawing.Font]::new("Consolas", 12, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $textBrush = New-Brush $fg
  $borderPen = [System.Drawing.Pen]::new($fg, 1)

  for ($i = 0; $i -lt $data.screens.Count; $i++) {
    $screen = $data.screens[$i]
    $col = $i % $cols
    $row = [Math]::Floor($i / $cols)
    $x = $gap + ($col * ($thumbW + $gap))
    $y = $gap + ($row * ($thumbH + $labelH + $gap))
    $path = Join-Path $OutDir "$($screen.name).png"
    $img = [System.Drawing.Image]::FromFile($path)
    try {
      $sg.DrawImage($img, $x, $y + $labelH, $thumbW, $thumbH)
      $sg.DrawRectangle($borderPen, $x, $y + $labelH, $thumbW, $thumbH)
      $sg.DrawString("$($screen.name)  $($screen.title)", $labelFont, $textBrush, $x, $y)
      $sg.DrawString([string]$screen.description, $smallFont, $textBrush, $x, $y + 18)
    } finally {
      $img.Dispose()
    }
  }

  $textBrush.Dispose()
  $borderPen.Dispose()
  $sheet.Save((Join-Path $OutDir "preview-contact-sheet.png"), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  if ($labelFont) { $labelFont.Dispose() }
  if ($smallFont) { $smallFont.Dispose() }
  $sg.Dispose()
  $sheet.Dispose()
}

Write-Host "Rendered $($data.screens.Count) screenshots to $OutDir"
