import {
  escapeHtml,
  resolveProductionSpuImageUrl,
  type ProductionOrder,
} from './context.ts'
import {
  listGarmentSpuReplacementsByProductionOrder,
  type GarmentReplacementIdentity,
  type GarmentSpuReplacementRecord,
} from '../../data/fcs/garment-spu-replacement.ts'

function formatQty(value: number): string {
  return `${Number(value || 0).toLocaleString('zh-CN')} 件`
}

function renderBusinessImage(identity: GarmentReplacementIdentity, className = 'h-12 w-12'): string {
  const label = `${identity.spuName} ${identity.color}/${identity.size}`
  return `<button
    type="button"
    class="group relative shrink-0 overflow-hidden rounded-md border bg-slate-50"
    data-pda-image-preview-url="${escapeHtml(identity.imageUrl)}"
    data-pda-image-preview-title="${escapeHtml(label)}"
    aria-label="查看${escapeHtml(label)}大图"
  >
    <img src="${escapeHtml(identity.imageUrl)}" alt="${escapeHtml(label)}" class="${className} object-cover" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
    <span hidden class="flex ${className} items-center justify-center p-1 text-center text-[10px] text-red-700">图片加载失败</span>
  </button>`
}

function renderOriginalDemand(order: ProductionOrder): string {
  const originalQty = order.demandSnapshot.skuLines.reduce((sum, line) => sum + Number(line.qty || 0), 0)
  const imageUrl = resolveProductionSpuImageUrl(order.demandSnapshot)
  return `<section class="rounded-lg border border-slate-200 bg-slate-50 p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="font-semibold">原生产需求（保持不变）</h3>
        <p class="mt-1 text-xs text-slate-500">成衣 SPU 替换只改变未完成销售出库成衣的当前身份，不改生产单需求、工厂和结算归属。</p>
      </div>
      <div class="rounded-md bg-white px-3 py-2 text-right shadow-sm">
        <div class="text-xs text-slate-500">生产单原数量</div>
        <strong class="tabular-nums">${formatQty(originalQty)}</strong>
      </div>
    </div>
    <div class="mt-4 flex items-center gap-3">
      <button type="button" class="group relative shrink-0 overflow-hidden rounded-md border bg-white" data-pda-image-preview-url="${escapeHtml(imageUrl)}" data-pda-image-preview-title="${escapeHtml(order.demandSnapshot.spuName)}" aria-label="查看${escapeHtml(order.demandSnapshot.spuName)}大图">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(order.demandSnapshot.spuName)}" class="h-14 w-14 object-cover" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
        <span hidden class="flex h-14 w-14 items-center justify-center p-1 text-center text-[10px] text-red-700">图片加载失败</span>
      </button>
      <div>
        <div class="font-mono font-semibold text-slate-900">${escapeHtml(order.demandSnapshot.spuCode)}</div>
        <div class="text-sm text-slate-600">${escapeHtml(order.demandSnapshot.spuName)}</div>
        <div class="mt-1 text-xs text-slate-500">生产单 ${escapeHtml(order.productionOrderNo)}</div>
      </div>
    </div>
  </section>`
}

function sumRecordQty(record: GarmentSpuReplacementRecord, key: 'soldHistoryQty' | 'finishedWarehouseQty' | 'postFactoryQty' | 'remainingReturnQty'): number {
  return record.lines.reduce((sum, line) => sum + Number(line[key] || 0), 0)
}

function renderQuantityCards(record: GarmentSpuReplacementRecord): string {
  const items = [
    ['已完成销售出库（历史）', sumRecordQty(record, 'soldHistoryQty'), '保留源 SPU / SKU，不执行换码'],
    ['成衣仓未售成衣', sumRecordQty(record, 'finishedWarehouseQty'), '由成衣仓完成旧出新入和实物换码'],
    ['后道工厂未入仓成衣', sumRecordQty(record, 'postFactoryQty'), '由后道工厂重新贴条码和吊牌'],
    ['生产单剩余待回货', sumRecordQty(record, 'remainingReturnQty'), '后续回货直接使用目标 SPU / SKU'],
  ] as const
  return `<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">${items.map(([label, qty, note]) => `<div class="rounded-md border bg-white p-3"><div class="text-xs text-slate-500">${escapeHtml(label)}</div><div class="mt-1 text-base font-semibold tabular-nums">${formatQty(qty)}</div><div class="mt-1 text-[11px] leading-4 text-slate-500">${escapeHtml(note)}</div></div>`).join('')}</div>`
}

function renderSkuMapping(record: GarmentSpuReplacementRecord): string {
  const rows = record.lines.map((line) => `<tr class="border-t">
    <td class="px-3 py-2 font-semibold">${escapeHtml(line.size)}</td>
    <td class="px-3 py-2"><div class="flex items-center gap-2">${renderBusinessImage(line.source, 'h-10 w-10')}<div><div class="font-mono text-xs">${escapeHtml(line.source.skuCode)}</div><div class="text-xs text-slate-500">${escapeHtml(line.source.color)}</div></div></div></td>
    <td class="px-3 py-2"><div class="flex items-center gap-2">${renderBusinessImage(line.target, 'h-10 w-10')}<div><div class="font-mono text-xs font-semibold text-blue-700">${escapeHtml(line.target.skuCode)}</div><div class="text-xs text-slate-500">${escapeHtml(line.target.color)}</div></div></div></td>
    <td class="px-3 py-2 text-right tabular-nums">${formatQty(line.soldHistoryQty)}</td>
    <td class="px-3 py-2 text-right tabular-nums">${formatQty(line.finishedWarehouseQty)}</td>
    <td class="px-3 py-2 text-right tabular-nums">${formatQty(line.postFactoryQty)}</td>
    <td class="px-3 py-2 text-right tabular-nums">${formatQty(line.remainingReturnQty)}</td>
  </tr>`).join('')
  return `<div class="overflow-x-auto rounded-lg border bg-white">
    <table class="w-full min-w-[980px] text-left text-sm">
      <thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="px-3 py-2">尺码</th><th class="px-3 py-2">原 SKU</th><th class="px-3 py-2">目标 SKU</th><th class="px-3 py-2 text-right">已完成销售出库（历史）</th><th class="px-3 py-2 text-right">成衣仓未售成衣</th><th class="px-3 py-2 text-right">后道工厂未入仓成衣</th><th class="px-3 py-2 text-right">生产单剩余待回货</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`
}

function renderReplacementRecord(record: GarmentSpuReplacementRecord): string {
  const sourceIdentity = record.lines[0]?.source
  const targetIdentity = record.lines[0]?.target
  const statusLabel = record.status === 'COMPLETED' ? '已完成' : '换码中'
  const statusClass = record.status === 'COMPLETED'
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-amber-50 text-amber-800'
  return `<article class="space-y-4 rounded-lg border bg-white p-4" data-production-order-garment-replacement-record="${escapeHtml(record.replacementId)}">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div class="flex flex-wrap items-center gap-2"><h3 class="font-semibold">${escapeHtml(record.replacementNo)}</h3><span class="rounded-full px-2 py-1 text-xs font-medium ${statusClass}">${statusLabel}</span></div>
        <p class="mt-1 text-xs text-slate-500">发起：${escapeHtml(record.createdBy)} · ${escapeHtml(record.createdAt)} · 原因：${escapeHtml(record.reason)}</p>
      </div>
      <div class="text-right text-xs text-slate-500">替换范围：生产单 + ${escapeHtml(record.sourceColor)} 色</div>
    </div>
    <div class="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
      <div class="flex items-center gap-3 rounded-lg border bg-slate-50 p-3">
        ${sourceIdentity ? renderBusinessImage(sourceIdentity, 'h-14 w-14') : ''}
        <div><div class="text-xs text-slate-500">原 SPU / 源颜色</div><div class="font-mono font-semibold">${escapeHtml(record.sourceSpuCode)}</div><div class="text-sm text-slate-600">${escapeHtml(record.sourceSpuName)} · ${escapeHtml(record.sourceColor)}</div></div>
      </div>
      <div class="text-center text-blue-700"><div class="text-xl">→</div><div class="text-xs font-medium">整色替换并同步 SKU</div></div>
      <div class="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
        ${targetIdentity ? renderBusinessImage(targetIdentity, 'h-14 w-14') : ''}
        <div><div class="text-xs text-blue-700">目标 SPU / 目标颜色</div><div class="font-mono font-semibold text-blue-900">${escapeHtml(record.targetSpuCode)}</div><div class="text-sm text-blue-800">${escapeHtml(record.targetSpuName)} · ${escapeHtml(record.targetColor)}</div></div>
      </div>
    </div>
    ${renderQuantityCards(record)}
    ${renderSkuMapping(record)}
  </article>`
}

export function getProductionOrderGarmentReplacementRecords(order: ProductionOrder): GarmentSpuReplacementRecord[] {
  return listGarmentSpuReplacementsByProductionOrder(order.productionOrderId)
}

export function renderProductionOrderGarmentReplacementMarker(order: ProductionOrder): string {
  const records = getProductionOrderGarmentReplacementRecords(order)
  if (!records.length) return ''
  return `<button type="button" class="mt-2 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100" data-prod-action="open-order-garment-replacement-dialog" data-order-id="${escapeHtml(order.productionOrderId)}" aria-label="存在成衣 SPU 替换" title="查看 ${records.length} 条成衣 SPU 替换记录"><i data-lucide="refresh-cw" class="h-3.5 w-3.5"></i>存在成衣 SPU 替换</button>`
}

export function renderProductionOrderGarmentReplacementDetails(order: ProductionOrder): string {
  const records = getProductionOrderGarmentReplacementRecords(order)
  if (!records.length) return ''
  return `<div class="space-y-4" data-production-order-garment-replacement-details="${escapeHtml(order.productionOrderId)}">${renderOriginalDemand(order)}${records.map(renderReplacementRecord).join('')}</div>`
}

export function renderProductionOrderGarmentReplacementSection(order: ProductionOrder): string {
  const details = renderProductionOrderGarmentReplacementDetails(order)
  if (!details) return ''
  return `<section class="rounded-lg border bg-card p-4" data-production-order-garment-replacement-section="true"><div class="mb-4"><h3 class="text-base font-semibold">成衣 SPU 替换</h3><p class="mt-1 text-xs text-muted-foreground">原生产需求保持不变；这里单独展示已发生的源／目标 SPU、SKU 映射和对应数量。</p></div>${details}</section>`
}
