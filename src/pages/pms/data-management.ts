// @page-pattern: data-management
/**
 * PMS 数据管理页(§ 2.4.5):
 * - 空间估算(navigator.storage.estimate + 每 store 字节)
 * - 导出备份(全 store JSON 下载)
 * - 导入恢复(校验 + IDB 事务批量 put)
 * - 清空所有 PMS 数据(二次确认)
 */
import {
  clearAllPmsData,
  estimatePmsStorage,
  exportPmsDataBundle,
  importPmsDataBundle,
} from '../../data/pms/idb-storage.ts'
import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface } from './shared.ts'

const ROOT_SELECTOR = '[data-pms-data-management-root]'

interface PmsStorageSnapshot {
  usage: number
  quota: number
  pmsStoreBytes: Record<string, number>
  pmsTotalBytes: number
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function renderStorageRow(label: string, value: number): string {
  return `<div class="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
    <span class="text-muted-foreground">${escapeHtml(label)}</span>
    <span class="font-semibold tabular-nums">${escapeHtml(formatBytes(value))}</span>
  </div>`
}

function renderStorageSnapshot(snapshot: PmsStorageSnapshot): string {
  const storeRows = Object.entries(snapshot.pmsStoreBytes)
    .sort((a, b) => b[1] - a[1])
    .map(([store, bytes]) => renderStorageRow(store, bytes))
    .join('')
  return `
    <div class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">PMS 业务数据存储估算</h3>
      <p class="mt-1 text-xs text-muted-foreground">浏览器 IndexedDB 总体占用 + 各 PMS store 估算字节数(navigator.storage.estimate 是估算值)。</p>
      <dl class="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div class="rounded border bg-slate-50 p-3">
          <dt class="text-xs text-muted-foreground">浏览器总占用</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${escapeHtml(formatBytes(snapshot.usage))}</dd>
        </div>
        <div class="rounded border bg-slate-50 p-3">
          <dt class="text-xs text-muted-foreground">浏览器存储配额</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${escapeHtml(formatBytes(snapshot.quota))}</dd>
        </div>
        <div class="rounded border bg-slate-50 p-3">
          <dt class="text-xs text-muted-foreground">PMS 业务数据估算</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${escapeHtml(formatBytes(snapshot.pmsTotalBytes))}</dd>
        </div>
        <div class="rounded border bg-slate-50 p-3">
          <dt class="text-xs text-muted-foreground">PMS 占浏览器配额</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${
            snapshot.quota > 0
              ? escapeHtml(((snapshot.pmsTotalBytes / snapshot.quota) * 100).toFixed(2) + '%')
              : '—'
          }</dd>
        </div>
      </dl>
      <div class="mt-4 max-h-64 overflow-y-auto rounded border bg-white p-2">
        ${storeRows || '<p class="text-xs text-muted-foreground">尚无业务数据。</p>'}
      </div>
    </div>`
}

function renderExportCard(): string {
  return `
    <div class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">导出备份</h3>
      <p class="mt-1 text-xs text-muted-foreground">把所有 PMS store 序列化为 JSON 下载到本地。仅当前浏览器配置可用。</p>
      <button id="pms-export-btn" type="button" class="mt-3 h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">导出 PMS 数据</button>
      <div id="pms-export-status" class="mt-2 text-xs text-muted-foreground"></div>
    </div>`
}

function renderImportCard(): string {
  return `
    <div class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">导入恢复</h3>
      <p class="mt-1 text-xs text-muted-foreground">从本地备份文件恢复 PMS 业务数据。导入会覆盖现有同 store 同主键数据。</p>
      <label class="mt-3 block">
        <span class="text-xs text-muted-foreground">选择 JSON 文件</span>
        <input id="pms-import-file" type="file" accept="application/json" class="mt-1 block w-full rounded border bg-white px-2 py-1.5 text-sm">
      </label>
      <div id="pms-import-status" class="mt-2 text-xs text-muted-foreground"></div>
    </div>`
}

function renderClearCard(): string {
  return `
    <div class="rounded-lg border border-red-200 bg-red-50 p-4">
      <h3 class="text-sm font-semibold text-red-800">清空所有 PMS 数据</h3>
      <p class="mt-1 text-xs text-red-700">清除所有 PMS IDB store。业务数据、操作日志、附件引用将全部丢失。此操作不可撤销。</p>
      <button id="pms-clear-btn" type="button" class="mt-3 h-9 rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-100">清空所有 PMS 数据</button>
      <div id="pms-clear-status" class="mt-2 text-xs text-red-700"></div>
    </div>`
}

export async function renderPmsDataManagementPage(): Promise<string> {
  const snapshot = await estimatePmsStorage()
  return renderPmsDataManagementPageInner(snapshot)
}

function renderPmsDataManagementPageInner(snapshot: PmsStorageSnapshot): string {
  return `<div ${ROOT_SELECTOR.slice(1, -1)} data-skip-page-rerender="true" class="space-y-4 p-4">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">PMS 数据管理</h1>
        <p class="mt-1 text-sm text-muted-foreground">导出备份、导入恢复、空间估算与重置</p>
      </div>
    </header>
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      ${renderStorageSnapshot(snapshot)}
      ${renderExportCard()}
      ${renderImportCard()}
      ${renderClearCard()}
    </div>
  </div>`
}

export function handlePmsDataManagementEvent(target: HTMLElement | null): boolean {
  if (!target) return false
  // 导出按钮
  if (target.id === 'pms-export-btn') {
    void handleExportPmsData()
    return true
  }
  // 清空按钮(二次确认)
  if (target.id === 'pms-clear-btn') {
    void handleClearPmsData()
    return true
  }
  return false
}

async function handleExportPmsData(): Promise<void> {
  const status = document.getElementById('pms-export-status')
  if (!status) return
  status.textContent = '正在导出 PMS 数据...'
  try {
    const { json, bytes, storeBytes } = await exportPmsDataBundle()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    link.href = url
    link.download = `higood-pms-backup-${ts}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    const storeCount = Object.keys(storeBytes).length
    status.className = 'mt-2 text-xs text-green-700'
    status.textContent = `导出成功:${formatBytes(bytes)} · ${storeCount} 个 store`
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    status.className = 'mt-2 text-xs text-red-700'
    status.textContent = `导出失败:${message}`
  }
}

async function handleClearPmsData(): Promise<void> {
  const status = document.getElementById('pms-clear-status')
  if (!status) return
  const confirmed = typeof window !== 'undefined'
    && typeof window.confirm === 'function'
    && window.confirm('确认清空所有 PMS 数据?此操作不可撤销,所有业务记录与操作日志都将丢失。')
  if (!confirmed) return
  status.textContent = '正在清空...'
  try {
    await clearAllPmsData()
    status.className = 'mt-2 text-xs text-green-700'
    status.textContent = '所有 PMS 数据已清空。请刷新页面查看种子状态。'
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    status.className = 'mt-2 text-xs text-red-700'
    status.textContent = `清空失败:${message}`
  }
}

export function handlePmsDataManagementFile(target: HTMLInputElement | null): boolean {
  if (!target || target.id !== 'pms-import-file') return false
  const file = target.files?.[0]
  if (!file) return false
  const status = document.getElementById('pms-import-status')
  if (!status) return true
  const reader = new FileReader()
  reader.onload = (): void => {
    void (async () => {
      const text = String(reader.result ?? '')
      status.textContent = '正在导入...'
      try {
        const { imported, storeCounts } = await importPmsDataBundle(text)
        const entries = Object.entries(storeCounts)
        status.className = 'mt-2 text-xs text-green-700'
        status.textContent = `导入成功:${imported} 条记录覆盖 ${entries.length} 个 store。请刷新页面查看。`
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown'
        status.className = 'mt-2 text-xs text-red-700'
        status.textContent = `导入失败:${message}`
      }
    })()
  }
  reader.onerror = (): void => {
    status.className = 'mt-2 text-xs text-red-700'
    status.textContent = '文件读取失败'
  }
  reader.readAsText(file)
  return true
}

export async function buildPmsDataManagementSnapshot(): Promise<PmsStorageSnapshot> {
  return estimatePmsStorage()
}

export function hydratePmsDataManagementSurface(): void {
  hydratePmsSurface(document.querySelector(ROOT_SELECTOR))
}
