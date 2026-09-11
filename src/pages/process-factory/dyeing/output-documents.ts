import { openDyeBarcodeDialog, handleDyeBarcodeEvent } from './barcode-dialog.ts'
import { escapeHtml as e } from '../../../utils.ts'
import { renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderCode128Barcode } from '../../../components/real-barcode.ts'
import { listDyeWorkOrderOnlineRows, type DyeWorkOrderOnlineRow } from '../../../data/fcs/dye-work-order-online-view.ts'
import { getDyeOutputRolls, listDyeDispatchDocuments, createDyeDispatchDocument, finishDyeDispatchDocument, getDyeDispatchAvailableQty, isDyeRollAvailable, type DyeDispatchDocument } from '../../../data/fcs/dyeing-task-domain.ts'

let mode: 'barcodes' | 'pending' | 'documents' = 'pending'
let orderId = '', docId = '', keyword = '', factory = '', receiver = '', status = ''
let page = 1
const pageSize = 15
const selected = new Set<string>()
const btn = (label: string, action: string, id = '') => renderSecondaryButton(label, { prefix: 'dye-output', action }).replace('<button', `<button data-id="${e(id)}"`)
const field = (name: string, label: string, value = '', type = 'text') => `<label class="text-xs">${e(label)}<input class="mt-1 block h-9 w-full rounded border px-2 text-sm" data-dye-output-field="${name}" type="${type}" value="${e(value)}"></label>`
const table = (headers: string[], rows: string[][]) => `<div class="overflow-auto"><table class="w-full text-left text-sm"><thead><tr>${headers.map(h => `<th class="whitespace-nowrap border-b bg-slate-50 p-2">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(cell => `<td class="border-b p-2 align-top">${cell}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${headers.length}" class="p-5 text-center">暂无记录</td></tr>`}</tbody></table></div>`
function pager(total: number) { return `<div class="mt-3 flex justify-between text-sm"><span>共 ${total} 条 · 每页 ${pageSize} 条 · 第 ${page} / ${Math.max(1, Math.ceil(total / pageSize))} 页</span><div>${page > 1 ? btn('上一页', 'prev') : ''}${page * pageSize < total ? btn('下一页', 'next') : ''}</div></div>` }
function slice<T>(rows: T[]) { page = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize))); return rows.slice((page - 1) * pageSize, page * pageSize) }
function rowInfo(id: string) { const row = listDyeWorkOrderOnlineRows().find(row => row.dyeOrderId === id); if (!row) throw new Error('未找到原加工单。'); return row }
function image(id: string) { const row = rowInfo(id); return `<div class="flex items-center gap-2">${row.productImageUrl ? `<button type="button" data-skip-page-rerender="true" data-pda-image-preview-url="${e(row.productImageUrl)}" data-pda-image-preview-title="${e(row.productName)}"><img class="h-10 w-10 object-contain" src="${e(row.productImageUrl)}" alt="${e(row.productName)}" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"><span class="text-xs">图片加载中</span></button>` : '<span>商品图待补齐</span>'}${e(row.productCode)}</div>` }
function outputImage(id: string) { const row = rowInfo(id); return row.outputImageUrl ? `<button type="button" data-skip-page-rerender="true" data-pda-image-preview-url="${e(row.outputImageUrl)}" data-pda-image-preview-title="${e(row.materialName)}"><img class="h-10 w-10 object-contain" src="${e(row.outputImageUrl)}" alt="${e(row.materialName)} ${e(row.targetColorName)}" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"><span>图片加载中</span></button>` : '产出图片待提供' }
function totals(doc: DyeDispatchDocument) {
  const units = new Map<string, number>()
  doc.lines.forEach(line => units.set(line.unit, (units.get(line.unit) || 0) + line.rolls.reduce((n, roll) => n + roll.qty, 0)))
  return `${doc.lines.reduce((n, line) => n + line.rolls.length, 0)} 卷 · ${[...units].map(([unit, qty]) => `${qty.toFixed(2)} ${e(unit)}`).join(' / ')} · ${new Set(doc.lines.map(line => line.sku)).size} SKU`
}
function detail(doc: DyeDispatchDocument) {
  return `<h2 class="text-lg font-semibold">${e(doc.id)}</h2><p class="my-3">${e(doc.status)} · ${totals(doc)}<br>建单：${e(doc.operator)} ${e(doc.createdAt)} · 交出：${e(doc.handedOverAt || '尚未交出')}</p>${table(['加工单 / 商品', '任务 / 接收方', 'SKU', '卷 / 缸号', '数量', '米数'], doc.lines.flatMap(line => line.rolls.map(roll => [e(line.orderNo) + image(line.orderId), `${e(line.taskNo)}<br>${e(line.receiver)}`, `${e(line.sku)}<br>${outputImage(line.orderId)}`, `${e(roll.barcode)}<br>${e(roll.vatNo || '未记录缸号')}`, `${roll.qty} ${e(line.unit)}`, line.unit.toLowerCase() === 'yard' ? (roll.qty * .9144).toFixed(2) : ['米', 'm', 'meter'].includes(line.unit.toLowerCase()) ? roll.qty.toFixed(2) : '不适用'])))}<p class="my-3 text-sm">卷明细 ${doc.lines.reduce((n, line) => n + line.rolls.length, 0)} 卷；尚未采集扫码进度。下游接收仍由接收方单独确认。</p>${btn('返回单据列表', 'documents')}${btn('打印预览', 'print-doc', doc.id)}${doc.status === '草稿' ? btn('确认交出', 'confirm', doc.id) + btn('作废草稿', 'void', doc.id) : ''}`
}
function filters() {
  const rows = listDyeWorkOrderOnlineRows()
  const select = (name: string, label: string, value: string, values: string[]) => `<label class="text-xs">${label}<select class="mt-1 block h-9 rounded border px-2" data-dye-output-field="${name}"><option value="">全部</option>${values.map(v => `<option ${value === v ? 'selected' : ''}>${e(v)}</option>`).join('')}</select></label>`
  return `<div class="mb-3 flex flex-wrap items-end gap-2">${field('keyword', '单据 / 加工单 / 任务 / SKU', keyword)}${select('factory', '工厂', factory, [...new Set(rows.map(r => r.factoryName))])}${select('receiver', '接收方', receiver, [...new Set(rows.map(r => r.receiverName))])}${select('status', '状态', status, mode === 'pending' ? ['可创建', '待维护'] : ['草稿', '已交出', '已作废'])}${btn('查询', 'search')}${btn('重置', 'reset')}</div>`
}
function body(): string {
  if (docId) { const doc = listDyeDispatchDocuments().find(doc => doc.id === docId); return doc ? detail(doc) : '单据不存在' }
  if (mode === 'documents') {
    const docs = listDyeDispatchDocuments().filter(doc => (!status || doc.status === status) && doc.lines.some(line => (!factory || line.factoryName === factory) && (!receiver || line.receiver === receiver)) && (!keyword || `${doc.id} ${doc.lines.map(line => `${line.orderNo} ${line.taskNo} ${line.sku}`).join(' ')}`.toLowerCase().includes(keyword.toLowerCase())))
    const history = listDyeWorkOrderOnlineRows().filter(row => row.handoverRecords.length && (!factory || row.factoryName === factory) && (!receiver || row.receiverName === receiver) && (!keyword || `${row.handoverOrderNo} ${row.workOrderNo} ${row.taskNo}`.toLowerCase().includes(keyword.toLowerCase())))
    const historyHtml = `<details class="mt-4 border-t pt-3"><summary class="cursor-pointer text-blue-700">原交接记录（${history.length} 张加工单；包含原渠道提交的记录）</summary>${table(['加工单', '交出单', '交出数量', '下游接收数量', '追溯'], history.map(row => [e(row.workOrderNo), e(row.handoverOrderNo || '未记录'), `${row.handedOverQty} ${e(row.qtyUnit)}`, `${row.downstreamReceivedQty} ${e(row.qtyUnit)}`, `<a class="text-blue-700" href="/fcs/craft/dyeing/work-orders?dyeOrderId=${encodeURIComponent(row.dyeOrderId)}">查看原交接记录</a>`]))}</details>`
    return filters() + table(['交出单', '加工单 / 接收方', '数量', '状态 / 时间', '操作'], slice(docs).map(doc => [e(doc.id), doc.lines.map(line => `${e(line.orderNo)} → ${e(line.receiver)}`).join('<br>'), totals(doc), `${e(doc.status)}<br>${e(doc.handedOverAt || '-')}`, btn('详情', 'detail', doc.id) + btn('打印预览', 'print-doc', doc.id)])) + pager(docs.length) + historyHtml
  }
  const rows = listDyeWorkOrderOnlineRows().filter(row => (!factory || row.factoryName === factory) && (!receiver || row.receiverName === receiver) && (!keyword || `${row.workOrderNo} ${row.taskNo} ${row.colorSku} ${row.productionOrderNo}`.toLowerCase().includes(keyword.toLowerCase()))).filter(row => { const available = getDyeOutputRolls(row.dyeOrderId).some(roll => isDyeRollAvailable(row.dyeOrderId, roll)); return !status || (status === '可创建' ? available : !available) })
  return `<a class="text-blue-700 inline-block mb-3" href="/fcs/craft/dyeing/pending-receipts?view=deliveries">组织送货单 / 查看下游接收</a><a class="text-blue-700 inline-block ml-4" href="/fcs/craft/dyeing/yarn-shipments">纱线整单交出</a>` + filters() + `<div class="mb-3 flex flex-wrap items-end gap-2">${field('operator', '建单 / 交出操作人')}${btn('批量生成交出单', 'create')}<select class="h-9 rounded border" data-dye-output-field="merge"><option value="">选择已有草稿</option>${listDyeDispatchDocuments().filter(doc => doc.status === '草稿').map(doc => `<option value="${e(doc.id)}">${e(doc.id)}</option>`).join('')}</select>${btn('合入已有交出单', 'merge')}</div>` + table(['加工单 / 商品', '任务 / 接收方', '使用 / 完成 / 可交', '产出卷', '操作'], slice(rows).map(row => [e(row.workOrderNo) + image(row.dyeOrderId), `${e(row.taskNo)}<br>${e(row.receiverName)}`, `${row.rawMaterialQty} / ${row.completedQty} / ${getDyeDispatchAvailableQty(row.dyeOrderId)} ${e(row.qtyUnit)}`, getDyeOutputRolls(row.dyeOrderId).map(roll => `<label class="block"><input type="checkbox" data-dye-output-select value="${e(row.dyeOrderId + '|' + roll.id)}" ${isDyeRollAvailable(row.dyeOrderId, roll) ? '' : 'disabled'} ${selected.has(row.dyeOrderId + '|' + roll.id) ? 'checked' : ''}> ${e(roll.rollNo)} · ${roll.qty} ${e(row.qtyUnit)}</label>`).join('') || (row.isYarn?'纱线按整单条码交出':'条码待维护'), btn('维护条码', 'barcodes', row.dyeOrderId)])) + pager(rows.length)
}
function refresh() { const target = document.querySelector('[data-dye-output-body]'); if (target) target.innerHTML = body() }
function value(name: string) { return (document.querySelector(`[data-dye-output-field="${name}"]`) as HTMLInputElement)?.value || '' }
function printPreview(html: string, title: string) {
  const target = document.querySelector('[data-dye-output-body]')!
  target.innerHTML = `${btn('返回', 'back')}${btn('打印', 'print-frame')}<iframe title="${e(title)}" class="mt-3 h-[60vh] w-full border" data-dye-output-print></iframe>`
  const frame = target.querySelector('iframe')!
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${e(title)}</title><style>@page{size:A4;margin:12mm}body{font:12px Arial;color:#111}table{width:100%;border-collapse:collapse}td,th{padding:7px;border:1px solid #aaa}tr,section{break-inside:avoid}svg{height:55px;width:280px}section{padding:20px;border:1px solid #aaa;margin-bottom:15px}h1{font-size:24px}</style></head><body>${html}</body></html>`
}
export function openDyeOutput(next: typeof mode, id = '', snapshot?: DyeWorkOrderOnlineRow) {
  if (next === 'barcodes') { openDyeBarcodeDialog(id, snapshot); return }
  mode = next; orderId = id; docId = ''; keyword = ''; status = ''; factory = ''; receiver = ''; page = 1; selected.clear()
  document.querySelector('[data-dye-output-root]')?.remove()
  const root = document.createElement('div'); root.dataset.dyeOutputRoot = 'true'; root.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4'; root.tabIndex = -1
  root.innerHTML = `<section role="dialog" aria-modal="true" aria-label="染色条码及交出管理" class="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"><header class="flex flex-wrap justify-between gap-2 border-b p-3"><div>${btn('待交出列表', 'pending')}${btn('交出单据', 'documents')}</div>${btn('关闭', 'close')}</header><p role="alert" class="px-4 text-red-700" data-dye-output-error></p><main class="overflow-auto p-4" data-dye-output-body>${body()}</main></section>`
  root.addEventListener('click', event => { if (event.target === root) root.remove() }); root.addEventListener('keydown', event => { if (event.key === 'Escape') root.remove() })
  document.querySelector('[data-dye-work-orders-root]')?.appendChild(root); root.focus()
}
export function handleDyeOutputEvent(target: HTMLElement): boolean {
  if (handleDyeBarcodeEvent(target)) return true
  if (target.matches('[data-dye-output-select]')) { const input = target as HTMLInputElement; input.checked ? selected.add(input.value) : selected.delete(input.value); const count = document.querySelector('[data-dye-output-count]'); if (count) count.textContent = `已选 ${selected.size}`; return true }
  if (target.closest('[data-dye-output-field]')) return true
  const node = target.closest<HTMLElement>('[data-dye-output-action]'); if (!node) return false
  const action = node.dataset.dyeOutputAction, id = node.dataset.id || ''
  const error = document.querySelector('[data-dye-output-error]'); if (error) error.textContent = ''
  try {
    if (action === 'close') { document.querySelector('[data-dye-output-root]')?.remove(); return true }
    if (action === 'pending' || action === 'documents' || action === 'barcodes') { openDyeOutput(action, id); return true }
    if (action === 'detail') docId = id
    else if (action === 'back') { refresh(); return true }
    else if (action === 'search') { keyword = value('keyword'); factory = value('factory'); receiver = value('receiver'); status = value('status'); page = 1; selected.clear() }
    else if (action === 'reset') { keyword = ''; factory = ''; receiver = ''; status = ''; page = 1; selected.clear() }
    else if (action === 'next') page++
    else if (action === 'prev') page--
    else if (action === 'select-page') { document.querySelectorAll<HTMLInputElement>('[data-dye-output-select]:not(:disabled)').forEach(input => { input.checked = true; selected.add(input.value) }) }
    else if (action === 'print-frame') { (document.querySelector('[data-dye-output-print]') as HTMLIFrameElement)?.contentWindow?.print(); return true }
    else if (action === 'create' || action === 'merge') { const selections = new Map<string, string[]>(); selected.forEach(key => { const [order, roll] = key.split('|'); selections.set(order, [...(selections.get(order) || []), roll]) }); const merge = value('merge'); if (action === 'merge' && !merge) throw new Error('请选择已有草稿。'); const doc = createDyeDispatchDocument([...selections].map(([orderId, rollIds]) => ({ orderId, rollIds })), value('operator'), action === 'merge' ? merge : undefined); docId = doc.id; selected.clear() }
    else if (action === 'confirm' || action === 'void') { if (!confirm(action === 'confirm' ? '确认实物已按单据交出？下游仍需单独确认接收。' : '确认作废草稿并释放所选卷？')) return true; finishDyeDispatchDocument(id, action) }
    else if (action === 'print-doc') { const doc = listDyeDispatchDocuments().find(doc => doc.id === id)!; printPreview(`<h1>SURAT JALAN</h1><h2>${e(doc.id)}</h2>${renderCode128Barcode(doc.id, '交出单条码')}<p>${e(doc.status)} · ${e(doc.createdAt)} · ${totals(doc)}</p><p>JENIS KENDARAAN __________　DRIVER __________　NO. POLISI __________</p>${table(['加工单', '任务单', '接收方', 'SKU', '数量', 'METER', 'ROLL'], doc.lines.map(line => [e(line.orderNo), e(line.taskNo), e(line.receiver), e(line.sku), `${line.rolls.reduce((n, roll) => n + roll.qty, 0).toFixed(2)} ${e(line.unit)}`, ['yard','米','m','meter'].includes(line.unit.toLowerCase()) ? (line.rolls.reduce((n, roll) => n + roll.qty, 0) * (line.unit.toLowerCase() === 'yard' ? .9144 : 1)).toFixed(2) : '—', String(line.rolls.length)]))}<p>Catatan Pengiriman ____________________________________</p><p>Tanda Tangan yang Terima __________　Mengetahui __________　Hormat Kami __________</p>${doc.status === '草稿' ? '<h2>草稿：尚未交出</h2>' : ''}`, doc.id); return true }
    refresh()
  } catch (err) { if (error) error.textContent = err instanceof Error ? err.message : String(err) }
  return true
}
