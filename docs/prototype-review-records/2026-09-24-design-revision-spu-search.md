# 设计改款原款式与新款式支持搜索

## 1. 基本信息

main 基线 9439c98a40e9eccca9c4a0176590385414193fd0；工作树 /Users/laoer/Documents/higoods。生产构建 Chromium 验证，1366×768，原创建流程另覆盖 1280 宽度。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：原款式与新款式由原生单选框改为可展开搜索列表，按 AGENTS.md 第 4、5、7 节核查。

## 3. 自查结论

| 项目 | 结论 | 说明 |
| --- | --- | --- |
| 操作 | 通过 | 点击展开后自动聚焦搜索，支持完整 SPU、部分编码和款式名称；忽略首尾空格和大小写 |
| 确认 | 通过 | 搜索不改变已选款式，选择候选款式后才更新业务字段 |
| 反馈 | 通过 | 无匹配显示明确提示；清空恢复候选；Esc、点击外部可关闭 |
| 保存 | 通过 | 沿用原款式、新款式字段与原保存校验，草稿重载保留选择 |
| 图片 | 通过 | 沿用档案图片与现有款式卡片和大图入口，没有替换图片来源 |
| 性能 | 通过 | 输入仅更新当前候选选项，不重绘页面；浏览器证据见下 |
| PDA/打印 | 不适用 | 不适用，本次只修改管理端创建页的两个选择控件 |

## 4. 问题标签

SPU 搜索、复制粘贴、局部更新。

## 5. 主要处理

复用档案候选与原选择事件，增加搜索输入和无匹配提示。初次回归发现页面统一点击处理取消了原生 details 展开动作；触发器交由浏览器处理默认展开，避免异步模块加载与缓存状态造成不一致。选择和搜索保持局部刷新。

## 6. 最终结论

结论：通过。

新下拉 70 个测量样本全部 <500ms，最高 320.21ms，剪贴板搜索最高 41.71ms。两个字段各重复 5 轮。创建全流程与容量回归 3 个浏览器测试通过；尚未提交或推送。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/pcs-independent-sampling.ts`

### 页面路由

- `/pcs/production-preparation/design-revision/new`
- `/pcs/production-preparation/design-revision/:id`（保存重载与提交回归）

### 验证命令

- `npx vite build`：通过
- `node scripts/check-typescript-scope.mjs src/pages/pcs-independent-sampling.ts`：通过

- `CUTTING_E2E_PORT=4734 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-design-revision-spu-search.spec.ts tests/pcs-design-revision-single-page.spec.ts tests/pcs-design-revision-storage-quota.spec.ts --workers=1 --reporter=line`：通过
- `CUTTING_E2E_PORT=4735 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-design-revision-spu-search.spec.ts --workers=1 --reporter=line --output=/tmp/spu-search-results`：通过

### 证据

- `evidence/2026-09-24-spu-search.png`
- `evidence/2026-09-24-spu-search-performance.json`
- `evidence/2026-09-24-spu-single-page-performance.json`

- `tests/pcs-design-revision-spu-search.spec.ts`
- `tests/pcs-design-revision-single-page.spec.ts`
- `tests/pcs-design-revision-storage-quota.spec.ts`

### 例外

- 无。
