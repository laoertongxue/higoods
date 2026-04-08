import assert from 'node:assert/strict'
import {
  canPatternBeReferenced,
  hammingDistance,
  tokenizePatternFilename,
} from '../src/utils/pcs-pattern-library-services.ts'

const tokens = tokenizePatternFilename('ASYNK26022803-Pink-A2-S98')
assert.ok(tokens.some((token) => token.token === 'Pink'), '应拆出颜色 token')
assert.ok(tokens.some((token) => token.token === 'ASYNK26022803'), '应保留原始段 token')
assert.ok(tokens.some((token) => token.token === 'A2'), '应保留组合编码 token')

assert.equal(hammingDistance('1010', '1001'), 2, '应正确计算 hamming distance')

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
