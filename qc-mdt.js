/* ============================================================================
 * qc-mdt.js — MDT 多学科诊疗质控 · 渲染层（2026-10-21 重写）
 *
 * 页面只呈现业务内容：率、分子分母、清单、明细。
 * 口径来源、依据档位等说明性内容不进界面（见产品文档）。
 *
 *   qc-mdt-overview  MDT 质控总览    三项指标 + 癌种分解 + 机构分解
 *   qc-mdt-missing   应讨论未讨论     未开展 MDT 的病例清单
 *   qc-mdt-quality   记录与执行质量   结论明确性 / 结论执行
 *   qc-mdt-rules     入组规则         那些病例应纳入 MDT 管理
 *   qc-mdt-detail    被质控数据（隐藏页）
 *   qc-mdt-case      病例详情（隐藏页）
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
    point: 'P1',
    verdict: 'ALL',
    page: 1, per: 20,
    orgIds: null, cancerIds: null,
    city: '', county: '', street: '', community: '',
    /* 病例详情从哪来，返回到哪去：missing=未讨论清单 / detail=被质控数据 / quality=质量页 */
    caseFrom: 'detail',
    caseKey: ''
  };

  /* 当前所在页：由 render() 记录，rerender() 用它回绘 */
  var CUR = 'qc-mdt-overview';

  /* 达标参考线（仅用于着色，不在界面标注来源） */
  var REF_LINE = { P1: 80, P2: 90, P3: 85 };

  function tone4(v, point) {
    if (v == null) return 'info';
    var line = REF_LINE[point] || 80;
    return v >= line ? 'up' : v >= line - 10 ? 'warn' : 'bad';
  }
  function rateCell(v, point) {
    if (v == null) return '<span style="color:#cbd5e1">—</span>';
    var t = tone4(v, point);
    var color = t === 'up' ? '#2e7d32' : t === 'warn' ? '#b54708' : '#b42335';
    return '<span style="color:' + color + ';font-weight:600;font-variant-numeric:tabular-nums">' + S.f1(v) + '%</span>';
  }

  /* ---------------- 筛选条 ----------------
     行政区划：复用 qcUI.cascader（省→市→区县→街道→社区 五级树）。
     MDT 数据只到机构层级，因此选到街道/社区时按所属区县统计（与原六维绩效一致）。 */
  function scopeBar(extra) {
    var cancerOpts = [{ v: '', l: '全部癌种' }].concat(S.CANCERS.map(function (c) { return { v: c.id, l: c.name }; }));
    var orgOpts = [{ v: '', l: '全部机构' }].concat(currentOrgs().map(function (o) { return { v: o.id, l: o.name }; }));
    var path = [];
    if (P.city) path.push(S.cityName(P.city));
    if (P.county) path.push(P.county);
    if (P.street) path.push(P.street);
    if (P.community) path.push(P.community);
    return '<div class="qc-filter qc-scope" data-qcmdtfilter="1">' +
      '<div class="fg"><label>行政区域</label>' + U.cascader('mdt-region', path, '全部地区') + '</div>' +
      '<div class="fg"><label>癌种</label><select data-qcf="cancer">' +
      cancerOpts.map(function (o) {
        var cur = (P.cancerIds && P.cancerIds[0]) || '';
        return '<option value="' + S.esc(o.v) + '"' + (String(cur) === String(o.v) ? ' selected' : '') + '>' + S.esc(o.l) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="fg"><label>医疗机构</label><select data-qcf="org">' +
      orgOpts.map(function (o) {
        var cur = (P.orgIds && P.orgIds[0]) || '';
        return '<option value="' + S.esc(o.v) + '"' + (String(cur) === String(o.v) ? ' selected' : '') + '>' + S.esc(o.l) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="acts">' + (extra || '') +
      '<button class="btn btn-ghost btn-sm" data-qc="filter:reset:mdt">重置</button></div>' +
      '</div>';
  }

  /* 机构下拉随行政区划收敛：选了市/区县只列该范围机构 */
  function currentOrgs() {
    return S.ORGS.filter(function (o) {
      if (P.city && o.city !== P.city) return false;
      if (P.county && o.county !== P.county) return false;
      return true;
    });
  }
  /* 行政区划 → 机构 id 数组（供数据层过滤） */
  function regionOrgIds() {
    if (!P.city) return null;
    var ids = currentOrgs().map(function (o) { return o.id; });
    return ids.length ? ids : ['__none__'];
  }
  /* 合并行政区划与手工选定机构：手工选定优先 */
  function effOrgIds() {
    if (P.orgIds && P.orgIds.length) return P.orgIds;
    return regionOrgIds();
  }

  function scopeLabel() {
    var parts = [];
    if (P.orgIds && P.orgIds[0]) parts.push((S.org(P.orgIds[0]) || {}).name);
    else if (P.city) parts.push(P.county ? (S.cityName(P.city) + ' · ' + P.county) : S.cityName(P.city));
    else parts.push('全省');
    parts.push((P.cancerIds && P.cancerIds[0]) ? S.cancer(P.cancerIds[0]).name : '全部癌种');
    return parts.join(' · ');
  }

  /* 行政区划级联回调（qcUI.cascader 统一出口） */
  window.onQcCascade = (function (orig) {
    return function (id, path, box) {
      if (id !== 'mdt-region') {
        return typeof orig === 'function' ? orig(id, path, box) : undefined;
      }
      var p = path || [];
      var prevCity = P.city, prevCounty = P.county;
      P.city = ''; P.county = ''; P.street = ''; P.community = '';
      for (var i = 0; i < S.CITIES.length; i++) {
        if (S.CITIES[i].name === p[0]) { P.city = S.CITIES[i].code; break; }
      }
      P.county = p[1] || '';
      P.street = p[2] || '';
      P.community = p[3] || '';
      /* 上级变了 → 已选机构失效；同级变了但机构不在新范围 → 也清掉 */
      if (P.city !== prevCity) P.orgIds = null;
      else if (P.county !== prevCounty && P.orgIds) {
        var po = S.org(P.orgIds[0]);
        if (!po || (P.county && po.county !== P.county)) P.orgIds = null;
      }
      P.page = 1;
      rerender(CUR);
    };
  })(window.onQcCascade);


  /* ---------------- 总览：一张表 ----------------
     不再有第二排页签。表格形态完全由顶部筛选条自动决定（与六大绩效质控同一套逻辑）：
       全省              → 行 = 设区市
       设区市 = 南昌市    → 行 = 该市各机构
       再选定某机构       → 行 = 该机构各癌种
       癌种被筛选锁定     → 该维度从行上塌掉，退化为下一级
     用户不需要选"行/列/指标"，选筛选条件即可。 */
  var DIM_LABEL = { city: '设区市', org: '医疗机构', cancer: '癌种' };

  /* 由筛选条自动推导当前行维度
     癌种一旦被筛选锁定，行上就没有癌种可拆了，退到上一级地域维度：
       机构锁定           → 行 = 该机构各癌种
       设区市/区县锁定     → 行 = 该范围机构
       全省              → 行 = 设区市
     锁了癌种时行维度不变（该癌种在各市/各机构的分布）。 */
  function autoDim() {
    if (P.orgIds && P.orgIds.length) {
      /* 机构 + 癌种都锁定 → 没有可展开的下级，退化到癌种单行 */
      return 'cancer';
    }
    if (P.city) return 'org';   /* 市/区县锁定 → 展开该范围机构 */
    return 'city';              /* 全省 → 设区市 */
  }

  function flatTable(dim) {
    var t = M.crossTable(dim, 'none', { orgIds: effOrgIds(), cancerIds: P.cancerIds, city: P.city, county: P.county });
    var rows = t.body.slice().sort(function (a, b) {
      return (a.total.P1.value || 0) - (b.total.P1.value || 0);
    }).map(function (r) {
      var d = r.total;
      return {
        cls: (d.P1.value != null && d.P1.value < REF_LINE.P1) ? 'abn-row' : '',
        cells: [
          { h: S.esc(r.label) + (r.sub ? '<span style="color:#94a3b8;font-size:11px"> ' + S.esc(r.sub) + '</span>' : ''), cls: 'txt' },
          { h: rateCell(d.P1.value, 'P1'), cls: 'num' },
          { h: S.fmt(d.P1.den), cls: 'num' },
          { h: (d.P1.den - d.P1.num) > 0 ? '<span style="color:#b42335;font-weight:600">' + S.fmt(d.P1.den - d.P1.num) + '</span>' : '0', cls: 'num' },
          { h: rateCell(d.P2.value, 'P2'), cls: 'num' },
          { h: rateCell(d.P3.value, 'P3'), cls: 'num' },
          { h: U.link('未讨论清单', 'mdt:missing' + (dim === 'cancer' ? 'Cancer' : dim === 'org' ? 'Org' : 'City') + ':' + r.key), cls: 'num act' }
        ]
      };
    });
    var g = t.grand;
    rows.push({
      cls: 'sum-row',
      cells: [
        { h: '合计', cls: 'txt' },
        { h: rateCell(g.P1.value, 'P1'), cls: 'num' },
        { h: S.fmt(g.P1.den), cls: 'num' },
        { h: S.fmt(g.P1.den - g.P1.num), cls: 'num' },
        { h: rateCell(g.P2.value, 'P2'), cls: 'num' },
        { h: rateCell(g.P3.value, 'P3'), cls: 'num' },
        { h: '', cls: 'num act' }
      ]
    });
    return U.card('',
      U.table([DIM_LABEL[dim], '#讨论率', '#应讨论', '#未讨论', '#结论明确率', '#执行率', '操作'],
        rows, { compact: true, fit: true, empty: '当前筛选下无病例' }),
      '按讨论率升序');
  }

  function renderOverview() {
    return '<div class="qc-page">' +
      U.head('MDT质控', scopeLabel(), '', false,
        '<button class="btn btn-ghost btn-sm" data-qc="mdt:toRules">入组规则</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="mdt:toMissing">未讨论清单</button>') +
      scopeBar() +
      flatTable(autoDim()) +
      '</div>';
  }

  /* ---------------- 应讨论未讨论 ---------------- */
  function renderMissing() {
    var opt = { point: 'P1', verdict: P.verdict, orgIds: effOrgIds(), cancerIds: P.cancerIds, page: P.page, per: P.per };
    var res = M.cases(opt);
    var vc = M.verdictCounts({ point: 'P1', orgIds: effOrgIds(), cancerIds: P.cancerIds });

    var tabHtml = '<div class="qc-tabs">' + [
      ['miss', '未讨论', vc.miss], ['ok', '已讨论', vc.ok], ['ALL', '全部', vc.ALL]
    ].map(function (t) {
      return '<button class="' + (P.verdict === t[0] ? 'on' : '') + '" data-qc="mdt:verdict:' + t[0] + '">' +
        t[1] + '（' + S.fmt(t[2] || 0) + '）</button>';
    }).join('') + '</div>';

    var rows = res.rows.map(function (r) {
      return {
        cls: r.judge.entered.v === 'miss' ? 'abn-row' : '',
        cells: [
          { h: U.link(r.name + '（' + r.id + '）', 'mdt:case:missing:' + r.key), cls: 'txt' },
          { h: S.esc(r.orgName), cls: 'txt' },
          { h: S.esc(r.cancerName), cls: 'txt' },
          { h: S.esc(r.stage), cls: 'num' },
          { h: S.esc(r.enteredRules.join('、')), cls: 'txt' },
          { h: U.verdictBadge(r.judge.entered.v), cls: 'center' },
          { h: r.judge.entered.reason ? '<span style="color:#b42335">' + S.esc(r.judge.entered.reason) + '</span>' : '—', cls: 'txt' },
          { h: r.judge.entered.v === 'miss' ? U.link('纳入整改', 'mdt:fix:' + r.key) : '—', cls: 'num act' }
        ]
      };
    });

    return '<div class="qc-page">' +
      U.head('应讨论未讨论', '命中 MDT 入组规则但无讨论记录的病例', '', false,
        '<button class="btn btn-ghost btn-sm" data-qc="mdt:back">← 返回总览</button>') +
      scopeBar() +
      U.card('',
        tabHtml + '<div style="height:10px"></div>' +
        U.table(['患者', '医疗机构', '癌种', '分期', '入组条件', '质控结果', '问题原因', '操作'],
          rows, { compact: true, fit: true, empty: '当前筛选下无应讨论病例' }) +
        U.pager(res.total, res.page, res.per, 'mdt')) +
      '</div>';
  }

  /* ---------------- 记录与执行质量 ---------------- */
  function renderQuality() {
    var p = (P.point === 'P3') ? 'P3' : 'P2';
    var pt = M.POINTS.filter(function (x) { return x.id === p; })[0];
    var opt = { point: p, verdict: P.verdict, orgIds: effOrgIds(), cancerIds: P.cancerIds, page: P.page, per: P.per };
    var res = M.cases(opt);
    var vc = M.verdictCounts({ point: p, orgIds: effOrgIds(), cancerIds: P.cancerIds });
    var met = M.metrics({ orgIds: effOrgIds(), cancerIds: P.cancerIds });
    var d = met[p];

    var seg = '<div class="qc-seg" style="margin-bottom:12px">' + [
      ['P2', '结论明确性'], ['P3', '结论执行']
    ].map(function (x) {
      return '<button class="' + (p === x[0] ? 'on' : '') + '" data-qc="mdt:point2:' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '</div>';

    var tabHtml = '<div class="qc-tabs">' + [
      ['ALL', '全部', vc.ALL], ['ok', '符合', vc.ok], ['bad', '不符合', vc.bad], ['miss', '数据缺失', vc.miss], ['abn', '数据异常', vc.abn]
    ].map(function (t) {
      return '<button class="' + (P.verdict === t[0] ? 'on' : '') + '" data-qc="mdt:verdict2:' + t[0] + '">' +
        t[1] + '（' + S.fmt(t[2] || 0) + '）</button>';
    }).join('') + '</div>';

    var cols = p === 'P2'
      ? ['患者', '医疗机构', '癌种', 'MDT 结论', '质控结果', '问题原因', '操作']
      : ['患者', '医疗机构', '癌种', 'MDT 结论', '实际治疗', '质控结果', '问题原因', '操作'];

    var rows = res.rows.map(function (r) {
      var pk = p === 'P2' ? 'conclusion' : 'executed';
      var base = [
        { h: U.link(r.name + '（' + r.id + '）', 'mdt:case:quality:' + r.key), cls: 'txt' },
        { h: S.esc(r.orgName), cls: 'txt' },
        { h: S.esc(r.cancerName), cls: 'txt' },
        { h: S.esc(r.conclusion || '—'), cls: 'txt' }
      ];
      if (p === 'P3') base.push({ h: S.esc(r.actualTreat || '—'), cls: 'txt' });
      base.push({ h: U.verdictBadge(r.judge[pk].v), cls: 'center' });
      base.push({ h: r.judge[pk].reason ? '<span style="color:#b42335">' + S.esc(r.judge[pk].reason) + '</span>' : '—', cls: 'txt' });
      base.push({ h: r.judge[pk].v !== 'ok' ? U.link('纳入整改', 'mdt:fix:' + r.key) : '—', cls: 'num act' });
      return { cls: r.judge[pk].v === 'ok' ? '' : 'abn-row', cells: base };
    });

    return '<div class="qc-page">' +
      U.head('记录与执行质量', pt.metric, '', false,
        '<button class="btn btn-ghost btn-sm" data-qc="mdt:back">← 返回总览</button>') +
      scopeBar() +
      seg +
      U.kpis([
        { l: pt.metric, v: d.value == null ? '—' : S.f1(d.value), unit: '%', tone: tone4(d.value, p), m: '分子 <b>' + S.fmt(d.num) + '</b> / 分母 <b>' + S.fmt(d.den) + '</b>' },
        { l: '符合', v: S.fmt(vc.ok), unit: '例', tone: 'up', m: '判定通过' },
        { l: '不符合', v: S.fmt(vc.bad), unit: '例', tone: vc.bad > 0 ? 'bad' : 'info', m: '未达到判定条件' },
        { l: '数据缺失', v: S.fmt(vc.miss), unit: '例', tone: vc.miss > 0 ? 'warn' : 'info', m: '相关记录未填写' },
        { l: '数据异常', v: S.fmt(vc.abn), unit: '例', tone: vc.abn > 0 ? 'warn' : 'info', m: '记录之间互相矛盾' }
      ], 5) +
      U.card('',
        tabHtml + '<div style="height:10px"></div>' +
        U.table(cols, rows, { compact: true, fit: true, empty: '当前筛选下无记录' }) +
        U.pager(res.total, res.page, res.per, 'mdt')) +
      '</div>';
  }

  /* ---------------- 入组规则 ---------------- */
  function renderRules() {
    var byC = M.enterRulesByCancer();
    var order = ['*'].concat(S.CANCERS.map(function (c) { return c.id; }));
    var blocks = order.filter(function (k) { return byC[k]; }).map(function (k) {
      var list = byC[k];
      var title = k === '*' ? '全癌种通用' : S.cancer(k).name;
      var rows = list.map(function (r) {
        return {
          cells: [
            { h: S.esc(r.name), cls: 'txt' },
            { h: S.esc(r.cond), cls: 'txt' }
          ]
        };
      });
      return U.card(title, U.table(['入组条件', '判定表达式'], rows, { compact: true, fit: true }),
        list.length + ' 项');
    }).join('');

    return '<div class="qc-page">' +
      U.head('MDT 入组规则', '决定哪些病例应纳入 MDT 管理', '', false,
        '<button class="btn btn-ghost btn-sm" data-qc="mdt:back">← 返回总览</button>') +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px">' +
      blocks + '</div>' +
      '</div>';
  }

  /* ---------------- 被质控数据（隐藏页） ---------------- */
  var POINT_OF = { P1: 'entered', P2: 'conclusion', P3: 'executed' };

  function renderDetail() {
    /* point 必须是三个质控点之一；外部传入非法值时兜底到 P1，避免 judge 取不到值而崩 */
    if (!POINT_OF[P.point]) P.point = 'P1';
    var pt = M.POINTS.filter(function (x) { return x.id === P.point; })[0] || M.POINTS[0];
    var opt = { point: P.point, verdict: P.verdict, orgIds: effOrgIds(), cancerIds: P.cancerIds, page: P.page, per: P.per };
    var res = M.cases(opt);
    var vc = M.verdictCounts({ point: P.point, orgIds: effOrgIds(), cancerIds: P.cancerIds });
    var rows = res.rows.map(function (r) {
      var pk = POINT_OF[P.point];
      return {
        cls: r.judge[pk].v === 'ok' ? '' : 'abn-row',
        cells: [
          { h: U.link(r.name + '（' + r.id + '）', 'mdt:case:detail:' + r.key), cls: 'txt' },
          { h: S.esc(r.orgName), cls: 'txt' },
          { h: S.esc(r.cancerName), cls: 'txt' },
          { h: S.esc(r.stage), cls: 'num' },
          { h: S.esc(r.mdtNo || '—'), cls: 'txt' },
          { h: U.verdictBadge(r.judge[pk].v), cls: 'center' },
          { h: r.judge[pk].reason ? S.esc(r.judge[pk].reason) : '—', cls: 'txt' }
        ]
      };
    });
    return '<div class="qc-page">' +
      U.head(pt.metric + ' · 明细', scopeLabel(), '', false,
        '<button class="btn btn-ghost btn-sm" data-qc="mdt:back">← 返回总览</button>') +
      scopeBar() +
      U.card('',
        '<div class="qc-tabs">' + [
          ['ALL', '全部', vc.ALL], ['ok', '符合', vc.ok], ['bad', '不符合', vc.bad], ['miss', '数据缺失', vc.miss], ['abn', '数据异常', vc.abn]
        ].map(function (t) {
          return '<button class="' + (P.verdict === t[0] ? 'on' : '') + '" data-qc="mdt:verdict:' + t[0] + '">' +
            t[1] + '（' + S.fmt(t[2] || 0) + '）</button>';
        }).join('') + '</div><div style="height:10px"></div>' +
        U.table(['患者', '医疗机构', '癌种', '分期', 'MDT 编号', '质控结果', '问题原因'],
          rows, { compact: true, fit: true, empty: '当前筛选下无记录' }) +
        U.pager(res.total, res.page, res.per, 'mdt')) +
      '</div>';
  }

  /* ---------------- 病例详情（隐藏页） ---------------- */
  function renderCase() {
    var r = M.byKey(P.caseKey);
    if (!r) {
      return '<div class="qc-page">' +
        U.head('MDT 病例详情', '病例级证据', '', false,
          '<button class="btn btn-ghost btn-sm" data-qc="mdt:backList">← 返回清单</button>') +
        U.card('未找到病例', '<div class="qc-empty">请从清单点击患者进入。</div>') + '</div>';
    }

    var baseCard = U.card('基础信息', U.kv([
      ['病例号', S.esc(r.id)], ['姓名', S.esc(r.name)],
      ['性别', r.sex], ['年龄', r.age + ' 岁'],
      ['医疗机构', S.esc(r.orgName)], ['癌种', S.esc(r.cancerName)],
      ['临床分期', S.esc(r.stage)], ['诊断日期', r.diagDate]
    ], 2));

    /* 入组判定 */
    var ruleHit = r.enteredRules.length
      ? r.enteredRules.map(function (n, i) {
        var rid = r.enteredRuleIds[i];
        var def = M.ENTER_RULES.filter(function (x) { return x.id === rid; })[0] || {};
        return '<div style="padding:5px 0;border-bottom:1px dashed #eef2f7">' +
          '<b>' + S.esc(n) + '</b>' +
          (def.cond ? '<div style="font-size:12px;color:#475569;margin-top:2px">' + S.esc(def.cond) + '</div>' : '') +
          '</div>';
      }).join('')
      : '<div style="color:#94a3b8;padding:4px 0">未命中入组条件</div>';
    var entryCard = U.card('入组判定', ruleHit, r.enteredRules.length ? '命中 ' + r.enteredRules.length + ' 项' : '未命中');

    /* 诊疗过程 */
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

    /* 三项判定 */
    var pointRows = M.POINTS.map(function (pt) {
      var res = r.judge[pt.key];
      var applies = true;
      if (pt.id === 'P1' && !r.enteredRuleHit) applies = false;
      if (pt.id === 'P2' && r.judge.entered.v !== 'ok') applies = false;
      if (pt.id === 'P3' && (r.judge.entered.v !== 'ok' || r.judge.conclusion.v !== 'ok' || !r.treated)) applies = false;
      return {
        cls: applies && res.v !== 'ok' ? 'abn-row' : '',
        cells: [
          { h: S.esc(pt.metric), cls: 'txt' },
          { h: S.esc(pt.rule.cond), cls: 'txt' },
          { h: applies ? U.verdictBadge(res.v) : '<span style="color:#cbd5e1;font-size:12px">不适用</span>', cls: 'center' },
          { h: applies && res.reason ? '<span style="color:#b42335">' + S.esc(res.reason) + '</span>' : '—', cls: 'txt' }
        ]
      };
    });
    var judgeCard = U.card('质控判定',
      U.table(['指标', '判定条件', '结果', '问题原因'], pointRows, { compact: true, fit: true }));

    /* MDT 记录 */
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
      U.head('MDT 病例详情', S.esc(r.name) + ' · ' + S.esc(r.orgName) + ' · ' + S.esc(r.cancerName) + ' · ' + S.esc(r.stage),
        '', false,
        '<button class="btn btn-ghost btn-sm" data-qc="mdt:backList">← 返回清单</button>' +
        (r.v !== 'ok' ? '<button class="btn btn-primary btn-sm" data-qc="mdt:fix:' + S.esc(r.key) + '">纳入整改</button>' : '')) +
      baseCard + entryCard + tlCard + judgeCard + recCard +
      '</div>';
  }

  /* ---------------- 主渲染 ---------------- */
  function render(pageId) {
    U.closeModal();
    if (pageId) CUR = pageId;
    if (pageId === 'qc-mdt-missing') return renderMissing();
    if (pageId === 'qc-mdt-quality') return renderQuality();
    if (pageId === 'qc-mdt-rules') return renderRules();
    if (pageId === 'qc-mdt-detail') return renderDetail();
    if (pageId === 'qc-mdt-case') return renderCase();
    return renderOverview();
  }

  function rerender(id) { if (window.qcRender) window.qcRender(id || CUR || 'qc-mdt-overview'); }

  /* ---------------- 样式 ---------------- */
  var CSS = [
    '#pageContainer .qc-tbl .abn-row td{background:#fdf3f4}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ---------------- 交互 ----------------
     筛选条两种控件、一种交互：选完立即生效，没有「查询」按钮。
       · 行政区划（级联）→ onQcCascade
       · 癌种 / 医疗机构（下拉）→ 本监听 */
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (!el || !el.getAttribute) return;
    var k = el.getAttribute('data-qcf');
    if (!k) return;
    if (k === 'cancer') P.cancerIds = el.value ? [el.value] : null;
    if (k === 'org') P.orgIds = el.value ? [el.value] : null;
    P.page = 1;
    rerender(CUR);
  });

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-qc]') : null;
    if (!el) return;
    var a = el.getAttribute('data-qc');
    if (a.indexOf('mdt:') !== 0 && a.indexOf('filter:') !== 0) return;
    /* filter:* 是质控条线的公共动作，六大绩效质控的筛选条也用同一个前缀。
       只有点击落在本模块的筛选条（带 data-qcmdtfilter）里才接管，
       否则六大绩效页一点「查询」就会把页面重绘成 MDT 总览。 */
    if (a.indexOf('filter:') === 0 && !el.closest('[data-qcmdtfilter]')) return;

    if (a.indexOf('filter:') === 0) {
      /* 重置：清空全部筛选条件 */
      P.cancerIds = null; P.orgIds = null; P.page = 1; P.verdict = 'ALL';
      P.city = ''; P.county = ''; P.street = ''; P.community = '';
      rerender(CUR);
      return;
    }

    var body = a.slice(4);
    if (body === 'back') {
      /* 返回总览 = 回到全省全癌种，否则用户带着上一页的机构条件回来，看到的还是一张残缺的表 */
      P.page = 1; P.verdict = 'ALL'; P.point = 'P1';
      P.city = ''; P.county = ''; P.street = ''; P.community = '';
      P.orgIds = null; P.cancerIds = null;
      window.navigateTo('qc-mdt-overview'); return;
    }
    if (body === 'toRules') { window.navigateTo('qc-mdt-rules'); return; }
    if (body === 'toMissing') { P.point = 'P1'; P.verdict = 'miss'; P.page = 1; window.navigateTo('qc-mdt-missing'); return; }
    /* 病例详情返回：回到进入详情的那一页，而不是固定跳明细页 */
    if (body === 'backList') {
      var back = P.caseFrom === 'missing' ? 'qc-mdt-missing'
        : P.caseFrom === 'quality' ? 'qc-mdt-quality'
          : 'qc-mdt-detail';
      window.navigateTo(back); return;
    }
    if (body.indexOf('missingCancer:') === 0) {
      P.cancerIds = [body.slice('missingCancer:'.length)];
      P.orgIds = null; P.point = 'P1'; P.verdict = 'miss'; P.page = 1;
      window.navigateTo('qc-mdt-missing'); return;
    }
    if (body.indexOf('missingOrg:') === 0) {
      P.orgIds = [body.slice('missingOrg:'.length)];
      P.cancerIds = null; P.point = 'P1'; P.verdict = 'miss'; P.page = 1;
      window.navigateTo('qc-mdt-missing'); return;
    }
    if (body.indexOf('missingCity:') === 0) {
      /* 按设区市下钻：写 city，机构由行政区划范围收敛 */
      P.city = body.slice('missingCity:'.length);
      P.county = ''; P.street = ''; P.community = '';
      P.orgIds = null; P.cancerIds = null; P.point = 'P1'; P.verdict = 'miss'; P.page = 1;
      window.navigateTo('qc-mdt-missing'); return;
    }
    /* 格子点击：按该格条件打开明细 */
    if (body.indexOf('cell:') === 0) {
      var rest = body.slice('cell:'.length);
      var cut = rest.indexOf(':');
      var mk = rest.slice(0, cut);
      var scope = {};
      try { scope = JSON.parse(decodeURIComponent(rest.slice(cut + 1))) || {}; } catch (e) { scope = {}; }
      P.point = mk;
      P.cancerIds = scope.cancer ? [scope.cancer] : null;
      P.orgIds = scope.org ? [scope.org] : null;
      if (scope.city) { P.city = scope.city; P.county = ''; }
      P.verdict = 'ALL'; P.page = 1;
      window.navigateTo(mk === 'P1' ? 'qc-mdt-detail' : 'qc-mdt-quality');
      return;
    }
    if (body.indexOf('point:') === 0) {
      P.point = body.slice('point:'.length);
      P.verdict = 'ALL'; P.page = 1;
      window.navigateTo(P.point === 'P1' ? 'qc-mdt-detail' : 'qc-mdt-quality');
      return;
    }
    if (body.indexOf('point2:') === 0) {
      P.point = body.slice('point2:'.length);
      P.verdict = 'ALL'; P.page = 1;
      rerender('qc-mdt-quality'); return;
    }
    if (body.indexOf('verdict:') === 0) {
      P.verdict = body.slice('verdict:'.length); P.page = 1;
      rerender(CUR); return;
    }
    if (body.indexOf('verdict2:') === 0) {
      P.verdict = body.slice('verdict2:'.length); P.page = 1;
      rerender('qc-mdt-quality'); return;
    }
    if (body.indexOf('page:') === 0) {
      P.page = parseInt(body.slice('page:'.length), 10) || 1;
      rerender(CUR); return;
    }
    if (body.indexOf('case:') === 0) {
      /* 格式 mdt:case:<来源页>:<病例键>；来源页决定「返回清单」跳回哪里 */
      var rest = body.slice('case:'.length);
      var cut = rest.indexOf(':');
      P.caseFrom = rest.slice(0, cut) || 'detail';
      P.caseKey = rest.slice(cut + 1);
      window.navigateTo('qc-mdt-case'); return;
    }
    if (body.indexOf('fix:') === 0) {
      if (U.toast) U.toast('已纳入整改清单');
      return;
    }
  });

  window.qcMdtPage = {
    pageIds: ['qc-mdt-overview', 'qc-mdt-missing', 'qc-mdt-quality', 'qc-mdt-rules', 'qc-mdt-detail', 'qc-mdt-case'],
    render: render,
    state: P,
    crumb: function (id) {
      if (id === 'qc-mdt-detail') {
        var pt = M.POINTS.filter(function (x) { return x.id === P.point; })[0];
        return { menuId: 'qc-mdt-overview', extra: pt ? pt.metric : '被质控数据' };
      }
      if (id === 'qc-mdt-case') {
        var r = M.byKey(P.caseKey);
        return { menuId: 'qc-mdt-overview', extra: r ? r.name : '病例详情' };
      }
      return null;
    }
  };
})();
