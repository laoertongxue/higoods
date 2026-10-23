import { migratePartTicketRecords } from '../data/fcs/cutting/part-ticket-records.ts'
import { migrateLegacyCuttingEvents } from '../data/fcs/cutting/cutting-event-migration.ts'
import { migrateLegacyWarehouseLayouts } from '../data/fcs/cutting/warehouse-layout-records.ts'
import { escapeHtml } from '../utils.ts'
import { migrateProductionContextRecords } from '../data/fcs/production-context-records.ts'

function recoveryIndonesian(): boolean {
  if (!location.pathname.startsWith('/fcs/pda/central/')) return false
  try { return JSON.parse(localStorage.getItem('higood.central-pda.preferences.v1') || '{}').language === 'id' } catch { return false }
}
export function recoveryErrorText(error: unknown, indonesian: boolean): string {
  const message = error instanceof Error ? error.message : String(error)
  if (!indonesian) return `迁移未完成：${message}`
  if (/先关闭|并确认/.test(message)) return 'Tutup tab dan jendela HiGood lainnya, lalu centang konfirmasi.'
  if (/冲突|不同|其他页面改动|已变化/.test(message)) return 'Data lama berbeda dengan data tersimpan. Keduanya tetap disimpan. Tutup halaman lama dan periksa datanya.'
  if (/空间不足|Quota/.test(message)) return 'Ruang perangkat penuh. Data lama tetap disimpan. Kosongkan ruang, lalu coba lagi.'
  if (/清理|removeItem/.test(message)) return 'Data sudah diperiksa, tetapi data lama belum terhapus. Coba lagi dari sini.'
  return 'Pemindahan belum selesai. Data lama tetap disimpan. Periksa data lalu coba lagi; jangan hapus data situs.'
}
export function renderProductionContextRecovery(reason: string): string {
  const id = recoveryIndonesian()
  return `<section data-production-context-recovery data-recovery-language="${id ? 'id' : 'zh'}" class="mx-auto max-w-2xl space-y-4 rounded-lg border border-amber-300 bg-white p-5">
    <h1 class="text-lg font-semibold">${id ? 'Pindahkan data lama' : '先迁移本机业务记录'}</h1>
    <p role="alert" class="text-sm text-amber-900">${escapeHtml(id ? 'Perangkat ini masih menyimpan data lama. Pindahkan dan periksa sebelum melanjutkan.' : reason)}</p>
    <p class="text-sm">${id ? 'Data lama dihapus hanya setelah salinannya tersimpan dan diperiksa. Jika terhenti, lanjutkan dari sini.' : '生产单、任务分配、部位票、裁床收发、库位配置和旧水溶记录需要转入本机记录库。迁移会保存并读回核对，只有核对一致才清理对应旧记录。中断后可从这里继续。'}</p>
    <label class="flex min-h-12 items-center gap-2 text-sm"><input type="checkbox" data-production-context-pages-closed>${id ? 'Saya sudah menutup tab dan jendela HiGood lainnya' : '我已关闭其他 HiGood 标签页和窗口'}</label>
    <button type="button" data-production-context-migrate class="min-h-12 rounded bg-blue-600 px-4 py-2 text-sm text-white">${id ? 'Pindahkan dan lanjutkan' : '迁移并继续'}</button>
    <p role="status" data-production-context-progress class="text-sm text-blue-700"></p>
    <p class="text-xs text-slate-600">${id ? 'Jangan hapus data situs jika pemindahan belum selesai.' : '迁移失败时请保留网站数据，按提示处理后重试。不会自动删除未验证的记录。'}</p>
  </section>`
}
export async function handleProductionContextRecovery(target: HTMLElement): Promise<boolean> {
  const button = target.closest<HTMLButtonElement>('[data-production-context-migrate]')
  if (!button) return false
  if (button.disabled) return true
  const host = button.closest('[data-production-context-recovery]')!
  const status = host.querySelector<HTMLElement>('[data-production-context-progress]')!
  button.disabled = true
  const id = host.getAttribute('data-recovery-language') === 'id'
  const progress = (text: string) => { status.textContent = id ? 'Memindahkan dan memeriksa data lama…' : text }
  try {
    await migrateProductionContextRecords({ otherPagesClosed: Boolean(host.querySelector<HTMLInputElement>('[data-production-context-pages-closed]')?.checked), progress })
    await migratePartTicketRecords({ otherPagesClosed: Boolean(host.querySelector<HTMLInputElement>('[data-production-context-pages-closed]')?.checked), progress })
    await migrateLegacyCuttingEvents({ otherPagesClosed: Boolean(host.querySelector<HTMLInputElement>('[data-production-context-pages-closed]')?.checked), progress })
    await migrateLegacyWarehouseLayouts({ otherPagesClosed: Boolean(host.querySelector<HTMLInputElement>('[data-production-context-pages-closed]')?.checked), progress })
    await (await import('../data/fcs/water-soluble-legacy-migration.ts')).migrateLegacyWaterSolubleExecution({ otherPagesClosed: Boolean(host.querySelector<HTMLInputElement>('[data-production-context-pages-closed]')?.checked), progress })
    status.textContent = id ? 'Data tersimpan dan sudah diperiksa. Membuka kembali halaman…' : '生产记录已保存并核对，正在重新打开页面。'
    window.location.reload()
  } catch (error) { status.textContent = recoveryErrorText(error, id) }
  finally { button.disabled = false }
  return true
}
