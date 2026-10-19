import { exportPostFinishingBackup, getPostFinishingStorageFailure, hasPostFinishingLegacyData, importPostFinishingBackup, migratePostFinishingLegacyData, ensurePostFinishingRecordState } from '../../../data/fcs/post-finishing-records.ts'
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
export function renderPostFinishingBackupActions(): string {
  return `<div class="flex flex-wrap gap-2"><button class="rounded-md border px-3 py-2 text-xs" data-post-finishing-action="storage-export" data-skip-page-rerender="true">导出本浏览器后道资料</button><label class="cursor-pointer rounded-md border px-3 py-2 text-xs">导入后道资料<input type="file" accept="application/json,.json" class="hidden" data-post-finishing-field="storage-import"/></label><p class="w-full text-xs text-muted-foreground">已由辅料仓管理的原辅料记录只保留历史；辅料库存使用辅料仓备份恢复。</p></div>`
}
export async function handlePostFinishingStorageEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  const action = target.closest<HTMLElement>('[data-post-finishing-action]')?.dataset.postFinishingAction
  const input = target.closest<HTMLInputElement>('[data-post-finishing-field="storage-import"]')
  if (!action?.startsWith('storage-') && !(input && event?.type === 'change')) return false
  delete target.dataset.postFinishingPreserveInput
  const notice = document.querySelector<HTMLElement>('[data-post-finishing-storage-notice]')
  try {
    if (action === 'storage-migrate') {
      if (!window.confirm('请确认已关闭其他旧版后道页面。转换将保留业务记录与图片，读回校验成功后移除已转换的旧资料。')) return true
      if (notice) notice.innerHTML = '<p>正在转换并核对旧资料，请等待完成。</p>'
      await migratePostFinishingLegacyData()
    } else if (action === 'storage-retry') await ensurePostFinishingRecordState()
    else if (action === 'storage-export') {
      const blob = await exportPostFinishingBackup(), url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = '后道本地资料.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      document.querySelector('[data-post-finishing-action-error]')?.remove()
      return true
    } else if (input?.files?.[0]) await importPostFinishingBackup(input.files[0])
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
