# RugPrint Railway patch

Upload these files to the same paths in `EatPeanut07/Rugprint`, replacing existing files when prompted.

This patch:
1. Fixes the Railway TypeScript build errors in `lib/registry.ts`.
2. Adds `risk.dataConfidence` to the shared type.
3. Adds the 3-alert monthly trial / unlimited Pro quota primitive.
4. Adds a quota API route and Supabase table schema.

After uploading, Railway should auto-deploy `main`. The alert quota is the foundation only; Telegram delivery, authentication/payment entitlement, Pump.fun/Fomo ingestion and X stable-ID history still need their live provider integrations and credentials before they can truthfully be called production-ready.
