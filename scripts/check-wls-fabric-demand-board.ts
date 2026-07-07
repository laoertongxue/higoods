import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  filterFabricDemandBoardRows,
  getFabricDemandBoardAlertRules,
  getFabricDemandBoardRows,
  summarizeFabricDemandBoardRows,
} from '../src/data/wls/fabric-demand-board.ts'

const allowedAlertTypes = ['缺直裁面料', '缺印花原料', '缺染色原料', '直裁待调拨', '印花待调拨', '染色待调拨'] as const
const englishStatusCodes = ['PENDING', 'IN_PROGRESS', 'DONE', 'WAIT_PROCESS', 'WAIT_INBOUND', 'PROCESSING']
type FabricDemandBoardRow = ReturnType<typeof getFabricDemandBoardRows>[number]
type FabricDemandBoardWarehouseName = FabricDemandBoardRow['warehouseStocks'][number]['warehouseName']
type FabricDemandBoardAlertType = FabricDemandBoardRow['alerts'][number]['type']

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function assertIncludes(source: string, text: string, message: string): void {
  assert.ok(source.includes(text), message)
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function getWarehouseQty(row: ReturnType<typeof getFabricDemandBoardRows>[number], warehouseName: string): number {
  return row.warehouseStocks
    .filter((stock) => stock.warehouseName === warehouseName)
    .reduce((total, stock) => total + stock.qty, 0)
}

function hasWarehouse(row: FabricDemandBoardRow, warehouseName: FabricDemandBoardWarehouseName): boolean {
  return row.warehouseStocks.some((stock) => stock.warehouseName === warehouseName)
}

function assertSameSet(actual: string[], expected: readonly string[], message: string): void {
  assert.deepEqual([...new Set(actual)].sort(), [...expected].sort(), message)
}

function assertFilterSummary(rows: ReturnType<typeof getFabricDemandBoardRows>): void {
  const summary = summarizeFabricDemandBoardRows(rows)
  assert.equal(summary.totalSkuCount, rows.length, '筛选后总数统计应等于筛选后目标面料 SKU 行数')
}

function assertAlertGap(row: FabricDemandBoardRow, alertType: FabricDemandBoardAlertType, gapQty: number): void {
  const alert = row.alerts.find((item) => item.type === alertType)
  assert.ok(alert, `${row.id} 缺少${alertType}异常`)
  assert.equal(alert.gapQty, gapQty, `${row.id} ${alertType}差额错误`)
}

function assertAlertQuantityRule(
  row: FabricDemandBoardRow,
  options: {
    demandField: 'demandQty' | 'rawMaterialDemandQty'
    destinationWarehouse: FabricDemandBoardWarehouseName
    shortageAlertType: FabricDemandBoardAlertType
    transferAlertType: FabricDemandBoardAlertType
  },
): void {
  const demandQty = row[options.demandField]
  const centralQty = getWarehouseQty(row, '中央仓面料仓')
  const destinationQty = getWarehouseQty(row, options.destinationWarehouse)
  const totalQty = centralQty + destinationQty

  if (totalQty < demandQty) {
    assertAlertGap(row, options.shortageAlertType, demandQty - totalQty)
  }

  if (destinationQty < demandQty && centralQty > 0 && totalQty >= demandQty) {
    assertAlertGap(row, options.transferAlertType, demandQty - destinationQty)
  }
}

const rows = getFabricDemandBoardRows()
assert.ok(rows.length >= 4, '面料需求看板 mock 行数至少 4 条')
assert.ok(rows.some((row) => row.requiresPrint), '缺少需印花面料场景')
assert.ok(rows.some((row) => row.requiresDye), '缺少需染色面料场景')
assert.ok(rows.some((row) => !row.requiresPrint && !row.requiresDye), '缺少直裁面料场景')
assert.ok(rows.some((row) => row.warehouseStocks.length >= 2), '缺少多仓库存场景')
assert.ok(rows.some((row) => row.alerts.some((alert) => alert.type === '印花待调拨')), '缺少印花待调拨异常')
assert.ok(rows.some((row) => row.alerts.some((alert) => alert.type === '染色待调拨')), '缺少染色待调拨异常')
assert.ok(rows.some((row) => row.alerts.some((alert) => alert.type === '直裁待调拨')), '缺少直裁待调拨异常')
assert.ok(rows.some((row) => row.alerts.some((alert) => alert.type === '缺印花原料')), '缺少缺印花原料异常')
assert.ok(rows.some((row) => row.alerts.some((alert) => alert.type === '缺染色原料')), '缺少缺染色原料异常')
assert.ok(rows.some((row) => row.alerts.some((alert) => alert.type === '缺直裁面料')), '缺少缺直裁面料异常')

const materialSkus = rows.map((row) => row.materialSku.trim())
assert.ok(materialSkus.every(Boolean), '每行 materialSku 必须非空')
assert.equal(new Set(materialSkus).size, materialSkus.length, '每行 materialSku 必须唯一，一行只能代表一个目标面料 SKU')

const processRows = rows.filter((row) => row.requiresPrint || row.requiresDye)
const processRawSkus = processRows.map((row) => row.rawMaterialSku.trim())
for (const row of processRows) {
  assert.ok(row.rawMaterialName.trim(), `需印花/需染色行缺少 rawMaterialName：${row.materialSku}`)
  assert.ok(row.rawMaterialSku.trim(), `需印花/需染色行缺少 rawMaterialSku：${row.materialSku}`)
  assert.ok(row.rawMaterialDemandQty > 0, `需印花/需染色行 rawMaterialDemandQty 必须大于 0：${row.materialSku}`)
  assert.ok(
    row.warehouseStocks.some((stock) => stock.warehouseName === '中央仓面料仓' && Number.isFinite(stock.qty)),
    `需印花/需染色行缺少中央仓原料库存：${row.materialSku}`,
  )
  const destinationWarehouse = row.requiresPrint ? '印花厂待加工仓' : '染色厂待加工仓'
  assert.ok(
    row.warehouseStocks.some((stock) => stock.warehouseName === destinationWarehouse && Number.isFinite(stock.qty)),
    `需印花/需染色行缺少${destinationWarehouse}原料库存：${row.materialSku}`,
  )
}
assert.ok(
  rows.every((row) => !processRawSkus.includes(row.materialSku)),
  '原料 SKU 只能作为 rawMaterialSku 辅助字段，不应重复作为 materialSku 主行',
)

for (const row of rows) {
  if (!row.requiresPrint && !row.requiresDye) {
    assert.ok(hasWarehouse(row, '中转仓'), `直裁行目的仓必须是中转仓：${row.materialSku}`)
    assertAlertQuantityRule(row, {
      demandField: 'demandQty',
      destinationWarehouse: '中转仓',
      shortageAlertType: '缺直裁面料',
      transferAlertType: '直裁待调拨',
    })
  }

  if (row.requiresPrint) {
    assert.ok(hasWarehouse(row, '印花厂待加工仓'), `印花行目的仓必须是印花厂待加工仓：${row.materialSku}`)
    assertAlertQuantityRule(row, {
      demandField: 'rawMaterialDemandQty',
      destinationWarehouse: '印花厂待加工仓',
      shortageAlertType: '缺印花原料',
      transferAlertType: '印花待调拨',
    })
  }

  if (row.requiresDye) {
    assert.ok(hasWarehouse(row, '染色厂待加工仓'), `染色行目的仓必须是染色厂待加工仓：${row.materialSku}`)
    assertAlertQuantityRule(row, {
      demandField: 'rawMaterialDemandQty',
      destinationWarehouse: '染色厂待加工仓',
      shortageAlertType: '缺染色原料',
      transferAlertType: '染色待调拨',
    })
  }
}

assertSameSet(
  rows.flatMap((row) => row.alerts.map((alert) => alert.type)),
  allowedAlertTypes,
  '面料需求看板行异常只能出现六类业务异常',
)

const summary = summarizeFabricDemandBoardRows(rows)
assert.equal(summary.totalSkuCount, rows.length, '总数统计应等于目标面料 SKU 行数')
assert.equal(summary.printOrDyeSkuCount, rows.filter((row) => row.requiresPrint || row.requiresDye).length, '印染数量统计口径错误')
assert.equal(summary.directCutSkuCount, rows.filter((row) => !row.requiresPrint && !row.requiresDye).length, '直裁数量统计口径错误')
assert.equal(summary.printingQty, sum(rows.map((row) => row.printQty.processingQty)), '印花中 Yard 统计口径错误')
assert.equal(summary.dyeingQty, sum(rows.map((row) => row.dyeQty.processingQty)), '染色中 Yard 统计口径错误')
assert.equal(
  summary.cuttingQty,
  sum(rows.filter((row) => !row.requiresPrint && !row.requiresDye).map((row) => Math.min(row.demandQty, getWarehouseQty(row, '中转仓')))),
  '裁剪中 Yard 统计口径错误',
)
assert.equal(summary.purchasingQty, sum(rows.map((row) => row.purchaseQty.purchasingQty)), '采购中 Yard 统计口径错误')
assert.equal(summary.stockQty, sum(rows.flatMap((row) => row.warehouseStocks.map((stock) => stock.qty))), '库存 Yard 统计口径错误')
assert.ok(summary.printingQty > 0, '印花中 Yard 统计应大于 0')
assert.ok(summary.dyeingQty > 0, '染色中 Yard 统计应大于 0')
assert.ok(summary.cuttingQty > 0, '裁剪中 Yard 统计应大于 0')
assert.ok(summary.purchasingQty > 0, '采购中 Yard 统计应大于 0')
assert.ok(summary.stockQty > 0, '库存 Yard 统计应大于 0')

const rules = getFabricDemandBoardAlertRules()
assert.equal(rules.length, allowedAlertTypes.length, '异常规则数量必须正好是六类')
assertSameSet(rules.map((rule) => rule.type), allowedAlertTypes, '异常规则集合必须且只能是六类业务异常')
for (const type of allowedAlertTypes) {
  const rule = rules.find((item) => item.type === type)
  assert.ok(rule, `缺少异常规则：${type}`)
  assert.ok(rule.triggerText.includes('触发'), `异常规则缺少触发说明：${type}`)
  assert.ok(rule.resolveText.includes('解除'), `异常规则缺少解除说明：${type}`)
}

const transferDirections = [
  ['直裁待调拨', '中央仓面料仓', '中转仓'],
  ['印花待调拨', '中央仓面料仓', '印花厂待加工仓'],
  ['染色待调拨', '中央仓面料仓', '染色厂待加工仓'],
] as const

const keywordRow = rows.find((row) => row.materialSku.trim())
assert.ok(keywordRow, '缺少可用于关键词筛选的目标面料 SKU')
const keywordRows = filterFabricDemandBoardRows(rows, {
  keyword: keywordRow.materialSku,
  materialType: '全部',
  printRequirement: '全部',
  dyeRequirement: '全部',
  alertType: '全部',
  warehouseName: '全部',
})
assert.ok(keywordRows.length > 0, '关键词筛选应能命中面料 SKU')
assert.ok(keywordRows.every((row) => row.materialSku === keywordRow.materialSku), '关键词筛选结果不应混入未命中行')
assertFilterSummary(keywordRows)

const alertRows = filterFabricDemandBoardRows(rows, {
  keyword: '',
  materialType: '全部',
  printRequirement: '全部',
  dyeRequirement: '全部',
  alertType: '印花待调拨',
  warehouseName: '全部',
})
assert.ok(alertRows.length > 0, '异常类型筛选应能命中印花待调拨')
assert.ok(alertRows.every((row) => row.alerts.some((alert) => alert.type === '印花待调拨')), '异常类型筛选结果不应混入其他异常行')
assertFilterSummary(alertRows)

const zeroWarehouseRows = filterFabricDemandBoardRows(
  [
    {
      ...rows[0],
      id: 'fabric-demand-zero-destination',
      warehouseStocks: [
        { warehouseName: '中央仓面料仓', areaName: 'A区', locationCode: 'A-ZERO', qty: 620, unit: 'Yard' },
        { warehouseName: '中转仓', areaName: 'B区', locationCode: 'B-ZERO', qty: 0, unit: 'Yard' },
      ],
    },
  ],
  {
    keyword: '',
    materialType: '全部',
    printRequirement: '全部',
    dyeRequirement: '全部',
    alertType: '全部',
    warehouseName: '中转仓',
  },
)
assert.equal(zeroWarehouseRows.length, 1, '仓库筛选应按是否存在仓库记录命中，不应按库存大于 0 过滤')

const { renderWlsFabricDemandBoardPage } = await import('../src/pages/wls-fabric-demand-board.ts')
const menuSource = read('src/data/app-shell-config.ts')
const routesSource = read('src/router/routes.ts')
const renderersSource = read('src/router/route-renderers.ts')
const mainSource = read('src/main.ts')

assertIncludes(menuSource, '面料需求看板', 'WLS 菜单缺少面料需求看板')
assertIncludes(menuSource, '/wls/fabric-demand-board', 'WLS 菜单缺少面料需求看板路径')
assertIncludes(routesSource, '/wls/fabric-demand-board', '路由缺少 /wls/fabric-demand-board')
assertIncludes(renderersSource, 'renderWlsFabricDemandBoardPage', '缺少 WLS 面料需求看板渲染器')
assertIncludes(mainSource, 'handleWlsFabricDemandBoardEvent', '主事件流缺少 WLS 面料需求看板事件处理')

const html = renderWlsFabricDemandBoardPage()
for (const text of [
  '面料需求看板',
  '数据搜索区',
  '数据统计区',
  '数据展示区',
  '关键词',
  '面料类型',
  '面料 SPU',
  '是否需印花',
  '是否需染色',
  '需印花',
  '不需印花',
  '原料库存',
  '多仓库存',
  '异常预警',
  '中央仓面料仓',
  '印花厂待加工仓',
  '染色厂待加工仓',
  '中转仓',
  '印花中 Yard',
  '染色中 Yard',
  '裁剪中 Yard',
  '采购中 Yard',
  '待领料',
  '待入库',
  '差额',
  'Yard',
  '卷',
  '条/页',
  '上一页',
  '下一页',
]) {
  assertIncludes(html, text, `页面缺少文案：${text}`)
}

for (const row of rows) {
  for (const stock of row.warehouseStocks) {
    assert.equal(stock.unit, 'Yard', `${row.materialSku} 库存单位必须是 Yard`)
    assert.ok(!html.includes(stock.locationCode), `多仓库存不得展示库位：${stock.locationCode}`)
  }
}

assert.ok(!html.includes(' 米'), '页面不得继续展示米作为面料单位')

for (const [type, from, to] of transferDirections) {
  const rule = rules.find((item) => item.type === type)
  const ruleText = `${rule?.triggerText ?? ''}${rule?.resolveText ?? ''}`
  const directionText = `${from} -> ${to}`
  const escapedDirectionText = directionText.replace('->', '-&gt;')
  assert.ok(ruleText.includes(directionText), `${type} 规则必须明确调拨方向：${directionText}`)
  assert.ok(html.includes(escapedDirectionText), `${type} 页面必须可见调拨方向：${directionText}`)
}

assert.ok(
  processRows.some((row) => html.includes(row.rawMaterialSku) || html.includes(row.rawMaterialName)),
  '页面至少要展示一个原料 SKU 或原料名称',
)

for (const statusCode of englishStatusCodes) {
  assert.ok(!html.includes(statusCode), `页面不得展示英文状态码 ${statusCode}`)
}

console.log('WLS 面料需求看板检查通过')
