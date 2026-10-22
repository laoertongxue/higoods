# 裁剪改厂 Mock 与原仓先收货审查

按当前 `AGENTS.md` 审查；范围、计划、原子条目见 `docs/product-design/2026-10-22-accessory-cutting-change-mock.md`。本轮基于 main a1000e145cf57371de75f4f334e30e8cd38d91de，保留既有工作，不改写上一轮历史验收。

## 基本信息

- 日期：2026-10-22
- 任务 / 需求编号：AC-01～AC-23，裁剪改厂三阶段两方向 Mock、真实改派及直接仓储流转
- 验证人：Codex 技术验证，用户业务接受未确认
- 影响分级：T4 共享来源及跨模块联动，T5 main 发布叠加

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：增加 12 张直接展示并可操作的生产单；修复静态辅料未参加生产任务改厂事务的缺口；车缝列表同次同步绘制复用归属读取，保留来源和库存核验。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 两方向三阶段待改与已改样例 | 通过 | 12 张独立单/款/SKU，复用冻结 BOM，unit-initial.log 与 browser-functional.log |
| 未出 GTP 同单改向 | 通过 | 真实统一工作台改派；原待收取消、新待收生成；配料/预占/实物不变 |
| 在途先原仓收货 | 通过 | 六条改派与六张已改样例后续操作；新仓无提前待收，原仓收货后原事务生成后续整单调拨 |
| 已收货整单仓间流转 | 通过 | 原收货历史及来源库位保留，实际出库才扣原仓，新仓实际收货才增库存 |
| 实物库存与在途守恒 | 通过 | 独立固定盘点底稿逐步核对六物料与单位，不从订单需求虚构新库存 |
| 保存失败与输入恢复 | 通过 | 改厂保存、原仓收货建后续单的 Quota 注入回滚，无半套；原输入真实重试成功 |
| 状态、数量、目的仓及重复防错 | 通过 | 少收/缺行/错库位/缺操作人/重复原契约；H05 已实交整包改厂拒绝且任务不变 |
| 静态读取、覆盖、零值及删除 | 通过 | 普通打开不复制种子；原记录覆盖/删除优先，实际动作只写本单差异 |
| 改厂审计及已有资料备份兼容 | 通过 | backup-fixed-corrected.log：新审计补齐原身份，旧缺id审计只规范导出副本，原持久值不改；完整恢复33调拨、6领料及覆盖/删除 |
| 单次同步渲染归属快照 | 通过 | identity-read-snapshot.log：与当前完整身份一致、返回值隔离、异常 finally、后续源变更立即生效；不跨动作缓存 |
| 三视口页面与图片 | 通过 | browser-accepted.log：12/12，专用六入口×三视口筛选截图，原16入口×三视口图片解码/无主体横溢出/真实动作 |
| 性能 | 通过 | performance-accepted/results.json：66家族、330有效样本、最大966.9ms、无失败；全部旧失败原样保留 |
| PDA / 打印 / 附件 | 不适用 | 未改端入口、纸面字段/生成、Blob 或附件引用；沿用原业务能力，不新增相关承诺 |
| 真实数据库 | 不适用 | 全部固定静态来源与隔离浏览器，无真实数据库访问或实物业务提交 |

## 最终结论

结论：通过

本地技术验收完成，最终浏览器12/12；发布状态另按后述交付记录关单。Git 与 Production 关单在冻结后的 `output/verification/accessory-cutting-change-mock/delivery.json` 记录，不能预填发布成功。

## 变更覆盖与验证

### 受管文件

- `src/data/wls/accessory-warehouse-upstream-fixtures.ts`
- `src/data/wls/accessory-warehouse-mock.ts`
- `src/data/wls/accessory-warehouse-records.ts`
- `src/data/wls/accessory-warehouse-factory-link.ts`
- `src/data/wls/accessory-warehouse-migration.ts`
- `src/data/fcs/production-context-actions.ts`
- `src/data/wls/accessory-warehouse-sources.ts`
- `src/data/wls/accessory-warehouse-sewing.ts`
- `src/pages/sewing-outsourcing/tasks.ts`
- `tests/unit/accessory-workflow-mock.test.ts`
- `tests/unit/accessory-warehouse-factory-link.test.ts`
- `tests/unit/post-finishing-accessory-identity.test.ts`
- `tests/browser-contracts/accessory-workflow-mock.test.ts`
- `tests/browser-contracts/accessory-cutting-change-mock.test.ts`
- `scripts/check-accessory-workflow-mock-performance.mjs`
- `scripts/workflow-governance/affected-checks.ts`
- `tests/workflow-governance/affected-checks.test.ts`

### 页面证据

- 版本：本任务分支 codex/accessory-cutting-change-mock-20261022，基准 a1000e14 加本轮差异；工作树 `/Users/laoer/.codex/worktrees/ca23/higoods`，原生本地 Vite 隔离上下文；正式性能使用同工作树 `dist` 与 127.0.0.1:43323。最终源码和运行资产绑定 source-manifest.json、性能原始结果及最终收据。
- 证据：`output/verification/accessory-cutting-change-mock/` 中 browser-functional、browser-guards-corrected、identity-read-snapshot.log、build.log；最终 browser-accepted.log、browser-accepted、browser-accepted-regression；12/12 通过。1366×768、1280×720、1024×768；统一工作台、中央仓、HILON/Mahameru 收货/调拨/库存、车缝任务与后道相关读取入口。全部业务写入限本地隔离浏览器。

图片复用现有 `/shirt-sample.jpg` 及对应拉链/纽扣/价格吊牌/品牌吊牌/吊粒/车缝线素材。遵循用户已确认的演示款图允许错配但不得缺图；物料图仍按对象对应。图片组件与大图交互未改，沿用上一轮 a1000e14 对其交互的证据，本轮验新对象文件存在与真实解码。

### 性能结论

- 结论：通过
- 依据：performance-accepted/results.json，66家族各5样本，共330有效样本，最大966.9ms，零失败。14入口冷/刷新/站内、1280与1024两个重点入口冷加载、原10动作及新10动作分别采样；点击到状态/图片/绘制及保存持久回读，填写等待不计。首轮 performance、并发负载 performance-r2、校准 complete/final 等失败保留原身份，校准不充当正式样本；最终固定构建追加通过，未删数据或放宽门槛。

### 验证命令

- `node --import tsx --test tests/unit/post-finishing-accessory-identity.test.ts`：通过
- `npx vite build`：通过
- `node --import tsx --test tests/unit/post-finishing-accessory-identity.test.ts tests/unit/accessory-warehouse-sources.test.ts tests/unit/accessory-warehouse-sewing.test.ts`：通过
- `node scripts/check-typescript-scope.mjs src/data/wls/ src/pages/sewing-outsourcing/tasks.ts`：通过
- `ACCESSORY_MOCK_PERF_OUTPUT=output/verification/accessory-cutting-change-mock/performance-accepted node scripts/check-accessory-workflow-mock-performance.mjs`：通过
- `ACCESSORY_MOCK_TEST_OUTPUT=output/verification/accessory-cutting-change-mock/browser-accepted-regression ACCESSORY_CHANGE_TEST_OUTPUT=output/verification/accessory-cutting-change-mock/browser-accepted node --import tsx --test --test-concurrency=1 tests/browser-contracts/accessory-workflow-mock.test.ts tests/browser-contracts/accessory-cutting-change-mock.test.ts`：通过

### 例外

- 全量 TypeScript 有 19 项既有 PCS 错误，当前本轮范围检查为 0；工程类型和正式构建仍须通过。没有删除数据、降低能力或放宽 1 秒门槛。首轮工作台规范地址采集错误、初期将普通遮罩误当 role=dialog 的选择器错误单独保留，不能算业务通过。原始失败与先前版本证据不改写。

收据工具按已登记路由重新执行构建及浏览器契约，没有证据复用开关；它的重复检查仅用于最终 HEAD 绑定，不代替本记录的语义审查。正式站只做只读查验，不在正式站执行任何收发或改厂动作。

最终 diff 已正向核查AC-01～23及反向核查来源、Mock、事务、页面、备份、测试和检查路由：未增加演示角色/模式或维护入口，未删样例、弱化收货/库存/已释放改厂等校验。新增范围读取仍核对全库存，旧资料/迁移回退原完整核验；身份/完整展示复用仅同步绘制内有效。备份问题及性能失败均保留原始证据，最终通过取自追加验证。历史完整构建 build-r2.log 为1432例；后续来源细化已用当前专项与当前Vite构建验证，最终收据再执行当前完整构建，不冒用旧全量结果。
