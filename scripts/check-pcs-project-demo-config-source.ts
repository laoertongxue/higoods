import {
  listProjectWorkspaceAges,
  listProjectWorkspaceBrands,
  listProjectWorkspaceCategories,
  listProjectWorkspaceCrowdPositioning,
  listProjectWorkspaceCrowds,
  listProjectWorkspaceProductPositioning,
  listProjectWorkspaceStyleCodes,
  listProjectWorkspaceStyles,
} from '../src/data/pcs-project-config-workspace-adapter.ts'
import { listProjects } from '../src/data/pcs-project-repository.ts'

function buildOptionMap(items: Array<{ id: string; name: string }>): Map<string, string> {
  return new Map(items.map((item) => [item.id, item.name]))
}

function validateArrayField(
  projectCode: string,
  fieldLabel: string,
  ids: string[],
  names: string[],
  optionMap: Map<string, string>,
  errors: string[],
): void {
  if (ids.length === 0) {
    errors.push(`project ${projectCode} 的 ${fieldLabel} 为空，未引用配置工作台维度`)
    return
  }
  ids.forEach((id, index) => {
    const expectedName = optionMap.get(id)
    if (!expectedName) {
      errors.push(`project ${projectCode} 的 ${fieldLabel} ${id} 不在配置工作台维度中`)
      return
    }
    if ((names[index] || '') !== expectedName) {
      errors.push(`project ${projectCode} 的 ${fieldLabel} ${id} 名称不匹配，期望 ${expectedName}，实际 ${names[index] || '空'}`)
    }
  })
}

const brandMap = buildOptionMap(listProjectWorkspaceBrands())
const categoryMap = buildOptionMap(listProjectWorkspaceCategories())
const styleCodeMap = buildOptionMap(listProjectWorkspaceStyleCodes())
const styleMap = buildOptionMap(listProjectWorkspaceStyles())
const crowdPositioningMap = buildOptionMap(listProjectWorkspaceCrowdPositioning())
const ageMap = buildOptionMap(listProjectWorkspaceAges())
const crowdMap = buildOptionMap(listProjectWorkspaceCrowds())
const productPositioningMap = buildOptionMap(listProjectWorkspaceProductPositioning())

const errors: string[] = []

listProjects().forEach((project) => {
  if (!brandMap.has(project.brandId)) {
    errors.push(`project ${project.projectCode} 的 brandId 不在配置工作台 brands 维度中`)
  } else if (brandMap.get(project.brandId) !== project.brandName) {
    errors.push(`project ${project.projectCode} 的 brandName 与配置工作台不一致`)
  }

  if (!categoryMap.has(project.categoryId)) {
    errors.push(`project ${project.projectCode} 的 categoryId 不在配置工作台 categories 维度中`)
  } else if (categoryMap.get(project.categoryId) !== project.categoryName) {
    errors.push(`project ${project.projectCode} 的 categoryName 与配置工作台不一致`)
  }

  if (!styleCodeMap.has(project.styleCodeId)) {
    errors.push(`project ${project.projectCode} 的 styleCodeId 不在配置工作台 styleCodes 维度中`)
  } else if (styleCodeMap.get(project.styleCodeId) !== project.styleCodeName) {
    errors.push(`project ${project.projectCode} 的 styleCodeName 与配置工作台不一致`)
  }

  validateArrayField(project.projectCode, 'styleTagIds', project.styleTagIds, project.styleTagNames, styleMap, errors)
  validateArrayField(project.projectCode, 'crowdPositioningIds', project.crowdPositioningIds, project.crowdPositioningNames, crowdPositioningMap, errors)
  validateArrayField(project.projectCode, 'ageIds', project.ageIds, project.ageNames, ageMap, errors)
  validateArrayField(project.projectCode, 'crowdIds', project.crowdIds, project.crowdNames, crowdMap, errors)
  validateArrayField(project.projectCode, 'productPositioningIds', project.productPositioningIds, project.productPositioningNames, productPositioningMap, errors)
})

if (errors.length > 0) {
  console.error('商品项目配置工作台来源校验失败：')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('商品项目配置工作台来源校验通过：')
console.log(`- 项目总数：${listProjects().length}`)
console.log(`- 品牌维度：${brandMap.size} 条`)
console.log(`- 品类维度：${categoryMap.size} 条`)
console.log(`- 风格维度：${styleMap.size} 条`)
console.log(`- 风格编号维度：${styleCodeMap.size} 条`)
