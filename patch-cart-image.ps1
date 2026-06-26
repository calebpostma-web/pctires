# patch-cart-image.ps1
# Adds product photo thumbnails to the cart + a click-to-enlarge lightbox.
# Fixes: customers opening a shared quote link could not see product pictures.
# Safe: backs up index.html, aborts if any anchor is missing/duplicated, verifies result.
$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$file = Join-Path $ScriptDir 'index.html'
if(-not (Test-Path $file)){ Write-Host 'ERROR: index.html not found next to this script.' -ForegroundColor Red; exit 1 }
$enc = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText($file)
$fileNl = if($content.Contains("`r`n")){ "`r`n" } else { "`n" }
function Norm([string]$s){ $t = $s -replace "`r`n","`n"; if($fileNl -eq "`r`n"){ $t = $t -replace "`n","`r`n" }; return $t }
$lines0 = ([regex]::Matches($content, "`n")).Count + 1
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$file.bak-cartimg-$stamp"
[System.IO.File]::WriteAllText($backup, $content, $enc)
Write-Host "Backup written: $backup"

$old_css = @'
.ci-icon{width:58px;height:58px;background:var(--raised);border:1px solid var(--border);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
'@
$new_css = @'
.ci-icon{width:58px;height:58px;background:var(--raised);border:1px solid var(--border);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
.ci-icon.has-img{cursor:pointer;padding:3px;position:relative;overflow:hidden}
.ci-icon.has-img img{width:100%;height:100%;object-fit:contain;display:block}
.ci-icon .ci-zoom{position:absolute;right:1px;bottom:1px;font-size:9px;line-height:1;background:rgba(0,0,0,.62);color:var(--yellow);padding:2px;border-radius:2px;pointer-events:none}
#cartImgOverlay{z-index:1200}
.cart-img-box{background:var(--card);border:1px solid var(--border);border-radius:3px;width:420px;max-width:90vw;padding:18px;position:relative}
.cart-img-box .close-x{position:absolute;right:12px;top:8px}
.cart-img-stage{background:var(--raised);border:1px solid var(--border);border-radius:2px;min-height:240px;display:flex;align-items:center;justify-content:center;padding:16px}
.cart-img-stage img{max-width:100%;max-height:58vh;object-fit:contain}
.cart-img-cap{text-align:center;margin-top:12px;font-family:'Barlow Condensed',sans-serif;font-weight:800;text-transform:uppercase;font-size:17px}
'@
$old_html = @'
<!-- SHARE QUOTE MODAL (owner only) -->
'@
$new_html = @'
<!-- CART IMAGE LIGHTBOX -->
<div class="overlay center" id="cartImgOverlay" onclick="bgClose(event,'cartImgOverlay')">
  <div class="cart-img-box">
    <button class="close-x" onclick="closeCartImage()">&times;</button>
    <div class="cart-img-stage"><img id="cartImgFull" src="" alt=""></div>
    <div class="cart-img-cap" id="cartImgCap"></div>
  </div>
</div>

<!-- SHARE QUOTE MODAL (owner only) -->
'@
$old_rc = @'
<div class="ci-icon">${icon}</div>
'@
$new_rc = @'
${cartIconHtml(item, icon)}
'@
$old_js = @'
function closeTireDetail() {
  document.getElementById('tireDetailOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
'@
$new_js = @'
function closeTireDetail() {
  document.getElementById('tireDetailOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

// --- Cart product image: thumbnail in cart + click-to-enlarge lightbox ---
function cartIconHtml(item, icon){
  if(item && item.imageUrl){
    var alt = ((item.brand||'')+' '+(item.name||'')).replace(/"/g,'').replace(/</g,'');
    var num = String(item.itemNumber).replace(/'/g,'');
    return '<div class="ci-icon has-img" onclick="openCartImage(\'' + num + '\')" title="View larger">'
      + '<img src="' + item.imageUrl + '" alt="' + alt + '" onerror="cartImgFallback(this)">'
      + '<span class="ci-emoji" style="display:none">' + icon + '</span>'
      + '<span class="ci-zoom">&#128269;</span></div>';
  }
  return '<div class="ci-icon">' + icon + '</div>';
}
function cartImgFallback(img){
  img.style.display='none';
  var p=img.parentNode; if(!p) return;
  p.classList.remove('has-img'); p.removeAttribute('onclick'); p.removeAttribute('title');
  var e=p.querySelector('.ci-emoji'); if(e) e.style.display='flex';
}
function openCartImage(itemNumber){
  var item=(cart||[]).find(function(c){return c.itemNumber===itemNumber;});
  if(!item || !item.imageUrl) return;
  var img=document.getElementById('cartImgFull');
  var cap=document.getElementById('cartImgCap');
  var title=((item.brand||'')+' '+(item.name||'')).trim();
  var size=item.size || (item.diameter ? (item.diameter+'\" - '+(item.boltPattern||'')) : '');
  if(cap){ cap.innerHTML='<div>'+escapeHtml(title)+'</div>'+(size?'<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--muted);font-weight:400;margin-top:4px">'+escapeHtml(size)+'</div>':''); }
  if(img){
    img.style.display='';
    img.onerror=function(){ this.style.display='none'; if(cap) cap.innerHTML += '<div style="font-size:12px;color:var(--muted);font-weight:400;text-transform:none;margin-top:8px">Image preview unavailable</div>'; };
    img.alt=title;
    img.src=item.imageUrl;
  }
  var ov=document.getElementById('cartImgOverlay'); if(ov) ov.classList.add('show');
}
function closeCartImage(){
  var ov=document.getElementById('cartImgOverlay'); if(ov) ov.classList.remove('show');
  var img=document.getElementById('cartImgFull'); if(img){ img.src=''; img.style.display=''; img.onerror=null; }
}
'@

$pairs = @(
  @{ label='CSS (cart thumb + lightbox styles)'; old=$old_css;  new=$new_css },
  @{ label='HTML (lightbox overlay)';            old=$old_html; new=$new_html },
  @{ label='renderCart (clickable thumbnail)';   old=$old_rc;   new=$new_rc },
  @{ label='JS (lightbox functions)';            old=$old_js;   new=$new_js }
)

foreach($p in $pairs){
  $o = Norm $p.old; $w = Norm $p.new
  $n = ([regex]::Matches($content, [regex]::Escape($o))).Count
  if($n -ne 1){ Write-Host "ABORT: anchor [$($p.label)] found $n time(s), expected 1. No changes written." -ForegroundColor Red; exit 1 }
  $content = $content.Replace($o, $w)
  Write-Host "  applied: $($p.label)" -ForegroundColor Green
}

$need = @('openCartImage','cartIconHtml','cartImgFallback','id="cartImgOverlay"','.ci-icon.has-img','closeCartImage')
foreach($t in $need){ if(-not $content.Contains($t)){ Write-Host "ABORT: expected token missing: $t" -ForegroundColor Red; exit 1 } }
if($content.Contains((Norm $old_rc))){ Write-Host 'ABORT: old icon pattern still present.' -ForegroundColor Red; exit 1 }

[System.IO.File]::WriteAllText($file, $content, $enc)
$lines1 = ([regex]::Matches($content, "`n")).Count + 1
Write-Host ""
Write-Host "SUCCESS. index.html patched ($lines0 -> $lines1 lines)." -ForegroundColor Cyan
Write-Host "Review locally, then deploy with:  .\push-pctires.ps1" -ForegroundColor Yellow
