import { renderDialog } from '../../components/ui/dialog.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { hydrateIcons } from '../../components/shell.ts'
import { state, escapeHtml, isTechPackModuleReadOnly, markProcessRouteUnconfirmed, syncTechPackToStore } from './context.ts'
import { renderProcessTab } from './process-domain.ts'
import { getMaterialSkuRecordById } from '../../data/pcs-material-archive-repository.ts'
import { cloneWebbingSpecifications, type WebbingSpecification, type WebbingEndRequirement } from '../../data/fcs/webbing-specifications.ts'
import { applyWebbingRouteSpecifications } from './webbing-route-editor.ts'

const MODAL_ID = 'tmf-webbing-specification-dialog'

export function openWebbingSpecificationDialog(bomId: string): void {
  if (isTechPackModuleReadOnly('PROCESS') || document.getElementById(MODAL_ID)) return
  const bom = state.bomItems.find((item) => item.id === bomId && item.type === '辅料')
  if (!bom) return
  const packAtOpen = state.techPack
  const cut = state.techniques.find((item) => item.processCode === 'WEBBING_CUT' && item.linkedBomItemIds?.includes(bomId))
  const rows = cloneWebbingSpecifications(cut?.webbingSpecifications) ?? []
  const blank = (): WebbingSpecification => ({ id: `TMF-SPEC:${crypto.randomUUID()}`, bomItemId: bomId, usage: '', garmentSize: '', piecesPerGarment: 1,
    cutLengthMm: 0, finishedLengthMm: 0, lengthBasis: 'EXCLUDING_ENDS', toleranceMm: 0, measurementCondition: '', cuttingMethod: '', acceptanceRequirement: '',
    tippingRequired: null, endA: { method: 'NONE', specification: '' }, endB: { method: 'NONE', specification: '' } })
  if (!rows.length) rows.push(blank())
  let selected = 0
  let predecessorId = cut?.predecessorEntryIds?.[0] ?? ''
  let confirmedObject = Boolean(cut)
  const host = document.createElement('div')
  host.id = MODAL_ID
  host.className = 'fixed inset-0 z-[70]'
  const controller = new AbortController()
  const close = () => { controller.abort(); host.remove() }
  const field = (name: string, label: string, value: string | number, type = 'text') => `<label class="block text-xs text-slate-600">${label}<input class="mt-1 w-full rounded border px-2 py-1.5 text-sm" name="${name}" type="${type}" value="${escapeHtml(String(value))}" ${type === 'number' ? 'min="0" step="1"' : ''}></label>`
  const select = (name: string, label: string, value: string, options: Array<[string, string]>) => `<label class="block text-xs text-slate-600">${label}<select class="mt-1 w-full rounded border px-2 py-1.5 text-sm" name="${name}">${options.map(([key, title]) => `<option value="${escapeHtml(key)}" ${key === value ? 'selected' : ''}>${escapeHtml(title)}</option>`).join('')}</select></label>`
  const renderEnd = (key: 'endA' | 'endB', end: WebbingEndRequirement) => `<fieldset class="rounded border p-3"><legend class="px-1 text-sm font-medium">${key === 'endA' ? 'A 端' : 'B 端'}</legend><div class="grid grid-cols-2 gap-3">
    ${select(`${key}.method`, '端头方式', end.method, [['NONE', '不打头'], ['PLASTIC_WRAP', '塑料包头'], ['METAL', '金属头'], ['SILICONE_DIP', '硅胶浸头']])}
    ${field(`${key}.specification`, '具体型号、尺寸、颜色', end.specification)}
    ${select(`${key}.materialBomItemId`, '端头辅材 BOM', end.materialBomItemId ?? '', [['', '请选择'], ...state.bomItems.filter((item) => item.type === '辅料' && item.id !== bomId).map((item): [string, string] => [item.id, `${item.materialCode} ${item.materialName}`])])}
    ${select(`${key}.materialUnit`, '辅材计量单位', end.materialUnit ?? '', [['', '请选择'], ['个', '个（塑料/金属）'], ['kg', 'kg（浸头）'], ['g', 'g（浸头）']])}
    ${field(`${key}.coverageMm`, '浸头覆盖长度（mm）', end.coverageMm ?? '', 'number')}
    ${field(`${key}.imageUrl`, '对应端头参考图地址', end.imageUrl ?? '')}
  </div></fieldset>`
  const draw = () => {
    const row = rows[selected]
    const sku = getMaterialSkuRecordById(bom.materialSkuId ?? '')
    const choices = state.techniques.filter((item) => item.stageCode === 'PREP' && item.linkedBomItemIds?.includes(bomId) && !['WEBBING_CUT', 'WEBBING_TIP'].includes(item.processCode))
    const image = sku?.skuImageUrl ? `<button type="button" data-tech-action="open-material-image-preview" data-image-url="${escapeHtml(sku.skuImageUrl)}" data-image-label="${escapeHtml(bom.materialName)}"><img src="${escapeHtml(sku.skuImageUrl)}" alt="${escapeHtml(bom.materialName)}" class="h-12 w-12 rounded border object-cover"></button>` : '<span class="text-xs text-amber-700">缺少对应实物图</span>'
    const content = `<div class="flex items-center gap-3 mb-3">${image}<div><div class="font-medium">${escapeHtml(bom.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(sku?.materialSkuCode ?? bom.materialCode)}</div></div></div>
      <form class="max-h-[62vh] overflow-y-auto pr-1 space-y-4" data-webbing-form>
      <label class="flex gap-2 text-xs"><input name="confirmedObject" type="checkbox" ${confirmedObject ? 'checked' : ''}>确认此物料为本业务的织带或绳子，橡筋定长切割请使用原独立工艺。</label>
      ${select('predecessorId', '截断的直接前序', predecessorId, [['', '直接使用 BOM 半成品'], ...choices.map((item): [string, string] => [item.id, `${item.process} · ${item.outputMaterialSkuCode || '产出 SKU 待确认'}`])])}
      <div class="flex gap-2 items-end">${select('selectedRow', '加工规格', String(selected), rows.map((item, index) => [String(index), `${index + 1}. ${item.usage || '未填用途'} / ${item.garmentSize || '未填尺码'}`]))}
      ${renderSecondaryButton('新增规格', { prefix: 'webbing', action: 'add', skipPageRerender: true })}${renderSecondaryButton('删除本行', { prefix: 'webbing', action: 'remove', skipPageRerender: true })}</div>
      <div class="grid grid-cols-2 gap-3">
      ${field('usage', '用途 / 部位', row.usage)}${field('garmentSize', '成衣尺码', row.garmentSize)}
      ${field('piecesPerGarment', '每件条 / 根数', row.piecesPerGarment, 'number')}${field('cutLengthMm', '下料长度（mm）', row.cutLengthMm || '', 'number')}
      ${field('finishedLengthMm', '成品长度（mm）', row.finishedLengthMm || '', 'number')}${field('toleranceMm', '长度公差（±mm）', row.toleranceMm, 'number')}
      ${select('lengthBasis', '成品长度口径', row.lengthBasis, [['EXCLUDING_ENDS', '不含端头'], ['INCLUDING_ENDS', '含端头']])}
      ${select('tippingRequired', '是否需要打头', row.tippingRequired === null ? '' : String(row.tippingRequired), [['', '必须明确选择'], ['false', '不需要'], ['true', '需要']])}
      ${field('measurementCondition', '测量条件', row.measurementCondition)}${field('cuttingMethod', '截断方式 / 切口要求', row.cuttingMethod)}
      </div>${field('acceptanceRequirement', '验收要求', row.acceptanceRequirement)}
      ${renderEnd('endA', row.endA)}${renderEnd('endB', row.endB)}
      </form><p class="mt-2 text-sm text-red-700" role="alert" data-webbing-error></p>`
    host.innerHTML = renderDialog({ title: '织带 / 绳子加工规格', description: '长度与端头保存为工艺要求，不新建半成品 SKU。', width: 'lg', closeAction: { prefix: 'webbing', action: 'close', skipPageRerender: true } }, content,
      renderSecondaryButton('取消', { prefix: 'webbing', action: 'close', skipPageRerender: true }) + renderPrimaryButton('保存加工规格', { prefix: 'webbing', action: 'save', skipPageRerender: true }))
    host.setAttribute('role', 'dialog')
    host.setAttribute('aria-modal', 'true')
    host.setAttribute('aria-label', '织带 / 绳子加工规格')
    host.querySelector('button[data-webbing-action="close"]')?.setAttribute('aria-label', '关闭加工规格')
    hydrateIcons(host)
  }
  const read = () => {
    const form = host.querySelector<HTMLFormElement>('[data-webbing-form]')!
    const values = new FormData(form)
    const str = (name: string) => String(values.get(name) ?? '').trim()
    const num = (name: string) => str(name) ? Number(str(name)) : NaN
    const row = rows[selected]
    for (const key of ['usage', 'garmentSize', 'measurementCondition', 'cuttingMethod', 'acceptanceRequirement'] as const) row[key] = str(key)
    for (const key of ['piecesPerGarment', 'cutLengthMm', 'finishedLengthMm', 'toleranceMm'] as const) row[key] = num(key)
    row.lengthBasis = str('lengthBasis') as WebbingSpecification['lengthBasis']
    row.tippingRequired = str('tippingRequired') === '' ? null : str('tippingRequired') === 'true'
    for (const key of ['endA', 'endB'] as const) {
      const method = str(`${key}.method`) as WebbingEndRequirement['method']
      row[key] = { method, specification: str(`${key}.specification`),
        materialBomItemId: str(`${key}.materialBomItemId`) || undefined, materialUnit: (str(`${key}.materialUnit`) || undefined) as WebbingEndRequirement['materialUnit'],
        coverageMm: str(`${key}.coverageMm`) ? num(`${key}.coverageMm`) : undefined, imageUrl: str(`${key}.imageUrl`) || undefined }
    }
    predecessorId = str('predecessorId')
    confirmedObject = values.has('confirmedObject')
  }
  host.addEventListener('change', (event) => {
    const target = event.target as HTMLSelectElement
    if (target.name === 'selectedRow') { read(); selected = Number(target.value); draw() }
  }, { signal: controller.signal })
  host.addEventListener('submit', (event) => event.preventDefault(), { signal: controller.signal })
  host.addEventListener('error', (event) => {
    if (!(event.target instanceof HTMLImageElement)) return
    const message = document.createElement('span')
    message.className = 'text-xs text-amber-700'
    message.textContent = '物料图片加载失败，请核对图片地址'
    event.target.replaceWith(message)
  }, { capture: true, signal: controller.signal })
  host.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-webbing-action]')?.dataset.webbingAction
    if (!action) return
    event.stopPropagation()
    if (action === 'close') return close()
    try {
      read()
      if (action === 'add') { rows.push(blank()); selected = rows.length - 1; draw(); return }
      if (action === 'remove') { if (rows.length === 1) throw new Error('至少保留一条加工规格。'); rows.splice(selected, 1); selected = 0; draw(); return }
      if (action === 'save') {
        if (isTechPackModuleReadOnly('PROCESS') || state.techPack !== packAtOpen) throw new Error('技术包状态或版本已变化，请关闭后重新进入。')
        if (!confirmedObject) throw new Error('请确认物料属于本次织带 / 绳子业务。')
        for (const row of rows) for (const end of [row.endA, row.endB]) {
          if (end.method !== 'NONE' && !state.bomItems.some((item) => item.id === end.materialBomItemId && item.type === '辅料' && item.id !== bomId)) throw new Error('端头必须选择当前技术包中有效的独立辅材 BOM。')
        }
        const next = applyWebbingRouteSpecifications(state.techniques, bom, rows, predecessorId)
        const previous = state.techniques
        state.techniques = next
        markProcessRouteUnconfirmed()
        if (!syncTechPackToStore()) { state.techniques = previous; throw new Error('加工规格未保存，请检查技术包状态后重试。') }
        const panel = document.querySelector<HTMLElement>('[data-testid="tech-pack-process-tab"]')
        if (panel) {
          panel.outerHTML = renderProcessTab()
          const updatedPanel = document.querySelector<HTMLElement>('[data-testid="tech-pack-process-tab"]')
          if (updatedPanel) hydrateIcons(updatedPanel)
        }
        close()
      }
    } catch (error) { host.querySelector('[data-webbing-error]')!.textContent = error instanceof Error ? error.message : '保存失败，请核对加工规格。' }
  }, { signal: controller.signal })
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); close() } }, { capture: true, signal: controller.signal })
  draw()
  document.body.append(host)
}
