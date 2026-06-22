@echo off
chcp 65001 >nul
title Monitor Quiniela (En Vivo)
cd /d "%~dp0"

echo ===============================================
echo    MONITOR DE LA QUINIELA  -  marcadores en vivo
echo ===============================================
echo.

REM --- Revisa que el secreto este configurado en este equipo ---
if "%MONITOR_SECRET%"=="" (
  echo  [!] No encuentro MONITOR_SECRET en esta computadora.
  echo      Hay que configurarlo una sola vez ^(pidele ayuda a Moi^).
  echo.
  pause
  exit /b 1
)

REM --- Ruta de Chrome por defecto si no esta configurada (respeta la que ya exista) ---
if "%PARTIDO_CHROME_PATH%"=="" set "PARTIDO_CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"

echo  Arrancando el monitor... DEJA ESTA VENTANA ABIERTA.
echo  (Empuja los goles de los partidos en vivo a la quiniela.)
echo  Para detenerlo: haz clic en esta ventana y presiona Ctrl + C.
echo.

call npm run monitor

echo.
echo ===============================================
echo  El monitor se detuvo. Ya puedes cerrar la ventana.
echo ===============================================
pause
