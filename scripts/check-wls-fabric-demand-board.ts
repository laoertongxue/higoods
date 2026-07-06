import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getFabricDemandBoardAlertRules,
  getFabricDemandBoardRows,
  summarizeFabricDemandBoardRows,
} from '../src/data/wls/fabric-demand-board.ts'
import { renderWlsFabricDemandBoardPage } from '../src/pages/wls-fabric-demand-board.ts'

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function assertIncludes(source: string, text: string, message: string): void {
  assert.ok(source.includes(text), message)
}

const menuSource = read('src/data/app-shell-config.ts')
const routesSource = read('src/router/routes.ts')
const renderersSource = read('src/router/route-renderers.ts')
const mainSource = read('src/main.ts')

assertIncludes(menuSource, '面料需求看板', 'WLS 菜单缺少面料需求看板')
assertIncludes(menuSource, '/wls/fabric-demand-board', 'WLS 菜单缺少面料需求看板路径')
assertIncludes(routesSource, '/wls/fabric-demand-board', '路由缺少 /wls/fabric-demand-board')
assertIncludes(renderersSource, 'renderWlsFabricDemandBoardPage', '缺少 WLS 面料需求看板渲染器')
assertIncludes(mainSource, 'handleWlsFabricDemandBoardEvent', '主事件流缺少 WLS 面料需求看板事件处理')

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

const summary = summarizeFabricDemandBoardRows(rows)
assert.equal(summary.totalSkuCount, rows.length, '总数统计应等于目标面料 SKU 行数')
assert.ok(summary.printOrDyeSkuCount > 0, '印染数量统计应大于 0')
assert.ok(summary.directCutSkuCount > 0, '直裁数量统计应大于 0')
assert.ok(summary.stockQty > 0, '库存米数统计应大于 0')

const rules = getFabricDemandBoardAlertRules()
for (const type of ['缺直裁面料', '缺印花原料', '缺染色原料', '直裁待调拨', '印花待调拨', '染色待调拨'] as const) {
  const rule = rules.find((item) => item.type === type)
  assert.ok(rule, `缺少异常规则：${type}`)
  assert.ok(rule.triggerText.includes('触发'), `异常规则缺少触发说明：${type}`)
  assert.ok(rule.resolveText.includes('解除'), `异常规则缺少解除说明：${type}`)
}

const html = renderWlsFabricDemandBoardPage()
for (const text of [
  '面料需求看板',
  '数据搜索区',
  '数据统计区',
  '数据展示区',
  '面料 SPU',
  '是否需印花',
  '是否需染色',
  '原料库存',
  '多仓库存',
  '异常预警',
  '中央仓面料仓',
  '印花厂待加工仓',
  '染色厂待加工仓',
  '中转仓',
]) {
  assertIncludes(html, text, `页面缺少文案：${text}`)
}

assert.ok(!html.includes('PENDING'), '页面不得展示英文状态码 PENDING')
assert.ok(!html.includes('IN_PROGRESS'), '页面不得展示英文状态码 IN_PROGRESS')
assert.ok(!html.includes('DONE'), '页面不得展示英文状态码 DONE')

console.log('WLS 面料需求看板检查通过')
