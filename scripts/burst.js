// Proves the nonce fix: fires 3 identical sends at once. Without wallet.js's write queue,
// Monad's RPC would hand all three the same nonce and only one would land.
import { createWallet } from '../src/wallet.js'

const wallet = await createWallet()
const nonceBefore = await wallet.account._provider.getTransactionCount(wallet.address, 'latest')
const results = await Promise.all([1, 2, 3].map(() => wallet.sendMon(wallet.address, '0.000001')))
const nonceAfter = await wallet.account._provider.getTransactionCount(wallet.address, 'latest')
results.forEach((r, i) => console.log(`#${i + 1} ${r.url}`))
const unique = new Set(results.map(r => r.hash)).size
console.log(`unique hashes: ${unique}/3, nonce ${nonceBefore} -> ${nonceAfter}`)
wallet.dispose()
if (unique !== 3 || nonceAfter - nonceBefore !== 3) { console.error('FAIL'); process.exit(1) }
console.log('OK')
