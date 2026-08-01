# 裁床仓库库位图增强原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-31 |
| 相关需求 / 任务 | 待加工仓、待交出仓新增库区/库位入口和生产单占用详情增强 |
| 涉及系统 | PFOS |
| 涉及页面路径 | `/fcs/craft/cutting/warehouse-management/wait-process?tab=locations`、`/fcs/craft/cutting/warehouse-management/wait-handover?tab=locations` |
| 端类型 | 管理端、主管端 |
| 主要角色 | 裁床主管、仓库主管、办公室文员、裁床仓管 |
| 主要任务 | 维护库区和库位、查看生产单占用合计、核对待加工物料卷和待交出中转袋菲票 |
| 上游来源 | 裁床待加工仓库存、裁床运行时事件、菲票装袋与中转袋入仓事件、生产单技术包快照 |
| 下游去向 | PFOS 主管查看/编排、Web 中转袋入仓选位、PDA 待加工仓和待交出仓选位 |
| 是否涉及扫码 | 是；本次不改扫码入口，但新增结构进入同一稳定库位投影供扫码/选位解析 |
| 是否涉及数量 | 是；卷数、Yard、米、袋数、菲票数、片数均由系统汇总 |
| 是否涉及交接或责任转移 | 否；只展示入仓后的当前占用事实，不新增交接动作 |
| 是否涉及异常或差异 | 是；损坏结构、停用库位库存、多生产单冲突和缺失明细进入 warning 或待确认区 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `docs/superpowers/specs/2026-07-30-cutting-warehouse-location-map-design.md`
- `docs/superpowers/plans/2026-07-30-cutting-warehouse-location-map-implementation-plan.md`
- 主工作区任务补充计划：`/Users/laoer/Documents/higoods/docs/superpowers/plans/2026-07-31-cutting-warehouse-location-map-enhancement-plan.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 新增结构和占用汇总服务主管、文员和仓管查看，不把管理配置放入 PDA 执行页。 |
| 任务清晰度 | 通过 | 查看模式直接提供“新增库区”“新增库位”，占用格点击后查看对应业务详情。 |
| 信息架构与导航 | 通过 | 保留两仓既有路由与库位图页签，新增能力不改变上下游入口。 |
| 页面模式 | 通过 | 继续采用空间库位图；生产单摘要只提供粗略合计，明细进入抽屉。 |
| 信息负荷 | 通过 | 库位格保留生产单、对象和数量摘要；物料卷与菲票明细后置。 |
| 文案 | 通过 | 页面动作、状态、单位和错误提示均使用中文业务语义。 |
| 数量与状态 | 通过 | 仅长度单位换算 Yard/米；非长度单位不伪造卷长；袋内菲票显示片数；库位仍只显示空闲、占用。 |
| 扫码与识别 | 通过 | 本次是主管 Web 查看增强；详情补款式图、物料图、袋码、卷号和菲票号帮助核对。 |
| 防错 | 通过 | 新增和改名按 PDA 同一归一化口径检查名称/编号重复；损坏结构回退；停用库位库存和多生产单冲突进入待确认；结构保存使用布局版本校验。 |
| UI 样式 | 通过 | 沿用既有企业后台库位图、弹窗和抽屉视觉，状态色克制，按钮有明确文字。 |
| 组件交互 | 通过 | 弹窗、抽屉、生产单摘要、待确认区和内层明细分页使用局部 DOM 更新；新增结构后保留当前页面位置。 |
| 协作关系 | 通过 | 待加工仓按生产单物料卷核对，待交出仓按生产单中转袋和已装菲票核对。 |
| 异常与追溯 | 通过 | 详情保留生产单、任务/裁片单、对象编号、入仓人、入仓时间和库位范围。 |
| 现场设备可用性 | 通过 | 既有 1366x768、1280x720 和小屏横向溢出验收保留；宽明细仅在抽屉内部滚动。 |

## 4. 问题标签

- 无未关闭问题标签。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 弹窗原挂在应用根节点外，点击事件无法进入项目事件委托 | `组件误用`、`点错风险` | 主管、仓管 | 将弹窗挂到当前库位图 section，并由局部点击处理器保存和刷新。 | 否 |
| 保存按钮使用原生提交，异步处理器加载时可能触发表单导航 | `组件误用`、`点错风险` | 主管、仓管 | 改为普通按钮并显式声明跳过整页重绘。 | 否 |
| 占用格原摘要不足以核对真实物料卷或袋内菲票 | `追溯不足`、`选不对` | 主管、仓管 | 补款式图、物料图、唯一卷号、Yard/米和袋内菲票明细。 | 否 |
| 演示占用曾进入共享选位投影 | `选不对`、`协作断裂` | 一线仓管 | 事实投影和普通 PFOS 页面默认不注入 demo；只有 `demo=1` 的明确演示路由启用，SELECT 模式始终关闭。 | 否 |
| 停用库位库存和多生产单冲突可能静默丢失或依赖输入顺序 | `追溯不足`、`选不对` | 主管、仓管 | 全部冲突事实进入待确认区；冲突库位保持占用、禁止选位，并保留全部占用详情供主管核对。 | 否 |
| 非长度单位曾按 Yard/米拆卷 | `算不准` | 主管、仓管 | 仅 yard/码和 m/米允许换算；公斤、件、卷、匹等显示卷明细待补充。 | 否 |
| 同一中转袋演示数据曾跨两个库位 | `选不对` | 主管、仓管 | 改为同一生产单的两个独立袋分别占一个库位，菲票和片数按袋汇总。 | 否 |
| 部分菲票快照无法解析时摘要与详情口径不一致 | `追溯不足` | 主管、仓管 | 保留全部菲票号和已装袋状态，摘要按全部票号计数，并明确显示待补充明细数量。 | 否 |
| 损坏 JSON 编排只能提示、无法恢复 | `组件误用` | 主管、文员 | 增加“恢复默认编排”明确确认动作，普通保存仍拒绝静默覆盖损坏内容。 | 否 |
| 跨工厂复用 locationId 时运行事件可能投影到错误仓库 | `选不对`、`协作断裂` | 仓管、一线执行员 | 待加工和待交出事实均按工厂、仓库和仓库类型三项身份过滤；PDA 占用校验使用同一口径。 | 否 |
| 位置调整后仍显示调整前数量和库位范围 | `算不准`、`追溯不足` | 主管、仓管 | 最新调整事件优先读取 `remainingByUnit` 和最新 locationRefs；剩余为零时释放占用。 | 否 |
| 缺逐卷数据时固定伪造 3 卷 | `算不准` | 主管、仓管 | 运行事件按真实 rollCount 生成明确标记的演示卷行；无可信卷数时只显示卷明细待补充。 | 否 |
| 库位编号大小写口径与 PDA 扫码不一致 | `选不对` | 文员、一线执行员 | 新增、自动编号、改名和扫码统一按 NFKC、连接符、空白及大小写归一化判断唯一性。 | 否 |
| 同工厂同类型多仓共享布局和历史快照 | `协作断裂` | 主管、文员 | v2 存储键加入 `warehouseId`，旧 v1 键仅作为迁移读取兜底。 | 否 |
| 待交出同袋码跨工厂或跨周期折叠 | `选不对`、`追溯不足` | 仓管、一线执行员 | 生命周期状态键包含仓库身份和使用周期；PDA 幂等键按周期生成。 | 否 |
| 加工领料 OUT 事实未扣减待加工仓占用 | `算不准` | 仓管、主管 | 地图按会话、物料和库位聚合 OUT 数量后计算当前剩余占用。 | 否 |
| 部分卷明细被误当完整事实 | `算不准`、`追溯不足` | 主管、仓管 | 卷行数量与 rollCount、长度合计均校验；不完整时保留总量并显示明细待补充。 | 否 |
| 旧版库位码缺少仓库身份 | `选不对` | 一线执行员 | 新版二维码要求工厂、仓库、仓库类型和稳定库位 ID；旧版仅全局唯一时兼容。 | 否 |
| PDA 调整会话与运行事件写入可能半成功 | `协作断裂`、`算不准` | 一线仓管、主管 | 打开时记录会话指纹，提交前校验；失败时仅在存储仍等于本次写入结果时回滚，避免覆盖并发事实。 | 否 |
| 无稳定仓库身份的历史文本事件可能被错归仓 | `追溯不足`、`选不对` | 主管、仓管 | 仅全局唯一匹配时归仓；无法唯一定位时保留在运行事件账等待人工归档，不投影到具体仓库。 | 否 |
| 跨仓同袋码同周期交出可能释放错误占用 | `选不对`、`协作断裂` | 仓管、一线执行员 | Web/PDA 交出动作直接携带当前仓库稳定 locationRef，无法唯一确认时阻断交出。 | 否 |

## 6. 最终结论

结论：通过

说明：本次增强符合管理端/主管端信息密度和仓储“物在哪里、属于哪个生产单”的页面模式；新增结构、占用摘要和业务详情均保留中文、防错、追溯和局部更新要求。实现完成后已按设计文档、增强计划和受影响代码逐行复审五轮，第五轮发现的多仓存储键、袋码生命周期、OUT 扣减、部分卷明细和并发回滚问题已修复；最终独立复核无未关闭的 Critical、High 或 Important。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/ui/warehouse-location-map.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/pages/process-factory/cutting/warehouse-location-layout-store.ts`
- `src/pages/process-factory/cutting/warehouse-location-map-model.ts`
- `src/pages/process-factory/cutting/warehouse-location-map.ts`
- `src/pages/pda-cutting-inbound.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/pda-cutting-handover.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `scripts/check-pda-cutting-inbound-workflow.ts`
- `docs/superpowers/specs/2026-07-30-cutting-warehouse-location-map-design.md`

### 页面路由

- `/fcs/craft/cutting/warehouse-management/wait-process?tab=locations`
- `/fcs/craft/cutting/warehouse-management/wait-handover?tab=locations`

### 验证命令

- `npm run check:cutting-warehouse-location-map`：通过
- `npm run check:factory-internal-warehouse-model`：通过
- `npx playwright test tests/cutting-warehouse-location-map.spec.ts --grep "普通查看模式可新增库区并在刷新后保留"`：通过
- `npx playwright test tests/cutting-warehouse-location-map.spec.ts --grep "普通查看模式可向既有货架新增库位并在刷新后保留"`：通过
- `npx playwright test tests/cutting-warehouse-location-map.spec.ts --grep "新增结构入口覆盖取消、必填、重复编号、版本冲突和编排隐藏"`：通过
- `npx playwright test tests/cutting-warehouse-location-map.spec.ts --grep "两张库位图占用详情分别展示物料卷和袋内菲票"`：通过
- `npm run check:cutting-warehouse-location-map-e2e`：通过（12/12）
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run build`：通过

### 例外

- 编排和新增结构使用浏览器本地存储，不接真实后端、数据库权限或审批；这是原型仓库边界，版本校验、稳定 ID、重复编号阻断和刷新持久化仍保留。
- 不新增 PDA 结构维护入口；一线执行端继续只承担扫码和选位，避免把管理配置下放给员工。
- 原设计的编排快照已明确扩展为可保存原型新增结构，这是因为通用仓库 Store 仅驻留内存；新增结构统一进入裁床稳定库位投影，真实交付时仍应由仓库主数据服务承接。
- 本原型没有真实角色鉴权；新增按钮按用户确认的 VIEW/LAYOUT 模式显示，正式系统需由主管/文员权限控制。PDA/SELECT 模式不显示新增入口和管理摘要。
- 真实技术包图片缺失时显示“待补充”，不使用错误款式图冒充；固定样例图片只用于明确的 demo 占用。
