# 双标签升级阻塞的实际诊断与复验

范围为当前未提交后道任务工作树、本机 dev 43197、隔离浏览器数据库夹具。此记录不代表线上或真实工厂验收。原失败 trace 保留在相邻 `two-tab-blocked-upgrade-failure/trace.zip`。

## 修复前实际传播

旧标签持有PCS数据库v1的records/files，公共哨兵数量7；新标签仅发起一次open(2)，旧页收到versionchange 1→2，新请求blocked。trace在2187.34ms记录PCS onblocked错误被main catch捕获，未发生pageerror/crash；11911.318ms的最终页面正文是“页面内容加载失败，请稍后重试。”，没有后道恢复提示与按钮。

因此早期1.8秒探针“标题空shell”不能代表最终结果；最终证据确认错误传播完整，缺口为入口准备失败时没有保留真实原因/操作恢复。没有证据支持第二次open排队或异步链永久悬挂。关闭旧连接后原open依次upgradeneeded/success，原共享engine已正确拒绝blocked请求。

- `post-finishing-upgrade-open-sequence.json`：独立事件探针，before只有一次blocked，after为同次upgradeneeded/success。
- `post-finishing-blocked-trace-evidence.json`：原trace的一次console.error、零pageerror/crash、末两次页面快照。
- `post-finishing-blocked-upgrade-diagnosis.json`：最终页面正文的精简提取。

## 修复后实际复验

主代理仅调整后道入口失败展示及main后道限定catch/PDA失败页处理；未改共享PCS数据库engine。测试恢复按钮适配为实际现有 `[data-pcs-storage-retry]`。Web `/fcs/craft/post-finishing/work-orders` 单例2.4秒通过，PDA实际 `/fcs/pda/post-finishing/execute` 单例2.6秒通过。两者均核对阻塞真实原因/关闭旧页说明、旧页versionchange、关闭旧连接后点击重新读取、正常身份入口标题、v2四store、公共数量7、后道命名空间0、无pageerror，并保存阻塞/恢复截图与JSON至 `../../migration/`。

PDA首次夹具误用了不存在的 `/fcs/pda/post-finishing/post`，阻塞提示和恢复已出现，但恢复后正确显示“页面未找到”。此夹具错误的原日志与trace保存在相邻 `two-tab-pda-wrong-route-fixture-failure/`，经主代理确认改用实际execute路由，未新增兼容路由或削弱数据断言。
