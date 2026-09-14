import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
if(!process.argv[2]){
 const folder=mkdtempSync(join(tmpdir(),'printing-reload-'))
 try{for(const mode of ['write','read']){const r=spawnSync(process.execPath,[`--localstorage-file=${join(folder,'storage')}`,'--import','tsx',fileURLToPath(import.meta.url),mode],{encoding:'utf8'});process.stdout.write(r.stdout);process.stderr.write(r.stderr);assert.equal(r.status,0,`cold ${mode}`)}}finally{rmSync(folder,{recursive:true,force:true})}
 console.log('PASS independent process cold reload: receipts, use, production, rolls, dispatch and downstream actual')
}else{
 const domain=await import('../src/data/fcs/printing-task-domain.ts')
 const receiving=await import('../src/data/fcs/factory-receiving.ts')
 const {getPrintingDispatchReceiptSummary}=await import('../src/pages/process-factory/printing/dispatch.ts')
 Object.assign(globalThis,{window:{localStorage:globalThis.localStorage,location:{pathname:'/fcs/craft/printing/work-orders',search:''},addEventListener(){}}})
 receiving.clearFactoryReceivingCache()
 const demoSnapshot=()=>JSON.stringify({
  orders:domain.listPrintingWorkOrders().filter(order=>order.workOrderId.startsWith('PWO-PRINT-DEMO-')),
  receipts:receiving.listFactoryReceipts().filter(receipt=>receipt.id.startsWith('DEMO-PRINT-')||receipt.id==='CHECK-DEMO-RELOAD').sort((a,b)=>a.id.localeCompare(b.id)),
  sources:receiving.listFactoryReceivingSources().filter(source=>source.id.startsWith('DEMO-PRINT-IN-')),
  docs:domain.listPrintingDispatchDocuments().filter(doc=>doc.lines.some(line=>line.workOrderId.startsWith('PWO-PRINT-DEMO-'))),
 })
 if(process.argv[2]==='write'){
  await import('./check-printing-factory-alignment.ts')
  const {confirmFactoryMaterialReceipt}=await import('../src/data/fcs/factory-receiving-links.ts')
  const source=receiving.getFactoryReceivingSource('DEMO-PRINT-IN-01-1')!,line=source.lines[0]
  const position=receiving.getDefaultFactoryReceiptPosition(source.targetFactoryId)
  confirmFactoryMaterialReceipt({id:'CHECK-DEMO-RELOAD',factoryId:source.targetFactoryId,operatorId:'TEST',operatorName:'测试仓管',receivedAt:'2026-09-14 09:00:00',lines:[{sourceId:source.id,sourceLineId:line.id,...position,rolls:line.rolls.map(roll=>({...roll,...position}))}]})
  assert.equal(domain.getPrintingWorkOrderById('PWO-PRINT-DEMO-01-1')!.actualInput.receivedQty,100)
  // Persist a user action after the initial scenarios, then compare in a fresh process.
  domain.recordPrintingProductionStage('PWO-PRINT-DEMO-01-1',{id:'CHECK-DEMO-ARTWORK',stage:'ARTWORK',action:'FINISH',operatorName:'测试员'})
  localStorage.setItem('printing-test-demo-snapshot',demoSnapshot())
  // Model an interrupted first setup: order progress saved but the last receipt
  // batch missing. Recovery may only restore these fixed initial demo records.
  const interrupted=receiving.captureFactoryReceivingData()
  interrupted.receipts=interrupted.receipts.filter(receipt=>!/^DEMO-PRINT-RCV-(09|10)-/.test(receipt.id))
  interrupted.materialUses=interrupted.materialUses?.filter(use=>!/^PWO-PRINT-DEMO-(09|10)-/.test(use.printingOrderId||''))
  receiving.restoreFactoryReceivingData(interrupted)
  // Earlier demo builds omitted dynamic factory heads from the persisted scope.
  // Model one pending, one short and one full receipt; recover only their saved facts.
  const handovers=await import('../src/data/fcs/pda-handover-events.ts')
  const missing=handovers.capturePdaHandoverState()
  const missingIds=new Set(missing.handoverHeadAdditions.filter(([,head])=>/^PWO-PRINT-DEMO-0[123]-5$/.test(head.sourceDocId||'')).map(([id])=>id))
  assert.equal(missingIds.size,3)
  missing.handoverHeadAdditions=missing.handoverHeadAdditions.filter(([id])=>!missingIds.has(id))
  missing.handoutRecordAdditions=missing.handoutRecordAdditions.filter(([id])=>!missingIds.has(id))
  handovers.restorePdaHandoverState(missing)
  handovers.persistPdaHandoverState()
 }
 else{
  const order=domain.getPrintingWorkOrderById('PWO-PRINT-001')!
  assert.equal(order.actualInput.receivedQty,100)
  assert.equal(order.actualInput.usedQty,100)
  assert.equal(order.output.completedQty,98)
  assert.equal(order.handover.handedOverQty,65)
  assert.equal(order.handover.receivedQty,64)
  assert.equal(order.pendingWritebackQty,1)
  assert.equal(order.barcodes.length,3)
  assert.equal(domain.getPrintingWorkflowFacts(order.workOrderId).availableOutputQty,33)
  assert.equal(domain.listPrintingDispatchDocuments().filter(d=>d.status==='已交出'&&d.lines.some(line=>line.workOrderId==='PWO-PRINT-001')).length,1)
  assert.equal(domain.getPrintingWorkOrderById('PWO-PRINT-002')!.actualInput.receivedQty,20)
  assert.equal(domain.listPrintingWorkOrders().length,62)
  assert.equal(domain.getPrintingWorkOrderById('PWO-PRINT-DEMO-01-1')!.actualInput.receivedQty,100)
  assert.equal(demoSnapshot(),localStorage.getItem('printing-test-demo-snapshot'),'cold load preserves all demo facts and subsequent user actions without reseeding')
  const {getPrintingWarehouseView}=await import('../src/data/fcs/printing-warehouse-view.ts')
  for(const [factoryId,qty] of [['DYE-GOTO-GLOBAL',180],['ID-FAC-001165',190]] as const)assert.equal(getPrintingWarehouseView({factoryId,timeRange:'ALL'}).waitProcessItems.reduce((n,row)=>n+row.receivedQty,0),qty,'recovered uses must deduct the original material stock once')
  for (const doc of domain.listPrintingDispatchDocuments().filter(doc=>doc.lines.some(line=>line.workOrderId.startsWith('PWO-PRINT-DEMO-')))) {
   const summary=getPrintingDispatchReceiptSummary(doc),order=domain.getPrintingWorkOrderById(doc.lines[0].workOrderId)!
   assert.equal(summary.unknown,false,'demo dispatch records must survive cold reload')
   assert.equal(summary.received.reduce((n,line)=>n+line.qty,0),order.handover.receivedQty)
   assert.equal(summary.pending.reduce((n,line)=>n+line.qty,0),order.pendingWritebackQty)
  }
  console.log('PASS 50 factory demos cold reload: original facts and subsequent receipt/artwork actions preserved')
 }
}
