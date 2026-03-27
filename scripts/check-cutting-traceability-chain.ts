#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertFileExists(relativePath: string): void {
  assert(fs.existsSync(path.join(repoRoot, relativePath)), `${relativePath} 应存在`)
}

function assertIncludes(source: string, snippet: string, message: string): void {
  assert(source.includes(snippet), message)
}

function assertNotIncludes(source: string, snippet: string, message: string): void {
  assert(!source.includes(snippet), message)
}

function assertTraceabilitySources(): void {
  const qrPayload = readRepoFile('src/data/fcs/cutting/qr-payload.ts')
  const qrCodes = readRepoFile('src/data/fcs/cutting/qr-codes.ts')
  const feiSource = readRepoFile('src/data/fcs/cutting/generated-fei-tickets.ts')
  const carrierRuntime = readRepoFile('src/data/fcs/cutting/transfer-bag-runtime.ts')

  assertIncludes(qrPayload, "codeType: 'ORIGINAL_CUT_ORDER'", '应存在原始裁片单主码 payload')
  assertIncludes(qrPayload, "codeType: 'FEI_TICKET'", '应存在菲票子码 payload')
  assertIncludes(qrPayload, "codeType: 'CARRIER'", '应存在周转口袋/箱父码 payload')
  assertIncludes(qrPayload, 'buildOriginalCutOrderQrPayload', '缺少 buildOriginalCutOrderQrPayload')
  assertIncludes(qrPayload, 'buildFeiTicketQrPayload', '缺少 buildFeiTicketQrPayload')
  assertIncludes(qrPayload, 'buildCarrierQrPayload', '缺少 buildCarrierQrPayload')

  assertIncludes(qrCodes, 'encodeOriginalCutOrderQr', '缺少原始裁片单二维码编码器')
  assertIncludes(qrCodes, 'encodeFeiTicketQr', '缺少菲票二维码编码器')
  assertIncludes(qrCodes, 'encodeCarrierQr', '缺少载具二维码编码器')
  assertIncludes(qrCodes, 'validateFeiCraftSequence', '缺少工艺顺序校验')

  assertIncludes(feiSource, 'originalCutOrderId', 'generated-fei-tickets.ts 必须绑定 originalCutOrderId')
  assertIncludes(feiSource, 'materialSku', 'generated-fei-tickets.ts 必须绑定 materialSku')
  assertIncludes(feiSource, 'secondaryCrafts', 'generated-fei-tickets.ts 必须写入二级工艺')
  assertIncludes(feiSource, 'craftSequenceVersion', 'generated-fei-tickets.ts 必须写入工艺顺序版本')
  assertIncludes(feiSource, 'encodeFeiTicketQr', '菲票正式 source 必须走统一 QR payload builder')

  assertIncludes(carrierRuntime, 'TransferCarrierCycleRecord', 'transfer-bag-runtime.ts 必须存在正式载具周期')
  assertIncludes(carrierRuntime, 'CarrierCycleItemBinding', 'transfer-bag-runtime.ts 必须存在正式父子映射对象')
  assertIncludes(carrierRuntime, 'createCarrierCycleBinding', 'transfer-bag-runtime.ts 必须存在正式绑定创建器')
}

function assertProjectionFiles(): void {
  const projections = [
    'src/pages/process-factory/cutting/fei-tickets-projection.ts',
    'src/pages/process-factory/cutting/fei-ticket-print-projection.ts',
    'src/pages/process-factory/cutting/transfer-bags-projection.ts',
    'src/pages/process-factory/cutting/craft-trace-projection.ts',
    'src/pages/process-factory/cutting/traceability-projection-helpers.ts',
  ]
  projections.forEach(assertFileExists)

  assertIncludes(readRepoFile(projections[0]), 'buildFeiTicketsProjection', '缺少 buildFeiTicketsProjection')
  assertIncludes(readRepoFile(projections[1]), 'buildFeiTicketPrintProjection', '缺少 buildFeiTicketPrintProjection')
  assertIncludes(readRepoFile(projections[2]), 'buildTransferBagsProjection', '缺少 buildTransferBagsProjection')
  assertIncludes(readRepoFile(projections[2]), 'buildCarrierCycleProjection', '缺少 buildCarrierCycleProjection')
  assertIncludes(readRepoFile(projections[3]), 'buildCraftTraceProjection', '缺少 buildCraftTraceProjection')
}

function assertFeiPagesCutover(): void {
  const feiPage = readRepoFile('src/pages/process-factory/cutting/fei-tickets.ts')
  const feiQrModel = readRepoFile('src/pages/process-factory/cutting/fei-qr-model.ts')
  const feiBatchPrintModel = readRepoFile('src/pages/process-factory/cutting/fei-batch-print-model.ts')

  assertIncludes(feiPage, "from './fei-ticket-print-projection'", 'fei-tickets.ts 应消费正式菲票 projection')
  assertIncludes(feiPage, 'craftTraceProjection', 'fei-tickets.ts 应接入工艺扫码追溯 projection')
  assertIncludes(feiPage, 'ticketId', 'fei-tickets.ts 应以 ticketId 作为正式页面锚点')
  assertIncludes(feiPage, 'originalCutOrderId', 'fei-tickets.ts 应透传 originalCutOrderId')
  assertIncludes(feiPage, 'productionOrderId', 'fei-tickets.ts 应透传 productionOrderId')
  assertIncludes(feiPage, 'materialSku', 'fei-tickets.ts 应透传 materialSku')
  assertNotIncludes(feiPage, 'cuttingOrderProgressRecords', 'fei-tickets.ts 不应继续直接依赖旧 progress 源')
  assertNotIncludes(feiPage, 'buildCuttablePoolViewModel', 'fei-tickets.ts 不应继续依赖旧 cuttable pool model')
  assertNotIncludes(feiPage, 'buildSystemSeedFeiTicketLedger(', 'fei-tickets.ts 不应直接把 page seed 当正式菲票主源')

  assertIncludes(feiQrModel, 'CanonicalFeiTicketQrPayload', 'fei-qr-model.ts 应建立在正式菲票 payload 类型之上')
  assertIncludes(feiQrModel, 'getFeiTicketById', 'fei-qr-model.ts 应从正式菲票 source 回查')
  assertIncludes(feiBatchPrintModel, 'buildCuttingTraceabilityId', 'fei-batch-print-model.ts 应使用统一 traceability id 生成器')
}

function assertCarrierCutover(): void {
  const transferBagsPage = readRepoFile('src/pages/process-factory/cutting/transfer-bags.ts')
  const transferBagsModel = readRepoFile('src/pages/process-factory/cutting/transfer-bags-model.ts')
  const transferBagReturnModel = readRepoFile('src/pages/process-factory/cutting/transfer-bag-return-model.ts')

  assertIncludes(transferBagsPage, "from './transfer-bags-projection'", 'transfer-bags.ts 应消费正式载具 projection')
  assertIncludes(transferBagsPage, 'resolveCarrierScanInput', 'transfer-bags.ts 应使用正式父码解析')
  assertIncludes(transferBagsPage, 'resolveFeiTicketScanInput', 'transfer-bags.ts 应使用正式菲票子码解析')
  assertIncludes(transferBagsPage, '步骤 1：扫周转口袋码', '装袋流程必须先扫口袋码')
  assertIncludes(transferBagsPage, '步骤 2：扫菲票码', '装袋流程必须再扫菲票码')
  assertIncludes(transferBagsPage, '必须先扫口袋码，再扫菲票子码', '装袋流程必须明确 bag-first 约束')
  assertIncludes(transferBagsPage, 'ticketId', 'transfer-bags.ts 应支持 ticketId 正式锚点')
  assertIncludes(transferBagsPage, 'bagId', 'transfer-bags.ts 应支持 bagId 正式锚点')
  assertIncludes(transferBagsPage, 'usageId', 'transfer-bags.ts 应支持 usageId / cycle 锚点')
  assertNotIncludes(transferBagsPage, 'buildSystemSeedFeiTicketLedger', 'transfer-bags.ts 不应直接依赖旧菲票 page seed')
  assertNotIncludes(transferBagsPage, 'deserializeFeiTicketRecordsStorage', 'transfer-bags.ts 不应直接读旧菲票 storage 入口')
  assertNotIncludes(transferBagsPage, 'buildExecutionPrepProjectionContext', 'transfer-bags.ts 不应继续直接从执行准备 helper 反拼追溯链')
  assertNotIncludes(transferBagsPage, 'buildSystemSeedTransferBagStore', 'transfer-bags.ts 不应直接依赖旧口袋 page seed')
  assertNotIncludes(transferBagsPage, 'mergeTransferBagStores', 'transfer-bags.ts 不应直接在页面层合并载具 store')

  assertIncludes(transferBagsModel, 'carrierId', 'transfer-bags-model.ts 应显式承接正式 carrierId')
  assertIncludes(transferBagsModel, 'cycleId', 'transfer-bags-model.ts 应显式承接正式 cycleId')
  assertIncludes(transferBagsModel, 'feiTicketId', 'transfer-bags-model.ts 应显式承接正式 feiTicketId')
  assertIncludes(transferBagsModel, 'buildTransferBagNavigationPayload', 'transfer-bags-model.ts 应统一 drill-down payload')
  assertIncludes(transferBagReturnModel, 'buildCuttingTraceabilityId', 'transfer-bag-return-model.ts 应使用统一 traceability id')
}

function assertCraftTraceCutover(): void {
  const craftTraceProjection = readRepoFile('src/pages/process-factory/cutting/craft-trace-projection.ts')

  assertIncludes(craftTraceProjection, 'secondaryCrafts', 'craft-trace-projection.ts 应正式承载二级工艺')
  assertIncludes(craftTraceProjection, 'craftSequenceVersion', 'craft-trace-projection.ts 应正式承载工艺顺序版本')
  assertIncludes(craftTraceProjection, 'validateFeiCraftSequence', 'craft-trace-projection.ts 应调用正式工艺顺序校验')
  assertIncludes(craftTraceProjection, 'feiTicketId', 'craft-trace-projection.ts 应以 feiTicketId 为正式工艺扫码锚点')
  assertIncludes(craftTraceProjection, 'originalCutOrderId', 'craft-trace-projection.ts 应回落 originalCutOrderId')
}

function assertNoLegacyAnchors(): void {
  const feiPage = readRepoFile('src/pages/process-factory/cutting/fei-tickets.ts')
  const transferBagsPage = readRepoFile('src/pages/process-factory/cutting/transfer-bags.ts')

  assertNotIncludes(feiPage, 'data-row-index', 'fei-tickets.ts 不应再依赖旧 row index 作为正式锚点')
  assertNotIncludes(transferBagsPage, 'data-row-index', 'transfer-bags.ts 不应再依赖旧 row index 作为正式锚点')
  assertNotIncludes(transferBagsPage, '先扫菲票', 'transfer-bags.ts 不应继续保留先扫菲票再选口袋的旧流程文案')
}

function main(): void {
  assertTraceabilitySources()
  assertProjectionFiles()
  assertFeiPagesCutover()
  assertCarrierCutover()
  assertCraftTraceCutover()
  assertNoLegacyAnchors()

  console.log(
    JSON.stringify(
      {
        三层码对象已建立: '通过',
        菲票正式source已建立: '通过',
        二维码payload已统一: '通过',
        载具周期与父子映射已正式化: '通过',
        装袋扫码顺序已收口为先父后子: '通过',
        工艺扫码顺序校验已接入正式payload: '通过',
        页面主锚点已切正式对象字段: '通过',
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
