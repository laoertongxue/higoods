import fs from 'node:fs'
import {
  createProductionMaterialPrepSeedStore,
  getPickupSessionByNodeId,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import {
  appendPickupSessionWithWarehouseFactsRuntime,
  bootstrapPickupManagementRuntimeMockData,
  PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY,
  recoverPendingPickupWarehouseTransaction,
  listActivePickupNodesRuntime as listActivePickupNodes,
} from '../src/runtime/fcs/cutting/pickup-management-runtime.ts'
import { CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY } from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'

bootstrapPickupManagementRuntimeMockData()

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const pdaSource = fs.readFileSync('src/pages/pda-warehouse-wait-process.ts', 'utf8')
assert(pdaSource.includes('syncCuttingPickupSessionRuntimeFacts'), 'PDA 必须按 Session 快照补写待加工仓流水')
assert(pdaSource.includes('appendPickupSessionWithWarehouseFactsRuntime'), 'PDA 必须原子形成 Session/Detail 与待加工仓流水')
assert(!pdaSource.includes('warehouseSyncDeferred: true'), 'PDA 新确认不得再制造先保存领料、后补写流水的中间态')
assert(!pdaSource.includes('领料已保存，待加工仓流水写入失败'), 'PDA 不得在流水失败后保留领料事实')
assert(pdaSource.includes('getPickupSessionByNodeId(pickupNodeId)'), 'PDA 重复确认必须优先返回历史 Session')
assert(pdaSource.includes('retry-cutting-pickup-sync'), 'PDA 必须提供仓储回写重试')
assert(!pdaSource.includes('确认按裁片任务从中转仓领回的数量'), 'PDA 不得再使用裁片任务和可编辑数量口径')

const storage = new MemoryStorage()
storage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()))
const node = listActivePickupNodes(storage)[0]
assert(node, '种子必须存在待领节点')
const input = {
  pickupNodeId: node.nodeId,
  pickupNodeVersion: node.version,
  receiverName: 'PDA 校验员',
  warehouseArea: '待加工仓 A 区',
  locationCode: 'FAB-A-01',
  waitProcessLedgerEventId: `pda-check:${node.nodeId}`,
  idempotencyKey: `pda-check:${node.nodeId}:v${node.version}`,
}
const first = appendPickupSessionWithWarehouseFactsRuntime(input, (session, transactionStorage) => {
  assert(
    transactionStorage?.getItem(PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY)?.includes('"PREPARING"'),
    '真实原子入口写待加工仓事实期间必须持续保留 PREPARING 崩溃恢复日志',
  )
  transactionStorage?.setItem?.(
    CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
    JSON.stringify({ events: [{ pickupSessionId: session.pickupSessionId }] }),
  )
}, storage)
const duplicate = appendPickupSessionWithWarehouseFactsRuntime(
  { ...input, pickupNodeVersion: 0 },
  () => undefined,
  storage,
)
assert(first.pickupSessionId === duplicate.pickupSessionId, '节点关闭且旧版本重复提交必须幂等返回原 Session')
assert(first.pickupRecordIds.length === node.items.length, '一次确认必须生成 N 条物料明细')
assert(getPickupSessionByNodeId(node.nodeId, storage)?.pickupSessionId === first.pickupSessionId, '必须可按节点找回 Session 用于弱网恢复')

const rollbackStorage = new MemoryStorage()
rollbackStorage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()))
rollbackStorage.setItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, '{"events":[]}')
const rollbackNode = listActivePickupNodes(rollbackStorage)[0]
assert(rollbackNode, '回滚场景必须存在待领节点')
const prepBefore = rollbackStorage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY)
const ledgerBefore = rollbackStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
try {
  appendPickupSessionWithWarehouseFactsRuntime({
    ...input,
    pickupNodeId: rollbackNode.nodeId,
    pickupNodeVersion: rollbackNode.version,
    idempotencyKey: `pda-rollback:${rollbackNode.nodeId}:v${rollbackNode.version}`,
  }, (_session, transactionStorage) => {
    transactionStorage?.setItem?.(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, '{"events":[{"partial":true}]}')
    throw new Error('模拟待加工仓流水失败')
  }, rollbackStorage)
} catch {
  // 预期失败，由下方事实快照断言证明两边共同回滚。
}
assert(
  rollbackStorage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY) === prepBefore
  && rollbackStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) === ledgerBefore,
  '任一待加工仓流水失败时，领料 Session/Detail 与流水必须共同回滚',
)

const crashRecoveryStorage = new MemoryStorage()
const crashPrepBefore = serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore())
const crashLedgerBefore = '{"events":[]}'
crashRecoveryStorage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, crashPrepBefore)
crashRecoveryStorage.setItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, crashLedgerBefore)
crashRecoveryStorage.setItem(PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY, JSON.stringify({
  status: 'PREPARING',
  createdAt: '2026-07-30T00:00:00.000Z',
  prepBefore: crashPrepBefore,
  ledgerBefore: crashLedgerBefore,
}))
crashRecoveryStorage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, '{"pickupSessions":[{"partial":true}]}')
crashRecoveryStorage.setItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, '{"events":[{"partial":true}]}')
recoverPendingPickupWarehouseTransaction(crashRecoveryStorage)
assert(
  crashRecoveryStorage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY) === crashPrepBefore
  && crashRecoveryStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) === crashLedgerBefore
  && crashRecoveryStorage.getItem(PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY) === null,
  '浏览器在跨键写入中断后，下一次读取必须按 PREPARING 日志恢复确认前快照',
)

const concurrentStorage = new MemoryStorage()
concurrentStorage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, crashPrepBefore)
concurrentStorage.setItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, crashLedgerBefore)
concurrentStorage.setItem(PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY, JSON.stringify({
  status: 'PREPARING',
  createdAt: new Date().toISOString(),
  prepBefore: crashPrepBefore,
  ledgerBefore: crashLedgerBefore,
}))
let concurrentReadBlocked = false
try {
  recoverPendingPickupWarehouseTransaction(concurrentStorage)
} catch (error) {
  concurrentReadBlocked = error instanceof Error && error.message.includes('正在提交')
}
assert(
  concurrentReadBlocked
  && concurrentStorage.getItem(PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY)?.includes('"PREPARING"'),
  '其他标签页遇到仍活跃的 PREPARING 必须阻断读取，不能误回滚正在提交的事务',
)

console.log('check:pda-pickup-flow passed')
