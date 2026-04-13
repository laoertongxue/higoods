import { listSampleTransferGroups } from '../data/pcs-sample-view-model.ts'
import { ensureSampleBootstrapInitialized } from '../data/pcs-sample-project-writeback.ts'
import { escapeHtml } from '../utils.ts'

interface SampleTransferPageState {
  activeGroup: string
}

let state: SampleTransferPageState = {
  activeGroup: 'all',
}

export function handleSampleTransferEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-sample-transfer-action]')
  const action = actionNode?.dataset.sampleTransferAction
  if (!action) return false
  if (action === 'switch-group') {
    state.activeGroup = actionNode?.dataset.groupKey || 'all'
    return true
  }
  return false
}

export function isSampleTransferDialogOpen(): boolean {
  return false
}

export function renderSampleTransferPage(): string {
  ensureSampleBootstrapInitialized()
  const groups = listSampleTransferGroups()
  const visibleGroups = state.activeGroup === 'all'
    ? groups
    : groups.filter((group) => group.key === state.activeGroup)

  return `
    <div class="space-y-4">
      <header>
        <h1 class="text-xl font-semibold">样衣流转</h1>
        <p class="mt-1 text-sm text-muted-foreground">样衣流转页只从正式样衣台账事件分流展示，不再维护独立流转事件数组。</p>
      </header>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex flex-wrap gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm ${state.activeGroup === 'all' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:bg-gray-50'}" data-sample-transfer-action="switch-group" data-group-key="all">全部流转</button>
          ${groups.map((group) => `<button class="inline-flex h-9 items-center rounded-md border px-4 text-sm ${state.activeGroup === group.key ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:bg-gray-50'}" data-sample-transfer-action="switch-group" data-group-key="${group.key}">${escapeHtml(group.label)}</button>`).join('')}
        </div>
      </section>

      <div class="space-y-4">
        ${visibleGroups.map((group) => `
          <section class="rounded-lg border bg-card">
            <div class="border-b px-4 py-3">
              <h2 class="text-base font-semibold">${escapeHtml(group.label)}</h2>
              <p class="mt-1 text-xs text-muted-foreground">共 ${group.events.length} 条正式台账事件</p>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                    <th class="px-3 py-2 font-medium">事件编号</th>
                    <th class="px-3 py-2 font-medium">事件类型</th>
                    <th class="px-3 py-2 font-medium">样衣编号</th>
                    <th class="px-3 py-2 font-medium">样衣名称</th>
                    <th class="px-3 py-2 font-medium">来源单据</th>
                    <th class="px-3 py-2 font-medium">项目节点</th>
                    <th class="px-3 py-2 font-medium">业务时间</th>
                    <th class="px-3 py-2 font-medium">事件后状态</th>
                  </tr>
                </thead>
                <tbody>
                  ${group.events.length > 0 ? group.events.map((item) => `
                    <tr class="border-b last:border-b-0">
                      <td class="px-3 py-3 font-medium text-primary">${escapeHtml(item.ledgerEventCode)}</td>
                      <td class="px-3 py-3">${escapeHtml(item.eventName)}</td>
                      <td class="px-3 py-3">${escapeHtml(item.sampleCode)}</td>
                      <td class="px-3 py-3">${escapeHtml(item.sampleName)}</td>
                      <td class="px-3 py-3">${escapeHtml(`${item.sourceDocType} / ${item.sourceDocCode}`)}</td>
                      <td class="px-3 py-3">${escapeHtml(item.workItemTypeName || '未挂项目节点')}</td>
                      <td class="px-3 py-3">${escapeHtml(item.businessDate)}</td>
                      <td class="px-3 py-3">${escapeHtml(item.inventoryStatusAfter)}</td>
                    </tr>
                  `).join('') : '<tr><td colspan="8" class="px-4 py-12 text-center text-muted-foreground">暂无正式流转记录</td></tr>'}
                </tbody>
              </table>
            </div>
          </section>
        `).join('')}
      </div>
    </div>
  `
}
