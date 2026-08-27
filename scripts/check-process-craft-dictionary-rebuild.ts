import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  canSelectCraftInPatternPiece,
  getCraftTargetObject,
  listAccessoryCrafts,
  listAuxiliaryCrafts,
  listCutPiecePartCrafts,
  listCuttingCrafts,
  listFabricCrafts,
  listProcessDefinitions,
  listSpecialCrafts,
  listSpecialTypeCrafts,
} from '../src/data/fcs/process-craft-dict.ts'
import { renderProductionCraftDictPage } from '../src/pages/production-craft-dict.ts'

const root = process.cwd()

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`工序工艺字典检查失败：${message}`)
    process.exit(1)
  }
}

function names<T extends { craftName?: string; processName?: string }>(items: T[]): string[] {
  return items.map((item) => item.craftName || item.processName || '')
}

const preparationNames = names(listProcessDefinitions().filter((item) => item.stageCode === 'PREP'))
for (const processName of ['印花', '染色', '水溶']) {
  assert(preparationNames.includes(processName), `准备阶段缺少${processName}`)
}

const specialCrafts = listSpecialCrafts()

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
for (const craft of specialCrafts.filter((item) => !['捆条', '橡筋定长切割', '盘扣', '烫画'].includes(item.craftName))) {
  assert(craft.targetObject === 'CUT_PIECE_PART', `${craft.craftName} 适用对象应为裁片部位`)
}

assert(canSelectCraftInPatternPiece('捆条') === false, '捆条不得在裁片明细逐片特殊工艺中选择')
assert(canSelectCraftInPatternPiece('橡筋定长切割') === false, '橡筋定长切割不得在裁片明细逐片特殊工艺中选择')

const cutPiecePartNames = names(listCutPiecePartCrafts())
for (const forbidden of ['捆条', '橡筋定长切割']) {
  assert(!cutPiecePartNames.includes(forbidden), `裁片部位特殊工艺可选清单不应包含${forbidden}`)
}
assert(names(listFabricCrafts()).includes('捆条'), '面料级工艺必须包含捆条')
assert(names(listAccessoryCrafts()).includes('橡筋定长切割'), '辅料级工艺必须包含橡筋定长切割')

const cuttingNames = names(listCuttingCrafts())
for (const craft of ['普通裁', '激光定位裁', '定向裁']) {
  assert(cuttingNames.includes(craft), `裁床工序缺少${craft}`)
}

const pageHtml = renderProductionCraftDictPage()
for (const text of ['工序工艺字典', '准备阶段', '生产阶段', '后道阶段', '裁片部位', '面料', '辅料', '定位裁', '激光切', '定向裁']) {
  assert(pageHtml.includes(text), `工序工艺字典页面缺少${text}`)
}
assert(!pageHtml.includes('AUXILIARY') && !pageHtml.includes('CUT_PIECE_PART') && !pageHtml.includes('ACCESSORY'), '页面不应直接展示英文枚举')

for (const scriptPath of [
  'scripts/check-print-dye-web-action-dialog-and-dispatch.ts',
  'scripts/check-post-finishing-web-mobile-action-dialog.ts',
  'scripts/check-special-craft-web-mobile-action-dialog-and-layout.ts',
]) {
  assert(existsSync(resolve(root, scriptPath)), `既有检查脚本不存在：${scriptPath}`)
}

console.log('process craft dictionary rebuild checks passed')
