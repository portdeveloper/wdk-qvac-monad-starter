// Local AI wallet agent: QVAC runs an LLM on your laptop (no API key, nothing leaves the machine),
// turns plain English into tool calls, and WDK executes them on Monad after you confirm.
import readline from 'node:readline/promises'
import { completion, loadModel, unloadModel, QWEN3_1_7B_INST_Q4 } from '@qvac/sdk'
import { isAddress } from 'ethers'
import { z } from 'zod'
import { createWallet } from './wallet.js'

const wallet = await createWallet()
const net = wallet.network
const tokenSymbols = Object.keys(net.tokens)

const address = z.string().refine(isAddress, 'must be a 0x address').describe('0x recipient address')
const amount = z.string().regex(/^\d+(\.\d+)?$/, 'must be a positive decimal').describe('amount as a decimal string, e.g. "0.5"')

// Each tool: schema for the model + handler. `write: true` tools need a quote + confirmation.
const TOOLS = {
  get_balance: {
    description: 'Get the wallet address, MON balance and token balances',
    parameters: z.object({}),
    run: async () => ({ address: wallet.address, ...(await wallet.balances()) })
  },
  send_mon: {
    description: 'Send native MON to an address',
    parameters: z.object({ to: address, amount }),
    write: true,
    quote: ({ to, amount }) => wallet.quoteSendMon(to, amount),
    summary: ({ to, amount }) => `send ${amount} MON to ${to}`,
    run: ({ to, amount }) => wallet.sendMon(to, amount)
  },
  transfer_token: {
    description: `Transfer an ERC-20 token (${tokenSymbols.join(', ')}) to an address`,
    parameters: z.object({ token: z.enum(tokenSymbols), to: address, amount }),
    write: true,
    quote: ({ token, to, amount }) => wallet.quoteTransfer(token, to, amount),
    summary: ({ token, to, amount }) => `transfer ${amount} ${token} to ${to}`,
    run: ({ token, to, amount }) => wallet.transfer(token, to, amount)
  }
}
const tools = Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, parameters: t.parameters }))

console.log(`Wallet ${wallet.address} on ${net.name} (chain ${net.chainId})`)
console.log('Loading local model (first run downloads ~1.1 GB, then it is cached)...')
let shown = -1
const modelId = await loadModel({
  modelSrc: QWEN3_1_7B_INST_Q4,
  modelConfig: { ctx_size: 4096, tools: true },
  onProgress: (p) => {
    const pct = Math.floor(p.percentage / 10) * 10
    if (pct > shown) { shown = pct; process.stdout.write(`  ${pct}% `) }
  }
})
console.log('\nReady. Try: "what\'s my balance?", "send 0.01 MON to 0x...", "pay 5 USDC to 0x...". Ctrl+C to quit.\n')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const SYSTEM = `You are a crypto wallet assistant on ${net.name}. Always use a tool for wallet actions. Never invent addresses or amounts. /no_think`

process.on('SIGINT', async () => { rl.close(); await unloadModel({ modelId, clearStorage: false }); wallet.dispose(); process.exit(0) })

while (true) {
  const input = (await rl.question('you> ')).trim()
  if (!input) continue

  const res = completion({ modelId, history: [{ role: 'system', content: SYSTEM }, { role: 'user', content: input }], stream: true, tools })
  for await (const _ of res.tokenStream) {} // drain; we act on tool calls
  const calls = await res.toolCalls

  if (!calls.length) {
    console.log('agent>', (await res.text).replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '(no answer)')
    continue
  }

  for (const call of calls) {
    const tool = TOOLS[call.name]
    const parsed = tool?.parameters.safeParse(call.arguments ?? {})
    if (!tool || !parsed.success) {
      console.log(`agent> couldn't understand that (${call.name}: ${parsed?.error?.issues.map(i => `${i.path}: ${i.message}`).join(', ') ?? 'unknown tool'})`)
      continue
    }
    try {
      if (tool.write) {
        const fee = await tool.quote(parsed.data)
        const ok = (await rl.question(`agent> ${tool.summary(parsed.data)}? max fee ${fee} MON [y/N] `)).trim().toLowerCase() === 'y'
        if (!ok) { console.log('agent> cancelled'); continue }
        const { url } = await tool.run(parsed.data)
        console.log(`agent> done: ${url}`)
      } else {
        console.log('agent>', await tool.run(parsed.data))
      }
    } catch (e) {
      console.log('agent> error:', e.shortMessage || e.message)
    }
  }
}
