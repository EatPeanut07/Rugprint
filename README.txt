RugPrint Release Candidate 1

Public creator profiles must use VERIFIED launch observations from Supabase, not regex 'launch signals'.

Required changes:
1. lib/creator-intelligence.ts: query rugprint_launch_observations by creator_wallet and return verifiedLaunchCount + verifiedLaunches.
2. app/creator/page.tsx: replace 'Launch signals' with 'Verified launches'; list mint, date, source, confidence and evidence transaction.
3. Never classify a dead/failed token as a rug without additional creator-behaviour evidence.
4. Database migration is handled by ChatGPT, not manually.
