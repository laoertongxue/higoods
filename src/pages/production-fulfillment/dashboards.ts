// @page-pattern: dashboard
import type { StandardListColumn } from '../../components/ui/list-table'
import type { PFTask, PFNode, ShipmentOrderFact } from './model'
import type { ViewState } from './ui-state'
import { base } from './ui-state'
import { snapshot, stages } from './fixtures'
import { assessTask, getNodes } from './calculations'
import { e, fmt, dt, badge, button, card, anchor, styleCell, renderDataTable, select } from './common'
import { filterDataIssues, type DataIssue, type DataIssueLedger, type DataIssueFilters } from './data-issues'

const day = 86400000
const severity: Record<string, number> = { '已逾期': 0, '预计逾期': 1, '待判定': 2, '临期': 3, '正常': 4, '按期完成': 5 }
const tones: Record<string, string> = {
  '已逾期': 'border-red-200 bg-red-50 text-red-700',
  '预计逾期': 'border-amber-200 bg-amber-50 text-amber-800',
  '待判定': 'border-slate-200 bg-slate-50 text-slate-700',
  '临期': 'border-amber-200 bg-amber-50 text-amber-800',
  '正常': 'border-blue-200 bg-blue-50 text-blue-700',
  '按期完成': 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

function metric(label: string, value: string, detail: string, health?: string): string {
  const attrs = health ? `data-pf-action="health-filter" data-value="${e(health)}" data-skip-page-rerender="true"` : ''
  const tag = health ? 'button' : 'div'
  return `<${tag} ${health ? 'type="button"' : ''} ${attrs} title="${e(detail)}" class="pf-metric-card min-w-0 rounded-lg border bg-white px-4 py-3 text-left ${health ? `${tones[health] ?? ''} transition-colors hover:ring-1 hover:ring-blue-300` : 'border-slate-200'}"><div class="text-xs text-slate-500">${e(label)}</div><div class="mt-1 text-2xl font-semibold tabular-nums">${e(value)}</div><span class="sr-only">${e(detail)}</span></${tag}>`
}

function note(text: string, tone = 'slate'): string {
  return `<div class="rounded-md border px-3 py-2 text-xs leading-relaxed ${tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-600'}">${e(text)}</div>`
}

function localDate(value: string | number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value ?? '').join('-')
}

function remaining(node: PFNode): number {
  return Math.max(0, node.requiredQty - node.qualifiedQty)
}

function finished(node: PFNode): boolean {
  return Boolean(node.actualEndAt) || ['已完成', '已复用', '已取消', '不适用'].includes(node.businessState)
}

function nodeDue(node: PFNode): string | null {
  return node.localDueAt ?? node.baselineDueAt
}

function elapsed(value: number | null | undefined, suffix = '天'): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '待判定' : `${fmt(value)}${suffix}`
}

function compactMetric(label: string, value: string, health?: string, tone = health): string {
  const attrs = health ? `data-pf-action="health-filter" data-value="${e(health)}" data-skip-page-rerender="true"` : ''
  const tag = health ? 'button' : 'div'
  return `<${tag} ${health ? 'type="button"' : ''} ${attrs} class="pf-brief-stat flex h-12 min-w-0 items-center justify-between gap-2 rounded-md border px-3 text-left ${tone ? `${tones[tone] ?? ''}${health ? ' hover:ring-1 hover:ring-blue-300' : ''}` : 'border-slate-200 bg-white'}"><span class="text-xs">${e(label)}</span><strong class="whitespace-nowrap text-lg tabular-nums">${e(value)}</strong></${tag}>`
}

function sectionTabs(action: 'overview-tab' | 'team-tab', selected: string, tabs: { label: string; count?: number }[]): string {
  return `<div class="pf-section-tabs flex gap-1 border-b border-slate-200" role="tablist" aria-label="${action === 'overview-tab' ? '时效总览内容' : '团队工作队列'}">${tabs.map(({ label, count }, index) => `<button id="pf-${action}-${index}" type="button" role="tab" aria-selected="${selected === label}" aria-controls="pf-${action}-panel" data-pf-action="${action}" data-value="${e(label)}" data-skip-page-rerender="true" class="border-b-2 px-4 py-2.5 text-sm font-medium ${selected === label ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}">${e(label)}${count === undefined ? '' : `<span class="ml-2 text-xs tabular-nums">${count}</span>`}</button>`).join('')}</div>`
}

function tabPanel(action: 'overview-tab' | 'team-tab', selected: string, labels: string[], content: string): string {
  return `<div id="pf-${action}-panel" role="tabpanel" aria-labelledby="pf-${action}-${labels.indexOf(selected)}" tabindex="0">${content}</div>`
}

function latestProgress(task: PFTask): string | null {
  const times = task.nodes.map(node => node.sourceUpdatedAt).filter(Boolean).sort()
  return times.at(-1) ?? null
}

function renderDuePressure(tasks: PFTask[], state: ViewState): string {
  if(!tasks.length)return card('未来 7 个自然日 · 到期压力','<p class="text-sm text-slate-500">当前查询范围没有在途任务</p>')
  const now=tasks[0]?.asOf??new Date().toISOString()
  const today = localDate(now, state.timezone)
  const dates = Array.from({ length: 7 }, (_, i) => localDate(Date.parse(now) + i * day, state.timezone))
  const buckets = dates.map(date => {
    const matches = tasks.filter(task => task.effectiveDueAt && localDate(task.effectiveDueAt, state.timezone) === date)
    return { date, tasks: matches.length, qty: matches.reduce((sum, task) => sum + task.remainingQty, 0), known:matches.every(t=>t.quantityKnown!==false) }
  })
  const maxCount = Math.max(1, ...buckets.map(bucket => bucket.tasks))
  const unknown = tasks.filter(task => !task.effectiveDueAt).length
  const past = tasks.filter(task => task.effectiveDueAt && localDate(task.effectiveDueAt, state.timezone) < today).length
  const later = tasks.filter(task => task.effectiveDueAt && localDate(task.effectiveDueAt, state.timezone) > dates[6]).length
  return card('未来 7 个自然日 · 到期压力', `<div class="text-xs text-slate-500">按生效截止日期分组；柱高为任务数，柱下为剩余应发件数。图表沿用当前查询范围。</div><div class="mt-4 flex h-40 items-end gap-2">${buckets.map(bucket => `<button type="button" data-pf-action="due-filter" data-value="${bucket.date}" data-skip-page-rerender="true" class="flex min-w-0 flex-1 flex-col items-center justify-end rounded-t-md px-1 hover:bg-slate-50" aria-label="查看${bucket.date}到期的${bucket.tasks}笔任务，${bucket.known?'剩余'+bucket.qty+'件':'数量待同步'}"><span class="text-xs font-semibold tabular-nums text-blue-700">${bucket.tasks} 笔</span><span class="mt-1 w-full max-w-12 rounded-t bg-blue-500" style="height:${Math.max(3, bucket.tasks / maxCount * 82)}px;opacity:${bucket.tasks ? 1 : 0.16}"></span><span class="mt-2 text-xs text-slate-600">${bucket.date.slice(5).replace('-', '/')}</span><span class="mt-1 text-xs tabular-nums text-slate-500">${bucket.known?fmt(bucket.qty)+' 件':'数量待同步'}</span></button>`).join('')}</div><div class="mt-4 flex flex-wrap gap-3 border-t pt-3 text-xs text-slate-500"><span>此前到期 <strong class="text-red-600">${past}</strong> 笔</span><span>7 日后到期 <strong>${later}</strong> 笔</span><span>截止待定 <strong>${unknown}</strong> 笔</span></div>`)
}

function renderStageDistribution(tasks: PFTask[]): string {
  const rows = stages.map(stage => ({ ...stage, count: tasks.filter(task => assessTask(task).activeStages.includes(stage.id)).length }))
  const max = Math.max(1, ...rows.map(row => row.count))
  return card('活跃阶段分布', `<p class="mb-3 text-xs text-slate-500">同一任务可处于多个活跃阶段，各阶段数量不可相加。</p><div class="space-y-2">${rows.map(row => `<button type="button" data-pf-action="stage-filter" data-value="${e(row.id)}" data-skip-page-rerender="true" class="flex w-full items-center gap-3 text-left text-xs hover:text-blue-600" aria-label="查看${e(row.name)}${row.count}笔任务"><span class="w-36 shrink-0 truncate" title="${e(row.name)}">${e(row.id)} ${e(row.name)}</span><span class="h-2 flex-1 overflow-hidden rounded bg-slate-100"><span class="block h-full rounded bg-sky-500" style="width:${row.count / max * 100}%"></span></span><span class="w-8 text-right tabular-nums">${row.count} 笔</span></button>`).join('')}</div>`)
}

function renderBottlenecks(tasks: PFTask[]): string {
  const rows = new Map<string, { count: number; qty: number; late: number; known:boolean }>()
  tasks.filter(task => ['已逾期', '预计逾期', '待判定'].includes(assessTask(task).health)).forEach(task => {
    const a = assessTask(task)
    const team = a.responsibleTeam || '责任待明确'
    const row = rows.get(team) ?? { count: 0, qty: 0, late: 0, known:true }
    row.count += 1; row.qty += task.remainingQty; row.known&&=task.quantityKnown!==false; row.late += a.health === '已逾期' ? 1 : 0
    rows.set(team, row)
  })
  return card('首要卡点责任', `<p class="mb-3 text-xs text-slate-500">按每笔任务当前首要卡点汇总；协调跟单与执行责任分开。</p><div class="max-h-80 space-y-3 overflow-y-auto">${[...rows.entries()].sort((a, b) => b[1].count - a[1].count).map(([team, row]) => `<div class="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-3"><div>${anchor(team, `${base}/teams/${encodeURIComponent(team)}`)}<div class="mt-1 text-xs text-slate-500">${row.known?'涉及剩余 '+fmt(row.qty)+' 件':'剩余数量待同步'}</div></div><div class="text-right"><div class="text-base font-semibold">${row.count} 笔</div>${row.late ? `<span class="text-xs text-red-600">已逾期 ${row.late} 笔</span>` : '<span class="text-xs text-amber-700">需跟进</span>'}</div></div>`).join('') || '<div class="py-6 text-center text-sm text-slate-500">当前范围没有已知责任卡点</div>'}</div>`)
}

function renderPriorityCards(tasks: PFTask[]): string {
  const priority = [...tasks].sort((a, b) => (severity[assessTask(a).health] ?? 8) - (severity[assessTask(b).health] ?? 8)
    || Date.parse(a.effectiveDueAt ?? '9999-01-01') - Date.parse(b.effectiveDueAt ?? '9999-01-01'))
  return `<section class="pf-card pf-overview-priority"><header class="pf-card-heading flex items-center justify-between gap-2"><h2>优先关注</h2>${button(`查看全部 ${priority.length} 笔`, 'drill-tasks')}</header><div class="divide-y divide-slate-100">${priority.slice(0, 3).map(task => {
    const assessment = assessTask(task)
    return `<article class="pf-priority-card px-3 py-2.5"><div class="flex items-start justify-between gap-3"><div class="min-w-0">${styleCell(task)}</div><div class="shrink-0 text-right">${badge(assessment.health)}<div class="mt-1 text-xs">${anchor(task.id, `${base}/tasks/${task.id}`)}</div></div></div><div class="mt-1.5 truncate text-xs text-slate-600" title="${e(assessment.blocker || task.scenario)}">${e(assessment.blocker || task.scenario)}</div><div class="mt-1 flex flex-wrap justify-between gap-1 text-xs text-slate-500"><span>${e(assessment.responsibleTeam || '暂无责任卡点')} · ${e(task.follower)}</span><span>截止 ${dt(task.effectiveDueAt, true)} · ${task.quantityKnown===false?'剩余待同步':'剩余 '+fmt(task.remainingQty)+' '+e(task.unit)}</span></div></article>`
  }).join('') || '<div class="px-4 py-10 text-center text-sm text-slate-500">当前范围没有任务，可重置筛选。</div>'}</div></section>`
}

function renderDataIssues(tasks: PFTask[], state: ViewState, ledger:DataIssueLedger|undefined, filters:DataIssueFilters): string {
  const byTask=new Map(tasks.map(task=>[task.id,task]))
  const rows=ledger?filterDataIssues(ledger,new Set(byTask.keys()),filters):[]
  const columns: StandardListColumn<DataIssue>[] = [
    { key:'task',title:'生产任务 / 款式',width:230,required:true,freezeable:true,render:issue=>`${anchor(issue.taskId,`${base}/tasks/${issue.taskId}`)}${styleCell(byTask.get(issue.taskId)!)}` },
    { key:'issue',title:'数据事项 / 来源工作',width:275,required:true,render:issue=>`<strong>${e(issue.title)}</strong><div class="mt-1 truncate text-xs text-slate-500" title="${e(issue.id)}">${e(issue.id)}</div><div class="mt-1 truncate text-xs" title="${e(issue.detail)}">${e(issue.nodeId?byTask.get(issue.taskId)?.nodes.find(node=>node.id===issue.nodeId)?.name||issue.nodeId:issue.detail)}</div>${issue.autoResolve?'':'<small class="text-amber-700">来源审核项 · 不自动关闭</small>'}` },
    { key:'owner',title:'责任人 / 团队',width:160,sortable:true,sortValue:issue=>issue.owner,render:issue=>`${e(issue.owner||'待指派')}<div class="mt-1 text-xs text-slate-500">${e(issue.team||'团队待明确')}</div>` },
    { key:'due',title:'修复期限',width:160,sortable:true,sortValue:issue=>issue.dueAt,render:issue=>`${issue.dueAt?dt(issue.dueAt):'未登记'}${issue.status==='待处理'&&issue.dueAt&&Date.parse(issue.dueAt)<Date.parse(ledger?.checkedAt||'')?'<div class="text-xs text-red-600">修复安排已逾期</div>':''}` },
    { key:'status',title:'核对结果',width:160,sortable:true,sortValue:issue=>issue.status,render:issue=>`${badge(issue.status)}<div class="mt-1 text-xs text-slate-500">${issue.status==='已恢复'?dt(issue.resolvedAt):issue.reopenCount?`重新打开 ${issue.reopenCount} 次`:'等待来源核对'}</div>` },
    { key:'actions',title:'操作',width:120,actionColumn:true,render:issue=>button(issue.status==='已恢复'?'查看恢复记录':'责任与期限','data-issue-open',`data-issue-id="${e(issue.id)}"`) },
  ]
  const issueSelect=(label:string,key:string,value:string,options:string[])=>select(label,`data-issue-${key}`,value,options)
  const owners=[...new Set((ledger?.issues??[]).filter(issue=>byTask.has(issue.taskId)).map(issue=>issue.owner))].filter(Boolean)
  const controls=`<div class="pf-data-issue-query"><div class="pf-data-issue-fields">${issueSelect('事项状态','view',filters.state,['待处理','已恢复','全部'])}${issueSelect('事项负责人','owner-filter',filters.owner,['全部',...owners])}${issueSelect('修复期限','deadline-filter',filters.deadline,['全部','未登记','已逾期','2日内到期','2日后到期'])}</div><div class="pf-data-issue-actions">${button('重置事项筛选','data-issue-reset')}${button('刷新来源并核对','data-issue-refresh')}<small>最近核对 ${dt(ledger?.checkedAt)} · 登记跟进不会关闭事项</small></div></div>`
  return `<div class="space-y-3">${controls}${ledger?.warning?note(ledger.warning,'amber'):''}${renderDataTable('pf-overview-data-issues','数据待补事项',columns,rows,state)}</div>`
}

interface DeliveryPerformanceRow {
  stage: string; workType: string; sourceType: string; nodes: PFNode[]; durations: number[];
  mean: number | null; min: number | null; max: number | null; completionFrom: string | null;
  completionTo: string | null; unfinished: number; canceled: number; invalid: number;
}

function deliveryPerformanceRows(tasks: PFTask[]): DeliveryPerformanceRow[] {
  const groups = new Map<string, PFNode[]>()
  getNodes(tasks).forEach(node => {
    // Different source document types can have different start / end meanings.
    const key = JSON.stringify([node.stage, node.name, node.sourceDocumentType])
    groups.set(key, [...(groups.get(key) ?? []), node])
  })
  return [...groups.values()].map(nodes => {
    const durations: number[] = []
    const completed: string[] = []
    let unfinished = 0, canceled = 0, invalid = 0
    nodes.forEach(node => {
      if (['已取消', '不适用'].includes(node.businessState)) { canceled += 1; return }
      if (!node.actualEndAt) { unfinished += 1; return }
      const start = node.actualStartAt ? Date.parse(node.actualStartAt) : NaN
      const end = Date.parse(node.actualEndAt)
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) { invalid += 1; return }
      durations.push((end - start) / day)
      completed.push(node.actualEndAt)
    })
    completed.sort()
    return {
      stage: nodes[0].stage, workType: nodes[0].name, sourceType: nodes[0].sourceDocumentType, nodes, durations,
      mean: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
      min: durations.length ? Math.min(...durations) : null, max: durations.length ? Math.max(...durations) : null,
      completionFrom: completed[0] ?? null, completionTo: completed.at(-1) ?? null,
      unfinished, canceled, invalid,
    }
  }).sort((a, b) => a.stage.localeCompare(b.stage) || a.workType.localeCompare(b.workType))
}

function renderDeliveryPerformance(tasks: PFTask[], state: ViewState): string {
  const rows = deliveryPerformanceRows(tasks)
  const columns: StandardListColumn<DeliveryPerformanceRow>[] = [
    { key: 'workType', title: '阶段 / 同类工作', width: 235, required: true, freezeable: true, render: row => `<div class="max-w-56 whitespace-normal font-medium">${e(row.workType)}</div><div class="mt-1 text-xs text-slate-500">${e(row.stage)} · ${e(stages.find(stage => stage.id === row.stage)?.name ?? '阶段待确认')}</div>` },
    { key: 'scope', title: '共同起止口径', width: 205, required: true, render: row => `<div class="max-w-48 whitespace-normal text-xs">${e(row.sourceType)}</div><div class="mt-1 text-xs text-slate-500">实际开始 → 实际结束</div>` },
    { key: 'samples', title: '有效完成样本', width: 120, sortable: true, sortValue: row => row.durations.length, render: row => `<strong>${row.durations.length}</strong> / ${row.nodes.length} 项` },
    { key: 'mean', title: '平均耗时', width: 110, sortable: true, sortValue: row => row.mean, render: row => row.mean === null ? '无样本' : elapsed(row.mean) },
    { key: 'range', title: '最短 / 最长', width: 145, sortable: true, sortValue: row => row.max, render: row => row.min === null ? '无样本' : `${elapsed(row.min)} / ${elapsed(row.max)}` },
    { key: 'completedRange', title: '样本完成日期范围', width: 185, render: row => row.completionFrom ? `<div>${dt(row.completionFrom)}</div><div class="mt-1 text-xs text-slate-500">至 ${dt(row.completionTo)}</div>` : '—' },
    { key: 'excluded', title: '排除样本 / 原因', width: 190, render: row => `<div>${row.unfinished + row.canceled + row.invalid} 项</div><div class="mt-1 max-w-44 whitespace-normal text-xs text-slate-500">未完成 ${row.unfinished} · 取消或不适用 ${row.canceled} · 起止无效 ${row.invalid}</div>` },
  ]
  return `<div class="space-y-3"><p class="text-xs text-slate-500">当前任务范围内按工作实例去重，分组依据为阶段、工作名称、单据类型和共同起止口径。耗时按自然日计算，不跨不同工作求平均。</p>${renderDataTable('pf-delivery-performance', '同类工作交付表现', columns, rows, state)}</div>`
}

function renderOverviewAnalysis(tasks: PFTask[], state: ViewState): string {
  const active = tasks.filter(task => assessTask(task).active)
  const known = active.filter(task => Boolean(task.effectiveDueAt)&&Number.isFinite(Date.parse(task.effectiveDueAt!))).length
  const forecastKnown=active.filter(task=>Boolean(task.predictedFinishAt)&&!task.missingRule).length
  const late = active.filter(task => assessTask(task).health === '已逾期').length
  const risk = active.filter(task => assessTask(task).health === '预计逾期').length
  const view = state.analysisView === '交付表现' ? '交付表现' : '分布'
  const summary = `<div class="flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-md border bg-white px-3 py-2"><div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs"><span title="当前逾期是否可判：有有效生效截止的在途任务/全部在途任务">当前逾期可判 <strong>${known}/${active.length} · ${active.length ? `${fmt(known / active.length * 100)}%` : '无样本'}</strong></span><span title="有可靠预测且无缺失规则的在途任务/全部在途任务">预测可判 <strong>${forecastKnown}/${active.length} · ${active.length?fmt(forecastKnown/active.length*100)+'%':'无样本'}</strong></span><span>已逾期 <strong class="text-red-600">${late}</strong> · 预计逾期 <strong class="text-amber-700">${risk}</strong> · 当前逾期不可判 ${active.length - known}</span></div><label class="flex items-center gap-2 text-xs text-slate-600">分析内容<select class="rounded-md border px-2 py-1.5" data-pf-field="analysis-view" data-skip-page-rerender="true" aria-label="分析内容"><option ${view === '分布' ? 'selected' : ''}>分布</option><option ${view === '交付表现' ? 'selected' : ''}>交付表现</option></select></label></div>`
  return `<div class="space-y-3">${summary}${view === '交付表现' ? renderDeliveryPerformance(tasks, state) : `<div class="pf-overview-analysis grid grid-cols-1 gap-3 lg:grid-cols-2">${renderStageDistribution(active)}${renderBottlenecks(active)}</div>`}</div>`
}

function renderSourceCoverage(tasks:PFTask[]):string {
  const rows=[['生产需求',tasks.length],['已关联准备单',tasks.filter(t=>t.sourceContext?.preparationId).length],['已关联正式技术包',tasks.filter(t=>t.sourceContext?.technicalVersionId).length],['已关联生产单',tasks.filter(t=>t.productionOrderNos.length).length],['有可归属实发',tasks.filter(t=>t.hasActualShipmentOrderFacts).length]] as const
  return card('业务来源完整度',`<div class="space-y-3">${rows.map(([label,count])=>`<div class="flex items-center gap-3 text-xs"><span class="w-36">${label}</span><span class="h-2 flex-1 rounded bg-slate-100"><i class="block h-full rounded bg-blue-500" style="width:${tasks.length?count/tasks.length*100:0}%"></i></span><strong>${count} / ${tasks.length}</strong></div>`).join('')}</div><p class="mt-4 text-xs text-slate-500">完整时效标准尚未形成，暂不生成到期压力图。可从任务详情补齐来源关联、查看已有准备工作与工艺路线。</p>`)
}

export function renderOverview(tasks: PFTask[], state: ViewState, ledger?:DataIssueLedger, issueFilters:DataIssueFilters={state:'待处理',owner:'全部',deadline:'全部'}): string {
  const active = tasks.filter(task => assessTask(task).active)
  const byHealth = (health: string) => tasks.filter(task => assessTask(task).health === health).length
  const qty = tasks.reduce((sum, task) => sum + task.effectiveQty, 0)
  const quantityKnown=tasks.every(t=>t.quantityKnown!==false)
  const shipped = tasks.reduce((sum, task) => sum + Math.min(task.shippedQty, task.effectiveQty), 0)
  const left = tasks.reduce((sum, task) => sum + task.remainingQty, 0)
  const taskIds=new Set(tasks.map(task=>task.id))
  const issueCount=(ledger?.issues??[]).filter(issue=>taskIds.has(issue.taskId)&&issue.status==='待处理').length
  const labels = ['运行概况', '分布分析', '数据待补']
  const selected = labels.includes(state.overviewTab) ? state.overviewTab : labels[0]
  let content: string
  if (selected === '分布分析') {
    content = renderOverviewAnalysis(tasks, state)
  } else if (selected === '数据待补') {
    content = renderDataIssues(tasks, state,ledger,issueFilters)
  } else {
    content = `<div class="space-y-3"><div class="pf-overview-metrics grid grid-cols-3 gap-2 lg:grid-cols-6">${compactMetric('当前任务', `${tasks.length} 笔`)}${compactMetric('已逾期', `${byHealth('已逾期')} 笔`, '已逾期')}${compactMetric('预计逾期', `${byHealth('预计逾期')} 笔`, '预计逾期')}${compactMetric('待判定', `${byHealth('待判定')} 笔`, '待判定')}${compactMetric('临期', `${byHealth('临期')} 笔`, '临期')}${compactMetric('正常', `${byHealth('正常')} 笔`, '正常')}</div><div class="pf-quantity-summary flex min-h-10 flex-wrap items-center gap-x-6 gap-y-1 rounded-md border bg-white px-3 py-2 text-sm"><span>有效需求 <strong class="tabular-nums">${fmt(qty)}</strong> 件</span><span>归属实发 <strong class="tabular-nums">${quantityKnown?fmt(shipped):'待同步'}</strong>${quantityKnown?' 件':''}</span><span>剩余应发 <strong class="tabular-nums">${quantityKnown?fmt(left):'待同步'}</strong>${quantityKnown?' 件':''}</span><span class="text-xs text-slate-500">${e(state.filters.scope)} · ${active.length} 笔在途</span></div><div class="pf-overview-running grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">${active.length&&active.every(t=>t.sourceContext&&!t.effectiveDueAt)?renderSourceCoverage(active):renderDuePressure(active, state)}${renderPriorityCards(tasks)}</div></div>`
  }
  return `<div class="space-y-3">${sectionTabs('overview-tab', selected, [{ label: labels[0] }, { label: labels[1] }, { label: labels[2], count: ledger?issueCount:undefined }])}${tabPanel('overview-tab', selected, labels, content)}</div>`
}

interface QueueRow { node: PFNode; task: PFTask; executable: boolean; category: string; priority: number; localLate: number; localRisk: boolean; recovery: number; inputLate: number; neededAt: string | null }

function queueRows(tasks: PFTask[], team?: string): QueueRow[] {
  const taskByNode = new Map<string, PFTask>()
  tasks.forEach(task => task.nodes.forEach(node => { if (!taskByNode.has(node.id)) taskByNode.set(node.id, task) }))
  return getNodes(tasks).filter(node => !finished(node) && (!team || node.team === team)).flatMap(node => {
    const task = tasks.find(item => item.id === node.taskId) ?? taskByNode.get(node.id)
    if (!task) return []
    const a = assessTask(task)
    const now=task.asOf??snapshot
    const uncertain = node.businessState.includes('判断') || node.durationDays === null || /缺失|未匹配|冲突|待关联/.test(node.mappingState)
    const waiting = /等待|未到|受阻|待输入/.test(node.businessState)
    const executable = !waiting && (Boolean(node.actualStartAt) || Boolean(!uncertain && node.actualReadyAt && Date.parse(node.actualReadyAt) <= Date.parse(now)) || /可执行|进行中|部分完成/.test(node.businessState))
    const due = nodeDue(node)
    const localLate = node.actualOverdueDays > 0 ? node.actualOverdueDays : node.actualStartAt && due ? Math.max(0, (Date.parse(now) - Date.parse(due)) / day) : 0
    const localRisk = localLate === 0 && Boolean(due && node.predictedEndAt && Date.parse(node.predictedEndAt) > Date.parse(due))
    const predecessorNodes = node.predecessors.map(id => task.nodes.find(item => item.id === id))
    const knownReadyAt = node.actualReadyAt ?? (predecessorNodes.length && predecessorNodes.every(item => item?.actualEndAt) ? predecessorNodes.map(item => item!.actualEndAt!).sort().at(-1) : null)
    const inputLate = node.upstreamDelayDays ?? (knownReadyAt && node.standardStartAt ? Math.max(0, (Date.parse(knownReadyAt) - Date.parse(node.standardStartAt)) / day) : 0)
    const upstreamKnown = node.upstreamDelayDays !== undefined || Boolean(knownReadyAt) || node.predecessors.length === 0
    const recovery = node.recoverDays ?? (node.neededFinishAt && due ? Math.max(0, (Date.parse(due) - Date.parse(node.neededFinishAt)) / day) : 0)
    const daysLeft = due ? (Date.parse(due) - Date.parse(now)) / day : null
    let category = '正常执行'
    if (uncertain) category = '待判断 / 待补数'
    else if (!executable) category = '等待上游 / 需协调'
    else if (inputLate > 0 && (localLate > 0 || localRisk)) category = '上游与本环节都异常'
    else if (localLate > 0) category = upstreamKnown ? '上游正常 · 本项已逾期' : '本项已逾期 · 上游待核对'
    else if (inputLate > 0 || recovery > 0) category = '上游晚到 · 本项需追回'
    else if (localRisk) category = upstreamKnown ? '上游正常 · 本项预计逾期' : '本项预计逾期 · 上游待核对'
    else if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 3) category = daysLeft <= 1 ? '临期 · 0～1 天' : daysLeft <= 2 ? '临期 · 1～2 天' : '临期 · 2～3 天'
    const priority = !executable ? (uncertain || a.health === '已逾期' || a.health === '预计逾期' ? 1 : 2) : a.health === '已逾期' ? 0 : a.health === '预计逾期' || recovery > 0 ? 1 : localLate > 0 || localRisk || (daysLeft !== null && daysLeft <= 1) ? 2 : 3
    return [{ node, task, executable, category, priority, localLate, localRisk, recovery, inputLate, neededAt: node.neededFinishAt ?? node.baselineDueAt }]
  }).sort((a, b) => a.priority - b.priority || Date.parse(a.neededAt ?? '9999-01-01') - Date.parse(b.neededAt ?? '9999-01-01') || remaining(b.node) - remaining(a.node))
}

function queueColumns(): StandardListColumn<QueueRow>[] {
  return [
    { key: 'priority', title: '优先级与处置原因', width: 220, required: true, sortable: true, sortValue: row => row.priority, render: row => `<div class="flex items-center gap-2">${badge(`P${row.priority}`)}${badge(row.executable ? '可执行' : '需协调')}</div><div class="mt-2 max-w-48 whitespace-normal text-sm ${row.localLate > 0 ? 'text-red-600' : row.recovery > 0 || row.localRisk ? 'text-amber-700' : 'text-slate-600'}">${e(row.category)}</div>` },
    { key: 'work', title: '工作项 / 责任人', width: 240, required: true, freezeable: true, render: row => `<button type="button" class="max-w-56 whitespace-normal text-left font-medium text-blue-600 hover:underline" data-pf-action="open-node" data-task-id="${e(row.task.id)}" data-node-id="${e(row.node.id)}" data-skip-page-rerender="true">${e(row.node.name)}</button><div class="mt-1 text-xs text-slate-500">${e(row.node.team)} · ${e(row.node.owner || '待指派')}</div><div class="mt-1 text-xs text-slate-500">${e(row.node.id)}</div>` },
    { key: 'task', title: '来源生产任务 / 跟单', width: 230, render: row => `${anchor(row.task.id, `${base}/tasks/${row.task.id}`)}${styleCell(row.task)}<div class="mt-1 text-xs text-slate-500">协调：${e(row.task.follower)}</div>` },
    { key: 'time', title: '本项截止 / 守整体需完成', width: 185, sortable: true, sortValue: row => row.neededAt, render: row => `<div>本项 ${dt(nodeDue(row.node))}</div><div class="mt-1 font-medium text-amber-700">整体需 ${dt(row.neededAt)}</div><div class="mt-1 text-xs text-slate-500">预计 ${dt(row.node.predictedEndAt)}</div>` },
    { key: 'delay', title: '上游带入 / 本项延误', width: 160, render: row => `<div>上游晚 ${row.node.upstreamDelayDays===undefined&&!row.node.standardStartAt?'待判定':elapsed(row.inputLate)}</div><div class="mt-1 ${row.localLate > 0 ? 'text-red-600' : 'text-slate-500'}">本项已晚 ${nodeDue(row.node)?elapsed(row.localLate):'待判定'}</div><div class="mt-1 ${row.recovery > 0 ? 'font-medium text-amber-700' : 'text-slate-500'}">需要追回 ${row.node.neededFinishAt?elapsed(row.recovery):'待判定'}</div>` },
    { key: 'quantity', title: '合格进度 / 剩余', width: 150, sortable: true, sortValue: row => remaining(row.node), render: row => row.node.quantityKnown===false?'<span>进度及剩余待同步</span>':`<div class="tabular-nums">${fmt(row.node.qualifiedQty)} / ${fmt(row.node.requiredQty)} ${e(row.node.unit)}</div><div class="mt-1 text-xs font-medium text-slate-600">剩余 ${fmt(remaining(row.node))} ${e(row.node.unit)}</div>` },
    { key: 'capacity', title: '分配能力 / 守期所需', width: 160, render: row => row.node.allocatedCapacityPerDay !== undefined ? `<div>${fmt(row.node.allocatedCapacityPerDay)} ${e(row.node.unit)} / 日</div><div class="mt-1 text-xs text-slate-500">所需 ${row.node.requiredCapacityPerDay !== undefined ? fmt(row.node.requiredCapacityPerDay) : '待核定'} ${e(row.node.unit)} / 日</div>${row.node.capacityGapPerDay ? `<div class="mt-1 text-xs text-amber-700">缺口 ${fmt(row.node.capacityGapPerDay)} / 日</div>` : ''}` : '<span class="text-xs text-slate-500">非数量预测 / 能力待补</span>' },
    { key: 'blocker', title: '输入或当前阻断', width: 225, render: row => `<div class="max-w-52 whitespace-normal text-xs leading-relaxed text-slate-600">${e(row.node.blocker || row.node.releaseReason || (row.executable ? '本批已具备执行条件' : '需确认前置与可执行数量'))}</div>` },
    { key: 'actions', title: '操作', width: 108, actionColumn: true, render: row => button('查看工作', 'open-node', `data-task-id="${e(row.task.id)}" data-node-id="${e(row.node.id)}"`) },
  ]
}

interface TeamRow { team: string; nodes: PFNode[]; queue: QueueRow[]; affectedTasks: number }

export function renderTeams(tasks: PFTask[], state: ViewState): string {
  const matches=(node:PFNode)=>(state.filters.team==='全部'||node.team===state.filters.team)&&(!state.filters.factory||state.filters.factory==='全部'||(node.factory||'未指定')===state.filters.factory)
  const nodes = getNodes(tasks).filter(matches)
  const queues = queueRows(tasks).filter(row=>matches(row.node))
  const teams = [...new Set(nodes.map(node => node.team).filter(Boolean))].map(team => ({ team, nodes: nodes.filter(node => node.team === team), queue: queues.filter(row => row.node.team === team), affectedTasks: tasks.filter(task => task.nodes.some(node => node.team === team)).length }))
  if (state.teamId) {
    const team = teams.find(item => item.team === state.teamId)
    if (!team) return card('团队暂无匹配记录', `${note('当前筛选范围内没有该团队的工作。可返回团队列表或重置条件。')}${anchor('返回团队与工厂', `${base}/teams`)}`)
    const executable = team.queue.filter(row => row.executable)
    const coordination = team.queue.filter(row => !row.executable)
    const localLate = team.queue.filter(row => row.localLate > 0).length
    const recovery = team.queue.filter(row => row.recovery > 0 || row.inputLate > 0).length
    const localRisk = team.queue.filter(row => row.localRisk).length
    const delivered = team.nodes.filter(node => Boolean(node.actualEndAt) && !['已取消', '不适用'].includes(node.businessState))
    const labels = ['可执行工作', '需要协调', '交付记录']
    const selected = labels.includes(state.teamTab) ? state.teamTab : labels[0]
    const content = selected === '交付记录'
      ? `${renderTeamResults(team)}${renderTeamHistory(delivered, tasks, team.team, state)}`
      : selected === '需要协调'
        ? renderDataTable(`pf-team-coordination-${team.team}`, '需要协调 · 先恢复输入与判断条件', queueColumns(), coordination, state)
        : renderDataTable(`pf-team-executable-${team.team}`, '可执行工作 · 按优先级安排本环节', queueColumns(), executable, state)
    return `<div class="space-y-3"><div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-base font-semibold">${e(team.team)}</h2><p class="mt-1 text-xs text-slate-500">${team.affectedTasks} 笔关联任务 · 工作实例按 ID 去重</p></div>${anchor('返回团队与工厂', `${base}/teams`)}</div><div class="pf-team-metrics grid grid-cols-3 gap-2">${compactMetric('本项已逾期', `${localLate} 项`, undefined, localLate ? '已逾期' : undefined)}${compactMetric('本项预计逾期', `${localRisk} 项`, undefined, localRisk ? '预计逾期' : undefined)}${compactMetric('上游晚到 / 需追回', `${recovery} 项`, undefined, recovery ? '预计逾期' : undefined)}</div>${sectionTabs('team-tab', selected, [{ label: labels[0], count: executable.length }, { label: labels[1], count: coordination.length }, { label: labels[2], count: delivered.length }])}${tabPanel('team-tab', selected, labels, `<div class="space-y-3">${content}</div>`)}</div>`

  }
  const columns: StandardListColumn<TeamRow>[] = [
    { key: 'team', title: '责任团队 / 工厂', width: 200, required: true, freezeable: true, sortable: true, sortValue: row => row.team, render: row => `<div class="font-medium">${anchor(row.team, `${base}/teams/${encodeURIComponent(row.team)}`)}</div><div class="mt-1 text-xs text-slate-500">关联 ${row.affectedTasks} 笔任务</div>` },
    { key: 'executable', title: '可执行', width: 110, sortable: true, align: 'right', sortValue: row => row.queue.filter(item => item.executable).length, render: row => `${row.queue.filter(item => item.executable).length} 项` },
    { key: 'coordination', title: '等待 / 协调', width: 120, sortable: true, align: 'right', sortValue: row => row.queue.filter(item => !item.executable).length, render: row => `${row.queue.filter(item => !item.executable).length} 项` },
    { key: 'ownLate', title: '本项已逾期', width: 130, sortable: true, align: 'right', sortValue: row => row.queue.filter(item => item.localLate > 0).length, render: row => `<span class="${row.queue.some(item => item.localLate > 0) ? 'font-medium text-red-600' : ''}">${row.queue.filter(item => item.localLate > 0).length} 项</span>` },
    { key: 'risk', title: '本项风险', width: 110, sortable: true, align: 'right', sortValue: row => row.queue.filter(item => item.localRisk).length, render: row => `<span class="${row.queue.some(item => item.localRisk) ? 'text-amber-700' : ''}">${row.queue.filter(item => item.localRisk).length} 项</span>` },
    { key: 'recovery', title: '上游晚到 / 需追回', width: 160, sortable: true, align: 'right', sortValue: row => row.queue.filter(item => item.inputLate > 0 || item.recovery > 0).length, render: row => `${row.queue.filter(item => item.inputLate > 0 || item.recovery > 0).length} 项` },
    { key: 'critical', title: '最高优先工作', width: 280, render: row => row.queue[0] ? `<div class="max-w-64 whitespace-normal text-sm">P${row.queue[0].priority} · ${e(row.queue[0].node.name)}</div><div class="mt-1 text-xs text-slate-500">${e(row.queue[0].category)}</div>` : '<span class="text-xs text-slate-500">当前范围暂无待处理工作</span>' },
    { key: 'actions', title: '操作', width: 108, actionColumn: true, render: row => anchor('查看队列', `${base}/teams/${encodeURIComponent(row.team)}`) },
  ]
  return `<div class="space-y-4"><div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${metric('涉及组织', `${teams.length} 个`, '来自当前任务责任分工')}${metric('可执行工作', `${queues.filter(row => row.executable).length} 项`, '工作实例去重')}${metric('需要协调', `${queues.filter(row => !row.executable).length} 项`, '前置、判断、规则与数据')}${metric('需追回工作', `${queues.filter(row => row.recovery > 0).length} 项`, '守住整体需要提前完成')}</div>${note('选择团队进入主管工作队列。工作项涉及的任务数可以跨团队重复，不能将各团队任务数相加作为全局任务总数。')}${renderDataTable('pf-teams', '责任团队与工厂', columns, teams, state)}</div>`
}

interface TeamHistoryRow { node: PFNode; tasks: PFTask[] }

function renderTeamHistory(nodes: PFNode[], tasks: PFTask[], team: string, state: ViewState): string {
  const rows: TeamHistoryRow[] = nodes.map(node => ({ node, tasks: tasks.filter(task => task.nodes.some(item => item.id === node.id)) }))
    .sort((a, b) => Date.parse(b.node.actualEndAt!) - Date.parse(a.node.actualEndAt!))
  const columns: StandardListColumn<TeamHistoryRow>[] = [
    { key: 'work', title: '已交付工作 / 责任人', width: 235, required: true, freezeable: true, render: row => `<div class="max-w-56 whitespace-normal font-medium">${e(row.node.name)}</div><div class="mt-1 text-xs text-slate-500">${e(row.node.id)} · ${e(row.node.owner || '待指派')}</div>` },
    { key: 'task', title: '关联生产任务 / 款式', width: 245, render: row => row.tasks.map(task => `<div class="mb-2">${anchor(task.id, `${base}/tasks/${task.id}`)}${styleCell(task)}</div>`).join('') },
    { key: 'quantity', title: '合格 / 应完成', width: 135, sortable: true, sortValue: row => row.node.qualifiedQty, render: row => row.node.quantityKnown===false?'进度待同步':`${fmt(row.node.qualifiedQty)} / ${fmt(row.node.requiredQty)} ${e(row.node.unit)}` },
    { key: 'completed', title: '实际完成', width: 165, sortable: true, sortValue: row => row.node.actualEndAt, render: row => dt(row.node.actualEndAt) },
    { key: 'due', title: '本项截止', width: 165, sortable: true, sortValue: row => nodeDue(row.node), render: row => dt(nodeDue(row.node)) },
    { key: 'result', title: '交付时效', width: 145, render: row => {
      const due = nodeDue(row.node)
      if (!due) return badge('时效待判定')
      const late = Math.max(0, (Date.parse(row.node.actualEndAt!) - Date.parse(due)) / day)
      return late > 0 ? `${badge('逾期完成')}<div class="mt-1 text-xs text-red-600">晚 ${elapsed(late)}</div>` : badge('按期完成')
    } },
    { key: 'source', title: '完成依据', width: 185, render: row => `<div class="max-w-44 whitespace-normal text-xs">${e(row.node.sourceDocumentType)} · ${e(row.node.sourceDocumentId)}</div><div class="mt-1 text-xs text-slate-500">${e(row.node.businessState)}</div>` },
    { key: 'actions', title: '操作', width: 108, actionColumn: true, render: row => row.tasks[0] ? button('查看工作', 'open-node', `data-task-id="${e(row.tasks[0].id)}" data-node-id="${e(row.node.id)}"`) : '<span class="text-xs text-slate-500">来源待关联</span>' },
  ]
  return renderDataTable(`pf-team-history-${team}`, '交付记录 · 仅计有实际完成时间的工作', columns, rows, state)
}

function renderTeamResults(team: TeamRow): string {
  const comparable = team.nodes.filter(node => node.actualEndAt && nodeDue(node) && !['已取消', '不适用'].includes(node.businessState))
  const late = comparable.filter(node => Date.parse(node.actualEndAt!) > Date.parse(nodeDue(node)!))
  const delays = late.map(node => Math.max(0, (Date.parse(node.actualEndAt!) - Date.parse(nodeDue(node)!)) / day))
  const recovered = comparable.reduce((sum, node) => sum + (node.upstreamDelayDays && nodeDue(node) ? Math.min(node.upstreamDelayDays, Math.max(0, (Date.parse(nodeDue(node)!) - Date.parse(node.actualEndAt!)) / day)) : 0), 0)
  return `<div class="rounded-md border bg-white px-3 py-2"><div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600"><span>可比较完成 <strong>${comparable.length}</strong> 项</span><span>逾期完成 <strong class="${late.length ? 'text-red-600' : ''}">${late.length}</strong> 项</span><span>最长本项逾期 <strong>${comparable.length ? elapsed(Math.max(0, ...delays)) : '—'}</strong></span><span>累计追回 <strong>${elapsed(recovered)}</strong></span></div><p class="mt-1 text-xs text-slate-500">完成后历史超时不继续累加；累计追回按工作项统计，不能作为任务整体提前天数。</p></div>`
}

export interface OrderRow {
  orderNo: string; facts: ShipmentOrderFact[]; placedAt: string; completedAt: string | null;
  shippedQty: number; effectiveQty: number; requiredDays: number | null; actualDays: number | null;
  overdueDays: number | null; complete: boolean; completionType: string; taskIds: string[];
}

function shipmentTiming(fact: ShipmentOrderFact): { actual: number | null; late: number | null; label: string } {
  const placed = Date.parse(fact.placedAt)
  const shipped = Date.parse(fact.shippedAt)
  const actual = Number.isFinite(placed) && Number.isFinite(shipped) && shipped >= placed ? (shipped - placed) / day : null
  const late = actual !== null && Number.isFinite(fact.requiredDays) && fact.requiredDays >= 0 ? Math.max(0, actual - fact.requiredDays) : null
  return { actual, late, label: late === null ? '时效待判定' : late > 0 ? `已超时 ${fmt(late)} 天` : '本次按期' }
}

export function aggregateOrders(orders: ShipmentOrderFact[]): OrderRow[] {
  const groups = new Map<string, ShipmentOrderFact[]>()
  orders.forEach(fact => groups.set(fact.orderNo, [...(groups.get(fact.orderNo) ?? []), fact]))
  return [...groups.entries()].map(([orderNo, facts]) => {
    const dedup = [...new Map(facts.map(fact => [`${fact.shipmentId}:${fact.orderLineId}:${fact.taskId}`, fact])).values()]
    const first = dedup[0]
    const shippedQty = dedup.reduce((sum, fact) => sum + fact.shippedQty, 0)
    const effectiveQty = Math.max(...dedup.map(fact => fact.orderEffectiveQty))
    const allLineIds = [...new Set(dedup.flatMap(fact => fact.allOrderLineIds))]
    const completionType = dedup.find(fact => /取消|减量/.test(fact.orderCompletionType))?.orderCompletionType ?? first.orderCompletionType
    const complete = dedup.every(fact => fact.orderScopeConfirmed) && !/取消|减量/.test(completionType) && effectiveQty > 0 && shippedQty >= effectiveQty && allLineIds.every(id => dedup.some(fact => fact.orderLineId === id))
    const completedAt = complete ? dedup.map(fact => fact.orderCompletedAt || fact.shippedAt).sort().at(-1) ?? null : null
    const placedAt = dedup.map(fact => fact.placedAt).filter(Boolean).sort()[0] ?? ''
    const requiredDays = dedup.every(fact => Number.isFinite(fact.requiredDays) && fact.requiredDays >= 0 && fact.requiredDays === first.requiredDays) ? first.requiredDays : null
    const actualDays = completedAt && placedAt ? (Date.parse(completedAt) - Date.parse(placedAt)) / day : null
    return { orderNo, facts: dedup, placedAt, completedAt, shippedQty, effectiveQty, requiredDays, actualDays, overdueDays: actualDays !== null && requiredDays !== null ? Math.max(0, actualDays - requiredDays) : null, complete, completionType, taskIds: [...new Set(dedup.map(fact => fact.taskId))] }
  })
}

/** Date filtering belongs to the fulfillment fact, never to the originating production deadline. */
export function fulfillmentRows(orders: ShipmentOrderFact[], state: ViewState): { facts: ShipmentOrderFact[]; orders: OrderRow[] } {
  const unique = [...new Map(orders.map(fact => [`${fact.shipmentId}:${fact.orderLineId}:${fact.taskId}`, fact])).values()]
  const inRange = (value: string | null): boolean => {
    if (!state.filters.dateFrom && !state.filters.dateTo) return true
    if (!value || !Number.isFinite(Date.parse(value))) return false
    const date = localDate(value, state.timezone)
    return (!state.filters.dateFrom || date >= state.filters.dateFrom)
      && (!state.filters.dateTo || date <= state.filters.dateTo)
  }
  if (state.fulfillmentMode === '完整订单') {
    // Aggregate first so the final shipment period retains earlier batches required to prove completion.
    const completed = aggregateOrders(unique).filter(order => order.complete && inRange(order.completedAt))
    return { facts: completed.flatMap(order => order.facts), orders: completed }
  }
  const facts = unique.filter(fact => inRange(fact.shippedAt))
  return { facts, orders: aggregateOrders(facts) }
}

function productionResults(taskIds: string[], tasks: PFTask[]): string {
  return taskIds.map(taskId => {
    const task = tasks.find(item => item.id === taskId)
    return `<div class="mb-1">${anchor(taskId, `${base}/tasks/${taskId}`)}<span class="ml-2">${task ? badge(assessTask(task).health) : badge('生产来源待确认')}</span></div>`
  }).join('')
}

export function renderFulfillment(tasks: PFTask[], orders: ShipmentOrderFact[], state: ViewState): string {
  const selected = fulfillmentRows(orders, state)
  const uniqueFacts = selected.facts
  const grouped = selected.orders
  const completeOrders = grouped.filter(order => order.complete)
  const comparableOrders = completeOrders.filter(order => order.overdueDays !== null)
  const lateOrders = comparableOrders.filter(order => order.overdueDays! > 0)
  const comparableFacts = uniqueFacts.filter(fact => shipmentTiming(fact).late !== null)
  const lateFacts = comparableFacts.filter(fact => shipmentTiming(fact).late! > 0)
  const shippedQty = comparableFacts.reduce((sum, fact) => sum + fact.shippedQty, 0)
  const lateQty = lateFacts.reduce((sum, fact) => sum + fact.shippedQty, 0)
  const orderRate = comparableOrders.length ? `${fmt(lateOrders.length / comparableOrders.length * 100)}%` : '—'
  const weightedRate = shippedQty ? `${fmt(lateQty / shippedQty * 100)}%` : '—'
  const fullMode = state.fulfillmentMode === '完整订单'
  const modeButtons = ['发货行', '完整订单', '时钟对照'].map(mode => `<button type="button" data-pf-action="fulfillment-mode" data-value="${mode}" data-skip-page-rerender="true" aria-pressed="${state.fulfillmentMode === mode}" class="rounded-md px-4 py-2 text-sm ${state.fulfillmentMode === mode ? 'bg-blue-600 font-medium text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${mode === '发货行' ? '按实际发货行' : mode === '完整订单' ? '按完整客户订单' : '生产与订单时钟对照'}</button>`).join('')
  const lineColumns: StandardListColumn<ShipmentOrderFact>[] = [
    { key: 'order', title: '客户订单 / 发货行', width: 200, required: true, freezeable: true, render: fact => `<div class="font-medium">${e(fact.orderNo)}</div><div class="mt-1 text-xs text-slate-500">${e(fact.orderLineId)}</div>` },
    { key: 'result', title: '本次时效结果', width: 130, required: true, sortable: true, sortValue: fact => shipmentTiming(fact).late, render: fact => badge(shipmentTiming(fact).label) },
    { key: 'times', title: '客户下单 / 实际发货', width: 180, sortable: true, sortValue: fact => fact.shippedAt, render: fact => `<div>下单 ${dt(fact.placedAt)}</div><div class="mt-1">实发 ${dt(fact.shippedAt)}</div>` },
    { key: 'duration', title: '要求 / 实际自然日', width: 145, sortable: true, sortValue: fact => shipmentTiming(fact).actual, render: fact => `<div>要求 ${elapsed(fact.requiredDays)}</div><div class="mt-1 ${(shipmentTiming(fact).late ?? 0) > 0 ? 'text-red-600' : 'text-slate-600'}">实际 ${elapsed(shipmentTiming(fact).actual)}</div>` },
    { key: 'qty', title: '本次实发', width: 115, align: 'right', sortable: true, sortValue: fact => fact.shippedQty, render: fact => `${fmt(fact.shippedQty)} ${e(fact.unit)}` },
    { key: 'production', title: '生产来源 / 任务时效', width: 265, render: fact => productionResults([fact.taskId], tasks) },
    { key: 'batch', title: '发货批次 / 关联时间', width: 205, render: fact => `<div>${e(fact.shipmentId)}</div><div class="mt-1 text-xs text-slate-500">关联 ${dt(fact.associatedAt)}</div>` },
    { key: 'complete', title: '全单履约口径', width: 155, render: fact => { const order = grouped.find(item => item.orderNo === fact.orderNo)!; return `${badge(order.complete ? '全单已发完' : '仅本次事实')}<div class="mt-1 text-xs text-slate-500">${e(order.completionType || '范围待确认')}</div>` } },
    { key: 'actions', title: '操作', width: 112, actionColumn: true, render: fact => anchor('查看生产来源', `${base}/tasks/${fact.taskId}`) },
  ]
  const orderColumns: StandardListColumn<OrderRow>[] = [
    { key: 'order', title: '客户订单', width: 180, required: true, freezeable: true, render: order => `<div class="font-medium">${e(order.orderNo)}</div><div class="mt-1 text-xs text-slate-500">${order.facts.length} 条实发事实</div>` },
    { key: 'result', title: '全单时效结果', width: 135, required: true, sortable: true, sortValue: order => order.overdueDays, render: order => badge(order.overdueDays === null ? '待判定' : order.overdueDays > 0 ? `已超时 ${fmt(order.overdueDays)} 天` : '全单按期') },
    { key: 'times', title: '客户下单 / 全单完成', width: 180, sortable: true, sortValue: order => order.completedAt, render: order => `<div>下单 ${dt(order.placedAt)}</div><div class="mt-1">完成 ${dt(order.completedAt)}</div>` },
    { key: 'duration', title: '要求 / 全单实际自然日', width: 175, sortable: true, sortValue: order => order.actualDays, render: order => `<div>要求 ${elapsed(order.requiredDays)}</div><div class="mt-1 ${order.overdueDays && order.overdueDays > 0 ? 'text-red-600' : 'text-slate-600'}">实际 ${elapsed(order.actualDays)}</div>` },
    { key: 'qty', title: '实发 / 有效应发', width: 145, align: 'right', render: order => `${fmt(order.shippedQty)} / ${fmt(order.effectiveQty)} 件` },
    { key: 'production', title: '实际生产来源 / 任务时效', width: 285, render: order => productionResults(order.taskIds, tasks) },
    { key: 'scope', title: '完成类型 / 可比性', width: 185, render: order => `<div>${e(order.completionType)}</div><div class="mt-1 text-xs text-slate-500">${order.overdueDays !== null ? '纳入完整订单及时率' : '缺要求，排除时效分母'}</div>` },
  ]
  const taskIds = [...new Set(uniqueFacts.map(fact => fact.taskId))]
  const contrasts = tasks.filter(task => taskIds.includes(task.id) && ['按期完成', '正常', '临期'].includes(assessTask(task).health) && uniqueFacts.some(fact => fact.taskId === task.id && (shipmentTiming(fact).late ?? 0) > 0))
  const factsTable = fullMode ? renderDataTable('pf-fulfillment-orders', '已完整实发的客户订单', orderColumns, completeOrders, state) : renderDataTable('pf-fulfillment-lines', '实际发货关联记录', lineColumns, uniqueFacts, state)
  const navigation=`<nav class="pf-fulfillment-tabs" aria-label="订单履约视图">${modeButtons}</nav>`
  if(!uniqueFacts.length&&tasks.some(t=>t.sourceContext))return navigation+card('实际发货数据待同步','<div class="pf-source-empty"><strong>当前范围尚未读取到可归属的实际发货记录</strong><p>客户订单在实际发货时确认；发货事实和数量齐备后再核算下单至发货时效。</p></div>')
  if(state.fulfillmentMode==='时钟对照')return navigation+(contrasts.length ? card('生产任务与客户订单 · 两个独立时钟', `<div class="space-y-3">${contrasts.map(task => `<div class="rounded-md border border-amber-200 bg-amber-50 p-3"><div class="flex flex-wrap items-center gap-2">${anchor(task.id, `${base}/tasks/${task.id}`)}${badge(assessTask(task).health)}<span class="text-sm text-amber-900">对应已发客户订单存在超时</span></div><p class="mt-2 text-xs leading-relaxed text-slate-600">生产任务从采购 / 需求下单起计；客户订单从各自下单起计。${task.completedAt ? `生产 ${dt(task.completedAt)} 完成，任务截止 ${dt(task.effectiveDueAt)}。` : '当前任务尚未全部发货，后续订单集合仍未建立。'}${uniqueFacts.filter(fact => fact.taskId === task.id && (shipmentTiming(fact).late ?? 0) > 0).map(fact => `${fact.orderNo} 实际 ${fmt(shipmentTiming(fact).actual)} 天 / 要求 ${fmt(fact.requiredDays)} 天。`).map(e).join(' ')}</p></div>`).join('')}</div>`) : '')+note('生产任务与客户订单分别按自己的起点核算；只比较已经实际发货并明确归属的订单。')
  return `${navigation}<div class="grid grid-cols-2 gap-3 xl:grid-cols-5">${metric('实际关联订单', `${grouped.length} 个`, `来自 ${taskIds.length} 笔生产任务`)}${metric('可比较完整订单', `${comparableOrders.length} 个`, `${grouped.length - comparableOrders.length} 个未纳入完整订单分母`)}${metric('完整订单超时率', orderRate, `${lateOrders.length} / ${comparableOrders.length} 个订单`)}${metric(fullMode ? '完成订单实发数量' : '可判定实发数量', `${fmt(shippedQty)} 件`, `${comparableFacts.length} 条实发记录${fullMode ? ' · 含跨期批次' : ''}`)}${metric('超时实发数量占比', weightedRate, `${fmt(lateQty)} / ${fmt(shippedQty)} 件`)}</div>${factsTable}<details class="pf-metric-definition"><summary>查看当前指标口径与分母</summary><p>${fullMode?'全单范围明确且全部实发后，才进入完整订单视图；取消余量关闭不冒充全部发货。':'按所选期间实发行核算，首次发货不代表全单完成。数量占比按本次实发件数加权。'}</p><p>完整订单超时率 ${lateOrders.length}/${comparableOrders.length}；超时实发数量占比 ${fmt(lateQty)}/${fmt(shippedQty)} 件。未实际发货部分不推定客户订单名单；客户取消不自动调減生产任务。</p></details>`
}
