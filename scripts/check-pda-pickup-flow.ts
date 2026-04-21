import {
  confirmPdaPickupRecordReceived,
  getPdaPickupRecordsByHead,
  findPdaPickupRecord,
  listPdaHandoverHeads,
  markPdaPickupRecordWarehouseHanded,
} from '../src/data/fcs/pda-handover-events.ts'
import { getProgressExceptionById } from '../src/data/fcs/store-domain-progress.ts'
import {
  createPdaPickupDisputeCase,
  updatePdaPickupDisputePlatformHandling,
} from '../src/helpers/fcs-pda-pickup-dispute.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function checkWarehouseHandedDoesNotEqualReceived(): void {
  const recordId = 'PKH-MOCK-SEW-400-001'
  const before = findPdaPickupRecord(recordId)
  assert(before, `未找到记录 ${recordId}`)
  assert(before?.status === 'PENDING_WAREHOUSE_DISPATCH', `${recordId} 初始状态应为待仓库发出`)

  const updated = markPdaPickupRecordWarehouseHanded(recordId, {
    warehouseHandedQty: before.qtyExpected,
    warehouseHandedAt: '2026-03-28 12:00:00',
    warehouseHandedBy: '脚本校验员',
  })

  assert(updated, `${recordId} 仓库扫码交付后未更新`)
  assert(updated?.status === 'PENDING_FACTORY_CONFIRM', `${recordId} 仓库交付后应进入待工厂确认`)
  assert(updated?.status !== 'RECEIVED', `${recordId} 仓库交付后不应直接变成已确认领料`)
}

function checkFactoryConfirmFlow(): void {
  const recordId = 'PKH-MOCK-SEW-400-003'
  const before = findPdaPickupRecord(recordId)
  assert(before, `未找到记录 ${recordId}`)
  assert(before?.status === 'PENDING_FACTORY_CONFIRM', `${recordId} 初始状态应为待工厂确认`)

  const updated = confirmPdaPickupRecordReceived(recordId, {
    factoryConfirmedQty: before.warehouseHandedQty ?? before.qtyExpected,
    factoryConfirmedAt: nowTimestamp(new Date('2026-03-28T13:00:00+08:00')),
  })

  assert(updated, `${recordId} 工厂确认领料失败`)
  assert(updated?.status === 'RECEIVED', `${recordId} 工厂确认后应变成已确认领料`)
  assert(typeof updated?.factoryConfirmedQty === 'number', `${recordId} 工厂确认数量未写入`)
}

function checkPickupDisputeFlow(): void {
  const disputeCandidate = listPdaHandoverHeads()
    .filter((head) => head.headType === 'PICKUP')
    .flatMap((head) => getPdaPickupRecordsByHead(head.handoverId))
    .find((record) => record.status === 'PENDING_FACTORY_CONFIRM' && record.recordId !== 'PKH-MOCK-SEW-400-003')

  assert(disputeCandidate, '未找到可用于校验领料数量异议的待工厂确认记录')
  const recordId = disputeCandidate.recordId
  const disputeCreated = createPdaPickupDisputeCase(recordId, {
    factoryReportedQty: 15,
    objectionReason: '工厂实收少于仓库扫码交付数量',
    objectionRemark: '现场复点少 3 件，外包装完好。',
    objectionProofFiles: [
      {
        id: 'pf-check-001',
        type: 'IMAGE',
        name: '少件复点.jpg',
        uploadedAt: '2026-03-28 14:20:00',
      },
    ],
  })

  assert(disputeCreated.record, `${recordId} 发起数量差异失败：${disputeCreated.issues.join('；')}`)
  assert(disputeCreated.exceptionCase, `${recordId} 发起数量差异后未生成异常单`)
  assert(disputeCreated.record?.status === 'OBJECTION_REPORTED', `${recordId} 发起数量差异后状态不正确`)
  assert(Boolean(disputeCreated.record?.exceptionCaseId), `${recordId} 发起数量差异后未绑定 exceptionCaseId`)

  const exceptionCase = getProgressExceptionById(disputeCreated.exceptionCase!.caseId)
  assert(exceptionCase, '数量差异对应异常单不存在')
  assert(exceptionCase?.sourceModule === 'PDA_PICKUP_DISPUTE', '数量差异异常单 sourceModule 错误')
  assert(exceptionCase?.subCategoryKey === 'MATERIAL_PICKUP_QTY_DIFF', '数量差异异常单二级分类错误')

  const resolved = updatePdaPickupDisputePlatformHandling(disputeCreated.exceptionCase!.caseId, {
    status: 'RESOLVED',
    handledBy: '平台运营',
    handledAt: '2026-03-28 15:10:00',
    finalResolvedQty: 16,
    handleNote: '平台核对仓库扫码和现场复点后，最终确认本次交付 16 件。',
  })

  assert(resolved.record, '平台裁定后未回写领料记录')
  assert(resolved.record?.status === 'OBJECTION_RESOLVED', '平台裁定后领料记录状态未变成已处理')
  assert(resolved.record?.finalResolvedQty === 16, '平台最终确认数量未回写')
  assert(resolved.record?.resolvedRemark?.includes('最终确认本次交付 16 件'), '平台处理说明未回写')
}

function main(): void {
  checkWarehouseHandedDoesNotEqualReceived()
  checkFactoryConfirmFlow()
  checkPickupDisputeFlow()
  console.log('check:pda-pickup-flow passed')
}

main()
