/* 监测预警 · 统一查看版（V2.1）
 * 三个菜单：预警记录 / 预警统计 / 规则配置。所有用户同一套页面与默认范围，无角色切换、无个人待办。
 * 复用 warning-module.js 的数组、核查表单与状态机；不替换原两套页面。
 */
(function () {
  'use strict';
  const PAGE_NAMES = { 'mf-records': '预警记录', 'mf-stats': '预警统计', 'mf-rules': '规则配置' };
  const LEGACY = { 'mf-workbench': 'mf-records', 'mf-tickets': 'mf-records', 'mf-drawer-demo': 'mf-records' };
  const TYPES = ['REGISTRY_OPERATION', 'REGISTRY_QUALITY', 'DISEASE_SIGNAL'];
  const TYPES_TEXT = { REGISTRY_OPERATION: '登记运行', REGISTRY_QUALITY: '登记质量', DISEASE_SIGNAL: '癌情线索' };
  const STATUS = { PENDING: '待接收', PROCESSING: '处理中', FEEDBACK: '待复核', CLOSED: '已结束', ESCALATED: '处理中' };
  const STATUS_TONE = { PENDING: 'blue', PROCESSING: 'blue', FEEDBACK: 'amber', CLOSED: 'green', ESCALATED: 'amber' };
  const SEVERITY = { URGENT: '紧急', ATTENTION: '关注', INFO: '提示' };
  const state = {
    page: 'mf-records', layer: 'ALL', status: 'ALL', severity: 'ALL', keyword: '', dateFrom: '', dateTo: '',
    indicator: 'ALL', sort: 'core',
    organization: '', rule: '', overdueOnly: false, pageNo: 1, pageSize: 10, advanced: false,
    statLayer: 'ALL', statFrom: '', statTo: '', statOrg: '', statOpenOnly: false,
    ruleLayer: 'ALL', ruleEnabled: 'ALL', ruleKeyword: '', rulePageNo: 1, rulePageSize: 15,
    detailId: '', logOpen: false, historyOpen: false, evidenceOpen: false
  };
  let bridgeDepth = 0;
  const materials = new Map();
  const own = id => Object.prototype.hasOwnProperty.call(PAGE_NAMES, id);
  const W = () => window.warnings || [];
  const T = () => window.tickets || [];
  const R = () => window.rules || [];
  const warning = id => W().find(w => w.id === id);
  const ticket = id => T().find(t => t.id === id);
  const ticketOf = id => T().find(t => t.warningId === id);
  const ruleOf = w => R().find(r => r.id === w.ruleId) || {};
  const layerName = type => TYPES_TEXT[type] || type || '';
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const time = v => { if (!v) return '—'; const d = new Date(v); return isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const shortTime = v => { const d = new Date(v); return isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const dayTime = v => { if (!v) return '—'; const d = new Date(v); return isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const orgOf = w => w.responsibleEntity || String(w.targetId || '').split('|')[0];
  const isOpen = t => !!t && t.status !== 'CLOSED';
  const overdue = t => isOpen(t) && !!t.slaDeadline && new Date(t.slaDeadline).getTime() < Date.now();
  const near = t => isOpen(t) && !!t.slaDeadline && !overdue(t) && new Date(t.slaDeadline).getTime() - Date.now() <= 3 * 86400000;
  const isPreview = w => !!w && w.ruleId === 'C-QUARTER-PREVIEW';
  const isObserve = w => isPreview(w) || w.severity === 'INFO';
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
  const closedOf = w => { const t = ticketOf(w.id); return !!t && t.status !== 'CLOSED'; };
  function priority(w) {
    const t = ticketOf(w.id);
    const open = !!t && t.status !== 'CLOSED';
    const rank = open ? (w.severity === 'URGENT' ? 0 : w.severity === 'ATTENTION' ? 1 : 2) : 4;
    return rank + (isPreview(w) ? 0.5 : 0);
  }
  function sortByCore(a, b) {
    return priority(a) - priority(b) || new Date(b.triggerTime) - new Date(a.triggerTime);
  }
  const statusText = t => t ? (STATUS[t.status] || '—') : '无处理记录';
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
      return (r.layer === 'ALL' || w.type === r.layer)
        && (r.status === 'ALL' || (t ? t.status : 'NONE') === r.status)
        && (r.severity === 'ALL' || w.severity === r.severity)
        && (!r.indicator || r.indicator === 'ALL' || indicatorOf(w) === r.indicator)
        && (!r.organization || orgOf(w) === r.organization)
        && (!r.rule || w.ruleId === r.rule)
        && (!r.dateFrom || new Date(w.triggerTime) >= new Date(r.dateFrom + 'T00:00:00'))
        && (!r.dateTo || new Date(w.triggerTime) <= new Date(r.dateTo + 'T23:59:59.999'))
        && (!r.overdueOnly || overdue(t))
        && (!kw || [w.id, w.ruleId, w.ruleName, w.targetId, w.targetLabel, w.metricLabel, orgOf(w), indicatorName(indicatorOf(w))]
          .concat(t ? [t.id, t.ownerOrg, t.ownerRole] : []).join(' ').toLowerCase().includes(kw));
    }).sort(r.sort === 'time' ? ((a, b) => new Date(b.triggerTime) - new Date(a.triggerTime)) : sortByCore);
  }
  function filteredWarnings() { return recordsIn(state); }
  function summaryOf(list) {
    let open = 0; let closed = 0; let late = 0;
    list.forEach(w => { const t = ticketOf(w.id); if (t && t.status === 'CLOSED') closed++; else if (t && !isObserve(w)) open++; if (overdue(t)) late++; });
    return { total: list.length, open, closed, late };
  }

  /* ---------- 布局 ---------- */
  function head(title, desc, actions) { return '<header class="mf-head"><div><div class="mf-eyebrow">监测预警</div><h1 class="mf-title">' + esc(title) + '</h1><p class="mf-sub">' + esc(desc) + '</p></div><div class="mf-head-actions">' + (actions || '') + '</div></header>'; }
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

  /* 列表“处理情况”：结论优先，其次处理人与时限；未处理时给出下一步提示 */
  function processCell(w, t) {
    if (!t) return '<div class="mf-secondary">无处理记录</div>';
    if (isObserve(w) && t.status !== 'CLOSED') return '<div class="mf-cell-sub">观察线索 · 不进入整改任务</div><div class="mf-secondary">' + esc(t.ownerRole || t.ownerOrg || '') + ' · ' + esc(shortTime(w.triggerTime)) + ' 生成</div>';
    if (t.status === 'CLOSED') return '<div class="mf-cell-sub mf-clamp1">' + esc(t.verificationResult || '已结束（无结论文字）') + '</div><div class="mf-secondary">' + esc(t.ownerOrg || '') + ' · ' + esc(dayTime(t.closedAt)) + ' 结束</div>';
    const person = t.assigneeUser || t.ownerRole || t.ownerOrg || '';
    if (t.status === 'FEEDBACK') return '<div class="mf-cell-sub mf-clamp1">' + esc(t.verificationResult || '已提交反馈') + '</div><div class="mf-secondary">' + esc(person) + ' · ' + esc(dayTime(t.feedbackAt)) + ' 反馈</div>';
    const due = t.slaDeadline ? '截止 ' + dayTime(t.slaDeadline) : '无需时限';
    const tone = overdue(t) ? ' mf-text-red' : near(t) ? ' mf-text-amber' : '';
    return '<div class="mf-cell-sub mf-clamp1">待' + (t.status === 'PENDING' ? '接收，接收后提交核查结论' : '提交核查结论') + '</div><div class="mf-secondary' + tone + '">' + esc(person) + ' · ' + esc(due) + '</div>';
  }

  /* ---------- 页面一：预警记录 ---------- */
  function renderRecords() {
    const list = filteredWarnings();
    const total = list.length;
    const max = Math.max(1, Math.ceil(total / state.pageSize));
    state.pageNo = Math.min(state.pageNo, max);
    const shown = state.statOpenOnly ? list.filter(w => { const t = ticketOf(w.id); return t && t.status !== 'CLOSED'; }) : list;
    const rows = shown.slice((state.pageNo - 1) * state.pageSize, state.pageNo * state.pageSize).map(w => {
      const t = ticketOf(w.id);
      const mark = t && t.status === 'CLOSED' ? '' : overdue(t) ? '超时' : near(t) ? '临期' : '';
      return '<tr><td><div class="mf-cell-main mf-clamp2">' + esc(w.ruleName) + '</div><div class="mf-secondary"><span class="mf-indicator">' + esc(indicatorName(indicatorOf(w))) + '</span> · ' + esc(w.id) + (isPreview(w) ? ' · 仅线索' : '') + '</div></td>'
        + '<td><div class="mf-cell-main">' + esc(orgOf(w)) + '</div><div class="mf-secondary mf-clamp1">' + esc(w.targetLabel) + '</div></td>'
        + '<td>' + typeText(w.type) + '</td>'
        + '<td>' + sevBadge(w.severity) + '</td>'
        + '<td><div class="mf-cell-main mf-num mf-clamp2">' + esc(w.metricLabel || '—') + '</div><div class="mf-secondary mf-clamp1">阈值 ' + esc(w.thresholdSnapshot || '—') + '</div></td>'
        + '<td>' + statusBadge(t) + (mark ? ' ' + badge(mark, mark === '超时' ? 'red' : 'amber') : '') + '</td>'
        + '<td>' + processCell(w, t) + '</td>'
        + '<td class="mf-nowrap">' + esc(dayTime(w.triggerTime)) + '</td>'
        + '<td class="mf-col-actions">' + button('查看', 'open-detail', w.id, 'small primary') + '</td></tr>';
    }).join('');
    const filters = dateRangeField('dateFrom', 'dateTo')
      + field('核心指标', 'indicator', [['ALL', '全部指标']].concat(INDICATORS.map(x => [x[0], x[1]])))
      + field('机构', 'organization', orgOptions()) + field('业务类型', 'layer', [['ALL', '全部类型']].concat(TYPES.map(k => [k, layerName(k)])))
      + field('处理状态', 'status', [['ALL', '全部状态'], ['PENDING', '待接收'], ['PROCESSING', '处理中'], ['FEEDBACK', '待复核'], ['CLOSED', '已结束']])
      + field('排序', 'sort', [['core', '核心优先'], ['time', '按触发时间']])
      + searchField('关键词', '预警名称、指标、机构或编号', 'mf-search', state.keyword)
      + (state.advanced ? field('预警级别', 'severity', [['ALL', '全部级别'], ['URGENT', '紧急'], ['ATTENTION', '关注'], ['INFO', '提示']])
        + field('具体规则', 'rule', [['', '全部规则']].concat(R().map(r => [r.id, r.id + ' · ' + r.ruleName])))
        + '<label class="mf-check"><input type="checkbox" data-mf-check="overdueOnly"' + (state.overdueOnly ? ' checked' : '') + '> 仅看超时未结束</label>' : '');
    const conditions = [state.indicator !== 'ALL' && '指标：' + indicatorName(state.indicator), state.organization && '机构：' + state.organization, state.layer !== 'ALL' && '类型：' + layerName(state.layer), state.status !== 'ALL' && '状态：' + STATUS[state.status], state.severity !== 'ALL' && '级别：' + SEVERITY[state.severity],
      (state.dateFrom || state.dateTo) && '触发时间：' + (state.dateFrom || '不限') + ' 至 ' + (state.dateTo || '至今'), state.rule && '规则：' + state.rule, state.overdueOnly && '仅看超时未结束', state.keyword && '关键词：' + state.keyword, state.statOpenOnly && '统计下钻：未结束记录'].filter(Boolean);
    const maxPage = Math.max(1, Math.ceil(shown.length / state.pageSize));
    return '<div class="mf-root">' + head(PAGE_NAMES['mf-records'], '统一查看全部预警与处理情况；默认核心指标优先，未结束的紧急与关注级排在前。', button('导出当前结果', 'export-records', '', 'subtle'))
      + filterBox('records', filters, button('查询', 'query-records', '', 'primary') + button('重置', 'reset-records', '', 'subtle') + button(state.advanced ? '收起条件' : '更多条件', 'toggle-advanced', '', 'subtle'))
      + (conditions.length ? '<div class="mf-conditions"><span class="mf-secondary">当前条件</span>' + conditions.map(c => badge(c, 'blue')).join('') + button('清除条件', 'reset-records', '', 'small subtle') + '</div>' : '')
      + '<div class="mf-list-caption"><span class="mf-result-count">共 ' + shown.length + ' 条记录 · ' + (state.sort === 'time' ? '按触发时间倒序' : '核心指标优先（紧急 / 关注在前）') + '</span></div>'
      + '<div class="mf-table-wrap"><table class="mf-table mf-record-table"><thead><tr><th>预警事项</th><th>预警对象</th><th>业务类型</th><th>级别</th><th>实际值 / 阈值</th><th>状态</th><th>处理情况</th><th>触发时间</th><th class="mf-col-actions">操作</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="9">' + empty() + '</td></tr>') + '</tbody></table></div>'
      + '<div class="mf-pagination"><span class="mf-result-count">共 ' + shown.length + ' 条记录</span><div class="mf-toolbar">'
      + button('上一页', 'records-page', String(state.pageNo - 1), 'small', state.pageNo <= 1) + '<span class="mf-secondary">' + state.pageNo + ' / ' + maxPage + '</span>'
      + button('下一页', 'records-page', String(state.pageNo + 1), 'small', state.pageNo >= maxPage) + '</div></div></div>';
  }

  /* ---------- 页面：预警详情（隐藏页，菜单仍高亮预警记录） ---------- */
  function renderDetail() {
    const w = warning(state.detailId);
    if (!w) { state.detailId = ''; return renderRecords(); }
    const t = ticketOf(w.id);
    return '<div class="mf-root mf-detail">'
      + '<div class="mf-detail-top">' + button('← 返回列表', 'back-records', '', 'subtle small') + '</div>'
      + '<header class="mf-head"><div><h1 class="mf-title">' + esc(w.ruleName) + '</h1><p class="mf-detail-meta">' + esc(w.id) + ' · ' + esc(layerName(w.type)) + ' · ' + esc(SEVERITY[w.severity]) + ' · ' + esc(statusText(t)) + '</p></div></header>'
      + infoCard(w) + processCard(w, t) + historyCard(w, t)
      + (state.logOpen ? recordModal(w) : '') + '</div>';
  }
  function infoCard(w) {
    const items = [['预警对象', w.targetLabel], ['触发时间', time(w.triggerTime)], ['观察周期', (w.period || '—') + ' · ' + (w.observeWindow || '—')], ['实际值', w.metricLabel || '—'], ['触发阈值', w.thresholdSnapshot || '—'], ['责任机构', orgOf(w)]];
    const rows = items.map(x => '<div class="mf-detail-field"><div class="mf-detail-label">' + esc(x[0]) + '</div><div class="mf-detail-value">' + esc(x[1]) + '</div></div>').join('');
    const evidence = Object.keys(w.snapshot || {}).map(k => '<div class="mf-evidence-row"><div class="mf-detail-label">' + esc(k) + '</div><div>' + esc(w.snapshot[k]) + '</div></div>').join('')
      + (w.evidence || []).map(e => '<div class="mf-evidence-row"><div class="mf-detail-label">' + esc(e.label) + '</div><div>' + esc(e.value) + '</div></div>').join('')
      + '<div class="mf-evidence-row"><div class="mf-detail-label">当前规则阈值</div><div>' + esc(String(ruleOf(w).thresholdValue == null ? '—' : ruleOf(w).thresholdValue) + String(ruleOf(w).unit || '')) + '（当前参数，非触发时）</div></div>';
    return card('一、预警信息', '<div class="mf-detail-grid">' + rows + '</div>'
      + '<div class="mf-basis"><div class="mf-detail-label">判定依据</div><p>' + esc(w.judgeBasis || '未记录判定依据') + '</p></div>'
      + (w.denominatorFlag ? '<div class="mf-notice warning"><strong>人口分母待核</strong><span>触发时率值的人口分母尚待核对，不能直接用于疾病流行结论。</span></div>' : '')
      + (w.contextFlag ? '<div class="mf-notice info"><strong>情景标注</strong><span>' + esc(w.contextFlag) + '</span></div>' : '')
      + '<div class="mf-history-toggle">' + button(state.evidenceOpen ? '收起数据依据' : '展开数据依据', 'toggle-evidence', '', 'small subtle') + '</div>'
      + (state.evidenceOpen ? '<div class="mf-evidence-block">' + (evidence || '<div class="mf-secondary">暂无快照记录</div>') + '</div>' : ''));
  }
  function processCard(w, t) {
    if (!t) return card('二、处理情况', '<div class="mf-secondary">暂无处理记录。</div>');
    const pending = t.status === 'PENDING';
    const waiting = t.status === 'PROCESSING' || t.status === 'ESCALATED';
    const observe = isObserve(w) && t.status !== 'CLOSED';
    const items = [['当前状态', STATUS[t.status] + (overdue(t) ? '（已超时）' : near(t) ? '（3 天内临期）' : '')],
      ['处理结论', t.verificationResult || ''], ['处理说明', t.handlingNote || ''],
      ['相关机构', t.ownerOrg], ['处理人 / 岗位', t.assigneeUser || t.ownerRole],
      ['截止时间', t.slaDeadline ? time(t.slaDeadline) : '不适用'],
      ['反馈时间', t.feedbackAt ? time(t.feedbackAt) : ''], ['结束时间', t.status === 'CLOSED' ? time(t.closedAt) : ''],
      ['专家意见', t.expertReviewNote || '']];
    const rows = items.filter(x => x[1]).map(x => '<div class="mf-detail-field"><div class="mf-detail-label">' + esc(x[0]) + '</div><div class="mf-detail-value">' + esc(x[1]) + '</div></div>').join('');
    const hint = pending ? '尚未接收，下发后系统将向责任方推送待办；接收后填写处理结论与说明。'
      : waiting ? '已接收，正在核查；提交核查结论与说明后进入归口复核。'
      : observe ? '该条为提示性线索，仅记录查看，不进入机构整改与行政追责流程。'
      : t.status === 'FEEDBACK' ? '已提交反馈，等待归口复核。复核后可结束，也可退回补充。' : '';
    const gaps = [];
    if (!t.verificationResult && !pending) gaps.push('处理结论未填写');
    if (!t.handlingNote && !pending) gaps.push('处理说明未填写');
    if (!t.assigneeUser && !pending) gaps.push('经办人未确认');
    const files = materials.get(w.id) || [];
    const upload = isOpen(t) ? '<label class="mf-material-upload"><span class="mf-btn small subtle">添加佐证材料</span><input type="file" multiple data-mf-files="' + esc(w.id) + '" accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.doc,.docx,.xls,.xlsx"><span class="mf-secondary">单件不超过 10 MB，最多 10 件</span></label>' : '';
    const fileList = files.map((f, i) => '<div class="mf-material-item"><div><strong>' + esc(f.file.name) + '</strong><div class="mf-secondary">' + (f.file.size / 1024).toFixed(1) + ' KB · ' + time(f.addedAt) + '</div></div>' + button('下载', 'download-file', w.id + '|' + i, 'small subtle') + '</div>').join('');
    let actions = button('补充处理记录', 'add-record', w.id, 'subtle');
    if (t.status === 'PENDING') actions += button('接收', 'receive', t.id, 'primary');
    if (['PROCESSING', 'ESCALATED'].includes(t.status)) actions += button(t.type === 'DISEASE_SIGNAL' ? '提交研判' : '提交反馈', 'feedback', t.id, 'primary');
    if (t.status === 'FEEDBACK') actions += isPreview(w) ? badge('待年度核查', 'gray') : button('复核', 'review', t.id, 'primary');
    return card('二、处理情况', '<div class="mf-detail-grid">' + rows + '</div>'
      + (hint ? '<div class="mf-notice' + (pending ? '' : ' info') + '"><strong>当前环节</strong><span>' + esc(hint) + '</span></div>' : '')
      + (gaps.length ? '<div class="mf-gap-line">待补充：' + esc(gaps.join('、')) + '</div>' : '')
      + (files.length || upload ? '<div class="mf-sub-title">佐证材料</div>' + upload + (fileList ? '<div class="mf-material-list">' + fileList + '</div>' : '') : '')
      + (isOpen(t) ? '<div class="mf-action-row">' + actions + '</div>' : '<div class="mf-footnote">该记录已结束，只读；修订以追加记录留痕。</div>'));
  }
  function historyCard(w, t) {
    const events = (w.history || []).map(x => ({ time: x.time, action: x.action, detail: x.detail }))
      .concat(t && t.history ? t.history.map(x => ({ time: x.time, action: x.action, detail: x.detail })) : [])
      .sort((a, b) => new Date(a.time) - new Date(b.time));
    const shown = state.historyOpen ? events : events.slice(-3);
    return card('三、处理记录', (events.length ? '<ol class="mf-timeline">' + shown.map(e => '<li class="mf-timeline-item"><div class="mf-timeline-time">' + time(e.time) + '</div><div class="mf-timeline-title">' + esc(e.action) + '</div><div class="mf-timeline-desc">' + esc(e.detail) + '</div></li>').join('') + '</ol>' : '<div class="mf-secondary">暂无处理记录。</div>')
      + (events.length > 3 ? '<div class="mf-history-toggle">' + button(state.historyOpen ? '收起记录' : '展开全部 ' + events.length + ' 条记录', 'toggle-history', '', 'small subtle') + '</div>' : ''));
  }
  function recordModal(w) {
    return '<div class="mf-modal-mask mf-detail-layer" data-mf="close-record"><div class="mf-modal mf-root" role="dialog" aria-modal="true"><div class="mf-modal-head"><h2>补充处理记录</h2><button type="button" class="mf-close" aria-label="关闭" data-mf="close-record">×</button></div>'
      + '<div class="mf-modal-body"><label class="mf-field"><span>处理说明</span><textarea id="mf-record-note" rows="4" placeholder="说明本次查看情况、核对结果或补充事项"></textarea></label>'
      + '<div class="mf-file-note">该记录追加到「处理记录」，不改变当前处理状态，也不发送外部通知。</div></div>'
      + '<div class="mf-modal-foot">' + button('取消', 'close-record', '', 'subtle') + button('保存记录', 'save-record', w.id, 'primary') + '</div></div></div>';
  }

  /* ---------- 页面二：预警统计 ---------- */
  function statsList() {
    return W().filter(w => (state.statLayer === 'ALL' || w.type === state.statLayer) && (!state.statOrg || orgOf(w) === state.statOrg)
      && (!state.statFrom || new Date(w.triggerTime) >= new Date(state.statFrom + 'T00:00:00'))
      && (!state.statTo || new Date(w.triggerTime) <= new Date(state.statTo + 'T23:59:59.999')));
  }
  function barCard(title, items) {
    const max = Math.max(1, ...items.map(x => x.n));
    return card(title, '<div class="mf-bars">' + items.map(x => '<div class="mf-bar-row"><span class="mf-bar-label">' + esc(x.name) + '</span><span class="mf-bar-track"><span class="mf-bar-fill" style="width:' + (x.n / max * 100).toFixed(1) + '%"></span></span><strong class="mf-bar-value">' + x.n + '</strong></div>').join('') + '</div>');
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
        + '<td>' + statusBadge(t) + '</td><td class="mf-clamp2">' + esc(outcome) + '</td><td>' + esc(person) + '</td><td class="mf-nowrap">' + esc(end) + '</td></tr>';
    }).join('');
    return card('处理结果明细', '<div class="mf-table-wrap"><table class="mf-table mf-outcome-table"><thead><tr><th>预警事项</th><th>状态</th><th>处理结论 / 当前环节</th><th>处理人 / 岗位</th><th>完成或时限</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="5">' + empty() + '</td></tr>') + '</tbody></table></div>', '最近 8 条，已完成与待复核优先；点击事项进入详情');
  }
  function renderStats() {
    const list = statsList();
    const s = summaryOf(list);
    const groups = new Map();
    list.forEach(w => {
      const k = orgOf(w) || '未归属';
      if (!groups.has(k)) groups.set(k, { org: k, total: 0, open: 0, closed: 0, late: 0 });
      const g = groups.get(k); const t = ticketOf(w.id); g.total++;
      if (t && t.status === 'CLOSED') g.closed++; else if (t && !isObserve(w)) g.open++;
      if (overdue(t)) g.late++;
    });
    const rows = [...groups.values()].sort((a, b) => b.late - a.late || b.total - a.total).map(g => '<tr><td><button type="button" class="mf-link"' + attrs('drill-org', g.org) + '>' + esc(g.org) + '</button></td><td class="mf-num">' + g.total + '</td><td class="mf-num">' + g.open + '</td><td class="mf-num">' + g.closed + '</td><td class="mf-num">' + (g.late ? badge(String(g.late), 'red') : '0') + '</td></tr>').join('');
    const kpi = (label, value, action) => '<button type="button" class="mf-kpi"' + attrs(action) + '><span class="mf-kpi-label">' + esc(label) + '</span><strong class="mf-kpi-value">' + esc(value) + '</strong></button>';
    const filters = dateRangeField('statFrom', 'statTo') + field('机构', 'statOrg', orgOptions()) + field('业务类型', 'statLayer', [['ALL', '全部类型']].concat(TYPES.map(k => [k, layerName(k)])));
    return '<div class="mf-root">' + head(PAGE_NAMES['mf-stats'], '统一查看预警数量、处理分布和机构情况；点击数字进入对应记录。', button('导出统计', 'export-stats', '', 'subtle'))
      + filterBox('stats', filters, button('查询', 'query-stats', '', 'primary') + button('重置', 'reset-stats', '', 'subtle'))
      + '<div class="mf-kpis">' + kpi('预警总数', s.total, 'drill-all') + kpi('未结束数', s.open, 'drill-open') + kpi('已结束数', s.closed, 'drill-closed') + '</div>'
      + '<div class="mf-two-col">' + barCard('业务类型分布', TYPES.map(k => ({ name: layerName(k), n: list.filter(w => w.type === k).length })))
      + barCard('当前处理状态分布', ['PENDING', 'PROCESSING', 'FEEDBACK', 'ESCALATED', 'CLOSED'].map(k => ({ name: k === 'ESCALATED' ? '处理中（已转办）' : STATUS[k], n: list.filter(w => { const t = ticketOf(w.id); return t && t.status === k; }).length }))) + '</div>'
      + outcomeCard(list)
      + card('机构预警情况', '<div class="mf-table-wrap"><table class="mf-table"><thead><tr><th>机构</th><th class="mf-num">预警数</th><th class="mf-num">未结束</th><th class="mf-num">已结束</th><th class="mf-num">超时未结束</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">' + empty('当前条件下暂无记录') + '</td></tr>') + '</tbody></table></div>', '同一批预警按触发时间确定范围，再统计当前处理结果')
      + '<div class="mf-footnote">超时未结束 = 未结束且有有效截止时间、已超过截止时间的记录；观察性线索不自动计入处理积压。</div></div>';
  }

  /* ---------- 页面三：规则配置 ---------- */
  function visibleRules() {
    const kw = String(state.ruleKeyword || '').trim().toLowerCase();
    return R().filter(r => (state.ruleLayer === 'ALL' || r.warningType === state.ruleLayer) && (state.ruleEnabled === 'ALL' || r.isEnabled === (state.ruleEnabled === 'ON')) && (!kw || [r.id, r.ruleName, r.monitorPoint].join(' ').toLowerCase().includes(kw)));
  }
  function renderRules() {
    const list = visibleRules();
    const maxPage = Math.max(1, Math.ceil(list.length / state.rulePageSize));
    state.rulePageNo = Math.min(state.rulePageNo, maxPage);
    const rows = list.slice((state.rulePageNo - 1) * state.rulePageSize, state.rulePageNo * state.rulePageSize).map(r => '<tr><td><div class="mf-cell-main">' + esc(r.ruleName) + '</div><div class="mf-secondary">' + esc(r.id) + '</div></td>'
      + '<td><span class="mf-indicator">' + esc(indicatorName(indicatorOf({ ruleId: r.id }))) + '</span></td>'
      + '<td>' + typeText(r.warningType) + '</td><td class="mf-clamp2">' + esc(r.dimensionScope || '—') + '</td><td class="mf-num">' + esc(String(r.thresholdValue) + (r.unit || '') + ' · 样本≥' + (r.minSampleSize == null ? '—' : r.minSampleSize)) + '</td>'
      + '<td>' + esc(r.observeWindow || '—') + '</td><td>' + badge(r.isEnabled ? '启用' : '停用', r.isEnabled ? 'green' : 'gray') + '</td><td class="mf-col-actions">' + button('查看', 'view-rule', r.id, 'small subtle') + '</td></tr>').join('');
    const filters = field('业务类型', 'ruleLayer', [['ALL', '全部类型']].concat(TYPES.map(k => [k, layerName(k)]))) + field('启停状态', 'ruleEnabled', [['ALL', '全部'], ['ON', '启用'], ['OFF', '停用']]) + searchField('关键词', '规则名称或编号', 'mf-rule-search', state.ruleKeyword);
    return '<div class="mf-root">' + head(PAGE_NAMES['mf-rules'], '统一查看预警规则、判定条件与版本；历史预警保留触发时的参数。', button('重跑规则', 'run-rules', '', 'subtle') + button('导出规则', 'export-rules', '', 'primary'))
      + filterBox('rules', filters, button('查询', 'query-rules', '', 'primary') + button('重置', 'reset-rules', '', 'subtle'))
      + '<div class="mf-table-wrap"><table class="mf-table"><thead><tr><th>规则名称</th><th>核心指标</th><th>业务类型</th><th>适用对象</th><th class="mf-num">判定条件</th><th>执行周期</th><th>状态</th><th class="mf-col-actions">操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8">' + empty('暂无符合条件的规则') + '</td></tr>') + '</tbody></table></div>'
      + '<div class="mf-pagination"><span class="mf-result-count">共 ' + list.length + ' 条规则</span><div class="mf-toolbar">' + button('上一页', 'rules-page', String(state.rulePageNo - 1), 'small', state.rulePageNo <= 1) + '<span class="mf-secondary">' + state.rulePageNo + ' / ' + maxPage + '</span>' + button('下一页', 'rules-page', String(state.rulePageNo + 1), 'small', state.rulePageNo >= maxPage) + '</div></div>'
      + '<div class="mf-footnote">示例阈值只用于原型演示，未经确认不能作为法定红线或处罚标准。</div></div>';
  }

  function renderCurrent() {
    const box = document.getElementById('pageContainer');
    if (!box || !own(state.page)) return;
    if (!window.warnings || !window.tickets || !window.rules) { box.innerHTML = '<div class="mf-root">' + empty('共享预警模块未加载，请刷新页面后重试') + '</div>'; return; }
    box.innerHTML = state.page === 'mf-stats' ? renderStats() : state.page === 'mf-rules' ? renderRules() : (state.detailId ? renderDetail() : renderRecords());
    if (window.updateBreadcrumb) window.updateBreadcrumb(state.page);
  }
  function resetRecords() { Object.assign(state, { layer: 'ALL', status: 'ALL', severity: 'ALL', keyword: '', dateFrom: '', dateTo: '', organization: '', rule: '', indicator: 'ALL', sort: 'core', overdueOnly: false, pageNo: 1, statOpenOnly: false }); }
  function resetStats() { Object.assign(state, { statLayer: 'ALL', statFrom: '', statTo: '', statOrg: '' }); }
  function resetRules() { Object.assign(state, { ruleLayer: 'ALL', ruleEnabled: 'ALL', ruleKeyword: '', rulePageNo: 1 }); }
  function goto(page) {
    if (LEGACY[page]) page = LEGACY[page];
    if (!own(page)) return;
    if (window.closeWarningModals) window.closeWarningModals();
    state.detailId = ''; state.logOpen = false; state.historyOpen = false; state.evidenceOpen = false;
    resetRecords(); resetStats(); resetRules();
    state.page = page;
    try { history.replaceState(null, '', '#' + page); } catch (_) {}
    if (window.navigateTo) window.navigateTo(page); else renderCurrent();
    const mc = document.getElementById('mainContent'); if (mc) mc.scrollTop = 0;
  }
  function openDetail(id) {
    if (!warning(id)) { notify('未找到这条预警', true); return; }
    state.page = 'mf-records'; state.detailId = id; state.historyOpen = false; state.evidenceOpen = false;
    try { history.replaceState(null, '', '#mf-record|' + id); } catch (_) {}
    renderCurrent();
    const mc = document.getElementById('mainContent'); if (mc) mc.scrollTop = 0;
  }
  function backToRecords() { state.detailId = ''; state.logOpen = false; try { history.replaceState(null, '', '#mf-records'); } catch (_) {} renderCurrent(); }
  function drillStats(kind) {
    resetRecords();
    Object.assign(state, { organization: state.statOrg, layer: state.statLayer, dateFrom: state.statFrom, dateTo: state.statTo, statOpenOnly: kind === 'open' });
    if (kind === 'closed') state.status = 'CLOSED';
    const filters = { ...state }; state.page = 'mf-records'; state.detailId = '';
    try { history.replaceState(null, '', '#mf-records'); } catch (_) {}
    if (window.navigateTo) window.navigateTo('mf-records'); else renderCurrent();
    if (kind === 'open') {
      void filters;
      const box = document.getElementById('pageContainer'); if (!box) return;
      const list = filteredWarnings().filter(w => { const t = ticketOf(w.id); return t && t.status !== 'CLOSED'; });
      state.statOpenOnly = true;
      box.innerHTML = box.innerHTML.replace(/共 [\d]+ 条记录，按触发时间倒序/g, '共 ' + list.length + ' 条未结束记录');
    }
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
    t.history.push({ time: new Date(), action: '添加会话材料', detail: incoming.map(f => f.name).join('、') + '（原型本地材料，未上传服务器）' });
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
    download('预警记录.csv', csv([['预警编号', '预警事项', '预警对象', '业务类型', '级别', '实际值', '触发阈值', '状态', '处理结论', '处理人 / 岗位', '截止或结束时间', '触发时间']].concat(list.map(w => { const t = ticketOf(w.id); return [w.id, w.ruleName, orgOf(w), layerName(w.type), SEVERITY[w.severity], w.metricLabel, w.thresholdSnapshot, statusText(t), t ? (t.verificationResult || '') : '', t ? (t.assigneeUser || t.ownerRole || '') : '', t ? (t.status === 'CLOSED' ? time(t.closedAt) : t.slaDeadline ? time(t.slaDeadline) : '') : '', time(w.triggerTime)]; }))), 'text/csv;charset=utf-8');
    notify('已导出当前查询结果 ' + list.length + ' 条');
  }
  function exportStats() {
    const s = summaryOf(statsList());
    download('预警统计.csv', csv([['指标', '数值'], ['预警总数', s.total], ['未结束数', s.open], ['已结束数', s.closed], ['超时未结束', s.late]]), 'text/csv;charset=utf-8'); notify('已导出当前统计结果');
  }
  function exportRules() {
    const list = visibleRules();
    download('预警规则.csv', csv([['规则编号', '规则名称', '业务类型', '适用对象', '判定条件', '执行周期', '状态', '版本']].concat(list.map(r => [r.id, r.ruleName, layerName(r.warningType), r.dimensionScope || '', String(r.thresholdValue) + (r.unit || '') + ' · 样本≥' + r.minSampleSize, r.observeWindow || '', r.isEnabled ? '启用' : '停用', 'v' + (r.history || []).length]))), 'text/csv;charset=utf-8'); notify('已导出当前规则 ' + list.length + ' 条');
  }

  /* ---------- 事件 ---------- */
  function handle(action, id) {
    switch (action) {
      case 'query-records': { const e = document.getElementById('mf-search'); if (e) state.keyword = e.value.trim(); state.pageNo = 1; renderCurrent(); break; }
      case 'reset-records': resetRecords(); renderCurrent(); break;
      case 'toggle-advanced': { const e = document.getElementById('mf-search'); if (e) state.keyword = e.value; state.advanced = !state.advanced; renderCurrent(); break; }
      case 'records-page': state.pageNo = Math.max(1, Number(id) || 1); renderCurrent(); break;
      case 'open-detail': openDetail(id); break;
      case 'back-records': backToRecords(); break;
      case 'toggle-history': state.historyOpen = !state.historyOpen; renderCurrent(); break;
      case 'toggle-evidence': state.evidenceOpen = !state.evidenceOpen; renderCurrent(); break;
      case 'add-record': state.logOpen = true; renderCurrent(); { const ta = document.getElementById('mf-record-note'); if (ta) ta.focus(); } break;
      case 'close-record': state.logOpen = false; renderCurrent(); break;
      case 'save-record': {
        const ta = document.getElementById('mf-record-note'); const note = ta ? ta.value.trim() : '';
        const w = warning(id); if (!w) break;
        if (!note) { notify('请填写处理说明', true); break; }
        w.history.push({ time: new Date(), action: '补充处理记录', detail: note + '（仅追加记录，不改变状态）' });
        state.logOpen = false; state.historyOpen = true; notify('处理记录已保存'); renderCurrent(); break;
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
        if (isPreview(warning(t.warningId))) { notify('季度线索不能直接复核结束，须待年度数据重新核查', true); break; }
        if (window.closeWarningModals) window.closeWarningModals(); window.openReviewModal(id); break;
      }
      case 'query-stats': { const e = document.getElementById('mf-search'); if (e) state.keyword = ''; renderCurrent(); break; }
      case 'reset-stats': resetStats(); renderCurrent(); break;
      case 'drill-all': drillStats('all'); break;
      case 'drill-open': drillStats('open'); break;
      case 'drill-closed': drillStats('closed'); break;
      case 'drill-org': resetRecords(); Object.assign(state, { organization: id, layer: state.statLayer, dateFrom: state.statFrom, dateTo: state.statTo }); state.page = 'mf-records'; if (window.navigateTo) window.navigateTo('mf-records'); else renderCurrent(); break;
      case 'query-rules': { const e = document.getElementById('mf-rule-search'); if (e) state.ruleKeyword = e.value.trim(); state.rulePageNo = 1; renderCurrent(); break; }
      case 'reset-rules': resetRules(); renderCurrent(); break;
      case 'rules-page': state.rulePageNo = Math.max(1, Number(id) || 1); renderCurrent(); break;
      case 'view-rule': if (typeof window.openRuleModal === 'function') { if (window.closeWarningModals) window.closeWarningModals(); window.openRuleModal(id); } break;
      case 'run-rules': window.runAllEngines(); break;
      case 'export-records': exportRecords(); break;
      case 'export-stats': exportStats(); break;
      case 'export-rules': exportRules(); break;
      case 'download-file': { const p = id.split('|'); const f = (materials.get(p[0]) || [])[Number(p[1])]; if (f) download(f.file.name, f.file); break; }
    }
  }
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-mf]'); if (!el) return;
    if (el.tagName === 'BUTTON' || el.tagName === 'A') e.preventDefault();
    handle(el.getAttribute('data-mf'), el.getAttribute('data-id') || '');
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
    if (el.hasAttribute('data-mf-files')) { addMaterials(el.getAttribute('data-mf-files'), el.files); return; }
    const check = el.getAttribute('data-mf-check');
    if (check === 'overdueOnly') { state.overdueOnly = el.checked; state.pageNo = 1; renderCurrent(); return; }
    const key = el.getAttribute('data-mf-field'); if (!key) return;
    if (!Object.prototype.hasOwnProperty.call(state, key)) return;
    state[key] = el.value;
    if (key === 'ruleLayer' || key === 'ruleEnabled') state.rulePageNo = 1; else state.pageNo = 1;
    if (state.dateFrom && state.dateTo && state.dateFrom > state.dateTo) { state.dateTo = ''; notify('结束日期不能早于开始日期，已清空结束条件', true); }
    renderCurrent();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.logOpen) { e.preventDefault(); handle('close-record'); }
  });

  /* ---------- 与原模块衔接 ---------- */
  function inFusion() { return own(state.page) && !!document.querySelector('#pageContainer .mf-root'); }
  function wireLegacy() {
    const baseRender = window.renderPage;
    window.renderPage = function (id) {
      if (typeof id === 'string' && (id === 'mf-record' || id.indexOf('mf-record|') === 0)) { state.page = 'mf-records'; openDetail(id.split('|')[1]); return; }
      if (LEGACY[id]) { goto(LEGACY[id]); return; }
      if (own(id)) { if (state.page !== id) { state.detailId = ''; resetRecords(); resetStats(); resetRules(); } state.page = id; renderCurrent(); return; }
      if (bridgeDepth > 0 && inFusion()) { renderCurrent(); return; }
      state.page = ''; state.detailId = '';
      return baseRender.apply(this, arguments);
    };
    ['receiveTicket', 'submitFeedback', 'closeTicket', 'returnTicket', 'runAllEngines', 'scanOverdue'].forEach(name => {
      const original = window[name]; if (typeof original !== 'function') return;
      window[name] = function () {
        if (!inFusion()) return original.apply(this, arguments);
        bridgeDepth++;
        try { return original.apply(this, arguments); } finally { bridgeDepth--; }
      };
    });
  }
  wireLegacy();
  window.MonitorUnified = { pageIds: Object.keys(PAGE_NAMES), render: renderCurrent, getState: () => ({ ...state }), records: filteredWarnings, summary: () => summaryOf(statsList()), openDetail, backToRecords };
})();
