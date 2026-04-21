import {
  escapeHtml,
  formatPatternSpec,
  getPatternBySelectionKey,
  state,
} from './context.ts'

function isAllowedPatternImage(value: string): boolean {
  const normalized = String(value || '').trim()
  if (!normalized || normalized === '#') return false
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return false
  return !['/placeholder.svg', 'picsum', 'unsplash', 'dummyimage', 'loremflickr'].some((marker) =>
    normalized.includes(marker),
  )
}

export function renderPatternTab(): string {
  const bomById = new Map(state.bomItems.map((item) => [item.id, item]))
  const readonly = false

  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <h3 class="text-base font-semibold">纸样管理</h3>
        ${readonly ? '' : `<button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-pattern">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          添加纸样
        </button>`}
      </header>
      <div class="p-4">
        ${
          state.patternItems.length === 0
            ? '<div class="rounded-lg border py-8 text-center text-muted-foreground">暂无纸样</div>'
            : `
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/30">
                    <th class="px-3 py-2 text-left">纸样名称</th>
                    <th class="px-3 py-2 text-left">类型</th>
                    <th class="px-3 py-2 text-left">关联物料</th>
                    <th class="px-3 py-2 text-left">规格</th>
                    <th class="px-3 py-2 text-right">裁片总片数</th>
                    <th class="px-3 py-2 text-left">裁片明细</th>
                    <th class="px-3 py-2 text-left">文件</th>
                    <th class="px-3 py-2 text-left">备注</th>
                    <th class="px-3 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.patternItems
                    .map(
                      (item) => {
                        const linkedBom = item.linkedBomItemId ? bomById.get(item.linkedBomItemId) : null
                        const linkedBomLabel = linkedBom
                          ? `${linkedBom.materialCode} · ${linkedBom.materialName}`
                          : '未关联'
                        const pieceCount =
                          Number.isFinite(item.totalPieceCount) && item.totalPieceCount > 0
                            ? item.totalPieceCount
                            : item.pieceRows.reduce((sum, row) => sum + row.count, 0)

                        return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 font-medium">${escapeHtml(item.name)}</td>
                          <td class="px-3 py-2"><span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(item.type)}</span></td>
                          <td class="px-3 py-2 text-sm ${linkedBom ? '' : 'text-muted-foreground'}">
                            ${escapeHtml(linkedBomLabel)}
                          </td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(formatPatternSpec(item.widthCm, item.markerLengthM))}</td>
                          <td class="px-3 py-2 text-right">${pieceCount} 片</td>
                          <td class="px-3 py-2">
                            ${
                              item.pieceRows.length > 0
                                ? `<button class="text-blue-600 hover:underline" data-tech-action="open-pattern-detail" data-pattern-id="${item.id}">${item.pieceRows.length} 项明细</button>`
                                : '<span class="text-sm text-muted-foreground">暂无</span>'
                            }
                          </td>
                          <td class="px-3 py-2">
                            ${
                              item.file
                                ? `<button class="text-blue-600 hover:underline" data-tech-action="noop">${escapeHtml(item.file)}</button>`
                                : '<span class="text-sm text-muted-foreground">无</span>'
                            }
                          </td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(item.remark || '-')}</td>
                          <td class="px-3 py-2">
                            <div class="flex items-center gap-1">
                              ${readonly ? '' : `<button class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="edit-pattern" data-pattern-id="${item.id}">
                                <i data-lucide="edit-2" class="h-4 w-4"></i>
                              </button>`}
                              <button class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="open-pattern-detail" data-pattern-id="${item.id}">
                                <i data-lucide="eye" class="h-4 w-4"></i>
                              </button>
                              ${readonly ? '' : `<button class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-pattern" data-pattern-id="${item.id}">
                                <i data-lucide="trash-2" class="h-4 w-4"></i>
                              </button>`}
                            </div>
                          </td>
                        </tr>
                      `
                      },
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


export function renderPatternDialog(): string {
  if (!state.patternDialogOpen || !state.selectedPattern) return ''

  const pattern = getPatternBySelectionKey(state.selectedPattern)
  if (!pattern) return ''
  const linkedBom =
    pattern.linkedBomItemId.length > 0
      ? state.bomItems.find((item) => item.id === pattern.linkedBomItemId) ?? null
      : null
  const image = isAllowedPatternImage(pattern.image) ? pattern.image : ''
  const pieceRows = pattern.pieceRows
  const pieceTotal =
    Number.isFinite(pattern.totalPieceCount) && pattern.totalPieceCount > 0
      ? pattern.totalPieceCount
      : pieceRows.reduce((sum, row) => sum + row.count, 0)

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-2xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">纸样详情</h3>
        </header>
        <div class="space-y-4 px-6 py-4 text-sm">
          <div class="flex items-center gap-4">
            ${
              image
                ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(pattern.name)}" class="h-24 w-24 rounded border object-cover" />`
                : '<div class="flex h-24 w-24 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">暂无图片</div>'
            }
            <div>
              <h4 class="text-lg font-semibold">${escapeHtml(pattern.name)}</h4>
              <p class="text-sm text-muted-foreground">${escapeHtml(pattern.type)}</p>
            </div>
          </div>
          <div class="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-2">
            <div>
              <p class="text-xs text-muted-foreground">关联物料</p>
              <p class="mt-1">${escapeHtml(linkedBom ? `${linkedBom.materialCode} · ${linkedBom.materialName}` : '未关联')}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">规格（门幅 × 排料长度）</p>
              <p class="mt-1">${escapeHtml(formatPatternSpec(pattern.widthCm, pattern.markerLengthM))}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">裁片总片数</p>
              <p class="mt-1">${pieceTotal} 片</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">纸样文件</p>
              <p class="mt-1 text-muted-foreground">${escapeHtml(pattern.file || '-')}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">纸样版本</p>
              <p class="mt-1 text-muted-foreground">暂无数据</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">打版软件</p>
              <p class="mt-1 text-muted-foreground">暂无数据</p>
            </div>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h5 class="text-sm font-medium">裁片明细</h5>
              <span class="text-xs text-muted-foreground">单位：片</span>
            </div>
            ${
              pieceRows.length === 0
                ? '<div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">当前暂无裁片明细</div>'
                : `
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="border-b bg-muted/20">
                        <th class="px-2 py-1 text-left">裁片名称</th>
                        <th class="px-2 py-1 text-right">片数</th>
                        <th class="px-2 py-1 text-left">适用 SKU</th>
                        <th class="px-2 py-1 text-left">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${pieceRows
                        .map(
                          (row) => `
                            <tr class="border-b last:border-0">
                              <td class="px-2 py-1">${escapeHtml(row.name)}</td>
                              <td class="px-2 py-1 text-right">${row.count}</td>
                              <td class="px-2 py-1">
                                ${
                                  row.applicableSkuCodes.length === 0
                                    ? '<span class="text-muted-foreground">全部 SKU</span>'
                                    : `<div class="flex flex-wrap gap-1">${row.applicableSkuCodes
                                        .map(
                                          (skuCode) =>
                                            `<span class="inline-flex rounded border px-1 py-0.5 text-[10px]">${escapeHtml(skuCode)}</span>`,
                                        )
                                        .join('')}</div>`
                                }
                              </td>
                              <td class="px-2 py-1 text-muted-foreground">${escapeHtml(row.note || '-')}</td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                `
            }
          </div>
          ${
            pattern.remark
              ? `<p class="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">备注：${escapeHtml(pattern.remark)}</p>`
              : ''
          }
        </div>
        <footer class="flex items-center justify-end border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-pattern-detail">关闭</button>
        </footer>
      </section>
    </div>
  `
}


export function renderPatternFormDialog(): string {
  if (!state.addPatternDialogOpen) return ''
  const bomOptions = state.bomItems

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-3xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">${state.editPatternItemId ? '编辑纸样' : '新增纸样'}</h3>
        </header>
        <div class="space-y-4 px-6 py-4">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label class="space-y-1">
              <span class="text-sm">纸样名称 <span class="text-red-500">*</span></span>
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-name" value="${escapeHtml(state.newPattern.name)}" placeholder="例如 前片" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">纸样类型</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-type">
                ${['主体片', '结构片', '装饰片', '其他']
                  .map((option) => `<option value="${option}" ${state.newPattern.type === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-sm">关联物料（物料清单）</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-linked-bom-item">
                <option value="">请选择关联物料</option>
                ${bomOptions
                  .map(
                    (item) =>
                      `<option value="${item.id}" ${state.newPattern.linkedBomItemId === item.id ? 'selected' : ''}>${escapeHtml(`${item.materialCode} · ${item.materialName}`)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-sm">门幅（cm）</span>
              <input type="number" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-width-cm" value="${escapeHtml(String(state.newPattern.widthCm || ''))}" placeholder="例如 142" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">排料长度（m）</span>
              <input type="number" step="0.01" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-marker-length-m" value="${escapeHtml(String(state.newPattern.markerLengthM || ''))}" placeholder="例如 2.62" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">裁片总片数（片）</span>
              <input type="number" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-total-piece-count" value="${escapeHtml(String(state.newPattern.totalPieceCount || ''))}" placeholder="例如 6" />
            </label>
            <label class="space-y-1 md:col-span-2">
              <span class="text-sm">纸样文件</span>
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-file" value="${escapeHtml(state.newPattern.file)}" placeholder="例如 front.dxf" />
            </label>
            <label class="space-y-1 md:col-span-2">
              <span class="text-sm">备注</span>
              <textarea rows="2" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-remark" placeholder="备注信息">${escapeHtml(state.newPattern.remark)}</textarea>
            </label>
          </div>

          <section class="space-y-2 rounded-md border p-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-medium">裁片明细</h4>
              <button type="button" class="inline-flex items-center rounded border px-2 py-1 text-xs hover:bg-muted" data-tech-action="add-new-pattern-piece-row">
                <i data-lucide="plus" class="mr-1 h-3 w-3"></i>
                新增裁片
              </button>
            </div>
            ${
              state.newPattern.pieceRows.length === 0
                ? '<div class="rounded border border-dashed px-3 py-3 text-xs text-muted-foreground">暂无裁片明细，可点击“新增裁片”补充</div>'
                : `
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="border-b bg-muted/20">
                        <th class="px-2 py-1 text-left">裁片名称</th>
                        <th class="px-2 py-1 text-right">片数</th>
                        <th class="px-2 py-1 text-left">备注</th>
                        <th class="px-2 py-1 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${state.newPattern.pieceRows
                        .map(
                          (row) => `
                            <tr class="border-b last:border-0">
                              <td class="px-2 py-1">
                                <input class="h-7 w-full rounded border px-2 text-xs" data-tech-field="new-pattern-piece-name" data-piece-id="${row.id}" value="${escapeHtml(row.name)}" placeholder="例如 前片" />
                              </td>
                              <td class="px-2 py-1">
                                <input type="number" class="h-7 w-20 rounded border px-2 text-right text-xs" data-tech-field="new-pattern-piece-count" data-piece-id="${row.id}" value="${escapeHtml(String(row.count || 0))}" />
                              </td>
                              <td class="px-2 py-1">
                                <input class="h-7 w-full rounded border px-2 text-xs" data-tech-field="new-pattern-piece-note" data-piece-id="${row.id}" value="${escapeHtml(row.note)}" placeholder="备注" />
                              </td>
                              <td class="px-2 py-1 text-right">
                                <button type="button" class="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-new-pattern-piece-row" data-piece-id="${row.id}">
                                  <i data-lucide="trash-2" class="h-3 w-3"></i>
                                </button>
                              </td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                `
            }
          </section>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-pattern">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newPattern.name.trim() ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-pattern">确认</button>
        </footer>
      </section>
    </div>
  `
}
