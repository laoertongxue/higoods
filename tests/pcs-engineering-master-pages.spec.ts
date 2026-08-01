import assert from 'node:assert/strict'

import { renderPcsEngineeringMasterListPage } from '../src/pages/pcs-engineering-master-list.ts'
import { renderPcsEngineeringMasterDetailPage } from '../src/pages/pcs-engineering-master-detail.ts'

// 标准列表页骨架：页面容器与分页容器必须存在
const listHtml = renderPcsEngineeringMasterListPage()
assert.match(listHtml, /data-standard-list-page/)
assert.match(listHtml, /data-table-pagination/)

// 全宽泳道工作台：包含专业任务类型泳道与任务卡
const detailHtml = renderPcsEngineeringMasterDetailPage('EM-001')
assert.match(detailHtml, /制版|产前版样衣|花型|调色|辅料下单|技术包确认/)
assert.match(detailHtml, /data-engineering-task-card/)

// 任务卡必须声明局部交互，避免打开抽屉后整页重渲染清空抽屉
assert.match(detailHtml, /data-skip-page-rerender="true" data-pcs-engineering-master-action="open-task-drawer"/)

// 依赖只读：不允许出现人工调整依赖或删除依赖入口
assert.doesNotMatch(detailHtml, /调整依赖|删除依赖/)

console.log('pcs-engineering-master-pages.spec.ts PASS')
