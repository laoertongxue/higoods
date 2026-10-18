# 工艺加工单列表加载边界修复

依据 `AGENTS.md` 的 SCOPE-02、TRACE-01、REVIEW-01、PERF-01、EVIDENCE-01 和 RELEASE-01；使用 `docs/prototype-review-record-template.md`。

## 基本信息

- 日期：2026-10-18
- 任务 / 需求编号：CAP-LIST-01～CAP-LIST-06
- 验证人：Codex；技术验证不代填用户接受
- 阶段：T4受限路由与构建预加载调整；T5新正式发布独立后验，不改前两阶段冻结报告或失败证据。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：16类加工单列表的页面加载入口与对应HTML预加载静态闭包；原详情和其他路由继续原包装器，业务数据和必要PCS/FCS初始化顺序不变。

## 需求、事实与边界

用户原报错的能力派生编号误冲突已由f5943ca6修复。9611c893已快进main并正式发布，run39094076603成功，888个未压缩资源清单吻合；其总览5次最大184.1ms、工厂档案最大289.9ms。正式烫画第2个有效冷入口为1158.1000000238419ms，打条有995.4/990.2ms近限样本；原件在output/playwright/craft-overview-startup-boundary/formal-9611c893/result.json，保持passed=false，不由新诊断覆盖。

单次独立正式瀑布在相同版本完成500.9ms，只用于诊断。页面加载61个JS（约3.02MB解码），存在119ms长任务；其中route-renderers-fcs约81.8KB仍被HTML预加载。单次较快诊断不能确定原1158.1ms的具体根因。源码确认受限列表在main完成必要PCS/FCS恢复后，仍通过通用包装器再调用原task-orders renderer；包装器对该导出没有附加hydrate/权限/PDA/打印分支。因此仅省去16类LIST无附加业务价值的包装及其预加载，以降低启动成本；不改变source恢复、数据规模、真实完成终点、Factory guard、列表内容或动作。详细数据/打印/毛织/相邻入口保持原实现。

范围为src/router/routes.ts受限列表分支、vite.config.ts该LIST预加载种子及两份直接契约；详情仍使用原route-renderers-fcs及其预加载。未知工艺、嵌套路由与相邻页面保持原注册表。用户原43183标签及资料因浏览器策略不读取；验证只用独立context和既有自造原生存量。无测试站数据库连接或用户资料清理。

## 计划与原子矩阵

1. 使用实际resolvePage函数和实际Vite预加载函数建立最小失败契约，覆盖16个正式工艺及详情、查询/解码、未知/相邻、模块失败。
2. 列表直接await原task-orders owner，详情保留原包装器；只从LIST的预加载种子去掉包装器。
3. 构建并核对所有16类列表和两相邻页面；实际总览→列表的empty/saved/invalid与刷新回读不回退；覆盖受影响真实设备和每家族5个有效样本。
4. 两轮实质审查、冻结技术收据通过后，按已有授权快进main、推送、部署并全量正式复核；旧失败保持身份。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / 性能证据或理由 | 状态 | 证据位置 | 确认人和版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CAP-LIST-01 | 正式失败、当前源码 | 16个具名列表调用原owner，移除无附加规则包装器 | 路由 | routes.ts / resolvePage | 实际函数16列表及异常契约 | 内容/动作仍原owner | 已验证 | red-contract.log、green-contract.log、build.log及actual source diff | Codex，9611c893+当前5路径差异 |
| CAP-LIST-02 | 真实网络依赖 | LIST预加载保留原owner/初始化/图片/基线，删除包装器种子 | 预加载 | vite.config.ts / preloadStaticFirstScreenRoutes | 实际生成脚本、静态闭包与副作用反例 | 实际资源字节与模块请求 | 已验证 | 真实预加载AST契约、local/result.json资源body | 同上 |
| CAP-LIST-03 | 来源与边界 | 详情/未知/相邻/错误、必要PCS/FCS和动作不改变 | 边界 | 原main、registry、owner及handler | 相邻、模块失败、原初始化契约 | empty/saved/invalid真实界面读回 | 已验证 | 26专项；navigation-local/result.json | 同上 |
| CAP-LIST-04 | UI-01、PERF-01 | 当前版本具名设备与真实完整响应通过 | 页面 | 16列表、总览/profile相邻入口 | 版本/数量/原生存量/资源 | 19家族各5样本；原失败保留 | 已验证 | local/result.json（131场景、95原值，最大324.9ms） | 同上；正式另验 |
| CAP-LIST-05 | 用户要求 | 两轮实质对抗审查，文件冻结并运行收据 | 审查 | 本次5路径 | 完整diff、反证与原件绑定 | 不预填后续机器结果 | 已实现待验证 | R1/R2实质审查均已通过；文档封印及冻结收据后验，由final-delivery.json登记 | 同上 |
| CAP-LIST-06 | 既有发布授权 | main/GitHub/Caddy同版，全16类正式核对通过 | T5 | 后续发布与页面原件 | SHA/run/清单/真实页面 | 新正式5样本各家族 | 待实施 | final-delivery.json，发布后实际登记 | 同上 |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 列表owner及预加载 | 通过 | 原owner直接调用，LIST删除wrapper显式种子；16路由/详情/未知/异常及真实静态闭包反例通过 |
| 来源、页面和性能 | 通过 | 当前本地131场景、95值最大324.9ms；3种原生存量读回通过；旧正式1158.1ms仍保留false，新正式另验 |
| 两轮审查 | 通过 | R1/R2独立实质审查均0阻断；R2核41件原件、真实HTML静态闭包和完整运行日志，最后文档增量另封印 |
| PDA、打印、数量、金额 | 不适用 | 本次不改这些owner、数据或动作；原主入口必要恢复和相邻契约仍须验证 |

## 最终结论

结论：通过

CAP-LIST-01～04及05的双轮实质审查组成的T4产品阶段通过；主代理已检查完整5路径diff、真实页面截图和原件，未关闭产品代码问题0。CAP-LIST-05尚待的最终文档封印/冻结技术收据与CAP-LIST-06新main/GitHub/Caddy/正式全量性能，由独立output/verification/craft-list-owner-isolation/final-delivery.json逐项后验关闭；未满足时不宣称完整交付。旧正式1158.1ms及更早1257.1ms保持失败原身份，不由本地通过或单诊断关闭。技术验证不代填用户接受。

## 变更覆盖与验证

### 受管文件

- `src/router/routes.ts`
- `vite.config.ts`
- `tests/unit/craft-direct-route.test.ts`
- `tests/unit/craft-route-preload.test.ts`
- `docs/prototype-review-records/2026-10-18-craft-list-owner-isolation.md`

### 页面证据

- 版本：9611c893 + 当前5路径差异；output/verification/craft-list-owner-isolation/asset-version.json绑定1386源文件和1220产物，Node26.8.2，本地同工作树生产预览43185，Chromium155.0.8059.80、1366×768/1280×720/1024×768、Asia/Shanghai、zh-CN，无CPU/网络降速。
- 证据：output/playwright/craft-list-owner-isolation/local/result.json及collector.log：18入口（16类加工单+总览/档案）、131场景全部passed=true；95个原始有效样本、36布局场景；标题/记录总数/当页min(total,10)行、单工厂显示、图片解码、可交互、无溢出、运行/请求/控制台错误均已核对。工厂编辑器保留缝边绣/模板工序/普通绣花，取消零工厂主源写且刷新回读一致；1024压褶真实滚动并解码实物图。
- 当前首批实际资源84件均按真实response.body哈希核对，资源集合没有route-renderers模块；这仅说明这些具名冷入口实测，不把保存业务的必要handler依赖错误禁止。全1386源/1220产物由asset-version固定。
- 原生存量：navigation-local/result.json及日志，3个新context实际先开总览，再用现有侧栏点击打揽加工单；empty正常静态事实、saved标记INIT-EFFECTS-READ-001由真实owner首次及reload读回；故意invalid阻断正常页面并保持原records/commands/meta，显式修复隔离夹具后真实reload恢复（该页原来没有重读按钮，未虚构按钮）。普通owner0写、factoryraw3处都字节不变；只作功能证据，不用该脚本声明<=1000ms。未人工import恢复状态。
- 截图local/list-1366-cold.png、list-1280-layout.png、list-1024-layout.png、profile-editor-merged.png及pleating-1024-scrolled-image.png。主代理实际查看1366列表、1024列表及工厂编辑器；原列表owner、图片与动作代码没有改动。
- 既有profile的PDA用户/角色种子副作用保持原实现；不把工厂主源和普通owner零写扩张为整个localStorage零写。原43183标签未读，独立环境只用已有自造fixture。
- 原正式1158.1ms及500.9ms单诊断保持原件和版本；总览/profile正式已过样本保持9611身份，不充作当前产物正式验收。

### 性能结论

- 结论：通过
- 依据：当前本地19家族各5有效样本共95，最大324.90000009536743ms，全部原值在local/result.json；131场景包含36设备布局，布局不冒充性能重复。16列表分家族，总览/档案冷入口及总览刷新独立家族。旧正式1158.1ms保持有效失败，T5新正式另验。
- 起终点：与前两阶段已核读v5相同，导航起点0；页面内MutationObserver在应用前安装，目标标题/真实数量/必要可见图片decode/fonts.ready/有限动画完成后两帧绘制且可交互才完成。无locator轮询时间替代，无Loading占位、删慢样、取平均、减数据或预热；collector-local.js仅更新新环境/新资源清单/输出路径，无样本复用。
- 环境与资产：同上具名生产预览；1366冷入口和刷新采样，最低1280/员工1024完整布局与图片滚动另验。正式不以本地通过代替，后续final-delivery.json独立关闭。

### 验证命令

- `node --import tsx --test tests/unit/craft-direct-route.test.ts tests/unit/craft-route-preload.test.ts tests/unit/craft-entry-initialization.test.ts tests/unit/seam-factory-capability-migration.test.ts`：通过
- `npm run check:prototype-design-governance -- --scope worktree --paths src/router/routes.ts,vite.config.ts,tests/unit/craft-direct-route.test.ts,tests/unit/craft-route-preload.test.ts,docs/prototype-review-records/2026-10-18-craft-list-owner-isolation.md`：通过
- `npm run build`：通过
- `git diff --check`：通过
- `playwright-cli -s=craft-list-local run-code --filename output/playwright/craft-list-owner-isolation/collector-local.js`：通过
- `playwright-cli -s=craft-list-local run-code --filename output/playwright/craft-list-owner-isolation/navigation-local.js`：通过

red-contract.log记录实际旧源码的3失败/6通过；修改路由和LIST预加载种子后green-contract.log为26通过，保留原模块失败/相邻/原能力和主初始化契约。npm run build实际退出0，1160通过、0失败，Vite21.83s；build.log和build-outcome.json绑定当前产物。真实浏览器CLI日志与JSON分别保留，provenance.json记录与原v5采样、原生存量包装器相同核心及新输出位置，不改旧记录身份。

第一轮独立代码审查adversarial-round-1.json通过、0阻断，SHA256为1dde3a11459642dfd46c2eba6387b190ec986120e4605b5c4fd412462ab067c1；核对8项实质反证、12个原owner/guard/handler/main模块与9611基准逐字不变。第二轮adversarial-round-2.json已通过、0阻断，SHA256为a8bca6ccd615aa296ccdd8858286acb767e499b3c051b67c1a509588b99c823e；绑定41件实读文件和本报告当时完整快照。它独立确认真实CLI结果与JSON、原95值/131场景/84body/3原生导航、全1386源码/1220产物，以及实际HTML的LIST60模块/273前缀静态边、DETAIL65/288边均无缺口。源码和所有采集原件未改，本报告仅写入已发生结论。最终文档增量封印adversarial-round-2-document-seal.json及冻结task-receipt.json继续后验，实际状态独立登记，生成前不预填通过。

治理预检实际退出0（governance-preflight.log），同5路径无排除。最终文档冻结后运行技术收据，会再次核对治理和所需检查；结果独立登记，避免改写已绑定文件。

### 例外

- 无。不降低1000ms、不删慢值、不减数据或变更完成终点，不更改部署配置和用户资料。
