# I1真实失败：只读原包读取范围漏掉归档

2026-10-20，clean v2 dev43197，旧inline入口修复后重验。已通过PCS故障注入导致两边不变、LS保留，以及恢复后的服装迁移成功、LS清理、PCS原材料不改、WLS不改、只读archive存在等断言。进入正式辅料页面后实际0条、没有迁移卡。

根因：readSources把带末尾斜杠的archivePrefix传给readPcsRecords，而该公开reader自行添加斜杠形成IDB key range。实际范围变成archive//至archive/0，排除了archive/higood…、archive/material-identities…与archive/material-original…等记录。不是缺少data属性，也不是等待不足；归档底层事实已保存，辅料读取漏源。

已通知主代理修正参数边界；同family暂停，未继续I2/I3。完整原日志/trace/截图/测试版本保留，不把此前已通过断言冒称整例通过。
