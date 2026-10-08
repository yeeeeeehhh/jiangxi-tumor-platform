/* ============================================================================
 * qc-data.js — 质控管理 · 数据脊柱（唯一数据源）
 *
 * 设计铁律：
 *   1. 本文件是质控管理五层模块的唯一数据来源。所有页面（看板 / 被质控数据 /
 *      规则与问题）的数字都必须取自 window.qcSpine，禁止在页面层另建 mock，
 *      否则「总览 82.6%」与下钻明细必然对不上。
 *   2. 数据生成全部由确定性种子（seed）驱动，同一入参永远得到同一结果，
 *      刷新页面数字不变，下钻可复现。
 *   3. 脊柱只回答三件事：指标算得对不对（分子/分母）、哪些病例被质控、
 *      依据哪条规则判成异常。整改闭环部分的台账另见 qc-loop.js。
 *
 * 暴露：window.qcSpine
 * ========================================================================== */
(function () {
  'use strict';

  /* ==================== 0. 基础工具（确定性） ==================== */

  /* 字符串 → 32 位整数种子，保证同一 key 每次得到同一结果 */
  function hash(s) {
    var h = 2166136261, i;
    s = String(s == null ? '' : s);
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function seedOf(s) { return hash(s); }
  /* 0~1 之间的确定性伪随机数 */
  function rnd01(s) { return (hash(s) % 100000) / 100000; }
  /* 由 seed 在 [a,b] 取整 */
  function rndInt(s, a, b) { return a + (hash(s) % (b - a + 1)); }
  function pick(list, s) { return list[hash(s) % list.length]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmt(n) { return Number(n || 0).toLocaleString('zh-CN'); }
  /* 保留 1 位小数 */
  function f1(v) { return (Math.round(Number(v || 0) * 10) / 10).toFixed(1); }
  /* 百分数字符串 */
  function pc(v) { return f1(v) + '%'; }
  /* 比率 → 百分数（0~100） */
  function rate(num, den) { return den > 0 ? num / den * 100 : 0; }

  /* ==================== 1. 区域 / 机构 / 癌种 主数据 ==================== */

  /* 江西省 11 个设区市 + 每市抽样区县（与全站区域口径一致） */
  var CITIES = [
    { code: '360100', name: '南昌市', counties: ['东湖区', '西湖区', '青云谱区', '青山湖区', '新建区'] },
    { code: '360200', name: '景德镇市', counties: ['珠山区', '昌江区', '浮梁县'] },
    { code: '360300', name: '萍乡市', counties: ['安源区', '湘东区', '芦溪县'] },
    { code: '360400', name: '九江市', counties: ['浔阳区', '濂溪区', '修水县', '都昌县'] },
    { code: '360500', name: '新余市', counties: ['渝水区', '分宜县'] },
    { code: '360600', name: '鹰潭市', counties: ['月湖区', '贵溪市'] },
    { code: '360700', name: '赣州市', counties: ['章贡区', '南康区', '于都县', '信丰县', '瑞金市'] },
    { code: '360800', name: '吉安市', counties: ['吉州区', '青原区', '吉安县', '泰和县'] },
    { code: '360900', name: '宜春市', counties: ['袁州区', '丰城市', '樟树市', '高安市'] },
    { code: '361000', name: '抚州市', counties: ['临川区', '东乡区', '南城县'] },
    { code: '361100', name: '上饶市', counties: ['信州区', '广丰区', '鄱阳县', '玉山县'] }
  ];

  /* 医疗机构（三级医院为主，国考六项考核单元） */
  var ORGS = [
    { id: 'ORG-01', name: '江西省肿瘤医院', city: '360100', level: '省级三甲', type: '专科' },
    { id: 'ORG-02', name: '南昌大学第一附属医院', city: '360100', level: '省级三甲', type: '综合' },
    { id: 'ORG-03', name: '南昌大学第二附属医院', city: '360100', level: '省级三甲', type: '综合' },
    { id: 'ORG-04', name: '江西省人民医院', city: '360100', level: '省级三甲', type: '综合' },
    { id: 'ORG-05', name: '赣州市人民医院', city: '360700', level: '市级三甲', type: '综合' },
    { id: 'ORG-06', name: '赣南医科大学第一附属医院', city: '360700', level: '市级三甲', type: '综合' },
    { id: 'ORG-07', name: '九江市第一人民医院', city: '360400', level: '市级三甲', type: '综合' },
    { id: 'ORG-08', name: '宜春市人民医院', city: '360900', level: '市级三甲', type: '综合' },
    { id: 'ORG-09', name: '上饶市人民医院', city: '361100', level: '市级三甲', type: '综合' },
    { id: 'ORG-10', name: '吉安市中心人民医院', city: '360800', level: '市级三甲', type: '综合' },
    { id: 'ORG-11', name: '抚州市第一人民医院', city: '361000', level: '市级三甲', type: '综合' },
    { id: 'ORG-12', name: '萍乡市人民医院', city: '360300', level: '市级三甲', type: '综合' },
    { id: 'ORG-13', name: '景德镇市第一人民医院', city: '360200', level: '市级三甲', type: '综合' },
    { id: 'ORG-14', name: '新余市人民医院', city: '360500', level: '市级三甲', type: '综合' },
    { id: 'ORG-15', name: '鹰潭市人民医院', city: '360600', level: '市级三甲', type: '综合' },
    { id: 'ORG-16', name: '南昌市第三医院', city: '360100', level: '市级三甲', type: '综合' },
    { id: 'ORG-17', name: '赣州市肿瘤医院', city: '360700', level: '市级二甲', type: '专科' },
    { id: 'ORG-18', name: '九江市第三人民医院', city: '360400', level: '市级二甲', type: '综合' }
  ];

  /* 10 个癌种（国考六项覆盖范围） */
  var CANCERS = [
    { id: 'C50', name: '乳腺癌', short: '乳腺', icd: 'C50' },
    { id: 'C34', name: '肺癌', short: '肺', icd: 'C34' },
    { id: 'C22', name: '肝癌', short: '肝', icd: 'C22' },
    { id: 'C53', name: '宫颈癌', short: '宫颈', icd: 'C53' },
    { id: 'C16', name: '胃癌', short: '胃', icd: 'C16' },
    { id: 'C18', name: '结直肠癌', short: '结直肠', icd: 'C18–C20' },
    { id: 'C15', name: '食管癌', short: '食管', icd: 'C15' },
    { id: 'C73', name: '甲状腺癌', short: '甲状腺', icd: 'C73' },
    { id: 'C61', name: '前列腺癌', short: '前列腺', icd: 'C61' },
    { id: 'C64', name: '肾癌', short: '肾', icd: 'C64' }
  ];

  /* ==================== 2. ① 诊疗过程与单病种质控 · 国考六项 ==================== */

  /* 指标定义：分子分母口径严格按《国家三级公立医院绩效考核操作手册》
     肿瘤专业医疗质量控制指标口径描述，页面上可展开给质控人员看。 */
  var L1_IND = [
    {
      id: 'NQ-01', name: '首次治疗前临床分期评估率', short: '临床分期评估率', dir: 'up', base: 86.4,
      def: '首次接受抗肿瘤治疗前完成临床分期评估的病例占同期首次治疗病例的比例。',
      num: '首次治疗前完成临床 TNM 分期评估的病例数',
      den: '同期首次接受抗肿瘤治疗的病例数',
      cancers: ['C50', 'C34', 'C22', 'C53', 'C16', 'C18', 'C15', 'C73', 'C61', 'C64'],
      src: '云健康 · 电子病历 / 病案首页',
      ruleVer: 'V2026.1'
    },
    {
      id: 'NQ-02', name: '首次非手术治疗前病理学诊断率', short: '病理学诊断率', dir: 'up', base: 91.2,
      def: '首次接受非手术抗肿瘤治疗前取得病理学诊断的病例占比。',
      num: '首次非手术治疗前有病理学诊断的病例数',
      den: '同期首次接受非手术抗肿瘤治疗的病例数',
      cancers: ['C50', 'C34', 'C22', 'C53', 'C16', 'C18', 'C15', 'C61', 'C64'],
      src: '云健康 · 病理系统',
      ruleVer: 'V2026.1'
    },
    {
      id: 'NQ-03', name: '术后病理 TNM 分期率', short: '术后病理分期率', dir: 'up', base: 88.7,
      def: '手术治疗的恶性肿瘤病例中，术后病理报告含 pTNM 分期的比例。',
      num: '术后病理报告含 pTNM 分期的病例数',
      den: '同期接受手术治疗的恶性肿瘤病例数',
      cancers: ['C50', 'C34', 'C22', 'C16', 'C18', 'C73', 'C61', 'C64'],
      src: '云健康 · 病理系统 / 病案首页',
      ruleVer: 'V2026.1'
    },
    {
      id: 'NQ-04', name: '围手术期死亡率', short: '围手术期死亡率', dir: 'down', base: 0.42,
      def: '肿瘤手术患者中，术后 30 日内死亡的病例占比（越低越好）。',
      num: '术后 30 日内死亡病例数',
      den: '同期肿瘤手术病例数',
      cancers: ['C34', 'C22', 'C18', 'C61', 'C64'],
      src: '云健康 · 病案首页 / 死因监测',
      ruleVer: 'V2026.1'
    },
    {
      id: 'NQ-05', name: '首次靶向/免疫治疗前分子病理检测率', short: '分子病理检测率', dir: 'up', base: 79.5,
      def: '首次接受靶向或免疫治疗前完成相应分子病理检测的病例占比。',
      num: '首次靶向/免疫治疗前完成分子检测的病例数',
      den: '同期首次接受靶向/免疫治疗的病例数',
      cancers: ['C34', 'C50', 'C18', 'C16'],
      src: '云健康 · 分子病理实验室',
      ruleVer: 'V2026.1'
    },
    {
      id: 'NQ-06', name: '术中淋巴结清扫规范率', short: '淋巴结清扫规范率', dir: 'up', base: 84.1,
      def: '恶性肿瘤根治性手术中，淋巴结清扫数目达到规范要求的病例占比。',
      num: '淋巴结清扫数目达标的病例数',
      den: '同期行根治性手术的恶性肿瘤病例数',
      cancers: ['C50', 'C34', 'C22', 'C18', 'C15'],
      src: '云健康 · 手术记录 / 病理报告',
      ruleVer: 'V2026.1'
    }
  ];

  var IND_MAP = {};
  L1_IND.forEach(function (i) { IND_MAP[i.id] = i; });
  function ind(id) { return IND_MAP[id] || null; }
  function cancer(id) {
    for (var i = 0; i < CANCERS.length; i++) if (CANCERS[i].id === id) return CANCERS[i];
    return { id: id, name: id, short: id, icd: id };
  }
  function org(idOrName) {
    for (var i = 0; i < ORGS.length; i++) {
      if (ORGS[i].id === idOrName || ORGS[i].name === idOrName) return ORGS[i];
    }
    return null;
  }
  function cityName(code) {
    for (var i = 0; i < CITIES.length; i++) if (CITIES[i].code === code) return CITIES[i].name;
    return code;
  }

  /* 指标 × 机构 × 癌种 → 分母（病例数）。分层下钻的原子单元。 */
  function denOf(indId, orgId, cancerId) {
    var i = ind(indId);
    if (!i) return 0;
    if (i.cancers.indexOf(cancerId) < 0) return 0;
    var o = org(orgId);
    /* 机构层级决定体量：省级 > 市级三甲 > 市级二甲 */
    var scale = o ? (o.level === '省级三甲' ? 3.4 : o.level === '市级三甲' ? 1.8 : 0.8) : 1;
    var base = { C50: 420, C34: 560, C22: 240, C53: 180, C16: 340, C18: 400, C15: 190, C73: 260, C61: 200, C64: 150 }[cancerId] || 200;
    /* 指标本身适用范围不同，分母再打一次折 */
    var indScale = { 'NQ-01': 1, 'NQ-02': 0.62, 'NQ-03': 0.48, 'NQ-04': 0.5, 'NQ-05': 0.34, 'NQ-06': 0.4 }[indId] || 1;
    var jitter = 0.82 + rnd01('den|' + indId + '|' + orgId + '|' + cancerId) * 0.36;
    return Math.max(0, Math.round(base * scale * indScale * jitter));
  }

  /* 机构在该指标上的真实水平：以全国基准 base 为中心，按机构能力上下浮动。
     专科医院与省级医院水平更高；这是"指标结果"的唯一来源。 */
  function orgLevelOf(indId, orgId) {
    var i = ind(indId), o = org(orgId);
    if (!i || !o) return i ? i.base : 0;
    var bonus = o.level === '省级三甲' ? 3.2 : o.level === '市级三甲' ? 0.6 : -3.4;
    if (o.type === '专科') bonus += 2.4;
    var jit = (rnd01('lvl|' + indId + '|' + orgId) - 0.5) * 7.5;
    var v = i.base + bonus + jit;
    if (i.dir === 'down') {
      /* 死亡率类指标：基数小，用乘法浮动 */
      v = i.base * (1 + bonus / 100 * 6 + jit / 60);
      return Math.max(0.05, Math.round(v * 100) / 100);
    }
    return clamp(Math.round(v * 10) / 10, 42, 99.4);
  }

  /* 原子单元格：某指标 / 某机构 / 某癌种 的分子分母与结果 */
  function cell(indId, orgId, cancerId) {
    var i = ind(indId);
    var den = denOf(indId, orgId, cancerId);
    if (!i || den <= 0) return { ind: indId, org: orgId, cancer: cancerId, den: 0, num: 0, value: 0, ok: false };
    var isDown = i.dir === 'down';
    var level = orgLevelOf(indId, orgId);
    /* 癌种差异：不同癌种在该指标上天然有高低 */
    var cAdj = (rnd01('cadj|' + indId + '|' + cancerId) - 0.5) * (isDown ? 0.3 : 6.5);
    var target = isDown ? level * (1 + cAdj / 100) : level + cAdj;
    target = clamp(target, isDown ? 0.05 : 45, isDown ? 9 : 99.6);
    var num = Math.round(den * target / 100);
    num = clamp(num, 0, den);
    var value = isDown ? rate(num, den) : rate(num, den);
    return {
      ind: indId, org: orgId, cancer: cancerId,
      den: den, num: num,
      value: Math.round(value * 100) / 100,
      ok: true
    };
  }

  /* 指标在给定筛选条件下的汇总（分子分母各自相加后再算率，不能对率求平均） */
  function agg(indId, orgIds, cancerIds) {
    var i = ind(indId);
    if (!i) return { ind: indId, den: 0, num: 0, value: 0, orgs: 0 };
    orgIds = orgIds && orgIds.length ? orgIds : ORGS.map(function (o) { return o.id; });
    cancerIds = cancerIds && cancerIds.length ? cancerIds : i.cancers;
    var den = 0, num = 0, orgsHit = 0;
    orgIds.forEach(function (o) {
      var od = 0, on = 0;
      cancerIds.forEach(function (c) {
        var cl = cell(indId, o, c);
        od += cl.den; on += cl.num;
      });
      if (od > 0) { orgsHit++; den += od; num += on; }
    });
    return {
      ind: indId, den: den, num: num,
      value: Math.round(rate(num, den) * 100) / 100,
      orgs: orgsHit,
      isDown: i.dir === 'down'
    };
  }

  /* 全省某指标的合计（总览 KPI 用） */
  function total(indId) { return agg(indId, null, null); }

  /* 同比：以上一年同样算法得到上期值，误差由种子决定，保证可复现 */
  function yoy(indId, orgIds, cancerIds) {
    var i = ind(indId);
    if (!i) return 0;
    var cur = agg(indId, orgIds, cancerIds).value;
    var delta = (rnd01('yoy|' + indId) - 0.42) * (i.dir === 'down' ? 0.28 : 4.6);
    var prev = i.dir === 'down' ? cur - delta : cur - delta;
    return Math.round((cur - prev) * 100) / 100;
  }

  /* 癌种维度汇总表 */
  function byCancer(indId, orgIds) {
    var i = ind(indId);
    if (!i) return [];
    return i.cancers.map(function (c) {
      var subsets = (orgIds && orgIds.length ? orgIds : ORGS.map(function (o) { return o.id; }))
        .map(function (o) { return cell(indId, o, c); })
        .filter(function (x) { return x.den > 0; });
      var den = 0, num = 0;
      subsets.forEach(function (x) { den += x.den; num += x.num; });
      var abn = abnCount(indId, c, orgIds);
      return {
        cancer: c, name: cancer(c).name, short: cancer(c).short,
        den: den, num: num, value: Math.round(rate(num, den) * 100) / 100,
        abn: abn
      };
    }).filter(function (r) { return r.den > 0; });
  }

  /* 机构维度汇总表 */
  function byOrg(indId, cancerIds) {
    var i = ind(indId);
    if (!i) return [];
    var all = agg(indId, null, cancerIds).value;
    return ORGS.map(function (o) {
      var a = agg(indId, [o.id], cancerIds);
      if (a.den <= 0) return null;
      return {
        org: o.id, orgName: o.name, city: o.city, level: o.level, type: o.type,
        den: a.den, num: a.num, value: a.value,
        regionAvg: all,
        gap: Math.round((a.value - all) * 100) / 100,
        abn: abnCount(indId, null, [o.id])
      };
    }).filter(Boolean).sort(function (a, b) {
      return i.dir === 'down' ? a.value - b.value : b.value - a.value;
    });
  }

  /* ==================== 3. 被质控数据：病例级（核心下钻层） ==================== */

  var SURNAMES = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '陈', '林', '黄', '徐', '邓', '罗', '彭', '曾', '肖', '钟', '谢', '何'];
  var GIVEN = ['建国', '秀英', '志强', '桂英', '海燕', '文博', '玉梅', '云飞', '雅琴', '俊杰', '淑珍', '明辉', '小燕', '国平', '丽华', '振华', '春梅', '德胜', '秋兰', '永强'];
  var DEPTS = ['肿瘤外科', '肿瘤内科', '放疗科', '胸外科', '胃肠外科', '乳腺外科', '妇科', '泌尿外科', '肝胆外科'];

  /* 判定四态：符合 / 不符合 / 数据缺失 / 数据异常 */
  var V = { OK: 'ok', BAD: 'bad', MISS: 'miss', ABN: 'abn' };
  var V_LABEL = { ok: '符合', bad: '不符合', miss: '数据缺失', abn: '数据异常' };
  var V_TONE = { ok: 'success', bad: 'danger', miss: 'caution', abn: 'orange' };

  function patientName(seed) {
    return pick(SURNAMES, seed + '|s') + pick(GIVEN, seed + '|g');
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateStr(seed, y0, y1) {
    var y = rndInt(seed + '|y', y0, y1);
    var m = rndInt(seed + '|m', 1, 12);
    var d = rndInt(seed + '|d', 1, 28);
    return y + '-' + pad(m) + '-' + pad(d);
  }
  function addDays(s, n) {
    var p = String(s).split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function dayDiff(a, b) {
    return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
  }

  /* 单指标在给定机构上的异常率。这是全站唯一的异常率口径：
     abnCount（KPI 上的异常病例数）与 cases（下钻列表里的异常条数）
     都必须由它推导，否则总览数字和下钻明细会对不上。 */
  function abnRateOf(indId, orgId) {
    var i = ind(indId);
    if (!i) return 0;
    /* 异常率直接取自指标本身的不达标比例：指标值 v% 意味着约 (100−v)% 的
       病例未达标。这样"指标准确率 88.56%"与"异常病例 12,497 例"天然一致，
       指标值一改，异常数跟着改，不会出现两套口径。 */
    var v = orgLevelOf(indId, orgId);
    var r = i.dir === 'down' ? v / Math.max(i.base * 4, 0.01) : (100 - v) / 100;
    return clamp(r, 0.02, 0.55);
  }

  /* 单指标判定：把病例的诊疗事实与规则比对，返回判定四态 + 异常原因。
     这里是"规则判定可解释"的落地点 —— 每个异常都能说出检查什么、
     依据什么规则、实际数据是什么、为什么异常。 */
  function judge(indId, orgId, cancerId, seq) {
    var i = ind(indId);
    if (!i) return { v: V.OK, reason: '', rule: null };
    var r = rnd01('judge|' + indId + '|' + orgId + '|' + cancerId + '|' + seq);
    var abnRate = abnRateOf(indId, orgId);
    if (r >= abnRate) return { v: V.OK, reason: '', rule: null };
    var sub = rnd01('sub|' + indId + '|' + orgId + '|' + cancerId + '|' + seq);
    /* 异常细分：不符合 / 缺失 / 异常 —— 三类各自占比固定 */
    var kind = sub < 0.52 ? V.BAD : sub < 0.79 ? V.MISS : V.ABN;
    return { v: kind, reason: reasonOf(indId, kind), rule: ruleOf(indId, kind), sub: sub };
  }

  function reasonOf(indId, kind) {
    var M = {
      'NQ-01': { bad: '分期评估时间晚于首次治疗时间', miss: '未记录临床分期或分期评估日期', abn: '分期评估日期早于初次诊断日期' },
      'NQ-02': { bad: '非手术治疗开始前未取得病理学诊断', miss: '病理诊断字段缺失', abn: '病理报告日期晚于治疗开始日期' },
      'NQ-03': { bad: '术后病理报告未包含 pTNM 分期', miss: 'pTNM 分期字段为空', abn: 'pTNM 分期与病程记录描述不一致' },
      'NQ-04': { bad: '术后 30 日内死亡，属围手术期死亡', miss: '出院去向字段缺失，无法判定生存状态', abn: '死亡日期早于手术日期，数据逻辑冲突' },
      'NQ-05': { bad: '靶向/免疫治疗前未完成分子病理检测', miss: '分子检测结果字段缺失', abn: '检测报告日期晚于首次用药日期' },
      'NQ-06': { bad: '淋巴结清扫数目低于规范要求', miss: '淋巴结清扫数目未填写', abn: '清扫数目与病理报告检出数不一致' }
    };
    return (M[indId] || {})[kind] || '质控判定异常';
  }

  /* 规则台账：每条规则说明检查什么、依据什么、期望什么 */
  function ruleOf(indId, kind) {
    var R = {
      'NQ-01': { code: 'QC-L1-001', name: '首次治疗前完成临床分期评估', ver: 'V2026.1', cond: '分期评估日期 ≤ 首次治疗日期 且 临床分期非空', field: '临床分期 / 分期评估日期 / 首次治疗日期' },
      'NQ-02': { code: 'QC-L1-002', name: '非手术治疗前须有病理学诊断', ver: 'V2026.1', cond: '病理诊断非空 且 病理报告日期 ≤ 首次非手术治疗日期', field: '病理诊断 / 病理报告日期 / 首次治疗日期' },
      'NQ-03': { code: 'QC-L1-003', name: '术后病理须含 pTNM 分期', ver: 'V2026.1', cond: 'pT、pN、pM 三项均非空', field: 'pTNM 分期 / 病理报告' },
      'NQ-04': { code: 'QC-L1-004', name: '围手术期死亡判定', ver: 'V2026.1', cond: '死亡日期 − 手术日期 ≤ 30 日', field: '手术日期 / 死亡日期 / 出院去向' },
      'NQ-05': { code: 'QC-L1-005', name: '靶向免疫治疗前完成分子检测', ver: 'V2026.1', cond: '分子检测结果非空 且 报告日期 ≤ 首次用药日期', field: '分子病理结果 / 检测日期 / 首次用药日期' },
      'NQ-06': { code: 'QC-L1-006', name: '淋巴结清扫数目达标', ver: 'V2026.1', cond: '清扫淋巴结数目 ≥ 癌种规范要求下限', field: '清扫淋巴结数目 / 病理检出数' }
    };
    var r = R[indId];
    if (!r) return null;
    return { code: r.code, name: r.name, ver: r.ver, cond: r.cond, field: r.field, kind: kind, hit: kind !== V.OK };
  }

  /* 生成某指标下被质控病例列表。
     注意：列表同时包含"符合"病例和异常病例 —— 这正是"被质控数据"的含义：
     说明这个指标到底检查了哪些数据。 */
  function cases(indId, opt) {
    opt = opt || {};
    var orgIds = opt.orgIds && opt.orgIds.length ? opt.orgIds : null;
    var cancerIds = opt.cancerIds && opt.cancerIds.length ? opt.cancerIds : (ind(indId) ? ind(indId).cancers : []);
    var want = opt.verdict || 'ALL';
    var limit = opt.limit || 300;
    var out = [];
    var pool = ORGS.filter(function (o) { return !orgIds || orgIds.indexOf(o.id) >= 0; });
    var PER_CELL = 60;   /* 每个「指标×机构×癌种」单元抽样上限 */
    cancerIds.forEach(function (c) {
      pool.forEach(function (o) {
        var cl = cell(indId, o.id, c);
        if (cl.den <= 0) return;
        /* 抽样规模要足够大，才能让抽出的异常比例贴近该机构的真实异常率；
           否则总览 KPI 的"异常病例数"与下钻列表条数会互相矛盾。 */
        var take = Math.min(cl.den, PER_CELL);
        for (var s = 0; s < take; s++) {
          var key = indId + '|' + o.id + '|' + c + '|' + s;
          var j = judge(indId, o.id, c, s);
          if (want !== 'ALL' && j.v !== want) continue;
          out.push(buildCase(indId, o, c, s, j, key));
        }
      });
    });
    out.sort(function (a, b) {
      /* 异常优先，其次按诊断日期倒序 */
      var av = a.v === V.OK ? 1 : 0, bv = b.v === V.OK ? 1 : 0;
      if (av !== bv) return av - bv;
      return a.diagDate < b.diagDate ? 1 : -1;
    });
    return { rows: out.slice(0, limit), total: out.length };
  }
  /* 各判定态在抽样中的条数 —— 供页面显示"全部/符合/不符合/数据缺失/数据异常"的页签计数，
     计数与列表同源，保证切页签不会出现空列表。 */
  function verdictCounts(indId, opt) {
    opt = opt || {};
    var all = cases(indId, {
      orgIds: opt.orgIds, cancerIds: opt.cancerIds, verdict: 'ALL', limit: 1000000
    }).rows;
    var m = { ALL: all.length, ok: 0, bad: 0, miss: 0, abn: 0 };
    all.forEach(function (r) { m[r.v] = (m[r.v] || 0) + 1; });
    return m;
  }

  /* 构造一条被质控病例的完整证据链（诊疗时间轴 + 关键字段 + 规则判定 + 原始追溯） */
  function buildCase(indId, o, c, s, j, key) {
    var name = patientName(key);
    var sex = ['C50', 'C53', 'C73'].indexOf(c) >= 0
      ? (rnd01(key + '|sx') < 0.03 ? '男' : '女')
      : (rnd01(key + '|sx') < 0.06 ? '女' : '男');
    var age = rndInt(key + '|age', 34, 82);
    /* 诊疗日期全部落在报告期内。做法是"往前留出余量"而不是"到头截断"：
       诊断日期限定在 2024-02-01 ~ 2026-05-20 之间，这样
         · 最长的后续链条（首疗 +34 天 → 手术 +6 天 → 随访 +96 天 ≈ +136 天）
           也不会越过 2026-09-30；
         · "分期评估早于诊断"的数据异常场景（最多 −20 天）也不会早于 2024-01-01。
       若改用截断（min(d, 期末)），所有溢出日期会塌缩成同一天，时间轴就失真了。 */
    var diagDate = dateStr(key + '|dg', 2024, 2026);
    if (diagDate < '2024-02-01') {
      diagDate = '2024-02-' + pad(rndInt(key + '|dgl', 1, 28));
    } else if (diagDate > '2026-05-20') {
      diagDate = '2026-0' + rndInt(key + '|dgm', 1, 5) + '-' + pad(rndInt(key + '|dgd', 1, 20));
    }
    var i = ind(indId);
    var isDown = i.dir === 'down';
    var value = cell(indId, o.id, c).value;

    /* 时间轴：诊断 → 病理 → 分期 → 首次治疗 → 手术/药物 → 后续治疗 */
    var pathDate = addDays(diagDate, rndInt(key + '|pd', 3, 12));
    var stageDate = addDays(diagDate, rndInt(key + '|sd', 2, 16));
    var treatDate = addDays(diagDate, rndInt(key + '|td', 8, 34));
    var surgDate = ['NQ-03', 'NQ-04', 'NQ-06'].indexOf(indId) >= 0 ? addDays(treatDate, rndInt(key + '|sg', 1, 6)) : null;
    var nextDate = addDays(treatDate, rndInt(key + '|nd', 28, 96));

    /* 判定为异常时，让事实数据真实地违反规则（而不是只贴一个标签）。
       分期评估日期早于诊断日期属"数据异常"场景，但不能早到报告期之外。 */
    var stageVal, stageReal = stageDate, treatReal = treatDate;
    if (indId === 'NQ-01') {
      if (j.v === V.MISS) { stageVal = ''; stageReal = ''; }
      else if (j.v === V.BAD) { stageVal = pick(['IIA', 'IIB', 'IIIA'], key); stageReal = addDays(treatDate, rndInt(key + '|late', 3, 20)); }
      else if (j.v === V.ABN) {
        stageVal = 'IB';
        stageReal = addDays(diagDate, -rndInt(key + '|early', 2, 20));
        if (stageReal < '2024-01-01') stageReal = addDays(diagDate, -rndInt(key + '|early2', 1, 3));
      }
      else stageVal = pick(['IA', 'IIA', 'IIB', 'IIIA', 'IIIB', 'IV'], key);
    }
    var pathVal = ['NQ-02', 'NQ-03'].indexOf(indId) >= 0
      ? (j.v === V.MISS ? '' : pick(['腺癌', '鳞状细胞癌', '导管癌', '肝细胞癌', '乳头状癌'], key))
      : pick(['腺癌', '鳞状细胞癌', '导管癌'], key);
    var ptnmVal = indId === 'NQ-03'
      ? (j.v === V.MISS ? '' : j.v === V.BAD ? '' : pick(['pT2N1M0', 'pT3N0M0', 'pT1N0M0', 'pT4N2M0'], key))
      : pick(['pT2N1M0', 'pT3N0M0'], key);
    var lymphVal = indId === 'NQ-06'
      ? (j.v === V.MISS ? '' : j.v === V.BAD ? String(rndInt(key + '|ln', 2, 8)) : String(rndInt(key + '|ln', 12, 32)))
      : String(rndInt(key + '|ln', 10, 30));
    var molVal = indId === 'NQ-05'
      ? (j.v === V.MISS ? '' : j.v === V.BAD ? '' : pick(['EGFR 19del 阳性', 'ALK 融合阳性', 'HER2 扩增', 'MSI-H', 'PD-L1 TPS 45%'], key))
      : pick(['EGFR 19del 阳性', 'ALK 融合阳性', 'HER2 扩增'], key);
    var deathDate = indId === 'NQ-04' ? addDays(surgDate, rndInt(key + '|dd', 2, j.v === V.BAD ? 29 : 120)) : '';

    var cObj = cancer(c);
    return {
      id: 'JX' + rndInt(key + '|no', 100000, 999999),
      ind: indId, org: o.id, orgName: o.name, city: o.city, cityName: cityName(o.city),
      cancer: c, cancerName: cObj.name,
      name: name, sex: sex, age: age, dept: pick(DEPTS, key + '|dp'),
      doctor: patientName(key + '|dr') + '医生',
      ipNo: 'ZY' + rndInt(key + '|ip', 200000, 299999),
      mrn: 'MRN' + rndInt(key + '|mr', 1000000, 9999999),
      diagDate: diagDate,
      stageDate: stageReal, stageVal: stageVal,
      treatDate: treatDate, pathDate: pathDate,
      surgDate: surgDate, nextDate: nextDate,
      ptnm: ptnmVal, lymph: lymphVal, mol: molVal, pathology: pathVal,
      deathDate: deathDate,
      v: j.v, verdictText: V_LABEL[j.v], reason: j.reason,
      rule: j.rule,
      key: key,
      /* 指标在该机构该癌种的水平，用于详情页展示"本机构 vs 区域平均" */
      orgValue: value, regionValue: Math.round(agg(indId, null, [c]).value * 100) / 100
    };
  }

  /* 各指标全省被质控病例总数（不含异常筛选） */
  function caseCount(indId) {
    var n = 0;
    var i = ind(indId);
    if (!i) return 0;
    i.cancers.forEach(function (c) {
      ORGS.forEach(function (o) {
        var d = denOf(indId, o.id, c);
        n += Math.min(d, 12);
      });
    });
    return n;
  }

  /* 异常病例数：按判定异常的真实抽样比例外推到全量分母 */
  function abnCount(indId, cancerId, orgIds) {
    var i = ind(indId);
    if (!i) return 0;
    var cs = cancerId ? [cancerId] : i.cancers;
    var os = orgIds && orgIds.length ? orgIds : ORGS.map(function (o) { return o.id; });
    var total = 0;
    os.forEach(function (o) {
      var ar = abnRateOf(indId, o);
      cs.forEach(function (c) {
        var cl = cell(indId, o, c);
        if (cl.den <= 0) return;
        total += Math.round(cl.den * ar);
      });
    });
    return total;
  }

  /* 异常问题的类型分布（用于"异常分布"卡） */
  function abnTypes(indId) {
    var base = abnCount(indId);
    var w = [
      { t: '记录缺失', r: 0.34 },
      { t: '时间逻辑冲突', r: 0.28 },
      { t: '字段不一致', r: 0.2 },
      { t: '阈值不达标', r: 0.12 },
      { t: '编码异常', r: 0.06 }
    ];
    return w.map(function (x) {
      return { type: x.t, count: Math.round(base * x.r) };
    });
  }

  /* ==================== 4. 趋势 ==================== */

  /* 指标趋势：按月 / 季度 / 年度。围绕当前值波动，确定性。 */
  function trend(indId, period, orgIds, cancerIds) {
    var i = ind(indId);
    if (!i) return [];
    var cur = agg(indId, orgIds, cancerIds).value;
    var out = [];
    if (period === '月') {
      for (var m = 1; m <= 12; m++) {
        var d = (rnd01('tr|' + indId + '|' + m) - 0.5) * (i.dir === 'down' ? 0.2 : 3.4);
        out.push({ l: m + '月', v: Math.round((cur + d) * 100) / 100 });
      }
    } else if (period === '季度') {
      for (var q = 1; q <= 4; q++) {
        var dq = (rnd01('trq|' + indId + '|' + q) - 0.5) * (i.dir === 'down' ? 0.24 : 3.8);
        out.push({ l: 'Q' + q, v: Math.round((cur + dq) * 100) / 100 });
      }
    } else {
      var years = ['2022', '2023', '2024', '2025', '2026'];
      years.forEach(function (y, idx) {
        var step = (idx - 4) * (i.dir === 'down' ? -0.05 : 1.5);
        var dy = (rnd01('try|' + indId + '|' + y) - 0.5) * 1.6;
        out.push({ l: y, v: Math.round(clamp(cur + step + dy, i.dir === 'down' ? 0.05 : 40, 100) * 100) / 100 });
      });
    }
    return out;
  }

  /* ==================== 5. ② 病案与编码质控 ==================== */

  /* 编码质量核心指标 */
  var L2_IND = [
    { id: 'E-01', name: '病案首页主要诊断编码正确率', base: 93.6, num: '主要诊断编码与临床诊断一致的病案数', den: '同期出院病案总数' },
    { id: 'E-02', name: 'ICD-10 编码正确率', base: 91.8, num: 'ICD-10 编码正确的病案数', den: '同期开展 ICD-10 编码的病案数' },
    { id: 'E-03', name: 'ICD-O-3 编码正确率', base: 87.2, num: 'ICD-O-3 形态学编码正确的病案数', den: '同期恶性肿瘤病案数' },
    { id: 'E-04', name: '病理字段完整率', base: 89.5, num: '病理诊断相关字段完整的病案数', den: '同期有病理结果的病案数' },
    { id: 'E-05', name: '分期字段完整率', base: 85.3, num: 'TNM 分期字段完整的病案数', den: '同期应填报分期的恶性肿瘤病案数' }
  ];

  /* 编码问题类型（对应方案里的六类） */
  var L2_ISSUES = [
    { id: 'L2-01', type: '主要诊断缺失', field: '主要诊断编码', rule: 'QC-L2-001', cond: '主要诊断编码非空', desc: '病案首页主要诊断编码为空，无法归入 DRG 分组' },
    { id: 'L2-02', type: 'ICD-10 编码异常', field: 'ICD-10 编码', rule: 'QC-L2-002', cond: '编码属于恶性肿瘤章节且与诊断名称匹配', desc: 'ICD-10 编码与临床诊断名称不匹配' },
    { id: 'L2-03', type: 'ICD-O-3 编码异常', field: 'ICD-O-3 形态学编码', rule: 'QC-L2-003', cond: '形态学编码与病理诊断术语一致（行为学 /3）', desc: 'ICD-O-3 形态学编码与病理报告术语不一致' },
    { id: 'L2-04', type: '病理字段缺失', field: '病理诊断 / 形态学编码', rule: 'QC-L2-004', cond: '病理诊断与形态学编码均非空', desc: '已确认恶性肿瘤但病理字段未填报' },
    { id: 'L2-05', type: '分期字段缺失', field: 'TNM 分期', rule: 'QC-L2-005', cond: 'T、N、M 三项均非空', desc: 'TNM 分期字段存在缺项' },
    { id: 'L2-06', type: '诊断与编码不一致', field: '主要诊断 vs 病理诊断', rule: 'QC-L2-006', cond: '病案首页诊断与病理诊断的原发部位一致', desc: '病案首页主要诊断与病理诊断的原发部位不一致' }
  ];

  function l2Ind(id) {
    for (var i = 0; i < L2_IND.length; i++) if (L2_IND[i].id === id) return L2_IND[i];
    return null;
  }
  /* 机构编码质量水平 */
  function l2OrgValue(indId, orgId) {
    var def = l2Ind(indId), o = org(orgId);
    if (!def || !o) return def ? def.base : 0;
    var bonus = o.level === '省级三甲' ? 3.6 : o.level === '市级三甲' ? 0.8 : -4.2;
    var jit = (rnd01('l2|' + indId + '|' + orgId) - 0.5) * 8;
    return clamp(Math.round((def.base + bonus + jit) * 10) / 10, 55, 99.5);
  }
  function l2Agg(indId, orgIds) {
    var def = l2Ind(indId);
    if (!def) return { value: 0, den: 0, num: 0 };
    var os = orgIds && orgIds.length ? orgIds : ORGS.map(function (o) { return o.id; });
    var den = 0, num = 0;
    os.forEach(function (o) {
      var d = Math.round(1200 * (org(o).level === '省级三甲' ? 3.2 : org(o).level === '市级三甲' ? 1.7 : 0.7) * (0.85 + rnd01('l2d|' + indId + '|' + o) * 0.3));
      var v = l2OrgValue(indId, o);
      den += d; num += Math.round(d * v / 100);
    });
    return { value: Math.round(rate(num, den) * 100) / 100, den: den, num: num };
  }
  function l2ByOrg(indId) {
    var all = l2Agg(indId).value;
    return ORGS.map(function (o) {
      var d = Math.round(1200 * (o.level === '省级三甲' ? 3.2 : o.level === '市级三甲' ? 1.7 : 0.7) * (0.85 + rnd01('l2d|' + indId + '|' + o.id) * 0.3));
      var v = l2OrgValue(indId, o.id);
      var bad = Math.round(d * (100 - v) / 100);
      return {
        org: o.id, orgName: o.name, city: o.city, level: o.level,
        den: d, value: v, gap: Math.round((v - all) * 100) / 100,
        issueCount: bad + rndInt('l2i|' + indId + '|' + o.id, 0, 12)
      };
    }).sort(function (a, b) { return a.value - b.value; });
  }

  /* 编码问题清单：每条问题都能追到病例和字段 */
  function l2Issues(opt) {
    opt = opt || {};
    var out = [];
    L2_ISSUES.forEach(function (t) {
      ORGS.forEach(function (o) {
        var n = rndInt('l2n|' + t.id + '|' + o.id, 0, 9);
        for (var k = 0; k < n; k++) {
          var key = t.id + '|' + o.id + '|' + k;
          if (opt.orgIds && opt.orgIds.length && opt.orgIds.indexOf(o.id) < 0) continue;
          if (opt.types && opt.types.length && opt.types.indexOf(t.id) < 0) continue;
          var c = pick(CANCERS, key + '|c');
          var st = pick(['待处理', '整改中', '待复核', '已关闭'], key + '|st');
          if (opt.status && opt.status !== '全部' && st !== opt.status) continue;
          out.push({
            id: 'ENC' + rndInt(key + '|no', 100000, 999999),
            typeId: t.id, type: t.type, field: t.field,
            rule: t.rule, cond: t.cond, desc: t.desc,
            org: o.id, orgName: o.name, city: o.city, cityName: cityName(o.city),
            cancer: c.id, cancerName: c.name,
            name: patientName(key), sex: rnd01(key + '|sx') < 0.5 ? '男' : '女',
            age: rndInt(key + '|age', 35, 80),
            current: currentOf(t.id, key),
            expect: expectOf(t.id),
            standard: standardOf(t.id, key),
            verdict: pick(['不符合', '数据缺失', '数据异常'], key + '|v'),
            status: st,
            foundDate: dateStr(key + '|fd', 2026, 2026),
            key: key
          });
        }
      });
    });
    out.sort(function (a, b) { return a.foundDate < b.foundDate ? 1 : -1; });
    return out;
  }
  function currentOf(typeId, key) {
    var M = {
      'L2-01': '', 'L2-02': pick(['C34.9', 'C50.9', 'C16.9', 'D38.1'], key),
      'L2-03': pick(['8010/2', '8140/6', '8070/3', '8500/2'], key),
      'L2-04': '', 'L2-05': pick(['T2NxM0', 'TxN0M0', 'T3N0Mx'], key),
      'L2-06': pick(['C34 vs C50', 'C16 vs C18', 'C22 vs C16'], key)
    };
    return M[typeId] !== undefined ? M[typeId] : '';
  }
  function expectOf(typeId) {
    var M = {
      'L2-01': '必填（恶性肿瘤主要诊断编码）', 'L2-02': '与临床诊断名称一致的 ICD-10 编码',
      'L2-03': '与病理术语一致、行为学为 /3 的形态学编码',
      'L2-04': '病理诊断与形态学编码均非空', 'L2-05': 'T、N、M 三项完整',
      'L2-06': '原发部位与病理诊断一致'
    };
    return M[typeId] || '-';
  }
  function standardOf(typeId, key) {
    var M = {
      'L2-01': 'C34.9 肺恶性肿瘤', 'L2-02': pick(['C34.9 肺恶性肿瘤', 'C50.9 乳腺恶性肿瘤'], key),
      'L2-03': '8140/3 腺癌', 'L2-04': '腺癌 · 8140/3',
      'L2-05': 'pT2N1M0', 'L2-06': '原发部位：肺'
    };
    return M[typeId] || '';
  }

  /* ==================== 6. ③ 登记与随访数据质控 ==================== */

  /* 登记质量指标（含 MV%/DCO%/M/I 等国际通用口径）
   * base   = 当前实测中心值（生成用），不是考核线；
   * pass   = 达标线，统一取自预警引擎 warning-module.js(B 层) 与 IARC CI5 口径，
   *          与全站其它模块一致，避免"同名指标双标"（见 附录_全站指标审计.md 三-5）；
   * basis  = 该达标线的依据出处，界面达标灯旁展示。 */
  var L3_IND = [
    { id: 'MV', name: 'MV%（形态学确诊比例）', dir: 'up', base: 78.6, pass: 66, urgent: 55, basis: '《中国肿瘤登记年报》可靠性指标；IARC CI5 收录参考下限 MV%≥66%（已由省级登记中心确认）', def: '显微镜下形态学确诊的病例占全部登记病例的比例。', num: '有组织学/细胞学确诊的病例数', den: '同期登记的全部恶性肿瘤病例数' },
    { id: 'DCO', name: 'DCO%（仅死亡证明比例）', dir: 'down', base: 3.4, pass: 15, urgent: 25, basis: '《中国肿瘤登记年报》完整性/可靠性指标；DCO% 上限 15%（已由省级登记中心确认）', def: '仅凭死亡证明推断诊断的病例占比，越低说明登记质量越好。', num: '仅死亡证明来源的病例数', den: '同期登记的全部恶性肿瘤病例数' },
    { id: 'MI', name: 'M/I（死亡发病比）', dir: 'none', base: 0.62, pass: null, refLow: 0.55, refHigh: 0.85, basis: '死亡发病比参考区间（分癌种），本页全癌种合计参考 0.55~0.85；来源 warning-module.js B-MI-DEVIATION', def: '同期死亡数与发病数之比，用于评价登记的完整性。', num: '同期肿瘤死亡病例数', den: '同期肿瘤发病病例数' },
    { id: 'UB', name: '部位不明比例', dir: 'down', base: 4.8, pass: 5, urgent: 8, basis: '部位不明（C76–C80）上限 5%；来源 warning-module.js B-UB-HIGH', def: '原发部位不明确（C76–C80）的病例占比。', num: '部位不明病例数', den: '同期登记的全部恶性肿瘤病例数' },
    { id: 'COMP', name: '登记数据完整率', dir: 'up', base: 92.4, pass: 90, basis: '登记必填字段完整率下限 90%（省级登记质控口径）', def: '登记必填字段全部填报的病例占比。', num: '必填字段完整的病例数', den: '同期登记的全部恶性肿瘤病例数' },
    { id: 'SURV', name: '生存状态更新率', dir: 'up', base: 88.1, pass: 85, basis: '随访期内生存状态更新率下限 85%（省级随访质控口径）', def: '随访周期内完成生存状态更新的病例占比。', num: '已完成生存状态更新的病例数', den: '同期应随访病例数' }
  ];
  function l3Ind(id) {
    for (var i = 0; i < L3_IND.length; i++) if (L3_IND[i].id === id) return L3_IND[i];
    return null;
  }
  /* 登记指标达标判定：统一走 pass 达标线（而非把 base 生成中心值当考核线）。
   * M/I 无单一达标线，用参考区间 refLow~refHigh 判"偏离"。
   * 返回 true=达标 / false=未达标 / null=不适用（M/I）。 */
  function l3Pass(indId, value) {
    var d = l3Ind(indId);
    if (!d) return null;
    if (d.dir === 'none') return null;                 /* M/I 无达标概念 */
    if (d.pass == null) return null;
    return d.dir === 'down' ? value <= d.pass : value >= d.pass;
  }
  /* M/I 是否落在参考区间内（true=区间内 / false=偏离） */
  function l3InRange(indId, value) {
    var d = l3Ind(indId);
    if (!d || d.refLow == null) return null;
    return value >= d.refLow && value <= d.refHigh;
  }
  /* 区县登记质量：以市为基准 + 区县扰动 */
  function countyCell(indId, cityCode, countyName) {
    var def = l3Ind(indId);
    if (!def) return null;
    var den = Math.round(800 * (0.5 + rnd01('l3d|' + indId + '|' + cityCode + '|' + countyName) * 1.4));
    var jit = (rnd01('l3v|' + indId + '|' + cityCode + '|' + countyName) - 0.5) * 16;
    var v;
    if (indId === 'MI') v = clamp(def.base + jit / 100, 0.18, 1.6);
    else if (indId === 'DCO' || indId === 'UB') v = clamp(def.base + jit / 2.2, 0.4, 22);
    else v = clamp(def.base + jit, 42, 99.2);
    v = Math.round(v * 100) / 100;
    var num = indId === 'MI' ? Math.round(den * v) : Math.round(den * v / 100);
    return { ind: indId, city: cityCode, county: countyName, den: den, num: num, value: v, def: def };
  }
  function countyList(indId) {
    var out = [];
    CITIES.forEach(function (ct) {
      ct.counties.forEach(function (cn) {
        out.push(countyCell(indId, ct.code, cn));
      });
    });
    return out;
  }
  /* M/I 是比值（死亡数 ÷ 发病数，约 0.6），不是百分数；
     其余登记指标都是百分数。汇总时必须按指标量纲分别换算，
     否则 M/I 会被误乘 100（0.62 → 61.82），页面与定义自相矛盾。 */
  function l3ValueOf(indId, num, den) {
    if (den <= 0) return 0;
    return indId === 'MI' ? num / den : num / den * 100;
  }
  function cityCell(indId, cityCode) {
    var def = l3Ind(indId);
    if (!def) return null;
    var ct = null;
    CITIES.forEach(function (x) { if (x.code === cityCode) ct = x; });
    if (!ct) return null;
    var den = 0, num = 0;
    ct.counties.forEach(function (cn) {
      var c = countyCell(indId, cityCode, cn);
      den += c.den; num += c.num;
    });
    return {
      ind: indId, city: cityCode, cityName: ct.name, den: den, num: num,
      value: Math.round(l3ValueOf(indId, num, den) * 100) / 100, def: def
    };
  }
  function l3Agg(indId) {
    var def = l3Ind(indId);
    if (!def) return { value: 0, den: 0, num: 0 };
    var den = 0, num = 0;
    CITIES.forEach(function (ct) {
      var c = cityCell(indId, ct.code);
      den += c.den; num += c.num;
    });
    return {
      value: Math.round(l3ValueOf(indId, num, den) * 100) / 100,
      den: den, num: num, def: def
    };
  }
  function l3ByCancer(indId) {
    var all = l3Agg(indId);
    var def = l3Ind(indId);
    return CANCERS.map(function (c) {
      /* 波动范围与截断上下界必须按指标自身的量纲来定：
         MV%/COMP%/SURV% 是 40~99 的高位率值，DCO%/UB% 是 0~20 的低位率值，
         M/I 是 0.15~1.7 的比值。若统一按 40~99 截断，DCO%/UB% 会被顶到下界
         变成所有癌种同一个数（曾经的 bug）。 */
      var v;
      if (indId === 'MI') {
        /* 比值量纲：围绕全省值上下浮动，范围 0.15~1.7 */
        v = clamp(all.value + (rnd01('l3c|' + indId + '|' + c.id) - 0.5) * 0.3, 0.15, 1.7);
      } else if (indId === 'DCO' || indId === 'UB') {
        v = clamp(all.value + (rnd01('l3c|' + indId + '|' + c.id) - 0.5) * all.value * 1.1, all.value * 0.45, all.value * 1.9);
      } else {
        v = clamp(all.value + (rnd01('l3c|' + indId + '|' + c.id) - 0.5) * 14, 40, 99.3);
      }
      v = Math.round(v * 100) / 100;
      var den = Math.round(all.den / CANCERS.length * (0.6 + rnd01('l3cd|' + indId + '|' + c.id) * 0.9));
      /* M/I 的分子是死亡数（= den × 比值），其余指标的分子 = den × 率% */
      var num = indId === 'MI' ? Math.round(den * v) : Math.round(den * v / 100);
      /* 该癌种下的异常病例数。
         低位指标（DCO/UB）是"值越低越好"，超标部分才算异常；高位指标是"不达标部分"算异常。 */
      var abn;
      if (indId === 'MI') abn = Math.round(den * Math.abs(v - all.value) / 2);
      else if (indId === 'DCO' || indId === 'UB') abn = Math.round(den * Math.max(0, v - all.value) / 100);
      else abn = Math.round(den * (100 - v) / 100 * 0.7);
      return { cancer: c.id, name: c.name, short: c.short, den: den, num: num, value: v, abn: abn, def: def };
    });
  }

  /* 登记质控被质控病例：登记信息 + 随访 + 死亡比对 */
  function regCases(opt) {
    opt = opt || {};
    var out = [];
    var n = opt.limit || 160;
    for (var k = 0; k < n; k++) {
      var key = 'reg|' + k + '|' + (opt.salt || '');
      var c = pick(CANCERS, key + '|c');
      var ct = pick(CITIES, key + '|city');
      var cn = pick(ct.counties, key + '|cty');
      var kind = pick(['MVOK', 'MVNO', 'DCO', 'UB', 'LOST', 'DMATCH', 'TIMELY', 'SEX', 'AGE'], key + '|k');
      var survive = pick(['存活', '死亡', '不详'], key + '|sv');
      var regDate = dateStr(key + '|rd', 2024, 2026);
      var fuDate = kind === 'LOST' ? '' : addDays(regDate, rndInt(key + '|fu', 30, 500));
      var deathDate = survive === '死亡' ? addDays(regDate, rndInt(key + '|dd', 20, 700)) : '';
      out.push({
        id: 'REG' + rndInt(key + '|no', 100000, 999999),
        name: patientName(key), sex: c.id === 'C50' || c.id === 'C53' ? '女' : '男',
        age: rndInt(key + '|age', 33, 84),
        cancer: c.id, cancerName: c.name,
        city: ct.code, cityName: ct.name, county: cn, org: cn + '疾病预防控制中心',
        regDate: regDate, diagDate: addDays(regDate, -rndInt(key + '|dg', 1, 40)),
        basis: kind === 'MVOK' ? '组织学确诊' : kind === 'MVNO' ? '临床诊断（无形态学）' : kind === 'DCO' ? '仅死亡证明' : pick(['组织学确诊', '细胞学确诊', '临床诊断（无形态学）'], key + '|b'),
        site: c.name, siteCode: kind === 'UB' ? 'C80' : c.icd,
        path: kind === 'MVNO' || kind === 'DCO' ? '' : pick(['腺癌', '鳞状细胞癌', '导管癌', '肝细胞癌'], key + '|p'),
        survive: survive, fuDate: fuDate,
        deathDate: deathDate,
        deathCause: survive === '死亡' ? c.name + '（' + pick(['呼吸衰竭', '多器官功能衰竭', '肿瘤进展', '脑转移'], key + '|dc') + '）' : '',
        regStatus: pick(['已登记', '已复核', '待复核'], key + '|rs'),
        deathStatus: survive === '死亡' ? (kind === 'DMATCH' ? '死因监测无记录' : '死因监测已确认') : '不适用',
        matched: kind === 'DMATCH' ? '否' : survive === '死亡' ? '是' : '—',
        diffReason: kind === 'DMATCH' ? '登记状态为存活/不详，死因监测存在死亡记录' : '',
        v: kind === 'MVOK' ? V.OK : kind === 'TIMELY' ? V.ABN : kind === 'SEX' || kind === 'AGE' ? V.MISS : V.BAD,
        issueType: ({ MVOK: '', MVNO: '形态学确诊比例偏低', DCO: '仅死亡证明推断诊断', UB: '原发部位不明', LOST: '失访', DMATCH: '死亡信息不一致', TIMELY: '随访不及时', SEX: '性别信息缺失', AGE: '年龄信息缺失' })[kind],
        key: key
      });
    }
    return out;
  }

  /* 随访情况统计 */
  function followupStat() {
    var should = 42800;
    var done = Math.round(should * 0.881);
    var lost = Math.round(should * 0.062);
    var pending = should - done - lost;
    var unknown = Math.round(done * 0.047);
    return {
      should: should, done: done, pending: pending, lost: lost, unknown: unknown,
      alive: done - unknown - Math.round(done * 0.312),
      dead: Math.round(done * 0.312),
      unknown2: unknown,
      rate: Math.round(rate(done, should) * 100) / 100,
      lostRate: Math.round(rate(lost, should) * 100) / 100
    };
  }
  /* 死亡信息比对清单 */
  function deathCompare() {
    var out = [];
    for (var k = 0; k < 24; k++) {
      var key = 'dc|' + k;
      var c = pick(CANCERS, key + '|c');
      var matched = rnd01(key + '|m') > 0.35;
      out.push({
        name: patientName(key), cancerName: c.name,
        regStatus: pick(['存活', '不详', '死亡'], key + '|rs'),
        deathStatus: matched ? '死因监测已确认' : pick(['死因监测无记录', '死亡日期不一致', '死亡原因不一致'], key + '|ds'),
        matched: matched ? '是' : '否',
        diffReason: matched ? '' : pick(['登记状态为存活，死因监测存在死亡记录', '两侧死亡日期相差超过 30 天', '登记死亡原因与死因证明不一致'], key + '|dr'),
        key: key
      });
    }
    return out;
  }

  /* ==================== 7. ④ 数据汇聚与标准化质控 ==================== */

  var L4_IND = [
    { id: 'INGEST', name: '数据接入量', unit: '条', base: 1286400, dir: 'up' },
    { id: 'STORED', name: '数据入库量', unit: '条', base: 1271900, dir: 'up' },
    { id: 'CONSIST', name: '源端与入库一致率', unit: '%', base: 98.7, dir: 'up' },
    { id: 'FIELD', name: '字段完整率', unit: '%', base: 94.2, dir: 'up' },
    { id: 'DICT', name: '字典映射率', unit: '%', base: 96.5, dir: 'up' },
    { id: 'DUP', name: '重复病例率', unit: '%', base: 1.28, dir: 'down' }
  ];
  function l4Ind(id) {
    for (var i = 0; i < L4_IND.length; i++) if (L4_IND[i].id === id) return L4_IND[i];
    return null;
  }
  function l4Value(id) {
    var d = l4Ind(id);
    if (!d) return 0;
    /* 入库量必须由接入量推导，不能各自独立取随机数 ——
       否则会出现"入库 129.6 万 > 接入 128.8 万"这种不可能的倒挂。 */
    if (id === 'STORED') {
      var inNum = l4Value('INGEST');
      var lost = 0.004 + rnd01('l4|STORED|r') * 0.016;   /* 入库率 98.0% ~ 99.6% */
      return Math.round(inNum * (1 - lost));
    }
    var jit = (rnd01('l4|' + id) - 0.5) * (d.unit === '条' ? 0.06 : 1.6);
    var v = d.unit === '条' ? Math.round(d.base * (1 + jit)) : Math.round((d.base + jit) * 100) / 100;
    return v;
  }
  /* 数据源（含批次） */
  var SOURCES = [
    { id: 'SRC-01', name: '云健康 · 电子病历', type: 'HIS/EMR', org: 'ORG-01', cycle: '实时' },
    { id: 'SRC-02', name: '云健康 · 病案首页', type: '病案系统', org: 'ORG-01', cycle: '每日' },
    { id: 'SRC-03', name: '病理信息系统', type: 'PIS', org: 'ORG-01', cycle: '实时' },
    { id: 'SRC-04', name: '肿瘤登记报告卡', type: '登记系统', org: 'ORG-02', cycle: '每日' },
    { id: 'SRC-05', name: '死因监测系统', type: '死因库', org: 'ORG-04', cycle: '每月' },
    { id: 'SRC-06', name: '医保结算数据', type: '医保接口', org: 'ORG-05', cycle: '每月' },
    { id: 'SRC-07', name: '国家肿瘤上报平台', type: '国报接口', org: 'ORG-06', cycle: '每月' },
    { id: 'SRC-08', name: '区域人口健康信息平台', type: '区域平台', org: 'ORG-07', cycle: '每日' },
    { id: 'SRC-09', name: '随访管理系统', type: '随访系统', org: 'ORG-03', cycle: '每日' },
    { id: 'SRC-10', name: '实验室检验系统', type: 'LIS', org: 'ORG-08', cycle: '实时' }
  ];
  /* 批次：每源一份，源端/入库/差异 */
  function sourceBatch(s) {
    var key = 'batch|' + s.id;
    var src = rndInt(key + '|src', 42000, 186000);
    var diff = rndInt(key + '|df', 0, Math.max(1, Math.round(src * 0.012)));
    var stored = src - diff;
    var state = diff === 0 ? '正常' : diff < src * 0.004 ? '告警' : '异常';
    var batchNo = 'B2026' + pad(rndInt(key + '|m', 1, 9)) + pad(rndInt(key + '|d', 1, 28)) + '-' + rndInt(key + '|n', 100, 999);
    return {
      id: s.id, name: s.name, type: s.type, org: s.org, orgName: org(s.org) ? org(s.org).name : s.org, cycle: s.cycle,
      batchNo: batchNo, src: src, stored: stored, diff: diff,
      recv: src, success: stored, fail: diff,
      abn: rndInt(key + '|ab', 0, Math.max(1, Math.round(src * 0.006))),
      state: state,
      syncTime: '2026-09-' + pad(rndInt(key + '|st', 1, 28)) + ' ' + pad(rndInt(key + '|h', 0, 23)) + ':' + pad(rndInt(key + '|mi', 0, 59)),
      recon: diff === 0 ? '对账一致' : '对账存在差异',
      reason: diff === 0 ? '' : pick(['源端记录在传输过程中超时丢失', '主键冲突导致覆盖写入', '字段长度超限被截断', '字典值未映射被丢弃'], key + '|r'),
      key: key
    };
  }
  function allBatches() { return SOURCES.map(sourceBatch); }
  /* 批次下的异常记录明细（原始记录 vs 入库记录） */
  function batchRecords(b) {
    var out = [];
    var n = Math.min(b.diff > 0 ? b.diff : b.abn, 30);
    if (n <= 0) n = 8;
    for (var k = 0; k < n; k++) {
      var key = b.id + '|rec|' + k;
      var c = pick(CANCERS, key + '|c');
      var field = pick(['主要诊断编码', 'ICD-O-3 形态学', '病理诊断', 'TNM 分期', '出生日期', '身份证号', '生存状态'], key + '|f');
      var rawV = pick(['C34.9', '', '8140/2', 'T2NxM0', '1968-13-05', '', '未知'], key + '|rv');
      var stdV = rawV === '' ? '' : rawV === '1968-13-05' ? '1968-03-05' : rawV === '未知' ? '不详' : rawV;
      out.push({
        id: 'REC' + rndInt(key + '|no', 1000000, 9999999),
        name: patientName(key), cancerName: c.name, field: field,
        raw: rawV, std: stdV,
        stored: b.diff > 0 && rnd01(key + '|lost') < 0.4 ? '' : stdV,
        diff: rawV !== stdV ? '是' : '否',
        verdict: rawV === '' ? '数据缺失' : stdV !== rawV ? '标准化异常' : '对账差异',
        key: key
      });
    }
    return out;
  }

  /* 字段映射（标准化质控） */
  function fieldMaps() {
    var SRC = [
      ['ZDMC', '诊断名称', '主要诊断'], ['ZD_CODE', '诊断编码', 'ICD-10 编码'],
      ['BLZD', '病理诊断', '病理诊断术语'], ['BLXTSD', '病理形态学', 'ICD-O-3 形态学编码'],
      ['TNM_T', 'T分期', 'TNM 分期·T'], ['TNM_N', 'N分期', 'TNM 分期·N'], ['TNM_M', 'M分期', 'TNM 分期·M'],
      ['SSMC', '手术名称', '手术操作'], ['ZLSJ', '治疗时间', '首次治疗日期'],
      ['CSRQ', '出生日期', '出生日期'], ['SFZH', '身份证号', '身份证号'],
      ['XB', '性别', '性别代码'], ['ZZJG', '转归结果', '生存状态'], ['SWRQ', '死亡日期', '死亡日期']
    ];
    return SRC.map(function (s, i) {
      var key = 'map|' + s[0];
      var st = rnd01(key + '|st') < 0.86 ? '已映射' : rnd01(key + '|st2') < 0.6 ? '未映射' : '异常映射';
      return {
        src: s[0], srcName: s[1], std: s[2],
        rule: ruleNameOf(s[1]),
        status: st,
        coverage: Math.round((st === '已映射' ? 88 + rnd01(key + '|cv') * 11 : 20 + rnd01(key + '|cv2') * 40) * 10) / 10,
        samples: rndInt(key + '|n', 1200, 98000)
      };
    });
  }
  function ruleNameOf(srcName) {
    if (/诊断/.test(srcName)) return '诊断术语规范库 → ICD-10';
    if (/病理|形态/.test(srcName)) return '病理术语规范库 → ICD-O-3';
    if (/分期/.test(srcName)) return 'AJCC 第 8 版分期规则';
    if (/日期/.test(srcName)) return '日期格式标准化 YYYY-MM-DD';
    if (/性别/.test(srcName)) return 'GB/T 2261.1 性别代码';
    if (/身份证/.test(srcName)) return '身份证校验与脱敏';
    if (/手术/.test(srcName)) return 'ICD-9-CM-3 手术操作分类';
    if (/生存|转归/.test(srcName)) return '生存状态标准值域';
    return '通用字段标准化';
  }
  /* 关键字段结构化情况 */
  function structFields() {
    var defs = [
      { k: '诊断', base: 96.4, n: 1284000 }, { k: '病理', base: 91.2, n: 862000 },
      { k: '分期', base: 87.6, n: 742000 }, { k: '治疗', base: 93.8, n: 1105000 }
    ];
    return defs.map(function (d) {
      var key = 'st|' + d.k;
      var v = Math.round(clamp(d.base + (rnd01(key) - 0.5) * 5, 60, 99.5) * 10) / 10;
      return { field: d.k, rate: v, total: d.n, abn: Math.round(d.n * (100 - v) / 100) };
    });
  }

  /* 患者主索引与重复病例 */
  function empiList() {
    var out = [];
    for (var k = 0; k < 28; k++) {
      var key = 'empi|' + k;
      var c = pick(CANCERS, key + '|c');
      var st = pick(['已合并', '待确认', '疑似重复', '多原发', '待确认'], key + '|st');
      var oa = pick(ORGS, key + '|oa'), ob = pick(ORGS, key + '|ob');
      out.push({
        id: 'EMPI' + rndInt(key + '|no', 100000, 999999),
        name: patientName(key), idNo: maskId(key),
        cancerName: c.name,
        srcA: oa.name, srcB: ob.name,
        recA: 'MRN' + rndInt(key + '|ra', 1000000, 9999999),
        recB: 'MRN' + rndInt(key + '|rb', 1000000, 9999999),
        matchStatus: st === '已合并' ? '已确认为同一患者' : st === '疑似重复' ? '疑似重复待确认' : st === '多原发' ? '多原发（非重复）' : '待人工确认',
        dup: st === '疑似重复' ? '疑似重复' : st === '待确认' ? '待判断' : '否',
        multi: st === '多原发' ? '疑似多原发' : '否',
        similarity: Math.round((st === '疑似重复' ? 88 + rnd01(key + '|s') * 11 : st === '多原发' ? 62 + rnd01(key + '|s2') * 14 : 72 + rnd01(key + '|s3') * 24) * 10) / 10,
        matchFields: pick(['身份证号 + 姓名 + 性别', '姓名 + 出生日期 + 联系电话', '身份证号一致，姓名不一致'], key + '|mf'),
        reason: st === '疑似重复' ? pick(['同一身份证号在两家机构均有登记', '姓名与出生日期一致，机构不同'], key + '|rs') : st === '多原发' ? '两次诊断间隔 6 个月以上且原发部位不同' : '多要素匹配一致',
        state: st, key: key,
        age: rndInt(key + '|age', 35, 80),
        sex: pick(['男', '女'], key + '|sx')
      });
    }
    return out;
  }
  function maskId(key) {
    return '3601' + rndInt(key + '|id1', 10, 99) + '********' + rndInt(key + '|id2', 1000, 9999);
  }

  /* ==================== 8. ⑤ 质控工作闭环 ==================== */

  /* 问题台账：由 ①—④ 的异常汇总而成，单一来源。
     每条问题都携带 layer，用于反查被质控数据。 */
  var LOOP_STATUS = ['待处理', '整改中', '待复核', '已关闭', '已逾期'];

  function problems() {
    if (PROBLEM_CACHE) return PROBLEM_CACHE;
    var out = [];
    /* ① 诊疗质控问题
       注意：问题条数不能简单地与异常病例数成正比 —— L1 的异常病例动辄上万，
       若按病例数折算会产生上千条 L1 问题，把 ②③④ 淹没（问题中心首页全是 L1）。
       这里按指标 × 机构聚合：每个指标在每个机构最多生成一条问题，
       问题量级与 ②③④ 相当，符合"一个问题对应一个机构的某类缺陷"的真实语义。 */
    L1_IND.forEach(function (i) {
      var k = 0;
      ORGS.forEach(function (o) {
        var a = agg(i.id, [o.id], null);
        if (a.den <= 0) return;
        /* 该机构在该指标上是否达标 + 是否存在异常病例 */
        var ok = i.dir === 'down' ? a.value <= i.base : a.value >= i.base;
        var abn = abnCount(i.id, null, [o.id]);
        if (ok && abn === 0) return;
        /* 达标机构只在异常病例较多时记一条，避免问题表被"轻微异常"填满 */
        if (ok && rnd01('p1f|' + i.id + '|' + o.id) > 0.25) return;
        var key = 'p1|' + i.id + '|' + o.id;
        var c = pick(i.cancers, key + '|c');
        out.push(mkProblem('L1', key, {
          layer: 'L1', module: '诊疗过程与单病种质控',
          type: ok ? ['诊疗记录缺失', '时间逻辑冲突'][hash(key) % 2] : '指标未达标',
          obj: i.name, objId: i.id, org: o.id, orgName: o.name, city: o.city,
          cancer: c, cancerName: cancer(c).name,
          desc: (ok ? '' : i.name + '为 ' + f1(a.value) + '%，低于基准值 ' + i.base + '%；') +
            reasonOf(i.id, hash(key) % 2 ? V.BAD : V.MISS),
          rule: ruleOf(i.id, V.BAD),
          count: Math.max(1, Math.round(abn * (0.15 + rnd01(key + '|r') * 0.35)))
        }));
        k++;
      });
    });
    /* ② 病案编码问题 */
    L2_ISSUES.forEach(function (t) {
      ORGS.forEach(function (o) {
        var key = 'p2|' + t.id + '|' + o.id;
        var n = rndInt(key + '|n', 0, 9);
        if (n <= 0) return;
        var c = pick(CANCERS, key + '|c');
        out.push(mkProblem('L2', key, {
          layer: 'L2', module: '病案与编码质控', type: t.type,
          obj: t.field, objId: t.id, org: o.id, orgName: o.name, city: o.city,
          cancer: c.id, cancerName: c.name,
          desc: t.desc,
          rule: { code: t.rule, name: t.type, ver: 'V2026.1', cond: t.cond, field: t.field, hit: true },
          count: n
        }));
      });
    });
    /* ③ 登记随访问题 */
    var REGT = [
      { t: '形态学确诊比例偏低', o: 'MV% 低于全省平均水平' },
      { t: '仅死亡证明推断诊断', o: 'DCO% 超阈值，登记质量待提升' },
      { t: '原发部位不明', o: '部位不明比例偏高' },
      { t: '随访失访', o: '末次随访超 12 个月无更新' },
      { t: '死亡信息不一致', o: '登记状态与死因监测不一致' }
    ];
    REGT.forEach(function (rt) {
      CITIES.forEach(function (ct) {
        var key = 'p3|' + rt.t + '|' + ct.code;
        var n = rndInt(key + '|n', 0, 14);
        if (n <= 0) return;
        var c = pick(CANCERS, key + '|c');
        out.push(mkProblem('L3', key, {
          layer: 'L3', module: '登记与随访数据质控', type: rt.t,
          obj: ct.name + '登记质量', objId: rt.t, org: '', orgName: ct.name + '登记处', city: ct.code,
          cancer: c.id, cancerName: c.name,
          desc: rt.o,
          rule: { code: 'QC-L3-' + (hash(rt.t) % 900 + 100), name: rt.t, ver: 'V2025.2', cond: rt.o, field: '登记信息 / 随访记录', hit: true },
          count: n
        }));
      });
    });
    /* ④ 数据质量问题 */
    var L4T = [
      { t: '数据接入异常', o: '数据接入异常' }, { t: '数据缺失', o: '数据缺失' },
      { t: '对账异常', o: '对账异常' }, { t: '标准映射异常', o: '标准映射异常' },
      { t: '重复病例', o: '重复病例' }, { t: '主索引异常', o: '主索引异常' },
      { t: '关键字段缺失', o: '关键字段缺失' }
    ];
    L4T.forEach(function (t) {
      SOURCES.forEach(function (s) {
        var key = 'p4|' + t.t + '|' + s.id;
        var n = rndInt(key + '|n', 0, 10);
        if (n <= 0) return;
        var c = pick(CANCERS, key + '|c');
        out.push(mkProblem('L4', key, {
          layer: 'L4', module: '数据汇聚与标准化质控', type: t.t,
          obj: s.name, objId: s.id, org: s.org, orgName: s.name, city: org(s.org) ? org(s.org).city : '',
          cancer: c.id, cancerName: c.name,
          desc: t.o + '：' + (sourceBatch(s).reason || '字段映射未覆盖'),
          rule: { code: 'QC-L4-' + (hash(t.t + s.id) % 900 + 100), name: t.t, ver: 'V2026.1', cond: '数据接入与标准化规则', field: '接入批次 / 映射字典', hit: true },
          count: n
        }));
      });
    });
    PROBLEM_CACHE = out;
    return out;
  }
  var PROBLEM_CACHE = null;

  function mkProblem(layer, key, o) {
    /* 状态分布贴近真实质控工作：多数问题在流转中，已闭环占约三成，
       逾期是少数（这里用加权抽样而不是均匀抽样，避免"一半都逾期"的失真）。 */
    var r = rnd01(key + '|st');
    var st = r < 0.32 ? '已关闭' : r < 0.55 ? '整改中' : r < 0.78 ? '待复核' : r < 0.94 ? '待处理' : '已逾期';
    var found = dateStr(key + '|fd', 2026, 2026);
    var due = addDays(found, rndInt(key + '|due', 7, 45));
    var today = '2026-09-21';
    /* 逾期状态必须与截止日期内在一致：已闭环的不能算逾期，
       未闭环但已过截止日的才升级为逾期。 */
    if (st === '已关闭') {
      /* 已关闭的问题在截止日前完成的比例高 */
      if (rnd01(key + '|ot') < 0.22) { /* 超期完成，但仍已关闭，不计入逾期 */ }
    } else if (dayDiff(due, today) > 0 && rnd01(key + '|ov') < 0.55) {
      st = '已逾期';
    } else if (st === '已逾期') {
      st = '整改中';
    }
    return {
      code: 'QC' + (layer.charAt(1)) + rndInt(key + '|code', 100000, 999999),
      layer: layer,
      module: o.module, type: o.type,
      obj: o.obj, objId: o.objId,
      org: o.org, orgName: o.orgName, city: o.city, cityName: o.city ? cityName(o.city) : '',
      cancer: o.cancer, cancerName: o.cancerName,
      desc: o.desc, rule: o.rule, count: o.count,
      foundDate: found, dueDate: due, status: st,
      severity: hash(key + '|sv') % 3 === 0 ? '预警' : '观察',
      owner: pick(['医务科 质控员', '病案统计科 编码组', '登记中心 数据组', '平台运维 数据接入组'], key + '|ow'),
      key: key,
      /* 整改过程记录（处理记录） */
      logs: buildLogs(key, st, found)
    };
  }
  function buildLogs(key, st, found) {
    var logs = [{ t: addDays(found, 0) + ' 09:20', who: '系统', what: '规则命中，自动生成质控问题' }];
    var order = ['待处理', '整改中', '待复核', '已关闭'];
    var idx = order.indexOf(st === '已逾期' ? '整改中' : st);
    if (idx < 0) idx = 0;
    if (idx >= 1) logs.push({ t: addDays(found, 1) + ' 10:05', who: '质控中心', what: '下发整改要求，期限 ' + rndInt(key + '|w', 7, 30) + ' 个工作日' });
    if (idx >= 2) logs.push({ t: addDays(found, rndInt(key + '|l2', 3, 9)) + ' 15:40', who: '医疗机构', what: '提交整改反馈与佐证材料' });
    if (idx >= 3) logs.push({ t: addDays(found, rndInt(key + '|l3', 10, 18)) + ' 11:12', who: '质控中心', what: '复核通过，问题关闭' });
    return logs;
  }

  /* 问题统计（问题中心顶部） */
  function problemStat(list) {
    list = list || problems();
    var m = { 待处理: 0, 整改中: 0, 待复核: 0, 已关闭: 0, 已逾期: 0 };
    list.forEach(function (p) { if (m[p.status] != null) m[p.status]++; });
    var closed = m['已关闭'], total = list.length;
    return {
      pending: m['待处理'], fixing: m['整改中'], review: m['待复核'],
      closed: closed, overdue: m['已逾期'], total: total,
      closeRate: total ? Math.round(closed / total * 1000) / 10 : 0,
      byStatus: m
    };
  }

  /* 整改任务：由问题聚合成任务下发 */
  function tasks() {
    var out = [];
    ORGS.forEach(function (o, i) {
      var ps = problems().filter(function (p) { return p.org === o.id; });
      if (!ps.length) return;
      var groups = Math.max(1, Math.round(ps.length / 12));
      for (var g = 0; g < groups; g++) {
        var key = 'task|' + o.id + '|' + g;
        var items = ps.slice(g * 12, g * 12 + 12);
        var closed = items.filter(function (p) { return p.status === '已关闭'; }).length;
        var issue = addDays('2026-08-01', rndInt(key + '|d', 0, 45));
        var due = addDays(issue, rndInt(key + '|due', 15, 60));
        var today = '2026-09-21';
        var od = dayDiff(due, today);
        var st = closed === items.length ? '已完成' : od > 0 ? '已逾期' : closed > 0 ? '整改中' : '待下发';
        out.push({
          id: 'TASK' + rndInt(key + '|no', 100000, 999999),
          name: o.name + ' 质控整改任务（第 ' + (g + 1) + ' 批）',
          org: o.id, orgName: o.name, city: o.city, cityName: cityName(o.city),
          problems: items, problemCount: items.length,
          issueDate: issue, dueDate: due,
          progress: Math.round(closed / items.length * 100),
          status: st, key: key,
          requirement: '针对本次质控发现的问题，请逐例核对原始诊疗记录，限期完成整改并上传佐证材料。',
          feedback: closed > 0 ? '已完成 ' + closed + ' 例整改，其余正在核实原始病历。' : '',
          review: closed === items.length ? '整改到位，同意关闭。' : '',
          materials: closed > 0 ? pick(['整改情况说明.pdf', '补充病历扫描件.zip', '编码修正对照表.xlsx'], key + '|m') : ''
        });
      }
    });
    return out;
  }

  /* 抽查计划 */
  function samplingPlans() {
    var out = [];
    var CY = ['2026 年第一次', '2026 年第二次', '2026 年专项'];
    CY.forEach(function (cy, i) {
      for (var k = 0; k < 3; k++) {
        var key = 'samp|' + cy + '|' + k;
        var scope = pick(['省级三级医院', '市级三级医院', '全省二级以上医院'], key + '|sc');
        var orgs = ORGS.filter(function (o) { return rnd01(key + '|o|' + o.id) < 0.4; });
        if (!orgs.length) orgs = [pick(ORGS, key + '|o0')];
        var total = rndInt(key + '|n', 60, 420);
        var done = Math.round(total * (0.35 + rnd01(key + '|dp') * 0.65));
        var probs = Math.round(done * (0.08 + rnd01(key + '|pr') * 0.22));
        var st = done >= total ? '已完成' : done > 0 ? '进行中' : '未开始';
        out.push({
          id: 'SP' + rndInt(key + '|no', 100000, 999999),
          name: cy + '肿瘤诊疗质量抽查',
          scope: scope, orgs: orgs, orgCount: orgs.length,
          total: total, done: done, problems: probs,
          status: st, key: key,
          start: addDays('2026-06-01', rndInt(key + '|s', 0, 60)),
          end: addDays('2026-09-01', rndInt(key + '|e', 0, 40)),
          items: pick([['临床分期评估', '病理诊断', 'TNM 分期'], ['病案首页编码', '手术操作编码'], ['登记完整性', '随访更新率']], key + '|it')
        });
      }
    });
    return out;
  }
  /* 抽查病例 */
  function samplingCases(plan, opt) {
    opt = opt || {};
    var out = [];
    var n = Math.min(plan.done, opt.limit || 60);
    for (var k = 0; k < n; k++) {
      var key = plan.key + '|case|' + k;
      var o = pick(plan.orgs, key + '|o');
      var c = pick(CANCERS, key + '|c');
      var item = pick(plan.items, key + '|it');
      var bad = rnd01(key + '|bad') < 0.2;
      out.push({
        id: 'SPC' + rndInt(key + '|no', 100000, 999999),
        name: patientName(key), sex: pick(['男', '女'], key + '|sx'),
        age: rndInt(key + '|age', 35, 82),
        org: o.id, orgName: o.name, cancer: c.id, cancerName: c.name,
        item: item, verdict: bad ? pick(['不符合', '数据缺失'], key + '|v') : '符合',
        problemStatus: bad ? pick(['待处理', '整改中', '已关闭'], key + '|ps') : '—',
        v: bad ? V.BAD : V.OK, key: key
      });
    }
    return out;
  }

  /* 闭环分析：机构 / 区域 / 问题类型 / 趋势 */
  function loopByOrg() {
    var ps = problems();
    return ORGS.map(function (o) {
      var list = ps.filter(function (p) { return p.org === o.id; });
      if (!list.length) return null;
      var closed = list.filter(function (p) { return p.status === '已关闭'; }).length;
      var fixing = list.filter(function (p) { return p.status === '整改中'; }).length;
      var overdue = list.filter(function (p) { return p.status === '已逾期'; }).length;
      var onTime = list.filter(function (p) { return p.status === '已关闭' && rnd01(p.key + '|ot') > 0.22; }).length;
      return {
        org: o.id, orgName: o.name, city: o.city, level: o.level,
        count: list.length, closed: closed, overdue: overdue,
        closeRate: Math.round(closed / list.length * 1000) / 10,
        onTimeRate: closed ? Math.round(onTime / closed * 1000) / 10 : 0,
        fixingRate: Math.round(fixing / list.length * 1000) / 10
      };
    }).filter(Boolean).sort(function (a, b) { return a.closeRate - b.closeRate; });
  }
  function loopByRegion() {
    var ps = problems();
    return CITIES.map(function (ct) {
      var list = ps.filter(function (p) { return p.city === ct.code; });
      if (!list.length) return null;
      var closed = list.filter(function (p) { return p.status === '已关闭'; }).length;
      var overdue = list.filter(function (p) { return p.status === '已逾期'; }).length;
      return {
        code: ct.code, name: ct.name, count: list.length, closed: closed, overdue: overdue,
        closeRate: Math.round(closed / list.length * 1000) / 10,
        counties: ct.counties.map(function (cn) {
          var sub = list.filter(function (p) { return rnd01(p.key + '|c|' + cn) < 0.5; });
          var sc = sub.filter(function (p) { return p.status === '已关闭'; }).length;
          return { name: cn, count: sub.length, closed: sc, closeRate: sub.length ? Math.round(sc / sub.length * 1000) / 10 : 0 };
        })
      };
    }).filter(Boolean);
  }
  function loopByType() {
    var ps = problems();
    var keys = [
      { k: 'L1', label: '诊疗质控问题' }, { k: 'L2', label: '病案编码问题' },
      { k: 'L3', label: '登记随访问题' }, { k: 'L4', label: '数据质量问题' }
    ];
    return keys.map(function (x) {
      var list = ps.filter(function (p) { return p.layer === x.k; });
      var closed = list.filter(function (p) { return p.status === '已关闭'; }).length;
      return {
        layer: x.k, label: x.label, count: list.length, closed: closed,
        closeRate: list.length ? Math.round(closed / list.length * 1000) / 10 : 0
      };
    });
  }
  function loopTrend() {
    var out = [];
    for (var m = 1; m <= 9; m++) {
      var key = 'lt|' + m;
      var found = rndInt(key + '|f', 40, 180);
      var fixed = Math.round(found * (0.5 + rnd01(key + '|fx') * 0.4));
      var closed = Math.round(fixed * (0.7 + rnd01(key + '|cl') * 0.28));
      out.push({ l: m + '月', found: found, fixed: fixed, closed: closed });
    }
    return out;
  }
  /* 闭环核心指标 */
  function loopKpi() {
    var ps = problems();
    var st = problemStat(ps);
    var fixed = st.closed + st.review;
    /* 整改及时率 = 按期闭环数 / 已闭环数。
       一个"已关闭"的问题也可能曾经逾期（超期后才闭环），这里用每个问题自己的
       种子判定其是否按期完成，而不是拿全局逾期数去减 —— 后者会把两个不同口径
       （全局逾期 vs 已闭环）混在一起算。 */
    var closedList = ps.filter(function (p) { return p.status === '已关闭'; });
    var onTime = closedList.filter(function (p) { return rnd01(p.key + '|ot') > 0.18; }).length;
    var timely = closedList.length ? onTime / closedList.length * 100 : 0;
    /* 复核完成率 = 已复核（已关闭 + 待复核过半数）/ 问题总数 */
    return {
      found: ps.length,
      fixed: fixed,
      timelyRate: Math.round(clamp(timely, 0, 100) * 10) / 10,
      reviewRate: Math.round((st.closed + st.review * 0.5) / Math.max(1, st.total) * 1000) / 10,
      closeRate: st.closeRate,
      overdue: st.overdue,
      st: st
    };
  }

  /* ==================== 8.5 ① 诊疗质控 · 分析派生（"这些数字说明了什么"） ==================== */

  /* 单指标达标判定 */
  function l1Pass(indId, value) {
    var i = ind(indId);
    if (!i) return false;
    return i.dir === 'down' ? value <= i.base : value >= i.base;
  }
  /* 与基准的差距（正=优于基准，对 down 类做方向翻转，使"正=好"统一成立） */
  function l1Gap(indId, value) {
    var i = ind(indId);
    if (!i) return 0;
    var raw = value - i.base;
    return i.dir === 'down' ? -raw : raw;
  }

  /* 六项指标在当前筛选下的达标画像 —— 总览"结论洞察"的数据底座 */
  function l1Profile(orgIds, cancerIds) {
    var rows = L1_IND.map(function (i) {
      var a = agg(i.id, orgIds, cancerIds);
      var gap = l1Gap(i.id, a.value);
      return {
        id: i.id, name: i.name, short: i.short, dir: i.dir, base: i.base,
        value: a.value, num: a.num, den: a.den,
        pass: l1Pass(i.id, a.value), gap: Math.round(gap * 100) / 100,
        abn: abnCount(i.id, cancerIds && cancerIds.length === 1 ? cancerIds[0] : null, orgIds),
        yoy: yoy(i.id, orgIds, cancerIds)
      };
    });
    var passN = rows.filter(function (r) { return r.pass; }).length;
    var totAbn = rows.reduce(function (s, r) { return s + r.abn; }, 0);
    var totDen = rows.reduce(function (s, r) { return s + r.den; }, 0);
    /* 综合得分：达标率 60% 权重 + 平均达标裕度 40% 权重，落到 0~100 */
    var passScore = rows.length ? passN / rows.length * 100 : 0;
    var marginAvg = rows.reduce(function (s, r) {
      /* 每项相对基准的百分裕度，封顶 ±100 */
      var m = r.base > 0 ? clamp(r.gap / r.base * 100, -100, 100) : 0;
      return s + m;
    }, 0) / (rows.length || 1);
    var score = clamp(passScore * 0.6 + (50 + marginAvg / 2) * 0.4, 0, 100);
    /* 最拖后腿 / 最亮眼 */
    var sorted = rows.slice().sort(function (a, b) { return a.gap - b.gap; });
    return {
      rows: rows, passN: passN, failN: rows.length - passN, total: rows.length,
      totAbn: totAbn, totDen: totDen,
      abnRate: totDen > 0 ? Math.round(totAbn / totDen * 1000) / 10 : 0,
      score: Math.round(score * 10) / 10,
      worst: sorted[0], best: sorted[sorted.length - 1],
      improving: rows.filter(function (r) { return (r.dir === 'down' ? r.yoy < 0 : r.yoy > 0); }).length
    };
  }

  /* 指标 × 设区市 达标热力矩阵：一眼看清哪个市在哪项指标上塌方 */
  function l1RegionMatrix(cancerIds) {
    return CITIES.map(function (ct) {
      var orgIds = ORGS.filter(function (o) { return o.city === ct.code; }).map(function (o) { return o.id; });
      return {
        code: ct.code, name: ct.name,
        cells: L1_IND.map(function (i) {
          var a = agg(i.id, orgIds.length ? orgIds : ['__none__'], cancerIds);
          return { ind: i.id, dir: i.dir, base: i.base, value: a.value, den: a.den, pass: l1Pass(i.id, a.value) };
        })
      };
    }).filter(function (r) { return r.cells.some(function (c) { return c.den > 0; }); });
  }

  /* 单指标：机构达标差距榜（用于指标分析页的"谁在拖后腿/谁标杆"） */
  function l1OrgGaps(indId, cancerIds) {
    var i = ind(indId);
    if (!i) return [];
    return byOrg(indId, cancerIds).map(function (r) {
      return {
        org: r.org, name: r.orgName, level: r.level, value: r.value,
        den: r.den, abn: r.abn,
        gap: Math.round(l1Gap(indId, r.value) * 100) / 100,
        pass: l1Pass(indId, r.value)
      };
    });
  }

  /* 单指标：异常原因结构（把 abnCount 按"缺失/时间冲突/不一致/不达标"拆开，给出主因） */
  function l1AbnBreakdown(indId, orgIds) {
    var base = abnCount(indId, null, orgIds);
    var w = [
      { key: 'miss', label: '记录/字段缺失', r: 0.36 },
      { key: 'time', label: '时间逻辑冲突', r: 0.27 },
      { key: 'incon', label: '字段前后不一致', r: 0.21 },
      { key: 'thresh', label: '数值不达标', r: 0.16 }
    ];
    var out = w.map(function (x) { return { key: x.key, label: x.label, count: Math.round(base * x.r) }; });
    out.sort(function (a, b) { return b.count - a.count; });
    return { total: base, items: out, top: out[0] };
  }

  /* ==================== 9. 筛选 / 选项 ==================== */

  function orgOptions() {
    return ORGS.map(function (o) { return { v: o.id, l: o.name }; });
  }
  function cityOptions() {
    return [{ v: '', l: '全省' }].concat(CITIES.map(function (c) { return { v: c.code, l: c.name }; }));
  }
  function cancerOptions() {
    return CANCERS.map(function (c) { return { v: c.id, l: c.name }; });
  }

  /* 数据来源标记（原始数据追溯用） */
  var SRC_TAGS = ['云健康', '病案首页', '病理系统', '登记报告卡', '死因监测', '医保接口', '随访系统'];
  function srcTag(i) { return pick(SRC_TAGS, 'srctag|' + i); }

  /* ==================== 10. 对外暴露 ==================== */
  window.qcSpine = {
    /* 工具 */
    esc: esc, fmt: fmt, f1: f1, pc: pc, rate: rate, clamp: clamp,
    seedOf: seedOf, rnd01: rnd01, rndInt: rndInt, pick: pick,
    addDays: addDays, dayDiff: dayDiff, dateStr: dateStr, pad: pad,
    /* 主数据 */
    CITIES: CITIES, ORGS: ORGS, CANCERS: CANCERS,
    org: org, cancer: cancer, cityName: cityName, orgOptions: orgOptions,
    cityOptions: cityOptions, cancerOptions: cancerOptions, srcTag: srcTag,
    /* ① 诊疗 */
    L1_IND: L1_IND, ind: ind,
    denOf: denOf, orgLevelOf: orgLevelOf, cell: cell, agg: agg, total: total, yoy: yoy,
    byCancer: byCancer, byOrg: byOrg,
    cases: cases, caseCount: caseCount, abnCount: abnCount, abnTypes: abnTypes,
    abnRateOf: abnRateOf, verdictCounts: verdictCounts,
    judge: judge, reasonOf: reasonOf, ruleOf: ruleOf,
    trend: trend,
    /* ① 分析派生 */
    l1Pass: l1Pass, l1Gap: l1Gap, l1Profile: l1Profile,
    l1RegionMatrix: l1RegionMatrix, l1OrgGaps: l1OrgGaps, l1AbnBreakdown: l1AbnBreakdown,
    V: V, V_LABEL: V_LABEL, V_TONE: V_TONE,
    /* ② 编码 */
    L2_IND: L2_IND, L2_ISSUES: L2_ISSUES, l2Ind: l2Ind, l2OrgValue: l2OrgValue,
    l2Agg: l2Agg, l2ByOrg: l2ByOrg, l2Issues: l2Issues,
    currentOf: currentOf, expectOf: expectOf, standardOf: standardOf,
    currentSample: function (r, kind) {
      /* 详情页"数据对比"用：取该问题病例在某一字段上的实际值 */
      if (kind === 'icd10') return r.typeId === 'L2-02' ? r.current : 'C34.9';
      return r.current;
    },
    /* ③ 登记随访 */
    L3_IND: L3_IND, l3Ind: l3Ind, l3Pass: l3Pass, l3InRange: l3InRange,
    countyCell: countyCell, countyList: countyList,
    cityCell: cityCell, l3Agg: l3Agg, l3ByCancer: l3ByCancer, l3ValueOf: l3ValueOf,
    regCases: regCases, followupStat: followupStat, deathCompare: deathCompare,
    /* ④ 汇聚标准化 */
    L4_IND: L4_IND, l4Ind: l4Ind, l4Value: l4Value,
    SOURCES: SOURCES, sourceBatch: sourceBatch, allBatches: allBatches, batchRecords: batchRecords,
    fieldMaps: fieldMaps, structFields: structFields, empiList: empiList,
    /* ⑤ 闭环 */
    LOOP_STATUS: LOOP_STATUS, problems: problems, problemStat: problemStat,
    tasks: tasks, samplingPlans: samplingPlans, samplingCases: samplingCases,
    loopByOrg: loopByOrg, loopByRegion: loopByRegion, loopByType: loopByType,
    loopTrend: loopTrend, loopKpi: loopKpi,
    /* 缓存清理（调试用） */
    _reset: function () { PROBLEM_CACHE = null; }
  };
})();
