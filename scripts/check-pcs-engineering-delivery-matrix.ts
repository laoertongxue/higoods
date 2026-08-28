import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const allowIncomplete = process.argv.includes('--allow-incomplete')
const allowedStatuses = new Set(['待实施', '实施中', '已实现待验证', '已验证', '已阻塞', '不适用'])

const documents = {
  adjustment: 'docs/product-design/PCS设计改款合并、工程变更删除与生产准备时效收口调整方案.md',
  design: 'docs/product-design/PCS生产工程管理总体设计文档.md',
  plan: 'docs/product-design/PCS生产工程管理实施计划.md',
  matrix: 'docs/product-design/PCS生产工程管理需求追踪与交付矩阵.md',
  prd: 'docs/product-design/PCS生产工程管理产品需求说明书.md',
  scenarios: 'docs/product-design/PCS生产工程管理全流程测试方案与实际案例.md',
} as const

for (const relativePath of Object.values(documents)) {
  if (!fs.existsSync(path.join(root, relativePath))) throw new Error(`缺少交付文档：${relativePath}`)
}

const adjustment = fs.readFileSync(path.join(root, documents.adjustment), 'utf8')
const design = fs.readFileSync(path.join(root, documents.design), 'utf8')
const plan = fs.readFileSync(path.join(root, documents.plan), 'utf8')
const matrix = fs.readFileSync(path.join(root, documents.matrix), 'utf8')
const prd = fs.readFileSync(path.join(root, documents.prd), 'utf8')
const scenarios = fs.readFileSync(path.join(root, documents.scenarios), 'utf8')

function parseMarkdownRow(line: string): string[] {
  return line.slice(1, -1).split('|').map((cell) => cell.trim())
}

const requirementId = /^(?:SCOPE|DR|FILE|IMAGE|COLOR|BOM|DATA|TASK|STATE|MASTER|PACK|DELETE|REL|ARCHIVE|CLOSE|COPY|TIME|PAGE)-\d{3}$/
const atomicRows = matrix
  .split('\n')
  .filter((line) => line.startsWith('|') && requirementId.test(parseMarkdownRow(line)[0] || ''))
  .map((line) => {
    const cells = parseMarkdownRow(line)
    if (cells.length !== 9) throw new Error(`原子需求列数错误：${cells[0] ?? line}`)
    const [id, source, requirement, workPackage, implementation, automation, runtime, status, evidence] = cells
    if (!allowedStatuses.has(status)) throw new Error(`${id} 状态无效：${status}`)
    if (![source, requirement, workPackage, implementation, automation, runtime, evidence].every(Boolean)) {
      throw new Error(`${id} 的来源、需求、工作包、实现或证据字段不完整`)
    }
    if (!/^WP\d+(?:、WP\d+)*$/.test(workPackage)) throw new Error(`${id} 工作包格式无效：${workPackage}`)
    return { id, status }
  })

const ids = atomicRows.map((row) => row.id)
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
const unfinished = atomicRows.filter((row) => !['已验证', '不适用'].includes(row.status))

if (atomicRows.length !== 81) throw new Error(`原子需求必须为 81 条，当前 ${atomicRows.length} 条`)
if (new Set(ids).size !== ids.length) throw new Error(`存在重复需求 ID：${[...new Set(duplicateIds)].join('、')}`)

const adjustmentIds = [...adjustment.matchAll(/^\| ((?:SCOPE|DR|FILE|IMAGE|COLOR|BOM|DATA|TASK|STATE|MASTER|PACK|DELETE|REL|ARCHIVE|CLOSE|COPY|TIME|PAGE)-\d{3}) \|/gm)]
  .map((match) => match[1])
const missingFromMatrix = [...new Set(adjustmentIds)].filter((id) => !ids.includes(id))
const missingFromAdjustment = ids.filter((id) => !adjustmentIds.includes(id))
if (new Set(adjustmentIds).size !== 81) throw new Error(`调整方案原子需求必须为 81 条，当前 ${new Set(adjustmentIds).size} 条`)
if (missingFromMatrix.length || missingFromAdjustment.length) {
  throw new Error(`调整方案与矩阵编号不一致：矩阵缺少 ${missingFromMatrix.join('、') || '无'}；方案缺少 ${missingFromAdjustment.join('、') || '无'}`)
}

const requiredPhrases = ['设计改款任务', '设计稿', '工程主单', '生产准备时效', '技术包']
for (const [name, content] of Object.entries({ design, plan, prd, scenarios })) {
  for (const phrase of requiredPhrases) {
    if (!content.includes(phrase)) throw new Error(`${name} 缺少当前业务口径：${phrase}`)
  }
  if (!/(?:参照款|来源款|A 款|A、B|A\/B)/.test(content) || !/(?:目标款|B 款|A、B|A\/B)/.test(content)) {
    throw new Error(`${name} 缺少参照款 A 与目标款 B 的当前口径`)
  }
}

const removedFiles = [
  'src/data/pcs-engineering-change-workspace.ts',
  'src/data/pcs-revision-task-file-types.ts',
  'src/data/pcs-revision-task-material-types.ts',
  'src/data/pcs-revision-task-repository.ts',
  'src/data/pcs-revision-task-types.ts',
  'src/pages/pcs-engineering-change.ts',
  'src/pages/pcs-engineering-tasks/revision-task.ts',
]
for (const relativePath of removedFiles) {
  if (fs.existsSync(path.join(root, relativePath))) throw new Error(`已删除能力仍有专用文件：${relativePath}`)
}

const sourceFiles = [
  'src/data/app-shell-config.ts',
  'src/data/pcs-engineering-master-sampling.ts',
  'src/data/pcs-engineering-master-types.ts',
  'src/data/pcs-technical-data-version-types.ts',
  'src/pages/pcs-independent-sampling.ts',
  'src/router/route-renderers.ts',
  'src/router/routes-pcs.ts',
]
const sourceText = sourceFiles.map((relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')).join('\n')
for (const forbidden of [
  '/pcs/engineering/revision-sampling',
  '/pcs/engineering/design-sampling',
  '/pcs/engineering/changes',
  'ENGINEERING_CHANGE',
  'REVISION_TASK',
  'REVISION_RECORD',
  'linkedRevisionTaskIds',
]) {
  if (sourceText.includes(forbidden)) throw new Error(`当前入口或核心类型仍残留旧口径：${forbidden}`)
}
for (const required of ['/pcs/engineering/design-revision', 'INDEPENDENT_DESIGN_REVISION', 'linkedDesignRevisionTaskIds']) {
  if (!sourceText.includes(required)) throw new Error(`当前入口或核心类型缺少新口径：${required}`)
}

if (unfinished.length && !allowIncomplete) {
  throw new Error(`仍有 ${unfinished.length} 条需求未闭环：${unfinished.slice(0, 12).map((row) => row.id).join('、')}`)
}

const suffix = unfinished.length ? `，允许 ${unfinished.length} 条待双轮验证` : '，全部已验证'
console.log(`check-pcs-engineering-delivery-matrix PASS（81 条原子需求，方案与矩阵双向一致${suffix}）`)
