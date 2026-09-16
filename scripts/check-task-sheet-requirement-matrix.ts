import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const matrix = readFileSync('docs/product-design/任务单打印与简易裁片交出需求追踪矩阵.md', 'utf8')
const plan = readFileSync('docs/implementation-plans/2026-09-16-任务单打印与简易裁片交出实施计划.md', 'utf8')
const rows = matrix.split('\n').filter(line => /^\| [A-Z]+-\d{3} \|/.test(line)).map(line => line.split('|').slice(1,-1).map(value=>value.trim()))
assert.equal(rows.length,148,'原子需求不可因实施遗漏或删减')
assert.equal(new Set(rows.map(row=>row[0])).size,148,'需求编号不得重复')
const states = new Set(['待实施','实施中','已实现待验证','已验证','已阻塞','不适用'])
for(const row of rows){
  assert.equal(row.length,10,`${row[0]}字段数`)
  assert(row.every(Boolean),`${row[0]}缺少必填项`)
  assert(states.has(row[7]),`${row[0]}状态非法`)
  for(const id of row[4].match(/C\d+/g)||[]) assert(plan.includes(`| ${id} |`),`${row[0]}实现目录缺失${id}`)
  for(const id of row[8].match(/E\d+/g)||[]) assert(matrix.includes(`- ${id}：`),`${row[0]}证据定义缺失${id}`)
  if(row[7]==='已验证') assert(!/(?:^|\/)E[01](?:$|\/)/.test(row[8]),`${row[0]}不得凭计划或实现声明通过`)
}
for(let i=1;i<=15;i++){
  const section=`S${String(i).padStart(2,'0')}`
  assert(rows.some(row=>row[1].includes(section)),`${section}无原子需求覆盖`)
}
for(const path of plan.matchAll(/`(src\/[^`]+\.ts)`/g)) assert(existsSync(path[1]),`实施目录文件不存在：${path[1]}`)
const counts=Object.fromEntries([...states].map(state=>[state,rows.filter(row=>row[7]===state).length]))
console.log(JSON.stringify({requirements:rows.length,chapters:15,counts,note:'结构追踪检查；业务语义和页面证据须由审查记录核对，不以编号覆盖代替验收'},null,2))
