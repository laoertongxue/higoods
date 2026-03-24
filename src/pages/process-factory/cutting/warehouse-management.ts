import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'

interface WarehouseCompatCard {
  title: string
  subtitle: string
  description: string
  href: string
  hint: string
}

const warehouseCompatCards: WarehouseCompatCard[] = [
  {
    title: '裁床仓',
    subtitle: '配置面料库存 / 剩余面料库存',
    description: '查看裁床侧配置面料库存、剩余面料、卷级明细，以及与原始裁片单的占用关系。',
    href: getCanonicalCuttingPath('fabric-warehouse'),
    hint: '面料库存视角',
  },
  {
    title: '裁片仓',
    subtitle: '裁片入仓 / 分区 / 待交接',
    description: '管理裁片完成后的入仓、A/B/C 区分区、查找与待交接状态，并为后续 transfer-bags 预留入口。',
    href: getCanonicalCuttingPath('cut-piece-warehouse'),
    hint: '裁片实体视角',
  },
  {
    title: '样衣仓',
    subtitle: '样衣位置 / 持有人 / 流转',
    description: '管理样衣的在仓、借出、归还、调拨与抽检回流记录，保留位置与持有人留痕。',
    href: getCanonicalCuttingPath('sample-warehouse'),
    hint: '样衣流转视角',
  },
]

function renderCompatCard(card: WarehouseCompatCard): string {
  return `
    <section class="rounded-xl border bg-card p-5 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-lg font-semibold text-foreground">${escapeHtml(card.title)}</div>
          <div class="mt-1 text-sm text-muted-foreground">${escapeHtml(card.subtitle)}</div>
        </div>
        <span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">${escapeHtml(card.hint)}</span>
      </div>
      <p class="mt-4 text-sm leading-6 text-muted-foreground">${escapeHtml(card.description)}</p>
      <div class="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-md border px-3 py-2 text-sm hover:bg-muted"
          data-cutting-warehouse-action="open-page"
          data-href="${escapeHtml(card.href)}"
        >
          打开 ${escapeHtml(card.title)}
        </button>
      </div>
    </section>
  `
}

function renderPage(): string {
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'warehouse-compat')

  return `
    <div class="space-y-4 p-4">
      ${renderCuttingPageHeader(meta, {
        showCompatibilityBadge: isCuttingAliasPath(pathname),
        actionsHtml: `
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-warehouse-action="open-page" data-href="${escapeHtml(getCanonicalCuttingPath('fabric-warehouse'))}">去裁床仓</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-warehouse-action="open-page" data-href="${escapeHtml(getCanonicalCuttingPath('cut-piece-warehouse'))}">去裁片仓</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-warehouse-action="open-page" data-href="${escapeHtml(getCanonicalCuttingPath('sample-warehouse'))}">去样衣仓</button>
          </div>
        `,
      })}

      <section class="rounded-xl border border-dashed bg-amber-50/60 p-4 text-sm text-amber-900">
        <div class="font-medium">旧仓库管理入口已拆分为独立仓务页面</div>
        <p class="mt-2 leading-6 text-amber-800">
          当前页面只承担兼容中枢作用，用于承接旧的 <code>/warehouse</code> 和 <code>/warehouse-management</code> 入口。
          新菜单、新跳转和后续建设均应优先进入“裁床仓 / 裁片仓 / 样衣仓”三个 canonical 页面。
        </p>
      </section>

      <section class="grid gap-4 xl:grid-cols-3">
        ${warehouseCompatCards.map((card) => renderCompatCard(card)).join('')}
      </section>

      <section class="rounded-xl border bg-card p-5">
        <div class="text-sm font-semibold text-foreground">后续入口预留</div>
        <p class="mt-2 text-sm leading-6 text-muted-foreground">
          周转口袋 / 车缝交接将在下一步单独建设。本页仅保留跳转入口，不再把后续仓务能力堆回旧仓库管理页。
        </p>
        <div class="mt-4">
          <button
            type="button"
            class="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            data-cutting-warehouse-action="open-page"
            data-href="${escapeHtml(getCanonicalCuttingPath('transfer-bags'))}"
          >
            去周转口袋 / 车缝交接入口
          </button>
        </div>
      </section>
    </div>
  `
}

export function renderCraftCuttingWarehouseManagementPage(): string {
  return renderPage()
}

export function handleCraftCuttingWarehouseManagementEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-cutting-warehouse-action]')
  const action = actionNode?.dataset.cuttingWarehouseAction
  if (!action) return false

  if (action === 'open-page') {
    const href = actionNode.dataset.href
    if (!href) return false
    appStore.navigate(href)
    return true
  }

  if (action === 'close-overlay') {
    return true
  }

  return false
}

export function isCraftCuttingWarehouseManagementDialogOpen(): boolean {
  return false
}
