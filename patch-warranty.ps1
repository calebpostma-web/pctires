# patch-warranty.ps1  -- adds tire warranty (km) display + sort to index.html
# Encoding-safe: edit text is base64 (pure ASCII), decoded at runtime. Additive only.
# Aborts without changing anything if any anchor does not match. Backs up first.
# After success, deploy with:  .\push-pctires.ps1
$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot 'index.html'
$enc  = New-Object System.Text.UTF8Encoding($false)
$c    = [System.IO.File]::ReadAllText($path, $enc)

# rows: nameB64 | count | findB64 | replaceB64
$rows = @(
  'bm9ybWFsaXNlVGlyZSBmaWVsZA==|1|ICAgIHRlbXBlcmF0dXJlOiBzcC50ZW1wZXJhdHVyZSB8fCBzcC50ZW1wZXJhdHVyZVJhdGluZyB8fCAnJyw=|ICAgIHRlbXBlcmF0dXJlOiBzcC50ZW1wZXJhdHVyZSB8fCBzcC50ZW1wZXJhdHVyZVJhdGluZyB8fCAnJywKICAgIHdhcnJhbnR5OiBwYXJzZUludChzcC53YXJyYW50eU1pbGVhZ2UsIDEwKSB8fCAwLA==',
  'YnVpbGRSZWNDYXJkIHdhcnJhbnR5QmFkZ2UgdmFy|1|ICBjb25zdCByZWJhdGVCYWRnZSA9IHJlYmF0ZSA/IGA8c3BhbiBjbGFzcz0icmViYXRlLWJhZGdlIG9uLWNhcmQiPvCfkrAgJCR7cmViYXRlLmFtb3VudH0gbWFpbC1pbiByZWJhdGU8L3NwYW4+YCA6ICcnOw==|ICBjb25zdCByZWJhdGVCYWRnZSA9IHJlYmF0ZSA/IGA8c3BhbiBjbGFzcz0icmViYXRlLWJhZGdlIG9uLWNhcmQiPvCfkrAgJCR7cmViYXRlLmFtb3VudH0gbWFpbC1pbiByZWJhdGU8L3NwYW4+YCA6ICcnOwogIGNvbnN0IHdhcnJhbnR5QmFkZ2UgPSB0LndhcnJhbnR5ID8gYDxzcGFuIGNsYXNzPSJ3YXJyYW50eS1iYWRnZSBvbi1jYXJkIiBzdHlsZT0iZGlzcGxheTppbmxpbmUtYmxvY2s7YmFja2dyb3VuZDp2YXIoLS1ncmVlbik7Y29sb3I6I2ZmZjtmb250LXNpemU6MTFweDtmb250LXdlaWdodDo2MDA7cGFkZGluZzozcHggOXB4O2JvcmRlci1yYWRpdXM6MTJweDttYXJnaW4tdG9wOjZweCI+8J+boe+4jyAke3Qud2FycmFudHkudG9Mb2NhbGVTdHJpbmcoKX0ga20gd2FycmFudHk8L3NwYW4+YCA6ICcnOw==',
  'cmVuZGVyVGlyZXMgd2FycmFudHlCYWRnZSB2YXI=|1|ICAgIGNvbnN0IHJlYmF0ZUJhZGdlID0gcmViYXRlID8gYDxzcGFuIGNsYXNzPSJyZWJhdGUtYmFkZ2Ugb24tY2FyZCI+8J+SsCAkJHtyZWJhdGUuYW1vdW50fSByZWJhdGU8L3NwYW4+YCA6ICcnOw==|ICAgIGNvbnN0IHJlYmF0ZUJhZGdlID0gcmViYXRlID8gYDxzcGFuIGNsYXNzPSJyZWJhdGUtYmFkZ2Ugb24tY2FyZCI+8J+SsCAkJHtyZWJhdGUuYW1vdW50fSByZWJhdGU8L3NwYW4+YCA6ICcnOwogICAgY29uc3Qgd2FycmFudHlCYWRnZSA9IHQud2FycmFudHkgPyBgPHNwYW4gY2xhc3M9IndhcnJhbnR5LWJhZGdlIG9uLWNhcmQiIHN0eWxlPSJkaXNwbGF5OmlubGluZS1ibG9jaztiYWNrZ3JvdW5kOnZhcigtLWdyZWVuKTtjb2xvcjojZmZmO2ZvbnQtc2l6ZToxMXB4O2ZvbnQtd2VpZ2h0OjYwMDtwYWRkaW5nOjNweCA5cHg7Ym9yZGVyLXJhZGl1czoxMnB4O21hcmdpbi10b3A6NnB4Ij7wn5uh77iPICR7dC53YXJyYW50eS50b0xvY2FsZVN0cmluZygpfSBrbSB3YXJyYW50eTwvc3Bhbj5gIDogJyc7',
  'aW5qZWN0IGJhZGdlIGludG8gdGMtdGFncyAoYm90aCBjYXJkcyk=|2|JHtyZWJhdGVCYWRnZX08L2Rpdj4=|JHtyZWJhdGVCYWRnZX0ke3dhcnJhbnR5QmFkZ2V9PC9kaXY+',
  'ZGV0YWlsIHNwZWMgcm93|1|ICAgIFsnUnVuLUZsYXQnLCB0LnJ1bkZsYXQgPyAnWWVzJyA6ICdObyddLCBbJ0VWIENvbXBhdGlibGUnLCB0LmV2Q29tcGF0ID8gJ1llcycgOiAnTm8nXSw=|ICAgIFsnUnVuLUZsYXQnLCB0LnJ1bkZsYXQgPyAnWWVzJyA6ICdObyddLCBbJ0VWIENvbXBhdGlibGUnLCB0LmV2Q29tcGF0ID8gJ1llcycgOiAnTm8nXSwKICAgIFsnV2FycmFudHknLCB0LndhcnJhbnR5ID8gdC53YXJyYW50eS50b0xvY2FsZVN0cmluZygpICsgJyBrbScgOiAnTm8gbWlsZWFnZSB3YXJyYW50eSddLA==',
  'c3BlY0V4cGxhaW4gV2FycmFudHkgY2FzZQ==|1|ICAgIGNhc2UgJ1RyZWFkd2Vhcic6IHs=|ICAgIGNhc2UgJ1dhcnJhbnR5JzogewogICAgICBpZiAodiA9PT0gJ05vIG1pbGVhZ2Ugd2FycmFudHknKSByZXR1cm4gJ05vIG1hbnVmYWN0dXJlciB0cmVhZGxpZmUgd2FycmFudHkg4oCUIGNvbW1vbiBvbiB3aW50ZXIsIHBlcmZvcm1hbmNlLCBhbmQgYnVkZ2V0IHRpcmVzJzsKICAgICAgY29uc3Qgd2sgPSBwYXJzZUludChTdHJpbmcodikucmVwbGFjZSgvW14wLTldL2csICcnKSwgMTApIHx8IDA7CiAgICAgIGlmICh3ayA+PSAxMDAwMDApIHJldHVybiAnTG9uZyB0cmVhZGxpZmUgd2FycmFudHkg4oCUIGJhY2tlZCBmb3IgaGlnaCBtaWxlYWdlIGFnYWluc3QgcHJlbWF0dXJlIHdlYXInOwogICAgICBpZiAod2sgPiAwKSByZXR1cm4gJ01hbnVmYWN0dXJlciB0cmVhZGxpZmUgd2FycmFudHkg4oCUIGttIGNvdmVyZWQgYWdhaW5zdCBwcmVtYXR1cmUgdHJlYWQgd2VhciAoY29uZGl0aW9ucyBhcHBseSknOwogICAgICByZXR1cm4gbnVsbDsKICAgIH0KICAgIGNhc2UgJ1RyZWFkd2Vhcic6IHs=',
  'c29ydCBvcHRpb24=|1|ICAgICAgICAgIDxvcHRpb24gdmFsdWU9Im5hbWUiPk5hbWUgQSDihpIgWjwvb3B0aW9uPg==|ICAgICAgICAgIDxvcHRpb24gdmFsdWU9Im5hbWUiPk5hbWUgQSDihpIgWjwvb3B0aW9uPgogICAgICAgICAgPG9wdGlvbiB2YWx1ZT0id2FycmFudHktZGVzYyI+V2FycmFudHk6IEhpZ2gg4oaSIExvdzwvb3B0aW9uPg==',
  'c29ydCBsb2dpYyBicmFuY2g=|1|ICBpZiAoc29ydCA9PT0gJ25hbWUnKSAgICAgICB0aXJlcyA9IFsuLi50aXJlc10uc29ydCgoYSwgYikgPT4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSk7|ICBpZiAoc29ydCA9PT0gJ25hbWUnKSAgICAgICB0aXJlcyA9IFsuLi50aXJlc10uc29ydCgoYSwgYikgPT4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSk7CiAgaWYgKHNvcnQgPT09ICd3YXJyYW50eS1kZXNjJykgdGlyZXMgPSBbLi4udGlyZXNdLnNvcnQoKGEsIGIpID0+IChiLndhcnJhbnR5IHx8IDApIC0gKGEud2FycmFudHkgfHwgMCkpOw=='
)

function FromB64([string]$s) { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($s)) }

$edits = @()
foreach ($row in $rows) {
  $p = $row.Split('|')
  $edits += [pscustomobject]@{
    Name    = FromB64 $p[0]
    Count   = [int]$p[1]
    Find    = FromB64 $p[2]
    Replace = FromB64 $p[3]
  }
}

$errs = @()
foreach ($e in $edits) {
  $n = ([regex]::Matches($c, [regex]::Escape($e.Find))).Count
  if ($n -ne $e.Count) { $errs += ('{0}: expected {1} match(es), found {2}' -f $e.Name, $e.Count, $n) }
}
if ($errs.Count -gt 0) {
  Write-Host 'ABORTED - no changes made. Anchor problems:' -ForegroundColor Red
  $errs | ForEach-Object { Write-Host ('  - ' + $_) -ForegroundColor Red }
  exit 1
}

$bak = $path + '.warranty-bak'
[System.IO.File]::WriteAllText($bak, $c, $enc)
foreach ($e in $edits) { $c = $c.Replace($e.Find, $e.Replace) }
[System.IO.File]::WriteAllText($path, $c, $enc)

Write-Host 'OK - warranty display + sort patched into index.html' -ForegroundColor Green
Write-Host ('Backup saved: ' + $bak)
Write-Host 'Next: run  .\push-pctires.ps1  to deploy.'
