// @page-pattern: detail
import type { PFTask } from './model'
import { snapshot } from './fixtures'
import { calculateNetwork, type NetworkNode } from './calculations'
import { badge, button, card, dt, e, fmt } from './common'

type RegionChoice = '待判断' | 'ID' | 'CN'
type CraftChoice = '待判断' | '有特殊工艺' | '无特殊工艺'
interface ScenarioOption { id: string; region: 'ID' | 'CN'; craft: Exclude<CraftChoice, '待判断'>; days: number; formula: string }
interface SimulationRecord { at: string; owner: string; decision: string; before: string; after: string; excluded: string[]; restored: string[]; version: string }
interface ScenarioState {
  region: RegionChoice; craft: CraftChoice; unbounded: boolean; owner: string;
  revision: number; history: SimulationRecord[]; originalT0: string;
}
const simulations = new Map<string, ScenarioState>()
const ruleVersion = 'MOCK-SCENARIO-V1'

/** Independent reviewed mock network, never a mutation of the 31-item production task graph. */
function scenarioNetwork(region: 'ID' | 'CN' | 'UNKNOWN', special: boolean): NetworkNode[] {
  const nodes: NetworkNode[] = [
    { id: '面料到裁厂', durationDays: 8, predecessors: [] },
    { id: '生产单及任务就绪', durationDays: 5, predecessors: [] },
    { id: '裁床合格裁片', durationDays: 3, predecessors: ['面料到裁厂', '生产单及任务就绪'] },
    { id: '辅料供给至目标厂实收', durationDays: region === 'UNKNOWN' ? null : region === 'CN' ? 15 : 5, predecessors: [] },
  ]
  if (special) nodes.push({ id: '特殊工艺及交接', durationDays: 3, predecessors: ['裁床合格裁片'] })
  nodes.push(
    { id: '齐套分单', durationDays: 1, predecessors: [special ? '特殊工艺及交接' : '裁床合格裁片', '辅料供给至目标厂实收'] },
    { id: '车缝及合格回货', durationDays: 6, predecessors: ['齐套分单'] },
    { id: '后道质检入库', durationDays: 1, predecessors: ['车缝及合格回货'] },
    { id: '实际发货', durationDays: 1, predecessors: ['后道质检入库'] },
  )
  return nodes
}
const options: ScenarioOption[] = (['ID', 'CN'] as const).flatMap(region => [false, true].map(special => {
  const days = calculateNetwork(scenarioNetwork(region, special)).durationDays!
  return {
    id: `${region}-${special ? 'WITH' : 'WITHOUT'}`,
    region, craft: special ? '有特殊工艺' as const : '无特殊工艺' as const, days,
    formula: `max(max(8,5)+3${special ? '+3' : ''},${region === 'CN' ? 15 : 5})+1+6+1+1 = ${days}自然日`,
  }
}))
function getState(task: PFTask, owner?: string): ScenarioState {
  let value = simulations.get(task.id)
  if (!value) {
    value = { region: '待判断', craft: '待判断', unbounded: false, owner: owner || task.follower, revision: 0, history: [], originalT0: task.startedAt }
    simulations.set(task.id, value)
  }
  if (owner) value.owner = owner
  return value
}
function matching(s: ScenarioState): ScenarioOption[] {
  return options.filter(option => (s.region === '待判断' || option.region === s.region) && (s.craft === '待判断' || option.craft === s.craft))
}
function range(s: ScenarioState): string {
  if (s.unbounded) return '暂无有限上界'
  const days = matching(s).map(option => option.days)
  if (!days.length) return '无合法方案，需检查条件'
  const low = Math.min(...days), high = Math.max(...days)
  return low === high ? `${low}自然日` : `${low}～${high}自然日`
}
function label(option: ScenarioOption): string { return `${option.region === 'CN' ? '中国采购' : '印尼现货'} / ${option.craft} / ${option.days}天` }
function choice(labelText: string, action: string, value: string, selected: boolean, taskId: string): string {
  return button(labelText, action, `data-task-id="${e(taskId)}" data-value="${e(value)}" aria-pressed="${selected}" ${selected ? 'style="background:#eff6ff;border-color:#2563eb;color:#1d4ed8"' : ''}`)
}

export function renderRouteScenarios(task: PFTask, state?: { user?: string }): string {
  const s = getState(task, state?.user), valid = matching(s), version = `${ruleVersion}.r${s.revision}`
  const bound = range(s)
  const result = `<div class="pf-kpis"><div class="pf-kpi"><span>当前模拟范围</span><b>${e(bound)}</b></div><div class="pf-kpi"><span>保留有限方案</span><b>${valid.length}<small>种</small></b></div><div class="pf-kpi"><span>原始T₀保持不变</span><b class="pf-small-value">${dt(s.originalT0)}</b></div></div>`
  const controls = `<div class="pf-actions" role="group" aria-label="模拟特殊工艺判断"><b>特殊工艺：</b>${(['待判断', '有特殊工艺', '无特殊工艺'] as const).map(value => choice(value, 'scenario-craft', value, s.craft === value, task.id)).join('')}</div><div class="pf-actions" role="group" aria-label="模拟采购区域判断"><b>供给路线：</b>${(['待判断', 'ID', 'CN'] as const).map(value => choice(value === 'ID' ? '印尼现货（ID）' : value === 'CN' ? '中国采购（CN）' : value, 'scenario-region', value, s.region === value, task.id)).join('')}</div><div class="pf-actions">${choice(s.unbounded ? '移除预算未定路线' : '加入预算未定路线', 'scenario-unbounded', s.unbounded ? 'off' : 'on', s.unbounded, task.id)}${button('重置模拟', 'scenario-reset', `data-task-id="${e(task.id)}"`)}</div>`
  const table = `<div class="overflow-x-auto"><table class="pf-simple-table"><thead><tr><th>已评审的独立简化方案</th><th>完整计算公式</th><th>当前判断</th></tr></thead><tbody>${options.map(option => {
    const active = valid.some(v => v.id === option.id)
    const reasons = [s.region !== '待判断' && option.region !== s.region ? `与已选${s.region}路线不符` : '', s.craft !== '待判断' && option.craft !== s.craft ? `与“${s.craft}”不符` : ''].filter(Boolean)
    return `<tr ${active ? '' : 'style="color:#64748b;background:#f8fafc"'}><td>${e(label(option))}</td><td><code>${e(option.formula)}</code></td><td>${badge(active ? '保留方案' : '已排除')}<small>${e(reasons.join('；'))}</small></td></tr>`
  }).join('')}${s.unbounded ? `<tr><td>新增供给路线：预算未定</td><td>供给路径预算=未知；max(裁片路径,未知)+1+6+1+1=待判定</td><td>${badge(calculateNetwork(scenarioNetwork('UNKNOWN', s.craft !== '无特殊工艺')).durationDays === null ? '暂无有限上界' : '待判定')}</td></tr>` : ''}</tbody></table></div>`
  const explanation = `<div class="pf-formula"><p><b>本演示是独立简化算例，不是对主例31项网络随意删边。</b>数字均为已评审Mock预算，不代表正式发布的采购或生产标准。</p><p>固定前置：面料到裁厂D8；生产单与任务D5就绪；裁床3天，因此裁片完成=max(8,5)+3=D11。特殊工艺仅在选择“有”时生成独立3天工作，结束D14；选择“无”时不生成该工作。</p><p>辅料与裁片路径并行：印尼现货到厂5天（需求及下单1＋供方到仓1＋入库1＋调拨1＋工厂实收1）；中国采购到厂15天（需求1＋下单1＋供方1＋国内运输1＋跨境到仓6＋验收入库1＋调拨安排2＋出库1＋到厂实收1）。两条路径都包含工厂实收，不能在仓库入库就结束。</p><p>汇合后：齐套分单1＋车缝及合格回货6＋后道质检入库1＋实际发货1=9天。故ID无工艺=max(11,5)+9=20；ID有工艺=max(14,5)+9=23；CN无工艺=max(11,15)+9=24；CN有工艺=max(14,15)+9=24。</p><p><b>操作路径：</b>初始20～24天 → 选择“有特殊工艺”后23～24天 → 再选择“中国采购”后24天。CN辅料路径更长，已吸收并行的3天特殊工艺，因此不是24＋3。</p>${s.unbounded ? '<p class="pf-amber"><b>预算未定路线：</b>当前存在无法计算完成时长的合法供给可能，不能只取已知四种的最大值当总体上界，也不能填0天。已知有限方案仍展示，但总体上下界暂无法确认。</p>' : ''}</div>`
  const history = s.history.length ? `<div class="overflow-x-auto"><table class="pf-simple-table"><thead><tr><th>模拟决策时间 / 责任人</th><th>判断及范围变化</th><th>排除 / 恢复路线</th><th>模拟版本</th></tr></thead><tbody>${[...s.history].reverse().map(row => `<tr><td>${dt(row.at)}<small>${e(row.owner)}</small></td><td>${e(row.decision)}<small>${e(row.before)} → ${e(row.after)}</small></td><td>${row.excluded.length ? `排除：${row.excluded.map(e).join('；')}` : '未新增排除'}${row.restored.length ? `<small>恢复：${row.restored.map(e).join('；')}</small>` : ''}</td><td>${e(row.version)}</td></tr>`).join('')}</tbody></table></div>` : '<p>尚未进行模拟判断。选择条件后，将记录模拟时间、责任人、被排除路线及版本变化。</p>'
  return `<div data-pf-scenarios="${e(task.id)}">${card('条件路线收敛模拟', `<p><b>独立模拟，确认后由来源业务形成正式事实。</b>本页面只比较合法路线，不修改生产任务、采购区域、原始T₀、生效截止或客户订单关系。</p>${controls}${result}<p>模拟版本 ${e(version)} · 判断责任人 ${e(s.owner)} · 业务快照 ${dt(snapshot)} · 操作记录使用浏览器当前时间。</p>${s.region === '待判断' || s.craft === '待判断' ? '<p>条件尚未全部确认；范围结果只用于方案比较，不作为正式逾期判断。</p>' : '<p>有限候选已收敛；仍需来源业务确认后发布相应规则及基线。模拟选择不会自动生效。</p>'}`)}${card('四种合法方案与计算公式', table + explanation)}${card('模拟决策记录', history)}<p class="pf-footnote">页面内模拟状态可重置；刷新浏览器恢复初始演示。基线变化必须通过正式来源事实与权限流程，本工具不执行发布。</p></div>`
}

export function handleScenarioAction(action: string, el: HTMLElement, refresh: () => void, notice: (message: string) => void): boolean {
  if (!action.startsWith('scenario-')) return false
  const taskId = el.dataset.taskId, s = taskId ? simulations.get(taskId) : undefined
  if (!s) { notice('请先打开对应任务的路线模拟。'); return true }
  const value = el.dataset.value
  if (action === 'scenario-reset') {
    s.region = '待判断'; s.craft = '待判断'; s.unbounded = false; s.revision = 0; s.history = []
    refresh(); notice('已重置独立路线模拟；原始业务事实和T₀未改变。'); return true
  }
  const before = range(s), old = matching(s)
  let decision = ''
  if (action === 'scenario-craft' && ['待判断', '有特殊工艺', '无特殊工艺'].includes(value ?? '')) {
    if (s.craft === value) { notice('当前已采用该工艺判断。'); return true }
    s.craft = value as CraftChoice; decision = `特殊工艺：${value}`
  } else if (action === 'scenario-region' && ['待判断', 'ID', 'CN'].includes(value ?? '')) {
    if (s.region === value) { notice('当前已采用该供给路线。'); return true }
    s.region = value as RegionChoice; decision = `供给路线：${value === 'ID' ? '印尼现货（ID）' : value === 'CN' ? '中国采购（CN）' : '待判断'}`
  } else if (action === 'scenario-unbounded' && ['on', 'off'].includes(value ?? '')) {
    s.unbounded = value === 'on'; decision = s.unbounded ? '加入预算未定的合法路线' : '移除预算未定路线'
  } else { notice('未识别的模拟选项，未修改任何业务数据。'); return true }
  const current = matching(s)
  s.revision += 1
  s.history.push({ at: new Date().toISOString(), owner: s.owner, decision, before, after: range(s), excluded: old.filter(o => !current.some(n => n.id === o.id)).map(label), restored: current.filter(o => !old.some(n => n.id === o.id)).map(label), version: `${ruleVersion}.r${s.revision}` })
  refresh(); notice(`模拟范围：${range(s)}。原始T₀和正式截止未改变。`)
  return true
}
