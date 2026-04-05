#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import { hydratePdaExecutionWritebackStore } from '../src/data/fcs/cutting/pda-execution-writeback-ledger.ts'
import { listPdaCuttingTaskScenarios } from '../src/data/fcs/cutting/pda-cutting-task-scenarios.ts'
import {
  listPdaAwardedTenderNoticesByFactoryId,
  listPdaBiddingTendersByFactoryId,
  listPdaQuotedTendersByFactoryId,
  PDA_MOCK_AWARDED_TENDER_NOTICES,
  PDA_MOCK_BIDDING_TENDERS,
  PDA_MOCK_QUOTED_TENDERS,
} from '../src/data/fcs/pda-mobile-mock.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import { listPdaGenericHandoverHeadSeeds } from '../src/data/fcs/pda-task-mock-factory.ts'
import {
  PDA_MOBILE_FACTORY_PROFILES,
  PDA_MOBILE_PROCESS_DEFINITIONS,
  PDA_MOBILE_TASK_STAGE_MINIMUMS,
} from '../src/data/fcs/pda-task-scenario-matrix.ts'

const root = process.cwd()

function ensure(condition: boolean, errors: string[], message: string): void {
  if (!condition) errors.push(message)
}

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

const CUTTING_STATIC_HANDOVER_HEADS = [
  { handoverId: 'PKH-MOCK-CUT-089', factoryId: 'ID-F001', processName: '裁片', headType: 'PICKUP' },
  { handoverId: 'HOH-MOCK-CUT-094', factoryId: 'ID-F001', processName: '裁片', headType: 'DONE' },
  { handoverId: 'PKH-MOCK-CUT-020-F004', factoryId: 'ID-F004', processName: '裁片', headType: 'PICKUP' },
  { handoverId: 'HOH-MOCK-CUT-103-F004-OPEN', factoryId: 'ID-F004', processName: '裁片', headType: 'HANDOUT' },
  { handoverId: 'HOH-MOCK-CUT-103-F004-DONE', factoryId: 'ID-F004', processName: '裁片', headType: 'DONE' },
] as const

const genericHandoverHeadSeeds = listPdaGenericHandoverHeadSeeds()
const cuttingScenarios = listPdaCuttingTaskScenarios()
const tasks = [
  ...listPdaGenericProcessTasks(),
  ...cuttingScenarios.map((scenario) => ({
    processNameZh: '裁片',
    acceptanceStatus: scenario.acceptanceStatus,
    status: scenario.taskStatus,
    assignedFactoryId: scenario.assignedFactoryId,
  })),
]

function countPickupHeadsByFactory(factoryId?: string): number {
  return (
    genericHandoverHeadSeeds.filter(
      (head) => head.headType === 'PICKUP' && (!factoryId || head.factoryId === factoryId),
    ).length +
    CUTTING_STATIC_HANDOVER_HEADS.filter(
      (head) => head.headType === 'PICKUP' && (!factoryId || head.factoryId === factoryId),
    ).length
  )
}

function countHandoutHeadsByFactory(factoryId?: string): number {
  return (
    genericHandoverHeadSeeds.filter(
      (head) => head.headType === 'HANDOUT' && head.completionStatus === 'OPEN' && (!factoryId || head.factoryId === factoryId),
    ).length +
    CUTTING_STATIC_HANDOVER_HEADS.filter(
      (head) => head.headType === 'HANDOUT' && (!factoryId || head.factoryId === factoryId),
    ).length
  )
}

function countDoneHeadsByFactory(factoryId?: string): number {
  return (
    genericHandoverHeadSeeds.filter(
      (head) => head.headType === 'HANDOUT' && head.completionStatus === 'COMPLETED' && (!factoryId || head.factoryId === factoryId),
    ).length +
    CUTTING_STATIC_HANDOVER_HEADS.filter(
      (head) => head.headType === 'DONE' && (!factoryId || head.factoryId === factoryId),
    ).length
  )
}

function countHandoverHeadsByProcess(processName: string): number {
  return (
    genericHandoverHeadSeeds.filter((head) => head.processName === processName).length +
    CUTTING_STATIC_HANDOVER_HEADS.filter((head) => head.processName === processName).length
  )
}

function countReceiveStage(processName: string): number {
  return (
    tasks.filter(
      (task) =>
        task.processNameZh === processName &&
        (task.acceptanceStatus === 'PENDING' ||
          task.acceptanceStatus === 'REJECTED' ||
          (task.acceptanceStatus === 'ACCEPTED' && task.status === 'NOT_STARTED')),
    ).length +
    PDA_MOCK_BIDDING_TENDERS.filter((item) => item.processName === processName).length +
    PDA_MOCK_QUOTED_TENDERS.filter((item) => item.processName === processName).length +
    PDA_MOCK_AWARDED_TENDER_NOTICES.filter((item) => item.processName === processName).length
  )
}

function countExecStage(processName: string): number {
  return tasks.filter(
    (task) => task.processNameZh === processName && task.acceptanceStatus === 'ACCEPTED',
  ).length
}

function countHandoverStage(processName: string): number {
  return countHandoverHeadsByProcess(processName)
}

function countTodoStage(processName: string): number {
  return (
    tasks.filter(
      (task) =>
        task.processNameZh === processName &&
        (task.acceptanceStatus === 'PENDING' ||
          task.acceptanceStatus === 'REJECTED' ||
          task.status === 'BLOCKED'),
    ).length +
    genericHandoverHeadSeeds.filter(
      (head) => head.processName === processName && head.completionStatus === 'OPEN',
    ).length +
    CUTTING_STATIC_HANDOVER_HEADS.filter(
      (head) => head.processName === processName && head.headType !== 'DONE',
    ).length
  )
}

function main(): void {
  const errors: string[] = []
  const cuttingExecutions = cuttingScenarios.flatMap((scenario) => scenario.executions)
  const ledger = hydratePdaExecutionWritebackStore()
  const supportedProcesses = PDA_MOBILE_PROCESS_DEFINITIONS.filter((item) => item.supportsTaskMatrix)

  ensure(supportedProcesses.length >= 8, errors, '当前移动端支持的工序类型少于 8 种')

  supportedProcesses.forEach((processDef) => {
    const processName = processDef.processNameZh
    const todo = countTodoStage(processName)
    const receive = countReceiveStage(processName)
    const exec = countExecStage(processName)
    const handover = countHandoverStage(processName)

    ensure(
      todo >= PDA_MOBILE_TASK_STAGE_MINIMUMS.TODO,
      errors,
      `${processName} 待办阶段少于 ${PDA_MOBILE_TASK_STAGE_MINIMUMS.TODO} 条`,
    )
    ensure(
      receive >= PDA_MOBILE_TASK_STAGE_MINIMUMS.RECEIVE,
      errors,
      `${processName} 接单阶段少于 ${PDA_MOBILE_TASK_STAGE_MINIMUMS.RECEIVE} 条`,
    )
    ensure(
      exec >= PDA_MOBILE_TASK_STAGE_MINIMUMS.EXEC,
      errors,
      `${processName} 执行阶段少于 ${PDA_MOBILE_TASK_STAGE_MINIMUMS.EXEC} 条`,
    )
    ensure(
      handover >= PDA_MOBILE_TASK_STAGE_MINIMUMS.HANDOVER,
      errors,
      `${processName} 交接阶段少于 ${PDA_MOBILE_TASK_STAGE_MINIMUMS.HANDOVER} 条`,
    )
  })

  const acceptanceStatuses = new Set(tasks.map((task) => task.acceptanceStatus).filter(Boolean))
  const taskStatuses = new Set(tasks.map((task) => task.status))

  ;['PENDING', 'ACCEPTED', 'REJECTED'].forEach((status) =>
    ensure(acceptanceStatuses.has(status), errors, `PDA 任务缺少接单状态：${status}`),
  )
  ;['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'].forEach((status) =>
    ensure(taskStatuses.has(status), errors, `PDA 任务缺少执行状态：${status}`),
  )

  ensure(cuttingExecutions.some((execution) => execution.bindingState === 'UNBOUND'), errors, '裁片任务缺少 UNBOUND execution')
  ensure(cuttingScenarios.some((scenario) => scenario.executions.length > 1), errors, '裁片任务缺少多 execution 场景')
  ensure(cuttingExecutions.some((execution) => Boolean(execution.mergeBatchNo)), errors, '裁片任务缺少 merge batch 场景')
  ensure(ledger.pickupWritebacks.length >= 4, errors, '裁片 pickup 预置写回少于 4 条')
  ensure(ledger.inboundWritebacks.length >= 3, errors, '裁片 inbound 预置写回少于 3 条')
  ensure(ledger.handoverWritebacks.length >= 3, errors, '裁片 handover 预置写回少于 3 条')
  ensure(ledger.replenishmentFeedbackWritebacks.length >= 4, errors, '裁片补料反馈预置少于 4 条')

  const ordinaryExecTasks = tasks.filter(
    (task) => task.assignedFactoryId === 'ID-F001' && task.acceptanceStatus === 'ACCEPTED',
  )
  const ordinaryCuttingCount = ordinaryExecTasks.filter((task) => task.processNameZh === '裁片').length
  const ordinaryNonCuttingCount = ordinaryExecTasks.filter((task) => task.processNameZh !== '裁片').length
  ensure(
    ordinaryNonCuttingCount > ordinaryCuttingCount,
    errors,
    '普通成衣工厂执行页仍主要由裁片任务构成',
  )

  const printingExecTasks = tasks.filter(
    (task) => task.assignedFactoryId === 'ID-F002' && task.acceptanceStatus === 'ACCEPTED',
  )
  ensure(
    printingExecTasks.length >= PDA_MOBILE_TASK_STAGE_MINIMUMS.EXEC &&
      printingExecTasks.every((task) => task.processNameZh === '印花'),
    errors,
    '印花专厂执行页未由印花任务主导',
  )

  const dyeingExecTasks = tasks.filter(
    (task) => task.assignedFactoryId === 'ID-F003' && task.acceptanceStatus === 'ACCEPTED',
  )
  ensure(
    dyeingExecTasks.length >= PDA_MOBILE_TASK_STAGE_MINIMUMS.EXEC &&
      dyeingExecTasks.every((task) => task.processNameZh === '染色'),
    errors,
    '染色专厂执行页未由染色任务主导',
  )

  const cuttingExecTasks = tasks.filter(
    (task) => task.assignedFactoryId === 'ID-F004' && task.acceptanceStatus === 'ACCEPTED',
  )
  ensure(
    cuttingExecTasks.length >= 1 && cuttingExecTasks.every((task) => task.processNameZh === '裁片'),
    errors,
    '裁片专厂执行页未由裁片任务主导',
  )
  ensure(countPickupHeadsByFactory('ID-F004') > 0, errors, '裁片专厂缺少待领料交接 mock')
  ensure(countHandoutHeadsByFactory('ID-F004') > 0, errors, '裁片专厂缺少待交出交接 mock')
  ensure(countDoneHeadsByFactory('ID-F004') > 0, errors, '裁片专厂缺少已完成交接 mock')

  PDA_MOBILE_FACTORY_PROFILES.forEach((factory) => {
    ensure(listPdaBiddingTendersByFactoryId(factory.factoryId).length > 0 || factory.factoryId === 'ID-F001', errors, `${factory.label} 缺少待报价招标 mock`)
    ensure(listPdaQuotedTendersByFactoryId(factory.factoryId).length > 0 || factory.factoryId === 'ID-F001', errors, `${factory.label} 缺少已报价招标 mock`)
    ensure(listPdaAwardedTenderNoticesByFactoryId(factory.factoryId).length > 0, errors, `${factory.label} 缺少已中标任务 mock`)
  })

  const receivePage = read('src/pages/pda-task-receive.ts')
  const notifyPage = read('src/pages/pda-notify.ts')
  const execPage = read('src/pages/pda-exec.ts')
  const handoverPage = read('src/pages/pda-handover.ts')
  const handoverSource = read('src/data/fcs/pda-handover-events.ts')
  const detailPage = read('src/pages/pda-cutting-task-detail.ts')
  const spreadingSource = read('src/data/fcs/pda-cutting-execution-source.ts')

  ensure(receivePage.includes('listPdaBiddingTendersByFactoryId'), errors, 'pda-task-receive 未按工厂消费待报价 mock')
  ensure(receivePage.includes('listPdaQuotedTendersByFactoryId'), errors, 'pda-task-receive 未按工厂消费已报价 mock')
  ensure(receivePage.includes("task.status === 'BLOCKED'"), errors, 'pda-task-receive 未映射生产暂停状态')
  ensure(receivePage.includes("task.status === 'CANCELLED'"), errors, 'pda-task-receive 未映射已中止状态')
  ensure(notifyPage.includes('listPdaBiddingTendersByFactoryId'), errors, 'pda-notify 未按工厂消费待报价 mock')
  ensure(notifyPage.includes('listPdaAwardedTenderNoticesByFactoryId'), errors, 'pda-notify 未按工厂消费已中标 mock')
  ensure(execPage.includes("type TaskStatusTab = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'"), errors, 'pda-exec 缺少丰富状态页签')
  ensure(execPage.includes("task.assignedFactoryId === factoryId && task.acceptanceStatus === 'ACCEPTED'"), errors, 'pda-exec 未按工厂消费执行 mock')
  ensure(handoverPage.includes('getPdaPickupHeads'), errors, 'pda-handover 未消费待领料 mock')
  ensure(handoverPage.includes('getPdaHandoutHeads'), errors, 'pda-handover 未消费待交出 mock')
  ensure(handoverPage.includes('getPdaCompletedHeads'), errors, 'pda-handover 未消费已完成交接 mock')
  ensure(spreadingSource.includes('spreadingTargets'), errors, 'PDA 裁片执行源缺少铺布对象投影')
  ensure(spreadingSource.includes('sourceWritebackId'), errors, 'PDA 裁片执行源缺少铺布写回追溯字段')
  ensure(spreadingSource.includes('handoverFlag'), errors, 'PDA 裁片执行源缺少换班标记字段')
  ensure(spreadingSource.includes('enteredByAccountId'), errors, 'PDA 裁片执行源缺少录入账号字段')
  CUTTING_STATIC_HANDOVER_HEADS.forEach((head) => {
    ensure(handoverSource.includes(head.handoverId), errors, `交接 mock 缺少静态头：${head.handoverId}`)
  })
  ensure(detailPage.includes('待绑定原始裁片单'), errors, 'pda-cutting-task-detail 未覆盖 UNBOUND 场景')
  ensure(detailPage.includes('关联合并裁剪批次'), errors, 'pda-cutting-task-detail 未覆盖 merge batch 场景')

  if (errors.length > 0) {
    console.error('check-cutting-pda-mock-coverage failed:')
    errors.forEach((error) => console.error(`- ${error}`))
    process.exit(1)
  }

  const processSummary = Object.fromEntries(
    supportedProcesses.map((item) => [
      item.processNameZh,
      {
        todo: countTodoStage(item.processNameZh),
        receive: countReceiveStage(item.processNameZh),
        exec: countExecStage(item.processNameZh),
        handover: countHandoverStage(item.processNameZh),
      },
    ]),
  )

  const factorySummary = Object.fromEntries(
    PDA_MOBILE_FACTORY_PROFILES.map((factory) => [
      factory.factoryId,
      {
        bidding: listPdaBiddingTendersByFactoryId(factory.factoryId).length,
        quoted: listPdaQuotedTendersByFactoryId(factory.factoryId).length,
        awarded: listPdaAwardedTenderNoticesByFactoryId(factory.factoryId).length,
        execAccepted: tasks.filter(
          (task) => task.assignedFactoryId === factory.factoryId && task.acceptanceStatus === 'ACCEPTED',
        ).length,
        pickupHeads: countPickupHeadsByFactory(factory.factoryId),
        handoutHeads: countHandoutHeadsByFactory(factory.factoryId),
        doneHeads: countDoneHeadsByFactory(factory.factoryId),
      },
    ]),
  )

  console.log(
    JSON.stringify(
      {
        supportedProcessCount: supportedProcesses.length,
        processSummary,
        factorySummary,
        cuttingWritebackSeedSummary: {
          pickup: ledger.pickupWritebacks.length,
          inbound: ledger.inboundWritebacks.length,
          handover: ledger.handoverWritebacks.length,
          replenishment: ledger.replenishmentFeedbackWritebacks.length,
        },
      },
      null,
      2,
    ),
  )
}

main()
