import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generateTechPackVersionFromPlateTask, publishTechnicalDataVersion } from '../src/data/pcs-project-technical-data-writeback.ts'
import { renderProductStyleDetailPage, handleProductStyleDetailEvent } from '../src/pages/pcs-product-style-detail.ts'
import { renderPcsProjectDetailPage, handlePcsProjectDetailEvent } from '../src/pages/pcs-project-detail.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-project-work-item-detail.ts'
import {
  fillCoreTechPackContent,
  prepareTechPackTaskScenario,
} from './pcs-tech-pack-test-helper.ts'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const scenario = prepareTechPackTaskScenario()
const draft = generateTechPackVersionFromPlateTask(scenario.plateTaskId, '测试用户')

renderProductStyleDetailPage(scenario.styleId)
handleProductStyleDetailEvent({
  closest: () => ({
    dataset: { styleDetailAction: 'set-tab', tabKey: 'technical' },
  }),
} as unknown as Element)

const draftHtml = renderProductStyleDetailPage(scenario.styleId)
assert.ok(!draftHtml.includes('新建技术包版本'), '款式档案页不应再出现新建技术包版本按钮')
assert.ok(!draftHtml.includes('复制为新版本'), '款式档案页不应再出现复制为新版本按钮')
assert.ok(!draftHtml.includes('启用为当前生效版本'), '草稿技术包版本不应出现启用按钮')

fillCoreTechPackContent(draft.record.technicalVersionId, scenario.styleCode)
publishTechnicalDataVersion(draft.record.technicalVersionId, '测试用户')
const publishedHtml = renderProductStyleDetailPage(scenario.styleId)
assert.ok(publishedHtml.includes('启用为当前生效版本'), '已发布但未启用的技术包版本应出现启用按钮')

renderPcsProjectDetailPage(scenario.projectId)
handlePcsProjectDetailEvent({
  closest: () => ({
    dataset: { pcsProjectDetailAction: 'select-work-item', workItemId: scenario.transferNodeId },
  }),
} as unknown as Element)
const projectHtml = renderPcsProjectDetailPage(scenario.projectId)
assert.ok(!projectHtml.includes('新建技术包版本'), '项目详情页不应再出现新建技术包版本按钮')

const workItemHtml = renderPcsProjectWorkItemDetailPage(scenario.projectId, scenario.transferNodeId)
assert.ok(!workItemHtml.includes('新建技术包版本'), '项目节点详情页不应再出现新建技术包版本按钮')

const typeSource = read('src/data/pcs-technical-data-version-types.ts')
assert.ok(!typeSource.includes('effectiveFlag'), '正式技术包版本类型中不应再保留 effectiveFlag')

console.log('pcs-style-tech-pack-responsibility.spec.ts PASS')
