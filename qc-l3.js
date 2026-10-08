/* ============================================================================
 * qc-l3.js — ③ 登记与随访数据质控
 *
 * 页面：登记质控总览 / 登记质量分析 / 随访质控 / 被质控数据详情
 * 面向区域肿瘤登记及随访工作，评价登记数据的完整性、有效性和随访更新情况。
 *
 * 下钻链路：
 *   登记质控总览 → 登记质量分析（省→市→区县）→ 被质控数据 → 病例详情
 * ========================================================================== */
(function () {
  'use strict';

  var S = window.qcSpine, U = window.qcUI;

  var PAGE_META = {
    'qc-l3-registry': { label: '登记质控总览', sub: 'MV% / DCO% / M/I 等登记质量核心指标' },
    'qc-reg-analysis': { label: '登记质量分析', sub: '省 → 市 → 区县逐级查看登记质量' },
    'qc-l3-org': { label: '登记机构质量', sub: '单项登记指标在各区县登记处上的排名与达标' },
    'qc-reg-followup': { label: '随访质控', sub: '随访完成情况、生存状态与死亡信息比对' },
    'qc-mcd-reg': { label: '被质控数据详情', sub: '登记与随访数据的质控判定与追溯' }
  };

  var ST = {
    year: '2026', city: '', county: '', org: '', ind: 'MV', cancer: '',
    page: 1, per: 20, level: 'city',
    caseKey: '', fromPage: 'qc-reg-analysis'
  };

  function cur() { return S.l3Ind(ST.ind) || S.L3_IND[0]; }
  function isRatio() { return ST.ind === 'MI'; }
  /* 数值展示：M/I 是比值（两位小数），其余指标是百分数。
     汇总一律走 S.l3ValueOf，避免把 0.62 的比值误乘 100 变成 62。 */
  function fmtVal(v) { return isRatio() ? (Math.round(v * 100) / 100).toFixed(2) : S.f1(v) + '%'; }
  function aggVal(num, den) { return S.l3ValueOf(ST.ind, num, den); }

  /* ==================== 页面：登记质控总览 ==================== */
  function renderOverview() {
    /* 六项核心指标。达标判定统一走 S.l3Pass（口径取自预警引擎 + IARC CI5），
       KPI 说明里显式标注达标线与依据，避免与预警页双标。 */
    var kpiHtml = U.kpis(S.L3_IND.map(function (d) {
      var a = S.l3Agg(d.id);
      var pass = S.l3Pass(d.id, a.value);           /* true/false/null */
      var inRange = S.l3InRange(d.id, a.value);     /* M/I 用 */
      var tone = d.id === 'MI'
        ? (inRange === false ? 'warn' : 'info')
        : (pass === false ? 'warn' : pass === true ? 'up' : 'info');
      var line = d.id === 'MI'
        ? '参考区间 ' + d.refLow + '~' + d.refHigh
        : (d.dir === 'down' ? '达标线 ≤' + d.pass + '%' : '达标线 ≥' + d.pass + '%');
      return {
        l: d.name, v: d.id === 'MI' ? (Math.round(a.value * 100) / 100).toFixed(2) : S.f1(a.value),
        unit: d.id === 'MI' ? '' : '%',
        tone: tone,
        m: '分子 <b>' + S.fmt(a.num) + '</b> / 分母 <b>' + S.fmt(a.den) + '</b> · <span title="' + S.esc(d.basis) + '" style="cursor:help;border-bottom:1px dotted #94a3b8">' + line + ' ⓘ</span>',
        action: 'l3:ind:' + d.id
      };
    }), 3);

    /* 区域分析：区县表 */
    var cl = S.countyList(ST.ind);
    if (ST.city) cl = cl.filter(function (x) { return x.city === ST.city; });
    var regionAgg = {};
    cl.forEach(function (x) {
      regionAgg[x.city] = regionAgg[x.city] || { den: 0, num: 0, values: [] };
      regionAgg[x.city].den += x.den; regionAgg[x.city].num += x.num;
      regionAgg[x.city].values.push(x.value);
    });

    var regionRows = Object.keys(regionAgg).map(function (code) {
      var g = regionAgg[code];
      var v = aggVal(g.num, g.den);
      var ubCell = S.cityCell('UB', code);
      var dcoCell = S.cityCell('DCO', code);
      var mvCell = S.cityCell('MV', code);
      var miCell = S.cityCell('MI', code);
      return {
        cells: [
          S.cityName(code),
          { h: S.fmt(g.den), cls: 'num' },
          { h: S.f1(mvCell.value) + '%', cls: 'num' },
          { h: '<span style="padding:2px 7px;border-radius:4px;' + U.heat(dcoCell.value, 'down', 3.4) + '">' + S.f1(dcoCell.value) + '%</span>', cls: 'num' },
          { h: (Math.round(miCell.value * 100) / 100).toFixed(2), cls: 'num' },
          { h: S.f1(ubCell.value) + '%', cls: 'num' },
          { h: U.link('查看区县', 'l3:city:' + code) }
        ]
      };
    }).sort(function (a, b) { return parseFloat(b.cells[4].h) - parseFloat(a.cells[4].h); });

    var regionCard = U.card('区域分析', U.table(
      ['设区市', '#病例数', '#MV%', '#DCO%', '#M/I', '#部位不明率', '#操作'], regionRows, { empty: '暂无数据' }
    ), '点击可逐级下钻至区县');

    /* 癌种分析 */
    var bc = S.l3ByCancer(ST.ind);
    var cancerCard = U.card('癌种分析', U.table(
      ['癌种', '#病例数', '#MV%', '#DCO%', '#M/I', '#异常数', '#操作'],
      bc.map(function (r) {
        var mv = S.l3ByCancer('MV').filter(function (x) { return x.cancer === r.cancer; })[0] || { value: 0 };
        var dco = S.l3ByCancer('DCO').filter(function (x) { return x.cancer === r.cancer; })[0] || { value: 0 };
        var mi = S.l3ByCancer('MI').filter(function (x) { return x.cancer === r.cancer; })[0] || { value: 0 };
        return {
          cells: [
            r.name,
            { h: S.fmt(r.den), cls: 'num' },
            { h: S.f1(mv.value) + '%', cls: 'num' },
            { h: S.f1(dco.value) + '%', cls: 'num' },
            { h: (Math.round(mi.value * 100) / 100).toFixed(2), cls: 'num' },
            { h: S.fmt(r.abn), cls: 'num' },
            { h: U.link('查看被质控数据', 'l3:cancer:' + r.cancer) }
          ]
        };
      }), '按癌种拆分登记质量'), 'MV% / DCO% / M/I');

    /* 趋势分析 */
    var tr = ['2021', '2022', '2023', '2024', '2025', '2026'].map(function (y, idx) {
      var base = cur().base;
      var step = idx * (cur().dir === 'down' ? -0.16 : 0.9);
      return { l: y, v: Math.round(S.clamp(base + step + (S.rnd01('l3tr|' + ST.ind + '|' + y) - 0.5) * 1.4, 0.1, 99) * 100) / 100 };
    });
    var trendCard = U.card('趋势分析', U.lineChart(tr), '按年度查看登记质量变化');

    /* 被质控数据 */
    var cases = regFiltered();
    var sl = U.slice(cases, ST.page, ST.per);
    var dataCard = U.card('被质控数据',
      U.table(['患者', '癌种', '登记机构', '诊断信息', '死亡信息', '随访状态', '质控结果', '操作'],
        sl.rows.map(function (r) {
          return {
            cls: r.v === 'ok' ? '' : 'abn-row',
            cells: [
              { h: U.link(r.name + '（' + r.id + '）', 'l3:case:' + r.key) },
              r.cancerName,
              r.county + '登记处',
              r.diagDate + ' · ' + r.basis,
              r.deathDate ? r.deathDate + ' · ' + r.deathCause : '—',
              r.survive + (r.fuDate ? '（' + r.fuDate + '）' : '（未随访）'),
              { h: U.verdictBadge(r.v) },
              { h: U.link('病例详情', 'l3:case:' + r.key) }
            ]
          };
        }), { compact: true }) +
      U.pager(sl.total, sl.page, ST.per, 'l3'),
      '指标对应的病例范围，含登记、死亡与随访状态');

    var filter = U.filterBar([
      { key: 'year', label: '统计年度', type: 'select', value: ST.year, options: ['2026', '2025', '2024'] },
      { key: 'city', label: '设区市', type: 'select', value: ST.city, options: S.cityOptions() },
      { key: 'ind', label: '质量指标', type: 'select', value: ST.ind, options: S.L3_IND.map(function (d) { return { v: d.id, l: d.name }; }) },
      { key: 'cancer', label: '癌种', type: 'select', value: ST.cancer, options: [{ v: '', l: '全部癌种' }].concat(S.cancerOptions()) }
    ], 'l3');

    return '<div class="qc-page">' +
      U.head('登记质控总览', '面向区域肿瘤登记及随访工作，评价登记数据的完整性、有效性和随访更新情况。',
        'l3', '③ 登记与随访数据质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l3:toAnalysis">登记质量分析</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l3:toOrg">登记机构质量</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l3:toFollowup">随访质控</button>') +
      filter +
      '<div style="font-size:13px;font-weight:700;color:#1f2937;margin:0 0 10px">核心指标</div>' +
      kpiHtml +
      U.note('说明：MV%（形态学确诊比例）、DCO%（仅死亡证明比例）、M/I（死亡发病比）为国际通用登记质量口径。' +
        '点击任一指标可查看对应的<b>被质控病例范围</b>。') +
      '<div style="height:16px"></div>' +
      regionCard +
      U.grid2(cancerCard, trendCard) +
      dataCard +
      '</div>';
  }

  /* 登记病例筛选 */
  function regFiltered() {
    var list = S.regCases({ limit: 200, salt: ST.ind });
    if (ST.city) {
      var ct = S.CITIES.filter(function (c) { return c.code === ST.city; })[0];
      if (ct) list = list.filter(function (r) { return r.city === ST.city; });
    }
    if (ST.county) list = list.filter(function (r) { return r.county === ST.county; });
    if (ST.cancer) list = list.filter(function (r) { return r.cancer === ST.cancer; });
    /* 按当前指标筛选出相关病例 */
    var related = {
      MV: function (r) { return r.basis !== '组织学确诊' || r.v !== 'ok'; },
      DCO: function (r) { return r.basis === '仅死亡证明'; },
      MI: function () { return true; },
      UB: function (r) { return r.siteCode === 'C80'; },
      COMP: function (r) { return r.v !== 'ok'; },
      SURV: function (r) { return !r.fuDate || r.v === 'abn'; }
    }[ST.ind];
    if (related) list = list.filter(related);
    return list;
  }

  /* ==================== 页面：登记质量分析 ==================== */
  function renderAnalysis() {
    var cl = S.countyList(ST.ind);

    /* 省级汇总 */
    var provDen = 0, provNum = 0;
    cl.forEach(function (x) { provDen += x.den; provNum += x.num; });
    var provVal = aggVal(provNum, provDen);

    /* 市级列表 */
    var cityRows = S.CITIES.map(function (ct) {
      var c = S.cityCell(ST.ind, ct.code);
      var dco = S.cityCell('DCO', ct.code);
      var mv = S.cityCell('MV', ct.code);
      return {
        cls: (isRatio() ? c.value > cur().base * 1.3 : (cur().dir === 'down' ? c.value > cur().base * 1.3 : c.value < cur().base - 4)) ? 'abn-row' : '',
        cells: [
          { h: U.link(ct.name, 'l3:city:' + ct.code) },
          { h: S.fmt(c.den), cls: 'num' },
          { h: fmtVal(c.value), cls: 'num' },
          { h: S.f1(mv.value) + '%', cls: 'num' },
          { h: S.f1(dco.value) + '%', cls: 'num' },
          { h: S.fmt(ct.counties.length) + ' 个区县', cls: 'num' },
          { h: U.link('查看区县', 'l3:city:' + ct.code) }
        ]
      };
    });

    /* 区县列表（选中市或全部） */
    var countyRows = cl.filter(function (x) { return !ST.city || x.city === ST.city; }).map(function (x) {
      return {
        cells: [
          S.cityName(x.city), x.county,
          { h: S.fmt(x.den), cls: 'num' },
          { h: fmtVal(x.value), cls: 'num' },
          { h: Math.abs(x.value - cur().base) > (isRatio() ? 0.3 : 8) ? U.badge('偏离较大', 'caution') : U.badge('正常', 'success') },
          { h: U.link('查看被质控数据', 'l3:county:' + x.city + ':' + x.county) }
        ]
      };
    });

    /* 医疗机构分析 */
    var orgRows = S.ORGS.map(function (o) {
      var den = 0, num = 0;
      S.L3_IND.forEach(function (d) {
        var cells = S.countyList(d.id);
        var v = S.rnd01('l3org|' + d.id + '|' + o.id);
        den += 200; num += Math.round(v * 200);
      });
      var v = den ? num / den * 100 : 0;
      return {
        cells: [
          o.name, o.level,
          { h: S.fmt(den), cls: 'num' },
          { h: S.f1(v) + '%', cls: 'num' },
          { h: S.fmt(Math.round(den * (100 - v) / 100)), cls: 'num' },
          { h: U.link('查看被质控数据', 'l3:org:' + o.id) }
        ]
      };
    }).filter(function (r) { return parseFloat(r.cells[2].h.replace(/,/g, '')) > 0; });

    /* 癌种分析 */
    var cancerCard = U.card('癌种分析', U.table(
      ['癌种', '#病例数', '#质量指标', '#异常数量', '#操作'],
      S.l3ByCancer(ST.ind).map(function (r) {
        return {
          cells: [
            r.name,
            { h: S.fmt(r.den), cls: 'num' },
            { h: fmtVal(r.value), cls: 'num' },
            { h: S.fmt(r.abn), cls: 'num' },
            { h: U.link('查看被质控数据', 'l3:cancer:' + r.cancer) }
          ]
        };
      }), '按癌种拆分'));

    return '<div class="qc-page">' +
      U.head('登记质量分析', '按照 省 → 市 → 区县 逐级查看登记质量，并可下钻至具体病例。',
        'l3', '③ 登记与随访数据质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l3:back">返回总览</button>') +
      /* 层级导航 */
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">' +
      '<span style="font-size:12px;color:#667085">当前层级：</span>' +
      '<button class="btn ' + (!ST.city ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-qc="l3:level:province">江西省（省）</button>' +
      (ST.city ? '<span style="color:#94a3b8">▸</span><button class="btn btn-primary btn-sm">' + S.cityName(ST.city) + '（市）</button>' : '') +
      (ST.county ? '<span style="color:#94a3b8">▸</span><button class="btn btn-primary btn-sm">' + ST.county + '（区县）</button>' : '') +
      '<span style="margin-left:auto" class="qc-seg">' +
      S.L3_IND.map(function (d) { return '<button class="' + (ST.ind === d.id ? 'on' : '') + '" data-qc="l3:ind2:' + d.id + '">' + d.id + '</button>'; }).join('') +
      '</span></div>' +
      U.kpis([
        { l: '省级' + cur().name, v: isRatio() ? (Math.round(provVal * 100) / 100).toFixed(2) : S.f1(provVal), unit: isRatio() ? '' : '%', tone: 'info', m: '全省合计' },
        { l: '覆盖设区市', v: String(S.CITIES.length), unit: '个', tone: 'info', m: '11 个设区市全覆盖' },
        { l: '覆盖区县', v: String(cl.length ? new Set(cl.map(function (x) { return x.county; })).size : 0), unit: '个', tone: 'info', m: '登记点' }
      ], 3) +
      U.card('市级登记质量', U.table(
        ['设区市', '#病例数', '#质量指标', '#MV%', '#DCO%', '#下辖', '#操作'], cityRows, { empty: '暂无数据' }
      ), '点击市名可下钻至区县') +
      U.card((ST.city ? S.cityName(ST.city) + ' · ' : '') + '区县登记质量', U.table(
        ['设区市', '区县', '#病例数', '#质量指标', '#评价', '#操作'], countyRows, { empty: '暂无数据' }
      ), '省 → 市 → 区县逐级下钻') +
      U.grid2(orgCard(), cancerCard) +
      '</div>';
  }
  function orgCard() {
    return U.card('医疗机构分析', U.table(
      ['医疗机构', '级别', '#病例数', '#登记质量指标', '#异常数', '#操作'],
      S.ORGS.slice(0, 12).map(function (o) {
        var v = S.clamp(cur().base + (S.rnd01('l3ov|' + ST.ind + '|' + o.id) - 0.5) * 12, 40, 99);
        var den = 1200 + S.rndInt('l3od|' + o.id, 0, 1800);
        return {
          cells: [
            o.name, o.level,
            { h: S.fmt(den), cls: 'num' },
            { h: S.f1(v) + (isRatio() ? '' : '%'), cls: 'num' },
            { h: S.fmt(Math.round(den * (100 - v) / 100)), cls: 'num' },
            { h: U.link('查看被质控数据', 'l3:org:' + o.id) }
          ]
        };
      }), '按机构查看登记质量与异常数'));
  }

  /* ==================== 页面：随访质控 ==================== */
  function renderFollowup() {
    var fs = S.followupStat();

    var kpiHtml = U.kpis([
      { l: '应随访病例数', v: S.fmt(fs.should), unit: '例', tone: 'info', m: '登记后进入随访周期' },
      { l: '已随访', v: S.fmt(fs.done), unit: '例', tone: 'up', m: '随访完成率 ' + S.f1(fs.rate) + '%' },
      { l: '待随访', v: S.fmt(fs.pending), unit: '例', tone: 'warn', m: '未到随访时点或待执行' },
      { l: '失访', v: S.fmt(fs.lost), unit: '例', tone: 'bad', m: '失访率 ' + S.f1(fs.lostRate) + '%' },
      { l: '生存状态未知', v: S.fmt(fs.unknown), unit: '例', tone: 'warn', m: '已随访但状态不详' }
    ], 5);

    /* 生存状态 */
    var survCard = U.card('生存状态', U.kpis([
      { l: '存活', v: S.fmt(fs.alive), unit: '例', tone: 'up', m: '含无病生存与带瘤生存' },
      { l: '死亡', v: S.fmt(fs.dead), unit: '例', tone: 'info', m: '登记死亡并完成死因核对' },
      { l: '不详', v: S.fmt(fs.unknown2), unit: '例', tone: 'warn', m: '需进一步核实' }
    ], 3), '已随访病例的生存结局分布');

    /* 死亡信息比对 */
    var dc = S.deathCompare();
    var dcCard = U.card('死亡信息比对', U.table(
      ['患者', '登记状态', '死亡信息状态', '是否一致', '差异原因'],
      dc.map(function (r) {
        return {
          cls: r.matched === '否' ? 'abn-row' : '',
          cells: [
            r.name,
            r.regStatus,
            r.deathStatus,
            { h: r.matched === '是' ? U.badge('一致', 'success') : U.badge('不一致', 'danger') },
            { h: r.diffReason || '—' }
          ]
        };
      }), '登记状态与死因监测数据一致性核查'));

    /* 随访趋势 */
    var tr = [];
    for (var m = 1; m <= 9; m++) {
      tr.push({
        l: m + '月',
        v: Math.round((fs.rate + (S.rnd01('futr|' + m) - 0.5) * 6) * 10) / 10
      });
    }
    var trendCard = U.card('随访趋势', U.lineChart(tr), '不同时间段随访更新情况');

    /* 被质控数据 */
    var cases = S.regCases({ limit: 120, salt: 'fu' });
    var sl = U.slice(cases, ST.page, ST.per);
    var dataCard = U.card('被质控数据',
      U.table(['患者', '登记状态', '最近随访时间', '生存状态', '死亡日期', '死亡原因', '数据来源', '操作'],
        sl.rows.map(function (r) {
          return {
            cls: r.v === 'ok' ? '' : 'abn-row',
            cells: [
              { h: U.link(r.name, 'l3:case:' + r.key) },
              r.regStatus,
              r.fuDate || '<span style="color:#b42335">未随访</span>',
              r.survive,
              r.deathDate || '—',
              r.deathCause || '—',
              S.srcTag(S.seedOf(r.key)),
              { h: U.link('详情', 'l3:case:' + r.key) }
            ]
          };
        }), { compact: true }) +
      U.pager(sl.total, sl.page, ST.per, 'l3f'),
      '查看登记状态、最近随访时间、生存状态、死亡信息与数据来源');

    return '<div class="qc-page">' +
      U.head('随访质控', '评价随访完成情况、生存状态更新率与死亡信息一致性。',
        'l3', '③ 登记与随访数据质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l3:back">返回总览</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l3:export">导出数据</button>') +
      kpiHtml +
      U.grid2(survCard, trendCard) +
      dcCard +
      dataCard +
      '</div>';
  }

  /* ==================== 页面：登记机构质量分析（单指标 × 区县登记处） ==================== */
  function renderOrg() {
    var d = cur();
    /* 区县登记处是登记质控的自然"机构"单元；用 countyList 取每个区县在该指标上的值 */
    var cl = S.countyList(ST.ind);
    if (ST.city) cl = cl.filter(function (x) { return x.city === ST.city; });

    var provDen = 0, provNum = 0;
    S.countyList(ST.ind).forEach(function (x) { provDen += x.den; provNum += x.num; });
    var provVal = aggVal(provNum, provDen);

    /* 达标判定：统一走 S.l3Pass（口径取自预警引擎 + IARC CI5，与总览一致）；
       M/I 无达标线，用参考区间判偏离。 */
    function isPass(v) { return S.l3Pass(ST.ind, v); }
    var passCount = 0, failCount = 0;
    cl.forEach(function (x) { var p = isPass(x.value); if (p === true) passCount++; else if (p === false) failCount++; });

    var passLineTxt = isRatio()
      ? '参考区间 ' + d.refLow + '~' + d.refHigh
      : (d.dir === 'down' ? '达标线 ≤' + d.pass + '%' : '达标线 ≥' + d.pass + '%');
    var kpiHtml = U.kpis([
      { l: '当前' + (isRatio() ? 'M/I' : '指标值'), v: fmtVal(provVal), unit: isRatio() ? '' : '%', tone: isRatio() ? 'info' : (isPass(provVal) ? 'up' : 'warn'), m: '<span title="' + S.esc(d.basis) + '" style="cursor:help;border-bottom:1px dotted #94a3b8">' + passLineTxt + ' ⓘ</span>' },
      { l: '覆盖登记处', v: cl.length, unit: '个', tone: 'info', m: ST.city ? S.cityName(ST.city) : '全省区县' },
      { l: '达标登记处', v: isRatio() ? '—' : passCount, unit: isRatio() ? '' : '个', tone: 'up', m: isRatio() ? '比值无达标线' : '符合达标线要求' },
      { l: '未达标登记处', v: isRatio() ? '—' : failCount, unit: isRatio() ? '' : '个', tone: failCount > 0 ? 'warn' : 'up', m: isRatio() ? '—' : '低于达标线要求' },
      { l: '合计病例数', v: S.fmt(provDen), unit: '例', tone: 'info', m: '纳入登记质量统计' }
    ], 3);

    /* 按设区市分级汇总 */
    var cityMap = {};
    S.countyList(ST.ind).forEach(function (x) {
      if (ST.city && x.city !== ST.city) return;
      if (!cityMap[x.city]) cityMap[x.city] = { den: 0, num: 0, count: 0 };
      cityMap[x.city].den += x.den; cityMap[x.city].num += x.num; cityMap[x.city].count++;
    });
    var cityRows = Object.keys(cityMap).map(function (code) {
      var m = cityMap[code], v = aggVal(m.num, m.den);
      return { code: code, v: v, cells: [
        { h: U.link(S.cityName(code), 'l3o:city:' + code) },
        { h: m.count + ' 个', cls: 'num' },
        { h: S.fmt(m.den), cls: 'num' },
        { h: fmtVal(v), cls: 'num' }
      ] };
    }).sort(function (a, b) { return isRatio() ? a.v - b.v : (d.dir === 'down' ? a.v - b.v : b.v - a.v); });
    var cityCard = U.card('设区市汇总', U.table(['设区市', '登记处数', '#病例数', '#' + (isRatio() ? 'M/I' : '指标值')],
      cityRows.map(function (r) { return { cells: r.cells }; }), { compact: true }), '按设区市聚合登记质量');

    /* 排名柱状图（区县登记处） */
    var sorted = cl.slice().sort(function (a, b) { return isRatio() ? a.value - b.value : (d.dir === 'down' ? a.value - b.value : b.value - a.value); });
    var barCard = U.card('区县登记处排名',
      U.barChart(sorted.slice(0, 16).map(function (x) { return { l: x.county.replace(/[区县市]$/, ''), v: x.value }; }),
        { height: 210, unit: isRatio() ? '' : '%', fmt: function (v) { return fmtVal(v); } }),
      (isRatio() ? '越接近 0.6 越好' : d.dir === 'down' ? '越低越好' : '越高越好') + '（显示前 16 个）');

    /* 明细表 */
    var detailRows = sorted.map(function (x, idx) {
      var p = isPass(x.value);
      var style = isRatio() ? '' : U.heat(x.value, d.dir, d.base);
      var badge = p === null ? '<span class="badge-info">比值</span>'
        : '<span class="' + (p ? 'badge-success' : 'badge-danger') + '">' + (p ? '达标' : '未达标') + '</span>';
      return {
        cells: [
          { h: '<b>' + (idx + 1) + '</b>', cls: 'num' },
          S.cityName(x.city),
          x.county,
          { h: S.fmt(x.den), cls: 'num' },
          { h: style ? '<span style="padding:2px 7px;border-radius:4px;' + style + '">' + fmtVal(x.value) + '</span>' : fmtVal(x.value), cls: 'num' },
          { h: badge, cls: 'num' },
          { h: U.link('查看区县', 'l3o:drill:' + x.city + ':' + x.county) }
        ]
      };
    });
    var detailTable = U.table(['#', '设区市', '区县登记处', '#病例数', '#' + (isRatio() ? 'M/I' : '指标值'), '#达标', '#操作'], detailRows, { compact: true });

    var filter = U.filterBar([
      { key: 'city', label: '设区市', type: 'select', value: ST.city, options: S.cityOptions() }
    ], 'l3o');

    return '<div class="qc-page">' +
      U.head('登记机构质量分析 · ' + d.name, '单项登记指标在' + cl.length + '个区县登记处上的排名与达标情况' +
        (ST.city ? '（' + S.cityName(ST.city) + '）' : '（全省区县）'), 'l3', '③ 登记与随访数据质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l3:back">返回总览</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l3:toAnalysis">登记质量分析</button>') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' + S.L3_IND.map(function (x) {
        return '<button class="btn ' + (x.id === d.id ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-qc="l3:oind:' + x.id + '">' + S.esc(x.name.split('（')[0]) + '</button>';
      }).join('') + '</div>' +
      filter +
      kpiHtml +
      U.grid2(cityCard, barCard) +
      detailTable +
      '</div>';
  }

  /* ==================== 页面：被质控数据详情（登记/随访） ==================== */
  function findReg() {
    var all = S.regCases({ limit: 200, salt: '' }).concat(S.regCases({ limit: 200, salt: 'fu' }));
    for (var i = 0; i < all.length; i++) if (all[i].key === ST.caseKey) return all[i];
    /* 详情页 key 可能来自总览（salt=当前指标） */
    var alt = S.regCases({ limit: 200, salt: ST.ind });
    for (var j = 0; j < alt.length; j++) if (alt[j].key === ST.caseKey) return alt[j];
    return all[0] || null;
  }

  function renderMCD() {
    var r = findReg();
    if (!r) {
      return '<div class="qc-page">' + U.head('被质控数据详情', '登记与随访证据', 'l3', '③ 登记与随访数据质控') +
        U.card('未找到病例', '<div class="qc-empty">请从登记质控页面点击患者进入。</div>') + '</div>';
    }

    var regCard = U.card('登记信息', U.kv([
      ['登记编号', S.esc(r.id)], ['姓名', S.esc(r.name)],
      ['性别', r.sex], ['年龄', r.age + ' 岁'],
      ['登记时间', r.regDate], ['确诊时间', r.diagDate],
      ['肿瘤部位', S.esc(r.site) + '（' + r.siteCode + '）'], ['病理诊断', r.path || '<span style="color:#b42335">（空）</span>'],
      ['登记机构', S.esc(r.org)], ['确诊依据', S.esc(r.basis)]
    ], 3), '登记报告卡填报内容');

    var fuCard = U.card('随访信息', U.kv([
      ['最近随访时间', r.fuDate || '<span style="color:#b42335">未随访</span>'],
      ['生存状态', r.survive],
      ['死亡日期', r.deathDate || '—'],
      ['死亡原因', r.deathCause || '—'],
      ['随访状态', r.fuDate ? '已完成随访' : '失访'],
      ['数据来源', S.srcTag(S.seedOf(r.key))]
    ], 3), '末次随访结果');

    /* 质控判定 */
    var missing = [];
    if (!r.path) missing.push('病理诊断');
    if (!r.fuDate) missing.push('最近随访时间');
    if (r.survive === '不详') missing.push('生存状态');
    var conflicts = [];
    if (r.matched === '否') conflicts.push('登记状态与死因监测不一致');
    var rule = {
      code: 'QC-L3-' + (S.seedOf('mcd|' + r.key) % 900 + 100),
      name: r.issueType || '登记数据完整性核查',
      ver: 'V2025.2',
      cond: '登记必填字段完整 · 随访按期更新 · 死亡信息与死因监测一致',
      field: '登记信息 / 随访记录 / 死亡信息'
    };

    var judgeCard = U.card('质控判定',
      U.judgeBlock(rule,
        '<div style="font-size:12.5px;line-height:1.8">' +
        '· <b>缺失字段</b>：' + (missing.length ? '<span style="color:#b42335">' + missing.join('、') + '</span>' : '无') + '<br>' +
        '· <b>数据冲突</b>：' + (conflicts.length ? '<span style="color:#b42335">' + conflicts.join('、') + '</span>' : '无') + '<br>' +
        '· <b>随访异常</b>：' + (!r.fuDate ? '<span style="color:#b42335">超过 12 个月未更新随访</span>' : '无') + '<br>' +
        '· <b>死亡信息异常</b>：' + (r.matched === '否' ? '<span style="color:#b42335">' + S.esc(r.diffReason) + '</span>' : '无') +
        '</div>',
        S.V_LABEL[r.v], r.issueType || '') +
      '<div style="height:12px"></div>' +
      U.note(r.v === 'ok'
        ? '本病例登记与随访数据完整，各项质控规则判定通过。'
        : '本病例存在问题：<b>' + S.esc(r.issueType) + '</b>。请核实原始登记卡与随访记录后修正。', r.v !== 'ok'));

    /* 原始数据追溯 */
    var traceRows = [
      { cells: ['登记报告卡', 'PATH_DIAG', r.path || '<span style="color:#b42335">（空）</span>', '病理诊断', r.path || '（空）', U.badge(r.path ? '原值入库' : '缺失', r.path ? 'neutral' : 'danger')] },
      { cells: ['登记报告卡', 'SITE_CODE', r.siteCode, 'ICD-10 部位编码', r.siteCode, U.badge('已标准化', 'info')] },
      { cells: ['随访系统', 'LAST_FU_DATE', r.fuDate || '<span style="color:#b42335">（空）</span>', '最近随访时间', r.fuDate || '（空）', U.badge(r.fuDate ? '原值入库' : '缺失', r.fuDate ? 'neutral' : 'danger')] },
      { cells: ['死因监测', 'DEATH_DATE', r.deathDate || '—', '死亡日期', r.deathDate || '—', U.badge('已标准化', 'info')] }
    ];
    var traceCard = U.card('原始数据追溯',
      U.table(['数据来源', '原始字段', '原始值', '标准化字段', '标准化结果', '处理'], traceRows, { compact: true }) +
      U.note('查看来源数据及标准化结果。标准化后的值进入登记库并参与质量指标计算。', true));

    return '<div class="qc-page">' +
      U.head('被质控数据详情', (r.issueType || '登记随访数据') + ' · ' + r.county, 'l3', '③ 登记与随访数据质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l3:backList">返回列表</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l3:mark">标记问题</button>' +
        '<button class="btn btn-primary btn-sm" data-qc="l3:toFix">纳入整改</button>') +
      regCard + fuCard + judgeCard + traceCard +
      '</div>';
  }

  /* ==================== 路由 ==================== */
  function render(pageId) {
    if (pageId === 'qc-g-reg') pageId = 'qc-l3-registry';
    if (pageId === 'qc-l3-registry') return renderOverview();
    if (pageId === 'qc-reg-analysis') return renderAnalysis();
    if (pageId === 'qc-l3-org') return renderOrg();
    if (pageId === 'qc-reg-followup') return renderFollowup();
    if (pageId === 'qc-mcd-reg') return renderMCD();
    return null;
  }

  /* ==================== 交互 ==================== */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-qc]') : null;
    if (!el) return;
    var a = el.getAttribute('data-qc');
    if (a.indexOf('l3') !== 0) return;

    if (a === 'filter:apply:l3' || a === 'filter:reset:l3') {
      if (a.indexOf('reset') > 0) { ST.city = ''; ST.county = ''; ST.cancer = ''; ST.year = '2026'; }
      else {
        var box = el.closest('.qc-filter'), reads = box ? box.querySelectorAll('[data-qcf]') : [];
        for (var i = 0; i < reads.length; i++) {
          var k = reads[i].getAttribute('data-qcf'), v = reads[i].value;
          if (k === 'ind') continue;
          ST[k] = v === '全部' ? '' : v;
        }
        ST.county = '';
      }
      ST.page = 1;
      window.renderPage('qc-l3-registry');
      return;
    }
    /* 登记机构质量分析筛选（设区市） */
    if (a === 'filter:apply:l3o' || a === 'filter:reset:l3o') {
      if (a.indexOf('reset') > 0) { ST.city = ''; }
      else {
        var boxO = el.closest('.qc-filter'), rdO = boxO ? boxO.querySelectorAll('[data-qcf]') : [];
        for (var io = 0; io < rdO.length; io++) { ST[rdO[io].getAttribute('data-qcf')] = rdO[io].value; }
      }
      window.renderPage('qc-l3-org');
      return;
    }
    if (a.indexOf('l3:ind:') === 0) { ST.ind = a.split(':')[2]; ST.page = 1; window.renderPage('qc-l3-registry'); return; }
    if (a.indexOf('l3:ind2:') === 0) { ST.ind = a.split(':')[2]; ST.page = 1; window.renderPage('qc-reg-analysis'); return; }
    if (a.indexOf('l3:oind:') === 0) { ST.ind = a.split(':')[2]; window.renderPage('qc-l3-org'); return; }
    if (a === 'l3:back') { window.navigateTo('qc-l3-registry'); return; }
    if (a === 'l3:toAnalysis') { window.navigateTo('qc-reg-analysis'); return; }
    if (a === 'l3:toOrg') { window.navigateTo('qc-l3-org'); return; }
    if (a === 'l3:toFollowup') { ST.page = 1; window.navigateTo('qc-reg-followup'); return; }
    if (a === 'l3:export') { U.toast('已按当前筛选条件导出数据（演示）'); return; }
    /* 登记机构质量分析：市汇总点击收敛该市；区县行下钻到登记质量分析 */
    if (a.indexOf('l3o:city:') === 0) { ST.city = a.split(':')[2]; window.renderPage('qc-l3-org'); return; }
    if (a.indexOf('l3o:drill:') === 0) { var pp = a.split(':'); ST.city = pp[2]; ST.county = pp[3]; ST.page = 1; window.navigateTo('qc-reg-analysis'); return; }

    /* 区域下钻 */
    if (a.indexOf('l3:city:') === 0) { ST.city = a.split(':')[2]; ST.county = ''; ST.page = 1; window.navigateTo('qc-reg-analysis'); return; }
    if (a.indexOf('l3:county:') === 0) {
      var p = a.split(':');
      ST.city = p[2]; ST.county = p[3]; ST.page = 1;
      window.navigateTo('qc-reg-analysis');
      return;
    }
    if (a === 'l3:level:province') { ST.city = ''; ST.county = ''; ST.page = 1; window.renderPage('qc-reg-analysis'); return; }
    if (a.indexOf('l3:cancer:') === 0) { ST.cancer = a.split(':')[2]; ST.page = 1; window.navigateTo('qc-l3-registry'); return; }
    if (a.indexOf('l3:org:') === 0) { ST.org = a.split(':')[2]; ST.page = 1; window.navigateTo('qc-reg-followup'); return; }
    if (a.indexOf('l3:page:') === 0 || a.indexOf('l3f:page:') === 0) {
      ST.page = parseInt(a.split(':')[2], 10) || 1;
      var page = el.closest('.qc-page');
      window.renderPage(ST.org ? 'qc-reg-followup' : 'qc-l3-registry');
      return;
    }

    /* 病例详情 */
    if (a.indexOf('l3:case:') === 0) { ST.caseKey = a.slice('l3:case:'.length); window.navigateTo('qc-mcd-reg'); return; }
    if (a === 'l3:backList') { window.navigateTo('qc-reg-analysis'); return; }
    if (a === 'l3:mark') { U.toast('已标记登记随访问题（演示）'); return; }
    if (a === 'l3:toFix') { U.toast('已将登记随访问题纳入整改任务'); return; }
    if (a === 'layer:toggle') {
      var b = el.closest('.qc-layer');
      if (b) {
        b.classList.toggle('collapsed');
        var ar = b.querySelector('.ar');
        if (ar) ar.textContent = b.classList.contains('collapsed') ? '展开 ▾' : '收起 ▴';
      }
    }
  });

  window.qcL3 = {
    pageIds: ['qc-g-reg', 'qc-l3-registry', 'qc-reg-analysis', 'qc-l3-org', 'qc-reg-followup', 'qc-mcd-reg'],
    render: render,
    meta: PAGE_META,
    state: ST
  };
})();
