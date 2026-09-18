import { chromium } from 'playwright'
import fs from 'node:fs'
const base = process.env.WOOL_BASE_URL || 'http://127.0.0.1:5198'
const route = process.env.WOOL_DIAGNOSTIC_ROUTE || '/fcs/pda/exec'
const selector = process.env.WOOL_DIAGNOSTIC_SELECTOR || '[data-testid="pda-exec-card-list"]'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 360, height: 800 } })
await page.addInitScript(() => localStorage.setItem('fcs_pda_session', JSON.stringify({ userId: 'OWN_WOOL_FACTORY_operator', loginId: 'OWN_WOOL_FACTORY_operator', userName: '操作工', roleId: 'ROLE_OPERATOR', factoryId: 'OWN_WOOL_FACTORY', factoryName: '周哥毛织厂', loggedAt: '2026-09-18 10:00:00' })))
const cdp = await page.context().newCDPSession(page)
await cdp.send('Profiler.enable')
for (const phase of ['cold', 'refresh']) {
  await cdp.send('Profiler.start')
  if (phase === 'cold') await page.goto(base + route)
  else await page.reload()
  await page.locator(selector).waitFor()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const { profile } = await cdp.send('Profiler.stop')
  fs.writeFileSync(`/private/tmp/wool-500-queue-${phase}.json`, JSON.stringify(profile))
  const nodes = new Map(profile.nodes.map(n => [n.id, n]))
  const parents = new Map(profile.nodes.flatMap(n => (n.children || []).map(c => [c, n.id])))
  const inclusive = new Map(), self = new Map()
  profile.samples.forEach((id, i) => {
    const duration = profile.timeDeltas[i] / 1000
    self.set(id, (self.get(id) || 0) + duration)
    while (nodes.has(id)) { inclusive.set(id, (inclusive.get(id) || 0) + duration); id = parents.get(id) }
  })
  console.log(phase, profile.nodes.sort((a,b) => (inclusive.get(b.id) || 0) - (inclusive.get(a.id) || 0)).slice(0,100).map(n => ({ name: n.callFrame.functionName, file: n.callFrame.url.split('/src/').at(-1), inclusive: inclusive.get(n.id), self: self.get(n.id) || 0 })))
}
await browser.close()
