# Runs the Android emulator suite (e2e/android, Maestro) against a built APK.
# It installs the APK, runs the static checks (permissions, signing, test ad ids, target SDK,
# cold start, size), puts the device into the state each group needs (font size, dark mode,
# rotation), runs the flows, then restores the device and writes JUnit reports and
# screenshots to reports\android\<timestamp>-<suite>\.
#
#   powershell -File scripts\android-e2e.ps1                       # release: the shipping build
#   powershell -File scripts\android-e2e.ps1 -Suite visual
#   powershell -File scripts\android-e2e.ps1 -Suite tablet -Avd DiceDenTablet
#   powershell -File scripts\android-e2e.ps1 -Suite checks         # static checks only
#   powershell -File scripts\android-e2e.ps1 -Suite monetized -Apk dist\dice-den-test-monetized.apk
#
# Ads and purchases are switched off in the app (src/config/features.ts). The default suites
# test that build. The parked flows in e2e\android\monetized run only with -Suite monetized,
# against a build made with scripts\build-android-test-apk.ps1 -Monetization.
param(
  [ValidateSet('release', 'visual', 'tablet', 'long', 'checks', 'all', 'monetized')]
  [string]$Suite = 'release',
  [string]$Apk = '',
  [string]$Avd = 'DiceDenPhone',
  [switch]$NoInstall,
  [switch]$KeepDeviceState
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$adb = "$sdk\platform-tools\adb.exe"
$emulator = "$sdk\emulator\emulator.exe"
$buildTools = Get-ChildItem "$sdk\build-tools" -Directory -ErrorAction SilentlyContinue | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
$aapt2 = if ($buildTools) { "$($buildTools.FullName)\aapt2.exe" } else { $null }
$apksigner = if ($buildTools) { "$($buildTools.FullName)\apksigner.bat" } else { $null }
$maestro = if (Get-Command maestro -ErrorAction SilentlyContinue) { 'maestro' } elseif (Test-Path "$env:USERPROFILE\.maestro\bin\maestro.bat") { "$env:USERPROFILE\.maestro\bin\maestro.bat" } else { $null }
$pkg = 'com.dicedengame.app'
$monetized = $Suite -eq 'monetized'
if (-not (Test-Path $adb)) { throw "adb not found at $adb; set ANDROID_HOME" }
if (-not $maestro -and $Suite -ne 'checks') { throw "Maestro not found. Unzip the release into $env:USERPROFILE\.maestro (see docs/android-test-suite.md)" }
$env:ANDROID_HOME = $sdk
$env:Path = "$env:Path;$sdk\platform-tools;$sdk\emulator"

if (-not $Apk) { $Apk = if ($monetized) { "$repo\dist\dice-den-test-monetized.apk" } else { "$repo\dist\dice-den-test.apk" } }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = "$repo\reports\android\$stamp-$Suite"
New-Item -ItemType Directory -Force $out | Out-Null
$log = "$out\run.log"
function Log($text) { $line = "$(Get-Date -Format HH:mm:ss) $text"; Write-Host $line; Add-Content $log $line }

# 1. A booted emulator.
$devices = (& $adb devices) -match 'emulator-\d+\s+device'
if (-not $devices) {
  Log "Starting emulator $Avd"
  Start-Process $emulator -ArgumentList "-avd $Avd -no-snapshot-load" | Out-Null
  & $adb wait-for-device
  do { Start-Sleep 3; $booted = (& $adb shell getprop sys.boot_completed 2>$null).Trim() } while ($booted -ne '1')
  Start-Sleep 5
}
$serial = ((& $adb devices) -match 'emulator-\d+\s+device' | Select-Object -First 1) -replace '\s+device.*', ''
Log "Device $serial, API $(& $adb -s $serial shell getprop ro.build.version.sdk), model $(& $adb -s $serial shell getprop ro.product.model)"
# A slow emulator throws "isn't responding" dialogs over the app; keep them out of the flows.
& $adb -s $serial shell settings put global hide_error_dialogs 1 | Out-Null
& $adb -s $serial shell settings put global window_animation_scale 0 | Out-Null
& $adb -s $serial shell settings put global transition_animation_scale 0 | Out-Null
& $adb -s $serial shell settings put global animator_duration_scale 0 | Out-Null

# 2. The APK.
if (-not (Test-Path $Apk)) { throw "APK not found: $Apk (build it with scripts\build-android-test-apk.ps1)" }
if (-not $NoInstall) {
  Log "Installing $Apk"
  & $adb -s $serial install -r -d $Apk | Out-Null
}

# 3. Static checks: the release-prep items from the security audit plus specs.md §13.
$checks = @()
function Check($name, $pass, $detail) { $script:checks += [pscustomobject]@{ check = $name; pass = [bool]$pass; detail = "$detail" } }

$perms = (& $adb -s $serial shell dumpsys package $pkg) -match 'permission\.' | ForEach-Object { ($_ -split ':')[0].Trim() } | Where-Object { $_ -match '^[\w.]+permission\.[\w.]+$' } | Sort-Object -Unique
$privacy = $perms | Where-Object { $_ -match 'CAMERA|CONTACTS|LOCATION|RECORD_AUDIO|READ_MEDIA|EXTERNAL_STORAGE|CALL_|SMS|CALENDAR|BLUETOOTH' }
Check 'S1 No camera, contacts, location, mic, storage, phone, SMS, calendar or Bluetooth permission (CLAUDE.md rule 7)' ($privacy.Count -eq 0) ($perms -join ', ')
if (-not $monetized) {
  $adsPerms = $perms | Where-Object { $_ -match 'AD_ID|ADSERVICES|vending\.BILLING' }
  Check 'S2 With ads and purchases switched off, no ad-id, ad-services or billing permission is requested (security audit)' ($adsPerms.Count -eq 0) ($(if ($adsPerms) { $adsPerms -join ', ' } else { 'none' }))
}

if ($aapt2 -and (Test-Path $aapt2)) {
  $badging = & $aapt2 dump badging $Apk 2>$null
  $targetSdk = [int](($badging | Select-String "targetSdkVersion:'(\d+)'").Matches.Groups[1].Value)
  Check 'S3 targetSdkVersion is 35 or higher (Google Play requirement for new apps)' ($targetSdk -ge 35) "targetSdkVersion $targetSdk"
  $manifest = & $aapt2 dump xmltree --file AndroidManifest.xml $Apk 2>$null
  $debuggable = ($manifest | Select-String 'android:debuggable.*=true').Count -gt 0
  Check 'S4 Not debuggable' (-not $debuggable) ($(if ($debuggable) { 'android:debuggable=true' } else { 'debuggable not set' }))
  $testAdId = ($manifest | Select-String '3940256099942544').Count -gt 0
  Check 'S5 No Google test AdMob app id in the manifest (security audit)' (-not $testAdId) ($(if ($testAdId) { 'ca-app-pub-3940256099942544 found' } else { 'none' }))
  $versionName = ($badging | Select-String "versionName='([^']+)'").Matches.Groups[1].Value
  $versionCode = ($badging | Select-String "versionCode='(\d+)'").Matches.Groups[1].Value
  Log "APK version $versionName ($versionCode)"
} else { Log 'aapt2 not found: skipping manifest checks' }

if ($apksigner -and (Test-Path $apksigner)) {
  $certs = & $apksigner verify --print-certs $Apk 2>&1 | Out-String
  $debugKey = $certs -match 'Android Debug' -or $certs -match 'CN=Android Debug'
  Check 'S6 Signed with a release key, not the debug key (security audit; a Play upload needs the upload key)' (-not $debugKey) (($certs -split "`n" | Select-String 'DN:' | Select-Object -First 1).ToString().Trim())
} else { Log 'apksigner not found: skipping the signing check' }

& $adb -s $serial shell am force-stop $pkg | Out-Null
$start = & $adb -s $serial shell am start -W -n "$pkg/.MainActivity" 2>&1
$total = [int](($start | Select-String 'TotalTime:\s+(\d+)').Matches.Groups[1].Value)
# The emulator on this i3 is 3-4x slower than a phone; 8 s here is the proxy for specs.md's 2 s on an iPhone 11.
Check 'S7 Cold start to first frame under 8 s on the emulator (proxy for 2 s on a phone, specs.md)' ($total -gt 0 -and $total -lt 8000) "TotalTime ${total} ms"
$mb = [math]::Round((Get-Item $Apk).Length / 1MB, 1)
Check 'S8 APK under 80 MB (specs.md R21)' ($mb -lt 80) "$mb MB"

$checks | ConvertTo-Json | Set-Content "$out\static-checks.json"
foreach ($c in $checks) { Log ("[{0}] {1} ({2})" -f $(if ($c.pass) { 'PASS' } else { 'FAIL' }), $c.check, $c.detail) }
$staticFailed = ($checks | Where-Object { -not $_.pass }).Count
if ($Suite -eq 'checks') { exit $staticFailed }

# 4. Device state per group, restored afterwards.
$groups = switch ($Suite) {
  'all' { @('release', 'long', 'visual-landscape', 'visual-fontscale', 'visual-darkmode') }
  'visual' { @('visual-landscape', 'visual-fontscale', 'visual-darkmode') }
  default { @($Suite) }
}
function Reset-Device {
  if ($KeepDeviceState) { return }
  & $adb -s $serial shell settings put system font_scale 1.0 | Out-Null
  & $adb -s $serial shell cmd uimode night no | Out-Null
  & $adb -s $serial shell settings put system accelerometer_rotation 0 | Out-Null
  & $adb -s $serial shell settings put system user_rotation 0 | Out-Null
  & $adb -s $serial shell cmd connectivity airplane-mode disable 2>$null | Out-Null
}
$failed = 0
foreach ($group in $groups) {
  $tags = $group
  $flows = 'e2e\android'
  switch ($group) {
    'visual-landscape' { $tags = 'landscape'; & $adb -s $serial shell settings put system accelerometer_rotation 0; & $adb -s $serial shell settings put system user_rotation 1 }
    'visual-fontscale' { $tags = 'fontscale'; & $adb -s $serial shell settings put system font_scale 2.0; Start-Sleep 3 }
    'visual-darkmode'  { $tags = 'darkmode'; & $adb -s $serial shell cmd uimode night yes; Start-Sleep 2 }
    'monetized'        { $flows = 'e2e\android\monetized' }
  }
  Log "Running group '$group' (tags: $tags)"
  Push-Location $repo
  # Maestro logs to stderr; cmd keeps PowerShell from turning that into errors.
  cmd /c "`"$maestro`" --device $serial test --include-tags $tags --format junit --output `"$out\$group.xml`" --test-output-dir `"$out\$group`" $flows > `"$out\$group.log`" 2>&1"
  $code = $LASTEXITCODE
  Pop-Location
  $results = Select-String -Path "$out\$group.log" -Pattern '^\[(Passed|Failed)\] (.+)$' | ForEach-Object { $_.Line }
  foreach ($r in $results) { Log "  $r" }
  if ($code -ne 0) { $failed++ ; Log "Group '$group' FAILED ($code); see $out\$group.log" } else { Log "Group '$group' passed" }
  Reset-Device
}
Log "Reports: $out"
exit ($failed + $staticFailed)
