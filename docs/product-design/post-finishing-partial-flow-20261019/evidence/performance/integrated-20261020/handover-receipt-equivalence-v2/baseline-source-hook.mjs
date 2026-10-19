import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
const target = new URL('file:///Users/laoer/.codex/worktrees/81b7/higoods/src/data/fcs/pda-handover-events.ts').href
const source = readFileSync('/tmp/pf-handover-pre-summary-head.ts.txt', 'utf8')
registerHooks({ load(url, context, nextLoad) {
  if (url === target) return { format: 'module-typescript', source, shortCircuit: true }
  return nextLoad(url, context)
}})
