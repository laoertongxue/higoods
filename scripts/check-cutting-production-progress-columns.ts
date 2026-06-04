#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const sourcePath = path.join(
  repoRoot,
  'src/pages/process-factory/cutting/production-progress.ts',
)
const modelPath = path.join(
  repoRoot,
  'src/pages/process-factory/cutting/production-progress-model.ts',
)

const productionHeaders = [
  '生产单',
  '交期 / 数量',
  '裁片单概况',
  '数量账摘要',
  '唛架 / 铺布',
  '菲票 / 入仓',
  '交出 / 风险',
  '操作',
] as const

const cutOrderHeaders = [
  '裁片单',
  '生产单与款式',
  '面料 / 纸样',
  '数量账',
  '主状态与判断',
  '作业关系',
  '交出 / 缺口',
  '操作',
] as const

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

function extractHeaderConfig(source: string, constName: string): string[] {
  const pattern = new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\] as const`)
  const match = source.match(pattern)
  assert(match, `未找到 ${constName} 配置`)
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1])
}

function main(): void {
  const source = read(sourcePath)
  const modelSource = read(modelPath)
  const actualProductionHeaders = extractHeaderConfig(source, 'PRODUCTION_PROGRESS_TABLE_HEADERS')
  const actualCutOrderHeaders = extractHeaderConfig(source, 'CUT_ORDER_PROGRESS_TABLE_HEADERS')

  assert(
    JSON.stringify(actualProductionHeaders) === JSON.stringify(productionHeaders),
    `生产单维度表头顺序错误：\n期望 ${productionHeaders.join(' | ')}\n实际 ${actualProductionHeaders.join(' | ')}`,
  )
  assert(
    JSON.stringify(actualCutOrderHeaders) === JSON.stringify(cutOrderHeaders),
    `裁片单维度表头顺序错误：\n期望 ${cutOrderHeaders.join(' | ')}\n实际 ${actualCutOrderHeaders.join(' | ')}`,
  )

  assert(modelSource.includes("type ProductionProgressViewDimension = 'CUT_ORDER' | 'PRODUCTION_ORDER'"), '裁床进度模型缺少 CUT_ORDER / PRODUCTION_ORDER 双维度定义')
  assert(source.includes("viewDimension: 'PRODUCTION_ORDER'"), '裁床进度默认视图必须是生产单维度')
  assert(source.includes('生产单列表'), '裁床进度缺少生产单列表文案')
  assert(source.includes('裁片单主表'), '裁床进度缺少裁片单主表文案')
  assert(source.includes('renderCutOrderTable'), '裁床进度缺少裁片单维度表格')
  assert(source.includes('renderProductionOrderTable'), '裁床进度缺少生产单维度表格')
  assert(source.includes('renderMainTable'), '裁床进度缺少双维度统一入口')
  assert(source.includes('sourceOrderProgressLines'), '裁床进度裁片单维度未复用现有裁片单来源')
  assert(source.includes('cutOrderNo'), '裁床进度裁片单维度缺少裁片单号来源')
  assert(source.includes('materialSku'), '裁床进度裁片单维度缺少面料 SKU 来源')
  assert(source.includes('bundleLengthCmValues'), '裁床进度缺少 Step 1 捆条长度消费')
  assert(source.includes('bundleWidthCmValues'), '裁床进度缺少 Step 1 捆条宽度消费')
  assert(source.includes('transferBagCombinedWritebackStatus'), '裁床进度缺少 Step 4 综合回写状态消费')
  assert(source.includes('transferBagBagDifferenceCount'), '裁床进度缺少袋级差异消费')
  assert(source.includes('transferBagFeiTicketDifferenceCount'), '裁床进度缺少菲票级差异消费')
  assert(source.includes('bindingProcessOrders'), '生产单总览缺少捆条加工单链路数据')
  assert(source.includes('捆条加工：'), '生产单裁片单卡片缺少捆条加工展示')
  assert(source.includes('当前生产单暂无捆条加工单'), '生产单特殊工艺页签缺少捆条加工空状态')

  console.log(
    [
      '裁床进度列与默认维度检查通过',
      `生产单维度列数：${actualProductionHeaders.length}`,
      `裁片单维度列数：${actualCutOrderHeaders.length}`,
      '默认维度：PRODUCTION_ORDER',
    ].join('\n'),
  )
}

main()
