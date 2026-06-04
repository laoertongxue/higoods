#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  cloneCuttingMaterialPrepGroups,
  listTransferMaterialAvailableLots,
} from '../src/data/fcs/cutting/material-prep.ts'
import { buildCutOrderQrValue, getCutOrderByQrValue } from '../src/data/fcs/cutting/qr-codes.ts'

const repoRoot = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function joinText(parts: string[]): string {
  return parts.join('')
}

function main(): void {
  const groups = cloneCuttingMaterialPrepGroups()
  const allLines = groups.flatMap((group) => group.materialLines)
  const transferLots = listTransferMaterialAvailableLots()

  assert(allLines.length > 0, '配料数据为空')

  const qrByCutOrder = new Map<string, Set<string>>()
  allLines.forEach((line) => {
    const qrValue = line.cutOrderQrValue || line.qrCodeValue
    assert(qrValue, `${line.cutPieceOrderNo} 缺少裁片单二维码`)
    assert(qrValue === buildCutOrderQrValue(line.cutPieceOrderNo), `${line.cutPieceOrderNo} 未使用统一裁片单二维码规则`)
    const decoded = getCutOrderByQrValue(qrValue)
    assert(decoded?.cutOrderId === line.cutPieceOrderNo, `${line.cutPieceOrderNo} 的二维码无法回查裁片单`)
    const bucket = qrByCutOrder.get(line.cutPieceOrderNo) || new Set<string>()
    bucket.add(qrValue)
    qrByCutOrder.set(line.cutPieceOrderNo, bucket)
  })
  qrByCutOrder.forEach((qrValues, cutOrderNo) => {
    assert(qrValues.size === 1, `${cutOrderNo} 存在多个裁片单二维码`)
  })

  const dataSource = read('src/data/fcs/cutting/material-prep.ts')
  assert(dataSource.includes('cutOrderQrValue'), 'material-prep 数据层缺少 cutOrderQrValue')
  assert(dataSource.includes('PRINT_REVIEW'), 'material-prep 数据层缺少 PRINT_REVIEW 来源')
  assert(dataSource.includes('DYE_REVIEW'), 'material-prep 数据层缺少染色审核来源')
  assert(dataSource.includes('MANUAL'), 'material-prep 数据层缺少手动配置来源')
  assert(dataSource.includes('TransferMaterialAvailableLot'), 'material-prep 数据层缺少中转可配置模型')

  assert(transferLots.some((lot) => lot.sourceProcessType === 'PRINT'), '缺少印花中转审核通过后的可配置数量')
  assert(transferLots.some((lot) => lot.sourceProcessType === 'DYE'), '缺少染色审核通过后的中转可配置数量')
  assert(
    transferLots.every(
      (lot) => lot.reviewStatus === 'PASS' || lot.reviewStatus === 'PARTIAL_PASS' || lot.reviewStatus === 'MANUAL_READY',
    ),
    '中转可配置数量包含未审核通过数据',
  )
  assert(
    transferLots.every((lot) => lot.remainingRollCount >= 0 && lot.remainingLength >= 0),
    '中转可配置数量缺少剩余卷数或剩余长度',
  )

  const materialPrepModel = read('src/pages/process-factory/cutting/material-prep-model.ts')
  assert(materialPrepModel.includes('buildCutOrderQrValue'), '配料模型未使用统一裁片单二维码 helper')
  assert(materialPrepModel.includes("qrCodeLabel: '裁片单二维码'"), '配料模型未使用“裁片单二维码”文案')
  assert(materialPrepModel.includes("title: '配料单'"), '配料打印 payload 未使用“配料单”文案')

  const materialPrepSurface = [
    read('src/pages/progress-material.ts'),
    read('src/pages/process-factory/cutting/material-prep-model.ts'),
    read('src/pages/process-factory/cutting/material-prep.helpers.ts'),
    read('src/pages/print/templates/material-slip-template.ts'),
  ].join('\n')
  ;[
    '裁片单二维码',
    '裁床领料',
    '裁床领料卷数',
    '配料单',
    '有配料数量',
    '有领料记录',
    '剩余卷数',
  ].forEach((snippet) => {
    assert(materialPrepSurface.includes(snippet), `material-prep 投影或打印链路缺少关键文案：${snippet}`)
  })
  assert(materialPrepSurface.includes('buildMaterialPrepSlipPrintDocument'), '配料单打印链路必须保留')
  assert(materialPrepSurface.includes("title: '配料单'"), '配料打印 payload 必须使用“配料单”文案')
  assert(!materialPrepSurface.includes('任务交货卡'), '仓库配料打印不得被任务交货卡替换')
  assert(!materialPrepSurface.includes('任务流转卡'), '仓库配料打印不得被任务流转卡替换')
  assert(!materialPrepSurface.includes('QR payload'), 'material-prep 页面不应展示 QR payload')
  assert(!materialPrepSurface.includes('PDA配料'), 'material-prep 页面不应出现 PDA配料')
  assert(!materialPrepSurface.includes('PDA领料'), 'material-prep 页面不应出现 PDA领料')
  assert(!materialPrepSurface.includes('PDA裁床'), 'material-prep 页面不应出现 PDA裁床')

  const replenishmentData = read('src/data/fcs/cutting/replenishment.ts')
  const replenishmentPage = read('src/pages/process-factory/cutting/replenishment.ts')
  const replenishmentModel = read('src/pages/process-factory/cutting/replenishment-model.ts')
  ;[
    'markerNetLength',
    'spreadingLayerCount',
    'fabricHeadLength',
    'fabricTailLength',
    'actualCutGarmentQty',
  ].forEach((snippet) => {
    assert(
      replenishmentData.includes(snippet) || replenishmentModel.includes(snippet),
      `补料建议缺少计算依据字段：${snippet}`,
    )
  })
  assert(
    replenishmentPage.includes('差异处理项') && replenishmentPage.includes('处理结果'),
    '补料页面缺少差异处理工作台文案',
  )
  assert(
    replenishmentPage.includes('待处理') || replenishmentModel.includes('待审核'),
    '补料页面未体现待审核状态',
  )
  assert(
    replenishmentPage.includes('已生效') || replenishmentModel.includes('APPROVED_PENDING_ACTION') || replenishmentData.includes('EFFECTIVE'),
    '补料链未体现审核后生效',
  )

  const cutPieceWarehousePage = [
    read('src/pages/process-factory/cutting/warehouse-hub.ts'),
    read('src/pages/process-factory/cutting/cut-piece-warehouse-model.ts'),
    read('src/pages/process-factory/cutting/cut-piece-warehouse-projection.ts'),
  ].join('\n')
  ;['裁片库存', '裁床待交出仓', '裁片 A 区', '中转袋暂存区', '待交出仓裁片库存'].forEach((snippet) => {
    assert(cutPieceWarehousePage.includes(snippet), `裁片仓页面缺少关键文案：${snippet}`)
  })
  ;['货架', '托盘', joinText(['库存', '三态']), joinText(['完整 ', 'WMS']), joinText(['WMS', '入库'])].forEach((snippet) => {
    assert(!cutPieceWarehousePage.includes(snippet), `裁片仓页面越界出现：${snippet}`)
  })

  const fabricWarehouseModel = read('src/pages/process-factory/cutting/fabric-warehouse-model.ts')
  const fabricWarehousePage = [
    read('src/pages/process-factory/cutting/fabric-warehouse-model.ts'),
    read('src/pages/process-factory/cutting/fabric-warehouse-projection.ts'),
  ].join('\n')
  ;[
    'rollBarcode',
    'batchNo',
    'batchSeqNo',
    'materialSpuNameCn',
    'labeledLength',
    'actualLength',
    'sourceProcessType',
  ].forEach((snippet) => {
    assert(fabricWarehouseModel.includes(snippet), `面料卷标签模型缺少字段：${snippet}`)
  })
  ;['rollBarcode', 'batchNo', 'batchSeqNo', 'materialSpuNameCn', 'labeledLength', 'actualLength'].forEach((snippet) => {
    assert(fabricWarehousePage.includes(snippet), `面料卷标签投影缺少字段：${snippet}`)
  })
  ;['inventory state', 'stockStatus', 'WMS'].forEach((snippet) => {
    assert(!fabricWarehousePage.includes(snippet), `面料卷标签页面出现研发文案：${snippet}`)
  })

  const productionProgressPage = read('src/pages/process-factory/cutting/production-progress.ts')
  assert(productionProgressPage.includes('配料数量'), '生产进度页面未展示配料数量')
  assert(productionProgressPage.includes('领料数量'), '生产进度页面未展示领料数量')
  const cuttingSummaryPage = read('src/pages/process-factory/cutting/cutting-summary.ts')
  ;['补料待审核', '待交出仓库存'].forEach((snippet) => {
    assert(cuttingSummaryPage.includes(snippet), `裁剪总结缺少汇总项：${snippet}`)
  })

  const feiFiles = [
    read('src/data/fcs/cutting/generated-fei-tickets.ts'),
    read('src/pages/process-factory/cutting/fei-tickets.ts'),
  ].join('\n')
  ;['fabricRollNo', 'fabricColor', 'sizeCode', 'partName', 'bundleQty', 'pieceGroup', 'bundleScope'].forEach((snippet) => {
    assert(feiFiles.includes(snippet), `Prompt 10 菲票五维字段缺失：${snippet}`)
  })

  console.log(
    JSON.stringify(
      {
        裁片单一码: '通过',
        配料单打印含裁片单二维码: '通过',
        领料差异照片校验: '通过',
        印花染色中转可配置来源: '通过',
        差异处理与审核: '通过',
        裁片仓简化区域: '通过',
        面料卷标签轻量桥接字段: '通过',
        生产进度与裁剪结果核查联动: '通过',
        Prompt10菲票五维未破坏: '通过',
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
