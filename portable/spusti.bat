@echo off
where node.exe >nul 2>&1 || PowerShell.exe -File installnode.ps1
start node server.js
sleep 1
start http://localhost:8034