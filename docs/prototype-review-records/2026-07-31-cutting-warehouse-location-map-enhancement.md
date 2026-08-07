# 裁床仓库层级库位图增强审查记录

## 变更对象与关系

- PFOS 裁床主管／文员通过单一“维护库位图”入口管理库区、货架和库位。
- PDA 裁床仓管员消费同一仓库主数据和运行事实，只执行扫码、自由选位、取消、清空和确认。
- `WAIT_PROCESS` 存放物料卷／余料；`WAIT_HANDOVER` 存放中转袋／菲票。两个仓库的布局、占用、数量和释放严格隔离。
- `warehouseLocations` 是新入仓／回仓动作唯一的完整位置数组；每项同时保存稳定库位引用和提交时完整编号快照。

## 结构、状态与流程

1. 查看模式显示空闲／占用、生产单摘要和占用详情，只提供一个维护入口。
2. 维护模式可新增库区、新增货架，并按层数和每层位置数生成库位；完整编号预览按 L 降序、P 升序。
3. 冲突、占用保护、资源不足或取消生成均保留表单输入；取消前未持久化时不增加版本和历史。
4. Web／PDA 选位允许跨库区、跨货架、跨层自由组合；扫码追加遵守当前工厂、仓库和三层启停状态。
5. 确认前以最新投影原子复核完整数组，任一冲突整条事实不写入。
6. 多格占用不拆业务库存；摘要按 footprint 对袋、票、卷和数量去重。
7. 整袋交出、加工接收和特殊工艺闭环按对象使用周期释放全部格。

## Mock 与兼容边界

- 当前 Mock 和浏览器布局直接写入现行层级结构，不迁移旧布局或旧 Mock，不保留旧布局别名。
- 新 Web／PDA 事件只写 `warehouseLocations`。历史 `locationRef`／`locationRefs` 仅供运行事实读取兼容，不属于布局迁移。
- 本地存储不可写时进入只读并隐藏维护动作；不伪造保存成功。

## 浏览器验收矩阵

| 场景 | 结论 | 关键断言 |
| --- | --- | --- |
| 1366×768 结构顺序 | 通过 | L 降序、P 升序、完整库位编码。 |
| WAIT_PROCESS 多选冲突 | 通过 | 跨区／架／层三位置；最新占用导致整组失败、冲突编号可见、无部分事件。 |
| WAIT_HANDOVER 生命周期 | 通过 | 1366×768 下以生产事件账历史夹具表达当前无 UI 的分拣确认；有 `sourceUsageCycleId` 时只迁移声明周期与精确菲票集合，缺字段才回退确认前最新严格集合；真实 L1／L2 场景确认 C1 后保持 C2，目标快照、占用和页面候选一致。页面最终整袋交出走真实生产 handler。 |
| PDA 浏览器实证 | 通过 | 真实 render／handler 覆盖跨区／架／层自由多选、取消、清空、特殊工艺缺失扫码和多批次接收选择。 |
| PDA 专业检查 | 通过 | 专业脚本覆盖正常扫码以及缺失／停用／占用／跨仓中文阻断和数组不变；不表述为浏览器逐项覆盖。 |
| PDA 特殊工艺 | 通过 | 真实 render／handler 支持多位置回仓与异常扫码。 |
| PDA 多批次接收 | 通过 | 真实“本次接收批次”控件默认空；未选阻断；选择后只绑定所选批次。 |
| 1280×720 宽货架 | 通过 | 页面无横溢，货架内部横滚，维护和主要动作可用。 |
| 选位性能与滚动 | 通过 | 正式套件断言首次 DOM 反馈低于 200ms；页面壳身份和非零滚动保持，地图根局部替换，连续选位后用户主动滚动不被延迟回调覆盖。 |

## 当前交付结论

- 规格要求的业务状态、角色边界、Mock 边界、Web／PDA 流程和性能口径一致。
- 正式浏览器命令使用独立开发服务器和 `workers=1`；最后一次完整复跑为 19/19 通过、退出码 0、总用时 16.7 分钟。
- 依赖审计要求为 0 个已知漏洞；完整 E2E、所有专项、治理、构建和 CodeGraph 均以本次最终复跑结果收口。
- 无产品设计例外。分拣确认明确属于生产事件账历史夹具，不表述为当前 Task 9 UI 操作；页面候选与最终交出使用真实生产 render／handler。
- 原型边界：不实现真实后端、跨设备锁和正式权限系统。

## 任务 10 全量审计补充

- PDA 接收差异的数量、备注与现场照片均改为局部输入和局部反馈，文件控件不会因相邻输入的异步页面重绘而脱离 DOM；选择照片后立即显示文件名，提交仍写入同一差异事实。
- 生产单总览状态入口以裁床进度投影中是否存在真实详情行为准：存在裁床执行事实时进入对应行的 8 页签事实详情；不存在裁床执行事实时回到生产单台账，不伪造裁床事实，也不进入“未找到详情”空态。
- 生产单款式图片只展示非占位的真实 Mock 图片候选；无有效候选时使用仓库已有样衣图兜底，并保留加载失败回退。
- 上述调整没有增加管理端字段、PDA 操作层级、英文状态或说明性文案；PDA 仍以当前任务、差异输入和确认提交为主动作。

## 受管文件

- `src/components/ui/warehouse-location-map.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/warehouse-location-mock.ts`
- `src/data/fcs/factory-internal-warehouse.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/process-factory/cutting/warehouse-location-layout-store.ts`
- `src/pages/process-factory/cutting/warehouse-location-map-model.ts`
- `src/pages/process-factory/cutting/warehouse-location-map.ts`
- `src/pages/pda-cutting-inbound.ts`
- `src/pages/pda-cutting-handover.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/process-factory/cutting/production-order-overview-projection.ts`
- `src/pages/process-factory/cutting/production-order-overview-view.ts`
