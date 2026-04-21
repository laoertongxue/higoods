import assert from 'node:assert/strict'

import {
  createEmptyProjectDraft,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  listProjectWorkItemFieldDefinitions,
} from '../src/data/pcs-project-domain-contract.ts'
import { renderPcsProjectCreatePage } from '../src/pages/pcs-projects.ts'

resetProjectRepository()

const draftFieldKeys = Object.keys(createEmptyProjectDraft()).sort()
const projectInitFieldKeys = listProjectWorkItemFieldDefinitions('PROJECT_INIT')
  .map((field) => field.fieldKey)
  .sort()

assert.equal(projectInitFieldKeys.includes('plannedColorNames'), false, '商品项目立项不应存在预期颜色')
assert.equal(projectInitFieldKeys.includes('plannedSizeNames'), false, '商品项目立项不应存在预期尺码')
assert.equal(projectInitFieldKeys.includes('plannedPrintName'), false, '商品项目立项不应存在预期花型')
assert.equal(projectInitFieldKeys.includes('plannedSpecRemark'), false, '商品项目立项不应存在规格备注')
assert.equal(draftFieldKeys.includes('plannedColorNames'), false, '项目创建草稿不应存在预期颜色')
assert.equal(draftFieldKeys.includes('plannedSizeNames'), false, '项目创建草稿不应存在预期尺码')
assert.equal(draftFieldKeys.includes('plannedPrintName'), false, '项目创建草稿不应存在预期花型')
assert.equal(draftFieldKeys.includes('plannedSpecRemark'), false, '项目创建草稿不应存在规格备注')

const createHtml = await renderPcsProjectCreatePage()
const forbiddenSpecPlanPattern = new RegExp(['规格计划', '预期颜色', '预期尺码', '预期花型', '规格备注'].join('|'))
assert.doesNotMatch(createHtml, forbiddenSpecPlanPattern, '商品项目创建页不应展示规格计划相关文案')

console.log('pcs-channel-listing-no-project-init-spec-plan.spec.ts PASS')
