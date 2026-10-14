// Live demand conversion owns current-tech-pack validation; frozen readers stay independent.
import { buildProductionOrderDemandSnapshot, cloneProductionOrderTechPackSnapshot } from './production-frozen-snapshot.ts'
import { buildProductionOrderTechPackSnapshot } from './production-tech-pack-snapshot-builder.ts'
import { validateDemandTechPackOrderLink } from './production-upstream-chain.ts'
import { buildProductionOrderFromResolvedUpstream, resolveProductionOrderFactorySnapshot, buildDefaultProductionLedgerDetails, cloneProductionLedgerDetails, createPendingMainFactorySnapshot, PENDING_MAIN_FACTORY_ID, type ProductionOrderSeed, type ProductionOrder, type DemandSnapshot } from './production-orders.ts'
import { isKolGotoSaleType, type ProductionDemand } from './production-demands.ts'
import { KOL_GOTO_FACTORY_ID, KOL_GOTO_FACTORY_NAME } from './factory-mock-data.ts'
import { applyKolGotoTechPackFixture } from './kol-goto-tech-pack-fixtures.ts'

export function buildProductionOrderFromSeed(seed: ProductionOrderSeed): ProductionOrder {
  const validation = validateDemandTechPackOrderLink({
    productionOrderId: seed.productionOrderId,
    demandId: seed.demandId,
    snapshotAt: seed.snapshotAt ?? seed.updatedAt,
    snapshotBy: seed.snapshotBy || '系统初始化',
  })

  if (!validation.ok || !validation.demand || !validation.techPackSnapshot) {
    throw new Error(
      [`生产单 ${seed.productionOrderId} 上游链非法`, ...validation.issues.map((item) => item.message)].join('；'),
    )
  }

  return buildProductionOrderFromResolvedUpstream(seed, validation.demand, validation.techPackSnapshot)
}

export function buildProductionOrderFromDemand(
  seed: ProductionOrderSeed,
  demand: ProductionDemand,
  snapshotBy: string,
): ProductionOrder {
  if (seed.demandId !== demand.demandId) {
    throw new Error(`生产单 ${seed.productionOrderId} 与需求 ${demand.demandId} 绑定不一致`)
  }

  const techPackSnapshot = buildProductionOrderTechPackSnapshot({
    productionOrderId: seed.productionOrderId,
    productionOrderNo: seed.productionOrderId,
    demand,
    snapshotAt: seed.snapshotAt ?? seed.updatedAt,
    snapshotBy,
    technicalVersionId: seed.selectedTechPackVersionId,
  })

  return buildProductionOrderFromResolvedUpstream(seed, demand, techPackSnapshot)
}

export function resolveMergedPriority(demands: ProductionDemand[]): string {
  const weights: Record<string, number> = { NORMAL: 1, HIGH: 2, URGENT: 3 }
  return demands
    .map((demand) => demand.priority)
    .sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0))[0] ?? 'NORMAL'
}

export function resolveMergedDeliveryDate(demands: ProductionDemand[]): string | null {
  return demands
    .map((demand) => demand.requiredDeliveryDate)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null
}

export function buildMergedProductionOrderDemandSnapshot(demands: ProductionDemand[]): DemandSnapshot {
  const primary = demands[0]
  const sameSpu = demands.every((demand) => demand.spuCode === primary.spuCode)
  const skuMap = new Map<string, DemandSnapshot['skuLines'][number]>()

  for (const demand of demands) {
    for (const line of demand.skuLines) {
      const key = `${line.skuCode}::${line.size}::${line.color}`
      const current = skuMap.get(key)
      if (current) {
        current.qty += line.qty
      } else {
        skuMap.set(key, { ...line })
      }
    }
  }

  const demandIds = demands.map((demand) => demand.demandId)
  const buyerNames = Array.from(new Set(demands.map((demand) => demand.buyerName).filter(Boolean)))
  const merchandiserNames = Array.from(new Set(demands.map((demand) => demand.merchandiserName).filter(Boolean)))
  const saleTypes = Array.from(new Set(demands.map((demand) => demand.saleType).filter(Boolean)))

  return {
    demandId: demands.length === 1 ? primary.demandId : demandIds.join('、'),
    spuCode: sameSpu ? primary.spuCode : '多款合并',
    spuName: sameSpu ? primary.spuName : '多款合并生产单',
    buyerName: buyerNames.join('、') || '待指定买手',
    merchandiserName: merchandiserNames.join('、') || '待指定跟单',
    saleType: saleTypes.length === 1 ? saleTypes[0] : '预售备货',
    priority: resolveMergedPriority(demands),
    requiredDeliveryDate: resolveMergedDeliveryDate(demands),
    constraintsNote: '',
    skuLines: [...skuMap.values()],
  }
}

export function buildProductionOrderFromDemands(
  seed: ProductionOrderSeed,
  demands: ProductionDemand[],
  snapshotBy: string,
): ProductionOrder {
  if (demands.length === 0) {
    throw new Error(`生产单 ${seed.productionOrderId} 未选择生产需求`)
  }

  const primaryDemand = demands[0]
  if (!demands.some((demand) => demand.demandId === seed.demandId)) {
    throw new Error(`生产单 ${seed.productionOrderId} 主需求 ${seed.demandId} 不在合并需求中`)
  }

  const isKolGotoDemand = (demand: ProductionDemand): boolean => isKolGotoSaleType(demand.saleType)
  const kolDemandCount = demands.filter(isKolGotoDemand).length
  if (kolDemandCount > 0 && kolDemandCount !== demands.length) {
    throw new Error('KOL样衣 / KOL样品小单不能与其他售卖类型合并生成生产单')
  }
  const isKolGotoDemandGroup = kolDemandCount === demands.length
  const resolvedSeed: ProductionOrderSeed = isKolGotoDemandGroup
    ? {
        ...seed,
        status: 'EXECUTING',
        mainFactoryId: KOL_GOTO_FACTORY_ID,
        mainFactoryStatus: 'CONFIRMED',
        mainFactorySource: 'ORDER_CREATE',
        mainFactoryConfirmedAt: seed.mainFactoryConfirmedAt ?? seed.createdAt,
        mainFactoryConfirmedBy: seed.mainFactoryConfirmedBy ?? '系统',
        ownerPartyType: 'FACTORY',
        ownerPartyId: KOL_GOTO_FACTORY_ID,
        ownerReason: `KOL整单任务固定由 ${KOL_GOTO_FACTORY_NAME} 承接。`,
        assignmentSummary: { directCount: 1, biddingCount: 0, totalTasks: 1, unassignedCount: 0 },
        assignmentProgress: { status: 'DONE', directAssignedCount: 1, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
        biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
        directDispatchSummary: { assignedFactoryCount: 1, rejectedCount: 0, overdueAckCount: 0 },
        taskBreakdownSummary: {
          ...seed.taskBreakdownSummary,
          isBrokenDown: true,
          taskTypesTop3: ['KOL整单任务'],
          generatedTaskUnitCount: 1,
          singleProcessTaskCount: 0,
          independentWorkOrderTaskCount: 0,
          mergedProductionTaskCount: 0,
          wholeOrderTaskCount: 1,
          coveredProcessNames: ['KOL整单任务'],
        },
      }
    : seed

  const techPackSnapshot = buildProductionOrderTechPackSnapshot({
    productionOrderId: resolvedSeed.productionOrderId,
    productionOrderNo: resolvedSeed.productionOrderId,
    demand: primaryDemand,
    snapshotAt: resolvedSeed.snapshotAt ?? resolvedSeed.updatedAt,
    snapshotBy,
    technicalVersionId: resolvedSeed.selectedTechPackVersionId,
  })

  const factorySnapshot = resolveProductionOrderFactorySnapshot(resolvedSeed.mainFactoryId)
  const isPendingFactory = resolvedSeed.mainFactoryStatus === 'PENDING_SEWING_ASSIGNMENT' || resolvedSeed.mainFactoryId === PENDING_MAIN_FACTORY_ID
  if (!factorySnapshot && !isPendingFactory) {
    throw new Error(`生产单 ${resolvedSeed.productionOrderId} 绑定的主工厂 ${resolvedSeed.mainFactoryId} 不存在`)
  }

  const demandSnapshots = demands.map((demand) => buildProductionOrderDemandSnapshot(demand))
  const demandSnapshot = buildMergedProductionOrderDemandSnapshot(demands)
  const ledgerDetails = resolvedSeed.ledgerDetails ?? buildDefaultProductionLedgerDetails(resolvedSeed, primaryDemand, (factorySnapshot ?? createPendingMainFactorySnapshot()).name)
  const resolvedTechPackSnapshot = isKolGotoDemandGroup
    ? applyKolGotoTechPackFixture(primaryDemand.spuCode, cloneProductionOrderTechPackSnapshot(techPackSnapshot))
    : techPackSnapshot

  return {
    ...resolvedSeed,
    productionOrderNo: resolvedSeed.productionOrderId,
    sourceDemandIds: demands.map((demand) => demand.demandId),
    lockedLegacy: seed.lockedLegacy ?? false,
    mainFactorySnapshot: factorySnapshot ?? createPendingMainFactorySnapshot(),
    sewingFactorySnapshots: [],
    mainFactoryStatus: resolvedSeed.mainFactoryStatus ?? 'CONFIRMED',
    mainFactorySource: resolvedSeed.mainFactorySource ?? 'ORDER_CREATE',
    mainFactoryConfirmedAt: resolvedSeed.mainFactoryConfirmedAt,
    mainFactoryConfirmedBy: resolvedSeed.mainFactoryConfirmedBy,
    legacyOrderNo: demands.map((demand) => demand.legacyOrderNo).join('、'),
    demandSnapshot,
    sourceDemandSnapshots: demandSnapshots,
    techPackSnapshot: cloneProductionOrderTechPackSnapshot(resolvedTechPackSnapshot),
    ledgerDetails: cloneProductionLedgerDetails(ledgerDetails),
  }
}
