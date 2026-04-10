import { appStore } from '../state/store'
import { renderPlaceholderPage } from '../pages/placeholder'

export function renderRouteRedirect(targetPath: string, title: string): string {
  const currentPath = appStore.getState().pathname
  if (currentPath !== targetPath) {
    queueMicrotask(() => {
      if (appStore.getState().pathname !== targetPath) {
        appStore.navigate(targetPath, { historyMode: 'replace' })
      }
    })
  }
  return renderPlaceholderPage(title, '正在跳转到新的页面结构…', '页面跳转')
}

export function normalizePathname(pathname: string): string {
  return pathname.split('#')[0].split('?')[0] || '/'
}
