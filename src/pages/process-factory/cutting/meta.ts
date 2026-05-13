/**
 * 裁片域页面元数据单一来源。
 *
 * 这里固定 canonicalPath 与可见 pageTitle，菜单、页面头部和路由标题统一读取。
 */
import { escapeHtml } from '../../../utils.ts'

export type CuttingCanonicalPageKey =
  | 'production-progress'
  | 'cuttable-pool'
  | 'merge-batches'
  | 'original-orders'
  | 'marker-list'
  | 'marker-create'
  | 'spreading-list'
  | 'spreading-create'
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
  | 'warehouse-management-wait-process'
  | 'warehouse-management-wait-handover'
  | 'fabric-warehouse'
  | 'cut-piece-warehouse'
  | 'sample-warehouse'
  | 'transfer-bags'
  | 'transfer-bag-detail'
  | 'replenishment'
  | 'special-craft-dispatch'
  | 'special-craft-return'
  | 'sewing-dispatch'
  | 'special-processes'
  | 'summary'

type CuttingPageKey = CuttingCanonicalPageKey

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
    aliases: [],
    menuGroupTitle: '裁床总览',
    pageTitle: '生产单进度',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '按生产单查看裁片进度。',
  },
  'cuttable-pool': {
    key: 'cuttable-pool',
    canonicalPath: '/fcs/craft/cutting/cuttable-pool',
    aliases: [],
    menuGroupTitle: '裁前准备',
    pageTitle: '可裁排产',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看可裁范围与排产选择。',
  },
  'merge-batches': {
    key: 'merge-batches',
    canonicalPath: '/fcs/craft/cutting/merge-batches',
    aliases: [],
    menuGroupTitle: '裁前准备',
    pageTitle: '合并裁剪批次',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '管理合并裁剪批次。',
  },
  'original-orders': {
    key: 'original-orders',
    canonicalPath: '/fcs/craft/cutting/original-orders',
    aliases: [],
    menuGroupTitle: '裁前准备',
    pageTitle: '原始裁片单',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看原始裁片单与执行记录。',
  },
  'marker-list': {
    key: 'marker-list',
    canonicalPath: '/fcs/craft/cutting/marker-list',
    aliases: [],
    menuGroupTitle: '裁前准备',
    pageTitle: '唛架方案列表',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看排唛架方案与唛架编号。',
  },
  'marker-create': {
    key: 'marker-create',
    canonicalPath: '/fcs/craft/cutting/marker-create',
    aliases: [],
    menuGroupTitle: '裁前准备',
    pageTitle: '新建排唛架方案',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '从同一款式来源单据新建排唛架方案。',
  },
  'spreading-list': {
    key: 'spreading-list',
    canonicalPath: '/fcs/craft/cutting/spreading-list',
    aliases: [],
    menuGroupTitle: '铺布执行',
    pageTitle: '铺布列表',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看铺布任务、执行状态与补料预警。',
  },
  'spreading-create': {
    key: 'spreading-create',
    canonicalPath: '/fcs/craft/cutting/spreading-create',
    aliases: [],
    menuGroupTitle: '铺布执行',
    pageTitle: '新建铺布',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '基于排唛架方案中的唛架编号新建铺布任务。',
  },
  'marker-spreading': {
    key: 'marker-spreading',
    canonicalPath: '/fcs/craft/cutting/marker-spreading',
    aliases: [],
    menuGroupTitle: '铺布执行',
    pageTitle: '铺布记录',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看铺布记录与执行状态。',
  },
  'marker-detail': {
    key: 'marker-detail',
    canonicalPath: '/fcs/craft/cutting/marker-detail',
    aliases: [],
    menuGroupTitle: '裁前准备',
    pageTitle: '排唛架方案详情',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看排唛架方案、床次和图片。',
  },
  'marker-edit': {
    key: 'marker-edit',
    canonicalPath: '/fcs/craft/cutting/marker-edit',
    aliases: [],
    menuGroupTitle: '裁前准备',
    pageTitle: '编辑排唛架方案',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '编辑排唛架方案计划。',
  },
  'spreading-detail': {
    key: 'spreading-detail',
    canonicalPath: '/fcs/craft/cutting/spreading-detail',
    aliases: [],
    menuGroupTitle: '铺布执行',
    pageTitle: '铺布详情',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看铺布明细。',
  },
  'spreading-edit': {
    key: 'spreading-edit',
    canonicalPath: '/fcs/craft/cutting/spreading-edit',
    aliases: [],
    menuGroupTitle: '铺布执行',
    pageTitle: '铺布编辑',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '编辑铺布。',
  },
  'fei-tickets': {
    key: 'fei-tickets',
    canonicalPath: '/fcs/craft/cutting/fei-tickets',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '首次打印菲票',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看可打印单元与打印状态。',
  },
  'fei-ticket-detail': {
    key: 'fei-ticket-detail',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-detail',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '打印菲票详情',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看打印单元、菲票码与打印记录。',
  },
  'fei-ticket-printed': {
    key: 'fei-ticket-printed',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-printed',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '已打印菲票',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看已打印菲票与作废记录。',
  },
  'fei-ticket-records': {
    key: 'fei-ticket-records',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-records',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '打印菲票记录',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看打印流水。',
  },
  'fei-ticket-print': {
    key: 'fei-ticket-print',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-print',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '打印菲票',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '首次打印菲票。',
  },
  'fei-ticket-continue-print': {
    key: 'fei-ticket-continue-print',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-continue-print',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '继续打印菲票',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '继续打印缺口菲票。',
  },
  'fei-ticket-reprint': {
    key: 'fei-ticket-reprint',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-reprint',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '补打菲票',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '补打菲票。',
  },
  'fei-ticket-void': {
    key: 'fei-ticket-void',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-void',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '作废菲票',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '作废单张菲票。',
  },
  'warehouse-management-wait-process': {
    key: 'warehouse-management-wait-process',
    canonicalPath: '/fcs/craft/cutting/warehouse-management/wait-process',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '待加工仓',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '在待加工总览、裁床仓和特殊工艺待加工 / 发料之间切换。',
  },
  'warehouse-management-wait-handover': {
    key: 'warehouse-management-wait-handover',
    canonicalPath: '/fcs/craft/cutting/warehouse-management/wait-handover',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '待交出仓',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '在待交出总览、裁片仓、特殊工艺回仓和裁片发料之间切换。',
  },
  'fabric-warehouse': {
    key: 'fabric-warehouse',
    canonicalPath: '/fcs/craft/cutting/warehouse-management/wait-process?tab=fabric-warehouse',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '裁床仓',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看裁床仓库存。',
  },
  'cut-piece-warehouse': {
    key: 'cut-piece-warehouse',
    canonicalPath: '/fcs/craft/cutting/warehouse-management/wait-handover?tab=cut-piece-warehouse',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '裁片仓',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看裁片仓状态。',
  },
  'sample-warehouse': {
    key: 'sample-warehouse',
    canonicalPath: '/fcs/craft/cutting/sample-warehouse',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '样衣仓',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '在样衣库存、样衣流转和样衣异常 / 待归还之间切换。',
  },
  'transfer-bags': {
    key: 'transfer-bags',
    canonicalPath: '/fcs/craft/cutting/transfer-bags',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '中转袋流转',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看中转袋流转状态、筛选对象并进入详情。',
  },
  'transfer-bag-detail': {
    key: 'transfer-bag-detail',
    canonicalPath: '/fcs/craft/cutting/transfer-bag-detail',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '中转袋详情',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看单个中转袋的流转详情、二维码与使用周期工作区。',
  },
  replenishment: {
    key: 'replenishment',
    canonicalPath: '/fcs/craft/cutting/replenishment',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '补料管理',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看补料建议与影响。',
  },
  'special-craft-dispatch': {
    key: 'special-craft-dispatch',
    canonicalPath: '/fcs/craft/cutting/warehouse-management/wait-process?tab=special-craft-dispatch',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '特殊工艺发料',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '按菲票发料到特殊工艺厂。',
  },
  'special-craft-return': {
    key: 'special-craft-return',
    canonicalPath: '/fcs/craft/cutting/warehouse-management/wait-handover?tab=special-craft-return',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '特殊工艺回仓',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '按菲票确认特殊工艺回仓。',
  },
  'sewing-dispatch': {
    key: 'sewing-dispatch',
    canonicalPath: '/fcs/craft/cutting/warehouse-management/wait-handover?tab=sewing-dispatch',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '裁片发料',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '按本次发料件数齐套后统一发给车缝厂。',
  },
  'special-processes': {
    key: 'special-processes',
    canonicalPath: '/fcs/craft/cutting/special-processes',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '特殊工艺',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看特殊工艺单。',
  },
  summary: {
    key: 'summary',
    canonicalPath: '/fcs/craft/cutting/summary',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '裁剪总结',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看裁剪总结。',
  },
}

const CUTTING_META_LIST = Object.values(CUTTING_PAGE_META)

export function getCanonicalCuttingMeta(pathname: string, fallbackKey?: CuttingPageKey): CuttingPageMeta {
  const matched = CUTTING_META_LIST.find((item) => item.canonicalPath === pathname || item.aliases.includes(pathname))
  if (matched) return matched
  if (fallbackKey) return CUTTING_PAGE_META[fallbackKey]
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
    showAliasBadge?: boolean
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
