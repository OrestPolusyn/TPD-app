#!/bin/bash
# macOS: double-click to start. The first start installs what it needs
# into a .venv folder here (about a minute), later starts are instant.
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Потрібен Python 3. Встановіть його з https://www.python.org/downloads/ і запустіть знову."
  read -r -p "Натисніть Enter, щоб закрити…"
  exit 1
fi
if [ ! -x .venv/bin/python ]; then
  echo "Перший запуск: встановлюю потрібне…"
  python3 -m venv .venv && ./.venv/bin/pip install -q --upgrade pip && ./.venv/bin/pip install -q -r requirements.txt || {
    rm -rf .venv
    read -r -p "Не вдалося встановити. Натисніть Enter, щоб закрити…"
    exit 1
  }
fi
./.venv/bin/python collector.py
