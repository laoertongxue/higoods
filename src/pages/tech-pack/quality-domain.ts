import { escapeHtml, state } from './context.ts'

export function renderQualityTab(): string {
  const readonly = false
  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 class="text-base font-semibold">质检标准</h3>
        </div>
        ${readonly ? '' : `<button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-quality">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          添加质检标准
        </button>`}
      </header>
      <div class="p-4">
        ${
          state.qualityRules.length === 0
            ? '<div class="rounded-lg border border-dashed py-8 text-center text-muted-foreground">暂无质检标准</div>'
            : `
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/30">
                    <th class="px-3 py-2 text-left">检验项</th>
                    <th class="px-3 py-2 text-left">标准说明</th>
                    <th class="px-3 py-2 text-left">抽检规则</th>
                    <th class="px-3 py-2 text-left">备注</th>
                    <th class="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.qualityRules
                    .map(
                      (item) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 font-medium">${escapeHtml(item.checkItem)}</td>
                          <td class="px-3 py-2">${escapeHtml(item.standardText)}</td>
                          <td class="px-3 py-2">${escapeHtml(item.samplingRule || '—')}</td>
                          <td class="px-3 py-2 text-muted-foreground">${escapeHtml(item.note || '—')}</td>
                          <td class="px-3 py-2 text-right">
                            ${readonly ? '' : `<button class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-quality" data-quality-id="${escapeHtml(item.id)}">
                              <i data-lucide="trash-2" class="h-4 w-4"></i>
                            </button>`}
                          </td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            `
        }
      </div>
    </section>
  `
}

export function renderAddQualityDialog(): string {
  if (!state.addQualityDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">新增质检标准</h3>
        </header>
        <div class="space-y-4 px-6 py-4">
          <label class="space-y-1">
            <span class="text-sm">检验项 <span class="text-red-500">*</span></span>
            <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-quality-check-item" value="${escapeHtml(state.newQualityRule.checkItem)}" placeholder="例如 外观检验" />
          </label>
          <label class="space-y-1">
            <span class="text-sm">标准说明 <span class="text-red-500">*</span></span>
            <textarea class="min-h-24 w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-quality-standard-text" placeholder="填写检验标准说明">${escapeHtml(state.newQualityRule.standardText)}</textarea>
          </label>
          <label class="space-y-1">
            <span class="text-sm">抽检规则</span>
            <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-quality-sampling-rule" value="${escapeHtml(state.newQualityRule.samplingRule)}" placeholder="例如 每批抽检 10%" />
          </label>
          <label class="space-y-1">
            <span class="text-sm">备注</span>
            <textarea class="min-h-20 w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-quality-note" placeholder="可填写补充说明">${escapeHtml(state.newQualityRule.note)}</textarea>
          </label>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-quality">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newQualityRule.checkItem.trim() && state.newQualityRule.standardText.trim()
              ? ''
              : 'pointer-events-none opacity-50'
          }" data-tech-action="save-quality">确认</button>
        </footer>
      </section>
    </div>
  `
}
