import assert from 'node:assert/strict'

import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'

const contract = getProjectWorkItemContract('SAMPLE_SHOOT_FIT')
const fieldMap = new Map(contract.fieldDefinitions.map((field) => [field.fieldKey, field]))

assert.equal(fieldMap.get('shootPlan')?.label, '拍摄安排')
assert.equal(fieldMap.get('fitFeedback')?.label, '试穿反馈')

assert.equal(fieldMap.get('sampleFlatImageIds')?.label, '样衣平铺图')
assert.equal(fieldMap.get('sampleFlatImageIds')?.type, 'image-list')
assert.equal(fieldMap.get('sampleTryOnImageIds')?.label, '试穿图')
assert.equal(fieldMap.get('sampleTryOnImageIds')?.type, 'image-list')
assert.equal(fieldMap.get('sampleDetailImageIds')?.label, '细节图')
assert.equal(fieldMap.get('sampleDetailImageIds')?.type, 'image-list')
assert.equal(fieldMap.get('sampleVideoUrls')?.label, '视频素材')
assert.equal(fieldMap.get('shootImageNote')?.label, '图片补充说明')
assert.equal(fieldMap.get('listingCandidateImageIds')?.label, '商品上架候选图')
assert.equal(fieldMap.get('styleArchiveCandidateImageIds')?.label, '款式档案候选图')

console.log('pcs-sample-shoot-fit-image-fields.spec.ts PASS')
