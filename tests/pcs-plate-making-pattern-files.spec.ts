import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const resultSource = fs.readFileSync(path.join(ROOT, 'src/data/pcs-engineering-pattern-result.ts'), 'utf8')
const generationSource = fs.readFileSync(path.join(ROOT, 'src/data/pcs-tech-pack-task-generation.ts'), 'utf8')
const pageSource = fs.readFileSync(path.join(ROOT, 'src/pages/pcs-engineering-tasks/plate-making-task.ts'), 'utf8')

;[
  'sourceFiles',
  'previewFiles',
  'imageUrls',
  'prjFiles',
  'pdfFiles',
  'dxfFiles',
  'rulFiles',
  'applicableSizes',
].forEach((field) => {
  assert.ok(resultSource.includes(field), `制版任务成果版本缺少字段：${field}`)
})

assert.ok(pageSource.includes("'PATTERN-SOURCE'"), '制版任务页面必须提供纸样源文件上传入口')
assert.ok(pageSource.includes("'PATTERN-PREVIEW'"), '制版任务页面必须提供纸样预览图上传入口')
assert.ok(pageSource.includes('uploadEngineeringTaskFiles'), '制版任务页面必须真实读取并保存本地文件')
assert.ok(pageSource.includes('assertEngineeringUploadedFilesReady'), '提交前必须校验真实文件已经读取完成')
assert.ok(pageSource.includes("file.extension === 'prj'"), '纸样源文件必须至少包含 PRJ')
assert.ok(pageSource.includes('submitEngineeringPatternResult'), '页面必须把真实文件写入纸样成果版本')
assert.ok(resultSource.includes("if (prjFiles.length === 0) throw new Error('请上传纸样 PRJ 源文件。')"), '领域提交必须阻断缺少 PRJ 的成果')
assert.ok(resultSource.includes("if (imageUrls.length === 0) throw new Error('请上传纸样预览图。')"), '领域提交必须阻断缺少真实预览图的成果')
assert.ok(!generationSource.includes('generateTechPackVersionFromPlateTask'), '制版任务不得绕过工程主单直接生成技术包')
assert.ok(!generationSource.includes('generateTechPackVersionFromPatternTask'), '花型任务不得绕过工程主单直接生成技术包')

console.log('pcs-plate-making-pattern-files.spec.ts PASS')
