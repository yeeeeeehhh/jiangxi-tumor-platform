const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'report-studio-qa');
fs.mkdirSync(root, { recursive: true });
const URL = 'http://localhost:8017/app.html';
const KEY = 'jx.report-studio.editorial.v1';
const passed = [];
async function test(name, fn) { await fn(); passed.push(name); console.log('PASS ' + name); }
(async () => {
  const b = await chromium.launch({ headless: true });
  try {
    const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
    const p = await ctx.newPage(), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    const act = (name, scope = '#rs-root') => p.locator(`${scope} [data-rs="${name}"]`);
    const arg = (name, value, scope = '#rs-root') => p.locator(`${scope} [data-rs="${name}"][data-arg="${value}"]`).first();
    const db = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    await p.goto(URL + '#rs-workbench', { waitUntil: 'load' });
    await p.locator('#rs-root').waitFor();
    await test('book-first workspace, six independent chapters and no step wizard', async () => {
      assert.equal(await p.locator('.rs-outline-item').count(), 6);
      assert.equal(await p.locator('#rs-content').getAttribute('contenteditable'), 'true');
      assert.equal(await p.locator('.rs-review-pane .rs-comment').count(), 1);
      assert.equal(await p.locator('.ac-stage,.ar-stage,.rs-stage').count(), 0);
      assert.ok((await p.locator('#rs-content').textContent()).includes('总体发病水平'));
      await p.screenshot({ path: path.join(root, 'book-desktop.png') });
      const menu = await p.locator('.menu-item[data-id="report-studio"]').evaluate(el =>
        Array.from(el.nextElementSibling.querySelectorAll('.menu-item')).map(v => v.dataset.id));
      assert.deepEqual(menu, ['rs-records', 'rs-workbench', 'rs-templates']);
    });
    await test('unresolved comment blocks approval, reply permits chapter approval', async () => {
      await act('approveChapter').click();
      assert.ok((await p.locator('#rs-toast').textContent()).includes('未处理'));
      await act('replyComment').click();
      await p.locator('#rs-note-reply').fill('已补充资料批次说明，粗率不用于直接比较地区风险。');
      await act('saveReply', '#rs-dialog').click();
      await act('approveChapter').click();
      assert.equal((await db()).reports[0].chapters[3].state, 'approved');
    });
    await test('independent chapter editing, toolbar metric insertion and revision history', async () => {
      await arg('chapter', 'discussion').click();
      await p.locator('#rs-content').fill('本年度讨论与工作建议。');
      await arg('side', 'refs').click();
      await arg('insertMetric', 'cases').click();
      const expected = (await db()).reports[0].tables[0].sum.cases.toLocaleString('zh-CN');
      assert.ok((await p.locator('#rs-content').textContent()).includes(expected));
      await act('saveChapter').click();
      const c = (await db()).reports[0].chapters.find(c => c.id === 'discussion');
      assert.ok(c.body.includes('{{cases}}'));
      assert.equal(c.revision, 2);
      assert.equal(c.versions.length, 1);
      await act('submitChapter').click();
      await act('approveChapter').click();
      await arg('chapter', 'appendix').click();
      await act('submitChapter').click();
      await act('approveChapter').click();
    });
    await test('whole manuscript review and frozen publication', async () => {
      await arg('setView', 'review').click();
      assert.equal(await act('sendFinal').isEnabled(), true);
      await p.screenshot({ path: path.join(root, 'review-desktop.png') });
      await act('sendFinal').click();
      await act('confirmSendFinal', '#rs-dialog').click();
      await arg('finalDecision', 'approve').click();
      await p.locator('#rs-final-conclusion').fill('正文、表格与资料批次一致，同意定稿。');
      await act('saveFinalDecision', '#rs-dialog').click();
      await arg('setView', 'book').click();
      assert.equal(await p.locator('#rs-content').getAttribute('contenteditable'), 'false');
      assert.equal(await act('saveChapter').isDisabled(), true);
      await arg('setView', 'production').click();
      const download = p.waitForEvent('download');
      await act('exportBook').click();
      const file = await download;
      await file.saveAs(path.join(root, 'book-export.html'));
      assert.ok(fs.readFileSync(path.join(root, 'book-export.html'), 'utf8').includes('总体发病与死亡'));
      await act('publish').click();
      await act('confirmPublish', '#rs-dialog').click();
      assert.equal((await db()).reports[0].status, 'published');
    });
    await test('records filters, copy revision and old original preserved', async () => {
      await p.evaluate(() => navigateTo('rs-records'));
      await p.screenshot({ path: path.join(root, 'records-desktop.png') });
      await p.locator('#rs-query').fill('找不到这份年报');
      assert.equal(await p.locator('.rs-empty h3').textContent(), '没有匹配的年报');
      await act('resetFilter').click();
      await arg('copyReport', 'BOOK-2026-01').click();
      await act('confirmCopy', '#rs-dialog').click();
      const reports = (await db()).reports;
      assert.equal(reports.length, 4);
      assert.equal(reports[0].status, 'editing');
      assert.equal(reports.find(r => r.id === 'BOOK-2026-01').status, 'published');
    });
    await test('dirty edit protection and paragraph sanitizer', async () => {
      await p.locator('#rs-content').fill('未保存修改');
      await arg('setView', 'materials').click();
      assert.equal(await p.locator('#rs-dialog-title').textContent(), '未保存的书稿编辑');
      await act('discard', '#rs-dialog').click();
      await arg('setView', 'book').click();
      // 书稿视图打开的是上次切换前的章节（此处回到首篇），断言必须锁定目标章节，否则清洗结果会写进别的章
      await arg('chapter', 'overall').click();
      await p.locator('#rs-content').evaluate(el => {
        el.innerHTML = '<p onclick="window.bad=1">新编制说明<script>window.bad=2</script><img src=x onerror="window.bad=3"></p>';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act('saveChapter').click();
      const saved = (await db()).reports[0].chapters.find(c => c.id === 'overall').body;
      assert.equal(saved.includes('onclick'), false);
      assert.equal(saved.includes('<script'), false);
      assert.equal(saved.includes('<img'), false);
      assert.ok(saved.includes('新编制说明'));
    });
    await test('data JSON import, explicit review, new batch and old table invalidation', async () => {
      await arg('setView', 'data').click();
      await p.locator('#rs-data-file').setInputFiles({
        name: '地区资料.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ dataYear: '2023', registers: [
          { name: '测试地区', population: 1000000, cases: 2000, deaths: 1200, mv: 75, dco: 2 }
        ] }))
      });
      await act('confirmImport', '#rs-dialog').click();
      await p.locator('[data-rs-change="decision"]').selectOption('include');
      await p.locator('[data-rs-change="registerConfirm"]').check();
      await act('freezeData').click();
      await act('confirmFreeze', '#rs-dialog').click();
      await p.screenshot({ path: path.join(root, 'data-desktop.png') });
      await arg('setView', 'materials').click();
      await act('buildTable').click();
      await act('confirmTable').click();
      const r = (await db()).reports[0];
      assert.equal(r.tables[0].sum.incidence, 200);
      assert.equal(r.tables[0].sum.population, 1000000);
      assert.ok(r.dataHistory.length);
      assert.equal(r.tables[1].state, 'outdated');
      const dl = p.waitForEvent('download');
      await act('exportTable').first().click();
      await (await dl).saveAs(path.join(root, 'statistics.csv'));
    });
    await test('chapter assignments and template version isolation', async () => {
      await arg('setView', 'assignment').click();
      await act('assignChapter').first().click();
      await p.locator('#rs-writer').selectOption('王敏');
      await p.locator('#rs-reviewer').selectOption('刘明');
      await act('saveAssignment', '#rs-dialog').click();
      assert.equal((await db()).reports[0].chapters[0].writer, '王敏');
      await p.evaluate(() => navigateTo('rs-templates'));
      await p.screenshot({ path: path.join(root, 'templates-desktop.png') });
      await act('reviseTemplate').click();
      await p.locator('[data-tpl="name"]').fill('省级年报修订模板');
      await act('addSection').click();
      await p.locator('[data-section]').last().fill('新增统计说明');
      await act('saveTemplate').click();
      await act('publishTemplate').click();
      const data = await db();
      assert.equal(data.templates[0].version, 2);
      assert.equal(data.templates[0].state, 'published');
      assert.equal(data.reports[0].template.version, 1);
    });
    await test('new report form validation and local persistence', async () => {
      await p.evaluate(() => navigateTo('rs-records'));
      await act('newReport').click();
      await act('createReport', '#rs-dialog').click();
      assert.ok((await p.locator('#rs-error').textContent()).includes('负责人'));
      await p.locator('#rs-new-owner').fill('刘明');
      await act('createReport', '#rs-dialog').click();
      assert.equal((await db()).reports.length, 5);
      await p.reload({ waitUntil: 'load' });
      await p.locator('#rs-root').waitFor();
      await p.evaluate(() => navigateTo('rs-records'));
      assert.equal(await p.locator('.rs-data-table tbody tr').count(), 5);
    });
    await test('desktop and mobile layouts stay inside viewport', async () => {
      const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
      p2.on('pageerror', e => errors.push(e.message));
      for (const route of ['rs-records', 'rs-workbench', 'rs-templates']) {
        await p2.goto(URL + '#' + route, { waitUntil: 'load' });
        await p2.locator('#rs-root').waitFor();
        const bounds = await p2.locator('#rs-root').evaluate(el => ({ right: el.getBoundingClientRect().right, w: innerWidth }));
        assert.ok(bounds.right <= bounds.w + 1, JSON.stringify(bounds));
        const width = await p2.locator('.rs-head,.rs-editor-tools,.rs-paper').evaluateAll(els =>
          els.map(el => ({ name: el.className, extra: el.scrollWidth - el.clientWidth })));
        assert.ok(width.every(v => v.extra <= 1), JSON.stringify(width));
        await p2.screenshot({ path: path.join(root, route + '-mobile.png') });
      }
      await p2.close();
    });
    await test('old annual module and other pages still work; no browser errors', async () => {
      await p.evaluate(() => navigateTo('ar-tasks'));
      assert.equal(await p.locator('#rs-root').count(), 0);
      assert.ok((await p.locator('#pageContainer').textContent()).includes('年报'));
      await p.evaluate(() => navigateTo('dashboard'));
      assert.equal(await p.locator('#rs-root').count(), 0);
      assert.equal(await p.locator('body.rs-active').count(), 0);
      assert.deepEqual(errors, []);
    });
    fs.writeFileSync(path.join(root, 'checks.json'), JSON.stringify({ passed, errors }, null, 2));
    console.log('All ' + passed.length + ' browser tests passed.');
  } finally { await b.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
