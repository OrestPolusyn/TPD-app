"""
Exports recent messages from a Telegram chat you are a member of — for
chats where Telegram's own "Export chat history" is not available (the
web/macOS apps, or a group with a topic you only read).

Runs on your own computer, signed in as you. Keeps only the date and the
text: no names, no phone numbers, no media. The resulting JSON is what
the chat updates are extracted from.

Setup (once):
  1. https://my.telegram.org → "API development tools" → create an app;
     note api_id and api_hash.
  2. pip install telethon
Run:
  TG_API_ID=123 TG_API_HASH=abc python3 scripts/tg_export.py spain_useful --topic 74767 --days 7
The first run asks for your phone number and the login code Telegram
sends you; the session is saved next to the script (tg_export.session).
Keep that file private: it is a signed-in login to your account.
"""

import argparse
import asyncio
import json
import os
from datetime import datetime, timedelta, timezone

from telethon import TelegramClient


async def main() -> None:
    parser = argparse.ArgumentParser(description="Export recent chat messages (date + text only).")
    parser.add_argument("chat", help="username without @ (spain_useful) or a t.me link")
    parser.add_argument("--topic", type=int, help="topic id: the number in t.me/c/<chat>/<topic>")
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--out", help="output file (default: <chat>-<date>.json)")
    args = parser.parse_args()

    since = datetime.now(timezone.utc) - timedelta(days=args.days)
    session = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tg_export")
    client = TelegramClient(session, int(os.environ["TG_API_ID"]), os.environ["TG_API_HASH"])
    await client.start()

    messages = []
    # Newest first; stop once past the window. reply_to limits it to a topic.
    async for m in client.iter_messages(args.chat, reply_to=args.topic):
        if m.date < since:
            break
        if m.message and m.message.strip():
            messages.append({"date": m.date.isoformat(), "text": m.message.strip()})
    messages.reverse()

    out = args.out or f"{args.chat.rsplit('/', 1)[-1]}-{datetime.now():%Y-%m-%d}.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"chat": args.chat, "topic": args.topic, "messages": messages}, f, ensure_ascii=False, indent=1)
    print(f"{len(messages)} messages → {out}")
    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
