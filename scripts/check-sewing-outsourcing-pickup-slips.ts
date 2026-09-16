import assert from 'node:assert/strict'
import {
  resetEffectiveTaskAssignmentsForTests,
} from '../src/data/fcs/effective-task-assignments.ts'
import {
  ensureSewingCutPieceResponsibilityDemo,
  getSewingCutPieceResponsibilityProjection,
  listSewingCutPieceHandoverEvents,
  resetSewingCutPieceResponsibilityForTests,
  SEWING_CUT_PIECE_RESPONSIBILITY_DEMO_ASSIGNMENT_ID,
} from '../src/data/fcs/sewing-cut-piece-responsibility.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from '../src/data/fcs/factory-onboarding-ppic.ts'
import { DEDICATED_CUTTING_FACTORY_ID } from '../src/data/fcs/factory-mock-data.ts'
import { ensureSewingOutsourcingSampleDemo, SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS } from '../src/data/fcs/sewing-outsourcing-demo.ts'
import {
  getCurrentSewingPickupSlip,
  getSewingPickupAvailability,
  issueSewingPickupSlip,
  recordSewingPickupHandover,
  getSewingPickupSlipVersion,
  listSewingPickupHandoverResults,
  type SewingPickupSlipVersion,
} from '../src/data/fcs/sewing-pickup-slips.ts'
import { buildPickupSlipPrintDocument } from '../src/pages/print/templates/material-slip-template.ts'

// HIST-008/009: new CUT_PIECE issuance is retired; persisted historical facts remain readable.
const memory = new Map<string,string>()
const storage = {getItem:(k:string)=>memory.get(k)||null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)}
;(globalThis as any).window = {localStorage:storage,sessionStorage:storage}
resetEffectiveTaskAssignmentsForTests()
resetSewingCutPieceResponsibilityForTests()
ensureSewingCutPieceResponsibilityDemo()
const assignmentId = SEWING_CUT_PIECE_RESPONSIBILITY_DEMO_ASSIGNMENT_ID
const before = getSewingCutPieceResponsibilityProjection(assignmentId)
const historical: SewingPickupSlipVersion = {
  ...before.context, slipId:`PPIC-PICKUP-${assignmentId}-CUT_PIECE`,slipNo:'LEGACY-CUT',versionId:'LEGACY-CUT-V2',versionNo:2,versionLabel:'V2',status:'CURRENT',
  taskNo:before.context.taskNo!,productionOrderNo:before.context.productionOrderNo!,taskKindLabel:'车缝',warehouseName:'裁床待交出仓',objectKind:'CUT_PIECE',
  styleCode:'LEGACY-STYLE',styleName:'历史款式',styleImageUrl:'/tshirt-sample.jpg',printedAt:'2026-09-08 09:05:00',printedByPpicId:before.context.ppicId,printedByPpicName:before.context.ppicName,
  lines:before.lines.map(line=>({lineId:`PICKUP-LINE-${line.requirementLineId}`,sourceLineId:line.requirementLineId,sourcePartCode:line.partCode,piecesPerGarment:line.piecesPerGarment,allocatedGarmentQty:line.allocatedGarmentQty,objectType:'裁片',objectCode:line.skuCode,objectName:line.partName,color:line.color,size:line.size,part:line.partName,unit:'片',requiredQty:line.requiredPieceQty,previouslyHandedOverQty:line.handedOverPieceQty,availableQty:line.debtPieceQty,imageUrl:'/tshirt-sample.jpg'})),
}
const historicalResult = {commandId:'LEGACY-CUT-CONFIRM',versionId:historical.versionId,sourceRecordId:'LEGACY-CUT-RECORD',sourceRecordNo:'LEGACY-CUT-RECORD',recordedAt:'2026-09-08 09:15:00',recordedBy:'历史仓管',actorFactoryId:DEDICATED_CUTTING_FACTORY_ID,objectKind:'CUT_PIECE',recordedByRole:'CUTTING_WAREHOUSE' as const,quantities:[{lineId:historical.lines[0].lineId,actualQty:1}]}
storage.setItem('higood:ppic:sewing-pickup-slips:v1',JSON.stringify({version:1,versions:[{...historical,versionId:'LEGACY-CUT-V1',versionNo:1,versionLabel:'V1',status:'VOIDED'},historical],handoverResults:[historicalResult]}))
assert.equal(getSewingPickupAvailability(assignmentId,'CUT_PIECE').available,false)
assert.throws(()=>issueSewingPickupSlip({assignmentId,objectKind:'CUT_PIECE',printedAt:'2026-09-16 10:00:00',printedByPpicId:before.context.ppicId,printedByPpicName:before.context.ppicName}),/改用任务单/)
assert.equal(getCurrentSewingPickupSlip(assignmentId,'CUT_PIECE')?.versionId,historical.versionId)
assert.equal(getSewingPickupSlipVersion('LEGACY-CUT-V1')?.status,'VOIDED')
assert.deepEqual(listSewingPickupHandoverResults(historical.versionId),[historicalResult])
assert.equal(getSewingCutPieceResponsibilityProjection(assignmentId).totalHandedOverPieceQty,before.totalHandedOverPieceQty+1,'historical quantities survive loading')
const eventCount=listSewingCutPieceHandoverEvents(assignmentId).length
assert.equal(recordSewingPickupHandover(historicalResult).sourceRecordId,historicalResult.sourceRecordId,'historical command replay remains idempotent')
for(const versionId of ['LEGACY-CUT-V1',historical.versionId]) {
  assert.throws(()=>recordSewingPickupHandover({...historicalResult,commandId:`NEW-${versionId}`,versionId}),/仅供历史查看/)
}
assert.equal(listSewingCutPieceHandoverEvents(assignmentId).length,eventCount,'blocked old codes never add a receipt')
assert.equal(getSewingCutPieceResponsibilityProjection(assignmentId).totalHandedOverPieceQty,before.totalHandedOverPieceQty+1)
const printDocument=buildPickupSlipPrintDocument({documentType:'PICKUP_SLIP',sourceType:'PICKUP_SLIP_RECORD',sourceId:historical.versionId})
assert.equal(printDocument.printTitle,'裁片领料单')
assert.equal(printDocument.imageBlocks[0]?.imageUrl,'/tshirt-sample.jpg')
assert.ok(printDocument.tables[0]?.headers.includes('本次可领'))
assert.ok(printDocument.qrCodes[0]?.value.includes(historical.versionId))
ensureSewingOutsourcingSampleDemo()
for(const [id,kind] of [[SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.independent,'ACCESSORY'],[SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.cuttingSewingIronPack,'FABRIC_ACCESSORY']] as const) {
  const availability=getSewingPickupAvailability(id,kind)
  assert.equal(availability.available,true,availability.reason)
  const issue={assignmentId:id,objectKind:kind,printedAt:'2026-09-16 10:00:00',printedByPpicId:SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,printedByPpicName:SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName}
  const first=issueSewingPickupSlip(issue)
  const second=issueSewingPickupSlip({...issue,reprintReason:'原纸张污损'})
  assert.equal(first.versionLabel,'V1');assert.equal(second.versionLabel,'V2')
  assert.ok(second.lines.length>0);assert.ok(second.lines.every(line=>line.imageUrl))
  const command={commandId:`NEW-${kind}`,versionId:second.versionId,recordedAt:'2026-09-16 10:05:00',recordedBy:'辅料仓管',actorFactoryId:'MATERIAL-WAREHOUSE',recordedByRole:'MATERIAL_WAREHOUSE' as const,quantities:[{lineId:second.lines[0].lineId,actualQty:1}]}
  assert.throws(()=>recordSewingPickupHandover({...command,versionId:first.versionId}),/已失效/)
  assert.throws(()=>recordSewingPickupHandover({...command,recordedByRole:'PPIC'}),/PPIC不能代替交出仓/)
  assert.throws(()=>recordSewingPickupHandover({...command,recordedByRole:'CUTTING_WAREHOUSE'}),/只能由辅料仓确认/)
  const result=recordSewingPickupHandover(command)
  assert.equal(recordSewingPickupHandover(command).sourceRecordId,result.sourceRecordId)
  assert.equal(listSewingPickupHandoverResults(second.versionId).length,1)
}
console.log('历史裁片领料单读取、历史数量与重复命令保留，新签发与新实交阻断，辅料及面辅料签发补打和实交检查通过')
