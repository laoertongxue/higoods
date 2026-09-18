// @page-pattern: detail
import { renderBoundaryEvidence } from './boundary-evidence'
import { skuBoundaryEvidence } from './evidence'
import { scheduleBatches } from './calculations'
import { anchor, card, e, fmt } from './common'
import { base, type ViewState } from './ui-state'

export const exampleCatalog=[
  ['BOM','需求与BOM换算'],['REUSE','技术复用与提前加工'],['REWORK','返工轮次与去重'],
  ['DATE-PRECISION','来源只有日期'],['SHIPMENT-IDENTITY','实发归属或下单时间缺失'],
  ['AWAITING-FULFILLMENT','成衣已备好，等待履约'],['BATCH','分批释放与共享产能'],['SKU','不同SKU的超发与短发'],
] as const

export function renderBatchExample():string {
  const batches=scheduleBatches([{id:'B1',qty:400,readyDay:16},{id:'B2',qty:400,readyDay:18},{id:'B3',qty:200,readyDay:20}],200,400)
  return card('分批释放与共享产能',`<p>独立Mock：B1/B2/B3为400/400/200件，D16/D18/D20释放。车缝200件/日、后道400件/日、运输0.25日、实发0.25日。</p><table class="pf-simple-table"><thead><tr><th>批次</th><th>可用</th><th>车缝区间</th><th>后道区间</th><th>实际发货计划</th></tr></thead><tbody>${batches.map(b=>`<tr><td>${e(b.id)} · ${fmt(b.qty)}件</td><td>D${fmt(b.readyDay)}</td><td>D${fmt(b.sewingStart)}—D${fmt(b.sewingEnd)}</td><td>D${fmt(b.postStart)}—D${fmt(b.postEnd)}</td><td>D${fmt(b.shippedDay)}</td></tr>`).join('')}</tbody></table><p>每批开始=max(本批可用、同资源上批释放)。车缝后运输0.25日，后道完成后实发0.25日。</p><p>80%在D21.5发出；第三批实发才跨过90%，因此90%与全部均为D22，不能用日均速度倒造里程碑。</p>`)
}

export function renderExamples(state:ViewState):string {
  const id=exampleCatalog.some(([id])=>id===state.exampleId)?state.exampleId:'BOM'
  const content=id==='BATCH'?renderBatchExample():id==='SKU'?card('按SKU分别判断有效履约',skuBoundaryEvidence()):renderBoundaryEvidence(id)
  return `<div class="pf-example-intro"><p>用于核对计算边界的独立Mock；不属于当前某笔生产任务，也不计入总览。</p>${anchor('返回规则与配置',base+'/configuration')}</div><div class="pf-example-layout"><nav aria-label="规则验证示例" class="pf-example-nav">${exampleCatalog.map(([key,label])=>`<button type="button" data-pf-action="example-select" data-value="${key}" aria-current="${id===key?'page':'false'}" class="${id===key?'active':''}">${e(label)}</button>`).join('')}</nav><section class="pf-example-content" aria-label="当前示例">${content}</section></div>`
}
