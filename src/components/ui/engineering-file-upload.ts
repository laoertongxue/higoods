import {
  ENGINEERING_UPLOAD_RULES,
  formatEngineeringUploadSize,
  type EngineeringUploadedFile,
  type EngineeringUploadPurpose,
} from '../../data/pcs-engineering-file-upload.ts'
import { escapeHtml } from '../../utils.ts'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp'])

export function renderEngineeringFileUpload(input: {
  taskId: string
  itemId?: string
  purpose: EngineeringUploadPurpose
  files: EngineeringUploadedFile[]
  label?: string
  locked?: boolean
  multiple?: boolean
  eventPrefix: string
  requiredHint?: string
}): string {
  const itemId = input.itemId || 'TASK'
  const rule = ENGINEERING_UPLOAD_RULES[input.purpose]
  const savedFiles = input.files.filter((file) => file.status === '已保存')
  return `<section class="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3" data-engineering-upload-region="${escapeHtml(input.taskId)}:${escapeHtml(itemId)}:${input.purpose}">
    <div class="flex flex-wrap items-start justify-between gap-3"><div><p class="text-sm font-medium text-slate-800">${escapeHtml(input.label || rule.label)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(input.requiredHint || `支持 ${rule.extensions.map((item) => `.${item}`).join('、')}，单个文件不超过 ${Math.round(rule.maxSizeBytes / 1024 / 1024)} MB`)}</p></div><span class="rounded-full px-2 py-1 text-xs ${savedFiles.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${savedFiles.length ? `已保存 ${savedFiles.length} 个` : '尚未上传'}</span></div>
    ${input.locked ? '<p class="text-xs text-slate-500">本轮成果已提交，文件只读；返工时请上传新一轮成果。</p>' : `<label class="inline-flex h-9 cursor-pointer items-center rounded-md border border-blue-200 bg-white px-3 text-sm text-blue-700"><span>选择本地文件</span><input class="sr-only" type="file" accept="${escapeHtml(rule.accept)}" ${input.multiple === false ? '' : 'multiple'} data-skip-page-rerender="true" data-${input.eventPrefix}-upload-input data-task-id="${escapeHtml(input.taskId)}" data-item-id="${escapeHtml(itemId)}" data-upload-purpose="${input.purpose}"></label>`}
    <div class="space-y-2">${input.files.length ? input.files.map((file) => `<div class="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm"><div class="min-w-0"><p class="truncate font-medium text-slate-800">${escapeHtml(file.fileName)}</p><p class="text-xs text-slate-500">${formatEngineeringUploadSize(file.sizeBytes)} · 第 ${file.roundNo} 轮 · ${escapeHtml(file.uploadedByTeam)} · ${escapeHtml(file.uploadedByName)} · ${escapeHtml(file.uploadedAt)}</p>${file.errorMessage ? `<p class="text-xs text-red-600">${escapeHtml(file.errorMessage)}</p>` : ''}</div><div class="flex items-center gap-2">${IMAGE_EXTENSIONS.has(file.extension) ? `<button type="button" class="text-xs text-blue-700" data-skip-page-rerender="true" data-${input.eventPrefix}-upload-preview data-file-url="${escapeHtml(file.dataUrl)}" data-file-name="${escapeHtml(file.fileName)}">查看大图</button>` : ''}<a class="text-xs text-blue-700" href="${escapeHtml(file.dataUrl)}" download="${escapeHtml(file.fileName)}">下载</a>${input.locked ? '' : `<button type="button" class="text-xs text-red-600" data-skip-page-rerender="true" data-${input.eventPrefix}-upload-remove data-task-id="${escapeHtml(input.taskId)}" data-item-id="${escapeHtml(itemId)}" data-file-id="${escapeHtml(file.fileId)}">删除</button>`}</div></div>`).join('') : '<p class="text-xs text-slate-500">请选择真实文件，文件读取并保存成功后才能提交。</p>'}</div>
  </section>`
}

export function renderEngineeringUploadPreview(preview: { url: string; fileName: string } | null, eventPrefix: string): string {
  if (!preview) return ''
  return `<div class="fixed inset-0 z-[110] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="${escapeHtml(preview.fileName)}大图"><button type="button" class="absolute inset-0 bg-slate-950/75" data-${eventPrefix}-upload-preview-close aria-label="关闭大图"></button><section class="relative z-10 max-h-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-2xl"><header class="flex items-center justify-between gap-4 border-b px-4 py-3"><p class="truncate font-medium">${escapeHtml(preview.fileName)}</p><button type="button" class="rounded border px-3 py-1 text-sm" data-${eventPrefix}-upload-preview-close>关闭</button></header><div class="flex min-h-40 items-center justify-center bg-slate-100 p-4"><img src="${escapeHtml(preview.url)}" alt="${escapeHtml(preview.fileName)}高清大图" class="max-h-[80vh] max-w-[88vw] object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><p hidden class="p-8 text-sm text-red-600">图片加载失败，请重新上传原文件。</p></div></section></div>`
}
