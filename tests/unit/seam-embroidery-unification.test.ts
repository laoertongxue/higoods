import { readFileSync } from 'node:fs'
import { pcsRecordStore, withPcsDemoData } from '../../src/data/pcs-record-runtime.ts'
import assert from 'node:assert/strict'
import test from 'node:test'
import { listEnabledSpecialCraftOperationDefinitions, canFactorySeeSpecialCraftOperation } from '../../src/data/fcs/special-craft-operations.ts'
import { listAllProcessCraftDefinitions } from '../../src/data/fcs/process-craft-dict.ts'
import { getDedicatedSpecialCraftFactoryId } from '../../src/data/fcs/special-craft-dedicated-factories.ts'
import { getSpecialCraftTaskOrders } from '../../src/data/fcs/special-craft-task-orders.ts'
import { renderPreparedSpecialCraftTaskOrdersPage } from '../../src/pages/process-factory/special-craft/task-orders.ts'
import { canonicalSeamCraftCode, normalizeSeamEmbroideryReferences } from '../../src/data/fcs/seam-embroidery-identity.ts'
import { buildCraftWarehouseAreas, resolveEnabledFactoryWarehouseLocation } from '../../src/data/fcs/factory-internal-warehouse-locations.ts'
import { decodeProductionContextRecords, encodeProductionContextRecords, PRODUCTION_CONTEXT_KEYS } from '../../src/data/fcs/production-context-records.ts'

// Page rendering consumes the published PCS view prepared by the real entry.
const publishedPcs = JSON.parse(readFileSync(new URL('../../src/data/generated/pcs-record-baseline.json', import.meta.url), 'utf8'))
withPcsDemoData(() => pcsRecordStore.setItem('higood-pcs-material-archive-store-v2', publishedPcs['higood-pcs-material-archive-store-v2']))

const seamOperationId = 'AUX-OP-SEAM-EMBROIDERY'
const retiredValues = new Set([1048576, 3000003, 3000004, 3000005])

test('边绣合并后只有一个可选工艺及加工单身份，分类入口共16类', () => {
  const operations = listEnabledSpecialCraftOperationDefinitions()
  const seam = operations.filter(item => item.operationName === '缝边绣')
  assert.equal(seam.length, 1)
  assert.equal(seam[0].operationId, seamOperationId)
  assert.equal(seam[0].craftCode, 'CRAFT_3000010')
  assert.equal(operations.length, 16)
  assert.equal(operations.filter(item => item.managementDomain === 'AUXILIARY_CRAFT_FACTORY').length, 12)
  assert.equal(operations.filter(item => item.managementDomain === 'SPECIAL_CRAFT_FACTORY').length, 4)
  assert.ok(!listAllProcessCraftDefinitions().some(item => item.isActive && retiredValues.has(item.legacyValue)))
})

test('所有辅助和特种工艺当前订单仅属于各自固定厂，列表没有工厂切换入口', () => {
  for (const operation of listEnabledSpecialCraftOperationDefinitions()) {
    const orders = getSpecialCraftTaskOrders(operation.operationId)
    assert.ok(orders.length, operation.operationName)
    assert.deepEqual(new Set(orders.map(item => item.factoryId)), new Set([getDedicatedSpecialCraftFactoryId(operation.operationId)]), operation.operationName)
    assert.equal(canFactorySeeSpecialCraftOperation(getDedicatedSpecialCraftFactoryId(operation.operationId)!, operation.operationId), true)
    assert.equal(canFactorySeeSpecialCraftOperation('ID-F090', operation.operationId), false)
    const html = renderPreparedSpecialCraftTaskOrdersPage(operation.operationId)
    assert.doesNotMatch(html, /加工厂切换|全部加工厂|factory-tab|data-factory-id=/)
  }
})

test('存量各来源只归一工艺身份，重复节点与原厂、数量、附件及稳定引用全部保留', () => {
  const sources = [...retiredValues].map((value, index) => ({
    id:`node-${index}`, sourceEntryId:`source-${index}`, taskOrderId:`order-${index}`,
    craftCode:`CRAFT_${value}`, craftName:`曾用标签${index}`, displayName:`曾用标签${index}`,
    operationId:`saved-operation-${index}`, factoryId:'historical-factory', qty:index + 10,
    files:[{fileId:`file-${index}`,name:'实拍.jpg'}], remark:`曾用标签${index}的实收记录`,
  }))
  const before = structuredClone(sources)
  assert.equal(normalizeSeamEmbroideryReferences(sources), sources)
  assert.equal(sources.length, 4)
  for (const [index, row] of sources.entries()) {
    assert.equal(row.craftCode, 'CRAFT_3000010')
    assert.equal(row.craftName, '缝边绣')
    assert.equal(row.operationId, seamOperationId)
    assert.equal(row.remark, '缝边绣的实收记录')
    for (const field of ['id','sourceEntryId','taskOrderId','factoryId','qty','files'] as const) assert.deepEqual(row[field], before[index][field])
  }
  assert.deepEqual(normalizeSeamEmbroideryReferences(structuredClone(sources)), sources)
})

test('合并后的配置冲突阻断，数值一致才能归一，其他工艺不变', () => {
  const source = { capacities: { [`CRAFT_${3000003}`]:12, [`CRAFT_${3000004}`]:14 } }
  assert.throws(() => normalizeSeamEmbroideryReferences(structuredClone(source)), /冲突值/)
  assert.equal(Object.values(source.capacities).length, 2)
  assert.deepEqual(normalizeSeamEmbroideryReferences({capacities:{[`CRAFT_${3000003}`]:12,[`CRAFT_${3000004}`]:12}}), {capacities:{CRAFT_3000010:12}})
  assert.equal(canonicalSeamCraftCode('CRAFT_000256'), 'CRAFT_000256')
})

test('配置的稳定选项引用保留，显示名和日志使用统一名称', () => {
  const source = {options:[{dimensionId:'specialCrafts',id:'specialCrafts-4',code:'4',name_zh:'曾用标签',aliases:['曾用标签'],logs:[{id:'log-1',time:'2026-04-06',detail:'完成曾用标签建档'}]}],refs:['specialCrafts-4']}
  const result = normalizeSeamEmbroideryReferences(source)
  assert.equal(result.options[0].name_zh, '缝边绣')
  assert.deepEqual(result.options[0].aliases, ['缝边绣'])
  assert.equal(result.options[0].logs[0].detail, '完成缝边绣建档')
  assert.equal(result.options[0].logs[0].time, '2026-04-06')
  assert.deepEqual(result.refs,['specialCrafts-4'])
})

test('名称归一只影响所属工艺，不能误改其他工艺和无关文字', () => {
  const value = {description:'其他说明曾用标签',nodes:[
    {craftCode:`CRAFT_${3000004}`,craftName:'曾用标签',remark:'曾用标签实收',child:{craftCode:'CRAFT_000256',craftName:'曾用标签'}},
    {craftCode:'CRAFT_000256',craftName:'曾用标签',remark:'曾用标签保留'},
  ]}
  normalizeSeamEmbroideryReferences(value)
  assert.equal(value.description,'其他说明曾用标签')
  assert.equal(value.nodes[0].remark,'缝边绣实收')
  assert.equal(value.nodes[0].child!.craftName,'曾用标签')
  assert.equal(value.nodes[1].craftName,'曾用标签')
  assert.equal(value.nodes[1].remark,'曾用标签保留')
})

test('只去掉同一纸样上的重复配置，已有独立节点的身份不折叠', () => {
  const value = {specialCrafts:[{craftCode:`CRAFT_${3000003}`,craftName:'曾用标签甲'},{craftCode:`CRAFT_${3000004}`,craftName:'曾用标签乙'}],routeNodes:[{id:'node-1',craftCode:`CRAFT_${3000003}`,craftName:'曾用标签甲'},{id:'node-2',craftCode:`CRAFT_${3000004}`,craftName:'曾用标签乙'}]}
  normalizeSeamEmbroideryReferences(value)
  assert.equal(value.specialCrafts.length,1)
  assert.equal(value.routeNodes.length,2)
  assert.deepEqual(value.routeNodes.map(row=>row.id),['node-1','node-2'])
})

test('库区归一保留全部原货架与库位，历史位置不会因工艺合并而失效', () => {
  const areas = buildCraftWarehouseAreas().filter(area => area.areaName.startsWith('缝边绣'))
  assert.equal(areas.length,1)
  assert.equal(areas[0].shelfList.length,3)
  for (const no of ['08','09','10']) {
    const location = resolveEnabledFactoryWarehouseLocation('FIW-FAC-APF-WAIT_PROCESS',`LOC-AUX-WP-${no}-01-01`)
    assert.ok(location)
    assert.equal(location.area.areaId,'AUX-WP-AREA-08')
    const saved = normalizeSeamEmbroideryReferences({areaId:`AUX-WP-AREA-${no}`,areaName:'曾用库区',locationId:location.location.locationId,qty:12})
    assert.equal(saved.areaId,'AUX-WP-AREA-08')
    assert.equal(saved.areaName,'缝边绣-裁片库区')
    assert.equal(saved.locationId,location.location.locationId)
    assert.equal(saved.qty,12)
  }
})

test('早期普通工序引用和设备关联名称一起归一，不留下旧父工序组合', () => {
  const result=normalizeSeamEmbroideryReferences({craftCode:`CRAFT_${1048576}`,craftName:'曾用标签',legacyCraftName:'曾用标签',processCode:'EMBROIDERY',processName:'绣花',systemProcessCode:'saved-process',machine:{linkedCraftCode:`CRAFT_${3000004}`,linkedCraftName:'曾用设备标签',machineId:'machine-1'}})
  assert.equal(result.processCode,'SPECIAL_CRAFT')
  assert.equal(result.processName,'特殊工艺')
  assert.equal(result.systemProcessCode,'PROC_SPECIAL_CRAFT')
  assert.equal(result.legacyCraftName,'缝边绣')
  assert.equal(result.machine.linkedCraftCode,'CRAFT_3000010')
  assert.equal(result.machine.linkedCraftName,'缝边绣')
  assert.equal(result.machine.machineId,'machine-1')
})

test('生产快照的旧引用按现有记录库边界回读，来源单据和文件身份保持', () => {
  const legacy = {version:1,orders:[{productionOrderId:'PO-SAVED-1',techPackSnapshot:{routeNodes:[{id:'entry-stable-1',craftCode:`CRAFT_${3000004}`,craftName:'曾用标签',qty:120,files:[{fileId:'file-stable-1'}]}]}}]}
  const original = JSON.stringify(legacy)
  const rows = decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.orders, original)
  const roundtrip = JSON.parse(encodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.orders, rows)!)
  assert.equal(roundtrip.orders.length,1)
  assert.equal(roundtrip.orders[0].productionOrderId,'PO-SAVED-1')
  const node=roundtrip.orders[0].techPackSnapshot.routeNodes[0]
  assert.deepEqual(node,{id:'entry-stable-1',craftCode:'CRAFT_3000010',craftName:'缝边绣',qty:120,files:[{fileId:'file-stable-1'}]})
  assert.equal(JSON.stringify(legacy),original)
  assert.deepEqual(decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.orders, JSON.stringify(roundtrip)),rows)
})

test('空白工艺显示名不能作为替换标签，设备工厂备注和稳定事实保持原样', () => {
  for (const emptyName of ['', ' ', String.fromCharCode(9, 10)]) {
    for (const prefix of ['linked', 'source', 'target']) {
      const value = { machineId:'stable-machine', machineName:'原设备', factoryName:'原工厂', remark:'实收记录保留', qty:5, [prefix+'CraftCode']:`CRAFT_${3000004}`, [prefix+'CraftName']:emptyName }
      normalizeSeamEmbroideryReferences(value)
      assert.equal(value[prefix+'CraftCode'], 'CRAFT_3000010')
      assert.equal(value[prefix+'CraftName'], '缝边绣')
      assert.deepEqual({machineId:value.machineId,machineName:value.machineName,factoryName:value.factoryName,remark:value.remark,qty:value.qty}, {machineId:'stable-machine',machineName:'原设备',factoryName:'原工厂',remark:'实收记录保留',qty:5})
    }
    const codes = { craftCodes:[`CRAFT_${3000004}`], craftNames:[emptyName], machineName:'原设备', factoryName:'原工厂', remark:'实收记录 保留', qty:5 }
    normalizeSeamEmbroideryReferences(codes)
    assert.deepEqual(codes.craftCodes, ['CRAFT_3000010'])
    assert.deepEqual(codes.craftNames, ['缝边绣'])
    assert.equal(codes.machineName, '原设备')
    assert.equal(codes.factoryName, '原工厂')
    assert.equal(codes.remark, '实收记录 保留')
    assert.equal(codes.qty, 5)
  }
})
