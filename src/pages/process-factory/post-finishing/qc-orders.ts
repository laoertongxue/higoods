// @page-pattern: dashboard

import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  listPostFinishingFullFlowQcTasks,
  releasePostFinishingQcTask,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingPageHeader, renderPostStatusBadge } from './shared.ts'

let message = ''

function params(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function refresh(): void {
  const current = params()
  current.set('refresh', String(Date.now()))
  appStore.navigate(`/fcs/craft/post-finishing/qc-orders?${current.toString()}`)
}

export function renderPostFinishingQcOrdersPage(): string {
  const keyword = params().get('keyword')?.trim().toLowerCase() || ''
  const status = params().get('status') || ''
  const owner = params().get('owner')?.trim().toLowerCase() || ''
  const allRecords = listPostFinishingFullFlowQcTasks()
  const records = allRecords.filter((task) => {
    const text = [task.qcTaskNo, task.deliveryOrderNo, task.productionOrderNo, task.claimedBy?.actorName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return (!keyword || text.includes(keyword))
      && (!status || task.status === status)
      && (!owner || task.claimedBy?.actorName.toLowerCase().includes(owner))
  })
  const counts = allRecords.reduce<Record<string, number>>((result, task) => {
    result[task.status] = (result[task.status] || 0) + 1
    return result
  }, {})
  const rows = records.map((task) => `<tr>
    <td class="px-3 py-3 font-mono font-semibold">${escapeHtml(task.qcTaskNo)}</td>
    <td class="px-3 py-3"><div>${escapeHtml(task.deliveryOrderNo)}</div><div class="text-xs text-muted-foreground">${escapeHtml(task.productionOrderNo)}</div></td>
    <td class="px-3 py-3">第 ${task.returnIndex} 次</td>
    <td class="px-3 py-3">${task.lines.reduce((sum, line) => sum + line.expectedQty, 0)} 件 / ${task.lines.length} SKU</td>
    <td class="px-3 py-3">${escapeHtml(task.claimedBy?.actorName || '未领取')}${task.claimedAt ? `<div class="text-xs text-muted-foreground">${escapeHtml(new Date(task.claimedAt).toLocaleString('zh-CN'))}</div>` : ''}</td>
    <td class="px-3 py-3">${escapeHtml(new Date(task.sentAt).toLocaleString('zh-CN'))}</td>
    <td class="px-3 py-3">${renderPostStatusBadge(task.status)}</td>
    <td class="sticky right-0 bg-card px-3 py-3"><div class="flex flex-wrap gap-2"><a data-nav="/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(task.qcTaskNo)}" class="text-blue-700 hover:underline">查看任务</a>${task.status === '质检中' ? `<button type="button" class="text-amber-700 hover:underline" data-post-finishing-action="full-flow-supervisor-release-qc" data-task-id="${escapeHtml(task.qcTaskId)}">主管释放</button>` : ''}</div></td>
  </tr>`).join('')

  return `<div class="space-y-4 p-4" data-testid="post-finishing-qc-management-page">
    ${renderPostFinishingPageHeader('质检任务管理', '主管查看、筛选和释放异常占用；质检员必须进入 Web 质检工作台精确扫码')}
    ${message ? `<div role="status" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">${escapeHtml(message)}</div>` : ''}
    <div class="grid gap-3 sm:grid-cols-3"><div class="rounded-xl border bg-card p-4"><div class="text-xs text-muted-foreground">待质检</div><strong class="mt-1 block text-2xl">${counts['待质检'] || 0}</strong></div><div class="rounded-xl border bg-card p-4"><div class="text-xs text-muted-foreground">质检中</div><strong class="mt-1 block text-2xl">${counts['质检中'] || 0}</strong></div><div class="rounded-xl border bg-card p-4"><div class="text-xs text-muted-foreground">质检完成</div><strong class="mt-1 block text-2xl">${counts['质检完成'] || 0}</strong></div></div>
    <div class="flex flex-wrap items-end justify-between gap-3 rounded-xl border bg-card p-4"><form class="grid flex-1 gap-3 md:grid-cols-3" action="/fcs/craft/post-finishing/qc-orders"><label class="text-xs text-muted-foreground">单号 / 生产单<input name="keyword" value="${escapeHtml(params().get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">状态<select name="status" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"><option value="">全部</option>${['待质检','质检中','质检完成'].map((value) => `<option ${value === status ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="text-xs text-muted-foreground">当前质检员<input name="owner" value="${escapeHtml(params().get('owner') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><button class="h-9 rounded-md border px-4 text-sm md:col-span-3">筛选</button></form><a data-nav="/fcs/craft/post-finishing/qc-workbench" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">打开 Web 质检工作台</a></div>
    <div class="overflow-x-auto rounded-xl border bg-card"><table class="min-w-[1080px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">质检任务号</th><th class="px-3 py-2">送货单 / 生产单</th><th class="px-3 py-2">送货序号</th><th class="px-3 py-2">送检数量</th><th class="px-3 py-2">质检员 / 领取时间</th><th class="px-3 py-2">送检时间</th><th class="px-3 py-2">状态</th><th class="sticky right-0 bg-slate-50 px-3 py-2">操作</th></tr></thead><tbody class="divide-y">${rows || '<tr><td colspan="8" class="px-6 py-12 text-center text-muted-foreground">暂无符合条件的质检任务。回货确认并送检后自动出现。</td></tr>'}</tbody></table></div>
  </div>`
}

export function handlePostFinishingQcOrdersEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-action="full-flow-supervisor-release-qc"]')
  if (!actionNode) return false
  try {
    const task = releasePostFinishingQcTask({
      qcTaskId: actionNode.dataset.taskId || '',
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.qcSupervisor,
      reason: '主管释放异常占用',
      supervisor: true,
    })
    message = `${task.qcTaskNo} 已由主管释放并回到待质检。`
    refresh()
  } catch (error) {
    message = error instanceof Error ? error.message : '主管释放失败。'
    refresh()
  }
  return true
}
