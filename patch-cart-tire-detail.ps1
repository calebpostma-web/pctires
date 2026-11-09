# patch-cart-tire-detail.ps1  (PC Tires, Nov 9 2026)
# Tapping a tire in the cart (incl. shared /q/ quotes) now opens the full tire
# detail modal - specs, plain-English explainers, "What this tire is built for" -
# same as the catalogue. Wheels keep the photo lightbox. Price/Add-to-Cart block
# is hidden when opened from the cart (the cart owns the price, incl. locked quotes).
# Edits index.html only. All-or-nothing: every anchor must match exactly once.

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bakDir = "C:\Users\Caleb\Documents\PCtires-quarantine\cart-tire-detail-backup-$stamp"
$utf8 = New-Object System.Text.UTF8Encoding($false)
function D([string]$s) { return $utf8.GetString([Convert]::FromBase64String($s)) }

$rows = @(
    'open-detail|ZnVuY3Rpb24gb3BlblRpcmVEZXRhaWwoaXRlbU51bWJlcikgewogIGNvbnN0IHQgPSBbLi4uYWxsVGlyZXMsIC4uLihmaWx0ZXJlZFRpcmVzIHx8IFtdKV0uZmluZCh4ID0+IHguaXRlbU51bWJlciA9PT0gaXRlbU51bWJlcik7CiAgaWYgKCF0KSByZXR1cm47Cg==|ZnVuY3Rpb24gb3BlblRpcmVEZXRhaWwoaXRlbU51bWJlciwgZnJvbUNhcnQpIHsKICBsZXQgdCA9IFsuLi5hbGxUaXJlcywgLi4uKGZpbHRlcmVkVGlyZXMgfHwgW10pXS5maW5kKHggPT4geC5pdGVtTnVtYmVyID09PSBpdGVtTnVtYmVyKTsKICAvLyBRdW90ZS9jYXJ0IHZpZXc6IHRoZSBjYXRhbG9ndWUgbWF5IGJlIGVtcHR5IChjdXN0b21lciBvcGVuZWQgYSAvcS8gbGluayksIHNvIGZhbGwKICAvLyBiYWNrIHRvIHRoZSBjYXJ0IGxpbmUsIHdoaWNoIGNhcnJpZXMgdGhlIGZ1bGwgbm9ybWFsaXNlZCB0aXJlIGZyb20gVERHLgogIGlmICghdCAmJiBmcm9tQ2FydCkgdCA9IChjYXJ0IHx8IFtdKS5maW5kKHggPT4geC5pdGVtTnVtYmVyID09PSBpdGVtTnVtYmVyICYmIHguaXRlbVR5cGUgIT09ICd3aGVlbCcpOwogIGlmICghdCkgcmV0dXJuOwogIC8vIE9wZW5lZCBmcm9tIHRoZSBjYXJ0OiBpdCdzIGFscmVhZHkgaW4gdGhlIGNhcnQgYW5kIHRoZSBjYXJ0IG93bnMgdGhlIHByaWNlCiAgLy8gKGxvY2tlZCBxdW90ZXMsIG1lbWJlciBwcmljaW5nKSwgc28gaGlkZSB0aGUgcHJpY2UgLyBhZGQtdG8tY2FydCBibG9jay4KICBjb25zdCB0ZE92ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpcmVEZXRhaWxPdmVybGF5Jyk7CiAgWycudGQtcHJpY2Utcm93JywgJyN0ZEFmZmlybU1zZycsICcudGQtYWN0aW9ucycsICcjdGRRdHknXS5mb3JFYWNoKHNlbCA9PiB7CiAgICBjb25zdCBlbCA9IHRkT3YgJiYgdGRPdi5xdWVyeVNlbGVjdG9yKHNlbCk7CiAgICBpZiAoZWwpIGVsLnN0eWxlLmRpc3BsYXkgPSBmcm9tQ2FydCA/ICdub25lJyA6ICcnOwogIH0pOwo=',
    'icon-img|ICAgIHJldHVybiAnPGRpdiBjbGFzcz0iY2ktaWNvbiBoYXMtaW1nIiBvbmNsaWNrPSJvcGVuQ2FydEltYWdlKFwnJyArIG51bSArICdcJykiIHRpdGxlPSJWaWV3IGxhcmdlciI+Jw==|ICAgIHJldHVybiAnPGRpdiBjbGFzcz0iY2ktaWNvbiBoYXMtaW1nIiBvbmNsaWNrPSJvcGVuQ2FydEl0ZW0oXCcnICsgbnVtICsgJ1wnKSIgdGl0bGU9IicgKyAoaXRlbS5pdGVtVHlwZSA9PT0gJ3doZWVsJyA/ICdWaWV3IGxhcmdlcicgOiAnVmlldyB0aXJlIGRldGFpbHMnKSArICciPic=',
    'icon-noimg|ICByZXR1cm4gJzxkaXYgY2xhc3M9ImNpLWljb24iPicgKyBpY29uICsgJzwvZGl2Pic7Cn0KZnVuY3Rpb24gY2FydEltZ0ZhbGxiYWNrKGltZyl7|ICBpZihpdGVtICYmIGl0ZW0uaXRlbVR5cGUgIT09ICd3aGVlbCcgJiYgaXRlbS5pdGVtTnVtYmVyKXsKICAgIHZhciBuMiA9IFN0cmluZyhpdGVtLml0ZW1OdW1iZXIpLnJlcGxhY2UoLycvZywnJyk7CiAgICByZXR1cm4gJzxkaXYgY2xhc3M9ImNpLWljb24iIHN0eWxlPSJjdXJzb3I6cG9pbnRlciIgb25jbGljaz0ib3BlbkNhcnRJdGVtKFwnJyArIG4yICsgJ1wnKSIgdGl0bGU9IlZpZXcgdGlyZSBkZXRhaWxzIj4nICsgaWNvbiArICc8L2Rpdj4nOwogIH0KICByZXR1cm4gJzxkaXYgY2xhc3M9ImNpLWljb24iPicgKyBpY29uICsgJzwvZGl2Pic7Cn0KLy8gQ2FydCB0aHVtYm5haWwgdGFwOiB0aXJlcyBvcGVuIHRoZSBzYW1lIGZ1bGwgZGV0YWlsIG1vZGFsIGFzIHRoZSBjYXRhbG9ndWUKLy8gKHNwZWNzLCAiV2hhdCB0aGlzIHRpcmUgaXMgYnVpbHQgZm9yIik7IHdoZWVscyBrZWVwIHRoZSBwaG90byBsaWdodGJveC4KZnVuY3Rpb24gb3BlbkNhcnRJdGVtKGl0ZW1OdW1iZXIpewogIHZhciBpdGVtPShjYXJ0fHxbXSkuZmluZChmdW5jdGlvbihjKXtyZXR1cm4gYy5pdGVtTnVtYmVyPT09aXRlbU51bWJlcjt9KTsKICBpZighaXRlbSkgcmV0dXJuOwogIGlmKGl0ZW0uaXRlbVR5cGUgIT09ICd3aGVlbCcgJiYgKGl0ZW0uc2Vhc29uIHx8IGl0ZW0uc3BlZWQgfHwgaXRlbS5sb2FkSW5kZXgpKXsgb3BlblRpcmVEZXRhaWwoaXRlbU51bWJlciwgdHJ1ZSk7IHJldHVybjsgfQogIG9wZW5DYXJ0SW1hZ2UoaXRlbU51bWJlcik7Cn0KZnVuY3Rpb24gY2FydEltZ0ZhbGxiYWNrKGltZyl7'
)

$path = Join-Path $repo 'index.html'
$orig = [IO.File]::ReadAllText($path, $utf8)
$text = $orig
foreach ($row in $rows) {
    $p = $row.Split('|')
    $find = D $p[1]; $rep = D $p[2]
    if ($text.Contains($rep)) { throw "$($p[0]): already applied - nothing written." }
    $n = ([regex]::Matches($text, [regex]::Escape($find))).Count
    if ($n -ne 1) { throw "$($p[0]): anchor found $n times (expected 1) - nothing written." }
}
foreach ($row in $rows) { $p = $row.Split('|'); $text = $text.Replace((D $p[1]), (D $p[2])) }
$delta = ($text.Split("`n").Count) - ($orig.Split("`n").Count)
if ($delta -lt 1 -or $delta -gt 40) { throw "Line change $delta looks wrong - nothing written." }
if (-not $text.TrimEnd().EndsWith('</html>')) { throw "File end check failed - nothing written." }
New-Item -ItemType Directory -Force -Path $bakDir | Out-Null
Copy-Item $path (Join-Path $bakDir 'index.html')
[IO.File]::WriteAllText($path, $text, $utf8)
Write-Host ""
Write-Host "Cart tire-detail patch applied (+$delta lines)." -ForegroundColor Green
Write-Host "Backup: $bakDir"
Write-Host "Rollback: Copy-Item '$bakDir\index.html' '$path' -Force"
Write-Host ""
Write-Host "Next: .\push-pctires.ps1"
