import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const relationTypesSource = read('src/data/pcs-project-relation-types.ts')
assert.ok(relationTypesSource.includes('sourceLineId'), '项目关系模型必须包含 sourceLineId')
assert.ok(relationTypesSource.includes('sourceLineCode'), '项目关系模型必须包含 sourceLineCode')

const relationRepositorySource = read('src/data/pcs-project-relation-repository.ts')
assert.ok(relationRepositorySource.includes('listProjectRelationsByProject('), '项目关系仓储必须支持按项目查询')
assert.ok(relationRepositorySource.includes('listProjectRelationsByProjectNode('), '项目关系仓储必须支持按项目节点查询')

const bootstrapSource = read('src/data/pcs-project-relation-bootstrap.ts')
assert.ok(!bootstrapSource.includes('直播场次'), '项目关系初始化不允许把直播场次头直接写成正式关系记录')

const detailPageSource = read('src/pages/pcs-project-detail.ts')
assert.ok(detailPageSource.includes('relationSection'), '项目详情页必须使用正式关系视图数据')
assert.ok(!detailPageSource.includes('PROJECT_INDEX'), '项目详情页不允许再以内置固定种子拼关联对象')
assert.ok(!detailPageSource.includes('WORK_ITEM_SEED'), '项目详情页不允许再以内置工作项种子拼关联对象')

const nodeDetailPageSource = read('src/pages/pcs-project-work-item-detail.ts')
assert.ok(nodeDetailPageSource.includes('relationSection'), '项目工作项详情页必须使用正式关系视图数据')
assert.ok(!nodeDetailPageSource.includes('getPcsProjectDetailSnapshot'), '项目工作项详情页不允许再通过固定快照拼关联对象')

console.log('check-pcs-project-relation-source.ts PASS')
