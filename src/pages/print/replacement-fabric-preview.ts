import { cuttingRecordUuid } from '../../data/fcs/cutting/cutting-record-identity.ts'
import { escapeHtml as e } from '../../utils.ts'
import { appStore } from '../../state/store.ts'
import { loadReplacementFabricState, saveReplacementFabricPrint } from '../../data/fcs/cutting/replacement-fabric-repository.ts'
import { listReplacementFabricOrderRows } from '../../data/fcs/cutting/replacement-fabric-source.ts'
import { assertReplacementTicketCurrent, type ReplacementFabricTicket } from '../../data/fcs/cutting/replacement-fabric-fei-tickets.ts'
import { buildReplacementFabricPrintDocument as buildPrintDocument, renderReplacementFabricPrintDocument as renderPrintDocument } from './templates/replacement-fabric-label-template.ts'
let currentTickets: ReplacementFabricTicket[] = []
let commandId = ''; let printingRequested = false; let saving = false
export async function renderReplacementFabricPrintPreview(): Promise<string> {
  try {
    const params = new URLSearchParams(appStore.getState().pathname.split('?')[1] || '')
    const values: unknown = params.has('ticketIds') ? JSON.parse(params.get('ticketIds') || '[]') : (params.get('sourceId') || '').split(',').filter(Boolean)
    if (!Array.isArray(values) || !values.length || values.some(id => typeof id !== 'string')) throw new Error('打印票据参数无效，请从换片布打印列表重新选择。')
    const ids = [...new Set(values as string[])]
    const state = await loadReplacementFabricState(); const scopes = listReplacementFabricOrderRows().flatMap(row => row.scopes)
    currentTickets = ids.map(id => {
      const ticket = state.tickets.find(ticket => ticket.id === id)
      if (!ticket) throw new Error('所选票据不存在，请刷新打印列表。')
      if (!state.receipts.some(receipt => receipt.ticket.id === id)) assertReplacementTicketCurrent(ticket, scopes)
      return ticket
    })
    const printDocument = buildPrintDocument({ documentType: 'REPLACEMENT_FABRIC_LABEL', sourceType: 'FEI_TICKET_RECORD', sourceId: ids.join(',') })
    commandId = cuttingRecordUuid(); printingRequested = false
    return `<main class="hpb-print-root bg-slate-100 p-4" data-hpb-print><section class="hpb-print-controls mx-auto max-w-4xl space-y-3 rounded border bg-white p-4"><div class="flex flex-wrap items-center justify-between gap-2"><div><h1 class="text-xl font-semibold">换片布菲票打印预览</h1><p class="text-sm">${currentTickets.length} 张 · 每张 5 Yard · 100 × 100 mm 黑白标签</p></div><a class="text-blue-700" href="/fcs/craft/cutting/replacement-fabric-fei-tickets">返回打印列表</a></div><p class="text-sm">关闭打印设置中的页眉、页脚；按实际出纸勾选成功票，再确认打印结果。取消打印不会记为已打印。</p><div class="max-h-40 space-y-2 overflow-y-auto">${currentTickets.map(ticket => `<label class="flex items-start gap-2 text-sm"><input type="checkbox" data-hpb-print-success="${e(ticket.id)}"><span class="break-all">${e(ticket.ticketNo)} · ${state.prints.some(record => record.ticketId === ticket.id) ? '补打原票' : '首次打印'}</span></label>`).join('')}</div><div class="flex flex-wrap gap-2"><button class="rounded bg-blue-600 px-4 py-2 text-white" data-hpb-print-action="print">打印 / 保存 PDF</button><button class="rounded border px-4 py-2" data-hpb-print-action="all">全部已成功出纸</button><button class="rounded border px-4 py-2" data-hpb-print-action="confirm">确认所选票已打印</button></div><p class="text-sm text-red-700" role="status" data-hpb-print-feedback></p></section>${renderPrintDocument(printDocument)}</main>`
  } catch (error) { return `<div class="p-5 text-red-700" role="alert">${e(error instanceof Error ? error.message : String(error))}</div>` }
}
export async function handleReplacementFabricPrintEvent(target: HTMLElement): Promise<boolean> {
  const node = target.closest<HTMLElement>('[data-hpb-print-action]'); if (!node) return false
  const feedback = document.querySelector<HTMLElement>('[data-hpb-print-feedback]')!
  if (saving) return true
  try {
    feedback.textContent = ''; feedback.className = 'text-sm text-red-700'
    if (node.dataset.hpbPrintAction === 'print') {
      const images = [...document.querySelectorAll<HTMLImageElement>('[data-hpb-label] img')]
      if (images.length !== currentTickets.length || images.some(image => !image.complete || !image.naturalWidth)) throw new Error('面料图片尚未完整加载，请等待或刷新后再打印。')
      if (document.querySelectorAll('[data-hpb-label] [data-real-qr] svg').length !== currentTickets.length) throw new Error('二维码尚未就绪，请稍后重试。')
      const confirm = document.querySelector<HTMLButtonElement>('[data-hpb-print-action="confirm"]')
      if (confirm?.disabled) {
        commandId = cuttingRecordUuid(); confirm.disabled = false; confirm.textContent = '确认所选票已打印'
        document.querySelectorAll<HTMLInputElement>('[data-hpb-print-success]').forEach(input => { input.checked = false })
      }
      const labels = [...document.querySelectorAll<HTMLElement>('[data-hpb-label]')]
      if (labels.some(label => label.getBoundingClientRect().height > 379)) throw new Error('票面文字超过 100 mm 标签范围，请主管核对物料编码或名称后再打印，避免内容被截断。')
      printingRequested = true; window.print()
    } else if (node.dataset.hpbPrintAction === 'all') {
      if (!printingRequested) throw new Error('请先打印，再核对是否全部成功出纸。')
      document.querySelectorAll<HTMLInputElement>('[data-hpb-print-success]').forEach(input => { input.checked = true })
    } else if (node.dataset.hpbPrintAction === 'confirm') {
      if (!printingRequested) throw new Error('请先打印，再确认实际成功的票。')
      const ids = [...document.querySelectorAll<HTMLInputElement>('[data-hpb-print-success]:checked')].map(input => input.dataset.hpbPrintSuccess!)
      saving = true
      await saveReplacementFabricPrint(ids, listReplacementFabricOrderRows().flatMap(row => row.scopes), { id: commandId, at: new Date().toISOString(), operator: '裁床打票员' })
      feedback.className = 'text-sm text-emerald-700'
      feedback.textContent = `已保存 ${ids.length} 张票的打印结果。其余票未标记已打印。`
      node.setAttribute('disabled', ''); node.textContent = '本次结果已确认'
    }
  } catch (error) { feedback.textContent = error instanceof Error ? error.message : String(error) }
  finally { saving = false }
  return true
}
