# 生产准备单创建：测款通过资格

## 1. 基本信息

- 日期：2026-09-24；管理端，跟单创建生产准备单。
- 需求：生产准备单只能选择测款通过的款。
- 记录模式：完整产品审查。
- 版本：main，基于 70fbdd795d5cfd014b71d40e1415b558dbec4192 的隔离发布工作树改动。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：创建候选只保留测款已结束且大货判断为“是”的款式；取消设计改款完成作为候选的替代资格；保留已有未关闭主单、正式生产、归档和图片门禁。
- 依据：用户当前指令、测款单当前最终判断字段，AGENTS.md 第 4、5、7 节。
- 非范围：不回改历史准备单，不发布线上，不改变测款操作流程。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色与任务 | 通过 | 跟单选择已通过款式创建草稿 |
| 文案与状态 | 通过 | 说明最终通过口径；买手通过不等于测款通过 |
| 防错 | 通过 | 候选、选择事件、提交、仓库创建均校验 |
| 共享事实 | 通过 | 读取测款单事实；不新增资格副本 |
| 图片与设备 | 通过 | 沿用档案对应款图，1366×768 及 1280×720 验证 |
| 性能 | 通过 | 本地构建预览逐项记录 |

## 4. 问题标签

- 选不对

## 5. 主要问题与处理

候选原来依据设计改款完成，缺少测款结果约束。改为共享的测款通过判定；未通过时创建必须在任何写入前阻断。测款仓库改为首次使用初始化，以避免新增依赖引发初始化循环；所有公开读取与写入入口保留初始化行为，显式 reset 保持清空语义。

## 6. 最终结论

结论：通过。产品确认人：用户已确认业务要求；最终页面待用户验收。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-testing-order-repository.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/data/pcs-engineering-master-view-model.ts`
- `src/pages/pcs-engineering-master-list.ts`

### 页面路由

- `/pcs/production-preparation/orders`
- `/pcs/production-preparation/orders/:id`
- `/pcs/testing/orders`

### 实施计划与需求追踪

| 编号 | 原子需求 | 实施位置 | 验证证据 | 状态 |
| --- | --- | --- | --- | --- |
| PREP-TEST-001 | 仅已结束且大货判断为是的测款资格 | hasPassedTestingOrder | 单测四种拒绝及通过 | 已验证 |
| PREP-TEST-002 | 候选仅显示通过款式、无匹配显示空态 | renderCreateMasterDialog | 浏览器截图与搜索 | 已验证 |
| PREP-TEST-003 | 保存重新校验，失败不写主单 | createEngineeringMasterOrder | 专项单测及创建刷新 | 已验证 |
| PREP-TEST-004 | 演示种子不得绕过通过条件 | ensureEngineeringMasterDemoData | 干净浏览器初始化 | 已验证 |
| PREP-TEST-005 | 现有测款功能初始化和链路兼容 | ensureTestingOrders | 全量单测、TMF 专项 | 已验证 |
| PREP-TEST-006 | 页面及交互小于 500ms | 创建列表与详情 | 性能原始记录 | 已验证 |

来源均为本记录第 1、2 节；实施顺序为判定、创建校验、候选、种子、测试。PDA/打印不适用，本次不修改相应功能。正反向检查：修改均对应上述编号，无历史记录迁移。

### 验证命令

- `node --import tsx --test tests/unit/pcs-preparation-testing-eligibility.test.ts`：通过。
- `node --import tsx --test tests/unit/tmf-pcs-publish-adopt.test.ts`：通过，夹具补充已通过测款事实。
- `npm run build`：通过，447/447 单元测试通过。
- `npm run check:prototype-design-governance`：通过，使用临时 Git 索引仅纳入本任务文件，4 个受管文件；不修改用户暂存区。

### 真实图片验证

- 来源：款式档案 mainImageUrl，候选 STYLE-PRJ-202603-011 对应连帽夹克图片；图片和款号同一信息块。
- `output/playwright/preparation-tested-style-selection.png`：1366×768 创建弹窗截图。
- 复用列表大图入口；本次不新增或替换图片资源。

### 例外

- 无性能豁免。线上 Vercel 尚未发布。

### 浏览器原始证据

- `output/playwright/preparation-testing-browser-results.txt`：冷缓存刷新 433.8ms，刷新 140.7ms，测量的交互 10.9–186.4ms，创建至草稿详情 35.8ms；刷新后草稿存在。
- `output/playwright/preparation-testing-extra-results.txt`：低分辨率、重复单禁选、列设置和测款列表回归。
- 使用本任务独立构建 `/tmp/higood-prep-testing-dist`，预览端口 4188；1366×768、1280×720。

- `output/playwright/preparation-testing-first-load.txt`：空存储冷启动 445.6ms，切换测款列表 41.1ms，返回准备单列表 18.8ms。
- 局域网预览 `http://192.168.0.23:4188/pcs/production-preparation/orders` 返回 200。

## 8. main 发布复核

- 发布范围：PREP-TEST-001 至 PREP-TEST-006；仅本记录列明的四个受管文件、两个单元测试和本记录。
- 发布工作树：`/tmp/higoods-preparation-testing-release`，`codex/preparation-testing-release`。
- 在该工作树重新执行构建、浏览器和治理；收据写入 `/tmp/preparation-release-receipt.json`。
