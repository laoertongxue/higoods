import { washingImage, installWashingImages } from '../../process-factory/dyeing/washing/work-orders.ts'
// @page-pattern: dashboard
import { escapeHtml as e } from '../../../utils.ts'
import { readWashingState } from '../../../data/fcs/fabric-washing-repository.ts'
import { WASHING_ROUTE, washingWarehouseStock } from '../../../data/fcs/fabric-washing.ts'
/** Explicit washing stock, grouped in original units; no copied WLS inventory fact. */
export function renderWashingWarehouseSection():string {
 const orders=readWashingState().orders.filter(o=>o.source.target?.warehouseId&&o.rolls.some(r=>r.handedOutAt)),stock=washingWarehouseStock()
 if(!orders.length)return ''
 installWashingImages()
 return `<section class="m-4 space-y-3 rounded-lg border bg-white p-4" data-washing-warehouse-section><h2 class="font-semibold">洗水面料交回与本仓实收</h2>${orders.map(o=>`<article class="flex flex-wrap items-start gap-3 rounded border p-3">${washingImage(o.source.imageUrl,o.source.materialName)}<div class="min-w-0 break-words"><a class="text-blue-700" href="${WASHING_ROUTE}/${encodeURIComponent(o.id)}" data-nav="${WASHING_ROUTE}/${encodeURIComponent(o.id)}">${e(o.no)}</a><p>${e(o.source.materialName)} · ${e(o.source.materialSku)}</p><p>目标仓：${e(o.source.target!.name)} · ${e(o.handFeel)}</p>${o.rolls.filter(r=>r.handedOutAt).map(r=>`<p>${e(r.outputBarcode||r.barcode)} · 交回 ${r.outputQty} ${e(r.unit)} · ${r.downstreamReceivedAt?`实际接收 ${r.downstreamQty} ${e(r.unit)} · ${e(r.downstreamLocationId||'')}`:'待本仓逐卷实收'}</p>`).join('')}${o.exception?'<p class="text-red-700">异常待核对，暂不可用</p>':''}</div></article>`).join('')}<p class="text-sm">当前本仓实收 ${stock.length} 卷；按各卷原单位展示，未实收不计入本仓实物。</p></section>`
}
