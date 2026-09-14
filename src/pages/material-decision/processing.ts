import { escapeHtml as e } from '../../utils'
import { renderButton } from '../../components/ui/button'

/** §7 / AT05–07: quantities represent disjoint segments, never whole-order statuses. */
export interface ProcessingSupply {
  targetSku: string
  inputStock: number
  committedInput: number
  expectedOutput: number
  awaitingDispatch: number
  transit: number
  receivedChecking: number
  qualified: number
  rejected: number
  loss: number
  unit: string
  conversion: number | null
  yieldRate: number | null
  route: string[]
}
export function evaluateProcessing(s: ProcessingSupply) {
  const blockers: string[] = []
  if (!s.targetSku.trim()) blockers.push('输出目标 SKU 为空')
  if (!s.unit || s.conversion === null || !Number.isFinite(s.conversion) || s.conversion <= 0) blockers.push('单位换算缺失或无效')
  if (s.yieldRate === null || !Number.isFinite(s.yieldRate) || s.yieldRate <= 0 || s.yieldRate > 1) blockers.push('良率依据缺失或无效')
  if (!s.route.length) blockers.push('加工路线缺失')
  const quantities = [s.inputStock,s.committedInput,s.expectedOutput,s.awaitingDispatch,s.transit,s.receivedChecking,s.qualified,s.rejected,s.loss]
  if (quantities.some(q => !Number.isFinite(q) || q < 0)) blockers.push('数量无效')
  if (s.committedInput > s.inputStock) blockers.push('投入占用超出原料库存')
  const received = s.receivedChecking + s.qualified + s.rejected
  const remaining = s.expectedOutput - received - s.loss
  if (Math.abs(s.awaitingDispatch + s.transit - remaining) > 0.000001) blockers.push('数量分段不守恒')
  return { blockers, received, freeInput: Math.max(0,s.inputStock-s.committedInput), remaining,
    futureSupply: blockers.length ? 0 : remaining,
    currentUsable: s.targetSku.trim() && Number.isFinite(s.qualified) && s.qualified >= 0 ? s.qualified : 0 }
}
export interface ProcessingCandidate {
  name: string; quantity: number; days: number | null; route: string; constraint: string; blockers: string[]; cost: number | null
}
export function compareProcessingCandidate(candidate: ProcessingCandidate, gap: number, needInDays: number) {
  const valid = Number.isFinite(gap) && gap >= 0 && Number.isFinite(needInDays) && needInDays >= 0 && Number.isFinite(candidate.quantity) && candidate.quantity >= 0
  const available = candidate.days !== null && Number.isFinite(candidate.days) && candidate.days >= 0 && !candidate.blockers.length && valid
  const covered = available && candidate.days! <= needInDays ? Math.min(gap,candidate.quantity) : 0
  return { covered, residual: valid ? gap-covered : null, onTime: available && candidate.days! <= needInDays }
}
const baseSupply: ProcessingSupply = { targetSku:'DEMO-FABRIC-BLACK',inputStock:100,committedInput:100,expectedOutput:90,awaitingDispatch:40,transit:20,receivedChecking:10,qualified:20,rejected:0,loss:0,unit:'Yard',conversion:1,yieldRate:.9,route:['染色','印花'] }
let scenario = 'normal'
let gap = 80
let needInDays = 5
let notice = ''
function selectedSupply(): ProcessingSupply {
  const s = {...baseSupply,route:[...baseSupply.route]}
  if (scenario === 'missing-sku') s.targetSku = ''
  if (scenario === 'missing-unit') s.conversion = null
  if (scenario === 'missing-yield') s.yieldRate = null
  if (scenario === 'missing-route') s.route = []
  if (scenario === 'exception') { s.awaitingDispatch = 35;s.loss=5;s.receivedChecking=5;s.rejected=5 }
  return s
}
function action(label: string, value: string, active = false): string {
  return renderButton({label,variant:active?'primary':'secondary',size:'sm',action:{prefix:'md-processing',action:value,skipPageRerender:true}})
}
function dateAfter(days: number | null) {
  if (days === null) return '未知'
  const d=new Date('2026-09-14T00:00:00Z');d.setUTCDate(d.getUTCDate()+days)
  return d.toISOString().slice(0,10)
}
export function renderProcessingPanel(): string {
  const s=selectedSupply(), result=evaluateProcessing(s)
  const targetBlockers=s.targetSku.trim()?[]:['输出目标 SKU 为空']
  const candidates: ProcessingCandidate[] = [
    {name:'直接采购成品',quantity:100,days:8,route:'成品采购 → 运输 6 天 → 收货质检 2 天',constraint:'Mock 供应商承诺 100 Yard，未占用',blockers:targetBlockers,cost:null},
    {name:'现有物料调拨',quantity:40,days:3,route:'现有合格成品 → 转运 2 天 → 收货质检 1 天',constraint:'Mock 来源仓可调拨上限 40 Yard',blockers:targetBlockers,cost:null},
    {name:'现有坯布加工',quantity:90,days:7,route:'染色 2 天 → 印花 2 天 → 交接运输 2 天 → 质检 1 天',constraint:'本批 100 Yard 坯布已投入，新增可用资源 0',blockers:[...result.blockers,'本批坯布已被加工单占用'],cost:null},
    {name:'采购坯布后加工',quantity:90,days:12,route:'采购坯布 5 天 → 染色 2 天 → 印花 2 天 → 转运 2 天 → 质检 1 天',constraint:'Mock 产能 100 Yard／批；需另购投入料',blockers:[...result.blockers],cost:null},
  ]
  return `<section id="md-processing" class="rounded-lg border bg-white p-4 space-y-4" aria-label="加工供给原型面板">
    <div><h3 class="font-semibold">加工供给与候选方案</h3><p class="text-sm text-amber-700">Mock 演示 · 业务日期 2026-09-14 · 本面板只试算，不生成真实采购、调拨或加工单。</p></div>
    <div class="flex flex-wrap gap-2">${[['normal','正常分段'],['exception','损耗与不合格'],['missing-sku','目标 SKU 为空'],['missing-unit','缺单位换算'],['missing-yield','缺良率'],['missing-route','缺路线']].map(([id,label])=>action(label,id,scenario===id)).join('')}</div>
    <div class="rounded border p-3 text-sm"><strong>演示加工单 DEMO-PROC-001／行 1</strong><p>投入 DEMO-GREIGE（批次 DEMO-B01）100 Yard → 目标 ${e(s.targetSku||'未映射')} · 真实物料图片待提供（两个演示物料均无对应实拍图）</p><p>工厂：演示染色厂／印花厂 · 责任人：演示物料计划员 · 目的仓：演示目的仓 · 路线：${e(s.route.join(' → ')||'待补齐')}</p><p>投入换算 ${s.conversion ?? '待补齐'} · 预计良率 ${s.yieldRate === null?'待补齐':s.yieldRate*100+'%'} · 预计产出 90 Yard · 剩余流程结束后才可用</p><p>计划开工 2026-09-12／加工完工 2026-09-18；运输至 2026-09-20，质检后最早 2026-09-21。${result.blockers.length?'本异常场景不形成确定可用承诺。':''}</p></div>
    <div class="grid gap-2 sm:grid-cols-3">${[['原料账面／已投入占用',`${s.inputStock} / ${s.committedInput}`],['原料可再分配',String(result.freeInput)],['预计产出总量',String(s.expectedOutput)],['产出待发',String(s.awaitingDispatch)],['转运中',String(s.transit)],['已接收待检',String(s.receivedChecking)],['已接收合格',String(s.qualified)],['已接收不合格',String(s.rejected)],['过程损耗',String(s.loss)]].map(([label,value])=>`<div class="rounded bg-slate-50 p-3"><div class="text-xs text-slate-600">${label}</div><strong>${value} Yard</strong></div>`).join('')}</div>
    <p class="text-sm">已接收 ${result.received}，冲减未接收预计量后剩余 ${result.remaining} Yard。目标物料当前合格 ${result.currentUsable}；未接收未来供给 ${result.futureSupply} Yard。待检、不合格、损耗不作为当前合格库存；本批坯布不能再次用于新任务。</p>
    ${result.blockers.length?`<div role="status" class="rounded bg-amber-50 p-3 text-sm text-amber-800">阻断确定加工供给：${result.blockers.map(e).join('；')}。请在来源系统补齐映射或依据后重算；加工事实仍保留。</div>`:''}
    <div class="flex flex-wrap items-end gap-3"><label class="text-sm">待解决缺口（Yard）<input id="md-processing-gap" type="number" min="0" value="${gap}" data-skip-page-rerender="true" class="block w-40 rounded border p-2"></label><label class="text-sm">距需求日（天）<input id="md-processing-days" type="number" min="0" step="1" value="${needInDays}" data-skip-page-rerender="true" class="block w-40 rounded border p-2"></label>${action('比较候选方案','compare')}</div>
    <p class="text-sm text-slate-600">需求日 ${dateAfter(needInDays)}。以下是独立备选，禁止合计；缺口指扣除已有有效供给后的剩余需求。成本缺失不填 0，不作最低成本排序。</p>
    <div class="grid gap-3 lg:grid-cols-2">${candidates.map(c=>{const r=compareProcessingCandidate(c,gap,needInDays);return `<article class="rounded border p-3 space-y-1 text-sm"><h4 class="font-semibold">${e(c.name)}</h4><p>候选量 ${c.quantity} Yard · ${e(c.constraint)}</p><p>${e(c.route)}</p><p>最早可用：${c.blockers.length?'待核实（理论 '+dateAfter(c.days)+'）':dateAfter(c.days)} · 成本：待核实</p><p>按期解决 ${r.covered} / 剩余 ${r.residual ?? '无法计算'} Yard</p><p class="${r.residual?'text-amber-700':'text-emerald-700'}">${c.blockers.length?e(c.blockers.join('；')):r.onTime?(r.residual?'可供量不足，需求日仍有缺口':'可覆盖本次缺口'):`需求日 ${dateAfter(needInDays)} 至可用日前仍无法保障`}</p></article>`}).join('')}</div>
    <p role="status" class="text-sm text-blue-700">${e(notice||'选择异常场景或修改缺口后比较；不改动任何线上数据。')}</p>
  </section>`
}
export function handleProcessingClick(target: HTMLElement): boolean {
  const button=target.closest<HTMLElement>('[data-md-processing-action]')
  if(!button) return false
  const value=button.dataset.mdProcessingAction
  if(value==='compare') {
    const qty=document.querySelector<HTMLInputElement>('#md-processing-gap')?.value ?? ''
    const days=document.querySelector<HTMLInputElement>('#md-processing-days')?.value ?? ''
    if(!qty.trim()||!days.trim()||!Number.isFinite(Number(qty))||Number(qty)<0||!Number.isInteger(Number(days))||Number(days)<0||Number(days)>3650) notice='请输入非负缺口，以及 0–3650 的整数天数；保留上次试算。'
    else {gap=Number(qty);needInDays=Number(days);notice='已按当前输入完成本地比较；未创建任何业务单据。'}
  } else if(['normal','exception','missing-sku','missing-unit','missing-yield','missing-route'].includes(value??'')) {scenario=value!;notice='已切换 Mock 场景。'}
  const panel=document.querySelector('#md-processing')
  if(panel) panel.outerHTML=renderProcessingPanel()
  return true
}
