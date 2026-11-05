/* 预警检测V2：独立的本地监管演示模型，不读取旧预警数组或旧工单。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./warning-v2-catalog.js'));
  else root.WarningV2Model = factory(root.WarningV2Catalog);
})(typeof window !== 'undefined' ? window : this, function (catalog) {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const AS_OF = '2026-10-30';
  const domains = catalog.domains;
  const spec = (kind, attention, high, minN, attCount = 0, highCount = 0, extra = {}) => ({ kind, attention, high, minN, attCount, highCount, periods: 2, ...extra });
  const specs = {
    B01: spec('progress', 90, 75, 1, 50, 100),
    B02: spec('late', 20, 35, 30, 10, 20),
    B03: spec('quality', 5, 10, 100, 0, 0, { target: 55, maxUnknown: 10, highN: 100 }),
    B04: spec('low', 80, 60, 50, 20, 40),
    D01: spec('increase', 3, 5, 100, 20, 50),
    D02: spec('decrease', 5, 10, 100, 20, 40),
    D03: spec('late', 20, 35, 30, 10, 20),
    D04: spec('late', 15, 30, 30, 5, 10),
    E03: spec('low', 90, 75, 50, 10, 20),
    E06: spec('followup', 15, 30, 100, 20, 40),
    E08: spec('late', 20, 40, 30, 10, 20)
  };
  ['C01', 'C02', 'C03', 'C05', 'C06', 'C07'].forEach(id => {
    specs[id] = spec('quality', 5, 10, 30, 0, 10, { target: id === 'C07' ? 70 : 90, maxUnknown: 5, highN: 50 });
  });
  const release = {
    A: '完成专业研判、核对统计口径和异常原因后，记录研判结论及后续监测安排。',
    B: '核实原受影响队列的落实结果，并以后续独立周期的完成情况确认改善。',
    C: '经专业复核确认原判定更正，或后续两个独立周期达到有效目标且改进已核实。',
    D: '完成流向或服务原因核查，并验证后续两个独立周期的改善及原受阻路径落实情况。',
    E: '修复原数据或履职缺口，复算受影响指标并核验；来源中断不能作为解除依据。'
  };
  const releases = {
    B01:'当前应完成任务补齐，或合法任务变更经核对；保留历史滞后事实。',
    B02:'原受影响队列完成核查并落实精查，后续两个独立月度队列未按期比例＜10%。',
    B03:'后续两个独立季度达到有效目标T，或数据纠正后复核原触发不成立。',
    B04:'后续两个独立季度按期完成率≥90%，且原遗留对象已有明确落实结果。',
    C04:'按专业复核、数据复算或整改后结局评估确认，不以消除已发生死亡作为解除条件。',
    C08:'后续两个独立季度G＜10个百分点且原低位机构完成复核改善，或确认原比较口径无效并修正。',
    C09:'以原重大事件调查、协调机制认定的结束依据为准。',
    D01:'相对触发时冻结的可比基准升幅＜1.5个百分点，持续两个独立季度并完成原因核查；或核实为合理结构变化，形成明确解释并转监测。',
    D02:'相对触发时冻结的可比基准降幅＜2个百分点，持续两个独立季度并完成原因核查；或核实为合理结构变化，形成明确解释并转监测。',
    D03:'后续两个独立月度队列超期比例＜10%，且原积压路径已有落实结果。',
    D04:'后续两个独立月度队列未按期比例＜5%，且原受阻路径已有落实结果。',
    E01:'责任县区达到开展登记要求，并有核验证据。',
    E02:'连续两个应报周期有效提交且报量偏离不足20%，或核实零病例、组织变更等原因。',
    E03:'后续两个独立月度队列及时率≥95%，原超期队列已核查。',
    E04:'补正同批数据复算达到适用区间、上限或下限；或后续同口径数据达标并经核验。',
    E05:'纠正人口分母和登记范围，并重算全部受影响指标。',
    E06:'后续两个独立季度未按期比例＜10%、失访＜5%，且原遗留对象已逐类处理。',
    E07:'原受影响资料完成回写，连续7日无超过约定时限的待回写资料。',
    E08:'原逾期回溯有结果，后续两个月未完成比例＜10%。'
  };
  const rules = catalog.rules.map(r => ({ ...r, spec: specs[r.id] || null, release: releases[r.id] || release[r.domain],
    readiness: specs[r.id] ? '可试算管理条件' : '需专业来源核查', version: 1,
    excluded: r.domain === 'A' ? '核查补报、筛查扩大、人口及登记覆盖变化；统计期未完整时仅观察。'
      : r.domain === 'D' ? '核查病例组合、合理转诊、有效计划变更及跨院完成；不将省外就医直接认定不合理。'
      : r.domain === 'C' ? '按癌种、术式及治疗场景纳入；资料缺失与已核实未执行分开，保留正式分母。'
      : '按正式任务及适用队列评价；核查来源迟报、责任变更、跨院完成与合法计划调整。'
  }));
  const getRule = id => rules.find(r => r.id === id);
  const getDomain = id => domains.find(d => d.id === id);
  const pct = (n, d) => d > 0 ? n / d * 100 : null;
  const round = n => Number(n.toFixed(1));
  const pretty = n => Number.isFinite(n) ? round(n).toLocaleString('zh-CN') : '—';

  function validateParams(rule, p) {
    if (!rule.spec) return [];
    const errors = [];
    ['attention', 'high', 'minN', 'attCount', 'highCount', 'periods'].forEach(k => {
      if (!Number.isFinite(p[k]) || p[k] < 0) errors.push('参数必须为有效非负数');
    });
    if (!Number.isInteger(p.minN) || p.minN < 1 || p.minN > 1000000) errors.push('最小样本量须为1～1000000的整数');
    if (!Number.isInteger(p.periods) || p.periods < 1 || p.periods > 12) errors.push('持续期数须为1～12的整数');
    if (![p.attCount, p.highCount].every(Number.isInteger)) errors.push('人数门槛须为整数');
    if (p.attention > 100 || p.high > 100) errors.push('比例或百分点阈值不能超过100');
    const low = ['progress', 'low'].includes(p.kind);
    if (low ? p.high >= p.attention : p.high <= p.attention) errors.push(low ? '重点比例须低于关注比例' : '重点偏差须大于关注偏差');
    if (p.highCount < p.attCount) errors.push('重点人数门槛不能小于关注人数门槛');
    if (p.kind !== rule.spec.kind) errors.push('计算口径不能通过参数变更');
    if (p.maxUnknown != null && (!Number.isFinite(p.maxUnknown) || p.maxUnknown < 0 || p.maxUnknown > 100)) errors.push('待核验比例门槛须为0～100');
    if (p.highN != null && (!Number.isInteger(p.highN) || p.highN < p.minN)) errors.push('重点样本量须为不小于最小样本量的整数');
    if (p.kind === 'quality' && (!Number.isFinite(p.target) || p.target <= 0 || p.target > 100)) errors.push('请设置0～100之间的有效目标值');
    return [...new Set(errors)];
  }

  function measure(p, x) {
    const required = ['low', 'progress', 'quality', 'decrease'].includes(p.kind) ? 'completed' : 'count';
    if (x[required] == null || x[required] === '') return { error: '缺少必要的分子人数，本期不可评价' };
    const n = Number(x.n), completed = Number(x.completed || 0), count = Number(x.count || 0), unknown = Number(x.unknown || 0);
    if (!Number.isInteger(n) || n < 1) return { error: '分母为空或无效，本期不可评价' };
    for (const v of [completed, count, unknown, Number(x.lost || 0)]) {
      if (!Number.isInteger(v) || v < 0 || v > n) return { error: '人数必须为不超过分母的非负整数' };
    }
    if (x.complete === false) return { error: '数据未到齐，本期不可评价' };
    if (['quality', 'decrease'].includes(p.kind) && completed + unknown > n) return { error: '完成人数与待核验人数之和不能超过分母' };
    if (p.kind === 'increase' && count + unknown > n) return { error: '省外人数与未知去向人数之和不能超过分母' };
    if (n < p.minN) return { error: '样本量 ' + n + '，未达到 ' + p.minN + ' 的评价门槛' };
    let value, observed, people, basis, rawValue, suffix = '%';
    if (['late', 'followup'].includes(p.kind)) {
      value = pct(count, n); people = count; basis = '未按期 ' + count + ' / 应完成 ' + n;
    } else if (['low', 'progress'].includes(p.kind)) {
      value = pct(completed, n); people = n - completed; basis = '按期完成 ' + completed + ' / 应完成 ' + n;
    } else if (p.kind === 'quality') {
      if (pct(unknown, n) > p.maxUnknown) return { error: '待核验比例超过 ' + p.maxUnknown + '%，先核查数据完整性' };
      value = p.target - pct(completed + unknown, n); observed = pct(completed, n); people = n - completed - unknown;
      rawValue = p.target - observed;
      basis = '符合 ' + completed + ' / 适用 ' + n + '，待核验 ' + unknown + '；最高可能比例 ' + pretty(pct(completed + unknown, n)) + '%'; suffix = '个百分点';
    } else if (['increase', 'decrease'].includes(p.kind)) {
      const base = Number(x.baseline), baseUnknown = Number(x.baselineUnknown || 0);
      if (!Number.isFinite(base) || base < 0 || base > 100 || !Number.isFinite(baseUnknown) || baseUnknown < 0 || baseUnknown > 100) return { error: '请填写有效的同口径基期比例' };
      if (pct(unknown, n) > 5 || baseUnknown > 5) return { error: '去向可核验覆盖不足95%，先核查数据' };
      if (n - unknown < p.minN) return { error: '去向已核实人数不足 ' + p.minN + '，本期不可评价' };
      if (p.kind === 'increase') {
        value = pct(count, n) - (base * (1 - baseUnknown / 100) + baseUnknown);
        observed = pct(count, n - unknown); people = count;
        rawValue = observed - base;
        basis = '省外首治 ' + count + ' / 去向已核实 ' + (n - unknown) + '，基期 ' + pretty(base) + '%';
      } else {
        value = base * (1 - baseUnknown / 100) - pct(completed + unknown, n);
        observed = pct(completed, n - unknown); people = n - completed - unknown;
        rawValue = base - observed;
        basis = '县内完成 ' + completed + ' / 去向已核实 ' + (n - unknown) + '，基期 ' + pretty(base) + '%';
      }
      suffix = '个百分点';
    }
    const low = ['low', 'progress'].includes(p.kind);
    const hit = (v, c, high) => (low ? v < (high ? p.high : p.attention) : v >= (high ? p.high : p.attention)) && c >= (high ? p.highCount : p.attCount);
    let attention = hit(value, people, false), high = hit(value, people, true) && n >= (p.highN || p.minN);
    const primaryAttention = attention;
    let lostAttention = false;
    if (p.kind === 'followup') {
      const lost = Number(x.lost || 0), rate = pct(lost, n);
      if (lost > count) return { error: '确认失访人数不能大于到期未完成人数' };
      lostAttention = rate >= 10 && lost >= 10;
      attention ||= lostAttention; high ||= rate >= 20 && lost >= 20;
      basis += '；确认失访 ' + lost + '（' + pretty(rate) + '%）';
    }
    if (p.kind === 'progress' && Number(x.overdueDays) > 0 && people > 0) attention = true;
    if (p.kind === 'progress' && Number(x.overdueDays) > 30 && people > 0) high = true;
    const dataLimited = !attention && Number.isFinite(rawValue) && hit(rawValue, people, false);
    return { n, value, observed, people, basis, suffix, attention, high, primaryAttention, lostAttention, dataLimited, period: x.period || '', overdue: p.kind === 'progress' && Number(x.overdueDays) > 0 && people > 0 };
  }

  function evaluate(ruleId, series, override) {
    const rule = getRule(ruleId);
    if (!rule?.spec) return { level: 'OBSERVE', label: '需专业核查', reason: '本规则需要专业统计结果或业务来源，暂不在本地自动计算。', checks: [] };
    const p = { ...rule.spec, ...(override || {}) };
    const errors = validateParams(rule, p);
    if (errors.length) return { level: 'UNEVALUABLE', label: '配置无效', reason: errors.join('；'), checks: [] };
    if (!Array.isArray(series) || !series.length) return { level: 'UNEVALUABLE', label: '不可评价', reason: '缺少评价周期', checks: [] };
    const periodIndex = label => {
      let m = String(label).match(/^(\d{4})(?:年|-)第?([1-4])(?:季度|Q)$/) || String(label).match(/^(\d{4})-Q([1-4])$/);
      if (m) return {kind:'quarter', value:Number(m[1])*4+Number(m[2])};
      m = String(label).match(/^(\d{4})(?:年|-)(\d{1,2})月?$/);
      if (m && +m[2]>=1 && +m[2]<=12) return {kind:'month', value:Number(m[1])*12+Number(m[2])};
      m = String(label).match(/^(\d{4})(?:年度|年)?$/);
      return m ? {kind:'year', value:Number(m[1])} : null;
    };
    const cadence = ['B01','B02','D03','D04','E03','E08'].includes(ruleId) ? 'month' : 'quarter';
    const checks = series.map(x => {
      const index = periodIndex(x.period);
      if (!index || index.kind !== cadence) return { error: '评价周期格式或频率不符合当前' + (cadence==='month'?'月度':'季度') + '规则' };
      return measure(p, x);
    });
    const current = checks.at(-1);
    if (current.error) return { level: 'UNEVALUABLE', label: '不可评价', reason: current.error, checks };
    const recent = checks.slice(-p.periods);
    const unique = new Set(recent.map(x => x.period));
    const indices = recent.map(x => periodIndex(x.period));
    const consecutive = indices.every((v,i) => v && (!i || (v.kind===indices[i-1]?.kind && v.value===indices[i-1].value+1)));
    const sameCondition = p.kind === 'followup' ? (recent.every(x => x.primaryAttention) || recent.every(x => x.lostAttention)) : recent.every(x => x.attention);
    const sustained = recent.length === p.periods && unique.size === p.periods && consecutive && recent.every(x => !x.error) && sameCondition;
    const level = current.high ? 'HIGH' : sustained || current.overdue ? 'ATTENTION' : current.attention || current.dataLimited ? 'OBSERVE' : 'NORMAL';
    const reason = current.high ? '达到单期重点条件' : current.overdue ? '正式任务截止后仍有欠量'
      : sustained ? '连续 ' + p.periods + ' 个独立周期达到关注条件' : current.dataLimited ? '原始比例存在异常线索，但缺失保护后不足以确认，先核查来源数据' : current.attention ? '本期达到关注幅度，连续同频周期证据尚不足' : '本次未达到预警条件';
    return { level, label: { HIGH: '重点预警', ATTENTION: '关注预警', OBSERVE: '观察线索', NORMAL: '未触发' }[level], reason, checks, current, params: p };
  }

  function describe(p) {
    if (!p) return null;
    const lower = ['low', 'progress'].includes(p.kind);
    const unit = ['quality', 'increase', 'decrease'].includes(p.kind) ? '个百分点' : '%';
    const metric = p.kind === 'quality' ? '低于目标的保守差值' : p.kind === 'increase' ? '省外首治比例保守升幅' : p.kind === 'decrease' ? '县内承接比例保守降幅' : lower ? '完成 / 及时比例' : '未按期完成比例';
    const count = (n) => n ? '，且至少 ' + n + ' 人' : '';
    return { metric, unit, attention: metric + (lower ? ' < ' : ' ≥ ') + p.attention + unit + count(p.attCount) + '，连续 ' + p.periods + ' 期',
      high: metric + (lower ? ' < ' : ' ≥ ') + p.high + unit + count(p.highCount) + '，单期',
      gate: '每期适用分母 ≥ ' + p.minN + (p.highN ? '；重点分母 ≥ ' + p.highN : '') + (p.maxUnknown != null ? '；待核验 ≤ ' + p.maxUnknown + '%' : '') };
  }

  function sampleInput(id, periods = 2) {
    const p = getRule(id)?.spec;
    const base = { n: 120, completed: 90, count: 30, unknown: 0, baseline: 10, baselineUnknown: 0, lost: 0, overdueDays: 0, complete: true };
    if (p?.kind === 'quality') { base.n = 100; base.completed = p.target - 7; base.count = 0; base.unknown = 1; }
    if (p?.kind === 'increase') { base.n = 200; base.count = 28; base.completed = 0; }
    if (p?.kind === 'decrease') { base.n = 200; base.completed = 80; base.count = 0; base.baseline = 47; }
    if (p?.kind === 'progress') { base.n = 1000; base.completed = 800; base.count = 0; }
    const quarterly = ['B03','B04','D01','D02','E06'].includes(id) || id.startsWith('C');
    const size = Math.max(2, Math.min(12, Number(periods) || 2)), frequency = quarterly ? 4 : 12, end = 2026 * frequency + (quarterly ? 2 : 8);
    return Array.from({length:size}, (_, i) => {
      const index=end-(size-1-i), year=Math.floor(index/frequency), part=index%frequency+1;
      return {...base,period:year+(quarterly?'-Q'+part:'-'+String(part).padStart(2,'0'))};
    });
  }

  function seedRecords() {
    const definitions = [
      ['D01','赣州市','结直肠癌','省外首治比例明显上升', {n:420,count:69,baseline:10.8}, {n:380,count:58,baseline:10.5}, '2026年第3季度','2026年第2季度','2026-10-28','PENDING',4],
      ['C01','上饶市','肺癌','首次治疗前分期评估率持续偏低',{n:180,completed:132,unknown:2},{n:160,completed:125,unknown:1},'2026年第3季度','2026年第2季度','2026-10-27','PROCESSING',3],
      ['B01','抚州市','重点癌种','筛查项目阶段任务进度明显滞后',{n:2400,completed:1630},{n:2100,completed:1500},'2026年9月','2026年8月','2026-10-26','PENDING',5],
      ['B02','南昌市','结直肠癌','阳性人群精查按期完成持续不足',{n:120,count:30},{n:100,count:22},'2026年9月','2026年8月','2026-10-25','PROCESSING',3,'南昌县'],
      ['B03','吉安市','宫颈癌','筛查早诊成效低于阶段目标',{n:150,completed:62,unknown:2},{n:140,completed:63,unknown:1},'2026年第3季度','2026年第2季度','2026-10-24','REVIEW',4],
      ['D02','萍乡市','适宜诊疗范围','县域诊疗承接比例持续下降',{n:240,completed:98,baseline:48},{n:210,completed:88,baseline:49},'2026年第3季度','2026年第2季度','2026-10-23','PROCESSING',2],
      ['C07','南昌市','MDT适用癌种','应讨论病例MDT完成率持续偏低',{n:120,completed:54,unknown:2},{n:100,completed:58,unknown:1},'2026年第3季度','2026年第2季度','2026-10-22','PENDING',3],
      ['E03','景德镇市','全部应报肿瘤','登记报送及时性持续不足',{n:180,completed:149},{n:160,completed:139},'2026年9月','2026年8月','2026-10-21','PROCESSING',4],
      ['E06','新余市','登记随访队列','随访结局掌握持续不足',{n:200,count:45,lost:14},{n:180,count:35,lost:9},'2026年第3季度','2026年第2季度','2026-10-20','PENDING',2],
      ['D04','赣州市','肺癌','转诊接收与后续就诊衔接不足',{n:70,count:14},{n:60,count:11},'2026年9月','2026年8月','2026-10-19','REVIEW',3],
      ['C05','九江市','肺癌','首次相关用药前分子检测率持续偏低',{n:90,completed:73,unknown:1},{n:85,completed:69,unknown:1},'2026年第3季度','2026年第2季度','2026-10-18','PROCESSING',2],
      ['D03','宜春市','放疗服务','计划诊疗服务等待持续超期',{n:80,count:18},{n:70,count:16},'2026年9月','2026年8月','2026-10-17','PENDING',2],
      ['E08','吉安市','死亡回溯队列','死亡补发病回溯任务持续未完成',{n:65,count:22},{n:60,count:19},'2026年9月','2026年8月','2026-10-16','PROCESSING',3],
      ['B02','九江市','乳腺癌','筛查阳性精查衔接待持续观察',{n:40,count:10},{n:38,count:3},'2026年9月','2026年8月','2026-10-15','OBSERVING',2],
      ['B04','鹰潭市','肝癌高危人群','高危人群计划复查覆盖不足',{n:100,completed:74},{n:95,completed:70},'2026年第3季度','2026年第2季度','2026-10-14','PROCESSING',2],
      ['B02','宜春市','结直肠癌','阳性精查衔接不足已完成核查',{n:120,count:30},{n:100,count:25},'2026年6月','2026年5月','2026-07-20','CLOSED',2],
      ['E03','南昌市','全部应报肿瘤','报送及时性异常已核实修正',{n:180,completed:140},{n:160,completed:132},'2026年6月','2026年5月','2026-07-16','CLOSED',3],
      ['C03','抚州市','适用手术队列','术后病理分期待核验资料不足',{n:100,completed:74,unknown:12},{n:100,completed:72,unknown:15},'2026年第3季度','2026年第2季度','2026-10-13','OBSERVING',2]
    ];
    const records = definitions.map((a, i) => {
      const [ruleId, region, cancer, title, cur, prev, period, prior, found, status, orgCount, area] = a;
      const rule = getRule(ruleId), series = [{ ...prev, period: prior }, { ...cur, period }];
      const result = evaluate(ruleId, series);
      const r = { id: 'WV2-' + String(i + 1).padStart(4, '0'), ruleId, domain: rule.domain, region, area: area || region,
        cancer, title: (area || region) + title, period, found, orgCount, status, series, level: result.level,
        summary: result.current?.basis || result.reason, reason: result.reason, metric: result.current ? pretty(result.current.observed ?? result.current.value) + (result.current.observed != null ? '%' : result.current.suffix) : '待核验',
        owner: rule.owner, person: '', deadline: status === 'PROCESSING' ? '2026-11-06' : '', ruleSnapshot: { version: 1, params: clone(rule.spec), attention: rule.attention, high: rule.high },
        evidenceMode: '管理规则试算', impact: result.current?.people || cur.unknown || 0,
        organizations: Array.from({length: orgCount}, (_, j) => ({ name: (area || region) + ['项目牵头单位','协作机构A','协作机构B','协作机构C','协作机构D'][j], role: j === 0 ? '牵头核查' : '协同核查' })),
        logs: [{ at: found + 'T09:30:00+08:00', type: '监测发现', text: result.reason, actor: '演示监测批次' }] };
      if (status === 'PROCESSING') r.logs.push({ at: found + 'T14:00:00+08:00', type: '开始核查', text: '已登记核查要点，正在核对来源事实与涉及机构。', actor: rule.owner });
      if (status === 'REVIEW') { r.feedback = { result: '已落实改进', note: '已核对涉及机构的办理记录并补充改进材料，待专业复核确认。', evidence: '演示核查材料 / 对应业务批次', at: '2026-10-29T10:00:00+08:00' }; r.logs.push({ at: r.feedback.at, type: '提交反馈', text: r.feedback.note, actor: rule.owner }); }
      if (status === 'CLOSED') { r.closedAt = '2026-09-30T15:00:00+08:00'; r.conclusion = '经复核，来源资料已补正；后续独立周期按原口径复算达到解除条件。'; r.logs.push({ at: r.closedAt, type: '复核结束', text: r.conclusion, actor: '归口职能复核岗位' }); }
      return r;
    });
    const expert = [
      ['A02','九江市','肺癌','标化死亡率异常上升','HIGH','47.2 / 10万','较基线35.0 / 10万上升34.9%；死亡例数640，校正后q=0.018','PROCESSING',640],
      ['A03','鹰潭市','肝癌','异常集中线索需专业研判','ATTENTION','SIR 1.38','连续两年SIR为1.35、1.38；本期108例，95%区间下限1.07，q=0.023','PENDING',108],
      ['A04','赣州市','40—49岁结直肠癌','发病变化待积累观察','OBSERVE','18例','年龄段病例数不足30例，尚不满足正式评价门槛','OBSERVING',18],
      ['E07','宜春市','已核实死亡资料','死亡信息回写持续滞后','HIGH','21 / 65人','待回写比例32.3%；最长超过同步约定期限37日','PENDING',21],
      ['E05','上饶市','人口与登记范围','人口分母与登记覆盖范围不一致','ATTENTION','1项基础缺口','统计人口区划版本与登记范围不一致，相关率值暂不可评价','PROCESSING',0],
      ['E04','抚州市','登记年龄信息','登记关键年龄信息缺失集中','ATTENTION','8.0%','年龄信息缺失40 / 500条；连续两期高于本地示例上限1%至少5个百分点','PROCESSING',40]
    ];
    expert.forEach((a, i) => {
      const [ruleId, region, cancer, title, level, metric, summary, status, impact] = a, rule = getRule(ruleId);
      records.push({ id: 'WV2-' + String(101+i), ruleId, domain: rule.domain, region, area: region, cancer, title: region + (rule.domain==='A' ? cancer : '') + title,
        period: rule.domain === 'A' ? '2025年度完整数据' : '2026年10月核查批次', found: '2026-10-' + (29-i), status, level, metric, summary,
        reason: level === 'OBSERVE' ? '样本不足，保留观察' : '来自已整理的专业核查结果示例', evidenceMode: '专业来源结果示例', impact, orgCount: 2,
        owner: rule.owner, person:'', deadline: status === 'PROCESSING' ? '2026-11-05' : '',
        ruleSnapshot: { version:1, params:null, attention:rule.attention, high:rule.high },
        organizations: [{name:region+'专业技术支撑单位',role:'专业复核'},{name:region+'相关责任单位',role:'来源核查'}],
        logs:[{at:'2026-10-'+(29-i)+'T10:00:00+08:00',type:'纳入核查',text:summary,actor:'专业来源示例'}] });
    });
    return records;
  }

  function createStore(storage) {
    const key = 'jx.warning-v2.workspace.v1';
    const state = { schema:1, configs:{}, changes:{}, ruleHistory:[] };
    let storageError = '';
    try { const saved=JSON.parse(storage?.getItem(key)||'null'); if(saved?.schema===1){Object.assign(state, saved); state.configs ||= {};state.changes ||= {};state.ruleHistory ||= [];} } catch(e) { storageError = '本机记录读取失败，本次使用初始演示数据。'; }
    const persist = () => { try { storage?.setItem(key,JSON.stringify(state)); storageError=''; return true; } catch(e) {storageError='浏览器未能保存本机记录，请导出当前结果留存。';return false;} };
    const seed = seedRecords();
    const all = () => seed.map(r => ({...clone(r),...(clone(state.changes[r.id]||{}))}));
    const config = id => { const r=getRule(id); return { enabled:true, version:1, params:clone(r.spec), ...(clone(state.configs[id]||{})) }; };
    function updateConfig(id, values, note, at=new Date().toISOString()) {
      const r=getRule(id);if(!r)return{error:'规则不存在'};
      if(String(note||'').trim().length<5)return{error:'请填写至少5字的变更依据'};
      const old=config(id), params=r.spec?{...r.spec,...values.params}:null;
      const errors=validateParams(r,params);if(errors.length)return{error:errors.join('；')};
      const next={enabled:!!values.enabled,version:old.version+1,params,changedAt:at};
      state.configs[id]=next;state.ruleHistory.unshift({ruleId:id,at,note:note.trim(),before:old,after:clone(next)});persist();return{value:next};
    }
    function transition(id, action, input, at=new Date().toISOString()) {
      const r=all().find(x=>x.id===id);if(!r)return{error:'预警记录不存在'};
      if(['OBSERVE','UNEVALUABLE'].includes(r.level))return{error:'观察或不可评价记录应先核实来源，不进入整改流程'};
      const allowed={start:'PENDING',feedback:'PROCESSING',close:'REVIEW',return:'REVIEW'};
      if(r.status!==allowed[action])return{error:'记录状态已变化，请刷新后重试'};
      const note=String(input.note||'').trim(),actor=String(input.actor||r.owner).trim();
      if(note.length<8)return{error:'请填写至少8字的核查说明'};
      if(!actor)return{error:'请填写经办岗位'};
      const patch={logs:clone(r.logs)};
      if(action==='start'){
        const due=String(input.deadline||''),stamp=Date.parse(due+'T23:59:59+08:00');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==due||stamp<Date.parse(at))return{error:'请填写有效且尚未到期的核查期限'};
        Object.assign(patch,{status:'PROCESSING',person:actor,deadline:due});
      }
      if(action==='feedback'){
        if(String(input.evidence||'').trim().length<5)return{error:'请填写可追溯的材料或来源依据'};
        if(!['已落实改进','数据修正','核实不适用','转持续监测'].includes(input.result))return{error:'请选择核查结果'};
        Object.assign(patch,{status:'REVIEW',feedback:{note,evidence:input.evidence.trim(),result:input.result,at}});
      }
      if(action==='close'){
        if(!input.confirmed)return{error:'请确认已核对来源和解除依据'};
        Object.assign(patch,{status:'CLOSED',closedAt:at,conclusion:note});
      }
      if(action==='return')patch.status='PROCESSING';
      patch.logs.push({at,type:{start:'开始核查',feedback:'提交反馈',close:'复核结束',return:'退回补充'}[action],text:note,actor});
      state.changes[id]={...(state.changes[id]||{}),...patch};persist();return{value:{...r,...patch}};
    }
    return {all,config,updateConfig,transition,ruleHistory:()=>clone(state.ruleHistory),storageError:()=>storageError};
  }
  function filter(records, f={}) {
    const kw=String(f.keyword||'').trim().toLowerCase();
    return records.filter(r=>(!f.domain||r.domain===f.domain)&&(!f.region||r.region===f.region)&&(!f.level||r.level===f.level)
      &&(!f.status||(f.status==='OPEN'?r.status!=='CLOSED'&&!['OBSERVE','UNEVALUABLE'].includes(r.level):r.status===f.status))
      &&(!f.ruleId||r.ruleId===f.ruleId)&&(!f.from||r.found>=f.from)&&(!f.to||r.found<=f.to)
      &&(!kw||[r.title,r.id,r.region,r.cancer,r.owner,r.ruleId].join(' ').toLowerCase().includes(kw)))
      .sort((a,b)=>({HIGH:0,ATTENTION:1,OBSERVE:2,UNEVALUABLE:3}[a.level]+(a.status==='CLOSED'?5:0))-({HIGH:0,ATTENTION:1,OBSERVE:2,UNEVALUABLE:3}[b.level]+(b.status==='CLOSED'?5:0))||b.found.localeCompare(a.found));
  }
  function summary(list) {
    const active=list.filter(r=>r.status!=='CLOSED'&&['HIGH','ATTENTION'].includes(r.level));
    return {total:list.length,open:active.length,high:active.filter(r=>r.level==='HIGH').length,pending:active.filter(r=>r.status==='PENDING').length,
      review:active.filter(r=>r.status==='REVIEW').length,closed:list.filter(r=>r.status==='CLOSED').length,
      observe:list.filter(r=>['OBSERVE','UNEVALUABLE'].includes(r.level)).length,regions:new Set(active.map(r=>r.region)).size};
  }
  function csv(rows) {return '\uFEFF'+rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
  return {AS_OF,domains,rules,getRule,getDomain,clone,evaluate,measure,describe,validateParams,sampleInput,seedRecords,createStore,filter,summary,csv,pretty};
});
