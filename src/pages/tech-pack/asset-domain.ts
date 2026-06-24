import {
  escapeHtml,
  getPatternDesignPreviewUrl,
  isTechPackModuleReadOnly,
  state,
} from './context.ts'

export function renderDesignTab(): string {
  const techPack = state.techPack
  if (!techPack) return ''
  const readonly = isTechPackModuleReadOnly('DESIGN')
  const frontDesigns = techPack.patternDesigns.filter((item) => item.designSideType === 'FRONT')
  const insideDesigns = techPack.patternDesigns.filter((item) => item.designSideType === 'INSIDE')

  const renderDesignGroup = (title: string, items: typeof techPack.patternDesigns): string => `
    <section class="space-y-3">
      <header class="flex items-center justify-between">
        <h4 class="text-sm font-medium">${title}</h4>
        <span class="text-xs text-muted-foreground">${items.length} 张</span>
      </header>
      ${
        items.length === 0
          ? '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">暂无数据</div>'
          : `
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              ${items
                .map(
                  (item) => {
                    const previewUrl = getPatternDesignPreviewUrl(item)
                    const originalFileName = String(item.originalFileName || item.fileName || '').trim()
                    const hasOriginalFile = Boolean(String(item.originalFileDataUrl || '').trim() && originalFileName)

                    return `
                    <div class="rounded-lg border p-3">
                      <button
                        type="button"
                        class="mb-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded bg-muted transition hover:opacity-95"
                        data-tech-action="preview-design-thumbnail"
                        data-design-id="${item.id}"
                      >
                        ${
                          previewUrl
                            ? `<img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(item.name)}" class="h-full w-full object-cover" />`
                            : '<i data-lucide="image" class="h-8 w-8 text-muted-foreground"></i>'
                        }
                      </button>
                      <div class="space-y-1">
                        <div class="flex items-center justify-between gap-2">
                          <p class="truncate text-sm font-medium" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</p>
                          ${readonly ? '' : `<button type="button" class="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-design" data-design-id="${item.id}">
                            <i data-lucide="trash-2" class="h-3 w-3"></i>
                          </button>`}
                        </div>
                        <p class="text-xs text-muted-foreground">${item.designSideType === 'FRONT' ? '正面花型' : '里面花型'}</p>
                        <p class="text-xs text-muted-foreground">原文件：${escapeHtml(originalFileName || '暂无数据')}</p>
                        <p class="text-xs text-muted-foreground">上传时间：${escapeHtml(item.uploadedAt || '暂无数据')}</p>
                        ${
                          !hasOriginalFile && previewUrl
                            ? '<p class="text-xs text-amber-600">原文件缺失，当前仅保留缩略图预览</p>'
                            : ''
                        }
                        <div class="pt-2">
                          <button
                            type="button"
                            class="rounded border px-2 py-1 text-xs hover:bg-muted ${hasOriginalFile ? '' : 'pointer-events-none opacity-50'}"
                            data-tech-action="download-design-original-file"
                            data-design-id="${item.id}"
                          >
                            下载原文件
                          </button>
                        </div>
                      </div>
                    </div>
                  `
                  },
                )
                .join('')}
            </div>
          `
      }
    </section>
  `

  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 class="text-base font-semibold">花型设计</h3>
        </div>
        ${readonly ? '' : `<button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-design">
          <i data-lucide="upload" class="mr-2 h-4 w-4"></i>
          上传设计稿
        </button>`}
      </header>
      <div class="space-y-6 p-4">
        ${renderDesignGroup('正面花型', frontDesigns)}
        ${renderDesignGroup('里面花型', insideDesigns)}
      </div>
    </section>
  `
}

export function renderAddDesignDialog(): string {
  if (!state.addDesignDialogOpen) return ''
  if (isTechPackModuleReadOnly('DESIGN')) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">上传设计稿</h3>
        </header>
        <div class="space-y-4 px-6 py-4">
          <input id="tech-pack-design-file-input" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.svg,.pdf,.ai,.cdr" data-tech-field="new-design-file" class="hidden" />
          <label class="space-y-1">
            <span class="text-sm">设计稿名称 / 批量前缀 <span class="text-red-500">*</span></span>
            <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-design-name" value="${escapeHtml(state.newDesignName)}" placeholder="设计稿名称 / 批量前缀" />
          </label>
          <label class="space-y-1">
            <span class="text-sm">花型类别 <span class="text-red-500">*</span></span>
            <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-design-side-type">
              <option value="FRONT" ${state.newDesignSideType === 'FRONT' ? 'selected' : ''}>正面花型</option>
              <option value="INSIDE" ${state.newDesignSideType === 'INSIDE' ? 'selected' : ''}>里面花型</option>
            </select>
          </label>
          <div class="space-y-2">
            <span class="text-sm">上传文件 <span class="text-red-500">*</span></span>
            <div class="rounded-lg border p-3">
              ${
                state.newDesignFiles.length === 0
                  ? '<div class="mb-3 flex h-40 items-center justify-center overflow-hidden rounded bg-muted"><span class="text-sm text-muted-foreground">暂无预览</span></div>'
                  : `<div class="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      ${state.newDesignFiles
                        .map(
                          (file) => `
                            <div class="rounded-md border p-2">
                              <div class="flex h-32 items-center justify-center overflow-hidden rounded bg-muted">
                                ${
                                  file.previewThumbnailDataUrl
                                    ? `<img src="${escapeHtml(file.previewThumbnailDataUrl)}" alt="${escapeHtml(file.fileName)}" class="h-full w-full object-cover" />`
                                    : '<span class="text-sm text-muted-foreground">暂无预览</span>'
                                }
                              </div>
                              <div class="mt-2 space-y-1">
                                <div class="min-w-0 truncate text-xs text-muted-foreground" title="${escapeHtml(file.fileName)}">原文件：${escapeHtml(file.fileName)}</div>
                                <div class="text-xs text-muted-foreground">
                                  缩略图：${file.previewThumbnailDataUrl ? '已生成' : '暂无数据'}
                                </div>
                                <div class="text-xs ${file.processing ? 'text-amber-600' : 'text-emerald-600'}">${file.processing ? '处理中' : '已就绪'}</div>
                              </div>
                            </div>
                          `,
                        )
                        .join('')}
                    </div>`
              }
              <div class="mt-3 flex items-center justify-end gap-3">
                <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-design-file-picker">选择文件</button>
              </div>
            </div>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-design">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newDesignName.trim() && state.newDesignFiles.length > 0 && state.newDesignFiles.every((file) => !file.processing && file.originalFileDataUrl.trim()) ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-design">确认</button>
        </footer>
      </section>
    </div>
  `
}
