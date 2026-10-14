# 面辅料采购单线上功能对齐实施审查记录

依据 `AGENTS.md` 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01，使用当前完整产品审查模板。

## 基本信息

- 日期：2026-10-14
- 任务 / 需求编号：面辅料采购单线上功能对齐，ALIGN-01～ALIGN-46
- 验证人：Codex 主代理；条码页面专项与文档归档由两个独立旁路代理提供，主代理核对实际文件及原始产物。技术验证不代表用户产品接受。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：在原有采购单、标准列表、条码抽屉和本地保存基础上补齐线上操作；普通单采用一单多SKU，数量、价格、物流、抽检、附件、入库及直接上下游按SKU关联。此轮为T4；未新增后端、登录、加工链和维护入口。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
|---|---|---|
| 线上核查边界 | 通过 | online-readonly-checklist.md保存35个主操作及字段/子操作来源、表单、守卫、未提交边界。测试站只读，不将旧弹窗当作线上保存成功。 |
| 功能逐项覆盖 | 通过 | 实施计划矩阵ALIGN-01～46绑定代码、自动化、实际页面及下游；主页面已完成四组5轮回放，另补相邻操作与条码专项。 |
| 新建、复制及分类 | 通过 | SPU选多SKU、面料/物料/辅料建单、复制清除执行事实、原料/辅料分类转换保存及回读；最终脚本与final-fields-calibration-b.log。 |
| 计划、实采、到货、入库及单位 | 通过 | lines契约及主流程持久回读；实采允许超计划，已明确实物限制按对应SKU，异单位不合加，入库按运单余量与实际来源共同限制。 |
| 价格和费用 | 通过 | 逐SKU确认价，已入库普通单仅允许专用改价；费用使用对应来源并明确币种，跨币种分别展示；cost-contract-v2.log及CSV实际产物。 |
| 物流和删除 | 通过 | final-operations-v2五循环补录、编辑、删除、20行CSV解析/提交；累计100条活跃物流。删除保留deleted标记，刷新不复活，未执行记录才能删除。 |
| 抽检、瑕疵及库存 | 通过 | final-adjacent-v2首组5轮抽检、照片、正常/瑕疵入库及追加处理回读，库存总量守恒；lines与inventory消费者契约。 |
| 保存成功与失败 | 通过 | 同库事务complete后发布；中止、版本冲突、重复提交、只读来源守卫有契约，浏览器强制abort保留输入、不假成功；条码错误导入前后持久数据一致。 |
| 读取与直接上下游 | 通过 | 无读取时种子落盘；刷新回读，需求余额、物料库存、供应确认、请款和结算按SKU取数。未改独立PCS业务页面，不冒称它们本轮全量验收。 |
| 附件 | 通过 | 抽检和多张转运凭证Blob及引用同事务，删除更新内部引用且共享文件引用受事务保护；图片回读已验证。 |
| 列表与查询 | 通过 | 沿用标准列表组件，查询/排序/重置、同步统计及全筛选导出；8个静态主单、默认每页5条共2页。日期与状态各自读取真实来源。 |
| 管理设备布局 | 通过 | 1366×768与1280×720实际截图，宽表在自身容器滚动、主体不横向溢出；条码两设备专项及下载文件渲染。 |
| 图片与键盘 | 通过 | 对应PCS物料静态真实图片与thumbnail manifest映射，原图/Esc不丢表单，图片完成解码后测量；印刷预览逐SKU图、数量和单位对应。 |
| 条码功能与打印 | 通过 | barcodes/result.json及55个样本，补码、导入、查询/分页、单/批量修改删除、下架和下载实际检查；预览/下载不登记实际打印，不代表物理打印完成。 |
| 性能 | 通过 | 579个有效主样本/56家族，每家族至少5；条码55/11。最大617.1000000238419ms，所有有效样本<=1000ms，最终汇总及所有原始数组保留。 |
| 技术收据测试路由 | 通过 | 两个新增浏览器专项精确登记到现有检查路由；回归证明独立预览真实执行，未知相邻测试仍阻断，不改产品源或降低门禁。runner-before/after.log。 |
| 委托加工 | 不适用 | 本轮先完成已有采购功能。加工链、工厂交出接收、中央仓调拨及工厂身份改造属于下一阶段；此轮未预建。 |
| 发布 | 不适用 | 本轮仅本地增量交付，未提交/合并/推送；此前main发布不作为本轮发布证明。 |

## 最终结论

结论：通过

以上为本次命名原型范围的技术验收。用户产品接受、真实工厂业务、测试站数据写入和生产发布均未发生。

## 变更覆盖与验证

### 受管文件

- `src/data/pms/canonical-purchase-references.ts`
- `src/data/pms/material-inventory.ts`
- `src/data/pms/material-purchase-lines.ts`
- `src/data/pms/material-purchase-orders.ts`
- `src/data/pms/material-requirements.ts`
- `src/data/pms/payment-requests.ts`
- `src/data/pms/reconciliations.ts`
- `src/data/pms/supplier-confirmations.ts`
- `src/pages/pms/material-purchase-barcodes.ts`
- `src/pages/pms/material-purchase-order-parity.ts`
- `src/pages/pms/material-purchase-orders.ts`

- `scripts/workflow-governance/affected-checks.ts`
- `tests/workflow-governance/affected-checks.test.ts`

### 页面证据

- 版本：工作树 `/Users/laoer/.codex/worktrees/7eaf/higoods`，分支`codex/pms-test-alignment-20261013`，基线HEAD `3e6412f25bd389985ca1a2045280eff2220f622b`加当前未提交源码；11个源文件哈希登记于evidence/final-operations-v2/environment.json，源码集合SHA256为`fbd2ac95f2cf8ed2a47b162caf30b6e51322254c04e2e3f451c18c8707ea7ad8`。V2生产资产manifest SHA256为`ba915b7c0033960f17d4bbb254067bad4eb2a7b122bc9d4bced6717c25704c73`。构建命令npm run build，Node v26.8.2，Playwright Chromium 149.0.7827.55，同工作树生产预览`http://127.0.0.1:43965`；网络为本机同源，管理1366×768/1280×720。条码现场加载的80条资产与dist哈希逐条一致，source-asset-verification.json。共享宿主仍有其他Chrome/Codex进程，未停止其他任务。
- 证据：命名路由`/pms/material-purchase-orders`，本目录[evidence](evidence/)保存截图、真实四种CSV、打印HTML/PNG、主单/库存/抽检/凭证回读、正式性能数组和实际日志；条码位于同路由抽屉，见[evidence/barcodes](evidence/barcodes/)。最终测试脚本字节快照存[evidence/scripts](evidence/scripts/)。来源和每个动作绑定详见[实施清单](../../implementation-plans/2026-10-14-material-purchase-online-parity.md)。纯引用的独立PCS页面与未修改的其他系统不扩大为本轮全站验收。

### 性能结论

- 结论：通过
- 依据：冻结V2生产预览，从真实click/file input/导航至最终DOM、字体、对应图片就绪及两个动画帧；保存另有IndexedDB readonly事务complete回读，导出有真实文件，打印有实际渲染。主单2SKU、SPU载入4SKU、默认8主单/两页，文件每次20行并测试累计100物流；条码有两个SKU、两页及真实物料缩略图/标签。新标签页首次页面访问与刷新分别记录，没有将预热当冷启动。等价成员按相同实现、2SKU字段提交或相同20行文件路径，覆盖首次、边界和失败恢复，数据变化的上限情形保留原值。宿主资源竞争条件保留，未用最快值代替最大值。
- 原始汇总：[final-performance-summary.json](evidence/final-performance-summary.json)，条码：[raw-performance.json](evidence/barcodes/raw-performance.json)。原始main数组为同worker累计前缀，汇总只选每轮末数组；相邻完整回放及final operations另计独立事件，未将累计前缀重复计数。旧file change计时丢起点的5个解析样本登记无效，修为真实input后五次复采；所有有效慢样本计数为0。
- 校准问题：错误按钮选择器、文件change控件刷新、缩略图原图地址期待、补录夹具actual=0而装运=2、删除标记被期待物理删行均保留原始trace/截图/日志。校准修复不修改产品源，也未删断言或放宽1000ms。旧V1证据保留原身份，与V2分别记录，不覆盖为新证据。

### 验证命令

- `npm run build`：通过
- `node --import tsx --test tests/unit/pms-material-purchase-print-parity.test.ts`：通过
- `MPO_PARITY_PERF=1 CUTTING_E2E_PORT=43965 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/material-purchase-order-online-parity.spec.ts --repeat-each=5 --workers=1 --reporter=line`：通过
- `MPO_PARITY_EVIDENCE=output/playwright/mpo-parity-20261014/final-fields-calibration-b CUTTING_E2E_PORT=43965 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/material-purchase-order-online-parity.spec.ts --grep '其余对齐操作' --workers=1 --reporter=line`：通过
- `MPO_PARITY_PERF=1 MPO_PARITY_EVIDENCE=output/playwright/mpo-parity-20261014/final-operations-v2 CUTTING_E2E_PORT=43965 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/material-purchase-order-online-parity.spec.ts --grep '物流相邻动作与文件事件最终采样' --workers=1 --reporter=line`：通过
- `CUTTING_E2E_PORT=43965 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/material-purchase-barcode-online-parity.spec.ts --workers=1 --reporter=line`：通过
- `node --experimental-strip-types --test tests/workflow-governance/affected-checks.test.ts`：通过
- `git diff --check`：通过
- `npm run check:prototype-design-governance -- --scope worktree --paths <完整任务文件>`：通过
- `npm run check:list-page-governance -- --scope worktree --paths <完整任务文件>`：通过

构建包含915项单元测试全部通过，其中新增46项采购明细/消费者/条码/导出打印契约。全量`npx tsc --noEmit`仍有13项基线PCS类型错误，本任务11个源文件错误数为0；保留typecheck-v2.log，不称全仓类型检查通过。代码已作正反追踪，独立只读审查的12类问题由主代理修复并重放直接契约。治理命令与最终技术收据在文件冻结后执行，输出位于`/tmp/mpo-parity-20261014-final-receipt/`，收据只绑定技术检查。

### 例外

- 无。全量既有PCS类型错误属于未改范围，未放宽或豁免本任务检查；本轮未改公共组件、依赖、部署配置或浏览器全站设施。

首份技术收据实际阻断了两个未登记的浏览器测试（state implemented），保存在临时收据目录task-receipt-unregistered-tests.json；新增精确专项路由与回归契约后重生成最终收据，不将构建代替执行。产品V2字节未变，原性能和页面证据仍适用。工具本轮的完整治理测试由最终收据执行。

独立43966预览暴露条码测试的图片期待地址写死43965；测试现使用Playwright配置的baseURL作为来源，地址和对应物料图片仍严格匹配。原43965场景的期待值与计时逻辑未变，其55个样本保留适用；另保留43966失败收据及截图，当前便携脚本和原V2脚本分别保存，最终收据在新独立服务执行该端口分支。
