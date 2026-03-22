import { escapeHtml } from '../utils'
import { buildPdaCuttingRoute, confirmCuttingInbound, getPdaCuttingTaskDetail } from '../data/fcs/pda-cutting-special'
import {
  renderPdaCuttingEmptyState,
  renderPdaCuttingPageLayout,
  renderPdaCuttingSection,
  renderPdaCuttingSummaryGrid,
  renderPdaCuttingTaskHero,
} from './pda-cutting-shared'

interface InboundFormState {
  operatorName: string
  zoneCode: 'A' | 'B' | 'C'
  locationLabel: string
  note: string
}

const inboundState = new Map<string, InboundFormState>()

function getState(taskId: string): InboundFormState {
  const existing = inboundState.get(taskId)
  if (existing) return existing
  const initial: InboundFormState = {
    operatorName: '仓务操作员',
    zoneCode: 'B',
    locationLabel: 'B-02 临时位',
    note: '',
  }
  inboundState.set(taskId, initial)
  return initial
}

function renderTaskSnapshot(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  if (!detail) return ''

  return `
    <div class="grid grid-cols-2 gap-3 text-xs">
      <article class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">当前任务 / 裁片单</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.taskNo)}</div>
        <div class="mt-1 text-muted-foreground">生产单：${escapeHtml(detail.productionOrderNo)}</div>
        <div class="mt-1 text-muted-foreground">裁片单：${escapeHtml(detail.cutPieceOrderNo)}</div>
      </article>
      <article class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">入仓对象</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.materialSku)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(detail.materialTypeLabel)}</div>
        <div class="mt-1 text-muted-foreground">当前阶段：${escapeHtml(detail.currentStage)}</div>
      </article>
    </div>
  `
}

function renderInboundHistory(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  if (!detail || !detail.inboundRecords.length) {
    return renderPdaCuttingEmptyState('暂无入仓记录', '后续扫码入仓后，这里会展示最近一次入仓时间、区域和操作人。')
  }

  return `
    <div class="space-y-2">
      ${detail.inboundRecords
        .map(
          (record) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(record.id)} / ${escapeHtml(record.zoneCode)} 区 / ${escapeHtml(record.locationLabel)}</div>
                <div class="text-muted-foreground">${escapeHtml(record.scannedAt)}</div>
              </div>
              <div class="mt-2 text-muted-foreground">操作人：${escapeHtml(record.operatorName)}</div>
              <div class="mt-1 text-muted-foreground">备注：${escapeHtml(record.note || '无')}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderInboundStatus(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  if (!detail) return ''

  return `
    <div class="grid grid-cols-2 gap-3 text-xs">
      <article class="rounded-xl border px-3 py-3">
        <div class="text-muted-foreground">当前入仓状态</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.currentInboundStatus)}</div>
        <div class="mt-1 text-muted-foreground">记录号：${escapeHtml(detail.latestInboundRecordNo)}</div>
      </article>
      <article class="rounded-xl border px-3 py-3">
        <div class="text-muted-foreground">当前区域 / 库位</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.inboundZoneLabel)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(detail.inboundLocationLabel)}</div>
      </article>
    </div>
  `
}

export function renderPdaCuttingInboundPage(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '入仓扫码',
      subtitle: '围绕裁片入仓对象、区域提示和库位说明完成轻量入仓确认。',
      activeTab: 'exec',
      body: '',
      backHref: buildPdaCuttingRoute(taskId, 'task'),
    })
  }

  const form = getState(taskId)

  const summary = renderPdaCuttingSummaryGrid([
    { label: '当前入仓状态', value: detail.currentInboundStatus },
    { label: '建议区域', value: detail.inboundZoneLabel },
    { label: '当前库位说明', value: detail.inboundLocationLabel },
    { label: '最近入仓记录', value: detail.latestInboundAt, hint: detail.latestInboundBy },
  ])

  const scanSection = `
    <div class="space-y-3 text-xs">
      <div class="rounded-xl border border-dashed px-3 py-4 text-center">
        <div class="text-sm font-medium text-foreground">扫码入口区</div>
        <p class="mt-1 text-muted-foreground">真实扫码能力后续补齐，本步先承接入仓对象、区域提示和库位确认。</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-xl border px-3 py-3">
          <div class="text-muted-foreground">裁片入仓对象</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(detail.cutPieceOrderNo)}</div>
          <div class="mt-1 text-muted-foreground">${escapeHtml(detail.materialSku)} / ${escapeHtml(detail.materialTypeLabel)}</div>
        </div>
        <div class="rounded-xl border px-3 py-3">
          <div class="text-muted-foreground">区域提示</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(detail.inboundZoneLabel)}</div>
          <div class="mt-1 text-muted-foreground">${escapeHtml(detail.handoverSummary)}</div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2">
        ${['A', 'B', 'C']
          .map(
            (zone) => `
              <div class="rounded-xl border px-3 py-3 text-center text-xs ${detail.inboundZoneLabel.startsWith(zone) ? 'border-blue-200 bg-blue-50 text-blue-700' : 'bg-background text-muted-foreground'}">
                <div class="font-medium">${zone} 区</div>
                <div class="mt-1 text-[11px]">${zone === 'A' ? '优先短期交接' : zone === 'B' ? '常规待交接区' : '待复核 / 临时区'}</div>
              </div>
            `,
          )
          .join('')}
      </div>
    </div>
  `

  const confirmSection = `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <label class="block space-y-1">
        <span class="text-muted-foreground">操作人</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="operatorName" value="${escapeHtml(form.operatorName)}" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">区域选择</span>
        <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="zoneCode">
          ${['A', 'B', 'C'].map((item) => `<option value="${item}" ${form.zoneCode === item ? 'selected' : ''}>${item} 区</option>`).join('')}
        </select>
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">库位说明</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="locationLabel" value="${escapeHtml(form.locationLabel)}" placeholder="例如：A-01 临时位" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">入仓备注</span>
        <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-inbound-field="note" placeholder="补充当前区域说明、待交接提示或查找提醒">${escapeHtml(form.note)}</textarea>
      </label>
      <div class="rounded-xl bg-amber-50 px-3 py-3 text-xs text-amber-800">
        本页只做裁片专厂仓务确认演示，不展开复杂库位、货架和托盘方案。
      </div>
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">本次入仓预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.zoneCode)} 区 / ${escapeHtml(form.locationLabel || '待填写位置')}</div>
        <div class="mt-1 text-muted-foreground">交接摘要：${escapeHtml(detail.handoverSummary)}</div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(buildPdaCuttingRoute(taskId, 'task'))}">
          返回任务详情
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-inbound-action="confirm" data-task-id="${escapeHtml(taskId)}">
          确认入仓
        </button>
      </div>
    </div>
  `

  const body = `
    ${renderPdaCuttingTaskHero(detail)}
    ${summary}
    ${renderPdaCuttingSection('当前任务 / 裁片单摘要', '先确认当前入仓对象、裁片单和面料，再决定区域与位置。', renderTaskSnapshot(taskId))}
    ${renderPdaCuttingSection('扫码入口与对象摘要', '展示当前裁片入仓对象、区域提示和库位说明的承接关系。', scanSection)}
    ${renderPdaCuttingSection('区域提示与入仓确认', '现场操作员可在此完成轻量入仓确认并回写区域与位置。', confirmSection)}
    ${renderPdaCuttingSection('入仓状态摘要', '这里集中展示最近一次入仓记录号、区域和库位说明。', renderInboundStatus(taskId))}
    ${renderPdaCuttingSection('最近入仓记录', '用于查看最近一次入仓动作、区域和操作人。', renderInboundHistory(taskId))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '入仓扫码',
    subtitle: '围绕裁片入仓对象、区域提示和库位说明完成轻量入仓确认。',
    activeTab: 'exec',
    body,
    backHref: buildPdaCuttingRoute(taskId, 'task'),
  })
}

export function handlePdaCuttingInboundEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-cut-inbound-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const taskId = fieldNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const form = getState(taskId)
    const field = fieldNode.dataset.pdaCutInboundField
    if (!field) return true

    if (field === 'operatorName') form.operatorName = fieldNode.value
    if (field === 'zoneCode' && fieldNode instanceof HTMLSelectElement) form.zoneCode = fieldNode.value as 'A' | 'B' | 'C'
    if (field === 'locationLabel') form.locationLabel = fieldNode.value
    if (field === 'note') form.note = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-inbound-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutInboundAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false

  if (action === 'confirm') {
    const form = getState(taskId)
    confirmCuttingInbound(taskId, {
      operatorName: form.operatorName.trim() || '仓务操作员',
      zoneCode: form.zoneCode,
      locationLabel: form.locationLabel.trim() || `${form.zoneCode}-01 临时位`,
      note: form.note.trim(),
    })
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/inbound\/([^/]+)/)
  return matched?.[1] ?? ''
}
