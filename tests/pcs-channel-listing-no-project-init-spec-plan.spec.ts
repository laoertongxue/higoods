import assert from 'node:assert/strict'

import { createEmptyProjectDraft } from '../src/data/pcs-project-repository.ts'
import {
  listProjectStepFieldDefinitions,
} from '../src/data/pcs-project-domain-contract.ts'

const draftFieldKeys = Object.keys(createEmptyProjectDraft()).sort()
const projectInitFieldKeys = listProjectStepFieldDefinitions('PROJECT_INIT')
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

console.log('pcs-channel-listing-no-project-init-spec-plan.spec.ts PASS')
