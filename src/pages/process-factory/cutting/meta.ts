/**
 * 裁片域页面元数据单一来源。
 *
 * 这里固定 canonicalPath 与可见 pageTitle，菜单、页面头部和路由标题统一读取。
 */
import { escapeHtml } from '../../../utils.ts'

export type CuttingCanonicalPageKey =
  | 'production-progress'
  | 'cut-orders'
  | 'cut-order-close'
  | 'pickup-management'
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
  | 'binding-fei-tickets'
  | 'fei-ticket-detail'
  | 'fei-ticket-printed'
  | 'fei-ticket-print'
  | 'fei-ticket-reprint'
  | 'fei-ticket-numbering'
  | 'warehouse-management-wait-process'
  | 'warehouse-management-wait-handover'
  | 'fabric-warehouse'
  | 'cut-piece-warehouse'
  | 'sample-warehouse'
  | 'transfer-bags'
  | 'transfer-bag-detail'
  | 'handover-orders'
  | 'handover-order-detail'
  | 'handover-record-detail'
  | 'replenishment'
  | 'special-craft-dispatch'
  | 'special-craft-return'
  | 'sewing-dispatch'
  | 'special-processes'
  | 'summary'
  | 'statistics-ab-material'

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
    pageTitle: '生产单总览',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '按生产单查看裁床主链路、数量账和待处理事项。',
  },
  'cut-orders': {
    key: 'cut-orders',
    canonicalPath: '/fcs/craft/cutting/cut-orders',
    aliases: [],
    menuGroupTitle: '裁前准备',
    pageTitle: '裁片单',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看裁片单与执行记录。',
  },
  'cut-order-close': {
    key: 'cut-order-close',
    canonicalPath: '/fcs/craft/cutting/cut-order-close',
    aliases: [],
    menuGroupTitle: '裁前准备',
    pageTitle: '关闭裁片单',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '确认裁片单关闭原因、关闭前数量账和影响项。',
  },
  'pickup-management': {
    key: 'pickup-management',
    canonicalPath: '/fcs/craft/cutting/pickup-management',
    aliases: [],
    menuGroupTitle: '裁前准备',
    pageTitle: '领料管理',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看中转仓已确认配料、裁床可领数量、打回记录和待加工仓领料执行入口。',
  },
  'marker-list': {
    key: 'marker-list',
    canonicalPath: '/fcs/craft/cutting/marker-list',
    aliases: [],
    menuGroupTitle: '裁前准备',
    pageTitle: '唛架方案',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看唛架方案与唛架编号。',
  },
  'marker-create': {
    key: 'marker-create',
    canonicalPath: '/fcs/craft/cutting/marker-create',
    aliases: [],
    menuGroupTitle: '裁前准备',
    pageTitle: '新建唛架方案',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '从裁片单新建唛架方案。',
  },
  'spreading-list': {
    key: 'spreading-list',
    canonicalPath: '/fcs/craft/cutting/spreading-list',
    aliases: [],
    menuGroupTitle: '铺布执行',
    pageTitle: '铺布单',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看铺布单、计划实际对比、PDA 执行记录与差异处理。',
  },
  'spreading-create': {
    key: 'spreading-create',
    canonicalPath: '/fcs/craft/cutting/spreading-create',
    aliases: [],
    menuGroupTitle: '铺布执行',
    pageTitle: '新建铺布',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '基于唛架方案中的唛架编号新建铺布任务。',
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
    pageTitle: '唛架方案详情',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看唛架方案、床次和需求匹配。',
  },
  'marker-edit': {
    key: 'marker-edit',
    canonicalPath: '/fcs/craft/cutting/marker-edit',
    aliases: [],
    menuGroupTitle: '裁前准备',
    pageTitle: '编辑唛架方案',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '编辑唛架方案计划。',
  },
  'spreading-detail': {
    key: 'spreading-detail',
    canonicalPath: '/fcs/craft/cutting/spreading-detail',
    aliases: [],
    menuGroupTitle: '铺布执行',
    pageTitle: '铺布单详情',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看铺布单计划、实际、卷记录、人员记录和 PDA 执行记录。',
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
    pageTitle: '部位菲票打印',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '按铺布单查看部位菲票明细、打印状态、特殊工艺、承接工厂和编号范围。',
  },
  'binding-fei-tickets': {
    key: 'binding-fei-tickets',
    canonicalPath: '/fcs/craft/cutting/binding-fei-tickets',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '捆条菲票打印',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '按捆条加工单查看捆条菲票明细、打印状态和打印入口。',
  },
  'fei-ticket-detail': {
    key: 'fei-ticket-detail',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-detail',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '菲票详情',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看打印单元与菲票码。',
  },
  'fei-ticket-printed': {
    key: 'fei-ticket-printed',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-printed',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '已打印菲票',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看已打印菲票。',
  },
  'fei-ticket-print': {
    key: 'fei-ticket-print',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-print',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '菲票打印',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '首次打印菲票。',
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
  'fei-ticket-numbering': {
    key: 'fei-ticket-numbering',
    canonicalPath: '/fcs/craft/cutting/fei-ticket-numbering',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '菲票打编号',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '扫码记录员工给普通部位菲票完成的编号区间和计件数量。',
  },
  'warehouse-management-wait-process': {
    key: 'warehouse-management-wait-process',
    canonicalPath: '/fcs/craft/cutting/warehouse-management/wait-process',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '裁床待加工仓',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '管理裁床面料库存、中转仓领料、加工领料、回收入仓和库区库位。',
  },
  'warehouse-management-wait-handover': {
    key: 'warehouse-management-wait-handover',
    canonicalPath: '/fcs/craft/cutting/warehouse-management/wait-handover',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '裁床待交出仓',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '管理裁后裁片库存、菲票入仓、分拣装袋、交出出库和回写差异。',
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
    pageTitle: '裁床样衣仓',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '关联生产单、裁片单、纸样、唛架方案和样衣流转异常。',
  },
  'transfer-bags': {
    key: 'transfer-bags',
    canonicalPath: '/fcs/craft/cutting/transfer-bags',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '中转袋流转',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '管理中转袋主档、查看流转状态并进入详情。',
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
  'handover-orders': {
    key: 'handover-orders',
    canonicalPath: '/fcs/craft/cutting/handover-orders',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '交出单',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看通用交出单、交出记录、接收回写、差异和异议。',
  },
  'handover-order-detail': {
    key: 'handover-order-detail',
    canonicalPath: '/fcs/craft/cutting/handover-orders',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '交出单详情',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看交出单下的多次交出记录。',
  },
  'handover-record-detail': {
    key: 'handover-record-detail',
    canonicalPath: '/fcs/craft/cutting/handover-records',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '交出记录详情',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看本次交出、累计交出、接收回写、差异和异议。',
  },
  replenishment: {
    key: 'replenishment',
    canonicalPath: '/fcs/craft/cutting/replenishment',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '补料管理',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '按实际差异审核补料、补录、补排、关闭或仅记录。',
  },
  'special-craft-dispatch': {
    key: 'special-craft-dispatch',
    canonicalPath: '/fcs/craft/cutting/warehouse-management/wait-process?tab=special-craft-dispatch',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '特殊工艺交出',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '按菲票交出到特殊工艺厂。',
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
    canonicalPath: '/fcs/craft/cutting/warehouse-management/wait-handover?tab=handoverOrders',
    aliases: [],
    menuGroupTitle: '裁床仓库管理',
    pageTitle: '交出单',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '按交出对象新增交出记录并追踪接收方回写。',
  },
  'special-processes': {
    key: 'special-processes',
    canonicalPath: '/fcs/craft/cutting/special-processes',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '捆条加工单',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '查看裁床捆条加工单。',
  },
  summary: {
    key: 'summary',
    canonicalPath: '/fcs/craft/cutting/summary',
    aliases: [],
    menuGroupTitle: '裁后处理',
    pageTitle: '裁剪结果核查',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '聚合裁床主链路待处理问题，支持快速定位来源对象。',
  },
  'statistics-ab-material': {
    key: 'statistics-ab-material',
    canonicalPath: '/fcs/craft/cutting/statistics/ab-material',
    aliases: [],
    menuGroupTitle: '裁床统计',
    pageTitle: '20天待发裁床AB料',
    pageSubtitle: '',
    isPlaceholder: false,
    shortDescription: '按未来发货窗口统计SPU裁片送工厂缺口，并展开面料A、面料B、里布等裁剪属性齐套情况。',
  },
}

const CUTTING_META_LIST = Object.values(CUTTING_PAGE_META)

export function getCanonicalCuttingMeta(pathname: string, fallbackKey?: CuttingPageKey): CuttingPageMeta {
  if (pathname in CUTTING_PAGE_META) return CUTTING_PAGE_META[pathname as CuttingCanonicalPageKey]
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
