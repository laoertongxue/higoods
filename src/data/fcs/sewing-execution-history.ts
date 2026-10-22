import { PRODUCTION_CONTEXT_KEYS, productionContextStorage, isProductionContextStaged } from './production-context-records.ts'

/** Only the two actual-start commands may append facts. Static task seeds never call this writer. */
export interface SewingExecutionFact {
  id: string
  factoryId: string
  taskId: string
  productionOrderId: string
  styleCode: string
  taskAliases: string[]
  firstExecutedAt: string
  confirmedAt: string
  ordinal: number
  source: 'MANUAL_START' | 'CUT_PIECE_RECEIVE_START'
  sourceId: string
  actorName: string
}
function readFacts(): SewingExecutionFact[] {
  const raw = productionContextStorage.getItem(PRODUCTION_CONTEXT_KEYS.sewingExecutions)
  if (!raw) return []
  const saved = JSON.parse(raw)
  if (saved.version !== 1 || !Array.isArray(saved.facts)) throw new Error('真实车缝执行历史无法读取，未覆盖原资料。')
  return structuredClone(saved.facts)
}
export function listSewingExecutionFacts(factoryId?: string): SewingExecutionFact[] {
  return readFacts().filter(fact => !factoryId || fact.factoryId === factoryId)
}
export function getSewingExecutionHistoryForTask(input: { factoryId: string; taskId: string; productionOrderId?:string;styleCode?:string }) {
  const fact = readFacts().find(item => item.factoryId === input.factoryId && (item.taskAliases.includes(input.taskId) || (!!input.productionOrderId && !!input.styleCode && item.productionOrderId===input.productionOrderId && item.styleCode===input.styleCode)))
  return fact ? { status: 'RECORDED' as const, ordinal: fact.ordinal, fact }
    : { status: 'NO_HISTORY' as const, ordinal: 1, reason: '无可验证真实历史，本次按第一次车缝任务' }
}
export function ensureSewingExecutionFact(input: Omit<SewingExecutionFact, 'id' | 'ordinal' | 'confirmedAt' | 'taskAliases'>): SewingExecutionFact {
  if (typeof document !== 'undefined' && !isProductionContextStaged()) throw new Error('真实开工必须与任务在原库共同保存。')
  for (const value of [input.factoryId, input.taskId, input.productionOrderId, input.styleCode, input.sourceId, input.actorName]) if (!value?.trim()) throw new Error('真实车缝执行身份不完整。')
  if (!Number.isFinite(Date.parse(input.firstExecutedAt))) throw new Error('真实车缝执行时间无效。')
  const facts = readFacts()
  const previous = facts.find(item => item.factoryId === input.factoryId && item.productionOrderId === input.productionOrderId && item.styleCode === input.styleCode)
  if (previous) {
    if (previous.productionOrderId !== input.productionOrderId) throw new Error('真实车缝执行任务关联冲突。')
    if(!previous.taskAliases.includes(input.taskId)){previous.taskAliases.push(input.taskId);productionContextStorage.setItem(PRODUCTION_CONTEXT_KEYS.sewingExecutions, JSON.stringify({version:1,facts}))}
    return structuredClone(previous)
  }
  const ordinal = Math.max(0, ...facts.filter(item => item.factoryId === input.factoryId).map(item => item.ordinal)) + 1
  const fact: SewingExecutionFact = { ...input, id: `SEW-EXEC:${[input.factoryId,input.productionOrderId,input.styleCode].map(encodeURIComponent).join(':')}`, ordinal, taskAliases:[input.taskId], confirmedAt: new Date().toISOString() }
  productionContextStorage.setItem(PRODUCTION_CONTEXT_KEYS.sewingExecutions, JSON.stringify({ version: 1, facts: [...facts, fact] }))
  return structuredClone(fact)
}
