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
    assert(decoded?.originalCutOrderId === line.cutPieceOrderNo, `${line.cutPieceOrderNo} 的二维码无法回查原始裁片单`)
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

  const materialPrepPage = read('src/pages/process-factory/cutting/material-prep.ts')
  ;[
    '裁片单二维码',
    '打印配料单',
    '裁床领料',
    '实领卷数',
    '确认领料',
    '驳回',
    '异常提交',
    '上传照片',
    '请上传照片',
    '中转可配置',
    '剩余卷数',
    '剩余长度',
  ].forEach((snippet) => {
    assert(materialPrepPage.includes(snippet), `material-prep 页面缺少关键文案：${snippet}`)
  })
  assert(materialPrepPage.includes('cuttingPrepClaimRollLineId'), '领料表单未记录实领卷数输入')
  assert(materialPrepPage.includes('state.claimRollDrafts'), '领料表单未维护实领卷数草稿')
  assert(materialPrepPage.includes('printIssueList'), '仓库配料打印链路必须保留')
  assert(materialPrepPage.includes('window.open'), '仓库配料打印窗口能力必须保留')
  assert(!materialPrepPage.includes('任务交货卡'), '仓库配料打印不得被任务交货卡替换')
  assert(!materialPrepPage.includes('任务流转卡'), '仓库配料打印不得被任务流转卡替换')
  assert(materialPrepPage.includes('实领卷数不一致，请驳回或异常提交。'), '领料差异未限制直接确认')
  assert(materialPrepPage.includes('state.claimPhotoDraft'), '异常提交未维护照片字段')
  assert(!materialPrepPage.includes('QR payload'), 'material-prep 页面不应展示 QR payload')
  assert(!materialPrepPage.includes('JSON'), 'material-prep 页面不应展示 JSON')
  assert(!materialPrepPage.includes('PDA配料'), 'material-prep 页面不应出现 PDA配料')
  assert(!materialPrepPage.includes('PDA领料'), 'material-prep 页面不应出现 PDA领料')
  assert(!materialPrepPage.includes('PDA裁床'), 'material-prep 页面不应出现 PDA裁床')

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
    replenishmentPage.includes('补料建议') || replenishmentPage.includes('补料明细建议'),
    '补料页面缺少“补料建议”文案',
  )
  assert(
    replenishmentPage.includes('待审核') || replenishmentModel.includes('WAIT_APPROVAL'),
    '补料页面未体现待审核状态',
  )
  assert(
    replenishmentPage.includes('已生效') || replenishmentModel.includes('APPROVED_PENDING_ACTION') || replenishmentData.includes('EFFECTIVE'),
    '补料链未体现审核后生效',
  )

  const cutPieceWarehousePage = read('src/pages/process-factory/cutting/cut-piece-warehouse.ts')
  ;['裁片仓', 'A区', 'B区', 'C区', '区域提示'].forEach((snippet) => {
    assert(cutPieceWarehousePage.includes(snippet), `裁片仓页面缺少关键文案：${snippet}`)
  })
  ;['货架', '托盘', joinText(['库存', '三态']), joinText(['完整 ', 'WMS']), joinText(['WMS', '入库'])].forEach((snippet) => {
    assert(!cutPieceWarehousePage.includes(snippet), `裁片仓页面越界出现：${snippet}`)
  })

  const fabricWarehouseModel = read('src/pages/process-factory/cutting/fabric-warehouse-model.ts')
  const fabricWarehousePage = read('src/pages/process-factory/cutting/fabric-warehouse.ts')
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
  ;['面料卷号', '卷条码', '批次号', '面料中文名', '标签长度', '实测长度'].forEach((snippet) => {
    assert(fabricWarehousePage.includes(snippet), `面料卷标签页面缺少字段文案：${snippet}`)
  })
  ;['inventory state', 'stockStatus', 'WMS'].forEach((snippet) => {
    assert(!fabricWarehousePage.includes(snippet), `面料卷标签页面出现研发文案：${snippet}`)
  })

  const productionProgressPage = read('src/pages/process-factory/cutting/production-progress.ts')
  assert(productionProgressPage.includes('配料进展'), '生产进度页面未展示配料状态')
  assert(productionProgressPage.includes('领料进展'), '生产进度页面未展示领料状态')
  const cuttingSummaryPage = read('src/pages/process-factory/cutting/cutting-summary.ts')
  ;['补料建议', '裁片仓'].forEach((snippet) => {
    assert(cuttingSummaryPage.includes(snippet), `裁剪总结缺少汇总项：${snippet}`)
  })

  const feiFiles = [
    read('src/data/fcs/cutting/generated-fei-tickets.ts'),
    read('src/pages/process-factory/cutting/fei-tickets.ts'),
  ].join('\n')
  ;['fabricRollNo', 'fabricColor', 'sizeCode', 'partName', 'bundleQty', 'assemblyGroupKey'].forEach((snippet) => {
    assert(feiFiles.includes(snippet), `Prompt 10 菲票五维字段缺失：${snippet}`)
  })

  console.log(
    JSON.stringify(
      {
        裁片单一码: '通过',
        配料单打印含裁片单二维码: '通过',
        领料差异照片校验: '通过',
        印花染色中转可配置来源: '通过',
        补料建议与审核: '通过',
        裁片仓简化区域: '通过',
        面料卷标签轻量桥接字段: '通过',
        生产进度与裁剪总结联动: '通过',
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
