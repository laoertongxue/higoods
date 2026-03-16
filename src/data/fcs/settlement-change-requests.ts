export type SettlementChangeRequestStatus =
  | 'PENDING_VERIFY'
  | 'WAIT_SIGNED_FORM'
  | 'WAIT_APPROVAL'
  | 'EFFECTIVE'
  | 'REJECTED'

export interface SettlementEffectiveInfoSnapshot {
  accountHolderName: string
  idNumber: string
  bankName: string
  bankAccountNo: string
  bankBranch: string
}

export interface SettlementEffectiveInfo extends SettlementEffectiveInfoSnapshot {
  factoryId: string
  factoryName: string
  effectiveAt: string
  updatedBy: string
}

export interface SettlementSignedFormFile {
  id: string
  name: string
  fileType: 'IMAGE' | 'VIDEO'
  uploadedAt: string
  uploadedBy: string
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
  signedFormFiles: SettlementSignedFormFile[]
  paperArchived: boolean
  effectiveAt: string
  effectiveBy: string
  before: SettlementEffectiveInfoSnapshot
  after: SettlementEffectiveInfoSnapshot
  logs: SettlementRequestLog[]
}

type ActionResult<T> =
  | { ok: true; message: string; data: T }
  | { ok: false; message: string }

const OPEN_REQUEST_STATUSES: SettlementChangeRequestStatus[] = [
  'PENDING_VERIFY',
  'WAIT_SIGNED_FORM',
  'WAIT_APPROVAL',
]

const statusLabelMap: Record<SettlementChangeRequestStatus, string> = {
  PENDING_VERIFY: '待核实',
  WAIT_SIGNED_FORM: '待签字回传',
  WAIT_APPROVAL: '待审核生效',
  EFFECTIVE: '已生效',
  REJECTED: '已驳回',
}

const statusClassMap: Record<SettlementChangeRequestStatus, string> = {
  PENDING_VERIFY: 'border-amber-200 bg-amber-50 text-amber-700',
  WAIT_SIGNED_FORM: 'border-blue-200 bg-blue-50 text-blue-700',
  WAIT_APPROVAL: 'border-orange-200 bg-orange-50 text-orange-700',
  EFFECTIVE: 'border-green-200 bg-green-50 text-green-700',
  REJECTED: 'border-red-200 bg-red-50 text-red-700',
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
    effectiveAt: '2026-03-02 10:30',
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
    effectiveAt: '2026-02-21 15:20',
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
    effectiveAt: '2026-01-18 09:40',
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
    effectiveAt: '2026-02-08 13:05',
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
    effectiveAt: '2026-03-07 16:25',
    updatedBy: '平台运营-陈彦',
  },
  {
    factoryId: 'ID-FAC-0006',
    factoryName: 'PT Prima Tekstil Nusantara',
    accountHolderName: 'PT Prima Tekstil Nusantara',
    idNumber: 'NPWP-06.500.130.8-443.000',
    bankName: 'Bank CIMB Niaga',
    bankAccountNo: '0047712388881123',
    bankBranch: 'Semarang Center Branch',
    effectiveAt: '2026-02-03 10:10',
    updatedBy: '平台运营-陈彦',
  },
]

function createLog(actor: string, action: string, remark: string, createdAt: string): SettlementRequestLog {
  return {
    id: `LOG-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
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
    status: 'PENDING_VERIFY',
    submittedAt: '2026-03-16 09:35',
    submittedBy: '工厂财务-Agus',
    submitRemark: '更换本月收款账号',
    verifyRemark: '',
    reviewRemark: '',
    rejectReason: '',
    printedAt: '',
    signedFormFiles: [],
    paperArchived: false,
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
    logs: [
      createLog('工厂财务-Agus', '提交申请', '工厂提交结算信息修改申请', '2026-03-16 09:35'),
    ],
  },
  {
    requestId: 'SR202603150002',
    factoryId: 'ID-FAC-0003',
    factoryName: 'PT Bandung Apparel Works',
    status: 'WAIT_SIGNED_FORM',
    submittedAt: '2026-03-15 11:18',
    submittedBy: '工厂财务-Rina',
    submitRemark: '开户支行信息变更',
    verifyRemark: '证件与账户信息核对通过',
    reviewRemark: '',
    rejectReason: '',
    printedAt: '2026-03-15 14:05',
    signedFormFiles: [],
    paperArchived: false,
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
      createLog('工厂财务-Rina', '提交申请', '工厂提交结算信息修改申请', '2026-03-15 11:18'),
      createLog('平台运营-林静', '核实通过', '证件与账户信息核验完成', '2026-03-15 13:56'),
      createLog('平台运营-林静', '打印申请单', '已打印结算信息变更申请单', '2026-03-15 14:05'),
    ],
  },
  {
    requestId: 'SR202603140003',
    factoryId: 'ID-FAC-0004',
    factoryName: 'PT Mulia Fashion Industry',
    status: 'WAIT_APPROVAL',
    submittedAt: '2026-03-14 16:10',
    submittedBy: '工厂财务-Maya',
    submitRemark: '账户主体更新',
    verifyRemark: '核实通过',
    reviewRemark: '',
    rejectReason: '',
    printedAt: '2026-03-15 09:20',
    signedFormFiles: [
      {
        id: 'FILE-SR202603140003-1',
        name: '签字申请单-PTMulia-20260315.jpg',
        fileType: 'IMAGE',
        uploadedAt: '2026-03-15 17:30',
        uploadedBy: '平台运营-陈彦',
      },
    ],
    paperArchived: false,
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
      createLog('工厂财务-Maya', '提交申请', '工厂提交结算信息修改申请', '2026-03-14 16:10'),
      createLog('平台运营-陈彦', '核实通过', '证件与账户信息核验完成', '2026-03-15 08:55'),
      createLog('平台运营-陈彦', '打印申请单', '已打印结算信息变更申请单', '2026-03-15 09:20'),
      createLog('平台运营-陈彦', '提交签字附件', '签字附件已上传，转待审核生效', '2026-03-15 17:31'),
    ],
  },
  {
    requestId: 'SR202603120004',
    factoryId: 'ID-FAC-0005',
    factoryName: 'PT Java Garment Solutions',
    status: 'EFFECTIVE',
    submittedAt: '2026-03-12 10:26',
    submittedBy: '工厂财务-Novi',
    submitRemark: '更换开户支行与账号',
    verifyRemark: '核验通过',
    reviewRemark: '纸质文件已核档，审核生效',
    rejectReason: '',
    printedAt: '2026-03-12 15:18',
    signedFormFiles: [
      {
        id: 'FILE-SR202603120004-1',
        name: '签字申请单-PTJava-20260313.jpg',
        fileType: 'IMAGE',
        uploadedAt: '2026-03-13 09:40',
        uploadedBy: '平台运营-周航',
      },
    ],
    paperArchived: true,
    effectiveAt: '2026-03-13 13:26',
    effectiveBy: '平台运营-周航',
    before: {
      accountHolderName: 'PT Java Garment Solutions',
      idNumber: 'NPWP-05.229.771.0-115.000',
      bankName: 'Bank Central Asia (BCA)',
      bankAccountNo: '7789012200112233',
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
      createLog('工厂财务-Novi', '提交申请', '工厂提交结算信息修改申请', '2026-03-12 10:26'),
      createLog('平台运营-周航', '核实通过', '证件与账户信息核验完成', '2026-03-12 14:50'),
      createLog('平台运营-周航', '打印申请单', '已打印结算信息变更申请单', '2026-03-12 15:18'),
      createLog('平台运营-周航', '提交签字附件', '签字附件已上传，转待审核生效', '2026-03-13 09:41'),
      createLog('平台运营-周航', '审核生效', '平台审核通过，结算信息已生效', '2026-03-13 13:26'),
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
    signedFormFiles: [],
    paperArchived: false,
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
      createLog('工厂财务-Edo', '提交申请', '工厂提交结算信息修改申请', '2026-03-11 11:00'),
      createLog(
        '平台运营-陈彦',
        '驳回申请',
        '开户名与证件信息不一致，请补充有效证明后重新提交',
        '2026-03-11 16:20',
      ),
    ],
  },
]

let requestSeq = settlementChangeRequests.length + 1

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

export function getSettlementEffectiveInfos(): SettlementEffectiveInfo[] {
  return settlementEffectiveInfos
}

export function getSettlementChangeRequests(): SettlementChangeRequest[] {
  return settlementChangeRequests
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

export function getSettlementLatestRequestByFactory(factoryId: string): SettlementChangeRequest | null {
  return (
    settlementChangeRequests
      .filter((item) => item.factoryId === factoryId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0] ?? null
  )
}

export function getSettlementActiveRequestByFactory(factoryId: string): SettlementChangeRequest | null {
  return (
    settlementChangeRequests.find(
      (item) => item.factoryId === factoryId && isOpenRequest(item.status),
    ) ?? null
  )
}

export function createSettlementChangeRequest(payload: {
  factoryId: string
  submittedBy: string
  submitRemark: string
  after: SettlementEffectiveInfoSnapshot
}): ActionResult<SettlementChangeRequest> {
  const current = getEffectiveInfoByFactoryOrNull(payload.factoryId)
  if (!current) return { ok: false, message: '未找到当前生效结算信息' }

  const activeRequest = getSettlementActiveRequestByFactory(payload.factoryId)
  if (activeRequest) return { ok: false, message: '当前已有结算信息修改申请处理中' }

  const createdAt = nowText()
  const request: SettlementChangeRequest = {
    requestId: nextRequestId(),
    factoryId: payload.factoryId,
    factoryName: current.factoryName,
    status: 'PENDING_VERIFY',
    submittedAt: createdAt,
    submittedBy: payload.submittedBy,
    submitRemark: payload.submitRemark.trim(),
    verifyRemark: '',
    reviewRemark: '',
    rejectReason: '',
    printedAt: '',
    signedFormFiles: [],
    paperArchived: false,
    effectiveAt: '',
    effectiveBy: '',
    before: {
      accountHolderName: current.accountHolderName,
      idNumber: current.idNumber,
      bankName: current.bankName,
      bankAccountNo: current.bankAccountNo,
      bankBranch: current.bankBranch,
    },
    after: payload.after,
    logs: [],
  }

  pushRequestLog(
    request,
    payload.submittedBy,
    '提交申请',
    `工厂提交结算信息修改申请（变更项：${summarizeChangedFields(request.before, request.after)}）`,
  )

  settlementChangeRequests.unshift(request)
  return { ok: true, message: '修改申请已提交，等待平台核实', data: request }
}

export function verifySettlementRequest(
  requestId: string,
  operator: string,
  remark: string,
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  if (request.status !== 'PENDING_VERIFY') return { ok: false, message: '当前状态不可执行核实通过' }

  request.status = 'WAIT_SIGNED_FORM'
  request.verifyRemark = remark.trim()
  pushRequestLog(request, operator, '核实通过', remark.trim() || '证件与账户信息核验通过')
  return { ok: true, message: '已核实通过，等待签字回传', data: request }
}

export function markSettlementRequestPrinted(
  requestId: string,
  operator: string,
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  if (request.status !== 'WAIT_SIGNED_FORM') return { ok: false, message: '当前状态不可打印申请单' }

  request.printedAt = nowText()
  pushRequestLog(request, operator, '打印申请单', '已打印结算信息变更申请单')
  return { ok: true, message: '已打开打印预览', data: request }
}

export function uploadSettlementSignedForm(
  requestId: string,
  operator: string,
  fileType: 'IMAGE' | 'VIDEO',
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  if (request.status !== 'WAIT_SIGNED_FORM') return { ok: false, message: '当前状态不可上传签字附件' }

  const nextIndex = request.signedFormFiles.length + 1
  const ext = fileType === 'IMAGE' ? 'jpg' : 'mp4'
  request.signedFormFiles.push({
    id: `FILE-${request.requestId}-${nextIndex}`,
    name: `签字申请附件-${nextIndex}.${ext}`,
    fileType,
    uploadedAt: nowText(),
    uploadedBy: operator,
  })
  pushRequestLog(request, operator, '上传签字附件', `新增${fileType === 'IMAGE' ? '图片' : '视频'}附件 1 份`)
  return { ok: true, message: '签字附件已上传', data: request }
}

export function submitSettlementSignedForms(
  requestId: string,
  operator: string,
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  if (request.status !== 'WAIT_SIGNED_FORM') return { ok: false, message: '当前状态不可提交签字附件' }
  if (request.signedFormFiles.length === 0) return { ok: false, message: '请先上传签字申请附件' }

  request.status = 'WAIT_APPROVAL'
  pushRequestLog(request, operator, '提交签字附件', '签字附件齐全，进入待审核生效')
  return { ok: true, message: '签字附件已提交，等待审核生效', data: request }
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
  if (request.status !== 'WAIT_APPROVAL') return { ok: false, message: '当前状态不可审核生效' }
  if (request.signedFormFiles.length === 0) return { ok: false, message: '请先上传签字申请附件' }
  if (!request.paperArchived) return { ok: false, message: '请确认纸质文件已留档' }

  const current = getEffectiveInfoByFactoryOrNull(request.factoryId)
  if (!current) return { ok: false, message: '未找到当前生效信息' }

  current.accountHolderName = request.after.accountHolderName
  current.idNumber = request.after.idNumber
  current.bankName = request.after.bankName
  current.bankAccountNo = request.after.bankAccountNo
  current.bankBranch = request.after.bankBranch
  current.effectiveAt = nowText()
  current.updatedBy = operator

  request.status = 'EFFECTIVE'
  request.effectiveAt = current.effectiveAt
  request.effectiveBy = operator
  request.reviewRemark = reviewRemark.trim()
  pushRequestLog(
    request,
    operator,
    '审核生效',
    reviewRemark.trim() || '平台审核通过，结算信息已生效',
  )

  return { ok: true, message: '审核生效完成，当前生效信息已更新', data: request }
}

export function rejectSettlementRequest(
  requestId: string,
  operator: string,
  rejectReason: string,
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  if (request.status !== 'PENDING_VERIFY' && request.status !== 'WAIT_APPROVAL') {
    return { ok: false, message: '当前状态不可驳回' }
  }
  if (!rejectReason.trim()) return { ok: false, message: '请填写驳回原因' }

  request.status = 'REJECTED'
  request.rejectReason = rejectReason.trim()
  pushRequestLog(request, operator, '驳回申请', rejectReason.trim())
  return { ok: true, message: '申请已驳回', data: request }
}

export function followupSettlementRequest(
  requestId: string,
  operator: string,
  followupRemark: string,
): ActionResult<SettlementChangeRequest> {
  const request = getRequestByIdOrNull(requestId)
  if (!request) return { ok: false, message: '申请不存在' }
  if (request.status !== 'WAIT_APPROVAL') return { ok: false, message: '当前状态不可记录跟进' }

  pushRequestLog(request, operator, '记录跟进', followupRemark.trim() || '平台已记录跟进')
  request.reviewRemark = followupRemark.trim()
  return { ok: true, message: '已记录跟进', data: request }
}
