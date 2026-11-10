# WDK Monad Starter

Hackathon starter for building on **Monad** with Tether's **[WDK](https://docs.wdk.tether.io)** (Wallet Development Kit), plus an optional **[QVAC](https://docs.qvac.tether.io)** local AI agent on top.

- **WDK**: JavaScript modules for self-custodial wallets. One seed phrase derives accounts on EVM chains like Monad, plus Solana, TON, Tron and more. Read balances, quote fees, sign, send. Keys stay with the user, never with a server.
- **QVAC** (optional, `examples/qvac-agent`): runs AI models on the user's own device: LLM chat with tool calling, speech-to-text, text-to-speech, translation, embeddings/RAG and OCR. No API key, no cloud.

Full guide and project ideas: **https://devnads.com/wdk**

## Quick start (WDK)

Requires Node.js 22+.

```bash
git clone https://github.com/portdeveloper/wdk-qvac-monad-starter
cd wdk-qvac-monad-starter
npm install          # ~240 MB (WDK native prebuilds)
npm run setup        # creates .env with a new seed, prints your address, requests 1 testnet MON
npm run mint         # mints 100 test USDC + USDT (testnet)
npm run send -- 0xRecipient 5 USDC
```

| Script | What it does |
|---|---|
| `npm run setup` | Create `.env` + seed (once), request testnet MON from the devnads faucet |
| `npm run balance` | MON + token balances |
| `npm run send -- <to> <amount> [TOKEN]` | Send MON, or a token (testnet: `USDC`, `USDT`; mainnet: `USDC`, `USDT0`) |
| `npm run mint [-- 100]` | Mint devnads test USDC/USDT (testnet only) |
| `npm run test:burst` | Fires 3 sends at once to prove the nonce fix below |

Switch to mainnet with `MONAD_NETWORK=mainnet` in `.env` (and fund the address yourself).

Use the wallet in your own code:

```js
import { createWallet } from './src/wallet.js'

const wallet = await createWallet()              // reads WDK_SEED + MONAD_NETWORK from env
console.log(wallet.address, await wallet.balances())
const { url } = await wallet.transfer('USDC', '0x…', '5')
await wallet.sendTransaction({ to: contract, data }) // any contract call
wallet.account                                   // the raw WDK account: sign, signTypedData, quotes, ...
```

## Optional: local AI agent (WDK + QVAC)

A local model turns plain English into a tool call, WDK quotes it, and nothing is sent until you confirm.

```bash
npm run agent:install   # ~2 GB (QVAC native runtimes). Do this before the venue Wi-Fi melts.
npm run agent           # first run downloads the ~1.1 GB model, then it's cached
```

```
you> pay 2 usdc to 0xa982dEFe14513bd83e8cFdF083AD6d3e867D45f0
agent> transfer 2 USDC to 0xa982…45f0? max fee 0.012983954 MON [y/N] y
agent> done: https://testnet.monadvision.com/tx/0xc4cc8d09…
```

Add a capability = add one entry to `TOOLS` in `examples/qvac-agent/agent.js` (zod schema + `run`, plus `quote`/`summary` if it writes on-chain). QVAC ships prebuilds for macOS, Linux and Windows (x64 + arm64); a GPU is optional. Verified on Linux arm64 (CPU only, 2 cores: ~4–8 s per reply). A laptop should be faster.

## Layout

```
src/config.js              networks, RPCs, explorers, token addresses: the only place addresses live
src/wallet.js              createWallet(): WDK account + Monad-safe write queue + helpers
scripts/                   setup, balance, send, mint, burst
examples/qvac-agent/       optional QVAC agent, own package.json so the 2 GB install is opt-in
```

## Monad gotchas (already handled here)

1. **Back-to-back sends reuse nonces.** Monad's public RPC reports the same `pending` and `latest` nonce (it doesn't count txs still in the mempool). WDK uses the `pending` nonce, so two sends fired within ~200 ms get the same one. Identical txs are **silently deduplicated** (same hash returned, only one lands); different ones fail with `nonce has already been used` or `could not coalesce error`. `src/wallet.js` serializes writes and waits for each receipt (~0.4–1 s on Monad). If you call `wallet.account.sendTransaction()` directly, you bypass this.
2. **Quoted fee is a ceiling.** WDK quotes `gasLimit × maxFeePerGas` (≈2× base fee + tip). A plain MON send quotes 0.004242 MON and is charged 0.002142 MON.
3. **Monad charges for the gas limit, not gas used.** WDK sets the limit from `eth_estimateGas`, so a tight estimate keeps this cheap. Don't hardcode big `gasLimit`s. ([Monad docs](https://docs.monad.xyz/developer-essentials/gas-pricing))
4. **Empty wallets can't quote.** With 0 MON, `quote*` fails with `missing revert data` (the RPC rejects gas estimation for "insufficient balance"). Fund first.
5. **Public RPCs are rate limited.** Set `MONAD_RPC_URL` to your own endpoint if you hit 429s.

## Security

- `.env` holds your seed phrase. It's gitignored and created with `0600` permissions. Never commit it, never paste it in Discord.
- The agent always asks before any on-chain write. Keep it that way: small models do misread amounts.
- Use a fresh, low-balance wallet for hackathon demos, especially on mainnet.

## Tested with

`@tetherto/wdk` 1.0.0-beta.22, `@tetherto/wdk-wallet-evm` 1.0.0-beta.25, Node 24, on Monad testnet (10143) and mainnet (143), November 2026. Agent: `@qvac/sdk` 0.23.0, model `QWEN3_1_7B_INST_Q4`, testnet. WDK is in beta, so versions are pinned exactly; upgrade deliberately.

## License

MIT
