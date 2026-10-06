# PCS 商品、物料与渠道店铺商品原型调整方案

版本：R1；方案日期 2026-10-05，实施记录更新至 2026-10-06。状态：**用户已授权执行；本地实现与验收进行中，尚未完整交付**。

本方案以用户已确认的 64 项决策和业务基线为约束，基准为 `main / 88324f65506f47c678b17d1b51879f8fd7c2488a`。当前实现保存在同一工作树的未提交差异中，本机 5173 为开发预览，5178 为构建验收预览。原有维护工具移除改动保留；没有提交、推送或部署。

查看当前结果先读 [实施进度](implementation-progress.md)、[验证证据说明](evidence/README.md) 和 [剩余验收清单](remaining-validation.md)。产品设计仍以 [方案正文](prototype-adjustment-proposal.md) 为准，字段和核对明细随查随用。

本轮方案包括17个页面/入口、337条目标字段契约、158条原子需求、10个实施工作包和41个验收场景；64项业务决策全部有去向。337条包含分类模板明细、只读引用和审计字段，不会堆成一个大表单。

| 文件 | 用途 |
|---|---|
| [产品原型调整方案](prototype-adjustment-proposal.md) | 领域边界、对象关系、页面、字段分组、操作、状态、校验、编码、单位、成本、渠道同步、关键场景 |
| [字段字典](field-dictionary.csv) | 逐字段的归属、必填、类型、默认值、单位、维护位置、校验与变更规则 |
| [原型字段处置表](prototype-field-disposition.csv) | 将上一轮盘点的 403 个现有字段逐项对应为保留、迁移、合并、移出或删除 |
| [线上信息承接表](online-information-coverage.csv) | 69 组已观察线上信息的目标位置及本期处置；保留原始证据，不等同于已完成数据迁移 |
| [原子需求追踪矩阵](requirement-traceability.csv) | 158条逐项连接来源、实际实现与证据；当前29条已验证、127条已实现待验证、2条已阻塞，不用累计测试数替代逐项完成 |
| [64 项决策覆盖表](decision-coverage.csv) | A01—F07 到方案与原子需求的双向索引 |
| [实施工作包及验收场景](implementation-and-validation-plan.md) | 调整次序、文件范围、删除收口、演示数据、正常和边界验收 |
| [设计阶段现状证据](current-prototype-evidence.md) | 2026-10-05设计时的观察，保留历史事实，不作为当前实现验收 |
| [文档一致性检查](document-validation.md) | 文档数量、引用与来源保留检查；不作为业务测试或页面验收 |
| [当前需求证据索引](current-requirement-evidence.json) | 按需求编号关联本次实际执行的测试名称、日志位置、页面范围及限制 |
| [原型审查记录](../../prototype-review-records/2026-10-06-pcs-product-material-channel-r1.md) | 当前版本的页面、业务防错和性能审查；结论未通过完整交付门禁 |

业务来源保持原文：

- [业务基线与关键场景](../2026-10-04-product-material-domain-audit-v2/confirmed-rules-and-refinements.md)
- [64 项决策登记](../2026-10-04-product-material-domain-audit-v2/decision-register-2026-10-05.md)
- [字段归属、单位 Tab 与渠道字段设计](../2026-10-04-product-material-domain-audit-v2/field-contract-candidates.md)

正文使用“已确认”标注上述业务规则，使用“本方案定案建议”标注本轮为形成可执行方案而补齐的参数。后者可以随本方案一起审议，不能倒写成用户之前已逐字确认的要求。真实平台接口、独立站实际身份及线上字段来源尚未验证的内容列在正文末尾，不用模拟回执冒充真实平台能力。
