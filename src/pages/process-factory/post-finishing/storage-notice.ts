import { getPostFinishingStorageFailure, ensurePostFinishingRecordState } from '../../../data/fcs/post-finishing-records.ts'
import { escapeHtml } from '../../../utils.ts'

export function showPostFinishingActionFailure(message: string, target?: HTMLElement): void {
  // The shell must preserve the form after this local failure message.
  if (target) target.dataset.postFinishingPreserveInput = 'true'
  document.querySelector('[data-post-finishing-action-error]')?.remove()
  const container = document.querySelector('main') || target?.closest('[data-testid^="pda-"]') || document.querySelector('#app')
  container?.insertAdjacentHTML('afterbegin', `<div data-post-finishing-action-error role="alert" class="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">${escapeHtml(message)}</div>`)
}

export function renderPostFinishingStorageNotice(): string {
  const failure = getPostFinishingStorageFailure()
  if (!failure) return ''
  return `<section class="m-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm" data-post-finishing-storage-notice role="status"><p>${escapeHtml(failure)}</p><button class="mt-2 rounded-md border bg-white px-3 py-2" data-post-finishing-action="storage-retry">重新读取</button></section>`
}
export function renderPostFinishingEntryStorageFailure(error: Error): string {
  // Shared source preparation can fail before the post-finishing repository
  // starts. A reload retries that whole entry and releases any pending opener.
  const reason = error.message.replaceAll('PCS', '后道')
  return `<section class="m-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm" data-post-finishing-storage-notice data-post-finishing-entry-storage-failure role="alert"><h1 class="text-lg font-semibold">后道资料暂时无法读取</h1><p class="mt-2">${escapeHtml(reason)}</p><p class="mt-2">原资料已保留。关闭占用资料的旧页面后，重新读取。</p><button type="button" class="mt-3 rounded-md border bg-white px-3 py-2" data-pcs-storage-retry>重新读取</button></section>`
}
export async function handlePostFinishingStorageEvent(target: HTMLElement, _event?: Event): Promise<boolean> {
  const action = target.closest<HTMLElement>('[data-post-finishing-action]')?.dataset.postFinishingAction
  if (action !== 'storage-retry') return false
  if (action === 'storage-retry' && !getPostFinishingStorageFailure()) return false
  delete target.dataset.postFinishingPreserveInput
  const notice = document.querySelector<HTMLElement>('[data-post-finishing-storage-notice]')
  try {
    await ensurePostFinishingRecordState()
    document.querySelector('[data-post-finishing-action-error]')?.remove()
    // The shell awaits this handler and renders the changed facts once.
    // Navigating here would start a second, concurrent hydration of the page.
  } catch (error) {
    target.dataset.postFinishingPreserveInput = 'true'
    const text = escapeHtml(error instanceof Error ? error.message : '资料处理失败，请重试。')
    if (notice) notice.innerHTML = `<p role="alert">${text}</p><button class="mt-2 rounded-md border bg-white px-3 py-2" data-post-finishing-action="storage-retry">重新读取</button>`
    else showPostFinishingActionFailure(error instanceof Error ? error.message : '资料处理失败，请重试。', target)
  }
  return true
}
