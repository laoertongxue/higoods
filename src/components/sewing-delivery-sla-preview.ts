import {
  classifySewingDeliverySla,
  compareSewingDeliveryDateTimes,
  createSewingDeliverySlaSnapshot,
  dateTimeLocalToOperationWallClock,
  formatOperationLocalWallClock,
  type SewingDeliverySlaTaskLike,
} from '../data/fcs/sewing-delivery-sla.ts'
import { escapeHtml } from '../utils.ts'

export interface SewingDeliverySlaPreviewInput {
  task: SewingDeliverySlaTaskLike
  businessAssignedAt: string
  assignedQty: number
  currentOperationAt?: string
}

export interface SewingDeliverySlaPreviewRow {
  label: '交付完成' | '30% 回货' | '70% 回货' | '100% 回货'
  deadlineAt: string
  requirement: string
}

export interface SewingDeliverySlaPreviewModel {
  supported: boolean
  valid: boolean
  kindLabel: '' | '车缝' | '车缝到后道'
  error: string
  rows: SewingDeliverySlaPreviewRow[]
}

export function buildSewingDeliverySlaPreviewModel(
  input: SewingDeliverySlaPreviewInput,
): SewingDeliverySlaPreviewModel {
  const slaKind = classifySewingDeliverySla(input.task)
  if (slaKind !== 'INDEPENDENT_SEWING' && slaKind !== 'SEWING_TO_PACKAGING') {
    return { supported: false, valid: false, kindLabel: '', error: '', rows: [] }
  }
  const kindLabel = slaKind === 'INDEPENDENT_SEWING' ? '车缝' : '车缝到后道'
  try {
    if (!input.businessAssignedAt.trim()) throw new Error('请选择业务分配时间')
    const acceptedAt = dateTimeLocalToOperationWallClock(input.businessAssignedAt)
    const currentOperationAt = input.currentOperationAt ?? formatOperationLocalWallClock()
    if (compareSewingDeliveryDateTimes(acceptedAt, currentOperationAt) > 0) {
      throw new Error('业务分配时间不能晚于当前时间')
    }
    const snapshot = createSewingDeliverySlaSnapshot({
      assignmentId: 'SEWING-DISPATCH-PREVIEW',
      runtimeTaskId: 'SEWING-DISPATCH-PREVIEW',
      productionOrderId: 'PREVIEW',
      factoryId: 'PREVIEW',
      factoryName: '预览',
      assignedQty: input.assignedQty,
      acceptedAt,
      slaKind,
    })
    const [thirty, seventy, hundred] = snapshot.milestones
    return {
      supported: true,
      valid: true,
      kindLabel,
      error: '',
      rows: [
        { label: '交付完成', deadlineAt: hundred.deadlineAt, requirement: '前完成 100%' },
        { label: '30% 回货', deadlineAt: thirty.deadlineAt, requirement: '前确认实收达到 30%' },
        { label: '70% 回货', deadlineAt: seventy.deadlineAt, requirement: '前确认实收达到 70%' },
        { label: '100% 回货', deadlineAt: hundred.deadlineAt, requirement: '前确认实收达到 100%' },
      ],
    }
  } catch (error) {
    return {
      supported: true,
      valid: false,
      kindLabel,
      error: error instanceof Error ? error.message : '业务分配时间格式不正确',
      rows: [],
    }
  }
}

export function renderSewingDeliverySlaPreview(input: SewingDeliverySlaPreviewInput): string {
  const model = buildSewingDeliverySlaPreviewModel(input)
  if (!model.supported) return ''
  if (!model.valid) {
    return `<section data-sewing-delivery-sla-preview data-preview-valid="false" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">${escapeHtml(model.error)}</section>`
  }
  return `
    <section data-sewing-delivery-sla-preview data-preview-valid="true" class="space-y-2 rounded-md border p-3">
      <div class="flex items-center justify-between gap-3 text-sm font-medium">
        <span>交付时效与按比例回货要求</span>
        <span>${escapeHtml(model.kindLabel)}</span>
      </div>
      ${model.rows.map((row) => `
        <div class="grid gap-1 text-sm sm:grid-cols-[110px_1fr]">
          <span class="text-muted-foreground">${row.label}</span>
          <span class="font-medium">${escapeHtml(row.deadlineAt.slice(0, 16))} ${row.requirement}</span>
        </div>
      `).join('')}
      <div class="text-xs text-muted-foreground">按满 24 小时滚动；仅接收方确认实收计入回货比例。</div>
    </section>
  `
}
