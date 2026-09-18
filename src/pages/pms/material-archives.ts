// @page-pattern: list
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  getPmsMaterial,
  listPmsMaterials,
  PMS_MATERIAL_BRAND_TYPES,
  PMS_MATERIAL_SPECIAL_ATTRIBUTES,
  updatePmsMaterialComplianceInfo,
  updatePmsMaterialProcurementInfo,
  type PmsMaterial,
  type PmsMaterialCategory,
  type PmsPurchaseRegion,
} from '../../data/pms/materials.ts'
import { PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsMoney,
  hydratePmsSurface,
  readNumberField,
  readTextField,
  handlePmsCommonImageEvent,
  renderPmsBusinessImage,
  renderPmsImagePreview,
  renderPmsFeedback,
  renderPmsOverlayError,
  renderPmsStatusBadge,
} from './shared.ts'

type MaterialOverlay = null | { kind: 'detail'; materialCode: string } | { kind: 'edit'; materialCode: string }

interface MaterialPageState extends ProcessOrderListControllerState {
  keyword: string
  category: '' | PmsMaterialCategory
  status: '' | PmsMaterial['status']
  overlay: MaterialOverlay
  overlayError: string
  pendingImageName: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-mat'
const ROOT_SELECTOR = '[data-pms-mat-root]'
const BUYER = { id: 'USR-PMS-WANG', name: '王采购', role: '采购员' as const }

const state: MaterialPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  category: '',
  status: '',
  overlay: null,
  overlayError: '',
  pendingImageName: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsMaterial[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsMaterials().filter((material) => {
    if (state.category && material.materialCategory !== state.category) return false
    if (state.status && material.status !== state.status) return false
    if (!keyword) return true
    return [material.materialCode, material.materialName, material.defaultSupplier, material.specification].some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<PmsMaterial>[] = [
  {
    key: 'material',
    title: '物料',
    width: 300,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.materialName,
    render: (row) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(row.imageUrl, `${row.materialName}（${row.materialCode}）实物图`, 'h-12 w-12')}<div><div class="font-medium">${escapeHtml(row.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.materialCode)} · ${escapeHtml(row.materialCategory)}</div><div class="text-xs text-slate-500">${escapeHtml(row.specification)} · ${escapeHtml(row.color)}</div></div></div>`,
  },
  {
    key: 'supplier',
    title: '默认供应商 / 采购价',
    width: 260,
    sortable: true,
    sortValue: (row) => row.defaultSupplier,
    render: (row) => `<div class="font-medium">${escapeHtml(row.defaultSupplier)}</div><div class="mt-1 text-xs tabular-nums">${formatMaterialMoney(row.referencePurchasePrice, row.currency)} · 提前期 ${row.purchaseLeadTimeDays} 天</div><div class="mt-1 text-xs text-slate-500">采购区域 ${escapeHtml(row.defaultPurchaseRegion)}</div>`,
  },
  {
    key: 'units',
    title: '单位 / 换算',
    width: 190,
    render: (row) => `<div class="text-sm">${escapeHtml(row.purchaseUnit)} / ${escapeHtml(row.baseUnit)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.conversionRate || '未配置包装换算')}</div>`,
  },
  {
    key: 'declaration',
    title: '申报 / 报关',
    width: 180,
    render: (row) => {
      const declaration = row.declarationInfo ? renderPmsStatusBadge('申报已补', 'green') : renderPmsStatusBadge('申报待补', 'yellow')
      const customs = row.customsInfo ? renderPmsStatusBadge('报关已补', 'green') : renderPmsStatusBadge('报关待补', 'yellow')
      return `<div class="flex flex-wrap gap-1">${declaration}${customs}</div><div class="mt-1 text-xs text-slate-500">来源 ${escapeHtml(row.systemInfo.sourceSystem)} · ${escapeHtml(row.systemInfo.sourceProductCode)}</div>`
    },
  },
  {
    key: 'status',
    title: '状态',
    width: 110,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => renderPmsStatusBadge(row.status, row.status === '已启用' ? 'green' : row.status === '草稿' ? 'yellow' : 'slate'),
  },
  {
    key: 'actions',
    title: '操作',
    width: 190,
    actionColumn: true,
    render: (row) => `<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5"><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-detail" data-material-code="${escapeHtml(row.materialCode)}" data-skip-page-rerender="true">详情</button><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-edit" data-material-code="${escapeHtml(row.materialCode)}" data-skip-page-rerender="true">补充采购信息</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/material-archives',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-mat-table-surface]',
  paginationSurfaceSelector: '[data-pms-mat-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-mat-overlays]',
  defaultFrozenKeys: ['material'],
  columnSettingsTitle: '面辅料列表列设置',
  emptyText: '当前条件下暂无物料',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const categories: Array<'' | PmsMaterialCategory> = ['', '面料', '辅料', '纱线', '包材', '耗材', '成衣', '样衣']
  const categoryOptions = categories.map((value) => `<option value="${value}" ${state.category === value ? 'selected' : ''}>${value || '全部类别'}</option>`).join('')
  const statusOptions = ['', '已启用', '草稿', '已停用'].map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const advancedCount = state.status ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="物料编码 / 名称 / 供应商 / 规格" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">物料类别</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="category" data-skip-page-rerender="true">${categoryOptions}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    <span class="ml-auto text-xs text-muted-foreground">物料由商品中心 PCS 同步，PMS 只补充采购、申报与报关信息，不新增不删除</span>
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '物料总数', value: rows.length },
    { label: '已启用', value: rows.filter((row) => row.status === '已启用').length },
    { label: '申报待补', value: rows.filter((row) => !row.declarationInfo).length },
    { label: '报关待补', value: rows.filter((row) => !row.customsInfo).length },
  ])
}

function renderDetailOverlay(materialCode: string): string {
  const material = getPmsMaterial(materialCode)
  if (!material) return ''
  const declaration = material.declarationInfo
  const customs = material.customsInfo
  const system = material.systemInfo
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="物料详情" data-pms-mat-detail-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[760px] max-w-[95vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(material.materialName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(material.materialCode)} · ${escapeHtml(material.materialCategory)} · ${renderPmsStatusBadge(material.status, material.status === '已启用' ? 'green' : material.status === '草稿' ? 'yellow' : 'slate')}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-5 p-4">
    <div class="flex items-center gap-4">${renderPmsBusinessImage(material.imageUrl, `${material.materialName}实物图`, 'h-24 w-24')}<dl class="grid flex-1 grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">规格</dt><dd class="mt-1">${escapeHtml(material.specification)}</dd></div><div><dt class="text-xs text-muted-foreground">成分</dt><dd class="mt-1">${escapeHtml(material.composition || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">颜色</dt><dd class="mt-1">${escapeHtml(material.color)}</dd></div><div><dt class="text-xs text-muted-foreground">采购单位</dt><dd class="mt-1">${escapeHtml(material.purchaseUnit)} / ${escapeHtml(material.baseUnit)}</dd></div><div><dt class="text-xs text-muted-foreground">库存单位</dt><dd class="mt-1">${escapeHtml(material.inventoryUnit)}</dd></div><div><dt class="text-xs text-muted-foreground">是否需质检</dt><dd class="mt-1">${material.needInspection ? '是' : '否'}</dd></div><div class="col-span-3"><dt class="text-xs text-muted-foreground">单位换算关系</dt><dd class="mt-1">${escapeHtml(material.conversionRate || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">默认供应商</dt><dd class="mt-1">${escapeHtml(material.defaultSupplier)}</dd></div><div><dt class="text-xs text-muted-foreground">参考价</dt><dd class="mt-1 tabular-nums">${formatMaterialMoney(material.referencePurchasePrice, material.currency)}</dd></div><div><dt class="text-xs text-muted-foreground">采购区域</dt><dd class="mt-1">${escapeHtml(material.defaultPurchaseRegion)}</dd></div><div><dt class="text-xs text-muted-foreground">提前期</dt><dd class="mt-1">${material.purchaseLeadTimeDays} 天</dd></div><div><dt class="text-xs text-muted-foreground">累计采购</dt><dd class="mt-1">${material.totalPurchaseOrders} 单 · ${material.totalPurchaseQty} ${escapeHtml(material.baseUnit)}</dd></div><div class="col-span-2"><dt class="text-xs text-muted-foreground">最近采购</dt><dd class="mt-1">${escapeHtml(material.recentPurchaseOrderNo)} · ${escapeHtml(material.recentPurchaseDate)}</dd></div></dl></div>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">申报信息</h3>${declaration ? `<dl class="mt-2 grid grid-cols-2 gap-2 text-sm"><div><dt class="text-xs text-muted-foreground">中文品名</dt><dd>${escapeHtml(declaration.chineseClearanceName)}</dd></div><div><dt class="text-xs text-muted-foreground">英文品名</dt><dd>${escapeHtml(declaration.englishClearanceName)}</dd></div><div><dt class="text-xs text-muted-foreground">品牌类型</dt><dd>${escapeHtml(declaration.brandType || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">申报品牌名称 / 英文名</dt><dd>${escapeHtml(declaration.brandName || '—')} / ${escapeHtml(declaration.brandEnglishName || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">产品型号</dt><dd>${escapeHtml(declaration.productModel || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">材质</dt><dd>${escapeHtml(declaration.productMaterial)}</dd></div><div><dt class="text-xs text-muted-foreground">用途</dt><dd>${escapeHtml(declaration.productUsage)}</dd></div><div><dt class="text-xs text-muted-foreground">织造方式</dt><dd>${escapeHtml(declaration.weavingMethod || '—')}</dd></div><div class="col-span-2"><dt class="text-xs text-muted-foreground">其他申报要素</dt><dd>${escapeHtml(declaration.otherDeclarationElements || '—')}</dd></div><div class="col-span-2"><dt class="text-xs text-muted-foreground">特殊属性（${declaration.specialAttributes.length} 项）</dt><dd>${declaration.specialAttributes.length ? declaration.specialAttributes.map((item) => escapeHtml(item)).join(' / ') : '—'}</dd></div></dl>` : '<p class="mt-2 text-sm text-amber-700">申报信息待补充</p>'}</section>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">报关信息 ${customs && !customs.needCustomsDeclaration ? renderPmsStatusBadge('不报关', 'slate') : ''}</h3>${customs ? (customs.needCustomsDeclaration ? `<dl class="mt-2 grid grid-cols-2 gap-2 text-sm"><div><dt class="text-xs text-muted-foreground">报关中文品名</dt><dd>${escapeHtml(customs.chineseCustomsName)}</dd></div><div><dt class="text-xs text-muted-foreground">报关英文品名</dt><dd>${escapeHtml(customs.englishCustomsName)}</dd></div><div><dt class="text-xs text-muted-foreground">原产国</dt><dd>${escapeHtml(customs.originCountryOrRegion)}</dd></div><div><dt class="text-xs text-muted-foreground">境内货源地</dt><dd>${escapeHtml(customs.domesticSourcePlace)}</dd></div><div><dt class="text-xs text-muted-foreground">征免性质</dt><dd>${escapeHtml(customs.taxExemptionType)}</dd></div><div><dt class="text-xs text-muted-foreground">成交单位</dt><dd>${escapeHtml(customs.transactionUnit)}</dd></div><div><dt class="text-xs text-muted-foreground">法定第二计量单位</dt><dd>${escapeHtml(customs.legalSecondUnit || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">法定第二计量单位数值</dt><dd class="tabular-nums">${customs.legalSecondUnit ? customs.legalSecondUnitValue : '—'}</dd></div><div class="col-span-2"><dt class="text-xs text-muted-foreground">其他申报要素（报关）</dt><dd>${escapeHtml(customs.otherDeclarationElements || '—')}</dd></div></dl>` : '<p class="mt-2 text-sm text-slate-600">该物料不报关，报关字段不参与必填校验，也不作为报关单据依据。</p>') : '<p class="mt-2 text-sm text-amber-700">报关信息待补充</p>'}</section>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">系统信息</h3><dl class="mt-2 grid grid-cols-2 gap-2 text-sm"><div><dt class="text-xs text-muted-foreground">来源系统</dt><dd>${escapeHtml(system.sourceSystem)} · ${escapeHtml(system.dataSource)}</dd></div><div><dt class="text-xs text-muted-foreground">来源编码</dt><dd>${escapeHtml(system.sourceProductCode)}</dd></div><div><dt class="text-xs text-muted-foreground">同步时间</dt><dd>${escapeHtml(system.syncedAt)}</dd></div><div><dt class="text-xs text-muted-foreground">更新人</dt><dd>${escapeHtml(system.updatedBy)} · ${escapeHtml(system.updatedAt)}</dd></div></dl></section>
  </div></section></div>`
}

function renderYesNoRadio(field: string, label: string, checked: boolean, name: string): string {
  const inputs = ['是', '否']
    .map((value) => `<label class="flex items-center gap-1.5"><input type="radio" name="${name}" value="${value}" ${(value === '是') === checked ? 'checked' : ''} data-${EVENT_PREFIX}-edit-field="${field}" data-skip-page-rerender="true" />${value}</label>`)
    .join('')
  return `<div class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<div class="flex h-9 items-center gap-4 text-sm">${inputs}</div></div>`
}

function renderSpecialAttributeGrid(declaration: PmsMaterial['declarationInfo']): string {
  const selected = new Set(declaration?.specialAttributes ?? [])
  const boxes = PMS_MATERIAL_SPECIAL_ATTRIBUTES.map(
    (attribute) => `<label class="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${selected.has(attribute) ? 'border-blue-300 bg-blue-50 text-blue-800' : 'bg-background'}"><input type="checkbox" ${selected.has(attribute) ? 'checked' : ''} data-${EVENT_PREFIX}-edit-attr="${escapeHtml(attribute)}" data-skip-page-rerender="true" />${escapeHtml(attribute)}</label>`,
  ).join('')
  return `<div class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">特殊属性（26 项，可多选）<div class="mt-1 grid grid-cols-3 gap-1.5">${boxes}</div></div>`
}

function renderEditOverlay(materialCode: string): string {
  const material = getPmsMaterial(materialCode)
  if (!material) return ''
  const uploadNote = state.pendingImageName
    ? `<p class="mt-1 text-xs text-emerald-700">已选择图片：${escapeHtml(state.pendingImageName)}（原型仅校验格式与大小，不保存真实图片）</p>`
    : '<p class="mt-1 text-xs text-slate-500">支持 png / jpg，不超过 5MB；原型仅校验，不保存真实图片</p>'
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="补充采购信息" data-pms-mat-edit-root><section class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><div><h2 class="font-semibold">补充采购信息 · ${escapeHtml(material.materialName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(material.materialCode)} · 物料主数据由 PCS 同步，本表单只维护采购侧补充字段</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    <div class="grid grid-cols-2 gap-3">
      <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">默认供应商<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.defaultSupplier)}" data-${EVENT_PREFIX}-edit-field="defaultSupplier" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">采购区域<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-edit-field="defaultPurchaseRegion" data-skip-page-rerender="true">${(['国内', '印尼'] as PmsPurchaseRegion[]).map((value) => `<option value="${value}" ${material.defaultPurchaseRegion === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">参考采购价<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="${material.referencePurchasePrice}" data-${EVENT_PREFIX}-edit-field="referencePurchasePrice" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">币种<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-edit-field="currency" data-skip-page-rerender="true">${['RMB', 'USD', 'IDR'].map((value) => `<option value="${value}" ${material.currency === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">采购提前期（天）<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="1" step="1" value="${material.purchaseLeadTimeDays}" data-${EVENT_PREFIX}-edit-field="purchaseLeadTimeDays" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">最小起订量<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="${material.minPurchaseQty ?? 0}" data-${EVENT_PREFIX}-edit-field="minPurchaseQty" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">库存单位<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.inventoryUnit)}" data-${EVENT_PREFIX}-edit-field="inventoryUnit" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">单位换算关系（选填）<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="如 1箱=100件" value="${escapeHtml(material.conversionRate ?? '')}" data-${EVENT_PREFIX}-edit-field="conversionRate" data-skip-page-rerender="true" /></label>
      ${renderYesNoRadio('needInspection', '是否需质检', material.needInspection, 'pms-mat-need-inspection')}
      <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">备注<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.remark)}" data-${EVENT_PREFIX}-edit-field="remark" data-skip-page-rerender="true" /></label>
    </div>
    <section class="mt-4 rounded-lg border p-3"><h3 class="text-sm font-semibold">申报信息补充</h3><div class="mt-2 grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">申报中文品名<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.declarationInfo?.chineseClearanceName ?? material.materialName)}" data-${EVENT_PREFIX}-edit-field="declName" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">申报英文品名<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.declarationInfo?.englishClearanceName ?? '')}" data-${EVENT_PREFIX}-edit-field="declEn" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">品牌类型<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-edit-field="declBrandType" data-skip-page-rerender="true">${PMS_MATERIAL_BRAND_TYPES.map((value) => `<option value="${value}" ${(material.declarationInfo?.brandType ?? '无品牌') === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">申报品牌名称<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.declarationInfo?.brandName ?? '')}" data-${EVENT_PREFIX}-edit-field="declBrandName" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">申报品牌英文名<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.declarationInfo?.brandEnglishName ?? '')}" data-${EVENT_PREFIX}-edit-field="declBrandEn" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">产品型号<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.declarationInfo?.productModel ?? material.specification)}" data-${EVENT_PREFIX}-edit-field="declModel" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">申报材质<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.declarationInfo?.productMaterial ?? material.composition ?? '')}" data-${EVENT_PREFIX}-edit-field="declMaterial" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">申报用途<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.declarationInfo?.productUsage ?? material.materialPurpose)}" data-${EVENT_PREFIX}-edit-field="declUsage" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">织造方式<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.declarationInfo?.weavingMethod ?? '')}" data-${EVENT_PREFIX}-edit-field="declWeaving" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">其他申报要素<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.declarationInfo?.otherDeclarationElements ?? '')}" data-${EVENT_PREFIX}-edit-field="declOther" data-skip-page-rerender="true" /></label>
      ${renderSpecialAttributeGrid(material.declarationInfo)}
    </div></section>
    <section class="mt-4 rounded-lg border p-3"><h3 class="text-sm font-semibold">报关信息补充</h3><p class="mt-1 text-xs text-slate-500">“是否报关”选择“否”时，报关字段不参与必填校验，详情显示“不报关”。</p><div class="mt-2 grid grid-cols-2 gap-3">
      ${renderYesNoRadio('needCustomsDeclaration', '是否报关', material.customsInfo?.needCustomsDeclaration ?? true, 'pms-mat-need-customs')}
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">报关中文品名<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.customsInfo?.chineseCustomsName ?? material.materialName)}" data-${EVENT_PREFIX}-edit-field="custName" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">报关英文品名<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.customsInfo?.englishCustomsName ?? '')}" data-${EVENT_PREFIX}-edit-field="custEn" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">原产国<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.customsInfo?.originCountryOrRegion ?? '中国 / CN')}" data-${EVENT_PREFIX}-edit-field="custOrigin" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">境内货源地<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.customsInfo?.domesticSourcePlace ?? '')}" data-${EVENT_PREFIX}-edit-field="custSource" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">征免性质<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.customsInfo?.taxExemptionType ?? '照章征税')}" data-${EVENT_PREFIX}-edit-field="custTax" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">成交单位<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.customsInfo?.transactionUnit ?? material.purchaseUnit)}" data-${EVENT_PREFIX}-edit-field="custUnit" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">法定第二计量单位<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.customsInfo?.legalSecondUnit ?? '')}" data-${EVENT_PREFIX}-edit-field="custSecondUnit" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">法定第二计量单位数值（正数）<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="${material.customsInfo?.legalSecondUnitValue ?? 0}" data-${EVENT_PREFIX}-edit-field="custSecondUnitValue" data-skip-page-rerender="true" /></label>
      <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">其他申报要素（报关）<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(material.customsInfo?.otherDeclarationElements ?? '')}" data-${EVENT_PREFIX}-edit-field="custOther" data-skip-page-rerender="true" /></label>
    </div></section>
    <section class="mt-4 rounded-lg border p-3"><h3 class="text-sm font-semibold">物料图片补充</h3><input class="mt-2 text-xs" type="file" accept=".png,.jpg,.jpeg" data-${EVENT_PREFIX}-edit-file="image" data-skip-page-rerender="true" />${uploadNote}</section>
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存补充信息', { prefix: EVENT_PREFIX, action: 'submit-edit' }, 'check-check')}</footer></section></div>`
}

function refreshImageSurface(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mat-image-surface]')
  if (surface) surface.innerHTML = renderPmsImagePreview()
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-mat-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return columnSettings
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderDetailOverlay(state.overlay.materialCode)}`
  return `${columnSettings}${renderDetailOverlay(state.overlay.materialCode)}${renderEditOverlay(state.overlay.materialCode)}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '面辅料列表',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-mat-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-mat-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-mat-overlays>${renderOverlays()}</div><div data-pms-mat-image-surface>${renderPmsImagePreview()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mat-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function handleImageChange(file: File): void {
  const lowerName = file.name.toLowerCase()
  const validType = lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')
  if (!validType) {
    state.overlayError = '物料图片仅支持 png / jpg 格式'
    state.pendingImageName = ''
    refreshOverlays()
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    state.overlayError = '物料图片不能超过 5MB'
    state.pendingImageName = ''
    refreshOverlays()
    return
  }
  state.pendingImageName = file.name
  state.overlayError = ''
  refreshOverlays()
}

function readRadioField(surface: HTMLElement, field: string): string {
  return surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-edit-field="${field}"]:checked`)?.value ?? ''
}

function readSpecialAttributes(surface: HTMLElement): string[] {
  return Array.from(surface.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-edit-attr]:checked`))
    .map((node) => node.dataset.pmsMatEditAttr ?? '')
    .filter(Boolean)
}

function submitEdit(materialCode: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mat-edit-root]')
  if (!surface) return
  try {
    updatePmsMaterialProcurementInfo(
      materialCode,
      {
        defaultSupplier: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="defaultSupplier"]`),
        defaultPurchaseRegion: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="defaultPurchaseRegion"]`) as PmsPurchaseRegion,
        referencePurchasePrice: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="referencePurchasePrice"]`),
        currency: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="currency"]`) as 'RMB' | 'USD' | 'IDR',
        purchaseLeadTimeDays: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="purchaseLeadTimeDays"]`),
        minPurchaseQty: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="minPurchaseQty"]`),
        inventoryUnit: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="inventoryUnit"]`),
        conversionRate: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="conversionRate"]`),
        needInspection: readRadioField(surface, 'needInspection') === '是',
        remark: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="remark"]`),
      },
      BUYER,
    )
    updatePmsMaterialComplianceInfo(
      materialCode,
      {
        declaration: {
          chineseClearanceName: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="declName"]`),
          englishClearanceName: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="declEn"]`),
          brandType: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="declBrandType"]`),
          brandName: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="declBrandName"]`),
          brandEnglishName: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="declBrandEn"]`),
          productModel: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="declModel"]`),
          productMaterial: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="declMaterial"]`),
          productUsage: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="declUsage"]`),
          weavingMethod: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="declWeaving"]`),
          otherDeclarationElements: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="declOther"]`),
          specialAttributes: readSpecialAttributes(surface),
        },
        customs: {
          needCustomsDeclaration: readRadioField(surface, 'needCustomsDeclaration') === '是',
          chineseCustomsName: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="custName"]`),
          englishCustomsName: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="custEn"]`),
          originCountryOrRegion: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="custOrigin"]`),
          domesticSourcePlace: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="custSource"]`),
          taxExemptionType: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="custTax"]`),
          transactionUnit: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="custUnit"]`),
          legalSecondUnit: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="custSecondUnit"]`),
          legalSecondUnitValue: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="custSecondUnitValue"]`),
          otherDeclarationElements: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="custOther"]`),
        },
      },
      BUYER,
    )
    state.feedback = `${materialCode} 的采购、申报与报关补充信息已保存；PCS 主数据未被修改。`
    state.feedbackOk = true
    state.overlay = { kind: 'detail', materialCode }
    state.overlayError = ''
    state.pendingImageName = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError || error instanceof Error ? error.message : '保存补充信息失败'
    refreshOverlays()
  }
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的物料。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '面辅料列表.csv',
    ['物料编码', '物料名称', '类别', '规格', '成分', '颜色', '基础单位', '采购单位', '换算', '默认供应商', '参考价', '币种', '采购区域', '提前期', '申报', '报关', '状态', '来源编码'],
    rows.map((row) => [row.materialCode, row.materialName, row.materialCategory, row.specification, row.composition ?? '', row.color, row.baseUnit, row.purchaseUnit, row.conversionRate ?? '', row.defaultSupplier, row.referencePurchasePrice, row.currency, row.defaultPurchaseRegion, row.purchaseLeadTimeDays, row.declarationInfo ? '已补' : '待补', row.customsInfo ? '已补' : '待补', row.status, row.systemInfo.sourceProductCode]),
  )
  state.feedback = `已导出 ${rows.length} 条物料（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

function formatMaterialMoney(value: number, currency: 'RMB' | 'USD' | 'IDR'): string {
  if (currency === 'IDR') return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)}`
  return formatPmsMoney(value, currency)
}

export function renderPmsMaterialArchivesPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-mat-root data-skip-page-rerender="true"><style>[data-pms-mat-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsMaterialArchiveOverlays(): boolean {
  if (state.overlay?.kind === 'edit') {
    state.overlay = { kind: 'detail', materialCode: state.overlay.materialCode }
    state.overlayError = ''
    state.pendingImageName = ''
    refreshOverlays()
    return true
  }
  if (state.overlay) {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (state.showColumnSettings) {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  return false
}

export function handlePmsMaterialArchivesEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshImageSurface)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closePmsMaterialArchiveOverlays()
    return true
  }
  const fileField = target.closest<HTMLInputElement>(`[data-${EVENT_PREFIX}-edit-file="image"]`)
  if (fileField) {
    if (fileField.files?.[0]) handleImageChange(fileField.files[0])
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsMatField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'category') {
      state.category = field.value as MaterialPageState['category']
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as MaterialPageState['status']
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsMatAction
  if (!action) return false
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.category = ''
    state.status = ''
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'export') {
    exportRows()
    return true
  }
  if (action === 'open-column-settings') {
    state.showColumnSettings = true
    refreshOverlays()
    return true
  }
  if (action === 'close-column-settings') {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  if (action === 'restore-column-settings') {
    controller.restorePreferences()
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode?.closest<HTMLElement>('[data-pms-mat-column-key]')?.dataset.pmsMatColumnKey || ''
    controller.updateColumnPreference(action, key, actionNode?.closest('input')?.checked)
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    controller.stepPage(action === 'next-page' ? 1 : -1)
    controller.refresh({ overlays: false })
    return true
  }
  if (action === 'sort-column') {
    controller.cycleSort(actionNode?.dataset.columnKey || '')
    controller.refresh()
    return true
  }
  if (action === 'open-detail') {
    state.overlay = { kind: 'detail', materialCode: actionNode?.dataset.materialCode || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-edit') {
    state.overlay = { kind: 'edit', materialCode: actionNode?.dataset.materialCode || '' }
    state.overlayError = ''
    state.pendingImageName = ''
    refreshOverlays()
    return true
  }
  if (action === 'submit-edit') {
    if (state.overlay?.kind === 'edit') submitEdit(state.overlay.materialCode)
    return true
  }
  if (action === 'close-overlay') {
    closePmsMaterialArchiveOverlays()
    return true
  }
  return false
}
