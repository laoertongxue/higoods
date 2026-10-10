import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { menusBySystem } from '../../src/data/app-shell-config.ts'
import type { MenuItem } from '../../src/data/app-shell-types.ts'

import type { CutPieceReleaseRecord } from '../../src/data/fcs/cut-piece-release.ts'
import { captureCutPieceReleaseState, getCutPieceReleaseMatrix, listCutPieceReleaseRecords, restoreCutPieceReleaseState } from '../../src/data/fcs/cut-piece-release.ts'
import { paginateStandardListRows } from '../../src/components/ui/list-table-model.ts'
import { buildReleaseMatrix, type ReleaseTicketDetail } from '../../src/data/fcs/cut-piece-release-domain.ts'
import { getCutPieceTicketValidity, hydrateCutPieceTicketValidity } from '../../src/data/fcs/cutting/cut-piece-ticket-validity.ts'
import { projectReleaseTicket } from '../../src/data/fcs/cutting/cut-piece-release-facts.ts'
import {
  parseReleaseQuantityInput,
  buildCutPieceTicketValiditySaveInput,
  hasCutPieceReleaseUnsavedChanges,
  isCutPieceReleaseLeavingAction,
  buildCutPieceTicketValidityConfirmation,
  renderCutPieceReleaseAvailableQuantity,
  renderCutPieceReleaseConfirmMatrix,
  renderCutPieceReleaseTargetMatrix,
  renderCutPieceReleaseTicketDetail,
  renderListTable,
  sortReleaseSizeColumns,
} from '../../src/pages/process-factory/cutting/cut-piece-release.ts'

test('列表只读余量查询满足正整数身份门禁，K100/A205显示当前风险105、占用0及余量205', () => {
  listCutPieceReleaseRecords()
  const original = captureCutPieceReleaseState()
  try {
    const fixture = captureCutPieceReleaseState()
    const item = structuredClone([...fixture.releaseRepository.values()].find(row => row.input.productionOrderId === 'po-14671')!)
    const productionOrderId = 'ui-readiness-known'
    item.input.productionOrderId = productionOrderId
    item.input.productionOrderNo = 'UI-READINESS-KNOWN'
    item.input.facts.forEach(fact => { fact.productionOrderId = productionOrderId; fact.factId = `UI:${fact.factId}` })
    const firstTicket = item.input.facts.find(fact => fact.garmentColor === 'Black' && fact.size === 'M' && fact.materialId === 'A')!
    firstTicket.actualPieceQty = 0
    firstTicket.physicalPieceQty = 0
    if (firstTicket.ticketDetail) {
      firstTicket.ticketDetail.validity = '不可用'
      firstTicket.ticketDetail.physicalPieceQty = 0
      firstTicket.ticketDetail.eligiblePieceQty = 0
    }
    item.currentMatrix = buildReleaseMatrix(item.input)
    fixture.releaseRepository.set(productionOrderId, item)
    const decisions = structuredClone(fixture.releaseVersionRepository.get('po-14671')!)
    decisions.forEach(version => { version.productionOrderId = productionOrderId })
    decisions.at(-1)!.releaseQtyByColorSize['Black::M'] = 205
    fixture.releaseVersionRepository.set(productionOrderId, decisions)
    restoreCutPieceReleaseState(fixture)
    const record = listCutPieceReleaseRecords().find(row => row.productionOrderId === productionOrderId)!
    assert.equal(record.matrix.colorGroups.find(group => group.garmentColor === 'Black')!.completeKitBySize.M, 100)
    const row = { ...record, skuLines: record.skuLines.filter(line => line.colorName === 'Black' && line.sizeCode === 'M') }
    const html = renderListTable(paginateStandardListRows([row], 1, 10))
    const keys = [...new Set([...html.matchAll(/data-column-key="([^"]+)"/g)].map(match => match[1]))]
    const cells = [...(html.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0] ?? '').matchAll(/<td\s[^>]*>([\s\S]*?)<\/td>/g)].map(match => match[1].replace(/<[^>]+>/g, '').trim())
    const cellText = (key: string) => cells[keys.indexOf(key)]
    assert.equal(cellText('riskQty'), '105 件')
    assert.equal(cellText('allocatedQty'), '0 件')
    assert.equal(cellText('availableQty'), '205 件')
    const unknown = listCutPieceReleaseRecords().find(row => row.productionOrderId === 'po-14674')!
    assert.match(renderListTable(paginateStandardListRows([unknown], 1, 10)), /待核对/)
  } finally { restoreCutPieceReleaseState(original) }
})

test('裁片放行保留唯一菜单键和地址，归属裁床仓库管理', () => {
  const matches: Array<{ item: MenuItem; ancestors: string[] }> = []
  const walk = (items: MenuItem[], ancestors: string[]) => items.forEach(item => {
    if (item.key === 'pfos-cutting-cut-piece-release') matches.push({ item, ancestors })
    if (item.children) walk(item.children, [...ancestors, item.title])
  })
  Object.values(menusBySystem).forEach(groups => groups.forEach(group => walk(group.items, [group.title])))
  assert.equal(matches.length, 1)
  assert.equal(matches[0].item.href, '/fcs/craft/cutting/cut-piece-release')
  assert.equal(matches[0].ancestors.at(-1), '裁床仓库管理')
  assert.ok(!matches[0].ancestors.includes('裁后处理'))
})

// PAGE-001..004: test rendered two-dimensional coordinates and the actual input parser.
test('字母与数值尺码升序，自定义尺码保留配置顺序', () => {
  assert.deepEqual(sortReleaseSizeColumns(['XL', 'M', 'L', 'S', 'XS', '3XL', '2XL']), ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'])
  assert.deepEqual(sortReleaseSizeColumns(['42', '8', '36', '10']), ['8', '10', '36', '42'])
  assert.deepEqual(sortReleaseSizeColumns(['定制乙', '定制甲', '定制乙']), ['定制乙', '定制甲'])
})

test('非法数量和空白保持非法，不夹取或四舍五入成另一个有效量', () => {
  for (const input of ['', ' ', '-1', '1.5', 'NaN', 'Infinity', '1e2', '9007199254740992']) {
    assert.equal(parseReleaseQuantityInput(input), null, input)
  }
  assert.equal(parseReleaseQuantityInput('0'), 0)
  assert.equal(parseReleaseQuantityInput('90'), 90)
  assert.equal(parseReleaseQuantityInput('9007199254740991'), Number.MAX_SAFE_INTEGER)
})

test('目标确认待保存及整票原因也受离开提醒保护，已保存目标和空白原因不误提醒', () => {
  const saved = { targetMode: '确认' as const, targetDraft: { 'Black::M': 208 }, savedTargets: { 'Black::M': 208 }, releaseEditing: false, releaseDraft: {}, validityReasons: {}, saving: false }
  assert.equal(hasCutPieceReleaseUnsavedChanges(saved), false)
  assert.equal(hasCutPieceReleaseUnsavedChanges({ ...saved, targetDraft: { 'Black::M': 220 } }), true)
  assert.equal(hasCutPieceReleaseUnsavedChanges({ ...saved, savedTargets: null }), true)
  assert.equal(hasCutPieceReleaseUnsavedChanges({ ...saved, validityReasons: { 'UI-TICKET': '登记原因未保存' } }), true)
  assert.equal(hasCutPieceReleaseUnsavedChanges({ ...saved, validityReasons: { 'UI-TICKET': '  ' } }), false)
  assert.equal(hasCutPieceReleaseUnsavedChanges({ ...saved, releaseEditing: true, releaseDraft: { 'Black::M': '209' } }), true)
  assert.equal(hasCutPieceReleaseUnsavedChanges({ ...saved, releaseDraft: { 'Black::M': '209' } }), true)
  assert.equal(hasCutPieceReleaseUnsavedChanges({ ...saved, riskReasonDraft: '维持放行待保存原因' }), true)
  assert.equal(hasCutPieceReleaseUnsavedChanges({ ...saved, saving: true }), true)
})

test('本页导航、补料、系统与当前页签退出统一提醒，关闭其他页签和折叠菜单不误提醒', () => {
  const current = { pathname: '/fcs/craft/cutting/cut-piece-release?productionOrderId=po-14671', allTabs: {
    pfos: { systemId: 'pfos', activeKey: 'release', tabs: [
      { key: 'release', href: '/fcs/craft/cutting/cut-piece-release', title: '裁片放行', closable: true },
      { key: 'other', href: '/fcs/craft/cutting/wait-handover', title: '待交出仓', closable: true },
    ] },
  } }
  const leaves = (dataset: Record<string, string>) => isCutPieceReleaseLeavingAction({ dataset }, current)
  assert.equal(leaves({ nav: '/fcs/craft/cutting/cut-piece-release' }), true)
  assert.equal(leaves({ nav: current.pathname }), false)
  assert.equal(leaves({ cutPieceReleaseAction: 'go-supplement' }), true)
  assert.equal(leaves({ action: 'switch-system', systemId: 'wls' }), true)
  assert.equal(leaves({ action: 'open-tab', tabHref: '/fcs/craft/cutting/wait-handover' }), true)
  assert.equal(leaves({ action: 'activate-tab', tabKey: 'other' }), true)
  assert.equal(leaves({ action: 'close-tab', tabKey: 'release' }), true)
  assert.equal(leaves({ action: 'close-all-tabs' }), true)
  for (const dataset of [{ action: 'close-tab', tabKey: 'other' }, { action: 'toggle-menu-group' }, { action: 'toggle-sidebar-collapsed' }, { cutPieceReleaseAction: 'open-image' }]) assert.equal(leaves(dataset), false)
})

function matrixRecord(): CutPieceReleaseRecord {
  return {
    recordId: 'UI-RECORD', recordNo: 'UI-RECORD', productionOrderId: 'UI-PO', productionOrderNo: 'UI-PO', taskId: '', taskNo: '',
    spuCode: 'UI-SPU', spuName: '测试成衣', triggerCutOrderNo: '', sourceCutOrderNos: [], triggerAction: '', triggerAt: '', triggerOperator: '',
    checkerRole: '', decision: '待判断', releaseQty: 0, releaseConfirmQty: 0, reason: '', riskNote: '', judgedBy: '', judgedAt: '',
    skuLines: [
      { lineId: 'B-M', skuCode: 'B-M', colorName: 'Black', sizeCode: 'M', demandQty: 100, remainingQty: 100, cutCompletedQty: 100, completeKitQty: 90, accessoryReadyQty: 0, releaseQty: 0, releaseConfirmQty: 0, riskReleaseQty: 0, reason: '' },
      { lineId: 'B-S', skuCode: 'B-S', colorName: 'Black', sizeCode: 'S', demandQty: 0, remainingQty: 0, cutCompletedQty: 0, completeKitQty: 0, accessoryReadyQty: 0, releaseQty: 0, releaseConfirmQty: 0, riskReleaseQty: 0, reason: '' },
      { lineId: 'W-M', skuCode: 'W-M', colorName: 'White', sizeCode: 'M', demandQty: 50, remainingQty: 50, cutCompletedQty: 50, completeKitQty: 50, accessoryReadyQty: 0, releaseQty: 0, releaseConfirmQty: 0, riskReleaseQty: 0, reason: '' },
    ],
    matrixStatus: '可计算', targetStatus: '待确认', frozenCutOrderCount: 0, shortageCellCount: 0, latestUpdateAt: '', lateEventCount: 0, sourceStates: [],
    releaseAvailableStatus: '待维护目标', latestReleaseVersion: 0, riskReleaseQty: 0, totalTargetQty: 0,
    requiresReview: false, factChangeMessage: '', historicalRiskReleaseQty: 0,
    matrix: { productionOrderId: 'UI-PO', productionOrderNo: 'UI-PO', spuCode: 'UI-SPU', calculationStatus: '可计算', targetStatus: '待确认', colorGroups: [
      { garmentColor: 'Black', sizes: ['M', 'S'], planQtyBySize: { M: 100, S: 0 }, materialRows: [], completeKitBySize: { M: 90, S: 0 } },
      { garmentColor: 'White', sizes: ['M'], planQtyBySize: { M: 50 }, materialRows: [], completeKitBySize: { M: 50 } },
    ] },
  }
}

test('未知自定义尺码在目标和放行矩阵明确提示待核对且保留原序，标准尺码不出现提示', () => {
  const renderers = [renderCutPieceReleaseTargetMatrix, renderCutPieceReleaseConfirmMatrix]
  for (const render of renderers) {
    assert.doesNotMatch(render(matrixRecord()), /data-release-size-order-warning|尺码顺序待核对/)
    const record = matrixRecord()
    record.matrix.colorGroups = [{
      garmentColor: 'Black', sizes: ['定制乙', '定制甲'], planQtyBySize: { 定制乙: 100, 定制甲: 50 },
      materialRows: [], completeKitBySize: { 定制乙: 90, 定制甲: 50 },
    }]
    const html = render(record)
    const head = html.match(/<thead[\s\S]*?<\/thead>/)?.[0] ?? ''
    assert.ok(head.indexOf('>定制乙</th>') < head.indexOf('>定制甲</th>'))
    assert.match(html, /data-release-size-order-warning>尺码顺序待核对，暂按配置展示<\/p>/)
  }
})

test('未确认与确认零放行分开，零放行不回退成目标281件', () => {
  const record = matrixRecord()
  record.releaseQty = 281
  record.totalTargetQty = 281
  assert.match(renderCutPieceReleaseAvailableQuantity(record), /未确认/)
  record.latestReleaseVersion = 1
  record.releaseAvailableStatus = '暂不放行'
  const html = renderCutPieceReleaseAvailableQuantity(record)
  assert.match(html, />0 件</)
  assert.doesNotMatch(html, /281|未确认/)
})

test('尚未确认且齐套未知时，确认汇总中的K和R均显示待核对而非零', () => {
  const record = matrixRecord()
  record.matrix.colorGroups[0].completeKitBySize.M = null
  const html = renderCutPieceReleaseConfirmMatrix(record)
  const summary = html.match(/data-cut-piece-release-confirm-summary-region>([\s\S]*?)<\/div>/)?.[1] ?? ''
  assert.match(summary, /当前齐套：<span[^>]*>待核对<\/span>/)
  assert.match(summary, /当前风险：<span[^>]*>待核对<\/span>/)
  assert.doesNotMatch(summary, /0 件/)
})

test('目标与放行渲染为相同颜色行、尺码升序列，缺失SKU格保持不可编辑', () => {
  const record = matrixRecord()
  for (const html of [renderCutPieceReleaseTargetMatrix(record), renderCutPieceReleaseConfirmMatrix(record)]) {
    const head = html.match(/<thead[\s\S]*?<\/thead>/)?.[0] ?? ''
    assert.ok(head.indexOf('>S</th>') < head.indexOf('>M</th>'))
    assert.match(html, /scope="row"[^>]*>Black<\/th>/)
    assert.match(html, /scope="row"[^>]*>White<\/th>/)
    assert.match(html, /无此色码/)
    assert.doesNotMatch(html, /data-release-color="White"[^>]*data-release-size="S"/)
  }
  const target = renderCutPieceReleaseTargetMatrix(record)
  assert.doesNotMatch(target, /<input/)
  assert.match(target, /当前齐套 0 件/)
})

function craftTicket(): ReleaseTicketDetail {
  return {
    ticketId: 'TICKET-1', ticketNo: 'TI-1', sourceType: '手动唛架', sourceNo: 'MARKER-1', cutOrderNo: 'CUT-1', garmentColor: 'Black', size: 'M',
    fabricColor: '深蓝', materialId: 'FABRIC-1', materialName: '面料一', partId: 'FRONT', partName: '前片', printedPieceQty: 100, physicalPieceQty: 90,
    eligiblePieceQty: 90, validity: '可用', bagCode: 'BAG-1', bagUseId: 'BAG-CYCLE-2', locationLabel: '裁床待交出仓 A-1', requiresSpecialCraft: true,
    craftRequirementKnown: true, returnedAt: '2026-10-09 10:00', returnedBy: '仓管甲', receiptId: 'RECEIPT-2', differenceReason: '最终工艺少回10片',
    craftSteps: [
      { sequence: 1, craftId: 'PRINT', craftName: '烫画', craftType: '辅助工艺', factoryName: '工厂甲', expectedQty: 100, processedQty: 100, handedOverQty: 100, returnedQty: 100, status: '已回仓', receiptId: 'RECEIPT-1' },
      { sequence: 2, craftId: 'EMBROIDERY', craftName: '绣花', craftType: '特种工艺', factoryName: '工厂乙', expectedQty: 100, processedQty: 100, handedOverQty: 100, returnedQty: 90, status: '已回仓', receiptId: 'RECEIPT-2' },
    ],
  }
}

test('逐票详情保留最终回仓实收、完整顺序、袋周期、成衣色与面料色以及差异', () => {
  const html = renderCutPieceReleaseTicketDetail(craftTicket())
  assert.match(html, /第 1 \/ 2 道 · 烫画/)
  assert.match(html, /第 2 \/ 2 道 · 绣花 · 特种工艺 · 最终工艺/)
  assert.match(html, /实际实收 90 片/)
  assert.match(html, /当前可计入 90 片/)
  assert.match(html, /RECEIPT-2/)
  assert.match(html, /BAG-CYCLE-2/)
  assert.match(html, /成衣 Black \/ M · 面料色 深蓝/)
  assert.match(html, /最终工艺少回10片/)
})

test('侧栏逐道显示真实交出单、回仓业务号和库位，记录编号放在展开依据中', () => {
  const ticket = craftTicket()
  Object.assign(ticket.craftSteps[1], { receiptNo:'RC-20261009-001',sourceHandoverNo:'HO-20261009-001',returnLocationLabel:'A区 / A-R01 / A-R01-L01-P03' })
  const html = renderCutPieceReleaseTicketDetail(ticket)
  assert.match(html, /交出单 HO-20261009-001/)
  assert.match(html, /回仓记录 RC-20261009-001 · 回仓位置 A区 \/ A-R01 \/ A-R01-L01-P03/)
  assert.match(html, /<summary[^>]*>查看记录编号<\/summary><p[^>]*>RECEIPT-2<\/p>/)
  assert.doesNotMatch(html, /最终回仓凭据/)
})

test('加工完成未回仓仍显示未最终回仓，未知工艺不展示普通免工艺依据', () => {
  const waiting = craftTicket()
  waiting.craftSteps[1].returnedQty = null
  waiting.eligiblePieceQty = 0
  const html = renderCutPieceReleaseTicketDetail(waiting)
  assert.match(html, /待回仓/)
  assert.match(html, /实际实收 尚未回仓/)
  assert.match(html, /当前可计入 0 片/)
  assert.match(html, /尚未完成全部工艺及最终回仓/)
  const unknown = { ...waiting, requiresSpecialCraft: false, craftRequirementKnown: false, craftSteps: [] }
  const unknownHtml = renderCutPieceReleaseTicketDetail(unknown)
  assert.match(unknownHtml, /部位工艺要求待核对/)
  assert.doesNotMatch(unknownHtml, /普通有效装袋量按部位单耗/)
})

test('真实前道直转投影接入侧栏，末道实收80显示已最终回仓', () => {
  const ticket: any = {feiTicketId:'DIRECT-UI',feiTicketNo:'FT-DIRECT-UI',actualCutPieceQty:100,qty:100,printStatus:'PRINTED',hasSpecialCraft:true,partCode:'FRONT',partName:'前片',garmentColor:'Black',skuSize:'M',fabricColor:'蓝',cutOrderNo:'CUT-DIRECT',sourceBasisType:'ACTUAL_CUTTING_OUTPUT',specialCrafts:[1,2].map(stage=>({specialCraftId:`DIRECT-${stage}`,craftName:stage===1?'烫画':'绣花',craftCategory:stage===1?'辅助工艺':'特种工艺',receiverFactoryId:`F${stage}`,receiverFactoryName:`工厂${stage}`}))}
  const detail = projectReleaseTicket({ticket,materialId:'FAB-DIRECT',materialName:'主面料',bag:{ticketId:ticket.feiTicketId,bagCode:'BAG-DIRECT',eventId:'PACK-DIRECT',at:'2026-10-09T01:00:00Z',operator:'仓管',locationLabel:'A区'},craftRequirementKnown:true,receipts:[{feiTicketId:ticket.feiTicketId,specialCraftId:'DIRECT-2',receiverFactoryId:'F2',returnedQty:80,processingCompleted:true,returnedAt:'2026-10-09T03:00:00Z',returnedBy:'仓管',eventId:'RC-DIRECT-2'} as any],completions:[{feiTicketId:ticket.feiTicketId,specialCraftId:'DIRECT-1',receiverFactoryId:'F1',returnedQty:90,processingCompleted:true,returnedAt:'2026-10-09T02:00:00Z'} as any]})
  assert.equal(detail.craftSteps[0].status,'已交下一工艺')
  assert.equal(detail.eligiblePieceQty,80)
  assert.match(renderCutPieceReleaseTicketDetail(detail),/>已最终回仓</)
})

test('跨工厂直转前道不必回裁床，最终实收80片显示已最终回仓', () => {
  const ticket = craftTicket()
  ticket.craftSteps[0].returnedQty = null
  ticket.craftSteps[0].status = '完成待转工艺'
  ticket.craftSteps[1].returnedQty = 80
  ticket.eligiblePieceQty = 80
  const html = renderCutPieceReleaseTicketDetail(ticket)
  assert.match(html, />已最终回仓</)
  assert.match(html, /当前可计入 80 片/)
  assert.match(html, /依据：最终工艺实际实收/)
  assert.doesNotMatch(html, /原因：尚未完成全部工艺及最终回仓/)
})

test('最终实际点收0片保留完成事实，不显示待加工或待回仓', () => {
  const ticket = craftTicket()
  ticket.craftSteps[0].returnedQty = null
  ticket.craftSteps[0].status = '加工完成待回仓'
  ticket.craftSteps[1].returnedQty = 0
  ticket.eligiblePieceQty = 0
  const html = renderCutPieceReleaseTicketDetail(ticket)
  assert.match(html, />已最终回仓</)
  assert.match(html, /实际实收 0 片/)
  assert.match(html, /当前可计入 0 片/)
  assert.match(html, /依据：最终工艺实际实收/)
})

test('历史实收有原始回仓数量但缺加工完成依据，明细保留实收且暂不计齐套', () => {
  const ticket = craftTicket()
  ticket.completionEvidenceKnown = false
  ticket.eligiblePieceQty = 0
  ticket.craftSteps[1].status = '已实收，加工完成待核对'
  const html = renderCutPieceReleaseTicketDetail(ticket)
  assert.match(html, />待核对</)
  assert.match(html, /实际实收 90 片/)
  assert.match(html, /RECEIPT-2/)
  assert.match(html, /第 2 \/ 2 道 · 绣花/)
  assert.match(html, /当前可计入 0 片/)
  assert.match(html, /已实收，加工完成依据待核对，暂不计齐套/)
  assert.doesNotMatch(html, />已最终回仓</)
})

test('整票更正确认同时展示票袋工艺放行分配及保留历史责任', () => {
  const text = buildCutPieceTicketValidityConfirmation(craftTicket(), matrixRecord(), false)
  for (const expected of ['TI-1', 'BAG-1', 'BAG-CYCLE-2', '第 1 道 烫画', '第 2 道 绣花', '有效放行', '已分配', '不会自动取消', '历史实交、实收记录保留', 'PPIC']) assert.ok(text.includes(expected), expected)
  assert.match(buildCutPieceTicketValidityConfirmation(craftTicket(), matrixRecord(), true), /恢复前请核对已有工艺、回仓和分配记录/)
})

test('整票登记保存携带打开详情时的版本，旧页面不会改用后来读到的版本', () => {
  const ticket = { ...craftTicket(), ticketId: 'UI-STALE-VALIDITY' }
  const hydrateVersion = (version: number) => hydrateCutPieceTicketValidity({ revision: version, records: [{
    id: `UI-VALIDITY-V${version}`, collection: 'cut-piece-ticket-validity',
    value: { id: `UI-VALIDITY-V${version}`, ticketId: ticket.ticketId, valid: true, reason: '测试整票登记', operator: '测试仓管', at: '2026-10-09T10:00:00Z', version },
  }] })
  const openedButton = () => {
    const button = renderCutPieceReleaseTicketDetail(ticket).match(/<button[^>]+data-cut-piece-release-action="set-ticket-validity"[^>]*>/)?.[0] ?? ''
    assert.ok(button)
    return { dataset: {
      ticketId: ticket.ticketId, ticketValid: 'false',
      ticketValidityVersion: button.match(/data-ticket-validity-version="(\d+)"/)?.[1],
    } }
  }
  try {
    hydrateCutPieceTicketValidity({ revision: 0, records: [] })
    const initialButton = openedButton()
    hydrateVersion(1)
    assert.equal(buildCutPieceTicketValiditySaveInput(initialButton, '旧页原因')?.expectedVersion, 0)
    hydrateVersion(5)
    const staleButton = openedButton()
    hydrateVersion(6)
    assert.equal(getCutPieceTicketValidity(ticket.ticketId)?.version, 6)
    assert.deepEqual(buildCutPieceTicketValiditySaveInput(staleButton, '保留输入'), {
      ticketId: ticket.ticketId, valid: false, reason: '保留输入', operator: '裁床仓管 Siti', expectedVersion: 5,
    })
    assert.equal(buildCutPieceTicketValiditySaveInput(openedButton(), '重新核对')?.expectedVersion, 6)
    for (const value of [undefined, '', '-1', '1.5', '9007199254740992']) {
      assert.equal(buildCutPieceTicketValiditySaveInput({ dataset: { ticketValidityVersion: value } }, '原因'), null)
    }
  } finally { hydrateCutPieceTicketValidity({ revision: 0, records: [] }) }
})

test('文案采用短句，目标和放行保留操作边界，整票确认保留实际后果', () => {
  const record = matrixRecord()
  const target = renderCutPieceReleaseTargetMatrix(record)
  const release = renderCutPieceReleaseConfirmMatrix(record)
  assert.doesNotMatch(target, /目标只能取自|输入不自动修正|版本快照|事实依据/)
  assert.match(release, /放行量不得低于已分配量或高于目标。/)
  assert.match(release, /先保存目标，再确认放行。/)
  assert.match(release, /当前齐套：/)
  assert.doesNotMatch(release, /系统齐套：|确认后才保存|当前事实/)
  const confirmation = buildCutPieceTicketValidityConfirmation(craftTicket(), record, false)
  assert.match(confirmation, /保存后更新齐套和当前风险。/)
  assert.match(confirmation, /原目标、放行量和已分配量不变。/)
  assert.match(confirmation, /已有工艺任务不会自动取消，历史实交、实收记录保留。/)
  assert.doesNotMatch(confirmation, /数量事实更正|审批|版本快照/)
})

test('具名静态演示材料使用既有真实图片，三道工艺仅按最终回仓计入', () => {
  const imageUrls = getCutPieceReleaseMatrix('po-14671')?.colorGroups[0].materialRows.map(row => row.materialImageUrl)
  assert.deepEqual(imageUrls, ['/materials/fabric-main.jpg', '/materials/fabric-contrast.jpg', '/materials/fabric-lining.jpg', '/materials/accessory-label.jpg'])
  const row = getCutPieceReleaseMatrix('po-14677')?.colorGroups.find(group => group.garmentColor === '松石绿')?.materialRows.find(material => material.materialId === 'FAB')
  assert.ok(row)
  const pending = row.cells.find(cell => cell.size === 'M')!
  assert.equal(pending.physicalGarmentQty, 68)
  assert.equal(pending.availableGarmentQty, 0)
  assert.equal(pending.specialCraftRequiredPieceQty, 70)
  assert.equal(pending.specialCraftCompletedPieceQty, 0)
  assert.equal(pending.specialCraftAwaitingReturnPieceQty, 68)
  assert.equal(pending.specialCraftDifferencePieceQty, 2)
  assert.equal(pending.partCalculations[0].ticketDetails[0].craftSteps.length, 3)
  assert.match(renderCutPieceReleaseTicketDetail(pending.partCalculations[0].ticketDetails[0]), />待回仓</)
  const returned = row.cells.find(cell => cell.size === 'L')!
  assert.equal(returned.physicalGarmentQty, 87)
  assert.equal(returned.availableGarmentQty, 87)
  assert.equal(returned.specialCraftRequiredPieceQty, 90)
  assert.equal(returned.specialCraftCompletedPieceQty, 87)
  assert.equal(returned.specialCraftDifferencePieceQty, 3)
  assert.equal(returned.partCalculations[0].ticketDetails[0].receiptId, 'DEMO-RECEIPT-14677-L-3')
})

test('示例内部身份只在追溯展开中显示，真实票号完整保留且确认仍显示实际影响', () => {
  const ticket = { ...craftTicket(), ticketId: 'DEMO-TICKET:spread-14677-01-松石绿-FAB-L',
    ticketNo: 'FT-DEMO:spread-14677-01-松石绿-FAB-L', bagCode: 'BAG-DEMO:spread-14677-01-松石绿-FAB-L',
    bagUseId: 'USE-DEMO:spread-14677-01-松石绿-FAB-L', sourceNo: 'PB-14677-01', spreadingOrderNo: 'PB-14677-01' }
  const original = structuredClone(ticket)
  const html = renderCutPieceReleaseTicketDetail(ticket)
  const visibleText = html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, '').replace(/<[^>]+>/g, '')
  assert.match(visibleText, /示例菲票 001/)
  assert.match(visibleText, /示例中转袋 001/)
  assert.doesNotMatch(visibleText, /FT-DEMO:|BAG-DEMO:|USE-DEMO:/)
  for (const identity of [ticket.ticketNo, ticket.bagCode, ticket.bagUseId]) assert.ok(html.includes(identity))
  const confirmation = buildCutPieceTicketValidityConfirmation(ticket, matrixRecord(), false)
  assert.match(confirmation, /示例菲票 001/)
  assert.match(confirmation, /示例中转袋 001/)
  assert.doesNotMatch(confirmation, /FT-DEMO:|BAG-DEMO:|USE-DEMO:|凭据 RECEIPT-/)
  assert.match(confirmation, /历史实交、实收记录保留/)
  assert.deepEqual(ticket, original)
  const actual = { ...ticket, ticketNo: 'FT20261009-000127', bagCode: 'BG20261009-0031', bagUseId: 'BG20261009-0031-CYCLE-09' }
  for (const identity of [actual.ticketNo, actual.bagCode, actual.bagUseId]) {
    assert.ok(renderCutPieceReleaseTicketDetail(actual).includes(identity))
    assert.ok(buildCutPieceTicketValidityConfirmation(actual, matrixRecord(), false).includes(identity))
  }
})


test('真实生成的工艺记录内部UUID只在展开中显示，不替换真实业务号', () => {
  const ticket = { ...craftTicket(), bagUseId: 'cycle:BAG-1:20261009233016' }, raw = '特殊工艺回仓-SPECIAL-HR-special-craft-handover:123e4567-e89b-12d3-a456-426614174000'
  Object.assign(ticket.craftSteps[1], { receiptNo: raw, sourceHandoverNo:'SPECIAL-HR-special-craft-handover:123e4567-e89b-12d3-a456-426614174001', returnLocationLabel:'A区 / A-R01-L01-P03' })
  const html = renderCutPieceReleaseTicketDetail(ticket)
  const visible = html.replace(/<details\b[\s\S]*?<\/details>/g, '')
  assert.doesNotMatch(visible, /SPECIAL-HR|special-craft-handover:|123e4567/)
  assert.match(visible, /实际实收 90 片/)
  assert.match(visible, /回仓位置 A区 \/ A-R01-L01-P03/)
  assert.match(html, /原回仓记录[^<]*SPECIAL-HR-special-craft-handover:/)
  assert.match(html, /原交出记录[^<]*SPECIAL-HR-special-craft-handover:/)
  const confirmation = buildCutPieceTicketValidityConfirmation(ticket, matrixRecord(), false)
  assert.doesNotMatch(confirmation, /SPECIAL-HR|special-craft-handover:|cycle:BAG/)
  assert.match(confirmation, /受影响袋：BAG-1/)
  assert.ok(html.includes(ticket.bagUseId))
})

test('PAGE-008 每张静态放行记录绑定对应款式实图，列表与款号同格并保留大图动作', () => {
  const records = listCutPieceReleaseRecords()
  assert.ok(records.length >= 9)
  for (const record of records) {
    assert.ok(record.styleImageUrl?.startsWith('/'), `${record.productionOrderNo} 缺少对应款式图片`)
    assert.ok(!/placeholder|data:image/.test(record.styleImageUrl!))
    const html = renderListTable(paginateStandardListRows([record], 1, 10))
    assert.ok(html.includes(`data-testid="list-style-image-${record.recordId}"`), `${record.productionOrderNo} 列表款式图必须支持大图`)
    assert.ok(html.includes(`src="${record.styleImageUrl}"`))
    assert.ok(html.includes(record.spuCode) && html.includes(record.spuName))
  }
  assert.equal(records.find(r => r.productionOrderId === 'po-14671')!.styleImageUrl, '/materials/pcs-reviewed/tee-black.jpg')
  assert.equal(records.find(r => r.productionOrderId === 'po-14675')!.styleImageUrl, '/materials/cut-piece-release/girl-ruffle-pink.jpg')
})

test('PAGE-008 每个静态示例的必需物料均绑定对应实物图，资料缺失示例也保留图片', () => {
  const records = listCutPieceReleaseRecords()
  for (const record of records) {
    const rows = record.matrix.colorGroups.flatMap(group => group.materialRows)
    assert.ok(rows.length > 0, `${record.productionOrderNo} 缺少物料行`)
    for (const row of rows) {
      assert.ok(row.materialImageUrl?.startsWith('/materials/'), `${record.productionOrderNo} / ${row.materialName} 缺少实物图`)
      assert.doesNotMatch(row.materialImageUrl!, /placeholder|data:image/)
    }
  }
})

test('仓库轻量事件入口保留原库位维护委派，其他业务动作沿用仓库处理器', async () => {
  const main = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8')
  const start = main.indexOf("  if (pagePath === '/fcs/craft/cutting/warehouse-management/wait-handover') {")
  const end = main.indexOf("  if (pagePath === '/fcs/contracts/print') {", start)
  assert.ok(start >= 0 && end > start)
  const body = main.slice(start, end).replace(/await import\(([^)]+)\)/g, 'await load($1)')
  const dispatch = new Function('pagePath', 'eventTarget', 'event', 'load', `return (async () => {${body}})()`)
  const nativeEvent = { type: 'click' }
  const calls: unknown[][] = []
  const load = async (path: string) => {
    assert.doesNotMatch(path, /fcs-handlers/)
    return {
      handleCuttingWarehouseLocationMapEvent: (...args: unknown[]) => { calls.push(['map', ...args]); return true },
      handleCraftCuttingWaitHandoverEvent: (...args: unknown[]) => { calls.push(['business', ...args]); return true },
    }
  }
  const mapTarget = { closest: (selector: string) => selector === '[data-warehouse-map-action]' }
  const businessTarget = { closest: () => null }
  const path = '/fcs/craft/cutting/warehouse-management/wait-handover'
  assert.equal(await dispatch(path, mapTarget, nativeEvent, load), true)
  assert.deepEqual(calls.shift(), ['map', mapTarget, nativeEvent])
  assert.equal(await dispatch(path, businessTarget, nativeEvent, load), true)
  assert.deepEqual(calls.shift(), ['business', businessTarget])
  assert.equal(calls.length, 0)
})
