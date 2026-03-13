import { escapeHtml } from '../utils'

export function renderPlaceholderPage(title: string, description: string, category: string): string {
  return `
    <div class="space-y-6 p-6">
      <div>
        <p class="mb-1 text-sm text-muted-foreground">${escapeHtml(category)}</p>
        <h1 class="text-2xl font-bold">${escapeHtml(title)}</h1>
      </div>
      <article class="rounded-lg border bg-card">
        <header class="border-b p-5">
          <h2 class="text-lg font-semibold">${escapeHtml(title)}</h2>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(description)}</p>
        </header>
        <div class="p-5">
          <div class="flex h-72 items-center justify-center rounded-lg border-2 border-dashed border-muted bg-muted/30">
            <p class="text-muted-foreground">页面内容开发中...</p>
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
