import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const listPageSource = read('src/pages/pcs-projects.ts')
assert.ok(listPageSource.includes('buildProjectListViewModels'), '列表页必须调用项目视图模型')
assert.ok(!listPageSource.includes('PROJECT_SEEDS'), '列表页不允许以内置 PROJECT_SEEDS 作为主渲染源')

const detailPageSource = read('src/pages/pcs-project-detail.ts')
assert.ok(detailPageSource.includes('buildProjectDetailViewModel'), '详情页必须调用项目视图模型')
assert.ok(!detailPageSource.includes('PROJECT_INDEX'), '详情页不允许以内置 PROJECT_INDEX 作为主渲染源')
assert.ok(!detailPageSource.includes('PHASES'), '详情页不允许以内置 PHASES 作为主渲染源')
assert.ok(!detailPageSource.includes('WORK_ITEM_SEED'), '详情页不允许以内置 WORK_ITEM_SEED 作为主渲染源')
assert.ok(!detailPageSource.includes('getPhaseIdByName'), '详情页不允许再按中文阶段名猜当前阶段')

const nodeDetailSource = read('src/pages/pcs-project-work-item-detail.ts')
assert.ok(nodeDetailSource.includes('buildProjectNodeDetailViewModel'), '节点详情页必须直接读取真实项目节点')
assert.ok(!nodeDetailSource.includes('getPcsProjectDetailSnapshot'), '节点详情页不允许再通过详情页固定快照取数')

console.log('check-pcs-project-real-source.ts PASS')
