import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function abs(rel: string): string {
  return path.join(root, rel)
}

function read(rel: string): string {
  return fs.readFileSync(abs(rel), 'utf8')
}

function ensureFile(rel: string, errors: string[]): void {
  if (!fs.existsSync(abs(rel))) errors.push(`缺少文件：${rel}`)
}

function ensureAbsentFile(rel: string, errors: string[]): void {
  if (fs.existsSync(abs(rel))) errors.push(`旧 PDA writeback 文件仍未退场：${rel}`)
}

function checkContains(rel: string, pattern: string | RegExp, errors: string[], message: string): void {
  if (!fs.existsSync(abs(rel))) {
    errors.push(`检查目标文件不存在：${rel}`)
    return
  }
  const content = read(rel)
  const matched = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content)
  if (!matched) errors.push(`${message} [${rel}]`)
}

function checkAbsent(rel: string, pattern: string | RegExp, errors: string[], message: string): void {
  if (!fs.existsSync(abs(rel))) {
    errors.push(`检查目标文件不存在：${rel}`)
    return
  }
  const content = read(rel)
  const matched = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content)
  if (matched) errors.push(`${message} [${rel}]`)
}

function walkSourceFiles(dirRel: string): string[] {
  const dir = abs(dirRel)
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name)
    const rel = path.relative(root, full)
    if (entry.isDirectory()) return walkSourceFiles(rel)
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [rel] : []
  })
}

function checkNoLegacyBridgeReferences(errors: string[]): void {
  const forbidden = [
    'writePdaPickupToFcs',
    'writePdaSpreadingToFcs',
    'writePdaInboundToFcs',
    'writePdaHandoverToFcs',
    'writePdaReplenishmentFeedbackToFcs',
    'pda-cutting-writeback-inputs',
    'pda-execution-writeback-ledger',
    'pda-spreading-writeback',
    'pda-execution-writeback-model',
    'pda-writeback-model',
  ]
  const sourceFiles = [
    ...walkSourceFiles('src/pages'),
    ...walkSourceFiles('src/data'),
    ...walkSourceFiles('src/domain'),
  ]
  sourceFiles.forEach((file) => {
    const content = read(file)
    forbidden.forEach((needle) => {
      if (content.includes(needle)) {
        errors.push(`正式源码仍引用旧 PDA writeback 口径：${needle} [${file}]`)
      }
    })
  })
}

function main(): void {
  const errors: string[] = []

  const requiredFiles = [
    'src/data/fcs/cutting/cutting-runtime-event-ledger.ts',
    'src/data/fcs/pda-cutting-execution-source.ts',
    'src/data/fcs/pda-cutting-runtime-action-inputs.ts',
    'src/pages/pda-cutting-task-detail.ts',
    'src/pages/pda-warehouse-wait-process.ts',
    'src/pages/pda-cutting-spreading.ts',
    'src/pages/pda-cutting-inbound.ts',
    'src/pages/pda-cutting-handover.ts',
    'src/pages/pda-cutting-replenishment-feedback.ts',
    'src/pages/pda-cutting-task-projection.ts',
    'src/pages/pda-cutting-spreading-projection.ts',
    'src/pages/pda-cutting-inbound-projection.ts',
    'src/pages/pda-cutting-handover-projection.ts',
    'src/pages/pda-cutting-replenishment-projection.ts',
    'src/pages/process-factory/cutting/wait-handover-runtime.ts',
  ]
  requiredFiles.forEach((file) => ensureFile(file, errors))

  const retiredFiles = [
    'src/pages/pda-cutting-pickup.ts',
    'src/pages/pda-cutting-pickup-projection.ts',
    'src/data/fcs/pda-cutting-writeback-inputs.ts',
    'src/data/fcs/cutting/pda-execution-writeback-ledger.ts',
    'src/data/fcs/cutting/pda-spreading-writeback.ts',
    'src/domain/cutting-pda-writeback/bridge.ts',
    'src/data/fcs/pda-cutting-special.ts',
    'src/pages/process-factory/cutting/pda-execution-writeback-model.ts',
    'src/pages/process-factory/cutting/pda-writeback-model.ts',
  ]
  retiredFiles.forEach((file) => ensureAbsentFile(file, errors))

  checkNoLegacyBridgeReferences(errors)

  const eventLedger = 'src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
  ;[
    'export type CuttingRuntimeEventType',
    'export interface CuttingRuntimeEvent',
    'export function appendCuttingRuntimeEvent',
    'export function listCuttingRuntimeEvents',
    'export function listCuttingRuntimeEventsByType',
    'export function listCuttingRuntimeEventsByInventoryScope',
    'export function listRuntimePdaExecutionEventProjections',
    'PdaRuntimeEventProjectionBase',
    'PdaPickupEventRecord',
    'PdaCutPieceInboundEventRecord',
    'PdaCutPieceHandoverEventRecord',
    'PdaReplenishmentFeedbackEventRecord',
  ].forEach((needle) => {
    checkContains(eventLedger, needle, errors, `统一事件账缺少导出或投影：${needle}`)
  })

  ;[
    '中转仓配料完成通知',
    '中转仓领料',
    '待加工仓扫码入仓',
    '待加工仓加工领料',
    '待加工仓回收入仓',
    '裁片单开工',
    '开始铺布',
    '完成铺布',
    '开始裁剪',
    '完成裁剪',
    '菲票入仓暂存',
    '交出装袋确认',
    '新增交出记录',
    '特殊工艺交出',
    '特殊工艺回仓',
    '补料反馈',
  ].forEach((eventType) => {
    checkContains(eventLedger, eventType, errors, `统一事件账缺少事件类型：${eventType}`)
  })

  ;[
    'TransferPrepReadyPayload',
    'TransferPickupPayload',
    'WaitProcessInboundPayload',
    'WaitProcessIssuePayload',
    'WaitProcessReturnPayload',
    'StartWorkPayload',
    'FinishSpreadingPayload',
    'FinishCuttingPayload',
    'FeiTicketInboundPayload',
    'HandoverBaggingConfirmPayload',
    'HandoverRecordSubmitPayload',
    'SpecialCraftHandoverPayload',
    'SpecialCraftReturnPayload',
    'ReplenishmentFeedbackPayload',
  ].forEach((payloadType) => {
    checkContains(eventLedger, payloadType, errors, `统一事件账缺少 payload 类型：${payloadType}`)
  })

  const directRuntimeWriterPages = [
    'src/pages/pda-cutting-task-detail.ts',
    'src/pages/pda-warehouse-wait-process.ts',
    'src/pages/pda-cutting-spreading.ts',
    'src/pages/pda-cutting-replenishment-feedback.ts',
  ]
  directRuntimeWriterPages.forEach((file) => {
    checkContains(file, 'appendCuttingRuntimeEvent', errors, 'PDA 页面未直接写入统一裁床事件账')
    checkContains(file, 'cutting-runtime-event-ledger', errors, 'PDA 页面未接入统一裁床事件账模块')
  })

  const waitHandoverRuntime = 'src/pages/process-factory/cutting/wait-handover-runtime.ts'
  ;[
    'appendWaitHandoverInboundEvent',
    'appendWaitHandoverBaggingConfirmEvent',
    'appendWaitHandoverHandoverRecordEvent',
    'appendWaitHandoverSpecialCraftHandoverEvent',
    'appendWaitHandoverSpecialCraftReturnEvent',
    'appendCuttingRuntimeEvent',
  ].forEach((needle) => {
    checkContains(waitHandoverRuntime, needle, errors, `待交出仓 runtime 缺少事件账适配：${needle}`)
  })

  checkContains('src/pages/pda-cutting-inbound.ts', 'appendWaitHandoverInboundEvent', errors, 'PDA 菲票入仓未通过待交出仓 runtime 写事件账')
  checkContains('src/pages/pda-cutting-handover.ts', 'appendWaitHandoverBaggingConfirmEvent', errors, 'PDA 交出装袋确认未通过待交出仓 runtime 写事件账')
  checkContains('src/pages/pda-cutting-handover.ts', 'appendWaitHandoverHandoverRecordEvent', errors, 'PDA 交出记录未通过待交出仓 runtime 写事件账')
  checkContains('src/pages/pda-cutting-handover.ts', 'appendWaitHandoverSpecialCraftHandoverEvent', errors, 'PDA 特殊工艺交出未通过待交出仓 runtime 写事件账')
  checkContains('src/pages/pda-cutting-handover.ts', 'appendWaitHandoverSpecialCraftReturnEvent', errors, 'PDA 特殊工艺回仓未通过待交出仓 runtime 写事件账')

  checkContains('src/pages/pda-cutting-task-detail.ts', "'裁片单开工'", errors, 'PDA 开工动作未记录裁片单开工事件')
  checkContains('src/pages/pda-warehouse-wait-process.ts', "'中转仓领料'", errors, 'PDA 待加工仓缺少中转仓领料事件')
  checkContains('src/pages/pda-warehouse-wait-process.ts', "'待加工仓扫码入仓'", errors, 'PDA 待加工仓缺少扫码入仓事件')
  checkContains('src/pages/pda-warehouse-wait-process.ts', "'待加工仓加工领料'", errors, 'PDA 待加工仓缺少加工领料事件')
  checkContains('src/pages/pda-warehouse-wait-process.ts', "'待加工仓回收入仓'", errors, 'PDA 待加工仓缺少回收入仓事件')
  checkContains('src/pages/pda-cutting-spreading.ts', "'开始铺布'", errors, 'PDA 铺布页缺少开始铺布事件')
  checkContains('src/pages/pda-cutting-spreading.ts', "'完成铺布'", errors, 'PDA 铺布页缺少完成铺布事件')
  checkContains('src/pages/pda-cutting-spreading.ts', "'开始裁剪'", errors, 'PDA 裁剪页缺少开始裁剪事件')
  checkContains('src/pages/pda-cutting-spreading.ts', "'完成裁剪'", errors, 'PDA 裁剪页缺少完成裁剪事件')
  checkContains('src/pages/pda-cutting-replenishment-feedback.ts', "'补料反馈'", errors, 'PDA 补料反馈页缺少补料反馈事件')

  checkContains('src/pages/pda-cutting-spreading.ts', 'outputLines', errors, 'PDA 裁剪完成必须按实际裁剪产出明细写入')
  checkContains('src/pages/pda-cutting-spreading.ts', 'partCode', errors, 'PDA 实际裁剪产出缺少部位编码')
  checkContains('src/pages/pda-cutting-spreading.ts', 'partName', errors, 'PDA 实际裁剪产出缺少部位名称')
  checkContains('src/pages/pda-cutting-spreading.ts', 'actualPieceQty', errors, 'PDA 实际裁剪产出缺少实际裁片数量')
  checkAbsent('src/pages/pda-cutting-spreading.ts', '整床裁片', errors, 'PDA 裁剪完成仍存在整床裁片兜底文案')

  ;[
    'src/pages/process-factory/cutting/warehouse-hub.ts',
    'src/pages/process-factory/cutting/cut-piece-warehouse-model.ts',
    'src/pages/process-factory/cutting/production-progress-model.ts',
    'src/pages/process-factory/cutting/replenishment-model.ts',
    'src/pages/process-factory/cutting/material-prep-model.ts',
    'src/data/fcs/cutting/generated-fei-tickets.ts',
    'src/data/fcs/cutting/spreading-differences.ts',
  ].forEach((file) => {
    checkContains(file, 'cutting-runtime-event-ledger', errors, 'Web 投影未读取统一裁床事件账')
  })

  checkContains('src/data/fcs/cutting/generated-fei-tickets.ts', 'FinishCuttingPayload', errors, '菲票生成未读取完成裁剪实际产出 payload')
  checkContains('src/data/fcs/cutting/generated-fei-tickets.ts', 'outputLines', errors, '菲票生成未按铺布单实际产出明细生成')
  checkContains('src/data/fcs/cutting/spreading-differences.ts', "listCuttingRuntimeEventsByType('完成铺布')", errors, '铺布差异未读取完成铺布事件')
  checkContains('src/data/fcs/cutting/spreading-differences.ts', "listCuttingRuntimeEventsByType('完成裁剪')", errors, '裁剪差异未读取完成裁剪事件')

  ;[
    'readSelectedCutPieceOrderNoFromLocation',
    'focusCutPieceOrderNo',
    'data-cut-piece-order-no',
    'appendPickupWritebackRecord',
    'appendInboundWritebackRecord',
    'appendHandoverWritebackRecord',
    'appendReplenishmentFeedbackWritebackRecord',
  ].forEach((legacyText) => {
    ;[
      'src/pages/pda-cutting-task-detail.ts',
      'src/pages/pda-warehouse-wait-process.ts',
      'src/pages/pda-cutting-spreading.ts',
      'src/pages/pda-cutting-inbound.ts',
      'src/pages/pda-cutting-handover.ts',
      'src/pages/pda-cutting-replenishment-feedback.ts',
    ].forEach((file) => {
      checkAbsent(file, legacyText, errors, `PDA 页面仍有旧写回/旧裁片单锚点：${legacyText}`)
    })
  })

  if (errors.length) {
    console.error('check-cutting-pda-projection-writeback failed:')
    errors.forEach((error) => console.error(`- ${error}`))
    process.exit(1)
  }

  console.log('check-cutting-pda-projection-writeback: ok')
}

main()
