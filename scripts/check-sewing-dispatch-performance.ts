#!/usr/bin/env node

import assert from 'node:assert/strict'
import { chromium, type Browser } from '@playwright/test'

const baseUrl = process.env.HIGOOD_BASE_URL || 'http://127.0.0.1:5173'
const budgetMs = Number(process.env.HIGOOD_INTERACTION_THRESHOLD_MS || 200)

async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({ channel: 'chrome', headless: true })
  } catch {
    return chromium.launch({ headless: true })
  }
}

const browser = await launchBrowser()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

try {
  await page.goto(`${baseUrl}/fcs/dispatch/sewing`, { waitUntil: 'domcontentloaded' })
  const pageRoot = page.locator('[data-sewing-dispatch-page]')
  await pageRoot.waitFor()
  const rootHandle = await pageRoot.elementHandle()
  assert(rootHandle, '车缝分配工作台根节点不存在')

  const directButton = page.locator('[data-sewing-dispatch-action="open-dispatch"][data-dispatch-type="直接派单"]:not(.pointer-events-none):not(:disabled)').first()
  await page.evaluate(() => {
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-sewing-dispatch-action="open-dispatch"]') : null
      if (!target) return
      const startedAt = performance.now()
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-sewing-dispatch-dialog-host] [role="dialog"]')) return
        ;(window as Window & { __sewingInteractionDuration?: number }).__sewingInteractionDuration = performance.now() - startedAt
        observer.disconnect()
      })
      observer.observe(document.querySelector('[data-sewing-dispatch-dialog-host]')!, { childList: true })
    }, { capture: true, once: true })
  })
  await directButton.click()
  await page.locator('[data-sewing-dispatch-dialog-host] [role="dialog"]').waitFor()
  const openDuration = await page.evaluate(() => (window as Window & { __sewingInteractionDuration?: number }).__sewingInteractionDuration ?? Number.POSITIVE_INFINITY)
  assert(openDuration <= budgetMs, `直接派单弹窗响应 ${openDuration.toFixed(2)}ms，超过 ${budgetMs}ms`)

  const rowFactory = page.locator('[data-sewing-dispatch-field="dispatchFactoryForRow"]').first()
  await page.evaluate(() => {
    document.addEventListener('change', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-sewing-dispatch-field="dispatchFactoryForRow"]') : null
      if (!target) return
      const originalRegion = document.querySelector('[data-sewing-dispatch-main-factory-region]')
      const startedAt = performance.now()
      const observer = new MutationObserver(() => {
        if (originalRegion?.isConnected) return
        ;(window as Window & { __sewingInteractionDuration?: number }).__sewingInteractionDuration = performance.now() - startedAt
        observer.disconnect()
      })
      observer.observe(document.querySelector('[data-sewing-dispatch-dialog-host]')!, { childList: true, subtree: true })
    }, { capture: true, once: true })
  })
  await rowFactory.selectOption({ index: 1 })
  await page.locator('[data-sewing-dispatch-main-factory-region]').waitFor()
  const factoryDuration = await page.evaluate(() => (window as Window & { __sewingInteractionDuration?: number }).__sewingInteractionDuration ?? Number.POSITIVE_INFINITY)
  assert(factoryDuration <= budgetMs, `SKU 选厂响应 ${factoryDuration.toFixed(2)}ms，超过 ${budgetMs}ms`)

  assert.equal(await pageRoot.count(), 1, '轻交互后页面根节点数量必须保持为 1')
  assert.equal(await rootHandle.evaluate((node) => node.isConnected), true, 'SKU 选厂不得替换页面根节点')
  assert.equal(await page.locator('[data-sewing-dispatch-dialog-host] [role="dialog"]').count(), 1, 'SKU 选厂不得重复创建弹窗')

  const directTimeDuration = await page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>('[data-sewing-dispatch-field="dispatchBusinessAssignedAt"]')
    const slot = document.querySelector<HTMLElement>('[data-sewing-direct-sla-preview-slot]')
    if (!input || !slot) return Number.POSITIVE_INFINITY
    return await new Promise<number>((resolve) => {
      const startedAt = performance.now()
      const observer = new MutationObserver(() => {
        observer.disconnect()
        resolve(performance.now() - startedAt)
      })
      observer.observe(slot, { childList: true })
      const value = new Date(input.value)
      value.setHours(value.getHours() - 1)
      input.value = value.toISOString().slice(0, 16)
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
  })
  assert(directTimeDuration <= budgetMs, `独立车缝分配时间预览响应 ${directTimeDuration.toFixed(2)}ms，超过 ${budgetMs}ms`)
  assert.equal(await rootHandle.evaluate((node) => node.isConnected), true, '独立车缝分配时间变更不得替换页面根节点')

  await page.goto(`${baseUrl}/fcs/dispatch/continuous`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-continuous-dispatch-page]').waitFor()
  await page.evaluate(() => {
    ;(window as Window & { __continuousInteractionDuration?: number }).__continuousInteractionDuration = undefined
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-continuous-dispatch-action="switch-tab"][data-tab="OTHER"]') : null
      if (!target) return
      const startedAt = performance.now()
      const observer = new MutationObserver(() => {
        const activeTab = document.querySelector('[data-continuous-dispatch-action="switch-tab"][data-tab="OTHER"]')
        if (!activeTab?.classList.contains('border-blue-600')) return
        ;(window as Window & { __continuousInteractionDuration?: number }).__continuousInteractionDuration = performance.now() - startedAt
        observer.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }, { capture: true, once: true })
  })
  await page.locator('[data-continuous-dispatch-action="switch-tab"][data-tab="OTHER"]').click()
  await page.waitForFunction(() => Number.isFinite((window as Window & { __continuousInteractionDuration?: number }).__continuousInteractionDuration))
  const continuousTabDuration = await page.evaluate(() => (window as Window & { __continuousInteractionDuration?: number }).__continuousInteractionDuration ?? Number.POSITIVE_INFINITY)
  assert(continuousTabDuration <= budgetMs, `连续工序页签响应 ${continuousTabDuration.toFixed(2)}ms，超过 ${budgetMs}ms`)
  assert.equal(await page.locator('[data-continuous-dispatch-page]').count(), 1, '连续工序页签切换后页面根节点数量必须保持为 1')

  await page.locator('[data-continuous-dispatch-action="switch-tab"][data-tab="SEWING_POST"]').click()
  const continuousRoot = page.locator('[data-continuous-dispatch-page]')
  const continuousRootHandle = await continuousRoot.elementHandle()
  assert(continuousRootHandle, '连续工序分配页面根节点不存在')
  await page.locator('[data-continuous-dispatch-action="open-direct"]:not(:disabled)').first().click()
  await page.locator('[data-continuous-sla-preview-slot]').waitFor()
  const continuousTimeDuration = await page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>('[data-continuous-dispatch-field="businessAssignedAt"]')
    const slot = document.querySelector<HTMLElement>('[data-continuous-sla-preview-slot]')
    if (!input || !slot) return Number.POSITIVE_INFINITY
    return await new Promise<number>((resolve) => {
      const startedAt = performance.now()
      const observer = new MutationObserver(() => {
        observer.disconnect()
        resolve(performance.now() - startedAt)
      })
      observer.observe(slot, { childList: true })
      const value = new Date(input.value)
      value.setHours(value.getHours() - 1)
      input.value = value.toISOString().slice(0, 16)
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
  })
  assert(continuousTimeDuration <= budgetMs, `车缝到后道分配时间预览响应 ${continuousTimeDuration.toFixed(2)}ms，超过 ${budgetMs}ms`)
  assert.equal(await continuousRootHandle.evaluate((node) => node.isConnected), true, '车缝到后道分配时间变更不得替换页面根节点')
  assert.equal(await page.locator('[data-continuous-dispatch-dialog-host] [role="dialog"]').count(), 1, '车缝到后道分配时间变更不得重复创建弹窗')

  console.log(`车缝分配性能检查通过：打开弹窗 ${openDuration.toFixed(2)}ms，SKU 选厂 ${factoryDuration.toFixed(2)}ms，独立车缝时间预览 ${directTimeDuration.toFixed(2)}ms，连续工序页签 ${continuousTabDuration.toFixed(2)}ms，车缝到后道时间预览 ${continuousTimeDuration.toFixed(2)}ms，预算 ${budgetMs}ms`)
} finally {
  await browser.close()
}
