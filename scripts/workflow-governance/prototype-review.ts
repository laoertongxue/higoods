import assert from 'node:assert/strict'

const DESIGN_GUIDELINES = 'docs/higood-indonesia-factory-product-design-guidelines.md'
const REVIEW_CHECKLIST = 'docs/higood-indonesia-factory-prototype-review-checklist.md'

export interface ReviewRecordSource {
  path: string
  source: string
}

export interface PrototypeReviewCoverage {
  coveredPaths: string[]
  recordPaths: string[]
}

interface ParsedReviewRecord {
  path: string
  managedFiles: string[]
  verificationCommands: string[]
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

function parseReviewRecord(record: ReviewRecordSource): ParsedReviewRecord {
  const verificationSection = readSubsection(record.source, '验证命令')
  return {
    path: normalizePath(record.path),
    managedFiles: readCodeList(readSubsection(record.source, '受管文件')),
    verificationCommands: readCodeList(verificationSection),
    exceptions: readTextList(readSubsection(record.source, '例外')),
    hasGuidelineReferences:
      record.source.includes(DESIGN_GUIDELINES)
      && record.source.includes(REVIEW_CHECKLIST),
    hasSelfCheck:
      /^##\s+3\.\s+自查结论\s*$/m.test(record.source)
      && /\|\s*(?:通过|有条件通过|不通过)\s*\|/.test(record.source),
    hasFinalConclusion:
      /^##\s+6\.\s+最终结论\s*$/m.test(record.source)
      && /结论[：:]\s*(?:通过|有条件通过|不通过)/.test(record.source),
  }
}

function assertCompleteRecord(record: ParsedReviewRecord): void {
  assert(record.hasGuidelineReferences, `${record.path} 缺少两份项目设计规范引用`)
  assert(record.hasSelfCheck, `${record.path} 缺少有效自查结论`)
  assert(record.hasFinalConclusion, `${record.path} 缺少最终结论`)
  assert(record.managedFiles.length > 0, `${record.path} 缺少受管文件`)
  assert(record.verificationCommands.length > 0, `${record.path} 缺少验证命令`)
  assert(record.exceptions.length > 0, `${record.path} 缺少例外说明；无例外时填写“- 无”`)
}

export function validatePrototypeReviewCoverage(
  prototypeChanges: string[],
  recordSources: ReviewRecordSource[],
): PrototypeReviewCoverage {
  const changedPaths = [...new Set(prototypeChanges.map(normalizePath))].sort()
  const records = recordSources.map(parseReviewRecord)
  const usedRecords = new Map<string, ParsedReviewRecord>()

  for (const changedPath of changedPaths) {
    const record = records.find((candidate) => candidate.managedFiles.includes(changedPath))
    assert(
      record,
      `${changedPath} 没有关联的原型审查记录；记录必须在“受管文件”中明确列出该文件`,
    )
    usedRecords.set(record.path, record)
  }

  for (const record of usedRecords.values()) assertCompleteRecord(record)

  return {
    coveredPaths: changedPaths,
    recordPaths: [...usedRecords.keys()].sort(),
  }
}
