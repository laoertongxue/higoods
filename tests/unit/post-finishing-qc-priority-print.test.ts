import assert from 'node:assert/strict'
import test from 'node:test'
import { renderPostFinishingQcPriorityBlock } from '../../src/pages/print/templates/post-finishing-qc-priority-block.ts'
import type { QcShippingPriorityDocument } from '../../src/data/fcs/post-finishing-qc-shipping-priority-runtime.ts'
import {
  renderOnlinePostFinishingQcMaster, renderOnlinePostFinishingQcDetail, handleQcShippingPriorityPrint,
} from '../../src/pages/print/templates/post-finishing-qc-print-template.ts'
import { listPostFinishingFullFlowQcTasks } from '../../src/data/fcs/post-finishing-full-flow.ts'

const fixture = (patch: Partial<QcShippingPriorityDocument> = {}): QcShippingPriorityDocument => ({
  ready: true, issues: [], asOf: '2026-10-21T02:00:00.000Z', ruleVersion: 2, stars: 2,
  label: '今日需发', todayTotal: 60, tomorrowTotal: 20, overdueTotal: 10,
  rows: [
    { sku: 'SKU-BLACK-M', warehouseName: 'A&C WH', overdue: 10, today: 60, tomorrow: 20, todayOverdue: 15 },
  ],
  ...patch,
})

test('非待质检没有 DTO 时不增加实时紧急区', () => {
  assert.equal(renderPostFinishingQcPriorityBlock(), '')
})

test('主明细共享的紧急区保留 SKU 与仓库、日期子集及未分配说明', () => {
  const html = renderPostFinishingQcPriorityBlock(fixture())
  assert.match(html, /★★ 今日需发/)
  assert.match(html, /历史超期 10 · 今日需发 60 · 明日需发 20/)
  assert.match(html, /SKU-BLACK-M/)
  assert.match(html, /A&amp;C WH/)
  assert.match(html, /其中今日已超时/)
  assert.match(html, /<td>10<\/td><td>60<\/td><td>15<\/td><td>20<\/td>/)
  assert.match(html, /未分配到本批/)
  assert.match(html, /相同参考数量不可相加/)
  assert.match(html, /已包含在今日需发数量中/)
  assert.match(html, /09:00:00/)
  assert.match(html, /Asia\/Jakarta/)
  assert.match(html, /规则 V2/)
})

test('来源不完整不能打印正常零缺口，说明具体需核对原因且保持转义', () => {
  const html = renderPostFinishingQcPriorityBlock(fixture({
    ready: false, stars: 0, label: '正常', todayTotal: 0, tomorrowTotal: 0, overdueTotal: 0,
    issues: ['SKU<X> 的供货去向待核对'],
  }))
  assert.match(html, /需求需核对/)
  assert.match(html, /SKU&lt;X&gt; 的供货去向待核对/)
  assert.doesNotMatch(html, /今日需发 0/)
  assert.doesNotMatch(html, /发货紧急参考：正常/)
  assert.doesNotMatch(html, /按 SKU 与履约仓的待发需求参考/)
})

test('同 SKU 两个仓的缺口分别展示，不在模板中重新抵扣或合并', () => {
  const model = fixture({ rows: [
    { sku: 'SAME-SKU', warehouseName: 'A&C WH', overdue: 0, today: 15, tomorrow: 0, todayOverdue: 0 },
    { sku: 'SAME-SKU', warehouseName: 'F&M WH', overdue: 0, today: 5, tomorrow: 20, todayOverdue: 0 },
  ], todayTotal: 20 })
  const html = renderPostFinishingQcPriorityBlock(model)
  assert.equal(html.match(/<td>SAME-SKU<\/td>/g)?.length, 2)
  assert.match(html, /A&amp;C WH/)
  assert.match(html, /F&amp;M WH/)
  assert.match(html, /今日需发 20/)
  assert.deepEqual(model.rows.map(row => row.today), [15, 5])
})

test('标签和 SKU 均按文本打印，正常结果不产生星星', () => {
  const html = renderPostFinishingQcPriorityBlock(fixture({ stars: 0, label: '<正常>', rows: [], todayTotal: 0, tomorrowTotal: 0, overdueTotal: 0 }))
  assert.match(html, /&lt;正常&gt;/)
  assert.doesNotMatch(html, /★/)
  assert.match(html, /近两日无待补需求/)
})

test('两套 QC 纸单的打印按钮带真实来源和刷新动作，不直接打印旧预览', () => {
  const detail = renderOnlinePostFinishingQcDetail({ priority: fixture(), documentNo: 'QC-123', spuCode: 'SPU-123', printedAt: '2026-10-21 09:00', productionOrderNo: 'PO-123', factoryName: '后道一厂', buyerName: '买手', productionOrderType: '常规', saleType: '现货', skuLines: [] })
  const master = renderOnlinePostFinishingQcMaster({ priority: fixture(), prioritySource: { type: 'PRODUCTION', id: 'PO-123' }, documentNo: 'PF-123', spuCode: 'SPU-123', styleGrade: 'A', productionOrderNo: 'PO-123', factoryName: '后道一厂', buyerName: '买手', productionOrderType: '常规', saleType: '现货', materials: [], sizeHeaders: [], sizeRows: [], productImageUrl: '', tagPrice: 0 })
  for (const html of [detail, master]) {
    assert.match(html, /data-qc-shipping-print /)
    assert.match(html, /data-qc-shipping-priority-slot/)
    assert.match(html, /刷新需求并打印/)
    assert.match(html, /浏览器直接打印使用当前预览的统计时点/)
    assert.doesNotMatch(html, /onclick="window.print\(\)"/)
  }
  assert.match(detail, /data-qc-shipping-source-type="QC" data-qc-shipping-source-id="QC-123"/)
  assert.match(master, /data-qc-shipping-source-type="PRODUCTION" data-qc-shipping-source-id="PO-123"/)
})

test('刷新打印先等待当前资料，再局部发布全部紧急区，最后才打印', async () => {
  const qc = listPostFinishingFullFlowQcTasks().find(row => row.status === '待质检')
  assert.ok(qc, '应有待质检的实际来源样本')
  const events: string[] = []
  const htmlBySlot = ['', '']
  const slots = htmlBySlot.map((_, index) => ({
    dataset: { qcShippingSourceType: 'QC', qcShippingSourceId: qc.qcTaskId },
    set innerHTML(html: string) { htmlBySlot[index] = html; events.push(`publish-${index}`) },
  }))
  const status = { textContent: '' }
  const button = {
    disabled: false, textContent: '刷新需求并打印',
    parentElement: { querySelector: () => status },
    ownerDocument: { querySelectorAll: () => slots, defaultView: { print: () => { events.push('print'); assert.ok(htmlBySlot.every(html => html.includes('post-finishing-qc-shipping-priority'))) } } },
    closest: (selector:string) => selector==='[data-qc-shipping-print]'?button:root,
  }
  const feedback={textContent:''},root={dataset:{} as Record<string,string>,isConnected:true,querySelector:(selector:string)=>selector==='[data-print-ready-feedback]'?feedback:null,querySelectorAll:(selector:string)=>selector==='[data-real-barcode]'?[{querySelector:()=>({})}]:selector.includes('verified-print')?[button]:[]}
  const globals=['window','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]as const)
  Object.defineProperty(globalThis,'document',{configurable:true,value:{fonts:{ready:Promise.resolve()}}})
  Object.defineProperty(globalThis,'window',{configurable:true,value:button.ownerDocument.defaultView})
  try {
  const operation = handleQcShippingPriorityPrint(button as unknown as HTMLElement)
  assert.equal(button.disabled, true)
  assert.deepEqual(events, [], '读取完成前不能更新纸面或开始打印')
  assert.equal(await operation, true)
  assert.deepEqual(events, ['publish-0', 'publish-1', 'print'])
  assert.equal(htmlBySlot[0], htmlBySlot[1], '同一来源主明细必须共用同一 DTO 和统计时间')
  assert.equal(button.disabled, false)
  assert.equal(button.textContent, '刷新需求并打印')
  }finally{for(const[key,descriptor]of globals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key)}
})
