(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ReportStudioModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = prefix => prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const now = () => new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hour12: false
  }).format(new Date());
  const PEOPLE = ['陈静', '刘明', '王敏', '周宁', '李婷'];
  const METRICS = {
    population: { name: '覆盖人口', unit: '人' }, cases: { name: '新发病例', unit: '例' },
    deaths: { name: '死亡病例', unit: '例' }, incidence: { name: '粗发病率', unit: '/10万' },
    mortality: { name: '粗死亡率', unit: '/10万' }, regions: { name: '收录地区', unit: '个' }
  };
  function activity(report, action, detail) {
    report.updatedAt = now();
    report.activity.unshift({ at: report.updatedAt, who: '本地编制人员', action, detail });
  }
  function assertEditing(report) {
    if (report.status === 'signed' || report.status === 'published') throw Error('定稿书稿不可修改，请从年报记录复制修订版');
  }
  function chapter(title, code, writer, body, sections) {
    return { id: code, title, writer, reviewer: '周宁', required: true, state: 'writing', revision: 1,
      body, sections, tables: [], comments: [], versions: [], updatedAt: now() };
  }
  function template() {
    return {
      id: 'TPL-PROVINCE', family: 'province', name: '省级肿瘤登记年报', version: 1, state: 'published',
      enabled: true, description: '年度登记资料评价、统计结果与防控建议', pageSize: 'A4', cover: '年度 / 书名 / 编制单位',
      footer: '江西省肿瘤登记年报', fontSize: 15, updatedAt: now(),
      chapters: [
        chapter('编制说明', 'preface', '陈静', '<p>本书收录本省年度肿瘤登记资料。编制组对资料来源、收录范围与统计方法进行核对，并组织分章撰写和审校。</p><p>本年报旨在客观呈现纳入地区的恶性肿瘤发病和死亡登记情况，为年度防控工作提供登记资料参考。</p>', ['编制背景', '编制单位与人员']),
        chapter('登记资料与方法', 'methods', '刘明', '<h3>资料收集</h3><p>资料包含纳入地区的发病登记、死亡登记与人口资料。各类资料按同一统计年度整理，所有统计结果使用经确认的同一批次资料。</p><h3>统计方法</h3><p>粗率按同期病例数除以覆盖人口计算，以1/10万表示。比较结果时需同时考虑地区人口构成及资料收录情况。</p>', ['登记范围', '收集与整理', '统计指标']),
        chapter('登记资料质量', 'quality', '王敏', '<h3>资料评价与收录</h3><p>对登记地区进行逐项资料评价。收录结论及排除理由保存在本年报的资料收录清单中。</p><p>质量评价结果经核实后写入书稿，尚未确认的问题不作为已解决事项描述。</p>', ['资料评价', '地区收录', '局限性']),
        chapter('总体发病与死亡', 'overall', '刘明', '<h3>总体发病水平</h3><p>纳入{{regions}}个登记地区，覆盖人口{{population}}人。共登记新发恶性肿瘤{{cases}}例，粗发病率为{{incidence}}/10万。</p><h3>总体死亡水平</h3><p>同期登记恶性肿瘤死亡{{deaths}}例，粗死亡率为{{mortality}}/10万。地区分布及具体结果见表1。</p>', ['总体发病', '总体死亡', '地区分布']),
        chapter('讨论与建议', 'discussion', '陈静', '<h3>主要发现</h3><p>结合本年度结果，讨论资料收录范围、地区差异和登记质量对统计结果的影响。</p><h3>工作建议</h3><p>持续完善登记资料核对、死亡结局补充与人口资料维护，重点关注未能收录地区的资料完整性。</p>', ['主要发现', '登记工作建议']),
        chapter('统计附录', 'appendix', '李婷', '<p>本附录汇集本年报使用的统计表及其资料版本，表中数据与正文指标引用来自同一统计底稿。</p>', ['地区统计表', '资料来源'])
      ]
    };
  }
  function regionData() {
    return [
      ['南昌市', 4620000, 8410, 5028, 78.1, 1.2],
      ['九江市', 4500000, 8610, 5214, 75.4, 1.8],
      ['赣州市', 8970000, 16594, 10206, 73.9, 2.1],
      ['吉安市', 4410000, 7982, 4710, 76.2, 1.5],
      ['宜春市', 5000000, 9600, 5837, 72.8, 2.4],
      ['上饶市', 5900000, 11564, 7167, 74.5, 1.9]
    ].map((r, i) => ({ id: 'REG-' + i, name: r[0], population: r[1], cases: r[2], deaths: r[3],
      mv: r[4], dco: r[5], decision: i === 5 ? 'pending' : 'include',
      note: i === 5 ? '人口资料版本待核实' : '资料范围与年度已核对', confirmed: i !== 5 }));
  }
  function createReport(info, tp) {
    if (!tp || tp.state !== 'published' || !tp.enabled) throw Error('请使用已发布且启用的模板');
    if (!info.title?.trim() || !info.owner?.trim()) throw Error('填写年报名称与负责人');
    if (!/^\d{4}$/.test(String(info.dataYear)) || !/^\d{4}$/.test(String(info.publishYear))) throw Error('填写有效的统计年度与出版年度');
    if (+info.dataYear > +info.publishYear) throw Error('统计年度不能晚于出版年度');
    const report = {
      id: id('BOOK'), title: info.title.trim(), dataYear: String(info.dataYear), publishYear: String(info.publishYear),
      owner: info.owner.trim(), due: info.due || '', status: 'editing', edition: 1,
      template: clone(tp), chapters: clone(tp.chapters), registers: regionData(), snapshot: null, tables: [],
      rounds: [], publication: null, activity: [], dataHistory: [], updatedAt: now(), createdAt: now()
    };
    report.chapters.forEach(c => { c.state = 'writing'; c.comments = []; c.versions = []; });
    activity(report, '建立书稿', tp.name + ' v' + tp.version);
    return report;
  }
  function saveChapter(report, chapterId, body) {
    assertEditing(report);
    const c = report.chapters.find(v => v.id === chapterId);
    if (!c) throw Error('章节不存在');
    if (!body || !body.replace(/<[^>]+>/g, '').trim()) throw Error('正文不能为空');
    if (c.body !== body) {
      c.versions.unshift({ revision: c.revision, body: c.body, at: c.updatedAt, writer: c.writer, tables: clone(c.tables) });
      c.body = body; c.revision++; c.state = 'writing'; c.updatedAt = now();
      if (report.status === 'review') report.status = 'editing';
      activity(report, '保存章节', c.title + ' r' + c.revision);
    }
  }
  function comment(report, chapterId, info) {
    assertEditing(report);
    const c = report.chapters.find(v => v.id === chapterId);
    if (!info.text?.trim()) throw Error('请填写审校意见');
    c.comments.push({ id: id('NOTE'), text: info.text.trim(), quote: info.quote || '', author: info.author || c.reviewer,
      state: 'open', reply: '', at: now(), revision: c.revision });
    if (c.state === 'approved') c.state = 'writing';
    activity(report, '添加审校意见', c.title + '：' + info.text.trim());
  }
  function resolveComment(report, chapterId, noteId, reply) {
    assertEditing(report);
    if (!reply?.trim()) throw Error('填写修改或核实回复');
    const c = report.chapters.find(v => v.id === chapterId), note = c.comments.find(v => v.id === noteId);
    note.reply = reply.trim(); note.state = 'resolved'; note.resolvedAt = now();
    activity(report, '处理审校意见', c.title + '：' + reply.trim());
  }
  function chapterReady(report, c) {
    const issues = [];
    if (!c.body.replace(/<[^>]+>/g, '').trim()) issues.push('正文为空');
    if (c.comments.some(n => n.state === 'open')) issues.push('尚有未处理审校意见');
    for (const token of [...c.body.matchAll(/\{\{([^{}]+)\}\}/g)].map(v => v[1])) {
      if (!METRICS[token]) issues.push('未知指标引用：' + token);
      else if (!currentTable(report)) issues.push('指标引用缺少有效统计底稿');
    }
    if (c.tables.some(tableId => !report.tables.find(t => t.id === tableId && t.state === 'confirmed' && t.snapshotId === report.snapshot?.id)))
      issues.push('引用统计表尚未确认或已过期');
    return [...new Set(issues)];
  }
  function chapterState(report, chapterId, action) {
    assertEditing(report);
    const c = report.chapters.find(v => v.id === chapterId), issues = chapterReady(report, c);
    if (action !== 'return' && issues.length) throw Error(issues.join('；'));
    if (action === 'submit') { c.state = 'review'; activity(report, '章节送审', c.title + ' → ' + c.reviewer); }
    else if (action === 'approve') {
      if (c.state !== 'review') throw Error('章节送审后才能登记审校通过');
      c.state = 'approved'; c.approvedRevision = c.revision; c.approvedAt = now();
      activity(report, '章节审校通过', c.title + ' r' + c.revision + ' · ' + c.reviewer);
    } else { c.state = 'writing'; activity(report, '章节退回修订', c.title); }
  }
  function freezeData(report) {
    assertEditing(report);
    if (report.registers.some(r => !r.confirmed || r.decision === 'pending')) throw Error('逐地区确认资料与收录结论后才能建立统计批次');
    if (report.registers.some(r => r.decision === 'exclude' && !r.note.trim())) throw Error('排除地区需填写理由');
    if (!report.registers.some(r => r.decision === 'include')) throw Error('至少收录一个地区');
    if (report.snapshot) (report.dataHistory || (report.dataHistory = [])).push(clone(report.snapshot));
    report.snapshot = { id: id('DATA'), at: now(), version: (report.snapshot?.version || 0) + 1,
      registers: clone(report.registers.filter(r => r.decision === 'include')) };
    invalidateData(report);
    activity(report, '建立统计资料批次', report.snapshot.registers.length + '个收录地区 · D' + report.snapshot.version);
  }
  function invalidateData(report) {
    report.tables.forEach(t => { t.state = 'outdated'; });
    report.chapters.forEach(c => {
      if (c.tables.length || /\{\{/.test(c.body)) c.state = 'writing';
    });
    if (report.status === 'review') report.status = 'editing';
  }
  function currentTable(report) {
    if (report.snapshot?.stale) return null;
    return report.tables.find(t => t.snapshotId === report.snapshot?.id && t.state === 'confirmed');
  }
  function buildTable(report) {
    assertEditing(report);
    if (!report.snapshot || report.snapshot.stale) throw Error('请先在资料收录中建立当前统计资料批次');
    const rows = clone(report.snapshot.registers);
    rows.forEach(r => {
      r.incidence = +(r.cases / r.population * 100000).toFixed(2);
      r.mortality = +(r.deaths / r.population * 100000).toFixed(2);
    });
    const sum = rows.reduce((a, r) => ({
      population: a.population + r.population, cases: a.cases + r.cases, deaths: a.deaths + r.deaths
    }), { population: 0, cases: 0, deaths: 0 });
    sum.regions = rows.length;
    sum.incidence = +(sum.cases / sum.population * 100000).toFixed(2);
    sum.mortality = +(sum.deaths / sum.population * 100000).toFixed(2);
    const result = { id: id('TABLE'), title: '纳入地区发病与死亡汇总', number: report.tables.length + 1,
      state: 'draft', snapshotId: report.snapshot.id, rows, sum, at: now() };
    report.tables.unshift(result);
    activity(report, '生成统计底稿', result.title + ' · D' + report.snapshot.version);
    return result;
  }
  function confirmTable(report, tableId) {
    assertEditing(report);
    const t = report.tables.find(v => v.id === tableId);
    if (t.snapshotId !== report.snapshot?.id) throw Error('统计底稿对应旧资料，请重新生成');
    const sum = t.rows.reduce((a, r) => a + r.cases, 0);
    if (sum !== t.sum.cases || t.sum.population <= 0) throw Error('统计表合计或人口分母异常');
    t.state = 'confirmed';
    report.chapters.forEach(c => { if (/\{\{/.test(c.body)) c.state = 'writing'; });
    activity(report, '确认统计底稿', t.title);
  }
  function metrics(report) { return currentTable(report)?.sum || null; }
  function preflight(report) {
    const issues = [];
    if (!report.snapshot || report.snapshot.stale) issues.push({ name: '当前统计资料批次未建立', view: 'data' });
    if (!currentTable(report)) issues.push({ name: '统计底稿尚未确认', view: 'materials' });
    report.chapters.filter(c => c.required).forEach(c => {
      if (c.state !== 'approved' || c.approvedRevision !== c.revision) issues.push({ name: c.title + '尚未审校通过', chapter: c.id, view: 'book' });
      chapterReady(report, c).forEach(name => issues.push({ name: c.title + '：' + name, chapter: c.id, view: 'book' }));
    });
    return issues;
  }
  function sendForFinal(report, reviewer) {
    assertEditing(report);
    const issues = preflight(report);
    if (issues.length) throw Error('书稿未达到整稿送审条件：' + issues[0].name);
    if (!reviewer?.trim()) throw Error('填写整稿审核人');
    if (report.rounds.some(r => r.state === 'pending')) throw Error('已有整稿审核轮次，请先处理');
    report.status = 'review';
    report.rounds.push({ id: id('ROUND'), round: report.rounds.length + 1, reviewer: reviewer.trim(),
      state: 'pending', at: now(), chapters: clone(report.chapters), snapshotId: report.snapshot.id, conclusion: '' });
    activity(report, '整稿送审', '第' + report.rounds.length + '轮 · ' + reviewer.trim());
  }
  function finalDecision(report, approved, reason) {
    assertEditing(report);
    if (!reason?.trim()) throw Error('填写整稿审核结论');
    const round = report.rounds.at(-1);
    if (!round || round.state !== 'pending') throw Error('没有待处理的整稿审核');
    if (approved) {
      if (preflight(report).length || round.snapshotId !== report.snapshot?.id ||
          round.chapters.some(c => c.revision !== report.chapters.find(v => v.id === c.id)?.revision))
        throw Error('送审后书稿或底稿发生变化，需重新送审');
      round.state = 'approved'; report.status = 'signed';
      report.publication = { signedAt: now(), manuscript: clone(report.chapters), data: clone(report.snapshot),
        tables: clone(report.tables), title: report.title, edition: report.edition };
    } else { round.state = 'returned'; report.status = 'editing'; }
    round.conclusion = reason.trim(); round.decidedAt = now();
    activity(report, approved ? '整稿定稿' : '整稿退回', reason.trim());
  }
  function publish(report, info) {
    if (report.status !== 'signed') throw Error('整稿定稿后才可登记发布');
    if (!info.channel?.trim() || !info.date) throw Error('填写发布渠道与日期');
    if (info.date > now().slice(0, 10)) throw Error('未来日期不能登记为已发布');
    if (info.date < report.publication.signedAt.slice(0, 10)) throw Error('发布日期不能早于定稿日期');
    report.publication.channel = info.channel.trim(); report.publication.date = info.date;
    report.publication.reference = info.reference || ''; report.publication.archivedAt = now();
    report.status = 'published'; activity(report, '出版发布与归档', info.channel + ' · ' + info.date);
  }
  function validateTemplate(tp) {
    const problems = [];
    if (!tp.name.trim()) problems.push('模板名称为空');
    if (!tp.chapters.length) problems.push('至少设置一个章节');
    if (!tp.chapters.some(c => c.required)) problems.push('至少设置一个必需章节');
    if (new Set(tp.chapters.map(c => c.id)).size !== tp.chapters.length) problems.push('章节标识重复');
    for (const c of tp.chapters) {
      if (!c.title.trim()) problems.push('章节标题为空');
      for (const m of c.body.matchAll(/\{\{([^{}]+)\}\}/g)) if (!METRICS[m[1]]) problems.push('未知指标：' + m[1]);
    }
    return [...new Set(problems)];
  }
  function revisionOf(report) {
    const revision = clone(report);
    revision.id = id('BOOK'); revision.edition++;
    revision.title += '（修订版）'; revision.status = 'editing';
    revision.rounds = []; revision.publication = null; revision.activity = [];
    revision.chapters.forEach(c => { c.state = 'writing'; });
    revision.previousReportId = report.id;
    activity(revision, '复制修订书稿', report.title + ' · 原版资料与正文已保留');
    return revision;
  }
  function fixtures() {
    const tp = template();
    const report = createReport({ title: '江西省肿瘤登记年报', dataYear: '2023', publishYear: '2026', owner: '陈静', due: '2026-12-15' }, tp);
    report.id = 'BOOK-2026-01';
    report.registers.forEach(r => { r.decision = 'include'; r.confirmed = true; r.note = '年度与范围已核对'; });
    freezeData(report); const t = buildTable(report); confirmTable(report, t.id);
    report.chapters[3].tables = [t.id]; report.chapters[5].tables = [t.id];
    for (const c of report.chapters.slice(0, 3)) { chapterState(report, c.id, 'submit'); chapterState(report, c.id, 'approve'); }
    report.chapters[3].state = 'review';
    comment(report, 'overall', { text: '请补充正文与表1的资料批次说明，避免读者将粗率直接用于地区风险比较。', quote: '地区分布及具体结果见表1。', author: '周宁' });
    const draft = createReport({ title: '2027年登记资料年度报告', dataYear: '2024', publishYear: '2027', owner: '王敏', due: '2027-05-30' }, tp);
    draft.id = 'BOOK-2027-01';
    const archive = clone(report); archive.id = 'BOOK-2025-01'; archive.title = '江西省肿瘤登记年报（2025版）';
    archive.dataYear = '2022'; archive.publishYear = '2025';
    archive.chapters.forEach(c => {
      c.comments.forEach(n => { n.state = 'resolved'; n.reply = '已修订'; });
      c.state = 'approved'; c.approvedRevision = c.revision;
    });
    sendForFinal(archive, '年报编委会'); finalDecision(archive, true, '书稿与底稿一致，准予定稿。');
    publish(archive, { channel: '编制单位发布', date: now().slice(0, 10) });
    return { schema: 1, reports: [report, draft, archive], templates: [
      tp, { ...clone(tp), id: 'TPL-CITY', family: 'city', name: '地区登记年度简报', description: '地区资料与年度简报',
        state: 'draft', enabled: false, chapters: clone(tp.chapters.filter(c => ['preface', 'overall', 'appendix'].includes(c.id))) }
    ] };
  }
  return { clone, id, now, PEOPLE, METRICS, activity, assertEditing, template, createReport, saveChapter, comment,
    resolveComment, chapterReady, chapterState, freezeData, invalidateData, buildTable, confirmTable, currentTable,
    metrics, preflight, sendForFinal, finalDecision, publish, validateTemplate, revisionOf, fixtures };
});
