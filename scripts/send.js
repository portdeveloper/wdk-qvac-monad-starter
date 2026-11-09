// Usage: npm run send -- <to> <amount> [TOKEN]    e.g. npm run send -- 0xabc... 0.1   |   npm run send -- 0xabc... 5 USDC
import { createWallet } from '../src/wallet.js'

const [to, amount, symbol] = process.argv.slice(2)
if (!to || !amount) throw new Error('Usage: npm run send -- <to> <amount> [TOKEN]')

const wallet = await createWallet()
const fee = symbol ? await wallet.quoteTransfer(symbol, to, amount) : await wallet.quoteSendMon(to, amount)
console.log(`Sending ${amount} ${symbol ?? 'MON'} to ${to} (max fee ${fee} MON)...`)
const { url } = symbol ? await wallet.transfer(symbol, to, amount) : await wallet.sendMon(to, amount)
console.log(`Done: ${url}`)
wallet.dispose()
