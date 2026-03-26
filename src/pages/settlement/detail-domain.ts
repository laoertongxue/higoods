import {
  state,
  CURRENCIES,
  cycleTypeConfig,
  pricingModeConfig,
  ruleModeConfig,
  ruleTypeConfig,
  settlementStatusConfig,
  renderConfirmDialog,
  escapeHtml,
  today,
  getVersionRecordById,
  maskBankAccountNo,
  getFactoryProfiles,
  hasInitializedSettlement,
  getFactoryName,
  getSettlementVersionHistory,
  closeDialog,
  type CycleType,
  type PricingMode,
  type RuleMode,
  type RuleType,
  type FactorySettlementProfile,
  type SettlementEffectiveInfo,
  type SettlementDefaultDeductionRuleSnapshot,
} from './context'
import { getSettlementVersionUsageStats } from '../../data/fcs/store-domain-settlement-seeds'

function renderSettlementVersionViewDialog(): string {
  if (state.dialog.type !== 'version-view') return ''
  const record = getVersionRecordById(state.dialog.factoryId, state.dialog.versionId)
  if (!record) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-settle-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[680px]" data-dialog-panel="true">
        <div class="flex h-full flex-col">
          <header class="border-b px-6 py-4">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">历史版本详情</h3>
              <span class="inline-flex rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">${escapeHtml(
                record.versionNo,
              )}</span>
            </div>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.factoryName)} · ${escapeHtml(
    record.effectiveAt,
  )}</p>
          </header>
          <div class="flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm">
            <section class="rounded-md border p-4">
              <p class="text-sm font-semibold">版本信息</p>
              <div class="mt-2 grid grid-cols-2 gap-3 text-xs">
                <p class="text-muted-foreground">版本号：<span class="font-medium text-foreground">${escapeHtml(record.versionNo)}</span></p>
                <p class="text-muted-foreground">状态：<span class="font-medium text-foreground">${record.status === 'EFFECTIVE' ? '生效中' : '已失效'}</span></p>
                <p class="text-muted-foreground">生效日期：<span class="font-medium text-foreground">${escapeHtml(record.effectiveAt)}</span></p>
                <p class="text-muted-foreground">失效日期：<span class="font-medium text-foreground">${escapeHtml(record.expiryAt || '—')}</span></p>
                <p class="text-muted-foreground">变更项：<span class="font-medium text-foreground">${escapeHtml(record.changeItems.join('、'))}</span></p>
                <p class="text-muted-foreground">变更来源：<span class="font-medium text-foreground">${escapeHtml(record.changeSource || '平台新增版本')}</span></p>
                <p class="text-muted-foreground">操作人：<span class="font-medium text-foreground">${escapeHtml(record.effectiveBy)}</span></p>
                <p class="text-muted-foreground">来源单号：<span class="font-medium text-foreground">${escapeHtml(record.sourceRequestId)}</span></p>
              </div>
            </section>
            <section class="rounded-md border p-4">
              <p class="text-sm font-semibold">结算配置</p>
              <div class="mt-2 grid grid-cols-2 gap-3 text-xs">
                <p class="text-muted-foreground">结算周期：<span class="font-medium text-foreground">${escapeHtml(
                  cycleTypeConfig[record.settlementConfigSnapshot.cycleType].label,
                )}</span></p>
                <p class="text-muted-foreground">计价方式：<span class="font-medium text-foreground">${escapeHtml(
                  pricingModeConfig[record.settlementConfigSnapshot.pricingMode].label,
                )}</span></p>
                <p class="text-muted-foreground">结算日规则：<span class="font-medium text-foreground">${escapeHtml(
                  record.settlementConfigSnapshot.settlementDayRule || '—',
                )}</span></p>
                <p class="text-muted-foreground">币种：<span class="font-medium text-foreground">${escapeHtml(
                  record.settlementConfigSnapshot.currency,
                )}</span></p>
              </div>
            </section>
            <section class="rounded-md border p-4">
              <p class="text-sm font-semibold">收款账号</p>
              <div class="mt-2 grid grid-cols-2 gap-3 text-xs">
                <p class="text-muted-foreground">开户名：<span class="font-medium text-foreground">${escapeHtml(
                  record.receivingAccountSnapshot.accountHolderName,
                )}</span></p>
                <p class="text-muted-foreground">证件号：<span class="font-medium text-foreground">${escapeHtml(
                  record.receivingAccountSnapshot.idNumber,
                )}</span></p>
                <p class="text-muted-foreground">银行名称：<span class="font-medium text-foreground">${escapeHtml(
                  record.receivingAccountSnapshot.bankName,
                )}</span></p>
                <p class="text-muted-foreground">银行账号：<span class="font-medium text-foreground">${escapeHtml(
                  maskBankAccountNo(record.receivingAccountSnapshot.bankAccountNo),
                )}</span></p>
                <p class="text-muted-foreground">开户支行：<span class="font-medium text-foreground">${escapeHtml(
                  record.receivingAccountSnapshot.bankBranch || '—',
                )}</span></p>
              </div>
            </section>
            <section class="rounded-md border p-4">
              <p class="text-sm font-semibold">扣款规则（${record.defaultDeductionRulesSnapshot.length} 条）</p>
              <div class="mt-2 overflow-hidden rounded-md border">
                <table class="w-full text-xs">
                  <thead class="border-b bg-muted/30">
                    <tr>
                      <th class="px-2 py-2 text-left font-medium text-muted-foreground">规则类型</th>
                      <th class="px-2 py-2 text-left font-medium text-muted-foreground">计算方式</th>
                      <th class="px-2 py-2 text-left font-medium text-muted-foreground">数值</th>
                      <th class="px-2 py-2 text-left font-medium text-muted-foreground">生效日期</th>
                      <th class="px-2 py-2 text-left font-medium text-muted-foreground">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      record.defaultDeductionRulesSnapshot.length === 0
                        ? '<tr><td colspan="5" class="px-2 py-3 text-center text-muted-foreground">暂无扣款规则</td></tr>'
                        : record.defaultDeductionRulesSnapshot
                            .map((item) => {
                              const valueText =
                                item.ruleMode === 'PERCENTAGE' ? `${item.ruleValue}%` : `${item.ruleValue} 元`
                              return `
                                <tr class="border-b last:border-0">
                                  <td class="px-2 py-2">${escapeHtml(ruleTypeConfig[item.ruleType].label)}</td>
                                  <td class="px-2 py-2">${escapeHtml(ruleModeConfig[item.ruleMode].label)}</td>
                                  <td class="px-2 py-2">${escapeHtml(valueText)}</td>
                                  <td class="px-2 py-2">${escapeHtml(item.effectiveFrom)}</td>
                                  <td class="px-2 py-2">${escapeHtml(settlementStatusConfig[item.status].label)}</td>
                                </tr>
                              `
                            })
                            .join('')
                    }
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <footer class="flex items-center justify-end border-t px-6 py-3">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-settle-action="close-dialog">关闭</button>
          </footer>
        </div>
      </section>
    </div>
  `
}

function renderProfileDrawer(): string {
  if (state.dialog.type !== 'profile-drawer') return ''

  const configTab = `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">结算配置</p>
        <span class="text-xs text-muted-foreground">当前版本基础上创建新版本</span>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">结算周期 *</span>
          <select data-settle-field="profile.cycleType" class="h-9 w-full rounded-md border px-3 text-sm ${state.profileErrors.cycleType ? 'border-red-600' : ''}">
            ${(Object.keys(cycleTypeConfig) as CycleType[])
              .map(
                (cycleType) =>
                  `<option value="${cycleType}" ${
                    state.profileForm.cycleType === cycleType ? 'selected' : ''
                  }>${escapeHtml(cycleTypeConfig[cycleType].label)}</option>`,
              )
              .join('')}
          </select>
          ${
            state.profileErrors.cycleType
              ? `<p class="text-xs text-red-600">${escapeHtml(state.profileErrors.cycleType)}</p>`
              : ''
          }
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">计价方式 *</span>
          <select data-settle-field="profile.pricingMode" class="h-9 w-full rounded-md border px-3 text-sm ${state.profileErrors.pricingMode ? 'border-red-600' : ''}">
            ${(Object.keys(pricingModeConfig) as PricingMode[])
              .map(
                (pricingMode) =>
                  `<option value="${pricingMode}" ${
                    state.profileForm.pricingMode === pricingMode ? 'selected' : ''
                  }>${escapeHtml(pricingModeConfig[pricingMode].label)}</option>`,
              )
              .join('')}
          </select>
          ${
            state.profileErrors.pricingMode
              ? `<p class="text-xs text-red-600">${escapeHtml(state.profileErrors.pricingMode)}</p>`
              : ''
          }
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">币种 *</span>
          <select data-settle-field="profile.currency" class="h-9 w-full rounded-md border px-3 text-sm ${state.profileErrors.currency ? 'border-red-600' : ''}">
            ${CURRENCIES.map(
              (currency) =>
                `<option value="${currency}" ${
                  state.profileForm.currency === currency ? 'selected' : ''
                }>${currency}</option>`,
            ).join('')}
          </select>
          ${
            state.profileErrors.currency
              ? `<p class="text-xs text-red-600">${escapeHtml(state.profileErrors.currency)}</p>`
              : ''
          }
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">结算日规则</span>
          <input
            data-settle-field="profile.settlementDayRule"
            value="${escapeHtml(state.profileForm.settlementDayRule ?? '')}"
            placeholder="例如：每月25日"
            class="h-9 w-full rounded-md border px-3 text-sm"
          />
        </label>
        <label class="space-y-1 md:col-span-2">
          <span class="text-xs text-muted-foreground">生效日期 *</span>
          <input
            type="date"
            data-settle-field="profile.effectiveFrom"
            value="${escapeHtml(state.profileForm.effectiveFrom)}"
            class="h-9 w-full rounded-md border px-3 text-sm ${state.profileErrors.effectiveFrom ? 'border-red-600' : ''}"
          />
          ${
            state.profileErrors.effectiveFrom
              ? `<p class="text-xs text-red-600">${escapeHtml(state.profileErrors.effectiveFrom)}</p>`
              : ''
          }
        </label>
      </div>
    </section>
  `

  const rulesTab = `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">扣款规则</p>
        <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-settle-action="add-profile-rule">新增扣款规则</button>
      </div>
      <div class="overflow-x-auto rounded-md border">
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
              state.profileRulesDraft.length === 0
                ? '<tr><td colspan="5" class="px-2 py-4 text-center text-muted-foreground">暂无扣款规则</td></tr>'
                : state.profileRulesDraft
                    .map(
                      (rule, index) => `
                        <tr class="border-b last:border-0">
                          <td class="px-2 py-2">
                            <select data-settle-profile-rule-field="rule.${index}.ruleType" class="h-8 w-full rounded border px-2 text-xs">
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
                            <select data-settle-profile-rule-field="rule.${index}.ruleMode" class="h-8 w-full rounded border px-2 text-xs">
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
                            <input type="number" min="0" step="0.1" data-settle-profile-rule-field="rule.${index}.ruleValue" class="h-8 w-full rounded border px-2 text-xs" value="${rule.ruleValue}" />
                          </td>
                          <td class="px-2 py-2">
                            <input type="date" data-settle-profile-rule-field="rule.${index}.effectiveFrom" class="h-8 w-full rounded border px-2 text-xs" value="${escapeHtml(
                              rule.effectiveFrom,
                            )}" />
                          </td>
                          <td class="px-2 py-2">
                            <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted ${
                              state.profileRulesDraft.length <= 1 ? 'pointer-events-none opacity-50' : ''
                            }" data-settle-action="remove-profile-rule" data-rule-index="${index}">删除</button>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
      ${
        state.profileRulesError
          ? `<p class="text-xs text-red-600">${escapeHtml(state.profileRulesError)}</p>`
          : '<p class="text-xs text-muted-foreground">当前规则会随本次新增版本一起生效。</p>'
      }
    </section>
  `

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-settle-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[760px]" data-dialog-panel="true">
        <div class="flex h-full flex-col">
          <header class="border-b px-6 py-4">
            <h3 class="text-lg font-semibold">新增结算版本</h3>
            <p class="mt-1 text-sm text-muted-foreground">创建新版本并更新结算配置与扣款规则，原有生效版本将自动失效。</p>
          </header>

          <form data-settle-form="profile" class="flex flex-1 flex-col">
            <div class="flex-1 space-y-4 overflow-y-auto px-6 py-6">
              <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                新增版本沿用“初始化结算信息”结构，仅支持修改结算配置和扣款规则。收款账号请由工厂端（PDA）发起修改申请。
              </div>

              <div class="inline-flex rounded-md border bg-muted/30 p-1">
                <button class="rounded px-3 py-1.5 text-sm ${state.profileActiveTab === 'config' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-profile-tab" data-tab="config">结算配置</button>
                <button class="rounded px-3 py-1.5 text-sm ${state.profileActiveTab === 'rules' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-profile-tab" data-tab="rules">扣款规则</button>
              </div>

              ${state.profileActiveTab === 'config' ? configTab : rulesTab}
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
            <p class="mt-1 text-sm text-muted-foreground">${isEditing ? '修改扣款规则' : '添加新的扣款规则'}</p>
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

function renderDetailProfileTab(
  factoryId: string,
  currentProfile: FactorySettlementProfile | undefined,
  currentVersionNo?: string,
): string {
  if (!currentProfile) {
    return `
      <div class="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        暂无有效的结算配置，请点击"新增版本"创建
      </div>
    `
  }

  const usageStats = getSettlementVersionUsageStats(factoryId)

  return `
    <div class="space-y-4">
      <div class="rounded-lg border bg-card p-6">
        <h3 class="mb-4 font-semibold">当前有效版本</h3>
        <div class="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        当前页仅展示生效版本，结算配置与扣款规则修改请通过“新增版本”完成。
        </div>
        <div class="grid grid-cols-2 gap-6 md:grid-cols-3">
          <div>
            <p class="text-sm text-muted-foreground">当前版本</p>
            <p class="font-medium">${escapeHtml(currentVersionNo || '—')}</p>
          </div>
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
      <div class="rounded-lg border bg-card p-6">
        <h3 class="mb-4 font-semibold">使用范围说明</h3>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-md border bg-muted/20 px-4 py-3">
            <p class="text-xs text-muted-foreground">当前版本正在使用的未关闭对账单</p>
            <p class="mt-1 text-lg font-semibold">${usageStats.openStatementCount}</p>
          </div>
          <div class="rounded-md border bg-muted/20 px-4 py-3">
            <p class="text-xs text-muted-foreground">当前版本正在使用的未完成结算批次</p>
            <p class="mt-1 text-lg font-semibold">${usageStats.activeBatchCount}</p>
          </div>
        </div>
        <div class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
          新版本审批通过后，只会影响未来新生成的结算单据。已生成的对账单、已入批结算批次和已完成批次会继续保留生成时的版本快照，不会被新版本自动覆盖。
        </div>
      </div>
    </div>
  `
}

function renderDetailAccountsTab(effectiveInfo: SettlementEffectiveInfo | null): string {
  if (!effectiveInfo) {
    return `
      <div class="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        暂无当前生效收款账号
      </div>
    `
  }

  const account = effectiveInfo.receivingAccountSnapshot
  return `
    <div class="space-y-4">
      <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        收款账号除初始化外，只能由工厂端（PDA）发起修改申请，平台侧当前仅支持查看。
      </div>

      <div class="overflow-x-auto rounded-md border">
        <table class="w-full text-sm">
          <thead class="border-b bg-muted/30">
            <tr>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">开户名</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">证件号</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">银行名称</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">银行账号</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">开户支行</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">当前版本</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="px-3 py-3 font-medium">${escapeHtml(account.accountHolderName)}</td>
              <td class="px-3 py-3">${escapeHtml(account.idNumber)}</td>
              <td class="px-3 py-3">${escapeHtml(account.bankName)}</td>
              <td class="px-3 py-3 font-mono">${escapeHtml(maskBankAccountNo(account.bankAccountNo))}</td>
              <td class="px-3 py-3">${escapeHtml(account.bankBranch || '—')}</td>
              <td class="px-3 py-3">${escapeHtml(effectiveInfo.versionNo)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderDetailRulesTab(rules: SettlementDefaultDeductionRuleSnapshot[]): string {
  return `
    <div class="space-y-4">
      <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        当前页仅展示当前生效版本的扣款规则，修改请通过右上角“新增版本”完成。
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
            </tr>
          </thead>
          <tbody>
            ${
              rules.length === 0
                ? '<tr><td colspan="6" class="h-24 px-3 text-center text-muted-foreground">暂无扣款规则</td></tr>'
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

function renderDetailHistoryTab(factoryId: string): string {
  const records = getSettlementVersionHistory(factoryId).sort((a, b) =>
    b.effectiveAt.localeCompare(a.effectiveAt),
  )
  return `
    <div class="overflow-x-auto rounded-md border">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/30">
          <tr>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">版本号</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">结算配置</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">收款账号</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">扣款规则</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">生效日期</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">失效日期</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">变更项</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">变更来源</th>
            <th class="px-3 py-3 text-right text-xs font-medium text-muted-foreground">操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            records.length === 0
              ? '<tr><td colspan="10" class="h-24 px-3 text-center text-muted-foreground">暂无历史版本</td></tr>'
              : records
                  .map((record) => {
                    const configText = `${cycleTypeConfig[record.settlementConfigSnapshot.cycleType].label} · ${
                      pricingModeConfig[record.settlementConfigSnapshot.pricingMode].label
                    } · ${record.settlementConfigSnapshot.currency}`
                    const statusText = record.status === 'EFFECTIVE' ? '生效中' : '已失效'
                    const statusClass =
                      record.status === 'EFFECTIVE'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    return `
                      <tr class="border-b last:border-0">
                        <td class="px-3 py-3 font-medium">${escapeHtml(record.versionNo)}</td>
                        <td class="px-3 py-3">${escapeHtml(configText)}</td>
                        <td class="px-3 py-3">${escapeHtml(maskBankAccountNo(record.receivingAccountSnapshot.bankAccountNo))}</td>
                        <td class="px-3 py-3">${record.defaultDeductionRulesSnapshot.length} 条</td>
                        <td class="px-3 py-3">${escapeHtml(record.effectiveAt)}</td>
                        <td class="px-3 py-3">${escapeHtml(record.expiryAt || '—')}</td>
                        <td class="px-3 py-3"><span class="inline-flex rounded border px-2 py-0.5 text-xs ${statusClass}">${statusText}</span></td>
                        <td class="px-3 py-3">${escapeHtml(record.changeItems.join('、'))}</td>
                        <td class="px-3 py-3">${escapeHtml(record.changeSource || '平台新增版本')}</td>
                        <td class="px-3 py-3 text-right">
                          <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-settle-action="open-version-view" data-factory-id="${escapeHtml(factoryId)}" data-version-id="${escapeHtml(record.versionId)}">查看版本</button>
                        </td>
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


export function renderSettlementDetailPage(factoryId: string): string {
  if (!hasInitializedSettlement(factoryId)) {
    return `
      <div class="space-y-4">
        <div class="rounded-lg border bg-card p-6">
          <h1 class="text-xl font-semibold">结算信息尚未初始化</h1>
          <p class="mt-2 text-sm text-muted-foreground">该工厂尚未建立结算信息，请走“新增结算信息”初始化链路。</p>
          <div class="mt-4">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/factories/settlement/new/${escapeHtml(
              factoryId,
            )}">前往初始化</button>
          </div>
        </div>
      </div>
    `
  }

  if (state.detailFactoryId !== factoryId) {
    state.detailFactoryId = factoryId
    state.detailActiveTab = 'profile'
    state.accountActionMenuId = null
    state.ruleActionMenuId = null
    closeDialog()
  }

  const profiles = getFactoryProfiles(factoryId)
  const effectiveInfo = state.effectiveInfos.find((item) => item.factoryId === factoryId) ?? null
  const rulesSnapshot = effectiveInfo?.defaultDeductionRulesSnapshot ?? []
  const currentProfile = profiles.find((profile) => profile.isActive)
  const factoryName = getFactoryName(factoryId)

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted" data-settle-action="go-back">
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
        <button type="button" class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-settle-action="open-profile-drawer" data-factory-id="${factoryId}">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          新增版本
        </button>
      </div>

      <div class="inline-flex rounded-md border bg-muted/30 p-1">
        <button type="button" class="rounded px-3 py-1.5 text-sm ${state.detailActiveTab === 'profile' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-tab" data-tab="profile">结算配置</button>
        <button type="button" class="rounded px-3 py-1.5 text-sm ${state.detailActiveTab === 'accounts' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-tab" data-tab="accounts">收款账号</button>
        <button type="button" class="rounded px-3 py-1.5 text-sm ${state.detailActiveTab === 'rules' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-tab" data-tab="rules">扣款规则</button>
        <button type="button" class="rounded px-3 py-1.5 text-sm ${state.detailActiveTab === 'history' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-tab" data-tab="history">版本历史</button>
      </div>

      ${
        state.detailActiveTab === 'profile'
          ? renderDetailProfileTab(factoryId, currentProfile, effectiveInfo?.versionNo)
          : state.detailActiveTab === 'accounts'
            ? renderDetailAccountsTab(effectiveInfo)
            : state.detailActiveTab === 'rules'
              ? renderDetailRulesTab(rulesSnapshot)
              : renderDetailHistoryTab(factoryId)
      }

      ${renderProfileDrawer()}
      ${renderSettlementVersionViewDialog()}
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
