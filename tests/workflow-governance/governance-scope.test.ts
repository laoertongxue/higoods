import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { isPrototypePath, isReviewRecordPath, resolveGovernanceScope } from '../../scripts/workflow-governance/governance-scope.ts'
import { verificationCheckEnvironment } from '../../scripts/workflow-governance/check-execution.ts'

const FILE = 'src/main.ts'
const OTHER = 'src/state/other.ts'
const OLD = 'export const version = "baseline"\n'
const STAGED = 'export const version = "staged"\n'
const WORKTREE = 'export const version = "worktree"\n'

interface Fixture {
  cwd: string
  write: (path: string, source: string) => void
  git: (...args: string[]) => string
}
function fixture(work: (context: Fixture) => void): void {
  const cwd = mkdtempSync(join(tmpdir(), 'higoods-governance-scope-'))
  const write = (path: string, source: string) => { mkdirSync(dirname(join(cwd, path)), { recursive: true }); writeFileSync(join(cwd, path), source) }
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    git('init', '-qb', 'main')
    git('config', 'user.email', 'fixture@example.test')
    git('config', 'user.name', 'Scope Test Fixture')
    write(FILE, OLD)
    write(OTHER, 'export const other = true\n')
    git('add', '--', FILE, OTHER)
    git('commit', '-qm', 'baseline')
    work({ cwd, write, git })
  } finally { rmSync(cwd, { recursive: true, force: true }) }
}

test('默认 staged 使用暂存路径和内容，并保留 HEAD 基准', () => fixture(({ cwd, write, git }) => {
  write(FILE, STAGED)
  git('add', '--', FILE)
  write(FILE, WORKTREE)
  write(OTHER, 'unrelated dirty\n')
  const scope = resolveGovernanceScope([], cwd)
  assert.equal(scope.kind, 'staged')
  assert.deepEqual(scope.paths, [FILE])
  assert.equal(scope.readText(FILE), STAGED)
  assert.equal(scope.readBaseText(FILE), OLD)
  assert.equal(scope.baseRef, git('rev-parse', 'HEAD'))
  assert.equal(scope.readText('missing.ts'), null)
}))

test('staged 对象在解析时固定，之后再次 git add 或重置不影响已有 scope', () => fixture(({ cwd, write, git }) => {
  write(FILE, STAGED)
  git('add', '--', FILE)
  const scope = resolveGovernanceScope([], cwd)
  write(FILE, WORKTREE)
  git('add', '--', FILE)
  assert.equal(scope.readText(FILE), STAGED)
  assert.equal(resolveGovernanceScope([], cwd).readText(FILE), WORKTREE)
  git('reset', '-q', 'HEAD', '--', FILE)
  assert.equal(scope.readText(FILE), STAGED)
  assert.deepEqual(scope.paths, [FILE])
}))

test('worktree 以实际文件为结果，覆盖暂存和未暂存的最终状态', () => fixture(({ cwd, write, git }) => {
  write(FILE, STAGED)
  git('add', '--', FILE)
  write(FILE, WORKTREE)
  const scope = resolveGovernanceScope(['--scope', 'worktree'], cwd)
  assert.deepEqual(scope.paths, [FILE])
  assert.equal(scope.readText(FILE), WORKTREE)
  assert.equal(scope.readBaseText(FILE), OLD)
}))

test('显式 paths 只选择任务文件，其他 dirty 和 untracked 均记录为排除', () => fixture(({ cwd, write }) => {
  write(FILE, WORKTREE)
  write(OTHER, 'changed other\n')
  write('docs/unrelated.md', 'unrelated new\n')
  const scope = resolveGovernanceScope(['--scope', 'worktree', '--paths', `./${FILE}`], cwd)
  assert.deepEqual(scope.paths, [FILE])
  assert.deepEqual(scope.excludedPaths, ['docs/unrelated.md', OTHER].sort())
}))

test('branch 从共同祖先比较提交内容，不读基准分支后续提交或工作区差异', () => fixture(({ cwd, write, git }) => {
  const ancestor = git('rev-parse', 'HEAD')
  git('checkout', '-qb', 'feature')
  write(FILE, 'feature committed\n')
  git('add', '--', FILE)
  git('commit', '-qm', 'feature')
  git('checkout', '-q', 'main')
  write(OTHER, 'main advanced\n')
  git('add', '--', OTHER)
  git('commit', '-qm', 'main advanced')
  git('checkout', '-q', 'feature')
  write(FILE, WORKTREE)
  write('src/untracked.ts', 'untracked\n')
  const scope = resolveGovernanceScope(['--scope', 'branch', '--base', 'main'], cwd)
  assert.equal(scope.baseRef, ancestor)
  assert.deepEqual(scope.paths, [FILE])
  assert.equal(scope.readBaseText(FILE), OLD)
  assert.equal(scope.readText(FILE), 'feature committed\n')
  assert.equal(scope.readText(OTHER), 'export const other = true\n')
  assert.equal(scope.readText('src/untracked.ts'), null)
}))

test('branch 的 HEAD 对象也在解析时固定', () => fixture(({ cwd, write, git }) => {
  const base = git('rev-parse', 'HEAD')
  write(FILE, STAGED)
  git('add', '--', FILE)
  git('commit', '-qm', 'first')
  const scope = resolveGovernanceScope(['--scope', 'branch', '--base', base], cwd)
  write(FILE, WORKTREE)
  git('add', '--', FILE)
  git('commit', '-qm', 'second')
  assert.equal(scope.readText(FILE), STAGED)
  assert.equal(scope.readBaseText(FILE), OLD)
}))

test('worktree --base 合并已提交变化和当前文件，基准仍为共同祖先', () => fixture(({ cwd, write, git }) => {
  const base = git('rev-parse', 'HEAD')
  write(FILE, STAGED)
  git('add', '--', FILE)
  git('commit', '-qm', 'committed change')
  write(FILE, WORKTREE)
  const scope = resolveGovernanceScope(['--scope', 'worktree', '--base', base], cwd)
  assert.deepEqual(scope.paths, [FILE])
  assert.equal(scope.readText(FILE), WORKTREE)
  assert.equal(scope.readBaseText(FILE), OLD)
}))

test('workflow --base 传给子门禁，不能丢掉已提交路径或被旧环境污染', () => fixture(({ cwd, write, git }) => {
  const base = git('rev-parse', 'HEAD')
  write(FILE, STAGED)
  git('add', '--', FILE)
  git('commit', '-qm', 'committed change')
  const environment = verificationCheckEnvironment(base, { GOVERNANCE_BASE_SHA: 'stale-ref', KEEP: 'yes' })
  const scope = resolveGovernanceScope(['--scope', 'worktree', '--paths', FILE], cwd, environment)
  assert.equal(scope.baseRef, base)
  assert.deepEqual(scope.paths, [FILE])
  assert.equal(scope.readText(FILE), STAGED)
  assert.equal(scope.readBaseText(FILE), OLD)
  assert.deepEqual(verificationCheckEnvironment(undefined, environment), { KEEP: 'yes' })
  assert.equal(resolveGovernanceScope([], cwd, environment).baseRef, git('rev-parse', 'HEAD'))
  assert.throws(() => resolveGovernanceScope(['--scope', 'branch'], cwd, environment), /必须提供 --base/)
  assert.equal(resolveGovernanceScope(['--scope', 'worktree', '--base', 'HEAD'], cwd, environment).baseRef, git('rev-parse', 'HEAD'))
}))

test('worktree 正确包含未跟踪文件和删除，缺失侧返回 null', () => fixture(({ cwd, write }) => {
  rmSync(join(cwd, FILE))
  write('src/new.ts', 'new\n')
  const scope = resolveGovernanceScope(['--scope', 'worktree'], cwd)
  assert.deepEqual(scope.paths, [FILE, 'src/new.ts'].sort())
  assert.equal(scope.readText(FILE), null)
  assert.equal(scope.readBaseText(FILE), OLD)
  assert.equal(scope.readText('src/new.ts'), 'new\n')
  assert.equal(scope.readBaseText('src/new.ts'), null)
}))

test('重命名以旧路径删除和新路径新增分别覆盖，中文路径不被 Git 引号转义', () => fixture(({ cwd, write, git }) => {
  const renamed = 'src/页面/裁片 放行.ts'
  mkdirSync(dirname(join(cwd, renamed)), { recursive: true })
  renameSync(join(cwd, FILE), join(cwd, renamed))
  write('docs/说明 文件.md', '中文内容\n')
  git('add', '-A')
  const scope = resolveGovernanceScope([], cwd)
  assert.deepEqual(scope.paths, ['docs/说明 文件.md', FILE, renamed].sort())
  assert.equal(scope.readText(FILE), null)
  assert.equal(scope.readBaseText(FILE), OLD)
  assert.equal(scope.readText(renamed), OLD)
  assert.equal(scope.readBaseText(renamed), null)
  assert.equal(scope.readText('docs/说明 文件.md'), '中文内容\n')
}))

test('--all 是显式 worktree 别名，可与 paths 组合但不能混用 scope', () => fixture(({ cwd, write }) => {
  write(FILE, WORKTREE)
  write(OTHER, 'changed\n')
  const scope = resolveGovernanceScope(['--all', '--paths', FILE], cwd)
  assert.equal(scope.kind, 'worktree')
  assert.deepEqual(scope.paths, [FILE])
  assert.deepEqual(scope.excludedPaths, [OTHER])
  assert.throws(() => resolveGovernanceScope(['--all', '--scope', 'worktree'], cwd), /不能同时使用/)
  assert.throws(() => resolveGovernanceScope(['--all', '--all'], cwd), /不能重复/)
}))

test('非法参数、缺值、未知 scope、重复参数和 branch 缺 base 全部拒绝', () => fixture(({ cwd }) => {
  const invalid: Array<[string[], RegExp]> = [
    [['--mystery'], /未知治理参数/],
    [['--paths'], /缺少值/],
    [['--paths', '--scope', 'worktree'], /缺少值/],
    [['--scope', 'invalid'], /必须为/],
    [['--scope', 'branch'], /必须提供 --base/],
    [['--base', 'HEAD'], /staged 范围不接受/],
    [['--scope', 'worktree', '--scope', 'worktree'], /不能重复/],
    [['--scope', 'worktree', '--base', 'HEAD', '--base', 'HEAD'], /不能重复/],
    [['--paths', FILE, '--paths', FILE], /不能重复/],
  ]
  for (const [args, reason] of invalid) assert.throws(() => resolveGovernanceScope(args, cwd), reason, JSON.stringify(args))
}))

test('路径越界、空段、重复路径、非变更路径及无效引用均拒绝', () => fixture(({ cwd, write }) => {
  write(FILE, WORKTREE)
  const invalid = ['/tmp/outside.ts', '../outside.ts', 'src/../main.ts', 'src//main.ts', 'src\\main.ts', 'src/./main.ts', `${FILE},`, `${FILE},./${FILE}`, `${FILE},${FILE}`, OTHER, 'missing.ts']
  for (const path of invalid) assert.throws(() => resolveGovernanceScope(['--scope', 'worktree', '--paths', path], cwd), undefined, path)
  assert.throws(() => resolveGovernanceScope(['--scope', 'branch', '--base', 'missing-reference'], cwd))
  const scope = resolveGovernanceScope(['--scope', 'worktree'], cwd)
  assert.throws(() => scope.readText('../secret'))
  assert.throws(() => scope.readBaseText('/tmp/secret'))
}))

test('工作区指向仓库内、仓库外文件和符号链接目录的路径都拒绝', () => fixture(({ cwd, write }) => {
  write('inside.txt', 'inside\n')
  symlinkSync('inside.txt', join(cwd, 'inside-link.txt'))
  symlinkSync('/etc/hosts', join(cwd, 'outside-link.txt'))
  symlinkSync('src', join(cwd, 'linked-src'))
  const scope = resolveGovernanceScope(['--scope', 'worktree'], cwd)
  assert.throws(() => scope.readText('inside-link.txt'), /符号链接/)
  assert.throws(() => scope.readText('outside-link.txt'), /符号链接/)
  assert.throws(() => scope.readText('linked-src/main.ts'), /符号链接/)
}))

test('悬空符号链接不能被误当成普通删除或不存在文件', () => fixture(({ cwd }) => {
  symlinkSync('missing-target.txt', join(cwd, 'dangling.txt'))
  symlinkSync('missing-directory', join(cwd, 'dangling-dir'))
  const scope = resolveGovernanceScope(['--scope', 'worktree'], cwd)
  assert.throws(() => scope.readText('dangling.txt'), /符号链接/)
  assert.throws(() => scope.readText('dangling-dir/page.ts'), /符号链接/)
}))

test('暂存符号链接、基准符号链接和子模块对象不能作为文本读取', () => fixture(({ cwd, git }) => {
  symlinkSync('src/main.ts', join(cwd, 'link.txt'))
  git('add', '--', 'link.txt')
  const staged = resolveGovernanceScope([], cwd)
  assert.throws(() => staged.readText('link.txt'), /符号链接或子模块/)
  git('commit', '-qm', 'link fixture')
  const committed = resolveGovernanceScope([], cwd)
  assert.throws(() => committed.readBaseText('link.txt'), /符号链接或子模块/)
  const oid = git('rev-parse', 'HEAD')
  git('update-index', '--add', '--cacheinfo', `160000,${oid},nested-module`)
  const submodule = resolveGovernanceScope([], cwd)
  assert.throws(() => submodule.readText('nested-module'), /符号链接或子模块/)
}))

test('受管路径覆盖全部运行源码和 HTML 入口，审查记录位置明确', () => {
  for (const path of ['src/main.ts', 'src/domain/rules.ts', 'src/state/records.ts', 'src/styles.css', 'src/pages/example.ts', 'index.html']) assert(isPrototypePath(path), path)
  for (const path of ['README.md', 'scripts/tool.ts', 'tests/fixture.ts', 'src-other/example.ts']) assert.equal(isPrototypePath(path), false, path)
  assert(isReviewRecordPath('docs/prototype-review-records/中文记录.md'))
  assert.equal(isReviewRecordPath('docs/notes/example.md'), false)
  assert.equal(isReviewRecordPath('docs/prototype-review-records/example.json'), false)
})

test('暂存区存在未解决合并冲突时不得选取某一侧冒充最终源码', () => fixture(({ cwd, write, git }) => {
  git('checkout', '-qb', 'side')
  write(FILE, 'side edit\n')
  git('add', '--', FILE)
  git('commit', '-qm', 'side edit')
  git('checkout', '-q', 'main')
  write(FILE, 'main edit\n')
  git('add', '--', FILE)
  git('commit', '-qm', 'main edit')
  assert.throws(() => git('merge', '--no-edit', 'side'))
  assert.throws(() => resolveGovernanceScope([], cwd), /未解决冲突/)
}))
