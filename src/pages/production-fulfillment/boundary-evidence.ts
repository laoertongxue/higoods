// @page-pattern: detail
import { addDays, calculateNetwork, dayDiff, dedupeEvents, type NetworkNode, type QuantityEvent } from './calculations'
import { card, e, fmt, badge } from './common'

/** Independent boundary fixtures. Nothing here is joined into the ten production-task totals. */
export const boundaryFacts = {
  bom: { originalGarments: 1000, approvedReduction: 100, unitConsumptionM: 1.2, lossFactor: 1.05, conversionEvidenceId: null },
  preparation: {
    technologyPackage: 'MOCK-TECH-V2', originalDemand: 'MOCK-BOUNDARY-DEM-A', reusedByDemand: 'MOCK-BOUNDARY-DEM-B',
    approvedScopeQty: 300, reuseEvidence: 'MOCK-REUSE-CONFIRM-001', owner: '跟单丙',
    earlyProcessInstance: 'MOCK-EARLY-DYE-017', matchEvidence: 'MOCK-PROCESS-MATCH-017',
    sourceDemand: 'MOCK-BOUNDARY-DEM-B', laterProductionOrder: 'MOCK-BOUNDARY-PO-B',
  },
  rework: { requiredQty: 100, firstQualified: 80, firstRejected: 20, recheckedQualified: 20, startedAt: '2026-09-10T10:00:00+08:00' },
  dateOnly: { sourceValue: '2026-09-17', precision: '仅日期', sourceRecord: 'MOCK-DATE-ONLY-017', ruleDays: 3, approvedDateRule: null },
  missingOrigin: {
    shipmentId: 'MOCK-SHP-NO-PRODUCTION-SOURCE', orderNo: 'MOCK-ORDER-NO-SOURCE', shippedQty: 200,
    placedAt: '2026-09-06T10:00:00+08:00', shippedAt: '2026-09-16T10:00:00+08:00', requiredDays: 7,
    productionTaskId: null, creditedToSpecificTaskQty: 0, reason: '缺少生产来源批次分配',
  },
  missingPlacedAt: { shipmentId: 'MOCK-SHP-NO-ORDER-TIME', orderNo: 'MOCK-ORDER-NO-PLACED', shippedQty: 50, shippedAt: '2026-09-17T10:00:00+08:00', placedAt: null, requiredDays: 7 },
  awaitingFulfillment: {
    stockReceiptId: 'MOCK-GARMENT-STOCK-015', qualifiedStockQty: 1000, shippedQty: 0,
    factoryDueAt: '2026-09-15T10:00:00+08:00', factoryFinishedAt: '2026-09-15T10:00:00+08:00',
    effectiveShipmentDueAt: '2026-09-16T10:00:00+08:00', observedAt: '2026-09-17T10:00:00+08:00',
    reason: '成衣已具备发货库存，尚无可实际履约订单', responsibleTeam: '销售／履约团队',
  },
} as const

const baseline: NetworkNode[] = [
  { id: 'MAKE-R1', durationDays: 2, predecessors: [] },
  { id: 'CHECK-R1', durationDays: 1, predecessors: ['MAKE-R1'] },
  { id: 'SHIP-FULL', durationDays: 1, predecessors: ['CHECK-R1'] },
]
const withRework: NetworkNode[] = [
  { id: 'MAKE-R1', durationDays: 2, predecessors: [] },
  { id: 'CHECK-R1', durationDays: 1, predecessors: ['MAKE-R1'] },
  { id: 'REWORK-R2', durationDays: 1, predecessors: ['CHECK-R1'] },
  { id: 'RECHECK-R2', durationDays: 1, predecessors: ['REWORK-R2'] },
  { id: 'SHIP-FULL', durationDays: 1, predecessors: ['RECHECK-R2'] },
]
const reworkEvents: QuantityEvent[] = [
  { id: 'MOCK-QC-R1-GOOD', occurredAt: addDays(boundaryFacts.rework.startedAt, 3), recordedAt: addDays(boundaryFacts.rework.startedAt, 3), qty: 80 },
  { id: 'MOCK-QC-R2-GOOD', occurredAt: addDays(boundaryFacts.rework.startedAt, 5), recordedAt: addDays(boundaryFacts.rework.startedAt, 5), qty: 20 },
]

export function boundaryResults() {
  const b = boundaryFacts.bom, baselineResult = calculateNetwork(baseline), reworkResult = calculateNetwork(withRework)
  const qualifiedEvents = dedupeEvents([...reworkEvents, reworkEvents[1]])
  const o = boundaryFacts.missingOrigin, awaiting = boundaryFacts.awaitingFulfillment
  return {
    effectiveGarmentQty: b.originalGarments - b.approvedReduction,
    materialDemandM: (b.originalGarments - b.approvedReduction) * b.unitConsumptionM * b.lossFactor,
    convertedDemand: null,
    reuse: { referenceCount: 2, globalInstanceCount: 1, additionalProcessingDays: 0 },
    rework: {
      baselineDays: baselineResult.durationDays!, latestPathDays: reworkResult.durationDays!,
      addedDays: reworkResult.durationDays! - baselineResult.durationDays!,
      qualifiedQty: qualifiedEvents.reduce((sum, event) => sum + event.qty, 0),
      eventCount: qualifiedEvents.length, originalRejectedQty: boundaryFacts.rework.firstRejected,
      nodes: reworkResult.nodes,
    },
    dateOnly: { exactStartAt: null, exactDueAt: null, state: '日期口径待确认' },
    missingOrigin: { orderActualDays: dayDiff(o.shippedAt, o.placedAt), orderOverdueDays: Math.max(0, dayDiff(o.shippedAt, o.placedAt) - o.requiredDays), creditedToSpecificTaskQty: o.creditedToSpecificTaskQty },
    missingOrderTime: { actualDays: null, overdueDays: null, state: '待判定' },
    awaitingFulfillment: { factoryOverdueDays: Math.max(0, dayDiff(awaiting.factoryFinishedAt, awaiting.factoryDueAt)), overallOverdueDays: Math.max(0, dayDiff(awaiting.observedAt, awaiting.effectiveShipmentDueAt)), responsibleTeam: awaiting.responsibleTeam },
  }
}
function source(text: string): string { return `<p class="pf-footnote">依据：${e(text)}。独立Mock算例，不计入当前任务或总览统计。</p>` }
function row(label: string, value: string): string { return `<dt>${e(label)}</dt><dd>${value}</dd>` }
function box(id: string, title: string, content: string): string { return `<div data-pf-boundary="${e(id)}">${card(title, content)}</div>` }

export function renderBoundaryEvidence(selectedId?: string): string {
  const r = boundaryResults(), b = boundaryFacts.bom, prep = boundaryFacts.preparation, original = boundaryFacts.missingOrigin, awaiting = boundaryFacts.awaitingFulfillment
  const bom = box('BOM', '边界01 · 有效需求、BOM单耗与单位依据', `
    <p>数量算例：原成衣需求${b.originalGarments}件，来源生产需求正式减少${b.approvedReduction}件，当前有效${r.effectiveGarmentQty}件；单耗${b.unitConsumptionM}M/件，适用损耗系数${b.lossFactor}。</p>
    <p class="pf-formula"><b>物料需求 = (${b.originalGarments}−${b.approvedReduction}) × ${b.unitConsumptionM} × ${b.lossFactor} = ${fmt(r.materialDemandM)} M</b></p>
    <dl class="pf-facts">${row('数量来源', 'MOCK-BOM-DEMAND-V2 · 正式减量记录 MOCK-REDUCTION-100')}${row('单耗与损耗依据', 'MOCK-BOM-V2 · 1.2M/件 · 5%适用损耗，不能再次重复追加5%')}${row('拟换算为Yard', badge('缺换算依据，阻断汇总') + '；未配置已批准的换算规则及版本')}${row('允许结果', '保留1,134M需求；换算结果显示“待确认”，不填0、不将M与Yard直接相加')}</dl>
    <p>本卡只表达数量计算，不代表某一款式的正式BOM或具体物料配置。任务可用量仍须另核对已分配、合格、目标工厂实收数量。</p>${source('产品设计第06节“面辅料的条件工作与数量”、第14节“数据契约”')}`)
  const reuse = box('REUSE', '边界02 · 技术版本复用与提前加工匹配', `
    <dl class="pf-facts">${row('可复用技术包', e(prep.technologyPackage) + ' · 已发布版本')}${row('原来源需求 → 本次使用需求', `${e(prep.originalDemand)} → ${e(prep.reusedByDemand)}`)}${row('明确适用依据', `${e(prep.reuseEvidence)}：规格、材料及工艺适用范围与已发布版本一致，确认适用本次${prep.approvedScopeQty}件；责任人${e(prep.owner)}`)}${row('处理结果', '引用同一有效版本及批准结果；不重新生成已复用的纸样、BOM或技术确认工作')}${row('提前加工实例', `${e(prep.earlyProcessInstance)} · 来源${e(prep.sourceDemand)}`)}${row('正式生产单匹配', `${e(prep.laterProductionOrder)}通过${e(prep.matchEvidence)}引用上述同一实例`)}</dl>
    <p class="pf-formula"><b>需求视角${r.reuse.referenceCount}处可见 → 全局只计${r.reuse.globalInstanceCount}个提前加工实例；匹配不新增加工耗时${r.reuse.additionalProcessingDays}天。</b></p>
    <p>“不新增”指没有再次创建同一加工工作；不把原加工耗时改为0。原开始、结束、责任、数量与来源需求仍保留。若规格或适用范围发生变化，需来源业务确认新版本或新增本次必要工作；不能只因单号或款式相同就复用。准备确认等待等本次确有的动作仍应计时。</p>${source('产品设计第03节“对象与唯一口径”、第04节“阶段与实例”、工作目录ACT-S04-01')}`)
  const rework = box('REWORK', '边界03 · 返工轮次与合格数量去重', `
    <p>独立整批100件算例：原轮次CHECK-R1检验合格80件、不合格20件，原不合格结论和检验单保留。20件进入新轮次REWORK-R2 → RECHECK-R2，复检新增合格20件。</p>
    <div class="pf-flow-steps"><span>MAKE-R1 · 2天</span><b>→</b><span>CHECK-R1 · 1天</span><b>→</b><span>REWORK-R2 · 1天</span><b>→</b><span>RECHECK-R2 · 1天</span><b>→</b><span>整批实发 · 1天</span></div>
    <div class="pf-formula"><p>原网络：MAKE-R1 2＋CHECK-R1 1＋整批实发1 = <b>D${r.rework.baselineDays}</b>。</p><p>追加轮次后：2＋1＋REWORK-R2 1＋RECHECK-R2 1＋实发1 = <b>D${r.rework.latestPathDays}</b>，当前路径增加<b>${r.rework.addedDays}自然日</b>。原基线D${r.rework.baselineDays}不自动延期。</p><p><b>累计合格 = 原轮次80 + 新轮次新增20 = ${r.rework.qualifiedQty}件</b>。复检事件MOCK-QC-R2-GOOD重复送达两次，按事件ID仅计一次；最终${r.rework.eventCount}条有效合格事件。</p></div>
    <div class="overflow-x-auto"><table class="pf-simple-table"><thead><tr><th>保留来源记录</th><th>批内数量身份</th><th>对有效合格数量的贡献</th></tr></thead><tbody><tr><td>MOCK-QC-R1-GOOD · 原检验</td><td>原合格组80件；原不合格组20件另记</td><td>80件</td></tr><tr><td>MOCK-QC-R2-GOOD · 复检</td><td>只对应原不合格组20件；同一批内件序不同时计入两组</td><td>新增20件</td></tr><tr><td>同一复检事件重复接收</td><td>事件ID及对应件组未变化</td><td>0件，忽略重复</td></tr></tbody></table></div>
    <p>这是来源加工、检验实绩的独立投影示例；DDS不提供手工造完工。新轮次保留有向前置关系，不覆盖原轮次、不在图中回连成环。若可分批发货，合格80件可按该路线真实门槛另行释放，本例明确按整批100件发货。</p>${source('产品设计第04节“追加实例和轮次”、第08节“依赖网络”、第14.2节“事件与重复纠错”')}`)
  const precision = box('DATE-PRECISION', '边界04 · 来源只有日期，不虚构精确时刻', `
    <dl class="pf-facts">${row('来源记录', e(boundaryFacts.dateOnly.sourceRecord))}${row('原始值与精度', `<b>${e(boundaryFacts.dateOnly.sourceValue)}（${e(boundaryFacts.dateOnly.precision)}）</b>`)}${row('时效预算', '3个自然日')}${row('精确起点 / 截止', '均待确认；来源未提供时分秒，日期换算口径也未获批准')}${row('监控状态', badge(r.dateOnly.state))}</dl>
    <p>不得把仅有的2026-09-17自动补成“当天10点”或“当天零点”，也不能据此给出精确的逾期小时数。原日期保持原样；由来源负责人补齐业务时刻，或发布适用的日期精度计时规则后再计算。</p>${source('产品设计第07.1节“自然日精度”、第14节“来源精度与质量处理”')}`)
  const missing = box('SHIPMENT-IDENTITY', '边界05 · 已实发但来源或订单时间不全', `
    <div class="overflow-x-auto"><table class="pf-simple-table"><thead><tr><th>独立实发事实</th><th>已知数量与时点</th><th>可核算结果</th><th>待补事实与责任</th></tr></thead><tbody><tr><td>${e(original.shipmentId)}<small>${e(original.orderNo)}</small></td><td>200件；下单9月6日、实发9月16日，均为10:00 +08:00</td><td>订单实际${r.missingOrigin.orderActualDays}天／要求7天，超时${r.missingOrigin.orderOverdueDays}天；给任一特定生产任务计入的实发数量为${r.missingOrigin.creditedToSpecificTaskQty}件</td><td>生产来源批次分配未知；履约仓确认归属，不能按同款猜测扣量</td></tr><tr><td>${e(boundaryFacts.missingPlacedAt.shipmentId)}<small>${e(boundaryFacts.missingPlacedAt.orderNo)}</small></td><td>50件；9月17日10:00 +08:00实发，订单下单时刻缺失</td><td>${badge(r.missingOrderTime.state)}；保留实发50件，实际时效和超时均为空，不填0天</td><td>订单数据责任团队补齐有效下单时间；缺数据不判为按期</td></tr></tbody></table></div>
    <p>两个缺失项各自处理：客户订单时效可以在生产来源未知时单独核算；生产任务的已发数量必须等到来源分配明确后才能计入。实际发货业务时刻不因晚补关联而后移。</p>${source('产品设计第03节“实际发货关联”、第10节“发货与订单核算”、第14.3节“缺关联／缺时间”')}`)
  const pending = box('AWAITING-FULFILLMENT', '边界06 · 已备货待实际履约的责任归属', `
    <dl class="pf-facts">${row('合格库存事实', `${e(awaiting.stockReceiptId)} · 9月15日10:00已形成可发库存${awaiting.qualifiedStockQty}件`)}${row('当前已实发', '0件；未建立确定客户订单集合')}${row('工厂结果', `工厂要求9月15日10:00，实际同一时刻完成；本环节逾期${r.awaitingFulfillment.factoryOverdueDays}天`)}${row('本独立任务的实发承诺', '生效截止9月16日10:00；9月17日10:00仍未实发')}${row('整体结果', `${badge(`已逾期${r.awaitingFulfillment.overallOverdueDays}天`)}；整体实发时钟继续`)}${row('卡点与责任', `${e(awaiting.reason)}；责任团队${e(r.awaitingFulfillment.responsibleTeam)}，跟单负责协调`)}</dl>
    <p>工厂按期交付、任务实发逾期可以同时成立；不能把等待销售或履约条件的时间追责给已按期完成的工厂。若业务正式采用“备货至可发库存”规则，应按该已确认规则的承诺终点考核，并单列后续待履约；DDS不能自行改变当前实发承诺或将入库当实际发货。</p>${source('产品设计第10节“成衣已入库但无可履约订单”、第09.5节“风险与卡点归因”')}`)
  const examples:Record<string,string>={BOM:bom,REUSE:reuse,REWORK:rework,'DATE-PRECISION':precision,'SHIPMENT-IDENTITY':missing,'AWAITING-FULFILLMENT':pending}
  return `<section data-pf-boundary-evidence="true">${selectedId?examples[selectedId]??'示例不存在':Object.values(examples).join('')}</section>`
}
