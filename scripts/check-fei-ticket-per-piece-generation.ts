import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  buildFeiTicketQrPayload,
  buildSpecialCraftSummary,
  generateFeiTicketsFromPieceInstances,
  getFeiTicketsNeedSpecialCraft,
  listCutPieceFeiTicketGenerationSourceOrders,
  listCutPieceFeiTickets,
  previewFeiTicketGeneration,
} from '../src/data/fcs/cutting/fei-ticket-generation.ts'
import {
  getFeiTicketSpecialCraftFlowSummary,
  getSpecialCraftsFromFeiTicket,
  groupFeiTicketsBySpecialCraft,
} from '../src/data/fcs/cutting/special-craft-fei-ticket-flow.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`菲票逐片生成检查失败：${message}`)
  }
}

function assertIncludes(source: string, expected: string, message: string): void {
  assert(source.includes(expected), `${message}：缺少 ${expected}`)
}

for (const scriptPath of [
  'scripts/check-process-craft-dictionary-rebuild.ts',
  'scripts/check-bom-shrink-wash-process-linkage.ts',
  'scripts/check-pattern-two-step-maintenance.ts',
  'scripts/check-pattern-binding-duplicate.ts',
  'scripts/check-pattern-piece-color-quantity.ts',
  'scripts/check-pattern-piece-instance-special-craft.ts',
]) {
  assert(existsSync(resolve(root, scriptPath)), `前置检查脚本不存在：${scriptPath}`)
}

const generationSource = read('src/data/fcs/cutting/fei-ticket-generation.ts')
const feiTicketPageSource = read('src/pages/process-factory/cutting/fei-tickets.ts')
const printTemplateSource = read('src/pages/print/templates/label-print-template.ts')
const printSource = read('src/data/fcs/cutting-task-print-source.ts')
const flowSource = read('src/data/fcs/cutting/special-craft-fei-ticket-flow.ts')
const docSource = existsSync(resolve(root, 'docs/fcs-fei-ticket-per-piece-generation.md'))
  ? read('docs/fcs-fei-ticket-per-piece-generation.md')
  : ''

for (const expected of [
  'export interface CutPieceFeiTicket',
  'feiTicketId: string',
  'feiTicketNo: string',
  'sourceTechPackVersionId: string',
  'sourcePatternId: string',
  'sourcePieceId: string',
  'sourcePieceInstanceId: string',
  'originalCutPieceOrderId: string',
  'originalCutPieceOrderNo: string',
  'mergeBatchId?: string',
  'productionOrderId: string',
  'colorId: string',
  'colorName: string',
  'sizeName: string',
  'pieceName: string',
  'sequenceNo: number',
  'specialCrafts: FeiTicketSpecialCraft[]',
  'specialCraftSummary: string',
  'qrCodePayload: string',
]) {
  assertIncludes(generationSource, expected, '菲票模型必须包含逐片和追溯字段')
}

for (const expected of [
  'export interface FeiTicketSpecialCraft',
  'craftCode: string',
  'craftName: string',
  'craftPosition:',
  'craftPositionName:',
  'sourceAssignmentId: string',
]) {
  assertIncludes(generationSource, expected, '菲票特殊工艺必须结构化保存')
}

for (const expected of [
  'generateFeiTicketsFromPieceInstances',
  'buildFeiTicketNo',
  'buildFeiTicketQrPayload',
  'buildSpecialCraftSummary',
  'getFeiTicketsByOriginalCutPieceOrder',
  'getFeiTicketsByPieceInstance',
  'getFeiTicketsBySpecialCraft',
  'getFeiTicketsNeedSpecialCraft',
  'previewFeiTicketGeneration',
  'confirmFeiTicketGeneration',
]) {
  assertIncludes(generationSource, expected, '菲票生成模块必须提供查询和生成入口')
}

for (const expected of [
  '逐片菲票',
  '逐片生成菲票',
  '生成菲票',
  '本次将生成',
  '无特殊工艺',
  '合并裁剪批次仅作为执行上下文',
  'data-testid="per-piece-fei-ticket-row"',
  'data-testid="per-piece-fei-ticket-detail"',
  'data-testid="per-piece-fei-ticket-qr-payload"',
]) {
  assertIncludes(feiTicketPageSource, expected, '打菲票页面必须展示逐片菲票和生成预览')
}

for (const expected of [
  'listCutPieceFeiTickets',
  'perPieceTicketToRecord',
  'sourcePieceInstanceId',
  'specialCraftSummary',
  '工艺位置',
  '二维码追溯',
]) {
  assertIncludes(printTemplateSource, expected, '菲票打印模板必须使用逐片菲票源')
}

for (const expected of [
  'CuttingPerPieceFeiTicketPrintSource',
  'listCuttingPerPieceFeiTicketPrintSources',
  'getCuttingPerPieceFeiTicketPrintSourceById',
  'sourcePieceInstanceId',
  'originalCutPieceOrderId',
  'specialCraftSummary',
  'qrCodePayload',
]) {
  assertIncludes(printSource, expected, '裁片打印源必须暴露逐片菲票数据')
}

for (const expected of [
  'getSpecialCraftsFromFeiTicket',
  'getFeiTicketsForSpecialCraft',
  'groupFeiTicketsBySpecialCraft',
  'getFeiTicketSpecialCraftFlowSummary',
  'relatedFeiTicketIds',
]) {
  assertIncludes(flowSource, expected, '特殊工艺流转必须能读取菲票结构化工艺')
}

assert(docSource.includes('一片一个菲票'), '文档必须说明一片一个菲票')
assert(docSource.includes('菲票归属原始裁片单'), '文档必须说明菲票归属原始裁片单')
assert(docSource.includes('合并裁剪批次只能作为执行上下文'), '文档必须说明合并裁剪批次只能作为执行上下文')

const tickets = listCutPieceFeiTickets()
assert(tickets.length >= 30, 'mock 数据必须包含至少 30 张逐片菲票')
const byOriginal = new Map<string, number>()
tickets.forEach((ticket) => byOriginal.set(ticket.originalCutPieceOrderId, (byOriginal.get(ticket.originalCutPieceOrderId) || 0) + 1))
assert(Array.from(byOriginal.values()).filter((count) => count >= 10).length >= 3, '至少 3 个原始裁片单每个生成 10 张以上逐片菲票')
assert(tickets.every((ticket) => ticket.sourcePieceInstanceId), '每张菲票必须有 sourcePieceInstanceId')
assert(tickets.every((ticket) => ticket.originalCutPieceOrderId), '每张菲票必须有 originalCutPieceOrderId')
assert(tickets.every((ticket) => ticket.originalCutPieceOrderNo), '每张菲票必须有 originalCutPieceOrderNo')
assert(tickets.every((ticket) => ticket.specialCrafts.every((craft) => craft.craftCode && craft.craftName && craft.craftPosition && craft.craftPositionName)), '菲票特殊工艺必须包含编码、名称、位置')

const activeTickets = tickets.filter((ticket) => ticket.printStatus !== '已作废')
const activePieceIds = activeTickets.map((ticket) => ticket.sourcePieceInstanceId)
assert(new Set(activePieceIds).size === activePieceIds.length, '同一 sourcePieceInstanceId 不得重复生成多个有效菲票')

assert(tickets.some((ticket) => ticket.specialCrafts.length > 0), 'mock 数据必须覆盖有特殊工艺菲票')
assert(tickets.some((ticket) => ticket.specialCrafts.length === 0), 'mock 数据必须覆盖无特殊工艺菲票')
assert(tickets.filter((ticket) => ticket.specialCrafts.length === 1).length >= 3, '至少 3 张菲票包含 1 个特殊工艺')
assert(tickets.filter((ticket) => ticket.specialCrafts.length >= 2).length >= 3, '至少 3 张菲票包含 2 个以上特殊工艺')
for (const position of ['左', '右', '底', '面']) {
  assert(tickets.filter((ticket) => ticket.specialCrafts.some((craft) => craft.craftPositionName === position)).length >= 3, `至少 3 张菲票工艺位置为${position}`)
}

for (const status of ['待打印', '已打印', '已补打', '已作废']) {
  assert(tickets.some((ticket) => ticket.printStatus === status), `mock 数据必须覆盖打印状态：${status}`)
}
for (const status of ['已绑定周转口袋', '已交出']) {
  assert(tickets.some((ticket) => ticket.flowStatus === status), `mock 数据必须覆盖流转状态：${status}`)
}

assert(tickets.some((ticket) => ticket.mergeBatchId && ticket.originalCutPieceOrderId), '合并裁剪批次只能作为执行上下文且必须保留原始裁片单')
assert(!/菲票归属合并裁剪批次|菲票归属为合并裁剪批次|菲票归属.*为.*合并裁剪批次/.test(generationSource + feiTicketPageSource + docSource), '不得出现菲票归属合并裁剪批次的新口径')

const sample = tickets[0]
const qrPayload = JSON.parse(sample.qrCodePayload) as Record<string, unknown>
assert(qrPayload.sourcePieceInstanceId === sample.sourcePieceInstanceId, '二维码 payload 必须包含 sourcePieceInstanceId')
assert(qrPayload.originalCutPieceOrderId === sample.originalCutPieceOrderId, '二维码 payload 必须包含 originalCutPieceOrderId')
assert((qrPayload.specialCrafts as unknown[]).length === sample.specialCrafts.length, '二维码 payload 必须包含特殊工艺')

assert(buildSpecialCraftSummary([]) === '无特殊工艺', '无特殊工艺摘要必须显示“无特殊工艺”')
assert(buildSpecialCraftSummary(sample.specialCrafts).length > 0, '有特殊工艺时必须生成摘要')
assert(buildFeiTicketQrPayload(sample).includes(sample.sourcePieceInstanceId), '二维码构建函数必须写入裁片实例 ID')

const previewSource = listCutPieceFeiTicketGenerationSourceOrders().find((item) => item.pendingCount > 0)
assert(previewSource, '必须存在可演示的未生成原始裁片单')
const preview = previewFeiTicketGeneration(previewSource!.originalCutPieceOrderId)
assert(preview && preview.pendingGenerateCount >= 1, '生成预览必须能识别待生成菲票数量')
assert(preview!.message.includes('本次将生成'), '生成预览必须显示中文数量提示')

const generatedFromFunction = generateFeiTicketsFromPieceInstances({
  techPackVersionId: 'CHECK-V1',
  patternId: 'CHECK-PATTERN',
  pieceInstances: [
    {
      pieceInstanceId: 'CHECK-PIECE-1',
      sourcePieceId: 'CHECK-ROW-1',
      pieceName: '前片',
      sizeName: 'M',
      colorId: 'C-BLK',
      colorName: '黑色',
      sequenceNo: 1,
      displayName: '前片 / 黑色 / 第1片',
      specialCraftAssignments: [
        {
          assignmentId: 'ASSIGN-CHECK-1',
          craftCode: 'AUX_DALAN',
          craftName: '打揽',
          craftPosition: 'LEFT',
          craftPositionName: '左',
        },
      ],
      status: '已配置',
    },
  ],
  originalCutPieceOrderId: 'CHECK-CUT-ORDER',
  originalCutPieceOrderNo: 'CUT-CHECK-001',
  productionOrderId: 'PO-CHECK',
  productionOrderNo: 'PO-CHECK-001',
})
assert(generatedFromFunction.length === 1, '每个 pieceInstance 必须生成一个菲票')
assert(generatedFromFunction[0].specialCrafts[0].sourceAssignmentId === 'ASSIGN-CHECK-1', '菲票必须复制 pieceInstance 的 specialCraftAssignments')

assert(getFeiTicketsNeedSpecialCraft().length > 0, '有特殊工艺菲票必须能查询')
assert(groupFeiTicketsBySpecialCraft().length > 0, '必须能按特殊工艺分组菲票')
const ticketWithCraft = tickets.find((ticket) => ticket.specialCrafts.length > 0)!
assert(getSpecialCraftsFromFeiTicket(ticketWithCraft.feiTicketId).length === ticketWithCraft.specialCrafts.length, '特殊工艺读取函数必须返回菲票工艺')
assert(getFeiTicketSpecialCraftFlowSummary(ticketWithCraft.feiTicketId)?.relatedFeiTicketIds.includes(ticketWithCraft.feiTicketId), '特殊工艺流转摘要必须可追溯 relatedFeiTicketIds')

console.log('fei ticket per piece generation checks passed')
