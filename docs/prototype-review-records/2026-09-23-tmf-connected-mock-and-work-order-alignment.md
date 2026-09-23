# TMF 串联 Mock、加工单统一与全链复核记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-23 |
| 相关需求 / 任务 | 五个业务页面补齐串联 Mock；半成品加工单与织带加工单统一染色加工单信息模型；操作统一为确认接受、加工填报、发起交出；全链与性能重新验收 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PMS / FCS / PFOS / WLS / PDA / 打印 |
| 管理端路由 | `/fcs/craft/accessory/webbing/purchase-demands`、`/semi-finished-orders`、`/work-orders`、`/pending-receipts`、`/handover-records` |
| 设备与打印 | `/fcs/craft/accessory/webbing/pda`、`/fcs/print/preview?documentType=TMF_PROCESS_SHEET` |
| 主要角色 | 采购员、生产计划、织带厂主管、辅料仓管、生产领料人 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：五个页面的数据、名称、字段、动作、PDA 和打印结果均发生变化，并新增 TMF 专用路由与完整性能证据。
- 当前治理基线：`AGENTS.md` 第 4、5、7 节。

- 采购需求只表达 PMS 面辅料采购来源、采购数量、交期、供应商、变更和半成品加工结果，不再与加工单同构，也不提供“载入演示采购”。
- 原“基础生产单”完整迁移为“半成品加工单”；原“生产加工单”完整迁移为“织带加工单”。两类加工单均按加工单/商品、加工投入/上游、加工要求、处理进度、加工产出/下游、时间、数量七组信息展示。
- 两类加工单只保留确认接受、加工填报、发起交出。页面和领域契约均不再依赖接单、开工或完工动作。
- 12 条采购/半成品链、5 张织带加工单和 8 条规格需求在页面首次进入时自动存在；采购、半成品、上游批次、加工投入、交出、仓收、分配发料和生产实收使用同一编号链。
- 同一半成品 SKU 可对应 500mm、600mm、650mm、700mm 等生产截断长度；长度和金属头、塑料包头、硅胶浸头要求保留在技术包规格与加工产出，不新增 SKU。
- PDA 读取同一加工单和投入事实；加工明细打印读取实际采购物料图、技术包快照、状态、时间和数量，图片或条码未就绪时仍阻断打印。

## 3. 自查结论

| 检查项 | 结论 | 当前证据 |
| --- | --- | --- |
| 对象、来源与上下游 | 通过 | PMS 需求/采购→半成品加工→连续料批次→织带加工→交出→仓收→生产实收可按编号串联 |
| 状态与操作 | 通过 | 确认接受、加工填报、发起交出；无接单、开工业务门禁 |
| 数量与单位 | 通过 | 米、条、根、个、kg 分开；加工投入、损耗、余料、产出及生产实收独立守恒 |
| SKU 与生产规格 | 通过 | 颜色/花型进入半成品 SKU；长度和端头不进入 SKU，由技术包和批次/包记录区分 |
| 角色与权限 | 通过 | 当前登录角色来自会话；页面无角色自选；超量、错对象、错单位和重复动作阻断 |
| 图片与识别 | 通过 | 织带和绳子使用本地实物图；缩略图与编码同块；大图支持关闭；打印图像完成后才可打印 |
| PDA 与低分辨率 | 通过 | 360×640 PDA 主链及超量阻断；1024×768 管理端主体无横向溢出 |
| 打印 | 通过 | A4 加工明细含来源、要求、状态、数量、时间、二维码、条码及物料实图 |
| Mock 场景 | 通过 | N01～N05、B01～B24 各自独立子进程、独立账本、独立收据；异常阻断无副作用并执行恢复 |
| 性能 | 通过 | 修复额外路由模块往返后完整重放 350 个样本，最大 309ms、失败 0；此前 503.9ms 失败样本单独保留，不以重试覆盖 |

## 4. 本轮发现并关闭的问题

| 问题 | 处理 | 结论 |
| --- | --- | --- |
| 五页数据不完整且需点击载入 | 改为内建可重复初始化、不会覆盖已执行事实的串联 Mock | 已关闭 |
| 采购需求与加工单页面同构 | 采购页改为采购模型；加工页改为染色加工单七组模型 | 已关闭 |
| 页面保留接单/开工语义 | 用户可见动作和领域门禁统一为确认接受、加工填报、发起交出 | 已关闭 |
| 待接收使用错误角色且异步异常外泄 | 改为会话角色，错误保留在弹窗并展示可恢复提示 | 已关闭 |
| TMF 路由冷启动加载通用 FCS 大包 | 拆出 TMF 专用路由注册并过滤无关预加载 | 已关闭 |
| 输入事件冒泡触发通用处理器 | 各 TMF 页面在本地输入边界停止传播，保持局部更新 | 已关闭 |
| 打印把已有物料图当成缺失图 | 从同一采购/加工事实读取对象对应实物图，仍保留真实缺图阻断 | 已关闭 |
| 旧 29/29 只做字段检查且多场景复用同一脚本 | 新建 29 个独立子进程账本收据，逐场景推进或注入/恢复 | 已关闭 |
| 旧反向清单遗漏新文件 | 对当前扫描到的 TMF 文件逐个绑定需求号或排除理由 | 已关闭 |

## 5. 变更覆盖与验证

### 受管文件

- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/production-order-runtime-store.ts`
- `src/data/fcs/tmf-base-demo.ts`
- `src/data/fcs/tmf-source-readers.ts`
- `src/data/fcs/tmf-work-order-view.ts`
- `src/data/fcs/tmf-work-order-times.ts`
- `src/data/pms/material-purchase-orders.ts`
- `src/data/pms/material-requirements.ts`
- `src/data/pms/tmf-material-purchases.ts`
- `src/pages/print/templates/tmf-process-sheet-template.ts`
- `src/pages/print/tmf-process-print-preview.ts`
- `src/pages/process-factory/accessory/webbing/handover-records.ts`
- `src/pages/process-factory/accessory/webbing/pda-execution.ts`
- `src/pages/process-factory/accessory/webbing/pending-receipts.ts`
- `src/pages/process-factory/accessory/webbing/semi-finished-orders.ts`
- `src/pages/process-factory/accessory/webbing/work-order-detail.ts`
- `src/pages/process-factory/accessory/webbing/work-times.ts`
- `src/pages/process-factory/accessory/webbing/work-orders.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes-tmf-webbing.ts`
- `src/router/routes.ts`

### 验证命令

- `npm test`：通过，418/418；日志见 `docs/product-design/tmf-webbing/evidence/2026-09-23-tmf-unit-current.log`。
- `npm run build`：通过；日志见 `docs/product-design/tmf-webbing/evidence/2026-09-23-tmf-build.log`。
- `npx playwright test tests/tmf-webbing-connected-lists.spec.ts --workers=1`：通过，7/7；覆盖五页串联、统一模型、SKU/长度/端头、PDA 和异常恢复。
- `npx playwright test tests/tmf-webbing-connected-performance.spec.ts --workers=1`：通过；五页连接性能回归。
- `npx playwright test tests/tmf-webbing-complete-performance.spec.ts --workers=1`：通过，13/13；证据见 `docs/product-design/tmf-webbing/evidence/2026-09-23-tmf-complete-performance.json`。
- `node docs/product-design/tmf-webbing/evidence/2026-09-23-scenario-independent-runner.mjs`：通过，29/29；单场景收据位于 `evidence/scenarios-20260923/`。
- `npm run check:list-page-governance:static`：通过。
- `npm run check:prototype-design-governance -- --all`：通过，21 个用户可见受管文件均由本记录覆盖。
- `git diff --check`：通过。

### 例外

- 无

## 6. 最终结论

结论：通过。

本结论仍以最后一次实质修改后重新执行第 5 节全部命令，并确认两轮对抗审查与业务专家审查无未关闭问题为最终门禁。
