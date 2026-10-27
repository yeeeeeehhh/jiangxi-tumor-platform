/* ============================================================================
 * qc-mdt-data.js — MDT 多学科诊疗质控 · 数据脊柱（2026-10-26 精简）
 *
 * 定位：只做 MDT 一个模块，两个对外指标（页面见 qc-mdt.js），三个质控点。
 *      不做过程指标的堆砌，不建第二套交互范式。
 *
 * 两个对外指标（与「六大绩效质控」一指标一页对齐）：
 *   指标一 MDT 讨论率     = 有效讨论病例 / 应讨论病例          （质控点 P1）
 *   指标二 MDT 结论执行率 = 治疗符合结论病例 / 已讨论且结论明确且已治疗
 *                                                              （质控点 P3）
 *      其中「结论是否落到具体方案」（质控点 P2）是指标二的前置判定，
 *      不单独占页面，其分子分母随指标二同屏给出。
 *
 * 三个质控点（全部来自可核实文件，见每条 rule 的 basis / grade）：
 *   P1 该讨论的讨论了没   —— 命中入组规则的病例须有有效 MDT 记录
 *       依据：B 档《国家医疗质量安全改进目标》配套指标「疑难病例讨论完成率」
 *   P2 结论是否落到具体方案 —— 结论须含明确治疗方式，不能是"建议进一步检查"
 *       依据：A 档《病历书写基本规范》「疑难病例讨论记录须记载具体讨论意见及主持人小结意见」
 *   P3 结论执行了没       —— 实际治疗须与结论一致，不一致须有变更说明
 *       依据：A 档 T/CHAS 10-3-6—2023《多学科联合诊疗(MDT)》5.3「方案实施与随访」
 *
 *   · 两个指标：
 *       MDT 讨论率   = 有效讨论病例 / 应讨论病例        （B 档）
 *       MDT 结论执行率 = 治疗符合结论病例 / 已讨论病例   （A 档）
 *
 * 重要声明（不回避）：
 *   · 国家层面尚未发布肿瘤 MDT 专项质控指标（国家癌症中心 2026 年工作要点第八条
 *     仍在"开展全国性调研"），本模块两个指标借的是「疑难病例讨论」口径，
 *     与肿瘤 MDT 不完全等同，界面必须标注。
 *   · 入组规则（ENTER_RULES）为院级口径，须经院内质控委员会确认并报省质控中心，
 *     不得当作国家规定使用。代码里 grade:'C' 即此意。
 *
 * 数据来源：确定性种子生成（同 qc-data.js 口径），接真实 EMR 后由后台替换
 *   本文件的 CASES 构造段，对外 API 不变。
 *
 * 暴露：window.qcMdt
 * ========================================================================== */
(function () {
  'use strict';

  var S = window.qcSpine;

  /* ==================== 1. 入组规则（分母唯一来源） ==================== */
  /* 每条规则：cancer 癌种 / cond 条件描述 / basis 依据 / grade 依据档
     改入组规则只改这张表，MDT 讨论率的分母随之变化。 */
  var ENTER_RULES = [
    { id: 'EN-LC-1', cancer: 'C34', name: 'III 期及以上', cond: '临床分期 ≥ IIIA', basis: '《原发性肺癌诊疗指南》多学科诊疗推荐', grade: 'A' },
    { id: 'EN-LC-2', cancer: 'C34', name: '拟行新辅助治疗', cond: '治疗意图 = 新辅助', basis: '同上', grade: 'A' },
    { id: 'EN-LC-3', cancer: 'C34', name: '寡转移需局部治疗决策', cond: 'IV 期且转移灶 ≤3', basis: '院级口径（待确认）', grade: 'C' },
    { id: 'EN-BC-1', cancer: 'C50', name: '拟行新辅助治疗', cond: '治疗意图 = 新辅助', basis: '《CSCO 乳腺癌诊疗指南》', grade: 'A' },
    { id: 'EN-BC-2', cancer: 'C50', name: 'HER2 阳性或三阴性', cond: '分子分型 ∈ {HER2+, TNBC}', basis: '《CSCO 乳腺癌诊疗指南》', grade: 'A' },
    { id: 'EN-BC-3', cancer: 'C50', name: '局部晚期', cond: '临床分期 ≥ IIIA', basis: '同上', grade: 'A' },
    { id: 'EN-CRC-1', cancer: 'C18', name: '直肠癌局部进展期', cond: '部位=直肠 且 (T3/T4 或 N+)', basis: '《CSCO 结直肠癌诊疗指南》', grade: 'A' },
    { id: 'EN-CRC-2', cancer: 'C18', name: '肝/肺转移可切除性判断', cond: '存在可切除或潜在可切除转移灶', basis: '同上', grade: 'A' },
    { id: 'EN-GC-1', cancer: 'C16', name: '拟行新辅助治疗', cond: '治疗意图 = 新辅助', basis: '《CSCO 胃癌诊疗指南》', grade: 'A' },
    { id: 'EN-GC-2', cancer: 'C16', name: '腹膜转移', cond: '存在腹膜转移', basis: '同上', grade: 'A' },
    { id: 'EN-HCC-1', cancer: 'C22', name: '超出手术切除标准', cond: '不可切除或需在 TACE/靶向/消融间决策', basis: '《原发性肝癌诊疗指南》', grade: 'A' },
    { id: 'EN-EC-1', cancer: 'C15', name: '拟行新辅助治疗', cond: '治疗意图 = 新辅助', basis: '《CSCO 食管癌诊疗指南》', grade: 'A' },
    { id: 'EN-EC-2', cancer: 'C15', name: '颈段/上段食管癌', cond: '部位 ∈ {颈段, 上段}', basis: '同上', grade: 'A' },
    { id: 'EN-ALL-1', cancer: '*', name: '非计划再次手术', cond: '本次住院存在非计划再次手术', basis: '《国家医疗质量安全改进目标》疑难病例讨论要求', grade: 'B' },
    { id: 'EN-ALL-2', cancer: '*', name: '死亡病例讨论', cond: '住院死亡', basis: '《医疗质量安全核心制度》死亡病例讨论制度', grade: 'A' }
  ];

  /* ==================== 2. 质控点定义 ==================== */
  /* 三个质控点。P1 = 指标一（MDT 讨论率）；P2 是指标二的前置判定；
     P3 = 指标二（MDT 结论执行率）。id 用于详情页规则块展示，short 用于表格列头。 */
  var POINTS = [
    {
      id: 'P1', key: 'entered', short: '讨论率', name: '该讨论的讨论了没',
      metric: 'MDT 讨论率',
      num: '完成有效 MDT 讨论的应讨论病例数',
      den: '命中入组规则的应讨论病例总数',
      grade: 'B',
      basis: '《国家医疗质量安全改进目标》配套指标「疑难病例讨论完成率」；国家癌症中心 2026 年工作要点推进 MDT 规范化',
      rule: { code: 'QC-MDT-001', name: '应讨论病例须完成 MDT 讨论', cond: '命中入组规则 ⇒ 存在有效 MDT 讨论记录（含主持人小结）', field: '入组条件 / MDT 记录 / 主持人小结' },
      note: '国家尚未发布肿瘤 MDT 专项指标，本率借用「疑难病例讨论完成率」口径'
    },
    {
      id: 'P2', key: 'conclusion', short: '结论明确率', name: '结论靠不靠得住',
      metric: 'MDT 结论明确率',
      num: '结论落到具体治疗方案的病例数',
      den: '已完成 MDT 讨论的病例数',
      grade: 'A',
      basis: '《病历书写基本规范》：疑难病例讨论记录须记载具体讨论意见及主持人小结意见',
      rule: { code: 'QC-MDT-002', name: '结论须落到具体治疗方案', cond: '结论含治疗方式（手术/化疗/放疗/靶向/免疫/内分泌/观察）且非空泛表述', field: 'MDT 结论 / 主持人小结' },
      note: '空泛表述示例：「建议进一步检查」「建议积极治疗」「完善检查后诊治」'
    },
    {
      id: 'P3', key: 'executed', short: '执行率', name: '结论执行了没',
      metric: 'MDT 结论执行率',
      num: '实际治疗与结论一致（或变更已说明）的病例数',
      den: '已完成 MDT 讨论且已有治疗记录的病例数',
      grade: 'A',
      basis: 'T/CHAS 10-3-6—2023《中国医院质量安全管理 第3-6部分：医疗保障 多学科联合诊疗(MDT)》5.3 方案实施与随访',
      rule: { code: 'QC-MDT-003', name: '结论须被执行', cond: '实际治疗 = 结论方案；不一致时须有变更说明与再讨论记录', field: 'MDT 结论 / 治疗记录 / 变更说明' },
      note: '未到治疗阶段的病例不进分母（分母 = 已有治疗记录者）'
    }
  ];

  /* 对外指标 = 质控点的子集，页面一指标一页只认这两项 */
  var IND = [
    { id: 'MDT-01', point: 'P1', name: 'MDT 讨论率', short: '讨论率', dir: 'up', ref: 80 },
    { id: 'MDT-02', point: 'P3', name: 'MDT 结论执行率', short: '结论执行率', dir: 'up', ref: 85 }
  ];
  /* 按指标 id 或质控点 id 查（渲染层两种都会传：P.ind 是指标 id，
     详情页按质控点查）。传入 'P1'/'P3' 时按 point 匹配，'MDT-0x' 时按 id 匹配。 */
  function indOf(x) {
    if (!x) return null;
    for (var i = 0; i < IND.length; i++) if (IND[i].id === x || IND[i].point === x) return IND[i];
    return null;
  }
  function pointOf(indId) {
    for (var i = 0; i < IND.length; i++) if (IND[i].id === indId) return IND[i].point;
    return 'P1';
  }

  /* ==================== 3. 判定四态（沿用全站口径，不新增第五态） ==================== */
  var V = { OK: 'ok', BAD: 'bad', MISS: 'miss', ABN: 'abn' };
  var V_LABEL = { ok: '符合', bad: '不符合', miss: '数据缺失', abn: '数据异常' };

  /* ==================== 4. 确定性生成工具 ==================== */
  function hash(s) {
    var h = 2166136261, i;
    s = String(s == null ? '' : s);
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function rnd01(s) { return (hash(s) % 100000) / 100000; }
  function rndInt(s, a, b) { return a + (hash(s) % (b - a + 1)); }
  function pick(list, s) { return list[hash(s) % list.length]; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* ==================== 4b. 报告期（统计年度）绑定 ====================
     与 qcSpine.setPeriod 同一套语义：所有种子键都带报告期，换年度数字确实变化；
     病例诊断日期落在报告期年内。渲染层每次渲染前调用 setPeriod(P.year)。 */
  var PERIOD = '2026';
  function setPeriod(y) {
    y = String(y == null ? '' : y);
    if (!/^\d{4}$/.test(y)) return false;
    if (y === PERIOD) return true;
    PERIOD = y;
    POOL = null; POOL_KEY = '';      /* 池子含年度种子，必须整体作废 */
    return true;
  }
  function getPeriod() { return PERIOD; }
  /* 以指定年度口径求一次结果，返回后还原（纯函数用法，供同比调用） */
  function forYear(year, fn) {
    var old = PERIOD; PERIOD = String(year);
    try { return fn(); } finally { PERIOD = old; }
  }
  /* 种子键统一入口：所有生成种子都从这里过，保证年度一定进键 */
  function sk() {
    var parts = [PERIOD];
    for (var i = 0; i < arguments.length; i++) parts.push(arguments[i]);
    return parts.join('|');
  }

  /* ==================== 5. MDT 记录构造 ==================== */
  var SURNAMES = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '陈', '林', '黄', '徐', '邓', '罗'];
  var GIVEN = ['建国', '秀英', '志强', '桂英', '海燕', '文博', '玉梅', '云飞', '雅琴', '俊杰', '淑珍', '明辉'];
  var EXPERTS = ['王振华', '李国平', '张明远', '陈立新', '刘雅琴', '黄志强', '周文博', '吴海燕'];
  var DEPT_OF_CANCER = {
    C34: ['胸外科', '肿瘤内科', '放疗科', '影像科', '病理科'],
    C50: ['乳腺外科', '肿瘤内科', '放疗科', '影像科', '病理科'],
    C18: ['胃肠外科', '肿瘤内科', '放疗科', '影像科', '病理科'],
    C16: ['胃肠外科', '肿瘤内科', '影像科', '病理科'],
    C22: ['肝胆外科', '肿瘤内科', '介入科', '影像科', '病理科'],
    C15: ['胸外科', '肿瘤内科', '放疗科', '影像科', '病理科']
  };
  /* 治疗方式字典（结论必须落到这里面的某一项） */
  var TREAT_MODES = ['手术切除', '新辅助化疗', '辅助化疗', '同步放化疗', '根治性放疗', '靶向治疗', '免疫治疗', '内分泌治疗', 'TACE', '消融治疗', '最佳支持治疗'];
  /* 空泛结论文本（用于生成不合格记录，判为「不符合」） */
  var VAGUE_CONCLUSIONS = [
    '建议进一步检查后明确诊治方案',
    '建议积极治疗后随访观察',
    '完善相关检查后进一步诊治',
    '同意各科意见，继续目前治疗'
  ];

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

  /* 命中入组规则：按癌种 + 期别判定。每个「机构×癌种×序号」确定性命中。 */
  function enterRulesOf(cancerId, seq) {
    return ENTER_RULES.filter(function (r) {
      if (r.cancer !== '*' && r.cancer !== cancerId) return false;
      /* 全癌种规则（再次手术/死亡）命中率约 8% / 5% */
      if (r.cancer === '*') {
        var p = r.id === 'EN-ALL-1' ? 0.08 : 0.05;
        return rnd01(sk('allrule', r.id, seq)) < p;
      }
      /* 癌种规则：约 62% 的病例命中至少一条（局部晚期占比的粗略近似） */
      return rnd01(sk('ent', r.id, seq)) < 0.62;
    });
  }

  /* 单条 MDT 记录的判定：三个质控点各自四态
     entered  ：是否完成有效讨论（P1，仅对应讨论病例有意义）
     conclusion：结论是否明确（P2）
     executed ：是否执行（P3）
     overall  ：三者的合成结论，供列表「质控结果」列使用 */
  function judgeRecord(rec) {
    var out = {};

    /* P1：是否完成有效讨论 = 有记录 且 有主持人小结
       （基本规范强制项：无主持人小结视为讨论未有效完成）
       只有命中入组规则的病例才进 P1 分母 —— 未命中却自选了 MDT 的病例属"多做"，
       不评价其讨论质量，也不进 P2/P3，否则会把分子撑到比分母还大。 */
    if (!rec.hasRecord) {
      out.entered = { v: rec.enteredRuleHit ? V.MISS : V.OK, reason: rec.enteredRuleHit ? '命中入组规则但无 MDT 讨论记录' : '' };
    } else if (!rec.hasSummary) {
      out.entered = { v: rec.enteredRuleHit ? V.MISS : V.OK, reason: rec.enteredRuleHit ? 'MDT 记录缺少主持人小结意见' : '' };
    } else {
      out.entered = { v: V.OK, reason: '' };
    }

    /* P2：结论是否明确 —— 只评价命中入组规则且已完成有效讨论的病例 */
    var inP2 = rec.enteredRuleHit && out.entered.v === V.OK;
    if (!inP2) {
      out.conclusion = { v: V.OK, reason: '' };   /* 不进 P2 分母 */
    } else if (!rec.conclusion) {
      out.conclusion = { v: V.MISS, reason: '未填写 MDT 结论' };
    } else if (rec.vague) {
      out.conclusion = { v: V.BAD, reason: '结论过于空泛，未落到具体治疗方案：' + rec.conclusion };
    } else {
      out.conclusion = { v: V.OK, reason: '' };
    }

    /* P3：结论是否执行 —— 只评价 P2 通过且已到治疗阶段的病例 */
    var inP3 = inP2 && out.conclusion.v === V.OK && rec.treated;
    if (!inP3) {
      out.executed = { v: V.OK, reason: '' };
    } else if (rec.execMismatch) {
      out.executed = { v: rec.hasChangeNote ? V.ABN : V.BAD, reason: rec.hasChangeNote ? '治疗与结论不一致，已附变更说明（待复核）' : '实际治疗与 MDT 结论不一致，且无变更说明' };
    } else {
      out.executed = { v: V.OK, reason: '' };
    }

    /* 合成：取最严重的那个（缺失 > 不符合 > 异常，异常单列） */
    var order = [out.entered, out.conclusion, out.executed];
    var bad = order.filter(function (x) { return x.v === V.BAD; })[0];
    var miss = order.filter(function (x) { return x.v === V.MISS; })[0];
    var abn = order.filter(function (x) { return x.v === V.ABN; })[0];
    var top = miss || bad || abn;
    out.overall = top ? top.v : V.OK;
    out.reason = top ? top.reason : '';
    return out;
  }

  /* ==================== 6. 病例池构造 ==================== */
  /* 每个「机构 × 癌种 × 序号」是一条候选病例；
     命中入组规则的进入分母，其中一部分真的开了 MDT。
     规模控制在页面可渲染的范围（每机构每癌种 24 条）。 */
  var PER_CELL = 24;
  var POOL = null;
  var POOL_KEY = '';

  function buildPool() {
    var orgs = S.ORGS, cancers = S.CANCERS;
    var out = [];
    orgs.forEach(function (o) {
      cancers.forEach(function (c) {
        /* MDT 只覆盖有明确指南推荐的癌种（其余癌种命中率极低，不入池） */
        var hasRules = ENTER_RULES.some(function (r) { return r.cancer === c.id || r.cancer === '*'; });
        if (!hasRules) return;
        for (var s = 0; s < PER_CELL; s++) {
          /* key 只标识「机构×癌种×序号」这个病例位，不带年度；
             所有随机种子一律走 sk()，年度进键，换年度数字确实变化。 */
          var key = 'MDT|' + o.id + '|' + c.id + '|' + s;
          var hits = enterRulesOf(c.id, key);
          var hit = hits.length > 0;
          /* 命中入组规则的病例，约 86% 真的开了 MDT（剩下的是"应讨论未讨论"） */
          var hasRecord = hit ? rnd01(sk('has', key)) < 0.86 : rnd01(sk('has', key)) < 0.05;
          if (!hasRecord && !hit) continue;   /* 既不该讨论也没讨论：不进池 */

          var diagDate = dateStr(sk('dg', key), +PERIOD, +PERIOD);
          var applyDate = addDays(diagDate, rndInt(sk('ap', key), 2, 9));
          var sessionDate = addDays(applyDate, rndInt(sk('ss', key), 0, 9));
          var treatDate = addDays(sessionDate, rndInt(sk('td', key), 3, 20));

          /* 记录是否真有 —— 各质控点的不合格比例 */
          var hasSummary = hasRecord ? rnd01(sk('sum', key)) >= 0.10 : false;
          var vague = hasRecord ? rnd01(sk('vg', key)) < 0.17 : false;
          var conclIdx = rndInt(sk('ci', key), 0, TREAT_MODES.length - 1);
          var conclusion = hasRecord
            ? (vague ? pick(VAGUE_CONCLUSIONS, sk('vg', key)) : TREAT_MODES[conclIdx])
            : '';
          /* 已到治疗阶段的比例（约 78%），决定 P3 是否进分母 */
          var treated = hasRecord && rnd01(sk('tr', key)) < 0.78;
          var execMismatch = treated && rnd01(sk('em', key)) < 0.14;
          var hasChangeNote = execMismatch && rnd01(sk('cn', key)) < 0.40;

          var depts = DEPT_OF_CANCER[c.id] || ['肿瘤内科', '影像科', '病理科'];
          var attendN = rndInt(sk('an', key), 3, depts.length);

          var rec = {
            key: key,
            id: 'JX' + rndInt(sk('no', key), 100000, 999999),
            mrn: 'MRN' + rndInt(sk('mr', key), 1000000, 9999999),
            ipNo: 'ZY' + rndInt(sk('ip', key), 200000, 299999),
            name: pick(SURNAMES, sk('sn', key)) + pick(GIVEN, sk('gn', key)),
            sex: ['C50', 'C53'].indexOf(c.id) >= 0 ? '女' : '男',
            age: rndInt(sk('age', key), 36, 80),
            org: o.id, orgName: o.name, city: o.city, cityName: S.cityName(o.city),
            cancer: c.id, cancerName: c.name,
            diagDate: diagDate,
            stage: pick(['IA', 'IB', 'IIA', 'IIB', 'IIIA', 'IIIB', 'IIIC', 'IV'], sk('st', key)),
            /* 入组相关 */
            enteredRuleHit: hit,
            enteredRules: hits.map(function (r) { return r.name; }),
            enteredRuleIds: hits.map(function (r) { return r.id; }),
            /* MDT 记录 */
            hasRecord: hasRecord,
            mdtNo: hasRecord ? ('MDT' + rndInt(sk('mn', key), 20260000, 20269999)) : '',
            applyDate: hasRecord ? applyDate : '',
            applyDept: pick(depts, sk('ad', key)),
            applyReason: hasRecord ? pick([
              '明确 IIIA 期肺癌新辅助方案选择', '直肠癌局部进展期是否需要术前放化疗',
              '乳腺癌新辅助方案与手术时机', '胃癌腹膜转移综合治疗策略',
              '肝癌不可切除需在 TACE 与靶向间决策', '食管癌新辅助与手术范围'
            ], sk('ar', key)) : '',
            sessionDate: hasRecord ? sessionDate : '',
            host: hasRecord ? pick(EXPERTS, sk('hs', key)) + '（' + pick(['主任医师', '副主任医师'], sk('ht', key)) + '）' : '',
            attendDepts: hasRecord ? depts.slice(0, attendN) : [],
            hasSummary: hasSummary,
            summary: hasSummary ? '主持人意见：经各学科讨论，结合患者分期与体能状态，形成上述一致意见' : '',
            conclusion: conclusion,
            vague: vague,
            /* 执行 */
            treated: treated,
            treatDate: treated ? treatDate : '',
            actualTreat: treated ? (execMismatch ? pick(TREAT_MODES.filter(function (m) { return m !== conclusion; }), sk('at', key)) : conclusion) : '',
            execMismatch: execMismatch,
            hasChangeNote: hasChangeNote,
            changeNote: hasChangeNote ? '患者拒绝原方案，经再次讨论调整为现方案' : ''
          };
          rec.judge = judgeRecord(rec);
          rec.v = rec.judge.overall;
          rec.verdictText = V_LABEL[rec.v];
          rec.reason = rec.judge.reason;
          out.push(rec);
        }
      });
    });
    return out;
  }

  function pool() {
    /* 缓存键必须带报告期：setPeriod 已作废 POOL，这里是第二道保险 */
    var k = PERIOD + '|' + S.ORGS.length + 'x' + S.CANCERS.length;
    if (!POOL || POOL_KEY !== k) { POOL = buildPool(); POOL_KEY = k; }
    return POOL;
  }

  /* ==================== 6b. 分母归属（唯一判定口径） ====================
   * 谁进哪个质控点的分母，全模块只认这三个函数，避免列表 / 页签计数 / 指标 /
   * 交叉表各写一套条件导致数字对不上。
   *   inP1: 命中入组规则                     → 应该讨论
   *   inP2: inP1 且完成有效讨论（含主持人小结） → 可以评价结论质量
   *   inP3: inP2 且结论明确且已到治疗阶段      → 可以评价执行
   * 未命中入组规则却自选了 MDT 的病例（"多做"），不进任何分母。 */
  function inP1(r) { return !!r.enteredRuleHit; }
  function inP2(r) { return inP1(r) && r.judge.entered.v === V.OK; }
  function inP3(r) { return inP2(r) && r.judge.conclusion.v === V.OK && !!r.treated; }

  /* ==================== 7. 查询 API ==================== */
  function matchScope(r, opt) {
    opt = opt || {};
    if (opt.city && r.city !== opt.city) return false;
    if (opt.county && r.county !== opt.county) return false;
    if (opt.orgIds && opt.orgIds.length && opt.orgIds.indexOf(r.org) < 0) return false;
    if (opt.cancerIds && opt.cancerIds.length && opt.cancerIds.indexOf(r.cancer) < 0) return false;
    return true;
  }

  /* 单指标（对外两个）：value + 分子分母 + 达标判定。
     pass 走参考线 ref（本模块无国家专项指标，ref 是院内参考值，
     界面只给「达标 / 未达标」结论，不展示参考线来源）。 */
  function indAgg(indId, orgIds, cancerIds) {
    var m = metrics({ orgIds: orgIds || null, cancerIds: cancerIds || null });
    var d = m[pointOf(indId)];
    var meta = indOf(pointOf(indId));
    return {
      ind: indId, num: d.num, den: d.den, value: d.value,
      period: PERIOD,
      pass: d.value != null && !!meta && d.value >= meta.ref
    };
  }

  /* 指标计算：按质控点分别算分子分母。分母归属见 6b。 */
  function metrics(opt) {
    opt = opt || {};
    var rows = pool().filter(function (r) { return matchScope(r, opt); });

    /* P1 讨论率 */
    var p1den = rows.filter(inP1);
    var p1num = p1den.filter(function (r) { return r.judge.entered.v === V.OK; });

    /* P2 结论明确率 */
    var p2den = rows.filter(inP2);
    var p2num = p2den.filter(function (r) { return r.judge.conclusion.v === V.OK; });

    /* P3 执行率：分母 = 已讨论 + 结论明确 + 已到治疗阶段；分子 = 治疗一致 */
    var p3den = p2num.filter(function (r) { return r.treated; });
    var p3num = p3den.filter(function (r) { return r.judge.executed.v === V.OK; });

    function rate(a, b) { return b > 0 ? Math.round(a / b * 1000) / 10 : null; }

    return {
      P1: { num: p1num.length, den: p1den.length, value: rate(p1num.length, p1den.length) },
      P2: { num: p2num.length, den: p2den.length, value: rate(p2num.length, p2den.length) },
      P3: { num: p3num.length, den: p3den.length, value: rate(p3num.length, p3den.length) },
      total: rows.length
    };
  }

  /* 列表：按质控点或判定态筛选，带分页 */
  function cases(opt) {
    opt = opt || {};
    var rows = pool().filter(function (r) { return matchScope(r, opt); });
    if (opt.point) {
      var pk = { P1: 'entered', P2: 'conclusion', P3: 'executed' }[opt.point];
      if (pk) {
        /* 只看该质控点真正进分母的病例（口径见 6b，与指标计算同一套判定） */
        var inDen = { P1: inP1, P2: inP2, P3: inP3 }[opt.point];
        if (inDen) rows = rows.filter(inDen);
        if (opt.verdict && opt.verdict !== 'ALL') rows = rows.filter(function (r) { return r.judge[pk].v === opt.verdict; });
      }
    } else if (opt.verdict && opt.verdict !== 'ALL') {
      rows = rows.filter(function (r) { return r.v === opt.verdict; });
    }
    /* 只看应讨论未讨论（最高优先级的问题清单） */
    if (opt.missingOnly) rows = rows.filter(function (r) { return r.judge.entered.v === V.MISS; });
    /* 排序：异常优先，其次诊断日期倒序 */
    rows = rows.slice().sort(function (a, b) {
      var av = a.v === V.OK ? 1 : 0, bv = b.v === V.OK ? 1 : 0;
      if (av !== bv) return av - bv;
      return a.diagDate < b.diagDate ? 1 : -1;
    });
    var total = rows.length;
    var page = opt.page || 1, per = opt.per || 20;
    var start = (page - 1) * per;
    return { rows: rows.slice(start, start + per), total: total, page: page, per: per, all: rows };
  }

  /* 各判定态计数（页签用） */
  function verdictCounts(opt) {
    opt = opt || {};
    var rows = pool().filter(function (r) { return matchScope(r, opt); });
    var point = opt.point || 'overall';
    var pk = { P1: 'entered', P2: 'conclusion', P3: 'executed' }[point];
    var inDen2 = { P1: inP1, P2: inP2, P3: inP3 }[point];
    if (inDen2) rows = rows.filter(inDen2);
    var m = { ALL: rows.length, ok: 0, bad: 0, miss: 0, abn: 0 };
    rows.forEach(function (r) {
      var v = pk ? r.judge[pk].v : r.v;
      m[v] = (m[v] || 0) + 1;
    });
    return m;
  }

  /* 按维度汇总（癌种 / 机构 / 设区市），三个质控点各一组率 */
  function byDim(dim, opt) {
    opt = opt || {};
    var rows = pool().filter(function (r) { return matchScope(r, opt); });
    var groups = {};
    rows.forEach(function (r) {
      var k, label;
      if (dim === 'cancer') { k = r.cancer; label = r.cancerName; }
      else if (dim === 'org') { k = r.org; label = r.orgName; }
      else { k = r.city; label = r.cityName; }
      if (!groups[k]) groups[k] = { key: k, label: label, rows: [] };
      groups[k].rows.push(r);
    });
    return Object.keys(groups).map(function (k) {
      var g = groups[k], rs = g.rows;
      var p1den = rs.filter(inP1);
      var p1num = p1den.filter(function (r) { return r.judge.entered.v === V.OK; });
      var p2den = rs.filter(inP2);
      var p2num = p2den.filter(function (r) { return r.judge.conclusion.v === V.OK; });
      var p3den = rs.filter(inP3);
      var p3num = p3den.filter(function (r) { return r.judge.executed.v === V.OK; });
      function rate(a, b) { return b > 0 ? Math.round(a / b * 1000) / 10 : null; }
      return {
        key: g.key, label: g.label,
        p1: { num: p1num.length, den: p1den.length, value: rate(p1num.length, p1den.length) },
        p2: { num: p2num.length, den: p2den.length, value: rate(p2num.length, p2den.length) },
        p3: { num: p3num.length, den: p3den.length, value: rate(p3num.length, p3den.length) },
        missing: p1den.filter(function (r) { return r.judge.entered.v === V.MISS; }).length,
        total: rs.length
      };
    });
  }

  /* 单个病例（详情页用） */
  function byKey(key) {
    var all = pool();
    for (var i = 0; i < all.length; i++) if (all[i].key === key) return all[i];
    return null;
  }

  /* ==================== 交叉汇总（行维度 × 列维度） ====================
   * 一张表看两维交叉：例如 行=设区市、列=癌种，格子是该组合下的三个率之一。
   * 行/列单元格各自只限定自己那一维，其余条件由 opt 传入的范围约束。
   * 维度支持：city 设区市 / org 医疗机构 / cancer 癌种 / none（不拆分）。 */
  var DIM_VALUES = {
    city: function () {
      return S.CITIES.map(function (c) { return { key: c.code, label: c.name, scope: { city: c.code } }; });
    },
    org: function (opt) {
      return S.ORGS.filter(function (o) {
        if (opt && opt.city && o.city !== opt.city) return false;
        if (opt && opt.county && o.county !== opt.county) return false;
        return true;
      }).map(function (o) {
        return { key: o.id, label: o.name, sub: o.county || o.level, scope: { org: o.id } };
      });
    },
    cancer: function () {
      /* 只列真正有 MDT 数据的癌种（入组规则覆盖的） */
      var has = {};
      pool().forEach(function (r) { has[r.cancer] = 1; });
      return S.CANCERS.filter(function (c) { return has[c.id]; }).map(function (c) {
        return { key: c.id, label: c.name, sub: c.icd, scope: { cancer: c.id } };
      });
    }
  };

  function axisOf(dim, opt) {
    if (!dim || dim === 'none') return [{ key: '__all__', label: '全部', scope: {} }];
    var fn = DIM_VALUES[dim];
    return fn ? fn(opt) : [];
  }

  /* 求交：两个轴单元 + 外部范围。空交集必须返回 ['__none__']，否则 agg 会当"不限" */
  function both(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    var out = a.filter(function (x) { return b.indexOf(x) >= 0; });
    return out.length ? out : ['__none__'];
  }

  /* 某维度值 → orgIds / cancerIds 过滤条件 */
  function scopeFilters(scope) {
    scope = scope || {};
    var ofs = null, cfs = null;
    if (scope.org) ofs = [scope.org];
    else if (scope.city) {
      ofs = S.ORGS.filter(function (o) { return o.city === scope.city; }).map(function (o) { return o.id; });
      if (!ofs.length) ofs = ['__none__'];
    }
    if (scope.cancer) cfs = [scope.cancer];
    return { ofs: ofs, cfs: cfs };
  }

  /* 单个交叉格：三个质控点各自分子分母 */
  function crossCell(rowScope, colScope, opt) {
    opt = opt || {};
    var r = scopeFilters(rowScope), c = scopeFilters(colScope);
    var ofs = both(both(r.ofs, c.ofs), opt.orgIds || null);
    var cfs = both(both(r.cfs, c.cfs), opt.cancerIds || null);
    return metrics({ orgIds: ofs, cancerIds: cfs });
  }

  /* 交叉表整表：返回行标签、列标签、单元格矩阵 + 行列合计 */
  function crossTable(rowDim, colDim, opt) {
    opt = opt || {};
    /* opt.city 是"设区市范围"，要换算成机构集合，否则 grand / 合计仍按全省算 */
    var scopeOrg = opt.orgIds || null;
    if (!scopeOrg && opt.city) {
      scopeOrg = S.ORGS.filter(function (o) {
        return o.city === opt.city && (!opt.county || o.county === opt.county);
      }).map(function (o) { return o.id; });
      if (!scopeOrg.length) scopeOrg = ['__none__'];
    }
    var base = { orgIds: scopeOrg, cancerIds: opt.cancerIds || null };

    var rows = axisOf(rowDim, opt);
    var cols = axisOf(colDim, opt);
    var body = rows.map(function (r) {
      return {
        key: r.key, label: r.label, sub: r.sub,
        cells: cols.map(function (c) { return crossCell(r.scope, c.scope, base); }),
        total: crossCell(r.scope, {}, base)
      };
    });
    var colTotals = cols.map(function (c) { return crossCell({}, c.scope, base); });
    var grand = metrics(base);
    return {
      rowDim: rowDim, colDim: colDim,
      rows: rows, cols: cols, body: body, colTotals: colTotals, grand: grand
    };
  }

  /* 入组规则按癌种分组（规则配置页展示用） */
  function enterRulesByCancer() {
    var m = {};
    ENTER_RULES.forEach(function (r) {
      var k = r.cancer;
      if (!m[k]) m[k] = [];
      m[k].push(r);
    });
    return m;
  }

  /* 同比：上一报告期同口径。无基期返回 null（不编数）。 */
  function yoy(indId, orgIds, cancerIds) {
    var cur = indAgg(indId, orgIds, cancerIds).value;
    var prev = forYear((+PERIOD) - 1, function () { return indAgg(indId, orgIds, cancerIds).value; });
    if (cur == null || prev == null) return null;
    return Math.round((cur - prev) * 10) / 10;
  }

  /* 病例级整改：与六大绩效同一台账（qcSpine.problems / addCaseProblems）。
     本模块病例不在 qcSpine 的病例池里，因此不复用 addCaseProblems（它按
     指标+病例键查 qcSpine），改走通用的 addProblemItem —— 同一存储、
     同一幂等键、同一状态流转，「整改问题」页无需区分来源。 */
  var FIX_STORE = [];
  function addProblemItem(item) {
    var idem = item.idemKey;
    for (var i = 0; i < FIX_STORE.length; i++) {
      if (FIX_STORE[i].idemKey === idem) {
        return { created: 0, existed: 1, code: FIX_STORE[i].code, total: FIX_STORE.length };
      }
    }
    var now = new Date();
    var at = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' +
      pad(now.getHours()) + ':' + pad(now.getMinutes());
    var it = {
      idemKey: idem,
      code: 'RMD' + (900000 + FIX_STORE.length + 1),
      layer: 'L1', module: 'MDT质控 · 病例整改',
      type: item.type, obj: item.obj, objId: item.objId,
      org: item.org, orgName: item.orgName, city: item.city, cityName: item.cityName,
      cancer: item.cancer, cancerName: item.cancerName,
      desc: item.desc, rule: item.rule,
      count: 1, foundDate: at.slice(0, 10), dueDate: addDays(at.slice(0, 10), 14),
      status: '待处理',
      statusLog: [{ at: at, actor: '质控人员（演示账号）', action: '纳入整改：由 MDT 病例明细创建病例级问题' }],
      severity: '预警', source: 'case',
      caseKey: item.caseKey, patient: item.patient, mrn: item.mrn, ipNo: item.ipNo
    };
    FIX_STORE.push(it);
    if (window.qcSpine && window.qcSpine.registerExternalProblems) {
      window.qcSpine.registerExternalProblems(FIX_STORE);
    }
    return { created: 1, existed: 0, code: it.code, total: FIX_STORE.length };
  }
  /* 「纳入整改」：判定为非 ok 的病例才入账；同一病例只建一条（幂等）。 */
  function remediate(caseKey) {
    var r = byKey(caseKey);
    if (!r) return { created: 0, existed: 0, total: FIX_STORE.length, error: '未找到该病例' };
    if (r.v === 'ok') return { created: 0, existed: 0, total: FIX_STORE.length, error: '该病例判定为符合，无需整改' };
    var top = judgeTop(r);
    return addProblemItem({
      idemKey: 'FIX|' + r.key,
      type: r.verdictText,
      obj: top.metric, objId: top.id,
      org: r.org, orgName: r.orgName, city: r.city, cityName: r.cityName,
      cancer: r.cancer, cancerName: r.cancerName,
      desc: r.reason || '质控判定不符合',
      rule: top.rule,
      caseKey: r.key, patient: r.name, mrn: r.mrn, ipNo: r.ipNo
    });
  }
  /* 该病例最严重的那个质控点（整改条目挂到它名下） */
  function judgeTop(r) {
    var j = r.judge || {};
    var order = [POINTS[0], POINTS[1], POINTS[2]].filter(function (pt) {
      var v = j[pt.key];
      return v && (v.v === V.MISS || v.v === V.BAD || v.v === V.ABN);
    });
    return order.length ? order[0] : POINTS[0];
  }

  window.qcMdt = {
    IND: IND, indOf: indOf, pointOf: pointOf,
    ENTER_RULES: ENTER_RULES,
    enterRulesByCancer: enterRulesByCancer,
    POINTS: POINTS,
    V: V, V_LABEL: V_LABEL,
    metrics: metrics, indAgg: indAgg, yoy: yoy,
    cases: cases, verdictCounts: verdictCounts,
    byDim: byDim, byKey: byKey,
    crossTable: crossTable, crossCell: crossCell, axisOf: axisOf,
    pool: pool,
    /* 整改闭环：病例级幂等入「整改问题」台账（与六大绩效同一存储） */
    remediate: remediate, remediationCount: function () { return FIX_STORE.length; },
    setPeriod: setPeriod, getPeriod: getPeriod,
    _reset: function () { POOL = null; POOL_KEY = ''; FIX_STORE.length = 0; }
  };
})();
