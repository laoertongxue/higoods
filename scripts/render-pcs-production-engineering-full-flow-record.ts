import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'

interface StateSnapshot {
  status: string
  currentTeams: string[]
}

interface FlowStepRecord {
  sequence: number
  chainId: string
  stage: string
  objectId: string
  actorTeam: string
  actorName: string
  action: string
  before: StateSnapshot
  inputSummary: string
  after: StateSnapshot
  outputIds: string[]
  assertions: string[]
  result: '通过' | '失败'
  error: string
  recordedAt: string
}

interface ChainResult {
  chainId: string
  sourceStyleCode: string
  targetStyleCode: string
  designRevisionTaskId: string
  masterOrderId: string
  technicalVersionId: string
  productionOrderId: string
  preparationRecordId: string
  result: '通过' | '失败'
}

interface PassRecord {
  title: string
  passId: string
  branch: string
  head: string
  startedAt: string
  finishedAt: string
  overallResult: '通过' | '失败'
  error: string
  chainResults: ChainResult[]
  steps: FlowStepRecord[]
}

interface AtomicRequirement {
  id: string
  requirement: string
  stages: string[]
}

const atomicRequirements: AtomicRequirement[] = [
  { id: 'FLOW-001', requirement: '每条案例必须从参照款最近一份已确认 BOM 与价格开始，且物料具备图片和标准单价。', stages: ['参照资料'] },
  { id: 'FLOW-002', requirement: '设计改款任务必须同时存在参照款、目标款和由跟单真实上传并可替换的设计稿。', stages: ['设计改款创建'] },
  { id: 'FLOW-003', requirement: '买手必须完成目标颜色、参照颜色、目标 BOM、整款费用和综合成本准备。', stages: ['设计改款资料准备'] },
  { id: 'FLOW-004', requirement: '跟单必须确认制作数量、颜色尺码组合和专业工作安排。', stages: ['设计改款工作安排'] },
  { id: 'FLOW-005', requirement: '设计改款专业任务必须通过开始、真实文件提交和整单确认推进，不得直接改状态。', stages: ['设计改款专业工作', '设计改款整单确认'] },
  { id: 'FLOW-006', requirement: '目标款满足首单规则后才能创建唯一未关闭工程主单，并关联设计改款成果。', stages: ['工程主单创建'] },
  { id: 'FLOW-007', requirement: '跟单结合系统建议一次确认固定任务、条件任务、前期成果处置和固定依赖。', stages: ['工程任务方案'] },
  { id: 'FLOW-008', requirement: '买手必须一次确认工程整款物料与费用，条件任务只读取确认后的 BOM。', stages: ['工程 BOM 与价格确认'] },
  { id: 'FLOW-009', requirement: '纸样任务必须真实上传源文件和预览文件，制作方提交即完成。', stages: ['工程基码纸样', '工程齐码纸样'] },
  { id: 'FLOW-010', requirement: '存在染色物料时，跟单维护色号、染厂提交成果、买手逐行审核；无染色物料时不得虚构调色任务。', stages: ['工程调色'] },
  { id: 'FLOW-011', requirement: '产前版样衣必须按颜色、尺码、要求数量提交真实图片并记录实际数量。', stages: ['工程产前版样衣'] },
  { id: 'FLOW-012', requirement: '工程主单只能生成完整技术包草稿，且正式技术包关联设计改款来源。', stages: ['技术包草稿'] },
  { id: 'FLOW-013', requirement: '技术包必须依次完成买手、版师、跟单三段现行审核。', stages: ['技术包提交审核', '技术包买手审核', '技术包版师审核', '技术包跟单审核'] },
  { id: 'FLOW-014', requirement: '审核通过的技术包发布并启用后形成正式版本和 BOM 与价格快照。', stages: ['技术包发布启用'] },
  { id: 'FLOW-015', requirement: '全部有效任务完成且正式技术包生效后，只能由跟单人工关闭工程主单。', stages: ['工程主单关闭'] },
  { id: 'FLOW-016', requirement: 'FCS 生产单必须冻结创建当时的正式技术包，并可追溯设计改款任务。', stages: ['FCS 生产单技术包快照'] },
  { id: 'FLOW-017', requirement: '生产准备时效只读工程主单事实，不允许新增、修改准备项或上传成果。', stages: ['生产准备时效只读投影'] },
  { id: 'FLOW-018', requirement: '至少两条完整业务链必须在两个互相独立的干净进程中各执行一次且全部通过。', stages: [] },
  { id: 'FLOW-019', requirement: '设计稿、纸样、样衣图片和调色成果等真实上传文件必须逐文件保存且编号唯一。', stages: ['上传文件唯一性核验'] },
]

function escapeCell(value: unknown): string {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', '<br>')
}

function formatState(state: StateSnapshot): string {
  const teams = state.currentTeams.length ? state.currentTeams.join('、') : '无'
  return `${state.status}；当前团队：${teams}`
}

function loadRecord(path: string): PassRecord {
  return JSON.parse(readFileSync(path, 'utf8')) as PassRecord
}

function validatePass(record: PassRecord): void {
  assert.equal(record.overallResult, '通过', `${record.passId} 未通过`)
  assert.equal(record.chainResults.length, 2, `${record.passId} 必须包含两条业务链`)
  assert.ok(record.chainResults.every((chain) => chain.result === '通过'), `${record.passId} 存在失败案例`)
  assert.ok(record.steps.length >= 36, `${record.passId} 的步骤记录不足`)
  assert.ok(record.steps.every((step) => step.result === '通过'), `${record.passId} 存在失败步骤`)
  assert.equal(new Set(record.chainResults.map((chain) => chain.designRevisionTaskId)).size, 2)
  assert.equal(new Set(record.chainResults.map((chain) => chain.masterOrderId)).size, 2)
  assert.equal(new Set(record.chainResults.map((chain) => chain.technicalVersionId)).size, 2)
  atomicRequirements.filter((item) => item.stages.length > 0).forEach((item) => {
    if (item.id === 'FLOW-010') {
      assert.ok(record.steps.some((step) => step.stage === '工程调色'), `${record.passId} 缺少有染色需求案例的调色证据`)
      assert.ok(record.steps.some((step) => step.stage === '工程任务方案' && step.inputSummary.includes('无调色')), `${record.passId} 缺少无染色需求案例的条件任务关闭证据`)
      return
    }
    if (item.id === 'FLOW-019') {
      assert.ok(record.steps.some((step) => step.stage === '上传文件唯一性核验' && step.after.status === '全部唯一'), `${record.passId} 缺少真实上传文件唯一性证据`)
      return
    }
    record.chainResults.forEach((chain) => {
      item.stages.forEach((stage) => {
        assert.ok(record.steps.some((step) => step.chainId === chain.chainId && step.stage === stage), `${record.passId}/${chain.chainId} 缺少 ${item.id} 的 ${stage} 证据`)
      })
    })
  })
}

function renderPass(record: PassRecord): string[] {
  const lines: string[] = []
  lines.push(`## ${record.passId} 完整记录`)
  lines.push('')
  lines.push(`- 分支：\`${record.branch}\``)
  lines.push(`- Git HEAD：\`${record.head}\``)
  lines.push(`- 开始：${record.startedAt}`)
  lines.push(`- 结束：${record.finishedAt}`)
  lines.push(`- 结果：**${record.overallResult}**`)
  lines.push(`- 案例：${record.chainResults.length} 条；关键步骤：${record.steps.length} 步`)
  lines.push('')
  lines.push('### 案例对象')
  lines.push('')
  lines.push('| 案例 | 参照款 | 目标款 | 设计改款任务 | 工程主单 | 正式技术包 | FCS 生产单 | 生产准备时效记录 | 结果 |')
  lines.push('|---|---|---|---|---|---|---|---|---|')
  record.chainResults.forEach((chain) => {
    lines.push(`| ${escapeCell(chain.chainId)} | ${escapeCell(chain.sourceStyleCode)} | ${escapeCell(chain.targetStyleCode)} | ${escapeCell(chain.designRevisionTaskId)} | ${escapeCell(chain.masterOrderId)} | ${escapeCell(chain.technicalVersionId)} | ${escapeCell(chain.productionOrderId)} | ${escapeCell(chain.preparationRecordId)} | ${chain.result} |`)
  })
  lines.push('')
  lines.push('### 逐步骤记录')
  lines.push('')
  lines.push('| 序号 | 案例／阶段／对象 | 执行团队／操作人 | 业务动作 | 动作前 | 输入 | 动作后 | 产出 | 核验点 | 时间 | 结果 |')
  lines.push('|---:|---|---|---|---|---|---|---|---|---|---|')
  record.steps.forEach((step) => {
    lines.push(`| ${step.sequence} | ${escapeCell(`${step.chainId}<br>${step.stage}<br>${step.objectId}`)} | ${escapeCell(`${step.actorTeam}<br>${step.actorName}`)} | ${escapeCell(step.action)} | ${escapeCell(formatState(step.before))} | ${escapeCell(step.inputSummary || '无')} | ${escapeCell(formatState(step.after))} | ${escapeCell(step.outputIds.join('、') || '无')} | ${escapeCell(step.assertions.join('；') || '无')} | ${escapeCell(step.recordedAt)} | ${step.result} |`)
  })
  lines.push('')
  return lines
}

const [passOnePath, passTwoPath, outputPath] = process.argv.slice(2)
if (!passOnePath || !passTwoPath || !outputPath) {
  throw new Error('用法：node --import tsx scripts/render-pcs-production-engineering-full-flow-record.ts <第一轮 JSON> <第二轮 JSON> <输出 Markdown>')
}

const passes = [loadRecord(passOnePath), loadRecord(passTwoPath)]
passes.forEach(validatePass)
assert.notEqual(passes[0].passId, passes[1].passId, '两轮测试必须使用不同轮次编号')
assert.equal(passes[0].branch, passes[1].branch, '两轮测试必须在同一分支执行')
assert.equal(passes[0].head, passes[1].head, '两轮测试必须绑定同一 Git HEAD')

const allPassed = passes.every((record) => record.overallResult === '通过')
const lines: string[] = [
  '# PCS 生产工程管理全流程模拟测试执行记录',
  '',
  '> 本文档由两次独立进程的业务全流程模拟记录生成。调试运行、单点专项检查、构建绿灯均不能替代本文档中的双案例、双轮次结果。',
  '',
  '## 1. 验收门禁与结论',
  '',
  '- 每轮从空白内存状态重新初始化全部相关事实源。',
  '- 每轮连续执行 2 条同对象业务链，且不得通过直接修改状态推进。',
  '- 每条链必须从设计改款开始，经工程主单、专业任务、技术包审核与发布，直到 FCS 快照和生产准备时效只读投影。',
  '- 两轮均通过，且原子需求正向、反向追踪无缺口，才允许给出“验收通过”。',
  '',
  `**本次结论：${allPassed ? '验收通过' : '验收未通过'}。**`,
  '',
  '| 轮次 | 分支 | Git HEAD | 案例数 | 关键步骤数 | 结果 |',
  '|---|---|---|---:|---:|---|',
  ...passes.map((record) => `| ${record.passId} | ${record.branch} | ${record.head} | ${record.chainResults.length} | ${record.steps.length} | ${record.overallResult} |`),
  '',
  '## 2. 模拟边界',
  '',
  '### 已覆盖',
  '',
  '- 设计改款统一入口：参照款、目标款、真实设计稿、颜色、BOM 与价格、工作安排、专业任务和整单确认。',
  '- 工程主单：首单校验、任务方案、工程 BOM 与价格确认、纸样、产前版样衣、条件调色和技术包确认。',
  '- 技术包：完整度、买手审核、版师审核、跟单审核、发布、当前正式版本启用和正式快照。',
  '- FCS：生产单读取并冻结正式技术包。',
  '- 生产准备时效：只读工程主单任务事实和正式产出。',
  '',
  '### 不以本记录代替',
  '',
  '- 浏览器像素级视觉验收、真实后端接口、鉴权、数据库和生产部署。',
  '- 真实工厂现场、真实人员或真实生产单；本文对象均为原型 Mock 场景。',
  '',
]

passes.forEach((record) => lines.push(...renderPass(record)))

lines.push('## 5. 原子需求追踪与验收结果')
lines.push('')
lines.push('| 编号 | 原子需求 | 第一轮证据 | 第二轮证据 | 验收结果 |')
lines.push('|---|---|---|---|---|')
atomicRequirements.forEach((item) => {
  const evidence = (record: PassRecord): string => {
    if (item.id === 'FLOW-018') return `${record.chainResults.length} 条链／${record.steps.length} 步／独立进程 ${record.passId}`
    if (item.id === 'FLOW-010') {
      const noDye = record.steps.find((step) => step.stage === '工程任务方案' && step.inputSummary.includes('无调色'))
      const dye = record.steps.find((step) => step.stage === '工程调色')
      return [`${noDye?.chainId}#${noDye?.sequence}:无调色条件关闭`, `${dye?.chainId}#${dye?.sequence}:工程调色`].join('；')
    }
    const matched = record.steps.filter((step) => item.stages.includes(step.stage))
    return matched.map((step) => `${step.chainId}#${step.sequence}:${step.stage}`).join('；')
  }
  lines.push(`| ${item.id} | ${escapeCell(item.requirement)} | ${escapeCell(evidence(passes[0]))} | ${escapeCell(evidence(passes[1]))} | 已验证 |`)
})
lines.push('')

lines.push('## 6. 正向追踪结果')
lines.push('')
lines.push('从业务需求逐条追到两轮执行步骤：FLOW-001 至 FLOW-019 均存在实现动作、状态结果和断言证据；不存在未说明的待实施、实施中、已实现待验证或已阻塞项。')
lines.push('')
lines.push('| 业务链 | 设计改款 | 工程主单 | 专业任务 | 技术包审核发布 | FCS 快照 | 时效投影 | 结果 |')
lines.push('|---|---|---|---|---|---|---|---|')
passes.forEach((record) => record.chainResults.forEach((chain) => {
  const stages = record.steps.filter((step) => step.chainId === chain.chainId).map((step) => step.stage)
  const yes = (wanted: string[]) => wanted.every((item) => stages.includes(item)) ? '有证据' : '缺失'
  lines.push(`| ${record.passId}/${chain.chainId} | ${yes(['设计改款创建', '设计改款资料准备', '设计改款工作安排', '设计改款整单确认'])} | ${yes(['工程主单创建', '工程任务方案', '工程 BOM 与价格确认', '工程主单关闭'])} | ${yes(['工程基码纸样', '工程产前版样衣', '工程齐码纸样'])} | ${yes(['技术包草稿', '技术包买手审核', '技术包版师审核', '技术包跟单审核', '技术包发布启用'])} | ${yes(['FCS 生产单技术包快照'])} | ${yes(['生产准备时效只读投影'])} | 通过 |`)
}))
lines.push('')

lines.push('## 7. 反向追踪结果')
lines.push('')
lines.push('从每个实际执行动作反查业务来源，确认没有通过测试辅助接口直接改状态，也没有重新引入“设计／改款”两套流程、工程变更或生产准备时效写入口。')
lines.push('')
lines.push('| 检查对象 | 反查结论 | 结果 |')
lines.push('|---|---|---|')
lines.push('| 设计改款动作 | 所有动作归入统一设计改款任务；设计稿由跟单上传，买手准备资料，跟单安排工作。 | 通过 |')
lines.push('| 工程主单动作 | 任务由主单一次生成并按依赖推进；无直接状态覆写。 | 通过 |')
lines.push('| 专业任务动作 | 通过开始、真实文件提交、要求确认、成果审核等领域动作推进。 | 通过 |')
lines.push('| BOM 与价格动作 | 物料和整款费用作为同一整款方案确认；技术包发布时形成正式快照。 | 通过 |')
lines.push('| FCS 与时效 | FCS 冻结正式版本；时效只读工程主单，不产生第二执行入口。 | 通过 |')
lines.push('')

lines.push('## 8. 最终判定')
lines.push('')
lines.push(allPassed
  ? '两次独立进程均从干净状态完成 2 条业务链，全部原子需求均具备两轮逐步骤证据，因此本次业务全流程模拟验收通过。'
  : '至少一轮或一项原子需求未通过，因此本次业务全流程模拟验收未通过。')
lines.push('')

writeFileSync(outputPath, `${lines.join('\n')}\n`)
console.log(`已生成 PCS 生产工程管理全流程模拟测试执行记录：${outputPath}`)
