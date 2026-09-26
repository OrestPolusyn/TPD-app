#!/usr/bin/env python3
"""
TP Spain — chat collector.

A small app for your own computer: you list the Telegram groups (or their
topics) you are a member of, and it collects what was written in them over
the last N hours — for chats whose export is blocked by their admins.

It reads as you, through Telegram's user API (Telethon), the same way your
Telegram app does. Only the date, the text and a link to each message are
kept: no names, no phone numbers, no media.

Runs a tiny web page on 127.0.0.1 (not reachable from other computers) and
opens it in your browser. Everything it stores lives in ~/.tpspain-collector:
settings, collected files, and the Telegram login session. That session is
a signed-in login to your account — never send it to anyone.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import secrets
import sys
import threading
import webbrowser
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from telethon import TelegramClient, errors
except ImportError:  # pragma: no cover - explained to the person instead
    sys.exit("Telethon is not installed. Start the app with run.command (macOS) or run.bat (Windows).")

HOME = Path(os.environ.get("TPS_COLLECTOR_HOME", str(Path.home() / ".tpspain-collector")))
CONFIG_FILE = HOME / "config.json"
SESSION_FILE = HOME / "session"
EXPORTS = HOME / "exports"
PORT = int(os.environ.get("TPS_COLLECTOR_PORT", "8765"))
INDEX_HTML = Path(__file__).with_name("index.html")

# Every API call must carry this; the page gets it embedded when it loads.
# Together with the Host check below it keeps other websites open in the
# same browser from driving the app.
TOKEN = secrets.token_urlsafe(24)
ALLOWED_HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}

# A chat can be busy; this is a safety stop per chat per scan.
MAX_MESSAGES_PER_CHAT = 5000

# "Only relevant" keeps messages with one of these word starts — what the
# updates are about: documents, appointments, police, the certificate.
DEFAULT_KEYWORDS = [
    "довідк", "справк", "штамп", "печатк", "резерв", "військов", "военн", "тз", "захист", "защит",
    "cita", "сіта", "сита", "запис", "записа", "поліц", "полиц", "комісар", "комиссар", "comisar",
    "extranjer", "creade", "asilo", "protecci", "huella", "відбит", "отпечат", "nie", "tie",
    "документ", "переклад", "перевод", "присяжн", "паспорт", "відмов", "отказ", "прийма", "принима",
    "черг", "очеред", "email", "e-mail", "пошт", "почт",
]


# --------------------------------------------------------------------------- settings

def load_config() -> dict:
    config = {"api_id": "", "api_hash": "", "hours": 24, "only_relevant": False, "sources": []}
    try:
        config.update(json.loads(CONFIG_FILE.read_text(encoding="utf-8")))
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return config


def save_config(config: dict) -> None:
    HOME.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=1), encoding="utf-8")
    try:
        os.chmod(CONFIG_FILE, 0o600)
    except OSError:
        pass


def public_config(config: dict) -> dict:
    """What the page may see: the API hash is a secret, so only whether it is set."""
    shown = {k: v for k, v in config.items() if k != "api_hash"}
    shown["api_hash_set"] = bool(config.get("api_hash"))
    return shown


# --------------------------------------------------------------------------- sources

class SourceError(ValueError):
    pass


def parse_source(text: str) -> dict:
    """
    Turns what the person pasted into {ref, topic}.

    Accepts @name, name, t.me/name, t.me/name/<topic>, t.me/c/<id>/<topic>[/<msg>]
    and a numeric chat id. Invite links (t.me/+…) cannot be read without
    joining, so they are refused with a hint.
    """
    raw = text.strip()
    if not raw:
        raise SourceError("Порожнє посилання")
    raw = re.sub(r"^(https?://)?(www\.)?(t|telegram)\.me/", "", raw, flags=re.I)
    raw = raw.split("?")[0].strip("/")
    if raw.startswith("+") or raw.lower().startswith("joinchat"):
        raise SourceError("Це посилання-запрошення. Приєднайтесь до групи в Telegram і додайте її зі списку «Мої групи».")
    raw = raw.lstrip("@")

    parts = raw.split("/")
    if parts[0] == "c" and len(parts) >= 2:
        chat = parts[1]
        ref = f"-100{chat}" if chat.isdigit() else chat
        topic = int(parts[2]) if len(parts) >= 3 and parts[2].isdigit() else None
        return {"ref": ref, "topic": topic}
    if re.fullmatch(r"-?\d+", parts[0]):
        return {"ref": parts[0], "topic": None}
    if not re.fullmatch(r"[A-Za-z0-9_]{4,}", parts[0]):
        raise SourceError("Не схоже на посилання Telegram")
    topic = int(parts[1]) if len(parts) >= 2 and parts[1].isdigit() else None
    return {"ref": parts[0], "topic": topic}


def keyword_pattern(keywords: list[str]) -> re.Pattern:
    stems = sorted({k.strip().lower() for k in keywords if k.strip()}, key=len, reverse=True)
    return re.compile(r"(?<!\w)(" + "|".join(re.escape(s) for s in stems) + ")", re.I)


def message_link(entity, message_id: int) -> str:
    username = getattr(entity, "username", None)
    if username:
        return f"https://t.me/{username}/{message_id}"
    return f"https://t.me/c/{entity.id}/{message_id}"


# --------------------------------------------------------------------------- Telegram

class Telegram:
    """
    One Telethon client on its own asyncio loop in a background thread; the
    web handlers (plain threads) hand it coroutines and wait for the result.
    """

    def __init__(self) -> None:
        self.loop = asyncio.new_event_loop()
        threading.Thread(target=self.loop.run_forever, daemon=True).start()
        self.client: TelegramClient | None = None
        self.client_key: tuple | None = None
        self.phone: str | None = None
        self.phone_code_hash: str | None = None
        self.dialogs_loaded = False

    def run(self, coro, timeout: float = 900):
        return asyncio.run_coroutine_threadsafe(coro, self.loop).result(timeout)

    async def _client(self, config: dict) -> TelegramClient:
        key = (str(config.get("api_id")), config.get("api_hash"))
        if self.client is None or self.client_key != key:
            if self.client is not None:
                await self.client.disconnect()
            HOME.mkdir(parents=True, exist_ok=True)
            self.client = TelegramClient(str(SESSION_FILE), int(key[0]), key[1])
            self.client_key = key
            self.dialogs_loaded = False
        if not self.client.is_connected():
            await self.client.connect()
        return self.client

    async def status(self, config: dict) -> dict:
        if not str(config.get("api_id", "")).isdigit() or not config.get("api_hash"):
            return {"state": "needs_api"}
        client = await self._client(config)
        if not await client.is_user_authorized():
            return {"state": "needs_password" if self.phone_code_hash == "password" else "needs_login"}
        me = await client.get_me()
        return {"state": "ready", "me": " ".join(filter(None, [me.first_name, me.last_name])) or me.username or ""}

    async def send_code(self, config: dict, phone: str) -> dict:
        client = await self._client(config)
        sent = await client.send_code_request(phone)
        self.phone, self.phone_code_hash = phone, sent.phone_code_hash
        return {"state": "needs_code"}

    async def verify_code(self, config: dict, code: str) -> dict:
        client = await self._client(config)
        try:
            await client.sign_in(self.phone, code, phone_code_hash=self.phone_code_hash)
        except errors.SessionPasswordNeededError:
            self.phone_code_hash = "password"
            return {"state": "needs_password"}
        return await self.status(config)

    async def verify_password(self, config: dict, password: str) -> dict:
        client = await self._client(config)
        await client.sign_in(password=password)
        self.phone_code_hash = None
        return await self.status(config)

    async def logout(self, config: dict) -> dict:
        client = await self._client(config)
        await client.log_out()
        self.client = None
        return {"state": "needs_login"}

    async def dialogs(self, config: dict) -> list[dict]:
        client = await self._client(config)
        out = []
        async for d in client.iter_dialogs():
            if not (d.is_group or d.is_channel):
                continue
            entity = d.entity
            out.append({
                "ref": str(d.id),
                "title": d.name,
                "username": getattr(entity, "username", None),
                "forum": bool(getattr(entity, "forum", False)),
                "kind": "група" if d.is_group else "канал",
            })
        self.dialogs_loaded = True
        return out

    async def _entity(self, client: TelegramClient, ref: str):
        if re.fullmatch(r"-?\d+", ref):
            # A numeric id is only known once the chat list has been read.
            if not self.dialogs_loaded:
                await client.get_dialogs()
                self.dialogs_loaded = True
            return await client.get_entity(int(ref))
        return await client.get_entity(ref)

    async def describe(self, config: dict, source: dict) -> dict:
        client = await self._client(config)
        entity = await self._entity(client, source["ref"])
        title = getattr(entity, "title", None) or getattr(entity, "first_name", None) or source["ref"]
        if source.get("topic"):
            title = f"{title} · тема {source['topic']}"
            try:
                topic_msg = await client.get_messages(entity, ids=source["topic"])
                topic_name = getattr(getattr(topic_msg, "action", None), "title", None)
                if topic_name:
                    title = f"{getattr(entity, 'title', source['ref'])} · {topic_name}"
            except Exception:
                pass
        return {**source, "title": title}

    async def scan(self, config: dict) -> dict:
        client = await self._client(config)
        hours = max(1, min(int(config.get("hours") or 24), 168))
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        only_relevant = bool(config.get("only_relevant"))
        pattern = keyword_pattern(config.get("keywords") or DEFAULT_KEYWORDS)

        chats = []
        for source in config.get("sources", []):
            result = {"title": source.get("title") or source["ref"], "ref": source["ref"], "topic": source.get("topic"), "messages": [], "skipped": 0}
            try:
                entity = await self._entity(client, source["ref"])
                async for m in client.iter_messages(entity, limit=MAX_MESSAGES_PER_CHAT, reply_to=source.get("topic")):
                    if m.date < since:
                        break
                    text = (m.message or "").strip()
                    if not text:
                        continue
                    if only_relevant and not pattern.search(text):
                        result["skipped"] += 1
                        continue
                    result["messages"].append({
                        "date": m.date.isoformat(),
                        "text": text,
                        "link": message_link(entity, m.id),
                    })
                result["messages"].reverse()
            except errors.FloodWaitError as e:
                result["error"] = f"Telegram просить зачекати {e.seconds} с. Спробуйте пізніше."
            except Exception as e:  # one broken source must not stop the rest
                result["error"] = f"{type(e).__name__}: {e}"
            chats.append(result)

        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "hours": hours,
            "only_relevant": only_relevant,
            "chats": chats,
        }
        EXPORTS.mkdir(parents=True, exist_ok=True)
        path = EXPORTS / f"chats-{datetime.now():%Y-%m-%d_%H%M}.json"
        path.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
        report["file"] = str(path)
        return report


# --------------------------------------------------------------------------- web page

telegram = Telegram()
config_lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    server_version = "TPSpainCollector"

    def log_message(self, fmt, *args):  # quiet console
        pass

    def _host_ok(self) -> bool:
        return self.headers.get("Host", "") in ALLOWED_HOSTS

    def _send(self, status: int, body: bytes, content_type: str, extra: dict | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Frame-Options", "DENY")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, data) -> None:
        self._send(status, json.dumps(data, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def do_GET(self):
        if not self._host_ok():
            return self._send(403, b"forbidden", "text/plain")
        if self.path in ("/", "/index.html"):
            html = INDEX_HTML.read_text(encoding="utf-8").replace("__TOKEN__", TOKEN)
            return self._send(200, html.encode("utf-8"), "text/html; charset=utf-8")
        if self.path == "/favicon.ico":
            return self._send(204, b"", "image/x-icon")
        return self._send(404, b"not found", "text/plain")

    def do_POST(self):
        if not self._host_ok() or self.headers.get("X-Token") != TOKEN:
            return self._send(403, b"forbidden", "text/plain")
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}") if length else {}
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": "Некоректний запит"})

        try:
            return self._json(200, self._route(self.path, body))
        except SourceError as e:
            return self._json(400, {"error": str(e)})
        except errors.PhoneCodeInvalidError:
            return self._json(400, {"error": "Невірний код"})
        except errors.PhoneCodeExpiredError:
            return self._json(400, {"error": "Код застарів — надішліть новий"})
        except errors.PasswordHashInvalidError:
            return self._json(400, {"error": "Невірний пароль"})
        except errors.PhoneNumberInvalidError:
            return self._json(400, {"error": "Невірний номер телефону"})
        except errors.ApiIdInvalidError:
            return self._json(400, {"error": "Невірні api_id / api_hash"})
        except (ValueError, TypeError) as e:
            return self._json(400, {"error": str(e)})
        except Exception as e:
            return self._json(500, {"error": f"{type(e).__name__}: {e}"})

    def _route(self, path: str, body: dict):
        with config_lock:
            config = load_config()

        if path == "/api/state":
            status = telegram.run(telegram.status(config))
            return {"config": public_config(config), "status": status}

        if path == "/api/config":
            if "api_id" in body:
                api_id = str(body["api_id"]).strip()
                if api_id and not api_id.isdigit():
                    raise ValueError("api_id — це число")
                config["api_id"] = api_id
            if body.get("api_hash"):
                config["api_hash"] = str(body["api_hash"]).strip()
            if "hours" in body:
                config["hours"] = max(1, min(int(body["hours"]), 168))
            if "only_relevant" in body:
                config["only_relevant"] = bool(body["only_relevant"])
            with config_lock:
                save_config(config)
            return {"config": public_config(config), "status": telegram.run(telegram.status(config))}

        if path == "/api/login/code":
            return telegram.run(telegram.send_code(config, str(body.get("phone", "")).strip()))
        if path == "/api/login/verify":
            return telegram.run(telegram.verify_code(config, str(body.get("code", "")).strip()))
        if path == "/api/login/password":
            return telegram.run(telegram.verify_password(config, str(body.get("password", ""))))
        if path == "/api/logout":
            return telegram.run(telegram.logout(config))

        if path == "/api/dialogs":
            return {"dialogs": telegram.run(telegram.dialogs(config))}

        if path == "/api/sources/add":
            if "ref" in body:
                source = {"ref": str(body["ref"]), "topic": body.get("topic") or None}
                if body.get("title"):
                    source["title"] = str(body["title"])
            else:
                source = parse_source(str(body.get("text", "")))
            if "title" not in source:
                source = telegram.run(telegram.describe(config, source))
            key = (source["ref"], source.get("topic"))
            if any((s["ref"], s.get("topic")) == key for s in config["sources"]):
                raise ValueError("Це джерело вже є у списку")
            config["sources"].append(source)
            with config_lock:
                save_config(config)
            return {"config": public_config(config)}

        if path == "/api/sources/remove":
            index = int(body.get("index", -1))
            if 0 <= index < len(config["sources"]):
                config["sources"].pop(index)
                with config_lock:
                    save_config(config)
            return {"config": public_config(config)}

        if path == "/api/scan":
            if not config["sources"]:
                raise ValueError("Спершу додайте хоча б одну групу")
            return telegram.run(telegram.scan(config))

        raise ValueError("Невідома дія")


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}/"
    print(f"TP Spain — збирач повідомлень працює: {url}")
    print("Щоб зупинити — закрийте це вікно або натисніть Ctrl+C.")
    if os.environ.get("TPS_COLLECTOR_NO_BROWSER") != "1":
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
