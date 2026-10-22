# 辅料仓流程 Mock 补齐审查记录

依据 `AGENTS.md` SCOPE-02、UI-02、STORE-01～05、PERF-01、EVIDENCE-01；完整产品审查模式。需求、计划、原子矩阵见 docs/product-design/2026-10-22-accessory-workflow-mock.md。

## 基本信息

- 日期：2026-10-22
- 任务 / 需求编号：AM-01～AM-15
- 验证人：Codex 主代理；本轮未调用子代理
- 基准：main 1b0b1697c43c52dd3bcd21826aad2ff9a10fc2f2；当前分支 codex/accessory-workflow-mock-20261022

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：新增关联静态业务记录、原记录读取叠加、覆盖/删除标记及备份来源；原任务采用固定分配；两处归属判断收窄读取范围。页面布局、菜单、真实权限、业务动作校验、数量公式及原子保存不改。没有新增演示角色、模式、导入种子或本机资料维护入口。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 来源与范围 | 通过 | 原 F01/F02/F03 保留；新 H/M 各6及C01/C02，14单、100件/单、两SKU、六辅料；真实主线生产单/技术包/任务身份。unit-mock.log、unit-accessory.log；不扩成全站无关工艺 Mock 项目 |
| 实物与数量守恒 | 通过 | 237条固定记录：14配料、19调拨、18收货、136库存、6领料、6上下文、6凭证、4实交、4结果、24审计；库存来源事件与固定盘点余额重算一致；四类留车缝，后道只有拉链/纽扣 |
| 收货/领料及必要守卫 | 通过 | browser-accepted.log：真实页面少收阻断、整单上架、超领阻断、续领、模拟Quota失败保留输入，成功后刷新回读；源/任务/PPIC/凭证和库存守卫仍走原动作 |
| 普通读取与用户记录 | 通过 | 新浏览器访问不复制静态记录到库；只保存被操作记录；覆盖零余额、删除及同源新页不复活。原记录专项8例和新增4例顺序执行全部通过，见 browser-accepted.log；原同时启动服务端口冲突为采集无效，保留原日志 |
| 备份与恢复 | 通过 | 既有外部工具显式导出静态来源+覆盖+删除标记，空隔离浏览器恢复；无维护入口。新增Mock不含用户Blob，附件处理原契约/拥有代码不变，不宣称新增附件能力 |
| 桌面布局与图片 | 通过 | 1366×768、1280×720、1024×768，16入口共48次真实页面/图片核对，主体无横向溢出；pages.json、具名PNG及browser-accepted.log。未改布局/图片控件 |
| 性能 | 通过 | 初次后道冷1132.3/刷新1049.2ms；车缝冷1224.6/刷新1098.9ms，原值保留在 performance-initial、performance-r3-partial。后道正式ID先匹配，未知ID不重复计算正式单号；车缝归属复用既有单生产单投影，实际动作仍完整核对。固定构建五轮53家族、265有效样本全部<=1000ms，最大957.5ms；performance/results.json，原始失败和采集错误保留 |
| 代码、测试与兼容 | 通过 | 主代理核对完整diff；新增业务只读静态基线经既有纯计算重放，不调用保存/实际派单。范围内TS零错误、最终113专项、此前1430完整单测已通过；两处读取优化后，类型与页面、正常/边界及身份契约已定向复核。58条影响路由专项通过，未为未知脚本设置豁免 |
| 打印与PDA | 不适用 | 未改模板、二维码、PDA角色或设备；固定凭证字段与原任务/实交/图片一致，但不宣称真实PDA设备或纸面新验收 |
| 用户业务接受 / 正式发布 | 不适用 | 代理技术核对不代填用户接受；本轮为本地Mock补充，发布另记，不把旧main发布回执套给本轮 |

## 最终结论

结论：通过

本轮适用业务、数据保护、具名页面/图片、数量状态及性能验证通过。最终技术收据在任务文件冻结后生成，其状态及本地提交另在独立输出中记录；未代填用户业务接受。

## 变更覆盖与验证

### 受管文件

- `docs/product-design/2026-10-22-accessory-workflow-mock.md`
- `docs/prototype-review-records/2026-10-22-accessory-workflow-mock.md`
- `scripts/check-accessory-workflow-mock-performance.mjs`
- `scripts/workflow-governance/affected-checks.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/wls/accessory-warehouse-demo.ts`
- `src/data/wls/accessory-warehouse-migration.ts`
- `src/data/wls/accessory-warehouse-mock.ts`
- `src/data/wls/accessory-warehouse-post-finishing.ts`
- `src/data/wls/accessory-warehouse-records.ts`
- `src/data/wls/accessory-warehouse-sewing.ts`
- `src/data/wls/accessory-warehouse-sources.ts`
- `src/data/wls/accessory-warehouse-stock-sources.ts`
- `src/data/wls/accessory-warehouse-upstream-fixtures.ts`
- `tests/browser-contracts/accessory-workflow-mock.test.ts`
- `tests/unit/accessory-workflow-mock.test.ts`
- `tests/workflow-governance/affected-checks.test.ts`

### 页面证据

- 版本：main 1b0b1697 后本轮实际差异；工作树 /Users/laoer/.codex/worktrees/ca23/higoods；源码契约独立Vite服务，固定生产预览 http://127.0.0.1:43323；Chromium 149.0.7827.55，Asia/Shanghai，1366×768、1280×720、1024×768；源码和资产哈希见 source-manifest.json、performance/results.json。
- 证据：16入口：三仓配料/调拨/收货/领料/库存/库位及后道调拨、车缝任务；三设备页面截图与图片decode结果位于 output/verification/accessory-workflow-mock/；pages.json登记每页图片和行数。
- 初次图片采集等待离屏lazy图片的decode无进展，按采集无效保留 browser-lazy-collector-invalid.log；随后功能采集显式加载所有图片，不把此方式用于性能计时。

### 性能结论

- 结论：通过
- 依据：固定dist、13个数据入口冷/刷新/站内切换、两个最重列表低分辨率、10个操作家族五轮。53家族、265有效样本、最大957.5ms、0失败；加载终点含必要图片/字体及两帧，保存另核对原库提交。源/构建资产在性能JSON中绑定；最初慢值及两次错误跨系统Tab/未等查询完成的采集失败保留，不能用于通过。

### 验证命令

- `npm run build`：通过
- `node --import tsx --test tests/unit/accessory-*.test.ts tests/unit/gtp-preparation-model.test.ts tests/unit/post-finishing-accessory-identity.test.ts`：通过
- `node scripts/check-typescript-scope.mjs src/data/wls/ src/data/fcs/runtime-process-tasks.ts`：通过
- `node --import tsx --test --test-concurrency=1 tests/browser-contracts/accessory-workflow-mock.test.ts tests/browser-contracts/accessory-warehouse-records.test.ts`：通过
- `node --experimental-strip-types --test tests/workflow-governance/affected-checks.test.ts`：通过
- `node scripts/check-accessory-workflow-mock-performance.mjs`：通过


### 例外

- 仅继承用户已确认的演示款图可错配、必须都有图；物料图无此豁免。本轮均使用现有材料图片与衬衫款图。
- 最终技术收据预定 output/verification/accessory-workflow-mock/task-receipt.json；该输出不参与自身绑定。
