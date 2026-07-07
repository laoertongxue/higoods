import { readFileSync } from 'node:fs'
import path from 'node:path'

import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { productionDemands } from '../src/data/fcs/production-demands.ts'
import {
  getProductionDemandById,
  resolveReleasedTechPackForProductionOrder,
  validateDemandTechPackOrderLink,
} from '../src/data/fcs/production-upstream-chain.ts'
import {
  hasFormalTechPackForCutting,
  listCuttingProductionOrdersWithFormalTechPack,
  listGeneratedCutOrderSourceRecords,
} from '../src/data/fcs/cutting/generated-cut-orders.ts'
import { shouldGenerateCutOrderForProductionOrder } from '../src/data/fcs/task-generation-boundaries.ts'

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

function ensureGeneratedCutOrdersTraceable(): void {
  const generated = listGeneratedCutOrderSourceRecords()
  assert(generated.length > 0, 'generated cut orders 为空')
  const generatedProductionOrderIds = new Set(generated.map((record) => record.productionOrderId))
  const canonicalProductionOrderIds = new Set(listCuttingProductionOrdersWithFormalTechPack().map((order) => order.productionOrderId))
  const eligibleProductionOrders = productionOrders.filter((order) =>
    hasFormalTechPackForCutting(order) && shouldGenerateCutOrderForProductionOrder(order),
  )
  assert(canonicalProductionOrderIds.size === eligibleProductionOrders.length, '裁片单候选列表必须只包含应生成裁片单的真实生产单')
  eligibleProductionOrders.forEach((order) => {
    assert(canonicalProductionOrderIds.has(order.productionOrderId), `应生成裁片单的生产单 ${order.productionOrderId} 不得在边界过滤前被截断`)
    assert(generatedProductionOrderIds.has(order.productionOrderId), `应生成裁片单的生产单 ${order.productionOrderId} 缺少 generated cut order`)
  })
  productionOrders
    .filter((order) => hasFormalTechPackForCutting(order) && !shouldGenerateCutOrderForProductionOrder(order))
    .forEach((order) => {
      assert(!generatedProductionOrderIds.has(order.productionOrderId), `不应生成裁片单的生产单 ${order.productionOrderId} 不得生成 cut order`)
    })

  generated.forEach((record) => {
    assert(record.productionOrderId, `裁片单 ${record.cutOrderNo} 缺少 productionOrderId`)
    assert(record.cutOrderId, `裁片单 ${record.cutOrderNo} 缺少 cutOrderId`)
    assert(record.materialSku, `裁片单 ${record.cutOrderNo} 缺少 materialSku`)
    assert(record.sourceTechPackSpuCode, `裁片单 ${record.cutOrderNo} 缺少 sourceTechPackSpuCode`)
    assert(record.techPackVersionLabel, `裁片单 ${record.cutOrderNo} 缺少 tech pack 版本`)
    assert(record.cutOrderSourceLabel, `裁片单 ${record.cutOrderNo} 缺少来源类型`)
    assert(record.cutReturnModeLabel, `裁片单 ${record.cutOrderNo} 缺少回流方式`)
    assert(record.internalCraftOrderPolicyLabel, `裁片单 ${record.cutOrderNo} 缺少我方加工单策略`)
    if (record.cutOrderSourceType === 'CONTINUOUS_WITH_CUTTING_TASK') {
      assert(record.cutOrderSourceLabel === '含裁片连续任务', `裁片单 ${record.cutOrderNo} 含裁片连续任务来源标签错误`)
      assert(record.cutReturnMode === 'THIRD_PARTY_REPORT_ONLY', `裁片单 ${record.cutOrderNo} 含裁片连续任务回流方式错误`)
      assert(record.cutReturnModeLabel === '三方上报裁片完成', `裁片单 ${record.cutOrderNo} 含裁片连续任务回流方式标签错误`)
      assert(record.internalCraftOrderPolicy === 'DO_NOT_GENERATE', `含裁片连续任务裁片单 ${record.cutOrderNo} 不得生成我方加工单`)
      assert(record.internalCraftOrderPolicyLabel === '不生成我方加工单', `裁片单 ${record.cutOrderNo} 含裁片连续任务我方加工单策略标签错误`)
    } else {
      assert(record.cutOrderSourceType === 'INDEPENDENT_CUTTING_TASK', `裁片单 ${record.cutOrderNo} 来源类型错误`)
      assert(record.cutOrderSourceLabel === '独立裁片任务', `裁片单 ${record.cutOrderNo} 独立裁片任务来源标签错误`)
      assert(record.cutReturnMode === 'RETURN_TO_OWN_CUTTING_WAREHOUSE', `裁片单 ${record.cutOrderNo} 独立裁片任务回流方式错误`)
      assert(record.cutReturnModeLabel === '回我方裁床待交出仓', `裁片单 ${record.cutOrderNo} 独立裁片任务回流方式标签错误`)
      assert(record.internalCraftOrderPolicy === 'GENERATE_AFTER_RETURN', `裁片单 ${record.cutOrderNo} 独立裁片任务我方加工单策略错误`)
      assert(record.internalCraftOrderPolicyLabel === '回仓后生成我方加工单', `裁片单 ${record.cutOrderNo} 独立裁片任务我方加工单策略标签错误`)
    }

    const order = productionOrders.find((item) => item.productionOrderId === record.productionOrderId)
    assert(order, `裁片单 ${record.cutOrderNo} 无法回溯到 production order ${record.productionOrderId}`)
    assert(order.demandSnapshot.spuCode === record.sourceTechPackSpuCode, `裁片单 ${record.cutOrderNo} tech pack spu 不一致`)

    const scopedSkuKeys = new Set(
      order.demandSnapshot.skuLines.map((line) => `${line.skuCode}::${line.color}::${line.size}`),
    )
    assert(record.skuScopeLines.length > 0, `裁片单 ${record.cutOrderNo} 没有 sku scope`)
    record.skuScopeLines.forEach((line) => {
      const key = `${line.skuCode}::${line.color}::${line.size}`
      assert(scopedSkuKeys.has(key), `裁片单 ${record.cutOrderNo} 的 sku scope ${key} 不属于 production order ${record.productionOrderId}`)
    })
  })
}

function ensureOrderProgressIsProjectionOnly(): void {
  const orderProgressContent = readRepoFile('src/data/fcs/cutting/order-progress.ts')
  assert(orderProgressContent.includes('listCuttingProductionOrdersWithFormalTechPack'), 'order-progress.ts 没有基于正式技术包生产单构建投影')
  assert(orderProgressContent.includes('listGeneratedCutOrderSourceRecords'), 'order-progress.ts 没有消费 generated cut order source')
  assert(!orderProgressContent.includes('cutOrderId: line.cutPieceOrderNo'), 'order-progress.ts 仍然把 cutPieceOrderNo 当裁片单 id')
  assert(!orderProgressContent.includes('cutOrderNo: line.cutPieceOrderNo'), 'order-progress.ts 仍然把 cutPieceOrderNo 当裁片单号')

  const cutOrderSourceContent = readRepoFile('src/data/fcs/cutting/cut-order-source.ts')
  assert(cutOrderSourceContent.includes('return listGeneratedCutOrderSourceRecords()'), 'canonical cut order source 仍未切到 generated source')
}

function ensureConsumersUseGeneratedCutOrderSource(): void {
  const cutOrdersModel = readRepoFile('src/pages/process-factory/cutting/cut-orders-model.ts')
  const pieceTruth = readRepoFile('src/domain/fcs-cutting-piece-truth/index.ts')

  assert(cutOrdersModel.includes('listGeneratedCutOrderSourceRecords'), 'cut-orders-model.ts 仍未改成消费 generated cut orders')
  assert(!pieceTruth.includes('|| materialLine.cutPieceOrderNo'), 'piece-truth 仍在把 cutPieceOrderNo 当裁片单 fallback')
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
  ensureGeneratedCutOrdersTraceable()
  ensureOrderProgressIsProjectionOnly()
  ensureConsumersUseGeneratedCutOrderSource()
  ensureDirtySeedsDoNotStayAlive()
  console.log('check-fcs-upstream-cutting-chain: ok')
}

main()
