// @page-pattern: workflow

import { renderPostFinishingPageHeader } from './shared.ts'

/**
 * 旧“生产单级后道任务”入口仅保留兼容提示。
 * 质检任务改为回货确认后送检自动生成，禁止在此自由选 SKU 创建。
 */
export function renderPostFinishingTasksPage(): string {
  return `<div class="space-y-4 p-4" data-testid="post-finishing-legacy-tasks-redirect">
    ${renderPostFinishingPageHeader('后道任务入口已调整', '回货确认后送检自动生成质检任务')}
    <section class="rounded-xl border bg-card p-6">
      <h2 class="font-semibold">请按当前业务阶段进入</h2>
      <p class="mt-2 text-sm text-muted-foreground">旧入口不再提供手工创建质检任务，也不允许自由选择 SKU。质检任务由已确认送货单执行“送检”后自动生成；质检完成后，系统按所选分支自动生成后道任务或复检单。</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <a data-nav="/fcs/craft/post-finishing/wait-process-warehouse" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">后道待加工仓</a>
        <a data-nav="/fcs/craft/post-finishing/work-orders" class="rounded-md border px-4 py-2 text-sm">查看后道加工任务</a>
        <a data-nav="/fcs/craft/post-finishing/recheck-orders" class="rounded-md border px-4 py-2 text-sm">查看复检单</a>
      </div>
    </section>
  </div>`
}
