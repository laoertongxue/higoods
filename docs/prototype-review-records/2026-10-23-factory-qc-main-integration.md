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
| 当前版本完整响应性能 | 不通过 | 首轮 365 样本有 3095ms 的 30 卷 PDF 和 1048ms 的 PDA 刷新。已修正 PDF 将外部 Python 内容审计计入响应的问题，并修复约 485ms 的静态 QC 查询扫描；后续实际 GTG 实收 CPU 剖析另定位约 1.6s 的全来源扫描，已改为按单读取。修复后正式性能仍待验收，不以负载解释删除慢值 |
| Git 发布 | 不通过 | 本地 main 已快进到 dd017f834184a6dc281ee9739cc56957f621c2e6。GitHub 推送、Actions 与正式 HTTPS SHA 仍待实际证据；允许先推送的性能例外已询问但尚未收到答复 |

## 最终结论

结论：不通过

本地合并已经完成，性能及发布尚未关闭。原 43 项技术收据、原 1505 单测及原 485 次响应采样保持原始绑定；合并阶段的 1669／1670 单测、47 项原生检查、32 项相邻页面、最新 5 项来源专项分别保留实际版本。最新完整构建／类型核验／性能／发布的完成状态以后续独立回执为准，未执行不记通过。

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
- 依据：采用项目 1000ms 门槛，首轮每族 5 次；超时和中断记录保留。后续采样遇主机负载约 54、CPU 空闲不足 1%、内存约 15GB 占用，仍不把超时自动删除或认定通过。已根据真实 CPU 调用剖析修复两处来源扫描；等待修复后可复现验收或用户明确先行发布例外。

### 验证命令

- 两次 `npm run build`：分别 1669／1670 单测、工程类型检查及 Vite 生产构建通过；完整日志 `qc-main-merge-build.log`、`qc-main-build-r2.log`。
- 9 个冲突涉及源码的渐进 TypeScript 检查：范围内 0 错误；全量范围外 20 项保留，不称全量类型检查通过。
- `node scripts/verification/run-quality-native-contracts.mjs`：44 项通过；3 项独立数据库测试修复依赖加载后重新执行通过；不改判原失败日志。
- `npx playwright test tests/post-finishing-main-integration.spec.ts tests/quality-management-print-ready.spec.ts tests/quality-inventory-generic-print-entry.spec.ts tests/quality-management-list-contract.spec.ts --workers=1 --reporter=json`：32 项通过。
- `node --import tsx --test tests/unit/factory-qc-scoped-source.test.ts tests/unit/factory-qc-lazy-static-read.test.ts`：5 项通过。

## 例外

- 最新 main 的 STORE-04 持续授权定向重建旧演示数据。本次仍遵循用户明确确认的“不删除已发生实物事实”；没有扩大原有旧洗水专属删除范围，没有动测试站数据库、用户真实浏览器或其他模块附件。
- 性能先行发布例外尚未获确认；不以已提交或本地合并代替验收通过。
