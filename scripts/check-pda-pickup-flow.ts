import fs from 'node:fs'
import {
  appendPickupSessionFromNode,
  createProductionMaterialPrepSeedStore,
  getPickupSessionByNodeId,
  listActivePickupNodes,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore,
} from '../src/data/fcs/cutting/production-material-prep.ts'

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const pdaSource = fs.readFileSync('src/pages/pda-warehouse-wait-process.ts', 'utf8')
assert(pdaSource.includes('syncCuttingPickupSessionRuntimeFacts'), 'PDA 必须按 Session 快照补写待加工仓流水')
assert(pdaSource.includes('warehouseSyncDeferred: true'), 'PDA 必须先保存 Session/Detail，再完成 runtime 同步')
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
  warehouseSyncDeferred: true,
}
const first = appendPickupSessionFromNode(input, storage)
const duplicate = appendPickupSessionFromNode({ ...input, pickupNodeVersion: 0 }, storage)
assert(first.pickupSessionId === duplicate.pickupSessionId, '节点关闭且旧版本重复提交必须幂等返回原 Session')
assert(first.pickupRecordIds.length === node.items.length, '一次确认必须生成 N 条物料明细')
assert(getPickupSessionByNodeId(node.nodeId, storage)?.pickupSessionId === first.pickupSessionId, '必须可按节点找回 Session 用于弱网恢复')

console.log('check:pda-pickup-flow passed')
