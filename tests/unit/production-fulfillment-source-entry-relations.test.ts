import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'

test('execution source relations retain full facts without unrelated cold initialization', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } })
  try {
    const runtime = await import('../../src/data/fcs/runtime-process-tasks.ts')
    const links = await import('../../src/data/fcs/process-order-task-links.ts')
    const print = await import('../../src/data/fcs/printing-task-domain.ts')
    const dye = await import('../../src/data/fcs/dyeing-task-domain.ts')
    const { productionOrders } = await import('../../src/data/fcs/production-orders.ts')
    const { processTasks } = await import('../../src/data/fcs/process-tasks.ts')
    const targetId = 'TASKGEN-202603-0002-001__ORDER'
    const task = runtime.getRuntimeTaskById(targetId)!
    assert.ok(task && processTasks.some(source => source.taskId === task.baseTaskId))
    let coldView: ReturnType<typeof links.getProcessOrderTaskRelationView>

    await t.test('cold read resolves real runtime scope and leaves print/dye execution ledgers untouched', () => {
      const beforePrint = print.capturePrintProcessMutationState()
      const beforeDye = dye.captureDyeProcessMutationState()
      assert.equal(beforePrint.workOrders.length, 0)
      assert.equal(beforeDye.workOrders.length, 0)
      coldView = links.getProcessOrderTaskRelationView(targetId)
      assert.ok(coldView)
      assert.equal(coldView.current.documentId, targetId)
      assert.equal(coldView.current.productionOrderId, task.productionOrderId)
      assert.equal(coldView.current.quantityLabel, `${task.scopeQty} ${task.qtyDisplayUnit || task.qtyUnit}`)
      assert.ok(coldView.successors.some(document => document.processCode === 'SEW'))
      assert.ok(coldView.successors.some(document => document.processCode === 'BINDING_STRIP'))
      assert.deepEqual(print.capturePrintProcessMutationState(), beforePrint)
      assert.deepEqual(dye.captureDyeProcessMutationState(), beforeDye)
      assert.ok(!storage.has('higoods.formal-print-execution.v1'))
      assert.ok(!storage.has('higoods.formal-dye-execution.v1'))
    })

    const fullExpected = (id: string, current: NonNullable<typeof coldView>['current']) => {
      const instance = runtime.getRuntimeTaskById(id)!
      const ids = runtime.listRuntimeProcessTasks().filter(row => row.baseTaskId === instance.baseTaskId).map(row => row.taskId)
      const documents = links.listProcessOrderTaskDocuments()
        .filter(document => document.documentId !== instance.baseTaskId)
        .map(document => ({
          ...document,
          predecessorDocumentIds: document.predecessorDocumentIds?.flatMap(key => key === instance.baseTaskId ? ids : [key]),
          successorDocumentIds: document.successorDocumentIds?.flatMap(key => key === instance.baseTaskId ? ids : [key]),
        }))
      return links.buildProcessOrderTaskRelationViewFromDocuments(id, [...documents, current])
    }

    await t.test('scoped cold result equals original complete enumeration after the same actual ID resolution', () => {
      assert.deepEqual(coldView, fullExpected(targetId, coldView!.current))
      const current = links.getProcessOrderTaskRelationView(targetId)!
      assert.deepEqual(current, coldView)
      assert.ok([...current.predecessors, ...current.successors].every(document => ![targetId, task.baseTaskId].includes(document.documentId)))
      assert.equal(new Set(current.successors.map(document => document.documentId)).size, current.successors.length)
    })

    await t.test('production with print/dye uses all existing preparation facts and keeps unknown IDs unknown', () => {
      const order = productionOrders.find(row => row.productionOrderId === task.productionOrderId)!
      const originalSnapshot = order.techPackSnapshot!
      const before = print.capturePrintProcessMutationState()
      const changed = structuredClone(before)
      const source = changed.workOrders[0][1]
      const entryId = 'TEST-EXACT-PRINT-BEFORE-CUT'
      const cutEntry = originalSnapshot.processEntries.find(entry => entry.id === task.sourceEntryIds?.[0] || entry.id === task.sourceEntryId)!
      assert.ok(cutEntry)
      order.techPackSnapshot = structuredClone(originalSnapshot)
      Object.assign(order.techPackSnapshot.bomItems[0], { unit: '米', unitConsumption: 1, lossRate: 0 })
      order.techPackSnapshot.processEntries.unshift({ ...cutEntry, id: entryId, stageCode: 'PREP', processCode: 'PRINT', processName: '印花', predecessorEntryIds: [], linkedBomItemIds: [originalSnapshot.bomItems[0].id] })
      order.techPackSnapshot.processEntries.find(entry => entry.id === cutEntry.id)!.predecessorEntryIds = [entryId]
      source.sourceProductionOrderId = task.productionOrderId
      source.sourceSnapshot = { sourceType: 'PRODUCTION_ORDER', productionOrderId: task.productionOrderId,
        processEntryId: entryId, bomItemId: originalSnapshot.bomItems[0].id }
      print.restorePrintProcessMutationState(changed)
      try {
        const view = links.getProcessOrderTaskRelationView(targetId)!
        assert.ok(view.predecessors.some(document => document.documentId === source.printOrderId))
        assert.deepEqual(view, fullExpected(targetId, view.current))
      } finally { order.techPackSnapshot = originalSnapshot; print.restorePrintProcessMutationState(before) }
      assert.equal(links.getProcessOrderTaskRelationView('missing-execution-id'), undefined)
      assert.ok(links.getProcessOrderTaskRelationView(print.listPrintWorkOrders()[0].printOrderId))
    })

    await t.test('live explicit cross-order reference and cancellation facts survive scoped reading', () => {
      const before = print.capturePrintProcessMutationState()
      const changed = structuredClone(before)
      const record = changed.workOrders[0][1]
      const foreignOrderId = record.sourceProductionOrderId
      assert.notEqual(foreignOrderId, task.productionOrderId)
      record.sourceSnapshot = { ...record.sourceSnapshot, sourceType: record.sourceType,
        productionOrderId: foreignOrderId, downstreamWorkOrderId: task.baseTaskId }
      record.status = 'CANCELLED'
      print.restorePrintProcessMutationState(changed)
      try {
        const view = links.getProcessOrderTaskRelationView(targetId)!
        assert.ok(view.predecessors.some(document => document.documentId === record.printOrderId))
        assert.deepEqual(view, fullExpected(targetId, view.current))
        assert.equal(print.readPrintWorkOrdersWithoutInitialization().orders.find(row => row.printOrderId === record.printOrderId)?.status, 'CANCELLED')
        const isolated = print.readPrintWorkOrdersWithoutInitialization()
        isolated.orders[0].sourceSnapshot!.downstreamWorkOrderId = 'mutated-copy'
        assert.equal(print.readPrintWorkOrdersWithoutInitialization().orders[0].sourceSnapshot?.downstreamWorkOrderId, task.baseTaskId)
      } finally { print.restorePrintProcessMutationState(before) }
    })

    await t.test('real persisted cancellation restores through the original validated path in a new process', () => {
      const cancellable = print.listPrintWorkOrders().find(row => row.businessView && row.status !== 'CANCELLED'
        && row.businessView.actualInput.receivedQty === 0 && row.businessView.actualInput.usedQty === 0
        && row.businessView.output.completedQty === 0 && row.businessView.handover.handedOverQty === 0)!
      assert.ok(cancellable)
      print.cancelPrintingWorkOrder(cancellable.printOrderId, { operatorName: '专项验证', reason: '取消状态与关系回读验证' })
      assert.ok(storage.has('higoods.formal-print-execution.v1'))
      const code = `
        import assert from 'node:assert/strict';
        let raw='';for await(const chunk of process.stdin)raw+=chunk;
        const input=JSON.parse(raw),store=new Map(input.storage);
        Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
        const runtime=await import('./src/data/fcs/runtime-process-tasks.ts');
        const print=await import('./src/data/fcs/printing-task-domain.ts');
        const links=await import('./src/data/fcs/process-order-task-links.ts');
        assert.equal(print.readPrintWorkOrdersWithoutInitialization().needsRestoration,true);
        const task=runtime.getRuntimeTaskById(input.targetId);
        const actual=links.getProcessOrderTaskRelationView(input.targetId);
        assert.equal(print.getPrintWorkOrderById(input.cancelledId).status,'CANCELLED');
        const documents=links.listProcessOrderTaskDocuments().filter(d=>d.documentId!==task.baseTaskId).map(d=>({...d,predecessorDocumentIds:d.predecessorDocumentIds?.map(id=>id===task.baseTaskId?task.taskId:id),successorDocumentIds:d.successorDocumentIds?.map(id=>id===task.baseTaskId?task.taskId:id)}));
        assert.deepEqual(actual,links.buildProcessOrderTaskRelationViewFromDocuments(input.targetId,[...documents,actual.current]));
        console.log('persisted cancellation / complete relation equivalence PASS');
      `
      const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
        cwd: process.cwd(), input: JSON.stringify({ storage: [...storage], targetId, cancelledId: cancellable.printOrderId }), encoding: 'utf8', maxBuffer: 4_000_000,
      })
      assert.equal(child.status, 0, child.stderr || child.stdout)
    })

    await t.test('QC reads real fact quantities and renders explicit missing artwork without placeholder network dependency', async () => {
      const { getQcFactDetail } = await import('../../src/pages/qc-records/fact-view.ts')
      const { renderQcRecordDetailPage } = await import('../../src/pages/qc-records/detail-domain.ts')
      const before = getQcFactDetail('QC-RIB-202603-0002')
      assert.ok(before)
      const html = renderQcRecordDetailPage('QC-RIB-202603-0002')
      assert.match(html, /QC-RIB-202603-0002/)
      assert.match(html, /data-qc-image-missing/)
      assert.match(html, /对应实图待补/)
      assert.doesNotMatch(html, /placehold\.co/)
      assert.deepEqual(getQcFactDetail('QC-RIB-202603-0002'), before)
    })
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
