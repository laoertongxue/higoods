# V2 页面分层与紧凑筛选验证证据

证据产生时间：2026-09-17T14:17:41.647Z。分支 `codex/dds-production-fulfillment`；基准 HEAD `4804328a822eec3c77eee1ffa5b10911bb77c9fe`，运行内容来自当前未提交工作树与 `/tmp/higoods-dds-pf-build`。浏览器：Chromium 149.0.7827.55；服务：http://127.0.0.1:4179。

## 结论与范围

`node scripts/check-dds-production-fulfillment.mjs --production --layout-v2` 完成 **6组检查、1214个耗时样本**；最大值 **184.69999998807907ms**（展示约184.7ms），无样本达到或超过200ms，浏览器错误0。判断依据为每次原始样本，不使用平均值替代慢样本。

本批结论仅覆盖下列V2脚本分组，不能替代77类来源事件和全部业务场景的完整验收。保留操作的独立V2回归另列在后文，不援引V1结果宣称本轮重新通过。全模块剩余问题见 [逐行审阅处置](../review-v2-resolution.md)。

1. 七个菜单紧凑筛选与一致列宽
2. 总览互斥页签及带筛选下钻返回
3. 任务详情、工作抽屉和示例分层
4. 团队与履约互斥内容
5. 配置目录→编辑→试算→校验→发布各5次
6. 最终版本10路由冷进入/刷新/站内切换各5次

实际样本尺寸：1366×768（1068个）、1280×720（73个）、1024×768（73个）。原始JSON的 `viewport` 元数据还列了1920×1080，但此次无该尺寸样本，因此不认定其经过V2复测。

## 原始证据

- [verification.json](verification.json)：全部原始耗时、检查组、路由、选择器及完成时间。
- [summary.json](summary.json)：从原始JSON汇总的样本数量、最大值、设备尺寸及耗时类别。
- [manifest.json](manifest.json)：归档文件的来源、字节数及SHA256。
- [pf-v2-full-build.log](pf-v2-full-build.log)：完整构建通过；包含169条单元测试，0失败；保留大包警告。
- [pf-v2-scope.log](pf-v2-scope.log)：本次TypeScript范围0错误；范围外已有61错误未删除。
- [pf-v2-template.log](pf-v2-template.log)：标准列表模板及列拖拽检查通过。

## 最终运行截图

- [config-select-dependency-dialog.png](config-select-dependency-dialog.png)
- [config-select-mapping-dialog.png](config-select-mapping-dialog.png)
- [config-select-owner-dialog.png](config-select-owner-dialog.png)
- [config-select-rule-dialog.png](config-select-rule-dialog.png)
- [configuration-v2-1366.png](configuration-v2-1366.png)
- [follow-up-filters-1366.png](follow-up-filters-1366.png)
- [fulfillment-filters-1366.png](fulfillment-filters-1366.png)
- [overview-filters-1366.png](overview-filters-1366.png)
- [overview-v2-1366.png](overview-v2-1366.png)
- [task-v2-1366.png](task-v2-1366.png)
- [tasks-filters-1366.png](tasks-filters-1366.png)
- [teams-filters-1366.png](teams-filters-1366.png)
- [work-drawer-v2.png](work-drawer-v2.png)
- [work-items-filters-1366.png](work-items-filters-1366.png)

选择器失败预检的 `failure.png` 与 `preflight-config-selector.json` 留在原输出目录，未列为最终通过证据。此归档仅复制已有产物，没有重新执行浏览器或修改源码。

## 保留操作独立回归

`node scripts/check-dds-production-fulfillment.mjs --production --deep --regression-v2` 完成于2026-09-17T14:24:35.567Z：**21组、698样本，最大168.90000000596046ms，0个样本达到200ms，errors=[]**。本回归补齐图片三种关闭、失败态、打印PDF、导出、列设置、排序分页、跟进、人工预计、配置重算与权限，以及1024/1280/1920页面场景。逐项耗时仍以原始JSON为准。

- [regression/verification.json](regression/verification.json)：21组检查名称及698个原始样本。
- [regression/task-report.pdf](regression/task-report.pdf)：本轮打印产物。
- [regression/orders-export.csv](regression/orders-export.csv)：本轮订单导出产物。
- [regression/overview-1366.png](regression/overview-1366.png)、[regression/gantt-1366.png](regression/gantt-1366.png)、[regression/quantities-1366.png](regression/quantities-1366.png)、[regression/configuration-1366.png](regression/configuration-1366.png)。
- [regression/team-1024.png](regression/team-1024.png)、[regression/task-1280.png](regression/task-1280.png)、[regression/overview-1920.png](regression/overview-1920.png)。

两次独立运行合计27组、1912样本，最高184.69999998807907ms，所有样本严格低于200ms。原始JSON各自保留，没有合并、删减或覆盖任何耗时；1920尺寸依据为此独立回归，而非前一份V2布局元数据。此结果证明已列界面及保留操作复测通过，不能把仍公开的业务缺口认作完成。

## 指标分母与当前LAN地址

`--metrics-v2` 在 `http://192.168.5.2:4179` 验证通过，1组33样本、最大110.09999999403954ms、errors=[]。分别验证当前逾期可判7/8、预测可判6/8，以及筛选单任务后的1/1与0/1。见 [原始样本](metrics/verification.json) 和 [分母截图](metrics/metric-denominators-1366.png)。

三轮合计28组1945样本，最大184.69999998807907ms。当前源码和测量脚本哈希见 [build-manifest-v2.json](build-manifest-v2.json)，可复现测量脚本见 [check-dds-production-fulfillment.mjs](check-dds-production-fulfillment.mjs)。最终原型治理23个受管文件通过，见 [治理日志](pf-v2-governance-all.log)。
