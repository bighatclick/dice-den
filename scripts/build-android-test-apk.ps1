# Builds a standalone Android test APK. It is signed with the upload key when
# ~/.gradle/gradle.properties names one (plugins/withReleaseSigning.js), else with the debug key.
# Ads and purchases stay off unless EXPO_PUBLIC_MONETIZATION=1 is set; only then does it
# use the fake store, so a normal build has no way to grant purchases.
# Windows has a 260-character path limit that the native build breaks from E:\PP\dice-den,
# so the build runs in a git worktree at a short path. It builds -Ref (default: local main),
# so commit first. Run from the project folder:
#   powershell -File scripts\build-android-test-apk.ps1
param(
  [string]$BuildDir = 'E:\dd',
  # Branch or commit to build. Default is the local main branch.
  [string]$Ref = 'main',
  [string]$Abis = 'arm64-v8a,x86_64',
  # Turns ads and purchases on (src/config/features.ts) for the e2e fakestore suite.
  # The output is then dist\dice-den-test-monetized.apk, so it is never mistaken for the shipping build.
  [switch]$Monetization,
  # Makes a development build behave as if in the EEA, so Google's consent form shows (e2e eea suite).
  [switch]$DebugEea
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path $BuildDir)) {
  git -C $repo worktree add --detach $BuildDir $Ref
} else {
  git -C $BuildDir checkout --detach $Ref
}
Write-Host "Building $(git -C $BuildDir log --oneline -1)"

# Reinstall packages only when the lockfile changed since the last build.
$lockHash = (Get-FileHash "$BuildDir\package-lock.json").Hash
$stamp = "$BuildDir\node_modules\.lock-hash"
if (-not (Test-Path $stamp) -or (Get-Content $stamp) -ne $lockHash) {
  Push-Location $BuildDir; npm ci; Pop-Location
  Set-Content $stamp $lockHash
}

$env:NODE_ENV = 'production'
if ($Monetization) { $env:EXPO_PUBLIC_MONETIZATION = '1' } else { Remove-Item Env:EXPO_PUBLIC_MONETIZATION -ErrorAction SilentlyContinue }
if ($DebugEea) { $env:EXPO_PUBLIC_UMP_DEBUG_EEA = '1' } else { Remove-Item Env:EXPO_PUBLIC_UMP_DEBUG_EEA -ErrorAction SilentlyContinue }
# The fake store exists only in a monetized build, so a normal build has no way to grant purchases.
if ($env:EXPO_PUBLIC_MONETIZATION -eq '1') { $env:EXPO_PUBLIC_FAKE_STORE = '1' } else { Remove-Item Env:EXPO_PUBLIC_FAKE_STORE -ErrorAction SilentlyContinue }
$apkName = if ($Monetization) { 'dice-den-test-monetized.apk' } else { 'dice-den-test.apk' }

# Regenerate android/ only when its inputs changed: regenerating forces a full native
# rebuild (over an hour), while a JS-only change rebuilds in minutes.
$inputs = @('app.json', 'app.config.js', 'package-lock.json') + (Get-ChildItem "$BuildDir\plugins" -File | ForEach-Object { "plugins\$($_.Name)" })
$nativeHash = ($inputs | ForEach-Object { (Get-FileHash "$BuildDir\$_").Hash }) -join ''
$nativeStamp = "$BuildDir\android\.prebuild-hash"
if (-not (Test-Path $nativeStamp) -or (Get-Content $nativeStamp) -ne $nativeHash) {
  Push-Location $BuildDir
  npx expo prebuild -p android --no-install
  Pop-Location
  # Prebuild can recreate android/, which drops the SDK location.
  $sdk = "$env:LOCALAPPDATA\Android\Sdk" -replace '\\', '\\' -replace ':', '\:'
  Set-Content -Encoding ascii "$BuildDir\android\local.properties" "sdk.dir=$sdk"
  Set-Content $nativeStamp $nativeHash
}

Push-Location "$BuildDir\android"
.\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Abis"
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "Gradle build failed ($code)" }

New-Item -ItemType Directory -Force "$repo\dist" | Out-Null
Copy-Item "$BuildDir\android\app\build\outputs\apk\release\app-release.apk" "$repo\dist\$apkName" -Force
Write-Host "APK: $repo\dist\$apkName"
