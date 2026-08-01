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
| 主要任务 | 查看空闲/占用、查看占用对象、编排库区/货架/库位、自由多选存放位置、中转袋与特殊工艺回仓单选入仓 |

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
| 空间关系 | 通过 | 库区按卡片排列，货架纵向排列；货架内按层号降序组成矩阵，层内位置升序；仅货架内部允许横向滚动。 |
| 信息负荷 | 通过 | 格内只显示编号、状态及生产单/物料或袋摘要；完整字段进入占用详情。 |
| 列表治理 | 通过 | 库位图是空间分组视图，不声明标准列表页；占用详情和未定位清单按 10 条分页。 |

### 业务规则与防错审查

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 稳定身份 | 通过 | 顺序和占用关联稳定 ID；库区、货架、库位编号/名称可改，但不改变身份和物理层级位置。 |
| 编排隔离 | 通过 | 编排按 `factoryId + warehouseKind` 隔离，有版本校验、损坏回退、变更记录和新节点提示。 |
| 历史迁移 | 通过 | 依次按稳定 ID、完整当前路径、唯一当前编号、历史改号匹配；结果区分已匹配、待确认、无法匹配。 |
| 自由多选 | 通过 | 待加工仓允许跨库区、货架和层按点击顺序选择任意空闲库位，不限制固定数量；仍严格阻断错仓、停用、占用和未知库位。 |
| 选位交互 | 通过 | 任意已选项都可直接取消并保留其他选择；提交前按最新投影逐项剔除冲突，完整列出全部冲突库位编号。 |
| 多库位数量 | 通过 | 一批物料只保存一次总量和一个 `storageFootprint`，多个格只引用同一范围，不重复累计。 |
| 部分领出 | 通过 | 有余量时默认保留原库位；“调整剩余存放库位”只写位置调整事实；余量为零释放全部库位。 |
| 待交出生命周期 | 通过 | 装袋不占位、入仓才占位、换袋继承位置不双算、最终交出释放、特殊工艺部分交出按量扣减、回仓在新位置恢复。 |
| 并发重校验 | 通过 | 确认前读取最新投影；一次列出全部冲突库位，并仅保留仍有效的自由选择；不部分写入。 |
| 写入顺序 | 通过 | 共享运行时事件先成功，本地 PDA 状态后更新；失败保留袋码、菲票和库位选择。 |
| 幂等 | 通过 | 领料存放、中转袋入仓、装袋确认、最终交出、特殊工艺交出/回仓均有稳定幂等身份。 |
| 二维码异常 | 通过 | 不存在、歧义、停用、非当前工厂和已占用分别阻断；袋码不作为物理库位。 |

### 文案、UI、性能与适配审查

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 中文业务文案 | 通过 | 页面不显示英文状态码；错误提示说明具体对象和下一步。 |
| 状态可辨识 | 通过 | 文字、边框、颜色和选中勾选共同表达，不只依赖颜色。 |
| 触控与键盘 | 通过 | 库位按钮至少 44×44 像素；原生按钮支持 Enter/Space。 |
| 局部刷新 | 通过 | 库位点击、编排和弹窗内选位只替换工具条、库位图根或弹窗地图，不重绘整页。 |
| 响应时间 | 待任务 9 验收 | 更新后的 Playwright 已启动定向场景，但近 3 分钟未跑到页面断言；当前不能声明满足小于 200ms，留待任务 9 完成浏览器实测。 |
| Web 分辨率 | 通过 | 1366×768、1280×720、1024×768 均无页面级横向溢出。 |
| PDA 小屏 | 通过 | 390×844 下库位图、字段和主动作无横向溢出。 |
| 已知性能观察 | 待验收 | 本仓库生产构建的全局 `app-shell` 体积较大，冷启动在当前验收环境明显偏慢；本任务未扩展到全局代码拆分，局部按钮响应是否满足门槛由任务 9 实测确认。 |

## 4. 主要问题与处理

| 问题 | 性质 | 修正 |
| --- | --- | --- |
| “库位组”仍出现在旧审查结论 | 文档错误 | 全部统一为“库区”，并在专项检查禁止“库位组”。 |
| PFOS 待交出仓顶部入仓按钮被旧文本弹窗处理器抢先接管 | 真实代码接线遗漏 | 调整处理器顺序，并让真实页面处理器同时承接 `data-wait-handover-web-action`。 |
| PDA 浏览器验收使用不存在的 `TASK-MAP` | 假验收 | 从当前裁床任务源取得真实 `taskId` 后进入中转袋入仓深链。 |
| PDA 自由多选测试只覆盖单一货架 | 测试覆盖不足 | 补充跨库区、跨货架、跨层选择、任意取消和无固定上限的稳定 ID 断言。 |
| 旧特殊工艺检查仍要求“发料页/发料状态” | 检查契约滞后 | 按当前“特殊工艺交出/回仓”业务文案和页面结构更新，不恢复废弃模型。 |
| 特殊工艺部分交出曾释放整袋、部分回仓覆盖原剩余 | 生命周期遗漏 | 按实交量扣减，部分回仓与原剩余合并，并补专项回归。 |
| 标准列表真实 Chromium 检查的页面刷新仍使用 30 秒默认导航超时 | 验收脚本不稳定 | 与既有 120 秒冷启动门槛统一，保留全部真实列拖拽和 DOM 稳定性断言。 |

## 5. 变更覆盖与验证

### 受管文件

- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/cutting/warehouse-location-mock.ts`
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

专项检查覆盖稳定编排、历史迁移、自由跨区/货架/层多选、任意取消、无固定上限、多库位数量、剩余位置、待交出完整袋生命周期、幂等和真实处理器顺序。直接回归覆盖待加工仓、待交出仓、中转袋、特殊工艺和 PDA 既有链路。浏览器验收覆盖两张 PFOS 图、Web 入仓单选图、PDA 自由多选、PDA 中转袋入仓及四档分辨率。

最终命令结果、CodeGraph 状态和任务收据记录在实施审计文档中，以最后一次完整验证结果为准。

### 验证命令

- `npm run check:cutting-warehouse-location-map`：通过
- 定向选择场景：任务 5 更新为跨库区、货架、层自由多选、任意取消和逐项完整编号摘要。Playwright 已按新标题筛选到 1 项并启动 preview，但近 3 分钟仍未跑到页面断言，按当前任务边界终止；该结果不得记为通过或断言失败，浏览器链路由任务 9 继续调试和验收。
- `npm run check:cutting-warehouse-location-map-e2e`：失败（当前共发现 12 项；旧维护场景因任务 6 尚未接入正式层级维护入口而未闭环，当前不得声明全量通过）。
- `npm run check:list-page-governance`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run build`：通过

### 例外

- 编排快照使用浏览器本地存储，不接真实后端、权限、审批或数据库并发锁；这是原型仓库边界，不改变稳定 ID、版本校验、占用来源和现场防错。
- 角色权限为页面演示规则，不构建真实鉴权体系。
- 全局应用冷启动体积不在本任务改造范围；库位图局部交互小于 200ms 的门槛尚未取得更新后 Playwright 断言证据，由任务 9 继续验收。

## 6. 最终结论

结论：不通过

说明：任务 5 的共享分层矩阵、自由选位、直接回归、生产构建和原型治理已经验证；但本记录覆盖的库位图全量验收尚未通过。当前 E2E 共发现 12 项，旧维护场景依赖任务 6 的正式层级维护入口，尚未闭环；任务 9 负责完整浏览器验收与最终结论。

## 7. 2026-08-01 层级库位编号与 Mock 补充审查

### 本次范围

- 在共享工厂内部仓模型中兼容增加库区代码、货架序号、层号和层内位置号；“层”仍由库位字段分组，不新增独立主数据层级。
- 中央裁床待加工仓、待交出仓改用相互隔离的 A/B 库区、多个货架和逐层位置数量 Mock；其他工厂继续使用原通用仓库结构。
- 完整库位编号由系统按 `A-R02-L03-P02` 生成；库区仅允许 A 到 Z 单个大写字母，序号仅允许 1 到 99。
- 本次不改页面、路由、PDA、交互和占用投影；现有页面继续消费共享仓库结构，具体占用写回由后续任务接入。

### 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色与页面模式 | 通过 | 本次只补共享结构和演示数据，不改变管理端、主管端、员工执行端现有页面模式。 |
| 仓储识别与防错 | 通过 | 编号统一生成，阻断非法库区代码、越界序号和重复完整编号；稳定 ID 按待加工仓、待交出仓隔离。 |
| 信息负荷与文案 | 通过 | 没有新增页面说明或内部状态码；层级字段只作为结构事实供后续地图分组。 |
| 扫码、数量与异常 | 有条件通过 | 新 Mock 提供可稳定引用的库位 ID；扫码选择、占用对象和异常兜底未在本任务改动，保留给后续页面/投影任务。 |
| UI、组件与性能 | 不适用 | 本次未改 UI、组件和交互，不引入页面重渲染。 |
| 现场设备可用性 | 不适用 | 本次未改 PDA 或低分辨率页面。 |

### 受管文件与验证

- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/cutting/warehouse-location-mock.ts`
- `npm run check:factory-internal-warehouse-model`：通过。
- `npm run check:cutting-warehouse-location-map`：通过。
- `npm run check:prototype-design-governance -- --all`：通过。
- `npm run build`：通过。

### 例外与后续接入

- 本次没有页面设计例外。
- 占用记录尚未改写为新库位 ID；待后续任务在 `src/pages/process-factory/cutting/warehouse-location-map.ts` 的待加工仓、待交出仓占用投影，以及 PDA/Web 选位写入入口接入，不能把本次结构 Mock 表述为已完成占用写回。

## 8. 2026-08-01 v3 完整布局快照与维护动作审查

### 本次范围

- 本地布局事实改为 v3 完整不可变快照，直接保存当前库区、货架、库位树；删除顺序补丁、未编排、标签覆盖和新增节点覆盖模型。
- 新建库区只建立空库区；新建货架按逐层位置数量一次生成全部库位。库区代码、货架序号、层号和层内位置号统一校验，完整编号由系统重算，稳定库位 ID 不随编号变化。
- 占用库位只允许修改备注；减少、停用、撤销、上级改号和结构调整均阻断并展示冲突完整编号。
- 非 v3 本地缓存直接失效，静默使用当前 Mock 默认布局建立 v3；布局版本冲突和历史版本继续保留。

### 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色与页面模式 | 通过 | 本次重写管理维护领域动作，不改变主管端、现场执行端现有导航和任务入口。 |
| 仓储识别与防错 | 通过 | 结构字段均有 1 到 99 边界和唯一性校验；冲突错误列出完整库位编号，避免主管误改占用位置。 |
| 文案与状态 | 通过 | 错误均使用可展示中文；页面不展示 schemaVersion、英文状态码或迁移提示。 |
| 追溯与并发 | 通过 | 每个成功维护动作形成下一不可变版本，保存仍校验期望版本，并保留前后快照历史。 |
| PDA 兼容 | 有条件通过 | PDA 删除已废弃的“未编排”读取，仍从 v3 完整树解析稳定库位；本任务不改扫码、多选和业务写回。 |
| UI、组件与性能 | 有条件通过 | 旧地图维护入口仅通过完整 `areaList` 薄适配保持运行，不恢复 v2 补丁字段；正式分层维护弹窗由任务 6 替换。 |

### 受管文件与验证

- `src/pages/process-factory/cutting/warehouse-location-layout-store.ts`
- `src/pages/process-factory/cutting/warehouse-location-map.ts`
- `src/pages/process-factory/cutting/warehouse-location-map-model.ts`
- `src/pages/pda-cutting-inbound.ts`
- `scripts/check-cutting-warehouse-location-map.ts`
- `npm run check:cutting-warehouse-location-map`：通过。
- `npm run build`：通过。
- `npm run check:prototype-design-governance -- --all`：通过。

### 例外与后续接入

- 当前原型不迁移 v1/v2 localStorage，不连接真实后端、权限或数据库锁；旧缓存静默失效是本次明确边界。
- 旧“新增库区 / 新增库位、移动、改名”入口暂时使用 v3 完整快照薄适配，不恢复 patch/override 模型；任务 6 将用 `createWarehouseArea`、`createWarehouseShelf` 等正式领域动作替换旧入口并完成分层维护 UI。
- 本阶段不改变 PDA/Web 占用写回；分层展示与自由选位由后续共享组件任务完成。

### 规格审查修正

- 占用保护收紧为“除备注外均不可修改”：库区名称、代码、启停状态，以及货架名称、序号、启停状态，只要任一后代库位占用就阻断，并列出全部冲突完整编号。
- 新建库区、货架、库位在节点内部保存实际 `layoutCreatedInVersion`；撤销同时核对节点元数据和调用版本。基线既有节点没有该元数据，即使调用方伪报版本也不能硬删除；元数据随 v3 JSON 快照持久化。
- 撤销有引用或占用的节点时，错误逐项列出涉及的完整库位编号，不再只报数量。
- 正式层级维护弹窗上线前，旧库区、货架、库位改号/改名入口统一停止自由输入和直接替换，提示编号由系统生成并进入后续层级维护。
- 首次加载先持久化真实 v3 基线；保存找不到已加载基线时明确拒绝。历史 `beforeSnapshot` 只取已保存当前版本，禁止用变更后快照降版本伪造。
- 占用库区或货架仅更新备注时保持纯净：除目标 `remark` 外，合法 v3 中已有的货架名称、库位名称和其他深层事实均不重写；只有实际结构字段或需派生编号字段发生变化才重算。
- 占用库位仅更新备注时保持纯净：除目标 `remark` 外，同架货架名称、目标与同架其他库位名称以及整个库区其他深层事实均不重写；只有层号或层内位置号实际变化才重算。
- 占用库位的启停保护双向一致：只要目标状态与当前状态不同，无论启用或停用均阻断并列出完整库位编号；相同状态直接返回原快照，不生成无意义版本事实。
- v3 快照不存在“未分配库位”事实，已删除跨货架分配函数、地图事件和交互入口，不在本任务扩展复杂移库。
- 地图编排只能通过库区、货架、库位三个窄排序 API 提交完整 ID 顺序；删除节点、修改结构字段或注入创建元数据均阻断。
- 创建元数据必须为 `1..layoutVersion` 的整数；加载时对照当前仓库默认基线，既有节点不得伪造创建版本，新节点不得缺少创建版本。
- 本地存储不可读、不可写或不可清理时，页面继续展示默认布局，明确提示“当前仅可查看，无法保存”并隐藏维护入口，保存仍返回明确失败。
- 浏览器访问 `localStorage` 本身抛出安全异常时，使用明确不可用的存储适配器，页面回落只读提示，不伪装为内存可持久化。
- 即使已命中合法 v3 缓存，加载也要使用原 key 和原 raw 原样写回一次以探测可写性；写回失败时不改变任何布局事实，页面自动进入只读提示。
- 所有公共不可变更新统一比较规范化业务事实；库区、货架、库位、层内数量和排序同值时直接返回原快照，不增版本、不写历史。

## 9. 2026-08-01 分层投影与自由多选审查

### 本次范围

- 稳定库位引用补齐当前 v3 快照中的仓库、库区代码、货架序号、层号和层内位置号，不从完整编号字符串反解析。
- 库区代码、货架序号、层号、层内位置号缺失或超出合法范围时立即阻断，并在中文错误中指出具体库区、货架或库位 ID，不再用空字符串或 0 掩盖坏事实。
- 货架事实按 `levels` 分组：层号降序、层内位置号升序；待加工仓与待交出仓继续按仓库 ID 和仓库类型隔离。
- `levels` 和层内 `locations` 均为运行时冻结的只读数组；货架不再暴露 flat `locations` 字段，需要展平时统一调用公开只读 helper，不保存第二套可分叉数组。
- 选位改为跨库区、货架、层的自由多选，按点击顺序追加，任意顺序取消，不设置数量上限。
- 提交前重新读取当前投影，逐项剔除未知、停用、占用和错仓库位，一次返回全部冲突完整编号；仍可用项保持原点击顺序。
- 业务状态仍只有空闲、占用；节点启停只控制能否选择。一个业务对象占多个库位格时，详情和汇总继续按稳定占用对象 ID 去重数量。

### 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色与页面模式 | 通过 | 本次只调整共享投影和选位领域规则，不改变 PFOS 管理查看端或 PDA 现场端既有任务入口。 |
| 仓储识别与防错 | 通过 | 自由多选不附加物理位置限制；错仓、停用、占用和未知库位仍阻断，重校验反馈列出全部冲突。 |
| 层级事实完整性 | 通过 | 非 A-Z 库区代码及非 1 到 99 整数的货架序号、层号、层内位置号按节点 ID 快速失败。 |
| 数量与状态 | 通过 | 摘要 DOM 直接验证一个对象占三个库位仍为 1 卷、100 yard，不出现 3 卷或 300 yard；启停不扩展为空闲/占用之外的业务状态。 |
| 只读单事实 | 通过 | `levels` 是唯一分层事实；统一 helper 只从 `levels` 派生冻结数组，不能 push、splice 或整体替换。 |
| 文案 | 通过 | 删除已失效的位置限制和端点取消提示；冲突反馈使用完整中文库位编号。 |
| UI、组件与性能 | 通过 | 共享组件按层矩阵渲染，每格首行显示层内位置与中文状态、次行固定显示完整编号；横向滚动限定在货架内部。 |
| 异常与追溯 | 通过 | 未知 ID 在冲突反馈中保留原 ID，已知冲突显示完整库位编号；稳定引用保留完整结构事实。 |

### 受管文件与验证

- `src/pages/process-factory/cutting/warehouse-location-map-model.ts`
- `src/components/ui/warehouse-location-map.ts`
- `src/pages/process-factory/cutting/warehouse-location-map.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/pda-cutting-inbound.ts`
- `scripts/check-cutting-warehouse-location-map.ts`
- `npm run check:cutting-warehouse-location-map`：通过。
- `npm run build`：通过。
- `npm run check:prototype-design-governance -- --all`：通过。

### 例外与后续接入

- 共享组件、PFOS 库位图、warehouse-hub、PDA 待加工仓和 PDA 入仓的读取已迁移到统一 helper；共享组件不再提供数量限制参数。
- 本任务不改 PFOS 层级维护弹窗，不改 Web/PDA 状态数组、事件载荷和占用写回；这些仍按后续任务 6、7、8 的边界处理。
- 待交出仓和 PDA 入仓仍保持既有单选业务状态；本次仅删除共享组件数量限制参数，不提前扩写多库位写回。
