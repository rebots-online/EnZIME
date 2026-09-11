@echo off
setlocal
cd /d "%~dp0"
set "ENZIME_NODE=node"
if exist "%~dp0runtime\node.exe" set "ENZIME_NODE=%~dp0runtime\node.exe"
"%ENZIME_NODE%" -e "if(Number(process.versions.node.split('.')[0])<24){console.error('EnZIME requires Node 24 or later.');process.exit(1)}" >nul 2>&1
if errorlevel 1 (
  echo EnZIME requires Node 24 or later on PATH. Install Node, reopen this terminal, and retry.
  exit /b 1
)
if not exist "%~dp0node_modules\linkedom\package.json" (
  echo Dependencies are missing. Run npm ci and npm run build in this directory first.
  exit /b 1
)
if not exist "%~dp0public\vendor\pdfjs\build\pdf.mjs" (
  echo Browser bundles are missing. Run npm run build in this directory first.
  exit /b 1
)
if exist "%~dp0node_modules\.enzime-platform" (
  set /p ENZIME_DEP_PLATFORM=<"%~dp0node_modules\.enzime-platform"
  call :checkplatform
  if errorlevel 1 exit /b 1
)
if "%MBA_ROBIN_PORTABLE%"=="1" if not defined MBA_ROBIN_HOME set "MBA_ROBIN_HOME=%~dp0data\mba.robin"
if not defined PORT set "PORT=4173"
echo Open http://127.0.0.1:%PORT% after the server starts. Press Ctrl+C to stop.
"%ENZIME_NODE%" "%~dp0server.mjs"
exit /b %ERRORLEVEL%
:checkplatform
if not "%ENZIME_DEP_PLATFORM:~0,5%"=="win32" (
  echo These dependencies were installed on another operating system.
  echo Run npm ci in this directory to install Windows dependencies, then launch again.
  exit /b 1
)
exit /b 0
