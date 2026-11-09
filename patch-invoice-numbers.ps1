# patch-invoice-numbers.ps1  (PC Tires, Nov 7 2026)
# Sequential invoice numbers (1001, 1002, ...) on every PC Tires sale + HST # on receipts.
# Edits EXISTING files:
#   functions/order-core.js                : invoice # issued per order, shown on customer + shop emails
#   functions/send-payment-notification.js : pay-link / status-card payments get invoice #, HST # on receipt
#   functions/create-pi.js                 : tags pay-link payments so the webhook knows them
#   functions/stripe-webhook.js            : numbers pay links even if the customer closes the page
#                                            (also stops the webhook failing on every pay-link payment)
# New / updated files already in the folder (pushed as-is):
#   functions/invoice-core.js, functions/terminal.js, functions/reader-core.js, reader.html
#
# All-or-nothing: every anchor must match exactly once before anything is written.
# Backups go OUTSIDE the repo to C:\Users\Caleb\Documents\PCtires-quarantine.

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bakDir = "C:\Users\Caleb\Documents\PCtires-quarantine\invoice-numbers-backup-$stamp"
$utf8 = New-Object System.Text.UTF8Encoding($false)
function D([string]$s) { return $utf8.GetString([Convert]::FromBase64String($s)) }

$rows = @(
    'functions/order-core.js|oc-import|aW1wb3J0IHsgcHJlcGFyZVJlYWRlckxpbmsgfSBmcm9tICcuL3JlYWRlci1jb3JlLmpzJzs=|aW1wb3J0IHsgcHJlcGFyZVJlYWRlckxpbmsgfSBmcm9tICcuL3JlYWRlci1jb3JlLmpzJzsKaW1wb3J0IHsgaXNzdWVJbnZvaWNlLCByZWNvcmRQYXltZW50IH0gZnJvbSAnLi9pbnZvaWNlLWNvcmUuanMnOw=='
    'functions/order-core.js|oc-issue|ICBjb25zdCBSRVNFTkRfQVBJX0tFWSA9IGVudi5SRVNFTkRfQVBJX0tFWTs=|ICAvLyBTZXF1ZW50aWFsIGludm9pY2UgbnVtYmVyIChDUkEpLiBJc3N1ZWQgb25jZSBwZXIgb3JkZXI7IGEgcmUtcnVuIGdldHMgdGhlIHNhbWUgbnVtYmVyLgogIHRyeSB7CiAgICBjb25zdCBwczAgPSBwYXlTdGF0ZShvcmRlcik7CiAgICBjb25zdCBpbnYgPSBhd2FpdCBpc3N1ZUludm9pY2UoZW52LCB7CiAgICAgIHJlZjogJ29yZGVyOicgKyBvcmRlci5vcmRlck51bWJlciwga2luZDogJ29yZGVyJywgb3JkZXJOdW1iZXI6IG9yZGVyLm9yZGVyTnVtYmVyLAogICAgICBjdXN0b21lcjogb3JkZXIuY3VzdG9tZXJOYW1lLCBlbWFpbDogb3JkZXIuY3VzdG9tZXJFbWFpbCwKICAgICAgZGVzY3JpcHRpb246IChvcmRlci50aXJlcyB8fCBbXSkubWFwKHQgPT4gYCR7dC5xdHl9eCAke3QuYnJhbmR9ICR7dC5uYW1lfSAke3Quc2l6ZSB8fCAnJ31gLnRyaW0oKSkuam9pbignOyAnKSB8fCAnVGlyZXMgYW5kIGluc3RhbGxhdGlvbicsCiAgICAgIHByZVRheDogTnVtYmVyKG9yZGVyLnN1YnRvdGFsIHx8IDApICsgTnVtYmVyKG9yZGVyLmluc3RhbGxUb3RhbCB8fCAwKSArIE51bWJlcihvcmRlci5hZGRvblRvdGFsIHx8IDApIC0gTnVtYmVyKG9yZGVyLmRpc2NvdW50IHx8IDApLAogICAgICB0YXg6IG9yZGVyLnRheCwgdG90YWw6IG9yZGVyLnRvdGFsLAogICAgfSk7CiAgICBpZiAoaW52KSB7CiAgICAgIG9yZGVyLmludm9pY2VOdW1iZXIgPSBpbnY7CiAgICAgIGlmIChwczAucGFpZCA+IDApIHsKICAgICAgICBhd2FpdCByZWNvcmRQYXltZW50KGVudiwgeyBpZDogJ29yZGVyOicgKyBvcmRlci5vcmRlck51bWJlciArICc6aW5pdGlhbCcsIGludm9pY2U6IGludiwgbWV0aG9kOiBwczAudmlhIHx8ICdDYXJkJywgYW1vdW50OiBwczAucGFpZCwgc3RyaXBlUGk6IG9yZGVyLnBheW1lbnRJbnRlbnRJZCB8fCBudWxsIH0pOwogICAgICB9CiAgICB9CiAgfSBjYXRjaCAoZSkgeyBjb25zb2xlLmVycm9yKCdJbnZvaWNlIG51bWJlciBlcnJvcjonLCBlKTsgfQoKICBjb25zdCBSRVNFTkRfQVBJX0tFWSA9IGVudi5SRVNFTkRfQVBJX0tFWTs='
    'functions/order-core.js|oc-customer-email|ICAgICAgICAgIDx0ZCBzdHlsZT0icGFkZGluZzo2cHggMDt0ZXh0LWFsaWduOnJpZ2h0O2NvbG9yOiNmNWM1MTg7Zm9udC13ZWlnaHQ6NzAwO2ZvbnQtZmFtaWx5Om1vbm9zcGFjZSI+JHtvcmRlci5vcmRlck51bWJlcn08L3RkPgogICAgICAgIDwvdHI+|ICAgICAgICAgIDx0ZCBzdHlsZT0icGFkZGluZzo2cHggMDt0ZXh0LWFsaWduOnJpZ2h0O2NvbG9yOiNmNWM1MTg7Zm9udC13ZWlnaHQ6NzAwO2ZvbnQtZmFtaWx5Om1vbm9zcGFjZSI+JHtvcmRlci5vcmRlck51bWJlcn08L3RkPgogICAgICAgIDwvdHI+CiAgICAgICAgJHtvcmRlci5pbnZvaWNlTnVtYmVyID8gYDx0cj4KICAgICAgICAgIDx0ZCBzdHlsZT0icGFkZGluZzo2cHggMDtjb2xvcjojODg4O2ZvbnQtc2l6ZToxM3B4Ij5JbnZvaWNlICM8L3RkPgogICAgICAgICAgPHRkIHN0eWxlPSJwYWRkaW5nOjZweCAwO3RleHQtYWxpZ246cmlnaHQ7Y29sb3I6I2Y1YzUxODtmb250LXdlaWdodDo3MDA7Zm9udC1mYW1pbHk6bW9ub3NwYWNlIj4ke29yZGVyLmludm9pY2VOdW1iZXJ9PC90ZD4KICAgICAgICA8L3RyPmAgOiAnJ30='
    'functions/order-core.js|oc-internal-header|TmV3IE9yZGVyICZtZGFzaDsgJHtvcmRlci5vcmRlck51bWJlcn08L2gyPg==|TmV3IE9yZGVyICZtZGFzaDsgJHtvcmRlci5vcmRlck51bWJlcn0ke29yZGVyLmludm9pY2VOdW1iZXIgPyBgICZtaWRkb3Q7IEludm9pY2UgIyR7b3JkZXIuaW52b2ljZU51bWJlcn1gIDogJyA8c3BhbiBzdHlsZT0iY29sb3I6I2I5MWMxYztmb250LXNpemU6MTNweCI+KE5PIElOVk9JQ0UgIyAmbWRhc2g7IGNoZWNrIElOVk9JQ0VfREIgYmluZGluZyk8L3NwYW4+J308L2gyPg=='
    'functions/send-payment-notification.js|sp-import|Y29uc3QgRlJPTV9FTUFJTCAgICA9ICdwYXltZW50c0BwY3RpcmVzLmNhJzs=|aW1wb3J0IHsgaW52b2ljZUZvclBheUxpbmssIEhTVF9OVU1CRVIgfSBmcm9tICcuL2ludm9pY2UtY29yZS5qcyc7Cgpjb25zdCBGUk9NX0VNQUlMICAgID0gJ3BheW1lbnRzQHBjdGlyZXMuY2EnOw=='
    'functions/send-payment-notification.js|sp-issue|ICAgIGNvbnN0IHJlcSA9IGF3YWl0IHJlcXVlc3QuanNvbigpOw==|ICAgIGNvbnN0IHJlcSA9IGF3YWl0IHJlcXVlc3QuanNvbigpOwoKICAgIC8vIFNlcXVlbnRpYWwgaW52b2ljZSBudW1iZXIsIG9ubHkgZm9yIGEgcGF5bWVudCBTdHJpcGUgY29uZmlybXMgc3VjY2VlZGVkLgogICAgLy8gV2hhdGV2ZXIgdGhlIHBhZ2Ugc2VudCBhcyAiaW52b2ljZSIgYmVjb21lcyB0aGUgcmVmZXJlbmNlLgogICAgcmVxLnJlZmVyZW5jZSA9IHJlcS5pbnZvaWNlTnVtYmVyIHx8ICcnOwogICAgcmVxLmludm9pY2VOdW1iZXIgPSAnJzsKICAgIHRyeSB7CiAgICAgIGlmIChyZXEucGF5bWVudEludGVudElkICYmIGVudi5TVFJJUEVfU0VDUkVUKSB7CiAgICAgICAgY29uc3QgcHIgPSBhd2FpdCBmZXRjaCgnaHR0cHM6Ly9hcGkuc3RyaXBlLmNvbS92MS9wYXltZW50X2ludGVudHMvJyArIGVuY29kZVVSSUNvbXBvbmVudChyZXEucGF5bWVudEludGVudElkKSwgewogICAgICAgICAgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiAnQmVhcmVyICcgKyBlbnYuU1RSSVBFX1NFQ1JFVCB9LAogICAgICAgIH0pOwogICAgICAgIGNvbnN0IHBpID0gcHIub2sgPyBhd2FpdCBwci5qc29uKCkgOiBudWxsOwogICAgICAgIGlmIChwaSAmJiBwaS5zdGF0dXMgPT09ICdzdWNjZWVkZWQnKSB7CiAgICAgICAgICBjb25zdCBzdCA9IHJlcS5zdGF0dXNFeGVtcHQgPT09IHRydWU7CiAgICAgICAgICBjb25zdCBpbnYgPSBhd2FpdCBpbnZvaWNlRm9yUGF5TGluayhlbnYsIHBpLCB7CiAgICAgICAgICAgIG9yZGVyTnVtYmVyOiByZXEub3JkZXJOdW1iZXIsIHN0YXR1c0V4ZW1wdDogc3QsCiAgICAgICAgICAgIGN1c3RvbWVyTmFtZTogcmVxLmN1c3RvbWVyTmFtZSwgY3VzdG9tZXJFbWFpbDogcmVxLmN1c3RvbWVyRW1haWwsIGRlc2NyaXB0aW9uOiByZXEuZGVzY3JpcHRpb24sCiAgICAgICAgICAgIHByZVRheDogc3QgPyByZXEucHJldGF4IDogdW5kZWZpbmVkLCB0YXg6IHN0ID8gcmVxLmdzdCA6IHVuZGVmaW5lZCwKICAgICAgICAgIH0pOwogICAgICAgICAgaWYgKGludikgcmVxLmludm9pY2VOdW1iZXIgPSBpbnY7CiAgICAgICAgfQogICAgICB9CiAgICB9IGNhdGNoIChlKSB7IGNvbnNvbGUuZXJyb3IoJ1BheSBsaW5rIGludm9pY2UgbnVtYmVyIGVycm9yOicsIGUpOyB9'
    'functions/send-payment-notification.js|sp-subject|UGF5bWVudCBSZWNlaXZlZCR7aW52b2ljZU51bWJlciA/ICcgLSAnICsgaW52b2ljZU51bWJlciA6ICcnfQ==|UGF5bWVudCBSZWNlaXZlZCR7aW52b2ljZU51bWJlciA/ICcgLSBJbnZvaWNlICMnICsgaW52b2ljZU51bWJlciA6ICcnfQ=='
    'functions/send-payment-notification.js|sp-receipt-label|Ym9yZGVyLWJvdHRvbToxcHggc29saWQgIzJhMmEyYSI+UmVmZXJlbmNlPC90ZD4=|Ym9yZGVyLWJvdHRvbToxcHggc29saWQgIzJhMmEyYSI+SW52b2ljZSAjPC90ZD4='
    'functions/send-payment-notification.js|sp-receipt-hst|JiN4MUY0REU7IDUxOS0zOTctNDY4NiAmbWlkZG90OyBwYXltZW50c0BwY3RpcmVzLmNhICZtaWRkb3Q7IHBjdGlyZXMuY2E8L2Rpdj4=|JiN4MUY0REU7IDUxOS0zOTctNDY4NiAmbWlkZG90OyBwYXltZW50c0BwY3RpcmVzLmNhICZtaWRkb3Q7IHBjdGlyZXMuY2E8L2Rpdj4KICAgICAgPGRpdj5IU1QgIyAke0hTVF9OVU1CRVJ9PC9kaXY+JHtwLnJlZmVyZW5jZSA/IGAKICAgICAgPGRpdj5SZWZlcmVuY2U6ICR7ZXNjKHAucmVmZXJlbmNlKX08L2Rpdj5gIDogJyd9'
    'functions/send-payment-notification.js|sp-internal-ref|PHRyPjx0ZD5JbnZvaWNlICM8L3RkPjx0ZD4ke2VzYyhwLmludm9pY2VOdW1iZXIpfTwvdGQ+PC90cj5gIDogJyd9|PHRyPjx0ZD5JbnZvaWNlICM8L3RkPjx0ZD4ke2VzYyhwLmludm9pY2VOdW1iZXIpfTwvdGQ+PC90cj5gIDogJzx0cj48dGQ+SW52b2ljZSAjPC90ZD48dGQgc3R5bGU9ImNvbG9yOiNiOTFjMWMiPm5vdCBhc3NpZ25lZCAmbWRhc2g7IGNoZWNrIElOVk9JQ0VfREIgYmluZGluZzwvdGQ+PC90cj4nfQogICAgICAke3AucmVmZXJlbmNlID8gYDx0cj48dGQ+UmVmZXJlbmNlPC90ZD48dGQ+JHtlc2MocC5yZWZlcmVuY2UpfTwvdGQ+PC90cj5gIDogJyd9'
    'functions/create-pi.js|cp-paylink|ICAgIGlmIChvcmRlck51bWJlcikgYm9keS5zZXQoJ21ldGFkYXRhW29yZGVyTnVtYmVyXScsIFN0cmluZyhvcmRlck51bWJlcikpOw==|ICAgIGlmIChvcmRlck51bWJlcikgYm9keS5zZXQoJ21ldGFkYXRhW29yZGVyTnVtYmVyXScsIFN0cmluZyhvcmRlck51bWJlcikpOwogICAgLy8gUGF5IGxpbmtzICgvcGF5LCAvc3RhdHVzcGF5KSBzZW5kIG5vIG9yZGVyOiB0YWcgdGhlbSBzbyB0aGUgd2ViaG9vawogICAgLy8gbnVtYmVycyB0aGUgaW52b2ljZSBpbnN0ZWFkIG9mIGh1bnRpbmcgZm9yIGFuIG9yZGVyIHRoYXQgZG9lc24ndCBleGlzdC4KICAgIGlmICghb3JkZXIpIGJvZHkuc2V0KCdtZXRhZGF0YVtraW5kXScsICdwYXlsaW5rJyk7'
    'functions/stripe-webhook.js|wh-import|aW1wb3J0IHsgcHJvY2Vzc09yZGVyIH0gZnJvbSAnLi9vcmRlci1jb3JlLmpzJzs=|aW1wb3J0IHsgcHJvY2Vzc09yZGVyIH0gZnJvbSAnLi9vcmRlci1jb3JlLmpzJzsKaW1wb3J0IHsgaW52b2ljZUZvclBheUxpbmsgfSBmcm9tICcuL2ludm9pY2UtY29yZS5qcyc7'
    'functions/stripe-webhook.js|wh-paylink|ICAgIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoeyByZWNlaXZlZDogdHJ1ZSwgaWdub3JlZDogJ25vdC1wY3RpcmVzJyB9KSwgeyBzdGF0dXM6IDIwMCB9KTsKICB9|ICAgIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoeyByZWNlaXZlZDogdHJ1ZSwgaWdub3JlZDogJ25vdC1wY3RpcmVzJyB9KSwgeyBzdGF0dXM6IDIwMCB9KTsKICB9CgogIC8vIFBheSBsaW5rcyBoYXZlIG5vIG9yZGVyIHRvIHBsYWNlOiBqdXN0IG1ha2Ugc3VyZSB0aGUgcGF5bWVudCBoYXMgYW4gaW52b2ljZQogIC8vIG51bWJlciAoaW4gY2FzZSB0aGUgY3VzdG9tZXIgY2xvc2VkIHRoZSBwYWdlIGJlZm9yZSB0aGUgcmVjZWlwdCBzdGVwKSBhbmQgYWNrLgogIGlmIChwaS5tZXRhZGF0YT8ua2luZCA9PT0gJ3BheWxpbmsnKSB7CiAgICB0cnkgeyBhd2FpdCBpbnZvaWNlRm9yUGF5TGluayhlbnYsIHBpLCB7fSk7IH0gY2F0Y2ggKGUpIHsgY29uc29sZS5lcnJvcigncGF5bGluayBpbnZvaWNlJywgZSk7IH0KICAgIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoeyByZWNlaXZlZDogdHJ1ZSwgcGF5bGluazogdHJ1ZSB9KSwgeyBzdGF0dXM6IDIwMCB9KTsKICB9'
)

foreach ($nf in @('functions\invoice-core.js', 'functions\terminal.js', 'functions\reader-core.js', 'reader.html')) {
    if (-not (Test-Path (Join-Path $repo $nf))) { throw "Missing file $nf - stop, tell Claude." }
}
if (-not ([IO.File]::ReadAllText((Join-Path $repo 'functions\terminal.js'), $utf8)).Contains('paid_other')) { throw "terminal.js is the old version - stop, tell Claude." }

$text = @{}; $orig = @{}
foreach ($row in $rows) {
    $p = $row.Split('|')
    $path = Join-Path $repo $p[0]
    if (-not $text.ContainsKey($p[0])) { $orig[$p[0]] = [IO.File]::ReadAllText($path, $utf8); $text[$p[0]] = $orig[$p[0]] }
    $find = D $p[2]; $rep = D $p[3]
    if ($text[$p[0]].Contains($rep)) { throw "$($p[1]): already applied - nothing written." }
    $n = ([regex]::Matches($text[$p[0]], [regex]::Escape($find))).Count
    if ($n -ne 1) { throw "$($p[1]): anchor found $n times in $($p[0]) (expected 1) - nothing written." }
}
foreach ($row in $rows) {
    $p = $row.Split('|')
    $text[$p[0]] = $text[$p[0]].Replace((D $p[2]), (D $p[3]))
}
foreach ($k in $text.Keys) {
    $delta = ($text[$k].Split("`n").Count) - ($orig[$k].Split("`n").Count)
    if ($delta -lt 0 -or $delta -gt 40) { throw "$k line change $delta looks wrong - nothing written." }
}
New-Item -ItemType Directory -Force -Path $bakDir | Out-Null
foreach ($k in $text.Keys) {
    $src = Join-Path $repo $k
    Copy-Item $src (Join-Path $bakDir ($k -replace '[\\/]', '__'))
    [IO.File]::WriteAllText($src, $text[$k], $utf8)
}
Write-Host ""
Write-Host "Invoice number patch applied (4 files)." -ForegroundColor Green
Write-Host "Backups: $bakDir"
Write-Host ""
Write-Host "BEFORE pushing: add the INVOICE_DB binding in Cloudflare (see Claude's message)." -ForegroundColor Yellow
Write-Host "Then: .\push-pctires.ps1"
