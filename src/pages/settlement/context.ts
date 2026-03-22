import {
  bankAccounts,
  penaltyRules,
  settlementProfiles,
  settlementSummaries,
} from '../../data/fcs/settlement-mock-data'
import { renderConfirmDialog } from '../../components/ui/dialog'
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
} from '../../data/fcs/settlement-types'
import {
  approveSettlementRequest,
  createSettlementVersionFromCurrent,
  followupSettlementRequest,
  getSettlementChangeRequests,
  getSettlementEffectiveInfos,
  getSettlementInitDraftByFactory,
  getSettlementInitDrafts,
  getSettlementRequestById,
  getSettlementStatusClass,
  getSettlementStatusLabel,
  getSettlementVersionHistory,
  initializeSettlementInfo,
  markSettlementRequestPrinted,
  rejectSettlementRequest,
  saveSettlementInitDraft,
  setSettlementRequestPaperArchived,
  submitSettlementSignedProof,
  uploadSettlementSignedProof,
  verifySettlementRequest,
  type SettlementChangeRequest,
  type SettlementConfigSnapshot,
  type SettlementChangeRequestStatus,
  type SettlementDefaultDeductionRuleSnapshot,
  type SettlementEffectiveInfo,
  type SettlementEffectiveInfoSnapshot,
  type SettlementInitDraft,
} from '../../data/fcs/settlement-change-requests'
import { escapeHtml } from '../../utils'
import { appStore } from '../../state/store'

export const PAGE_SIZE = 10
export const CURRENCIES = ['CNY', 'USD', 'EUR', 'HKD'] as const

export type DetailTab = 'profile' | 'accounts' | 'rules' | 'history'
export type InitTab = 'config' | 'account' | 'rules'
export type ProfileTab = 'config' | 'rules'
export type ConfirmActionType = 'disableAccount' | 'setDefault' | 'disableRule'
export type SettlementListView = 'effective' | 'requests'

export type DialogState =
  | { type: 'none' }
  | { type: 'profile-drawer'; factoryId: string }
  | { type: 'account-drawer'; factoryId: string; accountId?: string }
  | { type: 'rule-drawer'; factoryId: string; ruleId?: string }
  | { type: 'confirm'; factoryId: string; actionType: ConfirmActionType; itemId: string }
  | { type: 'request-detail'; requestId: string }
  | { type: 'request-print'; requestId: string }
  | { type: 'init-factory-picker' }
  | { type: 'version-view'; factoryId: string; versionId: string }

export interface SettlementState {
  summaries: FactorySettlementSummary[]
  profiles: FactorySettlementProfile[]
  accounts: FactoryBankAccount[]
  rules: DefaultPenaltyRule[]
  effectiveInfos: SettlementEffectiveInfo[]
  changeRequests: SettlementChangeRequest[]
  listView: SettlementListView

  searchKeyword: string
  filterCycleType: string
  filterStatus: string
  currentPage: number
  requestSearchKeyword: string
  requestFilterStatus: 'all' | SettlementChangeRequestStatus
  requestPage: number

  detailFactoryId: string | null
  detailActiveTab: DetailTab

  dialog: DialogState

  accountActionMenuId: string | null
  ruleActionMenuId: string | null

  profileForm: SettlementProfileFormData
  profileErrors: Partial<Record<'cycleType' | 'pricingMode' | 'currency' | 'effectiveFrom', string>>
  profileActiveTab: ProfileTab
  profileRulesDraft: SettlementDefaultDeductionRuleSnapshot[]
  profileRulesError: string

  accountForm: BankAccountFormData
  accountErrors: Partial<Record<'accountName' | 'bankName' | 'accountMasked' | 'currency', string>>

  ruleForm: PenaltyRuleFormData
  ruleErrors: Partial<Record<'ruleType' | 'ruleMode' | 'ruleValue' | 'effectiveFrom', string>>
  requestOperateForm: {
    verifyRemark: string
    followupRemark: string
    rejectReason: string
    paperArchived: boolean
  }
  requestOperateError: string
  initDrafts: SettlementInitDraft[]
  initFactorySearch: string
  initSelectedFactoryId: string | null
  initEditorFactoryId: string | null
  initEditorFactoryName: string
  initActiveTab: InitTab
  initConfigDraft: SettlementConfigSnapshot
  initAccountDraft: SettlementEffectiveInfoSnapshot
  initRulesDraft: SettlementDefaultDeductionRuleSnapshot[]
  initErrorText: string
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}

export const state: SettlementState = {
  summaries: [...settlementSummaries],
  profiles: [...settlementProfiles],
  accounts: [...bankAccounts],
  rules: [...penaltyRules],
  effectiveInfos: getSettlementEffectiveInfos(),
  changeRequests: getSettlementChangeRequests(),
  listView: 'effective',

  searchKeyword: '',
  filterCycleType: 'all',
  filterStatus: 'all',
  currentPage: 1,
  requestSearchKeyword: '',
  requestFilterStatus: 'all',
  requestPage: 1,

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
  profileActiveTab: 'config',
  profileRulesDraft: [
    {
      ruleType: 'QUALITY_DEFECT',
      ruleMode: 'PERCENTAGE',
      ruleValue: 5,
      effectiveFrom: today(),
      status: 'ACTIVE',
    },
  ],
  profileRulesError: '',

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
  requestOperateForm: {
    verifyRemark: '',
    followupRemark: '',
    rejectReason: '',
    paperArchived: false,
  },
  requestOperateError: '',
  initDrafts: getSettlementInitDrafts(),
  initFactorySearch: '',
  initSelectedFactoryId: null,
  initEditorFactoryId: null,
  initEditorFactoryName: '',
  initActiveTab: 'config',
  initConfigDraft: {
    cycleType: 'MONTHLY',
    settlementDayRule: '每月25日',
    pricingMode: 'BY_PIECE',
    currency: 'IDR',
  },
  initAccountDraft: {
    accountHolderName: '',
    idNumber: '',
    bankName: '',
    bankAccountNo: '',
    bankBranch: '',
  },
  initRulesDraft: [
    {
      ruleType: 'QUALITY_DEFECT',
      ruleMode: 'PERCENTAGE',
      ruleValue: 5,
      effectiveFrom: today(),
      status: 'ACTIVE',
    },
  ],
  initErrorText: '',
}

export function closeDialog(): void {
  state.dialog = { type: 'none' }
  state.profileErrors = {}
  state.accountErrors = {}
  state.ruleErrors = {}
  state.requestOperateError = ''
}

export function syncSettlementRequestState(): void {
  state.effectiveInfos = getSettlementEffectiveInfos()
  state.changeRequests = getSettlementChangeRequests()
  state.initDrafts = getSettlementInitDrafts()
}

export function maskBankAccountNo(accountNo: string): string {
  const raw = accountNo.replace(/\s+/g, '')
  if (raw.length <= 8) return raw
  return `${raw.slice(0, 4)} **** **** ${raw.slice(-4)}`
}

export function getChangedFieldsSummary(request: SettlementChangeRequest): string {
  const changed: string[] = []
  if (request.before.accountHolderName !== request.after.accountHolderName) changed.push('开户名')
  if (request.before.idNumber !== request.after.idNumber) changed.push('证件号')
  if (request.before.bankName !== request.after.bankName) changed.push('银行名称')
  if (request.before.bankAccountNo !== request.after.bankAccountNo) changed.push('银行账号')
  if (request.before.bankBranch !== request.after.bankBranch) changed.push('开户支行')
  return changed.length > 0 ? changed.join('、') : '信息确认'
}

export function getFactoryProfiles(factoryId: string): FactorySettlementProfile[] {
  return state.profiles.filter((profile) => profile.factoryId === factoryId)
}

export function getFactoryAccounts(factoryId: string): FactoryBankAccount[] {
  return state.accounts.filter((account) => account.factoryId === factoryId)
}

export function getFactoryRules(factoryId: string): DefaultPenaltyRule[] {
  return state.rules.filter((rule) => rule.factoryId === factoryId)
}

export function getFilteredSummaries(): FactorySettlementSummary[] {
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

export function getPagedSummaries(filteredSummaries: FactorySettlementSummary[]): FactorySettlementSummary[] {
  const start = (state.currentPage - 1) * PAGE_SIZE
  return filteredSummaries.slice(start, start + PAGE_SIZE)
}

export function getFilteredRequests(): SettlementChangeRequest[] {
  let result = [...state.changeRequests]

  if (state.requestSearchKeyword.trim()) {
    const keyword = state.requestSearchKeyword.trim().toLowerCase()
    result = result.filter((item) => {
      const fields = [
        item.requestId,
        item.factoryName,
        item.factoryId,
        item.submittedBy,
        item.after.bankName,
        item.after.bankAccountNo,
      ]
      return fields.some((field) => field.toLowerCase().includes(keyword))
    })
  }

  if (state.requestFilterStatus !== 'all') {
    result = result.filter((item) => item.status === state.requestFilterStatus)
  }

  return result.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export function getPagedRequests(filteredRequests: SettlementChangeRequest[]): SettlementChangeRequest[] {
  const start = (state.requestPage - 1) * PAGE_SIZE
  return filteredRequests.slice(start, start + PAGE_SIZE)
}

export function getFactoryName(factoryId: string): string {
  const profile = state.profiles.find((item) => item.factoryId === factoryId && item.isActive)
  if (profile) return profile.factoryName
  const summary = state.summaries.find((item) => item.factoryId === factoryId)
  if (summary) return summary.factoryName
  return '未知工厂'
}

export function hasInitializedSettlement(factoryId: string): boolean {
  return state.effectiveInfos.some((item) => item.factoryId === factoryId)
}

export function getUninitializedFactories(): FactorySettlementSummary[] {
  return state.summaries.filter((item) => !hasInitializedSettlement(item.factoryId))
}

export function getInitDraftByFactory(factoryId: string): SettlementInitDraft | null {
  return state.initDrafts.find((item) => item.factoryId === factoryId) ?? getSettlementInitDraftByFactory(factoryId)
}

export function normalizeAccountMask(rawAccountNo: string): string {
  const cleaned = rawAccountNo.replace(/\s+/g, '')
  if (!cleaned) return ''
  if (cleaned.length <= 8) return cleaned
  return `${cleaned.slice(0, 4)}****${cleaned.slice(-4)}`
}

export function resetInitEditor(factoryId: string): void {
  const factoryName = getFactoryName(factoryId)
  const existedDraft = getInitDraftByFactory(factoryId)

  state.initEditorFactoryId = factoryId
  state.initEditorFactoryName = factoryName
  state.initActiveTab = 'config'
  state.initErrorText = ''

  if (existedDraft) {
    state.initConfigDraft = {
      cycleType: existedDraft.configDraft.cycleType,
      settlementDayRule: existedDraft.configDraft.settlementDayRule,
      pricingMode: existedDraft.configDraft.pricingMode,
      currency: existedDraft.configDraft.currency,
    }
    state.initAccountDraft = {
      accountHolderName: existedDraft.receivingAccountDraft.accountHolderName,
      idNumber: existedDraft.receivingAccountDraft.idNumber,
      bankName: existedDraft.receivingAccountDraft.bankName,
      bankAccountNo: existedDraft.receivingAccountDraft.bankAccountNo,
      bankBranch: existedDraft.receivingAccountDraft.bankBranch,
    }
    state.initRulesDraft = existedDraft.deductionRulesDraft.map((item) => ({ ...item }))
    return
  }

  state.initConfigDraft = {
    cycleType: 'MONTHLY',
    settlementDayRule: '每月25日',
    pricingMode: 'BY_PIECE',
    currency: 'IDR',
  }
  state.initAccountDraft = {
    accountHolderName: factoryName,
    idNumber: '',
    bankName: '',
    bankAccountNo: '',
    bankBranch: '',
  }
  state.initRulesDraft = [
    {
      ruleType: 'QUALITY_DEFECT',
      ruleMode: 'PERCENTAGE',
      ruleValue: 5,
      effectiveFrom: today(),
      status: 'ACTIVE',
    },
  ]
}

export function saveCurrentInitDraft(operator: string): { ok: boolean; message: string } {
  if (!state.initEditorFactoryId) return { ok: false, message: '当前未选择工厂' }
  const result = saveSettlementInitDraft({
    factoryId: state.initEditorFactoryId,
    factoryName: state.initEditorFactoryName,
    updatedBy: operator,
    configDraft: state.initConfigDraft,
    receivingAccountDraft: state.initAccountDraft,
    deductionRulesDraft: state.initRulesDraft,
  })
  if (!result.ok) return result
  syncSettlementRequestState()
  return { ok: true, message: result.message }
}

export function getVersionRecordById(factoryId: string, versionId: string) {
  return getSettlementVersionHistory(factoryId).find((item) => item.versionId === versionId) ?? null
}

export function resetProfileForm(factoryId?: string): void {
  const effectiveInfo = factoryId
    ? state.effectiveInfos.find((item) => item.factoryId === factoryId) ?? null
    : null

  state.profileForm = effectiveInfo
    ? {
        cycleType: effectiveInfo.settlementConfigSnapshot.cycleType,
        settlementDayRule: effectiveInfo.settlementConfigSnapshot.settlementDayRule || '',
        pricingMode: effectiveInfo.settlementConfigSnapshot.pricingMode,
        currency: effectiveInfo.settlementConfigSnapshot.currency,
        effectiveFrom: today(),
      }
    : {
        cycleType: 'MONTHLY',
        settlementDayRule: '',
        pricingMode: 'BY_PIECE',
        currency: 'CNY',
        effectiveFrom: today(),
      }
  state.profileRulesDraft =
    effectiveInfo && effectiveInfo.defaultDeductionRulesSnapshot.length > 0
      ? effectiveInfo.defaultDeductionRulesSnapshot.map((item) => ({ ...item }))
      : [
          {
            ruleType: 'QUALITY_DEFECT',
            ruleMode: 'PERCENTAGE',
            ruleValue: 5,
            effectiveFrom: today(),
            status: 'ACTIVE',
          },
        ]
  state.profileRulesError = ''
  state.profileErrors = {}
  state.profileActiveTab = 'config'
}

export function resetAccountForm(account: FactoryBankAccount | null): void {
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

export function resetRuleForm(rule: DefaultPenaltyRule | null): void {
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

export function openProfileDrawer(factoryId: string): void {
  resetProfileForm(factoryId)
  state.profileActiveTab = 'config'
  state.dialog = { type: 'profile-drawer', factoryId }
}

export function openAccountDrawer(factoryId: string, accountId?: string): void {
  const account = accountId
    ? state.accounts.find((item) => item.id === accountId) ?? null
    : getFactoryAccounts(factoryId).find((item) => item.isDefault) ?? null
  resetAccountForm(account)
  state.dialog = { type: 'account-drawer', factoryId, accountId }
}

export function openRuleDrawer(factoryId: string, ruleId?: string): void {
  const rule = ruleId
    ? state.rules.find((item) => item.id === ruleId) ?? null
    : getFactoryRules(factoryId).find((item) => item.status === 'ACTIVE') ?? null
  resetRuleForm(rule)
  state.dialog = { type: 'rule-drawer', factoryId, ruleId }
}


export {
  renderConfirmDialog,
  cycleTypeConfig,
  pricingModeConfig,
  ruleModeConfig,
  ruleTypeConfig,
  settlementStatusConfig,
  approveSettlementRequest,
  createSettlementVersionFromCurrent,
  followupSettlementRequest,
  getSettlementChangeRequests,
  getSettlementEffectiveInfos,
  getSettlementInitDraftByFactory,
  getSettlementInitDrafts,
  getSettlementRequestById,
  getSettlementStatusClass,
  getSettlementStatusLabel,
  getSettlementVersionHistory,
  initializeSettlementInfo,
  markSettlementRequestPrinted,
  rejectSettlementRequest,
  saveSettlementInitDraft,
  setSettlementRequestPaperArchived,
  submitSettlementSignedProof,
  uploadSettlementSignedProof,
  verifySettlementRequest,
  escapeHtml,
  appStore,
}

export type {
  CycleType,
  DefaultPenaltyRule,
  FactoryBankAccount,
  FactorySettlementProfile,
  FactorySettlementSummary,
  PenaltyRuleFormData,
  PricingMode,
  RuleMode,
  RuleType,
  SettlementProfileFormData,
  SettlementStatus,
  BankAccountFormData,
  SettlementChangeRequest,
  SettlementConfigSnapshot,
  SettlementChangeRequestStatus,
  SettlementDefaultDeductionRuleSnapshot,
  SettlementEffectiveInfo,
  SettlementEffectiveInfoSnapshot,
  SettlementInitDraft,
}
