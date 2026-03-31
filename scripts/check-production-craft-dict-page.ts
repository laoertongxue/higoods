import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { processCraftDictRows } from '../src/data/fcs/process-craft-dict.ts'

const sourcePath = path.resolve('src/pages/production-craft-dict.ts')
const source = readFileSync(sourcePath, 'utf8')

const expectedTotal = processCraftDictRows.length
const expectedVisible = Math.min(10, expectedTotal)

assert.match(source, /<h1 class="text-xl font-semibold">工序工艺字典<\/h1>/, '顶部应只保留页面标题')
assert.ok(!source.includes('总览页'), '页面顶部不应再保留标签页文案')
assert.ok(!source.includes('详情侧边弹窗'), '页面顶部不应再保留标签页文案')
assert.ok(!source.includes('列表主数据来自老系统工艺映射'), '页面顶部不应再保留说明性文字')
assert.ok(!source.includes('准备阶段仅维护印花/染色工序字典项'), '页面顶部不应再保留提示条')
assert.match(source, /const PAGE_SIZE_OPTIONS = \[10, 20, 50\]/, '应存在标准每页条数选项')
assert.match(source, /page: 1,\s*pageSize: 10,/, '默认页码和每页条数应存在')
assert.match(source, /const paging = getPagination\(filtered\)/, '列表渲染应接入分页结果')
assert.match(source, /paging\.rows\.length === 0/, '空状态应基于分页结果渲染')
assert.match(source, /paging\.rows[\s\S]*?\.map\(/, '列表数据应基于分页结果切片')
assert.ok(source.includes('data-testid="craft-dict-pagination"'), '列表底部应渲染分页区域')
assert.ok(source.includes('data-craft-dict-field="pageSize"'), '应存在每页条数控件')
assert.ok(source.includes('data-craft-dict-action="prev-page"'), '应存在上一页动作')
assert.ok(source.includes('data-craft-dict-action="next-page"'), '应存在下一页动作')
assert.ok(source.includes("data-testid=\"craft-dict-page-indicator\""), '应存在分页页码指示')
assert.match(source, /rows\.slice\(start, end\)/, '分页切片应在页面层完成')

console.log(`工序工艺字典页面静态检查通过：总条数 ${expectedTotal}，默认页大小 ${expectedVisible}。`)
