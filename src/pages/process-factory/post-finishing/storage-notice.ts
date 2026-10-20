import { getPostFinishingStorageFailure, hasPostFinishingLegacyData, migratePostFinishingLegacyData, ensurePostFinishingRecordState } from '../../../data/fcs/post-finishing-records.ts'
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
  const legacy = hasPostFinishingLegacyData()
  if (!failure && !legacy) return ''
  return `<section class="m-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm" data-post-finishing-storage-notice role="status"><p>${escapeHtml(failure || '发现本浏览器保存的旧后道资料。请先关闭其他旧版页面，再转换资料后继续操作；转换失败会保留旧资料。')}</p><button class="mt-2 rounded-md border bg-white px-3 py-2" data-post-finishing-action="storage-${legacy ? 'migrate' : 'retry'}">${legacy ? '转换旧后道资料' : '重新读取'}</button></section>`
}
export function renderPostFinishingEntryStorageFailure(error: Error): string {
  // Shared source preparation can fail before the post-finishing repository
  // starts. A reload retries that whole entry and releases any pending opener.
  const reason = error.message.replaceAll('PCS', '后道')
  return `<section class="m-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm" data-post-finishing-storage-notice data-post-finishing-entry-storage-failure role="alert"><h1 class="text-lg font-semibold">后道资料暂时无法读取</h1><p class="mt-2">${escapeHtml(reason)}</p><p class="mt-2">原资料已保留。关闭占用资料的旧页面后，重新读取。</p><button type="button" class="mt-3 rounded-md border bg-white px-3 py-2" data-pcs-storage-retry>重新读取</button></section>`
}
export async function handlePostFinishingStorageEvent(target: HTMLElement, _event?: Event): Promise<boolean> {
  const action = target.closest<HTMLElement>('[data-post-finishing-action]')?.dataset.postFinishingAction
  if (action !== 'storage-migrate' && action !== 'storage-retry') return false
  if (action === 'storage-migrate' && !hasPostFinishingLegacyData()) return false
  if (action === 'storage-retry' && !getPostFinishingStorageFailure()) return false
  delete target.dataset.postFinishingPreserveInput
  const notice = document.querySelector<HTMLElement>('[data-post-finishing-storage-notice]')
  try {
    if (action === 'storage-migrate') {
      if (!window.confirm('请确认已关闭其他旧版后道页面。转换将保留业务记录与图片，读回校验成功后移除已转换的旧资料。')) return true
      if (notice) notice.innerHTML = '<p>正在转换并核对旧资料，请等待完成。</p>'
      await migratePostFinishingLegacyData()
    } else if (action === 'storage-retry') await ensurePostFinishingRecordState()
    document.querySelector('[data-post-finishing-action-error]')?.remove()
    // The shell awaits this handler and renders the changed facts once.
    // Navigating here would start a second, concurrent hydration of the page.
  } catch (error) {
    target.dataset.postFinishingPreserveInput = 'true'
    const text = escapeHtml(error instanceof Error ? error.message : '资料处理失败，请重试。')
    if (notice) notice.innerHTML = `<p role="alert">${text}</p><button class="mt-2 rounded-md border bg-white px-3 py-2" data-post-finishing-action="storage-${hasPostFinishingLegacyData() ? 'migrate' : 'retry'}">${hasPostFinishingLegacyData() ? '重新转换' : '重新读取'}</button>`
    else showPostFinishingActionFailure(error instanceof Error ? error.message : '资料处理失败，请重试。', target)
  }
  return true
}
