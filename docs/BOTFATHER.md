# Registering the bot and Mini App with @BotFather

Checklist to run once per environment (dev bot vs. production bot are
typically separate bots so you can test without disturbing real users).

## 1. Create the bot

1. Open a chat with [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot`.
3. Choose a display name (shown to users) and a username ending in `bot`
   (e.g. `tp_spain_bot`).
4. BotFather replies with the **bot token**. Put it in `TELEGRAM_BOT_TOKEN`
   (server-only env var, never exposed to the client).
5. Put the username (without the leading `@`) in
   `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.

## 2. Create the Mini App

1. Send `/newapp` to @BotFather.
2. Select the bot you just created.
3. Enter a title and description for the Mini App.
4. Upload an icon (512×512 PNG/JPEG, no third-party or government branding —
   see docs/SPEC.md "Branding").
5. Provide the **Web App URL**: your deployment's public URL
   (`NEXT_PUBLIC_SITE_URL`), e.g. `https://tp-spain.example.com`.
6. BotFather asks for a **short name** for the app (the part after the bot
   username in `t.me/<bot>/<app>` links). Put it in
   `NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME`.

## 3. Set the menu button to open the Mini App

1. Send `/mybots` to @BotFather, select the bot.
2. **Bot Settings → Menu Button → Configure menu button**.
3. Set the button text (e.g. "Відкрити застосунок") and the URL to the same
   Web App URL as above.

## 4. Configure `/start`

**This repo now ships the bot.** `src/app/api/telegram/webhook/route.ts` answers
`/start` and `/help` with an inline button that opens the app — as a `web_app`
button when `NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME` is set, otherwise as a plain
link, so the bot is useful before the Mini App exists. It is a webhook, not a
long-running process: Telegram POSTs, the function answers, it ends.

Register it once per environment:

```
TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
NEXT_PUBLIC_SITE_URL=https://your-host npm run telegram:setup
```

It prints **which bot the token belongs to** before doing anything else — start
here whenever a login fails, because that bot must be the same one that owns the
Mini App and that you ran `/setdomain` on. Then it calls `setWebhook` (with the
secret), `setMyCommands`, and prints `getWebhookInfo`.

`TELEGRAM_WEBHOOK_SECRET` must be set on the host too: Telegram echoes it in
`X-Telegram-Bot-Api-Secret-Token`, and the route rejects anything else, so
nobody who guesses the URL can make the bot speak.

<details>
<summary>The previous manual approach, for reference</summary>

The bot needs no conversational logic (docs/SPEC.md "Bot" — out of scope:
broadcasts, notifications, follow-ups). Only `/start` needs a reply with an
"Open app" inline button:

1. Send `/setcommands` to @BotFather and register at minimum:
   ```
   start - Відкрити застосунок
   ```
2. The actual `/start` reply (an inline keyboard button of type `web_app`
   pointing at the Mini App URL) is sent by a minimal bot backend — this repo
   does not include a long-running bot process. The simplest way to satisfy
   this without hosting a bot server is BotFather's own **Menu Button**
   (step 3): once configured, every chat with the bot shows an "Open app"
   button next to the message box, which covers the same need without extra
   infrastructure. If a literal `/start` reply is required, wire a tiny
   webhook (e.g. a Vercel serverless function) that calls
   `sendMessage` with a `reply_markup.inline_keyboard` containing one
   `{ text: "Open app", web_app: { url: NEXT_PUBLIC_SITE_URL } }` button, and
   register it with `setWebhook`.

</details>

## 5. Enable the Login Widget (web)

No separate BotFather step is required beyond having created the bot — the
Login Widget (`https://core.telegram.org/widgets/login`) works for any bot
whose **domain** has been linked to it:

1. Send `/setdomain` to @BotFather.
2. Select the bot.
3. Enter the web domain that will host the Login Widget (must match
   `NEXT_PUBLIC_SITE_URL`'s host exactly, no path).

## 6. Verify

- [ ] `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`,
      `NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME`, `NEXT_PUBLIC_SITE_URL` are all set.
- [ ] Opening `t.me/<bot_username>` shows the menu button that launches the
      Mini App.
- [ ] Opening `t.me/<bot_username>/<mini_app_name>?startapp=loc_<some-id>`
      lands on that location's page inside the Mini App.
- [ ] The Login Widget renders on `/me` when viewed in a normal browser
      (not inside Telegram) and completes a login.

## Troubleshooting

### Every login fails, or the Mini App shows "Telegram не підтвердив підпис"

One bot's Mini App with another bot's token on the server. `initData` is signed
with the bot token, so the HMAC check fails with `bad_hash` and no amount of
`/setdomain` helps.

Open `/api/health` and compare:

```json
"telegram": {
  "botUsername": "…",        // NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
  "tokenBelongsTo": "…",     // who TELEGRAM_BOT_TOKEN really is, via getMe
  "botMatchesToken": false   // <- the answer
}
```

All four must be one bot: the token, the public username, the `/setdomain`
target, and the bot whose Mini App you open. `npm run telegram:setup` prints the
same identity from the command line.

### "Bot domain invalid" on the Login Widget

The widget script itself loaded and knows the bot, so `TELEGRAM_BOT_TOKEN` and
`NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` are fine. The error means Telegram has no
domain linked to this bot that matches the page serving the widget — i.e.
**step 5 has not been run for this deployment's host**.

Fix: `/setdomain` in @BotFather → pick the bot → send the bare host, with no
scheme, no path and no trailing slash (`tpd-app.vercel.app`, not
`https://tpd-app.vercel.app/`). Telegram matches the host exactly, so:

- a preview deployment (`tpd-app-git-<branch>-<org>.vercel.app`) is a
  *different* host and will keep failing — test the login on the production
  host, or point `/setdomain` at the preview host while testing;
- one bot holds one domain. A separate dev bot is the clean way to have both.

Then confirm the rest of the wiring with `/api/health`, which reports whether
each variable is present (never its value):

```
curl -s https://<host>/api/health | jq '.env'
```

`NEXT_PUBLIC_SITE_URL` must equal `https://<that same host>` — no code path
reads it during login, but keeping it in sync is what makes the Mini App URL,
the menu button and `/setdomain` agree.
