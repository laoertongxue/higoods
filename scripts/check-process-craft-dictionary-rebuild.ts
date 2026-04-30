import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  canSelectCraftInPatternPiece,
  getCraftTargetObject,
  listAccessoryCrafts,
  listAuxiliaryCrafts,
  listCutPiecePartCrafts,
  listCuttingCrafts,
  listFabricCrafts,
  listPreparationProcesses,
  listProcessCraftDictRows,
  listSelectableSpecialCraftDefinitions,
  listSpecialCrafts,
  listSpecialTypeCrafts,
} from '../src/data/fcs/process-craft-dict.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { listEnabledSpecialCraftOperationDefinitions } from '../src/data/fcs/special-craft-operations.ts'
import { renderProductionCraftDictPage } from '../src/pages/production-craft-dict.ts'

const root = process.cwd()

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`工序工艺字典检查失败：${message}`)
    process.exit(1)
  }
}

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function names<T extends { craftName?: string; processName?: string }>(items: T[]): string[] {
  return items.map((item) => item.craftName || item.processName || '')
}

const preparationProcesses = listPreparationProcesses()
assert(preparationProcesses.some((item) => item.processCode === 'PREP_SHRINKING' && item.processName === '缩水'), '准备阶段缺少缩水')
assert(preparationProcesses.some((item) => item.processCode === 'PREP_WASHING' && item.processName === '洗水'), '准备阶段缺少洗水')

const specialCrafts = listSpecialCrafts()
assert(!specialCrafts.some((item) => item.craftName === '洗水'), '洗水仍在新特殊工艺清单中')
assert(listSelectableSpecialCraftDefinitions().every((item) => item.craftName !== '洗水'), '洗水仍可进入特殊工艺任务定义')
assert(listEnabledSpecialCraftOperationDefinitions().every((item) => item.operationName !== '洗水'), '洗水仍出现在特殊工艺任务清单')
assert(
  listFactoryMasterRecords().every((factory) =>
    factory.processAbilities.every((ability) =>
      !(ability.processCode === 'SPECIAL_CRAFT' && (ability.craftNames || []).includes('洗水')),
    ),
  ),
  '工厂能力仍把洗水登记为特殊工艺',
)

const auxiliaryNames = names(listAuxiliaryCrafts())
const specialTypeNames = names(listSpecialTypeCrafts())
for (const craft of ['绣花', '打条', '压褶', '打揽', '烫画', '直喷', '贝壳绣', '曲牙绣', '一字贝绣花', '捆条']) {
  assert(auxiliaryNames.includes(craft), `辅助工艺缺少${craft}`)
}
for (const craft of ['模板工序', '激光开袋', '特种车缝（花样机）', '橡筋定长切割']) {
  assert(specialTypeNames.includes(craft), `特种工艺缺少${craft}`)
}
assert(specialCrafts.some((item) => item.craftCategoryName === '辅助工艺'), '特殊工艺缺少辅助工艺类别')
assert(specialCrafts.some((item) => item.craftCategoryName === '特种工艺'), '特殊工艺缺少特种工艺类别')

assert(getCraftTargetObject('橡筋定长切割') === 'ACCESSORY', '橡筋定长切割适用对象必须为辅料')
assert(getCraftTargetObject('捆条') === 'FABRIC', '捆条适用对象必须为面料')
for (const craft of specialCrafts.filter((item) => !['捆条', '橡筋定长切割'].includes(item.craftName))) {
  assert(craft.targetObject === 'CUT_PIECE_PART', `${craft.craftName} 适用对象应为裁片部位`)
}

assert(canSelectCraftInPatternPiece('捆条') === false, '捆条不得在裁片明细逐片特殊工艺中选择')
assert(canSelectCraftInPatternPiece('橡筋定长切割') === false, '橡筋定长切割不得在裁片明细逐片特殊工艺中选择')
assert(canSelectCraftInPatternPiece('洗水') === false, '洗水不得在裁片明细逐片特殊工艺中选择')

const cutPiecePartNames = names(listCutPiecePartCrafts())
for (const forbidden of ['捆条', '橡筋定长切割', '洗水']) {
  assert(!cutPiecePartNames.includes(forbidden), `裁片部位特殊工艺可选清单不应包含${forbidden}`)
}
assert(names(listFabricCrafts()).includes('捆条'), '面料级工艺必须包含捆条')
assert(names(listAccessoryCrafts()).includes('橡筋定长切割'), '辅料级工艺必须包含橡筋定长切割')

const cuttingNames = names(listCuttingCrafts())
for (const craft of ['普通裁', '激光定位裁', '定向裁']) {
  assert(cuttingNames.includes(craft), `裁床工序缺少${craft}`)
}

const washRow = listProcessCraftDictRows(true).find((row) => row.craftName === '洗水')
assert(washRow?.stageName === '准备阶段', '洗水必须显示为准备阶段工序')
assert(washRow?.processName === '洗水', '洗水必须作为准备阶段洗水工序展示')

const pageHtml = renderProductionCraftDictPage()
for (const text of ['工序工艺字典', '缩水', '洗水', '辅助工艺', '特种工艺', '裁片部位', '面料', '辅料', '普通裁', '激光定位裁', '定向裁']) {
  assert(pageHtml.includes(text), `工序工艺字典页面缺少${text}`)
}
assert(!pageHtml.includes('AUXILIARY') && !pageHtml.includes('CUT_PIECE_PART') && !pageHtml.includes('ACCESSORY'), '页面不应直接展示英文枚举')

const dictSource = read('src/data/fcs/process-craft-dict.ts')
assert(dictSource.includes('hiddenInNewDict'), '洗水旧特殊工艺口径应保留隐藏标记')
assert(dictSource.includes('PREP_SHRINKING') && dictSource.includes('PREP_WASHING'), '字典缺少准备阶段编码')
assert(!read('src/data/fcs/process-mobile-task-binding.ts').includes('激光切|洗水|烫画'), '移动端绑定不应把洗水识别为特殊工艺')
assert(!read('src/pages/pda-exec-detail.ts').includes('激光切|洗水|烫画'), '移动端详情不应把洗水识别为特殊工艺')
assert(!read('src/pages/print/templates/task-delivery-card-template.ts').includes("'激光切', '洗水'"), '打印交货卡不应把洗水识别为特殊工艺')
const routingTemplateSource = read('src/data/fcs/routing-templates.ts')
assert(!routingTemplateSource.includes("processCode: 'PROC_SPECIAL_CRAFT', craftName: '洗水'"), '路由模板不得把洗水作为特殊工艺步骤')
assert(routingTemplateSource.includes("processCode: 'PROC_WASH', craftName: '洗水'"), '路由模板中的洗水必须使用准备阶段 PROC_WASH')

for (const scriptPath of [
  'scripts/check-print-dye-web-action-dialog-and-dispatch.ts',
  'scripts/check-post-finishing-web-mobile-action-dialog.ts',
  'scripts/check-special-craft-web-mobile-action-dialog-and-layout.ts',
  'scripts/check-three-end-process-chain-final.ts',
]) {
  assert(existsSync(resolve(root, scriptPath)), `既有检查脚本不存在：${scriptPath}`)
}

console.log('process craft dictionary rebuild checks passed')
