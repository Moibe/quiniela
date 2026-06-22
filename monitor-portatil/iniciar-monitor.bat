@echo off
chcp 65001 >nul
title Monitor Quiniela (En Vivo)
cd /d "%~dp0"

echo ===============================================
echo    MONITOR DE LA QUINIELA  -  marcadores en vivo
echo ===============================================
echo.

REM --- 1) Node: usa el portatil (node.exe en esta carpeta) si existe; si no, el del sistema ---
set "NODE=node"
if exist "%~dp0node.exe" set "NODE=%~dp0node.exe"
if "%NODE%"=="node" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo  [!] No hay Node.js en este equipo.
    echo      Opcion A: instalalo de https://nodejs.org  -  version LTS.
    echo      Opcion B: pidele a Moi el paquete que YA trae Node incluido,
    echo               ese NO necesita instalar nada ni permisos de admin.
    echo.
    pause
    exit /b 1
  )
)

REM --- 2) El secreto? (archivo secreto.txt en esta misma carpeta) ---
if not exist "secreto.txt" (
  echo  [!] Falta el archivo secreto.txt en esta carpeta.
  echo      Pidele a Moi ese archivo y ponlo aqui, junto a este programa.
  echo.
  pause
  exit /b 1
)
set /p MONITOR_SECRET=<secreto.txt

REM --- 3) Chrome? (usa la ruta normal si no esta configurada) ---
if "%PARTIDO_CHROME_PATH%"=="" set "PARTIDO_CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%PARTIDO_CHROME_PATH%" if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "PARTIDO_CHROME_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not exist "%PARTIDO_CHROME_PATH%" if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "PARTIDO_CHROME_PATH=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
if not exist "%PARTIDO_CHROME_PATH%" (
  echo  [!] No encontre Google Chrome ni Microsoft Edge.
  echo      Instala alguno, o edita este .bat con el Bloc de notas y pon en
  echo      PARTIDO_CHROME_PATH la ruta real de chrome.exe o msedge.exe.
  echo.
  pause
  exit /b 1
)

REM --- 4) Dependencias (solo la primera vez; necesita internet) ---
if not exist "node_modules\playwright-core" (
  echo  Primera vez: instalando dependencias... necesita internet, ~1 min.
  call npm install
  echo.
)

echo  Arrancando el monitor... DEJA ESTA VENTANA ABIERTA.
echo  Empuja los goles de los partidos en vivo a la quiniela.
echo  Para detenerlo: clic en esta ventana y presiona Ctrl + C.
echo.

"%NODE%" monitor-runner.mjs

echo.
echo ===============================================
echo  El monitor se detuvo. Ya puedes cerrar la ventana.
echo ===============================================
pause
