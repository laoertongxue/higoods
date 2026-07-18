# 新建铺布扁平查询区实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 去掉新建铺布查询区的重复内层线框，并让“查询”按钮或回车显式触发生产业务筛选。

**架构：** 保留 `renderSection` 提供的唯一外层区块，移除 `renderStickyFilterShell` 内层卡片。页面状态区分输入中的关键词与已生效关键词；输入事件仅同步草稿，按钮或表单提交时才应用筛选并重绘结果。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、Playwright。

---

### 任务 1：锁定查询区结构与行为

**文件：**
- 修改：`tests/cutting-spreading-create-single-step.spec.ts`

- [x] **步骤 1：编写失败的测试**

在现有创建页用例中断言查询区不存在额外的筛选卡片标记，存在“查询”按钮；输入 `DEM-202603-0014` 后结果仍未筛选，点击“查询”后只剩对应方案。另增加按 Enter 触发查询的断言。

- [x] **步骤 2：运行测试验证失败**

运行：`PLAYWRIGHT_BASE_URL=http://127.0.0.1:4178 npx playwright test tests/cutting-spreading-create-single-step.spec.ts --reporter=line`

预期：FAIL，原因是页面尚无“查询”按钮，且输入仍立即筛选。

### 任务 2：实现扁平查询区

**文件：**
- 修改：`src/pages/process-factory/cutting/marker-spreading.ts`
- 修改：`src/main-handlers/fcs-handlers.ts`

- [x] **步骤 1：增加查询草稿状态**

在 `MarkerSpreadingPageState` 中增加 `createKeywordDraft: string`，路由初始化与重置时清空；创建页输入事件只更新草稿并跳过页面重绘。

- [x] **步骤 2：替换查询区模板**

让 `renderSpreadingCreateBusinessSearch` 直接返回表单内容，不调用 `renderStickyFilterShell`。表单包含生产业务查询输入框、蓝色“查询”提交按钮和“重置”按钮。

- [x] **步骤 3：应用查询**

增加 `handleCraftCuttingMarkerSpreadingSubmit`：识别创建页查询表单，把草稿写入 `state.keyword`，回到第一页并清除旧选择。点击“查询”复用相同应用函数；`dispatchFcsPageSubmit` 接入该处理器，使 Enter 与按钮提交一致。

- [x] **步骤 4：运行专项测试验证通过**

运行：`PLAYWRIGHT_BASE_URL=http://127.0.0.1:4178 npx playwright test tests/cutting-spreading-create-single-step.spec.ts --reporter=line`

预期：PASS。

### 任务 3：治理与交付验证

**文件：**
- 修改：`docs/prototype-review-records/2026-07-18-spreading-create-single-step.md`

- [x] **步骤 1：运行治理和构建检查**

运行：`npm run check:prototype-design-governance && npm run check:list-page-governance && npm run build`

预期：全部通过。

- [x] **步骤 2：浏览器验收**

在 `http://localhost:4178/fcs/craft/cutting/spreading-create` 验证查询区仅一层线框，点击“查询”、按 Enter 和“重置”均符合设计；同时确认控制台无错误。
