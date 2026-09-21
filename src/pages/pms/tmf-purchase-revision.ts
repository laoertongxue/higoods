import { renderDialog } from '../../components/ui/dialog.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { getTmfPurchaseReturnBalance, getTmfMaterialPurchase, getTmfPurchaseState } from '../../data/pms/tmf-material-purchases.ts'
import { escapeHtml as e } from '../../utils.ts'
import { renderPmsBusinessImage } from './shared.ts'

export function renderTmfPurchaseRevision(orderNo: string): string {
  const order = getTmfMaterialPurchase(orderNo)
  if (!order) return '<p role="alert">基础采购不存在，请关闭后重新核对。</p>'
  const base = getTmfPurchaseState().baseOrders.find(b => b.purchaseOrderNo === orderNo)
  return renderDialog({title:'变更基础采购数量',width:'lg',closeAction:{prefix:'pms-mpo',action:'close-overlay',skipPageRerender:true}},`
    <div data-tmf-purchase-revision data-version="${order.version}" class="space-y-3">
      <p>${e(orderNo)} · V${order.version}</p>
      <div class="flex items-center gap-3">${renderPmsBusinessImage(order.materialImageUrl,`${order.materialName}半成品参考图`,'h-12 w-12')}<span>${e(order.materialName)} · ${e(order.materialSkuId)}</span></div>
      <p>当前采购 ${order.orderedQty} 米；实际到货 ${order.receivedQty} 米；基础已产出 ${base?.producedMeters ?? 0} 米。</p>
      <p class="text-sm text-amber-700">${base?.startedAt ? '已开始生产：保存后进入变更待处理，原产出、交出、实收及库存均保留；须先完成处置。' : '尚未开始生产：基础计划同步新数量，保留版本。已接单的需重新核对接单。'}</p>
      <label class="block text-sm">变更后采购数量（米）<input name="orderedQty" type="number" min="0.001" step="0.001" value="${order.orderedQty}" class="mt-1 w-full rounded border p-2" data-skip-page-rerender="true"></label>
      <label class="block text-sm">变更原因<input name="reason" class="mt-1 w-full rounded border p-2" data-skip-page-rerender="true"></label>
      <label class="flex gap-2 text-sm"><input type="checkbox" name="confirmed" data-skip-page-rerender="true">已核对原计划和实际执行情况，确认变更</label>
      <p role="alert" data-tmf-purchase-revision-error class="text-sm text-red-700"></p>
    </div>`,renderSecondaryButton('取消',{prefix:'pms-mpo',action:'close-overlay'})+renderPrimaryButton('确认变更',{prefix:'pms-mpo',action:'submit-tmf-revision'}))
}

export function renderTmfPurchaseRevisionHistory(orderNo: string): string {
  const base = getTmfPurchaseState().baseOrders.find(b => b.purchaseOrderNo === orderNo)
  const balance=getTmfPurchaseReturnBalance(orderNo)
  const summary=balance.returnDispatchedMeters>0?`<section class="rounded-lg border p-4 text-sm"><h3 class="font-semibold">原收货与采购退货</h3><p>原实收 ${balance.grossReceivedMeters} 米；退货已交 ${balance.returnDispatchedMeters} 米；TMF已收 ${balance.returnReceivedMeters} 米；退货在途 ${balance.returnTransitMeters} 米；净实收 ${balance.netReceivedMeters} 米。</p><p>原收货不改写；退回物由TMF单独保留。</p></section>`:''
  if (!base?.planRevisions?.length) return summary
  return summary+`<section class="rounded-lg border p-4"><h3 class="font-semibold text-sm">基础计划变更记录</h3><div class="mt-2 max-h-48 overflow-y-auto space-y-2">${base.planRevisions.map(r=>`<article class="text-sm border-b pb-2"><p>V${r.fromVersion} → V${r.toVersion}：${r.beforeMeters} → ${r.afterMeters} 米；变更时已产 ${r.producedMetersAtChange} 米</p><p>原因：${e(r.reason)}</p><p class="text-xs text-slate-500">${e(r.confirmedBy)} · ${e(r.confirmedAt)}</p></article>`).join('')}</div></section>`
}
