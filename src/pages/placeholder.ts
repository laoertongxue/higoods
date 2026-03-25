import { escapeHtml } from '../utils'

export function renderPlaceholderPage(title: string, _description: string, _category: string): string {
  return `
    <div class="space-y-4 p-6">
      <header>
        <h1 class="text-2xl font-bold">${escapeHtml(title)}</h1>
      </header>
      <article class="rounded-lg border bg-card">
        <div class="p-5">
          <div class="flex h-72 items-center justify-center rounded-lg border-2 border-dashed border-muted bg-muted/30">
            <p class="text-muted-foreground">页面开发中</p>
          </div>
        </div>
      </article>
    </div>
  `
}

export function renderRouteNotFound(pathname: string): string {
  return `
    <div class="space-y-4 p-6">
      <h1 class="text-xl font-semibold">页面未找到</h1>
      <p class="text-sm text-muted-foreground">未匹配的路由：<span class="font-mono">${escapeHtml(pathname)}</span></p>
    </div>
  `
}
