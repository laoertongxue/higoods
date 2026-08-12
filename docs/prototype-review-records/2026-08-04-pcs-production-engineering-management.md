# PCS 生产工程管理完整原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-04 |
| 相关需求 / 任务 | 完成总体设计、实施计划和 527 条原子需求 |
| 涉及系统 | PCS、FCS 生产准备时效只读入口 |
| 涉及页面路径 | 工程主单、改款／设计打样、六类专业任务、技术资料、工程变更、生产准备时效 |
| 端类型 | 管理端 |
| 主要角色 | 跟单、买手、版师、制作团队、采购人员、染厂 |
| 主要任务 | 创建并发布工程主单、执行专业任务、维护 BOM 与价格、审核并发布技术包、关闭主单、关闭后变更 |

## 2. 参考规范

- `AGENTS.md` 第 4、5、7 节
- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `docs/product-design/PCS生产工程管理总体设计文档.md`
- `docs/product-design/PCS生产工程管理实施计划.md`
- `docs/product-design/PCS生产工程管理需求追踪与交付矩阵.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 跟单、买手、制作团队、采购人员和染厂动作按业务责任分离 |
| 任务清晰度 | 通过 | 主单负责组织，专业任务在自己的页面办理 |
| 信息架构与导航 | 通过 | 删除“我的工程任务”，保留按专业类型入口；技术包和模板库归入技术资料 |
| 页面模式 | 通过 | 管理端使用列表、详情、任务表格、抽屉、筛选和分页 |
| 信息负荷 | 通过 | 页面只保留办理所需字段，依赖和状态直接呈现 |
| 文案 | 通过 | 使用业务中文和“毛织”等统一术语，无迁移提示 |
| 数量与状态 | 通过 | BOM、采购覆盖、任务进度、双币成本和时效均从共享事实推导 |
| 扫码与识别 | 不适用 | 本期为管理端生产工程模块，无现场扫码动作 |
| 防错 | 通过 | 首单、唯一主单、固定依赖、价格、采购覆盖、技术包和关闭均有阻断 |
| UI 样式 | 通过 | 沿用 PCS 企业后台样式与标准列表组件 |
| 组件交互 | 通过 | 弹窗、筛选、分页、任务动作和大图均提供可见反馈 |
| 协作关系 | 通过 | 工程主单执行线与生产准备时效统计线分离，成果和审核责任清晰 |
| 异常与追溯 | 通过 | 返工、解绑、审核结论、版本和操作日志保留必要事实 |
| 现场设备可用性 | 通过 | 按管理端桌面分辨率验收；本期无 PDA 页面 |

## 4. 问题标签

- 状态抽象
- 字段过载
- 协作断裂
- 追溯不足
- 点错风险

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 通用“我的工程任务”无法表达专业成果 | 状态抽象 | 全部角色 | 删除整模块，改为专业任务入口 | 否 |
| 新主单可绕过方案确认 | 点错风险 | 跟单 | 系统或人工创建后均先进入草稿，由跟单确认后一次生成任务 | 否 |
| 时效页面与执行线各自维护事实 | 协作断裂 | 跟单、管理人员 | 时效仅投影工程主单和专业任务事件 | 否 |
| 技术包、BOM、专业成果关系不清 | 追溯不足 | 买手、跟单 | 技术包聚合来源成果，发布时形成正式 BOM 和价格快照 | 否 |
| Mock 记录少且任务空白 | 字段过载 | 评审人员 | 补齐多准备类型、多状态、并行、返工、关闭和变更场景 | 否 |
| 工程主单泳道卡片图信息分散、阅读成本高 | 字段过载 | 跟单、管理人员 | 改为逐行任务表格，直接展示阶段、专业类型、负责人、固定前置、节点、时间和状态 | 否 |
| 专业任务详情只有档案信息，缺少办理动作且无审核任务出现“待审核” | 状态抽象、协作断裂 | 版师、制作团队、花型团队、染厂、采购人员、跟单、买手 | 详情统一增加款式、负责人、来源、计划、主单和“当前动作”；待开始任务由负责人显式开始，制版与产前版样衣提交即完成，花型与调色提交后由买手审核；采购绑定和技术包生成继续使用各自单一业务动作自动推进 | 否 |
| “开始任务”点击后被全页重绘覆盖，且早期本地 Mock 主单缺少生产准备类型 | 状态抽象、追溯不足 | 版师等专业任务负责人 | 开始动作改为局部刷新，成功立即显示“进行中”和成果编辑区，失败保留可见原因；对已发布的早期 Mock 主单按已确认任务结构恢复固定依赖类型 | 否 |
| 独立改款／设计打样只有混合列表和空详情 | 协作断裂、追溯不足 | 跟单、买手、专业团队 | 拆分独立列表与创建入口，落实方案确认、专业任务、整单成果、BOM 与价格以及工程主单复用 | 否 |

## 6. 最终结论

结论：通过

说明：

- 总体设计、实施计划、原子需求矩阵与当前实现使用同一业务口径。
- 原型只表示本地 Mock 业务行为已验证，不表示生产后端或真实业务已经上线。
- 样衣管理、商品测款新开发、真实采购下单和真实大货染色仍在本期非范围。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/tech-packs.ts`
- `src/data/pcs-engineering-bom-material-resolver.ts`
- `src/data/pcs-engineering-bom-pricing.ts`
- `src/data/pcs-engineering-bom-types.ts`
- `src/data/pcs-engineering-bom-version.ts`
- `src/data/pcs-engineering-change-workspace.ts`
- `src/data/pcs-engineering-current-user.ts`
- `src/data/pcs-engineering-dependency-policy.ts`
- `src/data/pcs-engineering-first-production-policy.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/data/pcs-engineering-color-task-service.ts`
- `src/data/pcs-engineering-task-review.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-engineering-master-types.ts`
- `src/data/pcs-engineering-master-view-model.ts`
- `src/data/pcs-engineering-pattern-result.ts`
- `src/data/pcs-engineering-preparation-projection.ts`
- `src/data/pcs-engineering-purchase-linkage.ts`
- `src/data/pcs-engineering-tech-pack-workspace.ts`
- `src/data/pcs-project-technical-data-writeback.ts`
- `src/data/pcs-project-instance-model.ts`
- `src/data/pcs-tech-pack-design-requirement.ts`
- `src/data/pcs-tech-pack-version-log-types.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/main-handlers/pcs-handlers.ts`
- `src/pages/pcs-engineering-change.ts`
- `src/pages/pcs-engineering-master-detail.ts`
- `src/pages/pcs-independent-sampling.ts`
- `src/pages/pcs-engineering-tasks.ts`
- `src/pages/pcs-engineering-tasks/first-sample-task.ts`
- `src/pages/pcs-engineering-tasks/master-task-common.ts`
- `src/pages/pcs-engineering-tasks/pattern-task.ts`
- `src/pages/pcs-engineering-tasks/color-task.ts`
- `src/pages/pcs-engineering-tasks/plate-making-task.ts`
- `src/pages/pcs-engineering-tasks/purchase-task.ts`
- `src/pages/pcs-engineering-tasks/tech-pack-task.ts`
- `src/pages/pcs-product-archives.ts`
- `src/pages/pcs-projects.ts`
- `src/pages/pcs-technical-data.ts`
- `src/pages/production/preparation-timing.ts`
- `src/pages/tech-pack/bom-domain.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/events.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-pcs.ts`

### 页面路由

- /pcs/engineering/masters
- /pcs/engineering/masters/:id
- /pcs/engineering/revision-sampling
- /pcs/engineering/revision-sampling/:id
- /pcs/engineering/design-sampling
- /pcs/engineering/design-sampling/:id
- /pcs/patterns/plate-making
- /pcs/patterns/artwork
- /pcs/engineering/color
- /pcs/engineering/purchase
- /pcs/engineering/tech-pack
- /pcs/samples/first-sample
- /pcs/technical-data/tech-packs
- /pcs/technical-data/bom-pricing
- /pcs/pattern-library
- /pcs/engineering/changes
- /pcs/engineering/changes/new
- /pcs/engineering/changes/:id
- /fcs/production/preparation-timing
- /fcs/production/preparation-timing-statistics

### 图片门禁

- 款式和物料在对象信息块内同时展示真实缩略图、名称和编码。
- 缩略图可打开高清大图；支持关闭按钮、遮罩和 Esc。
- 图片保持宽高比，并提供加载和失败反馈。
- Mock 中的每个款式和物料均使用稳定可访问的对应图片；不使用色块或图标冒充。

### 验证命令

- `npm run check:pcs-engineering-master`：通过（22/22）。
- `npm run check:production-preparation-timing`：通过。
- `npm run check:pcs-engineering-delivery-matrix`：通过。
- `npm run check:menu-routes`：通过。
- `npm run check:list-page-governance`：通过。
- `npm run check:prototype-design-governance -- --all`：通过。
- `npm run build`：通过。
- `CodeGraph status`：通过（无待同步文件）。
- `npm run workflow:verify`：通过。

### 例外

- 无
