/*
 * 风险预警模型构建模块
 * 对应功能点：
 *   多源特征数据仓库 · 预警模型元信息注册 · 模型训练与超参记录
 *   风险预测结果快照 · 模型验证与评估报告 · 风险预警干预工单
 * 与「预警监测与处置」的分工：预警模块是确定性阈值规则引擎（可解释、可追责）；
 *   本模块是模型驱动的风险预测（概率输出、需验证与校准），产出干预工单而非核查工单。
 */
(function () {
  'use strict';

  const OWNED_IDS = ['mdl-features', 'mdl-registry', 'mdl-training', 'mdl-predictions', 'mdl-evaluation', 'mdl-interventions'];
  const CURRENT_USER = '省级登记中心 · 陈敏';

  const style = document.createElement('style');
  style.textContent = `
#pageContainer .md-page{padding-bottom:20px}
#pageContainer .md-head{background:linear-gradient(135deg,#fbfdff,#f4f8fd);border:1px solid var(--border);border-left:4px solid var(--primary);border-radius:6px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
#pageContainer .md-title{font-size:17px;font-weight:700;color:#1e293b}
#pageContainer .md-sub{margin-top:5px;font-size:12px;color:#64748b;line-height:1.85;max-width:1080px}
#pageContainer .md-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
#pageContainer .md-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:10px;margin-bottom:14px}
#pageContainer .md-kpi{background:#fff;border:1px solid var(--border);border-radius:6px;padding:11px 13px}
#pageContainer .md-kpi-label{font-size:12px;color:#667085}
#pageContainer .md-kpi-value{margin-top:5px;font-size:23px;font-weight:700;color:var(--primary);font-variant-numeric:tabular-nums}
#pageContainer .md-kpi-value.danger{color:#b42335}
#pageContainer .md-kpi-value.warn{color:#b54708}
#pageContainer .md-kpi-value.ok{color:#15803d}
#pageContainer .md-kpi-meta{margin-top:3px;font-size:11px;color:#94a3b8}
#pageContainer .md-card{background:#fff;border:1px solid var(--border);border-radius:6px;margin-bottom:14px;overflow:hidden}
#pageContainer .md-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;border-bottom:1px solid var(--border);background:#fbfcfe}
#pageContainer .md-card-title{font-size:14px;font-weight:600;color:#1e293b;display:flex;align-items:baseline;gap:8px}
#pageContainer .md-card-sub{font-size:11px;font-weight:400;color:#94a3b8}
#pageContainer .md-card-body{padding:13px 14px}
#pageContainer .md-grid2{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:14px}
@media(max-width:1280px){#pageContainer .md-grid2{grid-template-columns:minmax(0,1fr)}}
#pageContainer .md-filter{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px 12px;align-items:end;padding:12px 14px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;margin-bottom:12px}
#pageContainer .md-filter .filter-actions{display:flex;gap:8px;align-items:flex-end}
#pageContainer .md-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:6px;background:#fff}
#pageContainer .md-table{width:100%;min-width:1080px;border-collapse:collapse}
#pageContainer .md-table th{height:40px;padding:0 11px;text-align:left;background:#f8fafc;color:#5b6673;font-size:12px;font-weight:600;border-bottom:1px solid var(--border);white-space:nowrap}
#pageContainer .md-table td{height:46px;padding:7px 11px;border-bottom:1px solid var(--border);color:#334155;font-size:13px;vertical-align:middle}
#pageContainer .md-table td.md-nowrap{white-space:nowrap}
#pageContainer .md-table tbody tr:hover{background:#f5f9ff}
#pageContainer .md-table .badge{white-space:nowrap}
#pageContainer .md-id{background:none;border:0;padding:0;color:var(--primary);font-weight:600;font-size:13px;cursor:pointer}
#pageContainer .md-id:hover{text-decoration:underline}
#pageContainer .md-sec{font-size:11px;color:#94a3b8;margin-top:3px;line-height:1.6}
#pageContainer .md-num{font-variant-numeric:tabular-nums;text-align:right}
#pageContainer .md-bar{height:6px;border-radius:3px;background:#eef2f7;overflow:hidden;margin-top:5px;min-width:70px}
#pageContainer .md-bar>i{display:block;height:100%;background:var(--primary)}
#pageContainer .md-bar>i.warn{background:#f59e0b}
#pageContainer .md-bar>i.bad{background:#dc2626}
#pageContainer .md-bar>i.ok{background:#16a34a}
#pageContainer .md-note{font-size:11px;color:#94a3b8;line-height:1.8}
#pageContainer .md-callout{border:1px solid #cfe0f5;border-left:3px solid var(--primary);background:#f4f9ff;border-radius:5px;padding:10px 12px;font-size:12px;color:#334155;line-height:1.85}
#pageContainer .md-callout.warn{border-color:#f2cf73;border-left-color:#f4b400;background:#fff8e6;color:#594414}
#pageContainer .md-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:9px}
#pageContainer .md-field{min-width:0;padding:9px 10px;background:#fbfcfe;border:1px solid var(--border);border-radius:5px}
#pageContainer .md-field-label{font-size:11px;color:#667085}
#pageContainer .md-value{margin-top:3px;font-size:13px;color:#1e293b;word-break:break-word}
#pageContainer .md-modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:1200;padding:24px}
#pageContainer .md-modal{background:#fff;border-radius:8px;width:min(960px,100%);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 45px rgba(15,23,42,.25)}
#pageContainer .md-modal.narrow{width:min(680px,100%)}
#pageContainer .md-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border)}
#pageContainer .md-modal-title{font-size:15px;font-weight:700;color:#1e293b}
#pageContainer .md-close{background:none;border:0;font-size:20px;line-height:1;color:#94a3b8;cursor:pointer}
#pageContainer .md-modal-body{padding:15px 16px;overflow:auto}
#pageContainer .md-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--border);background:#fbfcfe}
#pageContainer .md-sect{margin-top:14px}
#pageContainer .md-h{margin:0 0 8px;font-size:13px;font-weight:600;color:#475569}
#pageContainer .md-pivot{width:100%;border-collapse:collapse;font-size:12px}
#pageContainer .md-pivot th,#pageContainer .md-pivot td{border:1px solid var(--border);padding:6px 9px;text-align:right;white-space:nowrap}
#pageContainer .md-pivot th{background:#f8fafc;color:#5b6673;font-weight:600}
#pageContainer .md-pivot th:first-child,#pageContainer .md-pivot td:first-child{text-align:left}
#pageContainer .md-empty{padding:30px;text-align:center;color:#94a3b8;font-size:13px}
#pageContainer .md-chip{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:11px;background:#eef2f7;color:#475569;font-size:11px;font-weight:600;margin:2px 4px 2px 0}
#pageContainer .md-chip.hot{background:#fdeaec;color:#b42335}
#pageContainer .md-chip.mid{background:#fff4e5;color:#b54708}
#pageContainer .md-chip.cold{background:#e8f1fd;color:#1d4ed8}
#pageContainer .md-chart{border:1px solid var(--border);border-radius:6px;background:#fff;padding:10px 12px}
#pageContainer .md-chart svg{display:block;width:100%;height:auto}
#pageContainer .md-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;font-size:11px;color:#64748b}
#pageContainer .md-legend span{display:inline-flex;align-items:center;gap:5px}
#pageContainer .md-legend i{width:12px;height:3px;border-radius:2px;display:inline-block}
#pageContainer .md-code{background:#0f172a;color:#cbd5e1;border-radius:6px;padding:11px 13px;font-family:var(--font-num,Consolas,monospace);font-size:11.5px;line-height:1.75;overflow:auto;white-space:pre}
#pageContainer .md-heat{display:grid;gap:3px}
#pageContainer .md-heat-cell{height:30px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:600;color:#fff;cursor:pointer}
#pageContainer .md-heat-lab{font-size:11px;color:#64748b;display:flex;align-items:center;padding-right:6px;white-space:nowrap}
#pageContainer .md-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px 12px}
#pageContainer .md-form-grid .form-group.full{grid-column:1/-1}
#pageContainer .md-stage{display:flex;align-items:center;gap:0;flex-wrap:wrap;margin-bottom:12px}
#pageContainer .md-stage-item{display:flex;align-items:center;gap:7px;padding:7px 13px;background:#f1f5f9;color:#64748b;font-size:12px;font-weight:600;border-radius:4px;margin-right:6px}
#pageContainer .md-stage-item.done{background:#e7f6ec;color:#15803d}
#pageContainer .md-stage-item.cur{background:var(--primary);color:#fff}
`;
  document.head.appendChild(style);

  const LIFECYCLE = {
    DRAFT: { label: '设计中', cls: 'badge-muted', step: 0 },
    TRAINING: { label: '训练中', cls: 'badge-info', step: 1 },
    VALIDATING: { label: '验证中', cls: 'badge-warning', step: 2 },
    SHADOW: { label: '影子运行', cls: 'badge-orange', step: 3 },
    PRODUCTION: { label: '生产使用', cls: 'badge-success', step: 4 },
    DEGRADED: { label: '性能衰减', cls: 'badge-orange', step: 4 },
    RETIRED: { label: '已下线', cls: 'badge-muted', step: 5 }
  };
  const LIFECYCLE_STEPS = ['设计中', '训练中', '验证中', '影子运行', '生产使用', '已下线'];
  const RUN_STATUS = {
    SUCCESS: { label: '成功', cls: 'badge-success' },
    RUNNING: { label: '运行中', cls: 'badge-info' },
    FAILED: { label: '失败', cls: 'badge-danger' },
    ABORTED: { label: '已中止', cls: 'badge-muted' }
  };
  const RISK_LEVEL = {
    HIGH: { label: '高风险', cls: 'badge-danger', color: '#b42335' },
    MID: { label: '中风险', cls: 'badge-orange', color: '#d97706' },
    LOW: { label: '低风险', cls: 'badge-success', color: '#16a34a' }
  };
  const IV_STATUS = {
    PENDING: { label: '待接收', cls: 'badge-warning' },
    DOING: { label: '干预中', cls: 'badge-info' },
    DONE: { label: '已完成', cls: 'badge-success' },
    INVALID: { label: '判为无效', cls: 'badge-muted' }
  };
  const FEATURE_TIER = {
    HOT: { label: '实时/日更', cls: 'hot' },
    WARM: { label: '月更', cls: 'mid' },
    COLD: { label: '年更', cls: 'cold' }
  };

  const state = {
    page: 'mdl-features',
    features: { domain: 'ALL', tier: 'ALL', keyword: '' },
    registry: { status: 'ALL', task: 'ALL', keyword: '' },
    training: { model: 'ALL', status: 'ALL', keyword: '' },
    predictions: { model: 'MDL-002', level: 'ALL', keyword: '' },
    evaluation: { model: 'MDL-002' },
    interventions: { status: 'ALL', level: 'ALL', keyword: '' }
  };

  function esc(v) { const d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function n1(v) { return Number(v || 0).toFixed(1); }
  function n2(v) { return Number(v || 0).toFixed(2); }
  function n3(v) { return Number(v || 0).toFixed(3); }
  function nInt(v) { return Number(v || 0).toLocaleString('zh-CN'); }
  function badge(meta) { return meta ? '<span class="badge ' + meta.cls + '">' + esc(meta.label) + '</span>' : '-'; }
  function bar(ratio, tone) { const w = Math.max(0, Math.min(100, ratio)); return '<div class="md-bar"><i class="' + (tone || '') + '" style="width:' + w + '%"></i></div>'; }
  function mdToast(m, t) { if (typeof toast === 'function') toast(m, t); }
  function mdHeader(title, subtitle, actions) {
    return '<div class="md-head"><div><div class="md-title">' + esc(title) + '</div><div class="md-sub">' + subtitle + '</div></div><div class="md-actions">' + (actions || []).join('') + '</div></div>';
  }
  function mdKpi(label, value, meta, tone) {
    return '<div class="md-kpi"><div class="md-kpi-label">' + esc(label) + '</div><div class="md-kpi-value ' + (tone || '') + '">' + value + '</div><div class="md-kpi-meta">' + esc(meta) + '</div></div>';
  }
  function mdModal(title, body, foot, narrow) {
    const mask = document.createElement('div');
    mask.className = 'md-modal-mask';
    mask.innerHTML = '<div class="md-modal' + (narrow ? ' narrow' : '') + '"><div class="md-modal-head"><div class="md-modal-title">' + esc(title) + '</div><button class="md-close" aria-label="关闭">×</button></div><div class="md-modal-body">' + body + '</div>' + (foot ? '<div class="md-modal-foot">' + foot + '</div>' : '') + '</div>';
    mask.addEventListener('click', function (e) { if (e.target === mask) mask.remove(); });
    mask.querySelector('.md-close').addEventListener('click', function () { mask.remove(); });
    (document.getElementById('pageContainer') || document.body).appendChild(mask);
    return mask;
  }
  function closeMdModals() { document.querySelectorAll('.md-modal-mask').forEach(function (m) { m.remove(); }); }
  function mdSet(group, key, value) { state[group][key] = value; renderPage(state.page); }
  function fmtDate(s) { return s; }

  function lineChart(labels, series, opts) {
    opts = opts || {};
    const W = opts.width || 620, H = opts.height || 220;
    const padL = 44, padR = 12, padT = 12, padB = 26;
    const all = series.reduce(function (a, s) { return a.concat(s.values); }, []).filter(function (v) { return typeof v === 'number'; });
    let min = Math.min.apply(null, all), max = Math.max.apply(null, all);
    if (opts.yZero) min = 0;
    if (opts.yMax != null) max = opts.yMax;
    const span = (max - min) || 1;
    min = min - span * 0.08; max = max + span * 0.08;
    const x = function (i) { return padL + (W - padL - padR) * (labels.length <= 1 ? 0.5 : i / (labels.length - 1)); };
    const y = function (v) { return padT + (H - padT - padB) * (1 - (v - min) / (max - min)); };
    let g = '';
    for (let t = 0; t <= 4; t++) {
      const vv = min + (max - min) * t / 4, yy = y(vv);
      g += '<line x1="' + padL + '" y1="' + yy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + yy.toFixed(1) + '" stroke="#eef2f7"/>' +
        '<text x="' + (padL - 6) + '" y="' + (yy + 3.5).toFixed(1) + '" text-anchor="end" font-size="9" fill="#94a3b8">' + vv.toFixed(opts.dp == null ? 2 : opts.dp) + '</text>';
    }
    labels.forEach(function (lb, i) { g += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9" fill="#94a3b8">' + esc(lb) + '</text>'; });
    series.forEach(function (s) {
      const pts = s.values.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
      g += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round"' + (s.dash ? ' stroke-dasharray="5 4"' : '') + '/>';
      if (!s.dash) s.values.forEach(function (v, i) { g += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.6" fill="#fff" stroke="' + s.color + '" stroke-width="1.6"/>'; });
    });
    const legend = series.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('');
    return '<div class="md-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.aria || '曲线图') + '">' + g + '</svg><div class="md-legend">' + legend + '</div></div>';
  }

  /* ROC / 校准曲线 */
  function curveChart(points, opts) {
    opts = opts || {};
    const W = 300, H = 280, pad = 34;
    const x = function (v) { return pad + (W - pad - 12) * v; };
    const y = function (v) { return H - pad - (H - pad - 12) * v; };
    let g = '<line x1="' + x(0) + '" y1="' + y(0) + '" x2="' + x(1) + '" y2="' + y(1) + '" stroke="#cbd5e1" stroke-dasharray="4 4"/>';
    g += '<rect x="' + x(0) + '" y="' + y(1) + '" width="' + (x(1) - x(0)) + '" height="' + (y(0) - y(1)) + '" fill="none" stroke="#e6ebf2"/>';
    const pts = points.map(function (p) { return x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1); }).join(' ');
    g += '<polyline points="' + pts + '" fill="none" stroke="' + (opts.color || '#1d4ed8') + '" stroke-width="2.2"/>';
    points.forEach(function (p) { g += '<circle cx="' + x(p[0]).toFixed(1) + '" cy="' + y(p[1]).toFixed(1) + '" r="2.4" fill="#fff" stroke="' + (opts.color || '#1d4ed8') + '" stroke-width="1.5"/>'; });
    g += '<text x="' + (W / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="#64748b">' + esc(opts.xLabel || '') + '</text>';
    g += '<text x="12" y="' + (H / 2) + '" text-anchor="middle" font-size="10" fill="#64748b" transform="rotate(-90 12 ' + (H / 2) + ')">' + esc(opts.yLabel || '') + '</text>';
    return '<div class="md-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.aria || '曲线') + '">' + g + '</svg>' + (opts.note ? '<div class="md-note" style="margin-top:6px">' + esc(opts.note) + '</div>' : '') + '</div>';
  }

  /* ============ 1. 多源特征数据仓库 ============ */
  const FEATURE_DOMAIN = {
    DEMO: '人口与地理',
    INC: '发病与死亡历史',
    QUALITY: '登记质量',
    OPERATION: '上报运行',
    SCREEN: '筛查与随访',
    ENV: '环境与行为',
    RESOURCE: '医疗资源'
  };
  const features = [
    { code: 'F-DEMO-001', name: '常住人口数（区县-年）', domain: 'DEMO', tier: 'COLD', type: '数值', source: '统计年鉴 / 人口普查', nullRate: 0.0, drift: 0.4, importance: 0.061, note: '所有率值的分母，缺失或跳变会同时污染全部率类特征。' },
    { code: 'F-DEMO-002', name: '65岁及以上人口占比', domain: 'DEMO', tier: 'COLD', type: '数值', source: '统计年鉴', nullRate: 0.0, drift: 0.6, importance: 0.088, note: '年龄结构是发病率地区差异的首要解释变量。' },
    { code: 'F-DEMO-003', name: '城镇化率', domain: 'DEMO', tier: 'COLD', type: '数值', source: '统计年鉴', nullRate: 0.0, drift: 1.1, importance: 0.043, note: '与生活方式、就诊可及性相关。' },
    { code: 'F-DEMO-004', name: '区县地理编码（GIS 质心）', domain: 'DEMO', tier: 'COLD', type: '地理', source: '空间地址信息管理', nullRate: 1.8, drift: 0.0, importance: 0.027, note: '用于空间自相关与邻域特征构造。' },
    { code: 'F-INC-001', name: '近5年中标发病率（癌种别）', domain: 'INC', tier: 'WARM', type: '序列', source: '多维发病指标立方体', nullRate: 0.3, drift: 1.9, importance: 0.152, note: '模型最重要的历史基线特征，直接取自预计算立方体。' },
    { code: 'F-INC-002', name: '近5年中标死亡率（癌种别）', domain: 'INC', tier: 'WARM', type: '序列', source: '多维死亡指标立方体', nullRate: 0.4, drift: 1.7, importance: 0.118, note: '与发病率联合使用可识别登记不全导致的假性低发。' },
    { code: 'F-INC-003', name: 'M/I 比（癌种别）', domain: 'INC', tier: 'WARM', type: '数值', source: '死亡-发病关联分析', nullRate: 1.1, drift: 2.2, importance: 0.096, note: '既是疾病特征也是质量特征，需与 F-QUAL-* 联合判读。' },
    { code: 'F-INC-004', name: '早发比例（<50岁占比）', domain: 'INC', tier: 'WARM', type: '数值', source: '发病立方体年龄维', nullRate: 0.9, drift: 2.8, importance: 0.071, note: '年龄构成异常偏移的敏感指标。' },
    { code: 'F-INC-005', name: '发病率年度变化率（3年滑动）', domain: 'INC', tier: 'WARM', type: '数值', source: '发病立方体', nullRate: 1.5, drift: 3.4, importance: 0.084, note: '趋势特征，避免单年波动误导。' },
    { code: 'F-QUAL-001', name: 'MV%（形态学确诊比例）', domain: 'QUALITY', tier: 'WARM', type: '数值', source: '登记质量指标', nullRate: 0.2, drift: 1.4, importance: 0.079, note: '低 MV% 提示率值可能被低估，是关键混杂控制变量。' },
    { code: 'F-QUAL-002', name: 'DCO%（仅死亡证明来源比例）', domain: 'QUALITY', tier: 'WARM', type: '数值', source: '登记质量指标', nullRate: 0.2, drift: 1.6, importance: 0.067, note: '高 DCO% 地区的率值置信度低，模型需降权。' },
    { code: 'F-QUAL-003', name: 'UB%（部位不明比例）', domain: 'QUALITY', tier: 'WARM', type: '数值', source: '登记质量指标', nullRate: 0.3, drift: 1.2, importance: 0.038, note: '编码质量特征。' },
    { code: 'F-QUAL-004', name: '年龄不明率', domain: 'QUALITY', tier: 'WARM', type: '数值', source: '登记质量指标', nullRate: 0.2, drift: 0.9, importance: 0.022, note: '影响年龄标化率的可靠性。' },
    { code: 'F-OPS-001', name: '月度上报及时率', domain: 'OPERATION', tier: 'HOT', type: '数值', source: '接入批次统计', nullRate: 0.0, drift: 4.6, importance: 0.058, note: '上报行为特征，用于区分"真实升高"与"补报集中入库"。' },
    { code: 'F-OPS-002', name: '上报机构数（活跃）', domain: 'OPERATION', tier: 'HOT', type: '数值', source: '接入批次统计', nullRate: 0.0, drift: 3.1, importance: 0.049, note: '机构数变化是发病率突变的常见非疾病原因。' },
    { code: 'F-OPS-003', name: '报卡校验失败率', domain: 'OPERATION', tier: 'HOT', type: '数值', source: '原始数据接入错误明细', nullRate: 0.0, drift: 5.2, importance: 0.031, note: '数据质量的先行指标。' },
    { code: 'F-SCR-001', name: '癌症筛查项目覆盖人数', domain: 'SCREEN', tier: 'WARM', type: '数值', source: '筛查项目台账', nullRate: 6.2, drift: 8.4, importance: 0.093, note: '筛查会造成发病率短期抬升，是最重要的干扰因素特征。' },
    { code: 'F-SCR-002', name: '筛查项目起止年份标记', domain: 'SCREEN', tier: 'COLD', type: '类别', source: '筛查项目台账', nullRate: 6.2, drift: 0.0, importance: 0.055, note: '用于在模型中显式标注筛查窗口。' },
    { code: 'F-SCR-003', name: '随访失访率', domain: 'SCREEN', tier: 'WARM', type: '数值', source: '随访管理', nullRate: 2.7, drift: 3.8, importance: 0.026, note: '影响生存类标签的可靠性。' },
    { code: 'F-ENV-001', name: '工业企业密度（规模以上/万人）', domain: 'ENV', tier: 'COLD', type: '数值', source: '统计年鉴（外部）', nullRate: 3.4, drift: 1.5, importance: 0.047, note: '生态学层面的暴露替代指标，不可作因果推断。' },
    { code: 'F-ENV-002', name: '饮用水源类型构成', domain: 'ENV', tier: 'COLD', type: '类别', source: '环保/水务共享（外部）', nullRate: 11.6, drift: 0.8, importance: 0.034, note: '缺失率较高，仅在部分区县可用，采用缺失指示变量处理。' },
    { code: 'F-ENV-003', name: '成人吸烟率（抽样调查）', domain: 'ENV', tier: 'COLD', type: '数值', source: '慢病危险因素监测', nullRate: 8.9, drift: 1.3, importance: 0.062, note: '仅有地市级抽样值，区县层面通过地市值下推，存在生态学谬误风险。' },
    { code: 'F-RES-001', name: '每万人三级医院床位数', domain: 'RESOURCE', tier: 'COLD', type: '数值', source: '卫生资源统计', nullRate: 0.0, drift: 1.0, importance: 0.041, note: '就诊可及性代理变量，与检出率正相关。' },
    { code: 'F-RES-002', name: '区域内开展四级手术技术数', domain: 'RESOURCE', tier: 'WARM', type: '数值', source: '机构技术开展记录', nullRate: 0.0, drift: 2.4, importance: 0.029, note: '来自专科能力分析模块，反映本地诊疗能力。' },
    { code: 'F-RES-003', name: '至最近三级医院平均车程（分钟）', domain: 'RESOURCE', tier: 'COLD', type: '数值', source: 'GIS 路网计算', nullRate: 1.8, drift: 0.2, importance: 0.036, note: '交通可及性，山区区县偏高。' }
  ];
  const featureStore = {
    version: 'FS-2026.08',
    entities: '区县 × 癌种 × 年份',
    rows: 100 * 8 * 10,
    trainRows: 100 * 8 * 8,
    testRows: 100 * 8 * 2,
    builtAt: '2026-08-26 05:10',
    pipeline: 'Airflow DAG: fs_oncology_daily',
    lineage: '发病/死亡立方体 → 特征加工 → 缺失填补与标准化 → 特征库快照（不可变，按版本号引用）',
    leakageGuard: '标签年份 T 的特征只允许使用 ≤ T-1 年数据；同区县同癌种整体划入训练集或测试集，禁止跨集泄漏'
  };

  /* ============ 2. 预警模型元信息注册 ============ */
  const models = [
    {
      id: 'MDL-001', name: '区县癌症发病率异常上升预测', task: '二分类', target: '次年中标发病率较基线上升 ≥ 15%',
      version: 'v1.4.0', algo: 'XGBoost（单调约束 + SHAP 可解释）', status: 'PRODUCTION',
      owner: '省级登记中心 · 数据分析组', reviewer: '省疾控 · 流行病学专家组', createdAt: '2025-03-11', updatedAt: '2026-07-02',
      featureCount: 21, trainWindow: '2016-2023', testWindow: '2024-2025',
      metric: { auc: 0.812, pr: 0.436, brier: 0.081, ks: 0.492, recall: 0.694, precision: 0.381 },
      threshold: 0.62, refreshCycle: '每年 1 次全量重训，每季度校准',
      approval: '省级数据治理委员会 2025-06-18 批准影子运行，2025-09-01 转生产',
      limitation: '不用于个体风险判断；对筛查项目覆盖地区易高估，须结合 F-SCR-001 人工复核。',
      registered: true
    },
    {
      id: 'MDL-002', name: '区县癌症综合风险分级模型', task: '多分类（高/中/低）', target: '次年是否需要重点关注（复合标签）',
      version: 'v2.1.0', algo: 'LightGBM + 分层贝叶斯平滑（小基数收缩）', status: 'PRODUCTION',
      owner: '省级登记中心 · 数据分析组', reviewer: '省疾控 · 流行病学专家组', createdAt: '2025-08-02', updatedAt: '2026-08-12',
      featureCount: 25, trainWindow: '2016-2023', testWindow: '2024-2025',
      metric: { auc: 0.847, pr: 0.512, brier: 0.069, ks: 0.548, recall: 0.731, precision: 0.446 },
      threshold: 0.58, refreshCycle: '每年 1 次全量重训，每月校准漂移监测',
      approval: '省级数据治理委员会 2026-01-15 批准转生产',
      limitation: '小基数区县（年例数<20）已做贝叶斯收缩，但结果仍需与置信区间同时呈现；模型输出为"关注优先级"而非"疾病风险"。',
      registered: true
    },
    {
      id: 'MDL-003', name: '登记数据质量退化预测', task: '二分类', target: '次年 MV% 或 DCO% 突破考核线',
      version: 'v1.1.0', algo: '逻辑回归（L1）+ 规则后处理', status: 'SHADOW',
      owner: '省级登记中心 · 质控组', reviewer: '省级登记中心 · 主任', createdAt: '2026-02-20', updatedAt: '2026-08-20',
      featureCount: 14, trainWindow: '2018-2024', testWindow: '2025',
      metric: { auc: 0.786, pr: 0.401, brier: 0.094, ks: 0.441, recall: 0.658, precision: 0.352 },
      threshold: 0.55, refreshCycle: '每半年重训',
      approval: '影子运行中，暂不产生对外干预工单',
      limitation: '影子期内预测结果仅与 B 层规则预警结果对比，不单独派单。',
      registered: true
    },
    {
      id: 'MDL-004', name: '死亡补发病（DCN）回溯成功率预测', task: '二分类', target: 'DCN 任务 90 天内闭环成功',
      version: 'v0.3.0', algo: '随机森林', status: 'VALIDATING',
      owner: '省级登记中心 · 数据分析组', reviewer: '待指定', createdAt: '2026-06-05', updatedAt: '2026-08-18',
      featureCount: 11, trainWindow: '2019-2024', testWindow: '2025',
      metric: { auc: 0.723, pr: 0.338, brier: 0.112, ks: 0.372, recall: 0.601, precision: 0.298 },
      threshold: 0.5, refreshCycle: '未定',
      approval: '未提交审批',
      limitation: '验证中：PR-AUC 偏低，正类稀少，暂不具备生产条件。',
      registered: true
    },
    {
      id: 'MDL-005', name: '空间聚集风险探测（贝叶斯时空模型）', task: '空间平滑与后验概率', target: '区县-癌种相对风险 RR > 1.5 的后验概率',
      version: 'v0.2.0', algo: 'BYM2 条件自回归（INLA 近似）', status: 'TRAINING',
      owner: '省疾控 · 流行病学专家组', reviewer: '待指定', createdAt: '2026-07-28', updatedAt: '2026-08-25',
      featureCount: 9, trainWindow: '2016-2024', testWindow: '2025',
      metric: { auc: null, pr: null, brier: null, ks: null, recall: null, precision: null },
      threshold: null, refreshCycle: '未定',
      approval: '未提交审批',
      limitation: '训练中，尚无验证指标；与 C 层 SIR 规则互为补充而非替代。',
      registered: true
    },
    {
      id: 'MDL-000', name: '发病率月环比突变检测（弃用）', task: '异常检测', target: '月环比变化 > 50%',
      version: 'v1.0.0', algo: '孤立森林', status: 'RETIRED',
      owner: '省级登记中心 · 数据分析组', reviewer: '-', createdAt: '2024-11-02', updatedAt: '2026-01-20',
      featureCount: 5, trainWindow: '2022-2024', testWindow: '2025',
      metric: { auc: 0.588, pr: 0.121, brier: 0.187, ks: 0.196, recall: 0.812, precision: 0.094 },
      threshold: 0.5, refreshCycle: '-',
      approval: '2026-01-20 下线',
      limitation: '已下线：月度口径对慢病无流行病学意义，假阳性率 90.6%，警报疲劳严重。教训已固化为"疾病信号最小观察窗口为年度"。',
      registered: true
    }
  ];

  /* ============ 3. 模型训练与超参记录 ============ */
  const trainRuns = [
    {
      id: 'RUN-2026-0184', modelId: 'MDL-002', modelVersion: 'v2.1.0', status: 'SUCCESS',
      startedAt: '2026-08-12 01:12', durationMin: 47, trigger: '年度重训（计划）', operator: '省级登记中心 · 数据分析组 · 李工',
      featureVersion: 'FS-2026.08', seed: 20260812, cv: '5 折分组交叉验证（按区县分组，防泄漏）',
      hyper: { n_estimators: 800, learning_rate: 0.045, max_depth: 6, num_leaves: 31, min_child_samples: 40, subsample: 0.8, colsample_bytree: 0.75, reg_lambda: 2.5, scale_pos_weight: 3.2 },
      search: 'Optuna TPE，120 试验，目标 = 5 折平均 PR-AUC',
      metrics: { auc: 0.847, pr: 0.512, brier: 0.069, ks: 0.548, logloss: 0.241 },
      cvFolds: [0.839, 0.852, 0.841, 0.858, 0.845],
      artifact: 'oss://jx-oncology-models/MDL-002/v2.1.0/model.txt（SHA256 3f9a…c17b）',
      env: 'Python 3.11 / lightgbm 4.3.0 / 容器镜像 oncml:2026.07',
      note: '相比 v2.0.0 新增筛查覆盖与技术能力特征，PR-AUC 由 0.478 提升至 0.512。'
    },
    {
      id: 'RUN-2026-0181', modelId: 'MDL-002', modelVersion: 'v2.0.1', status: 'SUCCESS',
      startedAt: '2026-05-08 02:00', durationMin: 39, trigger: '季度校准', operator: '省级登记中心 · 数据分析组 · 李工',
      featureVersion: 'FS-2026.05', seed: 20260508, cv: '5 折分组交叉验证',
      hyper: { n_estimators: 700, learning_rate: 0.05, max_depth: 6, num_leaves: 31, min_child_samples: 35, subsample: 0.8, colsample_bytree: 0.8, reg_lambda: 2.0, scale_pos_weight: 3.0 },
      search: '固定超参，仅重新拟合并做 Platt 校准',
      metrics: { auc: 0.831, pr: 0.478, brier: 0.074, ks: 0.521, logloss: 0.256 },
      cvFolds: [0.826, 0.834, 0.822, 0.841, 0.832],
      artifact: 'oss://jx-oncology-models/MDL-002/v2.0.1/model.txt（SHA256 a71c…4e02）',
      env: 'Python 3.11 / lightgbm 4.3.0 / 容器镜像 oncml:2026.04',
      note: '校准后 Brier 由 0.079 降至 0.074。'
    },
    {
      id: 'RUN-2026-0179', modelId: 'MDL-003', modelVersion: 'v1.1.0', status: 'SUCCESS',
      startedAt: '2026-08-20 03:30', durationMin: 6, trigger: '半年重训', operator: '省级登记中心 · 质控组 · 王工',
      featureVersion: 'FS-2026.08', seed: 20260820, cv: '10 折分层交叉验证',
      hyper: { penalty: 'l1', C: 0.35, solver: 'liblinear', max_iter: 2000, class_weight: 'balanced' },
      search: '网格搜索 C ∈ {0.05,0.1,0.2,0.35,0.5,1.0}',
      metrics: { auc: 0.786, pr: 0.401, brier: 0.094, ks: 0.441, logloss: 0.312 },
      cvFolds: [0.771, 0.792, 0.781, 0.799, 0.788],
      artifact: 'oss://jx-oncology-models/MDL-003/v1.1.0/model.pkl（SHA256 5c28…9ab1）',
      env: 'Python 3.11 / scikit-learn 1.5.0 / 容器镜像 oncml:2026.07',
      note: 'L1 筛出 14 个非零特征，可解释性满足质控组人工复核要求。'
    },
    {
      id: 'RUN-2026-0176', modelId: 'MDL-004', modelVersion: 'v0.3.0', status: 'SUCCESS',
      startedAt: '2026-08-18 04:15', durationMin: 12, trigger: '手动（调参）', operator: '省级登记中心 · 数据分析组 · 张工',
      featureVersion: 'FS-2026.08', seed: 20260818, cv: '5 折交叉验证',
      hyper: { n_estimators: 500, max_depth: 12, min_samples_leaf: 8, max_features: 'sqrt', class_weight: 'balanced_subsample' },
      search: '随机搜索 60 试验',
      metrics: { auc: 0.723, pr: 0.338, brier: 0.112, ks: 0.372, logloss: 0.358 },
      cvFolds: [0.702, 0.731, 0.718, 0.740, 0.724],
      artifact: 'oss://jx-oncology-models/MDL-004/v0.3.0/model.pkl（SHA256 e903…22cf）',
      env: 'Python 3.11 / scikit-learn 1.5.0 / 容器镜像 oncml:2026.07',
      note: '正类占比仅 11.4%，PR-AUC 提升有限，考虑改用代价敏感学习。'
    },
    {
      id: 'RUN-2026-0173', modelId: 'MDL-005', modelVersion: 'v0.2.0', status: 'RUNNING',
      startedAt: '2026-08-25 22:40', durationMin: 0, trigger: '手动', operator: '省疾控 · 流行病学专家组 · 周工',
      featureVersion: 'FS-2026.08', seed: 20260825, cv: '留一年份验证（2025）',
      hyper: { model: 'BYM2', prior_u: 'PC(1, 0.01)', prior_phi: 'PC(0.5, 0.5)', n_samples: 4000, adjacency: '江西省 100 区县邻接矩阵' },
      search: '不适用（贝叶斯模型，先验敏感性分析中）',
      metrics: { auc: null, pr: null, brier: null, ks: null, logloss: null },
      cvFolds: [],
      artifact: '训练中',
      env: 'R 4.4 / INLA 24.06 / 容器镜像 oncml-r:2026.07',
      note: '正在做先验敏感性分析，预计 2026-09 完成。'
    },
    {
      id: 'RUN-2026-0170', modelId: 'MDL-002', modelVersion: 'v2.1.0-rc1', status: 'FAILED',
      startedAt: '2026-08-11 23:05', durationMin: 3, trigger: '年度重训（首次尝试）', operator: '省级登记中心 · 数据分析组 · 李工',
      featureVersion: 'FS-2026.08', seed: 20260811, cv: '5 折分组交叉验证',
      hyper: { n_estimators: 800, learning_rate: 0.045, max_depth: 6, num_leaves: 31, min_child_samples: 40, subsample: 0.8, colsample_bytree: 0.75, reg_lambda: 2.5, scale_pos_weight: 3.2 },
      search: 'Optuna TPE',
      metrics: { auc: null, pr: null, brier: null, ks: null, logloss: null },
      cvFolds: [],
      artifact: '无',
      env: 'Python 3.11 / lightgbm 4.3.0',
      note: '失败：F-SCR-001（筛查覆盖人数）在 2025 年份缺失率 41%，超过流水线设定的 20% 阈值，任务主动中止。补齐筛查台账后于 RUN-2026-0184 重跑成功。'
    },
    {
      id: 'RUN-2026-0158', modelId: 'MDL-001', modelVersion: 'v1.4.0', status: 'SUCCESS',
      startedAt: '2026-07-02 01:30', durationMin: 33, trigger: '年度重训（计划）', operator: '省级登记中心 · 数据分析组 · 李工',
      featureVersion: 'FS-2026.06', seed: 20260702, cv: '5 折分组交叉验证',
      hyper: { n_estimators: 600, learning_rate: 0.05, max_depth: 5, subsample: 0.85, colsample_bytree: 0.8, reg_lambda: 3.0, monotone_constraints: '对 65岁+占比、历史发病率设单调递增' },
      search: 'Optuna TPE，80 试验',
      metrics: { auc: 0.812, pr: 0.436, brier: 0.081, ks: 0.492, logloss: 0.268 },
      cvFolds: [0.804, 0.818, 0.807, 0.821, 0.810],
      artifact: 'oss://jx-oncology-models/MDL-001/v1.4.0/model.json（SHA256 8b14…7d33）',
      env: 'Python 3.11 / xgboost 2.1.0 / 容器镜像 oncml:2026.06',
      note: '施加单调约束后 AUC 略降 0.004，但专家组认可其可解释性，接受该权衡。'
    },
    {
      id: 'RUN-2026-0142', modelId: 'MDL-001', modelVersion: 'v1.3.2', status: 'ABORTED',
      startedAt: '2026-04-16 02:10', durationMin: 18, trigger: '季度校准', operator: '省级登记中心 · 数据分析组 · 张工',
      featureVersion: 'FS-2026.03', seed: 20260416, cv: '5 折分组交叉验证',
      hyper: { n_estimators: 600, learning_rate: 0.05, max_depth: 5 },
      search: '固定超参',
      metrics: { auc: null, pr: null, brier: null, ks: null, logloss: null },
      cvFolds: [],
      artifact: '无',
      env: 'Python 3.11 / xgboost 2.1.0',
      note: '人工中止：发现训练集包含标签年份当年的上报及时率特征，存在时间泄漏，修正特征加工逻辑后重跑。'
    }
  ];

  /* ============ 4. 风险预测结果快照 ============ */
  /* 区县画像：pop 常住人口（万）· risk 区域基线风险系数（1.00=全省均）· aged 65岁+占比
     · dco 本县 DCO% · smoke 成人吸烟率 · screen 筛查项目覆盖率（0 表示无在建筛查项目） */
  const COUNTIES = [
    { county: '南昌市青山湖区', city: '南昌市', pop: 96.4, risk: 1.02, aged: 0.142, dco: 0.042, smoke: 0.241, screen: 0.38 },
    { county: '南昌市新建区', city: '南昌市', pop: 74.8, risk: 0.96, aged: 0.151, dco: 0.058, smoke: 0.263, screen: 0.11 },
    { county: '赣州市信丰县', city: '赣州市', pop: 62.1, risk: 1.14, aged: 0.168, dco: 0.121, smoke: 0.312, screen: 0 },
    { county: '赣州市于都县', city: '赣州市', pop: 84.6, risk: 1.10, aged: 0.174, dco: 0.114, smoke: 0.305, screen: 0 },
    { county: '赣州市兴国县', city: '赣州市', pop: 66.3, risk: 1.04, aged: 0.161, dco: 0.096, smoke: 0.288, screen: 0 },
    { county: '九江市都昌县', city: '九江市', pop: 58.2, risk: 1.08, aged: 0.177, dco: 0.108, smoke: 0.297, screen: 0 },
    { county: '九江市修水县', city: '九江市', pop: 71.5, risk: 1.06, aged: 0.181, dco: 0.087, smoke: 0.342, screen: 0 },
    { county: '上饶市广丰区', city: '上饶市', pop: 68.9, risk: 0.98, aged: 0.156, dco: 0.071, smoke: 0.259, screen: 0.22 },
    { county: '上饶市鄱阳县', city: '上饶市', pop: 118.4, risk: 1.05, aged: 0.166, dco: 0.183, smoke: 0.281, screen: 0 },
    { county: '宜春市袁州区', city: '宜春市', pop: 105.7, risk: 1.01, aged: 0.159, dco: 0.064, smoke: 0.274, screen: 0.09 },
    { county: '吉安市吉州区', city: '吉安市', pop: 47.2, risk: 0.94, aged: 0.148, dco: 0.051, smoke: 0.246, screen: 0.16 },
    { county: '抚州市临川区', city: '抚州市', pop: 108.6, risk: 0.92, aged: 0.153, dco: 0.069, smoke: 0.252, screen: 0.07 },
    { county: '萍乡市安源区', city: '萍乡市', pop: 39.8, risk: 0.88, aged: 0.164, dco: 0.048, smoke: 0.238, screen: 0.41 },
    { county: '上饶市婺源县', city: '上饶市', pop: 33.6, risk: 0.95, aged: 0.192, dco: 0.078, smoke: 0.267, screen: 0 },
    { county: '宜春市铜鼓县', city: '宜春市', pop: 13.8, risk: 0.97, aged: 0.204, dco: 0.092, smoke: 0.283, screen: 0 }
  ];
  /* 全省中标发病率基线（/10万，2025 年口径，与「多维发病统计指标立方体」同源）；
     female=true 表示女性专属癌种，例数按女性人口折算 */
  const CANCER_BASE = {
    'C34 肺': { asr: 42.8, female: false }, 'C16 胃': { asr: 24.6, female: false },
    'C22 肝': { asr: 26.4, female: false }, 'C15 食管': { asr: 18.2, female: false },
    'C18-20 结直肠': { asr: 16.4, female: false }, 'C50 乳腺': { asr: 22.5, female: true },
    'C53 宫颈': { asr: 11.4, female: true }
  };
  const SNAP_CANCERS = ['C34 肺', 'C16 胃', 'C22 肝', 'C15 食管', 'C18-20 结直肠', 'C50 乳腺', 'C53 宫颈'];

  /* 癌种流行病学参数：
     provTrend 全省近3年 ASR 变化率（乳腺/结直肠上升、肺/胃/食管下降，与年报趋势一致）
     wSmoke 吸烟率对该癌种 ASR 的弹性；wAged 老龄化弹性；wScreen 筛查覆盖对检出率的弹性 */
  const CANCER_EPI = {
    'C34 肺': { provTrend: -0.018, wSmoke: 2.60, wAged: 1.90, wScreen: 0.45 },
    'C16 胃': { provTrend: -0.042, wSmoke: 0.70, wAged: 2.20, wScreen: 0.60 },
    'C22 肝': { provTrend: -0.031, wSmoke: 0.40, wAged: 1.10, wScreen: 0.30 },
    'C15 食管': { provTrend: -0.055, wSmoke: 1.80, wAged: 2.40, wScreen: 0.50 },
    'C18-20 结直肠': { provTrend: 0.036, wSmoke: 0.50, wAged: 2.60, wScreen: 0.85 },
    'C50 乳腺': { provTrend: 0.048, wSmoke: 0.20, wAged: 0.60, wScreen: 1.10 },
    'C53 宫颈': { provTrend: 0.021, wSmoke: 0.30, wAged: 0.40, wScreen: 1.20 }
  };

  /* 区域性流行特征：ASR 相对全省的倍数（流行病学事实，非随机数） */
  const ASR_MOD = {
    '赣州市信丰县|C15 食管': 1.86, '赣州市于都县|C15 食管': 1.74, '赣州市兴国县|C15 食管': 1.52,
    '九江市都昌县|C22 肝': 1.68, '上饶市鄱阳县|C22 肝': 1.57, '上饶市婺源县|C22 肝': 1.41,
    '九江市修水县|C34 肺': 1.44, '萍乡市安源区|C34 肺': 1.22,
    '上饶市鄱阳县|C16 胃': 1.38, '宜春市铜鼓县|C16 胃': 1.26,
    '南昌市青山湖区|C18-20 结直肠': 1.31, '南昌市青山湖区|C50 乳腺': 1.24
  };
  /* 近 3 年 ASR 变化率（正=上升）。与 C 层 C-ASR-TREND 规则使用同一序列 */
  const TREND_3Y = {
    '赣州市信丰县|C15 食管': 0.224, '赣州市于都县|C15 食管': 0.196, '赣州市兴国县|C15 食管': 0.118,
    '九江市都昌县|C22 肝': 0.207, '上饶市鄱阳县|C22 肝': 0.142, '上饶市婺源县|C22 肝': 0.061,
    '九江市修水县|C34 肺': 0.198, '萍乡市安源区|C34 肺': -0.164,
    '上饶市鄱阳县|C16 胃': 0.171, '宜春市铜鼓县|C16 胃': 0.089,
    '南昌市青山湖区|C50 乳腺': 0.238, '萍乡市安源区|C50 乳腺': 0.152,
    '宜春市袁州区|C34 肺': 0.126, '南昌市青山湖区|C18-20 结直肠': 0.094
  };
  /* C 层空间聚集 SIR（>=1.50 触发 C-CLUSTER） */
  const CLUSTER_SIR = {
    '赣州市信丰县|C15 食管': 1.58, '赣州市于都县|C15 食管': 1.46,
    '九江市都昌县|C22 肝': 1.62, '上饶市鄱阳县|C22 肝': 1.34, '九江市修水县|C34 肺': 1.29
  };
  /* 分母待核标记（人口基数变动 > 5%，C-DENOMINATOR 已阻断信号研判） */
  const DENOM_FLAG = { '九江市都昌县': true };

  const predictions = [];
  (function buildPredictions() {
    /* 模型为逻辑回归 + 单调约束 GBDT 融合，输出概率。此处按同一线性预测式复现，
       使每条 SHAP 贡献之和恰好等于 logit(p) − 基线 logit，保证解释可加性成立。 */
    const BASE_LOGIT = -1.28;
    COUNTIES.forEach(function (c) {
      SNAP_CANCERS.forEach(function (k) {
        const key = c.county + '|' + k;
        const cb = CANCER_BASE[k];
        const epi = CANCER_EPI[k];
        /* 无显式热点时，ASR 倍数由本县吸烟率与老龄化水平相对全省的偏离推导，
           而非随机数：mod = 1 + Σ(暴露偏离 × 该癌种弹性) */
        const mod = ASR_MOD[key] || Number((1
          + (c.smoke - 0.268) * epi.wSmoke
          + (c.aged - 0.162) * epi.wAged
          + (c.screen - 0.16) * epi.wScreen * 0.30).toFixed(3));
        /* 趋势 = 全省该癌种趋势 + 本县筛查扩面带来的检出上升 + 老龄化推动 */
        const trend = TREND_3Y[key] !== undefined ? TREND_3Y[key] : Number((epi.provTrend
          + c.screen * epi.wScreen * 0.085
          + (c.aged - 0.162) * epi.wAged * 0.22).toFixed(3));
        const sir = CLUSTER_SIR[key] || 1;
        const asr = cb.asr * c.risk * mod;
        /* 例数 = 中标率 × 人口 × 老龄化修正（女性癌种按女性人口折算） */
        const cases = Math.max(3, Math.round(asr * c.pop * 0.1 * (c.aged / 0.16) * (cb.female ? 0.49 : 1)));
        const relAsr = asr / cb.asr - 1;
        /* 各特征在对数几率尺度上的贡献 */
        const terms = [
          { f: 'F-INC-005 发病率3年变化率', v: trend * 6.4 },
          { f: 'F-INC-001 近5年中标发病率', v: relAsr * 1.95 },
          { f: 'F-DEMO-002 65岁及以上人口占比', v: (c.aged - 0.162) * 8.6 },
          { f: 'F-QUAL-002 DCO%', v: (c.dco - 0.08) * 3.9 },
          { f: 'F-SCR-001 筛查项目覆盖率', v: c.screen * 2.6 },
          { f: 'F-INC-004 空间聚集 SIR', v: (sir - 1) * 1.35 }
        ];
        if (k === 'C34 肺' || k === 'C15 食管') terms.push({ f: 'F-ENV-003 成人吸烟率', v: (c.smoke - 0.268) * 5.2 });
        let sum = terms.reduce(function (a, t) { return a + t.v; }, 0);
        /* 小基数分层贝叶斯收缩：例数越少，越向全省基线回归 */
        const shrink = cases >= 40 ? 1 : 0.52 + cases / 40 * 0.48;
        if (shrink < 1) terms.forEach(function (t) { t.v = t.v * shrink; });
        sum = sum * shrink;
        const logit = BASE_LOGIT + sum;
        const p = Number((1 / (1 + Math.exp(-logit))).toFixed(3));
        const level = p >= 0.58 ? 'HIGH' : p >= 0.36 ? 'MID' : 'LOW';
        /* 置信区间宽度随例数收窄 */
        const half = Math.min(0.24, 0.055 + 42 / (cases + 26) * 0.16);
        const hits = [];
        if (trend >= 0.15) hits.push('C-ASR-TREND 已触发');
        if (sir >= 1.5) hits.push('C-CLUSTER 已触发');
        if (c.dco > 0.15) hits.push('B-DCO-HIGH 已触发');
        if (DENOM_FLAG[c.county]) hits.push('C-DENOMINATOR 分母待核');
        predictions.push({
          id: '', 
          modelId: 'MDL-002', modelVersion: 'v2.1.0', runId: 'RUN-2026-0184',
          snapshotAt: '2026-08-13 06:00', targetYear: '2026', featureVersion: 'FS-2026.08',
          county: c.county, city: c.city, cancer: k,
          prob: p, level,
          ci: [Number(Math.max(0.01, p - half).toFixed(3)), Number(Math.min(0.99, p + half).toFixed(3))],
          baselineAsr: Number(asr.toFixed(1)),
          provinceAsr: cb.asr,
          cases2025: cases,
          trend3y: trend,
          clusterSir: sir,
          baseLogit: BASE_LOGIT,
          logit: Number(logit.toFixed(3)),
          shrink: Number(shrink.toFixed(2)),
          contribAll: terms.map(function (t) { return { f: t.f, v: Number(t.v.toFixed(3)) }; })
            .sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); }),
          contrib: terms.slice().sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); })
            .slice(0, 3).map(function (t) { return { f: t.f, v: Number(t.v.toFixed(3)) }; }),
          smallCount: cases < 40,
          ruleHit: hits.length ? hits.join(' · ') : '无规则命中',
          interventionId: null
        });
      });
    });
    predictions.sort(function (a, b) { return b.prob - a.prob || a.county.localeCompare(b.county); });
    predictions.forEach(function (p, i) { p.id = 'PRD-2026-' + String(i + 1).padStart(4, '0'); });
  })();

  /* ============ 5. 模型验证与评估报告 ============ */
  const evaluations = {
    'MDL-002': {
      modelId: 'MDL-002', modelVersion: 'v2.1.0', reportId: 'EVR-2026-008', evaluatedAt: '2026-08-14',
      evaluator: '省疾控 · 流行病学专家组', period: '2024-2025 年留出测试集 + 2026 上半年前瞻验证',
      sampleN: 1600, positiveN: 218,
      metrics: { auc: 0.847, pr: 0.512, brier: 0.069, ks: 0.548, recall: 0.731, precision: 0.446, f1: 0.552, specificity: 0.827 },
      roc: [[0, 0], [0.04, 0.21], [0.09, 0.38], [0.15, 0.52], [0.22, 0.63], [0.31, 0.73], [0.42, 0.81], [0.55, 0.88], [0.71, 0.94], [0.86, 0.98], [1, 1]],
      calibration: [[0.05, 0.04], [0.15, 0.13], [0.25, 0.24], [0.35, 0.33], [0.45, 0.47], [0.55, 0.53], [0.65, 0.68], [0.75, 0.72], [0.85, 0.88], [0.95, 0.91]],
      confusion: { tp: 159, fp: 197, fn: 59, tn: 1185 },
      byGroup: [
        { group: '大基数区县（年例数≥40）', n: 984, auc: 0.871, recall: 0.768, precision: 0.482, note: '表现稳定，可直接使用。' },
        { group: '小基数区县（年例数<40）', n: 616, auc: 0.792, recall: 0.664, precision: 0.371, note: '贝叶斯收缩后仍偏弱，输出须附置信区间并强制人工复核。' },
        { group: '筛查项目覆盖区县', n: 208, auc: 0.741, recall: 0.812, precision: 0.294, note: '假阳性显著偏高：筛查导致的检出率上升被误判为风险。' },
        { group: '高 DCO% 区县（>15%）', n: 176, auc: 0.716, recall: 0.588, precision: 0.318, note: '数据质量差导致特征噪声大，建议先做质量整改。' }
      ],
      drift: { psi: 0.089, driftFeatures: ['F-SCR-001 筛查覆盖人数 (PSI 0.21)', 'F-OPS-001 上报及时率 (PSI 0.14)'], verdict: '整体 PSI 0.089 < 0.1，未触发重训；但筛查覆盖特征漂移明显，需在下次重训前核对台账口径。' },
      vsRule: { ruleOnly: 34, modelOnly: 41, both: 19, agreement: 0.62, note: '模型与 C 层规则重叠 19 项；模型独有 41 项中经专家研判 14 项有价值、27 项为噪声，规则独有 34 项模型未识别的多为空间聚集型信号。' },
      conclusion: '整体判别能力良好（AUC 0.847），校准可接受（Brier 0.069）。批准继续生产使用，但须遵守三条边界：① 输出为"关注优先级"而非疾病风险，不得对外发布；② 小基数与筛查覆盖区县必须人工复核；③ 高 DCO% 区县先质量整改再纳入模型监测。',
      nextReview: '2027-02-14'
    },
    'MDL-001': {
      modelId: 'MDL-001', modelVersion: 'v1.4.0', reportId: 'EVR-2026-006', evaluatedAt: '2026-07-08',
      evaluator: '省疾控 · 流行病学专家组', period: '2024-2025 年留出测试集',
      sampleN: 1600, positiveN: 191,
      metrics: { auc: 0.812, pr: 0.436, brier: 0.081, ks: 0.492, recall: 0.694, precision: 0.381, f1: 0.492, specificity: 0.804 },
      roc: [[0, 0], [0.05, 0.18], [0.11, 0.34], [0.18, 0.47], [0.26, 0.58], [0.36, 0.68], [0.48, 0.77], [0.61, 0.85], [0.76, 0.92], [0.89, 0.97], [1, 1]],
      calibration: [[0.05, 0.06], [0.15, 0.17], [0.25, 0.22], [0.35, 0.38], [0.45, 0.42], [0.55, 0.58], [0.65, 0.61], [0.75, 0.78], [0.85, 0.81], [0.95, 0.93]],
      confusion: { tp: 133, fp: 216, fn: 58, tn: 1193 },
      byGroup: [
        { group: '大基数区县（年例数≥40）', n: 984, auc: 0.836, recall: 0.722, precision: 0.408, note: '可用。' },
        { group: '小基数区县（年例数<40）', n: 616, auc: 0.761, recall: 0.641, precision: 0.336, note: '偏弱，需人工复核。' },
        { group: '筛查项目覆盖区县', n: 208, auc: 0.703, recall: 0.784, precision: 0.261, note: '假阳性高，与 MDL-002 同因。' }
      ],
      drift: { psi: 0.112, driftFeatures: ['F-SCR-001 筛查覆盖人数 (PSI 0.26)', 'F-OPS-002 活跃上报机构数 (PSI 0.17)', 'F-QUAL-002 DCO% (PSI 0.11)'], verdict: '整体 PSI 0.112 > 0.1，已触发重训提示，计划于 2026-09 重训 v1.5.0。' },
      vsRule: { ruleOnly: 29, modelOnly: 38, both: 15, agreement: 0.55, note: '一致性低于 MDL-002，主要因单一上升标签比综合分级标签更容易被筛查干扰。' },
      conclusion: '判别能力可接受但已出现漂移（PSI 0.112），建议在 2026 年 9 月完成重训；重训前继续生产使用，但高风险输出须 100% 人工复核。',
      nextReview: '2026-09-30'
    },
    'MDL-003': {
      modelId: 'MDL-003', modelVersion: 'v1.1.0', reportId: 'EVR-2026-009', evaluatedAt: '2026-08-22',
      evaluator: '省级登记中心 · 质控组', period: '2025 年留出测试集（影子期）',
      sampleN: 800, positiveN: 96,
      metrics: { auc: 0.786, pr: 0.401, brier: 0.094, ks: 0.441, recall: 0.658, precision: 0.352, f1: 0.459, specificity: 0.789 },
      roc: [[0, 0], [0.06, 0.16], [0.13, 0.31], [0.21, 0.44], [0.3, 0.55], [0.41, 0.65], [0.53, 0.74], [0.66, 0.83], [0.79, 0.9], [0.91, 0.96], [1, 1]],
      calibration: [[0.05, 0.07], [0.15, 0.12], [0.25, 0.28], [0.35, 0.31], [0.45, 0.49], [0.55, 0.51], [0.65, 0.71], [0.75, 0.69], [0.85, 0.86], [0.95, 0.9]],
      confusion: { tp: 63, fp: 116, fn: 33, tn: 588 },
      byGroup: [
        { group: '区县登记处', n: 640, auc: 0.798, recall: 0.679, precision: 0.364, note: '影子期表现符合预期。' },
        { group: '地市直属机构', n: 160, auc: 0.734, recall: 0.571, precision: 0.301, note: '样本少，指标不稳定。' }
      ],
      drift: { psi: 0.061, driftFeatures: [], verdict: 'PSI 0.061，无显著漂移。' },
      vsRule: { ruleOnly: 22, modelOnly: 11, both: 26, agreement: 0.79, note: '与 B 层质量规则高度一致（0.79），说明模型主要在复述规则已知的信息，增量价值有限。' },
      conclusion: '影子期结论：模型与 B 层规则一致性达 0.79，独立增量有限。建议不转生产，改为在 B 层规则命中前 3-6 个月给出"质量退化倾向"提示，作为规则的前置预告而非并行判定。',
      nextReview: '2027-02-22'
    }
  };

  /* ============ 6. 风险预警干预工单 ============ */
  const interventions = [
    {
      id: 'IVT-2026-0031', predictionId: null, modelId: 'MDL-002', modelVersion: 'v2.1.0',
      county: '赣州市信丰县', city: '赣州市', cancer: 'C15 食管', prob: 0.91, level: 'HIGH',
      createdAt: '2026-08-13 08:30', owner: '赣州市疾控中心', supervisor: '省疾控 · 慢病所',
      deadline: '2026-09-24', status: 'DOING',
      plan: '① 核对近3年上报机构与人口分母；② 抽取 30 例复核诊断依据与编码；③ 开展食管癌高危人群问卷与内镜筛查可行性评估；④ 与 C 层预警 WRN-00277 合并处置，避免重复入户。',
      progress: '已完成上报机构核对（无变化）与 30 例抽查（编码准确率 96.7%）；内镜筛查可行性评估进行中。',
      linkedWarning: 'WRN-00277（C-CLUSTER，SIR 1.58）',
      humanVerdict: null,
      effectMetric: '目标：2027 年该县食管癌早诊率由 21.4% 提升至 30% 以上'
    },
    {
      id: 'IVT-2026-0030', predictionId: null, modelId: 'MDL-002', modelVersion: 'v2.1.0',
      county: '九江市都昌县', city: '九江市', cancer: 'C22 肝', prob: 0.87, level: 'HIGH',
      createdAt: '2026-08-13 08:30', owner: '九江市疾控中心', supervisor: '省疾控 · 慢病所',
      deadline: '2026-09-24', status: 'DOING',
      plan: '① 核查人口分母（该县2025年人口基数变动 5.8%，已有 C-DENOMINATOR 预警）；② 分母修正后重算 SIR；③ 若修正后仍聚集，开展乙肝感染率与饮水情况调查。',
      progress: '统计局已确认 2025 年人口数据口径变更，正在重新核定分母。',
      linkedWarning: 'WRN-00278（C-CLUSTER，SIR 1.62）+ 分母待核标记',
      humanVerdict: null,
      effectMetric: '目标：分母修正后 2 周内出具重算结论'
    },
    {
      id: 'IVT-2026-0028', predictionId: null, modelId: 'MDL-002', modelVersion: 'v2.1.0',
      county: '南昌市青山湖区', city: '南昌市', cancer: 'C50 乳腺', prob: 0.74, level: 'HIGH',
      createdAt: '2026-08-13 08:30', owner: '南昌市疾控中心', supervisor: '省疾控 · 慢病所',
      deadline: '2026-09-24', status: 'DONE',
      plan: '① 核查是否受两癌筛查项目影响；② 核对筛查台账覆盖人数；③ 出具是否需要实质干预的结论。',
      progress: '已完成。该区 2024-2025 年为省级两癌筛查试点，筛查覆盖 4.2 万人，检出率上升属项目效应。',
      linkedWarning: 'WRN-00275（C-ASR-TREND，已结案为"筛查项目影响"）',
      humanVerdict: 'INVALID_SCREEN',
      effectMetric: '已判为筛查项目效应，无需实质干预；该样本已回流特征库作为负例强化训练'
    },
    {
      id: 'IVT-2026-0025', predictionId: null, modelId: 'MDL-002', modelVersion: 'v2.1.0',
      county: '上饶市鄱阳县', city: '上饶市', cancer: 'C16 胃', prob: 0.69, level: 'HIGH',
      createdAt: '2026-08-13 08:30', owner: '上饶市疾控中心', supervisor: '省疾控 · 慢病所',
      deadline: '2026-09-24', status: 'PENDING',
      plan: '① 核对该县 DCO%（当前 18.3%，超考核线）；② 判断是质量问题导致的率值失真还是真实升高；③ 质量问题优先转 B 层整改。',
      progress: '待接收。',
      linkedWarning: 'WRN-00269（B-DCO-HIGH，DCO% 18.3%）',
      humanVerdict: null,
      effectMetric: '目标：先将 DCO% 降至 15% 以下再评估疾病信号'
    },
    {
      id: 'IVT-2026-0022', predictionId: null, modelId: 'MDL-002', modelVersion: 'v2.1.0',
      county: '赣州市于都县', city: '赣州市', cancer: 'C15 食管', prob: 0.64, level: 'HIGH',
      createdAt: '2026-08-13 08:30', owner: '赣州市疾控中心', supervisor: '省疾控 · 慢病所',
      deadline: '2026-09-24', status: 'DOING',
      plan: '① 与信丰县 IVT-2026-0031 合并为赣南食管癌高发区专项；② 统一开展高危人群评估。',
      progress: '已并入赣南食管癌专项，与信丰县同步推进。',
      linkedWarning: 'WRN-00271（C-ASR-TREND，连续3年上升 22.4%）',
      humanVerdict: null,
      effectMetric: '目标：形成赣南食管癌防控方案初稿'
    },
    {
      id: 'IVT-2026-0019', predictionId: 'PRD-2026H-0044', archived: true, modelId: 'MDL-001', modelVersion: 'v1.4.0',
      county: '宜春市袁州区', city: '宜春市', cancer: 'C34 肺', prob: 0.61, level: 'HIGH',
      createdAt: '2026-07-10 09:00', owner: '宜春市疾控中心', supervisor: '省疾控 · 慢病所',
      deadline: '2026-08-21', status: 'INVALID',
      plan: '① 核查上报行为；② 核查人口分母；③ 评估是否真实升高。',
      progress: '已完成核查：该区 2025 年新增 2 家上报机构（袁州区中医院、明月山医院），发病率上升系上报覆盖扩大所致。',
      linkedWarning: 'WRN-00258（A-VOLUME-DROP 反向，上报机构数变化）',
      humanVerdict: 'INVALID_REPORTING',
      effectMetric: '已判为上报行为改变；模型未使用 F-OPS-002 活跃机构数的时序变化，该案例已作为反例纳入 v1.5.0 重训清单'
    },
    {
      id: 'IVT-2026-0014', predictionId: 'PRD-2026H-0051', archived: true, modelId: 'MDL-001', modelVersion: 'v1.4.0',
      county: '九江市修水县', city: '九江市', cancer: 'C34 肺', prob: 0.59, level: 'HIGH',
      createdAt: '2026-07-10 09:00', owner: '九江市疾控中心', supervisor: '省疾控 · 慢病所',
      deadline: '2026-08-21', status: 'DONE',
      plan: '① 核查上报与分母；② 开展吸烟率与职业暴露初步调查。',
      progress: '已完成。上报与分母无异常；该县成人吸烟率 34.2%（全省 26.8%），且有历史矿业活动，判为需持续观察的真实偏高。',
      linkedWarning: 'WRN-00249（C-ASR-TREND，连续3年上升 19.8%）',
      humanVerdict: 'VALID',
      effectMetric: '已纳入 2027 年控烟重点县名单，每半年跟踪 ASR 变化'
    }
  ];
  /* 按 区县 × 癌种 解析工单来源快照，并把概率同步为快照真值，避免两处硬编码不一致。
     archived=true 的历史工单来自 2026-07 的 MDL-001 快照批次，不在当前快照表中。 */
  interventions.forEach(function (iv) {
    if (iv.archived) return;
    const p = predictions.find(function (x) { return x.county === iv.county && x.cancer === iv.cancer; });
    if (!p) return;
    iv.predictionId = p.id;
    iv.prob = p.prob;
    iv.level = p.level;
    p.interventionId = iv.id;
  });

  /* ==================== 页面 1：多源特征数据仓库 ==================== */
  function renderFeatures() {
    const f = state.features, kw = f.keyword.trim().toLowerCase();
    const list = features.filter(function (x) {
      return (f.domain === 'ALL' || x.domain === f.domain)
        && (f.tier === 'ALL' || x.tier === f.tier)
        && (!kw || [x.code, x.name, x.source, FEATURE_DOMAIN[x.domain]].join(' ').toLowerCase().includes(kw));
    });
    const highNull = features.filter(function (x) { return x.nullRate > 5; });
    const highDrift = features.filter(function (x) { return x.drift > 5; });
    const external = features.filter(function (x) { return x.source.indexOf('外部') >= 0; });
    const kpis = [
      mdKpi('特征总数', features.length, featureStore.entities + ' 粒度'),
      mdKpi('样本行数', nInt(featureStore.rows), '训练 ' + nInt(featureStore.trainRows) + ' / 测试 ' + nInt(featureStore.testRows)),
      mdKpi('特征域', Object.keys(FEATURE_DOMAIN).length, '人口/发病/质量/运行/筛查/环境/资源'),
      mdKpi('高缺失特征', highNull.length, '缺失率 > 5%，需缺失指示变量', highNull.length ? 'warn' : 'ok'),
      mdKpi('高漂移特征', highDrift.length, 'PSI 折算漂移 > 5%', highDrift.length ? 'warn' : 'ok'),
      mdKpi('外部来源', external.length, '环保/统计等跨部门共享')
    ].join('');

    const rows = list.map(function (x) {
      return '<tr>' +
        '<td class="md-nowrap"><button class="md-id" onclick="showFeatureDetail(\'' + x.code + '\')">' + x.code + '</button></td>' +
        '<td>' + esc(x.name) + '<div class="md-sec">' + esc(x.type) + '</div></td>' +
        '<td class="md-nowrap">' + esc(FEATURE_DOMAIN[x.domain]) + '</td>' +
        '<td class="md-nowrap"><span class="md-chip ' + FEATURE_TIER[x.tier].cls + '">' + esc(FEATURE_TIER[x.tier].label) + '</span></td>' +
        '<td>' + esc(x.source) + '</td>' +
        '<td class="md-num md-nowrap">' + n1(x.nullRate) + '%' + bar(x.nullRate * 5, x.nullRate > 5 ? 'bad' : x.nullRate > 2 ? 'warn' : 'ok') + '</td>' +
        '<td class="md-num md-nowrap">' + n1(x.drift) + '%' + bar(x.drift * 8, x.drift > 5 ? 'bad' : x.drift > 3 ? 'warn' : 'ok') + '</td>' +
        '<td class="md-num md-nowrap">' + n3(x.importance) + bar(x.importance * 500, '') + '</td>' +
        '<td class="md-nowrap"><button class="btn btn-ghost btn-xs" onclick="showFeatureDetail(\'' + x.code + '\')">详情</button></td>' +
        '</tr>';
    }).join('');

    const dmOpts = [['ALL', '全部特征域']].concat(Object.keys(FEATURE_DOMAIN).map(function (k) { return [k, FEATURE_DOMAIN[k]]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.domain === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    const trOpts = [['ALL', '全部更新频率']].concat(Object.keys(FEATURE_TIER).map(function (k) { return [k, FEATURE_TIER[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.tier === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

    const domRows = Object.keys(FEATURE_DOMAIN).map(function (k) {
      const sub = features.filter(function (x) { return x.domain === k; });
      const imp = sub.reduce(function (a, x) { return a + x.importance; }, 0);
      return '<tr><td>' + esc(FEATURE_DOMAIN[k]) + '</td><td class="md-num">' + sub.length + '</td>' +
        '<td class="md-num">' + n3(imp) + '</td><td class="md-num">' + n1(imp * 100) + '%' + bar(imp * 100 * 2.6, imp > 0.3 ? '' : 'warn') + '</td></tr>';
    }).join('');

    return '<div class="md-page">' + mdHeader('多源特征数据仓库',
      '构建用于 AI 模型训练的<b>标准化特征数据池</b>。实体粒度为' + esc(featureStore.entities) + '，特征按更新频率分为日更/月更/年更三层；每个特征登记来源、类型、缺失率、漂移与重要性，并受防泄漏约束（标签年份 T 只允许使用 ≤ T-1 年数据）。特征库按版本快照不可变，任一训练任务都能凭版本号复现输入。', [
      '<button class="btn btn-outline btn-sm" onclick="showLineage()">血缘与防泄漏</button>',
      '<button class="btn btn-outline btn-sm" onclick="mdToastMsg(\'特征字典已导出\')">导出字典</button>',
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'mdl-registry\')">模型注册表</button>'
    ]) +
      '<div class="md-kpis">' + kpis + '</div>' +
      '<div class="md-filter">' +
      '<div class="form-group"><label>特征域</label><select onchange="mdSet(\'features\',\'domain\',this.value)">' + dmOpts + '</select></div>' +
      '<div class="form-group"><label>更新频率</label><select onchange="mdSet(\'features\',\'tier\',this.value)">' + trOpts + '</select></div>' +
      '<div class="form-group" style="grid-column:span 2"><label>检索</label><input value="' + esc(f.keyword) + '" placeholder="特征编码 / 名称 / 来源" onchange="mdSet(\'features\',\'keyword\',this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="mdResetFeatures()">重置</button></div></div>' +
      '<div class="md-table-wrap"><table class="md-table"><thead><tr><th>编码</th><th>特征名称</th><th>特征域</th><th>更新频率</th><th>数据来源</th><th>缺失率</th><th>年漂移</th><th>重要性</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9"><div class="md-empty">暂无符合条件的特征</div></td></tr>') + '</tbody></table></div>' +
      '<div class="md-grid2" style="margin-top:14px">' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">特征域重要性构成<span class="md-card-sub">MDL-002 v2.1.0 SHAP 均值</span></div></div>' +
      '<div class="md-card-body" style="overflow:auto"><table class="md-pivot" style="width:100%"><thead><tr><th>特征域</th><th>特征数</th><th>重要性合计</th><th>占比</th></tr></thead><tbody>' + domRows + '</tbody></table>' +
      '<div class="md-note" style="margin-top:9px">发病与死亡历史贡献最大（合理，历史率值是最强预测因子）；登记质量域贡献约 20%，说明模型在很大程度上"预测的是数据质量而非疾病风险"，这是评估报告中重点提示的边界。</div></div></div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">特征库版本信息</div></div><div class="md-card-body">' +
      '<div class="md-fields">' + [
        ['当前版本', featureStore.version], ['实体粒度', featureStore.entities],
        ['样本行数', nInt(featureStore.rows)], ['构建时间', featureStore.builtAt],
        ['加工流水线', featureStore.pipeline], ['训练/测试划分', nInt(featureStore.trainRows) + ' / ' + nInt(featureStore.testRows)]
      ].map(function (x) { return '<div class="md-field"><div class="md-field-label">' + esc(x[0]) + '</div><div class="md-value">' + esc(x[1]) + '</div></div>'; }).join('') + '</div>' +
      '<div class="md-callout warn" style="margin-top:11px"><strong>防泄漏约束：</strong>' + esc(featureStore.leakageGuard) + '</div>' +
      '</div></div></div></div>';
  }
  function mdResetFeatures() { state.features = { domain: 'ALL', tier: 'ALL', keyword: '' }; renderPage(state.page); }
  function mdToastMsg(m) { mdToast(m); }

  function showFeatureDetail(code) {
    const x = features.find(function (y) { return y.code === code; });
    if (!x) return;
    const usedBy = models.filter(function (m) { return m.status !== 'RETIRED'; }).slice(0, 3);
    const fields = [
      ['特征编码', x.code], ['特征名称', x.name], ['特征域', FEATURE_DOMAIN[x.domain]],
      ['数据类型', x.type], ['更新频率', FEATURE_TIER[x.tier].label], ['数据来源', x.source],
      ['缺失率', n1(x.nullRate) + '%'], ['年漂移', n1(x.drift) + '%'], ['SHAP 重要性', n3(x.importance)]
    ].map(function (y) { return '<div class="md-field"><div class="md-field-label">' + esc(y[0]) + '</div><div class="md-value">' + esc(y[1]) + '</div></div>'; }).join('');
    const body = '<div class="md-fields">' + fields + '</div>' +
      '<div class="md-sect"><h4 class="md-h">口径与使用说明</h4><div class="md-callout">' + esc(x.note) + '</div></div>' +
      (x.nullRate > 5 ? '<div class="md-sect"><div class="md-callout warn"><strong>高缺失处理：</strong>缺失率 ' + n1(x.nullRate) + '%，采用"缺失指示变量 + 域内中位数填补"，并在模型解释中单独标注，避免把缺失模式当成信号。</div></div>' : '') +
      (x.source.indexOf('外部') >= 0 ? '<div class="md-sect"><div class="md-callout warn"><strong>生态学谬误提示：</strong>该特征为区域层面聚合值，不能推断个体风险；仅用于区域优先级排序。</div></div>' : '') +
      '<div class="md-sect"><h4 class="md-h">被引用的模型</h4><div>' + usedBy.map(function (m) { return '<span class="md-chip cold">' + esc(m.id + ' ' + m.name) + '</span>'; }).join('') + '</div></div>';
    const mask = mdModal('特征详情 · ' + x.code, body, '<button class="btn btn-ghost" data-close>关闭</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  function showLineage() {
    const body = '<div class="md-sect"><h4 class="md-h">数据血缘</h4><div class="md-code">' + esc(
      '原始接入（HIS / LIS / 死因监测 / 公安注销 / 医保）\n' +
      '        │\n' +
      '        ├─→ 报告卡库 ──→ 多维发病指标立方体 ──┐\n' +
      '        └─→ 死亡库   ──→ 多维死亡指标立方体 ──┤\n' +
      '                                              ├─→ 特征加工（率值/趋势/比值/滞后项）\n' +
      '     登记质量指标（MV% / DCO% / UB% / M-I）───┤        │\n' +
      '     上报运行统计（及时率 / 机构数 / 失败率）─┤        ├─→ 缺失填补 + 标准化\n' +
      '     筛查与随访台账 ──────────────────────────┤        │\n' +
      '     外部共享（统计年鉴 / 环保 / 卫生资源）───┘        └─→ 特征库版本快照 FS-2026.08（不可变）\n' +
      '                                                                    │\n' +
      '                                                    ┌───────────────┴───────────────┐\n' +
      '                                              训练任务（凭版本号复现）        预测任务（在线取同版本）'
    ) + '</div></div>' +
      '<div class="md-sect"><h4 class="md-h">防泄漏约束</h4><div class="md-callout warn">' + esc(featureStore.leakageGuard) + '</div></div>' +
      '<div class="md-sect"><h4 class="md-h">历史教训</h4><div class="md-callout warn">RUN-2026-0142 曾因训练集包含标签当年的上报及时率而人工中止；RUN-2026-0170 因筛查覆盖特征缺失率 41% 超阈值自动失败。两条约束现已固化为流水线的强制校验。</div></div>';
    const mask = mdModal('特征血缘与防泄漏约束', body, '<button class="btn btn-ghost" data-close>关闭</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  /* ==================== 页面 2：预警模型元信息注册 ==================== */
  function renderRegistry() {
    const f = state.registry, kw = f.keyword.trim().toLowerCase();
    const list = models.filter(function (m) {
      return (f.status === 'ALL' || m.status === f.status)
        && (f.task === 'ALL' || m.task === f.task)
        && (!kw || [m.id, m.name, m.algo, m.owner].join(' ').toLowerCase().includes(kw));
    });
    const prod = models.filter(function (m) { return m.status === 'PRODUCTION'; });
    const kpis = [
      mdKpi('注册模型', models.length, '含已下线'),
      mdKpi('生产使用', prod.length, '已通过专家组评审', 'ok'),
      mdKpi('影子 / 验证中', models.filter(function (m) { return m.status === 'SHADOW' || m.status === 'VALIDATING'; }).length, '不产生对外工单', 'warn'),
      mdKpi('训练中', models.filter(function (m) { return m.status === 'TRAINING'; }).length, '尚无验证指标'),
      mdKpi('已下线', models.filter(function (m) { return m.status === 'RETIRED'; }).length, '教训已固化为规则约束'),
      mdKpi('最优 AUC', n3(Math.max.apply(null, models.filter(function (m) { return m.metric.auc; }).map(function (m) { return m.metric.auc; }))), 'MDL-002 v2.1.0', 'ok')
    ].join('');

    const rows = list.map(function (m) {
      return '<tr>' +
        '<td class="md-nowrap"><button class="md-id" onclick="showModelDetail(\'' + m.id + '\')">' + m.id + '</button><div class="md-sec">' + esc(m.version) + '</div></td>' +
        '<td>' + esc(m.name) + '<div class="md-sec">' + esc(m.target) + '</div></td>' +
        '<td class="md-nowrap">' + esc(m.task) + '</td>' +
        '<td>' + esc(m.algo) + '</td>' +
        '<td class="md-num md-nowrap">' + (m.metric.auc ? n3(m.metric.auc) : '-') + '<div class="md-sec">' + (m.metric.pr ? 'PR ' + n3(m.metric.pr) : '未验证') + '</div></td>' +
        '<td class="md-num md-nowrap">' + m.featureCount + '</td>' +
        '<td class="md-nowrap">' + badge(LIFECYCLE[m.status]) + '<div class="md-sec">' + esc(m.updatedAt) + '</div></td>' +
        '<td>' + esc(m.owner) + '<div class="md-sec">评审 ' + esc(m.reviewer) + '</div></td>' +
        '<td class="md-nowrap"><button class="btn btn-ghost btn-xs" onclick="showModelDetail(\'' + m.id + '\')">详情</button>' +
        (m.metric.auc ? ' <button class="btn btn-outline btn-xs" onclick="mdGoEval(\'' + m.id + '\')">评估</button>' : '') + '</td>' +
        '</tr>';
    }).join('');

    const stOpts = [['ALL', '全部状态']].concat(Object.keys(LIFECYCLE).map(function (k) { return [k, LIFECYCLE[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.status === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    const tkOpts = [['ALL', '全部任务类型']].concat(models.map(function (m) { return m.task; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (t) { return [t, t]; }))
      .map(function (o) { return '<option value="' + esc(o[0]) + '"' + (f.task === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

    return '<div class="md-page">' + mdHeader('预警模型元信息注册',
      '管理风险预测模型的<b>基本信息与生命周期状态</b>：设计中 → 训练中 → 验证中 → 影子运行 → 生产使用 → 下线。每个模型登记预测目标、算法、特征数、训练/测试窗口、判定阈值、责任人与评审人、审批依据以及<b>明确的使用边界</b>；只有经省级专家组评审通过的模型才能转生产并产生干预工单。', [
      '<button class="btn btn-outline btn-sm" onclick="mdToastMsg(\'模型清单已导出\')">导出清单</button>',
      '<button class="btn btn-outline btn-sm" onclick="navigateTo(\'mdl-training\')">训练记录</button>',
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'mdl-predictions\')">预测结果快照</button>'
    ]) +
      '<div class="md-kpis">' + kpis + '</div>' +
      '<div class="md-filter">' +
      '<div class="form-group"><label>生命周期状态</label><select onchange="mdSet(\'registry\',\'status\',this.value)">' + stOpts + '</select></div>' +
      '<div class="form-group"><label>任务类型</label><select onchange="mdSet(\'registry\',\'task\',this.value)">' + tkOpts + '</select></div>' +
      '<div class="form-group" style="grid-column:span 2"><label>检索</label><input value="' + esc(f.keyword) + '" placeholder="模型编号 / 名称 / 算法" onchange="mdSet(\'registry\',\'keyword\',this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="mdResetRegistry()">重置</button></div></div>' +
      '<div class="md-table-wrap"><table class="md-table" style="min-width:1220px"><thead><tr><th>模型编号</th><th>模型名称 / 预测目标</th><th>任务</th><th>算法</th><th>AUC</th><th>特征数</th><th>状态</th><th>责任人</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9"><div class="md-empty">暂无符合条件的模型</div></td></tr>') + '</tbody></table></div>' +
      '<div class="md-callout warn" style="margin-top:14px"><strong>与规则预警的关系：</strong>「预警监测与处置」的 A/B/C 三层规则是<b>确定性阈值判定</b>，可解释、可追责、可直接派核查工单；本模块的模型是<b>概率化优先级排序</b>，用于在规则未命中前提示关注方向。两者并行运行、互不覆盖：模型不得单独作为预警结论，规则命中也不因模型低分而撤销。已下线的 MDL-000（月环比突变检测）就是把二者混用的失败案例——假阳性率 90.6%，警报疲劳严重。</div>' +
      '</div>';
  }
  function mdResetRegistry() { state.registry = { status: 'ALL', task: 'ALL', keyword: '' }; renderPage(state.page); }
  function mdGoEval(id) { state.evaluation.model = evaluations[id] ? id : 'MDL-002'; closeMdModals(); if (typeof navigateTo === 'function') navigateTo('mdl-evaluation'); }

  function showModelDetail(id) {
    const m = models.find(function (x) { return x.id === id; });
    if (!m) return;
    const step = LIFECYCLE[m.status].step;
    const stages = LIFECYCLE_STEPS.map(function (s, i) {
      const cls = m.status === 'RETIRED' ? (i === 5 ? 'cur' : 'done') : i < step ? 'done' : i === step ? 'cur' : '';
      return '<div class="md-stage-item ' + cls + '">' + (i < step || (m.status === 'RETIRED' && i < 5) ? '✓ ' : '') + esc(s) + '</div>';
    }).join('');
    const fields = [
      ['模型编号', m.id], ['模型名称', m.name], ['版本', m.version], ['任务类型', m.task],
      ['算法', m.algo], ['预测目标', m.target], ['特征数', String(m.featureCount)],
      ['训练窗口', m.trainWindow], ['测试窗口', m.testWindow],
      ['判定阈值', m.threshold === null ? '未设定' : String(m.threshold)],
      ['刷新周期', m.refreshCycle], ['责任人', m.owner], ['评审人', m.reviewer],
      ['创建日期', m.createdAt], ['最近更新', m.updatedAt], ['生命周期', LIFECYCLE[m.status].label]
    ].map(function (x) { return '<div class="md-field"><div class="md-field-label">' + esc(x[0]) + '</div><div class="md-value">' + esc(x[1]) + '</div></div>'; }).join('');
    const metricRows = m.metric.auc ? '<table class="md-pivot" style="width:100%"><thead><tr><th>指标</th><th>AUC</th><th>PR-AUC</th><th>Brier</th><th>KS</th><th>召回</th><th>精确</th></tr></thead><tbody><tr><td>' + esc(m.version) + '</td>' +
      [m.metric.auc, m.metric.pr, m.metric.brier, m.metric.ks, m.metric.recall, m.metric.precision].map(function (v) { return '<td>' + n3(v) + '</td>'; }).join('') + '</tr></tbody></table>'
      : '<div class="md-callout">尚无验证指标（模型处于' + esc(LIFECYCLE[m.status].label) + '）。</div>';
    const runs = trainRuns.filter(function (r) { return r.modelId === m.id; });
    const runRows = runs.length ? runs.map(function (r) {
      return '<tr><td style="text-align:left">' + esc(r.id) + '</td><td>' + esc(r.modelVersion) + '</td><td>' + esc(r.startedAt) + '</td><td>' + esc(RUN_STATUS[r.status].label) + '</td><td>' + (r.metrics.auc ? n3(r.metrics.auc) : '-') + '</td></tr>';
    }).join('') : '<tr><td colspan="5"><div class="md-empty">无训练记录</div></td></tr>';
    const body = '<div class="md-stage">' + stages + '</div>' +
      '<div class="md-fields">' + fields + '</div>' +
      '<div class="md-sect"><h4 class="md-h">验证指标</h4>' + metricRows + '</div>' +
      '<div class="md-sect"><h4 class="md-h">审批依据</h4><div class="md-callout">' + esc(m.approval) + '</div></div>' +
      '<div class="md-sect"><h4 class="md-h">使用边界与限制</h4><div class="md-callout warn">' + esc(m.limitation) + '</div></div>' +
      '<div class="md-sect"><h4 class="md-h">训练记录</h4><table class="md-pivot" style="width:100%"><thead><tr><th>任务号</th><th>版本</th><th>开始时间</th><th>状态</th><th>AUC</th></tr></thead><tbody>' + runRows + '</tbody></table></div>';
    let foot = '<button class="btn btn-ghost" data-close>关闭</button>';
    if (evaluations[m.id]) foot += '<button class="btn btn-primary" onclick="mdGoEval(\'' + m.id + '\')">查看评估报告</button>';
    const mask = mdModal('模型元信息 · ' + m.id, body, foot);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  /* ==================== 页面 3：模型训练与超参记录 ==================== */
  function renderTraining() {
    const f = state.training, kw = f.keyword.trim().toLowerCase();
    const list = trainRuns.filter(function (r) {
      return (f.model === 'ALL' || r.modelId === f.model)
        && (f.status === 'ALL' || r.status === f.status)
        && (!kw || [r.id, r.modelId, r.modelVersion, r.operator, r.trigger].join(' ').toLowerCase().includes(kw));
    });
    const succ = trainRuns.filter(function (r) { return r.status === 'SUCCESS'; });
    const failed = trainRuns.filter(function (r) { return r.status === 'FAILED' || r.status === 'ABORTED'; });
    const kpis = [
      mdKpi('训练任务', trainRuns.length, '近 12 个月'),
      mdKpi('成功', succ.length, n1(succ.length / trainRuns.length * 100) + '% 成功率', 'ok'),
      mdKpi('失败 / 中止', failed.length, '均因数据问题，非算法问题', failed.length ? 'warn' : 'ok'),
      mdKpi('平均耗时', n1(succ.reduce(function (a, r) { return a + r.durationMin; }, 0) / succ.length) + ' 分钟', '单次全量重训'),
      mdKpi('可复现率', '100%', '随机种子+特征版本+镜像全记录', 'ok')
    ].join('');

    const rows = list.map(function (r) {
      const hyperKeys = Object.keys(r.hyper).slice(0, 3).map(function (k) { return k + '=' + r.hyper[k]; }).join(' · ');
      return '<tr>' +
        '<td class="md-nowrap"><button class="md-id" onclick="showRunDetail(\'' + r.id + '\')">' + r.id + '</button><div class="md-sec">种子 ' + r.seed + '</div></td>' +
        '<td class="md-nowrap">' + esc(r.modelId) + '<div class="md-sec">' + esc(r.modelVersion) + '</div></td>' +
        '<td class="md-nowrap">' + esc(r.trigger) + '<div class="md-sec">' + esc(r.operator.split('·').pop().trim()) + '</div></td>' +
        '<td class="md-nowrap">' + esc(r.startedAt) + '<div class="md-sec">' + (r.durationMin ? r.durationMin + ' 分钟' : '进行中') + '</div></td>' +
        '<td class="md-nowrap">' + esc(r.featureVersion) + '</td>' +
        '<td style="white-space:normal;min-width:210px"><span class="md-sec" style="margin:0">' + esc(hyperKeys) + (Object.keys(r.hyper).length > 3 ? ' …' : '') + '</span></td>' +
        '<td class="md-num md-nowrap">' + (r.metrics.auc ? n3(r.metrics.auc) : '-') + '<div class="md-sec">' + (r.metrics.pr ? 'PR ' + n3(r.metrics.pr) : '-') + '</div></td>' +
        '<td class="md-nowrap">' + badge(RUN_STATUS[r.status]) + '</td>' +
        '<td class="md-nowrap"><button class="btn btn-ghost btn-xs" onclick="showRunDetail(\'' + r.id + '\')">详情</button></td>' +
        '</tr>';
    }).join('');

    const mdOpts = [['ALL', '全部模型']].concat(models.map(function (m) { return [m.id, m.id + ' ' + m.name]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.model === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    const stOpts = [['ALL', '全部状态']].concat(Object.keys(RUN_STATUS).map(function (k) { return [k, RUN_STATUS[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.status === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

    /* MDL-002 版本演进曲线 */
    const hist = trainRuns.filter(function (r) { return r.modelId === 'MDL-002' && r.metrics.auc; }).slice().reverse();
    const chart = hist.length > 1 ? lineChart(hist.map(function (r) { return r.modelVersion; }), [
      { name: 'AUC', values: hist.map(function (r) { return r.metrics.auc; }), color: '#1d4ed8' },
      { name: 'PR-AUC', values: hist.map(function (r) { return r.metrics.pr; }), color: '#b54708' }
    ], { yZero: false, dp: 3, aria: 'MDL-002 版本指标演进', height: 190 }) : '<div class="md-empty">数据不足</div>';

    return '<div class="md-page">' + mdHeader('模型训练与超参记录',
      '详细记录模型训练过程，确保<b>实验可复现与性能可追溯</b>：每次训练固化随机种子、特征库版本、交叉验证方案、完整超参、搜索策略、产物哈希与运行环境镜像。失败与中止任务同样入库并记录原因，作为流水线校验规则的来源。', [
      '<button class="btn btn-outline btn-sm" onclick="mdToastMsg(\'训练记录已导出\')">导出记录</button>',
      '<button class="btn btn-outline btn-sm" onclick="showReproRule()">复现规范</button>',
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'mdl-evaluation\')">评估报告</button>'
    ]) +
      '<div class="md-kpis">' + kpis + '</div>' +
      '<div class="md-filter">' +
      '<div class="form-group" style="grid-column:span 2"><label>模型</label><select onchange="mdSet(\'training\',\'model\',this.value)">' + mdOpts + '</select></div>' +
      '<div class="form-group"><label>任务状态</label><select onchange="mdSet(\'training\',\'status\',this.value)">' + stOpts + '</select></div>' +
      '<div class="form-group" style="grid-column:span 2"><label>检索</label><input value="' + esc(f.keyword) + '" placeholder="任务号 / 版本 / 操作人 / 触发方式" onchange="mdSet(\'training\',\'keyword\',this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="mdResetTraining()">重置</button></div></div>' +
      '<div class="md-table-wrap"><table class="md-table" style="min-width:1240px"><thead><tr><th>任务号</th><th>模型 / 版本</th><th>触发 / 操作人</th><th>开始时间</th><th>特征版本</th><th>关键超参</th><th>指标</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9"><div class="md-empty">暂无符合条件的训练任务</div></td></tr>') + '</tbody></table></div>' +
      '<div class="md-grid2" style="margin-top:14px">' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">MDL-002 版本指标演进</div></div><div class="md-card-body">' + chart +
      '<div class="md-note" style="margin-top:8px">v2.1.0 相比 v2.0.1 新增筛查覆盖与技术能力特征，PR-AUC 由 0.478 提升至 0.512。AUC 提升幅度小于 PR-AUC，说明改进主要体现在正类稀疏场景下的排序质量。</div></div></div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">失败与中止原因归档</div></div><div class="md-card-body">' +
      failed.map(function (r) {
        return '<div class="md-callout warn" style="margin-bottom:9px"><strong>' + esc(r.id) + '（' + esc(RUN_STATUS[r.status].label) + '）：</strong>' + esc(r.note) + '</div>';
      }).join('') +
      '<div class="md-note">两次事故均已固化为流水线强制校验：① 特征缺失率超 20% 自动失败；② 特征加工时间窗校验（禁止使用标签年份当年数据）。</div>' +
      '</div></div></div></div>';
  }
  function mdResetTraining() { state.training = { model: 'ALL', status: 'ALL', keyword: '' }; renderPage(state.page); }

  function showRunDetail(id) {
    const r = trainRuns.find(function (x) { return x.id === id; });
    if (!r) return;
    const m = models.find(function (x) { return x.id === r.modelId; });
    const fields = [
      ['任务号', r.id], ['模型', r.modelId + (m ? ' ' + m.name : '')], ['模型版本', r.modelVersion],
      ['任务状态', RUN_STATUS[r.status].label], ['触发方式', r.trigger], ['操作人', r.operator],
      ['开始时间', r.startedAt], ['耗时', r.durationMin ? r.durationMin + ' 分钟' : '进行中'],
      ['特征库版本', r.featureVersion], ['随机种子', String(r.seed)], ['交叉验证', r.cv], ['搜索策略', r.search]
    ].map(function (x) { return '<div class="md-field"><div class="md-field-label">' + esc(x[0]) + '</div><div class="md-value">' + esc(x[1]) + '</div></div>'; }).join('');
    const hyperCode = Object.keys(r.hyper).map(function (k) { return '  ' + k + ': ' + JSON.stringify(r.hyper[k]); }).join('\n');
    const metricRows = r.metrics.auc ? '<table class="md-pivot" style="width:100%"><thead><tr><th>AUC</th><th>PR-AUC</th><th>Brier</th><th>KS</th><th>LogLoss</th></tr></thead><tbody><tr>' +
      [r.metrics.auc, r.metrics.pr, r.metrics.brier, r.metrics.ks, r.metrics.logloss].map(function (v) { return '<td>' + n3(v) + '</td>'; }).join('') + '</tr></tbody></table>'
      : '<div class="md-callout">该任务未产出指标（' + esc(RUN_STATUS[r.status].label) + '）。</div>';
    const cvRow = r.cvFolds.length ? '<div class="md-sect"><h4 class="md-h">交叉验证各折 AUC</h4><table class="md-pivot" style="width:100%"><thead><tr>' +
      r.cvFolds.map(function (_, i) { return '<th>第 ' + (i + 1) + ' 折</th>'; }).join('') + '<th>均值</th><th>标准差</th></tr></thead><tbody><tr>' +
      r.cvFolds.map(function (v) { return '<td>' + n3(v) + '</td>'; }).join('') +
      '<td><strong>' + n3(r.cvFolds.reduce(function (a, b) { return a + b; }, 0) / r.cvFolds.length) + '</strong></td>' +
      '<td>' + n3(Math.sqrt(r.cvFolds.reduce(function (a, b) { const mu = r.cvFolds.reduce(function (c, d) { return c + d; }, 0) / r.cvFolds.length; return a + (b - mu) * (b - mu); }, 0) / r.cvFolds.length)) + '</td>' +
      '</tr></tbody></table></div>' : '';
    const body = '<div class="md-fields">' + fields + '</div>' +
      '<div class="md-sect"><h4 class="md-h">完整超参</h4><div class="md-code">' + esc('hyperparameters:\n' + hyperCode) + '</div></div>' +
      '<div class="md-sect"><h4 class="md-h">验证指标</h4>' + metricRows + '</div>' + cvRow +
      '<div class="md-sect"><h4 class="md-h">产物与环境</h4><div class="md-callout"><strong>模型产物：</strong>' + esc(r.artifact) + '<br><strong>运行环境：</strong>' + esc(r.env) + '</div></div>' +
      '<div class="md-sect"><h4 class="md-h">任务备注</h4><div class="md-callout' + (r.status === 'FAILED' || r.status === 'ABORTED' ? ' warn' : '') + '">' + esc(r.note) + '</div></div>';
    const mask = mdModal('训练任务详情 · ' + r.id, body, '<button class="btn btn-ghost" data-close>关闭</button><button class="btn btn-primary" onclick="mdToastMsg(\'已按该任务配置发起复现训练\')">复现该任务</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  function showReproRule() {
    const body = '<div class="md-callout">任何一次训练都必须能在其他机器上重跑出<b>相同指标</b>（容差 ±0.002）。为此以下六项缺一不可：</div>' +
      '<div class="md-sect"><table class="md-pivot" style="width:100%"><thead><tr><th>要素</th><th>记录方式</th><th>缺失后果</th></tr></thead><tbody>' +
      [['特征库版本号', '不可变快照 FS-YYYY.MM', '输入数据无法还原，指标不可比'],
      ['随机种子', '整数，训练日期派生', '划分与采样不同，指标浮动'],
      ['完整超参', 'JSON 全量落库，非仅关键项', '无法区分是超参差异还是数据差异'],
      ['交叉验证方案', '折数 + 分组键（按区县分组）', '分组错误会造成泄漏，指标虚高'],
      ['运行环境镜像', '容器镜像 tag + 库版本', '算法实现版本差异导致结果偏移'],
      ['产物哈希', 'SHA256', '无法确认线上模型与记录一致']].map(function (x) {
        return '<tr><td style="text-align:left">' + esc(x[0]) + '</td><td style="text-align:left;white-space:normal">' + esc(x[1]) + '</td><td style="text-align:left;white-space:normal">' + esc(x[2]) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="md-sect"><div class="md-callout warn"><strong>分组交叉验证的必要性：</strong>同一区县同一癌种的相邻年份高度相关，若随机分折，同一区县会同时出现在训练与验证集，AUC 可虚高 0.05-0.08。本项目强制按区县分组。</div></div>';
    const mask = mdModal('实验复现规范', body, '<button class="btn btn-ghost" data-close>关闭</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  /* ==================== 页面 4：风险预测结果快照 ==================== */
  function renderPredictions() {
    const f = state.predictions, kw = f.keyword.trim().toLowerCase();
    const list = predictions.filter(function (p) {
      return (f.model === 'ALL' || p.modelId === f.model)
        && (f.level === 'ALL' || p.level === f.level)
        && (!kw || [p.id, p.county, p.cancer, p.city].join(' ').toLowerCase().includes(kw));
    });
    const scope = predictions.filter(function (p) { return f.model === 'ALL' || p.modelId === f.model; });
    const high = scope.filter(function (p) { return p.level === 'HIGH'; });
    const mid = scope.filter(function (p) { return p.level === 'MID'; });
    const small = scope.filter(function (p) { return p.smallCount; });
    const withIv = scope.filter(function (p) { return p.interventionId; });
    const kpis = [
      mdKpi('快照记录', nInt(scope.length), COUNTIES.length + ' 区县 × ' + SNAP_CANCERS.length + ' 癌种'),
      mdKpi('高风险', high.length, '概率 ≥ 0.58，须人工研判', high.length ? 'danger' : 'ok'),
      mdKpi('中风险', mid.length, '概率 0.36-0.58，列入观察', 'warn'),
      mdKpi('已派干预工单', withIv.length, '本批快照；另有 2 张来自 2026-07 历史批次'),
      mdKpi('小基数记录', small.length, '年例数 < 40，已贝叶斯收缩', 'warn'),
      mdKpi('快照时间', '08-13 06:00', 'MDL-002 v2.1.0 · FS-2026.08')
    ].join('');

    const rows = list.slice(0, 50).map(function (p) {
      const top = p.contrib[0];
      return '<tr>' +
        '<td class="md-nowrap"><button class="md-id" onclick="showPredictionDetail(\'' + p.id + '\')">' + p.id + '</button><div class="md-sec">' + esc(p.targetYear) + ' 年目标</div></td>' +
        '<td class="md-nowrap">' + esc(p.county) + '<div class="md-sec">' + esc(p.city) + '</div></td>' +
        '<td class="md-nowrap">' + esc(p.cancer) + '</td>' +
        '<td class="md-num md-nowrap"><strong>' + n2(p.prob) + '</strong>' + bar(p.prob * 100, p.level === 'HIGH' ? 'bad' : p.level === 'MID' ? 'warn' : 'ok') +
        '<div class="md-sec">CI ' + n2(p.ci[0]) + '-' + n2(p.ci[1]) + '</div></td>' +
        '<td class="md-nowrap">' + badge(RISK_LEVEL[p.level]) + (p.smallCount ? '<div class="md-sec">小基数</div>' : '') + '</td>' +
        '<td class="md-num md-nowrap">' + n1(p.baselineAsr) + '<div class="md-sec">' + nInt(p.cases2025) + ' 例/2025</div></td>' +
        '<td style="white-space:normal;min-width:200px">' + esc(top.f) + '<div class="md-sec">' + (top.v >= 0 ? '+' : '') + n3(top.v) + '（' + (top.v >= 0 ? '推高' : '拉低') + '）</div></td>' +
        '<td class="md-nowrap">' + (function () {
          const hits = p.ruleHit === '无规则命中' ? [] : p.ruleHit.split(' · ');
          if (!hits.length) return '<span class="md-note">无规则命中</span>';
          return esc(hits[0].replace(' 已触发', '')) + (hits.length > 1 ? '<div class="md-sec">另 ' + (hits.length - 1) + ' 条命中</div>' : '');
        })() + '</td>' +
        '<td class="md-nowrap">' + (p.interventionId ? '<button class="md-id" onclick="mdGoIv(\'' + p.interventionId + '\')">' + p.interventionId + '</button>' : '<span class="md-note">未派单</span>') + '</td>' +
        '<td class="md-nowrap"><button class="btn btn-ghost btn-xs" onclick="showPredictionDetail(\'' + p.id + '\')">详情</button></td>' +
        '</tr>';
    }).join('');

    const mdOpts = [['ALL', '全部模型']].concat(models.filter(function (m) { return m.status === 'PRODUCTION'; }).map(function (m) { return [m.id, m.id + ' ' + m.name]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.model === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    const lvOpts = [['ALL', '全部风险等级']].concat(Object.keys(RISK_LEVEL).map(function (k) { return [k, RISK_LEVEL[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.level === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

    /* 区县 × 癌种 风险热力图 */
    const cols = SNAP_CANCERS.length + 1;
    let heat = '<div class="md-heat" style="grid-template-columns:130px repeat(' + SNAP_CANCERS.length + ',minmax(56px,1fr))">';
    heat += '<div class="md-heat-lab"></div>' + SNAP_CANCERS.map(function (k) { return '<div class="md-heat-lab" style="justify-content:center">' + esc(k.split(' ')[1] || k) + '</div>'; }).join('');
    COUNTIES.forEach(function (c) {
      heat += '<div class="md-heat-lab">' + esc(c.county.replace(/^.{3}市/, '')) + '</div>';
      SNAP_CANCERS.forEach(function (k) {
        const p = predictions.find(function (x) { return x.county === c.county && x.cancer === k && (f.model === 'ALL' || x.modelId === f.model); });
        if (!p) { heat += '<div class="md-heat-cell" style="background:#f1f5f9;color:#94a3b8">-</div>'; return; }
        const alpha = 0.15 + p.prob * 0.85;
        const color = p.level === 'HIGH' ? 'rgba(180,35,53,' + alpha + ')' : p.level === 'MID' ? 'rgba(217,119,6,' + alpha + ')' : 'rgba(22,163,74,' + alpha + ')';
        heat += '<div class="md-heat-cell" style="background:' + color + '" title="' + esc(c.county + ' ' + k + ' 概率 ' + n2(p.prob)) + '" onclick="showPredictionDetail(\'' + p.id + '\')">' + n2(p.prob) + '</div>';
      });
    });
    heat += '</div>';

    return '<div class="md-page">' + mdHeader('风险预测结果快照',
      '存储模型定期运行产生的<b>区域风险预测结果</b>。每条记录固化模型版本、特征库版本、快照时间、预测概率与置信区间、风险等级以及 SHAP 前三贡献特征，<b>结果不可修改</b>——修正只能通过新快照，保证事后可追溯"当时依据什么做出的判断"。同时标注该区域-癌种是否已被 A/B/C 规则命中，便于区分模型独有信号与规则重叠信号。', [
      '<button class="btn btn-outline btn-sm" onclick="showSnapshotRule()">快照规则</button>',
      '<button class="btn btn-outline btn-sm" onclick="mdToastMsg(\'快照已导出\')">导出快照</button>',
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'mdl-interventions\')">干预工单</button>'
    ]) +
      '<div class="md-kpis">' + kpis + '</div>' +
      '<div class="md-filter">' +
      '<div class="form-group" style="grid-column:span 2"><label>模型</label><select onchange="mdSet(\'predictions\',\'model\',this.value)">' + mdOpts + '</select></div>' +
      '<div class="form-group"><label>风险等级</label><select onchange="mdSet(\'predictions\',\'level\',this.value)">' + lvOpts + '</select></div>' +
      '<div class="form-group" style="grid-column:span 2"><label>检索</label><input value="' + esc(f.keyword) + '" placeholder="快照号 / 区县 / 癌种" onchange="mdSet(\'predictions\',\'keyword\',this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="mdResetPredictions()">重置</button></div></div>' +
      '<div class="md-table-wrap"><table class="md-table" style="min-width:1180px"><thead><tr><th>快照号</th><th>区县</th><th>癌种</th><th>预测概率</th><th>风险等级</th><th>基线 ASR</th><th>首要贡献特征</th><th>规则命中</th><th>干预工单</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="10"><div class="md-empty">暂无符合条件的预测记录</div></td></tr>') + '</tbody></table></div>' +
      (list.length > 50 ? '<div class="md-note" style="margin-top:8px">共 ' + list.length + ' 条，已显示前 50 条（按概率降序）。</div>' : '') +
      '<div class="md-card" style="margin-top:14px"><div class="md-card-head"><div class="md-card-title">区县 × 癌种 风险热力图<span class="md-card-sub">点击单元格查看快照详情</span></div></div>' +
      '<div class="md-card-body" style="overflow:auto">' + heat +
      '<div class="md-note" style="margin-top:10px">颜色深浅表示预测概率，红=高风险、橙=中风险、绿=低风险。热力图仅用于内部关注度排序，<b>不得作为地区癌症风险对外发布</b>——区县层面的模型输出受登记质量与小基数影响显著。</div></div></div>' +
      '</div>';
  }
  function mdResetPredictions() { state.predictions = { model: 'MDL-002', level: 'ALL', keyword: '' }; renderPage(state.page); }
  function mdGoIv(id) { state.interventions.keyword = id; closeMdModals(); if (typeof navigateTo === 'function') navigateTo('mdl-interventions'); }

  function showPredictionDetail(id) {
    const p = predictions.find(function (x) { return x.id === id; });
    if (!p) return;
    const m = models.find(function (x) { return x.id === p.modelId; });
    const fields = [
      ['快照号', p.id], ['模型', p.modelId + ' ' + (m ? m.name : '')], ['模型版本', p.modelVersion],
      ['训练任务', p.runId], ['特征库版本', p.featureVersion], ['快照时间', p.snapshotAt],
      ['目标年份', p.targetYear], ['区县', p.county], ['所属地市', p.city], ['癌种', p.cancer],
      ['预测概率', n2(p.prob)], ['95% 置信区间', n2(p.ci[0]) + ' - ' + n2(p.ci[1])],
      ['风险等级', RISK_LEVEL[p.level].label], ['判定阈值', m && m.threshold !== null ? String(m.threshold) : '-'],
      ['基线 ASR', n1(p.baselineAsr) + ' /10万'], ['2025 年例数', nInt(p.cases2025) + ' 例'],
      ['规则命中情况', p.ruleHit], ['关联干预工单', p.interventionId || '未派单']
    ].map(function (x) { return '<div class="md-field"><div class="md-field-label">' + esc(x[0]) + '</div><div class="md-value">' + esc(x[1]) + '</div></div>'; }).join('');
    const contribRows = p.contrib.map(function (c) {
      const w = Math.min(100, Math.abs(c.v) * 320);
      return '<tr><td style="text-align:left">' + esc(c.f) + '</td><td>' + (c.v >= 0 ? '+' : '') + n3(c.v) + '</td>' +
        '<td style="text-align:left">' + bar(w, c.v >= 0 ? 'bad' : 'ok') + '</td><td>' + (c.v >= 0 ? '推高风险' : '拉低风险') + '</td></tr>';
    }).join('');
    const body = '<div class="md-fields">' + fields + '</div>' +
      '<div class="md-sect"><h4 class="md-h">SHAP 贡献分解（前 3）</h4><table class="md-pivot" style="width:100%"><thead><tr><th>特征</th><th>SHAP 值</th><th>幅度</th><th>方向</th></tr></thead><tbody>' + contribRows + '</tbody></table>' +
      '<div class="md-note" style="margin-top:7px">SHAP 值解释的是"该特征把本条记录的预测值推离基线多少"，不代表因果效应。</div></div>' +
      (p.smallCount ? '<div class="md-sect"><div class="md-callout warn"><strong>小基数提示：</strong>该区县-癌种 2025 年仅 ' + nInt(p.cases2025) + ' 例，已做分层贝叶斯收缩，但概率的置信区间较宽（' + n2(p.ci[0]) + '-' + n2(p.ci[1]) + '）。<b>必须人工复核后才能派干预工单。</b></div></div>' : '') +
      '<div class="md-sect"><div class="md-callout' + (p.ruleHit === '无规则命中' ? '' : ' warn') + '"><strong>与规则预警的关系：</strong>' +
      (p.ruleHit === '无规则命中'
        ? '该区域-癌种当前未被 A/B/C 层规则命中，属模型独有信号。按评估报告结论，模型独有信号中约三分之一经研判有价值，须先人工研判再决定是否派单。'
        : '该区域-癌种已被规则命中（' + esc(p.ruleHit) + '），模型与规则结论一致，干预工单应与规则预警工单<b>合并处置</b>，避免对同一区县重复入户核查。') + '</div></div>' +
      '<div class="md-sect"><div class="md-callout warn"><strong>不可修改：</strong>快照为不可变记录。若发现输入数据有误，应修正数据后生成新快照，原快照保留用于追溯，不做覆盖。</div></div>';
    let foot = '<button class="btn btn-ghost" data-close>关闭</button>';
    if (p.interventionId) foot += '<button class="btn btn-primary" onclick="mdGoIv(\'' + p.interventionId + '\')">查看干预工单</button>';
    else if (p.level === 'HIGH') foot += '<button class="btn btn-primary" onclick="mdToastMsg(\'已提交人工研判，研判通过后方可派单\')">提交人工研判</button>';
    const mask = mdModal('预测结果快照 · ' + p.id, body, foot);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  function showSnapshotRule() {
    const body = '<div class="md-callout">快照机制的目的是让"当时为什么这样判断"永久可追溯。规则如下：</div>' +
      '<div class="md-sect"><table class="md-pivot" style="width:100%"><thead><tr><th>规则</th><th>说明</th></tr></thead><tbody>' +
      [['生成时机', '生产模型按刷新周期自动运行（MDL-002 每月 13 日 06:00），或数据修正后手动触发'],
      ['不可变性', '快照写入后禁止 UPDATE/DELETE，修正通过新快照实现'],
      ['必存字段', '模型版本 + 特征库版本 + 训练任务号 + 概率 + 置信区间 + SHAP 前三贡献'],
      ['派单门槛', '仅高风险（≥ 阈值）且经人工研判通过后才生成干预工单，模型不直接派单'],
      ['小基数强制复核', '年例数 < 40 的记录即使高风险也必须人工复核'],
      ['对外发布限制', '区县级模型输出仅内部使用，不得作为地区癌症风险对外公布'],
      ['留存期限', '快照永久留存，与预警记录同等保存要求']].map(function (x) {
        return '<tr><td style="text-align:left">' + esc(x[0]) + '</td><td style="text-align:left;white-space:normal">' + esc(x[1]) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    const mask = mdModal('预测快照规则', body, '<button class="btn btn-ghost" data-close>关闭</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  /* ==================== 页面 5：模型验证与评估报告 ==================== */
  function renderEvaluation() {
    const id = evaluations[state.evaluation.model] ? state.evaluation.model : 'MDL-002';
    const ev = evaluations[id];
    const m = models.find(function (x) { return x.id === id; });
    const cm = ev.confusion;
    const kpis = [
      mdKpi('AUC', n3(ev.metrics.auc), '判别能力', ev.metrics.auc >= 0.8 ? 'ok' : 'warn'),
      mdKpi('PR-AUC', n3(ev.metrics.pr), '正类稀疏场景更重要', ev.metrics.pr >= 0.5 ? 'ok' : 'warn'),
      mdKpi('Brier', n3(ev.metrics.brier), '概率校准（越低越好）', ev.metrics.brier <= 0.08 ? 'ok' : 'warn'),
      mdKpi('召回率', n1(ev.metrics.recall * 100) + '%', '漏报 ' + n1((1 - ev.metrics.recall) * 100) + '%'),
      mdKpi('精确率', n1(ev.metrics.precision * 100) + '%', '误报 ' + n1((1 - ev.metrics.precision) * 100) + '%', ev.metrics.precision >= 0.45 ? 'warn' : 'danger'),
      mdKpi('特征漂移 PSI', n3(ev.drift.psi), ev.drift.psi > 0.1 ? '已触发重训提示' : '未触发重训', ev.drift.psi > 0.1 ? 'danger' : 'ok')
    ].join('');

    const roc = curveChart(ev.roc, { xLabel: '假阳性率 (1-特异度)', yLabel: '真阳性率 (召回)', color: '#1d4ed8', aria: 'ROC 曲线', note: 'AUC = ' + n3(ev.metrics.auc) + '；对角虚线为随机猜测基线。' });
    const cal = curveChart(ev.calibration, { xLabel: '预测概率（分箱均值）', yLabel: '实际发生比例', color: '#b54708', aria: '校准曲线', note: 'Brier = ' + n3(ev.metrics.brier) + '；贴近对角线说明预测概率可当作真实概率使用。' });

    const cmTable = '<table class="md-pivot" style="width:100%"><thead><tr><th></th><th>实际为正</th><th>实际为负</th><th>合计</th></tr></thead><tbody>' +
      '<tr><td>预测为正</td><td style="color:#15803d;font-weight:600">TP ' + nInt(cm.tp) + '</td><td style="color:#b42335;font-weight:600">FP ' + nInt(cm.fp) + '</td><td>' + nInt(cm.tp + cm.fp) + '</td></tr>' +
      '<tr><td>预测为负</td><td style="color:#b42335;font-weight:600">FN ' + nInt(cm.fn) + '</td><td style="color:#15803d;font-weight:600">TN ' + nInt(cm.tn) + '</td><td>' + nInt(cm.fn + cm.tn) + '</td></tr>' +
      '<tr><td>合计</td><td>' + nInt(cm.tp + cm.fn) + '</td><td>' + nInt(cm.fp + cm.tn) + '</td><td>' + nInt(cm.tp + cm.fp + cm.fn + cm.tn) + '</td></tr>' +
      '</tbody></table>';

    const groupRows = ev.byGroup.map(function (g) {
      const tone = g.auc >= 0.82 ? '#15803d' : g.auc >= 0.75 ? '#b54708' : '#b42335';
      return '<tr><td style="text-align:left">' + esc(g.group) + '</td><td>' + nInt(g.n) + '</td>' +
        '<td style="color:' + tone + ';font-weight:600">' + n3(g.auc) + '</td><td>' + n1(g.recall * 100) + '%</td><td>' + n1(g.precision * 100) + '%</td>' +
        '<td style="text-align:left;white-space:normal">' + esc(g.note) + '</td></tr>';
    }).join('');

    const vs = ev.vsRule;
    const vsTotal = vs.ruleOnly + vs.modelOnly + vs.both;
    const evOpts = Object.keys(evaluations).map(function (k) {
      const mm = models.find(function (x) { return x.id === k; });
      return '<option value="' + k + '"' + (id === k ? ' selected' : '') + '>' + esc(k + ' ' + (mm ? mm.name : '')) + '</option>';
    }).join('');

    return '<div class="md-page">' + mdHeader('模型验证与评估报告',
      '生成模型效果评估报告，含<b>准确率、召回率、误报率</b>等指标。除整体指标外，强制包含四项内容：① 概率校准曲线（判别能力好不代表概率可信）；② 分组表现（小基数区县、筛查覆盖区县、高 DCO% 区县单独评估）；③ 特征漂移 PSI 与重训触发判定；④ 与 A/B/C 规则预警的一致性对比。评估结论必须写明使用边界。', [
      '<button class="btn btn-outline btn-sm" onclick="showMetricGuide()">指标释义</button>',
      '<button class="btn btn-outline btn-sm" onclick="mdToastMsg(\'评估报告已导出 PDF\')">导出报告</button>',
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'mdl-interventions\')">干预工单</button>'
    ]) +
      '<div class="md-filter" style="grid-template-columns:minmax(320px,1fr) auto">' +
      '<div class="form-group"><label>评估报告</label><select onchange="mdSet(\'evaluation\',\'model\',this.value)">' + evOpts + '</select></div>' +
      '<div class="filter-actions"><span class="md-note">' + esc(ev.reportId) + ' · ' + esc(ev.modelVersion) + ' · 评估日 ' + esc(ev.evaluatedAt) + ' · ' + esc(ev.evaluator) + '</span></div></div>' +
      '<div class="md-kpis">' + kpis + '</div>' +
      '<div class="md-grid2">' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">ROC 与校准曲线<span class="md-card-sub">' + esc(ev.period) + '</span></div>' + badge(LIFECYCLE[m.status]) + '</div>' +
      '<div class="md-card-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' + roc + cal + '</div>' +
      '<div class="md-callout warn" style="margin-top:11px"><strong>为什么两条曲线都要看：</strong>ROC/AUC 只反映"排序能力"，即高风险是否排在低风险前面；校准曲线反映"概率数值是否可信"。一个 AUC 0.85 但校准很差的模型，可以正确排序却会把 30% 的真实风险报成 70%，导致资源错配。本模块把两者并列展示，禁止只用 AUC 汇报模型效果。</div></div></div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">混淆矩阵与误报代价</div></div><div class="md-card-body">' +
      '<div class="md-note" style="margin-bottom:8px">测试样本 ' + nInt(ev.sampleN) + ' 条，其中正类 ' + nInt(ev.positiveN) + ' 条（' + n1(ev.positiveN / ev.sampleN * 100) + '%），阈值 ' + (m && m.threshold !== null ? m.threshold : '-') + '</div>' +
      cmTable +
      '<div class="md-sect"><div class="md-callout warn"><strong>误报代价评估：</strong>' + nInt(cm.fp) + ' 例假阳性意味着约 ' + nInt(cm.fp) + ' 次不必要的区县核查动员。按每次核查投入 3 人日计，年成本约 ' + nInt(cm.fp * 3) + ' 人日。这是精确率仅 ' + n1(ev.metrics.precision * 100) + '% 的模型必须"人工研判后再派单"的直接原因——模型负责收窄范围，人负责决定是否行动。</div></div>' +
      '<div class="md-sect"><h4 class="md-h">特征漂移监测</h4><div class="md-callout' + (ev.drift.psi > 0.1 ? ' warn' : '') + '"><strong>整体 PSI：</strong>' + n3(ev.drift.psi) + '（阈值 0.10）<br>' +
      (ev.drift.driftFeatures.length ? '<strong>漂移特征：</strong>' + ev.drift.driftFeatures.map(function (x) { return esc(x); }).join('、') + '<br>' : '') +
      '<strong>判定：</strong>' + esc(ev.drift.verdict) + '</div></div>' +
      '</div></div></div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">分组表现<span class="md-card-sub">整体指标会掩盖子群体失效</span></div></div>' +
      '<div class="md-card-body" style="overflow:auto"><table class="md-pivot" style="width:100%"><thead><tr><th>分组</th><th>样本数</th><th>AUC</th><th>召回率</th><th>精确率</th><th>结论</th></tr></thead><tbody>' + groupRows + '</tbody></table>' +
      '<div class="md-note" style="margin-top:9px">分组评估是本报告最关键的部分：整体 AUC ' + n3(ev.metrics.auc) + ' 看似良好，但在筛查覆盖区县仅 ' + n3(ev.byGroup.filter(function (g) { return g.group.indexOf('筛查') >= 0; }).map(function (g) { return g.auc; })[0] || 0) + '，说明模型把筛查带来的检出率上升误判为风险。这正是干预工单 IVT-2026-0028 被判为"筛查项目效应"的原因。</div></div></div>' +
      '<div class="md-grid2">' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">与规则预警的一致性对比</div></div><div class="md-card-body">' +
      '<table class="md-pivot" style="width:100%"><thead><tr><th>来源</th><th>信号数</th><th>占比</th></tr></thead><tbody>' +
      '<tr><td>规则与模型同时命中</td><td>' + vs.both + '</td><td>' + n1(vs.both / vsTotal * 100) + '%</td></tr>' +
      '<tr><td>仅规则命中</td><td>' + vs.ruleOnly + '</td><td>' + n1(vs.ruleOnly / vsTotal * 100) + '%</td></tr>' +
      '<tr><td>仅模型命中</td><td>' + vs.modelOnly + '</td><td>' + n1(vs.modelOnly / vsTotal * 100) + '%</td></tr>' +
      '</tbody></table>' +
      '<div class="md-callout" style="margin-top:10px"><strong>一致率 ' + n2(vs.agreement) + '：</strong>' + esc(vs.note) + '</div>' +
      '<div class="md-note" style="margin-top:8px">一致率过低说明两套体系看的是不同现象（需并行保留）；一致率过高说明模型只是在复述规则（增量价值有限，如 MDL-003 的 0.79）。0.55-0.70 是较理想区间。</div>' +
      '</div></div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">评估结论与使用边界</div></div><div class="md-card-body">' +
      '<div class="md-callout">' + esc(ev.conclusion) + '</div>' +
      '<div class="md-sect"><h4 class="md-h">模型登记的限制条款</h4><div class="md-callout warn">' + esc(m.limitation) + '</div></div>' +
      '<div class="md-sect"><div class="md-fields">' + [
        ['报告编号', ev.reportId], ['评估机构', ev.evaluator], ['评估日期', ev.evaluatedAt], ['下次复评', ev.nextReview]
      ].map(function (x) { return '<div class="md-field"><div class="md-field-label">' + esc(x[0]) + '</div><div class="md-value">' + esc(x[1]) + '</div></div>'; }).join('') + '</div></div>' +
      '</div></div></div>' +
      '</div>';
  }

  function showMetricGuide() {
    const body = '<table class="md-pivot" style="width:100%"><thead><tr><th>指标</th><th>含义</th><th>本项目关注点</th></tr></thead><tbody>' +
      [['AUC', '随机取一正一负样本，正样本得分更高的概率', '判别/排序能力，≥0.80 可用'],
      ['PR-AUC', '精确率-召回率曲线下面积', '正类稀疏（约 13%）时比 AUC 更有区分度，是调参的主目标'],
      ['Brier', '预测概率与实际结果的均方误差', '校准质量，≤0.08 表示概率数值可直接使用'],
      ['KS', '正负样本累积分布的最大差值', '辅助确定分档阈值'],
      ['召回率', 'TP/(TP+FN)，真实风险被识别的比例', '漏报代价：错过真实聚集信号'],
      ['精确率', 'TP/(TP+FP)，报警中真正是风险的比例', '误报代价：不必要的区县核查动员'],
      ['特异度', 'TN/(TN+FP)', '与精确率同看，避免只优化召回'],
      ['PSI', '训练分布与当前分布的差异', '>0.10 触发重训提示，>0.25 视为严重漂移必须重训']].map(function (x) {
        return '<tr><td style="text-align:left">' + esc(x[0]) + '</td><td style="text-align:left;white-space:normal">' + esc(x[1]) + '</td><td style="text-align:left;white-space:normal">' + esc(x[2]) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="md-callout warn" style="margin-top:12px"><strong>本项目的取舍：</strong>肿瘤登记的风险预警属于"宁可多看不可漏看"场景，因此阈值偏向高召回、低精确率；但代价是大量假阳性，所以派单必须经人工研判。不能同时要求高召回与高精确率，这是阈值选择的固有权衡，不是模型缺陷。</div>';
    const mask = mdModal('评估指标释义与阈值取舍', body, '<button class="btn btn-ghost" data-close>关闭</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  /* ==================== 页面 6：风险预警干预工单 ==================== */
  function renderInterventions() {
    const f = state.interventions, kw = f.keyword.trim().toLowerCase();
    const list = interventions.filter(function (iv) {
      return (f.status === 'ALL' || iv.status === f.status)
        && (f.level === 'ALL' || iv.level === f.level)
        && (!kw || [iv.id, iv.predictionId, iv.county, iv.cancer, iv.owner].join(' ').toLowerCase().includes(kw));
    });
    const done = interventions.filter(function (iv) { return iv.status === 'DONE'; });
    const invalid = interventions.filter(function (iv) { return iv.status === 'INVALID'; });
    const closed = done.length + invalid.length;
    const valid = interventions.filter(function (iv) { return iv.humanVerdict === 'VALID'; });
    const kpis = [
      mdKpi('干预工单', interventions.length, '模型高风险 + 人工研判通过'),
      mdKpi('待接收 / 干预中', interventions.filter(function (iv) { return iv.status === 'PENDING' || iv.status === 'DOING'; }).length, '责任单位处置中', 'warn'),
      mdKpi('已闭环', closed, n1(closed / interventions.length * 100) + '% 闭环率'),
      mdKpi('判为有效信号', valid.length, '确认需持续干预', 'ok'),
      mdKpi('判为无效', invalid.length + done.filter(function (iv) { return iv.humanVerdict && iv.humanVerdict.indexOf('INVALID') === 0; }).length, '筛查效应 / 上报行为改变', 'danger'),
      mdKpi('已回流训练', done.concat(invalid).filter(function (iv) { return iv.humanVerdict; }).length, '人工结论作为下轮标签', 'ok')
    ].join('');

    const rows = list.map(function (iv) {
      const verdictLabel = iv.humanVerdict === 'VALID' ? '<span class="badge badge-danger">真实信号</span>'
        : iv.humanVerdict === 'INVALID_SCREEN' ? '<span class="badge badge-muted">筛查效应</span>'
          : iv.humanVerdict === 'INVALID_REPORTING' ? '<span class="badge badge-muted">上报行为改变</span>'
            : '<span class="md-note">研判中</span>';
      return '<tr>' +
        '<td class="md-nowrap"><button class="md-id" onclick="showIvDetail(\'' + iv.id + '\')">' + iv.id + '</button><div class="md-sec">' + esc(iv.createdAt.slice(0, 10)) + '</div></td>' +
        '<td class="md-nowrap">' + (iv.archived
          ? '<span class="md-note">' + esc(iv.predictionId) + '（历史批次）</span>'
          : '<button class="md-id" onclick="showPredictionDetail(\'' + iv.predictionId + '\')">' + iv.predictionId + '</button>')
        + '<div class="md-sec">' + esc(iv.modelId + ' ' + iv.modelVersion) + '</div></td>' +
        '<td>' + esc(iv.county) + '<div class="md-sec">' + esc(iv.city) + '</div></td>' +
        '<td class="md-nowrap">' + esc(iv.cancer) + '</td>' +
        '<td class="md-num md-nowrap">' + n2(iv.prob) + bar(iv.prob * 100, 'bad') + '</td>' +
        '<td>' + esc(iv.owner) + '<div class="md-sec">督办 ' + esc(iv.supervisor) + '</div></td>' +
        '<td class="md-nowrap">' + esc(iv.deadline) + '</td>' +
        '<td class="md-nowrap">' + badge(IV_STATUS[iv.status]) + '</td>' +
        '<td class="md-nowrap">' + verdictLabel + '</td>' +
        '<td class="md-nowrap"><button class="btn btn-ghost btn-xs" onclick="showIvDetail(\'' + iv.id + '\')">详情</button>' +
        (iv.status === 'PENDING' ? ' <button class="btn btn-primary btn-xs" onclick="acceptIv(\'' + iv.id + '\')">接收</button>' : '') +
        (iv.status === 'DOING' ? ' <button class="btn btn-outline btn-xs" onclick="showIvClose(\'' + iv.id + '\')">结案</button>' : '') + '</td>' +
        '</tr>';
    }).join('');

    const stOpts = [['ALL', '全部状态']].concat(Object.keys(IV_STATUS).map(function (k) { return [k, IV_STATUS[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.status === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    const lvOpts = [['ALL', '全部风险等级']].concat(Object.keys(RISK_LEVEL).map(function (k) { return [k, RISK_LEVEL[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.level === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

    /* 闭环结论分布 */
    const verdictAgg = [
      { k: 'VALID', label: '真实信号（需持续干预）', n: interventions.filter(function (iv) { return iv.humanVerdict === 'VALID'; }).length, tone: 'bad' },
      { k: 'INVALID_SCREEN', label: '筛查项目效应', n: interventions.filter(function (iv) { return iv.humanVerdict === 'INVALID_SCREEN'; }).length, tone: 'warn' },
      { k: 'INVALID_REPORTING', label: '上报行为改变', n: interventions.filter(function (iv) { return iv.humanVerdict === 'INVALID_REPORTING'; }).length, tone: 'warn' },
      { k: 'PENDING', label: '研判中', n: interventions.filter(function (iv) { return !iv.humanVerdict; }).length, tone: '' }
    ];
    const verdictRows = verdictAgg.map(function (v) {
      return '<tr><td style="text-align:left">' + esc(v.label) + '</td><td>' + v.n + '</td><td style="text-align:left">' + bar(v.n / interventions.length * 100, v.tone) + '</td><td>' + n1(v.n / interventions.length * 100) + '%</td></tr>';
    }).join('');

    return '<div class="md-page">' + mdHeader('风险预警干预工单',
      '基于模型预警结果生成<b>干预任务并跟踪处置效果</b>。派单前置条件有三：模型输出高风险、经人工研判通过、若为小基数区县须额外复核。工单要求填写具体干预计划、责任单位与督办单位、时限与效果指标；结案时必须给出人工结论（真实信号 / 筛查效应 / 上报行为改变），该结论<b>回流特征库作为下一轮训练标签</b>，形成闭环。', [
      '<button class="btn btn-outline btn-sm" onclick="showFeedbackLoop()">闭环机制</button>',
      '<button class="btn btn-outline btn-sm" onclick="mdToastMsg(\'工单台账已导出\')">导出台账</button>',
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'mdl-evaluation\')">评估报告</button>'
    ]) +
      '<div class="md-kpis">' + kpis + '</div>' +
      '<div class="md-filter">' +
      '<div class="form-group"><label>工单状态</label><select onchange="mdSet(\'interventions\',\'status\',this.value)">' + stOpts + '</select></div>' +
      '<div class="form-group"><label>风险等级</label><select onchange="mdSet(\'interventions\',\'level\',this.value)">' + lvOpts + '</select></div>' +
      '<div class="form-group" style="grid-column:span 2"><label>检索</label><input value="' + esc(f.keyword) + '" placeholder="工单号 / 快照号 / 区县 / 责任单位" onchange="mdSet(\'interventions\',\'keyword\',this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="mdResetIv()">重置</button></div></div>' +
      '<div class="md-table-wrap"><table class="md-table" style="min-width:1320px"><thead><tr><th>工单号</th><th>来源快照</th><th>区县</th><th>癌种</th><th>预测概率</th><th>责任单位</th><th>时限</th><th>状态</th><th>人工结论</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="10"><div class="md-empty">暂无符合条件的干预工单</div></td></tr>') + '</tbody></table></div>' +
      '<div class="md-grid2" style="margin-top:14px">' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">闭环结论分布<span class="md-card-sub">模型精确率的现实检验</span></div></div><div class="md-card-body">' +
      '<table class="md-pivot" style="width:100%"><thead><tr><th>人工结论</th><th>工单数</th><th>分布</th><th>占比</th></tr></thead><tbody>' + verdictRows + '</tbody></table>' +
      '<div class="md-note" style="margin-top:9px">已结案工单中判为无效的占比与评估报告的误报率基本吻合（精确率 44.6% ⇒ 约一半工单最终判为无效），说明模型指标与现实处置结果一致，评估未出现过度乐观。</div></div></div>' +
      '<div class="md-card"><div class="md-card-head"><div class="md-card-title">与规则预警工单的分工</div></div><div class="md-card-body">' +
      '<table class="md-pivot" style="width:100%"><thead><tr><th>对比项</th><th>规则预警工单</th><th>模型干预工单</th></tr></thead><tbody>' +
      [['触发依据', '确定性阈值命中（可复述判定式）', '概率超阈值 + 人工研判通过'],
      ['是否可直接派单', '是，规则命中即派单', '否，必须人工研判'],
      ['工单性质', '核查/整改（数据或质量问题）', '干预/调查（疾病信号或干扰因素排查）'],
      ['结案要求', '核查结论 + 整改证据', '人工结论 + 效果指标，且回流训练'],
      ['责任链', '登记质量考核链', '慢病防控业务链'],
      ['重叠处理', '两者命中同一区域时合并入户，避免重复动员', '同左']].map(function (x) {
        return '<tr><td style="text-align:left">' + esc(x[0]) + '</td><td style="text-align:left;white-space:normal">' + esc(x[1]) + '</td><td style="text-align:left;white-space:normal">' + esc(x[2]) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="md-callout warn" style="margin-top:10px">当前 ' + interventions.filter(function (iv) { return iv.linkedWarning && iv.linkedWarning.indexOf('WRN') === 0; }).length + ' 张干预工单均已关联对应的规则预警记录，处置时合并执行。</div>' +
      '</div></div></div></div>';
  }
  function mdResetIv() { state.interventions = { status: 'ALL', level: 'ALL', keyword: '' }; renderPage(state.page); }

  function showIvDetail(id) {
    const iv = interventions.find(function (x) { return x.id === id; });
    if (!iv) return;
    const p = iv.archived ? null : predictions.find(function (x) { return x.id === iv.predictionId; });
    const fields = [
      ['工单号', iv.id], ['来源快照', iv.predictionId + (iv.archived ? '（2026-07 历史快照批次，已归档）' : '')], ['模型', iv.modelId + ' ' + iv.modelVersion],
      ['区县', iv.county], ['所属地市', iv.city], ['癌种', iv.cancer],
      ['预测概率', n2(iv.prob)], ['风险等级', RISK_LEVEL[iv.level].label],
      ['创建时间', iv.createdAt], ['责任单位', iv.owner], ['督办单位', iv.supervisor],
      ['处置时限', iv.deadline], ['工单状态', IV_STATUS[iv.status].label],
      ['人工结论', iv.humanVerdict === 'VALID' ? '真实信号' : iv.humanVerdict === 'INVALID_SCREEN' ? '筛查项目效应' : iv.humanVerdict === 'INVALID_REPORTING' ? '上报行为改变' : '研判中']
    ].map(function (x) { return '<div class="md-field"><div class="md-field-label">' + esc(x[0]) + '</div><div class="md-value">' + esc(x[1]) + '</div></div>'; }).join('');
    const body = '<div class="md-fields">' + fields + '</div>' +
      '<div class="md-sect"><h4 class="md-h">干预计划</h4><div class="md-callout">' + esc(iv.plan) + '</div></div>' +
      '<div class="md-sect"><h4 class="md-h">处置进展</h4><div class="md-callout">' + esc(iv.progress) + '</div></div>' +
      '<div class="md-sect"><h4 class="md-h">效果指标</h4><div class="md-callout">' + esc(iv.effectMetric) + '</div></div>' +
      '<div class="md-sect"><h4 class="md-h">关联规则预警</h4><div class="md-callout warn">' + esc(iv.linkedWarning) + '<div class="md-note" style="margin-top:6px">该区域同时被规则与模型识别，入户核查合并执行，工单各自留痕但现场动员只做一次。</div></div></div>' +
      (p ? '<div class="md-sect"><h4 class="md-h">快照贡献特征</h4><table class="md-pivot" style="width:100%"><thead><tr><th>特征</th><th>SHAP</th><th>方向</th></tr></thead><tbody>' +
        p.contrib.map(function (c) { return '<tr><td style="text-align:left">' + esc(c.f) + '</td><td>' + (c.v >= 0 ? '+' : '') + n3(c.v) + '</td><td>' + (c.v >= 0 ? '推高' : '拉低') + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '') +
      (iv.humanVerdict ? '<div class="md-sect"><div class="md-callout"><strong>标签回流：</strong>本工单的人工结论已写入特征库标签表，作为下一轮重训的监督信号。' +
        (iv.humanVerdict.indexOf('INVALID') === 0 ? '判为无效的案例是最有价值的负例——它教会模型区分"真实升高"与"检出/上报变化"。' : '判为真实信号的案例用于强化正例。') + '</div></div>' : '');
    let foot = '<button class="btn btn-ghost" data-close>关闭</button>';
    if (iv.status === 'PENDING') foot += '<button class="btn btn-primary" onclick="acceptIv(\'' + iv.id + '\')">接收工单</button>';
    else if (iv.status === 'DOING') foot += '<button class="btn btn-primary" onclick="showIvClose(\'' + iv.id + '\')">填写结案</button>';
    const mask = mdModal('干预工单 · ' + iv.id, body, foot);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  function acceptIv(id) {
    const iv = interventions.find(function (x) { return x.id === id; });
    if (!iv || iv.status !== 'PENDING') return;
    iv.status = 'DOING';
    iv.progress = '已接收（' + CURRENT_USER + '），正在按计划开展核查。';
    closeMdModals();
    mdToast('工单 ' + id + ' 已接收', 'success');
    renderPage('mdl-interventions');
  }

  function showIvClose(id) {
    const iv = interventions.find(function (x) { return x.id === id; });
    if (!iv) return;
    const body = '<div class="md-callout">工单 <strong>' + esc(iv.id) + '</strong> · ' + esc(iv.county) + ' ' + esc(iv.cancer) + ' · 预测概率 ' + n2(iv.prob) + '</div>' +
      '<div class="md-sect"><div class="md-form-grid">' +
      '<div class="form-group full"><label>人工结论（必填，将作为下轮训练标签）</label><select id="ivVerdict">' +
      '<option value="VALID">真实信号 — 确认为需持续干预的疾病信号</option>' +
      '<option value="INVALID_SCREEN">无效 — 筛查项目导致的检出率上升</option>' +
      '<option value="INVALID_REPORTING">无效 — 上报机构/覆盖变化导致</option>' +
      '<option value="INVALID_DENOM">无效 — 人口分母口径问题</option>' +
      '<option value="INVALID_QUALITY">无效 — 登记数据质量问题（转 B 层整改）</option>' +
      '</select></div>' +
      '<div class="form-group full"><label>核查过程与依据</label><textarea id="ivProgress" rows="3" placeholder="填写核查了哪些数据、抽查多少例、得到什么结论"></textarea></div>' +
      '<div class="form-group full"><label>后续措施与效果指标</label><textarea id="ivEffect" rows="2" placeholder="若为真实信号，填写后续防控措施与可衡量的效果指标"></textarea></div>' +
      '</div></div>' +
      '<div class="md-callout warn" style="margin-top:11px"><strong>为什么必须填结论：</strong>人工结论是模型唯一可靠的监督信号。IVT-2026-0019 判为"上报行为改变"后，才发现 MDL-001 未使用活跃上报机构数的时序变化，该缺陷已列入 v1.5.0 重训清单。不填结论的工单等于浪费一次学习机会。</div>';
    const mask = mdModal('填写结案结论 · ' + iv.id, body,
      '<button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" data-submit>提交结案</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
    mask.querySelector('[data-submit]').addEventListener('click', function () {
      const v = mask.querySelector('#ivVerdict').value;
      const pg = (mask.querySelector('#ivProgress').value || '').trim();
      const ef = (mask.querySelector('#ivEffect').value || '').trim();
      if (!pg) { mdToast('请填写核查过程与依据', 'warning'); return; }
      iv.humanVerdict = v;
      iv.status = v === 'VALID' ? 'DONE' : 'INVALID';
      iv.progress = pg + '（结案人：' + CURRENT_USER + '）';
      if (ef) iv.effectMetric = ef;
      mask.remove();
      closeMdModals();
      mdToast('工单已结案，人工结论已回流特征库标签表', 'success');
      renderPage('mdl-interventions');
    });
  }

  function showFeedbackLoop() {
    const body = '<div class="md-sect"><div class="md-code">' + esc(
      '特征库快照 FS-2026.08\n' +
      '        │\n' +
      '        ▼\n' +
      '   模型训练（RUN-2026-0184）──→ 模型注册（MDL-002 v2.1.0，经专家组评审转生产）\n' +
      '                                        │\n' +
      '                                        ▼\n' +
      '                              月度预测快照（PRD-…，不可变）\n' +
      '                                        │\n' +
      '                            高风险 + 人工研判通过（小基数额外复核）\n' +
      '                                        ▼\n' +
      '                              干预工单（IVT-…）→ 责任单位处置\n' +
      '                                        │\n' +
      '                              结案填写人工结论（必填）\n' +
      '                                        │\n' +
      '        ┌───────────────────────────────┴───────────────────────────┐\n' +
      '   真实信号 → 正例强化                            无效 → 负例（筛查/上报/分母/质量）\n' +
      '        └───────────────────────────────┬───────────────────────────┘\n' +
      '                                        ▼\n' +
      '                          回流特征库标签表 → 下一轮重训'
    ) + '</div></div>' +
      '<div class="md-sect"><h4 class="md-h">闭环为什么必要</h4><div class="md-callout">肿瘤发病的"真实风险"没有金标准标签。唯一可用的标签来自人工核查结论：某次报警到底是真实聚集，还是筛查、上报变化、分母错误造成的假象。没有这个回流，模型只能学习"历史率值高的地方明年还高"，永远学不会区分干扰因素。</div></div>' +
      '<div class="md-sect"><h4 class="md-h">已产生的两次模型改进</h4><div class="md-callout warn">① IVT-2026-0028（南昌青山湖区乳腺癌判为筛查效应）促成 v2.1.0 新增 F-SCR-001/002 筛查特征，PR-AUC 由 0.478 提升至 0.512。<br>② IVT-2026-0019（宜春袁州区肺癌判为上报行为改变）暴露 MDL-001 未使用活跃机构数时序变化，已列入 v1.5.0 重训清单。</div></div>';
    const mask = mdModal('预测-干预-回流闭环机制', body, '<button class="btn btn-ghost" data-close>关闭</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  /* ==================== 路由与导出 ==================== */
  function renderModelPage(pageId) {
    if (OWNED_IDS.indexOf(pageId) < 0) return null;
    closeMdModals();
    state.page = pageId;
    if (pageId === 'mdl-features') return renderFeatures();
    if (pageId === 'mdl-registry') return renderRegistry();
    if (pageId === 'mdl-training') return renderTraining();
    if (pageId === 'mdl-predictions') return renderPredictions();
    if (pageId === 'mdl-evaluation') return renderEvaluation();
    if (pageId === 'mdl-interventions') return renderInterventions();
    return '<div class="md-page"><div class="md-empty">页面开发中</div></div>';
  }

  const publicApi = {
    features, featureStore, models, trainRuns, predictions, evaluations, interventions,
    FEATURE_DOMAIN, LIFECYCLE, RISK_LEVEL, IV_STATUS,
    mdSet, mdToastMsg, mdResetFeatures, mdResetRegistry, mdResetTraining, mdResetPredictions, mdResetIv,
    showFeatureDetail, showLineage, showModelDetail, mdGoEval, showRunDetail, showReproRule,
    showPredictionDetail, showSnapshotRule, mdGoIv, showMetricGuide,
    showIvDetail, acceptIv, showIvClose, showFeedbackLoop, closeMdModals,
    renderModelPage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = publicApi;
  if (typeof window !== 'undefined') {
    Object.assign(window, publicApi);
    window.modelPageIds = OWNED_IDS.slice();
  }







})();
