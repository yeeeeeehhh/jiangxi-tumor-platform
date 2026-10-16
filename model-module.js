/*
 * 预警处置成效看板（2026-10 重构，方向一）
 * ------------------------------------------------------------------
 * 定位：站在省级登记中心"管全省、抓督导"视角，看预警报出来之后办得怎么样。
 * 现有页面是单条视角——「预警规则配置」配规则、「预警记录」看报警、「处置工单」逐条办；
 * 本模块补的是全局分析/督导视角，数据全部来自真实的 window.warnings / window.tickets，
 * 不另造一套，不与上述页面重复。
 *
 *   mdl-features    处置总览        —— 全省一屏：核心KPI + 层级分布 + 月度趋势 + 重点待办
 *   mdl-registry    责任方督导      —— 按机构/登记处排名：报警/办结率/超期/时长/误报，红黑榜
 *   mdl-training    时限达成管理    —— SLA 视角：各层按时办结率、临期/超期/已升级清单
 *   mdl-predictions 结论与整改成效  —— 复核结论口径分布、整改闭环、误报归因
 *   mdl-evaluation  规则命中与误报  —— 按规则触发/误报率/有效率，指向阈值校准
 */
(function () {
  'use strict';

  const OWNED_IDS = ['mdl-features', 'mdl-registry', 'mdl-training', 'mdl-predictions', 'mdl-evaluation'];

  const style = document.createElement('style');
  style.textContent = `
#pageContainer .md-page{padding-bottom:20px}
#pageContainer .md-card{background:#fff;border:1px solid var(--border);border-radius:6px;margin-bottom:14px;overflow:hidden}
#pageContainer .md-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;border-bottom:1px solid var(--border);background:#fbfcfe}
#pageContainer .md-card-title{font-size:14px;font-weight:600;color:#1e293b;display:flex;align-items:baseline;gap:8px}
#pageContainer .md-card-sub{font-size:11px;font-weight:400;color:#94a3b8}
#pageContainer .md-card-body{padding:13px 14px}
#pageContainer .md-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}
@media(max-width:1180px){#pageContainer .md-grid2{grid-template-columns:1fr}}
#pageContainer .md-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:14px}
@media(max-width:1200px){#pageContainer .md-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:720px){#pageContainer .md-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
#pageContainer .md-kpi{padding:12px 13px;background:#fff;border:1px solid var(--border);border-radius:7px}
#pageContainer .md-kpi-label{font-size:12px;color:#667085;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pageContainer .md-kpi-value{margin-top:6px;font-size:23px;line-height:1;font-weight:700;color:#244765}
#pageContainer .md-kpi-value.danger{color:#b42335}
#pageContainer .md-kpi-value.warn{color:#b54708}
#pageContainer .md-kpi-value.ok{color:#15803d}
#pageContainer .md-kpi-meta{margin-top:6px;font-size:11px;color:#94a3b8}
#pageContainer .md-filter{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 12px;padding:12px 14px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;margin-bottom:12px}
#pageContainer .md-filter .form-group{flex:1 1 190px;min-width:150px;max-width:420px;margin:0}
#pageContainer .md-filter .filter-actions{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;flex:0 0 auto;margin-left:auto}
#pageContainer .md-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:6px;background:#fff}
#pageContainer .md-table{width:100%;min-width:1000px;border-collapse:collapse}
#pageContainer .md-table th{height:40px;padding:0 11px;text-align:left;background:#f8fafc;color:#5b6673;font-size:12px;font-weight:600;border-bottom:1px solid var(--border);white-space:nowrap;vertical-align:middle}
#pageContainer .md-table td{height:auto;min-height:44px;padding:7px 11px;border-bottom:1px solid var(--border);color:#334155;font-size:13px;vertical-align:middle}
#pageContainer .md-table th.num,#pageContainer .md-table td.num{text-align:right;font-variant-numeric:tabular-nums}
#pageContainer .md-table th.txt,#pageContainer .md-table td.txt{text-align:left}
#pageContainer .md-table th.code,#pageContainer .md-table td.code{text-align:center}
#pageContainer .md-table th.ops,#pageContainer .md-table td.ops{text-align:center;white-space:nowrap}
#pageContainer .md-table td.md-nowrap{white-space:nowrap}
#pageContainer .md-table tbody tr:hover{background:#f5f9ff}
#pageContainer .md-table .badge{white-space:nowrap}
#pageContainer .md-id{background:none;border:0;padding:0;color:var(--primary);font-weight:600;font-size:13px;cursor:pointer}
#pageContainer .md-id:hover{text-decoration:underline}
#pageContainer .md-sec{font-size:11px;color:#94a3b8;margin-top:3px;line-height:1.5}
#pageContainer .md-note{font-size:11px;color:#94a3b8;line-height:1.8}
#pageContainer .md-callout{border:1px solid #cfe0f5;border-left:3px solid var(--primary);background:#f4f9ff;border-radius:5px;padding:10px 12px;font-size:12px;color:#334155;line-height:1.85}
#pageContainer .md-callout.warn{border-color:#f2cf73;border-left-color:#f4b400;background:#fff8e6;color:#594414}
#pageContainer .md-callout.ok{border-color:#abefc6;border-left-color:#16a34a;background:#ecfdf3;color:#14532d}
#pageContainer .md-chip{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:11px;background:#eef2f7;color:#475569;font-size:11px;font-weight:600;margin:2px 4px 2px 0}
#pageContainer .md-chip.a{background:#e8f1fd;color:#1d4ed8}
#pageContainer .md-chip.b{background:#fff4e5;color:#b54708}
#pageContainer .md-chip.c{background:#fdeaec;color:#b42335}
#pageContainer .md-pivot{width:100%;border-collapse:collapse;font-size:12px}
#pageContainer .md-pivot th,#pageContainer .md-pivot td{border:1px solid var(--border);padding:6px 9px;text-align:right;white-space:nowrap}
#pageContainer .md-pivot th{background:#f8fafc;color:#5b6673;font-weight:600}
#pageContainer .md-pivot th:first-child,#pageContainer .md-pivot td:first-child{text-align:left}
#pageContainer .md-pivot th.txt,#pageContainer .md-pivot td.txt{text-align:left}
#pageContainer .md-pivot th.code,#pageContainer .md-pivot td.code{text-align:center}
#pageContainer .md-pivot th.num,#pageContainer .md-pivot td.num{text-align:right;font-variant-numeric:tabular-nums}
#pageContainer .md-empty{padding:30px;text-align:center;color:#94a3b8;font-size:13px}
#pageContainer .md-bar{height:7px;border-radius:4px;background:#eef2f7;overflow:hidden;min-width:70px}
#pageContainer .md-bar>i{display:block;height:100%;background:var(--primary)}
#pageContainer .md-bar>i.warn{background:#f59e0b}
#pageContainer .md-bar>i.bad{background:#dc2626}
#pageContainer .md-bar>i.ok{background:#16a34a}
#pageContainer .md-rate{display:flex;align-items:center;gap:8px;justify-content:flex-end}
#pageContainer .md-rate span{font-variant-numeric:tabular-nums;min-width:40px;text-align:right}
#pageContainer .md-trend{display:flex;align-items:flex-end;gap:8px;height:150px;padding:6px 2px 0}
#pageContainer .md-trend-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}
#pageContainer .md-trend-bars{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center;gap:3px}
#pageContainer .md-trend-bar{width:14px;border-radius:3px 3px 0 0;background:var(--primary);min-height:2px}
#pageContainer .md-trend-bar.closed{background:#16a34a}
#pageContainer .md-trend-lab{font-size:10.5px;color:#94a3b8;white-space:nowrap}
#pageContainer .md-trend-val{font-size:11px;color:#475569;font-weight:600}
#pageContainer .md-legend{display:flex;gap:14px;margin-top:8px;font-size:11px;color:#64748b}
#pageContainer .md-legend span{display:inline-flex;align-items:center;gap:5px}
#pageContainer .md-legend i{width:12px;height:8px;border-radius:2px;display:inline-block}
#pageContainer .md-rank{display:flex;flex-direction:column;gap:9px}
#pageContainer .md-rank-item{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 11px;border:1px solid var(--border);border-radius:6px;background:#fbfcfe}
#pageContainer .md-rank-no{width:22px;height:22px;border-radius:50%;background:#eef2f7;color:#475569;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
#pageContainer .md-rank-no.top{background:#fdeaec;color:#b42335}
#pageContainer .md-rank-name{font-size:13px;color:#1e293b;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#pageContainer .md-rank-sub{font-size:11px;color:#94a3b8;margin-top:2px}
#pageContainer .md-rank-val{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
#pageContainer .md-donut-wrap{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
#pageContainer .md-donut-legend{display:flex;flex-direction:column;gap:7px;font-size:12px;color:#475569}
#pageContainer .md-donut-legend span{display:inline-flex;align-items:center;gap:7px}
#pageContainer .md-donut-legend i{width:11px;height:11px;border-radius:3px;display:inline-block}
`;
  document.head.appendChild(style);

  const LAYER = {
    REGISTRY_OPERATION: { code: 'A', short: '运行监测', cls: 'a' },
    REGISTRY_QUALITY: { code: 'B', short: '质量预警', cls: 'b' },
    DISEASE_SIGNAL: { code: 'C', short: '信号研判', cls: 'c' }
  };
  const LAYER_KEYS = ['REGISTRY_OPERATION', 'REGISTRY_QUALITY', 'DISEASE_SIGNAL'];
  const SEV = {
    URGENT: { label: '紧急级', cls: 'badge-danger' },
    ATTENTION: { label: '关注级', cls: 'badge-warning' },
    INFO: { label: '提示级', cls: 'badge-muted' }
  };
  const STATUS_LABEL = { PENDING: '待处理', PROCESSING: '处理中', FEEDBACK: '已反馈', CLOSED: '已关闭', ESCALATED: '已升级' };
  const CITY_NAMES = ['南昌市', '赣州市', '九江市', '上饶市', '宜春市', '吉安市', '抚州市', '萍乡市', '新余市', '鹰潭市', '景德镇市'];

  const state = {
    page: 'mdl-features',
    reg: { layer: 'ALL', sort: 'open', keyword: '' },
    sla: { layer: 'ALL' },
    conc: { layer: 'ALL' },
    rule: { layer: 'ALL' }
  };

  /* ============ 工具 ============ */
  function esc(v) { const d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function pct(part, whole) { return whole ? Math.round(part / whole * 100) : 0; }
  function mdToast(m, t) { if (typeof toast === 'function') toast(m, t); }
  function layerBadge(type) { const m = LAYER[type]; return m ? '<span class="md-chip ' + m.cls + '">' + m.code + ' · ' + m.short + '</span>' : '-'; }
  function sevBadge(sev) { const m = SEV[sev] || SEV.INFO; return '<span class="badge ' + m.cls + '">' + m.label + '</span>'; }
  function statusLabel(s) { return STATUS_LABEL[s] || s || '-'; }
  function cityOf(str) { for (let i = 0; i < CITY_NAMES.length; i++) { if (String(str || '').indexOf(CITY_NAMES[i]) >= 0) return CITY_NAMES[i]; } return '其他'; }

  function getWarnings() { return (window.warnings || []).slice(); }
  function getTickets() { return (window.tickets || []).slice(); }
  function getRules() { return (window.rules || []).slice(); }
  function hasData() { return !!(window.tickets && window.warnings); }
  function warnOf(t) { return (window.findWarning && window.findWarning(t.warningId)) || getWarnings().find(function (w) { return w.id === t.warningId; }) || {}; }

  function isClosed(t) { return t.status === 'CLOSED'; }
  function isOpen(t) { return t.status !== 'CLOSED'; }
  function isOverdue(t) { return isOpen(t) && t.slaDeadline && new Date(t.slaDeadline).getTime() < Date.now(); }
  function isOnTimeClosed(t) { return isClosed(t) && (!t.slaDeadline || !t.closedAt || new Date(t.closedAt).getTime() <= new Date(t.slaDeadline).getTime()); }
  function isFalsePositive(t) { return (t.verificationResult || '') === '误报'; }
  function daysBetween(a, b) { if (!a || !b) return null; const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000; return d >= 0 ? d : null; }
  function procDays(t) { return isClosed(t) ? daysBetween(t.createdAt, t.closedAt) : null; }

  function mdSet(group, key, value) { state[group][key] = value; renderPage(state.page); }
  function kpi(label, value, meta, tone) {
    return '<div class="md-kpi"><div class="md-kpi-label">' + esc(label) + '</div><div class="md-kpi-value ' + (tone || '') + '">' + value + '</div><div class="md-kpi-meta">' + esc(meta || '') + '</div></div>';
  }
  function layerTabs(current, group) {
    return [['ALL', '全部']].concat(LAYER_KEYS.map(function (k) { return [k, LAYER[k].code + ' ' + LAYER[k].short]; }))
      .map(function (o) {
        return '<button class="btn ' + (current === o[0] ? 'btn-primary' : 'btn-outline') + ' btn-sm" onclick="mdSet(\'' + group + '\',\'layer\',\'' + o[0] + '\')">' + esc(o[1]) + '</button>';
      }).join(' ');
  }
  function rateCell(num, den, invert) {
    if (!den) return '<span class="md-note">—</span>';
    const r = pct(num, den);
    const tone = invert ? (r >= 50 ? 'bad' : r >= 25 ? 'warn' : 'ok') : (r >= 85 ? 'ok' : r >= 60 ? 'warn' : 'bad');
    return '<div class="md-rate"><span>' + r + '%</span><div class="md-bar" style="width:72px"><i class="' + tone + '" style="width:' + r + '%"></i></div></div>';
  }
  function emptyDependency(name) {
    return '<div class="md-page"><div class="md-card"><div class="md-card-body"><div class="md-callout warn">' +
      '「' + esc(name) + '」依赖「预警监测与处置」模块的预警与工单数据。请确认 warning-module.js 已正常加载，或先打开一次「预警记录 / 处置工单」后重试。' +
      '</div></div></div></div>';
  }

  /* 月度趋势（近 6 个月）：按 createdAt 的新增数 与 按 closedAt 的办结数 */
  function monthKey(d) { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); }
  function recentMonths(n) {
    const arr = []; const now = new Date();
    for (let i = n - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); arr.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
    return arr;
  }

  /* ==================== 页面 1：处置总览 ==================== */
  function renderFeatures() {
    if (!hasData()) return emptyDependency('处置总览');
    const tickets = getTickets();
    const total = tickets.length;
    const open = tickets.filter(isOpen).length;
    const closed = tickets.filter(isClosed).length;
    const overdue = tickets.filter(isOverdue).length;
    const escalated = tickets.filter(function (t) { return t.status === 'ESCALATED'; }).length;
    const reviewed = tickets.filter(isClosed).length;
    const onTime = tickets.filter(isOnTimeClosed).length;
    const fp = tickets.filter(function (t) { return isClosed(t) && isFalsePositive(t); }).length;
    const onTimeRate = pct(onTime, closed);
    const fpRate = pct(fp, reviewed);

    const kpis = [
      kpi('累计预警', total, '全部层级工单'),
      kpi('在办', open, '未关闭', open ? 'warn' : 'ok'),
      kpi('超期未办', overdue, overdue ? '含已升级 ' + escalated + ' 件' : '无超期', overdue ? 'danger' : 'ok'),
      kpi('按时办结率', closed ? onTimeRate + '%' : '—', closed + ' 件已关闭', onTimeRate >= 85 ? 'ok' : onTimeRate >= 60 ? 'warn' : 'danger'),
      kpi('误报率', reviewed ? fpRate + '%' : '—', fp + ' / ' + reviewed + ' 复核', fpRate >= 40 ? 'danger' : fpRate >= 20 ? 'warn' : 'ok')
    ].join('');

    /* 层级 × 状态分布 */
    const layRows = LAYER_KEYS.map(function (k) {
      const sub = tickets.filter(function (t) { return t.type === k; });
      const o = sub.filter(isOpen).length, c = sub.filter(isClosed).length, od = sub.filter(isOverdue).length;
      return '<tr><td class="txt">' + layerBadge(k) + '</td><td class="num">' + sub.length + '</td><td class="num">' + o + '</td><td class="num">' + c + '</td><td class="num" style="color:' + (od ? '#b42335' : '#94a3b8') + '">' + od + '</td></tr>';
    }).join('');

    /* 月度趋势 */
    const months = recentMonths(6);
    const newByM = {}, closedByM = {};
    months.forEach(function (m) { newByM[m] = 0; closedByM[m] = 0; });
    tickets.forEach(function (t) { const mk = monthKey(t.createdAt); if (mk in newByM) newByM[mk]++; if (t.closedAt) { const ck = monthKey(t.closedAt); if (ck in closedByM) closedByM[ck]++; } });
    const maxV = Math.max(1, Math.max.apply(null, months.map(function (m) { return Math.max(newByM[m], closedByM[m]); })));
    const trend = '<div class="md-trend">' + months.map(function (m) {
      const nh = Math.round(newByM[m] / maxV * 120), ch = Math.round(closedByM[m] / maxV * 120);
      return '<div class="md-trend-col"><div class="md-trend-bars">' +
        '<div class="md-trend-bar" style="height:' + Math.max(2, nh) + 'px" title="新增 ' + newByM[m] + '"></div>' +
        '<div class="md-trend-bar closed" style="height:' + Math.max(2, ch) + 'px" title="办结 ' + closedByM[m] + '"></div>' +
        '</div><div class="md-trend-val">' + newByM[m] + '/' + closedByM[m] + '</div><div class="md-trend-lab">' + m.slice(2) + '</div></div>';
    }).join('') + '</div><div class="md-legend"><span><i style="background:var(--primary)"></i>新增</span><span><i style="background:#16a34a"></i>办结</span></div>';

    /* 重点待办清单：超期 + 紧急未关 */
    const focus = tickets.filter(function (t) { return isOverdue(t) || (t.severity === 'URGENT' && isOpen(t)); })
      .sort(function (a, b) { return (isOverdue(b) - isOverdue(a)) || (new Date(a.slaDeadline || 0) - new Date(b.slaDeadline || 0)); })
      .slice(0, 10);
    const hasDetail = typeof window.showTicketDetail === 'function';
    const focusRows = focus.length ? focus.map(function (t) {
      const w = warnOf(t);
      const op = hasDetail ? 'onclick="showTicketDetail(\'' + t.id + '\')"' : '';
      return '<tr>' +
        '<td class="md-nowrap">' + (hasDetail ? '<button class="md-id" ' + op + '>' + esc(t.id) + '</button>' : esc(t.id)) + '</td>' +
        '<td class="md-nowrap">' + layerBadge(t.type) + '</td>' +
        '<td>' + esc(w.targetLabel || t.ownerOrg || '-') + '<div class="md-sec">' + esc(w.ruleName || '') + '</div></td>' +
        '<td class="md-nowrap">' + sevBadge(t.severity) + '</td>' +
        '<td class="md-nowrap">' + statusLabel(t.status) + '</td>' +
        '<td class="md-nowrap" style="color:' + (isOverdue(t) ? '#b42335' : '#475569') + '">' + (isOverdue(t) ? '已超期' : '在办') + '<div class="md-sec">' + esc(t.ownerRole || '') + '</div></td>' +
        '<td class="md-nowrap">' + (hasDetail ? '<button class="btn btn-ghost btn-xs" ' + op + '>详情</button>' : '-') + '</td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="7"><div class="md-empty">当前无超期或紧急待办，处置状态良好</div></td></tr>';

    return '<div class="md-page">' +
      '<div class="md-kpis">' + kpis + '</div>' +
      '<div class="md-grid2">' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">层级 × 处置状态</div></div>' +
      '<div class="md-card-body" style="overflow:auto"><table class="md-pivot" style="width:100%"><thead><tr><th class="txt">层级</th><th class="num">合计</th><th class="num">在办</th><th class="num">已关闭</th><th class="num">超期</th></tr></thead><tbody>' + layRows + '</tbody></table>' +
      '<div class="md-note" style="margin-top:9px">A 运行监测月度、B 质量预警与 C 信号研判年度，层级越往后 SLA 周期越长。</div></div></div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">近 6 个月新增 / 办结趋势</div></div>' +
      '<div class="md-card-body">' + trend + '<div class="md-note" style="margin-top:9px">办结持续追平或高于新增，说明积压在收敛；反之需加派督导。</div></div></div>' +
      '</div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">重点待办<span class="md-card-sub">超期 + 紧急级未关闭，按紧迫度排序</span></div>' +
      '<button class="btn btn-outline btn-sm" onclick="navigateTo(\'warning-tickets\')">去处置工单</button></div>' +
      '<div class="md-table-wrap"><table class="md-table"><thead><tr><th class="txt">工单</th><th class="txt">层级</th><th class="txt">对象 / 规则</th><th class="code">级别</th><th class="code">状态</th><th class="txt">时限 / 责任方</th><th class="ops">操作</th></tr></thead><tbody>' + focusRows + '</tbody></table></div></div>' +
      '<div class="md-callout" style="margin-top:0">本看板所有数字来自「处置工单」的真实流转状态，与「预警记录」同源。它回答的是省级登记中心最关心的问题：<b>全省警报办得及不及时、哪里积压、谁家误报多</b>——配规则到「预警规则配置」，逐条处理到「处置工单」，本模块只做全局督导。</div>' +
      '</div>';
  }

  /* ==================== 页面 2：责任方督导 ==================== */
  function renderRegistry() {
    if (!hasData()) return emptyDependency('责任方督导');
    const f = state.reg, kw = f.keyword.trim().toLowerCase();
    const tickets = getTickets().filter(function (t) { return f.layer === 'ALL' || t.type === f.layer; });

    /* 按责任方(ownerOrg)聚合 */
    const map = {};
    tickets.forEach(function (t) {
      const org = t.ownerOrg || warnOf(t).responsibleEntity || '未知责任方';
      if (!map[org]) map[org] = { org: org, city: cityOf(org), total: 0, open: 0, closed: 0, overdue: 0, onTime: 0, fp: 0, reviewed: 0, days: [] };
      const m = map[org];
      m.total++;
      if (isOpen(t)) m.open++;
      if (isClosed(t)) { m.closed++; m.reviewed++; if (isOnTimeClosed(t)) m.onTime++; if (isFalsePositive(t)) m.fp++; const d = procDays(t); if (d != null) m.days.push(d); }
      if (isOverdue(t)) m.overdue++;
    });
    let list = Object.keys(map).map(function (k) {
      const m = map[k];
      m.onTimeRate = pct(m.onTime, m.closed);
      m.fpRate = pct(m.fp, m.reviewed);
      m.avgDays = m.days.length ? (m.days.reduce(function (a, b) { return a + b; }, 0) / m.days.length) : null;
      /* 督导风险分：超期权重最高，其次在办、误报 */
      m.risk = m.overdue * 5 + m.open * 2 + m.fp * 3 + (m.closed && m.onTimeRate < 60 ? 4 : 0);
      return m;
    });
    if (kw) list = list.filter(function (m) { return (m.org + ' ' + m.city).toLowerCase().includes(kw); });

    const sorters = {
      open: function (a, b) { return b.open - a.open || b.overdue - a.overdue; },
      overdue: function (a, b) { return b.overdue - a.overdue || b.open - a.open; },
      total: function (a, b) { return b.total - a.total; },
      ontime: function (a, b) { return a.onTimeRate - b.onTimeRate; },
      fp: function (a, b) { return b.fpRate - a.fpRate; },
      risk: function (a, b) { return b.risk - a.risk; }
    };
    list.sort(sorters[f.sort] || sorters.open);

    const rows = list.map(function (m) {
      return '<tr>' +
        '<td>' + esc(m.org) + '<div class="md-sec">' + esc(m.city) + '</div></td>' +
        '<td class="md-num">' + m.total + '</td>' +
        '<td class="md-num" style="color:' + (m.open ? '#b54708' : '#94a3b8') + '">' + m.open + '</td>' +
        '<td class="md-num" style="color:' + (m.overdue ? '#b42335' : '#94a3b8') + '">' + m.overdue + '</td>' +
        '<td class="md-num">' + rateCell(m.onTime, m.closed, false) + '</td>' +
        '<td class="md-num">' + (m.avgDays == null ? '<span class="md-note">—</span>' : m.avgDays.toFixed(1) + ' 天') + '</td>' +
        '<td class="md-num">' + rateCell(m.fp, m.reviewed, true) + '</td>' +
        '</tr>';
    }).join('');

    /* 红黑榜 */
    const needAttention = list.slice().sort(sorters.risk).filter(function (m) { return m.risk > 0; }).slice(0, 5);
    const goodOnes = list.filter(function (m) { return m.closed >= 1 && m.overdue === 0 && m.onTimeRate >= 80; }).sort(function (a, b) { return b.onTimeRate - a.onTimeRate || b.closed - a.closed; }).slice(0, 5);
    const rankItem = function (m, i, top) {
      return '<div class="md-rank-item"><div class="md-rank-no' + (top ? ' top' : '') + '">' + (i + 1) + '</div>' +
        '<div><div class="md-rank-name">' + esc(m.org) + '</div><div class="md-rank-sub">' + esc(m.city) + ' · 共 ' + m.total + ' 件</div></div>' +
        '<div class="md-rank-val" style="color:' + (top ? '#b42335' : '#15803d') + '">' + (top ? ('超期 ' + m.overdue + ' · 在办 ' + m.open) : (m.onTimeRate + '%')) + '</div></div>';
    };
    const blackList = needAttention.length ? '<div class="md-rank">' + needAttention.map(function (m, i) { return rankItem(m, i, true); }).join('') + '</div>' : '<div class="md-empty">暂无需重点督导的责任方</div>';
    const redList = goodOnes.length ? '<div class="md-rank">' + goodOnes.map(function (m, i) { return rankItem(m, i, false); }).join('') + '</div>' : '<div class="md-empty">暂无完成办结的责任方</div>';

    const sortOpts = [['open', '在办最多'], ['overdue', '超期最多'], ['total', '报警最多'], ['ontime', '办结率最低'], ['fp', '误报率最高'], ['risk', '督导风险最高']]
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.sort === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

    const kpis = [
      kpi('涉及责任方', list.length, '当前筛选层级'),
      kpi('有超期的', list.filter(function (m) { return m.overdue > 0; }).length, '需优先督办', list.some(function (m) { return m.overdue > 0; }) ? 'danger' : 'ok'),
      kpi('有在办的', list.filter(function (m) { return m.open > 0; }).length, '尚未清零'),
      kpi('零误报', list.filter(function (m) { return m.reviewed > 0 && m.fp === 0; }).length, '复核均属实'),
      kpi('涉及地市', (function () { const s = {}; list.forEach(function (m) { s[m.city] = 1; }); return Object.keys(s).length; })(), '全省分布')
    ].join('');

    return '<div class="md-page">' +
      '<div class="md-kpis">' + kpis + '</div>' +
      '<div class="md-filter">' +
      '<div style="flex:1 1 100%;display:flex;gap:6px;flex-wrap:wrap">' + layerTabs(f.layer, 'reg') + '</div>' +
      '<div class="form-group"><label>排序</label><select onchange="mdSet(\'reg\',\'sort\',this.value)">' + sortOpts + '</select></div>' +
      '<div class="form-group" style="flex-grow:1.4;max-width:460px"><label>检索</label><input value="' + esc(f.keyword) + '" placeholder="责任方 / 地市" onchange="mdSet(\'reg\',\'keyword\',this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="mdResetReg()">重置</button>' +
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'warning-tickets\')">去处置工单</button></div></div>' +
      '<div class="md-grid2">' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title" style="color:#b42335">⚠ 重点督导（黑榜）<span class="md-card-sub">超期/在办/误报综合风险最高</span></div></div><div class="md-card-body">' + blackList + '</div></div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title" style="color:#15803d">✓ 处置标杆（红榜）<span class="md-card-sub">按时办结率领先且无超期</span></div></div><div class="md-card-body">' + redList + '</div></div>' +
      '</div>' +
      '<div class="md-table-wrap"><table class="md-table" style="min-width:1040px"><thead><tr><th class="txt">责任方 / 地市</th><th class="num">报警数</th><th class="num">在办</th><th class="num">超期</th><th class="num">按时办结率</th><th class="num">平均处置时长</th><th class="num">误报率</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7"><div class="md-empty">当前筛选条件下无数据</div></td></tr>') + '</tbody></table></div>' +
      '<div class="md-note" style="margin-top:8px">平均处置时长 = 已关闭工单（关闭时间−创建时间）的均值；按时办结率 = 在 SLA 截止前关闭的占比；误报率越高说明该责任方对应的规则阈值可能偏松，可在「规则命中与误报」页复核。</div>' +
      '</div>';
  }
  function mdResetReg() { state.reg = { layer: 'ALL', sort: 'open', keyword: '' }; renderPage(state.page); }

  /* ==================== 页面 3：时限达成管理 ==================== */
  function renderTraining() {
    if (!hasData()) return emptyDependency('时限达成管理');
    const f = state.sla;
    const tickets = getTickets().filter(function (t) { return f.layer === 'ALL' || t.type === f.layer; });
    const closed = tickets.filter(isClosed);
    const onTime = closed.filter(isOnTimeClosed);
    const overdueOpen = tickets.filter(isOverdue);
    const escalated = tickets.filter(function (t) { return t.status === 'ESCALATED'; });
    /* 临期：未关闭、未超期、距截止 ≤ 自身窗口的一半（这里统一取 3 天内） */
    const now = Date.now();
    const nearDue = tickets.filter(function (t) { return isOpen(t) && t.slaDeadline && !isOverdue(t) && (new Date(t.slaDeadline).getTime() - now) <= 3 * 86400000; });

    const kpis = [
      kpi('已关闭', closed.length, '完成办结'),
      kpi('按时办结率', closed.length ? pct(onTime.length, closed.length) + '%' : '—', onTime.length + ' / ' + closed.length, pct(onTime.length, closed.length) >= 85 ? 'ok' : pct(onTime.length, closed.length) >= 60 ? 'warn' : 'danger'),
      kpi('超期未办', overdueOpen.length, '已过 SLA 截止', overdueOpen.length ? 'danger' : 'ok'),
      kpi('已升级', escalated.length, '超时自动升级'),
      kpi('临期预警', nearDue.length, '3 天内到期', nearDue.length ? 'warn' : 'ok')
    ].join('');

    /* 各层 SLA 达成 */
    const layRows = LAYER_KEYS.map(function (k) {
      const sub = tickets.filter(function (t) { return t.type === k; });
      const c = sub.filter(isClosed), ot = c.filter(isOnTimeClosed), od = sub.filter(isOverdue), es = sub.filter(function (t) { return t.status === 'ESCALATED'; });
      return '<tr><td class="txt">' + layerBadge(k) + '</td><td class="num">' + sub.length + '</td><td class="num">' + c.length + '</td>' +
        '<td class="num">' + (c.length ? pct(ot.length, c.length) + '%' : '—') + '</td>' +
        '<td class="num" style="color:' + (od.length ? '#b42335' : '#94a3b8') + '">' + od.length + '</td>' +
        '<td class="num" style="color:' + (es.length ? '#b42335' : '#94a3b8') + '">' + es.length + '</td></tr>';
    }).join('');

    const hasDetail = typeof window.showTicketDetail === 'function';
    const listRow = function (t, tag, tagColor) {
      const w = warnOf(t);
      const op = hasDetail ? 'onclick="showTicketDetail(\'' + t.id + '\')"' : '';
      const deadline = t.slaDeadline ? new Date(t.slaDeadline) : null;
      const dl = deadline ? deadline.toLocaleDateString('zh-CN') : '-';
      return '<tr>' +
        '<td class="md-nowrap">' + (hasDetail ? '<button class="md-id" ' + op + '>' + esc(t.id) + '</button>' : esc(t.id)) + '</td>' +
        '<td class="md-nowrap">' + layerBadge(t.type) + '</td>' +
        '<td>' + esc(w.targetLabel || t.ownerOrg || '-') + '<div class="md-sec">' + esc(t.ownerRole || '') + '</div></td>' +
        '<td class="md-nowrap">' + sevBadge(t.severity) + '</td>' +
        '<td class="md-nowrap">' + dl + '<div class="md-sec" style="color:' + tagColor + '">' + tag + '</div></td>' +
        '<td class="md-nowrap">' + (hasDetail ? '<button class="btn btn-ghost btn-xs" ' + op + '>详情</button>' : '-') + '</td>' +
        '</tr>';
    };
    const attn = overdueOpen.map(function (t) { return listRow(t, '已超期', '#b42335'); })
      .concat(nearDue.map(function (t) { return listRow(t, '临期', '#b54708'); }));
    const attnRows = attn.length ? attn.join('') : '<tr><td colspan="6"><div class="md-empty">当前无超期或临期工单</div></td></tr>';

    return '<div class="md-page">' +
      '<div class="md-kpis">' + kpis + '</div>' +
      '<div class="md-filter">' +
      '<div style="flex:1 1 100%;display:flex;gap:6px;flex-wrap:wrap">' + layerTabs(f.layer, 'sla') + '</div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="scanOverdueSafe()">扫描超时并升级</button>' +
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'warning-tickets\')">去处置工单</button></div></div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">各层 SLA 达成情况<span class="md-card-sub">超时自动升级到上一级责任方</span></div></div>' +
      '<div class="md-card-body" style="overflow:auto"><table class="md-pivot" style="width:100%"><thead><tr><th class="txt">层级</th><th class="num">工单数</th><th class="num">已关闭</th><th class="num">按时办结率</th><th class="num">超期未办</th><th class="num">已升级</th></tr></thead><tbody>' + layRows + '</tbody></table>' +
      '<div class="md-note" style="margin-top:9px">A 层紧急级 24 小时 / 关注级 3 工作日；B 层最长 10 工作日；C 层最长 20 工作日。到期未响应的工单自动升级并记日志。</div></div></div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">超期与临期清单<span class="md-card-sub">需立刻督办</span></div></div>' +
      '<div class="md-table-wrap"><table class="md-table"><thead><tr><th class="txt">工单</th><th class="txt">层级</th><th class="txt">对象 / 责任方</th><th class="code">级别</th><th class="txt">SLA 截止</th><th class="ops">操作</th></tr></thead><tbody>' + attnRows + '</tbody></table></div></div>' +
      '</div>';
  }
  function scanOverdueSafe() {
    if (typeof window.scanOverdue === 'function') { window.scanOverdue(); setTimeout(function () { renderPage(state.page); }, 60); }
    else mdToast('超时扫描功能不可用');
  }

  /* ==================== 页面 4：结论与整改成效 ==================== */
  function renderPredictions() {
    if (!hasData()) return emptyDependency('结论与整改成效');
    const f = state.conc;
    const tickets = getTickets().filter(function (t) { return (f.layer === 'ALL' || t.type === f.layer) && isClosed(t) && t.verificationResult; });

    /* 结论口径分布 */
    const dist = {};
    tickets.forEach(function (t) { const r = t.verificationResult || '未填写'; dist[r] = (dist[r] || 0) + 1; });
    const distArr = Object.keys(dist).map(function (k) { return { k: k, v: dist[k], isFp: k === '误报' }; }).sort(function (a, b) { return b.v - a.v; });
    const totalConc = tickets.length;
    const palette = ['#1d4ed8', '#16a34a', '#b54708', '#7c3aed', '#0891b2', '#db2777', '#64748b', '#b42335'];
    const distRows = distArr.map(function (d, i) {
      const color = d.isFp ? '#b42335' : palette[i % palette.length];
      return '<tr><td class="txt"><span class="md-chip" style="background:' + color + '22;color:' + color + '">' + esc(d.k) + '</span></td>' +
        '<td class="num">' + d.v + '</td><td class="num">' + pct(d.v, totalConc) + '%</td>' +
        '<td><div class="md-bar" style="width:140px"><i style="width:' + pct(d.v, totalConc) + '%;background:' + color + '"></i></div></td></tr>';
    }).join('');

    /* 属实 vs 误报 */
    const fpN = tickets.filter(isFalsePositive).length;
    const trueN = totalConc - fpN;
    /* 已推动整改 = 结论确属问题（属实-* / 疑似真实升高），即需要并已推动后续处理的 */
    const needFix = tickets.filter(function (t) { const r = t.verificationResult || ''; return r.indexOf('属实') === 0 || r.indexOf('疑似真实升高') >= 0; }).length;

    /* 整改成效样例：带 handlingNote 的闭环工单 */
    const hasDetail = typeof window.showTicketDetail === 'function';
    const cases = tickets.filter(function (t) { return t.handlingNote; }).slice(0, 8).map(function (t) {
      const w = warnOf(t);
      const op = hasDetail ? 'onclick="showTicketDetail(\'' + t.id + '\')"' : '';
      return '<tr>' +
        '<td class="md-nowrap">' + (hasDetail ? '<button class="md-id" ' + op + '>' + esc(t.id) + '</button>' : esc(t.id)) + '</td>' +
        '<td class="md-nowrap">' + layerBadge(t.type) + '</td>' +
        '<td>' + esc(w.targetLabel || t.ownerOrg || '-') + '</td>' +
        '<td class="md-nowrap"><span class="md-chip ' + (isFalsePositive(t) ? 'c' : '') + '">' + esc(t.verificationResult) + '</span></td>' +
        '<td style="white-space:normal;min-width:280px">' + esc((t.handlingNote || '').slice(0, 70)) + ((t.handlingNote || '').length > 70 ? '…' : '') + '</td>' +
        '<td class="md-nowrap">' + (hasDetail ? '<button class="btn btn-ghost btn-xs" ' + op + '>详情</button>' : '-') + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="6"><div class="md-empty">暂无带处置说明的已关闭工单</div></td></tr>';

    const kpis = [
      kpi('已结论工单', totalConc, '完成核实/研判'),
      kpi('属实', trueN, totalConc ? pct(trueN, totalConc) + '% 确属问题' : '', 'warn'),
      kpi('误报', fpN, totalConc ? pct(fpN, totalConc) + '% 规则误触' : '', fpN ? 'danger' : 'ok'),
      kpi('已推动整改', needFix, '补录/修正/专项调查', 'ok'),
      kpi('结论口径数', distArr.length, '覆盖三层')
    ].join('');

    return '<div class="md-page">' +
      '<div class="md-kpis">' + kpis + '</div>' +
      '<div class="md-filter">' +
      '<div style="flex:1 1 100%;display:flex;gap:6px;flex-wrap:wrap">' + layerTabs(f.layer, 'conc') + '</div>' +
      '<div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="navigateTo(\'mdl-evaluation\')">规则命中与误报</button></div></div>' +
      '<div class="md-grid2">' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">复核结论口径分布</div></div>' +
      '<div class="md-card-body" style="overflow:auto"><table class="md-pivot" style="width:100%"><thead><tr><th class="txt">结论</th><th class="num">数量</th><th class="num">占比</th><th class="txt">分布</th></tr></thead><tbody>' +
      (distRows || '<tr><td colspan="4"><div class="md-empty">暂无已结论工单</div></td></tr>') + '</tbody></table>' +
      '<div class="md-note" style="margin-top:9px">结论口径是复核时从该层口径中选的——「属实」类表示确属问题已推动整改，「误报」表示规则误触、应回看阈值，其它跨层口径（上报行为改变、口径问题等）会联动相关层级。</div></div></div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">整改成效要点</div></div><div class="md-card-body">' +
      '<div class="md-callout ok"><strong>闭环率：</strong>已结论 ' + totalConc + ' 件，其中属实并推动整改 ' + needFix + ' 件。预警的价值不在"报得多"，而在"报出的真问题被改掉了"。</div>' +
      '<div class="md-callout warn" style="margin-top:10px"><strong>误报要回看：</strong>误报 ' + fpN + ' 件（' + (totalConc ? pct(fpN, totalConc) : 0) + '%）。误报不是坏事，但集中在某条规则时说明阈值偏松，应到「规则命中与误报」页定位并校准。</div>' +
      '<div class="md-callout" style="margin-top:10px"><strong>跨层联动：</strong>当结论为「上报行为改变」「口径或编码问题」「需系统支持」时，系统会自动向对应层级建关联核查单，避免同一问题多头处理。</div>' +
      '</div></div>' +
      '</div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">已闭环工单与处置说明</div></div>' +
      '<div class="md-table-wrap"><table class="md-table"><thead><tr><th class="txt">工单</th><th class="txt">层级</th><th class="txt">对象</th><th class="txt">结论</th><th class="txt">处置说明（摘录）</th><th class="ops">操作</th></tr></thead><tbody>' + cases + '</tbody></table></div></div>' +
      '</div>';
  }

  /* ==================== 页面 5：规则命中与误报 ==================== */
  function renderEvaluation() {
    if (!hasData()) return emptyDependency('规则命中与误报');
    const rules = getRules();
    if (!rules.length) return emptyDependency('规则命中与误报');
    const warnings = getWarnings();
    const tickets = getTickets();
    const f = state.rule;
    const list = rules.filter(function (r) { return f.layer === 'ALL' || r.warningType === f.layer; });

    const rowsData = list.map(function (r) {
      const triggered = warnings.filter(function (w) { return w.ruleId === r.id; }).length;
      /* 优先用规则自带复核计数，没有则从工单实时统计 */
      const relTickets = tickets.filter(function (t) { const w = warnOf(t); return w.ruleId === r.id; });
      const reviewed = (r.reviewedCount != null && r.reviewedCount > 0) ? r.reviewedCount : relTickets.filter(isClosed).length;
      const fp = (r.falsePositiveCount != null && r.falsePositiveCount > 0) ? r.falsePositiveCount : relTickets.filter(function (t) { return isClosed(t) && isFalsePositive(t); }).length;
      const fpRate = pct(fp, reviewed);
      const effRate = reviewed ? 100 - fpRate : null;
      let tag, tone, advice;
      if (!r.isEnabled) { tag = '停用'; tone = ''; advice = '规则已停用，暂不评估'; }
      else if (reviewed === 0) { tag = '待积累'; tone = ''; advice = '尚无复核样本，继续积累'; }
      else if (fpRate >= 50) { tag = '收紧'; tone = 'danger'; advice = '误报率偏高，建议收紧阈值或提高最小样本量'; }
      else if (fpRate >= 25) { tag = '关注'; tone = 'warn'; advice = '误报率中等，核对口径一致性'; }
      else { tag = '有效'; tone = 'ok'; advice = '误报率可接受，阈值有效'; }
      return { r: r, triggered: triggered, reviewed: reviewed, fp: fp, fpRate: fpRate, effRate: effRate, tag: tag, tone: tone, advice: advice };
    });

    const rows = rowsData.map(function (d) {
      const r = d.r;
      const tagCls = d.tone === 'danger' ? 'badge-danger' : d.tone === 'warn' ? 'badge-warning' : d.tone === 'ok' ? 'badge-success' : 'badge-muted';
      return '<tr>' +
        '<td class="md-nowrap"><span class="md-id" style="cursor:default">' + esc(r.id) + '</span></td>' +
        '<td>' + esc(r.ruleName) + '</td>' +
        '<td class="md-nowrap">' + layerBadge(r.warningType) + '</td>' +
        '<td class="md-num">' + d.triggered + '</td>' +
        '<td class="md-num">' + d.reviewed + '</td>' +
        '<td class="md-num">' + d.fp + '</td>' +
        '<td class="md-num">' + (d.reviewed ? rateCell(d.fp, d.reviewed, true) : '<span class="md-note">—</span>') + '</td>' +
        '<td class="md-num">' + (d.effRate == null ? '<span class="md-note">—</span>' : d.effRate + '%') + '</td>' +
        '<td class="txt" style="white-space:normal"><span class="badge ' + tagCls + '" style="margin-right:6px">' + d.tag + '</span>' + esc(d.advice) + '</td>' +
        '</tr>';
    }).join('');

    const sumRows = LAYER_KEYS.map(function (k) {
      const sub = rowsData.filter(function (d) { return d.r.warningType === k; });
      const t = sub.reduce(function (a, d) { return a + d.triggered; }, 0);
      const rv = sub.reduce(function (a, d) { return a + d.reviewed; }, 0);
      const fp = sub.reduce(function (a, d) { return a + d.fp; }, 0);
      return '<tr><td class="txt">' + layerBadge(k) + '</td><td class="num">' + sub.length + '</td><td class="num">' + t + '</td><td class="num">' + rv + '</td><td class="num">' + fp + '</td><td class="num">' + (rv ? pct(fp, rv) + '%' : '—') + '</td></tr>';
    }).join('');

    const totT = rowsData.reduce(function (a, d) { return a + d.triggered; }, 0);
    const totR = rowsData.reduce(function (a, d) { return a + d.reviewed; }, 0);
    const totF = rowsData.reduce(function (a, d) { return a + d.fp; }, 0);
    const needTune = rowsData.filter(function (d) { return d.tone === 'danger'; }).length;
    const kpis = [
      kpi('评估规则', list.length, '当前层级'),
      kpi('累计触发', totT, '历史命中'),
      kpi('已复核', totR, '完成闭环'),
      kpi('总体误报率', totR ? pct(totF, totR) + '%' : '—', totF + ' / ' + totR, pct(totF, totR) >= 40 ? 'danger' : pct(totF, totR) >= 20 ? 'warn' : 'ok'),
      kpi('建议收紧', needTune, '误报率≥50% 的规则', needTune ? 'danger' : 'ok')
    ].join('');

    return '<div class="md-page">' +
      '<div class="md-kpis">' + kpis + '</div>' +
      '<div class="md-filter">' +
      '<div style="flex:1 1 100%;display:flex;gap:6px;flex-wrap:wrap">' + layerTabs(f.layer, 'rule') + '</div>' +
      '<div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="navigateTo(\'warning-rules\')">去规则配置调参</button></div></div>' +
      '<div class="md-table-wrap"><table class="md-table" style="min-width:1120px"><thead><tr><th class="txt">规则ID</th><th class="txt">规则名称</th><th class="txt">层级</th><th class="num">触发</th><th class="num">已复核</th><th class="num">误报</th><th class="num">误报率</th><th class="num">有效率</th><th class="txt">校准建议</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9"><div class="md-empty">暂无规则</div></td></tr>') + '</tbody></table></div>' +
      '<div class="md-grid2" style="margin-top:14px">' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">层级汇总</div></div>' +
      '<div class="md-card-body" style="overflow:auto"><table class="md-pivot" style="width:100%"><thead><tr><th class="txt">层级</th><th class="num">规则数</th><th class="num">触发</th><th class="num">复核</th><th class="num">误报</th><th class="num">误报率</th></tr></thead><tbody>' + sumRows + '</tbody></table></div></div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">阈值校准口径</div></div><div class="md-card-body">' +
      '<div class="md-callout">误报率 = 复核判定为「误报」÷ 已复核；有效率 = 1 − 误报率。数据取自「处置工单」的真实复核结论，不是模拟值。</div>' +
      '<div class="md-callout warn" style="margin-top:10px"><strong>校准规则：</strong>误报率 ≥50% → 收紧阈值或提高最小样本量；25%–50% → 核对口径一致性；&lt;25% → 阈值有效、维持。调整在「预警规则配置」进行并生成新版本，<b>不影响历史预警的阈值快照</b>。</div>' +
      '<div class="md-callout ok" style="margin-top:10px"><strong>宁多勿漏：</strong>肿瘤登记预警偏向高召回，一定量误报是可接受代价；派单前须人工复核——规则负责收窄范围，人负责决定是否行动。</div>' +
      '</div></div>' +
      '</div></div>';
  }

  /* ==================== 路由与导出 ==================== */
  function renderModelPage(pageId) {
    if (OWNED_IDS.indexOf(pageId) < 0) return null;
    state.page = pageId;
    if (pageId === 'mdl-features') return renderFeatures();
    if (pageId === 'mdl-registry') return renderRegistry();
    if (pageId === 'mdl-training') return renderTraining();
    if (pageId === 'mdl-predictions') return renderPredictions();
    if (pageId === 'mdl-evaluation') return renderEvaluation();
    return '<div class="md-page"><div class="md-empty">页面开发中</div></div>';
  }

  const publicApi = {
    mdSet, mdResetReg, scanOverdueSafe, renderModelPage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = publicApi;
  if (typeof window !== 'undefined') {
    Object.assign(window, publicApi);
    window.modelPageIds = OWNED_IDS.slice();
  }
})();
