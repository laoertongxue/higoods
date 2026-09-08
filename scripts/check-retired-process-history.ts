import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const dataPath = 'src/data/fcs/retired-process-history.ts'
assert(existsSync(dataPath), '旧裁片/染印历史只读档案不存在，旧 ID 与历史明细无法查询')
const { retiredProcessHistoryMetadata, listRetiredProcessHistory, getRetiredProcessHistory } = await import('../src/data/fcs/retired-process-history.ts')
const { renderRetiredProcessHistoryPage } = await import('../src/pages/retired-process-history.ts')
// 比较固化基线原文中的全部数据，不能仅检查数量或 ID 而漏掉铺布、回货明细。
function readBaseline(file: string, variable: string): unknown[] {
  const source = execFileSync('git', ['show', `${retiredProcessHistoryMetadata.sourceCommit}:${file}`], { encoding: 'utf8' })
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  let expression = ''
  for (const statement of ast.statements) if (ts.isVariableStatement(statement)) {
    const declaration = statement.declarationList.declarations.find((item) => item.name.getText(ast) === variable)
    if (declaration?.initializer) expression = declaration.initializer.getText(ast)
  }
  assert(expression)
  return Function('TEST_FACTORY_NAME', `return (${expression})`)('全能力测试工厂')
}
assert.equal(retiredProcessHistoryMetadata.schemaVersion, 1)
assert(retiredProcessHistoryMetadata.deletionConditions.length >= 2)
const records = listRetiredProcessHistory()
assert.equal(records.length, 15)
for (const [kind, file, variable] of [
  ['CUT_PIECE', 'src/data/fcs/cutting/cut-piece-orders.ts', 'rawCutPieceOrderRecords'],
  ['DYE_PRINT', 'src/data/fcs/store-domain-quality-seeds.ts', 'legacyDyePrintOrdersSnapshot'],
] as const) {
  const baseline = readBaseline(file, variable) as Array<Record<string, unknown>>
  assert.equal(records.filter((item) => item.kind === kind).length, baseline.length)
  for (const original of baseline) {
    const id = String(original.id || original.dpId)
    const no = String(original.cutPieceOrderNo || original.orderId)
    const archived = getRetiredProcessHistory(id)!
    assert(archived, id)
    assert.equal(getRetiredProcessHistory(no)?.id, id)
    assert.equal(archived.mappingStatus, 'UNMAPPED')
    assert.deepEqual(archived.snapshot, original, `${id} 历史原始事实应完整保留`)
    const html = renderRetiredProcessHistoryPage(id)
    assert(html.includes(no) && html.includes('未映射正式记录'))
    assert(!/<(?:button|input|select|textarea)\b|data-action=/.test(html), '历史详情不得出现业务操作或新写入口')
    assert(!html.includes('<img'), '基线没有对象原图，不得冒充已配图')
  }
}
const mutated = getRetiredProcessHistory('cpo-001')!
mutated.snapshot.notes = '不得污染只读档案'
assert.notEqual(getRetiredProcessHistory('cpo-001')!.snapshot.notes, mutated.snapshot.notes)
assert.equal(getRetiredProcessHistory('UNKNOWN'), null)
assert(renderRetiredProcessHistoryPage('UNKNOWN').includes('未找到历史记录'))
const routes = readFileSync('src/router/routes-fcs.ts', 'utf8')
assert(routes.includes("'/fcs/craft/cutting/cut-piece-orders'"))
assert(routes.includes("'/fcs/dye-print-orders'"))
assert(routes.includes('renderRetiredProcessHistoryPage'))
const { appStore } = await import('../src/state/store.ts')
const { resolvePage } = await import('../src/router/routes.ts')
for (const [path, id] of [
  ['/fcs/craft/cutting/cut-piece-orders?id=cpo-001', 'cpo-001'],
  ['/fcs/dye-print-orders?dpId=DPO-202603-0003', 'DPO-202603-0003'],
  ['/fcs/craft/cutting/cut-piece-orders/CP-202603-031-02', 'cpo-006'],
  ['/fcs/dye-print-orders/DPO-202603-0003', 'DPO-202603-0003'],
  ['/fcs/history/retired-process-records/cpo-001', 'cpo-001'],
]) {
  appStore.navigate(path)
  const html = await resolvePage(path)
  assert(html.includes(id) && html.includes('未映射正式记录'), `${path} 应由真实路由入口解析到历史详情`)
}
console.log('PASS: schema1，6裁片+9染印原始事实逐字段保留；旧ID/单号查询、只读隔离、未知ID无操作fallback通过')
