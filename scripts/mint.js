// Testnet only: mint the devnads.com test tokens (USDC, USDT) to your wallet. Usage: npm run mint [-- 100]
import { Interface, parseUnits } from 'ethers'
import { createWallet } from '../src/wallet.js'

const amount = process.argv[2] ?? '100'
const wallet = await createWallet()
const mintable = Object.entries(wallet.network.tokens).filter(([, t]) => t.mintable)
if (!mintable.length) throw new Error(`No mintable test tokens on ${wallet.network.name}. Use MONAD_NETWORK=testnet.`)

const erc20 = new Interface(['function mint(address to, uint256 amount)'])
for (const [symbol, t] of mintable) {
  const { url } = await wallet.sendTransaction({
    to: t.address,
    data: erc20.encodeFunctionData('mint', [wallet.address, parseUnits(amount, t.decimals)])
  })
  console.log(`Minted ${amount} ${symbol}: ${url}`)
}
console.log(await wallet.balances())
wallet.dispose()
