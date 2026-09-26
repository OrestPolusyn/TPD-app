@echo off
rem Windows: double-click to start.
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo Pershyi zapusk: vstanovliuiu potribne...
  py -3 -m venv .venv || python -m venv .venv
  .venv\Scripts\python -m pip install -q -r requirements.txt
)
.venv\Scripts\python collector.py
pause
