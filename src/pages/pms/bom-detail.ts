// @page-pattern: detail
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { getPmsBomTemplate, listPmsBomLogs, updatePmsBomMaterialUsage, type PmsBomTemplate } from '../../data/pms/bom-templates.ts'
import { getPmsBomDetail, listPmsBomActionLogs, submitPmsBomTemplate, updatePmsBomDetail, type PmsBomDetail, type PmsBomOption } from '../../data/pms/bom-detail.ts'
import { getPmsProductSkuRow, type PmsProductSkuRow } from '../../data/pms/product-skus.ts'
import { listPmsLogs, PmsDomainError } from '../../data/pms/runtime.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsMoney,
  formatPmsQty,
  formatPmsTime,
  hydratePmsSurface,
  readNumberField,
  readTextField,
  handlePmsCommonImageEvent,
  renderPmsBusinessImage,
  renderPmsImagePreview,
  renderPmsFeedback,
  renderPmsStatusBadge,
} from './shared.ts'

const EVENT_PREFIX = 'pms-bomd'
const ROOT_SELECTOR = '[data-pms-bomd-root]'
const BUYER = { id: 'USR-PMS-WANG', name: '王采购', role: '采购员' as const }
const MANAGER = { id: 'USR-PMS-CHEN', name: '陈主管', role: '采购主管' as const }

type BomMaterialFilter = '' | '布料' | '辅料' | '工艺' | '其他'

const MATERIAL_FILTERS: Array<{ value: BomMaterialFilter; label: string }> = [
  { value: '', label: '全部' },
  { value: '布料', label: '布料' },
  { value: '辅料', label: '辅料' },
  { value: '工艺', label: '工艺' },
  { value: '其他', label: '其他' },
]

interface BomDetailPageState {
  spu: string
  materialFilter: BomMaterialFilter
  confirmArmed: boolean
  feedback: string
  feedbackOk: boolean
}

const state: BomDetailPageState = { spu: '', materialFilter: '', confirmArmed: false, feedback: '', feedbackOk: true }

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function bomStatusTone(status: PmsBomTemplate['status']): 'green' | 'yellow' | 'slate' {
  if (status === '已发布') return 'green'
  if (status === '未匹配') return 'yellow'
  return 'slate'
}

function findSkuRow(spu: string): PmsProductSkuRow | undefined {
  return getPmsProductSkuRow('garment', spu) ?? getPmsProductSkuRow('sample', spu)
}

function matchesMaterialFilter(materialType: string, filter: BomMaterialFilter): boolean {
  if (!filter) return true
  const type = materialType
  const isFabric = type.includes('面料') || type.includes('布')
  const isAccessory = type.includes('辅料') || type.includes('五金') || type.includes('拉链')
  const isCraft = type.includes('工艺') || type.includes('印花') || type.includes('绣花') || type.includes('洗水')
  if (filter === '布料') return isFabric
  if (filter === '辅料') return isAccessory
  if (filter === '工艺') return isCraft
  return !isFabric && !isAccessory && !isCraft
}

function renderMaterialFilters(): string {
  const buttons = MATERIAL_FILTERS.map(
    ({ value, label }) => `<button type="button" class="inline-flex h-8 items-center rounded-md px-3 text-xs text-blue-700 hover:bg-blue-50 ${state.materialFilter === value ? 'bg-blue-50 font-semibold' : ''}" data-${EVENT_PREFIX}-filter="${value}" data-skip-page-rerender="true">${label}</button>`,
  ).join('')
  return `<div class="flex flex-wrap items-center gap-1.5" data-${EVENT_PREFIX}-filters><span class="text-xs text-slate-500">物料分类</span>${buttons}</div>`
}

function renderMaterialTable(template: PmsBomTemplate, filter: BomMaterialFilter): string {
  const editable = template.status !== '未匹配'
  const materials = template.materials.filter((material) => matchesMaterialFilter(material.materialType, filter))
  const rows = materials.length
    ? materials
        .map((material) => {
          const usageInput = editable
            ? `<input class="h-8 w-20 rounded-md border px-2 text-sm" type="number" min="0.0001" step="0.0001" value="${material.usagePerPiece}" data-${EVENT_PREFIX}-usage="${escapeHtml(material.materialCode)}" data-skip-page-rerender="true" />`
            : `<span class="tabular-nums">${material.usagePerPiece}</span>`
          const lossInput = editable
            ? `<input class="h-8 w-16 rounded-md border px-2 text-sm" type="number" min="0" max="1" step="0.01" value="${material.lossRate}" data-${EVENT_PREFIX}-loss="${escapeHtml(material.materialCode)}" data-skip-page-rerender="true" />`
            : `<span class="tabular-nums">${Math.round(material.lossRate * 100)}%</span>`
          return `<tr class="border-b last:border-b-0">
            <td class="px-3 py-2"><div class="flex items-center gap-3">${renderPmsBusinessImage(material.imageUrl, `${material.materialName}（${material.materialCode}）实物图`, 'h-11 w-11')}<div><div class="font-medium">${escapeHtml(material.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(material.materialCode)} · ${escapeHtml(material.materialType)} · ${escapeHtml(material.unit)}</div></div></div></td>
            <td class="px-3 py-2">${usageInput}</td>
            <td class="px-3 py-2">${lossInput}</td>
            <td class="px-3 py-2 text-sm tabular-nums">${(material.usagePerPiece * (1 + material.lossRate)).toFixed(4)}</td>
            <td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(material.stockQty, material.unit)}</td>
            <td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(material.purchasingQty, material.unit)}</td>
            <td class="px-3 py-2 text-sm">${escapeHtml(material.supplierName)}</td>
            <td class="px-3 py-2 text-sm">${escapeHtml(material.warehouse)}</td>
          </tr>`
        })
        .join('')
    : `<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="8">${filter ? `当前分类「${escapeHtml(filter)}」下暂无物料明细` : '该款式暂无物料明细（成衣直采或样衣不拆 BOM）'}</td></tr>`
  const saveButton = editable && materials.length > 0 ? renderSecondaryButton('保存用量', { prefix: EVENT_PREFIX, action: 'save-usage', skipPageRerender: true }, 'check-check') : ''
  return `<section class="overflow-hidden rounded-lg border"><header class="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3"><div><h2 class="font-semibold">SPU 物料组成</h2><p class="mt-1 text-xs text-slate-500">单件计划用量 = 用量 × (1 + 损耗)；当前显示 ${materials.length}/${template.materials.length} 种${editable ? '，可直接修改用量与损耗后保存' : '，BOM 未匹配，用量只读'}</p></div><div class="flex items-center gap-2">${renderMaterialFilters()}${saveButton}</div></header><div class="overflow-x-auto"><table class="w-full table-fixed text-left" style="min-width: 1080px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="w-72 px-3 py-2">物料</th><th class="w-24 px-3 py-2">单件用量</th><th class="w-20 px-3 py-2">损耗率</th><th class="w-24 px-3 py-2">计划用量</th><th class="w-24 px-3 py-2">库存</th><th class="w-24 px-3 py-2">采购中</th><th class="w-44 px-3 py-2">供应商</th><th class="w-32 px-3 py-2">仓库</th></tr></thead><tbody>${rows}</tbody></table></div></section>`
}

function renderSkuSection(spu: string): string {
  const row = findSkuRow(spu)
  if (!row) return '<section class="rounded-lg border p-4 text-sm text-muted-foreground">暂无关联 SKU</section>'
  const rows = row.skuItems.map((item) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${escapeHtml(item.sku)}</td><td class="px-3 py-2 text-sm">${escapeHtml(item.color)} / ${escapeHtml(item.size)}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsMoney(item.standardPrice)}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(item.stockQty, '件')}</td></tr>`).join('')
  return `<section class="overflow-hidden rounded-lg border"><header class="border-b bg-muted/30 px-4 py-3"><h2 class="font-semibold">SKU 明细</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.category)} · ${escapeHtml(row.season)} · ${escapeHtml(row.source)}</p></header><div class="overflow-x-auto"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">SKU</th><th class="px-3 py-2">颜色 / 尺码</th><th class="px-3 py-2">标准价</th><th class="px-3 py-2">库存</th></tr></thead><tbody>${rows}</tbody></table></div></section>`
}

function renderOptionInputs(detail: PmsBomDetail): string {
  return detail.options
    .map((option, optionIndex) => {
      if (option.kind === 'checkbox') {
        return `<fieldset class="rounded-md border p-3"><legend class="px-1 text-xs text-muted-foreground">${escapeHtml(option.label)}</legend><label class="mt-1 flex items-center gap-1.5 text-sm"><input type="checkbox" ${option.selected ? 'checked' : ''} data-${EVENT_PREFIX}-option="${optionIndex}" data-skip-page-rerender="true" />需要</label></fieldset>`
      }
      const choices = option.kind === 'enum' ? option.choices ?? [] : ['是', '否']
      return `<fieldset class="rounded-md border p-3"><legend class="px-1 text-xs text-muted-foreground">${escapeHtml(option.label)}</legend><div class="flex flex-wrap gap-4 text-sm">${choices.map((value) => `<label class="flex items-center gap-1.5"><input type="radio" name="bom-option-${optionIndex}" value="${escapeHtml(value)}" ${option.value === value ? 'checked' : ''} data-${EVENT_PREFIX}-option="${optionIndex}" data-skip-page-rerender="true" />${escapeHtml(value)}</label>`).join('')}</div></fieldset>`
    })
    .join('')
}

function renderLogs(spu: string): string {
  const entries = [
    ...listPmsLogs('bom-template', spu).map((log) => ({ action: log.action, detail: `${log.beforeValue} → ${log.afterValue}${log.reason ? `（${log.reason}）` : ''}`, actorName: log.actorName, occurredAt: log.occurredAt })),
    ...listPmsBomActionLogs(spu).map((log) => ({ action: log.action, detail: log.detail, actorName: log.actorName, occurredAt: log.occurredAt })),
  ].sort((left, right) => (left.occurredAt < right.occurredAt ? 1 : -1))
  if (entries.length === 0) return '<li class="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">暂无操作日志</li>'
  return entries
    .map((log) => `<li class="rounded-md border p-3 text-xs"><div class="flex items-center justify-between"><strong>${escapeHtml(log.action)}</strong><span class="text-slate-500">${formatPmsTime(log.occurredAt)}</span></div><div class="mt-1 text-slate-600">${escapeHtml(log.actorName)}：${escapeHtml(log.detail)}</div></li>`)
    .join('')
}

function field(label: string, value: string, fieldName: string, type = 'text'): string {
  return `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<input class="h-8 rounded-md border bg-background px-2 text-sm" type="${type}" ${type === 'number' ? 'min="0" step="0.01"' : ''} value="${escapeHtml(value)}" data-${EVENT_PREFIX}-field="${fieldName}" data-skip-page-rerender="true" /></label>`
}

function renderBackToListButton(): string {
  return renderSecondaryButton('返回列表', undefined, 'arrow-left').replace('<button', '<button data-nav="/pms/bom-templates"')
}

function renderInner(spu: string): string {
  const template = getPmsBomTemplate(spu)
  const detail = getPmsBomDetail(spu)
  if (!template || !detail) {
    return `<div class="p-4"><div class="rounded-lg border bg-card p-6"><h1 class="text-xl font-semibold">BOM/样板详情</h1><p class="mt-2 text-sm text-muted-foreground">未找到 SPU ${escapeHtml(spu)} 的 BOM/样板。</p><div class="mt-4">${renderBackToListButton()}</div></div></div>`
  }
  return `<div data-pms-bomd-root data-skip-page-rerender="true" class="space-y-4 p-4"><div data-pms-bomd-image-surface>${renderPmsImagePreview()}</div>
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-4">
        ${renderBackToListButton()}
        ${renderPmsBusinessImage(template.imageUrl, `${template.productName}（${template.spu}）款式图`, 'h-16 w-16')}
        <div>
          <h1 class="text-xl font-semibold">${escapeHtml(template.productName)} · ${escapeHtml(template.spu)}</h1>
          <p class="mt-1 text-xs text-slate-500">${escapeHtml(template.styleCode)} · ${escapeHtml(template.version)} · ${renderPmsStatusBadge(template.status, bomStatusTone(template.status))} · 更新 ${escapeHtml(detail.updatedAt)}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        ${renderSecondaryButton('保存样板详情', { prefix: EVENT_PREFIX, action: 'save-detail' }, 'check-check')}
        ${renderPrimaryButton(state.confirmArmed ? '再次点击提交并发布 BOM' : '提交 BOM', { prefix: EVENT_PREFIX, action: 'submit-bom' }, 'check-check')}
      </div>
    </header>
    ${renderPmsFeedback(state.feedback, state.feedbackOk)}
    ${state.confirmArmed ? '<div class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">提交后 BOM 变为“已发布”，做货采购单可以生成面辅料需求；请确认用量与工艺已核对。</div>' : ''}
    <section class="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm md:grid-cols-4">
      <div><dt class="text-xs text-muted-foreground">季节 / 品类</dt><dd class="mt-1">${escapeHtml(detail.season)} · ${escapeHtml(detail.category)}</dd></div>
      <div><dt class="text-xs text-muted-foreground">打样状态</dt><dd class="mt-1">${escapeHtml(detail.sampleStatus)}</dd></div>
      <div><dt class="text-xs text-muted-foreground">标准成本</dt><dd class="mt-1 tabular-nums">${formatPmsMoney(detail.standardCost, detail.currency)}</dd></div>
      <div><dt class="text-xs text-muted-foreground">报价（可调整）</dt><dd class="mt-1"><input class="h-8 w-28 rounded-md border px-2 text-sm" type="number" min="0" step="0.01" value="${detail.quotePrice}" data-${EVENT_PREFIX}-field="quotePrice" data-skip-page-rerender="true" /> <span class="text-xs text-slate-500">${escapeHtml(detail.priceUpdatedAt)}</span></dd></div>
    </section>
    <section class="rounded-lg border p-4"><h2 class="font-semibold">工厂信息（6 项）</h2><div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
      ${field('工厂名称', detail.factoryName, 'factoryName')}
      ${field('工厂联系人', detail.factoryContact, 'factoryContact')}
      ${field('联系电话', detail.factoryPhone, 'factoryPhone')}
      ${field('生产周期（天）', String(detail.factoryLeadTimeDays), 'factoryLeadTimeDays', 'number')}
      ${field('付款条件', detail.paymentTerms, 'paymentTerms')}
      ${field('工厂地址', detail.factoryAddress, 'factoryAddress')}
    </div></section>
    <section class="rounded-lg border p-4"><h2 class="font-semibold">价格 / 成本（8 项）</h2><p class="mt-1 text-xs text-slate-500">口径：总成本 = 单位成本 + 运费 + 包装费（单件），保存后由系统重算；目标毛利率按百分比填写。</p><div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
      ${field('建议售价', String(detail.suggestedPrice), 'suggestedPrice', 'number')}
      ${field('单件重量（kg）', String(detail.pieceWeight), 'pieceWeight', 'number')}
      ${field('单位成本', String(detail.unitCost), 'unitCost', 'number')}
      <div><dt class="text-xs text-muted-foreground">总成本（系统重算）</dt><dd class="mt-1 h-8 rounded-md border bg-muted/40 px-2 text-sm leading-8 tabular-nums">${formatPmsMoney(detail.totalCost, detail.currency)}</dd></div>
      ${field('采购价', String(detail.purchasePrice), 'purchasePrice', 'number')}
      ${field('运费', String(detail.freightCost), 'freightCost', 'number')}
      ${field('包装费', String(detail.packagingCost), 'packagingCost', 'number')}
      ${field('目标毛利率（%）', String(detail.targetGrossMargin), 'targetGrossMargin', 'number')}
    </div></section>
    <section class="rounded-lg border p-4"><h2 class="font-semibold">布料 / 辅料 / 工艺（6 项）</h2><div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
      ${field('主布料', detail.mainFabric, 'mainFabric')}
      ${field('主辅料', detail.mainAccessory, 'mainAccessory')}
      ${field('印花类型', detail.printType, 'printType')}
      ${field('绣花类型', detail.embroideryType, 'embroideryType')}
      ${field('颜色数量', String(detail.colorCount), 'colorCount', 'number')}
      <div class="flex flex-col gap-1 text-xs text-muted-foreground">工艺路线<div class="flex flex-wrap gap-1 pt-1">${detail.craftRoute.map((step, index) => `<span class="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-600">${index + 1}. ${escapeHtml(step)}</span>`).join('') || '<span class="text-xs text-slate-500">未配置</span>'}</div></div>
    </div></section>
    <div data-${EVENT_PREFIX}-material-surface>${renderMaterialTable(template, state.materialFilter)}</div>
    ${renderSkuSection(spu)}
    <section class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-lg border p-4"><h2 class="font-semibold">工艺说明</h2><textarea class="mt-3 min-h-28 w-full rounded-md border bg-background p-2 text-sm" data-${EVENT_PREFIX}-field="craftNotes" data-skip-page-rerender="true">${escapeHtml(detail.craftNotes)}</textarea></div>
      <div class="rounded-lg border p-4"><h2 class="font-semibold">款式说明（原型为纯文本，原富文本编辑器已降级）</h2><textarea class="mt-3 min-h-28 w-full rounded-md border bg-background p-2 text-sm" data-${EVENT_PREFIX}-field="description" data-skip-page-rerender="true">${escapeHtml(detail.description)}</textarea></div>
      <div class="rounded-lg border p-4"><h2 class="font-semibold">包装说明</h2><textarea class="mt-3 min-h-24 w-full rounded-md border bg-background p-2 text-sm" data-${EVENT_PREFIX}-field="packagingNotes" data-skip-page-rerender="true">${escapeHtml(detail.packagingNotes)}</textarea></div>
      <div class="rounded-lg border p-4"><h2 class="font-semibold">质检说明</h2><textarea class="mt-3 min-h-24 w-full rounded-md border bg-background p-2 text-sm" data-${EVENT_PREFIX}-field="qualityNotes" data-skip-page-rerender="true">${escapeHtml(detail.qualityNotes)}</textarea></div>
    </section>
    <section class="rounded-lg border p-4"><h2 class="font-semibold">业务选项</h2><div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">${renderOptionInputs(detail)}</div></section>
    <section><h2 class="mb-2 font-semibold">操作日志</h2><ul class="space-y-2">${renderLogs(spu)}</ul></section>
  </div>`
}

function refreshImageSurface(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-bomd-image-surface]')
  if (surface) surface.innerHTML = renderPmsImagePreview()
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.outerHTML = renderInner(state.spu)
  hydratePmsSurface(document.querySelector(ROOT_SELECTOR))
}

function refreshMaterialSurface(): void {
  const surface = rootElement()?.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-material-surface]`)
  const template = getPmsBomTemplate(state.spu)
  if (!surface || !template) return
  surface.innerHTML = renderMaterialTable(template, state.materialFilter)
  hydratePmsSurface(surface)
}

function readOptions(): PmsBomOption[] {
  const root = rootElement()
  if (!root) return []
  const detail = getPmsBomDetail(state.spu)
  if (!detail) return []
  return detail.options.map((option, index) => {
    if (option.kind === 'checkbox') {
      const node = root.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-option="${index}"]`)
      const selected = node ? node.checked : option.selected
      return { ...option, value: selected ? '是' : '否', selected }
    }
    const checked = root.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-option="${index}"]:checked`)
    return { ...option, value: checked?.value ?? option.value, selected: true }
  })
}

function saveDetail(): void {
  const root = rootElement()
  if (!root) return
  try {
    updatePmsBomDetail(
      state.spu,
      {
        description: readTextField(root, `[data-${EVENT_PREFIX}-field="description"]`),
        craftNotes: readTextField(root, `[data-${EVENT_PREFIX}-field="craftNotes"]`),
        packagingNotes: readTextField(root, `[data-${EVENT_PREFIX}-field="packagingNotes"]`),
        qualityNotes: readTextField(root, `[data-${EVENT_PREFIX}-field="qualityNotes"]`),
        factoryName: readTextField(root, `[data-${EVENT_PREFIX}-field="factoryName"]`),
        factoryContact: readTextField(root, `[data-${EVENT_PREFIX}-field="factoryContact"]`),
        factoryPhone: readTextField(root, `[data-${EVENT_PREFIX}-field="factoryPhone"]`),
        factoryAddress: readTextField(root, `[data-${EVENT_PREFIX}-field="factoryAddress"]`),
        factoryLeadTimeDays: readNumberField(root, `[data-${EVENT_PREFIX}-field="factoryLeadTimeDays"]`),
        paymentTerms: readTextField(root, `[data-${EVENT_PREFIX}-field="paymentTerms"]`),
        quotePrice: readNumberField(root, `[data-${EVENT_PREFIX}-field="quotePrice"]`),
        suggestedPrice: readNumberField(root, `[data-${EVENT_PREFIX}-field="suggestedPrice"]`),
        pieceWeight: readNumberField(root, `[data-${EVENT_PREFIX}-field="pieceWeight"]`),
        unitCost: readNumberField(root, `[data-${EVENT_PREFIX}-field="unitCost"]`),
        purchasePrice: readNumberField(root, `[data-${EVENT_PREFIX}-field="purchasePrice"]`),
        freightCost: readNumberField(root, `[data-${EVENT_PREFIX}-field="freightCost"]`),
        packagingCost: readNumberField(root, `[data-${EVENT_PREFIX}-field="packagingCost"]`),
        targetGrossMargin: readNumberField(root, `[data-${EVENT_PREFIX}-field="targetGrossMargin"]`),
        mainFabric: readTextField(root, `[data-${EVENT_PREFIX}-field="mainFabric"]`),
        mainAccessory: readTextField(root, `[data-${EVENT_PREFIX}-field="mainAccessory"]`),
        printType: readTextField(root, `[data-${EVENT_PREFIX}-field="printType"]`),
        embroideryType: readTextField(root, `[data-${EVENT_PREFIX}-field="embroideryType"]`),
        colorCount: readNumberField(root, `[data-${EVENT_PREFIX}-field="colorCount"]`),
        options: readOptions(),
      },
      BUYER,
    )
    state.feedback = '样板详情、工厂与报价已保存。'
    state.feedbackOk = true
    refreshAll()
  } catch (error) {
    state.feedback = error instanceof PmsDomainError ? error.message : '保存样板详情失败'
    state.feedbackOk = false
    refreshAll()
  }
}

function saveUsage(): void {
  const root = rootElement()
  const template = getPmsBomTemplate(state.spu)
  if (!root || !template) return
  try {
    let saved = 0
    template.materials.forEach((material) => {
      const usageSelector = `[data-${EVENT_PREFIX}-usage="${material.materialCode}"]`
      const lossSelector = `[data-${EVENT_PREFIX}-loss="${material.materialCode}"]`
      if (!root.querySelector(usageSelector) || !root.querySelector(lossSelector)) return
      updatePmsBomMaterialUsage(state.spu, material.materialCode, { usagePerPiece: readNumberField(root, usageSelector), lossRate: readNumberField(root, lossSelector) }, BUYER)
      saved += 1
    })
    state.feedback = `已保存 ${saved} 种物料的用量与损耗${state.materialFilter ? '（仅当前分类）' : ''}。`
    state.feedbackOk = true
  } catch (error) {
    state.feedback = error instanceof Error ? error.message : '保存用量失败'
    state.feedbackOk = false
  }
  refreshAll()
}

function submitBom(): void {
  if (!state.confirmArmed) {
    state.confirmArmed = true
    state.feedback = ''
    refreshAll()
    return
  }
  try {
    submitPmsBomTemplate(state.spu, MANAGER)
    state.feedback = 'BOM 已提交并发布，做货采购单现在可以生成面辅料需求。'
    state.feedbackOk = true
    state.confirmArmed = false
  } catch (error) {
    state.feedback = error instanceof PmsDomainError ? error.message : '提交 BOM 失败'
    state.feedbackOk = false
    state.confirmArmed = false
  }
  refreshAll()
}

export function renderPmsBomDetailPage(spu: string): string {
  const decoded = decodeURIComponent(spu)
  if (state.spu !== decoded) {
    state.spu = decoded
    state.materialFilter = ''
    state.confirmArmed = false
    state.feedback = ''
    state.feedbackOk = true
  }
  return renderInner(decoded)
}

export function handlePmsBomDetailEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshImageSurface)) return true
  const filterNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-filter]`)
  if (filterNode) {
    state.materialFilter = (filterNode.dataset.pmsBomdFilter ?? '') as BomMaterialFilter
    refreshMaterialSurface()
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsBomdAction
  if (!action) return false
  if (action === 'save-detail') {
    saveDetail()
    return true
  }
  if (action === 'save-usage') {
    saveUsage()
    return true
  }
  if (action === 'submit-bom') {
    submitBom()
    return true
  }
  return false
}

export function getPmsBomDetailStateForTest(): { spu: string; confirmArmed: boolean } {
  return { spu: state.spu, confirmArmed: state.confirmArmed }
}
