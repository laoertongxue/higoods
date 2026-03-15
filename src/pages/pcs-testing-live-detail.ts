import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  ACCOUNTING_STATUS_META,
  LIVE_PURPOSE_META,
  SESSION_STATUS_META,
  getLiveSessionById,
  getLiveSessionItems,
  getLiveSessionLogs,
  getLiveSessionSamples,
  type LiveSession,
  type LiveSessionItem,
} from '../data/pcs-testing'

type LiveDetailTab = 'overview' | 'items' | 'reconcile' | 'evidence' | 'accounting' | 'samples' | 'logs'

interface DetailState {
  sessionId: string
  activeTab: LiveDetailTab
  editItemDrawer: { open: boolean; itemId: string | null }
  closeAccountDialogOpen: boolean
  testAccountingDialogOpen: boolean
  closeNote: string
  accountingNote: string
  accountingConfirmed: boolean
  notice: string | null
}

const state: DetailState = {
  sessionId: '',
  activeTab: 'overview',
  editItemDrawer: { open: false, itemId: null },
  closeAccountDialogOpen: false,
  testAccountingDialogOpen: false,
  closeNote: '',
  accountingNote: '',
  accountingConfirmed: false,
  notice: null,
}

const TABS: Array<{ key: LiveDetailTab; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'items', label: '场次明细' },
  { key: 'reconcile', label: '数据核对' },
  { key: 'evidence', label: '证据素材' },
  { key: 'accounting', label: '测款入账' },
  { key: 'samples', label: '样衣关联' },
  { key: 'logs', label: '日志审计' },
]

function getCurrentSession(): LiveSession | null {
  return getLiveSessionById(state.sessionId)
}

function getCurrentItems(): LiveSessionItem[] {
  return getLiveSessionItems(state.sessionId)
}

function getCurrentItem(): LiveSessionItem | null {
  if (!state.editItemDrawer.itemId) return null
  return getCurrentItems().find((item) => item.id === state.editItemDrawer.itemId) ?? null
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-live-detail-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(session: LiveSession): string {
  const showEdit = session.status === 'DRAFT' || session.status === 'RECONCILING'
  const showImport = showEdit
  const showClose = session.status === 'RECONCILING'
  const showAccounting =
    (session.status === 'RECONCILING' || session.status === 'COMPLETED') &&
    session.testAccountingStatus === 'PENDING'

  return `
    <header class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-live-detail-action="go-list">
            <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回列表
          </button>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl font-semibold">${escapeHtml(session.title)}</h1>
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${SESSION_STATUS_META[session.status].color}">${SESSION_STATUS_META[session.status].label}</span>
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${ACCOUNTING_STATUS_META[session.testAccountingStatus].color}">${ACCOUNTING_STATUS_META[session.testAccountingStatus].label}</span>
          </div>
          <p class="text-sm text-muted-foreground">${escapeHtml(session.liveAccount)} · ${escapeHtml(session.anchor)} · ${escapeHtml(session.startAt)} - ${escapeHtml(session.endAt ?? '进行中')}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${showEdit ? '<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-live-detail-action="edit-session"><i data-lucide="edit-3" class="mr-1 h-3.5 w-3.5"></i>编辑</button>' : ''}
          ${showImport ? '<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-live-detail-action="import-data"><i data-lucide="upload" class="mr-1 h-3.5 w-3.5"></i>导入数据</button>' : ''}
          ${showClose ? '<button class="inline-flex h-8 items-center rounded-md border border-emerald-300 px-3 text-xs text-emerald-700 hover:bg-emerald-50" data-pcs-live-detail-action="open-close-dialog"><i data-lucide="check-circle-2" class="mr-1 h-3.5 w-3.5"></i>完成关账</button>' : ''}
          ${showAccounting ? '<button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-live-detail-action="open-accounting-dialog"><i data-lucide="calculator" class="mr-1 h-3.5 w-3.5"></i>完成测款入账</button>' : ''}
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-live-detail-action="export-data"><i data-lucide="download" class="mr-1 h-3.5 w-3.5"></i>导出</button>
        </div>
      </div>
      ${
        session.status === 'RECONCILING'
          ? '<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">当前处于核对阶段，请先完成关账，再执行测款入账。</div>'
          : ''
      }
    </header>
  `
}

function renderTabs(): string {
  return `
    <div class="flex flex-wrap gap-2 border-b pb-3">
      ${TABS.map((tab) => {
        const active = state.activeTab === tab.key
        return `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs ${active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-live-detail-action="set-tab" data-tab-key="${tab.key}">${tab.label}</button>`
      }).join('')}
    </div>
  `
}

function renderOverview(session: LiveSession, items: LiveSessionItem[]): string {
  const testItems = items.filter((item) => item.intent === 'TEST')

  return `
    <section class="grid gap-3 xl:grid-cols-3">
      <article class="rounded-lg border bg-card p-3">
        <p class="text-xs text-muted-foreground">场次信息</p>
        <div class="mt-2 space-y-1 text-sm">
          <p>场次编号：${escapeHtml(session.id)}</p>
          <p>负责人：${escapeHtml(session.owner)} / 操作人：${escapeHtml(session.operator)}</p>
          <p>记录人：${escapeHtml(session.recorder)} / 复核人：${escapeHtml(session.reviewer)}</p>
          <p>场地：${escapeHtml(session.site)}</p>
        </div>
      </article>
      <article class="rounded-lg border bg-card p-3">
        <p class="text-xs text-muted-foreground">效果概览</p>
        <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
          <p>曝光：${session.exposureTotal.toLocaleString()}</p>
          <p>点击：${session.clickTotal.toLocaleString()}</p>
          <p>加购：${session.cartTotal.toLocaleString()}</p>
          <p>订单：${session.orderTotal?.toLocaleString() ?? '-'}</p>
          <p>GMV：${session.gmvTotal?.toLocaleString() ?? '-'}</p>
          <p>样衣：${session.sampleCount}</p>
        </div>
      </article>
      <article class="rounded-lg border bg-card p-3">
        <p class="text-xs text-muted-foreground">测款摘要</p>
        <div class="mt-2 space-y-1 text-sm">
          <p>测款条目：${testItems.length}</p>
          <p>待决策条目：${testItems.filter((item) => item.recommendation !== '继续').length}</p>
          <p>测款入账状态：${ACCOUNTING_STATUS_META[session.testAccountingStatus].label}</p>
          <p>备注：${escapeHtml(session.note || '-')}</p>
        </div>
      </article>
    </section>
  `
}

function renderItems(items: LiveSessionItem[]): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1200px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">条目</th>
              <th class="px-3 py-2 font-medium">意图</th>
              <th class="px-3 py-2 font-medium">项目/商品</th>
              <th class="px-3 py-2 font-medium">时段</th>
              <th class="px-3 py-2 text-right font-medium">曝光</th>
              <th class="px-3 py-2 text-right font-medium">点击</th>
              <th class="px-3 py-2 text-right font-medium">支付单</th>
              <th class="px-3 py-2 text-right font-medium">GMV</th>
              <th class="px-3 py-2 font-medium">建议</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              items.length
                ? items
                    .map(
                      (item) => `
                        <tr class="border-b last:border-b-0">
                          <td class="px-3 py-3">${escapeHtml(item.id)}</td>
                          <td class="px-3 py-3">${escapeHtml(item.intent)}</td>
                          <td class="px-3 py-3 text-xs">${escapeHtml(item.projectRef ?? '-')}
                            <p class="mt-1 font-medium text-foreground">${escapeHtml(item.productName)}</p>
                            <p class="text-muted-foreground">${escapeHtml(item.sku)}</p>
                          </td>
                          <td class="px-3 py-3 text-xs">${escapeHtml(item.segmentStart)} - ${escapeHtml(item.segmentEnd)}</td>
                          <td class="px-3 py-3 text-right">${item.exposure.toLocaleString()}</td>
                          <td class="px-3 py-3 text-right">${item.click.toLocaleString()}</td>
                          <td class="px-3 py-3 text-right">${item.pay.toLocaleString()}</td>
                          <td class="px-3 py-3 text-right">${item.gmv.toLocaleString()}</td>
                          <td class="px-3 py-3 text-xs">${escapeHtml(item.recommendation ?? '-')}</td>
                          <td class="px-3 py-3">
                            <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-live-detail-action="open-item" data-item-id="${escapeHtml(item.id)}">编辑明细</button>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')
                : '<tr><td colspan="10" class="px-3 py-10 text-center text-muted-foreground">暂无明细数据</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderReconcile(session: LiveSession): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">数据核对摘要</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-3 text-sm">
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">开播/下播时间</p>
          <p class="mt-1">${escapeHtml(session.startAt)} - ${escapeHtml(session.endAt ?? '进行中')}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">明细条目</p>
          <p class="mt-1">${session.itemCount} 条（测款 ${session.testItemCount} 条）</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">核对结论</p>
          <p class="mt-1">${session.status === 'RECONCILING' ? '核对中，待关账确认' : '核对完成'}</p>
        </article>
      </div>
    </section>
  `
}

function renderEvidence(items: LiveSessionItem[]): string {
  const evidence = items.flatMap((item) => item.evidence.map((asset) => ({ itemId: item.id, asset })))
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">证据素材</h3>
      <div class="mt-3 space-y-2 text-sm">
        ${
          evidence.length
            ? evidence
                .map(
                  (row) => `<article class="rounded-md border bg-background px-3 py-2">${escapeHtml(row.itemId)} ｜ ${escapeHtml(row.asset)}</article>`,
                )
                .join('')
            : '<p class="text-muted-foreground">暂无证据素材</p>'
        }
      </div>
    </section>
  `
}

function renderAccounting(items: LiveSessionItem[], session: LiveSession): string {
  const testItems = items.filter((item) => item.intent === 'TEST')
  return `
    <section class="space-y-3">
      <article class="rounded-lg border bg-card p-4 text-sm">
        <h3 class="text-sm font-semibold">测款入账进度</h3>
        <p class="mt-2 text-muted-foreground">当前状态：${ACCOUNTING_STATUS_META[session.testAccountingStatus].label}，待入账条目 ${testItems.length} 条。</p>
      </article>
      <article class="overflow-hidden rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[900px] text-sm">
            <thead>
              <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                <th class="px-3 py-2 font-medium">条目</th>
                <th class="px-3 py-2 font-medium">项目</th>
                <th class="px-3 py-2 text-right font-medium">GMV</th>
                <th class="px-3 py-2 font-medium">建议</th>
                <th class="px-3 py-2 font-medium">建议原因</th>
              </tr>
            </thead>
            <tbody>
              ${
                testItems.length
                  ? testItems
                      .map(
                        (item) => `
                          <tr class="border-b last:border-b-0">
                            <td class="px-3 py-3">${escapeHtml(item.id)}</td>
                            <td class="px-3 py-3">${escapeHtml(item.projectRef ?? '-')}</td>
                            <td class="px-3 py-3 text-right">${item.gmv.toLocaleString()}</td>
                            <td class="px-3 py-3">${escapeHtml(item.recommendation ?? '-')}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(item.recommendationReason ?? '-')}</td>
                          </tr>
                        `,
                      )
                      .join('')
                  : '<tr><td colspan="5" class="px-3 py-8 text-center text-muted-foreground">暂无测款条目</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `
}

function renderSamples(): string {
  const samples = getLiveSessionSamples(state.sessionId)

  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[860px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">样衣编号</th>
              <th class="px-3 py-2 font-medium">样衣名称</th>
              <th class="px-3 py-2 font-medium">站点</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">位置</th>
              <th class="px-3 py-2 font-medium">持有人</th>
            </tr>
          </thead>
          <tbody>
            ${
              samples.length
                ? samples
                    .map(
                      (sample) => `
                        <tr class="border-b last:border-b-0">
                          <td class="px-3 py-3">${escapeHtml(sample.id)}</td>
                          <td class="px-3 py-3">${escapeHtml(sample.name)}</td>
                          <td class="px-3 py-3">${escapeHtml(sample.site)}</td>
                          <td class="px-3 py-3">${escapeHtml(sample.status)}</td>
                          <td class="px-3 py-3">${escapeHtml(sample.location)}</td>
                          <td class="px-3 py-3">${escapeHtml(sample.holder)}</td>
                        </tr>
                      `,
                    )
                    .join('')
                : '<tr><td colspan="6" class="px-3 py-8 text-center text-muted-foreground">暂无样衣关联</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderLogs(): string {
  const logs = getLiveSessionLogs(state.sessionId)
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">操作日志</h3>
      <div class="mt-3 space-y-2 text-sm">
        ${
          logs.length
            ? logs
                .map(
                  (log) => `
                    <article class="rounded-md border bg-background px-3 py-2">
                      <p class="font-medium">${escapeHtml(log.action)} · ${escapeHtml(log.user)}</p>
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(log.time)} ｜ ${escapeHtml(log.detail)}</p>
                    </article>
                  `,
                )
                .join('')
            : '<p class="text-muted-foreground">暂无日志</p>'
        }
      </div>
    </section>
  `
}

function renderItemDrawer(): string {
  if (!state.editItemDrawer.open) return ''
  const item = getCurrentItem()
  if (!item) return ''

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-pcs-live-detail-action="close-item" aria-label="关闭"></button>
      <section class="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 border-b bg-background px-4 py-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold">编辑明细行</h3>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.id)} ｜ ${escapeHtml(item.productName)}</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-pcs-live-detail-action="close-item" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </header>
        <div class="space-y-3 p-4 text-sm">
          <article class="rounded-md border bg-background p-3">
            <p>商品：${escapeHtml(item.productName)}</p>
            <p class="mt-1 text-muted-foreground">SKU：${escapeHtml(item.sku)}</p>
          </article>
          <article class="rounded-md border bg-background p-3">
            <p>曝光 ${item.exposure.toLocaleString()} ｜ 点击 ${item.click.toLocaleString()} ｜ 支付 ${item.pay.toLocaleString()}</p>
            <p class="mt-1">GMV ${item.gmv.toLocaleString()} ｜ 建议 ${escapeHtml(item.recommendation ?? '-')}</p>
            <p class="mt-1 text-muted-foreground">${escapeHtml(item.recommendationReason ?? '-')}</p>
          </article>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-live-detail-action="save-item">保存明细（演示态）</button>
        </div>
      </section>
    </div>
  `
}

function renderCloseDialog(session: LiveSession): string {
  if (!state.closeAccountDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">完成场次（关账）</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(session.id)} ｜ ${escapeHtml(session.title)}</p>
        </header>
        <div class="p-4">
          <label class="mb-1 block text-xs text-muted-foreground">关账备注</label>
          <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-live-detail-field="close-note">${escapeHtml(state.closeNote)}</textarea>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-live-detail-action="close-close-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-emerald-300 px-3 text-sm text-emerald-700 hover:bg-emerald-50" data-pcs-live-detail-action="confirm-close-dialog">确认关账</button>
        </footer>
      </section>
    </div>
  `
}

function renderAccountingDialog(session: LiveSession): string {
  if (!state.testAccountingDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">完成测款核对（入账）</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(session.id)} ｜ 测款条目 ${session.testItemCount} 条</p>
        </header>
        <div class="space-y-3 p-4">
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">入账说明</label>
            <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-live-detail-field="accounting-note">${escapeHtml(state.accountingNote)}</textarea>
          </div>
          <label class="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" class="h-4 w-4 rounded border" ${state.accountingConfirmed ? 'checked' : ''} data-pcs-live-detail-field="accounting-confirmed" />
            <span>确认测款条目与结论一致</span>
          </label>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-live-detail-action="close-accounting-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-live-detail-action="confirm-accounting-dialog">确认入账</button>
        </footer>
      </section>
    </div>
  `
}

function renderTabContent(session: LiveSession, items: LiveSessionItem[]): string {
  if (state.activeTab === 'overview') return renderOverview(session, items)
  if (state.activeTab === 'items') return renderItems(items)
  if (state.activeTab === 'reconcile') return renderReconcile(session)
  if (state.activeTab === 'evidence') return renderEvidence(items)
  if (state.activeTab === 'accounting') return renderAccounting(items, session)
  if (state.activeTab === 'samples') return renderSamples()
  return renderLogs()
}

function renderNotFound(sessionId: string): string {
  return `
    <div class="space-y-4">
      <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-live-detail-action="go-list">
        <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回场次列表
      </button>
      <section class="rounded-lg border border-dashed bg-card px-4 py-14 text-center text-muted-foreground">
        <i data-lucide="file-x-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
        <p class="mt-2">未找到场次：${escapeHtml(sessionId)}</p>
      </section>
    </div>
  `
}

export function renderPcsLiveSessionDetailPage(sessionId: string): string {
  state.sessionId = sessionId
  const session = getCurrentSession()
  if (!session) return renderNotFound(sessionId)

  const items = getCurrentItems()

  return `
    <div class="space-y-4">
      ${renderHeader(session)}
      ${renderNotice()}
      ${renderTabs()}
      ${renderTabContent(session, items)}
      ${renderItemDrawer()}
      ${renderCloseDialog(session)}
      ${renderAccountingDialog(session)}
    </div>
  `
}

function closeAllDialogs(): void {
  state.editItemDrawer = { open: false, itemId: null }
  state.closeAccountDialogOpen = false
  state.testAccountingDialogOpen = false
}

export function handlePcsLiveSessionDetailEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-live-detail-field]')

  if (fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.pcsLiveDetailField
    if (field === 'close-note') state.closeNote = fieldNode.value
    if (field === 'accounting-note') state.accountingNote = fieldNode.value
    return true
  }

  if (fieldNode instanceof HTMLInputElement) {
    if (fieldNode.dataset.pcsLiveDetailField === 'accounting-confirmed') {
      state.accountingConfirmed = fieldNode.checked
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-live-detail-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsLiveDetailAction
  if (!action) return false

  if (action === 'go-list') {
    appStore.navigate('/pcs/testing/live')
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'set-tab') {
    state.activeTab = (actionNode.dataset.tabKey as LiveDetailTab | undefined) ?? 'overview'
    return true
  }

  if (action === 'edit-session') {
    state.notice = '已打开场次编辑（演示态）。'
    return true
  }

  if (action === 'import-data') {
    state.notice = '已触发导入数据（演示态）。'
    return true
  }

  if (action === 'export-data') {
    state.notice = '已触发导出数据（演示态）。'
    return true
  }

  if (action === 'open-item') {
    const itemId = actionNode.dataset.itemId
    if (!itemId) return false
    state.editItemDrawer = { open: true, itemId }
    return true
  }

  if (action === 'save-item') {
    state.notice = `明细 ${state.editItemDrawer.itemId ?? ''} 已保存（演示态）。`
    state.editItemDrawer = { open: false, itemId: null }
    return true
  }

  if (action === 'close-item') {
    state.editItemDrawer = { open: false, itemId: null }
    return true
  }

  if (action === 'open-close-dialog') {
    state.closeAccountDialogOpen = true
    state.closeNote = ''
    return true
  }

  if (action === 'close-close-dialog') {
    state.closeAccountDialogOpen = false
    state.closeNote = ''
    return true
  }

  if (action === 'confirm-close-dialog') {
    if (!state.closeNote.trim()) {
      state.notice = '请先填写关账备注。'
      return true
    }
    state.closeAccountDialogOpen = false
    state.notice = '场次已完成关账（演示态）。'
    return true
  }

  if (action === 'open-accounting-dialog') {
    state.testAccountingDialogOpen = true
    state.accountingNote = ''
    state.accountingConfirmed = false
    return true
  }

  if (action === 'close-accounting-dialog') {
    state.testAccountingDialogOpen = false
    state.accountingNote = ''
    state.accountingConfirmed = false
    return true
  }

  if (action === 'confirm-accounting-dialog') {
    if (!state.accountingNote.trim()) {
      state.notice = '请先填写入账说明。'
      return true
    }
    if (!state.accountingConfirmed) {
      state.notice = '请确认测款条目与结论一致。'
      return true
    }
    state.testAccountingDialogOpen = false
    state.notice = '测款结果已入账（演示态）。'
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsLiveSessionDetailDialogOpen(): boolean {
  return state.editItemDrawer.open || state.closeAccountDialogOpen || state.testAccountingDialogOpen
}
