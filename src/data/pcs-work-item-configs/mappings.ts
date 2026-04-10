import { getProjectPhaseNameByCode } from '../pcs-project-phase-definitions.ts'

export interface StandardProjectWorkItemIdentity {
  workItemId: string
  workItemTypeCode: string
  workItemTypeName: string
  phaseCode: string
}

export const STANDARD_PROJECT_WORK_ITEM_IDENTITIES: StandardProjectWorkItemIdentity[] = [
  { workItemId: 'WI-001', workItemTypeCode: 'PROJECT_INIT', workItemTypeName: '商品项目立项', phaseCode: 'PHASE_01' },
  { workItemId: 'WI-002', workItemTypeCode: 'SAMPLE_ACQUIRE', workItemTypeName: '样衣获取', phaseCode: 'PHASE_01' },
  { workItemId: 'WI-003', workItemTypeCode: 'SAMPLE_INBOUND_CHECK', workItemTypeName: '到样入库与核对', phaseCode: 'PHASE_01' },
  { workItemId: 'WI-004', workItemTypeCode: 'FEASIBILITY_REVIEW', workItemTypeName: '初步可行性判断', phaseCode: 'PHASE_02' },
  { workItemId: 'WI-005', workItemTypeCode: 'SAMPLE_SHOOT_FIT', workItemTypeName: '样衣拍摄与试穿', phaseCode: 'PHASE_02' },
  { workItemId: 'WI-006', workItemTypeCode: 'SAMPLE_CONFIRM', workItemTypeName: '样衣确认', phaseCode: 'PHASE_02' },
  { workItemId: 'WI-007', workItemTypeCode: 'SAMPLE_COST_REVIEW', workItemTypeName: '样衣核价', phaseCode: 'PHASE_02' },
  { workItemId: 'WI-008', workItemTypeCode: 'SAMPLE_PRICING', workItemTypeName: '样衣定价', phaseCode: 'PHASE_02' },
  { workItemId: 'WI-009', workItemTypeCode: 'VIDEO_TEST', workItemTypeName: '短视频测款', phaseCode: 'PHASE_03' },
  { workItemId: 'WI-010', workItemTypeCode: 'LIVE_TEST', workItemTypeName: '直播测款', phaseCode: 'PHASE_03' },
  { workItemId: 'WI-011', workItemTypeCode: 'TEST_DATA_SUMMARY', workItemTypeName: '测款数据汇总', phaseCode: 'PHASE_03' },
  { workItemId: 'WI-012', workItemTypeCode: 'TEST_CONCLUSION', workItemTypeName: '测款结论判定', phaseCode: 'PHASE_03' },
  { workItemId: 'WI-013', workItemTypeCode: 'STYLE_ARCHIVE_CREATE', workItemTypeName: '生成款式档案', phaseCode: 'PHASE_04' },
  { workItemId: 'WI-014', workItemTypeCode: 'PROJECT_TRANSFER_PREP', workItemTypeName: '项目转档准备', phaseCode: 'PHASE_04' },
  { workItemId: 'WI-015', workItemTypeCode: 'PATTERN_TASK', workItemTypeName: '制版任务', phaseCode: 'PHASE_04' },
  { workItemId: 'WI-016', workItemTypeCode: 'PATTERN_ARTWORK_TASK', workItemTypeName: '花型任务', phaseCode: 'PHASE_04' },
  { workItemId: 'WI-017', workItemTypeCode: 'FIRST_SAMPLE', workItemTypeName: '首版样衣打样', phaseCode: 'PHASE_04' },
  { workItemId: 'WI-018', workItemTypeCode: 'PRE_PRODUCTION_SAMPLE', workItemTypeName: '产前版样衣', phaseCode: 'PHASE_04' },
  { workItemId: 'WI-019', workItemTypeCode: 'CHANNEL_PRODUCT_PREP', workItemTypeName: '渠道商品准备', phaseCode: 'PHASE_04' },
  { workItemId: 'WI-020', workItemTypeCode: 'SAMPLE_RETAIN_REVIEW', workItemTypeName: '样衣留存评估', phaseCode: 'PHASE_05' },
  { workItemId: 'WI-021', workItemTypeCode: 'SAMPLE_RETURN_HANDLE', workItemTypeName: '样衣退回处理', phaseCode: 'PHASE_05' },
]

export type WorkItemType = (typeof STANDARD_PROJECT_WORK_ITEM_IDENTITIES)[number]['workItemTypeCode']

export const workItemIdMap: Record<string, string> = Object.fromEntries(
  STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [item.workItemId, item.workItemTypeCode]),
)

export const typeToIdMap: Record<WorkItemType, string> = Object.fromEntries(
  STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [item.workItemTypeCode, item.workItemId]),
) as Record<WorkItemType, string>

const identityById = new Map(
  STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [item.workItemId, item]),
)

const identityByCode = new Map(
  STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [item.workItemTypeCode, item]),
)

const identityByName = new Map(
  STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [normalizeLegacyWorkItemName(item.workItemTypeName), item]),
)

export interface LegacyProjectWorkItemMapping {
  legacyName: string
  workItemTypeCode: WorkItemType
}

export const LEGACY_PROJECT_WORK_ITEM_MAPPINGS: LegacyProjectWorkItemMapping[] = [
  { legacyName: '商品项目立项', workItemTypeCode: 'PROJECT_INIT' },
  { legacyName: '样衣获取（深圳前置打版）', workItemTypeCode: 'SAMPLE_ACQUIRE' },
  { legacyName: '样衣获取', workItemTypeCode: 'SAMPLE_ACQUIRE' },
  { legacyName: '到样入库与核对', workItemTypeCode: 'SAMPLE_INBOUND_CHECK' },
  { legacyName: '初步可行性判断', workItemTypeCode: 'FEASIBILITY_REVIEW' },
  { legacyName: '样衣拍摄与试穿', workItemTypeCode: 'SAMPLE_SHOOT_FIT' },
  { legacyName: '样衣确认', workItemTypeCode: 'SAMPLE_CONFIRM' },
  { legacyName: '样衣核价', workItemTypeCode: 'SAMPLE_COST_REVIEW' },
  { legacyName: '样衣定价', workItemTypeCode: 'SAMPLE_PRICING' },
  { legacyName: '短视频测款', workItemTypeCode: 'VIDEO_TEST' },
  { legacyName: '直播测款', workItemTypeCode: 'LIVE_TEST' },
  { legacyName: '测款数据汇总', workItemTypeCode: 'TEST_DATA_SUMMARY' },
  { legacyName: '测款结论判定', workItemTypeCode: 'TEST_CONCLUSION' },
  { legacyName: '生成商品档案', workItemTypeCode: 'STYLE_ARCHIVE_CREATE' },
  { legacyName: '商品项目转档', workItemTypeCode: 'PROJECT_TRANSFER_PREP' },
  { legacyName: '转档准备', workItemTypeCode: 'PROJECT_TRANSFER_PREP' },
  { legacyName: '制版准备·打版任务', workItemTypeCode: 'PATTERN_TASK' },
  { legacyName: '制版任务', workItemTypeCode: 'PATTERN_TASK' },
  { legacyName: '花型任务', workItemTypeCode: 'PATTERN_ARTWORK_TASK' },
  { legacyName: '首版样衣打样', workItemTypeCode: 'FIRST_SAMPLE' },
  { legacyName: '产前版样衣', workItemTypeCode: 'PRE_PRODUCTION_SAMPLE' },
  { legacyName: '商品上架', workItemTypeCode: 'CHANNEL_PRODUCT_PREP' },
  { legacyName: '样衣留存与库存', workItemTypeCode: 'SAMPLE_RETAIN_REVIEW' },
  { legacyName: '样衣留存评估', workItemTypeCode: 'SAMPLE_RETAIN_REVIEW' },
  { legacyName: '样衣退货与处理', workItemTypeCode: 'SAMPLE_RETURN_HANDLE' },
  { legacyName: '样衣退货处理', workItemTypeCode: 'SAMPLE_RETURN_HANDLE' },
]

const legacyMappingByName = new Map(
  LEGACY_PROJECT_WORK_ITEM_MAPPINGS.map((item) => [
    normalizeLegacyWorkItemName(item.legacyName),
    getStandardProjectWorkItemIdentityByCode(item.workItemTypeCode) as StandardProjectWorkItemIdentity,
  ]),
)

export function normalizeLegacyWorkItemName(name: string): string {
  return name.trim().replace(/\s+/g, '')
}

export function listStandardProjectWorkItemIdentities(): StandardProjectWorkItemIdentity[] {
  return STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => ({ ...item }))
}

export function getStandardProjectWorkItemIdentityById(
  workItemId: string,
): StandardProjectWorkItemIdentity | null {
  const found = identityById.get(workItemId)
  return found ? { ...found } : null
}

export function getStandardProjectWorkItemIdentityByCode(
  workItemTypeCode: string,
): StandardProjectWorkItemIdentity | null {
  const found = identityByCode.get(workItemTypeCode)
  return found ? { ...found } : null
}

export function getStandardProjectWorkItemIdentityByName(
  workItemTypeName: string,
): StandardProjectWorkItemIdentity | null {
  const found = identityByName.get(normalizeLegacyWorkItemName(workItemTypeName))
  return found ? { ...found } : null
}

export function resolveLegacyProjectWorkItemIdentity(
  legacyName: string,
): StandardProjectWorkItemIdentity | null {
  const found = legacyMappingByName.get(normalizeLegacyWorkItemName(legacyName))
  return found ? { ...found } : null
}

export function resolveLegacyProjectWorkItemTypeCode(name: string): string | null {
  return resolveLegacyProjectWorkItemIdentity(name)?.workItemTypeCode ?? null
}

export function resolveLegacyProjectWorkItemId(name: string): string | null {
  return resolveLegacyProjectWorkItemIdentity(name)?.workItemId ?? null
}

export function getDefaultPhaseNameByWorkItemCode(workItemTypeCode: string): string {
  const identity = getStandardProjectWorkItemIdentityByCode(workItemTypeCode)
  return identity ? getProjectPhaseNameByCode(identity.phaseCode) : ''
}
