import {
  bankAccounts,
  penaltyRules,
  settlementProfiles,
  settlementSummaries,
} from '../data/fcs/settlement-mock-data'
import { renderConfirmDialog } from '../components/ui/dialog'
import {
  cycleTypeConfig,
  pricingModeConfig,
  ruleModeConfig,
  ruleTypeConfig,
  settlementStatusConfig,
  type CycleType,
  type DefaultPenaltyRule,
  type FactoryBankAccount,
  type FactorySettlementProfile,
  type FactorySettlementSummary,
  type PenaltyRuleFormData,
  type PricingMode,
  type RuleMode,
  type RuleType,
  type SettlementProfileFormData,
  type SettlementStatus,
  type BankAccountFormData,
} from '../data/fcs/settlement-types'
import { escapeHtml } from '../utils'

const PAGE_SIZE = 10
const CURRENCIES = ['CNY', 'USD', 'EUR', 'HKD'] as const

type DetailTab = 'profile' | 'accounts' | 'rules' | 'history'
type ConfirmActionType = 'disableAccount' | 'setDefault' | 'disableRule'

type DialogState =
  | { type: 'none' }
  | { type: 'profile-drawer'; factoryId: string }
  | { type: 'account-drawer'; factoryId: string; accountId?: string }
  | { type: 'rule-drawer'; factoryId: string; ruleId?: string }
  | { type: 'confirm'; factoryId: string; actionType: ConfirmActionType; itemId: string }

interface SettlementState {
  summaries: FactorySettlementSummary[]
  profiles: FactorySettlementProfile[]
  accounts: FactoryBankAccount[]
  rules: DefaultPenaltyRule[]

  searchKeyword: string
  filterCycleType: string
  filterStatus: string
  currentPage: number

  detailFactoryId: string | null
  detailActiveTab: DetailTab

  dialog: DialogState

  accountActionMenuId: string | null
  ruleActionMenuId: string | null

  profileForm: SettlementProfileFormData
  profileErrors: Partial<Record<'cycleType' | 'pricingMode' | 'currency' | 'effectiveFrom', string>>

  accountForm: BankAccountFormData
  accountErrors: Partial<Record<'accountName' | 'bankName' | 'accountMasked' | 'currency', string>>

  ruleForm: PenaltyRuleFormData
  ruleErrors: Partial<Record<'ruleType' | 'ruleMode' | 'ruleValue' | 'effectiveFrom', string>>
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

const state: SettlementState = {
  summaries: [...settlementSummaries],
  profiles: [...settlementProfiles],
  accounts: [...bankAccounts],
  rules: [...penaltyRules],

  searchKeyword: '',
  filterCycleType: 'all',
  filterStatus: 'all',
  currentPage: 1,

  detailFactoryId: null,
  detailActiveTab: 'profile',

  dialog: { type: 'none' },

  accountActionMenuId: null,
  ruleActionMenuId: null,

  profileForm: {
    cycleType: 'MONTHLY',
    settlementDayRule: '',
    pricingMode: 'BY_PIECE',
    currency: 'CNY',
    effectiveFrom: '',
  },
  profileErrors: {},

  accountForm: {
    accountName: '',
    bankName: '',
    accountMasked: '',
    currency: 'CNY',
    isDefault: false,
    status: 'ACTIVE',
  },
  accountErrors: {},

  ruleForm: {
    ruleType: 'QUALITY_DEFECT',
    ruleMode: 'PERCENTAGE',
    ruleValue: 0,
    effectiveFrom: '',
    status: 'ACTIVE',
  },
  ruleErrors: {},
}

function closeDialog(): void {
  state.dialog = { type: 'none' }
  state.profileErrors = {}
  state.accountErrors = {}
  state.ruleErrors = {}
}

function getFactoryProfiles(factoryId: string): FactorySettlementProfile[] {
  return state.profiles.filter((profile) => profile.factoryId === factoryId)
}

function getFactoryAccounts(factoryId: string): FactoryBankAccount[] {
  return state.accounts.filter((account) => account.factoryId === factoryId)
}

function getFactoryRules(factoryId: string): DefaultPenaltyRule[] {
  return state.rules.filter((rule) => rule.factoryId === factoryId)
}

function getFilteredSummaries(): FactorySettlementSummary[] {
  let result = [...state.summaries]

  if (state.searchKeyword.trim()) {
    const keyword = state.searchKeyword.toLowerCase()
    result = result.filter(
      (summary) =>
        summary.factoryName.toLowerCase().includes(keyword) ||
        summary.factoryId.toLowerCase().includes(keyword),
    )
  }

  if (state.filterCycleType !== 'all') {
    result = result.filter((summary) => summary.cycleType === state.filterCycleType)
  }

  if (state.filterStatus !== 'all') {
    result = result.filter((summary) => summary.status === state.filterStatus)
  }

  return result
}

function getPagedSummaries(filteredSummaries: FactorySettlementSummary[]): FactorySettlementSummary[] {
  const start = (state.currentPage - 1) * PAGE_SIZE
  return filteredSummaries.slice(start, start + PAGE_SIZE)
}

function getFactoryName(factoryId: string): string {
  const profile = state.profiles.find((item) => item.factoryId === factoryId && item.isActive)
  if (profile) return profile.factoryName
  return '未知工厂'
}

function resetProfileForm(): void {
  state.profileForm = {
    cycleType: 'MONTHLY',
    settlementDayRule: '',
    pricingMode: 'BY_PIECE',
    currency: 'CNY',
    effectiveFrom: today(),
  }
  state.profileErrors = {}
}

function resetAccountForm(account: FactoryBankAccount | null): void {
  if (account) {
    state.accountForm = {
      accountName: account.accountName,
      bankName: account.bankName,
      accountMasked: account.accountMasked,
      currency: account.currency,
      isDefault: account.isDefault,
      status: account.status,
    }
  } else {
    state.accountForm = {
      accountName: '',
      bankName: '',
      accountMasked: '',
      currency: 'CNY',
      isDefault: false,
      status: 'ACTIVE',
    }
  }

  state.accountErrors = {}
}

function resetRuleForm(rule: DefaultPenaltyRule | null): void {
  if (rule) {
    state.ruleForm = {
      ruleType: rule.ruleType,
      ruleMode: rule.ruleMode,
      ruleValue: rule.ruleValue,
      effectiveFrom: rule.effectiveFrom,
      status: rule.status,
    }
  } else {
    state.ruleForm = {
      ruleType: 'QUALITY_DEFECT',
      ruleMode: 'PERCENTAGE',
      ruleValue: 0,
      effectiveFrom: today(),
      status: 'ACTIVE',
    }
  }

  state.ruleErrors = {}
}

function openProfileDrawer(factoryId: string): void {
  resetProfileForm()
  state.dialog = { type: 'profile-drawer', factoryId }
}

function openAccountDrawer(factoryId: string, accountId?: string): void {
  const account = accountId ? state.accounts.find((item) => item.id === accountId) ?? null : null
  resetAccountForm(account)
  state.dialog = { type: 'account-drawer', factoryId, accountId }
}

function openRuleDrawer(factoryId: string, ruleId?: string): void {
  const rule = ruleId ? state.rules.find((item) => item.id === ruleId) ?? null : null
  resetRuleForm(rule)
  state.dialog = { type: 'rule-drawer', factoryId, ruleId }
}

function renderPagination(total: number): string {
  const totalPages = Math.ceil(total / PAGE_SIZE)
  if (totalPages <= 1) return ''

  return `
    <div class="flex items-center gap-1">
      <button data-settle-action="prev-page" class="rounded-md border px-3 py-1 text-sm ${state.currentPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}">上一页</button>
      ${Array.from({ length: totalPages }, (_, index) => index + 1)
        .map(
          (page) =>
            `<button data-settle-action="goto-page" data-page="${page}" class="rounded-md border px-3 py-1 text-sm ${page === state.currentPage ? 'bg-blue-600 text-white' : 'hover:bg-muted'}">${page}</button>`,
        )
        .join('')}
      <button data-settle-action="next-page" class="rounded-md border px-3 py-1 text-sm ${state.currentPage === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}">下一页</button>
    </div>
  `
}

function renderProfileDrawer(): string {
  if (state.dialog.type !== 'profile-drawer') return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-settle-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[480px]" data-dialog-panel="true">
        <div class="flex h-full flex-col">
          <header class="border-b px-6 py-4">
            <h3 class="text-lg font-semibold">新增结算版本</h3>
            <p class="mt-1 text-sm text-muted-foreground">创建新的结算配置版本，原有生效版本将自动失效</p>
          </header>

          <form data-settle-form="profile" class="flex flex-1 flex-col">
            <div class="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <label class="space-y-1.5">
                <span class="text-sm font-medium">结算周期 *</span>
                <select data-settle-field="profile.cycleType" class="w-full rounded-md border px-3 py-2 text-sm ${state.profileErrors.cycleType ? 'border-red-600' : ''}">
                  ${(Object.keys(cycleTypeConfig) as CycleType[])
                    .map(
                      (cycleType) =>
                        `<option value="${cycleType}" ${state.profileForm.cycleType === cycleType ? 'selected' : ''}>${escapeHtml(
                          cycleTypeConfig[cycleType].label,
                        )}</option>`,
                    )
                    .join('')}
                </select>
                ${
                  state.profileErrors.cycleType
                    ? `<p class="text-xs text-red-600">${escapeHtml(state.profileErrors.cycleType)}</p>`
                    : ''
                }
              </label>

              <label class="space-y-1.5">
                <span class="text-sm font-medium">结算日规则</span>
                <input
                  data-settle-field="profile.settlementDayRule"
                  value="${escapeHtml(state.profileForm.settlementDayRule ?? '')}"
                  placeholder="例如：每月25日、每周五"
                  class="w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>

              <label class="space-y-1.5">
                <span class="text-sm font-medium">计价方式 *</span>
                <select data-settle-field="profile.pricingMode" class="w-full rounded-md border px-3 py-2 text-sm ${state.profileErrors.pricingMode ? 'border-red-600' : ''}">
                  ${(Object.keys(pricingModeConfig) as PricingMode[])
                    .map(
                      (pricingMode) =>
                        `<option value="${pricingMode}" ${state.profileForm.pricingMode === pricingMode ? 'selected' : ''}>${escapeHtml(
                          pricingModeConfig[pricingMode].label,
                        )}</option>`,
                    )
                    .join('')}
                </select>
                ${
                  state.profileErrors.pricingMode
                    ? `<p class="text-xs text-red-600">${escapeHtml(state.profileErrors.pricingMode)}</p>`
                    : ''
                }
              </label>

              <label class="space-y-1.5">
                <span class="text-sm font-medium">默认币种 *</span>
                <select data-settle-field="profile.currency" class="w-full rounded-md border px-3 py-2 text-sm ${state.profileErrors.currency ? 'border-red-600' : ''}">
                  ${CURRENCIES.map(
                    (currency) =>
                      `<option value="${currency}" ${state.profileForm.currency === currency ? 'selected' : ''}>${currency}</option>`,
                  ).join('')}
                </select>
                ${
                  state.profileErrors.currency
                    ? `<p class="text-xs text-red-600">${escapeHtml(state.profileErrors.currency)}</p>`
                    : ''
                }
              </label>

              <label class="space-y-1.5">
                <span class="text-sm font-medium">生效日期 *</span>
                <input
                  type="date"
                  data-settle-field="profile.effectiveFrom"
                  value="${escapeHtml(state.profileForm.effectiveFrom)}"
                  class="w-full rounded-md border px-3 py-2 text-sm ${state.profileErrors.effectiveFrom ? 'border-red-600' : ''}"
                />
                ${
                  state.profileErrors.effectiveFrom
                    ? `<p class="text-xs text-red-600">${escapeHtml(state.profileErrors.effectiveFrom)}</p>`
                    : ''
                }
              </label>
            </div>

            <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
              <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-settle-action="close-dialog">取消</button>
              <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">确认创建</button>
            </footer>
          </form>
        </div>
      </section>
    </div>
  `
}

function renderAccountDrawer(): string {
  if (state.dialog.type !== 'account-drawer') return ''

  const isEditing = Boolean(state.dialog.accountId)

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-settle-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[480px]" data-dialog-panel="true">
        <div class="flex h-full flex-col">
          <header class="border-b px-6 py-4">
            <h3 class="text-lg font-semibold">${isEditing ? '编辑收款账户' : '新增收款账户'}</h3>
            <p class="mt-1 text-sm text-muted-foreground">${isEditing ? '修改收款账户信息' : '添加新的收款账户'}</p>
          </header>

          <form data-settle-form="account" class="flex flex-1 flex-col">
            <div class="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <label class="space-y-1.5">
                <span class="text-sm font-medium">账户名称 *</span>
                <input
                  data-settle-field="account.accountName"
                  value="${escapeHtml(state.accountForm.accountName)}"
                  placeholder="请输入账户名称"
                  class="w-full rounded-md border px-3 py-2 text-sm ${state.accountErrors.accountName ? 'border-red-600' : ''}"
                />
                ${
                  state.accountErrors.accountName
                    ? `<p class="text-xs text-red-600">${escapeHtml(state.accountErrors.accountName)}</p>`
                    : ''
                }
              </label>

              <label class="space-y-1.5">
                <span class="text-sm font-medium">银行名称 *</span>
                <input
                  data-settle-field="account.bankName"
                  value="${escapeHtml(state.accountForm.bankName)}"
                  placeholder="请输入银行名称"
                  class="w-full rounded-md border px-3 py-2 text-sm ${state.accountErrors.bankName ? 'border-red-600' : ''}"
                />
                ${
                  state.accountErrors.bankName
                    ? `<p class="text-xs text-red-600">${escapeHtml(state.accountErrors.bankName)}</p>`
                    : ''
                }
              </label>

              <label class="space-y-1.5">
                <span class="text-sm font-medium">银行账号 *</span>
                <input
                  data-settle-field="account.accountMasked"
                  value="${escapeHtml(state.accountForm.accountMasked)}"
                  placeholder="请输入银行账号"
                  class="w-full rounded-md border px-3 py-2 text-sm ${state.accountErrors.accountMasked ? 'border-red-600' : ''}"
                />
                ${
                  state.accountErrors.accountMasked
                    ? `<p class="text-xs text-red-600">${escapeHtml(state.accountErrors.accountMasked)}</p>`
                    : ''
                }
              </label>

              <label class="space-y-1.5">
                <span class="text-sm font-medium">币种 *</span>
                <select data-settle-field="account.currency" class="w-full rounded-md border px-3 py-2 text-sm ${state.accountErrors.currency ? 'border-red-600' : ''}">
                  ${CURRENCIES.map(
                    (currency) =>
                      `<option value="${currency}" ${state.accountForm.currency === currency ? 'selected' : ''}>${currency}</option>`,
                  ).join('')}
                </select>
                ${
                  state.accountErrors.currency
                    ? `<p class="text-xs text-red-600">${escapeHtml(state.accountErrors.currency)}</p>`
                    : ''
                }
              </label>

              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <p class="text-sm font-medium">设为默认账户</p>
                  <p class="text-xs text-muted-foreground">默认账户将用于结算付款</p>
                </div>
                <label class="relative inline-flex h-6 w-11 items-center">
                  <input
                    type="checkbox"
                    data-settle-field="account.isDefault"
                    class="peer sr-only"
                    ${state.accountForm.isDefault ? 'checked' : ''}
                  />
                  <span class="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-blue-600"></span>
                  <span class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"></span>
                </label>
              </div>

              <label class="space-y-1.5">
                <span class="text-sm font-medium">状态</span>
                <select data-settle-field="account.status" class="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="ACTIVE" ${state.accountForm.status === 'ACTIVE' ? 'selected' : ''}>启用</option>
                  <option value="INACTIVE" ${state.accountForm.status === 'INACTIVE' ? 'selected' : ''}>禁用</option>
                </select>
              </label>
            </div>

            <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
              <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-settle-action="close-dialog">取消</button>
              <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">确认保存</button>
            </footer>
          </form>
        </div>
      </section>
    </div>
  `
}

function renderRuleDrawer(): string {
  if (state.dialog.type !== 'rule-drawer') return ''

  const isEditing = Boolean(state.dialog.ruleId)
  const valueUnit = state.ruleForm.ruleMode === 'PERCENTAGE' ? '(%)' : '(元)'
  const valuePlaceholder = state.ruleForm.ruleMode === 'PERCENTAGE' ? '例如：5' : '例如：100'
  const valueStep = state.ruleForm.ruleMode === 'PERCENTAGE' ? '0.1' : '1'

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-settle-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[480px]" data-dialog-panel="true">
        <div class="flex h-full flex-col">
          <header class="border-b px-6 py-4">
            <h3 class="text-lg font-semibold">${isEditing ? '编辑扣款规则' : '新增扣款规则'}</h3>
            <p class="mt-1 text-sm text-muted-foreground">${isEditing ? '修改默认扣款规则' : '添加新的默认扣款规则'}</p>
          </header>

          <form data-settle-form="rule" class="flex flex-1 flex-col">
            <div class="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <label class="space-y-1.5">
                <span class="text-sm font-medium">规则类型 *</span>
                <select data-settle-field="rule.ruleType" class="w-full rounded-md border px-3 py-2 text-sm ${state.ruleErrors.ruleType ? 'border-red-600' : ''}">
                  ${(Object.keys(ruleTypeConfig) as RuleType[])
                    .map(
                      (ruleType) =>
                        `<option value="${ruleType}" ${state.ruleForm.ruleType === ruleType ? 'selected' : ''}>${escapeHtml(
                          ruleTypeConfig[ruleType].label,
                        )}</option>`,
                    )
                    .join('')}
                </select>
                ${
                  state.ruleErrors.ruleType
                    ? `<p class="text-xs text-red-600">${escapeHtml(state.ruleErrors.ruleType)}</p>`
                    : ''
                }
              </label>

              <label class="space-y-1.5">
                <span class="text-sm font-medium">计算方式 *</span>
                <select data-settle-field="rule.ruleMode" class="w-full rounded-md border px-3 py-2 text-sm ${state.ruleErrors.ruleMode ? 'border-red-600' : ''}">
                  ${(Object.keys(ruleModeConfig) as RuleMode[])
                    .map(
                      (ruleMode) =>
                        `<option value="${ruleMode}" ${state.ruleForm.ruleMode === ruleMode ? 'selected' : ''}>${escapeHtml(
                          ruleModeConfig[ruleMode].label,
                        )}</option>`,
                    )
                    .join('')}
                </select>
                ${
                  state.ruleErrors.ruleMode
                    ? `<p class="text-xs text-red-600">${escapeHtml(state.ruleErrors.ruleMode)}</p>`
                    : ''
                }
              </label>

              <label class="space-y-1.5">
                <span class="text-sm font-medium">数值 * ${valueUnit}</span>
                <input
                  type="number"
                  min="0"
                  step="${valueStep}"
                  data-settle-field="rule.ruleValue"
                  value="${state.ruleForm.ruleValue === 0 ? '' : String(state.ruleForm.ruleValue)}"
                  placeholder="${valuePlaceholder}"
                  class="w-full rounded-md border px-3 py-2 text-sm ${state.ruleErrors.ruleValue ? 'border-red-600' : ''}"
                />
                ${
                  state.ruleErrors.ruleValue
                    ? `<p class="text-xs text-red-600">${escapeHtml(state.ruleErrors.ruleValue)}</p>`
                    : ''
                }
              </label>

              <label class="space-y-1.5">
                <span class="text-sm font-medium">生效日期 *</span>
                <input
                  type="date"
                  data-settle-field="rule.effectiveFrom"
                  value="${escapeHtml(state.ruleForm.effectiveFrom)}"
                  class="w-full rounded-md border px-3 py-2 text-sm ${state.ruleErrors.effectiveFrom ? 'border-red-600' : ''}"
                />
                ${
                  state.ruleErrors.effectiveFrom
                    ? `<p class="text-xs text-red-600">${escapeHtml(state.ruleErrors.effectiveFrom)}</p>`
                    : ''
                }
              </label>

              <label class="space-y-1.5">
                <span class="text-sm font-medium">状态</span>
                <select data-settle-field="rule.status" class="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="ACTIVE" ${state.ruleForm.status === 'ACTIVE' ? 'selected' : ''}>启用</option>
                  <option value="INACTIVE" ${state.ruleForm.status === 'INACTIVE' ? 'selected' : ''}>禁用</option>
                </select>
              </label>
            </div>

            <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
              <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-settle-action="close-dialog">取消</button>
              <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">确认保存</button>
            </footer>
          </form>
        </div>
      </section>
    </div>
  `
}

function renderSettleConfirmDialog(): string {
  if (state.dialog.type !== 'confirm') return ''

  const title = state.dialog.actionType === 'setDefault' ? '设为默认账户' : '确认禁用'
  const description =
    state.dialog.actionType === 'setDefault'
      ? '确定要将此账户设为默认收款账户吗？其他账户将取消默认状态。'
      : '确定要禁用此项吗？禁用后将不再生效。'
  const isDanger = state.dialog.actionType !== 'setDefault'

  return renderConfirmDialog(
    {
      title,
      closeAction: { prefix: 'settle', action: 'close-dialog' },
      confirmAction: { prefix: 'settle', action: 'confirm-action', label: '确认' },
      danger: isDanger,
      width: 'sm',
    },
    `<p class="text-sm text-muted-foreground">${description}</p>`
  )
}

function renderDetailProfileTab(currentProfile: FactorySettlementProfile | undefined): string {
  if (!currentProfile) {
    return `
      <div class="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        暂无有效的结算配置，请点击"新增版本"创建
      </div>
    `
  }

  return `
    <div class="rounded-lg border bg-card p-6">
      <h3 class="mb-4 font-semibold">当前有效版本</h3>
      <div class="grid grid-cols-2 gap-6 md:grid-cols-3">
        <div>
          <p class="text-sm text-muted-foreground">结算周期</p>
          <p class="font-medium">${escapeHtml(cycleTypeConfig[currentProfile.cycleType].label)}</p>
        </div>
        <div>
          <p class="text-sm text-muted-foreground">结算日规则</p>
          <p class="font-medium">${escapeHtml(currentProfile.settlementDayRule || '-')}</p>
        </div>
        <div>
          <p class="text-sm text-muted-foreground">计价方式</p>
          <p class="font-medium">${escapeHtml(pricingModeConfig[currentProfile.pricingMode].label)}</p>
        </div>
        <div>
          <p class="text-sm text-muted-foreground">默认币种</p>
          <p class="font-medium">${escapeHtml(currentProfile.currency)}</p>
        </div>
        <div>
          <p class="text-sm text-muted-foreground">生效日期</p>
          <p class="font-medium">${escapeHtml(currentProfile.effectiveFrom)}</p>
        </div>
        <div>
          <p class="text-sm text-muted-foreground">最近更新</p>
          <p class="font-medium">${escapeHtml(currentProfile.updatedAt)}</p>
        </div>
      </div>
    </div>
  `
}

function renderDetailAccountsTab(factoryId: string, accounts: FactoryBankAccount[]): string {
  return `
    <div class="space-y-4">
      <div class="flex justify-end">
        <button class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-settle-action="open-account-drawer" data-factory-id="${factoryId}">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          新增账户
        </button>
      </div>

      <div class="overflow-x-auto rounded-md border">
        <table class="w-full text-sm">
          <thead class="border-b bg-muted/30">
            <tr>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">账户名称</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">银行</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">账号</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">币种</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">默认账户</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
              <th class="px-3 py-3 text-right text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              accounts.length === 0
                ? '<tr><td colspan="7" class="h-24 px-3 text-center text-muted-foreground">暂无收款账户</td></tr>'
                : accounts
                    .map((account) => {
                      const statusConfig = settlementStatusConfig[account.status]
                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-3 font-medium">${escapeHtml(account.accountName)}</td>
                          <td class="px-3 py-3">${escapeHtml(account.bankName)}</td>
                          <td class="px-3 py-3 font-mono">${escapeHtml(account.accountMasked)}</td>
                          <td class="px-3 py-3">${escapeHtml(account.currency)}</td>
                          <td class="px-3 py-3">
                            ${
                              account.isDefault
                                ? `<span class="inline-flex items-center rounded border px-2 py-0.5 text-xs bg-blue-50 text-blue-700 border-blue-200"><i data-lucide="star" class="mr-1 h-3 w-3"></i>默认</span>`
                                : '<span class="text-muted-foreground">-</span>'
                            }
                          </td>
                          <td class="px-3 py-3">
                            <span class="inline-flex rounded border px-2 py-0.5 text-xs ${statusConfig.color}">${escapeHtml(
                        statusConfig.label,
                      )}</span>
                          </td>
                          <td class="px-3 py-3 text-right">
                            <div class="relative inline-block text-left">
                              <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-settle-action="toggle-account-menu" data-account-id="${account.id}">
                                <i data-lucide="more-horizontal" class="h-4 w-4"></i>
                              </button>
                              ${
                                state.accountActionMenuId === account.id
                                  ? `
                                    <div class="absolute right-0 z-20 mt-1 min-w-[130px] rounded-md border bg-background p-1 shadow-lg">
                                      <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-settle-action="open-account-drawer" data-factory-id="${factoryId}" data-account-id="${account.id}">
                                        <i data-lucide="pencil" class="mr-2 h-4 w-4"></i>编辑
                                      </button>
                                      ${
                                        !account.isDefault && account.status === 'ACTIVE'
                                          ? `
                                            <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-settle-action="open-confirm" data-factory-id="${factoryId}" data-confirm-type="setDefault" data-item-id="${account.id}">
                                              <i data-lucide="star" class="mr-2 h-4 w-4"></i>设为默认
                                            </button>
                                          `
                                          : ''
                                      }
                                      ${
                                        account.status === 'ACTIVE'
                                          ? `
                                            <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50" data-settle-action="open-confirm" data-factory-id="${factoryId}" data-confirm-type="disableAccount" data-item-id="${account.id}">
                                              <i data-lucide="ban" class="mr-2 h-4 w-4"></i>禁用
                                            </button>
                                          `
                                          : ''
                                      }
                                    </div>
                                  `
                                  : ''
                              }
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderDetailRulesTab(factoryId: string, rules: DefaultPenaltyRule[]): string {
  return `
    <div class="space-y-4">
      <div class="flex justify-end">
        <button class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-settle-action="open-rule-drawer" data-factory-id="${factoryId}">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          新增规则
        </button>
      </div>

      <div class="overflow-x-auto rounded-md border">
        <table class="w-full text-sm">
          <thead class="border-b bg-muted/30">
            <tr>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">规则类型</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">计算方式</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">数值</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">生效日期</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">失效日期</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
              <th class="px-3 py-3 text-right text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              rules.length === 0
                ? '<tr><td colspan="7" class="h-24 px-3 text-center text-muted-foreground">暂无扣款规则</td></tr>'
                : rules
                    .map((rule) => {
                      const statusConfig = settlementStatusConfig[rule.status]
                      const valueText =
                        rule.ruleMode === 'PERCENTAGE' ? `${rule.ruleValue}%` : `${rule.ruleValue} 元`

                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-3 font-medium">${escapeHtml(ruleTypeConfig[rule.ruleType].label)}</td>
                          <td class="px-3 py-3">${escapeHtml(ruleModeConfig[rule.ruleMode].label)}</td>
                          <td class="px-3 py-3">${escapeHtml(valueText)}</td>
                          <td class="px-3 py-3">${escapeHtml(rule.effectiveFrom)}</td>
                          <td class="px-3 py-3">${escapeHtml(rule.effectiveTo || '-')}</td>
                          <td class="px-3 py-3">
                            <span class="inline-flex rounded border px-2 py-0.5 text-xs ${statusConfig.color}">${escapeHtml(
                        statusConfig.label,
                      )}</span>
                          </td>
                          <td class="px-3 py-3 text-right">
                            <div class="relative inline-block text-left">
                              <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-settle-action="toggle-rule-menu" data-rule-id="${rule.id}">
                                <i data-lucide="more-horizontal" class="h-4 w-4"></i>
                              </button>
                              ${
                                state.ruleActionMenuId === rule.id
                                  ? `
                                    <div class="absolute right-0 z-20 mt-1 min-w-[120px] rounded-md border bg-background p-1 shadow-lg">
                                      <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-settle-action="open-rule-drawer" data-factory-id="${factoryId}" data-rule-id="${rule.id}">
                                        <i data-lucide="pencil" class="mr-2 h-4 w-4"></i>编辑
                                      </button>
                                      ${
                                        rule.status === 'ACTIVE'
                                          ? `
                                            <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50" data-settle-action="open-confirm" data-factory-id="${factoryId}" data-confirm-type="disableRule" data-item-id="${rule.id}">
                                              <i data-lucide="ban" class="mr-2 h-4 w-4"></i>禁用
                                            </button>
                                          `
                                          : ''
                                      }
                                    </div>
                                  `
                                  : ''
                              }
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderDetailHistoryTab(profiles: FactorySettlementProfile[]): string {
  return `
    <div class="overflow-x-auto rounded-md border">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/30">
          <tr>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">结算周期</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">计价方式</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">币种</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">生效日期</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">失效日期</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">更新时间</th>
          </tr>
        </thead>
        <tbody>
          ${
            profiles.length === 0
              ? '<tr><td colspan="7" class="h-24 px-3 text-center text-muted-foreground">暂无历史版本</td></tr>'
              : profiles
                  .map((profile) => {
                    const status = settlementStatusConfig[profile.isActive ? 'ACTIVE' : 'INACTIVE']
                    return `
                      <tr class="border-b last:border-0">
                        <td class="px-3 py-3 font-medium">${escapeHtml(cycleTypeConfig[profile.cycleType].label)}</td>
                        <td class="px-3 py-3">${escapeHtml(pricingModeConfig[profile.pricingMode].label)}</td>
                        <td class="px-3 py-3">${escapeHtml(profile.currency)}</td>
                        <td class="px-3 py-3">${escapeHtml(profile.effectiveFrom)}</td>
                        <td class="px-3 py-3">${escapeHtml(profile.effectiveTo || '-')}</td>
                        <td class="px-3 py-3"><span class="inline-flex rounded border px-2 py-0.5 text-xs ${status.color}">${profile.isActive ? '生效' : '失效'}</span></td>
                        <td class="px-3 py-3 text-muted-foreground">${escapeHtml(profile.updatedAt)}</td>
                      </tr>
                    `
                  })
                  .join('')
          }
        </tbody>
      </table>
    </div>
  `
}

export function renderSettlementListPage(): string {
  const filteredSummaries = getFilteredSummaries()
  const pagedSummaries = getPagedSummaries(filteredSummaries)

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">结算信息</h1>
          <p class="mt-1 text-sm text-muted-foreground">管理工厂结算配置、收款账户和扣款规则</p>
        </div>
        <button class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-nav="/fcs/factories/settlement/new">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          新增结算配置
        </button>
      </div>

      <div class="rounded-lg border bg-card p-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label class="space-y-2">
            <span class="text-xs text-muted-foreground">工厂名称/编码</span>
            <div class="relative">
              <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
              <input
                data-settle-filter="search"
                value="${escapeHtml(state.searchKeyword)}"
                placeholder="搜索工厂名称或编码"
                class="w-full rounded-md border py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </label>

          <label class="space-y-2">
            <span class="text-xs text-muted-foreground">结算周期</span>
            <select data-settle-filter="cycleType" class="w-full rounded-md border px-3 py-2 text-sm">
              <option value="all" ${state.filterCycleType === 'all' ? 'selected' : ''}>全部周期</option>
              ${(Object.keys(cycleTypeConfig) as CycleType[])
                .map(
                  (cycleType) =>
                    `<option value="${cycleType}" ${state.filterCycleType === cycleType ? 'selected' : ''}>${escapeHtml(
                      cycleTypeConfig[cycleType].label,
                    )}</option>`,
                )
                .join('')}
            </select>
          </label>

          <label class="space-y-2">
            <span class="text-xs text-muted-foreground">状态</span>
            <select data-settle-filter="status" class="w-full rounded-md border px-3 py-2 text-sm">
              <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>全部状态</option>
              ${(Object.keys(settlementStatusConfig) as SettlementStatus[])
                .map(
                  (status) =>
                    `<option value="${status}" ${state.filterStatus === status ? 'selected' : ''}>${escapeHtml(
                      settlementStatusConfig[status].label,
                    )}</option>`,
                )
                .join('')}
            </select>
          </label>

          <div class="space-y-2">
            <span class="invisible text-xs">操作</span>
            <button data-settle-action="reset" class="w-full rounded-md border px-3 py-2 text-sm hover:bg-muted">重置</button>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto rounded-md border">
        <table class="w-full text-sm">
          <thead class="border-b bg-muted/30">
            <tr>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">工厂名称</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">结算周期</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">计价方式</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">默认币种</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">默认收款账户</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">最近更新</th>
              <th class="px-3 py-3 text-right text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              pagedSummaries.length === 0
                ? '<tr><td colspan="8" class="h-24 px-3 text-center text-muted-foreground">暂无数据</td></tr>'
                : pagedSummaries
                    .map((summary) => {
                      const status = settlementStatusConfig[summary.status]
                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-3">
                            <p class="font-medium">${escapeHtml(summary.factoryName)}</p>
                            <p class="text-xs text-muted-foreground">${escapeHtml(summary.factoryId)}</p>
                          </td>
                          <td class="px-3 py-3">${escapeHtml(cycleTypeConfig[summary.cycleType].label)}</td>
                          <td class="px-3 py-3">${escapeHtml(pricingModeConfig[summary.pricingMode].label)}</td>
                          <td class="px-3 py-3">${escapeHtml(summary.currency)}</td>
                          <td class="px-3 py-3">
                            ${
                              summary.hasDefaultAccount
                                ? `<span class="inline-flex items-center rounded border px-2 py-0.5 text-xs bg-green-50 text-green-700 border-green-200"><i data-lucide="check" class="mr-1 h-3 w-3"></i>已配置</span>`
                                : `<span class="inline-flex items-center rounded border px-2 py-0.5 text-xs bg-amber-50 text-amber-700 border-amber-200"><i data-lucide="x" class="mr-1 h-3 w-3"></i>未配置</span>`
                            }
                          </td>
                          <td class="px-3 py-3">
                            <span class="inline-flex rounded border px-2 py-0.5 text-xs ${status.color}">${escapeHtml(
                        status.label,
                      )}</span>
                          </td>
                          <td class="px-3 py-3 text-muted-foreground">${escapeHtml(summary.updatedAt)}</td>
                          <td class="px-3 py-3 text-right">
                            <button class="inline-flex items-center rounded-md px-3 py-1.5 text-sm hover:bg-muted" data-nav="/fcs/factories/settlement/${summary.factoryId}">
                              <i data-lucide="eye" class="mr-1 h-4 w-4"></i>
                              详情
                            </button>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between">
        <p class="text-sm text-muted-foreground">共 ${filteredSummaries.length} 条记录</p>
        ${renderPagination(filteredSummaries.length)}
      </div>
    </div>
  `
}

export function renderSettlementDetailPage(factoryId: string): string {
  if (state.detailFactoryId !== factoryId) {
    state.detailFactoryId = factoryId
    state.detailActiveTab = 'profile'
    state.accountActionMenuId = null
    state.ruleActionMenuId = null
    closeDialog()
  }

  const profiles = getFactoryProfiles(factoryId)
  const accounts = getFactoryAccounts(factoryId)
  const rules = getFactoryRules(factoryId)

  const currentProfile = profiles.find((profile) => profile.isActive)
  const factoryName = getFactoryName(factoryId)

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted" data-settle-action="go-back">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>
          </button>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-semibold">${escapeHtml(factoryName)}</h1>
              ${
                currentProfile
                  ? `<span class="inline-flex rounded border px-2 py-0.5 text-xs ${
                      settlementStatusConfig[currentProfile.isActive ? 'ACTIVE' : 'INACTIVE'].color
                    }">${currentProfile.isActive ? '生效中' : '已失效'}</span>`
                  : ''
              }
            </div>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(factoryId)}</p>
          </div>
        </div>
        <button class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-settle-action="open-profile-drawer" data-factory-id="${factoryId}">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          新增版本
        </button>
      </div>

      <div class="inline-flex rounded-md border bg-muted/30 p-1">
        <button class="rounded px-3 py-1.5 text-sm ${state.detailActiveTab === 'profile' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-tab" data-tab="profile">结算配置</button>
        <button class="rounded px-3 py-1.5 text-sm ${state.detailActiveTab === 'accounts' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-tab" data-tab="accounts">收款账户</button>
        <button class="rounded px-3 py-1.5 text-sm ${state.detailActiveTab === 'rules' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-tab" data-tab="rules">默认扣款规则</button>
        <button class="rounded px-3 py-1.5 text-sm ${state.detailActiveTab === 'history' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-tab" data-tab="history">版本历史</button>
      </div>

      ${
        state.detailActiveTab === 'profile'
          ? renderDetailProfileTab(currentProfile)
          : state.detailActiveTab === 'accounts'
            ? renderDetailAccountsTab(factoryId, accounts)
            : state.detailActiveTab === 'rules'
              ? renderDetailRulesTab(factoryId, rules)
              : renderDetailHistoryTab(profiles)
      }

      ${renderProfileDrawer()}
      ${renderAccountDrawer()}
      ${renderRuleDrawer()}
      ${renderSettleConfirmDialog()}
    </div>
  `
}

function updateSettlementField(
  field: string,
  node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): void {
  const value = node.value
  const checked = node instanceof HTMLInputElement ? node.checked : false

  if (field === 'profile.cycleType') {
    state.profileForm.cycleType = value as CycleType
    state.profileErrors.cycleType = undefined
    return
  }

  if (field === 'profile.settlementDayRule') {
    state.profileForm.settlementDayRule = value
    return
  }

  if (field === 'profile.pricingMode') {
    state.profileForm.pricingMode = value as PricingMode
    state.profileErrors.pricingMode = undefined
    return
  }

  if (field === 'profile.currency') {
    state.profileForm.currency = value
    state.profileErrors.currency = undefined
    return
  }

  if (field === 'profile.effectiveFrom') {
    state.profileForm.effectiveFrom = value
    state.profileErrors.effectiveFrom = undefined
    return
  }

  if (field === 'account.accountName') {
    state.accountForm.accountName = value
    state.accountErrors.accountName = undefined
    return
  }

  if (field === 'account.bankName') {
    state.accountForm.bankName = value
    state.accountErrors.bankName = undefined
    return
  }

  if (field === 'account.accountMasked') {
    state.accountForm.accountMasked = value
    state.accountErrors.accountMasked = undefined
    return
  }

  if (field === 'account.currency') {
    state.accountForm.currency = value
    state.accountErrors.currency = undefined
    return
  }

  if (field === 'account.isDefault') {
    state.accountForm.isDefault = checked
    return
  }

  if (field === 'account.status') {
    state.accountForm.status = value as SettlementStatus
    return
  }

  if (field === 'rule.ruleType') {
    state.ruleForm.ruleType = value as RuleType
    state.ruleErrors.ruleType = undefined
    return
  }

  if (field === 'rule.ruleMode') {
    state.ruleForm.ruleMode = value as RuleMode
    state.ruleErrors.ruleMode = undefined
    return
  }

  if (field === 'rule.ruleValue') {
    state.ruleForm.ruleValue = Number(value) || 0
    state.ruleErrors.ruleValue = undefined
    return
  }

  if (field === 'rule.effectiveFrom') {
    state.ruleForm.effectiveFrom = value
    state.ruleErrors.effectiveFrom = undefined
    return
  }

  if (field === 'rule.status') {
    state.ruleForm.status = value as SettlementStatus
  }
}

export function handleSettlementEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-settle-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const filter = filterNode.dataset.settleFilter
    const value = filterNode.value

    if (filter === 'search') state.searchKeyword = value
    if (filter === 'cycleType') state.filterCycleType = value
    if (filter === 'status') state.filterStatus = value

    state.currentPage = 1
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-settle-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.settleField
    if (!field) return true
    updateSettlementField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-settle-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.settleAction
  if (!action) return false

  if (action === 'go-back') {
    window.history.back()
    return true
  }

  if (action === 'reset') {
    state.searchKeyword = ''
    state.filterCycleType = 'all'
    state.filterStatus = 'all'
    state.currentPage = 1
    return true
  }

  const totalPages = Math.max(1, Math.ceil(getFilteredSummaries().length / PAGE_SIZE))

  if (action === 'prev-page') {
    state.currentPage = Math.max(1, state.currentPage - 1)
    return true
  }

  if (action === 'next-page') {
    state.currentPage = Math.min(totalPages, state.currentPage + 1)
    return true
  }

  if (action === 'goto-page') {
    const page = Number(actionNode.dataset.page ?? '1')
    state.currentPage = Math.max(1, Math.min(totalPages, page))
    return true
  }

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as DetailTab | undefined
    if (!tab) return true
    state.detailActiveTab = tab
    state.accountActionMenuId = null
    state.ruleActionMenuId = null
    return true
  }

  if (action === 'toggle-account-menu') {
    const accountId = actionNode.dataset.accountId
    if (!accountId) return true
    state.accountActionMenuId = state.accountActionMenuId === accountId ? null : accountId
    state.ruleActionMenuId = null
    return true
  }

  if (action === 'toggle-rule-menu') {
    const ruleId = actionNode.dataset.ruleId
    if (!ruleId) return true
    state.ruleActionMenuId = state.ruleActionMenuId === ruleId ? null : ruleId
    state.accountActionMenuId = null
    return true
  }

  if (action === 'open-profile-drawer') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true
    openProfileDrawer(factoryId)
    return true
  }

  if (action === 'open-account-drawer') {
    const factoryId = actionNode.dataset.factoryId
    const accountId = actionNode.dataset.accountId
    if (!factoryId) return true
    state.accountActionMenuId = null
    openAccountDrawer(factoryId, accountId)
    return true
  }

  if (action === 'open-rule-drawer') {
    const factoryId = actionNode.dataset.factoryId
    const ruleId = actionNode.dataset.ruleId
    if (!factoryId) return true
    state.ruleActionMenuId = null
    openRuleDrawer(factoryId, ruleId)
    return true
  }

  if (action === 'open-confirm') {
    const factoryId = actionNode.dataset.factoryId
    const actionType = actionNode.dataset.confirmType as ConfirmActionType | undefined
    const itemId = actionNode.dataset.itemId
    if (!factoryId || !actionType || !itemId) return true

    state.accountActionMenuId = null
    state.ruleActionMenuId = null
    state.dialog = {
      type: 'confirm',
      factoryId,
      actionType,
      itemId,
    }
    return true
  }

  if (action === 'confirm-action') {
    if (state.dialog.type !== 'confirm') return true

    const { actionType, factoryId, itemId } = state.dialog

    if (actionType === 'disableAccount') {
      state.accounts = state.accounts.map((account) =>
        account.id === itemId
          ? {
              ...account,
              status: 'INACTIVE',
            }
          : account,
      )
    }

    if (actionType === 'setDefault') {
      state.accounts = state.accounts.map((account) =>
        account.factoryId === factoryId
          ? {
              ...account,
              isDefault: account.id === itemId,
            }
          : account,
      )
    }

    if (actionType === 'disableRule') {
      state.rules = state.rules.map((rule) =>
        rule.id === itemId
          ? {
              ...rule,
              status: 'INACTIVE',
            }
          : rule,
      )
    }

    closeDialog()
    return true
  }

  if (action === 'close-dialog') {
    closeDialog()
    return true
  }

  return false
}

export function handleSettlementSubmit(form: HTMLFormElement): boolean {
  const formType = form.dataset.settleForm
  if (!formType) return false

  if (formType === 'profile') {
    if (state.dialog.type !== 'profile-drawer') return true
    const factoryId = state.dialog.factoryId

    const errors: SettlementState['profileErrors'] = {}
    if (!state.profileForm.cycleType) errors.cycleType = '请选择结算周期'
    if (!state.profileForm.pricingMode) errors.pricingMode = '请选择计价方式'
    if (!state.profileForm.currency) errors.currency = '请选择币种'
    if (!state.profileForm.effectiveFrom) errors.effectiveFrom = '请选择生效日期'

    if (Object.keys(errors).length > 0) {
      state.profileErrors = errors
      return true
    }

    state.profiles = state.profiles.map((profile) =>
      profile.factoryId === factoryId && profile.isActive
        ? {
            ...profile,
            isActive: false,
            effectiveTo: state.profileForm.effectiveFrom,
          }
        : profile,
    )

    const newProfile: FactorySettlementProfile = {
      id: `sp-${Date.now()}`,
      factoryId,
      factoryName: getFactoryName(factoryId),
      cycleType: state.profileForm.cycleType,
      settlementDayRule: state.profileForm.settlementDayRule || undefined,
      pricingMode: state.profileForm.pricingMode,
      currency: state.profileForm.currency,
      isActive: true,
      effectiveFrom: state.profileForm.effectiveFrom,
      updatedAt: today(),
    }

    state.profiles = [...state.profiles, newProfile]
    closeDialog()
    return true
  }

  if (formType === 'account') {
    if (state.dialog.type !== 'account-drawer') return true
    const { factoryId, accountId } = state.dialog

    const errors: SettlementState['accountErrors'] = {}
    if (!state.accountForm.accountName.trim()) errors.accountName = '请输入账户名称'
    if (!state.accountForm.bankName.trim()) errors.bankName = '请输入银行名称'
    if (!state.accountForm.accountMasked.trim()) errors.accountMasked = '请输入账号'
    if (!state.accountForm.currency) errors.currency = '请选择币种'

    if (Object.keys(errors).length > 0) {
      state.accountErrors = errors
      return true
    }

    if (accountId) {
      state.accounts = state.accounts.map((account) =>
        account.id === accountId
          ? {
              ...account,
              ...state.accountForm,
            }
          : account,
      )
    } else {
      if (state.accountForm.isDefault) {
        state.accounts = state.accounts.map((account) =>
          account.factoryId === factoryId
            ? {
                ...account,
                isDefault: false,
              }
            : account,
        )
      }

      const newAccount: FactoryBankAccount = {
        id: `ba-${Date.now()}`,
        factoryId,
        ...state.accountForm,
      }

      state.accounts = [...state.accounts, newAccount]
    }

    closeDialog()
    return true
  }

  if (formType === 'rule') {
    if (state.dialog.type !== 'rule-drawer') return true
    const { factoryId, ruleId } = state.dialog

    const errors: SettlementState['ruleErrors'] = {}
    if (!state.ruleForm.ruleType) errors.ruleType = '请选择规则类型'
    if (!state.ruleForm.ruleMode) errors.ruleMode = '请选择计算方式'
    if (state.ruleForm.ruleValue <= 0) errors.ruleValue = '请输入有效数值'
    if (!state.ruleForm.effectiveFrom) errors.effectiveFrom = '请选择生效日期'

    if (Object.keys(errors).length > 0) {
      state.ruleErrors = errors
      return true
    }

    if (ruleId) {
      state.rules = state.rules.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              ...state.ruleForm,
            }
          : rule,
      )
    } else {
      const newRule: DefaultPenaltyRule = {
        id: `pr-${Date.now()}`,
        factoryId,
        ...state.ruleForm,
      }
      state.rules = [...state.rules, newRule]
    }

    closeDialog()
    return true
  }

  return false
}

export function isSettlementDialogOpen(): boolean {
  return state.dialog.type !== 'none'
}
