import { escapeHtml } from '../utils'
import {
  FACTORY_ONBOARDING_NODE_OPTIONS,
  FACTORY_ONBOARDING_REQUIRED_FIELD_OPTIONS,
  FACTORY_ONBOARDING_STATUS_OPTIONS,
  type FactoryOnboardingApplication,
  type FactoryOnboardingRequiredField,
  type FactoryOnboardingReviewResult,
} from '../data/fcs/factory-onboarding-domain.ts'
import {
  confirmFactoryOnboardingCooperation,
  getFactoryOnboardingCurrentNodeSummary,
  getLatestReviewRecord,
  listFactoryOnboardingStatusBuckets,
  listSelectableProcessCraftOptions,
  reviewFactoryOnboardingApplication,
} from '../data/fcs/factory-onboarding-flow.ts'
import { listFactoryOnboardingApplications } from '../data/fcs/factory-onboarding-store.ts'

interface FactoryOnboardingPageState {
  statusFilter: string
  processFilter: string
  craftFilter: string
  nodeFilter: string
  reviewResultFilter: string
  keyword: string
  selectedApplicationId: string | null
  detailTab: 'basic' | 'account' | 'capability' | 'machines' | 'flow' | 'review' | 'supplement' | 'transfer'
  reviewApplicationId: string | null
  reviewResult: FactoryOnboardingReviewResult
  reviewOpinion: string
  reviewRequiredFields: FactoryOnboardingRequiredField[]
  confirmApplicationId: string | null
  errorText: string
  successText: string
}

const state: FactoryOnboardingPageState = {
  statusFilter: 'ALL',
  processFilter: 'ALL',
  craftFilter: 'ALL',
  nodeFilter: 'ALL',
  reviewResultFilter: 'ALL',
  keyword: '',
  selectedApplicationId: null,
  detailTab: 'basic',
  reviewApplicationId: null,
  reviewResult: '通过',
  reviewOpinion: '',
  reviewRequiredFields: [],
  confirmApplicationId: null,
  errorText: '',
  successText: '',
}

function getCurrentSearchParams(): URLSearchParams {
  if (window.location.hash) {
    const [, hashQuery] = window.location.hash.slice(1).split('?')
    return new URLSearchParams(hashQuery || '')
  }
  return new URLSearchParams(window.location.search || '')
}

function syncDialogStateFromQuery(applications: FactoryOnboardingApplication[]): void {
  if (state.selectedApplicationId || state.reviewApplicationId || state.confirmApplicationId) return
  const applicationId = getCurrentSearchParams().get('applicationId')
  const dialog = getCurrentSearchParams().get('dialog')
  const detailTab = getCurrentSearchParams().get('tab')
  if (!applicationId || !dialog) return
  const application = applications.find((item) => item.applicationId === applicationId)
  if (!application) return

  if (dialog === 'detail') {
    state.selectedApplicationId = applicationId
    if (detailTab && ['basic', 'account', 'capability', 'machines', 'flow', 'review', 'supplement', 'transfer'].includes(detailTab)) {
      state.detailTab = detailTab as FactoryOnboardingPageState['detailTab']
    }
    return
  }
  if (dialog === 'review') {
    if (application.status !== '已提交待审核' && application.status !== '已重新提交待审核') return
    state.reviewApplicationId = applicationId
    state.reviewResult = '通过'
    state.reviewOpinion = ''
    state.reviewRequiredFields = []
    return
  }
  if (dialog === 'confirm') {
    if (application.status !== '审核通过待确认合作') return
    state.confirmApplicationId = applicationId
  }
}

function listApplications(): FactoryOnboardingApplication[] {
  return listFactoryOnboardingApplications()
}

function getSelectedApplication(): FactoryOnboardingApplication | null {
  return listApplications().find((item) => item.applicationId === state.selectedApplicationId) || null
}

function getLatestActionName(application: FactoryOnboardingApplication): string {
  const action = application.actionLogs[application.actionLogs.length - 1]
  return action?.actionName || '—'
}

function getPrimaryFactoryTypeLabel(code: string): string {
  const map: Record<string, string> = {
    CUTTING_FACTORY: '裁床厂',
    PRINTING_FACTORY: '印花厂',
    DYEING_FACTORY: '染厂',
    POST_FINISHING_FACTORY: '后道工厂',
    SPECIAL_CRAFT_FACTORY: '特殊工艺厂',
    SEWING_FACTORY: '车缝厂',
    MULTI_CAPABILITY_FACTORY: '全能力工厂',
  }
  return map[code] || code || '—'
}

function renderStatusChip(label: string): string {
  const className =
    label === '已合作'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : label === '已拒绝'
        ? 'border-red-200 bg-red-50 text-red-700'
        : label.includes('审核通过')
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : label.includes('退回')
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-border bg-muted text-muted-foreground'
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-[11px] ${className}">${escapeHtml(label)}</span>`
}

function filterApplications(applications: FactoryOnboardingApplication[]): FactoryOnboardingApplication[] {
  return applications.filter((item) => {
    if (state.statusFilter !== 'ALL' && item.status !== state.statusFilter) return false
    if (state.nodeFilter !== 'ALL' && item.currentNode !== state.nodeFilter) return false
    if (state.reviewResultFilter !== 'ALL') {
      const latestReview = getLatestReviewRecord(item)
      if (latestReview?.reviewResult !== state.reviewResultFilter) return false
    }
    if (state.processFilter !== 'ALL' && !item.selectedCapabilities.some((cap) => cap.processCode === state.processFilter)) return false
    if (state.craftFilter !== 'ALL' && !item.selectedCapabilities.some((cap) => cap.craftCode === state.craftFilter)) return false
    if (state.keyword) {
      const text = [
        item.applicationNo,
        item.factoryName,
        item.bossName,
        item.whatsapp,
        ...item.selectedCapabilities.map((cap) => `${cap.processName}${cap.craftName}`),
      ].join('|').toLowerCase()
      if (!text.includes(state.keyword.toLowerCase())) return false
    }
    return true
  })
}

function renderStatCards(): string {
  const buckets = listFactoryOnboardingStatusBuckets()
  return `
    <section class="grid grid-cols-2 gap-3 xl:grid-cols-5">
      ${Object.entries(buckets).map(([label, count]) => `
        <article class="rounded-2xl border bg-card px-4 py-3 shadow-sm">
          <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
          <div class="mt-2 text-2xl font-semibold">${count}</div>
        </article>
      `).join('')}
    </section>
  `
}

function renderFilters(): string {
  const processOptions = listSelectableProcessCraftOptions()
  const craftOptions = state.processFilter !== 'ALL'
    ? (processOptions.find((item) => item.processCode === state.processFilter)?.crafts || [])
    : processOptions.flatMap((item) => item.crafts)
  return `
    <section class="rounded-2xl border bg-card p-4 shadow-sm">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label class="space-y-1 text-xs">
          <span class="font-medium">当前状态</span>
          <select data-factory-onboarding-field="statusFilter" class="h-10 w-full rounded-xl border px-3">
            <option value="ALL">全部状态</option>
            ${FACTORY_ONBOARDING_STATUS_OPTIONS.map((item) => `<option value="${escapeHtml(item)}" ${state.statusFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-xs">
          <span class="font-medium">当前节点</span>
          <select data-factory-onboarding-field="nodeFilter" class="h-10 w-full rounded-xl border px-3">
            <option value="ALL">全部节点</option>
            ${FACTORY_ONBOARDING_NODE_OPTIONS.map((item) => `<option value="${escapeHtml(item)}" ${state.nodeFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-xs">
          <span class="font-medium">审核结果</span>
          <select data-factory-onboarding-field="reviewResultFilter" class="h-10 w-full rounded-xl border px-3">
            <option value="ALL">全部审核结果</option>
            ${['通过', '不通过且允许再次提交', '不通过且不允许再次提交'].map((item) => `<option value="${escapeHtml(item)}" ${state.reviewResultFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-xs">
          <span class="font-medium">工序</span>
          <select data-factory-onboarding-field="processFilter" class="h-10 w-full rounded-xl border px-3">
            <option value="ALL">全部工序</option>
            ${processOptions.map((item) => `<option value="${escapeHtml(item.processCode)}" ${state.processFilter === item.processCode ? 'selected' : ''}>${escapeHtml(item.processName)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-xs">
          <span class="font-medium">工艺</span>
          <select data-factory-onboarding-field="craftFilter" class="h-10 w-full rounded-xl border px-3">
            <option value="ALL">全部工艺</option>
            ${craftOptions.map((item) => `<option value="${escapeHtml(item.craftCode)}" ${state.craftFilter === item.craftCode ? 'selected' : ''}>${escapeHtml(item.craftName)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-xs">
          <span class="font-medium">关键词</span>
          <input data-factory-onboarding-field="keyword" value="${escapeHtml(state.keyword)}" class="h-10 w-full rounded-xl border px-3" placeholder="申请编号 / 工厂名称 / 联系方式" />
        </label>
      </div>
    </section>
  `
}

function renderApplicationTable(applications: FactoryOnboardingApplication[]): string {
  return `
    <section class="rounded-2xl border bg-card p-4 shadow-sm">
      ${state.errorText ? `<div class="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(state.errorText)}</div>` : ''}
      ${state.successText ? `<div class="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">${escapeHtml(state.successText)}</div>` : ''}
      <div class="overflow-x-auto">
        <table data-testid="factory-onboarding-table" class="min-w-full text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">入驻申请编号</th>
              <th class="px-3 py-2 text-left font-medium">工厂名称</th>
              <th class="px-3 py-2 text-left font-medium">老板名字</th>
              <th class="px-3 py-2 text-left font-medium">WhatsApp</th>
              <th class="px-3 py-2 text-left font-medium">资料完整性评分</th>
              <th class="px-3 py-2 text-left font-medium">匹配工厂类型</th>
              <th class="px-3 py-2 text-left font-medium">选择工序工艺</th>
              <th class="px-3 py-2 text-left font-medium">机器总数</th>
              <th class="px-3 py-2 text-left font-medium">有效工人数量</th>
              <th class="px-3 py-2 text-left font-medium">当前节点</th>
              <th class="px-3 py-2 text-left font-medium">当前状态</th>
              <th class="px-3 py-2 text-left font-medium">当前节点耗时</th>
              <th class="px-3 py-2 text-left font-medium">当前节点动作次数</th>
              <th class="px-3 py-2 text-left font-medium">最近动作</th>
              <th class="px-3 py-2 text-left font-medium">最近审核结果</th>
              <th class="px-3 py-2 text-left font-medium">提交时间</th>
              <th class="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${applications.length > 0 ? applications.map((item) => {
              const summary = getFactoryOnboardingCurrentNodeSummary(item)
              const latestReview = getLatestReviewRecord(item)
              const canReview = item.status === '已提交待审核' || item.status === '已重新提交待审核'
              const canConfirm = item.status === '审核通过待确认合作'
              return `
                <tr class="border-t align-top">
                  <td class="px-3 py-3">${escapeHtml(item.applicationNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.bossName)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.whatsapp)}</td>
                  <td class="px-3 py-3">${item.completenessScore} 分 / ${escapeHtml(item.completenessLevel)}</td>
                  <td class="px-3 py-3">${escapeHtml(getPrimaryFactoryTypeLabel(item.primaryFactoryType))}</td>
                  <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(item.selectedCapabilities.map((cap) => `${cap.processName}/${cap.craftName}`).join('、'))}</td>
                  <td class="px-3 py-3">${item.machineTotalCount}</td>
                  <td class="px-3 py-3">${item.effectiveWorkerCount}</td>
                  <td class="px-3 py-3">${escapeHtml(item.currentNode)}</td>
                  <td class="px-3 py-3">${renderStatusChip(item.status)}</td>
                  <td class="px-3 py-3">${escapeHtml(summary.elapsedText)}</td>
                  <td class="px-3 py-3">${escapeHtml(summary.actionCountText)}</td>
                  <td class="px-3 py-3">${escapeHtml(getLatestActionName(item))}</td>
                  <td class="px-3 py-3">${escapeHtml(latestReview?.reviewResult || '—')}</td>
                  <td class="px-3 py-3">${escapeHtml(item.submittedAt || '—')}</td>
                  <td class="px-3 py-3">
                    <div class="flex flex-wrap gap-2">
                      <button type="button" class="rounded-full border px-3 py-1 text-xs" data-factory-onboarding-action="view-detail" data-application-id="${item.applicationId}">查看</button>
                      ${canReview ? `<button type="button" class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700" data-factory-onboarding-action="open-review" data-application-id="${item.applicationId}">审核</button>` : ''}
                      ${canConfirm ? `<button type="button" class="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700" data-factory-onboarding-action="open-confirm" data-application-id="${item.applicationId}">确认合作</button>` : ''}
                    </div>
                  </td>
                </tr>
              `
            }).join('') : '<tr><td colspan="17" class="px-3 py-10 text-center text-sm text-muted-foreground">当前没有符合条件的入驻申请</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderDetailDrawer(application: FactoryOnboardingApplication | null): string {
  if (!application) return ''
  const summary = getFactoryOnboardingCurrentNodeSummary(application)
  const tabs = [
    ['basic', '基础信息'],
    ['account', '账号信息'],
    ['capability', '工序工艺能力'],
    ['machines', '机器能力'],
    ['flow', '流程记录'],
    ['review', '审核记录'],
    ['supplement', '补充记录'],
    ['transfer', '转档记录'],
  ] as const
  let body = ''

  if (state.detailTab === 'basic') {
    body = `
        <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-xl border px-3 py-2">工厂名称：${escapeHtml(application.factoryName)}</div>
        <div class="rounded-xl border px-3 py-2">老板名字：${escapeHtml(application.bossName)}</div>
        <div class="rounded-xl border px-3 py-2">WhatsApp：${escapeHtml(application.whatsapp)}</div>
        <div class="rounded-xl border px-3 py-2">有效工人数量：${application.effectiveWorkerCount}</div>
        <div class="rounded-xl border px-3 py-2">机器总数：${application.machineTotalCount}</div>
        <div class="rounded-xl border px-3 py-2">可开始合作时间：${escapeHtml(application.availableStartDate)}</div>
        <div class="rounded-xl border px-3 py-2">当前状态：${escapeHtml(application.status)}</div>
        <div class="rounded-xl border px-3 py-2">当前节点：${escapeHtml(application.currentNode)}</div>
        <div class="rounded-xl border px-3 py-2">资料完整性评分：${application.completenessScore} 分</div>
        <div class="rounded-xl border px-3 py-2">完整性等级：${escapeHtml(application.completenessLevel)}</div>
        <div class="col-span-2 rounded-xl border px-3 py-2">地址：${escapeHtml(application.address)}</div>
        <div class="col-span-2 rounded-xl border px-3 py-2">当前节点耗时：${escapeHtml(summary.elapsedText)} · 当前节点动作次数：${escapeHtml(summary.actionCountText)} · 最近动作：${escapeHtml(summary.lastActionName)}</div>
        <div class="col-span-2 rounded-xl border px-3 py-2">缺失项：${escapeHtml(application.completenessItems.filter((item) => !item.isCompleted).map((item) => `${item.itemName}（${item.missingReason}）`).join('、') || '无')}</div>
      </div>
    `
  } else if (state.detailTab === 'account') {
    body = `
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-xl border px-3 py-2">登录账户：${escapeHtml(application.adminAccount.loginId)}</div>
        <div class="rounded-xl border px-3 py-2">管理员姓名：${escapeHtml(application.adminAccount.adminName)}</div>
        <div class="rounded-xl border px-3 py-2">管理员 WhatsApp：${escapeHtml(application.adminAccount.whatsapp)}</div>
        <div class="rounded-xl border px-3 py-2">账号状态：${escapeHtml(application.adminAccount.accountStatus)}</div>
        <div class="col-span-2 rounded-xl border px-3 py-2 text-muted-foreground">登录密码：不展示明文密码</div>
      </div>
    `
  } else if (state.detailTab === 'capability') {
    body = `
      <div class="mb-3 grid gap-3 text-sm">
        <div class="rounded-xl border px-3 py-2">系统匹配工厂类型：${escapeHtml(getPrimaryFactoryTypeLabel(application.primaryFactoryType))}</div>
        <div class="rounded-xl border px-3 py-2">匹配依据：${escapeHtml(application.factoryTypeMatchReason || '—')}</div>
      </div>
      <table class="min-w-full text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground"><tr><th class="px-3 py-2 text-left font-medium">工序</th><th class="px-3 py-2 text-left font-medium">工艺</th><th class="px-3 py-2 text-left font-medium">是否可接任务</th><th class="px-3 py-2 text-left font-medium">是否纳入产能</th></tr></thead>
        <tbody>
          ${application.selectedCapabilities.map((item) => `
            <tr class="border-t"><td class="px-3 py-2">${escapeHtml(item.processName)}</td><td class="px-3 py-2">${escapeHtml(item.craftName)}</td><td class="px-3 py-2">${item.canReceiveTask ? '是' : '否'}</td><td class="px-3 py-2">${item.capacityManaged ? '是' : '否'}</td></tr>
          `).join('')}
        </tbody>
      </table>
    `
  } else if (state.detailTab === 'machines') {
    body = `
      <table class="min-w-full text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground"><tr><th class="px-3 py-2 text-left font-medium">机器名称</th><th class="px-3 py-2 text-left font-medium">机器编号</th><th class="px-3 py-2 text-left font-medium">数量</th><th class="px-3 py-2 text-left font-medium">关联工序</th><th class="px-3 py-2 text-left font-medium">关联工艺</th><th class="px-3 py-2 text-left font-medium">状态</th><th class="px-3 py-2 text-left font-medium">校验状态</th><th class="px-3 py-2 text-left font-medium">备注</th></tr></thead>
        <tbody>
          ${application.machines.map((item) => `
            <tr class="border-t"><td class="px-3 py-2">${escapeHtml(item.machineName)}</td><td class="px-3 py-2">${escapeHtml(item.machineNo || '—')}</td><td class="px-3 py-2">${item.machineCount}</td><td class="px-3 py-2">${escapeHtml(item.linkedProcessName || '—')}</td><td class="px-3 py-2">${escapeHtml(item.linkedCraftName || '—')}</td><td class="px-3 py-2">${escapeHtml(item.condition)}</td><td class="px-3 py-2">${escapeHtml(item.validationStatus)}</td><td class="px-3 py-2">${escapeHtml(item.remark || item.validationMessage || '—')}</td></tr>
          `).join('')}
        </tbody>
      </table>
    `
  } else if (state.detailTab === 'flow') {
    body = `
      <div class="space-y-4">
        <section>
          <div class="mb-2 text-sm font-medium">流程记录</div>
          <div class="space-y-2">
            ${application.nodeLogs.map((item) => `
              <article class="rounded-xl border px-3 py-2 text-sm">
                <div class="flex items-center justify-between gap-2">
                  <div class="font-medium">${escapeHtml(item.nodeName)}</div>
                  ${renderStatusChip(item.nodeStatus)}
                </div>
                <div class="mt-1 text-muted-foreground">进入时间：${escapeHtml(item.enteredAt)} · 离开时间：${escapeHtml(item.leftAt || '进行中')}</div>
                <div class="mt-1 text-muted-foreground">节点耗时：${escapeHtml(item.elapsedText)} · 动作次数：第${item.actionCount}次动作</div>
                <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(item.operator)} · 上次动作时间：${escapeHtml(item.lastActionAt || '—')}</div>
                <div class="mt-1 text-muted-foreground">备注：${escapeHtml(item.remark || '—')}</div>
              </article>
            `).join('')}
          </div>
        </section>
        <section>
          <div class="mb-2 text-sm font-medium">动作记录区</div>
          <div class="space-y-2">
            ${application.actionLogs.map((item) => `
              <article class="rounded-xl border px-3 py-2 text-sm">
                <div class="font-medium">${escapeHtml(item.actionName)}</div>
                <div class="mt-1 text-muted-foreground">所属节点：${escapeHtml(item.nodeName)} · 节点内第${item.actionSequenceInNode}次动作</div>
                <div class="mt-1 text-muted-foreground">变更前状态：${escapeHtml(item.fromStatus)} · 变更后状态：${escapeHtml(item.toStatus)}</div>
                <div class="mt-1 text-muted-foreground">变更前节点：${escapeHtml(item.fromNode)} · 变更后节点：${escapeHtml(item.toNode)}</div>
                <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(item.operator)} · 操作时间：${escapeHtml(item.operatedAt)}</div>
                <div class="mt-1 text-muted-foreground">备注：${escapeHtml(item.remark || '—')}</div>
              </article>
            `).join('')}
          </div>
        </section>
      </div>
    `
  } else if (state.detailTab === 'review') {
    body = application.reviewRecords.length > 0 ? application.reviewRecords.map((item) => `
      <article class="rounded-xl border px-3 py-2 text-sm">
        <div class="font-medium">第${item.reviewRoundNo}轮 · ${escapeHtml(item.reviewResult)}</div>
        <div class="mt-1 text-muted-foreground">审核意见：${escapeHtml(item.reviewOpinion)}</div>
        <div class="mt-1 text-muted-foreground">是否允许再次提交：${item.allowResubmit ? '是' : '否'}</div>
        <div class="mt-1 text-muted-foreground">审核人：${escapeHtml(item.reviewer)} · 审核时间：${escapeHtml(item.reviewedAt)}</div>
        <div class="mt-1 text-muted-foreground">变更前状态：${escapeHtml(item.fromStatus)} · 变更后状态：${escapeHtml(item.toStatus)}</div>
        <div class="mt-1 text-muted-foreground">变更前节点：${escapeHtml(item.fromNode)} · 变更后节点：${escapeHtml(item.toNode)}</div>
      </article>
    `).join('') : '<div class="rounded-xl border border-dashed px-3 py-6 text-sm text-muted-foreground">暂无审核记录</div>'
  } else if (state.detailTab === 'supplement') {
    body = application.supplementRecords.length > 0 ? application.supplementRecords.map((item) => `
      <article class="rounded-xl border px-3 py-2 text-sm">
        <div class="font-medium">第${item.supplementRoundNo}轮 · ${escapeHtml(item.status)}</div>
        <div class="mt-1 text-muted-foreground">退回原因：${escapeHtml(item.supplementReason)}</div>
        <div class="mt-1 text-muted-foreground">需补充字段：${escapeHtml(item.requiredFields.join('、') || '—')}</div>
        <div class="mt-1 text-muted-foreground">已提交字段：${escapeHtml(item.submittedFields.join('、') || '—')}</div>
        <div class="mt-1 text-muted-foreground">补充提交时间：${escapeHtml(item.submittedAt || '—')} · 提交人：${escapeHtml(item.submittedBy || '—')}</div>
      </article>
    `).join('') : '<div class="rounded-xl border border-dashed px-3 py-6 text-sm text-muted-foreground">暂无补充记录</div>'
  } else {
    body = application.transferRecords.length > 0 ? application.transferRecords.map((item) => `
      <article class="rounded-xl border px-3 py-2 text-sm">
        <div class="font-medium">工厂档案：${item.factoryProfileGenerated ? '已生成' : '未生成'}</div>
        <div class="mt-1 text-muted-foreground">工厂档案编号：${escapeHtml(item.factoryProfileId || '—')}</div>
        <div class="mt-1 text-muted-foreground">管理员账号：${item.adminAccountGenerated ? '已生成 / 已转正' : '未生成'}</div>
        <div class="mt-1 text-muted-foreground">产能档案：${item.capacityProfileGenerated ? '已生成' : '未生成'}${item.capacityProfileId ? ` · ${escapeHtml(item.capacityProfileId)}` : ''}</div>
        <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(item.operator)} · 操作时间：${escapeHtml(item.operatedAt)}</div>
        <div class="mt-1 text-muted-foreground">备注：${escapeHtml(item.remark || '—')}</div>
        ${item.capacityProfileGenerated && application.createdFactoryId ? `<button type="button" class="mt-3 rounded-full border px-3 py-1 text-xs" data-nav="/fcs/factories/capacity-profile?factoryId=${escapeHtml(application.createdFactoryId)}">查看产能档案</button>` : ''}
      </article>
    `).join('') : '<div class="rounded-xl border border-dashed px-3 py-6 text-sm text-muted-foreground">暂无转档记录</div>'
  }

  return `
    <div class="fixed inset-0 z-40" data-factory-onboarding-dialog="detail">
      <button type="button" class="absolute inset-0 bg-black/35" data-factory-onboarding-action="close-detail"></button>
      <aside class="absolute right-0 top-0 h-full w-full max-w-4xl overflow-y-auto border-l bg-background shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-background px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold">工厂入驻详情</h2>
              <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(application.applicationNo)} · ${escapeHtml(application.factoryName)}</p>
            </div>
            <button type="button" class="rounded-full border px-3 py-1 text-xs" data-factory-onboarding-action="close-detail">关闭</button>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            ${tabs.map(([key, label]) => `<button type="button" class="rounded-full border px-3 py-1.5 text-xs ${state.detailTab === key ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-border bg-background text-muted-foreground'}" data-factory-onboarding-action="switch-detail-tab" data-tab="${key}">${label}</button>`).join('')}
          </div>
        </div>
        <div class="space-y-3 p-5">${body}</div>
      </aside>
    </div>
  `
}

function renderReviewDialog(application: FactoryOnboardingApplication | null): string {
  if (!application) return ''
  const needFields = state.reviewResult === '不通过且允许再次提交'
  return `
    <div class="fixed inset-0 z-50" data-factory-onboarding-dialog="review">
      <button type="button" class="absolute inset-0 bg-black/35" data-factory-onboarding-action="close-review"></button>
      <section class="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-5 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">审核入驻申请</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-factory-onboarding-action="close-review">关闭</button>
        </div>
        <div class="mt-4 space-y-3 text-sm">
          <div class="rounded-xl border bg-muted/20 px-3 py-2">申请编号：${escapeHtml(application.applicationNo)}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">工厂名称：${escapeHtml(application.factoryName)}</div>
          <label class="block space-y-2">
            <span class="text-sm font-medium">审核结果</span>
            <div class="space-y-2">
              ${['通过', '不通过且允许再次提交', '不通过且不允许再次提交'].map((item) => `
                <label class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <input type="radio" name="factory-onboarding-review-result" value="${item}" data-factory-onboarding-field="reviewResult" ${state.reviewResult === item ? 'checked' : ''} />
                  <span>${item}</span>
                </label>
              `).join('')}
            </div>
          </label>
          <label class="block space-y-2">
            <span class="text-sm font-medium">审核意见</span>
            <textarea data-factory-onboarding-field="reviewOpinion" class="min-h-28 w-full rounded-2xl border px-3 py-2" placeholder="请输入审核意见">${escapeHtml(state.reviewOpinion)}</textarea>
          </label>
          ${needFields ? `
            <div class="space-y-2" data-testid="factory-onboarding-required-fields">
              <div class="text-sm font-medium">需补充字段</div>
              <div class="grid grid-cols-2 gap-2">
                ${FACTORY_ONBOARDING_REQUIRED_FIELD_OPTIONS.map((field) => `
                  <label class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                    <input type="checkbox" value="${escapeHtml(field)}" data-factory-onboarding-field="reviewRequiredField" ${state.reviewRequiredFields.includes(field) ? 'checked' : ''} />
                    <span>${escapeHtml(field)}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          ` : ''}
          <div class="rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">是否允许再次提交：${state.reviewResult === '不通过且允许再次提交' ? '是' : state.reviewResult === '不通过且不允许再次提交' ? '否' : '不适用'}</div>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded-xl border px-4 py-2 text-sm" data-factory-onboarding-action="close-review">取消</button>
          <button type="button" class="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground" data-factory-onboarding-action="submit-review">确认审核</button>
        </div>
      </section>
    </div>
  `
}

function renderConfirmDialog(application: FactoryOnboardingApplication | null): string {
  if (!application) return ''
  return `
    <div class="fixed inset-0 z-50" data-factory-onboarding-dialog="confirm">
      <button type="button" class="absolute inset-0 bg-black/35" data-factory-onboarding-action="close-confirm"></button>
      <section class="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-5 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">确认合作并生成工厂档案</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-factory-onboarding-action="close-confirm">关闭</button>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-xl border px-3 py-2">工厂名称：${escapeHtml(application.factoryName)}</div>
          <div class="rounded-xl border px-3 py-2">老板名字：${escapeHtml(application.bossName)}</div>
          <div class="rounded-xl border px-3 py-2">WhatsApp：${escapeHtml(application.whatsapp)}</div>
          <div class="rounded-xl border px-3 py-2">地址：${escapeHtml(application.address)}</div>
          <div class="col-span-2 rounded-xl border px-3 py-2">已选工序工艺：${escapeHtml(application.selectedCapabilities.map((item) => `${item.processName}/${item.craftName}`).join('、'))}</div>
          <div class="col-span-2 rounded-xl border px-3 py-2">机器能力：${escapeHtml(application.machines.map((item) => `${item.machineName}×${item.machineCount}（${item.linkedCraftName || '未关联工艺'}）`).join('、'))}</div>
          <div class="col-span-2 rounded-xl border px-3 py-2">管理员账号：${escapeHtml(application.adminAccount.loginId)}</div>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded-xl border px-4 py-2 text-sm" data-factory-onboarding-action="close-confirm">取消</button>
          <button type="button" class="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground" data-factory-onboarding-action="submit-confirm">确认生成</button>
        </div>
      </section>
    </div>
  `
}

export function renderFactoryOnboardingPage(): string {
  syncDialogStateFromQuery(listApplications())
  const applications = filterApplications(listApplications())
  const selectedApplication = getSelectedApplication()
  const reviewApplication = state.reviewApplicationId ? listApplications().find((item) => item.applicationId === state.reviewApplicationId) || null : null
  const confirmApplication = state.confirmApplicationId ? listApplications().find((item) => item.applicationId === state.confirmApplicationId) || null : null
  return `
    <section class="space-y-4 p-6" data-testid="factory-onboarding-page">
      <header>
        <h1 class="text-2xl font-semibold text-foreground">工厂入驻管理</h1>
        <p class="mt-1 text-sm text-muted-foreground">平台统一审核入驻申请，并在确认合作后生成工厂档案与正式管理员账号。</p>
      </header>
      ${renderStatCards()}
      ${renderFilters()}
      ${renderApplicationTable(applications)}
      ${renderDetailDrawer(selectedApplication)}
      ${renderReviewDialog(reviewApplication)}
      ${renderConfirmDialog(confirmApplication)}
    </section>
  `
}

function updateField(field: string, value: string, checked?: boolean): void {
  if (field === 'statusFilter' || field === 'processFilter' || field === 'craftFilter' || field === 'nodeFilter' || field === 'reviewResultFilter' || field === 'keyword') {
    ;(state[field] as string) = value
    if (field === 'processFilter' && value === 'ALL') {
      state.craftFilter = 'ALL'
    }
    return
  }
  if (field === 'reviewResult') {
    state.reviewResult = value as FactoryOnboardingReviewResult
    if (state.reviewResult !== '不通过且允许再次提交') {
      state.reviewRequiredFields = []
    }
    return
  }
  if (field === 'reviewOpinion') {
    state.reviewOpinion = value
    return
  }
  if (field === 'reviewRequiredField') {
    const fieldValue = value as FactoryOnboardingRequiredField
    if (checked) {
      if (!state.reviewRequiredFields.includes(fieldValue)) state.reviewRequiredFields.push(fieldValue)
    } else {
      state.reviewRequiredFields = state.reviewRequiredFields.filter((item) => item !== fieldValue)
    }
  }
}

export async function handleFactoryOnboardingEvent(target: HTMLElement): Promise<boolean> {
  const fieldNode = target.closest<HTMLElement>('[data-factory-onboarding-field]')
  if (fieldNode instanceof HTMLInputElement) {
    updateField(fieldNode.dataset.factoryOnboardingField || '', fieldNode.value, fieldNode.checked)
    return true
  }
  if (fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement) {
    updateField(fieldNode.dataset.factoryOnboardingField || '', fieldNode.value)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-factory-onboarding-action]')
  const action = actionNode?.dataset.factoryOnboardingAction
  if (!action) return false

  if (action === 'view-detail') {
    state.selectedApplicationId = actionNode?.dataset.applicationId || null
    state.detailTab = 'basic'
    return true
  }
  if (action === 'close-detail') {
    state.selectedApplicationId = null
    return true
  }
  if (action === 'switch-detail-tab') {
    state.detailTab = (actionNode?.dataset.tab as FactoryOnboardingPageState['detailTab']) || 'basic'
    return true
  }
  if (action === 'open-review') {
    state.reviewApplicationId = actionNode?.dataset.applicationId || null
    state.reviewResult = '通过'
    state.reviewOpinion = ''
    state.reviewRequiredFields = []
    return true
  }
  if (action === 'close-review') {
    state.reviewApplicationId = null
    return true
  }
  if (action === 'open-confirm') {
    state.confirmApplicationId = actionNode?.dataset.applicationId || null
    return true
  }
  if (action === 'close-confirm') {
    state.confirmApplicationId = null
    return true
  }
  if (action === 'submit-review') {
    state.errorText = ''
    state.successText = ''
    try {
      const updated = reviewFactoryOnboardingApplication({
        applicationId: state.reviewApplicationId || '',
        reviewResult: state.reviewResult,
        reviewOpinion: state.reviewOpinion,
        reviewer: '平台审核员',
        requiredFields: state.reviewRequiredFields,
      })
      state.reviewApplicationId = null
      state.selectedApplicationId = updated.applicationId
      state.detailTab = state.reviewResult === '不通过且允许再次提交' ? 'supplement' : 'review'
      state.successText = '审核结果已保存'
    } catch (error) {
      state.errorText = error instanceof Error ? error.message : '审核失败'
    }
    return true
  }
  if (action === 'submit-confirm') {
    state.errorText = ''
    state.successText = ''
    try {
      const updated = await confirmFactoryOnboardingCooperation({
        applicationId: state.confirmApplicationId || '',
        operator: '平台运营经理',
      })
      state.confirmApplicationId = null
      state.selectedApplicationId = updated.applicationId
      state.detailTab = 'transfer'
      state.successText = '已确认合作并生成工厂档案'
    } catch (error) {
      state.errorText = error instanceof Error ? error.message : '确认合作失败'
    }
    return true
  }

  return false
}

export function isFactoryOnboardingDialogOpen(): boolean {
  return Boolean(state.selectedApplicationId || state.reviewApplicationId || state.confirmApplicationId)
}
