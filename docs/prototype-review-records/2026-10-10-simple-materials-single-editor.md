# 耗材与配件同页主档规格编辑 R2

依据当前 `AGENTS.md` 治理基线。

## 基本信息

- 日期：2026-10-10
- 任务 / 需求编号：R2-001 至 R2-036
- 验证人：主代理；两轮独立审查 remove_simple_config；用户产品接受另行确认

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：删除耗材配件二级分类与模板，主档与多规格同页维护，调整导入和 BOM 用途归属。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 主档与规格同页维护 | 通过 | docs/verification-evidence/2026-10-10-simple-materials-single-editor/ 下 dossier.json；新增两类、全部规格编辑、追加/复制和刷新 |
| 规格数量与防错 | 通过 | docs/verification-evidence/2026-10-10-simple-materials-single-editor/ 下 limits.json；至少1行、100行、101行拒绝，主单位型号必填 |
| 身份、费用及历史资料 | 通过 | docs/verification-evidence/2026-10-10-simple-materials-single-editor/ 下 copy.json、adversarial.json；原对象版本、包装计价和v1/v2单位保留 |
| 审核启停及日志 | 通过 | docs/verification-evidence/2026-10-10-simple-materials-single-editor/ 下 lifecycle.json；主档与规格组合状态及操作结果 |
| 保存与故障恢复 | 通过 | docs/verification-evidence/2026-10-10-simple-materials-single-editor/ 下 adversarial.json、import-boundaries.json；配额/事务失败不丢输入、事务中止、双击重试；版本冲突沿用单元契约和源码复核，本次未新测多标签 |
| 上下游采购及BOM | 通过 | docs/verification-evidence/2026-10-10-simple-materials-single-editor/ 下 downstream.json；采购快照、BOM用途及配件历史引用 |
| 单位包装编码基础配置 | 通过 | docs/verification-evidence/2026-10-10-simple-materials-single-editor/ 下 config.json；专业三类模板、固定换算及包装编码保留 |
| 图片附件打印 | 通过 | docs/verification-evidence/2026-10-10-simple-materials-single-editor/ 下 lifecycle.json、copy.json；大图、Blob刷新复用、1/100张标签浏览器打印 |
| 取消与未保存状态 | 通过 | docs/verification-evidence/2026-10-10-simple-materials-single-editor/ 下 adversarial.json；离开提醒和取消不落盘 |
| 设备布局 | 通过 | docs/verification-evidence/2026-10-10-simple-materials-single-editor/ 下 dossier与adversarial五轮含1366×768和1280×720，编辑表仅局部横向滚动 |
| 性能门禁 | 通过 | docs/verification-evidence/2026-10-10-simple-materials-single-editor/ 下 acceptance.json；3975原始样本、每组至少5次、最大536.5ms |
| 两轮逐项对抗审查 | 通过 | docs/verification-evidence/2026-10-10-simple-materials-single-editor/ 及 docs/product-design/pcs-consumable-parts-simplification/对抗式审查-R2.md；36项正向/反向，3个发现全部修复复核 |
| PDA | 不适用 | 本任务未改变PDA路由或对象接口，验收对象为桌面主档和规格维护及对应采购/BOM。 |

## 最终结论

- 结论：通过

36/36原子需求已验证；仅原型实现和验证，不代填用户接受，不宣称真实后端业务或物理设备打印已完成。

## 变更覆盖与验证

### 受管文件

- `scripts/generate-pcs-static-baseline.ts`
- `src/data/generated/pcs-record-baseline.json`
- `src/data/pcs-config-workspace-repository.ts`
- `src/data/pcs-engineering-bom-material-resolver.ts`
- `src/data/pcs-material-archive-repository.ts`
- `src/data/pcs-material-archive-types.ts`
- `src/data/pcs-material-config.ts`
- `src/data/pcs-material-transfer.ts`
- `src/data/pcs-record-runtime.ts`
- `src/data/pcs-simple-material-categories.ts`
- `src/data/pcs-simple-material-transfer.ts`
- `src/pages/pcs-config-workspace.ts`
- `src/pages/pcs-material-archives.ts`
- `src/pages/pcs-technical-data.ts`
- `src/pages/tech-pack/bom-domain.ts`
- `src/pages/tech-pack/events.ts`
- `src/router/route-renderers.ts`

### 页面证据

- 版本：codex/simple-materials-single-editor；HEAD 4bb4fe1721a4c4ab85ac378ed555b841c31f9c19 加当前任务差异，运行源码差异SHA256 96a2fdadcbd9c76d65aaaafe211b6af919b72cc431c2c6d64f6408f1a55f32c1；bundle SHA256 d9906ba9101b9e6ee804c93fa3a9d2e150ec05ee905f0476a08de79c9bdc73d1。工作树 /Users/laoer/.codex/worktrees/simple-materials-main-integration/higoods，生产预览 http://127.0.0.1:43222 与dist哈希一致；43221仅构造隔离Mock。
- 证据：docs/verification-evidence/2026-10-10-simple-materials-single-editor/acceptance.json 及11份原始报告及实际运行日志；截图 output/playwright/pcs-simple-dossier/ 和 output/playwright/pcs-simple-materials/。实际1366×768、1280×720：/pcs/materials/consumable、/pcs/materials/parts、主档新建编辑及SKU费用计量打印；/pcs/settings/config-workspace、/pms/material-purchase-orders、/pcs/technical-data/bom-pricing、技术包BOM。逐项见需求追踪矩阵-R2.md。

### 性能结论

- 结论：通过
- 依据：3975原始样本（7份最终构建报告，4份不变模块报告按完整源码哈希复用），每组至少5次，最大536.5ms。导航起点或点击前起点至事务完成、结果可见、可见图片解码、字体及动画完成和两个独立绘制帧；冷开/刷新禁缓存；无1s例外。原始报告及分组统计见acceptance.json和11份明细。

### 验证命令

- `node --import tsx --test tests/unit/pcs-simple-dossier.test.ts`：通过
- `npm run build`：通过
- `npx tsc --noEmit`：通过
- `SIMPLE_DEV_URL=http://127.0.0.1:43221 SIMPLE_PROD_URL=http://127.0.0.1:43222 node --import tsx --test tests/browser-contracts/pcs-simple-dossier.test.ts`：通过
- `SIMPLE_DEV_URL=http://127.0.0.1:43221 SIMPLE_PROD_URL=http://127.0.0.1:43222 node --import tsx --test tests/browser-contracts/pcs-simple-downstream.test.ts`：通过
- `SIMPLE_DEV_URL=http://127.0.0.1:43221 SIMPLE_PROD_URL=http://127.0.0.1:43222 node --import tsx --test tests/browser-contracts/pcs-simple-copy-identity.test.ts`：通过
- `SIMPLE_DEV_URL=http://127.0.0.1:43221 SIMPLE_PROD_URL=http://127.0.0.1:43222 node --import tsx --test tests/browser-contracts/pcs-simple-materials.test.ts`：通过
- `SIMPLE_DEV_URL=http://127.0.0.1:43221 SIMPLE_PROD_URL=http://127.0.0.1:43222 node --import tsx --test tests/browser-contracts/pcs-simple-config.test.ts`：通过
- `SIMPLE_DEV_URL=http://127.0.0.1:43221 SIMPLE_PROD_URL=http://127.0.0.1:43222 node --import tsx --test tests/browser-contracts/pcs-simple-import.test.ts`：通过
- `SIMPLE_DEV_URL=http://127.0.0.1:43221 SIMPLE_PROD_URL=http://127.0.0.1:43222 node --import tsx --test tests/browser-contracts/pcs-simple-adversarial.test.ts`：通过

- `SIMPLE_PROD_URL=http://127.0.0.1:43222 node --import tsx --test tests/browser-contracts/pcs-simple-list-entry.test.ts`：通过
- `node --import tsx tests/pcs-engineering-bom-version-workflow.spec.ts`：通过
- `node --import tsx scripts/check-pcs-simple-browser-evidence.ts`：通过
- `node --experimental-strip-types --test tests/workflow-governance/pcs-simple-browser-evidence.test.ts tests/workflow-governance/affected-checks.test.ts`：通过

- `npm run test:workflow-governance`：通过

### 例外

- 无

版本复用范围明确登记于 acceptance.json：最终仅 BOM 标准列表结构与详情内部函数/动态入口发生追加变化。采购/BOM及真实列表编辑入口最终重跑；配置、生命周期、复制和专业回归四份报告使用原 bundle 实测，全部相关运行源码逐文件一致。治理要求的性能仍均不超过1s，不以复用豁免超时。

交付检查范围还包含 scripts/task-completion-receipt.ts 与 scripts/workflow-governance/check-execution.ts 的冻结基准参数隔离，测试变更为 affected-checks/instruction-context 两份契约；最小失败复现及301项完整治理测试通过，指令→检查→同步→重新采集→收据顺序保留，页面与存储源码不变。
