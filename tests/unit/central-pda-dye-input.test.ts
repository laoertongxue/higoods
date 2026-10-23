import assert from 'node:assert/strict'
import test from 'node:test'
import { dyeNumber, translateDyeNumber, dyeErrorText, dyeLocationLabel, dyePartnerLabel } from '../../src/pages/central-pda/dye-ui.ts'

test('C03/X08: language switches preserve decimal quantity, zero and all roll precision without truncating invalid input', () => {
  for (const value of ['12.5', '0', '0.125', '125.12345678']) {
    const indonesian = translateDyeNumber(value, 'zh', 'id')
    assert.equal(dyeNumber(indonesian, 'id', null, true), Number(value))
    assert.equal(translateDyeNumber(indonesian, 'id', 'zh'), value)
  }
  for (const value of ['12.5,3', '1e3', '-2', 'NaN', '1 000']) {
    assert.throws(() => dyeNumber(value, 'id', null), /DYE_/)
    assert.equal(translateDyeNumber(value, 'zh', 'id'), value)
  }
})

test('C03: yarn grams, integer tube counts and continuous length use their current precision rules', () => {
  assert.equal(dyeNumber('12,123', 'id', 3), 12.123)
  assert.equal(dyeNumber('0', 'id', 0, true), 0)
  assert.equal(dyeNumber('4', 'id', 0, true), 4)
  assert.throws(() => dyeNumber('12,1234', 'id', 3))
  assert.throws(() => dyeNumber('1,5', 'id', 0, true))
  assert.throws(() => dyeNumber('0', 'id', 3))
})

test('X08: actionable Indonesian validation preserves duplicate roll and wrong-location distinctions', () => {
  assert.match(dyeErrorText(new Error('本段来货的卷码已经接收，不能重复入库。'), 'id'), /Rol sudah diterima/)
  assert.match(dyeErrorText(new Error('请选择本厂已启用的待加工仓库位。'), 'id'), /Lokasi bukan gudang/)
  assert.match(dyeErrorText(new Error('毛重最多三位小数'), 'id'), /berat kotor/)
  assert.equal(dyeLocationLabel('异常-01-02', 'id'), 'Karantina-01-02')
  assert.equal(dyeLocationLabel('A区', 'id'), 'A')
  assert.equal(dyeLocationLabel('异常-01-02', 'zh'), '异常-01-02')
})

test('C03/X08: a receiving factory with no Latin name uses its actual business code rather than its internal identity', () => {
  const partner = { name: '周哥毛织厂', id: 'OWN_WOOL_FACTORY' }
  assert.equal(dyePartnerLabel(partner, 'id'), 'WOOL-OWN-001')
  assert.equal(dyePartnerLabel(partner, 'zh'), partner.name)
  assert.equal(dyePartnerLabel({ name: 'MJS', id: 'ID-F002' }, 'id'), 'MJS')
})


test('C03.33 saved-read recovery shows the current action result without exposing its historical storage owner', () => {
  const messages = ['染色操作已保存，但页面未能更新，请重新读取后查看。', '洗水操作已保存，但页面未能更新，请重新读取后查看。']
  for (const lang of ['zh', 'id'] as const) {
    assert.equal(dyeErrorText(new Error(messages[0]), lang), dyeErrorText(new Error(messages[1]), lang))
    if (lang === 'id') assert.ok(!/[\u3400-\u9fff]/.test(dyeErrorText(new Error(messages[1]), lang)))
    assert.ok(!/洗水|washing/i.test(dyeErrorText(new Error(messages[1]), lang)))
  }
})
