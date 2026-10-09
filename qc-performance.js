/* ============================================================================
 * qc-performance.js — 六大绩效质控
 *
 * 定位：对「地区（设区市）与医院（医疗机构）」的绩效考核，围绕国考六项
 *      肿瘤专业质控指标展开。原始数据（病例明细）与基本结果（指标值 / 分子分母 /
 *      达标判定）优先，趋势、总分等分析后置为辅助。
 *
 * 单一数据源：所有数字取自 window.qcSpine，不新建数据。
 * 关联关系：
 *   · 每项绩效对应一组判定规则（见 quality-control.js 的 qc-p1 … qc-p6）——
 *     本页「异常明细」下钻到病例后，可查看触发规则，配与看形成闭环；
 *   · 部分病例异常根因是报告卡字段缺陷，底部提供「前往报卡质量监测」出口，
 *     交由登记条线在其页面内处置（报告卡质量本身不在本页管理）。
 *
 * 页面结构（同页纵向排列，不做视图切换）：
 *   [筛选条] 年度/设区市/医疗机构/癌种
 *   [指标切换] 六项 | 全部
 *   [覆盖癌种] 本指标适用癌种（可点选过滤）
 *   [地区考核] [医院考核] [分癌种考核] [异常明细（原始数据）+ 字段缺陷面板]
 *
 * 癌种口径（关键）：六大绩效指标各由《国家三级公立医院绩效考核操作手册》
 *   规定其适用癌种，同一指标须按癌种分别判定达标，不能只看合计。
 *   · 各指标适用癌种见 qc-data.js 的 L1_IND[].cancers（10/9/8/5/4/5 个）；
 *   · 合计值仅作参考，「癌种达标 n/m」才是考核口径；
 *   · 单指标模式给「分癌种考核」表，六项全览给「癌种 × 六项」矩阵（空格为不覆盖）。
 * 暴露：window.qcPerformance = { pageIds:['qc-performance'], render, state }
 * ========================================================================== */
(function () {
  'use strict';
  var S = window.qcSpine, U = window.qcUI;

  var P = {
    year: '2026', ind: '',            /* ind='' 表示六项全览 */
    city: '', org: '', cancer: '',
    verdict: 'ALL',                   /* 异常明细过滤：ALL/ok/bad/miss/abn */
    page: 1
  };

  function inds() { return S.L1_IND; }
  function curInd() { return S.ind(P.ind) || S.L1_IND[0]; }
  function orgFilter() { return P.org ? [P.org] : null; }
  function cancerFilter() { return P.cancer ? [P.cancer] : null; }
  function cityOrgIds() {
    if (!P.city) return null;
    return S.ORGS.filter(function (o) { return o.city === P.city; }).map(function (o) { return o.id; });
  }
  /* 明细列表的有效机构范围：优先单机构，其次设区市，最后全省 */
  function effOrgIds() {
    if (P.org) return [P.org];
    if (P.city) return cityOrgIds();
    return null;
  }

  /* ---------- 癌种维度公共件（六大绩效本身按癌种分别考核） ---------- */
  function badge(p) { return p ? '<span class="badge badge-success">达标</span>' : '<span class="badge badge-danger">未达标</span>'; }
  function lineOf(i) { return (i.dir === 'down' ? '≤' : '≥') + i.base + '%'; }
  /* 当前指标覆盖的癌种；六项全览时给全部 10 个癌种 */
  function coveredCancerIds() {
    var i = S.ind(P.ind);
    return i ? i.cancers.slice() : S.CANCERS.map(function (c) { return c.id; });
  }
  /* 指标在某机构范围内「达标癌种数 / 覆盖癌种数」——同一指标不同癌种分别判定 */
  function coverStat(indId, orgIds) {
    var i = S.ind(indId);
    if (!i) return { n: 0, m: 0 };
    var ids = (orgIds && orgIds.length) ? orgIds : S.ORGS.map(function (o) { return o.id; });
    var n = 0;
    i.cancers.forEach(function (c) {
      var a = S.agg(indId, ids, [c]);
      if (a.den > 0 && S.l1Pass(indId, a.value)) n++;
    });
    return { n: n, m: i.cancers.length };
  }
  function covCell(st) {
    var tone = st.m && st.n === st.m ? '#2e7d32' : (st.n === 0 ? '#b42335' : '#b54708');
    return '<span style="color:' + tone + ';font-weight:600">' + st.n + '/' + st.m + '</span>';
  }

  /* ---------- 考核口径：指标下拉 + 癌种联动 ----------
     指标与癌种是"口径"（算哪个指标、算哪些癌种），与筛选栏的"范围"（年度/地区/机构）
     分开。癌种选项由所选指标的适用癌种决定，选六项全览时给全部 10 个癌种。 */
  function cancerOptionsForInd() {
    var i = S.ind(P.ind);
    var ids = i ? i.cancers : S.CANCERS.map(function (c) { return c.id; });
    return [{ v: '', l: '全部癌种' }].concat(ids.map(function (c) {
      return { v: c, l: S.cancer(c).name };
    }));
  }
  function optHtml(list, cur) {
    return list.map(function (o) {
      return '<option value="' + S.esc(o.v) + '"' + (String(cur) === String(o.v) ? ' selected' : '') + '>' + S.esc(o.l) + '</option>';
    }).join('');
  }
  /* 筛选条：五个字段一行排完，不换行。
     宽度分配按「内容长度」而非等分——年度 96px，设区市 / 医疗机构 / 癌种
     各按 1 份伸缩，质控指标名称最长给 1.6 份；五项合计 min-width 约 1140px，
     减去左侧导航后 1600px 视口仍有余量，1600 以下由 flex-shrink 平滑收缩。 */
  function scopeBar() {
    var indOpts = [{ v: '', l: '六项全览' }].concat(S.L1_IND.map(function (i) {
      return { v: i.id, l: i.name };
    }));
    var yearOpts = ['2026', '2025', '2024'].map(function (y) { return { v: y, l: y }; });
    var orgOpts = [{ v: '', l: '全部机构' }].concat(S.orgOptions());
    function sel(key, label, list, cur, style, attr) {
      return '<div class="fg' + (style ? ' ' + style : '') + '"><label>' + S.esc(label) + '</label>' +
        '<select ' + (attr || 'data-qcp') + '="' + S.esc(key) + '">' + optHtml(list, cur) + '</select></div>';
    }
    return '<div class="qc-filter qc-scope">' +
      sel('year', '统计年度', yearOpts, P.year, 'w-year', 'data-qcf') +
      sel('city', '设区市', S.cityOptions(), P.city, 'w-mid', 'data-qcf') +
      sel('org', '医疗机构', orgOpts, P.org, 'w-mid', 'data-qcf') +
      sel('ind', '质控指标', indOpts, P.ind, 'w-wide') +
      sel('cancer', '癌种', cancerOptionsForInd(), P.cancer, 'w-mid') +
      '<div class="acts">' +
      '<button class="btn btn-ghost btn-sm" data-qc="filter:reset:pf">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-qc="filter:apply:pf">查询</button>' +
      '</div>' +
      '</div>';
  }

  /* ==================== 地区考核 ==================== */
  function cityRowForInd(indId) {
    return S.CITIES.map(function (ct) {
      var ids = S.ORGS.filter(function (o) { return o.city === ct.code; }).map(function (o) { return o.id; });
      var a = S.agg(indId, ids.length ? ids : ['__none__'], cancerFilter());
      var pass = S.l1Pass(indId, a.value);
      var abn = S.abnCount(indId, null, ids.length ? ids : ['__none__']);
      var yoy = S.yoy(indId, ids.length ? ids : ['__none__'], cancerFilter());
      var cov = ids.length ? coverStat(indId, ids) : { n: 0, m: (S.ind(indId) || { cancers: [] }).cancers.length };
      return { code: ct.code, name: ct.name, a: a, pass: pass, abn: abn, yoy: yoy, cov: cov };
    });
  }

  function regionSingle() {
    var i = curInd();
    var rows = cityRowForInd(i.id);
    var total = S.agg(i.id, cityOrgIds(), cancerFilter());
    var totalPass = S.l1Pass(i.id, total.value);
    function valCell(v) { return '<span style="font-variant-numeric:tabular-nums;font-weight:600">' + S.f1(v) + '%</span>'; }
    var bodyRows = rows.map(function (r) {
      return {
        cells: [
          { h: U.link(r.name, 'pf:region:' + r.code), cls: 'txt' },
          { h: valCell(r.a.value), cls: 'num' },
          { h: '<span style="color:#94a3b8">' + lineOf(i) + '</span>', cls: 'num' },
          { h: badge(r.pass) },
          { h: covCell(r.cov), cls: 'num', title: '该地区覆盖的 ' + r.cov.m + ' 个癌种中已达标数' },
          { h: S.fmt(r.a.num), cls: 'num' },
          { h: S.fmt(r.a.den), cls: 'num' },
          { h: S.fmt(r.abn), cls: 'num' },
          { h: (r.yoy >= 0 ? '+' : '') + r.yoy + '%', cls: 'num' },
          { h: U.link('明细', 'pf:detail:' + i.id + ':' + r.code), cls: 'num' }
        ],
        cls: r.pass ? '' : 'abn-row'
      };
    });
    var totalRow = {
      cls: 'sum-row',
      cells: [
        { h: '全省合计', cls: 'txt' },
        { h: valCell(total.value), cls: 'num' },
        { h: '<span style="color:#94a3b8">达标线</span>', cls: 'num' },
        { h: badge(totalPass) },
        { h: covCell(coverStat(i.id, cityOrgIds())), cls: 'num' },
        { h: S.fmt(total.num), cls: 'num' },
        { h: S.fmt(total.den), cls: 'num' },
        { h: S.fmt(S.abnCount(i.id, null, cityOrgIds())), cls: 'num' },
        { h: '—', cls: 'num' },
        { h: '', cls: 'num' }
      ]
    };
    var table = U.table(
      ['设区市', '#' + i.name, '#达标线', '达标', '癌种达标', '#分子', '#分母', '#异常病例', '#同比', '操作'],
      bodyRows.concat([totalRow]), { compact: true });
    var card = U.card('地区考核 · ' + i.name,
      U.note('适用癌种：' + i.cancers.map(function (c) { return S.esc(S.cancer(c).name); }).join('、') +
        '；分子/分母口径：' + S.esc(i.num) + ' / ' + S.esc(i.den) + '。') + table,
      '「癌种达标」为该地区已达标癌种数 / 覆盖癌种数；点癌种可下钻');
    return card;
  }

  function regionAll() {
    var cols = S.L1_IND.map(function (i) { return i; });
    var bodyRows = S.CITIES.map(function (ct) {
      var ids = S.ORGS.filter(function (o) { return o.city === ct.code; }).map(function (o) { return o.id; });
      var passN = 0, abnTot = 0;
      var cells = cols.map(function (i) {
        var a = S.agg(i.id, ids.length ? ids : ['__none__'], cancerFilter());
        var pass = S.l1Pass(i.id, a.value);
        if (pass) passN++;
        abnTot += S.abnCount(i.id, null, ids.length ? ids : ['__none__']);
        var tone = pass ? '#2e7d32' : '#b42335';
        return { h: '<div style="line-height:1.25"><div style="font-weight:700;color:' + tone + '">' + S.f1(a.value) + '%</div>' +
          '<div style="font-size:11px;color:#94a3b8">' + (pass ? '达标' : '未达标') + '</div></div>', cls: 'num', title: i.name };
      });
      return {
        cells: [{ h: U.link(ct.name, 'pf:region:' + ct.code), cls: 'txt' }]
          .concat(cells)
          .concat([
            { h: '<b>' + passN + '/6</b>', cls: 'num' },
            { h: S.fmt(abnTot), cls: 'num' },
            { h: U.link('明细', 'pf:detailAll:' + ct.code), cls: 'num' }
          ])
      };
    });
    var header = ['设区市'].concat(cols.map(function (i) { return '#' + i.short; }))
      .concat(['#达标', '#异常病例', '操作']);
    var card = U.card('地区考核 · 六项全览',
      U.note('每格为该设区市对应指标的当前值；绿色已达标、红色未达标。点击「明细」查看该地区异常病例。') +
      U.table(header, bodyRows, { compact: true }),
      '六项国考指标 11 个设区市 一屏对照');
    return card;
  }

  /* ==================== 医院考核 ==================== */
  function orgRows(indId) {
    var list = S.ORGS.filter(function (o) { return !P.city || o.city === P.city; });
    return list.map(function (o) {
      var a = S.agg(indId, [o.id], cancerFilter());
      var pass = S.l1Pass(indId, a.value);
      var abn = S.abnCount(indId, null, [o.id]);
      return { o: o, a: a, pass: pass, abn: abn, cov: coverStat(indId, [o.id]) };
    }).sort(function (x, y) { return (S.ind(indId).dir === 'down' ? 1 : -1) * (x.a.value - y.a.value); });
  }

  function orgSingle() {
    var i = curInd();
    var rows = orgRows(i.id);
    var bodyRows = rows.map(function (r) {
      return {
        cells: [
          r.o.name, r.o.level, S.cityName(r.o.city),
          { h: '<b>' + S.f1(r.a.value) + '%</b>', cls: 'num' },
          { h: badge(r.pass) },
          { h: covCell(r.cov), cls: 'num', title: '该机构覆盖的 ' + r.cov.m + ' 个癌种中已达标数' },
          { h: S.fmt(r.a.num), cls: 'num' },
          { h: S.fmt(r.a.den), cls: 'num' },
          { h: S.fmt(r.abn), cls: 'num' },
          { h: U.link('明细', 'pf:detail:' + i.id + '::' + r.o.id), cls: 'num' }
        ],
        cls: r.pass ? '' : 'abn-row'
      };
    });
    var card = U.card('医院考核 · ' + i.name,
      U.note('筛选范围：' + (P.city ? S.cityName(P.city) : '全省 ' + S.ORGS.length + ' 家') +
        '；按指标值' + (i.dir === 'down' ? '从低到高' : '从高到低') + '排序。适用癌种：' +
        i.cancers.map(function (c) { return S.esc(S.cancer(c).name); }).join('、') + '。') +
      U.table(['医疗机构', '级别', '设区市', '#' + i.name, '达标', '癌种达标', '#分子', '#分母', '#异常病例', '操作'], bodyRows, { compact: true }),
      '未达标机构标红');
    return card;
  }

  function orgAll() {
    var cols = S.L1_IND;
    var list = S.ORGS.filter(function (o) { return !P.city || o.city === P.city; });
    var bodyRows = list.map(function (o) {
      var passN = 0, abnTot = 0;
      var cells = cols.map(function (i) {
        var a = S.agg(i.id, [o.id], cancerFilter());
        var pass = S.l1Pass(i.id, a.value);
        if (pass) passN++;
        abnTot += S.abnCount(i.id, null, [o.id]);
        return { h: '<span style="font-weight:600;color:' + (pass ? '#2e7d32' : '#b42335') + '">' + S.f1(a.value) + '%</span>', cls: 'num' };
      });
      return { cells: [o.name, o.level, S.cityName(o.city)].map(function (x) { return { h: x, cls: 'txt' }; })
        .concat(cells).concat([{ h: '<b>' + passN + '/6</b>', cls: 'num' }, { h: S.fmt(abnTot), cls: 'num' }, { h: U.link('明细', 'pf:orgAll:' + o.id), cls: 'num' }]) };
    });
    var header = ['医疗机构', '级别', '设区市'].concat(cols.map(function (i) { return '#' + i.short; })).concat(['#达标', '#异常病例', '操作']);
    var card = U.card('医院考核 · 六项全览',
      U.note('每格为该机构对应指标的当前值；绿色已达标、红色未达标。') +
      U.table(header, bodyRows, { compact: true }),
      '六项指标 ' + list.length + ' 家机构一屏对照');
    return card;
  }

  /* ==================== 分癌种考核 ==================== */
  /* 单指标：该指标覆盖的每个癌种分别判定达标 */
  function cancerTable() {
    var i = curInd();
    var ofs = effOrgIds();
    var ids = i.cancers.slice();
    var nPass = 0;
    var bodyRows = ids.map(function (cid) {
      var c = S.cancer(cid);
      var a = S.agg(i.id, ofs, [cid]);
      var pass = S.l1Pass(i.id, a.value);
      if (pass) nPass++;
      var abn = S.abnCount(i.id, cid, ofs);
      var on = P.cancer === cid;
      return {
        cells: [
          { h: (on ? '<b>' : '') + S.esc(c.name) + '<span style="color:#94a3b8;font-size:11px"> ' + S.esc(c.icd) + '</span>' + (on ? '</b>' : ''), cls: 'txt' },
          { h: '<b>' + S.f1(a.value) + '%</b>', cls: 'num' },
          { h: '<span style="color:#94a3b8">' + lineOf(i) + '</span>', cls: 'num' },
          { h: badge(pass) },
          { h: S.fmt(a.num), cls: 'num' },
          { h: S.fmt(a.den), cls: 'num' },
          { h: S.fmt(abn), cls: 'num' },
          { h: U.link('明细', 'pf:cancer:' + cid), cls: 'num' }
        ],
        cls: pass ? '' : 'abn-row'
      };
    });
    var tot = S.agg(i.id, ofs, P.cancer ? [P.cancer] : null);
    bodyRows.push({
      cls: 'sum-row',
      cells: [
        { h: '合计（当前筛选）', cls: 'txt' },
        { h: '<b>' + S.f1(tot.value) + '%</b>', cls: 'num' },
        { h: '<span style="color:#94a3b8">' + lineOf(i) + '</span>', cls: 'num' },
        { h: badge(S.l1Pass(i.id, tot.value)) },
        { h: S.fmt(tot.num), cls: 'num' },
        { h: S.fmt(tot.den), cls: 'num' },
        { h: S.fmt(S.abnCount(i.id, P.cancer || null, ofs)), cls: 'num' },
        { h: '', cls: 'num' }
      ]
    });
    var scope = P.org ? ((S.org(P.org) || {}).name || P.org) : (P.city ? S.cityName(P.city) : '全省');
    return U.card('分癌种考核 · ' + i.name,
      U.note('当前范围：' + S.esc(scope) + '。判定口径：达标线 ' + lineOf(i) +
        ' 作用于该指标的<b>合计率</b>（合计达标即该项通过）；下表按癌种拆分，用于定位拉低合计的短板癌种。点行末「明细」把下方病例明细收敛到该癌种。') +
      U.table(['癌种', '#' + i.name, '#达标线', '达标', '#分子', '#分母', '#异常病例', '操作'], bodyRows, { compact: true }),
      '已达标 ' + nPass + ' / ' + ids.length + ' 个癌种');
  }

  /* 六项全览：癌种 × 六项矩阵，空格表示该指标不覆盖 */
  function cancerMatrixAll() {
    var ofs = effOrgIds();
    var bodyRows = S.CANCERS.map(function (c) {
      var n = 0, m = 0;
      var cells = S.L1_IND.map(function (i) {
        if (i.cancers.indexOf(c.id) < 0) {
          return { h: '<span style="color:#cbd5e1">—</span>', cls: 'num', title: '该指标不覆盖' + c.name };
        }
        m++;
        var a = S.agg(i.id, ofs, [c.id]);
        var pass = S.l1Pass(i.id, a.value);
        if (pass) n++;
        return { h: '<span style="font-weight:600;color:' + (pass ? '#2e7d32' : '#b42335') + '">' + S.f1(a.value) + '%</span>', cls: 'num', title: i.name };
      });
      return {
        cells: [{ h: S.esc(c.name), cls: 'txt' }].concat(cells).concat([
          { h: '<b>' + n + '/' + m + '</b>', cls: 'num' },
          { h: U.link('明细', 'pf:cancer:' + c.id), cls: 'num' }
        ])
      };
    });
    var header = ['癌种'].concat(S.L1_IND.map(function (i) { return '#' + i.short; })).concat(['#达标', '操作']);
    return U.card('分癌种考核 · 六项对照',
      U.note('行 = 癌种，列 = 指标；「—」表示该指标不覆盖此癌种。绿 = 已达标、红 = 未达标；六项指标各自适用的癌种范围不同，因此同一癌种只参与其被覆盖的指标判定。') +
      U.table(header, bodyRows, { compact: true }),
      '六大绩效按癌种分别考核');
  }

  /* ==================== 异常明细（原始数据） ==================== */
  function detailNote() {
    var i = curInd();
    /* 字段缺陷聚类 = 异常原因分布（登记报告卡字段口径），并提示其对绩效的影响 */
    var types = S.abnTypes(i.id);
    var rows = types.map(function (t) {
      return { cells: [t.type, { h: S.fmt(t.count), cls: 'num' }] };
    });
    return U.card('异常原因结构 · ' + i.name,
      '<div style="display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:260px">' + U.table(['异常原因', '#病例数'], rows, { compact: true }) + '</div>' +
      '<div style="flex:0 0 260px;font-size:12.5px;color:#475569;line-height:1.8">这些病例多为<b>报告卡字段缺陷</b>导致，直接影响「' + S.esc(i.name) + '」达标。<br>' +
      '<button class="qc-link" data-qc="pf:toReport">前往报卡质量监测（登记条线）→</button></div>' +
      '</div>');
  }

  function detailList() {
    var i = curInd();
    var ofs = effOrgIds();
    var vc = S.verdictCounts(i.id, { orgIds: ofs, cancerIds: cancerFilter() });
    var tabs = [
      ['ALL', '全部', vc.ALL], ['ok', '符合', vc.ok],
      ['bad', '不符合', vc.bad], ['miss', '数据缺失', vc.miss], ['abn', '数据异常', vc.abn]
    ];
    var tabHtml = '<div class="qc-pf-seg" style="margin-bottom:8px">' + tabs.map(function (t) {
      return '<button class="' + (P.verdict === t[0] ? 'on' : '') + '" data-qc="pf:verdict:' + t[0] + '">' + t[1] + '（' + t[2] + '）</button>';
    }).join('') + '</div>';

    var want = P.verdict === 'ALL' ? 'ALL' : P.verdict;
    /* 只构造当前这一页要显示的 20 条完整病例：
       旧写法 limit 给了 100 万，一次渲染要先把 1 万多条病例的证据链
       全构造出来（再在上面对着页签计数又构造一遍），这是本页卡顿的主因。
       条数与页签计数来自同一份病例索引，显示的数字不变。 */
    var data = S.cases(i.id, { orgIds: ofs, cancerIds: cancerFilter(), verdict: want, limit: P.page * 20 });
    var pg = U.slice(data.rows, P.page, 20);
    var rows = pg.rows.map(function (r) {
      var vLabel = S.V_LABEL[r.v] || r.v;
      var vTone = S.V_TONE[r.v] || 'neutral';
      var bad = r.v !== 'ok';
      return {
        cells: [
          { h: '<code>' + S.esc(r.id) + '</code>' },
          S.esc(r.name),
          r.sex + '/' + r.age,
          r.orgName,
          r.cancerName,
          { h: U.badge(vLabel, vTone) },
          { h: bad ? '<span style="color:#b42335">' + S.esc(r.reason || '—') + '</span>' : '—' },
          { h: U.link('证据', 'pf:case:' + i.id + ':' + r.key) },
          { h: bad ? U.link('发起整改', 'pf:fix:' + r.key) : '—' }
        ],
        cls: bad ? 'abn-row' : ''
      };
    });
    var table = U.table(
      ['病例号', '患者', '性别/年龄', '医疗机构', '癌种', '判定', '异常原因', '证据', '操作'],
      rows, { compact: true, empty: '暂无符合筛选的病例' });
    return '<div class="qc-card"><div class="hd"><span class="t">被质控数据明细 · ' + S.esc(i.name) +
      '<span class="sub">共 ' + S.fmt(data.total) + ' 条（抽样）</span></span></div><div class="bd">' +
      tabHtml + table + U.pager(data.total, P.page, 20, 'pf') + '</div></div>';
  }

  /* 病例证据弹窗 */
  function caseModal(indId, key) {
    /* 按键直接定位这一条病例（旧写法是先把该机构该癌种的全部病例
       构造出来再线性比对） */
    var r = S.caseByKey(indId, key);
    if (!r) { U.toast('未找到该病例'); return; }
    var rule = r.rule || S.ruleOf(indId, r.v) || {};
    var kvs = [
      ['病例号', r.id], ['患者', r.name + '（' + r.sex + '/' + r.age + '）'],
      ['就诊机构', r.orgName], ['癌种', r.cancerName],
      ['诊断日期', r.diagDate],
      ['临床分期', r.stageVal || '（空）'], ['病理诊断', r.pathology || '（空）'],
      ['pTNM', r.ptnm || '（空）'], ['淋巴结清扫', r.lymph || '（空）'],
      ['分子检测', r.mol || '（空）'], ['手术日期', r.surgDate || '—'],
      ['死亡日期', r.deathDate || '—']
    ];
    var body = '<div class="qc-kv c3">' + kvs.map(function (kv) {
      return '<div class="kv"><span class="k">' + S.esc(kv[0]) + '</span><span class="v">' + S.esc(kv[1]) + '</span></div>';
    }).join('') + '</div>';
    body += '<div style="margin-top:10px;font-size:12.5px;color:#475569">' +
      '<b>触发规则</b>：' + S.esc((rule.code || '') + ' ' + (rule.name || '')) +
      '<br><b>判定条件</b>：' + S.esc(rule.cond || '') +
      '<br><b>校验字段</b>：' + S.esc(rule.field || '') + '</div>';
    U.modal('被质控数据 · ' + S.esc(r.name), body);
  }

  /* ==================== 主渲染 ==================== */
  function render(pageId) {
    /* 三块内容同页纵向排列，不再用切换栏 */
    var body = (P.ind ? regionSingle() : regionAll()) +
      (P.ind ? orgSingle() : orgAll()) +
      (P.ind ? cancerTable() : cancerMatrixAll()) +
      detailNote() + detailList();

    return '<div class="qc-page">' +
      U.head('六大绩效质控', '国考六项肿瘤专业质控指标的设区市 / 医疗机构考核；六项指标各自适用不同癌种。',
        '', '质控管理',
        '<button class="btn btn-ghost btn-sm" data-qc="pf:toRules">查看判定规则</button>') +
      scopeBar() +
      body +
      '</div>';
  }

  /* ==================== 样式 ==================== */
  var CSS = [
    /* 筛选条改成 flex 单行：五项字段 + 重置/查询必须挤在同一行，禁止换行。
       用 flex-basis 按内容长短分配宽度，比 grid 等分更省空间，也更容易
       在 1400~1600px 之间平滑收缩而不折行。 */
    '#pageContainer .qc-scope{display:flex;flex-wrap:nowrap;align-items:flex-end;gap:10px;overflow-x:auto}',
    '#pageContainer .qc-scope .fg{flex:1 1 0;min-width:0}',
    '#pageContainer .qc-scope .fg.w-year{flex:0 0 92px}',
    '#pageContainer .qc-scope .fg.w-mid{flex:1.15 1 150px}',
    '#pageContainer .qc-scope .fg.w-wide{flex:1.9 1 210px}',
    '#pageContainer .qc-scope .acts{flex:0 0 auto;grid-column:auto;white-space:nowrap}',
    '#pageContainer .qc-scope select{text-overflow:ellipsis}',
    '#pageContainer .qc-pf-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 10px}',
    '#pageContainer .qc-pf-seg{display:inline-flex;border:1px solid #d1d8e0;border-radius:6px;overflow:hidden;margin-bottom:12px}',
    '#pageContainer .qc-pf-seg button{height:32px;padding:0 14px;border:0;background:#fff;font-size:12.5px;font-weight:600;color:#475569;cursor:pointer;font-family:inherit;border-right:1px solid #e6edf5}',
    '#pageContainer .qc-pf-seg button:last-child{border-right:0}',
    '#pageContainer .qc-pf-seg button.on{background:var(--primary);color:#fff}',
    '#pageContainer .qc-pf-seg button.on:hover{background:var(--primary)}',
    '#pageContainer .qc-tbl .abn-row td{background:#fdf3f4}',
    '#pageContainer .qc-tbl .sum-row td{background:#f8fafc;font-weight:600;border-top:2px solid #e2e8f0}',
    '#pageContainer .qc-pf-cancers{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 12px}',
    '#pageContainer .qc-pf-cancers .lb{font-size:12px;color:#64748b;margin-right:2px}',
    '#pageContainer .qc-pf-cancers .chip{height:26px;padding:0 10px;border:1px solid #dbe3ec;border-radius:13px;background:#fff;color:#475569;font-size:12px;cursor:pointer;font-family:inherit;line-height:24px}',
    '#pageContainer .qc-pf-cancers .chip:hover{border-color:var(--primary);color:var(--primary)}',
    '#pageContainer .qc-pf-cancers .chip.on{background:var(--primary);border-color:var(--primary);color:#fff}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ==================== 交互 ==================== */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-qc]') : null;
    if (!el) return;
    var a = el.getAttribute('data-qc');
    if (a.indexOf('pf:') !== 0 && a.indexOf('filter:') !== 0) return;

    /* 筛选条（统一读取）
       year/city/org 走 data-qcf（与其他质控页一致），ind/cancer 走 data-qcp。
       历史遗留：qc-scope 的「质控指标 / 癌种」两个 select 一直没有监听，
       点查询只读 data-qcf，改了指标或癌种会被静默丢弃；现一并读取。 */
    if (a.indexOf('filter:') === 0) {
      if (a.indexOf('reset') > 0) { P.city = ''; P.org = ''; P.cancer = ''; P.year = '2026'; P.ind = ''; }
      else {
        var box = el.closest('.qc-filter');
        var reads = box ? box.querySelectorAll('[data-qcf],[data-qcp]') : [];
        for (var k = 0; k < reads.length; k++) {
          var attr = reads[k].hasAttribute('data-qcf') ? 'data-qcf' : 'data-qcp';
          var kk = reads[k].getAttribute(attr);
          var vv = reads[k].value;
          P[kk] = vv === '' || vv === '全部' || vv === '全部机构' || vv === '全部癌种' ? '' : vv;
        }
      }
      P.page = 1;
      window.renderPage('qc-performance');
      return;
    }

    if (a.indexOf('pf:ind:') === 0) { P.ind = a.slice('pf:ind:'.length) === 'ALL' ? '' : a.slice('pf:ind:'.length); P.page = 1; window.renderPage('qc-performance'); return; }
    if (a.indexOf('pf:verdict:') === 0) { P.verdict = a.slice('pf:verdict:'.length); P.page = 1; window.renderPage('qc-performance'); return; }
    if (a.indexOf('pf:cancer:') === 0) { P.cancer = a.slice('pf:cancer:'.length) === 'ALL' ? '' : a.slice('pf:cancer:'.length); P.page = 1; window.renderPage('qc-performance'); return; }
    if (a.indexOf('pf:page:') === 0) { P.page = parseInt(a.slice('pf:page:'.length), 10) || 1; window.renderPage('qc-performance'); return; }

    /* 行内下钻：设置地区/机构筛选，下方「异常明细」随之收敛 */
    if (a.indexOf('pf:region:') === 0) { P.city = a.slice('pf:region:'.length); P.org = ''; P.page = 1; window.renderPage('qc-performance'); return; }
    if (a.indexOf('pf:detail:') === 0) {
      /* pf:detail:<ind>:<cityCode>:<orgId>（city/org 可空） */
      var parts = a.split(':');
      P.ind = parts[2] || ''; P.city = parts[3] || ''; P.org = parts[4] || '';
      P.verdict = 'ALL'; P.page = 1;
      window.renderPage('qc-performance'); return;
    }
    if (a.indexOf('pf:detailAll:') === 0) { P.city = a.slice('pf:detailAll:'.length); P.org = ''; P.verdict = 'ALL'; P.page = 1; window.renderPage('qc-performance'); return; }
    if (a.indexOf('pf:orgAll:') === 0) { P.org = a.slice('pf:orgAll:'.length); P.verdict = 'ALL'; P.page = 1; window.renderPage('qc-performance'); return; }

    if (a.indexOf('pf:case:') === 0) {
      var p = a.split(':');
      caseModal(p[2], p.slice(3).join(':'));
      return;
    }
    if (a.indexOf('pf:fix:') === 0) { U.toast('已将问题纳入整改清单，前往「整改问题」处理'); return; }

    if (a === 'pf:toRules') { window.navigateTo('qc-rules'); return; }
    if (a === 'pf:toReport') { window.navigateTo('analysis-quality'); return; }
  });

  window.qcPerformance = {
    pageIds: ['qc-performance'],
    render: render,
    state: P
  };
})();