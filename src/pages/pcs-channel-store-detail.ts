import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { renderFormDialog } from '../components/ui'
import {
  OWNER_TYPE_META,
  PAYOUT_ACCOUNTS,
  STORE_AUTH_STATUS_META,
  STORE_BINDING_HISTORY,
  STORE_DETAIL_LOGS,
  STORE_DETAIL_SEED,
  STORE_STATUS_META,
  getChannelStoreById,
} from '../data/pcs-channels'

type StoreDetailTab = 'overview' | 'auth' | 'policies' | 'payout' | 'sync' | 'logs'

interface DetailState {
  storeId: string
  activeTab: StoreDetailTab
  editDrawerOpen: boolean
  authDialogOpen: boolean
  authStep: 1 | 2 | 3
  authMethod: 'oauth' | 'token'
  tokenInput: string
  tokenExpireAt: string
  changePayoutDialogOpen: boolean
  newPayoutAccountId: string
  newEffectiveFrom: string
  changeReason: string
  bindingHistoryDialogOpen: boolean
  notice: string | null
}

const state: DetailState = {
  storeId: '',
  activeTab: 'overview',
  editDrawerOpen: false,
  authDialogOpen: false,
  authStep: 1,
  authMethod: 'oauth',
  tokenInput: '',
  tokenExpireAt: '',
  changePayoutDialogOpen: false,
  newPayoutAccountId: '',
  newEffectiveFrom: new Date().toISOString().slice(0, 10),
  changeReason: '',
  bindingHistoryDialogOpen: false,
  notice: null,
}

const TABS: Array<{ key: StoreDetailTab; label: string }> = [
  { key: 'overview', label: '基本信息' },
  { key: 'auth', label: '授权与连接' },
  { key: 'policies', label: '上架策略' },
  { key: 'payout', label: '提现账号绑定' },
  { key: 'sync', label: '同步与数据' },
  { key: 'logs', label: '日志与附件' },
]

function getDetail() {
  const basic = getChannelStoreById(state.storeId)
  if (!basic) return null

  return {
    ...STORE_DETAIL_SEED,
    id: basic.id,
    channel: basic.channel,
    storeName: basic.storeName,
    storeCode: basic.storeCode,
    platformStoreId: basic.platformStoreId ?? '-',
    country: basic.country,
    pricingCurrency: basic.pricingCurrency,
    status: basic.status,
    authStatus: basic.authStatus,
    currentPayoutBinding: basic.payoutAccountName
      ? {
          payoutAccountId: basic.payoutAccountId ?? '-',
          payoutAccountName: basic.payoutAccountName,
          payoutIdentifier: basic.payoutIdentifier ?? '-',
          ownerType: (basic.ownerType ?? 'PERSONAL') as 'PERSONAL' | 'LEGAL',
          ownerName: basic.ownerName ?? '-',
          effectiveFrom: '2025-10-01',
          effectiveTo: null,
        }
      : STORE_DETAIL_SEED.currentPayoutBinding,
    updatedAt: basic.updatedAt,
  }
}

function renderNotFound(storeId: string): string {
  return `
    <div class="space-y-4">
      <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-store-detail-action="go-list">
        <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回店铺列表
      </button>
      <section class="rounded-lg border border-dashed bg-card px-4 py-14 text-center text-muted-foreground">
        <i data-lucide="file-x-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
        <p class="mt-2">未找到店铺：${escapeHtml(storeId)}</p>
      </section>
    </div>
  `
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-channel-store-detail-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(detail: ReturnType<typeof getDetail>): string {
  if (!detail) return ''

  return `
    <header class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-store-detail-action="go-list">
            <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回店铺列表
          </button>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl font-semibold">${escapeHtml(detail.storeName)}</h1>
            <span class="inline-flex rounded-full border px-2 py-0.5 text-xs">${escapeHtml(detail.channel)}</span>
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${STORE_STATUS_META[detail.status].color}">${STORE_STATUS_META[detail.status].label}</span>
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${STORE_AUTH_STATUS_META[detail.authStatus].color}">${STORE_AUTH_STATUS_META[detail.authStatus].label}</span>
          </div>
          <p class="text-sm text-muted-foreground">${escapeHtml(detail.storeCode)} ｜ ${escapeHtml(detail.country)} ｜ ${escapeHtml(detail.pricingCurrency)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-store-detail-action="open-edit"><i data-lucide="edit-3" class="mr-1 h-3.5 w-3.5"></i>编辑店铺</button>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-store-detail-action="open-auth"><i data-lucide="refresh-cw" class="mr-1 h-3.5 w-3.5"></i>重新授权</button>
          <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-channel-store-detail-action="open-change-payout"><i data-lucide="wallet" class="mr-1 h-3.5 w-3.5"></i>变更提现账号</button>
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
        return `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs ${active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-channel-store-detail-action="set-tab" data-tab-key="${tab.key}">${tab.label}</button>`
      }).join('')}
    </div>
  `
}

function renderOverview(detail: NonNullable<ReturnType<typeof getDetail>>): string {
  return `
    <section class="grid gap-3 xl:grid-cols-2">
      <article class="rounded-lg border bg-card p-4 text-sm">
        <h3 class="text-sm font-semibold">店铺基础信息</h3>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <p>渠道：${escapeHtml(detail.channel)}</p>
          <p>店铺名称：${escapeHtml(detail.storeName)}</p>
          <p>内部编码：${escapeHtml(detail.storeCode)}</p>
          <p>平台店铺ID：${escapeHtml(detail.platformStoreId)}</p>
          <p>国家/区域：${escapeHtml(detail.country)}</p>
          <p>时区：${escapeHtml(detail.timezone)}</p>
          <p>报价币种：${escapeHtml(detail.pricingCurrency)}</p>
          <p>结算币种：${escapeHtml(detail.settlementCurrency)}</p>
        </div>
      </article>
      <article class="rounded-lg border bg-card p-4 text-sm">
        <h3 class="text-sm font-semibold">组织与责任</h3>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <p>店铺负责人：${escapeHtml(detail.storeOwner)}</p>
          <p>所属团队：${escapeHtml(detail.team)}</p>
          <p>复核人：${escapeHtml(detail.reviewer)}</p>
          <p>创建时间：${escapeHtml(detail.createdAt)}</p>
          <p>最近更新：${escapeHtml(detail.updatedAt)}</p>
          <p>更新人：${escapeHtml(detail.updatedBy)}</p>
        </div>
      </article>
    </section>
  `
}

function renderAuth(detail: NonNullable<ReturnType<typeof getDetail>>): string {
  return `
    <section class="grid gap-3 xl:grid-cols-2">
      <article class="rounded-lg border bg-card p-4 text-sm">
        <h3 class="text-sm font-semibold">授权状态</h3>
        <div class="mt-3 space-y-2">
          <p>状态：<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${STORE_AUTH_STATUS_META[detail.authStatus].color}">${STORE_AUTH_STATUS_META[detail.authStatus].label}</span></p>
          <p>有效期至：${escapeHtml(detail.tokenExpireAt)}</p>
          <p>最近刷新：${escapeHtml(detail.lastRefreshAt)}</p>
        </div>
      </article>
      <article class="rounded-lg border bg-card p-4 text-sm">
        <h3 class="text-sm font-semibold">连接信息</h3>
        <div class="mt-3 space-y-2">
          <p>平台店铺ID：${escapeHtml(detail.platformStoreId)}</p>
          <p>店铺编码：${escapeHtml(detail.storeCode)}</p>
          <p>若授权异常，请执行“重新授权”并查看同步状态页。</p>
        </div>
      </article>
    </section>
  `
}

function renderPolicies(detail: NonNullable<ReturnType<typeof getDetail>>): string {
  return `
    <section class="rounded-lg border bg-card p-4 text-sm">
      <h3 class="text-sm font-semibold">上架策略</h3>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <p>允许上架：${detail.policies.allowListing ? '是' : '否'}</p>
        <p>库存同步模式：${escapeHtml(detail.policies.inventorySyncMode)}</p>
        <p>安全库存：${detail.policies.safetyStock}</p>
        <p>默认类目：${escapeHtml(detail.policies.defaultCategoryId)}</p>
        <p>备货时效：${detail.policies.handlingTime} 天</p>
      </div>
    </section>
  `
}

function renderPayout(detail: NonNullable<ReturnType<typeof getDetail>>): string {
  return `
    <section class="space-y-3">
      <article class="rounded-lg border bg-card p-4 text-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold">当前绑定</h3>
            <p class="mt-1 text-muted-foreground">${escapeHtml(detail.currentPayoutBinding.payoutAccountName)} ｜ ${escapeHtml(detail.currentPayoutBinding.payoutIdentifier)}</p>
          </div>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-store-detail-action="open-binding-history">查看历史</button>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <p>归属类型：<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${OWNER_TYPE_META[detail.currentPayoutBinding.ownerType].color}">${OWNER_TYPE_META[detail.currentPayoutBinding.ownerType].label}</span></p>
          <p>归属主体：${escapeHtml(detail.currentPayoutBinding.ownerName)}</p>
          <p>生效起始：${escapeHtml(detail.currentPayoutBinding.effectiveFrom)}</p>
          <p>生效结束：${escapeHtml(detail.currentPayoutBinding.effectiveTo ?? '当前生效')}</p>
        </div>
      </article>
    </section>
  `
}

function renderSync(): string {
  return `
    <section class="rounded-lg border bg-card p-4 text-sm">
      <h3 class="text-sm font-semibold">同步与数据</h3>
      <p class="mt-2 text-muted-foreground">可进入“同步状态与错误回执”查看该店铺的商品/订单同步异常。</p>
      <div class="mt-3">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-store-detail-action="go-sync">
          <i data-lucide="external-link" class="mr-1 h-3.5 w-3.5"></i>打开同步状态页
        </button>
      </div>
    </section>
  `
}

function renderLogs(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">操作日志</h3>
      <div class="mt-3 space-y-2 text-sm">
        ${STORE_DETAIL_LOGS.map(
          (log) => `
            <article class="rounded-md border bg-background px-3 py-2">
              <p class="font-medium">${escapeHtml(log.action)} · ${escapeHtml(log.operator)}</p>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(log.time)} ｜ ${escapeHtml(log.detail)}</p>
            </article>
          `,
        ).join('')}
      </div>
    </section>
  `
}

function renderTabContent(detail: NonNullable<ReturnType<typeof getDetail>>): string {
  if (state.activeTab === 'overview') return renderOverview(detail)
  if (state.activeTab === 'auth') return renderAuth(detail)
  if (state.activeTab === 'policies') return renderPolicies(detail)
  if (state.activeTab === 'payout') return renderPayout(detail)
  if (state.activeTab === 'sync') return renderSync()
  return renderLogs()
}

function renderEditDrawer(detail: NonNullable<ReturnType<typeof getDetail>>): string {
  if (!state.editDrawerOpen) return ''

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-pcs-channel-store-detail-action="close-edit" aria-label="关闭"></button>
      <section class="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 border-b bg-background px-4 py-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold">编辑店铺信息</h3>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(detail.storeName)}</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-pcs-channel-store-detail-action="close-edit" aria-label="关闭"><i data-lucide="x" class="h-4 w-4"></i></button>
          </div>
        </header>
        <div class="space-y-3 p-4 text-sm">
          <p>该抽屉用于演示店铺基础资料编辑流程。</p>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-channel-store-detail-action="confirm-edit">保存变更（演示态）</button>
        </div>
      </section>
    </div>
  `
}

function renderAuthDialog(): string {
  if (!state.authDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-xl rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">店铺授权连接</h3>
          <p class="mt-1 text-xs text-muted-foreground">步骤 ${state.authStep} / 3</p>
        </header>
        <div class="space-y-3 p-4 text-sm">
          ${
            state.authStep === 1
              ? `
                <div class="space-y-2">
                  <p>选择授权方式：</p>
                  <div class="grid grid-cols-2 gap-2">
                    <button class="inline-flex h-9 items-center justify-center rounded-md border ${state.authMethod === 'oauth' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-channel-store-detail-action="set-auth-method" data-auth-method="oauth">OAuth授权</button>
                    <button class="inline-flex h-9 items-center justify-center rounded-md border ${state.authMethod === 'token' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-channel-store-detail-action="set-auth-method" data-auth-method="token">手动Token</button>
                  </div>
                </div>
              `
              : ''
          }
          ${
            state.authStep === 2
              ? `
                <div class="space-y-2">
                  <p>填写授权信息：</p>
                  ${
                    state.authMethod === 'token'
                      ? `
                        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="Token" value="${escapeHtml(state.tokenInput)}" data-pcs-channel-store-detail-field="token-input" />
                        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="有效期（YYYY-MM-DD）" value="${escapeHtml(state.tokenExpireAt)}" data-pcs-channel-store-detail-field="token-expire" />
                      `
                      : '<p class="rounded-md border bg-background p-3 text-xs text-muted-foreground">OAuth方式将在新窗口完成授权（演示态）。</p>'
                  }
                </div>
              `
              : ''
          }
          ${
            state.authStep === 3
              ? '<p class="rounded-md border bg-background p-3 text-xs text-muted-foreground">确认完成授权后，系统将刷新连接状态并记录日志。</p>'
              : ''
          }
        </div>
        <footer class="flex items-center justify-between gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-channel-store-detail-action="close-auth">取消</button>
          <div class="flex items-center gap-2">
            <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted ${state.authStep <= 1 ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-channel-store-detail-action="auth-prev" ${state.authStep <= 1 ? 'disabled' : ''}>上一步</button>
            ${
              state.authStep < 3
                ? '<button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-channel-store-detail-action="auth-next">下一步</button>'
                : '<button class="inline-flex h-9 items-center rounded-md border border-emerald-300 px-3 text-sm text-emerald-700 hover:bg-emerald-50" data-pcs-channel-store-detail-action="auth-confirm">完成授权</button>'
            }
          </div>
        </footer>
      </section>
    </div>
  `
}

function renderChangePayoutDialog(): string {
  if (!state.changePayoutDialogOpen) return ''

  const formContent = `
    <div class="space-y-3 text-sm">
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">目标提现账号</label>
        <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-store-detail-field="new-payout-account">
          <option value="">请选择</option>
          ${PAYOUT_ACCOUNTS.map((item) => `<option value="${item.id}" ${state.newPayoutAccountId === item.id ? 'selected' : ''}>${item.name}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">生效日期</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.newEffectiveFrom)}" data-pcs-channel-store-detail-field="new-effective-from" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">变更原因</label>
        <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-channel-store-detail-field="change-reason">${escapeHtml(state.changeReason)}</textarea>
      </div>
    </div>
  `

  return renderFormDialog(
    {
      title: '变更提现账号',
      description: '请选择新的提现账号并填写变更原因。',
      closeAction: { prefix: 'pcs-channel-store-detail', action: 'close-change-payout' },
      submitAction: { prefix: 'pcs-channel-store-detail', action: 'confirm-change-payout', label: '确认变更' },
      width: 'sm',
    },
    formContent
  )
}

function renderBindingHistoryDialog(): string {
  if (!state.bindingHistoryDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-3xl rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">提现绑定历史</h3>
        </header>
        <div class="max-h-[60vh] overflow-auto p-4">
          <table class="w-full min-w-[980px] text-sm">
            <thead>
              <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                <th class="px-3 py-2 font-medium">历史ID</th>
                <th class="px-3 py-2 font-medium">提现账号</th>
                <th class="px-3 py-2 font-medium">归属类型</th>
                <th class="px-3 py-2 font-medium">生效区间</th>
                <th class="px-3 py-2 font-medium">变更原因</th>
                <th class="px-3 py-2 font-medium">操作人</th>
              </tr>
            </thead>
            <tbody>
              ${STORE_BINDING_HISTORY.map(
                (item) => `
                  <tr class="border-b last:border-b-0">
                    <td class="px-3 py-3">${escapeHtml(item.id)}</td>
                    <td class="px-3 py-3 text-xs">${escapeHtml(item.payoutAccountName)}<br/><span class="text-muted-foreground">${escapeHtml(item.payoutAccountId)}</span></td>
                    <td class="px-3 py-3"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${OWNER_TYPE_META[item.ownerType].color}">${OWNER_TYPE_META[item.ownerType].label}</span></td>
                    <td class="px-3 py-3 text-xs">${escapeHtml(item.effectiveFrom)}<br/><span class="text-muted-foreground">至 ${escapeHtml(item.effectiveTo ?? '当前生效')}</span></td>
                    <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(item.changeReason)}</td>
                    <td class="px-3 py-3 text-xs">${escapeHtml(item.changedBy)}<br/><span class="text-muted-foreground">${escapeHtml(item.changedAt)}</span></td>
                  </tr>
                `,
              ).join('')}
            </tbody>
          </table>
        </div>
        <footer class="flex items-center justify-end border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-channel-store-detail-action="close-binding-history">关闭</button>
        </footer>
      </section>
    </div>
  `
}

function closeAllDialogs(): void {
  state.editDrawerOpen = false
  state.authDialogOpen = false
  state.changePayoutDialogOpen = false
  state.bindingHistoryDialogOpen = false
}

export function renderPcsChannelStoreDetailPage(storeId: string): string {
  state.storeId = storeId
  const detail = getDetail()
  if (!detail) return renderNotFound(storeId)

  return `
    <div class="space-y-4">
      ${renderHeader(detail)}
      ${renderNotice()}
      ${renderTabs()}
      ${renderTabContent(detail)}
      ${renderEditDrawer(detail)}
      ${renderAuthDialog()}
      ${renderChangePayoutDialog()}
      ${renderBindingHistoryDialog()}
    </div>
  `
}

export function handlePcsChannelStoreDetailEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-channel-store-detail-field]')

  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsChannelStoreDetailField
    if (field === 'token-input') state.tokenInput = fieldNode.value
    if (field === 'token-expire') state.tokenExpireAt = fieldNode.value
    if (field === 'new-effective-from') state.newEffectiveFrom = fieldNode.value
    return true
  }

  if (fieldNode instanceof HTMLTextAreaElement) {
    if (fieldNode.dataset.pcsChannelStoreDetailField === 'change-reason') {
      state.changeReason = fieldNode.value
      return true
    }
  }

  if (fieldNode instanceof HTMLSelectElement) {
    if (fieldNode.dataset.pcsChannelStoreDetailField === 'new-payout-account') {
      state.newPayoutAccountId = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-channel-store-detail-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsChannelStoreDetailAction
  if (!action) return false

  if (action === 'go-list') {
    appStore.navigate('/pcs/channels/stores')
    return true
  }

  if (action === 'go-sync') {
    appStore.navigate('/pcs/channels/stores/sync')
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'set-tab') {
    state.activeTab = (actionNode.dataset.tabKey as StoreDetailTab | undefined) ?? 'overview'
    return true
  }

  if (action === 'open-edit') {
    state.editDrawerOpen = true
    return true
  }

  if (action === 'close-edit') {
    state.editDrawerOpen = false
    return true
  }

  if (action === 'confirm-edit') {
    state.editDrawerOpen = false
    state.notice = '店铺信息已保存（演示态）。'
    return true
  }

  if (action === 'open-auth') {
    state.authDialogOpen = true
    state.authStep = 1
    state.authMethod = 'oauth'
    state.tokenInput = ''
    state.tokenExpireAt = ''
    return true
  }

  if (action === 'close-auth') {
    state.authDialogOpen = false
    return true
  }

  if (action === 'set-auth-method') {
    const method = actionNode.dataset.authMethod
    if (method === 'oauth' || method === 'token') {
      state.authMethod = method
      return true
    }
    return false
  }

  if (action === 'auth-prev') {
    state.authStep = Math.max(1, state.authStep - 1) as 1 | 2 | 3
    return true
  }

  if (action === 'auth-next') {
    if (state.authStep === 2 && state.authMethod === 'token' && !state.tokenInput.trim()) {
      state.notice = '请先填写Token。'
      return true
    }
    state.authStep = Math.min(3, state.authStep + 1) as 1 | 2 | 3
    return true
  }

  if (action === 'auth-confirm') {
    state.authDialogOpen = false
    state.notice = '店铺授权连接成功（演示态）。'
    return true
  }

  if (action === 'open-change-payout') {
    state.changePayoutDialogOpen = true
    state.newPayoutAccountId = ''
    state.newEffectiveFrom = new Date().toISOString().slice(0, 10)
    state.changeReason = ''
    return true
  }

  if (action === 'close-change-payout') {
    state.changePayoutDialogOpen = false
    return true
  }

  if (action === 'confirm-change-payout') {
    if (!state.newPayoutAccountId || !state.changeReason.trim()) {
      state.notice = '请填写目标提现账号和变更原因。'
      return true
    }
    state.changePayoutDialogOpen = false
    state.notice = '提现账号变更成功（演示态）。'
    return true
  }

  if (action === 'open-binding-history') {
    state.bindingHistoryDialogOpen = true
    return true
  }

  if (action === 'close-binding-history') {
    state.bindingHistoryDialogOpen = false
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsChannelStoreDetailDialogOpen(): boolean {
  return (
    state.editDrawerOpen ||
    state.authDialogOpen ||
    state.changePayoutDialogOpen ||
    state.bindingHistoryDialogOpen
  )
}
