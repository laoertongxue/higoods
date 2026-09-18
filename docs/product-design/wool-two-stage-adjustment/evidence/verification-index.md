# 毛织两阶段当前验证索引

当前轮次：2026-09-19。以 [500ms 收口记录](./acceptance-500/final-verification.md)、[最终源码清单](./acceptance-500/final-source-manifest.json) 和 [需求矩阵](../requirements.md) 为准。本轮实现与内部验收已通过：126条已验证，47个不同业务浏览器用例、266单元及3695性能样本均取得通过证据。

- 基准 HEAD：`4ea0f03d81035608e3c9f4afe7933013ab28a57b`；本轮未提交增量单独由源码摘要固定，不以 HEAD 代替增量版本。
- 工作树：`/private/tmp/higoods-wool-main-release-20260918`；分支：`codex/wool-main-release-20260918`。
- 性能预览：`http://127.0.0.1:4198`；功能测试开发服务：`http://127.0.0.1:5198`。同一工作树与冻结源码。
- 设备：管理端1366×768/1280×720，主管1024×768，PDA360×800/400×806；隔离Chromium上下文，不清用户数据、不写线上系统。
- 用户已确认常规500ms、偶尔部分重页面不超过1s。本轮明确例外只有PDA任务队列冷进入≤1000ms；其他加载及交互<500ms，错误或缺图均失败。
- 业务场景A01—A20对应 [场景补齐表](./acceptance-500ms/business-gap-coverage.md)；交互覆盖见 [入口清单](./remaining-action-coverage.md)。
- [增量对抗式审查](./acceptance-500/adversarial-review.md) 及最终运行验收均已通过，详见收口记录。

## 历史证据

[2026-09-18 首轮验证索引](./verification-index-20260918.md) 保留当时200ms门禁失败、旧源码/构建及开放项原文。其375个加载样本与89项旧交互记录不作为当前版本通过证明；历史原始JSON与日志不覆盖。此前main发布记录只证明此前提交，本轮未提交增量尚未发布。
