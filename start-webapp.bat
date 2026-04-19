@echo off
setlocal
set "ROOT=%~dp0"
pushd "%ROOT%"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js が見つかりません。winget でインストールします...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo winget が見つかりません。Node.js LTS を手動で入れてください。
    popd
    exit /b 1
  )
  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo Node.js のインストールに失敗しました。
    popd
    exit /b 1
  )
)

if not exist "node_modules\" (
  echo 依存関係をインストールします...
  call npm install
  if errorlevel 1 (
    echo npm install に失敗しました。
    popd
    exit /b 1
  )
)

start "Equirectangular Editor" cmd /k "npm run dev"

set "READY=0"
for /l %%i in (1,1,60) do (
  powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5173/ -TimeoutSec 2).StatusCode -eq 200 } catch { $false }" | findstr /c:"True" >nul
  if not errorlevel 1 (
    set "READY=1"
    goto :open
  )
  timeout /t 1 >nul
)

:open
start "" "http://127.0.0.1:5173/"

popd
endlocal
