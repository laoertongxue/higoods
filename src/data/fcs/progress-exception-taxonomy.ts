export type UnifiedCategory = 'ASSIGNMENT' | 'EXECUTION' | 'TECH_PACK' | 'MATERIAL' | 'HANDOUT'

export type SubCategoryKey =
  | 'ASSIGN_TENDER_OVERDUE'
  | 'ASSIGN_TENDER_NEAR_DEADLINE'
  | 'ASSIGN_NO_BID'
  | 'ASSIGN_PRICE_ABNORMAL'
  | 'ASSIGN_DISPATCH_REJECTED'
  | 'ASSIGN_ACK_TIMEOUT'
  | 'ASSIGN_FACTORY_BLOCKED'
  | 'EXEC_START_OVERDUE'
  | 'EXEC_MILESTONE_NOT_REPORTED'
  | 'EXEC_BLOCK_MATERIAL'
  | 'EXEC_BLOCK_TECH'
  | 'EXEC_BLOCK_EQUIPMENT'
  | 'EXEC_BLOCK_CAPACITY'
  | 'EXEC_BLOCK_QUALITY'
  | 'EXEC_BLOCK_OTHER'
  | 'TECH_PACK_NOT_RELEASED'
  | 'TECH_PACK_MISSING'
  | 'TECH_PACK_PENDING_CONFIRM'
  | 'MATERIAL_NOT_READY'
  | 'MATERIAL_PREP_PENDING'
  | 'MATERIAL_QTY_SHORT'
  | 'MATERIAL_PICKUP_QTY_DIFF'
  | 'MATERIAL_MULTI_OPEN'
  | 'HANDOUT_DIFF'
  | 'HANDOUT_OBJECTION'
  | 'HANDOUT_MIXED'
  | 'HANDOUT_DAMAGE'
  | 'HANDOUT_PENDING_CHECK'

export const CATEGORY_LABEL: Record<UnifiedCategory, string> = {
  ASSIGNMENT: '分配异常',
  EXECUTION: '执行异常',
  TECH_PACK: '技术包异常',
  MATERIAL: '领料异常',
  HANDOUT: '交出异常',
}

export const SUB_CATEGORY_LABEL: Record<SubCategoryKey, string> = {
  ASSIGN_TENDER_OVERDUE: '竞价逾期',
  ASSIGN_TENDER_NEAR_DEADLINE: '竞价临近截止',
  ASSIGN_NO_BID: '无人报价',
  ASSIGN_PRICE_ABNORMAL: '报价异常',
  ASSIGN_DISPATCH_REJECTED: '派单拒单',
  ASSIGN_ACK_TIMEOUT: '接单逾期',
  ASSIGN_FACTORY_BLOCKED: '工厂不可分配',
  EXEC_START_OVERDUE: '开工逾期',
  EXEC_MILESTONE_NOT_REPORTED: '关键节点未上报',
  EXEC_BLOCK_MATERIAL: '生产暂停｜物料原因',
  EXEC_BLOCK_TECH: '生产暂停｜工艺资料原因',
  EXEC_BLOCK_EQUIPMENT: '生产暂停｜设备原因',
  EXEC_BLOCK_CAPACITY: '生产暂停｜人员原因',
  EXEC_BLOCK_QUALITY: '生产暂停｜质量原因',
  EXEC_BLOCK_OTHER: '生产暂停｜其他原因',
  TECH_PACK_NOT_RELEASED: '技术包未发布',
  TECH_PACK_MISSING: '技术包缺失',
  TECH_PACK_PENDING_CONFIRM: '技术资料待确认',
  MATERIAL_NOT_READY: '领料未齐套',
  MATERIAL_PREP_PENDING: '配料未完成',
  MATERIAL_QTY_SHORT: '配料数量不足',
  MATERIAL_PICKUP_QTY_DIFF: '领料对象数量差异',
  MATERIAL_MULTI_OPEN: '多次领料未闭合',
  HANDOUT_DIFF: '仓库登记数量差异',
  HANDOUT_OBJECTION: '数量异议',
  HANDOUT_MIXED: '混批',
  HANDOUT_DAMAGE: '损耗/破损',
  HANDOUT_PENDING_CHECK: '差异原因待查',
}

export const SUB_CATEGORY_OPTIONS: Record<UnifiedCategory, Array<{ key: SubCategoryKey; label: string }>> = {
  ASSIGNMENT: [
    { key: 'ASSIGN_TENDER_OVERDUE', label: '竞价逾期' },
    { key: 'ASSIGN_TENDER_NEAR_DEADLINE', label: '竞价临近截止' },
    { key: 'ASSIGN_NO_BID', label: '无人报价' },
    { key: 'ASSIGN_PRICE_ABNORMAL', label: '报价异常' },
    { key: 'ASSIGN_DISPATCH_REJECTED', label: '派单拒单' },
    { key: 'ASSIGN_ACK_TIMEOUT', label: '接单逾期' },
    { key: 'ASSIGN_FACTORY_BLOCKED', label: '工厂不可分配' },
  ],
  EXECUTION: [
    { key: 'EXEC_START_OVERDUE', label: '开工逾期' },
    { key: 'EXEC_MILESTONE_NOT_REPORTED', label: '关键节点未上报' },
    { key: 'EXEC_BLOCK_MATERIAL', label: '生产暂停｜物料原因' },
    { key: 'EXEC_BLOCK_TECH', label: '生产暂停｜工艺资料原因' },
    { key: 'EXEC_BLOCK_EQUIPMENT', label: '生产暂停｜设备原因' },
    { key: 'EXEC_BLOCK_CAPACITY', label: '生产暂停｜人员原因' },
    { key: 'EXEC_BLOCK_QUALITY', label: '生产暂停｜质量原因' },
    { key: 'EXEC_BLOCK_OTHER', label: '生产暂停｜其他原因' },
  ],
  TECH_PACK: [
    { key: 'TECH_PACK_NOT_RELEASED', label: '技术包未发布' },
    { key: 'TECH_PACK_MISSING', label: '技术包缺失' },
    { key: 'TECH_PACK_PENDING_CONFIRM', label: '技术资料待确认' },
  ],
  MATERIAL: [
    { key: 'MATERIAL_NOT_READY', label: '领料未齐套' },
    { key: 'MATERIAL_PREP_PENDING', label: '配料未完成' },
    { key: 'MATERIAL_QTY_SHORT', label: '配料数量不足' },
    { key: 'MATERIAL_PICKUP_QTY_DIFF', label: '领料对象数量差异' },
    { key: 'MATERIAL_MULTI_OPEN', label: '多次领料未闭合' },
  ],
  HANDOUT: [
    { key: 'HANDOUT_DIFF', label: '仓库登记数量差异' },
    { key: 'HANDOUT_OBJECTION', label: '数量异议' },
    { key: 'HANDOUT_MIXED', label: '混批' },
    { key: 'HANDOUT_DAMAGE', label: '损耗/破损' },
    { key: 'HANDOUT_PENDING_CHECK', label: '差异原因待查' },
  ],
}

export const REASON_TO_SUB_CATEGORY_KEY: Record<string, SubCategoryKey> = {
  TENDER_OVERDUE: 'ASSIGN_TENDER_OVERDUE',
  TENDER_NEAR_DEADLINE: 'ASSIGN_TENDER_NEAR_DEADLINE',
  NO_BID: 'ASSIGN_NO_BID',
  PRICE_ABNORMAL: 'ASSIGN_PRICE_ABNORMAL',
  DISPATCH_REJECTED: 'ASSIGN_DISPATCH_REJECTED',
  ACK_TIMEOUT: 'ASSIGN_ACK_TIMEOUT',
  FACTORY_BLACKLISTED: 'ASSIGN_FACTORY_BLOCKED',
  START_OVERDUE: 'EXEC_START_OVERDUE',
  MILESTONE_NOT_REPORTED: 'EXEC_MILESTONE_NOT_REPORTED',
  BLOCKED_MATERIAL: 'EXEC_BLOCK_MATERIAL',
  BLOCKED_TECH: 'EXEC_BLOCK_TECH',
  BLOCKED_EQUIPMENT: 'EXEC_BLOCK_EQUIPMENT',
  BLOCKED_CAPACITY: 'EXEC_BLOCK_CAPACITY',
  BLOCKED_QUALITY: 'EXEC_BLOCK_QUALITY',
  BLOCKED_OTHER: 'EXEC_BLOCK_OTHER',
  TECH_PACK_NOT_RELEASED: 'TECH_PACK_NOT_RELEASED',
  MATERIAL_NOT_READY: 'MATERIAL_NOT_READY',
  HANDOVER_DIFF: 'HANDOUT_DIFF',
}

const SUB_CATEGORY_KEY_SET = new Set<SubCategoryKey>(
  Object.keys(SUB_CATEGORY_LABEL) as SubCategoryKey[],
)

export function isSubCategoryKey(value: string): value is SubCategoryKey {
  return SUB_CATEGORY_KEY_SET.has(value as SubCategoryKey)
}

export function getUnifiedCategoryFromReason(reasonCode: string, legacyCategory?: string): UnifiedCategory {
  if (
    [
      'TENDER_OVERDUE',
      'TENDER_NEAR_DEADLINE',
      'NO_BID',
      'PRICE_ABNORMAL',
      'DISPATCH_REJECTED',
      'ACK_TIMEOUT',
      'FACTORY_BLACKLISTED',
    ].includes(reasonCode)
  ) {
    return 'ASSIGNMENT'
  }
  if (reasonCode === 'TECH_PACK_NOT_RELEASED') return 'TECH_PACK'
  if (reasonCode === 'MATERIAL_NOT_READY') return 'MATERIAL'
  if (reasonCode === 'HANDOVER_DIFF') return 'HANDOUT'
  if (
    [
      'START_OVERDUE',
      'MILESTONE_NOT_REPORTED',
      'BLOCKED_MATERIAL',
      'BLOCKED_TECH',
      'BLOCKED_EQUIPMENT',
      'BLOCKED_CAPACITY',
      'BLOCKED_QUALITY',
      'BLOCKED_OTHER',
    ].includes(reasonCode)
  ) {
    return 'EXECUTION'
  }

  if (legacyCategory === 'ASSIGNMENT') return 'ASSIGNMENT'
  if (legacyCategory === 'TECH_PACK') return 'TECH_PACK'
  if (legacyCategory === 'MATERIAL') return 'MATERIAL'
  if (legacyCategory === 'HANDOVER') return 'HANDOUT'
  return 'EXECUTION'
}

export function getDefaultSubCategoryKeyFromReason(reasonCode: string): SubCategoryKey | undefined {
  return REASON_TO_SUB_CATEGORY_KEY[reasonCode]
}

export function inferLegacySubCategoryKey(reasonCode: string, summary: string, detail: string): SubCategoryKey | undefined {
  const text = `${summary} ${detail}`

  if (reasonCode === 'TECH_PACK_NOT_RELEASED') {
    if (/(缺失|缺少|缺项)/.test(text)) return 'TECH_PACK_MISSING'
    if (/(确认|待批复|待评审)/.test(text)) return 'TECH_PACK_PENDING_CONFIRM'
    return 'TECH_PACK_NOT_RELEASED'
  }

  if (reasonCode === 'MATERIAL_NOT_READY') {
    if (/(配料未完成|待配料)/.test(text)) return 'MATERIAL_PREP_PENDING'
    if (/(不足|缺口|不够)/.test(text)) return 'MATERIAL_QTY_SHORT'
    if (/(多次|分批)/.test(text)) return 'MATERIAL_MULTI_OPEN'
    return 'MATERIAL_NOT_READY'
  }

  if (reasonCode === 'HANDOVER_DIFF') {
    if (/异议/.test(text)) return 'HANDOUT_OBJECTION'
    if (/混批/.test(text)) return 'HANDOUT_MIXED'
    if (/(破损|损耗|丢失)/.test(text)) return 'HANDOUT_DAMAGE'
    if (/(待查|待确认|待核实)/.test(text)) return 'HANDOUT_PENDING_CHECK'
    return 'HANDOUT_DIFF'
  }

  return undefined
}

export function getSubCategoryOptionsByCategory(
  category: 'ALL' | UnifiedCategory,
): Array<{ key: SubCategoryKey; label: string }> {
  if (category === 'ALL') {
    return Object.values(SUB_CATEGORY_OPTIONS).flat()
  }
  return SUB_CATEGORY_OPTIONS[category]
}
