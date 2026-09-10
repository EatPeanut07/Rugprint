# Remaining Production Components

V5 contains the reusable intelligence-side connectors so normal source setup should not require another GitHub rewrite.

Before real-money autonomy, separate infrastructure is still required:
1. production RPC provider
2. production database
3. monitoring and incident alerts
4. isolated signer service
5. deterministic transaction-policy service
6. tiny transaction and daily limits
7. human approval for high-risk actions
8. real launch adapter
9. X write/OAuth adapter
10. Telegram posting adapter
11. optional audited Token-2022 enforcement component
12. adversarial security testing and independent review

These should remain separate from the public intelligence web application.
