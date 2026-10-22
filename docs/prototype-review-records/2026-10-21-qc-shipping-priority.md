# 后道 QC 发货紧急优先级实施与验证记录

依据 [AGENTS.md](../../AGENTS.md) 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01，使用 [原型审查记录模板](../prototype-review-record-template.md)。

## 基本信息

- 日期：2026-10-21
- 任务 / 需求编号：后道 QC 发货紧急优先级，QCU-001～QCU-082
- 验证人：Codex 主代理；独立审阅及整改复核由 qc_priority_final_review 执行；用户已确认 D01～D06，不代填产品接受

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：新增按有效 SKU、履约仓及雅加达自然日计算的 QC 紧急参考，维护星级与供给去向；实际成衣仓实收参与唯一库存读取。未接外部数据库，不改变既有质量、加工、复检及差异授权规则。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 仓库和 SKU 分区 | 通过 | priority 单元契约“不同仓库与不同SKU供给不互抵”；runtime 有效替换、未知仓不猜测 |
| 库存占用成套抵扣 | 通过 | 今日专属40件：今日0/明日20；同40件改属明日：今日10/明日10。保留未来与取消未释放锁定，见 unit-contracts-final.log |
| 后道跨环节互斥 | 通过 | 同100件分为加工30、复检20、待接收40、实收10；四加工项各50不变200；实际子单全覆盖、短交不复活 |
| 父剩余和冻结子单 | 通过 | 公开命令100件中40子单A、剩余60B；独立改子单B、实收后P60/W40；收到后不可改去向 |
| 保存原子性及失败恢复 | 通过 | performance-actions-final.json 五次实收失败原始PCS逐字一致，输入保留，重试只一份receipt；规则/去向成功后原始库回读 |
| 规则取消、版本冲突与刷新 | 通过 | ui-checks.log：取消零写入、事务失败、真实重试、两标签冲突及刷新新窗口回读；正式生产资产追加冲突采样另见性能附件 |
| 正式来源和混合版本 | 通过 | integration 单元契约：正式有效分配经公开登记/确认/送检，四入口相同DTO；出库/后道revision/替换身份变化全部需核对 |
| 日期和星级 | 通过 | 显式上海/偏移来源换算雅加达自然日、午夜和超期子集；来源模糊不猜测；默认今日两星明日一星，维护限1～5且今日高于明日 |
| QC 匹配和显示边界 | 通过 | 仅待质检；生产主单取有效SKU并集，同SKU多QC共享参考不相加；完成QC无实时紧急区；列表和PDA不加星级模块 |
| 普通读取零业务写入 | 通过 | print-readonly-devices-final.json：7个入口首次及刷新共14次均无IDB业务写；localStorage仅higood-tabs偏好 |
| 图片、设备和 A4 分页 | 通过 | 最终5份PDF共7页逐页渲染核读；长SKU换行无截断、标题与表头不孤立；1280/1366管理、1024QC可读；新增库存行大图关闭/Esc/遮罩/失败态均经5轮核验 |
| 适用性能完整响应 | 通过 | 260个原始有效样本、每家族5个；最大521.3ms；完整分类见性能表 |
| 相邻原有数量及权限分支 | 通过 | 既有 full-flow/online-print 专项通过；完整构建中的1408单元通过；既有普通QC权限保留，不新建演示身份门槛 |

## 最终结论

结论：通过

业务实现、专项、实际页面/持久回读/零写入/打印及性能技术验证通过；技术记录不代替用户现场接受。最终技术收据固定在 `output/playwright/qc-priority-20261021/task-receipt.json`，冻结本记录及矩阵后运行，结果由独立交付说明登记，不倒填本文件。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/garment-spu-replacement-records.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/post-finishing-records.ts`
- `src/data/fcs/post-finishing-qc-shipping-facts.ts`
- `src/data/fcs/post-finishing-qc-shipping-priority-runtime.ts`
- `src/data/fcs/post-finishing-qc-shipping-priority.ts`
- `src/data/fcs/post-finishing-qc-shipping-seeds.ts`
- `src/data/fcs/post-finishing-qc-shipping-supply.ts`
- `src/data/wls/finished-outbound-orders.ts`
- `src/data/wls/seed/shared-seed.ts`
- `src/data/wls/shared/seed-utils.ts`
- `src/main.ts`
- `src/pages/print/print-preview.ts`
- `src/pages/print/templates/post-finishing-qc-print-template.ts`
- `src/pages/print/templates/post-finishing-qc-priority-block.ts`
- `src/pages/process-factory/post-finishing/full-flow-print.ts`
- `src/pages/process-factory/post-finishing/qc-orders.ts`
- `src/pages/wls-finished-inbound.ts`
- `src/pages/wls/finished/stock-realtime.ts`

### 页面证据

- 版本：`codex/outbound-online-parity-20261020`，HEAD `fc3283f6286e943e66d2b0c7f91cab88571b85ae` 加本任务未提交差异。工作树 `/Users/laoer/.codex/worktrees/29a1/higoods`；正式采样服务 `http://127.0.0.1:43216`；Chrome 155.0.8059.85。冻结运行源码集合 SHA256 `80259d838dff758db16a8ec84ccd99cec291ba7fcd8875658e2844e1fb332b5d`，`dist/index.html` SHA256 `4a880724d54e7a3e6a2832831ebfec65382dcc9bf16d2fce82700463ca7d95bf`，最终纸面版本见paper-environment-final.json；屏幕/业务证据见performance-environment-delivery.json，复用边界见下。完整任务差异由末端task-receipt绑定。
- 证据：根目录下 `output/playwright/qc-priority-20261021/` 保存采集器、原始日志、JSON和截图；纸面输出在 `output/pdf/`。命名入口为 QC 清单、QC 工作台、QC_ORDER、QC_DETAIL、统一 POST_FINISHING_QC_ORDER、PRODUCTION_QC_MASTER、成衣仓收货及成衣即时库存。
- 设备：管理1366×768/1280×720；QC工作台1024×768；业务时区Asia/Jakarta，另以Asia/Shanghai浏览器核对。独立浏览器context只操作隔离资料。
- 业务基线：75条出库、12张QC、3张后道任务、2张复检、3张后道出货、1张原始实收、336条原库存样本；另显式关联15个SKU及30条演示需求。不是线上业务数据或百万级规模证明。
- 相邻数量与保存证据：unit-contracts-complete.log（80/80）、warehouse-production-checks.log、performance-actions-final.json、regression-full-flow.log、regression-online-print.log。规则早期开发证据ui-checks.log未混作生产性能数据；最终并发与重读以performance-conflicts-final.json为准。
- 实际浏览器证明子单目标FM保存且状态仍待仓、实收后唯一receipt进入FM即时库存20件，刷新不重复；失败实收原始PCS无半套结果。
- 采集诊断：开发浏览器曾动态导入未带HMR时间戳的源码模块，重复注册仓库回调，只日志写入的现象属于该采集器；改用固定生产资产、无源码导入、原始PCS回读后保存正常。旧失败日志保留。库存错误路由/错误td选择器造成的采集失败也保留，未填成0ms或通过。

### 性能结论

- 结论：通过
- 依据：导航最终由页面内MutationObserver识别真实目标，等待字体、可见图片decode和两帧绘制，在页面内部锁定performance.now；自动化回读不会推迟终点。冷态新context无既有缓存或IDB；刷新独立命名。保存从真实点击到反馈、持久回读和两帧绘制。详见 performance-environment-delivery.json、performance-navigation-verified.json、performance-actions-final.json；最终纸面另见paper-pagination-final.json。
- 早期总单1.65～2.18秒样本完整保留。修复两处额外加载：统一总单直接加载QC模板；在既有后道入口判断中加入总单，避免加载无关采购初始化。旧采集器把绘制后多次工具往返也加进耗时，修正说明和原始值保留；不以平均值或负载解释删除慢样本。
- 本地生产预览证据只适用于登记的规模、设备和环回网络。无发布、Caddy运行或现场网络验收；因此本轮无Caddy阶段耗时，不能拿本地构建耗时冒充Caddy发布耗时。

### 验证命令

- `node --import tsx --test tests/unit/post-finishing-qc-shipping-priority.test.ts tests/unit/post-finishing-qc-shipping-supply.test.ts tests/unit/post-finishing-qc-shipping-runtime.test.ts tests/unit/post-finishing-qc-shipping-integration.test.ts tests/unit/post-finishing-qc-shipping-behavior.test.ts tests/unit/post-finishing-qc-priority-print.test.ts tests/unit/finished-outbound-orders.test.ts`：通过
- `node --import tsx scripts/check-post-finishing-full-flow.ts`：通过
- `node --import tsx scripts/check-post-finishing-outbound-and-online-print.ts`：通过
- `npm run build`：通过
- `npm run typecheck:engineering && npx vite build`：通过
- `git diff --check`：通过
- `npm run check:fcs-end-to-end`：通过
- `npm run check:standard-list-page-template`：通过
- `npm run check:prototype-design-governance -- --scope worktree --paths <本任务全部文件及记录>`：通过
- `npm run check:list-page-governance -- --scope worktree --paths <本任务全部文件及记录>`：通过
- `node scripts/check-typescript-scope.mjs src/data/fcs/post-finishing-qc-shipping src/pages/wls/finished/stock-realtime.ts src/pages/process-factory/post-finishing/qc-orders.ts src/main.ts src/pages/print/print-preview.ts`：通过

上述范围参数的实际31个路径记录在`output/playwright/qc-priority-20261021/task-paths.json`；两个治理检查未排除任何任务路径，列表静态检查覆盖5个改变的页面。首次治理记录缺根AGENTS引用已补齐后通过；原失败和最后通过日志分别保留。最终收据再运行所绑定检查，机器状态与产品接受分开。

完整构建执行1408项既有及新增单元；另最终专项80项全部通过，包含正式来源/版本6项及行为11项。后续的本批SKU范围、持久重读、目标图片和入口性能整改均完成对应专项及构建；最终代码源类型专项0错误。最终纸面仅补两条@media print分页样式后，四类型及长SKU全部重新生成并逐页核验。技术收据工具会再次执行它要求的构建及专项，实际结果保存在独立日志。

### 例外

- 无业务规则或性能门禁豁免。尚未形成的动作不扩建：部分取消/部分销售出库不在本期新增；单张后道出货仍单次确认，分批依靠真实子单。
- 范围外诊断保留：全量`tsc --noEmit`在未改动的tech-pack/engineering文件存在19项既有错误，见typecheck-existing-errors.log；本任务工程类型门禁通过。全库文档检查曾被既有历史绝对路径的未编码百分号触发URIError，见计划§6；本任务单独检查变更文档链接，不修改历史材料或检查器，也不声称全库检查通过。
- 新规则/去向复用既有同库原子记录引擎；替换身份仅受控只读，不顺手迁移整个换码模块。没有新增附件、云后端或可写库存账；旧记录来源不明显示需核对，保留原资料。


### 性能家族及复用版本

| 范围 | 家族数 | 样本数 | 最大完整响应 ms | 原始记录 |
| --- | --- | --- | --- | --- |
| 导航与刷新 | 18 | 90 | 521.3 | `performance-navigation-verified.json` |
| 规则/去向/子单/实收/刷新打印 | 15 | 75 | 213.4 | `performance-actions-final.json` |
| 并发及明确重读/外层打印 | 7 | 35 | 114.0 | `performance-conflicts-final.json` |
| 真实中途事务中止及恢复 | 2 | 10 | 97.0 | `persistence-day-boundaries-final.json` |
| 商品大图交互 | 5 | 25 | 76.4 | `image-long-sku-checks-final.json` |
| 最终PDF与长SKU纸面 | 5 | 25 | 297.0 | `paper-pagination-final.json` |

共260个有效样本、52个家族，完整原值见`performance-verified-summary.json`。导航包含QC清单、两类页内打印、两类统一打印、成衣库存、原料/在途共享调用方及成衣仓收货；冷访问和刷新各5次。

屏幕/业务验证运行源码集合哈希`53e37c92f8217393b55a47530a442084e1df4e80c4f4e491ded52210662468ea`，入口资产哈希`81217ec84f4d58bcd4239a82afc4a95db039551c6ee9967374c67da61b9ba00d`。其后唯一运行变更是打印模板@media print中的标题及行分页约束；屏幕布局、数量、读取、保存和事件链均不变，按EVIDENCE-01复用导航/动作证据，保留原身份。最终纸面哈希见本记录版本字段，25次PDF生成及7页图像均重验；长SKU仅在隔离DOM做版式压力输入，没有写业务资料。

中途事务中止后的完整PCS记录逐字不变、恢复重试规则与changes版本/维护人/原因一致，见`persistence-day-boundaries-final.json`。同记录另验持久取消记录的合法/空/非法日历deadline，及上海浏览器跨雅加达午夜的真实重打；均未猜补来源日期。

整改记录：独立审查发现父剩余/冻结子单、旧预览打印、颜色尺码规范化和超期主单标签，已修并复核；补证再发现零应检SKU误标和重读旧内存，均保留反例并修复。库存投影同次渲染一次，并按目标商品名称和图片显示替换后实收。库存冷访问加载无关采购/分配保存模块的路径已收敛到必要的后道读取，有保存分配产物时仍恢复。旧慢样本和错误路由/选择器采集日志全部保留，不作为最终有效样本或零耗时。


### 原生检查的依赖解析修复

第一次收据完成构建及1425项单元，但两条原生Node检查在新接入的仓库依赖处报ERR_MODULE_NOT_FOUND。限定修复shared-seed.ts的5处、seed-utils.ts的2处运行导入后缀为.ts，引用同一原有模块，不改任何仓库/商品/数量/页面值。两条失败命令已分别原样重跑通过，含Chromium真实列拖拽。临时tsx加载器诊断出现浏览器序列化__name错误，未作为最终检查环境；最终仍使用项目原生命令。

该修复只改变Node模块可解析性；Vite原本已经解析到同一文件，产品语义不变。屏幕/纸面/数量证据按EVIDENCE-01保留原资产身份；最终收据重新构建后在独立交付说明核对生产入口资产哈希及机器结果。原失败收据与日志保存为task-receipt-before-native-import-fix.json、workflow-before-native-import-fix.log，未改写为成功。
