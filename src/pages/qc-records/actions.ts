import {
  appStore,
  initialDeductionBasisItems,
  initialQualityInspections,
  initialReturnInboundBatches,
  defaultResponsibility,
  blockTaskForReturnInboundQc,
  findReturnInboundBatchForQc,
  isReturnInboundInspection,
  requiresFinalLiabilityDecision,
  resolveReturnInboundTaskId,
  upsertDeductionBasisFromReturnInboundQc,
  normalizeQcForView,
  processTasks,
  showQcRecordsToast,
  getQcById,
  getReturnInboundBatchById,
  applyReturnInboundBatchToForm,
  requiresFinalDecisionForForm,
  replaceQc,
  syncDetailFromQc,
  nowTimestamp,
  randomSuffix,
  parseNumberField,
  parseAmountField,
  NEEDS_AFFECTED_QTY,
  type ProcessTask,
  type RootCauseType,
  type QualityInspection,
  type DeductionBasisItem,
  type QcRecordDetailState,
  type QcRecordFormState,
  type LiabilityStatus,
  type SettlementPartyType,
  type DeductionDecision,
  type QcDisposition,
  type QcResult,
} from './context'

function generateQcId(): string {
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

  let seq = initialQualityInspections.length + 1
  while (seq < 99999) {
    const id = `QC-${ym}-${String(seq).padStart(4, '0')}`
    if (!initialQualityInspections.some((item) => item.qcId === id)) {
      return id
    }
    seq += 1
  }

  return `QC-${Date.now()}-${randomSuffix(4)}`
}

function createQc(
  payload: Omit<QualityInspection, 'qcId' | 'status' | 'auditLogs' | 'createdAt' | 'updatedAt'>,
): QualityInspection {
  const now = nowTimestamp()
  const qc: QualityInspection = {
    ...payload,
    qcId: generateQcId(),
    status: 'DRAFT',
    auditLogs: [
      {
        id: `QAL-CR-${Date.now()}-${randomSuffix(4)}`,
        action: 'CREATE',
        detail: '创建质检记录',
        at: now,
        by: payload.inspector || '管理员',
      },
    ],
    createdAt: now,
    updatedAt: now,
  }
  initialQualityInspections.push(qc)
  return qc
}

function blockTaskForQuality(task: ProcessTask, qcId: string, by: string, now: string): void {
  if (task.status === 'BLOCKED' && task.blockReason === 'QUALITY') return
  task.status = 'BLOCKED'
  task.blockReason = 'QUALITY'
  task.blockRemark = `质检 ${qcId} 不合格，待处理`
  task.blockedAt = now
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-BLOCK-QC-${Date.now()}-${randomSuffix(4)}`,
      action: 'BLOCK_BY_QC',
      detail: `质检 ${qcId} 不合格，任务生产暂停`,
      at: now,
      by,
    },
  ]
}

function upsertDeductionBasisFromQc(
  qc: QualityInspection,
  parentTask: ProcessTask,
  by: string,
  now: string,
): void {
  const basisQty = qc.affectedQty && qc.affectedQty > 0
    ? qc.affectedQty
    : qc.defectItems.reduce((sum, item) => sum + item.qty, 0)

  if (basisQty <= 0) return

  const existing = initialDeductionBasisItems.find(
    (item) => item.sourceRefId === qc.qcId || item.sourceId === qc.qcId,
  )

  const sourceType = qc.disposition === 'ACCEPT_AS_DEFECT' ? 'QC_DEFECT_ACCEPT' : 'QC_FAIL'

  const mapped = defaultResponsibility(qc.rootCauseType as RootCauseType, parentTask.assignedFactoryId)
  const settlementPartyType = qc.responsiblePartyType ?? mapped.responsiblePartyType
  const settlementPartyId = qc.responsiblePartyId ?? mapped.responsiblePartyId

  const summary =
    qc.defectItems.length > 0
      ? `${qc.defectItems.map((item) => `${item.defectName}×${item.qty}`).join('、')} | disposition=${qc.disposition || '-'}`
      : `质检不合格 | disposition=${qc.disposition || '-'}`

  if (existing) {
    const updated: DeductionBasisItem = {
      ...existing,
      sourceType,
      qty: basisQty,
      disposition: qc.disposition,
      settlementPartyType,
      settlementPartyId,
      rootCauseType: qc.rootCauseType as RootCauseType,
      status: qc.liabilityStatus as DeductionBasisItem['status'],
      summary,
      deepLinks: {
        qcHref: `/fcs/quality/qc-records/${qc.qcId}`,
        taskHref: qc.refType === 'TASK' ? `/fcs/pda/task-receive/${qc.refId}` : undefined,
        handoverHref: qc.refType === 'HANDOVER' ? `/fcs/pda/handover/${qc.refId}` : undefined,
      },
      updatedAt: now,
      updatedBy: by,
      auditLogs: [
        ...existing.auditLogs,
        {
          id: `DBIL-UPD-${Date.now()}-${randomSuffix(4)}`,
          action: 'UPDATE_BASIS_FROM_QC',
          detail: `由质检 ${qc.qcId} 同步更新，qty=${basisQty}`,
          at: now,
          by,
        },
      ],
    }
    const index = initialDeductionBasisItems.findIndex((item) => item.basisId === existing.basisId)
    if (index >= 0) {
      initialDeductionBasisItems[index] = updated
    }
    return
  }

  const basis: DeductionBasisItem = {
    basisId: `DBI-QC-${Date.now()}-${randomSuffix(4)}`,
    sourceType,
    sourceRefId: qc.qcId,
    sourceId: qc.qcId,
    productionOrderId: qc.productionOrderId || parentTask.productionOrderId,
    taskId: parentTask.taskId,
    factoryId: parentTask.assignedFactoryId ?? 'UNKNOWN',
    settlementPartyType,
    settlementPartyId,
    rootCauseType: qc.rootCauseType as RootCauseType,
    reasonCode: 'QUALITY_FAIL',
    qty: basisQty,
    uom: 'PIECE',
    disposition: qc.disposition,
    summary,
    evidenceRefs: qc.defectItems
      .filter((item) => item.remark)
      .map((item) => ({ name: item.defectName, url: item.remark, type: 'DEFECT' })),
    status: qc.liabilityStatus as DeductionBasisItem['status'],
    deepLinks: {
      qcHref: `/fcs/quality/qc-records/${qc.qcId}`,
      taskHref: qc.refType === 'TASK' ? `/fcs/pda/task-receive/${qc.refId}` : undefined,
      handoverHref: qc.refType === 'HANDOVER' ? `/fcs/pda/handover/${qc.refId}` : undefined,
    },
    createdAt: now,
    createdBy: by,
    auditLogs: [
      {
        id: `DBIL-CR-${Date.now()}-${randomSuffix(4)}`,
        action: 'CREATE_BASIS_FROM_QC',
        detail: `由质检 ${qc.qcId} 生成扣款依据，qty=${basisQty}`,
        at: now,
        by,
      },
    ],
  }
  initialDeductionBasisItems.push(basis)
}

function submitQcRecord(qcId: string, by: string): { ok: boolean; message?: string } {
  const qc = getQcById(qcId)
  if (!qc) return { ok: false, message: '质检单不存在' }

  const now = nowTimestamp()
  let auditLogs = [...qc.auditLogs]
  const finalLiabilityRequired = qc.result === 'FAIL' && requiresFinalLiabilityDecision(qc, initialReturnInboundBatches)

  if (finalLiabilityRequired) {
    if (!qc.responsiblePartyType || !qc.responsiblePartyId?.trim()) {
      return { ok: false, message: '车缝回货入仓质检提交前必须填写责任方' }
    }
    if (!qc.disposition) return { ok: false, message: '车缝回货入仓质检提交前必须填写不合格品处置方式' }
    if (!qc.deductionDecision) return { ok: false, message: '车缝回货入仓质检提交前必须明确是否扣款' }
    if (qc.deductionDecision === 'DEDUCT') {
      const amount = Number(qc.deductionAmount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, message: '车缝回货入仓质检选择扣款时，金额必须大于 0' }
      }
    } else if (!qc.deductionDecisionRemark?.trim()) {
      return { ok: false, message: '车缝回货入仓质检选择不扣款时，请填写说明' }
    }
  }

  if (qc.result === 'FAIL') {
    if (isReturnInboundInspection(qc)) {
      const inboundBatch = findReturnInboundBatchForQc(qc, initialReturnInboundBatches)
      const resolvedTaskId = resolveReturnInboundTaskId(qc, inboundBatch)
      const parentTask = resolvedTaskId
        ? processTasks.find((task) => task.taskId === resolvedTaskId)
        : null

      if (!inboundBatch) {
        auditLogs.push({
          id: `QAL-RIB-BATCH-MISS-${Date.now()}-${randomSuffix(4)}`,
          action: 'RETURN_INBOUND_BATCH_NOT_FOUND',
          detail: `未找到回货入仓批次（QC=${qc.qcId}）`,
          at: now,
          by,
        })
      }

      if (resolvedTaskId && !parentTask) {
        auditLogs.push({
          id: `QAL-RIB-TASK-MISS-${Date.now()}-${randomSuffix(4)}`,
          action: 'PARENT_TASK_NOT_FOUND',
          detail: `回货入仓质检关联任务 ${resolvedTaskId} 不存在`,
          at: now,
          by,
        })
      }

      if (parentTask) {
        blockTaskForReturnInboundQc({
          task: parentTask,
          qcId: qc.qcId,
          by,
          now,
        })
      }

      if (inboundBatch) {
        upsertDeductionBasisFromReturnInboundQc({
          basisItems: initialDeductionBasisItems,
          qc,
          batch: inboundBatch,
          by,
          now,
          taskId: parentTask?.taskId ?? resolvedTaskId,
          factoryId: parentTask?.assignedFactoryId ?? inboundBatch.returnFactoryId,
          settlementPartyType: inboundBatch.sourceType === 'DYE_PRINT_ORDER' ? 'PROCESSOR' : 'FACTORY',
          settlementPartyId: inboundBatch.returnFactoryId,
        })

        auditLogs.push({
          id: `QAL-RIB-BASIS-${Date.now()}-${randomSuffix(4)}`,
          action: 'GENERATE_DEDUCTION_BASIS',
          detail: '已按回货入仓链路同步生成/更新扣款依据',
          at: now,
          by,
        })
      } else if (parentTask?.assignedFactoryId) {
        upsertDeductionBasisFromQc(qc, parentTask, by, now)
        auditLogs.push({
          id: `QAL-RIB-BASIS-LEGACY-${Date.now()}-${randomSuffix(4)}`,
          action: 'GENERATE_DEDUCTION_BASIS',
          detail: '回货入仓批次缺失，已按任务兼容链路生成/更新扣款依据',
          at: now,
          by,
        })
      }
    } else {
      const parentTask = processTasks.find((task) => task.taskId === qc.refId)
      if (!parentTask) {
        auditLogs.push({
          id: `QAL-NOTFOUND-${Date.now()}-${randomSuffix(4)}`,
          action: 'PARENT_TASK_NOT_FOUND',
          detail: `父任务 ${qc.refId} 不存在，无法标记生产暂停`,
          at: now,
          by,
        })
      } else {
        blockTaskForQuality(parentTask, qc.qcId, by, now)

        if (parentTask.assignedFactoryId) {
          upsertDeductionBasisFromQc(qc, parentTask, by, now)
          auditLogs.push({
            id: `QAL-BASIS-${Date.now()}-${randomSuffix(4)}`,
            action: 'GENERATE_DEDUCTION_BASIS',
            detail: '已同步生成/更新扣款依据',
            at: now,
            by,
          })
        }
      }
    }
  }

  auditLogs.push({
    id: `QAL-SUBMIT-${Date.now()}-${randomSuffix(4)}`,
    action: 'SUBMIT_QC',
    detail: `提交质检结果 ${qc.result}`,
    at: now,
    by,
  })

  const updated: QualityInspection = {
    ...qc,
    status: 'SUBMITTED',
    liabilityDecisionStage: finalLiabilityRequired ? 'SEW_RETURN_INBOUND_FINAL' : qc.liabilityDecisionStage ?? 'GENERAL',
    liabilityDecisionRequired: finalLiabilityRequired ? true : qc.liabilityDecisionRequired ?? false,
    liabilityDecidedAt: finalLiabilityRequired ? now : qc.liabilityDecidedAt,
    liabilityDecidedBy: finalLiabilityRequired ? by : qc.liabilityDecidedBy,
    deductionCurrency:
      finalLiabilityRequired && qc.deductionDecision === 'DEDUCT'
        ? (qc.deductionCurrency ?? 'CNY')
        : qc.deductionCurrency,
    updatedAt: now,
    auditLogs,
  }
  replaceQc(updated)

  return { ok: true }
}

function updateQcDispositionBreakdown(
  qcId: string,
  breakdown: {
    acceptAsDefectQty?: number
    scrapQty?: number
    acceptNoDeductQty?: number
  },
  by: string,
): { ok: boolean; message?: string } {
  const qc = getQcById(qcId)
  if (!qc) return { ok: false, message: '质检单不存在' }
  if (qc.result !== 'FAIL') return { ok: false, message: '仅 FAIL 质检单可保存处置拆分' }

  const acceptAsDefectQty = breakdown.acceptAsDefectQty ?? 0
  const scrapQty = breakdown.scrapQty ?? 0
  const acceptNoDeductQty = breakdown.acceptNoDeductQty ?? 0

  if (
    acceptAsDefectQty < 0 ||
    scrapQty < 0 ||
    acceptNoDeductQty < 0
  ) {
    return { ok: false, message: '拆分数量不能为负数' }
  }

  const sum = acceptAsDefectQty + scrapQty + acceptNoDeductQty
  const target = qc.affectedQty
  if (target !== undefined && target !== null && sum !== target) {
    return { ok: false, message: `合计（${sum}）必须等于不合格数量（${target}）` }
  }

  const now = nowTimestamp()
  const updatedQc: QualityInspection = {
    ...qc,
    dispositionQtyBreakdown: {
      acceptAsDefectQty,
      scrapQty,
      acceptNoDeductQty,
    },
    updatedAt: now,
    auditLogs: [
      ...qc.auditLogs,
      {
        id: `QAL-BD-${Date.now()}-${randomSuffix(4)}`,
        action: 'UPDATE_DISPOSITION_BREAKDOWN',
        detail: `处置拆分更新：瑕疵接收${acceptAsDefectQty}，报废${scrapQty}，无扣款接收${acceptNoDeductQty}`,
        at: now,
        by,
      },
    ],
  }
  replaceQc(updatedQc)

  const deductionQty = sum - acceptNoDeductQty
  for (const basis of initialDeductionBasisItems) {
    if (basis.status === 'VOID') continue
    if (!(basis.sourceRefId === qcId || basis.sourceId === qcId)) continue

    basis.deductionQty = deductionQty
    basis.updatedAt = now
    basis.updatedBy = by
    basis.auditLogs = [
      ...basis.auditLogs,
      {
        id: `DBIL-SYNC-${Date.now()}-${randomSuffix(4)}`,
        action: 'SYNC_DEDUCTION_QTY_FROM_QC',
        detail: `由质检 ${qcId} 拆分同步可扣款数量 ${deductionQty}`,
        at: now,
        by,
      },
    ]
  }

  return { ok: true }
}

function buildPayload(
  form: QcRecordFormState,
  existing: QualityInspection | null,
): Omit<QualityInspection, 'qcId' | 'status' | 'auditLogs' | 'createdAt' | 'updatedAt'> {
  const isFail = form.result === 'FAIL'
  const needsQty = form.disposition ? NEEDS_AFFECTED_QTY.includes(form.disposition) : false
  const finalLiabilityRequired = requiresFinalDecisionForForm(form, existing)

  const defectItems = isFail
    ? form.defectItems.map((item, index) => ({
        defectCode: item.defectCode?.trim() || `D${String(index + 1).padStart(3, '0')}`,
        defectName: item.defectName.trim(),
        qty: item.qty,
        remark: item.remark?.trim() || undefined,
      }))
    : []

  const basePayload: Omit<QualityInspection, 'qcId' | 'status' | 'auditLogs' | 'createdAt' | 'updatedAt'> = {
    refType: form.refType,
    refId: form.refId.trim(),
    productionOrderId: form.productionOrderId.trim(),
    inspector: form.inspector.trim(),
    inspectedAt: form.inspectedAt.trim(),
    result: form.result,
    defectItems,
    remark: form.remark.trim() || undefined,
    disposition: isFail && form.disposition ? form.disposition : undefined,
    affectedQty:
      isFail && needsQty && form.affectedQty !== ''
        ? Number(form.affectedQty)
        : undefined,
    rootCauseType: form.rootCauseType,
    responsiblePartyType: form.responsiblePartyType || undefined,
    responsiblePartyId: form.responsiblePartyId.trim() || undefined,
    responsiblePartyName: form.responsiblePartyName.trim() || undefined,
    liabilityStatus: form.liabilityStatus,
    liabilityDecisionStage: finalLiabilityRequired ? 'SEW_RETURN_INBOUND_FINAL' : 'GENERAL',
    liabilityDecisionRequired: finalLiabilityRequired,
    deductionDecision: isFail && finalLiabilityRequired ? form.deductionDecision || undefined : undefined,
    deductionAmount:
      isFail && finalLiabilityRequired && form.deductionDecision === 'DEDUCT' && form.deductionAmount !== ''
        ? Number(form.deductionAmount)
        : undefined,
    deductionCurrency:
      isFail && finalLiabilityRequired && form.deductionDecision === 'DEDUCT'
        ? 'CNY'
        : undefined,
    deductionDecisionRemark:
      isFail && finalLiabilityRequired ? form.deductionDecisionRemark.trim() || undefined : undefined,
    dispositionRemark: isFail ? form.dispositionRemark.trim() || undefined : undefined,
  }

  if (form.refType === 'RETURN_BATCH') {
    const inboundBatch = getReturnInboundBatchById(form.refId.trim())
    if (inboundBatch) {
      basePayload.productionOrderId = inboundBatch.productionOrderId
      basePayload.refTaskId = inboundBatch.sourceTaskId
      basePayload.sourceProcessType = inboundBatch.processType
      basePayload.sourceOrderId = inboundBatch.sourceType === 'DYE_PRINT_ORDER' ? inboundBatch.sourceId : undefined
      basePayload.sourceReturnId = inboundBatch.batchId
      basePayload.inspectionScene =
        inboundBatch.processType === 'SEW'
          ? 'SEW_RETURN_RECEIVING_QC'
          : inboundBatch.processType === 'PRINT'
            ? 'PRINT_RECEIVING_QC'
            : inboundBatch.processType === 'DYE' || inboundBatch.processType === 'DYE_PRINT'
              ? 'DYE_RECEIVING_QC'
              : inboundBatch.processType === 'CUT_PANEL'
                ? 'CUT_PIECE_RECEIVING_QC'
                : 'SEW_RETURN_RECEIVING_QC'
      basePayload.inspectionType = 'QC'
      basePayload.inspectionMethod = inboundBatch.processType === 'SEW' ? 'SAMPLING' : 'FULL_INSPECTION'
      basePayload.returnBatchId = inboundBatch.batchId
      basePayload.returnProcessType = inboundBatch.processType
      basePayload.qcPolicy = inboundBatch.qcPolicy
      basePayload.returnFactoryId = inboundBatch.returnFactoryId
      basePayload.returnFactoryName = inboundBatch.returnFactoryName
      basePayload.warehouseId = inboundBatch.warehouseId
      basePayload.warehouseName = inboundBatch.warehouseName
      basePayload.receiverKind = inboundBatch.receiverKind
      basePayload.receiverId = inboundBatch.receiverId
      basePayload.receiverName = inboundBatch.receiverName
      basePayload.declaredQty = inboundBatch.submittedQty ?? inboundBatch.returnedQty
      basePayload.receivedQty = inboundBatch.receiverWrittenQty ?? inboundBatch.returnedQty
      basePayload.sourceBusinessType = inboundBatch.sourceType
      basePayload.sourceBusinessId = inboundBatch.sourceId
      basePayload.sewPostProcessMode = inboundBatch.sewPostProcessMode
    }
  }

  if (
    (existing?.inspectionScene === 'RETURN_INBOUND' ||
      existing?.inspectionScene === 'SEW_RETURN_RECEIVING_QC' ||
      existing?.inspectionScene === 'PRINT_RECEIVING_QC' ||
      existing?.inspectionScene === 'DYE_RECEIVING_QC' ||
      existing?.inspectionScene === 'CUT_PIECE_RECEIVING_QC') &&
    form.refType !== 'RETURN_BATCH'
  ) {
    basePayload.inspectionScene = existing.inspectionScene
    basePayload.inspectionType = existing.inspectionType
    basePayload.inspectionMethod = existing.inspectionMethod
    basePayload.returnBatchId = existing.returnBatchId
    basePayload.returnProcessType = existing.returnProcessType
    basePayload.qcPolicy = existing.qcPolicy
    basePayload.returnFactoryId = existing.returnFactoryId
    basePayload.returnFactoryName = existing.returnFactoryName
    basePayload.warehouseId = existing.warehouseId
    basePayload.warehouseName = existing.warehouseName
    basePayload.sourceBusinessType = existing.sourceBusinessType
    basePayload.sourceBusinessId = existing.sourceBusinessId
    basePayload.sewPostProcessMode = existing.sewPostProcessMode
    basePayload.receiverKind = existing.receiverKind
    basePayload.receiverId = existing.receiverId
    basePayload.receiverName = existing.receiverName
    basePayload.declaredQty = existing.declaredQty
    basePayload.receivedQty = existing.receivedQty
    basePayload.sourceProcessType = existing.sourceProcessType
    basePayload.sourceOrderId = existing.sourceOrderId
    basePayload.sourceReturnId = existing.sourceReturnId
  }

  return basePayload
}

function validateForm(form: QcRecordFormState, forSubmit: boolean, existing?: QualityInspection | null): string | null {
  if (!form.refId.trim()) return '请填写引用 ID（回货批次号 / 任务 ID / 交接事件 ID）'
  if (form.refType === 'RETURN_BATCH' && !getReturnInboundBatchById(form.refId.trim())) {
    return '回货批次号不存在，请先选择有效批次。'
  }
  if (!form.inspector.trim()) return '请填写质检人姓名'
  if (!forSubmit) return null

  if (form.result === 'FAIL') {
    if (form.defectItems.length === 0) return '不合格时至少填写一条缺陷明细'

    for (const defect of form.defectItems) {
      if (!defect.defectName.trim()) return '缺陷名称不能为空'
      if (!defect.qty || defect.qty < 1) return '缺陷数量须大于等于 1'
    }

    if (!form.disposition) return '请选择不合格品处置方式'

    if (NEEDS_AFFECTED_QTY.includes(form.disposition)) {
      const qty = Number(form.affectedQty)
      if (!qty || qty < 1) return '请填写受影响数量（>= 1）'

      const inboundBatch = form.refType === 'RETURN_BATCH' ? getReturnInboundBatchById(form.refId.trim()) : null
      if (inboundBatch && qty > inboundBatch.returnedQty) {
        return `受影响数量（${qty}）不能超过回货数量（${inboundBatch.returnedQty}）`
      }

      const refTask = processTasks.find((task) => task.taskId === form.refId)
      if (!inboundBatch && refTask && qty > refTask.qty) {
        return `受影响数量（${qty}）不能超过任务总量（${refTask.qty}）`
      }
    }

    if (requiresFinalDecisionForForm(form, existing)) {
      if (!form.responsiblePartyType) return '车缝回货入仓质检提交前必须选择责任方类型'
      if (!form.responsiblePartyId.trim()) return '车缝回货入仓质检提交前必须填写责任方'
      if (!form.disposition) return '车缝回货入仓质检提交前必须填写不合格品处置方式'
      if (!form.deductionDecision) return '车缝回货入仓质检提交前必须明确是否扣款'
      if (form.deductionDecision === 'DEDUCT') {
        const amount = Number(form.deductionAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
          return '选择扣款时，扣款金额必须大于 0'
        }
      } else if (!form.deductionDecisionRemark.trim()) {
        return '选择不扣款时，请填写不扣款说明'
      }
    }
  }

  return null
}

function saveDraft(detail: QcRecordDetailState): void {
  const existing = detail.currentQcId ? getQcById(detail.currentQcId) : null
  const error = validateForm(detail.form, false, existing)
  if (error) {
    showQcRecordsToast(error, 'error')
    return
  }
  const payload = buildPayload(detail.form, existing)

  if (!detail.currentQcId || !existing) {
    const created = createQc(payload)
    detail.currentQcId = created.qcId
    syncDetailFromQc(detail, created)
    appStore.navigate(`/fcs/quality/qc-records/${created.qcId}`)
    showQcRecordsToast(`草稿已保存：${created.qcId}`)
    return
  }

  const updated: QualityInspection = {
    ...existing,
    ...payload,
    updatedAt: nowTimestamp(),
  }
  replaceQc(updated)
  syncDetailFromQc(detail, updated)
  showQcRecordsToast('草稿已更新')
}

function submitDetail(detail: QcRecordDetailState): void {
  let targetId = detail.currentQcId
  let existing = targetId ? getQcById(targetId) : null
  const error = validateForm(detail.form, true, existing)
  if (error) {
    showQcRecordsToast(error, 'error')
    return
  }
  const payload = buildPayload(detail.form, existing)

  if (!targetId || !existing) {
    const created = createQc(payload)
    targetId = created.qcId
    detail.currentQcId = created.qcId
    syncDetailFromQc(detail, created)
    appStore.navigate(`/fcs/quality/qc-records/${created.qcId}`)
  } else {
    const updated: QualityInspection = {
      ...existing,
      ...payload,
      updatedAt: nowTimestamp(),
    }
    replaceQc(updated)
    syncDetailFromQc(detail, updated)
  }

  const submitResult = submitQcRecord(targetId, detail.form.inspector || '管理员')
  if (!submitResult.ok) {
    showQcRecordsToast(submitResult.message ?? '提交失败', 'error')
    return
  }

  const latest = getQcById(targetId)
  if (latest) {
    syncDetailFromQc(detail, latest)
  }

  showQcRecordsToast('质检已提交')
}


function updateFormField(detail: QcRecordDetailState, field: string, value: string): void {
  if (field === 'refType') {
    if (value === 'HANDOVER') {
      detail.form.refType = 'HANDOVER'
    } else if (value === 'RETURN_BATCH') {
      detail.form.refType = 'RETURN_BATCH'
    } else {
      detail.form.refType = 'TASK'
    }
    detail.form.refId = ''
    if (detail.form.refType !== 'RETURN_BATCH') {
      return
    }
    const firstBatch = initialReturnInboundBatches[0]
    if (firstBatch) {
      applyReturnInboundBatchToForm(detail.form, firstBatch.batchId)
    }
    return
  }
  if (field === 'refId') {
    detail.form.refId = value
    if (detail.form.refType === 'RETURN_BATCH') {
      applyReturnInboundBatchToForm(detail.form, value)
    }
    return
  }
  if (field === 'productionOrderId') {
    detail.form.productionOrderId = value
    return
  }
  if (field === 'inspector') {
    detail.form.inspector = value
    return
  }
  if (field === 'inspectedAt') {
    detail.form.inspectedAt = value
    return
  }
  if (field === 'disposition') {
    detail.form.disposition = (value || '') as QcDisposition | ''
    if (!detail.form.disposition || !NEEDS_AFFECTED_QTY.includes(detail.form.disposition)) {
      detail.form.affectedQty = ''
    }
    return
  }
  if (field === 'affectedQty') {
    detail.form.affectedQty = parseNumberField(value)
    return
  }
  if (field === 'rootCauseType') {
    detail.form.rootCauseType = (value as RootCauseType) || 'UNKNOWN'
    return
  }
  if (field === 'liabilityStatus') {
    detail.form.liabilityStatus = (value as LiabilityStatus) || 'DRAFT'
    return
  }
  if (field === 'responsiblePartyType') {
    detail.form.responsiblePartyType = (value || '') as SettlementPartyType | ''
    return
  }
  if (field === 'responsiblePartyId') {
    detail.form.responsiblePartyId = value
    return
  }
  if (field === 'responsiblePartyName') {
    detail.form.responsiblePartyName = value
    return
  }
  if (field === 'deductionDecision') {
    detail.form.deductionDecision = (value || '') as DeductionDecision | ''
    if (detail.form.deductionDecision !== 'DEDUCT') {
      detail.form.deductionAmount = ''
    }
    return
  }
  if (field === 'deductionAmount') {
    detail.form.deductionAmount = parseAmountField(value)
    return
  }
  if (field === 'deductionDecisionRemark') {
    detail.form.deductionDecisionRemark = value
    return
  }
  if (field === 'dispositionRemark') {
    detail.form.dispositionRemark = value
    return
  }
  if (field === 'remark') {
    detail.form.remark = value
  }
}

function setResult(detail: QcRecordDetailState, result: QcResult): void {
  detail.form.result = result
  if (result === 'PASS') {
    detail.form.defectItems = []
    detail.form.disposition = ''
    detail.form.affectedQty = ''
    detail.form.rootCauseType = 'UNKNOWN'
    detail.form.responsiblePartyType = ''
    detail.form.responsiblePartyId = ''
    detail.form.responsiblePartyName = ''
    detail.form.deductionDecision = ''
    detail.form.deductionAmount = ''
    detail.form.deductionDecisionRemark = ''
    detail.form.dispositionRemark = ''
  }
}

function isDetailReadOnly(detail: QcRecordDetailState): boolean {
  if (!detail.currentQcId) return false
  const existing = getQcById(detail.currentQcId)
  return existing?.status === 'SUBMITTED' || existing?.status === 'CLOSED'
}

export {
  createQc,
  submitQcRecord,
  updateQcDispositionBreakdown,
  saveDraft,
  submitDetail,
  updateFormField,
  setResult,
  isDetailReadOnly,
}
