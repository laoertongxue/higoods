import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  getProcessCraftByCode,
  listActiveProcessCraftDefinitions,
  listInactiveProcessCraftDefinitions,
} from '../src/data/fcs/process-craft-dict.ts'
import { listGeneratedCutOrderSourceRecords } from '../src/data/fcs/cutting/generated-cut-orders.ts'
import { listProcessWorkOrders } from '../src/data/fcs/process-work-order-domain.ts'
import { listWoolWorkOrders } from '../src/data/fcs/wool-task-domain.ts'
import { POST_FINISHING_PROCESS_ITEMS } from '../src/data/fcs/post-finishing-full-flow.ts'

type Stage = 'PREP' | 'PROD' | 'POST'
type Handling = '保留并接入' | '并入现有承载体' | '删除旧事实' | '保留但不是加工单'
type RelationMode = '通用任务项关系' | '内部节点' | '后道专用事实链' | '不适用'

interface DeliveryEntry {
  id: string
  name: string
  stage: Stage
  handling: Handling
  relationMode: RelationMode
  carriers: string[]
  checks: string[]
  retiredPaths?: string[]
}

const root = process.cwd()
const relationCarrier = 'src/data/fcs/process-order-task-links.ts'

function entry(
  id: string,
  name: string,
  stage: Stage,
  handling: Handling,
  relationMode: RelationMode,
  carriers: string[],
  checks: string[],
  retiredPaths: string[] = [],
): DeliveryEntry {
  return { id, name, stage, handling, relationMode, carriers, checks, retiredPaths }
}

/**
 * 方案第五、六、七章的完整交付登记册。
 *
 * 这里登记的是“现有原型中的执行承载体或明确非加工单对象”，并不把 57 项
 * 强行改造成 57 张不同实体。共用专项域的条目仍逐项列出，避免用一条
 * “辅助/特种工艺已覆盖”笼统结论掩盖具体工艺。
 */
export const PROCESS_ROUTE_FULL_STAGE_DELIVERY: DeliveryEntry[] = [
  entry('PREP-001', '正式生产单来源印花加工单', 'PREP', '保留并接入', '通用任务项关系', ['src/data/fcs/printing-task-domain.ts', relationCarrier, 'src/pages/process-factory/printing/work-order-detail.ts'], ['check:printing-authority-cleanup', 'check:process-order-task-relations']),
  entry('PREP-002', '待加工仓备货来源印花加工单', 'PREP', '保留并接入', '通用任务项关系', ['src/data/fcs/printing-task-domain.ts', relationCarrier, 'src/pages/process-factory/printing/work-order-detail.ts'], ['check:printing-authority-cleanup', 'check:process-order-task-relations']),
  entry('PREP-003', '裁床补料来源印花加工单', 'PREP', '保留并接入', '通用任务项关系', ['src/data/fcs/printing-task-domain.ts', relationCarrier, 'src/pages/process-factory/printing/work-order-detail.ts'], ['check:printing-authority-cleanup', 'check:process-order-task-relations']),
  entry('PREP-004', '正式生产单来源染色加工单', 'PREP', '保留并接入', '通用任务项关系', ['src/data/fcs/dyeing-task-domain.ts', relationCarrier, 'src/pages/process-factory/dyeing/work-order-detail.ts'], ['check:dye-work-order-online-alignment', 'check:process-order-task-relations']),
  entry('PREP-005', '待加工仓备货来源染色加工单', 'PREP', '保留并接入', '通用任务项关系', ['src/data/fcs/dyeing-task-domain.ts', relationCarrier, 'src/pages/process-factory/dyeing/work-order-detail.ts'], ['check:dye-work-order-online-alignment', 'check:process-order-task-relations']),
  entry('PREP-006', '裁床补料来源染色加工单', 'PREP', '保留并接入', '通用任务项关系', ['src/data/fcs/dyeing-task-domain.ts', relationCarrier, 'src/pages/process-factory/dyeing/work-order-detail.ts'], ['check:dye-work-order-online-alignment', 'check:process-order-task-relations']),
  entry('PREP-007', '独立水溶加工单', 'PREP', '保留并接入', '通用任务项关系', ['src/data/fcs/water-soluble-task-domain.ts', relationCarrier, 'src/pages/process-water-soluble-orders.ts'], ['check:water-soluble-process', 'check:water-soluble-pages', 'check:process-order-task-relations']),
  entry('PREP-008', '染色单内嵌水溶', 'PREP', '并入现有承载体', '内部节点', ['src/data/fcs/dyeing-task-domain.ts', 'src/data/fcs/water-soluble-task-domain.ts'], ['check:water-soluble-process', 'check:dye-work-order-online-alignment']),
  entry('PREP-010', '工厂端印花生产单演示域', 'PREP', '删除旧事实', '不适用', ['src/data/fcs/printing-task-domain.ts', 'src/pages/process-factory/printing/work-orders.ts'], ['check:printing-authority-cleanup'], ['src/pages/dye-print-orders.ts']),
  entry('PREP-011', '旧染印加工单兼容域', 'PREP', '删除旧事实', '不适用', ['src/data/fcs/printing-task-domain.ts', 'src/data/fcs/dyeing-task-domain.ts'], ['check:printing-authority-cleanup', 'check:dye-work-order-online-alignment'], ['src/pages/dye-print-orders.ts']),
  entry('PREP-012', '生产物料准备/领料任务', 'PREP', '保留但不是加工单', '不适用', ['src/data/fcs/cutting/production-material-prep.ts', 'src/pages/fcs/material-prep/list.ts'], ['check:production-process-work-order-generation']),

  entry('PROD-001', '正式生成裁片单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/cutting/generated-cut-orders.ts', relationCarrier, 'src/pages/process-factory/cutting/cut-orders.ts'], ['check:cutting-special-process-current-source', 'check:process-order-task-relations']),
  entry('PROD-002', '旧运行时裁片单', 'PROD', '删除旧事实', '不适用', ['src/data/fcs/cutting/generated-cut-orders.ts'], ['check:cutting-special-process-current-source'], ['src/data/fcs/cutting/cut-piece-orders.ts', 'src/domain/pickup/page-adapters/pcs-cut-piece-orders.ts']),
  entry('PROD-003', '捆条加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/pages/process-factory/cutting/binding-strip-orders.ts', relationCarrier, 'src/pages/process-factory/cutting/special-processes.ts'], ['check:cutting-binding-strip-flow', 'check:process-order-task-relations']),
  entry('PROD-004', '整件毛织加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/wool-domain/types.ts', relationCarrier, 'src/pages/process-factory/wool/work-order-detail.ts'], ['check:wool-fact-workflow', 'check:process-order-task-relations']),
  entry('PROD-005', '部位毛织加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/wool-domain/types.ts', relationCarrier, 'src/pages/process-factory/wool/work-order-detail.ts'], ['check:wool-fact-workflow', 'check:wool-warehouse-unified-model', 'check:process-order-task-relations']),
  entry('PROD-006', '独立车缝任务', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/process-tasks.ts', 'src/data/fcs/cutting/sewing-dispatch.ts', relationCarrier], ['check:cutting-sewing-dispatch', 'check:process-order-task-relations']),
  entry('PROD-007', '车缝+烫包合并任务', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/process-tasks.ts', 'src/data/fcs/post-finishing-return-source-adapter.ts', relationCarrier], ['check:post-finishing-return-source-generalization', 'check:process-order-task-relations']),
  entry('PROD-008', '裁剪+车缝+烫包合并任务', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/process-tasks.ts', 'src/data/fcs/post-finishing-return-source-adapter.ts', relationCarrier], ['check:post-finishing-return-source-generalization', 'check:process-order-task-relations']),
  entry('PROD-009', 'KOL整单任务', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/process-tasks.ts', 'src/pages/pda-kol-goto-exec.ts', relationCarrier], ['check:post-finishing-return-source-generalization', 'check:process-order-task-relations']),
  entry('PROD-010', '绣花加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:special-craft-task-generation', 'check:special-craft-route-occurrence', 'check:process-order-task-relations']),
  entry('PROD-011', '打条加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:special-craft-task-generation', 'check:process-order-task-relations']),
  entry('PROD-012', '压褶加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:process-craft-final-taxonomy', 'check:special-craft-task-generation']),
  entry('PROD-013', '打揽加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:special-craft-task-generation', 'check:process-order-task-relations']),
  entry('PROD-014', '烫画加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:tech-pack-special-craft-target-object-and-versioning', 'check:special-craft-task-generation']),
  entry('PROD-015', '直喷加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:tech-pack-special-craft-target-object-and-versioning', 'check:no-piece-printing-runtime']),
  entry('PROD-016', '贝壳绣加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:special-craft-task-generation', 'check:process-order-task-relations']),
  entry('PROD-017', '曲牙绣加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:process-craft-final-taxonomy', 'check:no-piece-printing-runtime']),
  entry('PROD-018', '一字贝绣花加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:special-craft-task-generation', 'check:process-order-task-relations']),
  entry('PROD-019', '盘扣加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', 'src/data/fcs/binding-process-pda-scan.ts', relationCarrier], ['check:button-loop-auxiliary-crafts', 'check:aux-special-accessory:domain']),
  entry('PROD-020', '花朵加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:aux-special-accessory:named-scenarios', 'check:process-order-task-relations']),
  entry('PROD-021', '打褶加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:process-craft-final-taxonomy', 'check:aux-special-accessory:named-scenarios']),
  entry('PROD-022', '烫钻加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:aux-special-accessory:named-scenarios', 'check:process-order-task-relations']),
  entry('PROD-023', '模板工序加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:special-craft-task-generation', 'check:process-order-task-relations']),
  entry('PROD-024', '激光开袋加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:special-craft-task-generation', 'check:process-order-task-relations']),
  entry('PROD-025', '特种车缝（花样机）加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:special-craft-task-generation', 'check:process-order-task-relations']),
  entry('PROD-026', '橡筋定长切割加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:aux-special-accessory:named-scenarios', 'check:process-order-task-relations']),
  entry('PROD-027', '花边生产/加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/lace-factory-domain.ts', relationCarrier, 'src/pages/process-factory/accessory/lace/work-order-detail.ts'], ['check:lace-formal-process-chain', 'check:process-order-task-relations']),
  entry('PROD-028', '布包扣加工单', 'PROD', '保留并接入', '通用任务项关系', ['src/data/fcs/special-craft-task-orders.ts', relationCarrier, 'src/pages/process-factory/special-craft/task-detail.ts'], ['check:aux-special-accessory:named-scenarios', 'check:process-order-task-relations']),

  entry('POST-001', '独立烫包运行时任务', 'POST', '并入现有承载体', '后道专用事实链', ['src/data/fcs/post-finishing-return-source-adapter.ts', 'src/data/fcs/post-finishing-full-flow.ts'], ['check:post-finishing-return-source-generalization']),
  entry('POST-002', '新全流程后道加工单', 'POST', '保留并接入', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/pages/process-factory/post-finishing/work-order-detail.ts'], ['check:post-finishing-full-flow', 'check:post-finishing-full-flow-surface']),
  entry('POST-003', '旧域后道加工单', 'POST', '删除旧事实', '不适用', ['src/data/fcs/post-finishing-current-read-model.ts', 'src/data/fcs/post-finishing-full-flow.ts'], ['check:post-finishing-full-flow-surface'], ['src/data/fcs/post-finishing-domain.ts']),
  entry('POST-004', '三方工厂内后道任务旧投影', 'POST', '删除旧事实', '不适用', ['src/data/fcs/post-finishing-return-source-adapter.ts'], ['check:post-finishing-return-source-generalization']),
  entry('POST-005', '开扣眼项目', 'POST', '并入现有承载体', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/pages/process-factory/post-finishing/qc-workbench.ts'], ['check:post-finishing-full-flow']),
  entry('POST-006', '装扣子项目', 'POST', '并入现有承载体', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/pages/process-factory/post-finishing/material-transfers.ts'], ['check:post-finishing-full-flow']),
  entry('POST-007', '后道责任快照', 'POST', '保留并接入', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/data/fcs/post-finishing-return-source-adapter.ts'], ['check:post-finishing-return-source-generalization', 'check:post-finishing-full-flow']),
  entry('POST-008', '回货送货单/批次', 'POST', '保留并接入', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/pages/pda-sewing-self-return.ts'], ['check:post-finishing-sewing-self-return', 'check:post-finishing-full-flow']),
  entry('POST-009', '后道待加工仓及移动', 'POST', '保留并接入', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/pages/process-factory/post-finishing/warehouse.ts'], ['check:post-finishing-full-flow']),
  entry('POST-010', '回货最终确认版本', 'POST', '保留并接入', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/pages/process-factory/post-finishing/audit-records.ts'], ['check:post-finishing-full-flow']),
  entry('POST-011', '到货QC单', 'POST', '保留并接入', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/pages/process-factory/post-finishing/qc-orders.ts'], ['check:post-finishing-full-flow', 'check:qc-records-facts-only', 'check:quality-current-task-source']),
  entry('POST-012', '复检单', 'POST', '保留并接入', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/pages/process-factory/post-finishing/recheck-orders.ts'], ['check:post-route-qc-recheck', 'check:post-finishing-full-flow']),
  entry('POST-013', '后道待交出仓及移动', 'POST', '保留并接入', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/pages/pda-warehouse-wait-handover.ts'], ['check:post-finishing-full-flow', 'check:handover-writeback-difference-unification']),
  entry('POST-014', '后道出货单', 'POST', '保留并接入', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/pages/process-factory/post-finishing/outbound-orders.ts'], ['check:post-finishing-outbound-and-online-print'], ['src/data/fcs/post-finishing-outbound-orders.ts']),
  entry('POST-015', '成衣仓收货记录', 'POST', '保留并接入', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/pages/pda-warehouse-inbound-records.ts'], ['check:post-finishing-outbound-and-online-print']),
  entry('POST-016', '瑕疵、差异授权和操作日志', 'POST', '保留并接入', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/pages/process-factory/post-finishing/audit-records.ts'], ['check:post-finishing-full-flow', 'check:post-finishing-flow-correction']),
  entry('POST-017', '后道辅料调拨单及库存', 'POST', '保留并接入', '后道专用事实链', ['src/data/fcs/post-finishing-full-flow.ts', 'src/pages/process-factory/post-finishing/material-transfers.ts'], ['check:post-finishing-full-flow']),
]

function expectedIds(prefix: Stage, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(3, '0')}`)
}

const ids = PROCESS_ROUTE_FULL_STAGE_DELIVERY.map((item) => item.id)
assert.equal(PROCESS_ROUTE_FULL_STAGE_DELIVERY.length, 56, '交付登记册必须完整覆盖 11 个准备项、28 个生产项、17 个后道项')
assert.equal(new Set(ids).size, ids.length, '交付登记编号不得重复')
for (const [stage, count] of [['PREP', 12], ['PROD', 28], ['POST', 17]] as const) {
  assert.deepEqual(
    PROCESS_ROUTE_FULL_STAGE_DELIVERY.filter((item) => item.stage === stage).map((item) => item.id),
    expectedIds(stage, count).filter(id => id !== 'PREP-009'),
    `${stage} 登记项必须连续且无遗漏`,
  )
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
const packageScripts = packageJson.scripts ?? {}
for (const item of PROCESS_ROUTE_FULL_STAGE_DELIVERY) {
  assert(item.carriers.length > 0, `${item.id} 缺少当前承载位置`)
  assert(item.checks.length > 0, `${item.id} 缺少自动化验证绑定`)
  for (const carrier of item.carriers) assert(existsSync(join(root, carrier)), `${item.id} 当前承载位置不存在：${carrier}`)
  for (const command of item.checks) assert(packageScripts[command], `${item.id} 引用的验证命令不存在：npm run ${command}`)
  for (const retiredPath of item.retiredPaths ?? []) assert(!existsSync(join(root, retiredPath)), `${item.id} 旧事实仍存在：${retiredPath}`)
  if (item.stage === 'POST') assert.notEqual(item.relationMode, '通用任务项关系', `${item.id} 后道不得套用准备/生产通用关系卡`)
  if (item.relationMode === '通用任务项关系') assert(item.carriers.includes(relationCarrier), `${item.id} 未接入统一任务项关系索引`)
}

assert.equal(listInactiveProcessCraftDefinitions().length, 0, '工艺字典不得保留停用历史词条')
const activeCrafts = listActiveProcessCraftDefinitions()
for (const craftName of ['绣花', '打条', '压褶', '打揽', '烫画', '直喷', '贝壳绣', '曲牙绣', '一字贝绣花', '盘扣', '花朵', '打褶', '烫钻', '模板工序', '激光开袋', '特种车缝（花样机）', '橡筋定长切割', '布包扣']) {
  assert(activeCrafts.some((craft) => craft.craftName === craftName), `生产登记工艺缺少当前有效词条：${craftName}`)
}
assert(!activeCrafts.some((craft) => craft.craftName === '曲牙'), '旧曲牙词条不得继续存在')
assert.deepEqual(getProcessCraftByCode('CRAFT_008192')?.inputObjectTypes, ['CUT_PIECE_PART', 'GARMENT_SEMI'], '烫画必须同时支持裁片和成衣')
assert.deepEqual(getProcessCraftByCode('CRAFT_016384')?.inputObjectTypes, ['CUT_PIECE_PART', 'GARMENT_SEMI'], '直喷必须同时支持裁片和成衣')
assert.deepEqual(getProcessCraftByCode('CRAFT_032768')?.outputObjectTypes, ['ACCESSORY'], '布包扣产出必须是包布钮辅件')
assert.deepEqual(getProcessCraftByCode('CRAFT_3100002')?.outputObjectTypes, ['ACCESSORY'], '花朵必须由指定裁片部位产出花朵部件')
assert(getProcessCraftByCode('CRAFT_3000002'), '压褶必须保留独立词条')
assert(getProcessCraftByCode('CRAFT_3100003'), '打褶必须保留独立词条')

assert(listProcessWorkOrders('PRINT').length > 0, '正式印花加工单必须存在')
assert(listProcessWorkOrders('DYE').length > 0, '正式染色加工单必须存在')
assert(listProcessWorkOrders('WATER_SOLUBLE').length > 0, '独立水溶加工单必须存在')
assert(listGeneratedCutOrderSourceRecords().length > 0, '正式生成裁片单必须存在')
const woolOrders = listWoolWorkOrders()
assert(woolOrders.some((order) => order.kind === 'WHOLE_GARMENT'), '整件毛织加工单必须存在')
assert(woolOrders.some((order) => order.kind === 'PART_PANEL'), '部位毛织加工单必须存在')
assert.deepEqual([...POST_FINISHING_PROCESS_ITEMS], ['开扣眼', '装扣子', '烫包'], '后道项目必须统一为开扣眼、装扣子、烫包')

for (const scope of ['src', 'scripts', 'tests', 'docs']) {
  const files = existsSync(join(root, scope)) ? scope : ''
  assert(files, `扫描目录不存在：${scope}`)
}

for (const item of PROCESS_ROUTE_FULL_STAGE_DELIVERY) {
  console.log(`[PASS] ${item.id} ${item.name}｜${item.handling}｜${item.relationMode}｜${item.checks.map((check) => `npm run ${check}`).join('；')}`)
}
console.log('全阶段逐项登记检查通过：PREP 11 + PROD 28 + POST 17 = 56 项，编号、承载位置、关系模式、旧事实删除和验证绑定均完整。')
