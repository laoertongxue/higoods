# 独立后道示例正式性能记录

本轮独立示例验收通过：27 个家族各 5 个有效样本，共 135 个；全部 ≤1000ms，最慢 534.000ms（第 5 次显式交复检）。这是 `/newpda` 的页面内存示例，不能与主应用 IndexedDB 动作或主 D10 性能混作等价证据。

- 校准：`calibration-2026-10-19T15-43-31.296Z/report.json`，27/27 有效，最大 499.500ms，`calibrationPassed=true`；校准不代替正式样本。
- 正式：`formal-2026-10-19T15-43-46.448Z/report.json`，`completed=true`、`passed=true`、无 pageerror／runner error。该报告保留每个样本的原始起止值、业务事实、交互就绪控件、图片、资源与版本信息。
- 路由：`http://127.0.0.1:43198/newpda/index.html?demo=work&screen=post-batch&size=compact`。
- 设备：Chromium 149.0.7827.55；外层 1366×900，设备容器 320×640，Asia/Shanghai；无 CPU／网络节流，独占采样窗口。
- 数据输入：显式 URL 示例 SH-082，M600/L400，共1000件，四项适用，初始无加工登记／复检／出货。复用已保留 V9 边界与复检证据作为输入来源记录，不伪称通过本轮页面完成上游质检。
- 起点：导航为新文档时间原点；动作为应用处理器之前捕获的可信 UI 事件。终点核对实际状态、可见结果、可交互控件、图片与字体后两个稳定帧；所有成功保存还包含现有450ms冷却。
- 成功动作：每项实际保存100、100、100、100、600件，累计1000；最终20条加工增量登记、5张复检、5张出货、5次各自实收。逐SKU完成与占用均为600/400，可交复检余量0/0。
- 失败动作：逐SKU超上限、界面“保存失败”模拟各5个样本，核对错误、原业务历史不变、M/L输入保留，随后通过真实正常保存继续。这里的模拟失败不证明真实IndexedDB中止。
- 刷新边界：另一次不计时刷新回读，登记／复检／出货均回到0，确认示例事实只存页面内存；不承诺刷新或重开恢复。
- 版本绑定：正式报告中的 HEAD、dirty、scriptSha256、sourceHashes、servedAssets 与 runtimeAssetUrls。实际加载 post-flow.js?v=b778cce65b、post-flow.css?v=89abf3965f、handoff-context.js?v=8872cecb1b；三者完整返回字节SHA与源匹配。浏览器已关闭后才开始PDF渲染。

| 家族 | 有效／要求 | 最大值（ms） | ≤1000ms |
| --- | ---: | ---: | --- |
| `page:cold-entry` | 5/5 | 167.200 | 通过 |
| `page:refresh` | 5/5 | 96.900 | 通过 |
| `page:queue` | 5/5 | 48.400 | 通过 |
| `page:in-app-entry` | 5/5 | 48.900 | 通过 |
| `page:view:work` | 5/5 | 48.500 | 通过 |
| `page:view:submit` | 5/5 | 48.300 | 通过 |
| `page:view:check` | 5/5 | 50.000 | 通过 |
| `page:view:out` | 5/5 | 48.200 | 通过 |
| `page:item:开扣眼` | 5/5 | 48.400 | 通过 |
| `page:item:装扣子` | 5/5 | 47.800 | 通过 |
| `page:item:熨烫` | 5/5 | 48.500 | 通过 |
| `page:item:包装` | 5/5 | 48.800 | 通过 |
| `action:process:开扣眼:save` | 5/5 | 499.300 | 通过 |
| `action:process:装扣子:save` | 5/5 | 498.700 | 通过 |
| `action:process:熨烫:save` | 5/5 | 499.400 | 通过 |
| `action:process:包装:save` | 5/5 | 500.600 | 通过 |
| `action:quantity:M:input` | 5/5 | 48.100 | 通过 |
| `action:quantity:L:input` | 5/5 | 48.600 | 通过 |
| `action:submit-recheck` | 5/5 | 534.000 | 通过 |
| `action:claim-recheck` | 5/5 | 500.600 | 通过 |
| `action:barcode:M` | 5/5 | 49.000 | 通过 |
| `action:barcode:L` | 5/5 | 48.700 | 通过 |
| `action:complete-recheck` | 5/5 | 498.800 | 通过 |
| `action:receipt:open` | 5/5 | 48.900 | 通过 |
| `action:receipt:save` | 5/5 | 500.000 | 通过 |
| `failure:quantity-upper-bound` | 5/5 | 50.300 | 通过 |
| `failure:simulated-save` | 5/5 | 48.900 | 通过 |

界面证据：正式目录的 `failed-input-retained.png` 与 `final-D1-1000-memory-only.png` 已目视查看。代理技术验证不代表实体设备、真实扫码、工厂试用或产品现场接受。
