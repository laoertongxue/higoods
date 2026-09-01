// @page-pattern: dashboard

import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  claimPostFinishingQcTask,
  getCurrentPostFinishingActor,
  listPostFinishingFullFlowQcTasks,
  releasePostFinishingQcTask,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingPageHeader, renderPostStatusBadge } from './shared.ts'

let message = ''
let messageTone: 'success' | 'error' = 'success'

function params(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function refresh(): void {
  const current = params()
  current.set('refresh', String(Date.now()))
  appStore.navigate(`/fcs/craft/post-finishing/qc-orders?${current.toString()}`)
}

function renderMessage(): string {
  if (!message) return ''
  return `<div role="status" class="rounded-lg border px-4 py-3 text-sm ${messageTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}">${escapeHtml(message)}</div>`
}

function renderTaskInput(): string {
  const actor = getCurrentPostFinishingActor()
  return `<section class="rounded-xl border border-blue-200 bg-blue-50 p-4" data-qc-task-entry>
    <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-lg font-semibold text-blue-950">输入质检任务号</h2><p class="mt-1 text-sm text-blue-800">Web 端输入完整任务号后领取；一个任务只对应一名质检员。</p></div><div class="rounded-lg bg-white px-3 py-2 text-right text-xs"><div class="font-semibold">当前质检员：${escapeHtml(actor.actorName)}</div><div class="mt-1 text-muted-foreground">${escapeHtml(actor.roleName)}</div></div></div>
    <div class="mt-4 flex flex-col gap-2 sm:flex-row"><input autofocus class="h-11 min-w-0 flex-1 rounded-md border border-blue-300 bg-white px-3 font-mono" placeholder="请输入完整质检任务号，例如 PO-QC-202608-001-1" data-qc-task-input /><button type="button" class="h-11 rounded-md bg-blue-600 px-6 text-sm font-semibold text-white" data-post-finishing-action="full-flow-claim-qc-from-list">领取并开始质检</button></div>
    <div class="mt-3 text-xs text-blue-800">若任务已被领取，系统会明确提示“已由 XX 质检员质检中”；错误领取可在任务内退领，主管也可在下方列表释放。</div>
  </section>`
}

export function renderPostFinishingQcOrdersPage(): string {
  const actor = getCurrentPostFinishingActor()
  const isSupervisor = actor.roleName === 'QC主管'
  const keyword = params().get('keyword')?.trim().toLowerCase() || ''
  const status = params().get('status') || ''
  const owner = params().get('owner')?.trim().toLowerCase() || ''
  const allRecords = listPostFinishingFullFlowQcTasks()
  const records = allRecords.filter((task) => {
    const text = [task.qcTaskNo, task.deliveryOrderNo, task.productionOrderNo, task.claimedBy?.actorName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return (isSupervisor || task.claimedBy?.actorId === actor.actorId)
      && (!keyword || text.includes(keyword))
      && (!status || task.status === status)
      && (!owner || task.claimedBy?.actorName.toLowerCase().includes(owner))
  })
  const countSource = isSupervisor ? allRecords : allRecords.filter((task) => task.claimedBy?.actorId === actor.actorId)
  const counts = countSource.reduce<Record<string, number>>((result, task) => {
    result[task.status] = (result[task.status] || 0) + 1
    return result
  }, {})
  const rows = records.map((task) => `<tr data-qc-task-row="${escapeHtml(task.qcTaskNo)}">
    <td class="px-3 py-3 font-mono font-semibold">${escapeHtml(task.qcTaskNo)}</td>
    <td class="px-3 py-3"><div>${escapeHtml(task.deliveryOrderNo)}</div><div class="text-xs text-muted-foreground">${escapeHtml(task.productionOrderNo)}</div></td>
    <td class="px-3 py-3">第 ${task.returnIndex} 次</td>
    <td class="px-3 py-3">${task.lines.reduce((sum, line) => sum + line.expectedQty, 0)} 件 / ${task.lines.length} SKU</td>
    <td class="px-3 py-3">${escapeHtml(task.claimedBy?.actorName || '未领取')}${task.claimedAt ? `<div class="text-xs text-muted-foreground">${escapeHtml(new Date(task.claimedAt).toLocaleString('zh-CN'))}</div>` : ''}</td>
    <td class="px-3 py-3">${escapeHtml(new Date(task.sentAt).toLocaleString('zh-CN'))}</td>
    <td class="px-3 py-3">${renderPostStatusBadge(task.status)}</td>
    <td class="sticky right-0 bg-card px-3 py-3"><div class="flex flex-wrap gap-2"><a data-nav="/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(task.qcTaskNo)}" class="text-blue-700 hover:underline">进入任务</a>${isSupervisor && task.status === '质检中' ? `<button type="button" class="text-amber-700 hover:underline" data-post-finishing-action="full-flow-supervisor-release-qc" data-task-id="${escapeHtml(task.qcTaskId)}">主管释放</button>` : ''}</div></td>
  </tr>`).join('')

  return `<div class="space-y-4 p-4" data-testid="post-finishing-qc-management-page">
    ${renderPostFinishingPageHeader('质检任务', '输入领取与主管管理合并在同一个菜单页面')}
    ${renderMessage()}
    ${renderTaskInput()}
    <div class="grid gap-3 sm:grid-cols-3"><div class="rounded-xl border bg-card p-4"><div class="text-xs text-muted-foreground">待质检</div><strong class="mt-1 block text-2xl">${counts['待质检'] || 0}</strong></div><div class="rounded-xl border bg-card p-4"><div class="text-xs text-muted-foreground">质检中</div><strong class="mt-1 block text-2xl">${counts['质检中'] || 0}</strong></div><div class="rounded-xl border bg-card p-4"><div class="text-xs text-muted-foreground">质检完成</div><strong class="mt-1 block text-2xl">${counts['质检完成'] || 0}</strong></div></div>
    ${isSupervisor ? `<section class="rounded-xl border bg-card p-4"><div><h2 class="font-semibold">质检任务管理</h2><p class="mt-1 text-xs text-muted-foreground">当前账号为 QC 主管，可筛选全部任务并释放错误占用。</p></div><form class="mt-4 grid gap-3 md:grid-cols-3" action="/fcs/craft/post-finishing/qc-orders"><label class="text-xs text-muted-foreground">单号 / 生产单<input name="keyword" value="${escapeHtml(params().get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">状态<select name="status" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"><option value="">全部</option>${['待质检','质检中','质检完成'].map((value) => `<option ${value === status ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="text-xs text-muted-foreground">当前质检员<input name="owner" value="${escapeHtml(params().get('owner') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><button class="h-9 rounded-md border px-4 text-sm md:col-span-3">筛选</button></form></section>` : '<section class="rounded-xl border bg-card px-4 py-3 text-sm"><strong>我的质检任务</strong><span class="ml-2 text-xs text-muted-foreground">待质检任务不公开展示，请输入完整任务号领取。</span></section>'}
    <div class="overflow-x-auto rounded-xl border bg-card"><table class="min-w-[1080px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">质检任务号</th><th class="px-3 py-2">送货单 / 生产单</th><th class="px-3 py-2">送货序号</th><th class="px-3 py-2">送检数量</th><th class="px-3 py-2">质检员 / 领取时间</th><th class="px-3 py-2">送检时间</th><th class="px-3 py-2">状态</th><th class="sticky right-0 bg-slate-50 px-3 py-2">操作</th></tr></thead><tbody class="divide-y">${rows || '<tr><td colspan="8" class="px-6 py-12 text-center text-muted-foreground">暂无符合条件的质检任务。后道待加工仓送检后自动出现。</td></tr>'}</tbody></table></div>
  </div>`
}

export function handlePostFinishingQcOrdersEvent(target: HTMLElement, event?: Event): boolean {
  const input = target.closest<HTMLInputElement>('[data-qc-task-input]')
    || document.querySelector<HTMLInputElement>('[data-qc-task-input]')
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-action]')
  const action = actionNode?.dataset.postFinishingAction
    || (target.matches('[data-qc-task-input]') && event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter'
      ? 'full-flow-claim-qc-from-list'
      : undefined)
  if (action !== 'full-flow-claim-qc-from-list' && action !== 'full-flow-supervisor-release-qc') return false
  try {
    if (action === 'full-flow-claim-qc-from-list') {
      const taskNo = input?.value.trim() || ''
      const claimed = claimPostFinishingQcTask({ qcTaskNo: taskNo, actor: getCurrentPostFinishingActor() })
      message = `领取成功：${claimed.qcTaskNo}`
      messageTone = 'success'
      appStore.navigate(`/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(claimed.qcTaskNo)}`)
      return true
    }
    const task = releasePostFinishingQcTask({
      qcTaskId: actionNode?.dataset.taskId || '',
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.qcSupervisor,
      reason: '主管释放异常占用',
      supervisor: true,
    })
    message = `${task.qcTaskNo} 已由主管释放并回到待质检。`
    messageTone = 'success'
  } catch (error) {
    message = error instanceof Error ? error.message : '质检任务操作失败。'
    messageTone = 'error'
  }
  refresh()
  return true
}
