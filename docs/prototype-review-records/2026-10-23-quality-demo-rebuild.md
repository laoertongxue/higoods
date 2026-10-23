# 质检与后道演示数据重建审查

## 基本信息

- 日期：2026-10-23
- 任务 / 需求编号：RESET-01～15，CLEAN-WP01～06
- 验证人：Codex 主代理（技术验证，不代表用户接受）

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：取消旧演示搬迁和旧样衣转换门槛，直接生成带标准及检查轮次的新演示；当前保存、上下游和打印仍执行原业务规则。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 定向清理及其他模块保护 | 通过 | output/qc-demo-reset-20261023/native-scoped-final.log 中4项清理契约通过，保留共用附件、外部库存连通链及重复执行后的新记录。 |
| 当前事务、失败、升检及数量 | 通过 | native-final.log 的45项及 labels-corrected.log 的1项；native-scoped-final.log 中15项后道契约全部通过。首次标签用例新增超量回货，已改用现有待接收批次复验。 |
| 页面及上下游 | 通过 | e2e-current.log 45项通过；库存14项、当前备份3项及执行5项在e2e-final.log通过；e2e-awake.log补齐PFN-067及睡眠中断的3项打印。最终收据将再次验证固定文件集。 |
| 打印与图片 | 通过 | e2e-current.log中26项打印准备检查通过；e2e-print-reviewed.log及e2e-awake.log覆盖新版打印；pdf-review保留实际生成PDF和逐页渲染。最新标准时序及待开检/缺快照分支由final-fallback-units.log 17项覆盖，最终固定构建七类PDF及200个标签逐枚解码通过，20页业务纸单实查通过（print-pdf-review/native-barcode-review-r2.json、pdf-review/current-scoped/visual-review-result.json）。 |
| 性能 | 不适用 | 用户最新明确“不要测试性能了，功能验收没问题就行”；已停止全部采样与排队任务，已有慢值和失败保留，未声明性能通过。 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `public/images/post-finishing/demo-signed-qc.svg`
- `src/data/fcs/post-finishing-authorization.ts`
- `src/data/fcs/post-finishing-document-numbering.ts`
- `src/data/fcs/post-finishing-production-source-fixtures.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/post-finishing-inventory-bridge.ts`
- `src/data/fcs/post-finishing-operation-log.ts`
- `src/data/fcs/post-finishing-print-progress.ts`
- `src/data/fcs/post-finishing-qc-reference.ts`
- `src/data/fcs/post-finishing-qc-shipping-facts.ts`
- `src/data/fcs/post-finishing-records.ts`
- `src/data/fcs/ppic-daily-return-records.ts`
- `src/data/fcs/production-context-records.ts`
- `src/data/fcs/quality-demo-rebuild.ts`
- `src/data/fcs/quality-post-read-source.ts`
- `src/data/fcs/sample-quality-read-source.ts`
- `src/data/fcs/sewing-sample-approval-suggestion.ts`
- `src/data/wls/finished-inventory-quality-seed.ts`
- `src/pages/pda-post-finishing-exec-detail.ts`
- `src/pages/pda-post-finishing-flow.ts`
- `src/pages/process-factory/post-finishing/storage-notice.ts`
- `src/pages/process-factory/post-finishing/work-order-detail.ts`
- `src/pages/process-factory/post-finishing/work-orders.ts`
- `src/pages/sewing-outsourcing/sample-approval-suggestions.ts`

- `src/pages/print/templates/post-finishing-qc-print-template.ts`
- `src/pages/print/templates/post-finishing-route-card-template.ts`
- `src/pages/process-factory/post-finishing/qc-orders.ts`

- `src/data/fcs/post-finishing-current-read-model.ts`
- `src/pages/qc-records/fact-view.ts`

### 页面证据

- 版本：codex/quality-management-20261022，基线3346f08bdd8203d333b9c7363c232bf75ec3400b及本轮未提交变更；工作树/Users/laoer/.codex/worktrees/e103/higoods；隔离开发服务43646/43649/43654/43656及最终固定预览43661（dist-scoped）。用户浏览器43585已切换到同产品资产的dist-user，执行一次性重建并直接展示新版标准，见actual-browser-rebuild.json及current-quality-browser.png；该来源原记录为0，未删除其他模块。运行资产绑定runtime-scoped-manifest.json和user-preview-binding.json。
- 证据：output/qc-demo-reset-20261023/；原生契约和页面原始失败保留，采集错误及跨版本HMR不能算当前通过。

### 性能结论

- 结论：不适用
- 依据：用户2026-10-23最新确认停止性能测试，本轮按功能验收关闭。全部已发生慢值/失败、诊断和中断保持原身份，汇总于performance-stopped-summary.json。性能采集工具准备阶段提速尝试已撤回；最终回放仅通过QUALITY_FUNCTIONAL_ONLY=1跳过独立PFN-067计时用例，其余保存、刷新回读与上下游功能照常执行。

### 验证命令

- `npm run check:post-finishing-current-read-model`：通过
- `npm run check:post-finishing-outbound-and-online-print`：通过
- `npm run test:workflow-governance:affected-checks`：通过
- `npm run build -- --outDir output/qc-demo-reset-20261023/dist-final`：工程类型检查通过；1590项单测中2项无关子进程超时，保持原失败；对应5项在unit-timeout-recheck.log复验通过。最终固定源码Vite构建见vite-delivery.log；最终完整构建由收据重新执行。
- `npm run typecheck`：未通过；19项诊断均位于本轮未改的5个PCS文件，逐文件基线字节一致性见full-typecheck-existing-boundary.json，不宣称完整类型检查通过。

### 例外

- 本轮按用户明确要求退役旧演示迁移/兼容验收；共享PCS结构及辅料自有迁移因其他模块仍使用而保留。性能依据用户最新明确要求不纳入本轮完成条件；旧2秒边界及已发生失败保留历史身份，不把停测写成性能通过。

### 最终补证与审查边界

- 维护入口6项回归全部通过（maintenance-consumer.log），其余洗水/换片布入口保护未变；PCS图片3项通过（current-image-source-unit.log），只删已退役后道旧图迁移断言。
- 同SKU并发准备出货的原生CAS和数量守恒仍由post-quality-storage验证；不保留旧复检转出货逻辑。
- 主代理已逐文件审查完整任务diff，正向核对RESET01～15、反向核对共享生产来源/辅料/附件/导出及测试消费者；semantic-diff-review.json保留实际文件指纹。未发现本任务尚未关闭的功能问题。
- 功能专项通过，最终技术收据待运行，预定位置output/qc-demo-reset-20261023/final-task-receipt.json；收据结果在独立交付说明登记，不预填通过。

最终共享辅料UI回归中的旧测试定位修正：5个文件的创建按钮精确限定到原测试生产单，数量/图片断言同样限定本单；图片测试准备先打开当前公共库结构后再冻结业务数据比较。产品代码与预期业务数量不变，9个受影响场景已全部通过（auxiliary-ui-fixture-boundary-review.json）。原失败和采集版本保留；最终收据工具不支持复用先前构建/专项结果，因此修正测试后按工具既有范围重新生成收据，性能用例仍明确跳过。

## 最终范围收口（替代此前待运行收据说明）

按用户“不要测试性能了，功能验收没问题就行”的最新指示，本轮停止性能验收。撤回为性能临时增加的辅料读取优化及由此扩大的8个辅料UI测试文件改动，辅料产品实现恢复至本轮基线，不把辅料旧资料迁移纳入本次清理。此前额外回归暴露的两个辅料用例失败保留原始报告，其中一个是全局计数与静态样本数不符，另一个是改厂后打印按钮未出现；不冒称这些用例通过，也不将其扩大为本轮质检功能改造。

本轮质检/后道功能专项通过：原生契约46项、保存及上下游页面专项、实际PDF和逐枚条码核验；完整工程构建及1591项单测也已通过（first-final-workflow-failed.log、final-workflow-r2.log中的对应阶段）。上述完整流程在额外辅料回归阶段停止，因此未生成通过的完整技术收据。功能证据按原始版本身份引用，不能将专项通过说成整个仓库全量验收通过。最终边界及证据索引见output/qc-demo-reset-20261023/functional-delivery-summary.json。
