import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routeSource = readFileSync(new URL('../src/router/routes.ts', import.meta.url), 'utf8')
assert.ok(routeSource.includes("'/pcs/projects/create': () => renderPcsProjectCreatePage()"), '项目创建页路由应已接入')
assert.ok(routeSource.includes('renderPcsProjectDetailPage(match[1])'), '项目详情页路由应已接入')
assert.ok(routeSource.includes('renderPcsProjectWorkItemDetailPage(projectId, projectNodeId)'), '项目工作项详情页路由应已接入')

const listPageSource = readFileSync(new URL('../src/pages/pcs-projects.ts', import.meta.url), 'utf8')
assert.ok(listPageSource.includes('buildProjectListViewModels'), '项目列表页应通过视图模型读取真实项目')
assert.ok(!listPageSource.includes('PROJECT_SEEDS'), '项目列表页不应再包含旧项目种子')
assert.ok(listPageSource.includes("appStore.navigate('/pcs/projects/create')"), '新建按钮应跳转到正式新建页')

const detailPageSource = readFileSync(new URL('../src/pages/pcs-project-detail.ts', import.meta.url), 'utf8')
assert.ok(detailPageSource.includes('buildProjectDetailViewModel'), '详情页应读取真实项目视图模型')
assert.ok(detailPageSource.includes('renderRelationSection'), '详情页应新增正式关联对象区域')
assert.ok(!detailPageSource.includes('WORK_ITEM_SEED'), '详情页不应再包含旧工作项种子')
assert.ok(!detailPageSource.includes('getPhaseIdByName'), '详情页不应再按中文阶段名称猜当前阶段')

const nodeDetailPageSource = readFileSync(new URL('../src/pages/pcs-project-work-item-detail.ts', import.meta.url), 'utf8')
assert.ok(nodeDetailPageSource.includes('buildProjectNodeDetailViewModel'), '节点详情页应直接读取真实节点')
assert.ok(nodeDetailPageSource.includes('renderRelationSection'), '节点详情页应新增正式关联对象区域')
assert.ok(!nodeDetailPageSource.includes('getPcsProjectDetailSnapshot'), '节点详情页不应再通过详情页快照取数')

console.log('pcs-project-pages.spec.ts PASS')
