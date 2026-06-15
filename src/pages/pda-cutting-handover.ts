import { escapeHtml } from '../utils'
import {
  buildHandoverPickingTaskProjectionFromAllocationProjection,
  buildSewingTaskAllocationProjectionFromInventory,
  type HandoverPickingTaskProjection,
} from '../data/fcs/cutting/sewing-dispatch.ts'
import {
  buildPdaUniversalHandoverRecordDraft,
  listHandoverRecords,
  type HandoverRecord,
  type PdaHandoverRecordDraftProjection,
} from '../data/fcs/cutting/handover-orders.ts'
import { buildPdaCuttingHandoverProjection } from './pda-cutting-handover-projection'
import {
  buildInboundTempBagInventoryRecords,
  buildInboundTempBagsFromTransferBagViewModel,
} from './process-factory/cutting/transfer-bags-model.ts'
import { buildTransferBagsProjection } from './process-factory/cutting/transfer-bags-projection.ts'
import {
  resolvePdaCuttingRuntimeIdentity,
  resolvePdaCuttingRuntimeOperator,
} from '../data/fcs/pda-cutting-runtime-action-inputs.ts'
import { validateFeiTicketNumberingBeforeBagging } from '../data/fcs/cutting/fei-ticket-numbering.ts'
import {
  type HandoverRecordSubmitPayload,
  type SpecialCraftHandoverPayload,
  type SpecialCraftReturnPayload,
} from '../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import {
  appendWaitHandoverHandoverRecordEvent,
  appendWaitHandoverBaggingConfirmEvent,
  appendWaitHandoverSpecialCraftHandoverEvent,
  appendWaitHandoverSpecialCraftReturnEvent,
  runtimeEventHasWaitHandoverTicket,
} from './process-factory/cutting/wait-handover-runtime.ts'
import {
  buildPdaCuttingExecutionStateKey,
  renderPdaCuttingEmptyState,
  renderPdaCuttingExecutionHero,
  renderPdaCuttingFeedbackNotice,
  renderPdaCuttingOrderSelectionPrompt,
  renderPdaCuttingPageLayout,
  renderPdaCuttingSection,
  renderPdaCuttingSummaryGrid,
} from './pda-cutting-shared'
import {
  buildPdaCuttingExecutionContext,
  readSelectedExecutionOrderIdFromLocation,
  readSelectedExecutionOrderNoFromLocation,
} from './pda-cutting-context'
import { buildPdaCuttingCompletedReturnHref } from './pda-cutting-nav-context'

interface HandoverFormState {
  operatorName: string
  targetLabel: string
  note: string
  feedbackMessage: string
  backHrefOverride: string
  pickingTaskScan: string
  sourceBagScan: string
  pickingFeiTicketScan: string
  targetBagScan: string
  handoverOrderScan: string
  handoverBagScan: string
  handoverFeiTicketScan: string
  specialCraftOrderScan: string
  specialCraftBagScan: string
  specialCraftFeiTicketScan: string
  specialCraftReturnBagScan: string
  specialCraftReturnFeiTicketScan: string
  specialCraftReturnAreaScan: string
  specialCraftReturnLocationScan: string
  specialCraftReturnQty: string
}

const handoverState = new Map<string, HandoverFormState>()

function getHandoverDetail(taskId: string, executionKey?: string | null) {
  return buildPdaCuttingHandoverProjection(taskId, executionKey ?? undefined)
}

function getState(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): HandoverFormState {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)
  const existing = handoverState.get(stateKey)
  if (existing) return existing
  const detail = getHandoverDetail(taskId, executionOrderId ?? executionOrderNo ?? undefined)
  const initial: HandoverFormState = {
    operatorName: '交出操作员',
    targetLabel: detail?.handoverTargetLabel && detail.handoverTargetLabel !== '待确定后道去向' ? detail.handoverTargetLabel : '裁片仓交出位',
    note: '',
    feedbackMessage: '',
    backHrefOverride: '',
    pickingTaskScan: '',
    sourceBagScan: '',
    pickingFeiTicketScan: '',
    targetBagScan: '',
    handoverOrderScan: '',
    handoverBagScan: '',
    handoverFeiTicketScan: '',
    specialCraftOrderScan: '',
    specialCraftBagScan: '',
    specialCraftFeiTicketScan: '',
    specialCraftReturnBagScan: '',
    specialCraftReturnFeiTicketScan: '',
    specialCraftReturnAreaScan: '',
    specialCraftReturnLocationScan: '',
    specialCraftReturnQty: '',
  }
  handoverState.set(stateKey, initial)
  return initial
}

function renderHandoverHistory(detail: NonNullable<ReturnType<typeof getHandoverDetail>>): string {
  if (!detail || !detail.handoverRecords.length) {
    return renderPdaCuttingEmptyState('当前裁片单暂无交出记录', '')
  }

  return `
    <div class="space-y-2">
      ${detail.handoverRecords
        .map(
          (record) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(record.id)} / ${escapeHtml(record.resultLabel)}</div>
                <div class="text-muted-foreground">${escapeHtml(record.handoverAt)}</div>
              </div>
              <div class="mt-2 text-muted-foreground">交出对象：${escapeHtml(record.targetLabel)}</div>
              <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(record.operatorName)}</div>
              <div class="mt-1 text-muted-foreground">备注：${escapeHtml(record.note || '无')}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderHandoverStatus(detail: NonNullable<ReturnType<typeof getHandoverDetail>>): string {
  return renderPdaCuttingSummaryGrid([
    { label: '当前交出状态', value: detail.currentHandoverStatus },
    { label: '当前交出对象', value: detail.handoverTargetLabel },
    { label: '最近交出记录', value: detail.latestHandoverRecordNo || '暂无记录' },
    { label: '最近交出时间', value: detail.latestHandoverAt, hint: detail.latestHandoverBy },
  ])
}

function buildPdaHandoverPickingProjection(): HandoverPickingTaskProjection {
  const transferBagViewModel = buildTransferBagsProjection().viewModel
  const inboundTempBags = buildInboundTempBagsFromTransferBagViewModel(transferBagViewModel)
  const inboundInventoryRecords = buildInboundTempBagInventoryRecords(inboundTempBags)
  const allocationProjection = buildSewingTaskAllocationProjectionFromInventory(inboundInventoryRecords)
  return buildHandoverPickingTaskProjectionFromAllocationProjection(allocationProjection)
}

function normalizeScanValue(value: string): string {
  return value.trim()
}

function matchesScannedValue(value: string, candidates: Array<string | undefined>): boolean {
  const normalized = normalizeScanValue(value)
  if (!normalized) return false
  return candidates.some((candidate) => candidate && normalizeScanValue(candidate) === normalized)
}

function readBaggingConfirmTaskIdFromLocation(): string {
  if (typeof window === 'undefined') return ''
  const params = new URLSearchParams(window.location.search)
  return params.get('baggingConfirmTaskId') || ''
}

function readPdaCuttingHandoverActionFromLocation(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('action') || ''
}

function findPdaPickingTaskForCurrentRoute(projection: HandoverPickingTaskProjection): HandoverPickingTaskProjection['tasks'][number] | undefined {
  const baggingConfirmTaskId = readBaggingConfirmTaskIdFromLocation()
  return projection.tasks.find((item) => item.pickingTaskId === baggingConfirmTaskId || item.pickingTaskNo === baggingConfirmTaskId) || projection.tasks[0]
}

function renderPdaScanInput(label: string, field: keyof HandoverFormState, value: string, placeholder: string): string {
  return `
    <label class="block space-y-1">
      <span class="text-muted-foreground">${escapeHtml(label)}</span>
      <input
        class="h-10 w-full rounded-xl border bg-background px-3 text-sm"
        data-pda-cut-handover-field="${escapeHtml(field)}"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
      />
    </label>
  `
}

function syncHandoverFormFromControls(form: HandoverFormState, container: ParentNode = document): void {
  container.querySelectorAll<HTMLElement>('[data-pda-cut-handover-field]').forEach((fieldNode) => {
    const field = fieldNode.dataset.pdaCutHandoverField
    if (!field || !(field in form)) return
    if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement) {
      ;(form as Record<string, string>)[field] = fieldNode.value
    }
  })
}

function runtimeEventHasTicket(eventType: string, feiTicketId: string, specialCraftId?: string): boolean {
  return runtimeEventHasWaitHandoverTicket(eventType, feiTicketId, specialCraftId)
}

function validatePickingScans(
  projection: HandoverPickingTaskProjection,
  task: HandoverPickingTaskProjection['tasks'][number],
  form: HandoverFormState,
):
  | {
      ok: true
      item: HandoverPickingTaskProjection['tasks'][number]['allocatedInventoryItems'][number]
      sourceTempBagCode: string
      targetTransferBagCode: string
    }
  | { ok: false; message: string } {
  if (!matchesScannedValue(form.pickingTaskScan, [task.pickingTaskNo, task.pickingTaskId])) {
    return { ok: false, message: '请先扫描当前交出装袋确认任务码。' }
  }

  const sourceBag = task.tempBagSources.find((item) => matchesScannedValue(form.sourceBagScan, [item.tempBagCode]))
  if (!sourceBag) return { ok: false, message: '来源入仓暂存袋不属于当前交出装袋确认任务。' }

  const item = task.allocatedInventoryItems.find((ticket) => matchesScannedValue(form.pickingFeiTicketScan, [ticket.feiTicketNo, ticket.feiTicketId]))
  if (!item) return { ok: false, message: '该菲票不属于当前交出装袋确认任务。' }
  if (item.tempBagCode && item.tempBagCode !== sourceBag.tempBagCode) {
    return { ok: false, message: '该菲票不在已扫描的来源入仓暂存袋中。' }
  }
  const numberingValidation = validateFeiTicketNumberingBeforeBagging({
    feiTicketId: item.feiTicketId,
    feiTicketNo: item.feiTicketNo,
    partName: item.partName,
  })
  if (!numberingValidation.ok) return { ok: false, message: numberingValidation.reason }
  if (item.specialCraftReturnStatus !== '不需要特殊工艺' && item.specialCraftReturnStatus !== '已回仓') {
    return { ok: false, message: '该菲票特殊工艺未回仓，不能交出装袋确认给车缝任务。' }
  }
  if (task.pickedItems.some((picked) => picked.feiTicketId === item.feiTicketId)) {
    return { ok: false, message: '该菲票已在当前任务中完成交出装袋确认。' }
  }
  if (runtimeEventHasTicket('交出装袋确认', item.feiTicketId)) {
    return { ok: false, message: '该菲票已有交出装袋确认事件，不能重复交出装袋确认。' }
  }

  const targetTransferBagCode = normalizeScanValue(form.targetBagScan)
  if (!targetTransferBagCode) return { ok: false, message: '请扫描目标中转袋。' }

  const boundToOtherTask = projection.targetTransferBags.some(
    (bag) => bag.bagCode === targetTransferBagCode && bag.sewingTaskId !== task.sewingTaskId,
  )
  if (boundToOtherTask) return { ok: false, message: '目标中转袋已绑定其他车缝任务，不能混用。' }

  return { ok: true, item, sourceTempBagCode: sourceBag.tempBagCode, targetTransferBagCode }
}

function renderPdaPickingFlow(projection: HandoverPickingTaskProjection, taskId: string, form: HandoverFormState): string {
  const task = findPdaPickingTaskForCurrentRoute(projection)
  if (!task) return renderPdaCuttingEmptyState('暂无待交出仓交出装袋确认任务', '')
  const pickedQty = task.pickedItems.reduce((total, item) => total + item.pickedQty, 0)
  const shortageLabel = task.shortageItems
    .slice(0, 2)
    .map((item) => `${item.size}/${item.partName}缺${item.shortageQty}片`)
    .join('；') || '暂无缺口'
  const taskScanChecks = projection.scanChecks.filter((check) => check.pickingTaskNo === task.pickingTaskNo)
  const failedSync = taskScanChecks.find((check) => check.syncStatus === '同步失败')
  const scanChecks = taskScanChecks.slice(0, 5)

  return `
    <div class="space-y-3 text-xs">
      <div class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">当前交出装袋确认任务</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(task.pickingTaskNo)}</div>
        <div class="mt-1 text-muted-foreground">车缝任务：${escapeHtml(task.sewingTaskNo)}</div>
        <div class="mt-1 text-muted-foreground">来源袋：${escapeHtml(task.tempBagSources.map((item) => item.tempBagCode).join('、') || '待扫描')}</div>
        <div class="mt-1 text-muted-foreground">目标袋：${escapeHtml(task.targetTransferBags.map((bag) => bag.bagCode).join('、') || '待扫描')}</div>
      </div>
      ${renderPdaCuttingSummaryGrid([
        { label: '已扫菲票', value: `${task.pickedItems.length}/${task.allocatedInventoryItems.length} 张` },
        { label: '已扫数量', value: `${pickedQty} 片` },
        { label: '缺口提示', value: shortageLabel },
        { label: '同步状态', value: failedSync ? '同步失败' : '已同步', hint: failedSync?.reason || '最近提交已同步' },
      ])}
      <div class="rounded-xl border px-3 py-3">
        <div class="font-medium text-foreground">扫码顺序</div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
          <div>1. 扫交出装袋确认任务码</div>
          <div>2. 扫来源入仓暂存袋</div>
          <div>3. 扫菲票</div>
          <div>4. 扫目标中转袋</div>
        </div>
        <div class="mt-3 grid gap-2">
          ${renderPdaScanInput('交出装袋确认任务码', 'pickingTaskScan', form.pickingTaskScan, task.pickingTaskNo)}
          ${renderPdaScanInput('来源入仓暂存袋', 'sourceBagScan', form.sourceBagScan, task.tempBagSources[0]?.tempBagCode || '扫来源袋码')}
          ${renderPdaScanInput('菲票码', 'pickingFeiTicketScan', form.pickingFeiTicketScan, task.allocatedInventoryItems[0]?.feiTicketNo || '扫菲票码')}
          ${renderPdaScanInput('目标中转袋', 'targetBagScan', form.targetBagScan, task.targetTransferBags[0]?.bagCode || '扫目标袋码')}
        </div>
      </div>
      <div class="space-y-1">
        ${scanChecks
          .map((check) => `
            <div class="rounded-xl border px-3 py-2">
              <div class="font-medium text-foreground">${escapeHtml(check.scanObject)}：${escapeHtml(check.scannedValue)}</div>
              <div class="mt-1 text-muted-foreground">${escapeHtml(check.checkResult)} / ${escapeHtml(check.reason)} / 同步：${escapeHtml(check.syncStatus)}</div>
            </div>
          `)
          .join('')}
      </div>
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, form.feedbackMessage.includes('已写入') ? 'success' : 'warning') : ''}
      <button
        class="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        data-pda-cut-handover-action="confirm-picking"
        data-task-id="${escapeHtml(taskId)}"
      >
        确认装袋
      </button>
    </div>
  `
}

function appendRuntimeBaggingConfirmEvent(
  projection: HandoverPickingTaskProjection,
  task: HandoverPickingTaskProjection['tasks'][number],
  form: HandoverFormState,
  operatorName: string,
): string {
  const validation = validatePickingScans(projection, task, form)
  if (!validation.ok) return validation.message

  const now = new Date().toISOString()
  const pickedQty = validation.item.pieceQty
  appendWaitHandoverBaggingConfirmEvent({
    source: 'PDA',
    operator: {
      operatorName,
      operatorRole: '裁片仓装袋确认员',
    },
    pickingTaskId: task.pickingTaskId,
    pickingTaskNo: task.pickingTaskNo,
    sewingTaskId: task.sewingTaskId,
    sewingTaskNo: task.sewingTaskNo,
    sourceTempBagCode: validation.sourceTempBagCode,
    targetTransferBagCode: validation.targetTransferBagCode,
    tickets: [{
      feiTicketId: validation.item.feiTicketId,
      feiTicketNo: validation.item.feiTicketNo,
      pieceQty: pickedQty,
    }],
    occurredAt: now,
  })

  return `已同步交出装袋确认：${validation.item.feiTicketNo}，目标袋 ${validation.targetTransferBagCode}。`
}

function findHandoverRecordForDraft(draft: PdaHandoverRecordDraftProjection): HandoverRecord | undefined {
  return listHandoverRecords().find((record) => record.handoverOrderId === draft.handoverOrderId)
}

function validateUniversalHandoverScans(
  draft: PdaHandoverRecordDraftProjection,
  sourceRecord: HandoverRecord,
  form: HandoverFormState,
):
  | {
      ok: true
      bag: HandoverRecord['transferBagUses'][number]
      ticket: HandoverRecord['feiTicketItems'][number]
    }
  | { ok: false; message: string } {
  if (!matchesScannedValue(form.handoverOrderScan, [draft.handoverOrderNo, draft.handoverOrderId])) {
    return { ok: false, message: '请先扫描当前交出单。' }
  }
  const bag = sourceRecord.transferBagUses.find((item) => matchesScannedValue(form.handoverBagScan, [item.bagCode, item.bagUseId]))
  if (!bag) return { ok: false, message: '该中转袋不属于当前交出单。' }

  const ticket = sourceRecord.feiTicketItems.find((item) => matchesScannedValue(form.handoverFeiTicketScan, [item.feiTicketNo, item.feiTicketId]))
  if (!ticket) return { ok: false, message: '该菲票不属于当前交出单。' }
  if (bag.containedFeiTicketIds.length && !bag.containedFeiTicketIds.includes(ticket.feiTicketId)) {
    return { ok: false, message: '该菲票不在已扫描的交出中转袋中。' }
  }
  const numberingValidation = validateFeiTicketNumberingBeforeBagging({
    feiTicketId: ticket.feiTicketId,
    feiTicketNo: ticket.feiTicketNo,
    partName: ticket.partName,
    pieceSequenceLabel: ticket.pieceSequenceLabel,
  })
  if (!numberingValidation.ok) return { ok: false, message: numberingValidation.reason }
  if (runtimeEventHasTicket('新增交出记录', ticket.feiTicketId)) {
    return { ok: false, message: '该菲票已有交出记录事件，不能重复交出。' }
  }
  return { ok: true, bag, ticket }
}

function appendRuntimeUniversalHandoverEvent(draft: PdaHandoverRecordDraftProjection, form: HandoverFormState, operatorName: string): string {
  const sourceRecord = findHandoverRecordForDraft(draft)
  if (!sourceRecord || !sourceRecord.feiTicketItems.length) return '当前交出单没有可提交的菲票明细。'
  const validation = validateUniversalHandoverScans(draft, sourceRecord, form)
  if (!validation.ok) return validation.message

  const now = new Date().toISOString()
  const recordId = `PDA-HR-${draft.handoverOrderId}-${now.replace(/\D/g, '')}`
  const recordNo = `${draft.handoverOrderNo}-PDA-${String(draft.nextRecordSequence).padStart(3, '0')}`
  const payload: HandoverRecordSubmitPayload = {
    handoverOrderId: draft.handoverOrderId,
    handoverOrderNo: draft.handoverOrderNo,
    handoverRecordId: recordId,
    handoverRecordNo: recordNo,
    receiverType: draft.receiverType,
    receiverId: sourceRecord.receiverId,
    receiverName: draft.receiverName,
    transferBagUses: [{
      bagUseId: validation.bag.bagUseId,
      bagCode: validation.bag.bagCode,
      containedFeiTicketIds: [validation.ticket.feiTicketId],
      totalPieceQty: validation.ticket.pieceQty,
    }],
    feiTicketItems: [{
      feiTicketId: validation.ticket.feiTicketId,
      feiTicketNo: validation.ticket.feiTicketNo,
      pieceQty: validation.ticket.pieceQty,
      unit: '片',
    }],
    currentHandedOverQty: validation.ticket.pieceQty,
    submittedAt: now,
    submittedBy: operatorName,
  }

  appendWaitHandoverHandoverRecordEvent({
    source: 'PDA',
    operator: {
      operatorName,
      operatorRole: '裁片仓交出员',
    },
    payload,
    fromWarehouseArea: sourceRecord.sourceWarehouseName,
    fromLocationCode: validation.bag.bagCode,
    occurredAt: now,
  })

  return `已同步交出记录：${recordNo}，本次交出 ${payload.currentHandedOverQty} 片。`
}

function validateSpecialCraftHandoverScans(
  draft: PdaHandoverRecordDraftProjection,
  sourceRecord: HandoverRecord,
  form: HandoverFormState,
):
  | {
      ok: true
      bag: HandoverRecord['transferBagUses'][number]
      craftItems: NonNullable<HandoverRecord['specialCraftItems']>
      ticketNo: string
    }
  | { ok: false; message: string } {
  if (!matchesScannedValue(form.specialCraftOrderScan, [draft.handoverOrderNo, draft.handoverOrderId])) {
    return { ok: false, message: '请先扫描当前特殊工艺交出单。' }
  }
  const bag = sourceRecord.transferBagUses.find((item) => matchesScannedValue(form.specialCraftBagScan, [item.bagCode, item.bagUseId]))
  if (!bag) return { ok: false, message: '该中转袋不属于当前特殊工艺交出单。' }

  const ticket = sourceRecord.feiTicketItems.find((item) => matchesScannedValue(form.specialCraftFeiTicketScan, [item.feiTicketNo, item.feiTicketId]))
  if (!ticket) return { ok: false, message: '该菲票不属于当前特殊工艺交出单。' }
  if (bag.containedFeiTicketIds.length && !bag.containedFeiTicketIds.includes(ticket.feiTicketId)) {
    return { ok: false, message: '该菲票不在已扫描的特殊工艺中转袋中。' }
  }

  const craftItems = (sourceRecord.specialCraftItems || []).filter((item) => item.feiTicketId === ticket.feiTicketId)
  if (!craftItems.length) return { ok: false, message: '该菲票没有当前交出单的特殊工艺明细。' }
  const repeatedCraft = craftItems.find((item) => runtimeEventHasTicket('特殊工艺交出', ticket.feiTicketId, item.specialCraftId))
  if (repeatedCraft) return { ok: false, message: '该菲票的当前特殊工艺已交出，不能重复交出。' }
  return { ok: true, bag, craftItems, ticketNo: ticket.feiTicketNo }
}

function appendRuntimeSpecialCraftHandoverEvent(draft: PdaHandoverRecordDraftProjection, form: HandoverFormState, operatorName: string): string {
  const sourceRecord = findHandoverRecordForDraft(draft)
  if (!sourceRecord || !sourceRecord.specialCraftItems?.length) return '当前特殊工艺交出单没有工艺明细。'
  const validation = validateSpecialCraftHandoverScans(draft, sourceRecord, form)
  if (!validation.ok) return validation.message

  const now = new Date().toISOString()
  const firstCraft = validation.craftItems[0]
  const payload: SpecialCraftHandoverPayload = {
    handoverOrderId: draft.handoverOrderId,
    handoverRecordId: sourceRecord.handoverRecordId,
    craftCategory: firstCraft.craftCategory,
    craftType: firstCraft.craftType,
    receiverFactoryId: firstCraft.receiverFactoryId,
    receiverFactoryName: firstCraft.receiverFactoryName,
    feiTicketItems: validation.craftItems.map((item) => ({
      feiTicketId: item.feiTicketId,
      feiTicketNo: sourceRecord.feiTicketItems.find((ticket) => ticket.feiTicketId === item.feiTicketId)?.feiTicketNo || item.feiTicketId,
      specialCraftId: item.specialCraftId,
      partName: item.partName,
      size: item.size,
      pieceQty: item.pieceQty,
    })),
    handedOverAt: now,
    handedOverBy: operatorName,
  }
  const totalQty = payload.feiTicketItems.reduce((total, item) => total + item.pieceQty, 0)

  appendWaitHandoverSpecialCraftHandoverEvent({
    source: 'PDA',
    operator: {
      operatorName,
      operatorRole: '特殊工艺交出员',
    },
    payload,
    handoverOrderId: draft.handoverOrderId,
    handoverRecordId: sourceRecord.handoverRecordId,
    specialCraftId: firstCraft.specialCraftId,
    transferBagCode: validation.bag.bagCode,
    fromWarehouseArea: sourceRecord.sourceWarehouseName,
    occurredAt: now,
  })

  return `已同步特殊工艺交出：${validation.ticketNo} / ${firstCraft.craftType}，交出 ${totalQty} 片。`
}

function validateSpecialCraftReturnScans(
  draft: PdaHandoverRecordDraftProjection,
  sourceRecord: HandoverRecord,
  form: HandoverFormState,
):
  | {
      ok: true
      bag: HandoverRecord['transferBagUses'][number] | null
      craftItems: NonNullable<HandoverRecord['specialCraftItems']>
      ticket: HandoverRecord['feiTicketItems'][number]
      ticketNo: string
      warehouseArea: string
      locationCode: string
      returnedQty: number
    }
  | { ok: false; message: string } {
  if (!matchesScannedValue(form.specialCraftOrderScan, [draft.handoverOrderNo, draft.handoverOrderId])) {
    return { ok: false, message: '请先扫描来源特殊工艺交出单。' }
  }
  const bag = sourceRecord.transferBagUses.length
    ? sourceRecord.transferBagUses.find((item) => matchesScannedValue(form.specialCraftReturnBagScan, [item.bagCode, item.bagUseId])) || null
    : null
  if (sourceRecord.transferBagUses.length && !bag) {
    return { ok: false, message: '请先扫描回仓中转袋。' }
  }
  const ticket = sourceRecord.feiTicketItems.find((item) => matchesScannedValue(form.specialCraftReturnFeiTicketScan, [item.feiTicketNo, item.feiTicketId]))
  if (!ticket) return { ok: false, message: '该菲票不属于当前特殊工艺交出记录。' }
  if (bag?.containedFeiTicketIds.length && !bag.containedFeiTicketIds.includes(ticket.feiTicketId)) {
    return { ok: false, message: '该菲票不在已扫描的回仓中转袋中。' }
  }
  const craftItems = (sourceRecord.specialCraftItems || []).filter((item) => item.feiTicketId === ticket.feiTicketId)
  if (!craftItems.length) return { ok: false, message: '该菲票没有可回仓的特殊工艺明细。' }
  const expectedQty = craftItems.reduce((total, item) => total + item.pieceQty, 0)
  if (expectedQty <= 0) return { ok: false, message: '该菲票没有可回仓数量。' }
  const alreadyReturned = craftItems.find((item) => runtimeEventHasTicket('特殊工艺回仓', ticket.feiTicketId, item.specialCraftId))
  if (alreadyReturned) return { ok: false, message: '该菲票的当前特殊工艺已回仓，不能重复回仓。' }
  const warehouseArea = normalizeScanValue(form.specialCraftReturnAreaScan)
  if (!warehouseArea) return { ok: false, message: '请扫描或填写回仓库区。' }
  const locationCode = normalizeScanValue(form.specialCraftReturnLocationScan)
  if (!locationCode) return { ok: false, message: '请扫描或填写回仓库位。' }
  const returnedQty = Number(form.specialCraftReturnQty)
  if (!Number.isFinite(returnedQty) || returnedQty <= 0) return { ok: false, message: '请填写大于 0 的实回数量。' }
  return { ok: true, bag, craftItems, ticket, ticketNo: ticket.feiTicketNo, warehouseArea, locationCode, returnedQty }
}

function appendRuntimeSpecialCraftReturnEvent(draft: PdaHandoverRecordDraftProjection, form: HandoverFormState, operatorName: string): string {
  const sourceRecord = findHandoverRecordForDraft(draft)
  if (!sourceRecord || !sourceRecord.specialCraftItems?.length) return '当前特殊工艺交出单没有可回仓菲票。'
  const validation = validateSpecialCraftReturnScans(draft, sourceRecord, form)
  if (!validation.ok) return validation.message
  const craftItems = validation.craftItems

  const now = new Date().toISOString()
  const returnRecordId = `PDA-SCR-${sourceRecord.handoverRecordId}-${now.replace(/\D/g, '')}`
  const expectedTotalQty = craftItems.reduce((total, item) => total + item.pieceQty, 0)
  let remainingReturnQty = validation.returnedQty
  const returnedFeiTicketItems = craftItems.map((item, index) => {
    const isLast = index === craftItems.length - 1
    const proportionalQty = expectedTotalQty > 0 ? (validation.returnedQty * item.pieceQty) / expectedTotalQty : validation.returnedQty
    const returnedQty = isLast ? Math.max(0, Number(remainingReturnQty.toFixed(2))) : Math.max(0, Number(proportionalQty.toFixed(2)))
    remainingReturnQty -= returnedQty
    const returnStatus: SpecialCraftReturnPayload['returnedFeiTicketItems'][number]['returnStatus'] =
      returnedQty === item.pieceQty ? '已回仓' : returnedQty < item.pieceQty ? '部分回仓' : '回仓差异'
    return {
      feiTicketId: item.feiTicketId,
      feiTicketNo: sourceRecord.feiTicketItems.find((ticket) => ticket.feiTicketId === item.feiTicketId)?.feiTicketNo || item.feiTicketId,
      specialCraftId: item.specialCraftId,
      craftType: item.craftType,
      partName: item.partName,
      size: item.size,
      expectedQty: item.pieceQty,
      returnedQty,
      unit: '片' as const,
      returnStatus,
    }
  })
  const payload: SpecialCraftReturnPayload = {
    returnRecordId,
    returnRecordNo: `HG-${sourceRecord.handoverRecordNo}-PDA`,
    sourceHandoverOrderId: sourceRecord.handoverOrderId,
    sourceHandoverOrderNo: sourceRecord.handoverOrderNo,
    sourceHandoverRecordId: sourceRecord.handoverRecordId,
    sourceHandoverRecordNo: sourceRecord.handoverRecordNo,
    receiverFactoryId: craftItems[0].receiverFactoryId,
    receiverFactoryName: craftItems[0].receiverFactoryName,
    transferBagCode: validation.bag?.bagCode,
    warehouseName: '裁床待交出仓',
    craftType: craftItems[0].craftType,
    returnedFeiTicketItems,
    warehouseArea: validation.warehouseArea,
    locationCode: validation.locationCode,
    returnedAt: now,
    returnedBy: operatorName,
  }
  const returnedQty = payload.returnedFeiTicketItems.reduce((total, item) => total + item.returnedQty, 0)

  appendWaitHandoverSpecialCraftReturnEvent({
    source: 'PDA',
    operator: {
      operatorName,
      operatorRole: '特殊工艺回仓员',
    },
    payload,
    specialCraftId: craftItems[0].specialCraftId,
    occurredAt: now,
  })

  return `已同步特殊工艺回仓：${validation.ticketNo} / ${validation.ticket.partName}，回仓 ${returnedQty} 片，入 ${validation.warehouseArea} / ${validation.locationCode}。`
}

function renderPdaSpecialCraftReturnFlow(
  draft: PdaHandoverRecordDraftProjection,
  sourceRecord: HandoverRecord | undefined,
  taskId: string,
  form: HandoverFormState,
): string {
  if (!sourceRecord || !sourceRecord.specialCraftItems?.length) {
    return renderPdaCuttingEmptyState('暂无可回仓特殊工艺菲票', '特殊工艺交出后，回仓扫码任务会出现在这里。')
  }
  const scannedTicket = sourceRecord.feiTicketItems.find((item) =>
    matchesScannedValue(form.specialCraftReturnFeiTicketScan, [item.feiTicketNo, item.feiTicketId]),
  )
  const ticket = scannedTicket || sourceRecord.feiTicketItems.find((item) =>
    sourceRecord.specialCraftItems?.some((craft) => craft.feiTicketId === item.feiTicketId),
  )
  const craftItems = ticket ? sourceRecord.specialCraftItems.filter((item) => item.feiTicketId === ticket.feiTicketId) : []
  const firstCraft = craftItems[0]
  const sourceBag = sourceRecord.transferBagUses.find((item) =>
    form.specialCraftReturnBagScan
      ? matchesScannedValue(form.specialCraftReturnBagScan, [item.bagCode, item.bagUseId])
      : item.containedFeiTicketIds.includes(ticket?.feiTicketId || ''),
  ) || sourceRecord.transferBagUses[0]
  const expectedQty = craftItems.reduce((total, item) => total + item.pieceQty, 0)
  const returnStatus = firstCraft && ticket && runtimeEventHasTicket('特殊工艺回仓', ticket.feiTicketId, firstCraft.specialCraftId)
    ? '已回仓'
    : '待回仓'

  return `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <div class="rounded-xl border bg-violet-50 px-3 py-3 text-violet-900">
        <div class="font-medium">特殊工艺回仓扫码</div>
        <div class="mt-1 text-sm font-semibold">${escapeHtml(draft.handoverOrderNo)} / 来源记录 ${escapeHtml(sourceRecord.handoverRecordNo)}</div>
        <div class="mt-1">有中转袋时先扫中转袋，再扫菲票获取裁片部位，最后扫库区库位并确认入仓。</div>
      </div>
      <div class="rounded-xl border px-3 py-3">
        <div class="font-medium text-foreground">扫码顺序</div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
          <div>1. 扫来源交出单</div>
          <div>2. 扫回仓中转袋</div>
          <div>3. 扫回仓菲票</div>
          <div>4. 扫库区库位</div>
        </div>
        <div class="mt-3 grid gap-2">
          ${renderPdaScanInput('来源特殊工艺交出单', 'specialCraftOrderScan', form.specialCraftOrderScan, draft.handoverOrderNo)}
          ${renderPdaScanInput('回仓中转袋', 'specialCraftReturnBagScan', form.specialCraftReturnBagScan, sourceBag?.bagCode || '无中转袋则留空')}
          ${renderPdaScanInput('回仓菲票', 'specialCraftReturnFeiTicketScan', form.specialCraftReturnFeiTicketScan, ticket?.feiTicketNo || '扫回仓菲票')}
          ${renderPdaScanInput('回仓库区', 'specialCraftReturnAreaScan', form.specialCraftReturnAreaScan, '特殊工艺回仓区')}
          ${renderPdaScanInput('回仓库位', 'specialCraftReturnLocationScan', form.specialCraftReturnLocationScan, 'SP-RETURN-01')}
          ${renderPdaScanInput('实回数量', 'specialCraftReturnQty', form.specialCraftReturnQty, String(expectedQty || ticket?.pieceQty || '填写实回数量'))}
        </div>
      </div>
      ${renderPdaCuttingSummaryGrid([
        { label: '菲票', value: ticket?.feiTicketNo || '待扫描' },
        { label: '裁片部位', value: ticket ? `${ticket.partName} / ${ticket.size}` : '待扫描菲票后获取' },
        { label: '应回数量', value: expectedQty ? `${expectedQty} 片` : '待识别' },
        { label: '回仓状态', value: returnStatus },
        { label: '承接工厂', value: firstCraft?.receiverFactoryName || sourceRecord.receiverName },
        { label: '回仓去向', value: `${form.specialCraftReturnAreaScan || '待扫库区'} / ${form.specialCraftReturnLocationScan || '待扫库位'}` },
      ])}
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, form.feedbackMessage.includes('已同步') ? 'success' : 'warning') : ''}
      <button
        class="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        data-pda-cut-handover-action="confirm-special-craft-return"
        data-task-id="${escapeHtml(taskId)}"
      >
        确认特殊工艺回仓入仓
      </button>
    </div>
  `
}

export function renderPdaCuttingHandoverPage(taskId: string): string {
  const context = buildPdaCuttingExecutionContext(taskId, 'handover')
  const detail = context.detail
  const routeAction = readPdaCuttingHandoverActionFromLocation()
  const isBaggingConfirmAction = routeAction === 'handover-bagging-confirm'
  const isSpecialCraftReturnAction = routeAction === 'special-craft-return'
  const pageTitle = isSpecialCraftReturnAction ? '特殊工艺回仓扫码' : isBaggingConfirmAction ? '交出装袋确认扫码' : '交出记录扫码'
  const pageActiveTab = isBaggingConfirmAction || isSpecialCraftReturnAction ? 'warehouse' : 'handover'
  const baggingConfirmBackHref = '/fcs/pda/warehouse/wait-handover?scope=cutting&action=handover-bagging-confirm'
  const specialCraftReturnBackHref = '/fcs/pda/warehouse/wait-handover?scope=cutting&action=special-craft-return'

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: pageTitle,
      subtitle: '',
      activeTab: pageActiveTab,
      body: '',
      backHref: isSpecialCraftReturnAction ? specialCraftReturnBackHref : isBaggingConfirmAction ? baggingConfirmBackHref : context.backHref,
    })
  }

  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: pageTitle,
      subtitle: '',
      activeTab: pageActiveTab,
      body: renderPdaCuttingOrderSelectionPrompt(
        detail,
        isSpecialCraftReturnAction ? specialCraftReturnBackHref : isBaggingConfirmAction ? baggingConfirmBackHref : context.backHref,
        context.selectionNotice || undefined,
      ),
      backHref: isSpecialCraftReturnAction ? specialCraftReturnBackHref : isBaggingConfirmAction ? baggingConfirmBackHref : context.backHref,
    })
  }

  const form = getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)
  const pageBackHref = form.backHrefOverride || (isSpecialCraftReturnAction ? specialCraftReturnBackHref : isBaggingConfirmAction ? baggingConfirmBackHref : context.backHref)
  const universalDraft = buildPdaUniversalHandoverRecordDraft()
  const specialCraftDraft = buildPdaUniversalHandoverRecordDraft('HO-CUT-AUX-260324-001')
  const specialCraftSourceRecord = findHandoverRecordForDraft(specialCraftDraft)

  if (isBaggingConfirmAction) {
    const body = `
      ${renderPdaCuttingExecutionHero('交出装袋确认', detail)}
      ${renderPdaCuttingSection('交出装袋确认扫码', '', renderPdaPickingFlow(buildPdaHandoverPickingProjection(), taskId, form))}
    `

    return renderPdaCuttingPageLayout({
      taskId,
      title: pageTitle,
      subtitle: '',
      activeTab: pageActiveTab,
      body,
      backHref: pageBackHref,
      hideHeaderToolbar: true,
      titleActionHtml: `
        <button class="inline-flex items-center rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          返回
        </button>
      `,
    })
  }

  if (isSpecialCraftReturnAction) {
    const body = `
      ${renderPdaCuttingExecutionHero('特殊工艺回仓', detail)}
      ${renderPdaCuttingSection('扫码回仓入库', '', renderPdaSpecialCraftReturnFlow(specialCraftDraft, specialCraftSourceRecord, taskId, form))}
    `

    return renderPdaCuttingPageLayout({
      taskId,
      title: pageTitle,
      subtitle: '',
      activeTab: pageActiveTab,
      body,
      backHref: pageBackHref,
      hideHeaderToolbar: true,
      titleActionHtml: `
        <button class="inline-flex items-center rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          返回
        </button>
      `,
    })
  }

  const confirmSection = `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <div class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">通用交出记录</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(universalDraft.handoverOrderNo)} / 第 ${universalDraft.nextRecordSequence} 次交出</div>
        <div class="mt-1 text-muted-foreground">接收对象：${escapeHtml(universalDraft.receiverType)} ${escapeHtml(universalDraft.receiverName)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(universalDraft.modelHint)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(universalDraft.submitConditionText)}</div>
      </div>
      <div class="rounded-xl border px-3 py-3">
        <div class="font-medium text-foreground">扫码确认</div>
        <div class="mt-2 grid gap-2">
          ${renderPdaScanInput('交出单', 'handoverOrderScan', form.handoverOrderScan, universalDraft.handoverOrderNo)}
          ${renderPdaScanInput('中转袋', 'handoverBagScan', form.handoverBagScan, '扫本次交出中转袋')}
          ${renderPdaScanInput('菲票', 'handoverFeiTicketScan', form.handoverFeiTicketScan, '扫本次交出菲票')}
        </div>
      </div>
      <label class="block space-y-1">
        <span class="text-muted-foreground">操作人</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-handover-field="operatorName" value="${escapeHtml(form.operatorName)}" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">交出对象</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-handover-field="targetLabel" value="${escapeHtml(form.targetLabel)}" placeholder="例如：裁片仓交出位 / 后道工位" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">交出备注</span>
        <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-handover-field="note" placeholder="填写交出提醒、后续去向和异常记录">${escapeHtml(form.note)}</textarea>
      </label>
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">本次交出预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.targetLabel || '待填写交出对象')}</div>
        <div class="mt-1 text-muted-foreground">当前位置：${escapeHtml(detail.inboundZoneLabel)} / ${escapeHtml(detail.inboundLocationLabel)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(universalDraft.riskTips[0]?.tipText || '提交后按交出记录展示累计交出、交出后是否齐套和缺口。')}</div>
      </div>
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, 'success') : ''}
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          返回裁片任务
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-handover-action="confirm" data-task-id="${escapeHtml(taskId)}">
          新增交出记录
        </button>
      </div>
    </div>
  `

  const specialCraftSection = `
    <div class="space-y-3 text-xs">
      <div class="rounded-xl border bg-violet-50 px-3 py-3 text-violet-900">
        <div class="font-medium">特殊工艺交出扫码</div>
        <div class="mt-1 text-sm font-semibold">${escapeHtml(specialCraftDraft.handoverOrderNo)} / 第 ${specialCraftDraft.nextRecordSequence} 次交出</div>
        <div class="mt-1">接收对象：${escapeHtml(specialCraftDraft.receiverType)} ${escapeHtml(specialCraftDraft.receiverName)}</div>
        <div class="mt-1">扫特殊工艺交出单 → 扫中转袋 → 扫菲票 → 确认交出</div>
      </div>
      <div class="rounded-xl border px-3 py-3">
        <div class="font-medium text-foreground">特殊工艺扫码</div>
        <div class="mt-2 grid gap-2">
          ${renderPdaScanInput('特殊工艺交出单', 'specialCraftOrderScan', form.specialCraftOrderScan, specialCraftDraft.handoverOrderNo)}
          ${renderPdaScanInput('中转袋', 'specialCraftBagScan', form.specialCraftBagScan, '扫特殊工艺交出中转袋')}
          ${renderPdaScanInput('交出菲票', 'specialCraftFeiTicketScan', form.specialCraftFeiTicketScan, '扫交出菲票')}
          ${renderPdaScanInput('回仓中转袋', 'specialCraftReturnBagScan', form.specialCraftReturnBagScan, specialCraftSourceRecord?.transferBagUses[0]?.bagCode || '扫回仓中转袋')}
          ${renderPdaScanInput('回仓菲票', 'specialCraftReturnFeiTicketScan', form.specialCraftReturnFeiTicketScan, '扫回仓菲票')}
          ${renderPdaScanInput('回仓库区', 'specialCraftReturnAreaScan', form.specialCraftReturnAreaScan, '扫回仓库区')}
          ${renderPdaScanInput('回仓库位', 'specialCraftReturnLocationScan', form.specialCraftReturnLocationScan, '扫回仓库位')}
          ${renderPdaScanInput('实回数量', 'specialCraftReturnQty', form.specialCraftReturnQty, '填写实回数量')}
        </div>
      </div>
      ${renderPdaCuttingSummaryGrid([
        { label: '本次工艺', value: '绣花' },
        { label: '承接工厂', value: specialCraftDraft.receiverName },
        { label: '同步状态', value: '已同步', hint: '提交后生成通用交出记录' },
        { label: '后续回仓', value: '先扫中转袋再扫菲票' },
      ])}
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, form.feedbackMessage.includes('已同步') ? 'success' : 'warning') : ''}
      <button
        class="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        data-pda-cut-handover-action="confirm-special-craft-handover"
        data-task-id="${escapeHtml(taskId)}"
      >
        确认交出
      </button>
      <button
        class="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-violet-200 bg-background px-3 py-2 text-sm font-semibold text-violet-700"
        data-pda-cut-handover-action="confirm-special-craft-return"
        data-task-id="${escapeHtml(taskId)}"
      >
        确认回仓
      </button>
    </div>
  `

  const body = `
    ${renderPdaCuttingExecutionHero('新增交出记录', detail)}
    ${renderPdaCuttingSection('当前情况', '', renderHandoverStatus(detail))}
    ${renderPdaCuttingSection('待交出仓交出装袋确认', '', renderPdaPickingFlow(buildPdaHandoverPickingProjection(), taskId, form))}
    ${renderPdaCuttingSection('特殊工艺交出', '', specialCraftSection)}
    ${renderPdaCuttingSection('新增交出记录', '', confirmSection)}
    ${renderPdaCuttingSection('最近交出记录', '', renderHandoverHistory(detail))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '交出记录扫码',
    subtitle: '',
    activeTab: 'handover',
    body,
    backHref: pageBackHref,
  })
}

export function handlePdaCuttingHandoverEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-cut-handover-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const taskId = fieldNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
    const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const field = fieldNode.dataset.pdaCutHandoverField
    if (!field) return true

    if (field in form) {
      ;(form as Record<string, string>)[field] = fieldNode.value
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-handover-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutHandoverAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false
  const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
  const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()
  const context = buildPdaCuttingExecutionContext(taskId, 'handover')
  const resolvedExecutionOrderId = selectedExecutionOrderId || context.selectedExecutionOrderId
  const resolvedExecutionOrderNo = selectedExecutionOrderNo || context.selectedExecutionOrderNo

  if (action === 'confirm') {
    const form = getState(taskId, resolvedExecutionOrderId, resolvedExecutionOrderNo)
    syncHandoverFormFromControls(form)
    const identity = resolvePdaCuttingRuntimeIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
      cutOrderId: context.selectedExecutionOrder?.cutOrderId || undefined,
      cutOrderNo: context.selectedExecutionOrder?.cutOrderNo || undefined,
      markerPlanId: context.selectedExecutionOrder?.markerPlanId || undefined,
      markerPlanNo: context.selectedExecutionOrder?.markerPlanNo || undefined,
      materialSku: context.selectedExecutionOrder?.materialSku || undefined,
    })
    const operator = resolvePdaCuttingRuntimeOperator(taskId, form.operatorName.trim() || '交出操作员')
    if (!identity || !operator) {
      form.feedbackMessage = '当前执行对象或操作人无法识别，不能新增交出记录。'
      return true
    }
    form.feedbackMessage = appendRuntimeUniversalHandoverEvent(
      buildPdaUniversalHandoverRecordDraft(),
      form,
      form.operatorName.trim() || operator.name || '交出操作员',
    )
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
      context.navContext,
      'handover',
    )
    return true
  }

  if (action === 'confirm-picking') {
    const form = getState(taskId, resolvedExecutionOrderId, resolvedExecutionOrderNo)
    syncHandoverFormFromControls(form)
    const projection = buildPdaHandoverPickingProjection()
    const task = findPdaPickingTaskForCurrentRoute(projection)
    if (!task) {
      form.feedbackMessage = '当前没有待交出仓交出装袋确认任务。'
      return true
    }
    form.feedbackMessage = appendRuntimeBaggingConfirmEvent(projection, task, form, form.operatorName.trim() || '裁片仓装袋确认员')
    return true
  }

  if (action === 'confirm-special-craft-handover') {
    const form = getState(taskId, resolvedExecutionOrderId, resolvedExecutionOrderNo)
    syncHandoverFormFromControls(form)
    form.feedbackMessage = appendRuntimeSpecialCraftHandoverEvent(
      buildPdaUniversalHandoverRecordDraft('HO-CUT-AUX-260324-001'),
      form,
      form.operatorName.trim() || '特殊工艺交出员',
    )
    return true
  }

  if (action === 'confirm-special-craft-return') {
    const form = getState(taskId, resolvedExecutionOrderId, resolvedExecutionOrderNo)
    syncHandoverFormFromControls(form)
    form.feedbackMessage = appendRuntimeSpecialCraftReturnEvent(
      buildPdaUniversalHandoverRecordDraft('HO-CUT-AUX-260324-001'),
      form,
      form.operatorName.trim() || '特殊工艺回仓员',
    )
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/handover\/([^/]+)/)
  return matched?.[1] ?? ''
}
