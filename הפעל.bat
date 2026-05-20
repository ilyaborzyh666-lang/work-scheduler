@echo off
title סידור עבודה
echo מפעיל סידור עבודה...

:: הפעל Expo ברקע
start /min cmd /c "cd /d "%~dp0" && npx expo start --port 8081"

:: המתן 8 שניות
timeout /t 8 /nobreak >nul

:: פתח בEdge כאפליקציה (ללא toolbar)
start msedge --app=http://localhost:8081 --window-size=1280,800

echo האפליקציה פועלת!
