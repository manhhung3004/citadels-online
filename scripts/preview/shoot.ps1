# Chụp màn hình giao diện bằng Edge headless (chạy trên Windows, cần `npm run preview` đang chạy trong WSL).
# Ví dụ:  .\scripts\preview\shoot.ps1 -Views turn,draft,gallery
#         .\scripts\preview\shoot.ps1 -Views gallery -Query '?only3d&h=900'   # chỉ khung 3D, phóng to
# Điện thoại (Edge không cho cửa sổ hẹp hơn ~500px → nhúng iframe qua device.html):
#         .\scripts\preview\shoot.ps1 -Views turn -Device 390x844      # ảnh: shot-turn-390x844.png
param(
  [string[]]$Views = @('turn'),
  [string]$Size = '1440,1400',
  [string]$Query = '',
  [int]$WaitMs = 5000,
  [string]$Device = '',
  [string]$OutDir = "$env:TEMP\citadels-shots"
)
New-Item -ItemType Directory -Force $OutDir | Out-Null
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
foreach ($v in $Views) {
  $url = "http://localhost:3200/preview.html$Query#$v"
  $win = $Size
  $out = Join-Path $OutDir "shot-$v.png"
  if ($Device) {
    $w, $h = $Device -split 'x'
    $lang = if ($Query -match 'lang=en') { '&lang=en' } else { '' }
    $url = "http://localhost:3200/device.html?w=$w&h=$h$lang#$v"
    $win = "$([Math]::Max([int]$w, 520)),$h"
    $out = Join-Path $OutDir "shot-$v-$Device.png"
  }
  if (Test-Path $out) { Remove-Item $out }
  & $edge --headless=new --disable-gpu --hide-scrollbars "--virtual-time-budget=$WaitMs" "--window-size=$win" "--screenshot=$out" $url 2>$null | Out-Null
  if (Test-Path $out) { "ok   $out" } else { "FAIL $v" }
}
