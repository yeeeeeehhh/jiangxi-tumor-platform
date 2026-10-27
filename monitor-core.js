/* 核心预警来源适配：原生预警、原整改摘要、人工协调分别保留业务状态。 */
(function () {
  'use strict';
  const categories = [
    { id: 'REGISTRY', name: '登记监测', brief: '数据能否可信，机构报送是否持续异常' },
    { id: 'DISEASE', name: '癌情异常', brief: '发病死亡如何变化，哪些地区癌种需要核查' },
    { id: 'RISK', name: '重点风险', brief: '关键跟进是否衔接，重点问题是否得到解决' }
  ];
  const groups = [
    { id: 'QUALITY', category: 'REGISTRY', name: '数据完整性与可靠性异常', scope: '登记处、人口与登记批次', condition: '完整性、质量指标或统计基础影响癌情判断', capability: '已支持' },
    { id: 'REPORTING', category: 'REGISTRY', name: '机构持续报送异常', scope: '上报机构', condition: '连续零报、及时性不足或报送量显著偏离', capability: '已支持' },
    { id: 'TREND', category: 'DISEASE', name: '发病、死亡趋势异常', scope: '地区 × 癌种 × 周期', condition: '偏离历史基线或出现持续趋势变化', capability: '已支持 · 阶段性线索单列' },
    { id: 'CLUSTER', category: 'DISEASE', name: '重点地区、癌种异常集中', scope: '地区、癌种及人群', condition: '异常集中或构成偏离，必要年度证据需齐备', capability: '年度证据不足时观察' },
    { id: 'CONTINUITY', category: 'RISK', name: '早诊早治衔接风险', scope: '需重点跟进的患者及原任务', condition: '有明确异常事实、原计划与已核实的跟进缺口', capability: '人工核查' },
    { id: 'SERVICE', category: 'RISK', name: '诊疗服务持续异常', scope: '重点问题责任机构', condition: '重点整改超期或问题集中；省外就医变化需可靠来源', capability: '整改已汇集 · 外流数据待接入' }
  ];
  function groupOf(w) {
    if (w.coreGroup) return w.coreGroup;
    const id = w.ruleId || w.id || '';
    if (/^(B-|A-DCN-|A-FOLLOWUP-LOST|C-DENOMINATOR)/.test(id)) return 'QUALITY';
    if (/^A-(ZERO-REPORT|TIMELINESS|VOLUME-DROP|VOLUME-MOM)$/.test(id)) return 'REPORTING';
    if (/^C-(ASR-TREND|INC-RATE-DEV|MOR-RATE-DEV|MORT-TREND|QUARTER-PREVIEW)$/.test(id)) return 'TREND';
    if (/^C-(CLUSTER|AGE-PROFILE)$/.test(id)) return 'CLUSTER';
    return 'SUPPORT';
  }
  const group = id => groups.find(g => g.id === id);
  const categoryOf = w => group(groupOf(w))?.category || 'REGISTRY';
  const sourceName = w => w.sourceKind === 'qc' ? '质控整改' : w.sourceKind === 'manual' ? '人工核查 · ' + w.sourceLabel
    : categoryOf(w) === 'DISEASE' ? '统计分析' : '登记监测';
  const date = value => {
    const s = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const n = Date.parse(s + 'T00:00:00Z');
    return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === s ? n : null;
  };
  function today() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  }
  const daysPast = (value, asOf = today()) => date(value) == null || date(asOf) == null ? null : Math.floor((date(asOf) - date(value)) / 86400000);
  const config = { enabled: true, attentionDays: 7, urgentDays: 15, clusterCount: 3, clusterWindow: 30, version: 1 };
  const configLog = [];
  const sourceStore = new Map();
  const currentOrg = new Map();
  const manualStore = new Map();
  let sequence = 0;
  let sourceAvailable = true;
  let lastRead = '';
  const actor = () => window.getWarningOperator ? window.getWarningOperator() : '原型经办人';
  function qcPool() {
    if (!window.qcSpine || typeof window.qcSpine.problems !== 'function') return null;
    return window.qcSpine.problems().filter(p => p.layer === 'L1');
  }
  const problemKey = p => String(p.key || p.code);
  const openProblem = p => p.status !== '已关闭';
  const important = p => p.severity === '预警';
  function ticketState(members) {
    if (!members.length) return 'CLOSED';
    if (members.some(p => p.status === '待处理')) return 'PENDING';
    if (members.every(p => p.status === '待复核' || p.status === '已关闭')) return 'FEEDBACK';
    return 'PROCESSING';
  }
  function refs(members) {
    return members.map(p => ({
      kind: 'qc', id: problemKey(p), code: p.code, name: p.obj || p.type,
      description: p.desc, status: p.status, foundDate: p.foundDate,
      dueDate: p.dueDate, owner: p.owner, ruleCode: p.rule?.code, ruleName: p.rule?.name
    }));
  }
  function refresh() {
    const pool = qcPool();
    sourceAvailable = pool !== null;
    if (!sourceAvailable) return;
    lastRead = new Date().toISOString();
    const asOf = today();
    const orgs = new Map();
    pool.filter(p => important(p) && openProblem(p) && date(p.foundDate) !== null && date(p.foundDate) <= date(asOf)).forEach(p => {
      const key = String(p.org || p.orgName || '');
      if (!key) return;
      if (!orgs.has(key)) orgs.set(key, []);
      orgs.get(key).push(p);
    });
    const active = new Set();
    orgs.forEach((members, key) => {
      const late = members.filter(p => daysPast(p.dueDate, asOf) >= config.attentionDays);
      const recent = members.filter(p => daysPast(p.foundDate, asOf) <= config.clusterWindow);
      const clustered = recent.length >= config.clusterCount && new Set(recent.map(p => p.rule?.code || p.type)).size >= 2
        && recent.some(p => daysPast(p.dueDate, asOf) > 0);
      if (!late.length && !clustered) return;
      const selected = [...new Map(late.concat(clustered ? recent : []).map(p => [problemKey(p), p])).values()];
      let entry = sourceStore.get(currentOrg.get(key));
      if (!entry || entry.ticket.status === 'CLOSED') {
        if (!config.enabled) return;
        entry = {
          id: 'MC-QC-' + (++sequence), sourceKind: 'qc', coreGroup: 'SERVICE', type: 'KEY_RISK',
          ruleId: 'MC-SERVICE', ruleName: '重点诊疗问题持续未解决',
          targetId: key, targetLabel: selected[0].orgName, responsibleEntity: selected[0].orgName,
          regionLabel: selected[0].cityName || '', sourceRecords: [], triggerTime: new Date(),
          ruleVersion: config.version, parameterSnapshot: { ...config }, dataBatch: 'QC-' + asOf,
          dataMode: '当前原型来源', dataSource: '六大绩效 / MDT 原整改台账',
          period: asOf.slice(0, 7), observeWindow: '按原整改期限核查', snapshot: {},
          history: [], ticket: { id: 'SOURCE-' + sequence, sourceKind: 'qc', status: 'PROCESSING', history: [] }
        };
        sourceStore.set(entry.id, entry);
        currentOrg.set(key, entry.id);
        entry.history.push({ time: entry.triggerTime, action: '汇集重点整改摘要', operator: actor(), detail: '关联原整改，不新建整改工单。' });
        entry.snapshot = { 评估日: asOf, 首次关联问题: selected.map(p => p.code).join('、'), 原整改期限: selected.map(p => p.code + '：' + p.dueDate).join('；') };
      }
      active.add(entry.id);
      entry.sourceMissing = false;
      entry.sourceRecords = refs(selected);
      entry.judgeBasis = '原台账标记为“预警”的六大绩效 / MDT 问题：超过原整改期限 ' + config.attentionDays
        + ' 天，或 ' + config.clusterWindow + ' 天内至少 ' + config.clusterCount + ' 条、涉及两类且至少一条逾期。';
      const maxDelay = Math.max(0, ...selected.map(p => daysPast(p.dueDate, asOf) || 0));
      entry.severity = maxDelay >= config.urgentDays ? 'URGENT' : 'ATTENTION';
      entry.metricLabel = '关联 ' + selected.length + ' 条原整改' + (maxDelay ? '，最长超期 ' + maxDelay + ' 天' : '，问题集中');
      entry.thresholdSnapshot = '管理关注超期 ' + config.attentionDays + ' 天 / 紧急 ' + config.urgentDays + ' 天';
      entry.ticket.status = ticketState(selected);
      entry.ticket.ownerOrg = entry.responsibleEntity;
      entry.ticket.ownerRole = '原整改责任岗位';
      entry.ticket.assigneeUser = '';
      entry.ticket.slaDeadline = selected.filter(p => date(p.dueDate) !== null).map(p => p.dueDate).sort()[0] || '';
      entry.ticket.handlingNote = selected.map(p => p.code + ' · ' + p.status).join('；');
      entry.ticket.history = selected.flatMap(p => (p.statusLog || []).map(l => ({ time: l.at, action: p.code + ' · ' + l.action, operator: l.actor, detail: '来源：原整改问题' })));
      entry.sourceReadAt = lastRead;
    });
    sourceStore.forEach(entry => {
      if (active.has(entry.id) || entry.ticket.status === 'CLOSED') return;
      const members = entry.sourceRecords.map(r => pool.find(p => problemKey(p) === r.id));
      if (members.some(p => !p)) { entry.sourceMissing = true; return; }
      entry.sourceMissing = false;
      entry.sourceRecords = refs(members);
      entry.sourceReadAt = lastRead;
      const allClosed = members.every(p => !openProblem(p));
      if (!allClosed && !config.enabled) {
        entry.ticket.status = ticketState(members);
        entry.ticket.handlingNote = members.map(p => p.code + ' · ' + p.status).join('；');
        return;
      }
      entry.ticket.status = 'CLOSED';
      entry.ticket.closedAt = new Date();
      entry.ticket.closureReason = 'SOURCE';
      entry.ticket.verificationResult = allClosed ? '关联原整改均已关闭' : '当前重点纳入条件已解除，原整改继续办理';
      entry.history.push({ time: new Date(), action: '来源摘要结束', operator: '来源同步', detail: entry.ticket.verificationResult });
    });
  }
  function records(includeSupport = false) {
    const natives = window.warnings || [];
    return natives.filter(w => includeSupport || groupOf(w) !== 'SUPPORT')
      .concat([...sourceStore.values()], [...manualStore.values()]);
  }
  const find = id => records(true).find(w => w.id === id);
  function ticketFor(id) {
    const w = find(id);
    return w?.ticket || (window.tickets || []).find(t => t.warningId === id);
  }
  function candidates() {
    const tasks = (window.followupTaskData || []).map(t => ({
      key: 'followup:' + t.tid, kind: 'followup', id: t.tid, name: t.tid + ' · ' + t.name + ' · ' + t.type,
      object: t.name + ' · ' + t.diagnosis, org: t.unit, region: t.region, due: t.dueDate,
      fact: '末次随访：' + (t.lastFollowup || '—') + '；结局：' + (t.lastContactStatus || '不详') + '；任务：' + t.status,
      status: t.status, inactive: t.terminateReason === '患者死亡'
    }));
    const portraits = window.SpecialtyRiskSource?.list ? window.SpecialtyRiskSource.list().map(p => ({
      key: 'portrait:' + p.id, kind: 'portrait', id: p.id, name: p.id + ' · ' + p.patient + ' · ' + p.site,
      object: p.patient + ' · ' + p.site, org: p.hospital, region: p.region, due: '',
      fact: '来源记录：' + (p.screenResult || p.followStatus || '请查看画像核查') + '；最近随访：' + (p.lastFu || '—'),
      status: p.followStatus, inactive: p.dead
    })) : [];
    return tasks.concat(portraits);
  }
  function addManual(input) {
    const source = candidates().find(c => c.key === input.source);
    if (!source || source.inactive) return { error: '请选择有效来源记录；已死亡结案对象不纳入跟进风险。' };
    if (![input.fact, input.plan, input.gap, input.basis, input.owner].every(v => String(v || '').trim())) return { error: '请填写异常事实、原计划、跟进缺口、重点依据和责任方。' };
    if (date(input.due) === null || date(input.due) > date(today())) return { error: '请填写已到期的原计划截止日期。' };
    if (!input.confirmed) return { error: '请确认已核查后续办理和不适用情况。' };
    const key = [source.key, String(input.plan).trim(), input.due].join('|');
    const existing = [...manualStore.values()].find(w => w.businessKey === key);
    if (existing) return { id: existing.id, reused: true };
    const at = new Date(), id = 'MC-RISK-' + (++sequence);
    const w = {
      id, businessKey: key, sourceKind: 'manual', sourceLabel: source.kind === 'followup' ? '随访任务' : '患者画像',
      coreGroup: 'CONTINUITY', type: 'KEY_RISK', ruleId: 'MC-CONTINUITY', ruleVersion: 1,
      ruleName: '关键跟进衔接待核查', targetId: source.key, targetLabel: source.object,
      responsibleEntity: input.owner.trim(), regionLabel: source.region, severity: 'ATTENTION',
      metricLabel: input.fact.trim() + '；' + input.gap.trim(), thresholdSnapshot: '原计划截止 ' + input.due,
      judgeBasis: input.basis.trim(), triggerTime: at, period: today(), observeWindow: '按原计划核查',
      dataMode: '人工核查', dataSource: source.name, dataBatch: 'MANUAL-' + today(),
      parameterSnapshot: { source: source.key, plan: input.plan.trim(), due: input.due },
      sourceRecords: [{ kind: source.kind, id: source.id, name: source.name, status: source.status }],
      snapshot: { 来源记录: source.name, 来源事实: source.fact, 异常事实: input.fact.trim(), 原计划: input.plan.trim(),
        原计划截止: input.due, 核实缺口: input.gap.trim(), 重点依据: input.basis.trim(), 核查确认: '已核查后续办理及不适用情况' },
      history: [{ time: at, action: '人工纳入重点核查', operator: actor(), detail: input.basis.trim() }],
      ticket: { id: 'MANUAL-' + sequence, warningId: id, sourceKind: 'manual', status: 'PENDING', ownerOrg: input.owner.trim(),
        ownerRole: '协调责任方', slaDeadline: '', history: [], handlingNote: '核查原计划与后续衔接；原任务状态由原模块维护。' }
    };
    manualStore.set(id, w);
    return { id };
  }
  function startManual(id) {
    const w = manualStore.get(id);
    if (!w || w.ticket.status !== 'PENDING') return false;
    w.ticket.status = 'PROCESSING'; w.ticket.assigneeUser = actor();
    w.history.push({ time: new Date(), action: '开始协调核查', operator: actor(), detail: '核查原计划落实与后续衔接。' });
    return true;
  }
  function finishManual(id, result, basis) {
    const w = manualStore.get(id);
    if (!w || w.ticket.status !== 'PROCESSING') return { error: '请先开始核查。' };
    if (!String(result || '').trim() || !String(basis || '').trim()) return { error: '请填写核查结果与落实依据。' };
    Object.assign(w.ticket, { status: 'CLOSED', closedAt: new Date(), closureReason: 'REVIEWED', verificationResult: result.trim(), reviewNote: basis.trim() });
    w.history.push({ time: new Date(), action: '协调核查结束', operator: actor(), detail: result.trim() + '；依据：' + basis.trim() });
    return {};
  }
  function saveConfig(input) {
    if (![input.attentionDays, input.urgentDays, input.clusterCount, input.clusterWindow].every(n => Number.isInteger(n) && n > 0 && n <= 365)
      || input.urgentDays <= input.attentionDays || input.clusterCount < 2) return { error: '请输入有效正整数，紧急时长须大于关注时长，集中数量至少 2 条。' };
    if (!String(input.note || '').trim()) return { error: '请说明管理条件的变更原因。' };
    configLog.push({ at: new Date(), actor: actor(), before: { ...config }, note: input.note.trim() });
    Object.assign(config, { enabled: input.enabled, attentionDays: input.attentionDays, urgentDays: input.urgentDays,
      clusterCount: input.clusterCount, clusterWindow: input.clusterWindow, version: config.version + 1 });
    refresh();
    return {};
  }
  function supplementalRules() {
    return [
      { id: 'MC-CONTINUITY', ruleName: '关键跟进风险人工准入', coreGroup: 'CONTINUITY', warningType: 'KEY_RISK', dimensionScope: '有效来源、异常事实、原计划、核实缺口与责任方', conditionText: '原计划已到期，人工确认需重点协调', observeWindow: '人工核查', isEnabled: true, capability: '人工核查', history: [{ version: 1 }] },
      { id: 'MC-SERVICE', ruleName: '重点整改超期或问题集中', coreGroup: 'SERVICE', warningType: 'KEY_RISK', dimensionScope: '原台账标记为预警的六大绩效 / MDT 问题', conditionText: '超期 ' + config.attentionDays + '/' + config.urgentDays + ' 天；' + config.clusterWindow + ' 天内 ≥' + config.clusterCount + ' 条、涉及两类且有逾期', observeWindow: '刷新来源时核查', isEnabled: config.enabled, capability: sourceAvailable ? '来源汇集' : '来源暂不可用', history: Array.from({ length: config.version }, (_, i) => ({ version: i + 1 })) },
      { id: 'MC-OUTFLOW', ruleName: '重点癌种省外就医异常线索', coreGroup: 'SERVICE', warningType: 'KEY_RISK', dimensionScope: '相同口径的首治机构属地与患者队列', conditionText: '待可靠流向数据、基线与适用条件接入', observeWindow: '待接入', isEnabled: false, capability: '数据待接入', history: [] }
    ];
  }
  window.MonitorCore = {
    categories, groups, groupOf, categoryOf, sourceName, refresh, records, find, ticketFor, candidates,
    addManual, startManual, finishManual, saveConfig, supplementalRules, daysPast,
    config: () => ({ ...config }), configHistory: () => [...configLog],
    sourceStatus: () => ({ available: sourceAvailable, lastRead }),
    manualCount: () => manualStore.size
  };
})();
