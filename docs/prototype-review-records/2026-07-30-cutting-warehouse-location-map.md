# 裁床仓库层级库位图原型审查记录

## 审查范围

- 页面：PFOS 裁床待加工仓、待交出仓库位图，以及对应 PDA 入仓、回仓、接收执行页。
- 角色：PFOS 裁床主管／文员维护结构并查看占用；PDA 裁床仓管员只扫码、选位、取消、清空和确认。
- 仓库边界：`WAIT_PROCESS` 与 `WAIT_HANDOVER` 分别保存布局、投影占用和释放事实，不共享库存身份。

## 当前业务结论

- 结构固定为“仓库 → 库区 → 货架 → 库位”。库位完整编号按 `库区-R货架-L层-P层内位置` 生成；层按降序展示，层内位置按升序展示。
- 普通查看模式只有“维护库位图”一个管理入口。进入维护模式后，新增库区和新增货架动作就近展示；没有查看模式直接新增库区／库位入口。
- 库位业务状态仅为“空闲／占用”。库区、货架、库位停用是仓库主数据可用性，不是第三种库存状态。
- 入仓允许跨库区、跨货架、跨层自由多选，可任意取消、清空或扫码追加，不要求相邻、连续，也没有固定数量上限。
- 确认前必须用最新投影整组复核。任一位置不存在、跨仓、停用或已占用时，整次失败并列出完整编号，不写入部分成功事实。
- 同一物料批次或中转袋占多个格时，每格都显示占用；生产单摘要按稳定 footprint 去重，袋、菲票、卷数和数量只汇总一次。
- 中转袋整袋交出、特殊工艺整袋交出、加工接收或数量归零时，一次释放该对象当前完整 footprint。
- 当前 Mock 与本地布局直接采用层级结构和 `warehouseLocations` 完整数组，不迁移旧布局／旧 Mock，不保留旧布局别名。历史单库位运行事件只作事实读取兼容，不由新动作双写。

## 现场端与性能自查

| 检查项 | 结论 | 证据 |
| --- | --- | --- |
| Web 角色边界 | 通过 | 查看模式单一维护入口；维护动作不出现在 PDA。 |
| PDA 动作优先 | 通过 | 首屏突出扫码、选位、已选摘要和唯一确认动作。 |
| 多选与原子防错 | 通过 | WAIT_PROCESS、WAIT_HANDOVER、PDA 入仓和特殊工艺均使用完整选择数组及最新投影复核。 |
| 状态与数量 | 通过 | 空闲／占用与主数据启停分离；多格数量按 footprint 一次汇总。 |
| 局部响应 | 通过 | 维护入口、预览、保存首次反馈、占用抽屉和首次选位 DOM 反馈均断言小于 200ms。 |
| 局部刷新与滚动 | 通过 | 首次选位保留页面壳身份和非零页面滚动位置；只替换地图根；连续选位后用户主动滚动不被延迟回调拉回。 |
| 分辨率 | 通过 | 1366×768、1280×720、1024×768、390×844 无页面级横向溢出；宽货架在内部横向滚动。 |
| 中文化 | 通过 | 页面不展示英文状态码、稳定 ID、投影或迁移提示。 |

## 浏览器验收覆盖

- 1366×768 的真实 WAIT_PROCESS 页面在同一场景硬断言层 `L` 降序、位置 `P` 升序、完整编码、占用抽屉、维护新增库区／货架和无页面级横向溢出。
- WAIT_PROCESS 真实 `warehouseAction=claim` 页面与生产 handler 完成跨区／架／层三选；并发追加真实占用后确认整组阻断，提示冲突完整编号，事件账只增加并发事实、不增加提交事实。
- 1366×768 的 WAIT_HANDOVER 验收以生产事件账写入“生产分配／分拣确认”历史夹具（当前 Task 9 页面没有该确认 UI），页面候选和最终整袋交出均走真实生产 render／handler；严格选择声明的源使用周期与精确菲票集合，缺少源周期字段时才回退确认前最新严格集合。验收先完成三格迁移与释放，再以真实 L1／L2 验证同袋同票 C1／C2：显式确认 C1 后仅 TARGET／TC 占用 L1，SOURCE／C2 保持 L2，目标快照、页面占用和交出候选一致。
- PDA 浏览器实证：真实生产 render／handler 覆盖跨库区、货架、层自由多选、任意取消与清空；特殊工艺回仓缺失扫码中文阻断；多候选“本次接收批次”默认不预选、未选阻断、选择后进入真实接收草稿。
- 1280×720：宽货架页面无横向溢出、货架容器可横向滚动、维护入口可见可用。

## 专业检查证据

- `check:pda-cutting-inbound-workflow` 覆盖 PDA 正常扫码、缺失／停用／占用／跨仓阻断与选择数组不被异常扫码污染；这些属于专业脚本证据，不表述为浏览器逐项覆盖。
- `check:cutting-special-craft-dispatch-return` 覆盖特殊工艺交出／回仓业务事实与数量边界。
- `check:pda-cutting-transfer-bag-handover`、`check:cutting-wait-handover-transfer-bag-flow` 和 `check:web-cutting-transfer-bag-actions` 覆盖整袋交出、事件事实与 Web／PDA 共用边界。

## 治理与例外

- 依赖固定审计要求：0 个已知漏洞。
- 正式浏览器命令使用独立开发服务器和 `workers=1`；最后一次完整复跑为 19/19 通过、退出码 0、总用时 16.7 分钟。
- 必跑：完整 E2E、库位图专项、PDA 入仓／交出／特殊工艺专项、Web 流转专项、原型治理、列表治理、生产构建、CodeGraph 同步。
- 产品设计例外：无。浏览器验收中的分拣确认是生产事件账历史夹具，不冒充 UI 操作；最终交出使用真实页面 handler。原型仍不模拟真实后端、跨设备数据库锁或正式角色鉴权。

## 9. 2026-08-01 分层投影与自由多选审查

- 当前分层投影按 L 降序、P 升序展示完整编号。
- 入仓可跨库区、货架、层自由多选，支持任意顺序取消，不设置数量上限；确认时以最新投影整组复核。

## 2. 规范依据

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 结论 | 说明 |
| --- | --- |
| 通过 | 角色、端类型、协作、页面模式、中文文案、状态、数量、防错、异常、局部响应和双分辨率要求均已覆盖。 |

## 6. 最终结论

结论：通过。当前实现与 2026-08-01 已确认业务规则一致。

### 受管文件

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

### 验证命令

- `npm run check:cutting-warehouse-location-map-e2e`：通过，19/19、退出码 0、总用时 16.7 分钟；覆盖 WAIT_PROCESS，以及 1366×768 下由生产事件账历史确认夹具进入候选、再由真实最终交出 handler 收口的 WAIT_HANDOVER 场景。
- `npm audit --audit-level=low`：通过，0 个已知漏洞。
- `npm run check:prototype-design-governance -- --all`：通过。
- `npm run check:list-page-governance`：通过。
- `npm run check:cutting-warehouse-location-map`：通过。

### 例外

- 无
