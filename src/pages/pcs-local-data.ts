import { exportPcsBackup, restorePcsBackup, cleanupUnreferencedPcsFiles, type PcsBackup } from '../data/pcs-record-db.ts'
import { finalizePcsLegacyMigration, getPcsStorageFailure, hasPcsLegacyData, retryPcsRecordState } from '../data/pcs-record-runtime.ts'
import { escapeHtml } from '../utils.ts'
let mounted = false
let message = ''
let expanded = false
let busy = false
let estimate = ''

function render(): void {
  const host = document.getElementById('pcs-local-data')
  if (!host) return
  let legacy = false
  try { legacy = hasPcsLegacyData() } catch (error) {
    message = error instanceof Error ? error.message : '旧资料无法读取，原数据已保留，请核对后重试。'
  }
  const error = message || getPcsStorageFailure()
  host.innerHTML = `<div class="overflow-auto rounded-lg border border-slate-300 bg-white p-3 text-sm shadow-lg" style="max-width:min(460px,calc(100vw - 24px));max-height:calc(100vh - 180px)">
    <button data-pcs-local-action="toggle" class="font-medium text-blue-700">本机数据${legacy ? ' · 旧资料待清理' : ''}</button>
    ${error ? `<p role="status" class="mt-2 whitespace-pre-wrap text-amber-800">${escapeHtml(error)}</p>` : ''}
    ${expanded || legacy ? `<div class="mt-2 space-y-2"><p>资料保存在当前浏览器。导出包含业务记录与附件；清除网站数据前请保留备份。</p>
    ${legacy ? '<p>旧资料已保留。请关闭其他旧版本页面，再核对并完成清理。清理前暂停保存。</p><label class="block"><input id="pcs-old-pages-closed" type="checkbox" /> 我已关闭其他旧版本页面</label><button data-pcs-local-action="finish-migration" class="rounded border px-2 py-1">核对并完成旧资料清理</button>' : ''}
    <div class="flex flex-wrap gap-2"><button data-pcs-local-action="retry" class="rounded border px-2 py-1">重新读取 / 重试</button><button data-pcs-local-action="export" class="rounded border px-2 py-1">导出完整备份</button><label class="cursor-pointer rounded border px-2 py-1">导入备份<input data-pcs-local-import type="file" accept=".json" class="hidden" /></label><button data-pcs-local-action="cleanup" class="rounded border px-2 py-1">清理无引用附件</button><button data-pcs-local-action="estimate" class="rounded border px-2 py-1">查看空间</button></div>
    <p class="text-xs text-slate-500">导入仅支持空的 PCS 数据库；存在记录时会拒绝覆盖。${escapeHtml(estimate)}</p></div>` : ''}
    ${busy ? '<p role="status">正在处理，请稍候…</p>' : ''}</div>`
}
async function exportBackup(): Promise<void> {
  const backup = await exportPcsBackup()
  const fileParts = []
  for (const file of backup.files) {
    const bytes = new Uint8Array(await file.blob.arrayBuffer())
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
    fileParts.push({ id: file.id, type: file.blob.type, bytes: btoa(binary) })
  }
  // Base64 仅用于用户主动下载的便携备份；业务数据库始终保存原始 Blob。
  const url = URL.createObjectURL(new Blob([JSON.stringify({ ...backup, files: fileParts })], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `HiGood-PCS-${new Date().toISOString().slice(0, 10)}.json`; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  message = `已导出 ${backup.records.length} 条记录、${backup.files.length} 个附件。请保存下载文件。`
}
async function act(action: string): Promise<void> {
  if (busy) return
  if (action === 'toggle') { expanded = !expanded; render(); return }
  const oldPagesClosed = Boolean(document.querySelector<HTMLInputElement>('#pcs-old-pages-closed')?.checked)
  busy = true; render()
  try {
    if (action === 'finish-migration') { await finalizePcsLegacyMigration(oldPagesClosed); message = '旧资料已读回核对并清理，现在可以保存。' }
    if (action === 'retry') { await retryPcsRecordState(); location.reload(); return }
    if (action === 'export') await exportBackup()
    if (action === 'cleanup') message = `已清理 ${await cleanupUnreferencedPcsFiles()} 个无引用附件，有效附件已保留。`
    if (action === 'estimate') {
      const space = await navigator.storage.estimate()
      const backup = await exportPcsBackup()
      estimate = `本站空间估算：已用 ${((space.usage || 0) / 1048576).toFixed(1)} MB / 配额 ${((space.quota || 0) / 1048576).toFixed(1)} MB；PCS 附件 ${backup.files.length} 个，共 ${(backup.files.reduce((sum, file) => sum + file.blob.size, 0) / 1048576).toFixed(1)} MB。`
    }
  } catch (error) { message = error instanceof Error ? error.message : '未完成，请重试。' }
  finally { busy = false; render() }
}
export function mountPcsLocalData(): void {
  if (mounted) { render(); return }
  mounted = true
  const host = document.createElement('aside'); host.id = 'pcs-local-data'
  host.className = 'fixed bottom-20 right-3 z-[90]'; host.setAttribute('aria-label', 'PCS 本机数据管理'); document.body.append(host)
  host.addEventListener('click', event => { const node = (event.target as Element).closest<HTMLElement>('[data-pcs-local-action]'); if (node) { event.stopPropagation(); void act(node.dataset.pcsLocalAction || '') } })
  host.addEventListener('change', async event => {
    const input = event.target as HTMLInputElement
    if (!input.matches('[data-pcs-local-import]') || !input.files?.[0] || busy) return
    busy = true; const file = input.files[0]
    try {
      const parsed = JSON.parse(await file.text())
      if (!Array.isArray(parsed.files)) throw new Error('备份文件缺少附件清单。')
      const backup: PcsBackup = { ...parsed, files: parsed.files.map((entry: { id: string; type: string; bytes: string }) => {
        if (typeof entry.bytes !== 'string') throw new Error('附件编码无效。')
        return { id: entry.id, blob: new Blob([Uint8Array.from(atob(entry.bytes), char => char.charCodeAt(0))], { type: entry.type }) }
      }) }
      await restorePcsBackup(backup); message = '备份已恢复，请重新读取页面。'
    } catch (error) { message = error instanceof Error ? error.message : '导入失败，已有记录未修改。' }
    finally { busy = false; input.value = ''; render() }
  })
  window.addEventListener('pcs-storage-status', event => { message = (event as CustomEvent<string>).detail; render() })
  render()
}
