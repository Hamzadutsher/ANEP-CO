@echo off
title ANEP MOD - Desinstaller le demarrage automatique
echo Suppression du demarrage automatique du serveur ANEP MOD...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p=[Environment]::GetFolderPath('Startup')+'\ANEP MOD Web.lnk'; if(Test-Path $p){Remove-Item $p -Force; Write-Host '[OK] Demarrage automatique supprime.'} else {Write-Host 'Aucun demarrage automatique trouve.'}"
echo.
pause
