const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./report-studio-model');
const report = () => M.fixtures().reports[0];
function approveAll(r) {
  r.chapters.forEach(c => {
    c.comments.forEach(n => M.resolveComment(r, c.id, n.id, '已核对并修订'));
    if (c.state !== 'approved') {
      if (c.state !== 'review') M.chapterState(r, c.id, 'submit');
      M.chapterState(r, c.id, 'approve');
    }
  });
}
test('chapters work independently without sequential stage fields', () => {
  const r = report();
  assert.equal(r.stage, undefined);
  assert.equal(r.chapters[0].state, 'approved');
  assert.equal(r.chapters[3].state, 'review');
  assert.equal(r.chapters[4].state, 'writing');
  M.chapterState(r, 'discussion', 'submit');
  assert.equal(r.chapters[4].state, 'review');
  assert.equal(r.chapters[3].state, 'review');
});
test('chapter revisions retain previous content and require reapproval', () => {
  const r = report(), c = r.chapters[0], old = c.body;
  M.saveChapter(r, c.id, '<p>更新编制说明</p>');
  assert.equal(c.revision, 2);
  assert.equal(c.state, 'writing');
  assert.equal(c.versions[0].body, old);
});
test('unresolved comments block chapter approval and reply closes issue', () => {
  const r = report();
  assert.throws(() => M.chapterState(r, 'overall', 'approve'), /未处理/);
  const note = r.chapters[3].comments[0];
  assert.throws(() => M.resolveComment(r, 'overall', note.id, ''), /回复/);
  M.resolveComment(r, 'overall', note.id, '已注明资料批次');
  M.chapterState(r, 'overall', 'approve');
  assert.equal(r.chapters[3].state, 'approved');
});
test('data change invalidates material and dependent chapter approvals only', () => {
  const r = report(); approveAll(r);
  const old = r.snapshot.id;
  r.registers[0].decision = 'exclude'; r.registers[0].note = '资料不纳入'; M.freezeData(r);
  assert.notEqual(r.snapshot.id, old);
  assert.equal(r.dataHistory[0].id, old);
  assert.equal(r.tables[0].state, 'outdated');
  assert.equal(r.chapters[0].state, 'approved');
  assert.equal(r.chapters[3].state, 'writing');
});
test('stale data cannot generate or provide a confirmed table', () => {
  const r = report(); r.snapshot.stale = true;
  assert.equal(M.currentTable(r), null);
  assert.throws(() => M.buildTable(r), /当前统计/);
});
test('quality decisions and explanations required before freezing data', () => {
  const r = report(); r.registers[0].confirmed = false;
  assert.throws(() => M.freezeData(r), /逐地区确认/);
  r.registers[0].confirmed = true; r.registers[0].decision = 'exclude'; r.registers[0].note = '';
  assert.throws(() => M.freezeData(r), /理由/);
});
test('statistics use snapshot values and actual rate formula', () => {
  const r = report(), source = M.clone(r.snapshot.registers);
  r.registers[0].population = 1;
  const table = M.buildTable(r);
  assert.equal(table.rows[0].population, source[0].population);
  assert.equal(table.sum.incidence, +(table.sum.cases / table.sum.population * 100000).toFixed(2));
});
test('unknown tokens prevent chapter readiness', () => {
  const r = report(); M.saveChapter(r, 'discussion', '<p>{{fictional}}</p>');
  assert.throws(() => M.chapterState(r, 'discussion', 'submit'), /未知指标/);
});
test('whole manuscript cannot bypass chapter reviews', () => {
  const r = report();
  assert.throws(() => M.sendForFinal(r, '审稿人'), /送审条件/);
  approveAll(r); M.sendForFinal(r, '编委会');
  assert.equal(r.status, 'review'); assert.equal(r.rounds[0].chapters.length, 6);
});
test('whole manuscript return retains round and permits next review', () => {
  const r = report(); approveAll(r); M.sendForFinal(r, '编委会');
  M.finalDecision(r, false, '补充说明');
  assert.equal(r.status, 'editing'); assert.equal(r.rounds[0].state, 'returned');
  M.sendForFinal(r, '编委会');
  assert.equal(r.rounds.length, 2);
});
test('changed manuscript cannot sign outdated review snapshot', () => {
  const r = report(); approveAll(r); M.sendForFinal(r, '编委会');
  M.saveChapter(r, 'preface', '<p>新内容</p>');
  assert.throws(() => M.finalDecision(r, true, '通过'), /发生变化/);
});
test('signed manuscript is immutable and publishing produces archive', () => {
  const r = report(); approveAll(r); M.sendForFinal(r, '编委会'); M.finalDecision(r, true, '通过');
  assert.equal(r.status, 'signed');
  assert.throws(() => M.saveChapter(r, 'preface', '<p>修改</p>'), /不可修改/);
  assert.throws(() => M.comment(r, 'preface', { text: '修改' }), /不可修改/);
  assert.throws(() => M.publish(r, { channel: '公开', date: '2099-01-01' }), /未来/);
  M.publish(r, { channel: '单位发布', date: M.now().slice(0, 10) });
  assert.equal(r.status, 'published'); assert.ok(r.publication.archivedAt);
});
test('template edits and report revisions never overwrite original', () => {
  const tp = M.template();
  const r = M.createReport({ title: '年报', dataYear: '2023', publishYear: '2026', owner: '陈静' }, tp);
  tp.chapters[0].body = '后改模板';
  assert.notEqual(r.chapters[0].body, tp.chapters[0].body);
  const copy = M.revisionOf(r);
  copy.chapters[0].body = '修订正文';
  assert.notEqual(copy.id, r.id); assert.notEqual(copy.chapters[0].body, r.chapters[0].body);
});
test('template validation catches unknown metrics and missing required chapters', () => {
  const tp = M.template(); tp.chapters[0].body = '{{bad}}';
  assert.ok(M.validateTemplate(tp).some(v => v.includes('未知')));
  tp.chapters.forEach(c => { c.required = false; });
  assert.ok(M.validateTemplate(tp).some(v => v.includes('必需章节')));
});
