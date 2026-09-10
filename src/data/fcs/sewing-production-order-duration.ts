import { listSewingOutsourcingWorkbenchRows } from './sewing-outsourcing-workbench.ts'
import { listSewingOutsourcingReturnTrackingRows } from './sewing-outsourcing-return-tracking.ts'
import { listMaterialPrepOrderProjections } from './cutting/production-material-prep.ts'
import { listProcessWorkOrders } from './process-work-order-domain.ts'
import { listSpecialCraftTaskOrders } from './special-craft-task-orders.ts'
import { listCutPieceReleaseAvailableQtyVersions } from './cut-piece-release.ts'

export const SEWING_DURATION_NODES = ['面辅料采购', '面料加工', '裁剪配料', '完成裁剪', '特殊工艺加工', '裁片放行', '外发加工派单', '30%回货', '70%回货', '100%回货'] as const
export type SewingDurationNodeName = typeof SEWING_DURATION_NODES[number]
export interface SewingDurationSource {
  id: string; no: string; label: string; task: string; factory: string; status: string
  startAt: string; endAt: string; version: string; included: boolean; reason: string; href: string
}
export interface SewingDurationNode {
  name: SewingDurationNodeName; startAt: string; endAt: string; hours: number | null; sources: SewingDurationSource[]; reason: string
}
export interface SewingProductionOrderDurationRow {
  productionOrderId: string; productionOrderNo: string; styleCode: string; styleName: string; imageUrl: string
  ppicNames: string[]; factoryNames: string[]; taskKinds: string[]; deliveryDate: string; nodes: SewingDurationNode[]
}
const minTime = (values: string[]) => values.filter(Boolean).sort()[0] || ''
const maxTime = (values: string[]) => values.filter(Boolean).sort().at(-1) || ''
export function calculateActualDurationHours(startAt: string, endAt: string, nowAt: string): number | null {
  if (!startAt) return null
  const parse = (value: string) => Date.parse(value.replace(' ', 'T') + (/[zZ]|[+-]\d\d:\d\d$/.test(value) ? '' : '+08:00'))
  const elapsed = parse(endAt || nowAt) - parse(startAt)
  return Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed / 36000) / 100 : null
}
export function aggregateSewingDurationNode(name: SewingDurationNodeName, sources: SewingDurationSource[], nowAt: string, reason = ''): SewingDurationNode {
  const unique = [...new Map(sources.map((source) => [source.id, source])).values()]
  const included = unique.filter((source) => source.included)
  const startAt = minTime(included.map((source) => source.startAt))
  const endAt = included.length && included.every((source) => source.endAt) ? maxTime(included.map((source) => source.endAt)) : ''
  return { name, startAt, endAt, hours: calculateActualDurationHours(startAt, endAt, nowAt), sources: unique, reason }
}

const DURATION_DEMO_NODE_DOCUMENTS: Record<SewingDurationNodeName, { prefix: string; label: string; href: string }> = {
  面辅料采购: { prefix: 'PUR', label: '采购单', href: '/fcs/material-prep/sewing' },
  面料加工: { prefix: 'DYE', label: '面料加工单', href: '/fcs/craft/dyeing' },
  裁剪配料: { prefix: 'PREP', label: '裁剪配料单', href: '/fcs/material-prep/cutting' },
  完成裁剪: { prefix: 'CUT', label: '裁剪任务单', href: '/fcs/craft/cutting' },
  特殊工艺加工: { prefix: 'CRAFT', label: '特殊工艺加工单', href: '/fcs/process-factory/special-craft' },
  裁片放行: { prefix: 'REL', label: '裁片放行单', href: '/fcs/craft/cutting/cut-piece-release' },
  外发加工派单: { prefix: 'ASG', label: '外发任务分配单', href: '/fcs/dispatch/workbench' },
  '30%回货': { prefix: 'RET30', label: '30%回货确认单', href: '/fcs/sewing-outsourcing/returns' },
  '70%回货': { prefix: 'RET70', label: '70%回货确认单', href: '/fcs/sewing-outsourcing/returns' },
  '100%回货': { prefix: 'RET100', label: '100%回货确认单', href: '/fcs/sewing-outsourcing/returns' },
}

const DURATION_DEMO_SCENARIOS = [
  { suffix: '0101', completedThrough: 9, currentNode: -1, offsetDays: 0, taskKind: '独立车缝' },
  { suffix: '0102', completedThrough: 8, currentNode: 9, offsetDays: 5, taskKind: '车缝+烫包' },
  { suffix: '0103', completedThrough: 7, currentNode: 8, offsetDays: 10, taskKind: '裁剪+车缝+烫包' },
  { suffix: '0104', completedThrough: 6, currentNode: 7, offsetDays: 15, taskKind: '独立车缝' },
  { suffix: '0105', completedThrough: 5, currentNode: 6, offsetDays: 20, taskKind: '车缝+烫包' },
  { suffix: '0106', completedThrough: 4, currentNode: 5, offsetDays: 25, taskKind: '裁剪+车缝+烫包' },
  { suffix: '0107', completedThrough: 3, currentNode: 4, offsetDays: 30, taskKind: '独立车缝' },
  { suffix: '0108', completedThrough: 2, currentNode: 3, offsetDays: 35, taskKind: '车缝+烫包' },
  { suffix: '0109', completedThrough: 0, currentNode: 1, offsetDays: 40, taskKind: '裁剪+车缝+烫包' },
  { suffix: '0110', completedThrough: -1, currentNode: 0, offsetDays: 45, taskKind: '独立车缝' },
] as const

const DURATION_DEMO_NODE_TIMING = [
  { startOffset: 0, durationDays: 3 },
  { startOffset: 4, durationDays: 4 },
  { startOffset: 9, durationDays: 1 },
  { startOffset: 11, durationDays: 5 },
  { startOffset: 17, durationDays: 3 },
  { startOffset: 21, durationDays: 0 },
  { startOffset: 22, durationDays: 1 },
  { startOffset: 24, durationDays: 6 },
  { startOffset: 31, durationDays: 8 },
  { startOffset: 40, durationDays: 7 },
] as const

function formatDurationDemoTimestamp(dayOffset: number, hour: number, minute = 0): string {
  const value = new Date(Date.UTC(2026, 5, 1 + dayOffset, hour, minute))
  return value.toISOString().slice(0, 19).replace('T', ' ')
}

function formatDurationDemoDate(dayOffset: number): string {
  return formatDurationDemoTimestamp(dayOffset, 0).slice(0, 10)
}

function buildDurationDemoReleaseSources(
  productionOrderNo: string,
  suffix: string,
  startDay: number,
  isCompleted: boolean,
): SewingDurationSource[] {
  const releaseDocumentNo = `REL-${suffix}`
  const releases = isCompleted
    ? [
        { hour: 8, minute: 30, before: 0, after: 400 },
        { hour: 13, minute: 40, before: 400, after: 700 },
        { hour: 18, minute: 10, before: 700, after: 1000 },
      ]
    : [
        { hour: 8, minute: 30, before: 0, after: 400 },
        { hour: 13, minute: 40, before: 400, after: 700 },
      ]

  return releases.map((release, index) => {
    const confirmedAt = formatDurationDemoTimestamp(startDay, release.hour, release.minute)
    return {
      id: `${productionOrderNo}-REL-V${index + 1}`,
      no: releaseDocumentNo,
      label: `第${index + 1}次放行 · V${index + 1} · 本次${release.after - release.before}件 · 累计${release.before}→${release.after}件`,
      task: '',
      factory: '',
      status: release.after >= 1000 ? '已达当前目标' : '已有效放行',
      startAt: confirmedAt,
      endAt: isCompleted && index === releases.length - 1 ? confirmedAt : '',
      version: `V${index + 1}`,
      included: true,
      reason: '',
      href: '/fcs/craft/cutting/cut-piece-release',
    }
  })
}

function buildDurationDemoRows(
  identities: SewingProductionOrderDurationRow[],
  nowAt: string,
): SewingProductionOrderDurationRow[] {
  if (!identities.length) return []
  return DURATION_DEMO_SCENARIOS.map((scenario, scenarioIndex) => {
    const identity = identities[scenarioIndex % identities.length]
    const productionOrderNo = `PO-202609-${scenario.suffix}`
    const nodes = SEWING_DURATION_NODES.map((name, nodeIndex) => {
      const isCompleted = nodeIndex <= scenario.completedThrough
      const isCurrent = nodeIndex === scenario.currentNode
      if (!isCompleted && !isCurrent) return aggregateSewingDurationNode(name, [], nowAt)
      const document = DURATION_DEMO_NODE_DOCUMENTS[name]
      const timing = DURATION_DEMO_NODE_TIMING[nodeIndex]
      const startDay = scenario.offsetDays + timing.startOffset
      if (name === '裁片放行') {
        const sources = buildDurationDemoReleaseSources(productionOrderNo, scenario.suffix, startDay, isCompleted)
        const node = aggregateSewingDurationNode(name, sources, nowAt)
        node.startAt = sources[0]?.startAt || ''
        node.endAt = isCompleted ? sources.at(-1)?.endAt || '' : ''
        node.hours = calculateActualDurationHours(node.startAt, node.endAt, nowAt)
        return node
      }
      const sources = [0, 1].map((sourceIndex): SewingDurationSource => ({
        id: `${productionOrderNo}-${document.prefix}-${sourceIndex + 1}`,
        no: `${document.prefix}-${scenario.suffix}-${String(sourceIndex + 1).padStart(2, '0')}`,
        label: document.label,
        task: `TASK-SEW-${scenario.suffix}-${String(sourceIndex + 1).padStart(2, '0')}`,
        factory: sourceIndex === 0 ? 'CV Micro Sewing Jakarta Pusat' : 'PT Sinar Garment Indonesia',
        status: isCompleted ? '已完成' : '进行中',
        startAt: formatDurationDemoTimestamp(startDay, sourceIndex === 0 ? 8 : 10, sourceIndex === 0 ? 30 : 15),
        endAt: isCompleted ? formatDurationDemoTimestamp(startDay + timing.durationDays, sourceIndex === 0 ? 16 : 18, sourceIndex === 0 ? 20 : 10) : '',
        version: 'V1',
        included: true,
        reason: '',
        href: document.href,
      }))
      return aggregateSewingDurationNode(name, sources, nowAt)
    })
    return {
      productionOrderId: productionOrderNo,
      productionOrderNo,
      styleCode: identity.styleCode,
      styleName: identity.styleName,
      imageUrl: identity.imageUrl,
      ppicNames: identity.ppicNames,
      factoryNames: ['CV Micro Sewing Jakarta Pusat', 'PT Sinar Garment Indonesia'],
      taskKinds: [scenario.taskKind],
      deliveryDate: formatDurationDemoDate(scenario.offsetDays + 45),
      nodes,
    }
  })
}

export function listSewingProductionOrderDurations(input: { viewerPpicId: string; leaderView?: boolean; selectedPpicId?: string; nowAt: string }): SewingProductionOrderDurationRow[] {
  const visible = listSewingOutsourcingWorkbenchRows(input)
  const returnRows = listSewingOutsourcingReturnTrackingRows(input.nowAt)
  const preparation = listMaterialPrepOrderProjections()
  const processes = listProcessWorkOrders()
  const crafts = listSpecialCraftTaskOrders()
  const derivedRows = [...new Set(visible.map((task) => task.productionOrderId))].map((id) => {
    const tasks = visible.filter((task) => task.productionOrderId === id)
    const identity = tasks[0]
    const prep = preparation.filter((row) => row.order.productionOrderId === id)
    const sources: Record<SewingDurationNodeName, SewingDurationSource[]> = Object.fromEntries(SEWING_DURATION_NODES.map((name) => [name, [] as SewingDurationSource[]])) as Record<SewingDurationNodeName, SewingDurationSource[]>
    for (const row of prep) {
      for (const line of row.lines.filter((line) => line.upstreamSourceType === '采购')) sources['面辅料采购'].push({ id: `PURCHASE-${line.prepLineId}`, no: line.upstreamDocumentNo, label: `${line.materialName} ${line.materialSku}`, task: '', factory: '', status: line.upstreamProgressStatus, startAt: '', endAt: '', version: '', included: true, reason: '当前配料来源未提供采购行与有效收货时间关联，不能用预计到料时间代替实际收货', href: '/fcs/material-prep/sewing' })
      for (const record of row.prepRecords.filter((record) => row.lines.some((line) => line.taskLinks.some((task) => task.taskType === '裁片任务') && (line.prepLineId === record.prepLineId || record.items?.some((item) => item.prepLineId === line.prepLineId))))) sources['裁剪配料'].push({ id: record.prepRecordId, no: record.batchNo, label: '配料确认', task: '', factory: '', status: record.recordStatus, startAt: '', endAt: record.recordStatus === 'CONFIRMED' ? record.confirmedAt : '', version: '', included: record.recordStatus !== 'REJECTED', reason: '尚缺中转仓首次整体配齐的历史时间；配料确认不能充当库存配齐时间', href: '/fcs/material-prep/cutting' })
      for (const record of row.pickupRecords) sources['完成裁剪'].push({ id: record.pickupRecordId, no: record.pickupRecordId, label: '领料记录', task: '', factory: record.receiverName, status: record.pickupStatus, startAt: record.pickedAt, endAt: '', version: '', included: false, reason: '需核对裁剪领料归属及全部有效铺布单完成集合，当前记录不单独证明裁剪完成', href: '/fcs/material-prep/cutting' })
    }
    for (const process of processes.filter((row) => row.productionOrderIds.includes(id) && row.sourceType === 'PRODUCTION_ORDER')) {
      const completedNodes = process.executionNodes.filter((node) => node.finishedAt)
      sources['面料加工'].push({ id: process.workOrderId, no: process.workOrderNo, label: `${process.processType} ${process.materialName}`, task: process.taskNo, factory: process.factoryName, status: process.statusLabel, startAt: process.createdAt, endAt: /已完成|已完结/.test(process.statusLabel) ? maxTime(completedNodes.map((node) => node.finishedAt || '')) : '', version: process.sourceSnapshot.techPackVersionLabel || '', included: !/作废|取消|替换/.test(process.statusLabel), reason: '开始取有效加工单生成时间；结束须该单完成且有加工完成记录', href: `/fcs/craft/${process.processType === 'PRINT' ? 'printing' : process.processType === 'DYE' ? 'dyeing' : 'water-soluble'}/work-orders/${encodeURIComponent(process.workOrderId)}` })
    }
    for (const craft of crafts.filter((row) => row.productionOrderId === id && ['AUXILIARY_CRAFT_FACTORY', 'SPECIAL_CRAFT_FACTORY'].includes(row.managementDomain))) {
      sources['特殊工艺加工'].push({ id: craft.taskOrderId, no: craft.taskOrderNo, label: craft.operationName || craft.processName, task: craft.sourceTaskId || '', factory: craft.factoryName, status: craft.status, startAt: minTime(craft.nodeRecords.filter((node) => node.actionName.includes('确认接收')).map((node) => node.operatedAt)), endAt: craft.status === '已完结' ? maxTime(craft.nodeRecords.filter((node) => node.afterStatus === '已完结').map((node) => node.operatedAt)) : '', version: String(craft.productionOrderVersion), included: true, reason: '只包含辅助／特种工艺；全部适用单据完成才形成结束时间', href: `/fcs/process-factory/special-craft/${craft.managementDomain === 'AUXILIARY_CRAFT_FACTORY' ? 'auxiliary' : 'special-type'}/work-orders/${encodeURIComponent(craft.taskOrderId)}` })
    }
    const releases = listCutPieceReleaseAvailableQtyVersions(id)
    const current = releases.find((version) => version.isLatestEffective)
    const history = current ? releases.filter((version) => version.basisTargetVersion === current.basisTargetVersion).sort((a,b) => a.confirmedAt.localeCompare(b.confirmedAt)) : []
    const firstRelease = history.find((version) => version.totalReleaseConfirmQty > 0)
    const targetReached = history.find((version) => version.totalReleaseConfirmQty >= current!.totalTargetQty && current!.totalTargetQty > 0)
    for (const [releaseIndex, version] of releases.entries()) sources['裁片放行'].push({ id: version.releaseVersionId, no: `REL-${identity.productionOrderNo.replace(/^PO-/, '')}`, label: `第${releaseIndex + 1}次放行 · V${version.releaseVersionNo} · 累计${version.beforeTotalReleaseConfirmQty}→${version.afterTotalReleaseConfirmQty}件 · 目标${version.totalTargetQty}件`, task: '', factory: '', status: version.releaseStatus, startAt: version.confirmedAt, endAt: version === targetReached ? version.confirmedAt : '', version: `V${version.releaseVersionNo}`, included: version.basisTargetVersion === current?.basisTargetVersion, reason: `${version.confirmedBy} ${version.confirmedAt}；${version.riskReason || '无风险原因'}；${version === firstRelease ? '入选首次有效放行' : version === targetReached ? '入选当前目标首次达成' : '历史依据'}`, href: '/fcs/craft/cutting/cut-piece-release' })
    for (const task of tasks) sources['外发加工派单'].push({ id: task.assignmentId, no: task.taskNo, label: task.taskKindLabel, task: task.runtimeTaskId, factory: task.factoryName, status: '有效分配', startAt: '', endAt: '', version: task.assignmentId, included: true, reason: '缺少分配当时各门禁最后满足的来源时间，不能用当前配齐状态倒推', href: '/fcs/dispatch/workbench' })
    for (const ratio of [0.3, 0.7, 1] as const) {
      const name = `${Math.round(ratio * 100)}%回货` as SewingDurationNodeName
      // 聚合整张生产单的全部有效任务，不能用当前PPIC筛选后的子集判定整单达成。
      for (const task of returnRows.filter((row) => row.assignment.productionOrderId === id)) {
        const target = Math.ceil(task.assignment.assignedQty * ratio)
        let cumulative = 0; let reachedAt = ''
        const versions = task.confirmationVersions.filter((version) => version.status === 'ACTIVE').sort((a,b) => a.confirmedAt.localeCompare(b.confirmedAt))
        for (const version of versions) { cumulative += version.confirmedQty; if (!reachedAt && cumulative >= target) reachedAt = version.confirmedAt }
        sources[name].push({ id: task.assignment.assignmentId, no: task.assignment.taskNo || task.assignment.runtimeTaskId, label: `目标 ${target}件；后道确认 ${task.confirmedQty}件`, task: task.assignment.runtimeTaskId, factory: task.assignment.factoryName, status: task.acceptedAt ? '已接单' : '未有有效接单时间', startAt: task.acceptedAt, endAt: task.acceptedAt ? reachedAt : '', version: task.assignment.assignmentId, included: true, reason: '各任务独立达标后取最晚达成；不跨工厂抵扣', href: `/fcs/sewing-outsourcing/returns?assignmentId=${encodeURIComponent(task.assignment.assignmentId)}` })
        for (const version of task.confirmationVersions) sources[name].push({ id: version.confirmationVersionId, no: version.deliveryOrderNo, label: `${version.confirmedQty}件，确认 ${version.confirmedAt}`, task: task.assignment.runtimeTaskId, factory: task.assignment.factoryName, status: version.status, startAt: '', endAt: '', version: version.confirmationVersionId, included: false, reason: version.status === 'ACTIVE' ? '有效收货明细，已累计至所属任务，不重复计入' : '已订正旧版本，不参加当前数量计算', href: `/fcs/craft/post-finishing/wait-process-warehouse?deliveryId=${encodeURIComponent(version.deliveryId)}` })
      }
    }
    const nodes = SEWING_DURATION_NODES.map((name) => aggregateSewingDurationNode(name, sources[name], input.nowAt, sources[name].length ? '' : name === '特殊工艺加工' ? '当前没有适用的辅助或特种工艺加工单' : '当前缺少可核对的关联来源事实'))
    const releaseNode = nodes[5]; releaseNode.startAt = firstRelease?.confirmedAt || ''; releaseNode.endAt = targetReached?.confirmedAt || ''; releaseNode.hours = calculateActualDurationHours(releaseNode.startAt, releaseNode.endAt, input.nowAt)
    return { productionOrderId: id, productionOrderNo: identity.productionOrderNo, styleCode: identity.styleCode, styleName: identity.styleName, imageUrl: identity.styleImageUrl, ppicNames: [...new Set(tasks.map((task) => task.ppicName))], factoryNames: [...new Set(tasks.map((task) => task.factoryName))], taskKinds: [...new Set(tasks.map((task) => task.taskKindLabel))], deliveryDate: prep[0]?.order.deliveryDate || '', nodes }
  })
  return buildDurationDemoRows(derivedRows, input.nowAt)
}
