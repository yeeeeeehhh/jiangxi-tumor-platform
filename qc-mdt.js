/* ============================================================================
 * qc-mdt.js — MDT 多学科诊疗质控 · 渲染层（2026-10-26 精简）
 *
 * 定位：MDT 只有**一个页面**（侧栏一个三级菜单项），两个指标同屏：
 *       「MDT 讨论率」+「MDT 结论执行率」。国家层面对肿瘤 MDT 只有一个
 *       可对标的量化要求（III 期及以上肿瘤初诊 MDT 率 >50%，见
 *       《江西省癌症防治专项行动方案（2025—2027年）》第六条），
 *       尚未发布肿瘤 MDT 专项质控指标体系，因此不值得拆成两个导航入口 ——
 *       一页两指标，一屏看完「开没开」和「开得有没有用」。
 *
 * 前身（2026-10-21 版）的四个菜单页全部撤销：
 *   · MDT 质控总览     → 本页
 *   · 应讨论未讨论     → 本页明细「数据缺失」判定页签
 *   · 记录与执行质量   → 本页第二个指标
 *   · 入组规则配置     → 并入「质控规则配置」qc-mdt-r 分组
 *   qc-mdt-detail 从「无入口死页」改为有入口的隐藏页。
 *
 * 页面：
 *   qc-mdt        MDT 质控（唯一菜单页，两指标同屏）
 *   qc-mdt-detail 被质控数据（隐藏页：按指标 + 判定筛选）
 *   qc-mdt-case   病例质控详情（隐藏页）
 *
 * 页面结构（沿用六大绩效的筛选条 / 下钻 / 隐藏页范式）：
 *   [页头] MDT 质控 + 查看判定规则
 *   [KPI 带] 讨论率 / 结论执行率 / 结论明确率（前置）/ 应讨论未讨论 / 统计期
 *   [筛选条] 统计年度 / 所属地区（五级级联）/ 医疗机构 / 癌种 + 重置 / 查询
 *   [下钻指示条] 当前范围 + 返回上一级 + 回到全省 + 被质控数据明细入口
 *   [指标切换] 讨论率 / 结论执行率（决定下表与下钻的列，不切页面）
 *   [自动下钻表] 全省→行设区市×列癌种；市→行机构×列癌种；机构→行癌种
 *   [被质控数据] 判定页签 + 病例表 + 分页
 *   [病例详情] 基础信息 / 入组判定 / 诊疗过程 / 质控判定 / MDT 记录
 *
 * 取数：一律 window.qcMdt，渲染层不造数字。
 * 暴露：window.qcMdtPage = { pageIds, render, state, crumb }
 * ========================================================================== */
(function () {
  'use strict';

  var S = window.qcSpine;
  var U = window.qcUI;
  var M = window.qcMdt;

  var P = {
    year: '2026',
    /* 当前展示哪个指标：MDT-01 讨论率 / MDT-02 结论执行率。
       这是页内切换，不是页面切换（两个指标共用一个导航入口）。 */
    ind: 'MDT-01',
    city: '', county: '', street: '', community: '',
    org: '', cancer: '',
    /* 被质控数据（隐藏页 qc-mdt-detail）的交叉条件：可同时带 city/org/cancer。
       null = 沿用顶部筛选条范围。 */
    scope: null, verdict: 'ALL', page: 1,
    /* 病例质控详情（隐藏页 qc-mdt-case） */
    caseKey: ''
  };

  /* pageId → 指标。MDT 只有一个菜单页（qc-mdt），detail/case 是隐藏页。
     旧链接（qc-mdt-overview / qc-mdt-missing / qc-mdt-quality / qc-mdt-rules
     / qc-mdt-ind01 / qc-mdt-ind02）全部兜底到唯一菜单页。 */
  var PAGEMAP = {
    'qc-mdt-overview': 'MDT-01',
    'qc-mdt-missing': 'MDT-01',
    'qc-mdt-quality': 'MDT-02',
    'qc-mdt-rules': 'MDT-01',
    'qc-mdt-ind01': 'MDT-01',
    'qc-mdt-ind02': 'MDT-02'
  };
  var PAGE_IDS = ['qc-mdt', 'qc-mdt-detail', 'qc-mdt-case'];

  function curInd() { return M.indOf(P.ind) || M.IND[0]; }
  function pageOf() { return 'qc-mdt'; }
  /* 当前指标对应的质控点（MDT-02 的前置判定是 P2，详情页要能看到） */
  function curPoint() { return M.pointOf(curInd().id); }

  /* 重绘当前页：必须走 qcRender（只重绘质控容器）。
     不能走 window.renderPage —— 那是全量页面渲染，跨模块会互相抢页
     （历史问题：六大绩效页点「查询」被重绘成 MDT 页）。 */
  function rerender(id) {
    if (window.qcRender) { window.qcRender(id || pageOf()); return; }
    window.renderPage(pageOf());
  }

  /* ==================== 筛选条 ==================== */
  var AXIS_LABEL = { city: '设区市', org: '医疗机构', cancer: '癌种' };

  function cancerOptions() {
    /* MDT 只覆盖有入组规则的癌种（其余癌种命中率极低，列表里不出现） */
    var has = {};
    M.pool().forEach(function (r) { has[r.cancer] = 1; });
    var ids = S.CANCERS.filter(function (c) { return has[c.id]; }).map(function (c) { return c.id; });
    if (P.cancer && ids.indexOf(P.cancer) < 0) ids.push(P.cancer);
    return [{ v: '', l: '全部癌种' }].concat(ids.map(function (c) {
      return { v: c, l: S.cancer(c).name };
    }));
  }
  function orgOptions() {
    return S.ORGS.filter(function (o) {
      if (P.city && o.city !== P.city) return false;
      if (P.county && o.county !== P.county) return false;
      return true;
    }).map(function (o) { return { v: o.id, l: o.name }; });
  }
  function optHtml(list, cur) {
    return list.map(function (o) {
      return '<option value="' + S.esc(o.v) + '"' + (String(cur) === String(o.v) ? ' selected' : '') + '>' + S.esc(o.l) + '</option>';
    }).join('');
  }

  /* 顶部筛选条：统计年度 / 所属地区（五级级联）/ 医疗机构 / 癌种 + 重置 / 查询。
     与六大绩效同一套控件与交互：选完点「查询」生效（MDT 数据量大，显式确认
     比每次 change 全量重算更稳）。 */
  function scopeBar() {
    var yearOpts = ['2026', '2025', '2024'].map(function (y) { return { v: y, l: y }; });
    var path = [];
    if (P.city) path.push(S.cityName(P.city));
    if (P.county) path.push(P.county);
    if (P.street) path.push(P.street);
    if (P.community) path.push(P.community);
    function sel(key, label, list, cur) {
      return '<div class="fg w-mid"><label>' + S.esc(label) + '</label>' +
        '<select data-qcmdt="' + S.esc(key) + '">' + optHtml(list, cur) + '</select></div>';
    }
    return '<div class="qc-filter qc-scope" data-qcmdtfilter="1">' +
      '<div class="fg w-year"><label>统计年度</label>' +
      '<select data-qcmdt="year">' + optHtml(yearOpts, P.year) + '</select></div>' +
      '<div class="fg w-mid"><label>所属地区</label>' + U.cascader('mdt-region', path, '全部地区') + '</div>' +
      sel('org', '医疗机构', [{ v: '', l: '全部机构' }].concat(orgOptions()), P.org) +
      sel('cancer', '癌种', cancerOptions(), P.cancer) +
      '<div class="acts">' +
      '<button class="btn btn-ghost btn-sm" data-qc="filter:reset:mdt">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-qc="filter:apply:mdt">查询</button>' +
      '</div>' +
      '</div>';
  }

  /* ==================== 范围口径 ==================== */
  function effOrgIds() {
    if (P.org) return [P.org];
    if (P.city) {
      var ids = S.ORGS.filter(function (o) {
        return o.city === P.city && (!P.county || o.county === P.county);
      }).map(function (o) { return o.id; });
      return ids.length ? ids : ['__none__'];
    }
    return null;
  }
  function cancerFilter() { return P.cancer ? [P.cancer] : null; }
  function scopeName() {
    if (P.org) return (S.org(P.org) || {}).name || P.org;
    if (P.city && P.county) return S.cityName(P.city) + ' · ' + P.county;
    if (P.city) return S.cityName(P.city);
    return '全省';
  }
  /* 明细页口径：P.scope 覆盖顶部筛选条（交叉下钻带的条件） */
  function dScope() { return P.scope || {}; }
  function dOrgIds() {
    var sc = dScope();
    if (sc.org) return [sc.org];
    if (sc.city) {
      var ids = S.ORGS.filter(function (o) {
        return o.city === sc.city && (!sc.county || o.county === sc.county);
      }).map(function (o) { return o.id; });
      return ids.length ? ids : ['__none__'];
    }
    return effOrgIds();
  }
  function dCancerIds() {
    var sc = dScope();
    return sc.cancer ? [sc.cancer] : cancerFilter();
  }
  function dLabel() {
    var sc = dScope(), parts = [];
    if (sc.org) parts.push((S.org(sc.org) || {}).name || sc.org);
    else if (sc.city) parts.push(sc.county ? S.cityName(sc.city) + ' · ' + sc.county : S.cityName(sc.city));
    if (sc.cancer) parts.push(S.cancer(sc.cancer).name);
    return parts.length ? parts.join(' · ') : scopeName();
  }

  /* ==================== 自动下钻 ==================== */
  /* 表格形态完全由筛选条决定（与六大绩效同一套逻辑）：
       全省          → 行=设区市，列=癌种
       设区市/区县   → 行=该范围机构，列=癌种
       再选定机构    → 行=该机构各癌种（单维）
       锁定癌种      → 列塌掉，退化为单维表 */
  function autoAxis() {
    var cancerLocked = !!P.cancer;
    if (P.org) return { row: 'cancer', col: 'none' };
    if (P.city) return { row: 'org', col: cancerLocked ? 'none' : 'cancer' };
    return { row: 'city', col: cancerLocked ? 'none' : 'cancer' };
  }
  function buildAxis(dim) {
    var i = curInd();
    if (dim === 'city') {
      var cs = S.CITIES;
      if (P.city) cs = cs.filter(function (c) { return c.code === P.city; });
      return cs.map(function (c) {
        return { key: c.code, label: c.name, scope: { city: c.code },
          orgIds: S.ORGS.filter(function (o) { return o.city === c.code; }).map(function (o) { return o.id; }) };
      });
    }
    if (dim === 'org') {
      var os = S.ORGS.filter(function (o) {
        if (P.city && o.city !== P.city) return false;
        if (P.county && o.county !== P.county) return false;
        return true;
      });
      if (P.org) os = os.filter(function (o) { return o.id === P.org; });
      return os.map(function (o) {
        return { key: o.id, label: o.name, sub: o.county || o.level,
          scope: { org: o.id, city: o.city, county: o.county }, orgIds: [o.id] };
      });
    }
    /* 癌种轴只列真正有 MDT 数据的癌种 */
    var has = {};
    M.pool().forEach(function (r) { has[r.cancer] = 1; });
    var ids = S.CANCERS.filter(function (c) { return has[c.id]; }).map(function (c) { return c.id; });
    if (P.cancer) ids = ids.filter(function (x) { return x === P.cancer; });
    return ids.map(function (cid) {
      var c = S.cancer(cid);
      return { key: cid, label: c.name, sub: c.icd, scope: { cancer: cid }, cancerIds: [cid] };
    });
  }

  /* 求交：两个轴单元 + 顶部范围。交集为空返回 ['__none__']（空数组=不限，最易错） */
  function both(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    var out = a.filter(function (x) { return b.indexOf(x) >= 0; });
    return out.length ? out : ['__none__'];
  }
  function crossAgg(r, c) {
    return M.indAgg(curInd().id,
      both(both(r && r.orgIds, c && c.orgIds), effOrgIds()),
      both(both(r && r.cancerIds, c && c.cancerIds), cancerFilter()));
  }

  /* ==================== 表格 ==================== */
  function valHtml(a, bold) {
    if (!a || !a.den) return '<span style="color:#cbd5e1">—</span>';
    return '<span style="font-weight:' + (bold ? '700' : '600') + ';color:' +
      (a.pass ? '#2e7d32' : '#b42335') + ';font-variant-numeric:tabular-nums">' +
      S.f1(a.value) + '%</span>';
  }
  function actLink(text, action) { return { h: U.link(text, action), cls: 'num act' }; }

  /* 交叉矩阵：行 × 列，单元格同时受两轴约束，可点开被质控数据 */
  function matrixTable(ax) {
    var i = curInd();
    var rows = buildAxis(ax.row), cols = buildAxis(ax.col);
    var head = [AXIS_LABEL[ax.row]]
      .concat(cols.map(function (c) { return '#' + c.label; }))
      .concat(['#合计', '操作']);
    var body = rows.map(function (r) {
      var cells = [{ h: rowHead(r), cls: 'txt' }];
      cols.forEach(function (cc) {
        cells.push({ h: crossCellBtn(crossAgg(r, cc), r, cc), cls: 'num' });
      });
      cells.push({ h: valHtml(M.indAgg(i.id, both(r.orgIds, effOrgIds()), cancerFilter()), true), cls: 'num' });
      cells.push(actLink('被质控数据', 'mdt:x:' + encScope(r.scope)));
      return { cells: cells };
    });
    var tCells = [{ h: '合计', cls: 'txt' }];
    cols.forEach(function (cc) {
      tCells.push({ h: valHtml(M.indAgg(i.id, both(cc.orgIds, effOrgIds()), both(cc.cancerIds, cancerFilter())), true), cls: 'num' });
    });
    tCells.push({ h: valHtml(M.indAgg(i.id, effOrgIds(), cancerFilter()), true), cls: 'num' });
    tCells.push({ h: '', cls: 'num act' });
    body.push({ cls: 'sum-row', cells: tCells });

    return U.card('',
      U.note('范围：' + S.esc(scopeName()) + '。行 = ' + AXIS_LABEL[ax.row] + '，列 = ' + AXIS_LABEL[ax.col] +
        '；每格为该行该列<b>交叉条件</b>下的指标值，绿=达标、红=未达标、「—」=该癌种无应讨论病例。' +
        '格子可点，进入的被质控数据<b>同时带行、列两个条件</b>。') +
      U.table(head, body, { compact: true, fit: true }));
  }
  function crossCellBtn(a, r, c) {
    if (!a || !a.den) return '<span style="color:#cbd5e1">—</span>';
    var col = a.pass ? '#2e7d32' : '#b42335';
    return '<button class="qc-link" style="color:' + col + ';font-variant-numeric:tabular-nums" ' +
      'data-qc="mdt:x:' + encScope(mergeScope(r.scope, c.scope)) + '" ' +
      'title="查看该行列交叉下的被质控数据">' + S.f1(a.value) + '%</button>';
  }
  function rowHead(r) {
    var html = S.esc(r.label);
    if (r.sub) html += '<span style="color:#94a3b8;font-size:11px"> ' + S.esc(r.sub) + '</span>';
    return html;
  }

  /* 单维表（机构锁定 / 癌种锁定时）：列随指标裁剪 */
  function singleTable(ax) {
    var i = curInd();
    var rows = buildAxis(ax.row);
    var ofs = effOrgIds();
    var bodyRows = rows.map(function (r) {
      var a = M.indAgg(i.id, both(r.orgIds, ofs), both(r.cancerIds, cancerFilter()));
      var yoy = M.yoy(i.id, both(r.orgIds, ofs), both(r.cancerIds, cancerFilter()));
      var miss = missCount(both(r.orgIds, ofs), both(r.cancerIds, cancerFilter()));
      return {
        cells: [
          { h: rowHead(r), cls: 'txt' },
          { h: '<b>' + S.f1(a.value) + '%</b>', cls: 'num' },
          { h: a.pass ? '<span class="badge badge-success">达标</span>' : '<span class="badge badge-danger">未达标</span>', cls: 'center' },
          { h: S.fmt(a.num), cls: 'num' },
          { h: S.fmt(a.den), cls: 'num' },
          { h: miss > 0 ? '<span style="color:#b42335;font-weight:600">' + S.fmt(miss) + '</span>' : '0', cls: 'num' },
          { h: (yoy == null ? '—' : (yoy >= 0 ? '+' : '') + yoy + '%'), cls: 'num' },
          actLink('被质控数据', 'mdt:x:' + encScope(r.scope))
        ],
        cls: a.pass ? '' : 'abn-row'
      };
    });
    var tot = M.indAgg(i.id, ofs, cancerFilter());
    bodyRows.push({
      cls: 'sum-row',
      cells: [
        { h: P.org ? (S.org(P.org) || {}).name + ' 合计' : '合计（当前筛选）', cls: 'txt' },
        { h: '<b>' + S.f1(tot.value) + '%</b>', cls: 'num' },
        { h: tot.pass ? '<span class="badge badge-success">达标</span>' : '<span class="badge badge-danger">未达标</span>', cls: 'center' },
        { h: S.fmt(tot.num), cls: 'num' },
        { h: S.fmt(tot.den), cls: 'num' },
        { h: S.fmt(missCount(ofs, cancerFilter())), cls: 'num' },
        { h: '—', cls: 'num' },
        { h: '', cls: 'num act' }
      ]
    });
    return U.card('',
      U.note('当前范围：' + S.esc(scopeName()) + '。下表按' + AXIS_LABEL[ax.row] +
        '拆分，用于定位拉低合计的短板；「#应讨论未讨论」即命中入组规则但无有效讨论记录的病例数。') +
      U.table([AXIS_LABEL[ax.row], '#' + i.name, '达标', '#分子', '#分母', '#应讨论未讨论', '#同比', '操作'],
        bodyRows, { compact: true, fit: true }));
  }

  /* 该范围内「应讨论未讨论」病例数（P1 判定为数据缺失） */
  function missCount(orgIds, cancerIds) {
    var vc = M.verdictCounts({ point: 'P1', orgIds: orgIds, cancerIds: cancerIds });
    return vc.miss || 0;
  }

  /* ==================== 下钻指示条 ==================== */
  function drillBar() {
    var trail = '<span class="qc-pf-trail"><span class="lb">当前范围</span><span class="lv on">全省</span>';
    if (P.city) trail += '<span class="sep">▸</span><span class="lv on">' + S.esc(S.cityName(P.city)) + '</span>';
    if (P.county) trail += '<span class="sep">▸</span><span class="lv on">' + S.esc(P.county) + '</span>';
    if (P.street) trail += '<span class="sep">▸</span><span class="lv">' + S.esc(P.street) + '</span>';
    if (P.community) trail += '<span class="sep">▸</span><span class="lv">' + S.esc(P.community) + '</span>';
    if (P.org) trail += '<span class="sep">▸</span><span class="lv on">' + S.esc((S.org(P.org) || {}).name || P.org) + '</span>';
    if (P.cancer) trail += '<span class="sep">▸</span><span class="lv on">' + S.esc(S.cancer(P.cancer).name) + '</span>';
    trail += '</span>';
    var hint = (P.street || P.community)
      ? '<span class="qc-pf-hint">已选到' + (P.community ? '社区' : '街道') +
        '，MDT 数据仅到机构层级，按所属' + (P.county ? P.county : '设区市') + '统计</span>'
      : '';
    var back = (P.org || P.county || P.street || P.city || P.cancer)
      ? '<button class="btn btn-ghost btn-sm" data-qc="mdt:upOne">← 返回上一级</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="filter:reset:mdt2">回到全省</button>'
      : '';
    return '<div class="qc-pf-dimbar">' + trail + hint +
      '<span class="qc-pf-db-acts">' + back +
      '<button class="btn btn-ghost btn-sm" data-qc="mdt:detailOpen">被质控数据明细</button></span>' +
      '</div>';
  }

  /* ==================== 被质控数据（隐藏页） ==================== */
  function encScope(sc) {
    var parts = [];
    for (var k in (sc || {})) if (sc[k]) parts.push(k + '=' + sc[k]);
    return parts.join(';');
  }
  function mergeScope(a, b) {
    var o = {};
    for (var k in (a || {})) if (a[k]) o[k] = a[k];
    for (var k2 in (b || {})) if (b[k2]) o[k2] = b[k2];
    return o;
  }
  function parseScope(s) {
    var o = {};
    String(s == null ? '' : s).split(';').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      if (p[0] && p[1]) o[p[0]] = p[1];
    });
    return o;
  }

  function renderDetailPage() {
    var i = curInd();
    var ofs = dOrgIds(), cfs = dCancerIds();
    var vc = M.verdictCounts({ point: curPoint(), orgIds: ofs, cancerIds: cfs });
    var tabs = [
      ['ALL', '全部数据', vc.ALL], ['ok', '符合', vc.ok], ['bad', '不符合', vc.bad],
      ['miss', '数据缺失', vc.miss], ['abn', '数据异常', vc.abn]
    ];
    var tabHtml = '<div class="qc-tabs">' + tabs.map(function (t) {
      return '<button class="' + (P.verdict === t[0] ? 'on' : '') + '" data-qc="mdt:verdict:' + t[0] + '">' +
        t[1] + '（' + S.fmt(t[2] || 0) + '）</button>';
    }).join('') + '</div>';

    /* 分页以数据层完整 total 为准，offset 取当前页窗口 */
    var totalInView = (P.verdict === 'ALL' ? vc.ALL : vc[P.verdict]) || 0;
    var maxP = Math.max(1, Math.ceil(totalInView / 20));
    if (P.page > maxP) P.page = maxP;
    if (P.page < 1) P.page = 1;
    var data = M.cases({ point: curPoint(), verdict: P.verdict, orgIds: ofs, cancerIds: cfs, limit: 20, offset: (P.page - 1) * 20 });
    var rows = data.rows.map(function (r) {
      var bad = r.v !== 'ok';
      return {
        cls: bad ? 'abn-row' : '',
        cells: [
          { h: U.link(r.name + '（' + S.esc(r.id) + '）', 'mdt:case:' + r.key), cls: 'txt' },
          { h: S.esc(r.orgName), cls: 'txt' },
          { h: S.esc(r.cancerName), cls: 'txt' },
          { h: S.esc(r.stage), cls: 'num' },
          { h: S.esc(r.enteredRules.join('、') || '—'), cls: 'txt' },
          { h: U.verdictBadge(r.v), cls: 'center' },
          { h: bad ? '<span style="color:#b42335">' + S.esc(r.reason || '—') + '</span>' : '—', cls: 'txt' },
          { h: bad ? U.link('纳入整改', 'mdt:fix:' + r.key) : '—', cls: 'num act' }
        ]
      };
    });

    return '<div class="qc-page">' +
      U.head('被质控数据明细',
        i.name + ' · ' + dLabel() + '，共 ' + S.fmt(data.total) + ' 条（抽样）', '', false,
        '<button class="btn btn-ghost btn-sm" data-qc="mdt:back">← 返回 MDT 质控</button>') +
      detailScopeBar() +
      U.card('',
        tabHtml + '<div style="height:10px"></div>' +
        U.table(['患者', '医疗机构', '癌种', '分期', '入组条件', '质控结果', '问题原因', '操作'], rows,
          { compact: true, fit: true, empty: '该交叉条件下暂无被质控数据' }) +
        U.pager(data.total, P.page, 20, 'mdt')) +
      '</div>';
  }

  /* 明细页条件条：可在页内改地区/机构/癌种（保持交叉口径），独立于顶部筛选条 */
  function detailScopeBar() {
    var sc = dScope();
    var orgOpts = [{ v: '', l: '全部机构' }].concat(
      S.ORGS.filter(function (o) {
        if (sc.city && o.city !== sc.city) return false;
        if (sc.county && o.county !== sc.county) return false;
        return true;
      }).map(function (o) { return { v: o.id, l: o.name }; })
    );
    var canOpts = cancerOptions();
    var path = [];
    if (sc.city) {
      for (var ci = 0; ci < S.CITIES.length; ci++) if (S.CITIES[ci].code === sc.city) path.push(S.CITIES[ci].name);
    }
    if (sc.county) path.push(sc.county);
    function sel(key, label, list, cur) {
      return '<div class="fg w-mid"><label>' + S.esc(label) + '</label>' +
        '<select data-qcmdt-scope="' + S.esc(key) + '">' + optHtml(list, cur) + '</select></div>';
    }
    return '<div class="qc-filter qc-scope" data-qcmdtscope="1">' +
      '<div class="fg w-mid"><label>所属地区</label>' +
      U.cascader('mdt-detail-region', path, '全部地区') + '</div>' +
      sel('org', '医疗机构', orgOpts, sc.org || '') +
      sel('cancer', '癌种', canOpts, sc.cancer || '') +
      '<div class="acts">' +
      '<button class="btn btn-ghost btn-sm" data-qc="mdt:scope:reset">重置条件</button>' +
      '<button class="btn btn-primary btn-sm" data-qc="mdt:scope:apply">应用</button>' +
      '</div>' +
      '</div>';
  }
  /* 读取明细页条件条（保留级联已写的地区条件） */
  function readDetailScope() {
    var box = document.querySelector('[data-qcmdtscope]');
    if (!box) return;
    var sc = {};
    if (P.scope) {
      ['city', 'county', 'street', 'community'].forEach(function (k) {
        if (P.scope[k]) sc[k] = P.scope[k];
      });
    }
    var sels = box.querySelectorAll('[data-qcmdt-scope]');
    for (var k = 0; k < sels.length; k++) {
      var key = sels[k].getAttribute('data-qcmdt-scope');
      var val = sels[k].value;
      if (val) sc[key] = val;
    }
    if (sc.org) {
      var o = S.org(sc.org);
      if (!o || (sc.city && o.city !== sc.city) || (sc.county && o.county !== sc.county)) delete sc.org;
    }
    P.scope = Object.keys(sc).length ? sc : null;
    P.page = 1;
  }

  /* ==================== 病例质控详情（隐藏页） ==================== */
  function renderCasePage() {
    var i = curInd();
    var r = M.byKey(P.caseKey);
    if (!r) {
      return '<div class="qc-page">' +
        U.head('MDT 病例质控详情', '病例级证据', '', false,
          '<button class="btn btn-ghost btn-sm" data-qc="mdt:backList">← 返回被质控数据</button>') +
        U.card('未找到病例', '<div class="qc-empty">请从「被质控数据明细」点击患者进入。</div>') + '</div>';
    }

    var baseCard = U.card('基础信息', U.kv([
      ['病例号', S.esc(r.id)], ['姓名', S.esc(r.name)],
      ['性别', r.sex], ['年龄', r.age + ' 岁'],
      ['医疗机构', S.esc(r.orgName)], ['癌种', S.esc(r.cancerName)],
      ['临床分期', S.esc(r.stage)], ['诊断日期', r.diagDate]
    ], 2));

    /* 入组判定：为什么这条病例该做 MDT */
    var ruleHit = r.enteredRules.length
      ? r.enteredRules.map(function (n, idx) {
        var def = M.ENTER_RULES.filter(function (x) { return x.id === r.enteredRuleIds[idx]; })[0] || {};
        return '<div style="padding:5px 0;border-bottom:1px dashed #eef2f7">' +
          '<b>' + S.esc(n) + '</b>' +
          (def.cond ? '<div style="font-size:12px;color:#475569;margin-top:2px">' + S.esc(def.cond) + '</div>' : '') +
          '</div>';
      }).join('')
      : '<div style="color:#94a3b8;padding:4px 0">未命中入组条件</div>';
    var entryCard = U.card('入组判定', ruleHit, r.enteredRules.length ? '命中 ' + r.enteredRules.length + ' 项' : '未命中');

    /* 诊疗过程时间轴 */
    var tl = [
      { title: '明确诊断', date: r.diagDate, desc: S.esc(r.cancerName) + ' · 分期 ' + S.esc(r.stage), state: 'ok' }
    ];
    if (r.hasRecord) {
      tl.push({ title: 'MDT 申请', date: r.applyDate, desc: S.esc(r.applyDept) + '：' + S.esc(r.applyReason || '—'), state: 'ok' });
      tl.push({
        title: 'MDT 讨论', date: r.sessionDate,
        desc: S.esc(r.host || '—') + '；参会：' + S.esc(r.attendDepts.join('、')) +
          (r.hasSummary ? '' : '<span style="color:#d98b2b">（缺主持人小结）</span>'),
        state: r.hasSummary ? 'ok' : 'miss'
      });
      tl.push({
        title: '形成结论', date: r.sessionDate,
        desc: r.conclusion ? S.esc(r.conclusion) : '<span style="color:#d98b2b">未填写结论</span>',
        state: !r.conclusion ? 'miss' : r.vague ? 'bad' : 'ok'
      });
    } else {
      tl.push({ title: 'MDT 讨论', date: '—', desc: '<span style="color:#b42335">无讨论记录</span>', state: 'miss' });
    }
    if (r.treated) {
      tl.push({
        title: '实际治疗', date: r.treatDate,
        desc: S.esc(r.actualTreat) + (r.execMismatch ? (r.hasChangeNote ? '（与结论不一致，已附变更说明）' : '（与结论不一致）') : ''),
        state: r.execMismatch ? 'bad' : 'ok'
      });
    }
    var tlCard = U.card('诊疗过程', U.timeline(tl));

    /* 质控判定：三项判定 + 适用性（不适用 = 前置条件未满足，不是漏判） */
    var pointRows = M.POINTS.map(function (pt) {
      var res = r.judge[pt.key];
      var applies = true;
      if (pt.id === 'P1' && !r.enteredRuleHit) applies = false;
      if (pt.id === 'P2' && r.judge.entered.v !== 'ok') applies = false;
      if (pt.id === 'P3' && (r.judge.entered.v !== 'ok' || r.judge.conclusion.v !== 'ok' || !r.treated)) applies = false;
      var isInd = (M.pointOf(i.id) === pt.id);
      return {
        cls: applies && res.v !== 'ok' ? 'abn-row' : '',
        cells: [
          { h: S.esc(pt.metric) + (isInd ? ' <span class="badge badge-info">当前指标</span>' : ''), cls: 'txt' },
          { h: S.esc(pt.rule.cond), cls: 'txt' },
          { h: applies ? U.verdictBadge(res.v) : '<span style="color:#cbd5e1;font-size:12px">不适用</span>', cls: 'center' },
          { h: applies && res.reason ? '<span style="color:#b42335">' + S.esc(res.reason) + '</span>' : '—', cls: 'txt' }
        ]
      };
    });
    var judgeCard = U.card('质控判定',
      U.note('三项判定的适用条件是逐层递进的：P1 只评价命中入组规则的病例，P2 只评价已完成有效讨论的病例，P3 只评价结论明确且已到治疗阶段的病例。') +
      '<div style="height:10px"></div>' +
      U.table(['指标', '判定条件', '结果', '问题原因'], pointRows, { compact: true, fit: true }));

    /* MDT 记录字段表 */
    var recRows = [
      ['MDT 编号', r.mdtNo || '（无）', 'MDT 会诊'],
      ['申请科室', r.applyDept || '（无）', 'MDT 会诊'],
      ['申请理由', r.applyReason || '（无）', 'MDT 会诊'],
      ['主持人', r.host || '（无）', 'MDT 会诊'],
      ['参会科室', r.attendDepts.length ? r.attendDepts.join('、') : '（无）', 'MDT 会诊'],
      ['主持人小结', r.hasSummary ? r.summary : '（缺失）', 'MDT 会诊'],
      ['MDT 结论', r.conclusion || '（无）', 'MDT 会诊'],
      ['实际治疗', r.actualTreat || '（未到治疗阶段）', '病案首页'],
      ['变更说明', r.changeNote || '（无）', '病程记录']
    ].map(function (x) {
      var empty = /（无）|（缺失）/.test(String(x[1]));
      return { cells: [x[0], { h: empty ? '<span style="color:#b42335">' + S.esc(x[1]) + '</span>' : S.esc(x[1]) }, x[2]] };
    });
    var recCard = U.card('MDT 记录',
      U.table(['数据项', '数据值', '数据来源'], recRows, { compact: true, fit: true }));

    return '<div class="qc-page">' +
      U.head('MDT 病例质控详情',
        S.esc(r.name) + ' · ' + S.esc(r.orgName) + ' · ' + S.esc(r.cancerName) + ' · ' + S.esc(r.stage), '', false,
        '<button class="btn btn-ghost btn-sm" data-qc="mdt:backList">← 返回被质控数据</button>' +
        (r.v !== 'ok' ? '<button class="btn btn-primary btn-sm" data-qc="mdt:fix:' + S.esc(r.key) + '">纳入整改</button>' : '')) +
      baseCard + entryCard + tlCard + judgeCard + recCard +
      '</div>';
  }

  /* ==================== 主渲染 ==================== */
  function render(pageId) {
    if (pageId && PAGEMAP[pageId]) P.ind = PAGEMAP[pageId];
    if (!P.ind) P.ind = 'MDT-01';
    /* 报告期绑定：年度筛选真正进入数据层（分子分母、病例日期随年度变化） */
    if (M.setPeriod) M.setPeriod(P.year || '2026');
    U.closeModal();

    if (pageId === 'qc-mdt-detail') return renderDetailPage();
    if (pageId === 'qc-mdt-case') return renderCasePage();

    var i = curInd();
    var ofs = effOrgIds(), cfs = cancerFilter();

    /* KPI 带：两个对外指标 + 前置判定 + 应讨论未讨论 + 统计期。
       一页同屏给全「开没开 / 结论靠不靠得住 / 执行了没」。 */
    var d1 = M.indAgg('MDT-01', ofs, cfs);
    var d2 = M.indAgg('MDT-02', ofs, cfs);
    var p2 = M.metrics({ orgIds: ofs, cancerIds: cfs }).P2;
    var miss = missCount(ofs, cfs);
    var kpi = U.kpis([
      { l: 'MDT 讨论率', v: d1.value == null ? '—' : S.f1(d1.value), unit: '%',
        tone: d1.pass ? 'up' : 'bad',
        m: '分子 <b>' + S.fmt(d1.num) + '</b> / 分母 <b>' + S.fmt(d1.den) + '</b>（应讨论病例）',
        action: 'mdt:ind:MDT-01' },
      { l: 'MDT 结论明确率', v: p2.value == null ? '—' : S.f1(p2.value), unit: '%',
        tone: (p2.value == null || p2.value >= 90) ? 'up' : 'warn',
        m: '结论落到具体治疗方案 <b>' + S.fmt(p2.num) + '</b> / 已讨论 <b>' + S.fmt(p2.den) + '</b>',
        action: 'mdt:ind:MDT-02' },
      { l: 'MDT 结论执行率', v: d2.value == null ? '—' : S.f1(d2.value), unit: '%',
        tone: d2.pass ? 'up' : 'bad',
        m: '治疗符合结论 <b>' + S.fmt(d2.num) + '</b> / 已讨论且已治疗 <b>' + S.fmt(d2.den) + '</b>',
        action: 'mdt:ind:MDT-02' },
      { l: '应讨论未讨论', v: S.fmt(miss), unit: '例', tone: miss > 0 ? 'bad' : 'info',
        m: '命中入组规则但无有效讨论记录', action: 'mdt:toMiss' },
      { l: '统计期', v: P.year, unit: '年度', tone: 'info', m: '报告期内病例' }
    ], 5);

    var ax = autoAxis();
    var table = ax.col === 'none' ? singleTable(ax) : matrixTable(ax);

    return '<div class="qc-page">' +
      U.head('MDT 多学科诊疗质控', '', '', false,
        '<button class="btn btn-ghost btn-sm" data-qc="mdt:toRules">查看判定规则</button>') +
      kpi +
      scopeBar() +
      drillBar() +
      indSeg() +
      table +
      '</div>';
  }

  /* 指标切换：只切「下表 + 下钻按哪个指标算」，不切页面、不清筛选条件 */
  function indSeg() {
    return '<div class="qc-seg" style="margin-bottom:12px">' + M.IND.map(function (x) {
      return '<button class="' + (curInd().id === x.id ? 'on' : '') + '" data-qc="mdt:ind:' + x.id + '">' +
        S.esc(x.name) + '</button>';
    }).join('') + '</div>';
  }

  /* ==================== 样式 ==================== */
  var CSS = [
    '#pageContainer .qc-tbl .abn-row td{background:#fdf3f4}',
    '#pageContainer .qc-tbl .sum-row td{background:#f8fafc;font-weight:600;border-top:2px solid #e2e8f0}',
    '#pageContainer .qc-tbl td.num .qc-link{padding:2px 0}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ==================== 交互 ==================== */
  /* 筛选条：选完点「查询」生效（与六大绩效一致）。 */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-qc]') : null;
    if (!el) return;
    var a = el.getAttribute('data-qc');
    if (a.indexOf('mdt:') !== 0 && a.indexOf('filter:') !== 0) return;
    /* filter:* 是质控条线公共动作，六大绩效的筛选条也用同一前缀。
       只有点击落在本模块筛选条（data-qcmdtfilter）里才接管，
       否则六大绩效页一点「查询」就会把页面重绘成 MDT 总览。 */
    if (a.indexOf('filter:') === 0 && !el.closest('[data-qcmdtfilter]')) return;

    if (a.indexOf('filter:') === 0) {
      if (a.indexOf('reset') > 0) {
        /* reset:mdt2（「回到全省」）只清范围，不碰年度与指标 */
        P.city = ''; P.county = ''; P.org = ''; P.cancer = '';
        P.street = ''; P.community = '';
        if (a.indexOf('reset:mdt') === 0) P.year = '2026';
        P.scope = null;
      } else {
        readScopeBar();
      }
      P.verdict = 'ALL'; P.page = 1;
      rerender();
      return;
    }

    var body = a.slice(4);
    if (body === 'back') { window.navigateTo(pageOf()); return; }
    if (body === 'backList') { window.navigateTo('qc-mdt-detail'); return; }
    if (body === 'toRules') { window.navigateTo('qc-rules'); return; }
    if (body === 'toMiss') { P.verdict = 'miss'; P.page = 1; window.navigateTo('qc-mdt-detail'); return; }
    if (body === 'detailOpen') { P.scope = null; P.verdict = 'ALL'; P.page = 1; window.navigateTo('qc-mdt-detail'); return; }
    /* 指标切换：同页内切换，保留全部筛选条件 */
    if (body.indexOf('ind:') === 0) {
      var want = body.slice('ind:'.length);
      if (M.indOf(want) && want !== P.ind) { P.ind = want; P.verdict = 'ALL'; P.page = 1; }
      rerender(); return;
    }

    /* 返回上一级：癌种 → 机构 → 社区 → 街道 → 区县 → 设区市 */
    if (body === 'upOne') {
      if (P.cancer) P.cancer = '';
      else if (P.org) P.org = '';
      else if (P.community) P.community = '';
      else if (P.street) P.street = '';
      else if (P.county) P.county = '';
      else if (P.city) P.city = '';
      rerender(); return;
    }

    /* 格子点击 / 行尾链接：按该交叉条件打开被质控数据 */
    if (body.indexOf('x:') === 0) {
      P.scope = parseScope(body.slice(2));
      P.verdict = 'ALL'; P.page = 1;
      window.navigateTo('qc-mdt-detail');
      return;
    }
    /* 明细页判定页签 / 分页 */
    if (body.indexOf('verdict:') === 0) {
      P.verdict = body.slice('verdict:'.length); P.page = 1;
      window.qcRender('qc-mdt-detail'); return;
    }
    if (body.indexOf('page:') === 0) {
      P.page = parseInt(body.slice('page:'.length), 10) || 1;
      window.qcRender('qc-mdt-detail'); return;
    }
    /* 病例质控详情 */
    if (body.indexOf('case:') === 0) {
      P.caseKey = body.slice('case:'.length);
      window.navigateTo('qc-mdt-case'); return;
    }
    /* 纳入整改：真实入「整改问题」台账（幂等），不再是 toast */
    if (body.indexOf('fix:') === 0) {
      var res = M.remediate(body.slice('fix:'.length));
      if (res.error) { U.toast('未纳入整改：' + res.error); return; }
      U.toast(res.created
        ? '已创建整改问题 ' + res.code + '（MDT 病例整改共 ' + res.total + ' 条，前往「整改问题」处理）'
        : '该病例已在整改清单（' + res.code + '），未重复创建');
      return;
    }
    /* 明细页条件条 */
    if (body === 'scope:apply') { readDetailScope(); window.qcRender('qc-mdt-detail'); return; }
    if (body === 'scope:reset') { P.scope = null; P.verdict = 'ALL'; P.page = 1; window.qcRender('qc-mdt-detail'); return; }
  });

  /* 顶部筛选条「查询」：读取全部控件（含级联已写的地区状态） */
  function readScopeBar() {
    var box = document.querySelector('[data-qcmdtfilter]');
    if (!box) return;
    var sels = box.querySelectorAll('[data-qcmdt]');
    for (var k = 0; k < sels.length; k++) {
      var key = sels[k].getAttribute('data-qcmdt');
      var val = sels[k].value;
      if (key === 'year') { P.year = val || '2026'; continue; }
      P[key] = (val === '' || val === '全部机构' || val === '全部癌种') ? '' : val;
    }
    /* 机构必须落在当前市/区县内 */
    if (P.org) {
      var o = S.org(P.org);
      if (!o || (P.city && o.city !== P.city) || (P.county && o.county !== P.county)) P.org = '';
    }
    if (P.cancer) {
      var c = S.cancer(P.cancer);
      if (!c) P.cancer = '';
    }
  }

  /* 级联选择器回调（qcUI.cascader 统一出口）：顶部筛选条与明细页条件条各一个 id。
     审查修复：改用 qcUI.onCascade 注册，不再包住 window.onQcCascade ——
     单一全局槽位会被后加载的模块覆盖，导致本模块地区筛选静默失效。 */
  function onMdtCascade(id, path, box) {
    if (id !== 'mdt-region' && id !== 'mdt-detail-region') return false;
    var p = path || [];
    var cityCode = '';
    for (var i = 0; i < S.CITIES.length; i++) {
      if (S.CITIES[i].name === p[0]) { cityCode = S.CITIES[i].code; break; }
    }
    if (id === 'mdt-detail-region') {
      /* 明细页：写 P.scope，不污染顶部筛选条 */
      var sc = {};
      if (cityCode) sc.city = cityCode;
      if (p[1]) sc.county = p[1];
      if (p[2]) sc.street = p[2];
      if (p[3]) sc.community = p[3];
      if (P.scope) {
        if (P.scope.cancer) sc.cancer = P.scope.cancer;
        if (P.scope.org) {
          var o0 = S.org(P.scope.org);
          if (o0 && (!sc.city || o0.city === sc.city) && (!sc.county || o0.county === sc.county)) sc.org = P.scope.org;
        }
      }
      P.scope = Object.keys(sc).length ? sc : null;
      P.page = 1;
      window.qcRender('qc-mdt-detail');
      return true;
    }
    var prevCity = P.city, prevCounty = P.county;
    P.city = cityCode;
    P.county = p[1] || '';
    P.street = p[2] || '';
    P.community = p[3] || '';
    /* 上级变了 → 已选机构失效；同级变了但机构不在新范围 → 也清掉 */
    if (P.city !== prevCity) P.org = '';
    else if (P.county !== prevCounty && P.org) {
      var po = S.org(P.org);
      if (!po || (P.county && po.county !== P.county)) P.org = '';
    }
    P.page = 1;
    rerender();
    return true;
  }
  if (U && U.onCascade) U.onCascade('qc-mdt', onMdtCascade);
  else window.onQcCascade = onMdtCascade;

  window.qcMdtPage = {
    pageIds: PAGE_IDS,
    render: render,
    state: P,
    /* 隐藏页的面包屑锚点：都挂到唯一的菜单页 qc-mdt 下 */
    crumb: function (id) {
      if (id === 'qc-mdt-detail') return { menuId: 'qc-mdt', extra: dLabel() };
      if (id === 'qc-mdt-case') {
        var r = M.byKey(P.caseKey);
        return { menuId: 'qc-mdt', extra: r ? r.name + ' · 病例详情' : '病例详情' };
      }
      return null;
    }
  };
})();
