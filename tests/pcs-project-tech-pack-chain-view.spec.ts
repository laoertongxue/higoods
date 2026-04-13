import assert from 'node:assert/strict'
import {
  generateTechPackVersionFromPlateTask,
} from '../src/data/pcs-project-technical-data-writeback.ts'
import { renderPcsProjectDetailPage, handlePcsProjectDetailEvent } from '../src/pages/pcs-project-detail.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-project-work-item-detail.ts'
import {
  fillCoreTechPackContent,
  prepareTechPackTaskScenario,
  publishAndActivateTechPackVersion,
} from './pcs-tech-pack-test-helper.ts'

const scenario = prepareTechPackTaskScenario()
const created = generateTechPackVersionFromPlateTask(scenario.plateTaskId, '测试用户')
fillCoreTechPackContent(created.record.technicalVersionId, scenario.styleCode)
const { published } = publishAndActivateTechPackVersion(
  scenario.styleId,
  created.record.technicalVersionId,
  '测试用户',
)

renderPcsProjectDetailPage(scenario.projectId)
handlePcsProjectDetailEvent({
  closest: () => ({
    dataset: { pcsProjectDetailAction: 'select-work-item', workItemId: scenario.transferNodeId },
  }),
} as unknown as Element)

const projectHtml = renderPcsProjectDetailPage(scenario.projectId)
assert.ok(projectHtml.includes('技术包版本链路'), '项目详情页应保留技术包版本链路区块')
assert.ok(projectHtml.includes('最近关联版本编号'), '项目详情页应展示最近关联版本字段')
assert.ok(projectHtml.includes('当前生效版本编号'), '项目详情页应展示当前生效版本字段')
assert.ok(projectHtml.includes(published.technicalVersionCode), '项目详情页应展示已启用技术包版本编号')
assert.ok(projectHtml.includes('来源款式档案'), '项目详情页应展示来源款式档案字段')
assert.ok(!projectHtml.includes('新建技术包版本'), '项目详情页不应再出现创建技术包版本文案')

const workItemHtml = renderPcsProjectWorkItemDetailPage(scenario.projectId, scenario.transferNodeId)
assert.ok(workItemHtml.includes('最近关联技术包版本编号'), '项目节点详情页应展示最近关联版本字段')
assert.ok(workItemHtml.includes('当前生效版本编号'), '项目节点详情页应展示当前生效版本字段')
assert.ok(workItemHtml.includes(published.technicalVersionCode), '项目节点详情页应展示当前生效技术包版本编号')
assert.ok(workItemHtml.includes('来源款式档案'), '项目节点详情页应展示来源款式档案字段')
assert.ok(!workItemHtml.includes('新建技术包版本'), '项目节点详情页不应再出现创建技术包版本文案')

console.log('pcs-project-tech-pack-chain-view.spec.ts PASS')
