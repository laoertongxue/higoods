import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  FACTORY_ONBOARDING_NODE_OPTIONS,
  type FactoryOnboardingApplication,
  type FactoryOnboardingDraftPayload,
  type FactoryOnboardingMachineAbility,
  type FactoryOnboardingNode,
  type FactoryOnboardingRequiredField,
  type FactoryOnboardingSelectedCapability,
} from '../data/fcs/factory-onboarding-domain.ts'
import {
  activateOnboardingSession,
  applyMachineValidation,
  calculateOnboardingCompleteness,
  canEditOnboardingApplication,
  canSubmitOnboardingApplication,
  createCapabilityFromSelection,
  createDefaultMachineDraft,
  createDefaultOnboardingDraft,
  getCompletenessMissingItems,
  getFactoryOnboardingCurrentNodeSummary,
  getPrimaryFactoryType,
  inferFactoryTypesFromCapabilities,
  getLatestReviewRecord,
  getLatestSupplementRecord,
  getOnboardingStatusActionLabel,
  getOnboardingStatusTip,
  getPdaOnboardingApplicationFromSession,
  listSelectableProcessCraftOptions,
  logoutPdaAccess,
  saveFactoryOnboardingDraft,
  submitFactoryOnboardingApplication,
  validateFactoryOnboardingDraftPayload,
} from '../data/fcs/factory-onboarding-flow.ts'
import { findFactoryOnboardingApplicationByLoginId, getFactoryOnboardingApplicationById } from '../data/fcs/factory-onboarding-store.ts'
import { getPdaRuntimeContext } from './pda-runtime'

interface PdaOnboardingState {
  applicationId: string | null
  selectedProcessCode: string
  confirmPassword: string
  showCompletenessItems: boolean
  draft: FactoryOnboardingDraftPayload
  errorText: string
  successText: string
}

const NEW_APPLICATION_KEY = '__NEW__'

const state: PdaOnboardingState = {
  applicationId: null,
  selectedProcessCode: '',
  confirmPassword: '',
  showCompletenessItems: false,
  draft: createDefaultOnboardingDraft(),
  errorText: '',
  successText: '',
}

function getCurrentSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query || '')
}

function getReturnTo(): string {
  return getCurrentSearchParams().get('returnTo') || '/fcs/pda/exec'
}

function hydrateDraftFromApplication(application: FactoryOnboardingApplication | null): void {
  if (!application) {
    state.applicationId = NEW_APPLICATION_KEY
    state.confirmPassword = ''
    state.showCompletenessItems = false
    state.draft = createDefaultOnboardingDraft()
    return
  }

  state.applicationId = application.applicationId
  state.confirmPassword = application.adminAccount.password
  state.draft = {
    applicationId: application.applicationId,
    applicationNo: application.applicationNo,
    factoryTempId: application.factoryTempId,
    factoryName: application.factoryName,
    bossName: application.bossName,
    whatsapp: application.whatsapp,
    address: application.address,
    machineTotalCount: application.machineTotalCount,
    effectiveWorkerCount: application.effectiveWorkerCount,
    availableStartDate: application.availableStartDate,
    selectedCapabilities: application.selectedCapabilities.map((item) => ({ ...item })),
    machines: application.machines.map((item) => ({ ...item })),
    adminAccount: { ...application.adminAccount },
  }
}

function syncMachineValidation(): void {
  state.draft.machines = applyMachineValidation(state.draft.machines, state.draft.selectedCapabilities)
}

function syncPageState(): FactoryOnboardingApplication | null {
  const runtime = getPdaRuntimeContext()
  const queryApplicationId = getCurrentSearchParams().get('applicationId')
  const sessionApplication = getPdaOnboardingApplicationFromSession()
  const runtimeApplication = runtime ? findFactoryOnboardingApplicationByLoginId(runtime.loginId) : null
  const application =
    (queryApplicationId ? getFactoryOnboardingApplicationById(queryApplicationId) : null)
    || sessionApplication
    || runtimeApplication
    || null

  const nextKey = application?.applicationId || NEW_APPLICATION_KEY
  if (state.applicationId !== nextKey) {
    hydrateDraftFromApplication(application)
  }

  if (!state.draft.adminAccount.roleId) {
    state.draft.adminAccount.roleId = 'FACTORY_ADMIN'
    state.draft.adminAccount.roleName = '工厂管理员'
  }

  if (!state.selectedProcessCode) {
    state.selectedProcessCode = listSelectableProcessCraftOptions()[0]?.processCode || ''
  }

  syncMachineValidation()
  return application
}

function renderNodeStatusChip(label: string, tone: 'done' | 'current' | 'todo' | 'warn' | 'stop'): string {
  const className =
    tone === 'done'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'current'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : tone === 'warn'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : tone === 'stop'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-border bg-muted text-muted-foreground'
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-[10px] ${className}">${escapeHtml(label)}</span>`
}

function getNodeTone(status: string): 'done' | 'current' | 'todo' | 'warn' | 'stop' {
  if (status === '已完成') return 'done'
  if (status === '进行中') return 'current'
  if (status === '已退回') return 'warn'
  if (status === '已终止') return 'stop'
  return 'todo'
}

function buildNodeSnapshot(application: FactoryOnboardingApplication | null, nodeName: FactoryOnboardingNode) {
  const log = application?.nodeLogs.find((item) => item.nodeName === nodeName)
  return {
    nodeName,
    nodeStatus: log?.nodeStatus || (application ? '未开始' : nodeName === '填写入驻信息' ? '进行中' : '未开始'),
    elapsedText: log?.elapsedText || (application ? '-' : nodeName === '填写入驻信息' ? '0分钟' : '-'),
    actionCount: log?.actionCount || (application ? 0 : nodeName === '填写入驻信息' ? 1 : 0),
  }
}

function renderFlowCard(application: FactoryOnboardingApplication | null): string {
  return `
    <section data-testid="pda-onboarding-flow" class="rounded-2xl border bg-card p-3 shadow-sm">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold">入驻流程</h2>
        <span class="text-[11px] text-muted-foreground">共 ${FACTORY_ONBOARDING_NODE_OPTIONS.length} 个节点</span>
      </div>
      <div class="space-y-2">
        ${FACTORY_ONBOARDING_NODE_OPTIONS.map((nodeName) => {
          const snapshot = buildNodeSnapshot(application, nodeName)
          const tone = getNodeTone(snapshot.nodeStatus)
          return `
            <article class="rounded-xl border px-3 py-2 ${tone === 'current' ? 'border-blue-200 bg-blue-50/60' : tone === 'done' ? 'border-emerald-200 bg-emerald-50/60' : tone === 'warn' ? 'border-amber-200 bg-amber-50/60' : tone === 'stop' ? 'border-red-200 bg-red-50/60' : 'border-border bg-muted/30'}">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="text-xs font-medium">${escapeHtml(nodeName)}</div>
                  <div class="mt-1 text-[11px] text-muted-foreground">节点耗时：${escapeHtml(snapshot.elapsedText)} · 动作次数：第${Math.max(0, snapshot.actionCount)}次动作</div>
                </div>
                ${renderNodeStatusChip(snapshot.nodeStatus, tone)}
              </div>
            </article>
          `
        }).join('')}
      </div>
    </section>
  `
}

function renderCurrentStatusCard(application: FactoryOnboardingApplication | null): string {
  if (!application) {
    return `
      <section class="rounded-2xl border bg-card p-3 shadow-sm">
        <h2 class="text-sm font-semibold">当前状态</h2>
        <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div class="rounded-xl border bg-muted/20 px-3 py-2">当前节点：<span class="font-medium">填写入驻信息</span></div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">当前状态：<span class="font-medium">草稿</span></div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">已在当前节点耗时：<span class="font-medium">0分钟</span></div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">当前节点动作次数：<span class="font-medium">第1次动作</span></div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">上次动作：<span class="font-medium">保存草稿</span></div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">上次操作时间：<span class="font-medium">—</span></div>
        </div>
      </section>
    `
  }

  const summary = getFactoryOnboardingCurrentNodeSummary(application)
  return `
    <section data-testid="pda-onboarding-current-card" class="rounded-2xl border bg-card p-3 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold">当前状态</h2>
          <p class="mt-1 text-xs text-muted-foreground">当前节点耗时、当前节点动作次数和上次动作都来自流程日志。</p>
        </div>
        ${renderNodeStatusChip(application.status, application.status === '已合作' ? 'done' : application.status === '已拒绝' ? 'stop' : 'current')}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-xl border bg-muted/20 px-3 py-2">当前节点：<span data-testid="pda-onboarding-current-node" class="font-medium">${escapeHtml(summary.currentNode)}</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">当前状态：<span class="font-medium">${escapeHtml(summary.currentStatusLabel)}</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">已在当前节点耗时：<span data-testid="pda-onboarding-current-elapsed" class="font-medium">${escapeHtml(summary.elapsedText)}</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">当前节点动作次数：<span data-testid="pda-onboarding-current-actions" class="font-medium">${escapeHtml(summary.actionCountText)}</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">上次动作：<span data-testid="pda-onboarding-last-action" class="font-medium">${escapeHtml(summary.lastActionName)}</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">上次操作时间：<span class="font-medium">${escapeHtml(summary.lastOperatedAt)}</span></div>
      </div>
    </section>
  `
}

function renderStatusTipCard(application: FactoryOnboardingApplication | null): string {
  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm">
      <h3 class="text-sm font-semibold">状态提示</h3>
      <div class="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs text-blue-700">${escapeHtml(getOnboardingStatusTip(application))}</div>
    </section>
  `
}

function getFactoryTypeLabel(code: string): string {
  const map: Record<string, string> = {
    CUTTING_FACTORY: '裁床厂',
    PRINTING_FACTORY: '印花厂',
    DYEING_FACTORY: '染厂',
    POST_FINISHING_FACTORY: '后道工厂',
    SPECIAL_CRAFT_FACTORY: '特殊工艺厂',
    SEWING_FACTORY: '车缝厂',
    MULTI_CAPABILITY_FACTORY: '全能力工厂',
  }
  return map[code] || code
}

function getCompletenessActionText(itemName: string): string {
  if (itemName === '账号信息') return '请补齐登录账户、密码、管理员姓名和管理员 WhatsApp'
  if (itemName === '工厂基础信息') return '请补齐工厂名称、老板名字、WhatsApp、地址和可开始合作时间'
  if (itemName === '人员信息') return '请填写有效工人数量'
  if (itemName === '机器信息') return '请补齐机器总数和机器明细'
  if (itemName === '工序工艺能力') return '请至少选择一个具体工序工艺'
  if (itemName === '机器与工序工艺关联') return '请让每台机器都关联已选工序工艺'
  return '请补齐对应资料'
}

function renderCompletenessCard(application: FactoryOnboardingApplication | null): string {
  const draftLike = application || ({
    ...state.draft,
    completenessItems: [],
  } as FactoryOnboardingApplication)
  const completeness = calculateOnboardingCompleteness(draftLike)
  const missingItems = getCompletenessMissingItems({
    ...draftLike,
    completenessItems: completeness.completenessItems,
  })
  const toneClass =
    completeness.completenessScore >= 95
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : completeness.completenessScore >= 80
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : completeness.completenessScore >= 60
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-red-200 bg-red-50 text-red-700'

  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm" data-testid="pda-onboarding-completeness-card">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">资料完整性</h3>
          <p class="mt-1 text-xs text-muted-foreground">评分来自账号、基础资料、机器、工序工艺、关联关系和 WhatsApp 校验。</p>
        </div>
        <span class="inline-flex rounded-full border px-2 py-0.5 text-[11px] ${toneClass}">${escapeHtml(completeness.completenessLevel)}</span>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-xl border bg-muted/20 px-3 py-2">资料完整性评分：<span class="font-medium">${completeness.completenessScore} 分</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">完整性等级：<span class="font-medium">${escapeHtml(completeness.completenessLevel)}</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">待补充项数量：<span class="font-medium">${missingItems.length} 项</span></div>
        <button type="button" class="rounded-xl border bg-background px-3 py-2 text-left text-xs font-medium" data-pda-onboarding-action="toggle-completeness-items">${state.showCompletenessItems ? '收起待补充项' : '查看待补充项'}</button>
      </div>
      ${state.showCompletenessItems ? `
        <div class="mt-3 space-y-2">
          ${missingItems.length > 0 ? missingItems.map((item) => `
            <article class="rounded-xl border border-dashed px-3 py-2 text-xs">
              <div class="font-medium">${escapeHtml(item.itemName)}</div>
              <div class="mt-1 text-muted-foreground">缺失原因：${escapeHtml(item.missingReason)}</div>
              <div class="mt-1 text-muted-foreground">建议补充动作：${escapeHtml(getCompletenessActionText(item.itemName))}</div>
            </article>
          `).join('') : '<div class="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">当前资料已无待补充项。</div>'}
        </div>
      ` : ''}
    </section>
  `
}

function renderFactoryTypeMatchCard(): string {
  const matchResults = inferFactoryTypesFromCapabilities(state.draft.selectedCapabilities)
  const primaryFactoryType = getPrimaryFactoryType(matchResults)
  const matchReason = matchResults.length > 0
    ? matchResults.map((item) => `${getFactoryTypeLabel(item.factoryTypeCode)}：${item.matchedCapabilities.join('、')}`).join('；')
    : '请先选择工序工艺能力。'
  return `
    <section class="rounded-2xl border bg-muted/20 p-3">
      <h4 class="text-xs font-semibold">系统匹配工厂类型</h4>
      <div class="mt-2 space-y-2 text-xs">
        <div class="rounded-xl border bg-background px-3 py-2">主类型：<span class="font-medium">${escapeHtml(getFactoryTypeLabel(primaryFactoryType))}</span></div>
        <div class="rounded-xl border bg-background px-3 py-2">匹配依据：${escapeHtml(matchReason)}</div>
      </div>
    </section>
  `
}

function renderField(label: string, inputHtml: string, required = false): string {
  return `
    <label class="block space-y-1.5">
      <span class="text-xs font-medium text-foreground">${escapeHtml(label)}${required ? ' *' : ''}</span>
      ${inputHtml}
    </label>
  `
}

function renderCapabilityTags(capabilities: FactoryOnboardingSelectedCapability[], readonly: boolean): string {
  if (capabilities.length <= 0) {
    return '<div class="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">请至少选择一个工序工艺</div>'
  }

  return `
    <div class="flex flex-wrap gap-2">
      ${capabilities.map((item, index) => `
        <span class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
          ${escapeHtml(`${item.processName} / ${item.craftName}`)}
          ${readonly ? '' : `<button type="button" class="rounded-full text-blue-700 hover:bg-blue-100" data-pda-onboarding-action="remove-capability" data-capability-index="${index}">移除</button>`}
        </span>
      `).join('')}
    </div>
  `
}

function renderCapabilityPicker(readonly: boolean): string {
  const processOptions = listSelectableProcessCraftOptions()
  const selectedProcess = processOptions.find((item) => item.processCode === state.selectedProcessCode) || processOptions[0]
  const selectedKeys = new Set(state.draft.selectedCapabilities.map((item) => `${item.processCode}:${item.craftCode}`))

  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">工序工艺能力</h3>
          <p class="mt-1 text-xs text-muted-foreground">先选工序，再勾选该工序下的具体工艺。</p>
        </div>
      </div>
      <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
        ${processOptions.map((item) => `
          <button
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs ${item.processCode === selectedProcess?.processCode ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-border bg-background text-muted-foreground'}"
            data-pda-onboarding-action="select-process"
            data-process-code="${escapeHtml(item.processCode)}"
            ${readonly ? 'disabled' : ''}
          >
            ${escapeHtml(item.processName)}
          </button>
        `).join('')}
      </div>
      <div class="mt-3 grid grid-cols-1 gap-2">
        ${(selectedProcess?.crafts || []).map((craft) => {
          const checked = selectedKeys.has(`${craft.processCode}:${craft.craftCode}`)
          return `
            <label class="flex items-center gap-3 rounded-xl border px-3 py-2 text-xs ${readonly ? 'opacity-80' : ''}">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border"
                data-pda-onboarding-action="toggle-capability"
                data-process-code="${escapeHtml(craft.processCode)}"
                data-craft-code="${escapeHtml(craft.craftCode)}"
                ${checked ? 'checked' : ''}
                ${readonly ? 'disabled' : ''}
              />
              <span>${escapeHtml(craft.craftName)}</span>
            </label>
          `
        }).join('') || '<div class="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">当前工序暂无可选工艺</div>'}
      </div>
      <div class="mt-3 space-y-2" data-testid="pda-onboarding-capability-section">
        <div class="text-xs font-medium">已选工序工艺</div>
        ${renderCapabilityTags(state.draft.selectedCapabilities, readonly)}
      </div>
    </section>
  `
}

function getSelectedProcessOptions() {
  const processMap = new Map<string, { processCode: string; processName: string }>()
  state.draft.selectedCapabilities.forEach((item) => {
    if (!processMap.has(item.processCode)) {
      processMap.set(item.processCode, { processCode: item.processCode, processName: item.processName })
    }
  })
  return [...processMap.values()]
}

function getSelectedCraftOptions(processCode: string) {
  return state.draft.selectedCapabilities.filter((item) => item.processCode === processCode)
}

function renderMachineTable(readonly: boolean): string {
  const rows = state.draft.machines
  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">机器明细</h3>
          <p class="mt-1 text-xs text-muted-foreground">机器必须关联已选择的工序工艺，异常机器允许保存草稿但不能提交。</p>
        </div>
        ${readonly ? '' : '<button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-onboarding-action="add-machine">添加机器</button>'}
      </div>
      <div class="mt-3 space-y-3" data-testid="pda-onboarding-machine-list">
        ${rows.length > 0 ? rows.map((machine, index) => renderMachineRow(machine, index, readonly)).join('') : '<div class="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">请至少添加一条机器明细</div>'}
      </div>
    </section>
  `
}

function renderMachineRow(machine: FactoryOnboardingMachineAbility, index: number, readonly: boolean): string {
  const processOptions = getSelectedProcessOptions()
  const craftOptions = getSelectedCraftOptions(machine.linkedProcessCode)
  const disabled = readonly ? 'disabled' : ''
  const invalid = machine.validationStatus !== '通过'
  return `
    <article class="rounded-2xl border p-3 ${invalid ? 'border-red-200 bg-red-50/40' : 'bg-muted/20'}" data-testid="pda-onboarding-machine-row-${index}">
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="text-xs font-medium">机器 ${index + 1}</div>
        <div class="flex items-center gap-2">
          ${renderNodeStatusChip(machine.validationStatus, invalid ? 'stop' : 'done')}
          ${readonly ? '' : `<button type="button" class="rounded-full border px-2 py-1 text-[11px] text-destructive" data-pda-onboarding-action="remove-machine" data-machine-index="${index}">删除</button>`}
        </div>
      </div>
      <div class="mb-3 rounded-xl border ${invalid ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'} px-3 py-2 text-xs">
        校验状态：${escapeHtml(machine.validationStatus)}${machine.validationMessage ? ` · ${escapeHtml(machine.validationMessage)}` : ''}
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        ${renderField('机器名称', `<input ${disabled} data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="machineName" value="${escapeHtml(machine.machineName)}" class="h-9 w-full rounded-xl border px-3" placeholder="请输入机器名称" />`, true)}
        ${renderField('机器编号', `<input ${disabled} data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="machineNo" value="${escapeHtml(machine.machineNo)}" class="h-9 w-full rounded-xl border px-3" placeholder="请输入机器编号" />`)}
        ${renderField('数量', `<input ${disabled} type="number" min="1" data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="machineCount" value="${machine.machineCount}" class="h-9 w-full rounded-xl border px-3" />`, true)}
        ${renderField('机器状态', `
          <div class="flex gap-2 pt-1">
            ${['可用', '维修中', '停用'].map((item) => `
              <label class="inline-flex items-center gap-1 text-xs">
                <input ${disabled} type="radio" name="machine-condition-${index}" value="${item}" data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="condition" ${machine.condition === item ? 'checked' : ''} />
                <span>${item}</span>
              </label>
            `).join('')}
          </div>
        `, true)}
        ${renderField('关联工序', `
          <select ${disabled} data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="linkedProcessCode" class="h-9 w-full rounded-xl border px-3">
            <option value="">请选择工序</option>
            ${processOptions.map((item) => `<option value="${escapeHtml(item.processCode)}" ${item.processCode === machine.linkedProcessCode ? 'selected' : ''}>${escapeHtml(item.processName)}</option>`).join('')}
          </select>
        `, true)}
        ${renderField('关联工艺', `
          <select ${disabled} data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="linkedCraftCode" class="h-9 w-full rounded-xl border px-3">
            <option value="">请选择工艺</option>
            ${craftOptions.map((item) => `<option value="${escapeHtml(item.craftCode)}" ${item.craftCode === machine.linkedCraftCode ? 'selected' : ''}>${escapeHtml(item.craftName)}</option>`).join('')}
          </select>
        `, true)}
        <label class="col-span-2 block space-y-1.5">
          <span class="text-xs font-medium">备注</span>
          <input ${disabled} data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="remark" value="${escapeHtml(machine.remark)}" class="h-9 w-full rounded-xl border px-3" placeholder="请输入备注" />
        </label>
      </div>
    </article>
  `
}

function getDraftFieldValue(field: FactoryOnboardingRequiredField): string {
  switch (field) {
    case '工厂名称':
      return state.draft.factoryName || '未填写'
    case '老板名字':
      return state.draft.bossName || '未填写'
    case 'WhatsApp':
      return state.draft.whatsapp || '未填写'
    case '地址':
      return state.draft.address || '未填写'
    case '有效工人数量':
      return state.draft.effectiveWorkerCount > 0 ? String(state.draft.effectiveWorkerCount) : '未填写'
    case '机器总数':
      return state.draft.machineTotalCount > 0 ? String(state.draft.machineTotalCount) : '未填写'
    case '机器明细':
      return state.draft.machines.length > 0 ? state.draft.machines.map((item) => `${item.machineName || '未命名设备'}×${item.machineCount || 0}`).join('、') : '未填写'
    case '工序工艺能力':
      return state.draft.selectedCapabilities.length > 0 ? state.draft.selectedCapabilities.map((item) => `${item.processName}/${item.craftName}`).join('、') : '未填写'
    case '可开始合作时间':
      return state.draft.availableStartDate || '未填写'
    case '管理员账号':
      return state.draft.adminAccount.loginId || '未填写'
    default:
      return '未填写'
  }
}

function renderReviewAndSupplement(application: FactoryOnboardingApplication | null): string {
  const latestReview = getLatestReviewRecord(application)
  const latestSupplement = getLatestSupplementRecord(application)
  const showReview = latestReview && (application?.status === '退回补充资料' || application?.status === '已重新提交待审核' || application?.status === '已拒绝')
  if (!showReview) return ''

  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm" data-testid="pda-onboarding-review-card">
      <h3 class="text-sm font-semibold">最近审核意见</h3>
      <div class="mt-3 space-y-2 text-xs">
        <div class="rounded-xl border bg-muted/20 px-3 py-2">审核结果：${escapeHtml(latestReview.reviewResult)}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">审核意见：${escapeHtml(latestReview.reviewOpinion)}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">是否允许再次提交：${latestReview.allowResubmit ? '是' : '否'}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">审核人：${escapeHtml(latestReview.reviewer)}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">审核时间：${escapeHtml(latestReview.reviewedAt)}</div>
      </div>
      ${latestSupplement ? `
        <div class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" data-testid="pda-onboarding-supplement-card">
          <div class="font-medium">需补充字段</div>
          <div class="mt-2 flex flex-wrap gap-2">
            ${latestSupplement.requiredFields.map((field) => `<span class="rounded-full border border-amber-200 bg-white px-2 py-1">${escapeHtml(field)}</span>`).join('')}
          </div>
          <div class="mt-3 space-y-2">
            ${latestSupplement.requiredFields.map((field) => `
              <div class="rounded-xl border border-amber-200 bg-white px-3 py-2">
                <div class="font-medium">${escapeHtml(field)}</div>
                <div class="mt-1 text-amber-700">当前填写值：${escapeHtml(getDraftFieldValue(field))}</div>
                <div class="mt-1 text-amber-700">修改入口：请在下方表单中更新该字段</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </section>
  `
}

function renderReadonlySummary(): string {
  const capabilityText = state.draft.selectedCapabilities.map((item) => `${item.processName}/${item.craftName}`).join('、') || '未选择'
  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm">
      <h3 class="text-sm font-semibold">提交确认</h3>
      <div class="mt-3 space-y-2 text-xs">
        <div class="rounded-xl border bg-muted/20 px-3 py-2">工厂名称：${escapeHtml(state.draft.factoryName || '未填写')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">老板名字：${escapeHtml(state.draft.bossName || '未填写')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">WhatsApp：${escapeHtml(state.draft.whatsapp || '未填写')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">地址：${escapeHtml(state.draft.address || '未填写')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">有效工人数量：${state.draft.effectiveWorkerCount || 0}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">机器总数：${state.draft.machineTotalCount || 0}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">已选工序工艺：${escapeHtml(capabilityText)}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">可开始合作时间：${escapeHtml(state.draft.availableStartDate || '未选择')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">管理员账号：${escapeHtml(state.draft.adminAccount.loginId || '未填写')}</div>
      </div>
    </section>
  `
}

function renderRecords(application: FactoryOnboardingApplication | null): string {
  if (!application) return ''
  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm">
      <h3 class="text-sm font-semibold">流程记录</h3>
      <div class="mt-3 space-y-3 text-xs">
        <div>
          <div class="mb-2 font-medium">节点记录</div>
          <div class="space-y-2">
            ${application.nodeLogs.map((item) => `
              <article class="rounded-xl border px-3 py-2">
                <div class="flex items-center justify-between gap-2">
                  <div class="font-medium">${escapeHtml(item.nodeName)}</div>
                  ${renderNodeStatusChip(item.nodeStatus, getNodeTone(item.nodeStatus))}
                </div>
                <div class="mt-1 text-muted-foreground">进入：${escapeHtml(item.enteredAt)} · 离开：${escapeHtml(item.leftAt || '进行中')}</div>
                <div class="mt-1 text-muted-foreground">节点耗时：${escapeHtml(item.elapsedText)} · 动作次数：第${item.actionCount}次动作</div>
                <div class="mt-1 text-muted-foreground">上次操作：${escapeHtml(item.lastActionAt || '—')} · 操作人：${escapeHtml(item.operator)}</div>
                <div class="mt-1 text-muted-foreground">备注：${escapeHtml(item.remark || '—')}</div>
              </article>
            `).join('')}
          </div>
        </div>
        <div>
          <div class="mb-2 font-medium">动作记录</div>
          <div class="space-y-2">
            ${application.actionLogs.map((item) => `
              <article class="rounded-xl border px-3 py-2">
                <div class="font-medium">${escapeHtml(item.actionName)}</div>
                <div class="mt-1 text-muted-foreground">所属节点：${escapeHtml(item.nodeName)} · 节点内第${item.actionSequenceInNode}次动作</div>
                <div class="mt-1 text-muted-foreground">状态变化：${escapeHtml(item.fromStatus)} → ${escapeHtml(item.toStatus)}</div>
                <div class="mt-1 text-muted-foreground">节点变化：${escapeHtml(item.fromNode)} → ${escapeHtml(item.toNode)}</div>
                <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(item.operator)} · 时间：${escapeHtml(item.operatedAt)}</div>
                <div class="mt-1 text-muted-foreground">备注：${escapeHtml(item.remark || '—')}</div>
              </article>
            `).join('') || '<div class="rounded-xl border border-dashed px-3 py-3 text-muted-foreground">当前暂无动作记录</div>'}
          </div>
        </div>
      </div>
    </section>
  `
}

function renderActionArea(application: FactoryOnboardingApplication | null): string {
  const readonly = !canEditOnboardingApplication(application)
  const returnTo = getReturnTo()
  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm">
      ${state.errorText ? `<div class="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(state.errorText)}</div>` : ''}
      ${state.successText ? `<div class="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">${escapeHtml(state.successText)}</div>` : ''}
      <div class="grid grid-cols-1 gap-2">
        ${readonly ? '' : '<button type="button" class="h-11 rounded-2xl border bg-background text-sm font-medium" data-pda-onboarding-action="save-draft">保存草稿</button>'}
        ${canSubmitOnboardingApplication(application)
          ? `<button type="button" class="h-11 rounded-2xl bg-primary text-sm font-medium text-primary-foreground" data-pda-onboarding-action="submit">${escapeHtml(getOnboardingStatusActionLabel(application))}</button>`
          : '<button type="button" class="h-11 rounded-2xl border bg-muted text-sm font-medium text-muted-foreground" disabled>当前状态仅支持查看</button>'}
        <button type="button" class="h-11 rounded-2xl border bg-background text-sm font-medium" data-pda-onboarding-action="goto-login">返回登录</button>
        ${application?.status === '已合作' ? `<button type="button" class="h-11 rounded-2xl border bg-background text-sm font-medium" data-nav="${escapeHtml(returnTo)}">进入业务页面</button>` : ''}
      </div>
    </section>
  `
}

function renderOnboardingBody(application: FactoryOnboardingApplication | null): string {
  const readonly = !canEditOnboardingApplication(application)
  return `
    <section class="min-h-screen bg-slate-50 pb-6">
      <header class="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold">工厂入驻&登录</div>
            <div class="text-[11px] text-muted-foreground">入驻</div>
          </div>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-onboarding-action="logout">退出当前账号</button>
        </div>
      </header>
      <div class="space-y-3 px-4 py-4">
        ${renderFlowCard(application)}
        ${renderCurrentStatusCard(application)}
        ${renderStatusTipCard(application)}
        ${renderCompletenessCard(application)}
        ${renderReviewAndSupplement(application)}

        <section class="rounded-2xl border bg-card p-3 shadow-sm">
          <h3 class="text-sm font-semibold">账号信息</h3>
          <div data-testid="pda-onboarding-account-section" class="mt-3 grid grid-cols-1 gap-3 text-xs">
            ${renderField('登录账户', `<input ${readonly ? 'disabled' : ''} data-pda-onboarding-field="admin-loginId" value="${escapeHtml(state.draft.adminAccount.loginId)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入登录账户" />`, true)}
            ${renderField('登录密码', `<input ${readonly ? 'disabled' : ''} type="password" data-pda-onboarding-field="admin-password" value="${escapeHtml(state.draft.adminAccount.password)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入登录密码" />`, true)}
            ${renderField('确认密码', `<input ${readonly ? 'disabled' : ''} type="password" data-pda-onboarding-field="confirmPassword" value="${escapeHtml(state.confirmPassword)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请再次输入登录密码" />`, true)}
            ${renderField('管理员姓名', `<input ${readonly ? 'disabled' : ''} data-pda-onboarding-field="admin-adminName" value="${escapeHtml(state.draft.adminAccount.adminName)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入管理员姓名" />`, true)}
            ${renderField('管理员 WhatsApp', `<input ${readonly ? 'disabled' : ''} data-pda-onboarding-field="admin-whatsapp" value="${escapeHtml(state.draft.adminAccount.whatsapp)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入管理员 WhatsApp" />`, true)}
          </div>
        </section>

        <section class="rounded-2xl border bg-card p-3 shadow-sm">
          <h3 class="text-sm font-semibold">工厂基础信息</h3>
          <div data-testid="pda-onboarding-basic-section" class="mt-3 grid grid-cols-1 gap-3 text-xs">
            ${renderField('工厂名称', `<input ${readonly ? 'disabled' : ''} data-pda-onboarding-field="factoryName" value="${escapeHtml(state.draft.factoryName)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入工厂名称" />`, true)}
            ${renderField('老板名字', `<input ${readonly ? 'disabled' : ''} data-pda-onboarding-field="bossName" value="${escapeHtml(state.draft.bossName)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入老板名字" />`, true)}
            ${renderField('WhatsApp', `<input ${readonly ? 'disabled' : ''} data-pda-onboarding-field="whatsapp" value="${escapeHtml(state.draft.whatsapp)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入 WhatsApp" />`, true)}
            <label class="block space-y-1.5">
              <span class="text-xs font-medium text-foreground">地址 *</span>
              <textarea ${readonly ? 'disabled' : ''} data-pda-onboarding-field="address" class="min-h-20 w-full rounded-2xl border px-3 py-2" placeholder="请输入详细地址">${escapeHtml(state.draft.address)}</textarea>
            </label>
            ${renderField('可开始合作时间', `<input ${readonly ? 'disabled' : ''} type="date" data-pda-onboarding-field="availableStartDate" value="${escapeHtml(state.draft.availableStartDate)}" class="h-10 w-full rounded-2xl border px-3" />`, true)}
          </div>
        </section>

        <section class="rounded-2xl border bg-card p-3 shadow-sm">
          <h3 class="text-sm font-semibold">人员与机器</h3>
          <div data-testid="pda-onboarding-workers-section" class="mt-3 grid grid-cols-2 gap-3 text-xs">
            ${renderField('有效工人数量', `<input ${readonly ? 'disabled' : ''} type="number" min="1" data-pda-onboarding-field="effectiveWorkerCount" value="${state.draft.effectiveWorkerCount || ''}" class="h-10 w-full rounded-2xl border px-3" />`, true)}
            ${renderField('机器总数', `<input ${readonly ? 'disabled' : ''} type="number" min="1" data-pda-onboarding-field="machineTotalCount" value="${state.draft.machineTotalCount || ''}" class="h-10 w-full rounded-2xl border px-3" />`, true)}
          </div>
        </section>

        ${renderCapabilityPicker(readonly)}
        ${renderFactoryTypeMatchCard()}
        ${renderMachineTable(readonly)}
        ${renderReadonlySummary()}
        ${renderActionArea(application)}
        ${renderRecords(application)}
      </div>
    </section>
  `
}

export function renderPdaOnboardingPage(): string {
  const application = syncPageState()
  return renderOnboardingBody(application)
}

function removeCapability(index: number): void {
  state.draft.selectedCapabilities.splice(index, 1)
  syncMachineValidation()
}

function toggleCapability(processCode: string, craftCode: string): void {
  const capability = createCapabilityFromSelection(processCode, craftCode)
  if (!capability) return
  const existingIndex = state.draft.selectedCapabilities.findIndex((item) => item.processCode === processCode && item.craftCode === craftCode)
  if (existingIndex >= 0) {
    removeCapability(existingIndex)
    return
  }
  state.draft.selectedCapabilities.push(capability)
  syncMachineValidation()
}

function updateMachineDraft(index: number, field: keyof FactoryOnboardingMachineAbility, value: string): void {
  const machine = state.draft.machines[index]
  if (!machine) return
  if (field === 'machineCount') {
    machine.machineCount = Number(value) || 0
    syncMachineValidation()
    return
  }
  if (field === 'linkedProcessCode') {
    machine.linkedProcessCode = value
    machine.linkedProcessName = getSelectedProcessOptions().find((item) => item.processCode === value)?.processName || ''
    machine.linkedCraftCode = ''
    machine.linkedCraftName = ''
    syncMachineValidation()
    return
  }
  if (field === 'linkedCraftCode') {
    machine.linkedCraftCode = value
    machine.linkedCraftName = getSelectedCraftOptions(machine.linkedProcessCode).find((item) => item.craftCode === value)?.craftName || ''
    syncMachineValidation()
    return
  }
  if (field === 'condition') {
    machine.condition = value as FactoryOnboardingMachineAbility['condition']
    syncMachineValidation()
    return
  }
  ;(machine[field] as string) = value
  syncMachineValidation()
}

function updateDraftField(field: string, value: string): void {
  if (field === 'confirmPassword') {
    state.confirmPassword = value
    return
  }
  if (field.startsWith('admin-')) {
    const adminField = field.replace('admin-', '') as keyof FactoryOnboardingDraftPayload['adminAccount']
    ;(state.draft.adminAccount[adminField] as string) = value
    return
  }
  if (field === 'effectiveWorkerCount' || field === 'machineTotalCount') {
    ;(state.draft[field] as number) = Number(value) || 0
    return
  }
  ;(state.draft[field as keyof FactoryOnboardingDraftPayload] as string) = value

  if (field === 'bossName' && !state.draft.adminAccount.adminName) {
    state.draft.adminAccount.adminName = value
  }
  if (field === 'whatsapp' && !state.draft.adminAccount.whatsapp) {
    state.draft.adminAccount.whatsapp = value
  }
}

async function handleSaveDraft(): Promise<void> {
  state.errorText = ''
  state.successText = ''
  try {
    syncMachineValidation()
    const saved = saveFactoryOnboardingDraft(state.draft, state.confirmPassword)
    hydrateDraftFromApplication(saved)
    state.successText = '草稿已保存'
  } catch (error) {
    state.errorText = error instanceof Error ? error.message : '请先补全入驻信息'
  }
}

async function handleSubmit(): Promise<void> {
  state.errorText = ''
  state.successText = ''
  try {
    syncMachineValidation()
    const saved = submitFactoryOnboardingApplication(state.draft, state.confirmPassword)
    hydrateDraftFromApplication(saved)
    activateOnboardingSession(saved)
    state.successText = saved.status === '已重新提交待审核' ? '已重新提交入驻申请' : '已提交入驻申请'
  } catch (error) {
    state.errorText = error instanceof Error ? error.message : '请先补全入驻信息'
  }
}

export async function handlePdaOnboardingEvent(target: HTMLElement): Promise<boolean> {
  const fieldNode = target.closest<HTMLElement>('[data-pda-onboarding-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement || fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pdaOnboardingField || ''
    updateDraftField(field, fieldNode.value)
    return true
  }

  const machineFieldNode = target.closest<HTMLElement>('[data-pda-onboarding-machine-field]')
  if (machineFieldNode instanceof HTMLInputElement || machineFieldNode instanceof HTMLTextAreaElement || machineFieldNode instanceof HTMLSelectElement) {
    const index = Number(machineFieldNode.dataset.pdaOnboardingMachineIndex || '-1')
    const field = machineFieldNode.dataset.pdaOnboardingMachineField as keyof FactoryOnboardingMachineAbility
    if (index >= 0 && field) {
      updateMachineDraft(index, field, machineFieldNode.value)
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-onboarding-action]')
  const action = actionNode?.dataset.pdaOnboardingAction
  if (!action) return false

  if (action === 'goto-login') {
    appStore.navigate('/fcs/pda/auth/login')
    return true
  }

  if (action === 'logout') {
    logoutPdaAccess()
    appStore.navigate('/fcs/pda/auth/login', { historyMode: 'replace' })
    return true
  }

  if (action === 'select-process') {
    state.selectedProcessCode = actionNode?.dataset.processCode || state.selectedProcessCode
    return true
  }

  if (action === 'toggle-capability') {
    toggleCapability(actionNode?.dataset.processCode || '', actionNode?.dataset.craftCode || '')
    return true
  }

  if (action === 'remove-capability') {
    removeCapability(Number(actionNode?.dataset.capabilityIndex || '-1'))
    return true
  }

  if (action === 'toggle-completeness-items') {
    state.showCompletenessItems = !state.showCompletenessItems
    return true
  }

  if (action === 'add-machine') {
    state.draft.machines.push(createDefaultMachineDraft(state.draft.machines.length + 1))
    syncMachineValidation()
    return true
  }

  if (action === 'remove-machine') {
    const index = Number(actionNode?.dataset.machineIndex || '-1')
    if (index >= 0) state.draft.machines.splice(index, 1)
    syncMachineValidation()
    return true
  }

  if (action === 'save-draft') {
    await handleSaveDraft()
    return true
  }

  if (action === 'submit') {
    await handleSubmit()
    return true
  }

  return false
}
