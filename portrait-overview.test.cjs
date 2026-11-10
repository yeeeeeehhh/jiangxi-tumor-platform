/* V14 画像字段与总览一致性测试。SP_DOM_MODULE 可指向独立安装的 linkedom。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require(process.env.SP_DOM_MODULE || 'linkedom');
const { document, HTMLElement } = parseHTML('<html><head></head><body><div id="pageContainer"></div></body></html>');
// linkedom 不计算布局，分区导航滚动在真实浏览器中另行验证。
HTMLElement.prototype.scrollIntoView = () => {};
const ActualDate = Date;
class FixedDate extends ActualDate { constructor(...args) { super(...(args.length ? args : ['2026-10-30T12:00:00+08:00'])); } }
const window = { document, __SP_TEST__: true };
const context = vm.createContext({ window, document, Date: FixedDate, console, setTimeout, clearTimeout, toast() {} });
for (const f of ['portrait-transfers.js', 'portrait-cost.js', 'specialty-portrait.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), context);
const T = window.__SP_TEST__, events = T.tumorEvents();
const copy = x => JSON.parse(JSON.stringify(x));
let count = 0;
function check(name, fn) { fn(); count++; console.log('PASS ' + name); }
function overview() { document.getElementById('pageContainer').innerHTML = window.renderSpecialtyPortrait('overview'); }
overview();

check('总览默认统计表，视图切换只替换面板且保留筛选与选择', () => {
  assert.equal(document.querySelector('[data-overview-view="table"]').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelectorAll('.sp-stat-table').length, 7);
  assert.equal(document.querySelectorAll('.sp-field-card').length, 0);
  const filters = document.querySelector('.sp-filter-bar');
  for (let i = 0; i < 3; i++) {
    window._spSetOverviewView('chart');
    assert.equal(document.querySelectorAll('.sp-stat-table').length, 0);
    assert.equal(document.querySelectorAll('.sp-field-card').length, 7);
    window._spSetOverviewView('table');
    assert.equal(document.querySelectorAll('.sp-stat-table').length, 7);
    assert.equal(document.querySelector('.sp-filter-bar'), filters);
  }
  window._spSetOverviewView('invalid');
  assert.equal(document.querySelector('[data-overview-view="table"]').getAttribute('aria-pressed'), 'true');
  window._spScopeField('hospital', '江西省肿瘤医院');
  assert.equal(document.querySelector('[data-stat-field="sex"] [data-stat-total]').textContent, '7 人');
  window._spSetDomain('tumor');
  assert.equal(document.querySelector('[data-overview-view="table"]').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('#spScopeHospital option[selected]').value, '江西省肿瘤医院');
  window._spSetOverviewView('chart');
  window._spScopeReset();
  assert.equal(document.querySelector('[data-overview-view="chart"]').getAttribute('aria-pressed'), 'true');
  T.spDomainPanel('burden', 'table'); overview();
});
check('分组短表逐行对账同源分类、数量、占比和纳入总数', () => {
  for (const section of T.SP_PROFILE_SECTIONS()) {
    const holder = document.createElement('div'); holder.innerHTML = T.spDomainPanel(section.key, 'table');
    const expected = section.tables.flatMap(group => group.kind === 'treatment' ? Array.from({ length: 6 }, (_, i) => 'mode' + i) : Array.from(group.keys));
    assert.deepEqual(Array.from(holder.querySelectorAll('[data-stat-field]'), node => node.dataset.statField), Array.from(expected));
    assert.equal(holder.querySelectorAll('.sp-field-card,.sp-treatment-chart,[rowspan]').length, 0);
    assert.equal(holder.querySelectorAll('.sp-stat-group').length, section.tables.length);
    for (const key of expected) {
      const s = T.spFieldSummary(events, key), unit = s.field.unit === '患者' ? '人' : '例';
      const block = holder.querySelector(`[data-stat-field="${key}"]`);
      assert.equal(block.querySelector('[data-stat-total]').textContent, s.total + ' ' + unit);
      if (key.startsWith('mode')) {
        const stateMatches = { yes: b => b.state === 'valid' && b.label === '有', no: b => b.state === 'valid' && b.label === '明确无', missing: b => b.state === 'missing', conflict: b => b.state === 'conflict' };
        for (const [name, matches] of Object.entries(stateMatches)) {
          const cell = block.querySelector(`[data-treatment-state="${name}"]`);
          const count = s.buckets.filter(matches).reduce((n, b) => n + b.count, 0);
          assert.equal(Number(cell.dataset.statCount), count);
          for (const button of cell.querySelectorAll('button')) assert.equal(button.textContent, String(s.buckets[Number(button.dataset.fieldBucket)].count));
        }
        const yes = s.buckets.find(b => b.label === '有');
        assert.equal(block.querySelector('[data-stat-share]').textContent, ((yes ? yes.count : 0) / s.total * 100).toFixed(1) + '%');
        continue;
      }
      for (const row of block.querySelectorAll('tbody tr')) {
        const index = Number(row.dataset.statBucket), b = s.buckets[index];
        assert.equal(row.querySelector('[data-stat-count]').textContent, String(b ? b.count : 0));
        assert.equal(row.querySelector('[data-stat-share]').textContent, ((b ? b.count : 0) / s.total * 100).toFixed(1) + '%');
        if (b) {
          assert.equal(row.querySelector('.sp-stat-category').textContent, b.label);
          assert.equal(row.dataset.statState, b.state);
          assert.equal(row.querySelector('button').dataset.fieldBucket, String(index));
        } else assert.equal(row.querySelector('button'), null, '补零行不下钻到全部记录');
      }
      if (s.field.kind === 'number') {
        assert.equal(block.querySelectorAll('tr[data-stat-state="valid"]').length, key === 'age' ? 5 : 4);
        assert.ok(block.querySelector('.sp-stat-median').textContent.includes(String(Math.round(s.median * 10) / 10)));
      }
      assert.ok(block.querySelectorAll('tr[data-stat-state="valid"]:not([hidden])').length <= (s.field.kind === 'number' ? 5 : 6));
      assert.equal(block.querySelectorAll('tr[hidden]:not([data-stat-state="valid"])').length, 0, '异常状态必须可见');
    }
  }
  const holder = document.createElement('div'); holder.innerHTML = T.spDomainPanel('treat', 'table');
  assert.ok(holder.querySelectorAll('[data-stat-field="tfirst"] tr[data-stat-bucket="-1"]').length > 0, '连续月份补零');
  assert.equal(holder.querySelectorAll('.sp-treatment-table tbody tr').length, 6);
  holder.innerHTML = T.spDomainPanel('burden', 'table');
  assert.ok(holder.querySelector('[data-stat-field="hospital"] .sp-stat-hint').textContent.includes('不相加'));
  T.spDomainPanel('burden', 'table'); overview();
});
check('展开收起保留原桶索引，跨视图和筛选状态不丢失', () => {
  T.spDomainPanel('burden', 'table'); overview();
  const button = document.querySelector('[data-stat-expand="region"]');
  const table = document.getElementById('spStatTable-region');
  const indices = Array.from(table.querySelectorAll('tbody tr'), row => row.dataset.statBucket);
  assert.equal(table.querySelectorAll('tbody tr:not([hidden])').length, 6);
  window._spToggleStatRows(button);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(table.querySelectorAll('tr[hidden]').length, 0);
  assert.deepEqual(Array.from(table.querySelectorAll('tbody tr'), row => row.dataset.statBucket), indices);
  window._spSetOverviewView('chart'); window._spSetOverviewView('table');
  assert.equal(document.querySelector('[data-stat-expand="region"]').getAttribute('aria-expanded'), 'true');
  window._spSetDomain('tumor'); window._spSetDomain('burden');
  assert.equal(document.getElementById('spStatTable-region').querySelectorAll('tr[hidden]').length, 0);
  window._spToggleStatRows(document.querySelector('[data-stat-expand="region"]'));
  assert.equal(document.getElementById('spStatTable-region').querySelectorAll('tbody tr:not([hidden])').length, 6);
  window._spScopeField('hospital', '江西省肿瘤医院');
  assert.equal(document.querySelector('[data-stat-field="sex"] [data-stat-total]').textContent, '7 人');
  assert.ok(document.querySelector('[data-stat-field="region"]'));
  window._spScopeReset();
});
check('医保费用统计表、图表及元/万元切换数值相同且数据刷新保留模式', () => {
  window.SPCost.setData(window.SPCost.demo());
  T.spDomainPanel('cost', 'table'); overview();
  const summaryValues = () => Array.from(document.querySelectorAll('.sp-cost-summary-table td:last-child'), n => n.textContent);
  const original = ['534,720.00元', '13 / 13 人', '41,132.31元', '29.1%', '11.0%'];
  assert.deepEqual(summaryValues(), original);
  assert.equal(document.querySelectorAll('.sp-cost-stat-table').length, 3);
  assert.equal(document.querySelectorAll('.sp-cost-ring,.sp-cost-ranking,.sp-cost-kpi').length, 0);
  const tables = Array.from(document.querySelectorAll('.sp-cost-stat-table'));
  assert.equal(tables[1].querySelectorAll('tbody tr').length, 5);
  assert.equal(tables[2].querySelectorAll('tbody tr').length, 6);
  window.SPCost.setOverviewUnit('wan');
  assert.deepEqual(summaryValues(), ['53.47万元', '13 / 13 人', '4.11万元', '29.1%', '11.0%']);
  window.SPCost.setData(window.SPCost.demo());
  assert.equal(document.querySelectorAll('.sp-cost-stat-table').length, 3);
  window._spSetOverviewView('chart');
  assert.equal(document.querySelectorAll('.sp-cost-summary-table').length, 0);
  assert.deepEqual(Array.from(document.querySelectorAll('.sp-cost-kpi .v'), n => n.textContent), ['53.47万元', '13 / 13 人', '4.11万元', '29.1%', '11.0%']);
  assert.equal(document.querySelectorAll('.sp-cost-ring').length, 1);
  window.SPCost.setOverviewUnit('yuan');
  assert.equal(document.querySelectorAll('.sp-cost-ring').length, 1);
  window._spSetOverviewView('table');
  assert.deepEqual(summaryValues(), original);
  const incomplete = copy(window.SPCost.demo()); incomplete.records[0].cash = null; incomplete.records[0].items = null;
  window.SPCost.setData(incomplete);
  assert.equal(document.querySelectorAll('.sp-cost-stat-table').length, 1);
  assert.equal(document.querySelectorAll('.sp-cost-overview-empty').length, 2);
  assert.equal(summaryValues()[3], '—');
  window.SPCost.setData({ mode: 'live', connected: false, records: [] });
  assert.ok(document.querySelector('.sp-cost-overview').textContent.includes('医保结算数据未接入'));
  window.SPCost.setData({ mode: 'live', connected: true, records: [] });
  assert.ok(document.querySelector('.sp-cost-overview').textContent.includes('暂无已关联的有效医保费用'));
  window.SPCost.setData(window.SPCost.demo());
  T.spDomainPanel('burden', 'table'); overview();
});

/* 详情页按分区 groups 展示；治疗机构变化只进总览图表与下方机构变化明细表，不再占详情键值位。 */
const sectionGroups = () => T.SP_PROFILE_SECTIONS().reduce((m, s) => (s.groups.forEach(g => g.keys.forEach(k => m.set(k, s.label))), m), new Map());
const detailKeys = () => [...sectionGroups().keys()];
check('全部 14 份详情都展示分区定义的每个画像字段，且值与总览取值相同', () => {
  assert.equal(T.spProfileFields().length, 36);
  assert.deepEqual([...new Set(detailKeys())].sort().join(','), Array.from(T.spProfileFields()).filter(f => sectionGroups().has(f.key)).map(f => f.key).sort().join(','));
  assert.equal(detailKeys().length, 35);
  for (const e of events) {
    const holder = document.createElement('div'); holder.innerHTML = T.spDetailPage(e);
    assert.equal(holder.querySelectorAll('[data-profile-field]').length, detailKeys().length);
    for (const f of T.spProfileFields()) {
      const node = holder.querySelector(`[data-profile-field="${f.key}"]`);
      if (!sectionGroups().has(f.key)) { assert.equal(node, null, `${f.key} 不应出现在详情页`); continue; }
      assert.equal(node.querySelector('.k').textContent, f.label);
      assert.equal(node.querySelector('.v').textContent, T.spProfileRead(e, f.key).text, `${e.id}: ${f.key}`);
    }
  }
});
check('四个分区图表与业务明细覆盖本区全部画像字段，详情块只展示分区定义的键值项', () => {
  const sections = { burden: '患者基础', tumor: '肿瘤特征', treat: '诊疗过程', outcome: '随访与结局' };
  for (const [key, label] of Object.entries(sections)) {
    const holder = document.createElement('div'); holder.innerHTML = T.spDomainPanel(key, 'chart');
    assert.equal(holder.querySelectorAll('.sp-cost-overview').length, 0, label);
    const chartKeys = Array.from(holder.querySelectorAll('[data-overview-field]'), n => n.getAttribute('data-overview-field'));
    const recordKeys = Array.from(holder.querySelectorAll('[data-record-field]'), n => n.getAttribute('data-record-field'));
    const modes = Array.from(holder.querySelectorAll('.sp-treatment-row > [data-field-key]'), n => n.getAttribute('data-field-key'));
    const expectedKeys = Array.from(T.spProfileFields()).filter(f => f.dim === label).map(f => f.key).sort();
    assert.deepEqual([...new Set([...chartKeys, ...recordKeys, ...modes])].sort(), expectedKeys);
    const groupKeys = Array.from(sectionGroups()).filter(([, dim]) => dim === label).map(([k]) => k).sort();
    for (const e of events) {
      const detail = document.createElement('div'); detail.innerHTML = T.spDetailPage(e);
      const block = Array.from(detail.querySelectorAll('.sp-profile-block')).find(n => n.querySelector('.sp-block-title').textContent === label);
      assert.deepEqual(Array.from(block.querySelectorAll('[data-profile-field]'), n => n.getAttribute('data-profile-field')).sort(), groupKeys);
    }
  }
  const holder = document.createElement('div'); holder.innerHTML = T.spDomainPanel('cost');
  assert.equal(holder.querySelectorAll('.sp-cost-overview').length, 1);
  assert.equal(holder.querySelectorAll('[data-overview-field]').length, 0);
});
check('筛查、编码和死亡明细的全部值与对应详情页面相同', () => {
  for (const section of ['burden', 'tumor', 'outcome']) {
    const holder = document.createElement('div'); holder.innerHTML = T.spDomainPanel(section);
    for (const row of holder.querySelectorAll('[data-record-event]')) {
      const e = events.find(e => e.id === row.getAttribute('data-record-event'));
      const detail = document.createElement('div'); detail.innerHTML = T.spDetailPage(e);
      for (const cell of row.querySelectorAll('[data-record-value]')) {
        assert.equal(cell.textContent, detail.querySelector(`[data-profile-field="${cell.getAttribute('data-record-value')}"] .v`).textContent, e.id);
      }
      if (section === 'outcome') assert.equal(detail.querySelector('[data-profile-field="vital"] .v').textContent, '死亡');
    }
  }
});
check('更新同一份画像的分期和筛查结果，总览实时使用更新后的值', () => {
  const e = events[0], originalStage = e.stage, originalResult = e.screenResult;
  try {
    e.stage = 'I期'; e.screenResult = '新的筛查结果';
    const tumor = document.createElement('div'); tumor.innerHTML = T.spDomainPanel('tumor', 'chart');
    const expected = events.filter(e => e.stage === 'I期').length;
    const legend = Array.from(tumor.querySelectorAll('[data-overview-field="stage"] .sp-chart-legend-row')).find(n => n.querySelector('button').textContent === 'I期');
    assert.equal(parseInt(legend.querySelector('strong').textContent, 10), expected);
    const base = document.createElement('div'); base.innerHTML = T.spDomainPanel('burden');
    assert.equal(base.querySelector(`[data-record-event="${e.id}"] [data-record-value="screenresult"]`).textContent, '新的筛查结果');
    const detail = document.createElement('div'); detail.innerHTML = T.spDetailPage(e);
    assert.equal(detail.querySelector('[data-profile-field="stage"] .v').textContent, 'I期');
    assert.equal(detail.querySelector('[data-profile-field="screenresult"] .v').textContent, '新的筛查结果');
  } finally { e.stage = originalStage; e.screenResult = originalResult; }
});
check('每个字段的有效、缺失、冲突、不适用与纳入记录完整对账', () => {
  for (const f of T.spProfileFields()) {
    const s = T.spFieldSummary(events, f.key);
    assert.equal(s.valid + s.missing + s.conflict + s.na, s.total, f.key);
    assert.equal(s.total, f.unit === '患者' ? 13 : 14, f.key);
    if (f.kind !== 'multiple') assert.equal(s.buckets.reduce((n, b) => n + b.count, 0), s.total, f.key);
  }
});
check('同一患者的不同确诊年龄按瘤例统计，人口性别只计一次', () => {
  const a = { ...copy(events[0]), id: 'AGE-A', diagDate: '2025-01-01' };
  const b = { ...a, id: 'AGE-B', diagDate: '2026-01-01' };
  assert.equal(T.spFieldSummary([a, b], 'sex').total, 1);
  const age = T.spFieldSummary([a, b], 'age');
  assert.equal(age.total, 2);
  assert.equal(age.rows[1].result.value - age.rows[0].result.value, 1);
});
check('同一患者险种冲突与缺失不静默选取某个瘤例的值', () => {
  const a = copy(events[0]), b = { ...a, id: 'CONFLICT', insurance: '不同险种' };
  const result = T.spFieldSummary([a, b], 'insurance');
  assert.equal(result.total, 1); assert.equal(result.conflict, 1); assert.equal(result.valid, 0);
  b.insurance = null;
  assert.equal(T.spFieldSummary([a, b], 'insurance').conflict, 1);
});
check('原发部位取具体部位，TNM 缺失不能由期别替代', () => {
  const e = { ...copy(events[0]), tNm: null, stage: 'I期', laterality: '右肺上叶', site: '肺' };
  assert.equal(T.spProfileRead(e, 'site').text, '右肺上叶');
  assert.equal(T.spProfileRead(e, 'tnm').state, 'missing');
  assert.equal(T.spProfileRead(e, 'stage').text, 'I期');
  assert.equal(T.spProfileRead({ ...e, stageApplicable: false }, 'tnm').state, 'na');
});
check('三态治疗不把其他治疗有记录当作本项明确无', () => {
  const e = { ...copy(events[0]), treatments: [{ mode: '化疗', date: '2026-03-01' }], treatmentVisits: [], modesNotDone: [] };
  assert.equal(T.spModeState(e, '化疗'), '有');
  assert.equal(T.spModeState(e, '手术'), null);
  e.modesNotDone = ['手术']; assert.equal(T.spModeState(e, '手术'), '明确无');
  e.modesNotDone = ['化疗']; assert.equal(T.spProfileRead(e, 'mode2').state, 'conflict');
});
check('计划、撤销、未来、确诊前或死亡后治疗不进入首次治疗及方式统计', () => {
  const e = { ...copy(events[0]), treatmentVisits: [], treatments: [
    { mode: '放疗', date: '2026-02-01' },
    { mode: '放疗', date: '2026-02-03', status: 'planned' },
    { mode: '放疗', date: '2026-02-04', status: 'cancelled' },
    { mode: '化疗', date: '2026-03-01' },
    { mode: '放疗', date: '2027-01-01' }
  ] };
  assert.equal(T.spFirstTreat(e), '2026-03-01'); assert.equal(T.spModeState(e, '放疗'), null);
  e.deathDate = '2026-02-28'; assert.equal(T.spFirstTreat(e), '');
});
check('观察时长使用确诊日期，零天可为零月且失访不判作死亡', () => {
  const e = { ...copy(events[0]), diagDate: '2026-04-01', tConfirm: '2026-04-01', lastFu: '2026-04-01', vitalStatus: '存活', deathDate: null, lostFollow: true };
  assert.equal(T.spProfileRead(e, 'survival').value, 0);
  assert.equal(T.spProfileRead(e, 'vital').text, '存活');
  assert.equal(T.spProfileRead(e, 'followstate').text, '失访');
  assert.equal(T.spProfileRead(e, 'death').state, 'na');
  e.diagDate = null; e.tConfirm = null; assert.equal(T.spProfileRead(e, 'survival').state, 'missing');
});
check('无病理类型不由分级补出病理，已报死亡的缺失日期不能归为不适用', () => {
  const e = { ...copy(events[0]), path: null, grade: '中分化' };
  assert.equal(T.spProfileRead(e, 'path').state, 'missing');
  e.vitalStatus = '死亡'; e.followStatus = '死亡结案'; e.deathDate = null;
  assert.equal(T.spProfileRead(e, 'deathdate').state, 'missing');
  assert.equal(T.spProfileRead(e, 'followstate').state, 'missing');
  e.deathDate = '2026-01-01';
  assert.equal(T.spProfileRead(e, 'deathdate').state, 'conflict');
  e.lastFu = '2026-02-30';
  assert.equal(T.spProfileRead(e, 'lastfu').state, 'conflict');
});
check('历史截止日拒绝截止日之后的状态、日期与治疗，独立画像恢复今天', () => {
  window._spScopeField('cutoff', '2026-02-10');
  const e = events[0];
  assert.equal(T.spProfileRead(e, 'lastfu').state, 'missing');
  assert.equal(T.spProfileRead(e, 'survival').state, 'missing');
  assert.equal(T.spFirstTreat(e), '2026-02-05');
  assert.equal(T.spModeState(e, '化疗'), null);
  document.getElementById('pageContainer').innerHTML = window.renderSpecialtyPortrait('workbench');
  assert.equal(T.spProfileRead(e, 'lastfu').state, 'valid');
  overview(); window._spScopeReset();
});
check('医院筛选匹配画像全部就诊机构，不只检查主医院字段', () => {
  window._spScopeField('hospital', '江西省肿瘤医院');
  const html = window.renderSpecialtyPortrait('overview');
  // TE001 的主医院是南昌市第一医院，但治疗记录含江西省肿瘤医院。
  const exported = T.spMetricsFlatRows();
  const sex = exported.find(r => r[1] === '性别' && r[2] === '有效记录');
  assert.equal(sex[6], 7);
  assert.ok(html.includes('江西省肿瘤医院'));
  window._spScopeReset();
});
check('患者医院集合只因展示顺序不同不会被误判为冲突', () => {
  const s = T.spFieldSummary(events.filter(e => e.id === 'TE001' || e.id === 'TE001B'), 'hospital');
  assert.equal(s.total, 1); assert.equal(s.conflict, 0); assert.equal(s.buckets.length, 2);
});
check('总览主费用严格等于逐瘤例累计，1,600 元共同费用另列', () => {
  window.SPCost.setData(window.SPCost.demo());
  const m = window.SPCost.populationModel(T.spCostContext(events));
  const sum = events.reduce((n, e) => n + window.SPCost.model({ today: '2026-10-30', tumorId: e.id, patientKey: T.spPatientKey(e), patientTumorIds: events.filter(t => T.spPatientKey(t) === T.spPatientKey(e)).map(t => t.id) }).stats.total, 0);
  assert.equal(m.stats.total, sum); assert.equal(sum, 53472000);
  assert.equal(m.shared, 1); assert.equal(m.sharedTotal, 160000);
  assert.equal(m.pending, 1);
});
check('CSV 每个字段数值、分母和缺失与页面一致，并包含费用实际数据', () => {
  const csv = T.spMetricsFlatRows();
  for (const f of T.spProfileFields()) {
    const s = T.spFieldSummary(events, f.key), row = csv.find(r => r[1] === f.label && r[2] === '有效记录');
    assert.equal(row[3], s.valid, f.key); assert.equal(row[6], s.total, f.key);
    assert.equal(row[8], s.missing); assert.equal(row[9], s.conflict); assert.equal(row[10], s.na);
  }
  assert.equal(csv.find(r => r[1] === '群体累计医疗费用')[3], 534720);
  assert.ok(!csv[0].includes('达标判定'));
});
check('配置的字段键、名称和有效性全部与当前画像字典对应', () => {
  assert.equal(T._spElements().length, 36);
  for (const el of T._spElements()) {
    assert.ok(T.spProfileFields().some(f => f.key === el.fkey && f.label === el.name));
    for (const e of events) {
      const state = T.spProfileRead(e, el.fkey).state;
      assert.equal(Boolean(T.spFieldFn(el.fkey)(e)), state === 'valid' || state === 'na');
    }
  }
});
check('各分区能渲染，空范围不产生 NaN 或伪零占比', () => {
  for (const d of ['burden', 'tumor', 'treat', 'outcome']) {
    const html = T.spDomainPanel(d); assert.ok(html.length > 100); assert.ok(!/NaN|undefined|参考基准|达标判定/.test(html));
  }
  window._spScopeField('city', '不存在的地市');
  assert.ok(window.renderSpecialtyPortrait('overview').includes('当前范围无纳入画像'));
  assert.ok(!/NaN|undefined/.test(window.renderSpecialtyPortrait('overview')));
  window._spScopeReset();
});
console.log(`${count} field consistency checks passed.`);
