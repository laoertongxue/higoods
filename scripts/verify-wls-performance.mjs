/**
 * WLS 页面性能验证脚本
 * 
 * 使用方法：
 * 1. 在浏览器控制台运行此脚本
 * 2. 或在 Chrome DevTools 的 Performance 面板录制
 * 
 * 验证标准：AGENTS.md §7.2 要求所有页面加载和交互 < 500ms
 */

(function() {
  'use strict';
  
  const results = [];
  
  // 辅助函数：等待页面渲染完成
  function waitForRender(selector, textMatch, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const el = document.querySelector(selector);
        if (el && (!textMatch || el.textContent?.includes(textMatch))) {
          resolve();
        } else if (Date.now() - start > timeout) {
          reject(new Error('Timeout waiting for render'));
        } else {
          requestAnimationFrame(check);
        }
      };
      check();
    });
  }
  
  // 测试 1: 站内导航性能（从 dashboard 到 collection/orders）
  async function testInAppNavigation() {
    console.log('🧪 测试站内导航性能...');
    
    const iterations = 5;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      // 先导航到 dashboard
      const navToDashboard = document.querySelector('[data-nav="/wls/finished/dashboard"]');
      if (navToDashboard) {
        const start = performance.now();
        navToDashboard.click();
        await waitForRender('[data-page-content-root]', null, 2000);
        const end = performance.now();
        times.push(end - start);
      }
      
      // 再导航到 collection/orders
      const navToOrders = document.querySelector('[data-nav="/wls/finished/collection/orders"]');
      if (navToOrders) {
        const start = performance.now();
        navToOrders.click();
        await waitForRender('[data-standard-list-page]', '集货订单', 2000);
        const end = performance.now();
        times.push(end - start);
      }
      
      // 等待一下再进行下一次迭代
      await new Promise(r => setTimeout(r, 100));
    }
    
    const avg = times.reduce((s, t) => s + t, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);
    const pass = max < 500;
    
    results.push({
      test: '站内导航',
      iterations,
      avg: avg.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      pass,
      times: times.map(t => t.toFixed(2))
    });
    
    console.log(`✅ 站内导航: 平均 ${avg.toFixed(2)}ms, 最大 ${max.toFixed(2)}ms, ${pass ? '通过' : '失败'}`);
  }
  
  // 测试 2: 交互性能（查询、重置、分页）
  async function testInteractions() {
    console.log('🧪 测试交互性能...');
    
    const times = [];
    
    // 测试查询按钮
    const queryBtn = document.querySelector('[data-wls-collection-orders-action="apply-filter"]');
    if (queryBtn) {
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        queryBtn.click();
        await new Promise(r => requestAnimationFrame(r));
        const end = performance.now();
        times.push(end - start);
      }
    }
    
    // 测试重置按钮
    const resetBtn = document.querySelector('[data-wls-collection-orders-action="reset-filter"]');
    if (resetBtn) {
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        resetBtn.click();
        await new Promise(r => requestAnimationFrame(r));
        const end = performance.now();
        times.push(end - start);
      }
    }
    
    // 测试分页
    const nextBtn = document.querySelector('[data-wls-collection-orders-action="next-page"]');
    if (nextBtn) {
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        nextBtn.click();
        await new Promise(r => requestAnimationFrame(r));
        const end = performance.now();
        times.push(end - start);
      }
    }
    
    const avg = times.reduce((s, t) => s + t, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);
    const pass = max < 500;
    
    results.push({
      test: '交互响应',
      iterations: times.length,
      avg: avg.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      pass,
      times: times.map(t => t.toFixed(2))
    });
    
    console.log(`✅ 交互响应: 平均 ${avg.toFixed(2)}ms, 最大 ${max.toFixed(2)}ms, ${pass ? '通过' : '失败'}`);
  }
  
  // 测试 3: 输入性能（搜索框）
  async function testInputPerformance() {
    console.log('🧪 测试输入性能...');
    
    const input = document.querySelector('[data-wls-collection-orders-field="keyword"]');
    if (!input) return;
    
    const times = [];
    const testValues = ['JH', 'JH-2026', 'POUT', 'SO-2026', 'TikTok'];
    
    for (const value of testValues) {
      const start = performance.now();
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => requestAnimationFrame(r));
      const end = performance.now();
      times.push(end - start);
    }
    
    const avg = times.reduce((s, t) => s + t, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);
    const pass = max < 500;
    
    results.push({
      test: '输入响应',
      iterations: times.length,
      avg: avg.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      pass,
      times: times.map(t => t.toFixed(2))
    });
    
    console.log(`✅ 输入响应: 平均 ${avg.toFixed(2)}ms, 最大 ${max.toFixed(2)}ms, ${pass ? '通过' : '失败'}`);
  }
  
  // 运行所有测试
  async function runAllTests() {
    console.log('🚀 开始 WLS 页面性能验证...\n');
    
    try {
      await testInAppNavigation();
      await testInteractions();
      await testInputPerformance();
      
      console.log('\n📊 性能验证结果：');
      console.table(results);
      
      const allPass = results.every(r => r.pass);
      console.log(`\n${allPass ? '✅ 所有测试通过' : '❌ 部分测试失败'}`);
      
      if (!allPass) {
        console.log('\n⚠️ 失败的测试需要优化以满足 < 500ms 的硬门禁要求');
      }
      
      return results;
    } catch (error) {
      console.error('❌ 测试执行失败:', error);
    }
  }
  
  // 导出到全局
  window.wlsPerformanceTest = runAllTests;
  
  console.log('💡 运行 window.wlsPerformanceTest() 开始性能验证');
})();
