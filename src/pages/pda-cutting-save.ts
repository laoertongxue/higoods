import { cuttingRecordUuid } from '../data/fcs/cutting/cutting-record-identity.ts'
import { runCuttingEventAction } from '../data/fcs/cutting/cutting-event-repository.ts'
import { validateReplacementFabricEventBatch } from '../data/fcs/cutting/replacement-fabric-event-validation.ts'
import type { BrowserStorageLike } from '../data/browser-storage.ts'

const pending = new WeakSet<HTMLElement>()
const attempts = new Map<string, string>()

/** PDA 确认只在事务 complete 后进入结果页；失败保留本轮输入和重试标识。 */
export function savePdaCuttingAction<T>(input: {
  container: HTMLElement; intent: string; action: (storage: BrowserStorageLike) => T
  success: (result: T) => void; failure: (message: string) => void
}): void {
  if (pending.has(input.container)) return
  pending.add(input.container)
  const controls = [...input.container.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input, button, select, textarea')]
  const disabled = controls.map(control => control.disabled)
  controls.forEach(control => { control.disabled = true })
  input.container.setAttribute('aria-busy', 'true')
  const intent = JSON.stringify(JSON.parse(input.intent), (key, value) => ['feedback', 'resultMessage', 'feedbackMessage'].includes(key) ? undefined : value)
  const id = attempts.get(intent) || `PDA-CUTTING:${cuttingRecordUuid()}`
  attempts.set(intent, id)
  const unlock = () => {
    pending.delete(input.container)
    input.container.removeAttribute('aria-busy')
    controls.forEach((control, index) => { control.disabled = disabled[index] })
  }
  void runCuttingEventAction({ id, intent, action: input.action, validate: validateReplacementFabricEventBatch })
    .then(result => { unlock(); attempts.delete(intent); input.success(result) })
    .catch(error => { unlock(); input.failure(`未保存：${error instanceof Error ? error.message : '保存失败，请重试。'}`) })
}
