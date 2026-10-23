/* ============================================================================
 * qc-performance.js — 六大绩效质控（六维三级菜单 + 行×列交叉版，2026-10-12）
 *
 * 定位：对「地区（设区市）与医院（医疗机构）」的绩效考核，围绕国考六项
 *      肿瘤专业质控指标展开。六个维度各算一个导航栏三级菜单页面
 *      （qc-pf-nq01…nq06），无总览页；旧链接 qc-performance 兜底到第一维。
 *
 * 单一数据源：所有数字取自 window.qcSpine，不新建数据。
 * 关联关系：
 *   · 每项绩效对应一组判定规则（见 quality-control.js 的 qc-p1 … qc-p6）——
 *     被质控数据下钻到病例后，可查看触发规则，配与看形成闭环；
 *   · 部分病例异常根因是报告卡字段缺陷，明细里提供「前往报卡质量监测」出口，
 *     交由登记条线在其页面内处置（报告卡质量本身不在本页管理）。
 *
 * 页面结构（每维一页）：
 *   [筛选条] 年度 / 设区市 / 医疗机构 / 癌种   ← 范围：限定参与统计的数据
 *   [概览 KPI] 当前值 · 达标判定 · 癌种达标 · 分子分母 · 异常病例
 *   [交叉控制] 行 [设区市|医疗机构|癌种]   列 [无|癌种|设区市|医疗机构]
 *   [交叉表 / 明细表]   行×列透视；列=无时退化为单维指标明细表
 *   [被质控数据明细] 弹层（病例级证据链，带判定页签与分页）
 *
 * 口径 vs 范围（关键设计）：
 *   · 「范围」是要看哪些数据（年度 / 设区市 / 机构 / 癌种），由顶部筛选条收敛；
 *   · 「口径」是要按什么维度看，且是**两个轴可交叉**的（行 × 列），不是互斥页签。
 *     典型用法：行=设区市、列=癌种 → 直接得到「南昌市的每个癌种」这一矩阵；
 *     单元格点击进入的明细同时带地区与癌种两个条件（不再只能"地区全部"或"癌种全部"）。
 *
 * 癌种口径：六大绩效指标各由《国家三级公立医院绩效考核操作手册》规定适用癌种，
 *   同一指标须按癌种分别判定达标，不能只看合计。
 *   · 各指标适用癌种见 qc-data.js 的 L1_IND[].cancers（10/9/8/5/4/5 个）；
 *   · 合计值仅作参考，「癌种达标 n/m」才是考核口径。
 * 暴露：window.qcPerformance = { pageIds:[qc-pf-nq01…06, qc-performance], render, state }
 * ========================================================================== */
(function () {
  'use strict';
  var S = window.qcSpine, U = window.qcUI;

  var P = {
    year: '2026', ind: 'NQ-01',        /* 单指标页：ind 固定为当前维度，不再有六项全览 */
    city: '', county: '', org: '', cancer: '',  /* 筛选条 = 唯一的口径入口（表格随之自动下钻） */
    /* 级联选到街道/社区时记录层级：质控数据只到机构，这两级按所属区县统计 */
    street: '', community: '',
    /* 被质控数据（独立页面 qc-pf-detail）的状态：scope 可同时带 {city?}{county?}{org?}{cancer?} */
    scope: null, verdict: 'ALL', page: 1,
    /* 病例质控详情（独立页面 qc-pf-case） */
    caseKey: '', caseInd: ''
  };
  /* 2026-10-12 六大绩效质控改为三级菜单：六个维度各算一个页面（pageId qc-pf-nq01…06），
     无总览页。PAGEMAP 把页面 id 映射到指标；未匹配的 id 兜底为第一维。 */
  var PAGEMAP = {
    'qc-pf-nq01': 'NQ-01', 'qc-pf-nq02': 'NQ-02', 'qc-pf-nq03': 'NQ-03',
    'qc-pf-nq04': 'NQ-04', 'qc-pf-nq05': 'NQ-05', 'qc-pf-nq06': 'NQ-06',
    'qc-performance': 'NQ-01'    /* 旧链接兜底 */
  };

  function curInd() { return S.ind(P.ind) || S.L1_IND[0]; }
  /* 当前维度对应的菜单 pageId；六维以外的兜底到第一维 */
  function pageOf(indId) {
    var id = indId || P.ind;
    for (var k in PAGEMAP) if (PAGEMAP[k] === id) return k;
    return 'qc-pf-nq01';
  }
  /* 重绘当前指标页：必须走 qcRender（只重绘质控容器），
     不能走全局 window.renderPage —— 那个已被 app.html 的新版实现覆盖，
     会把页面渲染成别的模块（曾导致点「查询」跳到 MDT 页）。 */
  function rerender() {
    if (window.qcRender) { window.qcRender(pageOf()); return; }
    window.renderPage(pageOf());
  }

  /* ---------- 级联选择器回调（U.cascader 选中/清除时触发） ----------
     路径形如 ['南昌市','东湖区','董家窑街道','民巷社区']。
     把「市 / 区县」映射到筛选状态；街道与社区本级没有病例数据（质控数据只到机构），
     选到街道/社区时按所属区县统计，并在下钻条里如实标注当前层级。
     两个宿主共用：考核页 pf-region、明细页 pf-detail-region。 */
  window.onQcCascade = function (id, path, box) {
    var p = path || [];
    var cityName = p[0] || '';
    var countyName = p[1] || '';
    var code = '';
    for (var i = 0; i < S.CITIES.length; i++) {
      if (S.CITIES[i].name === cityName) { code = S.CITIES[i].code; break; }
    }

    if (id === 'pf-detail-region') {
      /* 明细页：写 P.scope，不污染顶部筛选条 */
      var sc = {};
      if (code) sc.city = code;
      if (countyName) sc.county = countyName;
      if (p[2]) sc.street = p[2];
      if (p[3]) sc.community = p[3];
      /* 保留未被地区覆盖的条件（癌种）；机构要校验是否落在新范围内 */
      if (P.scope && P.scope.cancer) sc.cancer = P.scope.cancer;
      if (P.scope && P.scope.org) {
        var o0 = S.org(P.scope.org);
        if (o0 && (!sc.city || o0.city === sc.city) && (!sc.county || o0.county === sc.county)) {
          sc.org = P.scope.org;
        }
      }
      P.scope = Object.keys(sc).length ? sc : null;
      P.page = 1;
      window.qcRender('qc-pf-detail');
      return;
    }

    if (id !== 'pf-region') return;
    var prevCity = P.city, prevCounty = P.county;
    P.city = code;
    P.county = countyName;
    /* 街道 / 社区：记录一下，用于界面提示"已按所属区县统计" */
    P.street = p[2] || '';
    P.community = p[3] || '';
    /* 上级变了 → 机构失效；同级变了但机构不在新范围内 → 也清掉 */
    if (P.city !== prevCity) P.org = '';
    else if (P.county !== prevCounty && P.org) {
      var po = S.org(P.org);
      if (!po || (P.county && po.county !== P.county)) P.org = '';
    }
    rerender();
  };

  function cancerFilter() { return P.cancer ? [P.cancer] : null; }
  /* 指定设区市下的机构；传了 county 再收敛到该区县内的机构 */
  function cityOrgIds(city, county) {
    var c = city == null ? P.city : city;
    var k = county == null ? P.county : county;
    if (!c) return null;
    return S.ORGS.filter(function (o) {
      return o.city === c && (!k || o.county === k);
    }).map(function (o) { return o.id; });
  }
  /* 当前选中的区县列表（供下拉联动） */
  function countiesOf(cityCode) {
    for (var i = 0; i < S.CITIES.length; i++) {
      if (S.CITIES[i].code === cityCode) return S.CITIES[i].counties || [];
    }
    return [];
  }
  /* 范围的有效机构：优先单机构，其次区县，再次设区市，最后全省（null = 不限） */
  function effOrgIds() {
    if (P.org) return [P.org];
    if (P.city) return cityOrgIds();
    return null;
  }
  function scopeName() {
    if (P.org) return (S.org(P.org) || {}).name || P.org;
    if (P.city && P.county) return S.cityName(P.city) + ' · ' + P.county;
    if (P.city) return S.cityName(P.city);
    return '全省';
  }
  /* ---------- 公共小件 ---------- */
  function badge(p) { return p ? '<span class="badge badge-success">达标</span>' : '<span class="badge badge-danger">未达标</span>'; }
  /* 达标线：判定仍走脊柱的 l1Pass / l1PassLineOf（口径见《六大绩效质控_口径与计算规则.md》），
     但界面只给结论 —— 不展示达标线数值、来源、依据，也不提供来源切换。 */
  function lineOf(i) {
    var L = S.l1PassLineOf(i.id || P.ind);
    return (i.dir === 'down' ? '≤' : '≥') + L.value + '%';
  }
  /* lineCell（表格里的「≥xx%」数值列）已移除：达标线数值本身属于计算口径，
     页面只给「达标 / 未达标」结论。lineOf 保留给内部导出与说明文案使用。 */
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

  /* ---------- 范围与轴的求交 ----------
     轴单元格带 orgIds / cancerIds（null = 该轴不限定此维度）。两个轴 + 顶部范围
     三者求交，才能算出"南昌市 × 肺癌"这种既限地区又限癌种的格子。
     注意：交集为空必须返回 ['__none__'] 而不是 []——agg 把空数组当"不限"，
     传 [] 会静默变成全省，这是最容易出错的地方。 */
  function both(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    var out = a.filter(function (x) { return b.indexOf(x) >= 0; });
    return out.length ? out : ['__none__'];
  }
  /* 单元格：行轴 × 列轴 × 顶部范围 */
  function crossAgg(r, c) {
    return S.agg(curInd().id,
      both(both(r && r.orgIds, c && c.orgIds), effOrgIds()),
      both(both(r && r.cancerIds, c && c.cancerIds), cancerFilter()));
  }

  /* ---------- 轴定义：把一个维度展开成若干可交叉的单元格 ---------- */
  var AXIS_LABEL = { city: '设区市', org: '医疗机构', cancer: '癌种' };
  function buildAxis(dim) {
    var i = curInd();
    if (dim === 'city') {
      var cs = S.CITIES;
      if (P.city) cs = cs.filter(function (c) { return c.code === P.city; });
      return cs.map(function (c) {
        return {
          key: c.code, label: c.name, scope: { city: c.code }, cancerIds: null,
          orgIds: S.ORGS.filter(function (o) { return o.city === c.code; }).map(function (o) { return o.id; })
        };
      });
    }
    if (dim === 'org') {
      /* 机构轴随「设区市 → 区县」收敛：选了区县就只列该区县的机构 */
      var os = S.ORGS.filter(function (o) {
        if (P.city && o.city !== P.city) return false;
        if (P.county && o.county !== P.county) return false;
        return true;
      });
      if (P.org) os = os.filter(function (o) { return o.id === P.org; });
      return os.map(function (o) {
        /* 行标签带上区县，方便在同市多区县对比时区分 */
        return { key: o.id, label: o.name, sub: o.county || o.level,
          scope: { org: o.id, city: o.city, county: o.county }, cancerIds: null, orgIds: [o.id] };
      });
    }
    if (dim === 'cancer') {
      var ids = i.cancers.slice();
      if (P.cancer) ids = ids.filter(function (x) { return x === P.cancer; });
      return ids.map(function (cid) {
        var c = S.cancer(cid);
        return { key: cid, label: c.name, sub: c.icd, scope: { cancer: cid }, orgIds: null, cancerIds: [cid] };
      });
    }
    return [];
  }

  /* ---------- 口径：癌种下拉（选项由当前指标的适用癌种决定） ---------- */
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
  /* 机构下拉：随设区市 / 区县收敛（选了区县就只列该区县的机构） */
  function orgOptions() {
    return S.ORGS.filter(function (o) {
      if (P.city && o.city !== P.city) return false;
      if (P.county && o.county !== P.county) return false;
      return true;
    }).map(function (o) { return { v: o.id, l: o.name }; });
  }
  /* 顶部筛选条：年度 / 所属地区（级联：设区市→区县→街道→社区）/ 医疗机构 / 癌种。
     原先「设区市」「区县」两个下拉合并为一个级联控件：
       · 选完市就立即级联出区县（原来选市后不重绘，区县永远显示"请先选择设区市"）；
       · 一个控件承载五级，筛选条不再被下级下拉越挤越窄。 */
  function scopeBar() {
    var yearOpts = ['2026', '2025', '2024'].map(function (y) { return { v: y, l: y }; });
    function sel(key, label, list, cur, style, attr) {
      return '<div class="fg' + (style ? ' ' + style : '') + '"><label>' + S.esc(label) + '</label>' +
        '<select ' + (attr || 'data-qcp') + '="' + S.esc(key) + '">' + optHtml(list, cur) + '</select></div>';
    }
    /* 级联当前路径：市 → 区县（街道/社区本级无数据，但控件支持继续下钻） */
    var path = [];
    if (P.city) path.push(S.cityName(P.city));
    if (P.county) path.push(P.county);
    return '<div class="qc-filter qc-scope">' +
      sel('year', '统计年度', yearOpts, P.year, 'w-year', 'data-qcf') +
      '<div class="fg w-mid"><label>所属地区</label>' +
      U.cascader('pf-region', path, '全部地区') +
      '</div>' +
      sel('org', '医疗机构', [{ v: '', l: '全部机构' }].concat(orgOptions()), P.org, 'w-mid', 'data-qcf') +
      sel('cancer', '癌种', cancerOptionsForInd(), P.cancer, 'w-mid') +
      '<div class="acts">' +
      '<button class="btn btn-ghost btn-sm" data-qc="filter:reset:pf">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-qc="filter:apply:pf">查询</button>' +
      '</div>' +
      '</div>';
  }

  /* ---------- 表格规范 ----------
     列宽不再写死：交给 qcUI.table 的 fit 模式按内容测算（含表头与全部单元格）。
     之前写死 110px 装不下「首次治疗前临床分期评估率」（13 字 ≈ 198px），
     表头 nowrap 溢出压到「达标线」列上——这类错只要指标名长一点就复现，
     因此统一改为内容自适应；容器过窄时由 min-width 触发横向滚动。 */
  /* 操作列的链接：表头「操作」会自动右对齐，单元格用同一对齐类 */
  function actLink(text, action) {
    return { h: U.link(text, action), cls: 'num act' };
  }

  /* ---------- 自动下钻：表格形态完全由筛选条决定，不再有「行/列」控件 ----------
     下钻链 设区市 → 区县 → 医疗机构 → 癌种：筛选选到哪一级，就展开它的下一级。
       全省              → 行=设区市，列=癌种（11 市 × 癌种矩阵）
       设区市=南昌市     → 行=南昌市各机构，列=癌种（机构 × 癌种矩阵）
       区县=东湖区       → 行=东湖区各机构，列=癌种（机构数变少，仍是矩阵）
       再选定某机构      → 行=该机构各癌种（单维表，癌种已无法再细分）
       选了具体癌种      → 矩阵退化：列塌掉，行按上一级展开（单维表）
     区县属于「范围」的一部分（收窄机构集合），不单独构成一层行轴。 */
  function autoAxis() {
    /* 癌种一旦被筛选条锁定，列轴就没有可拆分的余地了 */
    var cancerLocked = !!P.cancer;
    /* 机构锁定后行轴落到癌种（机构内部只剩癌种可拆） */
    if (P.org) return { row: 'cancer', col: 'none' };
    /* 设区市 / 区县锁定 → 行=该范围内的机构，列=癌种（保留交叉能力） */
    if (P.city) return { row: 'org', col: cancerLocked ? 'none' : 'cancer' };
    /* 全省 → 行=设区市，列=癌种 */
    return { row: 'city', col: cancerLocked ? 'none' : 'cancer' };
  }
  /* 行维的中文标题（矩阵表头用） */
  function axisTitle(dim) { return AXIS_LABEL[dim]; }

  /* ---------- 交叉矩阵：行 × 列，单元格同时受两轴约束 ---------- */
  function valHtml(a, i, bold) {
    if (!a.den) return '<span style="color:#cbd5e1">—</span>';
    var pass = S.l1Pass(i.id, a.value);
    return '<span style="font-weight:' + (bold ? '700' : '600') + ';color:' +
      (pass ? '#2e7d32' : '#b42335') + ';font-variant-numeric:tabular-nums">' + S.f1(a.value) + '%</span>';
  }
  /* 单元格可点：带着「本行 + 本列」的双重条件打开明细 */
  function crossCell(a, i, r, c) {
    if (!a.den) return '<span style="color:#cbd5e1">—</span>';
    var pass = S.l1Pass(i.id, a.value);
    var col = pass ? '#2e7d32' : '#b42335';
    var sc = encScope(mergeScope(r.scope, c.scope));
    return '<button class="qc-link" style="color:' + col + ';font-variant-numeric:tabular-nums" ' +
      'data-qc="pf:x:' + sc + '" title="查看该行列交叉下的被质控数据">' + S.f1(a.value) + '%</button>';
  }
  function rowHead(r, dim) {
    var html = S.esc(r.label);
    if (r.sub) html += '<span style="color:#94a3b8;font-size:11px"> ' + S.esc(r.sub) + '</span>';
    return html;
  }

  /* 交叉矩阵：行 × 列，单元格同时受两轴约束（轴由筛选条自动决定） */
  function matrixTable(ax) {
    var i = curInd();
    var rows = buildAxis(ax.row), cols = buildAxis(ax.col);
    var head = [axisTitle(ax.row)]
      .concat(cols.map(function (c) { return '#' + c.label; }))
      .concat(['#合计', '操作']);
    /* 矩阵列数随癌种数变化，交给 fit 按内容测算（癌种名 + 百分比格子都算进去） */
    var body = rows.map(function (r) {
      var cells = [{ h: rowHead(r), cls: 'txt' }];
      cols.forEach(function (cc) {
        cells.push({ h: crossCell(crossAgg(r, cc), i, r, cc), cls: 'num' });
      });
      cells.push({ h: valHtml(S.agg(i.id, both(r.orgIds, effOrgIds()), cancerFilter()), i, true), cls: 'num' });
      cells.push(actLink('被质控数据', 'pf:x:' + encScope(r.scope)));
      return { cells: cells };
    });
    /* 列合计行：该列在所有行上的汇总 */
    var tCells = [{ h: '合计', cls: 'txt' }];
    cols.forEach(function (cc) {
      tCells.push({ h: valHtml(S.agg(i.id, both(cc.orgIds, effOrgIds()), both(cc.cancerIds, cancerFilter())), i, true), cls: 'num' });
    });
    tCells.push({ h: valHtml(S.agg(i.id, effOrgIds(), cancerFilter()), i, true), cls: 'num' });
    tCells.push({ h: '', cls: 'num act' });
    body.push({ cls: 'sum-row', cells: tCells });

    /* 卡片不带标题栏（标题/副标题信息已在下钻条与面包屑里） */
    return U.card('',
      U.note('范围：' + S.esc(scopeName()) + '。行 = ' + axisTitle(ax.row) + '，列 = ' + axisTitle(ax.col) +
        '；每格为该行该列<b>交叉条件</b>下的指标值，绿=达标、红=未达标、「—」=该癌种不适用本指标。' +
        '格子可点，进入的被质控数据<b>同时带行、列两个条件</b>。') +
      U.table(head, body, { compact: true, fit: true }));
  }

  /* ==================== 单维指标明细表 ==================== */
  /* 三个单维表：设区市明细 / 机构明细 / 癌种明细。轴由筛选条自动决定。 */
  function regionTable(ax) {
    var i = curInd();
    var rows = buildAxis('city');
    var total = S.agg(i.id, cityOrgIds(), cancerFilter());
    var totalPass = S.l1Pass(i.id, total.value);
    function valCell(v) { return '<span style="font-variant-numeric:tabular-nums;font-weight:600">' + S.f1(v) + '%</span>'; }
    var bodyRows = rows.map(function (r) {
      var ct = { code: r.key, name: r.label };
      var a = S.agg(i.id, r.orgIds, cancerFilter());
      var pass = S.l1Pass(i.id, a.value);
      var abn = S.abnCount(i.id, null, r.orgIds);
      var yoy = S.yoy(i.id, r.orgIds, cancerFilter());
      var cov = coverStat(i.id, r.orgIds);
      return {
        cells: [
          { h: S.esc(ct.name), cls: 'txt' },
          { h: valCell(a.value), cls: 'num' },
          { h: badge(pass), cls: 'center' },
          { h: covCell(cov), cls: 'num', title: '该地区覆盖的 ' + cov.m + ' 个癌种中已达标数' },
          { h: S.fmt(a.num), cls: 'num' },
          { h: S.fmt(a.den), cls: 'num' },
          { h: S.fmt(abn), cls: 'num' },
          { h: (yoy >= 0 ? '+' : '') + yoy + '%', cls: 'num' },
          actLink('被质控数据', 'pf:x:city=' + r.key)
        ],
        cls: pass ? '' : 'abn-row'
      };
    });
    var totalRow = {
      cls: 'sum-row',
      cells: [
        { h: P.city ? S.cityName(P.city) + ' 合计' : '全省合计', cls: 'txt' },
        { h: valCell(total.value), cls: 'num' },
        { h: badge(totalPass), cls: 'num' },
        { h: covCell(coverStat(i.id, cityOrgIds())), cls: 'num' },
        { h: S.fmt(total.num), cls: 'num' },
        { h: S.fmt(total.den), cls: 'num' },
        { h: S.fmt(S.abnCount(i.id, null, cityOrgIds())), cls: 'num' },
        { h: '—', cls: 'num' },
        { h: '', cls: 'num act' }
      ]
    };
    return U.card('',
      U.note('适用癌种：' + i.cancers.map(function (c) { return S.esc(S.cancer(c).name); }).join('、') + '。') +
      U.table(['设区市', '#' + i.name, '达标', '癌种达标', '#分子', '#分母', '#异常病例', '#同比', '操作'],
        bodyRows.concat([totalRow]), { compact: true, fit: true }));
  }

  function orgTable(ax) {
    var i = curInd();
    var rows = buildAxis('org').map(function (r) {
      var o = S.org(r.key);
      var a = S.agg(i.id, [r.key], cancerFilter());
      return { o: o, a: a, pass: S.l1Pass(i.id, a.value), abn: S.abnCount(i.id, null, [r.key]), cov: coverStat(i.id, [r.key]) };
    }).sort(function (x, y) { return (i.dir === 'down' ? 1 : -1) * (x.a.value - y.a.value); });
    var bodyRows = rows.map(function (r) {
      return {
        cells: [
          { h: S.esc(r.o.name), cls: 'txt' },
          { h: S.esc(r.o.county || '—'), cls: 'txt' },
          { h: S.esc(r.o.level), cls: 'txt' },
          { h: '<b>' + S.f1(r.a.value) + '%</b>', cls: 'num' },
          { h: badge(r.pass), cls: 'center' },
          { h: covCell(r.cov), cls: 'num', title: '该机构覆盖的 ' + r.cov.m + ' 个癌种中已达标数' },
          { h: S.fmt(r.a.num), cls: 'num' },
          { h: S.fmt(r.a.den), cls: 'num' },
          { h: S.fmt(r.abn), cls: 'num' },
          actLink('被质控数据', 'pf:x:org=' + r.o.id)
        ],
        cls: r.pass ? '' : 'abn-row'
      };
    });
    return U.card('',
      U.note('筛选范围：' + S.esc(scopeName()) + '，' + rows.length + ' 家机构；按指标值' +
        (i.dir === 'down' ? '从低到高' : '从高到低') + '排序。适用癌种：' +
        i.cancers.map(function (c) { return S.esc(S.cancer(c).name); }).join('、') + '。') +
      U.table(['医疗机构', '区县', '级别', '#' + i.name, '达标', '癌种达标', '#分子', '#分母', '#异常病例', '操作'],
        bodyRows, { compact: true, fit: true }));
  }

  function cancerTable(ax) {
    var i = curInd();
    var ids = buildAxis('cancer');
    var ofs = effOrgIds();
    var bodyRows = ids.map(function (r) {
      var cid = r.key;
      var a = S.agg(i.id, ofs, [cid]);
      var pass = S.l1Pass(i.id, a.value);
      var abn = S.abnCount(i.id, cid, ofs);
      var on = P.cancer === cid;
      return {
        cells: [
          { h: (on ? '<b>' : '') + S.esc(r.label) + '<span style="color:#94a3b8;font-size:11px"> ' + S.esc(r.sub) + '</span>' + (on ? '</b>' : ''), cls: 'txt' },
          { h: '<b>' + S.f1(a.value) + '%</b>', cls: 'num' },
          { h: badge(pass), cls: 'center' },
          { h: S.fmt(a.num), cls: 'num' },
          { h: S.fmt(a.den), cls: 'num' },
          { h: S.fmt(abn), cls: 'num' },
          actLink('被质控数据', 'pf:x:cancer=' + cid)
        ],
        cls: pass ? '' : 'abn-row'
      };
    });
    var tot = S.agg(i.id, ofs, cancerFilter());
    bodyRows.push({
      cls: 'sum-row',
      cells: [
        { h: '合计（当前筛选）', cls: 'txt' },
        { h: '<b>' + S.f1(tot.value) + '%</b>', cls: 'num' },
        { h: badge(S.l1Pass(i.id, tot.value)), cls: 'center' },
        { h: S.fmt(tot.num), cls: 'num' },
        { h: S.fmt(tot.den), cls: 'num' },
        { h: S.fmt(S.abnCount(i.id, P.cancer || null, ofs)), cls: 'num' },
        { h: '', cls: 'num act' }
      ]
    });
    return U.card('',
      U.note('当前范围：' + S.esc(scopeName()) +
        '。下表按癌种拆分，用于定位拉低合计的短板癌种。') +
      U.table(['癌种', '#' + i.name, '达标', '#分子', '#分母', '#异常病例', '操作'],
        bodyRows, { compact: true, fit: true }));
  }

  /* 分母口径验证卡已从界面移除 —— 分母入组/排除规则、潜在分母与纳入率、
     病案号级清单导出都属于计算口径，统一收进《六大绩效质控_口径与计算规则.md》，
     页面只呈现指标值与达标结论。数据层 denBreakdown / denCases / denCsv 保留，
     供后台核对与导出工具调用。 */

  /* 单维表：轴由筛选条自动决定（癌种锁定/机构锁定都会落到单维表） */
  function singleTable(ax) {
    return ax.row === 'org' ? orgTable(ax)
      : ax.row === 'cancer' ? cancerTable(ax)
        : regionTable(ax);
  }

  /* ==================== 被质控数据（独立页面 qc-pf-detail） ==================== */
  /* scope 可同时带 city / org / cancer —— 这才是"既按地区又按癌种"的落点。
     行内下钻传的 scope 存在页面状态里（不污染顶部筛选条）；null = 沿用筛选条。 */
  function mergeScope(a, b) {
    var o = {};
    for (var k in (a || {})) if (a[k]) o[k] = a[k];
    for (var k2 in (b || {})) if (b[k2]) o[k2] = b[k2];
    return o;
  }
  function encScope(sc) {
    var parts = [];
    for (var k in (sc || {})) if (sc[k]) parts.push(k + '=' + sc[k]);
    return parts.join(';');
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
  function scopeOrgIds(scope) {
    scope = scope || {};
    if (scope.org) return [scope.org];
    if (scope.city) {
      return S.ORGS.filter(function (o) {
        return o.city === scope.city && (!scope.county || o.county === scope.county);
      }).map(function (o) { return o.id; });
    }
    return effOrgIds();
  }
  function scopeCancerIds(scope) {
    scope = scope || {};
    if (scope.cancer) return [scope.cancer];
    return cancerFilter();
  }
  function scopeLabel(scope) {
    scope = scope || {};
    var parts = [];
    if (scope.org) parts.push((S.org(scope.org) || {}).name || scope.org);
    else if (scope.city) {
      parts.push(scope.county ? S.cityName(scope.city) + ' · ' + scope.county : S.cityName(scope.city));
    }
    if (scope.cancer) parts.push(S.cancer(scope.cancer).name);
    return parts.length ? parts.join(' · ') : scopeName();
  }

  /* 打开被质控数据页：scope 为对象则用该交叉口径，null 则沿用筛选条 */
  function openDetail(scope) {
    P.scope = scope || null;
    P.verdict = 'ALL'; P.page = 1;
    window.navigateTo('qc-pf-detail');
  }

  /* 明细页的条件条：可在页内改 所属地区/机构/癌种（保持交叉口径），
     与考核页筛选条同风格（.qc-filter），但独立于 P.city/county/org，写在 P.scope 上。
     地区同样用一个级联控件（与考核页一致），不再拆成两个下拉。 */
  function detailScopeBar() {
    var i = curInd();
    var sc = P.scope || {};
    /* 机构选项：随市 / 区县收敛 */
    var orgOpts = [{ v: '', l: '全部机构' }].concat(
      S.ORGS.filter(function (o) {
        if (sc.city && o.city !== sc.city) return false;
        if (sc.county && o.county !== sc.county) return false;
        return true;
      }).map(function (o) { return { v: o.id, l: o.name }; })
    );
    var canOpts = [{ v: '', l: '全部癌种' }].concat(i.cancers.map(function (c) {
      return { v: c, l: S.cancer(c).name };
    }));
    function sel(key, label, list, cur, style) {
      var opts = list.map(function (o) {
        return '<option value="' + S.esc(o.v) + '"' + (String(cur) === String(o.v) ? ' selected' : '') + '>' + S.esc(o.l) + '</option>';
      }).join('');
      return '<div class="fg' + (style ? ' ' + style : '') + '"><label>' + S.esc(label) + '</label>' +
        '<select data-qcs="' + S.esc(key) + '">' + opts + '</select></div>';
    }
    /* 级联当前路径（市 → 区县） */
    var path = [];
    if (sc.city) {
      var ct = null;
      for (var ci = 0; ci < S.CITIES.length; ci++) if (S.CITIES[ci].code === sc.city) ct = S.CITIES[ci];
      if (ct) path.push(ct.name);
    }
    if (sc.county) path.push(sc.county);
    return '<div class="qc-filter qc-scope" data-qcscope="1">' +
      '<div class="fg w-mid"><label>所属地区</label>' +
      U.cascader('pf-detail-region', path, '全部地区') +
      '</div>' +
      sel('org', '医疗机构', orgOpts, sc.org || '', 'w-mid') +
      sel('cancer', '癌种', canOpts, sc.cancer || '', 'w-mid') +
      '<div class="acts">' +
      '<button class="btn btn-ghost btn-sm" data-qc="pf:scope:reset">重置条件</button>' +
      '<button class="btn btn-primary btn-sm" data-qc="pf:scope:apply">应用</button>' +
      '</div>' +
      '</div>';
  }

  /* 页面：被质控数据（某指标在某个/某几个交叉条件下列出的病例） */
  function renderDetailPage() {
    var i = curInd();
    var ofs = scopeOrgIds(P.scope);
    var cfs = scopeCancerIds(P.scope);
    var vc = S.verdictCounts(i.id, { orgIds: ofs, cancerIds: cfs });
    /* 判定页签：沿用站内既有 .qc-tabs 风格（与「指标分析」页一致） */
    var tabs = [
      ['ALL', '全部数据', vc.ALL], ['ok', '符合', vc.ok], ['bad', '不符合', vc.bad],
      ['miss', '数据缺失', vc.miss], ['abn', '数据异常', vc.abn]
    ];
    var tabHtml = '<div class="qc-tabs">' + tabs.map(function (t) {
      return '<button class="' + (P.verdict === t[0] ? 'on' : '') + '" data-qc="pf:verdict:' + t[0] + '">' +
        t[1] + '（' + S.fmt(t[2] || 0) + '）</button>';
    }).join('') + '</div>';

    /* 只构造当前页要显示的 20 条：上限 = 页码 × 20，避免整范围构造证据链 */
    var data = S.cases(i.id, { orgIds: ofs, cancerIds: cfs, verdict: P.verdict, limit: P.page * 20 });
    var sl = U.slice(data.rows, P.page, 20);
    var rows = sl.rows.map(function (r) {
      var bad = r.v !== 'ok';
      return {
        cls: bad ? 'abn-row' : '',
        cells: [
          { h: U.link(r.name + '（' + S.esc(r.id) + '）', 'pf:case:' + i.id + ':' + r.key), cls: 'txt' },
          { h: S.cityName(r.city), cls: 'txt' },
          { h: S.esc(r.orgName), cls: 'txt' },
          { h: S.esc(r.cancerName), cls: 'txt' },
          { h: U.verdictBadge(r.v), cls: 'center' },
          { h: bad ? '<span style="color:#b42335">' + S.esc(r.reason || '—') + '</span>' : '—', cls: 'txt' },
          /* 「病例详情」是文本链接列，左对齐（不要 num/act，否则会跟右侧操作列挤成一堆） */
          { h: U.link('病例详情', 'pf:case:' + i.id + ':' + r.key), cls: 'txt' },
          { h: bad ? U.link('纳入整改', 'pf:fix:' + r.key) : '—', cls: 'num act' }
        ]
      };
    });

    /* 表格上方不再放"异常原因结构"提示带与"实际纳入计算的全部病例"说明段，
       直接给页签 + 表格，保持页面干净。 */
    var card = U.card('被质控数据明细',
      tabHtml +
      '<div style="height:10px"></div>' +
      U.table(['患者', '设区市', '医疗机构', '癌种', '质控结果', '问题原因', '病例详情', '操作'], rows,
        { compact: true, fit: true, empty: '该交叉条件下暂无被质控数据' }) +
      U.pager(sl.total, sl.page, 20, 'pf'));

    return '<div class="qc-page">' +
      U.head('被质控数据明细',
        i.name + ' · ' + scopeLabel(P.scope) + '，共 ' + S.fmt(data.total) + ' 条（抽样）',
        '', false,
        '<button class="btn btn-ghost btn-sm" data-qc="pf:back">← 返回考核表</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="pf:toReport">前往报卡质量监测</button>') +
      detailScopeBar() +
      card +
      '</div>';
  }

  /* 与指标相关的关键字段（按指标裁剪，不做全病历展示）。
     NQ-01 只保留可直取的字段：初次诊断日期 / 临床分期 / 首次治疗日期。
     已移除「分期评估日期」——它需要从病程记录文本提炼，不在本系统的取数口径内。 */
  function keyFieldsOf(r) {
    var src = '云健康';
    if (r.ind === 'NQ-01') {
      /* 分期评估日期：接口未接入时标注「待接口扩展」，接入后自动出值 */
      var evSrc = r.stageEvalOn ? (r.stageEvalSrc || '云健康 · 病历') : '待接口扩展（需从病程记录文本提炼）';
      return [['初次诊断日期', r.diagDate, src], ['临床分期', r.stageVal, src],
        ['分期评估日期', r.stageEvalOn ? (r.stageEvalDate || '') : '（未取数）', evSrc],
        ['首次治疗日期', r.treatDate, src]];
    }
    if (r.ind === 'NQ-02') {
      return [['首次治疗日期', r.treatDate, src], ['首次治疗方式', '非手术治疗', src],
        ['病理诊断', r.pathology, '病理系统'], ['病理报告日期', r.pathDate, '病理系统']];
    }
    if (r.ind === 'NQ-03') {
      return [['手术日期', r.surgDate, src], ['术后病理 pTNM', r.ptnm, '病理系统'],
        ['病理诊断', r.pathology, '病理系统']];
    }
    if (r.ind === 'NQ-04') {
      return [['手术日期', r.surgDate, src], ['死亡日期', r.deathDate, '死因监测'],
        ['术后 30 日内死亡', r.deathDate ? '是' : '否', '死因监测']];
    }
    if (r.ind === 'NQ-05') {
      /* NQ-05 深化：把"必检项目 / 已检项目 / 缺项"摊开，缺什么一目了然 */
      var md = r.molDetect || { items: [], detected: [], missing: [] };
      var def = r.molItems || S.molItemsOf(r.cancer);
      var rows5 = [
        ['首次治疗日期', r.treatDate, src], ['首次治疗方式', '靶向/免疫治疗', src],
        ['分子病理检测结果', r.mol, '分子病理实验室'], ['检测报告日期', r.pathDate, '分子病理实验室']
      ];
      if (def) {
        rows5.push(['本癌种必检项目', def.items.join(' / '), '癌种质控规范（' + (def.label || S.cancer(r.cancer).name) + '）']);
        rows5.push(['已检项目', md.detected.length ? md.detected.join(' / ') : '（无）', '分子病理实验室']);
        rows5.push(['缺检项目', md.missing.length ? md.missing.join(' / ') : '无', '判定用']);
      }
      return rows5;
    }
    /* NQ-06：本癌种淋巴结清扫下限（结直肠 ≥12、胃癌 ≥16…） */
    var lm = r.lymphMin;
    return [['手术日期', r.surgDate, src], ['淋巴结清扫数目', r.lymph, '病理报告'],
      ['本癌种规范下限', lm ? ('≥ ' + lm.min + ' 枚（' + S.cancer(r.cancer).name + '）') : '≥ 12 枚', lm ? lm.basis : '癌种质控规范'],
      ['病理诊断', r.pathology, '病理系统']];
  }

  /* 页面：病例质控详情（某一条病例的证据链） */
  function renderCasePage() {
    var indId = P.caseInd || P.ind;
    var i = S.ind(indId) || curInd();
    var r = S.caseByKey(indId, P.caseKey);
    if (!r) {
      return '<div class="qc-page">' +
        U.head('病例质控详情', '病例级质控证据', '', false,
          '<button class="btn btn-ghost btn-sm" data-qc="pf:backList">← 返回被质控数据</button>') +
        U.card('未找到病例', '<div class="qc-empty">请从「被质控数据明细」点击患者进入。</div>') +
        '</div>';
    }
    var rule = r.rule || S.ruleOf(indId, r.v, r.cancer) || {};
    var ok = r.v === 'ok';

    /* 基础信息：只保留与本次质控直接相关、且都能从报告卡/病案首页直取的字段。
       已移除 科室 / 主管医生 / 住院号 / 病案号 —— 与指标判定无关，
       且需额外的病历关联才能取到完整值。 */
    /* 首次诊断日期已在「诊疗过程」时间轴与「质控相关数据」表中展示，基础信息不再重复。 */
    var baseCard = U.card('基础信息', U.kv([
      ['病例号', S.esc(r.id)], ['姓名', S.esc(r.name)],
      ['性别', r.sex], ['年龄', r.age + ' 岁'],
      ['医疗机构', S.esc(r.orgName)], ['设区市', S.cityName(r.city)],
      ['癌种', S.esc(r.cancerName)]
    ], 2), '与本次质控判定直接相关的患者与就诊信息');

    /* 诊疗过程：只列可直取的时间节点。
       已移除「分期评估」（无对应字段）与「后续治疗」（与指标判定无关）。 */
    var tl = [
      { title: '首次诊断', date: r.diagDate, desc: '确诊为 ' + S.esc(r.cancerName), state: 'ok' },
      { title: '病理诊断', date: r.pathDate, desc: r.pathology ? S.esc(r.pathology) : '<span style="color:#d98b2b">未记录病理结果</span>', state: r.pathology ? 'ok' : 'miss' },
      {
        title: '临床分期', date: '—',
        desc: r.stageVal ? '临床分期 ' + S.esc(r.stageVal) : '<span style="color:#d98b2b">未记录临床分期</span>',
        state: r.stageVal ? 'ok' : 'miss'
      },
      { title: '首次抗肿瘤治疗', date: r.treatDate, desc: '首次抗肿瘤治疗执行日期', state: 'ok' }
    ];
    if (r.surgDate) tl.push({ title: '手术', date: r.surgDate, desc: '术后病理 pTNM ' + (S.esc(r.ptnm) || '未记录'), state: r.ptnm ? 'ok' : 'miss' });
    if (r.deathDate) tl.push({ title: '死亡', date: r.deathDate, desc: '术后 30 日内死亡', state: 'bad' });
    /* 时间轴按指标裁剪：只保留与本指标判定相关的节点，剔除跑题节点。
       NQ-01 去掉 病理诊断 / 手术 / 死亡（属 NQ-02~04 的判定字段，与"分期评估率"无关）；
       严格模式下补回「分期评估」节点，未配置的指标保持原有全量节点行为。 */
    if (indId === 'NQ-01' && r.stageEvalOn) {
      tl.splice(2, 0, {
        title: '分期评估', date: r.stageEvalDate || '—',
        desc: r.stageEvalDate ? ('评估日期 ' + S.esc(r.stageEvalDate)) : '<span style="color:#d98b2b">未记录分期评估日期</span>',
        state: r.stageEvalDate ? (r.v === 'ok' ? 'ok' : 'bad') : 'miss'
      });
    }
    var tlSub = '诊断 → 病理 → 临床分期 → 首次治疗 → 手术';
    var tlKeep = { 'NQ-01': r.stageEvalOn ? ['首次诊断', '临床分期', '分期评估', '首次抗肿瘤治疗'] : ['首次诊断', '临床分期', '首次抗肿瘤治疗'] };
    var keep = tlKeep[indId];
    if (keep) {
      tl = tl.filter(function (n) { return keep.indexOf(n.title) >= 0; });
      tlSub = tl.map(function (n) { return n.title; }).join(' → ');
    }
    var tlCard = U.card('诊疗过程', U.timeline(tl), tlSub);

    var fields = keyFieldsOf(r);
    function v(x) {
      return x == null || x === '' ? '<span style="color:#b42335">（空）</span>' : S.esc(x);
    }
    var relCard = U.card('质控相关数据',
      U.note('按方案要求，本页<b>只展示与当前指标「' + S.esc(i.name) + '」有关的数据字段</b>，不提供完整病历浏览器。') +
      '<div style="height:10px"></div>' +
      U.table(['数据项', '数据值', '数据来源'],
        fields.map(function (f) { return { cells: [f[0], { h: v(f[1]) }, f[2]] }; }),
        { compact: true, fit: true }));

    /* 规则判定不再重复列举字段值（已在「质控相关数据」表展示），只给规则与判定结论。
       NQ-01 的降级/严格判定差异属于计算口径，不在界面提示，改由
       《六大绩效质控_口径与计算规则.md》§4.3 交代。 */
    var judgeCard = U.card('规则判定',
      U.judgeBlock(rule, '详见上方「质控相关数据」表（共 ' + fields.length + ' 项）', r.verdictText, ok ? '' : r.reason) +
      '<div style="height:12px"></div>' +
      U.note(ok
        ? '本病例符合质控规则要求，判定为「符合」，无需整改。'
        : '本病例判定为「' + S.esc(r.verdictText) + '」，原因：<b>' + S.esc(r.reason) + '</b>。' +
          '可点击下方「纳入整改」将本问题推送至质控问题中心。', !ok));

    return '<div class="qc-page">' +
      U.head('病例质控详情', i.name + ' · ' + S.esc(r.name) + '（' + S.esc(r.orgName) + ' · ' + S.esc(r.cancerName) + '）',
        '', false,
        '<button class="btn btn-ghost btn-sm" data-qc="pf:backList">← 返回被质控数据</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="pf:mark">标记质控问题</button>' +
        '<button class="btn btn-primary btn-sm" data-qc="pf:fix:' + S.esc(r.key) + '">纳入整改</button>') +
      baseCard + tlCard + relCard + judgeCard +
      '</div>';
  }

  /* ==================== 下钻指示条 ==================== */
  /* 不再有「行/列」控件：表格形态由筛选条自动决定。这条只负责让用户知道
     当前处于哪一级下钻，并提供返回上一级 + 明细入口。 */
  function drillBar() {
    var trail = '<span class="qc-pf-trail"><span class="lb">当前范围</span>' +
      '<span class="lv on">全省</span>';
    if (P.city) trail += '<span class="sep">▸</span><span class="lv on">' + S.esc(S.cityName(P.city)) + '</span>';
    if (P.county) trail += '<span class="sep">▸</span><span class="lv on">' + S.esc(P.county) + '</span>';
    /* 街道 / 社区：展示但标注按区县统计（质控数据只到机构） */
    if (P.street) trail += '<span class="sep">▸</span><span class="lv">' + S.esc(P.street) + '</span>';
    if (P.community) trail += '<span class="sep">▸</span><span class="lv">' + S.esc(P.community) + '</span>';
    if (P.org) trail += '<span class="sep">▸</span><span class="lv on">' + S.esc((S.org(P.org) || {}).name || P.org) + '</span>';
    if (P.cancer) trail += '<span class="sep">▸</span><span class="lv on">' + S.esc(S.cancer(P.cancer).name) + '</span>';
    trail += '</span>';
    /* 选到街道/社区时说明数据口径，避免误以为数据精确到该社区 */
    var hint = (P.street || P.community)
      ? '<span class="qc-pf-hint">已选到' + (P.community ? '社区' : '街道') +
        '，质控数据仅到机构层级，按所属' + (P.county ? P.county : '设区市') + '统计</span>'
      : '';
    var back = (P.org || P.county || P.street || P.city || P.cancer)
      ? '<button class="btn btn-ghost btn-sm" data-qc="pf:upOne">← 返回上一级</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="filter:reset:pf2">回到全省</button>'
      : '';
    return '<div class="qc-pf-dimbar">' + trail + hint +
      '<span class="qc-pf-db-acts">' + back +
      '<button class="btn btn-ghost btn-sm" data-qc="pf:detailOpen">被质控数据明细</button></span>' +
      '</div>';
  }

  /* ==================== 主渲染（三页共用入口） ==================== */
  /* qc-pf-nq0x：考核页（表格形态随筛选条自动下钻）
   * qc-pf-detail：被质控数据明细（独立页面）
   * qc-pf-case：病例质控详情（独立页面）
   * 三个页面同属本模块，pageId→指标由 P.ind 贯穿（明细/详情页沿用来源指标）。 */
  function render(pageId) {
    if (pageId && PAGEMAP[pageId]) P.ind = PAGEMAP[pageId];
    if (!P.ind) P.ind = 'NQ-01';
    U.closeModal();

    if (pageId === 'qc-pf-detail') return renderDetailPage();
    if (pageId === 'qc-pf-case') return renderCasePage();

    /* 表格形态由筛选条自动决定（设区市 → 医疗机构 → 癌种 自动下钻） */
    var i = curInd();
    var ax = autoAxis();
    var table = ax.col === 'none' ? singleTable(ax) : matrixTable(ax);

    /* 页头只留指标名 + 「查看判定规则」按钮：
       副标题（指标定义/分子/分母长文案）与右上角「六大绩效质控 · xxx」标签已按需求移除。
       指标定义与分子分母口径改在表格上方的 range note 里按需交代。 */
    return '<div class="qc-page">' +
      U.head(i.name, '', '', false,
        '<button class="btn btn-ghost btn-sm" data-qc="pf:toRules">查看判定规则</button>') +
      scopeBar() +
      drillBar() +
      table +
      '</div>';
  }

  /* ==================== 样式 ==================== */
  var CSS = [
    /* 筛选条 flex 单行：四项字段 + 重置/查询挤在同一行，禁止换行。 */
    '#pageContainer .qc-scope{display:flex;flex-wrap:nowrap;align-items:flex-end;gap:10px;overflow-x:auto}',
    '#pageContainer .qc-scope .fg{flex:1 1 0;min-width:0}',
    '#pageContainer .qc-scope .fg.w-year{flex:0 0 92px}',
    '#pageContainer .qc-scope .fg.w-mid{flex:1.15 1 150px}',
    '#pageContainer .qc-scope .acts{flex:0 0 auto;grid-column:auto;white-space:nowrap}',
    '#pageContainer .qc-scope select{text-overflow:ellipsis}',
    /* 下钻指示条：口径面包屑 + 返回上一级 + 明细入口（无「行/列」控件） */
    '#pageContainer .qc-pf-dimbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}',
    '#pageContainer .qc-pf-trail{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:#475569}',
    '#pageContainer .qc-pf-trail .lb{font-size:12px;color:#94a3b8;font-weight:600}',
    '#pageContainer .qc-pf-trail .lv{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:13px;background:#eef4fb;color:#244765;font-weight:600}',
    '#pageContainer .qc-pf-trail .sep{color:#cbd5e1}',
    /* 街道/社区级：只作层级展示（灰），因为数据到机构为止 */
    '#pageContainer .qc-pf-trail .lv:not(.on){background:#f4f7fa;color:#94a3b8}',
    '#pageContainer .qc-pf-hint{font-size:11.5px;color:#b54708;background:#fffbf5;border:1px solid #f0e0c8;border-radius:4px;padding:3px 8px;line-height:1.5}',
    '#pageContainer .qc-pf-db-acts{display:inline-flex;align-items:center;gap:8px;margin-left:auto}',
    /* 明细页判定页签沿用站内 .qc-tabs，这里只需保证与卡片间距 */
    '#pageContainer .qc-tabs+.qc-note{margin-top:0}',
    '#pageContainer .qc-tbl .abn-row td{background:#fdf3f4}',
    '#pageContainer .qc-tbl .sum-row td{background:#f8fafc;font-weight:600;border-top:2px solid #e2e8f0}',
    /* 交叉矩阵：单元格是链接按钮，去掉默认内边距让它贴着列头右对齐 */
    '#pageContainer .qc-tbl td.num .qc-link{padding:2px 0}'
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

    /* 筛选条（统一读取）：year/city/county/org 走 data-qcf，cancer 走 data-qcp。
       表格形态随筛选条自动下钻，所以这里不需要再管任何「轴」状态。
       注意：「回到全省」用的 filter:reset:pf2 只清范围，不碰 P.ind。
       逐级联动：换了设区市 → 清区县与机构；换了区县 → 清该区县之外的机构。 */
    if (a.indexOf('filter:') === 0) {
      if (a.indexOf('reset') > 0) {
        P.city = ''; P.county = ''; P.org = ''; P.cancer = ''; P.year = '2026';
        P.street = ''; P.community = '';
        /* P.ind 不重置（维度由菜单页决定）；表格形态会随范围自动回落 */
      } else {
        var box = el.closest('.qc-filter');
        var reads = box ? box.querySelectorAll('[data-qcf],[data-qcp]') : [];
        for (var k = 0; k < reads.length; k++) {
          var attr = reads[k].hasAttribute('data-qcf') ? 'data-qcf' : 'data-qcp';
          var kk = reads[k].getAttribute(attr);
          var vv = reads[k].value;
          P[kk] = vv === '' || vv === '全部' || vv === '全部机构' || vv === '全部癌种' ? '' : vv;
        }
        /* 机构变了要校验是否落在当前市/区县内（地区改由级联控件负责） */
        if (P.org) {
          var po = S.org(P.org);
          if (!po || (P.city && po.city !== P.city) || (P.county && po.county !== P.county)) P.org = '';
        }
      }
      rerender();
      return;
    }

    /* 返回上一级：社区 → 街道 → 区县 → 设区市（再往下才是机构/癌种）
       地区层级由级联控件承载，这里同步清掉并重绘，控件会回到对应层级。 */
    if (a === 'pf:upOne') {
      if (P.cancer) P.cancer = '';
      else if (P.org) P.org = '';
      else if (P.community) P.community = '';
      else if (P.street) P.street = '';
      else if (P.county) P.county = '';
      else if (P.city) P.city = '';
      rerender(); return;
    }

    /* 跳转被质控数据（独立页面 qc-pf-detail）：
       不带条件 → 沿用当前筛选条范围；核对条件 → 用该行的交叉条件
       （如 city=3601;cancer=C34 = "南昌市 × 肺癌"）。 */
    if (a === 'pf:detailOpen') { openDetail(null); return; }
    if (a.indexOf('pf:x:') === 0) { openDetail(parseScope(a.slice('pf:x:'.length))); return; }
    /* 明细页内的判定页签 / 分页：只改状态重绘，不重置口径 */
    if (a.indexOf('pf:verdict:') === 0) {
      P.verdict = a.slice('pf:verdict:'.length); P.page = 1;
      window.qcRender('qc-pf-detail'); return;
    }
    if (a.indexOf('pf:page:') === 0) {
      P.page = parseInt(a.slice('pf:page:'.length), 10) || 1;
      window.qcRender('qc-pf-detail'); return;
    }
    if (a === 'pf:backList') { window.navigateTo('qc-pf-detail'); return; }
    if (a === 'pf:back') { window.navigateTo(pageOf()); return; }

    /* 病例质控详情（独立页面 qc-pf-case） */
    if (a.indexOf('pf:case:') === 0) {
      var p = a.split(':');
      P.caseInd = p[2]; P.caseKey = p.slice(3).join(':');
      window.navigateTo('qc-pf-case');
      return;
    }
    if (a === 'pf:mark') { U.toast('已标记质控问题（演示）'); return; }
    if (a.indexOf('pf:fix:') === 0) { U.toast('已将问题纳入整改清单，前往「整改问题」处理'); return; }

    /* 明细页条件条：应用/重置（设区市→机构联动由 change 事件即时重绘） */
    if (a === 'pf:scope:apply') { readDetailScope(el); window.qcRender('qc-pf-detail'); return; }
    if (a === 'pf:scope:reset') { P.scope = null; P.verdict = 'ALL'; P.page = 1; window.qcRender('qc-pf-detail'); return; }

    if (a === 'pf:toRules') { window.navigateTo('qc-rules'); return; }
    if (a === 'pf:toReport') { window.navigateTo('analysis-quality'); return; }
    /* 导出分母清单（病案号级 CSV，供试点机构核对圈定逻辑） */
    if (a.indexOf('pf:exportDen:') === 0) {
      var did = a.slice('pf:exportDen:'.length);
      var csv = S.denCsv(did, { orgIds: effOrgIds(), cancerIds: cancerFilter() });
      try {
        var blob = new Blob(['\ufeff' + csv.csv], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url; link.download = csv.fileName;
        document.body.appendChild(link); link.click();
        setTimeout(function () { URL.revokeObjectURL(url); link.remove(); }, 400);
        U.toast('已导出分母清单 ' + csv.rows.length + ' 条（' + csv.fileName + '）');
      } catch (e) {
        U.toast('导出失败：' + (e && e.message ? e.message : '浏览器不支持'));
      }
      return;
    }
  });

  /* 达标线来源切换已从界面移除（口径收敛到文档）：不再监听 data-qcl 的 change。
     若后台需要切换来源，直接调 S.setL1PassSource(indId, src) 后 rerender 即可。 */

  /* 读取明细页条件条里「非地区」的下拉（机构/癌种）写回 P.scope。
     地区条件由级联控件 onQcCascade 负责写 P.scope.city/county，这里读取时保留它们。 */
  function readDetailScope() {
    var box = document.querySelector('[data-qcscope]');
    if (!box) return;
    var sc = {};
    /* 保留级联已写好的地区条件 */
    if (P.scope) {
      ['city', 'county', 'street', 'community'].forEach(function (k) {
        if (P.scope[k]) sc[k] = P.scope[k];
      });
    }
    var sels = box.querySelectorAll('[data-qcs]');
    for (var k = 0; k < sels.length; k++) {
      var key = sels[k].getAttribute('data-qcs');
      var val = sels[k].value;
      if (val) sc[key] = val;
    }
    /* 机构必须落在当前市/区县内 */
    if (sc.org) {
      var o = S.org(sc.org);
      if (!o || (sc.city && o.city !== sc.city) || (sc.county && o.county !== sc.county)) delete sc.org;
    }
    P.scope = Object.keys(sc).length ? sc : null;
    P.page = 1;
  }
  /* 明细页条件条：机构下拉变化时即时重绘（癌种只是暂存，点「应用」才生效） */
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (!el || !el.getAttribute) return;
    if (el.getAttribute('data-qcs') !== 'org') return;
    if (!document.querySelector('[data-qcscope]')) return;
    readDetailScope();
    if (window.qcRender) window.qcRender('qc-pf-detail');
  });

  window.qcPerformance = {
    pageIds: [
      'qc-pf-nq01', 'qc-pf-nq02', 'qc-pf-nq03', 'qc-pf-nq04', 'qc-pf-nq05', 'qc-pf-nq06',
      'qc-performance',
      'qc-pf-detail', 'qc-pf-case'
    ],
    render: render,
    state: P,
    /* 隐藏页的面包屑锚点：挂在"来源指标"那一页下，extra 为当前条件/病例。
       app.html 的 updateBreadcrumb 包装层调用它（找不到返回 null 走默认逻辑）。 */
    crumb: function (id) {
      var indPage = pageOf(P.ind);
      if (id === 'qc-pf-detail') return { menuId: indPage, extra: scopeLabel(P.scope) };
      if (id === 'qc-pf-case') {
        var i = S.ind(P.caseInd || P.ind) || curInd();
        return { menuId: indPage, extra: i.short + ' · 病例详情' };
      }
      return null;
    }
  };
})();
