// @page-pattern: detail
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

function imageBox(title: string, imageUrl: string | undefined, testId: string): string {
  if (!imageUrl) {
    return `<div class="flex h-28 items-center justify-center rounded-md border border-dashed text-xs text-red-700" data-testid="${escapeHtml(testId)}">${escapeHtml(title)}缺失，需补真实图片</div>`
  }
  return `<figure class="rounded-md border bg-white p-2" data-testid="${escapeHtml(testId)}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" class="h-24 w-full object-contain"><figcaption class="mt-1 text-center text-[11px] text-slate-500">${escapeHtml(title)}</figcaption></figure>`
}

function barcode(value: string): string {
  const seed = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const bars = Array.from({ length: 28 }, (_, index) => {
    const width = ((seed + index * 7) % 4) + 1
    return `<span style="width:${width}px"></span>`
  }).join('')
  return `<div class="barcode" data-barcode="${escapeHtml(value)}">${bars}</div>`
}

function qrCode(value: string): string {
  const seed = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const cells = Array.from({ length: 49 }, (_, index) => {
    const active = index < 7 || index % 7 === 0 || ((seed + index * 11) % 5) < 2
    return `<span class="${active ? 'bg-slate-900' : 'bg-white'}"></span>`
  }).join('')
  return `<div class="qr" data-qr-code="${escapeHtml(value)}">${cells}</div>`
}

function renderHandoverPage(order: WoolWorkOrder, record: WoolHandoverRecord, pageNo: number): string {
  const line = findOutputLine(order, record.outputSkuCode)
  const materialImages = line?.materialImageUrls?.filter(Boolean) ?? []
  const receiverLabel = record.receiverType === 'CUTTING_WAIT_HANDOVER_WAREHOUSE'
    ? '裁床工厂（裁床待交出仓）'
    : record.receiverName
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
        <div class="mt-2 text-xs text-slate-500">每次发起交出后打印，随货流转。</div>
      </div>
      <div class="text-right text-xs">
        <div>交出单号：<span class="font-mono font-semibold">${escapeHtml(record.handoverId)}</span></div>
        <div>打印页：${pageNo}</div>
        <div>交出时间：${escapeHtml(record.handedOverAt)}</div>
        <div class="mt-2 flex justify-end">${qrCode(payload)}</div>
      </div>
    </header>

    <div class="mt-4 grid grid-cols-[1.2fr_.8fr] gap-4">
      <section class="rounded-md border p-3 text-sm">
        <div class="grid grid-cols-2 gap-x-4 gap-y-2">
          <div><span class="text-slate-500">生产单：</span><span class="font-semibold">${escapeHtml(order.productionOrderNo)}</span></div>
          <div><span class="text-slate-500">毛织加工单：</span><span class="font-semibold">${escapeHtml(order.woolOrderNo)}</span></div>
          <div><span class="text-slate-500">款号：</span>${escapeHtml(order.styleNo)}</div>
          <div><span class="text-slate-500">款名：</span>${escapeHtml(order.styleName)}</div>
          <div><span class="text-slate-500">加工类型：</span>${order.kind === 'PART_PANEL' ? '部位毛织' : '整件毛织'}</div>
          <div><span class="text-slate-500">下游接收工厂：</span><span class="font-semibold">${escapeHtml(receiverLabel)}</span></div>
          <div class="col-span-2"><span class="text-slate-500">接收方标识：</span>${escapeHtml(record.receiverId)} / ${escapeHtml(record.receiverName)}</div>
        </div>
      </section>
      <section class="rounded-md border p-3">
        <div class="mb-2 text-xs font-semibold text-slate-600">交出单条码</div>
        ${barcode(record.handoverId)}
        <div class="mt-2 break-all font-mono text-xs">${escapeHtml(record.handoverId)}</div>
      </section>
    </div>

    <div class="mt-4 grid grid-cols-[220px_1fr] gap-4">
      <section>
        ${imageBox('真实款式图', order.styleImageUrl, 'wool-print-style-image')}
        <div class="mt-3 grid grid-cols-2 gap-2">
          ${materialImages.map((url, index) => imageBox(`真实物料图 ${index + 1}`, url, `wool-print-material-image-${index + 1}`)).join('') || imageBox('真实物料图', undefined, 'wool-print-material-image-missing')}
        </div>
      </section>
      <section class="overflow-hidden rounded-md border">
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
              <td class="px-3 py-3 text-right text-lg font-bold">${escapeHtml(formatQty(record.handoverQty, '件'))}</td>
              <td class="px-3 py-3">${escapeHtml(record.remark || '')}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <footer class="mt-8 grid grid-cols-3 gap-8 text-center text-sm">
      <div class="border-t pt-2">交出人：${escapeHtml(record.handedOverBy)}</div>
      <div class="border-t pt-2">承运/交接</div>
      <div class="border-t pt-2">接收方签收</div>
    </footer>
  </section>`
}

export function renderCraftWoolHandoverPrintPage(woolOrderId: string): string {
  const order = getWoolWorkOrderById(woolOrderId)
  if (!order) {
    return `<main class="p-6" data-wool-handover-print-page><div class="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">未找到毛织加工单：${escapeHtml(woolOrderId)}</div></main>`
  }
  const handovers = listWoolFactRecords({
    woolOrderId,
    recordType: 'HANDOVER',
  }).map((item) => item.record as WoolHandoverRecord)
  return `<main class="fixed inset-0 z-[9999] min-h-screen overflow-auto bg-slate-100 p-6 text-slate-900" data-wool-handover-print-root>
    <style>
      @media print { body { background: #fff; } [data-wool-handover-print-root] { position: static; overflow: visible; padding: 0; background: #fff; } .print-toolbar { display: none; } .a4-page { margin: 0; box-shadow: none; page-break-after: always; } }
      .a4-page { width: 210mm; min-height: 297mm; margin: 0 auto 24px; background: #fff; padding: 18mm; box-shadow: 0 8px 24px rgba(15,23,42,.16); }
      .barcode { display: flex; height: 42px; align-items: stretch; gap: 2px; }
      .barcode span { display: inline-block; background: #0f172a; }
      .qr { display: grid; grid-template-columns: repeat(7, 8px); grid-template-rows: repeat(7, 8px); gap: 1px; border: 4px solid #fff; background: #fff; }
      .qr span { width: 8px; height: 8px; }
    </style>
    <div class="print-toolbar mx-auto mb-4 flex w-[210mm] items-center justify-between rounded-md border bg-white p-3">
      <div><div class="font-semibold">毛织交出单打印</div><div class="text-xs text-slate-500">A4 纸；按交出记录逐张打印，包含条码 / 二维码。</div></div>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm" onclick="window.print()">打印</button>
    </div>
    ${handovers.length > 0
      ? handovers.map((record, index) => renderHandoverPage(order, record, index + 1)).join('')
      : `<section class="a4-page" data-wool-handover-print-page><div class="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">该毛织加工单还没有交出记录，暂无可打印交出单。</div></section>`}
  </main>`
}
