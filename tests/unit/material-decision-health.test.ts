import { test } from 'node:test'
import assert from 'node:assert/strict'
import { healthRows, healthDefaults, healthGroups, renderHealthView } from '../../src/pages/material-decision/health'
test('health groups are exhaustive and mutually exclusive in demo',()=>{const rows=healthRows();assert.deepEqual([...new Set(rows.map(r=>r.group))].sort(),[...healthGroups].sort());assert.equal(rows.length,12)})
test('coverage and baseline use same inventory plus transit but distinct demand windows',()=>{const r=healthRows()[0];assert.equal(r.coverage,r.total/r.use7);assert.equal(r.baselineCoverage,r.total/r.baseline);assert.equal(r.change,r.coverage!-r.baselineCoverage!)})
test('zero demand is unavailable rather than infinity and huge finite quotient stays finite',()=>{assert.equal(healthRows().find(r=>r.spu==='CNIDML163')!.coverage,null);assert.ok(Number.isFinite(healthRows().find(r=>r.spu==='IDSZML23004')!.coverage))})
test('date selects different consistent snapshot',()=>{assert.notEqual(healthRows('2026-09-11')[0].total,healthRows('2026-09-14')[0].total);assert.notEqual(healthRows('2026-09-11')[0].coverage,healthRows('2026-09-14')[0].coverage)})
test('threshold changes alter classification without changing facts',()=>{const before=healthRows(),after=healthRows('2026-09-14',{...healthDefaults,large:100000});assert.equal(before[2].inventory,after[2].inventory);assert.notEqual(before[2].group,after[2].group)})
test('health view carries core P1 business sections and mock caveat',()=>{const html=renderHealthView();for(const text of ['6:3:1 消耗贡献结构','仓量 × 库销比','仓量 × 消耗等级','库销比 × 消耗等级','不健康库存 TOP10','7日采购日均','90日基线天数','覆盖变化','Mock','不是库存或采购配比'])assert.ok(html.includes(text),text)})
