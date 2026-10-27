/* 监测预警 · 三类六项核心版
 * 三个菜单：预警记录 / 预警统计 / 规则配置。所有用户同一套页面与默认范围，无角色切换、无个人待办。
 * 复用 warning-module.js 的数组、核查表单与状态机；不替换原两套页面。
 */
(function () {
  'use strict';
  const PAGE_NAMES = { 'mf-records': '预警记录', 'mf-stats': '预警统计', 'mf-rules': '规则配置' };
  const LEGACY = { 'mf-workbench': 'mf-records', 'mf-tickets': 'mf-records', 'mf-drawer-demo': 'mf-records' };
  const TYPES = ['REGISTRY_OPERATION', 'REGISTRY_QUALITY', 'DISEASE_SIGNAL'];
  const TYPES_TEXT = { REGISTRY_OPERATION: '登记运行', REGISTRY_QUALITY: '登记质量', DISEASE_SIGNAL: '癌情线索' };
  const Core = window.MonitorCore;
  TYPES_TEXT.KEY_RISK = '重点风险';
  const STATUS = { PENDING: '待接收', PROCESSING: '处理中', FEEDBACK: '待复核', CLOSED: '已结束', ESCALATED: '处理中' };
  const STATUS_TONE = { PENDING: 'blue', PROCESSING: 'blue', FEEDBACK: 'amber', CLOSED: 'green', ESCALATED: 'amber' };
  const SEVERITY = { URGENT: '紧急', ATTENTION: '关注', INFO: '提示' };
  const state = {
    page: 'mf-records', layer: 'ALL', status: 'ALL', severity: 'ALL', keyword: '', dateFrom: '', dateTo: '',
    indicator: 'ALL', sort: 'core',
    organization: '', rule: '', overdueOnly: false, pageNo: 1, pageSize: 10, advanced: false,
    statLayer: 'ALL', statFrom: '', statTo: '', statOrg: '', statOpenOnly: false,
    ruleLayer: 'ALL', ruleEnabled: 'ALL', ruleKeyword: '', rulePageNo: 1, rulePageSize: 15,
    detailId: '', logOpen: false, historyOpen: false, evidenceOpen: false,
    draftKeyword: '', draftRuleKeyword: '', observationOnly: false, noRecordOnly: false,
    logDraft: '', discardPrompt: false, detailOrigin: 'mf-records', returnScroll: 0,
    logKind: 'record', observationAction: 'WAIT_ANNUAL', annualId: ''
  };
  Object.assign(state, { category: 'ALL', coreGroup: 'ALL', source: 'ALL', includeSupport: false,
    statCategory: 'ALL', statGroup: 'ALL', ruleCategory: 'ALL', ruleGroup: 'ALL',
    expandedRules: [], riskModal: '', riskDraft: {}, sourceReturn: null, recordFocus: '' });
  let bridgeDepth = 0;
  const materials = new Map();
  const own = id => Object.prototype.hasOwnProperty.call(PAGE_NAMES, id);
  const W = () => Core.records(state.includeSupport);
  const T = () => window.tickets || [];
  const R = () => (window.rules || []).concat(Core.supplementalRules());
  const warning = id => Core.find(id);
  const ticket = id => T().find(t => t.id === id);
  const ticketOf = id => Core.ticketFor(id);
  const ruleOf = w => R().find(r => r.id === w.ruleId) || {};
  const layerName = type => TYPES_TEXT[type] || type || '';
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const time = v => { if (!v) return '—'; const d = new Date(v); return isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const shortTime = v => { const d = new Date(v); return isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const dayTime = v => { if (!v) return '—'; const d = new Date(v); return isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const dateOnly = v => { const d = new Date(v); return !v || isNaN(d.getTime()) ? '—' : d.toLocaleDateString('zh-CN'); };
  const orgOf = w => w.responsibleEntity || String(w.targetId || '').split('|')[0];
  const isOpen = t => !!t && t.status !== 'CLOSED';
  const overdue = t => isOpen(t) && !!t.slaDeadline && new Date(t.slaDeadline).getTime() < Date.now();
  const near = t => isOpen(t) && !!t.slaDeadline && !overdue(t) && new Date(t.slaDeadline).getTime() - Date.now() <= 3 * 86400000;
  const isPreview = w => !!w && w.ruleId === 'C-QUARTER-PREVIEW';
  const isObserve = w => !!w && (isPreview(w) || w.observationOnly === true);
  const needsHandling = w => !!ticketOf(w.id) && !isObserve(w) && ticketOf(w.id).status !== 'CLOSED';
  const statusMatches = (t, status) => status === 'ALL' || (status === 'PROCESSING'
    ? !!t && ['PROCESSING', 'ESCALATED'].includes(t.status) : (t ? t.status : 'NONE') === status);
  /* 核心指标：用于列表排序与「指标」筛选，避免季度线索盖住质量预警 */
  const INDICATORS = [
    ['MI', '死亡发病比 M/I', /^B-MI-/],
    ['MV', '形态学确诊 MV%', /^B-MV-/],
    ['DCO', '死亡证明来源 DCO%', /^B-DCO-/],
    ['DCN', '死亡补发病 DCN', /^(B-DCN-|A-DCN-)/],
    ['COMPLETENESS', '发病登记完整性', /^B-COMPLETENESS/],
    ['CODE', '编码与信息完整性', /^(B-UB-|B-OU-|B-AGE-)/],
    ['TREND', '发病/死亡趋势', /^(C-INC-|C-MOR-|C-ASR-|C-MORT-)/],
    ['CLUSTER', '地区聚集与构成', /^(C-CLUSTER|C-AGE-PROFILE)/],
    ['DENOM', '人口分母', /^C-DENOMINATOR/],
    ['OPERATION', '机构履职', /^A-/],
    ['ASSIGN', '接收与派单', /^ASSIGN-/],
    ['LEAD', '季度线索', /^C-QUARTER-PREVIEW/]
  ];
  const indicatorOf = w => (INDICATORS.find(x => x[2].test(w.ruleId || '')) || ['OTHER', '其他', /./])[0];
  const indicatorName = key => (INDICATORS.find(x => x[0] === key) || ['', '其他'])[1];
  const closureLabel = t => ({
    RESOLVED: '整改达标结束', FALSE_POSITIVE: '误报结束', FOLLOWUP: '转专项跟踪结束',
    REVIEWED: '核查完成', OBSERVATION: '观察结束', SOURCE: '来源状态同步结束'
  }[t?.closureReason] || '历史结束（未记录原因）');
  const operator = () => window.getWarningOperator ? window.getWarningOperator() : '原型经办人';
  const annualCandidates = w => W().filter(other => other.id !== w.id && !isObserve(other)
    && other.type === 'DISEASE_SIGNAL' && other.snapshot?.地区 === w.snapshot?.地区
    && other.snapshot?.癌种 === w.snapshot?.癌种 && other.period === String(w.period).slice(0, 4));
  function priority(w) {
    const t = ticketOf(w.id);
    const open = !!t && t.status !== 'CLOSED';
    const rank = open ? (w.severity === 'URGENT' ? 0 : w.severity === 'ATTENTION' ? 1 : 2) : 4;
    return rank + (isPreview(w) ? 0.5 : 0);
  }
  function sortByCore(a, b) {
    return priority(a) - priority(b) || new Date(b.triggerTime) - new Date(a.triggerTime);
  }
  const statusText = t => !t ? '无处理记录' : t.sourceKind === 'manual'
    ? ({ PENDING: '待核查', PROCESSING: '核查中', CLOSED: '已结束' }[t.status] || STATUS[t.status])
    : t.sourceKind === 'qc' ? ({ PENDING: '待处理', PROCESSING: '整改中' }[t.status] || STATUS[t.status]) : (STATUS[t.status] || '—');
  function notify(t, error) { if (window.toast) window.toast(t, error ? 'error' : 'success'); }
  function attrs(action, id) { return ' data-mf="' + esc(action) + '"' + (id != null && id !== '' ? ' data-id="' + esc(id) + '"' : ''); }
  function button(label, action, id, cls, disabled) { return '<button type="button" class="mf-btn ' + (cls || '') + '"' + attrs(action, id) + (disabled ? ' disabled' : '') + '>' + esc(label) + '</button>'; }
  function badge(label, tone) { return '<span class="mf-badge ' + (tone || 'gray') + '">' + esc(label) + '</span>'; }
  function sevBadge(sev) { return badge(SEVERITY[sev] || sev, sev === 'URGENT' ? 'red' : sev === 'ATTENTION' ? 'amber' : 'gray'); }
  function statusBadge(t) { return badge(statusText(t), t ? (STATUS_TONE[t.status] || 'blue') : 'gray'); }
  function typeText(type) { return '<span class="mf-type">' + esc(layerName(type)) + '</span>'; }
  function option(v, label, selected) { return '<option value="' + esc(v) + '"' + (selected === v ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function orgOptions() { return [['', '全部机构']].concat([...new Set(W().map(orgOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')).map(o => [o, o])); }

  /* ---------- 数据：统一全部记录 ---------- */
  /* 默认按核心程度排序：未结束的紧急 → 关注 → 提示，然后按触发时间倒序；
     “按时序”只保留为可选排序，避免季度线索盖住 M/I、DCN 等核心质量预警。 */
  function recordsIn(r) {
    const kw = String(r.keyword || '').trim().toLowerCase();
    return W().filter(w => {
      const t = ticketOf(w.id);
      return (!r.category || r.category === 'ALL' || Core.categoryOf(w) === r.category)
        && (!r.coreGroup || r.coreGroup === 'ALL' || Core.groupOf(w) === r.coreGroup)
        && (!r.source || r.source === 'ALL' || (w.sourceKind || 'native') === r.source)
        && (r.layer === 'ALL' || w.type === r.layer)
        && statusMatches(t, r.status)
        && (r.severity === 'ALL' || w.severity === r.severity)
        && (!r.indicator || r.indicator === 'ALL' || indicatorOf(w) === r.indicator)
        && (!r.organization || orgOf(w) === r.organization)
        && (!r.rule || w.ruleId === r.rule)
        && (!r.dateFrom || new Date(w.triggerTime) >= new Date(r.dateFrom + 'T00:00:00'))
        && (!r.dateTo || new Date(w.triggerTime) <= new Date(r.dateTo + 'T23:59:59.999'))
        && (!r.overdueOnly || (needsHandling(w) && overdue(t)))
        && (!r.statOpenOnly || needsHandling(w))
        && (!r.observationOnly || (isObserve(w) && (!t || t.status !== 'CLOSED')))
        && (!r.noRecordOnly || (!t && !isObserve(w)))
        && (!r.recordFocus || (r.recordFocus === 'open' ? needsHandling(w)
          : r.recordFocus === 'urgent' ? needsHandling(w) && w.severity === 'URGENT'
          : r.recordFocus === 'late' ? needsHandling(w) && overdue(t)
          : isObserve(w) && (!t || t.status !== 'CLOSED')))
        && (!kw || [w.id, w.ruleId, w.ruleName, w.targetId, w.targetLabel, w.metricLabel, orgOf(w), indicatorName(indicatorOf(w))]
          .concat([Core.groups.find(g => g.id === Core.groupOf(w))?.name, Core.sourceName(w)])
          .concat(t ? [t.id, t.ownerOrg, t.ownerRole] : []).join(' ').toLowerCase().includes(kw));
    }).sort(r.sort === 'time' ? ((a, b) => new Date(b.triggerTime) - new Date(a.triggerTime)) : sortByCore);
  }
  function filteredWarnings() { return recordsIn(state); }
  function summaryOf(list) {
    let open = 0; let closed = 0; let late = 0; let observation = 0; let noRecord = 0;
    list.forEach(w => {
      const t = ticketOf(w.id);
      if (t && t.status === 'CLOSED') closed++;
      else if (isObserve(w)) observation++;
      else if (t) open++;
      else noRecord++;
      if (needsHandling(w) && overdue(t)) late++;
    });
    return { total: list.length, open, closed, late, observation, noRecord };
  }

  /* ---------- 布局 ---------- */
  function head(title, desc, actions) { return '<header class="mf-head"><div><h1 class="mf-title">' + esc(title) + '</h1>' + (desc ? '<p class="mf-sub">' + esc(desc) + '</p>' : '') + '</div><div class="mf-head-actions">' + (actions || '') + '</div></header>'; }
  function card(title, body, sub) { return '<section class="mf-card"><div class="mf-card-head"><div><h2 class="mf-card-title">' + esc(title) + '</h2>' + (sub ? '<div class="mf-card-sub">' + esc(sub) + '</div>' : '') + '</div></div><div class="mf-card-body">' + body + '</div></section>'; }
  function empty(msg) { return '<div class="mf-empty">' + esc(msg || '暂无可查看的记录') + '</div>'; }
  function field(label, key, options, scope) {
    const src = scope || state; const current = src[key];
    return '<label class="mf-field"><span>' + esc(label) + '</span><select data-mf-field="' + key + '">' + options.map(o => option(o[0], o[1], current)).join('') + '</select></label>';
  }
  function dateField(label, key, scope) {
    const src = scope || state;
    return '<label class="mf-field"><span>' + esc(label) + '</span><input type="date" data-mf-field="' + key + '" value="' + esc(src[key]) + '"></label>';
  }
  function searchField(label, placeholder, id, value) { return '<label class="mf-field mf-search"><span>' + esc(label) + '</span><input id="' + id + '" type="search" value="' + esc(value) + '" placeholder="' + esc(placeholder) + '"></label>'; }
  function dateRangeField(fromKey, toKey, scope) {
    const src = scope || state;
    return '<div class="mf-field mf-range"><span>触发时间</span><div class="mf-range-inputs">'
      + '<input type="date" data-mf-field="' + fromKey + '" value="' + esc(src[fromKey]) + '" aria-label="触发时间开始">'
      + '<span class="mf-range-sep">至</span>'
      + '<input type="date" data-mf-field="' + toKey + '" value="' + esc(src[toKey]) + '" aria-label="触发时间结束">'
      + '</div></div>';
  }
  /* 筛选区固定一行：条件在前，动作跟在最后，不再单独换行 */
  function filterBox(form, rows, actions) { return '<form class="mf-filter" data-mf-form="' + form + '"><div class="mf-filter-row">' + rows + '<div class="mf-filter-actions">' + actions + '</div></div></form>'; }
  const groupName = w => Core.groups.find(g => g.id === Core.groupOf(w))?.name || '一般业务记录';
  const categoryName = id => Core.categories.find(c => c.id === id)?.name || '全部';
  function categoryTabs(key, action, list) {
    return '<div class="mf-category-tabs" role="tablist" aria-label="预警分类">' + [{ id: 'ALL', name: '全部' }].concat(Core.categories).map(c =>
      '<button type="button" role="tab" aria-selected="' + (state[key] === c.id) + '" class="' + (state[key] === c.id ? 'active' : '') + '"' + attrs(action, c.id) + '>'
      + esc(c.name) + '<span>' + (c.id === 'ALL' ? list.length : list.filter(w => Core.categoryOf(w) === c.id).length) + '</span></button>').join('') + '</div>';
  }
  function groupOptions(category) {
    return [['ALL', '全部核心事项']].concat(Core.groups.filter(g => category === 'ALL' || g.category === category).map(g => [g.id, g.name]));
  }
  function sourceUnavailable() {
    return Core.sourceStatus().available ? '' : '<div class="mf-notice warning"><strong>质控来源暂不可用</strong><span>保留最近读取的摘要，请恢复来源后刷新；当前情况尚未重新核实。</span></div>';
  }
  function recordOverview(list) {
    const s = summaryOf(list), urgent = list.filter(w => needsHandling(w) && w.severity === 'URGENT').length;
    return '<div class="mf-brief">' + [['未结束', s.open, 'focus-open'], ['紧急未结束', urgent, 'focus-urgent'], ['超时未结束', s.late, 'focus-late'], ['观察线索', s.observation, 'focus-observation']]
      .map(([label, n, action]) => '<button type="button" aria-pressed="' + (state.recordFocus === action.slice(6)) + '"' + (state.recordFocus === action.slice(6) ? ' class="active"' : '') + attrs(action) + '><span>' + label + '</span><strong>' + n + '</strong></button>').join('') + '</div>';
  }

  /* 列表“处理情况”：结论优先，其次处理人与时限；未处理时给出下一步提示 */
  function processCell(w, t) {
    if (!t) return '<div class="mf-secondary">无处理记录</div>';
    if (isObserve(w) && t.status !== 'CLOSED') return '<div class="mf-cell-sub">观察线索 · 不进入整改任务</div><div class="mf-secondary">' + esc(t.ownerRole || t.ownerOrg || '') + ' · ' + esc(shortTime(w.triggerTime)) + ' 生成</div>';
    if (t.status === 'CLOSED') return '<div class="mf-cell-sub mf-clamp1" title="' + esc(t.verificationResult || '') + '">' + esc(t.verificationResult || '已结束（无结论文字）') + '</div><div class="mf-secondary">' + esc(closureLabel(t)) + ' · ' + esc(dayTime(t.closedAt)) + '</div>';
    const person = t.assigneeUser || t.ownerRole || t.ownerOrg || '';
    if (t.status === 'FEEDBACK') return '<div class="mf-cell-sub mf-clamp1">' + esc(t.verificationResult || '已提交反馈') + '</div><div class="mf-secondary">' + esc(person) + ' · ' + esc(dayTime(t.feedbackAt)) + ' 反馈</div>';
    const due = t.slaDeadline ? '截止 ' + dayTime(t.slaDeadline) : '无需时限';
    const tone = overdue(t) ? ' mf-text-red' : near(t) ? ' mf-text-amber' : '';
    return '<div class="mf-cell-sub mf-clamp1">待' + (t.status === 'PENDING' ? '接收，接收后提交核查结论' : '提交核查结论') + '</div><div class="mf-secondary' + tone + '">' + esc(person) + ' · ' + esc(due) + '</div>';
  }

  /* ---------- 页面一：预警记录 ---------- */
  function renderRecords() {
    const list = filteredWarnings();
    const max = Math.max(1, Math.ceil(list.length / state.pageSize));
    state.pageNo = Math.min(state.pageNo, max);
    const rows = list.slice((state.pageNo - 1) * state.pageSize, state.pageNo * state.pageSize).map(w => {
      const t = ticketOf(w.id);
      const mark = !needsHandling(w) ? '' : overdue(t) ? '超时' : near(t) ? '临期' : '';
      const target = String(w.targetLabel || '').trim() === String(orgOf(w) || '').trim() ? '' : w.targetLabel;
      const person = w.sourceKind === 'qc'
        ? [...new Set(w.sourceRecords.map(r => r.owner).filter(Boolean))].join('、')
        : t?.assigneeUser || t?.ownerRole || '';
      const owner = t?.ownerOrg && t.ownerOrg !== orgOf(w) && t.ownerOrg !== person ? t.ownerOrg : '';
      return '<tr><td><div class="mf-cell-main mf-clamp2" title="' + esc(w.ruleName) + '">' + esc(w.ruleName) + '</div><div class="mf-secondary" title="触发日期">' + esc(dateOnly(w.triggerTime)) + '</div></td>'
        + '<td><div class="mf-cell-main" title="' + esc(orgOf(w)) + '">' + esc(orgOf(w)) + '</div>' + (target ? '<div class="mf-secondary mf-clamp1" title="' + esc(target) + '">' + esc(target) + '</div>' : '') + '</td>'
        + '<td class="mf-basis-cell"><div class="mf-cell-main mf-clamp2" title="' + esc(w.metricLabel || '') + '">' + esc(w.metricLabel || '—') + '</div>'
        + (!w.sourceKind && w.thresholdSnapshot ? '<div class="mf-secondary mf-clamp2">阈值 ' + esc(w.thresholdSnapshot) + '</div>' : '') + '</td>'
        + '<td>' + sevBadge(w.severity) + '</td>'
        + '<td>' + (isObserve(w) && t?.status !== 'CLOSED' ? badge('观察', 'gray') : statusBadge(t)) + (mark ? ' ' + badge(mark, mark === '超时' ? 'red' : 'amber') : '') + '</td>'
        + '<td><div class="mf-cell-sub mf-clamp2">' + esc(person || owner || t?.ownerOrg || '待确认') + '</div>' + (person && owner ? '<div class="mf-secondary mf-clamp2">' + esc(owner) + '</div>' : '') + '</td>'
        + '<td class="mf-col-actions">' + button('查看', 'open-detail', w.id, 'small primary') + '</td></tr>';
    }).join('');
    const filters = dateRangeField('dateFrom', 'dateTo')
      + field('核心事项', 'coreGroup', groupOptions(state.category))
      + field('地区 / 机构', 'organization', orgOptions())
      + field('处理状态', 'status', [['ALL', '全部状态'], ['PENDING', '待接收'], ['PROCESSING', '处理中'], ['FEEDBACK', '待复核'], ['CLOSED', '已结束']])
      + searchField('关键词', '事项、地区、机构或编号', 'mf-search', state.draftKeyword)
      + (state.advanced ? field('预警级别', 'severity', [['ALL', '全部级别'], ['URGENT', '紧急'], ['ATTENTION', '关注'], ['INFO', '提示']])
        + field('来源', 'source', [['ALL', '全部来源'], ['native', '登记 / 统计'], ['qc', '原质控整改'], ['manual', '人工核查']])
        + field('登记指标', 'indicator', [['ALL', '全部指标']].concat(INDICATORS.map(x => [x[0], x[1]])))
        + field('原业务类型', 'layer', [['ALL', '全部类型']].concat(TYPES.map(k => [k, layerName(k)])))
        + field('排序', 'sort', [['core', '紧急 / 关注优先'], ['time', '按触发时间']])
        + field('具体规则', 'rule', [['', '全部规则']].concat(R().map(r => [r.id, r.id + ' · ' + r.ruleName])))
        + '<label class="mf-check"><input type="checkbox" data-mf-check="overdueOnly"' + (state.overdueOnly ? ' checked' : '') + '> 仅看超时未结束</label>'
        + '<label class="mf-check"><input type="checkbox" data-mf-check="includeSupport"' + (state.includeSupport ? ' checked' : '') + '> 包含一般业务记录</label>' : '');
    const conditions = [
      !state.advanced && state.indicator !== 'ALL' && '指标：' + indicatorName(state.indicator),
      !state.advanced && state.layer !== 'ALL' && '类型：' + layerName(state.layer),
      !state.advanced && state.severity !== 'ALL' && '级别：' + SEVERITY[state.severity],
      !state.advanced && state.source !== 'ALL' && '来源：' + ({ native: '登记 / 统计', qc: '质控整改', manual: '人工核查' }[state.source]),
      !state.advanced && state.rule && '规则：' + state.rule,
      !state.advanced && state.overdueOnly && '仅看超时未结束',
      !state.advanced && state.includeSupport && '包含一般业务记录',
      state.statOpenOnly && '未结束记录', state.observationOnly && '观察线索', state.noRecordOnly && '无处理记录'
    ].filter(Boolean);
    const categoryList = recordsIn({ ...state, category: 'ALL', coreGroup: 'ALL', layer: 'ALL', indicator: 'ALL', rule: '',
      recordFocus: '', statOpenOnly: false, observationOnly: false, noRecordOnly: false });
    return '<div class="mf-root">' + head(PAGE_NAMES['mf-records'], '', button('刷新', 'refresh-sources', '', 'subtle') + button('纳入风险', 'new-risk', '', 'subtle') + button('导出', 'export-records', '', 'primary'))
      + categoryTabs('category', 'category', categoryList) + recordOverview(recordsIn({ ...state, recordFocus: '' })) + sourceUnavailable()
      + filterBox('records', filters, button('查询', 'query-records', '', 'primary') + button('重置', 'reset-records', '', 'subtle') + button(state.advanced ? '收起条件' : '更多条件', 'toggle-advanced', '', 'subtle'))
      + (conditions.length ? '<div class="mf-conditions"><span class="mf-secondary">当前条件</span>' + conditions.map(c => badge(c, 'blue')).join('') + button('清除条件', 'reset-records', '', 'small subtle') + '</div>' : '')
      + '<div class="mf-list-caption"><span class="mf-result-count">共 ' + list.length + ' 条记录</span></div>'
      + '<div class="mf-table-wrap"><table class="mf-table mf-record-table"><thead><tr><th>预警事项</th><th>地区 / 机构</th><th>异常依据</th><th>级别</th><th>当前情况</th><th>责任方</th><th class="mf-col-actions">操作</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="7">' + empty(state.coreGroup === 'CONTINUITY' ? '暂无符合条件的跟进风险，可依据原记录人工纳入核查。' : '暂无符合条件的核心事项') + '</td></tr>') + '</tbody></table></div>'
      + '<div class="mf-pagination"><div class="mf-toolbar">'
      + button('上一页', 'records-page', String(state.pageNo - 1), 'small', state.pageNo <= 1) + '<span class="mf-secondary">' + state.pageNo + ' / ' + max + '</span>'
      + button('下一页', 'records-page', String(state.pageNo + 1), 'small', state.pageNo >= max) + '</div></div>'
      + '<div class="mf-footnote">演示数据，刷新后恢复。</div>' + riskModal() + '</div>';
  }

  /* ---------- 页面：预警详情（隐藏页，菜单仍高亮预警记录） ---------- */
  function renderDetail() {
    const w = warning(state.detailId);
    if (!w) { state.detailId = ''; return renderRecords(); }
    const t = ticketOf(w.id);
    return '<div class="mf-root mf-detail">'
      + '<div class="mf-detail-top">' + button(state.detailOrigin === 'mf-stats' ? '← 返回统计' : '← 返回列表', 'back-records', '', 'subtle small') + '</div>'
      + '<header class="mf-head"><div><h1 class="mf-title">' + esc(w.ruleName) + '</h1><p class="mf-detail-meta">' + esc(w.id) + '</p></div></header>'
      + sourceUnavailable() + infoCard(w) + processCard(w, t) + historyCard(w, t)
      + (state.logOpen ? recordModal(w) : '') + riskModal() + '</div>';
  }
  function infoCard(w) {
    const items = [['预警对象', w.targetLabel], ['触发时间', time(w.triggerTime)], ['预警级别', SEVERITY[w.severity]],
      ...(!w.sourceKind ? [['统计周期', w.period || '—']] : []),
      [w.sourceKind ? '异常事实' : '实际值', w.metricLabel || '—'],
      ...(w.sourceKind !== 'qc' ? [[w.sourceKind ? '原计划截止' : '触发阈值', w.thresholdSnapshot || '—']] : [])];
    const rows = items.map(x => '<div class="mf-detail-field"><div class="mf-detail-label">' + esc(x[0]) + '</div><div class="mf-detail-value">' + esc(x[1]) + '</div></div>').join('');
    const trace = [['核心事项', groupName(w)], ['来源', Core.sourceName(w)], ['责任机构', orgOf(w)],
      ['纳入条件 / 观察窗口', (w.thresholdSnapshot || '—') + '；' + (w.observeWindow || '—')],
      ['触发规则版本', 'v' + (w.ruleVersion || '未记录')], ['统计批次', w.dataBatch || '未记录'],
      ['数据来源', (w.dataMode || '示例数据') + ' · ' + (w.dataSource || '未记录')],
      ['触发参数', w.parameterSnapshot ? JSON.stringify(w.parameterSnapshot) : '历史记录未记录参数'],
      ['合并命中规则', (w.matchedRuleIds || [w.ruleId]).join('、')]];
    const evidence = trace.map(([key, value]) => '<div class="mf-evidence-row"><div class="mf-detail-label">' + esc(key) + '</div><div>' + esc(value) + '</div></div>').join('')
      + Object.keys(w.snapshot || {}).map(k => '<div class="mf-evidence-row"><div class="mf-detail-label">' + esc(k) + '</div><div>' + esc(w.snapshot[k]) + '</div></div>').join('')
      + (w.evidence || []).map(e => '<div class="mf-evidence-row"><div class="mf-detail-label">' + esc(e.label) + '</div><div>' + esc(e.value) + '</div></div>').join('')
      + '<div class="mf-evidence-row"><div class="mf-detail-label">当前规则条件</div><div>' + esc(ruleCondition(ruleOf(w))) + '（当前参数；触发时条件见上方快照）</div></div>';
    return card('一、预警信息', '<div class="mf-detail-grid">' + rows + '</div>'
      + '<div class="mf-basis"><div class="mf-detail-label">判定依据</div><p>' + esc(w.judgeBasis || '未记录判定依据') + '</p></div>'
      + (w.denominatorFlag ? '<div class="mf-notice warning"><strong>人口分母待核</strong><span>触发时率值的人口分母尚待核对，不能直接用于疾病流行结论。</span></div>' : '')
      + (w.contextFlag ? '<div class="mf-notice info"><strong>情景标注</strong><span>' + esc(w.contextFlag) + '</span></div>' : '')
      + (isObserve(w) ? '<div class="mf-notice info"><strong>观察线索</strong><span>' + (w.observationStatus === 'LINKED_ANNUAL' ? '已关联年度预警，后续结论查看关联记录。' : w.observationStatus === 'ENDED' ? '观察已结束，未据此形成疾病结论。' : '待年度数据核查，未计入整改积压。') + '</span></div>' : '')
      + (w.relatedWarningId && warning(w.relatedWarningId) ? '<div class="mf-history-toggle">关联预警：' + button(w.relatedWarningId, 'open-detail', w.relatedWarningId, 'small subtle') + '</div>' : '')
      + '<div class="mf-history-toggle">' + button(state.evidenceOpen ? '收起数据依据' : '展开数据依据', 'toggle-evidence', '', 'small subtle') + '</div>'
      + (state.evidenceOpen ? '<div class="mf-evidence-block">' + (evidence || '<div class="mf-secondary">暂无快照记录</div>') + '</div>' : ''));
  }
  function processCard(w, t) {
    if (w.sourceKind === 'qc') return sourceProcessCard(w, t);
    if (w.sourceKind === 'manual') return manualProcessCard(w, t);
    if (!t) return card('二、处理情况', '<div class="mf-secondary">暂无处理记录。</div>');
    const observe = isObserve(w) && t.status !== 'CLOSED';
    const items = [['当前状态', STATUS[t.status] + (overdue(t) ? '（已超时）' : near(t) ? '（3 天内临期）' : '')],
      ['处理结论', t.verificationResult || ''], ['处理说明', t.handlingNote || ''],
      ['相关机构', t.ownerOrg], ['处理人 / 岗位', t.assigneeUser || t.ownerRole],
      ['截止时间', t.slaDeadline ? time(t.slaDeadline) : ''],
      ['反馈时间', t.feedbackAt ? time(t.feedbackAt) : ''], ['结束时间', t.status === 'CLOSED' ? time(t.closedAt) : ''],
      ['专家意见', t.expertReviewNote || ''], ['结束原因', t.status === 'CLOSED' ? closureLabel(t) : ''],
      ['复核意见', t.reviewNote || ''], ['复算结果', t.recalculation ? t.recalculation.before + ' → ' + t.recalculation.after + '；依据：' + t.recalculation.evidence : ''],
      ['专项跟踪', t.followup ? t.followup.reference + ' · ' + t.followup.owner : '']];
    const rows = items.filter(x => x[1]).map(x => '<div class="mf-detail-field"><div class="mf-detail-label">' + esc(x[0]) + '</div><div class="mf-detail-value">' + esc(x[1]) + '</div></div>').join('');
    const files = materials.get(w.id) || [];
    const upload = isOpen(t) ? '<label class="mf-material-upload"><span class="mf-btn small subtle">添加佐证材料</span><input type="file" multiple data-mf-files="' + esc(w.id) + '" accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.doc,.docx,.xls,.xlsx"><span class="mf-secondary">单件不超过 10 MB，最多 10 件</span></label>' : '';
    const fileList = files.map((f, i) => '<div class="mf-material-item"><div><strong>' + esc(f.file.name) + '</strong><div class="mf-secondary">' + (f.file.size / 1024).toFixed(1) + ' KB · ' + time(f.addedAt) + '</div></div>' + button('下载', 'download-file', w.id + '|' + i, 'small subtle') + '</div>').join('');
    let actions = button('补充处理记录', 'add-record', w.id, 'subtle');
    if (observe) actions += button('记录观察结果', 'add-observation', w.id, 'primary');
    else {
      if (t.status === 'PENDING') actions += button('接收', 'receive', t.id, 'primary');
      if (['PROCESSING', 'ESCALATED'].includes(t.status)) actions += button(t.type === 'DISEASE_SIGNAL' ? '提交研判' : '提交反馈', 'feedback', t.id, 'primary');
      if (t.status === 'FEEDBACK') actions += button('复核', 'review', t.id, 'primary');
    }
    return card('二、处理情况', '<div class="mf-detail-grid">' + rows + '</div>'
      + (files.length || upload ? '<div class="mf-sub-title">佐证材料</div>' + upload + (fileList ? '<div class="mf-material-list">' + fileList + '</div>' : '') : '')
      + (isOpen(t) ? '<div class="mf-action-row">' + actions + '</div>' : '<div class="mf-action-row">' + button('补充处理记录', 'add-record', w.id, 'subtle') + '</div><div class="mf-footnote">已结束的触发事实与结论保留，补充说明按追加记录留痕。</div>'));
  }
  function historyCard(w, t) {
    const events = (w.history || []).map(x => ({ time: x.time, action: x.action, detail: x.detail, operator: x.operator }))
      .concat(t && t.history ? t.history.map(x => ({ time: x.time, action: x.action, detail: x.detail, operator: x.operator })) : [])
      .sort((a, b) => new Date(a.time) - new Date(b.time));
    const shown = state.historyOpen ? events : events.slice(-3);
    return card('三、处理记录', (events.length ? '<ol class="mf-timeline">' + shown.map(e => '<li class="mf-timeline-item"><div class="mf-timeline-time">' + time(e.time) + (e.operator ? ' · ' + esc(e.operator) : '') + '</div><div class="mf-timeline-title">' + esc(e.action) + '</div><div class="mf-timeline-desc">' + esc(e.detail) + '</div></li>').join('') + '</ol>' : '<div class="mf-secondary">暂无处理记录。</div>')
      + (events.length > 3 ? '<div class="mf-history-toggle">' + button(state.historyOpen ? '收起记录' : '展开全部 ' + events.length + ' 条记录', 'toggle-history', '', 'small subtle') + '</div>' : ''));
  }
  function recordModal(w) {
    const observation = state.logKind === 'observation';
    return '<div class="mf-modal-mask mf-detail-layer" data-mf="close-record"><div class="mf-modal mf-root" role="dialog" aria-modal="true"><div class="mf-modal-head"><h2>' + (observation ? '记录观察结果' : '补充处理记录') + '</h2><button type="button" class="mf-close" aria-label="关闭" data-mf="close-record">×</button></div>'
      + '<div class="mf-modal-body"><label class="mf-field"><span>处理说明</span><textarea id="mf-record-note" rows="4" placeholder="说明本次查看情况、核对结果或补充事项">' + esc(state.logDraft) + '</textarea></label>'
      + (observation ? '<label class="mf-field"><span>观察去向</span><select id="mf-observation-action">'
        + [['WAIT_ANNUAL', '待年度核查'], ['LINKED_ANNUAL', '关联年度预警'], ['ENDED', '结束观察（未形成疾病结论）']].map(([key, label]) => option(key, label, state.observationAction)).join('') + '</select></label>'
        + '<label class="mf-field"><span>关联年度预警（选择关联时必填）</span><select id="mf-annual-id">' + option('', '请选择同地区、同癌种年度预警', state.annualId)
        + annualCandidates(w).map(item => option(item.id, item.id + ' · ' + item.ruleName, state.annualId)).join('') + '</select></label>' : '')
      + '<div class="mf-file-note">' + (observation ? '观察结果留痕；结束观察不会形成疾病结论。' : '仅追加说明，保留原状态和结论。') + ' 本次原型会话内演示。</div></div>'
      + (state.discardPrompt ? '<div class="mf-unsaved">处理说明尚未保存。' + button('继续编辑', 'keep-record', '', 'small subtle') + button('放弃修改', 'discard-record', '', 'small subtle') + '</div>' : '')
      + '<div class="mf-modal-foot">' + button('取消', 'close-record', '', 'subtle') + button('保存记录', 'save-record', w.id, 'primary') + '</div></div></div>';
  }
  function sourceProcessCard(w, t) {
    const rows = w.sourceRecords.map(r => '<tr><td><strong>' + esc(r.code) + '</strong><div class="mf-secondary">' + esc(r.name) + '</div></td>'
      + '<td>' + esc(r.status) + '</td><td>' + esc(r.dueDate || '—') + '</td><td>' + esc(r.owner || '原整改责任方') + '</td>'
      + '<td>' + button('去原模块处理', 'source-qc', r.code, 'small primary') + '</td></tr>').join('');
    return card('二、整改办理', (t.verificationResult ? '<p>' + esc(t.verificationResult) + '</p>' : '')
      + (w.sourceMissing ? '<div class="mf-notice warning">部分来源记录暂时找不到，当前摘要尚未确认解除。</div>' : '')
      + '<div class="mf-table-wrap mf-source-table"><table class="mf-table"><thead><tr><th>原问题 / 指标</th><th>原状态</th><th>原整改期限</th><th>责任岗位</th><th>办理</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div class="mf-action-row">' + button('刷新', 'refresh-sources', '', 'primary') + '</div>');
  }
  function manualProcessCard(w, t) {
    const source = w.sourceRecords[0];
    const current = Core.candidates().find(c => c.kind === source.kind && c.id === source.id);
    let actions = button('查看原记录', 'source-manual', w.id, 'subtle');
    if (t.status === 'PENDING') actions += button('开始核查', 'start-risk', w.id, 'primary');
    if (t.status === 'PROCESSING') actions += button('补充核查意见', 'add-record', w.id, 'subtle') + button('结束核查', 'finish-risk', w.id, 'primary');
    return card('二、协调核查', '<div class="mf-detail-grid"><div><div class="mf-detail-label">核查状态</div><div class="mf-detail-value">' + esc(statusText(t)) + '</div></div>'
      + '<div><div class="mf-detail-label">原记录当前情况</div><div class="mf-detail-value">' + esc(current?.status || '来源待核实') + '</div></div>'
      + '<div><div class="mf-detail-label">协调责任方</div><div class="mf-detail-value">' + esc(t.ownerOrg) + '</div></div>'
      + (t.verificationResult ? '<div><div class="mf-detail-label">核查结果</div><div class="mf-detail-value">' + esc(t.verificationResult) + '</div></div><div><div class="mf-detail-label">落实依据</div><div class="mf-detail-value">' + esc(t.reviewNote) + '</div></div>' : '') + '</div>'
      + '<div class="mf-action-row">' + actions + '</div>');
  }
  function riskField(label, id, key, type = 'textarea') {
    const value = state.riskDraft[key] || '';
    const control = type === 'textarea' ? '<textarea id="' + id + '" data-mf-risk="' + key + '" rows="2">' + esc(value) + '</textarea>'
      : '<input id="' + id + '" data-mf-risk="' + key + '" type="' + type + '" value="' + esc(value) + '">';
    return '<label class="mf-field"><span>' + esc(label) + '</span>' + control + '</label>';
  }
  function riskModal() {
    if (!state.riskModal) return '';
    const mode = state.riskModal, d = state.riskDraft;
    let title, body, action;
    if (mode === 'new') {
      title = '人工纳入关键跟进核查'; action = 'save-risk';
      const candidate = Core.candidates().find(c => c.key === d.source);
      body = '<label class="mf-field"><span>关联来源记录</span><select id="mf-risk-source" data-mf-risk="source">' + option('', '请选择原随访任务或患者画像', d.source)
        + Core.candidates().filter(c => !c.inactive).map(c => option(c.key, c.name, d.source)).join('') + '</select></label>'
        + (candidate ? '<div class="mf-notice info"><span>' + esc(candidate.fact) + '</span></div>' : '')
        + riskField('明确异常事实', 'mf-risk-fact', 'fact') + riskField('需落实的原计划', 'mf-risk-plan', 'plan')
        + '<div class="mf-modal-grid">' + riskField('原计划截止日期', 'mf-risk-due', 'due', 'date') + riskField('协调责任方', 'mf-risk-owner', 'owner', 'text') + '</div>'
        + riskField('已核实的跟进缺口', 'mf-risk-gap', 'gap') + riskField('需要重点关注的依据', 'mf-risk-basis', 'basis')
        + '<label class="mf-check"><input type="checkbox" id="mf-risk-confirmed" data-mf-risk="confirmed"' + (d.confirmed ? ' checked' : '') + '> 已核查后续办理、计划变更及不适用情况</label>';
    } else if (mode === 'finish') {
      title = '结束协调核查'; action = 'save-risk-result';
      body = riskField('核查结果', 'mf-risk-result', 'result') + riskField('落实依据 / 原记录引用', 'mf-risk-result-basis', 'resultBasis');
    } else if (mode === 'config') {
      title = '重点整改纳入条件'; action = 'save-risk-config';
      body = '<div class="mf-file-note">只设置重点汇集与升级条件，诊疗判定和原整改期限在来源模块维护。</div>'
        + '<div class="mf-modal-grid">' + riskField('关注：超过原期限天数', 'mf-config-attention', 'attentionDays', 'number')
        + riskField('紧急：超过原期限天数', 'mf-config-urgent', 'urgentDays', 'number')
        + riskField('集中：独立问题数量', 'mf-config-count', 'clusterCount', 'number')
        + riskField('集中：观察窗口天数', 'mf-config-window', 'clusterWindow', 'number') + '</div>'
        + '<label class="mf-check"><input type="checkbox" data-mf-risk="enabled"' + (d.enabled ? ' checked' : '') + '> 启用来源汇集（停用后保留历史摘要）</label>'
        + riskField('变更原因', 'mf-config-note', 'note');
    } else {
      const rule = R().find(r => r.id === d.ruleId);
      title = rule?.ruleName || '规则说明'; action = '';
      body = '<div class="mf-basis"><p>' + esc(rule?.conditionText || '') + '</p></div><div class="mf-notice info"><strong>' + esc(rule?.capability || '')
        + '</strong><span>' + esc(rule?.dimensionScope || '') + '</span></div>'
        + (d.ruleId === 'MC-OUTFLOW' ? '<div class="mf-file-note">当前没有可靠流向数据及比较基线，规则不执行，不生成零风险结论。</div>' : '<div class="mf-file-note">人工纳入需要有效来源、已到期计划、明确缺口、责任方与核查确认。</div>');
    }
    return '<div class="mf-modal-mask" data-mf="close-risk"><div class="mf-modal mf-root mf-risk-modal" role="dialog" aria-modal="true" aria-labelledby="mf-risk-title">'
      + '<div class="mf-modal-head"><h2 id="mf-risk-title">' + esc(title) + '</h2>' + button('关闭', 'close-risk', '', 'small subtle') + '</div>'
      + '<div class="mf-modal-body">' + body + '</div><div class="mf-modal-foot">' + button('取消', 'close-risk', '', 'subtle')
      + (action ? button('保存', action, state.detailId, 'primary') : '') + '</div></div></div>';
  }
  function openRiskModal(mode, draft = {}) {
    state.riskModal = mode; state.riskDraft = draft; renderCurrent();
    document.querySelector('.mf-risk-modal select,.mf-risk-modal textarea,.mf-risk-modal input')?.focus();
  }
  function prepareSourceReturn() {
    state.sourceReturn = { id: state.detailId, origin: state.detailOrigin, scroll: state.returnScroll };
  }
  function sourceToolbar(route) {
    if (!state.sourceReturn || !['qc-issues', 'followup-tasks', 'followup', 'sp-patients'].includes(route)) return;
    const box = document.getElementById('pageContainer');
    if (box && !box.querySelector('.mf-source-return')) box.insertAdjacentHTML('afterbegin', '<div class="mf-root mf-source-return">' + button('返回预警详情', 'return-warning', '', 'small subtle') + '<span>当前正在查看来源业务记录</span></div>');
  }

  /* ---------- 页面二：预警统计 ---------- */
  function statsList() {
    return Core.records(false).filter(w => (state.statCategory === 'ALL' || Core.categoryOf(w) === state.statCategory)
      && (state.statGroup === 'ALL' || Core.groupOf(w) === state.statGroup)
      && (state.statLayer === 'ALL' || w.type === state.statLayer) && (!state.statOrg || orgOf(w) === state.statOrg)
      && (!state.statFrom || new Date(w.triggerTime) >= new Date(state.statFrom + 'T00:00:00'))
      && (!state.statTo || new Date(w.triggerTime) <= new Date(state.statTo + 'T23:59:59.999')));
  }
  function institutionSummary(list) {
    const groups = new Map();
    list.forEach(w => { const org = orgOf(w) || '未归属'; if (!groups.has(org)) groups.set(org, []); groups.get(org).push(w); });
    return Array.from(groups, ([org, records]) => ({ org, ...summaryOf(records) }))
      .sort((a, b) => b.late - a.late || b.total - a.total);
  }
  function statusDistribution(list) {
    return ['PENDING', 'PROCESSING', 'FEEDBACK', 'CLOSED'].map(status => ({
      name: STATUS[status], action: 'drill-status', id: status,
      n: list.filter(w => (status === 'CLOSED' || !isObserve(w)) && statusMatches(ticketOf(w.id), status)).length
    })).concat({ name: '观察线索', action: 'drill-observation', n: summaryOf(list).observation },
      { name: '无处理记录', action: 'drill-no-record', n: summaryOf(list).noRecord });
  }
  function barCard(title, items) {
    const max = Math.max(1, ...items.map(x => x.n));
    return card(title, items.length ? '<div class="mf-bars">' + items.map(x => '<' + (x.action ? 'button type="button"' + attrs(x.action, x.id) : 'div') + ' class="mf-bar-row"><span class="mf-bar-label">' + esc(x.name) + '</span><span class="mf-bar-track"><span class="mf-bar-fill" style="width:' + (x.n / max * 100).toFixed(1) + '%"></span></span><strong class="mf-bar-value">' + x.n + '</strong></' + (x.action ? 'button' : 'div') + '>').join('') + '</div>' : empty('暂无记录'));
  }
  /* 处理结果明细：已结束记录写出最终结论，处理中记录写当前环节，可点击带入列表 */
  function outcomeCard(list) {
    const items = [...list].sort((a, b) => {
      const ta = ticketOf(a.id), tb = ticketOf(b.id);
      const rank = t => t && t.status === 'CLOSED' ? 0 : t && t.status === 'FEEDBACK' ? 1 : 2;
      return rank(ta) - rank(tb) || new Date(b.triggerTime) - new Date(a.triggerTime);
    }).slice(0, 8);
    const rows = items.map(w => {
      const t = ticketOf(w.id);
      const person = t ? (t.assigneeUser || t.ownerRole || t.ownerOrg || '—') : '—';
      const outcome = !t ? '无处理记录' : t.status === 'CLOSED' ? (t.verificationResult || '已结束') : t.status === 'FEEDBACK' ? (t.verificationResult || '待复核') : STATUS[t.status];
      const end = t && t.status === 'CLOSED' ? time(t.closedAt) : t && ['PROCESSING', 'ESCALATED'].includes(t.status) ? (overdue(t) ? '超时' : t.slaDeadline ? '截止 ' + dayTime(t.slaDeadline) : '—') : '—';
      return '<tr><td><button type="button" class="mf-link"' + attrs('open-detail', w.id) + '>' + esc(w.ruleName) + '</button><div class="mf-secondary mf-clamp1">' + esc(orgOf(w)) + '</div></td>'
        + '<td>' + statusBadge(t) + '</td><td><div class="mf-clamp2" title="' + esc(outcome) + '">' + esc(outcome) + '</div></td><td>' + esc(person) + '</td><td class="mf-nowrap">' + esc(end) + '</td></tr>';
    }).join('');
    return card('最近处理情况', '<div class="mf-table-wrap"><table class="mf-table mf-outcome-table"><thead><tr><th>预警事项</th><th>状态</th><th>处理结论 / 当前环节</th><th>处理人 / 岗位</th><th>完成或时限</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="5">' + empty() + '</td></tr>') + '</tbody></table></div>');
  }
  function renderStats() {
    const list = statsList();
    const s = summaryOf(list);
    const rows = institutionSummary(list).map(g => '<tr><td><button type="button" class="mf-link"' + attrs('drill-org', g.org) + '>' + esc(g.org) + '</button></td><td class="mf-num">' + g.total + '</td><td class="mf-num">' + g.open + '</td><td class="mf-num">' + g.closed + '</td><td class="mf-num">' + (g.late ? badge(String(g.late), 'red') : '0') + '</td></tr>').join('');
    const kpi = (label, value, action) => '<button type="button" class="mf-kpi"' + attrs(action) + '><span class="mf-kpi-label">' + esc(label) + '</span><strong class="mf-kpi-value">' + esc(value) + '</strong></button>';
    const filters = dateRangeField('statFrom', 'statTo') + field('机构', 'statOrg', orgOptions())
      + field('预警分类', 'statCategory', [['ALL', '全部分类']].concat(Core.categories.map(c => [c.id, c.name])))
      + field('核心事项', 'statGroup', groupOptions(state.statCategory));
    return '<div class="mf-root">' + head(PAGE_NAMES['mf-stats'], '', button('导出', 'export-stats', '', 'subtle'))
      + sourceUnavailable()
      + filterBox('stats', filters, button('查询', 'query-stats', '', 'primary') + button('重置', 'reset-stats', '', 'subtle'))
      + '<div class="mf-kpis">' + kpi('未结束事项', s.open, 'drill-open') + kpi('紧急未结束', list.filter(w => needsHandling(w) && w.severity === 'URGENT').length, 'drill-urgent') + kpi('超时未结束', s.late, 'drill-late') + '</div>'
      + '<div class="mf-stat-explanation">' + button('全部 ' + s.total, 'drill-all', '', 'small subtle')
      + button('已结束 ' + s.closed, 'drill-closed', '', 'small subtle')
      + button('观察线索 ' + s.observation, 'drill-observation', '', 'small subtle')
      + (s.noRecord ? button('无处理记录 ' + s.noRecord, 'drill-no-record', '', 'small subtle') : '') + '</div>'
      + '<div class="mf-two-col">' + barCard('三类预警分布', Core.categories.map(c => ({ name: c.name, n: list.filter(w => Core.categoryOf(w) === c.id).length, action: 'drill-category', id: c.id })))
      + barCard('当前处理状态分布', statusDistribution(list).filter(item => item.n > 0)) + '</div>'
      + card('机构重点事项', '<div class="mf-table-wrap"><table class="mf-table"><thead><tr><th>机构</th><th class="mf-num">事项数</th><th class="mf-num">未结束</th><th class="mf-num">已结束</th><th class="mf-num">超时未结束</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">' + empty('当前条件下暂无记录') + '</td></tr>') + '</tbody></table></div>')
      + '<div class="mf-stats-outcomes">' + outcomeCard(list) + '</div>'
      + '<div class="mf-footnote">超时未结束 = 未结束且有有效截止时间、已超过截止时间的记录；观察性线索不自动计入处理积压。</div></div>';
  }

  /* ---------- 页面三：规则配置 ---------- */
  function visibleRules() {
    const kw = String(state.ruleKeyword || '').trim().toLowerCase();
    return R().filter(r => (state.ruleCategory === 'ALL' || Core.categoryOf(r) === state.ruleCategory)
      && (state.ruleGroup === 'ALL' || Core.groupOf(r) === state.ruleGroup)
      && (state.ruleLayer === 'ALL' || r.warningType === state.ruleLayer)
      && (state.ruleEnabled === 'ALL' || r.isEnabled === (state.ruleEnabled === 'ON'))
      && (!kw || [r.id, r.ruleName, r.monitorPoint, groupName(r)].join(' ').toLowerCase().includes(kw)));
  }
  const ruleCondition = r => r.conditionText || String(r.thresholdValue == null ? '—' : r.thresholdValue) + (r.unit || '') + ' · 样本≥' + (r.minSampleSize == null ? '—' : r.minSampleSize);
  function ruleDetails(list) {
    const rows = list.map(r => '<tr><td><div class="mf-cell-main">' + esc(r.ruleName) + '</div><div class="mf-secondary">' + esc(r.id) + '</div></td>'
      + '<td>' + esc(r.dimensionScope || '—') + '</td><td>' + esc(ruleCondition(r)) + '</td>'
      + '<td>' + (r.id === 'MC-OUTFLOW' ? badge('待接入', 'amber') : r.isEnabled ? '启用' : badge('停用', 'gray')) + (r.pendingVersion ? '<div class="mf-secondary">参数待生效 ' + esc(r.pendingVersion.effectiveDate) + '</div>' : '') + '</td>'
      + '<td>' + button(r.id === 'MC-SERVICE' ? '管理条件' : '查看', r.id === 'MC-SERVICE' ? 'risk-config' : 'view-rule', r.id, 'small subtle') + '</td></tr>').join('');
    return '<div class="mf-rule-detail mf-table-wrap"><table class="mf-table mf-rule-table"><thead><tr><th>规则</th><th>适用对象</th><th>关键条件</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function renderRules() {
    const list = visibleRules();
    const groups = Core.groups.filter(g => (state.ruleCategory === 'ALL' || g.category === state.ruleCategory)
      && (state.ruleGroup === 'ALL' || g.id === state.ruleGroup)
      && ((!state.ruleKeyword && state.ruleEnabled === 'ALL') || list.some(r => Core.groupOf(r) === g.id)));
    const sections = groups.map(g => {
      const rules = list.filter(r => Core.groupOf(r) === g.id), expanded = !!state.ruleKeyword || state.expandedRules.includes(g.id);
      return '<section class="mf-rule-group"><div class="mf-rule-group-head"><div><h2>' + esc(g.name) + '</h2>'
        + '<p>' + esc(g.id === 'CONTINUITY' ? '人工核查原计划与跟进缺口后纳入' : g.id === 'SERVICE' ? '重点整改超期或问题集中' : g.condition) + '</p>'
        + (g.id === 'SERVICE' ? '<div class="mf-secondary">省外就医数据待接入</div>' : '')
        + (rules.length && rules.every(r => !r.isEnabled) ? badge('已停用', 'gray') : '') + '</div>'
        + '<div class="mf-toolbar">' + (g.id === 'SERVICE' ? button('管理条件', 'risk-config', '', 'small subtle') : '')
        + button(expanded ? '收起细项' : '查看细项', 'expand-rules', g.id, 'small subtle') + '</div></div>'
        + (expanded ? (rules.length ? ruleDetails(rules) : empty('暂无符合条件的细项')) : '') + '</section>';
    }).join('');
    const support = list.filter(r => Core.groupOf(r) === 'SUPPORT');
    const filters = field('预警分类', 'ruleCategory', [['ALL', '全部分类']].concat(Core.categories.map(c => [c.id, c.name])))
      + field('核心事项', 'ruleGroup', groupOptions(state.ruleCategory))
      + field('启停状态', 'ruleEnabled', [['ALL', '全部'], ['ON', '启用'], ['OFF', '停用']]) + searchField('关键词', '规则名称或编号', 'mf-rule-search', state.draftRuleKeyword);
    return '<div class="mf-root">' + head(PAGE_NAMES['mf-rules'], '', button('运行示例', 'run-rules', '', 'subtle') + button('导出', 'export-rules', '', 'primary'))
      + filterBox('rules', filters, button('查询', 'query-rules', '', 'primary') + button('重置', 'reset-rules', '', 'subtle'))
      + '<div class="mf-rule-groups">' + (sections || empty('暂无符合条件的核心规则')) + '</div>'
      + (support.length ? '<details class="mf-run-history"' + (state.ruleKeyword ? ' open' : '') + '><summary>其他业务规则（' + support.length + '）</summary>' + ruleDetails(support) + '</details>' : '')
      + runHistoryCard()
      + '<div class="mf-footnote">演示数据，刷新后恢复。</div>' + riskModal() + '</div>';
  }
  function runHistoryCard() {
    const runs = (window.warningRuns || []).slice(0, 5);
    return '<details class="mf-run-history"><summary>示例执行记录' + (runs.length ? '（最近 ' + runs.length + ' 次）' : '') + '</summary>'
      + (runs.length ? '<div class="mf-table-wrap"><table class="mf-table mf-run-table"><thead><tr><th>执行时间</th><th>结果</th><th>新增</th><th>重复命中</th><th>说明</th></tr></thead><tbody>'
        + runs.map(run => '<tr><td>' + esc(time(run.time)) + '</td><td>' + badge(run.status === 'FAILED' ? '失败' : '已完成', run.status === 'FAILED' ? 'red' : 'green') + '</td><td>' + run.newCount + '</td><td>' + run.duplicateCount + '</td><td>' + esc(run.error || '示例数据计算，不代表后台监测已运行') + '</td></tr>').join('')
        + '</tbody></table></div>' : '<div class="mf-secondary">尚未执行示例计算。</div>') + '</details>';
  }

  function renderCurrent() {
    const box = document.getElementById('pageContainer');
    if (!box || !own(state.page)) return;
    if (!window.warnings || !window.tickets || !window.rules) { box.innerHTML = '<div class="mf-root">' + empty('共享预警模块未加载，请刷新页面后重试') + '</div>'; return; }
    box.innerHTML = state.page === 'mf-stats' ? renderStats() : state.page === 'mf-rules' ? renderRules() : (state.detailId ? renderDetail() : renderRecords());
    if (window.setActiveMenu) window.setActiveMenu(state.page);
    if (window.updateBreadcrumb) window.updateBreadcrumb(state.page, state.detailId ? '预警详情' : undefined);
  }
  function resetRecords() { Object.assign(state, { advanced: false, recordFocus: '', category: 'ALL', coreGroup: 'ALL', source: 'ALL', includeSupport: false, layer: 'ALL', status: 'ALL', severity: 'ALL', keyword: '', draftKeyword: '', dateFrom: '', dateTo: '', organization: '', rule: '', indicator: 'ALL', sort: 'core', overdueOnly: false, pageNo: 1, statOpenOnly: false, observationOnly: false, noRecordOnly: false }); }
  function resetStats() { Object.assign(state, { statCategory: 'ALL', statGroup: 'ALL', statLayer: 'ALL', statFrom: '', statTo: '', statOrg: '' }); }
  function resetRules() { Object.assign(state, { ruleCategory: 'ALL', ruleGroup: 'ALL', expandedRules: [], ruleLayer: 'ALL', ruleEnabled: 'ALL', ruleKeyword: '', draftRuleKeyword: '', rulePageNo: 1 }); }
  function goto(page) {
    if (LEGACY[page]) page = LEGACY[page];
    if (!own(page)) return;
    if (window.closeWarningModals) window.closeWarningModals();
    state.detailId = ''; state.logOpen = false; state.historyOpen = false; state.evidenceOpen = false; state.riskModal = '';
    state.page = page;
    try { history.replaceState(null, '', '#' + page); } catch (_) {}
    if (window.navigateTo) window.navigateTo(page); else renderCurrent();
    const mc = document.getElementById('mainContent'); if (mc) mc.scrollTop = 0;
  }
  function openDetail(id) {
    if (!warning(id)) { notify('未找到这条预警', true); return; }
    if (!state.detailId) {
      state.detailOrigin = state.page === 'mf-stats' ? 'mf-stats' : 'mf-records';
      const mc = document.getElementById('mainContent'); state.returnScroll = mc ? mc.scrollTop : 0;
    }
    state.page = 'mf-records'; state.detailId = id; state.historyOpen = false; state.evidenceOpen = false;
    try { history.replaceState(null, '', '#mf-record|' + id); } catch (_) {}
    renderCurrent();
    const mc = document.getElementById('mainContent'); if (mc) mc.scrollTop = 0;
  }
  function backToRecords() {
    state.detailId = ''; state.logOpen = false; state.page = state.detailOrigin || 'mf-records';
    try { history.replaceState(null, '', '#' + state.page); } catch (_) {}
    if (window.navigateTo) window.navigateTo(state.page); else renderCurrent();
    const mc = document.getElementById('mainContent'); if (mc) mc.scrollTop = state.returnScroll || 0;
  }
  function drillStats(kind, id) {
    resetRecords();
    Object.assign(state, { category: kind === 'category' ? id : state.statCategory, coreGroup: state.statGroup,
      organization: kind === 'org' ? id : state.statOrg, layer: state.statLayer, dateFrom: state.statFrom, dateTo: state.statTo,
      statOpenOnly: ['open', 'urgent', 'late'].includes(kind) || (kind === 'status' && id !== 'CLOSED'),
      observationOnly: kind === 'observation', noRecordOnly: kind === 'no-record', overdueOnly: kind === 'late',
      severity: kind === 'urgent' ? 'URGENT' : 'ALL' });
    if (kind === 'closed') state.status = 'CLOSED';
    if (kind === 'status') state.status = id;
    state.page = 'mf-records'; state.detailId = '';
    try { history.replaceState(null, '', '#mf-records'); } catch (_) {}
    if (window.navigateTo) window.navigateTo('mf-records'); else renderCurrent();
    const mc = document.getElementById('mainContent'); if (mc) mc.scrollTop = 0;
  }

  /* ---------- 材料与导出 ---------- */
  function addMaterials(id, files) {
    const w = warning(id); const t = ticketOf(id);
    if (!w || !isOpen(t)) { notify('已结束记录不能添加材料', true); return; }
    const incoming = Array.from(files || []); if (!incoming.length) return;
    if (incoming.some(f => f.size > 10 * 1024 * 1024)) { notify('单个材料不能超过 10 MB', true); return; }
    if (incoming.some(f => !/\.(pdf|png|jpe?g|txt|csv|docx?|xlsx?)$/i.test(f.name))) { notify('请选择 PDF、图片、文本或 Office 文档', true); return; }
    const list = materials.get(id) || []; if (list.length + incoming.length > 10) { notify('每条预警最多 10 件材料', true); return; }
    incoming.forEach(file => list.push({ file, addedAt: new Date() })); materials.set(id, list);
    t.history.push({ time: new Date(), action: '添加会话材料', operator: operator(), detail: incoming.map(f => f.name).join('、') + '（原型本地材料，未上传服务器）' });
    notify('材料已加入当前会话，未上传服务器'); renderCurrent();
  }
  function download(name, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
  function csv(rows) { return '\ufeff' + rows.map(row => row.map(v => { let s = String(v == null ? '' : v); if (/^\s*[=+@\-]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }).join(',')).join('\r\n'); }
  function exportRecords() {
    const list = filteredWarnings();
    download('预警记录.csv', csv([['预警编号', '预警事项', '预警对象', '预警分类', '核心事项', '来源', '业务类型', '级别', '异常依据', '触发阈值 / 原计划', '状态', '处理结论', '处理人 / 岗位', '截止或结束时间', '触发时间', '结束原因', '规则版本', '统计批次']].concat(list.map(w => { const t = ticketOf(w.id); return [w.id, w.ruleName, orgOf(w), categoryName(Core.categoryOf(w)), groupName(w), Core.sourceName(w), layerName(w.type), SEVERITY[w.severity], w.metricLabel, w.thresholdSnapshot, statusText(t), t ? (t.verificationResult || '') : '', t ? (t.assigneeUser || t.ownerRole || '') : '', t ? (t.status === 'CLOSED' ? time(t.closedAt) : t.slaDeadline ? time(t.slaDeadline) : '') : '', time(w.triggerTime), t?.status === 'CLOSED' ? closureLabel(t) : '', w.ruleVersion || '', w.dataBatch || '']; }))), 'text/csv;charset=utf-8');
    notify('已导出当前查询结果 ' + list.length + ' 条');
  }
  function exportStats() {
    const list = statsList(); const s = summaryOf(list);
    const rows = [['生成时间', time(new Date())], ['触发开始', state.statFrom || '不限'], ['触发结束', state.statTo || '不限'],
      ['机构', state.statOrg || '全部'], ['业务类型', state.statLayer === 'ALL' ? '全部' : layerName(state.statLayer)],
      ['预警分类', categoryName(state.statCategory)], ['核心事项', state.statGroup === 'ALL' ? '全部' : Core.groups.find(g => g.id === state.statGroup)?.name],
      ['统计范围', '核心事项；原质控整改摘要与人工核查同源汇集'], ['质控来源', Core.sourceStatus().available ? '可用' : '暂不可用 · 保留最近摘要'],
      [], ['指标', '数值'], ['预警总数', s.total], ['未结束数', s.open], ['已结束数', s.closed],
      ['观察线索', s.observation], ['无处理记录', s.noRecord], ['超时未结束', s.late],
      [], ['预警分类', '数量'], ...Core.categories.map(c => [c.name, list.filter(w => Core.categoryOf(w) === c.id).length]),
      [], ['核心事项', '数量'], ...Core.groups.map(g => [g.name, list.filter(w => Core.groupOf(w) === g.id).length]),
      [], ['处理状态', '数量'], ...statusDistribution(list).map(item => [item.name, item.n]),
      [], ['机构', '总数', '未结束', '已结束', '观察线索', '无处理记录', '超时未结束'],
      ...institutionSummary(list).map(group => [group.org, group.total, group.open, group.closed, group.observation, group.noRecord, group.late]),
      [], ['结束原因', '数量']];
    const ended = new Map();
    list.forEach(w => { const t = ticketOf(w.id); if (t?.status === 'CLOSED') ended.set(closureLabel(t), (ended.get(closureLabel(t)) || 0) + 1); });
    rows.push(...ended);
    download('预警统计.csv', csv(rows), 'text/csv;charset=utf-8'); notify('已导出当前条件、统计分布及机构明细');
  }
  function exportRules() {
    const list = visibleRules();
    download('预警规则.csv', csv([['规则编号', '规则名称', '预警分类', '核心事项', '业务类型', '适用对象', '判定条件', '执行周期', '状态', '版本', '接入情况']].concat(list.map(r => [r.id, r.ruleName, categoryName(Core.categoryOf(r)), groupName(r), layerName(r.warningType), r.dimensionScope || '', ruleCondition(r), r.observeWindow || '', r.isEnabled ? '启用' : '停用', 'v' + (r.history || []).length, r.capability || '原规则计算']))), 'text/csv;charset=utf-8'); notify('已导出当前规则 ' + list.length + ' 条');
  }

  /* ---------- 事件 ---------- */
  function handle(action, id) {
    switch (action) {
      case 'category': Object.assign(state, { category: id, coreGroup: 'ALL', layer: 'ALL', indicator: 'ALL', rule: '', pageNo: 1, recordFocus: '', statOpenOnly: false, observationOnly: false, noRecordOnly: false }); renderCurrent(); break;
      case 'refresh-sources': Core.refresh(); renderCurrent(); notify('已读取最新来源状态'); break;
      case 'focus-open':
      case 'focus-urgent':
      case 'focus-late':
      case 'focus-observation':
        state.recordFocus = action.slice(6); state.pageNo = 1; renderCurrent(); break;
      case 'new-risk': openRiskModal('new', { source: '', confirmed: false }); break;
      case 'close-risk': state.riskModal = ''; state.riskDraft = {}; renderCurrent(); break;
      case 'save-risk': {
        const result = Core.addManual(state.riskDraft);
        if (result.error) { notify(result.error, true); break; }
        state.riskModal = ''; resetRecords(); state.category = 'RISK'; state.coreGroup = 'CONTINUITY';
        openDetail(result.id); notify(result.reused ? '已定位同一原计划的核查记录' : '已纳入重点核查'); break;
      }
      case 'start-risk': if (Core.startManual(id)) { renderCurrent(); notify('已开始协调核查'); } break;
      case 'finish-risk': openRiskModal('finish', {}); break;
      case 'save-risk-result': {
        const result = Core.finishManual(id, state.riskDraft.result, state.riskDraft.resultBasis);
        if (result.error) { notify(result.error, true); break; }
        state.riskModal = ''; renderCurrent(); notify('核查结果已保存'); break;
      }
      case 'risk-config': openRiskModal('config', { ...Core.config(), note: '' }); break;
      case 'save-risk-config': {
        const d = state.riskDraft, result = Core.saveConfig({ ...d, attentionDays: Number(d.attentionDays), urgentDays: Number(d.urgentDays), clusterCount: Number(d.clusterCount), clusterWindow: Number(d.clusterWindow) });
        if (result.error) { notify(result.error, true); break; }
        state.riskModal = ''; renderCurrent(); notify('管理条件已更新并留痕'); break;
      }
      case 'source-qc':
        prepareSourceReturn();
        if (!window.qcIssues?.openProblem(id, 'work')) { state.sourceReturn = null; notify('来源问题暂不可用，请刷新后核实', true); } break;
      case 'source-manual': {
        const w = warning(id), r = w?.sourceRecords[0]; if (!r) break;
        const candidate = Core.candidates().find(c => c.kind === r.kind && c.id === r.id);
        if (!candidate) { notify('来源记录暂不可用', true); break; }
        prepareSourceReturn();
        if (r.kind === 'portrait') window.SpecialtyRiskSource.open(r.id);
        else { window.navigateTo('followup-tasks'); window.openFollowupTaskHistory?.(r.id); }
        break;
      }
      case 'return-warning': {
        const origin = state.sourceReturn; if (!origin) break;
        Core.refresh(); state.sourceReturn = null; state.page = 'mf-records'; state.detailId = origin.id; state.detailOrigin = origin.origin; state.returnScroll = origin.scroll;
        try { history.replaceState(null, '', '#mf-record|' + origin.id); } catch (_) {}
        renderCurrent(); break;
      }
      case 'query-records': { const e = document.getElementById('mf-search'); if (e) state.draftKeyword = e.value; state.keyword = state.draftKeyword.trim(); state.pageNo = 1; renderCurrent(); break; }
      case 'reset-records': resetRecords(); renderCurrent(); break;
      case 'toggle-advanced': { const e = document.getElementById('mf-search'); if (e) state.draftKeyword = e.value; state.advanced = !state.advanced; renderCurrent(); break; }
      case 'records-page': state.pageNo = Math.max(1, Number(id) || 1); renderCurrent(); break;
      case 'open-detail': openDetail(id); break;
      case 'back-records': backToRecords(); break;
      case 'toggle-history': state.historyOpen = !state.historyOpen; renderCurrent(); break;
      case 'toggle-evidence': state.evidenceOpen = !state.evidenceOpen; renderCurrent(); break;
      case 'add-record':
      case 'add-observation': state.logOpen = true; state.logDraft = ''; state.discardPrompt = false; state.logKind = action === 'add-observation' ? 'observation' : 'record'; state.observationAction = 'WAIT_ANNUAL'; state.annualId = ''; renderCurrent(); document.getElementById('mf-record-note')?.focus(); break;
      case 'close-record':
        if (state.logDraft.trim()) { state.discardPrompt = true; renderCurrent(); }
        else { state.logOpen = false; renderCurrent(); document.querySelector('[data-mf="add-record"]')?.focus(); }
        break;
      case 'keep-record': state.discardPrompt = false; renderCurrent(); document.getElementById('mf-record-note')?.focus(); break;
      case 'discard-record': state.logDraft = ''; state.logOpen = false; state.discardPrompt = false; renderCurrent(); document.querySelector('[data-mf="add-record"]')?.focus(); break;
      case 'save-record': {
        const ta = document.getElementById('mf-record-note'); const note = ta ? ta.value.trim() : '';
        const w = warning(id); if (!w) break;
        if (!note) { notify('请填写处理说明', true); break; }
        let detail = note + '（仅追加记录，不改变状态）';
        if (state.logKind === 'observation') {
          const t = ticketOf(w.id);
          if (!isObserve(w) || !isOpen(t)) { notify('仅未结束观察线索可以更新观察结果', true); break; }
          if (state.observationAction === 'LINKED_ANNUAL') {
            const annual = annualCandidates(w).find(item => item.id === state.annualId);
            if (!annual) { notify('请选择同地区、同癌种年度预警', true); break; }
            w.relatedWarningId = annual.id;
            annual.relatedWarningId = annual.relatedWarningId || w.id;
          }
          w.observationStatus = state.observationAction;
          if (state.observationAction === 'ENDED') {
            t.status = w.status = 'CLOSED'; t.closedAt = new Date(); t.closedBy = operator();
            t.closureReason = 'OBSERVATION'; t.verificationResult = '观察结束（未形成疾病结论）'; t.reviewNote = note;
          }
          detail = note + '；观察去向：' + ({ WAIT_ANNUAL: '待年度核查', LINKED_ANNUAL: '已关联 ' + state.annualId, ENDED: '观察结束，未形成疾病结论' }[state.observationAction]);
        }
        w.history.push({ time: new Date(), action: state.logKind === 'observation' ? '记录观察结果' : '补充处理记录', operator: operator(), detail });
        state.logOpen = false; state.logDraft = ''; state.historyOpen = true; notify('处理记录已保存'); renderCurrent(); document.querySelector('[data-mf="add-record"]')?.focus(); break;
      }
      case 'receive': {
        const t = ticket(id); if (!t) break;
        if (t.status !== 'PENDING') { notify('该记录不在待接收状态', true); break; }
        window.receiveTicket(id); break;
      }
      case 'feedback': { const t = ticket(id); if (!t || !['PROCESSING', 'ESCALATED'].includes(t.status)) { notify('请先接收记录再提交反馈', true); break; } if (window.closeWarningModals) window.closeWarningModals(); window.openFeedbackModal(id); break; }
      case 'review': {
        const t = ticket(id); if (!t) break;
        if (t.status !== 'FEEDBACK') { notify('仅已反馈记录可以复核', true); break; }
        if (isObserve(warning(t.warningId))) { notify('观察线索请记录观察结果，待年度核查后形成结论', true); break; }
        if (window.closeWarningModals) window.closeWarningModals(); window.openReviewModal(id); break;
      }
      case 'query-stats': { const e = document.getElementById('mf-search'); if (e) state.keyword = ''; renderCurrent(); break; }
      case 'reset-stats': resetStats(); renderCurrent(); break;
      case 'drill-all': drillStats('all'); break;
      case 'drill-open': drillStats('open'); break;
      case 'drill-closed': drillStats('closed'); break;
      case 'drill-observation': drillStats('observation'); break;
      case 'drill-no-record': drillStats('no-record'); break;
      case 'drill-urgent': drillStats('urgent'); break;
      case 'drill-late': drillStats('late'); break;
      case 'drill-category': drillStats('category', id); break;
      case 'drill-status': drillStats('status', id); break;
      case 'drill-org': drillStats('org', id); break;
      case 'query-rules': { const e = document.getElementById('mf-rule-search'); if (e) state.draftRuleKeyword = e.value; state.ruleKeyword = state.draftRuleKeyword.trim(); state.rulePageNo = 1; renderCurrent(); break; }
      case 'reset-rules': resetRules(); renderCurrent(); break;
      case 'rules-page': state.rulePageNo = Math.max(1, Number(id) || 1); renderCurrent(); break;
      case 'expand-rules': state.expandedRules = state.expandedRules.includes(id) ? state.expandedRules.filter(g => g !== id) : state.expandedRules.concat(id); renderCurrent(); break;
      case 'view-rule':
        if (id.startsWith('MC-')) openRiskModal('rule', { ruleId: id });
        else if (typeof window.openRuleModal === 'function') { if (window.closeWarningModals) window.closeWarningModals(); window.openRuleModal(id); } break;
      case 'run-rules': window.runAllEngines(); Core.refresh(); renderCurrent(); break;
      case 'export-records': exportRecords(); break;
      case 'export-stats': exportStats(); break;
      case 'export-rules': exportRules(); break;
      case 'download-file': { const p = id.split('|'); const f = (materials.get(p[0]) || [])[Number(p[1])]; if (f) download(f.file.name, f.file); break; }
    }
  }
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-mf]'); if (!el) return;
    if (el.classList.contains('mf-modal-mask') && e.target !== el) return;
    if (el.tagName === 'BUTTON' || el.tagName === 'A') e.preventDefault();
    handle(el.getAttribute('data-mf'), el.getAttribute('data-id') || '');
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'mf-search') state.draftKeyword = e.target.value;
    if (e.target.id === 'mf-rule-search') state.draftRuleKeyword = e.target.value;
    if (e.target.id === 'mf-record-note') state.logDraft = e.target.value;
    const riskKey = e.target.getAttribute('data-mf-risk');
    if (riskKey) state.riskDraft[riskKey] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  });
  document.addEventListener('submit', e => {
    const form = e.target; if (!form || !form.matches || !form.matches('[data-mf-form]')) return;
    e.preventDefault();
    const kind = form.getAttribute('data-mf-form');
    if (kind === 'records') handle('query-records');
    if (kind === 'stats') handle('query-stats');
    if (kind === 'rules') handle('query-rules');
  });
  document.addEventListener('change', e => {
    const el = e.target;
    const riskKey = el.getAttribute('data-mf-risk');
    if (riskKey) {
      state.riskDraft[riskKey] = el.type === 'checkbox' ? el.checked : el.value;
      if (riskKey === 'source') {
        const candidate = Core.candidates().find(c => c.key === el.value);
        state.riskDraft.owner = candidate?.org || ''; state.riskDraft.due = candidate?.due || '';
        renderCurrent(); document.getElementById('mf-risk-fact')?.focus();
      }
      return;
    }
    if (el.id === 'mf-observation-action') { state.observationAction = el.value; return; }
    if (el.id === 'mf-annual-id') { state.annualId = el.value; return; }
    if (el.hasAttribute('data-mf-files')) { addMaterials(el.getAttribute('data-mf-files'), el.files); return; }
    const check = el.getAttribute('data-mf-check');
    if (check === 'overdueOnly' || check === 'includeSupport') { state[check] = el.checked; state.pageNo = 1; renderCurrent(); return; }
    const key = el.getAttribute('data-mf-field'); if (!key) return;
    if (!Object.prototype.hasOwnProperty.call(state, key)) return;
    state[key] = el.value;
    if (key === 'statCategory') state.statGroup = 'ALL';
    if (key === 'ruleCategory') state.ruleGroup = 'ALL';
    if (key === 'ruleLayer' || key === 'ruleEnabled') state.rulePageNo = 1; else state.pageNo = 1;
    if (state.dateFrom && state.dateTo && state.dateFrom > state.dateTo) { state.dateTo = ''; notify('结束日期不能早于开始日期，已清空结束条件', true); }
    if (state.statFrom && state.statTo && state.statFrom > state.statTo) { state.statTo = ''; notify('结束日期不能早于开始日期，已清空结束条件', true); }
    renderCurrent();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.riskModal) { e.preventDefault(); handle('close-risk'); return; }
    if (e.key === 'Escape' && state.logOpen) { e.preventDefault(); handle('close-record'); }
    if (e.key === 'Tab' && (state.logOpen || state.riskModal)) {
      const controls = Array.from(document.querySelectorAll('.mf-modal button,.mf-modal textarea,.mf-modal select,.mf-modal input')).filter(el => !el.disabled);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  });

  /* ---------- 与原模块衔接 ---------- */
  function inFusion() { return own(state.page) && !!document.querySelector('#pageContainer .mf-root'); }
  function wireLegacy() {
    const baseRender = window.renderPage;
    window.renderPage = function (id) {
      if (typeof id === 'string' && (id === 'mf-record' || id.indexOf('mf-record|') === 0)) { Core.refresh(); state.page = 'mf-records'; openDetail(id.split('|')[1]); return; }
      if (LEGACY[id]) { goto(LEGACY[id]); return; }
      if (own(id)) { Core.refresh(); state.detailId = ''; state.logOpen = false; state.riskModal = ''; state.page = id; renderCurrent(); return; }
      if (bridgeDepth > 0 && inFusion()) { renderCurrent(); return; }
      state.page = ''; state.detailId = '';
      const result = baseRender.apply(this, arguments); sourceToolbar(id); return result;
    };
    ['receiveTicket', 'submitFeedback', 'closeTicket', 'returnTicket', 'runAllEngines', 'scanOverdue', 'saveRuleVersion', 'toggleRule'].forEach(name => {
      const original = window[name]; if (typeof original !== 'function') return;
      window[name] = function () {
        if (!inFusion()) return original.apply(this, arguments);
        bridgeDepth++;
        try { return original.apply(this, arguments); } finally { bridgeDepth--; }
      };
    });
  }
  wireLegacy();
  Core.refresh();
  window.MonitorUnified = { pageIds: Object.keys(PAGE_NAMES), render: renderCurrent, getState: () => ({ ...state }), records: filteredWarnings, summary: () => summaryOf(statsList()), ticketFor: ticketOf, openDetail, backToRecords };
})();
