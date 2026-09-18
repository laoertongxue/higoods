import assert from 'node:assert/strict'
import {readWoolStore,replaceWoolStore} from '../src/data/fcs/wool-domain/store.ts'
import {issueWoolYarn,returnWoolYarn,completeWoolWorkOrder,addWoolHandover,confirmWoolDownstreamReceipt} from '../src/data/fcs/wool-domain/commands.ts'
import {replaceWoolMachineAssociations,listWoolMachineViews} from '../src/data/fcs/wool-domain/machine-associations.ts'
import {getWoolWarehouseLedgerBalance} from '../src/data/fcs/wool-domain/warehouse-ledger.ts'
const original=readWoolStore(),id='WOOL-STAGE-002:KNITTING',at='2026-09-18 17:00:00'
try{
 const r=original.yarnReceipts.find(r=>r.woolOrderId===id)!,line=r.lines[0],key={woolOrderId:id,objectSkuCode:line.yarnSkuCode,defaultLocationId:'WOOL-WP-YARN-DEFAULT' as const,batchNo:r.batchNo}
 assert.equal(getWoolWarehouseLedgerBalance(original.warehouseFlows,key),25)
 const input={commandId:'stock-issue',yarnSkuCode:line.yarnSkuCode,batchNo:r.batchNo,issuedQty:10,issuedAt:at,issuedBy:'仓管'}
 issueWoolYarn(id,input);issueWoolYarn(id,input)
 returnWoolYarn(id,{commandId:'stock-return',yarnSkuCode:line.yarnSkuCode,batchNo:r.batchNo,returnedQty:3,returnedAt:at,returnedBy:'仓管'})
 assert.equal(getWoolWarehouseLedgerBalance(readWoolStore().warehouseFlows,key),18)
 assert.equal(readWoolStore().yarnReceipts.find(x=>x.receiptId===r.receiptId)!.lines[0].receivedQty,25)
 assert.throws(()=>issueWoolYarn(id,{...input,commandId:'over',issuedQty:19}),/库存|余额|超过/)
 console.log('PASS kg领料退料守恒、实收保持、重复提交及超量阻断')
 const machine=listWoolMachineViews().find(m=>m.status==='IDLE'&&!readWoolStore().machineAssociations.some(a=>a.machineId===m.machineId))!
 replaceWoolMachineAssociations('WOOL-STAGE-004:KNITTING',[machine.machineId],{operatedAt:at,operatedBy:'主管'})
 assert.throws(()=>replaceWoolMachineAssociations('WOOL-STAGE-004:LINKING',[machine.machineId],{operatedAt:at,operatedBy:'主管'}),/仅横机/)
 completeWoolWorkOrder('WOOL-STAGE-004:KNITTING',{commandId:'machine-close',completedAt:at,completedBy:'主管'})
 assert.ok(!readWoolStore().machineAssociations.some(a=>a.machineId===machine.machineId))
 assert.ok(readWoolStore().machines.some(m=>m.machineId===machine.machineId))
 console.log('PASS 横机独占设备、缝盘无设备、完单释放关联但保留设备档案')
 const linkingId='WOOL-STAGE-004:LINKING',linking=readWoolStore().workOrders[linkingId]
 const handover=addWoolHandover(linkingId,{commandId:'linking-completion-handover',outputSkuCode:linking.outputPlanLines[0].outputSkuCode,handoverQty:100,handedOverAt:at,handedOverBy:'主管'})
 confirmWoolDownstreamReceipt(handover.handoverId,{commandId:'linking-completion-received',actualReceivedQty:100,receivedAt:at,receivedBy:'下游仓管'})
 const machineFacts=structuredClone({machines:readWoolStore().machines,associations:readWoolStore().machineAssociations})
 const completed=completeWoolWorkOrder(linkingId,{commandId:'linking-close',completedAt:at,completedBy:'主管'})
 assert.deepEqual(completed.confirmationSnapshot.releasedMachineIds,[])
 assert.deepEqual({machines:readWoolStore().machines,associations:readWoolStore().machineAssociations},machineFacts)
 assert.equal(readWoolStore().completions.filter(row=>row.woolOrderId===linkingId).length,1)
 assert.deepEqual(completeWoolWorkOrder(linkingId,{commandId:'linking-close',completedAt:at,completedBy:'主管'}),completed)
 console.log('PASS 缝盘实交与实收闭合后可完单，不调用横机设备命令，重复提交不增单')
}finally{replaceWoolStore(original)}
