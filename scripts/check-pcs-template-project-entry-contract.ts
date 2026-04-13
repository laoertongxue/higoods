import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const templateListSource = read('src/pages/pcs-templates.ts')
assert.ok(templateListSource.includes('buildTemplateBusinessSummary'), '模板列表页必须读取模板业务闭环摘要。')
assert.ok(templateListSource.includes('业务闭环状态'), '模板列表页必须展示业务闭环状态列。')
assert.ok(templateListSource.includes('包含商品上架') || templateListSource.includes('缺少商品上架'), '模板列表页必须展示商品上架节点信息。')

const templateDetailSource = read('src/pages/pcs-template-detail.ts')
assert.ok(templateDetailSource.includes('buildTemplateTripletNote'), '模板详情页必须展示商品上架三码关系说明。')
assert.ok(templateDetailSource.includes('buildTemplateNodeFieldSourceRows'), '模板详情页必须展示节点字段来源清单。')
assert.ok(templateDetailSource.includes('本阶段进入条件'), '模板详情页必须展示阶段进入条件。')
assert.ok(templateDetailSource.includes('本阶段退出条件'), '模板详情页必须展示阶段退出条件。')

const templateEditorSource = read('src/pages/pcs-template-editor.ts')
assert.ok(templateEditorSource.includes('validateTemplateBusinessIntegrity'), '模板编辑页必须按领域契约校验模板闭环。')
assert.ok(templateEditorSource.includes('nodeEnabledFlag'), '模板编辑页必须支持可选节点启用或停用。')
assert.ok(!templateEditorSource.includes('open-library'), '模板编辑页不应保留自由添加节点入口。')
assert.ok(!templateEditorSource.includes('add-stage'), '模板编辑页不应保留自由新增阶段入口。')

const projectCreateSource = read('src/pages/pcs-project-create.ts')
assert.ok(projectCreateSource.includes('buildTemplateBusinessSummary'), '项目新增页必须展示模板闭环和测款路径说明。')
assert.ok(projectCreateSource.includes("getProjectWorkspaceSourceHintText('categoryId')"), '项目新增页必须通过正式来源 adapter 标注品类字段。')
assert.ok(projectCreateSource.includes("getProjectWorkspaceSourceHintText('brandId')"), '项目新增页必须通过正式来源 adapter 标注品牌字段。')
assert.ok(projectCreateSource.includes("getProjectWorkspaceSourceHintText('ownerId')"), '项目新增页必须通过正式来源 adapter 标注本地组织主数据字段。')
assert.ok(projectCreateSource.includes("getProjectWorkspaceSourceHintText('priorityLevel')"), '项目新增页必须通过正式来源 adapter 标注固定枚举字段。')
assert.ok(projectCreateSource.includes('字段来源说明'), '项目新增页必须展示字段来源说明区块。')
assert.ok(projectCreateSource.includes('后续商品上架节点只允许从这些渠道中创建渠道商品'), '项目新增页必须提示商品上架渠道约束。')
assert.ok(!projectCreateSource.includes("renderSelectField('项目类型'"), '项目新增页不应继续渲染项目类型字段。')
assert.ok(!projectCreateSource.includes("renderSelectField('款式类型'"), '项目新增页不应继续渲染款式类型字段。')
assert.ok(!projectCreateSource.includes("renderInputField('年份'"), '项目新增页不应继续渲染年份字段。')
assert.ok(!projectCreateSource.includes("renderSelectField('价格带'"), '项目新增页不应继续渲染价格带字段。')
assert.ok(!projectCreateSource.includes("renderToggleGroup('季节标签'"), '项目新增页不应继续渲染季节标签字段。')
assert.ok(!projectCreateSource.includes("renderTextAreaField('参考图片'"), '项目新增页不应继续渲染参考图片字段。')
assert.ok(!projectCreateSource.includes('data-pcs-project-create-field="styleNumber"'), '项目新增页不应继续渲染 styleNumber 输入项。')

const projectInitContract = getProjectWorkItemContract('PROJECT_INIT')
const configFieldKeys = new Set(
  projectInitContract.fieldDefinitions
    .filter((field) => field.sourceKind === '配置工作台')
    .map((field) => field.fieldKey),
)
;['categoryId', 'brandId', 'styleCodeId', 'styleTagIds', 'crowdPositioningIds', 'ageIds', 'crowdIds', 'productPositioningIds'].forEach(
  (fieldKey) => {
    assert.ok(configFieldKeys.has(fieldKey), `领域契约必须将 ${fieldKey} 标记为配置工作台来源字段。`)
  },
)

console.log('check-pcs-template-project-entry-contract.ts PASS')
