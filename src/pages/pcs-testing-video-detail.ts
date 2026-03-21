import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  ACCOUNTING_STATUS_META,
  SESSION_STATUS_META,
  VIDEO_PLATFORM_META,
  VIDEO_PURPOSE_META,
  getVideoEvidence,
  getVideoItems,
  getVideoLogs,
  getVideoRecordById,
  getVideoSamples,
  type VideoItem,
  type VideoRecord,
} from '../data/pcs-testing'

type VideoDetailTab = 'overview' | 'items' | 'reconcile' | 'evidence' | 'accounting' | 'samples' | 'logs'

interface DetailState {
  recordId: string
  activeTab: VideoDetailTab
  itemDrawer: { open: boolean; itemId: string | null }
  closeDialogOpen: boolean
  accountingDialogOpen: boolean
  closeReason: string
  closeNote: string
  accountingNote: string
  accountingConfirmed: boolean
  notice: string | null
}

const state: DetailState = {
  recordId: '',
  activeTab: 'overview',
  itemDrawer: { open: false, itemId: null },
  closeDialogOpen: false,
  accountingDialogOpen: false,
  closeReason: '',
  closeNote: '',
  accountingNote: '',
  accountingConfirmed: false,
  notice: null,
}

const TABS: Array<{ key: VideoDetailTab; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'items', label: '内容条目' },
  { key: 'reconcile', label: '数据核对' },
  { key: 'evidence', label: '证据素材' },
  { key: 'accounting', label: '测款入账' },
  { key: 'samples', label: '样衣关联' },
  { key: 'logs', label: '日志审计' },
]

function getRecord(): VideoRecord | null {
  return getVideoRecordById(state.recordId)
}

function getItems(): VideoItem[] {
  return getVideoItems(state.recordId)
}

function getCurrentItem(): VideoItem | null {
  if (!state.itemDrawer.itemId) return null
  return getItems().find((item) => item.id === state.itemDrawer.itemId) ?? null
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-video-detail-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(record: VideoRecord): string {
  const showEdit = record.status === 'DRAFT' || record.status === 'RECONCILING'
  const showClose = record.status === 'RECONCILING'
  const showAccounting =
    (record.status === 'RECONCILING' || record.status === 'COMPLETED') &&
    record.testAccountingStatus === 'PENDING'

  return `
    <header class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-video-detail-action="go-list">
            <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回列表
          </button>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl font-semibold">${escapeHtml(record.title)}</h1>
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${SESSION_STATUS_META[record.status].color}">${SESSION_STATUS_META[record.status].label}</span>
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${ACCOUNTING_STATUS_META[record.testAccountingStatus].color}">${ACCOUNTING_STATUS_META[record.testAccountingStatus].label}</span>
          </div>
          <p class="text-sm text-muted-foreground">${VIDEO_PLATFORM_META[record.platform].label} · ${escapeHtml(record.account)} · ${escapeHtml(record.publishedAt ?? '待发布')}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${showEdit ? '<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-video-detail-action="edit-record"><i data-lucide="edit-3" class="mr-1 h-3.5 w-3.5"></i>编辑</button>' : ''}
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-video-detail-action="import-data"><i data-lucide="upload" class="mr-1 h-3.5 w-3.5"></i>导入数据</button>
          ${showClose ? '<button class="inline-flex h-8 items-center rounded-md border border-emerald-300 px-3 text-xs text-emerald-700 hover:bg-emerald-50" data-pcs-video-detail-action="open-close-dialog"><i data-lucide="check-circle-2" class="mr-1 h-3.5 w-3.5"></i>完成关账</button>' : ''}
          ${showAccounting ? '<button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-video-detail-action="open-accounting-dialog"><i data-lucide="calculator" class="mr-1 h-3.5 w-3.5"></i>完成测款入账</button>' : ''}
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-video-detail-action="export-data"><i data-lucide="download" class="mr-1 h-3.5 w-3.5"></i>导出</button>
        </div>
      </div>
    </header>
  `
}

function renderTabs(): string {
  return `
    <div class="flex flex-wrap gap-2 border-b pb-3">
      ${TABS.map((tab) => {
        const active = state.activeTab === tab.key
        return `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs ${active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-video-detail-action="set-tab" data-tab-key="${tab.key}">${tab.label}</button>`
      }).join('')}
    </div>
  `
}

function renderOverview(record: VideoRecord, items: VideoItem[]): string {
  const testItems = items.filter((item) => item.evaluationIntent === 'TEST')

  return `
    <section class="grid gap-3 xl:grid-cols-3">
      <article class="rounded-lg border bg-card p-3">
        <p class="text-xs text-muted-foreground">记录信息</p>
        <div class="mt-2 space-y-1 text-sm">
          <p>记录编号：${escapeHtml(record.id)}</p>
          <p>负责人：${escapeHtml(record.owner)} / 记录人：${escapeHtml(record.recorder)}</p>
          <p>平台账号：${escapeHtml(record.account)} / 创作者：${escapeHtml(record.creator)}</p>
          <p>视频链接：${record.videoUrl ? `<a class="text-blue-700 hover:underline" href="${escapeHtml(record.videoUrl)}" target="_blank" rel="noreferrer">查看链接</a>` : '-'}</p>
        </div>
      </article>
      <article class="rounded-lg border bg-card p-3">
        <p class="text-xs text-muted-foreground">效果概览</p>
        <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
          <p>播放：${record.views.toLocaleString()}</p>
          <p>点赞：${record.likes.toLocaleString()}</p>
          <p>条目：${record.itemCount}</p>
          <p>测款条目：${record.testItemCount}</p>
          <p>GMV：${record.gmv.toLocaleString()}</p>
          <p>样衣：${record.sampleCount}</p>
        </div>
      </article>
      <article class="rounded-lg border bg-card p-3">
        <p class="text-xs text-muted-foreground">测款结果</p>
        <div class="mt-2 space-y-1 text-sm">
          <p>测款条目：${testItems.length}</p>
          <p>待改版建议：${testItems.filter((item) => item.recommendation === '改版').length}</p>
          <p>入账状态：${ACCOUNTING_STATUS_META[record.testAccountingStatus].label}</p>
          <p>备注：${escapeHtml(record.note || '-')}</p>
        </div>
      </article>
    </section>
  `
}

function renderItems(items: VideoItem[]): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1180px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">条目</th>
              <th class="px-3 py-2 font-medium">意图</th>
              <th class="px-3 py-2 font-medium">项目/商品</th>
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
                          <td class="px-3 py-3">${escapeHtml(item.evaluationIntent)}</td>
                          <td class="px-3 py-3 text-xs">
                            ${escapeHtml(item.projectRef ?? '-')}
                            <p class="mt-1 font-medium text-foreground">${escapeHtml(item.productName)}</p>
                            <p class="text-muted-foreground">${escapeHtml(item.sku)}</p>
                          </td>
                          <td class="px-3 py-3 text-right">${item.exposure.toLocaleString()}</td>
                          <td class="px-3 py-3 text-right">${item.click.toLocaleString()}</td>
                          <td class="px-3 py-3 text-right">${item.pay.toLocaleString()}</td>
                          <td class="px-3 py-3 text-right">${item.gmv.toLocaleString()}</td>
                          <td class="px-3 py-3 text-xs">${escapeHtml(item.recommendation ?? '-')}</td>
                          <td class="px-3 py-3">
                            <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-video-detail-action="open-item" data-item-id="${escapeHtml(item.id)}">编辑条目</button>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')
                : '<tr><td colspan="9" class="px-3 py-8 text-center text-muted-foreground">暂无条目</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderReconcile(record: VideoRecord): string {
  return `
    <section class="rounded-lg border bg-card p-4 text-sm">
      <h3 class="text-sm font-semibold">数据核对</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-3">
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">发布时间</p>
          <p class="mt-1">${escapeHtml(record.publishedAt ?? '待发布')}</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">核对维度</p>
          <p class="mt-1">播放、互动、成交、测款建议</p>
        </article>
        <article class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">当前结论</p>
          <p class="mt-1">${record.status === 'RECONCILING' ? '核对中' : '核对完成'}</p>
        </article>
      </div>
    </section>
  `
}

function renderEvidence(): string {
  const evidence = getVideoEvidence(state.recordId)

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">证据素材</h3>
      <div class="mt-3 space-y-2 text-sm">
        ${
          evidence.length
            ? evidence
                .map(
                  (asset) => `
                    <article class="rounded-md border bg-background px-3 py-2">
                      <p class="font-medium">${escapeHtml(asset.type)} ｜ ${escapeHtml(asset.name)}</p>
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(asset.createdAt)} ｜ <a class="text-blue-700 hover:underline" href="${escapeHtml(asset.url)}" target="_blank" rel="noreferrer">查看链接</a></p>
                    </article>
                  `,
                )
                .join('')
            : '<p class="text-muted-foreground">暂无证据素材</p>'
        }
      </div>
    </section>
  `
}

function renderAccounting(items: VideoItem[], record: VideoRecord): string {
  const testItems = items.filter((item) => item.evaluationIntent === 'TEST')

  return `
    <section class="space-y-3">
      <article class="rounded-lg border bg-card p-4 text-sm">
        <h3 class="text-sm font-semibold">测款入账进度</h3>
        <p class="mt-2 text-muted-foreground">当前状态：${ACCOUNTING_STATUS_META[record.testAccountingStatus].label}，待处理测款条目 ${testItems.length} 条。</p>
      </article>
      ${renderItems(testItems)}
    </section>
  `
}

function renderSamples(): string {
  const samples = getVideoSamples(state.recordId)
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
  const logs = getVideoLogs(state.recordId)
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
  if (!state.itemDrawer.open) return ''
  const item = getCurrentItem()
  if (!item) return ''

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-pcs-video-detail-action="close-item" aria-label="关闭"></button>
      <section class="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 border-b bg-background px-4 py-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold">编辑条目</h3>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.id)} ｜ ${escapeHtml(item.productName)}</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-pcs-video-detail-action="close-item" aria-label="关闭"><i data-lucide="x" class="h-4 w-4"></i></button>
          </div>
        </header>
        <div class="space-y-3 p-4 text-sm">
          <article class="rounded-md border bg-background p-3">
            <p>曝光 ${item.exposure.toLocaleString()} ｜ 点击 ${item.click.toLocaleString()} ｜ 支付 ${item.pay.toLocaleString()}</p>
            <p class="mt-1">GMV ${item.gmv.toLocaleString()} ｜ 建议 ${escapeHtml(item.recommendation ?? '-')}</p>
            <p class="mt-1 text-muted-foreground">${escapeHtml(item.recommendationReason ?? '-')}</p>
          </article>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-video-detail-action="save-item">保存条目（演示态）</button>
        </div>
      </section>
    </div>
  `
}

function renderCloseDialog(record: VideoRecord): string {
  if (!state.closeDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">完成记录（关账）</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.id)} ｜ ${escapeHtml(record.title)}</p>
        </header>
        <div class="space-y-3 p-4 text-sm">
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">未发布原因（可选）</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.closeReason)}" data-pcs-video-detail-field="close-reason" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">关账备注</label>
            <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-video-detail-field="close-note">${escapeHtml(state.closeNote)}</textarea>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-video-detail-action="close-close-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-emerald-300 px-3 text-sm text-emerald-700 hover:bg-emerald-50" data-pcs-video-detail-action="confirm-close-dialog">确认关账</button>
        </footer>
      </section>
    </div>
  `
}

function renderAccountingDialog(record: VideoRecord): string {
  if (!state.accountingDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">完成测款核对（入账）</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.id)} ｜ 测款条目 ${record.testItemCount} 条</p>
        </header>
        <div class="space-y-3 p-4 text-sm">
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">入账说明</label>
            <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-video-detail-field="accounting-note">${escapeHtml(state.accountingNote)}</textarea>
          </div>
          <label class="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" class="h-4 w-4 rounded border" ${state.accountingConfirmed ? 'checked' : ''} data-pcs-video-detail-field="accounting-confirmed" />
            <span>确认测款条目与结论一致</span>
          </label>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-video-detail-action="close-accounting-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-video-detail-action="confirm-accounting-dialog">确认入账</button>
        </footer>
      </section>
    </div>
  `
}

function renderTabContent(record: VideoRecord, items: VideoItem[]): string {
  if (state.activeTab === 'overview') return renderOverview(record, items)
  if (state.activeTab === 'items') return renderItems(items)
  if (state.activeTab === 'reconcile') return renderReconcile(record)
  if (state.activeTab === 'evidence') return renderEvidence()
  if (state.activeTab === 'accounting') return renderAccounting(items, record)
  if (state.activeTab === 'samples') return renderSamples()
  return renderLogs()
}

function renderNotFound(recordId: string): string {
  return `
    <div class="space-y-4">
      <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-video-detail-action="go-list">
        <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回记录列表
      </button>
      <section class="rounded-lg border border-dashed bg-card px-4 py-14 text-center text-muted-foreground">
        <i data-lucide="file-x-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
        <p class="mt-2">未找到记录：${escapeHtml(recordId)}</p>
      </section>
    </div>
  `
}

export function renderPcsVideoRecordDetailPage(recordId: string): string {
  state.recordId = recordId

  const record = getRecord()
  if (!record) return renderNotFound(recordId)
  const items = getItems()

  return `
    <div class="space-y-4">
      ${renderHeader(record)}
      ${renderNotice()}
      ${renderTabs()}
      ${renderTabContent(record, items)}
      ${renderItemDrawer()}
      ${renderCloseDialog(record)}
      ${renderAccountingDialog(record)}
    </div>
  `
}

function closeAllDialogs(): void {
  state.itemDrawer = { open: false, itemId: null }
  state.closeDialogOpen = false
  state.accountingDialogOpen = false
}

export function handlePcsVideoRecordDetailEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-video-detail-field]')

  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsVideoDetailField
    if (field === 'close-reason') state.closeReason = fieldNode.value
    if (field === 'accounting-confirmed') state.accountingConfirmed = fieldNode.checked
    return true
  }

  if (fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.pcsVideoDetailField
    if (field === 'close-note') state.closeNote = fieldNode.value
    if (field === 'accounting-note') state.accountingNote = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-video-detail-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsVideoDetailAction
  if (!action) return false

  if (action === 'go-list') {
    appStore.navigate('/pcs/testing/video')
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'set-tab') {
    state.activeTab = (actionNode.dataset.tabKey as VideoDetailTab | undefined) ?? 'overview'
    return true
  }

  if (action === 'edit-record') {
    state.notice = '已打开记录编辑（演示态）。'
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
    state.itemDrawer = { open: true, itemId }
    return true
  }

  if (action === 'save-item') {
    state.notice = `条目 ${state.itemDrawer.itemId ?? ''} 已保存（演示态）。`
    state.itemDrawer = { open: false, itemId: null }
    return true
  }

  if (action === 'close-item') {
    state.itemDrawer = { open: false, itemId: null }
    return true
  }

  if (action === 'open-close-dialog') {
    state.closeDialogOpen = true
    state.closeReason = ''
    state.closeNote = ''
    return true
  }

  if (action === 'close-close-dialog') {
    state.closeDialogOpen = false
    state.closeReason = ''
    state.closeNote = ''
    return true
  }

  if (action === 'confirm-close-dialog') {
    if (!state.closeNote.trim()) {
      state.notice = '请先填写关账备注。'
      return true
    }
    state.closeDialogOpen = false
    state.notice = '记录已完成关账（演示态）。'
    return true
  }

  if (action === 'open-accounting-dialog') {
    state.accountingDialogOpen = true
    state.accountingNote = ''
    state.accountingConfirmed = false
    return true
  }

  if (action === 'close-accounting-dialog') {
    state.accountingDialogOpen = false
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
    state.accountingDialogOpen = false
    state.notice = '测款入账完成（演示态）。'
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsVideoRecordDetailDialogOpen(): boolean {
  return state.itemDrawer.open || state.closeDialogOpen || state.accountingDialogOpen
}
