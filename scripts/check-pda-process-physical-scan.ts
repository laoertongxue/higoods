import assert from 'node:assert/strict'

import {
  addPdaPhysicalScanLine,
  commitPdaPhysicalScanBatch,
  listPdaPhysicalScanBatches,
  listPdaPhysicalScanDraftLines,
  resetPdaPhysicalScanRuntime,
  updatePdaPhysicalScanLineQty,
  type PdaPhysicalScanCandidate,
} from '../src/data/fcs/pda-process-physical-scan.ts'

const scope = {
  sourceType: 'SPECIAL_CRAFT' as const,
  workOrderId: 'WO-SCAN-001',
  action: 'RECEIVE' as const,
}

const candidates: PdaPhysicalScanCandidate[] = [
  {
    code: 'FT-WO-SCAN-001-01',
    objectKey: 'FEI::01',
    objectType: 'FEI_TICKET',
    objectLabel: '前片 · Black / M',
    qty: 120,
    maxQty: 120,
    unit: '片',
    feiTicketNo: 'FT-WO-SCAN-001-01',
  },
  {
    code: 'FT-WO-SCAN-001-02',
    objectKey: 'FEI::02',
    objectType: 'FEI_TICKET',
    objectLabel: '后片 · Black / M',
    qty: 80,
    maxQty: 80,
    unit: '片',
    feiTicketNo: 'FT-WO-SCAN-001-02',
  },
]

function expectFailure(run: () => unknown, message: RegExp): void {
  assert.throws(run, message)
}

resetPdaPhysicalScanRuntime()

expectFailure(() => addPdaPhysicalScanLine({
  ...scope,
  rawCode: 'FT-OTHER-WORK-ORDER',
  inputMethod: 'SCANNER',
  candidates,
  scannedAt: '2026-09-01 09:00:00',
}), /不属于当前加工单/)

const scannerLine = addPdaPhysicalScanLine({
  ...scope,
  rawCode: candidates[0].code,
  inputMethod: 'SCANNER',
  candidates,
  scannedAt: '2026-09-01 09:01:00',
})
assert.equal(scannerLine.inputMethod, 'SCANNER')
assert.equal(listPdaPhysicalScanDraftLines(scope).length, 1)

expectFailure(() => addPdaPhysicalScanLine({
  ...scope,
  rawCode: candidates[0].code,
  inputMethod: 'SCANNER',
  candidates,
  scannedAt: '2026-09-01 09:02:00',
}), /已经扫过/)

expectFailure(() => updatePdaPhysicalScanLineQty({
  ...scope,
  scanLineId: scannerLine.scanLineId,
  qty: 121,
}), /不能超过/)

updatePdaPhysicalScanLineQty({
  ...scope,
  scanLineId: scannerLine.scanLineId,
  qty: 60,
})

const manualLine = addPdaPhysicalScanLine({
  ...scope,
  rawCode: candidates[1].code.toLowerCase(),
  inputMethod: 'MANUAL',
  candidates,
  scannedAt: '2026-09-01 09:03:00',
})
assert.equal(manualLine.inputMethod, 'MANUAL')

const batch = commitPdaPhysicalScanBatch({
  ...scope,
  businessRecordIds: ['PAO-RECEIVE-001', 'JH-RECEIVE-001'],
  operatorName: 'PDA 操作员',
  committedAt: '2026-09-01 09:04:00',
})
assert.equal(batch.lines.length, 2)
assert.equal(batch.totalQty, 140)
assert.deepEqual(batch.businessRecordIds, ['PAO-RECEIVE-001', 'JH-RECEIVE-001'])
assert.equal(listPdaPhysicalScanDraftLines(scope).length, 0)
assert.equal(listPdaPhysicalScanBatches(scope)[0].operatorName, 'PDA 操作员')

expectFailure(() => commitPdaPhysicalScanBatch({
  ...scope,
  businessRecordIds: ['PAO-RECEIVE-002'],
  operatorName: 'PDA 操作员',
  committedAt: '2026-09-01 09:05:00',
}), /请先逐张扫描/)

resetPdaPhysicalScanRuntime()

const ambiguousCandidates = [
  { ...candidates[0], objectKey: 'AMBIGUOUS::01', aliases: ['SHARED-CODE'] },
  { ...candidates[1], objectKey: 'AMBIGUOUS::02', aliases: ['SHARED-CODE'] },
]
expectFailure(() => addPdaPhysicalScanLine({
  ...scope,
  rawCode: 'SHARED-CODE',
  inputMethod: 'SCANNER',
  candidates: ambiguousCandidates,
  scannedAt: '2026-09-01 09:06:00',
}), /对应多条明细/)

console.log('PDA 实物逐标签／逐菲票扫码契约检查通过')
