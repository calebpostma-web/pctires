# patch-install-wording.ps1 - cart: "Installation included" -> "Installation added", checkbox label follows state
$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot 'index.html'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$s = [System.IO.File]::ReadAllText($path, $utf8)
$orig = $s
$rows = @(
  'badge|1|JzxkaXYgY2xhc3M9ImNpLWluc3RhbGwtYmFkZ2UiPuKckyBJbnN0YWxsYXRpb24gaW5jbHVkZWQ8L2Rpdj4n|JzxkaXYgY2xhc3M9ImNpLWluc3RhbGwtYmFkZ2UiPuKckyBJbnN0YWxsYXRpb24gYWRkZWQg4oCUIG1vdW50ICZhbXA7IGJhbGFuY2UgYXQgb3VyIHNob3A8L2Rpdj4n',
  'toggle|1|PHNwYW4+QWRkIGluc3RhbGxhdGlvbiA8Yj4rJCR7aW5zdGFsbFByaWNlRWFjaChpdGVtKX0vdGlyZTwvYj48L3NwYW4+|PHNwYW4+JHtpdGVtLmluc3RhbGwgPyAnSW5zdGFsbGF0aW9uIGFkZGVkJyA6ICdBZGQgaW5zdGFsbGF0aW9uJ30gPGI+KyQke2luc3RhbGxQcmljZUVhY2goaXRlbSl9L3RpcmU8L2I+JHtpdGVtLmluc3RhbGwgPyAnIMK3IHVuY2hlY2sgdG8gcmVtb3ZlJyA6ICcnfTwvc3Bhbj4='
)
$pairs = @()
foreach ($row in $rows) {
  $p = $row.Split('|')
  $find = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[2]))
  $repl = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[3]))
  $n = ([regex]::Matches($s, [regex]::Escape($find))).Count
  if ($n -ne [int]$p[1]) { Write-Host "ABORT: anchor '$($p[0])' found $n times, expected $($p[1]). Nothing written." -ForegroundColor Red; exit 1 }
  $pairs += ,@($p[0], $find, $repl)
}
foreach ($pr in $pairs) { $s = $s.Replace($pr[1], $pr[2]); Write-Host "  ok: $($pr[0])" }
$l0 = ($orig -split "`n").Count; $l1 = ($s -split "`n").Count
if ([math]::Abs($l1 - $l0) -ge 5) { Write-Host "ABORT: line delta $($l1-$l0)" -ForegroundColor Red; exit 1 }
if (-not $s.TrimEnd().EndsWith('</html>')) { Write-Host 'ABORT: file does not end with </html>' -ForegroundColor Red; exit 1 }
$bak = "$path.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item $path $bak
[System.IO.File]::WriteAllText($path, $s, $utf8)
Write-Host "Done. Lines $l0 -> $l1. Backup: $bak" -ForegroundColor Green
Write-Host "Rollback: Copy-Item '$bak' '$path' -Force"
