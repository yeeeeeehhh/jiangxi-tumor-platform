/*
 * home-dashboard.js — 首页「数据看板」（省级登记处登录后的落地大屏）
 *
 * ⚠️ 与 cockpit-module.js（数据中心 ▸ 数据看板）是【两套独立实现】，2026-10-19 拆分。
 *   拆分原因：此前首页只是把 cockpit 页转发渲染，两处共用同一份代码、同一套 .ck 样式、
 *   同一批 DOM id（ckClock / ckMapBody / ckModal…）与同一批全局函数（ckCity / ckExport…），
 *   导致"改一处两处一起变"。现在本文件所有对外标识符统一加 hd 前缀：
 *     样式  .ck-*  → .hd-*      根类 .ck → .hd      body.ck-fs → body.hd-fs
 *     属性  data-ck-* → data-hd-*                     DOM id  ckXxx → hdXxx
 *     全局  window.ckCity → window.hdCity 等
 *   两个文件可以各自改版，改本文件不会影响「数据中心 ▸ 数据看板」，反之亦然。
 *
 * 地图底图：jx-geo.js（江西省 11 设区市行政边界，DataV.GeoAtlas 抽稀）。
 * 数据口径：本文件内自带一份地市基线副本（见下方 META / SITES），
 *   与 cockpit-module.js 的同名常量【无联动】。若国家口径或基线数据调整，
 *   需在两个文件里分别修改 —— 这是拆分后唯一需要人工同步的地方，请注意。
 */
(function () {
  'use strict';
  if (window.__HD_LOADED) return;
  window.__HD_LOADED = 1;

  var PAGE = 'home-dashboard';
  var GEO = window.JX_GEO || null;

  /* ==================== 1. 基础常量 ==================== */
  var NOW = new Date();
  var CUR_YEAR = NOW.getFullYear();
  var CUR_MONTH = NOW.getMonth();                 // 0-based，上一个完整自然月 = CUR_MONTH
  var YEARS = [];
  for (var y = CUR_YEAR - 5; y <= CUR_YEAR; y++) YEARS.push(y);

  /* 登记质控阈值：与 warning-module.js 的 B 层规则同源（mvMin 66 / dcoMax 15），
     不再在本模块另立 70 / 5 一套——否则同一 MV% 在预警记录与预警总览会得出相反结论。 */
  var QC = { mvMin: 66, dcoMax: 15, ubMax: 5, miMin: 0.55, miMax: 0.85 };

  /* 运营类阈值：唯一事实来源 = warning-module.js 的 B 层规则。
     2026-10-10 修 bug：此前本模块把重卡率/随访率/上报率/待处置的阈值**硬编码在渲染代码里**，
     其中随访率写 80，而已删除的 registry-ops.js 写 85 —— 同一批数据两页给出相反结论
     （11 市里景德镇/萍乡/九江/赣州/宜春 5 市「预警总览说达标、运营监测说未达标」）。
     现在统一从 TH 取，不再散落硬编码。 */
  function ruleThreshold(id, fallback) {
    try {
      if (typeof window.findRule === 'function') {
        var r = window.findRule(id);
        if (r) {
          if (typeof r.thresholdValue === 'number') return r.thresholdValue;
          if (typeof r.threshold === 'number') return r.threshold;
        }
      }
    } catch (e) { /* 预警模块未就绪时退回兜底值 */ }
    return fallback;
  }
  var TH = {
    mv: ruleThreshold('B-MV-LOW', 66),
    dco: ruleThreshold('B-DCO-HIGH', 15),
    ub: ruleThreshold('B-UB-HIGH', 5),
    fu: 85,          // 随访完成率目标（运营目标，非国家考核线）——与 registry-ops 保持一致
    dup: 3,          // 重卡率上限
    nccr: 96,        // 国家平台上报率目标
    warnPending: 12  // 待处置预警上限
  };

  /* 报卡质量 · 国家预警值（2026-10-19 新增，首页「报告卡质量」横条用）
     阈值与 analysis.js 的 QC_LIMITS「同源同值」，两处必须一起改：
     analysis.js 第 1131 行 QC_LIMITS 是报卡质量监测页的判定基准，
     这里只挑首页要展示的 5 项，数值完全照抄，不另立一套标准。
     依据：《中国肿瘤登记工作指导手册》《中国肿瘤登记年报》《IARC CI5》。 */
  var QC_LIMITS = {
    warn: { label: '警告卡占比', limit: 3, basis: '省级报卡质量考核：逻辑校验警告卡占比参考上限 3%' },
    outer: { label: '户籍外卡占比', limit: 5, basis: '国家登记质量评价参考：户籍外卡占比参考上限 5%' },
    dco: { label: 'DCO 占比', limit: 15, basis: '《中国肿瘤登记年报》完整性指标：DCO%（仅死亡证明来源）上限 15%，与死亡补发病闭环联合研判' },
    idNo: { label: '身份证号缺失率', limit: 2, basis: '《中国肿瘤登记工作指导手册》：关键身份字段缺失率上限 2%' },
    stage: { label: '分期缺失率', limit: 15, basis: '国家肿瘤登记质量考核：TNM 分期缺失率上限 15%' },
    treat: { label: '治疗信息缺失率', limit: 10, basis: '国家肿瘤登记质量考核：治疗信息缺失率上限 10%' }
  };
  /* 2026-10-20 按需求：去掉「超标指标 N/5」汇总格，改为展示 5 项具体指标；
     DCO 占比进入本行（值取自 rec.dco，与地市质控口径同源）。 */
  var QC_KEYS = ['warn', 'outer', 'dco', 'idNo', 'stage', 'treat'];

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
  /* 地图分档色带（2026-10-20 按需求调整：原 6 档同一蓝色系，明度差小，
     整张图"一片蓝"分不出发病高低。现改为跨色相递进，相邻档一眼可辨。
     取色仍由 ramp() 按值域均分 6 档，索引 0 = 最低值、5 = 最高值：
       发病域 深靛蓝 → 亮青（低值沉、高值亮，符合"越亮越高"的地图直觉，
         且在深色底上高值最醒目）
       死亡域 浅黄 → 深绛（暖色系递进，高值最深） */
  var RAMP = {
    cyan: ['#1e3f8f', '#2361b8', '#2187cf', '#1faddd', '#35cfe0', '#7ff0de'],
    warm: ['#ffd98a', '#f7b350', '#ee8b3c', '#e35f45', '#c93b52', '#8e2447']
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

    /* 报卡质量 5 项（2026-10-19 新增）：口径为报卡级缺失/异常占比，阈值见 QC_LIMITS。
       与 analysis.js「报卡质量监测」页同口径；那边按汇总对象出数，首页按地市出数，
       用于省级横向对比。使用独立 seed（'qc'+code+year），避免与上方预警/质控
       字段的随机流互相干扰，保证同一地市同年份每次刷新数值稳定。 */
    var qr = rnd(hash('qc' + code + year));
    rec.qc = {
      warn: clamp(1.2 + qr() * 2.6 - dy * .18, .4, 8),
      outer: clamp(2.6 + qr() * 3.4 - dy * .2, .8, 12),
      /* dco 直接复用上方 rec.dco（META 基线 + 年度演进），不另生成随机值，
         避免同一地市出现两个不同的 DCO（详见 rec.dco 的生成处）。 */
      dco: rec.dco,
      idNo: clamp(.5 + qr() * 2.2 - dy * .12, .1, 6),
      stage: clamp(8.5 + qr() * 9.5 - dy * .9, 3, 26),
      treat: clamp(5.2 + qr() * 7.4 - dy * .7, 1.5, 20)
    };
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
    /* 报卡质量汇总：按报卡数加权（占比指标不能人口加权，否则小地市被放大）。
       analysis.js 那边是按汇总对象直接出数，此处按各市报卡数加权，口径等价。
       例外：dco 复用 a.dco（按病例数 wsum 加权，与地市质控矩阵同源），
       不再用报卡数重复加权一次，避免同一 DCO 出现两个值。 */
    a.qc = {};
    var wCards = rs.map(function (r) { return r.cards; });
    var tCards = sum(wCards) || 1;
    QC_KEYS.forEach(function (k) {
      a.qc[k] = (k === 'dco')
        ? a.dco
        : rs.reduce(function (s, r, i) { return s + r.qc[k] * wCards[i]; }, 0) / tCards;
    });
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
  /* spark()（迷你折线构件）随 KPI 卡底部行一并删除（2026-10-19），
     恢复见 home-dashboard.js.bak_pre_kpi_strip_20261019。 */

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
        '<text x="' + (PL - 5) + '" y="' + (yy + 3.5).toFixed(1) + '" text-anchor="end" class="hd-ax">' + fmtInt(hi * t / 3) + '</text>';
    }
    vals.forEach(function (val, i) {
      var cx = PL + iw / 12 * (i + .5), hh = val / hi * ih;
      var active = (domain || ST.domain) === 'inc';
      out += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + (PT + ih - hh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, hh).toFixed(1) + '" rx="1.5" fill="url(#hdBar' + (active ? 'A' : 'B') + ')" opacity="' + (i + 1 === CUR_MONTH ? '1' : '.78') + '"/>';
      out += '<text x="' + cx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="hd-ax">' + (i + 1) + '</text>';
    });
    return '<svg class="hd-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="hdBarA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#66e8f7"/><stop offset="1" stop-color="#1a6c9c"/></linearGradient>' +
      '<linearGradient id="hdBarB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb08a"/><stop offset="1" stop-color="#8a2c3c"/></linearGradient></defs>' +
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
      lab += '<text x="' + (W / 2).toFixed(1) + '" y="' + (yy + rh / 2 + 4).toFixed(1) + '" text-anchor="middle" class="hd-py-g">' + a.g + '</text>';
      out += '<rect x="' + (W / 2 - bwM).toFixed(1) + '" y="' + (yy + 2.5).toFixed(1) + '" width="' + bwM.toFixed(1) + '" height="' + (rh - 5).toFixed(1) + '" rx="2" fill="url(#hdM)"/>';
      out += '<rect x="' + (W / 2).toFixed(1) + '" y="' + (yy + 2.5).toFixed(1) + '" width="' + bwF.toFixed(1) + '" height="' + (rh - 5).toFixed(1) + '" rx="2" fill="url(#hdF)"/>';
      out += '<text x="4" y="' + (yy + rh / 2 + 4).toFixed(1) + '" class="hd-py-v">' + fmtInt(a.m) + '</text>';
      out += '<text x="' + (W - 4) + '" y="' + (yy + rh / 2 + 4).toFixed(1) + '" text-anchor="end" class="hd-py-v">' + fmtInt(a.f) + '</text>';
    });
    return '<svg class="hd-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="hdM" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#2ea8d8"/><stop offset="1" stop-color="#1b5b8a"/></linearGradient>' +
      '<linearGradient id="hdF" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f7a7c3"/><stop offset="1" stop-color="#a8446f"/></linearGradient></defs>' +
      '<text x="4" y="12" class="hd-ax" fill="#7fd3f5">男</text>' +
      '<text x="' + (W - 4) + '" y="12" text-anchor="end" class="hd-ax" fill="#f7a7c3">女</text>' + out + lab + '</svg>';
  }

  function hbars(items, domain) {
    var hi = Math.max.apply(null, items.map(function (i) { return i.pct; })) || 1;
    return '<div class="hd-hb">' + items.map(function (it, i) {
      return '<div class="hd-hb-row"><div class="hd-hb-name"><b>' + (i + 1) + '</b>' + esc(it.name) + '<span class="hd-hb-icd">' + it.icd + '</span></div>' +
        '<div class="hd-hb-track"><i class="hd-hb-fill ' + (domain === 'death' ? 'warm' : '') + (i < 3 ? ' top' : '') + '" style="width:' + (it.pct / hi * 100).toFixed(1) + '%"></i></div>' +
        '<div class="hd-hb-val">' + fmtInt(it.val) + '<em>' + f1(it.pct) + '%</em></div></div>';
    }).join('') + '</div>';
  }

  function qcGauges(rec) {
    function row(label, val, fmt, band) {
      // band: {min?,max?,target,scaleMax,unit}
      var pct = clamp(val / band.scaleMax * 100, 0, 100);
      var tick = band.tick === undefined ? band.target / band.scaleMax * 100 : band.tick;
      var ok = band.range ? (val >= band.lo && val <= band.hi) : (band.dir === 'down' ? val <= band.target : val >= band.target);
      return '<div class="hd-gauge' + (ok ? '' : ' bad') + '">' +
        '<div class="hd-gauge-top"><span>' + label + '</span><b>' + (fmt === 'f2' ? f2(val) : f1(val)) + (band.unit || '') + '</b></div>' +
        '<div class="hd-gauge-track"><i style="width:' + pct.toFixed(1) + '%"></i><u style="left:' + clamp(tick, 0, 100).toFixed(1) + '%" title=""></u></div>' +
        '<div class="hd-gauge-foot"><span>国家阈值 ' + band.rule + '</span><span class="hd-tag ' + (ok ? 'ok' : 'bad') + '">' + (ok ? '达标' : '未达标') + '</span></div></div>';
    }
    return '<div class="hd-gauges">' +
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
    return '<div class="hd-funnel">' + steps.map(function (s, i) {
      var w = clamp(s.v / top * 100, 18, 100);
      return '<div class="hd-fs-row"><div class="hd-fs-name">' + s.n + '</div>' +
        '<div class="hd-fs-track"><i style="width:' + w.toFixed(1) + '%;opacity:' + (1 - i * .1).toFixed(2) + '">' + fmtInt(s.v) + '</i></div>' +
        '<div class="hd-fs-pct">' + f1(s.v / top * 100) + '%</div></div>';
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
    return '<div class="hd-donut"><svg viewBox="0 0 140 140">' + out +
      '<text x="70" y="66" text-anchor="middle" class="hd-dn-v">' + center + '</text>' +
      '<text x="70" y="82" text-anchor="middle" class="hd-dn-l">' + sub + '</text></svg>' +
      '<div class="hd-dn-legend">' + parts.map(function (p) {
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
      out += '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 3.5).toFixed(1) + '" text-anchor="middle" class="hd-rd-l">' + a.n + '</text>' +
        '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 16).toFixed(1) + '" text-anchor="middle" class="hd-rd-v">' + f1(a.v) + '</text>';
    });
    return '<svg class="hd-radar" viewBox="0 0 168 186">' + out + '</svg>';
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
    if (!GEO || !p) return '<div class="hd-panel"><div class="hd-p-title">江西行政区划地图</div><div class="hd-empty">未加载 jx-geo.js</div></div>';
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
      g += '<path d="' + paths()[c.code] + '" data-hd-city="' + c.code + '" class="hd-region' + (on ? ' on' : '') + '" fill="' + col + '" opacity="' + (dim ? .42 : 1) + '"' + (on ? ' stroke="#ffd166" stroke-width="2.2"' : '') + '/>';
    });
    GEO.cities.forEach(function (c) {
      var nud = NUDGE[c.code] || [0, 0], x = p.x(c.centroid[0]) + nud[0], y = p.y(c.centroid[1]) + nud[1];
      var v = vals[c.code];
      g += '<text x="' + x.toFixed(1) + '" y="' + (y - 3).toFixed(1) + '" class="hd-lb-n" data-hd-city="' + c.code + '">' + c.name + '</text>' +
        '<text x="' + x.toFixed(1) + '" y="' + (y + 11).toFixed(1) + '" class="hd-lb-v" data-hd-city="' + c.code + '">' + num(v, mf) + '</text>';
      if (c.code === '360100') g += '<circle cx="' + (x - 0).toFixed(1) + '" cy="' + (y - 15).toFixed(1) + '" r="2.6" fill="#ffd166"/>';
    });
    // 图例
    var legend = '<div class="hd-legend-map"><div class="hd-legend-title">' + label + '</div>';
    for (var i = pal.length - 1; i >= 0; i--) {
      var b0 = lo + (hi - lo) * i / pal.length, b1 = lo + (hi - lo) * (i + 1) / pal.length;
      legend += '<span><i style="background:' + pal[i] + '"></i>' + num(b0, mf) + ' ~ ' + num(b1, mf) + '</span>';
    }
    legend += '</div>';
    /* 2026-10-20 按需求删除地图右上角浮层（峰值地市 / 地市极差 / 登记机构），
       maxCode 变量随之删除（它只服务于该浮层）。
       恢复见 home-dashboard.js.bak_pre_del_extras_20261020。 */
    /* 2026-10-23 按需求删除地图卡片头右侧整组控件：
       「全省 11 设区市 / 聚焦：某市 ✕ 返回全省」状态标签 + 「新发病例数(例)」指标下拉。
       地图指标固定为 ST.metric（默认 cases，仍可由 hdOpen({metric}) 预置）；
       返回全省仍可点地图空白处或顶部「全省 11 个设区市」下拉。
       恢复见 home-dashboard.js.bak_pre_del_map_tools_20261023。 */
    return '<section class="hd-panel hd-mapwrap">' +
      '<header class="hd-p-head"><div class="hd-p-title">江西省行政区域 · ' + ST.year + ' 年' + dom.label + '分布</div></header>' +
      '<div class="hd-map-body" id="hdMapBody">' +
      '<div class="hd-map-grid"></div>' +
      '<svg class="hd-map" viewBox="0 0 ' + p.w + ' ' + p.h + '" preserveAspectRatio="xMidYMid meet">' +
      '<defs><filter id="hdGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<g class="hd-map-inner">' + g + '</g></svg>' +
      legend +
      '<div class="hd-tip" id="hdTip"></div>' +
      '</div></section>';
  }

  /* ==================== 6.A 领导核心大卡（结局 / 流向） ==================== */
  /* ==================== 6.B 六维达标概览 ==================== */
  /* ==================== 8.B 预警态势横条（已删除） ====================
     2026-10-19 按需求删除。原为 7 格统计（待处置/A/B/C/今日新增/超期/闭环率）
     +「预警记录 ›」跳转。数据在「预警监测 ▸ 预警记录」有完整呈现，首页不再重复。
     恢复方式：见 _home_dashboard_restore_warnbar_sig.js（含两个函数原版 + 恢复步骤）。 */

  /* ==================== 8.G 决策视图入口（已删除） ====================
     2026-10-10 按需求删除页脚上方的「卫健领导决策视图」横幅卡片。
     该卡片的跳转目标是「专科画像 ▸ 画像指标汇总」（sp-overview），
     但它在预警总览里属于**跨模块引流**，与预警监测（登记与质控运营）受众不符，
     故整块移除。本函数已无调用点，保留会误导下一位维护者，一并删除。
     若要恢复：见 git 历史 / cockpit-module.js.bak_pre_del_decision_entry 的 745-751 行。 */

  /* ==================== 8.H 行动信号条（已删除） ====================
     2026-10-19 按需求删除。原为 5 张 A/B/C 分级信号卡（生存率下滑、跨省流出、
     早诊率、早死率、分期占比上升）。首页改为直接进入地图与趋势主线。
     恢复方式：见 _home_dashboard_restore_warnbar_sig.js（含两个函数原版 + 恢复步骤）。 */

  /* ==================== 7. 面板 ==================== */
  function kpiStrip() {
    var r = cur();
    var v = view(r);
    var dom = DOMAIN[ST.domain];
    /* 2026-10-19 按需求精简：卡片只留「指标名 + 大数值」。
       原底部行（同比差异标签 + 迷你折线）连同其数据生成（prev/deltaTag/spark 调用）一并删除；
       恢复方式见 home-dashboard.js.bak_pre_kpi_strip_20261019。 */
    var cards = [
      {
        l: ST.year === CUR_YEAR ? '本年累计' + dom.short + '病例（1–' + CUR_MONTH + '月）' : '本年' + dom.short + '病例', u: '例',
        v: fmtInt(v.cnt)
      },
      { l: ST.domain === 'inc' ? '粗发病率' : '粗死亡率', u: '1/10万', v: f1(v.rate) },
      { l: ST.domain === 'inc' ? '中标发病率' : '中标死亡率', u: '1/10万', v: f1(v.asr) },
      {
        l: '死亡发病比 M/I', u: '', v: f2(r.mi),
        tone: (r.mi <= QC.miMax && r.mi >= QC.miMin) ? 'ok' : 'bad'
      },
      /* 原卡「病理确认 MV%」不在数据中心 METRICS 六指标内，2026-10-19 换为「随访完成率」；
         MV% 仍可在「数据中心 ▸ 数据看板」与地市明细里看到。 */
      {
        l: '随访完成率', u: '%', v: f1(r.fu),
        tone: r.fu >= TH.fu ? 'ok' : 'bad'
      }
      /* 2026-10-20 按需求删除「待处置预警」卡：该值原由 warnA/B/C 随机公式推算
         （合计 × 0.22~0.40），与「预警监测 ▸ 预警记录」的真实工单数不一致
         （实测首页 52 条 vs 工单表 PENDING 46 条）。
         待接入真实数据后再考虑恢复；数据层的 rec.warnPending 仍保留，
         供地图悬浮提示与 HDData 导出使用。恢复见
         home-dashboard.js.bak_pre_del_warnkpi_20261020。 */
    ];
    return '<div class="hd-kpis">' + cards.map(function (c) {
      return '<div class="hd-kpi' + (c.tone ? ' ' + c.tone : '') + '">' +
        '<div class="hd-kpi-l">' + c.l + '</div>' +
        '<div class="hd-kpi-v">' + c.v + '<em>' + c.u + '</em></div></div>';
    }).join('') + '</div>';
  }

  function panelHead(title, tools) { return '<header class="hd-p-head"><div class="hd-p-title">' + title + '</div><div class="hd-p-tools">' + (tools || '') + '</div></header>'; }

  /* ============ 报告卡质量横条（2026-10-19 新增） ============
     口径与「数据中心 ▸ 报卡质量监测」一致：5 项报卡级质量指标 + 国家预警值。
     判定三档（与 analysis.js 的 qcCell 同规则）：
       超预警值 → 红；达预警值 80% 以上但未超 → 黄（关注）；其余 → 绿（达标）。
     取值：未聚焦全省时用 agg 的报卡数加权；聚焦某市时用该市自身值。 */
  function qcBar() {
    var qc, scopeName;
    if (ST.city) {
      qc = build(ST.city, ST.year).qc;
      scopeName = META[ST.city].f;
    } else {
      qc = agg(CODES, ST.year).qc;
      scopeName = '全省';
    }
    /* 2026-10-20 按需求：删除「超标指标 N/5」汇总格，改为 6 项具体指标并排
       （新增 DCO 占比，预警值 ≤15%）。格数仍为 6，网格布局不变。
       各项仍按「超预警值(红) / 达 80%(黄) / 达标(绿)」三档着色，只留指标名+数值。 */
    var cells = QC_KEYS.map(function (k) {
      var def = QC_LIMITS[k], v = qc[k], lim = def.limit;
      var over = v > lim, near = !over && v >= lim * 0.8;
      var tone = over ? 'bad' : near ? 'warn' : 'ok';
      return '<div class="hd-qc-cell tone-' + tone + '" title="' +
          esc(def.label + ' ' + f1(v) + '%，国家预警值 ≤' + lim + '%，' +
            (over ? '已超预警值' : near ? '接近预警值' : '达标') + '；' + def.basis) + '">' +
        '<div class="hd-qc-k">' + def.label + '</div>' +
        '<div class="hd-qc-v">' + f1(v) + '<em>%</em></div></div>';
    }).join('');

    return '<section class="hd-qcbar">' +
      '<header class="hd-qcbar-hd"><span class="hd-qcbar-t">报告卡质量</span>' +
      '<span class="hd-qcbar-sub">' + scopeName + ' · ' + ST.year + ' 年 · 对照国家预警值</span>' +
      '<button class="hd-btn" onclick="navigateTo(\'analysis-quality\')">报卡质量监测 ›</button></header>' +
      '<div class="hd-qcbar-grid">' + cells + '</div></section>';
  }

  /* 随访率排名（2026-10-19 替换原「近 6 年发病/死亡登记趋势」卡）
     口径：随访完成率 fu，目标线 TH.fu=85%。
     排名对象随地图聚焦联动：未聚焦 → 11 个设区市；聚焦某市 → 该市下辖区县。
     配色按是否达标三档，而非 Top3 高亮——排名榜要让「垫底」一眼可见。 */
  function fuPanel() {
    var rows, scopeName;
    if (ST.city) {
      scopeName = META[ST.city].f + '下辖区县';
      rows = countyRows(ST.city, ST.year, ST.domain).map(function (c) {
        return { name: c.name, fu: c.fu };
      });
    } else {
      scopeName = '全省 11 个设区市';
      rows = CODES.map(function (code) {
        var r = build(code, ST.year);
        return { name: r.full, fu: r.fu };
      });
    }
    rows.sort(function (a, b) { return b.fu - a.fu; });

    var below = rows.filter(function (x) { return x.fu < TH.fu; }).length;
    /* 平均值口径：与顶部「随访完成率」KPI 卡保持一致 —— 用人口加权，不用简单平均。
       两者原先不同（KPI 走 agg 的 wpop('fu') = 81.6%，这里简单平均 = 82.0%），
       同一屏出现两个"全省随访率"会让人怀疑数据打架。
       区县视图按人口加权；全省视图直接用 agg 的结果，口径统一。 */
    var avg;
    if (ST.city) {
      var rowsW = countyRows(ST.city, ST.year, ST.domain);
      avg = rowsW.length
        ? sum(rowsW.map(function (c) { return c.fu * c.pop; })) / (sum(rowsW.map(function (c) { return c.pop; })) || 1)
        : 0;
    } else {
      avg = agg(CODES, ST.year).fu;
    }

    /* 刻度：全局用 0–100（一眼看出"离满分多远"）；但区县层数据集中在 78–87 区间，
       用 0–100 会把差异压成一条线，看不出谁卡在目标线边上。故区县视图改用局部
       刻度（下限取 min 再留白），目标线按同一坐标系换算，位置仍然准确。 */
    var lo = 0, hi = 100;
    if (ST.city) {
      var mn = Math.min.apply(null, rows.map(function (x) { return x.fu; }));
      lo = Math.max(0, Math.floor((mn - 6) / 5) * 5);
      hi = Math.max(Math.ceil((TH.fu + 4) / 5) * 5, Math.ceil((Math.max.apply(null, rows.map(function (x) { return x.fu; })) + 2) / 5) * 5);
    }
    var span = (hi - lo) || 1;
    var pctOf = function (v) { return clamp((v - lo) / span * 100, 0, 100); };
    var goalPct = pctOf(TH.fu);

    var bars = '<div class="hd-hb hd-hb--fu">' + rows.map(function (x, i) {
      var ok = x.fu >= TH.fu;
      var tone = x.fu >= 90 ? ' good' : ok ? '' : ' bad';
      return '<div class="hd-hb-row" title="' + esc(x.name) + ' · 随访完成率 ' + f1(x.fu) + '%' +
          (ok ? '（达标）' : '（低于 ' + TH.fu + '%）') + '">' +
        '<div class="hd-hb-name"><b>' + (i + 1) + '</b>' + esc(x.name) + '</div>' +
        '<div class="hd-hb-track"><i class="hd-hb-fill' + tone + '" style="width:' + pctOf(x.fu).toFixed(1) + '%"></i>' +
          '<u class="hd-hb-goal" style="left:' + goalPct.toFixed(1) + '%"></u></div>' +
        '<div class="hd-hb-val">' + f1(x.fu) + '%<em class="' + (ok ? 'ok' : 'bad') + '">' + (ok ? '达标' : '未达标') + '</em></div>' +
        '</div>';
    }).join('') + '</div>';

    var tools = '<span class="hd-scope">' + below + ' 个低于 ' + TH.fu + '%</span>';
    var scaleNote = ST.city ? '刻度 ' + lo + '–' + hi + '%' : '刻度 0–100%';
    return '<section class="hd-panel">' + panelHead('各地区随访率排名', tools) +
      '<div class="hd-fuhd"><span>' + scopeName + '</span><span>人口加权均值 ' + f1(avg) + '%</span>' +
      '<span class="hd-fuscale">' + scaleNote + '</span>' +
      '<span class="hd-fugoal">目标线 ' + TH.fu + '%</span></div>' + bars + '</section>';
  }
  function monthPanel() {
    return '<section class="hd-panel">' + panelHead(ST.year + ' 年逐月' + DOMAIN[ST.domain].label + '量') +
      monthChart([cur()]) + '</section>';
  }
  function agePanel() {
    return '<section class="hd-panel">' + panelHead('年龄别构成（' + DOMAIN[ST.domain].short + '）') +
      pyramid(cur()) + '</section>';
  }
  function sitePanel() {
    var r = cur(), v = view(r);
    var items = SITES.map(function (s, i) {
      return { name: s.n, icd: s.icd, pct: v.sites[i], val: v.cnt * v.sites[i] / 100 };
    }).sort(function (a, b) { return b.pct - a.pct; }).slice(0, 10);
    return '<section class="hd-panel">' + panelHead('高发部位 TOP10') +
      hbars(items, ST.domain) + '</section>';
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
      return '<tr><td>' + c.name + '</td><td class="hd-num">' + f1(c.pop) + '</td><td class="hd-num">' + fmtInt(domainCnt(c)) + '</td>' +
        '<td class="hd-num">' + f1(ST.domain === 'death' ? c.deaths / (c.pop * 1e4) * 1e5 : c.crude) + '</td>' +
        '<td class="hd-num' + (c.mv >= QC.mvMin ? ' good' : ' bad') + '">' + f1(c.mv) + '%</td>' +
        '<td class="hd-num' + (c.dco <= QC.dcoMax ? ' good' : ' bad') + '">' + f1(c.dco) + '%</td>' +
        '<td class="hd-num">' + fmtInt(c.hosp) + '</td><td class="hd-num">' + c.warn + '</td></tr>';
    }).join('');
    function domainCnt(c) { return ST.domain === 'death' ? c.deaths : c.cases; }
    var html = '<div class="hd-modal" id="hdModal"><div class="hd-mbox"><div class="hd-mhead">' +
      '<div class="hd-mtitle">' + r.full + ' · ' + yy + ' 年' + DOMAIN[ST.domain].label + '详情' +
      '<span class="hd-msub">常住人口 ' + f1(r.pop) + ' 万 · 登记机构 ' + r.hosp + ' 家 · 县区 ' + cs.length + ' 个</span></div>' +
      '<button class="hd-mclose" onclick="hdCloseModal()">✕</button></div>' +
      '<div class="hd-mbody">' +
      '<div class="hd-mstats">' +
      mstat(DOMAIN[ST.domain].short + (ST.year === CUR_YEAR ? '累计（例）' : '（例）'), fmtInt(v.cnt)) + mstat('粗率（1/10万·年化）', f1(v.rate)) +
      mstat('中标率（1/10万）', f1(v.asr)) + mstat('M/I', f2(r.mi)) + mstat('登记卡数', fmtInt(v.cards)) +
      mstat('重卡率', f1(r.dup) + '%') + '</div>' +
      '<div class="hd-mgrid">' +
      '<div class="hd-mcard"><div class="hd-mc-title">质控六维达标度</div>' + radar(radarAxes) +
      '</div>' +
      '<div class="hd-mcard"><div class="hd-mc-title">临床分期构成</div>' + donut(stage, f1(r.stage.I + r.stage.II) + '%', '早诊占比') + '</div>' +
      '<div class="hd-mcard"><div class="hd-mc-title">' + DOMAIN[ST.domain].short + '部位 TOP5</div>' + hbars(top, ST.domain) + '</div>' +
      '<div class="hd-mcard wide"><div class="hd-mc-title">县（市、区）登记明细</div>' +
      '<div class="hd-mtable"><table class="hd-tbl"><thead><tr><th>县区</th><th class="hd-num">常住(万)</th><th class="hd-num">' + DOMAIN[ST.domain].short + (ST.year === CUR_YEAR ? '累计（例）' : '（例）') + '</th>' +
      '<th class="hd-num">粗率(年化)</th><th class="hd-num">MV%</th><th class="hd-num">DCO%</th><th class="hd-num">机构</th><th class="hd-num">预警</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '</div>' +
      '<div class="hd-mfoot"><button class="hd-btn" onclick="navigateTo(\'datamgmt-card\')">查看报告卡</button>' +
      '<button class="hd-btn" onclick="navigateTo(\'warning-records\')">关联预警记录</button>' +
      '<button class="hd-btn" onclick="navigateTo(\'analysis-stats\')">统计分析报表</button>' +
      '<button class="hd-btn primary" onclick="hdCloseModal()">关闭</button></div>' +
      '</div></div></div>';
    return html;
  }
  function mstat(l, v) { return '<div class="hd-mstat"><span>' + l + '</span><b>' + v + '</b></div>'; }

  /* ==================== 9. 骨架 ==================== */
  function header() {
    return '<header class="hd-head"><div class="hd-brand">' +
      '<div class="hd-logo"><svg viewBox="0 0 32 32"><path d="M16 2l12 6v9c0 7-5.4 11.6-12 13.8C9.4 28.6 4 24 4 17V8z" fill="none" stroke="#5fe1f0" stroke-width="1.6" opacity=".85"/>' +
      '<path d="M10 17h3l2-5 3 9 2-4h3" fill="none" stroke="#ffd166" stroke-width="1.8" stroke-linecap="round"/></svg></div>' +
      /* 2026-10-20 按需求删除标题下的副标题行（"实时 · 登记态势 · 预警信号 · 全省联动"），
         只保留主标题。恢复见 home-dashboard.js.bak_pre_del_subtitle_20261020。 */
      '<div class="hd-title"><h1>江西省肿瘤登记与防控数据看板</h1></div></div>' +
      '<div class="hd-tools">' +
      '<label class="hd-tool">年度<select class="hd-sel" data-hd="year">' + YEARS.slice().reverse().map(function (yy) {
        return '<option value="' + yy + '"' + (yy === ST.year ? ' selected' : '') + '>' + yy + '</option>';
      }).join('') + '</select></label>' +
      '<div class="hd-seg" data-hd-seg="domain">' +
        '<button class="' + (ST.domain === 'inc' ? 'on' : '') + '" data-hd-domain="inc">发病登记</button>' +
        '<button class="' + (ST.domain === 'death' ? 'on' : '') + '" data-hd-domain="death">死亡登记</button></div>' +
      '<select class="hd-sel" data-hd="city"><option value="">全省 11 个设区市</option>' + CODES.map(function (c) {
        return '<option value="' + c + '"' + (ST.city === c ? ' selected' : '') + '>' + META[c].f + '</option>';
      }).join('') + '</select>' +
      '<span class="hd-clock" id="hdClock"></span>' +
      '<button class="hd-btn" onclick="hdRefresh()">刷新</button>' +
      '<button class="hd-btn primary" onclick="hdToggleFs()">' + (ST.fs ? '退出大屏' : '大屏模式') + '</button>' +
      '</div></header>';
  }

  function shell() {
    /* 根容器用 .hd-board（不要再用裸 .hd）：
       .hd 是全站通用的卡片标题栏类名（qc-card/qc-modal/mon-card/kb-card 都用它），
       大屏此前把深色背景挂在了裸 .hd 上，导致所有卡片标题栏被染成深色条、文字重叠。
       现改为 .hd-board 专属命名空间，仅承载本大屏的深色容器样式。 */
    return '<div class="hd-board hd' + (ST.fs ? ' fs' : '') + '">' + header() +
      '<div class="hd-kpi-row">' + kpiStrip() + '</div>' +
      /* 报告卡质量横条（2026-10-19 新增）：紧接 KPI，构成"核心数据 + 质量"完整首屏 */
      qcBar() +
      /* 2026-10-19 按需求删除「预警态势横条」(warnBar) 与「行动信号」(signalStrip)：
         预警态势数据在「预警监测 ▸ 预警记录」已有完整呈现，首页重复展示属信息冗余；
         首页定位为省级决策落地页，首屏应直接进入地图与趋势主线。
         注：本改动只作用于首页大屏，数据中心 ▸ 数据看板 (cockpit-module.js) 保留原样。 */
      '<div class="hd-grid">' +
      '<div class="hd-col hd-col-c">' + mapPanel() + '</div>' +
      '<div class="hd-col">' + fuPanel() + monthPanel() + '</div>' +
      '</div>' +
      '<div class="hd-grid hd-grid-2">' +
      '<div class="hd-col">' + sitePanel() + '</div>' +
      '<div class="hd-col">' + agePanel() + '</div>' +
      '</div>' +
      /* 2026-10-19 按需求删除「三层预警与处置」整块（warnPanel + warnList）：
         A/B/C 三层统计与预警条目在「预警监测 ▸ 预警记录」有完整列表与处置入口，
         首页重复陈列与决策落地页定位不符。仅改首页，数据中心看板不受影响。 */
      /* 2026-10-19 按需求删除「各地市核心指标明细」整表（tablePanel）：
         地市横向对比在「数据中心 ▸ 数据看板」有完整版本（含 6 个质控列），
         首页保留地图 + 排名两张卡已足够表达省域态势。
         注意：.hd-tbl / .hd-num / .hd-mtable 样式**必须保留**——
         地市详情弹窗的「县（市、区）登记明细」表仍在用它们。 */
      /* 2026-10-20 按需求删除页脚「导出看板指标」按钮（原有输出为复制 TSV 到剪贴板），
         连同 hdExport() 与 window.hdExport 一并移除；页脚只留统计范围与截止日。
         恢复见 home-dashboard.js.bak_pre_del_export_20261020。
         需要导出数据时走「数据中心 ▸ 统计分析」或「报表文件库」。 */
      '<footer class="hd-foot"><span>' + (ST.city ? META[ST.city].f : '江西省') + ' · ' + ST.year + ' 年度 · 数据截至 ' + cutoff() + '</span></footer>' +
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
    var el = document.getElementById('hdClock');
    if (!el) { clearInterval(timer); timer = null; return; }
    var d = new Date();
    el.textContent = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + ' ' +
      ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }
  function rerender() { mount(); }

  function bindMap() {
    var body = document.getElementById('hdMapBody');
    if (!body) return;
    var tip = document.getElementById('hdTip');
    body.addEventListener('mousemove', function (e) {
      var c = e.target && e.target.getAttribute ? e.target.getAttribute('data-hd-city') : '';
      if (!c) { tip.style.display = 'none'; return; }
      var r = build(c, ST.year), v = view(r);
      tip.innerHTML = '<div class="hd-tip-h">' + r.full + '<span>' + ST.year + ' · ' + DOMAIN[ST.domain].label + '</span></div>' +
        '<div class="hd-tip-row"><span>' + DOMAIN[ST.domain].short + '</span><b>' + fmtInt(v.cnt) + ' 例</b></div>' +
        '<div class="hd-tip-row"><span>粗' + (ST.domain === 'death' ? '死亡率' : '发病率') + '</span><b>' + f1(v.rate) + ' /10万</b></div>' +
        '<div class="hd-tip-row"><span>中标率</span><b>' + f1(v.asr) + ' /10万</b></div>' +
        '<div class="hd-tip-row"><span>M/I 比</span><b>' + f2(r.mi) + '</b></div>' +
        /* 2026-10-20 按需求：提示框与版头指标保持一致，删除「MV% / DCO%」行。
           现 6 行 = 版头 5 张卡（新发/粗率/中标率/M/I/随访率）+ 待处置预警。
           MV%/DCO% 仍可在「数据中心 ▸ 数据看板」与地市详情弹窗查看。
           恢复见 home-dashboard.js.bak_pre_tip_align_20261020。 */
        '<div class="hd-tip-row"><span>随访完成率</span><b>' + f1(r.fu) + '%</b></div>' +
        '<div class="hd-tip-row"><span>待处置预警</span><b>' + r.warnPending + ' 条</b></div>' +
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
      var c = e.target && e.target.getAttribute ? e.target.getAttribute('data-hd-city') : '';
      if (!c) return;
      hdCity(ST.city === c ? '' : c);
    });
    document.querySelectorAll('#pageContainer [data-hd-pick]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        var c = ev.currentTarget.getAttribute('data-hd-pick');
        if (c) hdCity(ST.city === c ? '' : c);
      });
    });
    document.querySelectorAll('#pageContainer [data-hd-detail]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openCityModal(ev.currentTarget.getAttribute('data-hd-detail'));
      });
    });
    document.querySelectorAll('#pageContainer [data-hd-clear]').forEach(function (el) {
      el.addEventListener('click', function (ev) { ev.stopPropagation(); hdCity(''); });
    });
    document.querySelectorAll('#pageContainer [data-hd]').forEach(function (el) {
      el.addEventListener('change', function (ev) {
        var k = ev.currentTarget.getAttribute('data-hd');
        if (k === 'year') ST.year = +ev.currentTarget.value;
        if (k === 'metric') ST.metric = ev.currentTarget.value;
        if (k === 'city') ST.city = ev.currentTarget.value;
        rerender();
      });
    });
    document.querySelectorAll('#pageContainer [data-hd-domain]').forEach(function (el) {
      el.addEventListener('click', function (ev) { ST.domain = ev.currentTarget.getAttribute('data-hd-domain'); rerender(); });
    });
    /* 行动信号卡（.hd-sig / .hd-sig-btn）的点击绑定随该区块一并删除（2026-10-19）。 */
  }

  function hdCity(code) {
    ST.city = code || '';
    rerender();
    toast(code ? '已聚焦 ' + META[code].f + '（再次单击地图或选「全省」返回）' : '已返回全省视角');
  }
  function hdToggleFs() {
    ST.fs = !ST.fs;
    document.body.classList.toggle('hd-fs', ST.fs);
    rerender();
    toast(ST.fs ? '已进入大屏模式，按 Esc 退出' : '已退出大屏模式');
  }
  function hdRefresh() { CACHE = {}; rerender(); toast('预警数据已刷新'); }
  function hdCloseModal() {
    var m = document.getElementById('hdModal');
    if (m) m.parentNode.removeChild(m);
  }
  /* hdExport()（复制地市指标 TSV 到剪贴板）随页脚导出按钮一并删除（2026-10-20），
     恢复见 home-dashboard.js.bak_pre_del_export_20261020。 */

  window.hdCity = hdCity;
  window.hdToggleFs = hdToggleFs;
  window.hdRefresh = hdRefresh;
  window.hdCloseModal = hdCloseModal;
  window.hdCityModal = openCityModal;
  window.hdCityModalHtml = cityModalHtml;
  // 对外入口：其他模块可用 hdOpen({city:'360700',domain:'death',year:2025}) 直达并预置筛选
  window.hdOpen = function (opts) {
    opts = opts || {};
    if (opts.year && YEARS.indexOf(+opts.year) >= 0) ST.year = +opts.year;
    if (opts.domain && DOMAIN[opts.domain]) ST.domain = opts.domain;
    if (opts.metric && METRICS[opts.metric]) ST.metric = opts.metric;
    if (opts.city !== undefined) ST.city = META[opts.city] ? opts.city : '';
    if (typeof window.navigateTo === 'function') window.navigateTo(PAGE); else mount();
  };
  window.hdGetState = function () { return { year: ST.year, domain: ST.domain, metric: ST.metric, city: ST.city, fs: ST.fs }; };
  window.homeDashboardPageIds = [PAGE];
  window.renderHomeDashboardPage = function (id) { if (id === PAGE) { hdCloseModalSafe(); mount(); } };

  /* 对外数据层：本模块自带一份地市基线副本，导出为 window.HDData。
     ⚠️ 与 cockpit-module.js 的 window.CKData 是【两份独立数据】，彼此不联动。
     决策视图、国家上报等模块消费的是 CKData（数据中心那套），不受本文件影响。 */
  window.HDData = {
    YEARS: YEARS, CUR_YEAR: CUR_YEAR, CUR_MONTH: CUR_MONTH, PARTIAL: PARTIAL,
    META: META, CODES: CODES, DOMAIN: DOMAIN, QC: QC, SITES: SITES, COUNTIES: COUNTIES,
    build: build, agg: agg, view: view, countyRows: countyRows,
    esc: esc, clamp: clamp, fmtInt: fmtInt, f1: f1, f2: f2, num: num,
    hash: hash, rnd: rnd, sum: sum, norm: norm, cutoff: cutoff
  };
  window.HDData.cutoffFor = function (year) {
    var d = year < CUR_YEAR ? new Date(year, 11, 31) : new Date(CUR_YEAR, CUR_MONTH, 0);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var m = document.getElementById('hdModal');
      if (m) { hdCloseModal(); return; }
      if (ST.fs) hdToggleFs();
    }
  });

  /* ==================== 11. 样式 ==================== */
  var css = [
    /* 预警态势横条 / 行动信号 的样式随两个区块一并删除（2026-10-19）。
       恢复时连同 shell() 的调用、markup 样式一起按
       _home_dashboard_restore_warnbar_sig.js 的步骤取回。 */
    /* 决策入口 */
    /* .hd-decision / .hd-dec-* 样式随「卫健领导决策视图」横幅卡片一并删除（2026-10-10） */
    /* 深色大屏容器：挂在 .hd-board 专属类上，不再污染全站的 .hd（卡片标题栏通用类）。
       这是修复「质控卡片标题栏变深色条 / 文字重叠」的关键。 */
    '.hd-board{--line:rgba(120,190,255,.16);--line2:rgba(120,190,255,.28);--cy:#5fe1f0;--gd:#ffd166;--tx:#cfe4f7;--mu:#7d95b3;',
    'position:relative;margin:-20px;padding:0 0 16px;background:radial-gradient(1200px 600px at 50% -180px,#0d2c4d 0%,#071726 55%,#050e18 100%);',
    'color:var(--tx);font-family:"Microsoft YaHei","PingFang SC",-apple-system,"Segoe UI",sans-serif;border-bottom:0}',
    '.hd-board::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(120,190,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(120,190,255,.035) 1px,transparent 1px);background-size:44px 44px}',
    '.hd-board>*{position:relative;z-index:1}',
    '.hd-board.fs{position:fixed;inset:0;z-index:1500;overflow:auto;min-width:1220px;margin:0;padding:0 0 12px}',
    'body.hd-fs .sidebar,body.hd-fs .breadcrumb{display:none!important}',
    'body.hd-fs .main-content{left:0!important;padding:0!important;overflow:hidden!important}',
    /* 头部 */
    '.hd-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 20px 12px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,rgba(18,58,96,.55),rgba(8,24,40,.05))}',
    '.hd-brand{display:flex;align-items:center;gap:12px;min-width:0}',
    '.hd-logo{width:38px;height:38px;filter:drop-shadow(0 0 10px rgba(95,225,240,.5))}',
    '.hd-title h1{margin:0;font-size:19px;font-weight:800;letter-spacing:1.5px;background:linear-gradient(90deg,#eaf7ff,#5fe1f0 60%,#a9e8ff);-webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap}',
    /* .hd-title-sub / .hd-sub-txt / .hd-live / @keyframes hdPulse 随副标题行删除（2026-10-20），
       恢复见 home-dashboard.js.bak_pre_del_subtitle_20261020 */
    '.hd-tools{display:flex;align-items:center;gap:9px;flex-wrap:wrap}',
    '.hd-tool{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--mu)}',
    '.hd-clock{font-size:12px;color:var(--cy);font-variant-numeric:tabular-nums;letter-spacing:.5px;padding:0 4px}',
    '.hd-sel{height:29px;background:#0b2338;color:var(--tx);border:1px solid var(--line2);border-radius:4px;padding:0 8px;font-size:12.5px;outline:none}',
    '.hd-sel-dark{height:26px;font-size:12px}',
    '.hd-seg{display:flex;border:1px solid var(--line2);border-radius:4px;overflow:hidden}',
    '.hd-seg button{appearance:none;border:0;background:transparent;color:var(--mu);padding:0 12px;height:29px;font-size:12.5px;cursor:pointer;font-family:inherit}',
    '.hd-seg button.on{background:linear-gradient(180deg,#1a6fa0,#124a72);color:#eafcff;text-shadow:0 0 8px rgba(95,225,240,.6)}',
    '.hd-btn{appearance:none;height:29px;padding:0 12px;border:1px solid var(--line2);border-radius:4px;background:rgba(18,58,96,.35);color:var(--tx);font-size:12.5px;cursor:pointer;font-family:inherit}',
    '.hd-btn:hover{border-color:var(--cy);color:#eafcff}',
    '.hd-btn.primary{background:linear-gradient(180deg,#22a5c9,#146f92);border-color:#2fd0e6;color:#03131d;font-weight:700}',
    /* KPI */
    '.hd-kpi-row{padding:12px 20px 0}',
    /* KPI 网格：2026-10-20 删除「待处置预警」卡后由 6 列改为 5 列 */
    '.hd-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}',
    '@media(max-width:1500px){.hd-kpis{grid-template-columns:repeat(3,1fr)}}',
    '@media(max-width:760px){.hd-kpis{grid-template-columns:repeat(2,1fr)}}',
    /* 卡片只留标题+数值后，纵向内边距加大一点，避免卡片被压得过扁 */
    '.hd-kpi{position:relative;overflow:hidden;padding:13px 13px 12px;border:1px solid var(--line);border-radius:8px;background:linear-gradient(160deg,rgba(20,64,104,.5),rgba(8,24,40,.55))}',
    '.hd-kpi::after{content:"";position:absolute;left:0;top:0;width:2px;height:100%;background:var(--cy);opacity:.75}',
    '.hd-kpi.ok::after{background:#34d399}.hd-kpi.bad::after{background:#fb7185}.hd-kpi.warn::after{background:var(--gd)}',
    '.hd-kpi-l{font-size:11.5px;color:var(--mu);letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.hd-kpi-v{margin-top:6px;font-size:27px;font-weight:800;color:#eafaff;font-variant-numeric:tabular-nums;line-height:1.15}',
    '.hd-kpi-v em{margin-left:4px;font-size:11px;font-style:normal;color:var(--mu);font-weight:400}',
    /* .hd-kpi-b / .hd-spark / .hd-kpi-delta 样式随 KPI 卡底部行一并删除（2026-10-19），
       恢复见 home-dashboard.js.bak_pre_kpi_strip_20261019 */
    /* 报告卡质量横条（2026-10-19 新增）：1 个超标汇总 + 5 个质量指标 */
    '.hd-qcbar{margin:10px 20px 0;border:1px solid var(--line);border-radius:8px;background:linear-gradient(180deg,rgba(14,44,74,.5),rgba(7,20,34,.6));overflow:hidden}',
    '.hd-qcbar-hd{display:flex;align-items:center;gap:10px;padding:8px 13px;border-bottom:1px solid var(--line)}',
    '.hd-qcbar-t{position:relative;padding-left:9px;font-size:13px;font-weight:700;color:#dff3ff;letter-spacing:.6px}',
    '.hd-qcbar-t::before{content:"";position:absolute;left:0;top:2px;width:3px;height:12px;background:linear-gradient(180deg,var(--cy),#1c6f9e)}',
    '.hd-qcbar-sub{font-size:11px;color:var(--mu)}',
    '.hd-qcbar-hd .hd-btn{margin-left:auto}',
    '.hd-qcbar-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:1px;background:var(--line)}',
    '@media(max-width:1500px){.hd-qcbar-grid{grid-template-columns:repeat(3,1fr)}}',
    '@media(max-width:760px){.hd-qcbar-grid{grid-template-columns:repeat(2,1fr)}}',
    /* .hd-qc-sum 随「超标指标 N/5」汇总格一并删除（2026-10-20），只剩 .hd-qc-cell */
    '.hd-qc-cell{padding:10px 12px 11px;background:linear-gradient(160deg,rgba(18,52,86,.55),rgba(9,26,44,.7))}',
    '.hd-qc-k{font-size:11.5px;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.hd-qc-v{margin-top:5px;font-size:23px;font-weight:800;color:#eafaff;font-variant-numeric:tabular-nums;line-height:1.15}',
    '.hd-qc-v em{margin-left:3px;font-size:11px;font-style:normal;color:var(--mu);font-weight:400}',
    '.hd-qc-cell.tone-bad .hd-qc-v{color:#ff8fa3}',
    '.hd-qc-cell.tone-warn .hd-qc-v{color:var(--gd)}',
    '.hd-qc-cell.tone-ok .hd-qc-v{color:#6ee7b7}',
    /* .hd-qc-meta / .hd-qc-lim / .hd-qc-tag 随两行小字一并删除（2026-10-19） */
    /* 栅格：两列各自纵向堆叠，align-items:start 让每列按自身内容高度排布。
       2026-10-19 尝试过让两列严格等高（stretch + flex-grow 地图卡），四种写法
       都会因 grid 行高被内容反向拉伸而让地图膨胀到 900px+，故保持原样。
       左列底部若因右列更高而略空，属可接受留白，不再强求齐平。 */
    '.hd-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:12px;padding:12px 20px 0;align-items:start}',
    '.hd-grid.hd-grid-2{grid-template-columns:1fr 1fr}',
    '.hd-grid.hd-grid-ops{grid-template-columns:1.15fr 1fr}',
    '@media(max-width:1200px){.hd-grid,.hd-grid.hd-grid-2,.hd-grid.hd-grid-ops{grid-template-columns:1fr}}',
    '.hd-col{display:flex;flex-direction:column;gap:12px;min-width:0}',
    /* .hd-tbl-row 随「各地市核心指标明细」表一并删除（2026-10-19） */
    /* 面板 */
    '.hd-panel{position:relative;border:1px solid var(--line);border-radius:8px;background:linear-gradient(180deg,rgba(14,44,74,.62),rgba(7,20,34,.72));padding:0 0 8px;animation:hdIn .4s both}',
    '@keyframes hdIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '.hd-p-head,.hd-panel-h{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 13px;border-bottom:1px solid var(--line)}',
    '.hd-panel-h h3{margin:0;position:relative;padding-left:9px;font-size:13px;font-weight:700;color:#dff3ff;letter-spacing:.6px}',
    '.hd-panel-h h3::before{content:"";position:absolute;left:0;top:2px;width:3px;height:12px;background:linear-gradient(180deg,var(--cy),#1c6f9e)}',
    '.hd-panel-h em{font-size:11px;font-style:normal;color:var(--mu)}',
    '.hd-panel-meta{font-size:11px;color:var(--mu)}',
    '.hd-p-title{position:relative;padding-left:9px;font-size:13px;font-weight:700;color:#dff3ff;letter-spacing:.6px}',
    '.hd-p-title::before{content:"";position:absolute;left:0;top:2px;width:3px;height:12px;background:linear-gradient(180deg,var(--cy),#1c6f9e)}',
    '.hd-p-tools{display:flex;align-items:center;gap:8px}',

    '.hd-scope,.hd-focus{font-size:11.5px;color:var(--mu);border:1px dashed var(--line2);border-radius:3px;padding:2px 7px}',
    '.hd-focus{color:var(--gd);border-color:rgba(255,209,102,.5);border-style:solid;cursor:pointer}',
    '.hd-svg{display:block;width:100%;height:150px}',
    '.hd-mapwrap .hd-svg,.hd-svg{min-height:120px}',
    '.hd-ax{font-size:9.5px;fill:#7d95b3}',
    '.hd-py-v{font-size:10px;fill:#cfe4f7;font-variant-numeric:tabular-nums}',
    '.hd-py-g{font-size:9.5px;fill:#eaf6ff;paint-order:stroke;stroke:#071522;stroke-width:3.2px;stroke-linejoin:round}',
    '.hd-vl{font-size:10.5px;font-weight:700}',
    '.hd-legend{display:flex;gap:14px;justify-content:center;padding:2px 0 4px;font-size:11px;color:var(--mu)}',
    '.hd-legend span{display:inline-flex;align-items:center;gap:5px}',
    '.hd-legend i{width:10px;height:3px;border-radius:2px}',
    /* 地图 */
    '.hd-map-body{position:relative;height:400px;padding:4px 8px 0}',
    '.hd-board.fs .hd-map-body{height:456px}',
    '.hd-map-grid{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(120,190,255,.14) 1px,transparent 1px);background-size:26px 26px;opacity:.5;pointer-events:none}',
    '.hd-map{position:relative;width:100%;height:100%}',
    '.hd-region{stroke:rgba(140,215,255,.55);stroke-width:.9;cursor:pointer;transition:fill .2s,opacity .2s}',
    '.hd-region:hover{stroke:#fff;stroke-width:1.6;filter:brightness(1.35)}',
    '.hd-region.on{filter:brightness(1.35) drop-shadow(0 0 8px rgba(255,209,102,.65))}',
    '.hd-lb-n{font-size:13px;fill:#e7f6ff;text-anchor:middle;pointer-events:none;paint-order:stroke;stroke:rgba(4,14,24,.85);stroke-width:3px;letter-spacing:1px;font-weight:700}',
    '.hd-lb-v{font-size:11px;fill:#9fd8f2;text-anchor:middle;pointer-events:none;paint-order:stroke;stroke:rgba(4,14,24,.8);stroke-width:3px;font-variant-numeric:tabular-nums}',
    '.hd-legend-map{position:absolute;left:12px;bottom:8px;padding:7px 9px;border:1px solid var(--line);border-radius:4px;background:rgba(6,18,30,.72);font-size:10.5px;color:var(--mu)}',
    '.hd-legend-title{font-size:11px;color:#dff3ff;margin-bottom:4px}',
    '.hd-legend-map span{display:flex;align-items:center;gap:6px;line-height:17px;font-variant-numeric:tabular-nums}',
    '.hd-legend-map i{width:14px;height:8px;border-radius:1px;border:1px solid rgba(255,255,255,.14)}',
    /* .hd-map-extras / .hd-x-item 随地图右上角浮层一并删除（2026-10-20） */
    '.hd-tip{position:absolute;display:none;z-index:5;width:222px;padding:8px 10px;border:1px solid rgba(95,225,240,.45);border-radius:4px;background:rgba(5,17,28,.94);box-shadow:0 8px 24px rgba(0,0,0,.5);pointer-events:none}',
    '.hd-tip-h{font-size:13px;font-weight:700;color:#eafaff;display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:5px;margin-bottom:5px}',
    '.hd-tip-h span{font-size:10.5px;color:var(--mu);font-weight:400}',
    '.hd-tip-row{display:flex;justify-content:space-between;font-size:11.5px;line-height:19px;color:var(--mu)}',
    '.hd-tip-row b{color:#cfeeff;font-variant-numeric:tabular-nums}',

    /* 横向条 */
    '.hd-hb{padding:8px 12px 4px}',
    '.hd-hb-row{display:flex;align-items:center;gap:8px;margin-bottom:5px}',
    '.hd-hb-name{flex:0 0 96px;font-size:12px;color:#cfe4f7;display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden}',
    '.hd-hb-name b{flex:0 0 15px;height:15px;line-height:15px;text-align:center;font-size:10px;color:#04121d;background:var(--mu);border-radius:2px}',
    '.hd-hb-row:nth-child(-n+3) .hd-hb-name b{background:var(--gd)}',
    '.hd-hb-icd{font-size:10px;color:#5f7a97}',
    '.hd-hb-track{position:relative;flex:1;height:15px;background:rgba(120,190,255,.08);border-radius:2px;overflow:hidden}',
    '.hd-hb-fill{position:absolute;left:0;top:0;height:100%;background:linear-gradient(90deg,#1a6fa0,#63e2e6);border-radius:2px}',
    '.hd-hb-fill.top{background:linear-gradient(90deg,#2a9bc4,#ffd166)}',
    '.hd-hb-fill.warm{background:linear-gradient(90deg,#7a2334,#f58f6a)}',
    '.hd-hb-val{flex:0 0 88px;text-align:right;font-size:10.5px;color:#e9f7ff;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.hd-hb-val em{font-style:normal;color:#9ec3e0;margin-left:4px}',
    /* 随访率排名（fuPanel）：按达标三档着色 + 目标线刻度，与 TOP10 的相对长度条区分开 */
    '.hd-hb-fill.good{background:linear-gradient(90deg,#1a6fa0,#63e2e6)}',
    '.hd-hb-fill.bad{background:linear-gradient(90deg,#7a2334,#f58f6a)}',
    '.hd-hb-goal{position:absolute;top:0;bottom:0;width:0;border-left:1px dashed rgba(255,209,102,.75);pointer-events:none}',
    '.hd-hb--fu{padding:4px 12px 6px}',
    '.hd-hb--fu .hd-hb-name{flex:0 0 92px;gap:4px}',
    '.hd-hb--fu .hd-hb-row{margin-bottom:4px;gap:7px}',
    '.hd-hb--fu .hd-hb-val{flex:0 0 92px}',
    '.hd-hb--fu .hd-hb-val em{font-size:9.5px;margin-left:3px}',
    '.hd-hb-val em.ok{color:#6ee7b7}',
    '.hd-hb-val em.bad{color:#ff8fa3}',
    '.hd-fuhd{display:flex;align-items:center;gap:10px;padding:6px 12px 0;font-size:11px;color:#7d95b3}',
    '.hd-fuhd .hd-fuscale{color:#5f7a97}',
    '.hd-fuhd .hd-fugoal{margin-left:auto;color:rgba(255,209,102,.85)}',
    /* 质控仪表 */
    '.hd-gauges{padding:9px 12px 2px}',
    '.hd-gauge{margin-bottom:9px}',
    '.hd-gauge-top{display:flex;justify-content:space-between;font-size:12px;color:#cfe4f7}',
    '.hd-gauge-top b{color:#eafaff;font-variant-numeric:tabular-nums}',
    '.hd-gauge-track{position:relative;height:9px;margin:4px 0 3px;background:rgba(120,190,255,.1);border-radius:5px;overflow:hidden}',
    '.hd-gauge-track i{position:absolute;left:0;top:0;height:100%;background:linear-gradient(90deg,#1e86b4,#6ee7b7);border-radius:5px}',
    '.hd-gauge.bad .hd-gauge-track i{background:linear-gradient(90deg,#a83247,#ffb08a)}',
    '.hd-gauge-track u{position:absolute;top:-2px;width:2px;height:13px;background:var(--gd);box-shadow:0 0 6px rgba(255,209,102,.8)}',
    '.hd-gauge-foot{display:flex;justify-content:space-between;font-size:10.5px;color:var(--mu)}',
    '.hd-tag{font-size:10px;padding:1px 6px;border-radius:2px;border:1px solid}',
    '.hd-tag.ok{color:#6ee7b7;border-color:rgba(110,231,183,.45);background:rgba(110,231,183,.1)}',
    '.hd-tag.bad{color:#ff8fa3;border-color:rgba(255,143,163,.45);background:rgba(255,143,163,.1)}',
    /* 排行 */
    /* 漏斗 */
    '.hd-funnel{padding:9px 12px 2px}',
    '.hd-fs-row{display:flex;align-items:center;gap:8px;margin-bottom:5px}',
    '.hd-fs-name{flex:0 0 118px;font-size:11.5px;color:var(--mu);text-align:right;white-space:nowrap}',
    '.hd-fs-track{flex:1;height:20px;display:flex;justify-content:center}',
    '.hd-fs-track i{display:flex;align-items:center;justify-content:center;height:100%;background:linear-gradient(180deg,rgba(95,225,240,.85),rgba(28,111,158,.9));color:#03131d;font-size:11px;font-weight:700;clip-path:polygon(3% 0,97% 0,100% 100%,0 100%);border-radius:2px;font-variant-numeric:tabular-nums}',
    '.hd-fs-pct{flex:0 0 46px;font-size:11.5px;color:#9fd8f2;font-variant-numeric:tabular-nums}',
    /* 预警（.hd-warn-* / .hd-dot）：样式随「三层预警与处置」区块一并删除（2026-10-19），
       还原点见 home-dashboard.js.bak_pre_del_warnpanel_20261019 */
    /* 表格（.hd-tblwrap 随首页那张明细表删除，2026-10-19；.hd-tbl 本身保留给弹窗县区表） */
    '.hd-tbl{width:100%;border-collapse:collapse;font-size:12px;min-width:1080px;table-layout:fixed}',
    /* 列宽：地市列吃掉剩余空间，数值列固定窄宽右对齐。
       不用 table-layout:auto —— 宽屏下浏览器会把 6 个数值列平均撑开，
       表头与数字隔得老远，看起来"没对齐"。 */
    '.hd-tbl th:first-child,.hd-tbl td:first-child{width:auto}',
    '.hd-tbl th.hd-num,.hd-tbl td.hd-num{width:104px}',
    '.hd-tbl th:last-child,.hd-tbl td:last-child{width:104px}',
    '.hd-mtable .hd-tbl th.hd-num,.hd-mtable .hd-tbl td.hd-num{width:auto}',
    '.hd-mtable .hd-tbl th:last-child,.hd-mtable .hd-tbl td:last-child{width:auto}',
    '.hd-tbl th{position:sticky;top:0;z-index:2;background:#0d2c48;color:#a9c9e6;font-weight:600;font-size:11.5px;padding:7px 8px;text-align:left;border-bottom:1px solid var(--line2);white-space:nowrap}',
    '.hd-tbl td{padding:6px 8px;border-bottom:1px solid rgba(120,190,255,.09);color:#d8ebfa;white-space:nowrap}',
    '.hd-tbl tbody tr{cursor:pointer}',
    '.hd-tbl tbody tr:hover td{background:rgba(120,190,255,.07)}',
    '.hd-tbl tr.on td{background:rgba(255,209,102,.09)}',
    '.hd-tbl tr.hd-total td{background:rgba(95,225,240,.09);border-top:1px solid var(--line2);font-weight:700;color:#eafaff}',
    /* .hd-num 必须同时压过 .hd-tbl th 的 text-align:left —— 后者是"元素+类"选择器，
       优先级高于单独的 .hd-num，导致表头左对齐、数据右对齐而错位。
       这里用 .hd-tbl th.hd-num / .hd-tbl td.hd-num 对齐，保证表头与数值列同侧。 */
    '.hd-num,.hd-tbl th.hd-num,.hd-tbl td.hd-num{text-align:right;font-variant-numeric:tabular-nums}',
    '.hd-num.good{color:#6ee7b7}.hd-num.bad{color:#ff8fa3;font-weight:700}.hd-num.strong{color:#eafaff;font-weight:700}',
    /* .hd-city / .hd-op 随首页明细表删除（2026-10-19）；弹窗县区表不含这两类单元格 */
    '.hd-link{appearance:none;background:none;border:0;color:#7fd3f5;font-size:11.5px;cursor:pointer;padding:0 4px;font-family:inherit;text-decoration:underline}',
    '.hd-link:hover{color:var(--gd)}',
    '.hd-foot{display:flex;justify-content:space-between;padding:9px 22px 0;font-size:11px;color:#5f7a97}',
    '.hd-empty{padding:24px;text-align:center;color:var(--mu);font-size:12px}',
    /* 弹窗 */
    '.hd-modal{position:fixed;inset:0;z-index:1800;background:rgba(2,8,14,.72);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:22px}',
    '.hd-mbox{width:min(1120px,100%);max-height:100%;overflow:auto;border:1px solid rgba(95,225,240,.4);border-radius:6px;background:linear-gradient(180deg,#0a2135,#061322);box-shadow:0 24px 70px rgba(0,0,0,.6);color:#cfe4f7;font-family:inherit}',
    '.hd-mhead{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(120,190,255,.16);position:sticky;top:0;background:#0a2135;z-index:2}',
    '.hd-mtitle{font-size:15px;font-weight:700;color:#eafaff;letter-spacing:1px}',
    '.hd-msub{margin-left:10px;font-size:11.5px;font-weight:400;color:#7d95b3;letter-spacing:0}',
    '.hd-mclose{appearance:none;width:26px;height:26px;border:1px solid rgba(120,190,255,.3);border-radius:3px;background:transparent;color:#cfe4f7;cursor:pointer;font-size:13px}',
    '.hd-mclose:hover{border-color:#ff8fa3;color:#ff8fa3}',
    '.hd-mbody{padding:14px 16px 16px}',
    '.hd-mstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px}',
    '.hd-mstat{border:1px solid rgba(120,190,255,.16);border-left:2px solid #5fe1f0;border-radius:4px;padding:7px 10px;background:rgba(14,44,74,.5)}',
    '.hd-mstat span{display:block;font-size:11px;color:#7d95b3}.hd-mstat b{font-size:18px;color:#eafaff;font-variant-numeric:tabular-nums}',
    '.hd-mgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}',
    '.hd-mcard{border:1px solid rgba(120,190,255,.16);border-radius:5px;background:rgba(8,26,44,.6);padding:0 0 8px}',
    '.hd-mcard.wide{grid-column:1/-1}',
    '.hd-mc-title{padding:8px 11px;font-size:12.5px;font-weight:700;color:#dff3ff;border-bottom:1px solid rgba(120,190,255,.13)}',

    '.hd-radar{display:block;width:100%;max-width:210px;margin:6px auto 0}',
    '.hd-rd-l{font-size:8.5px;fill:#9fd8f2}.hd-rd-v{font-size:9px;fill:#eafaff;font-weight:700}',
    '.hd-donut{display:flex;align-items:center;gap:8px;padding:8px 10px 0}',
    '.hd-donut svg{width:140px;height:140px;flex:0 0 132px}',
    '.hd-dn-v{font-size:17px;font-weight:800;fill:#eafaff}.hd-dn-l{font-size:9px;fill:#7d95b3}',
    '.hd-dn-legend{display:flex;flex-direction:column;gap:5px;font-size:11px;color:#9fd8f2}',
    '.hd-dn-legend span{display:flex;align-items:center;gap:5px}.hd-dn-legend i{width:9px;height:9px;border-radius:2px}',
    '.hd-dn-legend b{color:#eafaff;font-variant-numeric:tabular-nums}',
    '.hd-mtable{max-height:280px;overflow:auto;padding:0 6px}',
    '.hd-mtable .hd-tbl{min-width:0;table-layout:auto}',
    '.hd-mfoot{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}',
    /* 滚动条 */
    '.hd ::-webkit-scrollbar{width:7px;height:7px}.hd ::-webkit-scrollbar-thumb{background:rgba(120,190,255,.25);border-radius:4px}.hd ::-webkit-scrollbar-track{background:transparent}'
  ].join('');

  var st = document.createElement('style');
  st.id = 'hd-style';
  st.textContent = css;
  document.head.appendChild(st);

  /* ==================== 12. 接线（包装 renderPage） ==================== */
  var ST = { year: CUR_YEAR, domain: 'inc', metric: 'cases', city: '', fs: false };
  // 2026 年（当年）默认聚焦已登记完整年度，避免首屏全是"累计"
  if (CUR_MONTH < 6) ST.year = CUR_YEAR - 1;

  var _origRender = window.renderPage;
  /* 只拦本模块的 home-dashboard 一页。大屏态（body.hd-fs + ST.fs）是"离开大屏必须清理"的
     隐式契约：大屏内互切保留大屏，出去到别的模块一律清掉。
     注意：本模块的 hd-fs 与 cockpit-module.js 的 ck-fs 是两个独立类名，
     互不干扰——在首页进大屏后跳到「数据中心 ▸ 数据看板」不会残留全屏态。 */
  if (typeof _origRender === 'function') {
    window.renderPage = function (id) {
      if (id === PAGE) { hdCloseModalSafe(); mount(); return; }
      document.body.classList.remove('hd-fs');
      if (ST.fs) ST.fs = false;
      return _origRender.apply(this, arguments);
    };
  }
  function hdCloseModalSafe() { try { hdCloseModal(); } catch (e) { } }
})();
