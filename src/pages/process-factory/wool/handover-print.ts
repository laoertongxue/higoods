// @page-pattern: detail
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import {
  getWoolWorkOrderById,
  listWoolFactRecords,
  type WoolHandoverRecord,
  type WoolOutputPlanLine,
  type WoolWorkOrder,
} from '../../../data/fcs/wool-task-domain.ts'
import { escapeHtml } from '../../../utils.ts'

function formatQty(value: number, unit = '件'): string {
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`
}

function findOutputLine(order: WoolWorkOrder, outputSkuCode: string): WoolOutputPlanLine | undefined {
  return order.outputPlanLines.find((line) => line.outputSkuCode === outputSkuCode)
}

function isRealPrintImage(imageUrl: string | undefined): imageUrl is string {
  if (!imageUrl || imageUrl.startsWith('data:') || imageUrl.includes('placeholder')) return false
  return /\.(?:jpe?g|png|webp)(?:[?#].*)?$/i.test(imageUrl)
}

const PRINT_READY_MESSAGE = 'A4 纸；每条交出记录一页，二维码可扫码追溯。'
const PRINT_IMAGE_INCOMPLETE_MESSAGE = '款式图不完整，禁止正式打印；请先补齐真实款式图。'

function printImageStateHandler(loaded: boolean): string {
  return `const root=this.closest('[data-wool-handover-print-root]'); this.dataset.woolPrintImageReady='${loaded ? 'true' : 'false'}'; if (root) { const update=()=>{ const pages=[...root.querySelectorAll('[data-wool-handover-print-page][data-handover-id]')]; const images=pages.map((page)=>page.querySelector('[data-wool-print-style-image]')); const qrReady=pages.length>0 && pages.every((page)=>page.querySelector('[data-real-qr] svg')); const imagesSettled=images.every((image)=>image && image.complete); const ready=qrReady && images.every((image)=>image && image.complete && image.naturalWidth > 0 && image.dataset.woolPrintImageReady==='true'); const button=root.querySelector('[data-wool-print-button]'); if(button){button.disabled=!ready;button.setAttribute('aria-disabled',String(!ready));} const message=root.querySelector('[data-wool-print-readiness-message]'); if(message){const nextText=ready?'${PRINT_READY_MESSAGE}':'${PRINT_IMAGE_INCOMPLETE_MESSAGE}';if(message.textContent!==nextText)message.textContent=nextText;message.classList.toggle('text-slate-500',ready);message.classList.toggle('font-medium',!ready);message.classList.toggle('text-red-700',!ready);} if(qrReady&&imagesSettled&&root.__woolPrintObserver){root.__woolPrintObserver.disconnect();root.__woolPrintObserver=null;} }; root.__updateWoolPrintReadiness=update; if(!root.__woolPrintObserver){root.__woolPrintObserver=new MutationObserver(update);root.__woolPrintObserver.observe(root,{childList:true,subtree:true});} update(); }`
}

function renderStyleImage(imageUrl: string | undefined): string {
  if (!isRealPrintImage(imageUrl)) {
    return '<div class="flex h-28 w-28 shrink-0 items-center justify-center rounded-md border border-dashed border-red-300 bg-red-50 p-2 text-center text-xs text-red-700" data-testid="wool-print-style-image-missing">款式图缺失，需补真实图片</div>'
  }
  return `<img src="${escapeHtml(imageUrl)}" alt="SPU 款式图" class="h-28 w-28 shrink-0 rounded-md border bg-white object-contain p-1" data-testid="wool-print-style-image" data-wool-print-style-image onload="${printImageStateHandler(true)}" onerror="${printImageStateHandler(false)}">`
}

function receiverLabel(record: WoolHandoverRecord): string {
  return record.receiverType === 'CUTTING_WAIT_HANDOVER_WAREHOUSE'
    ? '裁床工厂（裁床待交出仓）'
    : record.receiverName
}

function renderHandoverPage(order: WoolWorkOrder, record: WoolHandoverRecord, pageNo: number): string {
  const line = findOutputLine(order, record.outputSkuCode)
  const receiver = receiverLabel(record)
  const payload = [
    'WOOL_HANDOVER',
    record.handoverId,
    order.productionOrderNo,
    order.woolOrderNo,
    record.receiverId,
  ].join('|')

  return `<section class="a4-page" data-wool-handover-print-page data-handover-id="${escapeHtml(record.handoverId)}">
    <header class="flex items-start justify-between border-b-2 border-slate-900 pb-4">
      <div>
        <div class="text-3xl font-bold tracking-wide">SURAT JALAN</div>
        <div class="mt-1 text-xl font-semibold">毛织交出单</div>
        <div class="mt-2 text-xs text-slate-500">每次发起交出形成一张独立交出单，随货流转。</div>
      </div>
      <div class="flex items-start gap-3 text-right text-xs">
        <div>
          <div>交出单号：<span class="font-mono font-semibold">${escapeHtml(record.handoverId)}</span></div>
          <div>打印页：${pageNo}</div>
          <div>交出时间：${escapeHtml(record.handedOverAt)}</div>
        </div>
        ${renderRealQrPlaceholder({
          value: payload,
          size: 88,
          title: `毛织交出单 ${record.handoverId}`,
          label: `扫描查看毛织交出单 ${record.handoverId}`,
          className: 'shrink-0',
        })}
      </div>
    </header>

    <section class="mt-4 flex gap-4 rounded-md border p-3" data-wool-print-spu-info>
      ${renderStyleImage(order.styleImageUrl)}
      <div class="min-w-0 flex-1 text-sm">
        <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">SPU 款式信息</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-2">
          <div><span class="text-slate-500">款号：</span><span class="font-semibold">${escapeHtml(order.styleNo)}</span></div>
          <div><span class="text-slate-500">款名：</span>${escapeHtml(order.styleName)}</div>
          <div><span class="text-slate-500">生产单：</span><span class="font-semibold">${escapeHtml(order.productionOrderNo)}</span></div>
          <div><span class="text-slate-500">毛织加工单：</span><span class="font-semibold">${escapeHtml(order.woolOrderNo)}</span></div>
          <div><span class="text-slate-500">加工类型：</span>${order.kind === 'PART_PANEL' ? '部位毛织' : '整件毛织'}</div>
          <div><span class="text-slate-500">下游接收工厂：</span><span class="font-semibold">${escapeHtml(receiver)}</span></div>
          <div class="col-span-2"><span class="text-slate-500">接收方标识：</span>${escapeHtml(record.receiverId)} / ${escapeHtml(record.receiverName)}</div>
        </div>
      </div>
    </section>

    <section class="mt-4 overflow-hidden rounded-md border">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-100 text-xs text-slate-600">
          <tr>
            <th class="px-3 py-2">颜色</th>
            <th class="px-3 py-2">尺码</th>
            <th class="px-3 py-2">部位/对象</th>
            <th class="px-3 py-2">加工后 SKU</th>
            <th class="px-3 py-2 text-right">本次交出件数</th>
            <th class="px-3 py-2">备注</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="px-3 py-3 font-medium">${escapeHtml(line?.colorName || '—')}</td>
            <td class="px-3 py-3">${escapeHtml(line?.sizeCode || '—')}</td>
            <td class="px-3 py-3">${escapeHtml(line?.woolPartName || (line?.outputObjectType === 'GARMENT' ? '整件' : '毛织部位'))}</td>
            <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.outputSkuCode)}</td>
            <td class="px-3 py-3 text-right text-lg font-bold">${escapeHtml(formatQty(record.handoverQty, record.qtyUnit))}</td>
            <td class="px-3 py-3">${escapeHtml(record.remark || '')}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <footer class="mt-8 grid grid-cols-3 gap-8 text-center text-sm">
      <div class="border-t pt-2">交出人：${escapeHtml(record.handedOverBy)}</div>
      <div class="border-t pt-2">承运/交接</div>
      <div class="border-t pt-2">接收方签收</div>
    </footer>
  </section>`
}

export function renderCraftWoolHandoverPrintPage(woolOrderId: string, handoverId?: string): string {
  const order = getWoolWorkOrderById(woolOrderId)
  if (!order) {
    return `<main class="p-6" data-wool-handover-print-root><div class="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">未找到毛织加工单：${escapeHtml(woolOrderId)}</div></main>`
  }
  const allHandovers = listWoolFactRecords({
    woolOrderId,
    recordType: 'HANDOVER',
  }).map((item) => item.record as WoolHandoverRecord)
  const handovers = handoverId
    ? allHandovers.filter((record) => record.handoverId === handoverId)
    : allHandovers
  const emptyMessage = handoverId
    ? `未找到对应的交出记录：${escapeHtml(handoverId)}`
    : '该毛织加工单还没有交出记录，暂无可打印交出单。'

  return `<main class="fixed inset-0 z-[9999] min-h-screen overflow-auto bg-slate-100 p-6 text-slate-900" data-wool-handover-print-root>
    <style>
      @media print { body { background: #fff; } [data-wool-handover-print-root] { position: static; overflow: visible; padding: 0; background: #fff; } .print-toolbar { display: none; } .a4-page { margin: 0; box-shadow: none; page-break-after: always; } }
      .a4-page { width: 210mm; min-height: 297mm; margin: 0 auto 24px; background: #fff; padding: 18mm; box-shadow: 0 8px 24px rgba(15,23,42,.16); }
    </style>
    <div class="print-toolbar mx-auto mb-4 flex w-[210mm] items-center justify-between rounded-md border bg-white p-3">
      <div>
        <div class="font-semibold">毛织交出单打印</div>
        <div class="text-xs font-medium text-red-700" data-wool-print-readiness-message>${PRINT_IMAGE_INCOMPLETE_MESSAGE}</div>
      </div>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" data-wool-print-button disabled aria-disabled="true" ${handovers.length > 0 && isRealPrintImage(order.styleImageUrl) ? `onclick="const root=this.closest('[data-wool-handover-print-root]'); const pages=[...root.querySelectorAll('[data-wool-handover-print-page][data-handover-id]')]; const images=pages.map((page)=>page.querySelector('[data-wool-print-style-image]')); if(!pages.length||images.some((image)=>!image||!image.complete||image.naturalWidth<=0)){this.disabled=true;this.setAttribute('aria-disabled','true');const message=root.querySelector('[data-wool-print-readiness-message]');if(message){message.textContent='${PRINT_IMAGE_INCOMPLETE_MESSAGE}';message.classList.remove('text-slate-500');message.classList.add('font-medium','text-red-700');}return;} const qrNodes=pages.map((page)=>page.querySelector('[data-real-qr]')); if(qrNodes.some((node)=>!node||!node.querySelector('svg'))){window.alert('二维码正在生成，请稍后再打印。');return;} window.print()"` : ''}>打印</button>
    </div>
    ${handovers.length > 0
      ? handovers.map((record, index) => renderHandoverPage(order, record, index + 1)).join('')
      : `<section class="a4-page" data-wool-handover-print-page><div class="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">${emptyMessage}</div></section>`}
  </main>`
}
