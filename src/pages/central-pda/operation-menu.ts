import { escapeHtml } from '../../utils.ts'
import type { CentralPdaLanguage, CentralPdaTab } from './frame.ts'

export interface CentralOperationChoice {
  id: string
  label: string
}

export interface CentralOperationMenuInput {
  language: CentralPdaLanguage
  tab: CentralPdaTab
  factoryId: string
  currentPath?: string
  currentOperationId?: string
  assistOperations?: CentralOperationChoice[]
  specialOperations?: CentralOperationChoice[]
  accessoryOperations?: CentralOperationChoice[]
}

function item(label: string, attrs: string, selected: boolean): string {
  return `<button type="button" class="flex min-h-14 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[15px] font-semibold leading-5 ${selected ? 'border-[#2461ed] bg-[#edf3ff] text-[#2054c0]' : 'border-[#ced9e7] bg-white text-[#1a293c]'}" data-central-operation-item ${attrs}><span class="min-w-0 break-words">${escapeHtml(label)}</span>${selected ? '<span class="shrink-0 text-[#2461ed]" aria-hidden="true">✓</span>' : ''}</button>`
}

function group(title: string, items: string[]): string {
  return items.length ? `<section data-central-operation-group><h3 class="mb-2 mt-4 text-[16px] font-semibold text-[#64748b]">${escapeHtml(title)}</h3><div class="grid grid-cols-2 gap-2">${items.join('')}</div></section>` : ''
}

/** V34 operation picker: one searchable, grouped grid for every central family. */
export function renderCentralOperationMenu(input: CentralOperationMenuInput): string {
  const zh = input.language === 'zh'
  const currentPath = (input.currentPath || '').split('?')[0]
  const isCurrent = (path: string) => currentPath === path.split('?')[0] || (!!path && currentPath.startsWith(path.split('?')[0] + '/'))
  const link = (label: string, path: string) => item(label, `data-central-nav="${escapeHtml(path)}"`, isCurrent(path))
  const select = (choice: CentralOperationChoice) => item(choice.label, `data-central-action="operation-select" data-central-value="${escapeHtml(choice.id)}"`, choice.id === input.currentOperationId)
  const base = [
    link(zh ? '裁剪' : 'Potong', `/fcs/pda/central/cut/${input.tab}?factoryId=${encodeURIComponent(input.factoryId)}`),
    link(zh ? '毛织' : 'Rajut', '/fcs/pda/central/wool/receive'),
    link(zh ? '染色' : 'Pencelupan', '/fcs/pda/central/dye/receive'),
    link(zh ? '印花' : 'Pencetakan', `/fcs/pda/central/print/${input.tab}`),
    link(zh ? '水溶' : 'Larut air', '/fcs/pda/central/water/receive'),
    link(zh ? '后道' : 'Finishing', `/fcs/pda/central/post/${input.tab}`),
    link(zh ? '定型机手感' : 'Hasil rabaan', '/fcs/pda/central/stenter/receive'),
    link(zh ? '捆条' : 'Bis', `/fcs/pda/central/binding/${input.tab}`),
  ]
  const assist = (input.assistOperations || []).map(select)
  const special = (input.specialOperations || []).map(select)
  const accessory = [
    ...(input.accessoryOperations || []).map(select),
    link(zh ? '花边' : 'Renda', `/fcs/pda/central/lace/${input.tab}`),
    link(zh ? '织带' : 'Bis', `/fcs/pda/central/webbing/${input.tab}`),
  ]
  return `<h2 class="text-xl font-bold">${zh ? '选择工序' : 'Pilih proses'}</h2>
    <label class="sr-only" for="central-operation-search">${zh ? '查找工序' : 'Cari proses'}</label>
    <input id="central-operation-search" data-central-operation-search type="search" autocomplete="off" placeholder="${zh ? '查找工序 / 辅料' : 'Cari proses / aksesori'}" class="mt-2 min-h-12 w-full rounded-xl border border-[#bdcadb] bg-white px-3 text-[16px] text-[#1a293c] outline-none focus:border-[#2461ed]">
    ${group(zh ? '基础工序' : 'Proses dasar', base)}
    ${group(zh ? '辅助工艺' : 'Proses bantu', assist)}
    ${group(zh ? '特种工艺' : 'Proses khusus', special)}
    ${group(zh ? '辅料厂' : 'Pabrik aksesori', accessory)}`
}
