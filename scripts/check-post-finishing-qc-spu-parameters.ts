#!/usr/bin/env node

import assert from 'node:assert/strict'
import {
  getPostFinishingSpuTechnicalParameter,
  isPostFinishingSpuTechnicalParameterMaintained,
  listPostFinishingSpuOptions,
  resetPostFinishingSpuTechnicalParameters,
  upsertPostFinishingSpuTechnicalParameter,
} from '../src/data/fcs/post-finishing-spu-technical-parameters.ts'

resetPostFinishingSpuTechnicalParameters()

const options = listPostFinishingSpuOptions()
assert.equal(options.length, 3, '验收 Mock 必须提供 3 个可搜索 SPU')
assert.deepEqual(options.map((item) => item.spuCode), ['SPU-QC-001', 'SPU-QC-002', 'SPU-QC-003'])

const maintained = getPostFinishingSpuTechnicalParameter('SPU-QC-001')
const unmaintained = getPostFinishingSpuTechnicalParameter('SPU-QC-002')
assert(maintained && isPostFinishingSpuTechnicalParameterMaintained(maintained), '默认数据必须包含已维护 SPU 技术参数')
assert.equal(unmaintained, undefined, '默认数据必须同时包含未维护 SPU')

const saved = upsertPostFinishingSpuTechnicalParameter({
  spuCode: 'SPU-QC-002',
  colorReferenceImageUrl: '/materials/fabric-contrast.jpg',
  colorReferenceNote: '以实物色卡与颜色对照图共同判断',
  sizeRows: options[1]!.sizes.map((sizeName, index) => ({
    sizeName,
    backLength: `${65 + index}cm`,
    shoulderWidth: `${36 + index}cm`,
    bust: `${112 + index * 4}cm`,
    sleeveLength: `${58 + index}cm`,
    cuff: `${16 + index}cm`,
    imageUrl: index === 0 ? '/dress-sample-1.jpg' : undefined,
  })),
  updatedBy: '陈买手',
})

assert(isPostFinishingSpuTechnicalParameterMaintained(saved), '颜色对照图与各尺码尺寸均具备后才是已维护')
assert.equal(getPostFinishingSpuTechnicalParameter('SPU-QC-002')?.updatedBy, '陈买手', '保存后必须按 SPU 复用')

console.log(JSON.stringify({
  suite: '后道质检 SPU 技术参数专项契约',
  searchableSpus: options.length,
  defaultMaintained: maintained?.spuCode,
  savedSpu: saved.spuCode,
  sizeRows: saved.sizeRows.length,
  status: '通过',
}, null, 2))
