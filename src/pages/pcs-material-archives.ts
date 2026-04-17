import { appStore } from '../state/store.ts'
import {
  createMaterialArchive,
  createMaterialSkuRecord,
  getMaterialArchiveById,
  getMaterialArchiveCategoryOptions,
  getMaterialSkuRecordById,
  getMaterialStats,
  getMaterialSkuSpecMeta,
  listMaterialArchives,
  listMaterialLogRecordsByMaterialId,
  listMaterialSkuRecordsByMaterialId,
  listMaterialUsageRecordsByMaterialId,
  updateMaterialSkuRecord,
} from '../data/pcs-material-archive-repository.ts'
import type {
  MaterialArchiveKind,
  MaterialArchiveRecord,
  MaterialArchiveStatus,
  MaterialLogRecord,
  MaterialSkuDraftInput,
  MaterialSkuRecord,
  MaterialUsageRecord,
} from '../data/pcs-material-archive-types.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type MaterialDetailTabKey = 'overview' | 'skus' | 'usage' | 'logs'

interface MaterialArchivePageState {
  notice: string | null
  filters: Record<
    MaterialArchiveKind,
    {
      search: string
      status: 'all' | MaterialArchiveStatus
    }
  >
  detail: {
    materialId: string | null
    activeTab: MaterialDetailTabKey
  }
  create: {
    open: boolean
    kind: MaterialArchiveKind
    materialName: string
    materialNameEn: string
    categoryName: string
    specSummary: string
    composition: string
    processTags: string
    widthText: string
    gramWeightText: string
    pricingUnit: string
    mainImageUrl: string
    barcodeTemplateCode: string
    remark: string
  }
  skuEditor: {
    open: boolean
    materialId: string
    materialSkuId: string | null
    colorName: string
    specValue: string
    costPrice: string
    freightCost: string
    skuImageUrl: string
    barcode: string
    weightKg: string
    lengthCm: string
    widthCm: string
    heightCm: string
  }
  barcode: {
    open: boolean
    materialId: string
    selectedSkuIds: string[]
    quantity: string
  }
  log: {
    open: boolean
    materialId: string
  }
}

const KIND_META: Record<
  MaterialArchiveKind,
  {
    label: string
    description: string
    createLabel: string
    unitOptions: string[]
  }
> = {
  fabric: {
    label: '面料档案',
    description: '沉淀主布、里布等正式面料主档，并反查技术包引用。',
    createLabel: '新建面料',
    unitOptions: ['米', 'Yard', '公斤'],
  },
  accessory: {
    label: '辅料档案',
    description: '沉淀花边、纽扣、拉链等辅料主档及其 SKU 规格。',
    createLabel: '新建辅料',
    unitOptions: ['PCS', '卷', '套'],
  },
  yarn: {
    label: '纱线档案',
    description: '沉淀车缝线、织带线等正式纱线与颜色规格。',
    createLabel: '新建纱线',
    unitOptions: ['卷', 'PCS', '公斤'],
  },
  consumable: {
    label: '耗材档案',
    description: '沉淀包装袋、吊牌等出货耗材，并建立 BOM 引用。',
    createLabel: '新建耗材',
    unitOptions: ['PCS', '套', '箱'],
  },
}

const STATUS_META: Record<MaterialArchiveStatus, { label: string; className: string }> = {
  ACTIVE: { label: '启用', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  INACTIVE: { label: '停用', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  ARCHIVED: { label: '已归档', className: 'border-slate-200 bg-slate-100 text-slate-600' },
}

const DETAIL_TABS: Array<{ key: MaterialDetailTabKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'skus', label: '物料 SKU' },
  { key: 'usage', label: '技术包引用' },
  { key: 'logs', label: '日志' },
]

function createEmptySkuEditorState(): MaterialArchivePageState['skuEditor'] {
  return {
    open: false,
    materialId: '',
    materialSkuId: null,
    colorName: '',
    specValue: '',
    costPrice: '',
    freightCost: '',
    skuImageUrl: '',
    barcode: '',
    weightKg: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
  }
}

function createDefaultState(): MaterialArchivePageState {
  return {
    notice: null,
    filters: {
      fabric: { search: '', status: 'all' },
      accessory: { search: '', status: 'all' },
      yarn: { search: '', status: 'all' },
      consumable: { search: '', status: 'all' },
    },
    detail: {
      materialId: null,
      activeTab: 'overview',
    },
    create: {
      open: false,
      kind: 'fabric',
      materialName: '',
      materialNameEn: '',
      categoryName: '',
      specSummary: '',
      composition: '',
      processTags: '',
      widthText: '',
      gramWeightText: '',
      pricingUnit: 'PCS',
      mainImageUrl: '',
      barcodeTemplateCode: '',
      remark: '',
    },
    skuEditor: createEmptySkuEditorState(),
    barcode: {
      open: false,
      materialId: '',
      selectedSkuIds: [],
      quantity: '1',
    },
    log: {
      open: false,
      materialId: '',
    },
  }
}

const state = createDefaultState()

function resetCreateState(kind: MaterialArchiveKind): void {
  state.create = {
    open: false,
    kind,
    materialName: '',
    materialNameEn: '',
    categoryName: '',
    specSummary: '',
    composition: '',
    processTags: '',
    widthText: '',
    gramWeightText: '',
    pricingUnit: KIND_META[kind].unitOptions[0] || 'PCS',
    mainImageUrl: '',
    barcodeTemplateCode: '',
    remark: '',
  }
}

export function resetPcsMaterialArchiveState(): void {
  const next = createDefaultState()
  state.notice = next.notice
  state.filters = next.filters
  state.detail = next.detail
  state.create = next.create
  state.skuEditor = next.skuEditor
  state.barcode = next.barcode
  state.log = next.log
}

function renderBadge(text: string, className: string): string {
  return `<span class="${escapeHtml(toClassName('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', className))}">${escapeHtml(text)}</span>`
}

function renderStatusBadge(status: MaterialArchiveStatus): string {
  const meta = STATUS_META[status]
  return renderBadge(meta.label, meta.className)
}

function renderArchiveImage(url: string, alt: string, size: 'sm' | 'md' = 'md'): string {
  const dimension = size === 'sm' ? 'h-12 w-12' : 'h-20 w-20'
  if (!url) {
    return `<div class="${escapeHtml(toClassName('flex shrink-0 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-slate-400', dimension))}"><i data-lucide="image" class="h-4 w-4"></i></div>`
  }
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="${escapeHtml(toClassName('shrink-0 rounded-md border border-slate-200 bg-slate-50 object-cover', dimension))}" />`
}

function renderTextInput(field: string, value: string, placeholder: string, type = 'text'): string {
  return `<input type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-pcs-material-archive-field="${escapeHtml(field)}" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400" />`
}

function renderSelect(
  field: string,
  value: string,
  options: Array<{ value: string; label: string }>,
  placeholder: string,
): string {
  const optionHtml = [`<option value="">${escapeHtml(placeholder)}</option>`, ...options.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`)].join('')
  return `<select data-pcs-material-archive-field="${escapeHtml(field)}" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400">${optionHtml}</select>`
}

function renderTextarea(field: string, value: string, placeholder: string): string {
  return `<textarea rows="4" placeholder="${escapeHtml(placeholder)}" data-pcs-material-archive-field="${escapeHtml(field)}" class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400">${escapeHtml(value)}</textarea>`
}

function splitTags(value: string): string[] {
  return value
    .split(/[，,、/]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseNumberInput(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function resetSkuEditor(): void {
  state.skuEditor = createEmptySkuEditorState()
}

function buildSkuEditorSpecValue(kind: MaterialArchiveKind, record: MaterialSkuRecord): string {
  if (kind === 'fabric') {
    return record.sizeName && record.sizeName !== '-' ? record.sizeName : record.specName || ''
  }
  return record.specName && record.specName !== '-' ? record.specName : record.sizeName || ''
}

function openSkuEditor(materialId: string, materialSkuId: string | null = null): boolean {
  const material = getMaterialArchiveById(materialId)
  if (!material) {
    state.notice = '未找到对应物料主档。'
    return false
  }

  if (!materialSkuId) {
    state.skuEditor = {
      ...createEmptySkuEditorState(),
      open: true,
      materialId,
    }
    return true
  }

  const skuRecord = getMaterialSkuRecordById(materialSkuId)
  if (!skuRecord) {
    state.notice = '未找到对应物料 SKU。'
    return false
  }

  state.skuEditor = {
    open: true,
    materialId,
    materialSkuId,
    colorName: skuRecord.colorName || '',
    specValue: buildSkuEditorSpecValue(material.kind, skuRecord),
    costPrice: skuRecord.costPrice ? String(skuRecord.costPrice) : '',
    freightCost: skuRecord.freightCost ? String(skuRecord.freightCost) : '',
    skuImageUrl: skuRecord.skuImageUrl || '',
    barcode: skuRecord.barcode || '',
    weightKg: skuRecord.weightKg ? String(skuRecord.weightKg) : '',
    lengthCm: skuRecord.lengthCm ? String(skuRecord.lengthCm) : '',
    widthCm: skuRecord.widthCm ? String(skuRecord.widthCm) : '',
    heightCm: skuRecord.heightCm ? String(skuRecord.heightCm) : '',
  }
  return true
}

function buildSkuEditorInput(material: MaterialArchiveRecord): MaterialSkuDraftInput {
  const specValue = state.skuEditor.specValue.trim()
  return {
    colorName: state.skuEditor.colorName.trim(),
    specName: specValue || '-',
    sizeName: material.kind === 'fabric' ? specValue || '-' : '-',
    skuImageUrl: state.skuEditor.skuImageUrl.trim(),
    costPrice: parseNumberInput(state.skuEditor.costPrice),
    freightCost: parseNumberInput(state.skuEditor.freightCost),
    weightKg: parseNumberInput(state.skuEditor.weightKg),
    lengthCm: parseNumberInput(state.skuEditor.lengthCm),
    widthCm: parseNumberInput(state.skuEditor.widthCm),
    heightCm: parseNumberInput(state.skuEditor.heightCm),
    barcode: state.skuEditor.barcode.trim(),
  }
}

function renderFormField(label: string, control: string, required = false): string {
  return `
    <label class="block space-y-2">
      <div class="text-sm font-medium text-slate-700">${escapeHtml(label)}${required ? '<span class="ml-1 text-rose-500">*</span>' : ''}</div>
      ${control}
    </label>
  `
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <p class="text-sm text-blue-800">${escapeHtml(state.notice)}</p>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-material-archive-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function renderDrawerShell(title: string, body: string, footer: string): string {
  return `
    <div class="fixed inset-0 z-40 flex justify-end">
      <button type="button" class="absolute inset-0 bg-slate-900/30" data-pcs-material-archive-action="close-drawers"></button>
      <section class="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-xl">
        <div class="border-b border-slate-200 px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <h2 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h2>
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" data-pcs-material-archive-action="close-drawers">×</button>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-5">${body}</div>
        <div class="border-t border-slate-200 px-5 py-4">
          <div class="flex flex-wrap items-center justify-end gap-2">${footer}</div>
        </div>
      </section>
    </div>
  `
}

function formatCurrency(value: number): string {
  return Number.isFinite(value) ? `¥${value.toFixed(2)}` : '-'
}

function getFilteredRecords(kind: MaterialArchiveKind): MaterialArchiveRecord[] {
  const { search, status } = state.filters[kind]
  const keyword = search.trim().toLowerCase()
  return listMaterialArchives(kind).filter((item) => {
    if (status !== 'all' && item.status !== status) return false
    if (!keyword) return true
    return [item.materialCode, item.materialName, item.materialNameEn, item.categoryName, item.specSummary]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
}

function renderStats(kind: MaterialArchiveKind): string {
  const stats = getMaterialStats(kind)
  const items = [
    { label: '主档数', value: stats.total, desc: '正式主档' },
    { label: '启用中', value: stats.active, desc: '当前可引用' },
    { label: '物料 SKU', value: stats.skuCount, desc: '颜色 / 规格' },
    { label: '技术包引用', value: stats.usageCount, desc: '关联版本' },
    { label: '关联款式', value: stats.linkedStyleCount, desc: '款式档案数' },
  ]
  return `
    <section class="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
      ${items
        .map(
          (item) => `
            <div class="rounded-lg border bg-white px-4 py-3 shadow-sm">
              <div class="text-xs text-slate-500">${escapeHtml(item.label)}</div>
              <div class="mt-2 text-2xl font-semibold text-slate-900">${escapeHtml(item.value)}</div>
              <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.desc)}</div>
            </div>
          `,
        )
        .join('')}
    </section>
  `
}

function renderListTable(kind: MaterialArchiveKind, records: MaterialArchiveRecord[]): string {
  const rows = records
    .map((record) => {
      const skus = listMaterialSkuRecordsByMaterialId(record.materialId)
      const minCost = skus.length > 0 ? Math.min(...skus.map((item) => item.costPrice)) : null
      const maxCost = skus.length > 0 ? Math.max(...skus.map((item) => item.costPrice)) : null
      return `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3">
            <div class="flex items-start gap-3">
              ${renderArchiveImage(record.mainImageUrl, record.materialName, 'sm')}
              <div class="min-w-0">
                <button type="button" class="text-left text-sm font-medium text-slate-900 hover:text-slate-700" data-nav="/pcs/materials/${escapeHtml(kind)}/${escapeHtml(record.materialId)}">${escapeHtml(record.materialCode)}</button>
                <div class="mt-1 text-xs text-slate-500">${escapeHtml(record.materialName)}</div>
                <div class="mt-1 text-xs text-slate-500">${escapeHtml(record.materialNameEn || '-')}</div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">
            <div>${escapeHtml(record.categoryName || '-')}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(record.specSummary || '-')}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(record.composition || '-')}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(record.processTags.join(' / ') || '-')}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">
            <div>${escapeHtml(record.widthText || '-')}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(record.gramWeightText || '-')}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(record.pricingUnit || '-')}</div>
            <div class="mt-1 text-xs text-slate-500">条码模板：${escapeHtml(record.barcodeTemplateCode || '-')}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">
            <div>${escapeHtml(record.skuCount)}</div>
            <div class="mt-1 text-xs text-slate-500">款式 ${escapeHtml(record.usedStyleCount)}</div>
            <div class="mt-1 text-xs text-slate-500">技术包 ${escapeHtml(record.usedTechPackCount)}</div>
            <div class="mt-1 text-xs text-slate-500">成本 ${escapeHtml(minCost === null ? '-' : minCost === maxCost ? formatCurrency(minCost) : `${formatCurrency(minCost)} ~ ${formatCurrency(maxCost || 0)}`)}</div>
          </td>
          <td class="px-4 py-3">${renderStatusBadge(record.status)}</td>
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(formatDateTime(record.updatedAt))}</td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-end gap-2">
              <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:bg-slate-50" data-nav="/pcs/materials/${escapeHtml(kind)}/${escapeHtml(record.materialId)}">查看</button>
              <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:bg-slate-50" data-pcs-material-archive-action="open-log" data-material-id="${escapeHtml(record.materialId)}">日志</button>
              <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:bg-slate-50" data-pcs-material-archive-action="open-barcode" data-material-id="${escapeHtml(record.materialId)}" ${skus.length === 0 ? 'disabled' : ''}>打印条码</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  return `
    <section class="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">物料主档</th>
              <th class="px-4 py-3 font-medium">分类 / 摘要</th>
              <th class="px-4 py-3 font-medium">规格信息</th>
              <th class="px-4 py-3 font-medium">SKU / 引用</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">更新时间</th>
              <th class="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">暂无物料档案数据。</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderCreateDrawer(): string {
  if (!state.create.open) return ''
  const meta = KIND_META[state.create.kind]
  const categoryOptions = getMaterialArchiveCategoryOptions(state.create.kind)
  const specMeta = getMaterialSkuSpecMeta(state.create.kind)
  const body = `
    <div class="space-y-4">
      ${renderFormField('物料名称', renderTextInput('create-material-name', state.create.materialName, '输入物料名称'), true)}
      ${renderFormField('外文名', renderTextInput('create-material-name-en', state.create.materialNameEn, '输入外文名'))}
      <div class="grid gap-4 md:grid-cols-2">
        ${renderFormField('分类', renderSelect('create-category-name', state.create.categoryName, categoryOptions, '请选择分类'), true)}
        ${renderFormField('计价单位', renderSelect('create-pricing-unit', state.create.pricingUnit, meta.unitOptions.map((item) => ({ value: item, label: item })), '选择单位'), true)}
      </div>
      ${renderFormField('规格摘要', renderTextInput('create-spec-summary', state.create.specSummary, '例如：white / black，180g'))}
      ${renderFormField('成分', renderTextInput('create-composition', state.create.composition, '例如：100% cotton'))}
      <div class="grid gap-4 md:grid-cols-2">
        ${renderFormField('工艺标签', renderTextInput('create-process-tags', state.create.processTags, '例如：经编，弹力，印花'))}
        ${renderFormField('条码模板编码', renderTextInput('create-barcode-template-code', state.create.barcodeTemplateCode, '例如：FAB-COTTON-180-WHT'))}
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        ${renderFormField('门幅 / 尺寸', renderTextInput('create-width-text', state.create.widthText, '例如：180cm / 20.5cm / 35×45cm'))}
        ${renderFormField('克重', renderTextInput('create-gram-weight-text', state.create.gramWeightText, '例如：180g/m²'))}
      </div>
      ${renderFormField('主图链接', renderTextInput('create-main-image-url', state.create.mainImageUrl, '输入图片 URL'))}
      ${renderFormField('备注', renderTextarea('create-remark', state.create.remark, '补充物料说明'))}
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div class="text-sm font-medium text-slate-900">SKU 规则参数</div>
        <div class="mt-3 grid gap-3 md:grid-cols-2">
          <div class="rounded-md border border-slate-200 bg-white px-3 py-3">
            <div class="text-xs text-slate-500">参数一</div>
            <div class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(specMeta.primaryLabel)}</div>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-3 py-3">
            <div class="text-xs text-slate-500">参数二</div>
            <div class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(specMeta.secondaryLabel)}</div>
          </div>
        </div>
        <div class="mt-3 text-xs text-slate-500">
          当前新建主档只定义 SKU 规则参数，不在此处新增具体 SKU。创建完成后，可在详情页通过“新增SKU”补充具体规格。
        </div>
      </div>
    </div>
  `
  const footer = `
    <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-material-archive-action="close-drawers">取消</button>
    <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-material-archive-action="submit-create">确认创建</button>
  `
  return renderDrawerShell(meta.createLabel, body, footer)
}

function renderSkuEditorDrawer(): string {
  if (!state.skuEditor.open || !state.skuEditor.materialId) return ''
  const material = getMaterialArchiveById(state.skuEditor.materialId)
  if (!material) return ''
  const specMeta = getMaterialSkuSpecMeta(material.kind)
  const body = `
    <div class="space-y-4">
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        ${escapeHtml(material.materialCode)} · ${escapeHtml(material.materialName)}
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        ${renderFormField(
          specMeta.primaryLabel,
          renderTextInput('sku-editor-color-name', state.skuEditor.colorName, specMeta.primaryPlaceholder),
          true,
        )}
        ${renderFormField(
          specMeta.secondaryLabel,
          renderTextInput('sku-editor-spec-value', state.skuEditor.specValue, specMeta.secondaryPlaceholder),
          true,
        )}
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        ${renderFormField('成本价', renderTextInput('sku-editor-cost-price', state.skuEditor.costPrice, '输入成本价', 'number'))}
        ${renderFormField('运费', renderTextInput('sku-editor-freight-cost', state.skuEditor.freightCost, '输入运费', 'number'))}
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        ${renderFormField('SKU 图片', renderTextInput('sku-editor-image-url', state.skuEditor.skuImageUrl, '输入 SKU 图片链接'))}
        ${renderFormField('条码', renderTextInput('sku-editor-barcode', state.skuEditor.barcode, '可留空，系统将自动生成'))}
      </div>
      <div class="grid gap-4 md:grid-cols-4">
        ${renderFormField('重量(kg)', renderTextInput('sku-editor-weight-kg', state.skuEditor.weightKg, '例如：0.35', 'number'))}
        ${renderFormField('长(cm)', renderTextInput('sku-editor-length-cm', state.skuEditor.lengthCm, '例如：180', 'number'))}
        ${renderFormField('宽(cm)', renderTextInput('sku-editor-width-cm', state.skuEditor.widthCm, '例如：180', 'number'))}
        ${renderFormField('高(cm)', renderTextInput('sku-editor-height-cm', state.skuEditor.heightCm, '例如：1', 'number'))}
      </div>
    </div>
  `
  const footer = `
    <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-material-archive-action="close-drawers">取消</button>
    <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-material-archive-action="submit-sku-editor">${state.skuEditor.materialSkuId ? '确认保存' : '确认新增'}</button>
  `
  return renderDrawerShell(state.skuEditor.materialSkuId ? '编辑SKU' : '新增SKU', body, footer)
}

function renderBarcodeDrawer(): string {
  if (!state.barcode.open || !state.barcode.materialId) return ''
  const material = getMaterialArchiveById(state.barcode.materialId)
  if (!material) return ''
  const skuRecords = listMaterialSkuRecordsByMaterialId(material.materialId)
  const selectedIds = state.barcode.selectedSkuIds.length > 0 ? state.barcode.selectedSkuIds : skuRecords.slice(0, 1).map((item) => item.materialSkuId)
  const selectedSkuRecords = skuRecords.filter((item) => selectedIds.includes(item.materialSkuId))
  const body = `
    <div class="space-y-4">
      <div class="text-sm text-slate-600">${escapeHtml(material.materialCode)} · ${escapeHtml(material.materialName)}</div>
      <div class="space-y-2">
        <div class="text-sm font-medium text-slate-700">选择 SKU</div>
        <div class="space-y-2">
          ${skuRecords
            .map(
              (item) => `
                <label class="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" ${selectedIds.includes(item.materialSkuId) ? 'checked' : ''} data-pcs-material-archive-field="barcode-sku" data-value="${escapeHtml(item.materialSkuId)}" />
                  <span>${escapeHtml(item.materialSkuCode)}</span>
                  <span class="text-slate-500">${escapeHtml(item.colorName)} / ${escapeHtml(item.specName)}</span>
                </label>
              `,
            )
            .join('')}
        </div>
      </div>
      ${renderFormField('打印数量', renderTextInput('barcode-quantity', state.barcode.quantity, '输入数量', 'number'), true)}
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div class="text-sm font-medium text-slate-900">打印预览</div>
        <div class="mt-3 grid gap-3 md:grid-cols-2">
          ${selectedSkuRecords
            .map(
              (item) => `
                <div class="rounded-md border border-slate-200 bg-white px-3 py-3 text-center">
                  <div class="text-[11px] text-slate-500">${escapeHtml(material.materialName)}</div>
                  <div class="mt-2 font-mono text-sm font-semibold text-slate-900">${escapeHtml(item.barcode || item.materialSkuCode)}</div>
                  <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.materialSkuCode)}</div>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
    </div>
  `
  const footer = `
    <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-material-archive-action="close-drawers">取消</button>
    <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-material-archive-action="confirm-barcode-print">确认打印</button>
  `
  return renderDrawerShell('打印条码', body, footer)
}

function renderLogDrawer(): string {
  if (!state.log.open || !state.log.materialId) return ''
  const material = getMaterialArchiveById(state.log.materialId)
  if (!material) return ''
  const logs = listMaterialLogRecordsByMaterialId(material.materialId)
  const body = `
    <div class="space-y-4">
      <div class="text-sm text-slate-600">${escapeHtml(material.materialCode)} · ${escapeHtml(material.materialName)}</div>
      ${logs
        .map(
          (log) => `
            <div class="rounded-md border border-slate-200 px-4 py-3">
              <div class="flex items-center justify-between gap-3">
                <div class="text-sm font-medium text-slate-900">${escapeHtml(log.title)}</div>
                <div class="text-xs text-slate-500">${escapeHtml(formatDateTime(log.createdAt))}</div>
              </div>
              <div class="mt-1 text-xs text-slate-500">${escapeHtml(log.operatorName)}</div>
              <div class="mt-2 text-sm text-slate-700">${escapeHtml(log.detail)}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
  const footer = `<button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-material-archive-action="close-drawers">关闭</button>`
  return renderDrawerShell('物料日志', body, footer)
}

function renderListPage(kind: MaterialArchiveKind): string {
  const meta = KIND_META[kind]
  const records = getFilteredRecords(kind)
  const filter = state.filters[kind]
  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      <section class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs text-slate-500">商品中心 / 物料档案</p>
          <h1 class="mt-1 text-2xl font-semibold text-slate-900">${escapeHtml(meta.label)}</h1>
          <p class="mt-1 text-sm text-slate-500">${escapeHtml(meta.description)}</p>
        </div>
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm text-white hover:bg-slate-800" data-pcs-material-archive-action="open-create" data-kind="${escapeHtml(kind)}">
          <i data-lucide="plus" class="h-4 w-4"></i>${escapeHtml(meta.createLabel)}
        </button>
      </section>
      ${renderStats(kind)}
      <section class="rounded-lg border bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-center gap-3">
          <div class="min-w-[240px] flex-1">${renderTextInput(`filter-search-${kind}`, filter.search, '搜索编码/名称/分类...')}</div>
          <div class="w-full sm:w-40">${renderSelect(`filter-status-${kind}`, filter.status === 'all' ? '' : filter.status, [{ value: 'ACTIVE', label: '启用' }, { value: 'INACTIVE', label: '停用' }, { value: 'ARCHIVED', label: '已归档' }], '全部状态')}</div>
        </div>
      </section>
      ${renderListTable(kind, records)}
      ${renderCreateDrawer()}
      ${renderSkuEditorDrawer()}
      ${renderBarcodeDrawer()}
      ${renderLogDrawer()}
    </div>
  `
}

function renderOverviewTab(material: MaterialArchiveRecord, skuRecords: MaterialSkuRecord[], usageRecords: MaterialUsageRecord[]): string {
  const minCost = skuRecords.length > 0 ? Math.min(...skuRecords.map((item) => item.costPrice)) : null
  const maxCost = skuRecords.length > 0 ? Math.max(...skuRecords.map((item) => item.costPrice)) : null
  const latestUsage = [...usageRecords].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null
  return `
    <section class="grid gap-4 xl:grid-cols-[2fr,1fr]">
      <div class="rounded-lg border bg-white p-5 shadow-sm">
        <div class="flex flex-col gap-5 lg:flex-row">
          <div class="w-full max-w-[280px] shrink-0 space-y-3">
            ${renderArchiveImage(material.mainImageUrl, material.materialName)}
            <div class="grid grid-cols-3 gap-2">
              ${(material.galleryImageUrls || []).slice(0, 3).map((item) => renderArchiveImage(item, material.materialName, 'sm')).join('')}
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <div class="grid gap-4 md:grid-cols-2">
              <div><div class="text-xs text-slate-500">物料名称</div><div class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(material.materialName)}</div></div>
              <div><div class="text-xs text-slate-500">外文名</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(material.materialNameEn || '-')}</div></div>
              <div><div class="text-xs text-slate-500">分类</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(material.categoryName || '-')}</div></div>
              <div><div class="text-xs text-slate-500">规格摘要</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(material.specSummary || '-')}</div></div>
              <div><div class="text-xs text-slate-500">成分</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(material.composition || '-')}</div></div>
              <div><div class="text-xs text-slate-500">计价单位</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(material.pricingUnit || '-')}</div></div>
              <div><div class="text-xs text-slate-500">门幅 / 尺寸</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(material.widthText || '-')}</div></div>
              <div><div class="text-xs text-slate-500">克重</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(material.gramWeightText || '-')}</div></div>
              <div><div class="text-xs text-slate-500">条码模板编码</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(material.barcodeTemplateCode || '-')}</div></div>
              <div><div class="text-xs text-slate-500">SKU 成本区间</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(minCost === null ? '-' : minCost === maxCost ? formatCurrency(minCost) : `${formatCurrency(minCost)} ~ ${formatCurrency(maxCost || 0)}`)}</div></div>
              <div class="md:col-span-2"><div class="text-xs text-slate-500">工艺标签</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(material.processTags.join(' / ') || '-')}</div></div>
              <div class="md:col-span-2"><div class="text-xs text-slate-500">备注</div><div class="mt-1 text-sm leading-6 text-slate-700">${escapeHtml(material.remark || '-')}</div></div>
            </div>
          </div>
        </div>
      </div>
      <aside class="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
        <div class="text-sm font-medium text-slate-900">引用概览</div>
        <div class="grid gap-3">
          <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><div class="text-xs text-slate-500">物料 SKU</div><div class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(skuRecords.length)}</div></div>
          <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><div class="text-xs text-slate-500">技术包引用</div><div class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(usageRecords.length)}</div></div>
          <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><div class="text-xs text-slate-500">关联款式</div><div class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(new Set(usageRecords.map((item) => item.styleCode)).size)}</div></div>
          <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><div class="text-xs text-slate-500">最近引用技术包</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(latestUsage?.technicalVersionLabel || '未建立')}</div></div>
          <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><div class="text-xs text-slate-500">更新时间</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(formatDateTime(material.updatedAt))}</div></div>
        </div>
      </aside>
    </section>
  `
}

function renderSkuSpecText(kind: MaterialArchiveKind, item: MaterialSkuRecord): string {
  if (kind === 'fabric') {
    return item.sizeName && item.sizeName !== '-' ? item.sizeName : item.specName || '-'
  }
  return [item.specName, item.sizeName].filter((value) => value && value !== '-').join(' / ') || '-'
}

function renderSkuTab(kind: MaterialArchiveKind, skuRecords: MaterialSkuRecord[]): string {
  const specMeta = getMaterialSkuSpecMeta(kind)
  const rows = skuRecords
    .map(
      (item) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3">
            <div class="flex items-start gap-3">
              ${renderArchiveImage(item.skuImageUrl, item.materialSkuCode, 'sm')}
              <div class="min-w-0">
                <div class="text-sm font-medium text-slate-900">${escapeHtml(item.materialSkuCode)}</div>
                <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.barcode || '-')}</div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.colorName || '-')}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(renderSkuSpecText(kind, item))}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(formatCurrency(item.costPrice))}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(formatCurrency(item.costPrice + item.freightCost))}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.weightKg)}kg</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(`${item.lengthCm}*${item.widthCm}*${item.heightCm}cm`)}</td>
          <td class="px-4 py-3">${renderStatusBadge(item.status)}</td>
          <td class="px-4 py-3">
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:bg-slate-50" data-pcs-material-archive-action="open-sku-edit" data-material-id="${escapeHtml(item.materialId)}" data-material-sku-id="${escapeHtml(item.materialSkuId)}">编辑</button>
          </td>
        </tr>
      `,
    )
    .join('')
  return `
    <section class="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">物料 SKU</th>
              <th class="px-4 py-3 font-medium">${escapeHtml(specMeta.primaryLabel)}</th>
              <th class="px-4 py-3 font-medium">${escapeHtml(specMeta.secondaryLabel)}</th>
              <th class="px-4 py-3 font-medium">成本价</th>
              <th class="px-4 py-3 font-medium">含运费成本</th>
              <th class="px-4 py-3 font-medium">重量</th>
              <th class="px-4 py-3 font-medium">体积</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="9" class="px-4 py-10 text-center text-sm text-slate-500">当前主档尚未建立物料 SKU。</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderUsageTab(usageRecords: MaterialUsageRecord[]): string {
  const rows = usageRecords
    .map(
      (item) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3">
            ${
              item.styleId
                ? `<button type="button" class="text-left text-sm font-medium text-slate-900 hover:text-slate-700" data-nav="/pcs/products/styles/${escapeHtml(item.styleId)}">${escapeHtml(item.styleCode)}</button>`
                : `<div class="text-sm font-medium text-slate-900">${escapeHtml(item.styleCode)}</div>`
            }
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.styleName)}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">
            ${
              item.styleId && item.technicalVersionId
                ? `<button type="button" class="text-left font-medium text-slate-900 hover:text-slate-700" data-nav="/pcs/products/styles/${escapeHtml(item.styleId)}/technical-data/${escapeHtml(item.technicalVersionId)}">${escapeHtml(item.technicalVersionLabel || '-')}</button>`
                : escapeHtml(item.technicalVersionLabel || '-')
            }
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.consumptionText)}</td>
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(formatDateTime(item.updatedAt))}</td>
        </tr>
      `,
    )
    .join('')
  return `
    <section class="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">款式档案</th>
              <th class="px-4 py-3 font-medium">技术包版本</th>
              <th class="px-4 py-3 font-medium">用量</th>
              <th class="px-4 py-3 font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="4" class="px-4 py-10 text-center text-sm text-slate-500">当前主档尚未被技术包引用。</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderLogTab(logs: MaterialLogRecord[]): string {
  return `
    <section class="rounded-lg border bg-white p-5 shadow-sm">
      <div class="space-y-4">
        ${logs
          .map(
            (item) => `
              <div class="border-l-2 border-slate-200 pl-4">
                <div class="text-xs text-slate-500">${escapeHtml(formatDateTime(item.createdAt))}</div>
                <div class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(item.title)}</div>
                <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.operatorName)}</div>
                <div class="mt-1 text-sm text-slate-700">${escapeHtml(item.detail)}</div>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderDetailPage(kind: MaterialArchiveKind, materialId: string): string {
  const material = getMaterialArchiveById(materialId)
  if (!material || material.kind !== kind) {
    return `
      <div class="space-y-5 p-4">
        <section class="rounded-lg border bg-white p-4 text-center shadow-sm">
          <h1 class="text-xl font-semibold text-slate-900">未找到物料档案</h1>
          <p class="mt-2 text-sm text-slate-500">请返回列表重新选择。</p>
          <button type="button" class="mt-4 inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/materials/${escapeHtml(kind)}">返回列表</button>
        </section>
      </div>
    `
  }

  if (state.detail.materialId !== materialId) {
    state.detail.materialId = materialId
    state.detail.activeTab = 'overview'
  }

  const skuRecords = listMaterialSkuRecordsByMaterialId(material.materialId)
  const usageRecords = listMaterialUsageRecordsByMaterialId(material.materialId)
  const logs = listMaterialLogRecordsByMaterialId(material.materialId)
  const tabContent =
    state.detail.activeTab === 'overview'
      ? renderOverviewTab(material, skuRecords, usageRecords)
      : state.detail.activeTab === 'skus'
        ? renderSkuTab(kind, skuRecords)
        : state.detail.activeTab === 'usage'
          ? renderUsageTab(usageRecords)
          : renderLogTab(logs)

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      <section class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-start gap-4">
          <button type="button" class="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/materials/${escapeHtml(kind)}">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
          </button>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(material.materialCode)}</h1>
              ${renderStatusBadge(material.status)}
            </div>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(material.materialName)} · ${escapeHtml(KIND_META[kind].label)}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-material-archive-action="open-sku-create" data-material-id="${escapeHtml(material.materialId)}">新增SKU</button>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-material-archive-action="open-log" data-material-id="${escapeHtml(material.materialId)}">查看日志</button>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-material-archive-action="open-barcode" data-material-id="${escapeHtml(material.materialId)}" ${skuRecords.length === 0 ? 'disabled' : ''}>打印条码</button>
        </div>
      </section>
      <section class="rounded-lg border bg-white p-2 shadow-sm">
        <div class="flex flex-wrap gap-2">
          ${DETAIL_TABS.map((tab) => `<button type="button" class="${escapeHtml(toClassName('inline-flex h-9 items-center rounded-md px-3 text-sm', state.detail.activeTab === tab.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'))}" data-pcs-material-archive-action="set-detail-tab" data-value="${escapeHtml(tab.key)}">${escapeHtml(tab.label)}</button>`).join('')}
        </div>
      </section>
      ${tabContent}
      ${renderCreateDrawer()}
      ${renderSkuEditorDrawer()}
      ${renderBarcodeDrawer()}
      ${renderLogDrawer()}
    </div>
  `
}

function resolveClosestNode(target: unknown, selector: string): HTMLElement | null {
  if (!target || typeof target !== 'object') return null
  const maybe = target as { closest?: (selector: string) => HTMLElement | null }
  if (typeof maybe.closest === 'function') {
    return maybe.closest(selector)
  }
  if ('dataset' in maybe) return maybe as HTMLElement
  return null
}

function resolveFieldValue(target: Element): { value: string; checked: boolean } {
  const input = target as HTMLInputElement & HTMLSelectElement
  return {
    value: 'value' in input ? input.value : '',
    checked: 'checked' in input ? Boolean(input.checked) : false,
  }
}

function syncDefaultBarcodeSelection(materialId: string): void {
  const skuRecords = listMaterialSkuRecordsByMaterialId(materialId)
  if (state.barcode.selectedSkuIds.length === 0 && skuRecords.length > 0) {
    state.barcode.selectedSkuIds = [skuRecords[0].materialSkuId]
  }
}

function submitCreate(): void {
  if (!state.create.materialName.trim()) {
    state.notice = '请先填写物料名称。'
    return
  }
  if (!state.create.categoryName.trim()) {
    state.notice = '请先填写分类。'
    return
  }
  if (!state.create.pricingUnit.trim()) {
    state.notice = '请先选择计价单位。'
    return
  }
  const created = createMaterialArchive({
    kind: state.create.kind,
    materialName: state.create.materialName.trim(),
    materialNameEn: state.create.materialNameEn.trim(),
    categoryName: state.create.categoryName.trim(),
    specSummary: state.create.specSummary.trim(),
    composition: state.create.composition.trim(),
    processTags: splitTags(state.create.processTags),
    widthText: state.create.widthText.trim(),
    gramWeightText: state.create.gramWeightText.trim(),
    pricingUnit: state.create.pricingUnit.trim(),
    mainImageUrl: state.create.mainImageUrl.trim(),
    barcodeTemplateCode: state.create.barcodeTemplateCode.trim(),
    remark: state.create.remark.trim(),
  })
  const nextKind = state.create.kind
  resetCreateState(nextKind)
  state.notice = `已创建 ${created.materialCode}。`
  appStore.navigate(`/pcs/materials/${nextKind}/${created.materialId}`)
}

function submitSkuEditor(): void {
  if (!state.skuEditor.materialId) {
    state.notice = '未找到对应物料主档。'
    return
  }
  const material = getMaterialArchiveById(state.skuEditor.materialId)
  if (!material) {
    state.notice = '未找到对应物料主档。'
    return
  }
  if (!state.skuEditor.colorName.trim() || !state.skuEditor.specValue.trim()) {
    const specMeta = getMaterialSkuSpecMeta(material.kind)
    state.notice = `请先补齐 ${specMeta.primaryLabel} 与 ${specMeta.secondaryLabel}。`
    return
  }

  const payload = buildSkuEditorInput(material)
  const result = state.skuEditor.materialSkuId
    ? updateMaterialSkuRecord(state.skuEditor.materialSkuId, payload)
    : createMaterialSkuRecord(material.materialId, payload)

  if (!result) {
    state.notice = state.skuEditor.materialSkuId ? '保存物料 SKU 失败。' : '新增物料 SKU 失败。'
    return
  }

  state.detail.activeTab = 'skus'
  state.notice = state.skuEditor.materialSkuId
    ? `已更新 ${result.materialSkuCode}。`
    : `已新增 ${result.materialSkuCode}。`
  resetSkuEditor()
}

function updateFilterField(field: string, value: string): boolean {
  const searchMatch = field.match(/^filter-search-(fabric|accessory|yarn|consumable)$/)
  if (searchMatch) {
    const kind = searchMatch[1] as MaterialArchiveKind
    state.filters[kind].search = value
    return true
  }
  const statusMatch = field.match(/^filter-status-(fabric|accessory|yarn|consumable)$/)
  if (statusMatch) {
    const kind = statusMatch[1] as MaterialArchiveKind
    state.filters[kind].status = (value || 'all') as 'all' | MaterialArchiveStatus
    return true
  }
  return false
}

export function handlePcsMaterialArchiveInput(target: Element): boolean {
  const fieldNode = resolveClosestNode(target, '[data-pcs-material-archive-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsMaterialArchiveField || ''
  const { value, checked } = resolveFieldValue(target)

  if (updateFilterField(field, value)) return true

  switch (field) {
    case 'create-material-name':
      state.create.materialName = value
      return true
    case 'create-material-name-en':
      state.create.materialNameEn = value
      return true
    case 'create-category-name':
      state.create.categoryName = value
      return true
    case 'create-spec-summary':
      state.create.specSummary = value
      return true
    case 'create-composition':
      state.create.composition = value
      return true
    case 'create-process-tags':
      state.create.processTags = value
      return true
    case 'create-width-text':
      state.create.widthText = value
      return true
    case 'create-gram-weight-text':
      state.create.gramWeightText = value
      return true
    case 'create-pricing-unit':
      state.create.pricingUnit = value
      return true
    case 'create-main-image-url':
      state.create.mainImageUrl = value
      return true
    case 'create-barcode-template-code':
      state.create.barcodeTemplateCode = value
      return true
    case 'create-remark':
      state.create.remark = value
      return true
    case 'sku-editor-color-name':
      state.skuEditor.colorName = value
      return true
    case 'sku-editor-spec-value':
      state.skuEditor.specValue = value
      return true
    case 'sku-editor-cost-price':
      state.skuEditor.costPrice = value
      return true
    case 'sku-editor-freight-cost':
      state.skuEditor.freightCost = value
      return true
    case 'sku-editor-image-url':
      state.skuEditor.skuImageUrl = value
      return true
    case 'sku-editor-barcode':
      state.skuEditor.barcode = value
      return true
    case 'sku-editor-weight-kg':
      state.skuEditor.weightKg = value
      return true
    case 'sku-editor-length-cm':
      state.skuEditor.lengthCm = value
      return true
    case 'sku-editor-width-cm':
      state.skuEditor.widthCm = value
      return true
    case 'sku-editor-height-cm':
      state.skuEditor.heightCm = value
      return true
    case 'barcode-quantity':
      state.barcode.quantity = value
      return true
    case 'barcode-sku': {
      const skuId = fieldNode.dataset.value || value
      state.barcode.selectedSkuIds = checked
        ? [...new Set([...state.barcode.selectedSkuIds, skuId])]
        : state.barcode.selectedSkuIds.filter((item) => item !== skuId)
      return true
    }
    default:
      return false
  }
}

export function handlePcsMaterialArchiveEvent(target: HTMLElement): boolean {
  const actionNode = resolveClosestNode(target, '[data-pcs-material-archive-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsMaterialArchiveAction || ''

  switch (action) {
    case 'close-notice':
      state.notice = null
      return true
    case 'open-create': {
      const kind = (actionNode.dataset.kind as MaterialArchiveKind) || 'fabric'
      resetCreateState(kind)
      state.create.open = true
      return true
    }
    case 'submit-create':
      submitCreate()
      return true
    case 'open-sku-create': {
      const materialId = actionNode.dataset.materialId || ''
      return openSkuEditor(materialId)
    }
    case 'open-sku-edit': {
      const materialId = actionNode.dataset.materialId || ''
      const materialSkuId = actionNode.dataset.materialSkuId || ''
      return openSkuEditor(materialId, materialSkuId || null)
    }
    case 'submit-sku-editor':
      submitSkuEditor()
      return true
    case 'open-barcode':
      state.barcode.open = true
      state.barcode.materialId = actionNode.dataset.materialId || ''
      state.barcode.selectedSkuIds = []
      state.barcode.quantity = '1'
      syncDefaultBarcodeSelection(state.barcode.materialId)
      return true
    case 'confirm-barcode-print':
      state.notice = `已加入 ${state.barcode.selectedSkuIds.length || 0} 个物料 SKU 的条码打印任务。`
      state.barcode.open = false
      return true
    case 'open-log':
      state.log.open = true
      state.log.materialId = actionNode.dataset.materialId || ''
      return true
    case 'set-detail-tab':
      state.detail.activeTab = (actionNode.dataset.value as MaterialDetailTabKey) || 'overview'
      return true
    case 'close-drawers':
      state.create.open = false
      resetSkuEditor()
      state.barcode.open = false
      state.log.open = false
      return true
    default:
      return false
  }
}

export function isPcsMaterialArchiveDialogOpen(): boolean {
  return state.create.open || state.skuEditor.open || state.barcode.open || state.log.open
}

export function renderPcsFabricArchiveListPage(): string {
  return renderListPage('fabric')
}

export function renderPcsFabricArchiveCreatePage(): string {
  resetCreateState('fabric')
  state.create.open = true
  return renderListPage('fabric')
}

export function renderPcsAccessoryArchiveListPage(): string {
  return renderListPage('accessory')
}

export function renderPcsAccessoryArchiveCreatePage(): string {
  resetCreateState('accessory')
  state.create.open = true
  return renderListPage('accessory')
}

export function renderPcsYarnArchiveListPage(): string {
  return renderListPage('yarn')
}

export function renderPcsYarnArchiveCreatePage(): string {
  resetCreateState('yarn')
  state.create.open = true
  return renderListPage('yarn')
}

export function renderPcsConsumableArchiveListPage(): string {
  return renderListPage('consumable')
}

export function renderPcsConsumableArchiveCreatePage(): string {
  resetCreateState('consumable')
  state.create.open = true
  return renderListPage('consumable')
}

export function renderPcsMaterialArchiveDetailPage(kind: MaterialArchiveKind, materialId: string): string {
  return renderDetailPage(kind, materialId)
}
