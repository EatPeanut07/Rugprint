# RugPrint Combined Intelligence Release
This supersedes the earlier Telegram-only ZIP. Do not upload both.

Included:
- Telegram webhook, /start, /status, /testalert and quota-aware delivery.
- Community evidence submissions with evidence links.
- Community reports kept explicitly separate from published RugPrint findings.
- Creator searches show both published matches and community report counts.
- New /report page.
- One SQL migration: COMMUNITY-REPORTS-SCHEMA.sql.

Important: this release does NOT pretend that X, Pump.fun or Fomo provide a live public username-to-wallet resolver. Those searches use RugPrint's registry/community evidence until an authorised/stable resolver is connected.

Order:
1. Run COMMUNITY-REPORTS-SCHEMA.sql once in Supabase SQL Editor.
2. Upload all other files to the GitHub repo root, preserving folders and replacing matching files.
3. Add TELEGRAM_WEBHOOK_SECRET in Railway.
4. Deploy.
5. Register Telegram webhook using POST /api/telegram/setup with Authorization: Bearer <secret>.
6. Test /start then /testalert.
