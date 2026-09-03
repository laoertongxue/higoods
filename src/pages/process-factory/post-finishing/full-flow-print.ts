// @page-pattern: detail

import { renderCode128Barcode } from '../../../components/real-barcode.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import {
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  getPostFinishingFactoryReturn,
  getPostFinishingFullFlowOutboundOrder,
  getPostFinishingFullFlowPostTask,
  getPostFinishingFullFlowQcTask,
  getPostFinishingFullFlowRecheckOrder,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  renderOnlinePostFinishingQcDetail,
  renderOnlinePostFinishingQcMaster,
} from '../../print/templates/post-finishing-qc-print-template.ts'

type PrintType = 'SEND_QC' | 'QC_ORDER' | 'QC_DETAIL' | 'POST_ORDER' | 'OUTBOUND' | 'OUTBOUND_BARCODE' | 'OUTBOUND_HANGTAG' | 'SKU_LABEL'

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
  return `<div class="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0" data-testid="post-finishing-full-flow-print" data-print-document-no="${escapeHtml(documentNo)}" data-scan-target="${escapeHtml(scanTarget)}">
    <div class="mx-auto max-w-[210mm] bg-white p-[12mm] shadow print:shadow-none" data-print-sheet="a4">
      <div class="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div><h1 class="text-2xl font-bold">${escapeHtml(title)}</h1><p class="mt-1 text-sm">${escapeHtml(subtitle)}</p><div class="mt-3 font-mono text-lg font-semibold">${escapeHtml(documentNo)}</div></div>
        <div class="w-36 text-center">${renderRealQrPlaceholder({ value: scanTarget, size: 116, title: `${title}扫描入口`, label: scanTarget })}<div class="mt-1 break-all text-[9px]">${escapeHtml(scanTarget)}</div></div>
      </div>
      <div class="mt-4 border border-black p-3" data-business-document-barcode="${escapeHtml(documentNo)}">${renderCode128Barcode(documentNo, `${title}业务单号条码`)}<div class="mt-1 text-center font-mono text-xs font-semibold">${escapeHtml(documentNo)}</div></div>
      <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-black py-3 text-xs">${metadata.map((item) => `<div><dt class="text-slate-500">${escapeHtml(item.label)}</dt><dd class="mt-0.5 break-all font-medium">${escapeHtml(item.value)}</dd></div>`).join('')}</dl>
      <table class="mt-5 w-full border-collapse text-sm"><thead><tr><th class="border border-black p-2">SPU / 产品</th><th class="border border-black p-2">SKU</th><th class="border border-black p-2">颜色 / 尺码</th><th class="border border-black p-2">数量</th><th class="border border-black p-2">SKU 条码</th></tr></thead><tbody>${lines.map((line) => `<tr><td class="border border-black p-2"><div class="flex items-center gap-2">${printImage(line)}<span><span class="block font-mono text-xs">${escapeHtml(line.sku.spuCode)}</span>${escapeHtml(line.sku.spuName)}</span></div></td><td class="border border-black p-2 font-mono">${escapeHtml(line.sku.skuCode)}</td><td class="border border-black p-2">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</td><td class="border border-black p-2 text-center font-semibold">${line.qty} 件</td><td class="border border-black p-2 font-mono text-xs">${escapeHtml(line.sku.barcode)}</td></tr>`).join('')}</tbody></table>
      <div class="mt-6 flex justify-end print:hidden"><button type="button" onclick="window.print()" class="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white">打印</button></div>
    </div>
  </div>`
}

function skuLabel(recheckId: string, skuId: string): string {
  const record = getPostFinishingFullFlowRecheckOrder(recheckId)
  const line = record?.lines.find((item) => item.sku.skuId === skuId)
  if (!record || !line) throw new Error('未找到要重贴的 SKU。')
  return `<div class="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0" data-testid="post-finishing-sku-label-print"><div class="mx-auto h-[30mm] w-[40mm] overflow-hidden border border-black bg-white p-[2mm] text-black"><div class="truncate text-[9px] font-bold">${escapeHtml(line.sku.spuName)}</div><div class="truncate font-mono text-[8px]">${escapeHtml(line.sku.skuCode)}</div><div class="text-[8px]">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div><div class="mt-[1mm]" data-sku-label-barcode="${escapeHtml(line.sku.barcode)}">${renderCode128Barcode(line.sku.barcode, `${line.sku.skuCode} SKU 贴标`)}</div><div class="-mt-1 truncate text-center font-mono text-[7px]">${escapeHtml(line.sku.barcode)}</div></div><div class="mx-auto mt-4 w-[40mm] print:hidden"><button type="button" onclick="window.print()" class="w-full rounded-md bg-blue-600 px-3 py-2 text-xs text-white">打印 40×30 SKU 贴标</button></div></div>`
}

function outboundLabelSheet(
  outbound: NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>,
  kind: 'BARCODE' | 'HANGTAG',
): string {
  const productionOrder = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.productionOrderNo === outbound.productionOrderNo)
  const labels = outbound.lines.flatMap((line) => Array.from({ length: line.outboundQty }, (_, index) => ({ line, index })))
  const title = kind === 'BARCODE' ? '后道出货条码' : '后道出货吊牌'
  return `<div class="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0" data-testid="post-finishing-outbound-label-print" data-label-kind="${kind}" data-label-count="${labels.length}"><div class="mb-4 flex items-center justify-between print:hidden"><div><h1 class="text-xl font-semibold">${title}</h1><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(outbound.outboundOrderNo)} · 按出货数量生成 ${labels.length} 张</p></div><button type="button" onclick="window.print()" class="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white">打印全部</button></div><div class="grid grid-cols-3 gap-[3mm] print:block">${labels.map(({ line, index }) => kind === 'BARCODE' ? `<article class="mb-[2mm] inline-block h-[30mm] w-[40mm] break-inside-avoid overflow-hidden border border-black bg-white p-[2mm] align-top text-black" data-outbound-unit-label data-sku-id="${escapeHtml(line.sku.skuId)}"><div class="truncate text-[8px] font-bold">${escapeHtml(line.sku.spuName)}</div><div class="truncate font-mono text-[8px]">${escapeHtml(line.sku.skuCode)}</div><div class="text-[7px]">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)} · ${index + 1}/${line.outboundQty}</div><div class="mt-[1mm]">${renderCode128Barcode(line.sku.barcode, `${line.sku.skuCode} 出货条码`)}</div><div class="-mt-1 truncate text-center font-mono text-[7px]">${escapeHtml(line.sku.barcode)}</div></article>` : `<article class="mb-[2mm] inline-flex h-[90mm] w-[50mm] break-inside-avoid flex-col overflow-hidden border border-black bg-white p-[3mm] align-top text-black" data-outbound-unit-label data-sku-id="${escapeHtml(line.sku.skuId)}"><div class="relative flex h-[30mm] w-full items-center justify-center overflow-hidden bg-slate-50"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(`${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`)}" class="h-full w-full object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[8px] text-slate-500">图片加载中…</span></div><div class="mt-[2mm] text-[9px] font-bold leading-tight">${escapeHtml(line.sku.spuName)}</div><div class="mt-1 font-mono text-[8px]">${escapeHtml(line.sku.skuCode)}</div><div class="text-[8px]">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div><div class="mt-1 text-[8px]">吊牌价：${escapeHtml(productionOrder?.tagPrice || '—')} · ${index + 1}/${line.outboundQty}</div><div class="mt-auto">${renderCode128Barcode(line.sku.barcode, `${line.sku.skuCode} 吊牌条码`)}</div><div class="truncate text-center font-mono text-[7px]">${escapeHtml(line.sku.barcode)}</div></article>`).join('')}</div></div>`
}

function outboundDocumentPage(outbound: NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>): string {
  const delivery = getPostFinishingFactoryReturn(outbound.deliveryId)
  const recheck = getPostFinishingFullFlowRecheckOrder(outbound.recheckOrderId)
  const factoryName = delivery?.managedPostFactoryName || '—'
  const status = outbound.status === '已接收入库' ? '已确认' : '待确认'
  return `<div class="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0" data-testid="post-finishing-full-flow-print" data-print-document-no="${escapeHtml(outbound.outboundOrderNo)}" data-scan-target="/fcs/pda/post-finishing/outbound-receive?id=${encodeURIComponent(outbound.outboundOrderNo)}"><div class="mx-auto max-w-[210mm] bg-white p-[12mm] shadow print:shadow-none" data-print-sheet="a4"><div class="flex items-start justify-between gap-4 border-b-2 border-black pb-4"><div><h1 class="text-2xl font-bold">后道出货单</h1><div class="mt-2 font-mono text-lg font-semibold">${escapeHtml(outbound.outboundOrderNo)}</div></div><div class="w-44" data-business-document-barcode="${escapeHtml(outbound.outboundOrderNo)}">${renderCode128Barcode(outbound.outboundOrderNo, '后道出货单号条码')}</div></div><table class="mt-4 w-full border-collapse text-xs"><tbody>${[
    ['出货单号', outbound.outboundOrderNo, '状态', status],
    ['工厂', factoryName, '来源动作', '复检完成 → 后道待交出仓'],
    ['出库仓', `${factoryName}-后道待加工仓`, '接收仓', `${factoryName}-后道待交出仓`],
    ['生产单号', outbound.productionOrderNo, '任务单号', delivery?.sewingTaskNo || '—'],
    ['来源对象', `复检单 · ${outbound.recheckOrderNo}`, '创建时间', new Date(outbound.createdAt).toLocaleString('zh-CN')],
    ['备注', '复检完成后系统自动生成', '操作人', recheck?.claimedBy?.actorName || '系统'],
  ].map((row) => `<tr>${row.map((value, index) => `<${index % 2 === 0 ? 'th' : 'td'} class="border border-black p-2 ${index % 2 === 0 ? 'w-24 bg-slate-50 text-left' : ''}">${escapeHtml(value)}</${index % 2 === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</tbody></table><h2 class="mt-5 text-lg font-semibold">出货明细</h2><table class="mt-2 w-full border-collapse text-[10px]"><thead><tr>${['序号','图片','类型','SKU','名称','颜色','尺码','计划数量','已入库数量','单位'].map((head) => `<th class="border border-black p-1.5">${head}</th>`).join('')}</tr></thead><tbody>${outbound.lines.map((line, index) => `<tr><td class="border border-black p-1.5 text-center">${index + 1}</td><td class="border border-black p-1.5">${printImage({ sku: line.sku, qty: line.outboundQty })}</td><td class="border border-black p-1.5">成品</td><td class="border border-black p-1.5 font-mono">${escapeHtml(line.sku.skuCode)}</td><td class="border border-black p-1.5">${escapeHtml(line.sku.spuName)}</td><td class="border border-black p-1.5">${escapeHtml(line.sku.colorName)}</td><td class="border border-black p-1.5">${escapeHtml(line.sku.sizeName)}</td><td class="border border-black p-1.5 text-center">${line.outboundQty}</td><td class="border border-black p-1.5 text-center">${line.receivedQty ?? 0}</td><td class="border border-black p-1.5 text-center">件</td></tr>`).join('')}</tbody></table><div class="mt-5 grid grid-cols-2 gap-4 border-t pt-3 text-xs"><div>复检员：${escapeHtml(recheck?.claimedBy?.actorName || '—')}</div><div class="text-right">打印时间：${escapeHtml(new Date().toLocaleString('zh-CN'))}</div></div><div class="mt-4 flex justify-end print:hidden"><button type="button" onclick="window.print()" class="rounded-md bg-blue-600 px-5 py-2 text-sm text-white">打印</button></div></div></div>`
}

function qcDetailPage(task: NonNullable<ReturnType<typeof getPostFinishingFullFlowQcTask>>): string {
  const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.productionOrderNo === task.productionOrderNo)
  if (!order) throw new Error('未找到质检单对应的生产单。')
  return renderOnlinePostFinishingQcDetail({
    documentNo: task.qcTaskNo,
    spuCode: order.styleNo,
    printedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    productionOrderNo: task.productionOrderNo,
    factoryName: order.managedPostFactoryName,
    buyerName: order.buyerName,
    productionOrderType: order.productionOrderType,
    saleType: order.saleType,
    skuLines: task.lines.map((line) => {
      const result = task.results?.find((item) => item.sku.skuId === line.sku.skuId)
      const inspectedQty = result ? result.passedQty + result.defectQty + result.returnQty : 0
      return {
        skuCode: line.sku.skuCode,
        waitProcessQty: '0',
        waitQcQty: task.status === '质检完成' ? '' : String(line.expectedQty),
        inspectedQty: inspectedQty > 0 ? String(inspectedQty) : '',
      }
    }),
  })
}

function qcOrderPage(task: NonNullable<ReturnType<typeof getPostFinishingFullFlowQcTask>>): string {
  const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.productionOrderNo === task.productionOrderNo)
  if (!order) throw new Error('未找到质检单对应的生产单。')
  return renderOnlinePostFinishingQcMaster({
    documentNo: task.qcTaskNo,
    spuCode: order.styleNo,
    styleGrade: order.styleGrade,
    productionOrderNo: order.productionOrderNo,
    factoryName: order.managedPostFactoryName,
    productImageUrl: order.skus[0]?.imageUrl || '',
    tagPrice: order.tagPrice,
    buyerName: order.buyerName,
    productionOrderType: order.productionOrderType,
    saleType: order.saleType,
    materials: order.qcPrintMaterials.map((item) => ({
      materialName: item.materialName,
      materialCode: item.materialCode,
      unitConsumption: item.unitConsumption,
      materialUsed: item.materialUsed,
      imageUrl: item.imageUrl,
    })),
    sizeHeaders: ['成衣尺寸', 'Panjang punggung tengah(后中长)', 'Lingkar Bahu(肩宽)', 'Lingkar Dada(胸围)', 'Panjang Lengan(袖长)', 'Cuff Tangan(袖口)'],
    sizeRows: order.qcPrintSizeRows.map((row) => [row.sizeName, row.backLength, row.shoulderWidth, row.bust, row.sleeveLength, row.cuff]),
  })
}

export function renderPostFinishingFullFlowPrintPage(): string {
  const type = (query().get('type') || '') as PrintType
  const id = query().get('id') || ''
  try {
    if (type === 'SKU_LABEL') return skuLabel(id, query().get('skuId') || '')
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
        `/fcs/pda/post-finishing/execute?id=${encodeURIComponent(task.postTaskNo)}`,
        [
          { label: '送货单 / 质检单', value: `${task.deliveryOrderNo} / ${task.qcTaskNo}` },
          { label: '生产单 / 第几次回货', value: `${task.productionOrderNo} / 第 ${task.returnIndex} 次` },
          { label: '后道工序', value: task.processItems.join('、') },
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
