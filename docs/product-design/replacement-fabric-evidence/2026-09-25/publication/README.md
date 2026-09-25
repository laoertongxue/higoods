# 换片布菲票 main 合并前复验

2026-09-25 用户明确要求“本地合并进 main，并推送至 github”。此次按当前实现进度发布，产品整体结论仍为 **未完成**，不得解释为 92 条原子需求已全部验收。

## 版本和范围

- 集成基线：main / origin/main `416f760adfe93d906aeb1f724ee55d2f769ed0f0`。
- 发布分支：`codex/replacement-fabric-release-20260925`；工作树：`/private/tmp/higoods-replacement-fabric-release-20260925`。
- 原任务 71 个源文件与 main 新增的生产准备提交无文件重叠；逐文件哈希与原实施快照相同。
- 额外更新 1 个本功能直接相关专项脚本：`scripts/check-pda-cutting-transfer-bag-handover.ts`。旧检查要求两个参数；现核对事务 storage 参数及持久确认入口，不删除原有业务结果断言。对应 SCOPE-002、HAND-001、STORE-003。
- 72 个源文件以本目录 source-manifest.json 绑定。本文、业务方案、实施追踪、审查记录和证据一并纳入明确文件清单；不包含其他任务未提交修改。

## 当前复验

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 构建、工程类型范围、单元测试 | 通过；479 条单元测试通过，其中本功能 21 条 | workflow-initial.log |
| 原型与标准列表治理 | 通过；63 个受管可见文件 | workflow-initial.log |
| 裁床整链专项 | 更新过时调用契约后通过；原失败保留 | cutting-rerun.log、workflow-initial.log |
| 全量菜单路由 | 失败；未改动 main 同样缺 5 个织带精确路由，本次新菜单未增加缺失 | baseline-menu.log、workflow-initial.log |
| 两家工厂、同任务分批、旧票拒用、接收历史 | 通过：700片+1票，次批200片+0票；另厂720片+第2票 | two-factories.txt |
| 多袋并集与三类混装 | 通过；缺票未落盘；2条交出和1条换片布回执；Web/PDA展示 | mixed-ui.txt、mixed-web.png、mixed-pda.png |
| 新增票、部分打印、补打 | 通过；6张票只确认1张；补打仍6票，打印记录增至2条 | print-images.txt、partial-reprint.png |
| 列表26项操作各5次 | 通过；130样本最大67.5ms；1366/1280/1024无主体溢出 | list-interactions.txt、list-1280.png |
| 8路由冷启动/刷新/站内切换，各5次 | **失败**；120样本中117通过，待交出冷启动为504.9、500.4、502ms，保留完整精度原始值 | routes-performance.txt |
| CodeGraph | 初次收据sync=0、pending=0，路径匹配；最终提交前再同步更新后的专项脚本 | task-receipt-initial.json |

当前浏览器：Playwright CLI Chromium；开发服务 `http://127.0.0.1:43235`，构建预览 `http://127.0.0.1:43236`，均运行本发布工作树。Web 1366×768/1280×720/1024×768，PDA 390×844 或 360×800。测试只使用新隔离浏览器上下文，未清理用户浏览器数据。复现脚本以本目录为准；执行时需创建 `output/playwright/hpb/`，先通过工厂登录页登录演示账号 `ID-F001_operator`，双工厂脚本自行使用裁床管理员登录；数据为原型 Mock。

## 技术收据及未完成项

初次收据完整归档，状态 implemented，阻断项为旧PDA调用契约及既有织带菜单检查。旧PDA契约已更新并通过整链重跑。最后提交前再次执行 `npm run workflow:verify`，输出 `/private/tmp/hpb-publication-20260925/task-receipt-final.json` 与同目录 workflow-final.log；不修改检查器或豁免基线失败，不把技术收据当作产品接受。

完整上游 localStorage 迁移、所有受影响交互性能、真实改派/全部角色和现场实物打印扫描仍未闭环。本轮新发现的待交出页冷启动超时属于开放问题，旧466.9ms结果不能替代当前结果。主方案、矩阵和审查结论保持“未完成”。GitHub推送与绑定同SHA的Vercel正式部署成功状态由发布后回执单独确认，本文不预先声明远端成功。
