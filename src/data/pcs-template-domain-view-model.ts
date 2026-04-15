import {
  getProjectTemplateSchema,
  getProjectWorkItemContract,
  listProjectTemplateSchemas,
  type PcsProjectWorkItemCode,
} from './pcs-project-domain-contract.ts'
import type {
  ProjectTemplateNodeDefinition,
  ProjectTemplateStageDefinition,
} from './pcs-project-definition-normalizer.ts'
import type { ProjectTemplate, TemplateStyleType } from './pcs-templates.ts'

export type TemplateBusinessClosureStatus = '完整闭环' | '仅测款不转档' | '配置异常'

export interface TemplateBusinessIssue {
  code: string
  message: string
}

export interface TemplateNodeEditRule {
  optional: boolean
  allowDisable: boolean
  allowReorder: boolean
  allowRequiredSwitch: boolean
}

export interface TemplateBusinessSummary {
  scenarioSummary: string
  closureStatus: TemplateBusinessClosureStatus
  closureText: string
  issues: TemplateBusinessIssue[]
  hasChannelProductListing: boolean
  hasLiveTest: boolean
  hasVideoTest: boolean
  hasStyleArchiveCreate: boolean
  hasTransferPrep: boolean
  hasFullLoop: boolean
  pathFlags: string[]
  previewPhases: Array<{
    phaseCode: string
    phaseName: string
    nodeNames: string[]
  }>
}

const OPTIONAL_NODE_RULES: Record<TemplateStyleType, Partial<Record<PcsProjectWorkItemCode, TemplateNodeEditRule>>> = {
  基础款: {
    SAMPLE_RETAIN_REVIEW: { optional: true, allowDisable: true, allowReorder: true, allowRequiredSwitch: true },
    SAMPLE_RETURN_HANDLE: { optional: true, allowDisable: true, allowReorder: true, allowRequiredSwitch: true },
  },
  快时尚款: {
    SAMPLE_RETAIN_REVIEW: { optional: true, allowDisable: true, allowReorder: true, allowRequiredSwitch: true },
  },
  改版款: {
    SAMPLE_RETAIN_REVIEW: { optional: true, allowDisable: true, allowReorder: true, allowRequiredSwitch: true },
  },
  设计款: {
    PATTERN_ARTWORK_TASK: { optional: true, allowDisable: true, allowReorder: true, allowRequiredSwitch: true },
    PRE_PRODUCTION_SAMPLE: { optional: true, allowDisable: true, allowReorder: true, allowRequiredSwitch: true },
    SAMPLE_RETAIN_REVIEW: { optional: true, allowDisable: true, allowReorder: true, allowRequiredSwitch: true },
    SAMPLE_RETURN_HANDLE: { optional: true, allowDisable: true, allowReorder: true, allowRequiredSwitch: true },
  },
}

function getPrimaryStyleType(styleType: TemplateStyleType[]): TemplateStyleType | null {
  return styleType[0] ?? null
}

function listActiveNodes(nodes: ProjectTemplateNodeDefinition[]): ProjectTemplateNodeDefinition[] {
  return nodes.filter((item) => item.enabledFlag !== false)
}

function listPhaseNodeCodes(
  phaseCode: string,
  nodes: ProjectTemplateNodeDefinition[],
): PcsProjectWorkItemCode[] {
  return listActiveNodes(nodes)
    .filter((item) => item.phaseCode === phaseCode)
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
    .map((item) => item.workItemTypeCode as PcsProjectWorkItemCode)
}

export function getTemplateNodeEditRule(
  styleType: TemplateStyleType,
  workItemTypeCode: PcsProjectWorkItemCode,
): TemplateNodeEditRule {
  return (
    OPTIONAL_NODE_RULES[styleType]?.[workItemTypeCode] ?? {
      optional: false,
      allowDisable: false,
      allowReorder: false,
      allowRequiredSwitch: false,
    }
  )
}

export function validateTemplateBusinessIntegrity(input: {
  styleType: TemplateStyleType
  stages: ProjectTemplateStageDefinition[]
  nodes: ProjectTemplateNodeDefinition[]
}): TemplateBusinessIssue[] {
  const schema = listProjectTemplateSchemas().find((item) => item.styleTypes.includes(input.styleType))
  if (!schema) {
    return [{ code: 'MISSING_SCHEMA', message: `未找到适用款式类型 ${input.styleType} 的正式模板矩阵。` }]
  }

  const issues: TemplateBusinessIssue[] = []
  const expectedPhaseCodes = schema.phaseSchemas.map((item) => item.phaseCode)
  const actualPhaseCodes = input.stages
    .slice()
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
    .map((item) => item.phaseCode)

  if (JSON.stringify(expectedPhaseCodes) !== JSON.stringify(actualPhaseCodes)) {
    issues.push({ code: 'INVALID_PHASES', message: '模板阶段必须严格使用正式模板矩阵，不允许自由增删阶段。' })
  }

  schema.phaseSchemas.forEach((phase) => {
    const allowedCodes = phase.nodeCodes
    const activeCodes = listPhaseNodeCodes(phase.phaseCode, input.nodes)
    const invalidCode = activeCodes.find((code) => !allowedCodes.includes(code))
    if (invalidCode) {
      issues.push({
        code: `INVALID_NODE_${phase.phaseCode}`,
        message: `${phase.phaseCode} 存在不属于正式矩阵的节点：${invalidCode}。`,
      })
    }
    const missingRequired = allowedCodes.filter((code) => {
      const rule = getTemplateNodeEditRule(input.styleType, code)
      return !rule.optional && !activeCodes.includes(code)
    })
    if (missingRequired.length > 0) {
      issues.push({
        code: `MISSING_REQUIRED_${phase.phaseCode}`,
        message: `${phase.phaseCode} 缺少正式必做节点：${missingRequired.join('、')}。`,
      })
    }
  })

  const activeCodes = new Set(listActiveNodes(input.nodes).map((item) => item.workItemTypeCode as PcsProjectWorkItemCode))
  const hasMarketTest = activeCodes.has('LIVE_TEST') || activeCodes.has('VIDEO_TEST')
  const hasDownstreamProduction = ['PROJECT_TRANSFER_PREP', 'PATTERN_TASK', 'PATTERN_ARTWORK_TASK', 'FIRST_SAMPLE', 'PRE_PRODUCTION_SAMPLE'].some((code) =>
    activeCodes.has(code as PcsProjectWorkItemCode),
  )

  if (hasMarketTest && !activeCodes.has('CHANNEL_PRODUCT_LISTING')) {
    issues.push({
      code: 'MISSING_CHANNEL_LISTING',
      message: '存在直播测款或短视频测款时，必须包含商品上架节点。',
    })
  }

  if (activeCodes.has('STYLE_ARCHIVE_CREATE') && !activeCodes.has('PROJECT_TRANSFER_PREP')) {
    issues.push({
      code: 'MISSING_TRANSFER_PREP',
      message: '存在款式档案生成节点时，必须包含项目转档准备节点。',
    })
  }

  if (hasDownstreamProduction && !activeCodes.has('STYLE_ARCHIVE_CREATE')) {
    issues.push({
      code: 'MISSING_STYLE_ARCHIVE',
      message: '模板存在测款通过后的开发推进链路时，必须包含款式档案生成节点。',
    })
  }

  if (!listPhaseNodeCodes('PHASE_03', input.nodes).includes('TEST_CONCLUSION')) {
    issues.push({
      code: 'PHASE_03_MISSING_CONCLUSION',
      message: '市场测款阶段必须包含测款结论判定节点。',
    })
  }

  if (!listPhaseNodeCodes('PHASE_04', input.nodes).includes('STYLE_ARCHIVE_CREATE')) {
    issues.push({
      code: 'PHASE_04_MISSING_STYLE_ARCHIVE',
      message: '款式档案与开发推进阶段必须包含款式档案生成节点。',
    })
  }

  return issues
}

export function buildTemplateBusinessSummary(template: ProjectTemplate): TemplateBusinessSummary {
  const styleType = getPrimaryStyleType(template.styleType)
  const schema = styleType
    ? listProjectTemplateSchemas().find((item) => item.styleTypes.includes(styleType))
    : null
  const issues = styleType
    ? validateTemplateBusinessIntegrity({
        styleType,
        stages: template.stages,
        nodes: template.nodes,
      })
    : [{ code: 'MISSING_STYLE_TYPE', message: '模板缺少适用款式类型。' }]

  const activeNodes = listActiveNodes(template.nodes)
  const activeCodes = new Set(activeNodes.map((item) => item.workItemTypeCode as PcsProjectWorkItemCode))
  const hasChannelProductListing = activeCodes.has('CHANNEL_PRODUCT_LISTING')
  const hasLiveTest = activeCodes.has('LIVE_TEST')
  const hasVideoTest = activeCodes.has('VIDEO_TEST')
  const hasStyleArchiveCreate = activeCodes.has('STYLE_ARCHIVE_CREATE')
  const hasTransferPrep = activeCodes.has('PROJECT_TRANSFER_PREP')
  const hasFullLoop =
    hasChannelProductListing &&
    (hasLiveTest || hasVideoTest) &&
    activeCodes.has('TEST_CONCLUSION') &&
    hasStyleArchiveCreate &&
    hasTransferPrep

  const closureStatus: TemplateBusinessClosureStatus =
    issues.length > 0 ? '配置异常' : hasFullLoop ? '完整闭环' : '仅测款不转档'
  const closureText =
    closureStatus === '完整闭环'
      ? '模板已覆盖测款、款式档案、技术包与项目资料归档链路。'
      : closureStatus === '仅测款不转档'
        ? '模板只覆盖市场测款，不足以进入款式档案与技术包闭环。'
        : issues.map((item) => item.message).join('；')

  const pathFlags = [
    hasChannelProductListing ? '包含商品上架' : '缺少商品上架',
    hasLiveTest ? '包含直播测款' : '不含直播测款',
    hasVideoTest ? '包含短视频测款' : '不含短视频测款',
    activeCodes.has('PATTERN_ARTWORK_TASK') ? '包含花型任务' : '不含花型任务',
    activeCodes.has('FIRST_SAMPLE') ? '包含首版样衣' : '不含首版样衣',
    activeCodes.has('PRE_PRODUCTION_SAMPLE') ? '包含产前样衣' : '不含产前样衣',
  ]

  const previewPhases = template.stages
    .slice()
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
    .map((phase) => ({
      phaseCode: phase.phaseCode,
      phaseName: phase.phaseName,
      nodeNames: activeNodes
        .filter((item) => item.phaseCode === phase.phaseCode)
        .sort((a, b) => a.sequenceNo - b.sequenceNo)
        .map((item) => item.workItemTypeName),
    }))

  return {
    scenarioSummary: schema?.scenario || template.scenario || template.description,
    closureStatus,
    closureText,
    issues,
    hasChannelProductListing,
    hasLiveTest,
    hasVideoTest,
    hasStyleArchiveCreate,
    hasTransferPrep,
    hasFullLoop,
    pathFlags,
    previewPhases,
  }
}

export function buildTemplateRecommendedDraft(styleType: TemplateStyleType) {
  const schema = listProjectTemplateSchemas().find((item) => item.styleTypes.includes(styleType))
  if (!schema) {
    throw new Error(`未找到适用款式类型 ${styleType} 的推荐模板。`)
  }
  return getProjectTemplateSchema(schema.templateId)
}

export function buildTemplateTripletNote(): string {
  return '三码关系在“渠道店铺商品已创建”“上游渠道商品已上架”“测款通过并生成款式档案”后正式建立：渠道店铺商品编码在创建渠道店铺商品时生成，上游渠道商品编码在发起上架成功后回填，款式档案编码在生成款式档案时回填，三者在款式档案回写时完成关联。'
}

export function buildTemplateNodeFieldSourceRows(workItemTypeCode: PcsProjectWorkItemCode) {
  const contract = getProjectWorkItemContract(workItemTypeCode)
  return contract.fieldDefinitions.map((field) => ({
    fieldLabel: field.label,
    sourceText: `${field.sourceKind} / ${field.sourceRef}`,
    definitionText: `${field.meaning}；${field.businessLogic}`,
    requiredText: field.required ? '是' : '否',
    readonlyText: field.readonly ? '是' : '否',
  }))
}
