import assert from 'node:assert/strict'
import test from 'node:test'
import { getTimingCaseByScene, getTimingBranch, getTimingFacts, listTimingCases } from '../../src/data/production-timing/source'
import { setTimingDiagramScene, renderTimingDiagramBody, renderTimingDocumentSummary, renderTimingNodeDetail } from '../../src/pages/production-fulfillment/production-order-diagrams'

const plain = (html:string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
const diagram = (scene:string) => { setTimingDiagramScene(scene); return renderTimingDiagramBody() }

test('finished preparation and purchase keep their delay without claiming current work is on time', () => {
 const html=diagram('late'), cards=html.match(/<div class="stage-risk-overview">([\s\S]*?)<\/div><div class="branch-nav">/)![1]
 assert.match(cards, /已完成 · 晚1天/)
 assert.match(cards, /采购批已入仓/)
 assert.match(cards, /晚2天/)
 assert.match(cards, /道未完成 · 已超时/)
 assert.doesNotMatch(cards, /已知时效项无当前逾期|项当前逾期|项逾期完成/)
 assert.match(plain(html), /要求4天.*晚1天.*已完成/)
})

test('absence of applicable records and missing timing inputs are not healthy or not-yet-due', () => {
 const c=getTimingCaseByScene('positioning'), b=getTimingBranch(c)!
 assert.match(diagram('positioning'), /未取得物料执行单据.*无法判定采购时效/)
 const master=b.docs[b.master], start=master.clock!.start
 try {
  master.clock!.start=null
  const html=diagram('positioning')
  assert.match(html, /准备起止资料不全 · 时效无法判定/)
  assert.doesNotMatch(html, /已知时效项无当前逾期|NaN|Invalid Date/)
 } finally { master.clock!.start=start }
})

test('inbound quantity and final time completeness produce distinct business results', () => {
 assert.equal(getTimingFacts(getTimingCaseByScene('complete')).result, '已全部入库 · 按期')
 assert.equal(getTimingFacts(getTimingCaseByScene('completeLate')).result, '已全部入库 · 晚1天6小时')
 assert.equal(getTimingFacts(getTimingCaseByScene('completeUnknown')).result, '已全部入库 · 是否按期待核实')
 assert.equal(getTimingFacts(getTimingCaseByScene('unknown')).result, '入库数量待核实，完成结果无法判定')
})

test('reached late milestone has zero only for that milestone, not the whole task', () => {
 const html=diagram('reachedLate')
 assert.match(html, /已达标 · 晚/)
 assert.match(html, /该节点差额0件/)
 assert.doesNotMatch(html, /当前欠0件/)
 const c=getTimingCaseByScene('reachedLate'), t=c.tasks.find((t:any)=>t.factory==='B厂')!
 const detail=renderTimingNodeDetail('task:'+t.id)
 assert.match(detail, /本任务尚未回/)
 assert.match(detail, /未到期.*后续累计目标|后续累计目标/)
})

test('creation and handover clocks explain their different unfinished endpoints', () => {
 const c=getTimingCaseByScene('prepPending'), b=getTimingBranch(c)!
 setTimingDiagramScene(c.key)
 const working=Object.values(b.docs).find(d=>d.clock?.kind==='制作')!
 assert.ok(working)
 const end=working.clock!.end, status=working.status, handover=working.handoverClock
 try {
  working.clock!.end=null; working.status='制作中'; working.handoverClock=undefined
  const html=renderTimingNodeDetail('prep')
  assert.match(html, /完成时间待取得/)
  assert.doesNotMatch(html, /制作<\/b>[^<]*→ 接收待取得/)
 } finally {working.clock!.end=end; working.status=status; working.handoverClock=handover}
 diagram('handoverPartial')
 const late=renderTimingNodeDetail('release')
 assert.match(late, /未确认时效要求，无法判定是否超时/)
 assert.match(late, /差异待确认/)
})

test('all current scenes avoid ambiguous headline defaults and literal unknown numbers', () => {
 for(const c of listTimingCases()) {
  const html=diagram(c.key)
  assert.doesNotMatch(html, /已知时效项无当前逾期|整单按期把握待核实|实际关闭|当前欠0件|\bNaN\b|\bundefined\b|null件/, c.key)
 }
})


test('contract graph with missing allocation date or actual holdings cannot assert not-yet-due or achieved', () => {
 const c=getTimingCaseByScene('reachedLate'), t=c.tasks[0], original={assigned:t.assigned, held:t.held}
 try {
  t.assigned=null
  assert.match(diagram(c.key), /业务分配日期未取得 · 合同节点无法判定/)
  assert.doesNotMatch(renderTimingNodeDetail('task:'+t.id), /<td>已达标|<td>未到期|后续累计目标/)
  t.assigned=original.assigned; t.held=null
  assert.match(diagram(c.key), /工厂实领量未取得 · 合同节点无法判定/)
 } finally {Object.assign(t,original)}
})
