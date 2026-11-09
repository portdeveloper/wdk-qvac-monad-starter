# WDK + QVAC Monad Starter

Hackathon starter for building on **Monad** with Tether's **[WDK](https://docs.wdk.tether.io)** (self-custodial wallets) and **[QVAC](https://docs.qvac.tether.io)** (local, on-device AI).

It ships a working **local AI wallet agent**: you type "pay 5 USDC to 0x…", a model running on your laptop turns that into a tool call, WDK quotes it, and after you confirm, sends it on Monad. No API keys, no cloud LLM, keys never leave your machine.

```
you> pay 2 usdc to 0xa982dEFe14513bd83e8cFdF083AD6d3e867D45f0
agent> transfer 2 USDC to 0xa982…45f0? max fee 0.012983954 MON [y/N] y
agent> done: https://testnet.monadvision.com/tx/0xc4cc8d09…
```

Full guide: **https://devnads.com/wdk**

## Quick start

Requires Node.js 22+. QVAC ships prebuilds for macOS, Linux and Windows (x64 + arm64); a GPU is optional. Verified so far on Linux arm64 (CPU only, 2 cores: ~5–8 s per agent reply). A laptop should be faster.

```bash
git clone https://github.com/portdeveloper/wdk-qvac-monad-starter
cd wdk-qvac-monad-starter
npm install          # ~2 GB (QVAC native runtimes). Do this before the venue Wi-Fi melts.
npm run setup        # creates .env with a new seed, prints your address, requests 1 testnet MON
npm run mint         # mints 100 test USDC + USDT (testnet)
npm run agent        # first run downloads the ~1.1 GB model, then it's cached
```

| Script | What it does |
|---|---|
| `npm run setup` | Create `.env` + seed (once), request testnet MON from the devnads faucet |
| `npm run balance` | MON + token balances |
| `npm run send -- <to> <amount> [TOKEN]` | Send MON, or a token (`USDC`, `USDT`, mainnet: `USDC`, `USDT0`) |
| `npm run mint [-- 100]` | Mint devnads test USDC/USDT (testnet only) |
| `npm run agent` | QVAC local LLM agent with WDK tools |
| `npm run test:burst` | Fires 3 sends at once to prove the nonce fix below |

Switch to mainnet with `MONAD_NETWORK=mainnet` in `.env` (and fund the address yourself).

## Layout

```
src/config.js   networks, RPCs, explorers, token addresses: the only place addresses live
src/wallet.js   createWallet(): WDK account + Monad-safe write queue + helpers
src/agent.js    QVAC model + tool definitions (zod) -> WDK calls, with confirmation
scripts/        setup, balance, send, mint, burst
```

Add a capability to the agent = add one entry to `TOOLS` in `src/agent.js` (schema + `run`, plus `quote`/`summary` if it writes on-chain). For arbitrary contract calls use `wallet.sendTransaction({ to, data })`.

## Monad gotchas (already handled here)

1. **Back-to-back sends reuse nonces.** Monad's public RPC reports the same `pending` and `latest` nonce (it doesn't count txs still in the mempool). WDK uses the `pending` nonce, so two sends fired within ~200 ms get the same one. Identical txs are **silently deduplicated** (same hash returned, only one lands); different ones fail with `nonce has already been used` or `could not coalesce error`. `src/wallet.js` serializes writes and waits for each receipt (~0.4–1 s on Monad). If you call `wallet.account.sendTransaction()` directly, you bypass this.
2. **Quoted fee is a ceiling.** WDK quotes `gasLimit × maxFeePerGas` (≈2× base fee + tip). A plain MON send quotes 0.004242 MON and is charged 0.002142 MON.
3. **Monad charges for the gas limit, not gas used.** WDK sets the limit from `eth_estimateGas`, so a tight estimate keeps this cheap. Don't hardcode big `gasLimit`s.
4. **Empty wallets can't quote.** With 0 MON, `quote*` fails with `missing revert data` (the RPC rejects gas estimation for "insufficient balance"). Fund first.
5. **Public RPCs are rate limited.** Set `MONAD_RPC_URL` to your own endpoint if you hit 429s.

## Security

- `.env` holds your seed phrase. It's gitignored and created with `0600` permissions. Never commit it, never paste it in Discord.
- The agent always asks before any on-chain write. Keep it that way: small models do misread amounts.
- Use a fresh, low-balance wallet for hackathon demos, especially on mainnet.

## Tested with

`@tetherto/wdk` 1.0.0-beta.22, `@tetherto/wdk-wallet-evm` 1.0.0-beta.25, `@qvac/sdk` 0.23.0, model `QWEN3_1_7B_INST_Q4`, Node 24, on Monad testnet (10143) and mainnet (143), November 2026. WDK is in beta, so versions are pinned exactly; upgrade deliberately.

## License

MIT
