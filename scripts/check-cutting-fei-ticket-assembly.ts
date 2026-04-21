#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const SAMPLE_FIVE_DIM_TITLE = '卷A - 红色 - M - 袖子 - 15'

function abs(rel: string): string {
  return path.join(repoRoot, rel)
}

function read(rel: string): string {
  return fs.readFileSync(abs(rel), 'utf8')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertMatches(source: string, pattern: RegExp, message: string): void {
  assert(pattern.test(source), message)
}

function main(): void {
  const feiSource = read('src/data/fcs/cutting/generated-fei-tickets.ts')
  const feiPage = read('src/pages/process-factory/cutting/fei-tickets.ts')
  const spreadingPage = read('src/pages/process-factory/cutting/marker-spreading.ts')
  const transferBagsPage = read('src/pages/process-factory/cutting/transfer-bags.ts')
  const qrPayloadSource = read('src/data/fcs/cutting/qr-payload.ts')

  ;[
    'export interface SpreadingPieceOutputLine',
    'fabricRollNo',
    'fabricColor',
    'sizeCode',
    'partName',
    'bundleQty',
    'bundleNo',
    'assemblyGroupKey',
    "sourceBasisType: 'SPREADING_RESULT' | 'HISTORICAL_FALLBACK'",
    'listSpreadingPieceOutputLines',
  ].forEach((token) => {
    assertIncludes(feiSource, token, `铺布产出矩阵缺少字段或入口：${token}`)
  })

  ;[
    'sourceOutputLineId',
    'originalCutOrderId',
    'originalCutOrderNo',
    'fabricRollNo',
    'fabricColor',
    'bundleNo',
    'bundleQty',
    'actualCutPieceQty',
    'assemblyGroupKey',
    'siblingPartTicketNos',
  ].forEach((token) => {
    assertIncludes(feiSource, token, `菲票正式 source 缺少字段：${token}`)
  })

  ;[
    "fabricRollNo = '卷A'",
    "fabricColor = '红色'",
    "const sizeCode = 'M'",
    "const bundleNo = 'BUNDLE-001'",
    "const bundleQty = 15",
    "partName: '前片'",
    "partName: '后片'",
    "partName: '袖子'",
  ].forEach((token) => {
    assertIncludes(feiSource, token, `缺少同组示例：${token}`)
  })

  ;[
    '铺布产出',
    '面料卷号',
    '布料颜色',
    '尺码',
    '裁片部位',
    '数量',
    '扎号',
    '同组裁片',
  ].forEach((token) => {
    assert(spreadingPage.includes(token), `铺布页面缺少业务文案：${token}`)
  })

  ;[
    '菲票二维码',
    '面料卷号',
    '布料颜色',
    '裁片部位',
    '同组裁片',
    '查看同组',
    '当前存在缺少五维字段的菲票，不能打印。',
  ].forEach((token) => {
    assert(feiPage.includes(token), `菲票页面缺少业务文案或校验：${token}`)
  })

  assertIncludes(feiPage, 'buildFeiTicketFiveDimTitle', '菲票页面缺少五维打印标题构造')
  assertIncludes(read('scripts/check-cutting-fei-ticket-assembly.ts'), SAMPLE_FIVE_DIM_TITLE, '缺少现场五维标题示例')
  assertIncludes(
    read('src/pages/process-factory/cutting/fei-tickets-model.ts'),
    'return `${record.fabricRollNo} - ${record.fabricColor} - ${record.size} - ${record.partName} - ${formatQty(record.quantity)}`',
    `五维打印标题未按“${SAMPLE_FIVE_DIM_TITLE}”格式拼装`,
  )

  ;[
    '同组裁片',
    '面料卷号',
    '布料颜色',
    '尺码',
    '裁片部位',
    '扎号',
  ].forEach((token) => {
    assert(transferBagsPage.includes(token), `中转袋页面缺少同组裁片追溯字段：${token}`)
  })

  assert(!feiPage.includes('QR payload'), '菲票页面不应展示 QR payload')
  assert(!feiPage.includes('JSON'), '菲票页面不应展示 JSON')
  assert(!transferBagsPage.includes('完整 WMS'), '中转袋页面不应实现完整 WMS')
  ;[
    'sourceOutputLineId',
    'fabricRollNo',
    'fabricColor',
    'skuSize',
    'partName',
    'bundleNo',
    'bundleQty',
    'actualCutPieceQty',
    'assemblyGroupKey',
  ].forEach((token) => {
    assertIncludes(qrPayloadSource, token, `菲票二维码 payload 缺少字段：${token}`)
  })

  console.log(
    JSON.stringify(
      {
        铺布产出矩阵五维: '通过',
        菲票来源与归属: '通过',
        五维打印标题: '通过',
        同组裁片追溯: '通过',
        菲票二维码字段: '通过',
        中转袋同组裁片查看: '通过',
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
