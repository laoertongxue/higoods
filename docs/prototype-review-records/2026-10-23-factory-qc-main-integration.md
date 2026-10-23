# 印花／染厂 QC 与定型机手感合并 main 集成记录

依据 `AGENTS.md` 的 SCOPE-02、TRACE-01、REVIEW-01、PERF-01、EVIDENCE-01、RELEASE-01。继承[已确认方案及原实施审查](2026-10-22-factory-qc-stenter-handfeel.md)；本记录处理 main 合并及其后发现的查询性能问题，不修改业务需求，不将原技术收据改写成当前版本证据。

## 基本信息

- 日期：2026-10-23
- 任务 / 需求编号：RQ-001～RQ-060、ATM-001～ATM-135、AC-001～AC-048；main 合并与发布
- 验证人：Codex 主代理；工厂现场和用户接受未执行

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：整合 main 的通用质检、后道及库存功能；协调共享来源、数据库 v4、PDA 读取与路由；修复单笔质检／手感命令扫描无关来源的性能问题。发布与技术通过分别记录。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 原已验证成果独立提交 | 通过 | 原 148 路径冻结清单逐字节相符后提交为 92f502e6；147 个 Git 变更项包含一次文件重命名 |
| main 原有质检、后道、库存、图片和导航 | 通过 | 整合 44996d48；32 项实际页面集成检查通过、无跳过／失败；保留原入口、失败重试与 PDA 责任边界 |
| 共用数据库和附件 | 通过 | 采用 main 的 v4；完成卷不可变保护及退役规则同时保留。原生检查 44 项通过；3 项独立数据库用例补充真实依赖加载后通过，原失败日志保留 |
| 并发读取与部分来源读取边界 | 通过 | 完整来源读取去重与 main 的后道有界读取共存；已交出／后道实收页面读取新的加工事实桥，实际写入仍准备完整来源。相邻单测已进入 1669／1670 项完整构建 |
| 单张 QC 查询 | 通过 | 已保存 QC 直接读取；未产出的手感 QC 返回空，不枚举无关静态来源；普通演示 QC 查询仍可用。3 项实际函数契约通过 |
| 单笔操作按来源读取 | 通过 | 印花、染色、水溶使用原模块 getter 读取当前单；完整列表及来源发现仍保持完整。5 项专项通过，包括三类实际领域来源与完整集合投影一致、后续原事实改变后读取新值、未知来源为空 |
| 旧洗水正式对象与入口 | 通过 | main 对旧洗水读取的改动转到新加工事实桥；旧专属文件及相应旧测试退役，新只读边界契约替代。原正式退役证据保留其版本，未清理真实用户浏览器 |
| 真实图片和打印防错 | 通过 | 32 项相邻页面检查覆盖两套 QC 打印、实际图码、坏图阻断与重试、库存打印冷开及刷新；手感模板未因本次查询修复改变 |
| 上游加工单列表初始化竞态 | 通过 | 首次 Production c2b36c6b 核验实际捕获采购供应商档案在 PCS 准备前求值的异常。两个上游列表现保留 QC／PCS／FCS 读取并跳过其不消费的采购初始化；真实 renderCurrentPageContent 契约先失败、修复后与相邻契约共 22 项通过。修复后固定本地生产资产下，染色冷开、印花冷开、染色再次进入、随后进入面辅料采购共 4 项页面无异常且全部首屏图可读。此处仅记录本地修复验证，正式重发另以回执为准 |
| 当前版本完整响应性能 | 不通过 | 首轮 365 样本有 3095ms 的 30 卷 PDF 和 1048ms 的 PDA 刷新。已修正 PDF 将外部 Python 内容审计计入响应的问题，并修复约 485ms 的静态 QC 查询扫描；后续实际 GTG 实收 CPU 剖析另定位约 1.6s 的全来源扫描，已改为按单读取。修复后正式性能仍待验收，不以负载解释删除慢值 |
| Git 发布 | 不通过 | 文档规范后的 c2b36c6bc8b3804a74446fe9d124cb7f11105e48 已在本地／GitHub main、Actions 39874071441 与正式 HTTPS 一致，1672 单测及 54 部署契约通过。正式页面进一步捕获并局部修复上游列表初始化竞态；本次修复后的最终 SHA、Actions 与 HTTPS 另写回执；用户于本会话明确确认“允许先推送，性能未验收”；发布按此例外执行，最终 SHA／Actions／HTTPS 状态另写回执 |

## 最终结论

结论：不通过

本地合并已经完成，性能尚未验收；用户已明确允许先推送。发布结果须以实际远端及部署回执为准。原 43 项技术收据、原 1505 单测及原 485 次响应采样保持原始绑定；合并阶段的 1669／1670 单测、47 项原生检查、32 项相邻页面、最新 5 项来源专项分别保留实际版本。最新按来源读取修复的 Vite 生产构建已通过（主机高负载下耗时 8m29s），5 项专项通过；最新全量单测／类型／发布状态以后续独立回执为准，性能保持未验收，未执行不记通过。

## 变更覆盖与验证

### 受管文件

原 148 路径由继承的实施审查逐项覆盖。本次合并冲突、测试依赖和性能修复的直接文件如下；没有新增业务对象、状态或前置门槛。

- `src/data/fcs/production-context-records.ts`
- `src/data/pcs-record-db.ts`
- `src/data/pcs-technical-data-demo-projection.ts`
- `src/data/fcs/factory-qc-records.ts`
- `src/data/fcs/factory-qc.ts`
- `src/main.ts`
- `src/router/route-renderers.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`
- `tests/browser-contracts/pcs-record-db.test.ts`
- `tests/unit/craft-entry-initialization.test.ts`
- `tests/unit/craft-read-entry.test.ts`
- `tests/unit/production-context-hydration-concurrency.test.ts`
- `tests/unit/pda-shipped-factory-process-read-scope.test.ts`
- `tests/unit/pda-shipped-washing-read-scope.test.ts`
- `tests/unit/factory-qc-lazy-static-read.test.ts`
- `tests/unit/factory-qc-scoped-source.test.ts`
- `scripts/verification/factory-qc-fault-preview.mjs`
- `scripts/verification/factory-qc-preview.mjs`

### 页面证据

- 版本：工作树 `/Users/laoer/.codex/worktrees/941b/higoods`；原运行集成版本 07166143、查询修复 c8e3f3ea、按来源读取修复 dd017f83；main 治理提交 3346f08b 同时保留。实际预览 `http://127.0.0.1:43223`，相邻真实页面服务 `43224`；证据各自记录运行资产，不以源码分支名替代资产身份。
- 证据：`output/qc-main-publication-20261023/`；`integration-baselines.json`、`factory-qc-formal/results.json`、`factory-qc-formal-r2/results.json`、`factory-qc-final/results.json`、`pda-cpu-diagnostic/results.json`、`receive-profile/receive.cpuprofile`、`post-integration/main-integration-browser/`；原始命令日志在同次 `/tmp/qc-main-*`，后续归档不覆盖原结果。

### 性能结论

- 结论：不通过
- 依据：采用项目 1000ms 门槛，首轮每族 5 次；超时和中断记录保留。后续采样遇主机负载约 54、CPU 空闲不足 1%、内存约 15GB 占用，仍不把超时自动删除或认定通过。已根据真实 CPU 调用剖析修复两处来源扫描；本次按用户明确确认先行发布，性能持续标记未验收。

### 上游入口发布复核修正

本项属于原需求的直接上游读取与发布核验，不改变 QC 建单、质检、整单手感决定或实物交接条件。对象为 `src/main.ts` 中两个加工单列表的初始化条件，以及执行实际页面入口函数的既有契约。此前新增 QC 来源准备先启动了限定 PCS 读取，随后旧有并行采购模块初始化可能在完整 PCS 准备前求值并抛错；页面仍显示不能作为无异常证据。现仅排除两个列表不消费的采购初始化，保留其 QC／PCS／FCS 顺序，后续进入采购页仍按原流程准备真实采购目录。

原线上异常及堆栈保留在 `output/qc-main-publication-20261023/focused-upstream.json`；最小失败在 `qc-main-upstream-before-r2.log`，修复后 22 项契约在 `qc-main-upstream-fixed-unit.log`。`npx vite build` 成功（1m2s）；固定产物、源文件及资产哈希在 `upstream-runtime-manifest.json`，真实 4 项页面在 `upstream-local-audit.json`。未动供应商资料、采购代码或持久事实，未将此页面复核当作 1 秒性能验收。

71c190fa 的云端全量单测为 1671 通过／1 失败，失败来自入驻条件隔离测试的局部夹具没有声明新增的 `factorySourceListEntry`；运行时代码及本地生产页面验证不受该夹具影响，失败未发布覆盖正式站。现仅在该既有夹具补齐局部值，保留全部原有断言；与两个来源列表实际入口、后续采购、来源读取相邻契约共 32 项重新通过（`qc-main-upstream-fixture-fixed.log`）。失败云端日志 `actions-39880898425-failed.log` 原样保留，不将失败改写为通过；后续云端完整结果单列回执。本次夹具修正不改变 `src/`、产物或页面，继续复用原本地固定资产页面证据。

### 验证命令

- `npm run build`：通过
- `npx vite build`：通过
- `node --import tsx --test tests/unit/craft-read-entry.test.ts tests/unit/craft-entry-initialization.test.ts tests/unit/factory-qc-scoped-source.test.ts tests/unit/factory-qc-lazy-static-read.test.ts`：通过
- `node --import tsx --test tests/unit/craft-entry-initialization.test.ts tests/unit/factory-qc-scoped-source.test.ts tests/unit/factory-qc-lazy-static-read.test.ts`：通过
- `npx playwright test tests/post-finishing-main-integration.spec.ts tests/quality-management-print-ready.spec.ts tests/quality-inventory-generic-print-entry.spec.ts tests/quality-management-list-contract.spec.ts --workers=1 --reporter=json`：通过
- `node --import tsx --test tests/unit/factory-qc-scoped-source.test.ts tests/unit/factory-qc-lazy-static-read.test.ts`：通过

上述两次完整构建分别为 1669／1670 单测、工程类型检查及 Vite 通过；32 项页面和 5 项专项分别保留实际运行版本及日志，不因文档提交变更而改写身份。9 个冲突涉及源码的渐进 TypeScript 检查范围内 0 错误，全量范围外 20 项保留。原生检查的初次 44 项通过及 3 项依赖修复后的重新通过在自查表和原始日志中分别登记，不把原失败改写成一次全通过。

发布前以本任务完整分支差异重新运行原型设计及列表治理检查。初次输出指出本节命令结果未按固定格式填写，现已补正；本记录仍明确保留最终结论及性能“不通过”，因此治理检查不应被冒称通过。用户的先行推送授权仅用于本次发布，不修改检查器、性能门槛或原始结果，最终治理退出值另存发布回执。

## 例外

- 最新 main 的 STORE-04 持续授权定向重建旧演示数据。本次仍遵循用户明确确认的“不删除已发生实物事实”；没有扩大原有旧洗水专属删除范围，没有动测试站数据库、用户真实浏览器或其他模块附件。
- 用户于本会话明确确认：“允许先推送，性能未验收”。仅据此先行推送与核验部署；不称当前性能或整体产品技术验收通过。保留全部慢值、失败和中断记录，原验收门槛不被修改。
