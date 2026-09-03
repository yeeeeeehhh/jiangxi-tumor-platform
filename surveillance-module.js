/*
 * 肿瘤监测数据管道模块（发病 / 死亡 共用一套页面）
 * 对应功能点（页面内用「数据域」段控切换发病|死亡，不再各开一个入口）：
 *   srv-ingest 肿瘤原始数据接入      → 肿瘤发病原始数据接入 / 肿瘤死亡原始数据接入
 *   srv-cube   多维统计指标立方体    → 多维发病统计指标立方体 / 多维死亡统计指标立方体
 *   srv-trend  趋势可视化配置        → 发病趋势可视化配置 / 死亡趋势可视化配置
 *   srv-link   死亡-发病关联分析记录 → 跨域页面，不受数据域切换影响
 * 旧的 srv-*-inc / srv-*-death 六个页面 id 保留为别名，命中时自动预设对应数据域。
 * 与预警模块的分工：本模块负责「数据进来、指标算好、图表配好」；
 *   异常监测规则配置与预警工单在 warning-module.js（预警监测与处置）。
 */
(function () {
  'use strict';

  /* 三个管道页（发病/死亡由页内数据域段控切换）+ 一个跨域关联页 */
  const OWNED_IDS = ['srv-ingest', 'srv-cube', 'srv-trend', 'srv-link'];
  /* 旧入口别名 → [规范页面 id, 数据域]：历史链接与外部硬编码跳转不踩空 */
  const LEGACY_IDS = {
    'srv-ingest-inc': ['srv-ingest', 'INC'], 'srv-cube-inc': ['srv-cube', 'INC'], 'srv-trend-inc': ['srv-trend', 'INC'],
    'srv-ingest-death': ['srv-ingest', 'DEATH'], 'srv-cube-death': ['srv-cube', 'DEATH'], 'srv-trend-death': ['srv-trend', 'DEATH']
  };
  const ROUTE_IDS = OWNED_IDS.concat(Object.keys(LEGACY_IDS));
  const CURRENT_USER = '省级登记中心 · 陈敏';

  const style = document.createElement('style');
  style.textContent = `
#pageContainer .sv-page{padding-bottom:20px}
#pageContainer .sv-head{background:linear-gradient(135deg,#fbfdff,#f4f8fd);border:1px solid var(--border);border-left:4px solid var(--primary);border-radius:6px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
#pageContainer .sv-title{font-size:17px;font-weight:700;color:#1e293b}
#pageContainer .sv-sub{margin-top:5px;font-size:12px;color:#64748b;line-height:1.85;max-width:1080px}
#pageContainer .sv-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
#pageContainer .sv-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:10px;margin-bottom:14px}
#pageContainer .sv-kpi{background:#fff;border:1px solid var(--border);border-radius:6px;padding:11px 13px}
#pageContainer .sv-kpi-label{font-size:12px;color:#667085}
#pageContainer .sv-kpi-value{margin-top:5px;font-size:23px;font-weight:700;color:var(--primary);font-variant-numeric:tabular-nums}
#pageContainer .sv-kpi-value.danger{color:#b42335}
#pageContainer .sv-kpi-value.warn{color:#b54708}
#pageContainer .sv-kpi-value.ok{color:#15803d}
#pageContainer .sv-kpi-meta{margin-top:3px;font-size:11px;color:#94a3b8}
#pageContainer .sv-card{background:#fff;border:1px solid var(--border);border-radius:6px;margin-bottom:14px;overflow:hidden}
#pageContainer .sv-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;border-bottom:1px solid var(--border);background:#fbfcfe}
#pageContainer .sv-card-title{font-size:14px;font-weight:600;color:#1e293b;display:flex;align-items:baseline;gap:8px}
#pageContainer .sv-card-sub{font-size:11px;font-weight:400;color:#94a3b8}
#pageContainer .sv-card-body{padding:13px 14px}
#pageContainer .sv-grid2{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:14px}
@media(max-width:1280px){#pageContainer .sv-grid2{grid-template-columns:minmax(0,1fr)}}
#pageContainer .sv-filter{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px 12px;align-items:end;padding:12px 14px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;margin-bottom:12px}
#pageContainer .sv-filter .filter-actions{display:flex;gap:8px;align-items:flex-end}
#pageContainer .sv-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:6px;background:#fff}
#pageContainer .sv-table{width:100%;min-width:1080px;border-collapse:collapse}
#pageContainer .sv-table th{height:40px;padding:0 11px;text-align:left;background:#f8fafc;color:#5b6673;font-size:12px;font-weight:600;border-bottom:1px solid var(--border);white-space:nowrap}
#pageContainer .sv-table td{height:46px;padding:7px 11px;border-bottom:1px solid var(--border);color:#334155;font-size:13px;vertical-align:middle}
#pageContainer .sv-table td.sv-nowrap{white-space:nowrap}
#pageContainer .sv-table tbody tr:hover{background:#f5f9ff}
#pageContainer .sv-table .badge{white-space:nowrap}
#pageContainer .sv-id{background:none;border:0;padding:0;color:var(--primary);font-weight:600;font-size:13px;cursor:pointer;font-family:var(--font-num,inherit)}
#pageContainer .sv-id:hover{text-decoration:underline}
#pageContainer .sv-sec{font-size:11px;color:#94a3b8;margin-top:3px;line-height:1.6}
#pageContainer .sv-num{font-variant-numeric:tabular-nums;text-align:right}
#pageContainer .sv-bar{height:6px;border-radius:3px;background:#eef2f7;overflow:hidden;margin-top:5px;min-width:70px}
#pageContainer .sv-bar>i{display:block;height:100%;background:var(--primary)}
#pageContainer .sv-bar>i.warn{background:#f59e0b}
#pageContainer .sv-bar>i.bad{background:#dc2626}
#pageContainer .sv-note{font-size:11px;color:#94a3b8;line-height:1.8}
#pageContainer .sv-callout{border:1px solid #cfe0f5;border-left:3px solid var(--primary);background:#f4f9ff;border-radius:5px;padding:10px 12px;font-size:12px;color:#334155;line-height:1.85}
#pageContainer .sv-callout.warn{border-color:#f2cf73;border-left-color:#f4b400;background:#fff8e6;color:#594414}
#pageContainer .sv-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:9px}
#pageContainer .sv-field{min-width:0;padding:9px 10px;background:#fbfcfe;border:1px solid var(--border);border-radius:5px}
#pageContainer .sv-field-label{font-size:11px;color:#667085}
#pageContainer .sv-value{margin-top:3px;font-size:13px;color:#1e293b;word-break:break-word}
#pageContainer .sv-modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:1200;padding:24px}
#pageContainer .sv-modal{background:#fff;border-radius:8px;width:min(940px,100%);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 45px rgba(15,23,42,.25)}
#pageContainer .sv-modal.narrow{width:min(680px,100%)}
#pageContainer .sv-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border)}
#pageContainer .sv-modal-title{font-size:15px;font-weight:700;color:#1e293b}
#pageContainer .sv-close{background:none;border:0;font-size:20px;line-height:1;color:#94a3b8;cursor:pointer}
#pageContainer .sv-modal-body{padding:15px 16px;overflow:auto}
#pageContainer .sv-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--border);background:#fbfcfe}
#pageContainer .sv-sect{margin-top:14px}
#pageContainer .sv-h{margin:0 0 8px;font-size:13px;font-weight:600;color:#475569}
#pageContainer .sv-chart{border:1px solid var(--border);border-radius:6px;background:#fff;padding:10px 12px}
#pageContainer .sv-chart svg{display:block;width:100%;height:auto}
#pageContainer .sv-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;font-size:11px;color:#64748b}
#pageContainer .sv-legend span{display:inline-flex;align-items:center;gap:5px}
#pageContainer .sv-legend i{width:12px;height:3px;border-radius:2px;display:inline-block}
#pageContainer .sv-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px 12px}
#pageContainer .sv-form-grid .form-group.full{grid-column:1/-1}
#pageContainer .sv-switch{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#475569;padding:7px 0;line-height:1.5}
#pageContainer .sv-switch input[type=checkbox]{margin-top:2px;flex:0 0 auto}
#pageContainer .sv-pivot{width:100%;border-collapse:collapse;min-width:0;font-size:12px}
#pageContainer .sv-pivot th,#pageContainer .sv-pivot td{border:1px solid var(--border);padding:6px 9px;text-align:right;white-space:nowrap}
#pageContainer .sv-pivot th{background:#f8fafc;color:#5b6673;font-weight:600}
#pageContainer .sv-pivot th:first-child,#pageContainer .sv-pivot td:first-child{text-align:left}
#pageContainer .sv-pivot tbody tr:hover{background:#f5f9ff}
#pageContainer .sv-empty{padding:30px;text-align:center;color:#94a3b8;font-size:13px}
#pageContainer .sv-tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:12px;flex-wrap:wrap}
#pageContainer .sv-tab{appearance:none;border:0;background:transparent;color:#667085;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent}
#pageContainer .sv-tab.active{color:var(--primary);border-bottom-color:var(--primary)}
#pageContainer .sv-chip{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:11px;background:#eef2f7;color:#475569;font-size:11px;font-weight:600;margin:2px 4px 2px 0}
#pageContainer .sv-chip.dim{background:#e8f1fd;color:#1d4ed8}
#pageContainer .sv-chip.msr{background:#e7f6ec;color:#15803d}
#pageContainer .sv-title-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
#pageContainer .sv-domain{display:inline-flex;align-items:stretch;height:26px;border:1px solid var(--border);border-radius:13px;background:#fff;overflow:hidden;flex:0 0 auto}
#pageContainer .sv-domain-cap{display:inline-flex;align-items:center;padding:0 9px;font-size:11px;color:#94a3b8;background:#f8fafc;border-right:1px solid var(--border)}
#pageContainer .sv-domain-btn{appearance:none;border:0;background:transparent;color:#667085;font-size:12px;font-weight:600;padding:0 16px;cursor:pointer;transition:background .15s,color .15s}
#pageContainer .sv-domain-btn+.sv-domain-btn{border-left:1px solid var(--border)}
#pageContainer .sv-domain-btn:hover{background:#f1f5fb;color:var(--primary)}
#pageContainer .sv-domain-btn.on{background:var(--primary);color:#fff}
#pageContainer .sv-domain-btn.on:hover{background:var(--primary);color:#fff}
#pageContainer .sv-domain-btn.on[data-k="DEATH"]{background:#b42335}
#pageContainer .sv-domain-btn.on[data-k="DEATH"]:hover{background:#b42335}
`;
  document.head.appendChild(style);

  /* ============ 域定义：发病 / 死亡两套同构管道 ============ */
  const DOMAIN = {
    INC: {
      key: 'INC', label: '发病', cubeName: 'CUBE_INC_MULTIDIM', ingestTitle: '肿瘤发病原始数据接入',
      cubeTitle: '多维发病统计指标立方体', trendTitle: '发病趋势可视化配置',
      sources: ['HIS 病案首页', 'LIS 病理系统', '医保结算清单', '基层随访上报', '手工报卡'],
      measures: ['发病例数', '粗发病率(/10万)', '中标发病率(/10万)', '世标发病率(/10万)', '累积率0-74岁(%)'],
      unit: '/10万'
    },
    DEATH: {
      key: 'DEATH', label: '死亡', cubeName: 'CUBE_DEATH_MULTIDIM', ingestTitle: '肿瘤死亡原始数据接入',
      cubeTitle: '多维死亡统计指标立方体', trendTitle: '死亡趋势可视化配置',
      sources: ['死因监测系统', '公安户籍注销', '医院死亡记录', '殡葬火化登记', '手工补录'],
      measures: ['死亡例数', '粗死亡率(/10万)', '中标死亡率(/10万)', '世标死亡率(/10万)', '早死概率30-70岁(%)'],
      unit: '/10万'
    }
  };

  const TRANSFER_STATUS = {
    RECEIVED: { label: '已接收', cls: 'badge-info' },
    PARSING: { label: '解析中', cls: 'badge-info' },
    VALIDATED: { label: '校验通过', cls: 'badge-success' },
    PARTIAL: { label: '部分失败', cls: 'badge-orange' },
    FAILED: { label: '传输失败', cls: 'badge-danger' },
    RETRYING: { label: '重传中', cls: 'badge-warning' }
  };
  const ERROR_KIND = {
    TRANSFER: '传输层错误',
    FORMAT: '格式与解析错误',
    FIELD: '字段值域错误',
    LOGIC: '跨字段逻辑错误',
    DUP: '重复记录'
  };
  const LINK_METHOD = {
    ID_EXACT: { label: '身份证精确匹配', cls: 'badge-success', weight: '主键级' },
    NAME_DOB: { label: '姓名+出生日期+性别', cls: 'badge-info', weight: '强规则' },
    PROB: { label: '概率匹配（姓名相似+地址+诊断）', cls: 'badge-warning', weight: '需人工确认' },
    NONE: { label: '未关联', cls: 'badge-muted', weight: '-' }
  };
  const LINK_STATUS = {
    CONFIRMED: { label: '已确认', cls: 'badge-success' },
    PENDING: { label: '待人工确认', cls: 'badge-warning' },
    REJECTED: { label: '已否决', cls: 'badge-muted' },
    DCN: { label: '转死亡补发病', cls: 'badge-orange' }
  };

  const state = {
    page: 'srv-ingest',
    /* 当前数据域：INC 发病 / DEATH 死亡。三个管道页共用，切页不丢域 */
    domain: 'INC',
    ingest: { status: 'ALL', source: 'ALL', keyword: '', dateFrom: '' },
    cube: { dims: ['地区', '癌种', '年份'], measure: 0, year: '2025', region: '全省' },
    trend: {},
    link: { method: 'ALL', status: 'ALL', keyword: '' }
  };
  /* 两个域各自一份趋势配置 */
  ['INC', 'DEATH'].forEach(function (k) {
    state.trend[k] = {
      measure: 2, dimension: '地区', years: 10, smooth: 'MA3', showCI: true,
      refLine: '全省均值', chartType: 'line', downsample: 'LTTB', maxPoints: 800,
      cacheTTL: 30, yZero: false, published: true
    };
  });

  /* ============ 工具 ============ */
  function esc(v) { const d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function n1(v) { return Number(v || 0).toFixed(1); }
  function n2(v) { return Number(v || 0).toFixed(2); }
  function nInt(v) { return Number(v || 0).toLocaleString('zh-CN'); }
  function pct(v) { return (v > 0 ? '+' : '') + Number(v || 0).toFixed(1) + '%'; }
  function dateAt(dayOffset, h, m) { const d = new Date(2026, 7, 27, h || 9, m || 0, 0); d.setDate(d.getDate() + dayOffset); return d; }
  function fmtTime(v) { if (!v) return '-'; const d = new Date(v); return d.toLocaleDateString('zh-CN') + ' ' + d.toTimeString().slice(0, 5); }
  function badge(meta) { return meta ? '<span class="badge ' + meta.cls + '">' + esc(meta.label) + '</span>' : '-'; }
  function bar(ratio, tone) { const w = Math.max(0, Math.min(100, ratio)); return '<div class="sv-bar"><i class="' + (tone || '') + '" style="width:' + w + '%"></i></div>'; }
  function svToast(msg, type) { if (typeof toast === 'function') toast(msg, type); }
  /* ---------- 数据域（发病 / 死亡）：三个管道页共用一个开关 ---------- */
  function svDomain() { return DOMAIN[state.domain] || DOMAIN.INC; }
  function svSetDomain(key) {
    if (!DOMAIN[key] || state.domain === key) return;
    state.domain = key;
    /* 来源候选项按域不同，旧选项在新域不存在会把列表筛空，须回落到「全部来源」 */
    if (state.ingest.source !== 'ALL' && !DOMAIN[key].sources.includes(state.ingest.source)) state.ingest.source = 'ALL';
    /* 度量按位序一一对应（例数/粗率/中标/世标/第 5 项），切域后由新域重新贴标签，无需重置下标 */
    renderPage(state.page);
  }
  function svGo(pageId, domainKey) {
    if (DOMAIN[domainKey]) state.domain = domainKey;
    navigateTo(pageId);
  }
  function svDomainSwitch() {
    const btn = function (k) {
      return '<button class="sv-domain-btn' + (state.domain === k ? ' on' : '') + '" data-k="' + k +
        '" onclick="svSetDomain(\'' + k + '\')">' + DOMAIN[k].label + '</button>';
    };
    return '<div class="sv-domain" role="group" aria-label="切换数据域"><span class="sv-domain-cap">数据域</span>' + btn('INC') + btn('DEATH') + '</div>';
  }

  function svHeader(title, subtitle, actions, withDomain) {
    return '<div class="sv-head"><div><div class="sv-title-row"><div class="sv-title">' + esc(title) + '</div>' + (withDomain ? svDomainSwitch() : '') + '</div><div class="sv-sub">' + subtitle + '</div></div><div class="sv-actions">' + (actions || []).join('') + '</div></div>';
  }
  function svKpi(label, value, meta, tone) {
    return '<div class="sv-kpi"><div class="sv-kpi-label">' + esc(label) + '</div><div class="sv-kpi-value ' + (tone || '') + '">' + value + '</div><div class="sv-kpi-meta">' + esc(meta) + '</div></div>';
  }
  function svModal(title, body, foot, narrow) {
    const mask = document.createElement('div');
    mask.className = 'sv-modal-mask';
    mask.innerHTML = '<div class="sv-modal' + (narrow ? ' narrow' : '') + '"><div class="sv-modal-head"><div class="sv-modal-title">' + esc(title) + '</div><button class="sv-close" aria-label="关闭">×</button></div><div class="sv-modal-body">' + body + '</div>' + (foot ? '<div class="sv-modal-foot">' + foot + '</div>' : '') + '</div>';
    mask.addEventListener('click', function (e) { if (e.target === mask) mask.remove(); });
    mask.querySelector('.sv-close').addEventListener('click', function () { mask.remove(); });
    (document.getElementById('pageContainer') || document.body).appendChild(mask);
    return mask;
  }
  function closeSvModals() { document.querySelectorAll('.sv-modal-mask').forEach(function (m) { m.remove(); }); }
  function svSet(group, key, value) { state[group][key] = value; renderPage(state.page); }
  function svSetTrend(key, value) {
    const d = svDomain();
    const v = (value === 'true') ? true : (value === 'false') ? false : value;
    state.trend[d.key][key] = (typeof v === 'string' && /^[0-9]+$/.test(v)) ? Number(v) : v;
    renderPage(state.page);
  }

  /* 折线图：给定若干序列渲染 SVG */
  function lineChart(labels, series, opts) {
    opts = opts || {};
    const W = opts.width || 640, H = opts.height || 230;
    const padL = 46, padR = 12, padT = 12, padB = 26;
    const all = series.reduce(function (a, s) { return a.concat(s.values, s.ciHigh || [], s.ciLow || []); }, []).filter(function (v) { return typeof v === 'number'; });
    let min = Math.min.apply(null, all), max = Math.max.apply(null, all);
    if (opts.yZero) min = 0;
    const span = (max - min) || 1;
    min = min - span * 0.08; max = max + span * 0.08;
    const x = function (i) { return padL + (W - padL - padR) * (labels.length <= 1 ? 0.5 : i / (labels.length - 1)); };
    const y = function (v) { return padT + (H - padT - padB) * (1 - (v - min) / (max - min)); };
    let g = '';
    for (let t = 0; t <= 4; t++) {
      const vv = min + (max - min) * t / 4;
      const yy = y(vv);
      g += '<line x1="' + padL + '" y1="' + yy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + yy.toFixed(1) + '" stroke="#eef2f7"/>' +
        '<text x="' + (padL - 6) + '" y="' + (yy + 3.5).toFixed(1) + '" text-anchor="end" font-size="9" fill="#94a3b8">' + vv.toFixed(1) + '</text>';
    }
    labels.forEach(function (lb, i) {
      if (labels.length > 8 && i % 2 === 1) return;
      g += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9" fill="#94a3b8">' + esc(lb) + '</text>';
    });
    series.forEach(function (s) {
      if (s.ciHigh && s.ciLow) {
        const up = s.ciHigh.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); });
        const dn = s.ciLow.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).reverse();
        g += '<polygon points="' + up.concat(dn).join(' ') + '" fill="' + s.color + '" opacity="0.12"/>';
      }
      const pts = s.values.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
      g += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round"' + (s.dash ? ' stroke-dasharray="5 4"' : '') + '/>';
      if (!s.dash) s.values.forEach(function (v, i) { g += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.6" fill="#fff" stroke="' + s.color + '" stroke-width="1.6"/>'; });
    });
    const legend = series.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('');
    return '<div class="sv-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.aria || '趋势图') + '">' + g + '</svg><div class="sv-legend">' + legend + '</div></div>';
  }

  /* ============ 江西口径基础数据 ============ */
  const CITIES = ['南昌市', '赣州市', '九江市', '上饶市', '宜春市', '吉安市', '抚州市', '萍乡市', '景德镇市', '新余市', '鹰潭市'];
  const CANCERS = ['C34 肺', 'C16 胃', 'C22 肝', 'C18-20 结直肠', 'C15 食管', 'C50 乳腺', 'C53 宫颈', '其他'];
  const AGE_GROUPS = ['0-14', '15-39', '40-49', '50-59', '60-69', '70-79', '80+'];
  const YEARS = ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];

  /* ---- 原始数据接入批次（发病） ---- */
  const ingestBatches = {
    INC: [
      {
        id: 'INB-20260826-014', source: 'HIS 病案首页', org: '江西省肿瘤医院', city: '南昌市',
        channel: '前置机定时推送', protocol: 'HTTPS / JSON', fileName: 'HIS_INC_20260826.json',
        received: dateAt(-1, 2, 15), finished: dateAt(-1, 2, 19), status: 'VALIDATED',
        rows: 1284, ok: 1284, failed: 0, dup: 6, retries: 0, checksum: 'a3f19c…7be2', durationSec: 214,
        errors: []
      },
      {
        id: 'INB-20260826-013', source: 'LIS 病理系统', org: '南昌大学第一附属医院', city: '南昌市',
        channel: '前置机定时推送', protocol: 'HTTPS / JSON', fileName: 'LIS_PATH_20260826.json',
        received: dateAt(-1, 2, 10), finished: dateAt(-1, 2, 22), status: 'PARTIAL',
        rows: 963, ok: 901, failed: 62, dup: 11, retries: 1, checksum: 'c81d40…19aa', durationSec: 705,
        errors: [
          { kind: 'FIELD', code: 'E-FIELD-ICD10', count: 34, sample: '第 118 行：形态学编码 "M8140/3 " 含尾随空格，无法匹配 ICD-O-3 字典', action: '已进入字段清洗队列，待编码员确认' },
          { kind: 'LOGIC', code: 'E-LOGIC-DATE', count: 19, sample: '第 402 行：病理确诊日期 2026-09-02 晚于接收日期 2026-08-26', action: '退回机构核对原始报告日期' },
          { kind: 'FORMAT', code: 'E-FMT-ENUM', count: 9, sample: '第 655 行：诊断依据取值 "细胞学检查" 不在值域（1-7）内', action: '按字典映射自动转换为 5，留痕待复核' }
        ]
      },
      {
        id: 'INB-20260826-012', source: '医保结算清单', org: '赣州市人民医院', city: '赣州市',
        channel: '省平台批量交换', protocol: 'SFTP / CSV', fileName: 'YB_SETTLE_202608.csv',
        received: dateAt(-1, 1, 40), finished: dateAt(-1, 1, 41), status: 'FAILED',
        rows: 0, ok: 0, failed: 0, dup: 0, retries: 3, checksum: '-', durationSec: 62,
        errors: [
          { kind: 'TRANSFER', code: 'E-TRAN-TIMEOUT', count: 1, sample: 'SFTP 会话在传输 41% 时中断：Connection reset by peer（对端 10.72.18.5:22）', action: '已触发第 3 次重传，仍失败，工单已推送至赣州市登记处' },
          { kind: 'TRANSFER', code: 'E-TRAN-CHECKSUM', count: 1, sample: '断点续传后 MD5 与清单声明不一致（期望 4b91… 实得 e027…）', action: '要求机构重新导出全量文件' }
        ]
      },
      {
        id: 'INB-20260825-011', source: '基层随访上报', org: '上饶市广丰区疾控中心', city: '上饶市',
        channel: '业务系统手工上传', protocol: 'Web 上传 / XLSX', fileName: 'GF_FOLLOWUP_202607.xlsx',
        received: dateAt(-2, 10, 5), finished: dateAt(-2, 10, 9), status: 'VALIDATED',
        rows: 316, ok: 316, failed: 0, dup: 2, retries: 0, checksum: '77ba12…5c03', durationSec: 231,
        errors: []
      },
      {
        id: 'INB-20260825-010', source: 'HIS 病案首页', org: '九江市第一人民医院', city: '九江市',
        channel: '前置机定时推送', protocol: 'HTTPS / JSON', fileName: 'HIS_INC_20260825.json',
        received: dateAt(-2, 2, 15), finished: null, status: 'RETRYING',
        rows: 742, ok: 0, failed: 0, dup: 0, retries: 2, checksum: '-', durationSec: 0,
        errors: [
          { kind: 'TRANSFER', code: 'E-TRAN-AUTH', count: 1, sample: '前置机证书 CN=jj-his-01 已于 2026-08-20 过期，TLS 握手被拒', action: '等待机构更换证书，重传任务每 6 小时自动发起' }
        ]
      },
      {
        id: 'INB-20260824-009', source: '手工报卡', org: '宜春市袁州区人民医院', city: '宜春市',
        channel: '业务系统手工录入', protocol: '页面提交', fileName: '-',
        received: dateAt(-3, 15, 30), finished: dateAt(-3, 15, 31), status: 'VALIDATED',
        rows: 27, ok: 27, failed: 0, dup: 0, retries: 0, checksum: '-', durationSec: 46,
        errors: []
      },
      {
        id: 'INB-20260824-008', source: 'LIS 病理系统', org: '吉安市中心人民医院', city: '吉安市',
        channel: '前置机定时推送', protocol: 'HTTPS / JSON', fileName: 'LIS_PATH_20260824.json',
        received: dateAt(-3, 2, 12), finished: dateAt(-3, 2, 24), status: 'PARTIAL',
        rows: 588, ok: 566, failed: 22, dup: 4, retries: 0, checksum: '9e04ab…31df', durationSec: 690,
        errors: [
          { kind: 'DUP', code: 'E-DUP-SAME-SPEC', count: 14, sample: '标本号 2026-B-04417 在同一批次出现 3 次（复检报告未标记版本）', action: '保留最新版本，其余进入重卡管理待判' },
          { kind: 'FIELD', code: 'E-FIELD-IDNO', count: 8, sample: '第 233 行：身份证号校验位错误（3608...2X）', action: '已转协查，要求机构核对户籍信息' }
        ]
      }
    ],
    DEATH: [
      {
        id: 'DTB-20260826-007', source: '死因监测系统', org: '江西省疾病预防控制中心', city: '全省',
        channel: '省级系统对接', protocol: 'HTTPS / JSON', fileName: 'DSP_DEATH_202608.json',
        received: dateAt(-1, 3, 0), finished: dateAt(-1, 3, 12), status: 'VALIDATED',
        rows: 2415, ok: 2415, failed: 0, dup: 18, retries: 0, checksum: 'd41ff0…8a17', durationSec: 712,
        errors: []
      },
      {
        id: 'DTB-20260826-006', source: '公安户籍注销', org: '江西省公安厅（数据共享交换）', city: '全省',
        channel: '政务数据交换平台', protocol: 'API / JSON', fileName: 'GA_CANCEL_202608.json',
        received: dateAt(-1, 4, 10), finished: dateAt(-1, 4, 26), status: 'PARTIAL',
        rows: 5820, ok: 5511, failed: 309, dup: 0, retries: 0, checksum: '6b2c8e…4f90', durationSec: 940,
        errors: [
          { kind: 'FIELD', code: 'E-FIELD-CAUSE', count: 268, sample: '根本死因为空或填写"其他"，无法判断是否肿瘤相关（共 268 条）', action: '按规则不纳入肿瘤死亡，仅作户籍状态更新' },
          { kind: 'LOGIC', code: 'E-LOGIC-AGE', count: 41, sample: '注销记录死亡年龄 121 岁，与身份证出生日期矛盾', action: '标记年龄不明，转 B 层年龄不明率监测' }
        ]
      },
      {
        id: 'DTB-20260825-005', source: '医院死亡记录', org: '南昌大学第二附属医院', city: '南昌市',
        channel: '前置机定时推送', protocol: 'HTTPS / JSON', fileName: 'HIS_DEATH_20260825.json',
        received: dateAt(-2, 2, 40), finished: dateAt(-2, 2, 44), status: 'VALIDATED',
        rows: 184, ok: 184, failed: 0, dup: 3, retries: 0, checksum: '02cc71…6de4', durationSec: 226,
        errors: []
      },
      {
        id: 'DTB-20260824-004', source: '殡葬火化登记', org: '抚州市民政局', city: '抚州市',
        channel: '市级系统对接', protocol: 'SFTP / CSV', fileName: 'FZ_CREMATE_202607.csv',
        received: dateAt(-3, 9, 20), finished: dateAt(-3, 9, 28), status: 'PARTIAL',
        rows: 1102, ok: 1039, failed: 63, dup: 0, retries: 1, checksum: 'be7104…22c1', durationSec: 480,
        errors: [
          { kind: 'FORMAT', code: 'E-FMT-ENCODING', count: 47, sample: 'CSV 为 GBK 编码但声明 UTF-8，姓名字段出现乱码（如"?????"）', action: '已按 GBK 重新解码并回填，要求下期修正导出设置' },
          { kind: 'FIELD', code: 'E-FIELD-ADDR', count: 16, sample: '居住地址仅填写"抚州市"，无法定位到区县，影响地区维度归属', action: '转空间地址信息管理补全' }
        ]
      },
      {
        id: 'DTB-20260823-003', source: '手工补录', org: '萍乡市安源区疾控中心', city: '萍乡市',
        channel: '业务系统手工录入', protocol: '页面提交', fileName: '-',
        received: dateAt(-4, 16, 10), finished: dateAt(-4, 16, 11), status: 'VALIDATED',
        rows: 41, ok: 41, failed: 0, dup: 1, retries: 0, checksum: '-', durationSec: 58,
        errors: []
      },
      {
        id: 'DTB-20260823-002', source: '死因监测系统', org: '景德镇市疾控中心', city: '景德镇市',
        channel: '市级系统对接', protocol: 'HTTPS / JSON', fileName: 'DSP_DEATH_JDZ_202607.json',
        received: dateAt(-4, 3, 5), finished: null, status: 'PARSING',
        rows: 356, ok: 0, failed: 0, dup: 0, retries: 0, checksum: '-', durationSec: 0, errors: []
      }
    ]
  };

  /* ---- 多维指标立方体：预计算事实表（地区 × 癌种 × 年份 × 性别 × 年龄组 聚合后的切片） ---- */
  const cubeMeta = {
    INC: {
      dims: [
        { name: '地区', card: 11 + 100, note: '省 / 11 地市 / 100 县区（三级上卷）' },
        { name: '癌种', card: 8, note: 'ICD-10 大类 + 其他（可下钻至 4 位亚目）' },
        { name: '年份', card: 10, note: '2016—2025' },
        { name: '性别', card: 3, note: '合计 / 男 / 女' },
        { name: '年龄组', card: 7, note: '0-14 起 5 岁组上卷为 7 组' },
        { name: '城乡', card: 3, note: '合计 / 城市 / 农村' }
      ],
      cells: 11 * 8 * 10 * 3 * 7 * 3 + 100 * 8 * 10 * 3 * 7,
      builtAt: dateAt(-1, 3, 40), durationMin: 12, version: 'v2026.08.26',
      stdPop: 'Segi 世标 + 2000 年中国标准人口',
      freshness: '每日 03:30 增量 + 每月 1 日全量重建'
    },
    DEATH: {
      dims: [
        { name: '地区', card: 11 + 100, note: '省 / 11 地市 / 100 县区（三级上卷）' },
        { name: '癌种', card: 8, note: '根本死因 ICD-10 大类' },
        { name: '年份', card: 10, note: '2016—2025' },
        { name: '性别', card: 3, note: '合计 / 男 / 女' },
        { name: '年龄组', card: 7, note: '与发病立方体口径一致，保证 M/I 可比' },
        { name: '城乡', card: 3, note: '合计 / 城市 / 农村' }
      ],
      cells: 11 * 8 * 10 * 3 * 7 * 3 + 100 * 8 * 10 * 3 * 7,
      builtAt: dateAt(-1, 4, 5), durationMin: 9, version: 'v2026.08.26',
      stdPop: 'Segi 世标 + 2000 年中国标准人口',
      freshness: '每日 04:00 增量 + 每月 1 日全量重建'
    }
  };

  /* 事实数据：地市 × 癌种（2025），用于立方体切片展示 */
  const facts = {};
  (function buildFacts() {
    /* 各地市人口（万）与癌种基准率，构造稳定可复现的数字 */
    const cityPop = { '南昌市': 653.1, '赣州市': 897.0, '九江市': 456.0, '上饶市': 640.6, '宜春市': 500.5, '吉安市': 461.1, '抚州市': 358.9, '萍乡市': 178.8, '景德镇市': 163.7, '新余市': 120.4, '鹰潭市': 108.5 };
    const cancerBase = {
      'C34 肺': { inc: 54.8, mi: 0.79 }, 'C16 胃': { inc: 22.4, mi: 0.71 }, 'C22 肝': { inc: 24.1, mi: 0.86 },
      'C18-20 结直肠': { inc: 20.6, mi: 0.46 }, 'C15 食管': { inc: 13.2, mi: 0.76 }, 'C50 乳腺': { inc: 17.9, mi: 0.23 },
      'C53 宫颈': { inc: 8.4, mi: 0.28 }, '其他': { inc: 78.2, mi: 0.52 }
    };
    /* 地市偏移系数（模拟真实地区差异，赣州食管/肝偏高，南昌乳腺偏高） */
    const cityFactor = {
      '南昌市': { 'C50 乳腺': 1.42, 'C34 肺': 1.05, def: 1.0 },
      '赣州市': { 'C15 食管': 1.58, 'C22 肝': 1.31, def: 0.94 },
      '九江市': { 'C22 肝': 1.24, def: 0.97 },
      '上饶市': { 'C16 胃': 1.22, def: 0.99 },
      '宜春市': { def: 0.92 }, '吉安市': { def: 0.95 }, '抚州市': { def: 0.9 },
      '萍乡市': { 'C34 肺': 0.78, def: 0.88 }, '景德镇市': { def: 0.93 },
      '新余市': { def: 0.96 }, '鹰潭市': { def: 0.9 }
    };
    const rows = [];
    CITIES.forEach(function (city, ci) {
      CANCERS.forEach(function (cancer, ki) {
        const base = cancerBase[cancer];
        const f = cityFactor[city];
        const factor = (f && f[cancer]) || (f && f.def) || 1;
        const pop = cityPop[city] * 10000;
        const crude = base.inc * factor;
        const cases = Math.round(pop * crude / 100000);
        const asr = crude * 0.72;
        const wsr = crude * 0.78;
        const deaths = Math.round(cases * base.mi);
        const crudeD = deaths / pop * 100000;
        rows.push({
          city, cancer, pop, cases, crude, asr, wsr,
          cum074: crude * 0.00072 * 100,
          deaths, crudeD, asrD: crudeD * 0.7, wsrD: crudeD * 0.76,
          pm3070: crudeD * 0.014,
          /* 性别与年龄构成（用于维度下钻） */
          male: Math.round(cases * (cancer === 'C50 乳腺' ? 0.01 : cancer === 'C53 宫颈' ? 0 : 0.62)),
          ageDist: AGE_GROUPS.map(function (_, i) { return [0.004, 0.031, 0.082, 0.169, 0.283, 0.281, 0.15][i]; }),
          urban: Math.round(cases * (city === '南昌市' ? 0.68 : 0.41))
        });
      });
    });
    facts.rows = rows;
    /* 十年序列：全省与各地市，用于趋势可视化 */
    facts.series = {};
    CITIES.concat(['全省']).forEach(function (region) {
      const sub = region === '全省' ? rows : rows.filter(function (r) { return r.city === region; });
      const pop = sub.reduce(function (a, r) { return a + r.pop; }, 0) / (region === '全省' ? CANCERS.length : CANCERS.length);
      const cases = sub.reduce(function (a, r) { return a + r.cases; }, 0);
      const deaths = sub.reduce(function (a, r) { return a + r.deaths; }, 0);
      const baseInc = cases / pop * 100000;
      const baseDeath = deaths / pop * 100000;
      const drift = region === '赣州市' ? 0.028 : region === '萍乡市' ? -0.032 : region === '南昌市' ? 0.021 : 0.009;
      facts.series[region] = {
        crudeInc: YEARS.map(function (_, i) { return baseInc * (1 + drift * (i - 9)); }),
        asrInc: YEARS.map(function (_, i) { return baseInc * 0.72 * (1 + drift * (i - 9) * 0.8); }),
        wsrInc: YEARS.map(function (_, i) { return baseInc * 0.78 * (1 + drift * (i - 9) * 0.8); }),
        cum: YEARS.map(function (_, i) { return baseInc * 0.00072 * 100 * (1 + drift * (i - 9) * 0.8); }),
        crudeDeath: YEARS.map(function (_, i) { return baseDeath * (1 + drift * 0.55 * (i - 9)); }),
        asrDeath: YEARS.map(function (_, i) { return baseDeath * 0.7 * (1 + drift * 0.45 * (i - 9)); }),
        wsrDeath: YEARS.map(function (_, i) { return baseDeath * 0.76 * (1 + drift * 0.45 * (i - 9)); }),
        pm: YEARS.map(function (_, i) { return baseDeath * 0.014 * (1 + drift * 0.4 * (i - 9)); }),
        casesInc: YEARS.map(function (_, i) { return Math.round(cases * (1 + drift * (i - 9))); }),
        casesDeath: YEARS.map(function (_, i) { return Math.round(deaths * (1 + drift * 0.55 * (i - 9))); })
      };
    });
  })();

  /* ---- 死亡-发病关联分析记录 ---- */
  const linkRecords = [
    {
      id: 'LNK-2026-004121', name: '刘*生', sex: '男', birth: '1957-03-12', city: '赣州市信丰县',
      incId: 'RC-2023-0088741', incDate: '2023-04-18', incSite: 'C15 食管', incStage: 'III期', incBasis: '病理组织学',
      deathId: 'DT-2026-021884', deathDate: '2026-01-09', underlying: 'C15.9 食管恶性肿瘤', deathPlace: '医疗机构',
      method: 'ID_EXACT', status: 'CONFIRMED', survivalDays: 996, consistent: true,
      note: '身份证完全一致，死因与发病部位一致，纳入生存分析与病死率计算。'
    },
    {
      id: 'LNK-2026-004098', name: '张*梅', sex: '女', birth: '1962-11-05', city: '南昌市青山湖区',
      incId: 'RC-2019-0043318', incDate: '2019-08-22', incSite: 'C50 乳腺', incStage: 'II期', incBasis: '病理组织学',
      deathId: 'DT-2026-020117', deathDate: '2026-02-14', underlying: 'I21.9 急性心肌梗死', deathPlace: '家中',
      method: 'ID_EXACT', status: 'CONFIRMED', survivalDays: 2368, consistent: false,
      note: '死因非肿瘤：计入全死因生存，但不计入乳腺癌病死率分子（避免高估疾病致死）。'
    },
    {
      id: 'LNK-2026-004077', name: '王*华', sex: '男', birth: '1949-06-30', city: '九江市都昌县',
      incId: '', incDate: '', incSite: '', incStage: '', incBasis: '',
      deathId: 'DT-2026-019552', deathDate: '2026-03-02', underlying: 'C22.0 肝细胞癌', deathPlace: '家中',
      method: 'NONE', status: 'DCN', survivalDays: null, consistent: null,
      note: '死亡证明有肝癌死因但库内无发病记录，已生成 DCN 回溯任务，超期未闭环将计入 DCO%。'
    },
    {
      id: 'LNK-2026-004052', name: '李*秀', sex: '女', birth: '1955-01-19', city: '上饶市广丰区',
      incId: 'RC-2021-0061204', incDate: '2021-10-05', incSite: 'C16 胃', incStage: 'IV期', incBasis: '细胞学',
      deathId: 'DT-2026-018903', deathDate: '2026-03-27', underlying: 'C16.9 胃恶性肿瘤', deathPlace: '医疗机构',
      method: 'NAME_DOB', status: 'CONFIRMED', survivalDays: 1634, consistent: true,
      note: '死亡记录无身份证，用姓名+出生日期+性别+居住地址四要素匹配，人工复核通过。'
    },
    {
      id: 'LNK-2026-004031', name: '陈*根', sex: '男', birth: '1951-09-08', city: '宜春市袁州区',
      incId: 'RC-2024-0092117', incDate: '2024-02-11', incSite: 'C34 肺', incStage: '不详', incBasis: '临床',
      deathId: 'DT-2026-018440', deathDate: '2026-04-15', underlying: 'C34.9 肺恶性肿瘤', deathPlace: '医疗机构',
      method: 'PROB', status: 'PENDING', survivalDays: 794, consistent: true,
      note: '姓名相似度 0.92、地址同乡镇、死因与发病部位一致，但出生日期相差 2 天，待人工确认。'
    },
    {
      id: 'LNK-2026-003998', name: '黄*平', sex: '男', birth: '1968-04-22', city: '吉安市吉州区',
      incId: 'RC-2025-0104488', incDate: '2025-06-30', incSite: 'C18-20 结直肠', incStage: 'I期', incBasis: '病理组织学',
      deathId: 'DT-2026-017725', deathDate: '2026-05-08', underlying: 'C18.7 乙状结肠恶性肿瘤', deathPlace: '医疗机构',
      method: 'ID_EXACT', status: 'CONFIRMED', survivalDays: 312, consistent: true,
      note: 'I 期确诊后 10 个月死亡，生存期显著短于同期同分期中位数，已提请核对分期准确性。'
    },
    {
      id: 'LNK-2026-003960', name: '吴*兰', sex: '女', birth: '1972-12-14', city: '抚州市临川区',
      incId: 'RC-2022-0074005', incDate: '2022-05-19', incSite: 'C53 宫颈', incStage: 'II期', incBasis: '病理组织学',
      deathId: 'DT-2026-016881', deathDate: '2026-06-01', underlying: 'C53.9 宫颈恶性肿瘤', deathPlace: '家中',
      method: 'PROB', status: 'REJECTED', survivalDays: null, consistent: null,
      note: '概率匹配命中但人工核查为同名同乡不同人（身份证前 6 位不同），已否决并加入排除名单。'
    },
    {
      id: 'LNK-2026-003921', name: '徐*国', sex: '男', birth: '1944-07-03', city: '萍乡市安源区',
      incId: 'RC-2018-0031882', incDate: '2018-03-27', incSite: 'C22 肝', incStage: 'III期', incBasis: '影像学',
      deathId: 'DT-2026-016002', deathDate: '2026-06-20', underlying: 'C22.9 肝恶性肿瘤', deathPlace: '医疗机构',
      method: 'NAME_DOB', status: 'PENDING', survivalDays: 2977, consistent: true,
      note: '生存期近 8 年，与 III 期肝癌预期生存差异较大，需核对原始分期与发病日期。'
    }
  ];

  /* 病死率与生存指标（按癌种汇总，用于关联分析记录页的指标区） */
  const fatalityStats = CANCERS.filter(function (c) { return c !== '其他'; }).map(function (cancer) {
    const sub = facts.rows.filter(function (r) { return r.cancer === cancer; });
    const cases = sub.reduce(function (a, r) { return a + r.cases; }, 0);
    const deaths = sub.reduce(function (a, r) { return a + r.deaths; }, 0);
    const linked = Math.round(deaths * (cancer === 'C22 肝' ? 0.87 : cancer === 'C50 乳腺' ? 0.96 : 0.93));
    const median = { 'C34 肺': 19.4, 'C16 胃': 24.1, 'C22 肝': 11.2, 'C18-20 结直肠': 52.6, 'C15 食管': 21.8, 'C50 乳腺': 96.3, 'C53 宫颈': 78.5 }[cancer];
    return {
      cancer, cases, deaths, mi: deaths / cases, linked,
      linkRate: linked / deaths * 100,
      medianSurvivalMonth: median,
      os5: { 'C34 肺': 21.7, 'C16 胃': 35.1, 'C22 肝': 14.4, 'C18-20 结直肠': 56.9, 'C15 食管': 30.3, 'C50 乳腺': 83.2, 'C53 宫颈': 66.1 }[cancer]
    };
  });

  /* ==================== 页面：原始数据接入 ==================== */
  function filteredBatches(d) {
    const f = state.ingest, kw = f.keyword.trim().toLowerCase();
    return ingestBatches[d.key].filter(function (b) {
      return (f.status === 'ALL' || b.status === f.status)
        && (f.source === 'ALL' || b.source === f.source)
        && (!f.dateFrom || new Date(b.received) >= new Date(f.dateFrom + 'T00:00:00'))
        && (!kw || [b.id, b.org, b.fileName, b.source, b.city].join(' ').toLowerCase().includes(kw));
    });
  }

  function renderIngest(d) {
    const all = ingestBatches[d.key];
    const totalRows = all.reduce(function (a, b) { return a + b.rows; }, 0);
    const okRows = all.reduce(function (a, b) { return a + b.ok; }, 0);
    const failRows = all.reduce(function (a, b) { return a + b.failed; }, 0);
    const errCount = all.reduce(function (a, b) { return a + b.errors.reduce(function (s, e) { return s + e.count; }, 0); }, 0);
    const abnormal = all.filter(function (b) { return ['FAILED', 'RETRYING', 'PARTIAL'].includes(b.status); }).length;
    const kpis = [
      svKpi('接入批次', all.length, '近 7 日全部来源'),
      svKpi('接收记录数', nInt(totalRows), '含校验未通过'),
      svKpi('入库成功率', totalRows ? n1(okRows / totalRows * 100) + '%' : '-', okRows + ' / ' + totalRows + ' 条', totalRows && okRows / totalRows < 0.95 ? 'warn' : 'ok'),
      svKpi('校验失败', nInt(failRows), '按错误类型分类留痕', failRows ? 'warn' : ''),
      svKpi('异常批次', abnormal, '传输失败 / 重传中 / 部分失败', abnormal ? 'danger' : 'ok'),
      svKpi('错误明细', nInt(errCount), '可逐条追溯到行号')
    ].join('');

    const rows = filteredBatches(d).map(function (b) {
      const errTotal = b.errors.reduce(function (s, e) { return s + e.count; }, 0);
      const rate = b.rows ? b.ok / b.rows * 100 : 0;
      const tone = rate >= 99 ? '' : rate >= 90 ? 'warn' : 'bad';
      return '<tr>' +
        '<td class="sv-nowrap"><button class="sv-id" onclick="showBatchDetail(\'' + d.key + '\',\'' + b.id + '\')">' + b.id + '</button><div class="sv-sec">' + esc(b.protocol) + '</div></td>' +
        '<td>' + esc(b.source) + '<div class="sv-sec">' + esc(b.channel) + '</div></td>' +
        '<td>' + esc(b.org) + '<div class="sv-sec">' + esc(b.city) + '</div></td>' +
        '<td>' + esc(b.fileName) + '<div class="sv-sec">校验和 ' + esc(b.checksum) + '</div></td>' +
        '<td class="sv-num">' + nInt(b.rows) + '<div class="sv-sec">成功 ' + nInt(b.ok) + ' · 失败 ' + nInt(b.failed) + '</div>' + (b.rows ? bar(rate, tone) : '') + '</td>' +
        '<td class="sv-nowrap">' + badge(TRANSFER_STATUS[b.status]) + (b.retries ? '<div class="sv-sec">重传 ' + b.retries + ' 次</div>' : '') + '</td>' +
        '<td class="sv-nowrap">' + fmtTime(b.received) + '<div class="sv-sec">' + (b.finished ? '耗时 ' + b.durationSec + ' 秒' : '进行中') + '</div></td>' +
        '<td class="sv-nowrap">' + (errTotal ? '<span class="badge badge-orange">' + errTotal + ' 条</span>' : '<span class="badge badge-success">无</span>') + '</td>' +
        '<td class="sv-nowrap"><button class="btn btn-ghost btn-xs" onclick="showBatchDetail(\'' + d.key + '\',\'' + b.id + '\')">详情</button>' +
        (['FAILED', 'RETRYING'].includes(b.status) ? ' <button class="btn btn-outline btn-xs" onclick="retryBatch(\'' + d.key + '\',\'' + b.id + '\')">重传</button>' : '') + '</td>' +
        '</tr>';
    }).join('');

    const statusOpts = [['ALL', '全部状态']].concat(Object.keys(TRANSFER_STATUS).map(function (k) { return [k, TRANSFER_STATUS[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (state.ingest.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    const srcOpts = [['ALL', '全部来源']].concat(d.sources.map(function (s) { return [s, s]; }))
      .map(function (o) { return '<option value="' + esc(o[0]) + '"' + (state.ingest.source === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

    /* 错误类型汇总 */
    const kindAgg = {};
    all.forEach(function (b) { b.errors.forEach(function (e) { kindAgg[e.kind] = (kindAgg[e.kind] || 0) + e.count; }); });
    const kindRows = Object.keys(ERROR_KIND).map(function (k) {
      const c = kindAgg[k] || 0;
      const share = errCount ? c / errCount * 100 : 0;
      return '<tr><td>' + esc(ERROR_KIND[k]) + '</td><td class="sv-num">' + nInt(c) + '</td><td class="sv-num">' + n1(share) + '%' + bar(share, share > 40 ? 'bad' : share > 20 ? 'warn' : '') + '</td></tr>';
    }).join('');

    return '<div class="sv-page">' + svHeader(d.ingestTitle,
      '记录从各级医疗机构接入' + d.label + '数据的<b>传输状态与错误信息</b>：批次级传输状态机（已接收→解析中→校验通过／部分失败／传输失败→重传），错误按传输层／格式／字段值域／跨字段逻辑／重复五类留痕并可追溯到行号。<br>本页只负责"数据是否完整进来"，字段级修正在「报告卡管理 · 上报数据管理」，聚合阈值预警在「预警监测与处置」。', [
      '<button class="btn btn-outline btn-sm" onclick="svToastMsg(\'已触发全部失败批次重传\')">批量重传</button>',
      '<button class="btn btn-outline btn-sm" onclick="svToastMsg(\'错误明细已导出\')">导出错误明细</button>',
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'srv-cube\')">查看指标立方体</button>'
    ], true) +
      '<div class="sv-kpis">' + kpis + '</div>' +
      '<div class="sv-filter">' +
      '<div class="form-group"><label>传输状态</label><select onchange="svSet(\'ingest\',\'status\',this.value)">' + statusOpts + '</select></div>' +
      '<div class="form-group"><label>数据来源</label><select onchange="svSet(\'ingest\',\'source\',this.value)">' + srcOpts + '</select></div>' +
      '<div class="form-group"><label>接收起始日</label><input type="date" value="' + esc(state.ingest.dateFrom) + '" onchange="svSet(\'ingest\',\'dateFrom\',this.value)"></div>' +
      '<div class="form-group" style="grid-column:span 2"><label>检索</label><input value="' + esc(state.ingest.keyword) + '" placeholder="批次号 / 机构 / 文件名" onchange="svSet(\'ingest\',\'keyword\',this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="svResetIngest()">重置</button></div></div>' +
      '<div class="sv-table-wrap"><table class="sv-table"><thead><tr><th>批次号 / 协议</th><th>来源 / 通道</th><th>上报机构</th><th>文件 / 校验和</th><th>记录数</th><th>传输状态</th><th>接收时间</th><th>错误</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9"><div class="sv-empty">暂无符合条件的接入批次</div></td></tr>') + '</tbody></table></div>' +
      '<div class="sv-card" style="margin-top:14px"><div class="sv-card-head"><div class="sv-card-title">错误类型分布<span class="sv-card-sub">近 7 日 ' + nInt(errCount) + ' 条错误明细</span></div></div><div class="sv-card-body"><table class="sv-pivot"><thead><tr><th>错误类型</th><th>条数</th><th>占比</th></tr></thead><tbody>' + kindRows + '</tbody></table><div class="sv-note" style="margin-top:9px">传输层错误由运维与机构信息科处理；字段与逻辑错误进入数据清洗队列；重复记录转「重卡管理」判定。</div></div></div>' +
      '</div>';
  }

  function svResetIngest() { state.ingest = { status: 'ALL', source: 'ALL', keyword: '', dateFrom: '' }; renderPage(state.page); }
  function svToastMsg(m) { svToast(m); }

  function retryBatch(domainKey, id) {
    const b = ingestBatches[domainKey].find(function (x) { return x.id === id; });
    if (!b) return;
    b.retries++;
    b.status = 'RETRYING';
    svToast('已发起第 ' + b.retries + ' 次重传：' + id);
    closeSvModals();
    renderPage(state.page);
  }

  function showBatchDetail(domainKey, id) {
    const d = DOMAIN[domainKey];
    const b = ingestBatches[domainKey].find(function (x) { return x.id === id; });
    if (!b) return;
    const fields = [
      ['批次号', b.id], ['数据来源', b.source], ['传输通道', b.channel], ['传输协议', b.protocol],
      ['上报机构', b.org], ['所属地区', b.city], ['文件名', b.fileName], ['校验和', b.checksum],
      ['接收时间', fmtTime(b.received)], ['完成时间', b.finished ? fmtTime(b.finished) : '未完成'],
      ['处理耗时', b.finished ? b.durationSec + ' 秒' : '-'], ['重传次数', String(b.retries)],
      ['接收记录', nInt(b.rows) + ' 条'], ['成功入库', nInt(b.ok) + ' 条'],
      ['校验失败', nInt(b.failed) + ' 条'], ['疑似重复', nInt(b.dup) + ' 条']
    ].map(function (f) {
      return '<div class="sv-field"><div class="sv-field-label">' + esc(f[0]) + '</div><div class="sv-value">' + esc(f[1]) + '</div></div>';
    }).join('');
    const errRows = b.errors.length ? b.errors.map(function (e) {
      return '<tr><td class="sv-nowrap">' + esc(ERROR_KIND[e.kind]) + '<div class="sv-sec">' + esc(e.code) + '</div></td>' +
        '<td class="sv-num sv-nowrap">' + nInt(e.count) + '</td>' +
        '<td>' + esc(e.sample) + '</td>' +
        '<td>' + esc(e.action) + '</td></tr>';
    }).join('') : '<tr><td colspan="4"><div class="sv-empty">本批次无错误记录</div></td></tr>';
    const body = '<div class="sv-fields">' + fields + '</div>' +
      '<div class="sv-callout' + (b.errors.length ? ' warn' : '') + '" style="margin-top:12px"><strong>传输状态：</strong>' + TRANSFER_STATUS[b.status].label +
      '。<strong>后续动作：</strong>' + (b.status === 'VALIDATED' ? '已进入' + d.label + '指标立方体的增量刷新队列。' : b.status === 'PARTIAL' ? '成功部分已入库并参与指标计算，失败部分不计入分子分母，避免污染率值。' : '本批次数据未入库，' + d.label + '立方体不受影响；持续失败将触发 A 层「机构连续零报」预警。') + '</div>' +
      '<div class="sv-sect"><h4 class="sv-h">错误信息明细</h4><div class="sv-table-wrap"><table class="sv-table" style="min-width:0"><thead><tr><th>错误类型 / 代码</th><th>条数</th><th>样例（含行号）</th><th>处理动作</th></tr></thead><tbody>' + errRows + '</tbody></table></div></div>';
    const foot = '<button class="btn btn-ghost" data-close>关闭</button>' +
      (['FAILED', 'RETRYING'].includes(b.status) ? '<button class="btn btn-primary" onclick="retryBatch(\'' + domainKey + '\',\'' + b.id + '\')">立即重传</button>' : '');
    const mask = svModal('接入批次详情 · ' + b.id, body, foot);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  /* ==================== 页面：多维指标立方体 ==================== */
  function measureValue(row, d, idx) {
    if (d.key === 'INC') return [row.cases, row.crude, row.asr, row.wsr, row.cum074][idx];
    return [row.deaths, row.crudeD, row.asrD, row.wsrD, row.pm3070][idx];
  }
  function measureFmt(idx, v) { return idx === 0 ? nInt(v) : n1(v); }

  function renderCube(d) {
    const meta = cubeMeta[d.key];
    const mIdx = state.cube.measure;
    const kpis = [
      svKpi('预计算单元格', nInt(meta.cells), d.cubeName + ' · ' + meta.version),
      svKpi('维度数', meta.dims.length, '支持任意组合上卷下钻'),
      svKpi('度量数', d.measures.length, d.measures.join(' / ')),
      svKpi('最近构建', meta.durationMin + ' 分钟', fmtTime(meta.builtAt) + ' · ' + meta.version, 'ok'),
      svKpi('刷新策略', '增量+全量', meta.freshness)
    ].join('');

    /* 切片：地市 × 癌种 交叉表 */
    const head = '<tr><th>地区 \\ 癌种</th>' + CANCERS.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '<th>合计</th></tr>';
    const body = CITIES.map(function (city) {
      const cells = CANCERS.map(function (cancer) {
        const row = facts.rows.find(function (r) { return r.city === city && r.cancer === cancer; });
        return '<td>' + measureFmt(mIdx, measureValue(row, d, mIdx)) + '</td>';
      }).join('');
      const sub = facts.rows.filter(function (r) { return r.city === city; });
      let total;
      if (mIdx === 0) total = sub.reduce(function (a, r) { return a + measureValue(r, d, 0); }, 0);
      else {
        const cases = sub.reduce(function (a, r) { return a + (d.key === 'INC' ? r.cases : r.deaths); }, 0);
        const pop = sub[0].pop;
        const crude = cases / pop * 100000;
        total = mIdx === 1 ? crude : mIdx === 2 ? crude * (d.key === 'INC' ? 0.72 : 0.7) : mIdx === 3 ? crude * (d.key === 'INC' ? 0.78 : 0.76) : crude * (d.key === 'INC' ? 0.00072 * 100 : 0.014);
      }
      return '<tr><td>' + esc(city) + '</td>' + cells + '<td><strong>' + measureFmt(mIdx, total) + '</strong></td></tr>';
    }).join('');

    const dimRows = meta.dims.map(function (dim) {
      const active = state.cube.dims.includes(dim.name);
      return '<tr><td><label class="sv-switch"><input type="checkbox" ' + (active ? 'checked' : '') + ' onchange="cubeToggleDim(\'' + esc(dim.name) + '\')">' + esc(dim.name) + '</label></td>' +
        '<td class="sv-num sv-nowrap">' + nInt(dim.card) + '</td><td>' + esc(dim.note) + '</td></tr>';
    }).join('');

    const measureOpts = d.measures.map(function (m, i) { return '<option value="' + i + '"' + (mIdx === i ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('');

    /* 年龄别与性别切片（下钻演示） */
    const pick = facts.rows.filter(function (r) { return r.city === (state.cube.region === '全省' ? '南昌市' : state.cube.region); });
    const ageHead = '<tr><th>癌种</th>' + AGE_GROUPS.map(function (a) { return '<th>' + a + '</th>'; }).join('') + '<th>男</th><th>女</th></tr>';
    const ageBody = pick.filter(function (r) { return r.cancer !== '其他'; }).map(function (r) {
      const base = d.key === 'INC' ? r.cases : r.deaths;
      const cells = r.ageDist.map(function (w) { return '<td>' + nInt(Math.round(base * w)) + '</td>'; }).join('');
      const male = d.key === 'INC' ? r.male : Math.round(r.male * 0.8);
      return '<tr><td>' + esc(r.cancer) + '</td>' + cells + '<td>' + nInt(male) + '</td><td>' + nInt(base - male) + '</td></tr>';
    }).join('');
    const regionOpts = ['全省'].concat(CITIES).map(function (c) { return '<option value="' + esc(c) + '"' + (state.cube.region === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');

    return '<div class="sv-page">' + svHeader(d.cubeTitle,
      '预计算按<b>地区、癌种、年龄、性别、城乡、年份</b>维度组合的' + d.label + '率指标，避免每次查询回表扫描明细。标准人口：' + esc(meta.stdPop) + '；口径与「数据统计 · 统计分析」一致，' + (d.key === 'DEATH' ? '年龄组划分与发病立方体严格对齐，保证 M/I 比可比。' : '为 B 层质量指标与 C 层信号研判提供率值底座。'), [
      '<button class="btn btn-outline btn-sm" onclick="rebuildCube(\'' + d.key + '\')">重建立方体</button>',
      '<button class="btn btn-outline btn-sm" onclick="svToastMsg(\'当前切片已导出为 CSV\')">导出切片</button>',
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'srv-trend\')">趋势可视化配置</button>'
    ], true) +
      '<div class="sv-kpis">' + kpis + '</div>' +
      '<div class="sv-grid2">' +
      '<div class="sv-card"><div class="sv-card-head"><div class="sv-card-title">立方体切片<span class="sv-card-sub">2025 年 · 地区 × 癌种</span></div>' +
      '<div style="display:flex;gap:8px;align-items:center"><span class="sv-note">度量</span><select style="height:30px;font-size:12px" onchange="svSet(\'cube\',\'measure\',Number(this.value))">' + measureOpts + '</select></div></div>' +
      '<div class="sv-card-body" style="overflow:auto"><table class="sv-pivot"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>' +
      '<div class="sv-note" style="margin-top:9px">单位：' + (mIdx === 0 ? '例' : mIdx === 4 ? '%' : d.unit) + '。合计行按人口加权重算，非各癌种率值直接相加。</div></div></div>' +
      '<div class="sv-card"><div class="sv-card-head"><div class="sv-card-title">维度与基数</div></div><div class="sv-card-body">' +
      '<table class="sv-pivot" style="width:100%"><thead><tr><th>维度</th><th>基数</th><th>层级说明</th></tr></thead><tbody>' + dimRows + '</tbody></table>' +
      '<div style="margin-top:10px">' + state.cube.dims.map(function (x) { return '<span class="sv-chip dim">' + esc(x) + '</span>'; }).join('') + '<span class="sv-chip msr">' + esc(d.measures[mIdx]) + '</span></div>' +
      '<div class="sv-note" style="margin-top:8px">已选 ' + state.cube.dims.length + ' 个维度 + 1 个度量，对应切片约 ' + nInt(state.cube.dims.reduce(function (a, name) { const dim = meta.dims.find(function (x) { return x.name === name; }); return a * (dim ? dim.card : 1); }, 1)) + ' 个单元格，命中预计算结果直接返回。</div>' +
      '</div></div></div>' +
      '<div class="sv-card"><div class="sv-card-head"><div class="sv-card-title">下钻：年龄别与性别构成<span class="sv-card-sub">' + esc(d.measures[0]) + ' · 2025 年</span></div>' +
      '<div style="display:flex;gap:8px;align-items:center"><span class="sv-note">地区</span><select style="height:30px;font-size:12px" onchange="svSet(\'cube\',\'region\',this.value)">' + regionOpts + '</select></div></div>' +
      '<div class="sv-card-body" style="overflow:auto"><table class="sv-pivot"><thead>' + ageHead + '</thead><tbody>' + ageBody + '</tbody></table>' +
      '<div class="sv-note" style="margin-top:9px">年龄组为 5 岁组上卷结果；宫颈癌男性单元格恒为 0，乳腺癌男性单元格保留（男性乳腺癌约占 1%）。</div></div></div>' +
      '</div>';
  }

  function cubeToggleDim(name) {
    const i = state.cube.dims.indexOf(name);
    if (i >= 0) {
      if (state.cube.dims.length <= 1) { svToast('至少保留一个维度', 'error'); return; }
      state.cube.dims.splice(i, 1);
    } else state.cube.dims.push(name);
    renderPage(state.page);
  }
  function rebuildCube(key) {
    const meta = cubeMeta[key];
    meta.builtAt = new Date();
    meta.durationMin = key === 'INC' ? 12 : 9;
    svToast(DOMAIN[key].label + '立方体已全量重建（' + meta.durationMin + ' 分钟）');
    renderPage(state.page);
  }

  /* ==================== 页面：趋势可视化配置 ==================== */
  function seriesKeyFor(d, mIdx) {
    if (d.key === 'INC') return ['casesInc', 'crudeInc', 'asrInc', 'wsrInc', 'cum'][mIdx];
    return ['casesDeath', 'crudeDeath', 'asrDeath', 'wsrDeath', 'pm'][mIdx];
  }
  function smoothSeries(values, mode) {
    if (mode === 'NONE') return values.slice();
    const win = mode === 'MA5' ? 5 : 3;
    const half = Math.floor(win / 2);
    return values.map(function (_, i) {
      let sum = 0, cnt = 0;
      for (let j = i - half; j <= i + half; j++) { if (j >= 0 && j < values.length) { sum += values[j]; cnt++; } }
      return sum / cnt;
    });
  }

  function renderTrend(d) {
    const cfg = state.trend[d.key];
    const years = YEARS.slice(-cfg.years);
    const mIdx = cfg.measure;
    const key = seriesKeyFor(d, mIdx);
    const color = d.key === 'INC' ? '#1d4ed8' : '#b42335';

    /* 主序列：按配置的维度取若干条 */
    let picks;
    if (cfg.dimension === '地区') picks = ['全省', '赣州市', '南昌市', '萍乡市'];
    else if (cfg.dimension === '全省合计') picks = ['全省'];
    else picks = ['全省', '赣州市'];
    const palette = ['#1d4ed8', '#b42335', '#15803d', '#b54708', '#7c3aed'];
    const series = picks.map(function (region, i) {
      const raw = facts.series[region][key].slice(-cfg.years);
      const values = smoothSeries(raw, cfg.smooth);
      const s = { name: region + (cfg.smooth === 'NONE' ? '' : ' (' + (cfg.smooth === 'MA5' ? '5年' : '3年') + '移动平均)'), values, color: palette[i % palette.length] };
      if (cfg.showCI && i === 0) {
        s.ciHigh = values.map(function (v) { return v * 1.06; });
        s.ciLow = values.map(function (v) { return v * 0.94; });
      }
      return s;
    });
    if (cfg.refLine === '全省均值') {
      const arr = facts.series['全省'][key].slice(-cfg.years);
      const avg = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
      series.push({ name: '全省十年均值参考线', values: arr.map(function () { return avg; }), color: '#94a3b8', dash: true });
    }
    const chart = lineChart(years, series, { yZero: cfg.yZero, aria: d.trendTitle, height: 250 });

    const measureOpts = d.measures.map(function (m, i) { return '<option value="' + i + '"' + (mIdx === i ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('');
    const dimOpts = ['地区', '全省合计', '癌种'].map(function (x) { return '<option value="' + x + '"' + (cfg.dimension === x ? ' selected' : '') + '>' + x + '</option>'; }).join('');
    const yearOpts = [5, 8, 10].map(function (y) { return '<option value="' + y + '"' + (cfg.years === y ? ' selected' : '') + '>近 ' + y + ' 年</option>'; }).join('');
    const smoothOpts = [['NONE', '不平滑（原始值）'], ['MA3', '3 年移动平均'], ['MA5', '5 年移动平均']].map(function (o) { return '<option value="' + o[0] + '"' + (cfg.smooth === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    const typeOpts = [['line', '折线图'], ['area', '面积图'], ['bar', '柱状图']].map(function (o) { return '<option value="' + o[0] + '"' + (cfg.chartType === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    const dsOpts = [['LTTB', 'LTTB 最大三角形三桶'], ['AVG', '等距均值聚合'], ['NONE', '不降采样']].map(function (o) { return '<option value="' + o[0] + '"' + (cfg.downsample === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    const refOpts = [['全省均值', '全省十年均值'], ['无', '不显示参考线']].map(function (o) { return '<option value="' + esc(o[0]) + '"' + (cfg.refLine === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');

    const perfRows = [
      ['单序列点数', cfg.years + ' 点', '年度口径，远小于降采样阈值'],
      ['降采样阈值', nInt(cfg.maxPoints) + ' 点', '超过后按 ' + cfg.downsample + ' 抽样，保留极值与拐点'],
      ['服务端缓存', cfg.cacheTTL + ' 分钟', '命中立方体预计算结果，不回表扫描明细'],
      ['首屏渲染', '≈ 120 ms', '仅返回聚合后序列，载荷 < 8 KB'],
      ['最大并发序列', '5 条', '超过 5 条改用小倍数分面，避免线条混叠']
    ].map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td class="sv-nowrap"><strong>' + esc(r[1]) + '</strong></td><td>' + esc(r[2]) + '</td></tr>'; }).join('');

    return '<div class="sv-page">' + svHeader(d.trendTitle,
      '配置' + d.label + '率趋势图的展示参数并<b>支持高性能可视化</b>：序列取自预计算立方体而非明细表，配合降采样与服务端缓存保证大基数下的响应。配置保存后同时作用于本页预览、年报图表与对外发布口径。', [
      '<button class="btn btn-outline btn-sm" onclick="resetTrendCfg(\'' + d.key + '\')">恢复默认</button>',
      '<button class="btn btn-outline btn-sm" onclick="svToastMsg(\'预览图已导出 PNG\')">导出图片</button>',
      '<button class="btn btn-primary btn-sm" onclick="saveTrendCfg(\'' + d.key + '\')">保存配置</button>'
    ], true) +
      '<div class="sv-grid2">' +
      '<div class="sv-card"><div class="sv-card-head"><div class="sv-card-title">实时预览<span class="sv-card-sub">' + esc(d.measures[mIdx]) + ' · ' + esc(cfg.dimension) + ' · 近 ' + cfg.years + ' 年</span></div>' +
      '<span class="badge ' + (cfg.published ? 'badge-success' : 'badge-muted') + '">' + (cfg.published ? '已发布' : '草稿') + '</span></div>' +
      '<div class="sv-card-body">' + chart +
      '<div class="sv-note" style="margin-top:9px">纵轴' + (cfg.yZero ? '自 0 起' : '按数据范围自适应（不从 0 起，需在图注中说明以免夸大变化幅度）') + '；' + (cfg.showCI ? '首条序列附 95% 置信带。' : '未显示置信区间。') + '</div></div></div>' +
      '<div class="sv-card"><div class="sv-card-head"><div class="sv-card-title">展示参数</div></div><div class="sv-card-body"><div class="sv-form-grid">' +
      '<div class="form-group"><label>默认度量</label><select onchange="svSetTrend(\'measure\',Number(this.value))">' + measureOpts + '</select></div>' +
      '<div class="form-group"><label>对比维度</label><select onchange="svSetTrend(\'dimension\',this.value)">' + dimOpts + '</select></div>' +
      '<div class="form-group"><label>时间跨度</label><select onchange="svSetTrend(\'years\',this.value)">' + yearOpts + '</select></div>' +
      '<div class="form-group"><label>平滑方式</label><select onchange="svSetTrend(\'smooth\',this.value)">' + smoothOpts + '</select></div>' +
      '<div class="form-group"><label>图表类型</label><select onchange="svSetTrend(\'chartType\',this.value)">' + typeOpts + '</select></div>' +
      '<div class="form-group"><label>参考线</label><select onchange="svSetTrend(\'refLine\',this.value)">' + refOpts + '</select></div>' +
      '<div class="form-group"><label>降采样算法</label><select onchange="svSetTrend(\'downsample\',this.value)">' + dsOpts + '</select></div>' +
      '<div class="form-group"><label>降采样阈值（点）</label><input type="number" min="100" step="100" value="' + cfg.maxPoints + '" onchange="svSetTrend(\'maxPoints\',this.value)"></div>' +
      '<div class="form-group"><label>缓存有效期（分钟）</label><input type="number" min="0" step="5" value="' + cfg.cacheTTL + '" onchange="svSetTrend(\'cacheTTL\',this.value)"></div>' +
      '<div class="form-group full"><label class="sv-switch"><input type="checkbox" ' + (cfg.showCI ? 'checked' : '') + ' onchange="svSetTrend(\'showCI\',this.checked)">显示 95% 置信区间（小基数地区必选）</label></div>' +
      '<div class="form-group full"><label class="sv-switch"><input type="checkbox" ' + (cfg.yZero ? 'checked' : '') + ' onchange="svSetTrend(\'yZero\',this.checked)">纵轴自 0 起</label></div>' +
      '<div class="form-group full"><label class="sv-switch"><input type="checkbox" ' + (cfg.published ? 'checked' : '') + ' onchange="svSetTrend(\'published\',this.checked)">发布到年报与对外图表</label></div>' +
      '</div></div></div></div>' +
      '<div class="sv-card"><div class="sv-card-head"><div class="sv-card-title">高性能可视化保障</div></div><div class="sv-card-body">' +
      '<table class="sv-pivot" style="width:100%"><thead><tr><th>项目</th><th>当前值</th><th>说明</th></tr></thead><tbody>' + perfRows + '</tbody></table>' +
      '<div class="sv-callout" style="margin-top:11px"><strong>口径提醒：</strong>小基数地区（年例数 &lt; 20）的率值波动主要来自随机误差，建议开启置信区间并采用移动平均；单纯的年度间上下波动不构成疾病信号，信号判定以「预警监测与处置 · C 层」的连续多年趋势与空间聚集规则为准。</div>' +
      '</div></div></div>';
  }

  function saveTrendCfg(key) {
    const cfg = state.trend[key];
    if (cfg.maxPoints < 100) { svToast('降采样阈值不得低于 100 点', 'error'); return; }
    if (cfg.cacheTTL < 0) { svToast('缓存有效期不能为负', 'error'); return; }
    svToast(DOMAIN[key].label + '趋势展示参数已保存' + (cfg.published ? '并发布' : '为草稿'));
  }
  function resetTrendCfg(key) {
    state.trend[key] = { measure: 2, dimension: '地区', years: 10, smooth: 'MA3', showCI: true, refLine: '全省均值', chartType: 'line', downsample: 'LTTB', maxPoints: 800, cacheTTL: 30, yZero: false, published: true };
    svToast('已恢复默认配置');
    renderPage(state.page);
  }

  /* ==================== 页面：死亡-发病关联分析记录 ==================== */
  function renderLink() {
    const f = state.link, kw = f.keyword.trim().toLowerCase();
    const list = linkRecords.filter(function (r) {
      return (f.method === 'ALL' || r.method === f.method)
        && (f.status === 'ALL' || r.status === f.status)
        && (!kw || [r.id, r.name, r.city, r.incSite, r.underlying, r.incId, r.deathId].join(' ').toLowerCase().includes(kw));
    });
    const confirmed = linkRecords.filter(function (r) { return r.status === 'CONFIRMED'; });
    const pending = linkRecords.filter(function (r) { return r.status === 'PENDING'; }).length;
    const dcn = linkRecords.filter(function (r) { return r.status === 'DCN'; }).length;
    const survAvg = confirmed.filter(function (r) { return r.survivalDays; }).reduce(function (a, r) { return a + r.survivalDays; }, 0) / (confirmed.filter(function (r) { return r.survivalDays; }).length || 1);
    const totalDeaths = fatalityStats.reduce(function (a, s) { return a + s.deaths; }, 0);
    const totalLinked = fatalityStats.reduce(function (a, s) { return a + s.linked; }, 0);
    const kpis = [
      svKpi('关联记录', linkRecords.length, '本页展示近期人工介入样例'),
      svKpi('死亡关联率', n1(totalLinked / totalDeaths * 100) + '%', totalLinked + ' / ' + totalDeaths + ' 例（全省 2025）', totalLinked / totalDeaths < 0.9 ? 'warn' : 'ok'),
      svKpi('待人工确认', pending, '概率匹配或要素不全', pending ? 'warn' : 'ok'),
      svKpi('转死亡补发病', dcn, '库内无发病记录，须回溯', dcn ? 'danger' : 'ok'),
      svKpi('平均生存天数', nInt(Math.round(survAvg)), '仅已确认且有发病日期的记录')
    ].join('');

    const rows = list.map(function (r) {
      const consistentHtml = r.consistent === null ? '<span class="badge badge-muted">不适用</span>'
        : r.consistent ? '<span class="badge badge-success">死因与发病一致</span>'
          : '<span class="badge badge-orange">死因非本肿瘤</span>';
      return '<tr>' +
        '<td class="sv-nowrap"><button class="sv-id" onclick="showLinkDetail(\'' + r.id + '\')">' + r.id + '</button><div class="sv-sec">' + esc(r.name) + ' · ' + esc(r.sex) + '</div></td>' +
        '<td>' + esc(r.city) + '<div class="sv-sec">出生 ' + esc(r.birth) + '</div></td>' +
        '<td>' + (r.incId ? esc(r.incId) + '<div class="sv-sec">' + esc(r.incDate) + ' · ' + esc(r.incSite) + ' · ' + esc(r.incStage) + '</div>' : '<span class="badge badge-danger">无发病记录</span>') + '</td>' +
        '<td>' + esc(r.deathId) + '<div class="sv-sec">' + esc(r.deathDate) + ' · ' + esc(r.underlying) + '</div></td>' +
        '<td class="sv-nowrap">' + badge(LINK_METHOD[r.method]) + '<div class="sv-sec">' + esc(LINK_METHOD[r.method].weight) + '</div></td>' +
        '<td class="sv-nowrap">' + (r.survivalDays ? nInt(r.survivalDays) + ' 天<div class="sv-sec">≈ ' + n1(r.survivalDays / 30.44) + ' 个月</div>' : '-') + '</td>' +
        '<td class="sv-nowrap">' + consistentHtml + '</td>' +
        '<td class="sv-nowrap">' + badge(LINK_STATUS[r.status]) + '</td>' +
        '<td class="sv-nowrap"><button class="btn btn-ghost btn-xs" onclick="showLinkDetail(\'' + r.id + '\')">详情</button>' +
        (r.status === 'PENDING' ? ' <button class="btn btn-primary btn-xs" onclick="confirmLink(\'' + r.id + '\')">确认</button>' : '') + '</td>' +
        '</tr>';
    }).join('');

    const fatRows = fatalityStats.map(function (s) {
      const tone = s.mi > 0.8 ? 'bad' : s.mi > 0.6 ? 'warn' : '';
      return '<tr><td>' + esc(s.cancer) + '</td>' +
        '<td class="sv-num">' + nInt(s.cases) + '</td>' +
        '<td class="sv-num">' + nInt(s.deaths) + '</td>' +
        '<td class="sv-num">' + n2(s.mi) + bar(s.mi * 100, tone) + '</td>' +
        '<td class="sv-num">' + n1(s.linkRate) + '%</td>' +
        '<td class="sv-num">' + n1(s.medianSurvivalMonth) + '</td>' +
        '<td class="sv-num">' + n1(s.os5) + '%</td></tr>';
    }).join('');

    const methodOpts = [['ALL', '全部匹配方式']].concat(Object.keys(LINK_METHOD).map(function (k) { return [k, LINK_METHOD[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.method === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    const statusOpts = [['ALL', '全部状态']].concat(Object.keys(LINK_STATUS).map(function (k) { return [k, LINK_STATUS[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.status === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

    return '<div class="sv-page">' + svHeader('死亡-发病关联分析记录',
      '关联同一患者的发病与死亡记录，计算<b>病死率、M/I 比与生存指标</b>。匹配按身份证精确 → 姓名+出生日期+性别 → 概率匹配三级降级，概率匹配一律人工确认；死亡记录在库内找不到发病记录时转「死亡补发病（DCN）」回溯，未闭环将计入 DCO% 并触发 B 层预警。', [
      '<button class="btn btn-outline btn-sm" onclick="runLinkMatch()">重跑匹配</button>',
      '<button class="btn btn-outline btn-sm" onclick="svToastMsg(\'生存分析数据集已导出\')">导出数据集</button>',
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'warning-records\')">查看相关预警</button>'
    ]) +
      '<div class="sv-kpis">' + kpis + '</div>' +
      '<div class="sv-filter">' +
      '<div class="form-group"><label>匹配方式</label><select onchange="svSet(\'link\',\'method\',this.value)">' + methodOpts + '</select></div>' +
      '<div class="form-group"><label>关联状态</label><select onchange="svSet(\'link\',\'status\',this.value)">' + statusOpts + '</select></div>' +
      '<div class="form-group" style="grid-column:span 3"><label>检索</label><input value="' + esc(f.keyword) + '" placeholder="关联ID / 姓名 / 地区 / 报告卡号 / 死因" onchange="svSet(\'link\',\'keyword\',this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="svResetLink()">重置</button></div></div>' +
      '<div class="sv-table-wrap"><table class="sv-table"><thead><tr><th>关联ID / 患者</th><th>地区</th><th>发病记录</th><th>死亡记录</th><th>匹配方式</th><th>生存期</th><th>死因一致性</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9"><div class="sv-empty">暂无符合条件的关联记录</div></td></tr>') + '</tbody></table></div>' +
      '<div class="sv-card" style="margin-top:14px"><div class="sv-card-head"><div class="sv-card-title">病死率与生存指标<span class="sv-card-sub">2025 年 · 全省 · 按癌种</span></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="svGo(\'srv-cube\',\'DEATH\')">死亡立方体</button></div>' +
      '<div class="sv-card-body" style="overflow:auto"><table class="sv-pivot" style="width:100%"><thead><tr><th>癌种</th><th>发病例数</th><th>死亡例数</th><th>M/I 比</th><th>死亡关联率</th><th>中位生存(月)</th><th>5年生存率</th></tr></thead><tbody>' + fatRows + '</tbody></table>' +
      '<div class="sv-callout" style="margin-top:11px"><strong>口径说明：</strong>M/I 比为同期死亡数与发病数之比，非真实病死率，受登记完整性影响，其考核判定在「预警监测与处置 · B 层 B-MI-RATIO」；生存率基于已关联队列计算，死亡关联率低于 90% 时生存率会被系统性高估，须在报告中标注。</div>' +
      '</div></div></div>';
  }

  function svResetLink() { state.link = { method: 'ALL', status: 'ALL', keyword: '' }; renderPage(state.page); }
  function runLinkMatch() { svToast('已重跑死亡-发病匹配：新增待确认 0 条，DCN 任务 0 条'); renderPage(state.page); }
  function confirmLink(id) {
    const r = linkRecords.find(function (x) { return x.id === id; });
    if (!r) return;
    r.status = 'CONFIRMED';
    r.note = r.note + '（' + CURRENT_USER + ' 于 ' + fmtTime(new Date()) + ' 人工确认）';
    svToast('已确认关联：' + id);
    closeSvModals();
    renderPage(state.page);
  }
  function rejectLink(id) {
    const r = linkRecords.find(function (x) { return x.id === id; });
    if (!r) return;
    r.status = 'REJECTED';
    r.survivalDays = null;
    r.consistent = null;
    svToast('已否决关联：' + id);
    closeSvModals();
    renderPage(state.page);
  }

  function showLinkDetail(id) {
    const r = linkRecords.find(function (x) { return x.id === id; });
    if (!r) return;
    const fields = [
      ['关联ID', r.id], ['患者', r.name + ' · ' + r.sex], ['出生日期', r.birth], ['户籍地区', r.city],
      ['发病报告卡', r.incId || '无'], ['发病日期', r.incDate || '-'], ['发病部位', r.incSite || '-'],
      ['临床分期', r.incStage || '-'], ['诊断依据', r.incBasis || '-'],
      ['死亡记录', r.deathId], ['死亡日期', r.deathDate], ['根本死因', r.underlying], ['死亡地点', r.deathPlace],
      ['匹配方式', LINK_METHOD[r.method].label], ['匹配强度', LINK_METHOD[r.method].weight],
      ['关联状态', LINK_STATUS[r.status].label],
      ['生存天数', r.survivalDays ? nInt(r.survivalDays) + ' 天（≈ ' + n1(r.survivalDays / 30.44) + ' 个月）' : '-'],
      ['死因一致性', r.consistent === null ? '不适用' : r.consistent ? '死因与发病部位一致' : '死因非本肿瘤']
    ].map(function (x) { return '<div class="sv-field"><div class="sv-field-label">' + esc(x[0]) + '</div><div class="sv-value">' + esc(x[1]) + '</div></div>'; }).join('');
    const impact = r.status === 'DCN'
      ? '<div class="sv-callout warn"><strong>指标影响：</strong>该死亡记录尚无对应发病记录，已生成 DCN 回溯任务。回溯成功则补为发病病例；超期未闭环将作为"仅死亡证明来源"计入 DCO%，直接拉低 B 层可靠性指标。</div>'
      : r.consistent === false
        ? '<div class="sv-callout"><strong>指标影响：</strong>纳入全死因生存分析（分母），但不计入该癌种病死率分子，避免把非肿瘤死亡算作肿瘤致死。</div>'
        : r.status === 'PENDING'
          ? '<div class="sv-callout warn"><strong>指标影响：</strong>概率匹配结果在人工确认前不参与病死率与生存率计算，防止错误关联污染指标。</div>'
          : '<div class="sv-callout"><strong>指标影响：</strong>已纳入病死率分子、M/I 比与生存分析队列。</div>';
    const body = '<div class="sv-fields">' + fields + '</div>' +
      '<div class="sv-sect">' + impact + '</div>' +
      '<div class="sv-sect"><h4 class="sv-h">核查备注</h4><div class="sv-callout">' + esc(r.note) + '</div></div>';
    let foot = '<button class="btn btn-ghost" data-close>关闭</button>';
    if (r.status === 'PENDING') foot += '<button class="btn btn-ghost" onclick="rejectLink(\'' + r.id + '\')">否决关联</button><button class="btn btn-primary" onclick="confirmLink(\'' + r.id + '\')">确认关联</button>';
    if (r.status === 'DCN') foot += '<button class="btn btn-primary" onclick="svToastMsg(\'已推送 DCN 回溯协查任务\')">推送回溯任务</button>';
    const mask = svModal('关联记录详情 · ' + r.id, body, foot);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  /* ==================== 路由与导出 ==================== */
  function renderSurveillancePage(pageId) {
    if (!ROUTE_IDS.includes(pageId)) return null;
    closeSvModals();
    /* 旧入口 id：预设数据域后按规范页渲染，state.page 归一，后续筛选/重渲染都走新 id */
    const legacy = LEGACY_IDS[pageId];
    if (legacy) { state.domain = legacy[1]; pageId = legacy[0]; }
    state.page = pageId;
    const d = svDomain();
    if (pageId === 'srv-ingest') return renderIngest(d);
    if (pageId === 'srv-cube') return renderCube(d);
    if (pageId === 'srv-trend') return renderTrend(d);
    if (pageId === 'srv-link') return renderLink();
    return '<div class="sv-page"><div class="sv-empty">页面开发中</div></div>';
  }

  const publicApi = {
    ingestBatches, cubeMeta, facts, linkRecords, fatalityStats, DOMAIN,
    svSet, svSetTrend, svResetIngest, svResetLink, svToastMsg, closeSvModals,
    svDomain, svSetDomain, svGo, svDomainSwitch,
    showBatchDetail, retryBatch, cubeToggleDim, rebuildCube,
    saveTrendCfg, resetTrendCfg, showLinkDetail, confirmLink, rejectLink, runLinkMatch,
    renderSurveillancePage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = publicApi;
  if (typeof window !== 'undefined') {
    Object.assign(window, publicApi);
    window.surveillancePageIds = ROUTE_IDS.slice();
  }



})();
