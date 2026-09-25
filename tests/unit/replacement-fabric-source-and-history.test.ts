import test from 'node:test'
import assert from 'node:assert/strict'
import { getProductionOrderTechPackSnapshot } from '../../src/data/fcs/production-orders.ts'
import { resolveReplacementFabricMaterials } from '../../src/data/fcs/cutting/replacement-fabric-source.ts'
import { withBrowserBusinessStorage } from '../../src/data/browser-storage.ts'
import { buildRuntimeBagHandoverProjection } from '../../src/data/fcs/cutting/handover-orders.ts'

function source() {
  const pack = structuredClone(getProductionOrderTechPackSnapshot('PO-202603-0002'))!
  const a = { ...pack.bomItems[0], id: 'a', type: '面料', materialCode: 'A', materialSkuId: 'A-blue', name: '主面料', colorLabel: '蓝', applicableSkuCodes: ['sku1', 'sku2'] }
  const b = { ...a, id: 'b', materialCode: 'B', materialSkuId: 'B-blue', name: '拼接面料', applicableSkuCodes: ['sku2'] }
  const pu = { ...a, id: 'pu', materialCode: 'PU', materialSkuId: 'PU-blue', name: '针织朴' }
  pack.bomItems = [a, b, pu]
  pack.colorMaterialMappings = [{ ...pack.colorMaterialMappings[0], colorCode: 'blue', colorName: '蓝', lines: pack.bomItems.map(item => ({ ...pack.colorMaterialMappings[0].lines[0], bomItemId: item.id, materialCode: item.materialCode, materialName: item.name, applicableSkuCodes: item.applicableSkuCodes })) }]
  return pack
}
test('分配 SKU 的需料不同；多尺码共料去重，名称含朴排除', () => {
  const techPack = source()
  const one = resolveReplacementFabricMaterials({techPack, skuLines: [{skuCode:'sku1',color:'蓝'}]})
  const two = resolveReplacementFabricMaterials({techPack, skuLines: [{skuCode:'sku2',color:'蓝'}, {skuCode:'sku1',color:'蓝'}]})
  assert.deepEqual(one.materials.map(m=>m.code), ['A-blue'])
  assert.deepEqual(two.materials.map(m=>m.code), ['A-blue','B-blue'])
  assert.deepEqual(two.materials[0].skuCodes, ['sku2','sku1'])
  assert.deepEqual(two.issues, [])
})
test('完整但全是朴为空集合；缺颜色映射或空名称属于资料错误', () => {
  const pack=source(); pack.bomItems.forEach(item=>{item.name='针织朴'})
  const empty=resolveReplacementFabricMaterials({techPack:pack,skuLines:[{skuCode:'sku1',color:'蓝'}]})
  assert.equal(empty.materials.length,0);assert.equal(empty.issues.length,0)
  assert.match(resolveReplacementFabricMaterials({techPack:pack,skuLines:[{skuCode:'sku1',color:'红'}]}).issues.join(),/颜色用料映射/)
  pack.bomItems[0].name=''
  assert.match(resolveReplacementFabricMaterials({techPack:pack,skuLines:[{skuCode:'sku1',color:'蓝'}]}).issues.join(),/缺少名称/)
})
test('同名不同编码面料不混并；BOM 身份歧义阻断',()=>{
  const pack=source();pack.bomItems[1].name=pack.bomItems[0].name
  assert.equal(resolveReplacementFabricMaterials({techPack:pack,skuLines:[{skuCode:'sku2',color:'蓝'}]}).materials.length,2)
  pack.bomItems.push({...pack.bomItems[0]})
  assert.match(resolveReplacementFabricMaterials({techPack:pack,skuLines:[{skuCode:'sku2',color:'蓝'}]}).issues.join(),/无法唯一对应/)
})
test('交出回执从快照保留三种明细，Yard 与米不进入裁片数量',()=>{
  const base={feiTicketId:'cut',feiTicketNo:'CUT-1',productionOrderId:'p',productionOrderNo:'PO-1',cutOrderId:'c',cutOrderNo:'CUT-1',color:'蓝',size:'M',partCode:'front',partName:'前片',pieceQty:20,sewingTaskId:'task1',sewingTaskNo:'T1',receiverFactoryId:'f1',receiverFactoryName:'工厂1'}
  const tickets=[base,{...base,feiTicketId:'hpb',feiTicketNo:'HPB/PO-1/A/001',ticketKind:'REPLACEMENT_FABRIC',materialCode:'A',materialName:'主面料',materialImageUrl:'/materials/fei-ticket/grey-main-fabric.png',quantity:5,quantityUnit:'Yard',replacementSequence:1,pieceQty:0},{...base,feiTicketId:'binding',feiTicketNo:'BND-1',ticketKind:'BINDING_STRIP',quantity:8,quantityUnit:'米',pieceQty:0}]
  const event={eventId:'e-history-test',eventNo:'e',eventType:'新增交出记录',eventStatus:'已同步',eventSource:'PDA',occurredAt:'2026-09-25',createdAt:'2026-09-25',refs:{},payload:{handoverOrderId:'ho',handoverOrderNo:'HO',handoverRecordId:'hr',handoverRecordNo:'HR',receiverType:'车缝厂',receiverId:'f1',receiverName:'工厂1',submittedBy:'仓管',transferBagUses:[{bagUseId:'cycle',bagCode:'BAG',containedFeiTicketIds:tickets.map(t=>t.feiTicketId),totalPieceQty:20,ticketSnapshot:tickets}]}}
  const projection=withBrowserBusinessStorage({getItem:()=>JSON.stringify({events:[event]})},()=>buildRuntimeBagHandoverProjection())
  const record=projection.records.find(r=>r.handoverRecordId==='hr')!
  assert.equal(record.feiTicketItems.length,1);assert.equal(record.fabricTicketItems?.length,2)
  assert.equal(record.currentHandedOverSummary.reduce((n,t)=>n+t.pieceQty,0),20)
  assert.equal(record.fabricTicketItems?.[0].quantity,5)
  assert.equal(projection.orders.find(r=>r.handoverOrderId==='ho')?.totalReceivedPieceQty,20)
})

test('回执任务读取保持数组身份；只在事实变更后重新投影', async()=>{
  const {installCuttingReceiptTaskProjection,projectCuttingReceiptTasks}=await import('../../src/data/fcs/runtime-task-read-bridge.ts')
  const tasks=[{id:'t1',status:'NOT_STARTED'}]
  installCuttingReceiptTaskProjection(null)
  assert.equal(projectCuttingReceiptTasks(tasks),tasks)
  installCuttingReceiptTaskProjection(task=>({...task as object,status:'IN_PROGRESS'}))
  const first=projectCuttingReceiptTasks(tasks)
  assert.equal(projectCuttingReceiptTasks(tasks),first)
  assert.equal(tasks[0].status,'NOT_STARTED')
  assert.equal(first[0].status,'IN_PROGRESS')
  installCuttingReceiptTaskProjection(null)
  assert.equal(projectCuttingReceiptTasks(tasks),tasks)
})

test('款式需料读取的配置查询只返回独立副本，不能污染下次来源读取', async () => {
  const { listConfigDimensionOptions, listProductCategoryNodes } = await import('../../src/data/pcs-config-workspace-repository.ts')
  const expectedOptions = listConfigDimensionOptions('brands')
  const options = listConfigDimensionOptions('brands')
  options[0].name_zh = '验收改写'
  options[0].logs[0].detail = '验收改写'
  options.pop()
  assert.deepEqual(listConfigDimensionOptions('brands'), expectedOptions)
  const expectedCategories = listProductCategoryNodes()
  const categories = listProductCategoryNodes()
  categories[0].name = '验收改写'
  categories[0].logs[0].detail = '验收改写'
  categories.reverse()
  assert.deepEqual(listProductCategoryNodes(), expectedCategories)
})

test('来源读取失败时不能把不可用哨兵值当作稳定分配继续保存',async()=>{
  const {captureReplacementFabricSourceGuard}=await import('../../src/data/fcs/cutting/replacement-fabric-source.ts')
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage')
  try {
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){throw new DOMException('禁用','SecurityError')}}})
    assert.throws(()=>captureReplacementFabricSourceGuard(),/来源记录无法读取.*未保存/)
  } finally {
    if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor)
    else Reflect.deleteProperty(globalThis,'localStorage')
  }
})
