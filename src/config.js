// Monad network + token config. Edit addresses here only.
// Testnet tokens are the devnads.com test tokens: anyone can mint them (see `npm run mint`).

export const NETWORKS = {
  testnet: {
    name: 'Monad Testnet',
    chainId: 10143,
    rpc: 'https://testnet-rpc.monad.xyz',
    explorer: 'https://testnet.monadvision.com',
    faucetApi: 'https://agents.devnads.com/v1/faucet',
    tokens: {
      USDC: { address: '0x56bf9CDc3C1876F3F22655a0016C2743E9e39a73', decimals: 6, mintable: true },
      USDT: { address: '0x42D54D7aE6776D309363e650fBcbF93D961D8b58', decimals: 6, mintable: true }
    }
  },
  mainnet: {
    name: 'Monad Mainnet',
    chainId: 143,
    rpc: 'https://rpc.monad.xyz',
    explorer: 'https://monadvision.com',
    tokens: {
      USDC: { address: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', decimals: 6 },
      USDT0: { address: '0xe7cd86e13AC4309349F30B3435a9d337750fC82D', decimals: 6 }
    }
  }
}

export function getNetwork (name = process.env.MONAD_NETWORK || 'testnet') {
  const net = NETWORKS[name]
  if (!net) throw new Error(`Unknown MONAD_NETWORK "${name}". Use one of: ${Object.keys(NETWORKS).join(', ')}`)
  return { key: name, ...net, rpc: process.env.MONAD_RPC_URL || net.rpc }
}
