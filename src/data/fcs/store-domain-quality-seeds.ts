import type {
  QualityInspection,
  DeductionCandidate,
  DeductionBasisItem,
  AllocationSnapshot,
  AllocationEvent,
  ReturnBatch,
  DyePrintOrder,
} from './store-domain-quality-types'

import type { ProcessTask } from './process-tasks'
import type { ProductionOrder } from './production-orders'

// =============================================
// Quality seed constants
// =============================================

const SEED_AT = '2026-03-01 09:00:00'
const SEED_FACTORY_ID = 'ID-F001'
const SEED_FACTORY_NAME = 'PT. Garment Indonesia I'

// ── initialQualityInspections ────────────────

export const initialQualityInspections: QualityInspection[] = [
  {
    qcId: 'QC-202603-2001', refType: 'TASK', refId: 'TASK-202603-0005-002', productionOrderId: 'PO-202603-0005',
    inspector: '质检员A', inspectedAt: '2026-03-06 17:00:00', result: 'PASS', defectItems: [],
    remark: '首批回货抽检通过', status: 'SUBMITTED', rootCauseType: 'UNKNOWN', liabilityStatus: 'DRAFT',
    auditLogs: [{ id: 'AL-QC-202603-2001-01', action: 'SUBMIT_QC', detail: '提交质检结果 PASS', at: '2026-03-06 17:00:00', by: '质检员A' }],
    createdAt: '2026-03-06 16:30:00', updatedAt: '2026-03-06 17:00:00',
  },
  {
    qcId: 'QC-202603-2002', refType: 'TASK', refId: 'TASK-202603-0006-002', productionOrderId: 'PO-202603-0006',
    inspector: '质检员B', inspectedAt: '2026-03-07 09:30:00', result: 'PASS', defectItems: [],
    remark: '车缝首检已提交，待关闭', status: 'SUBMITTED', rootCauseType: 'UNKNOWN', liabilityStatus: 'DRAFT',
    auditLogs: [{ id: 'AL-QC-202603-2002-01', action: 'SUBMIT_QC', detail: '提交质检结果 PASS', at: '2026-03-07 09:30:00', by: '质检员B' }],
    createdAt: '2026-03-07 09:00:00', updatedAt: '2026-03-07 09:30:00',
  },
  {
    qcId: 'QC-202603-2003', refType: 'TASK', refId: 'TASK-202603-0003-004', productionOrderId: 'PO-202603-0003',
    inspector: '质检员C', inspectedAt: '2026-03-07 15:00:00', result: 'PASS', defectItems: [],
    remark: '终检标准已建，待正式抽检已完成', status: 'DRAFT', rootCauseType: 'UNKNOWN', liabilityStatus: 'DRAFT',
    auditLogs: [],
    createdAt: '2026-03-07 14:30:00', updatedAt: '2026-03-07 14:30:00',
  },
]

// 18 QC seed records — 8 PASS / 10 FAIL
export const QC_SEEDS: QualityInspection[] = [
  // ── PASS 8 条 ──
  { qcId: 'QC-001', refType: 'TASK', refId: 'TASK-0001-001', productionOrderId: 'PO-0001', inspector: '张三', inspectedAt: '2026-02-10 10:00:00', result: 'PASS', defectItems: [], remark: '全检通过', status: 'SUBMITTED', rootCauseType: 'UNKNOWN', liabilityStatus: 'DRAFT', auditLogs: [{ id: 'AL-QC-001-1', action: 'SUBMIT_QC', detail: '提交质检结果 PASS', at: '2026-02-10 10:00:00', by: '张三' }], createdAt: '2026-02-10 09:00:00', updatedAt: '2026-02-10 10:00:00' },
  { qcId: 'QC-002', refType: 'TASK', refId: 'TASK-0001-002', productionOrderId: 'PO-0001', inspector: '李四', inspectedAt: '2026-02-11 10:00:00', result: 'PASS', defectItems: [], remark: '', status: 'SUBMITTED', rootCauseType: 'UNKNOWN', liabilityStatus: 'DRAFT', auditLogs: [{ id: 'AL-QC-002-1', action: 'SUBMIT_QC', detail: '提交质检结果 PASS', at: '2026-02-11 10:00:00', by: '李四' }], createdAt: '2026-02-11 09:00:00', updatedAt: '2026-02-11 10:00:00' },
  { qcId: 'QC-003', refType: 'TASK', refId: 'TASK-0002-001', productionOrderId: 'PO-0002', inspector: '王五', inspectedAt: '2026-02-12 10:00:00', result: 'PASS', defectItems: [], remark: '', status: 'SUBMITTED', rootCauseType: 'UNKNOWN', liabilityStatus: 'DRAFT', auditLogs: [{ id: 'AL-QC-003-1', action: 'SUBMIT_QC', detail: '提交质检结果 PASS', at: '2026-02-12 10:00:00', by: '王五' }], createdAt: '2026-02-12 09:00:00', updatedAt: '2026-02-12 10:00:00' },
  { qcId: 'QC-004', refType: 'TASK', refId: 'TASK-0002-002', productionOrderId: 'PO-0002', inspector: '赵六', inspectedAt: '2026-02-13 10:00:00', result: 'PASS', defectItems: [], remark: '', status: 'SUBMITTED', rootCauseType: 'UNKNOWN', liabilityStatus: 'DRAFT', auditLogs: [{ id: 'AL-QC-004-1', action: 'SUBMIT_QC', detail: '提交质检结果 PASS', at: '2026-02-13 10:00:00', by: '赵六' }], createdAt: '2026-02-13 09:00:00', updatedAt: '2026-02-13 10:00:00' },
  { qcId: 'QC-005', refType: 'TASK', refId: 'TASK-0005-001', productionOrderId: 'PO-0005', inspector: '张三', inspectedAt: '2026-02-14 10:00:00', result: 'PASS', defectItems: [], remark: '', status: 'DRAFT', rootCauseType: 'UNKNOWN', liabilityStatus: 'DRAFT', auditLogs: [], createdAt: '2026-02-14 09:00:00', updatedAt: '2026-02-14 09:00:00' },
  { qcId: 'QC-006', refType: 'TASK', refId: 'TASK-0007-001', productionOrderId: 'PO-0007', inspector: '李四', inspectedAt: '2026-02-15 10:00:00', result: 'PASS', defectItems: [], remark: '', status: 'SUBMITTED', rootCauseType: 'UNKNOWN', liabilityStatus: 'DRAFT', auditLogs: [{ id: 'AL-QC-006-1', action: 'SUBMIT_QC', detail: '提交质检结果 PASS', at: '2026-02-15 10:00:00', by: '李四' }], createdAt: '2026-02-15 09:00:00', updatedAt: '2026-02-15 10:00:00' },
  { qcId: 'QC-007', refType: 'TASK', refId: 'TASK-0009-001', productionOrderId: 'PO-0009', inspector: '王五', inspectedAt: '2026-02-16 10:00:00', result: 'PASS', defectItems: [], remark: '', status: 'SUBMITTED', rootCauseType: 'UNKNOWN', liabilityStatus: 'DRAFT', auditLogs: [{ id: 'AL-QC-007-1', action: 'SUBMIT_QC', detail: '提交质检结果 PASS', at: '2026-02-16 10:00:00', by: '王五' }], createdAt: '2026-02-16 09:00:00', updatedAt: '2026-02-16 10:00:00' },
  { qcId: 'QC-008', refType: 'TASK', refId: 'TASK-BLOCKED-001', productionOrderId: 'PO-BLOCKED', inspector: '赵六', inspectedAt: '2026-02-17 10:00:00', result: 'PASS', defectItems: [], remark: '', status: 'SUBMITTED', rootCauseType: 'UNKNOWN', liabilityStatus: 'DRAFT', auditLogs: [{ id: 'AL-QC-008-1', action: 'SUBMIT_QC', detail: '提交质检结果 PASS', at: '2026-02-17 10:00:00', by: '赵六' }], createdAt: '2026-02-17 09:00:00', updatedAt: '2026-02-17 10:00:00' },
  // ── FAIL 10 条 ── disposition 覆盖 QUALITY/QUALITY/ACCEPT_AS_DEFECT/SCRAP ──
  // QUALITY × 3
  { qcId: 'QC-009', refType: 'TASK', refId: 'TASK-0001-003', productionOrderId: 'PO-0001', inspector: '张三', inspectedAt: '2026-02-18 10:00:00', result: 'FAIL', defectItems: [{ defectCode: 'D001', defectName: '车线跳针', qty: 80 }, { defectCode: 'D002', defectName: '尺寸偏差', qty: 40 }], remark: '需全部质量处理', status: 'SUBMITTED', disposition: 'ACCEPT_AS_DEFECT', affectedQty: 120, rootCauseType: 'PROCESS', responsiblePartyType: 'FACTORY', responsiblePartyId: SEED_FACTORY_ID, liabilityStatus: 'CONFIRMED', auditLogs: [{ id: 'AL-QC-009-1', action: 'SUBMIT_QC', detail: '提交质检结果 FAIL，处置=ACCEPT_AS_DEFECT', at: '2026-02-18 10:00:00', by: '张三' }, { id: 'AL-QC-009-2', action: 'UPDATE_QC', detail: '记录质量处理建议', at: '2026-02-18 10:01:00', by: 'SYSTEM' }], createdAt: '2026-02-18 09:00:00', updatedAt: '2026-02-18 10:01:00' },
  { qcId: 'QC-010', refType: 'TASK', refId: 'TASK-0002-003', productionOrderId: 'PO-0002', inspector: '李四', inspectedAt: '2026-02-19 10:00:00', result: 'FAIL', defectItems: [{ defectCode: 'D003', defectName: '染色不均', qty: 50 }], remark: '局部质量处理', status: 'SUBMITTED', disposition: 'ACCEPT_AS_DEFECT', affectedQty: 50, rootCauseType: 'DYE_PRINT', responsiblePartyType: 'PROCESSOR', responsiblePartyId: 'PROC-DP-001', liabilityStatus: 'DISPUTED', auditLogs: [{ id: 'AL-QC-010-1', action: 'SUBMIT_QC', detail: '提交质检结果 FAIL，处置=ACCEPT_AS_DEFECT', at: '2026-02-19 10:00:00', by: '李四' }], createdAt: '2026-02-19 09:00:00', updatedAt: '2026-02-19 10:00:00' },
  { qcId: 'QC-011', refType: 'TASK', refId: 'TASK-0005-002', productionOrderId: 'PO-0005', inspector: '王五', inspectedAt: '2026-02-20 10:00:00', result: 'FAIL', defectItems: [{ defectCode: 'D004', defectName: '绣花错位', qty: 30 }], remark: '', status: 'SUBMITTED', disposition: 'ACCEPT_AS_DEFECT', affectedQty: 30, rootCauseType: 'PROCESS', responsiblePartyType: 'FACTORY', responsiblePartyId: 'ID-F002', liabilityStatus: 'DISPUTED', auditLogs: [{ id: 'AL-QC-011-1', action: 'SUBMIT_QC', detail: '提交质检结果 FAIL，处置=ACCEPT_AS_DEFECT', at: '2026-02-20 10:00:00', by: '王五' }], createdAt: '2026-02-20 09:00:00', updatedAt: '2026-02-20 10:00:00' },
  // QUALITY × 2
  { qcId: 'QC-012', refType: 'TASK', refId: 'TASK-0007-002', productionOrderId: 'PO-0007', inspector: '赵六', inspectedAt: '2026-02-21 10:00:00', result: 'FAIL', defectItems: [{ defectCode: 'D005', defectName: '版型错误', qty: 200 }], remark: '整批质量处理', status: 'SUBMITTED', disposition: 'SCRAP', affectedQty: 200, rootCauseType: 'PATTERN_TECH', responsiblePartyType: 'OTHER', responsiblePartyId: 'OTHER-001', liabilityStatus: 'CONFIRMED', auditLogs: [{ id: 'AL-QC-012-1', action: 'SUBMIT_QC', detail: '提交质检结果 FAIL，处置=ACCEPT_AS_DEFECT', at: '2026-02-21 10:00:00', by: '赵六' }], createdAt: '2026-02-21 09:00:00', updatedAt: '2026-02-21 10:00:00' },
  { qcId: 'QC-013', refType: 'TASK', refId: 'TASK-0009-002', productionOrderId: 'PO-0009', inspector: '张三', inspectedAt: '2026-02-22 10:00:00', result: 'FAIL', defectItems: [{ defectCode: 'D006', defectName: '面料起球', qty: 100 }], remark: '面料原因，整批质量处理', status: 'SUBMITTED', disposition: 'SCRAP', affectedQty: 100, rootCauseType: 'MATERIAL', responsiblePartyType: 'SUPPLIER', responsiblePartyId: 'SUP-001', liabilityStatus: 'DISPUTED', auditLogs: [{ id: 'AL-QC-013-1', action: 'SUBMIT_QC', detail: '提交质检结果 FAIL，处置=ACCEPT_AS_DEFECT', at: '2026-02-22 10:00:00', by: '张三' }], createdAt: '2026-02-22 09:00:00', updatedAt: '2026-02-22 10:00:00' },
  // ACCEPT_AS_DEFECT × 2
  { qcId: 'QC-014', refType: 'TASK', refId: 'TASK-0001-004', productionOrderId: 'PO-0001', inspector: '李四', inspectedAt: '2026-02-23 10:00:00', result: 'FAIL', defectItems: [{ defectCode: 'D007', defectName: '轻微色差', qty: 20 }], remark: '接受B级品', status: 'SUBMITTED', disposition: 'ACCEPT_AS_DEFECT', affectedQty: 20, rootCauseType: 'DYE_PRINT', responsiblePartyType: 'PROCESSOR', responsiblePartyId: 'PROC-DP-001', liabilityStatus: 'CONFIRMED', auditLogs: [{ id: 'AL-QC-014-1', action: 'SUBMIT_QC', detail: '提交质检结果 FAIL，处置=ACCEPT_AS_DEFECT', at: '2026-02-23 10:00:00', by: '李四' }], createdAt: '2026-02-23 09:00:00', updatedAt: '2026-02-23 10:00:00' },
  { qcId: 'QC-015', refType: 'TASK', refId: 'TASK-0002-004', productionOrderId: 'PO-0002', inspector: '王五', inspectedAt: '2026-02-24 10:00:00', result: 'FAIL', defectItems: [{ defectCode: 'D008', defectName: '印花轻微偏位', qty: 15 }], remark: '接受，扣款处理', status: 'SUBMITTED', disposition: 'ACCEPT_AS_DEFECT', affectedQty: 15, rootCauseType: 'DYE_PRINT', responsiblePartyType: 'PROCESSOR', responsiblePartyId: 'PROC-DP-001', liabilityStatus: 'CONFIRMED', auditLogs: [{ id: 'AL-QC-015-1', action: 'SUBMIT_QC', detail: '提交质检结果 FAIL，处置=ACCEPT_AS_DEFECT', at: '2026-02-24 10:00:00', by: '王五' }], createdAt: '2026-02-24 09:00:00', updatedAt: '2026-02-24 10:00:00' },
  // SCRAP × 1
  { qcId: 'QC-016', refType: 'TASK', refId: 'TASK-BLOCKED-002', productionOrderId: 'PO-BLOCKED', inspector: '赵六', inspectedAt: '2026-02-25 10:00:00', result: 'FAIL', defectItems: [{ defectCode: 'D009', defectName: '严重污染', qty: 60 }], remark: '报废处理', status: 'SUBMITTED', disposition: 'SCRAP', affectedQty: 60, rootCauseType: 'MATERIAL', responsiblePartyType: 'SUPPLIER', responsiblePartyId: 'SUP-001', liabilityStatus: 'CONFIRMED', auditLogs: [{ id: 'AL-QC-016-1', action: 'SUBMIT_QC', detail: '提交质检结果 FAIL，处置=SCRAP', at: '2026-02-25 10:00:00', by: '赵六' }], createdAt: '2026-02-25 09:00:00', updatedAt: '2026-02-25 10:00:00' },
  // ACCEPT × 1
  { qcId: 'QC-017', refType: 'TASK', refId: 'TASK-BLOCKED-003', productionOrderId: 'PO-BLOCKED', inspector: '张三', inspectedAt: '2026-02-26 10:00:00', result: 'FAIL', defectItems: [{ defectCode: 'D010', defectName: '包装缺陷', qty: 5 }], remark: '可接受，无需扣款', status: 'SUBMITTED', disposition: 'ACCEPT', affectedQty: 0, rootCauseType: 'UNKNOWN', responsiblePartyType: 'OTHER', responsiblePartyId: 'OTHER-001', liabilityStatus: 'DRAFT', auditLogs: [{ id: 'AL-QC-017-1', action: 'SUBMIT_QC', detail: '提交质检结果 FAIL，处置=ACCEPT', at: '2026-02-26 10:00:00', by: '张三' }], createdAt: '2026-02-26 09:00:00', updatedAt: '2026-02-26 10:00:00' },
  // HANDOVER refType × 1
  { qcId: 'QC-018', refType: 'HANDOVER', refId: 'HO-2026-001', productionOrderId: 'PO-0005', inspector: '李四', inspectedAt: '2026-02-27 10:00:00', result: 'FAIL', defectItems: [{ defectCode: 'D011', defectName: '交货数量不符', qty: 35 }], remark: '交接差异', status: 'SUBMITTED', disposition: 'ACCEPT_AS_DEFECT', affectedQty: 35, rootCauseType: 'PROCESS', responsiblePartyType: 'FACTORY', responsiblePartyId: 'ID-F003', liabilityStatus: 'DISPUTED', auditLogs: [{ id: 'AL-QC-018-1', action: 'SUBMIT_QC', detail: '提交质检结果 FAIL（交接），处置=ACCEPT_AS_DEFECT', at: '2026-02-27 10:00:00', by: '李四' }], createdAt: '2026-02-27 09:00:00', updatedAt: '2026-02-27 10:00:00' },
  // extra pass
  { qcId: 'QC-019', refType: 'TASK', refId: 'TASK-0007-003', productionOrderId: 'PO-0007', inspector: '王五', inspectedAt: '2026-03-01 09:00:00', result: 'PASS', defectItems: [], remark: '', status: 'DRAFT', rootCauseType: 'UNKNOWN', liabilityStatus: 'DRAFT', auditLogs: [], createdAt: '2026-03-01 09:00:00', updatedAt: '2026-03-01 09:00:00' },
]



// ── Seed task/PO injection (side-effects on shared mutable arrays) ──────────

export const seedParentTask: ProcessTask = {
  taskId: 'TASK-SEED-0001',
  productionOrderId: 'PO-SEED-0001',
  seq: 1,
  processCode: 'PROC_CUT',
  processNameZh: '裁片',
  stage: 'CUTTING',
  qty: 1500,
  qtyUnit: 'PIECE',
  assignmentMode: 'DIRECT',
  assignmentStatus: 'ASSIGNED',
  ownerSuggestion: { kind: 'MAIN_FACTORY' },
  assignedFactoryId: SEED_FACTORY_ID,
  qcPoints: [],
  attachments: [],
  status: 'BLOCKED',
  blockReason: 'QUALITY',
  blockRemark: '质检 QC-SEED-0001 发现严重缺陷，待质量处理完成后解锁',
  blockedAt: SEED_AT,
  acceptanceStatus: 'ACCEPTED',
  acceptedAt: SEED_AT,
  createdAt: SEED_AT,
  updatedAt: SEED_AT,
  auditLogs: [
    { id: 'AL-TASK-SEED-001', action: 'CREATED', detail: '任务创建', at: SEED_AT, by: 'SYSTEM' },
    { id: 'AL-TASK-SEED-002', action: 'BLOCK_BY_QC', detail: '质检 QC-SEED-0001 FAIL，系统自动生产暂停任务', at: SEED_AT, by: 'SYSTEM' },
  ],
}

export const seedProductionOrder: ProductionOrder = {
  productionOrderId: 'PO-SEED-0001',
  demandId: 'DEM-SEED-0001',
  legacyOrderNo: 'SEED-240001',
  status: 'EXECUTING',
  lockedLegacy: true,
  mainFactoryId: SEED_FACTORY_ID,
  mainFactorySnapshot: {
    id: SEED_FACTORY_ID,
    code: 'ID-F001',
    name: SEED_FACTORY_NAME,
    tier: 'T1',
    type: 'SEWING',
    status: 'ACTIVE',
    province: 'Jawa Barat',
    city: 'Bandung',
    tags: [],
  },
  ownerPartyType: 'LEGAL_ENTITY',
  ownerPartyId: 'LE-001',
  techPackSnapshot: { status: 'RELEASED', versionLabel: 'v1.0', snapshotAt: SEED_AT },
  demandSnapshot: {
    demandId: 'DEM-SEED-0001',
    spuCode: 'SPU-SEED-001',
    spuName: '测试款式（质量已完成演示）',
    priority: 'NORMAL',
    requiredDeliveryDate: '2026-04-30',
    constraintsNote: '',
    skuLines: [{ skuCode: 'SKU-SEED-001', size: 'M', color: '黑色', qty: 1500 }],
  },
  assignmentSummary: { directCount: 2, biddingCount: 0, totalTasks: 2, unassignedCount: 0 },
  assignmentProgress: { status: 'DONE', directAssignedCount: 2, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
  biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
  directDispatchSummary: { assignedFactoryCount: 1, rejectedCount: 0, overdueAckCount: 0 },
  taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '质量处理'], lastBreakdownAt: SEED_AT, lastBreakdownBy: 'SYSTEM' },
  riskFlags: [],
  auditLogs: [
    { id: 'AL-PO-SEED-001', action: 'CREATED', detail: '生产单创建（质量已完成演示）', at: SEED_AT, by: 'SYSTEM' },
    { id: 'AL-PO-SEED-002', action: 'EXECUTING', detail: '进入执行中状态', at: SEED_AT, by: 'SYSTEM' },
  ],
  createdAt: SEED_AT,
  updatedAt: SEED_AT,
}


// ── initialDeductionCandidates ───────────────

export const initialDeductionCandidates: DeductionCandidate[] = []

// ── initialDeductionBasisItems ───────────────

export const initialDeductionBasisItems: DeductionBasisItem[] = []

export const BASIS_SEEDS: DeductionBasisItem[] = [
  // Derived from FAIL QCs (QC_FAIL)
  { basisId: 'DBI-001', sourceType: 'QC_FAIL', sourceRefId: 'QC-009', sourceId: 'QC-009', productionOrderId: 'PO-0001', taskId: 'TASK-0001-003', factoryId: SEED_FACTORY_ID, settlementPartyType: 'FACTORY', settlementPartyId: SEED_FACTORY_ID, rootCauseType: 'PROCESS', reasonCode: 'QUALITY_FAIL', qty: 120, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '车线跳针+尺寸偏差，质量处理120件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-009', taskHref: '/fcs/pda/task-receive/TASK-0001-003' }, createdAt: '2026-02-18 10:01:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-001-1', action: 'CREATE_BASIS_FROM_QC', detail: '由 QC-009 FAIL 生成', at: '2026-02-18 10:01:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-002', sourceType: 'QC_FAIL', sourceRefId: 'QC-010', sourceId: 'QC-010', productionOrderId: 'PO-0002', taskId: 'TASK-0002-003', factoryId: 'ID-F002', settlementPartyType: 'PROCESSOR', settlementPartyId: 'PROC-DP-001', rootCauseType: 'DYE_PRINT', reasonCode: 'QUALITY_FAIL', qty: 50, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '染色不均，质量处理50件', evidenceRefs: [], status: 'DISPUTED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-010', taskHref: '/fcs/pda/task-receive/TASK-0002-003' }, createdAt: '2026-02-19 10:01:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-002-1', action: 'CREATE_BASIS_FROM_QC', detail: '由 QC-010 FAIL 生成', at: '2026-02-19 10:01:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-003', sourceType: 'QC_FAIL', sourceRefId: 'QC-011', sourceId: 'QC-011', productionOrderId: 'PO-0005', taskId: 'TASK-0005-002', factoryId: 'ID-F002', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F002', rootCauseType: 'PROCESS', reasonCode: 'QUALITY_FAIL', qty: 30, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '绣花错位，质量处理30件', evidenceRefs: [], status: 'DISPUTED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-011', taskHref: '/fcs/pda/task-receive/TASK-0005-002' }, createdAt: '2026-02-20 10:01:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-003-1', action: 'CREATE_BASIS_FROM_QC', detail: '由 QC-011 FAIL 生成', at: '2026-02-20 10:01:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-004', sourceType: 'QC_FAIL', sourceRefId: 'QC-012', sourceId: 'QC-012', productionOrderId: 'PO-0007', taskId: 'TASK-0007-002', factoryId: 'ID-F003', settlementPartyType: 'OTHER', settlementPartyId: 'OTHER-001', rootCauseType: 'PATTERN_TECH', reasonCode: 'QUALITY_FAIL', qty: 200, uom: 'PIECE', disposition: 'SCRAP', summary: '版型错误，质量处理200件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-012', taskHref: '/fcs/pda/task-receive/TASK-0007-002' }, createdAt: '2026-02-21 10:01:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-004-1', action: 'CREATE_BASIS_FROM_QC', detail: '由 QC-012 FAIL 生成', at: '2026-02-21 10:01:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-005', sourceType: 'QC_FAIL', sourceRefId: 'QC-013', sourceId: 'QC-013', productionOrderId: 'PO-0009', taskId: 'TASK-0009-002', factoryId: 'ID-F004', settlementPartyType: 'SUPPLIER', settlementPartyId: 'SUP-001', rootCauseType: 'MATERIAL', reasonCode: 'QUALITY_FAIL', qty: 100, uom: 'PIECE', disposition: 'SCRAP', summary: '面料起球，质量处理100件', evidenceRefs: [], status: 'DISPUTED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-013', taskHref: '/fcs/pda/task-receive/TASK-0009-002' }, createdAt: '2026-02-22 10:01:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-005-1', action: 'CREATE_BASIS_FROM_QC', detail: '由 QC-013 FAIL 生成', at: '2026-02-22 10:01:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-006', sourceType: 'QC_FAIL', sourceRefId: 'QC-016', sourceId: 'QC-016', productionOrderId: 'PO-BLOCKED', taskId: 'TASK-BLOCKED-002', factoryId: SEED_FACTORY_ID, settlementPartyType: 'SUPPLIER', settlementPartyId: 'SUP-001', rootCauseType: 'MATERIAL', reasonCode: 'QUALITY_FAIL', qty: 60, uom: 'PIECE', disposition: 'SCRAP', summary: '严重污染，报废60件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-016', taskHref: '/fcs/pda/task-receive/TASK-BLOCKED-002' }, createdAt: '2026-02-25 10:01:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-006-1', action: 'CREATE_BASIS_FROM_QC', detail: '由 QC-016 FAIL 生成', at: '2026-02-25 10:01:00', by: 'SYSTEM' }] },
  // ACCEPT_AS_DEFECT
  { basisId: 'DBI-007', sourceType: 'QC_DEFECT_ACCEPT', sourceRefId: 'QC-014', sourceId: 'QC-014', productionOrderId: 'PO-0001', taskId: 'TASK-0001-004', factoryId: 'PROC-DP-001', settlementPartyType: 'PROCESSOR', settlementPartyId: 'PROC-DP-001', rootCauseType: 'DYE_PRINT', reasonCode: 'QUALITY_FAIL', qty: 20, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '轻微色差，接受B级品，扣款处理', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-014', taskHref: '/fcs/pda/task-receive/TASK-0001-004' }, createdAt: '2026-02-23 10:01:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-007-1', action: 'CREATE_BASIS_FROM_QC', detail: '由 QC-014 ACCEPT_AS_DEFECT 生成', at: '2026-02-23 10:01:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-008', sourceType: 'QC_DEFECT_ACCEPT', sourceRefId: 'QC-015', sourceId: 'QC-015', productionOrderId: 'PO-0002', taskId: 'TASK-0002-004', factoryId: 'PROC-DP-001', settlementPartyType: 'PROCESSOR', settlementPartyId: 'PROC-DP-001', rootCauseType: 'DYE_PRINT', reasonCode: 'QUALITY_FAIL', qty: 15, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '印花轻微偏位，接受扣款', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-015', taskHref: '/fcs/pda/task-receive/TASK-0002-004' }, createdAt: '2026-02-24 10:01:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-008-1', action: 'CREATE_BASIS_FROM_QC', detail: '由 QC-015 ACCEPT_AS_DEFECT 生成', at: '2026-02-24 10:01:00', by: 'SYSTEM' }] },
  // HANDOVER_DIFF
  { basisId: 'DBI-009', sourceType: 'HANDOVER_DIFF', sourceRefId: 'HO-2026-001', sourceId: 'HO-2026-001', productionOrderId: 'PO-0005', refHandoverId: 'HO-2026-001', factoryId: 'ID-F003', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F003', rootCauseType: 'PROCESS', reasonCode: 'HANDOVER_SHORTAGE', qty: 35, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '交接数量短缺35件', evidenceRefs: [], status: 'DRAFT', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-018', handoverHref: '/fcs/pda/handover/HO-2026-001' }, createdAt: '2026-02-27 10:01:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-009-1', action: 'CREATE_BASIS_FROM_HANDOVER', detail: '由 HO-2026-001 交接差异生成', at: '2026-02-27 10:01:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-010', sourceType: 'HANDOVER_DIFF', sourceRefId: 'HO-2026-002', sourceId: 'HO-2026-002', productionOrderId: 'PO-0007', refHandoverId: 'HO-2026-002', factoryId: 'ID-F002', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F002', rootCauseType: 'PROCESS', reasonCode: 'HANDOVER_DAMAGE', qty: 18, uom: 'PIECE', summary: '交接破损18件', evidenceRefs: [], status: 'DRAFT', deepLinks: { handoverHref: '/fcs/pda/handover/HO-2026-002' }, createdAt: '2026-02-28 10:01:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-010-1', action: 'CREATE_BASIS_FROM_HANDOVER', detail: '由 HO-2026-002 交接破损生成', at: '2026-02-28 10:01:00', by: 'SYSTEM' }] },
  // Additional entries to reach ≥30 total
  { basisId: 'DBI-011', sourceType: 'QC_FAIL', sourceRefId: 'QC-009-B', sourceId: 'QC-009-B', productionOrderId: 'PO-0001', taskId: 'TASK-0001-003', factoryId: SEED_FACTORY_ID, settlementPartyType: 'FACTORY', settlementPartyId: SEED_FACTORY_ID, rootCauseType: 'PROCESS', reasonCode: 'QUALITY_FAIL', qty: 25, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '二次质量处理补充依据', evidenceRefs: [], status: 'DRAFT', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-009' }, createdAt: '2026-02-19 14:00:00', createdBy: '质检员A', auditLogs: [{ id: 'AL-DBI-011-1', action: 'CREATE_BASIS_FROM_QC', detail: '补充依据', at: '2026-02-19 14:00:00', by: '质检员A' }] },
  { basisId: 'DBI-012', sourceType: 'QC_FAIL', sourceRefId: 'QC-012-B', sourceId: 'QC-012-B', productionOrderId: 'PO-0007', taskId: 'TASK-0007-003', factoryId: 'ID-F003', settlementPartyType: 'OTHER', settlementPartyId: 'OTHER-001', rootCauseType: 'CUTTING', reasonCode: 'QUALITY_FAIL', qty: 45, uom: 'PIECE', disposition: 'SCRAP', summary: '裁剪偏差，报废45件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-012', taskHref: '/fcs/pda/task-receive/TASK-0007-003' }, createdAt: '2026-02-21 14:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-012-1', action: 'CREATE_BASIS_FROM_QC', detail: '裁剪问题', at: '2026-02-21 14:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-013', sourceType: 'QC_FAIL', sourceRefId: 'QC-013-B', sourceId: 'QC-013-B', productionOrderId: 'PO-0009', taskId: 'TASK-0009-003', factoryId: 'ID-F004', settlementPartyType: 'SUPPLIER', settlementPartyId: 'SUP-001', rootCauseType: 'MATERIAL', reasonCode: 'QUALITY_FAIL', qty: 80, uom: 'PIECE', disposition: 'SCRAP', summary: '面料批次差异，质量处理80件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-013', taskHref: '/fcs/pda/task-receive/TASK-0009-003' }, createdAt: '2026-02-22 14:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-013-1', action: 'CREATE_BASIS_FROM_QC', detail: '面料问题', at: '2026-02-22 14:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-014', sourceType: 'QC_FAIL', sourceRefId: 'QC-NEW-001', sourceId: 'QC-NEW-001', productionOrderId: 'PO-0005', taskId: 'TASK-0005-003', factoryId: 'ID-F002', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F002', rootCauseType: 'PROCESS', reasonCode: 'QUALITY_FAIL', qty: 40, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '缝制不良，质量处理40件', evidenceRefs: [], status: 'DRAFT', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-001', taskHref: '/fcs/pda/task-receive/TASK-0005-003' }, createdAt: '2026-02-23 14:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-014-1', action: 'CREATE_BASIS_FROM_QC', detail: '缝制问题', at: '2026-02-23 14:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-015', sourceType: 'QC_FAIL', sourceRefId: 'QC-NEW-002', sourceId: 'QC-NEW-002', productionOrderId: 'PO-0007', taskId: 'TASK-0007-002', factoryId: 'ID-F003', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F003', rootCauseType: 'PROCESS', reasonCode: 'QUALITY_FAIL', qty: 55, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '扣位错误，质量处理55件', evidenceRefs: [], status: 'DRAFT', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-002', taskHref: '/fcs/pda/task-receive/TASK-0007-002' }, createdAt: '2026-02-24 14:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-015-1', action: 'CREATE_BASIS_FROM_QC', detail: '扣位问题', at: '2026-02-24 14:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-016', sourceType: 'QC_DEFECT_ACCEPT', sourceRefId: 'QC-NEW-003', sourceId: 'QC-NEW-003', productionOrderId: 'PO-0009', taskId: 'TASK-0009-001', factoryId: 'PROC-DP-001', settlementPartyType: 'PROCESSOR', settlementPartyId: 'PROC-DP-001', rootCauseType: 'DYE_PRINT', reasonCode: 'QUALITY_FAIL', qty: 12, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '印花位置偏差可接受，扣款12件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-003', taskHref: '/fcs/pda/task-receive/TASK-0009-001' }, createdAt: '2026-02-25 14:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-016-1', action: 'CREATE_BASIS_FROM_QC', detail: '印花偏差接受', at: '2026-02-25 14:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-017', sourceType: 'QC_FAIL', sourceRefId: 'QC-NEW-004', sourceId: 'QC-NEW-004', productionOrderId: 'PO-BLOCKED', taskId: 'TASK-BLOCKED-001', factoryId: SEED_FACTORY_ID, settlementPartyType: 'FACTORY', settlementPartyId: SEED_FACTORY_ID, rootCauseType: 'PROCESS', reasonCode: 'QUALITY_FAIL', qty: 90, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '版型不符，质量处理90件', evidenceRefs: [], status: 'DRAFT', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-004', taskHref: '/fcs/pda/task-receive/TASK-BLOCKED-001' }, createdAt: '2026-02-26 14:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-017-1', action: 'CREATE_BASIS_FROM_QC', detail: '版型问题', at: '2026-02-26 14:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-018', sourceType: 'QC_FAIL', sourceRefId: 'QC-NEW-005', sourceId: 'QC-NEW-005', productionOrderId: 'PO-0002', taskId: 'TASK-0002-001', factoryId: 'ID-F001', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F001', rootCauseType: 'CUTTING', reasonCode: 'QUALITY_FAIL', qty: 33, uom: 'PIECE', disposition: 'SCRAP', summary: '裁片严重偏差，报废33件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-005', taskHref: '/fcs/pda/task-receive/TASK-0002-001' }, createdAt: '2026-02-27 14:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-018-1', action: 'CREATE_BASIS_FROM_QC', detail: '裁剪报废', at: '2026-02-27 14:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-019', sourceType: 'QC_FAIL', sourceRefId: 'QC-NEW-006', sourceId: 'QC-NEW-006', productionOrderId: 'PO-0001', taskId: 'TASK-0001-001', factoryId: SEED_FACTORY_ID, settlementPartyType: 'FACTORY', settlementPartyId: SEED_FACTORY_ID, rootCauseType: 'PROCESS', reasonCode: 'QUALITY_FAIL', qty: 70, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '明线外露，质量处理70件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-006', taskHref: '/fcs/pda/task-receive/TASK-0001-001' }, createdAt: '2026-02-28 14:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-019-1', action: 'CREATE_BASIS_FROM_QC', detail: '明线问题', at: '2026-02-28 14:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-020', sourceType: 'HANDOVER_DIFF', sourceRefId: 'HO-2026-003', sourceId: 'HO-2026-003', productionOrderId: 'PO-0009', refHandoverId: 'HO-2026-003', factoryId: 'ID-F004', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F004', rootCauseType: 'PROCESS', reasonCode: 'HANDOVER_OVERAGE', qty: 22, uom: 'PIECE', summary: '超交22件，退回处理', evidenceRefs: [], status: 'DRAFT', deepLinks: { handoverHref: '/fcs/pda/handover/HO-2026-003' }, createdAt: '2026-03-01 09:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-020-1', action: 'CREATE_BASIS_FROM_HANDOVER', detail: '超交差异', at: '2026-03-01 09:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-021', sourceType: 'QC_FAIL', sourceRefId: 'QC-NEW-007', sourceId: 'QC-NEW-007', productionOrderId: 'PO-0005', taskId: 'TASK-0005-001', factoryId: 'ID-F002', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F002', rootCauseType: 'PROCESS', reasonCode: 'QUALITY_FAIL', qty: 15, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '熨烫不良，质量处理15件', evidenceRefs: [], status: 'DRAFT', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-007', taskHref: '/fcs/pda/task-receive/TASK-0005-001' }, createdAt: '2026-03-01 10:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-021-1', action: 'CREATE_BASIS_FROM_QC', detail: '熨烫问题', at: '2026-03-01 10:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-022', sourceType: 'QC_DEFECT_ACCEPT', sourceRefId: 'QC-NEW-008', sourceId: 'QC-NEW-008', productionOrderId: 'PO-0007', taskId: 'TASK-0007-001', factoryId: 'PROC-DP-001', settlementPartyType: 'PROCESSOR', settlementPartyId: 'PROC-DP-001', rootCauseType: 'DYE_PRINT', reasonCode: 'QUALITY_FAIL', qty: 8, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '色差轻微，接受扣款8件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-008', taskHref: '/fcs/pda/task-receive/TASK-0007-001' }, createdAt: '2026-03-01 11:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-022-1', action: 'CREATE_BASIS_FROM_QC', detail: '色差接受', at: '2026-03-01 11:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-023', sourceType: 'QC_FAIL', sourceRefId: 'QC-NEW-009', sourceId: 'QC-NEW-009', productionOrderId: 'PO-0002', taskId: 'TASK-0002-002', factoryId: 'ID-F001', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F001', rootCauseType: 'PROCESS', reasonCode: 'QUALITY_FAIL', qty: 28, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '拉链质量差，质量处理28件', evidenceRefs: [], status: 'DRAFT', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-009', taskHref: '/fcs/pda/task-receive/TASK-0002-002' }, createdAt: '2026-03-01 12:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-023-1', action: 'CREATE_BASIS_FROM_QC', detail: '拉链问题', at: '2026-03-01 12:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-024', sourceType: 'QC_FAIL', sourceRefId: 'QC-NEW-010', sourceId: 'QC-NEW-010', productionOrderId: 'PO-0009', taskId: 'TASK-0009-004', factoryId: 'ID-F004', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F004', rootCauseType: 'PROCESS', reasonCode: 'QUALITY_FAIL', qty: 60, uom: 'PIECE', disposition: 'SCRAP', summary: '做工粗糙，整批质量处理60件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-010', taskHref: '/fcs/pda/task-receive/TASK-0009-004' }, createdAt: '2026-03-01 13:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-024-1', action: 'CREATE_BASIS_FROM_QC', detail: '做工问题', at: '2026-03-01 13:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-025', sourceType: 'HANDOVER_DIFF', sourceRefId: 'HO-2026-004', sourceId: 'HO-2026-004', productionOrderId: 'PO-0001', refHandoverId: 'HO-2026-004', factoryId: 'ID-F001', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F001', rootCauseType: 'PROCESS', reasonCode: 'HANDOVER_MIXED_BATCH', qty: 16, uom: 'PIECE', summary: '混批交接16件，需退回分拣', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { handoverHref: '/fcs/pda/handover/HO-2026-004' }, createdAt: '2026-03-01 14:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-025-1', action: 'CREATE_BASIS_FROM_HANDOVER', detail: '混批差异', at: '2026-03-01 14:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-026', sourceType: 'QC_FAIL', sourceRefId: 'QC-NEW-011', sourceId: 'QC-NEW-011', productionOrderId: 'PO-0005', taskId: 'TASK-0005-002', factoryId: 'ID-F002', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F002', rootCauseType: 'PROCESS', reasonCode: 'QUALITY_FAIL', qty: 38, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '内衬脱落，质量处理38件', evidenceRefs: [], status: 'DRAFT', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-011', taskHref: '/fcs/pda/task-receive/TASK-0005-002' }, createdAt: '2026-03-02 09:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-026-1', action: 'CREATE_BASIS_FROM_QC', detail: '内衬问题', at: '2026-03-02 09:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-027', sourceType: 'QC_FAIL', sourceRefId: 'QC-NEW-012', sourceId: 'QC-NEW-012', productionOrderId: 'PO-0007', taskId: 'TASK-0007-003', factoryId: 'ID-F003', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F003', rootCauseType: 'CUTTING', reasonCode: 'QUALITY_FAIL', qty: 52, uom: 'PIECE', disposition: 'SCRAP', summary: '裁片纬斜超标，报废52件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-012', taskHref: '/fcs/pda/task-receive/TASK-0007-003' }, createdAt: '2026-03-02 10:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-027-1', action: 'CREATE_BASIS_FROM_QC', detail: '纬斜报废', at: '2026-03-02 10:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-028', sourceType: 'QC_DEFECT_ACCEPT', sourceRefId: 'QC-NEW-013', sourceId: 'QC-NEW-013', productionOrderId: 'PO-0002', taskId: 'TASK-0002-003', factoryId: 'PROC-DP-001', settlementPartyType: 'PROCESSOR', settlementPartyId: 'PROC-DP-001', rootCauseType: 'DYE_PRINT', reasonCode: 'QUALITY_FAIL', qty: 11, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '印花套色偏差，接受扣款11件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-013', taskHref: '/fcs/pda/task-receive/TASK-0002-003' }, createdAt: '2026-03-02 11:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-028-1', action: 'CREATE_BASIS_FROM_QC', detail: '套色偏差接受', at: '2026-03-02 11:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-029', sourceType: 'QC_FAIL', sourceRefId: 'QC-NEW-014', sourceId: 'QC-NEW-014', productionOrderId: 'PO-BLOCKED', taskId: 'TASK-BLOCKED-003', factoryId: SEED_FACTORY_ID, settlementPartyType: 'FACTORY', settlementPartyId: SEED_FACTORY_ID, rootCauseType: 'PROCESS', reasonCode: 'QUALITY_FAIL', qty: 75, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '领口工艺不良，质量处理75件', evidenceRefs: [], status: 'DISPUTED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-014', taskHref: '/fcs/pda/task-receive/TASK-BLOCKED-003' }, createdAt: '2026-03-02 12:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-029-1', action: 'CREATE_BASIS_FROM_QC', detail: '领口问题', at: '2026-03-02 12:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-030', sourceType: 'QC_FAIL', sourceRefId: 'QC-NEW-015', sourceId: 'QC-NEW-015', productionOrderId: 'PO-0009', taskId: 'TASK-0009-005', factoryId: 'ID-F004', settlementPartyType: 'SUPPLIER', settlementPartyId: 'SUP-001', rootCauseType: 'MATERIAL', reasonCode: 'QUALITY_FAIL', qty: 44, uom: 'PIECE', disposition: 'SCRAP', summary: '辅料不合格，质量处理44件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-015', taskHref: '/fcs/pda/task-receive/TASK-0009-005' }, createdAt: '2026-03-02 13:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-030-1', action: 'CREATE_BASIS_FROM_QC', detail: '辅料问题', at: '2026-03-02 13:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-031', sourceType: 'QC_FAIL', sourceRefId: 'QC-NEW-016', sourceId: 'QC-NEW-016', productionOrderId: 'PO-0005', taskId: 'TASK-0005-003', factoryId: 'ID-F002', settlementPartyType: 'FACTORY', settlementPartyId: 'ID-F002', rootCauseType: 'PROCESS', reasonCode: 'QUALITY_FAIL', qty: 22, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '裤腿长度偏差，质量处理22件', evidenceRefs: [], status: 'DRAFT', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-016', taskHref: '/fcs/pda/task-receive/TASK-0005-003' }, createdAt: '2026-03-03 09:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-031-1', action: 'CREATE_BASIS_FROM_QC', detail: '长度偏差', at: '2026-03-03 09:00:00', by: 'SYSTEM' }] },
  { basisId: 'DBI-032', sourceType: 'QC_DEFECT_ACCEPT', sourceRefId: 'QC-NEW-017', sourceId: 'QC-NEW-017', productionOrderId: 'PO-0001', taskId: 'TASK-0001-002', factoryId: 'PROC-DP-001', settlementPartyType: 'PROCESSOR', settlementPartyId: 'PROC-DP-001', rootCauseType: 'DYE_PRINT', reasonCode: 'QUALITY_FAIL', qty: 9, uom: 'PIECE', disposition: 'ACCEPT_AS_DEFECT', summary: '绣花轻微断线，接受扣款9件', evidenceRefs: [], status: 'CONFIRMED', deepLinks: { qcHref: '/fcs/quality/qc-records/QC-NEW-017', taskHref: '/fcs/pda/task-receive/TASK-0001-002' }, createdAt: '2026-03-03 10:00:00', createdBy: 'SYSTEM', auditLogs: [{ id: 'AL-DBI-032-1', action: 'CREATE_BASIS_FROM_QC', detail: '绣花断线接受', at: '2026-03-03 10:00:00', by: 'SYSTEM' }] },
]



// ── initialAllocationByTaskId ────────────────

export const initialAllocationByTaskId: Record<string, AllocationSnapshot> = {
  'TASK-202603-0004-002': { taskId: 'TASK-202603-0004-002', availableQty: 0, acceptedAsDefectQty: 0, scrappedQty: 0, updatedAt: '2026-03-06 09:00:00', updatedBy: '系统' },
  'TASK-202603-0004-003': { taskId: 'TASK-202603-0004-003', availableQty: 1200, acceptedAsDefectQty: 0, scrappedQty: 0, updatedAt: '2026-03-07 10:00:00', updatedBy: '系统' },
  'TASK-202603-0005-002': { taskId: 'TASK-202603-0005-002', availableQty: 1800, acceptedAsDefectQty: 0, scrappedQty: 0, updatedAt: '2026-03-06 16:00:00', updatedBy: '系统' },
  'TASK-202603-0006-003': { taskId: 'TASK-202603-0006-003', availableQty: 0, acceptedAsDefectQty: 0, scrappedQty: 0, updatedAt: '2026-03-06 09:00:00', updatedBy: '系统' },
}

// ── initialAllocationEvents ──────────────────

export const initialAllocationEvents: AllocationEvent[] = []

// ── initialReturnBatches ─────────────────────

export const initialReturnBatches: ReturnBatch[] = []

// ── initialDyePrintOrders ────────────────────

export const initialDyePrintOrders: DyePrintOrder[] = [
  { dpId: 'DPO-202603-0001', orderId: 'DPO-202603-0001', productionOrderId: 'PO-202603-0004', relatedTaskId: 'TASK-202603-0004-003', processorFactoryId: 'ID-F005', processorFactoryName: 'Bandung Print House', settlementPartyType: 'PROCESSOR', settlementPartyId: 'ID-F005', settlementRelation: 'GROUP_INTERNAL', processType: 'PRINT', plannedQty: 3000, returnedPassQty: 2500, returnedFailQty: 0, availableQty: 2500, status: 'PARTIAL_RETURNED', returnBatches: [{ returnId: 'RB-DPO-001-1', returnedAt: '2026-03-01 10:00:00', qty: 2500, result: 'PASS' }], createdAt: '2026-02-28 09:00:00', createdBy: '张三', updatedAt: '2026-03-01 10:05:00' },
  { dpId: 'DPO-202603-0002', orderId: 'DPO-202603-0002', productionOrderId: 'PO-202603-0005', relatedTaskId: 'TASK-202603-0005-002', processorFactoryId: 'ID-F005', processorFactoryName: 'Bandung Print House', settlementPartyType: 'PROCESSOR', settlementPartyId: 'ID-F005', settlementRelation: 'GROUP_INTERNAL', processType: 'DYE', plannedQty: 1200, returnedPassQty: 0, returnedFailQty: 0, availableQty: 0, status: 'PROCESSING', returnBatches: [], createdAt: '2026-02-26 14:00:00', createdBy: '李四', updatedAt: '2026-02-26 14:00:00' },
  { dpId: 'DPO-202603-0003', orderId: 'DPO-202603-0003', productionOrderId: 'PO-0002', relatedTaskId: 'TASK-0002-003', processorFactoryId: 'ID-F005', processorFactoryName: 'Bandung Print House', settlementPartyType: 'PROCESSOR', settlementPartyId: 'ID-F005', settlementRelation: 'GROUP_INTERNAL', processType: 'DYE_PRINT', plannedQty: 800, returnedPassQty: 600, returnedFailQty: 50, availableQty: 600, status: 'PARTIAL_RETURNED', returnBatches: [{ returnId: 'RB-DPO-003-1', returnedAt: '2026-02-25 15:00:00', qty: 600, result: 'PASS' }, { returnId: 'RB-DPO-003-2', returnedAt: '2026-02-27 09:00:00', qty: 50, result: 'FAIL', disposition: 'ACCEPT_AS_DEFECT', qcId: 'QC-DP-003-1' }], createdAt: '2026-02-20 08:00:00', createdBy: '王五', updatedAt: '2026-02-27 09:05:00' },
  { dpId: 'DPO-202603-0004', orderId: 'DPO-202603-0004', productionOrderId: 'PO-0005', relatedTaskId: 'TASK-0005-002', processorFactoryId: 'ID-F005', processorFactoryName: 'Bandung Print House', settlementPartyType: 'PROCESSOR', settlementPartyId: 'ID-F005', settlementRelation: 'GROUP_INTERNAL', processType: 'PRINT', plannedQty: 2000, returnedPassQty: 2000, returnedFailQty: 0, availableQty: 2000, status: 'COMPLETED', returnBatches: [{ returnId: 'RB-DPO-004-1', returnedAt: '2026-02-22 11:00:00', qty: 2000, result: 'PASS' }], createdAt: '2026-02-18 09:00:00', createdBy: '张三', updatedAt: '2026-02-22 11:10:00' },
  { dpId: 'DPO-202603-0005', orderId: 'DPO-202603-0005', productionOrderId: 'PO-0007', relatedTaskId: 'TASK-0007-002', processorFactoryId: 'ID-F005', processorFactoryName: 'Bandung Print House', settlementPartyType: 'PROCESSOR', settlementPartyId: 'ID-F005', settlementRelation: 'GROUP_INTERNAL', processType: 'DYE', plannedQty: 500, returnedPassQty: 0, returnedFailQty: 0, availableQty: 0, status: 'DRAFT', returnBatches: [], createdAt: '2026-03-03 10:00:00', createdBy: '李四', updatedAt: '2026-03-03 10:00:00' },
  { dpId: 'DPO-202603-0006', orderId: 'DPO-202603-0006', productionOrderId: 'PO-0009', relatedTaskId: 'TASK-0009-003', processorFactoryId: 'ID-F005', processorFactoryName: 'Bandung Print House', settlementPartyType: 'PROCESSOR', settlementPartyId: 'ID-F005', settlementRelation: 'GROUP_INTERNAL', processType: 'PRINT', plannedQty: 1500, returnedPassQty: 1500, returnedFailQty: 0, availableQty: 1500, status: 'CLOSED', returnBatches: [{ returnId: 'RB-DPO-006-1', returnedAt: '2026-02-15 16:00:00', qty: 1500, result: 'PASS' }], createdAt: '2026-02-10 08:00:00', createdBy: '王五', updatedAt: '2026-02-16 09:00:00' },
  { dpId: 'DPO-202603-2001', orderId: 'DPO-202603-2001', relatedTaskId: 'TASK-202603-0004-002', productionOrderId: 'PO-202603-0004', processorFactoryId: 'ID-F005', processorFactoryName: 'Bandung Print House', settlementPartyType: 'PROCESSOR', settlementPartyId: 'ID-F005', settlementRelation: 'GROUP_INTERNAL', processType: 'PRINT', plannedQty: 2800, returnedPassQty: 0, returnedFailQty: 0, availableQty: 0, status: 'PROCESSING', remark: '印花打样已确认，正式大货处理中', returnBatches: [], createdAt: '2026-03-05 10:00:00', createdBy: '管理员', updatedAt: '2026-03-06 09:00:00', updatedBy: '管理员' },
  { dpId: 'DPO-202603-2002', orderId: 'DPO-202603-2002', relatedTaskId: 'TASK-202603-0004-003', productionOrderId: 'PO-202603-0004', processorFactoryId: 'ID-F005', processorFactoryName: 'Bandung Print House', settlementPartyType: 'PROCESSOR', settlementPartyId: 'ID-F005', settlementRelation: 'GROUP_INTERNAL', processType: 'DYE_PRINT', plannedQty: 2800, returnedPassQty: 1200, returnedFailQty: 0, availableQty: 1200, status: 'PARTIAL_RETURNED', remark: '已分批回货一部分，待继续回货', returnBatches: [{ returnId: 'RB-202603-2002-01', returnedAt: '2026-03-07 10:00:00', qty: 1200, result: 'PASS' }], createdAt: '2026-03-05 11:00:00', createdBy: '管理员', updatedAt: '2026-03-07 10:00:00', updatedBy: '管理员' },
  { dpId: 'DPO-202603-2003', orderId: 'DPO-202603-2003', relatedTaskId: 'TASK-202603-0005-002', productionOrderId: 'PO-202603-0005', processorFactoryId: 'ID-F005', processorFactoryName: 'Bandung Print House', settlementPartyType: 'PROCESSOR', settlementPartyId: 'ID-F005', settlementRelation: 'GROUP_INTERNAL', processType: 'DYE_PRINT', plannedQty: 3200, returnedPassQty: 1800, returnedFailQty: 0, availableQty: 1800, status: 'PARTIAL_RETURNED', remark: '首批回货已完成，剩余待回', returnBatches: [{ returnId: 'RB-202603-2003-01', returnedAt: '2026-03-06 16:00:00', qty: 1800, result: 'PASS' }], createdAt: '2026-03-04 09:00:00', createdBy: '管理员', updatedAt: '2026-03-06 16:00:00', updatedBy: '管理员' },
]
