import { inspectCuttingFileUsage, removeConfirmedUnreferencedCuttingFiles, type CuttingFileUsage } from '../../../data/fcs/cutting/cutting-file-maintenance.ts'
import { migratePartTicketRecords } from '../../../data/fcs/cutting/part-ticket-records.ts'
import { migrateProductionContextRecords } from '../../../data/fcs/production-context-records.ts'
import { migrateLegacyCuttingEvents } from '../../../data/fcs/cutting/cutting-event-migration.ts'
import { escapeHtml as e } from '../../../utils.ts'
import { buildCuttingBackupFile, readCuttingBackupFile } from '../../../data/fcs/cutting/cutting-backup-file.ts'
import { readCuttingRecords, restoreCuttingRecordBackup } from '../../../data/fcs/cutting/cutting-record-repository.ts'
import { hydrateCuttingEventRecords } from '../../../data/fcs/cutting/cutting-event-repository.ts'

let information = ''; let message = ''; let busy = false
let cleanupScope: CuttingFileUsage | null = null
export function isReplacementFabricDataToolBusy() { return busy }
export async function loadReplacementFabricDataInformation(): Promise<void> {
  const snapshot = await readCuttingRecords()
  const estimate = await navigator.storage?.estimate?.()
  const usage = await inspectCuttingFileUsage(); cleanupScope = null
  information = `本机裁后处理已保存 ${snapshot.records.length} 条记录、${usage.total} 个附件（${(usage.bytes / 1024 / 1024).toFixed(2)} MB）。${estimate?.usage ? `整个网站估算占用 ${(estimate.usage / 1024 / 1024).toFixed(2)} MB。` : ''}`
  message = ''
}
export function renderReplacementFabricDataTools(): string {
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" data-hpb-backdrop><section role="dialog" aria-modal="true" aria-label="本机裁后处理数据" class="w-full max-w-xl space-y-4 rounded-lg bg-white p-5"><div class="flex justify-between"><h2 class="font-semibold">本机裁后处理数据</h2><button type="button" data-hpb-action="close">关闭</button></div><p class="text-sm">${e(information)}</p><p class="text-sm">备份包含本功能已保存的换片布票、打印记录、交出记录、已迁移生产单与任务分配、部位票和关联裁后动作。本机数据仅在当前浏览器和网站地址中有效，请保留备份。静态面料图随原型发布；已保存的关联生产附件随备份保留。</p><p class="text-sm text-amber-800">尚未迁移的其他模块数据不在这份备份中，不能用它代替全站备份。恢复只合并相同或尚不存在的记录；冲突时整批不保存。</p><div class="space-y-2 rounded border p-3"><p class="text-sm">迁移旧裁后记录会先保存并读回核对，再清理共享旧账中的对应记录，其他模块记录保留。</p><label class="flex gap-2 text-sm"><input type="checkbox" data-hpb-migration-closed />我已关闭其他 HiGood 标签页和窗口</label><button class="rounded border px-3 py-2" data-hpb-data-action="migrate">迁移旧裁后记录</button></div><div class="flex flex-wrap gap-3"><button type="button" class="rounded border px-3 py-2" data-hpb-data-action="inspect-files">检查无引用附件</button><button type="button" class="rounded border px-3 py-2" data-hpb-data-action="export">导出裁后处理备份</button><label class="rounded border px-3 py-2">选择备份恢复<input type="file" accept=".higcut" class="mt-2 block max-w-full text-sm" data-hpb-restore-file></label></div><p role="status" data-hpb-data-message class="text-sm text-blue-700">${e(message)}</p></section></div>`
}
export async function handleReplacementFabricDataTools(target: HTMLElement, event: Event): Promise<boolean> {
  const action = target.closest<HTMLElement>('[data-hpb-data-action]')
  const fileInput = target.closest<HTMLInputElement>('[data-hpb-restore-file]')
  if (!action && !fileInput) return false
  if ((action && event.type !== 'click') || (fileInput && event.type !== 'change') || busy) return true
  busy = true
  const controls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('[data-hpb-backdrop] input, [data-hpb-backdrop] button'))
  const previousDisabled = controls.map(control => control.disabled); controls.forEach(control => { control.disabled = true })
  const show = (text: string) => { message = text; const node = document.querySelector('[data-hpb-data-message]'); if (node) node.textContent = text }
  try {
    if (action?.dataset.hpbDataAction === 'migrate') {
      await migrateProductionContextRecords({ otherPagesClosed: Boolean(document.querySelector<HTMLInputElement>('[data-hpb-migration-closed]')?.checked), progress: show })
      await migratePartTicketRecords({ otherPagesClosed: Boolean(document.querySelector<HTMLInputElement>('[data-hpb-migration-closed]')?.checked), progress: show })
      await migrateLegacyCuttingEvents({ otherPagesClosed: Boolean(document.querySelector<HTMLInputElement>('[data-hpb-migration-closed]')?.checked), progress: show }); await hydrateCuttingEventRecords()
    } else if (action?.dataset.hpbDataAction === 'inspect-files') {
      cleanupScope = await inspectCuttingFileUsage()
      show(cleanupScope.orphanIds.length ? `已检查：${cleanupScope.orphanIds.length} 个附件（${(cleanupScope.orphanBytes / 1024 / 1024).toFixed(2)} MB）没有任何业务记录或操作回执引用。确认后只删除这些附件；仍有引用的文件保留。` : '检查完成：没有可清理的无引用附件。')
      const node = document.querySelector('[data-hpb-data-message]')
      if (cleanupScope.orphanIds.length && node) node.insertAdjacentHTML('beforeend', '<button type="button" class="mt-2 block rounded border border-red-300 px-3 py-2 text-red-700" data-hpb-data-action="cleanup-confirm">确认清理上述无引用附件</button>')
    } else if (action?.dataset.hpbDataAction === 'cleanup-confirm') {
      if (!cleanupScope) throw new Error('请先检查并核对清理范围。')
      const count = await removeConfirmedUnreferencedCuttingFiles(cleanupScope); cleanupScope = null
      show(`已清理 ${count} 个无引用附件，业务记录与仍有引用的附件保留。`)
    } else if (action) {
      const blob = await buildCuttingBackupFile(); const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `裁后处理-${new Date().toISOString().slice(0, 10)}.higcut`; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000); show('备份文件已生成，请妥善保存。')
    } else if (fileInput?.files?.[0]) {
      const backup = await readCuttingBackupFile(fileInput.files[0])
      await restoreCuttingRecordBackup(backup); await hydrateCuttingEventRecords()
      show('已恢复并读回确认。关闭后刷新分配与打印状态。')
    }
  } catch (error) { show(`未保存：${error instanceof Error ? error.message : String(error)}`) }
  finally { busy = false; controls.forEach((control, index) => { control.disabled = previousDisabled[index] }) }
  return true
}
