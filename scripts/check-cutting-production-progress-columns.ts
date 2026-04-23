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
  '紧急程度',
  '生产单号',
  '款号 / SPU',
  '下单件数',
  '计划发货日期',
  '配料进展',
  '领料进展',
  '原始裁片单数',
  '当前进展',
  '部位差异',
  '风险提示',
  '操作',
] as const

const cutOrderHeaders = [
  '原始裁片单号',
  '生产单号',
  '款号 / SPU',
  '面料 SKU',
  '工厂',
  '关联数量',
  '计划发货日期',
  '紧急程度',
  '配料',
  '领料',
  '裁剪',
  '菲票',
  '特殊工艺回仓',
  '裁片发料',
  '当前阻塞',
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
  assert(source.includes("viewDimension: 'CUT_ORDER'"), '裁床进度默认视图必须是裁片单维度')
  assert(source.includes('renderViewDimensionSwitch'), '裁床进度缺少展示维度切换')
  assert(source.includes('裁片单维度'), '裁床进度缺少裁片单维度文案')
  assert(source.includes('生产单维度'), '裁床进度缺少生产单维度文案')
  assert(source.includes('renderCutOrderTable'), '裁床进度缺少裁片单维度表格')
  assert(source.includes('renderProductionOrderTable'), '裁床进度缺少生产单维度表格')
  assert(source.includes('renderMainTable'), '裁床进度缺少双维度统一入口')
  assert(source.includes('sourceOrderProgressLines'), '裁床进度裁片单维度未复用现有裁片单来源')
  assert(source.includes('originalCutOrderNo'), '裁床进度裁片单维度缺少原始裁片单号来源')
  assert(source.includes('materialSku'), '裁床进度裁片单维度缺少面料 SKU 来源')
  assert(source.includes('bundleLengthCmValues'), '裁床进度缺少 Step 1 捆条长度消费')
  assert(source.includes('bundleWidthCmValues'), '裁床进度缺少 Step 1 捆条宽度消费')
  assert(source.includes('transferBagCombinedWritebackStatus'), '裁床进度缺少 Step 4 综合回写状态消费')
  assert(source.includes('transferBagBagDifferenceCount'), '裁床进度缺少袋级差异消费')
  assert(source.includes('transferBagFeiTicketDifferenceCount'), '裁床进度缺少菲票级差异消费')

  console.log(
    [
      '裁床进度列与默认维度检查通过',
      `生产单维度列数：${actualProductionHeaders.length}`,
      `裁片单维度列数：${actualCutOrderHeaders.length}`,
      '默认维度：CUT_ORDER',
    ].join('\n'),
  )
}

main()
