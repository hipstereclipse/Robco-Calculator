param(
  [int]$Size = 256
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$OutDir = Join-Path $Root "APPINFO"
$ShotDir = Join-Path $Root "screenshots"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null

Add-Type -AssemblyName System.Drawing

function Color-Hex($Hex, [int]$Alpha = 255) {
  $clean = $Hex.TrimStart("#")
  $r = [Convert]::ToInt32($clean.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($clean.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($clean.Substring(4, 2), 16)
  return [System.Drawing.Color]::FromArgb($Alpha, $r, $g, $b)
}

function Brush-Hex($Hex, [int]$Alpha = 255) {
  return [System.Drawing.SolidBrush]::new((Color-Hex $Hex $Alpha))
}

function Pen-Hex($Hex, [single]$Width, [int]$Alpha = 255) {
  $pen = [System.Drawing.Pen]::new((Color-Hex $Hex $Alpha), $Width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function Round-Path([single]$X, [single]$Y, [single]$W, [single]$H, [single]$R) {
  $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $R * 2
  $p.AddArc($X, $Y, $d, $d, 180, 90)
  $p.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
  $p.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
  $p.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Fill-Round($G, $Brush, [single]$X, [single]$Y, [single]$W, [single]$H, [single]$R) {
  $p = Round-Path $X $Y $W $H $R
  try { $G.FillPath($Brush, $p) } finally { $p.Dispose() }
}

function Stroke-Round($G, $Pen, [single]$X, [single]$Y, [single]$W, [single]$H, [single]$R) {
  $p = Round-Path $X $Y $W $H $R
  try { $G.DrawPath($Pen, $p) } finally { $p.Dispose() }
}

function Center-Text($G, [string]$Text, $Font, $Brush, [single]$X, [single]$Y, [single]$W, [single]$H) {
  $sf = [System.Drawing.StringFormat]::new()
  try {
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $G.DrawString($Text, $Font, $Brush, [System.Drawing.RectangleF]::new($X, $Y, $W, $H), $sf)
  } finally {
    $sf.Dispose()
  }
}

function Points([single[]]$Values) {
  $pts = New-Object "System.Drawing.PointF[]" ($Values.Length / 2)
  for ($i = 0; $i -lt $Values.Length; $i += 2) {
    $pts[$i / 2] = [System.Drawing.PointF]::new($Values[$i], $Values[$i + 1])
  }
  return $pts
}

function Draw-Symbol($G, [string]$Kind, $Ink, $Glow, $Dark, $FontSmall, $FontTiny) {
  $penInk = Pen-Hex "#092014" 5
  $penThin = Pen-Hex "#092014" 3
  $penGlow = Pen-Hex "#f8f0a2" 3
  $brushInk = Brush-Hex "#092014"
  $brushGlow = Brush-Hex "#f8f0a2"
  try {
    switch ($Kind) {
      "calc" {
        Fill-Round $G $brushInk 84 96 88 34 7
        Fill-Round $G $brushGlow 92 102 72 16 4
        Center-Text $G "=14" $FontTiny $brushInk 91 99 74 20
        for ($r = 0; $r -lt 2; $r++) {
          for ($c = 0; $c -lt 4; $c++) {
            Fill-Round $G $brushInk (78 + $c * 24) (138 + $r * 20) 16 13 4
          }
        }
      }
      "graph" {
        $G.DrawLine($penInk, 74, 160, 181, 160)
        $G.DrawLine($penInk, 84, 100, 84, 165)
        $G.DrawBezier($penGlow, 76, 142, 102, 86, 130, 196, 166, 120)
        $G.DrawBezier($penGlow, 166, 120, 178, 94, 187, 112, 192, 104)
      }
      "calculus" {
        $G.DrawLine($penGlow, 80, 158, 174, 102)
        $G.DrawLine($penInk, 82, 158, 172, 158)
        $G.DrawLine($penInk, 172, 102, 172, 158)
        Center-Text $G "dx" $FontSmall $brushInk 82 100 46 32
        Center-Text $G "f'" $FontSmall $brushInk 132 126 46 32
      }
      "circuit" {
        $zig = Points ([single[]](72,132,86,132,94,114,110,150,126,114,142,150,156,132,184,132))
        $G.DrawLines($penInk, $zig)
        $bolt = Points ([single[]](130,94,104,136,126,136,112,176,154,124,132,124))
        $G.FillPolygon($brushGlow, $bolt)
        $G.DrawPolygon($penInk, $bolt)
      }
      "convert" {
        $G.DrawLine($penInk, 82, 112, 164, 112)
        $G.FillPolygon($brushInk, (Points ([single[]](164,101,187,112,164,123))))
        $G.DrawLine($penGlow, 174, 152, 92, 152)
        $G.FillPolygon($brushGlow, (Points ([single[]](92,141,69,152,92,163))))
        Center-Text $G "mL" $FontTiny $brushInk 83 118 42 24
        Center-Text $G "CUP" $FontTiny $brushInk 132 124 58 24
      }
      "const" {
        $G.DrawEllipse($penInk, 76, 116, 106, 36)
        $G.DrawEllipse($penInk, 94, 90, 70, 88)
        $G.DrawEllipse($penGlow, 94, 112, 70, 44)
        Fill-Round $G $brushInk 119 126 18 18 9
        Center-Text $G "PI" $FontSmall $brushInk 102 92 52 28
      }
      "ref" {
        Fill-Round $G $brushGlow 74 98 52 74 8
        Fill-Round $G $brushGlow 130 98 52 74 8
        $G.DrawLine($penInk, 128, 102, 128, 174)
        $G.DrawRectangle($penInk, 74, 98, 108, 74)
        for ($i = 0; $i -lt 3; $i++) {
          $G.DrawLine($penThin, 86, 118 + $i * 14, 116, 118 + $i * 14)
          $G.DrawLine($penThin, 140, 118 + $i * 14, 170, 118 + $i * 14)
        }
      }
      "vac" {
        $G.DrawArc($penInk, 72, 104, 112, 94, 196, 148)
        $G.DrawLine($penGlow, 128, 152, 162, 114)
        Fill-Round $G $brushInk 119 143 18 18 9
        for ($i = 0; $i -lt 5; $i++) {
          Fill-Round $G $brushGlow (72 + $i * 25) (94 + (($i % 2) * 17)) 10 10 5
        }
        Center-Text $G "N2" $FontTiny $brushInk 100 164 58 24
      }
      "tape" {
        Fill-Round $G $brushGlow 86 92 84 90 9
        $G.DrawRectangle($penInk, 86, 92, 84, 90)
        for ($i = 0; $i -lt 4; $i++) {
          $G.DrawLine($penThin, 98, 112 + $i * 15, 158, 112 + $i * 15)
        }
        Fill-Round $G $brushInk 102 152 52 14 5
        $G.DrawLine($penGlow, 108, 159, 148, 159)
      }
    }
  } finally {
    $penInk.Dispose(); $penThin.Dispose(); $penGlow.Dispose()
    $brushInk.Dispose(); $brushGlow.Dispose()
  }
}

function Render-HoloTape($Spec, [string]$Path) {
  $bmp = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $fonts = @()
  $brushes = @()
  $pens = @()
  try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.ScaleTransform($Size / 256.0, $Size / 256.0)

    $shadow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(95, 0, 0, 0)); $brushes += $shadow
    $body = Brush-Hex "#918948"; $brushes += $body
    $bodyDark = Brush-Hex "#4f421c"; $brushes += $bodyDark
    $bodyLight = Brush-Hex "#c8bf66"; $brushes += $bodyLight
    $accent = Brush-Hex $Spec.Accent; $brushes += $accent
    $amber = Brush-Hex "#f7d56b"; $brushes += $amber
    $darkBrush = Brush-Hex "#16110a"; $brushes += $darkBrush
    $ink = Brush-Hex "#092014"; $brushes += $ink

    $outline = Pen-Hex "#16110a" 6; $pens += $outline
    $thin = Pen-Hex "#16110a" 3; $pens += $thin
    $lightPen = Pen-Hex "#f7d56b" 3; $pens += $lightPen

    $fontCode = [System.Drawing.Font]::new("Arial Black", 19, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel); $fonts += $fontCode
    $fontSmall = [System.Drawing.Font]::new("Arial Black", 25, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel); $fonts += $fontSmall
    $fontTiny = [System.Drawing.Font]::new("Consolas", 17, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel); $fonts += $fontTiny
    $fontMicro = [System.Drawing.Font]::new("Consolas", 9, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel); $fonts += $fontMicro

    Fill-Round $g $shadow 31 66 202 143 24
    Fill-Round $g $bodyDark 30 57 198 142 23
    Fill-Round $g $body 24 50 204 142 24
    Stroke-Round $g $outline 24 50 204 142 24
    Fill-Round $g $bodyLight 42 38 172 45 18
    Stroke-Round $g $outline 42 38 172 45 18
    Fill-Round $g $darkBrush 54 51 148 17 8
    Center-Text $g $Spec.Code $fontTiny $amber 55 48 146 22

    Fill-Round $g $accent 54 84 148 91 16
    Stroke-Round $g $thin 54 84 148 91 16

    Fill-Round $g $bodyDark 42 104 30 48 14
    Fill-Round $g $bodyLight 47 111 20 34 10
    Fill-Round $g $bodyDark 184 104 30 48 14
    Fill-Round $g $bodyLight 189 111 20 34 10

    Draw-Symbol $g $Spec.Symbol $ink $amber $darkBrush $fontSmall $fontTiny

    for ($i = 0; $i -lt 6; $i++) {
      Fill-Round $g $amber (64 + $i * 21) 181 13 22 4
      Stroke-Round $g $thin (64 + $i * 21) 181 13 22 4
    }

    $g.DrawLine($lightPen, 55, 93, 124, 88)
    $g.DrawLine($thin, 38, 70, 68, 62)
    $g.DrawLine($thin, 190, 68, 212, 76)
    Fill-Round $g $darkBrush 36 184 10 10 5
    Fill-Round $g $darkBrush 210 184 10 10 5

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    foreach ($font in $fonts) { $font.Dispose() }
    foreach ($brush in $brushes) { $brush.Dispose() }
    foreach ($pen in $pens) { $pen.Dispose() }
    $g.Dispose()
    $bmp.Dispose()
  }
}

$Specs = @(
  @{ File = "CALC.png"; Code = "CALC"; Accent = "#39e77f"; Symbol = "calc" },
  @{ File = "GRAPH.png"; Code = "GRAPH"; Accent = "#48c6ff"; Symbol = "graph" },
  @{ File = "CALCULUS.png"; Code = "CALC+"; Accent = "#ffc348"; Symbol = "calculus" },
  @{ File = "CIRC.png"; Code = "CIRC"; Accent = "#ff6b4a"; Symbol = "circuit" },
  @{ File = "CONV.png"; Code = "CONV"; Accent = "#d7f06e"; Symbol = "convert" },
  @{ File = "CONST.png"; Code = "CONST"; Accent = "#86f0c0"; Symbol = "const" },
  @{ File = "REF.png"; Code = "REF"; Accent = "#f0df86"; Symbol = "ref" },
  @{ File = "VAC.png"; Code = "VAC"; Accent = "#99d1ff"; Symbol = "vac" },
  @{ File = "TAPE.png"; Code = "TAPE"; Accent = "#ff9c58"; Symbol = "tape" }
)

foreach ($spec in $Specs) {
  Render-HoloTape $spec (Join-Path $OutDir $spec.File)
}

$sheetCols = 3
$gap = 18
$cell = $Size
$sheetW = ($sheetCols * $cell) + (($sheetCols + 1) * $gap)
$sheetRows = [Math]::Ceiling($Specs.Count / $sheetCols)
$sheetH = ($sheetRows * $cell) + (($sheetRows + 1) * $gap)
$sheet = [System.Drawing.Bitmap]::new($sheetW, $sheetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$sg = [System.Drawing.Graphics]::FromImage($sheet)
try {
  $sg.Clear((Color-Hex "#050c07"))
  $sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  for ($i = 0; $i -lt $Specs.Count; $i++) {
    $img = [System.Drawing.Image]::FromFile((Join-Path $OutDir $Specs[$i].File))
    try {
      $x = $gap + (($i % $sheetCols) * ($cell + $gap))
      $y = $gap + ([Math]::Floor($i / $sheetCols) * ($cell + $gap))
      $sg.DrawImage($img, $x, $y, $cell, $cell)
    } finally {
      $img.Dispose()
    }
  }
  $sheet.Save((Join-Path $ShotDir "holotape-icons.png"), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $sg.Dispose()
  $sheet.Dispose()
}

Write-Host "Rendered $($Specs.Count) holotape icons to $OutDir"
