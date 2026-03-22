import {
  escapeHtml,
  state,
} from './context'

export function renderDesignTab(): string {
  const techPack = state.techPack
  if (!techPack) return ''

  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 class="text-base font-semibold">花型设计</h3>
          <p class="mt-1 text-sm text-muted-foreground">花型图案与设计稿</p>
        </div>
        <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-design">
          <i data-lucide="upload" class="mr-2 h-4 w-4"></i>
          上传设计稿
        </button>
      </header>
      <div class="p-4">
        ${
          techPack.patternDesigns.length === 0
            ? '<div class="py-8 text-center text-muted-foreground">暂无数据</div>'
            : `
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                ${techPack.patternDesigns
                  .map(
                    (item) => `
                      <div class="rounded-lg border p-2">
                        <div class="mb-2 flex aspect-square items-center justify-center rounded bg-muted">
                          <i data-lucide="image" class="h-8 w-8 text-muted-foreground"></i>
                        </div>
                        <div class="flex items-center justify-between gap-1">
                          <p class="truncate text-sm font-medium" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</p>
                          <button class="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-design" data-design-id="${item.id}">
                            <i data-lucide="trash-2" class="h-3 w-3"></i>
                          </button>
                        </div>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            `
        }
      </div>
    </section>
  `
}

export function renderAttachmentsTab(): string {
  const techPack = state.techPack
  if (!techPack) return ''

  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 class="text-base font-semibold">附件</h3>
          <p class="mt-1 text-sm text-muted-foreground">其他相关文档和附件</p>
        </div>
        <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-attachment">
          <i data-lucide="upload" class="mr-2 h-4 w-4"></i>
          上传附件
        </button>
      </header>
      <div class="p-4">
        ${
          techPack.attachments.length === 0
            ? '<div class="py-8 text-center text-muted-foreground">暂无数据</div>'
            : `
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/30">
                    <th class="px-3 py-2 text-left">文件名</th>
                    <th class="px-3 py-2 text-left">类型</th>
                    <th class="px-3 py-2 text-left">大小</th>
                    <th class="px-3 py-2 text-left">上传时间</th>
                    <th class="px-3 py-2 text-left">上传人</th>
                    <th class="px-3 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${techPack.attachments
                    .map(
                      (item) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 font-medium">${escapeHtml(item.fileName)}</td>
                          <td class="px-3 py-2"><span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(item.fileType)}</span></td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(item.fileSize)}</td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(item.uploadedAt)}</td>
                          <td class="px-3 py-2 text-sm">${escapeHtml(item.uploadedBy)}</td>
                          <td class="px-3 py-2">
                            <div class="flex items-center gap-1">
                              <button class="rounded px-2 py-1 text-xs hover:bg-muted" data-tech-action="download-attachment" data-attachment-id="${item.id}">下载</button>
                              <button class="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-attachment" data-attachment-id="${item.id}">
                                <i data-lucide="trash-2" class="h-3 w-3"></i>
                              </button>
                            </div>
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


export function renderAddDesignDialog(): string {
  if (!state.addDesignDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">上传设计稿</h3>
        </header>
        <div class="px-6 py-4">
          <label class="space-y-1">
            <span class="text-sm">设计稿名称 <span class="text-red-500">*</span></span>
            <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-design-name" value="${escapeHtml(state.newDesignName)}" placeholder="例如 胸前Logo" />
          </label>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-design">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newDesignName.trim() ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-design">确认</button>
        </footer>
      </section>
    </div>
  `
}

export function renderAddAttachmentDialog(): string {
  if (!state.addAttachmentDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">上传附件</h3>
        </header>
        <div class="space-y-4 px-6 py-4">
          <label class="space-y-1">
            <span class="text-sm">文件名 <span class="text-red-500">*</span></span>
            <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-attachment-file-name" value="${escapeHtml(state.newAttachment.fileName)}" placeholder="例如 工艺说明书.pdf" />
          </label>
          <label class="space-y-1">
            <span class="text-sm">类型</span>
            <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-attachment-file-type" value="${escapeHtml(state.newAttachment.fileType)}" placeholder="PDF" />
          </label>
          <label class="space-y-1">
            <span class="text-sm">大小</span>
            <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-attachment-file-size" value="${escapeHtml(state.newAttachment.fileSize)}" placeholder="1.0MB" />
          </label>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-attachment">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newAttachment.fileName.trim() ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-attachment">确认</button>
        </footer>
      </section>
    </div>
  `
}

