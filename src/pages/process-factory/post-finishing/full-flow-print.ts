import { listFinishedInventoryTransfers, finishedInventoryTransferStatus } from '../../../data/wls/finished-inventory-quality.ts'
import { postFinishingPrintProgressFields } from '../../../data/fcs/post-finishing-print-progress.ts'
// @page-pattern: detail

import { renderCode128Barcode } from '../../../components/real-barcode.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import {
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  getPostFinishingFactoryReturn,
  getPostFinishingFullFlowOutboundOrder,
  getPostFinishingFullFlowPostTask,
  getPostFinishingProcessProgress,
  listPostFinishingFullFlowOutboundOrders,
  getPostFinishingFullFlowQcTask,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { getQcShippingPriorityForQc } from '../../../data/fcs/post-finishing-qc-shipping-priority-runtime.ts'
import { buildProductionConfirmationSnapshot } from '../../../data/fcs/production-confirmation.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  renderPostFinishingQcTaskDetail,
  renderPostFinishingQcTaskMaster,
} from '../../print/templates/post-finishing-qc-print-template.ts'

type PrintType = 'SEND_QC' | 'QC_ORDER' | 'QC_DETAIL' | 'POST_ORDER' | 'OUTBOUND' | 'OUTBOUND_BARCODE' | 'OUTBOUND_HANGTAG'

interface PrintLine {
  sku: {
    skuId: string
    skuCode: string
    spuCode: string
    spuName: string
    colorName: string
    sizeName: string
    imageUrl: string
    barcode: string
  }
  qty: number
}

interface PrintMetadata {
  label: string
  value: string
}

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function printImage(line: PrintLine): string {
  const alt = `${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`
  return `<div class="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border bg-slate-50"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(alt)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[8px] text-slate-500">图片加载中…</span></div>`
}

function page(
  title: string,
  subtitle: string,
  documentNo: string,
  scanTarget: string,
  metadata: PrintMetadata[],
  lines: PrintLine[],
): string {
  return `<div class="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0" data-post-print-ready-root data-testid="post-finishing-full-flow-print" data-print-document-no="${escapeHtml(documentNo)}" data-scan-target="${escapeHtml(scanTarget)}">
    <div class="mx-auto max-w-[210mm] bg-white p-[12mm] shadow print:shadow-none" data-print-sheet="a4">
      <div class="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div><h1 class="text-2xl font-bold">${escapeHtml(title)}</h1><p class="mt-1 text-sm">${escapeHtml(subtitle)}</p><div class="mt-3 font-mono text-lg font-semibold">${escapeHtml(documentNo)}</div></div>
        <div class="w-36 text-center">${renderRealQrPlaceholder({ value: scanTarget, size: 116, title: `${title}扫描入口`, label: scanTarget })}<div class="mt-1 break-all text-[9px]">${escapeHtml(scanTarget)}</div></div>
      </div>
      <div class="mt-4 border border-black p-3" data-business-document-barcode="${escapeHtml(documentNo)}">${renderCode128Barcode(documentNo, `${title}业务单号条码`)}<div class="mt-1 text-center font-mono text-xs font-semibold">${escapeHtml(documentNo)}</div></div>
      <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-black py-3 text-xs">${metadata.map((item) => `<div><dt class="text-slate-500">${escapeHtml(item.label)}</dt><dd class="mt-0.5 break-all font-medium">${escapeHtml(item.value)}</dd></div>`).join('')}</dl>
      <table class="mt-5 w-full border-collapse text-sm"><thead><tr><th class="border border-black p-2">SPU / 产品</th><th class="border border-black p-2">SKU</th><th class="border border-black p-2">颜色 / 尺码</th><th class="border border-black p-2">数量</th><th class="border border-black p-2">SKU 条码</th></tr></thead><tbody>${lines.map((line) => `<tr><td class="border border-black p-2"><div class="flex items-center gap-2">${printImage(line)}<span><span class="block font-mono text-xs">${escapeHtml(line.sku.spuCode)}</span>${escapeHtml(line.sku.spuName)}</span></div></td><td class="border border-black p-2 font-mono">${escapeHtml(line.sku.skuCode)}</td><td class="border border-black p-2">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</td><td class="border border-black p-2 text-center font-semibold">${line.qty} 件</td><td class="border border-black p-2 font-mono text-xs">${escapeHtml(line.sku.barcode)}</td></tr>`).join('')}</tbody></table>
      <div class="mt-6 flex justify-end print:hidden"><button type="button" data-post-verified-print class="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white">打印</button></div>
    </div>
  </div>`
}

function outboundLabelSheet(
  outbound: NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>,
  kind: 'BARCODE' | 'HANGTAG',
): string {
  const productionOrder = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.productionOrderNo === outbound.productionOrderNo)
  const labels = outbound.lines.flatMap((line) => Array.from({ length: line.outboundQty }, (_, index) => ({ line, index })))
  const title = kind === 'BARCODE' ? '后道出货条码' : '后道出货吊牌'
  return `<div class="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0" data-post-print-ready-root data-testid="post-finishing-outbound-label-print" data-label-kind="${kind}" data-label-count="${labels.length}"><div class="mb-4 flex items-center justify-between print:hidden"><div><h1 class="text-xl font-semibold">${title}</h1><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(outbound.outboundOrderNo)} · 按出货数量生成 ${labels.length} 张</p></div><button type="button" data-post-verified-print class="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white">打印全部</button></div><div class="grid grid-cols-3 gap-[3mm] print:block">${labels.map(({ line, index }) => kind === 'BARCODE' ? `<article class="mb-[2mm] inline-block h-[30mm] w-[40mm] break-inside-avoid overflow-hidden border border-black bg-white p-[2mm] align-top text-black" data-outbound-unit-label data-sku-id="${escapeHtml(line.sku.skuId)}"><div class="truncate text-[8px] font-bold">${escapeHtml(line.sku.spuName)}</div><div class="truncate font-mono text-[8px]">${escapeHtml(line.sku.skuCode)}</div><div class="text-[7px]">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)} · ${index + 1}/${line.outboundQty}</div><div class="mt-[1mm] [&_svg]:h-[9mm]">${renderCode128Barcode(line.sku.barcode, `${line.sku.skuCode} 出货条码`)}</div><div class="mt-[1mm] truncate text-center font-mono text-[8px] leading-none">${escapeHtml(line.sku.barcode)}</div></article>` : `<article class="mb-[2mm] inline-flex h-[90mm] w-[50mm] break-inside-avoid flex-col overflow-hidden border border-black bg-white p-[3mm] align-top text-black" data-outbound-unit-label data-sku-id="${escapeHtml(line.sku.skuId)}"><div class="relative flex h-[30mm] w-full items-center justify-center overflow-hidden bg-slate-50"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(`${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`)}" class="h-full w-full object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[8px] text-slate-500">图片加载中…</span></div><div class="mt-[2mm] text-[9px] font-bold leading-tight">${escapeHtml(line.sku.spuName)}</div><div class="mt-1 font-mono text-[8px]">${escapeHtml(line.sku.skuCode)}</div><div class="text-[8px]">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div><div class="mt-1 text-[8px]">吊牌价：${escapeHtml(productionOrder?.tagPrice || '—')} · ${index + 1}/${line.outboundQty}</div><div class="mt-auto">${renderCode128Barcode(line.sku.barcode, `${line.sku.skuCode} 吊牌条码`)}</div><div class="truncate text-center font-mono text-[7px]">${escapeHtml(line.sku.barcode)}</div></article>`).join('')}</div></div>`
}

function outboundDocumentPage(outbound: NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>): string {
  const delivery = getPostFinishingFactoryReturn(outbound.deliveryId)
  const factoryName = delivery?.managedPostFactoryName || '—'
  const status = outbound.status
  const directFromQc = outbound.sourceType === '质检直达'
  const sourceAction = directFromQc ? '质检正常放行 → 准备出货 → 实际发出 → 成衣仓实收' : '后道加工完成 → 准备出货 → 实际发出 → 成衣仓实收'
  return `<div class="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0" data-post-print-ready-root data-testid="post-finishing-full-flow-print" data-print-document-no="${escapeHtml(outbound.outboundOrderNo)}"><div class="mx-auto max-w-[210mm] bg-white p-[12mm] shadow print:shadow-none" data-print-sheet="a4"><div class="flex items-start justify-between gap-4 border-b-2 border-black pb-4"><div><h1 class="text-2xl font-bold">后道出货单</h1><div class="mt-2 font-mono text-lg font-semibold">${escapeHtml(outbound.outboundOrderNo)}</div></div><div class="w-44" data-business-document-barcode="${escapeHtml(outbound.outboundOrderNo)}">${renderCode128Barcode(outbound.outboundOrderNo, '后道出货单号条码')}</div></div><table class="mt-4 w-full border-collapse text-xs"><tbody>${[
    ['出货单号', outbound.outboundOrderNo, '状态', status],
    ['工厂', factoryName, '来源动作', sourceAction],
    ['交出位置', directFromQc ? `${factoryName}-质检交接区` : `${factoryName}-后道待交出仓`, '接收仓', '成衣仓'],
    ['生产单号', outbound.productionOrderNo, '任务单号', delivery?.sewingTaskNo || '—'],
    ['任务范围', `${outbound.responsibility.taskTypeLabel} · ${outbound.responsibility.responsibilityLabel}`, '交接来源', outbound.sourceType],
    ['后道加工单', outbound.postTaskNo || '不适用（质检直达成衣仓）', '出货状态', outbound.status],
    ['来源对象', directFromQc ? `质检单 · ${outbound.qcTaskNo}` : `后道加工单 · ${outbound.postTaskNo}`, '准备时间', new Date(outbound.createdAt).toLocaleString('zh-CN')],
    ['实际发出', outbound.dispatchedAt || '未发出', '仓库实收', outbound.receivedAt || '未接收'],
    ['备注', directFromQc ? 'QC确认无需后道加工，仍需实际发出后仓库接收' : '加工完成后准备出货，另行确认实际发出', '操作人', outbound.dispatchedBy?.actorName || '尚未实际发出'],
  ].map((row) => `<tr>${row.map((value, index) => `<${index % 2 === 0 ? 'th' : 'td'} class="border border-black p-2 ${index % 2 === 0 ? 'w-24 bg-slate-50 text-left' : ''}">${escapeHtml(value)}</${index % 2 === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</tbody></table><h2 class="mt-5 text-lg font-semibold">出货明细</h2><table class="mt-2 w-full border-collapse text-[10px]"><thead><tr>${['序号','图片','类型','SKU','名称','颜色','尺码','本单数量','实际发出','成衣仓实收','单位'].map((head) => `<th class="border border-black p-1.5">${head}</th>`).join('')}</tr></thead><tbody>${outbound.lines.map((line, index) => `<tr><td class="border border-black p-1.5 text-center">${index + 1}</td><td class="border border-black p-1.5">${printImage({ sku: line.sku, qty: line.outboundQty })}</td><td class="border border-black p-1.5">成品</td><td class="border border-black p-1.5 font-mono">${escapeHtml(line.sku.skuCode)}</td><td class="border border-black p-1.5">${escapeHtml(line.sku.spuName)}</td><td class="border border-black p-1.5">${escapeHtml(line.sku.colorName)}</td><td class="border border-black p-1.5">${escapeHtml(line.sku.sizeName)}</td><td class="border border-black p-1.5 text-center">${line.outboundQty}</td><td class="border border-black p-1.5 text-center">${outbound.status==='待出货'?0:line.outboundQty}</td><td class="border border-black p-1.5 text-center">${line.receivedQty ?? '未接收'}</td><td class="border border-black p-1.5 text-center">件</td></tr>`).join('')}</tbody></table><div class="mt-5 grid grid-cols-2 gap-4 border-t pt-3 text-xs"><div>${directFromQc ? `质检单：${escapeHtml(outbound.qcTaskNo)}` : `实际发出人：${escapeHtml(outbound.dispatchedBy?.actorName || '尚未发出')}`}</div><div class="text-right">打印时间：${escapeHtml(new Date().toLocaleString('zh-CN'))}</div></div><div class="mt-4 flex justify-end print:hidden"><button type="button" data-post-verified-print class="rounded-md bg-blue-600 px-5 py-2 text-sm text-white">打印</button></div></div></div>`
}

function qcDetailPage(task: NonNullable<ReturnType<typeof getPostFinishingFullFlowQcTask>>):string {return renderPostFinishingQcTaskDetail(task)}
function qcOrderPage(task: NonNullable<ReturnType<typeof getPostFinishingFullFlowQcTask>>):string {return renderPostFinishingQcTaskMaster(task)}

export function renderPostFinishingFullFlowPrintPage(): string {
  const type = (query().get('type') || '') as PrintType
  const id = query().get('id') || ''
  try {
    if (type === 'OUTBOUND_BARCODE' || type === 'OUTBOUND_HANGTAG') {
      const outbound = getPostFinishingFullFlowOutboundOrder(id)
      if (!outbound) throw new Error('未找到后道出货单。')
      return outboundLabelSheet(outbound, type === 'OUTBOUND_BARCODE' ? 'BARCODE' : 'HANGTAG')
    }
    if (type === 'SEND_QC') {
      const delivery = getPostFinishingFactoryReturn(id)
      const task = delivery?.qcTaskNo ? getPostFinishingFullFlowQcTask(delivery.qcTaskNo) : getPostFinishingFullFlowQcTask(id)
      if (!task?.sentAt || !task.sentBy) throw new Error('质检单已生成但尚未送检出库，完成送检交接后才能打印送检单。')
      const sourceDelivery = getPostFinishingFactoryReturn(task.deliveryId)
      return page(
        '后道送检单',
        `${task.deliveryOrderNo} · ${task.productionOrderNo} · 送检时间 ${new Date(task.sentAt).toLocaleString('zh-CN')}`,
        task.qcTaskNo,
        `/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(task.qcTaskNo)}`,
        [
          { label: '数量来源', value: '仓库确认入库数' },
          { label: '回货确认人 / 时间', value: `${sourceDelivery?.confirmedBy?.actorName || '—'} / ${sourceDelivery?.confirmedAt ? new Date(sourceDelivery.confirmedAt).toLocaleString('zh-CN') : '—'}` },
          { label: '送检人 / 时间', value: `${task.sentBy.actorName} / ${new Date(task.sentAt).toLocaleString('zh-CN')}` },
          { label: '回货差异授权', value: sourceDelivery?.returnAuthorizedBy ? `${sourceDelivery.returnAuthorizedBy.authorizerName} / ${sourceDelivery.returnAuthorizationId}` : '无差异，无需授权' },
        ],
        task.lines.map((line) => ({ sku: line.sku, qty: line.expectedQty })),
      )
    }
    if (type === 'QC_ORDER') {
      const task = getPostFinishingFullFlowQcTask(id)
      if (!task) throw new Error('未找到质检单。')
      return qcOrderPage(task)
    }
    if (type === 'QC_DETAIL') {
      const task = getPostFinishingFullFlowQcTask(id)
      if (!task) throw new Error('未找到质检单。')
      return qcDetailPage(task)
    }
    if (type === 'POST_ORDER') {
      const task = getPostFinishingFullFlowPostTask(id)
      if (!task) throw new Error('未找到后道加工单。')
      const qcTask = getPostFinishingFullFlowQcTask(task.qcTaskId)
      return page(
        '后道加工单流转卡',
        `${task.qcTaskNo} · ${task.productionOrderNo} · ${task.processItems.join('、')}`,
        task.postTaskNo,
        task.inventoryApplicationId ? `/fcs/craft/post-finishing/work-orders/${encodeURIComponent(task.postTaskId)}` : `/fcs/pda/post-finishing/execute?id=${encodeURIComponent(task.postTaskNo)}`,
        [
          { label: '业务类型', value: task.inventoryApplicationId ? '成衣库存质检' : '工厂回货质检' },
          { label: task.inventoryApplicationId ? '送检申请 / 质检单' : '送货单 / 质检单', value: `${task.deliveryOrderNo} / ${task.qcTaskNo}` },
          ...(task.inventoryApplicationId ? [] : [{ label: '生产单 / 第几次回货', value: `${task.productionOrderNo} / 第 ${task.returnIndex} 次` }]),
          { label: '后道工序', value: task.processItems.join('、') },
          ...postFinishingPrintProgressFields(task.postTaskId),
          { label: '全部后道完成 / 可准备出货', value: `${getPostFinishingProcessProgress(task).totalCompletedQty} / ${getPostFinishingProcessProgress(task).availableForOutboundQty} 件` },
          { label: '全部出货单', value: (task.inventoryApplicationId ? listFinishedInventoryTransfers(task.inventoryApplicationId).filter(row=>row.category!=='送后道').map(row=>`${row.applicationNo} · ${row.category}（${finishedInventoryTransferStatus(row)}）`) : listPostFinishingFullFlowOutboundOrders().filter(row => row.postTaskId === task.postTaskId).map(row => `${row.outboundOrderNo}（${row.status}）`)).join('、') || '尚未出货' },
          { label: '质检交接时间', value: qcTask?.completedAt ? new Date(qcTask.completedAt).toLocaleString('zh-CN') : '—' },
        ],
        task.lines.map((line) => ({ sku: line.sku, qty: line.expectedQty })),
      )
    }
    if (type === 'OUTBOUND') {
      const outbound = getPostFinishingFullFlowOutboundOrder(id)
      if (!outbound) throw new Error('未找到后道出货单。')
      return outboundDocumentPage(outbound)
    }
    throw new Error('未指定有效打印类型。')
  } catch (error) {
    return `<div class="m-6 rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">${escapeHtml(error instanceof Error ? error.message : '打印数据加载失败。')}</div>`
  }
}
