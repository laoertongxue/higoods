import { listProjectArchives } from '../src/data/pcs-project-archive-repository.ts'
import { listProjectChannelProducts } from '../src/data/pcs-channel-product-project-repository.ts'
import { createTaskBootstrapSnapshot } from '../src/data/pcs-task-bootstrap.ts'
import { createTestingRelationBootstrapSnapshot } from '../src/data/pcs-testing-relation-bootstrap.ts'
import { listStyleArchives } from '../src/data/pcs-style-archive-repository.ts'
import { listTechnicalDataVersions } from '../src/data/pcs-technical-data-version-repository.ts'

function countUnique(values: Array<string | null | undefined>): number {
  return new Set(values.filter((value): value is string => Boolean(value))).size
}

const channelProducts = listProjectChannelProducts()
const taskSnapshot = createTaskBootstrapSnapshot()
const testingRelations = createTestingRelationBootstrapSnapshot()
const styleArchives = listStyleArchives()
const technicalVersions = listTechnicalDataVersions()
const projectArchives = listProjectArchives()

const coverageChecks = [
  {
    label: '商品上架 / 渠道商品',
    count: countUnique(channelProducts.map((item) => item.projectCode)),
  },
  {
    label: '直播测款',
    count: countUnique(
      testingRelations.relations
        .filter((item) => item.sourceModule === '直播')
        .map((item) => item.projectCode),
    ),
  },
  {
    label: '短视频测款',
    count: countUnique(
      testingRelations.relations
        .filter((item) => item.sourceModule === '短视频')
        .map((item) => item.projectCode),
    ),
  },
  {
    label: '改版任务',
    count: countUnique(taskSnapshot.revisionTasks.map((item) => item.projectCode)),
  },
  {
    label: '制版任务',
    count: countUnique(taskSnapshot.plateTasks.map((item) => item.projectCode)),
  },
  {
    label: '花型任务',
    count: countUnique(taskSnapshot.patternTasks.map((item) => item.projectCode)),
  },
  {
    label: '首版样衣打样',
    count: countUnique(taskSnapshot.firstSampleTasks.map((item) => item.projectCode)),
  },
  {
    label: '产前版样衣',
    count: countUnique(taskSnapshot.preProductionSampleTasks.map((item) => item.projectCode)),
  },
  {
    label: '款式档案',
    count: countUnique(styleArchives.map((item) => item.sourceProjectCode)),
  },
  {
    label: '技术包版本',
    count: countUnique(technicalVersions.map((item) => item.sourceProjectCode)),
  },
  {
    label: '项目资料归档',
    count: countUnique(projectArchives.map((item) => item.projectCode)),
  },
]

const branchChecks = [
  { label: '测款通过，已创建款式档案但技术包未启用', count: channelProducts.filter((item) => item.scenario === 'STYLE_PENDING_TECH').length },
  { label: '测款通过，技术包已启用，款式档案可生产，上游商品已更新', count: channelProducts.filter((item) => item.scenario === 'STYLE_ACTIVE').length },
  { label: '测款调整，渠道商品已作废，并创建改版任务', count: channelProducts.filter((item) => item.scenario === 'FAILED_ADJUST').length },
  { label: '测款暂缓，渠道商品已作废，项目阻塞', count: channelProducts.filter((item) => item.scenario === 'FAILED_PAUSED').length },
  { label: '测款淘汰，渠道商品已作废，项目终止', count: channelProducts.filter((item) => item.scenario === 'FAILED_ELIMINATED').length },
]

const errors: string[] = []

coverageChecks.forEach((check) => {
  if (check.count < 4) {
    errors.push(`${check.label} 只有 ${check.count} 条项目级关联，缺 ${4 - check.count} 条`)
  }
})

branchChecks.forEach((check) => {
  if (check.count < 4) {
    errors.push(`${check.label} 只有 ${check.count} 条，缺 ${4 - check.count} 条`)
  }
})

if (errors.length > 0) {
  console.error('商品项目演示链路覆盖校验失败：')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('商品项目演示链路覆盖校验通过：')
coverageChecks.forEach((check) => console.log(`- ${check.label}: ${check.count} 条项目级关联`))
branchChecks.forEach((check) => console.log(`- ${check.label}: ${check.count} 条`))
