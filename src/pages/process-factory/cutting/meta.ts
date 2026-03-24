/**
 * 裁片域页面元数据单一来源。
 *
 * 这里冻结 canonicalPath、可见 pageTitle / breadcrumb / subtitle 和 alias 兼容关系，
 * 目的是避免菜单、页面头部、breadcrumb 和旧路由标题再次漂移。
 * alias 只用于兼容旧入口；后续实现和内部跳转必须优先使用 canonicalPath。
 */
import { escapeHtml } from '../../../utils'

const CUTTING_SYSTEM_TITLE = '工艺工厂运营系统'

export type CuttingCanonicalPageKey =
  | 'production-progress'
  | 'cuttable-pool'
  | 'merge-batches'
  | 'original-orders'
  | 'material-prep'
  | 'marker-spreading'
  | 'marker-detail'
  | 'marker-edit'
  | 'spreading-detail'
  | 'spreading-edit'
  | 'fei-tickets'
  | 'fabric-warehouse'
  | 'cut-piece-warehouse'
  | 'sample-warehouse'
  | 'transfer-bags'
  | 'replenishment'
  | 'special-processes'
  | 'summary'

type CuttingPageKey = CuttingCanonicalPageKey | 'warehouse-compat'

export interface CuttingPageMeta {
  key: CuttingPageKey
  canonicalPath: string
  aliases: string[]
  menuGroupTitle: string
  pageTitle: string
  pageSubtitle: string
  breadcrumb: [string, string, string]
  isPlaceholder: boolean
  futureStageHint?: string
  shortDescription?: string
}

const createBreadcrumb = (menuGroupTitle: string, pageTitle: string): [string, string, string] => [
  CUTTING_SYSTEM_TITLE,
  menuGroupTitle,
  pageTitle,
]

export const CUTTING_PAGE_META: Record<CuttingCanonicalPageKey, CuttingPageMeta> = {
  'production-progress': {
    key: 'production-progress',
    canonicalPath: '/fcs/craft/cutting/production-progress',
    aliases: ['/fcs/craft/cutting', '/fcs/craft/cutting/order-progress', '/fcs/craft/cutting/tasks'],
    menuGroupTitle: '裁片总览',
    pageTitle: '生产单进度',
    pageSubtitle: '按生产单查看裁片域进度、配料覆盖、领料状态与裁剪阶段概览',
    breadcrumb: createBreadcrumb('裁片总览', '生产单进度'),
    isPlaceholder: false,
    shortDescription: '按生产单查看裁片域进度、配料覆盖、领料状态与裁剪阶段概览。',
  },
  'cuttable-pool': {
    key: 'cuttable-pool',
    canonicalPath: '/fcs/craft/cutting/cuttable-pool',
    aliases: [],
    menuGroupTitle: '裁片总览',
    pageTitle: '可裁排产',
    pageSubtitle: '按同款与原始裁片单判断可裁范围，并组织本次裁床排产选择',
    breadcrumb: createBreadcrumb('裁片总览', '可裁排产'),
    isPlaceholder: false,
    shortDescription: '承接同款下原始裁片单的“可裁判断”和排产选择。',
  },
  'merge-batches': {
    key: 'merge-batches',
    canonicalPath: '/fcs/craft/cutting/merge-batches',
    aliases: [],
    menuGroupTitle: '裁片总览',
    pageTitle: '合并裁剪批次',
    pageSubtitle: '管理多个原始裁片单在执行层的合并裁剪批次，不改变原始单归属',
    breadcrumb: createBreadcrumb('裁片总览', '合并裁剪批次'),
    isPlaceholder: false,
    shortDescription: '承接多个原始裁片单在执行层的合并裁剪批次。',
  },
  'original-orders': {
    key: 'original-orders',
    canonicalPath: '/fcs/craft/cutting/original-orders',
    aliases: ['/fcs/craft/cutting/orders', '/fcs/craft/cutting/cut-piece-orders'],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '裁片单（原始单）',
    pageSubtitle: '管理原始裁片单身份、来源生产单、面料信息、关联记录与执行痕迹',
    breadcrumb: createBreadcrumb('裁片执行准备', '裁片单（原始单）'),
    isPlaceholder: false,
    shortDescription: '管理原始裁片单身份、来源生产单、面料信息、关联记录与执行痕迹。',
  },
  'material-prep': {
    key: 'material-prep',
    canonicalPath: '/fcs/craft/cutting/material-prep',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '仓库配料 / 领料',
    pageSubtitle: '查看配料、领料与同一码贯穿状态，承接仓库与裁床之间的物料衔接',
    breadcrumb: createBreadcrumb('裁片执行准备', '仓库配料 / 领料'),
    isPlaceholder: false,
    shortDescription: '查看配料、领料与同一码贯穿状态，承接仓库与裁床之间的物料衔接。',
  },
  'marker-spreading': {
    key: 'marker-spreading',
    canonicalPath: '/fcs/craft/cutting/marker-spreading',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '唛架 / 铺布',
    pageSubtitle: '承接唛架信息、铺布模式、铺布记录与后续补料判断基础数据',
    breadcrumb: createBreadcrumb('裁片执行准备', '唛架 / 铺布'),
    isPlaceholder: false,
    shortDescription: '承接唛架信息、铺布模式、铺布记录与后续补料判断基础数据。',
  },
  'marker-detail': {
    key: 'marker-detail',
    canonicalPath: '/fcs/craft/cutting/marker-detail',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '唛架详情',
    pageSubtitle: '查看唛架模式、尺码配比、排版明细、唛架图与调整入口占位',
    breadcrumb: createBreadcrumb('裁片执行准备', '唛架详情'),
    isPlaceholder: false,
    shortDescription: '查看唛架模式、尺码配比、排版明细、唛架图与调整入口占位。',
  },
  'marker-edit': {
    key: 'marker-edit',
    canonicalPath: '/fcs/craft/cutting/marker-edit',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '唛架编辑',
    pageSubtitle: '编辑唛架基础信息、尺码配比、排版明细与图片备注骨架',
    breadcrumb: createBreadcrumb('裁片执行准备', '唛架编辑'),
    isPlaceholder: false,
    shortDescription: '编辑唛架基础信息、尺码配比、排版明细与图片备注骨架。',
  },
  'spreading-detail': {
    key: 'spreading-detail',
    canonicalPath: '/fcs/craft/cutting/spreading-detail',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '铺布详情',
    pageSubtitle: '查看铺布 session、关联唛架、卷记录、人员记录与汇总数据',
    breadcrumb: createBreadcrumb('裁片执行准备', '铺布详情'),
    isPlaceholder: false,
    shortDescription: '查看铺布 session、关联唛架、卷记录、人员记录与汇总数据。',
  },
  'spreading-edit': {
    key: 'spreading-edit',
    canonicalPath: '/fcs/craft/cutting/spreading-edit',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '铺布编辑',
    pageSubtitle: '编辑铺布 session、卷记录、人员记录与汇总骨架',
    breadcrumb: createBreadcrumb('裁片执行准备', '铺布编辑'),
    isPlaceholder: false,
    shortDescription: '编辑铺布 session、卷记录、人员记录与汇总骨架。',
  },
  'fei-tickets': {
    key: 'fei-tickets',
    canonicalPath: '/fcs/craft/cutting/fei-tickets',
    aliases: ['/fcs/craft/cutting/fei-ticket', '/fcs/craft/cutting/fei-list'],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '菲票 / 打编号',
    pageSubtitle: '承接原始裁片单维度的菲票生成、打编号、打印预览与打印记录；打印归属始终回落原始裁片单',
    breadcrumb: createBreadcrumb('裁片执行准备', '菲票 / 打编号'),
    isPlaceholder: false,
    shortDescription: '承接原始裁片单维度的菲票生成、打编号、打印预览与打印记录。',
  },
  'fabric-warehouse': {
    key: 'fabric-warehouse',
    canonicalPath: '/fcs/craft/cutting/fabric-warehouse',
    aliases: [],
    menuGroupTitle: '裁片仓交接',
    pageTitle: '裁床仓',
    pageSubtitle: '查看裁床侧配置面料库存、剩余面料库存与当前可用面料明细',
    breadcrumb: createBreadcrumb('裁片仓交接', '裁床仓'),
    isPlaceholder: false,
    shortDescription: '查看裁床侧配置面料库存、剩余面料库存与当前可用面料明细。',
  },
  'cut-piece-warehouse': {
    key: 'cut-piece-warehouse',
    canonicalPath: '/fcs/craft/cutting/cut-piece-warehouse',
    aliases: [],
    menuGroupTitle: '裁片仓交接',
    pageTitle: '裁片仓',
    pageSubtitle: '管理裁片完成后的入仓、分区、查找与待交接状态',
    breadcrumb: createBreadcrumb('裁片仓交接', '裁片仓'),
    isPlaceholder: false,
    shortDescription: '管理裁片完成后的入仓、分区、查找与待交接状态。',
  },
  'sample-warehouse': {
    key: 'sample-warehouse',
    canonicalPath: '/fcs/craft/cutting/sample-warehouse',
    aliases: [],
    menuGroupTitle: '裁片仓交接',
    pageTitle: '样衣仓',
    pageSubtitle: '管理裁床侧样衣的存放、借用、归还、位置与流转记录',
    breadcrumb: createBreadcrumb('裁片仓交接', '样衣仓'),
    isPlaceholder: false,
    shortDescription: '管理裁床侧样衣的存放、借用、归还、位置与流转记录。',
  },
  'transfer-bags': {
    key: 'transfer-bags',
    canonicalPath: '/fcs/craft/cutting/transfer-bags',
    aliases: [],
    menuGroupTitle: '裁片仓交接',
    pageTitle: '周转口袋 / 车缝交接',
    pageSubtitle: '管理周转口袋主档、装袋映射、车缝交接、回货入仓与复用周期',
    breadcrumb: createBreadcrumb('裁片仓交接', '周转口袋 / 车缝交接'),
    isPlaceholder: false,
    shortDescription: '管理周转口袋主档、单次使用周期、父子码映射、车缝交接、回货入仓与复用周期。',
  },
  replenishment: {
    key: 'replenishment',
    canonicalPath: '/fcs/craft/cutting/replenishment',
    aliases: [],
    menuGroupTitle: '裁片异常收口',
    pageTitle: '补料管理',
    pageSubtitle: '基于铺布与裁剪差异管理补料建议、审核与回写动作',
    breadcrumb: createBreadcrumb('裁片异常收口', '补料管理'),
    isPlaceholder: false,
    shortDescription: '基于铺布与裁剪差异管理补料建议、审核与回写动作。',
  },
  'special-processes': {
    key: 'special-processes',
    canonicalPath: '/fcs/craft/cutting/special-processes',
    aliases: [],
    menuGroupTitle: '裁片异常收口',
    pageTitle: '特殊工艺',
    pageSubtitle: '管理需单独承接的裁片厂特殊工艺任务与工艺单记录',
    breadcrumb: createBreadcrumb('裁片异常收口', '特殊工艺'),
    isPlaceholder: false,
    shortDescription: '管理需单独承接的裁片厂特殊工艺任务与工艺单记录。',
  },
  summary: {
    key: 'summary',
    canonicalPath: '/fcs/craft/cutting/summary',
    aliases: ['/fcs/craft/cutting/stats', '/fcs/craft/cutting/bed-stats', '/fcs/craft/cutting/cutting-summary'],
    menuGroupTitle: '裁片异常收口',
    pageTitle: '裁剪总结',
    pageSubtitle: '汇总生产单、原始裁片单、批次、仓储、打票、补料与交接信息，形成裁片域总收口视图',
    breadcrumb: createBreadcrumb('裁片异常收口', '裁剪总结'),
    isPlaceholder: false,
    shortDescription: '汇总生产单、原始裁片单、批次、仓储、打票、补料与交接信息，形成裁片域总收口视图。',
  },
}

// 旧“仓库管理”仍保留兼容入口，但页面语义已经收口到“裁片仓交接”。
const CUTTING_WAREHOUSE_COMPAT_META: CuttingPageMeta = {
  key: 'warehouse-compat',
  canonicalPath: '/fcs/craft/cutting/fabric-warehouse',
  aliases: ['/fcs/craft/cutting/warehouse', '/fcs/craft/cutting/warehouse-management'],
  menuGroupTitle: '裁片仓交接',
  pageTitle: '裁片仓交接',
  pageSubtitle: '当前兼容总览仅用于承接旧仓库管理入口，后续访问与跳转应优先进入拆分后的仓交接页面',
  breadcrumb: createBreadcrumb('裁片仓交接', '裁片仓交接'),
  isPlaceholder: false,
  shortDescription: '兼容旧仓库管理入口的总览页，后续以裁床仓、裁片仓、样衣仓和周转口袋 / 车缝交接为主入口。',
}

const CUTTING_META_LIST = [...Object.values(CUTTING_PAGE_META), CUTTING_WAREHOUSE_COMPAT_META]

export function getCanonicalCuttingMeta(pathname: string, fallbackKey?: CuttingPageKey): CuttingPageMeta {
  const matched = CUTTING_META_LIST.find((item) => item.canonicalPath === pathname || item.aliases.includes(pathname))
  if (matched) return matched
  if (fallbackKey === 'warehouse-compat') return CUTTING_WAREHOUSE_COMPAT_META
  if (fallbackKey) {
    return fallbackKey in CUTTING_PAGE_META
      ? CUTTING_PAGE_META[fallbackKey as CuttingCanonicalPageKey]
      : CUTTING_WAREHOUSE_COMPAT_META
  }
  return CUTTING_PAGE_META['production-progress']
}

export function isCuttingAliasPath(pathname: string): boolean {
  const meta = getCanonicalCuttingMeta(pathname)
  return meta.aliases.includes(pathname)
}

export function getCanonicalCuttingPath(key: CuttingCanonicalPageKey): string {
  return CUTTING_PAGE_META[key].canonicalPath
}

function renderHeaderBadge(label: string, tone: 'blue' | 'amber' = 'blue'): string {
  const className =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-sky-50 text-sky-700 border-sky-200'
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

export function renderCuttingPageHeader(
  meta: CuttingPageMeta,
  options: {
    actionsHtml?: string
    showCompatibilityBadge?: boolean
    showPlaceholderBadge?: boolean
  } = {},
): string {
  const badges = [
    options.showCompatibilityBadge ? renderHeaderBadge('兼容入口', 'amber') : '',
    options.showPlaceholderBadge ? renderHeaderBadge('占位页', 'blue') : '',
  ]
    .filter(Boolean)
    .join('')

  return `
    <header class="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="mb-1 text-sm text-muted-foreground">${escapeHtml(meta.breadcrumb.join(' / '))}</p>
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-xl font-bold">${escapeHtml(meta.pageTitle)}</h1>
          ${badges}
        </div>
        <p class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(meta.pageSubtitle)}</p>
      </div>
      ${options.actionsHtml ?? ''}
    </header>
  `
}
