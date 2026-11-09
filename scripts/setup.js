// Creates .env with a fresh seed phrase (once), prints your address, and on testnet requests MON from the devnads faucet.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import WDK from '@tetherto/wdk'
import { createWallet } from '../src/wallet.js'
import { getNetwork } from '../src/config.js'

const envPath = new URL('../.env', import.meta.url)
if (!existsSync(envPath) || !/^WDK_SEED=/m.test(readFileSync(envPath, 'utf8'))) {
  const seed = WDK.getRandomSeedPhrase()
  const prev = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
  writeFileSync(envPath, `${prev}${prev && !prev.endsWith('\n') ? '\n' : ''}MONAD_NETWORK=testnet\nWDK_SEED="${seed}"\n`, { mode: 0o600 })
  console.log('Created .env with a new seed phrase. Back it up; it is the only way to recover funds. Never commit it.')
  process.loadEnvFile(envPath)
} else {
  console.log('.env already has WDK_SEED; reusing it.')
}

const net = getNetwork()
const wallet = await createWallet()
console.log(`\nAddress: ${wallet.address}`)
console.log(`Network: ${net.name} (chain ${net.chainId})`)

if (net.faucetApi) {
  const res = await fetch(net.faucetApi, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chainId: net.chainId, address: wallet.address })
  })
  const body = await res.text()
  console.log(res.ok ? `Faucet: requested testnet MON (${body})` : `Faucet request failed (${res.status}): ${body}`)
}
console.log('Balances:', await wallet.balances())
wallet.dispose()
