import { test } from 'node:test'
import assert from 'node:assert/strict'
import { replacementFabricTicketLabel, replacementFabricMaterialDisplayCode, replacementTicketCode, parseReplacementTicketCode } from '../../src/data/fcs/cutting/replacement-fabric-fei-tickets.ts'
import { renderReplacementFabricPrintTicketChoice } from '../../src/pages/print/replacement-fabric-preview.ts'
import { renderReplacementFabricLabel } from '../../src/pages/print/templates/replacement-fabric-label-template.ts'
import { renderDispatchTaskSheetTemplate } from '../../src/pages/print/templates/dispatch-task-sheet-template.ts'
test('换片票文案不显示内部路径，扫码身份和原票号保持', () => {
  const ticket: any = {id:'HPB-original:001',ticketNo:'HPB/PO-DEMO-SIMPLE-0916/tdv_demand-bom-main/%E9%9B%BE/001',sequence:1,productionOrderNo:'PO-DEMO-SIMPLE-0916',material:{code:'tdv_demand-bom-main',name:'主面料',color:'雾霾灰',imageUrl:'/materials/fabric-main.jpg'}}
  const original = structuredClone(ticket)
  assert.equal(replacementFabricTicketLabel(ticket), '换片布票 001')
  for (const sequence of [NaN, 0, -1, 1.5]) assert.equal(replacementFabricTicketLabel({sequence}), '换片布票', '旧混袋缺票序时不显示 NaN 或伪造编号')
  assert.ok(!renderReplacementFabricLabel(ticket).includes('<b>HPB</b>'), '中文票种已识别，无须重复内部缩写')
  assert.equal(replacementFabricMaterialDisplayCode('FAB-0001'), 'FAB-0001')
  assert.equal(replacementFabricMaterialDisplayCode(ticket.material.code), '')
  const html = renderReplacementFabricLabel(ticket)
  assert.ok(html.includes('换片布票 001'))
  assert.ok(!html.includes(ticket.ticketNo)); assert.ok(!html.includes(ticket.material.code))
  assert.equal(parseReplacementTicketCode(replacementTicketCode(ticket)), ticket.id)
  assert.deepEqual(ticket, original)
})

test('打印结果选票行使用业务名称区分生产单、面料和颜色，保留原勾选身份', () => {
  const ticket: any = {id:'HPB-original:001',ticketNo:'HPB/PO-DEMO/tdv_demand-bom-main/%E9%9B%BE/001',sequence:1,productionOrderNo:'PO-DEMO',material:{name:'主面料',color:'雾霾灰'}}
  const original = structuredClone(ticket)
  const html = renderReplacementFabricPrintTicketChoice(ticket, false)
  const text = html.replace(/<[^>]+>/g, ' ')
  assert.ok(text.includes('换片布票 001 · PO-DEMO · 主面料 · 雾霾灰 · 首次打印'))
  assert.ok(!text.includes(ticket.ticketNo) && !text.includes('tdv_demand') && !text.includes('%E9'))
  assert.ok(html.includes('data-hpb-print-success="HPB-original:001"'))
  assert.ok(renderReplacementFabricPrintTicketChoice(ticket, true).includes('· 补打'))
  assert.deepEqual(ticket, original)
})

test('任务单使用可识别的物料编码，内部技术资料键不进入文字、图片标题和无障碍名称', () => {
  const document: any = {headerFields:[{label:'PPIC',value:'王敏'}],tables:[],qrCodes:[{value:'HIG:TASK:RW-001',title:'任务二维码',description:'扫码核对裁片'}],printMeta:{generatedAt:'2026-10-09'},taskSheet:{quantityUnit:'件',data:{taskSheetNo:'RW-001',productionOrderNo:'PO-001',taskNo:'CF-001',styleCode:'SPU-001',styleName:'卫衣',taskTypeLabel:'独立车缝',taskContent:'车缝',pickupObject:'裁片',pickupLocation:'裁床仓',assignment:{skuLines:[],factoryName:'车缝厂'}},technical:{materials:[{id:'tdv_demand_internal_bom',materialSkuId:'tdv_demand_internal_sku',materialCode:'FAB-001',name:'主面料',type:'面料',unit:'米',unitConsumption:1,materialImageUrl:'/materials/fabric-main.jpg'},{id:'tdv_hidden_without_code',name:'拉链',type:'辅料',unit:'个',unitConsumption:1}],parts:[],patterns:[],processes:[],measurements:[]}}}
  const original = structuredClone(document)
  const html = renderDispatchTaskSheetTemplate(document)
  assert.ok(html.includes('主面料') && html.includes('FAB-001') && html.includes('拉链'))
  assert.ok(!html.includes('tdv_'), '所有可见和辅助识别文案都不能泄漏内部键')
  assert.ok(html.includes('HIG:TASK:RW-001'), '文案精简不改变原二维码身份')
  assert.deepEqual(document, original)
})
