# 项目工程与历史文件清理需求追踪矩阵

| 需求编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 产品确认人和版本 |
|---|---|---|---|---|---|---|---|---|---|
| CLEAN-001 | 用户 2026-09-04 执行指令 | 清理已确认可重建且被 Git 忽略的本地产物 | WP-01 | 忽略目录与根目录临时文件 | 目标路径检查、`git status` | 不适用：不改变页面源文件 | 已验证 | `2026-09-04-project-cleanup-verification.md` 第 2 节 | 用户；工作树 `4f571836` |
| BUG-001 | 2026-09-04 审查结论 | 正常长度和卷数文本必须解析出数值，不得静默返回 0 | WP-02 | `src/helpers/fcs-claim-dispute.ts` | `npm test`，3/3 通过 | 裁片单详情差异页签通过 | 已验证 | 原型审查记录、专项测试 | 用户；工作树 `4f571836` |
| TYPE-001 | 2026-09-04 审查结论 | TypeScript 必须支持项目现行 `.ts` 扩展导入并提供明确检查入口 | WP-02 | `tsconfig.json`、`tsconfig.engineering.json`、`package.json` | 渐进检查通过；全量剩余 1567 项已记录 | 不适用：工程门禁 | 已验证 | `2026-09-04-project-cleanup-verification.md` 第 3 节 | 用户；工作树 `4f571836` |
| UI-001 | 2026-09-04 审查结论 | UI 统一出口不得导出两个同名 `renderSkeletonCard` | WP-02 | `src/components/ui/card.ts` | 渐进类型检查、构建通过 | 命名页面正常渲染 | 已验证 | 原型审查记录 | 用户；工作树 `4f571836` |
| TEST-001 | 2026-09-04 审查结论 | 默认 `npm test` 必须运行明确、稳定的测试目标 | WP-02 | `package.json`、`tests/unit/` | `npm test`，3/3 通过 | 不适用：默认工程入口 | 已验证 | `2026-09-04-project-cleanup-verification.md` 第 3 节 | 用户；工作树 `4f571836` |
| DOC-001 | 用户 2026-09-04 执行指令 | 文档必须有现行、证据、历史待清理的入口索引 | WP-03 | `docs/INDEX.md` | 路径与引用检查通过 | 不适用：文档治理 | 已验证 | `docs/INDEX.md` | 用户；工作树 `4f571836` |
| DOC-002 | AGENTS.md 3.1、用户执行指令 | 现行脚本不得读取已禁用的 `docs/superpowers/`，迁移事实后删除该目录 | WP-03 | 两个检查脚本、现行文档、删除 `docs/superpowers/` | 运行时引用为 0；毛织检查通过；库位检查在后续既有断言失败 | 不适用：文档及检查治理 | 已验证 | `2026-09-04-project-cleanup-verification.md` 第 4、5 节 | 用户；工作树 `4f571836` |
| REPO-001 | 用户 2026-09-04 执行指令 | 运行状态和历史输出不得继续作为源码文件维护 | WP-04 | 删除 `data/state_store.db/`、`outputs/`；更新 `.gitignore` | 路径检查、构建通过 | 不适用：不属于运行页面资源 | 已验证 | `2026-09-04-project-cleanup-verification.md` 第 2 节 | 用户；工作树 `4f571836` |
| REPO-002 | 用户 2026-09-04 执行指令 | 只删除已确认无现行调用的孤立脚本和旧设计文件 | WP-04 | 删除 9 个脚本、2 个旧 HTML、禁用 `.trae` 内容 | 242 个 package 脚本文件引用无缺失；15 个保留契约通过 | 不适用：删除前确认非运行页面 | 已验证 | `2026-09-04-orphan-script-audit.md` | 用户；工作树 `4f571836` |
| KEEP-001 | 2026-09-04 审查结论 | 保留原型审查记录、需求矩阵、产品需求和真实图片 | WP-04 | `docs/prototype-review-records/`、`docs/requirement-traceability/`、`public/` | 最终分别为 182、14、36 个文件 | 不适用：保留门禁 | 已验证 | `2026-09-04-project-cleanup-verification.md` 第 2 节 | 用户；工作树 `4f571836` |
| VERIFY-001 | AGENTS.md 7、8.1 | 最后一次实质修改后重新运行相关检查、构建、治理和 CodeGraph 状态核验 | WP-05 | 全任务范围 | 任务收据状态 `verified`、blockers 0；CodeGraph 无待同步项 | 裁片单与差异页签通过 | 已验证 | `2026-09-04-project-cleanup-verification.md` | 用户；工作树 `4f571836` |
