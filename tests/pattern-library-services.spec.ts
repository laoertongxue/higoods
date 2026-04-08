import assert from 'node:assert/strict'
import {
  DEFAULT_PATTERN_CATEGORY_TREE,
  formatPatternCategoryTreeText,
  canPatternBeReferenced,
  getPatternCategoryPrimaryOptions,
  getPatternCategorySecondaryOptions,
  getPatternCategorySuggestions,
  parsePatternCategoryTreeText,
  hammingDistance,
  tokenizePatternFilename,
} from '../src/utils/pcs-pattern-library-services.ts'

const tokens = tokenizePatternFilename('ASYNK26022803-Pink-A2-S98')
assert.ok(tokens.some((token) => token.token === 'Pink'), '应拆出颜色 token')
assert.ok(tokens.some((token) => token.token === 'ASYNK26022803'), '应保留原始段 token')
assert.ok(tokens.some((token) => token.token === 'A2'), '应保留组合编码 token')

assert.equal(hammingDistance('1010', '1001'), 2, '应正确计算 hamming distance')

assert.deepEqual(
  getPatternCategoryPrimaryOptions(DEFAULT_PATTERN_CATEGORY_TREE).slice(0, 2),
  ['动物纹理', '字母与文字'],
  '应能拿到一级分类列表',
)

assert.deepEqual(
  getPatternCategorySecondaryOptions(DEFAULT_PATTERN_CATEGORY_TREE, '植物与花卉'),
  ['写实花卉', '花卉丛林/满底花', '植物纹理', '水墨/水彩花卉'],
  '应能按一级分类拿到二级分类列表',
)

assert.equal(
  getPatternCategorySuggestions({ tokens: tokenizePatternFilename('Vintage-Logo-Label.png') })[0]?.primary,
  '字母与文字',
  '关键词建议应支持一级分类',
)

const roundTripTree = parsePatternCategoryTreeText(formatPatternCategoryTreeText(DEFAULT_PATTERN_CATEGORY_TREE))
assert.equal(roundTripTree[3]?.children[2]?.value, '肌理背景', '分类树辅助方法应可稳定往返')

assert.deepEqual(
  canPatternBeReferenced({
    parse_status: 'success',
    review_status: 'approved',
    lifecycle_status: 'active',
    license_status: 'authorized',
  }),
  { allowed: true },
  '满足正式引用条件时应允许引用',
)

assert.equal(
  canPatternBeReferenced({
    parse_status: 'success',
    review_status: 'approved',
    lifecycle_status: 'active',
    license_status: 'expired',
  }).allowed,
  false,
  '授权过期时应禁止新增引用',
)

console.log('pattern-library-services.spec.ts PASS')
