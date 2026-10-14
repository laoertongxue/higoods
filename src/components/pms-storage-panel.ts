import { escapeHtml } from '../utils.ts'
import { detectLegacyMaterialPurchaseOrders, readLegacyMaterialPurchaseBackup, migrateLegacyMaterialPurchaseOrders } from '../data/pms/legacy-purchase-migration.ts'
import { downloadPmsFile } from '../utils/pms-export.ts'
import { estimatePmsStorage, exportPmsDataBundle, importPmsDataBundle } from '../data/pms/idb-storage.ts'

let panel: HTMLElement | null = null
let backup: File | null = null
let returnFocus: HTMLElement | null = null
let legacySourceHash: string | undefined

function message(text: string, failed = false): void {
  const region = panel?.querySelector<HTMLElement>('[data-storage-result]')
  if (!region) return
  region.textContent = text
  region.className = failed ? 'text-sm text-red-700' : 'text-sm text-slate-700'
}

export function closePmsStoragePanel(): boolean {
  if (!panel) return false
  panel.remove(); panel = null; backup = null; legacySourceHash = undefined
  if (returnFocus?.isConnected) returnFocus.focus()
  returnFocus = null
  return true
}

export async function openPmsStoragePanel(): Promise<void> {
  if (panel) return
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  panel = document.createElement('div')
  panel.className = 'fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/50 p-4'
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', '采购本地资料')
  panel.innerHTML = `<section class="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl bg-white p-5 shadow-xl"><header class="flex items-center justify-between"><h2 class="text-lg font-semibold">采购本地资料</h2><button type="button" data-storage-action="close" class="rounded border px-3 py-2">关闭</button></header><p class="my-4 text-sm text-slate-600">记录和附件保存在当前浏览器。备份包含当前采购功能的已保存记录和附件，可在另一浏览器恢复。已删除功能的历史资料仍留在原浏览器，不在此备份范围内。</p><div class="mb-4 rounded border bg-slate-50 p-3 text-sm" data-storage-capacity>正在读取已保存资料…</div><div class="flex flex-wrap gap-3"><button type="button" data-storage-action="export" class="rounded bg-blue-600 px-4 py-2 text-sm text-white">导出采购备份</button><label class="cursor-pointer rounded border px-4 py-2 text-sm">选择备份文件<input type="file" accept=".higood-pms" aria-label="选择采购备份文件" class="sr-only" data-storage-file></label></div><div class="my-4 hidden rounded border border-amber-300 bg-amber-50 p-3 text-sm" data-storage-restore><div data-storage-file-summary></div><p class="mt-2">已有相同资料保留；冲突会停止整批恢复。当前浏览器已有备份中的附件时，请在空白浏览器恢复。</p><button type="button" data-storage-action="restore" class="mt-3 rounded bg-blue-600 px-4 py-2 text-white">恢复备份</button></div><div class="my-4 hidden rounded border border-amber-300 bg-amber-50 p-3 text-sm" data-storage-legacy><h3 class="font-semibold">旧版面辅料采购资料</h3><p class="mt-2" data-storage-legacy-summary></p><div class="mt-3 flex gap-2"><button type="button" data-storage-action="legacy-export" class="rounded border bg-white px-3 py-2">导出旧采购资料</button></div><label class="mt-3 flex items-start gap-2"><input type="checkbox" data-storage-old-pages-closed class="mt-1">已关闭其他旧版采购页面。核对保存和附件后，仅清理旧版面辅料采购缓存。</label><button type="button" data-storage-action="legacy-migrate" class="mt-3 rounded bg-blue-600 px-4 py-2 text-white" disabled>迁移旧采购资料</button></div><p role="status" aria-live="polite" data-storage-result></p></section>`
  document.body.appendChild(panel)
  const currentPanel = panel
  panel.addEventListener('click', async (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-storage-action]') : null
    const action = target?.dataset.storageAction
    if (event.target === currentPanel || action === 'close') { closePmsStoragePanel(); return }
    if (!target || !action) return
    target.setAttribute('disabled', '')
    try {
      if (action === 'export') {
        const { blob } = await exportPmsDataBundle()
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `采购备份-${new Date().toISOString().slice(0, 10)}.higood-pms`
        document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500)
        message('采购备份文件已生成。')
      } else if (action === 'legacy-export') {
        const source = await readLegacyMaterialPurchaseBackup()
        downloadPmsFile(source.fileName, source.raw, 'application/json')
        message('旧采购资料备份文件已生成。')
      } else if (action === 'legacy-migrate') {
        const closed = currentPanel.querySelector<HTMLInputElement>('[data-storage-old-pages-closed]')?.checked === true
        const result = await migrateLegacyMaterialPurchaseOrders({ otherPagesClosed: closed, expectedSourceHash: legacySourceHash })
        message(result.message.replace('指定旧键', '旧版采购缓存').replace('此旧采购键', '旧版采购资料'))
        if (result.status === 'completed' || result.status === 'no-source') currentPanel.querySelector('[data-storage-legacy]')?.classList.add('hidden')
      } else if (action === 'restore' && backup) {
        const result = await importPmsDataBundle(backup)
        message(`已恢复 ${result.imported} 条记录。刷新页面后查看结果。未保存的表单不会恢复。`)
        backup = null; currentPanel.querySelector('[data-storage-restore]')?.classList.add('hidden')
      }
    } catch (error) { message(error instanceof Error ? error.message : '资料操作未完成，请重试。', true) }
    finally { target.removeAttribute('disabled') }
  })
  panel.addEventListener('change', async (event) => {
    const input = event.target
    if (input instanceof HTMLInputElement && input.hasAttribute('data-storage-old-pages-closed')) {
      const migrateButton = currentPanel.querySelector<HTMLButtonElement>('[data-storage-action="legacy-migrate"]')
      if (migrateButton) migrateButton.disabled = !input.checked || !legacySourceHash
      return
    }
    if (!(input instanceof HTMLInputElement) || !input.hasAttribute('data-storage-file')) return
    const file = input.files?.[0]
    if (!file) return
    backup = null
    currentPanel.querySelector('[data-storage-restore]')?.classList.add('hidden')
    const previousSummary = currentPanel.querySelector<HTMLElement>('[data-storage-file-summary]')
    if (previousSummary) previousSummary.textContent = ''
    try {
      const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
      if (file.size > 128 * 1024 * 1024 || new TextDecoder().decode(header.slice(0, 8)) !== 'HGPMS001') throw new Error('请选择采购备份文件（最多 128 MB）。')
      const size = new DataView(header.buffer).getUint32(8, true)
      if (size > file.size - 12) throw new Error('备份文件不完整。')
      const manifest = JSON.parse(await file.slice(12, 12 + size).text())
      if (!Array.isArray(manifest.stores)) throw new Error('备份记录格式不符。')
      backup = file
      const summary = currentPanel.querySelector<HTMLElement>('[data-storage-file-summary]')
      if (summary) summary.innerHTML = `${escapeHtml(file.name)} · ${manifest.stores.reduce((sum: number, entry: { records: unknown[] }) => sum + entry.records.length, 0)} 条记录`
      currentPanel.querySelector('[data-storage-restore]')?.classList.remove('hidden')
      message('备份文件已读取，尚未恢复。')
    } catch (error) { message(error instanceof Error ? error.message : '备份文件无法读取。', true) }
  })
  try {
    const capacity = await estimatePmsStorage()
    const region = currentPanel.querySelector('[data-storage-capacity]')
    if (region) region.textContent = `已保存采购资料约 ${(capacity.pmsTotalBytes / 1024).toFixed(1)} KB；浏览器可用空间估算 ${(Math.max(0, capacity.quota - capacity.usage) / 1024 / 1024).toFixed(0)} MB。`
  } catch (error) { message(error instanceof Error ? error.message : '资料未能读取。', true) }
  try {
    const source = await detectLegacyMaterialPurchaseOrders()
    if (source.found) {
      legacySourceHash = source.sourceHash
      currentPanel.querySelector('[data-storage-legacy]')?.classList.remove('hidden')
      const summary = currentPanel.querySelector('[data-storage-legacy-summary]')
      if (summary) summary.textContent = `发现 ${source.count} 条旧采购记录。已有内容相同的记录保留，冲突会停止迁移。普通打开页面不会迁移或清理。`
    }
  } catch (error) {
    currentPanel.querySelector('[data-storage-legacy]')?.classList.remove('hidden')
    const summary = currentPanel.querySelector('[data-storage-legacy-summary]')
    if (summary) summary.textContent = error instanceof Error ? error.message : '旧采购资料未能核对。可先导出原始资料，当前内容仍保留。'
  }
  currentPanel.querySelector<HTMLButtonElement>('button')?.focus()
}

if (typeof document !== 'undefined') document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && closePmsStoragePanel()) { event.preventDefault(); event.stopImmediatePropagation(); return }
  if (event.key !== 'Tab' || !panel) return
  const controls = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]')).filter(control => control.getClientRects().length > 0)
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus() }
}, true)
