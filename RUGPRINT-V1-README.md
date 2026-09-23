# RugPrint v1 consolidated build

Upload the CONTENTS to the root of the Rugprint GitHub repository and overwrite matching files.

Included: Helius-backed creator intelligence, creator search surfaces, persistent registry integration, Supabase watchlists, 3-alert monthly trial quota, Pro entitlement model, feature health reporting, mobile UI additions, and evidence-first wording.

External integrations are not faked:
- Pump.fun/Fomo tabs search identities RugPrint has persisted until a stable authorized live resolver is configured.
- X stable-ID storage is ready; live X resolution needs authorized X API access.
- Telegram delivery needs TELEGRAM_BOT_TOKEN plus secure chat linking.
- Payment checkout is not fabricated; the database already supports plan=pro.

These are external-account/configuration steps, not reasons to repeatedly rewrite the GitHub app.

After upload: deploy once, check /api/health, test /creator and /alerts.
