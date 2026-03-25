import { escapeHtml, toClassName } from '../utils'

export type PdaTabKey = 'notify' | 'quality' | 'task-receive' | 'exec' | 'handover' | 'settlement'

interface PdaTabConfig {
  key: PdaTabKey
  label: string
  href: string
  icon: string
}

const PDA_TABS: PdaTabConfig[] = [
  { key: 'notify', label: '待办', href: '/fcs/pda/notify', icon: 'bell' },
  { key: 'quality', label: '质检处理', href: '/fcs/pda/quality', icon: 'clipboard-check' },
  { key: 'task-receive', label: '接单', href: '/fcs/pda/task-receive', icon: 'clipboard-list' },
  { key: 'exec', label: '执行', href: '/fcs/pda/exec', icon: 'play' },
  { key: 'handover', label: '交接', href: '/fcs/pda/handover', icon: 'arrow-left-right' },
  { key: 'settlement', label: '结算', href: '/fcs/pda/settlement', icon: 'wallet' },
]

export function renderPdaBottomNav(activeTab: PdaTabKey): string {
  return `
    <nav class="absolute bottom-0 left-0 right-0 z-10 flex h-[72px] items-center justify-around border-t bg-background px-1">
      ${PDA_TABS.map((tab) => {
        const active = tab.key === activeTab
        return `
          <button
            class="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 transition-colors ${toClassName(
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}"
            data-nav="${tab.href}"
          >
            <i data-lucide="${tab.icon}" class="h-5 w-5 shrink-0"></i>
            <span class="text-center text-[10px] font-medium leading-tight">${escapeHtml(tab.label)}</span>
          </button>
        `
      }).join('')}
    </nav>
  `
}

export function renderPdaFrame(content: string, activeTab: PdaTabKey): string {
  return `
    <section class="relative flex min-h-[760px] flex-col overflow-hidden bg-background">
      <div class="min-h-0 flex-1 overflow-y-auto pb-[72px]">
        ${content}
      </div>
      ${renderPdaBottomNav(activeTab)}
    </section>
  `
}
