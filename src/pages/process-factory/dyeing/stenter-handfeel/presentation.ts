import { escapeHtml as e } from '../../../../utils.ts'
import { renderCode128Barcode } from '../../../../components/real-barcode.ts'
import { HAND_FEEL_ENGLISH, factoryQcRequirementText, handfeelStatus, qcIdForSource, getFactoryQcOrder, type FactoryQcAction, type StenterHandfeelOrder, type StenterHandfeelRoll } from '../../../../data/fcs/stenter-handfeel.ts'

export const STENTER_ROUTE = '/fcs/craft/dyeing/stenter-handfeel/work-orders'
export const STENTER_PDA_ROUTE = '/fcs/pda/stenter-handfeel'
export const stenterLink = (label: string, href: string) => `<a class="text-blue-700 hover:underline" href="${e(href)}" data-nav="${e(href)}">${e(label)}</a>`
export const stenterButton = (label: string, action: string, attrs = '', primary = false) => `<button type="button" class="min-h-11 rounded-md border px-3 py-2 text-sm ${primary ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white text-slate-800'}" data-stenter-handfeel-action="${action}" data-skip-page-rerender="true" ${attrs}>${e(label)}</button>`
export const stenterQuantity = (value: number | undefined, unit: string) => value === undefined ? '—' : `${Number(value.toFixed(4))} ${unit}`
export const stenterTime = (value?: string) => !value ? '尚未发生' : Number.isNaN(Date.parse(value)) ? value : new Date(value).toLocaleString('zh-CN', { hour12: false })
export const stenterSourceLabel = (order: StenterHandfeelOrder) => order.source.kind === 'PRINTING' ? '印花加工单' : '染色加工单'
export function stenterSourceLink(order: StenterHandfeelOrder): string {
  const route = order.source.kind === 'PRINTING' ? '/fcs/craft/printing/work-orders/' : '/fcs/craft/dyeing/work-orders/'
  return stenterLink(order.source.no, route + encodeURIComponent(order.source.id))
}
export function stenterImage(url: string, name: string, size = 'h-16 w-16'): string {
  if (!url) return '<p class="text-sm text-amber-800">对应面料图片待补充</p>'
  return `<button type="button" class="relative ${size} shrink-0 overflow-hidden rounded border bg-white" data-stenter-handfeel-action="image" data-image-url="${e(url)}" data-image-title="${e(name)}" data-skip-page-rerender="true" aria-label="查看${e(name)}大图"><img src="${e(url)}" alt="${e(name)}" class="h-full w-full object-contain" data-stenter-image><span class="absolute inset-x-0 bottom-0 bg-white/95 text-xs" data-stenter-image-status>图片加载中</span></button>`
}
export function installStenterImages(): void {
  setTimeout(() => {
    document.querySelectorAll<HTMLImageElement>('[data-stenter-image]').forEach(img => {
      img.onload = () => updateImageStatus(img); img.onerror = () => updateImageStatus(img)
      if (img.complete) updateImageStatus(img)
    })
  }, 0)
}
function updateImageStatus(img: HTMLImageElement): void {
  const status = img.parentElement?.querySelector('[data-stenter-image-status]')
  if (status) status.textContent = img.naturalWidth > 0 ? '' : '图片加载失败'
}
if (typeof document !== 'undefined') for (const type of ['load', 'error']) document.addEventListener(type, event => { if (event.target instanceof HTMLImageElement && event.target.matches('[data-stenter-image]')) updateImageStatus(event.target) }, true)
const field = (label: string, html: string) => `<div class="min-w-0"><dt class="text-xs text-slate-500">${e(label)}</dt><dd class="mt-1 break-words text-sm">${html}</dd></div>`
export function renderStenterSummary(order: StenterHandfeelOrder): string {
  const units = [...new Set(order.rolls.map(roll => roll.unit))]
  const totals = units.map(unit => stenterQuantity(order.rolls.filter(roll => roll.unit === unit).reduce((sum, roll) => sum + roll.inputQty, 0), unit)).join(' / ')
  return `<section class="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-white p-4"><div class="flex min-w-0 gap-3">${stenterImage(order.source.imageUrl, order.source.materialName)}<div class="min-w-0"><h2 class="break-words font-semibold">${e(order.source.materialName)}</h2><p class="break-all text-sm text-slate-500">${e(order.source.materialSku)}</p><p class="mt-1 text-sm font-medium text-blue-800">${e(order.handFeel ? order.handFeel + ' · ' + HAND_FEEL_ENGLISH[order.handFeel] : '目标手感待补充')}</p></div></div><div class="text-sm"><p>${e(order.source.factoryName)} → <strong>GTG</strong> → ${e(order.source.target.name || '实际接收方待核对')}</p><p class="mt-2">${e(handfeelStatus(order))} · ${order.rolls.length} 卷${totals ? ' · ' + e(totals) : ''}</p></div></section>`
}
export function renderStenterBase(order: StenterHandfeelOrder, pda: boolean, canEditTarget = true): string {
  const qcRoute = order.source.kind === 'PRINTING' ? '/fcs/craft/printing/qc-orders/' : '/fcs/craft/dyeing/qc-orders/'
  const resultQc = getFactoryQcOrder(qcIdForSource({ kind: 'STENTER_HAND_FEEL', id: order.id })), properties = order.source.materialProperties
  return `<section class="space-y-4 rounded-lg border bg-white p-4"><h2 class="font-semibold">来源与加工要求</h2><dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${field('来源加工单', stenterSourceLink(order))}${field('来源类型', e(stenterSourceLabel(order)))}${field('来源QC单', stenterLink('查看来源QC', qcRoute + encodeURIComponent(order.qcId)))}${resultQc ? field('本单染厂QC', stenterLink(resultQc.no, '/fcs/craft/dyeing/qc-orders/' + encodeURIComponent(resultQc.id))) : ''}${field('承接厂', 'GTG')}${field('目标要求', e(order.handFeel || '待补充'))}${field('来源要求', e(factoryQcRequirementText(order.source.requirementVersion)))}${properties?.composition ? field('成分', e(properties.composition)) : ''}${properties?.widthCm ? field('幅宽', e(String(properties.widthCm)) + ' cm') : ''}${properties?.gsm ? field('克重', e(String(properties.gsm)) + ' g/㎡') : ''}${order.source.sourceNo ? field('原始来源单', e(order.source.sourceNo)) : ''}${order.source.taskId ? field('来源任务', e(order.source.taskId)) : ''}${order.source.productionOrderId ? field('生产单', e(order.source.productionOrderId)) : ''}${field('创建人员 / 时间', e(order.createdBy) + ' · ' + e(stenterTime(order.createdAt)))}${field('下游接收方', e(order.source.target.kind === 'UNKNOWN' ? '待核对' : order.source.target.name))}</dl><p class="text-sm text-slate-500">加工由来源QC的整单手感决定创建。实际触摸结果在来源QC逐卷记录。</p>${!canEditTarget || order.handFeel || order.rolls.some(roll => roll.startedAt) || order.completedAt ? '' : stenterButton('补充目标手感', 'target', '', true)}${pda ? '' : `<div class="flex items-start gap-3 border-t pt-4">${stenterImage(order.source.referenceImageUrl || order.source.imageUrl, order.source.materialName + '参考图')}<p class="text-sm">面料要求参考图 · ${e(order.source.requiredMaterialSku || order.source.materialSku)}</p></div>`}</section>`
}
export function stenterRollStage(roll: StenterHandfeelRoll): string {
  return roll.downstreamReceivedAt ? '下游已实收' : roll.handedOutAt ? '待下游实收' : roll.completedAt ? '已产出待交出' : roll.startedAt ? '加工中' : roll.receivedAt ? 'GTG已实收' : roll.sentAt ? '待GTG实收' : '待来源交出'
}
export function renderStenterRollCards(order: StenterHandfeelOrder, offset = 0, count = 20): string {
  return order.rolls.slice(offset, offset + count).map(roll => `<article class="space-y-3 rounded border p-3"><div class="flex flex-wrap justify-between gap-2"><strong class="break-all text-sm">${e(roll.outputBarcode || roll.barcode)}</strong><span class="text-sm text-blue-800">${e(stenterRollStage(roll))}</span></div>${roll.outputBarcode ? `<p class="break-all text-xs text-slate-500">来源卷码 ${e(roll.barcode)}</p>` : ''}<dl class="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">${field(order.source.factoryId === order.factoryId ? '内部转入GTG' : '来源交出', e(roll.sentAt ? stenterQuantity(roll.inputQty, roll.unit) + ' · ' + stenterTime(roll.sentAt) : '尚未发生'))}${field('GTG实际接收', e(roll.receivedAt ? stenterQuantity(roll.receivedQty, roll.unit) + ' · ' + stenterTime(roll.receivedAt) : '尚未发生'))}${field('实际库位', e(roll.locationId || '尚未接收'))}${field('投入加工', e(stenterTime(roll.startedAt)))}${field('实际产出', e(roll.completedAt ? stenterQuantity(roll.outputQty, roll.unit) + ' · ' + stenterTime(roll.completedAt) : '尚未发生'))}${field('GTG交出', e(roll.handedOutAt ? stenterQuantity(roll.outputQty, roll.unit) + ' · ' + stenterTime(roll.handedOutAt) : '尚未发生'))}${field('下游实际接收', e(roll.downstreamReceivedAt ? stenterQuantity(roll.downstreamQty, roll.unit) + ' · ' + stenterTime(roll.downstreamReceivedAt) : '尚未发生'))}</dl></article>`).join('')
}
export function renderStenterRolls(order: StenterHandfeelOrder): string {
  return `<section class="space-y-3 rounded-lg border bg-white p-4"><h2 class="font-semibold">卷明细与实物交接 · ${order.rolls.length} 卷</h2><div class="space-y-3" data-stenter-roll-cards>${renderStenterRollCards(order) || '<p class="text-sm text-amber-800">待来源补入已确认的实物卷。</p>'}</div><p class="text-xs text-slate-500" aria-live="polite" data-stenter-roll-count>已显示 ${Math.min(20, order.rolls.length)} / ${order.rolls.length} 卷</p>${order.rolls.length > 20 ? stenterButton('显示更多卷', 'more-rolls', `data-stenter-roll-offset="20" data-stenter-order-id="${e(order.id)}"`) : ''}</section>`
}
const actionNames: Record<string, string> = { TARGET: '补充目标手感', SEND: '来源交出 / 内部转入', RECEIVE: 'GTG实际接收', START: '投入加工', OUTPUT: '登记实际产出', HANDOUT: 'GTG交出', DOWNSTREAM_RECEIVE: '下游实际接收', COMPLETE: '人工完单', CONTINUE: '继续处理新增卷', PRINT: '生成打印预览' }
export const stenterActionName = (kind: string) => actionNames[kind] || kind
export function renderStenterLogs(actions: FactoryQcAction[]): string {
  return `<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">操作日志</h2><ol class="mt-3 divide-y">${[...actions].reverse().map(action => `<li class="py-3"><p class="text-sm font-medium">${e(stenterActionName(action.kind))}</p><p class="mt-1 text-xs text-slate-500">${e(action.by)} · ${e(stenterTime(action.at))}</p>${action.note ? `<p class="mt-1 break-words text-sm">${e(action.note)}</p>` : ''}</li>`).join('') || '<li class="text-sm text-slate-500">暂无操作记录</li>'}</ol></section>`
}
function barcode(code: string): string {
  try { return renderCode128Barcode(code, '实际卷码 ' + code) } catch { return `<p class="text-sm">卷码 ${e(code)}（按文字核对）</p>` }
}
export function renderStenterPrint(order: StenterHandfeelOrder, labels: boolean): string {
  if (labels) return `<article data-stenter-print-document><h2>定型机手感单卷标 · ${e(order.no)}</h2>${order.rolls.filter(roll => !!roll.outputBarcode).map(roll => `<section class="stenter-label"><img src="${e(order.source.imageUrl)}" alt="${e(order.source.materialName)}"><h3>${e(order.source.materialName)}</h3><p>${e(order.source.materialSku)} · ${e(order.handFeel || '目标待补充')}</p>${barcode(roll.outputBarcode!)}<p>${e(roll.outputBarcode!)} · ${e(stenterQuantity(roll.outputQty, roll.unit))}</p><p>GTG → ${e(order.source.target.name || '接收方待核对')}</p></section>`).join('') || '<p>尚无实际产出卷码，无法打印产出卷标。</p>'}</article>`
  return `<article data-stenter-print-document><h2>定型机手感单 · ${e(order.no)}</h2><div class="stenter-print-summary"><img src="${e(order.source.imageUrl)}" alt="${e(order.source.materialName)}"><div><p>${e(order.source.materialName)} · ${e(order.source.materialSku)}</p><p>${e(order.source.factoryName)} / ${e(order.source.no)} → GTG → ${e(order.source.target.name || '接收方待核对')}</p><p>目标：${e(order.handFeel || '待补充')} · ${e(factoryQcRequirementText(order.source.requirementVersion))}</p></div></div><table><thead><tr><th>来源卷码 / 产出卷码</th><th>来源数量</th><th>GTG实收</th><th>实际产出</th><th>下游实收</th></tr></thead><tbody>${order.rolls.map(roll => `<tr><td>${e(roll.barcode)}${roll.outputBarcode ? '<br>' + e(roll.outputBarcode) : ''}</td><td>${e(stenterQuantity(roll.inputQty, roll.unit))}</td><td>${e(stenterQuantity(roll.receivedQty, roll.unit))}</td><td>${e(stenterQuantity(roll.outputQty, roll.unit))}</td><td>${e(stenterQuantity(roll.downstreamQty, roll.unit))}</td></tr>`).join('')}</tbody></table><p>创建 ${e(stenterTime(order.createdAt))} · 当前 ${e(handfeelStatus(order))}</p></article>`
}
