import { penaltyRules, settlementProfiles } from './settlement-mock-data'
import type {
  CycleType,
  PricingMode,
  RuleMode,
  RuleType,
  SettlementStatus as RuleStatus,
} from './settlement-types'

// 工厂结算资料修改申请仍然围绕主数据版本运作：
// 工厂端只能提交申请，平台审核通过后才会形成新的生效版本，
// 不会直接改写周期内的对账单、结算批次或工厂端周期页数据。

export type SettlementChangeRequestStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'

export interface SettlementEffectiveInfoSnapshot {
  accountHolderName: string
  idNumber: string
  bankName: string
  bankAccountNo: string
  bankBranch: string
}

export interface SettlementConfigSnapshot {
  cycleType: CycleType
  settlementDayRule: string
  pricingMode: PricingMode
  currency: string
}

export interface SettlementDefaultDeductionRuleSnapshot {
  ruleType: RuleType
  ruleMode: RuleMode
  ruleValue: number
  effectiveFrom: string
  effectiveTo?: string
  status: RuleStatus
}

export interface SettlementEffectiveInfo extends SettlementEffectiveInfoSnapshot {
  factoryId: string
  factoryName: string
  versionNo: string
  effectiveAt: string
  effectiveBy: string
  updatedBy: string
  settlementConfigSnapshot: SettlementConfigSnapshot
  receivingAccountSnapshot: SettlementEffectiveInfoSnapshot
  defaultDeductionRulesSnapshot: SettlementDefaultDeductionRuleSnapshot[]
}

export interface SettlementSignedProofFile {
  id: string
  name: string
  fileType: 'IMAGE' | 'FILE'
  uploadedAt: string
  uploadedBy: string
}

export interface SettlementVersionRecord extends SettlementEffectiveInfoSnapshot {
  versionId: string
  factoryId: string
  factoryName: string
  versionNo: string
  effectiveAt: string
  expiryAt: string
  status: 'EFFECTIVE' | 'EXPIRED'
  changeItems: string[]
  changeSource: string
  effectiveBy: string
  sourceRequestId: string
  settlementConfigSnapshot: SettlementConfigSnapshot
  receivingAccountSnapshot: SettlementEffectiveInfoSnapshot
  defaultDeductionRulesSnapshot: SettlementDefaultDeductionRuleSnapshot[]
}

export interface SettlementRequestLog {
  id: string
  action: string
  actor: string
  remark: string
  createdAt: string
}

export interface SettlementChangeRequest {
  requestId: string
  factoryId: string
  factoryName: string
  status: SettlementChangeRequestStatus
  submittedAt: string
  submittedBy: string
  submitRemark: string
  verifyRemark: string
  reviewRemark: string
  rejectReason: string
  printedAt: string
  printedBy: string
  signedProofFiles: SettlementSignedProofFile[]
  paperArchived: boolean
  currentVersionNo: string
  targetVersionNo: string
  effectiveAt: string
  effectiveBy: string
  before: SettlementEffectiveInfoSnapshot
  after: SettlementEffectiveInfoSnapshot
  logs: SettlementRequestLog[]
}

export interface SettlementInitDraft {
  draftId: string
  factoryId: string
  factoryName: string
  status: 'DRAFT'
  configDraft: SettlementConfigSnapshot
  receivingAccountDraft: SettlementEffectiveInfoSnapshot
  deductionRulesDraft: SettlementDefaultDeductionRuleSnapshot[]
  updatedAt: string
  updatedBy: string
}

type ActionResult<T> = { ok: true; message: string; data: T } | { ok: false; message: string }

const OPEN_REQUEST_STATUSES: SettlementChangeRequestStatus[] = ['PENDING_REVIEW']

const statusLabelMap: Record<SettlementChangeRequestStatus, string> = {
  PENDING_REVIEW: '待审核',
  APPROVED: '已通过',
  REJECTED: '未通过',
}

const statusClassMap: Record<SettlementChangeRequestStatus, string> = {
  PENDING_REVIEW: 'border-amber-200 bg-amber-50 text-amber-700',
  APPROVED: 'border-green-200 bg-green-50 text-green-700',
  REJECTED: 'border-red-200 bg-red-50 text-red-700',
}

interface SettlementEffectiveSeed extends SettlementEffectiveInfoSnapshot {
  factoryId: string
  factoryName: string
  versionNo: string
  effectiveAt: string
  effectiveBy: string
  updatedBy: string
}

interface SettlementVersionSeed extends SettlementEffectiveInfoSnapshot {
  versionId: string
  factoryId: string
  factoryName: string
  versionNo: string
  effectiveAt: string
  effectiveBy: string
  sourceRequestId: string
}

function inferVersionChangeSource(sourceRequestId: string): string {
  if (sourceRequestId === 'INIT') return '初始化'
  if (sourceRequestId === 'VERSION_MANUAL') return '平台新增版本'
  return 'PDA收款账号修改申请'
}

function inferVersionChangeItems(sourceRequestId: string): string[] {
  if (sourceRequestId === 'INIT') return ['结算配置', '收款账号', '扣款规则']
  if (sourceRequestId === 'VERSION_MANUAL') return ['结算配置', '扣款规则']
  return ['收款账号']
}

function cloneAccountSnapshot(snapshot: SettlementEffectiveInfoSnapshot): SettlementEffectiveInfoSnapshot {
  return {
    accountHolderName: snapshot.accountHolderName,
    idNumber: snapshot.idNumber,
    bankName: snapshot.bankName,
    bankAccountNo: snapshot.bankAccountNo,
    bankBranch: snapshot.bankBranch,
  }
}

function cloneConfigSnapshot(snapshot: SettlementConfigSnapshot): SettlementConfigSnapshot {
  return {
    cycleType: snapshot.cycleType,
    settlementDayRule: snapshot.settlementDayRule,
    pricingMode: snapshot.pricingMode,
    currency: snapshot.currency,
  }
}

function cloneDeductionRuleSnapshots(
  snapshots: SettlementDefaultDeductionRuleSnapshot[],
): SettlementDefaultDeductionRuleSnapshot[] {
  return snapshots.map((item) => ({ ...item }))
}

function resolveSettlementConfigSnapshot(factoryId: string): SettlementConfigSnapshot {
  const activeProfile =
    settlementProfiles.find((item) => item.factoryId === factoryId && item.isActive) ??
    settlementProfiles.find((item) => item.factoryId === factoryId)

  if (!activeProfile) {
    return {
      cycleType: 'MONTHLY',
      settlementDayRule: '每月25日',
      pricingMode: 'BY_PIECE',
      currency: 'IDR',
    }
  }

  return {
    cycleType: activeProfile.cycleType,
    settlementDayRule: activeProfile.settlementDayRule || '未配置',
    pricingMode: activeProfile.pricingMode,
    currency: activeProfile.currency,
  }
}

function resolveDeductionRuleSnapshots(factoryId: string): SettlementDefaultDeductionRuleSnapshot[] {
  const factoryRules = penaltyRules.filter((item) => item.factoryId === factoryId)
  if (factoryRules.length === 0) {
    return [
      {
        ruleType: 'QUALITY_DEFECT',
        ruleMode: 'PERCENTAGE',
        ruleValue: 5,
        effectiveFrom: '2026-01-01',
        status: 'ACTIVE',
      },
    ]
  }
  return factoryRules.map((rule) => ({
    ruleType: rule.ruleType,
    ruleMode: rule.ruleMode,
    ruleValue: rule.ruleValue,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    status: rule.status,
  }))
}

function buildEffectiveInfo(seed: SettlementEffectiveSeed): SettlementEffectiveInfo {
  const accountSnapshot = cloneAccountSnapshot(seed)
  return {
    ...seed,
    settlementConfigSnapshot: resolveSettlementConfigSnapshot(seed.factoryId),
    receivingAccountSnapshot: accountSnapshot,
    defaultDeductionRulesSnapshot: resolveDeductionRuleSnapshots(seed.factoryId),
  }
}

function buildVersionRecord(seed: SettlementVersionSeed): SettlementVersionRecord {
  const accountSnapshot = cloneAccountSnapshot(seed)
  return {
    ...seed,
    expiryAt: '',
    status: 'EFFECTIVE',
    changeItems: inferVersionChangeItems(seed.sourceRequestId),
    changeSource: inferVersionChangeSource(seed.sourceRequestId),
    settlementConfigSnapshot: resolveSettlementConfigSnapshot(seed.factoryId),
    receivingAccountSnapshot: accountSnapshot,
    defaultDeductionRulesSnapshot: resolveDeductionRuleSnapshots(seed.factoryId),
  }
}

const settlementEffectiveInfos: SettlementEffectiveInfo[] = [
  {
    factoryId: 'ID-FAC-0001',
    factoryName: 'PT Sinar Garment Indonesia',
    accountHolderName: 'PT Sinar Garment Indonesia',
    idNumber: 'NPWP-01.234.567.8-901.000',
    bankName: 'Bank Central Asia (BCA)',
    bankAccountNo: '5210980012568891',
    bankBranch: 'Jakarta Sudirman Branch',
    versionNo: 'V1',
    effectiveAt: '2026-03-02 10:30',
    effectiveBy: '平台运营-林静',
    updatedBy: '平台运营-林静',
  },
  {
    factoryId: 'ID-FAC-0002',
    factoryName: 'CV Maju Jaya Textile',
    accountHolderName: 'CV Maju Jaya Textile',
    idNumber: 'NPWP-02.734.998.1-103.000',
    bankName: 'Bank Rakyat Indonesia (BRI)',
    bankAccountNo: '4673980012559002',
    bankBranch: 'Bandung Textile Park Branch',
    versionNo: 'V2',
    effectiveAt: '2026-02-21 15:20',
    effectiveBy: '平台运营-周航',
    updatedBy: '平台运营-周航',
  },
  {
    factoryId: 'ID-FAC-0003',
    factoryName: 'PT Bandung Apparel Works',
    accountHolderName: 'PT Bandung Apparel Works',
    idNumber: 'NPWP-03.811.552.4-208.000',
    bankName: 'Bank Mandiri',
    bankAccountNo: '9006721000987342',
    bankBranch: 'Bandung Main Branch',
    versionNo: 'V2',
    effectiveAt: '2026-01-18 09:40',
    effectiveBy: '平台运营-周航',
    updatedBy: '平台运营-周航',
  },
  {
    factoryId: 'ID-FAC-0004',
    factoryName: 'PT Mulia Fashion Industry',
    accountHolderName: 'PT Mulia Fashion Industry',
    idNumber: 'NPWP-04.009.003.2-301.000',
    bankName: 'Bank Negara Indonesia (BNI)',
    bankAccountNo: '9872201009981234',
    bankBranch: 'Jakarta Kelapa Gading Branch',
    versionNo: 'V2',
    effectiveAt: '2026-02-08 13:05',
    effectiveBy: '平台运营-林静',
    updatedBy: '平台运营-林静',
  },
  {
    factoryId: 'ID-FAC-0005',
    factoryName: 'PT Java Garment Solutions',
    accountHolderName: 'PT Java Garment Solutions',
    idNumber: 'NPWP-05.229.771.0-115.000',
    bankName: 'Bank Central Asia (BCA)',
    bankAccountNo: '7789012200345678',
    bankBranch: 'Surabaya Trade Branch',
    versionNo: 'V3',
    effectiveAt: '2026-03-13 13:26',
    effectiveBy: '平台运营-周航',
    updatedBy: '平台运营-周航',
  },
  {
    factoryId: 'ID-FAC-0006',
    factoryName: 'PT Prima Tekstil Nusantara',
    accountHolderName: 'PT Prima Tekstil Nusantara',
    idNumber: 'NPWP-06.500.130.8-443.000',
    bankName: 'Bank CIMB Niaga',
    bankAccountNo: '0047712388881123',
    bankBranch: 'Semarang Center Branch',
    versionNo: 'V2',
    effectiveAt: '2026-02-03 10:10',
    effectiveBy: '平台运营-陈彦',
    updatedBy: '平台运营-陈彦',
  },
].map(buildEffectiveInfo)

const settlementVersionHistory: SettlementVersionRecord[] = [
  {
    versionId: 'VER-0001',
    factoryId: 'ID-FAC-0001',
    factoryName: 'PT Sinar Garment Indonesia',
    versionNo: 'V1',
    accountHolderName: 'PT Sinar Garment Indonesia',
    idNumber: 'NPWP-01.234.567.8-901.000',
    bankName: 'Bank Central Asia (BCA)',
    bankAccountNo: '5210980012568891',
    bankBranch: 'Jakarta Sudirman Branch',
    effectiveAt: '2026-03-02 10:30',
    effectiveBy: '平台运营-林静',
    sourceRequestId: 'INIT',
  },
  {
    versionId: 'VER-0002',
    factoryId: 'ID-FAC-0002',
    factoryName: 'CV Maju Jaya Textile',
    versionNo: 'V1',
    accountHolderName: 'CV Maju Jaya Textile',
    idNumber: 'NPWP-02.734.998.1-103.000',
    bankName: 'Bank Rakyat Indonesia (BRI)',
    bankAccountNo: '4673980012551122',
    bankBranch: 'Bandung Textile Park Branch',
    effectiveAt: '2025-11-08 09:00',
    effectiveBy: '平台运营-周航',
    sourceRequestId: 'INIT',
  },
  {
    versionId: 'VER-0003',
    factoryId: 'ID-FAC-0002',
    factoryName: 'CV Maju Jaya Textile',
    versionNo: 'V2',
    accountHolderName: 'CV Maju Jaya Textile',
    idNumber: 'NPWP-02.734.998.1-103.000',
    bankName: 'Bank Rakyat Indonesia (BRI)',
    bankAccountNo: '4673980012559002',
    bankBranch: 'Bandung Textile Park Branch',
    effectiveAt: '2026-02-21 15:20',
    effectiveBy: '平台运营-周航',
    sourceRequestId: 'SR202602210001',
  },
  {
    versionId: 'VER-0004',
    factoryId: 'ID-FAC-0003',
    factoryName: 'PT Bandung Apparel Works',
    versionNo: 'V1',
    accountHolderName: 'PT Bandung Apparel Works',
    idNumber: 'NPWP-03.811.552.4-208.000',
    bankName: 'Bank Mandiri',
    bankAccountNo: '9006721000923456',
    bankBranch: 'Bandung Main Branch',
    effectiveAt: '2025-10-05 14:20',
    effectiveBy: '平台运营-周航',
    sourceRequestId: 'INIT',
  },
  {
    versionId: 'VER-0005',
    factoryId: 'ID-FAC-0003',
    factoryName: 'PT Bandung Apparel Works',
    versionNo: 'V2',
    accountHolderName: 'PT Bandung Apparel Works',
    idNumber: 'NPWP-03.811.552.4-208.000',
    bankName: 'Bank Mandiri',
    bankAccountNo: '9006721000987342',
    bankBranch: 'Bandung Main Branch',
    effectiveAt: '2026-01-18 09:40',
    effectiveBy: '平台运营-周航',
    sourceRequestId: 'SR202601170002',
  },
  {
    versionId: 'VER-0006',
    factoryId: 'ID-FAC-0004',
    factoryName: 'PT Mulia Fashion Industry',
    versionNo: 'V1',
    accountHolderName: 'PT Mulia Fashion Industry',
    idNumber: 'NPWP-04.009.003.2-301.000',
    bankName: 'Bank Negara Indonesia (BNI)',
    bankAccountNo: '9872201009901234',
    bankBranch: 'Jakarta Kelapa Gading Branch',
    effectiveAt: '2025-09-12 10:00',
    effectiveBy: '平台运营-林静',
    sourceRequestId: 'INIT',
  },
  {
    versionId: 'VER-0007',
    factoryId: 'ID-FAC-0004',
    factoryName: 'PT Mulia Fashion Industry',
    versionNo: 'V2',
    accountHolderName: 'PT Mulia Fashion Industry',
    idNumber: 'NPWP-04.009.003.2-301.000',
    bankName: 'Bank Negara Indonesia (BNI)',
    bankAccountNo: '9872201009981234',
    bankBranch: 'Jakarta Kelapa Gading Branch',
    effectiveAt: '2026-02-08 13:05',
    effectiveBy: '平台运营-林静',
    sourceRequestId: 'SR202602080006',
  },
  {
    versionId: 'VER-0008',
    factoryId: 'ID-FAC-0005',
    factoryName: 'PT Java Garment Solutions',
    versionNo: 'V1',
    accountHolderName: 'PT Java Garment Solutions',
    idNumber: 'NPWP-05.229.771.0-115.000',
    bankName: 'Bank Central Asia (BCA)',
    bankAccountNo: '7789012200112233',
    bankBranch: 'Surabaya Trade Branch',
    effectiveAt: '2025-08-22 16:30',
    effectiveBy: '平台运营-周航',
    sourceRequestId: 'INIT',
  },
  {
    versionId: 'VER-0009',
    factoryId: 'ID-FAC-0005',
    factoryName: 'PT Java Garment Solutions',
    versionNo: 'V2',
    accountHolderName: 'PT Java Garment Solutions',
    idNumber: 'NPWP-05.229.771.0-115.000',
    bankName: 'Bank Central Asia (BCA)',
    bankAccountNo: '7789012200234567',
    bankBranch: 'Surabaya Trade Branch',
    effectiveAt: '2026-01-11 12:10',
    effectiveBy: '平台运营-周航',
    sourceRequestId: 'SR202601100003',
  },
  {
    versionId: 'VER-0010',
    factoryId: 'ID-FAC-0005',
    factoryName: 'PT Java Garment Solutions',
    versionNo: 'V3',
    accountHolderName: 'PT Java Garment Solutions',
    idNumber: 'NPWP-05.229.771.0-115.000',
    bankName: 'Bank Central Asia (BCA)',
    bankAccountNo: '7789012200345678',
    bankBranch: 'Surabaya Trade Branch',
    effectiveAt: '2026-03-13 13:26',
    effectiveBy: '平台运营-周航',
    sourceRequestId: 'SR202603120004',
  },
  {
    versionId: 'VER-0011',
    factoryId: 'ID-FAC-0006',
    factoryName: 'PT Prima Tekstil Nusantara',
    versionNo: 'V1',
    accountHolderName: 'PT Prima Tekstil Nusantara',
    idNumber: 'NPWP-06.500.130.8-443.000',
    bankName: 'Bank CIMB Niaga',
    bankAccountNo: '0047712388880001',
    bankBranch: 'Semarang Center Branch',
    effectiveAt: '2025-11-06 08:35',
    effectiveBy: '平台运营-陈彦',
    sourceRequestId: 'INIT',
  },
  {
    versionId: 'VER-0012',
    factoryId: 'ID-FAC-0006',
    factoryName: 'PT Prima Tekstil Nusantara',
    versionNo: 'V2',
    accountHolderName: 'PT Prima Tekstil Nusantara',
    idNumber: 'NPWP-06.500.130.8-443.000',
    bankName: 'Bank CIMB Niaga',
    bankAccountNo: '0047712388881123',
    bankBranch: 'Semarang Center Branch',
    effectiveAt: '2026-02-03 10:10',
    effectiveBy: '平台运营-陈彦',
    sourceRequestId: 'SR202602020009',
  },
].map(buildVersionRecord)

normalizeAllVersionHistory()

let settlementRequestLogSeq = 1

function createLog(actor: string, action: string, remark: string, createdAt: string): SettlementRequestLog {
  const id = `LOG-${String(settlementRequestLogSeq).padStart(7, '0')}`
  settlementRequestLogSeq += 1
  return {
    id,
    action,
    actor,
    remark,
    createdAt,
  }
}

const settlementChangeRequests: SettlementChangeRequest[] = [
  {
    requestId: 'SR202603160001',
    factoryId: 'ID-FAC-0002',
    factoryName: 'CV Maju Jaya Textile',
    status: 'PENDING_REVIEW',
    submittedAt: '2026-03-16 09:35',
    submittedBy: '工厂财务-Agus',
    submitRemark: '更换本月收款账号',
    verifyRemark: '',
    reviewRemark: '',
    rejectReason: '',
    printedAt: '',
    printedBy: '',
    signedProofFiles: [],
    paperArchived: false,
    currentVersionNo: 'V2',
    targetVersionNo: 'V3',
    effectiveAt: '',
    effectiveBy: '',
    before: {
      accountHolderName: 'CV Maju Jaya Textile',
      idNumber: 'NPWP-02.734.998.1-103.000',
      bankName: 'Bank Rakyat Indonesia (BRI)',
      bankAccountNo: '4673980012559002',
      bankBranch: 'Bandung Textile Park Branch',
    },
    after: {
      accountHolderName: 'CV Maju Jaya Textile',
      idNumber: 'NPWP-02.734.998.1-103.000',
      bankName: 'Bank Mandiri',
      bankAccountNo: '7789010012233445',
      bankBranch: 'Bandung Main Branch',
    },
    logs: [createLog('工厂财务-Agus', '提交申请', '工厂提交结算资料修改申请', '2026-03-16 09:35')],
  },
  {
    requestId: 'SR202603150002',
    factoryId: 'ID-FAC-0003',
    factoryName: 'PT Bandung Apparel Works',
    status: 'PENDING_REVIEW',
    submittedAt: '2026-03-15 11:18',
    submittedBy: '工厂财务-Rina',
    submitRemark: '开户支行信息变更',
    verifyRemark: '证件与账户信息核对通过',
    reviewRemark: '',
    rejectReason: '',
    printedAt: '2026-03-15 14:05',
    printedBy: '平台运营-林静',
    signedProofFiles: [],
    paperArchived: false,
    currentVersionNo: 'V2',
    targetVersionNo: 'V3',
    effectiveAt: '',
    effectiveBy: '',
    before: {
      accountHolderName: 'PT Bandung Apparel Works',
      idNumber: 'NPWP-03.811.552.4-208.000',
      bankName: 'Bank Mandiri',
      bankAccountNo: '9006721000987342',
      bankBranch: 'Bandung Main Branch',
    },
    after: {
      accountHolderName: 'PT Bandung Apparel Works',
      idNumber: 'NPWP-03.811.552.4-208.000',
      bankName: 'Bank Mandiri',
      bankAccountNo: '9006721000987342',
      bankBranch: 'Bandung Kopo Branch',
    },
    logs: [
      createLog('工厂财务-Rina', '提交申请', '工厂提交结算资料修改申请', '2026-03-15 11:18'),
      createLog('平台运营-林静', '核实记录', '证件与账户信息核验完成', '2026-03-15 13:56'),
      createLog('平台运营-林静', '平台打印结算资料变更申请单', '打印申请单用于线下签字', '2026-03-15 14:05'),
    ],
  },
  {
    requestId: 'SR202603140003',
    factoryId: 'ID-FAC-0004',
    factoryName: 'PT Mulia Fashion Industry',
    status: 'PENDING_REVIEW',
    submittedAt: '2026-03-14 16:10',
    submittedBy: '工厂财务-Maya',
    submitRemark: '账户主体更新',
    verifyRemark: '核实通过',
    reviewRemark: '',
    rejectReason: '',
    printedAt: '2026-03-15 09:20',
    printedBy: '平台运营-陈彦',
    signedProofFiles: [
      {
        id: 'FILE-SR202603140003-1',
        name: '签字证明-PTMulia-20260315.jpg',
        fileType: 'IMAGE',
        uploadedAt: '2026-03-15 17:30',
        uploadedBy: '平台运营-陈彦',
      },
    ],
    paperArchived: false,
    currentVersionNo: 'V2',
    targetVersionNo: 'V3',
    effectiveAt: '',
    effectiveBy: '',
    before: {
      accountHolderName: 'PT Mulia Fashion Industry',
      idNumber: 'NPWP-04.009.003.2-301.000',
      bankName: 'Bank Negara Indonesia (BNI)',
      bankAccountNo: '9872201009981234',
      bankBranch: 'Jakarta Kelapa Gading Branch',
    },
    after: {
      accountHolderName: 'PT Mulia Fashion Industry - Unit 2',
      idNumber: 'NPWP-04.009.003.2-301.000',
      bankName: 'Bank Negara Indonesia (BNI)',
      bankAccountNo: '9872201009985566',
      bankBranch: 'Jakarta Kelapa Gading Branch',
    },
    logs: [
      createLog('工厂财务-Maya', '提交申请', '工厂提交结算资料修改申请', '2026-03-14 16:10'),
      createLog('平台运营-陈彦', '核实记录', '证件与账户信息核验完成', '2026-03-15 08:55'),
      createLog('平台运营-陈彦', '平台打印结算资料变更申请单', '打印申请单用于线下签字', '2026-03-15 09:20'),
      createLog('平台运营-陈彦', '平台上传签字证明附件', '签字证明已上传', '2026-03-15 17:31'),
    ],
  },
  {
    requestId: 'SR202603120004',
    factoryId: 'ID-FAC-0005',
    factoryName: 'PT Java Garment Solutions',
    status: 'APPROVED',
    submittedAt: '2026-03-12 10:26',
    submittedBy: '工厂财务-Novi',
    submitRemark: '更换开户支行与账号',
    verifyRemark: '核验通过',
    reviewRemark: '纸质文件已核档，审核通过',
    rejectReason: '',
    printedAt: '2026-03-12 15:18',
    printedBy: '平台运营-周航',
    signedProofFiles: [
      {
        id: 'FILE-SR202603120004-1',
        name: '签字证明-PTJava-20260313.jpg',
        fileType: 'IMAGE',
        uploadedAt: '2026-03-13 09:40',
        uploadedBy: '平台运营-周航',
      },
    ],
    paperArchived: true,
    currentVersionNo: 'V2',
    targetVersionNo: 'V3',
    effectiveAt: '2026-03-13 13:26',
    effectiveBy: '平台运营-周航',
    before: {
      accountHolderName: 'PT Java Garment Solutions',
      idNumber: 'NPWP-05.229.771.0-115.000',
      bankName: 'Bank Central Asia (BCA)',
      bankAccountNo: '7789012200234567',
      bankBranch: 'Surabaya Trade Branch',
    },
    after: {
      accountHolderName: 'PT Java Garment Solutions',
      idNumber: 'NPWP-05.229.771.0-115.000',
      bankName: 'Bank Central Asia (BCA)',
      bankAccountNo: '7789012200345678',
      bankBranch: 'Surabaya Trade Branch',
    },
    logs: [
      createLog('工厂财务-Novi', '提交申请', '工厂提交结算资料修改申请', '2026-03-12 10:26'),
      createLog('平台运营-周航', '核实记录', '证件与账户信息核验完成', '2026-03-12 14:50'),
      createLog('平台运营-周航', '平台打印结算资料变更申请单', '打印申请单用于线下签字', '2026-03-12 15:18'),
      createLog('平台运营-周航', '平台上传签字证明附件', '签字证明已上传', '2026-03-13 09:41'),
      createLog('平台运营-周航', '审核通过', '审核通过，生成新版本 V3', '2026-03-13 13:26'),
    ],
  },
  {
    requestId: 'SR202603110005',
    factoryId: 'ID-FAC-0006',
    factoryName: 'PT Prima Tekstil Nusantara',
    status: 'REJECTED',
    submittedAt: '2026-03-11 11:00',
    submittedBy: '工厂财务-Edo',
    submitRemark: '开户名更新',
    verifyRemark: '开户证明与申请信息不一致',
    reviewRemark: '',
    rejectReason: '开户名与证件信息不一致，请补充有效证明后重新提交',
    printedAt: '',
    printedBy: '',
    signedProofFiles: [],
    paperArchived: false,
    currentVersionNo: 'V2',
    targetVersionNo: 'V3',
    effectiveAt: '',
    effectiveBy: '',
    before: {
      accountHolderName: 'PT Prima Tekstil Nusantara',
      idNumber: 'NPWP-06.500.130.8-443.000',
      bankName: 'Bank CIMB Niaga',
      bankAccountNo: '0047712388881123',
      bankBranch: 'Semarang Center Branch',
    },
    after: {
      accountHolderName: 'PT Prima Tekstil Nusantara Unit C',
      idNumber: 'NPWP-06.500.130.8-443.000',
      bankName: 'Bank CIMB Niaga',
      bankAccountNo: '0047712388881123',
      bankBranch: 'Semarang Center Branch',
    },
    logs: [
      createLog('工厂财务-Edo', '提交申请', '工厂提交结算资料修改申请', '2026-03-11 11:00'),
      createLog(
        '平台运营-陈彦',
        '驳回申请',
        '开户名与证件信息不一致，请补充有效证明后重新提交',
        '2026-03-11 16:20',
      ),
    ],
  },
]

const settlementInitDrafts: SettlementInitDraft[] = [
  {
    draftId: 'SID-0001',
    factoryId: 'ID-FAC-0007',
    factoryName: 'PT Indah Design Studio',
    status: 'DRAFT',
    configDraft: {
      cycleType: 'MONTHLY',
      settlementDayRule: '每月25日',
      pricingMode: 'BY_PIECE',
      currency: 'IDR',
    },
    receivingAccountDraft: {
      accountHolderName: 'PT Indah Design Studio',
      idNumber: 'NPWP-07.781.230.5-100.000',
      bankName: 'Bank Mandiri',
      bankAccountNo: '7220011988003211',
      bankBranch: 'Solo Main Branch',
    },
    deductionRulesDraft: [
      {
        ruleType: 'QUALITY_DEFECT',
        ruleMode: 'PERCENTAGE',
        ruleValue: 3,
        effectiveFrom: '2026-03-01',
        status: 'ACTIVE',
      },
    ],
    updatedAt: '2026-03-16 17:20',
    updatedBy: '平台运营-林静',
  },
]

let requestSeq = settlementChangeRequests.length + 1
let versionSeq = settlementVersionHistory.length + 1
let initDraftSeq = settlementInitDrafts.length + 1

function nowText(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function nextRequestId(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const seq = String(requestSeq).padStart(4, '0')
  requestSeq += 1
  return `SR${year}${month}${day}${seq}`
}

function nextVersionId(): string {
  const id = `VER-${String(versionSeq).padStart(4, '0')}`
  versionSeq += 1
  return id
}

function nextInitDraftId(): string {
  const id = `SID-${String(initDraftSeq).padStart(4, '0')}`
  initDraftSeq += 1
  return id
}

function parseVersionNo(versionNo: string): number {
  const matched = versionNo.match(/^V(\d+)$/)
  return matched ? Number(matched[1]) : 1
}

function calcNextVersionNo(versionNo: string): string {
  return `V${parseVersionNo(versionNo) + 1}`
}

function getLatestVersionRecordByFactory(factoryId: string): SettlementVersionRecord | null {
  const records = settlementVersionHistory.filter((item) => item.factoryId === factoryId)
  if (records.length === 0) return null
  return records.reduce((latest, item) =>
    parseVersionNo(item.versionNo) > parseVersionNo(latest.versionNo) ? item : latest,
  )
}

function normalizeFactoryVersionHistory(factoryId: string): void {
  const records = settlementVersionHistory
    .filter((item) => item.factoryId === factoryId)
    .sort((a, b) => parseVersionNo(a.versionNo) - parseVersionNo(b.versionNo))

  records.forEach((record, index) => {
    const nextRecord = records[index + 1]
    record.expiryAt = nextRecord ? nextRecord.effectiveAt : ''
    record.status = nextRecord ? 'EXPIRED' : 'EFFECTIVE'
    record.changeSource = record.changeSource || inferVersionChangeSource(record.sourceRequestId)
    if (!record.changeItems || record.changeItems.length === 0) {
      record.changeItems = inferVersionChangeItems(record.sourceRequestId)
    }
  })
}

function normalizeAllVersionHistory(): void {
  const factoryIds = Array.from(new Set(settlementVersionHistory.map((item) => item.factoryId)))
  factoryIds.forEach((factoryId) => normalizeFactoryVersionHistory(factoryId))
}

function getLatestVersionNoByFactory(factoryId: string): string {
  const effective = getEffectiveInfoByFactoryOrNull(factoryId)
  const historyRecord = getLatestVersionRecordByFactory(factoryId)
  const effectiveVersion = effective ? parseVersionNo(effective.versionNo) : 1
  const historyVersion = historyRecord ? parseVersionNo(historyRecord.versionNo) : 1
  return `V${Math.max(effectiveVersion, historyVersion)}`
}

function isOpenRequest(status: SettlementChangeRequestStatus): boolean {
  return OPEN_REQUEST_STATUSES.includes(status)
}

function getRequestByIdOrNull(requestId: string): SettlementChangeRequest | null {
  return settlementChangeRequests.find((item) => item.requestId === requestId) ?? null
}

function getEffectiveInfoByFactoryOrNull(factoryId: string): SettlementEffectiveInfo | null {
  return settlementEffectiveInfos.find((item) => item.factoryId === factoryId) ?? null
}

function pushRequestLog(request: SettlementChangeRequest, actor: string, action: string, remark: string): void {
  request.logs.unshift(createLog(actor, action, remark, nowText()))
}

function summarizeChangedFields(before: SettlementEffectiveInfoSnapshot, after: SettlementEffectiveInfoSnapshot): string {
  const changed: string[] = []
  if (before.accountHolderName !== after.accountHolderName) changed.push('开户名')
  if (before.idNumber !== after.idNumber) changed.push('证件号')
  if (before.bankName !== after.bankName) changed.push('银行名称')
  if (before.bankAccountNo !== after.bankAccountNo) changed.push('银行账号')
  if (before.bankBranch !== after.bankBranch) changed.push('开户支行')
  return changed.length > 0 ? changed.join('、') : '信息确认'
}

function applyAccountSnapshot(target: SettlementEffectiveInfo, snapshot: SettlementEffectiveInfoSnapshot): void {
  target.accountHolderName = snapshot.accountHolderName
  target.idNumber = snapshot.idNumber
  target.bankName = snapshot.bankName
  target.bankAccountNo = snapshot.bankAccountNo
  target.bankBranch = snapshot.bankBranch
  target.receivingAccountSnapshot = cloneAccountSnapshot(snapshot)
}

export function getSettlementEffectiveInfos(): SettlementEffectiveInfo[] {
  return settlementEffectiveInfos
}

export function getSettlementVersionHistory(factoryId?: string): SettlementVersionRecord[] {
  if (!factoryId) return settlementVersionHistory
  return settlementVersionHistory.filter((item) => item.factoryId === factoryId)
}

export function getSettlementChangeRequests(): SettlementChangeRequest[] {
  return settlementChangeRequests
}

export function listSettlementRequestsByFactory(factoryId: string): SettlementChangeRequest[] {
  return settlementChangeRequests
    .filter((item) => item.factoryId === factoryId)
    .slice()
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export function getSettlementInitDrafts(): SettlementInitDraft[] {
  return settlementInitDrafts
}

export function getSettlementStatusLabel(status: SettlementChangeRequestStatus): string {
  return statusLabelMap[status]
}

export function getSettlementStatusClass(status: SettlementChangeRequestStatus): string {
  return statusClassMap[status]
}

export function getSettlementEffectiveInfoByFactory(factoryId: string): SettlementEffectiveInfo | null {
  return getEffectiveInfoByFactoryOrNull(factoryId)
}

export function getSettlementRequestById(requestId: string): SettlementChangeRequest | null {
  return getRequestByIdOrNull(requestId)
}

export function getSettlementInitDraftByFactory(factoryId: string): SettlementInitDraft | null {
  return settlementInitDrafts.find((item) => item.factoryId === factoryId) ?? null
}

export function getSettlementLatestRequestByFactory(factoryId: string): SettlementChangeRequest | null {
  return listSettlementRequestsByFactory(factoryId)[0] ?? null
}

export function getSettlementActiveRequestByFactory(factoryId: string): SettlementChangeRequest | null {
  return settlementChangeRequests.find((item) => item.factoryId === factoryId && isOpenRequest(item.status)) ?? null
}

export function saveSettlementInitDraft(payload: {
  factoryId: string
  factoryName: string
  updatedBy: string
  configDraft: SettlementConfigSnapshot
  receivingAccountDraft: SettlementEffectiveInfoSnapshot
  deductionRulesDraft: SettlementDefaultDeductionRuleSnapshot[]
}): ActionResult<SettlementInitDraft> {
  if (getEffectiveInfoByFactoryOrNull(payload.factoryId)) {
    return { ok: false, message: '工厂已初始化结算资料，不可保存初始化草稿' }
  }

  const now = nowText()
  const existed = getSettlementInitDraftByFactory(payload.factoryId)
  if (existed) {
    existed.factoryName = payload.factoryName
    existed.configDraft = cloneConfigSnapshot(payload.configDraft)
    existed.receivingAccountDraft = cloneAccountSnapshot(payload.receivingAccountDraft)
    existed.deductionRulesDraft = cloneDeductionRuleSnapshots(payload.deductionRulesDraft)
    existed.updatedAt = now
    existed.updatedBy = payload.updatedBy
    return { ok: true, message: '初始化草稿已保存', data: existed }
  }

  const draft: SettlementInitDraft = {
    draftId: nextInitDraftId(),
    factoryId: payload.factoryId,
    factoryName: payload.factoryName,
    status: 'DRAFT',
    configDraft: cloneConfigSnapshot(payload.configDraft),
    receivingAccountDraft: cloneAccountSnapshot(payload.receivingAccountDraft),
    deductionRulesDraft: cloneDeductionRuleSnapshots(payload.deductionRulesDraft),
    updatedAt: now,
    updatedBy: payload.updatedBy,
  }
  settlementInitDrafts.unshift(draft)
  return { ok: true, message: '初始化草稿已保存', data: draft }
}

export function clearSettlementInitDraft(factoryId: string): void {
  const index = settlementInitDrafts.findIndex((item) => item.factoryId === factoryId)
  if (index >= 0) settlementInitDrafts.splice(index, 1)
}

export function initializeSettlementInfo(payload: {
  factoryId: string
  factoryName: string
  operator: string
  configSnapshot: SettlementConfigSnapshot
  receivingAccountSnapshot: SettlementEffectiveInfoSnapshot
  deductionRulesSnapshot: SettlementDefaultDeductionRuleSnapshot[]
}): ActionResult<SettlementEffectiveInfo> {
  const existed = getEffectiveInfoByFactoryOrNull(payload.factoryId)
  if (existed) return { ok: false, message: '该工厂已初始化结算资料，请使用新增版本维护' }

  const now = nowText()
  const versionNo = 'V1'
  const accountSnapshot = cloneAccountSnapshot(payload.receivingAccountSnapshot)
  const configSnapshot = cloneConfigSnapshot(payload.configSnapshot)
  const rulesSnapshot = cloneDeductionRuleSnapshots(payload.deductionRulesSnapshot)

  const effectiveInfo: SettlementEffectiveInfo = {
    factoryId: payload.factoryId,
    factoryName: payload.factoryName,
    accountHolderName: accountSnapshot.accountHolderName,
    idNumber: accountSnapshot.idNumber,
    bankName: accountSnapshot.bankName,
    bankAccountNo: accountSnapshot.bankAccountNo,
    bankBranch: accountSnapshot.bankBranch,
    versionNo,
    effectiveAt: now,
    effectiveBy: payload.operator,
    updatedBy: payload.operator,
    settlementConfigSnapshot: configSnapshot,
    receivingAccountSnapshot: accountSnapshot,
    defaultDeductionRulesSnapshot: rulesSnapshot,
  }

  settlementEffectiveInfos.push(effectiveInfo)
  settlementVersionHistory.push({
    versionId: nextVersionId(),
    factoryId: payload.factoryId,
    factoryName: payload.factoryName,
    versionNo,
    accountHolderName: accountSnapshot.accountHolderName,
    idNumber: accountSnapshot.idNumber,
    bankName: accountSnapshot.bankName,
    bankAccountNo: accountSnapshot.bankAccountNo,
    bankBranch: accountSnapshot.bankBranch,
    effectiveAt: now,
    expiryAt: '',
    status: 'EFFECTIVE',
    changeItems: ['结算配置', '收款账号', '扣款规则'],
    changeSource: '初始化',
    effectiveBy: payload.operator,
    sourceRequestId: 'INIT',
    settlementConfigSnapshot: cloneConfigSnapshot(configSnapshot),
    receivingAccountSnapshot: cloneAccountSnapshot(accountSnapshot),
    defaultDeductionRulesSnapshot: cloneDeductionRuleSnapshots(rulesSnapshot),
  })
  normalizeFactoryVersionHistory(payload.factoryId)

  clearSettlementInitDraft(payload.factoryId)
  return { ok: true, message: '已完成结算资料初始化', data: effectiveInfo }
}

export function createSettlementVersionFromCurrent(payload: {
  factoryId: string
  operator: string
  settlementConfigSnapshot: SettlementConfigSnapshot
  deductionRulesSnapshot: SettlementDefaultDeductionRuleSnapshot[]
  effectiveAt?: string
}): ActionResult<SettlementEffectiveInfo> {
  const current = getEffectiveInfoByFactoryOrNull(payload.factoryId)
  if (!current) return { ok: false, message: '工厂尚未初始化结算资料，无法新增版本' }
  const latestVersionNo = getLatestVersionNoByFactory(payload.factoryId)
  const nextVersionNo = calcNextVersionNo(latestVersionNo)
  const nextEffectiveAt = payload.effectiveAt?.trim() || nowText()

  const nextConfigSnapshot = cloneConfigSnapshot(payload.settlementConfigSnapshot)
  const nextRulesSnapshot = cloneDeductionRuleSnapshots(payload.deductionRulesSnapshot)
  const accountSnapshot = cloneAccountSnapshot(current.receivingAccountSnapshot)

  current.versionNo = nextVersionNo
  current.effectiveAt = nextEffectiveAt
  current.effectiveBy = payload.operator
  current.updatedBy = payload.operator
  current.settlementConfigSnapshot = nextConfigSnapshot
  current.defaultDeductionRulesSnapshot = nextRulesSnapshot
  applyAccountSnapshot(current, accountSnapshot)

  settlementVersionHistory.push({
    versionId: nextVersionId(),
    factoryId: current.factoryId,
    factoryName: current.factoryName,
    versionNo: nextVersionNo,
    accountHolderName: accountSnapshot.accountHolderName,
    idNumber: accountSnapshot.idNumber,
    bankName: accountSnapshot.bankName,
    bankAccountNo: accountSnapshot.bankAccountNo,
    bankBranch: accountSnapshot.bankBranch,
    effectiveAt: nextEffectiveAt,
    expiryAt: '',
    status: 'EFFECTIVE',
    changeItems: ['结算配置', '扣款规则'],
    changeSource: '平台新增版本',
    effectiveBy: payload.operator,
    sourceRequestId: 'VERSION_MANUAL',
    settlementConfigSnapshot: cloneConfigSnapshot(nextConfigSnapshot),
    receivingAccountSnapshot: cloneAccountSnapshot(accountSnapshot),
    defaultDeductionRulesSnapshot: cloneDeductionRuleSnapshots(nextRulesSnapshot),
  })
  normalizeFactoryVersionHistory(current.factoryId)

  return { ok: true, message: `已生成新版本 ${nextVersionNo}`, data: current }
}

export function createSettlementChangeRequest(payload: {
  factoryId: string
  submittedBy: string
  submitRemark: string
  after: SettlementEffectiveInfoSnapshot
}): ActionResult<SettlementChangeRequest> {
  const current = getEffectiveInfoByFactoryOrNull(payload.factoryId)
  if (!current) return { ok: false, message: '未找到当前生效结算资料' }
  const activeRequest = getSettlementActiveRequestByFactory(payload.factoryId)
  if (activeRequest) return { ok: false, message: '当前已有结算资料修改申请处理中' }

  const createdAt = nowText()
  const request: SettlementChangeRequest = {
    requestId: nextRequestId(),
    factoryId: payload.factoryId,
    factoryName: current.factoryName,
    status: 'PENDING_REVIEW',
    submittedAt: createdAt,
    submittedBy: payload.submittedBy,
    submitRemark: payload.submitRemark.trim(),
    verifyRemark: '',
    reviewRemark: '',
    rejectReason: '',
    printedAt: '',
    printedBy: '',
    signedProofFiles: [],
    paperArchived: false,
    currentVersionNo: current.versionNo,
    targetVersionNo: calcNextVersionNo(current.versionNo),
    effectiveAt: '',
    effectiveBy: '',
    before: cloneAccountSnapshot(current.receivingAccountSnapshot),
    after: cloneAccountSnapshot(payload.after),
    logs: [],
  }

  pushRequestLog(
    request,
    payload.submittedBy,
    '提交申请',
    `工厂提交结算资料修改申请（变更项：${summarizeChangedFields(request.before, request.after)}）`,
  )
  settlementChangeRequests.unshift(request)
  return {
    ok: true,
    message: '修改申请已提交，等待平台审核。新版本仅影响后续新生成的结算单据，已生成单据继续保留原版本快照。',
    data: request,
  }
}

export function verifySettlementRequest(
  requestId: string,
  operator: string,
  remark: string,
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  if (request.status !== 'PENDING_REVIEW') return { ok: false, message: '当前状态不可记录核实' }
  request.verifyRemark = remark.trim()
  pushRequestLog(request, operator, '核实记录', remark.trim() || '平台已完成信息核实')
  return { ok: true, message: '核实备注已记录', data: request }
}

export function markSettlementRequestPrinted(
  requestId: string,
  operator: string,
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  if (request.status !== 'PENDING_REVIEW') {
    return { ok: false, message: '当前状态不可打印申请单' }
  }
  request.printedAt = nowText()
  request.printedBy = operator
  pushRequestLog(request, operator, '平台打印结算资料变更申请单', '打印申请单用于线下签字')
  return { ok: true, message: '已打开打印预览', data: request }
}

export function uploadSettlementSignedProof(
  requestId: string,
  operator: string,
  fileType: 'IMAGE' | 'FILE',
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  if (request.status !== 'PENDING_REVIEW') {
    return { ok: false, message: '当前状态不可上传签字证明附件' }
  }
  const nextIndex = request.signedProofFiles.length + 1
  const ext = fileType === 'IMAGE' ? 'jpg' : 'pdf'
  request.signedProofFiles.push({
    id: `FILE-${request.requestId}-${nextIndex}`,
    name: `签字证明附件-${nextIndex}.${ext}`,
    fileType,
    uploadedAt: nowText(),
    uploadedBy: operator,
  })
  pushRequestLog(request, operator, '平台上传签字证明附件', `新增${fileType === 'IMAGE' ? '图片' : '附件'} 1 份`)
  return { ok: true, message: '签字证明附件已上传', data: request }
}

export function submitSettlementSignedProof(
  requestId: string,
  operator: string,
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  if (request.status !== 'PENDING_REVIEW') return { ok: false, message: '当前状态不可提交签字附件' }
  if (request.signedProofFiles.length === 0) return { ok: false, message: '请先上传签字证明图片/附件' }
  pushRequestLog(request, operator, '提交签字附件', '签字证明附件已齐全')
  return { ok: true, message: '签字附件已提交，可执行审核', data: request }
}

// backward compatible exports
export function uploadSettlementSignedForm(
  requestId: string,
  operator: string,
  fileType: 'IMAGE' | 'FILE',
): ActionResult<SettlementChangeRequest> {
  return uploadSettlementSignedProof(requestId, operator, fileType)
}

export function submitSettlementSignedForms(
  requestId: string,
  operator: string,
): ActionResult<SettlementChangeRequest> {
  return submitSettlementSignedProof(requestId, operator)
}

export function setSettlementRequestPaperArchived(
  requestId: string,
  paperArchived: boolean,
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  request.paperArchived = paperArchived
  return { ok: true, message: '已更新纸质留档状态', data: request }
}

export function approveSettlementRequest(
  requestId: string,
  operator: string,
  reviewRemark: string,
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  if (request.status !== 'PENDING_REVIEW') return { ok: false, message: '当前状态不可审核通过' }
  if (request.signedProofFiles.length === 0) return { ok: false, message: '请先上传签字证明图片/附件' }

  const current = getEffectiveInfoByFactoryOrNull(request.factoryId)
  if (!current) return { ok: false, message: '未找到当前生效信息' }
  const latestVersionNo = getLatestVersionNoByFactory(request.factoryId)
  const nextVersionNo = calcNextVersionNo(latestVersionNo)
  request.targetVersionNo = nextVersionNo

  const latestRecord = getLatestVersionRecordByFactory(request.factoryId)
  const nextConfigSnapshot = cloneConfigSnapshot(
    latestRecord ? latestRecord.settlementConfigSnapshot : current.settlementConfigSnapshot,
  )
  const nextRulesSnapshot = cloneDeductionRuleSnapshots(
    latestRecord ? latestRecord.defaultDeductionRulesSnapshot : current.defaultDeductionRulesSnapshot,
  )
  const nextAccountSnapshot = cloneAccountSnapshot(request.after)

  applyAccountSnapshot(current, nextAccountSnapshot)
  current.versionNo = nextVersionNo
  current.effectiveAt = nowText()
  current.effectiveBy = operator
  current.updatedBy = operator
  current.settlementConfigSnapshot = nextConfigSnapshot
  current.defaultDeductionRulesSnapshot = nextRulesSnapshot

  settlementVersionHistory.push({
    versionId: nextVersionId(),
    factoryId: current.factoryId,
    factoryName: current.factoryName,
    versionNo: current.versionNo,
    accountHolderName: current.accountHolderName,
    idNumber: current.idNumber,
    bankName: current.bankName,
    bankAccountNo: current.bankAccountNo,
    bankBranch: current.bankBranch,
    effectiveAt: current.effectiveAt,
    expiryAt: '',
    status: 'EFFECTIVE',
    changeItems: ['收款账号'],
    changeSource: 'PDA收款账号修改申请',
    effectiveBy: current.effectiveBy,
    sourceRequestId: request.requestId,
    settlementConfigSnapshot: cloneConfigSnapshot(nextConfigSnapshot),
    receivingAccountSnapshot: cloneAccountSnapshot(nextAccountSnapshot),
    defaultDeductionRulesSnapshot: cloneDeductionRuleSnapshots(nextRulesSnapshot),
  })
  normalizeFactoryVersionHistory(current.factoryId)

  request.status = 'APPROVED'
  request.effectiveAt = current.effectiveAt
  request.effectiveBy = operator
  request.reviewRemark = reviewRemark.trim()
  pushRequestLog(request, operator, '审核通过', reviewRemark.trim() || `审核通过，生成新版本 ${nextVersionNo}`)
  pushRequestLog(request, operator, '新版本生成', `结算资料版本由 ${latestVersionNo} 变更为 ${nextVersionNo}`)
  return { ok: true, message: '审核通过完成，当前生效资料已更新', data: request }
}

export function rejectSettlementRequest(
  requestId: string,
  operator: string,
  rejectReason: string,
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  if (request.status !== 'PENDING_REVIEW') {
    return { ok: false, message: '当前状态不可驳回' }
  }
  if (!rejectReason.trim()) return { ok: false, message: '请填写不通过原因' }
  request.status = 'REJECTED'
  request.rejectReason = rejectReason.trim()
  pushRequestLog(request, operator, '驳回申请', rejectReason.trim())
  return { ok: true, message: '申请未通过', data: request }
}

export function followupSettlementRequest(
  requestId: string,
  operator: string,
  followupRemark: string,
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  if (request.status !== 'PENDING_REVIEW') return { ok: false, message: '当前状态不可记录处理备注' }
  pushRequestLog(request, operator, '记录处理备注', followupRemark.trim() || '平台已记录处理备注')
  request.reviewRemark = followupRemark.trim()
  return { ok: true, message: '已记录处理备注', data: request }
}
