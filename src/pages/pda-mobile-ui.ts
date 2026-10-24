import { escapeHtml } from '../utils.ts'

// Shared PDA presentation follows the V34 field screens: large touch rows, one
// object identity per screen, collapsible secondary facts and a fixed action.
export const pdaUi = {
  page: 'space-y-3 bg-[#f2f5f9] p-3',
  card: 'rounded-xl border border-[#dfe6ee] bg-white',
  ink: 'text-[#1a293c]',
  muted: 'text-[#62748a]',
  primaryButton: 'flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#2461ed] px-4 text-center text-[17px] font-semibold leading-6 text-white disabled:bg-[#aebfd8] disabled:text-white',
  secondaryButton: 'flex min-h-[48px] w-full items-center justify-center rounded-xl border border-[#ccd8e7] bg-white px-4 text-center text-[15px] font-semibold leading-6 text-[#2461ed]',
  actionRow: 'flex min-h-[60px] w-full items-center justify-between gap-3 rounded-xl border border-[#ced9e7] bg-white px-4 py-3 text-left',
  input: 'h-[52px] w-full min-w-0 rounded-xl border border-[#bdcadb] bg-white px-3 text-[20px] font-semibold text-[#1a293c] outline-none focus:border-[#2461ed]',
  label: 'block text-[15px] font-medium leading-6 text-[#1a293c]',
} as const

const pillTones = {
  info: 'bg-[#edf3ff] text-[#2054c0]',
  ready: 'bg-[#e9f6ef] text-[#167647]',
  warn: 'bg-[#fff4df] text-[#9a5908]',
  danger: 'bg-[#fff0f0] text-[#ba2b32]',
} as const

export type PdaPillTone = keyof typeof pillTones

export function pdaPill(label: string, tone: PdaPillTone = 'info'): string {
  return `<span class="inline-flex max-w-[48%] shrink-0 items-center rounded-md px-2 py-1 text-right text-xs font-semibold leading-4 ${pillTones[tone]}">${escapeHtml(label)}</span>`
}

export function pdaSectionTitle(title: string, meta = ''): string {
  return `<div class="flex items-end justify-between gap-2 px-1 pt-1"><h2 class="min-w-0 text-[16px] font-semibold leading-6 text-[#64748b]">${escapeHtml(title)}</h2>${meta ? `<span class="shrink-0 text-[12px] text-[#62748a]">${escapeHtml(meta)}</span>` : ''}</div>`
}

export function pdaDetailRow(label: string, valueHtml: string): string {
  return `<div class="flex items-start justify-between gap-3 border-t border-[#edf0f4] py-2.5 text-sm first:border-t-0"><span class="shrink-0 text-[#62748a]">${escapeHtml(label)}</span><span class="min-w-0 break-words text-right font-semibold text-[#1a293c]">${valueHtml}</span></div>`
}

export function pdaDetails(summary: string, bodyHtml: string, open = false): string {
  return `<details class="rounded-xl border border-[#dfe6ee] bg-white px-3" ${open ? 'open' : ''}><summary class="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-[15px] font-semibold leading-6 text-[#1a293c]">${escapeHtml(summary)}<span class="text-[#62748a]" aria-hidden="true">⌄</span></summary><div class="border-t border-[#edf0f4] py-3">${bodyHtml}</div></details>`
}

export function pdaEmpty(text: string): string {
  return `<div class="rounded-xl border border-dashed border-[#ccd8e7] bg-white px-4 py-8 text-center text-sm text-[#62748a]">${escapeHtml(text)}</div>`
}

export function pdaNotice(text: string, tone: 'info' | 'ready' | 'warn' | 'danger' = 'info'): string {
  const styles = {
    info: 'border-[#d3e2fc] bg-[#edf3ff] text-[#365b94]',
    ready: 'border-[#c8e4d4] bg-[#edf8f2] text-[#167647]',
    warn: 'border-[#ebd4a2] bg-[#fff8e9] text-[#9a5908]',
    danger: 'border-[#e9bdc0] bg-[#fff0f0] text-[#ba2b32]',
  } as const
  return `<div role="${tone === 'danger' ? 'alert' : 'status'}" class="rounded-xl border p-3 text-sm leading-6 ${styles[tone]}">${escapeHtml(text)}</div>`
}

export function pdaStickyFooter(html: string): string {
  return `<div class="sticky bottom-0 z-20 -mx-3 -mb-3 mt-3 border-t border-[#dfe6ee] bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">${html}</div>`
}

export function pdaBackButton(action = 'back', skipRerender = false): string {
  return `<button type="button" class="inline-flex min-h-12 items-center gap-1 rounded-xl px-2 text-sm font-medium text-[#62748a]" data-pda-execd-action="${escapeHtml(action)}"${skipRerender ? ' data-skip-page-rerender="true"' : ''}><i data-lucide="chevron-left" class="h-5 w-5"></i>返回</button>`
}
