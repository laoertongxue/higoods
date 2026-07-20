# 裁片放行矩阵详情页头实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为裁片放行矩阵独立详情页增加页面级返回入口、一级标题和生产单摘要。

**架构：** 在现有详情页字符串模板中组合一个专用页头函数，数据继续读取当前 `CutPieceReleaseRecord`。返回入口复用 `data-nav`，不引入新路由、状态或跨窗口通信。

**技术栈：** TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、Playwright。

---

## 文件结构

- 修改 `src/pages/process-factory/cutting/cut-piece-release.ts`：渲染详情页级页头并组合到独立详情页面。
- 修改 `tests/cut-piece-release-new-window.spec.ts`：覆盖页头、摘要、返回列表和刷新保留。
- 更新 `docs/prototype-review-records/2026-07-20-cut-piece-release-new-window.md`：记录详情导航和低分辨率复核结论。

### 任务 1：详情页头与返回导航

**文件：**
- 修改：`tests/cut-piece-release-new-window.spec.ts:3-24`
- 修改：`src/pages/process-factory/cutting/cut-piece-release.ts:1108-1125`
- 修改：`docs/prototype-review-records/2026-07-20-cut-piece-release-new-window.md`

- [ ] **步骤 1：编写失败的页面验收测试**

在第一个新窗口用例中增加：

```typescript
await expect(popup.getByRole('link', { name: '返回裁片放行管理' })).toBeVisible()
await expect(popup.getByRole('heading', { level: 1, name: '裁片放行矩阵详情' })).toBeVisible()
await expect(popup.locator('[data-cut-piece-release-detail-header]')).toContainText('PO14671 · ASYSA26060310 · 女式基础圆领短袖')
await popup.getByRole('link', { name: '返回裁片放行管理' }).click()
await expect(popup).toHaveURL('/fcs/craft/cutting/cut-piece-release')
await expect(popup.getByRole('heading', { name: '裁片放行管理' })).toBeVisible()
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```bash
npx playwright test tests/cut-piece-release-new-window.spec.ts -g '查看矩阵' --workers=1 --reporter=line
```

预期：FAIL，页面找不到 `返回裁片放行管理` 或 `裁片放行矩阵详情`。

- [ ] **步骤 3：实现最小页头函数**

在页面文件中增加：

```typescript
function renderMatrixDetailHeader(record: CutPieceReleaseRecord): string {
  const backHref = '/fcs/craft/cutting/cut-piece-release'
  return `
    <header class="flex flex-wrap items-start justify-between gap-3" data-cut-piece-release-detail-header>
      <div>
        <a href="${backHref}" data-nav="${backHref}" class="text-sm text-blue-700 hover:underline">返回裁片放行管理</a>
        <h1 class="mt-2 text-2xl font-semibold text-foreground">裁片放行矩阵详情</h1>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.productionOrderNo)} · ${escapeHtml(record.spuCode)} · ${escapeHtml(record.spuName)}</p>
      </div>
    </header>
  `
}
```

在独立详情页面的反馈区之前渲染 `renderMatrixDetailHeader(getActiveRecord())`，列表页面不调用该函数。

- [ ] **步骤 4：运行专项回归**

运行：

```bash
npx playwright test tests/cut-piece-release-new-window.spec.ts --workers=1 --reporter=line
```

预期：2 条测试全部 PASS。

- [ ] **步骤 5：更新原型审查记录并运行门禁**

记录页面角色为裁床文员管理端，确认返回路径、中文文案、页面层级和 1280×720 可用性。运行：

```bash
npm run check:prototype-design-governance -- --all
npm run build
git diff --check
```

预期：全部退出码为 0。

- [ ] **步骤 6：提交实现**

```bash
git add src/pages/process-factory/cutting/cut-piece-release.ts tests/cut-piece-release-new-window.spec.ts docs/prototype-review-records/2026-07-20-cut-piece-release-new-window.md docs/superpowers/plans/2026-07-20-cut-piece-release-detail-header.md
git commit -m "fix(裁片放行): 补齐矩阵详情页头"
```
