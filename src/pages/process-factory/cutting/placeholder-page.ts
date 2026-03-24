/**
 * 裁片域占位页壳层。
 *
 * 这些页面已经纳入 canonical 菜单和路由，但当前仍处于阶段性占位。
 * 占位页只负责稳定承接 IA、标题、breadcrumb 和后续阶段提示，不代表最终业务页已完成。
 */
import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import { type CuttingCanonicalPageKey, getCanonicalCuttingMeta, isCuttingAliasPath, renderCuttingPageHeader } from './meta'

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
    <div class="min-h-full bg-slate-50">
      <div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6">
        <section class="rounded-2xl border bg-white p-6 shadow-sm">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="flex-1 space-y-3">
              ${renderCuttingPageHeader(meta, {
                showCompatibilityBadge: isCuttingAliasPath(pathname),
                showPlaceholderBadge: true,
              })}
            </div>
            <div class="grid min-w-[260px] gap-3 sm:grid-cols-2 lg:w-[360px] lg:grid-cols-1">
              ${config.quickLinks
                .map(
                  (link) => `
                    <button
                      type="button"
                      data-nav="${escapeHtml(link.href)}"
                      class="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      ${escapeHtml(link.label)}
                    </button>
                  `,
                )
                .join('')}
            </div>
          </div>
        </section>

        <section class="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
          <article class="rounded-2xl border bg-white p-6 shadow-sm">
            <div class="space-y-4">
              <div>
                <h2 class="text-base font-semibold text-slate-900">页面定位</h2>
                <p class="mt-2 text-sm leading-6 text-slate-600">${escapeHtml(meta.shortDescription ?? meta.pageSubtitle)}</p>
              </div>
              <div>
                <h2 class="text-base font-semibold text-slate-900">后续阶段</h2>
                <p class="mt-2 text-sm leading-6 text-slate-600">${escapeHtml(config.phaseOwner)}</p>
              </div>
              <div>
                <h2 class="text-base font-semibold text-slate-900">当前限制</h2>
                <p class="mt-2 text-sm leading-6 text-slate-600">${escapeHtml(config.currentLimit)}</p>
              </div>
            </div>
          </article>

          <article class="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 class="text-base font-semibold text-slate-900">下一阶段实现范围</h2>
            <ul class="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              ${config.futureScopes
                .map(
                  (scope) => `
                    <li class="flex gap-3">
                      <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"></span>
                      <span>${escapeHtml(scope)}</span>
                    </li>
                  `,
                )
                .join('')}
            </ul>
          </article>
        </section>
      </div>
    </div>
  `
}
