import { appStore } from '../state/store'
import { escapeHtml } from '../utils'

function renderRouteRedirectPlaceholder(title: string): string {
  return `
    <div class="space-y-4 p-6">
      <header>
        <h1 class="text-2xl font-bold">${escapeHtml(title)}</h1>
      </header>
      <article class="rounded-lg border bg-card">
        <div class="p-5">
          <div class="flex h-72 items-center justify-center rounded-lg border-2 border-dashed border-muted bg-muted/30">
            <p class="text-muted-foreground">正在跳转到新的页面结构…</p>
          </div>
        </div>
      </article>
    </div>
  `
}

export function renderRouteRedirect(targetPath: string, title: string): string {
  // Route rendering can finish before the queued store update runs during a
  // direct browser load. Reconcile the address bar immediately, then let the
  // store perform the normal state/tab update without adding another entry.
  if (typeof window !== 'undefined') {
    const currentPath = `${window.location.pathname}${window.location.search}`
    if (currentPath !== targetPath) window.history.replaceState({}, '', targetPath)
  }
  // Always pass through navigate: during initial deep-link rendering the store
  // can already contain the canonical route while the browser still shows a
  // legacy URL. AppStore.navigate also reconciles that same-state URL case.
  queueMicrotask(() => {
    appStore.navigate(targetPath, { historyMode: 'replace' })
  })
  return renderRouteRedirectPlaceholder(title)
}

export function normalizePathname(pathname: string): string {
  return pathname.split('#')[0].split('?')[0] || '/'
}
