import assert from 'node:assert/strict'
import {
  renderPcsProjectCreatePage,
  renderPcsProjectDetailPage,
  renderPcsProjectListPage,
} from '../src/pages/pcs-projects.ts'
import { listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()
resetProjectChannelProductRepository()

const listHtml = await renderPcsProjectListPage()
assert.doesNotMatch(listHtml, /本页用于|该模块用于|帮助你|请先了解/, '项目列表不应再出现介绍性文案')
assert.match(listHtml, /商品项目列表/, '项目列表应保留标题')

const createHtml = await renderPcsProjectCreatePage()
assert.doesNotMatch(createHtml, /模板说明|创建新的商品项目工作空间|选择款式类型后，系统会自动推荐对应模板/, '项目创建页不应再出现介绍性说明')
assert.match(createHtml, /基础信息/, '项目创建页应保留基础信息')
assert.match(createHtml, /模板预览/, '项目创建页应保留模板预览')

const project = listProjects()[0]
assert.ok(project, '应存在项目数据')
const detailHtml = await renderPcsProjectDetailPage(project.projectId)
assert.doesNotMatch(detailHtml, /本页用于|该模块用于|流程说明|操作说明|任务说明/, '项目详情页不应再出现介绍性说明')
assert.match(detailHtml, /阶段与工作项/, '项目详情页应保留阶段与工作项')
assert.match(detailHtml, /项目日志/, '项目详情页应保留项目日志')

console.log('pcs-page-slimming-project-detail.spec.ts PASS')
