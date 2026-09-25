# build21 28组真实场景证据矩阵

基线`5ba805510f3cf70339db6e3ddd072b9c5d255a01`，源码指纹`04165095824efc064c2e26ef942150c79e1b17f814c2e886ddf7346a0f2f0913`；1280个计时样本，最大463ms，issues=[]。三个功能组不报告计时，绝不把0样本当性能通过。

| 场景产物 | 计时样本 | 最大ms | 需求映射 | 结论 |
| --- | ---: | ---: | --- | --- |
| [backup-build21.json](acceptance-final/backup-build21.json) | 5 | 51.0 | STORE-012/013/014 | 软件场景通过 |
| [bag-lifecycle-build21.json](acceptance-final/bag-lifecycle-build21.json) | 80 | 228.8 | BAG-005/006/007/008/009、UX-001/004 | 软件场景通过 |
| [batch-ui-build21.json](acceptance-final/batch-ui-build21.json) | 120 | 232.1 | HAND-001/004/005/006/007/010/014、PERF-002 | 软件场景通过 |
| [data-tools-build21.json](acceptance-final/data-tools-build21.json) | 20 | 95.4 | STORE-008/009/012/014 | 软件场景通过 |
| [extra-controls-build21.json](acceptance-final/extra-controls-build21.json) | 55 | 64.8 | PAGE-004/006、UX-003/005 | 软件场景通过 |
| [history-print-build21.json](acceptance-final/history-print-build21.json) | 0 | 不适用：功能组 | TKT-007/008、ORDER-007 | 软件场景通过 |
| [hpb-scan-build21.json](acceptance-final/hpb-scan-build21.json) | 20 | 263.6 | BAG-001/002/003/004、PRINT-003 | 软件场景通过 |
| [lan-build21.json](acceptance-final/lan-build21.json) | 0 | 不适用：功能组 | TKT-005/006、PRINT-003 | 软件场景通过 |
| [list-actions-build21.json](acceptance-final/list-actions-build21.json) | 135 | 65.9 | ORDER/MAT、PAGE-001至010 | 软件场景通过 |
| [marker-build21.json](acceptance-final/marker-build21.json) | 35 | 399.0 | STORE-001/003/005/006/007、PERF-001/002 | 软件场景通过 |
| [part-build21.json](acceptance-final/part-build21.json) | 85 | 463.0 | FACT-003、STORE-001/003/005/006/007、PERF-001/002 | 软件场景通过 |
| [part-detail-build21.json](acceptance-final/part-detail-build21.json) | 30 | 169.7 | FACT-003、STORE-005、UX-002/003 | 软件场景通过 |
| [part-stages-build21.json](acceptance-final/part-stages-build21.json) | 40 | 331.3 | FACT-003、STORE-003/005/007 | 软件场景通过 |
| [print-controls-build21.json](acceptance-final/print-controls-build21.json) | 55 | 297.0 | TKT-001/003/004/005/006/007、PRINT-004/005、PAGE-008/009 | 软件场景通过 |
| [print-images-build21.json](acceptance-final/print-images-build21.json) | 10 | 65.2 | PRINT-001/002的软件部分、UX-002/003 | 软件场景通过 |
| [roles-build21.json](acceptance-final/roles-build21.json) | 0 | 不适用：功能组 | SCOPE-004 | 软件场景通过 |
| [routes-build21.json](acceptance-final/routes-build21.json) | 135 | 336.5 | PAGE-001、UX-005、PERF-001 | 软件场景通过 |
| [simple-handover-build21.json](acceptance-final/simple-handover-build21.json) | 85 | 165.7 | SCOPE、HAND-001至014、UX-001/004 | 软件场景通过 |
| [source-actions-build21.json](acceptance-final/source-actions-build21.json) | 25 | 99.2 | ORDER-001/003/005、TKT-002、STORE | 软件场景通过 |
| [source-breakdown-build21.json](acceptance-final/source-breakdown-build21.json) | 10 | 152.3 | STORE-001/003/005/007 | 软件场景通过 |
| [source-completion-build21.json](acceptance-final/source-completion-build21.json) | 10 | 217.8 | STORE-001/003/005/007 | 软件场景通过 |
| [source-contract-transfer-build21.json](acceptance-final/source-contract-transfer-build21.json) | 10 | 98.3 | STORE-003/005/007/013/014 | 软件场景通过 |
| [source-generation-build21.json](acceptance-final/source-generation-build21.json) | 20 | 218.7 | STORE-001/003/005/007、DATA-001 | 软件场景通过 |
| [source-pda-accept-build21.json](acceptance-final/source-pda-accept-build21.json) | 10 | 239.0 | STORE-003/005/007、UX-001/004 | 软件场景通过 |
| [source-routes-build21.json](acceptance-final/source-routes-build21.json) | 135 | 453.7 | PERF-001、STORE-005 | 软件场景通过 |
| [source-start-build21.json](acceptance-final/source-start-build21.json) | 5 | 236.1 | STORE-003/005/007 | 软件场景通过 |
| [wait-dialogs-build21.json](acceptance-final/wait-dialogs-build21.json) | 30 | 398.5 | BAG/HAND、UX-004、PERF-002 | 软件场景通过 |
| [web-detail-build21.json](acceptance-final/web-detail-build21.json) | 115 | 158.1 | BAG-005/006/010/011、FACT-002、UX-002/003、PERF-001/002 | 软件场景通过 |

web-detail115包含实际历史周期打印/PDF、三种大图关闭、图片故障阻断、显式重试后复打以及五次Esc的window-capture严格计时。历史标签仍为原周期3页、原票ID、20片/5Yard/8米；D04现场实物不在本表通过范围。
