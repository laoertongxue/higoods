import { escapeHtml, isTechPackModuleReadOnly, state } from './context.ts'

const ATTACHMENT_FILE_INPUT_ID = 'tech-pack-attachment-file-input'

/** 附件来源既有真实文件（首单样衣、原版 RUL/PRJ），因此保留既有 downloadUrl 作为来源证据，不改写历史记录。 */
function renderAttachmentRows(readonly: boolean): string {
  const attachments = state.techPack?.attachments ?? []
  if (attachments.length === 0) {
    return '<div class="py-10 text-center text-sm text-muted-foreground">暂无附件</div>'
  }
  return attachments
    .map(
      (item) => `
        <tr class="border-b last:border-0">
          <td class="px-3 py-2 font-medium">
            <span class="inline-flex items-center gap-2">
              <i data-lucide="file" class="h-4 w-4 text-muted-foreground"></i>
              <span class="truncate" title="${escapeHtml(item.fileName)}">${escapeHtml(item.fileName)}</span>
            </span>
          </td>
          <td class="px-3 py-2">${escapeHtml(item.fileType || '-')}</td>
          <td class="px-3 py-2">${escapeHtml(item.fileSize || '-')}</td>
          <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(item.uploadedAt || '-')}</td>
          <td class="px-3 py-2">${escapeHtml(item.uploadedBy || '-')}</td>
          <td class="px-3 py-2">
            <div class="flex items-center gap-2">
              ${
                item.downloadUrl
                  ? `<a class="text-blue-700 hover:underline" href="${escapeHtml(item.downloadUrl)}" download="${escapeHtml(item.fileName)}" target="_blank" rel="noreferrer">下载</a>`
                  : `<button type="button" class="text-blue-700 hover:underline" data-tech-action="download-attachment" data-attachment-id="${escapeHtml(item.id)}">下载</button>`
              }
              ${
                readonly
                  ? ''
                  : `<button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-attachment" data-attachment-id="${escapeHtml(item.id)}" aria-label="删除附件 ${escapeHtml(item.fileName)}" title="删除附件">
                      <i data-lucide="trash-2" class="h-4 w-4"></i>
                    </button>`
              }
            </div>
          </td>
        </tr>
      `,
    )
    .join('')
}

export function renderAttachmentTab(): string {
  if (!state.techPack) return ''
  const readonly = isTechPackModuleReadOnly('ATTACHMENT')
  const count = state.techPack.attachments.length

  return `
    <section class="rounded-lg border bg-card">
      <header class="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 class="text-base font-semibold">附件</h3>
          <p class="mt-1 text-sm text-muted-foreground">其他补充文件和说明附件${count > 0 ? ` · 共 ${count} 个` : ''}</p>
        </div>
        ${
          readonly
            ? '<p class="text-sm text-muted-foreground">当前技术包不可编辑，附件仅可查看和下载。</p>'
            : `<div class="flex items-center gap-2">
                <input id="${ATTACHMENT_FILE_INPUT_ID}" type="file" multiple class="hidden" data-tech-field="new-attachment-file" />
                <button type="button" class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-tech-action="open-attachment-file-picker">
                  <i data-lucide="upload" class="mr-2 h-4 w-4"></i>
                  上传附件
                </button>
              </div>`
        }
      </header>
      <div class="p-4">
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
            ${renderAttachmentRows(readonly)}
          </tbody>
        </table>
      </div>
    </section>
  `
}

export function renderAttachmentDeleteDialog(): string {
  const dialog = state.attachmentDeleteTarget
  if (!dialog || !state.techPack) return ''
  const target = state.techPack.attachments.find((item) => item.id === dialog.attachmentId)
  if (!target) return ''
  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">删除附件</h3>
        </header>
        <div class="space-y-3 px-6 py-5 text-sm">
          <p>确定删除附件 <span class="font-medium text-foreground">${escapeHtml(target.fileName)}</span>？</p>
          <p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">删除后该附件不再出现在技术资料中，且无法恢复。</p>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-attachment-delete">取消</button>
          <button type="button" class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700" data-tech-action="confirm-attachment-delete">确认删除</button>
        </footer>
      </section>
    </div>
  `
}

export { ATTACHMENT_FILE_INPUT_ID }