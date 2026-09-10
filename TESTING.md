# Smoke Test

After Railway deploys:

1. Open `/api/status`.
2. Confirm `version` is `5.0`.
3. Confirm `collector_running` becomes `true`.
4. Confirm `dexscreener_enabled` is true.
5. Confirm `autonomous_wallet_discovery` is true.
6. Open `/`.
7. The Intelligence feed should populate first.
8. Auto-Discovered Tokens should populate from DEX candidates.
9. Auto-Discovered Wallets should populate after Solana RPC transactions are fetched.
10. Check Source Health for provider errors.

The default public Solana RPC can rate-limit a busy deployment. If that happens, a dedicated RPC endpoint can be added later through Railway Variables without changing GitHub.
