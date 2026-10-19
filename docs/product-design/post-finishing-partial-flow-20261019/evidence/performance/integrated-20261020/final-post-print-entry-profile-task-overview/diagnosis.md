# Stage26 task-overview cold CPU diagnostic

Original normal formal cold1214.5ms remains a valid failure. One CPU diagnostic1010.2ms was captured with fixed fullD10, no refresh/navigation/action. No canonical/product change was made. A root-authorized evidence-only copy returns after unchanged cold await; its one-line diff and SHA6b1b… are retained. Canonical remainsb943. All browsers closed.

Resource observations before sampling: one snapshot CodeGraph node11.5% and systemdeleted10.9%; after preparing the diagnostic copy, CodeGraph was≤5% and the former Codex Renderer148.8% was absent; Antigravity Renderer9.9%, CodexCLI5.2%. No process was killed and no previous slow sample was discarded. These observations do not change the original failure status.

Weighted CPU inclusive branches (parents contain descendants; do not add nested values): renderCe470.776ms = rowmap410.707 + statistics second trace36.070 + V/listTaskOrders16.487 + waitHandover clone6.005 + QC clone1.507. Rowmap410.707 = materialReadiness373.047 + trace37.660. Trace calls contain clone25.559/24.038ms. isDeliveryComplete was not a≥1ms sampled branch; absence is not proof of zero work or an invocation count.

Readiness373.047 = adapter332.992 + fallback transfers40.055. Adapter preparationFor→sources→materialprep308.910 contains sourcebuilder263.668, which contains necessary dye126.098, printing92.677,water-soluble25.363 and otherprinting18.025. This cold initialization is the largest measured branch. Do not attribute all373ms to trace, V mapping or JSON copying. Exact source excerpts are in qualified-material-preparation-tree.json and qualified-material-source-inner.json.

HydrationMe71.071ms is separate, containing its strict validator; actual profile/full readonly phases remain in report. FF JSON cloneN self60.111ms across all paths is not additional to traces. Runtime main/program and layout samples are not assigned to a guessed business cause.

Full rawCPU, qualified-task-material-trace-branches.json, source/asset archives, manifest and original formal106sample failure remain with exact version identity. Original formal21families/105previoussamples passed; the106thfailed and stopped all laterfamilies. No new PDF or extra family was attempted.
