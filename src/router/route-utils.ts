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
  const currentPath = appStore.getState().pathname
  if (currentPath !== targetPath) {
    queueMicrotask(() => {
      if (appStore.getState().pathname !== targetPath) {
        appStore.navigate(targetPath, { historyMode: 'replace' })
      }
    })
  }
  return renderRouteRedirectPlaceholder(title)
}

export function normalizePathname(pathname: string): string {
  return pathname.split('#')[0].split('?')[0] || '/'
}
