RugPrint Worker Reliability Fix

Release-blocker patch:
- Reduces each Helius historical batch from 100 transactions to 20.
- Limits generic counterparty expansion per transaction to 5.
- Keeps one historical page per worker request.
- Automatically recovers processing jobs left stale for more than 5 minutes.
- Keeps customer-search priority ordering.
- Worker request timeout is 50 seconds, below the route/proxy ceiling.
- No Birdeye changes.
- No SQL migration required.
