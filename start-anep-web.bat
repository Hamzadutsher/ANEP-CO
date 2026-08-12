@echo off
title ANEP MOD - Serveur Web
cd /d "%~dp0"
echo ============================================
echo   ANEP MOD - Demarrage du serveur web...
echo ============================================
node server.js
echo.
echo Le serveur s'est arrete. Fermeture dans 10s...
timeout /t 10 >nul
