import {
  buildSpecialCraftTaskOrdersPath,
  listEnabledSpecialCraftOperationDefinitions,
} from '../../../data/fcs/special-craft-operations.ts'
import { escapeHtml } from '../../../utils.ts'

export function handleCraftCuttingSpecialProcessesEvent(_target: HTMLElement): boolean {
  return false
}

export function isCraftCuttingSpecialProcessesDialogOpen(): boolean {
  return false
}

export function renderCraftCuttingSpecialProcessesPage(): string {
  const operations = listEnabledSpecialCraftOperationDefinitions()

  return `
    <div class="space-y-4">
      <section class="rounded-2xl border bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">兼容入口</div>
            <h1 class="mt-3 text-2xl font-semibold text-foreground">特殊工艺</h1>
            <p class="mt-2 text-sm text-muted-foreground">
              旧裁床入口已迁移到工艺工厂运营系统的特殊工艺一级菜单。当前页面仅保留兼容跳转，不再维护独立的特殊工艺任务数据。
            </p>
          </div>
          <button
            type="button"
            class="inline-flex items-center rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
            data-nav="/fcs/craft/workbench/overview"
          >
            返回工艺工厂运营系统
          </button>
        </div>
      </section>

      <section class="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 class="text-base font-semibold text-foreground">可前往的特殊工艺任务单</h2>
        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          ${operations
            .map(
              (operation) => `
                <article class="rounded-2xl border bg-slate-50/60 p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <div class="text-sm font-semibold text-foreground">${escapeHtml(operation.operationName)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">作用对象：${escapeHtml(operation.targetObject)}</div>
                    </div>
                    <span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">任务单</span>
                  </div>
                  <div class="mt-3 text-sm text-muted-foreground">${escapeHtml(operation.remark)}</div>
                  <div class="mt-4">
                    <button
                      type="button"
                      class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-white"
                      data-nav="${buildSpecialCraftTaskOrdersPath(operation)}"
                    >
                      前往${escapeHtml(operation.operationName)}任务单
                    </button>
                  </div>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>
    </div>
  `
}
