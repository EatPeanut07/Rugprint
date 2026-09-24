RugPrint classifier release

GitHub change:
Open lib/intelligence-engine.ts and replace ONLY the existing `isLaunch` and
`sourceConfidence` definitions with the definitions in CLASSIFIER-PATCH.txt.

Do not replace the whole intelligence-engine.ts file.

Do NOT run any database cleanup manually. ChatGPT will handle Supabase after
the corrected classifier is deployed.

Reason:
The old expression matched PUMP_FUN anywhere in the transaction summary,
causing ordinary Pump.fun swaps to be recorded as launches.
