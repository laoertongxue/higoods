import assert from 'node:assert/strict'
import { selectSimpleCutPieceTickets } from '../src/data/fcs/cutting/simple-cut-piece-handover.ts'
import { getCutPieceReleaseEligibilityForDetail } from '../src/data/fcs/cutting/cut-piece-release-facts.ts'
import type { ReleaseTicketDetail } from '../src/data/fcs/cut-piece-release-domain.ts'
import type { DispatchTaskSheetData } from '../src/data/fcs/dispatch-task-sheet.ts'
import type { GeneratedFeiTicketSourceRecord } from '../src/data/fcs/cutting/generated-fei-tickets.ts'

const ticket = { feiTicketId: 'FINAL-TICKET', feiTicketNo: 'FINAL-5', productionOrderId: 'PO-FINAL', skuCode: 'SKU-M', skuColor: '灰', skuSize: 'M', partCode: 'FRONT', partName: '前片', sourceBasisType: 'ACTUAL_CUTTING_OUTPUT', sourceOutputLineId: 'OUT-FINAL', actualCutPieceQty: 5, printStatus: 'PRINTED', cutOrderId: 'CUT-FINAL', cutOrderNo: 'CUT-FINAL', hasSpecialCraft: true } as GeneratedFeiTicketSourceRecord
const sheet = { assignment: { productionOrderId: 'PO-FINAL', assignmentId: 'ASG-FINAL', skuLines: [{ skuCode: 'SKU-M', color: '灰', size: 'M', qty: 10 }] } } as DispatchTaskSheetData
const requirement = { skuCode: 'SKU-M', color: '灰', size: 'M', partCode: 'FRONT', partName: '前片', piecesPerGarment: 1, allocatedGarmentQty: 10 }
const detail = { ticketId: ticket.feiTicketId, ticketNo: ticket.feiTicketNo, validity: '可用', bagCode: 'BAG-HISTORY', requiresSpecialCraft: true, craftRequirementKnown: true, completionEvidenceKnown: true, physicalPieceQty: 4, eligiblePieceQty: 4 } as ReleaseTicketDetail
const base = { sheet, requirements: [requirement], tickets: [ticket], handedOver: new Map<string, number>(), consumedIds: new Set<string>(), occupiedIds: new Set<string>(), unavailableReasons: new Map<string, string>(), ambiguousSkuCodes: new Set<string>(), legacyQuantityWithoutTickets: false }
const select = (overrides: Partial<ReleaseTicketDetail> = {}, input: Partial<typeof base> = {}) => selectSimpleCutPieceTickets({ ...base, ...input, ticketEligibilityById: new Map([[ticket.feiTicketId, getCutPieceReleaseEligibilityForDetail({ ...detail, ...overrides })]]) })

const final = select()
assert.equal(final.tickets[0]?.pieceQty, 4, '原票5片，实交必须使用完整最终有效实收4片')
assert.equal(ticket.actualCutPieceQty, 5, '原票数量不得改写')
assert.equal(requirement.allocatedGarmentQty, 10, '原分配责任不得随损耗削减')
assert.equal(final.excluded.length, 0)
for (const change of [
  { physicalPieceQty: 0, eligiblePieceQty: 0 },
  { physicalPieceQty: 5, eligiblePieceQty: 0 },
  { completionEvidenceKnown: false },
  { craftRequirementKnown: false },
  { validity: '不可用' },
] as Array<Partial<ReleaseTicketDetail>>) assert.equal(select(change).tickets.length, 0, '零实收、无最终工艺/完成依据、未知工艺及整票不可用都不能交出')
assert.equal(select({}, { occupiedIds: new Set([ticket.feiTicketId]) }).tickets.length, 0, '袋占用不可重复消耗')
assert.equal(select({}, { consumedIds: new Set([ticket.feiTicketId]) }).tickets.length, 0, '已交出不可重复消耗')
assert.equal(select({}, { handedOver: new Map([['SKU-M::灰::M::FRONT', 6]]) }).tickets[0]?.pieceQty, 4, '剩余责任4片时以实收4消耗，不能按原票5错误拒绝')
assert.equal(select({}, { handedOver: new Map([['SKU-M::灰::M::FRONT', 7]]) }).tickets.length, 0, '最终4片整票超过剩余3片，不能截票')
assert.equal(select({}, { tickets: [{ ...ticket, skuColor: '白' }] }).tickets.length, 0, '工艺实收不绕过颜色身份')
assert.equal(select({}, { tickets: [{ ...ticket, printStatus: 'VOIDED' }] }).tickets.length, 0, '工艺实收不绕过作废状态')
assert.equal(select({}, { tickets: [{ ...ticket, actualCutPieceQty: 0 }] }).tickets.length, 0, '工艺实收不掩盖原裁剪来源数量无效')
assert.equal(select({ physicalPieceQty: 4.5, eligiblePieceQty: 4.5 }).tickets.length, 0, '实交片数必须是安全整数')
const unknown = selectSimpleCutPieceTickets({ ...base, ticketEligibilityById: new Map([[ticket.feiTicketId, getCutPieceReleaseEligibilityForDetail(undefined)]]) })
assert.equal(unknown.tickets.length, 0, '已知要工艺的票没有可信最终资料时不得当普通票')
const ordinary = select({ bagCode: '', requiresSpecialCraft: false, physicalPieceQty: 5, eligiblePieceQty: 0 }, { tickets: [{ ...ticket, hasSpecialCraft: false }] })
assert.equal(ordinary.tickets[0]?.pieceQty, 5, '普通未装袋有效实裁票继续按整票原数量交出')
const manual = { ...ticket, sourceBasisType: 'MANUAL_MARKER_PLAN' as const }
assert.equal(select({}, { tickets: [manual] }).tickets[0]?.pieceQty, 4, '手工票有最终有效实收事实时按该实际实物交出')
assert.equal(select({ requiresSpecialCraft: false, physicalPieceQty: 5, eligiblePieceQty: 0 }, { tickets: [{ ...manual, hasSpecialCraft: false }] }).tickets.length, 0, '普通手工计划本身仍不是原简易入口的实际完裁来源')
console.log('简易最终实收契约通过：原5/实4、final0、工艺/完成依据、不可用、共享占用、原身份、整票上限和原责任保留。')
