import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildClaimDisputeEvidenceFiles,
  parseLengthQtyFromText,
  parseRollCountFromText,
} from '../../src/helpers/fcs-claim-dispute.ts'

test('解析带标签、小数和空格的长度数量', () => {
  assert.equal(parseLengthQtyFromText('长度 612.5 米'), 612.5)
  assert.equal(parseLengthQtyFromText('实际接收 612.5米'), 612.5)
})

test('解析卷数并对不合法文本返回 0', () => {
  assert.equal(parseRollCountFromText('卷数 8 卷'), 8)
  assert.equal(parseRollCountFromText('未填写'), 0)
})

test('证据文件标识把连续空白收口为单个连字符', () => {
  const [file] = buildClaimDisputeEvidenceFiles(['front  photo.jpg'], 'IMAGE', '2026-09-04T00:00:00.000Z')
  assert.match(file.fileId, /front-photo\.jpg/)
})
