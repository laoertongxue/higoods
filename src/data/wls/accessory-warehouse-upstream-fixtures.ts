import type { ProductionDemand } from '../fcs/production-demands.ts'
import type { ProductionOrder, DemandSnapshot } from '../fcs/production-orders.ts'
import type { ProductionOrderTechPackSnapshot, TechPackBomItemSnapshot } from '../fcs/production-tech-pack-snapshot-types.ts'
import type { RuntimeProcessTask } from '../fcs/runtime-process-tasks.ts'
import type { EffectiveTaskAssignment } from '../fcs/effective-task-assignments.ts'
import type { AccessoryPurpose } from './accessory-warehouse-flow.ts'

export type AccessoryUpstreamFixtureKey = 'F01' | 'F02' | 'F03' | `H${string}` | `M${string}` | 'C01' | 'C02'
export type AccessoryMockStage = '待出库' | '待收货' | '待建领料' | '待领料' | '部分领料' | '已完成' | '配料中' | '待定调入方'
export const ACCESSORY_WORKFLOW_SCENES = [
  ...(['H', 'M'] as const).flatMap(site => (['待出库', '待收货', '待建领料', '待领料', '部分领料', '已完成'] as const).map((stage, index) => ({
    key: `${site}${String(index + 1).padStart(2, '0')}` as AccessoryUpstreamFixtureKey, stage, site,
  }))),
  { key: 'C01' as const, stage: '配料中' as const, site: 'M' as const },
  { key: 'C02' as const, stage: '待定调入方' as const, site: null },
] as const
export interface AccessoryFixtureAssetIssue { materialSku: string; materialName: string; reason: string }
export interface AccessoryUpstreamFixture {
  key: AccessoryUpstreamFixtureKey
  demand: ProductionDemand
  order: ProductionOrder
  techPack: ProductionOrderTechPackSnapshot
  tasks: RuntimeProcessTask[]
  assignments: EffectiveTaskAssignment[]
  assetIssues: AccessoryFixtureAssetIssue[]
}

export interface AccessoryFixtureMaterial {
  sku: string
  name: string
  type: TechPackBomItemSnapshot['type']
  purpose: AccessoryPurpose
  unit: string
  consumption: number
  imageUrl: string
  spec: string
  imageSource: string
}

const AT = '2026-10-19 09:00:00'
const MISSING_ASSET_REASON = '项目现有素材未找到此物料对应图片；不能借用洗护唛图，补齐前图片验收不通过。'

/** 固定 BOM：2 种普通辅料 + 明确排除后道的 4 类。用量与库存底稿分别维护。 */
export function listAccessoryFixtureMaterials(assets: Partial<Record<'价格吊牌' | '品牌吊牌' | '吊粒', string>> = {}): AccessoryFixtureMaterial[] {
  return [
    { sku: 'AW-DEMO-ZIPPER', name: '拉链', type: '辅料', purpose: '其他', unit: '条', consumption: 1,
      imageUrl: '/materials/accessory-zipper.jpg', spec: '金属拉链（演示）', imageSource: 'public/materials/sources.json:accessory-zipper.jpg' },
    { sku: 'AW-DEMO-BUTTON', name: '纽扣', type: '辅料', purpose: '其他', unit: '粒', consumption: 2,
      imageUrl: '/materials/accessory-button.jpg', spec: '标准纽扣（演示）', imageSource: 'public/materials/sources.json:accessory-button.jpg' },
    { sku: 'AW-DEMO-PRICE-TAG', name: '价格吊牌', type: '包装材料', purpose: '价格吊牌', unit: '张', consumption: 1,
      imageUrl: assets.价格吊牌 || '', spec: '单件价格吊牌（演示）', imageSource: assets.价格吊牌 ? '调用方提供，来源与对应关系须另行验收' : '' },
    { sku: 'AW-DEMO-BRAND-TAG', name: '品牌吊牌', type: '包装材料', purpose: '品牌吊牌', unit: '张', consumption: 1,
      imageUrl: assets.品牌吊牌 || '', spec: '单件品牌吊牌（演示）', imageSource: assets.品牌吊牌 ? '调用方提供，来源与对应关系须另行验收' : '' },
    { sku: 'AW-DEMO-TAG-FASTENER', name: '吊粒', type: '辅料', purpose: '吊粒', unit: '条', consumption: 1,
      imageUrl: assets.吊粒 || '', spec: '单件吊粒（演示）', imageSource: assets.吊粒 ? '调用方提供，来源与对应关系须另行验收' : '' },
    { sku: 'AW-DEMO-SEWING-THREAD', name: '车缝线', type: '纱线', purpose: '车缝线', unit: '公斤', consumption: 0.01,
      imageUrl: '/materials/yarn-stitching.jpg', spec: '黑色车缝线（演示）', imageSource: 'public/materials/sources.json:yarn-stitching.jpg' },
  ]
}

function demandSnapshot(demand: ProductionDemand): DemandSnapshot {
  return {
    demandId: demand.demandId, spuCode: demand.spuCode, spuName: demand.spuName,
    buyerName: demand.buyerName, merchandiserName: demand.merchandiserName, saleType: demand.saleType,
    priority: demand.priority, requiredDeliveryDate: demand.requiredDeliveryDate,
    constraintsNote: demand.constraintsNote, skuLines: structuredClone(demand.skuLines),
  }
}

function buildTechPack(demand: ProductionDemand, orderId: string, materials: AccessoryFixtureMaterial[]): ProductionOrderTechPackSnapshot {
  const versionId = `TP-AW-${demand.spuCode}-V1`
  return {
    snapshotId: `${orderId}:TP-V1`, productionOrderId: orderId, productionOrderNo: orderId,
    styleId: `STYLE-${demand.spuCode}`, styleCode: demand.spuCode, styleName: demand.spuName,
    status: 'RELEASED', versionLabel: 'V1', sourceTechPackVersionId: versionId,
    sourceTechPackVersionCode: versionId, sourceTechPackVersionLabel: 'V1',
    sourcePublishedAt: AT, snapshotAt: AT, snapshotBy: '演示跟单', patternDesc: '裁剪 → 车缝 → 后道',
    bomItems: [
      { id: 'AW-BOM-FABRIC', type: '面料', name: '主身面料', materialCode: 'AW-DEMO-FABRIC',
        materialImageUrl: '/materials/fabric-main.jpg', spec: '布料（演示）', colorLabel: '黑色', unit: '米',
        unitConsumption: 1.5, lossRate: 0, supplier: '演示供应商', usageProcessCodes: ['CUT_PANEL'],
        applicableSkuCodes: demand.skuLines.map(sku => sku.skuCode) },
      ...materials.map(material => ({
        id: `AW-BOM-${material.sku}`, type: material.type, name: material.name,
        materialCode: material.sku, materialImageUrl: material.imageUrl, spec: material.spec,
        colorLabel: material.sku === 'AW-DEMO-SEWING-THREAD' ? '黑色' : '标准色', unit: material.unit,
        unitConsumption: material.consumption, lossRate: 0, supplier: '演示辅料供应商',
        usageProcessCodes: ['SEW'], applicableSkuCodes: demand.skuLines.map(sku => sku.skuCode),
      })),
    ],
    patternFiles: [], processEntries: [
      { id: 'AW-PROCESS-CUT', entryType: 'PROCESS_BASELINE', stageCode: 'PROD', stageName: '生产',
        processCode: 'CUT_PANEL', processName: '裁剪', assignmentGranularity: 'ORDER', defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS', isSpecialCraft: false, linkedBomItemIds: ['AW-BOM-FABRIC'], routeStepNo: 1 },
      { id: 'AW-PROCESS-SEW', entryType: 'PROCESS_BASELINE', stageCode: 'PROD', stageName: '生产',
        processCode: 'SEW', processName: '车缝', assignmentGranularity: 'ORDER', defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS', isSpecialCraft: false, linkedBomItemIds: materials.map(material => `AW-BOM-${material.sku}`),
        predecessorEntryIds: ['AW-PROCESS-CUT'], routeStepNo: 2 },
    ],
    sizeTable: [], sizeMeasurements: [], colorMaterialMappings: [], cutPieceParts: [],
    imageSnapshot: { productImages: [demand.imageUrl], styleImages: [demand.imageUrl], sampleImages: [],
      materialImages: ['/materials/fabric-main.jpg'], accessoryImages: materials.map(material => material.imageUrl).filter(Boolean),
      patternImages: [], markerImages: [], artworkImages: [] },
    patternDesigns: [], linkedDesignRevisionTaskIds: [], linkedPatternTaskIds: [], linkedArtworkTaskIds: [],
    completenessScore: materials.every(material => material.imageUrl) ? 100 : 88,
  }
}

function buildTask(order: ProductionOrder, process: 'CUT_PANEL' | 'SEW', factory: { id: string; name: string } | null): RuntimeProcessTask {
  const cutting = process === 'CUT_PANEL', taskId = `${order.productionOrderId}:${process}`
  const dependsOnTaskIds = cutting ? [] : [`${order.productionOrderId}:CUT_PANEL`]
  return {
    taskId, taskNo: `TASK-${order.productionOrderNo}-${cutting ? 'CUT' : 'SEW'}`,
    productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo,
    baseTaskId: taskId, baseQty: 100, baseDependsOnTaskIds: [...dependsOnTaskIds], dependsOnTaskIds,
    seq: cutting ? 1 : 2, processCode: cutting ? 'PROC_CUT' : 'PROC_SEW', processBusinessCode: process,
    processNameZh: cutting ? '裁剪' : '车缝', stage: cutting ? 'CUTTING' : 'SEWING', stageCode: 'PROD',
    qty: 100, qtyUnit: '件', assignmentMode: 'DIRECT', assignmentStatus: factory ? 'ASSIGNED' : 'UNASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL' }, assignedFactoryId: factory?.id, assignedFactoryName: factory?.name,
    qcPoints: [], attachments: [], status: 'NOT_STARTED', scopeType: 'ORDER', scopeKey: order.productionOrderId,
    scopeLabel: '整单 100 件', scopeQty: 100, assignedQty: factory ? 100 : undefined,
    scopeSkuLines: structuredClone(order.demandSnapshot.skuLines), scopeDetailRows: [],
    executionEnabled: true, taskUnitType: 'SINGLE_PROCESS_TASK', sourceEntryId: cutting ? 'AW-PROCESS-CUT' : 'AW-PROCESS-SEW',
    sourceEntryType: 'PROCESS_BASELINE', routeStepNo: cutting ? 1 : 2,
    dispatchedAt: factory ? AT : undefined, dispatchedBy: factory ? '演示分配员' : undefined,
    businessAssignedAt: factory ? AT : undefined, assignmentOperatedAt: factory ? AT : undefined,
    createdAt: AT, updatedAt: AT,
    auditLogs: [{ id: `${taskId}:DEMO`, action: '固定演示任务', detail: factory ? `已分配 ${factory.name}` : '等待任务分配', at: AT, by: '固定演示资料' }],
  }
}

/**
 * 纯演示输入，调用不注册、不写库、不分配实际任务。拥有生产需求/生产单/运行任务的原模块
 * 可以显式采用这些固定记录，并保留同 ID 用户覆盖；不能在普通读取时落盘。
 * F02 的 sea cutting2 是既定输入事实，不在此实现任何自动选厂条件。
 */
export function buildAccessoryWarehouseUpstreamFixtures(options: {
  materialAssets?: Partial<Record<'价格吊牌' | '品牌吊牌' | '吊粒', string>>
  includeWorkflowScenarios?: boolean
} = {}): AccessoryUpstreamFixture[] {
  const materials = listAccessoryFixtureMaterials(options.materialAssets)
  const fixtures: AccessoryUpstreamFixture[] = ([
    { key: 'F01', factory: { id: 'SEA-CUTTING-001', name: 'sea cutting' } },
    { key: 'F02', factory: { id: 'SEA-CUTTING-002', name: 'sea cutting2' } },
    { key: 'F03', factory: null },
  ] as const).map(({ key, factory }) => {
    const orderId = `PO-AW-202610-${key}`, demandId = `DEM-AW-202610-${key}`, spuCode = `SPU-AW-${key}`
    const demand: ProductionDemand = {
      demandId, legacyType: 'ID_PURCHASE', legacyOrderNo: `DEMO-AW-${key}`, sourceSystem: 'NEW',
      spuCode, spuName: `辅料流转演示款 ${key}`, imageUrl: '/shirt-sample.jpg', category: '衬衫',
      marketScopes: ['ID'], buyerName: '演示买手', merchandiserName: '演示跟单', saleType: '备货',
      priority: 'NORMAL', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'V1',
      requiredDeliveryDate: '2026-11-19', requiredQtyTotal: 100, constraintsNote: '固定原型演示资料，不代表现场订单。',
      skuLines: [{ skuCode: `${spuCode}-BLACK-M`, size: 'M', color: '黑色', qty: 60 },
        { skuCode: `${spuCode}-BLACK-L`, size: 'L', color: '黑色', qty: 40 }],
      hasProductionOrder: true, productionOrderId: orderId, createdAt: AT, updatedAt: AT,
    }
    const techPack = buildTechPack(demand, orderId, materials), snapshot = demandSnapshot(demand)
    const order: ProductionOrder = {
      productionOrderId: orderId, productionOrderNo: orderId, demandId, sourceDemandIds: [demandId], legacyOrderNo: demand.legacyOrderNo,
      status: 'WAIT_ASSIGNMENT', lockedLegacy: false, mainFactoryId: 'PENDING-SEWING-MAIN-FACTORY',
      mainFactorySnapshot: { id: 'PENDING-SEWING-MAIN-FACTORY', code: '待定', name: '待车缝任务分配确定',
        tier: 'PENDING', type: 'SEWING', status: '待指定', province: '-', city: '-', tags: ['车缝任务分配后回写'] },
      mainFactoryStatus: 'PENDING_SEWING_ASSIGNMENT', mainFactorySource: 'ORDER_CREATE',
      ownerPartyType: 'LEGAL_ENTITY', ownerPartyId: 'HIGOOD-ID-DEMO', selectedTechPackVersionId: techPack.sourceTechPackVersionId,
      techPackSnapshot: structuredClone(techPack), demandSnapshot: snapshot, sourceDemandSnapshots: [structuredClone(snapshot)],
      assignmentSummary: { directCount: factory ? 1 : 0, biddingCount: 0, totalTasks: 2, unassignedCount: factory ? 1 : 2 },
      assignmentProgress: { status: factory ? 'IN_PROGRESS' : 'PENDING', directAssignedCount: factory ? 1 : 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
      biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
      directDispatchSummary: { assignedFactoryCount: factory ? 1 : 0, rejectedCount: 0, overdueAckCount: 0 },
      taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁剪', '车缝'], lastBreakdownAt: AT, lastBreakdownBy: '演示跟单',
        generatedTaskUnitCount: 2, singleProcessTaskCount: 2 },
      ledgerDetails: { materialIssues: [], taskFactories: [], keyTimes: [], quantityQuality: [] }, riskFlags: [],
      auditLogs: [{ id: `${orderId}:CREATED`, action: '演示生产单', detail: `${key}：${factory ? `裁剪已分配 ${factory.name}` : '裁剪工厂待定'}；未配置自动选厂规则。`, at: AT, by: '固定演示资料' }],
      createdAt: AT, updatedAt: AT,
    }
    const tasks = [buildTask(order, 'CUT_PANEL', factory), buildTask(order, 'SEW', null)]
    const assignments: EffectiveTaskAssignment[] = factory ? [{
      assignmentId: `${orderId}:CUT-ASSIGNMENT-V1`, indexedRuntimeSnapshot: true, runtimeTaskId: tasks[0].taskId,
      productionOrderId: orderId, productionOrderNo: orderId, taskNo: tasks[0].taskNo,
      factoryId: factory.id, factoryName: factory.name, source: 'DIRECT_DISPATCH', assignedQty: 100,
      skuLines: structuredClone(demand.skuLines), processCodes: ['CUT_PANEL'], frozenPrice: 0,
      priceCurrency: 'IDR', priceUnit: '件', businessAssignedAt: AT, operatedAt: AT, operatedBy: '演示分配员', status: 'EFFECTIVE',
    }] : []
    return { key, demand, order, techPack, tasks, assignments,
      assetIssues: materials.filter(material => !material.imageUrl).map(material => ({ materialSku: material.sku, materialName: material.name, reason: MISSING_ASSET_REASON })) }
  })
  if (options.includeWorkflowScenarios) for (const scene of ACCESSORY_WORKFLOW_SCENES) {
    const original = fixtures[scene.site === 'H' ? 0 : scene.site === 'M' ? 1 : 2]
    // 稳定的新单/款/BOM/物料身份隔离旧样例，已有用户覆盖不会被新 Mock 改写。
    let encoded = JSON.stringify(original).replaceAll(original.key, scene.key)
    encoded = encoded.replaceAll('AW-DEMO-', `AW-SCENE-${scene.key}-`)
    const fixture = JSON.parse(encoded) as AccessoryUpstreamFixture
    fixture.key = scene.key
    fixture.demand.spuName = `${scene.site === 'H' ? 'HILON' : scene.site === 'M' ? 'Mahameru' : 'GTP'} 辅料流转 · ${scene.stage}`
    fixture.order.demandSnapshot.spuName = fixture.demand.spuName
    fixture.order.sourceDemandSnapshots![0].spuName = fixture.demand.spuName
    fixture.techPack.styleName = fixture.demand.spuName
    fixture.order.techPackSnapshot = structuredClone(fixture.techPack)
    if (scene.site) {
      Object.assign(fixture.tasks[1], { assignmentStatus: 'ASSIGNED', assignedFactoryId: 'ID-F021', assignedFactoryName: 'CV Micro Sewing Jakarta Pusat',
        dispatchedAt: AT, dispatchedBy: '固定样例', businessAssignedAt: AT, assignmentOperatedAt: AT })
      fixture.order.mainFactoryId = 'ID-F021'
      fixture.order.mainFactorySnapshot = { ...fixture.order.mainFactorySnapshot, id: 'ID-F021', code: 'ID-FAC-0021', name: 'CV Micro Sewing Jakarta Pusat', tier: 'THIRD_PARTY', type: 'THIRD_SEWING', status: 'ACTIVE', tags: ['车缝'] }
      fixture.order.mainFactoryStatus = 'CONFIRMED'
      fixture.order.mainFactorySource = 'SEWING_TASK_ASSIGNMENT'
      fixture.order.directDispatchSummary.assignedFactoryCount = 2
      fixture.order.assignmentSummary = { directCount: 2, biddingCount: 0, totalTasks: 2, unassignedCount: 0 }
      fixture.order.assignmentProgress = { status: 'DONE', directAssignedCount: 2, biddingLaunchedCount: 0, biddingAwardedCount: 0 }
    }
    fixtures.push(fixture)
  }
  return fixtures
}
