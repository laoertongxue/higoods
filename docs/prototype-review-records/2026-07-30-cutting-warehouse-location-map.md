# 裁床待加工仓与待交出仓库位图原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-30 |
| 相关需求 / 任务 | 裁床待加工仓、待交出仓库位可视化、稳定编排及 PFOS/PDA 选位闭环 |
| 涉及系统 | PFOS、PDA |
| 端类型 | 管理查看端、现场执行端 |
| 主要角色 | 裁床主管、仓库主管、办公室文员、待加工仓仓管、待交出仓工人 |
| 管理端路径 | `/fcs/craft/cutting/warehouse-management/wait-process?tab=locations`、`/fcs/craft/cutting/warehouse-management/wait-handover?tab=locations` |
| 现场端路径 | `/fcs/pda/warehouse/wait-process?scope=cutting&view=pickup`、`/fcs/pda/cutting/inbound/:taskId?action=inbound-location`、`/fcs/pda/cutting/handover/:taskId?action=special-craft-return` |
| 主要任务 | 查看空闲/占用、查看占用对象、编排库区/货架/库位、连续多选存放范围、中转袋与特殊工艺回仓单选入仓 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `docs/superpowers/specs/2026-07-30-cutting-warehouse-location-map-design.md`
- `docs/superpowers/plans/2026-07-30-cutting-warehouse-location-map-implementation-plan.md`
- `docs/superpowers/reviews/2026-07-30-cutting-warehouse-location-map-implementation-audit.md`

## 3. 自查结论

### 角色、设备与协作审查

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | PFOS 供主管、文员查看和编排；PDA 供现场仓管执行扫码、选位和确认。 |
| 设备匹配 | 通过 | 固定电脑/iPad 承载完整库位图；PDA 承载高频单步扫码和选位；无需现场手写后二次录入。 |
| 当前工厂 | 通过 | PFOS 明示并可切换当前裁床工厂；PDA 使用登录运行时 `factoryId`，不让一线重复选择。 |
| 协作事实 | 通过 | PFOS 与 PDA 都写入裁床运行时事件账；库位图从共同库存和事件事实投影，不建立手工占用台账。 |
| 业务动作边界 | 通过 | 菲票装袋、中转袋入仓、交出装袋确认、最终交出、特殊工艺交出和回仓保持为不同动作。 |

### 信息架构与页面模式审查

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 物理层级 | 通过 | 只使用“仓库—库区—货架—库位”，没有“库位组”。现场的一组物理区域由“库区”承接。 |
| 路由与工作台 | 通过 | 保留原路由、页签和单页弹窗工作台，只把“库区库位”页签改为“库位图”。 |
| 两态表达 | 通过 | 日常图只有“空闲、占用”；选中是临时效果，停用是主数据属性，不形成第三业务状态。 |
| 空间关系 | 通过 | 库区按卡片排列，货架纵向排列，库位按保存顺序单行排列；仅货架行允许横向滚动。 |
| 信息负荷 | 通过 | 格内只显示编号、状态及生产单/物料或袋摘要；完整字段进入占用详情。 |
| 列表治理 | 通过 | 库位图是空间分组视图，不声明标准列表页；占用详情和未定位清单按 10 条分页。 |

### 业务规则与防错审查

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 稳定身份 | 通过 | 顺序和占用关联稳定 ID；库区、货架、库位编号/名称可改，但不改变身份、位置或相邻关系。 |
| 编排隔离 | 通过 | 编排按 `factoryId + warehouseKind` 隔离，有版本校验、损坏回退、变更记录和新节点提示。 |
| 历史迁移 | 通过 | 依次按稳定 ID、完整当前路径、唯一当前编号、历史改号匹配；结果区分已匹配、待确认、无法匹配。 |
| 连续多选 | 通过 | 待加工仓只允许同仓、同库区、同货架、按布局顺序连续的空闲库位；编号不参与相邻判断。 |
| 选位交互 | 通过 | 支持端点扩展/缩短、中间断开阻断、清空重选、范围摘要；无效格禁用但仍显示原业务状态。 |
| 多库位数量 | 通过 | 一批物料只保存一次总量和一个 `storageFootprint`，多个格只引用同一范围，不重复累计。 |
| 部分领出 | 通过 | 有余量时默认保留原范围；“调整剩余存放范围”只写位置调整事实；余量为零释放全部范围。 |
| 待交出生命周期 | 通过 | 装袋不占位、入仓才占位、换袋继承位置不双算、最终交出释放、特殊工艺部分交出按量扣减、回仓在新位置恢复。 |
| 并发重校验 | 通过 | 确认前读取最新投影；冲突列出具体库位并保留仍有效的连续选择；不部分写入。 |
| 写入顺序 | 通过 | 共享运行时事件先成功，本地 PDA 状态后更新；失败保留袋码、菲票和库位选择。 |
| 幂等 | 通过 | 领料存放、中转袋入仓、装袋确认、最终交出、特殊工艺交出/回仓均有稳定幂等身份。 |
| 二维码异常 | 通过 | 不存在、歧义、停用、未编排、非当前工厂和已占用分别阻断；袋码不作为物理库位。 |

### 文案、UI、性能与适配审查

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 中文业务文案 | 通过 | 页面不显示英文状态码；错误提示说明具体对象和下一步。 |
| 状态可辨识 | 通过 | 文字、边框、颜色和选中勾选共同表达，不只依赖颜色。 |
| 触控与键盘 | 通过 | 库位按钮至少 44×44 像素；原生按钮支持 Enter/Space。 |
| 局部刷新 | 通过 | 库位点击、编排和弹窗内选位只替换工具条、库位图根或弹窗地图，不重绘整页。 |
| 响应时间 | 通过 | Playwright 对编排入口实测小于 200ms；局部操作不丢失所在页面和工作台。 |
| Web 分辨率 | 通过 | 1366×768、1280×720、1024×768 均无页面级横向溢出。 |
| PDA 小屏 | 通过 | 390×844 下库位图、字段和主动作无横向溢出。 |
| 已知性能观察 | 非阻断观察 | 本仓库生产构建的全局 `app-shell` 体积较大，冷启动在当前验收环境明显偏慢；本任务未扩展到全局代码拆分，局部按钮响应仍满足门槛。 |

## 4. 主要问题与处理

| 问题 | 性质 | 修正 |
| --- | --- | --- |
| “库位组”仍出现在旧审查结论 | 文档错误 | 全部统一为“库区”，并在专项检查禁止“库位组”。 |
| PFOS 待交出仓顶部入仓按钮被旧文本弹窗处理器抢先接管 | 真实代码接线遗漏 | 调整处理器顺序，并让真实页面处理器同时承接 `data-wait-handover-web-action`。 |
| PDA 浏览器验收使用不存在的 `TASK-MAP` | 假验收 | 从当前裁床任务源取得真实 `taskId` 后进入中转袋入仓深链。 |
| PDA 连续多选测试误选只有一个空闲格的货架 | 测试数据假设错误 | 先寻找同一货架的两个连续空闲格，再按稳定 ID 点击。 |
| 旧特殊工艺检查仍要求“发料页/发料状态” | 检查契约滞后 | 按当前“特殊工艺交出/回仓”业务文案和页面结构更新，不恢复废弃模型。 |
| 特殊工艺部分交出曾释放整袋、部分回仓覆盖原剩余 | 生命周期遗漏 | 按实交量扣减，部分回仓与原剩余合并，并补专项回归。 |
| 标准列表真实 Chromium 检查的页面刷新仍使用 30 秒默认导航超时 | 验收脚本不稳定 | 与既有 120 秒冷启动门槛统一，保留全部真实列拖拽和 DOM 稳定性断言。 |

## 5. 变更覆盖与验证

### 受管文件

- `src/components/ui/warehouse-location-map.ts`
- `src/pages/process-factory/cutting/warehouse-location-layout-store.ts`
- `src/pages/process-factory/cutting/warehouse-location-map-model.ts`
- `src/pages/process-factory/cutting/warehouse-location-map.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/pda-cutting-inbound.ts`
- `src/pages/pda-cutting-handover.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/data/fcs/cutting/pickup-node-domain.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `scripts/check-cutting-warehouse-location-map.ts`
- `scripts/check-standard-list-page-template.ts`
- `scripts/check-pda-cutting-inbound-workflow.ts`
- `scripts/check-special-craft-pda-warehouse-actions.ts`
- `scripts/check-cutting-special-craft-dispatch-return.ts`
- `tests/cutting-warehouse-location-map.spec.ts`
- `package.json`
- `playwright.config.ts`

### 页面路由

- `/fcs/craft/cutting/warehouse-management/wait-process?tab=locations`
- `/fcs/craft/cutting/warehouse-management/wait-handover?tab=locations`
- `/fcs/pda/warehouse/wait-process?scope=cutting&view=pickup`
- `/fcs/pda/cutting/inbound/:taskId?action=inbound-location`
- `/fcs/pda/cutting/handover/:taskId?action=special-craft-return`

### 验证说明

专项检查覆盖稳定编排、历史迁移、连续选择、多库位数量、剩余范围、待交出完整袋生命周期、幂等和真实处理器顺序。直接回归覆盖待加工仓、待交出仓、中转袋、特殊工艺和 PDA 既有链路。浏览器验收覆盖两张 PFOS 图、Web 入仓单选图、PDA 连续多选、PDA 中转袋入仓及四档分辨率。

最终命令结果、CodeGraph 状态和任务收据记录在实施审计文档中，以最后一次完整验证结果为准。

### 验证命令

- `npm run check:cutting-warehouse-location-map`：通过
- `npm run check:cutting-warehouse-location-map-e2e`：通过（8/8）
- `npm run check:list-page-governance`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run build`：通过

### 例外

- 编排快照使用浏览器本地存储，不接真实后端、权限、审批或数据库并发锁；这是原型仓库边界，不改变稳定 ID、版本校验、占用来源和现场防错。
- 角色权限为页面演示规则，不构建真实鉴权体系。
- 全局应用冷启动体积不在本任务改造范围；已保留为非阻断性能观察，库位图局部交互门槛仍按 200ms 验收。

## 6. 最终结论

结论：通过

说明：设计、实现、逐项审计、专项、13 项直接回归、8 项库位图浏览器验收、生产总览两档分辨率浏览器复核、治理和构建均已通过。经用户授权，发布基线中的生产总览固定撑宽、面料图片、菲票普通场景、首次交出数量及特殊工艺成衣 BOM 追溯缺口均已从源头修复；最终以最后一次 CodeGraph 同步和机器收据为准。
