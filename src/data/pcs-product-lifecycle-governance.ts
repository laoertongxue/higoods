import type { PcsProjectChannelProductRecord } from './pcs-project-domain-contract.ts'
import type { StyleArchiveShellRecord } from './pcs-style-archive-types.ts'
import type { TechnicalDataVersionRecord } from './pcs-technical-data-version-types.ts'

export type StyleArchiveBusinessStatusKey = 'WAITING_BASE_INFO' | 'WAITING_TECH_PACK' | 'ACTIVE' | 'ARCHIVED'
export type TechPackAggregateStatusKey = 'UNCREATED' | 'DRAFT' | 'PUBLISHED_PENDING' | 'ACTIVE' | 'ARCHIVED'
export type TechPackVersionBusinessStatusKey = 'DRAFT' | 'PUBLISHED_PENDING' | 'ACTIVE' | 'ARCHIVED'
export type ChannelProductBusinessStatusKey =
  | 'PENDING_LISTING'
  | 'LISTED_TESTING'
  | 'ACTIVE_PENDING_SYNC'
  | 'ACTIVE_SYNCED'
  | 'INVALIDATED'

export interface LifecycleStatusRule {
  key: string
  label: string
  className: string
  scene: string
  operations: string[]
}

export interface ControlledFieldRuleGroup {
  title: string
  description: string
  fields: string[]
}

export const STYLE_ARCHIVE_STATUS_RULES: Record<StyleArchiveBusinessStatusKey, LifecycleStatusRule> = {
  WAITING_BASE_INFO: {
    key: 'WAITING_BASE_INFO',
    label: '待完善',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    scene: '已从商品项目生成款式档案草稿，但基础资料尚未补齐，不能进入正式建档。',
    operations: ['完善款式资料', '查看来源项目', '查看渠道店铺商品'],
  },
  WAITING_TECH_PACK: {
    key: 'WAITING_TECH_PACK',
    label: '已建档待技术包',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
    scene: '款式基础资料已完成正式建档，但还没有当前生效技术包版本，暂不能视为正式启用。',
    operations: ['查看技术包版本', '查看来源任务', '查看渠道店铺商品'],
  },
  ACTIVE: {
    key: 'ACTIVE',
    label: '已启用',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    scene: '已具备当前生效技术包版本，可被生产与下游模块正式读取和消费。',
    operations: ['查看当前生效技术包', '查看规格档案', '查看渠道店铺商品', '归档'],
  },
  ARCHIVED: {
    key: 'ARCHIVED',
    label: '已归档',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
    scene: '当前款式已转为历史档案，仅保留查看与追溯，不再作为当前研发或生产对象。',
    operations: ['查看历史资料', '恢复归档前状态'],
  },
}

export const TECH_PACK_AGGREGATE_STATUS_RULES: Record<TechPackAggregateStatusKey, LifecycleStatusRule> = {
  UNCREATED: {
    key: 'UNCREATED',
    label: '未建立',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
    scene: '当前款式还没有任何技术包版本，尚未进入技术包维护。',
    operations: ['等待来源任务生成技术包版本'],
  },
  DRAFT: {
    key: 'DRAFT',
    label: '草稿中',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    scene: '当前存在草稿技术包版本，可继续补齐内容，但还不能被下游正式消费。',
    operations: ['完善技术包内容', '发布技术包版本'],
  },
  PUBLISHED_PENDING: {
    key: 'PUBLISHED_PENDING',
    label: '已发布待启用',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    scene: '技术包版本已发布，但还没有被设为当前生效版本，因此款式仍不能按已启用处理。',
    operations: ['查看已发布版本', '启用为当前生效版本', '归档历史版本'],
  },
  ACTIVE: {
    key: 'ACTIVE',
    label: '已启用',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    scene: '当前已有生效技术包版本，款式和渠道商品可以按正式版本继续推进。',
    operations: ['查看当前生效版本', '复制为新草稿', '归档历史版本'],
  },
  ARCHIVED: {
    key: 'ARCHIVED',
    label: '已归档',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
    scene: '历史技术包版本已归档，仅保留查看与追溯，不再作为当前维护对象。',
    operations: ['查看历史版本'],
  },
}

export const CHANNEL_PRODUCT_STATUS_RULES: Record<ChannelProductBusinessStatusKey, LifecycleStatusRule> = {
  PENDING_LISTING: {
    key: 'PENDING_LISTING',
    label: '待上架',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
    scene: '渠道店铺商品实例已建立，但尚未完成上架动作。',
    operations: ['执行上架', '查看来源项目'],
  },
  LISTED_TESTING: {
    key: 'LISTED_TESTING',
    label: '已上架待测款',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    scene: '已完成上架，等待直播或短视频正式测款结论。',
    operations: ['查看测款记录', '提交测款汇总', '提交测款结论'],
  },
  ACTIVE_PENDING_SYNC: {
    key: 'ACTIVE_PENDING_SYNC',
    label: '已生效待更新',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    scene: '测款已通过且已关联款式档案，但上游最终商品信息尚未完成更新。',
    operations: ['查看款式档案', '查看当前技术包', '等待上游更新'],
  },
  ACTIVE_SYNCED: {
    key: 'ACTIVE_SYNCED',
    label: '已生效已更新',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    scene: '测款通过、款式档案已关联，并已完成上游最终更新，可作为正式渠道商品使用。',
    operations: ['查看款式档案', '查看规格档案', '查看上游更新结果'],
  },
  INVALIDATED: {
    key: 'INVALIDATED',
    label: '已作废',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
    scene: '测款结论不是通过，或后续链路已转入改版，当前渠道店铺商品不再继续使用。',
    operations: ['查看作废原因', '查看改版任务', '查看历史链路'],
  },
}

export const STYLE_ARCHIVE_CONTROLLED_FIELD_RULES: ControlledFieldRuleGroup[] = [
  {
    title: '正式建档前维护字段',
    description: '以下字段必须在正式建档前补齐，正式建档后不再允许页面直接修改。',
    fields: [
      '款式名称',
      '款号',
      '款式类型',
      '品牌',
      '一级类目',
      '二级类目',
      '年份',
      '季节标签',
      '风格标签',
      '目标人群',
      '目标渠道',
      '价格带',
      '款式主图',
      '卖点摘要',
      '详情描述',
    ],
  },
  {
    title: '正式建档后受控变更字段',
    description: '当前不做审批流程，这些字段先按只读处理；后续若接审批，再按受控变更方式开放。',
    fields: [
      '款式名称',
      '款号',
      '款式类型',
      '品牌',
      '一级类目',
      '二级类目',
      '年份',
      '季节标签',
      '风格标签',
      '目标人群',
      '目标渠道',
      '价格带',
      '款式主图',
      '卖点摘要',
      '详情描述',
    ],
  },
  {
    title: '正式建档后可直接补充字段',
    description: '正式建档完成后，当前仅保留少量补充说明字段可继续维护。',
    fields: ['包装信息', '备注'],
  },
]

export function isStyleArchiveFormalized(style: Pick<StyleArchiveShellRecord, 'baseInfoStatus'>): boolean {
  return style.baseInfoStatus === '已建档' || style.baseInfoStatus === '已维护'
}

export function resolveStyleArchiveBusinessStatus(
  style: Pick<StyleArchiveShellRecord, 'archiveStatus' | 'currentTechPackVersionId' | 'baseInfoStatus'>,
): StyleArchiveBusinessStatusKey {
  if (style.archiveStatus === 'ARCHIVED') return 'ARCHIVED'
  if (style.archiveStatus === 'ACTIVE' || style.currentTechPackVersionId) return 'ACTIVE'
  if (isStyleArchiveFormalized(style)) return 'WAITING_TECH_PACK'
  return 'WAITING_BASE_INFO'
}

export function resolveTechPackAggregateStatus(
  versions: Array<Pick<TechnicalDataVersionRecord, 'versionStatus'>>,
  currentVersionId: string,
): TechPackAggregateStatusKey {
  if (versions.length === 0) return 'UNCREATED'
  if (versions.some((item) => item.versionStatus === 'DRAFT')) return 'DRAFT'
  if (currentVersionId) return 'ACTIVE'
  if (versions.some((item) => item.versionStatus === 'PUBLISHED')) return 'PUBLISHED_PENDING'
  return 'ARCHIVED'
}

export function resolveTechPackVersionBusinessStatus(
  record: Pick<TechnicalDataVersionRecord, 'versionStatus' | 'technicalVersionId'>,
  currentVersionId: string,
): TechPackVersionBusinessStatusKey {
  if (record.versionStatus === 'ARCHIVED') return 'ARCHIVED'
  if (record.versionStatus === 'PUBLISHED' && currentVersionId === record.technicalVersionId) return 'ACTIVE'
  if (record.versionStatus === 'PUBLISHED') return 'PUBLISHED_PENDING'
  return 'DRAFT'
}

export function resolveChannelProductBusinessStatus(
  record: Pick<PcsProjectChannelProductRecord, 'channelProductStatus' | 'upstreamSyncStatus'>,
): ChannelProductBusinessStatusKey {
  if (record.channelProductStatus === '已作废') return 'INVALIDATED'
  if (record.channelProductStatus === '待上架') return 'PENDING_LISTING'
  if (record.channelProductStatus === '已上架待测款') return 'LISTED_TESTING'
  if (record.channelProductStatus === '已生效' && record.upstreamSyncStatus === '已更新') return 'ACTIVE_SYNCED'
  return 'ACTIVE_PENDING_SYNC'
}

export function normalizeStyleTechPackStatusText(status: string): string {
  if (status === '草稿' || status === '待完善') return '草稿中'
  if (status === '已发布') return '已发布待启用'
  return status || '未建立'
}

export function listUnifiedProductLifecycleRuleRows(): Array<{
  objectLabel: string
  statusLabel: string
  scene: string
  operations: string[]
}> {
  return [
    ...Object.values(STYLE_ARCHIVE_STATUS_RULES).map((item) => ({
      objectLabel: '款式档案',
      statusLabel: item.label,
      scene: item.scene,
      operations: item.operations,
    })),
    ...Object.values(TECH_PACK_AGGREGATE_STATUS_RULES).map((item) => ({
      objectLabel: '技术包',
      statusLabel: item.label,
      scene: item.scene,
      operations: item.operations,
    })),
    ...Object.values(CHANNEL_PRODUCT_STATUS_RULES).map((item) => ({
      objectLabel: '渠道店铺商品',
      statusLabel: item.label,
      scene: item.scene,
      operations: item.operations,
    })),
  ]
}
