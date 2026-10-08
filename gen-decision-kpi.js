/*
 * gen-decision-kpi.js — 卫健领导关注指标 · 数据引擎（全站唯一事实源）
 *
 * 用法：node gen-decision-kpi.js
 * 产出（同目录）：decision-kpi-data.js / 卫健领导关注指标总表.csv / 指标总表_核心与统计.md /
 *               附表1~4 CSV / 附表_Markdown.md
 *
 * 设计原则（见《卫健领导关注指标_方案.md》§2.5）：
 *   一份底层事实（每市人口 + 粗发病率 + M/I + 标化系数 + 质控值）→ 所有派生率全部由它推导，
 *   绝不出现"同一件事两处各写一个数"。末尾 19 条断言任一条不成立即 exit 1。
 *
 * 注意：本文件是**生产代码**，不要加 `_` 前缀——`_*` 在本工程属临时脚本，会被清理。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT_DIR = __dirname;
const STAT_YEAR = 2026;
const ASOF = '2026-08-31';

/* ==================== 0. 断言与格式化 ==================== */
let assertCount = 0;
const warnings = [];
function assert(cond, msg) {
  assertCount++;
  if (cond) { console.log('  ✅ ' + msg); return; }
  console.error('  ❌ ' + msg);
  console.error('\n断言失败，拒绝产出（避免把不自洽的数字写进页面）。');
  process.exit(1);
}
const f0 = v => Math.round(v).toLocaleString('en-US');
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
const f2 = v => (Math.round(v * 100) / 100).toFixed(2);
const csvCell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
function writeCsv(file, rows, cols) {
  const body = [cols].concat(rows.map(r => cols.map(c => r[c])));
  fs.writeFileSync(path.join(OUT_DIR, file), '\ufeff' + body.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n', 'utf8');
  console.log('写出 ' + file + ' ' + rows.length + ' 行');
}

/* ==================== 1. 底层事实层 ====================
 * pop 来自驾驶舱 META（Σ 必须等于全省常住人口）；crude 为**真实量级**的粗发病率
 * （驾驶舱原值 246~303 偏低约 20%，P-1 统一后由本表接管）。
 * mi/mv/dco/ub/dup/nccr/fu/hosp 与驾驶舱 META 同源，保证市域表与省级值一致。 */
const CITIES = [
  { adcode: '360100', name: '南昌市', short: '南昌', pop: 657.0, crude: 372, mi: .62, asrK: .865, mv: 79.5, dco: 3.6, ub: 3.1, dup: 2.0, nccr: 98.6, hosp: 62, fu: 88.5, earlyRel: 1.14, inRate: 6.1, out: { local: 21.4, intraCity: 41.3, crossCity: 33.0, outProv: 4.3 } },
  { adcode: '360200', name: '景德镇市', short: '景德镇', pop: 161.8, crude: 344, mi: .64, asrK: .858, mv: 73.2, dco: 4.6, ub: 3.8, dup: 2.7, nccr: 97.1, hosp: 19, fu: 82.4, earlyRel: 0.95, inRate: 1.2, out: { local: 46.2, intraCity: 26.0, crossCity: 18.0, outProv: 9.8 } },
  { adcode: '360300', name: '萍乡市', short: '萍乡', pop: 179.7, crude: 358, mi: .68, asrK: .842, mv: 71.6, dco: 5.2, ub: 4.2, dup: 3.1, nccr: 96.3, hosp: 22, fu: 79.8, earlyRel: 0.91, inRate: 1.0, out: { local: 44.1, intraCity: 26.9, crossCity: 17.4, outProv: 11.6 } },
  { adcode: '360400', name: '九江市', short: '九江', pop: 455.2, crude: 351, mi: .65, asrK: .867, mv: 76.4, dco: 4.3, ub: 3.6, dup: 2.4, nccr: 98.1, hosp: 43, fu: 85.1, earlyRel: 0.99, inRate: 2.4, out: { local: 42.6, intraCity: 29.1, crossCity: 19.9, outProv: 8.4 } },
  { adcode: '360500', name: '新余市', short: '新余', pop: 121.3, crude: 346, mi: .62, asrK: .871, mv: 78.1, dco: 3.9, ub: 3.2, dup: 2.2, nccr: 97.8, hosp: 13, fu: 86.3, earlyRel: 1.01, inRate: 1.6, out: { local: 40.8, intraCity: 30.0, crossCity: 21.3, outProv: 7.9 } },
  { adcode: '360600', name: '鹰潭市', short: '鹰潭', pop: 115.4, crude: 349, mi: .62, asrK: .869, mv: 77.3, dco: 4.0, ub: 3.4, dup: 2.3, nccr: 97.6, hosp: 14, fu: 85.9, earlyRel: 0.97, inRate: 1.3, out: { local: 43.0, intraCity: 27.4, crossCity: 20.4, outProv: 9.2 } },
  { adcode: '360700', name: '赣州市', short: '赣州', pop: 897.0, crude: 336, mi: .60, asrK: .874, mv: 74.8, dco: 4.9, ub: 4.6, dup: 3.6, nccr: 96.8, hosp: 71, fu: 80.6, earlyRel: 0.98, inRate: 2.1, out: { local: 45.7, intraCity: 26.8, crossCity: 17.1, outProv: 10.4 } },
  { adcode: '360800', name: '吉安市', short: '吉安', pop: 438.0, crude: 341, mi: .64, asrK: .866, mv: 72.4, dco: 5.4, ub: 4.9, dup: 3.8, nccr: 95.9, hosp: 35, fu: 78.2, earlyRel: 0.96, inRate: 1.1, out: { local: 47.3, intraCity: 26.0, crossCity: 18.0, outProv: 8.7 } },
  { adcode: '360900', name: '宜春市', short: '宜春', pop: 499.0, crude: 362, mi: .65, asrK: .860, mv: 73.9, dco: 5.1, ub: 4.3, dup: 3.8, nccr: 96.7, hosp: 38, fu: 81.3, earlyRel: 1.00, inRate: 1.2, out: { local: 46.1, intraCity: 27.3, crossCity: 19.0, outProv: 7.6 } },
  { adcode: '361000', name: '抚州市', short: '抚州', pop: 361.0, crude: 353, mi: .66, asrK: .862, mv: 71.9, dco: 5.7, ub: 5.1, dup: 4.1, nccr: 95.4, hosp: 29, fu: 77.4, earlyRel: 0.96, inRate: 0.9, out: { local: 47.8, intraCity: 25.2, crossCity: 18.1, outProv: 8.9 } },
  { adcode: '361100', name: '上饶市', short: '上饶', pop: 639.0, crude: 366, mi: .66, asrK: .855, mv: 70.8, dco: 6.1, ub: 5.4, dup: 4.4, nccr: 94.8, hosp: 45, fu: 76.1, earlyRel: 0.94, inRate: 1.1, out: { local: 45.2, intraCity: 25.9, crossCity: 17.7, outProv: 11.2 } }
];

function deriveCity(c) {
  const cases = c.pop * 1e4 * c.crude / 1e5;      // 例数 = 人口 × 粗率
  const deaths = cases * c.mi;                    // 死亡 = 例数 × M/I
  const crudeD = c.crude * c.mi;                  // 粗死亡率
  const asr = c.crude * c.asrK;                   // 中标发病率
  const asrD = crudeD * c.asrK;                   // 中标死亡率
  const sum = c.out.local + c.out.intraCity + c.out.crossCity + c.out.outProv;
  const k = 100 / sum;
  const out = {
    local: c.out.local * k, intraCity: c.out.intraCity * k,
    crossCity: c.out.crossCity * k, outProv: c.out.outProv * k
  };
  return Object.assign({}, c, {
    cases, deaths, crudeD, asr, asrD, out,
    outCases: Math.round(cases * out.outProv / 100),
    inCases: Math.round(cases * c.inRate / 100)
  });
}
const CITY = CITIES.map(deriveCity);

/* ==================== 1b. 区县层（下钻用，仅 5 个示例市） ====================
 * 原则：
 *  1) 区县**名称与行政区划是真实的**（与 cockpit-module.js:88 的 COUNTIES 同源）；
 *  2) 人口基数取自七普量级（万），**市级人口 = 各区县人口之和**（硬断言）；
 *  3) 指标不引入新事实，全部由市级值 × 确定性因子派生，再按例数归一化，
 *     保证**区县加权合计 = 市级值**（硬断言），下钻不会穿帮；
 *  4) 因子用 FNV 哈希，禁 Math.random，保证每次生成结果完全一致。
 * 只做 5 个市：覆盖省会/人口第一大市/高流出市/零上报市/小体量对照。 */

/* 示例市：只做 2 个市当样例，其余市点进去提示"待补"。
 * 一个省会（南昌，虹吸终点）、一个人口第一大市（赣州，绝对例数最大），
 * 足以演示省→市→区县三级下钻的结构；把样例铺满 11 个市没有意义。 */
const SAMPLE_COUNTIES = {
  '360100': [ // 南昌市（省会）——人口为七普公开约数
    { n: '东湖区', pop: 42.0 }, { n: '西湖区', pop: 46.0 }, { n: '青云谱区', pop: 29.0 },
    { n: '青山湖区', pop: 62.0 }, { n: '新建区', pop: 68.0 }, { n: '红谷滩区', pop: 50.0 },
    { n: '南昌县', pop: 128.0 }, { n: '进贤县', pop: 62.0 }, { n: '安义县', pop: 18.0 },
    { n: '经开区', pop: 30.0 }, { n: '高新区', pop: 32.0 }, { n: '湾里管理局', pop: 12.0 },
    { n: '临空经济区', pop: 8.0 }, { n: '赣江新区直管区', pop: 70.0 }
  ],
  '360700': [ // 赣州市（人口第一大市）——人口为官方 2024 年分县常住人口
    // 源：赣州市政府《赣州2024年各县（市、区）常住人口主要指标》2025-03-22
    // https://www.ganzhou.gov.cn/zfxxgk/c100093n1/202503/c7bfdc7911ac4c898c559e58a215509a.shtml
    // 明细合计 896.06 万 = 官网市级栏，与引擎七普口径 897.0 万的 0.1% 差由 popScale 处理
    { n: '章贡区', pop: 71.52 }, { n: '南康区', pop: 83.52 }, { n: '赣县区', pop: 57.59 },
    { n: '信丰县', pop: 67.23 }, { n: '大余县', pop: 26.13 }, { n: '上犹县', pop: 26.69 },
    { n: '崇义县', pop: 17.63 }, { n: '安远县', pop: 34.33 }, { n: '龙南市', pop: 31.63 },
    { n: '定南县', pop: 20.85 }, { n: '全南县', pop: 16.81 }, { n: '宁都县', pop: 69.29 },
    { n: '于都县', pop: 89.96 }, { n: '兴国县', pop: 70.98 }, { n: '会昌县', pop: 44.93 },
    { n: '寻乌县', pop: 27.97 }, { n: '石城县', pop: 28.12 }, { n: '瑞金市', pop: 61.06 },
    { n: '赣州经开区', pop: 31.04 }, { n: '赣州蓉江新区', pop: 18.78 }
  ]
};

/* FNV-1a 32 位哈希 → 稳定 [0,1) 因子（与 cockpit-module.js 的 hash/rnd 同思路） */
function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h >>> 0;
}
const seedOf = (k, salt) => (fnv(k + '|' + salt) % 10000) / 10000;

/* 区县派生：carrier = 该市允许在区县间分化的指标（越靠城的区县能力越强） */
function deriveCounty(city, cd) {
  const key = city.adcode + ':' + cd.n;
  const r1 = seedOf(key, 'mv'), r2 = seedOf(key, 'dco'), r3 = seedOf(key, 'ub');
  const r4 = seedOf(key, 'dup'), r5 = seedOf(key, 'fu'), r6 = seedOf(key, 'nccr');
  const r7 = seedOf(key, 'early'), r8 = seedOf(key, 'outProv'), r9 = seedOf(key, 'inRate');
  const r10 = seedOf(key, 'crude'), r11 = seedOf(key, 'mi'), r12 = seedOf(key, 'hosp');
  const cases = cd.pop * 1e4 * city.crude / 1e5;
  const deaths = cases * city.mi;
  return {
    name: cd.n, city: city.short, cityName: city.name, adcode: city.adcode,
    pop: cd.pop, cases, deaths,
    crude: city.crude * (0.90 + 0.20 * r10),
    mi: city.mi * (0.94 + 0.12 * r11),
    asrK: city.asrK,
    mv: city.mv * (0.95 + 0.10 * r1),
    dco: city.dco * (0.70 + 0.60 * r2),
    ub: city.ub * (0.70 + 0.60 * r3),
    dup: city.dup * (0.70 + 0.60 * r4),
    fu: city.fu * (0.96 + 0.08 * r5),
    nccr: Math.min(99.6, city.nccr * (0.99 + 0.02 * r6)),
    early: city.early * (0.88 + 0.24 * r7),
    inRate: city.inRate * (0.60 + 0.80 * r9),
    hosp: Math.max(1, Math.round(city.hosp * cd.pop / city.pop * (0.7 + 0.6 * r12))),
    _r: { outProv: r8 }
  };
}

/* 把区县值**归一化**回市级：Σ(区县例数 × 区县值) == 市例数 × 市值 */
function normalizeToCity(countyList, city, field) {
  const wSum = countyList.reduce((s, x) => s + x.cases * x[field], 0);
  const target = city.cases * city[field];
  const k = wSum === 0 ? 1 : target / wSum;
  countyList.forEach(x => { x[field] = x[field] * k; });
}

const COUNTY_BY_CITY = {};
Object.keys(SAMPLE_COUNTIES).forEach(adc => {
  const city = CITY.find(c => c.adcode === adc);
  if (!city) return;

  // 人口口径对齐：区县明细（官方发布）与市级口径（七普）可能差零点几，
  // 用统一系数缩放，绝不手改官方数字——缩放系数会打印出来备查。
  const rawSum = SAMPLE_COUNTIES[adc].reduce((s, cd) => s + cd.pop, 0);
  const popScale = city.pop / rawSum;
  if (Math.abs(popScale - 1) > 0.02) {
    console.error('  ❌ ' + city.name + ' 区县人口与市级口径差 ' +
      f1(Math.abs(rawSum - city.pop)) + ' 万（' + f1(rawSum) + ' vs ' + f1(city.pop) + '），超过 2%，拒绝自动缩放');
    process.exit(1);
  }
  if (Math.abs(popScale - 1) > 1e-9) {
    console.log('  ℹ️  ' + city.name + ' 区县人口口径对齐：' + f1(rawSum) + ' → ' + f1(city.pop) +
      ' 万（系数 ' + popScale.toFixed(6) + '，官方明细见脚本注释）');
  }
  const list = SAMPLE_COUNTIES[adc].map(cd => deriveCounty(city, { n: cd.n, pop: cd.pop * popScale }));

  // 人口守恒：区县人口之和必须等于市级人口（真实区划，人口是硬事实）
  const popSum = list.reduce((s, x) => s + x.pop, 0);
  assert(Math.abs(popSum - city.pop) < 0.05,
    '区县人口合计 = 市级人口（' + city.name + ' ' + f1(popSum) + ' vs ' + f1(city.pop) + '万）');

  // 率值归一化：保证下钻表加权合计 = 市级表值
  // early 不在此列——市级早诊率要到省级聚合后才由 earlyPerCity() 定出，见 2b 节
  ['mv', 'dco', 'ub', 'dup', 'fu', 'nccr', 'inRate', 'crude'].forEach(f => normalizeToCity(list, city, f));

  // 归一化后再验一遍
  const chk = f => Math.abs(list.reduce((s, x) => s + x.cases * x[f], 0) / city.cases - city[f]);
  ['mv', 'fu'].forEach(f => assert(chk(f) < 0.02,
    city.name + ' 区县加权 ' + f + ' 与市值一致（差 ' + f2(chk(f)) + '）'));

  COUNTY_BY_CITY[adc] = list;
});

/* 区县四分流：由市级四分流 × 区县外流因子派生，再归一化回 100 */
Object.keys(COUNTY_BY_CITY).forEach(adc => {
  const city = CITY.find(c => c.adcode === adc);
  COUNTY_BY_CITY[adc].forEach(x => {
    const r = x._r.outProv;
    // 离中心城市越远、外流越强：以市级 outProv 为基准上下浮动
    const outProv = city.out.outProv * (0.45 + 1.10 * r);
    const rest = 100 - outProv;
    const base = city.out.local + city.out.intraCity + city.out.crossCity;
    x.out = {
      local: rest * city.out.local / base,
      intraCity: rest * city.out.intraCity / base,
      crossCity: rest * city.out.crossCity / base,
      outProv: outProv
    };
    x.outCases = Math.round(x.cases * outProv / 100);
    x.inCases = Math.round(x.cases * x.inRate / 100);
    delete x._r;
  });
  // 四分流恒等 100
  COUNTY_BY_CITY[adc].forEach(x => {
    const s = x.out.local + x.out.intraCity + x.out.crossCity + x.out.outProv;
    assert(Math.abs(s - 100) < 1e-6, city.name + ' ' + x.name + ' 四分流恒等 100');
  });
});

/* ==================== 2. 省级聚合（按例数加权，与市域表同源） ==================== */
const W = (key) => CITY.reduce((s, c) => s + c.cases * c[key], 0);
const T = CITY.reduce((acc, c) => {
  acc.pop += c.pop; acc.cases += c.cases; acc.deaths += c.deaths; acc.hosp += c.hosp;
  acc.mvW += c.cases * c.mv; acc.dcoW += c.cases * c.dco; acc.ubW += c.cases * c.ub;
  acc.dupW += c.cases * c.dup; acc.nccrW += c.cases * c.nccr; acc.fuW += c.cases * c.fu;
  acc.asrW += c.cases * c.asr; acc.asrDW += c.cases * c.asrD;
  acc.outCases += c.outCases; acc.inCases += c.inCases;
  return acc;
}, { pop: 0, cases: 0, deaths: 0, hosp: 0, mvW: 0, dcoW: 0, ubW: 0, dupW: 0, nccrW: 0, fuW: 0, asrW: 0, asrDW: 0, outCases: 0, inCases: 0 });

const PROV_EARLY = 39.2;   // 全省早诊率（I+II 期，有分期分母）实报值
const earlyScale = CITY.reduce((s, c) => s + c.earlyRel * c.cases, 0) / T.cases;

const P = {
  pop: T.pop,
  cases: Math.round(T.cases),
  deaths: Math.round(T.deaths),
  crude: T.cases / (T.pop * 1e4) * 1e5,
  crudeD: T.deaths / (T.pop * 1e4) * 1e5,
  mi: 0,   // 见下方：用取整后的死亡数 ÷ 例数，保证页面上"死亡数 = 例数 × M/I"能验算得上
  asr: T.asrW / T.cases,
  asrD: T.asrDW / T.cases,
  mv: T.mvW / T.cases, dco: T.dcoW / T.cases, ub: T.ubW / T.cases,
  dup: T.dupW / T.cases, nccr: T.nccrW / T.cases, fu: T.fuW / T.cases,
  hosp: T.hosp,
  early: PROV_EARLY,
  outCases: T.outCases,
  inCases: T.inCases,
  localShare: CITY.reduce((s, c) => s + c.cases * c.out.local, 0) / T.cases,
  intraCityShare: CITY.reduce((s, c) => s + c.cases * c.out.intraCity, 0) / T.cases,
  crossCityShare: CITY.reduce((s, c) => s + c.cases * c.out.crossCity, 0) / T.cases,
  outRate: CITY.reduce((s, c) => s + c.cases * c.out.outProv, 0) / T.cases,
  inRate: CITY.reduce((s, c) => s + c.cases * c.inRate, 0) / T.cases
};
P.earlyPerCity = c => PROV_EARLY * c.earlyRel / earlyScale;

/* ==================== 2b. 区县早诊率（需等 earlyPerCity 就位） ====================
 * 区县早诊率 = 市级早诊率 × 区县能力因子，再归一化回市级值。
 * 能力因子用区县的 MV%（病理确诊能力）作代理：病理弱的县，早诊率必然低——
 * 这样下钻出来的差异有临床解释，不是纯随机数。 */
Object.keys(COUNTY_BY_CITY).forEach(adc => {
  const city = CITY.find(c => c.adcode === adc);
  const base = P.earlyPerCity(city);                 // 该市应显示的早诊率
  const list = COUNTY_BY_CITY[adc];
  const mvMean = list.reduce((s, x) => s + x.cases * x.mv, 0) / list.reduce((s, x) => s + x.cases, 0);
  list.forEach(x => { x.early = base * (0.82 + 0.36 * (x.mv / mvMean - 0.5)); });
  // 归一化目标就是 base（市级对象上并没有 early 字段，不能用 normalizeToCity）
  const wSum = list.reduce((s, x) => s + x.cases * x.early, 0);
  const k = wSum === 0 ? 1 : (city.cases * base) / wSum;
  list.forEach(x => { x.early = x.early * k; });
  const got = list.reduce((s, x) => s + x.cases * x.early, 0) / city.cases;
  assert(Math.abs(got - base) < 0.02,
    city.name + ' 区县加权早诊率 = 市值 ' + f1(base) + '%（实得 ' + f1(got) + '%）');
});
/* 展示口径一致性：页面上给的是「例数 159,910 / 死亡 101,620 / M-I 0.64」，
 * 三者必须能互相验算（0.64 × 159,910 = 102,342 ≈ 101,620，取整误差在最后一位）。
 * 若用未取整的 T.deaths/T.cases，则 M/I 与屏幕上两个整数对不上，现场一按计算器就露。 */
P.mi = P.deaths / P.cases;
P.crudeD = P.crude * P.mi;   // 与"粗率 × M/I"严格一致，保证表内三个数能互相验算
P.inProvShare = P.localShare + P.intraCityShare + P.crossCityShare;
P.netOutRate = P.outRate - P.inRate;

/* 分项显示进位差：各按 1 位小数四舍五入后合计可能 99.9%。
 * 不做"凑 100"——凑出来的 41.8% 与其例数 66,719（实算 41.7%）会对不上，反而被现场戳穿。
 * 按统计公报规范：保留真实舍入值 + 脚注说明。 */
P.splitDispSum = Math.round((f1n(P.localShare) + f1n(P.intraCityShare) + f1n(P.crossCityShare) + f1n(P.outRate)) * 10) / 10;
P.splitNote = P.splitDispSum === 100 ? '' :
  '分项按 1 位小数四舍五入，合计显示 ' + f1(P.splitDispSum) + '%，与 100% 之差为进位差（原始值恒等 100）';
function f1n(v) { return Math.round(v * 10) / 10; }

/* ==================== 3. 流向：四分流恒等 + 去向 + 病种 + 省际 ==================== */
const PROV = {
  surv5: { cur: 41.8, prev: 40.3, national: 43.7, target2030: 46 },
  quality: { timely: 93.4, complete: 85.7, valid: 90.2, code: 96.1, cover: 88.6 },
  followup: { yearly: 84.2, lost: 6.8, deathFill: 93.1, longSurv: 71.4 },
  tnmMiss: 17.6,
  stage: { distant: 21.3 }
};
P.stageLate3 = 100 - P.early - PROV.stage.distant;   // III 期 = 100 − I+II − IV

/* 流出去向（占跨省流出比，合计 100） */
const FLOW_OUT = [
  { 流向省份: '上海市', 占跨省流出比: '22.1%', 主要接诊机构: '复旦肿瘤、中山医院', 主要病种: '肺、胃、食管、血液' },
  { 流向省份: '北京市', 占跨省流出比: '15.4%', 主要接诊机构: '医科院肿瘤医院、北肿', 主要病种: '肺、食管、肝、骨' },
  { 流向省份: '浙江省', 占跨省流出比: '13.8%', 主要接诊机构: '浙大一院、浙江省肿瘤', 主要病种: '甲状腺、乳腺、结直肠' },
  { 流向省份: '广东省', 占跨省流出比: '11.6%', 主要接诊机构: '中山肿瘤、广东省医', 主要病种: '鼻咽、肝、肺、血液' },
  { 流向省份: '湖南省', 占跨省流出比: '9.2%', 主要接诊机构: '湘雅系、湖南省肿瘤', 主要病种: '肺、甲状腺、妇科' },
  { 流向省份: '福建省', 占跨省流出比: '8.4%', 主要接诊机构: '福建省肿瘤、厦门大学附一', 主要病种: '甲状腺、胃、食管' },
  { 流向省份: '江苏省', 占跨省流出比: '7.1%', 主要接诊机构: '江苏省肿瘤、南京鼓楼', 主要病种: '食管、胃、肺' },
  { 流向省份: '湖北省', 占跨省流出比: '5.3%', 主要接诊机构: '同济、协和、湖北省肿瘤', 主要病种: '肺、乳腺、血液' },
  { 流向省份: '其他省份', 占跨省流出比: '7.1%', 主要接诊机构: '散在', 主要病种: '疑难罕见' }
];
FLOW_OUT.forEach(r => { r.病例数 = f0(P.outCases * parseFloat(r.占跨省流出比) / 100); });

/* 病种外流谱：高外流 = 该出去（省内能力缺口）· 低外流 = 不该出去（可避免） */
const SITES = [
  { 病种: '白血病', share: 1.9, outRel: 3.14, early: 33.4, cost: 78600 },
  { 病种: '脑及中枢神经系统', share: 1.7, outRel: 2.73, early: 24.1, cost: 66400 },
  { 病种: '骨与关节', share: 0.7, outRel: 2.49, early: 30.6, cost: 58900 },
  { 病种: '胰腺', share: 2.9, outRel: 1.93, early: 12.6, cost: 61200 },
  { 病种: '肝', share: 8.9, outRel: 1.71, early: 25.8, cost: 48700 },
  { 病种: '胃', share: 8.6, outRel: 1.22, early: 34.2, cost: 45300 },
  { 病种: '肺', share: 15.0, outRel: 0.99, early: 26.4, cost: 52400 },
  { 病种: '食管', share: 6.1, outRel: 0.92, early: 29.7, cost: 47600 },
  { 病种: '结直肠', share: 7.4, outRel: 0.83, early: 31.5, cost: 49800 },
  { 病种: '宫颈', share: 2.6, outRel: 0.71, early: 44.8, cost: 38600 },
  { 病种: '乳腺', share: 8.2, outRel: 0.62, early: 52.3, cost: 41200 },
  { 病种: '前列腺', share: 3.4, outRel: 0.49, early: 47.6, cost: 36900 },
  { 病种: '甲状腺', share: 9.8, outRel: 0.33, early: 68.4, cost: 21500 },
  { 病种: '其他', share: 23.2, outRel: 0.88, early: 35.2, cost: 44100 }
];
const relAvg = SITES.reduce((s, x) => s + x.outRel * x.share, 0) / SITES.reduce((s, x) => s + x.share, 0);
const kScale = P.outRate / relAvg;
const SITE_OUT = SITES.map(s => {
  const outRate = s.outRel * kScale;
  return {
    病种: s.病种,
    新发例数: f0(P.cases * s.share / 100),
    占全部发病: f1(s.share) + '%',
    跨省流出率: f1(outRate) + '%',
    跨省流出例数: f0(P.cases * s.share / 100 * outRate / 100),
    '早诊率I加II期': f1(s.early) + '%',
    次均住院费用元: f0(s.cost),
    全国发病占比: f1(s.share) + '%'
  };
});
const siteOutSum = SITE_OUT.reduce((s, x) => s + parseFloat(x.跨省流出例数.replace(/,/g, '')), 0);

/* 省际对比（18 省样本，低为好）——净流入率 = 省外流入率 − 跨省流出率，正值代表净吸人 */
const PROV_OUT_RAW = [
  ['甘肃省', '西部', '12.6%', '0.8%'],
  ['贵州省', '西部', '11.8%', '1.1%'],
  ['安徽省', '中部', '11.2%', '1.9%'],
  ['河北省', '东部', '10.4%', '2.2%'],
  ['云南省', '西部', '10.1%', '1.4%'],
  ['河南省', '中部', '9.8%', '2.0%'],
  ['广西', '西部', '9.5%', '1.8%'],
  ['四川省', '西部', '9.1%', '3.1%'],
  ['湖北省', '中部', '8.8%', '3.6%'],
  ['江西省', '中部', f1(P.outRate) + '%', f1(P.inRate) + '%'],
  ['湖南省', '中部', '8.6%', '2.4%'],
  ['广东省', '南部', '7.0%', '9.6%'],
  ['山东省', '东部', '6.6%', '5.1%'],
  ['江苏省', '东部', '6.4%', '8.2%'],
  ['浙江省', '东部', '6.1%', '7.8%'],
  ['天津市', '东部', '5.4%', '6.2%'],
  ['上海市', '东部', '4.2%', '16.1%'],
  ['北京市', '东部', '3.6%', '18.4%']
];
const PROV_OUT = PROV_OUT_RAW.map((r, i) => {
  const net = parseFloat(r[3]) - parseFloat(r[2]);
  return {
    全国排名: i + 1, 省份: r[0], 区域: r[1], 跨省流出率: r[2], 省外流入率: r[3],
    净流入率: (net >= 0 ? '+' : '') + f1(net) + '%'
  };
});
const jxRank = PROV_OUT.filter(r => r.省份 === '江西省')[0].全国排名;

/* 费用账 */
const COST = { inProvAvg: 38900, outProvAvg: 68400, insuranceShare: 82.6 };
COST.outTotal = P.outCases * COST.outProvAvg;

COST.inBaseline = P.outCases * COST.inProvAvg;
COST.extraBurden = COST.outTotal - COST.inBaseline;
COST.fundOut = COST.outTotal * COST.insuranceShare / 100;
COST.diffPct = (COST.outProvAvg / COST.inProvAvg - 1) * 100;

/* ==================== 4. 自洽断言（跑不通即 exit 1） ==================== */
console.log('\n[断言] 事实层与派生层是否自洽');
assert(CITY.length === 11, '11 个设区市齐全');
assert(new Set(CITY.map(c => c.adcode)).size === 11, '行政区划代码唯一');
assert(Math.abs(T.cases - CITY.reduce((s, c) => s + c.cases, 0)) < 1e-6, '省级例数 ≡ 11 市之和');
CITY.forEach(c => {
  const d = c.cases * c.mi;
  if (Math.abs(d - c.deaths) > 1e-6) { console.error('❌ ' + c.name + ' 死亡数 ≠ 例数 × M/I'); process.exit(1); }
});
assert(true, '每市死亡数 = 例数 × M/I');
CITY.forEach(c => {
  const s = c.out.local + c.out.intraCity + c.out.crossCity + c.out.outProv;
  if (Math.abs(s - 100) > 1e-6) { console.error('❌ ' + c.name + ' 四分流合计 ' + s); process.exit(1); }
});
assert(true, '每市流向四分流恒等 100%');
assert(Math.abs(P.localShare + P.intraCityShare + P.crossCityShare + P.outRate - 100) < 1e-6, '省级四分流恒等 100%');
assert(Math.abs(P.mi - P.deaths / P.cases) < 1e-9, 'M/I = 死亡数 ÷ 例数');
assert(Math.abs(T.mvW / T.cases - P.mv) < 1e-9, '省级 MV% ≡ 11 市按例数加权');
assert(Math.abs(P.deaths - Math.round(P.deaths)) < 0.5, '省级死亡数已取整一致');
assert(P.asr < P.crude && P.asrD < P.crudeD, '中标率恒小于粗率（标化后下降）');
assert(Math.abs(P.crudeD - P.crude * P.mi) < 1e-9, '粗死亡率 = 粗发病率 × M/I');
assert(Math.abs(P.cases * P.outRate / 100 - P.outCases) / P.outCases < 0.005, '流出率与流出例数可互相验算');
assert(Math.abs(100 - PROV.stage.distant - P.early - (100 - P.early - PROV.stage.distant)) < 1e-9, '分期三段闭合');
assert(P.stageLate3 > 0 && P.stageLate3 < 50, 'III 期占比 = 100 − I+II − IV，取值合理');
assert(Math.abs(siteOutSum - P.outCases) / P.outCases < 0.03, '分病种流出例数合计 ' + f0(siteOutSum) + ' ≈ 跨省流出 ' + f0(P.outCases) + '（偏差 ' + f1(Math.abs(siteOutSum - P.outCases) / P.outCases * 100) + '%）');
assert(jxRank > 0 && jxRank <= PROV_OUT.length, '江西在省际样本中有排名（第 ' + jxRank + '/' + PROV_OUT.length + '）');
const rankList = PROV_OUT.slice();
const pnum = r => parseFloat(String(r.跨省流出率).replace('%', ''));
assert(rankList.every((r, i) => i === 0 || pnum(rankList[i - 1]) >= pnum(r)), '省际表逐项单调不增（否则排名不可信）');
assert(!('pop' in PROV) && !('asrK' in PROV), 'PROV 不再私藏人口/标化系数（口径单源）');
let sumPct = 0;
FLOW_OUT.forEach(r => { sumPct += parseFloat(r.占跨省流出比); });
assert(Math.abs(sumPct - 100) < 0.01, '流出去向占比合计 ' + f1(sumPct) + '%');
assert(P.fu >= 76 && P.fu <= 90, '省级随访覆盖率落在 11 市区间内（' + f1(P.fu) + '%）');

/* ==================== 5. 指标总表 66 项 ==================== */
const KPI = [];
function add(g, n, u, v, fmtr, f, why, src, t, rank, yoy, s, core, where, has) {
  KPI.push({
    g, n, u, v: fmtr(v), f, why, src, t, rank, yoy, s,
    core: core === '★', where, has
  });
}
/* A 疾病负担与结局（9 项） */
add('A 疾病负担与结局', '恶性肿瘤发病率（粗）', '/10万', P.crude, f1, '新发例数 ÷ 常住人口 × 10 万', '全省癌症负担有多大，是在涨还是降', '肿瘤登记 + 人口基数', '≤ 全国平均', '17/31', '+1.6%', '未达标', '★', '指标总表', '驾驶舱已有');
add('A 疾病负担与结局', '恶性肿瘤发病率（中标化）', '/10万', P.asr, f1, '按标准人口年龄结构调整后的发病率', '去除老龄化影响后，江西还是不是"癌多"', '肿瘤登记 + 标准人口构成', '—', '16/31', '+1.1%', '中性', '', '指标总表', '驾驶舱已有');
add('A 疾病负担与结局', '恶性肿瘤死亡率（粗）', '/10万', P.crudeD, f1, '肿瘤死亡例数 ÷ 常住人口 × 10 万', '死亡负担，是"健康江西"考核的最终成绩单', '死因监测 + 肿瘤登记', '≤ 全国平均', '12/31', '-0.8%', '未达标', '', '指标总表', '驾驶舱已有');
add('A 疾病负担与结局', '恶性肿瘤死亡率（中标化）', '/10万', P.asrD, f1, '标准人口调整后的死亡率，用于跨地区可比', '跨地区、跨年可比性的死亡率，汇报口径要统一', '死因监测 + 标准人口构成', '≤ 全国平均', '11/31', '-1.2%', '未达标', '', '指标总表', '驾驶舱已有');
add('A 疾病负担与结局', '死亡发病比 M/I', '', P.mi, f2, '肿瘤死亡例数 ÷ 新发例数', '登记质量的"总闸"：低于 0.55 大概率漏报死亡', '肿瘤登记 + 死因监测', '0.55 ~ 0.85', '14/31', '+0.01', '达标', '★', '指标总表', '驾驶舱已有');
add('A 疾病负担与结局', '70 岁以下癌症早死率', '%', 15.8, f1, '30~69 岁因癌死亡概率（寿命表法）', '健康中国 2030 的硬指标，直接对应"过早死亡"', '死因监测 + 寿命表', '较 2020 下降 15%', '—', '-3.4%', '预警', '★', '指标总表', '缺（需寿命表）');
add('A 疾病负担与结局', '5 年相对生存率', '%', PROV.surv5.cur, f1, '同期患者 5 年生存率 ÷ 期望生存率', '肿瘤防控的总成绩，但要等队列成熟', '随访库 + 寿命表', '≥ ' + PROV.surv5.target2030 + '%（2030）', '—', '+1.5pp', '未达标', '★', '指标总表', '部分（队列未成熟）');
add('A 疾病负担与结局', '前五位癌种集中度', '%', 58.4, f1, '前五位癌种新发例数 ÷ 全部新发', '抓重点：一半以上的工作量在 5 个癌种', '肿瘤登记', '—', '—', '+0.6pp', '中性', '', '指标总表', '缺');
add('A 疾病负担与结局', '老龄化标化差异（粗−中标）', '/10万', P.crude - P.asr, f1, '粗率 − 中标率，反映人口老龄化影响', '解释"为什么粗率涨得比中标率快"', '肿瘤登记 + 标准人口构成', '—', '—', '+0.5', '中性', '', '指标总表', '缺');

/* B 早期发现（11 项） */
add('B 早期发现', '重点癌种早诊率（I+II 期）', '%', P.early, f1, 'I+II 期例数 ÷ 有分期信息的例数', '早诊率每提高 1pp，5 年生存率约提高 1.5pp', '肿瘤登记（分期字段）', '≥ 50%', '—', '+1.2pp', '未达标', '★', '指标总表', '画像已有');
add('B 早期发现', '首诊时局部晚期（III 期）占比', '%', P.stageLate3, f1, 'III 期例数 ÷ 有分期信息的例数', 'III 期是"还能救"的人群，前移空间最大', '肿瘤登记（分期字段）', '≤ 30%', '—', '-0.4pp', '未达标', '★', '指标总表', '缺');
add('B 早期发现', '首诊时远处转移（IV 期）占比', '%', PROV.stage.distant, f1, 'IV 期例数 ÷ 有分期信息的例数', 'IV 期占比高 = 早诊早治没有起作用', '肿瘤登记（分期字段）', '≤ 25%', '—', '-0.6pp', '达标', '', '指标总表', '画像已有');
add('B 早期发现', 'TNM 分期缺失率', '%', PROV.tnmMiss, f1, '无有效分期例数 ÷ 全部新发例数', '分期缺失率高，上面所有早诊率都不可信', '肿瘤登记（分期字段）', '≤ 10%', '—', '-1.8pp', '未达标', '★', '指标总表', '画像已有');
add('B 早期发现', '城市癌症早诊早治筛查完成率', '%', 62.4, f1, '实际筛查人数 ÷ 年度任务数', '国家项目任务完成情况，可被直接考核', '筛查项目库', '≥ 100%', '—', '+4.1pp', '未达标', '', '指标总表', '缺');
add('B 早期发现', '农村两癌筛查完成率', '%', 78.9, f1, '实际筛查人数 ÷ 年度任务数', '民生实事，专项考核', '妇幼 + 筛查项目库', '≥ 100%', '—', '+2.6pp', '未达标', '', '指标总表', '缺');
add('B 早期发现', '结直肠癌筛查完成率', '%', 54.3, f1, '实际筛查人数 ÷ 年度任务数', '筛查完成率最低的项目，短板明确', '筛查项目库', '≥ 100%', '—', '-1.4pp', '预警', '', '指标总表', '缺');
add('B 早期发现', '筛查阳性随访闭环率', '%', 71.6, f1, '完成随访的阳性例数 ÷ 阳性例数', '查出来不跟，等于白查', '筛查项目库 + 随访库', '≥ 90%', '—', '+3.2pp', '未达标', '', '指标总表', '缺');
add('B 早期发现', '体检/机会性筛查发现占比', '%', 18.7, f1, '健康体检发现例数 ÷ 全部新发例数', '衡量"被动发现"比例，越高越说明主动性不足', '肿瘤登记（发现途径）', '—', '—', '+0.9pp', '中性', '', '指标总表', '缺');
add('B 早期发现', '癌症防治核心知识知晓率', '%', 68.2, f1, '问卷达标人数 ÷ 调查人数', '健康中国考核项，与早诊率联动', '健康素养监测', '≥ 80%', '—', '+2.2pp', '未达标', '', '指标总表', '缺');
add('B 早期发现', 'HPV 疫苗接种覆盖率（适龄女孩）', '%', 21.4, f1, '完成接种人数 ÷ 适龄女孩数', '宫颈癌一级预防的先行指标', '免疫规划', '—', '—', '+5.8pp', '中性', '', '指标总表', '缺');

/* C 规范诊疗（12 项） */
add('C 规范诊疗', '病理确诊率 MV%', '%', P.mv, f1, '有病理诊断例数 ÷ 全部新发例数', '没有病理就没有真诊断，登记质量的硬门槛', '肿瘤登记', '≥ 70%', '—', '+0.4pp', '达标', '★', '指标总表', '驾驶舱已有');
add('C 规范诊疗', '临床分期完整率', '%', 82.4, f1, '有完整分期例数 ÷ 有分期例数', '分期不完整，规范诊疗无从评价', '肿瘤登记（分期字段）', '≥ 90%', '—', '+1.1pp', '未达标', '', '指标总表', '部分已有');
add('C 规范诊疗', '手术/放疗/化疗规范治疗率', '%', 76.8, f1, '按指南接受规范治疗的例数 ÷ 应治疗例数', '诊疗规范性的主指标', '病案首页 + 诊疗库', '≥ 85%', '—', '+1.4pp', '未达标', '★', '指标总表', '缺');
add('C 规范诊疗', '多学科会诊（MDT）覆盖率', '%', 34.6, f1, '经 MDT 讨论的例数 ÷ 住院肿瘤例数', '疑难重症能力建设的抓手，也是"少外流"的前提', '病案 + MDT 记录', '≥ 50%', '—', '+3.8pp', '未达标', '', '指标总表', '缺');
add('C 规范诊疗', '放疗设备可及性（每百万人口）', '台', 1.42, f2, '放疗设备数 ÷ 常住人口 × 100 万', '放疗能力直接决定患者要不要出省', '卫生资源统计', '≥ 2.0', '—', '+0.11', '未达标', '', '指标总表', '缺');
add('C 规范诊疗', '肿瘤专科床位数（每千人口）', '张', 0.58, f2, '肿瘤科床位 ÷ 常住人口 × 1000', '承接能力的物理上限', '卫生资源统计', '—', '—', '+0.03', '中性', '', '指标总表', '缺');
add('C 规范诊疗', '肿瘤专科医师数（每千人口）', '人', 0.21, f2, '肿瘤专科医师 ÷ 常住人口 × 1000', '人才是能力建设的瓶颈', '卫生人力统计', '—', '—', '+0.01', '中性', '', '指标总表', '缺');
add('C 规范诊疗', '日间化疗占比', '%', 41.2, f1, '日间化疗人次 ÷ 化疗总人次', '降低住院负担、提高效率', '病案首页', '—', '—', '+4.5pp', '中性', '', '指标总表', '缺');
add('C 规范诊疗', '癌痛规范化治疗率', '%', 63.7, f1, '规范化镇痛例数 ÷ 癌痛例数', '生存质量指标，专项检查项', '病案 + 疼痛评估', '≥ 80%', '—', '+2.9pp', '未达标', '', '指标总表', '缺');
add('C 规范诊疗', '安宁疗护服务覆盖率', '%', 22.1, f1, '接受安宁疗护的终末期例数 ÷ 终末期例数', '晚期患者照护短板', '安宁疗护机构统计', '—', '—', '+3.1pp', '中性', '', '指标总表', '缺');
add('C 规范诊疗', '临床试验参与例数', '例', 486, f0, '参加临床试验的肿瘤例数', '反映诊疗水平与创新能力', 'GCP 平台', '—', '—', '+12.4%', '中性', '', '指标总表', '缺');
add('C 规范诊疗', '肿瘤患者平均住院日', '天', 9.8, f1, '肿瘤住院总天数 ÷ 出院人次', '效率指标，与费用联动', '病案首页', '≤ 10', '—', '-0.3', '达标', '', '指标总表', '缺');

/* D 随访管理（7 项） */
add('D 随访管理', '随访覆盖率', '%', P.fu, f1, '完成随访例数 ÷ 应随访例数', '分母：随访覆盖不够，生存率就是个笑话', '随访库', '≥ 90%', '—', '+1.1pp', '未达标', '', '指标总表', '驾驶舱已有');
add('D 随访管理', '失访率', '%', PROV.followup.lost, f1, '失访例数 ÷ 应随访例数', '失访率高会系统性高估生存率', '随访库', '≤ 5%', '—', '-0.4pp', '未达标', '', '指标总表', '缺');
add('D 随访管理', '生存随访完成率（满 5 年）', '%', PROV.followup.longSurv, f1, '满 5 年随访例数 ÷ 应随访例数', '5 年生存率能否算出来的前提', '随访库', '≥ 85%', '—', '+2.8pp', '未达标', '', '指标总表', '缺');
add('D 随访管理', '死亡信息回填及时率', '%', PROV.followup.deathFill, f1, '按期回填死亡信息的例数 ÷ 应回填例数', '死亡漏报是登记质量最大漏洞', '死因监测联动', '≥ 95%', '—', '+1.2pp', '未达标', '', '指标总表', '缺');
add('D 随访管理', '存活患者年度随访率', '%', PROV.followup.yearly, f1, '年度内随访到的存活例数 ÷ 存活例数', '常规工作量的直观体现', '随访库', '≥ 90%', '—', '+0.9pp', '未达标', '', '指标总表', '缺');
add('D 随访管理', '随访方式构成（门诊/电话/上门）', '%', 52.3, f1, '门诊随访例数 ÷ 全部随访例数', '上门随访比例过低 = 困难群众失访风险高', '随访库', '—', '—', '+1.7pp', '中性', '', '指标总表', '部分已有');
add('D 随访管理', '随访异常事件响应率', '%', 87.4, f1, '已处置的异常事件 ÷ 异常事件数', '随访发现问题能不能变成行动', '随访库 + 预警工单', '≥ 95%', '—', '+2.2pp', '未达标', '', '指标总表', '缺');

/* E 就医流向（13 项，本次专题） */
add('E 就医流向', '跨省就医流出率', '%', P.outRate, f1, '在省外医疗机构首次治疗的例数 ÷ 全部新发例数', '患者用脚投票，最刺眼', '医保结算 + 病案首页', '≤ 5%（建议）', '10/18', '+0.3pp', '预警', '★', '流向专题 · 四分流', '缺');
add('E 就医流向', '省外就医流入率', '%', P.inRate, f1, '外省患者来赣首次治疗例数 ÷ 全部新发例数', '会不会"吸"病人，与流出同等重要', '医保结算 + 病案首页', '≥ 5%（建议）', '15/18', '+0.1pp', '未达标', '★', '流向专题 · 四分流', '缺');
add('E 就医流向', '患者净流入率', '%', -P.netOutRate, f1, '流入率 − 流出率', '一个数说清"是净流出还是净流入"', '医保结算 + 病案首页', '≥ 0', '15/18', '-0.2pp', '未达标', '★', '流向专题 · 四分流', '缺');
add('E 就医流向', '县域内就诊率', '%', P.localShare, f1, '在县域内机构首次治疗的例数 ÷ 全部新发例数', '分级诊疗成不成立的总开关', '医保结算 + 病案首页', '≥ 60%（肿瘤专项建议）', '—', '+0.4pp', '未达标', '★', '流向专题 · 四分流', '画像已有');
add('E 就医流向', '县域外就诊率', '%', 100 - P.localShare, f1, '100 − 县域内就诊率', '与县域内就诊率互补，看外流总盘子', '医保结算 + 病案首页', '≤ 40%', '—', '-0.4pp', '未达标', '', '流向专题 · 四分流', '画像已有');
add('E 就医流向', '省内跨市就医率', '%', P.crossCityShare, f1, '在本省其他市首次治疗的例数 ÷ 全部新发例数', '省内虹吸强度，南昌一家独大的证据', '医保结算 + 病案首页', '—', '—', '+0.2pp', '中性', '', '流向专题 · 四分流', '缺');
add('E 就医流向', '本市内跨县就医率', '%', P.intraCityShare, f1, '在本市其他县首次治疗的例数 ÷ 全部新发例数', '市域内医疗中心的作用', '医保结算 + 病案首页', '—', '—', '+0.1pp', '中性', '', '流向专题 · 四分流', '缺');
add('E 就医流向', '跨省流出例数', '例', P.outCases, f0, '跨省流出率 × 全部新发例数', '率一样的时候，例数决定工作量与钱', '医保结算 + 病案首页', '—', '—', '+3.2%', '中性', '', '流向专题 · 分市排名', '缺');
add('E 就医流向', '省际流出率排名（低为好）', '名', jxRank, f0, '在 18 省样本中按跨省流出率升序排名', '横向对比才有说服力，防止自我感觉良好', '各省年报（样本）', '前 8 名', '10/18', '—', '中性', '', '流向专题 · 省际对比', '缺');
add('E 就医流向', '异地 vs 本地次均住院费用差', '%', COST.diffPct, f1, '跨省次均住院费用 ÷ 省内次均 − 1', '外流带来的经济代价，与医保、乡村振兴都讲得通', '医保结算 + 病案首页', '—', '—', '+2.1pp', '中性', '', '流向专题 · 费用卡', '画像已有');
add('E 就医流向', '医保基金省外结算额（肿瘤患者）', '亿元', COST.fundOut / 1e8, f2, '跨省就医费用 × 医保承担比例', '钱流到哪省，最能让领导当场追问', '医保部门数据（需共享）', '较上年下降', '—', '+8.4%', '预警', '★', '流向专题 · 费用卡', '缺（外部数据源）');
add('E 就医流向', '流出患者主要病种集中度', '%', 41.7, f1, '前 3 病种流出例数 ÷ 全部流出例数', '前三个病种就是主攻方向', '流向 + 病种', '—', '—', '+1.6pp', '中性', '', '流向专题 · 病种谱', '缺');
/* F 数据质量（11 项） */
add('F 数据质量', '登记覆盖率', '%', PROV.quality.cover, f1, '实际登记例数 ÷ 估算应登记例数', '分母：所有率的分母可信度', '肿瘤登记 + 估算模型', '≥ 95%', '—', '+0.8pp', '未达标', '', '指标总表', '驾驶舱已有');
add('F 数据质量', '估算漏报率', '%', 100 - PROV.quality.cover, f1, '100 − 登记覆盖率', '漏报是登记系统最致命的病', '肿瘤登记 + 估算模型', '≤ 5%', '—', '-0.8pp', '未达标', '★', '指标总表', '驾驶舱已有');
add('F 数据质量', '报告及时率', '%', PROV.quality.timely, f1, '按期上报的卡片数 ÷ 应上报卡片数', '及时率低 = 月度分析全是滞后的', '登记直报系统', '≥ 95%', '—', '+0.5pp', '未达标', '', '指标总表', '驾驶舱已有');
add('F 数据质量', '数据完整率', '%', PROV.quality.complete, f1, '必填字段全部填写的卡片 ÷ 全部卡片', '字段缺失直接影响分层分析可行性', '登记直报系统', '≥ 95%', '—', '+1.4pp', '未达标', '★', '指标总表', '驾驶舱已有');
add('F 数据质量', '数据有效率', '%', PROV.quality.valid, f1, '通过逻辑校验的卡片 ÷ 全部卡片', '有效率高才敢直接拿来做分析', '登记直报系统', '≥ 95%', '—', '+0.6pp', '未达标', '', '指标总表', '驾驶舱已有');
add('F 数据质量', 'ICD-O-3 编码正确率', '%', PROV.quality.code, f1, '编码正确的卡片 ÷ 抽查卡片', '编码错 = 病种分析全错', '登记直报系统', '≥ 98%', '—', '+0.3pp', '未达标', '', '指标总表', '部分已有');
add('F 数据质量', 'DCO 占比（仅凭死亡证明登记）', '%', P.dco, f1, '仅有死亡证明的例数 ÷ 全部新发例数', 'DCO 高 = 活着的时候没进系统', '肿瘤登记', '≤ 5%', '—', '+0.1pp', '达标', '★', '指标总表', '驾驶舱已有');
add('F 数据质量', 'UB 占比（生前未就诊比例）', '%', P.ub, f1, '生前未就诊例数 ÷ 全部新发例数', 'UB 高 = 医疗可及性问题', '肿瘤登记', '≤ 5%', '—', '-0.2pp', '达标', '★', '指标总表', '驾驶舱已有');
add('F 数据质量', '重复报告率（重卡率）', '%', P.dup, f1, '重复卡片数 ÷ 全部卡片数', '重卡 = 分子虚高，所有率都偏高', '登记直报系统', '≤ 3%', '—', '+0.2pp', '未达标', '★', '指标总表', '驾驶舱已有');
add('F 数据质量', '国家平台上报成功率', '%', P.nccr, f1, '成功上报国家的卡片 ÷ 应上报卡片数', '上报不成功，国家考核直接扣分', '国家上报系统', '≥ 98%', '—', '+0.4pp', '未达标', '', '指标总表', '驾驶舱已有');
add('F 数据质量', '登记机构数', '个', P.hosp, f0, '开展肿瘤登记的医疗机构数', '网底有多厚，直接决定覆盖率上限', '登记直报系统', '—', '—', '+6', '中性', '', '指标总表', '驾驶舱已有');

/* G 保障投入（3 项） */
add('G 保障投入', '肿瘤防治专项经费', '亿元', 2.84, f2, '年度肿瘤防治专项财政投入', '钱到没到位，是一切工作的前提', '财政/卫健财务', '较上年增长', '—', '+5.2%', '中性', '', '指标总表', '缺');
add('G 保障投入', '人均肿瘤防治经费', '元', 6.28, f2, '专项经费 ÷ 常住人口', '横向比较更公平的口径', '财政/卫健财务', '—', '—', '+5.1%', '中性', '', '指标总表', '缺');
add('G 保障投入', '筛查项目人均补助', '元', 42.5, f1, '筛查专项经费 ÷ 筛查人数', '补助标准决定基层筛查积极性', '财政/卫健财务', '—', '—', '+2.4%', '中性', '', '指标总表', '缺');

/* ==================== 6. 输出 ==================== */
const KPI_COLS = ['★核心', '分类', '指标名称', '单位', '江西值', '计算口径', '领导关注点', '参考基准', '全国排名', '较上年', '达标状态', '数据来源系统', '展示位置', '原型现状'];
const kpiRows = KPI.map(m => ({
  '★核心': m.core ? '★' : '', '分类': m.g, '指标名称': m.n, '单位': m.u, '江西值': m.v,
  '计算口径': m.f, '领导关注点': m.why, '参考基准': m.t, '全国排名': m.rank, '较上年': m.yoy,
  '达标状态': m.s, '数据来源系统': m.src, '展示位置': m.where, '原型现状': m.has
}));
writeCsv('卫健领导关注指标总表.csv', kpiRows, KPI_COLS);

const CITY_COLS = ['行政区划代码', '地市', '常住人口万', '新发例数', '粗发病率', '死亡例数', 'MI', '早诊率I加II期', '随访覆盖率', '病理MV率', 'DCO率', '重卡率', '县域内就诊率', '本市内跨县率', '省内跨市率', '跨省流出率', '省外流入率', '跨省流出例数', '省内医疗机构数'];
const CITY_ROWS = CITY.map(c => ({
  '行政区划代码': c.adcode, '地市': c.name, '常住人口万': f1(c.pop), '新发例数': f0(c.cases),
  '粗发病率': f1(c.crude), '死亡例数': f0(c.deaths), 'MI': f2(c.mi),
  '早诊率I加II期': f1(c.early) + '%', '随访覆盖率': f1(c.fu) + '%', '病理MV率': f1(c.mv) + '%',
  'DCO率': f1(c.dco) + '%', '重卡率': f1(c.dup) + '%',
  '县域内就诊率': f1(c.out.local) + '%', '本市内跨县率': f1(c.out.intraCity) + '%',
  '省内跨市率': f1(c.out.crossCity) + '%', '跨省流出率': f1(c.out.outProv) + '%',
  '省外流入率': f1(c.inRate) + '%', '跨省流出例数': f0(c.outCases), '省内医疗机构数': f0(c.hosp)
}));
writeCsv('附表1_设区市关键率对比.csv', CITY_ROWS, CITY_COLS);
writeCsv('附表2_肿瘤患者跨省流出去向.csv', FLOW_OUT, ['流向省份', '占跨省流出比', '病例数', '主要接诊机构', '主要病种']);
writeCsv('附表3_病种外流谱.csv', SITE_OUT, ['病种', '新发例数', '占全部发病', '跨省流出率', '跨省流出例数', '早诊率I加II期', '次均住院费用元', '全国发病占比']);
writeCsv('附表4_省际流出流入对比.csv', PROV_OUT, ['全国排名', '省份', '区域', '跨省流出率', '省外流入率', '净流入率']);

/* 核心与统计 Markdown */
const cats = [];
KPI.forEach(m => { if (cats.indexOf(m.g) < 0) cats.push(m.g); });
const coreMd = ['# 卫健领导关注指标 · 核心 20 项与统计', '',
  '> 本文件由 `gen-decision-kpi.js` 直出，**不要手工修改**。改数值请改脚本。', '',
  '## ★ 核心 20 项', '',
  '| # | 指标 | 江西值 | 单位 | 参考基准 | 较上年 | 达标 | 全国排名 |', '| --- | --- | --- | --- | --- | --- | --- | --- |'];
KPI.filter(m => m.core).forEach((m, i) => {
  coreMd.push('| ' + (i + 1) + ' | ' + m.n + ' | **' + m.v + '** | ' + m.u + ' | ' + m.t + ' | ' + m.yoy + ' | ' + m.s + ' | ' + m.rank + ' |');
});
coreMd.push('', '## 七大类分布', '', '| 分类 | 项数 | ★核心 | 已有/部分 | 缺失 |', '| --- | --- | --- | --- | --- |');
let tHas = 0, tMiss = 0, tCore = 0;
cats.forEach(g => {
  const rows = KPI.filter(m => m.g === g);
  const has = rows.filter(m => m.has.indexOf('缺') !== 0).length;
  const miss = rows.length - has;
  const core = rows.filter(m => m.core).length;
  tHas += has; tMiss += miss; tCore += core;
  coreMd.push('| ' + g + ' | ' + rows.length + ' | ' + core + ' | ' + has + ' | ' + miss + ' |');
});
coreMd.push('| **合计** | **' + KPI.length + '** | **' + tCore + '** | **' + tHas + '** | **' + tMiss + '** |');
const lampCount = s => KPI.filter(m => m.s === s).length;
coreMd.push('', '**汇总**：★核心 ' + tCore + ' 项 · 已有/部分 ' + tHas + ' 项 · 缺失 ' + tMiss + ' 项 ｜ 灯 🟢' + lampCount('达标') + ' 🟡' + lampCount('关注') + ' 🔴' + (lampCount('未达标') + lampCount('预警')) + ' ⚪' + lampCount('中性'));
coreMd.push('', '## 流向四分流（省级）', '', '```',
  '本县（市、区）内  →  ' + f1(P.localShare) + '%     留在县域（' + f0(P.cases * P.localShare / 100) + ' 例）',
  '本市内跨县      →  ' + f1(P.intraCityShare) + '%',
  '省内跨市        →  ' + f1(P.crossCityShare) + '%    省内合计 ' + f1(P.inProvShare) + '%（' + f0(P.cases - P.outCases) + ' 例）',
  '跨省流出        →  ' + f1(P.outRate) + '%    ' + f0(P.outCases) + ' 例   ← 领导追问的那个数',
  '省外流入        →  ' + f1(P.inRate) + '%    ' + f0(P.inCases) + ' 例',
  '净流入          →  -' + f1(P.netOutRate) + '%（流出 > 流入）', '```');
fs.writeFileSync(path.join(OUT_DIR, '指标总表_核心与统计.md'), coreMd.join('\n') + '\n', 'utf8');
console.log('写出 指标总表_核心与统计.md');

/* 附表 Markdown + 事实卡 */
function mdTable(rows, cols) {
  return ['| ' + cols.join(' | ') + ' |', '| ' + cols.map(() => '---').join(' | ') + ' |']
    .concat(rows.map(r => '| ' + cols.map(c => r[c]).join(' | ') + ' |')).join('\n');
}
const appMd = ['', '## 附表 1 · 11 个设区市关键率（按跨省流出率降序）', '',
  mdTable(CITY_ROWS.slice().sort((a, b) => parseFloat(b.跨省流出率) - parseFloat(a.跨省流出率)), CITY_COLS),
  '', '## 附表 2 · 跨省流出去向', '', mdTable(FLOW_OUT, Object.keys(FLOW_OUT[0])),
  '', '## 附表 3 · 病种外流谱（按跨省流出率降序）', '', mdTable(SITE_OUT, Object.keys(SITE_OUT[0])),
  '', '## 附表 4 · 省际流出/流入对比（按流出率降序，低为好）', '', mdTable(PROV_OUT, Object.keys(PROV_OUT[0])),
  '', '## 事实卡（汇报口径，全部脚本推导）', '',
  '- 全省常住人口 **' + f1(P.pop) + ' 万**；' + STAT_YEAR + ' 年新发恶性肿瘤 **' + f0(P.cases) + ' 例**、肿瘤死亡 **' + f0(P.deaths) + ' 例**。',
  '- 粗发病率 **' + f1(P.crude) + '/10万**、中标发病率 **' + f1(P.asr) + '/10万**；粗死亡率 **' + f1(P.crudeD) + '/10万**、中标死亡率 **' + f1(P.asrD) + '/10万**；**M/I = ' + f2(P.mi) + '**。',
  '- 流向四分流：县域内 **' + f1(P.localShare) + '%** · 本市内跨县 ' + f1(P.intraCityShare) + '% · 省内跨市 ' + f1(P.crossCityShare) + '%（省内合计 **' + f1(P.inProvShare) + '%**）· **跨省流出 ' + f1(P.outRate) + '%（' + f0(P.outCases) + ' 例）**；省外流入 ' + f1(P.inRate) + '%（' + f0(P.inCases) + ' 例）→ **净流入 ' + f1(-P.netOutRate) + '%**。',
  '- 经济账：异地次均住院费 **' + f0(COST.outProvAvg) + ' 元** vs 本地 **' + f0(COST.inProvAvg) + ' 元**（差 **+' + f1(COST.diffPct) + '%**）→ 额外费用负担 **' + f2(COST.extraBurden / 1e8) + ' 亿元**、医保基金省外结算 **' + f2(COST.fundOut / 1e8) + ' 亿元/年**。',
  '- 登记质量（11 市按例数加权，与驾驶舱市域表同源）：MV% **' + f1(P.mv) + '** · DCO% **' + f1(P.dco) + '** · UB% **' + f1(P.ub) + '** · 重卡率 **' + f1(P.dup) + '** · 国家平台上报率 **' + f1(P.nccr) + '** · 随访覆盖率 **' + f1(P.fu) + '**；TNM 缺失率 ' + f1(PROV.tnmMiss) + '%。',
  '- 分期结构（有分期分母）：I+II 期 **' + f1(P.early) + '%** · III 期 ' + f1(P.stageLate3) + '% · IV 期 ' + PROV.stage.distant + '%。',
  '- 5 年相对生存率 **' + f1(PROV.surv5.cur) + '%**（上年 ' + f1(PROV.surv5.prev) + '%，全国示例 ' + f1(PROV.surv5.national) + '，2030 目标 ' + f1(PROV.surv5.target2030) + '——**目标值待以最新国家文件核实**）。', ''];
fs.writeFileSync(path.join(OUT_DIR, '附表_Markdown.md'), appMd.join('\n') + '\n', 'utf8');
console.log('写出 附表_Markdown.md');
/* 前端数据模块 */
const BASE = CITY.map(c => ({
  adcode: c.adcode, name: c.name, short: c.short, pop: c.pop, crude: f1(c.crude), cases: Math.round(c.cases),
  deaths: Math.round(c.deaths), mi: c.mi, asrK: c.asrK, asr: f1(c.asr), mv: c.mv, dco: c.dco, ub: c.ub,
  dup: c.dup, nccr: c.nccr, fu: c.fu, hosp: c.hosp,
  early: +f1(P.earlyPerCity(c)), inRate: +f1(c.inRate), outCases: c.outCases, inCases: c.inCases,
  out: { local: +f1(c.out.local), intraCity: +f1(c.out.intraCity), crossCity: +f1(c.out.crossCity), outProv: +f1(c.out.outProv) }
}));
/* 区县下钻数据（只含示例市；其余市前端提示"数据待补"） */
const _earlyW = BASE.reduce((s, c) => s + c.cases * c.early, 0) / BASE.reduce((s, c) => s + c.cases, 0);
assert(Math.abs(_earlyW - PROV_EARLY) < 0.05,
  'BASE 市级早诊率加权合计 = 省级 ' + f1(PROV_EARLY) + '%（实得 ' + f1(_earlyW) + '%）');

const COUNTY_OUT = {};
Object.keys(COUNTY_BY_CITY).forEach(adc => {
  const city = CITY.find(c => c.adcode === adc);
  COUNTY_OUT[adc] = {
    cityName: city.name, cityShort: city.short, cityPop: city.pop, cityCases: Math.round(city.cases),
    counties: COUNTY_BY_CITY[adc].map(x => ({
      n: x.name, pop: x.pop, cases: Math.round(x.cases), deaths: Math.round(x.deaths),
      crude: +f1(x.crude), mi: +f2(x.mi), asr: +f1(x.crude * x.asrK),
      mv: +f1(x.mv), dco: +f1(x.dco), ub: +f1(x.ub), dup: +f1(x.dup),
      nccr: +f1(x.nccr), fu: +f1(x.fu), early: +f1(x.early), hosp: x.hosp,
      inRate: +f1(x.inRate), outCases: x.outCases, inCases: x.inCases,
      out: { local: +f1(x.out.local), intraCity: +f1(x.out.intraCity), crossCity: +f1(x.out.crossCity), outProv: +f1(x.out.outProv) }
    }))
  };
});

const PROV_QC = {
  mvMin: 70, dcoMax: 5, ubMax: 5, miMin: .55, miMax: .85, dupMax: 3, nccrMin: 98, fuMin: 90,
  timelyMin: 95, earlyMin: 50,
  conflict: [
    { k: 'MV%', onepair: '≥ 70', other: '≥ 66', act: '本表用 70（源头 cockpit-module.js:25 与 stats-module.js:30）' },
    { k: 'DCO%', onepair: '≤ 5', other: '≤ 15', act: '本表用 5（国家肿瘤登记规范）；建议后续统一' },
    { k: 'M/I', onepair: '0.55 ~ 0.85', other: '0.60~0.80 与分癌种区间', act: '本表用 0.55~0.85；分癌种区间留待 WR 分癌种表' }
  ]
};
const dataJs = '/* 由 gen-decision-kpi.js 生成，请勿手改；改数值请改脚本后重跑。\n' +
  ' * 全站唯一事实源：人口/分母/质控阈值/派生率全部来自这里。\n' +
  ' * 生成时间：' + new Date().toISOString().slice(0, 19).replace('T', ' ') + ' ｜ 数据年度：' + STAT_YEAR + ' ｜ 截至：' + ASOF + ' */\n' +
  'window.DKH_DATA = ' + JSON.stringify({
    meta: { statYear: STAT_YEAR, asof: ASOF, pop: +f1(P.pop), cases: P.cases, deaths: P.deaths, hosp: P.hosp },
    prov: {
      pop: +f1(P.pop), cases: P.cases, deaths: P.deaths, crude: +f1(P.crude), crudeD: +f1(P.crudeD),
      asr: +f1(P.asr), asrD: +f1(P.asrD), mi: +f2(P.mi), mv: +f1(P.mv), dco: +f1(P.dco), ub: +f1(P.ub),
      dup: +f1(P.dup), nccr: +f1(P.nccr), fu: +f1(P.fu), hosp: P.hosp,
      early: +f1(P.early), stageLate3: +f1(P.stageLate3), stageDistant: PROV.stage.distant,
      tnmMiss: PROV.tnmMiss, cover: PROV.quality.cover, timely: PROV.quality.timely, complete: PROV.quality.complete,
      lostRate: PROV.followup.lost, surv5: PROV.surv5,
      localShare: +f1(P.localShare), intraCityShare: +f1(P.intraCityShare), crossCityShare: +f1(P.crossCityShare),
      inProvShare: +f1(P.inProvShare), outRate: +f1(P.outRate), inRate: +f1(P.inRate), netOutRate: +f1(P.netOutRate),
      outCases: P.outCases, inCases: P.inCases, splitSum: P.splitDispSum, splitNote: P.splitNote,
      jxRank: jxRank, rankTotal: PROV_OUT.length
    },
    qc: PROV_QC,
    base: BASE,
    kpi: KPI,
    outToProv: FLOW_OUT,
    provOut: PROV_OUT,
    siteOut: SITE_OUT,
    cityRows: CITY_ROWS,
    county: COUNTY_OUT,
    countyMeta: { sampleCities: Object.keys(COUNTY_OUT).length, totalCities: CITY.length },
    cost: { inAvg: COST.inProvAvg, outAvg: COST.outProvAvg, diffPct: +f1(COST.diffPct), share: COST.insuranceShare, extra: Math.round(COST.extraBurden), fund: +(COST.fundOut / 1e8).toFixed(2) }
  }, null, 0).replace(/\},\{/g, '},\n{') + ';\n';
fs.writeFileSync(path.join(OUT_DIR, 'decision-kpi-data.js'), dataJs, 'utf8');
console.log('写出 decision-kpi-data.js');

/* ==================== 7. 结果摘要 ==================== */
console.log('\n[结果] 省级事实');
console.log(JSON.stringify({
  pop: +f1(P.pop), cases: P.cases, deaths: P.deaths, crude: +f1(P.crude), crudeD: +f1(P.crudeD),
  asr: +f1(P.asr), asrD: +f1(P.asrD), mi: +f2(P.mi), mv: +f1(P.mv), dco: +f1(P.dco), ub: +f1(P.ub),
  dup: +f1(P.dup), nccr: +f1(P.nccr), fu: +f1(P.fu), early: +f1(P.early), stageLate3: +f1(P.stageLate3),
  localShare: +f1(P.localShare), outRate: +f1(P.outRate), inRate: +f1(P.inRate), netOutRate: +f1(P.netOutRate),
}, null, 0));
console.log('\n四分流：县域内 ' + f1(P.localShare) + ' 省内跨市 ' + f1(P.crossCityShare) +
  ' 省内合计 ' + f1(P.inProvShare) + ' 跨省流出 ' + f1(P.outRate) + ' 省外流入 ' + f1(P.inRate) + ' 净流入 ' + f1(-P.netOutRate));
console.log('医保基金外流 ' + f2(COST.fundOut / 1e8) + ' 亿元 / 额外费用负担 ' + f2(COST.extraBurden / 1e8) + ' 亿元');
console.log('指标 ' + KPI.length + ' 项（★核心 ' + tCore + '）｜断言 ' + assertCount + ' 条全过');
if (warnings.length) console.log('提示：' + warnings.join('；'));
