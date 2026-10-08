/* ============================================================================
 * qc-l2.js — ② 病案与编码质控
 *
 * 页面：病案编码质控总览 / 编码问题 / 被质控数据详情
 * 围绕病案首页、ICD-10、ICD-O-3、病理和分期字段开展质量检查。
 *
 * 下钻链路：
 *   病案编码质控总览 → 编码问题 → 被质控数据详情 → 规则判定 → 纳入整改
 * ========================================================================== */
(function () {
  'use strict';

  var S = window.qcSpine, U = window.qcUI;

  var PAGE_META = {
    'qc-l2-code': { label: '病案编码质控总览', sub: '病案首页与 ICD-10 / ICD-O-3 编码质量' },
    'qc-l2-drill': { label: '编码指标分析', sub: '单项编码指标的分子分母、趋势与口径' },
    'qc-l2-org': { label: '机构编码质量', sub: '单项编码指标在各机构上的排名与达标' },
    'qc-enc-issues': { label: '编码问题', sub: '编码与字段问题的逐条核查与整改' },
    'qc-mcd-enc': { label: '被质控数据详情', sub: '病案原始数据 → 标准化 → 质控结果' }
  };

  var ST = {
    year: '2026', city: '', org: '', cancer: '', ind: 'E-01',
    issueType: '', status: '全部', page: 1, per: 20,
    issueKey: '', fromPage: 'qc-enc-issues'
  };

  function orgFilter() {
    if (ST.org) return [ST.org];
    if (ST.city) return S.ORGS.filter(function (o) { return o.city === ST.city; }).map(function (o) { return o.id; });
    return null;
  }

  /* ==================== 页面：病案编码质控总览 ==================== */
  function renderOverview() {
    var fs = orgFilter();

    /* 五项核心指标 */
    var kpiHtml = U.kpis(S.L2_IND.map(function (d) {
      var a = S.l2Agg(d.id, fs);
      var below = a.value < d.base;
      return {
        l: d.name, v: S.f1(a.value), unit: '%',
        tone: below ? 'warn' : 'up',
        m: '分子 <b>' + S.fmt(a.num) + '</b> / 分母 <b>' + S.fmt(a.den) + '</b> · 基准 ' + d.base + '%',
        action: 'l2:ind:' + d.id
      };
    }), 3);

    /* 问题类型分析 */
    var issues = S.l2Issues({ orgIds: fs });
    var byType = S.L2_ISSUES.map(function (t) {
      return { l: t.type, v: issues.filter(function (x) { return x.typeId === t.id; }).length };
    });
    var typeCard = U.card('问题类型分析',
      U.barChart(byType, { height: 170, unit: ' 条', colors: ['#d1435b', '#d98b2b', '#c9a0a0', '#5b8def', '#9a7bc1', '#6da8c9'] }), '六类编码与字段问题');

    /* 医疗机构分析 */
    var orgRows = S.l2ByOrg(ST.ind).filter(function (r) {
      return !fs || fs.indexOf(r.org) >= 0;
    }).map(function (r) {
      return {
        cls: r.value < 85 ? 'abn-row' : '',
        cells: [
          r.orgName, r.level,
          { h: S.fmt(r.den), cls: 'num' },
          { h: '<span style="padding:2px 7px;border-radius:4px;' + U.heat(r.value, 'up', 90) + '">' + S.f1(r.value) + '%</span>', cls: 'num' },
          { h: S.fmt(r.issueCount), cls: 'num' },
          { h: U.link('查看问题', 'l2:orgIssues:' + r.org) }
        ]
      };
    });
    var orgCard = U.card('医疗机构分析', U.table(
      ['医疗机构', '级别', '#病例数', '#正确率', '#问题数', '#操作'], orgRows, { empty: '暂无数据' }
    ), '按 ' + S.esc(S.l2Ind(ST.ind).name) + ' 排序',
      '<button class="btn btn-ghost btn-sm" data-qc="l2:toOrg">机构编码质量分析</button>');

    /* 质量趋势 */
    var trendPts = [];
    var base = S.l2Agg(ST.ind, fs).value;
    ['2022', '2023', '2024', '2025', '2026'].forEach(function (y, idx) {
      trendPts.push({ l: y, v: Math.round(S.clamp(base - (4 - idx) * 1.4 + (S.rnd01('l2tr|' + ST.ind + '|' + y) - 0.5) * 1.6, 50, 99.6) * 10) / 10 });
    });
    var trendCard = U.card('质量趋势',
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">' +
      '<span style="font-size:12px;color:#667085">当前指标：<b>' + S.esc(S.l2Ind(ST.ind).name) + '</b></span></div>' +
      U.lineChart(trendPts), '按时间查看编码质量变化');

    var filter = U.filterBar([
      { key: 'year', label: '统计年度', type: 'select', value: ST.year, options: ['2026', '2025', '2024'] },
      { key: 'city', label: '区域', type: 'select', value: ST.city, options: S.cityOptions() },
      { key: 'org', label: '医疗机构', type: 'select', value: ST.org, options: [{ v: '', l: '全部机构' }].concat(S.orgOptions()) },
      { key: 'ind', label: '质控指标', type: 'select', value: ST.ind, options: S.L2_IND.map(function (d) { return { v: d.id, l: d.name }; }) },
      { key: 'issueType', label: '问题类型', type: 'select', value: ST.issueType, options: [{ v: '', l: '全部类型' }].concat(S.L2_ISSUES.map(function (t) { return { v: t.id, l: t.type }; })) }
    ], 'l2');

    return '<div class="qc-page">' +
      U.head('病案编码质控总览', '围绕病案首页、ICD-10、ICD-O-3、病理和分期字段开展质量检查。',
        'l2', '② 病案与编码质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l2:toIssues">查看编码问题</button>') +
      filter +
      '<div style="font-size:13px;font-weight:700;color:#1f2937;margin:0 0 10px">核心指标</div>' +
      kpiHtml +
      U.note('说明：编码质控的每一条问题都可追溯至<b>具体病案的原始字段</b>。点击「查看问题」进入编码问题列表，' +
        '可查看该问题对应的原始业务数据与判定规则。') +
      '<div style="height:16px"></div>' +
      U.card('维度分析',
        '<div style="font-size:12.5px;color:#64748b;margin-bottom:10px">深入查看单项编码指标的分子分母与趋势，或某项指标在 18 家机构上的分层排名：</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn btn-primary btn-sm" data-qc="l2:toDrill" style="flex:1;min-width:150px">编码指标分析</button>' +
        '<button class="btn btn-primary btn-sm" data-qc="l2:toOrg" style="flex:1;min-width:150px">机构编码质量分析</button></div>',
        '当前指标：' + S.esc(S.l2Ind(ST.ind).name)) +
      U.grid2(typeCard, trendCard) +
      orgCard +
      '</div>';
  }

  /* ==================== 页面：编码指标分析（单指标） ==================== */
  function renderDrill() {
    var fs = orgFilter();
    var d = S.l2Ind(ST.ind);
    var a = S.l2Agg(d.id, fs);
    var below = a.value < d.base;

    var resultCard = U.card('指标结果',
      U.kpis([
        { l: '当前正确率', v: S.f1(a.value), unit: '%', tone: below ? 'warn' : 'up', m: '基准值 ' + d.base + '%' },
        { l: '分子', v: S.fmt(a.num), unit: '份', tone: 'info', m: '编码正确/完整的病案数' },
        { l: '分母', v: S.fmt(a.den), unit: '份', tone: 'info', m: '同期纳入统计的病案数' },
        { l: '与基准差值', v: (a.value - d.base >= 0 ? '+' : '') + S.f1(a.value - d.base), unit: '%', tone: below ? 'warn' : 'up', m: below ? '低于基准' : '达到基准' },
        { l: '问题条数', v: S.fmt(S.l2Issues({ orgIds: fs }).length), unit: '条', tone: 'bad', m: '当前范围编码问题' }
      ], 3));

    /* 口径卡 */
    var defCard = U.card('指标口径',
      U.kv([['指标名称', S.esc(d.name)], ['分子口径', S.esc(d.num)], ['分母口径', S.esc(d.den)], ['基准值', d.base + '%']], 2),
      '编码质控口径说明');

    /* 趋势 */
    var trendPts = [];
    ['2022', '2023', '2024', '2025', '2026'].forEach(function (y, idx) {
      trendPts.push({ l: y, v: Math.round(S.clamp(a.value - (4 - idx) * 1.4 + (S.rnd01('l2tr|' + d.id + '|' + y) - 0.5) * 1.6, 50, 99.6) * 10) / 10 });
    });
    var trendCard = U.card('指标趋势', U.lineChart(trendPts), '近五年编码质量变化');

    /* 维度导航 */
    var navCard = U.card('维度分析',
      '<div style="font-size:12.5px;color:#64748b;margin-bottom:10px">查看该指标在各机构上的分层排名：</div>' +
      '<button class="btn btn-primary btn-sm" data-qc="l2:toOrg" style="width:100%">机构编码质量分析</button>',
      '按机构下钻');

    return '<div class="qc-page">' +
      U.head('编码指标分析 · ' + d.name, '分子 ' + S.fmt(a.num) + ' / 分母 ' + S.fmt(a.den) + '，基准值 ' + d.base + '%',
        'l2', '② 病案与编码质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l2:back">返回总览</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l2:toOrg">机构分析</button>') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' + S.L2_IND.map(function (x) {
        return '<button class="btn ' + (x.id === d.id ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-qc="l2:dind:' + x.id + '">' + S.esc(x.name.replace(/率$/, '').slice(0, 8)) + '</button>';
      }).join('') + '</div>' +
      resultCard +
      U.grid2(trendCard, navCard) +
      defCard +
      '</div>';
  }

  /* ==================== 页面：机构编码质量分析（单指标 × 18 机构） ==================== */
  function renderOrg() {
    var d = S.l2Ind(ST.ind);
    var all = S.l2Agg(d.id, null).value;
    var bo = S.l2ByOrg(d.id);
    if (ST.city) bo = bo.filter(function (r) { return r.city === ST.city; });
    var passCount = bo.filter(function (r) { return r.value >= d.base; }).length;
    var failCount = bo.length - passCount;
    var totalIssue = bo.reduce(function (s, r) { return s + r.issueCount; }, 0);

    var kpiHtml = U.kpis([
      { l: '当前正确率', v: S.f1(all), unit: '%', tone: all >= d.base ? 'up' : 'warn', m: '基准 ' + d.base + '%' },
      { l: '已覆盖机构', v: bo.length, unit: '家', tone: 'info', m: ST.city ? S.cityName(ST.city) : '全省' },
      { l: '达标机构', v: passCount, unit: '家', tone: passCount >= bo.length * 0.5 ? 'up' : 'warn', m: '正确率≥基准' },
      { l: '未达标机构', v: failCount, unit: '家', tone: failCount > 0 ? 'warn' : 'up', m: '低于基准要求' },
      { l: '问题合计', v: S.fmt(totalIssue), unit: '条', tone: 'bad', m: '编码与字段问题' }
    ], 3);

    /* 分级汇总 */
    var levelMap = {};
    bo.forEach(function (r) {
      if (!levelMap[r.level]) levelMap[r.level] = { den: 0, sum: 0, count: 0, issue: 0 };
      levelMap[r.level].den += r.den; levelMap[r.level].sum += r.value; levelMap[r.level].count++; levelMap[r.level].issue += r.issueCount;
    });
    var levelRows = Object.keys(levelMap).map(function (lv) {
      var m = levelMap[lv];
      return { cells: [lv, { h: m.count + ' 家', cls: 'num' }, { h: S.fmt(m.den), cls: 'num' },
        { h: '<span class="badge-info">' + S.f1(m.sum / m.count) + '%</span>', cls: 'num' },
        { h: S.fmt(m.issue), cls: 'num' }] };
    });
    var levelCard = U.card('分级汇总', U.table(['级别', '机构数', '#病案数', '平均正确率', '#问题数'], levelRows, { compact: true }), '按机构级别');

    /* 排名柱状图 */
    var barCard = U.card('机构正确率排名',
      U.barChart(bo.slice().sort(function (a2, b2) { return b2.value - a2.value; }).map(function (r) {
        return { l: r.orgName.length > 6 ? r.orgName.slice(0, 6) + '…' : r.orgName, v: r.value };
      }), { height: 220, unit: '%', fmt: function (v) { return S.f1(v) + '%'; } }),
      '按正确率从高到低');

    /* 明细 */
    var detailRows = bo.slice().sort(function (a2, b2) { return b2.value - a2.value; }).map(function (r, idx) {
      var style = U.heat(r.value, 'up', 90);
      var tone = r.value >= d.base ? 'badge-success' : 'badge-danger';
      return {
        cells: [
          { h: '<b>' + (idx + 1) + '</b>', cls: 'num' },
          r.orgName, r.level,
          { h: S.fmt(r.den), cls: 'num' },
          { h: '<span style="padding:2px 7px;border-radius:4px;' + style + '">' + S.f1(r.value) + '%</span>', cls: 'num' },
          { h: '<span class="' + tone + '">' + (r.gap >= 0 ? '+' : '') + S.f1(r.gap) + '%</span>', cls: 'num' },
          { h: r.issueCount > 0 ? '<span style="color:#b42335">' + S.fmt(r.issueCount) + '</span>' : '0', cls: 'num' },
          { h: U.link('查看问题', 'l2:orgIssues:' + r.org) }
        ]
      };
    });
    var detailTable = U.table(['#', '医疗机构', '级别', '#病案数', '#正确率', '#区域均值差', '#问题数', '#操作'], detailRows, { compact: true });

    var filter = U.filterBar([
      { key: 'city', label: '设区市', type: 'select', value: ST.city, options: S.cityOptions() }
    ], 'l2o');

    return '<div class="qc-page">' +
      U.head('机构编码质量分析 · ' + d.name, '单项编码指标在' + bo.length + '家医疗机构上的排名、区域均值与达标情况' +
        (ST.city ? '（' + S.cityName(ST.city) + '）' : '（全省 18 家）'), 'l2', '② 病案与编码质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l2:backDrill">返回指标分析</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l2:back">总览</button>') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' + S.L2_IND.map(function (x) {
        return '<button class="btn ' + (x.id === d.id ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-qc="l2:oind:' + x.id + '">' + S.esc(x.name.replace(/率$/, '').slice(0, 8)) + '</button>';
      }).join('') + '</div>' +
      filter +
      kpiHtml +
      U.grid2(levelCard, barCard) +
      detailTable +
      '</div>';
  }

  /* ==================== 页面：编码问题 ==================== */
  function renderIssues() {
    var fs = orgFilter();
    var all = S.l2Issues({
      orgIds: fs,
      types: ST.issueType ? [ST.issueType] : null,
      status: ST.status
    });
    if (ST.cancer) all = all.filter(function (x) { return x.cancer === ST.cancer; });

    var sl = U.slice(all, ST.page, ST.per);
    var rows = sl.rows.map(function (r) {
      return {
        cls: 'abn-row',
        cells: [
          { h: U.link(r.name, 'l2:issue:' + r.key) },
          r.orgName,
          r.cancerName,
          r.type,
          r.field,
          { h: r.current === '' ? '<span style="color:#b42335">（空）</span>' : '<span class="mono">' + S.esc(r.current) + '</span>' },
          r.verdict,
          { h: U.statusBadge(r.status) },
          { h: U.link('被质控数据', 'l2:issue:' + r.key) }
        ]
      };
    });

    /* 问题状态统计 */
    var stCount = {};
    ['待处理', '整改中', '待复核', '已关闭'].forEach(function (s) {
      stCount[s] = all.filter(function (x) { return x.status === s; }).length;
    });

    var filter = U.filterBar([
      { key: 'org', label: '医疗机构', type: 'select', value: ST.org, options: [{ v: '', l: '全部机构' }].concat(S.orgOptions()) },
      { key: 'cancer', label: '癌种', type: 'select', value: ST.cancer, options: [{ v: '', l: '全部癌种' }].concat(S.cancerOptions()) },
      { key: 'issueType', label: '问题类型', type: 'select', value: ST.issueType, options: [{ v: '', l: '全部类型' }].concat(S.L2_ISSUES.map(function (t) { return { v: t.id, l: t.type }; })) },
      { key: 'ind', label: '编码类型', type: 'select', value: ST.ind, options: S.L2_IND.map(function (d) { return { v: d.id, l: d.name }; }) },
      { key: 'status', label: '状态', type: 'select', value: ST.status, options: ['全部', '待处理', '整改中', '待复核', '已关闭'] }
    ], 'l2i');

    return '<div class="qc-page">' +
      U.head('编码问题', '病案首页与编码字段的质量问题清单，支持直接查看问题对应的原始业务数据。',
        'l2', '② 病案与编码质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l2:back">返回总览</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l2:export">导出数据</button>') +
      U.kpis([
        { l: '问题总数', v: S.fmt(all.length), unit: '条', tone: 'bad', m: '当前筛选范围内' },
        { l: '待处理', v: S.fmt(stCount['待处理']), unit: '条', tone: 'warn' },
        { l: '整改中', v: S.fmt(stCount['整改中']), unit: '条', tone: 'info' },
        { l: '待复核', v: S.fmt(stCount['待复核']), unit: '条', tone: 'info' },
        { l: '已关闭', v: S.fmt(stCount['已关闭']), unit: '条', tone: 'up' }
      ], 5) +
      filter +
      U.card('问题列表',
        U.table(['患者', '医疗机构', '癌种', '问题类型', '问题字段', '当前值', '质控结论', '状态', '操作'],
          rows, { compact: true, empty: '暂无符合条件的编码问题' }) +
        U.pager(sl.total, sl.page, ST.per, 'l2i'),
        '列表支持直接查看当前问题对应的原始业务数据') +
      '</div>';
  }

  /* ==================== 页面：被质控数据详情（编码） ==================== */
  function findIssue() {
    var all = S.l2Issues({});
    for (var i = 0; i < all.length; i++) if (all[i].key === ST.issueKey) return all[i];
    /* 直接从菜单进入本页时，取第一条问题作为样例，避免空态 */
    return all[0] || null;
  }

  function renderMCD() {
    var r = findIssue();
    if (!r) {
      return '<div class="qc-page">' + U.head('被质控数据详情', '病案编码证据', 'l2', '② 病案与编码质控') +
        U.card('未找到问题', '<div class="qc-empty">请从「编码问题」页面点击患者进入。</div>') + '</div>';
    }
    var rule = { code: r.rule, name: r.type, ver: 'V2026.1', cond: r.cond, field: r.field };

    /* 病案信息 */
    var caseCard = U.card('病案信息', U.kv([
      ['病案首页编号', S.esc(r.id)], ['患者', S.esc(r.name) + '（' + r.sex + ' / ' + r.age + ' 岁）'],
      ['医疗机构', S.esc(r.orgName)], ['癌种', S.esc(r.cancerName)],
      ['主要诊断', S.esc(r.cancerName)], ['ICD-10', r.typeId === 'L2-01' ? '<span style="color:#b42335">（空）</span>' : S.esc(S.currentSample(r, 'icd10'))],
      ['ICD-O-3', r.typeId === 'L2-03' ? '<span style="color:#b42335">' + S.esc(r.current) + '</span>' : S.esc(S.standardOf(r.typeId, r.key))],
      ['病理信息', r.typeId === 'L2-04' ? '<span style="color:#b42335">（空）</span>' : '腺癌 · 8140/3'],
      ['TNM 分期', r.typeId === 'L2-05' ? '<span style="color:#b42335">' + S.esc(r.current) + '</span>' : 'pT2N1M0']
    ], 3), '与本次质控相关的病案字段');

    /* 数据对比：原始数据 | 标准化数据 | 质控结果 */
    var compareRows = [
      { cells: ['主要诊断', '肺恶性肿瘤', 'C34.9 肺恶性肿瘤', r.typeId === 'L2-01' ? U.badge('缺失', 'danger') : U.badge('通过', 'success')] },
      { cells: ['ICD-10 编码', r.typeId === 'L2-02' ? r.current : 'C34.9', 'C34.9', r.typeId === 'L2-02' ? U.badge('不一致', 'danger') : U.badge('通过', 'success')] },
      { cells: ['ICD-O-3 形态学', r.typeId === 'L2-03' ? r.current : '8140/3', '8140/3', r.typeId === 'L2-03' ? U.badge('异常', 'danger') : U.badge('通过', 'success')] },
      { cells: ['病理诊断', r.typeId === 'L2-04' ? '（空）' : '腺癌', '腺癌', r.typeId === 'L2-04' ? U.badge('缺失', 'danger') : U.badge('通过', 'success')] },
      { cells: ['TNM 分期', r.typeId === 'L2-05' ? r.current : 'pT2N1M0', 'pT2N1M0', r.typeId === 'L2-05' ? U.badge('缺失', 'danger') : U.badge('通过', 'success')] }
    ];
    var compareCard = U.card('数据对比',
      U.table(['检查字段', '原始数据', '标准化数据', '质控结果'], compareRows, { compact: true }),
      '原始数据 → 标准化数据 → 质控结果');

    /* 规则判定 */
    var judgeCard = U.card('规则判定',
      U.judgeBlock(rule,
        '<div style="font-size:12.5px;line-height:1.7">· <b>当前数据</b>：' +
        (r.current === '' ? '<span style="color:#b42335">（空）</span>' : S.esc(r.current)) + '</div>' +
        '<div style="font-size:12.5px;line-height:1.7">· <b>期望数据</b>：' + S.esc(r.expect) + '</div>' +
        '<div style="font-size:12.5px;line-height:1.7">· <b>标准化值</b>：' + S.esc(r.standard) + '</div>',
        r.verdict, r.desc) +
      '<div style="height:12px"></div>' +
      U.note('问题描述：' + S.esc(r.desc) + '。请核对原始病案与病理报告后修正编码，' +
        '修正后重新提交质控校验。', true));

    /* 原始数据追溯 */
    var traceRows = [
      { cells: ['病案首页系统', 'MAIN_DIAG_CODE', r.current === '' ? '<span style="color:#b42335">（空）</span>' : S.esc(r.current), 'ICD-10 编码', S.esc(r.standard), U.badge('已标准化', 'info')] },
      { cells: ['病理系统', 'MORPH_CODE', r.typeId === 'L2-03' ? S.esc(r.current) : '8140/3', 'ICD-O-3 形态学', '8140/3', U.badge('已标准化', 'info')] },
      { cells: ['病案首页系统', 'DIAG_NAME', S.esc(r.cancerName), '诊断名称', S.esc(r.cancerName), U.badge('原值入库', 'neutral')] }
    ];
    var traceCard = U.card('原始数据追溯',
      U.table(['数据来源', '原始字段', '原始值', '标准化字段', '入库值', '处理'], traceRows, { compact: true }) +
      U.note('支持追溯至数据来源和原始字段。原始值来自源系统字段级快照。', true));

    return '<div class="qc-page">' +
      U.head('被质控数据详情', r.type + ' · ' + r.orgName, 'l2', '② 病案与编码质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l2:backIssues">返回列表</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l2:rule">查看规则</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l2:mark">标记问题</button>' +
        '<button class="btn btn-primary btn-sm" data-qc="l2:toFix">纳入整改</button>') +
      caseCard + compareCard + judgeCard + traceCard +
      '</div>';
  }

  /* ==================== 路由 ==================== */
  function render(pageId) {
    if (pageId === 'qc-g-enc') pageId = 'qc-l2-code';
    if (pageId === 'qc-l2-code') return renderOverview();
    if (pageId === 'qc-l2-drill') return renderDrill();
    if (pageId === 'qc-l2-org') return renderOrg();
    if (pageId === 'qc-enc-issues') return renderIssues();
    if (pageId === 'qc-mcd-enc') return renderMCD();
    return null;
  }

  /* ==================== 交互 ==================== */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-qc]') : null;
    if (!el) return;
    var a = el.getAttribute('data-qc');
    if (a.indexOf('l2') !== 0) return;

    if (a === 'filter:apply:l2' || a === 'filter:reset:l2') {
      if (a.indexOf('reset') > 0) { ST.city = ''; ST.org = ''; ST.cancer = ''; ST.issueType = ''; ST.year = '2026'; }
      else {
        var box = el.closest('.qc-filter'), reads = box ? box.querySelectorAll('[data-qcf]') : [];
        for (var i = 0; i < reads.length; i++) {
          var k = reads[i].getAttribute('data-qcf'), v = reads[i].value;
          if (k === 'range' || k === 'ind') continue;
          ST[k] = v === '全部' ? '' : v;
        }
      }
      window.renderPage('qc-l2-code');
      return;
    }
    /* 机构编码质量分析的筛选（设区市） */
    if (a === 'filter:apply:l2o' || a === 'filter:reset:l2o') {
      if (a.indexOf('reset') > 0) { ST.city = ''; }
      else {
        var boxO = el.closest('.qc-filter'), rdO = boxO ? boxO.querySelectorAll('[data-qcf]') : [];
        for (var io = 0; io < rdO.length; io++) { ST[rdO[io].getAttribute('data-qcf')] = rdO[io].value; }
      }
      window.renderPage('qc-l2-org');
      return;
    }
    if (a.indexOf('l2:ind:') === 0) { ST.ind = a.split(':')[2]; window.navigateTo('qc-l2-drill'); return; }
    if (a.indexOf('l2:dind:') === 0) { ST.ind = a.split(':')[2]; window.renderPage('qc-l2-drill'); return; }
    if (a.indexOf('l2:oind:') === 0) { ST.ind = a.split(':')[2]; window.renderPage('qc-l2-org'); return; }
    if (a === 'l2:back') { window.navigateTo('qc-l2-code'); return; }
    if (a === 'l2:backDrill') { window.navigateTo('qc-l2-drill'); return; }
    if (a === 'l2:toDrill') { window.navigateTo('qc-l2-drill'); return; }
    if (a === 'l2:toOrg') { window.navigateTo('qc-l2-org'); return; }
    if (a === 'l2:toIssues') { ST.page = 1; window.navigateTo('qc-enc-issues'); return; }
    if (a.indexOf('l2:orgIssues:') === 0) { ST.org = a.split(':')[2]; ST.page = 1; window.navigateTo('qc-enc-issues'); return; }
    if (a === 'l2:export') { U.toast('已按当前筛选条件导出编码问题（演示）'); return; }

    /* 编码问题页筛选 */
    if (a === 'filter:apply:l2i' || a === 'filter:reset:l2i') {
      if (a.indexOf('reset') > 0) { ST.org = ''; ST.cancer = ''; ST.issueType = ''; ST.status = '全部'; }
      else {
        var box2 = el.closest('.qc-filter'), rd2 = box2 ? box2.querySelectorAll('[data-qcf]') : [];
        for (var j = 0; j < rd2.length; j++) {
          var k2 = rd2[j].getAttribute('data-qcf'), v2 = rd2[j].value;
          if (k2 === 'ind') continue;
          ST[k2] = v2 === '全部' ? '' : v2;
        }
      }
      ST.page = 1;
      window.renderPage('qc-enc-issues');
      return;
    }
    if (a.indexOf('l2i:page:') === 0) { ST.page = parseInt(a.split(':')[2], 10) || 1; window.renderPage('qc-enc-issues'); return; }

    /* 问题详情 */
    if (a.indexOf('l2:issue:') === 0) { ST.issueKey = a.slice('l2:issue:'.length); window.navigateTo('qc-mcd-enc'); return; }
    if (a === 'l2:backIssues') { window.navigateTo('qc-enc-issues'); return; }
    if (a === 'l2:rule') {
      var r = findIssue();
      if (r) U.modal('质控规则 · ' + r.type,
        U.judgeBlock({ code: r.rule, name: r.type, ver: 'V2026.1', cond: r.cond, field: r.field },
          '<div>当前数据：' + (r.current === '' ? '（空）' : S.esc(r.current)) + '</div>', r.verdict, r.desc));
      return;
    }
    if (a === 'l2:mark') { U.toast('已标记编码问题（演示）'); return; }
    if (a === 'l2:toFix') {
      var c = findIssue();
      if (c) U.toast('已将「' + c.name + ' · ' + c.type + '」纳入整改任务');
      return;
    }
    if (a === 'layer:toggle') {
      var b3 = el.closest('.qc-layer');
      if (b3) {
        b3.classList.toggle('collapsed');
        var ar = b3.querySelector('.ar');
        if (ar) ar.textContent = b3.classList.contains('collapsed') ? '展开 ▾' : '收起 ▴';
      }
    }
  });

  window.qcL2 = {
    pageIds: ['qc-g-enc', 'qc-l2-code', 'qc-l2-drill', 'qc-l2-org', 'qc-enc-issues', 'qc-mcd-enc'],
    render: render,
    meta: PAGE_META,
    state: ST
  };
})();
