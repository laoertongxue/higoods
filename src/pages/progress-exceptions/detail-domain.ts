import {
  state,
  OWNER_OPTIONS,
  DIRECT_CLOSE_REASON_SET,
  CLOSE_REASON_LABEL,
  REASON_LABEL,
  CASE_STATUS_LABEL,
  CATEGORY_LABEL,
  SUB_CATEGORY_LABEL,
  SEVERITY_COLOR_CLASS,
  RESOLVE_RULE_LABEL,
  RESOLVE_SOURCE_LABEL,
  getCaseById,
  getTaskById,
  getOrderById,
  getFactoryById,
  getTenderById,
  getProcessTypeByCode,
  getReasonLabel,
  getSubCategoryLabel,
  getUnifiedCategory,
  getMaterialIssueRows,
  getHandoverCaseSnapshot,
  getResolveJudgeResult,
  getTaskStatusLabel,
  getSpuFromCase,
  normalizeCaseStatus,
  parseTimestampToMs,
  buildHandoverOrderDetailLink,
  getProductionOrderHandoverSummary,
  renderBadge,
  renderStatusBadge,
  escapeAttr,
  escapeHtml,
  type ExceptionCase,
} from './context'
import { getClaimDisputeStatusMeta } from '../../helpers/fcs-claim-dispute'
import { getClaimDisputeByCaseId } from '../../state/fcs-claim-dispute-store'

function isCuttingClaimDisputeCase(detailCase: ExceptionCase): boolean {
  return detailCase.sourceModule === 'CUTTING_CLAIM_DISPUTE'
}

function renderClaimDisputeSourcePanel(detailCase: ExceptionCase): string {
  const dispute = getClaimDisputeByCaseId(detailCase.caseId)
  if (!dispute) {
    return `
      <div class="space-y-3 rounded-lg border border-teal-200 bg-teal-50 p-4">
        <p class="text-sm font-medium text-teal-700">裁片领料数量异议来源明细</p>
        <p class="text-xs text-teal-700">未找到共享异议对象，请回到移动端或工艺端检查是否已写入裁片领料异议 ledger。</p>
      </div>
    `
  }

  const statusMeta = getClaimDisputeStatusMeta(dispute.status)
  const renderKv = (label: string, value: string): string => `
    <div class="rounded-md border bg-background px-3 py-2">
      <p class="text-[11px] text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-1 text-sm">${escapeHtml(value || '-')}</p>
    </div>
  `

  return `
    <div class="space-y-3 rounded-lg border border-teal-200 bg-teal-50 p-4">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-medium text-teal-700">裁片领料数量异议来源明细</p>
        <span class="inline-flex items-center rounded-full border px-2.5 py-1 ${statusMeta.className}">${escapeHtml(statusMeta.label)}</span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        ${renderKv('异议编号', dispute.disputeNo)}
        ${renderKv('来源端', '移动端')}
        ${renderKv('原始裁片单号', dispute.originalCutOrderNo)}
        ${renderKv('生产单号', dispute.productionOrderNo)}
        ${renderKv('面料编码', dispute.materialSku)}
        ${renderKv('面料属性 / 类别', `${dispute.materialCategory} / ${dispute.materialAttr}`)}
        ${renderKv('仓库配置数量', `${dispute.configuredQty} 米`)}
        ${renderKv('默认应领数量', `${dispute.defaultClaimQty} 米`)}
        ${renderKv('实际领取数量', `${dispute.actualClaimQty} 米`)}
        ${renderKv('差异数量', `${dispute.discrepancyQty} 米`)}
        ${renderKv('提交人', dispute.submittedBy)}
        ${renderKv('提交时间', dispute.submittedAt)}
      </div>
      <div class="rounded-md border bg-background p-3 text-sm">
        <p class="text-xs text-muted-foreground">异议原因</p>
        <p class="mt-1">${escapeHtml(dispute.disputeReason)}</p>
        <p class="mt-3 text-xs text-muted-foreground">异议说明</p>
        <p class="mt-1">${escapeHtml(dispute.disputeNote || '无')}</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">图片证据</p>
          <div class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${
              dispute.imageFiles.length
                ? dispute.imageFiles
                    .map((file) => `<p>${escapeHtml(file.fileName)} ｜ ${escapeHtml(file.uploadedAt)}</p>`)
                    .join('')
                : '<p>暂无图片证据</p>'
            }
          </div>
        </div>
        <div class="rounded-md border bg-background p-3">
          <p class="text-xs text-muted-foreground">视频证据</p>
          <div class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${
              dispute.videoFiles.length
                ? dispute.videoFiles
                    .map((file) => `<p>${escapeHtml(file.fileName)} ｜ ${escapeHtml(file.uploadedAt)}</p>`)
                    .join('')
                : '<p>暂无视频证据</p>'
            }
          </div>
        </div>
      </div>
      <div class="rounded-md border bg-background p-3 text-xs text-muted-foreground">
        <p>处理结论：${escapeHtml(dispute.handleConclusion || '待平台处理')}</p>
        <p class="mt-1">处理说明：${escapeHtml(dispute.handleNote || '待补')}</p>
        <p class="mt-1">回写状态：${escapeHtml(dispute.writtenBackToCraft ? '已回写工艺端' : '待回写工艺端')} / ${escapeHtml(dispute.writtenBackToPda ? '已回写移动端' : '待回写移动端')}</p>
      </div>
    </div>
  `
}

function renderClaimDisputeActionPanel(detailCase: ExceptionCase): string {
  const dispute = getClaimDisputeByCaseId(detailCase.caseId)
  if (!dispute) return ''

  return `
    <div class="rounded-md border border-teal-200 bg-teal-50 p-3">
      <p class="text-sm font-medium text-teal-700">裁片领料数量异议处理区</p>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">处理状态</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pe-field="claimDisputeHandleStatus">
            <option value="PENDING" ${state.claimDisputeHandleStatus === 'PENDING' ? 'selected' : ''}>待处理</option>
            <option value="VIEWED" ${state.claimDisputeHandleStatus === 'VIEWED' ? 'selected' : ''}>已查看</option>
            <option value="CONFIRMED" ${state.claimDisputeHandleStatus === 'CONFIRMED' ? 'selected' : ''}>已确认差异</option>
            <option value="REJECTED" ${state.claimDisputeHandleStatus === 'REJECTED' ? 'selected' : ''}>已驳回异议</option>
            <option value="COMPLETED" ${state.claimDisputeHandleStatus === 'COMPLETED' ? 'selected' : ''}>已处理完成</option>
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">处理结论</span>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeAttr(state.claimDisputeHandleConclusion)}" data-pe-field="claimDisputeHandleConclusion" placeholder="例如：确认少领 23 米，待仓库复点" />
        </label>
        <label class="col-span-2 space-y-1">
          <span class="text-xs text-muted-foreground">处理说明</span>
          <textarea class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pe-field="claimDisputeHandleNote" placeholder="填写平台处理说明、结论依据和回写说明">${escapeHtml(state.claimDisputeHandleNote)}</textarea>
        </label>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-pe-action="submit-claim-dispute-handle" data-case-id="${escapeAttr(detailCase.caseId)}">保存处理结果</button>
        <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pe-action="drawer-go-craft-dispute" data-original-cut-order-no="${escapeAttr(dispute.originalCutOrderNo)}">去工艺端查看</button>
        <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pe-action="drawer-go-pda-dispute" data-task-id="${escapeAttr(dispute.sourceTaskId)}">去移动端查看</button>
      </div>
    </div>
  `
}

export function renderBasicTab(detailCase: ExceptionCase): string {
  const unifiedCategory = getUnifiedCategory(detailCase)
  const subCategory = getSubCategoryLabel(detailCase)
  const resolvedStateLabel = detailCase.resolvedAt ? '已解决' : '未解决'
  const resolvedRuleLabel = detailCase.resolvedRuleCode ? RESOLVE_RULE_LABEL[detailCase.resolvedRuleCode] : '-'
  const resolvedSourceLabel = detailCase.resolvedSource ? RESOLVE_SOURCE_LABEL[detailCase.resolvedSource] : '-'
  const closeReasonLabel = detailCase.closeReasonCode ? CLOSE_REASON_LABEL[detailCase.closeReasonCode] : '-'

  return `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-xs text-muted-foreground">异常号</p>
          <p class="font-medium">${escapeHtml(detailCase.caseId)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">状态</p>
          <p class="font-medium">${escapeHtml(CASE_STATUS_LABEL[normalizeCaseStatus(detailCase.caseStatus)])}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">一级分类</p>
          <p class="font-medium">${escapeHtml(CATEGORY_LABEL[unifiedCategory])}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">二级分类</p>
          <p class="font-medium">${escapeHtml(subCategory)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">来源</p>
          <p class="font-medium">${escapeHtml(detailCase.sourceType)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">当前责任人</p>
          <p class="font-medium">${escapeHtml(detailCase.ownerUserName || '-')}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">创建时间</p>
          <p class="font-medium">${escapeHtml(detailCase.createdAt)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">最近更新时间</p>
          <p class="font-medium">${escapeHtml(detailCase.updatedAt)}</p>
        </div>
      </div>

      <div class="rounded-md border bg-muted/20 p-3">
        <p class="mb-2 text-xs font-medium text-muted-foreground">处理结果</p>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p class="text-xs text-muted-foreground">解决状态</p>
            <p class="font-medium">${escapeHtml(resolvedStateLabel)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">解决规则</p>
            <p class="font-medium">${escapeHtml(resolvedRuleLabel)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">解决来源</p>
            <p class="font-medium">${escapeHtml(resolvedSourceLabel)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">解决人</p>
            <p class="font-medium">${escapeHtml(detailCase.resolvedBy || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">解决时间</p>
            <p class="font-medium">${escapeHtml(detailCase.resolvedAt || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">关闭原因</p>
            <p class="font-medium">${escapeHtml(closeReasonLabel)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">关闭人</p>
            <p class="font-medium">${escapeHtml(detailCase.closedBy || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">关闭时间</p>
            <p class="font-medium">${escapeHtml(detailCase.closedAt || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">关联异常号</p>
            <p class="font-medium">${escapeHtml(detailCase.mergedCaseId || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">解决说明</p>
            <p class="font-medium">${escapeHtml(detailCase.resolvedDetail || '-')}</p>
          </div>
          <div class="col-span-2">
            <p class="text-xs text-muted-foreground">关闭说明</p>
            <p class="font-medium">${escapeHtml(detailCase.closeDetail || detailCase.closeRemark || '-')}</p>
          </div>
        </div>
      </div>

      <div class="border-t pt-3">
        <p class="text-xs text-muted-foreground">基本情况</p>
        <p class="font-medium">${escapeHtml(detailCase.summary)}</p>
      </div>

      <div>
        <p class="text-xs text-muted-foreground">详情</p>
        <p class="whitespace-pre-wrap text-sm text-muted-foreground">${escapeHtml(detailCase.detail)}</p>
      </div>

      ${
        detailCase.tags.length > 0
          ? `<div><p class="text-xs text-muted-foreground">标签</p><div class="mt-1 flex flex-wrap gap-1">${detailCase.tags
              .map((tag) => renderBadge(tag, 'border-border bg-background text-foreground'))
              .join('')}</div></div>`
          : ''
      }
    </div>
  `
}

export function renderRelatedTab(detailCase: ExceptionCase): string {
  const firstOrderId = detailCase.relatedOrderIds[0] || ''
  const firstTaskId = detailCase.relatedTaskIds[0] || ''
  const relatedObjects = getRelatedObjects(detailCase)

  return `
    <div class="space-y-4">
      <div class="rounded-md border p-3">
        <p class="text-xs text-muted-foreground">关联对象</p>
        <div class="mt-2 space-y-1">
          ${
            relatedObjects.length > 0
              ? relatedObjects
                  .map((item) => `<p class="text-sm"><span class="text-muted-foreground">${escapeHtml(item.typeLabel)}：</span><span class="font-medium">${escapeHtml(item.id)}</span></p>`)
                  .join('')
              : '<p class="text-sm text-muted-foreground">暂无关联对象</p>'
          }
        </div>
      </div>

      <div class="border-t pt-3">
        <p class="text-xs text-muted-foreground">快捷跳转</p>
        <div class="mt-2 flex flex-wrap gap-2">
          ${
            firstOrderId
              ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="drawer-tech-pack" data-case-id="${escapeAttr(detailCase.caseId)}"><i data-lucide="file-text" class="mr-1 h-4 w-4"></i>技术包</button>`
              : ''
          }
          ${
            firstOrderId
              ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="drawer-view-handover" data-order-id="${escapeAttr(firstOrderId)}" data-task-id="${escapeAttr(firstTaskId)}"><i data-lucide="scan-line" class="mr-1 h-4 w-4"></i>查看交接链路</button>`
              : ''
          }
          ${
            firstOrderId
              ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="drawer-view-material" data-order-id="${escapeAttr(firstOrderId)}"><i data-lucide="package" class="mr-1 h-4 w-4"></i>领料进度</button>`
              : ''
          }
        </div>
      </div>
    </div>
  `
}

export function renderSourceTab(detailCase: ExceptionCase): string {
  const firstOrderId = detailCase.relatedOrderIds[0] || '-'
  const firstTaskId = detailCase.relatedTaskIds[0] || '-'
  const firstTenderId = detailCase.relatedTenderIds[0] || '-'
  const unifiedCategory = getUnifiedCategory(detailCase)
  const task = firstTaskId !== '-' ? getTaskById(firstTaskId) : undefined
  const order = firstOrderId !== '-' ? getOrderById(firstOrderId) : undefined
  const tender = firstTenderId !== '-' ? getTenderById(firstTenderId) : undefined
  const materialRows = getMaterialIssueRows(detailCase)
  const { orderSummary: handoverOrderSummary, taskSummary: handoverTaskSummary } = getHandoverCaseSnapshot(detailCase)

  const renderKv = (label: string, value: string): string => `
    <div class="rounded-md border bg-background px-3 py-2">
      <p class="text-[11px] text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-1 text-sm">${escapeHtml(value || '-')}</p>
    </div>
  `

  const formatMilestoneSnapshot = (snapshot?: ExceptionCase['milestoneSnapshot']): string => {
    if (!snapshot?.required) return '无强制关键节点'
    const statusLabel = snapshot.status === 'REPORTED' ? '已上报' : '待上报'
    const fallbackRule =
      snapshot.targetQty && snapshot.targetQty > 0
        ? `完成第 ${snapshot.targetQty} ${snapshot.targetUnit === 'YARD' ? 'Yard' : '件'}后上报`
        : '已配置关键节点'
    const ruleText = snapshot.ruleLabel || fallbackRule
    return `${ruleText} / ${statusLabel}`
  }

  if (unifiedCategory === 'ASSIGNMENT') {
    return `
      <div class="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p class="text-sm font-medium text-blue-700">分配异常来源明细</p>
        <div class="grid grid-cols-2 gap-2">
          ${renderKv('招标单号', firstTenderId)}
          ${renderKv('任务号', firstTaskId)}
          ${renderKv('生产单号', firstOrderId)}
          ${renderKv('分配方式', tender ? '竞价' : '派单')}
          ${renderKv('竞价状态', tender?.status || '-')}
          ${renderKv('竞价截止', tender?.deadline || '-')}
          ${renderKv('当前失败原因', getSubCategoryLabel(detailCase))}
          ${renderKv(
            '任务是否仍未分出',
            task ? (task.assignmentStatus === 'UNASSIGNED' || !task.assignedFactoryId ? '是' : '否') : '是',
          )}
        </div>
        <p class="text-xs text-muted-foreground">
          候选工厂：${
            tender?.invitedFactoryIds?.length
              ? escapeHtml(
                  tender.invitedFactoryIds
                    .slice(0, 4)
                    .map((id) => getFactoryById(id)?.name || id)
                    .join('、'),
                )
              : '暂无候选工厂信息'
          }
        </p>
      </div>
    `
  }

  if (unifiedCategory === 'EXECUTION') {
    return `
      <div class="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p class="text-sm font-medium text-amber-700">执行异常来源明细</p>
        <div class="grid grid-cols-2 gap-2">
          ${renderKv('任务号', firstTaskId)}
          ${renderKv('PDA任务号', detailCase.sourceId.startsWith('PDA-') ? detailCase.sourceId : '-')}
          ${renderKv('工厂', getCaseFactoryName(detailCase))}
          ${renderKv('当前工序', getCaseProcessName(detailCase))}
          ${renderKv('任务状态', getTaskStatusLabel(task))}
          ${renderKv('当前问题', getSubCategoryLabel(detailCase))}
        </div>
        ${
          detailCase.reasonCode === 'START_OVERDUE'
            ? `
              <div class="grid grid-cols-2 gap-2">
                ${renderKv('接单时间', task?.acceptedAt || '-')}
                ${renderKv('中标时间', task?.awardedAt || '-')}
                ${renderKv('开工时限', task?.startDueAt || '-')}
                ${renderKv('是否已开工', task?.startedAt ? '已开工' : '未开工')}
              </div>
            `
            : ''
        }
        ${
          detailCase.sourceType === 'FACTORY_PAUSE_REPORT'
            ? `
              <div class="grid grid-cols-2 gap-2">
                ${renderKv('暂停原因', detailCase.pauseReasonLabel || getReasonLabel(detailCase))}
                ${renderKv('上报时间', detailCase.pauseReportedAt || '-')}
              </div>
              <p class="text-sm text-muted-foreground">暂停说明：${escapeHtml(detailCase.pauseRemark || '—')}</p>
              <p class="text-xs text-muted-foreground">
                暂停凭证：${detailCase.pauseProofFiles?.length || 0} 个 ｜ 关键节点：${
                  formatMilestoneSnapshot(detailCase.milestoneSnapshot)
                }
              </p>
            `
            : ''
        }
      </div>
    `
  }

  if (unifiedCategory === 'TECH_PACK') {
    return `
      <div class="space-y-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
        <p class="text-sm font-medium text-purple-700">技术包异常来源明细</p>
        <div class="grid grid-cols-2 gap-2">
          ${renderKv('生产单号', firstOrderId)}
          ${renderKv('任务号', firstTaskId)}
          ${renderKv('技术包状态', getSubCategoryLabel(detailCase))}
          ${renderKv('技术包版本', order?.techPackSnapshot?.versionLabel || '-')}
          ${renderKv('是否已发布', /未发布|缺失/.test(getSubCategoryLabel(detailCase)) ? '否' : '待确认')}
          ${renderKv('影响 SPU', order?.demandSnapshot.spuCode || '-')}
        </div>
        <p class="text-sm text-muted-foreground">来源说明：${escapeHtml(detailCase.detail)}</p>
      </div>
    `
  }

  if (unifiedCategory === 'MATERIAL') {
    if (isCuttingClaimDisputeCase(detailCase)) {
      return renderClaimDisputeSourcePanel(detailCase)
    }
    const totalRequested = materialRows.reduce((sum, row) => sum + row.requestedQty, 0)
    const totalIssued = materialRows.reduce((sum, row) => sum + row.issuedQty, 0)
    return `
      <div class="space-y-3 rounded-lg border border-teal-200 bg-teal-50 p-4">
        <p class="text-sm font-medium text-teal-700">领料异常来源明细</p>
        <div class="grid grid-cols-2 gap-2">
          ${renderKv('生产单号', firstOrderId)}
          ${renderKv('任务号', firstTaskId)}
          ${renderKv('异常类型', getSubCategoryLabel(detailCase))}
          ${renderKv('领料记录数', String(materialRows.length))}
          ${renderKv('累计需求数量', `${totalRequested || 0}`)}
          ${renderKv('累计已领数量', `${totalIssued || 0}`)}
        </div>
        ${
          materialRows.length > 0
            ? `
              <div class="space-y-1 rounded-md border bg-background p-2">
                ${materialRows
                  .slice(0, 3)
                  .map((row) => `<p class="text-xs text-muted-foreground">${escapeHtml(row.issueId)}｜${escapeHtml(row.materialSummaryZh)}｜${row.issuedQty}/${row.requestedQty}</p>`)
                  .join('')}
                ${materialRows.length > 3 ? `<p class="text-xs text-muted-foreground">还有 ${materialRows.length - 3} 条记录</p>` : ''}
              </div>
            `
            : '<p class="text-xs text-muted-foreground">暂无领料记录，当前异常由任务链路自动沉淀。</p>'
        }
      </div>
    `
  }

  return `
    <div class="space-y-3 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
      <p class="text-sm font-medium text-cyan-700">交出异常来源明细</p>
      <p class="text-xs text-cyan-700">交接链路情况</p>
      <div class="grid grid-cols-2 gap-2">
        ${renderKv('生产单号', firstOrderId)}
        ${renderKv('任务号', firstTaskId)}
        ${renderKv('异常类型', getSubCategoryLabel(detailCase))}
        ${renderKv('当前交接状态', handoverTaskSummary?.processStatusLabel || handoverOrderSummary?.currentBottleneckLabel || '暂无交接事件')}
        ${renderKv('当前卡点', handoverOrderSummary?.currentBottleneckLabel || '暂无卡点')}
        ${renderKv('下一步', handoverTaskSummary?.nextActionHint || handoverOrderSummary?.currentBottleneckHint || '当前暂无处理动作')}
      </div>
      <div class="rounded-md border bg-background p-2 text-xs text-muted-foreground">
        <p>最近事件时间：${escapeHtml(handoverTaskSummary?.latestOccurredAt || handoverOrderSummary?.latestOccurredAt || '-')}</p>
        <p class="mt-1">待处理节点：${handoverOrderSummary?.pendingCount || 0} ｜ 异议节点：${handoverOrderSummary?.objectionCount || 0}</p>
        <p class="mt-1">说明：当前交接情况来自交接链路事实台帐，可直接跳转查看明细记录。</p>
      </div>
    </div>
  `
}

export function renderActionsTab(detailCase: ExceptionCase): string {
  const firstTaskId = detailCase.relatedTaskIds[0] || ''
  const firstOrderId = detailCase.relatedOrderIds[0] || ''
  const firstTenderId = detailCase.relatedTenderIds[0] || ''
  const unifiedCategory = getUnifiedCategory(detailCase)
  const uiStatus = normalizeCaseStatus(detailCase.caseStatus)
  const canUrge = Boolean(detailCase.ownerUserId && (uiStatus === 'OPEN' || uiStatus === 'IN_PROGRESS'))
  const judge = getResolveJudgeResult(detailCase)
  const processingCards: string[] = []
  const linkCards: string[] = []
  const claimDisputeActionPanel = isCuttingClaimDisputeCase(detailCase) ? renderClaimDisputeActionPanel(detailCase) : ''

  if (unifiedCategory === 'ASSIGNMENT') {
    if (['TENDER_OVERDUE', 'TENDER_NEAR_DEADLINE'].includes(detailCase.reasonCode) && detailCase.relatedTenderIds.length > 0) {
      processingCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="open-extend-dialog" data-case-id="${escapeAttr(detailCase.caseId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="clock" class="h-5 w-5 text-blue-600"></i>
            <div>
              <p class="font-medium">延长竞价</p>
              <p class="text-xs text-muted-foreground">将关联竞价统一延长 24 小时</p>
            </div>
          </div>
        </button>
      `)
    }
    if (['TENDER_OVERDUE', 'NO_BID', 'DISPATCH_REJECTED', 'ACK_TIMEOUT'].includes(detailCase.reasonCode)) {
      processingCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="row-reassign" data-task-id="${escapeAttr(firstTaskId)}" data-order-id="${escapeAttr(firstOrderId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="send" class="h-5 w-5 text-orange-600"></i>
            <div>
              <p class="font-medium">重新分配</p>
              <p class="text-xs text-muted-foreground">进入任务分配页面处理派单/竞价</p>
            </div>
          </div>
        </button>
      `)
    }
    if (canUrge) {
      processingCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="urge-owner" data-case-id="${escapeAttr(detailCase.caseId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="bell" class="h-5 w-5 text-amber-600"></i>
            <div>
              <p class="font-medium">催接单</p>
              <p class="text-xs text-muted-foreground">提醒责任人尽快推进分配处理</p>
            </div>
          </div>
        </button>
      `)
    }
    if (firstTenderId) {
      linkCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="goto-tender" data-tender-id="${escapeAttr(firstTenderId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="file-search" class="h-5 w-5 text-blue-600"></i>
            <div>
              <p class="font-medium">查看招标单</p>
              <p class="text-xs text-muted-foreground">查看竞价与派单上下文</p>
            </div>
          </div>
        </button>
      `)
    }
    if (firstTaskId) {
      linkCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="goto-task" data-task-id="${escapeAttr(firstTaskId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="list-checks" class="h-5 w-5 text-indigo-600"></i>
            <div>
              <p class="font-medium">查看任务</p>
              <p class="text-xs text-muted-foreground">查看任务当前分配状态</p>
            </div>
          </div>
        </button>
      `)
    }
  }

  if (unifiedCategory === 'EXECUTION' && detailCase.reasonCode === 'START_OVERDUE') {
    if (canUrge) {
      processingCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="urge-owner" data-case-id="${escapeAttr(detailCase.caseId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="bell" class="h-5 w-5 text-amber-600"></i>
            <div>
              <p class="font-medium">催办</p>
              <p class="text-xs text-muted-foreground">提醒责任人推动工厂尽快开工</p>
            </div>
          </div>
        </button>
      `)
    }
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="go-start" data-task-id="${escapeAttr(firstTaskId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="play" class="h-5 w-5 text-green-600"></i>
          <div>
            <p class="font-medium">去开工</p>
            <p class="text-xs text-muted-foreground">进入 PDA 执行详情补齐开工信息</p>
          </div>
        </div>
      </button>
    `)
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="goto-pda-task" data-task-id="${escapeAttr(firstTaskId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="smartphone" class="h-5 w-5 text-blue-600"></i>
          <div>
            <p class="font-medium">查看 PDA 任务</p>
            <p class="text-xs text-muted-foreground">查看工厂端当前任务状态</p>
          </div>
        </div>
      </button>
    `)
  }

  if (unifiedCategory === 'EXECUTION' && detailCase.sourceType === 'FACTORY_PAUSE_REPORT') {
    if (uiStatus !== 'CLOSED') {
      processingCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="pause-allow-continue" data-case-id="${escapeAttr(detailCase.caseId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="play" class="h-5 w-5 text-green-600"></i>
            <div>
              <p class="font-medium">允许继续</p>
              <p class="text-xs text-muted-foreground">恢复执行并判定为已解决</p>
            </div>
          </div>
        </button>
      `)
    }
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="open-detail" data-case-id="${escapeAttr(detailCase.caseId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="clipboard-list" class="h-5 w-5 text-blue-600"></i>
          <div>
            <p class="font-medium">查看暂停详情</p>
            <p class="text-xs text-muted-foreground">查看暂停原因、说明与凭证</p>
          </div>
        </div>
      </button>
    `)
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="goto-pda-task" data-task-id="${escapeAttr(firstTaskId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="smartphone" class="h-5 w-5 text-indigo-600"></i>
          <div>
            <p class="font-medium">查看 PDA 任务</p>
            <p class="text-xs text-muted-foreground">查看工厂暂停任务状态</p>
          </div>
        </div>
      </button>
    `)
  }

  if (
    unifiedCategory === 'EXECUTION' &&
    detailCase.sourceType !== 'FACTORY_PAUSE_REPORT' &&
    detailCase.reasonCode.startsWith('BLOCKED_') &&
    uiStatus !== 'CLOSED'
  ) {
    processingCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="open-unblock-dialog" data-case-id="${escapeAttr(detailCase.caseId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="play" class="h-5 w-5 text-green-600"></i>
          <div>
            <p class="font-medium">恢复执行</p>
            <p class="text-xs text-muted-foreground">确认处理结果后恢复任务继续执行</p>
          </div>
        </div>
      </button>
    `)
  }

  if (unifiedCategory === 'EXECUTION' && firstTaskId && detailCase.sourceType !== 'FACTORY_PAUSE_REPORT' && detailCase.reasonCode !== 'START_OVERDUE') {
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="goto-pda-task" data-task-id="${escapeAttr(firstTaskId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="smartphone" class="h-5 w-5 text-indigo-600"></i>
          <div>
            <p class="font-medium">查看 PDA 任务</p>
            <p class="text-xs text-muted-foreground">查看执行进度与当前现场状态</p>
          </div>
        </div>
      </button>
    `)
  }

  if (unifiedCategory === 'TECH_PACK') {
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-tech-pack" data-case-id="${escapeAttr(detailCase.caseId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="file-text" class="h-5 w-5 text-purple-600"></i>
          <div>
            <p class="font-medium">查看技术包</p>
            <p class="text-xs text-muted-foreground">查看技术包状态与版本信息</p>
          </div>
        </div>
      </button>
    `)
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-tech-pack" data-case-id="${escapeAttr(detailCase.caseId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="edit-3" class="h-5 w-5 text-purple-600"></i>
          <div>
            <p class="font-medium">去技术包处理</p>
            <p class="text-xs text-muted-foreground">前往技术包页面补充并发布</p>
          </div>
        </div>
      </button>
    `)
  }

  if (unifiedCategory === 'HANDOUT') {
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-view-handover" data-order-id="${escapeAttr(firstOrderId)}" data-task-id="${escapeAttr(firstTaskId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="scan-line" class="h-5 w-5 text-cyan-600"></i>
          <div>
            <p class="font-medium">查看交接链路</p>
            <p class="text-xs text-muted-foreground">查看交出头、交出记录、仓库确认和异议处理</p>
          </div>
        </div>
      </button>
    `)
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-view-handover-objection" data-order-id="${escapeAttr(firstOrderId)}" data-task-id="${escapeAttr(firstTaskId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="alert-circle" class="h-5 w-5 text-amber-600"></i>
          <div>
            <p class="font-medium">查看数量异议</p>
            <p class="text-xs text-muted-foreground">查看异议状态并联动平台处理</p>
          </div>
        </div>
      </button>
    `)
  }

  if (unifiedCategory === 'MATERIAL') {
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-view-material" data-order-id="${escapeAttr(firstOrderId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="package" class="h-5 w-5 text-teal-600"></i>
          <div>
            <p class="font-medium">查看领料进度</p>
            <p class="text-xs text-muted-foreground">联动物料齐套状态与缺口</p>
          </div>
        </div>
      </button>
    `)
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-view-material" data-order-id="${escapeAttr(firstOrderId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="list" class="h-5 w-5 text-teal-600"></i>
          <div>
            <p class="font-medium">查看领料详情</p>
            <p class="text-xs text-muted-foreground">查看领料记录与未闭合项</p>
          </div>
        </div>
      </button>
    `)
  }

  return `
    <div class="space-y-4">
      ${claimDisputeActionPanel}
      <div class="rounded-md border p-3">
        <p class="text-sm font-medium">处理动作</p>
        <div class="mt-3 grid grid-cols-2 gap-3">
          ${
            processingCards.length > 0
              ? processingCards.join('')
              : '<div class="col-span-2 rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前异常暂无专项处理动作</div>'
          }
        </div>
      </div>

      <div class="rounded-md border p-3">
        <p class="text-sm font-medium">去业务页处理</p>
        <div class="mt-3 grid grid-cols-2 gap-3">
          ${
            linkCards.length > 0
              ? linkCards.join('')
              : '<div class="col-span-2 rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前异常暂无业务页入口</div>'
          }
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-md border p-3">
          <p class="text-sm">指派责任人</p>
          <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-pe-action="assign-owner" data-case-id="${escapeAttr(detailCase.caseId)}">
            <option value="">选择责任人</option>
            ${OWNER_OPTIONS.map((item) => `<option value="${item.id}" ${detailCase.ownerUserId === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
          </select>
        </div>

        <div class="rounded-md border p-3">
          <p class="text-sm">记录跟进</p>
          ${
            uiStatus === 'CLOSED'
              ? '<p class="mt-2 text-xs text-muted-foreground">异常已关闭，跟进动作已停用。</p>'
              : `
                <p class="mt-1 text-xs text-muted-foreground">用于同步处理进展，待处理异常会自动转为处理中。</p>
                <button class="mt-2 inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="open-pause-followup-dialog" data-case-id="${escapeAttr(detailCase.caseId)}">
                  <i data-lucide="message-square" class="mr-1.5 h-4 w-4"></i>记录跟进
                </button>
              `
          }
        </div>
      </div>

      <div class="rounded-md border p-3">
        <p class="text-sm">关闭异常</p>
        ${
          uiStatus === 'CLOSED'
            ? '<p class="mt-2 text-xs text-muted-foreground">当前异常已关闭。</p>'
            : `
              <p class="mt-1 text-xs text-muted-foreground">关闭时需填写原因。已解决异常可常规关闭，误报/重复/并单/业务对象失效可直接关闭。</p>
              <button class="mt-2 inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="open-close-dialog" data-case-id="${escapeAttr(detailCase.caseId)}">
                <i data-lucide="x-circle" class="mr-1.5 h-4 w-4"></i>关闭异常
              </button>
            `
        }
      </div>

      <div class="rounded-md border border-blue-200 bg-blue-50 p-3">
        <p class="text-sm font-medium text-blue-700">解决判定</p>
        <p class="mt-1 text-xs text-blue-700">规则：${escapeHtml(judge.ruleText)}</p>
        <p class="mt-1 text-xs text-blue-700">当前结果：${escapeHtml(judge.currentResultText)}</p>
      </div>
    </div>
  `
}

export function renderTimelineTab(detailCase: ExceptionCase): string {
  const renderAuditDetail = (detail: string): string =>
    escapeHtml(detail)
      .replaceAll('PRODUCTION_BLOCK', 'EXECUTION')

  const timelineItems = [
    ...detailCase.actions.map((item) => ({
      id: `A-${item.id}`,
      at: item.at,
      by: item.by,
      action: item.actionType,
      detail: item.actionDetail,
      tone: 'action' as const,
    })),
    ...detailCase.auditLogs.map((item) => ({
      id: `L-${item.id}`,
      at: item.at,
      by: item.by,
      action: item.action,
      detail: item.detail,
      tone: 'log' as const,
    })),
  ].sort((a, b) => parseTimestampToMs(b.at) - parseTimestampToMs(a.at))

  return `
    <div class="space-y-2">
      ${
        timelineItems.length === 0
          ? '<p class="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">暂无操作日志</p>'
          : timelineItems
              .map(
                (item) => `
                  <div class="rounded-md border px-3 py-2">
                    <div class="flex items-center justify-between gap-2">
                      <p class="text-sm font-medium">${escapeHtml(item.action)}</p>
                      <span class="text-xs text-muted-foreground">${escapeHtml(item.at)}</span>
                    </div>
                    <p class="mt-1 text-sm text-muted-foreground">${item.tone === 'log' ? renderAuditDetail(item.detail) : escapeHtml(item.detail)}</p>
                    <p class="mt-1 text-xs text-muted-foreground">操作人：${escapeHtml(item.by)}</p>
                  </div>
                `,
              )
              .join('')
      }
    </div>
  `
}

export function renderDetailDrawer(): string {
  if (!state.detailCaseId) return ''

  const detailCase = getCaseById(state.detailCaseId)
  if (!detailCase) return ''

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-pe-action="close-detail" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full max-w-[680px] overflow-y-auto border-l bg-background shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur">
          <div class="flex items-center justify-between gap-3">
            <h3 class="flex items-center gap-2 text-lg font-semibold">
              异常详情 - ${escapeHtml(detailCase.caseId)}
              ${renderBadge(detailCase.severity, SEVERITY_COLOR_CLASS[detailCase.severity])}
              ${renderStatusBadge(detailCase.caseStatus)}
            </h3>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-pe-action="close-detail" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </div>

        <div class="space-y-5 px-6 py-5">
          <section class="space-y-3 rounded-lg border p-4">
            <h4 class="text-sm font-semibold">基础信息</h4>
            ${renderBasicTab(detailCase)}
          </section>

          <section class="space-y-3 rounded-lg border p-4">
            <h4 class="text-sm font-semibold">关联对象</h4>
            ${renderRelatedTab(detailCase)}
          </section>

          <section class="space-y-3 rounded-lg border p-4">
            <h4 class="text-sm font-semibold">来源明细</h4>
            ${renderSourceTab(detailCase)}
          </section>

          <section class="space-y-3 rounded-lg border p-4">
            <h4 class="text-sm font-semibold">处理动作</h4>
            ${renderActionsTab(detailCase)}
          </section>

          <section class="space-y-3 rounded-lg border p-4">
            <h4 class="text-sm font-semibold">操作日志</h4>
            ${renderTimelineTab(detailCase)}
          </section>
        </div>
      </section>
    </div>
  `
}

export function renderCloseDialog(): string {
  if (!state.closeDialogCaseId) return ''

  const exc = getCaseById(state.closeDialogCaseId)
  if (!exc) return ''
  const uiStatus = normalizeCaseStatus(exc.caseStatus)

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-pe-action="close-close-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">关闭异常</h3>
          <p class="text-sm text-muted-foreground">异常 ${escapeHtml(exc.caseId)} 当前状态：${escapeHtml(CASE_STATUS_LABEL[uiStatus])}</p>
        </header>

        <div class="mt-4 space-y-3">
          <div>
            <label class="text-sm">关闭原因 *</label>
            <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-pe-field="closeReason">
              ${Object.entries(CLOSE_REASON_LABEL)
                .map(
                  ([value, label]) =>
                    `<option value="${value}" ${state.closeReason === value ? 'selected' : ''}>${escapeHtml(label)}</option>`,
                )
                .join('')}
            </select>
          </div>

          ${
            state.closeReason === 'DUPLICATE' || state.closeReason === 'MERGED'
              ? `
                <div>
                  <label class="text-sm">关联异常号（选填）</label>
                  <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="例如 EX-202603-0008" data-pe-field="closeMergeCaseId" value="${escapeAttr(state.closeMergeCaseId)}" />
                </div>
              `
              : ''
          }

          <div>
            <label class="text-sm">关闭备注${DIRECT_CLOSE_REASON_SET.has(state.closeReason) ? ' *' : ''}</label>
            <textarea class="mt-1 min-h-[92px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请填写关闭依据..." data-pe-field="closeRemark">${escapeHtml(state.closeRemark)}</textarea>
          </div>

          <p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            关闭规则：已解决后可常规关闭；误报、重复异常、并入其他异常、业务对象失效可直接关闭。
          </p>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pe-action="close-close-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-pe-action="confirm-close-exception">确认关闭</button>
        </footer>
      </section>
    </div>
  `
}

export function renderUnblockDialog(): string {
  if (!state.unblockDialogCaseId) return ''

  const exc = getCaseById(state.unblockDialogCaseId)
  if (!exc) return ''

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-pe-action="close-unblock-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">确认恢复执行</h3>
          <p class="text-sm text-muted-foreground">异常 ${escapeHtml(exc.caseId)}：将解除关联生产暂停任务并转为处理中。</p>
        </header>

        <div class="mt-4">
          <label class="text-sm">处理备注 *</label>
          <textarea class="mt-1 min-h-[92px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请填写处理备注..." data-pe-field="unblockRemark">${escapeHtml(state.unblockRemark)}</textarea>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pe-action="close-unblock-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-pe-action="confirm-unblock">确认</button>
        </footer>
      </section>
    </div>
  `
}

export function renderExtendDialog(): string {
  if (!state.extendDialogCaseId) return ''

  const exc = getCaseById(state.extendDialogCaseId)
  if (!exc) return ''

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-pe-action="close-extend-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">确认延长竞价</h3>
          <p class="text-sm text-muted-foreground">异常 ${escapeHtml(exc.caseId)}：将关联竞价统一延长 24 小时。</p>
        </header>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pe-action="close-extend-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-pe-action="confirm-extend-dialog">确认</button>
        </footer>
      </section>
    </div>
  `
}

export function renderPauseFollowUpDialog(): string {
  if (!state.pauseFollowUpCaseId) return ''

  const exc = getCaseById(state.pauseFollowUpCaseId)
  if (!exc) return ''
  const isPauseReport = exc.sourceType === 'FACTORY_PAUSE_REPORT'

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-pe-action="close-pause-followup-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">记录跟进</h3>
          <p class="text-sm text-muted-foreground">
            异常 ${escapeHtml(exc.caseId)}：${isPauseReport ? '记录平台跟进信息，任务继续保持生产暂停。' : '记录当前处理进展并同步状态。'}
          </p>
        </header>

        <div class="mt-4">
          <label class="text-sm">跟进备注 *</label>
          <textarea class="mt-1 min-h-[92px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请填写跟进内容..." data-pe-field="pauseFollowUpRemark">${escapeHtml(state.pauseFollowUpRemark)}</textarea>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pe-action="close-pause-followup-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-pe-action="confirm-pause-followup">确认</button>
        </footer>
      </section>
    </div>
  `
}
