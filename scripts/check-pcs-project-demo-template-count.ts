import { listProjects } from '../src/data/pcs-project-repository.ts'

const REQUIRED_TEMPLATE_COUNTS: Record<string, number> = {
  'TPL-001': 4,
  'TPL-002': 4,
  'TPL-003': 4,
  'TPL-004': 4,
}

const projects = listProjects()
const templateCounts = new Map<string, number>()

projects.forEach((project) => {
  templateCounts.set(project.templateId, (templateCounts.get(project.templateId) || 0) + 1)
})

const errors: string[] = []

Object.entries(REQUIRED_TEMPLATE_COUNTS).forEach(([templateId, requiredCount]) => {
  const actualCount = templateCounts.get(templateId) || 0
  if (actualCount < requiredCount) {
    errors.push(`${templateId} 只有 ${actualCount} 个项目，缺 ${requiredCount - actualCount} 条`)
  }
})

if (errors.length > 0) {
  console.error('商品项目模板演示数据校验失败：')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('商品项目模板演示数据校验通过：')
Object.entries(REQUIRED_TEMPLATE_COUNTS).forEach(([templateId]) => {
  console.log(`- ${templateId}: ${templateCounts.get(templateId) || 0} 条`)
})
