import assert from 'node:assert/strict'

import { renderPcsEngineeringMasterListPage } from '../src/pages/pcs-engineering-master-list.ts'
import { renderPcsEngineeringMasterDetailPage } from '../src/pages/pcs-engineering-master-detail.ts'

// 标准列表页骨架：页面容器与分页容器必须存在
const listHtml = renderPcsEngineeringMasterListPage()
assert.match(listHtml, /data-standard-list-page/)
assert.match(listHtml, /data-table-pagination/)

// 任务执行表格：按任务逐行展示专业类型、阶段、负责人、依赖、时间和状态
const detailHtml = renderPcsEngineeringMasterDetailPage('EM-001')
assert.match(detailHtml, /制版|产前版样衣|花型|调色|辅料下单|技术包确认/)
assert.match(detailHtml, /data-engineering-task-table/)
for (const column of ['任务', '阶段', '专业类型', '负责人', '固定前置', '当前节点', '计划／实际', '状态']) {
  assert.match(detailHtml, new RegExp(column), `工程任务表格缺少列：${column}`)
}
assert.match(detailHtml, /data-engineering-task-card/)

// 主单只做任务总览；点击名称直接进入对应专业任务详情，不再使用旧抽屉推进。
assert.match(detailHtml, /data-nav="\/pcs\/(patterns\/plate-making|samples\/first-order|patterns\/artwork|engineering\/color|engineering\/purchase|engineering\/tech-pack)\//)
assert.doesNotMatch(detailHtml, /open-task-drawer|close-task-drawer|data-engineering-master-region="drawer"/)

// 依赖只读：不允许出现人工调整依赖或删除依赖入口
assert.doesNotMatch(detailHtml, /调整依赖|删除依赖/)

// 当前演示主单未通过关闭门禁时，不展示关闭入口。
assert.doesNotMatch(detailHtml, /data-pcs-engineering-master-action="close-master-order"/)

console.log('pcs-engineering-master-pages.spec.ts PASS')
