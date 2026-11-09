import { createWallet } from '../src/wallet.js'

const wallet = await createWallet()
console.log(`${wallet.address} on ${wallet.network.name}`)
console.log(await wallet.balances())
wallet.dispose()
