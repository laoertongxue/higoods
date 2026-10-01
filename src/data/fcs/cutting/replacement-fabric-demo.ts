import demoTechPacks from '../production-order-demo-tech-packs.json' with { type: 'json' }
import type { ProductionOrderTechPackSnapshot } from '../production-tech-pack-snapshot-types.ts'
import type { ProductionOrder } from '../production-orders.ts'
import type { ReplacementFabricScope, ReplacementFabricState, ReplacementFabricTicket } from './replacement-fabric-fei-tickets.ts'

/** 固定演示 V1：与现有多面料待打印单合计五行；静态读取，不初始化落盘。 */
export const REPLACEMENT_FABRIC_DEMOS = [
  { id: 'PO-202610-9001', scene: '部分打印／同面料多票', materials: ['main', 'splice'], copies: 2, printed: 2 },
  { id: 'PO-202610-9002', scene: '全部打印／补打原票', materials: ['pocket'], copies: 1, printed: 1 },
  { id: 'PO-202610-9003', scene: '已交出／保留备用票', materials: ['main', 'pocket'], copies: 2, printed: 4 },
  { id: 'PO-202610-9004', scene: '待打印／失效历史票', materials: ['main', 'splice'], copies: 1, printed: 0 },
] as const
export const REPLACEMENT_FABRIC_DEMO_ASSIGNED_AT = '2026-09-28 09:00:00'

export function buildReplacementFabricDemoOrders(source: ProductionOrder): ProductionOrder[] {
  return REPLACEMENT_FABRIC_DEMOS.map(demo => {
    const order = structuredClone(source)
    order.productionOrderId = demo.id; order.productionOrderNo = demo.id
    order.ledgerDetails = { materialIssues: [], taskFactories: [], keyTimes: [], quantityQuality: [] }
    order.createdAt = '2026-09-27 09:00:00'; order.updatedAt = REPLACEMENT_FABRIC_DEMO_ASSIGNED_AT
    order.auditLogs = [{ id: `${demo.id}-MOCK-V1`, action: 'MOCK_SOURCE', detail: `换片布演示：${demo.scene}；沿用原生产需求的款式与SKU，独立演示生产批次。`, at: order.createdAt, by: '原型演示' }]
    const pack = order.techPackSnapshot!
    pack.productionOrderId = demo.id; pack.productionOrderNo = demo.id; pack.snapshotId = `TPS-${demo.id}`
    const materialIds = new Set(pack.bomItems.filter(item => demo.materials.some(suffix => item.id.endsWith(`-bom-${suffix}`))).map(item => item.id))
    pack.bomItems = pack.bomItems.filter(item => materialIds.has(item.id))
    pack.colorMaterialMappings = pack.colorMaterialMappings.map(mapping => ({ ...mapping, id: `${demo.id}-${mapping.id}`, lines: mapping.lines.filter(line => materialIds.has(line.bomItemId || '')) }))
    pack.cutPieceParts = pack.cutPieceParts.filter(part => materialIds.has(part.materialSku || ''))
    const patternIds = new Set(pack.bomItems.flatMap(item => item.linkedPatternIds || []))
    pack.patternFiles = pack.patternFiles.filter(pattern => patternIds.has(pattern.id) || (pattern.id.endsWith('package-main') && materialIds.has('tdv_demand_SPU_2024_005-bom-main')))
    pack.processEntries = pack.processEntries.filter(entry => ['CUT_PANEL', 'SEW'].includes(entry.processCode))
    pack.processEntries.forEach(entry => { entry.linkedBomItemIds = []; entry.consumedBomItemIds = []; entry.linkedPatternIds = [] })
    pack.imageSnapshot.materialImages = pack.bomItems.map(item => item.materialImageUrl!).filter(Boolean)
    return order
  })
}

/** 票、打印回执及历史交出回执共享固定身份；持久记录按同 ID 覆盖静态记录。 */
export function buildReplacementFabricDemoState(): ReplacementFabricState {
  const state: ReplacementFabricState = { tickets: [], prints: [], receipts: [] }
  for (const demo of REPLACEMENT_FABRIC_DEMOS) {
    const pack = demoTechPacks['PO-202603-0002'] as unknown as ProductionOrderTechPackSnapshot
    const current: ReplacementFabricScope[] = [{ productionOrderId: demo.id, productionOrderNo: demo.id, factoryId: 'F090', assignmentKey: '', issues: [],
      materials: pack.bomItems.filter(item => demo.materials.some(suffix => item.id.endsWith(`-bom-${suffix}`))).map(item => {
        const code = item.materialSkuId || item.variantId || item.materialCode || item.id
        const color = item.colorLabel || 'Grey'
        return { key: JSON.stringify([code, color]), code, name: item.name, color, imageUrl: item.materialImageUrl || '', skuCodes: item.applicableSkuCodes || [] }
      }) }]
    for (const scope of current) for (const material of scope.materials) {
      // 演示历史身份独立于之后的改派，改派后旧票按原身份保留，不凭新分配复活。
      const assignmentKey = JSON.stringify([`TASKGEN-${demo.id.slice(3)}-001__ORDER`, 'F090', REPLACEMENT_FABRIC_DEMO_ASSIGNED_AT])
      for (let copy = 1; copy <= demo.copies; copy++) {
        const sequence = demo.id === 'PO-202610-9004' && material.code.endsWith('-bom-main') ? copy + 1 : copy
        const id = `HPB-DEMO-V1-${demo.id}-${encodeURIComponent(material.key)}-${sequence}`
        const ticket: ReplacementFabricTicket = { id, ticketNo: `HPB/${demo.id}/${encodeURIComponent(material.code)}/${encodeURIComponent(material.color)}/${String(sequence).padStart(3, '0')}`, sequence,
          productionOrderId: demo.id, productionOrderNo: demo.id, cuttingFactoryId: 'F090', assignmentKey, material: structuredClone(material), length: 5, unit: 'Yard',
          createdAt: REPLACEMENT_FABRIC_DEMO_ASSIGNED_AT, createdBy: '原型演示', creationCommandId: `demo-v1:${id}` }
        state.tickets.push(ticket)
      }
    }
    const tickets = state.tickets.filter(ticket => ticket.productionOrderId === demo.id)
    tickets.slice(0, demo.printed).forEach(ticket => state.prints.push({ id: `${ticket.id}-print-1`, ticketId: ticket.id, commandId: `${demo.id}-print`, printedAt: '2026-09-28 10:00:00', printedBy: '裁床打票员（演示）', kind: 'FIRST_PRINT' }))
    if (demo.id === 'PO-202610-9002' && tickets[0]) state.prints.push({ id: `${tickets[0].id}-print-2`, ticketId: tickets[0].id, commandId: `${demo.id}-reprint`, printedAt: '2026-09-29 09:00:00', printedBy: '裁床主管（演示）', kind: 'REPRINT' })
    if (demo.id === 'PO-202610-9003') tickets.filter(ticket => ticket.sequence === 1).forEach(ticket => state.receipts.push({ id: `${ticket.id}-receipt`, ticket: structuredClone(ticket), taskId: `TASKGEN-${demo.id.slice(3)}-002__ORDER`, receiverFactoryId: 'ID-F003', handoverRecordId: `HPB-DEMO-HANDOVER-${demo.id}`, confirmedAt: '2026-09-29 14:00:00', confirmedBy: '裁床交出员（演示）' }))
    if (demo.id === 'PO-202610-9004' && tickets[0]) {
      const old = structuredClone(tickets[0]); old.id += '-invalid'; old.ticketNo = old.ticketNo.replace('/002', '/001'); old.sequence = 1; old.createdAt = '2026-09-27 10:00:00'; old.assignmentKey = 'demo-v1:previous-assignment'; old.invalidatedAt = '2026-09-28 08:30:00'; old.invalidReason = '原裁床分配撤销（演示历史）'; old.creationCommandId += '-invalid'; state.tickets.push(old)
    }
  }
  return state
}
