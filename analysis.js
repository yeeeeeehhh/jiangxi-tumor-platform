/* analysis.js — 数据分析模块（完整交互版） */
(function () {
  'use strict';

  var PAGES = {
    'analysis-burden': { title: '疾病统计' },
    'analysis-progress': { title: '报卡工作量' },
    'analysis-quality': { title: '报卡质量监测' },
    'report-files': { title: '报表文件库' }
  };

  var DEFAULTS = {
    page: 'analysis-burden',
    event: '发病',
    metric: '数量',
    dimension: '部位',
    ageFilters: ['all'],
    ageOpen: false,
    cellMetric: '发病率', // 默认发病率 | 发病数 | 死亡数 | 死亡率
    resultAsChart: false,
    group: 'region',
    region: '江西省',
    scope: '按患者户籍地',
    cardRange: '有效报卡',
    dateType: '确诊日期',
    dateStart: '2026-01-01',
    dateEnd: '2026-12-31',
    dateRangeOpen: false,
    datePreset: '本年',
    year: '2026',
    sex: '合计',
    disease: ['all'],
    diseaseOpen: false,
    chartsCollapsed: false,
    highlight: '',
    onlyAbnormal: false,
    abnormalSite: null,
    qualityTab: 'process',
    crossTpl: 'site_sex',
    crossRow: 'ICD',
    crossCol: '性别',
    crossDateType: '上报日期',
    crossRange: '有效报卡',
    crossIcd: 'ICD-10（明细类）',
    crossAge: '5岁组',
    crossDateStart: '2025-01-01',
    crossDateEnd: '2025-12-31',
    showCompare: false,
    queried: true,
    fileKeyword: '',
    fileDateStart: '2026-01-01',
    fileDateEnd: '2026-06-30',
    previewId: null,
    uploadOpen: false,
    fileSelectedIds: []
  };

  var state = Object.assign({}, DEFAULTS);

  var SITES = [
    { id: 'C50', name: 'C50 乳腺', inc: 1268, death: 218, mv: 1148, dco: 16, ub: 9 },
    { id: 'C34', name: 'C34 肺', inc: 1562, death: 796, mv: 1132, dco: 101, ub: 21 },
    { id: 'C16', name: 'C16 胃', inc: 1017, death: 372, mv: 745, dco: 61, ub: 18 },
    { id: 'C18', name: 'C18 结肠', inc: 846, death: 214, mv: 669, dco: 28, ub: 10 },
    { id: 'C22', name: 'C22 肝', inc: 734, death: 348, mv: 468, dco: 82, ub: 14 },
    { id: 'C80', name: 'C80 原发部位不明', inc: 52, death: 44, mv: 6, dco: 18, ub: 28 }
  ];
  // 国家癌症中心 / IARC 登记质量纳入参考阈值（全部恶性肿瘤合计口径）
  var QC_THRESH = {
    mvMin: 66,
    hvMin: 60,
    dcoMax: 15,
    miMin: 0.6,
    miMax: 0.8,
    ubMax: 5,
    ouMax: 5,
    ageUnkMax: 1,
    sexUnkMax: 0.5,
    morphUnkMax: 10,
    site9Max: 25,
    stageMissMax: 40,
    tnmMissMax: 45,
    lostMax: 20,
    timelyMin: 80,
    delayDaysMax: 30,
    dupMax: 3,
    auditPassMin: 85,
    deathMatchMin: 70,
    icdConsistMin: 95,
    followCompleteMin: 80
  };
  /* 各部位粗率相对近三年均值的偏离幅度（mock）：正值=高于基线，负值=低于基线；null=不参与率值预警 */
  var RATE_DEV = {
    'C50 乳腺': { inc: 0.23, mor: 0.08 },
    'C34 肺': { inc: 0.06, mor: 0.31 },
    'C16 胃': { inc: -0.02, mor: -0.27 },
    'C18 结肠': { inc: 0.28, mor: 0.11 },
    'C22 肝': { inc: -0.31, mor: -0.19 },
    'C80 原发部位不明': null,
    '全癌种合计': { inc: 0.12, mor: 0.09 }
  };
  var AGE_LABELS = [
    '0-4岁', '5-9岁', '10-14岁', '15-19岁', '20-24岁', '25-29岁',
    '30-34岁', '35-39岁', '40-44岁', '45-49岁', '50-54岁', '55-59岁',
    '60-64岁', '65-69岁', '70-74岁', '75-79岁', '80-84岁', '85岁及以上'
  ];
  // 发病/死亡随年龄升高的示意权重；人口结构示意权重（均已归一）
  var AGE_SHARE = [
    0.002, 0.004, 0.006, 0.010, 0.015, 0.022,
    0.030, 0.040, 0.050, 0.060, 0.075, 0.090,
    0.100, 0.110, 0.115, 0.100, 0.055, 0.016
  ];
  var AGE_POP = [
    0.055, 0.057, 0.060, 0.064, 0.068, 0.071,
    0.074, 0.071, 0.068, 0.066, 0.064, 0.060,
    0.055, 0.049, 0.044, 0.033, 0.022, 0.019
  ];
  // Segi's 世界标准人口（IARC / 国家癌症中心世标率，合计 100000）
  var SEGI_W = [
    12000, 10000, 9000, 9000, 8000, 8000,
    6000, 6000, 6000, 6000, 5000, 4000,
    4000, 3000, 2000, 1000, 500, 500
  ];
  // 2000 年中国标准人口（国家癌症中心中标率，合计约 100000）
  var CN2000_W = [
    7015, 7523, 8491, 8559, 7598, 7559,
    8212, 8870, 8120, 7302, 5911, 4578,
    3388, 2657, 1948, 1328, 712, 345
  ];
  var CUM_AGE_END = 14; // 0-74 岁对应 0-4 … 70-74（15 个五岁组）
  var BASE_POP = 9823000;
  var DISEASES = [
    { id: 'all', label: '全部肿瘤' },
    { id: 'digestive', label: '消化系统' },
    { id: 'C16', label: 'C16 胃' },
    { id: 'C18', label: 'C18 结肠' },
    { id: 'C22', label: 'C22 肝' },
    { id: 'C34', label: 'C34 肺' },
    { id: 'C50', label: 'C50 乳腺' }
  ];
  var REGION_FACTOR = { '江西省': 1, '南昌市': 0.42, '赣州市': 0.28, '九江市': 0.18 };
  var YEAR_FACTOR = { '2026': 1.02, '2025': 1, '2024': 0.94, '2023': 0.88 };
  var SEX_FACTOR = { '合计': 1, '男': 0.54, '女': 0.46 };
  var RANGE_FACTOR = { '有效报卡': 1, '全部报卡': 1.12 };
  var DATETYPE_FACTOR = { '确诊日期': 1, '上报日期': 1.04, '死亡日期': 0.97 };

  var reportFiles = [
    { id: 1, fileName: '2025年度江西省肿瘤发病死亡报表.pdf', org: '江西省肿瘤登记中心', pages: 42, uploadTime: '2026-03-12 10:22', remark: '省级汇总' },
    { id: 2, fileName: '南昌市2025年报卡完整性专题.pdf', org: '南昌市肿瘤登记中心', pages: 18, uploadTime: '2026-04-08 15:40', remark: '' },
    { id: 3, fileName: '赣州市月报卡趋势分析.pdf', org: '赣州市肿瘤登记中心', pages: 11, uploadTime: '2026-05-21 09:05', remark: '内部参阅' }
  ];
  var nextFileId = 4;

  function injectStyles() {
    var style = document.getElementById('da-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'da-styles';
      document.head.appendChild(style);
    }
    style.textContent = [
      '.da-page{display:flex;flex-direction:column;gap:12px}',
      '.da-scope,.da-viz-bar{display:none!important}',
      '.da-progress-viz-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:4px 0 10px}',
      '.da-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}',
      '.da-head h3{margin:0;font-size:17px;font-weight:700;color:#1e293b}',
      '.da-head p{margin:2px 0 0;font-size:12px;color:#94a3b8}',
      '.da-filter{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 8px;padding:10px 12px;background:#f8fafc;border:1px solid var(--border);border-radius:6px}',
      '.da-filter .form-group,.da-field{display:flex;flex-direction:column;gap:3px;margin:0;min-width:0;flex:0 0 auto}',
      '.da-filter .form-group{width:108px}',
      '.da-filter .form-group.search-group{width:300px;flex:1 1 220px;max-width:100%}',
      '.da-filter .form-group.wide{width:132px;flex:0 0 132px}',
      '.da-table-tools{display:flex;align-items:center;gap:12px;margin:4px 0 8px;flex-wrap:wrap}',
      '.da-table-tools .btn{height:28px;padding:0 12px;font-size:12px}',
      '.da-result-chart{display:grid;grid-template-columns:1fr;gap:12px}',
      '.da-result-chart.dual{grid-template-columns:1fr 1fr}',
      '.da-heat-scroll{overflow:auto;max-width:100%}',
      '.da-heat-scroll .da-heat{min-width:720px}',
      '.da-check-box{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#334155;white-space:nowrap;cursor:pointer}',
      '.da-check-box input[type=checkbox]{width:15px;height:15px;accent-color:var(--primary);cursor:pointer;margin:0}',
      '.da-filter .form-group.period-field{width:196px;flex:0 0 196px;position:relative;overflow:visible}',
      '.da-filter .form-group.disease-multi,.da-filter .form-group.age-multi{width:120px;flex:0 0 120px;position:relative;overflow:visible}',
      '.da-filter select,.da-filter input:not([type=checkbox]):not([type=radio]){width:100%!important;max-width:100%;box-sizing:border-box;height:32px;padding:0 8px;font-size:13px}',
      '.da-dr{position:relative;width:100%}',
      '.da-dr-input{width:100%;height:32px;padding:0 28px 0 8px;border:1px solid #d1d8e0;border-radius:4px;background:#fff;color:#1f2937;cursor:pointer;display:flex;align-items:center;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box}',
      '.da-dr-input:hover,.da-dr.open .da-dr-input{border-color:var(--primary)}',
      '.da-dr-arrow{position:absolute;right:10px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;font-size:12px}',
      '.da-dr.open .da-dr-arrow{transform:translateY(-50%) rotate(180deg)}',
      '.da-dr-panel{display:none;position:absolute;left:0;top:calc(100% + 4px);z-index:50;width:340px;background:#fff;border:1px solid #d1d8e0;border-radius:6px;box-shadow:0 8px 24px rgba(15,23,42,.12);padding:12px;box-sizing:border-box}',
      '.da-dr.open .da-dr-panel{display:block}',
      '.da-dr-presets{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}',
      '.da-dr-preset{padding:4px 10px;border:1px solid #e2e8f0;border-radius:4px;background:#fff;color:#475569;cursor:pointer;font-size:12px}',
      '.da-dr-preset:hover{background:var(--primary-soft);color:var(--primary);border-color:var(--primary)}',
      '.da-dr-preset.active{background:var(--primary);border-color:var(--primary);color:#fff}',
      '.da-dr-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
      '.da-dr-row label{font-size:12px;color:#64748b;width:32px;flex:0 0 32px}',
      '.da-dr-row input[type=date]{flex:1;width:auto!important;max-width:none;height:32px;padding:0 8px;border:1px solid #d1d8e0;border-radius:4px;font-size:13px;box-sizing:border-box}',
      '.da-dr-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}',
      '.da-multi-btn{width:100%;height:32px;padding:0 28px 0 8px;border:1px solid #d1d8e0;border-radius:4px;background:#fff url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2364748b\' d=\'M3 4.5L6 8l3-3.5\'/%3E%3C/svg%3E") no-repeat right 8px center;font-size:13px;color:#1e293b;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.da-multi-btn:hover,.da-multi-btn.open{border-color:var(--primary)}',
      '.da-multi-panel{position:absolute;left:0;top:calc(100% + 4px);z-index:50;min-width:240px;width:max-content;max-width:320px;background:#fff;border:1px solid #d1d8e0;border-radius:6px;box-shadow:0 8px 24px rgba(15,23,42,.12);padding:6px 0;max-height:280px;overflow:auto}',
      '.da-multi-item{display:flex!important;flex-direction:row!important;align-items:center;gap:8px;padding:8px 12px;margin:0;font-size:13px;font-weight:400;color:#334155;cursor:pointer;white-space:nowrap;line-height:1.3}',
      '.da-multi-item span{flex:1 1 auto;min-width:0;white-space:nowrap;writing-mode:horizontal-tb;text-orientation:mixed}',
      '.da-filter .form-group.disease-multi .da-multi-item input[type=checkbox],.da-filter .form-group.age-multi .da-multi-item input[type=checkbox]{width:14px!important;height:14px!important;min-width:14px;max-width:14px;margin:0;padding:0;flex:0 0 14px;border:1px solid #cbd5e1;border-radius:3px;accent-color:var(--primary);cursor:pointer}',
      '.da-multi-item:hover{background:#f1f5f9}',
      '.da-multi-hint{padding:4px 12px 8px;font-size:11px;color:#94a3b8;white-space:normal;line-height:1.4}',
      '.da-field{flex:0 0 auto}',
      '.da-seg{display:inline-flex;height:32px;border:1px solid #d1d8e0;border-radius:4px;overflow:hidden;background:#fff;flex:0 0 auto}',
      '.da-filter .form-group label,.da-field>label,.da-field>.da-label{font-size:12px;color:#64748b;line-height:1.2;white-space:nowrap}',
      '.da-seg button{height:32px;padding:0 12px;border:0;border-right:1px solid #d1d8e0;background:#fff;color:#475569;font-size:12px;cursor:pointer;white-space:nowrap}',
      '.da-seg button:last-child{border-right:0}',
      '.da-seg button:hover{background:#f8fafc;color:var(--primary)}',
      '.da-seg button.active{background:var(--primary);color:#fff}',
      '.da-actions{display:flex;gap:6px;margin-left:auto;align-items:center;padding-bottom:0}',
      '.da-actions .btn{height:32px}',
      '.da-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}',
      '.da-kpi{padding:10px 12px;border:1px solid var(--border);border-radius:6px;background:#fff}',
      '.da-kpi-label{font-size:11px;color:#64748b;margin-bottom:2px}',
      '.da-kpi-value{font-size:18px;font-weight:700;color:var(--primary)}',
      '.da-kpi-sub{font-size:11px;color:#94a3b8;margin-top:1px}',
      '.da-rate{display:inline;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.da-rate-unit{font-size:11px;color:#94a3b8;font-weight:500;margin-left:1px}',
      '.da-kpi-value .da-rate{display:inline-block}',
      '.da-kpi.clickable{cursor:pointer}',
      '.da-kpi.clickable:hover{border-color:var(--primary)}',
      '.da-kpi-strip{display:flex;flex-wrap:wrap;align-items:center;gap:6px 28px;padding:8px 14px;border:1px solid var(--border);border-radius:6px;background:#f8fafc}',
      '.da-kpi-strip .da-kpi-item{display:inline-flex;align-items:baseline;gap:6px}',
      '.da-kpi-strip .da-kpi-label{font-size:12px;color:#64748b;margin:0}',
      '.da-kpi-strip .da-kpi-value{font-size:15px;font-weight:700;color:var(--primary)}',
      '.da-kpi-strip .da-kpi-sub{font-size:11px;color:#94a3b8;margin:0}',
      '.da-viz-bar{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}',
      '.da-viz{display:grid;grid-template-columns:1.35fr 1fr;gap:12px}',
      '.da-viz.hidden{display:none}',
      '.da-chart{border:1px solid var(--border);border-radius:6px;background:#fff;padding:10px 12px}',
      '.da-chart h4{margin:0 0 8px;font-size:13px;font-weight:600;color:#475569}',
      '.da-hbar{display:flex;flex-direction:column;gap:7px}',
      '.da-hbar-row{display:grid;grid-template-columns:92px 1fr 52px;gap:8px;align-items:center;cursor:pointer;padding:2px 4px;border-radius:4px}',
      '.da-hbar-row:hover,.da-hbar-row.active{background:var(--primary-soft)}',
      '.da-hbar-label{font-size:12px;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.da-hbar-track{height:12px;background:#eef2f7;border-radius:999px;overflow:hidden}',
      '.da-hbar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#5b8def,var(--primary))}',
      '.da-hbar-val{font-size:11px;color:var(--primary);font-weight:600;text-align:right}',
      '.da-vline{display:flex;align-items:flex-end;gap:3px;height:150px;padding-top:8px;border-bottom:1px solid #e2e8f0}',
      '.da-vline-col{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;cursor:pointer}',
      '.da-vline-col:hover .da-vline-bar,.da-vline-col.active .da-vline-bar{outline:2px solid rgba(61,90,128,.35)}',
      '.da-vline-bar{width:100%;max-width:18px;min-height:2px;border-radius:3px 3px 0 0;background:linear-gradient(180deg,#5b8def,var(--primary))}',
      '.da-vline-lab{font-size:9px;color:#64748b;transform:rotate(-40deg);transform-origin:center top;white-space:nowrap;margin-top:10px;height:28px}',
      '.da-heat{display:grid;gap:3px}',
      '.da-heat-cell{min-height:28px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;cursor:default}',
      '.da-heat-cell.clickable{cursor:pointer}',
      '.da-quality-tabs{display:flex;gap:0;margin-bottom:12px;border:1px solid var(--border);border-radius:6px;overflow:hidden;background:#fff;width:fit-content;max-width:100%}',
      '.da-quality-tabs button{height:36px;padding:0 16px;border:0;border-right:1px solid var(--border);background:#fff;color:#64748b;font-size:13px;cursor:pointer}',
      '.da-quality-tabs button:last-child{border-right:0}',
      '.da-quality-tabs button:hover{color:var(--primary);background:#f8fafc}',
      '.da-quality-tabs button.active{background:var(--primary);color:#fff}',
      '.da-gauge-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}',
      '.da-gauge{padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:#f8fafc;cursor:pointer}',
      '.da-gauge:hover{border-color:var(--primary)}',
      '.da-gauge-label{font-size:12px;color:#64748b}',
      '.da-gauge-val{font-size:20px;font-weight:700;margin-top:2px}',
      '.da-gauge-bar{margin-top:6px;height:6px;background:#e5e7eb;border-radius:999px;overflow:hidden}',
      '.da-gauge-fill{height:100%;border-radius:999px}',
      '.da-tone-ok{color:#2e7d32}.da-tone-warn{color:#8a6100}.da-tone-bad{color:#b42335}',
      '.da-table-wrap .data-table.da-files-table{width:100%!important;min-width:760px!important;table-layout:auto}',
      '.da-table-wrap{overflow:auto;max-height:560px;border:1px solid var(--border);border-radius:6px}',
      '.da-table-wrap .data-table{width:max-content!important;min-width:0!important;max-width:none;margin:0;font-size:13px;border-collapse:separate;border-spacing:0;table-layout:auto}',
      '.da-table-wrap th,.da-table-wrap td{white-space:nowrap;padding:10px 16px!important;height:auto!important;min-height:40px;line-height:1.45;vertical-align:middle;border-bottom:1px solid #eef2f7;width:auto!important}',
      '.da-table-wrap th{font-weight:600;color:#475569;background:#f8fafc;border-bottom:1px solid #e2e8f0}',
      '.da-table-wrap th.num,.da-table-wrap td.num{text-align:right;font-variant-numeric:tabular-nums;padding-left:14px!important;padding-right:16px!important;min-width:52px}',
      '.da-table-wrap th.idx,.da-table-wrap td.idx{text-align:center;width:1%!important;padding-left:14px!important;padding-right:14px!important;color:#64748b}',
      '.da-table-wrap .sticky{position:sticky;left:0;z-index:3;background:#f8fafc;font-weight:600;text-align:left;padding-left:16px!important;padding-right:20px!important;min-width:128px;box-shadow:2px 0 0 #eef2f7}',
      '.da-table-wrap td.sticky{background:#fff}',
      '.da-table-wrap .sticky-inc{position:sticky;left:128px;z-index:3;background:#f8fafc;box-shadow:2px 0 0 #eef2f7}',
      '.da-table-wrap td.sticky-inc{background:#fff;font-weight:600}',
      '.da-table-wrap tr.row-hl td{background:#e8f2ff!important}',
      '.da-table-wrap.compact .data-table{min-width:100%!important}',
      '.da-table-wrap.compact th,.da-table-wrap.compact td{padding:8px 10px!important}',
      '.da-table-wrap.compact th.num,.da-table-wrap.compact td.num{min-width:0;padding-left:8px!important;padding-right:10px!important}',
      '.da-table-wrap tr.row-hl td.sticky,.da-table-wrap tr.row-hl td.sticky-inc{background:#e8f2ff!important}',
      '.da-table-wrap tr.row-click{cursor:pointer}',
      '.da-table-wrap tr.row-click:hover td{background:#f1f7ff}',
      '.da-table-wrap tr.row-click:hover td.sticky,.da-table-wrap tr.row-click:hover td.sticky-inc{background:#f1f7ff}',
      '.da-table-wrap tr.total td{background:#e8f2ff;font-weight:700}',
      '.da-table-wrap tr.total td.sticky,.da-table-wrap tr.total td.sticky-inc{background:#e8f2ff}',
      '.da-table-hint{font-size:12px;color:#86909c;margin:0 0 8px}',
      '.da-meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;color:#64748b;align-items:center}',
      '.da-tpl{display:flex;flex-wrap:wrap;gap:6px}',
      '.da-tpl button{padding:5px 10px;border:1px solid #e2e8f0;border-radius:4px;background:#fff;color:#475569;font-size:12px;cursor:pointer}',
      '.da-tpl button.active{background:var(--primary);border-color:var(--primary);color:#fff}',
      '.da-combo-card{border:1px solid #dbe4ef;border-radius:8px;background:linear-gradient(180deg,#f7fbff,#fff);padding:12px 14px;margin-bottom:10px}',
      '.da-combo-title{font-size:15px;font-weight:700;color:#1e293b;margin-bottom:10px}',
      '.da-combo-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
      '.da-combo-label{font-size:11px;color:#64748b}',
      '.da-combo-val{font-size:20px;font-weight:700;color:var(--primary);margin-top:2px}',
      '.da-combo-val.accent{color:#b42335}',
      '.da-combo-tip{margin-top:8px;font-size:12px;color:#64748b}',
      '.da-empty{padding:48px 20px;text-align:center;color:#94a3b8;border:1px dashed #d0d5dd;border-radius:8px;background:#fff}',
      '.da-mi{font-variant-numeric:tabular-nums}',
      '.da-mi-watch{color:#b45309;font-weight:700}',
      '.da-mi-bad{color:#b42335;font-weight:700}',
      '.da-dim{color:#cbd5e1}',
      '.da-table-wrap tr.da-row-abn td{border-bottom:0}',
      '.da-table-wrap tr.da-row-abn td.sticky{border-left:3px solid #b42335}',
      '.da-table-wrap tr.da-row-watch td.sticky{border-left:3px solid #d97706}',
      '.da-table-wrap tr.da-abn-line td{background:#fdecef!important;height:28px;padding:2px 12px;border-left:3px solid #b42335}',
      '.da-abn-reason{font-size:12px;font-weight:600;color:#b42335;cursor:pointer}',
      '.da-abn-site{font-weight:700;color:#1e293b;margin-right:6px}',
      '.da-abn-reason:hover{text-decoration:underline}',
      '.da-abn-go{display:inline-block;margin-left:14px;padding:1px 10px;border-radius:4px;border:none;background:#b42335;color:#fff;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;vertical-align:1px}',
      '.da-abn-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}',
      '.da-abn-k{font-size:11px;color:#64748b;margin-bottom:2px}',
      '.da-abn-v{font-size:13px;color:#1e293b;font-weight:600;line-height:1.5}',
      '.da-modal{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}',
      '.da-modal-box{background:#fff;border-radius:10px;width:min(720px,100%);max-height:90vh;overflow:auto;box-shadow:0 16px 40px rgba(15,23,42,.25)}',
      '.da-modal-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border)}',
      '.da-modal-head h4{margin:0;font-size:16px}',
      '.da-modal-body{padding:18px}',
      '.da-modal-actions{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--border)}',
      '.da-preview-sheet{min-height:280px;border:1px solid #e2e8f0;border-radius:8px;background:linear-gradient(180deg,#f8fafc,#eef2f7);padding:24px;color:#334155}',
      '.da-preview-sheet h5{margin:0 0 10px;font-size:18px}',
      '.da-upload-drop{border:1px dashed #9aa8b6;border-radius:8px;padding:28px;text-align:center;background:#f8fafc;cursor:pointer}',
      '.da-upload-drop:hover{border-color:var(--primary);background:#f1f7ff}',
      '@media(max-width:1100px){.da-filter .form-group{width:100px}.da-filter .form-group.disease-multi,.da-filter .form-group.age-multi{width:108px;flex-basis:108px}.da-viz{grid-template-columns:1fr}.da-result-chart.dual{grid-template-columns:1fr}.da-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.da-combo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media(max-width:680px){.da-filter .form-group,.da-filter .form-group.wide{width:100%;flex:1 1 100%}.da-actions{margin-left:0;width:100%;justify-content:flex-end}.da-kpis{grid-template-columns:1fr 1fr}}'
    ].join('');
  }

  function num(n) { return Math.round(n).toLocaleString('zh-CN'); }
  /** 粗发病率/粗死亡率：例数 ÷ 人口 × 100000，单位 /10万（国家肿瘤登记 / IARC） */
  function crudeRate(n, d) {
    if (!d) return NaN;
    return n / d * 100000;
  }
  function fmtRate(v, digits) {
    if (v == null || isNaN(v)) return '—';
    return Number(v).toFixed(digits == null ? 2 : digits);
  }
  function rateHtml(v) {
    return '<span class="da-rate">' + fmtRate(v) + '<span class="da-rate-unit">/10万</span></span>';
  }
  function rate(n, d) {
    return rateHtml(crudeRate(n, d));
  }
  /** 年龄标化率 ASR = Σ(年龄别率 × 标准人口权重) / Σ权重 */
  function asr(ageRates, weights) {
    var numr = 0;
    var den = 0;
    for (var i = 0; i < ageRates.length; i++) {
      var w = weights[i] || 0;
      numr += (ageRates[i] || 0) * w;
      den += w;
    }
    return den ? numr / den : NaN;
  }
  /** 0–74 岁累积率（%）= Σ(年龄别率×组距5) / 1000，与年报一致 */
  function cumRate074(ageRates) {
    var sum = 0;
    for (var i = 0; i <= CUM_AGE_END && i < ageRates.length; i++) {
      sum += (ageRates[i] || 0) * 5;
    }
    return sum / 1000;
  }
  function ageRateSeries(getSlice, kind) {
    return AGE_LABELS.map(function (_, i) {
      var sl = getSlice(i);
      var n = kind === '死亡' ? sl.death : sl.inc;
      return crudeRate(n, sl.pop);
    });
  }
  function rateBundle(getSlice, kind) {
    var series = ageRateSeries(getSlice, kind);
    var totalN = 0;
    var totalP = 0;
    AGE_LABELS.forEach(function (_, i) {
      var sl = getSlice(i);
      totalN += kind === '死亡' ? sl.death : sl.inc;
      totalP += sl.pop;
    });
    return {
      count: totalN,
      crude: crudeRate(totalN, totalP),
      cn: asr(series, CN2000_W),
      world: asr(series, SEGI_W),
      cum: cumRate074(series),
      series: series
    };
  }
  function esc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
  function htmlEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function factor() {
    var y = String(state.dateStart || state.year || '2025').slice(0, 4);
    var days = 365;
    if (state.dateStart && state.dateEnd) {
      var a = new Date(state.dateStart.replace(/-/g, '/'));
      var b = new Date(state.dateEnd.replace(/-/g, '/'));
      if (!isNaN(a.getTime()) && !isNaN(b.getTime()) && b >= a) {
        days = Math.max(1, Math.round((b - a) / 86400000) + 1);
      }
    }
    return (REGION_FACTOR[state.region] || 1) * (YEAR_FACTOR[y] || 1) *
      (SEX_FACTOR[state.sex] || 1) * (RANGE_FACTOR[state.cardRange] || 1) *
      (DATETYPE_FACTOR[state.dateType] || 1) *
      Math.min(1.2, days / 365);
  }

  function popBase() {
    return Math.round(BASE_POP * (REGION_FACTOR[state.region] || 1) * (SEX_FACTOR[state.sex] === 1 ? 1 : SEX_FACTOR[state.sex] || 1));
  }

  function scaleSites() {
    var f = factor();
    return filteredSites().map(function (s) {
      return {
        id: s.id,
        name: s.name,
        inc: Math.max(1, Math.round(s.inc * f)),
        death: Math.max(0, Math.round(s.death * f)),
        mv: Math.max(0, Math.round(s.mv * f)),
        dco: Math.max(0, Math.round(s.dco * f)),
        ub: Math.max(0, Math.round(s.ub * f))
      };
    });
  }

  function seg(items, current, key) {
    return '<div class="da-seg">' + items.map(function (item) {
      var value = typeof item === 'string' ? item : item.value;
      var label = typeof item === 'string' ? item : item.label;
      return '<button type="button" class="' + (value === current ? 'active' : '') + '" onclick="DA.set(\'' + key + '\',\'' + esc(value) + '\')">' + label + '</button>';
    }).join('') + '</div>';
  }

  function actions(extraBtns) {
    return '<div class="da-actions">' + (extraBtns || '') +
      '<button class="btn btn-ghost btn-sm" onclick="DA.reset()">重置</button>' +
      '<button class="btn btn-primary btn-sm" onclick="DA.query()">查询</button>' +
      '<button class="btn btn-outline btn-sm" onclick="DA.export()">导出</button></div>';
  }

  function commonFields(opts) {
    opts = opts || {};
    var rest = selectField('病例归属', 'scope', ['按患者户籍地', '按报告单位所在地'], 'wide') +
      periodField() +
      selectField('性别', 'sex', ['合计', '男', '女']);
    if (opts.omitRegion) return rest;
    return selectField('行政区划', 'region', ['江西省', '南昌市', '赣州市', '九江市']) + rest;
  }

  function burdenFilter() {
    return '<div class="da-filter">' + diseasePicker() +
      selectField('行政区划', 'region', ['江西省', '南昌市', '赣州市', '九江市']) +
      agePicker() +
      selectField('统计指标', 'cellMetric', ['发病数', '发病率', '死亡数', '死亡率', '死亡发病比(M/I)']) +
      selectField('日期类型', 'dateType', ['确诊日期', '上报日期', '死亡日期']) +
      ((state.cellMetric === '死亡发病比(M/I)' || state.cellMetric === '发病率' || state.cellMetric === '死亡率')
        ? '<div class="form-group"><label>异常筛选</label><select onchange="DA.set(\'onlyAbnormal\',this.value)"><option value="false"' + (state.onlyAbnormal ? '' : ' selected') + '>全部部位</option><option value="true"' + (state.onlyAbnormal ? ' selected' : '') + '>只看异常</option></select></div>'
        : '') +
      commonFields({ omitRegion: true }) + actions() + '</div>';
  }

  function selectField(label, key, options, sizeClass) {
    return '<div class="form-group' + (sizeClass ? ' ' + sizeClass : '') + '"><label>' + label + '</label><select onchange="DA.set(\'' + key + '\',this.value)">' +
      options.map(function (o) {
        var value = typeof o === 'string' ? o : o.value;
        var text = typeof o === 'string' ? o : o.label;
        return '<option value="' + htmlEsc(value) + '"' + (state[key] === value ? ' selected' : '') + '>' + htmlEsc(text) + '</option>';
      }).join('') + '</select></div>';
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function presetRange(key) {
    var now = new Date(2026, 6, 20);
    var y = now.getFullYear();
    var m = now.getMonth();
    var map = {
      '本年': [new Date(y, 0, 1), new Date(y, 11, 31)],
      '去年': [new Date(y - 1, 0, 1), new Date(y - 1, 11, 31)],
      '上半年': [new Date(y, 0, 1), new Date(y, 5, 30)],
      '下半年': [new Date(y, 6, 1), new Date(y, 11, 31)],
      '本季度': (function () {
        var q = Math.floor(m / 3);
        return [new Date(y, q * 3, 1), new Date(y, q * 3 + 3, 0)];
      })(),
      '本月': [new Date(y, m, 1), new Date(y, m + 1, 0)]
    };
    return map[key] || null;
  }

  function periodField() {
    var text = (state.dateStart && state.dateEnd) ? (state.dateStart + ' ~ ' + state.dateEnd) : '请选择日期区间';
    var presets = ['本年', '去年', '上半年', '下半年', '本季度', '本月'];
    return '<div class="form-group period-field" data-da-period>' +
      '<label>统计时间</label>' +
      '<div class="da-dr' + (state.dateRangeOpen ? ' open' : '') + '">' +
      '<div class="da-dr-input" onclick="event.stopPropagation();DA.toggleDateRange()">' + htmlEsc(text) + '</div>' +
      '<span class="da-dr-arrow">▾</span>' +
      (state.dateRangeOpen
        ? '<div class="da-dr-panel" onclick="event.stopPropagation()">' +
          '<div class="da-dr-presets">' + presets.map(function (p) {
            return '<button type="button" class="da-dr-preset' + (state.datePreset === p ? ' active' : '') +
              '" onclick="DA.applyDatePreset(\'' + p + '\')">' + p + '</button>';
          }).join('') + '</div>' +
          '<div class="da-dr-row"><label>开始</label><input type="date" value="' + htmlEsc(state.dateStart) +
          '" onchange="DA.draftDate(\'dateStart\',this.value)"></div>' +
          '<div class="da-dr-row"><label>结束</label><input type="date" value="' + htmlEsc(state.dateEnd) +
          '" onchange="DA.draftDate(\'dateEnd\',this.value)"></div>' +
          '<div class="da-dr-actions">' +
          '<button type="button" class="btn btn-ghost btn-xs" onclick="DA.closeDateRange()">取消</button>' +
          '<button type="button" class="btn btn-primary btn-xs" onclick="DA.confirmDateRange()">确定</button>' +
          '</div></div>'
        : '') +
      '</div></div>';
  }

  function diseaseIds() {
    if (Array.isArray(state.disease)) return state.disease.slice();
    return state.disease ? [state.disease] : ['all'];
  }

  function diseaseLabel() {
    var ids = diseaseIds();
    if (!ids.length || ids.indexOf('all') >= 0) return '全部肿瘤';
    var labels = ids.map(function (id) {
      var hit = DISEASES.find(function (d) { return d.id === id; });
      return hit ? hit.label : id;
    });
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return labels[0] + '、' + labels[1];
    return labels[0] + '等' + labels.length + '项';
  }

  function diseasePicker() {
    var ids = diseaseIds();
    var open = state.diseaseOpen;
    return '<div class="form-group disease-multi" data-da-disease>' +
      '<label>疾病范围 <span class="required">*</span></label>' +
      '<button type="button" class="da-multi-btn' + (open ? ' open' : '') + '" onclick="event.stopPropagation();DA.toggleDiseasePanel()">' +
      htmlEsc(diseaseLabel()) + '</button>' +
      (open
        ? '<div class="da-multi-panel" onclick="event.stopPropagation()">' +
          '<div class="da-multi-hint">可多选；选「全部肿瘤」将清空其他项</div>' +
          DISEASES.map(function (d) {
            var checked = ids.indexOf(d.id) >= 0;
            return '<label class="da-multi-item"><input type="checkbox"' + (checked ? ' checked' : '') +
              ' onchange="DA.toggleDisease(\'' + d.id + '\')"><span>' + htmlEsc(d.label) + '</span></label>';
          }).join('') +
          '</div>'
        : '') +
      '</div>';
  }

  function ageFilterIds() {
    if (Array.isArray(state.ageFilters) && state.ageFilters.length) return state.ageFilters.slice();
    if (state.ageFilter && state.ageFilter !== '全部') return [state.ageFilter];
    return ['all'];
  }

  function isAllAges() {
    var ids = ageFilterIds();
    return !ids.length || ids.indexOf('all') >= 0 || ids.length >= AGE_LABELS.length;
  }

  function selectedAgeIndices() {
    if (isAllAges()) return AGE_LABELS.map(function (_, i) { return i; });
    return ageFilterIds().map(function (label) {
      return AGE_LABELS.indexOf(label);
    }).filter(function (i) { return i >= 0; }).sort(function (a, b) { return a - b; });
  }

  function ageFilterLabel() {
    if (isAllAges()) return '全部年龄';
    var ids = ageFilterIds();
    if (ids.length === 1) return ids[0];
    if (ids.length === 2) return ids[0] + '、' + ids[1];
    return ids[0] + '等' + ids.length + '组';
  }

  function agePicker() {
    var ids = ageFilterIds();
    var open = state.ageOpen;
    var allOn = isAllAges();
    return '<div class="form-group age-multi" data-da-age>' +
      '<label>年龄组</label>' +
      '<button type="button" class="da-multi-btn' + (open ? ' open' : '') + '" onclick="event.stopPropagation();DA.toggleAgePanel()">' +
      htmlEsc(ageFilterLabel()) + '</button>' +
      (open
        ? '<div class="da-multi-panel" onclick="event.stopPropagation()">' +
          '<div class="da-multi-hint">可多选；选「全部年龄」将清空其他项</div>' +
          '<label class="da-multi-item"><input type="checkbox"' + (allOn ? ' checked' : '') +
          ' onchange="DA.toggleAge(\'all\')"><span>全部年龄</span></label>' +
          AGE_LABELS.map(function (a) {
            var checked = !allOn && ids.indexOf(a) >= 0;
            return '<label class="da-multi-item"><input type="checkbox"' + (checked ? ' checked' : '') +
              ' onchange="DA.toggleAge(\'' + esc(a) + '\')"><span>' + htmlEsc(a) + '</span></label>';
          }).join('') +
          '</div>'
        : '') +
      '</div>';
  }

  function filteredSites() {
    var ids = diseaseIds();
    if (!ids.length || ids.indexOf('all') >= 0) return SITES.slice();
    var want = {};
    ids.forEach(function (id) {
      if (id === 'digestive') {
        ['C16', 'C18', 'C22'].forEach(function (x) { want[x] = 1; });
      } else {
        want[id] = 1;
      }
    });
    return SITES.filter(function (s) { return want[s.id]; });
  }

  function groups() {
    if (state.group === 'unit') {
      return [
        { key: 'u1', unitName: '014医院', unitLevel: '县区级', unitCode: '360102001' },
        { key: 'u2', unitName: '5111厂医院', unitLevel: '县区级', unitCode: '360103002' },
        { key: 'u3', unitName: '南昌市肿瘤登记中心', unitLevel: '市州级', unitCode: '360100001' },
        { key: 'u4', unitName: '永新县三湾乡卫生院', unitLevel: '乡镇级', unitCode: '360830101' },
        { key: 'u5', unitName: '永新县第二人民医院', unitLevel: '县区级', unitCode: '360830002' },
        { key: 'u6', unitName: '江西省肿瘤医院', unitLevel: '省级', unitCode: '360000001' }
      ];
    }
    if (state.group === 'user') {
      return [
        { key: '360124021', account: '360124021', userName: '青屏社区卫生服务中心', unitName: '南昌市进贤县青屏社区服务中心' },
        { key: '002', account: '002', userName: '史晓云', unitName: '永新县三湾乡卫生院' },
        { key: '003', account: '003', userName: '罗强', unitName: '永新县第二人民医院' },
        { key: '004', account: '004', userName: '江宇', unitName: '永新县人民医院' },
        { key: '005', account: '005', userName: '张医生', unitName: '江西省肿瘤登记中心' },
        { key: '006', account: '006', userName: '李统计员', unitName: '南昌市肿瘤登记中心' }
      ];
    }
    if (state.region === '南昌市') {
      return [
        { key: '360102', regionName: '东湖区', regionCode: '360102000000' },
        { key: '360103', regionName: '西湖区', regionCode: '360103000000' },
        { key: '360104', regionName: '青云谱区', regionCode: '360104000000' }
      ];
    }
    if (state.region === '赣州市') {
      return [
        { key: '360703', regionName: '南康区', regionCode: '360703000000' },
        { key: '360704', regionName: '赣县区', regionCode: '360704000000' },
        { key: '360722', regionName: '信丰县', regionCode: '360722000000' }
      ];
    }
    if (state.region === '九江市') {
      return [
        { key: '360402', regionName: '濂溪区', regionCode: '360402000000' },
        { key: '360421', regionName: '柴桑区', regionCode: '360421000000' },
        { key: '360403', regionName: '浔阳区', regionCode: '360403000000' }
      ];
    }
    return [
      { key: '360100', regionName: '南昌市', regionCode: '360100000000' },
      { key: '360400', regionName: '九江市', regionCode: '360400000000' },
      { key: '360700', regionName: '赣州市', regionCode: '360700000000' },
      { key: '360500', regionName: '新余市', regionCode: '360500000000' },
      { key: '360200', regionName: '景德镇市', regionCode: '360200000000' },
      { key: '361100', regionName: '上饶市', regionCode: '361100000000' }
    ];
  }

  function groupLabel(g) {
    if (state.group === 'unit') return g.unitName;
    if (state.group === 'user') return g.account + ' / ' + g.userName;
    return g.regionName;
  }

  function dimHeaders() {
    if (state.group === 'unit') return ['所属单位', '单位等级', '单位编码'];
    if (state.group === 'user') return ['账户名', '姓名', '所属单位'];
    return ['所属区划', '区划编码'];
  }

  function dimCells(g) {
    if (state.group === 'unit') {
      return '<td class="sticky">' + htmlEsc(g.unitName) + '</td><td>' + htmlEsc(g.unitLevel) + '</td><td>' + htmlEsc(g.unitCode) + '</td>';
    }
    if (state.group === 'user') {
      return '<td class="sticky">' + htmlEsc(g.account) + '</td><td>' + htmlEsc(g.userName) + '</td><td>' + htmlEsc(g.unitName) + '</td>';
    }
    return '<td class="sticky">' + htmlEsc(g.regionName) + '</td><td>' + htmlEsc(g.regionCode) + '</td>';
  }

  function kpiRow(items) {
    return '<div class="da-kpi-strip">' + items.map(function (it) {
      return '<span class="da-kpi-item' + (it.click ? ' clickable' : '') + '"' + (it.click ? ' onclick="' + it.click + '"' : '') + '>' +
        '<span class="da-kpi-label">' + it.label + '</span>' +
        '<span class="da-kpi-value' + (it.tone ? ' ' + it.tone : '') + '">' + it.value + '</span>' +
        (it.sub ? '<span class="da-kpi-sub">' + it.sub + '</span>' : '') +
        '</span>';
    }).join('') + '</div>';
  }

  function hBar(title, items) {
    var max = Math.max.apply(null, items.map(function (x) { return x.value; }).concat([1]));
    var rows = items.map(function (item) {
      var w = Math.max(4, Math.round(item.value / max * 100));
      var active = state.highlight === item.name ? ' active' : '';
      return '<div class="da-hbar-row' + active + '" onclick="DA.highlight(\'' + esc(item.name) + '\')">' +
        '<div class="da-hbar-label" title="' + htmlEsc(item.name) + '">' + htmlEsc(item.name) + '</div>' +
        '<div class="da-hbar-track"><div class="da-hbar-fill" style="width:' + w + '%"></div></div>' +
        '<div class="da-hbar-val">' + (item.value % 1 ? item.value.toFixed(1) : num(item.value)) + '</div></div>';
    }).join('');
    return '<div class="da-chart"><h4>' + title + '</h4><div class="da-hbar">' + (rows || '<div class="da-empty" style="padding:24px;border:0">暂无数据</div>') + '</div></div>';
  }

  function vLine(title, labels, values) {
    var max = Math.max.apply(null, values.concat([1]));
    var cols = labels.map(function (lab, i) {
      var h = Math.max(2, Math.round(values[i] / max * 120));
      var active = state.highlight === lab ? ' active' : '';
      return '<div class="da-vline-col' + active + '" onclick="DA.highlight(\'' + esc(lab) + '\')">' +
        '<div style="font-size:10px;color:var(--primary);font-weight:600">' + values[i] + '</div>' +
        '<div class="da-vline-bar" style="height:' + h + 'px"></div>' +
        '<div class="da-vline-lab">' + htmlEsc(lab) + '</div></div>';
    }).join('');
    return '<div class="da-chart"><h4>' + title + '</h4><div class="da-vline">' + cols + '</div></div>';
  }

  function heat(title, rows, cols, matrix, opts) {
    opts = opts || {};
    var flat = [].concat.apply([], matrix);
    var max = Math.max.apply(null, flat.concat([1]));
    var grid = 'grid-template-columns:100px repeat(' + cols.length + ',minmax(36px,1fr))';
    var headCells = '<div class="da-heat-cell" style="background:transparent"></div>' +
      cols.map(function (c) {
        return '<div class="da-heat-cell clickable" style="background:transparent;font-weight:600;color:#64748b" onclick="DA.highlight(\'' + esc(c) + '\')">' + htmlEsc(c) + '</div>';
      }).join('');
    var body = rows.map(function (r, ri) {
      return '<div class="da-heat-cell clickable" style="background:transparent;justify-content:flex-start;font-weight:600" onclick="DA.highlight(\'' + esc(r) + '\')">' + htmlEsc(r) + '</div>' +
        matrix[ri].map(function (v) {
          var t = max ? v / max : 0;
          var bg = 'rgba(11,101,194,' + (0.08 + t * 0.82).toFixed(2) + ')';
          var color = t > 0.55 ? '#fff' : '#1f2937';
          var text = opts.format ? opts.format(v) : (v % 1 ? Number(v).toFixed(1) : num(v));
          return '<div class="da-heat-cell" style="background:' + bg + ';color:' + color + '">' + text + '</div>';
        }).join('');
    }).join('');
    return '<div class="da-chart"><h4>' + title + '</h4><div class="da-heat-scroll"><div class="da-heat" style="' + grid + '">' + headCells + body + '</div></div></div>';
  }

  function pageShell(meta, body) {
    return '<div class="panel"><div class="panel-body"><div class="da-page">' + body + '</div></div></div>' + modals();
  }

  function emptyResult(msg) {
    return '<div class="da-empty">' + (msg || '当前条件下无数据，请调整筛选后重新查询') + '</div>';
  }

  function ageIndex() {
    var idxs = selectedAgeIndices();
    return idxs.length === 1 ? idxs[0] : -1;
  }

  function siteSlice(site, ageIdx) {
    if (ageIdx < 0) {
      return {
        inc: site.inc,
        death: site.death,
        pop: popBase(),
        mv: site.mv,
        dco: site.dco,
        ub: site.ub
      };
    }
    var share = AGE_SHARE[ageIdx];
    return {
      inc: Math.max(0, Math.round(site.inc * share)),
      death: Math.max(0, Math.round(site.death * share)),
      pop: Math.max(1, Math.round(popBase() * AGE_POP[ageIdx])),
      mv: Math.max(0, Math.round(site.mv * share)),
      dco: Math.max(0, Math.round(site.dco * share)),
      ub: Math.max(0, Math.round(site.ub * share))
    };
  }

  function siteSliceAges(site, idxs) {
    if (!idxs || !idxs.length || idxs.length === AGE_LABELS.length) return siteSlice(site, -1);
    if (idxs.length === 1) return siteSlice(site, idxs[0]);
    return idxs.reduce(function (acc, i) {
      var sl = siteSlice(site, i);
      return {
        inc: acc.inc + sl.inc,
        death: acc.death + sl.death,
        pop: acc.pop + sl.pop,
        mv: acc.mv + sl.mv,
        dco: acc.dco + sl.dco,
        ub: acc.ub + sl.ub
      };
    }, { inc: 0, death: 0, pop: 0, mv: 0, dco: 0, ub: 0 });
  }

  function metricValue(slice, kind) {
    if (kind === '发病数') return slice.inc;
    if (kind === '死亡数') return slice.death;
    if (kind === '发病率') return +crudeRate(slice.inc, slice.pop).toFixed(2);
    if (kind === '死亡率') return +crudeRate(slice.death, slice.pop).toFixed(2);
    if (kind === '死亡发病比(M/I)') return slice.inc ? +(slice.death / slice.inc).toFixed(2) : 0;
    return 0;
  }

  function metricDisplay(slice, kind) {
    if (kind === '发病数' || kind === '死亡数') return num(metricValue(slice, kind));
    if (kind === '发病率') return rate(slice.inc, slice.pop);
    if (kind === '死亡率') return rate(slice.death, slice.pop);
    return fmtRate(metricValue(slice, kind));
  }

  /** 发病数/发病率 → 发病；死亡数/死亡率 → 死亡 */
  function rateKindOf(kind) {
    return kind === '死亡率' || kind === '死亡数' || kind === '死亡' ? '死亡' : '发病';
  }

  function isRateMetric(kind) {
    return kind === '发病率' || kind === '死亡率';
  }

  /* ===== 统计页异常判定复用、染色与工单联动（依赖预警模块导出的 miJudge / devJudge / createStatsWarning） ===== */
  function statsPeriod() { return String(state.dateStart || '2026').slice(0, 4); }
  function metricRuleId() {
    if (state.cellMetric === '死亡发病比(M/I)') return 'B-MI-RATIO';
    if (state.cellMetric === '发病率') return 'C-INC-RATE-DEV';
    if (state.cellMetric === '死亡率') return 'C-MOR-RATE-DEV';
    return null;
  }
  function judgeOf(site, slice) {
    if (state.cellMetric === '死亡发病比(M/I)') {
      return (typeof miJudge === 'function' && slice.inc) ? miJudge(site.name, slice.inc, slice.death) : null;
    }
    if (state.cellMetric === '发病率' || state.cellMetric === '死亡率') {
      var rule = (typeof findRule === 'function') ? findRule(metricRuleId()) : null;
      if (typeof devJudge !== 'function' || !rule) return null;
      var isInc = state.cellMetric === '发病率';
      var dev = (RATE_DEV[site.name] || {})[isInc ? 'inc' : 'mor'];
      if (dev == null || 1 + dev <= 0) return null;
      var n = isInc ? slice.inc : slice.death;
      if (!n || n < rule.minSampleSize) return null;
      var cur = crudeRate(n, slice.pop);
      return devJudge(metricRuleId(), site.name, state.cellMetric, cur, cur / (1 + dev));
    }
    return null;
  }
  function toneWrap(judge, inner) {
    var tone = judge && judge.band === 'abnormal' ? ' da-mi-bad' : judge && judge.band === 'watch' ? ' da-mi-watch' : '';
    return tone ? '<span class="da-mi' + tone + '">' + inner + '</span>' : inner;
  }
  function miCellHtml(judge, inc, death) {
    var v = inc ? death / inc : NaN;
    return toneWrap(judge, fmtRate(v, 2));
  }
  function miDedupeKey(name) { return [metricRuleId() || 'B-MI-RATIO', state.region + '|' + name, statsPeriod()].join('|'); }
  function miTicketOf(name) {
    if (typeof warnings === 'undefined' || !warnings) return null;
    var w = null;
    for (var i = 0; i < warnings.length; i++) if (warnings[i].dedupeKey === miDedupeKey(name)) { w = warnings[i]; break; }
    if (!w) return null;
    var t = typeof findTicketByWarning === 'function' ? findTicketByWarning(w.id) : null;
    return t ? { warning: w, ticket: t } : null;
  }
  /* 预警第二行：紧贴数据行正下方、横跨整表——⚠ 预警原因 + 生成/查看工单 同行横排；原因可点看判定详情 */
  function abnLineOf(judge, name) {
    var isRate = judge.kind === 'rate';
    var reason = (isRate ? judge.metricLabel : 'M/I') + ' ' + judge.dev.dir + ' ' + fmtRate(judge.dev.pct, 1) + '%';
    return '<tr class="da-abn-line"><td colspan="60">' +
      '<span class="da-abn-reason" onclick="event.stopPropagation();DA.showAbnormal(\'' + esc(name) + '\')">⚠ <span class="da-abn-site">' + esc(name) + '</span>' + reason + '</span>' +
      '<button type="button" class="da-abn-go" onclick="event.stopPropagation();DA.miTicket(\'' + esc(name) + '\')">' + (miTicketOf(name) ? '查看工单' : '生成工单') + '</button>' +
      '</td></tr>';
  }

  function renderBurden() {
    var inner = buildBurdenInner();
    return pageShell(PAGES['analysis-burden'], inner);
  }

  /** 供统计分析「发病与死亡」Tab 嵌入，无外层 panel */
  function renderBurdenBody() {
    return '<div class="da-page">' + buildBurdenInner() + '</div>' + modals();
  }

  function buildBurdenInner() {
    var sites = scaleSites();
    var ageIdxs = selectedAgeIndices();
    var singleAge = ageIdxs.length === 1;
    var ageName = ageFilterLabel();
    var eventKind = rateKindOf(state.cellMetric);
    var isDeath = eventKind === '死亡';
    var showRate = isRateMetric(state.cellMetric);
    var isMI = state.cellMetric === '死亡发病比(M/I)';
    var miRule = (typeof findRule === 'function') ? findRule('B-MI-RATIO') : null;
    var miMinSample = miRule ? miRule.minSampleSize : 20;
    var isRate = isRateMetric(state.cellMetric);
    var isJudged = isMI || isRate;
    var rateRuleId = state.cellMetric === '发病率' ? 'C-INC-RATE-DEV' : (state.cellMetric === '死亡率' ? 'C-MOR-RATE-DEV' : null);
    var rateRule = (isRate && typeof findRule === 'function') ? findRule(rateRuleId) : null;
    var countLabel = isDeath ? '死亡数' : '发病数';
    var crudeLabel = isDeath ? '粗死亡率' : '粗发病率';
    var cnLabel = isDeath ? '中标死亡率' : '中标发病率';
    var worldLabel = isDeath ? '世标死亡率' : '世标发病率';
    var cumLabel = isDeath ? '累积死亡0-74(%)' : '累积发病0-74(%)';
    var chartMetric = showRate
      ? (isDeath ? '死亡率' : '发病率')
      : (isDeath ? '死亡数' : '发病数');

    if (!sites.length) {
      return burdenFilter() + emptyResult('当前疾病范围无匹配部位');
    }

    var slices = sites.map(function (site) {
      return { site: site, slice: siteSliceAges(site, ageIdxs) };
    });
    if (isJudged) {
      slices.forEach(function (x) { x.judge = judgeOf(x.site, x.slice); });
      if (state.onlyAbnormal) slices = slices.filter(function (x) { return x.judge && x.judge.band === 'abnormal'; });
      if (!slices.length) return burdenFilter() + emptyResult('当前条件下无触发异常监测规则的部位');
    }

    function siteGetSlice(site) {
      return function (i) { return siteSlice(site, i); };
    }
    function pooledGetSlice() {
      return function (i) {
        return {
          inc: slices.reduce(function (s, x) { return s + siteSlice(x.site, i).inc; }, 0),
          death: slices.reduce(function (s, x) { return s + siteSlice(x.site, i).death; }, 0),
          pop: Math.max(1, Math.round(popBase() * AGE_POP[i]))
        };
      };
    }

    function ageHead() {
      return ageIdxs.map(function (i) {
        var a = AGE_LABELS[i];
        return '<th class="num" style="cursor:pointer" title="点击仅看该年龄组" onclick="event.stopPropagation();DA.setAges([\'' + esc(a) + '\'])">' + a + '</th>';
      }).join('');
    }

    function ageCells(getSlice) {
      return ageIdxs.map(function (i) {
        var sl = getSlice(i);
        if (isMI) {
          return '<td class="num">' + (sl.inc >= miMinSample
            ? miCellHtml(null, sl.inc, sl.death)
            : '<span class="da-dim">—</span>') + '</td>';
        }
        var n = isDeath ? sl.death : sl.inc;
        return '<td class="num">' + (showRate ? rate(n, sl.pop) : num(n)) + '</td>';
      }).join('');
    }

    function resultTable() {
      var rows = slices.map(function (x) {
        var b = rateBundle(siteGetSlice(x.site), eventKind);
        var cls = 'row-click';
        if (x.judge) {
          if (x.judge.band === 'abnormal') cls += ' da-row-abn';
          else if (x.judge.band === 'watch') cls += ' da-row-watch';
        }
        if (state.highlight === x.site.name) cls += ' row-hl';
        var hl = ' class="' + cls + '"';
        var siteCell = '<td class="sticky">' + x.site.name + '</td>';
        var mid;
        if (isMI) {
          mid = '<td class="num sticky-inc">' + miCellHtml(x.judge, x.slice.inc, x.slice.death) + '</td>';
        } else if (showRate) {
          var crudeWrap = x.judge ? toneWrap(x.judge, rateHtml(b.crude)) : rateHtml(b.crude);
          mid = isAllAges()
            ? ('<td class="num sticky-inc">' + crudeWrap +
              '</td><td class="num">' + rateHtml(b.cn) +
              '</td><td class="num">' + rateHtml(b.world) +
              '</td><td class="num">' + fmtRate(b.cum) + '%</td>')
            : ('<td class="num sticky-inc">' + crudeWrap + '</td>');
        } else {
          mid = '<td class="num sticky-inc">' + num(b.count) + '</td>';
        }
        var row = '<tr' + hl + ' onclick="DA.highlight(\'' + esc(x.site.name) + '\')">' + siteCell +
          mid + ageCells(siteGetSlice(x.site)) + '</tr>';
        return x.judge && x.judge.band === 'abnormal' ? row + abnLineOf(x.judge, x.site.name) : row;
      }).join('');

      var pooled = rateBundle(pooledGetSlice(), eventKind);
      var headMid;
      var totalMid;
      if (isMI) {
        headMid = '<th class="num sticky-inc">死亡发病比(M/I)</th>';
        var ps = { inc: 0, death: 0 };
        slices.forEach(function (x) { ps.inc += x.slice.inc; ps.death += x.slice.death; });
        var pj = (typeof miJudge === 'function' && ps.inc >= miMinSample) ? miJudge('全癌种合计', ps.inc, ps.death) : null;
        totalMid = '<td class="num sticky-inc">' + miCellHtml(pj, ps.inc, ps.death) + '</td>';
      } else if (showRate) {
        headMid = isAllAges()
          ? ('<th class="num sticky-inc">' + crudeLabel + '</th><th class="num">' + cnLabel +
            '</th><th class="num">' + worldLabel + '</th><th class="num">' + cumLabel + '</th>')
          : ('<th class="num sticky-inc">' + crudeLabel + '(/10万)</th>');
        var tps = { inc: 0, death: 0 };
        slices.forEach(function (x) { tps.inc += x.slice.inc; tps.death += x.slice.death; });
        var trj = null;
        if (rateRule) {
          var tIsInc = state.cellMetric === '发病率';
          var tDev = (RATE_DEV['全癌种合计'] || {})[tIsInc ? 'inc' : 'mor'];
          var tN = tIsInc ? tps.inc : tps.death;
          if (tDev != null && tN >= rateRule.minSampleSize && typeof devJudge === 'function') {
            trj = devJudge(metricRuleId(), '全癌种合计', state.cellMetric, pooled.crude, pooled.crude / (1 + tDev));
          }
        }
        var tWrap = trj ? toneWrap(trj, rateHtml(pooled.crude)) : rateHtml(pooled.crude);
        totalMid = isAllAges()
          ? ('<td class="num sticky-inc">' + tWrap + '</td><td class="num">' + rateHtml(pooled.cn) +
            '</td><td class="num">' + rateHtml(pooled.world) + '</td><td class="num">' + fmtRate(pooled.cum) + '%</td>')
          : ('<td class="num sticky-inc">' + tWrap + '</td>');
      } else {
        headMid = '<th class="num sticky-inc">' + countLabel + '</th>';
        totalMid = '<td class="num sticky-inc">' + num(pooled.count) + '</td>';
      }

      return '<div class="da-table-wrap"><table class="data-table"><thead><tr>' +
        '<th class="sticky">ICD 部位</th>' + headMid + ageHead() +
        '</tr></thead><tbody>' + rows +
        '<tr class="total"><td class="sticky">合计</td>' + totalMid + ageCells(pooledGetSlice()) +
        '</tr></tbody></table></div>';
    }

    function ageGroupChart(metric) {
      var kind = metric;
      var rows = slices.map(function (x) { return x.site.name; });
      var cols = ageIdxs.map(function (i) {
        return AGE_LABELS[i].replace('岁', '').replace('及以上', '+');
      });
      var matrix = slices.map(function (x) {
        return ageIdxs.map(function (i) {
          return metricValue(siteSlice(x.site, i), kind);
        });
      });
      var isRate = isRateMetric(kind) || kind === '死亡发病比(M/I)';
      var siteBars = slices.map(function (x) {
        return { name: x.site.name, value: metricValue(x.slice, kind) };
      }).sort(function (a, b) { return b.value - a.value; });
      return hBar('部位合计（' + kind + (isAllAges() ? '' : ' · ' + ageName) + '）', siteBars) +
        heat('部位 × 年龄（' + kind + '）', rows, cols, matrix, {
          format: function (v) { return isRate ? Number(v).toFixed(1) : num(v); }
        });
    }

    function resultBody() {
      var back = singleAge
        ? '<div style="margin-bottom:8px"><button type="button" class="btn btn-ghost btn-xs" onclick="DA.setAges([\'all\'])">返回全部年龄</button></div>'
        : '';
      return back + resultTable();
    }

    return burdenFilter() + resultBody();
  }

  function renderProgress() {
    var months = Array.from({ length: 12 }, function (_, i) { return (i + 1) + '月'; });
    var f = factor();
    var list = groups();
    var series = list.map(function (g, index) {
      return {
        g: g,
        label: groupLabel(g),
        values: months.map(function (_, m) { return Math.max(0, Math.round((38 + index * 11 + m * 3) * f)); })
      };
    });
    var monthTotals = months.map(function (_, mi) {
      return series.reduce(function (s, row) { return s + row.values[mi]; }, 0);
    });
    var yearTotal = monthTotals.reduce(function (a, b) { return a + b; }, 0);
    var peakIdx = monthTotals.indexOf(Math.max.apply(null, monthTotals));
    var zeroCount = series.filter(function (row) { return row.values.every(function (v) { return v === 0; }); }).length;
    var headers = dimHeaders();
    var rows = series.map(function (row, index) {
      var total = row.values.reduce(function (a, b) { return a + b; }, 0);
      var hl = state.highlight === row.label ? ' class="row-hl row-click"' : ' class="row-click"';
      return '<tr' + hl + ' onclick="DA.highlight(\'' + esc(row.label) + '\')"><td class="idx">' + (index + 1) + '</td>' +
        dimCells(row.g) +
        '<td class="num">' + num(total) + '</td>' +
        row.values.map(function (v) { return '<td class="num">' + num(v) + '</td>'; }).join('') +
        '</tr>';
    }).join('');
    var totalRow = '<tr class="total"><td class="idx">—</td>' +
      headers.map(function (_, i) { return i === 0 ? '<td>合计</td>' : '<td></td>'; }).join('') +
      '<td class="num">' + num(yearTotal) + '</td>' +
      monthTotals.map(function (v) { return '<td class="num">' + num(v) + '</td>'; }).join('') +
      '</tr>';

    var filter = '<div class="da-filter">' +
      selectField('汇总维度', 'group', [{ value: 'region', label: '区划' }, { value: 'unit', label: '单位' }, { value: 'user', label: '用户' }]) +
      selectField('日期类型', 'dateType', ['上报日期', '确诊日期', '死亡日期']) +
      selectField('统计年度', 'year', ['2026', '2025', '2024', '2023']) +
      selectField('病例归属', 'scope', ['按患者户籍地', '按报告单位所在地'], 'wide') +
      selectField('报卡范围', 'cardRange', ['有效报卡', '全部报卡']) +
      selectField('行政区划', 'region', ['江西省', '南昌市', '赣州市', '九江市']) +
      actions() + '</div>';

    return pageShell(PAGES['analysis-progress'], filter +
      kpiRow([
        { label: '本年合计', value: num(yearTotal) },
        { label: '月均', value: num(Math.round(yearTotal / 12)) },
        { label: '峰值月', value: months[peakIdx], sub: num(monthTotals[peakIdx]) + ' 张' },
        { label: '零报对象', value: String(zeroCount), sub: '当前样本' }
      ]) +
      '<div class="da-table-wrap compact"><table class="data-table"><thead><tr><th class="idx">序号</th>' +
      headers.map(function (h, i) { return '<th' + (i === 0 ? ' class="sticky"' : '') + '>' + h + '</th>'; }).join('') +
      '<th class="num">合计</th>' +
      months.map(function (m) { return '<th class="num">' + m + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows + totalRow + '</tbody></table></div>');
  }

  /* ==================== 报卡质量 · 国家预警值配置 ====================
     与预警监测 B 层（登记质量预警）规则口径联动：超过预警值的列整列标注预警，
     点击超标列头可直接按 B-COMPLETENESS 规则生成预警 + 工单。
     依据：《中国肿瘤登记年报》《IARC CI5》《中国肿瘤登记工作指导手册》及国家登记质量评价参考 */
  var QC_LIMITS = {
    '户籍外卡': { limit: 5, basis: '国家登记质量评价参考：户籍外卡占比参考上限 5%，超标需核对病例归属口径' },
    '警告卡': { limit: 3, basis: '省级报卡质量考核：逻辑校验警告卡占比参考上限 3%' },
    '身份证号': { limit: 2, basis: '《中国肿瘤登记工作指导手册》：关键身份字段缺失率上限 2%' },
    '其它证件号': { limit: 5, basis: '国家登记质量评价参考：证件类字段缺失率上限 5%' },
    '联系电话': { limit: 5, basis: '《中国肿瘤登记工作指导手册》：随访联系字段缺失率上限 5%' },
    '联系人': { limit: 5, basis: '《中国肿瘤登记工作指导手册》：随访联系字段缺失率上限 5%' },
    '联系人电话': { limit: 5, basis: '《中国肿瘤登记工作指导手册》：随访联系字段缺失率上限 5%' },
    '职业': { limit: 5, basis: '国家登记质量评价参考：基本信息字段缺失率上限 5%' },
    '民族': { limit: 2, basis: '国家登记质量评价参考：民族字段缺失率上限 2%' },
    '婚姻': { limit: 5, basis: '国家登记质量评价参考：基本信息字段缺失率上限 5%' },
    '工作单位': { limit: 5, basis: '国家登记质量评价参考：基本信息字段缺失率上限 5%' },
    '分期': { limit: 15, basis: '国家肿瘤登记质量考核：TNM 分期缺失率上限 15%' },
    'T': { limit: 15, basis: '国家肿瘤登记质量考核：TNM 分期缺失率上限 15%' },
    'N': { limit: 15, basis: '国家肿瘤登记质量考核：TNM 分期缺失率上限 15%' },
    'M': { limit: 15, basis: '国家肿瘤登记质量考核：TNM 分期缺失率上限 15%' },
    '治疗信息': { limit: 10, basis: '国家肿瘤登记质量考核：治疗信息缺失率上限 10%' }
  };
  function qcLimitOf(name) { return QC_LIMITS[name] ? QC_LIMITS[name].limit : null; }
  function qcRowValue(row, colName, fields) {
    if (colName === '户籍外卡') return row.outer;
    if (colName === '警告卡') return row.warn;
    var fi = fields.indexOf(colName);
    return fi >= 0 ? row.fields[fi] : null;
  }
  function qcCell(v, name) {
    var lim = qcLimitOf(name);
    if (lim == null) return '<td class="num">' + v.toFixed(2) + '%</td>';
    if (v > lim) return '<td class="num qc-cell-over" title="超过国家预警值 ≤' + lim + '%（' + QC_LIMITS[name].basis + '），超出 ' + (v - lim).toFixed(2) + ' 个百分点；详见下方预警条">' + v.toFixed(2) + '%</td>';
    if (v >= lim * 0.8) return '<td class="num qc-cell-near" title="接近国家预警值 ≤' + lim + '%（' + QC_LIMITS[name].basis + '）">' + v.toFixed(2) + '%</td>';
    return '<td class="num" title="国家预警值 ≤' + lim + '%，达标">' + v.toFixed(2) + '%</td>';
  }
  var qcLast = null;
  /* 单条建预警：按 dedupeKey 去重（createStatsWarning 内部复用已有预警+工单） */
  function qcCreateOne(row, colName) {
    var lim = qcLimitOf(colName);
    if (lim == null || typeof createStatsWarning !== 'function' || !qcLast) return null;
    var v = qcRowValue(row, colName, qcLast.fields);
    if (v == null || v <= lim) return null;
    var basis = QC_LIMITS[colName].basis;
    return createStatsWarning('B-COMPLETENESS', {
      targetType: 'REGISTRY',
      targetId: row.label + '|报卡质量|' + colName,
      targetLabel: state.year + '年 ' + row.label + '「' + colName + '」' + v.toFixed(2) + '% 超国家预警值',
      period: state.year + '年',
      metricValue: v,
      metricLabel: colName + ' ' + v.toFixed(2) + '%',
      severity: v > lim * 1.5 ? 'URGENT' : 'ATTENTION',
      thresholdSnapshot: '国家预警值 ≤' + lim + '%',
      snapshot: {
        汇总对象: row.label, 指标列: colName, 卡片总数: row.total + '张',
        实际值: v.toFixed(2) + '%', 国家预警值: '≤' + lim + '%',
        超出: (v - lim).toFixed(2) + ' 个百分点',
        判定依据: basis, 来源: '报卡质量监测页联动生成'
      },
      evidence: [
        { label: '指标依据', value: basis },
        { label: '实际/预警值', value: v.toFixed(2) + '% / ≤' + lim + '%' },
        { label: '核实要求', value: '回补缺失字段并核对上报口径，复核后可在预警工单中反馈' },
        { label: '触发来源', value: '数据统计 · 报卡质量监测（' + state.year + ' 年）' }
      ]
    });
  }
  /* 该汇总对象本年度是否已有报卡质量联动预警（决定副行显示「生成工单」还是「查看工单」） */
  function qcFindWarnings(label) {
    if (typeof warnings === 'undefined' || !Array.isArray(warnings) || !qcLast) return [];
    var prefix = label + '|报卡质量|', period = state.year + '年';
    return warnings.filter(function (w) {
      return w.ruleId === 'B-COMPLETENESS' && w.period === period && String(w.targetId).indexOf(prefix) === 0;
    });
  }
  function qcHasWarning(label) { return qcFindWarnings(label).length > 0; }
  /* 统一收尾：toast + 跳工单列表 + 打开末张工单详情 */
  function qcFinish(created, lastTicket) {
    toast(created ? '已按 B 层规则生成 ' + created + ' 条预警与工单' : '超标对象均已存在预警，正在打开');
    if (typeof waNavigate === 'function') waNavigate('warning-tickets');
    if (lastTicket && typeof showTicketDetail === 'function') showTicketDetail(lastTicket.id);
  }

  function renderQuality() {
    return pageShell(PAGES['analysis-quality'], renderProcessQcBody());
  }

  function renderProcessQcBody() {
    var baseFields = ['身份证号', '其它证件号', '联系电话', '联系人', '联系人电话', '职业', '民族', '婚姻', '工作单位'];
    var tumFields = ['分期', 'T', 'N', 'M', '治疗信息'];
    var fields = baseFields.concat(tumFields);
    var f = factor();
    var headers = dimHeaders();
    var list = groups().map(function (g, index) {
      var total = Math.max(20, Math.round((1220 - index * 126) * f));
      return {
        g: g,
        label: groupLabel(g),
        total: total,
        outer: +(3.3 + index * 0.55),
        warn: +(1.8 + index * 0.5),
        fields: fields.map(function (_, fi) { return +(0.9 + index * 0.3 + fi * 0.15); })
      };
    });
    var colKeys = ['户籍外卡', '警告卡'].concat(fields);
    var colOver = {};
    list.forEach(function (row) {
      colKeys.forEach(function (k) {
        var lim = qcLimitOf(k);
        if (lim == null) return;
        var v = qcRowValue(row, k, fields);
        if (v != null && v > lim) colOver[k] = true;
      });
    });
    var overCols = colKeys.filter(function (k) { return colOver[k]; });
    qcLast = { list: list, fields: fields, colKeys: colKeys, colOver: colOver, overCols: overCols };
    var totalCols = 1 + headers.length + 3 + fields.length; /* 序号 + 维度列 + 逻辑校验3列 + 字段列 */
    var rows = list.map(function (row, index) {
      /* 该对象超预警值的指标列 */
      var overList = colKeys.filter(function (k) {
        var lim = qcLimitOf(k);
        var v = qcRowValue(row, k, fields);
        return lim != null && v != null && v > lim;
      });
      var hasOver = overList.length > 0;
      /* 关注级：有指标达到预警值 80% 但未超 */
      var hasNear = !hasOver && colKeys.some(function (k) {
        var lim = qcLimitOf(k);
        var v = qcRowValue(row, k, fields);
        return lim != null && v != null && v >= lim * 0.8;
      });
      var hl = state.highlight === row.label ? ' row-hl' : '';
      var dataRow = '<tr class="row-click' + (hasOver ? ' qc-row-over' : hasNear ? ' qc-row-near' : '') + hl + '" onclick="DA.highlight(\'' + esc(row.label) + '\')"><td class="idx">' + (index + 1) + '</td>' +
        dimCells(row.g) +
        '<td class="num">' + num(row.total) + '</td>' +
        qcCell(row.outer, '户籍外卡') +
        qcCell(row.warn, '警告卡') +
        row.fields.map(function (p, fi) { return qcCell(p, fields[fi]); }).join('') + '</tr>';
      if (!hasOver) return dataRow;
      /* 预警副行：整行横跨，自带对象名 + ⚠原因（指标+方向+偏差%）+ 生成/查看工单按钮，与数据行成对 3px 左红描边 */
      var reason = overList.map(function (k) {
        var lim = qcLimitOf(k), v = qcRowValue(row, k, fields);
        return k + ' ' + v.toFixed(2) + '%（超国家预警值 ≤' + lim + '%，偏高 ' + (v - lim).toFixed(2) + 'pct）';
      }).join('；');
      var hasTicket = qcHasWarning(row.label);
      var btn = hasTicket
        ? '<button class="qc-warn-btn" onclick="event.stopPropagation();DA.qcOpenTicket(\'' + esc(row.label) + '\')">查看工单</button>'
        : '<button class="qc-warn-btn" onclick="event.stopPropagation();DA.qcWarnRow(\'' + esc(row.label) + '\')">生成工单</button>';
      return dataRow +
        '<tr class="qc-warn-sub"><td colspan="' + totalCols + '"><div class="qc-warn-flex"><span class="qc-warn-text">⚠ <b>' + esc(row.label) + '</b>：' + reason + '</span>' + btn + '</div></td></tr>' +
        '<tr class="qc-gap" aria-hidden="true"><td colspan="' + totalCols + '"></td></tr>';
    }).join('');

    var filter = '<div class="da-filter">' +
      selectField('汇总维度', 'group', [{ value: 'region', label: '区划' }, { value: 'unit', label: '单位' }, { value: 'user', label: '用户' }]) +
      selectField('日期类型', 'dateType', ['上报日期', '确诊日期', '死亡日期']) +
      selectField('统计年度', 'year', ['2026', '2025', '2024', '2023']) +
      selectField('报卡范围', 'cardRange', ['有效报卡', '全部报卡']) +
      selectField('病例归属', 'scope', ['按患者户籍地', '按报告单位所在地'], 'wide') +
      selectField('行政区划', 'region', ['江西省', '南昌市', '赣州市', '九江市']) +
      actions() + '</div>';

    if (!document.getElementById('qc-group-css')) {
      var qcCss = document.createElement('style');
      qcCss.id = 'qc-group-css';
      qcCss.textContent =
        '.da-table-wrap table.data-table thead tr.qc-group-head th{height:46px;text-align:center;vertical-align:middle;color:#fff;font-size:13px;font-weight:600;padding:8px 10px;border-right:1px solid rgba(255,255,255,.22);border-bottom:1px solid rgba(255,255,255,.22);letter-spacing:.2px}' +
        '.da-table-wrap table.data-table thead tr.qc-group-head th.gd{background:linear-gradient(180deg,#5b6c83,#3e4c60)}' +
        '.da-table-wrap table.data-table thead tr.qc-group-head th.gx{background:linear-gradient(180deg,#6a98df,#4f7fc9)}' +
        '.da-table-wrap table.data-table thead tr.qc-group-head th.gb{background:linear-gradient(180deg,#28b3a5,#128e82)}' +
        '.da-table-wrap table.data-table thead tr.qc-group-head th.gt{background:linear-gradient(180deg,#ec9f42,#cc8220)}' +
        '.da-table-wrap table.data-table thead tr.qc-sub-head th{height:38px;font-size:12px;font-weight:600;padding:7px 8px;border-right:1px solid rgba(255,255,255,.15)}' +
        '.da-table-wrap table.data-table thead tr.qc-sub-head th.sd{background:#f1f5f9;color:#475569}' +
        '.da-table-wrap table.data-table thead tr.qc-sub-head th.sx{background:#eef4fd;color:#2f5fa6}' +
        '.da-table-wrap table.data-table thead tr.qc-sub-head th.sb{background:#e8f8f5;color:#0c7b6f}' +
        '.da-table-wrap table.data-table thead tr.qc-sub-head th.st{background:#fdf4e6;color:#9c5e15}' +
        /* 视觉定稿：异常=数值标红+粉色条带副行（成对 3px 左红描边），关注=仅数值琥珀色 */
        '.da-table-wrap table.data-table tbody td.qc-cell-over{color:#d92d20;font-weight:700}' +
        '.da-table-wrap table.data-table tbody td.qc-cell-near{color:#b54708;font-weight:600}' +
        '.da-table-wrap table.data-table thead tr.qc-sub-head th.qc-col-over{color:#d92d20 !important;border-bottom:2px solid #f04438}' +
        '.qc-over-banner{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0;padding:8px 14px;border-left:3px solid #d92d20;background:#fdf7f7;border-radius:6px;color:#b42335;font-size:13px;font-weight:600}' +
        '.qc-over-banner.ok{border-left-color:#12b76a;background:#f7fcf9;color:#067647}' +
        /* 关键：separate 模式让阴影生效；块间距离用透明间隔行控制，卡片内部无缝 */
        '.da-table-wrap table.data-table{border-collapse:separate !important;border-spacing:0 !important}' +
        '.da-table-wrap table.data-table tbody tr.qc-gap td{background:transparent !important;border:none !important;box-shadow:none !important;height:6px !important;min-height:0 !important;padding:0 !important;line-height:0;font-size:0}' +
        /* 异常数据行：卡片上半，无上下边框（靠阴影+底色区分），左红粗边+顶部圆角；sticky 列同底色 */
        '.da-table-wrap table.data-table tbody tr.qc-row-over td{background:#fee2e2 !important;border-top:none !important;border-bottom:none !important;box-shadow:0 -2px 8px -2px rgba(0,0,0,.1)}' +
        '.da-table-wrap table.data-table tbody tr.qc-row-over td.sticky,.da-table-wrap table.data-table tbody tr.qc-row-over td.sticky-inc{background:#fee2e2 !important;box-shadow:none}' +
        '.da-table-wrap table.data-table tbody tr.qc-row-over td:first-child{border-left:4px solid #dc2626;border-top-left-radius:8px}' +
        '.da-table-wrap table.data-table tbody tr.qc-row-over td:last-child{border-right:none;border-top-right-radius:8px}' +
        /* 关注级：白底 + 3px 左黄描边（无副行） */
        '.da-table-wrap table.data-table tbody tr.qc-row-near td{background:#fff}' +
        '.da-table-wrap table.data-table tbody tr.qc-row-near td:first-child{box-shadow:inset 3px 0 0 #f4b400}' +
        /* 预警副行：卡片下半，无上下边框，左红粗边+底部圆角+向下阴影撑出浮起感 */
        '.da-table-wrap table.data-table tbody tr.qc-warn-sub td{background:#fee2e2 !important;text-align:left;padding:8px 12px 10px 12px;border-top:none;border-bottom:none;box-shadow:0 6px 14px -4px rgba(0,0,0,.22)}' +
        '.da-table-wrap table.data-table tbody tr.qc-warn-sub td:first-child{border-left:4px solid #dc2626;border-bottom-left-radius:8px}' +
        '.da-table-wrap table.data-table tbody tr.qc-warn-sub td:last-child{border-right:none;border-bottom-right-radius:8px}' +
        '.qc-warn-sub .qc-warn-text{color:#b42335;font-weight:600;font-size:12px}' +
        /* 副行 flex 布局：文字撑满、按钮固定在最右侧（横向滚动时 sticky 跟随可视区右缘） */
        '.qc-warn-sub .qc-warn-flex{display:flex;align-items:center;gap:12px}' +
        '.qc-warn-sub .qc-warn-text{flex:1;min-width:0}' +
        '.qc-warn-btn{position:sticky;right:8px;flex-shrink:0;display:inline-block;padding:4px 14px;background:#d92d20;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:-6px 0 10px -6px rgba(0,0,0,.25)}' +
        '.qc-warn-btn:hover{background:#b42335}';
      document.head.appendChild(qcCss);
    }

    var groupHeader = '<tr class="qc-group-head">' +
      '<th rowspan="2" class="idx gd">序号</th>' +
      headers.map(function (h, i) { return '<th rowspan="2" class="' + (i === 0 ? 'sticky gd' : 'gd') + '">' + h + '</th>'; }).join('') +
      '<th colspan="3" class="gx">卡片逻辑校验</th>' +
      '<th colspan="' + baseFields.length + '" class="gb">基本信息缺失比例</th>' +
      '<th colspan="' + tumFields.length + '" class="gt">肿瘤信息缺失比例</th>' +
      '</tr>';

    function qcSubTh(cls, name) {
      var lim = qcLimitOf(name), over = colOver[name];
      var tip = lim != null ? '国家预警值 ≤' + lim + '%' + (over ? '，当前有对象超标，点击生成预警工单' : '，当前达标') : '';
      return '<th class="num ' + cls + (over ? ' qc-col-over' : '') + '"' + (tip ? ' title="' + tip + '"' : '') +
        (over ? ' style="cursor:pointer" onclick="event.stopPropagation();DA.qcWarn(\'' + name + '\')"' : '') + '>' +
        name + (over ? ' ⚠' : '') + '</th>';
    }
    var subHeader = '<tr class="qc-sub-head">' +
      '<th class="num sx">卡片总数</th>' +
      qcSubTh('sx', '户籍外卡') +
      qcSubTh('sx', '警告卡') +
      baseFields.map(function (f) { return qcSubTh('sb', f); }).join('') +
      tumFields.map(function (f) { return qcSubTh('st', f); }).join('') +
      '</tr>';

    var overBanner = overCols.length
      ? '<div class="qc-over-banner">⚠ ' + overCols.length + ' 列超出国家预警值：' + overCols.join('、') +
        '（超标单元格已标红，悬停可见预警值与判定依据）' +
        '<span style="margin-left:auto;display:flex;gap:8px">' +
        '<button class="btn btn-primary btn-xs" onclick="DA.qcWarnAll()">一键生成预警工单</button>' +
        (typeof waGo === 'function' ? '<button class="btn btn-outline btn-xs" onclick="waGo(\'REGISTRY_QUALITY\')">查看质量预警记录</button>' : '') +
        '</span></div>'
      : '<div class="qc-over-banner ok">✓ 当前汇总口径下全部指标列均在国家预警值以内</div>';

    return filter +
      overBanner +
      (list.length
        ? '<div class="da-table-wrap"><table class="data-table"><thead>' + groupHeader + subHeader + '</thead><tbody>' + rows + '</tbody></table></div>'
        : emptyResult('当前筛选下无数据'));
  }

  function pctOf(n, d) {
    if (!d) return NaN;
    return n / d * 100;
  }
  function qcPassBadge(ok, warn) {
    if (ok) return '<span class="badge badge-success">达标</span>';
    if (warn) return '<span class="badge badge-warning">关注</span>';
    return '<span class="badge badge-danger">未达标</span>';
  }
  function qcTone(ok, warn) {
    return ok ? 'da-tone-ok' : warn ? 'da-tone-warn' : 'da-tone-bad';
  }
  function fmtPct(v, digits) {
    if (v == null || isNaN(v)) return '—';
    return Number(v).toFixed(digits == null ? 2 : digits) + '%';
  }
  function fmtMi(v) {
    if (v == null || isNaN(v) || !isFinite(v)) return '—';
    return Number(v).toFixed(2);
  }
  function qcMetricCard(c) {
    var show = c.unit === '' ? fmtMi(c.value) : (c.unit === '天' ? Number(c.value).toFixed(1) + '天' : fmtPct(c.value));
    var bar = c.unit === '' ? Math.min(100, c.value * 100) : c.unit === '天' ? Math.min(100, c.value) : Math.min(100, c.value);
    return '<div class="da-gauge"><div class="da-gauge-label">' + c.label + '</div>' +
      '<div class="da-gauge-val ' + qcTone(c.ok, c.warn) + '">' + show + '</div>' +
      '<div style="font-size:11px;color:#94a3b8;margin-top:2px">阈值 ' + c.tip + ' · ' + (c.ok ? '达标' : c.warn ? '关注' : '未达标') + '</div>' +
      '<div class="da-gauge-bar"><div class="da-gauge-fill" style="width:' + bar + '%;background:' + (c.ok ? '#2e7d32' : c.warn ? '#f4b400' : '#dc3545') + '"></div></div></div>';
  }


  function crossMatrix() {
    var presets = {
      sex_age: {
        title: '性别 × 年龄（5岁组）',
        rows: ['男', '女'],
        cols: AGE_LABELS.map(function (a) { return a.replace('岁', '').replace('及以上', '+'); }),
        matrix: [
          [2, 3, 5, 8, 12, 18, 28, 40, 55, 70, 90, 110, 130, 145, 150, 120, 70, 35],
          [1, 2, 4, 7, 14, 22, 35, 48, 62, 78, 95, 105, 118, 130, 125, 100, 58, 28]
        ]
      },
      site_sex: {
        title: '部位 × 性别',
        rows: ['C50 乳腺', 'C34 肺', 'C16 胃', 'C18 结肠'],
        cols: ['男', '女'],
        matrix: [[124, 238], [398, 286], [221, 175], [166, 127]]
      },
      region_month: {
        title: '区划 × 月份',
        rows: state.region === '江西省' ? ['南昌', '赣州', '九江'] : [state.region.replace('市', '')],
        cols: ['1月', '2月', '3月', '4月', '5月', '6月'],
        matrix: state.region === '江西省'
          ? [[120, 98, 140, 132, 150, 160], [88, 76, 102, 96, 110, 118], [64, 58, 72, 70, 80, 86]]
          : [[90, 78, 110, 104, 120, 128]]
      }
    };

    var row = state.crossRow, col = state.crossCol;
    var key = row === '性别' && col.indexOf('年龄') === 0 ? 'sex_age'
      : row === 'ICD' && col === '性别' ? 'site_sex'
        : row.indexOf('行政区划') === 0 && col.indexOf('月') >= 0 ? 'region_month'
          : state.crossTpl;

    if (row === col) return null;

    var data = presets[key] || presets.site_sex;
    // custom pairing fallback
    if (!presets[key]) {
      var rows = row === '性别' ? ['男', '女'] : row === '行政区划' ? ['南昌', '赣州', '九江'] : row.indexOf('年龄') === 0 ? AGE_LABELS : ['C50 乳腺', 'C34 肺', 'C16 胃', 'C18 结肠'];
      var cols = col === '性别' ? ['男', '女'] : col === '行政区划' ? ['南昌', '赣州', '九江'] : col.indexOf('年龄') === 0 ? AGE_LABELS : ['1月', '2月', '3月', '4月', '5月', '6月'];
      var matrix = rows.map(function (_, ri) {
        return cols.map(function (_, ci) { return 40 + ri * 17 + ci * 11; });
      });
      data = { title: row + ' × ' + col, rows: rows, cols: cols, matrix: matrix };
    }

    var f = factor() * (state.crossRange === '全部报卡' ? 1.08 : 1);
    return {
      title: data.title,
      rows: data.rows,
      cols: data.cols,
      matrix: data.matrix.map(function (rowVals) {
        return rowVals.map(function (v) { return Math.max(0, Math.round(v * f)); });
      })
    };
  }

  function renderCross() {
    var templates = [
      { id: 'sex_age', label: '性别×年龄', row: '性别', col: '年龄组' },
      { id: 'site_sex', label: '部位×性别', row: 'ICD', col: '性别' },
      { id: 'region_month', label: '区划×月份', row: '行政区划', col: '月份' }
    ];
    var data = crossMatrix();
    var filter = '<div class="da-filter">' +
      selectField('日期口径', 'crossDateType', ['上报日期', '确诊日期', '死亡日期']) +
      '<div class="form-group"><label>开始日期</label><input type="date" value="' + state.crossDateStart + '" onchange="DA.set(\'crossDateStart\',this.value)"></div>' +
      '<div class="form-group"><label>结束日期</label><input type="date" value="' + state.crossDateEnd + '" onchange="DA.set(\'crossDateEnd\',this.value)"></div>' +
      selectField('报卡范围', 'crossRange', ['有效报卡', '全部报卡']) +
      selectField('ICD 分组', 'crossIcd', ['ICD-10（明细类）', 'ICD-10（综合类）'], 'wide') +
      selectField('纵向项目', 'crossRow', ['ICD', '年龄组', '行政区划', '性别', '月份']) +
      selectField('横向项目', 'crossCol', ['性别', '年龄组', '行政区划', '月份', 'ICD']) +
      selectField('行政区划', 'region', ['江西省', '南昌市', '赣州市', '九江市']) +
      selectField('年份', 'year', ['2025', '2024', '2023']) +
      '<div class="da-actions"><button class="btn btn-ghost btn-sm" onclick="DA.resetCross()">重置</button>' +
      '<button class="btn btn-primary btn-sm" onclick="DA.runCross()">查询</button>' +
      '<button class="btn btn-outline btn-sm" onclick="DA.export()">导出</button></div></div>';

    if (!data) {
      return pageShell(PAGES['analysis-cross'], filter +
        '<div class="da-tpl">' + templates.map(function (t) {
          return '<button type="button" class="' + (state.crossTpl === t.id ? 'active' : '') + '" onclick="DA.applyTpl(\'' + t.id + '\')">' + t.label + '</button>';
        }).join('') + '</div>' +
        emptyResult('横向与纵向项目不能相同，请调整后重新查询'));
    }

    var rows = data.rows.map(function (r, i) {
      var total = data.matrix[i].reduce(function (a, b) { return a + b; }, 0);
      var hl = state.highlight === r ? ' class="row-hl row-click"' : ' class="row-click"';
      return '<tr' + hl + ' onclick="DA.highlight(\'' + esc(r) + '\')"><td class="sticky">' + r + '</td>' +
        data.matrix[i].map(function (v) { return '<td class="num">' + v + '</td>'; }).join('') + '<td class="num">' + total + '</td></tr>';
    }).join('');
    var colTotals = data.cols.map(function (_, ci) {
      return data.matrix.reduce(function (s, row) { return s + row[ci]; }, 0);
    });
    var grand = colTotals.reduce(function (a, b) { return a + b; }, 0);
    var rowBars = data.rows.map(function (r, i) {
      return { name: r, value: data.matrix[i].reduce(function (a, b) { return a + b; }, 0) };
    });

    return pageShell(PAGES['analysis-cross'], filter +
      '<div class="da-tpl">' + templates.map(function (t) {
        return '<button type="button" class="' + (state.crossTpl === t.id ? 'active' : '') + '" onclick="DA.applyTpl(\'' + t.id + '\')">' + t.label + '</button>';
      }).join('') + '</div>' +
      '<div class="da-viz">' +
      heat(data.title + ' · 热力图', data.rows, data.cols, data.matrix) +
      hBar('行合计对比', rowBars) +
      '</div>' +
      '<div class="da-meta"><span>纵/横不可为空且不可相同</span><span>合计 ' + num(grand) + '</span></div>' +
      '<div class="da-table-wrap"><table class="data-table"><thead><tr><th class="sticky">行 \\ 列</th>' +
      data.cols.map(function (c) { return '<th class="num">' + c + '</th>'; }).join('') +
      '<th class="num">行合计</th></tr></thead><tbody>' + rows +
      '<tr class="total"><td class="sticky">列合计</td>' + colTotals.map(function (v) { return '<td class="num">' + v + '</td>'; }).join('') +
      '<td class="num">' + grand + '</td></tr></tbody></table></div>');
  }

  function filteredFiles() {
    var kw = (state.fileKeyword || '').trim().toLowerCase();
    return reportFiles.filter(function (r) {
      if (kw && r.fileName.toLowerCase().indexOf(kw) < 0 && r.org.toLowerCase().indexOf(kw) < 0) return false;
      var day = r.uploadTime.slice(0, 10);
      if (state.fileDateStart && day < state.fileDateStart) return false;
      if (state.fileDateEnd && day > state.fileDateEnd) return false;
      return true;
    });
  }

  function modals() {
    var html = '';
    if (state.previewId) {
      var file = reportFiles.find(function (r) { return r.id === state.previewId; });
      if (file) {
        html += '<div class="da-modal" onclick="DA.closeModal(event)">' +
          '<div class="da-modal-box" onclick="event.stopPropagation()">' +
          '<div class="da-modal-head"><h4>预览 · ' + htmlEsc(file.fileName) + '</h4><button class="btn btn-ghost btn-xs" onclick="DA.closePreview()">关闭</button></div>' +
          '<div class="da-modal-body"><div class="da-preview-sheet"><h5>' + htmlEsc(file.fileName) + '</h5>' +
          '<p>隶属机构：' + htmlEsc(file.org) + '</p><p>页数：' + file.pages + '</p><p>上传时间：' + htmlEsc(file.uploadTime) + '</p>' +
          '<p>备注：' + htmlEsc(file.remark || '-') + '</p>' +
          '<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">' +
          '<p style="color:#64748b;line-height:1.7">（原型预览）此处展示 PDF 首页缩略内容。正式环境将嵌入 PDF 阅读器并记录查看审计。</p></div></div>' +
          '<div class="da-modal-actions"><button class="btn btn-outline btn-sm" onclick="DA.downloadFile(' + file.id + ')">下载</button>' +
          '<button class="btn btn-primary btn-sm" onclick="DA.closePreview()">完成</button></div></div></div>';
      }
    }
    if (state.abnormalSite) {
      var abS = scaleSites().filter(function (x) { return x.name === state.abnormalSite; })[0];
      var abJ = abS ? judgeOf(abS, siteSliceAges(abS, selectedAgeIndices())) : null;
      if (abJ) {
        var abLinked = miTicketOf(state.abnormalSite);
        var abMetric = abJ.kind === 'rate'
          ? '<div><div class="da-abn-k">本口径' + htmlEsc(abJ.metricLabel) + '</div><div class="da-abn-v"><span class="da-mi-bad">' + fmtRate(abJ.current, 1) + ' /10万</span>（三年基线 ' + fmtRate(abJ.baseline, 1) + ' /10万）</div></div>' +
            '<div><div class="da-abn-k">阈值口径</div><div class="da-abn-v">偏离近三年基线 ±' + abJ.tol + '%</div></div>'
          : '<div><div class="da-abn-k">本口径 M/I</div><div class="da-abn-v"><span class="da-mi-bad">' + fmtRate(abJ.mi, 2) + '</span>（死亡 ' + num(abJ.death) + ' / 发病 ' + num(abJ.inc) + '）</div></div>' +
            '<div><div class="da-abn-k">参考区间</div><div class="da-abn-v">' + fmtRate(abJ.ref.low, 2) + ' ~ ' + fmtRate(abJ.ref.high, 2) + '（容差 ' + (abJ.tol * 100) + '%）</div></div>';
        html += '<div class="da-modal" onclick="DA.closeModal(event)">' +
          '<div class="da-modal-box" onclick="event.stopPropagation()">' +
          '<div class="da-modal-head"><h4>' + (abJ.kind === 'rate' ? htmlEsc(abJ.metricLabel) + '异常' : 'M/I 异常') + ' · ' + htmlEsc(state.abnormalSite) + '</h4><button class="btn btn-ghost btn-xs" onclick="DA.closeAbnormal()">关闭</button></div>' +
          '<div class="da-modal-body"><div class="da-abn-grid">' +
          '<div><div class="da-abn-k">触发规则</div><div class="da-abn-v">' + htmlEsc(abJ.ruleId + ' · ' + abJ.ruleName) + '</div></div>' +
          '<div><div class="da-abn-k">预警级别</div><div class="da-abn-v">' + htmlEsc(abJ.severityLabel) + '</div></div>' +
          abMetric +
          '<div><div class="da-abn-k">偏差</div><div class="da-abn-v">' + (abJ.dev ? htmlEsc(abJ.dev.dir) + ' ' + (abJ.kind === 'rate' ? fmtRate(abJ.dev.abs, 1) + '/10万' : fmtRate(abJ.dev.abs, 2)) + '（' + fmtRate(abJ.dev.pct, 1) + '%）' : '—') + '</div></div>' +
          '<div><div class="da-abn-k">方向提示</div><div class="da-abn-v">' + htmlEsc(abJ.hint) + '</div></div>' +
          '<div><div class="da-abn-k">统计口径</div><div class="da-abn-v">' + htmlEsc(state.region + ' · ' + statsPeriod() + '年 · ' + ageFilterLabel()) + '</div></div>' +
          '<div><div class="da-abn-k">判定依据</div><div class="da-abn-v" style="font-weight:400;font-size:12px;line-height:1.6">' + htmlEsc(abJ.basis) + '</div></div>' +
          '</div></div>' +
          '<div class="da-modal-actions"><button class="btn btn-ghost btn-sm" onclick="DA.closeAbnormal()">关闭</button>' +
          '<button class="btn btn-primary btn-sm" onclick="DA.miTicket(\'' + esc(state.abnormalSite) + '\')">' + (abLinked ? '查看工单' : '生成工单') + '</button></div></div></div>';
      }
    }
    if (state.uploadOpen) {
      html += '<div class="da-modal" onclick="DA.closeModal(event)">' +
        '<div class="da-modal-box" onclick="event.stopPropagation()">' +
        '<div class="da-modal-head"><h4>上传 PDF 报表</h4><button class="btn btn-ghost btn-xs" onclick="DA.closeUpload()">关闭</button></div>' +
        '<div class="da-modal-body">' +
        '<div class="da-upload-drop" onclick="document.getElementById(\'daFileInput\').click()">点击选择 PDF 文件（仅 .pdf）' +
        '<input id="daFileInput" type="file" accept=".pdf,application/pdf" style="display:none" onchange="DA.pickFile(this)"></div>' +
        '<div class="da-grid" style="margin-top:14px">' +
        '<div class="form-group"><label>隶属机构</label><select id="daUploadOrg"><option>江西省肿瘤登记中心</option><option>南昌市肿瘤登记中心</option><option>赣州市肿瘤登记中心</option><option>九江市肿瘤登记中心</option></select></div>' +
        '<div class="form-group"><label>备注</label><input id="daUploadRemark" placeholder="可选"></div></div>' +
        '<div id="daUploadName" style="margin-top:10px;font-size:13px;color:#64748b">尚未选择文件</div></div>' +
        '<div class="da-modal-actions"><button class="btn btn-ghost btn-sm" onclick="DA.closeUpload()">取消</button>' +
        '<button class="btn btn-primary btn-sm" onclick="DA.confirmUpload()">确认上传</button></div></div></div>';
    }
    return html;
  }

  function renderFiles() {
    var list = filteredFiles();
    var allChecked = list.length > 0 && list.every(function (r) { return state.fileSelectedIds.indexOf(r.id) >= 0; });
    var rows = list.map(function (r, i) {
      var checked = state.fileSelectedIds.indexOf(r.id) >= 0;
      return '<tr><td class="idx"><input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="DA.toggleSelect(' + r.id + ',this.checked)"></td>' +
        '<td><strong>' + htmlEsc(r.fileName) + '</strong></td><td>' + htmlEsc(r.org) + '</td><td class="num">' + r.pages +
        '</td><td>' + htmlEsc(r.uploadTime) + '</td><td>' + htmlEsc(r.remark || '-') + '</td><td>' +
        '<button class="btn btn-ghost btn-xs" onclick="DA.previewFile(' + r.id + ')">预览</button> ' +
        '<button class="btn btn-outline btn-xs" onclick="DA.downloadFile(' + r.id + ')">下载</button> ' +
        '<button class="btn btn-danger btn-xs" onclick="DA.deleteFile(' + r.id + ')">删除</button></td></tr>';
    }).join('');
    var filter = '<div class="da-filter">' +
      '<div class="form-group"><label>开始日期</label><input type="date" value="' + state.fileDateStart + '" onchange="DA.set(\'fileDateStart\',this.value)"></div>' +
      '<div class="form-group"><label>结束日期</label><input type="date" value="' + state.fileDateEnd + '" onchange="DA.set(\'fileDateEnd\',this.value)"></div>' +
      '<div class="form-group search-group"><label>检索</label><div style="display:flex;align-items:center;gap:6px"><input value="' + htmlEsc(state.fileKeyword) + '" placeholder="文件名 / 机构" oninput="DA.set(\'fileKeyword\',this.value,true)"><button type="button" class="btn btn-primary btn-sm" style="height:32px;flex:0 0 auto" onclick="DA.queryFiles()">查询</button><button type="button" class="btn btn-ghost btn-sm" style="height:32px;flex:0 0 auto" onclick="DA.resetFiles()">重置</button></div></div>' +
      '<div class="da-actions">' +
      (state.fileSelectedIds.length ? '<button class="btn btn-danger btn-sm" onclick="DA.batchDeleteSelected()">批量删除(' + state.fileSelectedIds.length + ')</button>' : '') +
      '<button class="btn btn-outline btn-sm" onclick="DA.openUpload()">上传 PDF</button></div></div>';

    return pageShell(PAGES['report-files'], filter +
      (list.length
        ? '<div class="da-table-wrap"><table class="data-table da-files-table"><thead><tr><th class="idx"><input type="checkbox" ' + (allChecked ? 'checked' : '') + ' onchange="DA.toggleSelectAll(this.checked)"></th><th>文件名称</th><th>隶属机构</th><th class="num">页数</th><th>上传时间</th><th>备注</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : emptyResult('未找到匹配报表')));
  }

  function render(id) {
    injectStyles();
    if (id === 'analysis') id = state.page;
    // 疾病统计并入统计分析「发病与死亡」；旧交叉/地图/JP/生存同页 Tab
    if (id === 'analysis-burden' || id === 'analysis-cross' || id === 'analysis-map' ||
        id === 'analysis-joinpoint' || id === 'analysis-survival') {
      if (window.STATS && window.STATS.handles('analysis-stats')) {
        var prime = { page: 'analysis-stats' };
        if (id === 'analysis-burden') prime.mode = 'burden';
        else if (id === 'analysis-survival') prime.mode = 'survival';
        else if (id === 'analysis-cross' || id === 'analysis-map' || id === 'analysis-joinpoint') prime.mode = 'burden';
        if (typeof window.STATS.prime === 'function') window.STATS.prime(prime);
        state.page = 'analysis-stats';
        return window.STATS.render('analysis-stats');
      }
    }
    if (window.STATS && window.STATS.handles && window.STATS.handles(id)) {
      state.page = id;
      return window.STATS.render(id);
    }
    if (PAGES[id]) state.page = id;
    else state.page = 'analysis-progress';
    if (state.page === 'analysis-burden') {
      if (window.STATS && window.STATS.handles('analysis-stats')) {
        window.STATS.prime({ mode: 'burden' });
        state.page = 'analysis-stats';
        return window.STATS.render('analysis-stats');
      }
      return renderBurden();
    }
    if (state.page === 'analysis-progress') return renderProgress();
    if (state.page === 'analysis-quality' || state.page === 'analysis-registry-qc') {
      if (state.page === 'analysis-registry-qc') {
        state.page = 'analysis-quality';
      }
      return renderQuality();
    }
    if (state.page === 'report-files') return renderFiles();
    return renderProgress();
  }

  function refresh() {
    var box = document.getElementById('pageContainer');
    if (!box) return;
    /* 仅当当前确实停在统计分析时，才把 refresh 交给 STATS；
       否则（报卡工作量/质量监测等）筛选会误跳回统计分析 */
    var onStats = state.page === 'analysis-stats' || state.page === 'analysis-burden';
    if (onStats && window.STATS && typeof window.STATS.isBurdenTabActive === 'function' && window.STATS.isBurdenTabActive()) {
      window.STATS.refresh();
      return;
    }
    box.innerHTML = render(state.page);
  }

  var uploadDraft = null;

  window.DA = {
    set: function (key, value, soft) {
      if (key === 'dimension') state.dimension = value === '按年龄组' ? '年龄组' : value === '按部位' ? '部位' : value;
      else if (key === 'cellMetric') {
        var map = { '发病': '发病数', '死亡': '死亡数' };
        state.cellMetric = map[value] || value;
      }
      else if (key === 'showCompare' || key === 'onlyAbnormal' || key === 'chartsCollapsed' || key === 'resultAsChart') {
        state[key] = value === true || value === 'true';
      }
      else if (key === 'dualEvent' || key === 'showRate' || key === 'viewEvent' || key === 'bothAgeEvent' || key === 'measureMode') {
        if (!soft) refresh();
        return;
      }
      else if (key === 'ageFilter') {
        state.ageFilters = (!value || value === '全部') ? ['all'] : [value];
      }
      else state[key] = value;
      if (key === 'crossRow' || key === 'crossCol') {
        // sync template highlight if matches
        if (state.crossRow === '性别' && state.crossCol === '年龄组') state.crossTpl = 'sex_age';
        else if (state.crossRow === 'ICD' && state.crossCol === '性别') state.crossTpl = 'site_sex';
        else if (state.crossRow === '行政区划' && state.crossCol === '月份') state.crossTpl = 'region_month';
        else state.crossTpl = 'custom';
      }
      if (!soft) refresh();
      else {
        // soft update for keyword typing: update state only, refresh list lightly
        if (key === 'fileKeyword') refresh();
      }
    },
    toggleDateRange: function () {
      state.dateRangeOpen = !state.dateRangeOpen;
      state.diseaseOpen = false;
      state.ageOpen = false;
      refresh();
    },
    closeDateRange: function () {
      state.dateRangeOpen = false;
      refresh();
    },
    draftDate: function (key, value) {
      state[key] = value;
      state.datePreset = '';
      // keep panel open; soft update without full refresh to avoid losing focus
      var input = document.querySelector('.da-dr-input');
      if (input && state.dateStart && state.dateEnd) input.textContent = state.dateStart + ' ~ ' + state.dateEnd;
    },
    applyDatePreset: function (key) {
      var range = presetRange(key);
      if (!range) return;
      state.dateStart = fmtDate(range[0]);
      state.dateEnd = fmtDate(range[1]);
      state.datePreset = key;
      state.year = String(state.dateStart).slice(0, 4);
      refresh();
    },
    confirmDateRange: function () {
      if (state.dateStart && state.dateEnd && state.dateStart > state.dateEnd) {
        toast('开始日期不能晚于结束日期', 'error');
        return;
      }
      state.year = String(state.dateStart || '2025').slice(0, 4);
      state.dateRangeOpen = false;
      refresh();
    },
    toggleCharts: function () { state.chartsCollapsed = !state.chartsCollapsed; refresh(); },
    highlight: function (name) {
      state.highlight = state.highlight === name ? '' : (name || '');
      refresh();
    },
    query: function () {
      state.queried = true;
      state.highlight = '';
      toast('已按当前筛选条件更新结果');
      refresh();
    },
    reset: function () {
      var page = state.page;
      Object.keys(DEFAULTS).forEach(function (k) {
        state[k] = Array.isArray(DEFAULTS[k]) ? DEFAULTS[k].slice() : DEFAULTS[k];
      });
      state.page = page;
      state.queried = true;
      toast('已重置查询条件');
      refresh();
    },
    toggleDiseasePanel: function () {
      state.diseaseOpen = !state.diseaseOpen;
      state.ageOpen = false;
      refresh();
    },
    toggleDisease: function (id) {
      if (id === 'all') {
        state.disease = ['all'];
      } else {
        var ids = diseaseIds().filter(function (x) { return x !== 'all'; });
        var idx = ids.indexOf(id);
        if (idx >= 0) ids.splice(idx, 1);
        else ids.push(id);
        state.disease = ids.length ? ids : ['all'];
      }
      state.diseaseOpen = true;
      state.highlight = '';
      refresh();
    },
    toggleAgePanel: function () {
      state.ageOpen = !state.ageOpen;
      state.diseaseOpen = false;
      refresh();
    },
    toggleAge: function (id) {
      if (id === 'all') {
        state.ageFilters = ['all'];
      } else {
        var ids = ageFilterIds().filter(function (x) { return x !== 'all'; });
        var idx = ids.indexOf(id);
        if (idx >= 0) ids.splice(idx, 1);
        else ids.push(id);
        state.ageFilters = ids.length ? ids : ['all'];
      }
      state.ageOpen = true;
      state.highlight = '';
      refresh();
    },
    setAges: function (list) {
      state.ageFilters = (!list || !list.length) ? ['all'] : list.slice();
      state.ageOpen = false;
      state.highlight = '';
      refresh();
    },
    resetCross: function () {
      state.crossTpl = 'site_sex';
      state.crossRow = 'ICD';
      state.crossCol = '性别';
      state.crossDateType = '上报日期';
      state.crossRange = '有效报卡';
      state.crossIcd = 'ICD-10（明细类）';
      state.crossAge = '5岁组';
      state.crossDateStart = '2025-01-01';
      state.crossDateEnd = '2025-12-31';
      state.highlight = '';
      toast('已重置交叉条件');
      refresh();
    },
    applyTpl: function (id) {
      var map = {
        sex_age: { row: '性别', col: '年龄组' },
        site_sex: { row: 'ICD', col: '性别' },
        region_month: { row: '行政区划', col: '月份' }
      };
      state.crossTpl = id;
      if (map[id]) { state.crossRow = map[id].row; state.crossCol = map[id].col; }
      state.highlight = '';
      refresh();
    },
    export: function () {
      var summary = state.region + ' / ' + state.year + ' / ' + state.cardRange + ' / ' + (PAGES[state.page] ? PAGES[state.page].title : '');
      if (typeof showConfirm === 'function') {
        showConfirm('导出确认', '将导出：' + summary + '。文件含“查询条件”与“结果明细”页签。', function () {
          toast('导出文件已生成');
        });
      } else toast('导出文件已生成');
    },
    runCross: function () {
      if (!state.crossRow || !state.crossCol) { toast('纵向、横向数据项目都不可以为空', 'error'); return; }
      if (state.crossRow === state.crossCol) { toast('横向与纵向项目不能相同', 'error'); return; }
      if (state.crossDateStart && state.crossDateEnd && state.crossDateStart > state.crossDateEnd) {
        toast('开始日期不能晚于结束日期', 'error'); return;
      }
      state.queried = true;
      state.highlight = '';
      toast('已生成交叉报表');
      refresh();
    },
    queryFiles: function () {
      toast('已按条件检索');
      refresh();
    },
    resetFiles: function () {
      state.fileKeyword = '';
      state.fileDateStart = '2026-01-01';
      state.fileDateEnd = '2026-06-30';
      state.fileSelectedIds = [];
      toast('已重置检索条件');
      refresh();
    },
    openUpload: function () { uploadDraft = null; state.uploadOpen = true; refresh(); },
    closeUpload: function () { state.uploadOpen = false; uploadDraft = null; refresh(); },
    pickFile: function (input) {
      var file = input && input.files && input.files[0];
      var tip = document.getElementById('daUploadName');
      if (!file) { uploadDraft = null; if (tip) tip.textContent = '尚未选择文件'; return; }
      if (!/\.pdf$/i.test(file.name)) {
        uploadDraft = null;
        if (tip) tip.textContent = '仅支持 PDF 文件';
        toast('仅支持上传 .pdf 文件', 'error');
        input.value = '';
        return;
      }
      uploadDraft = file;
      if (tip) tip.textContent = '已选择：' + file.name + '（' + Math.max(1, Math.round(file.size / 1024)) + ' KB）';
    },
    confirmUpload: function () {
      if (!uploadDraft) { toast('请先选择 PDF 文件', 'error'); return; }
      var orgEl = document.getElementById('daUploadOrg');
      var remarkEl = document.getElementById('daUploadRemark');
      var now = new Date();
      var stamp = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      reportFiles.unshift({
        id: nextFileId++,
        fileName: uploadDraft.name,
        org: orgEl ? orgEl.value : '江西省肿瘤登记中心',
        pages: Math.max(1, Math.round(uploadDraft.size / 45000) || 8),
        uploadTime: stamp,
        remark: remarkEl ? remarkEl.value : ''
      });
      state.uploadOpen = false;
      uploadDraft = null;
      toast('PDF 上传成功');
      refresh();
    },
    previewFile: function (id) { state.previewId = id; refresh(); },
    closePreview: function () { state.previewId = null; refresh(); },
    closeModal: function (e) {
      if (e && e.target && e.target.classList && e.target.classList.contains('da-modal')) {
        state.previewId = null;
        state.uploadOpen = false;
        refresh();
      }
    },
    downloadFile: function (id) {
      var file = reportFiles.find(function (r) { return r.id === id; });
      toast(file ? ('开始下载：' + file.fileName + '（已记审计）') : '文件不存在', file ? 'success' : 'error');
    },
    deleteFile: function (id) {
      showConfirm('确认删除', '删除报表前将执行权限校验，并记录删除审计日志。确定继续吗？', function () {
        reportFiles = reportFiles.filter(function (r) { return r.id !== id; });
        state.fileSelectedIds = state.fileSelectedIds.filter(function (sid) { return sid !== id; });
        if (state.previewId === id) state.previewId = null;
        refresh();
        toast('报表已删除，审计记录已保留');
      });
    },
    toggleSelect: function (id, checked) {
      if (checked) {
        if (state.fileSelectedIds.indexOf(id) < 0) state.fileSelectedIds.push(id);
      } else {
        state.fileSelectedIds = state.fileSelectedIds.filter(function (sid) { return sid !== id; });
      }
      refresh();
    },
    toggleSelectAll: function (checked) {
      var list = filteredFiles();
      if (checked) {
        list.forEach(function (r) {
          if (state.fileSelectedIds.indexOf(r.id) < 0) state.fileSelectedIds.push(r.id);
        });
      } else {
        var ids = list.map(function (r) { return r.id; });
        state.fileSelectedIds = state.fileSelectedIds.filter(function (sid) { return ids.indexOf(sid) < 0; });
      }
      refresh();
    },
    batchDeleteSelected: function () {
      var ids = state.fileSelectedIds;
      if (!ids.length) { toast('请先选择要删除的报表', 'error'); return; }
      showConfirm('批量删除', '确认删除选中的 ' + ids.length + ' 个报表？删除前将执行权限校验，并记录删除审计日志。', function () {
        reportFiles = reportFiles.filter(function (r) { return ids.indexOf(r.id) < 0; });
        if (state.previewId && ids.indexOf(state.previewId) >= 0) state.previewId = null;
        state.fileSelectedIds = [];
        refresh();
        toast('已批量删除 ' + ids.length + ' 个报表，审计记录已保留');
      });
    },
    /* 报卡质量 → 预警联动：对超国家预警值的指标，按超标对象逐条生成 B 层预警 + 工单（去重复用已有预警） */
    qcWarn: function (colName) {
      var lim = qcLimitOf(colName);
      if (lim == null) { toast('「' + colName + '」未配置国家预警值', 'error'); return; }
      if (typeof createStatsWarning !== 'function') { toast('预警模块未加载，无法生成预警', 'error'); return; }
      var created = 0, lastTicket = null;
      (qcLast ? qcLast.list : []).forEach(function (row) {
        var res = qcCreateOne(row, colName);
        if (res) { if (res.created) created++; if (res.ticket) lastTicket = res.ticket; }
      });
      if (!created && !lastTicket) { toast('「' + colName + '」当前无超标对象', 'error'); return; }
      qcFinish(created, lastTicket);
    },
    /* 预警副行「生成工单」：该汇总对象所有超标指标一次性建单 */
    qcWarnRow: function (label) {
      if (typeof createStatsWarning !== 'function') { toast('预警模块未加载，无法生成预警', 'error'); return; }
      var row = qcLast ? qcLast.list.filter(function (r) { return r.label === label; })[0] : null;
      if (!row) { toast('未找到该汇总对象', 'error'); return; }
      var created = 0, lastTicket = null;
      (qcLast ? qcLast.colKeys : []).forEach(function (col) {
        var res = qcCreateOne(row, col);
        if (res) { if (res.created) created++; if (res.ticket) lastTicket = res.ticket; }
      });
      if (!created && !lastTicket) { toast('该对象当前无超标指标', 'error'); return; }
      qcFinish(created, lastTicket);
    },
    /* 预警副行「查看工单」：打开该对象已生成的报卡质量工单 */
    qcOpenTicket: function (label) {
      var ws = qcFindWarnings(label);
      if (!ws.length) { toast('该对象尚未生成预警', 'error'); return; }
      var ticket = typeof findTicketByWarning === 'function' ? findTicketByWarning(ws[0].id) : null;
      if (typeof waNavigate === 'function') waNavigate('warning-tickets');
      if (ticket && typeof showTicketDetail === 'function') showTicketDetail(ticket.id);
    },
    qcWarnAll: function () {
      if (!qcLast || !qcLast.overCols.length) { toast('当前无超标列', 'error'); return; }
      if (typeof createStatsWarning !== 'function') { toast('预警模块未加载，无法生成预警', 'error'); return; }
      var created = 0, lastTicket = null;
      qcLast.overCols.forEach(function (col) {
        qcLast.list.forEach(function (row) {
          var res = qcCreateOne(row, col);
          if (res) { if (res.created) created++; if (res.ticket) lastTicket = res.ticket; }
        });
      });
      qcFinish(created, lastTicket);
    },
    showAbnormal: function (name) { state.abnormalSite = name; refresh(); },
    closeAbnormal: function () { state.abnormalSite = null; refresh(); },
    miTicket: function (name) {
      var s = scaleSites().filter(function (x) { return x.name === name; })[0];
      if (!s) { if (typeof toast === 'function') toast('未找到该部位的当前统计结果', 'error'); return; }
      if (typeof createStatsWarning !== 'function') { if (typeof toast === 'function') toast('预警模块未加载，无法生成工单', 'error'); return; }
      var slice = siteSliceAges(s, selectedAgeIndices());
      var j = judgeOf(s, slice);
      if (!j || j.band !== 'abnormal') { if (typeof toast === 'function') toast('该部位未触发异常规则，无需生成工单', 'error'); return; }
      var period = statsPeriod();
      var isRateJ = j.kind === 'rate';
      var res = createStatsWarning(j.ruleId, {
        targetType: isRateJ ? 'REGION_CANCER' : 'REGISTRY_CANCER', targetId: state.region + '|' + s.name,
        targetLabel: period + '年 ' + state.region + ' ' + s.name + (isRateJ ? ' ' + j.metricLabel + ' ' + fmtRate(j.current, 1) + '/10万 偏离基线' + fmtRate(j.dev.pct, 1) + '%' : ' M/I ' + fmtRate(j.mi, 2)) + '（统计分析联动）', period,
        metricValue: isRateJ ? j.dev.pct : j.mi, metricLabel: isRateJ ? (j.metricLabel + ' ' + fmtRate(j.current, 1) + '/10万（' + j.dev.dir + fmtRate(j.dev.pct, 1) + '%）') : ('M/I ' + fmtRate(j.mi, 2)), severity: j.severity,
        thresholdSnapshot: isRateJ ? ('偏离近三年基线 ±' + j.tol + '%') : ('参考区间 ' + fmtRate(j.ref.low, 2) + '~' + fmtRate(j.ref.high, 2) + '（容差' + (j.tol * 100) + '%）'),
        snapshot: Object.assign({ 统计口径: state.region + ' · ' + period + '年 · ' + ageFilterLabel(), 部位: s.name, 提示: j.hint, 来源: '统计分析页联动生成' },
          isRateJ
            ? { 指标: j.metricLabel, 当前值: fmtRate(j.current, 1) + ' /10万', 三年基线: fmtRate(j.baseline, 1) + ' /10万', 偏离: j.dev.dir + ' ' + fmtRate(j.dev.pct, 1) + '%', 触发线: '偏离近三年基线 ±' + j.tol + '%' }
            : { 'M/I 比': fmtRate(j.mi, 2), 参考区间: fmtRate(j.ref.low, 2) + ' ~ ' + fmtRate(j.ref.high, 2), 判定容差: (j.tol * 100) + '%', 偏差: j.dev.dir + ' ' + fmtRate(j.dev.abs, 2) + '（' + fmtRate(j.dev.pct, 1) + '%）', 死亡例数: slice.death + '例', 发病例数: slice.inc + '例' }),
        evidence: [
          { label: '指标依据', value: j.basis },
          { label: isRateJ ? '当前/基线' : '死亡/发病', value: isRateJ ? (fmtRate(j.current, 1) + ' / ' + fmtRate(j.baseline, 1) + ' /10万') : (slice.death + ' / ' + slice.inc + ' 例') },
          { label: '方向提示', value: j.hint },
          { label: '触发来源', value: '统计分析 · ' + period + '年 ' + state.region + '（' + ageFilterLabel() + '）' }
        ]
      });
      if (!res) { if (typeof toast === 'function') toast('生成工单失败，请稍后重试', 'error'); return; }
      state.abnormalSite = null;
      if (typeof toast === 'function') toast(res.created ? '已按规则生成预警与工单 ' + (res.ticket ? res.ticket.id : '') : '该部位已存在工单，正在打开');
      if (typeof waNavigate === 'function') waNavigate('warning-tickets');
      if (res.ticket && typeof showTicketDetail === 'function') showTicketDetail(res.ticket.id);
    },
    isPage: function (id) { return id === 'analysis' || id === 'report-files' || (id && id.indexOf('analysis-') === 0); },
    render: render,
    renderBurdenBody: renderBurdenBody
  };

  document.addEventListener('click', function (e) {
    var need = false;
    if (state.diseaseOpen) {
      var dWrap = e.target && e.target.closest ? e.target.closest('[data-da-disease]') : null;
      if (!dWrap) { state.diseaseOpen = false; need = true; }
    }
    if (state.ageOpen) {
      var aWrap = e.target && e.target.closest ? e.target.closest('[data-da-age]') : null;
      if (!aWrap) { state.ageOpen = false; need = true; }
    }
    if (state.dateRangeOpen) {
      var pWrap = e.target && e.target.closest ? e.target.closest('[data-da-period]') : null;
      if (!pWrap) { state.dateRangeOpen = false; need = true; }
    }
    if (need) refresh();
  });

  var analysisMenu = (typeof menuData !== 'undefined') ? menuData.find(function (m) { return m.id === 'analysis'; }) : null;
  var analysisChildren = [
    { id: 'analysis-stats', label: '统计分析' },
    { id: 'analysis-progress', label: '报卡工作量' },
    { id: 'analysis-quality', label: '报卡质量监测' },
    { id: 'report-files', label: '报表文件库' },
    { id: 'data-report', label: '数据上报' }
  ];
  if (analysisMenu) {
    analysisMenu.label = '数据统计';
    analysisMenu.children = analysisChildren;
  }

  if (typeof roleMenuTree !== 'undefined') {
    var reportGroup = roleMenuTree.find(function (g) { return g.group === '统计报表'; });
    if (reportGroup) reportGroup.children = analysisChildren.slice();
  }
})();
