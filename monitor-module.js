/* ============================================================
   肿瘤监测与预警 - 完整实现 v2（表头/字段严格对齐）
   ============================================================ */
(function () {
  'use strict';

  var css = [
    '.mon-page{min-width:0}',
    '.mon-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px}',
    '.mon-head .t{font-size:20px;font-weight:700;color:#182230;line-height:1.25}',
    '.mon-head .s{margin-top:5px;font-size:12px;color:#667085;line-height:1.5}',
    '.mon-head .acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
    '.mon-group-tag{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:4px;background:#e8f2ff;color:#244765;font-size:12px;font-weight:600;white-space:nowrap}',
    '.mon-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}',
    '.mon-kpis.g3{grid-template-columns:repeat(3,minmax(0,1fr))}.mon-kpis.g5{grid-template-columns:repeat(5,minmax(0,1fr))}',
    '.mon-kpi{background:#fff;border:1px solid var(--border,#dfe5ec);border-radius:8px;padding:14px 16px}',
    '.mon-kpi .l{font-size:12px;color:#667085}',
    '.mon-kpi .v{margin-top:5px;font-size:24px;font-weight:700;color:#182230;font-variant-numeric:tabular-nums}',
    '.mon-kpi .v.up{color:#2e7d32}.mon-kpi .v.warn{color:#b54708}.mon-kpi .v.bad{color:#b42335}.mon-kpi .v.info{color:#244765}',
    '.mon-kpi .m{margin-top:4px;font-size:11px;color:#94a3b8;min-height:15px}',
    '.mon-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;margin-bottom:16px}',
    '.mon-grid13{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:14px;align-items:start;margin-bottom:16px}',
    '.mon-card{background:#fff;border:1px solid var(--border,#dfe5ec);border-radius:8px;overflow:hidden}',
    '.mon-card .hd{min-height:44px;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 15px;border-bottom:1px solid var(--border,#dfe5ec)}',
    '.mon-card .hd .t{font-size:14px;font-weight:700;color:#1f2937}',
    '.mon-card .hd .sub{font-size:11px;font-weight:400;color:#94a3b8;margin-left:8px}',
    '.mon-card .bd{padding:14px 16px}',
    '.mon-filter{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;align-items:end;padding:13px 15px;background:#f8fafc;border:1px solid var(--border,#dfe5ec);border-radius:8px;margin-bottom:14px}',
    '.mon-filter .fg{display:flex;flex-direction:column;gap:5px;min-width:0}',
    '.mon-filter .fg label{font-size:12px;color:#475569;font-weight:600}',
    '.mon-filter select,.mon-filter input{width:100%;height:34px;padding:0 9px;border:1px solid #d1d8e0;border-radius:5px;background:#fff;color:#1f2937;font-size:13px;box-sizing:border-box}',
    '.mon-filter .acts{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px}',
    '.mon-table-wrap{overflow-x:auto;border:1px solid var(--border,#dfe5ec);border-radius:8px;background:#fff}',
    '.mon-table{width:100%;min-width:1000px;border-collapse:collapse}',
    '.mon-table th{height:40px;padding:0 12px;background:#f8fafc;border-bottom:1px solid var(--border,#dfe5ec);color:#5b6673;font-size:12px;font-weight:600;text-align:left;white-space:nowrap}',
    '.mon-table td{height:46px;padding:7px 12px;border-bottom:1px solid #eef2f7;color:#334155;font-size:13px;vertical-align:middle}',
    '.mon-table tbody tr:hover{background:#f7fbff}',
    '.mon-table tbody tr:last-child td{border-bottom:0}',
    '.mon-table td.num,.mon-table th.num{text-align:right}',
    '.mon-bar{display:flex;align-items:flex-end;gap:10px;height:190px;padding:12px 8px 4px}',
    '.mon-bar .col{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px}',
    '.mon-bar .val{font-size:11px;font-weight:600;color:#334155;font-variant-numeric:tabular-nums}',
    '.mon-bar .track{width:100%;max-width:48px;flex:1;display:flex;align-items:flex-end;background:#f1f5f9;border-radius:4px 4px 0 0;overflow:hidden}',
    '.mon-bar .fill{width:100%;border-radius:4px 4px 0 0;transition:height .3s}',
    '.mon-bar .lab{font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
    '.mon-line{width:100%;height:auto;display:block}',
    '.mon-meta{font-size:12px;color:#667085;line-height:1.7}',
    '.mon-modal-mask{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.5)}',
    '.mon-modal{width:min(760px,96vw);max-height:86vh;overflow:auto;background:#fff;border-radius:10px;box-shadow:0 18px 50px rgba(15,23,42,.25)}',
    '.mon-modal .hd{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:13px 18px;background:#fff;border-bottom:1px solid var(--border,#dfe5ec)}',
    '.mon-modal .hd .t{font-size:15px;font-weight:700;color:#1f2937}',
    '.mon-modal .x{width:28px;height:28px;border:0;border-radius:5px;background:#f2f4f7;color:#667085;font-size:16px;cursor:pointer}',
    '.mon-modal .bd{padding:16px 18px}',
    '.mon-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px}',
    '.mon-kv .k{font-size:12px;color:#667085}',
    '.mon-kv .vl{font-size:13px;font-weight:600;color:#1f2937;margin-top:2px}',
    '@media(max-width:1100px){.mon-kpis,.mon-kpis.g5{grid-template-columns:repeat(2,1fr)}.mon-grid2,.mon-grid13{grid-template-columns:1fr}.mon-filter{grid-template-columns:repeat(2,1fr)}}',
    '@media(max-width:680px){.mon-kpis{grid-template-columns:1fr}.mon-filter{grid-template-columns:1fr}.mon-kv{grid-template-columns:1fr}}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function tone(text, t) {
    var c = t === 'success' ? 'badge-success' : t === 'info' ? 'badge-info' : t === 'danger' ? 'badge-danger' : t === 'warn' ? 'badge-caution' : t === 'orange' ? 'badge-orange' : 'badge-neutral';
    return '<span class="badge ' + c + '">' + esc(text) + '</span>';
  }
  function heads(title, sub) {
    return '<div class="mon-head"><div><div class="t">' + esc(title) + '</div><div class="s">' + esc(sub) + '</div></div><div class="acts"><span class="mon-group-tag">肿瘤监测与预警</span></div></div>';
  }
  function kpis(items, cols) {
    var g = cols === 3 ? 'g3' : cols === 5 ? 'g5' : '';
    return '<div class="mon-kpis ' + g + '">' + items.map(function (x) {
      var tc = x.tone === 'up' ? 'up' : x.tone === 'warn' ? 'warn' : x.tone === 'bad' ? 'bad' : x.tone === 'info' ? 'info' : '';
      return '<div class="mon-kpi"><div class="l">' + esc(x.l) + '</div><div class="v ' + tc + '">' + esc(x.v) + '</div><div class="m">' + esc(x.m || '') + '</div></div>';
    }).join('') + '</div>';
  }
  function card(title, body, sub) {
    return '<div class="mon-card"><div class="hd"><span class="t">' + esc(title) + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</span></div><div class="bd">' + body + '</div></div>';
  }
  function table(headers, rowsHtml) {
    var th = headers.map(function (h) { return '<th class="' + (h.charAt(0) === '#' ? 'num' : '') + '">' + esc(h.replace(/^#/, '')) + '</th>'; }).join('');
    return '<div class="mon-table-wrap"><table class="mon-table"><thead><tr>' + th + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
  }
  function actBtn(text, action, arg) {
    return '<button class="btn btn-ghost btn-sm" data-mon="' + esc(action) + '" data-arg="' + esc(arg || '') + '">' + esc(text) + '</button>';
  }
  function filterBar(fields) {
    var html = fields.map(function (f) {
      if (f.type === 'select') {
        var opts = f.options.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('');
        return '<div class="fg"><label>' + esc(f.label) + '</label><select>' + opts + '</select></div>';
      }
      return '<div class="fg"><label>' + esc(f.label) + '</label><input type="text" placeholder="' + esc(f.placeholder || '') + '"></div>';
    }).join('');
    return '<div class="mon-filter">' + html + '<div class="acts"><button class="btn btn-ghost btn-sm" data-mon="reset">重置</button><button class="btn btn-primary btn-sm" data-mon="query">查询</button></div></div>';
  }
  function barChart(data, unit) {
    var max = Math.max.apply(null, data.map(function (d) { return d.v; })) || 1;
    var colors = ['#244765', '#3d5a80', '#5b8def', '#7fb4e8', '#94c2d9', '#b0d0a2', '#e0a96d', '#d98b8b', '#9a7bc1', '#6da8c9'];
    return '<div class="mon-bar">' + data.map(function (d, i) {
      var h = Math.max(3, Math.round(d.v / max * 100));
      return '<div class="col"><div class="val">' + esc(d.v) + (unit || '') + '</div><div class="track"><div class="fill" style="height:' + h + '%;background:' + colors[i % colors.length] + '"></div></div><div class="lab">' + esc(d.l) + '</div></div>';
    }).join('') + '</div>';
  }
  function lineChart(points) {
    var W = 640, H = 200, P = { t: 18, r: 16, b: 30, l: 38 };
    var vals = points.map(function (p) { return p.v; });
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    if (max === min) { max += 1; min -= 1; }
    var iw = W - P.l - P.r, ih = H - P.t - P.b, n = points.length;
    var xs = points.map(function (_, i) { return P.l + (n <= 1 ? iw / 2 : iw * i / (n - 1)); });
    var ys = points.map(function (p) { return P.t + ih - (p.v - min) / (max - min) * ih; });
    var pts = xs.map(function (x, i) { return x.toFixed(1) + ',' + ys[i].toFixed(1); }).join(' ');
    var dots = xs.map(function (x, i) { return '<circle cx="' + x.toFixed(1) + '" cy="' + ys[i].toFixed(1) + '" r="3" fill="#244765"/>'; }).join('');
    var grid = '', lab = '';
    for (var t = 0; t <= 4; t++) {
      var y = P.t + ih * t / 4, val = max - (max - min) * t / 4;
      grid += '<line x1="' + P.l + '" y1="' + y.toFixed(1) + '" x2="' + (W - P.r) + '" y2="' + y.toFixed(1) + '" stroke="#eef2f7"/>';
      lab += '<text x="' + (P.l - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="10" fill="#94a3b8">' + val.toFixed(1) + '</text>';
    }
    var xlabs = points.map(function (p, i) {
      if (n > 10 && i % 2 === 1) return '';
      return '<text x="' + xs[i].toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="#94a3b8">' + esc(p.l) + '</text>';
    }).join('');
    return '<svg class="mon-line" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' + grid + lab + '<polyline points="' + pts + '" fill="none" stroke="#244765" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' + dots + xlabs + '</svg>';
  }
  function openModal(title, kvPairs) {
    closeModal();
    var rows = kvPairs.map(function (k) { return '<div class="k">' + esc(k[0]) + '</div><div class="vl">' + (k[1] || '-') + '</div>'; }).join('');
    var mask = document.createElement('div');
    mask.className = 'mon-modal-mask';
    mask.innerHTML = '<div class="mon-modal"><div class="hd"><span class="t">' + esc(title) + '</span><button class="x" data-mon="close">×</button></div><div class="bd"><div class="mon-kv">' + rows + '</div></div></div>';
    document.body.appendChild(mask);
  }
  function closeModal() { var m = document.querySelectorAll('.mon-modal-mask'); for (var i = 0; i < m.length; i++) m[i].remove(); }
  function toast(msg) {
    var c = document.getElementById('monToast');
    if (!c) { c = document.createElement('div'); c.id = 'monToast'; c.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:1300;display:flex;flex-direction:column;gap:8px'; document.body.appendChild(c); }
    var t = document.createElement('div');
    t.style.cssText = 'background:#182230;color:#fff;padding:10px 16px;border-radius:6px;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.2)';
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 320); }, 2000);
  }

  var GROUPS = [
    { key: 'mon-incidence', label: '肿瘤发病监测' },
    { key: 'mon-death', label: '肿瘤死亡监测' },
    { key: 'mon-capability', label: '肿瘤专科能力分析' },
    { key: 'mon-model', label: '预警模型构建' }
  ];
  var SITES = [
    { id: 'mon-inc-import', group: 'mon-incidence', label: '肿瘤发病原始数据接入', desc: '记录从各级医疗机构接入发病数据的传输状态与错误信息。' },
    { id: 'mon-inc-cube', group: 'mon-incidence', label: '多维发病统计指标立方体', desc: '预计算按地区、癌种、年龄、性别等维度组合的发病率指标。' },
    { id: 'mon-inc-trend', group: 'mon-incidence', label: '发病趋势可视化配置', desc: '配置发病率趋势图的展示参数，支持高性能可视化。' },
    { id: 'mon-inc-rule', group: 'mon-incidence', label: '异常监测规则配置', desc: '定义发病率异常波动的监测规则（如环比上升 50%）。' },
    { id: 'mon-inc-ticket', group: 'mon-incidence', label: '发病异常预警工单', desc: '当监测规则触发时，自动生成核查工单并跟踪处理。' },
    { id: 'mon-death-import', group: 'mon-death', label: '肿瘤死亡原始数据接入', desc: '针对死亡数据的接入记录，记录传输状态与错误信息。' },
    { id: 'mon-death-cube', group: 'mon-death', label: '多维死亡统计指标立方体', desc: '预计算死亡相关核心指标，支持快速分析。' },
    { id: 'mon-death-trend', group: 'mon-death', label: '死亡趋势可视化配置', desc: '配置死亡率趋势图的展示参数。' },
    { id: 'mon-death-link', group: 'mon-death', label: '死亡-发病关联分析记录', desc: '关联同一患者的发病与死亡记录，计算病死率等指标。' },
    { id: 'mon-cap-tech', group: 'mon-capability', label: '肿瘤诊疗技术目录', desc: '建立标准化的肿瘤诊疗技术清单，作为能力评估基础。' },
    { id: 'mon-cap-record', group: 'mon-capability', label: '机构技术开展记录', desc: '记录各机构开展特定技术的数量与质量，用于能力画像。' },
    { id: 'mon-cap-quality', group: 'mon-capability', label: '医疗质量核心指标明细', desc: '存储围手术期死亡率、并发症率等医疗质量指标。' },
    { id: 'mon-cap-difficulty', group: 'mon-capability', label: '疑难病例收治特征库', desc: '量化机构收治疑难重症的能力，用于专科能力建设评估。' },
    { id: 'mon-model-warehouse', group: 'mon-model', label: '多源特征数据仓库', desc: '构建用于 AI 模型训练的标准化特征数据池。' },
    { id: 'mon-model-reg', group: 'mon-model', label: '预警模型元信息注册', desc: '管理风险预测模型的基本信息与生命周期状态。' },
    { id: 'mon-model-train', group: 'mon-model', label: '模型训练与超参记录', desc: '详细记录模型训练过程，确保实验可复现与性能可追溯。' },
    { id: 'mon-model-snapshot', group: 'mon-model', label: '风险预测结果快照', desc: '存储模型预测结果，用于预警触发与决策支持。' },
    { id: 'mon-model-eval', group: 'mon-model', label: '模型验证与评估报告', desc: '定期评估模型在真实场景中的表现，驱动迭代优化。' }
  ];

  function groupPage(g) {
    var items = SITES.filter(function (s) { return s.group === g.key; });
    var html = items.map(function (s) {
      return '<div class="mon-card" style="cursor:pointer;margin-bottom:12px" data-mon="go" data-arg="' + s.id + '"><div class="hd"><span class="t">' + esc(s.label) + '</span></div><div class="bd"><div class="mon-meta">' + esc(s.desc) + '</div></div></div>';
    }).join('');
    return heads(g.label, '本分组功能项列表，点击卡片进入对应功能页') + '<div class="mon-grid2">' + html + '</div>';
  }

  /* ==================== 发病监测 ==================== */
  function renderIncImport() {
    var r = [
      { o: '江西省肿瘤医院', t: '报告卡(发病)', b: 'B20260821-01', c: 1284, s: '成功', e: '—', d: '08-21 09:32' },
      { o: '南昌市第一人民医院', t: 'HIS 接口', b: 'B20260821-02', c: 892, s: '成功', e: '—', d: '08-21 09:41' },
      { o: '赣州市中心医院', t: '批量导入', b: 'B20260820-07', c: 421, s: '部分成功', e: '3 条身份证号格式错误', d: '08-20 16:18' },
      { o: '九江市肿瘤医院', t: '报告卡(发病)', b: 'B20260820-05', c: 236, s: '失败', e: 'ICD-10 编码缺失', d: '08-20 14:02' },
      { o: '上饶医学院三附院', t: 'HIS 接口', b: 'B20260819-03', c: 674, s: '成功', e: '—', d: '08-19 11:55' },
      { o: '景德镇市人民医院', t: '批量导入', b: 'B20260819-02', c: 398, s: '处理中', e: '正在校验重复卡', d: '08-19 10:20' }
    ];
    var tr = r.map(function (x) {
      var st = x.s === '成功' ? 'success' : x.s === '部分成功' ? 'warn' : x.s === '失败' ? 'danger' : 'info';
      return '<tr><td>' + esc(x.o) + '</td><td>' + esc(x.t) + '</td><td>' + esc(x.b) + '</td><td class="num">' + x.c + '</td><td>' + tone(x.s, st) + '</td><td style="color:#b54708">' + esc(x.e) + '</td><td>' + esc(x.d) + '</td><td>' + actBtn('详情', 'view', x.b) + '</td></tr>';
    }).join('');
    return heads('肿瘤发病原始数据接入', '记录从各级医疗机构接入发病数据的传输状态与错误信息。') +
      kpis([{ l: '接入机构数', v: '1,286', m: '本年度累计 3,610 家' }, { l: '今日批次', v: '36', m: '较昨日 +4' }, { l: '接入成功率', v: '97.6%', m: '环比 +0.8pp', tone: 'up' }, { l: '待处理错误', v: '12', m: '6 条高优先级', tone: 'warn' }]) +
      '<div class="mon-grid13"><div>' + card('接入批次明细', table(['接入机构', '数据类型', '批次号', '#记录数', '传输状态', '错误信息', '接入时间', '操作'], tr)) + '</div>' +
      '<div>' + card('近 7 日接入量', barChart([{ l: '8-15', v: 1820 }, { l: '8-16', v: 2140 }, { l: '8-17', v: 1980 }, { l: '8-18', v: 2330 }, { l: '8-19', v: 2410 }, { l: '8-20', v: 2280 }, { l: '8-21', v: 2560 }]), '单位：条') + '</div></div>';
  }
  function renderIncCube() {
    var r = [
      { n: '肺', icd: 'C33-C34', cnt: 4821, rate: 42.6, p: 0.92, d: '+5.2%' },
      { n: '胃', icd: 'C16', cnt: 3120, rate: 27.6, p: 0.85, d: '+2.1%' },
      { n: '结直肠', icd: 'C18-C20', cnt: 2890, rate: 25.5, p: 0.88, d: '+3.4%' },
      { n: '肝', icd: 'C22', cnt: 2140, rate: 18.9, p: 0.82, d: '-1.2%' },
      { n: '乳腺', icd: 'C50', cnt: 1980, rate: 17.5, p: 0.94, d: '+4.6%' },
      { n: '食管', icd: 'C15', cnt: 1650, rate: 14.6, p: 0.79, d: '+0.8%' },
      { n: '甲状腺', icd: 'C73', cnt: 1220, rate: 10.8, p: 0.97, d: '+6.3%' }
    ];
    var tr = r.map(function (x) {
      return '<tr><td>' + esc(x.n) + '</td><td>' + esc(x.icd) + '</td><td class="num">' + x.cnt + '</td><td class="num">' + x.rate + '</td><td class="num">' + x.p + '</td><td class="num" style="color:' + (x.d.charAt(0) === '+' ? '#2e7d32' : '#b42335') + '">' + x.d + '</td></tr>';
    }).join('');
    return heads('多维发病统计指标立方体', '预计算按地区、癌种、年龄、性别等维度组合的发病率指标。') +
      filterBar([{ label: '统计维度', type: 'select', options: ['癌种', '地区', '年龄组', '性别'] }, { label: '年份', type: 'select', options: ['2026', '2025', '2024'] }, { label: '指标', type: 'select', options: ['发病率', '发病数', '构成比'] }, { label: '地区', type: 'select', options: ['全省', '南昌市', '赣州市'] }, { label: '性别', type: 'select', options: ['全部', '男', '女'] }]) +
      kpis([{ l: '总发病数', v: '23,846', m: '2026 年 1-8 月' }, { l: '粗发病率', v: '210.6', m: '1/10万', tone: 'info' }, { l: '年龄标化率', v: '182.4', m: 'ASR(W)', tone: 'info' }, { l: '环比变化', v: '+3.8%', m: '较去年同期', tone: 'up' }]) +
      '<div class="mon-grid13"><div>' + card('各癌种发病率（1/10万）', barChart([{ l: '肺', v: 42.6 }, { l: '胃', v: 27.6 }, { l: '结直肠', v: 25.5 }, { l: '肝', v: 18.9 }, { l: '乳腺', v: 17.5 }, { l: '食管', v: 14.6 }, { l: '甲状腺', v: 10.8 }])) + '</div>' +
      '<div>' + card('指标明细（癌种维度）', table(['癌种', 'ICD-10', '#发病数', '#发病率', '#构成比', '#环比'], tr)) + '</div></div>';
  }
  function renderIncTrend() {
    return heads('发病趋势可视化配置', '配置发病率趋势图的展示参数，支持高性能可视化。') +
      filterBar([{ label: '时间范围', type: 'select', options: ['近 12 个月', '近 6 个月', '近 24 个月'] }, { label: '癌种', type: 'select', options: ['全部癌种', '肺癌', '胃癌', '结直肠癌'] }, { label: '地区', type: 'select', options: ['全省', '南昌市', '赣州市'] }, { label: '图表类型', type: 'select', options: ['折线图', '柱状图', '面积图'] }, { label: '粒度', type: 'select', options: ['按月', '按季度', '按年'] }]) +
      '<div class="mon-grid13"><div>' + card('发病率趋势预览（1/10万）', lineChart([{ l: '1月', v: 24.1 }, { l: '2月', v: 22.8 }, { l: '3月', v: 25.6 }, { l: '4月', v: 26.9 }, { l: '5月', v: 27.4 }, { l: '6月', v: 28.7 }, { l: '7月', v: 29.2 }, { l: '8月', v: 30.5 }]), '按月 · 全省 · 全部癌种') + '</div>' +
      '<div>' + card('展示参数', '<div class="mon-meta">基线：2026 年全省；虚线为 3 期移动平均。可切换癌种、地区与粒度，点击「查询」应用配置。</div>') + '</div></div>';
  }
  function renderIncRule() {
    var r = [
      { n: '环比暴增规则', m: '发病率', dim: '癌种×地区', c: '环比上升 ≥ 50%', lv: '高', st: '启用中', d: '2026-06-01' },
      { n: '连续上升规则', m: '发病数', dim: '癌种', c: '连续 3 期上升', lv: '中', st: '启用中', d: '2026-05-20' },
      { n: '空间聚集规则', m: '发病率', dim: '区县', c: '痞指数 > 1.96', lv: '高', st: '启用中', d: '2026-07-10' },
      { n: '超阈值规则', m: '死亡/发病比', dim: '全省', c: 'M/I 比 > 0.85', lv: '中', st: '停用', d: '2026-03-02' },
      { n: '年增幅规则', m: '标化发病率', dim: '癌种×地区', c: '同比增幅 > 15%', lv: '低', st: '启用中', d: '2026-01-15' }
    ];
    var tr = r.map(function (x) {
      var lv = x.lv === '高' ? 'danger' : x.lv === '中' ? 'warn' : 'info';
      return '<tr><td>' + esc(x.n) + '</td><td>' + esc(x.m) + '</td><td>' + esc(x.dim) + '</td><td>' + esc(x.c) + '</td><td>' + tone(x.lv, lv) + '</td><td>' + (x.st === '启用中' ? tone('启用中', 'success') : tone('停用', 'neutral')) + '</td><td>' + esc(x.d) + '</td><td>' + actBtn('编辑', 'edit', x.n) + ' ' + actBtn('切换', 'toggle', x.n) + '</td></tr>';
    }).join('');
    return heads('异常监测规则配置', '定义发病率异常波动的监测规则（如环比上升 50%）。') +
      kpis([{ l: '规则总数', v: '5', m: '3 条启用中' }, { l: '本月触发', v: '23', m: '环比 +11%', tone: 'warn' }, { l: '高优先级', v: '2', m: '需本周复核' }]) +
      '<div style="margin-bottom:14px;display:flex;gap:8px"><button class="btn btn-primary btn-sm" data-mon="new">＋ 新增规则</button></div>' +
      card('监测规则列表', table(['规则名称', '监测指标', '维度', '触发条件', '级别', '状态', '生效日期', '操作'], tr));
  }
  function renderIncTicket() {
    var r = [
      { id: 'AI-202608-017', rule: '环比暴增规则', rng: '赣州市·肺癌', d: '发病率环比 +62%', lv: '高', st: '核查中', who: '王医生', dt: '08-21' },
      { id: 'AI-202608-015', rule: '空间聚集规则', rng: '九江市·胃癌', d: '空间聚集 3 个街道', lv: '高', st: '待处理', who: '—', dt: '08-20' },
      { id: 'AI-202608-012', rule: '连续上升规则', rng: '上饶市·结直肠癌', d: '连续 4 期上升', lv: '中', st: '待处理', who: '—', dt: '08-19' },
      { id: 'AI-202608-010', rule: '环比暴增规则', rng: '南昌市·乳腺癌', d: '发病率环比 +51%', lv: '中', st: '已闭环', who: '李医生', dt: '08-18' },
      { id: 'AI-202608-008', rule: '超阈值规则', rng: '全省·M/I 比', d: 'M/I 比 0.88', lv: '中', st: '已闭环', who: '赵医生', dt: '08-15' }
    ];
    var tr = r.map(function (x) {
      var lv = x.lv === '高' ? 'danger' : 'warn';
      var st = x.st === '已闭环' ? 'success' : x.st === '核查中' ? 'info' : 'warn';
      return '<tr><td>' + esc(x.id) + '</td><td>' + esc(x.rule) + '</td><td>' + esc(x.rng) + '</td><td>' + esc(x.d) + '</td><td>' + tone(x.lv, lv) + '</td><td>' + tone(x.st, st) + '</td><td>' + esc(x.who) + '</td><td>' + esc(x.dt) + '</td><td>' + actBtn('处理', 'view', x.id) + '</td></tr>';
    }).join('');
    return heads('发病异常预警工单', '当监测规则触发时，自动生成核查工单并跟踪处理。') +
      kpis([{ l: '待处理', v: '2', m: '含 1 条高优先级', tone: 'bad' }, { l: '核查中', v: '1', m: '王医生处理中' }, { l: '已闭环', v: '2', m: '本周闭环率 40%' }, { l: '本月累计', v: '23', m: '环比 +11%', tone: 'warn' }]) +
      card('预警工单列表', table(['工单号', '触发规则', '异常范围', '异常描述', '级别', '状态', '责任人', '触发日期', '操作'], tr));
  }

  /* ==================== 死亡监测 ==================== */
  function renderDeathImport() {
    var r = [
      { o: '南昌市殡葬管理所', t: '死亡登记', b: 'D20260821-01', c: 96, s: '成功', e: '—', d: '08-21 08:55' },
      { o: '江西省肿瘤医院', t: '随访死亡数据', b: 'D20260820-03', c: 58, s: '成功', e: '—', d: '08-20 15:30' },
      { o: '赣州市疾控中心', t: '死亡登记', b: 'D20260820-02', c: 41, s: '部分成功', e: '2 条死因编码缺失', d: '08-20 13:10' },
      { o: '九江市人民医院', t: 'HIS 接口', b: 'D20260819-04', c: 32, s: '失败', e: '报告单位未匹配', d: '08-19 17:42' },
      { o: '上饶市一附院', t: '死亡登记', b: 'D20260819-01', c: 67, s: '成功', e: '—', d: '08-19 09:18' }
    ];
    var tr = r.map(function (x) {
      var st = x.s === '成功' ? 'success' : x.s === '部分成功' ? 'warn' : 'danger';
      return '<tr><td>' + esc(x.o) + '</td><td>' + esc(x.t) + '</td><td>' + esc(x.b) + '</td><td class="num">' + x.c + '</td><td>' + tone(x.s, st) + '</td><td style="color:#b54708">' + esc(x.e) + '</td><td>' + esc(x.d) + '</td><td>' + actBtn('详情', 'view', x.b) + '</td></tr>';
    }).join('');
    return heads('肿瘤死亡原始数据接入', '针对死亡数据的接入记录，记录传输状态与错误信息。') +
      kpis([{ l: '接入机构数', v: '612', m: '本年度累计 1,204 家' }, { l: '今日批次', v: '14', m: '较昨日持平' }, { l: '接入成功率', v: '98.1%', m: '环比 +0.4pp', tone: 'up' }, { l: '待处理错误', v: '5', m: '2 条高优先级', tone: 'warn' }]) +
      '<div class="mon-grid13"><div>' + card('死亡数据接入明细', table(['接入机构', '数据类型', '批次号', '#记录数', '传输状态', '错误信息', '接入时间', '操作'], tr)) + '</div>' +
      '<div>' + card('近 7 日死亡接入量', barChart([{ l: '8-15', v: 210 }, { l: '8-16', v: 240 }, { l: '8-17', v: 198 }, { l: '8-18', v: 262 }, { l: '8-19', v: 275 }, { l: '8-20', v: 258 }, { l: '8-21', v: 289 }]), '单位：例') + '</div></div>';
  }
  function renderDeathCube() {
    var r = [
      { n: '肺', cnt: 3120, rate: 27.6, fat: 0.72, d: '+3.1%' },
      { n: '肝', cnt: 2040, rate: 18.0, fat: 0.88, d: '+1.6%' },
      { n: '胃', cnt: 1850, rate: 16.3, fat: 0.71, d: '-0.8%' },
      { n: '食管', cnt: 1420, rate: 12.5, fat: 0.68, d: '+0.5%' },
      { n: '结直肠', cnt: 1180, rate: 10.4, fat: 0.55, d: '+2.2%' },
      { n: '胰腺', cnt: 820, rate: 7.2, fat: 0.93, d: '+4.0%' }
    ];
    var tr = r.map(function (x) {
      return '<tr><td>' + esc(x.n) + '</td><td class="num">' + x.cnt + '</td><td class="num">' + x.rate + '</td><td class="num">' + x.fat + '</td><td class="num" style="color:' + (x.d.charAt(0) === '+' ? '#2e7d32' : '#b42335') + '">' + x.d + '</td></tr>';
    }).join('');
    return heads('多维死亡统计指标立方体', '预计算死亡相关核心指标，支持快速分析。') +
      filterBar([{ label: '统计维度', type: 'select', options: ['癌种', '地区', '年龄组', '性别'] }, { label: '年份', type: 'select', options: ['2026', '2025', '2024'] }, { label: '指标', type: 'select', options: ['死亡率', '死亡数', '病死率'] }, { label: '地区', type: 'select', options: ['全省', '南昌市', '赣州市'] }, { label: '性别', type: 'select', options: ['全部', '男', '女'] }]) +
      kpis([{ l: '总死亡数', v: '18,420', m: '2026 年 1-8 月' }, { l: '粗死亡率', v: '162.8', m: '1/10万', tone: 'info' }, { l: '总体病死率', v: '77.3%', m: '死亡/发病', tone: 'warn' }, { l: '年龄标化率', v: '138.6', m: 'ASR(W)', tone: 'info' }]) +
      '<div class="mon-grid13"><div>' + card('各癌种死亡率（1/10万）', barChart([{ l: '肺', v: 27.6 }, { l: '肝', v: 18.0 }, { l: '胃', v: 16.3 }, { l: '食管', v: 12.5 }, { l: '结直肠', v: 10.4 }, { l: '胰腺', v: 7.2 }])) + '</div>' +
      '<div>' + card('指标明细（癌种维度）', table(['癌种', '#死亡数', '#死亡率', '#病死率', '#环比'], tr)) + '</div></div>';
  }
  function renderDeathTrend() {
    return heads('死亡趋势可视化配置', '配置死亡率趋势图的展示参数。') +
      filterBar([{ label: '时间范围', type: 'select', options: ['近 12 个月', '近 6 个月', '近 24 个月'] }, { label: '癌种', type: 'select', options: ['全部癌种', '肺癌', '肝癌', '胃癌'] }, { label: '地区', type: 'select', options: ['全省', '南昌市', '赣州市'] }, { label: '图表类型', type: 'select', options: ['折线图', '柱状图', '面积图'] }, { label: '粒度', type: 'select', options: ['按月', '按季度', '按年'] }]) +
      '<div class="mon-grid13"><div>' + card('死亡率趋势预览（1/10万）', lineChart([{ l: '1月', v: 19.2 }, { l: '2月', v: 18.7 }, { l: '3月', v: 20.1 }, { l: '4月', v: 19.6 }, { l: '5月', v: 20.8 }, { l: '6月', v: 20.4 }, { l: '7月', v: 21.3 }, { l: '8月', v: 21.9 }]), '按月 · 全省 · 全部癌种') + '</div>' +
      '<div>' + card('展示参数', '<div class="mon-meta">基线：2026 年全省。切换癌种、地区、粒度后点击「查询」应用。</div>') + '</div></div>';
  }
  function renderDeathLink() {
    var r = [
      { n: '陈建国', diag: '右肺上叶腺癌', d0: '2026-01-15', d1: '2026-08-20', st: '带瘤生存', sur: '8.2 个月', lk: '已关联', fat: '78%' },
      { n: '赵德顺', diag: '胃窦低分化腺癌', d0: '2026-03-02', d1: '2026-07-18', st: '死亡', sur: '4.5 个月', lk: '已关联', fat: '—' },
      { n: '刘雅琴', diag: '左乳浸润性导管癌', d0: '2026-03-22', d1: '—', st: '存活', sur: '—', lk: '仅发病', fat: '—' },
      { n: '孙志远', diag: '肝细胞癌', d0: '2026-02-10', d1: '2026-06-30', st: '死亡', sur: '4.6 个月', lk: '已关联', fat: '—' },
      { n: '周桂兰', diag: '食管鳞癌', d0: '2026-04-05', d1: '2026-08-12', st: '死亡', sur: '4.2 个月', lk: '已关联', fat: '—' }
    ];
    var tr = r.map(function (x) {
      var stc = x.st === '死亡' ? 'danger' : x.st === '带瘤生存' ? 'warn' : 'success';
      var lk = x.lk === '已关联' ? tone('已关联', 'success') : tone('仅发病', 'neutral');
      return '<tr><td>' + esc(x.n) + '</td><td>' + esc(x.diag) + '</td><td>' + esc(x.d0) + '</td><td>' + esc(x.d1) + '</td><td>' + tone(x.st, stc) + '</td><td class="num">' + esc(x.sur) + '</td><td>' + lk + '</td><td class="num">' + esc(x.fat) + '</td></tr>';
    }).join('');
    return heads('死亡-发病关联分析记录', '关联同一患者的发病与死亡记录，计算病死率等指标。') +
      kpis([{ l: '可关联患者', v: '18,240', m: '发病-死亡已配对' }, { l: '关联率', v: '94.3%', m: '环比 +1.2pp', tone: 'up' }, { l: '总体病死率', v: '77.3%', m: 'M/I', tone: 'warn' }, { l: '中位生存期', v: '14.2', m: '月', tone: 'info' }]) +
      card('发病-死亡关联记录', table(['患者', '发病诊断', '确诊日期', '死亡日期', '状态', '#生存期', '关联状态', '#致死率'], tr));
  }

  /* ==================== 专科能力分析 ==================== */
  function renderCapTech() {
    var r = [
      { n: '胸腔镜肺癌根治术', c: '外科手术', lv: '三级', std: '三级甲等、年例数≥50', cnt: 42, st: '在用' },
      { n: '调强放疗(IMRT)', c: '放射治疗', lv: '三级', std: '配备直线加速器', cnt: 28, st: '在用' },
      { n: '肿瘤基因检测(NGS)', c: '精准诊断', lv: '三级', std: '通过省级 PCR 质控', cnt: 18, st: '在用' },
      { n: 'CAR-T 细胞治疗', c: '细胞治疗', lv: '特级', std: '省级中心备案', cnt: 3, st: '试点' },
      { n: '超声内镜(EUS)', c: '内镜诊疗', lv: '二级', std: '三级医院内镜中心', cnt: 35, st: '在用' },
      { n: '肝动脉灌注化疗', c: '介入治疗', lv: '二级', std: '介入导管室', cnt: 22, st: '在用' }
    ];
    var tr = r.map(function (x) {
      var lvt = x.lv === '特级' ? 'danger' : x.lv === '三级' ? 'warn' : 'info';
      return '<tr><td>' + esc(x.n) + '</td><td>' + esc(x.c) + '</td><td>' + tone(x.lv, lvt) + '</td><td style="max-width:300px">' + esc(x.std) + '</td><td class="num">' + x.cnt + '</td><td>' + tone(x.st, x.st === '在用' ? 'success' : 'warn') + '</td><td>' + actBtn('维护', 'edit', x.n) + '</td></tr>';
    }).join('');
    return heads('肿瘤诊疗技术目录', '建立标准化的肿瘤诊疗技术清单，作为能力评估基础。') +
      kpis([{ l: '技术总数', v: '86', m: '覆盖 6 大类别' }, { l: '在用技术', v: '78', m: '占比 90.7%' }, { l: '试点技术', v: '8', m: '前沿技术' }, { l: '本季新增', v: '3', m: '较上季 +1' }]) +
      '<div style="margin-bottom:14px;display:flex;gap:8px"><button class="btn btn-primary btn-sm" data-mon="new">＋ 新增技术</button></div>' +
      card('诊疗技术清单', table(['技术名称', '类别', '技术级别', '准入标准', '#开展机构数', '状态', '操作'], tr));
  }
  function renderCapRecord() {
    var r = [
      { o: '江西省肿瘤医院', t: '胸腔镜肺癌根治术', cnt: 1286, q: 96.2, comp: '2.1%', y: '2026' },
      { o: '南昌大学一附院', t: '调强放疗(IMRT)', cnt: 964, q: 94.8, comp: '1.8%', y: '2026' },
      { o: '赣州中心医院', t: '超声内镜(EUS)', cnt: 512, q: 92.5, comp: '1.4%', y: '2026' },
      { o: '九江市肿瘤医院', t: '肝动脉灌注化疗', cnt: 386, q: 90.1, comp: '2.6%', y: '2026' },
      { o: '上饶医学院一附院', t: '肿瘤基因检测(NGS)', cnt: 640, q: 93.7, comp: '0.9%', y: '2026' }
    ];
    var tr = r.map(function (x) {
      var grade = x.q >= 94 ? '优秀' : x.q >= 91 ? '良好' : '待改进';
      var gt = x.q >= 94 ? 'success' : x.q >= 91 ? 'info' : 'warn';
      return '<tr><td>' + esc(x.o) + '</td><td>' + esc(x.t) + '</td><td class="num">' + x.cnt + '</td><td class="num" style="color:' + (x.q >= 94 ? '#2e7d32' : x.q >= 91 ? '#b54708' : '#b42335') + '">' + x.q + '</td><td class="num">' + esc(x.comp) + '</td><td>' + tone(grade, gt) + '</td><td class="num">' + esc(x.y) + '</td></tr>';
    }).join('');
    return heads('机构技术开展记录', '记录各机构开展特定技术的数量与质量，用于能力画像。') +
      kpis([{ l: '开展机构数', v: '1,286', m: '本年度' }, { l: '累计开展例数', v: '42,360', m: '较去年 +8.2%' }, { l: '质量达标率', v: '93.6%', m: '目标 ≥92%', tone: 'up' }, { l: '并发症率', v: '1.9%', m: '低于警戒线 3%', tone: 'up' }]) +
      card('机构技术开展明细', table(['机构', '开展技术', '#开展例数', '#质量评分', '#并发症率', '质控评级', '#年度'], tr));
  }
  function renderCapQuality() {
    var r = [
      { o: '江西省肿瘤医院', d: '0.8%', c: '1.6%', days: '7.2 天', re: '1.1%', s: '98.2', g: '优秀' },
      { o: '南昌大学一附院', d: '0.9%', c: '1.8%', days: '7.6 天', re: '1.3%', s: '96.8', g: '优秀' },
      { o: '赣州中心医院', d: '1.2%', c: '2.2%', days: '8.1 天', re: '1.8%', s: '93.4', g: '良好' },
      { o: '上饶医学院一附院', d: '1.4%', c: '2.5%', days: '8.6 天', re: '2.0%', s: '91.7', g: '良好' },
      { o: '九江市人民医院', d: '1.7%', c: '2.9%', days: '9.0 天', re: '2.4%', s: '89.2', g: '待改进' }
    ];
    var tr = r.map(function (x) {
      var gt = x.g === '优秀' ? 'success' : x.g === '良好' ? 'info' : 'warn';
      return '<tr><td>' + esc(x.o) + '</td><td class="num">' + esc(x.d) + '</td><td class="num">' + esc(x.c) + '</td><td class="num">' + esc(x.days) + '</td><td class="num">' + esc(x.re) + '</td><td class="num">' + esc(x.s) + '</td><td>' + tone(x.g, gt) + '</td></tr>';
    }).join('');
    return heads('医疗质量核心指标明细', '存储围手术期死亡率、并发症率等医疗质量指标。') +
      kpis([{ l: '平均围手术期死亡率', v: '1.2%', m: '全省平均', tone: 'warn' }, { l: '平均并发症率', v: '2.2%', m: '警戒线 3%' }, { l: '平均住院日', v: '8.1', m: '天', tone: 'info' }, { l: '质控达标机构', v: '1,142', m: '占比 89.6%' }]) +
      card('机构医疗质量指标', table(['机构', '#围手术期死亡率', '#并发症率', '#平均住院日', '#非计划再手术率', '#质控综合分', '评级'], tr));
  }
  function renderCapDifficulty() {
    var r = [
      { n: '杨某', d: '肺癌 IIIB 期伴纵隔转移', lv: 'IV 级', o: '江西省肿瘤医院', m: 'MDT 会诊', o2: '稳定' },
      { n: '李某', d: '胃癌 IV 期多发转移', lv: 'IV 级', o: '南昌大学一附院', m: 'MDT 会诊', o2: '进展' },
      { n: '王某', d: '肝癌伴门静脉癌栓', lv: 'III 级', o: '赣州中心医院', m: '单科', o2: '稳定' },
      { n: '张某', d: '胰腺癌局部晚期', lv: 'IV 级', o: '江西省肿瘤医院', m: 'MDT 会诊', o2: '好转' },
      { n: '刘某', d: '食管癌侵及主动脉', lv: 'III 级', o: '上饶一附院', m: 'MDT 会诊', o2: '稳定' }
    ];
    var tr = r.map(function (x) {
      var lvt = x.lv.indexOf('IV') === 0 ? 'danger' : 'warn';
      var ot = x.o2 === '好转' ? 'success' : x.o2 === '稳定' ? 'info' : 'warn';
      return '<tr><td>' + esc(x.n) + '</td><td>' + esc(x.d) + '</td><td>' + tone(x.lv, lvt) + '</td><td>' + esc(x.o) + '</td><td>' + esc(x.m) + '</td><td>' + tone(x.o2, ot) + '</td></tr>';
    }).join('');
    return heads('疑难病例收治特征库', '量化机构收治疑难重症的能力，用于专科能力建设评估。') +
      kpis([{ l: '疑难病例数', v: '3,842', m: '本年度' }, { l: 'IV 级占比', v: '46.2%', m: '疑难重症' }, { l: 'MDT 覆盖率', v: '78.5%', m: '环比 +4.1pp', tone: 'up' }, { l: '转归好转率', v: '21.3%', m: '复杂病例', tone: 'info' }]) +
      card('疑难病例收治明细', table(['患者', '诊断特征', '疑难程度', '收治机构', '诊疗模式', '转归'], tr));
  }
  /* ==================== 预警模型构建 ==================== */
  function renderModelWarehouse() {
    var r = [
      { s: 'HIS/EMR 临床数据', t: '病例特征集', cnt: 124800, d: '肿瘤病例诊疗过程', u: '08-21', q: '98.5%', st: '同步中' },
      { s: '肿瘤登记发病数据', t: '时间序列特征', cnt: 23846, d: '按癌种×地区×月份', u: '08-21', q: '99.2%', st: '已同步' },
      { s: '随访死亡数据', t: '结局特征集', cnt: 18420, d: '生存/死亡/生存期', u: '08-20', q: '97.1%', st: '已同步' },
      { s: '医疗质量指标', t: '机构特征集', cnt: 360, d: '机构×质量维度', u: '08-19', q: '96.8%', st: '已同步' },
      { s: '人口基数数据', t: '分母特征集', cnt: 1204, d: '分年龄性别人口', u: '08-18', q: '99.0%', st: '已同步' },
      { s: '地理信息数据', t: '空间特征集', cnt: 782, d: '区县×网格', u: '08-18', q: '95.6%', st: '待核对' }
    ];
    var tr = r.map(function (x) {
      var st = x.st === '已同步' ? 'success' : x.st === '同步中' ? 'info' : 'warn';
      return '<tr><td>' + esc(x.s) + '</td><td>' + esc(x.t) + '</td><td class="num">' + x.cnt + '</td><td style="max-width:220px">' + esc(x.d) + '</td><td>' + esc(x.u) + '</td><td class="num">' + esc(x.q) + '</td><td>' + tone(x.st, st) + '</td></tr>';
    }).join('');
    return heads('多源特征数据仓库', '构建用于 AI 模型训练的标准化特征数据池。') +
      kpis([{ l: '数据源', v: '48', m: '覆盖 6 大系统' }, { l: '特征集总数', v: '312', m: '标准化特征' }, { l: '样本总量', v: '18.6万', m: '去重后' }, { l: '数据完整度', v: '97.6%', m: '环比 +0.5pp', tone: 'up' }]) +
      card('特征数据池清单', table(['数据源', '特征集类型', '#样本量', '覆盖描述', '更新时间', '#完整度', '状态'], tr));
  }
  function renderModelReg() {
    var r = [
      { n: '发病率异常预测模型', t: '时序预测', v: 'v3.2', s: '发病监测', c: '生产', who: '张博士', u: '08-18' },
      { n: '死亡风险分层模型', t: '分类', v: 'v2.1', s: '死亡监测', c: '生产', who: '李博士', u: '08-10' },
      { n: '专科能力评分模型', t: '评分/对标', v: 'v1.8', s: '能力分析', c: '生产', who: '王博士', u: '08-05' },
      { n: '高危区域识别模型', t: '聚类', v: 'v1.2', s: '预警干预', c: '验证中', who: '赵博士', u: '07-28' },
      { n: '生存预后模型', t: '生存分析', v: 'v0.9', s: '科研', c: '开发中', who: '陈博士', u: '07-20' }
    ];
    var tr = r.map(function (x) {
      var st = x.c === '生产' ? 'success' : x.c === '验证中' ? 'info' : 'warn';
      return '<tr><td>' + esc(x.n) + '</td><td>' + esc(x.t) + '</td><td>' + esc(x.v) + '</td><td>' + esc(x.s) + '</td><td>' + tone(x.c, st) + '</td><td>' + esc(x.who) + '</td><td>' + esc(x.u) + '</td><td>' + actBtn('编辑', 'edit', x.n) + '</td></tr>';
    }).join('');
    return heads('预警模型元信息注册', '管理风险预测模型的基本信息与生命周期状态。') +
      kpis([{ l: '注册模型', v: '18', m: '活跃 12 个' }, { l: '生产中', v: '9', m: '调用稳定' }, { l: '验证中', v: '4', m: '待评估' }, { l: '本月迭代', v: '6', m: '版本更新' }]) +
      '<div style="margin-bottom:14px;display:flex;gap:8px"><button class="btn btn-primary btn-sm" data-mon="new">＋ 注册模型</button></div>' +
      card('模型注册清单', table(['模型名称', '模型类型', '当前版本', '应用场景', '生命周期', '负责人', '更新时间', '操作'], tr));
  }
  function renderModelTrain() {
    var r = [
      { n: '发病率异常预测模型', v: 'v3.2', a: 'XGBoost', hp: 'lr=0.05, depth=6, n=400', sz: '12.4万', auc: '0.942', tm: '1h24m', st: '成功' },
      { n: '死亡风险分层模型', v: 'v2.1', a: 'LightGBM', hp: 'lr=0.10, leaves=32', sz: '8.2万', auc: '0.918', tm: '52m', st: '成功' },
      { n: '高危区域识别模型', v: 'v1.2', a: 'KMeans++', hp: 'k=8, dist=cosine', sz: '6.8万', auc: '0.886', tm: '38m', st: '成功' },
      { n: '生存预后模型', v: 'v0.9', a: 'CoxPH', hp: 'alpha=0.01, ties=efron', sz: '5.6万', auc: '0.901', tm: '1h05m', st: '失败' },
      { n: '专科能力评分', v: 'v1.8', a: 'RandomForest', hp: 'n=300, depth=8', sz: '3.9万', auc: '0.935', tm: '44m', st: '成功' }
    ];
    var tr = r.map(function (x) {
      var st = x.st === '成功' ? 'success' : 'danger';
      return '<tr><td>' + esc(x.n) + '</td><td>' + esc(x.v) + '</td><td>' + esc(x.a) + '</td><td style="max-width:200px">' + esc(x.hp) + '</td><td class="num">' + esc(x.sz) + '</td><td class="num">' + esc(x.auc) + '</td><td class="num">' + esc(x.tm) + '</td><td>' + tone(x.st, st) + '</td></tr>';
    }).join('');
    return heads('模型训练与超参记录', '详细记录模型训练过程，确保实验可复现与性能可追溯。') +
      kpis([{ l: '训练任务', v: '42', m: '本年度' }, { l: '成功率', v: '95.2%', m: '环比 +1.1pp', tone: 'up' }, { l: '平均 AUC', v: '0.916', m: '较上版 +0.012', tone: 'up' }, { l: '平均训练耗时', v: '1h12m', m: '较上版 -8%' }]) +
      card('训练任务记录', table(['模型', '版本', '算法', '超参数', '#训练样本', '#AUC', '#耗时', '状态'], tr));
  }
  function renderModelSnapshot() {
    var r = [
      { id: 'SNAP-0821-01', m: '发病率异常预测模型 v3.2', p: '2026-08', c: 12, h: 3, d: '高风险增 2 个区县', t: '08-21 02:00' },
      { id: 'SNAP-0821-02', m: '高危区域识别模型 v1.2', p: '2026-08', c: 36, h: 8, d: '识别 8 个高风险网格', t: '08-21 02:15' },
      { id: 'SNAP-0820-01', m: '死亡风险分层模型 v2.1', p: '2026-08', c: 18, h: 4, d: '高风险人群 420 例', t: '08-20 02:00' },
      { id: 'SNAP-0819-01', m: '发病率异常预测模型 v3.2', p: '2026-07', c: 10, h: 2, d: '复核上月快照', t: '08-19 02:00' }
    ];
    var tr = r.map(function (x) {
      return '<tr><td>' + esc(x.id) + '</td><td>' + esc(x.m) + '</td><td>' + esc(x.p) + '</td><td class="num">' + x.c + '</td><td class="num" style="color:#b54708">' + x.h + '</td><td>' + esc(x.d) + '</td><td>' + esc(x.t) + '</td><td>' + actBtn('查看', 'view', x.id) + '</td></tr>';
    }).join('');
    return heads('风险预测结果快照', '存储模型预测结果，用于预警触发与决策支持。') +
      kpis([{ l: '快照总数', v: '126', m: '月度滚动' }, { l: '今日生成', v: '4', m: '凌晨调度' }, { l: '覆盖区县', v: '54', m: '含网格 1,208 个' }, { l: '高风险命中', v: '15', m: '需干预', tone: 'warn' }]) +
      card('预测结果快照', table(['快照ID', '模型/版本', '预测时段', '#覆盖区县', '#高风险数', '结果摘要', '生成时间', '操作'], tr));
  }
  function renderModelEval() {
    var r = [
      { m: '发病率异常预测模型 v3.2', s: '2026-08 回测', auc: '0.942', sn: '0.871', sp: '0.884', ks: '0.723', pr: '0.818', c: '通过' },
      { m: '死亡风险分层模型 v2.1', s: '2026-08 回测', auc: '0.918', sn: '0.846', sp: '0.861', ks: '0.692', pr: '0.790', c: '通过' },
      { m: '高危区域识别模型 v1.2', s: '2026-07 验证', auc: '0.886', sn: '0.812', sp: '0.825', ks: '0.641', pr: '0.748', c: '验证中' },
      { m: '生存预后模型 v0.9', s: '2026-07 验证', auc: '0.901', sn: '0.795', sp: '0.808', ks: '0.588', pr: '0.726', c: '未通过' },
      { m: '专科能力评分 v1.8', s: '2026-06 回测', auc: '0.935', sn: '0.862', sp: '0.874', ks: '0.715', pr: '0.802', c: '通过' }
    ];
    var tr = r.map(function (x) {
      var ok = x.c === '通过' ? 'success' : x.c === '验证中' ? 'info' : 'danger';
      return '<tr><td>' + esc(x.m) + '</td><td>' + esc(x.s) + '</td><td class="num">' + esc(x.auc) + '</td><td class="num">' + esc(x.sn) + '</td><td class="num">' + esc(x.sp) + '</td><td class="num">' + esc(x.ks) + '</td><td class="num">' + esc(x.pr) + '</td><td>' + tone(x.c, ok) + '</td><td>' + actBtn('报告', 'view', x.m) + '</td></tr>';
    }).join('');
    return heads('模型验证与评估报告', '定期评估模型在真实场景中的表现，驱动迭代优化。') +
      kpis([{ l: '评估报告', v: '35', m: '本年度' }, { l: '平均 AUC', v: '0.916', m: '较上季 +0.009', tone: 'up' }, { l: '通过率', v: '85.7%', m: '环比 -2.1pp', tone: 'warn' }, { l: '待验证模型', v: '4', m: '本月队列' }]) +
      card('模型评估明细', table(['模型/版本', '评估集', '#AUC', '#敏感度', '#特异度', '#KS', '#PR-AUC', '结论', '操作'], tr));
  }
  var ROUTES = {
    'mon-inc-import': renderIncImport, 'mon-inc-cube': renderIncCube, 'mon-inc-trend': renderIncTrend,
    'mon-inc-rule': renderIncRule, 'mon-inc-ticket': renderIncTicket,
    'mon-death-import': renderDeathImport, 'mon-death-cube': renderDeathCube, 'mon-death-trend': renderDeathTrend, 'mon-death-link': renderDeathLink,
    'mon-cap-tech': renderCapTech, 'mon-cap-record': renderCapRecord, 'mon-cap-quality': renderCapQuality,
    'mon-cap-difficulty': renderCapDifficulty,
    'mon-model-warehouse': renderModelWarehouse, 'mon-model-reg': renderModelReg, 'mon-model-train': renderModelTrain,
    'mon-model-snapshot': renderModelSnapshot, 'mon-model-eval': renderModelEval
  };

  function renderMonitorPage(pageId) {
    if (ROUTES[pageId]) return ROUTES[pageId]();
    for (var i = 0; i < GROUPS.length; i++) { if (GROUPS[i].key === pageId) return groupPage(GROUPS[i]); }
    return null;
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-mon]') : null;
    if (!el) return;
    var action = el.getAttribute('data-mon');
    var arg = el.getAttribute('data-arg') || '';
    if (action === 'close') { closeModal(); return; }
    if (action === 'go') { if (window.navigateTo) window.navigateTo(arg); return; }
    if (action === 'reset') { toast('已重置筛选条件'); return; }
    if (action === 'query') { toast('查询成功，已按当前条件刷新'); return; }
    if (action === 'new') { toast('已打开新增表单（演示）'); return; }
    if (action === 'edit') { toast('已打开「' + arg + '」编辑（演示）'); return; }
    if (action === 'toggle') { toast('已切换「' + arg + '」状态（演示）'); return; }
    if (action === 'view') { openModal(arg, [['编号 / 名称', arg], ['所属模块', '肿瘤监测与预警'], ['当前状态', '正常'], ['最近更新', '2026-08-21 14:30'], ['责任人', '系统管理员'], ['备注', '演示数据，后续接入真实业务。']]); return; }
  });

  if (typeof window !== 'undefined') {
    window.MONITOR_GROUPS = GROUPS;
    window.monitorPageIds = GROUPS.map(function (g) { return g.key; }).concat(SITES.map(function (s) { return s.id; }));
    window.renderMonitorPage = renderMonitorPage;
  }
})();
