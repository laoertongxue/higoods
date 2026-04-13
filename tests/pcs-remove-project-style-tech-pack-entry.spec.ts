import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generateTechPackVersionFromPlateTask } from '../src/data/pcs-project-technical-data-writeback.ts'
import {
  handleProductStyleDetailEvent,
  renderProductStyleDetailPage,
} from '../src/pages/pcs-product-style-detail.ts'
import {
  handlePcsProjectDetailEvent,
  renderPcsProjectDetailPage,
} from '../src/pages/pcs-project-detail.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-project-work-item-detail.ts'
import { prepareTechPackTaskScenario } from './pcs-tech-pack-test-helper.ts'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const scenario = prepareTechPackTaskScenario()
const generated = generateTechPackVersionFromPlateTask(scenario.plateTaskId, '测试用户')

const styleSource = read('src/pages/pcs-product-style-detail.ts')
const projectSource = read('src/pages/pcs-project-detail.ts')
const workItemSource = read('src/pages/pcs-project-work-item-detail.ts')

assert.ok(!styleSource.includes('copy-technical-version'), '款式档案页不应保留复制技术包版本旧事件')
assert.ok(!styleSource.includes('createTechnicalDataVersionFromStyle'), '款式档案页不应再直接调用从款式创建技术包版本旧逻辑')
assert.ok(!projectSource.includes('createTechnicalDataVersionFromProject'), '商品项目页不应再直接调用从项目创建技术包版本旧逻辑')
assert.ok(!workItemSource.includes('createTechnicalDataVersionFromProject'), '项目节点页不应再直接调用从项目创建技术包版本旧逻辑')

renderProductStyleDetailPage(scenario.styleId)
handleProductStyleDetailEvent({
  closest: () => ({
    dataset: { styleDetailAction: 'set-tab', tabKey: 'technical' },
  }),
} as unknown as Element)
const styleHtml = renderProductStyleDetailPage(scenario.styleId)
assert.ok(!styleHtml.includes('新建技术包版本'), '款式档案页不应再出现新建技术包版本按钮')
assert.ok(!styleHtml.includes('复制为新版本'), '款式档案页不应再出现复制为新版本按钮')
assert.ok(styleHtml.includes('查看版本'), '款式档案页应保留查看版本入口')
assert.ok(styleHtml.includes('查看来源任务'), '款式档案页应保留查看来源任务入口')

renderPcsProjectDetailPage(scenario.projectId)
handlePcsProjectDetailEvent({
  closest: () => ({
    dataset: { pcsProjectDetailAction: 'select-work-item', workItemId: scenario.transferNodeId },
  }),
} as unknown as HTMLElement)
const projectHtml = renderPcsProjectDetailPage(scenario.projectId)
assert.ok(!projectHtml.includes('新建技术包版本'), '商品项目页不应再出现新建技术包版本按钮')
assert.ok(projectHtml.includes('查看技术包版本'), '商品项目页应保留查看技术包版本入口')
assert.ok(projectHtml.includes('来源任务链'), '商品项目页应展示来源任务链')

const workItemHtml = renderPcsProjectWorkItemDetailPage(scenario.projectId, scenario.transferNodeId)
assert.ok(!workItemHtml.includes('新建技术包版本'), '项目节点页不应再出现新建技术包版本按钮')
assert.ok(workItemHtml.includes('查看技术包版本'), '项目节点页应保留查看技术包版本入口')
assert.ok(workItemHtml.includes('来源任务链'), '项目节点页应展示来源任务链')
assert.ok(workItemHtml.includes(generated.record.technicalVersionCode), '项目节点页应展示已有关联技术包版本')

console.log('pcs-remove-project-style-tech-pack-entry.spec.ts PASS')
