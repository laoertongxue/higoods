import { escapeHtml } from '../utils'
import { buildPdaCuttingRoute, getPdaCuttingTaskDetail } from '../data/fcs/pda-cutting-special'
import {
  renderPdaCuttingEmptyState,
  renderPdaCuttingPageLayout,
  renderPdaCuttingRiskList,
  renderPdaCuttingSection,
  renderPdaCuttingSummaryGrid,
  renderPdaCuttingTaskHero,
} from './pda-cutting-shared'

interface PdaCuttingTaskDetailPageState {
  qrExpanded: boolean
  actionsExpanded: boolean
}

const pageStateStore = new Map<string, PdaCuttingTaskDetailPageState>()

function getPageState(taskId: string): PdaCuttingTaskDetailPageState {
  const existing = pageStateStore.get(taskId)
  if (existing) return existing

  const initial: PdaCuttingTaskDetailPageState = {
    qrExpanded: false,
    actionsExpanded: false,
  }
  pageStateStore.set(taskId, initial)
  return initial
}

function renderStatusChip(label: string, tone: 'slate' | 'green' | 'amber' | 'red' | 'blue'): string {
  const className =
    tone === 'green'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'red'
          ? 'border-red-200 bg-red-50 text-red-700'
          : tone === 'blue'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-slate-50 text-slate-700'

  return `<span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderInfoGrid(items: Array<{ label: string; value: string; hint?: string }>): string {
  return `
    <div class="grid grid-cols-2 gap-3 text-xs">
      ${items
        .map(
          (item) => `
            <article class="rounded-xl border bg-muted/20 px-3 py-3">
              <div class="text-muted-foreground">${escapeHtml(item.label)}</div>
              <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(item.value)}</div>
              ${item.hint ? `<div class="mt-1 text-[11px] leading-5 text-muted-foreground">${escapeHtml(item.hint)}</div>` : ''}
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderRiskFlags(flags: string[]): string {
  if (!flags.length) {
    return `<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-700">当前无明显风险，可按下一步建议继续执行。</div>`
  }

  return `
    <div class="flex flex-wrap gap-2">
      ${flags.map((flag) => renderStatusChip(flag, flag.includes('风险') || flag.includes('待') ? 'amber' : 'slate')).join('')}
    </div>
  `
}

function renderQrSummary(taskId: string, state: PdaCuttingTaskDetailPageState): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  if (!detail) return ''

  const explainBlock = state.qrExpanded
    ? `
        <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs leading-5 text-muted-foreground">
          该二维码绑定的是裁片单号 <span class="font-medium text-foreground">${escapeHtml(detail.cutPieceOrderNo)}</span>，
          后续扫码领料、铺布录入、入仓扫码和交接扫码都沿用同一个二维码对象，不会在现场重复发号。
        </div>
      `
    : ''

  return `
    <div class="space-y-3 text-xs">
      <div class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="text-muted-foreground">二维码状态</div>
            <div class="mt-1 text-sm font-medium text-foreground">${detail.hasQrCode ? '已生成裁片单级二维码' : '未生成二维码'}</div>
          </div>
          ${renderStatusChip(detail.hasQrCode ? '已生成二维码' : '未生成二维码', detail.hasQrCode ? 'green' : 'amber')}
        </div>
        <div class="mt-3 rounded-xl border border-dashed bg-background px-3 py-4 text-center">
          <div class="text-[11px] text-muted-foreground">二维码值</div>
          <div class="mt-1 font-mono text-sm font-semibold tracking-wide text-foreground">${escapeHtml(detail.qrCodeValue)}</div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div class="text-muted-foreground">领料单号</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(detail.pickupSlipNo)}</div>
          </div>
          <div>
            <div class="text-muted-foreground">版本说明</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(detail.qrVersionNote)}</div>
          </div>
        </div>
      </div>
      ${explainBlock}
      <button class="inline-flex min-h-10 w-full items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-pda-cut-task-action="toggle-qr-detail" data-task-id="${escapeHtml(taskId)}">
        ${state.qrExpanded ? '收起二维码说明' : '查看二维码说明'}
      </button>
    </div>
  `
}

function renderRecentActions(taskId: string, state: PdaCuttingTaskDetailPageState): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  if (!detail) return ''

  if (!detail.recentActions.length) {
    return renderPdaCuttingEmptyState('暂无现场动作摘要', '后续扫码领取、铺布录入、入仓扫码、交接扫码和补料反馈都会在这里按时间倒序汇总。')
  }

  const visibleActions = state.actionsExpanded ? detail.recentActions : detail.recentActions.slice(0, 3)

  return `
    <div class="space-y-2">
      ${visibleActions
        .map(
          (action) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  ${renderStatusChip(action.actionTypeLabel, 'blue')}
                  <span class="font-medium text-foreground">${escapeHtml(action.summary)}</span>
                </div>
                <span class="text-[11px] text-muted-foreground">${escapeHtml(action.operatedAt)}</span>
              </div>
              <div class="mt-2 text-muted-foreground">操作人：${escapeHtml(action.operatedBy)}</div>
            </article>
          `,
        )
        .join('')}
      ${
        detail.recentActions.length > 3
          ? `
              <button class="inline-flex min-h-10 w-full items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-pda-cut-task-action="toggle-actions" data-task-id="${escapeHtml(taskId)}">
                ${state.actionsExpanded ? '收起最近动作' : `展开全部 ${detail.recentActions.length} 条动作`}
              </button>
            `
          : ''
      }
    </div>
  `
}

function renderSpecialEntryCards(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  if (!detail) return ''

  const entries = [
    {
      title: '扫码领料',
      summary: detail.currentReceiveStatus,
      description: `查看领料单 ${detail.pickupSlipNo}、二维码与实领结果回写。`,
      href: buildPdaCuttingRoute(taskId, 'pickup'),
    },
    {
      title: '铺布录入',
      summary: detail.currentExecutionStatus,
      description: '维护卷号、层数、长度、布头布尾和多卷铺布记录。',
      href: buildPdaCuttingRoute(taskId, 'spreading'),
    },
    {
      title: '入仓扫码',
      summary: detail.currentInboundStatus,
      description: '确认 A/B/C 区和当前位置，形成最近一次入仓摘要。',
      href: buildPdaCuttingRoute(taskId, 'inbound'),
    },
    {
      title: '交接扫码',
      summary: detail.currentHandoverStatus,
      description: `确认交接去向并回写后续环节：${detail.handoverTargetLabel}。`,
      href: buildPdaCuttingRoute(taskId, 'handover'),
    },
    {
      title: '补料反馈',
      summary: detail.replenishmentRiskSummary,
      description: '反馈现场缺口、照片凭证和补料风险说明，等待 PCS 跟进。',
      href: buildPdaCuttingRoute(taskId, 'replenishment-feedback'),
    },
  ]

  return `
    <div class="grid grid-cols-1 gap-3">
      ${entries
        .map(
          (entry) => `
            <article class="rounded-xl border bg-muted/20 px-3 py-3">
              <div class="flex items-start justify-between gap-3">
                <div class="space-y-1">
                  <div class="text-sm font-semibold text-foreground">${escapeHtml(entry.title)}</div>
                  <div class="text-xs text-muted-foreground">${escapeHtml(entry.description)}</div>
                </div>
                ${renderStatusChip(entry.summary, entry.summary.includes('成功') || entry.summary.includes('已') ? 'green' : 'amber')}
              </div>
              <div class="mt-3 text-xs text-muted-foreground">当前状态：${escapeHtml(entry.summary)}</div>
              <button class="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-nav="${escapeHtml(entry.href)}">
                进入${escapeHtml(entry.title)}
              </button>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

export function renderPdaCuttingTaskDetailPage(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '裁片任务详情',
      subtitle: '用于承接裁片任务的领料、铺布、入仓、交接和补料反馈。',
      activeTab: 'exec',
      body: '',
      backHref: '/fcs/pda/exec',
    })
  }

  const state = getPageState(taskId)

  const summaryGrid = renderPdaCuttingSummaryGrid([
    { label: '当前状态', value: detail.taskStatusLabel, hint: detail.currentStage },
    { label: '下一步建议', value: detail.nextRecommendedAction, hint: detail.currentActionHint },
    { label: '领料摘要', value: detail.receiveSummary, hint: detail.currentReceiveStatus },
    { label: '交接摘要', value: detail.handoverSummary, hint: detail.currentHandoverStatus },
  ])

  const basicInfoSection = renderInfoGrid([
    { label: '任务编号', value: detail.taskNo },
    { label: '任务类型', value: detail.taskTypeLabel },
    { label: '生产单号', value: detail.productionOrderNo },
    { label: '裁片单号', value: detail.cutPieceOrderNo },
    { label: '分配工厂', value: detail.assigneeFactoryName },
    { label: '下单数量', value: `${detail.orderQty} 件` },
    { label: '当前状态', value: detail.taskStatusLabel },
    { label: '当前执行人', value: detail.currentOwnerName || '待指派' },
  ])

  const materialSection = `
    ${renderInfoGrid([
      { label: '面料 SKU', value: detail.materialSku },
      { label: '面料类型', value: detail.materialTypeLabel },
      { label: '领料单号', value: detail.pickupSlipNo },
      { label: '领料状态', value: detail.currentReceiveStatus },
      { label: '配置摘要', value: detail.configuredQtyText },
      { label: '领取摘要', value: detail.actualReceivedQtyText },
      {
        label: '二维码状态',
        value: detail.hasQrCode ? '已生成裁片单级二维码' : '未生成二维码',
        hint: detail.qrCodeValue,
      },
      {
        label: '最近一次领料',
        value: detail.latestReceiveAt,
        hint: `操作人：${detail.latestReceiveBy}`,
      },
    ])}
  `

  const executionSection = `
    ${renderInfoGrid([
      {
        label: '铺布状态',
        value: detail.spreadingRecords.length ? '已开始铺布' : '待开始铺布',
        hint: `${detail.spreadingRecords.length} 条记录`,
      },
      {
        label: '最近一次铺布',
        value: detail.latestSpreadingAt,
        hint: `操作人：${detail.latestSpreadingBy}`,
      },
      {
        label: '入仓状态',
        value: detail.currentInboundStatus,
        hint: detail.inboundZoneLabel,
      },
      {
        label: '最近一次入仓',
        value: detail.latestInboundAt,
        hint: `操作人：${detail.latestInboundBy}`,
      },
      {
        label: '交接状态',
        value: detail.currentHandoverStatus,
        hint: detail.handoverTargetLabel,
      },
      {
        label: '最近一次交接',
        value: detail.latestHandoverAt,
        hint: `操作人：${detail.latestHandoverBy}`,
      },
      {
        label: '补料风险',
        value: detail.replenishmentRiskSummary,
        hint: detail.latestFeedbackReason,
      },
      {
        label: '最近一次补料反馈',
        value: detail.latestReplenishmentFeedbackAt,
        hint: `操作人：${detail.latestReplenishmentFeedbackBy}`,
      },
    ])}
  `

  const body = `
    ${renderPdaCuttingTaskHero(detail)}
    <section class="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
      <div class="text-xs text-blue-700">当前阶段提示</div>
      <div class="mt-1 text-sm font-semibold text-blue-900">${escapeHtml(detail.currentActionHint)}</div>
      <div class="mt-2 text-xs text-blue-800">建议下一步：${escapeHtml(detail.nextRecommendedAction)}</div>
    </section>
    ${summaryGrid}
    ${renderPdaCuttingSection('任务基础信息', '用于确认当前裁片任务的任务编号、生产单、裁片单、工厂和责任人。', basicInfoSection)}
    ${renderPdaCuttingSection('面料与领料摘要', '承接面料、领料单、配置数量和最近一次扫码领取摘要，帮助现场先判断是否能继续执行。', materialSection)}
    ${renderPdaCuttingSection('执行进度摘要', '集中查看铺布、入仓、交接与补料反馈的最新状态和最近一次现场回写。', executionSection)}
    ${renderPdaCuttingSection('风险提示', '优先暴露待领料、待铺布、待入仓、待交接和补料风险，帮助现场尽快判断阻塞点。', `
      <div class="space-y-3">
        ${renderRiskFlags(detail.riskFlags)}
        ${renderPdaCuttingRiskList(detail.riskTips)}
      </div>
    `)}
    ${renderPdaCuttingSection('二维码摘要', '这里展示裁片单级二维码和说明文案，强调同一裁片单会贯穿后续领料、执行、入仓和交接。', renderQrSummary(taskId, state))}
    ${renderPdaCuttingSection('最近动作', '汇总最近一次扫码领取、铺布录入、入仓、交接和补料反馈，便于现场快速判断最新执行结果。', renderRecentActions(taskId, state))}
    ${renderPdaCuttingSection('专项操作入口', '裁片任务详情作为裁片专项能力的中枢页，执行人员从这里进入 5 个专项页继续处理。', renderSpecialEntryCards(taskId))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '裁片任务详情',
    subtitle: '用于承接裁片任务的领料、铺布、入仓、交接和补料反馈。',
    activeTab: 'exec',
    body,
    backHref: '/fcs/pda/exec',
  })
}

export function handlePdaCuttingTaskDetailEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-cut-task-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaCutTaskAction
  const taskId = actionNode.dataset.taskId || appTaskIdFromPath()
  if (!action || !taskId) return false

  const state = getPageState(taskId)

  if (action === 'toggle-qr-detail') {
    state.qrExpanded = !state.qrExpanded
    return true
  }

  if (action === 'toggle-actions') {
    state.actionsExpanded = !state.actionsExpanded
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/task\/([^/]+)/)
  return matched?.[1] ?? ''
}
