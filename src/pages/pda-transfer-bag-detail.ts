import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  getTransferBagContentDisplayItems,
  getTransferBagScanSummaryByQr,
  listCuttingSewingTransferBags,
} from '../data/fcs/cutting/sewing-dispatch.ts'
import { renderPdaFrame } from './pda-shell'

function getQueryValue(name: string): string {
  const query = (appStore.getState().pathname.split('?')[1] || '')
  return new URLSearchParams(query).get(name) || ''
}

function getCurrentBagNo(routeBagNo?: string): string {
  return routeBagNo || getQueryValue('bagNo') || listCuttingSewingTransferBags()[0]?.transferBagNo || ''
}

export function renderPdaTransferBagDetailPage(routeBagNo?: string): string {
  const bagNo = getCurrentBagNo(routeBagNo)
  const summary = getTransferBagScanSummaryByQr(bagNo)
  const bag = listCuttingSewingTransferBags().find((item) => item.transferBagNo === bagNo)
  const contentItems = bag ? getTransferBagContentDisplayItems(bag.transferBagId) : summary?.contentItems || []

  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h1 class="text-lg font-semibold">中转袋详情</h1>
            <p class="mt-1 text-xs text-muted-foreground">扫袋后可查看袋内全部明细；裁床厂未交出前可调整，交出后只读。</p>
          </div>
          <span class="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">${escapeHtml(summary?.bagStatus || bag?.packStatus || '待装袋')}</span>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div><span class="text-muted-foreground">中转袋号：</span>${escapeHtml(summary?.transferBagNo || bagNo || '暂无数据')}</div>
          <div><span class="text-muted-foreground">生产单：</span>${escapeHtml(summary?.productionOrderNo || bag?.productionOrderNo || '暂无数据')}</div>
          <div><span class="text-muted-foreground">中转单：</span>${escapeHtml(summary?.transferOrderNo || bag?.transferOrderNo || '暂无数据')}</div>
          <div><span class="text-muted-foreground">来源工厂：</span>${escapeHtml(summary?.sourceFactoryName || '裁床厂')}</div>
          <div><span class="text-muted-foreground">接收工厂：</span>${escapeHtml(summary?.receiverFactoryName || bag?.sewingFactoryName || '车缝厂')}</div>
          <div><span class="text-muted-foreground">当前状态：</span>${escapeHtml(summary?.bagStatus || bag?.packStatus || '待装袋')}</div>
          <div><span class="text-muted-foreground">内容项数：</span>${escapeHtml(String(summary?.contentSummary.contentItemCount ?? bag?.contentItemCount ?? 0))}</div>
          <div><span class="text-muted-foreground">菲票数：</span>${escapeHtml(String(summary?.contentSummary.feiTicketCount ?? bag?.contentFeiTicketCount ?? 0))}</div>
        </div>
      </section>

      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold">袋内明细</h2>
          <span class="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">允许混装</span>
        </div>
        <div class="space-y-2">
          ${
            contentItems.length
              ? contentItems
                  .map(
                    (item) => `
                      <article class="rounded-xl border bg-background px-3 py-3 text-xs">
                        <div class="flex items-start justify-between gap-2">
                          <div class="font-medium">${escapeHtml(item.feiTicketNo || item.sourceNo || item.itemName)}</div>
                          <span class="rounded-full bg-muted px-2 py-0.5">${escapeHtml(item.contentType)}</span>
                        </div>
                        <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                          <div>菲票号：${escapeHtml(item.feiTicketNo || '-')}</div>
                          <div>颜色：${escapeHtml(item.colorName || '-')}</div>
                          <div>尺码：${escapeHtml(item.sizeCode || '-')}</div>
                          <div>部位：${escapeHtml(item.partName || '-')}</div>
                          <div>数量：${escapeHtml(String(item.currentQty))} ${escapeHtml(item.unit)}</div>
                          <div>已完成特殊工艺：${escapeHtml(item.completedSpecialCraftNames?.join(' / ') || '无')}</div>
                          ${item.sourceKind === 'LINE_ITEM' ? `<div>物料名称：${escapeHtml(item.materialName || item.itemName)}</div><div>SKU：${escapeHtml(item.materialSku || '-')}</div>` : ''}
                        </div>
                      </article>
                    `,
                  )
                  .join('')
              : '<div class="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">暂无袋内明细</div>'
          }
        </div>
      </section>
    </div>
  `

  return renderPdaFrame(content, 'handover', { headerTitle: '中转袋详情' })
}
