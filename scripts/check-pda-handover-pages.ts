#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  canCompletePdaHandoutHead,
  canPdaFactoryAccessHandoverHead,
  capturePdaHandoverState,
  createFactoryHandoverRecord,
  getPdaHandoutHeads,
  getPdaHandoverRecordsByHead,
  listPdaHandoverHeads,
  listQuantityObjections,
  markPdaHandoutHeadCompleted,
  resolveWoolReceiverExecutionFactoryId,
  restorePdaHandoverState,
  writeBackHandoverRecord,
} from '../src/data/fcs/pda-handover-events.ts'
import {
  completeWoolWorkOrder,
  getWoolWarehouseStock,
  listWoolWorkOrders,
  readWoolStore,
  replaceWoolStore,
  resetWoolFactWorkflowMock,
} from '../src/data/fcs/wool-task-domain.ts'
import {
  getPdaSession,
  listFactoryPdaUsers,
  setPdaSession,
} from '../src/data/fcs/store-domain-pda.ts'
import {
  DEDICATED_POST_FACTORY_ID,
  OWN_WOOL_FACTORY_ID,
  TEST_FACTORY_ID,
} from '../src/data/fcs/factory-mock-data.ts'
import { appStore } from '../src/state/store.ts'
import {
  mergeHandoverHeadsById,
  renderPdaHandoverPage,
} from '../src/pages/pda-handover.ts'
import {
  handlePdaHandoverDetailEvent,
  renderPdaHandoverDetailPage,
} from '../src/pages/pda-handover-detail.ts'
import { removedLegacyProcessCodes } from './utils/special-craft-banlist.ts'

class TestElement {}
class TestInputElement extends TestElement {
  value = ''
  dataset: Record<string, string> = {}

  closest(selector: string): TestInputElement | null {
    return selector === '[data-pda-handoverd-field]' ? this : null
  }
}
class TestTextAreaElement extends TestInputElement {}
class TestSelectElement extends TestInputElement {}

Object.defineProperties(globalThis, {
  HTMLElement: { configurable: true, value: TestElement },
  HTMLInputElement: { configurable: true, value: TestInputElement },
  HTMLTextAreaElement: { configurable: true, value: TestTextAreaElement },
  HTMLSelectElement: { configurable: true, value: TestSelectElement },
})

const pdaSessionStorage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    get length(): number {
      return pdaSessionStorage.size
    },
    clear(): void {
      pdaSessionStorage.clear()
    },
    getItem(key: string): string | null {
      return pdaSessionStorage.get(key) ?? null
    },
    key(index: number): string | null {
      return [...pdaSessionStorage.keys()][index] ?? null
    },
    removeItem(key: string): void {
      pdaSessionStorage.delete(key)
    },
    setItem(key: string, value: string): void {
      pdaSessionStorage.set(key, String(value))
    },
  } satisfies Storage,
})

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function loginPdaFactory(factoryId: string): void {
  const user = listFactoryPdaUsers(factoryId).find((item) => item.status === 'ACTIVE')
  assert(user, `缺少工厂 ${factoryId} 的有效 PDA 用户`)
  setPdaSession({
    userId: user.userId,
    loginId: user.loginId,
    userName: user.name,
    roleId: user.roleId,
    factoryId: user.factoryId,
    factoryName: user.factoryId,
    loggedAt: '2026-07-31 10:00:00',
  })
  assert(getPdaSession()?.factoryId === factoryId, `PDA 会话未切换到工厂 ${factoryId}`)
}

function handoverDetailAction(
  action: string,
  handoverId: string,
): { closest(selector: string): { dataset: Record<string, string> } | null } {
  return {
    closest(selector: string) {
      if (selector === '[data-pda-handoverd-field]') return null
      if (selector === '[data-pda-handoverd-action]') {
        return {
          dataset: {
            pdaHandoverdAction: action,
            handoverId,
          },
        }
      }
      return null
    },
  }
}

function updateHandoverDetailField(field: string, value: string): void {
  const node = new TestInputElement()
  node.value = value
  node.dataset = { pdaHandoverdField: field }
  handlePdaHandoverDetailEvent(node as unknown as HTMLElement)
}

const pageFiles = [
  'src/pages/pda-handover.ts',
  'src/pages/pda-handover-detail.ts',
  'src/pages/progress-handover.ts',
  'src/pages/progress-handover-order.ts',
] as const

function readFile(filePath: string): string {
  return fs.readFileSync(path.resolve(filePath), 'utf8')
}

function legacyMobileCopy(...parts: string[]): string {
  return parts.join('')
}

function checkForbiddenCopy(): void {
  const forbiddenTerms = [
    legacyMobileCopy('接收', '头'),
    legacyMobileCopy('交出', '头'),
    '仓库自动回写',
    '工厂只查看',
    '仓库确认',
    legacyMobileCopy('印花', ' ', 'PDA'),
    legacyMobileCopy('染色', ' ', 'PDA'),
    legacyMobileCopy('印花', 'PDA'),
    legacyMobileCopy('染色', 'PDA'),
    legacyMobileCopy('PDA', '交出'),
    legacyMobileCopy('PDA', ' ', 'Handover'),
  ]

  pageFiles.forEach((file) => {
    const source = readFile(file)
    forbiddenTerms.forEach((term) => {
      assert(!source.includes(term), `${file} 仍残留禁用文案：${term}`)
    })
  })
}

function checkPageSignals(): void {
  const listPage = readFile('src/pages/pda-handover.ts')
  const detailPage = readFile('src/pages/pda-handover-detail.ts')
  const ledgerPage = readFile('src/pages/progress-handover.ts')
  const orderPage = readFile('src/pages/progress-handover-order.ts')
  const execPage = readFile('src/pages/pda-exec-detail.ts')

  ;['接收方', '已交出', '已收货', '差异', '异议', '待收货', '查看交出单', '新增交出记录'].forEach((term) => {
    assert(listPage.includes(term), `pda-handover.ts 缺少列表关键信号：${term}`)
  })

  ;['交出单二维码', '交出记录二维码', '新增交出记录', '完成接收单', '完成交出单', '确认收货', '发起异议', '接受差异', '入库记录', '出库记录', '已入待加工仓', '已生成出库记录', '已驳回'].forEach((term) => {
    assert(detailPage.includes(term), `pda-handover-detail.ts 缺少详情关键信号：${term}`)
  })
  ;['中转袋', '扫码装袋', '移除菲票', '完成装袋', '扫描中转袋', '按袋确认', '按菲票确认', '袋内明细'].forEach((term) => {
    assert((detailPage + readFile('src/pages/pda-transfer-bag-detail.ts')).includes(term), `移动端交接缺少中转袋闭环字段：${term}`)
  })
  ;['特殊工艺菲票', '原数量', '当前数量', '报废数量', '货损数量', '已完成特殊工艺', '差异状态'].forEach((term) => {
    assert(detailPage.includes(term), `pda-handover-detail.ts 缺少特殊工艺深化字段：${term}`)
  })

  assert(
    detailPage.includes('handoverRecordQrValue') || detailPage.includes('getHandoverRecordQrDisplayValue'),
    'pda-handover-detail.ts 未使用交出记录二维码字段或 helper',
  )
  assert(detailPage.includes('createFactoryHandoverRecord'), 'pda-handover-detail.ts 未接入新增交出记录 helper')
  assert(detailPage.includes('writeBackHandoverRecord'), 'pda-handover-detail.ts 未接入接收方收货确认 helper')
  assert(detailPage.includes('receiverWrittenQty') || detailPage.includes('getRecordReceiverWrittenQty'), 'pda-handover-detail.ts 未切换到 receiverWritten 主口径')
  assert(detailPage.includes('linkPickupConfirmToInboundRecord'), 'pda-handover-detail.ts 未接入待接收到入库联动 helper')
  assert(detailPage.includes('linkHandoverRecordToOutboundRecord'), 'pda-handover-detail.ts 未接入交出到出库联动 helper')
  assert(detailPage.includes('syncReceiverWritebackToOutboundRecord'), 'pda-handover-detail.ts 未接入回写同步出库 helper')
  assert(detailPage.includes('syncQuantityObjectionToOutboundRecord'), 'pda-handover-detail.ts 未接入异议同步出库 helper')
  assert(detailPage.includes('renderPdaHandoverSourceIdentity(head)'), 'pda-handover-detail.ts 未按来源联合展示生产单或备货物料')

  ;['接收方确认', '交出单', '交出记录'].forEach((term) => {
    assert(ledgerPage.includes(term), `progress-handover.ts 缺少台账口径：${term}`)
  })
  assert(orderPage.includes('查看交出详情'), 'progress-handover-order.ts 未提供交出详情入口')

  assert(!execPage.includes('去交接（待交出）'), 'pda-exec-detail.ts 被回退为旧文案：去交接（待交出）')
  assert(execPage.includes('任务二维码'), 'pda-exec-detail.ts 丢失任务二维码')
  assert(execPage.includes('查看交出单'), 'pda-exec-detail.ts 丢失查看交出单')
  assert(execPage.includes('新增交出记录'), 'pda-exec-detail.ts 丢失新增交出记录')
}

function checkDataSignals(): void {
  const heads = listPdaHandoverHeads()
  const handoutHeads = heads.filter((head) => head.headType === 'HANDOUT')
  const pickupHeads = heads.filter((head) => head.headType === 'PICKUP')

  assert(handoutHeads.length > 0, '缺少交出单样例')
  assert(pickupHeads.length > 0, 'pickup 接收样例丢失')

  handoutHeads.forEach((head) => {
    const records = getPdaHandoverRecordsByHead(head.handoverId)
    records.forEach((record) => {
      assert(Boolean(record.handoverRecordQrValue), `交出记录缺少二维码：${record.recordId}`)
      assert(record.factorySubmittedByKind === 'FACTORY', `交出记录必须由工厂发起：${record.recordId}`)
    })
    assert(!['BUTTONHOLE', 'BUTTON_ATTACH'].includes(head.processBusinessCode || ''), `后道内部产能节点误入交出场景：${head.handoverId}`)
    assert(!removedLegacyProcessCodes.includes(head.processBusinessCode as (typeof removedLegacyProcessCodes)[number]), `历史停用工序误入交出场景：${head.handoverId}`)
  })

  const objections = listQuantityObjections()
  objections.forEach((objection) => {
    assert(objection.raisedByKind === 'FACTORY', `数量异议必须由工厂发起：${objection.objectionId}`)
  })
}

function checkWoolFactHandoverProjection(): void {
  resetWoolFactWorkflowMock('CHECK_TASK_13_HANDOVER')
  const initialStore = readWoolStore()
  replaceWoolStore({
    ...initialStore,
    handovers: initialStore.handovers.map((handover) => ({
      ...handover,
      receiverType: 'DOWNSTREAM_FACTORY',
      receiverId: DEDICATED_POST_FACTORY_ID,
      receiverName: '后道专厂',
    })),
  })
  const order = listWoolWorkOrders()
    .find((item) => item.mockScenarioCode === 'MULTIPLE_HANDOVERS_WITH_STOCK')!
  const sourceHandovers = readWoolStore().handovers
    .filter((item) => item.woolOrderId === order.woolOrderId)
  assert(sourceHandovers.length >= 2, 'Task13 样例必须包含同一加工单多次交出')

  const projectedHeads = listPdaHandoverHeads()
    .filter((head) => head.taskId === order.taskId && head.processBusinessCode === 'WOOL')
  assert(
    projectedHeads.length === sourceHandovers.length,
    '每次毛织交出必须生成一条独立下游待接收交接单',
  )
  assert(
    new Set(projectedHeads.map((head) => head.handoverOrderId)).size === sourceHandovers.length,
    '同一毛织加工单的多次交出不得覆盖同一个交接单号',
  )
  assert(
    getPdaHandoutHeads(DEDICATED_POST_FACTORY_ID)
      .filter((head) => head.processBusinessCode === 'WOOL')
      .length === readWoolStore().handovers.filter((handover) => !handover.downstreamReceipt || handover.downstreamReceipt.status !== 'CONFIRMED').length,
    '结构化目标工厂必须能看到全部待接收毛织交出',
  )
  assert(
    !getPdaHandoutHeads(OWN_WOOL_FACTORY_ID).some((head) => head.processBusinessCode === 'WOOL'),
    '来源毛织厂不是接收方时不得看到待接收毛织交出',
  )
  assert(
    !getPdaHandoutHeads(TEST_FACTORY_ID).some((head) => head.processBusinessCode === 'WOOL'),
    '第三方工厂不得看到不属于自己的毛织交出',
  )
  assert(projectedHeads.every((head) => canPdaFactoryAccessHandoverHead(head, DEDICATED_POST_FACTORY_ID)))
  assert(projectedHeads.every((head) => !canPdaFactoryAccessHandoverHead(head, OWN_WOOL_FACTORY_ID)))
  assert(projectedHeads.every((head) => !canPdaFactoryAccessHandoverHead(head, TEST_FACTORY_ID)))
  const olderMergeHead = { ...projectedHeads[0], lastRecordAt: '2026-07-31 08:00:00' }
  const newerMergeHead = {
    ...projectedHeads[1],
    handoverId: `${projectedHeads[1].handoverId}-MERGE-NEW`,
    lastRecordAt: '2026-07-31 09:00:00',
  }
  const mergedHeads = mergeHandoverHeadsById(
    [olderMergeHead, newerMergeHead],
    [{ ...olderMergeHead }],
  )
  assert(mergedHeads.length === 2, '后道专厂合并交出头必须按 handoverId 去重')
  assert(mergedHeads[0].handoverId === newerMergeHead.handoverId, '后道专厂合并后必须保持最新业务时间优先')

  loginPdaFactory(DEDICATED_POST_FACTORY_ID)
  appStore.navigate('/fcs/pda/handover?tab=handout')
  const targetFactoryHandoutHtml = renderPdaHandoverPage()
  assert(
    targetFactoryHandoutHtml.includes(projectedHeads[0].handoverId),
    '后道专厂真实 PDA 待交出页必须合并目标工厂可访问的毛织交出',
  )
  loginPdaFactory(OWN_WOOL_FACTORY_ID)
  appStore.navigate('/fcs/pda/handover?tab=handout')
  assert(
    !renderPdaHandoverPage().includes(projectedHeads[0].handoverId),
    '来源毛织厂不是接收方时，真实 PDA 待交出页不得显示毛织交出',
  )
  loginPdaFactory(TEST_FACTORY_ID)
  appStore.navigate('/fcs/pda/handover?tab=handout')
  assert(
    !renderPdaHandoverPage().includes(projectedHeads[0].handoverId),
    '无关工厂的真实 PDA 待交出页不得显示毛织交出',
  )

  const actionGuardHead = projectedHeads[0]
  loginPdaFactory(DEDICATED_POST_FACTORY_ID)
  appStore.navigate(`/fcs/pda/handover/${actionGuardHead.handoverId}?action=new-record`)
  const woolDetailHtml = renderPdaHandoverDetailPage(actionGuardHead.handoverId)
  assert(!woolDetailHtml.includes('data-pda-handoverd-action="complete-handout-head"'), '毛织交出详情不得显示完成交出单动作')
  assert(!woolDetailHtml.includes('data-pda-handoverd-action="open-new-handout-record"'), '毛织交出详情不得显示新增交出记录动作')
  assert(!woolDetailHtml.includes('data-testid="handout-new-record-form"'), '毛织交出详情不得通过查询参数自动打开新增交出记录表单')
  const recordsBeforeForbiddenActions = getPdaHandoverRecordsByHead(actionGuardHead.handoverId).length
  handlePdaHandoverDetailEvent(
    handoverDetailAction('complete-handout-head', actionGuardHead.handoverId) as unknown as HTMLElement,
  )
  handlePdaHandoverDetailEvent(
    handoverDetailAction('open-new-handout-record', actionGuardHead.handoverId) as unknown as HTMLElement,
  )
  updateHandoverDetailField('newRecordScanCode', actionGuardHead.taskNo)
  updateHandoverDetailField('newRecordQty', '1')
  updateHandoverDetailField('newRecordUnit', actionGuardHead.qtyUnit)
  handlePdaHandoverDetailEvent(
    handoverDetailAction('submit-new-handout-record', actionGuardHead.handoverId) as unknown as HTMLElement,
  )
  const guardedHeadAfterActions = listPdaHandoverHeads()
    .find((head) => head.handoverId === actionGuardHead.handoverId)!
  assert(guardedHeadAfterActions.completionStatus === 'OPEN', '毛织交出详情事件不得把通用交出单标记完成')
  assert(
    getPdaHandoverRecordsByHead(actionGuardHead.handoverId).length === recordsBeforeForbiddenActions,
    '毛织交出详情事件不得写入孤立的通用交出记录',
  )
  const woolCompletionCheck = canCompletePdaHandoutHead(actionGuardHead.handoverId)
  assert(!woolCompletionCheck.ok && woolCompletionCheck.message.includes('毛织交出由加工单事实管理'), '毛织通用完成领域入口必须明确拒绝')
  assert(!markPdaHandoutHeadCompleted(actionGuardHead.handoverId, '2026-07-31 15:00:00').ok, '毛织通用完成写入口必须拒绝')
  let directWoolRecordCreateRejected = false
  try {
    createFactoryHandoverRecord({
      handoverOrderId: actionGuardHead.handoverOrderId || actionGuardHead.handoverId,
      submittedQty: 1,
      qtyUnit: actionGuardHead.qtyUnit,
      factorySubmittedAt: '2026-07-31 15:00:00',
      factorySubmittedBy: '绕过页面的操作员',
    })
  } catch {
    directWoolRecordCreateRejected = true
  }
  assert(directWoolRecordCreateRejected, '毛织新增通用交出记录领域入口必须拒绝')
  assert(
    getPdaHandoverRecordsByHead(actionGuardHead.handoverId).length === recordsBeforeForbiddenActions,
    '毛织领域入口拒绝后不得写入孤立交出记录',
  )

  const nonWoolState = capturePdaHandoverState()
  try {
    const nonWoolHead = getPdaHandoutHeads().find((item) =>
      item.processBusinessCode !== 'WOOL'
      && item.processBusinessCode !== 'POST_FINISHING'
      && item.sourceBusinessType !== 'WATER_SOLUBLE_WORK_ORDER'
      && item.completionStatus === 'OPEN',
    )!
    assert(nonWoolHead, '非毛织兼容回归必须找到开放的通用交出单')
    const nonWoolRecordCountBefore = getPdaHandoverRecordsByHead(nonWoolHead.handoverId).length
    createFactoryHandoverRecord({
      handoverOrderId: nonWoolHead.handoverOrderId || nonWoolHead.handoverId,
      submittedQty: 1,
      qtyUnit: nonWoolHead.qtyUnit,
      factorySubmittedAt: '2026-07-31 15:05:00',
      factorySubmittedBy: '非毛织操作员',
    })
    assert(
      getPdaHandoverRecordsByHead(nonWoolHead.handoverId).length === nonWoolRecordCountBefore + 1,
      '非毛织交出单必须继续支持原有新增交出记录',
    )
    assert(
      !canCompletePdaHandoutHead(nonWoolHead.handoverId).message.includes('毛织交出由加工单事实管理'),
      '非毛织交出单不得误用毛织完成门禁',
    )
  } finally {
    restorePdaHandoverState(nonWoolState)
  }

  for (const source of sourceHandovers) {
    const head = projectedHeads.find((item) => item.sourceDocId === source.handoverId)
    assert(head, `毛织交出缺少下游投影：${source.handoverId}`)
    assert(head.receiverId === source.receiverId && head.receiverName === source.receiverName, '接收方必须来自结构化去向')
    const [record] = getPdaHandoverRecordsByHead(head.handoverId)
    const output = order.outputPlanLines.find((line) => line.outputSkuCode === source.outputSkuCode)!
    assert(record?.skuCode === output.outputSkuCode, '交接明细必须保留加工后 SKU')
    assert(record?.handoutObjectType === (output.outputObjectType === 'WOOL_PANEL' ? 'CUT_PIECE' : 'GARMENT'), '交接明细必须保留加工后对象类型')
    assert(record?.skuColor === output.colorName, '交接明细必须保留款色')
    assert(record?.skuSize === output.sizeCode, '交接明细必须保留尺码')
    assert(record?.pieceName === output.woolPartName, '部位毛织交接必须保留部位')
    assert(record?.sourceWarehouseOutboundFlowId === source.warehouseOutboundFlowId, '交接明细必须关联来源出库流水')
  }

  const readyOrder = listWoolWorkOrders()
    .find((item) => item.mockScenarioCode === 'READY_TO_COMPLETE')!
  const source = readWoolStore().handovers.find((item) => item.woolOrderId === readyOrder.woolOrderId)!
  const output = readyOrder.outputPlanLines.find((line) => line.outputSkuCode === source.outputSkuCode)!
  const stockKey = {
    woolOrderId: readyOrder.woolOrderId,
    objectSkuCode: output.outputSkuCode,
    defaultLocationId: output.outputObjectType === 'WOOL_PANEL'
      ? 'WOOL-WH-CUT-DEFAULT' as const
      : 'WOOL-WH-GARMENT-DEFAULT' as const,
  }
  completeWoolWorkOrder(readyOrder.woolOrderId, {
    commandId: 'CHECK-T13-COMPLETE-BEFORE-DOWNSTREAM',
    completedAt: '2026-07-31 16:00:00',
    completedBy: '毛织主管',
  })
  const sourceQtyBefore = readWoolStore().handovers.find((item) => item.handoverId === source.handoverId)!.handoverQty
  const stockBefore = getWoolWarehouseStock(stockKey)
  const head = listPdaHandoverHeads().find((item) => item.sourceDocId === source.handoverId)!
  const record = getPdaHandoverRecordsByHead(head.handoverId)[0]!
  loginPdaFactory(OWN_WOOL_FACTORY_ID)
  const beforeCrossFactoryWrite = JSON.stringify(readWoolStore())
  let sourceWriteRejected = false
  try {
    writeBackHandoverRecord({
      handoverRecordId: record.recordId,
      receiverWrittenQty: sourceQtyBefore - 1,
      receiverWrittenAt: '2026-07-31 16:20:00',
      receiverWrittenBy: '来源厂仓管',
    })
  } catch {
    sourceWriteRejected = true
  }
  assert(sourceWriteRejected, '来源厂不是结构化接收方时必须拒绝下游确认')
  assert(JSON.stringify(readWoolStore()) === beforeCrossFactoryWrite, '跨工厂拒绝必须零写')
  loginPdaFactory(DEDICATED_POST_FACTORY_ID)
  writeBackHandoverRecord({
    handoverRecordId: record.recordId,
    receiverWrittenQty: sourceQtyBefore - 1,
    receiverWrittenAt: '2026-07-31 16:30:00',
    receiverWrittenBy: '下游仓管',
    receiverRemark: '实收少一件',
  })
  const after = readWoolStore().handovers.find((item) => item.handoverId === source.handoverId)!
  assert(after.downstreamReceipt?.status === 'CONFIRMED', '加工单完成后仍必须允许下游确认')
  assert(after.downstreamReceipt.actualReceivedQty === sourceQtyBefore - 1, '下游确认必须保存实际接收数量')
  assert(after.downstreamReceipt.differenceQty === -1, '下游确认必须保存差异')
  assert(after.downstreamReceipt.receivedBy === '下游仓管', '下游确认必须保存接收人')
  assert(after.handoverQty === sourceQtyBefore, '下游确认不得修改来源交出数量')
  assert(getWoolWarehouseStock(stockKey) === stockBefore, '下游确认不得恢复毛织库存')

  loginPdaFactory(DEDICATED_POST_FACTORY_ID)
  appStore.navigate('/fcs/pda/handover?tab=done')
  assert(renderPdaHandoverPage().includes(head.handoverId), '后道专厂真实 PDA 已完成页必须合并已确认的毛织交出')
  loginPdaFactory(OWN_WOOL_FACTORY_ID)
  appStore.navigate('/fcs/pda/handover?tab=done')
  assert(!renderPdaHandoverPage().includes(head.handoverId), '来源毛织厂不得看到目标专厂已完成毛织交出')
  loginPdaFactory(TEST_FACTORY_ID)
  appStore.navigate('/fcs/pda/handover?tab=done')
  assert(!renderPdaHandoverPage().includes(head.handoverId), '无关工厂不得看到目标专厂已完成毛织交出')

  const cuttingReceiverFactoryId = resolveWoolReceiverExecutionFactoryId(
    'CUTTING_WAIT_HANDOVER_WAREHOUSE',
    'CUTTING-WAIT-HANDOVER',
  )
  assert(cuttingReceiverFactoryId === 'ID-F004', '裁床待交出仓必须解析到现有裁床工厂执行作用域')
  assert(
    resolveWoolReceiverExecutionFactoryId(
      'CUTTING_WAIT_HANDOVER_WAREHOUSE',
      'FIW-FACTORY-ONBOARD-0034-WAIT_HANDOVER',
    ) === 'FACTORY-ONBOARD-0034',
    '具体裁床待交出仓必须解析自身所属工厂，通用别名不得依赖多个默认仓的数组顺序',
  )
  const cuttingSource = sourceHandovers[0]
  const cuttingOutput = order.outputPlanLines.find((line) => line.outputSkuCode === cuttingSource.outputSkuCode)!
  const cuttingStockKey = {
    woolOrderId: order.woolOrderId,
    objectSkuCode: cuttingOutput.outputSkuCode,
    defaultLocationId: cuttingOutput.outputObjectType === 'WOOL_PANEL'
      ? 'WOOL-WH-CUT-DEFAULT' as const
      : 'WOOL-WH-GARMENT-DEFAULT' as const,
  }
  const cuttingReceiverStore = readWoolStore()
  replaceWoolStore({
    ...cuttingReceiverStore,
    handovers: cuttingReceiverStore.handovers.map((handover) => handover.handoverId === cuttingSource.handoverId
      ? {
          ...handover,
          receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE',
          receiverId: 'CUTTING-WAIT-HANDOVER',
          receiverName: '裁床待交出仓',
        }
      : handover),
  })
  const cuttingHead = listPdaHandoverHeads()
    .find((item) => item.sourceDocId === cuttingSource.handoverId)!
  const cuttingRecord = getPdaHandoverRecordsByHead(cuttingHead.handoverId)[0]!
  assert(canPdaFactoryAccessHandoverHead(cuttingHead, cuttingReceiverFactoryId!), '所属裁床工厂必须可访问裁床待交出仓毛织交出')
  assert(!canPdaFactoryAccessHandoverHead(cuttingHead, OWN_WOOL_FACTORY_ID), '来源毛织厂不得访问裁床待交出仓毛织交出')
  assert(!canPdaFactoryAccessHandoverHead(cuttingHead, TEST_FACTORY_ID), '无关工厂不得访问裁床待交出仓毛织交出')
  assert(
    getPdaHandoutHeads(cuttingReceiverFactoryId!).some((item) => item.handoverId === cuttingHead.handoverId),
    '所属裁床工厂 PDA 必须能看到裁床待交出仓毛织交出',
  )
  assert(
    ![OWN_WOOL_FACTORY_ID, TEST_FACTORY_ID]
      .some((factoryId) => getPdaHandoutHeads(factoryId).some((item) => item.handoverId === cuttingHead.handoverId)),
    '来源和无关工厂对裁床待交出仓毛织交出必须零可见',
  )
  loginPdaFactory(cuttingReceiverFactoryId!)
  appStore.navigate('/fcs/pda/handover?tab=handout')
  assert(renderPdaHandoverPage().includes(cuttingHead.handoverId), '所属裁床工厂真实 PDA 待交出页必须显示毛织交出')
  appStore.navigate(`/fcs/pda/handover/${cuttingHead.handoverId}`)
  assert(
    !renderPdaHandoverDetailPage(cuttingHead.handoverId).includes('该毛织交出不属于当前登录工厂'),
    '所属裁床工厂真实 PDA 会话必须可进入毛织交出详情',
  )
  completeWoolWorkOrder(order.woolOrderId, {
    commandId: 'CHECK-T13-COMPLETE-BEFORE-CUTTING-RECEIVE',
    completedAt: '2026-07-31 16:35:00',
    completedBy: '毛织主管',
  })
  loginPdaFactory(OWN_WOOL_FACTORY_ID)
  const beforeCuttingCrossFactoryWrite = JSON.stringify(readWoolStore())
  let cuttingSourceWriteRejected = false
  try {
    writeBackHandoverRecord({
      handoverRecordId: cuttingRecord.recordId,
      receiverWrittenQty: cuttingSource.handoverQty - 1,
      receiverWrittenAt: '2026-07-31 16:40:00',
      receiverWrittenBy: '来源厂仓管',
    })
  } catch {
    cuttingSourceWriteRejected = true
  }
  assert(cuttingSourceWriteRejected, '来源毛织厂不得确认裁床待交出仓接收')
  assert(JSON.stringify(readWoolStore()) === beforeCuttingCrossFactoryWrite, '来源毛织厂越权确认必须零写')
  loginPdaFactory(TEST_FACTORY_ID)
  const beforeUnrelatedCuttingWrite = JSON.stringify(readWoolStore())
  let unrelatedCuttingWriteRejected = false
  try {
    writeBackHandoverRecord({
      handoverRecordId: cuttingRecord.recordId,
      receiverWrittenQty: cuttingSource.handoverQty - 1,
      receiverWrittenAt: '2026-07-31 16:42:00',
      receiverWrittenBy: '无关工厂仓管',
    })
  } catch {
    unrelatedCuttingWriteRejected = true
  }
  assert(unrelatedCuttingWriteRejected, '无关工厂不得确认裁床待交出仓接收')
  assert(JSON.stringify(readWoolStore()) === beforeUnrelatedCuttingWrite, '无关工厂越权确认必须零写')
  const cuttingHandoverQtyBefore = readWoolStore().handovers
    .find((item) => item.handoverId === cuttingSource.handoverId)!.handoverQty
  const cuttingStockBefore = getWoolWarehouseStock(cuttingStockKey)
  loginPdaFactory(cuttingReceiverFactoryId!)
  writeBackHandoverRecord({
    handoverRecordId: cuttingRecord.recordId,
    receiverWrittenQty: cuttingHandoverQtyBefore - 1,
    receiverWrittenAt: '2026-07-31 16:45:00',
    receiverWrittenBy: '裁床仓管',
    receiverRemark: '实收少一片',
  })
  const cuttingAfter = readWoolStore().handovers
    .find((item) => item.handoverId === cuttingSource.handoverId)!
  assert(cuttingAfter.downstreamReceipt?.status === 'CONFIRMED', '加工单完成后，所属裁床仓管仍必须可确认接收')
  assert(cuttingAfter.downstreamReceipt.actualReceivedQty === cuttingHandoverQtyBefore - 1, '裁床接收必须保存实际数量')
  assert(cuttingAfter.downstreamReceipt.differenceQty === -1, '裁床接收必须保存差异')
  assert(cuttingAfter.downstreamReceipt.receivedBy === '裁床仓管', '裁床接收必须保存接收人')
  assert(cuttingAfter.downstreamReceipt.receivedAt === '2026-07-31 16:45:00', '裁床接收必须保存接收时间')
  assert(cuttingAfter.handoverQty === cuttingHandoverQtyBefore, '裁床接收不得修改来源交出数量')
  assert(getWoolWarehouseStock(cuttingStockKey) === cuttingStockBefore, '裁床接收不得恢复来源毛织库存')

  const toctouSource = sourceHandovers[1]
  const warehouseBeforeToctou = readWoolStore()
  replaceWoolStore({
    ...warehouseBeforeToctou,
    handovers: warehouseBeforeToctou.handovers.map((handover) => handover.handoverId === toctouSource.handoverId
      ? {
          ...handover,
          receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE',
          receiverId: 'CUTTING-WAIT-HANDOVER',
          receiverName: '裁床待交出仓',
        }
      : handover),
  })
  const toctouHead = listPdaHandoverHeads().find((item) => item.sourceDocId === toctouSource.handoverId)!
  const toctouRecord = getPdaHandoverRecordsByHead(toctouHead.handoverId)[0]!
  loginPdaFactory(cuttingReceiverFactoryId!)
  const beforeReceiverChange = readWoolStore()
  replaceWoolStore({
    ...beforeReceiverChange,
    handovers: beforeReceiverChange.handovers.map((handover) => handover.handoverId === toctouSource.handoverId
      ? {
          ...handover,
          receiverType: 'DOWNSTREAM_FACTORY',
          receiverId: TEST_FACTORY_ID,
          receiverName: '已切换的接收工厂',
        }
      : handover),
  })
  const beforeToctouWrite = JSON.stringify(readWoolStore())
  let staleWarehouseSessionRejected = false
  try {
    writeBackHandoverRecord({
      handoverRecordId: toctouRecord.recordId,
      receiverWrittenQty: toctouSource.handoverQty,
      receiverWrittenAt: '2026-07-31 16:50:00',
      receiverWrittenBy: '旧裁床仓管',
    })
  } catch {
    staleWarehouseSessionRejected = true
  }
  assert(staleWarehouseSessionRejected, '接收方切换后必须拒绝旧裁床仓管会话写入')
  assert(JSON.stringify(readWoolStore()) === beforeToctouWrite, '裁床接收 TOCTOU 拒绝必须零写')
}

function main(): void {
  checkForbiddenCopy()
  checkPageSignals()
  checkDataSignals()
  checkWoolFactHandoverProjection()
  console.log('check:pda-handover-pages passed')
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}
