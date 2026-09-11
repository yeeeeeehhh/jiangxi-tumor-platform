/*
 * cockpit-module.js — 预警总览（江西省肿瘤登记与防控一体化数据大屏，菜单：预警监测 ▸ 预警总览）
 * 数据口径来源：stats-module.js（地市/质控阈值/标准人口）、dictionary-management.js（部位字典）、
 * warning-module.js（A 登记运行 / B 登记质量 / C 疾病信号 三层预警）、
 * national-report.js（国家上报）、followup-module.js（随访）、modules.js（重卡）。
 * 地图底图：jx-geo.js（江西省 11 设区市行政边界，DataV.GeoAtlas 抽稀）。
 * 交互完整度：年度 / 数据域 / 地图指标三档筛选 → 地图点选聚焦地市 → 全页面联动 →
 *   地市详情弹窗（雷达 / 分期构成 / 县区分组）→ 大屏模式（Esc 退出）→ 跳转业务模块。
 */
(function () {
  'use strict';
  if (window.__CK_LOADED) return;
  window.__CK_LOADED = 1;

  var PAGE = 'cockpit';
  var GEO = window.JX_GEO || null;

  /* ==================== 1. 基础常量 ==================== */
  var NOW = new Date();
  var CUR_YEAR = NOW.getFullYear();
  var CUR_MONTH = NOW.getMonth();                 // 0-based，上一个完整自然月 = CUR_MONTH
  var YEARS = [];
  for (var y = CUR_YEAR - 5; y <= CUR_YEAR; y++) YEARS.push(y);

  var QC = { mvMin: 70, dcoMax: 5, ubMax: 5, miMin: 0.55, miMax: 0.85 };

  // pop：常住人口（万人）；crude：粗发病率基线（1/10 万，2026 年口径）；asrK：中标率/粗率系数
  var META = {
    '360100': { n: '南昌', f: '南昌市', pop: 657.0, crude: 268, asrK: .865, mi: .615, mv: 79.5, dco: 3.6, ub: 3.1, fu: 88.5, dup: 2.0, nccr: 98.6, hosp: 62, cap: 1 },
    '360200': { n: '景德镇', f: '景德镇市', pop: 161.8, crude: 279, asrK: .855, mi: .642, mv: 73.2, dco: 4.6, ub: 3.8, fu: 82.4, dup: 2.7, nccr: 97.1, hosp: 19 },
    '360300': { n: '萍乡', f: '萍乡市', pop: 179.7, crude: 303, asrK: .842, mi: .678, mv: 71.6, dco: 5.2, ub: 4.2, fu: 79.8, dup: 3.1, nccr: 96.3, hosp: 22 },
    '360400': { n: '九江', f: '九江市', pop: 455.2, crude: 289, asrK: .858, mi: .651, mv: 76.4, dco: 4.3, ub: 3.6, fu: 85.1, dup: 2.4, nccr: 98.1, hosp: 43 },
    '360500': { n: '新余', f: '新余市', pop: 121.3, crude: 271, asrK: .861, mi: .623, mv: 78.1, dco: 3.9, ub: 3.2, fu: 86.3, dup: 2.2, nccr: 97.8, hosp: 13 },
    '360600': { n: '鹰潭', f: '鹰潭市', pop: 115.4, crude: 264, asrK: .868, mi: .618, mv: 77.3, dco: 4.0, ub: 3.4, fu: 85.9, dup: 2.3, nccr: 97.6, hosp: 14 },
    '360700': { n: '赣州', f: '赣州市', pop: 897.0, crude: 246, asrK: .874, mi: .604, mv: 74.8, dco: 4.9, ub: 4.6, fu: 80.6, dup: 3.6, nccr: 96.8, hosp: 71 },
    '360800': { n: '吉安', f: '吉安市', pop: 438.0, crude: 257, asrK: .869, mi: .636, mv: 72.4, dco: 5.4, ub: 4.9, fu: 78.2, dup: 3.8, nccr: 95.9, hosp: 35 },
    '360900': { n: '宜春', f: '宜春市', pop: 499.0, crude: 277, asrK: .860, mi: .647, mv: 73.9, dco: 5.1, ub: 4.3, fu: 81.3, dup: 3.2, nccr: 96.7, hosp: 38 },
    '361000': { n: '抚州', f: '抚州市', pop: 361.0, crude: 269, asrK: .863, mi: .655, mv: 71.9, dco: 5.7, ub: 5.1, fu: 77.4, dup: 4.1, nccr: 95.4, hosp: 29 },
    '361100': { n: '上饶', f: '上饶市', pop: 639.0, crude: 262, asrK: .871, mi: .659, mv: 70.8, dco: 6.1, ub: 5.4, fu: 76.1, dup: 4.4, nccr: 94.8, hosp: 45 }
  };
  var CODES = Object.keys(META);

  // 部位字典：share 发病构成比，dshare 死亡构成比，sxBias 男/女偏向（>1 男性高发）
  var SITES = [
    { n: '肺', icd: 'C34', share: 15.4, dshare: 22.1, sxBias: 1.35 },
    { n: '结直肠', icd: 'C18-C20', share: 11.2, dshare: 9.0, sxBias: 1.15 },
    { n: '胃', icd: 'C16', share: 10.3, dshare: 13.0, sxBias: 1.30 },
    { n: '肝', icd: 'C22', share: 9.1, dshare: 15.2, sxBias: 1.60 },
    { n: '乳腺', icd: 'C50', share: 8.2, dshare: 4.6, sxBias: .04 },
    { n: '食管', icd: 'C15', share: 6.8, dshare: 8.5, sxBias: 1.45 },
    { n: '甲状腺', icd: 'C73', share: 5.1, dshare: .6, sxBias: .32 },
    { n: '前列腺', icd: 'C61', share: 4.4, dshare: 2.2, sxBias: 99 },
    { n: '子宫颈', icd: 'C53', share: 3.8, dshare: 2.6, sxBias: .01 },
    { n: '膀胱', icd: 'C67', share: 3.6, dshare: 2.4, sxBias: 2.20 },
    { n: '肾', icd: 'C64', share: 3.0, dshare: 2.0, sxBias: 1.35 },
    { n: '胰腺', icd: 'C25', share: 2.6, dshare: 6.0, sxBias: 1.10 },
    { n: '脑（中枢神经）', icd: 'C71', share: 2.3, dshare: 3.4, sxBias: 1.12 },
    { n: '淋巴瘤', icd: 'C82-C85', share: 2.2, dshare: 2.6, sxBias: 1.25 },
    { n: '口腔', icd: 'C06', share: 2.0, dshare: 1.6, sxBias: 1.40 }
  ];
  var AGE_GROUPS = ['0-14', '15-34', '35-49', '50-59', '60-69', '70-79', '80+'];
  // 男 / 女 年龄别构成比（%）
  var AGE_M = [1.1, 5.6, 13.8, 18.6, 24.3, 22.1, 14.5];
  var AGE_F = [1.3, 11.4, 21.2, 19.4, 20.6, 16.8, 9.3];
  var SEX_RATIO_M = .575;                          // 男性病例占比（全部恶性肿瘤）
  var AGE_MI = [.24, .3, .4, .52, .64, .74, .82];  // 各年龄组 M/I（死亡构成 = 发病构成 × 该系数）

  var COUNTIES = {
    '360100': ['东湖区', '西湖区', '青云谱区', '青山湖区', '新建区', '红谷滩区', '南昌县', '进贤县', '安义县'],
    '360200': ['昌江区', '珠山区', '浮梁县', '乐平市'],
    '360300': ['安源区', '湘东区', '莲花县', '上栗县', '芦溪县'],
    '360400': ['浔阳区', '濂溪区', '武宁县', '修水县', '永修县', '德安县', '都昌县', '湖口县', '彭泽县', '瑞昌市', '共青城市', '庐山市'],
    '360500': ['渝水区', '分宜县'],
    '360600': ['月湖区', '余江区', '贵溪市'],
    '360700': ['章贡区', '南康区', '赣县区', '信丰县', '大余县', '上犹县', '崇义县', '安远县', '龙南市', '定南县', '全南县', '宁都县', '于都县', '兴国县', '会昌县', '寻乌县', '石城县', '瑞金市'],
    '360800': ['吉州区', '青原区', '吉安县', '吉水县', '峡江县', '新干县', '永丰县', '泰和县', '遂川县', '万安县', '安福县', '永新县', '井冈山市'],
    '360900': ['袁州区', '奉新县', '万载县', '上高县', '宜丰县', '靖安县', '铜鼓县', '丰城市', '樟树市', '高安市'],
    '361000': ['临川区', '东乡区', '南城县', '黎川县', '南丰县', '崇仁县', '乐安县', '宜黄县', '金溪县', '资溪县', '广昌县'],
    '361100': ['信州区', '广丰区', '广信区', '玉山县', '铅山县', '横峰县', '弋阳县', '余干县', '鄱阳县', '万年县', '婺源县', '德兴市']
  };
  // 人口权重提示（其余县区按确定性随机分配）
  var W_HINT = {
    '南昌县': .21, '东湖区': .12, '西湖区': .11, '青山湖区': .14, '红谷滩区': .13,
    '珠山区': .34, '昌江区': .18, '乐平市': .28, '浮梁县': .2,
    '安源区': .42, '上栗县': .18, '湘东区': .16,
    '浔阳区': .12, '濂溪区': .13, '修水县': .13, '都昌县': .12, '瑞昌市': .09,
    '渝水区': .86, '月湖区': .3, '余江区': .33, '贵溪市': .35,
    '章贡区': .16, '南康区': .14, '于都县': .12, '兴国县': .12, '瑞金市': .11,
    '吉州区': .17, '青原区': .1, '泰和县': .1, '吉安县': .11,
    '袁州区': .22, '丰城市': .17, '高安市': .12, '樟树市': .1,
    '临川区': .32, '南丰县': .1, '东乡区': .11,
    '信州区': .13, '广丰区': .13, '鄱阳县': .16, '余干县': .12, '广信区': .11
  };

  var DOMAIN = {
    inc: { key: 'inc', label: '发病登记', short: '新发', unit: '例', cntK: 'cases', rateK: 'crude', asrK: 'asr', color: 'cyan' },
    death: { key: 'death', label: '死亡登记', short: '死亡', unit: '例', cntK: 'deaths', rateK: 'crudeD', asrK: 'asrD', color: 'warm' }
  };
  var METRICS = {
    cases: { label: '登记病例数', unit: '例', fmt: 'int', get: function (r) { return r.cnt; } },
    crude: { label: '粗发病率(1/10万)', unit: '', fmt: 'f1', get: function (r) { return r.rate; }, deathLabel: '粗死亡率(1/10万)' },
    asr: { label: '中标率(1/10万)', unit: '', fmt: 'f1', get: function (r) { return r.asr; }, deathLabel: '死亡中标率(1/10万)' },
    mi: { label: 'M/I 比', unit: '', fmt: 'f2', get: function (r) { return r.mi; } },
    fu: { label: '随访完成率(%)', unit: '', fmt: 'f1', get: function (r) { return r.fu; } },
    warn: { label: '待处置预警(条)', unit: '', fmt: 'int', get: function (r) { return r.warnPending; } }
  };
  var RAMP = {
    cyan: ['#123a55', '#175a7f', '#1d7aa8', '#25a0c8', '#3cc9de', '#78f0ea'],
    warm: ['#5a2436', '#7d2f42', '#a03a4c', '#c44e56', '#e2685f', '#f89a72']
  };

  /* ==================== 2. 工具 ==================== */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fmtInt(v) { return Math.round(v).toLocaleString('zh-CN'); }
  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function num(v, fmt) { return fmt === 'int' ? fmtInt(v) : fmt === 'f2' ? f2(v) : f1(v); }
  function hash(s) { var x = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  function rnd(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }
  function norm(a) { var t = sum(a) || 1; return a.map(function (v) { return v / t; }); }

  /* ==================== 3. 数据层 ==================== */
  var CACHE = {};
  var PARTIAL = {};
  YEARS.forEach(function (yy) { PARTIAL[yy] = yy === CUR_YEAR ? Math.max(1, CUR_MONTH) / 12 : 1; });

  function siteShares(domain, sex, jitter) {
    // sex: '' 全部 / 'M' / 'F'；返回 SITES 构成比（%）
    var base = SITES.map(function (s, i) {
      var v = domain === 'death' ? s.dshare : s.share;
      if (sex === 'M') v *= s.sxBias >= 9 ? (s.sxBias > 50 ? 1 : s.sxBias) : Math.min(s.sxBias, 3);
      if (sex === 'F') v *= (s.sxBias >= 9 ? .012 : 2 - Math.min(s.sxBias, 1.9));
      if (sex === '' && !jitter) { /* 原始口径 */ }
      return v * (jitter ? 1 + (jitter() - .5) * .18 : 1);
    });
    return norm(base).map(function (v) { return v * 100; });
  }

  function build(code, year) {
    var key = code + '#' + year;
    if (CACHE[key]) return CACHE[key];
    var m = META[code], r = rnd(hash(key)), dy = year - CUR_YEAR;
    var pop = m.pop * (1 + dy * .0035);
    var crude = m.crude * (1 + dy * .021) * (.975 + r() * .05);
    var cases = Math.round(pop * 100 / 1e5 * crude * 100);      // pop 万人 → 例
    var mi = clamp(m.mi - dy * .006 + (r() - .5) * .018, .5, .82);
    var deaths = Math.round(cases * mi);
    var crudeD = deaths / (pop * 1e4) * 1e5;
    var rec = {
      code: code, name: m.n, full: m.f, year: year, pop: pop, hosp: Math.max(8, Math.round(m.hosp * (1 + dy * .012))),
      cases: cases, deaths: deaths, casesCum: Math.round(cases * PARTIAL[year]), deathsCum: Math.round(deaths * PARTIAL[year]),
      crude: crude, crudeD: crudeD, asr: crude * m.asrK, asrD: crudeD * m.asrK * .94,
      mi: deaths / cases,
      mv: clamp(m.mv + dy * .62 + (r() - .5) * 2.6, 52, 93),
      dco: clamp(m.dco - dy * .26 + (r() - .5) * 1.1, 1.1, 9.6),
      ub: clamp(m.ub - dy * .19 + (r() - .5) * .9, .5, 8.4),
      fu: clamp(m.fu + dy * 1.15 + (r() - .5) * 3.4, 52, 97.5),
      dup: clamp(m.dup - dy * .24 + (r() - .5) * .7, .5, 6.4),
      nccr: clamp(m.nccr + dy * .5 + (r() - .5) * 1.1, 86, 99.9),
      cards: Math.round(cases * (1.14 + r() * .12)),
      stage: null, sites: null, sitesF: null, sitesM: null, ages: null, months: null,
      warnA: 0, warnB: 0, warnC: 0, warnPending: 0, warnClosed: 0
    };
    rec.cardsCum = Math.round(rec.cards * PARTIAL[year]);
    rec.warnA = Math.round(4 + r() * 9 + (code === '360700' || code === '361100' ? 3 : 0));
    rec.warnB = Math.round(3 + r() * 8 + (rec.mv < QC.mvMin ? 2 : 0) + (rec.dco > QC.dcoMax ? 2 : 0));
    rec.warnC = Math.round(1 + r() * 5);
    rec.warnPending = Math.round((rec.warnA + rec.warnB + rec.warnC) * (.22 + r() * .18));
    rec.warnClosed = rec.warnA + rec.warnB + rec.warnC - rec.warnPending;
    var s1 = 28 + dy * 1.15 + (r() - .5) * 3, s2 = 21 + dy * .3 + (r() - .5) * 2.4,
      s3 = 26 - dy * .9 + (r() - .5) * 2.6, s4 = 16 - dy * .75 + (r() - .5) * 2.2, su = 9 - dy * .2 + (r() - .5) * 1.4;
    var st = norm([s1, s2, s3, s4, su].map(function (v) { return Math.max(1.5, v); })).map(function (v) { return v * 100; });
    rec.stage = { I: st[0], II: st[1], III: st[2], IV: st[3], U: st[4] };
    rec.sites = siteShares('inc', '', r);
    rec.sitesD = siteShares('death', '', r);
    rec.sitesM = siteShares('inc', 'M', r);
    rec.sitesF = siteShares('inc', 'F', r);
    var srM = SEX_RATIO_M + (r() - .5) * .02;
    rec.ages = AGE_GROUPS.map(function (g, i) {
      return { g: g, m: cases * srM * AGE_M[i] / 100, f: cases * (1 - srM) * AGE_F[i] / 100 };
    });
    var mr = rnd(hash('mo' + key)), raw = [];
    for (var i = 0; i < 12; i++) raw.push(1 + .1 * Math.sin((i + 1) / 12 * Math.PI * 2 - .9) + (mr() - .5) * .16);
    var nm = norm(raw);
    rec.months = nm.map(function (v) { return v * cases; });
    CACHE[key] = rec;
    return rec;
  }

  function agg(codes, year) {
    var key = 'AGG#' + codes.join(',') + '#' + year;
    if (CACHE[key]) return CACHE[key];
    var rs = codes.map(function (c) { return build(c, year); });
    var pop = sum(rs.map(function (r) { return r.pop; }));
    var wsum = function (k) { return rs.reduce(function (s, r) { return s + r[k] * r.cases; }, 0) / (sum(rs.map(function (r) { return r.cases; })) || 1); };
    var wpop = function (k) { return rs.reduce(function (s, r) { return s + r[k] * r.pop; }, 0) / pop; };
    var a = {
      code: codes.length === 1 ? codes[0] : '360000', year: year,
      name: codes.length === 1 ? rs[0].name : '全省', full: codes.length === 1 ? rs[0].full : '江西省',
      pop: pop, hosp: sum(rs.map(function (r) { return r.hosp; })),
      cases: sum(rs.map(function (r) { return r.cases; })),
      deaths: sum(rs.map(function (r) { return r.deaths; })),
      cards: sum(rs.map(function (r) { return r.cards; })),
      cardsCum: Math.round(sum(rs.map(function (r) { return r.cards; })) * PARTIAL[year]),
      warnA: sum(rs.map(function (r) { return r.warnA; })),
      warnB: sum(rs.map(function (r) { return r.warnB; })),
      warnC: sum(rs.map(function (r) { return r.warnC; })),
      warnPending: sum(rs.map(function (r) { return r.warnPending; })),
      warnClosed: sum(rs.map(function (r) { return r.warnClosed; }))
    };
    a.casesCum = Math.round(a.cases * PARTIAL[year]);
    a.deathsCum = Math.round(a.deaths * PARTIAL[year]);
    a.crude = a.cases / (pop * 1e4) * 1e5;
    a.crudeD = a.deaths / (pop * 1e4) * 1e5;
    a.mi = a.deaths / a.cases;
    a.asr = wsum('asr'); a.asrD = wsum('asrD');
    a.mv = wsum('mv'); a.fu = wpop('fu'); a.dup = wpop('dup'); a.nccr = wpop('nccr');
    a.dco = wsum('dco'); a.ub = wsum('ub');
    a.stage = {};
    ['I', 'II', 'III', 'IV', 'U'].forEach(function (k) {
      a.stage[k] = rs.reduce(function (s, r) { return s + r.stage[k] * r.cases; }, 0) / a.cases;
    });
    a.sites = norm(rs.map(function (r) { return r.cases; }).map(function (w, i) {
      return SITES.map(function (_, j) { return rs[i].sites[j] * w; });
    }).reduce(function (acc, arr) { return arr.map(function (v, j) { return acc[j] + v; }); }, SITES.map(function () { return 0; }))).map(function (v) { return v * 100; });
    a.sitesD = SITES.map(function (_, j) { return rs.reduce(function (s, r) { return s + r.sitesD[j] * r.deaths; }, 0) / a.deaths; });
    a.sitesM = SITES.map(function (_, j) { return rs.reduce(function (s, r) { return s + r.sitesM[j] * r.cases; }, 0) / a.cases; });
    a.sitesF = SITES.map(function (_, j) { return rs.reduce(function (s, r) { return s + r.sitesF[j] * r.cases; }, 0) / a.cases; });
    a.ages = AGE_GROUPS.map(function (g, i) {
      return { g: g, m: rs.reduce(function (s, r) { return s + r.ages[i].m; }, 0), f: rs.reduce(function (s, r) { return s + r.ages[i].f; }, 0) };
    });
    a.months = [];
    for (var i = 0; i < 12; i++) a.months.push(rs.reduce(function (s, r) { return s + r.months[i]; }, 0));
    CACHE[key] = a;
    return a;
  }

  function scope() { return ST.city || ''; }
  function codesInScope() { return ST.city ? [ST.city] : CODES; }
  function cur(year) { return agg(codesInScope(), year || ST.year); }

  // 派生指标：把 rec/agg 归一为面板统一的显示口径
  function view(r, domain) {
    var d = DOMAIN[domain || ST.domain];
    var annual = d.key === 'inc' ? r.cases : r.deaths;
    var cnt = d.key === 'inc' ? r.casesCum : r.deathsCum;      // 显示量：本年度为 1–n 月累计
    var rate = d.key === 'inc' ? r.crude : r.crudeD;           // 率值恒为年化口径
    var asr = d.key === 'inc' ? r.asr : r.asrD;
    var sites = d.key === 'inc' ? r.sites : r.sitesD;
    return { d: d, cnt: cnt, annual: annual, cards: r.cardsCum, rate: rate, asr: asr, sites: sites, ages: r.ages, months: r.months };
  }

  function countyRows(code, year, domain) {
    var names = COUNTIES[code] || [], r = rnd(hash('cty' + code + year + domain)), m = META[code];
    var rawW = names.map(function (n) { return W_HINT[n] || (.3 + r() * .9); });
    var w = norm(rawW);
    var base = build(code, year);
    var popTotal = base.pop;
    var shares = norm(w.map(function (v, i) { return v * (.82 + r() * .36); }));
    var rows = names.map(function (n, i) {
      var pop = popTotal * norm(w)[i];
      var cnt = base.casesCum * shares[i];                       // 按显示量（当年为累计）分配
      var crude = cnt / (pop * 1e4) * 1e5;
      var mi = clamp(base.mi * (.94 + r() * .14), .45, .9);
      return {
        name: n, pop: pop, cases: cnt, deaths: cnt * mi, crude: crude,
        mi: mi, mv: clamp(base.mv + (r() - .5) * 9, 48, 95), dco: clamp(base.dco + (r() - .5) * 3.2, .8, 12),
        ub: clamp(base.ub + (r() - .5) * 2.6, .4, 11), fu: clamp(base.fu + (r() - .5) * 13, 48, 99),
        hosp: Math.max(2, Math.round(base.hosp * norm(w)[i] * (1 + (r() - .5) * .5))),
        warn: Math.round(r() * 5)
      };
    });
    // 县区死亡求和归一到全市，保证弹窗上下口径闭合
    var kd = base.deathsCum / (sum(rows.map(function (x) { return x.deaths; })) || 1);
    rows.forEach(function (x) { x.deaths *= kd; x.mi = x.deaths / x.cases; });
    return rows.sort(function (a, b) { return b.cases - a.cases; });
  }

  /* ==================== 4. 地图投影 ==================== */
  var PROJ = null;
  function project() {
    if (PROJ || !GEO) return PROJ;
    var b = GEO.bbox, midLat = (b[1] + b[3]) / 2, c = Math.cos(midLat * Math.PI / 180), k = 128, pad = 26;
    var lon = (b[2] - b[0]) * c, lat = b[3] - b[1];
    PROJ = {
      k: k, c: c, pad: pad,
      w: Math.round(lon * k + pad * 2), h: Math.round(lat * k + pad * 2),
      x: function (lng) { return (lng - b[0]) * c * k + pad; },
      y: function (lat2) { return (b[3] - lat2) * k + pad; }
    };
    return PROJ;
  }
  function cityPath(city) {
    var p = project(), d = [];
    city.rings.forEach(function (poly) {
      poly.forEach(function (ring) {
        for (var i = 0; i < ring.length; i++) {
          d.push((i ? 'L' : 'M') + (p.x(ring[i][0])).toFixed(1) + ' ' + (p.y(ring[i][1])).toFixed(1));
        }
        d.push('Z');
      });
    });
    return d.join('');
  }
  var PATHS = null;
  function paths() {
    if (PATHS || !GEO) return PATHS;
    PATHS = {};
    GEO.cities.forEach(function (c) { PATHS[c.code] = cityPath(c); });
    return PATHS;
  }

  // 标注位置微调（避免地市名互相压字）
  var NUDGE = { '360300': [-14, 6], '360500': [-20, 2], '360600': [18, -2], '360200': [6, -12], '360100': [-20, 2], '360400': [-8, -6] };

  function ramp(v, vals, palette) {
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var t = hi === lo ? .5 : (v - lo) / (hi - lo);
    var n = palette.length - 1;
    return palette[clamp(Math.round(t * n), 0, n)];
  }

  /* ==================== 5. 图表构件 ==================== */
  function spark(vals, color, w, hgt) {
    w = w || 78; hgt = hgt || 22;
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), k = hi === lo ? 1 : (hi - lo);
    var pts = vals.map(function (v, i) {
      return [(i / (vals.length - 1)) * (w - 2) + 1, hgt - 2 - ((v - lo) / k) * (hgt - 5)];
    });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    var area = line + 'L' + pts[pts.length - 1][0].toFixed(1) + ' ' + hgt + 'L' + pts[0][0].toFixed(1) + ' ' + hgt + 'Z';
    return '<svg class="ck-spark" viewBox="0 0 ' + w + ' ' + hgt + '" preserveAspectRatio="none">' +
      '<path d="' + area + '" fill="' + color + '" opacity=".16"/>' +
      '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.6"/>' +
      '<circle cx="' + pts[pts.length - 1][0].toFixed(1) + '" cy="' + pts[pts.length - 1][1].toFixed(1) + '" r="2.1" fill="' + color + '"/></svg>';
  }

  function trendChart(recs, domain) {
    var W = 460, H = 190, PL = 46, PR = 14, PT = 14, PB = 26;
    var inc = recs.map(function (r) { return r.cases / 10000; });      // 趋势用年化，跨年可比
    var dead = recs.map(function (r) { return r.deaths / 10000; });
    var hi = Math.max.apply(null, inc.concat(dead)) * 1.16, lo = 0;
    var iw = W - PL - PR, ih = H - PT - PB;
    function X(i) { return PL + (i / (recs.length - 1)) * iw; }
    function Y(v) { return PT + ih - (v - lo) / (hi - lo) * ih; }
    var g = '';
    for (var t = 0; t <= 4; t++) {
      var v = hi / 4 * t, yy = Y(v);
      g += '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="rgba(120,190,255,.12)"/>' +
        '<text x="' + (PL - 6) + '" y="' + (yy + 3.5).toFixed(1) + '" text-anchor="end" class="ck-ax">' + v.toFixed(1) + '</text>';
    }
    function series(vals, color, dash, name) {
      var line = vals.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('');
      var out = '';
      if (dash) {
        out += '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-dasharray="5 3"/>';
      } else {
        out += '<path d="' + line + 'L' + X(vals.length - 1).toFixed(1) + ' ' + (PT + ih) + 'L' + X(0) + ' ' + (PT + ih) + 'Z" fill="' + color + '" opacity=".13"/>';
        out += '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2"/>';
      }
      vals.forEach(function (v, i) {
        var on = (ST.domain === name);
        out += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="' + (i === recs.length - 1 ? 3.4 : on ? 2.6 : 2) + '" fill="' + color + '"' + (on ? ' stroke="#04121f" stroke-width="1.4"' : '') + '/>';
      });
      return out;
    }
    var labels = recs.map(function (r, i) {
      return '<text x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="ck-ax">' + r.year + '</text>';
    }).join('');
    var last = recs.length - 1;
    var valTags = '<text x="' + X(last).toFixed(1) + '" y="' + (Y(inc[last]) - 8).toFixed(1) + '" text-anchor="end" class="ck-vl" fill="#5fe1f0">' + inc[last].toFixed(1) + '</text>' +
      '<text x="' + X(last).toFixed(1) + '" y="' + (Y(dead[last]) - 8).toFixed(1) + '" text-anchor="end" class="ck-vl" fill="#ff9f7a">' + dead[last].toFixed(1) + '</text>';
    return '<svg class="ck-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + g +
      series(dead, '#ff9f7a', true, 'death') + series(inc, '#5fe1f0', false, 'inc') + valTags + labels + '</svg>' +
      '<div class="ck-legend"><span><i style="background:#5fe1f0"></i>发病（万人）</span><span><i style="background:#ff9f7a"></i>死亡（万人）</span></div>';
  }

  function monthChart(recs, domain) {
    var r = recs[recs.length - 1], v = view(r, domain);
    var W = 460, H = 130, PL = 42, PR = 8, PT = 10, PB = 20;
    var vals = v.months.map(function (x, i) { return (ST.year === CUR_YEAR && i >= CUR_MONTH) ? 0 : x; });
    var hi = Math.max.apply(null, vals) * 1.18 || 1;
    var iw = W - PL - PR, ih = H - PT - PB, bw = iw / 12 * .62;
    var out = '';
    for (var t = 1; t <= 3; t++) {
      var yy = PT + ih - ih * t / 3;
      out += '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="rgba(120,190,255,.1)"/>' +
        '<text x="' + (PL - 5) + '" y="' + (yy + 3.5).toFixed(1) + '" text-anchor="end" class="ck-ax">' + fmtInt(hi * t / 3) + '</text>';
    }
    vals.forEach(function (val, i) {
      var cx = PL + iw / 12 * (i + .5), hh = val / hi * ih;
      var active = (domain || ST.domain) === 'inc';
      out += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + (PT + ih - hh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, hh).toFixed(1) + '" rx="1.5" fill="url(#ckBar' + (active ? 'A' : 'B') + ')" opacity="' + (i + 1 === CUR_MONTH ? '1' : '.78') + '"/>';
      out += '<text x="' + cx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="ck-ax">' + (i + 1) + '</text>';
    });
    return '<svg class="ck-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="ckBarA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#66e8f7"/><stop offset="1" stop-color="#1a6c9c"/></linearGradient>' +
      '<linearGradient id="ckBarB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb08a"/><stop offset="1" stop-color="#8a2c3c"/></linearGradient></defs>' +
      out + '</svg>';
  }

  function pyramid(rec, domain) {
    var dom = domain || ST.domain;
    var W = 460, H = 188, PL = 54, PR = 54, PT = 8, PB = 20;
    var rows = AGE_GROUPS.length, rh = (H - PT - PB) / rows;
    var data = rec.ages.map(function (a, i) {
      var k = dom === 'death' ? AGE_MI[i] : 1;
      return { g: a.g, m: a.m * k, f: a.f * k };
    });
    var maxA = Math.max.apply(null, data.map(function (a) { return Math.max(a.m, a.f); }));
    var half = (W - PL - PR) / 2, out = '', lab = '';
    data.forEach(function (a, i) {
      var yy = PT + i * rh, bwM = a.m / maxA * half, bwF = a.f / maxA * half;
      lab += '<text x="' + (W / 2).toFixed(1) + '" y="' + (yy + rh / 2 + 4).toFixed(1) + '" text-anchor="middle" class="ck-py-g">' + a.g + '</text>';
      out += '<rect x="' + (W / 2 - bwM).toFixed(1) + '" y="' + (yy + 2.5).toFixed(1) + '" width="' + bwM.toFixed(1) + '" height="' + (rh - 5).toFixed(1) + '" rx="2" fill="url(#ckM)"/>';
      out += '<rect x="' + (W / 2).toFixed(1) + '" y="' + (yy + 2.5).toFixed(1) + '" width="' + bwF.toFixed(1) + '" height="' + (rh - 5).toFixed(1) + '" rx="2" fill="url(#ckF)"/>';
      out += '<text x="4" y="' + (yy + rh / 2 + 4).toFixed(1) + '" class="ck-py-v">' + fmtInt(a.m) + '</text>';
      out += '<text x="' + (W - 4) + '" y="' + (yy + rh / 2 + 4).toFixed(1) + '" text-anchor="end" class="ck-py-v">' + fmtInt(a.f) + '</text>';
    });
    return '<svg class="ck-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="ckM" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#2ea8d8"/><stop offset="1" stop-color="#1b5b8a"/></linearGradient>' +
      '<linearGradient id="ckF" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f7a7c3"/><stop offset="1" stop-color="#a8446f"/></linearGradient></defs>' +
      '<text x="4" y="12" class="ck-ax" fill="#7fd3f5">男</text>' +
      '<text x="' + (W - 4) + '" y="12" text-anchor="end" class="ck-ax" fill="#f7a7c3">女</text>' + out + lab + '</svg>';
  }

  function hbars(items, domain) {
    var hi = Math.max.apply(null, items.map(function (i) { return i.pct; })) || 1;
    return '<div class="ck-hb">' + items.map(function (it, i) {
      return '<div class="ck-hb-row"><div class="ck-hb-name"><b>' + (i + 1) + '</b>' + esc(it.name) + '<span class="ck-hb-icd">' + it.icd + '</span></div>' +
        '<div class="ck-hb-track"><i class="ck-hb-fill ' + (domain === 'death' ? 'warm' : '') + (i < 3 ? ' top' : '') + '" style="width:' + (it.pct / hi * 100).toFixed(1) + '%"></i></div>' +
        '<div class="ck-hb-val">' + fmtInt(it.val) + '<em>' + f1(it.pct) + '%</em></div></div>';
    }).join('') + '</div>';
  }

  function qcGauges(rec) {
    function row(label, val, fmt, band) {
      // band: {min?,max?,target,scaleMax,unit}
      var pct = clamp(val / band.scaleMax * 100, 0, 100);
      var tick = band.tick === undefined ? band.target / band.scaleMax * 100 : band.tick;
      var ok = band.range ? (val >= band.lo && val <= band.hi) : (band.dir === 'down' ? val <= band.target : val >= band.target);
      return '<div class="ck-gauge' + (ok ? '' : ' bad') + '">' +
        '<div class="ck-gauge-top"><span>' + label + '</span><b>' + (fmt === 'f2' ? f2(val) : f1(val)) + (band.unit || '') + '</b></div>' +
        '<div class="ck-gauge-track"><i style="width:' + pct.toFixed(1) + '%"></i><u style="left:' + clamp(tick, 0, 100).toFixed(1) + '%" title=""></u></div>' +
        '<div class="ck-gauge-foot"><span>国家阈值 ' + band.rule + '</span><span class="ck-tag ' + (ok ? 'ok' : 'bad') + '">' + (ok ? '达标' : '未达标') + '</span></div></div>';
    }
    return '<div class="ck-gauges">' +
      row('病理确认 MV%', rec.mv, 'f1', { target: QC.mvMin, scaleMax: 100, unit: '%', rule: '≥ 70%', dir: 'up' }) +
      row('DCO 占比', rec.dco, 'f1', { target: QC.dcoMax, scaleMax: 12, unit: '%', rule: '≤ 5%', dir: 'down', tick: QC.dcoMax / 12 * 100 }) +
      row('UB 占比', rec.ub, 'f1', { target: QC.ubMax, scaleMax: 12, unit: '%', rule: '≤ 5%', dir: 'down', tick: QC.ubMax / 12 * 100 }) +
      row('死亡发病比 M/I', rec.mi, 'f2', { scaleMax: 1, unit: '', rule: '0.55 ~ 0.85', range: 1, lo: QC.miMin, hi: QC.miMax, tick: ((QC.miMin + QC.miMax) / 2) / 1 * 100 }) +
      '</div>';
  }

  function funnel(rec) {
    var pf = PARTIAL[rec.year] || 1;
    var cards = rec.cardsCum, cases = rec.casesCum;
    var steps = [
      { n: '医疗机构登记上报', v: cards },
      { n: '卡面逻辑校验通过', v: cards * (1 - rec.dup / 100) * .985 },
      { n: '三级质控审核合格', v: cards * (1 - rec.dup / 100) * (.9 + (rec.mv - 60) / 400) },
      { n: '确诊并入档登记', v: cases },
      { n: '国家平台成功上报', v: cases * rec.nccr / 100 },
      { n: '纳入随访管理', v: cases * rec.fu / 100 }
    ];
    var top = steps[0].v;
    return '<div class="ck-funnel">' + steps.map(function (s, i) {
      var w = clamp(s.v / top * 100, 18, 100);
      return '<div class="ck-fs-row"><div class="ck-fs-name">' + s.n + '</div>' +
        '<div class="ck-fs-track"><i style="width:' + w.toFixed(1) + '%;opacity:' + (1 - i * .1).toFixed(2) + '">' + fmtInt(s.v) + '</i></div>' +
        '<div class="ck-fs-pct">' + f1(s.v / top * 100) + '%</div></div>';
    }).join('') + '</div>';
  }

  function donut(parts, center, sub) {
    var total = sum(parts.map(function (p) { return p.v; })) || 1, R = 52, r0 = 34, a0 = -Math.PI / 2, out = '';
    parts.forEach(function (p) {
      var ang = p.v / total * Math.PI * 2, a1 = a0 + ang;
      var x0 = 70 + R * Math.cos(a0), y0 = 70 + R * Math.sin(a0), x1 = 70 + R * Math.cos(a1), y1 = 70 + R * Math.sin(a1);
      var xi1 = 70 + r0 * Math.cos(a1), yi1 = 70 + r0 * Math.sin(a1), xi0 = 70 + r0 * Math.cos(a0), yi0 = 70 + r0 * Math.sin(a0);
      var lg = ang > Math.PI ? 1 : 0;
      out += '<path d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'A' + R + ' ' + R + ' 0 ' + lg + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
        'L' + xi1.toFixed(1) + ' ' + yi1.toFixed(1) + 'A' + r0 + ' ' + r0 + ' 0 ' + lg + ' 0 ' + xi0.toFixed(1) + ' ' + yi0.toFixed(1) + 'Z" fill="' + p.c + '" opacity=".92"/>';
      a0 = a1;
    });
    return '<div class="ck-donut"><svg viewBox="0 0 140 140">' + out +
      '<text x="70" y="66" text-anchor="middle" class="ck-dn-v">' + center + '</text>' +
      '<text x="70" y="82" text-anchor="middle" class="ck-dn-l">' + sub + '</text></svg>' +
      '<div class="ck-dn-legend">' + parts.map(function (p) {
        return '<span><i style="background:' + p.c + '"></i>' + p.n + ' <b>' + f1(p.v) + '%</b></span>';
      }).join('') + '</div></div>';
  }

  function radar(axes) {
    // axes: [{n, v(0-100), target}]
    var C = 84, R = 58, out = '', n = axes.length;
    function pt(i, rr) { var a = -Math.PI / 2 + i / n * Math.PI * 2; return [C + rr * Math.cos(a), C + rr * Math.sin(a)]; }
    [.25, .5, .75, 1].forEach(function (f) {
      var d = axes.map(function (_, i) { var p = pt(i, R * f); return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('') + 'Z';
      out += '<path d="' + d + '" fill="none" stroke="rgba(120,190,255,.14)"/>';
    });
    axes.forEach(function (a, i) { var p = pt(i, R); out += '<line x1="' + C + '" y1="' + C + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="rgba(120,190,255,.14)"/>'; });
    var dT = axes.map(function (a, i) { var p = pt(i, R * clamp(a.target, 0, 100) / 100); return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('') + 'Z';
    var dV = axes.map(function (a, i) { var p = pt(i, R * clamp(a.v, 0, 100) / 100); return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('') + 'Z';
    out += '<path d="' + dT + '" fill="none" stroke="#ffd166" stroke-width="1.2" stroke-dasharray="4 3"/>';
    out += '<path d="' + dV + '" fill="rgba(95,225,240,.22)" stroke="#5fe1f0" stroke-width="1.8"/>';
    axes.forEach(function (a, i) {
      var p = pt(i, R * clamp(a.v, 0, 100) / 100);
      out += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.4" fill="#5fe1f0"/>';
      var lp = pt(i, R + 20);
      out += '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 3.5).toFixed(1) + '" text-anchor="middle" class="ck-rd-l">' + a.n + '</text>' +
        '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 16).toFixed(1) + '" text-anchor="middle" class="ck-rd-v">' + f1(a.v) + '</text>';
    });
    return '<svg class="ck-radar" viewBox="0 0 168 186">' + out + '</svg>';
  }

  /* ==================== 6. 地图面板 ==================== */
  function mapValues(year, domain, metric) {
    var out = {};
    CODES.forEach(function (c) {
      var r = build(c, year);
      var d = Object.assign({}, r, domain === 'death'
        ? { cnt: r.deathsCum, rate: r.crudeD, asr: r.asrD }
        : { cnt: r.casesCum, rate: r.crude, asr: r.asr });
      out[c] = metric === 'cases' ? d.cnt : METRICS[metric].get(d);
    });
    return out;
  }

  function mapPanel() {
    var p = project();
    if (!GEO || !p) return '<div class="ck-panel"><div class="ck-p-title">江西行政区划地图</div><div class="ck-empty">未加载 jx-geo.js</div></div>';
    var metric = ST.metric, dom = DOMAIN[ST.domain];
    var vals = mapValues(ST.year, ST.domain, metric);
    var arr = CODES.map(function (c) { return vals[c]; });
    var mf = METRICS[metric].fmt;
    var label = metric === 'cases' ? dom.short + '病例数(例)' : (METRICS[metric].deathLabel && ST.domain === 'death' ? METRICS[metric].deathLabel : METRICS[metric].label);
    var lo = Math.min.apply(null, arr), hi = Math.max.apply(null, arr), pal = RAMP[dom.color];
    var g = '';
    GEO.cities.forEach(function (c) {
      var v = vals[c.code], col = ramp(v, arr, pal);
      var on = ST.city === c.code;
      var dim = ST.city && !on;
      g += '<path d="' + paths()[c.code] + '" data-ck-city="' + c.code + '" class="ck-region' + (on ? ' on' : '') + '" fill="' + col + '" opacity="' + (dim ? .42 : 1) + '"' + (on ? ' stroke="#ffd166" stroke-width="2.2"' : '') + '/>';
    });
    GEO.cities.forEach(function (c) {
      var nud = NUDGE[c.code] || [0, 0], x = p.x(c.centroid[0]) + nud[0], y = p.y(c.centroid[1]) + nud[1];
      var v = vals[c.code];
      g += '<text x="' + x.toFixed(1) + '" y="' + (y - 3).toFixed(1) + '" class="ck-lb-n" data-ck-city="' + c.code + '">' + c.name + '</text>' +
        '<text x="' + x.toFixed(1) + '" y="' + (y + 11).toFixed(1) + '" class="ck-lb-v" data-ck-city="' + c.code + '">' + num(v, mf) + '</text>';
      if (c.code === '360100') g += '<circle cx="' + (x - 0).toFixed(1) + '" cy="' + (y - 15).toFixed(1) + '" r="2.6" fill="#ffd166"/>';
    });
    // 图例
    var legend = '<div class="ck-legend-map"><div class="ck-legend-title">' + label + '</div>';
    for (var i = pal.length - 1; i >= 0; i--) {
      var b0 = lo + (hi - lo) * i / pal.length, b1 = lo + (hi - lo) * (i + 1) / pal.length;
      legend += '<span><i style="background:' + pal[i] + '"></i>' + num(b0, mf) + ' ~ ' + num(b1, mf) + '</span>';
    }
    legend += '</div>';
    var scopeChip = ST.city
      ? '<span class="ck-focus" data-ck-clear="1">聚焦：' + META[ST.city].f + ' ✕ 返回全省</span>'
      : '<span class="ck-scope">全省 11 设区市</span>';
    var maxCode = CODES.reduce(function (a, b) { return vals[a] >= vals[b] ? a : b; });
    return '<section class="ck-panel ck-mapwrap">' +
      '<header class="ck-p-head"><div class="ck-p-title">江西省行政区域 · ' + ST.year + ' 年' + dom.label + '分布</div>' +
      '<div class="ck-p-tools">' + scopeChip +
      '<select class="ck-sel ck-sel-dark" data-ck="metric">' + Object.keys(METRICS).map(function (k) {
        return '<option value="' + k + '"' + (k === metric ? ' selected' : '') + '>' + (k === 'cases' ? dom.short + '病例数(例)' : METRICS[k].label) + '</option>';
      }).join('') + '</select></div></header>' +
      '<div class="ck-map-body" id="ckMapBody">' +
      '<div class="ck-map-grid"></div>' +
      '<svg class="ck-map" viewBox="0 0 ' + p.w + ' ' + p.h + '" preserveAspectRatio="xMidYMid meet">' +
      '<defs><filter id="ckGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<g class="ck-map-inner">' + g + '</g></svg>' +
      legend +
      '<div class="ck-map-extras"><div class="ck-x-item"><span>峰值地市</span><b>' + META[maxCode].f + '</b></div>' +
      '<div class="ck-x-item"><span>地市极差</span><b>' + num(hi - lo, mf) + '</b></div>' +
      '<div class="ck-x-item"><span>登记机构</span><b>' + (ST.city ? META[ST.city].hosp : CODES.reduce(function (s, c) { return s + build(c, ST.year).hosp; }, 0)) + ' 家</b></div></div>' +
      '<div class="ck-tip" id="ckTip"></div>' +
      '</div></section>';
  }

  /* ==================== 7. 面板 ==================== */
  function kpiStrip() {
    var r = cur(), prev = ST.year > YEARS[0] ? cur(ST.year - 1) : null;
    var v = view(r), pv = prev ? view(prev) : null;
    var sparkInc = YEARS.map(function (y) { return cur(y).cases; });
    var sparkD = YEARS.map(function (y) { return cur(y).deaths; });
    function deltaTag(a, b, ratio, higherIsBetter) {
      if (b === undefined || b === null || !isFinite(b) || !isFinite(a) || b === 0) return '';
      var d = ratio ? (a - b) / b * 100 : a - b;
      var good = (higherIsBetter === false ? d <= 0 : d >= 0);
      return '<span class="ck-kpi-delta ' + (good ? 'up' : 'down') + '">' + (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '· ') +
        f1(Math.abs(d)) + (ratio ? '%' : '') + ' 较上年</span>';
    }
    function dm(key, higherIsBetter, ratio) { return deltaTag(r[key], prev ? prev[key] : null, !!ratio, higherIsBetter); }
    var dom = DOMAIN[ST.domain];
    var rateKey = ST.domain === 'inc' ? 'crude' : 'crudeD', asrKey = ST.domain === 'inc' ? 'asr' : 'asrD';
    var cntKey = ST.domain === 'inc' ? 'cases' : 'deaths';
    var cards = [
      {
        l: ST.year === CUR_YEAR ? '本年累计' + dom.short + '病例（1–' + CUR_MONTH + '月）' : '本年' + dom.short + '病例', u: '例',
        v: fmtInt(v.cnt), d: deltaTag(v.annual, pv ? pv.annual : null, true, true), s: ST.domain === 'inc' ? sparkInc : sparkD, c: ST.domain === 'inc' ? '#5fe1f0' : '#ff9f7a'
      },
      { l: '登记卡数', u: '张', v: fmtInt(v.cards), d: dm('cards', true, true), s: YEARS.map(function (y) { return cur(y).cards; }), c: '#7fd3f5' },
      { l: ST.domain === 'inc' ? '粗发病率' : '粗死亡率', u: '1/10万', v: f1(v.rate), d: dm(rateKey, false), s: YEARS.map(function (y) { return view(cur(y), ST.domain).rate; }), c: '#5fe1f0' },
      { l: ST.domain === 'inc' ? '中标发病率' : '中标死亡率', u: '1/10万', v: f1(v.asr), d: dm(asrKey, false), s: YEARS.map(function (y) { return view(cur(y), ST.domain).asr; }), c: '#9bd1ff' },
      {
        l: '死亡发病比 M/I', u: '', v: f2(r.mi),
        d: (r.mi <= QC.miMax && r.mi >= QC.miMin) ? '<span class="ck-kpi-delta ok">国家区间内</span>' : '<span class="ck-kpi-delta bad">偏离 0.55~0.85</span>',
        s: YEARS.map(function (y) { return cur(y).mi; }), c: '#ffd166'
      },
      {
        l: '病理确认 MV%', u: '%', v: f1(r.mv), tone: r.mv >= QC.mvMin ? 'ok' : 'bad',
        d: r.mv >= QC.mvMin ? '<span class="ck-kpi-delta ok">达标 ≥70%</span>' : '<span class="ck-kpi-delta bad">低于国家线</span>',
        s: YEARS.map(function (y) { return cur(y).mv; }), c: '#5fe1f0'
      },
      {
        l: 'DCO 占比', u: '%', v: f1(r.dco), tone: r.dco <= QC.dcoMax ? 'ok' : 'bad',
        d: r.dco <= QC.dcoMax ? '<span class="ck-kpi-delta ok">达标 ≤5%</span>' : '<span class="ck-kpi-delta bad">超国家线</span>',
        s: YEARS.map(function (y) { return cur(y).dco; }), c: '#ff9f7a'
      },
      { l: '随访完成率', u: '%', v: f1(r.fu), d: dm('fu', true), s: YEARS.map(function (y) { return cur(y).fu; }), c: '#6ee7b7' },
      { l: '国家平台上报率', u: '%', v: f1(r.nccr), d: dm('nccr', true), s: YEARS.map(function (y) { return cur(y).nccr; }), c: '#9bd1ff' },
      {
        l: '待处置预警', u: '条', v: fmtInt(r.warnPending), tone: 'warn',
        d: '<span class="ck-kpi-delta">在册 ' + fmtInt(r.warnA + r.warnB + r.warnC) + ' 条</span>',
        s: YEARS.map(function (y) { return cur(y).warnPending; }), c: '#ffd166'
      }
    ];
    return '<div class="ck-kpis">' + cards.map(function (c) {
      return '<div class="ck-kpi' + (c.tone ? ' ' + c.tone : '') + '">' +
        '<div class="ck-kpi-l">' + c.l + '</div>' +
        '<div class="ck-kpi-v">' + c.v + '<em>' + c.u + '</em></div>' +
        '<div class="ck-kpi-b">' + spark(c.s, c.c) + (c.d || '') + '</div></div>';
    }).join('') + '</div>';
  }

  function panelHead(title, tools) { return '<header class="ck-p-head"><div class="ck-p-title">' + title + '</div><div class="ck-p-tools">' + (tools || '') + '</div></header>'; }

  function trendPanel() {
    var recs = YEARS.map(function (yy) { return cur(yy); });
    return '<section class="ck-panel">' + panelHead('近 6 年' + (ST.city ? META[ST.city].n : '全省') + '发病 / 死亡登记趋势') +
      trendChart(recs) + '</section>';
  }
  function monthPanel() {
    return '<section class="ck-panel">' + panelHead(ST.year + ' 年逐月' + DOMAIN[ST.domain].label + '量') +
      monthChart([cur()]) + '</section>';
  }
  function agePanel() {
    return '<section class="ck-panel">' + panelHead('年龄别构成（' + DOMAIN[ST.domain].short + '）') +
      pyramid(cur()) + '</section>';
  }
  function sitePanel() {
    var r = cur(), v = view(r);
    var items = SITES.map(function (s, i) {
      return { name: s.n, icd: s.icd, pct: v.sites[i], val: v.cnt * v.sites[i] / 100 };
    }).sort(function (a, b) { return b.pct - a.pct; }).slice(0, 10);
    return '<section class="ck-panel">' + panelHead('高发部位 TOP10') +
      hbars(items, ST.domain) + '</section>';
  }
  function qcPanel() {
    return '<section class="ck-panel">' + panelHead('登记质量对标国家阈值') + qcGauges(cur()) + '</section>';
  }
  function rankPanel() {
    var arr = CODES.map(function (c) {
      var r = build(c, ST.year), v = view(r);
      return { c: c, n: r.name, val: v.cnt, rate: v.rate, asr: v.asr, mi: r.mi, warn: r.warnPending };
    }).sort(function (a, b) { return b.val - a.val; });
    var hi = arr[0].val;
    return '<section class="ck-panel">' + panelHead('地市' + DOMAIN[ST.domain].short + '登记量 TOP5') +
      '<div class="ck-rank">' + arr.slice(0, 5).map(function (it, i) {
        return '<div class="ck-rank-row' + (ST.city === it.c ? ' on' : '') + '" data-ck-pick="' + it.c + '">' +
          '<b class="ck-rank-no r' + (i + 1) + '">' + (i + 1) + '</b>' +
          '<div class="ck-rank-name">' + it.n + '<em>' + f1(it.rate) + '/10万</em></div>' +
          '<div class="ck-rank-track"><i style="width:' + (it.val / hi * 100).toFixed(1) + '%"></i></div>' +
          '<div class="ck-rank-val">' + fmtInt(it.val) + '</div></div>';
      }).join('') + '</div></section>';
  }
  function funnelPanel() {
    return '<section class="ck-panel">' + panelHead('登记上报全流程闭环') + funnel(cur()) + '</section>';
  }
  function warnPanel() {
    var r = cur();
    var L = [['A', '登记运行', r.warnA, '#5fe1f0'], ['B', '登记质量', r.warnB, '#ffd166'], ['C', '疾病信号', r.warnC, '#ff8fa3']];
    var list = warnList(r);
    return '<section class="ck-panel">' + panelHead('三层预警与处置', '<button class="ck-btn" onclick="navigateTo(\'warning-records\')">预警记录</button>') +
      '<div class="ck-warn-top">' + L.map(function (x) {
        return '<div class="ck-warn-cell" style="--wc:' + x[3] + '"><b>' + x[2] + '</b><span>' + x[0] + ' · ' + x[1] + '</span></div>';
      }).join('') +
      '<div class="ck-warn-cell" style="--wc:#6ee7b7"><b>' + r.warnClosed + '</b><span>已闭环</span></div></div>' +
      '<div class="ck-warn-list">' + list.map(function (w) {
        return '<div class="ck-warn-item"><i class="ck-dot ' + w.lv + '"></i><div class="ck-warn-txt"><b>' + esc(w.t) + '</b><span>' + w.c + ' · ' + w.time + '</span></div><em>' + w.tag + '</em></div>';
      }).join('') + '</div></section>';
  }
  function warnList(r) {
    var rr = rnd(hash('wk' + (ST.city || 'all') + ST.year)), out = [];
    var pool = [
      { lv: 'a', tag: 'A 登记运行', t: '月度登记量环比下降超过 20%' },
      { lv: 'a', tag: 'A 登记运行', t: '医疗机构零上报超期 45 天' },
      { lv: 'b', tag: 'B 登记质量', t: 'DCO 占比高于国家阈值 1.4 个百分点' },
      { lv: 'b', tag: 'B 登记质量', t: '病理确认率连续 2 个季度低于 70%' },
      { lv: 'b', tag: 'B 登记质量', t: 'M/I 比超出国家参考区间上限' },
      { lv: 'c', tag: 'C 疾病信号', t: '肺恶性肿瘤标化率聚集性上升' },
      { lv: 'c', tag: 'C 疾病信号', t: '结直肠高发年龄段前移至 45 岁' },
      { lv: 'a', tag: 'A 登记运行', t: '重卡合并待处置积压 128 条' },
      { lv: 'b', tag: 'B 登记质量', t: 'TNM 分期缺失率超过 15%' },
      { lv: 'c', tag: 'C 疾病信号', t: '甲状腺过度诊断信号持续 3 年' }
    ];
    var cities = ST.city ? [META[ST.city].f] : CODES.map(function (c) { return META[c].f; });
    var idx = [];
    while (idx.length < 6) { var i = Math.floor(rr() * pool.length); if (idx.indexOf(i) < 0) idx.push(i); }
    idx.forEach(function (i, k) {
      var p = pool[i], mm = Math.floor(rr() * CUR_MONTH) + 1, dd = Math.floor(rr() * 27) + 1;
      out.push({
        lv: p.lv, tag: p.tag, t: p.t + '（' + (p.lv === 'b' ? (f1(2 + rr() * 3)) : (Math.floor(10 + rr() * 30))) + '%）',
        c: cities[Math.floor(rr() * cities.length)], time: (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd
      });
    });
    return out;
  }

  function tablePanel() {
    var rows = CODES.map(function (c) { return build(c, ST.year); });
    var total = agg(CODES, ST.year);
    function cell(val, ok) { return '<td class="ck-num' + (ok === undefined ? '' : ok ? ' good' : ' bad') + '">' + val + '</td>'; }
    var body = rows.map(function (r) {
      var v = view(r);
      return '<tr class="' + (ST.city === r.code ? 'on' : '') + '" data-ck-pick="' + r.code + '">' +
        '<td class="ck-city"><b>' + r.full + '</b><em>常住人口 ' + f1(r.pop) + ' 万 · 机构 ' + r.hosp + ' 家</em></td>' +
        '<td class="ck-num strong">' + fmtInt(v.cnt) + '</td>' +
        cell(f1(v.rate)) + cell(f1(v.asr)) +
        cell(f2(r.mi), r.mi >= QC.miMin && r.mi <= QC.miMax) +
        cell(f1(r.mv) + '%', r.mv >= QC.mvMin) +
        cell(f1(r.dco) + '%', r.dco <= QC.dcoMax) +
        cell(f1(r.ub) + '%', r.ub <= QC.ubMax) +
        cell(f1(r.dup) + '%', r.dup <= 3) +
        cell(f1(r.fu) + '%', r.fu >= 80) +
        cell(f1(r.nccr) + '%', r.nccr >= 96) +
        cell(fmtInt(r.warnPending), r.warnPending <= 12) +
        '<td class="ck-op"><button class="ck-link" data-ck-pick="' + r.code + '">聚焦</button><button class="ck-link" data-ck-detail="' + r.code + '">详情</button></td>' +
        '</tr>';
    }).join('');
    var tv = view(total);
    body += '<tr class="ck-total"><td class="ck-city"><b>全省合计</b><em>常住人口 ' + f1(total.pop) + ' 万 · 机构 ' + total.hosp + ' 家</em></td>' +
      '<td class="ck-num strong">' + fmtInt(tv.cnt) + '</td><td class="ck-num">' + f1(tv.rate) + '</td><td class="ck-num">' + f1(tv.asr) + '</td>' +
      '<td class="ck-num">' + f2(total.mi) + '</td><td class="ck-num">' + f1(total.mv) + '%</td><td class="ck-num">' + f1(total.dco) + '%</td>' +
      '<td class="ck-num">' + f1(total.ub) + '%</td><td class="ck-num">' + f1(total.dup) + '%</td><td class="ck-num">' + f1(total.fu) + '%</td>' +
      '<td class="ck-num">' + f1(total.nccr) + '%</td><td class="ck-num">' + fmtInt(total.warnPending) + '</td>' +
      '<td class="ck-op"><button class="ck-link" data-ck-clear="1">全省</button></td></tr>';
    return '<section class="ck-panel">' + panelHead(ST.year + ' 年各地市核心指标明细',
      '<button class="ck-btn" onclick="navigateTo(\'analysis-stats\')">统计分析</button>' +
      '<button class="ck-btn" onclick="ckExport()">导出大屏数据</button>') +
      '<div class="ck-tblwrap"><table class="ck-tbl"><thead><tr>' +
      '<th>地市</th><th class="ck-num">' + DOMAIN[ST.domain].short + (ST.year === CUR_YEAR ? '累计（1–' + CUR_MONTH + '月）' : '（例）') + '</th><th class="ck-num">粗率(年化)</th><th class="ck-num">中标率</th>' +
      '<th class="ck-num">M/I</th><th class="ck-num">MV%</th><th class="ck-num">DCO%</th><th class="ck-num">UB%</th>' +
      '<th class="ck-num">重卡率</th><th class="ck-num">随访率</th><th class="ck-num">上报率</th><th class="ck-num">待处置</th><th>操作</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div></section>';
  }

  /* ==================== 8. 地市详情弹窗 ==================== */
  function openCityModal(code, year) {
    var wrap = document.createElement('div');
    wrap.innerHTML = cityModalHtml(code, year);
    document.body.appendChild(wrap.firstChild);
  }
  function cityModalHtml(code, year) {
    var yy = year || ST.year;
    var r = build(code, yy), v = view(r), cs = countyRows(code, yy, ST.domain);
    var stage = [
      { n: 'Ⅰ 期', v: r.stage.I, c: '#5fe1f0' }, { n: 'Ⅱ 期', v: r.stage.II, c: '#3fb8dd' },
      { n: 'Ⅲ 期', v: r.stage.III, c: '#ffd166' }, { n: 'Ⅳ 期', v: r.stage.IV, c: '#ff8fa3' },
      { n: '未分期', v: r.stage.U, c: '#7b8ea6' }
    ];
    var top = SITES.map(function (s, i) { return { name: s.n, icd: s.icd, pct: v.sites[i], val: v.cnt * v.sites[i] / 100 }; })
      .sort(function (a, b) { return b.pct - a.pct; }).slice(0, 5);
    var radarAxes = [
      { n: 'MV%', v: clamp(r.mv, 0, 100), target: QC.mvMin },
      { n: 'DCO', v: clamp(100 - r.dco / 12 * 100, 0, 100), target: 100 - QC.dcoMax / 12 * 100 },
      { n: 'UB', v: clamp(100 - r.ub / 12 * 100, 0, 100), target: 100 - QC.ubMax / 12 * 100 },
      { n: 'M/I', v: clamp((1 - Math.abs(r.mi - .7) / .3) * 100, 0, 100), target: 80 },
      { n: '随访', v: r.fu, target: 85 },
      { n: '上报', v: r.nccr, target: 96 }
    ];
    var rows = cs.map(function (c) {
      return '<tr><td>' + c.name + '</td><td class="ck-num">' + f1(c.pop) + '</td><td class="ck-num">' + fmtInt(domainCnt(c)) + '</td>' +
        '<td class="ck-num">' + f1(ST.domain === 'death' ? c.deaths / (c.pop * 1e4) * 1e5 : c.crude) + '</td>' +
        '<td class="ck-num' + (c.mv >= QC.mvMin ? ' good' : ' bad') + '">' + f1(c.mv) + '%</td>' +
        '<td class="ck-num' + (c.dco <= QC.dcoMax ? ' good' : ' bad') + '">' + f1(c.dco) + '%</td>' +
        '<td class="ck-num">' + fmtInt(c.hosp) + '</td><td class="ck-num">' + c.warn + '</td></tr>';
    }).join('');
    function domainCnt(c) { return ST.domain === 'death' ? c.deaths : c.cases; }
    var html = '<div class="ck-modal" id="ckModal"><div class="ck-mbox"><div class="ck-mhead">' +
      '<div class="ck-mtitle">' + r.full + ' · ' + yy + ' 年' + DOMAIN[ST.domain].label + '详情' +
      '<span class="ck-msub">常住人口 ' + f1(r.pop) + ' 万 · 登记机构 ' + r.hosp + ' 家 · 县区 ' + cs.length + ' 个</span></div>' +
      '<button class="ck-mclose" onclick="ckCloseModal()">✕</button></div>' +
      '<div class="ck-mbody">' +
      '<div class="ck-mstats">' +
      mstat(DOMAIN[ST.domain].short + (ST.year === CUR_YEAR ? '累计（例）' : '（例）'), fmtInt(v.cnt)) + mstat('粗率（1/10万·年化）', f1(v.rate)) +
      mstat('中标率（1/10万）', f1(v.asr)) + mstat('M/I', f2(r.mi)) + mstat('登记卡数', fmtInt(v.cards)) +
      mstat('重卡率', f1(r.dup) + '%') + '</div>' +
      '<div class="ck-mgrid">' +
      '<div class="ck-mcard"><div class="ck-mc-title">质控六维达标度</div>' + radar(radarAxes) +
      '</div>' +
      '<div class="ck-mcard"><div class="ck-mc-title">临床分期构成</div>' + donut(stage, f1(r.stage.I + r.stage.II) + '%', '早诊占比') + '</div>' +
      '<div class="ck-mcard"><div class="ck-mc-title">' + DOMAIN[ST.domain].short + '部位 TOP5</div>' + hbars(top, ST.domain) + '</div>' +
      '<div class="ck-mcard wide"><div class="ck-mc-title">县（市、区）登记明细</div>' +
      '<div class="ck-mtable"><table class="ck-tbl"><thead><tr><th>县区</th><th class="ck-num">常住(万)</th><th class="ck-num">' + DOMAIN[ST.domain].short + (ST.year === CUR_YEAR ? '累计（例）' : '（例）') + '</th>' +
      '<th class="ck-num">粗率(年化)</th><th class="ck-num">MV%</th><th class="ck-num">DCO%</th><th class="ck-num">机构</th><th class="ck-num">预警</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '</div>' +
      '<div class="ck-mfoot"><button class="ck-btn" onclick="navigateTo(\'datamgmt-card\')">查看报告卡</button>' +
      '<button class="ck-btn" onclick="navigateTo(\'warning-records\')">关联预警记录</button>' +
      '<button class="ck-btn" onclick="navigateTo(\'analysis-stats\')">统计分析报表</button>' +
      '<button class="ck-btn primary" onclick="ckCloseModal()">关闭</button></div>' +
      '</div></div></div>';
    return html;
  }
  function mstat(l, v) { return '<div class="ck-mstat"><span>' + l + '</span><b>' + v + '</b></div>'; }

  /* ==================== 9. 骨架 ==================== */
  function header() {
    var r = cur();
    return '<header class="ck-head"><div class="ck-brand">' +
      '<div class="ck-logo"><svg viewBox="0 0 32 32"><path d="M16 2l12 6v9c0 7-5.4 11.6-12 13.8C9.4 28.6 4 24 4 17V8z" fill="none" stroke="#5fe1f0" stroke-width="1.6" opacity=".85"/>' +
      '<path d="M10 17h3l2-5 3 9 2-4h3" fill="none" stroke="#ffd166" stroke-width="1.8" stroke-linecap="round"/></svg></div>' +
      '<div class="ck-title"><h1>江西省肿瘤登记与防控预警总览</h1>' +
      '<div class="ck-title-sub"><span class="ck-live"><i></i>实时</span></div></div></div>' +
      '<div class="ck-tools">' +
      '<label class="ck-tool">年度<select class="ck-sel" data-ck="year">' + YEARS.slice().reverse().map(function (yy) {
        return '<option value="' + yy + '"' + (yy === ST.year ? ' selected' : '') + '>' + yy + '</option>';
      }).join('') + '</select></label>' +
      '<div class="ck-seg" data-ck-seg="domain">' +
      '<button class="' + (ST.domain === 'inc' ? 'on' : '') + '" data-ck-domain="inc">发病登记</button>' +
      '<button class="' + (ST.domain === 'death' ? 'on' : '') + '" data-ck-domain="death">死亡登记</button></div>' +
      '<select class="ck-sel" data-ck="city"><option value="">全省 11 个设区市</option>' + CODES.map(function (c) {
        return '<option value="' + c + '"' + (ST.city === c ? ' selected' : '') + '>' + META[c].f + '</option>';
      }).join('') + '</select>' +
      '<span class="ck-clock" id="ckClock"></span>' +
      '<button class="ck-btn" onclick="ckRefresh()">刷新</button>' +
      '<button class="ck-btn primary" onclick="ckToggleFs()">' + (ST.fs ? '退出大屏' : '大屏模式') + '</button>' +
      '</div></header>';
  }

  function shell() {
    return '<div class="ck' + (ST.fs ? ' fs' : '') + '">' + header() +
      '<div class="ck-kpi-row">' + kpiStrip() + '</div>' +
      '<div class="ck-grid">' +
      '<div class="ck-col">' + trendPanel() + agePanel() + warnPanel() + '</div>' +
      '<div class="ck-col ck-col-c">' + mapPanel() + monthPanel() + funnelPanel() + '</div>' +
      '<div class="ck-col">' + sitePanel() + qcPanel() + rankPanel() + '</div>' +
      '</div>' +
      '<div class="ck-tbl-row">' + tablePanel() + '</div>' +
      '</div>' +
      '<footer class="ck-foot"><span>' + (ST.city ? META[ST.city].f : '江西省') + ' · ' + ST.year + ' 年度 · 数据截至 ' + cutoff() + '</span>' +
      '</footer>' +
      '</div>';
  }
  function cutoff() {
    var d = ST.year < CUR_YEAR ? new Date(ST.year, 11, 31) : new Date(CUR_YEAR, CUR_MONTH, 0);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /* ==================== 10. 挂载与交互 ==================== */
  var timer = null;
  function mount() {
    var box = document.getElementById('pageContainer');
    if (!box) return;
    box.innerHTML = shell();
    bindMap();
    var main = document.getElementById('mainContent');
    if (main) main.scrollTop = 0;
    tick();
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 1000);
  }
  function tick() {
    var el = document.getElementById('ckClock');
    if (!el) { clearInterval(timer); timer = null; return; }
    var d = new Date();
    el.textContent = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + ' ' +
      ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }
  function rerender() { mount(); }

  function bindMap() {
    var body = document.getElementById('ckMapBody');
    if (!body) return;
    var tip = document.getElementById('ckTip');
    body.addEventListener('mousemove', function (e) {
      var c = e.target && e.target.getAttribute ? e.target.getAttribute('data-ck-city') : '';
      if (!c) { tip.style.display = 'none'; return; }
      var r = build(c, ST.year), v = view(r);
      tip.innerHTML = '<div class="ck-tip-h">' + r.full + '<span>' + ST.year + ' · ' + DOMAIN[ST.domain].label + '</span></div>' +
        '<div class="ck-tip-row"><span>' + DOMAIN[ST.domain].short + '</span><b>' + fmtInt(v.cnt) + ' 例</b></div>' +
        '<div class="ck-tip-row"><span>粗' + (ST.domain === 'death' ? '死亡率' : '发病率') + '</span><b>' + f1(v.rate) + ' /10万</b></div>' +
        '<div class="ck-tip-row"><span>中标率</span><b>' + f1(v.asr) + ' /10万</b></div>' +
        '<div class="ck-tip-row"><span>M/I 比</span><b>' + f2(r.mi) + '</b></div>' +
        '<div class="ck-tip-row"><span>MV% / DCO%</span><b>' + f1(r.mv) + '% / ' + f1(r.dco) + '%</b></div>' +
        '<div class="ck-tip-row"><span>随访完成率</span><b>' + f1(r.fu) + '%</b></div>' +
        '<div class="ck-tip-row"><span>待处置预警</span><b>' + r.warnPending + ' 条</b></div>' +
        '';
      tip.style.display = 'block';
      var rect = body.getBoundingClientRect();
      var x = e.clientX - rect.left + 16, yy = e.clientY - rect.top + 12;
      if (x + 226 > rect.width) x = e.clientX - rect.left - 236;
      if (yy + 200 > rect.height) yy = Math.max(4, rect.height - 204);
      tip.style.left = x + 'px'; tip.style.top = yy + 'px';
    });
    body.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    body.addEventListener('click', function (e) {
      var c = e.target && e.target.getAttribute ? e.target.getAttribute('data-ck-city') : '';
      if (!c) return;
      ckCity(ST.city === c ? '' : c);
    });
    document.querySelectorAll('#pageContainer [data-ck-pick]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        var c = ev.currentTarget.getAttribute('data-ck-pick');
        if (c) ckCity(ST.city === c ? '' : c);
      });
    });
    document.querySelectorAll('#pageContainer [data-ck-detail]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openCityModal(ev.currentTarget.getAttribute('data-ck-detail'));
      });
    });
    document.querySelectorAll('#pageContainer [data-ck-clear]').forEach(function (el) {
      el.addEventListener('click', function (ev) { ev.stopPropagation(); ckCity(''); });
    });
    document.querySelectorAll('#pageContainer [data-ck]').forEach(function (el) {
      el.addEventListener('change', function (ev) {
        var k = ev.currentTarget.getAttribute('data-ck');
        if (k === 'year') ST.year = +ev.currentTarget.value;
        if (k === 'metric') ST.metric = ev.currentTarget.value;
        if (k === 'city') ST.city = ev.currentTarget.value;
        rerender();
      });
    });
    document.querySelectorAll('#pageContainer [data-ck-domain]').forEach(function (el) {
      el.addEventListener('click', function (ev) { ST.domain = ev.currentTarget.getAttribute('data-ck-domain'); rerender(); });
    });
  }

  function ckCity(code) {
    ST.city = code || '';
    rerender();
    toast(code ? '已聚焦 ' + META[code].f + '（再次单击地图或选「全省」返回）' : '已返回全省视角');
  }
  function ckToggleFs() {
    ST.fs = !ST.fs;
    document.body.classList.toggle('ck-fs', ST.fs);
    rerender();
    toast(ST.fs ? '已进入大屏模式，按 Esc 退出' : '已退出大屏模式');
  }
  function ckRefresh() { CACHE = {}; rerender(); toast('预警数据已刷新'); }
  function ckCloseModal() {
    var m = document.getElementById('ckModal');
    if (m) m.parentNode.removeChild(m);
  }
  function ckExport() {
    var r = cur(), arr = CODES.map(function (c) {
      var x = build(c, ST.year), v = view(x);
      return [x.full, v.cnt, f1(v.rate), f1(v.asr), f2(x.mi), f1(x.mv), f1(x.dco), f1(x.ub), f1(x.dup), f1(x.fu), f1(x.nccr), x.warnPending].join('\t');
    });
    var head = ['地市', DOMAIN[ST.domain].short + '(例)', '粗率(1/10万)', '中标率', 'M/I', 'MV%', 'DCO%', 'UB%', '重卡率', '随访率', '上报率', '待处置预警'].join('\t');
    try {
      var ta = document.createElement('textarea');
      ta.value = ST.year + ' 年 ' + (ST.city ? META[ST.city].f : '江西省') + ' 预警总览指标\t' + DOMAIN[ST.domain].label + '\n' + head + '\n' + arr.join('\n') + '\n合计\t' + fmtInt(view(r).cnt) + '\t' + f1(view(r).rate);
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      toast('大屏指标已复制到剪贴板（' + CODES.length + ' 个地市）');
    } catch (e) { toast('复制失败，请在统计分析页面导出', 'error'); }
  }

  window.ckCity = ckCity;
  window.ckToggleFs = ckToggleFs;
  window.ckRefresh = ckRefresh;
  window.ckCloseModal = ckCloseModal;
  window.ckExport = ckExport;
  window.ckCityModal = openCityModal;
  window.ckCityModalHtml = cityModalHtml;
  // 对外入口：其他模块可用 ckOpen({city:'360700',domain:'death',year:2025}) 直达并预置筛选
  window.ckOpen = function (opts) {
    opts = opts || {};
    if (opts.year && YEARS.indexOf(+opts.year) >= 0) ST.year = +opts.year;
    if (opts.domain && DOMAIN[opts.domain]) ST.domain = opts.domain;
    if (opts.metric && METRICS[opts.metric]) ST.metric = opts.metric;
    if (opts.city !== undefined) ST.city = META[opts.city] ? opts.city : '';
    if (typeof window.navigateTo === 'function') window.navigateTo(PAGE); else mount();
  };
  window.ckGetState = function () { return { year: ST.year, domain: ST.domain, metric: ST.metric, city: ST.city, fs: ST.fs }; };
  window.cockpitPageIds = [PAGE];
  window.renderCockpitPage = function (id) { if (id === PAGE) mount(); };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var m = document.getElementById('ckModal');
      if (m) { ckCloseModal(); return; }
      if (ST.fs) ckToggleFs();
    }
  });

  /* ==================== 11. 样式 ==================== */
  var css = [
    '.ck{--line:rgba(120,190,255,.16);--line2:rgba(120,190,255,.28);--cy:#5fe1f0;--gd:#ffd166;--tx:#cfe4f7;--mu:#7d95b3;',
    'position:relative;margin:-20px;padding:0 0 16px;background:radial-gradient(1200px 600px at 50% -180px,#0d2c4d 0%,#071726 55%,#050e18 100%);',
    'color:var(--tx);font-family:"Microsoft YaHei","PingFang SC",-apple-system,"Segoe UI",sans-serif;border-bottom:0}',
    '.ck::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(120,190,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(120,190,255,.05) 1px,transparent 1px);background-size:40px 40px}',
    '.ck>*{position:relative;z-index:1}',
    '.ck.fs{position:fixed;inset:0;z-index:1500;overflow:auto;min-width:1220px;margin:0;padding:0 0 12px}',
    'body.ck-fs .sidebar,body.ck-fs .breadcrumb{display:none!important}',
    'body.ck-fs .main-content{left:0!important;padding:0!important;overflow:hidden!important}',
    /* 头部 */
    '.ck-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 20px 12px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,rgba(18,58,96,.55),rgba(8,24,40,.05))}',
    '.ck-brand{display:flex;align-items:center;gap:12px;min-width:0}',
    '.ck-logo{width:38px;height:38px;filter:drop-shadow(0 0 10px rgba(95,225,240,.5))}',
    '.ck-title h1{margin:0;font-size:20px;font-weight:800;letter-spacing:2px;background:linear-gradient(90deg,#eaf7ff,#5fe1f0 60%,#a9e8ff);-webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap}',
    '.ck-title-sub{display:flex;align-items:center;gap:10px;margin-top:3px;font-size:11.5px;color:var(--mu);letter-spacing:1px}',
    '.ck-live{display:inline-flex;align-items:center;gap:5px;color:#6ee7b7;font-size:11px}',
    '.ck-live i{width:6px;height:6px;border-radius:50%;background:#6ee7b7;box-shadow:0 0 8px #6ee7b7;animation:ckPulse 1.6s infinite}',
    '@keyframes ckPulse{0%,100%{opacity:1}50%{opacity:.25}}',
    '.ck-tools{display:flex;align-items:center;gap:9px;flex-wrap:wrap}',
    '.ck-tool{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--mu)}',
    '.ck-clock{font-size:12px;color:var(--cy);font-variant-numeric:tabular-nums;letter-spacing:.5px;padding:0 4px}',
    '.ck-sel{height:29px;background:#0b2338;color:var(--tx);border:1px solid var(--line2);border-radius:4px;padding:0 8px;font-size:12.5px;outline:none}',
    '.ck-sel-dark{height:26px;font-size:12px}',
    '.ck-seg{display:flex;border:1px solid var(--line2);border-radius:4px;overflow:hidden}',
    '.ck-seg button{appearance:none;border:0;background:transparent;color:var(--mu);padding:0 12px;height:29px;font-size:12.5px;cursor:pointer;font-family:inherit}',
    '.ck-seg button.on{background:linear-gradient(180deg,#1a6fa0,#124a72);color:#eafcff;text-shadow:0 0 8px rgba(95,225,240,.6)}',
    '.ck-btn{appearance:none;height:29px;padding:0 12px;border:1px solid var(--line2);border-radius:4px;background:rgba(18,58,96,.35);color:var(--tx);font-size:12.5px;cursor:pointer;font-family:inherit}',
    '.ck-btn:hover{border-color:var(--cy);color:#eafcff}',
    '.ck-btn.primary{background:linear-gradient(180deg,#22a5c9,#146f92);border-color:#2fd0e6;color:#03131d;font-weight:700}',
    /* KPI */
    '.ck-kpi-row{padding:12px 20px 0}',
    '.ck-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}',
    '@media(max-width:1500px){.ck-kpis{grid-template-columns:repeat(auto-fit,minmax(178px,1fr))}}',
    '.ck-kpi{position:relative;overflow:hidden;padding:10px 12px 9px;border:1px solid var(--line);border-radius:5px;background:linear-gradient(160deg,rgba(20,64,104,.5),rgba(8,24,40,.55))}',
    '.ck-kpi::after{content:"";position:absolute;left:0;top:0;width:2px;height:100%;background:var(--cy);opacity:.75}',
    '.ck-kpi.ok::after{background:#6ee7b7}.ck-kpi.bad::after{background:#ff6f85}.ck-kpi.warn::after{background:var(--gd)}',
    '.ck-kpi-l{font-size:11.5px;color:var(--mu);letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ck-kpi-v{margin-top:4px;font-size:24px;font-weight:800;color:#eafaff;font-variant-numeric:tabular-nums;line-height:1.15}',
    '.ck-kpi-v em{margin-left:4px;font-size:11px;font-style:normal;color:var(--mu);font-weight:400}',
    '.ck-kpi-b{display:flex;align-items:flex-end;justify-content:space-between;gap:6px;margin-top:2px}',
    '.ck-spark{width:76px;height:22px;flex:0 0 76px}',
    '.ck-kpi-delta{font-size:11px;color:var(--mu);white-space:nowrap}',
    '.ck-kpi-delta.up{color:#6ee7b7}.ck-kpi-delta.down{color:#ff8fa3}.ck-kpi-delta.ok{color:#6ee7b7}.ck-kpi-delta.bad{color:#ff8fa3}',
    /* 栅格 */
    '.ck-grid{display:grid;grid-template-columns:minmax(280px,1fr) minmax(430px,1.6fr) minmax(280px,1fr);gap:10px;padding:10px 20px 0;align-items:start}',
    '.ck-col{display:flex;flex-direction:column;gap:10px;min-width:0}',
    '.ck-tbl-row{padding:10px 20px 0}',
    /* 面板 */
    '.ck-panel{position:relative;border:1px solid var(--line);border-radius:5px;background:linear-gradient(180deg,rgba(14,44,74,.62),rgba(7,20,34,.72));padding:0 0 8px;animation:ckIn .45s both}',
    '.ck-panel::before,.ck-panel::after{content:"";position:absolute;width:12px;height:12px;pointer-events:none;border-color:var(--cy);opacity:.65}',
    '.ck-panel::before{left:-1px;top:-1px;border-left:2px solid;border-top:2px solid;border-top-left-radius:5px}',
    '.ck-panel::after{right:-1px;bottom:-1px;border-right:2px solid;border-bottom:2px solid;border-bottom-right-radius:5px}',
    '@keyframes ckIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '.ck-p-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line)}',
    '.ck-p-title{position:relative;padding-left:9px;font-size:13px;font-weight:700;color:#dff3ff;letter-spacing:.6px}',
    '.ck-p-title::before{content:"";position:absolute;left:0;top:2px;width:3px;height:12px;background:linear-gradient(180deg,var(--cy),#1c6f9e)}',
    '.ck-p-tools{display:flex;align-items:center;gap:8px}',

    '.ck-scope,.ck-focus{font-size:11.5px;color:var(--mu);border:1px dashed var(--line2);border-radius:3px;padding:2px 7px}',
    '.ck-focus{color:var(--gd);border-color:rgba(255,209,102,.5);border-style:solid;cursor:pointer}',
    '.ck-svg{display:block;width:100%;height:150px}',
    '.ck-mapwrap .ck-svg,.ck-svg{min-height:120px}',
    '.ck-ax{font-size:9.5px;fill:#7d95b3}',
    '.ck-py-v{font-size:10px;fill:#cfe4f7;font-variant-numeric:tabular-nums}',
    '.ck-py-g{font-size:9.5px;fill:#eaf6ff;paint-order:stroke;stroke:#071522;stroke-width:3.2px;stroke-linejoin:round}',
    '.ck-vl{font-size:10.5px;font-weight:700}',
    '.ck-legend{display:flex;gap:14px;justify-content:center;padding:2px 0 4px;font-size:11px;color:var(--mu)}',
    '.ck-legend span{display:inline-flex;align-items:center;gap:5px}',
    '.ck-legend i{width:10px;height:3px;border-radius:2px}',
    /* 地图 */
    '.ck-map-body{position:relative;height:400px;padding:4px 8px 0}',
    '.ck.fs .ck-map-body{height:456px}',
    '.ck-map-grid{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(120,190,255,.14) 1px,transparent 1px);background-size:26px 26px;opacity:.5;pointer-events:none}',
    '.ck-map{position:relative;width:100%;height:100%}',
    '.ck-region{stroke:rgba(140,215,255,.55);stroke-width:.9;cursor:pointer;transition:fill .2s,opacity .2s}',
    '.ck-region:hover{stroke:#fff;stroke-width:1.6;filter:brightness(1.35)}',
    '.ck-region.on{filter:brightness(1.35) drop-shadow(0 0 8px rgba(255,209,102,.65))}',
    '.ck-lb-n{font-size:13px;fill:#e7f6ff;text-anchor:middle;pointer-events:none;paint-order:stroke;stroke:rgba(4,14,24,.85);stroke-width:3px;letter-spacing:1px;font-weight:700}',
    '.ck-lb-v{font-size:11px;fill:#9fd8f2;text-anchor:middle;pointer-events:none;paint-order:stroke;stroke:rgba(4,14,24,.8);stroke-width:3px;font-variant-numeric:tabular-nums}',
    '.ck-legend-map{position:absolute;left:12px;bottom:8px;padding:7px 9px;border:1px solid var(--line);border-radius:4px;background:rgba(6,18,30,.72);font-size:10.5px;color:var(--mu)}',
    '.ck-legend-title{font-size:11px;color:#dff3ff;margin-bottom:4px}',
    '.ck-legend-map span{display:flex;align-items:center;gap:6px;line-height:17px;font-variant-numeric:tabular-nums}',
    '.ck-legend-map i{width:14px;height:8px;border-radius:1px;border:1px solid rgba(255,255,255,.14)}',
    '.ck-map-extras{position:absolute;right:12px;top:10px;display:flex;flex-direction:column;gap:6px}',
    '.ck-x-item{padding:5px 9px;border:1px solid var(--line);border-left:2px solid var(--gd);border-radius:3px;background:rgba(6,18,30,.6);font-size:11px;color:var(--mu);white-space:nowrap}',
    '.ck-x-item b{margin-left:6px;color:#eafaff;font-variant-numeric:tabular-nums}',
    '.ck-tip{position:absolute;display:none;z-index:5;width:222px;padding:8px 10px;border:1px solid rgba(95,225,240,.45);border-radius:4px;background:rgba(5,17,28,.94);box-shadow:0 8px 24px rgba(0,0,0,.5);pointer-events:none}',
    '.ck-tip-h{font-size:13px;font-weight:700;color:#eafaff;display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:5px;margin-bottom:5px}',
    '.ck-tip-h span{font-size:10.5px;color:var(--mu);font-weight:400}',
    '.ck-tip-row{display:flex;justify-content:space-between;font-size:11.5px;line-height:19px;color:var(--mu)}',
    '.ck-tip-row b{color:#cfeeff;font-variant-numeric:tabular-nums}',

    /* 横向条 */
    '.ck-hb{padding:8px 12px 4px}',
    '.ck-hb-row{display:flex;align-items:center;gap:8px;margin-bottom:5px}',
    '.ck-hb-name{flex:0 0 96px;font-size:12px;color:#cfe4f7;display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden}',
    '.ck-hb-name b{flex:0 0 15px;height:15px;line-height:15px;text-align:center;font-size:10px;color:#04121d;background:var(--mu);border-radius:2px}',
    '.ck-hb-row:nth-child(-n+3) .ck-hb-name b{background:var(--gd)}',
    '.ck-hb-icd{font-size:10px;color:#5f7a97}',
    '.ck-hb-track{position:relative;flex:1;height:15px;background:rgba(120,190,255,.08);border-radius:2px;overflow:hidden}',
    '.ck-hb-fill{position:absolute;left:0;top:0;height:100%;background:linear-gradient(90deg,#1a6fa0,#63e2e6);border-radius:2px}',
    '.ck-hb-fill.top{background:linear-gradient(90deg,#2a9bc4,#ffd166)}',
    '.ck-hb-fill.warm{background:linear-gradient(90deg,#7a2334,#f58f6a)}',
    '.ck-hb-val{flex:0 0 88px;text-align:right;font-size:10.5px;color:#e9f7ff;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.ck-hb-val em{font-style:normal;color:#9ec3e0;margin-left:4px}',
    /* 质控仪表 */
    '.ck-gauges{padding:9px 12px 2px}',
    '.ck-gauge{margin-bottom:9px}',
    '.ck-gauge-top{display:flex;justify-content:space-between;font-size:12px;color:#cfe4f7}',
    '.ck-gauge-top b{color:#eafaff;font-variant-numeric:tabular-nums}',
    '.ck-gauge-track{position:relative;height:9px;margin:4px 0 3px;background:rgba(120,190,255,.1);border-radius:5px;overflow:hidden}',
    '.ck-gauge-track i{position:absolute;left:0;top:0;height:100%;background:linear-gradient(90deg,#1e86b4,#6ee7b7);border-radius:5px}',
    '.ck-gauge.bad .ck-gauge-track i{background:linear-gradient(90deg,#a83247,#ffb08a)}',
    '.ck-gauge-track u{position:absolute;top:-2px;width:2px;height:13px;background:var(--gd);box-shadow:0 0 6px rgba(255,209,102,.8)}',
    '.ck-gauge-foot{display:flex;justify-content:space-between;font-size:10.5px;color:var(--mu)}',
    '.ck-tag{font-size:10px;padding:1px 6px;border-radius:2px;border:1px solid}',
    '.ck-tag.ok{color:#6ee7b7;border-color:rgba(110,231,183,.45);background:rgba(110,231,183,.1)}',
    '.ck-tag.bad{color:#ff8fa3;border-color:rgba(255,143,163,.45);background:rgba(255,143,163,.1)}',
    /* 排行 */
    '.ck-rank{padding:8px 12px 2px}',
    '.ck-rank-row{display:flex;align-items:center;gap:7px;padding:4px 4px;border-radius:3px;cursor:pointer}',
    '.ck-rank-row:hover{background:rgba(120,190,255,.07)}',
    '.ck-rank-row.on{background:rgba(255,209,102,.1);outline:1px solid rgba(255,209,102,.35)}',
    '.ck-rank-no{flex:0 0 17px;height:17px;line-height:17px;text-align:center;font-size:10.5px;border-radius:2px;background:rgba(120,190,255,.16);color:#cfe4f7}',
    '.ck-rank-no.r1{background:var(--gd);color:#241a04}.ck-rank-no.r2{background:#c9d7e6;color:#1b2a3a}.ck-rank-no.r3{background:#e0a06a;color:#2a1704}',
    '.ck-rank-name{flex:0 0 66px;font-size:12px;color:#dff3ff}.ck-rank-name em{display:block;font-size:10px;font-style:normal;color:var(--mu)}',
    '.ck-rank-track{flex:1;height:7px;background:rgba(120,190,255,.1);border-radius:4px;overflow:hidden}',
    '.ck-rank-track i{display:block;height:100%;background:linear-gradient(90deg,#186288,#63e2e6);border-radius:4px}',
    '.ck-rank-val{flex:0 0 58px;text-align:right;font-size:12px;color:#eafaff;font-variant-numeric:tabular-nums}',
    /* 漏斗 */
    '.ck-funnel{padding:9px 12px 2px}',
    '.ck-fs-row{display:flex;align-items:center;gap:8px;margin-bottom:5px}',
    '.ck-fs-name{flex:0 0 118px;font-size:11.5px;color:var(--mu);text-align:right;white-space:nowrap}',
    '.ck-fs-track{flex:1;height:20px;display:flex;justify-content:center}',
    '.ck-fs-track i{display:flex;align-items:center;justify-content:center;height:100%;background:linear-gradient(180deg,rgba(95,225,240,.85),rgba(28,111,158,.9));color:#03131d;font-size:11px;font-weight:700;clip-path:polygon(3% 0,97% 0,100% 100%,0 100%);border-radius:2px;font-variant-numeric:tabular-nums}',
    '.ck-fs-pct{flex:0 0 46px;font-size:11.5px;color:#9fd8f2;font-variant-numeric:tabular-nums}',
    /* 预警 */
    '.ck-warn-top{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:9px 12px 4px}',
    '.ck-warn-cell{text-align:center;padding:6px 4px;border:1px solid var(--line);border-radius:4px;background:rgba(8,24,40,.5)}',
    '.ck-warn-cell b{display:block;font-size:19px;color:var(--wc);font-variant-numeric:tabular-nums;line-height:1.2}',
    '.ck-warn-cell span{font-size:10.5px;color:var(--mu)}',
    '.ck-warn-list{padding:4px 12px 0;max-height:198px;overflow:auto}',
    '.ck-warn-item{display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px dashed rgba(120,190,255,.12)}',
    '.ck-warn-item:last-child{border-bottom:0}',
    '.ck-warn-txt{flex:1;min-width:0}',
    '.ck-warn-txt b{display:block;font-size:11.5px;font-weight:600;color:#dff3ff;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ck-warn-txt span{display:block;font-size:10.5px;line-height:14px;color:var(--mu)}',
    '.ck-warn-item em{flex:0 0 auto;font-size:10px;font-style:normal;color:#9fd8f2;border:1px solid var(--line2);border-radius:2px;padding:1px 5px}',
    '.ck-dot{flex:0 0 7px;width:7px;height:7px;border-radius:50%;background:var(--cy);box-shadow:0 0 7px currentColor}',
    '.ck-dot.a{background:#5fe1f0}.ck-dot.b{background:#ffd166}.ck-dot.c{background:#ff8fa3}',
    /* 表格 */
    '.ck-tblwrap{overflow:auto;max-height:266px;padding:0 4px}',
    '.ck.fs .ck-tblwrap{max-height:300px}',
    '.ck-tbl{width:100%;border-collapse:collapse;font-size:12px;min-width:1080px}',
    '.ck-tbl th{position:sticky;top:0;z-index:2;background:#0d2c48;color:#a9c9e6;font-weight:600;font-size:11.5px;padding:7px 8px;text-align:left;border-bottom:1px solid var(--line2);white-space:nowrap}',
    '.ck-tbl td{padding:6px 8px;border-bottom:1px solid rgba(120,190,255,.09);color:#d8ebfa;white-space:nowrap}',
    '.ck-tbl tbody tr{cursor:pointer}',
    '.ck-tbl tbody tr:hover td{background:rgba(120,190,255,.07)}',
    '.ck-tbl tr.on td{background:rgba(255,209,102,.09)}',
    '.ck-tbl tr.ck-total td{background:rgba(95,225,240,.09);border-top:1px solid var(--line2);font-weight:700;color:#eafaff}',
    '.ck-num{text-align:right;font-variant-numeric:tabular-nums}',
    '.ck-num.good{color:#6ee7b7}.ck-num.bad{color:#ff8fa3;font-weight:700}.ck-num.strong{color:#eafaff;font-weight:700}',
    '.ck-city b{font-size:12.5px;color:#eafaff}.ck-city em{display:block;font-size:10px;font-style:normal;color:var(--mu)}',
    '.ck-op{white-space:nowrap}',
    '.ck-link{appearance:none;background:none;border:0;color:#7fd3f5;font-size:11.5px;cursor:pointer;padding:0 4px;font-family:inherit;text-decoration:underline}',
    '.ck-link:hover{color:var(--gd)}',
    '.ck-foot{display:flex;justify-content:space-between;padding:9px 22px 0;font-size:11px;color:#5f7a97}',
    '.ck-empty{padding:24px;text-align:center;color:var(--mu);font-size:12px}',
    /* 弹窗 */
    '.ck-modal{position:fixed;inset:0;z-index:1800;background:rgba(2,8,14,.72);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:22px}',
    '.ck-mbox{width:min(1120px,100%);max-height:100%;overflow:auto;border:1px solid rgba(95,225,240,.4);border-radius:6px;background:linear-gradient(180deg,#0a2135,#061322);box-shadow:0 24px 70px rgba(0,0,0,.6);color:#cfe4f7;font-family:inherit}',
    '.ck-mhead{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(120,190,255,.16);position:sticky;top:0;background:#0a2135;z-index:2}',
    '.ck-mtitle{font-size:15px;font-weight:700;color:#eafaff;letter-spacing:1px}',
    '.ck-msub{margin-left:10px;font-size:11.5px;font-weight:400;color:#7d95b3;letter-spacing:0}',
    '.ck-mclose{appearance:none;width:26px;height:26px;border:1px solid rgba(120,190,255,.3);border-radius:3px;background:transparent;color:#cfe4f7;cursor:pointer;font-size:13px}',
    '.ck-mclose:hover{border-color:#ff8fa3;color:#ff8fa3}',
    '.ck-mbody{padding:14px 16px 16px}',
    '.ck-mstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px}',
    '.ck-mstat{border:1px solid rgba(120,190,255,.16);border-left:2px solid #5fe1f0;border-radius:4px;padding:7px 10px;background:rgba(14,44,74,.5)}',
    '.ck-mstat span{display:block;font-size:11px;color:#7d95b3}.ck-mstat b{font-size:18px;color:#eafaff;font-variant-numeric:tabular-nums}',
    '.ck-mgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}',
    '.ck-mcard{border:1px solid rgba(120,190,255,.16);border-radius:5px;background:rgba(8,26,44,.6);padding:0 0 8px}',
    '.ck-mcard.wide{grid-column:1/-1}',
    '.ck-mc-title{padding:8px 11px;font-size:12.5px;font-weight:700;color:#dff3ff;border-bottom:1px solid rgba(120,190,255,.13)}',

    '.ck-radar{display:block;width:100%;max-width:210px;margin:6px auto 0}',
    '.ck-rd-l{font-size:8.5px;fill:#9fd8f2}.ck-rd-v{font-size:9px;fill:#eafaff;font-weight:700}',
    '.ck-donut{display:flex;align-items:center;gap:8px;padding:8px 10px 0}',
    '.ck-donut svg{width:140px;height:140px;flex:0 0 132px}',
    '.ck-dn-v{font-size:17px;font-weight:800;fill:#eafaff}.ck-dn-l{font-size:9px;fill:#7d95b3}',
    '.ck-dn-legend{display:flex;flex-direction:column;gap:5px;font-size:11px;color:#9fd8f2}',
    '.ck-dn-legend span{display:flex;align-items:center;gap:5px}.ck-dn-legend i{width:9px;height:9px;border-radius:2px}',
    '.ck-dn-legend b{color:#eafaff;font-variant-numeric:tabular-nums}',
    '.ck-mtable{max-height:280px;overflow:auto;padding:0 6px}',
    '.ck-mtable .ck-tbl{min-width:0}',
    '.ck-mfoot{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}',
    /* 滚动条 */
    '.ck ::-webkit-scrollbar{width:7px;height:7px}.ck ::-webkit-scrollbar-thumb{background:rgba(120,190,255,.25);border-radius:4px}.ck ::-webkit-scrollbar-track{background:transparent}'
  ].join('');

  var st = document.createElement('style');
  st.id = 'ck-style';
  st.textContent = css;
  document.head.appendChild(st);

  /* ==================== 12. 接线（包装 renderPage） ==================== */
  var ST = { year: CUR_YEAR, domain: 'inc', metric: 'cases', city: '', fs: false };
  // 2026 年（当年）默认聚焦已登记完整年度，避免首屏全是"累计"
  if (CUR_MONTH < 6) ST.year = CUR_YEAR - 1;

  var _origRender = window.renderPage;
  if (typeof _origRender === 'function') {
    window.renderPage = function (id) {
      if (id === PAGE) {
        ckCloseModalSafe();
        mount();
        return;
      }
      document.body.classList.remove('ck-fs');
      if (ST.fs) ST.fs = false;
      return _origRender.apply(this, arguments);
    };
  }
  function ckCloseModalSafe() { try { ckCloseModal(); } catch (e) { } }
})();
