import assert from 'node:assert/strict'

const CURRENT_GOVERNANCE = 'AGENTS.md'
const LEGACY_DESIGN_GUIDELINES = 'docs/higood-indonesia-factory-product-design-guidelines.md'
const LEGACY_REVIEW_CHECKLIST = 'docs/higood-indonesia-factory-prototype-review-checklist.md'

export interface ReviewRecordSource {
  path: string
  source: string
}

export interface PrototypeReviewCoverage {
  coveredPaths: string[]
  recordPaths: string[]
  technicalOnlyPaths: string[]
  userVisiblePaths: string[]
}

type ImpactKind = 'legacy' | 'technical-only' | 'user-visible'

interface ParsedReviewRecord {
  path: string
  managedFiles: string[]
  impact: ImpactKind
  impactReason: string
  verificationCommands: string[]
  hasVerificationResults: boolean
  exceptions: string[]
  hasGuidelineReferences: boolean
  hasSelfCheck: boolean
  hasFinalConclusion: boolean
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').trim()
}

function readSubsection(source: string, title: string): string {
  const lines = source.split('\n')
  const start = lines.findIndex((line) => line.trim() === `### ${title}`)
  if (start < 0) return ''
  const endOffset = lines
    .slice(start + 1)
    .findIndex((line) => /^#{2,3}\s+/.test(line.trim()))
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset
  return lines.slice(start + 1, end).join('\n').trim()
}

function readSection(source: string, titlePattern: RegExp): string {
  const lines = source.split('\n')
  const start = lines.findIndex((line) => titlePattern.test(line.trim()))
  if (start < 0) return ''
  const endOffset = lines
    .slice(start + 1)
    .findIndex((line) => /^##\s+/.test(line.trim()))
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset
  return lines.slice(start + 1, end).join('\n').trim()
}

function readCodeList(section: string): string[] {
  return section
    .split('\n')
    .map((line) => /^-\s+`([^`]+)`/.exec(line.trim())?.[1] ?? '')
    .map(normalizePath)
    .filter(Boolean)
}

function readTextList(section: string): string[] {
  return section
    .split('\n')
    .map((line) => /^-\s+(.+)$/.exec(line.trim())?.[1]?.trim() ?? '')
    .filter(Boolean)
}

function readImpact(source: string): { impact: ImpactKind; reason: string } {
  const section = readSection(source, /^##\s+2\.\s+影响判定\s*$/)
  if (!section) return { impact: 'legacy', reason: '' }

  const impactValue = /^-\s*用户可见影响[：:]\s*(有|无)\s*$/m.exec(section)?.[1]
  const reason = /^-\s*判定依据[：:]\s*(.+)$/m.exec(section)?.[1]?.trim() ?? ''
  assert(impactValue, '影响判定必须明确填写“用户可见影响：有”或“用户可见影响：无”')
  assert(
    reason && !/^(?:待填写|无|N\/?A|不适用)$/i.test(reason),
    '影响判定必须填写可核验的判定依据',
  )
  return {
    impact: impactValue === '有' ? 'user-visible' : 'technical-only',
    reason,
  }
}

function parseReviewRecord(record: ReviewRecordSource): ParsedReviewRecord {
  const verificationSection = readSubsection(record.source, '验证命令')
  const verificationLines = verificationSection
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^-\s+`[^`]+`/.test(line))
  const impact = readImpact(record.source)

  return {
    path: normalizePath(record.path),
    managedFiles: readCodeList(readSubsection(record.source, '受管文件')),
    impact: impact.impact,
    impactReason: impact.reason,
    verificationCommands: readCodeList(verificationSection),
    hasVerificationResults:
      verificationLines.length > 0
      && verificationLines.every((line) => /[：:]\s*(?:通过|失败|未运行|不适用)/.test(line)),
    exceptions: readTextList(readSubsection(record.source, '例外')),
    hasGuidelineReferences:
      record.source.includes(CURRENT_GOVERNANCE)
      || (
        record.source.includes(LEGACY_DESIGN_GUIDELINES)
        && record.source.includes(LEGACY_REVIEW_CHECKLIST)
      ),
    hasSelfCheck:
      /^##\s+3\.\s+自查结论\s*$/m.test(record.source)
      && /\|\s*(?:通过|有条件通过|不通过)\s*\|/.test(record.source),
    hasFinalConclusion:
      /^##\s+6\.\s+最终结论\s*$/m.test(record.source)
      && /结论[：:]\s*(?:通过|有条件通过|不通过)/.test(record.source),
  }
}

function assertCommonEvidence(record: ParsedReviewRecord): void {
  assert(record.managedFiles.length > 0, `${record.path} 缺少受管文件`)
  assert(record.verificationCommands.length > 0, `${record.path} 缺少验证命令`)
  assert(record.hasVerificationResults, `${record.path} 的验证命令缺少明确验证结果`)
}

function assertCompleteUserVisibleReview(record: ParsedReviewRecord): void {
  assertCommonEvidence(record)
  assert(record.hasGuidelineReferences, `${record.path} 缺少 AGENTS.md 当前治理基线引用`)
  assert(record.hasSelfCheck, `${record.path} 缺少有效自查结论`)
  assert(record.hasFinalConclusion, `${record.path} 缺少最终结论`)
  assert(record.exceptions.length > 0, `${record.path} 缺少例外说明；无例外时填写“- 无”`)
}

function assertTechnicalOnlyDeclaration(record: ParsedReviewRecord): void {
  assertCommonEvidence(record)
  assert(record.impactReason, `${record.path} 缺少无用户可见影响的判定依据`)
  assert(
    record.verificationCommands.some((command) => (
      !command.includes('check:prototype-design-governance')
      && command !== 'git diff --check'
    )),
    `${record.path} 缺少证明渲染、数据、路由或交互结果不变的直接技术验证`,
  )
}

export function validatePrototypeReviewCoverage(
  prototypeChanges: string[],
  recordSources: ReviewRecordSource[],
): PrototypeReviewCoverage {
  const changedPaths = [...new Set(prototypeChanges.map(normalizePath))].sort()
  const records = recordSources.map(parseReviewRecord)
  const usedRecords = new Map<string, ParsedReviewRecord>()
  const technicalOnlyPaths: string[] = []
  const userVisiblePaths: string[] = []

  for (const changedPath of changedPaths) {
    const record = records.find((candidate) => candidate.managedFiles.includes(changedPath))
    assert(
      record,
      `${changedPath} 没有关联的影响声明或原型审查记录；记录必须在“受管文件”中明确列出该文件`,
    )
    usedRecords.set(record.path, record)
    if (record.impact === 'technical-only') technicalOnlyPaths.push(changedPath)
    else userVisiblePaths.push(changedPath)
  }

  for (const record of usedRecords.values()) {
    if (record.impact === 'technical-only') assertTechnicalOnlyDeclaration(record)
    else assertCompleteUserVisibleReview(record)
  }

  return {
    coveredPaths: changedPaths,
    recordPaths: [...usedRecords.keys()].sort(),
    technicalOnlyPaths: technicalOnlyPaths.sort(),
    userVisiblePaths: userVisiblePaths.sort(),
  }
}
