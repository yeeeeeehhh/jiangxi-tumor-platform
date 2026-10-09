/* ============================================================================
 * qc-l1.js — ① 诊疗过程与单病种质控
 *
 * 页面：诊疗质控总览 / 指标分析 / 被质控数据详情
 * 取数：全部来自 window.qcSpine（国考六项指标 + 病例级质控记录）。
 *
 * 下钻链路（本模块严格遵守）：
 *   诊疗质控总览 → 指标分析 → 被质控数据列表 → 被质控数据详情 → 规则 → 纳入整改
 * ========================================================================== */
(function () {
  'use strict';

  var S = window.qcSpine, U = window.qcUI;

  var GROUP = 'qc-g-dtx';
  var PAGE_META = {
    'qc-natl-overview': { label: '诊疗质控总览', sub: '国家肿瘤专业医疗质量控制指标 · 六项核心指标监测' },
    'qc-natl-drill': { label: '指标分析', sub: '单项指标的分子分母、被质控病例与规则判定' },
    'qc-natl-cancer': { label: '癌种分析', sub: '单项指标在 10 个癌种上的分层与达标情况' },
    'qc-natl-org': { label: '医疗机构分析', sub: '单项指标在 18 家机构上的排名、区域均值与达标' },
    'qc-mcd-dtx': { label: '被质控数据详情', sub: '病例级质控证据：数据 → 规则 → 判定 → 原始追溯' }
  };

  /* 页面级状态（筛选、分页、当前指标） */
  var ST = {
    year: '2026', city: '', org: '', cancer: '', ind: 'NQ-01',
    period: '月', page: 1, per: 20,
    listPage: 1, verdict: 'ALL',
    caseKey: '', fromPage: 'qc-natl-drill'
  };

  function inds() { return S.L1_IND; }
  function cur() { return S.ind(ST.ind) || inds()[0]; }

  /* 当前筛选 → 机构 id 数组 */
  function orgFilter() {
    if (ST.org) return [ST.org];
    if (ST.city) {
      return S.ORGS.filter(function (o) { return o.city === ST.city; }).map(function (o) { return o.id; });
    }
    return null;
  }
  function cancerFilter() { return ST.cancer ? [ST.cancer] : null; }

  /* 一个指标卡的"当前值/分子/分母/同比/异常病例" —— 总览顶部六张卡 */
  function indKpi(i) {
    var a = S.agg(i.id, orgFilter(), cancerFilter());
    var abn = S.abnCount(i.id, ST.cancer || null, orgFilter());
    var y = S.yoy(i.id, orgFilter(), cancerFilter());
    var unit = i.dir === 'down' ? '%' : '%';
    return {
      l: i.name, v: S.f1(a.value), unit: unit,
      tone: i.dir === 'down' ? 'info' : (a.value >= i.base ? 'up' : 'warn'),
      m: '分子 <b>' + S.fmt(a.num) + '</b> / 分母 <b>' + S.fmt(a.den) + '</b> · 同比 ' +
        (y >= 0 ? '+' : '') + y + '% · 异常 <b>' + S.fmt(abn) + '</b> 例',
      action: 'l1:ind:' + i.id
    };
  }

  /* 生成"结论洞察"横幅：把六项指标的达标画像翻译成人话 */
  function overviewInsights(prof, scope) {
    var out = [];
    var w = prof.worst, b = prof.best;
    /* 1. 总体判定 */
    var lvl = prof.score >= 85 ? 'good' : prof.score >= 70 ? 'warn' : 'bad';
    out.push({
      tone: lvl, icon: lvl === 'good' ? '✓' : lvl === 'warn' ? '⚠' : '!',
      tt: scope + '诊疗质控综合得分 ' + S.f1(prof.score) + '（六项达标 ' + prof.passN + '/' + prof.total + '）',
      dd: (prof.failN === 0
        ? '六项国考核心指标<b>全部达到基准</b>，诊疗过程规范性良好。'
        : '其中 <b>' + prof.failN + ' 项未达基准</b>，共 <b>' + S.fmt(prof.totAbn) + '</b> 例病例被判定异常（异常率 ' + S.f1(prof.abnRate) + '%）。') +
        ' 同比向好指标 <span class="up">' + prof.improving + '</span> 项。'
    });
    /* 2. 最拖后腿 */
    if (w) {
      out.push({
        tone: w.pass ? 'info' : 'bad', icon: '↓',
        tt: '最需关注：' + w.name + ' ' + S.f1(w.value) + (w.dir === 'down' ? '%（越低越好）' : '%'),
        dd: (w.pass
          ? '虽已达标，但在六项中裕度最小，仅' + (w.gap >= 0 ? '高于' : '低于') + '基准 <b>' + S.f1(Math.abs(w.gap)) + '%</b>，需保持。'
          : '<span class="dn">距基准 ' + w.base + (w.dir === 'down' ? '%' : '%') + ' 差 ' + S.f1(Math.abs(w.gap)) + ' 个百分点</span>，' +
            '涉及异常病例 <b>' + S.fmt(w.abn) + '</b> 例，建议优先立项整改。') +
          ' <button class="qc-link" data-qc="l1:ind:' + w.id + '">查看该指标分析 →</button>'
      });
    }
    /* 3. 最亮眼 */
    if (b && b.id !== (w && w.id)) {
      out.push({
        tone: 'good', icon: '↑',
        tt: '表现标杆：' + b.name + ' ' + S.f1(b.value) + '%',
        dd: '高于基准 <b>' + S.f1(Math.abs(b.gap)) + '</b> 个百分点，位列六项之首，可作为其他指标的整改参照。'
      });
    }
    return out;
  }

  /* ==================== 页面：诊疗质控总览 ==================== */
  function renderOverview() {
    var fs = orgFilter(), cs = cancerFilter();
    var scope = (ST.city ? S.cityName(ST.city) : '全省') + (ST.cancer ? ' · ' + S.cancer(ST.cancer).name : '');
    var prof = S.l1Profile(fs, cs);

    /* —— 结论洞察横幅：先说"说明了什么" —— */
    var insightHtml = U.insights(overviewInsights(prof, scope));

    /* —— 综合评级 + 达标概览（左评级环，右六项达标差距条） —— */
    var scoreCard = U.card('诊疗质控综合评级',
      U.grid13(
        U.scoreCard(prof.score,
          prof.score >= 85 ? '优秀' : prof.score >= 70 ? '良好' : prof.score >= 60 ? '待改进' : '需重点整改',
          ['六项达标 <b>' + prof.passN + '/' + prof.total + '</b> · 同比向好 ' + prof.improving + ' 项',
           '综合异常率 <b>' + S.f1(prof.abnRate) + '%</b>（' + S.fmt(prof.totAbn) + ' / ' + S.fmt(prof.totDen) + '）',
           '评分 = 达标率×60% + 平均达标裕度×40%']),
        '<div style="padding:4px 2px"><div style="font-size:12px;color:#667085;font-weight:600;margin-bottom:10px">六项指标达标差距（相对基准，正=优于基准）</div>' +
        U.divergeBars(prof.rows.map(function (r) {
          return { l: r.short, gap: r.gap, unit: '%' };
        })) + '</div>'
      ), '一屏看清整体水平与短板', null, true);

    /* —— 指标 × 设区市 达标热力矩阵：哪个市在哪项塌方一目了然 —— */
    var mtx = S.l1RegionMatrix(cs);
    var matrixCard = U.card('指标 × 设区市 达标热力矩阵',
      U.matrix(inds().map(function (i) { return i.short; }),
        mtx.map(function (r) {
          return {
            label: r.name,
            cells: r.cells.map(function (c) {
              if (c.den <= 0) return { v: '—', style: 'background:#f8fafc;color:#cbd5e1' };
              var style = U.heat(c.value, c.dir, c.base);
              return {
                v: c.dir === 'down' ? S.f1(c.value) : S.f1(c.value),
                style: style, title: r.name + ' · ' + c.value + (c.dir === 'down' ? '%（越低越好）' : '%'),
                action: 'l1:mtx:' + c.ind + ':' + r.code
              };
            })
          };
        }), { corner: '设区市＼指标', note: '点击单元格下钻到该市该指标' }),
      '按行看市、按列看指标，红块即为短板落点');

    /* 六项核心指标 */
    var kpiHtml = U.kpis(inds().map(indKpi), 3);

    /* 癌种质量分析：10 个癌种 */
    var cancerRows = S.CANCERS.map(function (c) {
      var den = 0, num = 0;
      inds().forEach(function (i) {
        if (i.cancers.indexOf(c.id) < 0) return;
        var a = S.agg(i.id, fs, [c.id]);
        den += a.den; num += a.num;
      });
      /* 纳入质控数 = 该癌种被质控的病例数；指标结果取六项平均 */
      var pass = 0, tot = 0;
      inds().forEach(function (i) {
        if (i.cancers.indexOf(c.id) < 0) return;
        var a = S.agg(i.id, fs, [c.id]);
        if (a.den > 0) { pass += a.num / a.den; tot++; }
      });
      var abn = 0;
      inds().forEach(function (i) {
        if (i.cancers.indexOf(c.id) < 0) return;
        abn += S.abnCount(i.id, c.id, fs);
      });
      var abnRate = den > 0 ? abn / den * 100 : 0;
      return [
        c.name,
        { h: S.fmt(den), cls: 'num' },
        { h: S.fmt(den), cls: 'num' },
        { h: '<b>' + (tot ? S.f1(pass / tot * 100) : '—') + '%</b>', cls: 'num' },
        { h: S.fmt(abn), cls: 'num' },
        { h: U.heat(tot ? pass / tot * 100 : null, 'up', 86) ? '<span style="padding:2px 7px;border-radius:4px;' + U.heat(tot ? pass / tot * 100 : null, 'up', 86) + '">' + S.f1(abnRate) + '%</span>' : '—' }
      ];
    });
    var cancerTable = U.card('癌种质量分析', U.table(
      ['癌种', '#病例数', '#纳入质控数', '#指标结果', '#异常病例数', '#异常率'],
      cancerRows.map(function (r) { return { cells: r }; }), { empty: '暂无数据' }
    ), '覆盖 10 个癌种', '<button class="btn btn-ghost btn-sm" data-qc="l1:export">导出数据</button>');

    /* 医疗机构分析 */
    var orgRows = S.ORGS.map(function (o) {
      var den = 0, done = 0, abnInd = 0, probs = 0;
      inds().forEach(function (i) {
        var a = S.agg(i.id, [o.id], cs);
        if (a.den <= 0) return;
        den += a.den;
        /* 指标完成情况：达标（up 类 ≥ 基准 / down 类 ≤ 基准）的指标数 */
        var ok = i.dir === 'down' ? a.value <= i.base : a.value >= i.base;
        if (ok) done++;
        if (!ok) abnInd++;
        probs += S.abnCount(i.id, ST.cancer || null, [o.id]);
      });
      if (den <= 0) return null;
      var n = inds().filter(function (i) { return S.agg(i.id, [o.id], cs).den > 0; }).length;
      return {
        cells: [
          o.name,
          o.level,
          { h: S.fmt(den), cls: 'num' },
          { h: done + ' / ' + n, cls: 'num' },
          { h: abnInd > 0 ? '<span style="color:#b42335;font-weight:600">' + abnInd + '</span>' : '0', cls: 'num' },
          { h: S.fmt(probs), cls: 'num' },
          { h: U.link('机构分析', 'l1:orgDrill:' + o.id), cls: 'num' }
        ]
      };
    }).filter(Boolean);

    /* 指标趋势 + 趋势解读 */
    var tr = S.trend(ST.ind, ST.period, fs, cs);
    var trFirst = tr.length ? tr[0].v : 0, trLast = tr.length ? tr[tr.length - 1].v : 0;
    var trDelta = Math.round((trLast - trFirst) * 100) / 100;
    var trUp = cur().dir === 'down' ? trDelta < 0 : trDelta > 0;
    var trendCard = U.card('指标趋势',
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">' +
      '<span style="font-size:12px;color:#667085">当前指标：<b>' + S.esc(cur().name) + '</b></span>' +
      '<span class="qc-seg">' + ['月', '季度', '年度'].map(function (p) {
        return '<button class="' + (ST.period === p ? 'on' : '') + '" data-qc="l1:period:' + p + '">' + p + '</button>';
      }).join('') + '</span></div>' +
      U.lineChart(tr) +
      '<div style="margin-top:8px;font-size:12px;color:#475569;line-height:1.6">' +
      '本' + ST.period + '区间' + (cur().name) + '从 <b>' + S.f1(trFirst) + '%</b> ' +
      (trUp ? '<span style="color:#2e7d32">改善至</span>' : '<span style="color:#b42335">变化至</span>') +
      ' <b>' + S.f1(trLast) + '%</b>，' + (Math.abs(trDelta) < 0.3 ? '基本持平。' : (trUp ? '整体向好。' : '需关注回落。')) +
      '</div>',
      '按' + ST.period + '查看指标变化');

    /* 异常分布 */
    var abnCaseTotal = 0, abnOrgTotal = 0, abnIndTotal = 0;
    inds().forEach(function (i) {
      var a = S.agg(i.id, fs, cs);
      if (a.den <= 0) return;
      var ab = S.abnCount(i.id, ST.cancer || null, fs);
      abnCaseTotal += ab;
      if (ab > 0) abnOrgTotal++;
      var ok = i.dir === 'down' ? a.value <= i.base : a.value >= i.base;
      if (!ok) abnIndTotal++;
    });
    /* 异常问题类型：按当前指标汇总 */
    var typeMap = {};
    inds().forEach(function (i) {
      S.abnTypes(i.id).forEach(function (t) {
        typeMap[t.type] = (typeMap[t.type] || 0) + t.count;
      });
    });
    var typeData = Object.keys(typeMap).map(function (k) { return { l: k, v: typeMap[k] }; })
      .sort(function (a, b) { return b.v - a.v; });

    var abnCard = U.card('异常分布',
      U.kpis([
        { l: '异常病例数量', v: S.fmt(abnCaseTotal), unit: '例', tone: 'bad', m: '当前筛选范围内判定异常的病例' },
        { l: '异常机构数量', v: S.fmt(abnOrgTotal), unit: '家', tone: 'warn', m: '存在不达标指标或异常病例' },
        { l: '异常指标数量', v: S.fmt(abnIndTotal), unit: '项', tone: 'warn', m: '未达到基准值的质控指标' }
      ], 3) +
      '<div style="margin-top:14px"><div style="font-size:12px;color:#475569;font-weight:600;margin-bottom:6px">异常问题类型分布</div>' +
      U.barChart(typeData, { height: 150, unit: ' 例' }) + '</div>');

    /* 筛选条 */
    var filter = U.filterBar([
      { key: 'year', label: '统计年度', type: 'select', value: ST.year, options: ['2026', '2025', '2024', '2023'] },
      { key: 'city', label: '区域', type: 'select', value: ST.city, options: S.cityOptions() },
      { key: 'org', label: '医疗机构', type: 'select', value: ST.org, options: [{ v: '', l: '全部机构' }].concat(S.orgOptions()) },
      { key: 'cancer', label: '癌种', type: 'select', value: ST.cancer, options: [{ v: '', l: '全部癌种' }].concat(S.cancerOptions()) },
      { key: 'ind', label: '指标', type: 'select', value: ST.ind, options: inds().map(function (i) { return { v: i.id, l: i.name }; }) },
      { key: 'range', label: '时间范围', type: 'select', value: '2026-01 ~ 2026-09', options: ['2026-01 ~ 2026-09', '2026-01 ~ 2026-06', '2025-01 ~ 2025-12'] }
    ], 'l1');

    return '<div class="qc-page">' +
      U.head('诊疗质控总览', '围绕国家肿瘤专业医疗质量控制指标，对不同癌种、不同机构的诊疗质量进行监测、分析和病例追溯。',
        'l1', '① 诊疗过程与单病种质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l1:toData">查看被质控数据</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l1:export">导出数据</button>') +
      filter +
      insightHtml +
      scoreCard +
      '<div style="font-size:13px;font-weight:700;color:#1f2937;margin:0 0 10px">核心指标（'+S.esc(ST.year)+' 年度）</div>' +
      kpiHtml +
      '<div style="height:16px"></div>' +
      matrixCard +
      cancerTable +
      U.card('医疗机构分析', U.table(
        ['医疗机构', '级别', '#病例数', '#指标完成情况', '#异常指标数', '#问题数', '#操作'],
        orgRows, { empty: '暂无数据' }
      ), '按机构查看六项指标完成情况') +
      trendCard +
      abnCard +
      '</div>';
  }

  /* ==================== 页面：指标分析 ==================== */
  function renderDrill() {
    var i = cur(), fs = orgFilter(), cs = cancerFilter();
    var a = S.agg(i.id, fs, cs);
    var y = S.yoy(i.id, fs, cs);
    var abn = S.abnCount(i.id, ST.cancer || null, fs);
    var scope = (ST.city ? S.cityName(ST.city) : ST.org ? S.org(ST.org).name : '全省') + (ST.cancer ? ' · ' + S.cancer(ST.cancer).name : '');
    var pass = S.l1Pass(i.id, a.value);
    var gap = S.l1Gap(i.id, a.value);
    var yoyGood = i.dir === 'down' ? y < 0 : y > 0;

    /* 机构达标差距榜 + 异常主因（分析底座） */
    var orgGaps = S.l1OrgGaps(i.id, cs).filter(function (r) {
      return !fs || fs.indexOf(r.org) >= 0;
    });
    var bd = S.l1AbnBreakdown(i.id, fs);
    var laggards = orgGaps.slice().sort(function (x, z) { return x.gap - z.gap; });
    var failOrgs = laggards.filter(function (r) { return !r.pass; });

    /* —— 结论洞察：这项指标到底怎么样 —— */
    var ins = [];
    ins.push({
      tone: pass ? 'good' : 'bad', icon: pass ? '✓' : '!',
      tt: scope + ' · ' + i.name + ' = ' + S.f1(a.value) + '%（基准 ' + i.base + '%）',
      dd: (pass
        ? '<span class="up">已达标</span>，' + (gap >= 0 ? '优于' : '低于') + '基准 <b>' + S.f1(Math.abs(gap)) + '</b> 个百分点。'
        : '<span class="dn">未达标</span>，距基准差 <b>' + S.f1(Math.abs(gap)) + '</b> 个百分点。') +
        ' 分子 <b>' + S.fmt(a.num) + '</b> / 分母 <b>' + S.fmt(a.den) + '</b>，同比 ' +
        '<span class="' + (yoyGood ? 'up' : 'dn') + '">' + (y >= 0 ? '+' : '') + y + '%</span>（' + (yoyGood ? '向好' : '回落') + '）。'
    });
    if (failOrgs.length) {
      var names = failOrgs.slice(0, 3).map(function (r) { return r.name + '（' + S.f1(r.value) + '%）'; }).join('、');
      ins.push({
        tone: 'warn', icon: '↓',
        tt: '未达标机构 ' + failOrgs.length + ' 家，集中拖累整体水平',
        dd: '差距最大的是 <b>' + names + '</b>' + (failOrgs.length > 3 ? ' 等' : '') +
          '，合计异常病例约 <b>' + S.fmt(failOrgs.reduce(function (s, r) { return s + r.abn; }, 0)) + '</b> 例，建议优先督导。'
      });
    }
    if (bd.top && bd.total > 0) {
      ins.push({
        tone: 'info', icon: '◎',
        tt: '异常主因：' + bd.top.label + '（占 ' + Math.round(bd.top.count / bd.total * 100) + '%）',
        dd: '本指标 <b>' + S.fmt(bd.total) + '</b> 例异常中，' + bd.items.map(function (x) {
          return x.label + ' ' + S.fmt(x.count) + ' 例';
        }).join('、') + '。针对主因'+(bd.top.key === 'miss' ? '应加强字段必填与录入卡控' : bd.top.key === 'time' ? '应核查诊疗时间节点采集口径' : '应完善字段一致性校验规则')+'。'
      });
    }
    var insightHtml = U.insights(ins);

    /* 指标结果 */
    var resultCard = U.card('指标结果',
      U.kpis([
        { l: '当前指标值', v: S.f1(a.value), unit: '%', tone: i.dir === 'down' ? 'info' : (a.value >= i.base ? 'up' : 'warn'), m: '基准值 ' + i.base + '%' },
        { l: '分子', v: S.fmt(a.num), unit: '例', tone: 'info', m: '纳入统计的分子病例数' },
        { l: '分母', v: S.fmt(a.den), unit: '例', tone: 'info', m: '纳入统计的分母病例数' },
        { l: '同期值', v: S.f1(a.value - y), unit: '%', tone: 'info', m: '上一年度同口径' },
        { l: '趋势变化', v: (y >= 0 ? '+' : '') + y, unit: '%', tone: yoyGood ? 'up' : 'warn', m: '与同期相比' },
        { l: '异常病例数', v: S.fmt(abn), unit: '例', tone: 'bad', m: '判定不符合/缺失/异常' }
      ], 3));

    /* 口径拆解卡：把这个指标"算的是什么"讲清楚 */
    var defCard = U.card('指标口径与判定',
      U.kv([
        ['指标定义', S.esc(i.def)],
        ['分子口径', S.esc(i.num)],
        ['分母口径', S.esc(i.den)],
        ['数据来源', S.esc(i.src)],
        ['基准值', i.base + '%（' + (i.dir === 'down' ? '越低越好' : '越高越好') + '）'],
        ['规则版本', S.esc(i.ruleVer)]
      ], 1), '本指标的计算与达标依据');

    /* 机构达标差距榜（标杆 vs 拖后腿），diverging bar */
    var gapCard = U.card('机构达标差距',
      (orgGaps.length
        ? U.divergeBars(laggards.slice(0, 12).map(function (r) {
            return { l: r.name.length > 8 ? r.name.slice(0, 8) + '…' : r.name, gap: r.gap, unit: '%' };
          }))
        : '<div class="qc-empty">当前筛选下暂无机构数据</div>'),
      '相对基准的差距（红=未达标，绿=优于基准）');

    /* 异常原因结构 */
    var bdCard = U.card('异常原因结构',
      (bd.total > 0
        ? U.barChart(bd.items.map(function (x) { return { l: x.label, v: x.count }; }), { height: 150, unit: ' 例' }) +
          '<div style="margin-top:8px;font-size:12px;color:#475569">主因为 <b>' + bd.top.label + '</b>，' +
          '占全部异常的 ' + Math.round(bd.top.count / bd.total * 100) + '%。'
        : '<div class="qc-empty">本指标当前筛选下无异常病例</div>'),
      '共 ' + S.fmt(bd.total) + ' 例异常');

    /* 指标趋势 + 解读 */
    var tr = S.trend(i.id, ST.period, fs, cs);
    var trFirst = tr.length ? tr[0].v : 0, trLast = tr.length ? tr[tr.length - 1].v : 0;
    var trDelta = Math.round((trLast - trFirst) * 100) / 100;
    var trUp = i.dir === 'down' ? trDelta < 0 : trDelta > 0;
    var trendCard = U.card('指标趋势',
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">' +
      '<span style="font-size:12px;color:#667085">当前指标：<b>' + S.esc(i.name) + '</b></span>' +
      '<span class="qc-seg">' + ['月', '季度', '年度'].map(function (p) {
        return '<button class="' + (ST.period === p ? 'on' : '') + '" data-qc="l1:period:' + p + '">' + p + '</button>';
      }).join('') + '</span></div>' +
      U.lineChart(tr) +
      '<div style="margin-top:8px;font-size:12px;color:#475569;line-height:1.6">区间由 <b>' + S.f1(trFirst) +
      '%</b> ' + (trUp ? '<span style="color:#2e7d32">改善至</span>' : '<span style="color:#b42335">变化至</span>') +
      ' <b>' + S.f1(trLast) + '%</b>，' + (Math.abs(trDelta) < 0.3 ? '基本持平。' : trUp ? '整体向好。' : '需关注回落。') + '</div>',
      '按' + ST.period + '查看指标变化');

    /* 维度导航：深度分析入口 */
    var navCard = U.card('维度分析',
      '<div style="font-size:12.5px;color:#64748b;margin-bottom:10px">本指标提供两个深度维度分析，分别查看 10 个癌种与 18 家机构的详细分层情况：</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="btn btn-primary btn-sm" data-qc="l1:toCancer" style="flex:1;min-width:150px">癌种分析</button>' +
      '<button class="btn btn-primary btn-sm" data-qc="l1:toOrg" style="flex:1;min-width:150px">医疗机构分析</button></div>' +
      '<div style="height:6px"></div>' +
      '<div style="font-size:11px;color:#94a3b8">已筛选：' + (ST.org ? S.org(ST.org).name : '全部机构') + ' · ' + (ST.cancer ? S.cancer(ST.cancer).name : '全部癌种') + '</div>',
      '点击进入对应维度详情');

    /* 被质控数据：本指标实际纳入计算的数据范围 */
    var vc = S.verdictCounts(i.id, { orgIds: fs, cancerIds: cs });
    /* 只要当前这一页要显示的条数：完整证据链按页构造，
       total / 页签计数来自病例索引，数字口径不变。 */
    var list = S.cases(i.id, { orgIds: fs, cancerIds: cs, verdict: ST.verdict, limit: ST.listPage * ST.per }).rows;
    var sl = U.slice(list, ST.listPage, ST.per);
    var tabs = [['ALL', '全部数据'], ['ok', '符合'], ['bad', '不符合'], ['miss', '数据缺失'], ['abn', '数据异常']];
    var tabHtml = '<div class="qc-tabs">' + tabs.map(function (t) {
      return '<button class="' + (ST.verdict === t[0] ? 'on' : '') + '" data-qc="l1:verdict:' + t[0] + '">' +
        t[1] + '（' + S.fmt(vc[t[0]] || 0) + '）</button>';
    }).join('') + '</div>';

    var dataRows = sl.rows.map(function (r) {
      var keyData = keyFieldOf(i.id, r);
      return {
        cls: r.v === 'ok' ? '' : 'abn-row',
        cells: [
          { h: U.link(r.name + '（' + r.id + '）', 'l1:case:' + r.key), cls: '' },
          r.orgName,
          r.cancerName,
          keyData,
          { h: U.verdictBadge(r.v) },
          { h: r.v === 'ok' ? '—' : S.esc(r.reason) },
          { h: U.link('病例详情', 'l1:case:' + r.key) }
        ]
      };
    });

    var dataCard = U.card('被质控数据',
      tabHtml +
      U.note('本表是本指标<b>实际纳入计算的全部病例</b>：既包含判定「符合」的病例，也包含判定异常的病例 —— ' +
        '这是"被质控数据"的完整含义。点击患者可下钻至病例详情，查看该指标相关的数据字段与规则判定过程。', true) +
      '<div style="height:10px"></div>' +
      U.table(['患者', '医疗机构', '癌种', '关键诊疗数据', '质控结果', '问题原因', '操作'], dataRows, { compact: true }) +
      U.pager(sl.total, sl.page, ST.per, 'l1'))

    return '<div class="qc-page">' +
      U.head('指标分析 · ' + i.name, '分子 ' + S.fmt(a.num) + ' / 分母 ' + S.fmt(a.den) + '，基准值 ' + i.base + '%', 'l1', '① 诊疗过程与单病种质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l1:back">返回总览</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l1:export">导出数据</button>') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' + inds().map(function (x) {
        return '<button class="btn ' + (x.id === i.id ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-qc="l1:ind:' + x.id + '">' + S.esc(x.short) + '</button>';
      }).join('') + '</div>' +
      insightHtml +
      resultCard +
      U.grid2(defCard, bdCard) +
      gapCard +
      U.grid2(trendCard, navCard) +
      dataCard +
      '</div>';
  }

  /* 列表里的"关键诊疗数据"列：只展示与当前指标有关的字段 */
  function keyFieldOf(indId, r) {
    if (indId === 'NQ-01') return '分期 ' + (r.stageVal || '<span style="color:#b42335">缺失</span>') +
      ' · 评估 ' + (r.stageDate || '—') + ' · 首疗 ' + r.treatDate;
    if (indId === 'NQ-02') return '病理 ' + (r.pathology || '<span style="color:#b42335">缺失</span>') + ' · 报告 ' + r.pathDate + ' · 首疗 ' + r.treatDate;
    if (indId === 'NQ-03') return 'pTNM ' + (r.ptnm || '<span style="color:#b42335">缺失</span>') + ' · 手术 ' + (r.surgDate || '—');
    if (indId === 'NQ-04') return '手术 ' + (r.surgDate || '—') + ' · 死亡 ' + (r.deathDate || '—');
    if (indId === 'NQ-05') return '分子检测 ' + (r.mol || '<span style="color:#b42335">缺失</span>') + ' · 首疗 ' + r.treatDate;
    return '淋巴结 ' + (r.lymph || '<span style="color:#b42335">缺失</span>') + ' 枚 · 手术 ' + (r.surgDate || '—');
  }

  /* ==================== 页面：癌种分析（单指标 × 10 癌种） ==================== */
  function renderCancer() {
    var i = cur(), fs = orgFilter();
    var a = S.agg(i.id, fs, null);
    var bc = S.byCancer(i.id, fs);
    var passCount = bc.filter(function (r) { return r.den > 0 && (i.dir === 'down' ? r.value <= i.base : r.value >= i.base); }).length;
    var failCount = bc.length - passCount;
    var totalAbn = bc.reduce(function (s, r) { return s + r.abn; }, 0);

    var kpiHtml = U.kpis([
      { l: '当前指标值', v: S.f1(a.value), unit: '%', tone: i.dir === 'down' ? 'info' : (a.value >= i.base ? 'up' : 'warn'), m: '基准值 ' + i.base + '%' },
      { l: '已覆盖癌种', v: bc.length, unit: '个', tone: 'info', m: '分子分母均 > 0 的癌种' },
      { l: '达标癌种', v: passCount, unit: '个', tone: passCount >= bc.length * 0.5 ? 'up' : 'warn', m: '指标值达到基准要求' },
      { l: '未达标癌种', v: failCount, unit: '个', tone: failCount > 0 ? 'warn' : 'up', m: '低于基准要求的癌种' },
      { l: '异常病例数', v: S.fmt(totalAbn), unit: '例', tone: 'bad', m: '不符合 / 缺失 / 异常合计' }
    ], 3);

    var detailRows = bc.map(function (r, idx) {
      var style = U.heat(r.value, i.dir, i.base);
      var gap = Math.round((r.value - i.base) * 100) / 100;
      var abnRate = r.den > 0 ? r.abn / r.den * 100 : 0;
      var tone = i.dir === 'down' ? (r.value <= i.base ? 'badge-success' : 'badge-danger') : (r.value >= i.base ? 'badge-success' : 'badge-danger');
      return {
        cells: [
          { h: '<b>' + (idx + 1) + '</b>', cls: 'num' },
          r.name,
          { h: S.fmt(r.den), cls: 'num' },
          { h: S.fmt(r.num), cls: 'num' },
          { h: '<span class="' + tone + '">' + (style ? '<span style="padding:2px 7px;border-radius:4px;' + style + '">' : '') + S.f1(r.value) + '%' + (style ? '</span>' : '') + '</span>', cls: 'num' },
          { h: (gap >= 0 ? '+' : '') + S.f1(gap) + '%', cls: 'num' },
          { h: r.abn > 0 ? '<span style="color:#b42335">' + S.fmt(r.abn) + '</span>' : '0', cls: 'num' },
          { h: '<span class="' + (abnRate > 10 ? 'badge-danger' : 'badge-success') + '">' + S.f1(abnRate) + '%</span>', cls: 'num' },
          { h: U.link('查看被质控数据', 'l1:cancerData:' + r.cancer) }
        ]
      };
    });

    var detailTable = U.table(
      ['#', '癌种', '#病例数', '#分子', '#指标值', '#与基准差值', '#异常病例', '#异常率', '#操作'],
      detailRows, { compact: true });

    /* 排名柱状图 */
    var barCard = U.card('癌种指标值排名',
      U.barChart(bc.map(function (r) { return { l: r.short, v: r.value }; }),
        { height: 200, unit: '%', fmt: function (v) { return S.f1(v) + '%'; } }),
      '按当前指标值从高到低');

    /* 异常类型分布 */
    var types = S.abnTypes(i.id);
    var typeCard = U.card('异常类型分布',
      U.barChart(types.map(function (t) { return { l: t.type, v: t.count }; }),
        { height: 180, fmt: function (v) { return S.fmt(v); } }),
      '按异常原因归类');

    /* 筛选条 */
    var filterBar = U.filterBar([
      { key: 'city', label: '设区市', type: 'select', value: ST.city, options: S.cityOptions() }
    ], 'l1c');

    return '<div class="qc-page">' +
      U.head('癌种分析 · ' + i.name, '单项指标在 10 个癌种上的分层分析：病例数、分子分母、指标值与达标情况', 'l1', '① 诊疗过程与单病种质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l1:backDrill">返回指标分析</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l1:toOrg">医疗机构分析</button>') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' + inds().map(function (x) {
        return '<button class="btn ' + (x.id === i.id ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-qc="l1:cind:' + x.id + '">' + S.esc(x.short) + '</button>';
      }).join('') + '</div>' +
      filterBar +
      kpiHtml +
      detailTable +
      U.grid2(barCard, typeCard) +
      '</div>';
  }

  /* ==================== 页面：医疗机构分析（单指标 × 18 机构） ==================== */
  function renderOrg() {
    var i = cur(), cs = cancerFilter();
    /* 从总览「机构分析」带 ST.org 进来时，自动收敛到该机构所在设区市 */
    if (ST.org && !ST.city) {
      var probe = S.org(ST.org);
      if (probe && probe.city) ST.city = probe.city;
    }
    var cityOrgIds = ST.city
      ? S.ORGS.filter(function (o) { return o.city === ST.city; }).map(function (o) { return o.id; })
      : null;
    var a = S.agg(i.id, cityOrgIds, cs);
    var bo = S.byOrg(i.id, cs).filter(function (r) {
      return !cityOrgIds || cityOrgIds.indexOf(r.org) >= 0;
    });
    var passCount = bo.filter(function (r) { return r.den > 0 && (i.dir === 'down' ? r.value <= i.base : r.value >= i.base); }).length;
    var failCount = bo.length - passCount;
    var totalAbn = bo.reduce(function (s, r) { return s + r.abn; }, 0);

    var kpiHtml = U.kpis([
      { l: '当前指标值', v: S.f1(a.value), unit: '%', tone: i.dir === 'down' ? 'info' : (a.value >= i.base ? 'up' : 'warn'), m: '基准值 ' + i.base + '%' },
      { l: '区域平均', v: S.f1(a.value), unit: '%', tone: 'info', m: '本指标当前筛选范围的合计值' },
      { l: '已覆盖机构', v: bo.length, unit: '家', tone: 'info', m: '纳入统计的医疗机构' },
      { l: '达标机构', v: passCount, unit: '家', tone: passCount >= bo.length * 0.5 ? 'up' : 'warn', m: '指标值达到基准要求' },
      { l: '未达标机构', v: failCount, unit: '家', tone: failCount > 0 ? 'warn' : 'up', m: '低于基准要求' },
      { l: '异常病例数', v: S.fmt(totalAbn), unit: '例', tone: 'bad', m: '不符合 / 缺失 / 异常合计' }
    ], 3);

    /* 按级别（省级/市级）汇总 */
    var levelMap = {};
    bo.forEach(function (r) {
      if (!levelMap[r.level]) levelMap[r.level] = { den: 0, num: 0, count: 0, abn: 0 };
      levelMap[r.level].den += r.den; levelMap[r.level].num += r.num;
      levelMap[r.level].count++; levelMap[r.level].abn += r.abn;
    });
    var levelRows = Object.keys(levelMap).map(function (lv) {
      var d = levelMap[lv];
      var val = d.den > 0 ? Math.round(d.num / d.den * 10000) / 100 : 0;
      return {
        cells: [lv, { h: d.count + ' 家', cls: 'num' }, { h: S.fmt(d.den), cls: 'num' },
          { h: '<span class="badge-info">' + S.f1(val) + '%</span>', cls: 'num' },
          { h: S.fmt(d.abn), cls: 'num' }]
      };
    }).sort(function (a, b) { return b.cells[2].h - a.cells[2].h; });
    var levelCard = U.card('分级汇总', U.table(['级别', '机构数', '#病例数', '指标值', '#异常病例'], levelRows, { compact: true }),
      '按医疗机构级别汇总');

    /* 机构明细表 */
    var detailRows = bo.map(function (r, idx) {
      var style = U.heat(r.value, i.dir, i.base);
      var tone = i.dir === 'down' ? (r.value <= i.base ? 'badge-success' : 'badge-danger') : (r.value >= i.base ? 'badge-success' : 'badge-danger');
      var abnRate = r.den > 0 ? r.abn / r.den * 100 : 0;
      return {
        cells: [
          { h: '<b>' + (idx + 1) + '</b>', cls: 'num' },
          r.orgName,
          r.level,
          { h: S.fmt(r.den), cls: 'num' },
          { h: '<span class="' + tone + '">' + (style ? '<span style="padding:2px 7px;border-radius:4px;' + style + '">' : '') + S.f1(r.value) + '%' + (style ? '</span>' : '') + '</span>', cls: 'num' },
          { h: '<span class="' + (r.gap >= 0 ? 'badge-success' : 'badge-danger') + '">' + (r.gap >= 0 ? '+' : '') + S.f1(r.gap) + '%</span>', cls: 'num' },
          { h: r.abn > 0 ? '<span style="color:#b42335">' + S.fmt(r.abn) + '</span>' : '0', cls: 'num' },
          { h: U.link('查看被质控数据', 'l1:orgData:' + r.org) }
        ]
      };
    });
    var detailTable = U.table(
      ['#', '医疗机构', '级别', '#病例数', '#指标值', '#区域均值', '#异常病例', '#操作'],
      detailRows, { compact: true });

    /* 排名柱状图 */
    var barCard = U.card('机构指标值排名',
      U.barChart(bo.map(function (r) { return { l: r.orgName.length > 6 ? r.orgName.slice(0, 6) + '…' : r.orgName, v: r.value }; }),
        { height: 220, unit: '%', fmt: function (v) { return S.f1(v) + '%'; } }),
      '按当前指标值从高到低');

    /* 筛选条 */
    var filterBar = U.filterBar([
      { key: 'city', label: '设区市', type: 'select', value: ST.city, options: S.cityOptions() },
      { key: 'cancer', label: '癌种', type: 'select', value: ST.cancer, options: [{ v: '', l: '全部癌种' }].concat(S.cancerOptions()) }
    ], 'l1o');

    return '<div class="qc-page">' +
      U.head('医疗机构分析 · ' + i.name, '单项指标在' + bo.length + '家医疗机构上的排名、区域均值与达标情况' +
        (ST.city ? '（' + S.cityName(ST.city) + '）' : '（全省 18 家）'), 'l1', '① 诊疗过程与单病种质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l1:backDrill">返回指标分析</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l1:toCancer">癌种分析</button>') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' + inds().map(function (x) {
        return '<button class="btn ' + (x.id === i.id ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-qc="l1:oind:' + x.id + '">' + S.esc(x.short) + '</button>';
      }).join('') + '</div>' +
      filterBar +
      kpiHtml +
      U.grid2(levelCard, barCard) +
      detailTable +
      '</div>';
  }

  /* ==================== 页面：被质控数据详情 ==================== */
  function findCase() {
    /* 由 caseKey 反查病例：key 形如 "指标|机构|癌种|序号" */
    var parts = String(ST.caseKey).split('|');
    if (parts.length < 4) {
      /* 未指定病例（例如直接从左侧菜单进入本页）：默认取当前指标的样例病例，
         保证页面永远有内容可看，而不是抛出空态。 */
      return S.cases(ST.ind, { limit: 1 }).rows[0] || S.cases(inds()[0].id, { limit: 1 }).rows[0] || null;
    }
    var indId = parts[0];
    /* 病例键里已经带着 指标|机构|癌种|序号，直接定位这一条；
       旧写法是先把整个范围的上万条病例全构造出来再线性找。 */
    return S.caseByKey(indId, ST.caseKey) || S.cases(indId, { limit: 1 }).rows[0] || null;
  }

  function renderMCD() {
    var r = findCase();
    if (!r) {
      return '<div class="qc-page">' + U.head('被质控数据详情', '病例级质控证据', 'l1', '① 诊疗过程与单病种质控') +
        U.card('未找到病例', '<div class="qc-empty">请从「指标分析」页面点击患者进入。</div>') + '</div>';
    }
    var i = S.ind(r.ind);
    var rule = r.rule || S.ruleOf(r.ind, r.v);
    var ok = r.v === 'ok';

    /* 基础信息 */
    var baseCard = U.card('基础信息', U.kv([
      ['患者编号', S.esc(r.id)], ['姓名', S.esc(r.name)],
      ['性别', r.sex], ['年龄', r.age + ' 岁'],
      ['医疗机构', S.esc(r.orgName)], ['科室', S.esc(r.dept)],
      ['癌种', S.esc(r.cancerName)], ['首次诊断时间', r.diagDate],
      ['住院号', S.esc(r.ipNo)], ['病案号', S.esc(r.mrn)]
    ], 3), '与本次质控相关的患者信息');

    /* 诊疗过程时间轴 */
    var tl = [
      { title: '首次诊断', date: r.diagDate, desc: '确诊为' + S.esc(r.cancerName), state: 'ok' },
      { title: '病理诊断', date: r.pathDate, desc: r.pathology ? S.esc(r.pathology) : '<span style="color:#d98b2b">未记录病理结果</span>', state: r.pathology ? 'ok' : 'miss' },
      {
        title: '临床分期评估', date: r.stageDate || '未记录',
        desc: r.stageVal ? '临床分期 ' + S.esc(r.stageVal) : '<span style="color:#d98b2b">分期或评估日期缺失</span>',
        state: r.stageVal && r.stageDate ? 'ok' : 'miss'
      },
      { title: '首次抗肿瘤治疗', date: r.treatDate, desc: '治疗方式：' + (S.seedOf(r.key) % 2 ? '手术治疗' : '药物治疗'), state: 'ok' }
    ];
    if (r.surgDate) tl.push({ title: '手术', date: r.surgDate, desc: '术后病理 pTNM ' + (r.ptnm || '未记录'), state: r.ptnm ? 'ok' : 'miss' });
    if (r.deathDate) tl.push({ title: '死亡', date: r.deathDate, desc: '围手术期死亡', state: 'bad' });
    tl.push({ title: '后续治疗', date: r.nextDate, desc: '按方案继续治疗与随访', state: 'ok' });
    var tlCard = U.card('诊疗过程', U.timeline(tl), '诊断 → 病理 → 分期 → 首次治疗 → 手术/药物治疗 → 后续治疗');

    /* 质控相关数据：只展示与当前指标有关的字段 */
    var relatedFields = relatedDataOf(r);
    var relCard = U.card('质控相关数据',
      U.note('按方案要求，本页<b>只展示与当前指标「' + S.esc(i.name) + '」有关的数据字段</b>，不提供完整病历浏览器。' +
        '需要核查时再展开下方的「标准化数据」与「原始数据」。') +
      '<div style="height:10px"></div>' +
      U.table(['数据项', '数据值', '数据来源'],
        relatedFields.map(function (f) {
          return { cells: [f[0], { h: f[1] }, f[2]] };
        }), { compact: true }));

    /* 规则判定 */
    var actualHtml = '<div>' + relatedFields.slice(0, 3).map(function (f) {
      return '<div style="font-size:12.5px;line-height:1.7">· <b>' + S.esc(f[0]) + '</b>：' + f[1] + '</div>';
    }).join('') + '</div>';
    var judgeCard = U.card('规则判定',
      U.judgeBlock(rule, actualHtml, r.verdictText, r.v === 'ok' ? '' : r.reason) +
      '<div style="height:12px"></div>' +
      U.note(ok
        ? '本病例符合质控规则要求，判定为「符合」，无需整改。'
        : '本病例判定为「' + r.verdictText + '」，原因：<b>' + S.esc(r.reason) + '</b>。' +
          '可点击下方「纳入整改」将本问题推送至质控问题中心。', !ok));

    /* 原始数据追溯：数据来源 → 原始字段 → 原始值 → 标准化字段 → 入库值 */
    var originRows = relatedFields.map(function (f) {
      var raw = rawOf(f[0], r);
      return {
        cells: [
          f[2], f[0],
          { h: raw.raw === '' ? '<span style="color:#b42335">（空）</span>' : S.esc(raw.raw) },
          raw.std.field,
          { h: raw.std.value === '' ? '<span style="color:#b42335">（空）</span>' : S.esc(raw.std.value) },
          { h: raw.raw !== raw.std.value ? U.badge('已标准化', 'info') : U.badge('原值入库', 'neutral') }
        ]
      };
    });
    var originCard = U.card('原始数据追溯',
      U.table(['数据来源', '原始字段', '原始值', '标准化字段', '入库值', '处理'], originRows, { compact: true }) +
      U.note('分层原则：默认展示「质控相关数据」；核查时展开「标准化数据」与「原始数据」。' +
        '原始数据来自各业务系统的字段级快照，标准化结果由映射规则产生。', true));

    /* 分层展示：质控相关数据 → 标准化数据 → 原始数据 */
    var layerCard = U.card('数据分层追溯',
      U.layerBlock('① 质控相关数据', '默认展示，仅含本指标相关字段',
        '<div style="padding:12px 14px">' + U.table(['数据项', '数据值'], relatedFields.map(function (f) {
          return { cells: [f[0], { h: f[1] }] };
        }), { compact: true }) + '</div>', false, 'qc-mcd-l1') +
      U.layerBlock('② 标准化数据', '经字典映射与格式规范后的标准值',
        '<div style="padding:12px 14px">' + U.table(['标准字段', '标准值', '映射规则'], relatedFields.map(function (f) {
          var raw = rawOf(f[0], r);
          return { cells: [raw.std.field, { h: raw.std.value || '（空）' }, raw.std.rule] };
        }), { compact: true }) + '</div>', true, 'qc-mcd-l2') +
      U.layerBlock('③ 原始数据', '源系统字段级快照，未经加工',
        '<div style="padding:12px 14px">' + U.table(['来源系统', '原始字段', '原始值', '采集时间'], relatedFields.map(function (f) {
          var raw = rawOf(f[0], r);
          return { cells: [f[2], raw.rawField, { h: raw.raw === '' ? '（空）' : S.esc(raw.raw) }, raw.time] };
        }), { compact: true }) + '</div>', true, 'qc-mcd-l3'),
      '质控相关数据 → 标准化数据 → 原始数据')

    /* 操作 */
    var actions = '<button class="btn btn-ghost btn-sm" data-qc="l1:origin">查看原始数据</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="l1:mark">标记质控问题</button>' +
      '<button class="btn btn-primary btn-sm" data-qc="l1:toFix">纳入整改</button>';

    return '<div class="qc-page">' +
      U.head('被质控数据详情', i.name + ' · ' + r.orgName, 'l1', '① 诊疗过程与单病种质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l1:backList">返回列表</button>' + actions) +
      baseCard +
      tlCard +
      relCard +
      judgeCard +
      layerCard +
      originCard +
      '</div>';
  }

  /* 与指标相关的数据字段（按指标裁剪，不做全病历展示） */
  function relatedDataOf(r) {
    var src = '云健康';
    if (r.ind === 'NQ-01') {
      return [
        ['初次诊断日期', r.diagDate, src],
        ['临床分期', r.stageVal ? S.esc(r.stageVal) : '<span style="color:#b42335">（空）</span>', src],
        ['分期评估日期', r.stageDate ? r.stageDate : '<span style="color:#b42335">（空）</span>', src],
        ['首次治疗日期', r.treatDate, src]
      ];
    }
    if (r.ind === 'NQ-02') {
      return [
        ['首次治疗日期', r.treatDate, src],
        ['治疗方式', '非手术治疗', src],
        ['病理诊断', r.pathology ? S.esc(r.pathology) : '<span style="color:#b42335">（空）</span>', '病理系统'],
        ['病理报告日期', r.pathDate, '病理系统']
      ];
    }
    if (r.ind === 'NQ-03') {
      return [
        ['手术日期', r.surgDate || '—', src],
        ['术后病理 pTNM', r.ptnm ? S.esc(r.ptnm) : '<span style="color:#b42335">（空）</span>', '病理系统'],
        ['病理诊断', r.pathology, '病理系统'],
        ['淋巴结检出数', r.lymph + ' 枚', '病理系统']
      ];
    }
    if (r.ind === 'NQ-04') {
      return [
        ['手术日期', r.surgDate || '—', src],
        ['出院去向', r.deathDate ? '死亡' : '好转/其他', src],
        ['死亡日期', r.deathDate || '—', '死因监测'],
        ['术后天数', r.deathDate && r.surgDate ? S.dayDiff(r.surgDate, r.deathDate) + ' 天' : '—', src]
      ];
    }
    if (r.ind === 'NQ-05') {
      return [
        ['首次用药日期', r.treatDate, src],
        ['分子病理检测结果', r.mol ? S.esc(r.mol) : '<span style="color:#b42335">（空）</span>', '分子病理实验室'],
        ['检测报告日期', r.pathDate, '分子病理实验室'],
        ['治疗方式', '靶向/免疫治疗', src]
      ];
    }
    return [
      ['手术日期', r.surgDate || '—', src],
      ['淋巴结清扫数目', r.lymph ? r.lymph + ' 枚' : '<span style="color:#b42335">（空）</span>', '手术记录'],
      ['病理检出淋巴结数', r.lymph || '—', '病理系统'],
      ['手术方式', '根治性手术', src]
    ];
  }

  /* 原始值 / 标准化值的对照（原始数据追溯用） */
  function rawOf(fieldName, r) {
    var map = {
      '初次诊断日期': { raw: r.diagDate.replace(/-/g, '/'), field: 'DIAG_DATE', rule: '日期格式标准化 YYYY-MM-DD' },
      '临床分期': { raw: r.stageVal || '', field: 'CLINICAL_STAGE', rule: 'AJCC 第 8 版分期值域' },
      '分期评估日期': { raw: r.stageDate ? r.stageDate.replace(/-/g, '/') : '', field: 'STAGE_DATE', rule: '日期格式标准化 YYYY-MM-DD' },
      '首次治疗日期': { raw: r.treatDate.replace(/-/g, '/'), field: 'FIRST_TREAT_DATE', rule: '日期格式标准化 YYYY-MM-DD' },
      '病理诊断': { raw: r.pathology || '', field: 'PATH_DIAG', rule: '病理术语规范库 → ICD-O-3' },
      '病理报告日期': { raw: r.pathDate.replace(/-/g, '/'), field: 'PATH_REPORT_DATE', rule: '日期格式标准化 YYYY-MM-DD' },
      '术后病理 pTNM': { raw: r.ptnm || '', field: 'PTNM', rule: 'AJCC 第 8 版 pTNM 组合校验' },
      '淋巴结检出数': { raw: r.lymph || '', field: 'LYMPH_NODES', rule: '数值字段类型校验' },
      '淋巴结清扫数目': { raw: r.lymph || '', field: 'LYMPH_DISSECT', rule: '数值字段类型校验' },
      '手术日期': { raw: (r.surgDate || '').replace(/-/g, '/'), field: 'SURG_DATE', rule: '日期格式标准化 YYYY-MM-DD' },
      '出院去向': { raw: r.deathDate ? '5' : '1', field: 'DISCHARGE_TO', rule: '出院去向代码表' },
      '死亡日期': { raw: (r.deathDate || '').replace(/-/g, '/'), field: 'DEATH_DATE', rule: '日期格式标准化 YYYY-MM-DD' },
      '分子病理检测结果': { raw: r.mol || '', field: 'MOLECULAR_RESULT', rule: '分子检测结果值域' },
      '检测报告日期': { raw: r.pathDate.replace(/-/g, '/'), field: 'MOL_REPORT_DATE', rule: '日期格式标准化 YYYY-MM-DD' },
      '治疗方式': { raw: '2', field: 'TREAT_TYPE', rule: '治疗方式代码表' },
      '手术方式': { raw: '1', field: 'SURG_TYPE', rule: '手术方式代码表' },
      '病理检出淋巴结数': { raw: r.lymph || '', field: 'PATH_LYMPH', rule: '数值字段类型校验' }
    };
    var m = map[fieldName] || { raw: '—', field: fieldName, rule: '通用标准化' };
    var rawVal = m.raw, stdVal = m.raw;
    /* 回填标准化值：取页面上展示的标准值 */
    var related = relatedDataOf(r);
    for (var k = 0; k < related.length; k++) {
      if (related[k][0] === fieldName) {
        var html = String(related[k][1]);
        stdVal = html.replace(/<[^>]+>/g, '').replace(/（空）/g, '').replace(/\s*枚$/, '').trim();
        break;
      }
    }
    return {
      raw: rawVal, rawField: m.field,
      time: r.diagDate + ' 08:00',
      std: { field: m.field, value: stdVal, rule: m.rule }
    };
  }

  /* ==================== 路由 ==================== */
  function render(pageId) {
    if (pageId === 'qc-g-dtx') pageId = 'qc-natl-overview';
    if (pageId === 'qc-natl-overview') return renderOverview();
    if (pageId === 'qc-natl-drill') return renderDrill();
    if (pageId === 'qc-natl-cancer') return renderCancer();
    if (pageId === 'qc-natl-org') return renderOrg();
    if (pageId === 'qc-mcd-dtx') return renderMCD();
    return null;
  }

  /* ==================== 交互 ==================== */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-qc]') : null;
    if (!el) return;
    var a = el.getAttribute('data-qc');
    if (a.indexOf('l1:') !== 0 && a.indexOf('filter:') !== 0) return;
    if (a.indexOf('filter:') === 0 && a.indexOf('l1') < 0) return;

    /* 筛选（统一入口：支持 overview / 癌种分析 / 医疗机构分析的筛选条） */
    if (a.indexOf('filter:') === 0) {
      if (a.indexOf('reset') > 0) { ST.city = ''; ST.org = ''; ST.cancer = ''; }
      else {
        var box = el.closest('.qc-filter');
        var reads = box ? box.querySelectorAll('[data-qcf]') : [];
        for (var k = 0; k < reads.length; k++) {
          var kk = reads[k].getAttribute('data-qcf');
          var vv = reads[k].value;
          if (kk === 'range') continue;
          ST[kk] = vv === '全部' ? '' : vv;
        }
      }
      var target = 'qc-natl-overview';
      if (a.indexOf(':l1c') > 0) target = 'qc-natl-cancer';
      else if (a.indexOf(':l1o') > 0) target = 'qc-natl-org';
      ST.page = 1; ST.listPage = 1;
      window.renderPage(target);
      return;
    }
    if (a.indexOf('l1:ind:') === 0) { ST.ind = a.split(':')[2]; ST.listPage = 1; ST.verdict = 'ALL'; window.navigateTo('qc-natl-drill'); return; }
    if (a.indexOf('l1:cind:') === 0) { ST.ind = a.split(':')[2]; ST.listPage = 1; window.navigateTo('qc-natl-cancer'); return; }
    if (a.indexOf('l1:oind:') === 0) { ST.ind = a.split(':')[2]; ST.listPage = 1; window.navigateTo('qc-natl-org'); return; }
    if (a === 'l1:back') { window.navigateTo('qc-natl-overview'); return; }
    if (a === 'l1:backDrill') { window.navigateTo('qc-natl-drill'); return; }
    if (a === 'l1:toData') { ST.verdict = 'ALL'; ST.listPage = 1; window.navigateTo('qc-natl-drill'); return; }
    if (a === 'l1:toCancer') { window.navigateTo('qc-natl-cancer'); return; }
    if (a === 'l1:toOrg') { window.navigateTo('qc-natl-org'); return; }
    if (a.indexOf('l1:period:') === 0) { ST.period = a.split(':')[2]; window.renderPage('qc-natl-overview'); return; }
    if (a.indexOf('l1:orgDrill:') === 0) { ST.org = a.split(':')[2]; ST.page = 1; window.navigateTo('qc-natl-org'); return; }
    /* 热力矩阵单元格下钻：l1:mtx:<indId>:<cityCode> → 该市该指标的指标分析 */
    if (a.indexOf('l1:mtx:') === 0) {
      var mp = a.split(':'); ST.ind = mp[2]; ST.city = mp[3]; ST.org = '';
      ST.listPage = 1; ST.verdict = 'ALL'; window.navigateTo('qc-natl-drill'); return;
    }
    if (a === 'l1:export') { U.toast('已按当前筛选条件导出数据（演示）'); return; }

    /* 从癌种/机构下钻到被质控数据 */
    if (a.indexOf('l1:cancerData:') === 0) { ST.cancer = a.split(':')[2]; ST.listPage = 1; ST.verdict = 'ALL'; window.navigateTo('qc-natl-drill'); return; }
    if (a.indexOf('l1:orgData:') === 0) { ST.org = a.split(':')[2]; ST.listPage = 1; ST.verdict = 'ALL'; window.navigateTo('qc-natl-drill'); return; }

    /* 被质控数据列表 */
    if (a.indexOf('l1:verdict:') === 0) { ST.verdict = a.split(':')[2]; ST.listPage = 1; window.renderPage('qc-natl-drill'); return; }
    if (a.indexOf('l1:page:') === 0) { ST.listPage = parseInt(a.split(':')[2], 10) || 1; window.renderPage('qc-natl-drill'); return; }

    /* 病例详情 */
    if (a.indexOf('l1:case:') === 0) { ST.caseKey = a.slice('l1:case:'.length); ST.fromPage = 'qc-natl-drill'; window.navigateTo('qc-mcd-dtx'); return; }
    if (a === 'l1:backList') { window.navigateTo('qc-natl-drill'); return; }

    /* 详情页操作 */
    if (a === 'l1:origin') {
      var r = findCase();
      if (!r) return;
      var rows = relatedDataOf(r).map(function (f) {
        var rw = rawOf(f[0], r);
        return '<tr><td class="txt">' + S.esc(f[2]) + '</td><td class="mono">' + S.esc(rw.rawField) + '</td><td class="mono">' +
          (rw.raw === '' ? '<span style="color:#b42335">（空）</span>' : S.esc(rw.raw)) + '</td></tr>';
      }).join('');
      U.modal('原始数据追溯 · ' + r.name, '<div class="qc-tw"><table class="qc-tbl compact"><thead><tr>' +
        '<th class="txt">来源系统</th><th class="txt">原始字段</th><th class="txt">原始值</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        U.note('原始值为源系统字段级快照，未做任何加工；标准化结果见详情页「标准化数据」层。', true));
      return;
    }
    if (a === 'l1:mark') { U.toast('已标记质控问题（演示）'); return; }
    if (a === 'l1:toFix') {
      var c = findCase();
      if (c) U.toast('已将「' + c.name + ' · ' + (c.reason || '质控问题') + '」纳入整改任务');
      return;
    }
    if (a === 'layer:toggle') {
      var box2 = el.closest('.qc-layer');
      if (box2) {
        box2.classList.toggle('collapsed');
        var ar = box2.querySelector('.ar');
        if (ar) ar.textContent = box2.classList.contains('collapsed') ? '展开 ▾' : '收起 ▴';
      }
      return;
    }
  });

  window.qcL1 = {
    pageIds: ['qc-g-dtx', 'qc-natl-overview', 'qc-natl-drill', 'qc-natl-cancer', 'qc-natl-org', 'qc-mcd-dtx'],
    render: render,
    meta: PAGE_META,
    state: ST
  };
})();
