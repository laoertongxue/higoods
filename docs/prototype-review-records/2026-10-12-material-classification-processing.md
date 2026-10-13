# 物料分类、加工方式与档案简化审查记录

依据当前根文件 [AGENTS.md](../../AGENTS.md) 的范围、需求追踪、页面验收、性能及原型审查门禁。

## 基本信息

- 日期：2026-10-12
- 任务 / 需求编号：CAT、FAST、DYE、PRINT、PROC、LIST、DEL、KEEP、STORE、UI、PERF、REVIEW 共41条；前五项及两项补充
- 验证人：Codex主代理及独立只读审查代理 material_round1_review；用户需求已确认，用户接受未代签

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：三类固定目录、BF必填类型、MJS/GTG及四印花方式、简易SPU列表/审核、删除版本及技术引用入口；FCS治理注释及检查器历史声明解析同步修正，当前列表严格证明完整骨架；48个治理专项通过。具体矩阵见 [需求矩阵](https://github.com/laoertongxue/higoods/blob/e45ceac841b15aad352fbc0fda9274a35c44e01c/docs/materials-classification-processing-cleanup.md)

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
|---|---|---|
| 分类及BF条件字段 | 通过 | CAT/FAST专项和pages.json分类/BF真实保存及刷新 |
| 编码身份 | 通过 | 同父SKU六方式不同编码、AB两面版本及修订；process.json与方式/往返专项 |
| 数量单位与费用 | 通过 | 六方式费用独立、综合成本累计；历史1500mm根档/投入/加工一致；50规格数量全部回读 |
| 状态及审批对象 | 通过 | SPU勾选确认待审SKU、已通过主档追加规格，旧未登记类型/方式审批阻断 |
| 保存与读取 | 通过 | Blob/主档/子规格/费用回读；首次0用户记录；无种子写入；事务完成后发布 |
| 失败与冲突 | 通过 | quota保留原记录及输入、跨标签拒绝覆盖、偏好读取失败采用默认值 |
| 上下游引用 | 通过 | 真BOM/TMF引用专项；PMS采购及FCS计划实际保存刷新，快照含方式 |
| 删除代码 | 通过 | 两轮正反向扫描，专用技术引用文件/业务复制/版本管理状态和旧契约直接删除 |
| 历史读取及静态来源 | 通过 | 真正generated JSON只修改物料键；旧编码及其他模块字符串保留；未知旧分类待补 |
| 页面及设备 | 通过 | 1366x768、1280x720，主体无横溢，表格自身横向/底部滚动、操作直接换行 |
| 实物图片及大图 | 通过 | pages.json可见图片自然宽度断言及大图；既有实物照片和对象对应，截图见证据目录 |
| 图片输入校验 | 通过 | 既有图片校验、临时Blob与耐久文件识别专项，未放宽校验；保存失败输入保留 |
| 标签打印 | 通过 | 两类SPU三个标签、QR数量与型号图片，打开打印页并生成PDF；无物理出纸声明 |
| PDA | 不适用 | 本次管理端配置/档案入口变更，不新增PDA动作；底层真实引用契约保留 |
| 完整响应性能 | 通过 | 267家族五轮共1335样本，最大265.900ms；三报告同资产 |
| 两轮逐项对抗审查 | 通过 | [逐项审查记录](https://github.com/laoertongxue/higoods/blob/e45ceac841b15aad352fbc0fda9274a35c44e01c/docs/materials-classification-processing-review.md)，每轮41条，反例修复复验 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/material-process-plans.ts`
- `src/data/generated/pcs-record-baseline.json`
- `src/data/pcs-material-archive-repository.ts`
- `src/data/pcs-material-archive-types.ts`
- `src/data/pcs-material-config.ts`
- `src/data/pcs-material-handoff.ts`
- `src/data/pcs-material-performance-fixtures.ts`
- `src/data/pcs-material-r1-seeds.ts`
- `src/data/pcs-material-reference-check.ts`
- `src/data/pcs-material-rules.ts`
- `src/data/pcs-material-technical-usage.ts`
- `src/data/pcs-material-transfer.ts`
- `src/data/pcs-material-variant-repository.ts`
- `src/data/pcs-material-variant-types.ts`
- `src/data/pcs-record-codec.ts`
- `src/data/pcs-record-static-versions.ts`
- `src/data/pcs-simple-material-transfer.ts`
- `src/pages/pcs-config-workspace.ts`
- `src/pages/pcs-material-archives.ts`
- `src/pages/process-work-orders/material-process-plans.ts`

### 页面证据

- 版本：分支codex/material-classification-processing-cleanup，HEAD c89009bb6c7189acb6370b1902347004c1052693；实际未提交运行源码由sourceHashes绑定，清单SHA256 a88ba156e6623a98156089780e7ee4873b3c75111f01118673f3dd1ad1a01fa4；入口SHA256 d79f867f0f75fce768b6e116251f33b8cb282ed4e6a1c43ef3d3350196637c79，HTML b2efbbea490404a5a99fcc233b0af974a85775c9ca68197e69a5cc6148f119c8。服务127.0.0.1:43222及PID96414 cwd已经核验；当前工作树/最终任务差异绑定由/tmp/material-classification-final/task-receipt.json登记，未生成远端发布。
- 证据：[验收清单](../verification-evidence/2026-10-12-material-classification/acceptance.json)、[环境及范围](../verification-evidence/2026-10-12-material-classification/README.md)。路由/pcs/materials/parts、consumable、新建/详情/整档编辑、三类档案及SKU、process、/pcs/settings/config-workspace、PMS采购和/fcs/process/material-plans/new已实际核验；图片/打印PDF及原始报告同目录。

### 性能结论

- 结论：通过
- 依据：真实事件或导航至数量状态图片字体绘制完成，保存含持久回读；122+111+34家族各5轮、合计1335样本，最大265.900ms，全部<=1000ms；不使用平均值、预热冒充冷态或只测处理器返回。

### 验证命令

- `npm run build`：通过
- `npm run typecheck`：通过
- `node --import tsx --test tests/pcs-material-cost-folding.test.ts tests/pcs-r1-config-page.test.ts tests/pcs-r1-config.test.ts tests/pcs-r1-material-field-coverage.test.ts tests/pcs-r1-material-rules.test.ts tests/pcs-r1-material-template-gaps.test.ts tests/pcs-r1-material-transfer.test.ts tests/pcs-simple-material-downstream.test.ts`：通过
- `node --import tsx --test tests/browser-contracts/pcs-simple-materials.test.ts`：通过
- `node --import tsx --test tests/browser-contracts/pcs-material-process-acceptance.test.ts`：通过
- `node --import tsx --test tests/browser-contracts/pcs-material-layout-downstream.test.ts`：通过
- `node --import tsx scripts/check-pcs-simple-browser-evidence.ts`：通过

- `npm run check:prototype-design-governance -- --scope worktree --paths src/data/fcs/material-process-plans.ts,src/data/generated/pcs-record-baseline.json,src/data/pcs-material-archive-repository.ts,src/data/pcs-material-archive-types.ts,src/data/pcs-material-config.ts,src/data/pcs-material-handoff.ts,src/data/pcs-material-performance-fixtures.ts,src/data/pcs-material-r1-seeds.ts,src/data/pcs-material-reference-check.ts,src/data/pcs-material-rules.ts,src/data/pcs-material-technical-usage.ts,src/data/pcs-material-transfer.ts,src/data/pcs-material-variant-repository.ts,src/data/pcs-material-variant-types.ts,src/data/pcs-record-codec.ts,src/data/pcs-record-static-versions.ts,src/data/pcs-simple-material-transfer.ts,src/pages/pcs-config-workspace.ts,src/pages/pcs-material-archives.ts,src/pages/process-work-orders/material-process-plans.ts,docs/prototype-review-records/2026-10-12-material-classification-processing.md`：通过
- `npm run check:list-page-governance -- --scope worktree --paths src/data/fcs/material-process-plans.ts,src/data/generated/pcs-record-baseline.json,src/data/pcs-material-archive-repository.ts,src/data/pcs-material-archive-types.ts,src/data/pcs-material-config.ts,src/data/pcs-material-handoff.ts,src/data/pcs-material-performance-fixtures.ts,src/data/pcs-material-r1-seeds.ts,src/data/pcs-material-reference-check.ts,src/data/pcs-material-rules.ts,src/data/pcs-material-technical-usage.ts,src/data/pcs-material-transfer.ts,src/data/pcs-material-variant-repository.ts,src/data/pcs-material-variant-types.ts,src/data/pcs-record-codec.ts,src/data/pcs-record-static-versions.ts,src/data/pcs-simple-material-transfer.ts,src/pages/pcs-config-workspace.ts,src/pages/pcs-material-archives.ts,src/pages/process-work-orders/material-process-plans.ts,docs/prototype-review-records/2026-10-12-material-classification-processing.md`：通过
- `node --experimental-strip-types --test tests/workflow-governance/list-page-governance.test.ts`：通过

- `node --experimental-strip-types --test tests/workflow-governance/affected-checks.test.ts`：通过

### 例外

- 无
