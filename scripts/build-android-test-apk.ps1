# Builds a standalone Android test APK (fake store, debug-signed: not for the Play Store).
# Windows has a 260-character path limit that the native build breaks from E:\PP\dice-den,
# so the build runs in a git worktree at a short path. It builds the latest commit on main,
# so commit first. Run from the project folder:
#   powershell -File scripts\build-android-test-apk.ps1
param(
  [string]$BuildDir = 'E:\dd',
  [string]$Abis = 'arm64-v8a,x86_64'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path $BuildDir)) {
  git -C $repo worktree add --detach $BuildDir main
} else {
  git -C $BuildDir checkout --detach main
}
Write-Host "Building $(git -C $BuildDir log --oneline -1)"

# Reinstall packages only when the lockfile changed since the last build.
$lockHash = (Get-FileHash "$BuildDir\package-lock.json").Hash
$stamp = "$BuildDir\node_modules\.lock-hash"
if (-not (Test-Path $stamp) -or (Get-Content $stamp) -ne $lockHash) {
  Push-Location $BuildDir; npm ci; Pop-Location
  Set-Content $stamp $lockHash
}

$env:EXPO_PUBLIC_FAKE_STORE = '1'
$env:NODE_ENV = 'production'
Push-Location $BuildDir
npx expo prebuild -p android --no-install
Pop-Location

# Prebuild can recreate android/, which drops the SDK location.
$sdk = "$env:LOCALAPPDATA\Android\Sdk" -replace '\\', '\\' -replace ':', '\:'
Set-Content -Encoding ascii "$BuildDir\android\local.properties" "sdk.dir=$sdk"

Push-Location "$BuildDir\android"
.\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Abis"
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "Gradle build failed ($code)" }

New-Item -ItemType Directory -Force "$repo\dist" | Out-Null
Copy-Item "$BuildDir\android\app\build\outputs\apk\release\app-release.apk" "$repo\dist\dice-den-test.apk" -Force
Write-Host "APK: $repo\dist\dice-den-test.apk"
