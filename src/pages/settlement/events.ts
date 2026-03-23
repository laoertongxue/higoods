import {
  PAGE_SIZE,
  state,
  today,
  normalizeAccountMask,
  closeDialog,
  syncSettlementRequestState,
  getFilteredSummaries,
  getFilteredRequests,
  saveCurrentInitDraft,
  resetInitEditor,
  openProfileDrawer,
  openAccountDrawer,
  openRuleDrawer,
  hasInitializedSettlement,
  getFactoryName,
  createSettlementVersionFromCurrent,
  initializeSettlementInfo,
  verifySettlementRequest,
  markSettlementRequestPrinted,
  uploadSettlementSignedProof,
  submitSettlementSignedProof,
  followupSettlementRequest,
  approveSettlementRequest,
  rejectSettlementRequest,
  setSettlementRequestPaperArchived,
  getSettlementRequestById,
  appStore,
  type DetailTab,
  type ProfileTab,
  type SettlementState,
  type CycleType,
  type PricingMode,
  type SettlementStatus,
  type RuleType,
  type RuleMode,
  type FactorySettlementProfile,
  type FactoryBankAccount,
  type DefaultPenaltyRule,
  type SettlementDefaultDeductionRuleSnapshot,
} from './context'

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

function hydrateRequestOperateForm(requestId: string): void {
  const request = getSettlementRequestById(requestId)
  if (!request) return
  state.requestOperateForm = {
    verifyRemark: request.verifyRemark || '',
    followupRemark: request.reviewRemark || '',
    rejectReason: request.rejectReason || '',
    paperArchived: request.paperArchived,
  }
  state.requestOperateError = ''
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

  const requestFilterNode = target.closest<HTMLElement>('[data-settle-request-filter]')
  if (requestFilterNode instanceof HTMLInputElement || requestFilterNode instanceof HTMLSelectElement) {
    const filter = requestFilterNode.dataset.settleRequestFilter
    const value = requestFilterNode.value

    if (filter === 'search') state.requestSearchKeyword = value
    if (filter === 'status') state.requestFilterStatus = value as SettlementState['requestFilterStatus']
    state.requestPage = 1
    return true
  }

  const requestFieldNode = target.closest<HTMLElement>('[data-settle-request-field]')
  if (
    requestFieldNode instanceof HTMLInputElement ||
    requestFieldNode instanceof HTMLTextAreaElement ||
    requestFieldNode instanceof HTMLSelectElement
  ) {
    const field = requestFieldNode.dataset.settleRequestField
    if (!field) return true

    if (field === 'verifyRemark') state.requestOperateForm.verifyRemark = requestFieldNode.value
    if (field === 'followupRemark') state.requestOperateForm.followupRemark = requestFieldNode.value
    if (field === 'rejectReason') state.requestOperateForm.rejectReason = requestFieldNode.value
    if (field === 'paperArchived') {
      state.requestOperateForm.paperArchived =
        requestFieldNode instanceof HTMLInputElement ? requestFieldNode.checked : false

      if (state.dialog.type === 'request-detail') {
        setSettlementRequestPaperArchived(state.dialog.requestId, state.requestOperateForm.paperArchived)
      }
    }
    return true
  }

  const initFieldNode = target.closest<HTMLElement>('[data-settle-init-field]')
  if (
    initFieldNode instanceof HTMLInputElement ||
    initFieldNode instanceof HTMLTextAreaElement ||
    initFieldNode instanceof HTMLSelectElement
  ) {
    const field = initFieldNode.dataset.settleInitField
    if (!field) return true
    const value = initFieldNode.value

    if (field === 'factorySearch') {
      state.initFactorySearch = value
      return true
    }

    if (field === 'config.cycleType') {
      state.initConfigDraft.cycleType = value as CycleType
      return true
    }
    if (field === 'config.pricingMode') {
      state.initConfigDraft.pricingMode = value as PricingMode
      return true
    }
    if (field === 'config.currency') {
      state.initConfigDraft.currency = value
      return true
    }
    if (field === 'config.settlementDayRule') {
      state.initConfigDraft.settlementDayRule = value
      return true
    }

    if (field === 'account.accountHolderName') {
      state.initAccountDraft.accountHolderName = value
      return true
    }
    if (field === 'account.idNumber') {
      state.initAccountDraft.idNumber = value
      return true
    }
    if (field === 'account.bankName') {
      state.initAccountDraft.bankName = value
      return true
    }
    if (field === 'account.bankAccountNo') {
      state.initAccountDraft.bankAccountNo = value
      return true
    }
    if (field === 'account.bankBranch') {
      state.initAccountDraft.bankBranch = value
      return true
    }

    const ruleMatch = field.match(/^rule\.(\d+)\.(ruleType|ruleMode|ruleValue|effectiveFrom)$/)
    if (ruleMatch) {
      const index = Number(ruleMatch[1])
      const key = ruleMatch[2]
      const rule = state.initRulesDraft[index]
      if (!rule) return true
      if (key === 'ruleType') rule.ruleType = value as RuleType
      if (key === 'ruleMode') rule.ruleMode = value as RuleMode
      if (key === 'ruleValue') rule.ruleValue = Number(value) || 0
      if (key === 'effectiveFrom') rule.effectiveFrom = value
      return true
    }

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

  const profileRuleFieldNode = target.closest<HTMLElement>('[data-settle-profile-rule-field]')
  if (
    profileRuleFieldNode instanceof HTMLInputElement ||
    profileRuleFieldNode instanceof HTMLSelectElement
  ) {
    const field = profileRuleFieldNode.dataset.settleProfileRuleField
    if (!field) return true
    const matched = field.match(/^rule\.(\d+)\.(ruleType|ruleMode|ruleValue|effectiveFrom)$/)
    if (!matched) return true
    const index = Number(matched[1])
    const key = matched[2]
    const rule = state.profileRulesDraft[index]
    if (!rule) return true
    const value = profileRuleFieldNode.value
    if (key === 'ruleType') rule.ruleType = value as RuleType
    if (key === 'ruleMode') rule.ruleMode = value as RuleMode
    if (key === 'ruleValue') rule.ruleValue = Number(value) || 0
    if (key === 'effectiveFrom') rule.effectiveFrom = value
    state.profileRulesError = ''
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-settle-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.settleAction
  if (!action) return false

  if (action === 'go-back') {
    appStore.navigate('/fcs/factories/settlement')
    return true
  }

  if (action === 'open-init-factory-picker') {
    state.initFactorySearch = ''
    state.initSelectedFactoryId = null
    state.dialog = { type: 'init-factory-picker' }
    return true
  }

  if (action === 'select-init-factory') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true
    state.initSelectedFactoryId = factoryId
    return true
  }

  if (action === 'go-init-draft') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true
    resetInitEditor(factoryId)
    closeDialog()
    appStore.navigate(`/fcs/factories/settlement/new/${factoryId}`)
    return true
  }

  if (action === 'open-init-editor') {
    if (!state.initSelectedFactoryId) return true
    resetInitEditor(state.initSelectedFactoryId)
    closeDialog()
    appStore.navigate(`/fcs/factories/settlement/new/${state.initSelectedFactoryId}`)
    return true
  }

  if (action === 'switch-init-tab') {
    const tab = actionNode.dataset.tab
    if (tab === 'config' || tab === 'account' || tab === 'rules') {
      state.initActiveTab = tab
    }
    return true
  }

  if (action === 'reset-init-config') {
    state.initConfigDraft = {
      cycleType: 'MONTHLY',
      settlementDayRule: '每月25日',
      pricingMode: 'BY_PIECE',
      currency: 'IDR',
    }
    return true
  }

  if (action === 'reset-init-account') {
    state.initAccountDraft = {
      accountHolderName: state.initEditorFactoryName || '',
      idNumber: '',
      bankName: '',
      bankAccountNo: '',
      bankBranch: '',
    }
    return true
  }

  if (action === 'add-init-rule') {
    state.initRulesDraft.push({
      ruleType: 'QUALITY_DEFECT',
      ruleMode: 'PERCENTAGE',
      ruleValue: 5,
      effectiveFrom: today(),
      status: 'ACTIVE',
    })
    return true
  }

  if (action === 'remove-init-rule') {
    const index = Number(actionNode.dataset.ruleIndex ?? '-1')
    if (index < 0 || index >= state.initRulesDraft.length) return true
    if (state.initRulesDraft.length <= 1) return true
    state.initRulesDraft.splice(index, 1)
    return true
  }

  if (action === 'back-init-to-list') {
    const saveResult = saveCurrentInitDraft('平台运营-林静')
    if (!saveResult.ok) {
      state.initErrorText = saveResult.message
      return true
    }
    state.initErrorText = ''
    appStore.navigate('/fcs/factories/settlement')
    return true
  }

  if (action === 'submit-init-settlement') {
    if (!state.initEditorFactoryId) {
      state.initErrorText = '请先选择工厂'
      return true
    }
    if (!state.initConfigDraft.cycleType || !state.initConfigDraft.pricingMode || !state.initConfigDraft.currency) {
      state.initErrorText = '请先补全结算配置'
      return true
    }
    if (
      !state.initAccountDraft.accountHolderName.trim() ||
      !state.initAccountDraft.idNumber.trim() ||
      !state.initAccountDraft.bankName.trim() ||
      !state.initAccountDraft.bankAccountNo.trim()
    ) {
      state.initErrorText = '请先补全收款账号必填项'
      return true
    }
    if (
      state.initRulesDraft.length === 0 ||
      state.initRulesDraft.some((rule) => !rule.effectiveFrom || Number(rule.ruleValue) <= 0)
    ) {
      state.initErrorText = '请先补全扣款规则'
      return true
    }

    const submitResult = initializeSettlementInfo({
      factoryId: state.initEditorFactoryId,
      factoryName: state.initEditorFactoryName,
      operator: '平台运营-林静',
      configSnapshot: state.initConfigDraft,
      receivingAccountSnapshot: {
        accountHolderName: state.initAccountDraft.accountHolderName.trim(),
        idNumber: state.initAccountDraft.idNumber.trim(),
        bankName: state.initAccountDraft.bankName.trim(),
        bankAccountNo: state.initAccountDraft.bankAccountNo.trim(),
        bankBranch: state.initAccountDraft.bankBranch.trim(),
      },
      deductionRulesSnapshot: state.initRulesDraft.map((item) => ({ ...item })),
    })

    if (!submitResult.ok) {
      state.initErrorText = submitResult.message
      return true
    }

    const factoryId = state.initEditorFactoryId
    const factoryName = state.initEditorFactoryName
    const now = today()

    state.profiles = state.profiles.filter((item) => item.factoryId !== factoryId)
    state.profiles.push({
      id: `sp-${Date.now()}`,
      factoryId,
      factoryName,
      cycleType: state.initConfigDraft.cycleType,
      settlementDayRule: state.initConfigDraft.settlementDayRule,
      pricingMode: state.initConfigDraft.pricingMode,
      currency: state.initConfigDraft.currency,
      isActive: true,
      effectiveFrom: now,
      updatedAt: now,
    })

    state.accounts = state.accounts.filter((item) => item.factoryId !== factoryId)
    state.accounts.push({
      id: `ba-${Date.now()}`,
      factoryId,
      accountName: state.initAccountDraft.accountHolderName.trim(),
      bankName: state.initAccountDraft.bankName.trim(),
      accountMasked: normalizeAccountMask(state.initAccountDraft.bankAccountNo.trim()),
      currency: state.initConfigDraft.currency,
      isDefault: true,
      status: 'ACTIVE',
    })

    state.rules = state.rules.filter((item) => item.factoryId !== factoryId)
    state.rules.push(
      ...state.initRulesDraft.map((item, index) => ({
        id: `pr-${Date.now()}-${index}`,
        factoryId,
        ruleType: item.ruleType,
        ruleMode: item.ruleMode,
        ruleValue: item.ruleValue,
        effectiveFrom: item.effectiveFrom,
        status: item.status,
      })),
    )

    state.summaries = state.summaries.map((item) =>
      item.factoryId === factoryId
        ? {
            ...item,
            cycleType: state.initConfigDraft.cycleType,
            pricingMode: state.initConfigDraft.pricingMode,
            currency: state.initConfigDraft.currency,
            hasDefaultAccount: true,
            status: 'ACTIVE',
            updatedAt: now,
          }
        : item,
    )

    syncSettlementRequestState()
    state.initErrorText = ''
    appStore.navigate(`/fcs/factories/settlement/${factoryId}`)
    return true
  }

  if (action === 'reset') {
    state.searchKeyword = ''
    state.filterCycleType = 'all'
    state.filterStatus = 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'switch-list-view') {
    const view = actionNode.dataset.view
    state.listView = view === 'requests' ? 'requests' : 'effective'
    state.requestOperateError = ''
    return true
  }

  if (action === 'reset-request-filter') {
    state.requestSearchKeyword = ''
    state.requestFilterStatus = 'all'
    state.requestPage = 1
    return true
  }

  if (action === 'filter-request-status-quick') {
    const status = actionNode.dataset.status
    if (status === 'PENDING_REVIEW' || status === 'APPROVED' || status === 'REJECTED') {
      state.listView = 'requests'
      state.requestFilterStatus = status
      state.requestPage = 1
    }
    return true
  }

  const totalPages = Math.max(1, Math.ceil(getFilteredSummaries().length / PAGE_SIZE))
  const requestTotalPages = Math.max(1, Math.ceil(getFilteredRequests().length / PAGE_SIZE))

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

  if (action === 'request-prev-page') {
    state.requestPage = Math.max(1, state.requestPage - 1)
    return true
  }

  if (action === 'request-next-page') {
    state.requestPage = Math.min(requestTotalPages, state.requestPage + 1)
    return true
  }

  if (action === 'request-goto-page') {
    const page = Number(actionNode.dataset.page ?? '1')
    state.requestPage = Math.max(1, Math.min(requestTotalPages, page))
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

  if (action === 'switch-profile-tab') {
    const tab = actionNode.dataset.tab as ProfileTab | undefined
    if (!tab) return true
    state.profileActiveTab = tab
    return true
  }

  if (action === 'open-version-view') {
    const factoryId = actionNode.dataset.factoryId
    const versionId = actionNode.dataset.versionId
    if (!factoryId || !versionId) return true
    state.dialog = { type: 'version-view', factoryId, versionId }
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

  if (action === 'add-profile-rule') {
    state.profileRulesDraft.push({
      ruleType: 'QUALITY_DEFECT',
      ruleMode: 'PERCENTAGE',
      ruleValue: 5,
      effectiveFrom: state.profileForm.effectiveFrom || today(),
      status: 'ACTIVE',
    })
    state.profileRulesError = ''
    return true
  }

  if (action === 'remove-profile-rule') {
    const index = Number(actionNode.dataset.ruleIndex ?? '-1')
    if (index < 0 || index >= state.profileRulesDraft.length) return true
    if (state.profileRulesDraft.length <= 1) return true
    state.profileRulesDraft.splice(index, 1)
    state.profileRulesError = ''
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

  if (action === 'open-settlement-request-detail') {
    const requestId = actionNode.dataset.requestId
    if (!requestId) return true
    hydrateRequestOperateForm(requestId)
    state.dialog = { type: 'request-detail', requestId }
    return true
  }

  if (action === 'verify-settlement-request') {
    const requestId = actionNode.dataset.requestId
    if (!requestId) return true
    const result = verifySettlementRequest(requestId, '平台运营-林静', state.requestOperateForm.verifyRemark)
    if (!result.ok) {
      state.requestOperateError = result.message
      return true
    }
    hydrateRequestOperateForm(requestId)
    state.requestOperateError = ''
    return true
  }

  if (action === 'print-settlement-change-form') {
    const requestId = actionNode.dataset.requestId
    if (!requestId) return true
    const result = markSettlementRequestPrinted(requestId, '平台运营-林静')
    if (!result.ok) {
      state.requestOperateError = result.message
      return true
    }
    state.dialog = { type: 'request-print', requestId }
    return true
  }

  if (action === 'upload-settlement-signed-proof') {
    const requestId = actionNode.dataset.requestId
    if (!requestId) return true
    const fileType = actionNode.dataset.fileType === 'FILE' ? 'FILE' : 'IMAGE'
    const result = uploadSettlementSignedProof(requestId, '平台运营-林静', fileType)
    if (!result.ok) {
      state.requestOperateError = result.message
      return true
    }
    hydrateRequestOperateForm(requestId)
    return true
  }

  if (action === 'submit-settlement-signed-proof') {
    const requestId = actionNode.dataset.requestId
    if (!requestId) return true
    const result = submitSettlementSignedProof(requestId, '平台运营-林静')
    if (!result.ok) {
      state.requestOperateError = result.message
      return true
    }
    hydrateRequestOperateForm(requestId)
    return true
  }

  if (action === 'followup-settlement-request') {
    const requestId = actionNode.dataset.requestId
    if (!requestId) return true
    const result = followupSettlementRequest(requestId, '平台运营-林静', state.requestOperateForm.followupRemark)
    if (!result.ok) {
      state.requestOperateError = result.message
      return true
    }
    hydrateRequestOperateForm(requestId)
    return true
  }

  if (action === 'approve-settlement-request') {
    const requestId = actionNode.dataset.requestId
    if (!requestId) return true
    setSettlementRequestPaperArchived(requestId, state.requestOperateForm.paperArchived)
    const result = approveSettlementRequest(requestId, '平台运营-林静', state.requestOperateForm.followupRemark)
    if (!result.ok) {
      state.requestOperateError = result.message
      return true
    }
    hydrateRequestOperateForm(requestId)
    return true
  }

  if (action === 'reject-settlement-request') {
    const requestId = actionNode.dataset.requestId
    if (!requestId) return true
    const result = rejectSettlementRequest(requestId, '平台运营-林静', state.requestOperateForm.rejectReason)
    if (!result.ok) {
      state.requestOperateError = result.message
      return true
    }
    hydrateRequestOperateForm(requestId)
    return true
  }

  if (action === 'print-now') {
    window.print()
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
    if (
      state.profileRulesDraft.length === 0 ||
      state.profileRulesDraft.some((rule) => !rule.effectiveFrom || Number(rule.ruleValue) <= 0)
    ) {
      state.profileRulesError = '请先补全扣款规则后再创建新版本'
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
    const rulesSnapshot: SettlementDefaultDeductionRuleSnapshot[] = state.profileRulesDraft.map((rule) => ({
      ruleType: rule.ruleType,
      ruleMode: rule.ruleMode,
      ruleValue: rule.ruleValue,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      status: rule.status,
    }))

    createSettlementVersionFromCurrent({
      factoryId,
      operator: '平台运营-林静',
      settlementConfigSnapshot: {
        cycleType: state.profileForm.cycleType,
        settlementDayRule: state.profileForm.settlementDayRule || '',
        pricingMode: state.profileForm.pricingMode,
        currency: state.profileForm.currency,
      },
      deductionRulesSnapshot: rulesSnapshot,
      effectiveAt: state.profileForm.effectiveFrom,
    })
    state.rules = state.rules.filter((rule) => rule.factoryId !== factoryId)
    state.rules.push(
      ...state.profileRulesDraft.map((rule, index) => ({
        id: `pr-${Date.now()}-${index}`,
        factoryId,
        ruleType: rule.ruleType,
        ruleMode: rule.ruleMode,
        ruleValue: rule.ruleValue,
        effectiveFrom: rule.effectiveFrom,
        effectiveTo: rule.effectiveTo,
        status: rule.status,
      })),
    )
    syncSettlementRequestState()
    state.profileRulesError = ''
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
