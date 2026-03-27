import { readFileSync } from 'node:fs'
import path from 'node:path'

import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { productionDemands } from '../src/data/fcs/production-demands.ts'
import {
  getProductionDemandById,
  resolveReleasedTechPackForProductionOrder,
  validateDemandTechPackOrderLink,
} from '../src/data/fcs/production-upstream-chain.ts'
import { listGeneratedOriginalCutOrderSourceRecords } from '../src/data/fcs/cutting/generated-original-cut-orders.ts'

const repoRoot = process.cwd()

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf-8')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function ensureNoForceReleased(): void {
  const files = [
    'src/pages/production/context.ts',
    'src/data/fcs/production-demands.ts',
  ]

  files.forEach((file) => {
    const content = readRepoFile(file)
    assert(!content.includes('forceReleased'), `${file} 仍然包含 forceReleased`)
  })
}

function ensureProductionOrdersHaveReleasedUpstream(): void {
  assert(productionOrders.length > 0, '正式 production order source 为空')

  productionOrders.forEach((order) => {
    const validation = validateDemandTechPackOrderLink({
      productionOrderId: order.productionOrderId,
      demandId: order.demandId,
    })
    assert(validation.ok, `生产单 ${order.productionOrderId} 上游链非法: ${validation.issues.map((item) => item.message).join('；')}`)

    const demand = getProductionDemandById(order.demandId)
    assert(demand, `生产单 ${order.productionOrderId} 无法 resolve demand ${order.demandId}`)
    assert(demand.demandStatus === 'CONVERTED', `生产单 ${order.productionOrderId} 关联需求 ${demand.demandId} 不是已转单`)

    const techPack = resolveReleasedTechPackForProductionOrder(order.productionOrderId)
    assert(techPack, `生产单 ${order.productionOrderId} 无法 resolve released tech pack`)
    assert(techPack.status === 'RELEASED', `生产单 ${order.productionOrderId} 关联技术包不是 RELEASED`)

    assert(order.demandSnapshot.demandId === demand.demandId, `生产单 ${order.productionOrderId} 的 demandSnapshot 不是从需求生成`)
    assert(order.demandSnapshot.spuCode === demand.spuCode, `生产单 ${order.productionOrderId} 的 demandSnapshot spu 不一致`)
    assert(order.techPackSnapshot.status === 'RELEASED', `生产单 ${order.productionOrderId} 的 techPackSnapshot 不是 RELEASED`)
    assert(order.techPackSnapshot.versionLabel === techPack.versionLabel, `生产单 ${order.productionOrderId} 的 techPackSnapshot 版本不一致`)
  })
}

function ensureProductionOrderSeedsDoNotInlineSnapshots(): void {
  const content = readRepoFile('src/data/fcs/production-orders.ts')
  const seedSectionIndex = content.indexOf('const productionOrderSeeds')
  assert(seedSectionIndex >= 0, 'production-orders.ts 缺少 productionOrderSeeds')
  const seedSection = content.slice(seedSectionIndex)

  assert(!seedSection.includes('demandSnapshot:'), 'production-orders.ts 仍在 seed 段手写 demandSnapshot')
  assert(!seedSection.includes('techPackSnapshot:'), 'production-orders.ts 仍在 seed 段手写 techPackSnapshot')
}

function ensureGeneratedOriginalCutOrdersTraceable(): void {
  const generated = listGeneratedOriginalCutOrderSourceRecords()
  assert(generated.length > 0, 'generated original cut orders 为空')

  generated.forEach((record) => {
    assert(record.productionOrderId, `原始裁片单 ${record.originalCutOrderNo} 缺少 productionOrderId`)
    assert(record.originalCutOrderId, `原始裁片单 ${record.originalCutOrderNo} 缺少 originalCutOrderId`)
    assert(record.materialSku, `原始裁片单 ${record.originalCutOrderNo} 缺少 materialSku`)
    assert(record.sourceTechPackSpuCode, `原始裁片单 ${record.originalCutOrderNo} 缺少 sourceTechPackSpuCode`)
    assert(record.techPackVersionLabel, `原始裁片单 ${record.originalCutOrderNo} 缺少 tech pack 版本`)

    const order = productionOrders.find((item) => item.productionOrderId === record.productionOrderId)
    assert(order, `原始裁片单 ${record.originalCutOrderNo} 无法回溯到 production order ${record.productionOrderId}`)
    assert(order.demandSnapshot.spuCode === record.sourceTechPackSpuCode, `原始裁片单 ${record.originalCutOrderNo} tech pack spu 不一致`)

    const scopedSkuKeys = new Set(
      order.demandSnapshot.skuLines.map((line) => `${line.skuCode}::${line.color}::${line.size}`),
    )
    assert(record.skuScopeLines.length > 0, `原始裁片单 ${record.originalCutOrderNo} 没有 sku scope`)
    record.skuScopeLines.forEach((line) => {
      const key = `${line.skuCode}::${line.color}::${line.size}`
      assert(scopedSkuKeys.has(key), `原始裁片单 ${record.originalCutOrderNo} 的 sku scope ${key} 不属于 production order ${record.productionOrderId}`)
    })
  })
}

function ensureOrderProgressIsProjectionOnly(): void {
  const orderProgressContent = readRepoFile('src/data/fcs/cutting/order-progress.ts')
  assert(orderProgressContent.includes("import { productionOrders } from '../production-orders.ts'"), 'order-progress.ts 没有基于 productionOrders 构建投影')
  assert(orderProgressContent.includes('listGeneratedOriginalCutOrderSourceRecords'), 'order-progress.ts 没有消费 generated original cut order source')
  assert(!orderProgressContent.includes('originalCutOrderId: line.cutPieceOrderNo'), 'order-progress.ts 仍然把 cutPieceOrderNo 当原始裁片单 id')
  assert(!orderProgressContent.includes('originalCutOrderNo: line.cutPieceOrderNo'), 'order-progress.ts 仍然把 cutPieceOrderNo 当原始裁片单号')

  const originalSourceContent = readRepoFile('src/data/fcs/cutting/original-cut-order-source.ts')
  assert(originalSourceContent.includes('return listGeneratedOriginalCutOrderSourceRecords()'), 'canonical original cut order source 仍未切到 generated source')
}

function ensureConsumersUseGeneratedOriginalSource(): void {
  const originalOrdersModel = readRepoFile('src/pages/process-factory/cutting/original-orders-model.ts')
  const cuttablePoolModel = readRepoFile('src/pages/process-factory/cutting/cuttable-pool-model.ts')
  const pieceTruth = readRepoFile('src/domain/fcs-cutting-piece-truth/index.ts')

  assert(originalOrdersModel.includes('listGeneratedOriginalCutOrderSourceRecords'), 'original-orders-model.ts 仍未改成消费 generated original cut orders')
  assert(cuttablePoolModel.includes('listGeneratedOriginalCutOrderSourceRecords'), 'cuttable-pool-model.ts 仍未改成消费 generated original cut orders')
  assert(!pieceTruth.includes('|| materialLine.cutPieceOrderNo'), 'piece-truth 仍在把 cutPieceOrderNo 当原始裁片单 fallback')
}

function ensureDirtySeedsDoNotStayAlive(): void {
  const orderIds = new Set(productionOrders.map((order) => order.productionOrderId))
  assert(!orderIds.has('PO-202603-0011'), '脏 seed PO-202603-0011 仍然保留在正式 production order source 中')
  assert(!orderIds.has('PO-202603-0012'), '脏 seed PO-202603-0012 仍然保留在正式 production order source 中')
  assert(!orderIds.has('PO-202603-0013'), '脏 seed PO-202603-0013 仍然保留在正式 production order source 中')

  const illegalDemand = productionDemands.find((item) => item.demandId === 'DEM-202603-0002')
  assert(illegalDemand, '缺少 DEM-202603-0002 测试需求')
  assert(illegalDemand.techPackStatus !== 'RELEASED', 'DEM-202603-0002 不应被视为已发布技术包需求')
  assert(!illegalDemand.hasProductionOrder && illegalDemand.productionOrderId === null, 'DEM-202603-0002 不应继续保活为正式生产单需求')
}

function main(): void {
  ensureNoForceReleased()
  ensureProductionOrdersHaveReleasedUpstream()
  ensureProductionOrderSeedsDoNotInlineSnapshots()
  ensureGeneratedOriginalCutOrdersTraceable()
  ensureOrderProgressIsProjectionOnly()
  ensureConsumersUseGeneratedOriginalSource()
  ensureDirtySeedsDoNotStayAlive()
  console.log('check-fcs-upstream-cutting-chain: ok')
}

main()
