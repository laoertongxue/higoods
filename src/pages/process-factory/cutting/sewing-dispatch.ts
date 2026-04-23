import { escapeHtml } from '../../../utils'
import { renderRealQrPlaceholder } from '../../../components/real-qr'
import {
  assertSewingDispatchAllowed,
  getCuttingSewingDispatchSummary,
  getEligibleFeiTicketsForSewingDispatch,
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
  listCuttingSewingDispatchValidationResults,
  listCuttingSewingTransferBags,
  type CuttingSewingDispatchBatch,
  type CuttingSewingDispatchOrder,
  type CuttingSewingTransferBag,
} from '../../../data/fcs/cutting/sewing-dispatch.ts'
import { buildSewingDispatchProgressSnapshot } from '../../../data/fcs/progress-statistics-linkage.ts'
import { productionOrders } from '../../../data/fcs/production-orders.ts'
import {
  renderCompactKpiCard,
  renderStickyTableScroller,
} from './layout.helpers'
import {
  getCanonicalCuttingMeta,
  getCanonicalCuttingPath,
  isCuttingAliasPath,
  renderCuttingPageHeader,
} from './meta'

function renderBadge(label: string, className = 'bg-slate-100 text-slate-700'): string {
  return `<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function statusClass(status: string): string {
  if (status.includes('已回写') || status.includes('可交出') || status.includes('已配齐')) return 'bg-emerald-100 text-emerald-700'
  if (status.includes('差异') || status.includes('异议')) return 'bg-rose-100 text-rose-700'
  if (status.includes('未配齐') || status.includes('待')) return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-700'
}

function renderSkuLines(batch: CuttingSewingDispatchBatch): string {
  return batch.plannedSkuQtyLines
    .map((line) => `${line.colorName} / ${line.sizeCode} / ${line.plannedGarmentQty} 件`)
    .map(escapeHtml)
    .join('<br />')
}

function renderHeader(): string {
  const meta = getCanonicalCuttingMeta('sewing-dispatch')
  return renderCuttingPageHeader({
    title: meta.pageTitle,
    subtitle: '裁床厂按本次发料件数齐套、生成中转单与中转袋，并复用现有交出记录交给车缝厂。',
    actions: [
      {
        label: '查看中转袋',
        href: getCanonicalCuttingPath('transfer-bags'),
      },
      {
        label: '查看交接',
        href: '/fcs/pda/handover',
      },
    ],
  })
}

function renderFilterBar(): string {
  return `
    <section class="rounded-xl border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${['生产单', '裁片单', '车缝厂', '关键字']
          .map(
            (label) => `
              <label class="space-y-1">
                <span class="text-xs font-medium text-muted-foreground">${escapeHtml(label)}</span>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="输入${escapeHtml(label)}" />
              </label>
            `,
          )
          .join('')}
        ${['发料状态', '回写状态', '是否配齐', '是否存在特殊工艺未回仓']
          .map(
            (label) => `
              <label class="space-y-1">
                <span class="text-xs font-medium text-muted-foreground">${escapeHtml(label)}</span>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  <option>全部</option>
                  <option>草稿</option>
                  <option>待配齐</option>
                  <option>待扫码</option>
                  <option>可交出</option>
                  <option>已交出</option>
                  <option>已回写</option>
                  <option>差异</option>
                  <option>异议中</option>
                </select>
              </label>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderKpis(): string {
  const summary = getCuttingSewingDispatchSummary()
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
      ${renderCompactKpiCard('待配齐发料单', summary.waitingCompleteOrderCount, '', 'text-amber-600')}
      ${renderCompactKpiCard('可交出批次', summary.readyBatchCount, '', 'text-emerald-600')}
      ${renderCompactKpiCard('已交出批次', summary.handedOverBatchCount, '', 'text-blue-600')}
      ${renderCompactKpiCard('已回写批次', summary.writtenBackBatchCount, '', 'text-emerald-600')}
      ${renderCompactKpiCard('差异批次', summary.differenceBatchCount, '', 'text-rose-600')}
      ${renderCompactKpiCard('异议中批次', summary.objectionBatchCount, '', 'text-rose-600')}
      ${renderCompactKpiCard('剩余未发件数', summary.remainingGarmentQty, '', 'text-slate-700')}
    </section>
  `
}

function renderProgressLinkage(): string {
  const snapshots = productionOrders.map((order) => buildSewingDispatchProgressSnapshot(order))
  const total = snapshots.reduce(
    (result, item) => {
      result.cumulativeDispatchedGarmentQty += item.cumulativeDispatchedGarmentQty
      result.remainingGarmentQty += item.remainingGarmentQty
      result.transferBagCount += item.transferBagCount
      result.completedTransferBagCount += item.completedTransferBagCount
      result.dispatchedTransferBagCount += item.dispatchedTransferBagCount
      result.writtenBackTransferBagCount += item.writtenBackTransferBagCount
      item.blockingReasons.forEach((reason) => result.blockingReasons.add(reason))
      return result
    },
    {
      cumulativeDispatchedGarmentQty: 0,
      remainingGarmentQty: 0,
      transferBagCount: 0,
      completedTransferBagCount: 0,
      dispatchedTransferBagCount: 0,
      writtenBackTransferBagCount: 0,
      blockingReasons: new Set<string>(),
    },
  )
  const blockingReasons = Array.from(total.blockingReasons)
  return `
    <section class="rounded-xl border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold">裁片发料进度</h2>
          <p class="mt-1 text-xs text-muted-foreground">本页发料单、中转单、中转袋、齐套校验和回写差异会进入生产进度总览。</p>
        </div>
        ${renderBadge(blockingReasons.length ? '阻塞生产单' : '不阻塞生产单', blockingReasons.length ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        ${renderCompactKpiCard('累计已发件数', total.cumulativeDispatchedGarmentQty, '', 'text-blue-600')}
        ${renderCompactKpiCard('剩余未发件数', total.remainingGarmentQty, '', 'text-amber-600')}
        ${renderCompactKpiCard('中转袋数', total.transferBagCount, '', 'text-slate-700')}
        ${renderCompactKpiCard('已配齐中转袋数', total.completedTransferBagCount, '', 'text-emerald-600')}
        ${renderCompactKpiCard('已交出中转袋数', total.dispatchedTransferBagCount, '', 'text-blue-600')}
        ${renderCompactKpiCard('阻塞原因', blockingReasons.length ? blockingReasons.slice(0, 2).join('、') : '无', '中转袋未配齐时不可交出', 'text-amber-600')}
      </div>
    </section>
  `
}

function renderTabs(): string {
  return `
    <section class="rounded-xl border bg-card p-2">
      <div class="flex flex-wrap gap-2 text-sm">
        ${['发料单', '中转单', '中转袋', '齐套校验', '交出记录', '回写差异']
          .map((label, index) => `<span class="rounded-lg px-3 py-2 ${index === 0 ? 'bg-blue-600 text-white' : 'bg-muted text-foreground'}">${escapeHtml(label)}</span>`)
          .join('')}
      </div>
    </section>
  `
}

function renderDispatchOrders(orders: CuttingSewingDispatchOrder[]): string {
  return `
    <section class="rounded-xl border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">发料单</h2>
          <p class="mt-1 text-xs text-muted-foreground">发料单只表示裁床厂本次发车缝业务批次，不能替代交出单。</p>
        </div>
        <button class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white">新增本次发料</button>
      </div>
      ${renderStickyTableScroller(`
        <table class="min-w-[1320px] w-full text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              ${['发料单号', '生产单', '裁片单', '裁床厂', '车缝厂', '生产总数', '累计已发件数', '剩余未发件数', '本次发料批次数', '中转袋数', '菲票数', '配齐状态', '发料状态', '回写状态', '操作']
                .map((label) => `<th class="px-3 py-3 text-left font-medium">${escapeHtml(label)}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${orders
              .map(
                (order) => `
                  <tr class="border-t">
                    <td class="px-3 py-3 font-medium text-blue-700">${escapeHtml(order.dispatchOrderNo)}</td>
                    <td class="px-3 py-3">${escapeHtml(order.productionOrderNo)}</td>
                    <td class="px-3 py-3">${escapeHtml(order.cuttingOrderNos.join('、') || '暂无数据')}</td>
                    <td class="px-3 py-3">${escapeHtml(order.cuttingFactoryName)}</td>
                    <td class="px-3 py-3">${escapeHtml(order.sewingFactoryName)}</td>
                    <td class="px-3 py-3">${escapeHtml(String(order.totalProductionQty))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(order.cumulativeDispatchedGarmentQty))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(order.remainingGarmentQty))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(order.dispatchBatchIds.length))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(order.transferBagIds.length))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(order.feiTicketNos.length))}</td>
                    <td class="px-3 py-3">${renderBadge(order.validationStatus, statusClass(order.validationStatus))}</td>
                    <td class="px-3 py-3">${renderBadge(order.status, statusClass(order.status))}</td>
                    <td class="px-3 py-3">${escapeHtml(order.receiverWrittenQty === undefined ? '待回写' : order.differenceQty ? '差异' : '已回写')}</td>
                    <td class="px-3 py-3">
                      <div class="flex flex-wrap gap-2">
                        <button class="rounded-md border px-2 py-1 text-xs">查看</button>
                        <button class="rounded-md border px-2 py-1 text-xs">新增本次发料</button>
                        <button class="rounded-md border px-2 py-1 text-xs">查看中转单</button>
                        <button class="rounded-md border px-2 py-1 text-xs">查看中转袋</button>
                        <button class="rounded-md border px-2 py-1 text-xs">查看齐套校验</button>
                        <button class="rounded-md border px-2 py-1 text-xs">查看交出记录</button>
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      `)}
    </section>
  `
}

function renderBatchRows(batches: CuttingSewingDispatchBatch[], bags: CuttingSewingTransferBag[]): string {
  return `
    <section class="rounded-xl border bg-card">
      <div class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold">中转单</h2>
        <p class="mt-1 text-xs text-muted-foreground">中转单用于裁片配齐与装袋批次，提交交出时复用现有交出记录。</p>
      </div>
      ${renderStickyTableScroller(`
        <table class="min-w-[1180px] w-full text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              ${['中转单号', '发料单号', '生产单', '车缝厂', '本次发料件数', '颜色 / 尺码', '中转袋数', '已配齐中转袋数', '菲票数', '齐套状态', '交出记录', '状态', '二维码', '操作']
                .map((label) => `<th class="px-3 py-3 text-left font-medium">${escapeHtml(label)}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${batches
              .map((batch) => {
                const batchBags = bags.filter((bag) => batch.transferBagIds.includes(bag.transferBagId))
                const order = listCuttingSewingDispatchOrders().find((item) => item.dispatchOrderId === batch.dispatchOrderId)
                return `
                  <tr class="border-t">
                    <td class="px-3 py-3 font-medium text-blue-700">${escapeHtml(batch.transferOrderNo)}</td>
                    <td class="px-3 py-3">${escapeHtml(order?.dispatchOrderNo || batch.dispatchOrderId)}</td>
                    <td class="px-3 py-3">${escapeHtml(batch.productionOrderNo)}</td>
                    <td class="px-3 py-3">${escapeHtml(order?.sewingFactoryName || '车缝厂')}</td>
                    <td class="px-3 py-3">${escapeHtml(String(batch.plannedGarmentQty))}</td>
                    <td class="px-3 py-3">${renderSkuLines(batch)}</td>
                    <td class="px-3 py-3">${escapeHtml(String(batch.transferBagIds.length))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(batchBags.filter((bag) => bag.completeStatus === '已配齐').length))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(batch.feiTicketNos.length))}</td>
                    <td class="px-3 py-3">${renderBadge(batch.completeStatus, statusClass(batch.completeStatus))}</td>
                    <td class="px-3 py-3">${escapeHtml(batch.handoverRecordNo || '未交出')}</td>
                    <td class="px-3 py-3">${renderBadge(batch.status, statusClass(batch.status))}</td>
                    <td class="px-3 py-3">${renderRealQrPlaceholder({ value: batch.transferOrderQrValue, size: 72, title: '中转单二维码', label: `中转单 ${batch.transferOrderNo}` })}</td>
                    <td class="px-3 py-3">
                      <div class="flex flex-wrap gap-2">
                        <button class="rounded-md border px-2 py-1 text-xs">查看</button>
                        <button class="rounded-md border px-2 py-1 text-xs">生成中转袋</button>
                        <button class="rounded-md border px-2 py-1 text-xs">打印 / 预览中转单</button>
                        <button class="rounded-md border px-2 py-1 text-xs">查看二维码</button>
                        <button class="rounded-md border px-2 py-1 text-xs">查看齐套校验</button>
                        <button class="rounded-md border px-2 py-1 text-xs">提交交出</button>
                      </div>
                    </td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      `)}
    </section>
  `
}

function renderTransferBagRows(bags: CuttingSewingTransferBag[]): string {
  return `
    <section class="rounded-xl border bg-card">
      <div class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold">中转袋</h2>
        <p class="mt-1 text-xs text-muted-foreground">中转袋正式支持混装，允许混装；已装袋未交出可调整，发料批次仍按整体齐套校验后交出。</p>
      </div>
      ${renderStickyTableScroller(`
        <table class="min-w-[1240px] w-full text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              ${['中转袋号', '中转单号', '生产单', '车缝厂', '是否混装', '装袋状态', '内容项数', '菲票数', '当前所在', '颜色', '尺码', '本袋件数', '应配部位数', '已配部位数', '齐套状态', '发料状态', '回写状态', '差异数量', '二维码', '操作']
                .map((label) => `<th class="px-3 py-3 text-left font-medium">${escapeHtml(label)}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${bags
              .map(
                (bag) => `
                  <tr class="border-t">
                    <td class="px-3 py-3 font-medium text-blue-700">${escapeHtml(bag.transferBagNo)}</td>
                    <td class="px-3 py-3">${escapeHtml(bag.transferOrderNo)}</td>
                    <td class="px-3 py-3">${escapeHtml(bag.productionOrderNo)}</td>
                    <td class="px-3 py-3">${escapeHtml(bag.sewingFactoryName)}</td>
                    <td class="px-3 py-3">${escapeHtml(bag.bagMode || '混装')}</td>
                    <td class="px-3 py-3">${renderBadge(bag.packStatus || bag.status, statusClass(bag.packStatus || bag.status))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(bag.contentItemCount || bag.scannedFeiTicketNos.length))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(bag.contentFeiTicketCount || bag.scannedFeiTicketNos.length))}</td>
                    <td class="px-3 py-3">${escapeHtml(bag.currentLocation || '裁床厂待交出')}</td>
                    <td class="px-3 py-3">${escapeHtml(unique(bag.skuQtyLines.map((line) => line.colorName)).join('、'))}</td>
                    <td class="px-3 py-3">${escapeHtml(unique(bag.skuQtyLines.map((line) => line.sizeCode)).join('、'))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(bag.plannedGarmentQty))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(bag.pieceLines.length))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(bag.pieceLines.filter((line) => line.completeStatus === '已配齐').length))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(bag.scannedFeiTicketNos.length))}</td>
                    <td class="px-3 py-3">${renderBadge(bag.completeStatus, statusClass(bag.completeStatus))}</td>
                    <td class="px-3 py-3">${renderBadge(bag.dispatchStatus, statusClass(bag.dispatchStatus))}</td>
                    <td class="px-3 py-3">${escapeHtml(bag.receiverWrittenQty === undefined ? '待回写' : bag.differenceQty ? '差异' : '已回写')}</td>
                    <td class="px-3 py-3">${escapeHtml(String(bag.differenceQty || 0))}</td>
                    <td class="px-3 py-3">${renderRealQrPlaceholder({ value: bag.transferBagQrValue, size: 64, title: '中转袋二维码', label: `中转袋 ${bag.transferBagNo}` })}</td>
                    <td class="px-3 py-3">
                      <div class="flex flex-wrap gap-2">
                        <button class="rounded-md border px-2 py-1 text-xs">查看袋内明细</button>
                        <button class="rounded-md border px-2 py-1 text-xs">扫菲票装袋</button>
                        <button class="rounded-md border px-2 py-1 text-xs">移除菲票</button>
                        <button class="rounded-md border px-2 py-1 text-xs">已装袋未交出可调整</button>
                        <button class="rounded-md border px-2 py-1 text-xs">查看齐套</button>
                        <button class="rounded-md border px-2 py-1 text-xs">查看二维码</button>
                        <button class="rounded-md border px-2 py-1 text-xs">打印袋码</button>
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      `)}
    </section>
  `
}

function renderValidationRows(): string {
  const rows = listCuttingSewingDispatchValidationResults()
  return `
    <section class="rounded-xl border bg-card">
      <div class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold">齐套校验</h2>
        <p class="mt-1 text-xs text-muted-foreground">缺少裁片、裁片超出、特殊工艺未回仓、差异或异议中均会阻塞提交交出。</p>
      </div>
      ${renderStickyTableScroller(`
        <table class="min-w-[1120px] w-full text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              ${['中转袋号', '颜色', '尺码', '裁片部位', '每件片数', '本袋件数', '应配数量', '已扫码数量', '缺少数量', '超出数量', '特殊工艺状态', '校验结果', '阻塞原因', '操作']
                .map((label) => `<th class="px-3 py-3 text-left font-medium">${escapeHtml(label)}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const bag = listCuttingSewingTransferBags().find((item) => item.transferBagId === row.transferBagId)
                const pieceLine = bag?.pieceLines.find((line) => line.partName === row.partName && line.colorName === row.colorName && line.sizeCode === row.sizeCode)
                return `
                  <tr class="border-t">
                    <td class="px-3 py-3">${escapeHtml(bag?.transferBagNo || row.transferBagId)}</td>
                    <td class="px-3 py-3">${escapeHtml(row.colorName)}</td>
                    <td class="px-3 py-3">${escapeHtml(row.sizeCode)}</td>
                    <td class="px-3 py-3">${escapeHtml(row.partName)}</td>
                    <td class="px-3 py-3">${escapeHtml(String(pieceLine?.pieceCountPerGarment || 0))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(pieceLine?.garmentQty || 0))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(row.requiredPieceQty))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(row.scannedPieceQty))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(row.missingPieceQty))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(row.overPieceQty))}</td>
                    <td class="px-3 py-3">${escapeHtml(row.specialCraftStatus)}</td>
                    <td class="px-3 py-3">${renderBadge(row.validationType, statusClass(row.validationType))}</td>
                    <td class="px-3 py-3">${escapeHtml(row.blocking ? row.validationMessage : '无')}</td>
                    <td class="px-3 py-3">
                      <div class="flex flex-wrap gap-2">
                        <button class="rounded-md border px-2 py-1 text-xs">查看菲票</button>
                        <button class="rounded-md border px-2 py-1 text-xs">查看特殊工艺状态</button>
                        <button class="rounded-md border px-2 py-1 text-xs">返回中转袋调整</button>
                      </div>
                    </td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      `)}
    </section>
  `
}

function renderHandoverRows(batches: CuttingSewingDispatchBatch[], bags: CuttingSewingTransferBag[]): string {
  const submitted = batches.filter((batch) => batch.handoverRecordNo)
  return `
    <section class="rounded-xl border bg-card">
      <div class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold">交出记录</h2>
        <p class="mt-1 text-xs text-muted-foreground">交出记录来自现有交接链路，页面只显示业务编号和二维码图。</p>
      </div>
      ${submitted.length === 0 ? '<div class="p-6 text-sm text-muted-foreground">暂无数据</div>' : renderStickyTableScroller(`
        <table class="min-w-[1180px] w-full text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              ${['交出单', '交出记录', '中转单', '中转袋数', '菲票数', '本次发料件数', '裁片数量', '裁床厂', '车缝厂', '交出二维码', '交出时间', '回写数量', '差异数量', '状态', '操作']
                .map((label) => `<th class="px-3 py-3 text-left font-medium">${escapeHtml(label)}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${submitted
              .map((batch) => {
                const order = listCuttingSewingDispatchOrders().find((item) => item.dispatchOrderId === batch.dispatchOrderId)
                const batchBags = bags.filter((bag) => batch.transferBagIds.includes(bag.transferBagId))
                return `
                  <tr class="border-t">
                    <td class="px-3 py-3">${escapeHtml(order?.handoverOrderNo || '已创建')}</td>
                    <td class="px-3 py-3 font-medium text-blue-700">${escapeHtml(batch.handoverRecordNo || '')}</td>
                    <td class="px-3 py-3">${escapeHtml(batch.transferOrderNo)}</td>
                    <td class="px-3 py-3">${escapeHtml(String(batchBags.length))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(batch.feiTicketNos.length))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(batch.plannedGarmentQty))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(batchBags.reduce((total, bag) => total + bag.pieceLines.reduce((sum, line) => sum + line.scannedPieceQty, 0), 0)))}</td>
                    <td class="px-3 py-3">${escapeHtml(order?.cuttingFactoryName || '裁床厂')}</td>
                    <td class="px-3 py-3">${escapeHtml(order?.sewingFactoryName || '车缝厂')}</td>
                    <td class="px-3 py-3">交出二维码</td>
                    <td class="px-3 py-3">${escapeHtml(batch.updatedAt)}</td>
                    <td class="px-3 py-3">${escapeHtml(batch.receiverWrittenQty === undefined ? '待回写' : String(batch.receiverWrittenQty))}</td>
                    <td class="px-3 py-3">${escapeHtml(String(batch.differenceQty || 0))}</td>
                    <td class="px-3 py-3">${renderBadge(batch.status, statusClass(batch.status))}</td>
                    <td class="px-3 py-3">
                      <div class="flex flex-wrap gap-2">
                        <button class="rounded-md border px-2 py-1 text-xs">查看交出记录</button>
                        <button class="rounded-md border px-2 py-1 text-xs">查看回写</button>
                        <button class="rounded-md border px-2 py-1 text-xs">查看异议</button>
                      </div>
                    </td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      `)}
    </section>
  `
}

function renderWritebackRows(batches: CuttingSewingDispatchBatch[], bags: CuttingSewingTransferBag[]): string {
  const submitted = batches.filter((batch) => batch.handoverRecordNo)
  return `
    <section class="rounded-xl border bg-card">
      <div class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold">回写差异</h2>
        <p class="mt-1 text-xs text-muted-foreground">回写来自现有接收方回写，异议来自现有数量异议链路。</p>
      </div>
      ${renderStickyTableScroller(`
        <table class="min-w-[980px] w-full text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              ${['中转单', '中转袋', '交出记录', '车缝厂', '按袋回写', '按菲票回写', '应收件数', '实收件数', '应收菲票数', '实收菲票数', '差异数量', '差异原因', '异议状态', '是否阻塞生产单', '操作']
                .map((label) => `<th class="px-3 py-3 text-left font-medium">${escapeHtml(label)}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${submitted
              .map((batch) => {
                const order = listCuttingSewingDispatchOrders().find((item) => item.dispatchOrderId === batch.dispatchOrderId)
                const batchBags = bags.filter((bag) => batch.transferBagIds.includes(bag.transferBagId))
                return batchBags
                  .map(
                    (bag) => `
                      <tr class="border-t">
                        <td class="px-3 py-3">${escapeHtml(batch.transferOrderNo)}</td>
                        <td class="px-3 py-3">${escapeHtml(bag.transferBagNo)}</td>
                        <td class="px-3 py-3">${escapeHtml(batch.handoverRecordNo || '')}</td>
                        <td class="px-3 py-3">${escapeHtml(order?.sewingFactoryName || '车缝厂')}</td>
                        <td class="px-3 py-3">${escapeHtml(bag.receivedAt ? '已收袋' : '待收袋')}</td>
                        <td class="px-3 py-3">${escapeHtml(bag.receivedFeiTicketCount === undefined ? '待回写' : `${bag.receivedFeiTicketCount}/${bag.contentFeiTicketCount || bag.scannedFeiTicketNos.length}`)}</td>
                        <td class="px-3 py-3">${escapeHtml(String(batch.plannedGarmentQty))}</td>
                        <td class="px-3 py-3">${escapeHtml(bag.receiverWrittenQty === undefined ? '待回写' : String(bag.receiverWrittenQty))}</td>
                        <td class="px-3 py-3">${escapeHtml(String(bag.scannedFeiTicketNos.length))}</td>
                        <td class="px-3 py-3">${escapeHtml(bag.receiverWrittenQty === undefined ? '待回写' : String(bag.scannedFeiTicketNos.length))}</td>
                        <td class="px-3 py-3">${escapeHtml(String(bag.differenceQty || 0))}</td>
                        <td class="px-3 py-3">${escapeHtml(bag.differenceQty ? '数量不符' : '无')}</td>
                        <td class="px-3 py-3">${escapeHtml(bag.status === '异议中' ? '异议中' : '无')}</td>
                        <td class="px-3 py-3">${escapeHtml(bag.differenceQty || bag.status === '异议中' ? '阻塞生产单' : '不阻塞生产单')}</td>
                        <td class="px-3 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button class="rounded-md border px-2 py-1 text-xs">查看差异</button>
                            <button class="rounded-md border px-2 py-1 text-xs">查看异议</button>
                            <button class="rounded-md border px-2 py-1 text-xs">查看交出记录</button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join('')
              })
              .join('')}
          </tbody>
        </table>
      `)}
    </section>
  `
}

function renderNewBatchDemo(): string {
  const eligible = getEligibleFeiTicketsForSewingDispatch({ productionOrderId: 'PO-202603-081', colorName: 'Black', sizeCode: 'L' })
  let canSubmitText = '不可交出'
  try {
    assertSewingDispatchAllowed('CSDB-PO-202603-081-02')
    canSubmitText = '可交出'
  } catch {
    canSubmitText = '不可交出'
  }
  return `
    <section class="rounded-xl border bg-blue-50 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-blue-950">新增本次发料</h2>
          <p class="mt-1 text-xs text-blue-700">生产单只读，按颜色 / 尺码填写本次发料件数；生成中转单后进入待扫码。</p>
        </div>
        ${renderBadge(canSubmitText, canSubmitText === '可交出' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
        <div class="rounded-lg bg-white p-3"><div class="text-xs text-muted-foreground">生产单</div><div class="mt-1 font-medium">PO-202603-081</div></div>
        <div class="rounded-lg bg-white p-3"><div class="text-xs text-muted-foreground">车缝厂</div><div class="mt-1 font-medium">车缝厂</div></div>
        <div class="rounded-lg bg-white p-3"><div class="text-xs text-muted-foreground">本次发料件数</div><div class="mt-1 font-medium">Black / L / 1 件</div></div>
        <div class="rounded-lg bg-white p-3"><div class="text-xs text-muted-foreground">可用菲票数量</div><div class="mt-1 font-medium">${eligible.length} 张</div></div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white">生成中转单</button>
        <button class="rounded-md border bg-white px-3 py-2 text-sm">取消</button>
      </div>
    </section>
  `
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

export function renderCraftCuttingSewingDispatchPage(): string {
  if (typeof window !== 'undefined' && isCuttingAliasPath('sewing-dispatch', window.location.pathname)) {
    window.history.replaceState({}, '', getCanonicalCuttingPath('sewing-dispatch'))
  }
  const orders = listCuttingSewingDispatchOrders()
  const batches = listCuttingSewingDispatchBatches()
  const bags = listCuttingSewingTransferBags()

  return `
    <main class="space-y-4 p-4">
      ${renderHeader()}
      ${renderFilterBar()}
      ${renderKpis()}
      ${renderProgressLinkage()}
      ${renderTabs()}
      ${renderNewBatchDemo()}
      ${renderDispatchOrders(orders)}
      ${renderBatchRows(batches, bags)}
      ${renderTransferBagRows(bags)}
      ${renderValidationRows()}
      ${renderHandoverRows(batches, bags)}
      ${renderWritebackRows(batches, bags)}
    </main>
  `
}
