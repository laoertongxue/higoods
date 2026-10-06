import { escapeHtml } from '../utils.ts'

export function renderPcsStorageError(error: unknown): string {
  const reason = error instanceof Error ? error.message : '读取未完成，请重试。'
  return `<section role="alert" class="rounded border border-amber-300 bg-amber-50 p-6">
    <h1 class="text-xl font-semibold">资料暂时无法读取</h1>
    <p class="mt-2">原有资料已保留，请重新读取。若仍然失败，请联系维护人员处理。</p>
    <p class="mt-2 text-sm text-amber-800">${escapeHtml(reason)}</p>
    <button type="button" data-pcs-storage-retry class="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">重新读取</button>
  </section>`
}
