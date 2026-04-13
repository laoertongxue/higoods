import assert from 'node:assert/strict'

import { buildProjectChannelProductChainSummary } from '../src/data/pcs-channel-product-project-repository.ts'
import { buildProjectDetailViewModel } from '../src/data/pcs-project-view-model.ts'
import {
  handlePcsProjectDetailEvent,
  renderPcsProjectDetailPage,
} from '../src/pages/pcs-project-detail.ts'
import { resolveProjectDetailSelectedNodeActions } from '../src/pages/pcs-project-detail-selected-node-actions.ts'
import {
  prepareProjectWithPassedTesting,
  resetProjectBusinessChainRepositories,
} from './pcs-project-formal-chain-helper.ts'

function getNode(detail: NonNullable<ReturnType<typeof buildProjectDetailViewModel>>, workItemTypeCode: string) {
  return detail.phases.flatMap((phase) => phase.nodes).find((node) => node.workItemTypeCode === workItemTypeCode)
}

function selectNode(workItemId: string) {
  handlePcsProjectDetailEvent({
    closest: () =>
      ({
        dataset: {
          pcsProjectDetailAction: 'select-work-item',
          workItemId,
        },
      }) as HTMLElement,
  } as HTMLElement)
}

resetProjectBusinessChainRepositories()

const terminatedDetail = buildProjectDetailViewModel('prj_20251216_025')
assert.ok(terminatedDetail, '应存在已终止项目用于验证历史节点动作')

const terminatedFocusNode = getNode(terminatedDetail!, terminatedDetail!.currentFocusWorkItemTypeCode)
const terminatedStyleNode = getNode(terminatedDetail!, 'STYLE_ARCHIVE_CREATE')
const terminatedTransferNode = getNode(terminatedDetail!, 'PROJECT_TRANSFER_PREP')
const terminatedChain = buildProjectChannelProductChainSummary(terminatedDetail!.projectId)

assert.ok(terminatedFocusNode && terminatedStyleNode && terminatedTransferNode && terminatedChain, '终止项目应具备必要节点与链路摘要')

const terminatedStyleResolution = resolveProjectDetailSelectedNodeActions(
  terminatedDetail!,
  terminatedStyleNode!,
  terminatedFocusNode!,
  terminatedChain!,
)
assert.ok(
  !terminatedStyleResolution.actions.some((item) => item.key === 'generate-style-archive'),
  '已终止项目选中历史 STYLE_ARCHIVE_CREATE 时不应显示生成款式档案',
)

const terminatedTransferResolution = resolveProjectDetailSelectedNodeActions(
  terminatedDetail!,
  terminatedTransferNode!,
  terminatedFocusNode!,
  terminatedChain!,
)
assert.ok(
  !terminatedTransferResolution.actions.some((item) => item.key === 'create-project-archive'),
  '已终止项目选中历史 PROJECT_TRANSFER_PREP 时不应显示创建项目资料归档',
)

renderPcsProjectDetailPage(terminatedDetail!.projectId)
selectNode(terminatedStyleNode!.projectNodeId)
const terminatedStyleHtml = renderPcsProjectDetailPage(terminatedDetail!.projectId)
assert.ok(
  !terminatedStyleHtml.includes('data-pcs-project-detail-selected-action="generate-style-archive"'),
  '已终止项目的中间节点卡片不应渲染生成款式档案动作',
)

selectNode(terminatedTransferNode!.projectNodeId)
const terminatedTransferHtml = renderPcsProjectDetailPage(terminatedDetail!.projectId)
assert.ok(
  !terminatedTransferHtml.includes('data-pcs-project-detail-selected-action="create-project-archive"'),
  '已终止项目的中间节点卡片不应渲染创建项目资料归档动作',
)

const passProject = prepareProjectWithPassedTesting('项目详情页选中节点动作测试项目')
const passDetail = buildProjectDetailViewModel(passProject.projectId)
assert.ok(passDetail, '测款通过项目应能读取详情')

const passFocusNode = getNode(passDetail!, passDetail!.currentFocusWorkItemTypeCode)
const passStyleNode = getNode(passDetail!, 'STYLE_ARCHIVE_CREATE')
const passChain = buildProjectChannelProductChainSummary(passProject.projectId)

assert.ok(passFocusNode && passStyleNode && passChain, '测款通过项目应具备款式档案节点与渠道链路')

const passStyleResolution = resolveProjectDetailSelectedNodeActions(
  passDetail!,
  passStyleNode!,
  passFocusNode!,
  passChain!,
)
assert.ok(
  passStyleResolution.actions.some((item) => item.key === 'generate-style-archive'),
  '测款通过且条件满足时，选中 STYLE_ARCHIVE_CREATE 应显示生成款式档案',
)

renderPcsProjectDetailPage(passProject.projectId)
selectNode(passStyleNode!.projectNodeId)
const passStyleHtml = renderPcsProjectDetailPage(passProject.projectId)
assert.ok(
  passStyleHtml.includes('data-pcs-project-detail-selected-action="generate-style-archive"'),
  '测款通过项目的中间节点卡片应渲染生成款式档案动作',
)

assert.ok(
  !passStyleHtml.includes('项目模板口径：已按正式领域契约锁定'),
  '项目详情页默认业务视图不应再显示项目模板口径技术文案',
)
assert.ok(!passStyleHtml.includes('正式关联'), '项目详情页默认业务视图不应再显示正式关联')
assert.ok(!passStyleHtml.includes('未挂项目工作项'), '项目详情页默认业务视图不应再显示未挂项目工作项')
assert.ok(!passStyleHtml.includes('来源对象类型'), '项目详情页默认业务视图不应再显示来源对象类型')
assert.ok(!passStyleHtml.includes('关系角色'), '项目详情页默认业务视图不应再显示关系角色')

console.log('pcs-project-detail-selected-node-actions.spec.ts PASS')
