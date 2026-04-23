#!/usr/bin/env node

import process from 'node:process'
import { readFileSync } from 'node:fs'
import {
  listPostProcessRoutes,
  getPostExecutionModeLabel,
} from '../src/data/fcs/post-process-route.ts'
import {
  returnInboundChainBatches,
  returnInboundChainQualityInspections,
} from '../src/data/fcs/return-inbound-quality-chain-facts.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function readSource(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function main(): void {
  const legacyModeA = ['SEW', 'WITH', 'POST'].join('_')
  const legacyModeB = ['SEW', 'WITHOUT', 'POST', 'WAREHOUSE', 'INTEGRATED'].join('_')
  const legacyCopyA = ['后道', '仓', '一体'].join('')
  const legacyCopyB = ['车缝', '直接回', '成衣仓'].join('')
  const forbiddenQualityTitle = ['PDA', '质检'].join(' ')
  const legacyCopyAMessage = `页面仍出现“${legacyCopyA}”`
  const legacyCopyBMessage = `页面仍出现“${legacyCopyB}”`
  const forbiddenQualityTitleMessage = `页面仍出现“${forbiddenQualityTitle}”`

  const routes = listPostProcessRoutes()
  assert(routes.length >= 4, `后道路由样例不足: ${routes.length}`)

  const modeSet = new Set(routes.map((route) => route.postExecutionMode))
  assert(modeSet.has('SEW_FACTORY_INCLUDES_POST'), '缺少“车缝厂含后道”路由样例')
  assert(modeSet.has('MANAGED_POST_FACTORY_EXECUTES'), '缺少“我方后道工厂执行后道”路由样例')

  for (const route of routes) {
    assert(route.requiresReceivingQc, `${route.postRouteId} 未开启回货质检`)
    assert(route.requiresFinalRecheck, `${route.postRouteId} 未开启后道复检`)
    assert(route.managedPostFactoryName === '我方后道工厂', `${route.postRouteId} 接收方不是我方后道工厂`)
    assert(route.finishedWarehouseName === '成衣仓交接点', `${route.postRouteId} 成衣仓交接点口径错误`)

    if (route.postExecutionMode === 'SEW_FACTORY_INCLUDES_POST') {
      assert(route.requiresPostExecution === false, `${route.postRouteId} 车缝厂含后道不应再执行我方后道任务`)
      assert(getPostExecutionModeLabel(route.postExecutionMode) === '车缝厂含后道', `${route.postRouteId} 路由标签错误`)
    }

    if (route.postExecutionMode === 'MANAGED_POST_FACTORY_EXECUTES') {
      assert(route.requiresPostExecution === true, `${route.postRouteId} 我方后道工厂执行模式必须要求后道任务`)
      assert(Boolean(route.postTaskId), `${route.postRouteId} 缺少后道任务`)
      assert(getPostExecutionModeLabel(route.postExecutionMode) === '我方后道工厂执行后道', `${route.postRouteId} 路由标签错误`)
    }
  }

  const qcRecords = returnInboundChainQualityInspections.filter(
    (inspection) =>
      inspection.inspectionType === 'QC' &&
      inspection.inspectionScene !== 'POST_FINAL_RECHECK',
  )
  const recheckRecords = returnInboundChainQualityInspections.filter(
    (inspection) => inspection.inspectionType === 'RECHECK',
  )

  assert(qcRecords.length > 0, '缺少回货质检样例')
  assert(recheckRecords.length > 0, '缺少后道复检样例')
  assert(recheckRecords.every((inspection) => inspection.inspectionScene === 'POST_FINAL_RECHECK'), '复检场景口径错误')
  assert(recheckRecords.some((inspection) => inspection.inspectionMethod === 'COUNT_ONLY'), '后道复检缺少数量复核样例')

  const methodSet = new Set(returnInboundChainQualityInspections.map((inspection) => inspection.inspectionMethod))
  assert(methodSet.has('COUNT_ONLY'), '缺少数量复核数据样例')
  assert(methodSet.has('SAMPLING'), '缺少抽检数据样例')
  assert(methodSet.has('FULL_INSPECTION'), '缺少全检数据样例')

  for (const inspection of returnInboundChainQualityInspections) {
    assert(
      inspection.sourceType === 'HANDOVER_ORDER' || inspection.sourceType === 'HANDOVER_RECORD',
      `${inspection.qcId} 不是基于交出来源创建`,
    )
    assert(Boolean(inspection.handoverOrderId || inspection.handoverRecordIds?.length), `${inspection.qcId} 缺少交出来源`)
    assert(typeof inspection.receivedQty === 'number' && inspection.receivedQty >= 0, `${inspection.qcId} 缺少接收方实收数量`)

    if (inspection.inspectionMethod === 'FULL_INSPECTION') {
      assert(inspection.inspectedQty === inspection.receivedQty, `${inspection.qcId} 全检数量必须等于实收数量`)
    }

    if (inspection.inspectionMethod === 'SAMPLING') {
      assert(
        typeof inspection.samplingQty === 'number' || typeof inspection.samplingRatio === 'number',
        `${inspection.qcId} 抽检缺少抽检数量或抽检比例`,
      )
    }

    if (inspection.inspectionMethod === 'COUNT_ONLY') {
      assert(
        inspection.inspectionType === 'RECHECK' || inspection.defectItems.length === 0,
        `${inspection.qcId} 数量复核不应依赖缺陷项`,
      )
    }
  }

  for (const inspection of qcRecords) {
    const batch = returnInboundChainBatches.find((item) => item.batchId === inspection.returnBatchId)
    assert(Boolean(batch), `${inspection.qcId} 找不到回货批次`)
    assert(typeof batch?.receiverWrittenQty === 'number', `${inspection.qcId} 缺少接收方回写数量`)
    assert(inspection.receivedQty === batch?.receiverWrittenQty, `${inspection.qcId} 实收数量未对齐接收方回写`)
  }

  const forbiddenProcessLabels = ['开扣眼', '装扣子', '熨烫', '包装']
  assert(
    returnInboundChainQualityInspections.every((inspection) => !forbiddenProcessLabels.includes(inspection.processLabel)),
    '后道产能节点误入质检/复检链路',
  )

  const qcPageSource = readSource('src/pages/qc-records.ts')
  const qcListSource = readSource('src/pages/qc-records/list-domain.ts')
  const qcDetailSource = readSource('src/pages/qc-records/detail-domain.ts')
  const mobileQualitySource = readSource('src/pages/pda-quality.ts')
  const progressSource = readSource('src/pages/progress-handover.ts')
  const progressOrderSource = readSource('src/pages/progress-handover-order.ts')
  const handoverSource = readSource('src/pages/pda-handover.ts')
  const handoverDetailSource = readSource('src/pages/pda-handover-detail.ts')
  const execDetailSource = readSource('src/pages/pda-exec-detail.ts')

  for (const source of [qcPageSource, qcListSource, qcDetailSource, mobileQualitySource, progressSource, progressOrderSource]) {
    assert(!source.includes(legacyModeA), '页面仍出现旧后道路由枚举')
    assert(!source.includes(legacyModeB), '页面仍出现旧后道路由枚举')
    assert(!source.includes(legacyCopyA), legacyCopyAMessage)
    assert(!source.includes(legacyCopyB), legacyCopyBMessage)
  }

  assert(!mobileQualitySource.includes(forbiddenQualityTitle), forbiddenQualityTitleMessage)
  assert(qcListSource.includes('回货质检'), '质检记录列表缺少“回货质检”')
  assert(qcListSource.includes('后道复检'), '质检记录列表缺少“后道复检”')
  assert(qcDetailSource.includes('检查方式'), '质检详情缺少“检查方式”')
  assert(qcDetailSource.includes('接收方'), '质检详情缺少“接收方”')
  assert(progressSource.includes('后道路由'), '交接台账缺少后道路由展示')
  assert(progressSource.includes('待交成衣仓'), '交接台账缺少待交成衣仓状态')
  assert(progressOrderSource.includes('后道复检'), '生产单交接详情缺少后道复检状态')
  assert(!handoverSource.includes(['交出', '头'].join('')), '交出单页面口径回退')
  assert(!handoverDetailSource.includes(['交出', '头'].join('')), '交出单详情页面口径回退')
  assert(execDetailSource.includes('任务二维码'), '任务详情页口径被破坏')
  assert(execDetailSource.includes('查看交出单'), '任务详情页缺少查看交出单入口')
}

try {
  main()
  console.log(
    JSON.stringify(
      {
        routeCount: listPostProcessRoutes().length,
        qcCount: returnInboundChainQualityInspections.filter((item) => item.inspectionType === 'QC').length,
        recheckCount: returnInboundChainQualityInspections.filter((item) => item.inspectionType === 'RECHECK').length,
      },
      null,
      2,
    ),
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}
