# 毛织两阶段当前进展合入 main

本次操作依据用户在已获知性能与完整验收尚未通过后，明确提出的“本地合并进 main，并推送至 github main”。此授权用于发布当前代码进展；原需求矩阵和性能门禁均不改为通过。

## 合并来源

- 毛织任务提交：`ee7b1b1a38d05aee42f6471cc2f0c6b35a70cb4b`。
- 合并前 main：`163bd398d10d615d01245419599d335f0b76fa2a`，包含技术包表格/Tab 和 DDS 生产履约时效并行改动。
- 合并工作树：`/private/tmp/higoods-wool-main-release-20260918`。
- 使用合并保留双方提交；没有覆盖原始 `/Users/laoer/Documents/higoods` 工作区或其他任务的未提交修改。
- 需求范围仍为 requirements.md 中的 126 条；合并动作不使任何未验证条目自动通过。

## 冲突处理

1. `src/main.ts` 保留 main 的物料事件桥、DDS 和技术包 Tab 局部刷新，同时保留毛织阶段事件、PDA 返回、页面按需加载和二维码按需加载。
2. `post-finishing-full-flow.ts` 和 `post-finishing-operation-log.ts` 使用毛织分支已经审查的演示批量提交与失败回退逻辑，覆盖 main 同一位置的较早批量持久化实现；实际业务仍即时保存。演示数据及场景不删减。
3. 两个技术包文件中自动合并出现的重复 `pieceInstances` 字段只保留一份独立副本逻辑，同时保留 main 的局部读取优化、附件/颜色数量深复制及毛织逐片字段。
4. 菜单和加工单关系自动合并后保留 DDS 入口、运行任务关系及毛织双阶段关系。

## 验证边界

- 源分支提交前 workflow:verify 的八组命令全部退出 0：毛织、裁床、FCS 端到端、菜单、原型治理、列表治理、17 条毛织 E2E 和构建。
- 源收据状态为 implemented：CodeGraph 索引指向原始工作区，与任务工作树不匹配。不能称为 verified 收据。
- 合并后后道演示批量提交/失败恢复专项、技术包局部读取独立副本单元检查已通过；最终合并检查收据和日志保存在 `/private/tmp/wool-main-publication/`。
- `evidence/` 中此前的 31 条浏览器功能回放和三份性能报告属于当时冻结构建。当前合并版需要用本次合并检查辨认，旧报告不作为合并版性能通过证据。
- 已知性能和完整覆盖仍未通过；不声明整体需求完成、产品接受或 Vercel 部署成功。

GitHub 发布结果由本次推送后的本地 main、origin/main、ls-remote 与 GitHub API 提交号一致性核查确认。
