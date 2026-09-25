import { migratePartTicketRecords } from '../data/fcs/cutting/part-ticket-records.ts'
import { migrateLegacyCuttingEvents } from '../data/fcs/cutting/cutting-event-migration.ts'
import { escapeHtml } from '../utils.ts'
import { migrateProductionContextRecords } from '../data/fcs/production-context-records.ts'

export function renderProductionContextRecovery(reason: string): string {
  return `<section data-production-context-recovery class="mx-auto max-w-2xl space-y-4 rounded-lg border border-amber-300 bg-white p-5">
    <h1 class="text-lg font-semibold">先迁移本机业务记录</h1>
    <p role="alert" class="text-sm text-amber-900">${escapeHtml(reason)}</p>
    <p class="text-sm">生产单、任务分配、部位票和裁后记录需要转入本机记录库。迁移会分批保存并读回核对，只有核对一致才清理对应旧记录。中断后可从这里继续。</p>
    <label class="flex gap-2 text-sm"><input type="checkbox" data-production-context-pages-closed>我已关闭其他 HiGood 标签页和窗口</label>
    <button type="button" data-production-context-migrate class="rounded bg-blue-600 px-4 py-2 text-sm text-white">迁移并继续</button>
    <p role="status" data-production-context-progress class="text-sm text-blue-700"></p>
    <p class="text-xs text-slate-600">迁移失败时请保留网站数据，按提示处理后重试。不会自动删除未验证的记录。</p>
  </section>`
}
export async function handleProductionContextRecovery(target: HTMLElement): Promise<boolean> {
  const button = target.closest<HTMLButtonElement>('[data-production-context-migrate]')
  if (!button) return false
  if (button.disabled) return true
  const host = button.closest('[data-production-context-recovery]')!
  const status = host.querySelector<HTMLElement>('[data-production-context-progress]')!
  button.disabled = true
  try {
    await migrateProductionContextRecords({ otherPagesClosed: Boolean(host.querySelector<HTMLInputElement>('[data-production-context-pages-closed]')?.checked), progress: text => { status.textContent = text } })
    await migratePartTicketRecords({ otherPagesClosed: Boolean(host.querySelector<HTMLInputElement>('[data-production-context-pages-closed]')?.checked), progress: text => { status.textContent = text } })
    await migrateLegacyCuttingEvents({ otherPagesClosed: Boolean(host.querySelector<HTMLInputElement>('[data-production-context-pages-closed]')?.checked), progress: text => { status.textContent = text } })
    status.textContent = '生产记录已保存并核对，正在重新打开页面。'
    window.location.reload()
  } catch (error) { status.textContent = `迁移未完成：${error instanceof Error ? error.message : String(error)}` }
  finally { button.disabled = false }
  return true
}
