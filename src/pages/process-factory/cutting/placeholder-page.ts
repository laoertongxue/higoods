import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import { type CuttingCanonicalPageKey, getCanonicalCuttingMeta, renderCuttingPageHeader } from './meta'

interface CuttingPlaceholderLink {
  label: string
  href: string
}

interface CuttingPlaceholderConfig {
  pageKey: CuttingCanonicalPageKey
  phaseOwner: string
  currentLimit: string
  futureScopes: string[]
  quickLinks: CuttingPlaceholderLink[]
}

export function renderCraftCuttingPlaceholderPage(config: CuttingPlaceholderConfig): string {
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, config.pageKey)
  return `
    <div class="space-y-4 p-4">
      ${renderCuttingPageHeader(meta)}

      <section class="rounded-xl border bg-card p-6 shadow-sm">
        <div class="text-sm text-muted-foreground">页面开发中</div>
        ${
          config.quickLinks.length
            ? `
              <div class="mt-4 flex flex-wrap gap-2">
                ${config.quickLinks
                  .map(
                    (link) => `
                      <button
                        type="button"
                        data-nav="${escapeHtml(link.href)}"
                        class="inline-flex min-h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
                      >
                        ${escapeHtml(link.label)}
                      </button>
                    `,
                  )
                  .join('')}
              </div>
            `
            : ''
        }
      </div>
    </div>
  `
}
