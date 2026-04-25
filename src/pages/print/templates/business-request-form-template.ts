import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildPrintBarcodePayload,
  buildPrintQrPayload,
  createPrintDocumentId,
  formatPrintQty,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintDocumentType,
  type PrintField,
  type PrintSourceType,
} from '../../../data/fcs/print-service.ts'
import {
  getSettlementChangeRequests,
  getSettlementRequestById,
  getSettlementStatusLabel,
  type SettlementChangeRequest,
} from '../../../data/fcs/settlement-change-requests.ts'
import {
  getProcessHandoverRecordById,
  listProcessHandoverDifferenceRecords,
  type ProcessHandoverDifferenceRecord,
  type ProcessHandoverRecord,
} from '../../../data/fcs/process-warehouse-domain.ts'
import {
  getQualityDeductionCaseFactByDisputeId,
  listQualityDeductionCaseFacts,
  listQualityDeductionDisputeCases,
} from '../../../data/fcs/quality-deduction-repository.ts'
import {
  QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL,
  QUALITY_DEDUCTION_QC_RESULT_LABEL,
} from '../../../data/fcs/quality-deduction-selectors.ts'
import type {
  DisputeCaseFact,
  PendingQualityDeductionRecord,
  QualityDeductionCaseFact,
} from '../../../data/fcs/quality-deduction-domain.ts'

export const BusinessRequestFormTemplate = 'BusinessRequestFormTemplate'
export const SettlementChangeRequestTemplate = 'SettlementChangeRequestTemplate'
export const HandoverDifferenceRequestTemplate = 'HandoverDifferenceRequestTemplate'
export const QualityDeductionConfirmationTemplate = 'QualityDeductionConfirmationTemplate'
export const QualityDisputeProcessingTemplate = 'QualityDisputeProcessingTemplate'
export const MasterDataChangeRequestTemplate = 'MasterDataChangeRequestTemplate'

type BusinessRequestDocumentType =
  | 'SETTLEMENT_CHANGE_REQUEST'
  | 'HANDOVER_DIFFERENCE_REQUEST'
  | 'QUALITY_DEDUCTION_CONFIRMATION'
  | 'QUALITY_DISPUTE_PROCESSING'
  | 'MASTER_DATA_CHANGE_REQUEST'

interface MasterDataChangeRequestMock {
  requestId: string
  requestNo: string
  targetObject: string
  requestType: string
  applicant: string
  requestedAt: string
  status: string
  fields: Array<{ fieldName: string; beforeValue: string; afterValue: string; reason: string; remark: string }>
  attachments: Array<{ name: string; type: string; uploadedBy: string; uploadedAt: string }>
  review: { reviewer: string; reviewedAt: string; result: string; remark: string }
}

const masterDataChangeRequests: MasterDataChangeRequestMock[] = [
  {
    requestId: 'MDCR-202604-001',
    requestNo: 'MDCR-202604-001',
    targetObject: '全能力测试工厂',
    requestType: '工厂联系人与产能资料变更',
    applicant: '平台运营-林静',
    requestedAt: '2026-04-20 10:30:00',
    status: '待审核',
    fields: [
      { fieldName: '联系人', beforeValue: 'Agus', afterValue: 'Rina', reason: '工厂现场负责人更换', remark: '不影响结算资料' },
      { fieldName: '后道日产能', beforeValue: '2,400 件/日', afterValue: '2,800 件/日', reason: '新增一条后道线', remark: '需平台复核产能' },
      { fieldName: '质检联系人电话', beforeValue: '+62-812-0001', afterValue: '+62-812-0909', reason: '质检主管调整', remark: '用于现场沟通' },
    ],
    attachments: [
      { name: '工厂联系人授权函', type: 'PDF', uploadedBy: '平台运营-林静', uploadedAt: '2026-04-20 10:35:00' },
      { name: '产能调整说明', type: '图片', uploadedBy: '平台运营-林静', uploadedAt: '2026-04-20 10:36:00' },
    ],
    review: {
      reviewer: '平台主管-陈敏',
      reviewedAt: '待审核',
      result: '待审核',
      remark: '资料变更申请单仅作为主数据变更凭证，不触发业务流水。',
    },
  },
]

const TITLE_BY_DOCUMENT: Record<BusinessRequestDocumentType, string> = {
  SETTLEMENT_CHANGE_REQUEST: '结算信息变更申请单',
  HANDOVER_DIFFERENCE_REQUEST: '差异处理申请单',
  QUALITY_DEDUCTION_CONFIRMATION: '质量扣款确认单',
  QUALITY_DISPUTE_PROCESSING: '质量异议处理单',
  MASTER_DATA_CHANGE_REQUEST: '资料变更申请单',
}

const SOURCE_TYPE_BY_DOCUMENT: Record<BusinessRequestDocumentType, PrintSourceType> = {
  SETTLEMENT_CHANGE_REQUEST: 'SETTLEMENT_CHANGE_REQUEST_RECORD',
  HANDOVER_DIFFERENCE_REQUEST: 'HANDOVER_DIFFERENCE_RECORD',
  QUALITY_DEDUCTION_CONFIRMATION: 'QUALITY_DEDUCTION_PENDING_RECORD',
  QUALITY_DISPUTE_PROCESSING: 'QUALITY_DISPUTE_RECORD',
  MASTER_DATA_CHANGE_REQUEST: 'MASTER_DATA_CHANGE_REQUEST_RECORD',
}

function toText(value: string | number | undefined | null, fallback = '—'): string {
  if (value === undefined || value === null) return fallback
  const text = String(value).trim()
  return text || fallback
}

function mapFields(rows: Array<{ label: string; value: string | number | undefined | null; emphasis?: boolean }>): PrintField[] {
  return rows.map((row) => ({ label: row.label, value: toText(row.value), emphasis: row.emphasis }))
}

function maskBankAccountNo(accountNo: string): string {
  const raw = accountNo.replace(/\s+/g, '')
  if (raw.length <= 8) return raw
  return `${raw.slice(0, 4)} **** **** ${raw.slice(-4)}`
}

function getChangedFieldsSummary(request: SettlementChangeRequest): string {
  const changed: string[] = []
  if (request.before.accountHolderName !== request.after.accountHolderName) changed.push('开户名')
  if (request.before.idNumber !== request.after.idNumber) changed.push('证件号')
  if (request.before.bankName !== request.after.bankName) changed.push('银行')
  if (request.before.bankAccountNo !== request.after.bankAccountNo) changed.push('银行账号')
  if (request.before.bankBranch !== request.after.bankBranch) changed.push('支行')
  return changed.length > 0 ? changed.join('、') : '信息确认'
}

function formatMoneyWithCurrency(value: number | undefined | null, currency = 'IDR'): string {
  const amount = Number.isFinite(value) ? Number(value) : 0
  return `${amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${currency}`
}

function formatMoneyPerUnit(value: number | undefined | null, currency = 'IDR', unit = '件'): string {
  const amount = Number.isFinite(value) ? Number(value) : 0
  return `${amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${currency}/${unit}`
}

function objectQtyLabel(objectType: string | undefined, prefix: string): string {
  if (objectType === '面料') return `${prefix}面料米数`
  if (objectType === '裁片') return `${prefix}裁片数量`
  if (objectType === '成衣') return `${prefix}成衣件数`
  return `${prefix}对象数量`
}

function getDifferenceRequestSource(sourceId: string): {
  difference: ProcessHandoverDifferenceRecord
  handover?: ProcessHandoverRecord
} {
  const difference =
    listProcessHandoverDifferenceRecords().find((item) => item.differenceRecordId === sourceId || item.differenceRecordNo === sourceId)
    || listProcessHandoverDifferenceRecords()[0]
  if (!difference) throw new Error('缺少差异处理申请单来源数据')
  const handover = getProcessHandoverRecordById(difference.handoverRecordId)
  return { difference, handover }
}

function getQualityCaseByPending(sourceId: string): QualityDeductionCaseFact {
  const caseFact = listQualityDeductionCaseFacts({ includeLegacy: true })
    .find((item) =>
      item.pendingDeductionRecord?.pendingRecordId === sourceId
      || item.qcRecord.qcId === sourceId
      || item.deductionBasis?.basisId === sourceId,
    )
    || listQualityDeductionCaseFacts({ includeLegacy: true }).find((item) => item.pendingDeductionRecord)
  if (!caseFact || !caseFact.pendingDeductionRecord) throw new Error('缺少待确认质量扣款记录')
  return caseFact
}

function getQualityCaseByDispute(sourceId: string): QualityDeductionCaseFact {
  const direct = getQualityDeductionCaseFactByDisputeId(sourceId)
  if (direct?.disputeCase) return direct
  const dispute = listQualityDeductionDisputeCases({ includeLegacy: true })
    .find((item) => item.disputeId === sourceId)
    || listQualityDeductionDisputeCases({ includeLegacy: true })[0]
  const caseFact = dispute ? getQualityDeductionCaseFactByDisputeId(dispute.disputeId) : null
  if (!caseFact || !caseFact.disputeCase) throw new Error('缺少质量异议处理单来源数据')
  return caseFact
}

function getSettlementRequest(sourceId: string): SettlementChangeRequest {
  const request = getSettlementRequestById(sourceId)
    || getSettlementChangeRequests().find((item) => item.requestId === sourceId)
    || getSettlementChangeRequests()[0]
  if (!request) throw new Error('缺少结算信息变更申请单来源数据')
  return request
}

function getMasterDataRequest(sourceId: string): MasterDataChangeRequestMock {
  return masterDataChangeRequests.find((item) => item.requestId === sourceId || item.requestNo === sourceId)
    || masterDataChangeRequests[0]
}

function createBaseDocument(input: PrintDocumentBuildInput, config: {
  documentType: BusinessRequestDocumentType
  sourceId: string
  businessNo: string
  subtitle: string
  headerFields: PrintField[]
  sections: PrintDocument['sections']
  tables: PrintDocument['tables']
  differenceBlocks?: PrintDocument['differenceBlocks']
  signatureBlocks: PrintDocument['signatureBlocks']
  returnHref: string
}): PrintDocument {
  const generatedAt = getPrintGeneratedAt()
  const title = TITLE_BY_DOCUMENT[config.documentType]
  const sourceType = SOURCE_TYPE_BY_DOCUMENT[config.documentType]
  const targetRoute = `/fcs/print/preview?documentType=${encodeURIComponent(config.documentType)}&sourceId=${encodeURIComponent(config.sourceId)}`
  const qrPayload = buildPrintQrPayload({
    documentType: config.documentType,
    sourceType,
    sourceId: config.sourceId,
    businessNo: config.businessNo,
    targetRoute,
    printVersionNo: 'V1',
  })
  const barcodePayload = buildPrintBarcodePayload({
    documentType: config.documentType,
    sourceType,
    sourceId: config.sourceId,
    businessNo: config.businessNo,
    printVersionNo: 'V1',
  })

  return {
    printDocumentId: createPrintDocumentId({ ...input, sourceType, sourceId: config.sourceId }, config.documentType),
    documentType: config.documentType,
    documentTitle: title,
    sourceType,
    sourceId: config.sourceId,
    templateCode: config.documentType,
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: title,
    printSubtitle: config.subtitle,
    headerFields: [
      ...config.headerFields,
      { label: '打印时间', value: generatedAt },
      { label: '打印人', value: '平台运营-林静' },
    ],
    imageBlocks: [],
    qrCodes: [{ title: `${title}二维码`, value: qrPayload, description: `扫码查看${title}`, sizeMm: 30 }],
    barcodes: [{ title: `${title}条码`, value: barcodePayload, description: config.businessNo }],
    sections: config.sections,
    tables: config.tables,
    differenceBlocks: config.differenceBlocks || [],
    signatureBlocks: config.signatureBlocks,
    footerFields: [
      { label: '来源对象', value: config.businessNo },
      { label: '统一打印记录', value: '预览时写入 PrintRecord' },
    ],
    printMeta: {
      generatedAt,
      generatedBy: '平台运营-林静',
      printNotice: '打印前请在浏览器打印设置中关闭页眉和页脚',
      returnHref: config.returnHref,
    },
    printMode: '普通打印',
    printVersionNo: 'V1',
    qrPayload,
    barcodePayload,
  }
}

export function buildSettlementChangeRequestPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const request = getSettlementRequest(input.sourceId)
  const accountRows = (snapshot: SettlementChangeRequest['before']): PrintField[] => mapFields([
    { label: '开户名', value: snapshot.accountHolderName },
    { label: '证件号', value: snapshot.idNumber },
    { label: '银行', value: snapshot.bankName },
    { label: '银行账号', value: maskBankAccountNo(snapshot.bankAccountNo) },
    { label: '支行', value: snapshot.bankBranch || '暂无数据' },
    { label: '收款币种', value: 'IDR' },
    { label: '结算周期', value: '月结' },
    { label: '联系人', value: request.submittedBy },
    { label: '联系方式', value: '+62-812-0909' },
  ])

  return createBaseDocument(input, {
    documentType: 'SETTLEMENT_CHANGE_REQUEST',
    sourceId: request.requestId,
    businessNo: request.requestId,
    subtitle: '用于工厂结算资料变更的线下签字与平台核实，不直接改写对账或结算流水。',
    returnHref: '/fcs/factories/settlement',
    headerFields: mapFields([
      { label: '申请单号', value: request.requestId, emphasis: true },
      { label: '申请时间', value: request.submittedAt },
      { label: '申请状态', value: getSettlementStatusLabel(request.status) },
      { label: '工厂名称', value: request.factoryName },
      { label: '工厂编码', value: request.factoryId },
      { label: '提交人', value: request.submittedBy },
      { label: '当前版本号', value: request.currentVersionNo },
      { label: '目标版本号', value: request.targetVersionNo },
    ]),
    sections: [
      {
        sectionId: 'request-note',
        title: '申请说明区',
        fields: mapFields([
          { label: '申请原因', value: request.submitRemark || '收款账号资料变更' },
          { label: '变更范围', value: getChangedFieldsSummary(request) },
          { label: '生效建议时间', value: request.effectiveAt || '审核通过后生效' },
          { label: '风险说明', value: '审核通过前不影响当前结算版本、预付款批次或对账单' },
          { label: '备注', value: request.verifyRemark || request.reviewRemark || '纸质文件需留档' },
        ]),
      },
      { sectionId: 'before', title: '变更前信息区', fields: accountRows(request.before) },
      { sectionId: 'after', title: '变更后信息区', fields: accountRows(request.after) },
      {
        sectionId: 'attachments',
        title: '附件 / 证据区',
        fields: request.signedProofFiles.length > 0
          ? request.signedProofFiles.map((file) => ({
            label: file.fileType === 'IMAGE' ? '证件照片 / 银行资料' : '授权文件 / 其他附件',
            value: `${file.name} · ${file.uploadedAt} · ${file.uploadedBy}`,
          }))
          : mapFields([{ label: '附件', value: '暂无附件' }]),
      },
    ],
    tables: [],
    signatureBlocks: [
      { label: '工厂负责人签字', signerRole: '工厂负责人' },
      { label: '平台经办人签字', signerRole: '平台经办人' },
      { label: '平台复核人签字', signerRole: '平台复核人' },
      { label: '财务确认签字', signerRole: '财务确认' },
      { label: '日期', signerRole: '日期' },
      { label: '备注', signerRole: '备注' },
    ],
  })
}

export function buildHandoverDifferenceRequestPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const { difference, handover } = getDifferenceRequestSource(input.sourceId)
  const expectedLabel = objectQtyLabel(difference.objectType, '应收')
  const actualLabel = objectQtyLabel(difference.objectType, '实收')
  const diffLabel = objectQtyLabel(difference.objectType, '差异')
  return createBaseDocument(input, {
    documentType: 'HANDOVER_DIFFERENCE_REQUEST',
    sourceId: difference.differenceRecordId,
    businessNo: difference.differenceRecordNo,
    subtitle: '用于交出回写数量差异的平台处理凭证；只记录处理结果，不直接生成质量扣款流水、对账流水或结算流水。',
    returnHref: handover ? `/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=${encodeURIComponent(handover.handoverRecordId)}` : '/fcs/progress/handover',
    headerFields: mapFields([
      { label: '差异处理单号', value: difference.differenceRecordNo, emphasis: true },
      { label: '来源交出记录号', value: handover?.handoverRecordNo || difference.handoverRecordId },
      { label: '来源单据号', value: difference.sourceWorkOrderNo },
      { label: '生产单号', value: difference.sourceProductionOrderNo },
      { label: '工艺类型', value: difference.craftName },
      { label: '工厂', value: handover?.handoverFactoryName || '待确认' },
      { label: '当前状态', value: difference.status },
    ]),
    sections: [
      {
        sectionId: 'difference',
        title: '差异信息区',
        fields: mapFields([
          { label: '差异类型', value: difference.differenceType },
          { label: '对象类型', value: difference.objectType },
          { label: expectedLabel, value: formatPrintQty(difference.expectedObjectQty, difference.qtyUnit) },
          { label: actualLabel, value: formatPrintQty(difference.actualObjectQty, difference.qtyUnit) },
          { label: diffLabel, value: formatPrintQty(difference.diffObjectQty, difference.qtyUnit) },
          { label: '单位', value: difference.qtyUnit },
          { label: '责任方', value: difference.responsibilitySide },
          { label: '上报人', value: difference.reportedBy },
          { label: '上报时间', value: difference.reportedAt },
          { label: '差异原因', value: difference.remark || '接收回写数量与交出数量不一致' },
          { label: '证据', value: difference.evidenceUrls.length > 0 ? difference.evidenceUrls.join('、') : '暂无证据' },
        ]),
      },
      {
        sectionId: 'platform-handling',
        title: '平台处理区',
        fields: mapFields([
          { label: '处理状态', value: difference.status },
          { label: '处理结果', value: difference.handlingResult || '待平台处理' },
          { label: '处理人', value: difference.handledBy || '待处理' },
          { label: '处理时间', value: difference.handledAt || '待处理' },
          { label: '下一动作', value: difference.nextAction },
          { label: '备注', value: '差异处理申请单不直接生成质量扣款流水、对账流水或结算流水' },
        ]),
      },
    ],
    tables: [],
    signatureBlocks: [
      { label: '交出方签字', signerRole: '交出方' },
      { label: '接收方签字', signerRole: '接收方' },
      { label: '平台处理人签字', signerRole: '平台处理人' },
      { label: '复核人签字', signerRole: '复核人' },
      { label: '日期', signerRole: '日期' },
      { label: '备注', signerRole: '备注' },
    ],
  })
}

function buildQualityDeductionFields(caseFact: QualityDeductionCaseFact, pending: PendingQualityDeductionRecord): PrintField[] {
  const basis = caseFact.deductionBasis
  const qc = caseFact.qcRecord
  const unitAmount = basis?.deductionQty ? pending.originalAmount / basis.deductionQty : pending.originalAmount
  return mapFields([
    { label: '扣款依据', value: basis?.summary || pending.pendingReasonSummary },
    { label: '建议扣款金额', value: `${formatMoneyPerUnit(unitAmount, pending.originalCurrency, '件')}；总额 ${formatMoneyWithCurrency(pending.originalAmount, pending.originalCurrency)}` },
    { label: '币种', value: pending.originalCurrency },
    { label: '计价单位', value: `${pending.originalCurrency}/件` },
    { label: '计算说明', value: `${formatPrintQty(basis?.deductionQty || qc.unqualifiedQty, '件')} × ${formatMoneyPerUnit(unitAmount, pending.originalCurrency, '件')}` },
    { label: '当前状态', value: '待确认质量扣款记录，不是正式质量扣款流水' },
  ])
}

export function buildQualityDeductionConfirmationPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const caseFact = getQualityCaseByPending(input.sourceId)
  const pending = caseFact.pendingDeductionRecord!
  const qc = caseFact.qcRecord
  const basis = caseFact.deductionBasis
  return createBaseDocument(input, {
    documentType: 'QUALITY_DEDUCTION_CONFIRMATION',
    sourceId: pending.pendingRecordId,
    businessNo: `QDC-${pending.pendingRecordId}`,
    subtitle: '用于待确认质量扣款记录的线下确认凭证；打印动作不生成正式质量扣款流水。',
    returnHref: `/fcs/qc/records/${encodeURIComponent(qc.qcId)}`,
    headerFields: mapFields([
      { label: '质量扣款确认单号', value: `QDC-${pending.pendingRecordId}`, emphasis: true },
      { label: '来源质检记录号', value: qc.qcId },
      { label: '待确认质量扣款记录号', value: pending.pendingRecordId },
      { label: '生产单号', value: pending.productionOrderNo || basis?.productionOrderNo || qc.productionOrderId },
      { label: '工厂名称', value: pending.factoryName || qc.returnFactoryName },
      { label: '当前状态', value: '待确认质量扣款记录' },
      { label: '工厂确认截止时间', value: pending.responseDeadlineAt || '待确认' },
    ]),
    sections: [
      {
        sectionId: 'quality-issue',
        title: '质量问题区',
        fields: mapFields([
          { label: '质检结果', value: QUALITY_DEDUCTION_QC_RESULT_LABEL[qc.result] || qc.result },
          { label: '缺陷类型', value: qc.defectItems.map((item) => item.defectName).join('、') || '暂无缺陷' },
          { label: '涉及对象', value: qc.processLabel || '成衣' },
          { label: '涉及对象数量', value: formatPrintQty(qc.unqualifiedQty || basis?.deductionQty, '件') },
          { label: '单位', value: '件' },
          { label: '证据', value: qc.evidenceAssets.map((item) => item.name).join('、') || '暂无证据' },
          { label: '责任初判', value: basis?.responsiblePartyName || pending.factoryName || '待确认' },
          { label: '备注', value: '质检记录本身不是质量异议，待确认质量扣款记录不是正式质量扣款流水' },
        ]),
      },
      { sectionId: 'deduction-suggest', title: '扣款建议区', fields: buildQualityDeductionFields(caseFact, pending) },
      {
        sectionId: 'factory-response',
        title: '工厂处理区',
        fields: mapFields([
          { label: '工厂确认', value: '确认后才允许后续生成正式质量扣款流水' },
          { label: '工厂发起异议', value: '异议中不生成正式质量扣款流水' },
          { label: '超时自动确认', value: pending.isOverdue ? '已超时' : '未超时' },
          { label: '处理截止时间', value: pending.responseDeadlineAt || '待确认' },
          { label: '备注', value: '对账单只汇总正式流水，不汇总待确认质量扣款记录或异议中的记录' },
        ]),
      },
    ],
    tables: [],
    signatureBlocks: [
      { label: '平台质检人签字', signerRole: '平台质检人' },
      { label: '平台经办人签字', signerRole: '平台经办人' },
      { label: '工厂确认签字', signerRole: '工厂确认' },
      { label: '财务复核签字', signerRole: '财务复核' },
      { label: '日期', signerRole: '日期' },
      { label: '备注', signerRole: '备注' },
    ],
  })
}

export function buildQualityDisputeProcessingPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const caseFact = getQualityCaseByDispute(input.sourceId)
  const dispute = caseFact.disputeCase as DisputeCaseFact
  const pending = caseFact.pendingDeductionRecord
  const qc = caseFact.qcRecord
  const basis = caseFact.deductionBasis
  const adjudicatedAmount = dispute.adjudicatedAmount ?? pending?.originalAmount ?? basis?.proposedQualityDeductionAmount ?? 0
  const currency = pending?.originalCurrency || 'IDR'
  return createBaseDocument(input, {
    documentType: 'QUALITY_DISPUTE_PROCESSING',
    sourceId: dispute.disputeId,
    businessNo: dispute.disputeId,
    subtitle: '用于质量异议处理的线下凭证；打印动作不触发结算，也不把异议中记录纳入对账单。',
    returnHref: `/fcs/qc/records/${encodeURIComponent(qc.qcId)}?focus=dispute`,
    headerFields: mapFields([
      { label: '质量异议单号', value: dispute.disputeId, emphasis: true },
      { label: '来源质检记录号', value: qc.qcId },
      { label: '来源待确认质量扣款记录号', value: pending?.pendingRecordId || '暂无待确认记录' },
      { label: '生产单号', value: qc.productionOrderId || basis?.productionOrderNo },
      { label: '工厂名称', value: pending?.factoryName || qc.returnFactoryName },
      { label: '异议状态', value: QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL[dispute.status] || dispute.status },
    ]),
    sections: [
      {
        sectionId: 'dispute',
        title: '异议信息区',
        fields: mapFields([
          { label: '异议原因', value: dispute.disputeReasonName },
          { label: '工厂说明', value: dispute.disputeDescription },
          { label: '工厂证据', value: dispute.disputeEvidenceAssets.map((item) => item.name).join('、') || '暂无证据' },
          { label: '发起人', value: dispute.submittedByUserName || '工厂用户' },
          { label: '发起时间', value: dispute.submittedAt || '待确认' },
          { label: '涉及对象数量', value: formatPrintQty(basis?.deductionQty || qc.unqualifiedQty, '件') },
          { label: '单位', value: '件' },
        ]),
      },
      {
        sectionId: 'adjudication',
        title: '平台裁决区',
        fields: mapFields([
          { label: '裁决结果', value: dispute.adjudicationResult === 'REVERSED' ? '非工厂责任' : dispute.adjudicationResult === 'PARTIALLY_ADJUSTED' ? '部分工厂责任' : '仍为工厂责任' },
          { label: '工厂责任比例', value: dispute.adjudicationResult === 'REVERSED' ? '0%' : dispute.adjudicationResult === 'PARTIALLY_ADJUSTED' ? '部分责任' : '100%' },
          { label: '裁决扣款金额', value: formatMoneyPerUnit(adjudicatedAmount, currency, '件') },
          { label: '币种', value: currency },
          { label: '计价单位', value: `${currency}/件` },
          { label: '裁决说明', value: dispute.adjudicationComment || dispute.adjustmentReasonSummary || '待平台裁决' },
          { label: '裁决人', value: dispute.reviewerUserName || '待裁决' },
          { label: '裁决时间', value: dispute.adjudicatedAt || '待裁决' },
        ]),
      },
      {
        sectionId: 'next',
        title: '后续处理区',
        fields: mapFields([
          { label: '后续处理', value: dispute.adjudicationResult === 'REVERSED' ? '不生成质量扣款流水' : '按裁决金额生成正式质量扣款流水' },
          { label: '处理说明', value: '这里展示后续处理结果，不在打印时触发生成流水或结算' },
          { label: '备注', value: '质检记录不能直接当作质量异议单，异议中记录不进入对账单' },
        ]),
      },
    ],
    tables: [],
    signatureBlocks: [
      { label: '工厂代表签字', signerRole: '工厂代表' },
      { label: '平台质检负责人签字', signerRole: '平台质检负责人' },
      { label: '平台裁决人签字', signerRole: '平台裁决人' },
      { label: '财务复核签字', signerRole: '财务复核' },
      { label: '日期', signerRole: '日期' },
      { label: '备注', signerRole: '备注' },
    ],
  })
}

export function buildMasterDataChangeRequestPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const request = getMasterDataRequest(input.sourceId)
  return createBaseDocument(input, {
    documentType: 'MASTER_DATA_CHANGE_REQUEST',
    sourceId: request.requestId,
    businessNo: request.requestNo,
    subtitle: '用于工厂基础资料、联系人、证照、账户、产能资料等主数据变更的线下凭证。',
    returnHref: '/fcs/factories/settlement',
    headerFields: mapFields([
      { label: '资料变更申请单号', value: request.requestNo, emphasis: true },
      { label: '申请对象', value: request.targetObject },
      { label: '申请类型', value: request.requestType },
      { label: '申请人', value: request.applicant },
      { label: '申请时间', value: request.requestedAt },
      { label: '当前状态', value: request.status },
    ]),
    sections: [
      {
        sectionId: 'review',
        title: '审核区',
        fields: mapFields([
          { label: '审核人', value: request.review.reviewer },
          { label: '审核时间', value: request.review.reviewedAt },
          { label: '审核结果', value: request.review.result },
          { label: '审核备注', value: request.review.remark },
        ]),
      },
    ],
    tables: [
      {
        tableId: 'changes',
        title: '变更前后对比区',
        headers: ['字段名称', '变更前', '变更后', '变更原因', '备注'],
        rows: request.fields.map((item) => [item.fieldName, item.beforeValue, item.afterValue, item.reason, item.remark]),
      },
      {
        tableId: 'attachments',
        title: '附件区',
        headers: ['附件名称', '附件类型', '上传人', '上传时间'],
        rows: request.attachments.map((item) => [item.name, item.type, item.uploadedBy, item.uploadedAt]),
      },
    ],
    signatureBlocks: [
      { label: '申请人签字', signerRole: '申请人' },
      { label: '经办人签字', signerRole: '经办人' },
      { label: '审核人签字', signerRole: '审核人' },
      { label: '日期', signerRole: '日期' },
      { label: '备注', signerRole: '备注' },
    ],
  })
}

function renderFields(fields: PrintField[]): string {
  return fields
    .map((field) => `
      <div class="print-field ${field.emphasis ? 'print-field-emphasis' : ''}">
        <div class="print-field-label">${escapeHtml(field.label)}</div>
        <div class="print-field-value">${escapeHtml(field.value)}</div>
      </div>
    `)
    .join('')
}

function renderTable(table: PrintDocument['tables'][number]): string {
  const minRows = Math.max(table.minRows || 0, table.rows.length)
  const rows = [...table.rows]
  while (rows.length < minRows) rows.push(table.headers.map(() => ''))
  return `
    <section class="print-section">
      <div class="print-section-title">${escapeHtml(table.title)}</div>
      <table class="print-table">
        <thead><tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </section>
  `
}

export function renderBusinessRequestFormTemplate(document: PrintDocument): string {
  const qr = document.qrCodes[0]
  const barcode = document.barcodes[0]
  return `
    <article class="print-paper-a4">
      <div class="print-card-sheet">
        <div class="print-production-header">
          <div>
            <div class="print-card-title">${escapeHtml(document.printTitle)}</div>
            <div class="print-card-subtitle">${escapeHtml(document.printSubtitle)}</div>
          </div>
          <div class="print-qr-box">
            <div class="print-qr-inner">${qr ? renderRealQrPlaceholder({ value: qr.value, size: 112, title: qr.title, label: qr.description }) : ''}</div>
            <div class="print-note">${escapeHtml(qr?.description || '扫码查看申请单')}</div>
          </div>
        </div>

        <section class="print-section">
          <div class="print-section-title">页头区</div>
          <div class="print-field-grid">${renderFields(document.headerFields)}</div>
          ${barcode ? `<div class="print-production-barcode">${escapeHtml(barcode.title)}：${escapeHtml(barcode.value)}</div>` : ''}
        </section>

        ${document.sections
          .map((section) => `
            <section class="print-section">
              <div class="print-section-title">${escapeHtml(section.title)}</div>
              <div class="print-field-grid">${renderFields(section.fields)}</div>
              ${section.note ? `<p class="print-note">${escapeHtml(section.note)}</p>` : ''}
            </section>
          `)
          .join('')}

        ${document.tables.map(renderTable).join('')}

        ${document.differenceBlocks
          .map((block) => renderTable({
            tableId: 'difference',
            title: block.title,
            headers: block.headers,
            rows: block.rows,
            minRows: block.minRows,
          }))
          .join('')}

        <section class="print-section">
          <div class="print-section-title">签字区</div>
          <div class="print-signature-grid">
            ${document.signatureBlocks
              .map((item) => `
                <div class="print-signature-cell">
                  <div class="print-signature-label">${escapeHtml(item.label)}</div>
                  <div class="print-signature-role">${escapeHtml(item.signerRole)}：</div>
                </div>
              `)
              .join('')}
          </div>
        </section>

        <footer class="print-footer-fields">
          ${document.footerFields.map((field) => `<span>${escapeHtml(field.label)}：${escapeHtml(field.value)}</span>`).join('')}
        </footer>
      </div>
    </article>
  `
}

export const renderSettlementChangeRequestTemplate = renderBusinessRequestFormTemplate
export const renderHandoverDifferenceRequestTemplate = renderBusinessRequestFormTemplate
export const renderQualityDeductionConfirmationTemplate = renderBusinessRequestFormTemplate
export const renderQualityDisputeProcessingTemplate = renderBusinessRequestFormTemplate
export const renderMasterDataChangeRequestTemplate = renderBusinessRequestFormTemplate
