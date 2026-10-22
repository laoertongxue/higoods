import type {
  PostFinishingAcceptanceSku,
  PostFinishingOutboundOrder,
  PostFinishingPostTask,
  PostFinishingQualityResultLine,
  PostFinishingQcTask,
  PostFinishingRecheckOrder,
  PostFinishingWarehouseReceipt,
} from './post-finishing-full-flow.ts'

export interface QcShippingSupplySegment {
  id: string
  qcTaskId: string
  productionOrderNo: string
  sku: PostFinishingAcceptanceSku
  quantity: number
  position: 'post' | 'warehouse'
  receiptId?: string
  outboundOrderId?: string
}

export interface QcShippingSupplyIssue {
  code: string
  message: string
  qcTaskId?: string
  recordId?: string
  skuId?: string
}

export interface QcShippingSupplySnapshot {
  qcs: readonly PostFinishingQcTask[]
  postTasks: readonly PostFinishingPostTask[]
  rechecks: readonly PostFinishingRecheckOrder[]
  outbounds: readonly PostFinishingOutboundOrder[]
  receipts: readonly PostFinishingWarehouseReceipt[]
}

type BatchChild = PostFinishingPostTask | PostFinishingRecheckOrder | PostFinishingOutboundOrder
type SkuLine = { sku: PostFinishingAcceptanceSku }

/**
 * Projects physical positions only; it neither assigns a warehouse nor resolves
 * replacement SKU identities. Callers must not report normal coverage for an
 * affected scope when issues exist. Warehouse segments are receipt contributions,
 * not permission to add receipts to a stock source that already includes them.
 */
export function projectQcShippingSupply(snapshot: QcShippingSupplySnapshot): {
  segments: QcShippingSupplySegment[]
  issues: QcShippingSupplyIssue[]
} {
  const normalQty=(line:PostFinishingQualityResultLine)=>line.releasedQty ?? line.passedQty
  const segments: QcShippingSupplySegment[] = []
  const issues: QcShippingSupplyIssue[] = []
  const invalid = new Set<object>()
  const issueKeys = new Set<string>()

  function issue(code: string, message: string, recordId?: string, qcTaskId?: string, skuId?: string) {
    const key = JSON.stringify([code, recordId, qcTaskId, skuId])
    if (issueKeys.has(key)) return
    issueKeys.add(key)
    issues.push({ code, message, recordId, qcTaskId, skuId })
  }

  function index<T extends object>(records: readonly T[], idOf: (record: T) => string, label: string,
    numberOf?: (record: T) => string): Map<string, T> {
    const map = new Map<string, T>()
    const numbers = new Map<string, T>()
    for (const record of records) {
      const id = idOf(record)
      if (typeof id !== 'string' || !id.trim()) {
        invalid.add(record)
        issue('INVALID_ID', `${label}缺少有效编号。`)
      } else if (map.has(id)) {
        invalid.add(record)
        invalid.add(map.get(id)!)
        issue('DUPLICATE_RECORD', `${label}存在重复记录，不能重复抵扣。`, id)
      } else map.set(id, record)
      const number = numberOf?.(record)
      if (numberOf && (typeof number !== 'string' || !number.trim())) {
        invalid.add(record)
        issue('INVALID_ID', `${label}缺少有效单号。`, id)
      } else if (number && numbers.has(number)) {
        invalid.add(record)
        invalid.add(numbers.get(number)!)
        issue('DUPLICATE_RECORD', `${label}存在重复单号，不能当作两批实物。`, id)
      } else if (number) numbers.set(number, record)
    }
    return map
  }

  function quantity(value: number | undefined, recordId: string, qcTaskId?: string, skuId?: string): value is number {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return true
    issue('INVALID_QUANTITY', '数量必须是非负安全整数，当前供给需核对。', recordId, qcTaskId, skuId)
    return false
  }

  function lines<T extends SkuLine>(values: readonly T[], recordId: string, qcTaskId?: string): Map<string, T> {
    const map = new Map<string, T>()
    for (const line of values) {
      const id = line.sku?.skuId
      if (!id?.trim() || !line.sku.skuCode?.trim() || !line.sku.spuCode?.trim()) {
        issue('INVALID_SKU', '供给明细缺少完整商品身份。', recordId, qcTaskId, id)
        invalid.add(line)
      } else if (map.has(id)) {
        issue('DUPLICATE_SKU', '同一记录存在重复 SKU 明细。', recordId, qcTaskId, id)
        invalid.add(line)
        invalid.add(map.get(id)!)
      } else map.set(id, line)
    }
    return map
  }

  const qcs = index(snapshot.qcs, record => record.qcTaskId, 'QC 单', record => record.qcTaskNo)
  const posts = index(snapshot.postTasks, record => record.postTaskId, '后道任务', record => record.postTaskNo)
  const rechecks = index(snapshot.rechecks, record => record.recheckOrderId, '复检单', record => record.recheckOrderNo)
  const outbounds = index(snapshot.outbounds, record => record.outboundOrderId, '后道出货单', record => record.outboundOrderNo)
  const receipts = index(snapshot.receipts, record => record.receiptId, '仓库实收单')
  const qcLines = new Map<string, Map<string, PostFinishingQualityResultLine>>()
  const recheckLines = new Map<string, Map<string, PostFinishingRecheckOrder['lines'][number]>>()
  const outboundLines = new Map<string, Map<string, PostFinishingOutboundOrder['lines'][number]>>()
  const receiptLines = new Map<string, Map<string, PostFinishingWarehouseReceipt['lines'][number]>>()

  function matchesSku(candidate: PostFinishingAcceptanceSku, expected: PostFinishingAcceptanceSku, recordId: string, qcTaskId: string): boolean {
    const matches = candidate.skuId === expected.skuId && candidate.skuCode === expected.skuCode && candidate.spuCode === expected.spuCode
    if (!matches) issue('SKU_MISMATCH', '子单商品身份与父单不一致，不能猜测替换关系。', recordId, qcTaskId, candidate.skuId)
    return matches
  }

  function parent(record: BatchChild, recordId: string): PostFinishingQcTask | undefined {
    const root = qcs.get(record.qcTaskId)
    if (!root || invalid.has(root)) {
      invalid.add(record)
      issue('MISSING_PARENT', '找不到唯一有效的来源 QC 单。', recordId, record.qcTaskId)
      return undefined
    }
    if (root.status !== '质检完成' || record.productionOrderNo !== root.productionOrderNo
      || record.deliveryId !== root.deliveryId || record.deliveryOrderNo !== root.deliveryOrderNo
      || record.qcTaskNo !== root.qcTaskNo || record.returnIndex !== root.returnIndex) {
      invalid.add(record)
      issue('PARENT_MISMATCH', '子单的 QC、生产单、回货批次或完成状态不一致。', recordId, root.qcTaskId)
      return undefined
    }
    return root
  }

  function matchesPost(record: PostFinishingRecheckOrder | PostFinishingOutboundOrder, recordId: string): boolean {
    if (!record.postTaskId) {
      if (record.sourceType === '质检直达') return true
      issue('MISSING_PARENT', '加工后单据缺少来源后道任务。', recordId, record.qcTaskId)
      return false
    }
    const task = posts.get(record.postTaskId)
    if (!task || invalid.has(task)) {
      issue('MISSING_PARENT', '找不到唯一有效的来源后道任务。', recordId, record.qcTaskId)
      return false
    }
    if (task.qcTaskId !== record.qcTaskId || task.postTaskNo !== record.postTaskNo) {
      issue('PARENT_MISMATCH', '复检或出货单关联了其他后道任务。', recordId, record.qcTaskId)
      return false
    }
    return true
  }

  function add(root: PostFinishingQcTask, sku: PostFinishingAcceptanceSku, amount: number,
    id: string, position: 'post' | 'warehouse', extra: Pick<QcShippingSupplySegment, 'receiptId' | 'outboundOrderId'> = {}) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return
    segments.push({ id: `${id}:${sku.skuId}`, qcTaskId: root.qcTaskId, productionOrderNo: root.productionOrderNo,
      sku: { ...sku }, quantity: amount, position, ...extra })
  }

  for (const root of qcs.values()) {
    if (!['待送检', '待质检', '质检中', '质检完成'].includes(root.status)) {
      invalid.add(root)
      issue('INVALID_STATUS', 'QC 状态无法识别。', root.qcTaskId, root.qcTaskId)
    }
    if (invalid.has(root) || root.status !== '质检完成') continue
    if (!root.results) {
      invalid.add(root)
      issue('MISSING_QC_RESULT', '已完成 QC 缺少质检结果。', root.qcTaskId, root.qcTaskId)
      continue
    }
    const expectedLines = lines(root.lines, root.qcTaskId, root.qcTaskId)
    const resultLines = lines(root.results, root.qcTaskId, root.qcTaskId)
    qcLines.set(root.qcTaskId, resultLines)
    for (const line of resultLines.values()) {
      const expected = expectedLines.get(line.sku.skuId)
      if (!expected || !matchesSku(line.sku, expected.sku, root.qcTaskId, root.qcTaskId)) {
        invalid.add(line)
        issue('SKU_MISMATCH', '质检结果缺少一致的原始应检 SKU。', root.qcTaskId, root.qcTaskId, line.sku.skuId)
      }
      const numbers = [line.expectedQty, line.passedQty, line.defectQty, line.returnQty, normalQty(line)]
      if (numbers.some(value => !quantity(value, root.qcTaskId, root.qcTaskId, line.sku.skuId))) invalid.add(line)
      if (!invalid.has(line) && (expected!.expectedQty !== line.expectedQty
        || (line.expectedQty !== normalQty(line) + line.defectQty + line.returnQty && !root.qcAuthorizationId?.trim()))) {
        invalid.add(line)
        issue('QC_QUANTITY_MISMATCH', '质检应检量不一致，或实点差异缺少已确认授权。', root.qcTaskId, root.qcTaskId, line.sku.skuId)
      }
    }
    for (const expected of expectedLines.values()) if (!resultLines.has(expected.sku.skuId)) {
      issue('MISSING_QC_RESULT', '已完成 QC 存在缺少结果的 SKU。', root.qcTaskId, root.qcTaskId, expected.sku.skuId)
    }
  }

  const postParents = new Set<string>()
  for (const task of posts.values()) {
    if (invalid.has(task) || !parent(task, task.postTaskId)) continue
    if (postParents.has(task.qcTaskId)) issue('DUPLICATE_CHILD', '同一 QC 关联多张后道任务，需核对来源。', task.postTaskId, task.qcTaskId)
    postParents.add(task.qcTaskId)
    const values = lines(task.lines, task.postTaskId, task.qcTaskId)
    for (const line of values.values()) {
      const source = qcLines.get(task.qcTaskId)?.get(line.sku.skuId)
      if (!source || !matchesSku(line.sku, source.sku, task.postTaskId, task.qcTaskId)
        || !quantity(line.expectedQty, task.postTaskId, task.qcTaskId, line.sku.skuId)
        || line.expectedQty !== normalQty(source)) {
        issue('POST_QUANTITY_MISMATCH', '后道应处理量与来源 QC 合格量不一致。', task.postTaskId, task.qcTaskId, line.sku.skuId)
      }
    }
    for (const source of qcLines.get(task.qcTaskId)?.values() || []) if (source.passedQty > 0 && !values.has(source.sku.skuId)) {
      issue('POST_QUANTITY_MISMATCH', '后道任务遗漏 QC 合格 SKU。', task.postTaskId, task.qcTaskId, source.sku.skuId)
    }
  }

  const recheckOperations = new Set<string>()
  for (const record of rechecks.values()) {
    if (invalid.has(record) || !parent(record, record.recheckOrderId)) continue
    if (!['待复检', '复检中', '条码异常待重贴', '复检完成'].includes(record.status)) {
      invalid.add(record)
      issue('INVALID_STATUS', '复检状态无法识别。', record.recheckOrderId, record.qcTaskId)
    }
    if (!matchesPost(record, record.recheckOrderId)) {
      invalid.add(record)
      issue('MISSING_PARENT', '复检单缺少一致的后道任务关系。', record.recheckOrderId, record.qcTaskId)
    }
    const identity = record.operationId ? `${record.postTaskId || record.qcTaskId}:operation:${record.operationId}`
      : record.sequence !== undefined ? `${record.postTaskId || record.qcTaskId}:sequence:${record.sequence}` : undefined
    if (identity && recheckOperations.has(identity)) {
      invalid.add(record)
      issue('DUPLICATE_CHILD', '同一交复检操作或子单序号重复。', record.recheckOrderId, record.qcTaskId)
    }
    if (identity) recheckOperations.add(identity)
    const values = lines(record.lines, record.recheckOrderId, record.qcTaskId)
    recheckLines.set(record.recheckOrderId, values)
    for (const line of values.values()) {
      const source = qcLines.get(record.qcTaskId)?.get(line.sku.skuId)
      if (!source || invalid.has(source) || !matchesSku(line.sku, source.sku, record.recheckOrderId, record.qcTaskId)) {
        invalid.add(line)
        issue('SKU_MISMATCH', '复检 SKU 不属于该 QC 的有效合格结果。', record.recheckOrderId, record.qcTaskId, line.sku.skuId)
      }
      if (!quantity(line.expectedQty, record.recheckOrderId, record.qcTaskId, line.sku.skuId)) invalid.add(line)
      if (line.handoverQty !== undefined && !quantity(line.handoverQty, record.recheckOrderId, record.qcTaskId, line.sku.skuId)) invalid.add(line)
      if (record.status === '复检完成' && line.handoverQty === undefined) {
        issue('MISSING_HANDOVER', '已完成复检缺少实际交出数量。', record.recheckOrderId, record.qcTaskId, line.sku.skuId)
      } else if (record.status === '复检完成' && line.handoverQty! < line.expectedQty) {
        issue('SHORT_HANDOVER_UNLOCATED', '复检少交数量的位置尚未明确，不能释放回父任务或当作已确认损耗。', record.recheckOrderId, record.qcTaskId, line.sku.skuId)
      } else if (record.status !== '复检完成' && line.handoverQty !== undefined) {
        issue('CHILD_STATUS_CONFLICT', '未完成复检已经存在实际交出数量。', record.recheckOrderId, record.qcTaskId, line.sku.skuId)
      }
    }
  }

  const outboundChildren = new Map<string, PostFinishingOutboundOrder[]>()
  for (const order of outbounds.values()) {
    if (invalid.has(order) || !parent(order, order.outboundOrderId)) continue
    if (!['待出货','待仓库接收', '已接收入库'].includes(order.status)) {
      invalid.add(order)
      issue('INVALID_STATUS', '后道出货状态无法识别。', order.outboundOrderId, order.qcTaskId)
    }
    const childKey = order.executionModel==='DIRECT_V2' ? `direct:${order.outboundOrderId}` : order.recheckOrderId ? `rc:${order.recheckOrderId}` : `qc:${order.qcTaskId}`
    const siblings = outboundChildren.get(childKey) || []
    siblings.push(order); outboundChildren.set(childKey, siblings)
    if (!matchesPost(order, order.outboundOrderId)) invalid.add(order)
    if (order.recheckOrderId) {
      const source = rechecks.get(order.recheckOrderId)
      if (!source || invalid.has(source)) {
        invalid.add(order)
        issue('MISSING_PARENT', '出货单缺少唯一有效复检单。', order.outboundOrderId, order.qcTaskId)
      } else if (source.qcTaskId !== order.qcTaskId || source.postTaskId !== order.postTaskId
        || source.recheckOrderNo !== order.recheckOrderNo || source.sourceType !== order.sourceType) {
        invalid.add(order)
        issue('PARENT_MISMATCH', '出货单与复检单来源关系不一致。', order.outboundOrderId, order.qcTaskId)
      } else if (source.status !== '复检完成') {
        invalid.add(order)
        issue('CHILD_STATUS_CONFLICT', '复检尚未完成，不能已存在下游出货。', order.outboundOrderId, order.qcTaskId)
      }
    } else if (order.executionModel==='DIRECT_V2' && order.postTaskId) {
      // Current processing ships directly; its verified post parent replaces the retired recheck node.
    } else if (order.postTaskId || order.sourceType !== '质检直达') {
      invalid.add(order)
      issue('MISSING_PARENT', '加工后出货缺少来源复检单。', order.outboundOrderId, order.qcTaskId)
    } else if (postParents.has(order.qcTaskId) || [...rechecks.values()].some(record => record.qcTaskId === order.qcTaskId)) {
      issue('DUPLICATE_CHILD', '同一 QC 同时存在质检直达和加工复检路径。', order.outboundOrderId, order.qcTaskId)
    }
    const values = lines(order.lines, order.outboundOrderId, order.qcTaskId)
    outboundLines.set(order.outboundOrderId, values)
    for (const line of values.values()) {
      if (!quantity(line.outboundQty, order.outboundOrderId, order.qcTaskId, line.sku.skuId)) invalid.add(line)
      const source = order.recheckOrderId ? recheckLines.get(order.recheckOrderId)?.get(line.sku.skuId)
        : qcLines.get(order.qcTaskId)?.get(line.sku.skuId)
      if (!source || invalid.has(source) || !matchesSku(line.sku, source.sku, order.outboundOrderId, order.qcTaskId)) {
        invalid.add(line)
        issue('SKU_MISMATCH', '出货 SKU 与来源合格 SKU 不一致。', order.outboundOrderId, order.qcTaskId, line.sku.skuId)
      }
      if (order.recheckOrderId && source && 'handoverQty' in source && line.outboundQty !== source.handoverQty) {
        invalid.add(line)
        issue('OUTBOUND_MISMATCH', '出货数量与复检实际交出数量不一致。', order.outboundOrderId, order.qcTaskId, line.sku.skuId)
      }
      if (!order.recheckOrderId && source && 'passedQty' in source && (order.executionModel==='DIRECT_V2' ? line.outboundQty>normalQty(source) : line.outboundQty !== normalQty(source))) {
        invalid.add(line)
        issue('OUTBOUND_MISMATCH', '质检直达出货数量与该批 QC 合格量不一致。', order.outboundOrderId, order.qcTaskId, line.sku.skuId)
      }
    }
    if (order.recheckOrderId) for (const source of recheckLines.get(order.recheckOrderId)?.values() || []) {
      if ((source.handoverQty || 0) > 0 && !values.has(source.sku.skuId)) {
        issue('OUTBOUND_MISMATCH', '出货单遗漏复检已交出的 SKU。', order.outboundOrderId, order.qcTaskId, source.sku.skuId)
      }
    }
    if (!order.recheckOrderId && order.executionModel!=='DIRECT_V2') for (const source of qcLines.get(order.qcTaskId)?.values() || []) {
      if (source.passedQty > 0 && !values.has(source.sku.skuId)) {
        issue('OUTBOUND_MISMATCH', '质检直达出货遗漏 QC 合格 SKU。', order.outboundOrderId, order.qcTaskId, source.sku.skuId)
      }
    }
  }
  for (const siblings of outboundChildren.values()) if (siblings.length > 1) for (const sibling of siblings) {
    invalid.add(sibling)
    issue('DUPLICATE_CHILD', '同一来源生成了多张子出货单，不能重复抵扣。', sibling.outboundOrderId, sibling.qcTaskId)
  }

  const receiptsByOutbound = new Map<string, PostFinishingWarehouseReceipt[]>()
  for (const record of receipts.values()) {
    const siblings = receiptsByOutbound.get(record.outboundOrderId) || []
    siblings.push(record); receiptsByOutbound.set(record.outboundOrderId, siblings)
    const order = outbounds.get(record.outboundOrderId)
    if (!order || invalid.has(order)) {
      invalid.add(record)
      issue('MISSING_PARENT', '实收单缺少唯一有效的出货单。', record.receiptId, order?.qcTaskId)
      continue
    }
    if (order.status !== '已接收入库') {
      invalid.add(record)
      issue('RECEIPT_STATUS_CONFLICT', '出货尚未接收入库却存在实收单。', record.receiptId, order.qcTaskId)
    }
    if (record.outboundOrderNo !== order.outboundOrderNo || record.productionOrderNo !== order.productionOrderNo) {
      invalid.add(record)
      issue('PARENT_MISMATCH', '实收与出货单号或生产单不一致。', record.receiptId, order.qcTaskId)
    }
    const values = lines(record.lines, record.receiptId, order.qcTaskId)
    receiptLines.set(record.receiptId, values)
    const expected = outboundLines.get(order.outboundOrderId)
    for (const line of values.values()) {
      const original = expected?.get(line.sku.skuId)
      const validNumbers = quantity(line.expectedQty, record.receiptId, order.qcTaskId, line.sku.skuId)
        && quantity(line.receivedQty, record.receiptId, order.qcTaskId, line.sku.skuId)
        && quantity(original?.receivedQty, record.receiptId, order.qcTaskId, line.sku.skuId)
      if (!original || !validNumbers || invalid.has(original) || invalid.has(line)
        || !matchesSku(line.sku, original.sku, record.receiptId, order.qcTaskId)
        || line.expectedQty !== original.outboundQty || line.receivedQty !== original.receivedQty) {
        invalid.add(line)
        issue('RECEIPT_MISMATCH', '实收 SKU、应收或实收数量与出货事实不一致。', record.receiptId, order.qcTaskId, line.sku.skuId)
      } else if (line.expectedQty !== line.receivedQty && (!record.authorizationId?.trim() || !record.differenceReason?.trim())) {
        invalid.add(line)
        issue('UNCONFIRMED_RECEIPT_DIFFERENCE', '仓库实收差异缺少确认依据。', record.receiptId, order.qcTaskId, line.sku.skuId)
      }
    }
    for (const line of expected?.values() || []) if (!values.has(line.sku.skuId)) {
      invalid.add(record)
      issue('RECEIPT_MISMATCH', '实收单遗漏出货 SKU。', record.receiptId, order.qcTaskId, line.sku.skuId)
    }
  }
  for (const [outboundId, siblings] of receiptsByOutbound) if (siblings.length > 1) {
    issue('DUPLICATE_RECEIPT', '同一出货单存在多张实收单，不能重复入仓。', outboundId, outbounds.get(outboundId)?.qcTaskId)
    for (const sibling of siblings) invalid.add(sibling)
  }

  for (const root of qcs.values()) {
    if (invalid.has(root) || root.status !== '质检完成') continue
    const children = [...rechecks.values()].filter(record => record.qcTaskId === root.qcTaskId && !invalid.has(record))
    const direct = [...outbounds.values()].filter(record => record.qcTaskId === root.qcTaskId && !record.recheckOrderId && !invalid.has(record))
    for (const source of qcLines.get(root.qcTaskId)?.values() || []) {
      if (invalid.has(source)) continue
      let reserved = 0
      for (const record of children) {
        const line = recheckLines.get(record.recheckOrderId)?.get(source.sku.skuId)
        if (!line || invalid.has(line)) continue
        reserved += Math.max(line.expectedQty, line.handoverQty ?? line.expectedQty)
        const childOrders = outboundChildren.get(`rc:${record.recheckOrderId}`) || []
        if (childOrders.length === 0) {
          const current = record.status === '复检完成' ? line.handoverQty : line.expectedQty
          if (current !== undefined) add(root, source.sku, current, `recheck:${record.recheckOrderId}`, 'post')
          if (record.status === '复检完成' && (current || 0) > 0) {
            issue('MISSING_OUTBOUND', '已完成复检尚未找到对应出货单。', record.recheckOrderId, root.qcTaskId, source.sku.skuId)
          }
        }
      }
      for (const order of direct) {
        const line = outboundLines.get(order.outboundOrderId)?.get(source.sku.skuId)
        if (line && !invalid.has(line)) reserved += line.outboundQty
      }
      if (reserved > normalQty(source)) issue('OVER_RESERVED', '子单预留量超过该批 QC 合格量。', root.qcTaskId, root.qcTaskId, source.sku.skuId)
      add(root, source.sku, Math.max(0, normalQty(source) - reserved), `qc:${root.qcTaskId}`, 'post')
    }
  }

  for (const order of outbounds.values()) {
    if (invalid.has(order)) continue
    const root = qcs.get(order.qcTaskId)
    if (!root || invalid.has(root)) continue
    const matchingReceipts = receiptsByOutbound.get(order.outboundOrderId) || []
    if (order.status === '已接收入库' && matchingReceipts.length === 0) {
      issue('MISSING_RECEIPT', '已接收入库的出货单缺少实收记录。', order.outboundOrderId, order.qcTaskId)
    }
    for (const line of outboundLines.get(order.outboundOrderId)?.values() || []) {
      if (invalid.has(line)) continue
      if (['待出货','待仓库接收'].includes(order.status)) {
        add(root, line.sku, line.outboundQty, `outbound:${order.outboundOrderId}`, 'post', { outboundOrderId: order.outboundOrderId })
      } else if (matchingReceipts.length === 1) {
        const receipt = matchingReceipts[0]
        const actual = receiptLines.get(receipt.receiptId)?.get(line.sku.skuId)
        if (!invalid.has(receipt) && actual && !invalid.has(actual)) {
          add(root, actual.sku, actual.receivedQty, `receipt:${receipt.receiptId}`, 'warehouse',
            { receiptId: receipt.receiptId, outboundOrderId: order.outboundOrderId })
        }
      }
    }
  }
  return { segments, issues }
}
