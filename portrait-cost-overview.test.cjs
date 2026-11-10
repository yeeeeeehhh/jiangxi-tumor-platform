/* 医保费用分析 UI 回归。运行本地服务后执行；复用项目的 Playwright 测试方式。 */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.SP_BROWSER_CHANNEL || 'chrome', headless: true });
  const output = path.join(__dirname, 'portrait-cost-qa');
  fs.mkdirSync(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let checks = 0;
  async function check(name, run) { await run(); checks++; console.log('PASS ' + name); }
  try {
    await page.goto(process.env.SP_TEST_URL || 'http://127.0.0.1:8017/app.html');
    await page.evaluate(() => navigateTo('sp-overview'));
    await page.getByRole('tab', { name: '医保费用', exact: true }).click();
    await check('费用默认统计表，表图金额一致且单位与数据刷新不改变视图', async () => {
      const values = page.locator('.sp-cost-summary-table td:last-child');
      const original = ['534,720.00元', '13 / 13 人', '41,132.31元', '29.1%', '11.0%'];
      assert.equal(await page.getByRole('button', { name: '表格视图', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await values.allTextContents(), original);
      assert.equal(await page.locator('.sp-cost-stat-table').count(), 3);
      assert.equal(await page.locator('.sp-cost-ring,.sp-cost-ranking').count(), 0);
      await page.getByRole('button', { name: '万元', exact: true }).click();
      assert.deepEqual(await values.allTextContents(), ['53.47万元', '13 / 13 人', '4.11万元', '29.1%', '11.0%']);
      await page.evaluate(() => SPCost.setData(SPCost.demo()));
      assert.equal(await page.locator('.sp-cost-stat-table').count(), 3);
      await page.getByRole('button', { name: '图表视图', exact: true }).click();
      assert.deepEqual(await page.locator('.sp-cost-kpi .v').allTextContents(), ['53.47万元', '13 / 13 人', '4.11万元', '29.1%', '11.0%']);
      await page.getByRole('button', { name: '表格视图', exact: true }).click();
      await page.getByRole('button', { name: '元', exact: true }).click();
      assert.deepEqual(await values.allTextContents(), original);
      await page.getByRole('button', { name: '图表视图', exact: true }).click();
    });
    const panel = page.locator('.sp-cost-overview');
    const values = panel.locator('.sp-cost-kpi .v');
    const original = await values.allTextContents();
    await check('原有费用与覆盖人数保持一致，排行按真实金额降序且条形可见', async () => {
      assert.deepEqual(original, ['534,720.00元', '13 / 13 人', '41,132.31元', '29.1%', '11.0%']);
      assert.deepEqual(await panel.locator('.sp-cost-rank-label').allTextContents(), ['药品费', '耗材费', '手术费', '治疗费', '检查检验费', '其他费用']);
      assert.equal(await panel.locator('.sp-cost-ring strong').textContent(), '66.3%');
      const bars = await panel.locator('.sp-cost-row-track span').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, color: getComputedStyle(node).backgroundColor })));
      assert.equal(bars.length, 6);
      assert.ok(bars.every(bar => bar.width > 0 && bar.color !== 'rgba(0, 0, 0, 0)'));
    });
    await check('元与万元切换正确换算所有金额，覆盖人数与比例不变', async () => {
      await panel.getByRole('button', { name: '万元', exact: true }).click();
      assert.deepEqual(await values.allTextContents(), ['53.47万元', '13 / 13 人', '4.11万元', '29.1%', '11.0%']);
      assert.ok((await panel.locator('.sp-cost-legend-amount').allTextContents()).every(text => text.endsWith('万元')));
      assert.equal(await panel.locator('.sp-cost-row-amount').first().textContent(), '13.68万元');
      assert.equal(await panel.getByRole('button', { name: '万元', exact: true }).getAttribute('aria-pressed'), 'true');
      await panel.getByRole('button', { name: '元', exact: true }).click();
      assert.deepEqual(await values.allTextContents(), original);
    });
    await check('键盘展开其他费用，更新单位后保留展开状态并正确换算', async () => {
      const summary = panel.locator('summary');
      await summary.focus();
      await page.keyboard.press('Enter');
      assert.equal(await panel.locator('details').evaluate(el => el.open), true);
      await panel.getByRole('button', { name: '万元', exact: true }).click();
      assert.equal(await panel.locator('details').evaluate(el => el.open), true);
      assert.match(await panel.locator('details').textContent(), /多瘤例共同费用：0.16万元（1 笔）/);
      await panel.getByRole('button', { name: '元', exact: true }).click();
      await panel.locator('summary').click();
    });
    await check('上方瘤种筛选联动，重置恢复完整费用', async () => {
      await page.locator('#spScopeSite').selectOption({ index: 1 });
      assert.notDeepEqual(await values.allTextContents(), original);
      assert.equal(await panel.locator('.sp-cost-row-track').count(), 6);
      await page.evaluate(() => window._spScopeReset());
      assert.deepEqual(await values.allTextContents(), original);
    });
    await check('缺失支付或分类不显示误导图表，未接入与无结算分开展示', async () => {
      await page.evaluate(() => {
        const demo = SPCost.demo();
        demo.records[0].cash = null;
        demo.records[0].items = null;
        SPCost.setData(demo);
      });
      assert.equal(await panel.locator('.sp-cost-ring').count(), 0);
      assert.equal(await panel.locator('.sp-cost-ranking').count(), 0);
      assert.equal(await values.nth(3).textContent(), '—');
      assert.equal(await panel.locator('.sp-cost-overview-empty').count(), 2);
      await page.evaluate(() => SPCost.setData({ mode: 'live', connected: false, records: [] }));
      assert.ok((await panel.textContent()).includes('医保结算数据未接入'));
      await page.evaluate(() => SPCost.setData({ mode: 'live', connected: true, records: [] }));
      assert.ok((await panel.textContent()).includes('暂无已关联的有效医保费用'));
      await page.evaluate(() => SPCost.setData(SPCost.demo()));
    });
    await check('1440 与 1280 桌面宽度、1024 窄屏均无模块溢出', async () => {
      for (const width of [1440, 1280, 1024]) {
        await page.setViewportSize({ width, height: 1400 });
        await panel.scrollIntoViewIfNeeded();
        const overflow = await panel.evaluate(el => {
          const bounds = el.getBoundingClientRect();
          return Array.from(el.querySelectorAll('*')).filter(node => {
            if (!node.getClientRects().length || (node.closest('details') && !node.closest('details').open && !node.closest('summary'))) return false;
            const rect = node.getBoundingClientRect();
            return rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).display !== 'inline';
          }).map(node => node.className);
        });
        assert.deepEqual(overflow, [], `${width}px overflow`);
        await panel.screenshot({ path: path.join(output, `overview-${width}.png`) });
      }
    });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await panel.scrollIntoViewIfNeeded();
    await panel.screenshot({ path: path.join(output, 'after.png') });
    await page.screenshot({ path: path.join(output, 'after-page.png') });
    await check('320px 独立模块下指标、排行与单位切换保持可读', async () => {
      await page.setViewportSize({ width: 1440, height: 2000 });
      await panel.evaluate(el => { el.style.width = '320px'; });
      assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
      await panel.screenshot({ path: path.join(output, 'overview-320.png') });
    });
    assert.deepEqual(errors, []);
    console.log(`${checks} UI checks passed; no page errors.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
