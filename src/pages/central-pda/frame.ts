import { escapeHtml } from '../../utils.ts'

export type CentralPdaTab = 'receive' | 'execute' | 'warehouse'
export type CentralPdaLanguage = 'zh' | 'id'

export interface CentralPdaFrameInput {
  family?: 'lace' | 'binding' | 'webbing' | 'post' | 'wool-stock' | 'wool-craft' | 'wool' | 'cutting' | 'special' | 'dye' | 'water' | 'print' | 'stenter'
  accountName: string
  accountNo: string
  factoryName: string
  operationName: string
  language: CentralPdaLanguage
  tab: CentralPdaTab
  content: string
  heading?: string
  backPath?: string
  tabPathPrefix?: string
  primary?: { label: string; action: string; disabled?: boolean; context?: string }
}

const labels = {
  zh: { receive: '接收', execute: '执行', warehouse: '仓管', language: '切换语言', exit: '退出', logout: '退出账号', back: '返回', operation: '选择工序', modules: '作业模块' },
  id: { receive: 'Terima', execute: 'Proses', warehouse: 'Gudang', language: 'Ganti bahasa', exit: 'Keluar', logout: 'Keluar akun', back: 'Kembali', operation: 'Pilih proses', modules: 'Menu kerja' },
} as const

const tabs: Array<{ tab: CentralPdaTab; icon: string }> = [
  { tab: 'receive', icon: 'download' },
  { tab: 'execute', icon: 'clipboard-list' },
  { tab: 'warehouse', icon: 'warehouse' },
]

export function centralPdaTabPath(tab: CentralPdaTab): string {
  return `/fcs/pda/central/${tab}`
}

/** New Central Factory view shell. Existing PDA pages and their commercial actions are not dependencies. */
export function renderCentralPdaFrame(input: CentralPdaFrameInput): string {
  const text = labels[input.language]
  const account = [input.accountName, input.accountNo].filter(Boolean).join(' · ')
  const icon = (name: string) => `<i data-lucide="${name}" class="h-6 w-6 shrink-0" aria-hidden="true"></i>`
  return `<section class="mx-auto flex h-[100dvh] min-h-0 w-full max-w-[420px] flex-col overflow-hidden bg-[#f2f5f9] text-[#1a293c]" data-central-pda-root data-central-family="${input.family || 'special'}" lang="${input.language === 'id' ? 'id' : 'zh-CN'}">
    <header class="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
      <div class="min-w-0 flex-1">
        <div class="truncate text-base font-bold leading-6" title="${escapeHtml(account)}">${escapeHtml(account)}</div>
        <div class="truncate text-sm leading-5 text-slate-600" title="${escapeHtml(input.factoryName)}">${escapeHtml(input.factoryName)}</div>
      </div>
      <button type="button" class="flex min-h-12 min-w-12 shrink-0 flex-col items-center justify-center gap-1 px-1 text-sm text-blue-700" data-central-action="language" aria-label="${text.language}">${icon('globe')}<span>${input.language === 'id' ? 'ID' : '中文'}</span></button>
      <button type="button" class="flex min-h-12 min-w-12 shrink-0 flex-col items-center justify-center gap-1 px-1 text-sm text-blue-700" data-central-action="logout" aria-label="${text.logout}">${icon('power')}<span>${text.exit}</span></button>
    </header>
    <div data-central-heading class="flex min-h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      ${input.backPath ? `<button type="button" class="flex h-12 w-11 shrink-0 items-center justify-center text-slate-800" data-central-nav="${escapeHtml(input.backPath)}" aria-label="${text.back}">${icon('chevron-left')}</button>` : ''}
      <h1 class="min-w-0 flex-1 break-words text-2xl font-bold leading-8">${escapeHtml(input.heading || text[input.tab])}</h1>
      ${input.backPath ? '' : `<button type="button" class="flex min-h-12 min-w-0 max-w-[55%] items-center justify-end gap-2 rounded-xl px-2 text-base font-semibold" data-central-action="operation" aria-label="${text.operation}"><span class="break-words text-right">${escapeHtml(input.operationName)}</span>${icon('chevron-down')}</button>`}
    </div>
    <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3" data-central-content>${input.content}</main>
    ${input.primary ? `<footer data-central-footer class="shrink-0 border-t border-slate-200 bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]"><button type="button" class="min-h-14 w-full break-words rounded-2xl bg-blue-600 px-4 py-3 text-lg font-bold leading-6 text-white disabled:bg-slate-300" data-central-action="${escapeHtml(input.primary.action)}"${input.primary.disabled ? ' disabled' : ''}>${escapeHtml(input.primary.label)}${input.primary.context?`<span class="block text-base leading-6">${escapeHtml(input.primary.context)}</span>`:''}</button></footer>` : ''}
    ${input.backPath ? '' : `<nav class="flex min-h-[72px] shrink-0 items-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]" aria-label="${text.modules}">${tabs.map(({ tab, icon: name }) => `<button type="button" class="relative flex min-h-[72px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-base ${input.tab === tab ? 'font-bold text-blue-600' : 'text-slate-500'}" data-central-nav="${escapeHtml(input.tabPathPrefix ? input.tabPathPrefix + '/' + tab : centralPdaTabPath(tab))}"${input.tab === tab ? ' aria-current="page"' : ''}>${input.tab === tab ? '<span class="absolute top-0 h-1 w-9 rounded-full bg-blue-600" aria-hidden="true"></span>' : ''}${icon(name)}<span class="break-words leading-5">${text[tab]}</span></button>`).join('')}</nav>`}
  </section>`
}
