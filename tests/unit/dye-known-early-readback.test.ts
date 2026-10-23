import assert from 'node:assert/strict'
import test from 'node:test'

test('C03.40 cached early dye orders reread saved processing without relaxing source identity', async () => {
  const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map<string, string>()
  const storage: Storage = {
    get length() { return values.size }, clear() { values.clear() },
    getItem(key) { return values.get(key) ?? null }, key(index) { return [...values.keys()][index] ?? null },
    removeItem(key) { values.delete(key) }, setItem(key, value) { values.set(key, value) },
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  const dye = await import('../../src/data/fcs/dyeing-task-domain.ts')
  const receiving = await import('../../src/data/fcs/factory-receiving.ts')
  const caches = await import('../../src/data/fcs/design-revision-pcs-storage.ts')
  const { getDyeingQuantityFacts } = await import('../../src/data/fcs/dyeing-quantity-facts.ts')
  const { readFactoryPdaExecutionUsers } = await import('../../src/data/fcs/store-domain-pda.ts')
  await (await import('../../src/data/fcs/cutting/part-ticket-records.ts')).hydratePartTicketRecords({ revision: 0, records: [] })
  await (await import('../../src/data/fcs/production-context-records.ts')).hydrateProductionContextRecords({ revision: 0, records: [] })
  dye.listDyeWorkOrders()
  const baseline = dye.captureDyeProductionCreationState(), receivingBefore = receiving.captureFactoryReceivingData()
  try {
    const id = 'EARLY-DYE-READBACK', factoryId = 'ID-F003', at = '2026-10-21 08:00:00'
    const actor = readFactoryPdaExecutionUsers(factoryId).find(user => user.roleId === 'ROLE_ADMIN')!
    // The original registration and receipt APIs build the known early order.
    // This in-memory legacy facade tests restoration; browser contracts cover native transactions.
    dye.runDyeProcessMutation(() => dye.registerFormalProductionOrderDyeWorkOrder({
      workOrderId: id, workOrderNo: id, sourceKey: id, processName: '染色', orderedAt: at,
      sourceSnapshot: {
        sourceType: 'PRODUCTION_DEMAND', productionDemandId: 'EARLY-DEMAND', productionDemandNo: 'EARLY-DEMAND',
        professionalTaskId: 'EARLY-PT', professionalTaskNo: 'EARLY-PT', professionalResultId: 'EARLY-RESULT', professionalResultVersion: 'V1',
        inputMaterialSkuCode: 'TMF-WHITE', outputMaterialSkuCode: 'TMF-BLUE', bomItemId: 'BOM-WB',
      },
      factoryId, factoryName: 'PT Cahaya Dyeing Sejahtera',
      materialId: 'TMF-WHITE', materialName: '白色织带',
      materialItems: [{ sourceBomItemId: 'BOM-WB', materialId: 'TMF-WHITE', materialName: '白色织带', materialType: '辅料' }],
      inputMaterialSkuCode: 'TMF-WHITE', inputMaterialName: '白色织带', inputMaterialImageUrl: '/materials/tmf/webbing-real-roll.jpg',
      outputMaterialSkuCode: 'TMF-BLUE', outputMaterialName: '蓝色织带', outputMaterialImageUrl: '/materials/tmf/webbing-dyed-blue.jpg',
      targetColor: '蓝', plannedQty: 20, qtyUnit: '米', processCodes: ['DYE'], spuCode: 'SPU-2024-005', spuName: '测试来源', requiredDeliveryDate: '2026-11-01',
    }))
    dye.acceptDyeWorkOrderPdaTask(id, actor.name, at)
    receiving.registerFactoryReceivingSource({
      id: 'EARLY-ISSUE', documentNo: 'EARLY-ISSUE', type: 'ISSUE',
      origin: { kind: 'WAREHOUSE', id: 'WH-FITTING-001', name: '辅料中央仓', warehouseAttribute: '辅料中央仓' },
      targetFactoryId: factoryId, targetFactoryName: 'PT Cahaya Dyeing Sejahtera', createdAt: at, createdBy: '原仓管',
      lines: [{ id: 'EARLY-ISSUE-L1', measurementBasis: 'CONTINUOUS_LENGTH',
        material: { sku: 'TMF-WHITE', name: '白色织带', kind: 'ACCESSORY', imageUrl: '/materials/tmf/webbing-real-roll.jpg', color: '白', composition: '涤纶', specification: '30mm', batchNo: 'EARLY-B01' },
        plannedQty: 20, sentQty: 20, unit: '米', rolls: [], label: 'EARLY-B01', dyeOrderId: id }],
    })
    receiving.approveFactoryTransfer('EARLY-ISSUE', '原审核人', at)
    receiving.savePreparedFactoryReceipt(receiving.prepareFactoryReceipt({
      id: 'EARLY-RECEIPT', factoryId, operatorId: actor.userId, operatorName: actor.name, receivedAt: at, remark: '',
      lines: [{ sourceId: 'EARLY-ISSUE', sourceLineId: 'EARLY-ISSUE-L1', ...receiving.getDefaultFactoryReceiptPosition(factoryId), businessQty: 20, businessUnit: '米' }],
    }))
    const vat = dye.listDyeVatOptions(factoryId)[0].dyeVatNo
    dye.planDyeVat(id, { dyeVatNo: vat, operatorName: actor.name })
    const beforeStart = dye.captureDyeProductionCreationState()
    dye.executeDyePdaProcessing({ dyeOrderId: id, expectedStatus: 'WAIT_VAT_PLAN', expectedBatch: 0, nodeCode: 'DYE', phase: 'START', qty: 5, dyeVatNo: vat,
      actor: { userId: actor.userId, name: actor.name, factoryId } })
    const saved = storage.getItem('higoods.formal-dye-execution.v1')!
    assert.ok(saved.includes('DYEING'))
    dye.restoreDyeProductionCreationState(beforeStart)
    assert.equal(dye.getDyeWorkOrderById(id)!.status, 'WAIT_VAT_PLAN')
    caches.hydrateDesignRevisionFcsCaches(['dye'])
    assert.equal(dye.getDyeWorkOrderById(id)!.status, 'DYEING')
    const node = dye.getDyeExecutionNodeRecord(id, 'DYE')!
    assert.equal(node.inputQty, 5)
    assert.equal(node.startedByUserId, actor.userId)
    const fact = getDyeingQuantityFacts().find(row => row.order.dyeOrderId === id)!
    assert.equal(fact.used, 5)
    assert.equal(fact.availableInput, 15)
    assert.equal(storage.getItem('higoods.formal-dye-execution.v1'), saved, 'rereading never saves over the original dye records')

    const invalid = JSON.parse(saved)
    invalid.state.workOrders.find(([key]: [string]) => key === id)[1].sourceKey = 'ANOTHER-SOURCE'
    const invalidRaw = JSON.stringify(invalid)
    storage.setItem('higoods.formal-dye-execution.v1', invalidRaw)
    dye.restoreDyeProductionCreationState(beforeStart)
    caches.hydrateDesignRevisionFcsCaches(['dye'])
    assert.throws(() => dye.readDyeWorkOrdersWithoutInitialization(), /校验 1/)
    assert.equal(storage.getItem('higoods.formal-dye-execution.v1'), invalidRaw, 'a mismatched source stays untouched')
  } finally {
    dye.restoreDyeProductionCreationState(baseline)
    receiving.restoreFactoryReceivingData(receivingBefore)
    if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
