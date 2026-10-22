/** 后道单据的两种预览入口共用同一打印前检查；不产生业务记录。 */
export async function preparePostFinishingPrint(button: HTMLElement): Promise<void> {
  // 通用预览有内外两套按钮，必须锁住同一个预览，避免同时发起两次输出。
  const root = button.closest<HTMLElement>('.print-preview-root') || button.closest<HTMLElement>('[data-post-print-ready-root]')
  if (!root || root.dataset.preparingPrint === 'true') return
  const controls = [...root.querySelectorAll<HTMLButtonElement>('[data-post-verified-print], [data-print-preview-action]')]
  let feedback = root.querySelector<HTMLElement>('[data-print-ready-feedback]')
  if (!feedback) {
    feedback = document.createElement('p')
    feedback.dataset.printReadyFeedback = ''
    feedback.setAttribute('role', 'status')
    feedback.className = 'print:hidden px-3 py-2 text-sm'
    root.prepend(feedback)
  }
  const current = () => root.isConnected
  root.dataset.preparingPrint = 'true'
  controls.forEach(control => { control.disabled = true })
  feedback.textContent = '正在准备图片和条码…'
  try {
    if (root.querySelector('[data-print-image-missing]')) throw new Error('资料图片尚未维护，请补齐对应图片后再打印。')
    await Promise.all([...root.querySelectorAll<HTMLImageElement>('img')].map(async img => {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        if (img.complete && !img.naturalWidth) { const src = img.src; img.removeAttribute('src'); img.src = src }
        await Promise.race([img.decode(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('图片加载超时')), 10000) })])
        if (!img.naturalWidth || !img.naturalHeight) throw new Error('图片未加载')
        img.hidden = false
        const message = img.parentElement?.querySelector<HTMLElement>('.pf-qc-image-fallback, [data-print-image-error]')
        if (message) message.hidden = true
      } catch {
        throw new Error(`${img.alt || '资料图片'}尚未加载，打印未开始；请检查图片后重新点击打印。`)
      } finally { if (timer !== undefined) clearTimeout(timer) }
    }))
    if (!current()) return
    await document.fonts.ready
    const deadline = Date.now() + 5000
    const qrs = [...root.querySelectorAll('[data-real-qr]')]
    while (qrs.some(node => !node.querySelector('svg'))) {
      if (!current()) return
      if (Date.now() >= deadline) throw new Error('二维码尚未生成，打印未开始；请稍后重新点击打印。')
      await new Promise(resolve => setTimeout(resolve, 40))
    }
    const barcodes = [...root.querySelectorAll('[data-real-barcode]')]
    if ((!barcodes.length && !qrs.length) || barcodes.some(node => !node.querySelector('rect'))) {
      throw new Error('条码尚未生成，打印未开始；请重新打开单据后重试。')
    }
    if (!current()) return
    feedback.textContent = '图片和条码已就绪。'
    window.print()
  } catch (error) {
    if (current()) feedback.textContent = error instanceof Error ? error.message : String(error)
  } finally {
    controls.forEach(control => { control.disabled = false })
    delete root.dataset.preparingPrint
  }
}
