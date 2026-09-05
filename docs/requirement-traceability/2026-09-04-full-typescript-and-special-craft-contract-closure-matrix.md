# 全量 TypeScript 与特殊工艺契约闭环追踪矩阵

| 需求编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 产品确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SC-001 | 用户问题 2 | 确认“待绑定”在现行自动绑定规则下的真实产生条件 | WP1 | `src/data/fcs/cutting/special-craft-fei-ticket-flow.ts`、`scripts/check-cutting-special-craft-dispatch-return.ts` | 场景级断言通过 | 不适用：数据契约 | 已验证 | 专项输出：完整来源下待绑定数量为 0 | 用户 / 当前工作树 |
| SC-002 | 用户问题 2 | 专项覆盖真实待绑定边界或明确验证完整来源不产生伪待绑定 | WP1 | `scripts/check-cutting-special-craft-dispatch-return.ts` | `npm run check:cutting-special-craft-dispatch-return` 通过 | 不适用：数据契约 | 已验证 | 发料视图与绑定记录一一对应，原有五类状态断言保留 | 用户 / 当前工作树 |
| TS-001 | 用户问题 1 | 1502 个全量严格 TypeScript 错误清零 | WP2-WP3 | 243 个原报错文件及共享类型源 | `npm run typecheck` 通过，错误 0 | 不适用：静态类型 | 已验证 | `/private/tmp/higoods-ts-full-before.log`、`/private/tmp/higoods-ts-final.log` | 用户 / 当前工作树 |
| TS-002 | 用户问题 1 | 不通过关闭严格模式、扩大排除或 `@ts-nocheck` 绕过错误 | WP2-WP4 | `tsconfig.json`、全部修复文件 | 禁用标记扫描为 0；typecheck、lint、format、build 通过 | 不适用：治理门禁 | 已验证 | 本任务门禁均通过；后续项目级收据 `/private/tmp/higoods-wool-fix-receipt-final-20260905.json` 为 `verified`，阻塞项 0 | 用户 / 当前工作树 |
| SAFE-002 | 用户上一轮硬约束 | 类型与契约修复不改变现有业务逻辑和原型展示 | WP1-WP4 | 全部本轮文件 | 业务专项、15 项保留契约、10 项单测、构建、路由和治理检查通过 | 不适用：无用户可见变化 | 已验证 | `docs/prototype-review-records/2026-09-04-full-typescript-and-special-craft-contract-no-visible-impact.md` | 用户 / 当前工作树 |

状态仅使用：`待实施`、`实施中`、`已实现待验证`、`已验证`、`已阻塞`、`不适用`。
