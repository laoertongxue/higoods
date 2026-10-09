# 款式描述与尺码资料交付矩阵

来源：`style-archive-description-size-chart-requirements.md` 对应同名条目。产品确认人：用户（需求确认）；上一版简化实现的证据不满足本轮线上一致要求；助手已完成本地验证，当前版本尚待产品接受，不能当作 accepted。基线 HEAD：`155144308f6b2931a8acb229a579e04ec99af41d`，本地任务 diff。

| 编号 | 原子需求 | 工作包 | 实现位置／符号 | 自动化验证 | 页面／性能验证 | 状态 | 证据 | 产品确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DESC-001 | 默认描述有信息，保留已保存及明确清空 | WP-DESC | defaultStyleSalesContent、normalizeRecord、buildStyleFixture、静态款式 baseline | pcs-style-size-chart.test.ts | 编辑首次打开、详情／多语言读回 | 已验证 | output/playwright/style-content/online-parity/final/summary.json；7 项专项 | 用户确认需求；助手本地验证，产品接受待确认 |
| DESC-002 | 格式及源码编辑，过滤不安全内容 | WP-DESC | renderStyleRichEditor、styleContentHtml、rich-format/source | HTML／转义专项 | 主描述、工厂表及国家描述；格式操作、源码和字体颜色五轮保存读回 | 已验证 | output/playwright/style-content/online-parity/final/summary.json、acceptance.js、extra.js、format-persistence.js | 用户确认需求；助手本地验证，产品接受待确认 |
| SIZE-001 | 工厂尺码表独立维护 | WP-SIZE | factorySizeChartHtml | 默认独立性专项 | 空值、编辑、应用、刷新 | 已验证 | output/playwright/style-content/online-parity/final/summary.json、acceptance.js、extra.js、format-persistence.js | 用户确认需求；助手本地验证，产品接受待确认 |
| SIZE-002 | 14 原图、372 尺码、41 参数及线上属性选项 | WP-SIZE | createStyleSizeChart、renderStyleSizeChartTool | 结构／去重专项 | 全部示意图、完整选项、折叠及多选、选后生成 | 已验证 | output/playwright/style-content/online-parity/final/summary.json、acceptance.js、extra.js、format-persistence.js | 用户确认需求；助手本地验证，产品接受待确认 |
| SIZE-003 | 无选择/空值阻断，支持范围/free，国家插入不重复 | WP-SIZE | validateStyleSizeChart、applyStyleSizeChart | 空选择／空值／范围／free／保留其他表格专项 | 无效预览与重复应用 | 已验证 | output/playwright/style-content/online-parity/final/summary.json、acceptance.js、extra.js、format-persistence.js | 用户确认需求；助手本地验证，产品接受待确认 |
| IMAGE-001 | 生成、重新上传、查看尺码图片 | WP-IMAGE | generateStyleSizeChartImage、sizeChart upload、image actions | Blob／文件引用浏览器检查 | 图片生成、上传、三种关闭方式、刷新 | 已验证 | output/playwright/style-content/online-parity/final/summary.json、acceptance.js、extra.js、format-persistence.js | 用户确认需求；助手本地验证，产品接受待确认 |
| SAVE-001 | 原子保存、失败恢复、多语言及冲突 | WP-SAVE | save、runPcsRecordCommand | IndexedDB 读回／故障注入 | 无 localStorage 业务保存；超限失败、重试、两标签页五轮冲突 | 已验证 | output/playwright/style-content/online-parity/final/summary.json、acceptance.js、extra.js、format-persistence.js | 用户确认需求；助手本地验证，产品接受待确认 |
| PERF-001 | 加载和全部受影响交互五轮≤1s | WP-VERIFY | acceptance.js | 原始样本阈值判定 | 1366×768、1280×720、冷／刷新／SPA | 已验证 | output/playwright/style-content/online-parity/final/summary.json；6023 样本，最大819.4ms；attempt*.json 保留早期失败 | 用户确认需求；助手本地验证，产品接受待确认 |

PDA、打印：不适用，本次没有新建或修改 PDA／打印入口；工厂资料不自动改写技术包或打印映射。旧存储迁移与数据库升级：不适用，本次新增可选记录字段，未修改数据库结构与迁移流程。

最终完整选项门禁使用第 5～9 轮；最后字体保存修正后，针对受影响的格式、HTML 过滤、六个描述编辑区、图片和保存动作补测第 10～14 轮，并重新测量三条路由冷进入／刷新五轮。字段字典和原始图片资源未发生变化。每项只以适用的当前实现及其回归证据判定，不以之前简化版证据判定。最后变更为字体格式保存，不改变字典、示意图或测量矩阵。
