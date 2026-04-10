import {
  escapeHtml,
  state,
} from './context.ts'

export function renderSizeTab(): string {
  const techPack = state.techPack
  if (!techPack) return ''
  const readonly = state.compatibilityMode

  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 class="text-base font-semibold">放码规则</h3>
          <p class="mt-1 text-sm text-muted-foreground">维护各尺码测量项的尺寸规格与放码规则</p>
        </div>
        ${readonly ? '' : `<button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-size">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          添加尺码测量项
        </button>`}
      </header>
      <div class="p-4">
        ${
          techPack.sizeTable.length === 0
            ? '<div class="py-8 text-center text-muted-foreground">暂无数据</div>'
            : `
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/30">
                    <th class="px-3 py-2 text-left">尺码测量项</th>
                    <th class="px-3 py-2 text-right">S</th>
                    <th class="px-3 py-2 text-right">M</th>
                    <th class="px-3 py-2 text-right">L</th>
                    <th class="px-3 py-2 text-right">XL</th>
                    <th class="px-3 py-2 text-right">公差(±)</th>
                    <th class="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${techPack.sizeTable
                    .map(
                      (row) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 font-medium">${escapeHtml(row.part)}</td>
                          <td class="px-3 py-2 text-right">${row.S}</td>
                          <td class="px-3 py-2 text-right">${row.M}</td>
                          <td class="px-3 py-2 text-right">${row.L}</td>
                          <td class="px-3 py-2 text-right">${row.XL}</td>
                          <td class="px-3 py-2 text-right">${row.tolerance}</td>
                          <td class="px-3 py-2 text-right">
                            ${readonly ? '' : `<button class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-size" data-size-id="${row.id}">
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


export function renderAddSizeDialog(): string {
  if (!state.addSizeDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-lg rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">添加放码规则</h3>
        </header>
        <div class="space-y-4 px-6 py-4">
          <label class="space-y-1">
            <span class="text-sm">尺码测量项 <span class="text-red-500">*</span></span>
            <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-size-part" value="${escapeHtml(state.newSizeRow.part)}" placeholder="例如 胸围" />
          </label>
          <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
            <label class="space-y-1"><span class="text-xs text-muted-foreground">S</span><input type="number" class="w-full rounded-md border px-2 py-2 text-sm" data-tech-field="new-size-s" value="${escapeHtml(state.newSizeRow.S)}" /></label>
            <label class="space-y-1"><span class="text-xs text-muted-foreground">M</span><input type="number" class="w-full rounded-md border px-2 py-2 text-sm" data-tech-field="new-size-m" value="${escapeHtml(state.newSizeRow.M)}" /></label>
            <label class="space-y-1"><span class="text-xs text-muted-foreground">L</span><input type="number" class="w-full rounded-md border px-2 py-2 text-sm" data-tech-field="new-size-l" value="${escapeHtml(state.newSizeRow.L)}" /></label>
            <label class="space-y-1"><span class="text-xs text-muted-foreground">XL</span><input type="number" class="w-full rounded-md border px-2 py-2 text-sm" data-tech-field="new-size-xl" value="${escapeHtml(state.newSizeRow.XL)}" /></label>
            <label class="space-y-1"><span class="text-xs text-muted-foreground">公差(±)</span><input type="number" class="w-full rounded-md border px-2 py-2 text-sm" data-tech-field="new-size-tolerance" value="${escapeHtml(state.newSizeRow.tolerance)}" /></label>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-size">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newSizeRow.part.trim() ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-size">确认</button>
        </footer>
      </section>
    </div>
  `
}
