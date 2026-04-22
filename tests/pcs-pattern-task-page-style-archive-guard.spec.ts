import assert from 'node:assert/strict'

import { getPatternTechPackActionMeta } from '../src/data/pcs-tech-pack-task-generation.ts'
import { listPatternTasks, updatePatternTask } from '../src/data/pcs-pattern-task-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'
import {
  renderPcsPatternTaskPage,
  resetPcsEngineeringTaskRepositories,
  resetPcsEngineeringTaskState,
} from '../src/pages/pcs-engineering-tasks.ts'

resetProjectRepository()
resetStyleArchiveRepository()
resetTechnicalDataVersionRepository()
resetProjectRelationRepository()
resetPcsEngineeringTaskRepositories()
resetPcsEngineeringTaskState()

const targetTask = listPatternTasks().find((item) => item.status === '已确认' || item.status === '已完成')
assert.ok(targetTask, '应存在可用于页面回归验证的花型任务')

updatePatternTask(targetTask.patternTaskId, {
  projectId: 'prj_pattern_missing_style_archive',
  productStyleCode: 'SPU-MISSING-STYLE-ARCHIVE',
  spuCode: 'SPU-MISSING-STYLE-ARCHIVE',
  linkedTechPackVersionId: '',
  linkedTechPackVersionCode: '',
  linkedTechPackVersionLabel: '',
  linkedTechPackVersionStatus: '',
  linkedTechPackUpdatedAt: '',
})

const actionMeta = getPatternTechPackActionMeta(targetTask.patternTaskId)
assert.equal(actionMeta.disabled, true, '缺少正式款式档案时，花型技术包动作必须禁用')
assert.equal(actionMeta.label, '待关联款式档案', '缺少正式款式档案时，应显示明确禁用文案')
assert.match(actionMeta.disabledReason, /未绑定正式款式档案/, '禁用原因必须说明缺少正式款式档案')

const listHtml = renderPcsPatternTaskPage()
assert.match(listHtml, /花型任务/, '花型任务页仍应正常渲染')
assert.match(listHtml, /待关联款式档案/, '页面应展示禁用态按钮文案，而不是渲染时报错')

console.log('pcs-pattern-task-page-style-archive-guard.spec.ts PASS')
