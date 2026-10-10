import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveManualFeiTicketSourceRows } from '../../src/data/fcs/cutting/manual-fei-tickets.ts'
const row = (overrides: Record<string, unknown> = {}): any => ({
  id: 'MARKER::M::front', sourceProductionOrderId: 'PO-202603-0004',
  colorCode: 'Black', sizeCode: 'M', skuCode: 'SKU-010-S-BLK',
  materialSku: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill',
  partCode: '前片', partNameCn: '前片', piecePerGarment: 1, ...overrides,
})
test('实际唛架重复相同来源只建一次，票身份按该单颜色尺码和技术包部位定位', () => {
  const input = row(); const output = resolveManualFeiTicketSourceRows([input, structuredClone(input)])
  assert.equal(output.length, 1)
  assert.equal(output[0].skuCode, 'SKU-010-M-BLK')
  assert.equal(output[0].partCode, 'tdv_demand_SPU_2024_010-pattern-main-front')
  assert.equal(input.skuCode, 'SKU-010-S-BLK', '原唛架汇总不被修改')
  assert.equal(output[0].id, input.id, '原来源关联保持')
})
test('重复ID不同内容不得覆盖；不同部位实例和尺寸不得合并', () => {
  assert.throws(() => resolveManualFeiTicketSourceRows([row(), row({piecePerGarment: 2})]), /同一裁片明细/)
  const output = resolveManualFeiTicketSourceRows([row(), row({id: 'MARKER::XL::front', sizeCode: 'XL'}), row({id: 'MARKER::M::sleeve', partCode: '袖片', partNameCn: '袖片', piecePerGarment: 2})])
  assert.equal(output.length, 3)
  assert.equal(output[1].skuCode, 'SKU-010-XL-BLK')
  assert.equal(output[2].piecePerGarment, 2)
})
test('跨单、错颜色、错物料、错部位和错误每件片数均阻断', () => {
  for (const overrides of [{sourceProductionOrderId: 'OTHER'}, {colorCode:'White'}, {materialSku: 'OTHER'}, {partCode:'另一前片'}, {piecePerGarment:2}]) {
    assert.throws(() => resolveManualFeiTicketSourceRows([row(overrides)]))
  }
})

test('真实手动无铺布层序票可读且免层序编号，普通缺区间和伪手动来源仍阻断', async () => {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage')
  const source:any={feiTicketId:'REAL-MANUAL',feiTicketNo:'TM-REAL-001',sourceBasisType:'MANUAL_MARKER_PLAN',pieceSequenceRange:null,partName:'前片',issuedAt:'2026-10-09'}
  const writes:string[]=[]
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>key==='cuttingManualFeiTicketSources'?JSON.stringify({records:[source],operationLogs:[]}):null,setItem:(key:string)=>writes.push(key)}})
  try {
    const numbering=await import('../../src/data/fcs/cutting/fei-ticket-numbering.ts')
    const scan=numbering.resolveFeiTicketNumberingScan(source.feiTicketNo)
    assert.equal(scan.ticket?.feiTicketId,source.feiTicketId);assert.equal(scan.status,'免打编号');assert.equal(scan.record,null)
    assert.equal(numbering.validateFeiTicketNumberingBeforeBagging({feiTicketId:source.feiTicketId,feiTicketNo:source.feiTicketNo}).ok,true)
    assert.equal(numbering.completeFeiTicketNumbering({feiTicketNoOrId:source.feiTicketNo,operatorName:'仓管'}).record,null)
    for (const fake of [{...source,feiTicketNo:'OTHER'},{...source,feiTicketId:'FORGED',feiTicketNo:'TM-FORGED'}]) assert.equal(numbering.getFeiTicketNumberingStatus(fake),'缺少编号区间')
    assert.equal(numbering.validateFeiTicketNumberingBeforeBagging({feiTicketId:'ACTUAL-NO-RANGE',feiTicketNo:'FT-NO-RANGE',partName:'前片'}).ok,false)
    assert.deepEqual(writes,[],'免层序编号不保存虚假完成记录')
  } finally {
    if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as any).localStorage
  }
})

test('主料唛架只展开其明确部位，拼接料和口袋布各自保留，不猜未知映射', async () => {
  const {isMarkerPartInSourceMaterial}=await import('../../src/pages/process-factory/cutting/marker-plan-model.ts')
  const po='PO-202603-0002',prefix='tdv_demand_SPU_2024_005-bom-'
  for(const name of ['前片','后片','袖片'])assert.equal(isMarkerPartInSourceMaterial(po,name,prefix+'main'),true)
  assert.equal(isMarkerPartInSourceMaterial(po,'拼接片',prefix+'main'),false)
  assert.equal(isMarkerPartInSourceMaterial(po,'口袋布',prefix+'main'),false)
  assert.equal(isMarkerPartInSourceMaterial(po,'拼接片',prefix+'splice'),true)
  assert.equal(isMarkerPartInSourceMaterial(po,'口袋布',prefix+'pocket'),true)
  assert.equal(isMarkerPartInSourceMaterial(po,'未核对部位',prefix+'main'),true,'未知保留待核对，由建票严格校验阻断')
})
