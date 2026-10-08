// @page-pattern: detail
import { escapeHtml } from '../../utils'
import { findTimingDocument, timingDocumentHref, timingCaseHref, TIMING_AS_OF, timingDuration, timingReceiptTotal, type TimingCase } from '../../data/production-timing/source'
import { calculateSewingReturnDeadlineDate, SEWING_RETURN_COUNTING_DAYS } from '../../data/fcs/sewing-return-calendar'
import { connectTimingSourceHandlers, timingRouteStart, timingEventStart } from './events'
import { materialFigure } from './material-image-view'
import { getTimingMaterialImage } from '../../data/production-timing/material-images'

/*
 * Native document pages read the same static records as the timing graph.
 * This renderer deliberately does not call the graph's compact document modal:
 * preparation, purchase, work, handover and contract documents have their own
 * object tables and related source records below.
 */
interface SourceClock { kind: string; start: string | null; end: string | null; sla?: number; days?: number }
interface SourceDocument {
  id: string; no: string; type: string; status: string; object: string
  quantity: number | null; unit: string; times: Record<string, string | null>
  quantities?: Record<string, number | null>; executor: string; receiver: string
  production: string; style: string; module?: string; related: string[]; note?: string
  ownerId?: string; clock?: SourceClock; handoverClock?: SourceClock
  roles?: Record<string, string>; qc?: string
  sampleTiming?: { due: string | null; late: boolean; done: boolean }
}
interface SourceProcess { work: string; leg?: { id: string } | null }
interface SourceMaterial {
  id: string; name: string; spec: string; unit: string; need: number; stock: number; use: number
  missing: number; source?: string; warehouse: string; target: string
  stockTransfer?: string; po?: string; receive?: string; purchaseTransfer?: string
  process: SourceProcess[]
  transitDocuments?: string[]
  batches?: { id: string; qty: number; process: SourceProcess[] }[]
}
interface SourcePart { id: string; part: string; qty: number; route: string; cutDoc: string; process: SourceProcess[] }
interface SourceBranch {
  docs: Record<string, SourceDocument>; master: string; bom: string; prior: string
  prep: { label: string; sub: string; nodes: { title: string; ids: string[]; note?: string }[] }[]
  paper: { base: string; sample: string; sizes: string }; packTask: string; pack: string
  materials: SourceMaterial[]; parts: SourcePart[]; releases: string[]
  inactivePreparation?: string[]
}
interface SourceTask {
  id: string; factory: string; type: 'sewing' | 'combined' | 'full'; assigned: string | null
  held: number | null; receipts: { at: string; qty: number }[]; executor: string; receiver: string; owner: string
  picked?: string | null; sampleOut?: string | null; sampleIn?: string | null; sampleResult?: string
}
interface SourceOrder {
  id?: string; key: string; order: string; style: string; imageUrl?: string; styleImageUrl?: string
  purchases: { id: string; at: string; qty: number; documentId?: string }[]; tasks: SourceTask[]; merch: string; coordinator: string
  warehouse: number | null; warehouseAt: string | null; verifiedAt?: string; productionOrderId?: string | null
}
interface SourceMatch { document: SourceDocument; order: SourceOrder; branch: SourceBranch | null }

const ROOT = '[data-timing-source-detail]'
const AS_OF = TIMING_AS_OF
const DAY = 86_400_000
const e = escapeHtml
const value = (input: unknown): string => input == null || input === '' ? '待核实' : String(input)
const quantity = (input: number | null | undefined, unit = ''): string => input == null ? '待核实' : `${input.toLocaleString('zh-CN')}${unit}`

function wallTime(input: string | null | undefined): number | null {
  if (!input) return null
  const iso = input.length === 10 ? `${input}T00:00:00+08:00` : `${input.replace(' ', 'T')}+08:00`
  const result = Date.parse(iso)
  return Number.isFinite(result) ? result : null
}

const duration = timingDuration

function badge(text: string): string {
  const color = /待核实|无法判定|未确认|缺失|未取得/.test(text) ? 'bg-amber-50 text-amber-800 border-amber-200'
    : /逾期|超时|晚|未通过|差异/.test(text) ? 'bg-red-50 text-red-700 border-red-200'
    : /待|未取得|制作中|加工中|进行中/.test(text) ? 'bg-amber-50 text-amber-800 border-amber-200'
      : /已|完成|通过|确认|关闭/.test(text) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'
  return `<span class="inline-flex rounded border px-2 py-1 text-xs font-medium ${color}">${e(text)}</span>`
}

function section(title: string, body: string, note = ''): string {
  return `<section class="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white"><header class="border-b border-slate-200 px-4 py-3"><h2 class="text-base font-semibold text-slate-900">${e(title)}</h2>${note ? `<p class="mt-1 text-xs text-slate-500">${e(note)}</p>` : ''}</header><div class="p-4">${body}</div></section>`
}

function table(headers: string[], rows: string[][], empty = '对应记录尚未取得，保留待核实。'): string {
  return `<div class="max-w-full overflow-x-auto"><table class="w-full border-collapse text-left text-sm"><thead class="border-b bg-slate-50 text-xs text-slate-500"><tr>${headers.map(label => `<th class="whitespace-nowrap px-3 py-3 font-medium">${e(label)}</th>`).join('')}</tr></thead><tbody class="divide-y divide-slate-100">${rows.length ? rows.map(row => `<tr class="align-top">${row.map(cell => `<td class="px-3 py-3 text-slate-700">${cell}</td>`).join('')}</tr>`).join('') : `<tr><td class="px-3 py-5 text-slate-500" colspan="${headers.length}">${e(empty)}</td></tr>`}</tbody></table></div>`
}

function link(d: SourceDocument | undefined, label?: string): string {
  if (!d) return '<span class="text-slate-400">单据待取得</span>'
  return `<a class="inline-block font-medium text-blue-600 hover:underline" href="${e(timingDocumentHref(d.id))}">${e(label ?? `${d.type} · ${d.no}`)}</a>`
}

function documents(branch: SourceBranch | null, ids: (string | null | undefined)[]): SourceDocument[] {
  return ids.flatMap(id => {
    if (!id) return []
    const doc = branch?.docs[id] ?? findTimingDocument(id)?.document as SourceDocument | undefined
    return doc ? [doc] : []
  })
}

function documentStatus(d: SourceDocument): string {
  return d.type === '生产准备单' && d.status === '已关闭' ? '准备已完成（单据已关闭）' : d.status
}

function documentRows(records: SourceDocument[]): string[][] {
  return records.map(d => [link(d), e(d.object), badge(documentStatus(d)), e(quantity(d.quantity, d.unit)), e(d.executor), e(d.receiver)])
}

function orderHref(order: SourceOrder): string {
  return timingCaseHref(order as unknown as TimingCase)
}

function image(order: SourceOrder): string {
  const url = order.styleImageUrl ?? order.imageUrl
  if (!url) return '<span class="inline-flex h-20 w-20 items-center justify-center rounded border border-dashed text-xs text-slate-400">对应实图待补</span>'
  return `<button type="button" class="shrink-0 rounded border border-slate-200 p-1" data-timing-source-action="image" data-skip-page-rerender="true" aria-label="查看款式大图"><img src="${e(url)}" alt="${e(order.style)}" class="h-20 w-20 object-contain" width="80" height="80"></button>`
}

function imageDialog(order: SourceOrder): string {
  const url = order.styleImageUrl ?? order.imageUrl
  if (!url) return ''
  return `<dialog data-timing-source-image class="m-auto max-h-[90vh] max-w-[90vw] rounded-lg border border-slate-200 bg-white p-4 shadow-2xl"><div class="mb-3 flex items-center justify-between gap-5"><strong class="text-sm">${e(order.style)}</strong><button type="button" class="rounded border px-3 py-1 text-sm" data-timing-source-action="close-image" data-skip-page-rerender="true">关闭大图</button></div><img src="${e(url)}" alt="${e(order.style)}" class="max-h-[75vh] max-w-full object-contain"></dialog>`
}

function header({ document: d, order }: SourceMatch): string {
  return `<header class="rounded-lg border border-slate-200 bg-white p-4"><div class="mb-4 flex flex-wrap items-center justify-between gap-3"><p class="text-xs text-slate-500">${e(d.module ?? '生产协同')} / 单据详情</p><a class="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700" href="${e(orderHref(order))}">${order.order ? '查看本生产单时效' : '查看采购待关联监控'}</a></div><div class="flex items-start gap-4">${image(order)}<div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-3"><h1 class="break-words text-xl font-semibold text-slate-900">${e(d.ownerId ? '生产准备单 · BOM物料明细' : d.type)} · ${e(d.no)}</h1>${badge(documentStatus(d))}</div><p class="mt-2 text-sm text-slate-600">${e(d.style)}</p><p class="mt-1 text-sm text-slate-500">生产单 ${e(d.production || '关联尚未取得')} · 对象 / 范围：${e(d.object)}</p><p class="mt-2 text-xs text-slate-400">演示单据 · 查看时点 ${e(order.verifiedAt ?? AS_OF)} · 只读展示</p></div></div></header>`
}

function facts(d: SourceDocument): string {
  const fields = d.quantities ?? { 数量: d.quantity }
  const quantities = `<dl class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">${Object.entries(fields).map(([label, q]) => `<div class="rounded border border-slate-200 bg-slate-50 p-3"><dt class="text-xs text-slate-500">${e(label)}</dt><dd class="mt-1 text-lg font-semibold text-slate-900">${e(quantity(q, d.unit))}</dd></div>`).join('')}</dl>`
  return section('单据事实与时间', quantities + table(['业务事实', '实际时间'], Object.entries(d.times).map(([label, at]) => [e(d.type === '生产准备单' && label === '关闭' ? '准备完成 / 单据关闭' : label), e(value(at))])))
}

function clocks(d: SourceDocument): string {
  const rows = [d.clock, d.handoverClock].flatMap(clock => {
    if (!clock) return []
    const start = wallTime(clock.start), end = wallTime(clock.end), current = wallTime(AS_OF)
    const sla = clock.sla ?? clock.days
    const completionUnverified = !clock.end && /执行结果待取得|资料待取得|待核实/.test(d.status)
    const used = start == null || (end ?? current) == null ? '开始时间缺失，耗时无法计算' : duration((end ?? current)! - start)
    const deadline = start == null || sla == null ? null : start + sla * DAY
    const late = deadline == null || (end ?? current) == null ? null : Math.max(0, (end ?? current)! - deadline)
    const finished = /交接|调拨/.test(clock.kind) ? '已全部接收' : /采购到仓/.test(clock.kind) ? '已入面辅料仓' : '已完成', unfinished = /交接|调拨/.test(clock.kind) ? '尚未全部接收' : /采购到仓/.test(clock.kind) ? '尚未全部入面辅料仓' : '未完成'
    const result = completionUnverified && deadline != null ? `完成事实待取得 · ${late ? '截止已过，是否超时待核实' : '截止未到'}` : start == null ? `${clock.kind}开始时间缺失 · 时效无法判定` : sla == null ? `${clock.kind}时效要求未确认 · 无法判定是否超时` : late ? `${end == null ? unfinished + ' · 已超时' : finished + ' · 晚'}${duration(late)}` : end == null ? `${unfinished} · 截止未到` : `${finished} · 按期`
    const due = deadline == null ? start == null ? '开始时间缺失，无法计算' : '时效要求未确认，截止无法计算' : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(deadline)
    return [[e(clock.kind), e(value(clock.start)), e(clock.end || (/交接|调拨/.test(clock.kind) ? '尚无实际接收时间' : '尚无实际完成时间')), e(sla == null ? '时效要求未确认' : `${sla}自然日`), e(due), e(completionUnverified ? `从开始至查看时点${used}；实际完成耗时待核实` : used), badge(result)]]
  })
  return rows.length ? section('本单据时效（制作、加工、采购到仓与交接分别计时）', table(['计时对象', '实际开始 / 上游交出', '实际完成 / 下游接收', '时效要求', '应完成 / 接收截止', '本项已用时间', '本项时效结果'], rows), '未完成且超过截止才是当前需催办的超时；已完成但晚于截止保留延误结果，耗时停止增加。交接从上游实际交出计至下游实际接收；未配置标准时只记录耗时，不判正常或超时。') : ''
}

function responsibility(d: SourceDocument): string {
  const roles = d.roles ?? { 执行负责人: d.executor, 交出确认责任: d.executor, 下游接收确认责任: d.receiver }
  return section('执行与交接责任', `<dl class="grid gap-3 sm:grid-cols-3">${Object.entries(roles).map(([label, person]) => `<div class="rounded border border-slate-200 p-3"><dt class="text-xs text-slate-500">${e(label)}</dt><dd class="mt-1 font-medium text-slate-900">${e(value(person))}</dd></div>`).join('')}</dl>${d.qc ? `<div class="mt-3 rounded border border-blue-100 bg-blue-50 p-3"><strong class="text-sm">质检交接结果</strong><p class="mt-1 text-sm text-slate-700">${e(d.qc)}</p></div>` : ''}`)
}

function bomDetails(branch: SourceBranch | null): string {
  if (!branch) return section('BOM物料明细', '<p class="text-sm text-slate-500">物料明细尚未取得。</p>')
  return section('BOM物料明细', table(['物料', '规格 / 适用范围', '本单需求', '库存采用', '缺口补采', '供给单据'], branch.materials.map(m => [materialFigure(m.id), e(m.spec), e(quantity(m.need, m.unit)), e(quantity(m.use, m.unit)), e(quantity(m.missing, m.unit)), documents(branch, [m.stockTransfer, m.po, m.receive, m.purchaseTransfer]).map(d => link(d)).join('<br>')])), '米、粒、个分别核对；各物料数量不汇总为成衣件数。')
}

function preparationDetails({ document: d, branch }: SourceMatch): string {
  if (!branch) return ''
  if (d.ownerId) return section('所属生产准备单', link(branch.docs[d.ownerId])) + bomDetails(branch)
  const branches = table(['准备对象', '工作步骤', '对应任务 / 成果', '单据状态'], branch.prep.flatMap(lane => lane.nodes.map(node => [e(lane.label), e(node.title), documents(branch, node.ids).map(doc => link(doc)).join('<br>'), documents(branch, node.ids).map(doc => badge(doc.status)).join(' ')])))
  const parallel = documents(branch, [branch.prior, branch.paper?.sample, branch.paper?.sizes])
  const results = documents(branch, [branch.packTask, branch.pack])
  return bomDetails(branch) + section('适用生产准备任务', branches, '调色、花型与打版 / 首单样衣分支分别推进；阶段整体4天，有定位印时整体5天，支线时长不累加。')
    + section('前期输入与并行打版 / 首单样衣', table(['单据', '对象 / 范围', '状态', '数量', '执行负责人', '接收确认责任'], documentRows(parallel)))
    + section('技术包确认与正式发布', table(['单据', '对象 / 范围', '状态', '数量', '执行负责人', '接收确认责任'], documentRows(results)))
    + (branch.inactivePreparation?.length ? section('不纳入当前准备要求的记录', table(['单据', '对象 / 范围', '状态', '数量', '执行负责人', '接收确认责任'], documentRows(documents(branch, branch.inactivePreparation))), '未启用及因需求变更结束的任务保留原单据，不计作当前未完成工作，不阻断适用准备成果汇合。') : '')
}

function materialOf(branch: SourceBranch | null, id: string): SourceMaterial | undefined {
  return branch?.materials.find(material => [material.stockTransfer, material.po, material.receive, material.purchaseTransfer,...(material.transitDocuments??[]), ...material.process.flatMap(process => [process.work, process.leg?.id]), ...(material.batches ?? []).flatMap(batch => batch.process.flatMap(process => [process.work, process.leg?.id]))].includes(id))
}

function materialDetails(match: SourceMatch): string {
  const { document: d, branch } = match, material = materialOf(branch, d.id)
  if (!material) return ''
  return section('本物料需求与库存 / 补采分配', table(['物料', '规格', '本单需求量', '下单时库存量', '本单计划采用库存量', '本单缺口补采量', '供给接收方'], [[materialFigure(material.id), e(material.spec), e(quantity(material.need, material.unit)), e(quantity(material.stock, material.unit)), e(quantity(material.use, material.unit)), e(quantity(material.missing, material.unit)), e(material.target)]]))
    + section('对应库存 / 采购 / 入库 / 调拨记录', table(['单据', '对象 / 范围', '状态', '数量', '执行负责人', '接收确认责任'], documentRows(documents(branch, [material.stockTransfer, material.po, material.receive, material.purchaseTransfer]))), '计划采用库存不代表已调出或已接收；实物进度看调拨交出及下游实收。补采分别看采购下单、仓库入库及入库后的调拨，不把下单量视为已入库。')
    + section('中转接收 / 人工配料 / 裁床领料', material.transitDocuments?.length ? table(['单据','对象 / 范围','状态','数量','执行负责人','接收确认责任'],documentRows(documents(branch,material.transitDocuments))) : '<p class="text-sm text-slate-500">对应中转仓接收、人工配料及裁床领料单据待核实；现有工厂或裁床接收记录不自动生成这些动作。</p>', '只读取实际记录，不自动判齐套或放行。')
}

function workDetails(match: SourceMatch): string {
  const { document: d, branch } = match
  const part = branch?.parts.find(p => p.cutDoc === d.id || p.process.some(process => process.work === d.id || process.leg?.id === d.id))
  const required = d.quantities?.应加工 ?? d.quantities?.应裁 ?? d.quantity
  const completed = d.quantities?.已完成 ?? d.quantities?.已裁
  const remaining = d.quantities?.未完成 ?? (required != null && completed != null ? Math.max(0, required - completed) : null)
  const work = section('加工对象明细', table(['加工对象 / 范围', '现场单位', '本项应加工 / 应裁量', '实际完成量', '尚未完成量', '单据加工状态'], [[e(d.object), e(d.unit), e(quantity(required, d.unit)), e(quantity(completed, d.unit)), e(quantity(remaining, d.unit)), badge(d.status)]]))
  const partRecords = part ? documents(branch, [part.cutDoc, ...part.process.flatMap(process => [process.work, process.leg?.id])]) : []
  return work + (part ? section('本部位工序与交接记录', table(['单据', '对象 / 范围', '状态', '数量', '执行负责人', '接收确认责任'], documentRows(partRecords)), `${part.part} · ${part.route}；片数不得直接折算成成衣完成量。`) : '') + materialDetails(match)
}

function handoverDetails(d: SourceDocument): string {
  const q = d.quantities ?? {}
  const outgoing = q.实交 ?? q.实出 ?? q.交出核对
  const received = q.实收 ?? q.裁床实领 ?? q.接收核对
  const diff = q.数量差异
  return section(/质检/.test(d.type) ? '质检与交接核对' : '交出与下游接收核对', table(['对象 / 范围', '应交 / 应调', '实际交出', '下游实收', '已记录数量差异（原单口径）', '交出方', '接收方'], [[e(d.object), e(quantity(q.应交 ?? q.应调 ?? d.quantity, d.unit)), e(quantity(outgoing, d.unit)), e(quantity(received, d.unit)), e(quantity(diff, d.unit)), e(d.executor), e(d.receiver)]]), '未取得实收数量或接收时间时保留待核实，不能据此认定接收完成。数量差异沿用原单字段；交出、接收及质检交接记录分别保留。')
}

function contractTask(match: SourceMatch): SourceTask | undefined {
  return match.order.tasks.find(task => match.document.id.endsWith(task.id) || match.document.object.includes(task.id))
}

function contractDetails(match: SourceMatch): string {
  const task = contractTask(match)
  if (!task) return section('合同任务明细', '<p class="text-sm text-slate-500">业务分配任务关联待核实。</p>')
  const days = task.type === 'sewing' ? SEWING_RETURN_COUNTING_DAYS.INDEPENDENT_SEWING : task.type === 'full' ? SEWING_RETURN_COUNTING_DAYS.CUTTING_TO_IRON_PACK : SEWING_RETURN_COUNTING_DAYS.SEWING_TO_IRON_PACK
  const name = task.type === 'sewing' ? '独立车缝' : task.type === 'full' ? '裁剪＋车缝＋烫包' : '车缝＋烫包'
  const start = wallTime(task.assigned || '业务分配日期缺失'), validHeld = task.held != null && Number.isFinite(task.held) && task.held > 0, now = wallTime(AS_OF)!
  const receipts = task.receipts.filter(receipt => (wallTime(receipt.at) ?? Infinity) <= now)
  const received = timingReceiptTotal(task)
  const ratios = [0.3, 0.7, 1]
  const rows = ratios.map((ratio, index) => {
    const target = validHeld ? Math.ceil(task.held! * ratio) : null
    const deadline = start == null ? null : wallTime(calculateSewingReturnDeadlineDate(task.assigned!, days[index]) + ' 23:59:59')! + 999
    let cumulative = 0
    const hit = target == null ? null : receipts.slice().sort((a, b) => (wallTime(a.at) ?? 0) - (wallTime(b.at) ?? 0)).find(receipt => { cumulative += receipt.qty; return cumulative >= target })
    const hitAt = hit ? wallTime(hit.at) : null
    const missing = [start == null ? '业务分配日期缺失' : '', !validHeld ? task.held === 0 ? '工厂实领为0，节点目标尚不能计算' : '工厂实领量缺失' : ''].filter(Boolean)
    const state = missing.length ? `${missing.join('；')} · 节点时效无法判定` : hitAt != null ? hitAt > deadline! ? `已达标 · 晚${duration(hitAt - deadline!)}` : '已达标 · 按期' : now > deadline! ? `未达标 · 已超时${duration(now - deadline!)} · 还差目标${Math.max(0, target! - received)}件` : `未达标 · 截止未到 · 距目标还差${Math.max(0, target! - received)}件`
    const date = deadline == null ? '待核实' : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(deadline) + ' 23:59'
    return [e(`${ratio * 100}%`), e(`业务分配第${days[index]}自然日`), e(date), e(quantity(target, '件')), e(hit?.at || (target == null ? '实领量缺失或为0，目标及达标时间无法判定' : '尚未达到本节点目标')), badge(state)]
  })
  return section('车缝任务与合同要求', table(['任务', '工厂', '合同类型', '业务分配日期', '工厂实领', '后道累计实收', '执行 / 交接责任'], [[e(task.id), e(task.factory), e(name), e(task.assigned || '业务分配日期缺失'), e(quantity(task.held, '件')), e(quantity(received, '件')), e(`${task.executor} → ${task.receiver} · 跟进${task.owner}`)]]))
    + section('本任务合同累计回货节点', table(['本节点累计比例', '要求', '应达标截止', '本节点应累计实收', '实际达标时间', '本节点时效结果'], rows), '业务分配日为第1天，全部自然日。分母为本任务工厂实领量，分子为本任务后道实收量；同厂其他任务不抵扣本任务缺口。')
    + section('本任务后道实际接收明细', table(['接收时间', '实收数量', '接收确认责任'], receipts.map(receipt => [e(receipt.at), e(quantity(receipt.qty, '件')), e(task.receiver)]), '本任务尚无后道实收记录，累计实收为0件。'))
}

function sampleDetails(match: SourceMatch): string {
  const { document: d } = match
  const task = contractTask(match)
  const state = !d.sampleTiming?.due ? '工厂实领日期缺失 · 交样时效无法判定' : d.sampleTiming.late ? d.sampleTiming.done ? '已交出 · 晚于要求日期' : '未交出 · 已过要求日期' : d.sampleTiming.done ? '已交出 · 按要求日期' : '未交出 · 要求日期未过'
  return section('工厂产前版样衣交出要求', table(['对应任务 / 工厂', '工厂实领日期', '要求交出日期', '实际交出时间', '下游接收时间', '交样时效结果', '样衣审核结果'], [[e(task ? `${task.factory} ${task.id}` : d.object), e(value(d.times.工厂实领)), e(value(d.sampleTiming?.due ?? d.times.要求交出日期)), e(d.times.样衣交出 || '尚无交出时间记录'), e(d.times.下游接收 || '尚无接收时间记录'), badge(state), e(task?.sampleResult || '审核结果尚未取得')]]), '领料后的第3天交出，按日期展示；日内截止时刻待确认，不生成精确超时小时数。样衣是否通过不改变合同回货进度判断与要求。')
}

function purchaseDetails(match: SourceMatch): string {
  const { document: d, order } = match
  if (/商品采购/.test(d.type)) return section('商品采购单明细', table(['采购单', '款式', '下单时间', '原始采购数量', '关联生产单'], order.purchases.filter(purchase => purchase.documentId === d.id || purchase.id === d.id || purchase.id === d.no || d.object.includes(purchase.id)).map(purchase => [e(purchase.id), e(order.style), e(purchase.at), e(quantity(purchase.qty, '件')), e(order.order || '关联尚未取得，是否已建单待核实')])), '原始商品采购数量为应完成数量；同一采购单不允许拆分到多个生产单。多张采购单合入同一生产单时，以最早下单时间起算。')
  return materialDetails(match)
}

function warehouseDetails(match: SourceMatch): string {
  const { document: d, order } = match
  const source = materialDetails(match)
  return section('入库对象与实际接收', table(['入库对象 / 范围', '应收 / 单据数量', '实际接收', '数量差异', '接收确认责任'], [[e(d.object), e(quantity(d.quantities?.应收 ?? d.quantity, d.unit)), e(quantity(d.quantities?.实收 ?? d.quantities?.仓库实收, d.unit)), e(quantity(d.quantities?.数量差异, d.unit)), e(d.receiver)]])) + source
    + (/成衣/.test(d.type) ? section('生产单成衣仓入库汇总', table(['原始采购应完成量', '成衣仓累计入库', '剩余未入库', order.warehouse != null && order.warehouse >= order.purchases.reduce((sum, p) => sum + p.qty, 0) ? '全量入仓完成时间（整单按期判断依据）' : '最近已记录入库时间（尚未证明全量完成）'], [[e(quantity(order.purchases.reduce((sum, p) => sum + p.qty, 0), '件')), e(quantity(order.warehouse, '件')), e(quantity(order.warehouse == null ? null : Math.max(0, order.purchases.reduce((sum, p) => sum + p.qty, 0) - order.warehouse), '件')), e(value(order.warehouseAt))]])) : '')
}

function specificDetails(match: SourceMatch): string {
  const type = match.document.type
  if (type === '生产准备单' || /BOM/.test(type)) return preparationDetails(match)
  if (/车缝任务分配|合同/.test(type)) return contractDetails(match)
  if (/工厂产前/.test(type)) return sampleDetails(match)
  if (/采购单/.test(type)) return purchaseDetails(match)
  if (/入库/.test(type)) return warehouseDetails(match)
  if (/加工单|裁剪单/.test(type)) return workDetails(match)
  if (/交接|交出|接收|调拨|领料/.test(type)) return handoverDetails(match.document) + materialDetails(match)
  if (/裁片放行/.test(type)) return section('人工放行范围', table(['放行范围', '对应成衣数量', '放行人员', '接手确认责任'], [[e(match.document.object), e(quantity(match.document.quantity, match.document.unit)), e(match.document.executor), e(match.document.receiver)]]), '是否放行由业务人员在裁片放行管理办理，时效监控读取已有放行事实。')
  return section(/正式技术包|技术包确认/.test(type) ? '技术成果与对应任务' : '专业任务与成果范围', table(['工作 / 成果', '适用对象', '数量', '当前状态', '执行负责人', '接收确认责任'], [[e(type), e(match.document.object), e(quantity(match.document.quantity, match.document.unit)), badge(match.document.status), e(match.document.executor), e(match.document.receiver)]]))
}

function relatedDetails(match: SourceMatch): string {
  const records = documents(match.branch, match.document.related)
  return section('关联原始单据', table(['单据', '对象 / 范围', '状态', '数量', '执行负责人', '接收确认责任'], documentRows(records)), '本页为完整单据详情；点击关联单据进入其所在模块的详情页。监控图中的单据先打开简要信息弹窗，选择查看详情才新建标签页；各页面读取同一份演示记录。')
}

/** Resolves only registered timing source records at their canonical native path. */
export function resolveTimingSourceDetail(pathname: string): string | null {
  const path = pathname.split('?')[0].replace(/\/$/, '')
  const encodedId = path.split('/').at(-1)
  if (!encodedId) return null
  let id: string
  try { id = decodeURIComponent(encodedId) } catch { return null }
  const found = findTimingDocument(id)
  if (!found || timingDocumentHref(id).split('?')[0].replace(/\/$/, '') !== path) return null
  const match = found as unknown as SourceMatch
  const started=typeof performance==='undefined'?0:timingRouteStart()
  if(typeof document!=='undefined')requestAnimationFrame(()=>requestAnimationFrame(()=>{const root=document.querySelector<HTMLElement>('[data-timing-source-detail]');if(!root)return;void sourceImagesReady(root).then(ok=>{root.dataset.timingNavigationMs=String(performance.now()-started);root.dataset.timingReady=ok?'source-detail':'image-error'})}))
  return `<main class="min-w-0 max-w-full space-y-4 p-4" data-timing-source-detail="${e(id)}">${header(match)}${specificDetails(match)}${facts(match.document)}${clocks(match.document)}${responsibility(match.document)}${match.document.note ? section('业务说明', `<p class="text-sm leading-6 text-slate-700">${e(match.document.note)}</p>`) : ''}${relatedDetails(match)}${imageDialog(match.order)}</main>`
}

/** Local image preview interactions; no business facts or browser storage change. */
async function sourceImagesReady(root: HTMLElement): Promise<boolean> {
  const images=Array.from(root.querySelectorAll<HTMLImageElement>('img')).filter(img=>img.getBoundingClientRect().width>0)
  await Promise.all(images.map(img=>img.decode().catch(()=>undefined)))
  let ok=true
  for(const img of images)if(!img.naturalWidth){ok=false;if(!img.dataset.timingFailed){img.dataset.timingFailed='true';img.insertAdjacentHTML('afterend','<p role="alert" class="text-sm text-red-700">图片读取失败，请重新加载当前页面。</p>')}}
  return ok
}
export function handleTimingSourceDetailEvent(target: HTMLElement, event?: Event): boolean {
  const root = target.closest<HTMLElement>(ROOT)
  if (!root) return false
  const started=timingEventStart();const done=()=>requestAnimationFrame(()=>requestAnimationFrame(async()=>{const ok=await sourceImagesReady(root);const measurements=JSON.parse(root.dataset.timingMeasurements||'[]');measurements.push({action:'image-preview',elapsedMs:performance.now()-started});root.dataset.timingMeasurements=JSON.stringify(measurements);root.dataset.timingReady=ok?'source-action':'image-error'}));const dialog = root.querySelector<HTMLDialogElement>('[data-timing-source-image]')
  if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'Escape' && dialog?.open) {
    dialog.close();done()
    event.preventDefault()
    return true
  }
  const action = target.closest<HTMLElement>('[data-timing-source-action]')?.dataset.timingSourceAction
  if ((action === 'image'||action === 'material-image') && dialog) {
    const m=getTimingMaterialImage(target.closest<HTMLElement>('[data-timing-material]')?.dataset.timingMaterial||'');const img=dialog.querySelector('img'),title=dialog.querySelector('strong');if(img){img.src=m?.imageUrl||findTimingDocument(root.dataset.timingSourceDetail!)?.order.imageUrl||'';img.alt=m?.alt||'款式实图'};if(title)title.textContent=m?m.name+' · Mock物料效果图':'款式实图';dialog.showModal();done()
    return true
  }
  if (action === 'close-image' && dialog) {
    dialog.close();done()
    return true
  }
  return false
}

connectTimingSourceHandlers({
  click: handleTimingSourceDetailEvent,
  key(event) {
    if (typeof document === 'undefined') return false
    const target = event.target instanceof HTMLElement ? event.target : document.querySelector<HTMLElement>(ROOT)
    return target ? handleTimingSourceDetailEvent(target, event) : false
  },
})
