param([string]$XpsPath, [string]$OutDir, [int[]]$Pages, [double]$Scale = 1.5, [int]$Quality = 80)
# Renders pages of an XPS document (e.g. a OneNote export) to JPEG files named p###.jpg.
Add-Type -AssemblyName ReachFramework, PresentationCore, PresentationFramework, WindowsBase, System.Printing
New-Item -ItemType Directory -Force $OutDir | Out-Null
$doc = New-Object System.Windows.Xps.Packaging.XpsDocument($XpsPath, [System.IO.FileAccess]::Read)
$pag = $doc.GetFixedDocumentSequence().DocumentPaginator
foreach ($p in $Pages) {
    $page = $pag.GetPage($p - 1)
    $w = [int]($page.Size.Width * $Scale); $h = [int]($page.Size.Height * $Scale)
    $dv = New-Object System.Windows.Media.DrawingVisual
    $ctx = $dv.RenderOpen()
    $ctx.DrawRectangle([System.Windows.Media.Brushes]::White, $null, (New-Object System.Windows.Rect(0, 0, $w, $h)))
    $ctx.DrawRectangle((New-Object System.Windows.Media.VisualBrush($page.Visual)), $null, (New-Object System.Windows.Rect(0, 0, $w, $h)))
    $ctx.Close()
    $bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap($w, $h, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
    $bmp.Render($dv)
    $enc = New-Object System.Windows.Media.Imaging.JpegBitmapEncoder
    $enc.QualityLevel = $Quality
    $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
    $fs = [System.IO.File]::Create((Join-Path $OutDir ("p{0:D3}.jpg" -f $p)))
    $enc.Save($fs); $fs.Close()
}
$doc.Close()
"rendered $($Pages.Count)"
