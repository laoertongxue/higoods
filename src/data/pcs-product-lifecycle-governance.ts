import type { PcsProjectChannelProductRecord } from './pcs-project-domain-contract.ts'
import type { StyleArchiveShellRecord } from './pcs-style-archive-types.ts'
import type { TechnicalDataVersionRecord } from './pcs-technical-data-version-types.ts'

export type StyleArchiveBusinessStatusKey = 'WAITING_BASE_INFO' | 'NOT_ENABLED' | 'INACTIVE' | 'ACTIVE' | 'ARCHIVED'
export type TechPackAggregateStatusKey = 'UNCREATED' | 'DRAFT' | 'PUBLISHED_PENDING' | 'ACTIVE' | 'ARCHIVED'
export type TechPackVersionBusinessStatusKey = 'DRAFT' | 'PUBLISHED_PENDING' | 'ACTIVE' | 'ARCHIVED'
export type ChannelProductBusinessStatusKey =
  | 'PENDING_LISTING'
  | 'UPLOADED_PENDING_CONFIRM'
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
    scene: '款式档案处于草稿或审核过程中，可继续完善资料。',
    operations: ['完善款式资料', '提交审核', '查看渠道店铺商品'],
  },
  NOT_ENABLED: {
    key: 'NOT_ENABLED',
    label: '未启用',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
    scene: '档案资料已建立，审核通过后可启用；技术包按其自身业务规则管理。',
    operations: ['查看技术包版本', '查看来源任务', '查看渠道店铺商品'],
  },
  ACTIVE: {
    key: 'ACTIVE',
    label: '已启用',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    scene: '商品档案已启用；生产使用条件由对应技术与生产业务判断。',
    operations: ['查看当前生效技术包', '查看规格档案', '查看渠道店铺商品', '归档'],
  },
  INACTIVE: { key: 'INACTIVE', label: '停用', className: 'border-slate-200 bg-slate-50 text-slate-600', scene: '停止新业务使用，历史引用保留。', operations: ['启用', '查看历史资料'] },
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
    operations: ['等待来源任务建立技术包版本'],
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
    scene: '技术包版本已发布，但还没有被设为当前生效版本，由技术资料启用规则继续处理，不改变商品档案的审核与使用状态。',
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
    label: '待上传',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
    scene: '款式上架批次已建立，但尚未上传到上游渠道。',
    operations: ['上传款式到渠道', '查看来源项目'],
  },
  UPLOADED_PENDING_CONFIRM: {
    key: 'UPLOADED_PENDING_CONFIRM',
    label: '已上传待确认',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    scene: '款式已上传到上游渠道，等待项目内确认并标记商品上架完成。',
    operations: ['确认上传结果', '标记商品上架完成'],
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
    scene: '判断已通过且已关联款式档案，但上游最终商品信息尚未完成更新。',
    operations: ['查看款式档案', '查看当前技术包', '等待上游更新'],
  },
  ACTIVE_SYNCED: {
    key: 'ACTIVE_SYNCED',
    label: '已生效已更新',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    scene: '判断通过、款式档案已关联，并已完成上游最终更新，可作为正式渠道商品使用。',
    operations: ['查看款式档案', '查看规格档案', '查看上游更新结果'],
  },
  INVALIDATED: {
    key: 'INVALIDATED',
    label: '已作废',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
    scene: '测款结论不是通过，或后续链路已转入改版，当前渠道店铺商品不再继续使用。',
    operations: ['查看作废原因', '查看设计改款任务', '查看历史链路'],
  },
}

export const STYLE_ARCHIVE_CONTROLLED_FIELD_RULES: ControlledFieldRuleGroup[] = [
  { title: '档案身份', description: '审核通过后款式编码和交付方式锁定，交付身份变化建立新档案。', fields: ['款式编码', '交付方式'] },
  { title: '资料维护', description: '展示内容、分类属性、图片和说明可由资料维护人更新并留下记录。', fields: ['款式名称', '品牌', '正式类目', '品类', '风格', '品类编号', '图片', '销售基础内容', '备注'] },
]

export function isStyleArchiveFormalized(style: Pick<StyleArchiveShellRecord, 'baseInfoStatus'>): boolean {
  return style.baseInfoStatus === '已建档' || style.baseInfoStatus === '已维护'
}

export function resolveStyleArchiveBusinessStatus(
  style: Pick<StyleArchiveShellRecord, 'archiveStatus' | 'currentTechPackVersionId' | 'baseInfoStatus' | 'lifecycleStatus' | 'approvalStatus'>,
): StyleArchiveBusinessStatusKey {
  if (style.lifecycleStatus === 'ARCHIVED' || style.archiveStatus === 'ARCHIVED') return 'ARCHIVED'
  if (style.lifecycleStatus === 'INACTIVE') return 'INACTIVE'
  if (style.lifecycleStatus === 'ACTIVE' || (!style.lifecycleStatus && style.archiveStatus === 'ACTIVE')) return 'ACTIVE'
  if (style.approvalStatus === 'APPROVED' || isStyleArchiveFormalized(style)) return 'NOT_ENABLED'
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
  if (record.channelProductStatus === '待上传') return 'PENDING_LISTING'
  if (record.channelProductStatus === '已上传待确认') return 'UPLOADED_PENDING_CONFIRM'
  if (record.channelProductStatus === '已完成') return 'LISTED_TESTING'
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
