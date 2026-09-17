# 染色、印花提前建单及列表展示迁移审查

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-17 |
| 相关需求 / 任务 | MIG-001～MIG-011；用户要求提前建单、匹配筛选和列表样式迁入协同系统 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS、PFOS |
| 涉及页面路径 | 见第 7 节四条命名路由 |
| 端类型 | 管理端，兼顾主管桌面 |
| 主要角色与任务 | 计划员 / 管理员提前建单、跟踪匹配；工厂人员继续执行加工 |
| 验证版本 | codex/move-early-process-orders-to-fcs，基于 c56c80fb，任务差异以收据绑定 |
| 服务 | 同工作树 Vite 4176；浏览器独立会话 early-migration |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：两个协同列表承接提前创建、匹配状态筛选、取消以及原有七组列表展示；两个工艺工厂列表移除对应管理入口；修复提前单创建和染色提前单恢复的本地保存缺口。

当前基线为 AGENTS.md 第 4、5、7 节。总体设计见 `docs/product-design/染色印花加工单提前创建与生产单自动匹配完整调整方案.md` V1.1，计划和原子矩阵见 `docs/product-design/染色印花提前建单入口迁移实施与追踪.md`。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | FCS 任务编排与执行准备负责创建/匹配管理；PFOS 保留加工执行。使用现有标准列表、分页、列设置。 |
| 文案、状态、数量与单位 | 通过 | 六种筛选、七组业务列、六项统计；两种创建均以 1400 件×1.5×1.10 得到 2310 米。中文状态、按单位分别汇总。 |
| 扫码、真实图片与对象识别 | 通过 | 原图与名称/编码同列；两页大图按钮、遮罩、Esc 关闭及失败反馈均通过。印花列改用全局图片入口；扫码未变。 |
| 防错、危险确认与主管兜底 | 通过 | 未选加工厂阻断且保留输入；审核、不同 SKU、重复单等原有领域门禁保留；取消输入原因后需再次确认。 |
| 交接、跨端事实与异常追溯 | 通过 | 共用领域订单和展示列；不复制订单事实。创建、取消跨进程刷新回归通过。匹配失败与取消历史保留。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768、1280×720、1024×768 均无主体横向溢出。PDA、上传和弱网基础设施未变，不适用。 |
| 命名路由、交互、图片大图与打印 | 通过 | 四路由浏览器通过；六种筛选反馈 3–152ms，DOM 根节点保持；列设置/分页/备货弹窗/图片验证通过。旧简表偏好隔离，不隐藏迁移的新列；工厂打印入口及打印映射未变，打印输出不适用。 |

## 4. 问题标签

- 协作断裂
- 追溯不足

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 提前创建和匹配管理位于工厂执行系统 | 协作断裂 | 计划 / 工厂 | 入口、表单、事件与取消完整迁入 FCS；删除 PFOS 旧管理处理器 | 否 |
| 协同端原简表与工厂端展示不一致 | 协作断裂 | 计划 | 抽取原有七组纯展示列，两端使用同一渲染 | 否 |
| 新创建提前单刷新丢失 | 追溯不足 | 计划 | 复用已有染色/印花事务保存；染色允许恢复校验通过的提前单及任务 | 否，新增独立进程刷新测试 |

## 6. 最终结论

结论：通过

本地原型实现，未提交、未推送、未部署；产品页面接受仍待用户验收。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-dye-orders.ts`
- `src/pages/process-print-orders.ts`
- `src/pages/process-work-orders/early-process-management.ts`
- `src/pages/process-work-orders/order-list-columns.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/data/fcs/page-adapters/process-prep-pages-adapter.ts`
- `src/data/fcs/production-demand-early-process-work-orders.ts`
- `src/data/fcs/dyeing-task-domain.ts`

### 页面路由

- `/fcs/process/dye-orders`
- `/fcs/process/print-orders`
- `/fcs/craft/dyeing/work-orders`
- `/fcs/craft/printing/work-orders`

### 验证命令

- `node --import tsx --test tests/unit/early-process-management-migration.test.ts tests/unit/early-process-persistence.test.ts tests/unit/production-demand-early-process-work-orders.test.ts`：通过，17 项专项；最终构建已统一重跑。
- `npm run build`：通过，最终源码 118 项单测和 Vite 构建通过。
- `npx --offline tsc --noEmit`：失败，62 处范围外既有错误；本次 9 个受管文件错误 0。
- `npm run check:prototype-design-governance -- --all`：通过，覆盖 9 个受管文件与本记录。
- `npm run check:list-page-governance`：通过，406 页静态检查、标准模板及 Chromium 列拖动验证通过。
最终任务收据由 `npm run workflow:verify` 生成，绑定本次全部源码、测试和文档差异；收据的最终状态、检查退出码与 CodeGraph 同步结果见下方 JSON。首次验证发现记录结果格式和 Chromium 沙箱限制，已修正记录并在可启动浏览器的环境复验治理检查。
- 浏览器 CLI：通过，创建、取消、导出、刷新恢复，以及完整列表交互、图片和尺寸均有记录。

### 真实图片验证

沿用现有款式与物料事实的 `imageUrl`，材料来自 `/materials/process-orders/`、`/materials/fei-ticket/` 等现有资源；未引入占位图。款式名称/编码、材料名称/SKU 与缩略图在同一单元格。花型任务产出保留两张图及两个文件，可下载文件。新建弹窗保持图片加载中/失败文案，统一高清图预览支持关闭按钮、遮罩与 Esc。最终运行时检查通过，见 browser-verification.json；三种关闭方式均通过。

### 例外

- 全量 TypeScript 留有范围外 62 处既有错误；构建的受管范围检查和本次文件扫描为 0。未扩展修改无关模块。
- 本次无 PDA 页面、打印版式、上传和真实后端变更，相关专项不适用。

### 证据位置

- `output/playwright/early-process-migration/`：四页截图、三种宽度截图、创建截图、browser-verification.json 与两份 CSV。
- `/private/tmp/early-browser-verified.log`：最终列表浏览器检查。
- `/private/tmp/early-browser-print-persist.log`：印花新单 PH-20260917-000009 刷新保存，2310 米。
- `/private/tmp/early-print-cancel-step1.log`、`early-print-cancel-step2.log`：原因提示与二次确认。
- `/private/tmp/early-process-migration/task-receipt.json`：最终版本、检查和 CodeGraph 收据。
