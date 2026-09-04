# Security policy

RugPrint never needs a seed phrase, wallet private key or signing permission.

Report vulnerabilities privately before public disclosure. Do not include private keys, personal data or secrets in reports.

Deployment checklist:
- keep provider API keys server-side
- never prefix secrets with NEXT_PUBLIC_
- enable provider spend/rate limits
- rotate exposed keys immediately
- add application-level rate limiting before a public viral launch
- do not store social evidence containing private personal data
