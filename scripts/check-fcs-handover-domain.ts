#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  canCompletePdaHandoutHead,
  canCompletePdaPickupHead,
  ensureHandoverOrderForStartedTask,
  getHandoverOrderById,
  getPdaHandoverRecordsByHead,
  listHandoverOrdersByTaskId,
  listPdaHandoverHeads,
  listQuantityObjections,
  listReceiverWritebacks,
} from '../src/data/fcs/pda-handover-events.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import { processTasks } from '../src/data/fcs/process-tasks.ts'
import {
  getRuntimeTaskById,
  listRuntimeProcessTasks,
} from '../src/data/fcs/runtime-process-tasks.ts'
import {
  buildHandoverOrderQrValue,
  buildHandoverRecordQrValue,
  buildTaskQrValue,
  parseFcsQrValue,
} from '../src/data/fcs/task-qr.ts'
import { buildTaskDeliveryCardPrintDocByRecordId } from '../src/data/fcs/task-print-cards.ts'
import { removedLegacyProcessCodes } from './utils/special-craft-banlist.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function buildToken(...parts: string[]): string {
  return parts.join('')
}

type TaskLike = {
  taskId: string
  processCode: string
  processBusinessCode?: string
  processNameZh: string
  startedAt?: string
  taskQrValue?: string
  receiverKind?: 'WAREHOUSE' | 'MANAGED_POST_FACTORY'
  receiverName?: string
}

const POST_CAPACITY_PROCESS_CODES = new Set(['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING'])
const BANNED_PROCESS_CODES = new Set(['WASHING', ...removedLegacyProcessCodes])

function resolveBusinessProcessCode(task: TaskLike): string {
  return task.processBusinessCode || task.processCode
}

function isExternalTask(task: TaskLike): boolean {
  const processCode = resolveBusinessProcessCode(task)
  return !POST_CAPACITY_PROCESS_CODES.has(processCode) && !BANNED_PROCESS_CODES.has(processCode)
}

function assertQrValue(label: string, actual: string | undefined, expected: string): void {
  assert(actual === expected, `${label} 二维码值错误：期望 ${expected}，实际 ${actual ?? '空'}`)
  const parsed = parseFcsQrValue(actual ?? '')
  assert(parsed.type !== 'UNKNOWN', `${label} 二维码无法解析`)
}

function scanBannedCopy(): void {
  const files = [
    'src/data/fcs/factory-warehouse-linkage.ts',
    'src/data/fcs/pda-handover-events.ts',
    'src/data/fcs/pda-task-mock-factory.ts',
    'src/pages/pda-exec-detail.ts',
    'src/pages/pda-handover.ts',
    'src/pages/pda-handover-detail.ts',
    'src/pages/progress-handover.ts',
    'src/pages/progress-handover-order.ts',
  ]

  const bannedTerms = ['印花PDA', '染色PDA', '印花 PDA', '染色 PDA']
  for (const file of files) {
    const source = fs.readFileSync(path.resolve(file), 'utf8')
    for (const term of bannedTerms) {
      assert(!source.includes(term), `${file} 仍残留禁用文案：${term}`)
    }
  }
}

function checkNoDuplicateWarehouseFlowModels(): void {
  const files = [
    'src/data/fcs/factory-warehouse-linkage.ts',
    'src/data/fcs/factory-internal-warehouse.ts',
    'src/data/fcs/pda-handover-events.ts',
    'src/data/fcs/task-handover-domain.ts',
    'src/pages/pda-handover-detail.ts',
    'src/pages/pda-warehouse-wait-process.ts',
    'src/pages/pda-warehouse-wait-handover.ts',
  ]
  const bannedTokens = [
    'FactoryPickupOrder',
    'WarehousePickupOrder',
    'FactoryMaterialPickupOrder',
    buildToken('Warehouse', 'HandoverOrder'),
    buildToken('Factory', 'OutboundOrder'),
    'FactoryDeliveryOrder',
    'WarehouseDeliveryOrder',
    buildToken('仓库', '领料单'),
    buildToken('仓库', '交出单'),
    buildToken('create', 'Warehouse', 'Handover'),
    'createWarehousePickup',
  ]

  const source = files
    .filter((file) => fs.existsSync(path.resolve(file)))
    .map((file) => fs.readFileSync(path.resolve(file), 'utf8'))
    .join('\n')

  bannedTokens.forEach((token) => {
    assert(!source.includes(token), `不应新增并行领料/交出主模型：${token}`)
  })
}

function collectTaskUniverse(): TaskLike[] {
  const byId = new Map<string, TaskLike>()
  ;[...processTasks, ...listRuntimeProcessTasks(), ...listPdaGenericProcessTasks()].forEach((task) => {
    byId.set(task.taskId, task)
  })
  return [...byId.values()]
}

function checkTaskQrCoverage(): void {
  const tasks = collectTaskUniverse()
  const externalTasks = tasks.filter((task) => isExternalTask(task))
  assert(externalTasks.length > 0, '未找到任何对外交付任务，无法校验二维码覆盖')

  externalTasks.forEach((task) => {
    assertQrValue(`任务 ${task.taskId}`, task.taskQrValue, buildTaskQrValue(task.taskId))
  })

  tasks
    .filter((task) => POST_CAPACITY_PROCESS_CODES.has(resolveBusinessProcessCode(task)))
    .forEach((task) => {
      assert(!task.taskQrValue, `后道产能节点不应具备任务二维码：${task.taskId}`)
    })
}

function checkAutoCreateHelper(): void {
  const candidate = listPdaGenericProcessTasks().find(
    (task) => task.startedAt && isExternalTask(task) && listHandoverOrdersByTaskId(task.taskId).length === 0,
  )
  assert(candidate, '未找到可用于自动创建交出单的已开工任务样例')

  const created = ensureHandoverOrderForStartedTask(candidate.taskId)
  const order = getHandoverOrderById(created.handoverOrderId)
  assert(order, `自动创建后未找到交出单：${created.handoverOrderId}`)
  assertQrValue(
    `交出单 ${created.handoverOrderId}`,
    order?.handoverOrderQrValue,
    buildHandoverOrderQrValue(created.handoverOrderId),
  )

  const orders = listHandoverOrdersByTaskId(candidate.taskId)
  assert(orders.length === 1, `已开工任务应最多只有一个交出单：${candidate.taskId}`)
}

function checkHandoverOrdersAndRecords(): void {
  const heads = listPdaHandoverHeads().filter((head) => head.headType === 'HANDOUT')
  assert(heads.length > 0, '未找到任何交出单样例')

  heads.forEach((head) => {
    const handoverOrderId = head.handoverOrderId || head.handoverId
    assertQrValue(
      `交出单 ${handoverOrderId}`,
      head.handoverOrderQrValue,
      buildHandoverOrderQrValue(handoverOrderId),
    )
    assert(head.receiverKind === 'WAREHOUSE' || head.receiverKind === 'MANAGED_POST_FACTORY', `交出单接收方类型非法：${handoverOrderId}`)

    if (POST_CAPACITY_PROCESS_CODES.has(head.processBusinessCode || '')) {
      throw new Error(`后道产能节点不应生成交出单：${handoverOrderId}`)
    }

    const records = getPdaHandoverRecordsByHead(head.handoverId)
    records.forEach((record) => {
      const handoverRecordId = record.handoverRecordId || record.recordId
      assertQrValue(
        `交出记录 ${handoverRecordId}`,
        record.handoverRecordQrValue,
        buildHandoverRecordQrValue(handoverRecordId),
      )
      assert(record.factorySubmittedByKind === 'FACTORY', `交出记录必须由工厂发起：${handoverRecordId}`)
      assert(typeof record.submittedQty === 'number' && record.submittedQty >= 0, `交出记录缺少提交数量：${handoverRecordId}`)

      if (typeof record.receiverWrittenQty === 'number') {
        assert(
          record.diffQty === record.receiverWrittenQty - (record.submittedQty ?? 0),
          `交出记录差异数量不是系统计算结果：${handoverRecordId}`,
        )
      }
    })
  })
}

function checkWritebacksAndObjections(): void {
  const writebacks = listReceiverWritebacks()
  const objections = listQuantityObjections()

  assert(writebacks.length > 0, '缺少接收方回写样例')
  assert(objections.length > 0, '缺少数量异议样例')

  writebacks.forEach((writeback) => {
    const runtimeRecord = listPdaHandoverHeads()
      .filter((head) => head.headType === 'HANDOUT')
      .flatMap((head) => getPdaHandoverRecordsByHead(head.handoverId))
      .find((record) => (record.handoverRecordId || record.recordId) === writeback.handoverRecordId)
    assert(runtimeRecord, `接收方回写未关联到已有交出记录：${writeback.writebackId}`)
    assert(writeback.diffQty === writeback.writtenQty - writeback.submittedQty, `接收方回写差异数量错误：${writeback.writebackId}`)
  })

  objections.forEach((objection) => {
    assert(objection.raisedByKind === 'FACTORY', `数量异议必须由工厂发起：${objection.objectionId}`)
  })
}

function checkRequiredScenarios(): void {
  const heads = listPdaHandoverHeads().filter((head) => head.headType === 'HANDOUT')

  const printHead = heads.find((head) => head.processName.includes('印花') && head.receiverName === '中转区域')
  assert(printHead, '缺少“印花任务交出到中转区域”样例')

  const dyeHead = heads.find((head) => head.processName.includes('染色') && head.receiverName === '中转区域')
  assert(dyeHead, '缺少“染色任务交出到中转区域”样例')

  const sewingHead = heads.find((head) => head.processName.includes('车缝') && head.receiverKind === 'MANAGED_POST_FACTORY')
  assert(sewingHead, '缺少“车缝任务交出到我方后道工厂”样例')
  const sewingRecords = getPdaHandoverRecordsByHead(sewingHead!.handoverId)
  assert(sewingRecords.some((record) => typeof record.receiverWrittenQty === 'number'), '车缝交出样例缺少接收方回写数量')
  assert(
    sewingRecords.some(
      (record) =>
        (record.handoverRecordStatus === 'WRITTEN_BACK_DIFF' || record.handoverRecordStatus === 'OBJECTION_REPORTED')
        && typeof record.receiverWrittenQty === 'number',
    ),
    '车缝交出样例缺少数量差异记录',
  )

  const postHead = heads.find((head) => head.processBusinessCode === 'POST_FINISHING' && head.receiverName === '成衣仓交接点')
  assert(postHead, '缺少“后道父任务交出到成衣仓交接点”样例')

  heads.forEach((head) => {
    assert(!BANNED_PROCESS_CODES.has(head.processBusinessCode || ''), `交出样例仍使用历史停用工序：${head.handoverId}`)
  })
}

function checkPickupCompatibility(): void {
  const pickupHeads = listPdaHandoverHeads().filter((head) => head.headType === 'PICKUP')
  assert(pickupHeads.length > 0, 'pickup 领料样例丢失')
}

function checkPickupAndHandoutCompletionSemantics(): void {
  const pickupHeads = listPdaHandoverHeads().filter((head) => head.headType === 'PICKUP')
  const handoutHeads = listPdaHandoverHeads().filter((head) => head.headType === 'HANDOUT')
  assert(pickupHeads.some((head) => canCompletePdaPickupHead(head.handoverId).message.includes('领料单')), '领料单完成校验必须返回业务文案')
  assert(handoutHeads.some((head) => canCompletePdaHandoutHead(head.handoverId).message.includes('交出单')), '交出单完成校验必须返回业务文案')
  handoutHeads.forEach((head) => {
    const result = canCompletePdaHandoutHead(head.handoverId)
    assert(!result.message.includes('回写'), '完成交出单不得要求全部回写完成')
    assert(!result.message.includes('异议关闭'), '完成交出单不得要求全部异议关闭')
  })
}

function checkNoPostCapacityHandover(): void {
  const handoutHeads = listPdaHandoverHeads().filter((head) => head.headType === 'HANDOUT')
  handoutHeads.forEach((head) => {
    const runtimeTask = getRuntimeTaskById(head.taskId)
    const processCode = head.processBusinessCode || runtimeTask?.processBusinessCode || runtimeTask?.processCode || ''
    assert(!POST_CAPACITY_PROCESS_CODES.has(processCode), `后道产能节点误入交出链路：${head.handoverId} -> ${processCode}`)
  })
}

function checkTaskDeliveryCardPrintDoc(): void {
  const handoutHead = listPdaHandoverHeads().find((head) => head.headType === 'HANDOUT' && getPdaHandoverRecordsByHead(head.handoverId).length > 0)
  assert(handoutHead, '缺少任务交货卡可用交出单样例')
  const record = getPdaHandoverRecordsByHead(handoutHead!.handoverId)[0]
  const handoverRecordId = record.handoverRecordId || record.recordId
  const doc = buildTaskDeliveryCardPrintDocByRecordId(handoverRecordId)
  assert(doc.handoverOrderNo === (handoutHead!.handoverOrderNo || handoutHead!.handoverOrderId || handoutHead!.handoverId), '任务交货卡缺少交出单号')
  assert(doc.handoverRecordId === handoverRecordId, '任务交货卡必须按交出记录生成')
  assert(doc.sequenceNo === record.sequenceNo, '任务交货卡第几次交货必须来自交出记录 sequenceNo')
  assert(doc.deliverySequenceLabel === `第 ${record.sequenceNo} 次交货`, '任务交货卡交货次数文案错误')
  assert(doc.qrValue === (record.handoverRecordQrValue || buildHandoverRecordQrValue(handoverRecordId)), '任务交货卡二维码必须来自交出记录二维码')
  assert(doc.lineRows.length > 0, '任务交货卡必须展示交出记录明细')
}

function main(): void {
  scanBannedCopy()
  checkNoDuplicateWarehouseFlowModels()
  checkTaskQrCoverage()
  checkAutoCreateHelper()
  checkHandoverOrdersAndRecords()
  checkWritebacksAndObjections()
  checkRequiredScenarios()
  checkPickupCompatibility()
  checkPickupAndHandoutCompletionSemantics()
  checkNoPostCapacityHandover()
  checkTaskDeliveryCardPrintDoc()
  console.log('check:fcs-handover-domain passed')
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}
