# FCS 本次竞价工厂池与生产单回货列表联动调整原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-11 |
| 相关需求 / 任务 | 本次竞价工厂池、最低允许报价、招标管理联动，以及生产单列表回货履约提醒 |
| 记录模式 | 完整产品审查 |
| 治理依据 | `AGENTS.md` 第 3.1、4、5、7、8 节 |
| 涉及系统 | FCS |
| 涉及页面路径 | `/fcs/dispatch/workbench`、`/fcs/dispatch/tenders`、`/fcs/pda/task-receive`、`/fcs/production_order_track/index` |
| 端类型 | 管理端、员工执行端 PDA |
| 主要角色与任务 | 生产计划员发起竞价；候选工厂 PDA 报价；定标员查看/定标；跟单员从生产单列表催回货 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：任务分配竞价弹窗新增最低允许报价与二次确认，并把手动工厂池由单列复选框改为左候选、中央加入/移除、右侧正式工厂池的穿梭选择器；任务分配竞价行新增工厂池/报价进度和招标深链；招标单管理新增池内工厂、报价进度、最低价和组合筛选；PDA 价格可见边界调整为只显示最低允许报价；生产单进度列表直接显示按加工厂回货节点、缺口和提醒状态，并新增相应筛选。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端发起/查看/定标，PDA 只报价，生产进度列表用于管理跟单；主动作没有混淆 |
| 文案、状态、数量与单位 | 通过 | 竞价明确整个任务、最低允许报价和 IDR/件；回货明确自然日、百分比、应回/确认/缺口 |
| 扫码、真实图片与对象识别 | 通过 | 竞价和招标不新增款式/物料对象；生产单列表沿用每个款式和物料的对应图片、缩略图和大图入口 |
| 防错、危险确认与主管兜底 | 通过 | 无效池成员、空池、低于最低价、重复/过期报价、未报价定标和篡价均阻断；高于标准价定标需要原因；发起和定标二次确认 |
| 交接、跨端事实与异常追溯 | 通过 | Web、PDA 和招标管理读取同一竞价记录；列表和详情读取同一回货快照/到货/提醒事实；取消和改派保留历史 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 管理端按 1366×768、PDA 按小屏完成命名页面回放；本仓库不实现真实弱网队列，错误保留即时提示和重新操作入口 |
| 命名路由、交互、图片大图与打印 | 通过 | 四个命名页面已完成浏览器回放；款式缩略图、高清大图与 Esc 关闭通过；合同模板指纹专项通过且本次未改打印母版 |

## 4. 问题标签

- `选不对`
- `协作断裂`
- `算不准`
- `追溯不足`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 工厂池存在但发起后难以查询各工厂报价 | 协作断裂 | 计划员、定标员 | 工作台展示报价摘要并深链招标单；招标详情列出全部池成员 | 否 |
| 手动模式用单列复选框同时表达候选和已入池，无法判断本次工厂池边界 | 选不对 | 生产计划员 | 改为穿梭选择器；左侧仅候选，右侧为唯一正式工厂池，勾选后必须执行加入/移除 | 否 |
| 独立车缝派单框展示默认价，但生成任务事实未维护同一标准价，竞价会被有效价格门禁阻断 | 算不准 | 生产计划员、定标员 | 在任务生成价格事实源统一维护车缝标准价 1,200 IDR/件；不放松标准价和最低价门禁 | 否 |
| Node 专项读取 `globalThis.localStorage` 触发实验性提示，干扰清洁验收 | 追溯不足 | 研发、测试 | 浏览器存储适配器、FCS 实际加载的裁床排唛来源/投影、裁单关闭记录与毛织事实仓库，以及上游 PCS 配置、款式档案、技术包版本仓库只在真实 `window` 中读取，并对不可用/权限异常安全返回空存储；不通过屏蔽警告规避 | 否 |
| 旧报价区间误把标准价推导成上下限 | 算不准 | 工厂、定标员 | 删除最高限价，只保留手填最低允许报价；高于标准价仅在定标时要求原因 | 否 |
| PDA 可能看到不应公开的内部价格或他厂报价 | 追溯不足 | 候选工厂 | PDA 只展示本次最低允许报价和本厂报价 | 否 |
| 回货提醒只在详情中，列表无法及时催货 | 协作断裂 | 跟单员 | 列表直接展示最紧急加工厂节点、缺口和提醒状态，点击看全部 | 否 |
| 多工厂履约可能被生产单级汇总抵扣 | 算不准 | 跟单员、结算 | 每个分配/工厂独立计算，列表只选最高优先级一条，不合并数量 | 否 |
| 页面渲染可能重复生成提醒 | 追溯不足 | 跟单员、系统管理员 | 提醒由显式任务生成且幂等；列表和详情只读取日志 | 否 |

## 6. 最终结论

结论：通过

说明：竞价工厂池穿梭选择器、车缝标准价统一事实及相邻竞价闭环已完成最后修改后的专项检查与 5 条 Playwright 场景复核；治理、构建、CodeGraph 和任务收据结果见下方当前版本证据。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/runtime-task-tenders.ts`
- `src/data/fcs/process-tasks.ts`
- `src/data/browser-storage.ts`
- `src/data/pcs-config-workspace-repository.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/fcs/cutting/marker-plan-source.ts`
- `src/data/fcs/cutting/cut-order-close-records.ts`
- `src/data/fcs/wool-domain/store.ts`
- `src/pages/process-factory/cutting/marker-plan-projection.ts`
- `src/pages/process-factory/cutting/marker-plan-model.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/pda-mobile-mock.ts`
- `src/data/fcs/pda-task-mock-factory.ts`
- `src/data/fcs/cutting/pda-cutting-task-scenarios.ts`
- `src/data/fcs/production-return-fulfillment.ts`
- `src/data/fcs/production-return-progress-mock.ts`
- `src/pages/unified-dispatch-workbench.ts`
- `src/pages/dispatch-tenders.ts`
- `src/pages/pda-task-receive.ts`
- `src/pages/pda-task-receive-detail.ts`
- `src/pages/production-order-progress-tracking.ts`
- `src/main.ts`

### 页面路由

- `/fcs/dispatch/workbench`
- `/fcs/dispatch/tenders`
- `/fcs/pda/task-receive`
- `/fcs/production_order_track/index`

### 验证命令

- `npm run check:fcs-whole-task-tender-pool`：通过。
- `npm run check:fcs-sewing-preparation-return-preview`：通过。
- `npm run check:production-order-progress-tracking`：通过。
- `npm run check:fcs-unified-assignment-foundation`：通过。
- `npm run check:production-contract-template-fidelity`：通过。
- `npm run check:fcs-dispatch-bagging`：通过。
- `npm run check:sewing-awarded-pda-seed`：通过。
- `npm run check:pda-task-receive-scope`：通过。
- `npm run check:pda-receive-mock-deadline-status`：通过。
- `npm run check:sewing-reassignment-cold-start`：通过。
- `四个命名页面浏览器回放（1366×768 管理端、PDA 小屏）`：通过；竞价发起/二次确认、池内 PDA 报价、招标详情深链、履约筛选/详情、大图 Esc 均已回放。
- `NODE_OPTIONS=--trace-warnings` 分别运行车缝准备、整任务竞价、统一分配和生产单进度四组专项：通过；业务断言全部成立，且无浏览器存储实验性警告。
- `npm run check:prototype-design-governance -- --all`：通过；覆盖 22 个用户可见受管文件和 1 份审查记录。
- `npm run check:list-page-governance`：通过；静态治理、标准列表模板 Chromium 拖拽和原型治理全部通过。
- `npm run build -- --logLevel warn`：通过。
- `codegraph sync / codegraph status`：通过；1,486 个文件、45,581 个节点、162,758 条边，无待同步文件。
- `workflow:verify`：不适用；工具要求 `--paths` 完整覆盖全部实际变化，因未跟踪的无关文件 `docs/product-design/PCS生产工程管理完整调整方案.md` 不属于本轮 FCS 边界而拒绝生成；未搬移、暂存或吸收该用户文件。FCS 专项、5 条 Playwright 场景、治理、构建和 CodeGraph 均已独立通过。

### 真实图片验证

- 竞价工厂池、招标管理和 PDA 报价不新增款式/物料展示，因此不适用新增图片门禁。
- 生产单进度列表继续展示款式实拍图与物料实拍图；浏览器已确认缩略图可打开高清大图，关闭按钮和 Esc 均可关闭且不溢出当前视口。

### 例外

- 原型不实现真实消息推送、弱网离线队列或自动重试；工厂 PDA 消息由共享竞价事实投影。该例外不改变池内/池外权限和一次报价规则。
