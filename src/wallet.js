// WDK wallet for Monad, with one Monad-specific fix: writes are serialized.
//
// Why: Monad's public RPC returns the same value for eth_getTransactionCount "pending" and "latest",
// i.e. it does not count txs still in the mempool. WDK asks for the "pending" nonce, so two sends
// fired back-to-back get the SAME nonce. If both txs are identical, the RPC silently returns the same
// hash twice (one tx lands, you think two did). If they differ, the second fails with
// "nonce has already been used" / "could not coalesce error".
// Fix: run writes one at a time and wait for each receipt (~0.4-1s on Monad) before the next one.
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import { JsonRpcProvider, formatEther, formatUnits, parseEther, parseUnits } from 'ethers'
import { getNetwork } from './config.js'

export async function createWallet ({ network, seed = process.env.WDK_SEED, accountIndex = 0 } = {}) {
  if (!seed) throw new Error('WDK_SEED is not set. Run `npm run setup` first.')
  const net = getNetwork(network)

  const wdk = new WDK(seed).registerWallet('monad', WalletManagerEvm, {
    provider: net.rpc,
    chainId: net.chainId // skip chain-id auto-detection
  })
  const account = await wdk.getAccount('monad', accountIndex)
  const address = await account.getAddress()
  const provider = new JsonRpcProvider(net.rpc, net.chainId, { staticNetwork: true })

  let queue = Promise.resolve()
  /** Run a WDK write op, then wait for its receipt, one at a time. Returns { hash, fee, receipt, url }. */
  function write (fn) {
    const run = queue.then(async () => {
      const { hash, fee } = await fn()
      const receipt = await provider.waitForTransaction(hash, 1, 60_000)
      if (!receipt || receipt.status !== 1) throw new Error(`tx ${hash} failed (status ${receipt?.status})`)
      return { hash, fee, receipt, url: `${net.explorer}/tx/${hash}` }
    })
    queue = run.catch(() => {})
    return run
  }

  const token = (symbol) => {
    const t = net.tokens[symbol]
    if (!t) throw new Error(`Unknown token "${symbol}" on ${net.name}. Known: ${Object.keys(net.tokens).join(', ')}`)
    return t
  }

  return {
    wdk,
    account, // the raw WDK account: sign, signTypedData, quote*, getTransaction, ...
    address,
    network: net,

    async balances () {
      const out = { MON: formatEther(await account.getBalance()) }
      const entries = Object.entries(net.tokens)
      const raw = await account.getTokenBalances(entries.map(([, t]) => t.address))
      for (const [sym, t] of entries) out[sym] = formatUnits(raw[t.address] ?? 0n, t.decimals)
      return out
    },

    quoteSendMon: async (to, amount) => formatEther((await account.quoteSendTransaction({ to, value: parseEther(amount) })).fee),
    quoteTransfer: async (symbol, to, amount) => {
      const t = token(symbol)
      return formatEther((await account.quoteTransfer({ token: t.address, recipient: to, amount: parseUnits(amount, t.decimals) })).fee)
    },

    sendMon: (to, amount) => write(() => account.sendTransaction({ to, value: parseEther(amount) })),
    transfer: (symbol, to, amount) => {
      const t = token(symbol)
      return write(() => account.transfer({ token: t.address, recipient: to, amount: parseUnits(amount, t.decimals) }))
    },
    approve: (symbol, spender, amount) => {
      const t = token(symbol)
      return write(() => account.approve({ token: t.address, spender, amount: parseUnits(amount, t.decimals) }))
    },
    /** Any raw tx (contract calls etc.), still serialized. */
    sendTransaction: (tx) => write(() => account.sendTransaction(tx)),

    dispose: () => wdk.dispose()
  }
}
