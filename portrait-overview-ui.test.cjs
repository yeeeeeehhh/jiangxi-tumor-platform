const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1800 }, acceptDownloads: true });
  const errors = [], out = path.join(__dirname, 'portrait-overview-qa');
  let checks = 0;
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.__SP_TEST__ = true; });
  async function check(name, fn) { await fn(); checks++; console.log('PASS ' + name); }
  try {
    await page.goto(process.env.SP_TEST_URL || 'http://127.0.0.1:8017/app.html');
    await page.evaluate(() => navigateTo('sp-overview'));
    await check('总览按四个画像维度导航且无官方达标卡', async () => {
      assert.deepEqual(await page.locator('.sp-domain-tab').allTextContents(), ['患者基础', '肿瘤特征', '诊疗过程', '随访与结局', '医保费用']);
      assert.equal(await page.locator('.sp-kpi-tag').count(), 0);
      assert.equal(await page.locator('.sp-overview-summary').count(), 0);
      assert.equal(await page.locator('.sp-cost-overview').count(), 0);
      await page.locator('.sp-overview-v14').screenshot({ path: path.join(out, '04-after-overview.png') });
    });
    await check('饼图、环图与柱状图均可按图形核对记录，零值年龄段保留', async () => {
      const slice = page.locator('[data-overview-field="sex"] svg [role="button"]').first();
      await slice.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.getByRole('dialog').locator('tbody tr').count(), 7);
      await page.keyboard.press('Escape');
      const ring = page.locator('[data-overview-field="insurance"] svg [role="button"]').first();
      await ring.focus(); await page.keyboard.press('Space');
      assert.equal(await page.getByRole('dialog').locator('tbody tr').count(), 8);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-overview-field="age"] .sp-column-item').count(), 5);
      await page.getByRole('button', { name: '60–69 岁：6 例，查看记录', exact: true }).click();
      assert.equal(await page.getByRole('dialog').locator('tbody tr').count(), 6);
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.activeElement.blur());
      await page.locator('#spDomainBody > .sp-field-grid').first().screenshot({ path: path.join(out, '11-restored-charts.png') });
    });
    await check('统计分类打开真实组成记录，并可进入对应画像再返回总览', async () => {
      await page.locator('[data-overview-field="sex"]').getByRole('button', { name: '女', exact: true }).click();
      const dialog = page.getByRole('dialog');
      assert.equal(await dialog.locator('tbody tr').count(), 7);
      assert.ok((await dialog.textContent()).includes('当前 7 人'));
      await dialog.screenshot({ path: path.join(out, '07-field-evidence.png') });
      await dialog.locator('[data-event-id]').first().click();
      assert.equal(await page.locator('[data-profile-field="sex"] .v').textContent(), '女');
      assert.equal(await page.locator('[data-profile-field]').count(), 35);
      await page.locator('.sp-profile-blocks').screenshot({ path: path.join(out, '08-aligned-profile.png') });
      await page.getByRole('button', { name: '返回总览', exact: true }).click();
      assert.equal(await page.locator('.sp-overview-v14').count(), 1);
    });
    await check('肿瘤特征聚焦五项图表，TNM 移入明细，手术未记录可在原画像核对', async () => {
      await page.getByRole('tab', { name: '肿瘤特征', exact: true }).click();
      assert.equal(await page.locator('[data-overview-field="stage"]').count(), 1);
      assert.equal(await page.locator('[data-overview-field="tnm"]').count(), 0);
      assert.equal(await page.locator('[data-overview-field="diagdate"]').count(), 0);
      assert.equal(await page.locator('.sp-field-card').count(), 5);
      assert.equal(await page.locator('[data-overview-field="grade"]').count(), 1);
      await page.locator('[data-record-section="tumor"] summary').click();
      assert.equal(await page.locator('[data-record-section="tumor"] tbody tr').count(), 14);
      assert.equal(await page.locator('[data-record-event="TE001"] [data-record-value="tnm"]').textContent(), 'cT2aN2M0');
      await page.locator('[data-record-section="tumor"] summary').click();
      await page.locator('#spDomainBody').screenshot({ path: path.join(out, '05-after-tumor.png') });
      await page.getByRole('tab', { name: '诊疗过程', exact: true }).click();
      await page.locator('.sp-treatment-details summary').click();
      const surgery = page.locator('#spDomainBody > section tr').filter({ has: page.locator('td:first-child', { hasText: /^手术$/ }) });
      assert.match(await surgery.textContent(), /11 例.*78.6%.*0.*3/);
      await surgery.getByRole('button', { name: '查看记录' }).click();
      const dialog = page.getByRole('dialog');
      assert.equal(await dialog.locator('tbody tr').count(), 14);
      const unknown = dialog.locator('tbody tr').filter({ has: page.locator('td:nth-child(3)', { hasText: /^未记录$/ }) });
      assert.equal(await unknown.count(), 3);
      await unknown.first().locator('[data-event-id]').click();
      assert.equal(await page.locator('[data-profile-field="mode0"] .v').textContent(), '未记录');
      await page.getByRole('button', { name: '返回总览', exact: true }).click();
      await page.locator('#spDomainBody').screenshot({ path: path.join(out, '06-after-treatment.png') });
    });
    await check('月份趋势保留真实时间间距，治疗堆叠缺失段下钻正确', async () => {
      const points = await page.locator('[data-overview-field="tfirst"] svg circle').evaluateAll(es => es.map(e => ({ x: Number(e.getAttribute('cx')), label: e.getAttribute('aria-label') })));
      assert.equal(points.length, 9);
      assert.ok(points[1].x - points[0].x > (points[2].x - points[1].x) * 10);
      const month = page.locator('[data-overview-field="tfirst"] svg circle').nth(5);
      await month.click();
      assert.equal(await page.getByRole('dialog').locator('tbody tr').count(), 3);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.sp-treatment-stack').count(), 6);
      await page.getByRole('button', { name: '手术，未记录：3 例，查看记录', exact: true }).click();
      assert.equal(await page.getByRole('dialog').locator('tbody tr').count(), 3);
      await page.keyboard.press('Escape');
    });
    await check('页面已清理技术提示，各分区仍有图表及明细入口', async () => {
      for (const name of ['患者基础', '肿瘤特征', '诊疗过程', '随访与结局']) {
        await page.getByRole('tab', { name, exact: true }).click();
        const body = await page.locator('.sp-overview-v14').innerText();
        assert.ok(!/画像字段|分母|按患者去重|与画像第|字段核对|已对齐|统计口径|不代表|按当前画像/.test(body));
        assert.ok(await page.locator('.sp-field-card').count() >= 4);
        assert.equal(await page.locator('.sp-cost-overview').count(), 0);
      }
      await page.getByRole('tab', { name: '患者基础', exact: true }).click();
      await page.locator('[data-overview-field="insurance"]').getByRole('button', { name: '明细', exact: true }).click();
      assert.equal(await page.getByRole('dialog').locator('tbody tr').count(), 13);
      assert.ok(!(await page.getByRole('dialog').innerText()).includes('按患者去重'));
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(), 0);
    });
    await check('历史截止日从核对记录带入画像，未来随访保持未记录', async () => {
      await page.locator('#spScopeCutoff').fill('2026-02-10');
      await page.locator('#spScopeCutoff').dispatchEvent('change');
      await page.getByRole('tab', { name: '随访与结局', exact: true }).click();
      await page.locator('[data-overview-field="lastfu"]').getByRole('button', { name: '未记录', exact: true }).click();
      await page.getByRole('dialog').locator('[data-event-id="TE001"]').click();
      assert.equal(await page.locator('[data-profile-field="lastfu"] .v').textContent(), '未记录');
      assert.ok((await page.locator('.sp-overview-context').textContent()).includes('2026-02-10'));
      await page.getByRole('button', { name: '返回总览', exact: true }).click();
      await page.locator('.sp-filter-actions').getByRole('button', { name: '重置', exact: true }).click();
    });
    await check('筛选医院可命中非主医院的患者，重置恢复 13 人 / 14 瘤例', async () => {
      await page.getByRole('tab', { name: '患者基础', exact: true }).click();
      await page.locator('#spScopeHospital').selectOption({ label: '江西省肿瘤医院' });
      const hospRow = page.locator('[data-overview-field="hospital"]').locator('.sp-field-bar-row', { hasText: '江西省肿瘤医院' });
      assert.match(await hospRow.textContent(), /7 人/);
      await page.locator('.sp-filter-actions').getByRole('button', { name: '查看患者', exact: true }).click();
      assert.ok((await page.locator('.sp-card-no').allTextContents()).includes('JX-2026-000318'));
      await page.getByRole('button', { name: '返回总览', exact: true }).click();
      await page.locator('.sp-filter-actions').getByRole('button', { name: '重置', exact: true }).click();
      assert.equal((await page.locator('[data-overview-field="insurance"] .sp-ring-total').textContent()).trim(), '13');
      assert.equal(await page.locator('[data-overview-field="screenorg"] .sp-field-bar-row').count(), 13);
      assert.equal(await page.locator('[data-overview-field="screentype"] .sp-field-bar-row').count(), 10);
    });
    await check('CSV 实际下载包含正确治疗缺失数、统计对象及相同费用', async () => {
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: '导出 CSV', exact: true }).click();
      const download = await pending;
      const file = path.join(out, 'overview-export.csv'); await download.saveAs(file);
      const csv = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
      assert.ok(csv.startsWith('分区,画像字段,统计项,数值,单位,统计对象,分母'));
      assert.ok(csv.includes('诊疗过程,放疗,有效记录,3,例,瘤例,14,3,11,0,0'));
      assert.ok(csv.includes('医保费用分析,群体累计医疗费用,群体累计医疗费用,534720,元'));
      assert.ok(csv.includes('共同关联费用,共同关联费用,1600,元'));
      await page.getByRole('tab', { name: '医保费用', exact: true }).click();
      assert.equal(await page.locator('.sp-cost-kpi .v').first().textContent(), '534,720.00元');
    });
    await check('费用只在独立页签展示，切换及筛选不残留其他分区', async () => {
      assert.equal(await page.locator('#spDomainBody > .sp-cost-overview').count(), 1);
      assert.equal(await page.locator('[data-overview-field]').count(), 0);
      await page.getByRole('button', { name: '万元', exact: true }).click();
      await page.getByRole('tab', { name: '肿瘤特征', exact: true }).click();
      assert.equal(await page.locator('.sp-cost-overview').count(), 0);
      await page.locator('#spScopeSite').selectOption({ index: 1 });
      assert.equal(await page.locator('.sp-cost-overview').count(), 0);
      await page.getByRole('tab', { name: '医保费用', exact: true }).click();
      assert.equal(await page.locator('[data-overview-field]').count(), 0);
      assert.notEqual(await page.locator('.sp-cost-kpi .v').first().textContent(), '53.47万元');
      await page.locator('.sp-filter-actions').getByRole('button', { name: '重置', exact: true }).click();
      assert.equal(await page.locator('.sp-cost-kpi .v').first().textContent(), '53.47万元');
      await page.getByRole('button', { name: '元', exact: true }).click();
      await page.getByRole('tab', { name: '患者基础', exact: true }).click();
      await page.getByRole('tab', { name: '患者基础', exact: true }).focus();
      await page.keyboard.press('End');
      assert.equal(await page.getByRole('tab', { name: '医保费用', exact: true }).getAttribute('aria-selected'), 'true');
      assert.equal(await page.getByRole('tabpanel').getAttribute('aria-labelledby'), 'spDomainTab-cost');
      await page.keyboard.press('Home');
      assert.equal(await page.getByRole('tab', { name: '患者基础', exact: true }).getAttribute('aria-selected'), 'true');
    });
    await check('筛查与死亡业务明细读出详情中的原值，点击可回到画像', async () => {
      await page.locator('[data-record-section="burden"] summary').click();
      const screening = page.locator('[data-record-event="TE001"]');
      const values = await screening.locator('[data-record-value]').allTextContents();
      await screening.getByRole('button', { name: '查看画像', exact: true }).click();
      assert.equal(await page.locator('[data-profile-field="screenorg"] .v').textContent(), values[0]);
      assert.equal(await page.locator('[data-profile-field="screentype"] .v').textContent(), values[1]);
      assert.equal(await page.locator('[data-profile-field="screenresult"] .v').textContent(), values[3]);
      await page.getByRole('button', { name: '返回总览', exact: true }).click();
      await page.getByRole('tab', { name: '随访与结局', exact: true }).click();
      await page.locator('[data-record-section="outcome"] summary').click();
      assert.equal(await page.locator('[data-record-section="outcome"] tbody tr').count(), 1);
      const death = page.locator('[data-record-section="outcome"] tbody tr').first();
      const cause = await death.locator('[data-record-value="death"]').textContent();
      await death.getByRole('button', { name: '查看画像', exact: true }).click();
      assert.equal(await page.locator('[data-profile-field="vital"] .v').textContent(), '死亡');
      assert.equal(await page.locator('[data-profile-field="death"] .v').textContent(), cause);
      await page.getByRole('button', { name: '返回总览', exact: true }).click();
    });
    await check('1440 / 1280 / 1024 宽度下各分区无横向溢出', async () => {
      for (const width of [1440, 1280, 1024]) {
        await page.setViewportSize({ width, height: 2000 });
        for (const name of ['患者基础', '肿瘤特征', '诊疗过程', '随访与结局', '医保费用']) {
          await page.getByRole('tab', { name, exact: true }).click();
          const bad = await page.locator('.sp-overview-v14').evaluate(el => Array.from(el.querySelectorAll('.sp-field-card,.sp-field-grid,.sp-overview-records,.sp-cost-overview')).filter(n => n.scrollWidth > n.clientWidth + 1).map(n => n.className));
          assert.deepEqual(bad, [], `${width} / ${name}`);
        }
        await page.getByRole('tab', { name: '患者基础', exact: true }).click();
        await page.locator('#spDomainBody').screenshot({ path: path.join(out, `overview-${width}.png`) });
      }
    });
    await page.setViewportSize({ width: 1440, height: 1800 });
    await page.evaluate(() => { document.getElementById('mainContent').scrollTop = 0; });
    await page.screenshot({ path: path.join(out, '10-final-page.png') });
    assert.deepEqual(errors, []);
    console.log(`${checks} UI integration checks passed; no page errors.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
