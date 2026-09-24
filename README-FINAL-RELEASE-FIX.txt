RugPrint FINAL release-fix bundle

Replace these files in the repository root:
- worker.mjs
- app/api/telegram/link/route.ts

Fixes:
1. Worker request timeout increased from 90s to 125s so the API's 120s execution allowance can finish before the worker aborts.
2. Browser -> Telegram linking no longer depends solely on TELEGRAM_BOT_USERNAME. If the env var is absent, RugPrint resolves the bot username from Telegram getMe using the existing bot token.

No Birdeye code is included.
No database migration is required for this bundle.
