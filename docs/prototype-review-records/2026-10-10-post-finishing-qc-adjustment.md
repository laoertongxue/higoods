> 2026-10-17 证据路径维护：本文原业务结论、采样数值和确认版本未改写。已退役原始报告按固定Git提交读取，相关本地路径已改为历史版本链接；这不表示本文业务在当前工艺统一版本重新验收。完整映射见[历史资料恢复索引](../retired-craft-history.md)。

# 后道回货与执行质检调整——main 发布整合审查

按 `AGENTS.md` 当前 REVIEW-01 / EVIDENCE-01 执行。本记录绑定后道调整及其发布整合；历史故障审查原文、版本、失败样本均保留，不重标为当前通过。

## 基本信息

- 日期：2026-10-11
- 任务 / 需求编号：后道回货与执行质检调整及 main 发布；NUM/QC/IMG/SAVE/PAGE/PERF/SCOPE
- 验证人：Codex（技术核验；用户页面接受仍独立）

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：回货次数及串联编号、单人一张进行中质检、执行/清单分工、颜色图片、Web/PDA 和关联事务保存变化；发布整合仅调整 warehouse.ts 的既有列表接入方式，并为两个本次 Native 测试登记实际独立服务运行路由。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 编号及真实父单关系 | 通过 | domain-full-flow.log；15 条跨端 UI；无后道分支 ZJ-CH，零合格不生成空单 |
| 单人单任务与精确领取 | 通过 | [native.report.json](https://github.com/laoertongxue/higoods/blob/821b9ea54040ec03662acbe6ae3d2c62608fe273/docs/prototype-review-records/evidence/2026-10-10-post-finishing-qc/publication-2026-10-11/native.report.json)；browser-contract.json；当前执行页自动续做且无取消 |
| 清单与执行职责 | 通过 | [native.report.json](https://github.com/laoertongxue/higoods/blob/821b9ea54040ec03662acbe6ae3d2c62608fe273/docs/prototype-review-records/evidence/2026-10-10-post-finishing-qc/publication-2026-10-11/native.report.json)；focused-0-0-1366.png；清单只查询及打印 |
| 颜色图片、失败态及大图关闭 | 通过 | browser-contract.json；原 final35 图片契约按相同源码复用 |
| 当前后道关联存储事务及失败恢复 | 通过 | 39 项浏览器契约，含失败回滚、旧资料转换、多标签冲突及附件生命周期 |
| 交接数量、授权及日志 | 通过 | cross-terminal.json；15 条流程逐 SKU 和来源核对 |
| Web 与 PDA 页面和设备 | 通过 | native-screens / cross-terminal-screens；1366×768、1280×720、1024×768 与 PDA390×844；原 final35 完整入口证据保留原身份 |
| 打印版式 | 通过 | 当前五份统一质检 PDF、current-list-compat-print-page1.png；原 final35 九场景45份PDF及原图审查按相同源码复用 |
| 性能 | 通过 | 当前9入口470个样本最大509.9ms；当前仓库1366交互255样本最大298.7ms；原final35全33入口74组10595样本最大625.1ms，未变事件/模板依EVIDENCE-01保留原身份 |
| 构建、类型与专项 | 通过 | build.log：772项；typecheck-full.log：全项目0错误；domain-checks.json：8项专项 |
| 全站首次禁用 localStorage 的生产来源保护改造 | 不适用 | 需求范围排除该全站保护机制；历史完整故障审查仍为不通过，原文已原样归档，不据局部保存通过宣称全站解决 |
| 既有 SKU 重量保存迁移 | 不适用 | 本次未改重量保存动作，旧键 higood-post-finishing-sku-weights-v1 保留，需求已登记非范围 |

各行当前证据位于 evidence/2026-10-10-post-finishing-qc/publication-2026-10-11/；原完整证据位于其上级目录。技术验证只证明本地原型，用户数据仍归当前浏览器。

## 最终结论

结论：通过

仅针对本次用户确认的后道调整与 main 发布整合。仓库列表接入当前标准骨架，8页签×3尺寸的24组DOM全部一致，22组原图逐像素一致，另两组仅图片绘制区域差异且已查看原图。初次列表接入后Native资料脚本在第33项因window.pfCheck丢失中止；未修改应用或脚本，独立重跑39项通过，原失败保留；最终收据另绑定独立服务完整23项结果。历史完整故障审查“不通过”保留于 `evidence/2026-10-10-post-finishing-qc/historical-review-final35.source.txt`（SHA256 62383a79a40aeaf02ee5f4d7894fed8b6c0c093391d05d57096c9ff08312ba7b），不改成全站故障审查通过。GitHub 推送及 Vercel 部署结果由实际远端 SHA / Production 状态另行核对，本记录不预先声称已发布。

## 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/post-finishing-authorization.ts`
- `src/data/fcs/post-finishing-document-numbering.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/post-finishing-operation-log.ts`
- `src/data/fcs/post-finishing-qc-reference.ts`
- `src/data/fcs/post-finishing-records.ts`
- `src/data/fcs/post-finishing-spu-technical-parameters.ts`
- `src/main.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-post-finishing-exec-detail.ts`
- `src/pages/pda-post-finishing-flow.ts`
- `src/pages/pda-quality.ts`
- `src/pages/pda-sewing-self-return.ts`
- `src/pages/print/print-preview.ts`
- `src/pages/process-factory/post-finishing/audit-records.ts`
- `src/pages/process-factory/post-finishing/events.ts`
- `src/pages/process-factory/post-finishing/qc-orders.ts`
- `src/pages/process-factory/post-finishing/qc-workbench.ts`
- `src/pages/process-factory/post-finishing/recheck-orders.ts`
- `src/pages/process-factory/post-finishing/storage-notice.ts`
- `src/pages/process-factory/post-finishing/tasks.ts`
- `src/pages/process-factory/post-finishing/warehouse.ts`
- `src/pages/process-factory/post-finishing/work-order-detail.ts`
- `src/pages/process-factory/post-finishing/work-orders.ts`
- `src/pages/wls-finished-inbound.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/route-renderers.ts`
- `src/router/routes.ts`

### 页面证据

- 版本：工作树 /Users/laoer/.codex/worktrees/post-finishing-main-release/higoods；分支 codex/post-finishing-qc-main-release；基准 HEAD 4bb4fe1721a4c4ab85ac378ed555b841c31f9c19；运行文件集合 SHA256 0b2f0d2d4afad30bbccb44f33017303dc746acfea2c806c6dfd70d2cd4ed632b；dev43213，生产构建preview43212；Node26.8.2；Chromium149.0.7827.55；Asia/Shanghai。逐文件及上游差异见 integration-manifest-list-compat.json。
- 证据：[native.report.json](https://github.com/laoertongxue/higoods/blob/821b9ea54040ec03662acbe6ae3d2c62608fe273/docs/prototype-review-records/evidence/2026-10-10-post-finishing-qc/publication-2026-10-11/native.report.json)（23项全过、无跳过/失败/flaky），cross-terminal-list-compat.json（15条），browser-contract-list-compat-passed.json（39项），focused-performance-list-compat.json（470样本）；设备与实际命名路由均在报告。当前仓库1366交互255样本通过，见 warehouse-interactions-3-1366.json；仓库8页签×三设备DOM完整一致，原仓库事件处理器和详情模板字节未变，其他尺寸原交互证据依EVIDENCE-01保留原身份；补充全尺寸复测单独记录于 output/verification/post-finishing-main-publication。原 final35 全入口/全交互证据仍绑定原工作树8fb6、HEAD99e25a0、final35源哈希，不改标为当前HEAD；其中29个运行文件与当前字节一致；warehouse.ts 的标准列表接入另行复验，锁文件未变，受上游初始化/样式依赖影响的重点入口另用当前构建复测。

### 性能结论

- 结论：通过
- 依据：当前发布构建，9入口，每入口五次冷开/刷新/站内切换及适用大图关闭与PDF；470个样本全部<=1000ms、最大509.9ms、错误0；focused-performance-list-compat.json / focused-performance-list-compat.script.txt。其余未变化入口依 EVIDENCE-01 复用 final35 的74组10595样本（最大625.1ms），原始样本、时间、设备和失败历史完整保留。测量覆盖从事件开始至界面及图片稳定，未以Loading或均值替代门禁。

### 验证命令

- `npm run build`：通过
- `./node_modules/.bin/tsc --noEmit`：通过
- `node --import tsx scripts/check-post-finishing-full-flow.ts`：通过
- `node --import tsx scripts/check-post-finishing-full-flow-surface.ts`：通过
- `node --import tsx scripts/check-post-finishing-qc-colors.ts`：通过
- `node --import tsx scripts/check-post-finishing-qc-result-buckets.ts`：通过
- `node --import tsx scripts/check-post-finishing-default-demo.ts`：通过
- `node --import tsx scripts/check-post-finishing-flow-correction.ts`：通过
- `node --import tsx scripts/check-post-finishing-web-pda-fallback.ts`：通过
- `node --import tsx scripts/check-post-finishing-full-flow-traceability.ts`：通过
- `./node_modules/.bin/playwright test tests/post-finishing-full-flow.spec.ts tests/post-finishing-full-flow-cross-terminal.spec.ts --workers=1 --reporter=json`：通过
- `node /tmp/post-finishing-main-publication/focused-list-compat-runner.mjs`：通过
- `npm run test:workflow-governance`：通过
- `git diff --check HEAD -- . ':(exclude)docs/prototype-review-records/evidence/**'`：通过

### 发布整合变更与证据

warehouse.ts 仅把原 tableHtml / paginationHtml 返回对象改为局部渲染回调，使用相同标准组件、表格、分页和分支。不改检查器；8页签×3尺寸结果见 warehouse-compare.json。相关编号、保存、主管释放、PDA和下游仍由现有专项覆盖。

scripts/workflow-governance/affected-checks.ts 只精确登记本次两个Native路径，运行真实独立服务Playwright；tests/workflow-governance/affected-checks.test.ts先失败后通过，其他未知测试仍阻断；289项治理测试通过。负责SCOPE-001/PAGE-001。原始构建日志自带的行尾空格保留，不改原始证据；代码和说明文档的空白检查单独排除原始证据目录。

### 例外

- 无当前后道范围的性能或保存门禁豁免。全站生产来源保护、既有重量保存已在需求非范围登记；历史失败证据独立保留。用户页面接受尚未发生。
