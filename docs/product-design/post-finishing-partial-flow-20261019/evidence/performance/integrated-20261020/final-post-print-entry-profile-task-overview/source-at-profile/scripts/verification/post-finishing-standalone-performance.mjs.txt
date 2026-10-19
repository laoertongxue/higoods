#!/usr/bin/env node
/**
 * Independent newpda V9 page-memory sample. It never exercises the main app
 * command/IndexedDB contract. Without --run this script cannot launch a browser.
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { arch, cpus, freemem, loadavg, platform, release, totalmem } from 'node:os';

const args = process.argv.slice(2);
const option = (name, fallback) => args.find(value => value.startsWith(name + '='))?.slice(name.length + 1) ?? fallback;
const calibration = args.includes('--calibration');
const trials = calibration ? 1 : 5;
const origin = option('--target', 'http://127.0.0.1:43198').replace(/\/$/, '');
const output = resolve(option('--output', 'docs/product-design/post-finishing-partial-flow-20261019/evidence/standalone-performance'));
const url = origin + '/newpda/index.html?demo=work&screen=post-batch&size=compact';
const items = ['开扣眼', '装扣子', '熨烫', '包装'];
const maxMs = 1000;
const families = [
  'page:cold-entry', 'page:refresh', 'page:queue', 'page:in-app-entry',
  'page:view:work', 'page:view:submit', 'page:view:check', 'page:view:out',
  ...items.map(item => 'page:item:' + item),
  ...items.map(item => 'action:process:' + item + ':save'),
  'action:quantity:M:input', 'action:quantity:L:input',
  'action:submit-recheck', 'action:claim-recheck',
  'action:barcode:M', 'action:barcode:L', 'action:complete-recheck',
  'action:receipt:open', 'action:receipt:save',
  'failure:quantity-upper-bound', 'failure:simulated-save',
];
const config = {
  origin, url, trials, calibration, maxMs,
  viewport: { width: 1366, height: 900 }, deviceCss: { width: 320, height: 640 },
  timezone: 'Asia/Shanghai', cpuThrottle: 'none', networkThrottle: 'none',
  fixture: { publicUrlFixture: 'demo=work', parent: 'SH-082', skuQuantities: { M: 600, L: 400 }, total: 1000,
    items, initialEntries: 0, initialRechecks: 0, initialOutbounds: 0,
    increments: calibration ? [[600, 400]] : [[60, 40], [60, 40], [60, 40], [60, 40], [360, 240]] },
  families,
  cache: 'Cold means a fresh isolated Chromium context with no browser HTTP cache. Refresh and in-app navigation use their existing context; no warmup is counted as cold.',
  clock: 'Navigation uses the new document performance time origin (0). Actions start in a capture listener at the real trusted UI event, before application handlers.',
  endpoint: 'Expected page-memory facts and visible business result, current relevant control enabled, visible device images decoded, fonts loaded, and two stable requestAnimationFrame callbacks. The existing 450ms save cooldown is included.',
  boundary: 'Pure page-memory interaction sample; refresh resets all demonstrated business facts. No main-app IndexedDB save, persistence, physical factory work, scanner or printer execution is claimed.',
};
if (!args.includes('--run') || args.includes('--help')) {
  console.log(JSON.stringify({ prepared: true, executed: false, config,
    usage: 'node scripts/verification/post-finishing-standalone-performance.mjs --run [--target=http://127.0.0.1:43198] [--calibration] [--output=PATH]',
    warning: 'Run only after the coordinator releases the exclusive performance window. Calibration is a separate one-sample collector check and cannot pass formal acceptance.',
  }, null, 2));
  process.exit(0);
}

const sha = data => createHash('sha256').update(data).digest('hex');
const sourceRoot = resolve('public/newpda');
const inputNames = ['post-flow-v9-boundary-verification.json', 'post-flow-v9-recheck-verification.json'];
const sourceInputs = inputNames.map(name => {
  const temporary = resolve('/private/tmp', name);
  const path = existsSync(temporary) ? temporary : resolve('docs/product-design/post-finishing-partial-flow-20261019/evidence/standalone', name);
  if (!existsSync(path)) throw new Error('Missing prior V9 evidence: ' + name);
  const bytes = readFileSync(path);
  return { path, sha256: sha(bytes), value: JSON.parse(bytes.toString()) };
});
const runId = (calibration ? 'calibration-' : 'formal-') + new Date().toISOString().replaceAll(':', '-');
const runDir = resolve(output, runId);
mkdirSync(runDir, { recursive: true });
const report = {
  format: 'post-finishing-standalone-performance-v1', runId, startedAt: new Date().toISOString(),
  config, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
  scriptSha256: sha(readFileSync(new URL(import.meta.url))),
  sourceHashes: Object.fromEntries(readdirSync(sourceRoot).filter(name => /\.(?:html|js|css)$/.test(name)).map(name => [name, sha(readFileSync(resolve(sourceRoot, name)))])),
  priorInputEvidence: sourceInputs.map(({ value, ...metadata }) => metadata),
  priorExecutable: 'The original /tmp/post-flow-v9* executable is absent; actual post-flow.js URL fixture and data-pf controls were read to prepare this collector.',
  host: { platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model,
    logicalCpus: cpus().length, ramBytes: totalmem(), freeRamBytes: freemem(), loadAverage: loadavg() },
  servedAssets: [], runtimeAssetUrls: [], browser: '', samples: [], errors: [], completed: false, passed: false,
};
function checkpoint() {
  report.familyResults = families.map(family => {
    const samples = report.samples.filter(sample => sample.family === family);
    return { family, required: trials, total: samples.length, valid: samples.filter(sample => sample.valid).length,
      maximumMs: Math.max(0, ...samples.filter(sample => Number.isFinite(sample.ms)).map(sample => sample.ms)),
      pass: samples.length >= trials && samples.every(sample => sample.valid && sample.ms <= maxMs && sample.pass) };
  });
  writeFileSync(resolve(runDir, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(resolve(output, 'latest.json'), JSON.stringify({ runId, report: resolve(runDir, 'report.json'), completed: report.completed, passed: report.passed }, null, 2));
}
sourceInputs.forEach(input => writeFileSync(resolve(runDir, input.path.split('/').at(-1)), JSON.stringify(input.value, null, 2)));
checkpoint();

// Installed before every application script. Reads state to verify endpoints;
// never writes postFlow or calls business save functions on behalf of UI.
function installCollector(defaultLoad) {
  const collector = window.__standalonePerf = { armed: null, sequence: 0, completed: [], errors: [], active: null, mutations: 0 };
  new MutationObserver(() => collector.mutations++).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const visible = element => {
    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth && style.visibility !== 'hidden' && style.display !== 'none';
  };
  function state() {
    const s = window.postFlow, x = s?.batches?.['SH-082'];
    if (!x) return null;
    return { current: s.current, view: x.view, process: x.process, registered: x.registered, qc: x.qc,
      processEntries: x.processEntries, rechecks: x.rechecks, outbounds: x.outbounds,
      history: x.history, form: x.form, selectedRecheck: x.selectedRecheck,
      selectedOutbound: x.selectedOutbound, receivingOut: s.receivingOut,
      error: s.error, notice: s.notice, readyAt: s.readyAt, progress: s.progress('SH-082') };
  }
  function ready(spec) {
    if (window.pdaPostFlowReady !== 9 || window.pdaFloorReady !== 34 || !window.pdaSessionLoggedIn) return false;
    if (document.fonts?.status !== 'loaded') return false;
    const images = [...document.querySelectorAll('.device img')].filter(visible);
    if (images.some(image => !image.complete || !image.naturalWidth)) return false;
    if (spec.selector && !document.querySelector(spec.selector)) return false;
    if (spec.text && !document.querySelector('.device')?.textContent.includes(spec.text)) return false;
    const control = document.querySelector(spec.interactive || '.device .footer button');
    if (!control || control.disabled || !visible(control) || control.getAttribute('aria-disabled') === 'true') return false;
    const x = state();
    if (!x || !same(x.qc?.pass, [600, 400]) || !same(x.qc?.items, ['开扣眼', '装扣子', '熨烫', '包装'])) return false;
    if (spec.saved && Date.now() < (x.readyAt || 0)) return false;
    if (spec.current && x.current !== 'SH-082') return false;
    if (spec.view && x.view !== spec.view) return false;
    if (spec.process && x.process !== spec.process) return false;
    if (spec.entries !== undefined && x.processEntries.length !== spec.entries) return false;
    if (spec.rechecks !== undefined && x.rechecks.length !== spec.rechecks) return false;
    if (spec.outbounds !== undefined && x.outbounds.length !== spec.outbounds) return false;
    if (spec.completed && (!same(x.progress.counts[spec.completed.item], spec.completed.quantities)
      || x.processEntries.at(-1)?.item !== spec.completed.item || !same(x.processEntries.at(-1)?.qty, spec.completed.delta)
      || !x.processEntries.at(-1)?.responsible || !x.processEntries.at(-1)?.recordedBy || !x.processEntries.at(-1)?.time)) return false;
    if (spec.recheckNo && x.selectedRecheck !== spec.recheckNo) return false;
    const r = x.rechecks.find(row => row.no === (spec.recheckNo || x.selectedRecheck));
    const o = x.outbounds.find(row => row.no === (spec.outboundNo || x.selectedOutbound));
    if (spec.recheckQuantity && (!same(r?.qty, spec.recheckQuantity) || !r.createdBy || !r.createdAt)) return false;
    if (spec.checkClaimed && (!r?.checker || r.status !== '复检中')) return false;
    if (spec.code && r?.codes[spec.code] !== '正确') return false;
    if (spec.checkCompleted && (r?.status !== '已复核' || !same(r.actual, spec.checkCompleted) || !r.completedBy || !r.completedAt
      || !r.outboundNo || o?.recheckNo !== r.no || !same(o.qty, spec.checkCompleted) || !o.actor || !o.time)) return false;
    if (spec.receiving && x.receivingOut !== spec.outboundNo) return false;
    if (spec.receipt && (!same(o?.receipt?.qty, spec.receipt) || !o.receipt.actor || !o.receipt.time || x.receivingOut)) return false;
    if (spec.receiptCount !== undefined && x.outbounds.filter(row => row.receipt).length !== spec.receiptCount) return false;
    if (spec.input && (document.querySelector('#pf-' + spec.input.key)?.value !== spec.input.value || x.form[spec.input.key] !== spec.input.value
      || !document.querySelector('#pf-live')?.textContent.startsWith('本次 ' + (Number(x.form.m) + Number(x.form.l)) + ' 件'))) return false;
    if (spec.error && (!x.error.includes(spec.error) || !document.querySelector('#pf-error')?.textContent.includes(spec.error))) return false;
    if (spec.businessFingerprint && JSON.stringify({ entries: x.processEntries, rechecks: x.rechecks, outbounds: x.outbounds, history: x.history }) !== spec.businessFingerprint) return false;
    if (spec.retained && (!same([document.querySelector('#pf-m')?.value, document.querySelector('#pf-l')?.value], spec.retained) || !same([x.form.m, x.form.l], spec.retained))) return false;
    return true;
  }
  function begin(family, spec, start, event) {
    const token = ++collector.sequence;
    collector.active = { token, family, spec, start, event };
    let finishing = false;
    function check() {
      if (collector.active?.token !== token || finishing) return;
      if (!ready(spec)) return requestAnimationFrame(check);
      finishing = true;
      const generation = collector.mutations;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (collector.active?.token !== token) return;
        if (collector.mutations !== generation || !ready(spec)) { finishing = false; return requestAnimationFrame(check); }
        collector.completed.push({ token, family, start, end: performance.now(), ms: performance.now() - start,
          event, proof: JSON.parse(JSON.stringify(state())),
          interactable: document.querySelector(spec.interactive || '.device .footer button')?.textContent.trim(),
          visibleImages: [...document.querySelectorAll('.device img')].filter(visible).map(image => ({ src: image.currentSrc, naturalWidth: image.naturalWidth })),
          resourceTiming: family.startsWith('page:cold') || family === 'page:refresh' ? performance.getEntriesByType('resource').map(entry => ({ name: entry.name, duration: entry.duration, transferSize: entry.transferSize })) : undefined,
        });
        collector.active = null;
      }));
    }
    requestAnimationFrame(check);
    return token;
  }
  collector.arm = (family, spec, eventType = 'click', selector = '') => {
    const token = collector.sequence + 1;
    collector.armed = { family, spec, eventType, selector };
    return token;
  };
  for (const eventType of ['click', 'input', 'keydown']) window.addEventListener(eventType, event => {
    const armed = collector.armed;
    if (!armed || armed.eventType !== event.type || armed.selector && !event.target.closest(armed.selector)) return;
    collector.armed = null;
    begin(armed.family, armed.spec, performance.now(), { type: event.type, isTrusted: event.isTrusted,
      selector: armed.selector, target: event.target.getAttribute?.('data-pf') || event.target.id || event.target.tagName });
  }, true);
  window.addEventListener('DOMContentLoaded', () => {
    let load = defaultLoad;
    try { load = JSON.parse(window.name || '{}').standaloneLoad || load; } catch {}
    if (load) begin(load.family, load.spec, 0, { type: 'navigation', navigationType: performance.getEntriesByType('navigation')[0]?.type });
  }, { once: true });
  collector.read = () => JSON.parse(JSON.stringify(state()));
  collector.ready = ready;
}

let browser;
let context;
async function collect(page, family, token, details = {}) {
  try {
    await page.waitForFunction(({ family, token }) => window.__standalonePerf.completed.some(sample => sample.family === family && sample.token === token), { family, token }, { timeout: 15000, polling: 'raf' });
    const value = await page.evaluate(({ family, token }) => window.__standalonePerf.completed.find(sample => sample.family === family && sample.token === token), { family, token });
    const valid = value.event.type === 'navigation' || value.event.isTrusted === true;
    const sample = { ...value, ...details, valid, pass: valid && value.ms <= maxMs, maxMs };
    report.samples.push(sample); checkpoint();
    if (!valid) throw new Error('Collector has no trusted event: ' + family);
    return sample;
  } catch (error) {
    if (!report.samples.some(sample => sample.family === family && sample.token === token && sample.context === details.context)) {
      report.samples.push({ family, token, ...details, valid: false, pass: false, ms: null, error: String(error), pending: await page.evaluate(() => window.__standalonePerf?.active).catch(() => null) });
    }
    checkpoint();
    throw error;
  }
}
async function action(page, family, selector, spec, perform, details = {}) {
  const token = await page.evaluate(({ family, spec, selector, eventType }) => window.__standalonePerf.arm(family, spec, eventType, selector), { family, spec, selector, eventType: perform ? 'input' : 'click' });
  if (perform) await perform(); else await page.locator(selector).click();
  return collect(page, family, token, details);
}
async function newPage(load) {
  context = await browser.newContext({ viewport: config.viewport, timezoneId: config.timezone });
  await context.addInitScript(installCollector, load);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => { report.errors.push({ type: 'pageerror', message: error.message }); checkpoint(); });
  page.on('response', response => {
    const asset = report.servedAssets.find(value => value.url === response.url());
    if (!asset) return;
    report.runtimeAssetUrls.push({ responseIndex: report.runtimeAssetUrls.length, url: response.url(), status: response.status(),
      preflightSha256: asset.sha256, sourceSha256: report.sourceHashes[asset.name] });
  });
  return page;
}
const baseSpec = { current: true, view: 'work', process: '开扣眼', entries: 0, rechecks: 0, outbounds: 0,
  selector: '#pf-m', interactive: '[data-pf="view:work"]', text: '开扣眼 · 本次登记' };
const fingerprint = state => JSON.stringify({ entries: state.processEntries, rechecks: state.rechecks, outbounds: state.outbounds, history: state.history });
try {
  // Bind the target to actual served assets before formal contexts. This does
  // not populate any browser cache or manufacture business records.
  let servedIndex = '';
  for (const name of ['index.html', 'post-flow.js', 'post-flow.css', 'handoff-context.js']) {
    const attribute = name === 'index.html' ? null : servedIndex.match(new RegExp('(?:src|href)="(' + name.replaceAll('.', '\\.') + '\\?[^"\\s]+)"'))?.[1];
    if (name !== 'index.html' && !attribute) throw new Error('Versioned runtime asset is missing from served index: ' + name);
    const assetUrl = new URL(attribute || name, origin + '/newpda/').href;
    const response = await fetch(assetUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('Target asset unavailable: ' + name + ' HTTP ' + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (name === 'index.html') servedIndex = bytes.toString('utf8');
    const served = { name, url: response.url, sha256: sha(bytes), matchesSource: sha(bytes) === report.sourceHashes[name], bytes: bytes.length };
    report.servedAssets.push(served);
    if (!served.matchesSource) throw new Error('Target differs from current standalone source: ' + name);
  }
  browser = await chromium.launch({ headless: true });
  report.browser = browser.version(); checkpoint();
  for (let iteration = 1; iteration <= trials; iteration++) {
    const page = await newPage({ family: 'page:cold-entry', spec: baseSpec });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await collect(page, 'page:cold-entry', 1, { context: 'cold-' + iteration, iteration, fixture: 'D1 1000; no entries' });
    await page.evaluate(spec => { window.name = JSON.stringify({ standaloneLoad: { family: 'page:refresh', spec } }); }, baseSpec);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await collect(page, 'page:refresh', 1, { context: 'cold-' + iteration, iteration, fixture: 'D1 1000; refresh rebuilds URL example' });
    await context.close(); context = null;
  }

  const page = await newPage(null);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(spec => window.__standalonePerf?.ready(spec), baseSpec);
  const initial = await page.evaluate(() => window.__standalonePerf.read());
  writeFileSync(resolve(runDir, 'initial-D1.json'), JSON.stringify(initial, null, 2));
  let entries = 0;
  let cumulative = [0, 0];
  for (let iteration = 1; iteration <= trials; iteration++) {
    const detail = { context: 'genuine-ui-D1', iteration, totalQuantity: 1000 };
    const qty = config.fixture.increments[iteration - 1];
    cumulative = cumulative.map((value, index) => value + qty[index]);
    await action(page, 'page:queue', '#review-nav [data-go="process-list"]', { selector: '.pf-home', interactive: '[data-pf="open:SH-082"]', text: 'SH-082' }, null, detail);
    await action(page, 'page:in-app-entry', '[data-pf="open:SH-082"]', { current: true, selector: '.pf-tabs', interactive: '[data-pf="view:work"]' }, null, detail);
    await action(page, 'page:view:work', '[data-pf="view:work"]', { current: true, view: 'work', selector: '#pf-m', interactive: '[data-pf="view:work"]' }, null, detail);
    for (const item of items) {
      await action(page, 'page:item:' + item, '[data-pf="item:' + item + '"]', { current: true, view: 'work', process: item, selector: '#pf-m', interactive: '.footer [data-pf="save"]', text: item + ' · 本次登记' }, null, detail);
      if (item === items[0]) {
        const before = await page.evaluate(() => window.__standalonePerf.read());
        const availableM = 600 - (cumulative[0] - qty[0]);
        // progress().forItem is a function and is deliberately not serialized;
        // the first item's exact remaining quantity follows the D1 basis.
        const invalid = [String(availableM + 1), '0'];
        await page.locator('#pf-m').fill(invalid[0]); await page.locator('#pf-l').fill(invalid[1]);
        await action(page, 'failure:quantity-upper-bound', '.footer [data-pf="save"]', { error: '超过该尺码本次可登记量', retained: invalid, entries, businessFingerprint: fingerprint(before), interactive: '.footer [data-pf="save"]' }, null, detail);
        await page.locator('#scenario').selectOption('failed');
        await page.locator('#pf-m').fill(String(qty[0])); await page.locator('#pf-l').fill(String(qty[1]));
        await action(page, 'failure:simulated-save', '.footer [data-pf="save"]', { error: '未保存，填写已保留', retained: qty.map(String), entries, businessFingerprint: fingerprint(before), interactive: '.footer [data-pf="save"]' }, null, detail);
        if (iteration === 1) await page.screenshot({ path: resolve(runDir, 'failed-input-retained.png'), fullPage: true });
        await page.locator('#scenario').selectOption('normal');
      }
      if (item === items.at(-1)) {
        await action(page, 'action:quantity:M:input', '#pf-m', { input: { key: 'm', value: String(qty[0]) }, interactive: '.footer [data-pf="save"]' }, () => page.locator('#pf-m').fill(String(qty[0])), detail);
        await action(page, 'action:quantity:L:input', '#pf-l', { input: { key: 'l', value: String(qty[1]) }, interactive: '.footer [data-pf="save"]' }, () => page.locator('#pf-l').fill(String(qty[1])), detail);
      } else {
        await page.locator('#pf-m').fill(String(qty[0])); await page.locator('#pf-l').fill(String(qty[1]));
      }
      entries++;
      await action(page, 'action:process:' + item + ':save', '.footer [data-pf="save"]', { saved: true, entries, rechecks: iteration - 1, outbounds: iteration - 1,
        completed: { item, quantities: cumulative, delta: qty }, text: '本次已保存 ' + (qty[0] + qty[1]) + ' 件', interactive: '.footer [data-pf="save"]' }, null, { ...detail, submittedQuantity: qty });
    }
    await action(page, 'page:view:submit', '[data-pf="view:submit"]', { current: true, view: 'submit', selector: '#pf-m', interactive: '.footer [data-pf="save"]', text: '本次交复检' }, null, detail);
    await page.locator('#pf-m').fill(String(qty[0])); await page.locator('#pf-l').fill(String(qty[1]));
    const recheckNo = 'FH-082-' + String(iteration).padStart(3, '0');
    const outboundNo = 'CH-082-' + String(iteration).padStart(3, '0');
    await action(page, 'action:submit-recheck', '.footer [data-pf="save"]', { saved: true, rechecks: iteration, outbounds: iteration - 1, recheckNo, recheckQuantity: qty,
      text: '已生成 ' + recheckNo, interactive: '[data-pf="view:check"]' }, null, { ...detail, submittedQuantity: qty });
    await action(page, 'page:view:check', '[data-pf="view:check"]', { current: true, view: 'check', recheckNo, interactive: '[data-pf="claim-check"]', text: recheckNo }, null, detail);
    await action(page, 'action:claim-recheck', '[data-pf="claim-check"]', { saved: true, checkClaimed: true, recheckNo, selector: '#pf-code-m', interactive: '.footer [data-pf="save"]' }, null, detail);
    for (const [key, size] of [['m', 'M'], ['l', 'L']]) {
      await page.locator('#pf-code-' + key).fill('SKU-082-' + size);
      await action(page, 'action:barcode:' + size, '[data-pf="scan-' + key + '"]', { recheckNo, code: key, interactive: '.footer [data-pf="save"]' }, null, detail);
    }
    await action(page, 'action:complete-recheck', '.footer [data-pf="save"]', { saved: true, recheckNo, checkCompleted: qty, outbounds: iteration,
      text: '本张复检完成，已生成 ' + outboundNo, interactive: '[data-pf="view:out"]' }, null, detail);
    await action(page, 'page:view:out', '[data-pf="view:out"]', { current: true, view: 'out', outboundNo,
      interactive: '.footer [data-pf="receive-out"]', text: outboundNo }, null, detail);
    await action(page, 'action:receipt:open', '.footer [data-pf="receive-out"]', { receiving: true, outboundNo, selector: '#pf-m', interactive: '.footer [data-pf="save"]' }, null, detail);
    await action(page, 'action:receipt:save', '.footer [data-pf="save"]', { saved: true, receipt: qty, outboundNo, receiptCount: iteration,
      text: '本张实收一致', interactive: '.footer button' }, null, detail);
  }
  report.finalInMemoryReadback = await page.evaluate(() => window.__standalonePerf.read());
  const final = report.finalInMemoryReadback;
  if (final.processEntries.length !== trials * 4 || final.rechecks.length !== trials || final.outbounds.length !== trials
    || final.outbounds.some(row => !row.receipt || JSON.stringify(row.receipt.qty) !== JSON.stringify(row.qty))
    || JSON.stringify(final.progress.finished) !== '[600,400]' || JSON.stringify(final.progress.reserved) !== '[600,400]'
    || JSON.stringify(final.progress.available) !== '[0,0]') throw new Error('Final D1 in-memory conservation failed.');
  await page.screenshot({ path: resolve(runDir, 'final-D1-1000-memory-only.png'), fullPage: true });
  // A separate untimed readback demonstrates the stated reset boundary. It is
  // not a persistence success or another formal refresh performance sample.
  await page.evaluate(() => { window.name = ''; });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(spec => window.__standalonePerf?.ready(spec), baseSpec);
  report.afterRefreshReset = await page.evaluate(() => window.__standalonePerf.read());
  if (report.afterRefreshReset.processEntries.length || report.afterRefreshReset.rechecks.length || report.afterRefreshReset.outbounds.length) throw new Error('Standalone refresh did not reset the URL example as documented.');
  for (const name of ['post-flow.js', 'post-flow.css', 'handoff-context.js']) {
    const asset = report.servedAssets.find(value => value.name === name);
    if (!report.runtimeAssetUrls.some(value => value.url === asset.url && value.status === 200)) throw new Error('Browser did not load the bound versioned asset: ' + name);
  }
  report.completed = true;
  checkpoint();
  report.passed = !calibration && !report.errors.length && report.familyResults.every(family => family.pass);
  report.calibrationPassed = calibration && !report.errors.length && report.familyResults.every(family => family.pass);
} catch (error) {
  report.errors.push({ type: 'runner', message: error.stack || String(error) });
  if (context?.pages()[0]) await context.pages()[0].screenshot({ path: resolve(runDir, 'collector-stop.png'), fullPage: true }).catch(() => undefined);
  process.exitCode = 1;
} finally {
  if (context) await context.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
  report.finishedAt = new Date().toISOString(); checkpoint();
  if (!report.passed && !report.calibrationPassed) process.exitCode = 1;
  console.log(JSON.stringify({ runId, report: resolve(runDir, 'report.json'), completed: report.completed, passed: report.passed,
    calibrationPassed: report.calibrationPassed || false, samples: report.samples.length, errors: report.errors }, null, 2));
}
