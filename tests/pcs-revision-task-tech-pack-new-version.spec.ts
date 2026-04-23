import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('src/data/pcs-tech-pack-task-generation.ts', 'utf8')

assert.ok(source.includes('generateTechPackVersionFromRevisionTask'), '必须保留改版任务生成技术包新版本方法')
assert.ok(source.includes('改版生成新版本'), '改版任务必须生成新技术包版本日志')
assert.ok(source.includes('generatedNewTechPackVersionFlag: true'), '生成新技术包版本后必须回写标记')
assert.ok(source.includes('generatedNewTechPackVersionAt: createdRecord.updatedAt'), '生成新技术包版本后必须回写时间')
assert.ok(!source.includes(`createdFromTaskType: 'PLATE',
    createdFromTaskId: task.revisionTaskId`), '改版任务不得伪装成制版任务写包')

console.log('pcs-revision-task-tech-pack-new-version.spec.ts PASS')
