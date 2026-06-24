import { listProjectInlineNodeRecordsByWorkItemType } from './pcs-project-inline-node-record-repository.ts'

export type PcsSampleStatus =
  | '在库可用'
  | '预占锁定'
  | '借出占用'
  | '在途待签收'
  | '维修中'
  | '待处置'
  | '已退货'
  | '已处置'

export type PcsSampleAvailability = '可申请' | '需审批' | '不可申请'

export interface PcsSampleTransitInfo {
  from: string
  to: string
  carrier: string
  trackingNo: string
  eta: string
  transitSlaHours: number
  transitStartedAt: string
}

export interface PcsSampleAnomalyInfo {
  type: string
  level: '高' | '中' | '低'
  since: string
  note: string
}

export interface PcsSampleRecord {
  sampleId: string
  sampleCode: string
  name: string
  imageUrl: string
  category: string
  size: string
  color: string
  material: string
  templateType: string
  projectId: string
  projectCode: string
  projectName: string
  relatedWorkItemName: string
  status: PcsSampleStatus
  availability: PcsSampleAvailability
  responsibleSite: '深圳样衣间' | '雅加达样衣间'
  currentLocation: string
  locationDetail: string
  occupancyType: '无' | '预占' | '占用'
  occupiedBy: string
  occupiedFor: string
  occupiedUntil: string
  transit: PcsSampleTransitInfo | null
  anomaly: PcsSampleAnomalyInfo | null
  updatedAt: string
  updatedBy: string
}

export type PcsSampleRequestStatus =
  | '草稿'
  | '待审批'
  | '已批准待领用'
  | '使用中'
  | '归还中'
  | '已完成'
  | '已驳回'
  | '已取消'

export interface PcsSampleUseRequest {
  requestId: string
  requestCode: string
  status: PcsSampleRequestStatus
  responsibleSite: '深圳样衣间' | '雅加达样衣间'
  sampleIds: string[]
  projectCode: string
  projectName: string
  workItemName: string
  purpose: string
  applicant: string
  approver: string
  keeper: string
  expectedReturnAt: string
  appliedAt: string
  updatedAt: string
  returnRequestedAt: string
  timeline: Array<{ time: string; action: string; operator: string; remark?: string }>
}

export type PcsSampleTransferCategory = '站点调拨' | '借用流转' | '归还入库' | '退货流转' | '维修流转'
export type PcsSampleTransferEventType = '出库' | '在途' | '签收' | '借出' | '归还'

export interface PcsSampleTransferRecord {
  transferId: string
  time: string
  sampleId: string
  sampleCode: string
  sampleName: string
  transferCategory: PcsSampleTransferCategory
  eventType: PcsSampleTransferEventType
  fromEntity: string
  toEntity: string
  responsibleSite: '深圳样衣间' | '雅加达样衣间'
  trackingNo: string
  carrier: string
  projectCode: string
  operator: string
  riskFlags: string[]
  remark: string
}

export type PcsSampleReturnCaseType = '退货' | '处置'
export type PcsSampleReturnCaseStatus = '待审批' | '待执行' | '执行中' | '已结案' | '已驳回'

export interface PcsSampleReturnCase {
  caseId: string
  caseCode: string
  caseType: PcsSampleReturnCaseType
  status: PcsSampleReturnCaseStatus
  responsibleSite: '深圳样衣间' | '雅加达样衣间'
  sampleId: string
  sampleCode: string
  sampleName: string
  sampleImageUrl: string
  inventoryStatusSnapshot: PcsSampleStatus
  reasonCategory: string
  reasonText: string
  projectCode: string
  initiatedBy: string
  acceptedBy: string
  returnTarget: string
  returnMethod: string
  dispositionResult: string
  updatedAt: string
  riskFlag: string
  timeline: Array<{ time: string; action: string; operator: string; remark?: string }>
}

export type PcsSampleLedgerEventType =
  | '入库'
  | '出库'
  | '在途'
  | '签收'
  | '借出'
  | '归还'
  | '预占'
  | '释放'
  | '退货'
  | '处置'
  | '盘点调整'

export interface PcsSampleLedgerEvent {
  eventId: string
  time: string
  site: '深圳样衣间' | '雅加达样衣间'
  sampleId: string
  sampleCode: string
  sampleName: string
  eventType: PcsSampleLedgerEventType
  summary: string
  fromLocation: string
  toLocation: string
  holder: string
  sourceDoc: string
  projectCode: string
  workItemName: string
  operator: string
  isVoided: boolean
  remark: string
}

export type PcsSampleStocktakeDiffStatus = '待确认' | '处理中' | '已调整' | '已关闭'

export interface PcsSampleStocktakeDiff {
  diffId: string
  stocktakeCode: string
  sampleId: string
  sampleCode: string
  sampleName: string
  site: '深圳样衣间' | '雅加达样衣间'
  systemQty: number
  countedQty: number
  diffQty: number
  diffType: '短缺' | '盈余'
  status: PcsSampleStocktakeDiffStatus
  owner: string
  discoveredAt: string
  reason: string
  nextAction: string
}

export const PCS_SAMPLE_RECORDS: PcsSampleRecord[] = [
  {
    sampleId: 'smp-001',
    sampleCode: 'SY-INA-001',
    name: '印尼碎花连衣裙-P1A1',
    imageUrl: '/dress-sample-1.jpg',
    category: '裙装',
    size: 'M',
    color: '红色碎花',
    material: '雪纺',
    templateType: '基础款',
    projectId: 'pcs-project-first-sample-complete',
    projectCode: 'PRJ-202604-001',
    projectName: '印度尼西亚碎花连衣裙',
    relatedWorkItemName: '直播测款拍摄',
    status: '在库可用',
    availability: '可申请',
    responsibleSite: '深圳样衣间',
    currentLocation: '深圳仓',
    locationDetail: '样衣仓 A-02-15',
    occupancyType: '无',
    occupiedBy: '',
    occupiedFor: '',
    occupiedUntil: '',
    transit: null,
    anomaly: null,
    updatedAt: '2026-04-10 10:20',
    updatedBy: '李仓管',
  },
  {
    sampleId: 'smp-002',
    sampleCode: 'SY-INA-002',
    name: '基础白色 T 恤-白-M',
    imageUrl: '/tshirt-sample.jpg',
    category: '上衣',
    size: 'M',
    color: '白色',
    material: '棉',
    templateType: '快反款',
    projectId: 'pcs-project-sample-created',
    projectCode: 'PRJ-202604-002',
    projectName: '夏季基础白 T',
    relatedWorkItemName: '达人试穿',
    status: '预占锁定',
    availability: '不可申请',
    responsibleSite: '深圳样衣间',
    currentLocation: '深圳仓',
    locationDetail: '样衣仓 B-01-03',
    occupancyType: '预占',
    occupiedBy: '张丽',
    occupiedFor: '短视频拍摄',
    occupiedUntil: '2026-04-14',
    transit: null,
    anomaly: null,
    updatedAt: '2026-04-11 09:10',
    updatedBy: '系统',
  },
  {
    sampleId: 'smp-003',
    sampleCode: 'SY-INA-003',
    name: '牛仔短裤工程样-S',
    imageUrl: '/denim-shorts-sample.jpg',
    category: '裤装',
    size: 'S',
    color: '牛仔蓝',
    material: '牛仔布',
    templateType: '改版款',
    projectId: 'pcs-project-first-order-created',
    projectCode: 'PRJ-202604-003',
    projectName: '腰围放量牛仔短裤',
    relatedWorkItemName: '首单样衣打样',
    status: '借出占用',
    availability: '需审批',
    responsibleSite: '深圳样衣间',
    currentLocation: '摄影棚',
    locationDetail: '摄影棚 B-2',
    occupancyType: '占用',
    occupiedBy: '王芳',
    occupiedFor: '模特拍摄',
    occupiedUntil: '2026-04-09',
    transit: null,
    anomaly: {
      type: '归还超期',
      level: '中',
      since: '2026-04-10 00:00',
      note: '已超过预计归还时间 1 天，需要催还。',
    },
    updatedAt: '2026-04-10 18:30',
    updatedBy: '王芳',
  },
  {
    sampleId: 'smp-004',
    sampleCode: 'SY-INA-004',
    name: '办公室衬衫样衣-L',
    imageUrl: '/shirt-sample.jpg',
    category: '上衣',
    size: 'L',
    color: '浅蓝',
    material: '混纺',
    templateType: '设计款',
    projectId: 'pcs-project-first-order-wait',
    projectCode: 'PRJ-202604-004',
    projectName: '通勤办公室衬衫',
    relatedWorkItemName: '雅加达直播备样',
    status: '在途待签收',
    availability: '不可申请',
    responsibleSite: '雅加达样衣间',
    currentLocation: '在途',
    locationDetail: '深圳仓 → 雅加达直播间',
    occupancyType: '无',
    occupiedBy: '',
    occupiedFor: '',
    occupiedUntil: '',
    transit: {
      from: '深圳仓',
      to: '雅加达直播间',
      carrier: '顺丰国际',
      trackingNo: 'SF100000004',
      eta: '2026-04-12',
      transitSlaHours: 48,
      transitStartedAt: '2026-04-09 08:00',
    },
    anomaly: {
      type: '在途超时',
      level: '高',
      since: '2026-04-11 08:00',
      note: '已超过跨境在途 SLA 48 小时。',
    },
    updatedAt: '2026-04-11 11:40',
    updatedBy: '物流系统',
  },
  {
    sampleId: 'smp-006',
    sampleCode: 'SY-INA-006',
    name: '米色针织开衫-F',
    imageUrl: '/cardigan-sample.jpg',
    category: '外套',
    size: 'F',
    color: '米色',
    material: '针织',
    templateType: '基础款',
    projectId: 'pcs-project-style-ready',
    projectCode: 'PRJ-202604-006',
    projectName: '轻薄针织开衫',
    relatedWorkItemName: '直播间备样',
    status: '维修中',
    availability: '不可申请',
    responsibleSite: '雅加达样衣间',
    currentLocation: '雅加达样衣间',
    locationDetail: '维修篮 JKT-02',
    occupancyType: '无',
    occupiedBy: '',
    occupiedFor: '',
    occupiedUntil: '',
    transit: null,
    anomaly: {
      type: '破损',
      level: '中',
      since: '2026-04-08 10:10',
      note: '袖口开线，等待修补后恢复可用。',
    },
    updatedAt: '2026-04-09 12:30',
    updatedBy: 'Budi',
  },
  {
    sampleId: 'smp-007',
    sampleCode: 'SY-INA-007',
    name: '蕾丝拼接连衣裙-S',
    imageUrl: '/lace-dress-sample.jpg',
    category: '裙装',
    size: 'S',
    color: '白色',
    material: '蕾丝',
    templateType: '设计款',
    projectId: 'pcs-project-channel-ready',
    projectCode: 'PRJ-202604-007',
    projectName: '白色蕾丝连衣裙',
    relatedWorkItemName: '渠道商品图补拍',
    status: '借出占用',
    availability: '需审批',
    responsibleSite: '雅加达样衣间',
    currentLocation: '雅加达直播间',
    locationDetail: '直播间 RACK-03',
    occupancyType: '占用',
    occupiedBy: '林小红',
    occupiedFor: '直播讲解',
    occupiedUntil: '2026-04-13',
    transit: null,
    anomaly: null,
    updatedAt: '2026-04-11 14:00',
    updatedBy: '林小红',
  },
]

export const PCS_SAMPLE_REQUESTS: PcsSampleUseRequest[] = [
  {
    requestId: 'req-001',
    requestCode: 'UR-202604-001',
    status: '已批准待领用',
    responsibleSite: '深圳样衣间',
    sampleIds: ['smp-001', 'smp-002'],
    projectCode: 'PRJ-202604-001',
    projectName: '印度尼西亚碎花连衣裙',
    workItemName: '直播测款拍摄',
    purpose: '拍摄主图与直播讲解素材',
    applicant: '张丽',
    approver: '陈明',
    keeper: '李仓管',
    expectedReturnAt: '2026-04-14 18:00',
    appliedAt: '2026-04-11 09:30',
    updatedAt: '2026-04-11 10:20',
    returnRequestedAt: '',
    timeline: [
      { time: '2026-04-11 10:20', action: '审批通过', operator: '陈明', remark: '样衣已预占锁定，等待仓管交接。' },
      { time: '2026-04-11 09:30', action: '提交申请', operator: '张丽' },
    ],
  },
  {
    requestId: 'req-002',
    requestCode: 'UR-202604-002',
    status: '使用中',
    responsibleSite: '雅加达样衣间',
    sampleIds: ['smp-007'],
    projectCode: 'PRJ-202604-007',
    projectName: '白色蕾丝连衣裙',
    workItemName: '直播间备样',
    purpose: '直播间讲解与试穿',
    applicant: '林小红',
    approver: 'Budi',
    keeper: 'Budi',
    expectedReturnAt: '2026-04-13 21:00',
    appliedAt: '2026-04-10 15:00',
    updatedAt: '2026-04-11 14:00',
    returnRequestedAt: '',
    timeline: [
      { time: '2026-04-11 14:00', action: '确认领用', operator: 'Budi' },
      { time: '2026-04-10 16:00', action: '审批通过', operator: 'Budi' },
      { time: '2026-04-10 15:00', action: '提交申请', operator: '林小红' },
    ],
  },
  {
    requestId: 'req-003',
    requestCode: 'UR-202604-003',
    status: '归还中',
    responsibleSite: '深圳样衣间',
    sampleIds: ['smp-003'],
    projectCode: 'PRJ-202604-003',
    projectName: '腰围放量牛仔短裤',
    workItemName: '模特拍摄',
    purpose: '工程样成衣图补拍',
    applicant: '王芳',
    approver: '陈明',
    keeper: '李仓管',
    expectedReturnAt: '2026-04-09 18:00',
    appliedAt: '2026-04-08 10:30',
    updatedAt: '2026-04-10 18:30',
    returnRequestedAt: '2026-04-10 18:30',
    timeline: [
      { time: '2026-04-10 18:30', action: '发起归还', operator: '王芳', remark: '已打包等待仓管确认入库。' },
      { time: '2026-04-08 13:00', action: '确认领用', operator: '李仓管' },
      { time: '2026-04-08 10:30', action: '提交申请', operator: '王芳' },
    ],
  },
  {
    requestId: 'req-004',
    requestCode: 'UR-202604-004',
    status: '待审批',
    responsibleSite: '雅加达样衣间',
    sampleIds: ['smp-006'],
    projectCode: 'PRJ-202604-006',
    projectName: '轻薄针织开衫',
    workItemName: '直播补样',
    purpose: '修复后补拍直播细节',
    applicant: '周杰',
    approver: 'Budi',
    keeper: 'Budi',
    expectedReturnAt: '2026-04-15 18:00',
    appliedAt: '2026-04-11 11:10',
    updatedAt: '2026-04-11 11:10',
    returnRequestedAt: '',
    timeline: [{ time: '2026-04-11 11:10', action: '提交申请', operator: '周杰' }],
  },
]

export const PCS_SAMPLE_TRANSFERS: PcsSampleTransferRecord[] = [
  {
    transferId: 'tr-001',
    time: '2026-04-11 11:40',
    sampleId: 'smp-004',
    sampleCode: 'SY-INA-004',
    sampleName: '办公室衬衫样衣-L',
    transferCategory: '站点调拨',
    eventType: '在途',
    fromEntity: '深圳仓',
    toEntity: '雅加达直播间',
    responsibleSite: '雅加达样衣间',
    trackingNo: 'SF100000004',
    carrier: '顺丰国际',
    projectCode: 'PRJ-202604-004',
    operator: '物流系统',
    riskFlags: ['在途超时'],
    remark: '跨境在途已超过 SLA，需要跟进清关节点。',
  },
  {
    transferId: 'tr-002',
    time: '2026-04-11 14:00',
    sampleId: 'smp-007',
    sampleCode: 'SY-INA-007',
    sampleName: '蕾丝拼接连衣裙-S',
    transferCategory: '借用流转',
    eventType: '借出',
    fromEntity: '雅加达样衣间',
    toEntity: '林小红',
    responsibleSite: '雅加达样衣间',
    trackingNo: '',
    carrier: '',
    projectCode: 'PRJ-202604-007',
    operator: 'Budi',
    riskFlags: [],
    remark: '直播间借出，预计 4 月 13 日归还。',
  },
  {
    transferId: 'tr-003',
    time: '2026-04-10 18:30',
    sampleId: 'smp-003',
    sampleCode: 'SY-INA-003',
    sampleName: '牛仔短裤工程样-S',
    transferCategory: '归还入库',
    eventType: '归还',
    fromEntity: '摄影棚 B-2',
    toEntity: '深圳样衣间待验收',
    responsibleSite: '深圳样衣间',
    trackingNo: '',
    carrier: '',
    projectCode: 'PRJ-202604-003',
    operator: '王芳',
    riskFlags: ['归还超期'],
    remark: '等待仓管确认归还入库。',
  },
  {
    transferId: 'tr-005',
    time: '2026-04-09 12:30',
    sampleId: 'smp-006',
    sampleCode: 'SY-INA-006',
    sampleName: '米色针织开衫-F',
    transferCategory: '维修流转',
    eventType: '出库',
    fromEntity: '雅加达样衣间',
    toEntity: '维修篮 JKT-02',
    responsibleSite: '雅加达样衣间',
    trackingNo: '',
    carrier: '',
    projectCode: 'PRJ-202604-006',
    operator: 'Budi',
    riskFlags: ['破损'],
    remark: '袖口开线，转维修篮处理。',
  },
]

export const PCS_SAMPLE_RETURN_CASES: PcsSampleReturnCase[] = []

export const PCS_SAMPLE_LEDGER_EVENTS: PcsSampleLedgerEvent[] = [
  {
    eventId: 'lg-001',
    time: '2026-04-11 14:00',
    site: '雅加达样衣间',
    sampleId: 'smp-007',
    sampleCode: 'SY-INA-007',
    sampleName: '蕾丝拼接连衣裙-S',
    eventType: '借出',
    summary: '样衣借出给直播间使用',
    fromLocation: '雅加达样衣间',
    toLocation: '雅加达直播间',
    holder: '林小红',
    sourceDoc: 'UR-202604-002',
    projectCode: 'PRJ-202604-007',
    workItemName: '直播间备样',
    operator: 'Budi',
    isVoided: false,
    remark: '预计 4 月 13 日归还。',
  },
  {
    eventId: 'lg-002',
    time: '2026-04-11 11:40',
    site: '雅加达样衣间',
    sampleId: 'smp-004',
    sampleCode: 'SY-INA-004',
    sampleName: '办公室衬衫样衣-L',
    eventType: '在途',
    summary: '深圳仓调拨至雅加达直播间',
    fromLocation: '深圳仓',
    toLocation: '雅加达直播间',
    holder: '顺丰国际',
    sourceDoc: 'TR-202604-001',
    projectCode: 'PRJ-202604-004',
    workItemName: '雅加达直播备样',
    operator: '物流系统',
    isVoided: false,
    remark: '跨境调拨在途。',
  },
  {
    eventId: 'lg-003',
    time: '2026-04-11 10:20',
    site: '深圳样衣间',
    sampleId: 'smp-002',
    sampleCode: 'SY-INA-002',
    sampleName: '基础白色 T 恤-白-M',
    eventType: '预占',
    summary: '申请审批通过后预占锁定',
    fromLocation: '样衣仓 B-01-03',
    toLocation: '样衣仓 B-01-03',
    holder: '张丽',
    sourceDoc: 'UR-202604-001',
    projectCode: 'PRJ-202604-002',
    workItemName: '短视频拍摄',
    operator: '陈明',
    isVoided: false,
    remark: '等待仓管确认领用。',
  },
  {
    eventId: 'lg-004',
    time: '2026-04-10 18:30',
    site: '深圳样衣间',
    sampleId: 'smp-003',
    sampleCode: 'SY-INA-003',
    sampleName: '牛仔短裤工程样-S',
    eventType: '归还',
    summary: '借用人发起归还',
    fromLocation: '摄影棚 B-2',
    toLocation: '深圳样衣间待验收',
    holder: '王芳',
    sourceDoc: 'UR-202604-003',
    projectCode: 'PRJ-202604-003',
    workItemName: '模特拍摄',
    operator: '王芳',
    isVoided: false,
    remark: '待仓管验收。',
  },
]

export const PCS_SAMPLE_STOCKTAKE_DIFFS: PcsSampleStocktakeDiff[] = [
  {
    diffId: 'diff-001',
    stocktakeCode: 'ST-202604-001',
    sampleId: 'smp-003',
    sampleCode: 'SY-INA-003',
    sampleName: '牛仔短裤工程样-S',
    site: '深圳样衣间',
    systemQty: 1,
    countedQty: 0,
    diffQty: -1,
    diffType: '短缺',
    status: '处理中',
    owner: '李仓管',
    discoveredAt: '2026-04-11 09:20',
    reason: '样衣处于归还中，实物尚未验收入库。',
    nextAction: '联系借用人并完成归还确认。',
  },
  {
    diffId: 'diff-002',
    stocktakeCode: 'ST-202604-001',
    sampleId: 'smp-004',
    sampleCode: 'SY-INA-004',
    sampleName: '办公室衬衫样衣-L',
    site: '雅加达样衣间',
    systemQty: 1,
    countedQty: 0,
    diffQty: -1,
    diffType: '短缺',
    status: '待确认',
    owner: 'Budi',
    discoveredAt: '2026-04-11 09:40',
    reason: '系统显示在途待签收，站点尚未实盘到货。',
    nextAction: '跟进跨境物流签收。',
  },
  {
    diffId: 'diff-003',
    stocktakeCode: 'ST-202604-002',
    sampleId: 'smp-001',
    sampleCode: 'SY-INA-001',
    sampleName: '印尼碎花连衣裙-P1A1',
    site: '深圳样衣间',
    systemQty: 1,
    countedQty: 2,
    diffQty: 1,
    diffType: '盈余',
    status: '已调整',
    owner: '李仓管',
    discoveredAt: '2026-04-10 17:20',
    reason: '历史副本未建档。',
    nextAction: '已补录副本并写入盘点调整事件。',
  },
]

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(/[、,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function getSampleAssetText(asset: unknown, key: string): string {
  if (!asset || typeof asset !== 'object') return ''
  const value = (asset as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

function buildGeneratedSampleRecords(): PcsSampleRecord[] {
  return listProjectInlineNodeRecordsByWorkItemType('SAMPLE_INBOUND_CHECK').flatMap((record) => {
    const payload = record.payload as Record<string, unknown>
    const detailSnapshot = record.detailSnapshot as Record<string, unknown>
    const generatedCodes = asStringArray(payload.generatedSampleCodes).length > 0
      ? asStringArray(payload.generatedSampleCodes)
      : asStringArray(detailSnapshot.sampleIds)
    const sampleAssets = Array.isArray(detailSnapshot.sampleAssets) ? detailSnapshot.sampleAssets : []
    const sourceLines = asStringArray(payload.sampleInboundLines)
    const qualityCheckResult = String(payload.qualityCheckResult || '').trim()
    const isCompleteInbound = qualityCheckResult === '通过' || qualityCheckResult === '到样完整'
    const isPendingSupplement = qualityCheckResult === '待补齐'

    return generatedCodes.map((sampleCode, index) => {
      const asset = sampleAssets[index]
      const sourceLine = getSampleAssetText(asset, 'sourceLine') || sourceLines[index] || sourceLines[0] || '到样实物'
      const specText = getSampleAssetText(asset, 'specText') || sourceLine
      const colorName = getSampleAssetText(asset, 'colorName') || '-'
      const sizeName = getSampleAssetText(asset, 'sizeName') || '-'
      const imageUrl = getSampleAssetText(asset, 'imageUrl') || `https://placehold.co/96x128?text=${encodeURIComponent(sampleCode)}`

      return {
        sampleId: `project-${record.recordId}-${sampleCode}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        sampleCode,
        name: `${record.projectName} · ${specText}`,
        imageUrl,
        category: '项目样衣',
        size: sizeName,
        color: colorName,
        material: '待补充',
        templateType: '商品项目到样',
        projectId: record.projectId,
        projectCode: record.projectCode,
        projectName: record.projectName,
        relatedWorkItemName: record.workItemTypeName || '样衣结果核对',
        status: isPendingSupplement ? '在途待签收' : '在库可用',
        availability: isCompleteInbound ? '可申请' : '需审批',
        responsibleSite: '深圳样衣间',
        currentLocation: String(detailSnapshot.warehouseLocation || '深圳样衣间'),
        locationDetail: `由${record.projectCode}样衣结果核对生成`,
        occupancyType: '无',
        occupiedBy: '',
        occupiedFor: '',
        occupiedUntil: '',
        transit: null,
        anomaly: qualityCheckResult === '到样有差异' || qualityCheckResult === '待补齐' || qualityCheckResult === '不通过'
          ? { type: '到样差异', level: '中', since: record.businessDate, note: String(payload.checkResult || '样衣结果核对存在差异') }
          : null,
        updatedAt: record.updatedAt || record.businessDate,
        updatedBy: record.updatedBy || record.ownerName,
      } satisfies PcsSampleRecord
    })
  })
}

function getReturnHandlePayload(record: ReturnType<typeof listProjectInlineNodeRecordsByWorkItemType>[number]): Record<string, unknown> {
  return {
    ...((record.detailSnapshot || {}) as Record<string, unknown>),
    ...((record.payload || {}) as Record<string, unknown>),
  }
}

function isCompletedReturnHandleStatus(recordStatus: string): boolean {
  return recordStatus === '已完成'
}

function getReturnHandleCaseStatus(recordStatus: string): PcsSampleReturnCaseStatus {
  if (isCompletedReturnHandleStatus(recordStatus)) return '已结案'
  if (recordStatus === '待补充') return '待执行'
  return '执行中'
}

function getReturnHandleCaseType(handleType: string): PcsSampleReturnCaseType {
  return handleType === '退样' || handleType === '寄回' ? '退货' : '处置'
}

function getReturnHandleLedgerEventType(handleType: string): PcsSampleLedgerEventType {
  if (handleType === '退样' || handleType === '寄回') return '退货'
  if (handleType === '入库留样') return '入库'
  return '处置'
}

function getReturnHandledSampleStatus(recordStatus: string, handleType: string, fallback: PcsSampleStatus): PcsSampleStatus {
  if (!isCompletedReturnHandleStatus(recordStatus)) return '待处置'
  if (handleType === '退样' || handleType === '寄回') return '已退货'
  if (handleType === '入库留样') return '在库可用'
  if (handleType === '清仓处理' || handleType === '报废处理') return '已处置'
  return fallback
}

function getReturnHandledAvailability(status: PcsSampleStatus): PcsSampleAvailability {
  return status === '在库可用' ? '可申请' : '不可申请'
}

function listBasePcsSampleRecords(): PcsSampleRecord[] {
  return [...buildGeneratedSampleRecords(), ...PCS_SAMPLE_RECORDS]
}

function applyReturnHandleStatusToSamples(samples: PcsSampleRecord[]): PcsSampleRecord[] {
  const latestBySampleCode = new Map<string, ReturnType<typeof listProjectInlineNodeRecordsByWorkItemType>[number]>()
  listProjectInlineNodeRecordsByWorkItemType('SAMPLE_RETURN_HANDLE').forEach((record) => {
    const payload = getReturnHandlePayload(record)
    const sampleCode = String(payload.sampleCode || '').trim()
    if (!sampleCode) return
    const existing = latestBySampleCode.get(sampleCode)
    if (!existing || `${record.updatedAt} ${record.recordCode}`.localeCompare(`${existing.updatedAt} ${existing.recordCode}`) > 0) {
      latestBySampleCode.set(sampleCode, record)
    }
  })

  return samples.map((sample) => {
    const latestReturn = latestBySampleCode.get(sample.sampleCode)
    if (!latestReturn) return sample
    const payload = getReturnHandlePayload(latestReturn)
    const handleType = String(payload.handleType || '').trim()
    const destination = String(payload.destination || payload.returnAddress || payload.returnRecipient || '').trim()
    const returnResult = String(payload.returnResult || '').trim()
    const nextStatus = getReturnHandledSampleStatus(latestReturn.recordStatus, handleType, sample.status)
    const completed = isCompletedReturnHandleStatus(latestReturn.recordStatus)
    return {
      ...sample,
      status: nextStatus,
      availability: getReturnHandledAvailability(nextStatus),
      currentLocation:
        nextStatus === '已退货'
          ? destination || '已退回'
          : nextStatus === '已处置'
            ? destination || '已处置'
            : nextStatus === '在库可用'
              ? destination || sample.currentLocation
              : '样衣退回处理待执行',
      locationDetail: `${latestReturn.recordCode} · ${handleType || '退回处理'}${returnResult ? ` · ${returnResult}` : ''}`,
      anomaly: completed
        ? null
        : {
            type: '退回处理待执行',
            level: '中',
            since: latestReturn.businessDate,
            note: returnResult || '样衣退回处理记录尚未完成。',
          },
      updatedAt: latestReturn.updatedAt || latestReturn.businessDate,
      updatedBy: latestReturn.updatedBy || latestReturn.ownerName,
    }
  })
}

function findBaseSampleByCode(sampleCode: string): PcsSampleRecord | null {
  return listBasePcsSampleRecords().find((item) => item.sampleCode === sampleCode || item.sampleId === sampleCode) ?? null
}

function buildGeneratedSampleReturnCases(): PcsSampleReturnCase[] {
  return listProjectInlineNodeRecordsByWorkItemType('SAMPLE_RETURN_HANDLE').map((record) => {
    const payload = getReturnHandlePayload(record)
    const handleType = String(payload.handleType || '').trim()
    const sampleCode = String(payload.sampleCode || '').trim()
    const sample = sampleCode ? findBaseSampleByCode(sampleCode) : null
    const caseType = getReturnHandleCaseType(handleType)
    const destination = String(payload.destination || '').trim()
    const returnRecipient = String(payload.returnRecipient || '').trim()
    const returnAddress = String(payload.returnAddress || '').trim()
    const returnResult = String(payload.returnResult || '').trim()
    const operator = String(payload.handledBy || record.updatedBy || record.ownerName || '').trim()
    const caseCode = String(payload.returnDocCode || record.recordCode).trim()
    const status = getReturnHandleCaseStatus(record.recordStatus)
    return {
      caseId: `project-${record.recordId}`,
      caseCode,
      caseType,
      status,
      responsibleSite: sample?.responsibleSite || '深圳样衣间',
      sampleId: sample?.sampleId || sampleCode || record.recordId,
      sampleCode: sampleCode || '-',
      sampleName: sample?.name || record.projectName,
      sampleImageUrl: sample?.imageUrl || `https://placehold.co/96x128?text=${encodeURIComponent(sampleCode || record.projectCode)}`,
      inventoryStatusSnapshot: getReturnHandledSampleStatus(record.recordStatus, handleType, sample?.status || '待处置'),
      reasonCategory: handleType || '退回处理',
      reasonText: returnResult || `项目 ${record.projectName} 收尾阶段登记样衣退回或处置结果。`,
      projectCode: record.projectCode,
      initiatedBy: record.createdBy || record.ownerName,
      acceptedBy: operator || record.ownerName,
      returnTarget: destination || returnRecipient || returnAddress,
      returnMethod: caseType === '退货' ? handleType || '退货' : '',
      dispositionResult: caseType === '处置' ? returnResult : '',
      updatedAt: record.updatedAt || record.businessDate,
      riskFlag: ['报废处理', '清仓处理'].includes(handleType) || status !== '已结案' ? '中风险' : '',
      timeline: [
        { time: record.createdAt || record.businessDate, action: '登记退回处理', operator: record.createdBy || record.ownerName },
        ...(status === '已结案'
          ? [{ time: record.updatedAt || record.businessDate, action: '结案', operator: operator || record.updatedBy || record.ownerName, remark: returnResult }]
          : []),
      ],
    }
  })
}

function buildGeneratedSampleLedgerEvents(): PcsSampleLedgerEvent[] {
  return listProjectInlineNodeRecordsByWorkItemType('SAMPLE_RETURN_HANDLE')
    .filter((record) => isCompletedReturnHandleStatus(record.recordStatus))
    .map((record) => {
      const payload = getReturnHandlePayload(record)
      const handleType = String(payload.handleType || '').trim()
      const sampleCode = String(payload.sampleCode || '').trim()
      const sample = sampleCode ? findBaseSampleByCode(sampleCode) : null
      const destination = String(payload.destination || payload.returnAddress || payload.returnRecipient || '').trim()
      const operator = String(payload.handledBy || record.updatedBy || record.ownerName || '').trim()
      const sourceDoc = String(payload.returnDocCode || record.recordCode).trim()
      const eventType = getReturnHandleLedgerEventType(handleType)
      return {
        eventId: `lg-${record.recordId}`,
        time: String(payload.handledAt || record.businessDate || record.updatedAt),
        site: sample?.responsibleSite || '深圳样衣间',
        sampleId: sample?.sampleId || sampleCode || record.recordId,
        sampleCode: sampleCode || '-',
        sampleName: sample?.name || record.projectName,
        eventType,
        summary: `${handleType || '样衣退回处理'}：${String(payload.returnResult || '已完成处理')}`,
        fromLocation: sample?.currentLocation || '商品项目样衣',
        toLocation: destination || (eventType === '退货' ? '退回目标' : eventType === '入库' ? '样衣库存' : '处置完成'),
        holder: String(payload.returnRecipient || operator || destination || '-'),
        sourceDoc,
        projectCode: record.projectCode,
        workItemName: record.workItemTypeName,
        operator: operator || record.updatedBy || record.ownerName,
        isVoided: false,
        remark: String(payload.returnResult || ''),
      }
    })
}

export function listPcsSampleRecords(): PcsSampleRecord[] {
  return applyReturnHandleStatusToSamples(listBasePcsSampleRecords())
}

export function getPcsSampleById(sampleId: string): PcsSampleRecord | null {
  return listPcsSampleRecords().find((item) => item.sampleId === sampleId || item.sampleCode === sampleId) ?? null
}

export function listPcsSampleRequests(): PcsSampleUseRequest[] {
  return [...PCS_SAMPLE_REQUESTS]
}

export function listPcsSampleTransfers(): PcsSampleTransferRecord[] {
  return [...PCS_SAMPLE_TRANSFERS]
}

export function listPcsSampleReturnCases(): PcsSampleReturnCase[] {
  return [...buildGeneratedSampleReturnCases(), ...PCS_SAMPLE_RETURN_CASES]
}

export function listPcsSampleLedgerEvents(): PcsSampleLedgerEvent[] {
  return [...buildGeneratedSampleLedgerEvents(), ...PCS_SAMPLE_LEDGER_EVENTS]
}

export function listPcsSampleStocktakeDiffs(): PcsSampleStocktakeDiff[] {
  return [...PCS_SAMPLE_STOCKTAKE_DIFFS]
}

export function listPcsSampleLedgerEventsBySampleId(sampleId: string): PcsSampleLedgerEvent[] {
  return listPcsSampleLedgerEvents().filter((item) => item.sampleId === sampleId || item.sampleCode === sampleId)
}

export function listPcsSampleRequestsBySampleId(sampleId: string): PcsSampleUseRequest[] {
  return PCS_SAMPLE_REQUESTS.filter((item) => item.sampleIds.includes(sampleId))
}
