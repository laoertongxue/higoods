import {
  state,
  cycleTypeConfig,
  pricingModeConfig,
  ruleModeConfig,
  ruleTypeConfig,
  escapeHtml,
  syncSettlementRequestState,
  resetInitEditor,
  hasInitializedSettlement,
  getInitDraftByFactory,
  getUninitializedFactories,
  getFactoryName,
  type CycleType,
  type PricingMode,
  type RuleType,
  type RuleMode,
} from './context'

export function renderInitFactoryPickerDialog(): string {
  if (state.dialog.type !== 'init-factory-picker') return ''
  const allCandidates = getUninitializedFactories()
  const keyword = state.initFactorySearch.trim().toLowerCase()
  const candidates = keyword
    ? allCandidates.filter(
        (item) =>
          item.factoryName.toLowerCase().includes(keyword) || item.factoryId.toLowerCase().includes(keyword),
      )
    : allCandidates

  const selectedFactory =
    (state.initSelectedFactoryId
      ? allCandidates.find((item) => item.factoryId === state.initSelectedFactoryId)
      : null) ?? null
  const selectedDraft = selectedFactory ? getInitDraftByFactory(selectedFactory.factoryId) : null

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-settle-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[620px]" data-dialog-panel="true">
        <div class="flex h-full flex-col">
          <header class="border-b px-6 py-4">
            <h3 class="text-lg font-semibold">新增结算信息</h3>
            <p class="mt-1 text-sm text-muted-foreground">请选择尚未初始化结算信息的工厂</p>
          </header>
          <div class="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">工厂搜索</span>
              <input
                value="${escapeHtml(state.initFactorySearch)}"
                data-settle-init-field="factorySearch"
                placeholder="输入工厂名称或编码"
                class="h-9 w-full rounded-md border px-3 text-sm"
              />
            </label>
            <div class="overflow-hidden rounded-md border">
              <table class="w-full text-sm">
                <thead class="border-b bg-muted/30">
                  <tr>
                    <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">工厂</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">状态</th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    candidates.length === 0
                      ? '<tr><td colspan="3" class="h-24 px-3 text-center text-muted-foreground">暂无可初始化工厂</td></tr>'
                      : candidates
                          .map((item) => {
                            const hasDraft = Boolean(getInitDraftByFactory(item.factoryId))
                            const selected = item.factoryId === state.initSelectedFactoryId
                            return `
                              <tr class="border-b last:border-0 ${selected ? 'bg-blue-50/50' : ''}">
                                <td class="px-3 py-2">
                                  <p class="font-medium">${escapeHtml(item.factoryName)}</p>
                                  <p class="text-xs text-muted-foreground">${escapeHtml(item.factoryId)}</p>
                                </td>
                                <td class="px-3 py-2">
                                  ${
                                    hasDraft
                                      ? '<span class="inline-flex rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">有草稿</span>'
                                      : '<span class="inline-flex rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">未初始化</span>'
                                  }
                                </td>
                                <td class="px-3 py-2 text-right">
                                  <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-settle-action="select-init-factory" data-factory-id="${escapeHtml(item.factoryId)}">选择</button>
                                </td>
                              </tr>
                            `
                          })
                          .join('')
                  }
                </tbody>
              </table>
            </div>
            ${
              selectedFactory
                ? `
                  <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    已选择：${escapeHtml(selectedFactory.factoryName)}（${escapeHtml(selectedFactory.factoryId)}）
                  </div>
                `
                : ''
            }
            ${
              selectedDraft
                ? `
                  <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <p>当前有该工厂的结算信息草稿</p>
                    <button class="mt-2 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs hover:bg-amber-100" data-settle-action="go-init-draft" data-factory-id="${escapeHtml(selectedDraft.factoryId)}">点击前往</button>
                  </div>
                `
                : ''
            }
          </div>
          <footer class="flex items-center justify-end gap-2 border-t px-6 py-3">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-settle-action="close-dialog">取消</button>
            <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 ${!selectedFactory || Boolean(selectedDraft) ? 'pointer-events-none opacity-50' : ''}" data-settle-action="open-init-editor">开始初始化</button>
          </footer>
        </div>
      </section>
    </div>
  `
}


export function renderSettlementInitPage(factoryId: string): string {
  syncSettlementRequestState()
  if (state.initEditorFactoryId !== factoryId) {
    resetInitEditor(factoryId)
  }
  const initialized = hasInitializedSettlement(factoryId)
  const hasDraft = Boolean(getInitDraftByFactory(factoryId))

  if (initialized) {
    return `
      <div class="space-y-4">
        <div class="rounded-lg border bg-card p-6">
          <p class="text-sm font-semibold">该工厂已初始化结算信息</p>
          <p class="mt-2 text-sm text-muted-foreground">请通过工厂详情页的“新增版本”维护结算配置和扣款规则。</p>
          <div class="mt-4">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/factories/settlement/${escapeHtml(
              factoryId,
            )}">前往详情</button>
          </div>
        </div>
      </div>
    `
  }

  const configTab = `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">结算配置</p>
        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-settle-action="reset-init-config">新增结算配置</button>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">结算周期</span>
          <select data-settle-init-field="config.cycleType" class="h-9 w-full rounded-md border px-3 text-sm">
            ${(Object.keys(cycleTypeConfig) as CycleType[])
              .map(
                (cycleType) =>
                  `<option value="${cycleType}" ${state.initConfigDraft.cycleType === cycleType ? 'selected' : ''}>${escapeHtml(
                    cycleTypeConfig[cycleType].label,
                  )}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">计价方式</span>
          <select data-settle-init-field="config.pricingMode" class="h-9 w-full rounded-md border px-3 text-sm">
            ${(Object.keys(pricingModeConfig) as PricingMode[])
              .map(
                (pricingMode) =>
                  `<option value="${pricingMode}" ${
                    state.initConfigDraft.pricingMode === pricingMode ? 'selected' : ''
                  }>${escapeHtml(pricingModeConfig[pricingMode].label)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">币种</span>
          <select data-settle-init-field="config.currency" class="h-9 w-full rounded-md border px-3 text-sm">
            ${CURRENCIES.map(
              (currency) =>
                `<option value="${currency}" ${state.initConfigDraft.currency === currency ? 'selected' : ''}>${currency}</option>`,
            ).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">结算日规则</span>
          <input data-settle-init-field="config.settlementDayRule" class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(
            state.initConfigDraft.settlementDayRule || '',
          )}" placeholder="例如：每月25日" />
        </label>
      </div>
    </section>
  `

  const accountTab = `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">收款账号</p>
        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-settle-action="reset-init-account">新增收款账号</button>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">开户名</span>
          <input data-settle-init-field="account.accountHolderName" class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(
            state.initAccountDraft.accountHolderName,
          )}" />
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">证件号</span>
          <input data-settle-init-field="account.idNumber" class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(
            state.initAccountDraft.idNumber,
          )}" />
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">银行名称</span>
          <input data-settle-init-field="account.bankName" class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(
            state.initAccountDraft.bankName,
          )}" />
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">银行账号</span>
          <input data-settle-init-field="account.bankAccountNo" class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(
            state.initAccountDraft.bankAccountNo,
          )}" />
        </label>
        <label class="space-y-1 md:col-span-2">
          <span class="text-xs text-muted-foreground">开户支行</span>
          <input data-settle-init-field="account.bankBranch" class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(
            state.initAccountDraft.bankBranch,
          )}" />
        </label>
      </div>
    </section>
  `

  const rulesTab = `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">扣款规则</p>
        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-settle-action="add-init-rule">新增扣款规则</button>
      </div>
      <div class="overflow-hidden rounded-md border">
        <table class="w-full text-sm">
          <thead class="border-b bg-muted/30">
            <tr>
              <th class="px-2 py-2 text-left text-xs font-medium text-muted-foreground">规则类型</th>
              <th class="px-2 py-2 text-left text-xs font-medium text-muted-foreground">计算方式</th>
              <th class="px-2 py-2 text-left text-xs font-medium text-muted-foreground">数值</th>
              <th class="px-2 py-2 text-left text-xs font-medium text-muted-foreground">生效日期</th>
              <th class="px-2 py-2 text-left text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              state.initRulesDraft.length === 0
                ? '<tr><td colspan="5" class="px-2 py-4 text-center text-muted-foreground">暂无扣款规则</td></tr>'
                : state.initRulesDraft
                    .map(
                      (rule, index) => `
                        <tr class="border-b last:border-0">
                          <td class="px-2 py-2">
                            <select data-settle-init-field="rule.${index}.ruleType" class="h-8 w-full rounded border px-2 text-xs">
                              ${(Object.keys(ruleTypeConfig) as RuleType[])
                                .map(
                                  (ruleType) =>
                                    `<option value="${ruleType}" ${rule.ruleType === ruleType ? 'selected' : ''}>${escapeHtml(
                                      ruleTypeConfig[ruleType].label,
                                    )}</option>`,
                                )
                                .join('')}
                            </select>
                          </td>
                          <td class="px-2 py-2">
                            <select data-settle-init-field="rule.${index}.ruleMode" class="h-8 w-full rounded border px-2 text-xs">
                              ${(Object.keys(ruleModeConfig) as RuleMode[])
                                .map(
                                  (ruleMode) =>
                                    `<option value="${ruleMode}" ${rule.ruleMode === ruleMode ? 'selected' : ''}>${escapeHtml(
                                      ruleModeConfig[ruleMode].label,
                                    )}</option>`,
                                )
                                .join('')}
                            </select>
                          </td>
                          <td class="px-2 py-2">
                            <input type="number" min="0" step="0.1" data-settle-init-field="rule.${index}.ruleValue" class="h-8 w-full rounded border px-2 text-xs" value="${rule.ruleValue}" />
                          </td>
                          <td class="px-2 py-2">
                            <input type="date" data-settle-init-field="rule.${index}.effectiveFrom" class="h-8 w-full rounded border px-2 text-xs" value="${escapeHtml(
                              rule.effectiveFrom,
                            )}" />
                          </td>
                          <td class="px-2 py-2">
                            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted ${state.initRulesDraft.length <= 1 ? 'pointer-events-none opacity-50' : ''}" data-settle-action="remove-init-rule" data-rule-index="${index}">删除</button>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted" data-settle-action="back-init-to-list">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>
          </button>
          <div>
            <h1 class="text-2xl font-semibold">新增结算信息</h1>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(state.initEditorFactoryName)} · ${escapeHtml(
    factoryId,
  )}</p>
          </div>
        </div>
        <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-settle-action="submit-init-settlement">完成初始化</button>
      </div>

      <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        该页面用于初始化工厂结算信息，不包含版本历史和新增版本。
        ${hasDraft ? `当前已加载该工厂草稿（最近更新：${escapeHtml(getInitDraftByFactory(factoryId)?.updatedAt || '—')}）。` : ''}
      </div>
      ${
        state.initErrorText
          ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(
              state.initErrorText,
            )}</div>`
          : ''
      }

      <div class="inline-flex rounded-md border bg-muted/30 p-1">
        <button class="rounded px-3 py-1.5 text-sm ${state.initActiveTab === 'config' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-init-tab" data-tab="config">结算配置</button>
        <button class="rounded px-3 py-1.5 text-sm ${state.initActiveTab === 'account' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-init-tab" data-tab="account">收款账号</button>
        <button class="rounded px-3 py-1.5 text-sm ${state.initActiveTab === 'rules' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-init-tab" data-tab="rules">扣款规则</button>
      </div>

      ${state.initActiveTab === 'config' ? configTab : state.initActiveTab === 'account' ? accountTab : rulesTab}

      <div class="flex justify-end gap-2">
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-settle-action="back-init-to-list">返回</button>
        <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-settle-action="submit-init-settlement">完成初始化</button>
      </div>
    </div>
  `
}

