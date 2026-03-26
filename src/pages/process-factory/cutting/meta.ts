/**
 * 裁片域页面元数据单一来源。
 *
 * 这里冻结 canonicalPath、可见 pageTitle 和 alias 兼容关系，
 * 目的是避免菜单、页面头部和旧路由标题再次漂移。
 * alias 只用于兼容旧入口；后续实现和内部跳转必须优先使用 canonicalPath。
 */
import { escapeHtml } from '../../../utils'

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
  | 'fei-ticket-detail'
  | 'fei-ticket-printed'
  | 'fei-ticket-records'
  | 'fei-ticket-print'
  | 'fei-ticket-continue-print'
  | 'fei-ticket-reprint'
  | 'fei-ticket-void'
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
  isPlaceholder: boolean
  futureStageHint?: string
  shortDescription?: string
}

export const CUTTING_PAGE_META: Record<CuttingCanonicalPageKey, CuttingPageMeta> = {
  'production-progress': {
    key: 'production-progress',
    canonicalPath: '/fcs/craft/cutting/production-progress',
    aliases: ['/fcs/craft/cutting', '/fcs/craft/cutting/order-progress', '/fcs/craft/cutting/tasks'],
    menuGroupTitle: '裁片总览',
    pageTitle: '生产单进度',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '按生产单查看裁片进度。',
  },
  'cuttable-pool': {
    key: 'cuttable-pool',
    canonicalPath: '/fcs/craft/cutting/cuttable-pool',
    aliases: [],
    menuGroupTitle: '裁片总览',
    pageTitle: '可裁排产',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看可裁范围与排产选择。',
  },
  'merge-batches': {
    key: 'merge-batches',
    canonicalPath: '/fcs/craft/cutting/merge-batches',
    aliases: [],
    menuGroupTitle: '裁片总览',
    pageTitle: '合并裁剪批次',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '管理合并裁剪批次。',
  },
  'original-orders': {
    key: 'original-orders',
    canonicalPath: '/fcs/craft/cutting/original-orders',
    aliases: ['/fcs/craft/cutting/orders', '/fcs/craft/cutting/cut-piece-orders'],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '原始裁片单',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看原始裁片单与执行记录。',
  },
  'material-prep': {
    key: 'material-prep',
    canonicalPath: '/fcs/craft/cutting/material-prep',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '仓库配料领料',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看配料、领料与裁片单主码。',
  },
  'marker-spreading': {
    key: 'marker-spreading',
    canonicalPath: '/fcs/craft/cutting/marker-spreading',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '唛架铺布',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看唛架与铺布记录。',
  },
  'marker-detail': {
    key: 'marker-detail',
    canonicalPath: '/fcs/craft/cutting/marker-detail',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '唛架详情',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看唛架明细。',
  },
  'marker-edit': {
    key: 'marker-edit',
    canonicalPath: '/fcs/craft/cutting/marker-edit',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '唛架编辑',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '编辑唛架。',
  },
  'spreading-detail': {
    key: 'spreading-detail',
    canonicalPath: '/fcs/craft/cutting/spreading-detail',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '铺布详情',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看铺布明细。',
  },
  'spreading-edit': {
    key: 'spreading-edit',
    canonicalPath: '/fcs/craft/cutting/spreading-edit',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '铺布编辑',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '编辑铺布。',
  },
  'fei-tickets': {
    key: 'fei-tickets',
    canonicalPath: '/fcs/craft/cutting/fei-tickets',
    aliases: ['/fcs/craft/cutting/fei-ticket', '/fcs/craft/cutting/fei-list'],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '打印菲票',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看可打印单元与打印状态。',
  },
  'fei-ticket-detail': {
    key: 'fei-ticket-detail',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-detail',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '打印菲票详情',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看打印单元、菲票码与打印记录。',
  },
  'fei-ticket-printed': {
    key: 'fei-ticket-printed',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-printed',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '已打印菲票',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看已打印菲票与作废记录。',
  },
  'fei-ticket-records': {
    key: 'fei-ticket-records',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-records',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '打印菲票记录',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看打印流水。',
  },
  'fei-ticket-print': {
    key: 'fei-ticket-print',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-print',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '打印菲票',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '首次打印菲票。',
  },
  'fei-ticket-continue-print': {
    key: 'fei-ticket-continue-print',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-continue-print',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '继续打印菲票',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '继续打印缺口菲票。',
  },
  'fei-ticket-reprint': {
    key: 'fei-ticket-reprint',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-reprint',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '补打菲票',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '补打菲票。',
  },
  'fei-ticket-void': {
    key: 'fei-ticket-void',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-void',
    aliases: [],
    menuGroupTitle: '裁片执行准备',
    pageTitle: '作废菲票',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '作废单张菲票。',
  },
  'fabric-warehouse': {
    key: 'fabric-warehouse',
    canonicalPath: '/fcs/craft/cutting/fabric-warehouse',
    aliases: [],
    menuGroupTitle: '裁片仓交接',
    pageTitle: '裁床仓',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看裁床仓库存。',
  },
  'cut-piece-warehouse': {
    key: 'cut-piece-warehouse',
    canonicalPath: '/fcs/craft/cutting/cut-piece-warehouse',
    aliases: [],
    menuGroupTitle: '裁片仓交接',
    pageTitle: '裁片仓',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看裁片仓状态。',
  },
  'sample-warehouse': {
    key: 'sample-warehouse',
    canonicalPath: '/fcs/craft/cutting/sample-warehouse',
    aliases: [],
    menuGroupTitle: '裁片仓交接',
    pageTitle: '样衣仓',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看样衣仓记录。',
  },
  'transfer-bags': {
    key: 'transfer-bags',
    canonicalPath: '/fcs/craft/cutting/transfer-bags',
    aliases: [],
    menuGroupTitle: '裁片仓交接',
    pageTitle: '周转口袋车缝交接',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看周转口袋、装袋与父子码映射。',
  },
  replenishment: {
    key: 'replenishment',
    canonicalPath: '/fcs/craft/cutting/replenishment',
    aliases: [],
    menuGroupTitle: '裁片后续管理',
    pageTitle: '补料管理',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看补料建议与影响。',
  },
  'special-processes': {
    key: 'special-processes',
    canonicalPath: '/fcs/craft/cutting/special-processes',
    aliases: [],
    menuGroupTitle: '裁片后续管理',
    pageTitle: '特殊工艺',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看特殊工艺单。',
  },
  summary: {
    key: 'summary',
    canonicalPath: '/fcs/craft/cutting/summary',
    aliases: ['/fcs/craft/cutting/stats', '/fcs/craft/cutting/bed-stats', '/fcs/craft/cutting/cutting-summary'],
    menuGroupTitle: '裁片后续管理',
    pageTitle: '裁剪总表',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看裁片域总表。',
  },
}

// 旧“仓库管理”仍保留兼容入口，但页面语义已经收口到“裁片仓交接”。
const CUTTING_WAREHOUSE_COMPAT_META: CuttingPageMeta = {
  key: 'warehouse-compat',
  canonicalPath: '/fcs/craft/cutting/fabric-warehouse',
  aliases: ['/fcs/craft/cutting/warehouse', '/fcs/craft/cutting/warehouse-management'],
  menuGroupTitle: '裁片仓交接',
  pageTitle: '裁片仓交接',
  pageSubtitle: '',
  isPlaceholder: false,
  shortDescription: '旧仓库入口兼容页。',
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
  return `
    <header class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 class="text-xl font-bold">${escapeHtml(meta.pageTitle)}</h1>
      </div>
      ${options.actionsHtml ?? ''}
    </header>
  `
}
