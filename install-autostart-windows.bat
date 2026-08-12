@echo off
title ANEP MOD - Installer le demarrage automatique
setlocal
set "APPDIR=%~dp0"
echo Installation du demarrage automatique du serveur ANEP MOD...
echo (le serveur demarrera a chaque ouverture de session Windows)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$sc=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\ANEP MOD Web.lnk'); $sc.TargetPath='%APPDIR%start-anep-web.bat'; $sc.WorkingDirectory='%APPDIR%'; $sc.WindowStyle=7; $sc.Description='Serveur web ANEP MOD'; $sc.Save()"
if %errorlevel%==0 (
  echo.
  echo [OK] Demarrage automatique installe.
  echo Le serveur ANEP MOD demarrera automatiquement a la prochaine ouverture de session.
) else (
  echo [ERREUR] Installation echouee.
)
echo.
pause
