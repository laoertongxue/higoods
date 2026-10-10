import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { assertCuttingDocumentation } from '../../scripts/check-cutting-p2-delivery.ts'

const scripts: Record<string, unknown> = {
  'check:pda-cutting-wait-handover-route-integration': 'tsx check-route.ts',
  'check:cutting:all': 'tsx check-cutting.ts',
  'check:cutting:release': 'tsx check-delivery.ts',
  'test:cutting:install-browsers': 'playwright install chromium',
  'test:cutting:all:e2e': 'playwright test tests/cutting-*.spec.ts',
}
const docs = `npm ci
npm run test:cutting:install-browsers
npm run check:cutting:release
npm run test:cutting:all:e2e
npm exec -- playwright test tests/cutting-example.spec.ts --debug
`
const config = "globalSetup: './tests/bootstrap/cutting-bootstrap.ts',"

test('npm ci 与自动 globalSetup 不需要死 bootstrap npm 命令', () => {
  assert.doesNotThrow(() => assertCuttingDocumentation(scripts, docs, config))
})

test('允许仍然真实可用的 npm install 和 npx 调试示例', () => {
  assert.doesNotThrow(() => assertCuttingDocumentation(
    scripts, docs.replace('npm ci', 'npm install').replace('npm exec --', 'npx'), config,
  ))
})

test('文档引用不存在的 npm debug 脚本会失败', () => {
  assert.throws(() => assertCuttingDocumentation(
    scripts, `${docs}\nnpm run test:cutting:e2e:debug`, config,
  ), /文档引用不存在或空的 npm 脚本：test:cutting:e2e:debug/)
})

test('即使残留 bootstrap script，文档也不能要求手动执行导出模块', () => {
  assert.throws(() => assertCuttingDocumentation(
    { ...scripts, 'test:cutting:bootstrap': 'node tests/bootstrap/cutting-bootstrap.ts' },
    `${docs}\nnpm run test:cutting:bootstrap`, config,
  ), /不应要求单独执行 test:cutting:bootstrap/)
})

test('真正的发布检查入口缺失或为空仍会失败', () => {
  for (const value of [undefined, '']) {
    assert.throws(() => assertCuttingDocumentation(
      { ...scripts, 'check:pda-cutting-wait-handover-route-integration': value }, docs, config,
    ), /package.json 缺少有效交付脚本：check:pda-cutting-wait-handover-route-integration/)
  }
})

test('没有实际 Playwright 调试命令不能用孤立的 --debug 说明代替', () => {
  assert.throws(() => assertCuttingDocumentation(
    scripts, docs.replace(/^npm exec.*$/m, '调试使用 --debug'), config,
  ), /文档缺少可执行的 Playwright --debug 示例/)
})

test('自动 bootstrap 未在 Playwright globalSetup 中接线时失败', () => {
  assert.throws(() => assertCuttingDocumentation(scripts, docs, 'export default {}'), /globalSetup/)
})

test('文档仍需提供交付检查和 E2E 的实际入口', () => {
  assert.throws(() => assertCuttingDocumentation(
    scripts, docs.replace('npm run check:cutting:release', ''), config,
  ), /文档缺少运行命令说明：npm run check:cutting:release/)
})

test('当前仓库说明与实际 package scripts / Playwright 配置一致', () => {
  const root = new URL('../../', import.meta.url)
  const read = (file: string) => fs.readFileSync(new URL(file, root), 'utf8')
  const packageJson = JSON.parse(read('package.json'))
  assert.doesNotThrow(() => assertCuttingDocumentation(
    packageJson.scripts, `${read('README.md')}\n${read('docs/cutting-e2e.md')}`, read('playwright.config.ts'),
  ))
})
