import assert from 'node:assert/strict'
import {
  resetEffectiveTaskAssignmentsForTests,
} from '../src/data/fcs/effective-task-assignments.ts'
import {
  ensureSewingCutPieceResponsibilityDemo,
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
  resetSewingPickupSlipsForTests,
} from '../src/data/fcs/sewing-pickup-slips.ts'
import { buildPickupSlipPrintDocument } from '../src/pages/print/templates/material-slip-template.ts'

resetEffectiveTaskAssignmentsForTests()
resetSewingCutPieceResponsibilityForTests()
resetSewingPickupSlipsForTests()

ensureSewingCutPieceResponsibilityDemo()
assert.equal(getSewingPickupAvailability(SEWING_CUT_PIECE_RESPONSIBILITY_DEMO_ASSIGNMENT_ID, 'CUT_PIECE').available, true)

const first = issueSewingPickupSlip({
  assignmentId: SEWING_CUT_PIECE_RESPONSIBILITY_DEMO_ASSIGNMENT_ID,
  objectKind: 'CUT_PIECE',
  printedAt: '2026-09-08 09:00:00',
  printedByPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
  printedByPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
})
assert.equal(first.versionLabel, 'V1')
assert.ok(first.lines.length > 0)

const second = issueSewingPickupSlip({
  assignmentId: SEWING_CUT_PIECE_RESPONSIBILITY_DEMO_ASSIGNMENT_ID,
  objectKind: 'CUT_PIECE',
  printedAt: '2026-09-08 09:05:00',
  printedByPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
  printedByPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  reprintReason: '原纸张污损',
})
assert.equal(second.versionLabel, 'V2')
assert.equal(getCurrentSewingPickupSlip(SEWING_CUT_PIECE_RESPONSIBILITY_DEMO_ASSIGNMENT_ID, 'CUT_PIECE')?.versionId, second.versionId)
assert.throws(() => recordSewingPickupHandover({
  commandId: 'CMD-PICKUP-OLD-QR',
  versionId: first.versionId,
  recordedAt: '2026-09-08 09:10:00',
  recordedBy: '裁床待交出仓 陈敏',
  actorFactoryId: DEDICATED_CUTTING_FACTORY_ID,
  recordedByRole: 'CUTTING_WAREHOUSE',
  quantities: [{ lineId: first.lines[0]!.lineId, actualQty: 1 }],
}), /已失效/)
assert.throws(() => recordSewingPickupHandover({
  commandId: 'CMD-PICKUP-PPIC-BLOCK',
  versionId: second.versionId,
  recordedAt: '2026-09-08 09:10:00',
  recordedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  actorFactoryId: '',
  recordedByRole: 'PPIC',
  quantities: [{ lineId: second.lines[0]!.lineId, actualQty: 1 }],
}), /PPIC不能代替交出仓/)
assert.throws(() => recordSewingPickupHandover({
  commandId: 'CMD-PICKUP-WRONG-WAREHOUSE',
  versionId: second.versionId,
  recordedAt: '2026-09-08 09:12:00',
  recordedBy: '非裁床仓账号',
  actorFactoryId: 'ID-F021',
  recordedByRole: 'CUTTING_WAREHOUSE',
  quantities: [{ lineId: second.lines[0]!.lineId, actualQty: 1 }],
}), /不属于裁床待交出仓/)

const beforeCount = listSewingCutPieceHandoverEvents(SEWING_CUT_PIECE_RESPONSIBILITY_DEMO_ASSIGNMENT_ID).length
const handover = recordSewingPickupHandover({
  commandId: 'CMD-PICKUP-CUT-BATCH-001',
  versionId: second.versionId,
  recordedAt: '2026-09-08 09:15:00',
  recordedBy: '裁床待交出仓 陈敏',
  actorFactoryId: DEDICATED_CUTTING_FACTORY_ID,
  recordedByRole: 'CUTTING_WAREHOUSE',
  quantities: [{ lineId: second.lines[0]!.lineId, actualQty: 1 }],
})
assert.equal(recordSewingPickupHandover({
  commandId: 'CMD-PICKUP-CUT-BATCH-001',
  versionId: second.versionId,
  recordedAt: '2026-09-08 09:15:00',
  recordedBy: '裁床待交出仓 陈敏',
  actorFactoryId: DEDICATED_CUTTING_FACTORY_ID,
  recordedByRole: 'CUTTING_WAREHOUSE',
  quantities: [{ lineId: second.lines[0]!.lineId, actualQty: 1 }],
}).sourceRecordId, handover.sourceRecordId)
assert.equal(listSewingCutPieceHandoverEvents(SEWING_CUT_PIECE_RESPONSIBILITY_DEMO_ASSIGNMENT_ID).length, beforeCount + 1)

const printDocument = buildPickupSlipPrintDocument({
  documentType: 'PICKUP_SLIP',
  sourceType: 'PICKUP_SLIP_RECORD',
  sourceId: second.versionId,
})
assert.equal(printDocument.printTitle, '裁片领料单')
assert.equal(printDocument.imageBlocks[0]?.imageUrl, '/tshirt-sample.jpg')
assert.ok(printDocument.tables[0]?.headers.includes('本次可领'))
assert.ok(printDocument.qrCodes[0]?.value.includes(encodeURIComponent(second.versionId)) || printDocument.qrCodes[0]?.value.includes(second.versionId))

ensureSewingOutsourcingSampleDemo()
const independentAvailability = getSewingPickupAvailability(SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.independent, 'ACCESSORY')
assert.equal(independentAvailability.available, true, independentAvailability.reason)
assert.equal(getSewingPickupAvailability(SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.cuttingSewingIronPack, 'CUT_PIECE').available, false)

console.log('PPIC领料单首次打印、补打版本、旧码阻断、仓库实交、重复扫码和打印模板检查通过')
