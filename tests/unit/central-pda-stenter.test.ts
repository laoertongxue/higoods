import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { renderCentralStenterPage } from '../../src/pages/central-pda/stenter-page.ts'
import { centralSession } from '../../src/pages/central-pda/session.ts'
import { setPdaSession } from '../../src/data/fcs/store-domain-pda.ts'
import { routes } from '../../src/router/routes-central-pda.ts'

test('central stenter frame exposes receive, execute and warehouse tabs and blocks an unauthenticated session', async () => {
  const previous = { account: centralSession.account, signedOut: centralSession.signedOut, currentFactory: centralSession.currentFactory, language: centralSession.language }
  try {
    centralSession.account = undefined
    centralSession.signedOut = true
    centralSession.currentFactory = ''
    centralSession.language = 'zh'
    setPdaSession(null)
    const html = await renderCentralStenterPage('/fcs/pda/central/stenter/receive', () => true)
    assert.match(html, /data-central-family="stenter"/)
    assert.match(html, /data-central-nav="\/fcs\/pda\/central\/stenter\/receive"/)
    assert.match(html, /data-central-nav="\/fcs\/pda\/central\/stenter\/execute"/)
    assert.match(html, /data-central-nav="\/fcs\/pda\/central\/stenter\/warehouse"/)
    assert.match(html, /请先登录中央工厂账号/)
    assert.match(html, /定型机手感/)
  } finally {
    centralSession.account = previous.account
    centralSession.signedOut = previous.signedOut
    centralSession.currentFactory = previous.currentFactory
    centralSession.language = previous.language
  }
})

test('central stenter routes and process menus are registered', () => {
  const patterns = routes.dynamicRoutes.map(route => route.pattern)
  for (const path of ['/fcs/pda/central/stenter/receive', '/fcs/pda/central/stenter/execute/SHF-1', '/fcs/pda/central/stenter/warehouse']) {
    assert.ok(patterns.some(pattern => pattern.test(path)), path)
  }
  const operationMenu = readFileSync(new URL('../../src/pages/central-pda/operation-menu.ts', import.meta.url), 'utf8')
  assert.ok(operationMenu.includes('/fcs/pda/central/stenter/receive'), 'operation-menu.ts')
  for (const file of ['dye-page.ts', 'water-page.ts', 'print-page.ts', 'page.ts', 'binding-page.ts', 'cutting-page.ts', 'lace-page.ts', 'webbing-page.ts', 'post-page.ts', 'stenter-page.ts']) {
    const source = readFileSync(new URL('../../src/pages/central-pda/' + file, import.meta.url), 'utf8')
    assert.ok(source.includes('renderCentralOperationMenu'), file)
  }
})

test('central stenter keeps the mobile card, scan and load-more layout instead of web filters and pagination', () => {
  const page = readFileSync(new URL('../../src/pages/central-pda/stenter-page.ts', import.meta.url), 'utf8')
  assert.match(page, /mobile: true/)
  const stenter = readFileSync(new URL('../../src/pages/process-factory/dyeing/stenter-handfeel/work-orders.ts', import.meta.url), 'utf8')
  assert.match(stenter, /data-stenter-mobile-content/)
  assert.match(stenter, /data-stenter-handfeel-action="scan-focus"/)
  assert.match(stenter, /data-stenter-handfeel-action="mobile-more"/)
})