import assert from 'node:assert/strict'
import {getFactoryReceivingSource,getDefaultFactoryReceiptPosition} from '../src/data/fcs/factory-receiving.ts'
import {confirmFactoryMaterialReceipt} from '../src/data/fcs/factory-receiving-links.ts'
import {getPrintingWorkOrderById,getPrintingWorkflowFacts,startPrintingProduction,recordPrintingProductionStage,completePrintingWorkOrder,updatePrintingRollBarcode,updatePrintingOrderInformation} from '../src/data/fcs/printing-task-domain.ts'
const id='PWO-PRINT-002',read=()=>getPrintingWorkOrderById(id)!
read()
const s=getFactoryReceivingSource('PRINT-SRC-003')!,l=s.lines[0],p=getDefaultFactoryReceiptPosition(s.targetFactoryId)
confirmFactoryMaterialReceipt({id:'VB-RCV',factoryId:s.targetFactoryId,operatorName:'仓管',operatorId:'VB',receivedAt:'2026-09-14 08:00:00',remark:'版本分批验收',lines:[{sourceId:s.id,sourceLineId:l.id,...p,rolls:[{...p,barcode:l.rolls[0].barcode,yard:100}]}]})
function confirmations(v:number){for(const stage of ['ARTWORK','SAMPLE'] as const)recordPrintingProductionStage(id,{id:`VB-${v}-${stage}`,stage,action:'FINISH',operatorName:'打样员'})}
function produce(v:number){startPrintingProduction(id,{id:`VB-${v}-USE`,qty:50,operatorName:'领料员'});recordPrintingProductionStage(id,{id:`VB-${v}-START`,stage:'PRINT',action:'START',operatorName:'印制员'});const action={id:`VB-${v}-FINISH`,stage:'PRINT' as const,action:'FINISH' as const,qty:50,operatorName:'印制员'};recordPrintingProductionStage(id,action);recordPrintingProductionStage(id,action)}
confirmations(1);produce(1)
assert.throws(()=>startPrintingProduction(id,{id:'VB-1-USE',qty:50,operatorName:'领料员'}),/重复/)
assert.equal(read().actualInput.usedQty,50,'仍有库存时重复领料也不能增加用量')
assert.throws(()=>completePrintingWorkOrder(id,{usedQty:50,usedRollCount:0.5,completedQty:50,completedRollCount:1,printerNo:'数码机01',operatorName:'完工员',lossQty:0,batchId:'VB-FRACTION'}),/整数/)
assert.equal(getPrintingWorkflowFacts(id).requiresTransfer,false)
completePrintingWorkOrder(id,{usedQty:50,usedRollCount:1,completedQty:50,completedRollCount:1,printerNo:'数码机01',operatorName:'完工员',lossQty:0,batchId:'VB-B1',finishOrder:false})
const first=read().barcodes[0],v1=structuredClone(read().productionBatches![0])
const edit={...read().requirement,frontPattern:{...read().requirement.frontPattern,patternVersion:'V2'},printerNo:'数码机01',plannedFinishAt:'2026-09-15 18:00:00',remark:'后续批次版本',operatorName:'跟单员',changeReason:'客户确认后续批次新版本'}
assert.throws(()=>updatePrintingOrderInformation(id,edit),/实测/)
assert.throws(()=>updatePrintingRollBarcode(id,first.id,{lengthY:51,gsm:200,widthCm:160,vatNo:'VB1',warehouseName:'待交出仓',remark:''}),/完成|合计|产出/)
updatePrintingRollBarcode(id,first.id,{lengthY:50,weightKg:14.8,gsm:200,widthCm:160,vatNo:'VB1',warehouseName:'待交出仓',remark:'实测重量'})
assert.equal(read().barcodes[0].weightSource,'ACTUAL')
updatePrintingOrderInformation(id,edit)
assert.equal(read().requirementVersion,2)
assert.deepEqual(read().productionBatches![0],v1)
assert.equal(read().barcodes[0].requirementVersion,1)
assert.throws(()=>startPrintingProduction(id,{id:'VB-EARLY-V2',qty:50,operatorName:'领料员'}),/花型|打样/)
confirmations(2);produce(2)
completePrintingWorkOrder(id,{usedQty:100,usedRollCount:1,completedQty:100,completedRollCount:2,printerNo:'数码机01',operatorName:'完工员',lossQty:0,batchId:'VB-B2',finishOrder:true})
assert.equal(read().output.completedQty,100)
assert.equal(read().productionBatches![1].requirementVersion,2)
assert.equal(read().productionBatches![0].requirement.frontPattern.patternVersion,'V1')
assert.equal(getPrintingWorkflowFacts(id).lossQty,0)
assert.equal(getPrintingWorkflowFacts(id).inProcessQty,0)
assert.equal(read().barcodes[0].weightKg,14.8)
assert.throws(()=>updatePrintingOrderInformation(id,{...edit,shade:'另一版本'}),/整单/)
console.log('PASS 分批版本边界：50 V1 + 50 V2，先实测再改版，旧批次不覆盖、新版重确认、工序幂等、实测重量保留、零损耗独立')
