# 裁片放行四颜色矩阵与详细版本历史实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 `PO14671` 提供 4 色当前裁片矩阵、10 个不可变版本快照和可展开的详细历史事件卡片。

**架构：** 在现有本地 Mock 仓储中按业务事件累积裁片事实，由既有 `buildReleaseMatrix` 生成每一版快照；页面通过比较相邻快照生成历史摘要和物料变化明细。保留字符串模板架构、现有矩阵交互和补料跳转，不引入新状态层。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、Node 检查脚本、Playwright。

---

## 文件职责

- 修改 `src/data/fcs/cut-piece-release.ts`：构造 4 色、10 版本 Mock 仓储和已确认目标快照。
- 修改 `src/pages/process-factory/cutting/cut-piece-release.ts`：计算相邻版本差异并渲染可展开的详细事件卡片。
- 修改 `scripts/check-cut-piece-release-matrix.ts`：增加 4 色、10 版本、目标快照和版本不可变性断言。
- 创建 `tests/cut-piece-release-four-color-history.spec.ts`：验证当前矩阵、历史分页、卡片详情和局部更新。
- 创建 `docs/prototype-review-records/2026-07-20-cut-piece-release-four-color-history.md`：记录印尼工厂现场协同设计自查。

### 任务 1：建立四颜色十版本 Mock 数据链

**文件：**
- 修改：`scripts/check-cut-piece-release-matrix.ts`
- 修改：`src/data/fcs/cut-piece-release.ts`

- [ ] **步骤 1：先增加失败断言**

在裁片放行检查脚本中断言：

```typescript
const seededRecord = getCutPieceReleaseRecord('cpr-po-14671')
assert.ok(seededRecord)
assert.deepEqual(seededRecord.matrix.colorGroups.map((group) => group.garmentColor), ['Black', 'White', 'Navy', 'Red'])
const seededVersions = listCutPieceReleaseMatrixVersions('po-14671')
assert.equal(seededVersions.length, 10)
assert.equal(seededVersions.at(-1)?.eventType, '目标确认')
assert.equal(seededRecord.targetStatus, '已确认')
```

继续断言 Black 的齐套为 `200 / 350 / 500`、目标为 `208 / 350 / 520`，以及 V1 快照在后续事件后仍保持原值。

- [ ] **步骤 2：运行检查并确认红灯**

运行：`node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cut-piece-release-matrix.ts`

预期：FAIL，提示颜色分组或版本数量不符合预期。

- [ ] **步骤 3：按事件顺序构造最少实现**

在 `bootstrapRepository()` 内用小型辅助函数生成裁片事实并按 V1 至 V9 的顺序追加：

```typescript
const finalQuantities = {
  Black: { A: [220, 358, 532], B: [200, 350, 500], C: [208, 364, 520], D: [200, 350, 500] },
  White: { A: [190, 280, 340], B: [180, 270, 330], C: [185, 290, 350], D: [180, 275, 335] },
  Navy: { A: [170, 260, 340], B: [175, 265, 345], C: [180, 270, 350], D: [175, 265, 345] },
  Red: { A: [160, 240, 315], B: [150, 235, 300], C: [165, 250, 320], D: [155, 238, 305] },
}
```

V1 至 V7、V9 使用“铺布完成”事件并携带裁片单、铺布单、操作人和时间；V8 调用现有冻结写入逻辑。最后用现有 `confirmCutPieceReleaseTarget()` 基于 V9 确认以下 12 个目标：

```typescript
{
  'Black::M': 208, 'Black::L': 350, 'Black::XL': 520,
  'White::M': 185, 'White::L': 280, 'White::XL': 340,
  'Navy::M': 170, 'Navy::L': 260, 'Navy::XL': 340,
  'Red::M': 165, 'Red::L': 250, 'Red::XL': 320,
}
```

- [ ] **步骤 4：运行检查并确认绿灯**

运行：`node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cut-piece-release-matrix.ts`

预期：PASS，包含 4 色、10 版本和已确认目标断言。

- [ ] **步骤 5：提交任务 1**

```bash
git add src/data/fcs/cut-piece-release.ts scripts/check-cut-piece-release-matrix.ts
git commit -m "feat: 补充四颜色裁片矩阵版本数据"
```

### 任务 2：实现详细历史事件卡片

**文件：**
- 创建：`tests/cut-piece-release-four-color-history.spec.ts`
- 修改：`src/pages/process-factory/cutting/cut-piece-release.ts`

- [ ] **步骤 1：先编写失败的浏览器测试**

测试直接打开详情 URL：

```typescript
await page.goto('/fcs/craft/cutting/cut-piece-release?productionOrderId=po-14671&productionOrderNo=PO14671')
await expect(page.getByText('Black', { exact: true })).toBeVisible()
await expect(page.getByText('White', { exact: true })).toBeVisible()
await expect(page.getByText('Navy', { exact: true })).toBeVisible()
await expect(page.getByText('Red', { exact: true })).toBeVisible()
await page.getByRole('button', { name: '查看更新历史' }).click()
const history = page.locator('[data-testid="cut-piece-release-history-drawer"]')
await expect(history).toContainText('共 10 条')
await expect(history).toContainText('V10 · 目标确认')
await history.locator('[data-cut-piece-release-history-version="9"]').click()
await expect(history).toContainText('更新前齐套')
await expect(history).toContainText('变化物料点')
```

保存抽屉和页面根节点引用，展开卡片后断言引用不变；点击下一页后断言出现 V5 至 V1。

- [ ] **步骤 2：运行测试并确认红灯**

运行：`npx playwright test tests/cut-piece-release-four-color-history.spec.ts --workers=1`

预期：FAIL，历史卡片尚无详细摘要或展开内容。

- [ ] **步骤 3：实现相邻快照差异和局部展开**

增加页面局部状态：

```typescript
expandedHistoryVersion: number | null
```

增加纯函数，把当前版本与前一版本的 `colorGroups` 按 `颜色::尺码::物料` 对齐，输出齐套变化和物料变化。历史卡片添加 `data-cut-piece-release-history-version`，收起态展示来源、影响颜色、齐套变化和变化点数；展开态列出颜色尺码与物料点的前后数量。

处理器对 `toggle-history-version` 只替换历史抽屉区域，不调用整页 `renderPage()`；翻页时清空展开版本。

- [ ] **步骤 4：运行浏览器测试并确认绿灯**

运行：`npx playwright test tests/cut-piece-release-four-color-history.spec.ts --workers=1`

预期：PASS，4 色、10 条历史、两页、详细展开和局部更新均通过。

- [ ] **步骤 5：提交任务 2**

```bash
git add src/pages/process-factory/cutting/cut-piece-release.ts tests/cut-piece-release-four-color-history.spec.ts
git commit -m "feat: 展示详细裁片矩阵更新历史"
```

### 任务 3：治理记录与整体验证

**文件：**
- 创建：`docs/prototype-review-records/2026-07-20-cut-piece-release-four-color-history.md`

- [ ] **步骤 1：填写原型审查记录**

按模板记录：管理端、主要角色为裁床办公室文员与主管；数量由系统计算；历史可追溯；裁片部位明细按需展开；矩阵在容器内横向滚动；补料仍为独立业务入口。

- [ ] **步骤 2：运行专项和治理检查**

```bash
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cut-piece-release-matrix.ts
npx playwright test tests/cut-piece-release-four-color-history.spec.ts tests/cut-piece-release-new-window.spec.ts --workers=1
npm run check:list-page-governance
npm run check:prototype-design-governance -- --all
npm run build
git diff --check
```

预期：全部通过。

- [ ] **步骤 3：在 1366×768 浏览器验收**

验证当前详情页的 4 色矩阵、历史两页、V9 铺布详情、V8 冻结提示和 V10 目标汇总；确认页面主体无横向溢出，矩阵仅在自身容器滚动。

- [ ] **步骤 4：同步 CodeGraph 并确认状态**

```bash
codegraph sync
codegraph status
```

预期：索引完成同步；如共享索引提示来自主工作树，在交付说明中如实记录工作树边界。

- [ ] **步骤 5：提交任务 3**

```bash
git add docs/prototype-review-records/2026-07-20-cut-piece-release-four-color-history.md
git commit -m "docs: 记录裁片矩阵历史原型审查"
```
