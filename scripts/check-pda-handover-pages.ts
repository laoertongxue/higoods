#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  canPdaFactoryAccessHandoverHead,
  getPdaHandoutHeads,
  getPdaHandoverRecordsByHead,
  listPdaHandoverHeads,
  listQuantityObjections,
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
import { removedLegacyProcessCodes } from './utils/special-craft-banlist.ts'

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
    legacyMobileCopy('领料', '头'),
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

  ;['交出单二维码', '交出记录二维码', '新增交出记录', '完成领料单', '完成交出单', '确认收货', '发起异议', '接受差异', '入库记录', '出库记录', '已入待加工仓', '已生成出库记录', '已驳回'].forEach((term) => {
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
  assert(detailPage.includes('linkPickupConfirmToInboundRecord'), 'pda-handover-detail.ts 未接入待领料到入库联动 helper')
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
  assert(pickupHeads.length > 0, 'pickup 领料样例丢失')

  handoutHeads.forEach((head) => {
    const records = getPdaHandoverRecordsByHead(head.handoverId)
    records.forEach((record) => {
      assert(Boolean(record.handoverRecordQrValue), `交出记录缺少二维码：${record.recordId}`)
      assert(record.factorySubmittedByKind === 'FACTORY', `交出记录必须由工厂发起：${record.recordId}`)
    })
    assert(!['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING'].includes(head.processBusinessCode || ''), `后道产能节点误入交出场景：${head.handoverId}`)
    assert(!['WASHING', ...removedLegacyProcessCodes].includes(head.processBusinessCode || ''), `历史停用工序误入交出场景：${head.handoverId}`)
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

  const toctouSource = sourceHandovers.find((item) => item.handoverId !== source.handoverId)!
  const toctouHead = listPdaHandoverHeads().find((item) => item.sourceDocId === toctouSource.handoverId)!
  const toctouRecord = getPdaHandoverRecordsByHead(toctouHead.handoverId)[0]!
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
  let staleSessionRejected = false
  try {
    writeBackHandoverRecord({
      handoverRecordId: toctouRecord.recordId,
      receiverWrittenQty: toctouSource.handoverQty,
      receiverWrittenAt: '2026-07-31 16:40:00',
      receiverWrittenBy: '旧接收方仓管',
    })
  } catch {
    staleSessionRejected = true
  }
  assert(staleSessionRejected, '接收方变化后必须用最新交出事实拒绝旧会话写入')
  assert(JSON.stringify(readWoolStore()) === beforeToctouWrite, 'TOCTOU 拒绝必须零写')

  const nonFactoryStore = readWoolStore()
  replaceWoolStore({
    ...nonFactoryStore,
    handovers: nonFactoryStore.handovers.map((handover) => handover.handoverId === toctouSource.handoverId
      ? {
          ...handover,
          receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE',
          receiverId: 'WOOL-CUTTING-WAIT-HANDOVER',
          receiverName: '裁床待交出仓',
        }
      : handover),
  })
  const nonFactoryHead = listPdaHandoverHeads()
    .find((item) => item.sourceDocId === toctouSource.handoverId)!
  assert(nonFactoryHead, '非工厂接收方的交出仍必须保留通用非 PDA 投影')
  assert(nonFactoryHead.factoryId !== OWN_WOOL_FACTORY_ID, '非工厂接收方不得错误映射为来源毛织厂')
  assert(
    ![OWN_WOOL_FACTORY_ID, DEDICATED_POST_FACTORY_ID, TEST_FACTORY_ID]
      .some((factoryId) => getPdaHandoutHeads(factoryId).some((item) => item.handoverId === nonFactoryHead.handoverId)),
    '非工厂接收方不得进入任一工厂 PDA 待接收列表',
  )
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
