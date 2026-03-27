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

function checkContains(rel: string, pattern: string | RegExp, errors: string[], message: string): void {
  const content = read(rel)
  const matched = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content)
  if (!matched) errors.push(`${message} [${rel}]`)
}

function checkAbsent(rel: string, pattern: string | RegExp, errors: string[], message: string): void {
  const content = read(rel)
  const matched = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content)
  if (matched) errors.push(`${message} [${rel}]`)
}

function main(): void {
  const errors: string[] = []

  const requiredFiles = [
    'src/data/fcs/pda-cutting-execution-source.ts',
    'src/data/fcs/pda-cutting-writeback-inputs.ts',
    'src/data/fcs/cutting/pda-execution-writeback-ledger.ts',
    'src/data/fcs/cutting/pda-spreading-writeback.ts',
    'src/pages/pda-cutting-task-projection.ts',
    'src/pages/pda-cutting-pickup-projection.ts',
    'src/pages/pda-cutting-spreading-projection.ts',
    'src/pages/pda-cutting-inbound-projection.ts',
    'src/pages/pda-cutting-handover-projection.ts',
    'src/pages/pda-cutting-replenishment-projection.ts',
  ]
  requiredFiles.forEach((file) => ensureFile(file, errors))

  const retiredFiles = [
    'src/data/fcs/pda-cutting-special.ts',
    'src/pages/process-factory/cutting/pda-execution-writeback-model.ts',
    'src/pages/process-factory/cutting/pda-writeback-model.ts',
  ]
  retiredFiles.forEach((file) => {
    if (fs.existsSync(abs(file))) errors.push(`旧 PDA 文件仍未退场：${file}`)
  })

  const pageFiles = [
    'src/pages/pda-cutting-task-detail.ts',
    'src/pages/pda-cutting-pickup.ts',
    'src/pages/pda-cutting-spreading.ts',
    'src/pages/pda-cutting-inbound.ts',
    'src/pages/pda-cutting-handover.ts',
    'src/pages/pda-cutting-replenishment-feedback.ts',
  ]

  pageFiles.forEach((file) => {
    checkAbsent(file, 'pda-cutting-special', errors, 'PDA 页面仍直接依赖旧平行 special 源')
    checkAbsent(file, 'readSelectedCutPieceOrderNoFromLocation', errors, 'PDA 页面仍以 legacy cutPieceOrderNo 作为主锚点')
    checkAbsent(file, 'focusCutPieceOrderNo', errors, 'PDA 页面仍以 legacy focusCutPieceOrderNo 作为主锚点')
    checkAbsent(file, 'data-cut-piece-order-no', errors, 'PDA 页面仍以 legacy 裁片单 data 属性作为主锚点')
    checkAbsent(file, 'appendPickupWritebackRecord', errors, 'PDA 页面仍直接写入 pickup ledger')
    checkAbsent(file, 'appendInboundWritebackRecord', errors, 'PDA 页面仍直接写入 inbound ledger')
    checkAbsent(file, 'appendHandoverWritebackRecord', errors, 'PDA 页面仍直接写入 handover ledger')
    checkAbsent(file, 'appendReplenishmentFeedbackWritebackRecord', errors, 'PDA 页面仍直接写入 replenishment ledger')
    checkAbsent(file, 'localStorage', errors, 'PDA 页面不应直接落写本地 storage 主记录')
  })

  checkContains('src/pages/pda-cutting-task-detail.ts', "from './pda-cutting-task-detail-helpers'", errors, 'PDA 任务详情页缺少正式 task projection/helper')
  checkContains('src/pages/pda-cutting-pickup.ts', "from './pda-cutting-pickup-projection'", errors, 'PDA 领料页缺少正式 projection')
  checkContains('src/pages/pda-cutting-spreading.ts', "from './pda-cutting-spreading-projection'", errors, 'PDA 铺布页缺少正式 projection')
  checkContains('src/pages/pda-cutting-inbound.ts', "from './pda-cutting-inbound-projection'", errors, 'PDA 入仓页缺少正式 projection')
  checkContains('src/pages/pda-cutting-handover.ts', "from './pda-cutting-handover-projection'", errors, 'PDA 交接页缺少正式 projection')
  checkContains('src/pages/pda-cutting-replenishment-feedback.ts', "from './pda-cutting-replenishment-projection'", errors, 'PDA 补料反馈页缺少正式 projection')

  const bridgeTargets = [
    ['src/pages/pda-cutting-pickup.ts', 'writePdaPickupToFcs'],
    ['src/pages/pda-cutting-spreading.ts', 'writePdaSpreadingToFcs'],
    ['src/pages/pda-cutting-inbound.ts', 'writePdaInboundToFcs'],
    ['src/pages/pda-cutting-handover.ts', 'writePdaHandoverToFcs'],
    ['src/pages/pda-cutting-replenishment-feedback.ts', 'writePdaReplenishmentFeedbackToFcs'],
  ] as const

  bridgeTargets.forEach(([file, bridgeFn]) => {
    checkContains(file, bridgeFn, errors, `PDA 页面未通过正式写回桥提交：${bridgeFn}`)
    checkContains(file, 'resolvePdaCuttingWritebackIdentity', errors, 'PDA 页面未通过统一 identity 适配器')
    checkContains(file, 'resolvePdaCuttingWritebackOperator', errors, 'PDA 页面未通过统一 operator 适配器')
    checkContains(file, 'buildPdaCuttingWritebackSource', errors, 'PDA 页面未通过统一 source 适配器')
  })

  const operatorFiles = [
    'src/domain/cutting-pda-writeback/bridge.ts',
    'src/data/fcs/pda-cutting-writeback-inputs.ts',
    'src/data/fcs/cutting/pda-execution-writeback-ledger.ts',
  ]
  operatorFiles.forEach((file) => {
    checkAbsent(file, /operatorAccountId\s*=\s*operatorName/g, errors, '仍存在 operatorAccountId = operatorName 的伪账号逻辑')
    checkContains(file, 'operatorAccountId', errors, '操作人实体字段缺失')
    checkContains(file, 'operatorFactoryId', errors, '操作人工厂字段缺失')
  })

  const noBareDateNowFiles = [
    'src/pages/pda-cutting-pickup.ts',
    'src/pages/pda-cutting-spreading.ts',
    'src/pages/pda-cutting-inbound.ts',
    'src/pages/pda-cutting-handover.ts',
    'src/pages/pda-cutting-replenishment-feedback.ts',
    'src/data/fcs/pda-cutting-writeback-inputs.ts',
    'src/domain/cutting-pda-writeback/bridge.ts',
    'src/data/fcs/cutting/pda-spreading-writeback.ts',
  ]
  noBareDateNowFiles.forEach((file) => {
    checkAbsent(file, 'Date.now(', errors, 'PDA 写回链仍使用裸 Date.now() 作为业务 ID / 主流水生成')
  })

  const noLegacySourceRefs = [
    'src/domain/cutting-pda-writeback/bridge.ts',
    'src/data/fcs/pda-cutting-execution-source.ts',
    'src/data/fcs/cutting/runtime-inputs.ts',
  ]
  noLegacySourceRefs.forEach((file) => {
    checkAbsent(file, 'pda-cutting-special', errors, '仍有正式源继续依赖旧 pda-cutting-special')
    checkAbsent(file, 'pda-execution-writeback-model', errors, '仍有正式源继续依赖旧页面 writeback ledger model')
    checkAbsent(file, 'pda-writeback-model', errors, '仍有正式源继续依赖旧页面 writeback inbox model')
  })

  checkAbsent('src/pages/pda-cutting-integration-map.ts', 'focusCutPieceOrderNo', errors, 'integration map 仍透出旧 focusCutPieceOrderNo')
  checkAbsent('src/pages/pda-cutting-integration-map.ts', 'cutPieceOrderNo', errors, 'integration map 仍透出旧 cutPieceOrderNo')
  checkAbsent('src/pages/pda-cutting-nav-context.ts', "params.set('cutPieceOrderNo'", errors, 'nav context 不应继续写出 legacy cutPieceOrderNo 参数')
  checkAbsent('src/pages/pda-cutting-nav-context.ts', "params.set('focusCutPieceOrderNo'", errors, 'nav context 不应继续写出 legacy focusCutPieceOrderNo 参数')
  checkAbsent('src/data/fcs/pda-cutting-execution-source.ts', "params.set('cutPieceOrderNo'", errors, 'execution route builder 不应继续写出 legacy cutPieceOrderNo 参数')

  checkContains('src/data/fcs/pda-cutting-writeback-inputs.ts', 'buildPdaCuttingWritebackId', errors, '统一写回 ID 生成器缺失')
  checkContains('src/domain/cutting-pda-writeback/bridge.ts', 'validateIdentity', errors, '写回桥 identity 校验缺失')
  checkContains('src/domain/cutting-pda-writeback/bridge.ts', 'executionOrderId', errors, '写回桥未校验正式执行对象')

  if (errors.length) {
    console.error('check-cutting-pda-projection-writeback failed:')
    errors.forEach((error) => console.error(`- ${error}`))
    process.exit(1)
  }

  console.log('check-cutting-pda-projection-writeback: ok')
}

main()
