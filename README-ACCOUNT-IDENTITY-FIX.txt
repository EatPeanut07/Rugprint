RugPrint pre-release account identity fix

Replace:
- lib/alert-store.ts

What changes:
- When a browser connects an existing Telegram account, RugPrint merges entitlement into the browser subscription.
- If either subscription is Pro, the resulting linked browser subscription remains Pro.
- Existing watches from the prior Telegram-linked subscription are copied to the newly linked browser subscription where missing.
- Telegram is then attached to the current browser subscription.
- This prevents a Pro customer from losing Pro status merely because they opened RugPrint in a new browser and reconnected Telegram.

No Birdeye code.
No SQL migration required.

Important product behavior:
A completely unknown browser still begins as Free until the user identifies themselves by connecting Telegram. Once connected, their existing Pro entitlement is restored server-side.
