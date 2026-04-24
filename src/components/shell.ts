import { createIcons, icons as lucideIcons } from 'lucide'
import {
  getCurrentMenus,
  getCurrentSystem,
  getCurrentTabs,
  type AppState,
} from '../state/store'
import { shellIcons } from '../icons/shell-icons'
import type { MenuGroup, MenuItem } from '../data/app-shell-types'
import { systems } from '../data/app-shell-config'
import { escapeHtml, toClassName } from '../utils'

function toKebabCaseIcon(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}

function renderIcon(name: string | undefined, className = 'h-4 w-4'): string {
  if (!name) return ''
  return `<i data-lucide="${toKebabCaseIcon(name)}" class="${className}"></i>`
}

function renderTopBar(state: AppState): string {
  const currentSystem = getCurrentSystem(state.pathname)

  return `
    <header class="sticky top-0 z-40 flex h-14 items-center border-b bg-background px-4">
      <div class="flex items-center gap-2">
        <button class="rounded-md p-2 hover:bg-accent lg:hidden" data-action="set-sidebar-open" data-sidebar-open="true" aria-label="打开菜单">
          ${renderIcon('Menu', 'h-5 w-5')}
        </button>
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">HG</div>
          <span class="hidden text-lg font-semibold sm:inline">HiGood</span>
        </div>
      </div>

      <div class="mx-4 flex-1 overflow-hidden">
        <div class="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
          ${systems
            .map((system) => {
              const active = currentSystem.id === system.id
              return `
                <button
                  class="relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'text-blue-600'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }"
                  data-action="switch-system"
                  data-system-id="${system.id}"
                >
                  <span>${escapeHtml(system.name)}</span>
                  <span class="text-xs text-muted-foreground">(${escapeHtml(system.shortName)})</span>
                  ${active ? '<span class="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-blue-600"></span>' : ''}
                </button>
              `
            })
            .join('')}
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button class="relative rounded-md p-2 hover:bg-accent" aria-label="通知">
          ${renderIcon('Bell', 'h-5 w-5')}
          <span class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"></span>
        </button>

        <button class="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">${renderIcon('User', 'h-4 w-4')}</span>
          <span class="hidden text-sm md:inline">管理员</span>
          ${renderIcon('ChevronDown', 'h-4 w-4 text-muted-foreground')}
        </button>
      </div>
    </header>
  `
}

function renderMenuItem(item: MenuItem, state: AppState, collapsed: boolean): string {
  const hasChildren = (item.children?.length ?? 0) > 0
  const isActive = item.href === state.pathname
  const childActive = item.children?.some((child) => child.href === state.pathname) ?? false
  const expanded = childActive || (state.expandedItems[item.key] ?? false)

  const baseButtonClass = toClassName(
    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    'hover:bg-accent hover:text-accent-foreground',
    (isActive || childActive) && 'bg-blue-50 text-blue-600',
    collapsed && 'justify-center px-2',
  )

  return `
    <div>
      <button
        class="${baseButtonClass}"
        title="${collapsed ? escapeHtml(item.title) : ''}"
        data-action="${hasChildren ? 'toggle-menu-item' : 'open-tab'}"
        data-item-key="${item.key}"
        data-tab-key="${item.key}"
        data-tab-title="${escapeHtml(item.title)}"
        data-tab-href="${item.href ?? ''}"
      >
        <span class="flex h-4 w-4 shrink-0 items-center justify-center" data-menu-item-icon="${escapeHtml(item.title)}">${renderIcon(item.icon)}</span>
        ${
          collapsed
            ? ''
            : `
              <span class="flex-1 text-left">${escapeHtml(item.title)}</span>
              ${hasChildren ? renderIcon(expanded ? 'ChevronDown' : 'ChevronRight', 'h-4 w-4') : ''}
            `
        }
      </button>

      ${
        hasChildren && expanded && !collapsed
          ? `
            <div class="ml-4 mt-1 space-y-1 border-l pl-3">
              ${item.children!
                .map((child) => {
                  const childClass = toClassName(
                    'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    child.href === state.pathname && 'bg-blue-50 text-blue-600',
                  )

                  return `
                    <button
                      class="${childClass}"
                      data-action="open-tab"
                      data-tab-key="${child.key}"
                      data-tab-title="${escapeHtml(child.title)}"
                      data-tab-href="${child.href ?? ''}"
                    >
                      <span class="flex h-4 w-4 shrink-0 items-center justify-center" data-menu-item-icon="${escapeHtml(child.title)}">${renderIcon(child.icon)}</span>
                      ${escapeHtml(child.title)}
                    </button>
                  `
                })
                .join('')}
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderMenuGroup(group: MenuGroup, index: number, state: AppState, collapsed: boolean): string {
  const groupKey = `${index}-${group.title}`
  const expanded = state.expandedGroups[groupKey] ?? true
  const hasActive = group.items.some((item) => item.href === state.pathname || item.children?.some((child) => child.href === state.pathname))
  const groupIcon = group.icon

  if (collapsed) {
    return `
      <div>
        ${index > 0 ? '<div class="my-2 border-t"></div>' : ''}
        <div class="space-y-1">
          ${group.items.map((item) => renderMenuItem(item, state, collapsed)).join('')}
        </div>
      </div>
    `
  }

  return `
    <div>
      <button
        class="${toClassName(
          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
          'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          hasActive && 'text-primary',
        )}"
        data-action="toggle-menu-group"
        data-group-key="${groupKey}"
        data-menu-group-header="${escapeHtml(group.title)}"
      >
        <span class="flex h-5 w-5 items-center justify-center text-muted-foreground" data-menu-group-icon="${escapeHtml(group.title)}">${renderIcon(groupIcon, 'h-4 w-4')}</span>
        <span class="flex-1 text-left">${escapeHtml(group.title)}</span>
        ${renderIcon(expanded ? 'ChevronDown' : 'ChevronRight', 'h-4 w-4')}
      </button>
      ${expanded ? `<div class="mt-1 space-y-1">${group.items.map((item) => renderMenuItem(item, state, collapsed)).join('')}</div>` : ''}
    </div>
  `
}

function renderSidebarContent(state: AppState, collapsed: boolean, showCollapseButton: boolean): string {
  const currentSystem = getCurrentSystem(state.pathname)
  const currentMenus = getCurrentMenus(state.pathname)

  return `
    <div class="flex h-full min-h-0 flex-col">
      <div class="${toClassName(
        'flex h-14 shrink-0 items-center border-b',
        collapsed ? 'justify-center px-2' : 'justify-between px-4',
      )}">
        ${
          collapsed
            ? ''
            : `
              <div class="min-w-0 flex-1">
                <h2 class="truncate text-sm font-semibold">${escapeHtml(currentSystem.name)}</h2>
                <p class="text-xs text-muted-foreground">${escapeHtml(currentSystem.shortName)}</p>
              </div>
            `
        }
        ${
          showCollapseButton
            ? `
              <button
                class="h-8 w-8 shrink-0 rounded-md hover:bg-accent"
                title="${collapsed ? '展开菜单' : '收起菜单'}"
                data-action="toggle-sidebar-collapsed"
              >
                ${renderIcon(collapsed ? 'PanelLeft' : 'PanelLeftClose', 'mx-auto h-4 w-4')}
              </button>
            `
            : ''
        }
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto">
        <div class="${collapsed ? 'space-y-3 px-2 py-3' : 'space-y-3 px-3 py-3'}">
          ${currentMenus.map((group, index) => renderMenuGroup(group, index, state, collapsed)).join('')}
        </div>
      </div>
    </div>
  `
}

function renderSidebar(state: AppState): string {
  const desktop = `
    <aside class="${toClassName(
      'hidden min-h-0 flex-col border-r bg-background transition-all duration-300 lg:flex',
      state.sidebarCollapsed ? 'w-16' : 'w-60',
    )}">
      ${renderSidebarContent(state, state.sidebarCollapsed, true)}
    </aside>
  `

  const mobile = state.sidebarOpen
    ? `
      <div class="fixed inset-0 z-50 lg:hidden">
        <button class="absolute inset-0 bg-black/40" data-action="set-sidebar-open" data-sidebar-open="false" aria-label="关闭菜单"></button>
        <aside class="absolute inset-y-0 left-0 w-72 border-r bg-background shadow-xl">
          ${renderSidebarContent(state, false, false)}
        </aside>
      </div>
    `
    : ''

  return desktop + mobile
}

function renderTabsBar(state: AppState): string {
  const { tabs, activeKey } = getCurrentTabs(state.pathname, state.allTabs)

  if (tabs.length === 0) {
    return ''
  }

  return `
    <div class="border-b bg-muted/30">
      <div class="flex items-center">
        <div class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
          ${tabs
            .map((tab) => {
              const active = activeKey === tab.key

              return `
                <div
                  class="group relative inline-flex items-center gap-2 border-r px-4 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-background text-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-accent'
                  }"
                  data-active="${active ? 'true' : 'false'}"
                >
                  <button class="max-w-32 truncate" data-action="activate-tab" data-tab-key="${tab.key}">${escapeHtml(tab.title)}</button>
                  ${
                    tab.closable
                      ? `<button class="rounded-sm p-0.5 hover:bg-muted-foreground/20" data-action="close-tab" data-tab-key="${tab.key}" data-tab-close>${renderIcon('X', 'h-3 w-3')}</button>`
                      : ''
                  }
                  ${active ? '<span class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>' : ''}
                </div>
              `
            })
            .join('')}
        </div>
        <div class="shrink-0 border-l px-2">
          <button
            class="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            data-action="close-all-tabs"
          >
            全部关闭
          </button>
        </div>
      </div>
    </div>
  `
}

export function renderAppShell(state: AppState, pageContent: string): string {
  return `
    <div class="flex h-screen flex-col overflow-hidden">
      ${renderTopBar(state)}

      <div class="flex min-h-0 flex-1 overflow-hidden">
        ${renderSidebar(state)}

        <main class="flex min-h-0 min-w-0 flex-1 flex-col">
          ${renderTabsBar(state)}
          <div class="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div data-page-content-root="true" class="max-w-full p-4 lg:p-6">
              ${pageContent}
            </div>
          </div>
        </main>
      </div>
    </div>
  `
}

export function hydrateIcons(root: ParentNode = document): void {
  createIcons({
    icons: { ...lucideIcons, ...shellIcons },
    attrs: {
      strokeWidth: '2',
    },
  })

  // createIcons scans document by default; keeping root param for call-site symmetry.
  void root
}
