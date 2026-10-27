/* 预警监测与处置 · 三层重构
   A 登记运行监测 REGISTRY_OPERATION —— 机构履职（地市登记处归口，月度）
   B 登记质量预警 REGISTRY_QUALITY  —— 国家年报/IARC 考核指标（省级登记中心归口，年度）
   C 疾病信号预警 DISEASE_SIGNAL    —— 标化率趋势 / 地区聚集 / 分母核查（省疾控·专家组归口，年度）
   说明：单卡逐条校验属于「审核质控 · 质控规则」，本模块只做聚合指标的周期性阈值预警。
*/
(function () {
  'use strict';

  const OWNED_IDS = ['warning-records', 'warning-tickets', 'warning-rules', 'mon-analysis-stats', 'mon-analysis-quality'];
  function currentOperator() {
    const name = document.getElementById('currentUserName')?.textContent.trim() || '原型经办人';
    const org = typeof window.wbRoleDef === 'function' ? window.wbRoleDef().org : '';
    return org && !name.includes(org) ? org + ' · ' + name : name;
  }
  const PERIOD_MONTH = '202608';
  const PERIOD_YEAR = '2025';

  const style = document.createElement('style');
  style.textContent = `
#pageContainer .wa-page{min-width:0}
#pageContainer .wa-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:16px 18px;background:#fff;border:1px solid var(--border);border-left:4px solid #b42335;border-radius:8px;margin-bottom:14px}
#pageContainer .wa-title{font-size:20px;line-height:1.25;font-weight:700;color:#182230}
#pageContainer .wa-sub{margin-top:5px;font-size:12px;color:#667085;line-height:1.5}
#pageContainer .wa-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
#pageContainer .wa-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:14px}
#pageContainer .wa-kpi{padding:13px 14px;background:#fff;border:1px solid var(--border);border-radius:8px}
#pageContainer .wa-kpi-label{font-size:12px;color:#667085;white-space:nowrap}
#pageContainer .wa-kpi-value{margin-top:6px;font-size:24px;line-height:1;font-weight:700;color:#244765}
#pageContainer .wa-kpi-value.danger{color:#b42335}
#pageContainer .wa-kpi-value.warn{color:#b54708}
#pageContainer .wa-kpi-meta{margin-top:6px;font-size:11px;color:#94a3b8}
#pageContainer .wa-kpi-click{cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s}
#pageContainer .wa-kpi-click:hover{border-color:var(--primary);box-shadow:0 2px 8px rgba(36,71,101,.12);transform:translateY(-1px)}
#pageContainer .wa-kpi-hint{margin-top:6px;font-size:11px;color:var(--primary);font-weight:600;opacity:0;transition:opacity .15s}
#pageContainer .wa-kpi-click:hover .wa-kpi-hint{opacity:1}
#pageContainer .wa-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.85fr);gap:14px;align-items:start;margin-bottom:14px}
#pageContainer .wa-card{background:#fff;border:1px solid var(--border);border-radius:8px;overflow:hidden}
#pageContainer .wa-card-head{min-height:46px;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 15px;border-bottom:1px solid var(--border)}
#pageContainer .wa-card-title{font-size:14px;font-weight:700;color:#1f2937}
#pageContainer .wa-card-sub{font-size:11px;font-weight:400;color:#94a3b8;margin-left:8px}
#pageContainer .wa-card-body{padding:13px 15px}
#pageContainer .wa-layer-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
#pageContainer .wa-layer{display:block;width:100%;padding:13px 14px;border:1px solid var(--border);border-radius:7px;background:#fff;text-align:left;cursor:pointer}
#pageContainer .wa-layer:hover,#pageContainer .wa-layer.active{border-color:var(--primary);background:var(--primary-soft)}
#pageContainer .wa-layer-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
#pageContainer .wa-layer-name{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:#344054}
#pageContainer .wa-layer-code{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;background:#244765;color:#fff;font-size:12px;font-weight:700}
#pageContainer .wa-layer-count{font-size:19px;font-weight:700;color:var(--primary-strong)}
#pageContainer .wa-layer-desc{display:block;margin-top:7px;font-size:11px;color:#667085;line-height:1.55}
#pageContainer .wa-layer-meta{display:block;margin-top:7px;padding-top:7px;border-top:1px dashed var(--border);font-size:11px;color:#94a3b8;line-height:1.6}
#pageContainer .wa-mini-list{display:flex;flex-direction:column;gap:9px}
#pageContainer .wa-mini-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 10px;border:1px solid var(--border);border-radius:6px;background:#fbfcfe}
#pageContainer .wa-mini-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#344054;font-weight:600}
#pageContainer .wa-mini-meta{margin-top:2px;font-size:11px;color:#667085}
#pageContainer .wa-filter{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;align-items:end;padding:13px;background:#f8fafc;border:1px solid var(--border);border-radius:7px;margin-bottom:12px}
#pageContainer .wa-filter .form-group{width:auto;min-width:0;margin:0}
#pageContainer .wa-filter select,#pageContainer .wa-filter input{width:100%;height:35px;padding:0 9px;box-sizing:border-box}
#pageContainer .wa-filter .filter-actions{justify-content:flex-end}
#pageContainer .wa-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:7px;background:#fff}
#pageContainer .wa-table{width:100%;min-width:1180px;border-collapse:collapse}
#pageContainer .wa-table.compact{min-width:900px}
#pageContainer .wa-table th{position:sticky;top:0;z-index:1;height:38px;padding:0 11px;background:#f8fafc;border-bottom:1px solid var(--border);color:#5b6673;font-size:12px;text-align:left;white-space:nowrap;vertical-align:middle}
#pageContainer .wa-table td{height:auto;min-height:48px;padding:7px 11px;border-bottom:1px solid var(--border);color:#334155;font-size:13px;vertical-align:middle}
#pageContainer .wa-table th.num,#pageContainer .wa-table td.num{text-align:right;font-variant-numeric:tabular-nums}
#pageContainer .wa-table th.txt,#pageContainer .wa-table td.txt{text-align:left}
#pageContainer .wa-table th.code,#pageContainer .wa-table td.code{text-align:center}
#pageContainer .wa-table th.ops,#pageContainer .wa-table td.ops{text-align:center;white-space:nowrap}
#pageContainer .wa-table td.ops .btn{margin-right:6px}
#pageContainer .wa-table td.ops .btn:last-child{margin-right:0}
#pageContainer .wa-table td.wa-nowrap{white-space:nowrap}
#pageContainer .wa-table td.wa-nowrap .wa-target{white-space:normal}
#pageContainer .wa-table .badge{white-space:nowrap}
#pageContainer .wa-table tbody tr:hover{background:#f7fbff}
#pageContainer .wa-id{background:none;border:0;padding:0;color:var(--primary);font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap}
#pageContainer .wa-main{min-width:190px}
#pageContainer .wa-target{margin-top:3px;font-size:11px;color:#667085}
#pageContainer .wa-metric{font-family:Consolas,"Courier New",monospace;font-size:12px;color:#244765;white-space:nowrap}
#pageContainer .wa-metric.bad{color:#b42335}
#pageContainer .wa-threshold{margin-top:3px;font-size:11px;color:#667085;font-family:inherit}
#pageContainer .wa-basis{margin-top:3px;font-size:11px;color:#94a3b8;line-height:1.45;white-space:normal}
#pageContainer .wa-actions-cell{white-space:nowrap;text-align:right}
#pageContainer .wa-actions-cell .btn+.btn{margin-left:5px}
#pageContainer .wa-tabs{display:inline-flex;flex-wrap:wrap;gap:0;margin-bottom:12px;border:1px solid #d1d8e0;border-radius:6px;overflow:hidden;background:#fff}
#pageContainer .wa-tab{height:35px;padding:0 14px;border:0;border-right:1px solid #d1d8e0;background:#fff;color:#52606f;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
#pageContainer .wa-tab:last-child{border-right:0}
#pageContainer .wa-tab:hover{background:#f8fafc;color:var(--primary)}
#pageContainer .wa-tab.active{background:var(--primary);color:#fff}
#pageContainer .wa-empty{padding:36px 12px;text-align:center;color:#94a3b8;font-size:13px}
#pageContainer .wa-modal-mask{position:fixed;inset:0;z-index:1100;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.48)}
#pageContainer .wa-modal{width:min(880px,96vw);max-height:88vh;overflow:auto;background:#fff;border-radius:8px;box-shadow:0 18px 50px rgba(15,23,42,.22)}
#pageContainer .wa-modal.narrow{width:min(660px,96vw)}
#pageContainer .wa-modal-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 16px;background:#fff;border-bottom:1px solid var(--border)}
#pageContainer .wa-modal-title{font-size:15px;font-weight:700;color:#1f2937}
#pageContainer .wa-close{width:28px;height:28px;border:0;border-radius:5px;background:#f2f4f7;color:#667085;font-size:17px;line-height:1;cursor:pointer}
#pageContainer .wa-close:hover{background:#e7eaee;color:#b42335}
#pageContainer .wa-modal-body{padding:15px 16px}
#pageContainer .wa-modal-foot{position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;background:#f8fafc;border-top:1px solid var(--border)}
#pageContainer .wa-section{margin-bottom:14px}
#pageContainer .wa-h{margin:0 0 8px;font-size:13px;font-weight:700;color:#344054}
#pageContainer .wa-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:9px}
#pageContainer .wa-field{min-width:0;padding:9px 10px;background:#fbfcfe;border:1px solid var(--border);border-radius:5px}
#pageContainer .wa-field-label{font-size:11px;color:#667085}
#pageContainer .wa-value{margin-top:4px;font-size:13px;font-weight:600;color:#1f2937;word-break:break-word}
#pageContainer .wa-callout{padding:10px 11px;border:1px solid #fedf89;border-left:3px solid #dc6803;border-radius:5px;background:#fffaeb;color:#594414;font-size:12px;line-height:1.6}
#pageContainer .wa-callout.info{border-color:#b2ddff;border-left-color:#1570ef;background:#f5faff;color:#194185}
#pageContainer .wa-callout ul{margin:6px 0 0;padding-left:18px}
#pageContainer .wa-callout li{margin-bottom:3px}
#pageContainer .wa-flow{display:flex;align-items:center;gap:5px;overflow-x:auto}
#pageContainer .wa-state{min-width:76px;height:32px;display:inline-flex;align-items:center;justify-content:center;padding:0 8px;border:1px solid var(--border);border-radius:5px;background:#fff;color:#52606f;font-size:12px;font-weight:600;white-space:nowrap}
#pageContainer .wa-state.done{border-color:#abefc6;background:#ecfdf3;color:#067647}
#pageContainer .wa-state.active{border-color:var(--primary);background:var(--primary-soft);color:var(--primary-strong)}
#pageContainer .wa-state.alert{border-color:#fecdca;background:#fef3f2;color:#b42335}
#pageContainer .wa-arrow{color:#98a2b3}
#pageContainer .wa-history{display:grid;gap:8px}
#pageContainer .wa-history-item{padding:10px;border:1px solid var(--border);border-radius:5px;background:#fff}
#pageContainer .wa-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
#pageContainer .wa-form-grid .full{grid-column:1/-1}
#pageContainer .wa-note{font-size:11px;color:#667085;line-height:1.6}
#pageContainer .wa-check{display:flex;align-items:flex-start;gap:8px;padding:10px 11px;border:1px solid var(--border);border-radius:5px;background:#fbfcfe;font-size:12px;color:#344054;line-height:1.55}
#pageContainer .wa-check input{margin-top:2px}
#pageContainer .wa-score{width:100%;border-collapse:collapse}
#pageContainer .wa-score th{height:34px;padding:0 10px;background:#f8fafc;border-bottom:1px solid var(--border);color:#5b6673;font-size:12px;text-align:left;white-space:nowrap}
#pageContainer .wa-score td{height:40px;padding:6px 10px;border-bottom:1px solid var(--border);font-size:12px;color:#334155}
#pageContainer .wa-score td.v{font-family:Consolas,"Courier New",monospace;font-weight:700;color:#244765}
#pageContainer .wa-score td.v.bad{color:#b42335}
#pageContainer .wa-score td.v.warn{color:#b54708}
#pageContainer .wa-score tr:last-child td{border-bottom:0}
#pageContainer .badge-primary{background:var(--primary-soft);color:var(--primary-strong)}
#pageContainer .wa-mini-item.clickable{cursor:pointer;transition:border-color .15s ease,background .15s ease}
#pageContainer .wa-mini-item.clickable:hover{border-color:var(--primary);background:#f7fbff}
#pageContainer .wa-score tbody tr.clickable{cursor:pointer}
#pageContainer .wa-score tbody tr.clickable:hover{background:#f7fbff}
@media(max-width:1200px){
  #pageContainer .wa-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}
  #pageContainer .wa-grid{grid-template-columns:1fr}
  #pageContainer .wa-filter{grid-template-columns:repeat(3,minmax(0,1fr))}
  #pageContainer .wa-layer-grid{grid-template-columns:1fr}
}
@media(max-width:720px){
  #pageContainer .wa-head{flex-direction:column}
  #pageContainer .wa-actions{justify-content:flex-start}
  #pageContainer .wa-kpis,#pageContainer .wa-layer-grid,#pageContainer .wa-filter,#pageContainer .wa-form-grid{grid-template-columns:1fr}
}
`;
  document.head.appendChild(style);

  /* ============ 三层定义：对象、归口、观察窗口、结论口径、响应时限 ============ */
  const TYPE_META = {
    REGISTRY_OPERATION: {
      code: 'A', label: '登记运行监测', short: '运行监测',
      object: '上报机构 / 区县登记处',
      desc: '看机构履职是否到位：零报、上报及时率、上报量连续性、协查与审核积压。只看机构聚合口径，不下钻到单卡。',
      firstOwner: '上报机构质控联系人', escalateOwner: '地市登记处', finalOwner: '地市登记处', arbiter: '省级登记中心',
      source: '登记上报流水（机构 × 月）', window: '月度',
      conclusions: ['属实-已整改', '属实-需系统支持', '属实-机构业务变化', '误报'],
      sla: { URGENT: { hours: 24, text: '24小时' }, ATTENTION: { workDays: 3, text: '3个工作日' }, INFO: { text: '无强制时限' } }
    },
    REGISTRY_QUALITY: {
      code: 'B', label: '登记质量预警', short: '质量预警',
      object: '登记处 × 癌种',
      desc: '对标《中国肿瘤登记年报》与 IARC CI5 收录标准：MV%、DCO%、M/I 比、UB%、O&U%、年龄不明率、死亡补发病闭环、完整性。国家考核会卡的指标在这一层。',
      firstOwner: '区县登记处', escalateOwner: '地市登记中心', finalOwner: '省级登记中心', arbiter: '省级登记中心',
      source: '登记质量指标立方体（登记处 × 癌种 × 年度）', window: '年度（季度预评）',
      conclusions: ['属实-补录整改中', '属实-口径或编码问题', '属实-完整性不足需专项调查', '属实-已修正复算达标', '误报'],
      sla: { URGENT: { workDays: 5, text: '5个工作日' }, ATTENTION: { workDays: 10, text: '10个工作日' }, INFO: { text: '随年报周期整改' } }
    },
    DISEASE_SIGNAL: {
      code: 'C', label: '疾病信号预警', short: '信号研判',
      object: '地区 × 癌种',
      desc: '标化率多期趋势、地区聚集、偏离历史分布与人口分母核查。最小观察窗口为年度，不用月度环比，结案必须有专家组论证记录。',
      firstOwner: '地市疾控', escalateOwner: '省疾控', finalOwner: '省级专家组', arbiter: '省级专家组',
      source: '标化率与人口基数立方体（地区 × 癌种 × 年度）', window: '年度',
      conclusions: ['疑似真实升高', '上报行为改变', '人口分母错误', '筛查项目影响', '编码口径变化', '误报'],
      requireExpertReview: true,
      sla: { URGENT: { workDays: 10, text: '10个工作日' }, ATTENTION: { workDays: 20, text: '20个工作日' }, INFO: { text: '随年度分析' } }
    }
  };
  const TYPE_KEYS = Object.keys(TYPE_META);

  const SEVERITY_META = {
    INFO: { label: '提示级', badge: 'badge-muted' },
    ATTENTION: { label: '关注级', badge: 'badge-warning' },
    URGENT: { label: '紧急级', badge: 'badge-danger' }
  };
  const WARNING_STATUS_META = {
    PENDING: { label: '待处理', badge: 'badge-warning' },
    PROCESSING: { label: '处理中', badge: 'badge-info' },
    FEEDBACK: { label: '已反馈', badge: 'badge-primary' },
    CLOSED: { label: '已关闭', badge: 'badge-success' },
    ESCALATED: { label: '已升级', badge: 'badge-danger' }
  };
  const TICKET_STATUS_META = {
    PENDING: { label: '待接收', badge: 'badge-warning' },
    PROCESSING: { label: '处理中', badge: 'badge-info' },
    FEEDBACK: { label: '已反馈', badge: 'badge-primary' },
    CLOSED: { label: '已关闭', badge: 'badge-success' },
    ESCALATED: { label: '已升级', badge: 'badge-danger' }
  };

  const state = {
    page: 'warning-records',
    record: { type: 'ALL', severity: 'ALL', status: 'ALL', keyword: '', dateFrom: '' },
    ticket: { type: 'ALL', severity: 'ALL', status: 'ALL', keyword: '', sort: 'overdue' },
    rule: { type: 'ALL', keyword: '', enabledOnly: false }
  };

  let seq = 1000;
  let warningSeq = 248;
  let ticketSeq = 315;
  const rules = [];
  const warnings = [];
  const tickets = [];
  const operationLogs = [];
  const warningRuns = [];
  let currentRun = null;
  const AUTO_SEVERITY_RULES = new Set([
    'A-ZERO-REPORT', 'A-TIMELINESS', 'A-VOLUME-DROP', 'A-VOLUME-MOM', 'A-XIECHA-OVERDUE',
    'A-AUDIT-BACKLOG', 'A-NCCR-SUBMIT', 'A-FOLLOWUP-LOST', 'B-MV-LOW', 'B-MV-CANCER',
    'B-DCO-HIGH', 'B-UB-HIGH', 'B-OU-HIGH', 'B-AGE-UNKNOWN', 'B-DCN-OPEN', 'B-COMPLETENESS',
    'B-DCN-CANCER', 'C-ASR-TREND', 'C-CLUSTER', 'C-MORT-TREND', 'C-DENOMINATOR',
    'C-INC-RATE-DEV', 'C-MOR-RATE-DEV', 'C-QUARTER-PREVIEW', 'ASSIGN-STALE', 'A-DCN-MONTH'
  ]);
  function todayISO() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }); }
  function applyDueRuleVersions() {
    rules.forEach(rule => {
      if (!rule.pendingVersion || rule.pendingVersion.effectiveDate > todayISO()) return;
      Object.assign(rule, rule.pendingVersion);
      delete rule.pendingVersion;
    });
  }
  function executionDescription(rule) {
    const value = rule.thresholdValue + rule.unit;
    const sample = '；最小样本 ' + rule.minSampleSize;
    const conditions = {
      'A-ZERO-REPORT': '连续零报 ≥ ' + value + '；≥3个月紧急',
      'A-TIMELINESS': '及时率 < ' + value + '；<75%紧急',
      'A-VOLUME-DROP': '低于近12月基线 ≥ ' + value + '；低于60%紧急',
      'A-VOLUME-MOM': '上报量环比上升 ≥ ' + value + '；≥100%紧急',
      'A-AUDIT-BACKLOG': '待审 ≥ ' + value + ' 或最长停留 ≥15日；≥80张关注',
      'B-MV-LOW': 'MV% < ' + value + '；<55%紧急',
      'B-MV-CANCER': '分癌种 MV% < ' + value + '；<55%紧急；同业务问题合并命中',
      'B-DCO-HIGH': 'DCO% > ' + value + '；>25%紧急',
      'B-UB-HIGH': 'UB% > ' + value + '；>8%紧急',
      'B-OU-HIGH': 'O&U% > ' + value + '；>8%紧急',
      'B-AGE-UNKNOWN': '年龄不明率 > ' + value + '；>2%紧急',
      'B-COMPLETENESS': '全癌种粗发病率低于参考 ≥ ' + value + '；低于40%紧急',
      'B-MI-RATIO': '分癌种 M/I 超出参考区间的 ' + (rule.thresholdValue * 100).toFixed(1) + '% 容差',
      'B-MI-TOTAL': '全癌种 M/I 超出参考区间的 ' + (rule.thresholdValue * 100).toFixed(1) + '% 容差',
      'B-DCN-OPEN': 'DCN 未闭环率 > ' + value + '；>40%紧急',
      'B-DCN-CANCER': '分癌种 DCN 未闭环率 > ' + value + '；>40%紧急',
      'C-ASR-TREND': '连续三年同向且累计偏离 ≥ ' + value + '；累计≥35%紧急',
      'C-MORT-TREND': '连续三年上升且累计升幅 ≥ ' + value,
      'C-CLUSTER': 'SIR ≥ ' + value + ' 且95%CI下限>1，逐年验证连续三年；示例序列不足只作观察线索',
      'C-INC-RATE-DEV': '粗发病率偏离前三年均值 ≥ ' + value + '；≥35%紧急',
      'C-MOR-RATE-DEV': '粗死亡率偏离前三年均值 ≥ ' + value + '；≥35%紧急',
      'C-AGE-PROFILE': '早发病例占比与全省差值绝对值 ≥ ' + value,
      'C-DENOMINATOR': '人口同比变动绝对值 > ' + value + ' 且缺少依据',
      'C-QUARTER-PREVIEW': '累计率偏离同期基线 ≥ ' + value + '；仅作待年度核查线索',
      'ASSIGN-STALE': '关注及以上记录生成后 ≥ ' + value + ' 未接收；≥15日紧急',
      'A-DCN-MONTH': '超30日未回填占比 > ' + value + '；>30%紧急'
    };
    return (conditions[rule.id] || rule.params) + sample;
  }
  function closurePass(warning, value) {
    const threshold = warning.parameterSnapshot?.threshold ?? findRule(warning.ruleId)?.thresholdValue;
    if (!Number.isFinite(value) || !Number.isFinite(threshold)) return false;
    if (/^B-MV-/.test(warning.ruleId)) return value >= threshold && value <= 100;
    if (/^B-(DCO|UB|OU|AGE|DCN)-/.test(warning.ruleId)) return value >= 0 && value <= threshold;
    if (warning.ruleId === 'B-COMPLETENESS') return value > -threshold;
    if (/^B-MI-/.test(warning.ruleId)) {
      const ref = MI_REFERENCE[warning.snapshot['癌种'] || '全癌种合计'];
      return !!ref && value >= ref.low * (1 - threshold) && value <= ref.high * (1 + threshold);
    }
    return true;
  }

  function uid(prefix) { return prefix + '-' + (++seq).toString().padStart(5, '0'); }
  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function dateAt(offsetDays, hour, minute) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, minute || 0, 0, 0);
    return d;
  }
  function fmtTime(value) {
    if (!value) return '-';
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d) ? '-' : d.toLocaleString('zh-CN', { hour12: false });
  }
  function n1(value) { return Number(value).toFixed(1); }
  function n2(value) { return Number(value).toFixed(2); }
  function percent(value) { return (value > 0 ? '+' : '') + Number(value).toFixed(1) + '%'; }
  function findWarning(id) { return warnings.find(item => item.id === id); }
  function findRule(id) { return rules.find(item => item.id === id); }
  function findTicket(id) { return tickets.find(item => item.id === id); }
  function findTicketByWarning(id) { return tickets.find(item => item.warningId === id); }
  function activeTicketCount() { return tickets.filter(item => item.status !== 'CLOSED').length; }
  function overdueTicketCount() {
    const now = Date.now();
    return tickets.filter(item => item.slaDeadline && item.status !== 'CLOSED' && new Date(item.slaDeadline).getTime() < now).length;
  }
  function addWorkDays(date, days) {
    const result = new Date(date.getTime());
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      if (result.getDay() !== 0 && result.getDay() !== 6) added++;
    }
    return result;
  }
  function slaText(type, severity) {
    const cfg = (TYPE_META[type] && TYPE_META[type].sla[severity]) || null;
    return cfg ? cfg.text : '无强制时限';
  }
  function slaDeadline(type, severity, created) {
    const cfg = (TYPE_META[type] && TYPE_META[type].sla[severity]) || null;
    if (!cfg) return null;
    if (cfg.hours) return new Date(created.getTime() + cfg.hours * 3600 * 1000);
    if (cfg.workDays) return addWorkDays(created, cfg.workDays);
    return null;
  }
  function arbitrationOwner(type) { return (TYPE_META[type] || {}).arbiter || '省级登记中心'; }
  function logAction(data) {
    operationLogs.unshift({
      id: uid('LOG'),
      time: data.time || new Date(),
      operator: data.operator || currentOperator(),
      layer: data.layer || '-',
      ticketId: data.ticketId || '-',
      warningId: data.warningId || '-',
      action: data.action,
      from: data.from || '-',
      to: data.to || '-',
      reason: data.reason || ''
    });
  }
  function makeEvidence(rows) { return rows.map(row => ({ label: row[0], value: row[1] })); }
  function severityBadge(value) { const m = SEVERITY_META[value] || SEVERITY_META.INFO; return '<span class="badge ' + m.badge + '">' + m.label + '</span>'; }
  function warningStatusBadge(value) { const m = WARNING_STATUS_META[value]; return '<span class="badge ' + m.badge + '">' + m.label + '</span>'; }
  function ticketStatusBadge(value) { const m = TICKET_STATUS_META[value]; return '<span class="badge ' + m.badge + '">' + m.label + '</span>'; }
  function layerBadge(type) { const m = TYPE_META[type]; return '<span class="badge badge-info">' + m.code + ' · ' + m.short + '</span>'; }
  function downgrade(severity) { return severity === 'URGENT' ? 'ATTENTION' : 'INFO'; }

  /* ==================== 规则库：A 运行 / B 质量 / C 信号 ==================== */
  function seedRules() {
    const defs = [
      /* ---------- A 登记运行监测（机构 × 月） ---------- */
      { id: 'A-ZERO-REPORT', name: '机构连续零报', type: 'REGISTRY_OPERATION', point: 'ZERO_REPORT',
        scope: '全部持证上报机构', method: 'CONTINUOUS连续周期', threshold: 2, unit: '个月', minSample: 0, severity: 'ATTENTION',
        window: '月度', basis: '登记机构履职要求：有诊疗能力的机构不应出现连续零报',
        params: '连续零报≥2个月触发关注级；≥3个月升紧急级并抄送地市登记处', confirm: '已由省级登记中心确认' },
      { id: 'A-TIMELINESS', name: '上报及时率不达标', type: 'REGISTRY_OPERATION', point: 'TIMELINESS',
        scope: '全部持证上报机构', method: 'RATE比率下限', threshold: 90, unit: '%', minSample: 20, severity: 'ATTENTION',
        window: '月度', basis: '确诊后 30 日内完成上报为及时；及时率下限 90%',
        params: '及时率＜90%关注级；＜75%紧急级。月上报量不足20例不参与评价', confirm: '已由省级登记中心确认' },
      { id: 'A-VOLUME-DROP', name: '上报量偏离历史基线', type: 'REGISTRY_OPERATION', point: 'VOLUME_BASELINE',
        scope: '全部持证上报机构', method: 'BASELINE近12月同期基线', threshold: 40, unit: '%', minSample: 60, severity: 'ATTENTION',
        window: '月度（对比近12月同期基线）', basis: '与本机构近12个月同期基线比较，规避单月环比噪声',
        params: '低于基线40%触发；低于60%升紧急级。近12月合计不足60例不参与评价', confirm: '已由省级登记中心确认' },
      { id: 'A-VOLUME-MOM', name: '上报量环比异常上升', type: 'REGISTRY_OPERATION', point: 'VOLUME_MOM',
        scope: '全部持证上报机构', method: 'MOM上月环比', threshold: 50, unit: '%', minSample: 20, severity: 'ATTENTION',
        window: '月度（对比上月）', basis: '上报量环比激增通常为集中补报、系统重复入库或口径变更，属数据异常而非发病率变化；本规则监测的是上报行为，不得解释为发病率上升',
        params: '环比上升≥50%触发关注级；≥100%升紧急级。上月上报量不足20例不参与评价（小基数环比无意义）', confirm: '已由省级登记中心确认' },
      { id: 'A-XIECHA-OVERDUE', name: '协查回复超期', type: 'REGISTRY_OPERATION', point: 'XIECHA_OVERDUE',
        scope: '被协查机构', method: 'ABSOLUTE绝对值', threshold: 15, unit: '日', minSample: 0, severity: 'ATTENTION',
        window: '月度', basis: '协查函发出后 15 个工作日内应回复',
        params: '超期1件即触发；超期≥5件升紧急级', confirm: '已由省级登记中心确认' },
      { id: 'A-AUDIT-BACKLOG', name: '审核环节积压', type: 'REGISTRY_OPERATION', point: 'AUDIT_BACKLOG',
        scope: '区县 / 地市登记处', method: 'ABSOLUTE绝对值', threshold: 30, unit: '张', minSample: 0, severity: 'INFO',
        window: '月度', basis: '待审报告卡在本级停留不应超过 30 张或 15 日',
        params: '待审≥30张或最长停留≥15日触发；≥80张升关注级', confirm: '已由省级登记中心确认' },
      { id: 'A-NCCR-SUBMIT', name: '国家上报批次异常', type: 'REGISTRY_OPERATION', point: 'NCCR_SUBMIT',
        scope: '国家肿瘤登记年度上报批次', method: 'STATE批次状态', threshold: 7, unit: '日', minSample: 0, severity: 'ATTENTION',
        window: '按国家上报窗口', basis: '国家肿瘤登记数据上报有固定报送窗口：临近截止未提交、被国家平台退回、或数据包校验未通过，都会导致错过报送窗口，须立即处置',
        params: '距截止≤7日未提交触发关注级；≤3日或被退回/校验未过升紧急级（错过窗口影响全省年度数据纳入国家库）', confirm: '已由省级登记中心确认' },
      { id: 'A-FOLLOWUP-LOST', name: '随访失访率超标 / 死亡证明回收超期', type: 'REGISTRY_OPERATION', point: 'FOLLOWUP_LOST',
        scope: '区县登记处 / 随访责任机构', method: 'RATE比率上限', threshold: 20, unit: '%', minSample: 30, severity: 'ATTENTION',
        window: '季度', basis: '随访失访率过高会使生存分析与 M/I 比失真；死亡证明回收超期会拖慢死亡补发病闭环。两者均属随访履职问题，可由随访员跟进处置',
        params: '失访率＞20%或死亡证明回收超期＞30日触发关注级；失访率＞35%升紧急级。随访在册不足30例不参与评价', confirm: '已由省级登记中心确认' },

      /* ---------- B 登记质量预警（登记处 × 癌种 × 年度） ---------- */
      { id: 'B-MV-LOW', name: 'MV% 形态学确诊比例偏低', type: 'REGISTRY_QUALITY', point: 'MV_RATE',
        scope: '登记处 × 主要癌种', method: 'RATE比率下限', threshold: 66, unit: '%', minSample: 20, severity: 'ATTENTION',
        window: '年度', basis: '《中国肿瘤登记年报》可靠性指标；IARC CI5 收录参考下限 MV% ≥ 66%',
        params: 'MV%＜66%关注级；＜55%紧急级。年病例数不足20例不参与评价', confirm: '已由省级登记中心确认' },
      { id: 'B-DCO-HIGH', name: 'DCO% 死亡证明来源比例偏高', type: 'REGISTRY_QUALITY', point: 'DCO_RATE',
        scope: '登记处 × 主要癌种', method: 'RATE比率上限', threshold: 15, unit: '%', minSample: 20, severity: 'ATTENTION',
        window: '年度', basis: '《中国肿瘤登记年报》完整性/可靠性指标；DCO% 上限 15%',
        params: 'DCO%＞15%关注级；＞25%紧急级。与死亡补发病闭环情况联合研判', confirm: '已由省级登记中心确认' },
      { id: 'B-MI-RATIO', name: 'M/I 比偏离参考区间', type: 'REGISTRY_QUALITY', point: 'MI_RATIO',
        scope: '登记处 × 主要癌种', method: 'RANGE参考区间', threshold: 0.15, unit: '（偏离比例）', minSample: 20, severity: 'ATTENTION',
        window: '年度', basis: '按癌种设定 M/I 参考区间；偏离参考区间上下限 15% 以上视为异常',
        params: 'M/I 高于上限提示发病漏报；低于下限提示死亡漏报或随访不足', confirm: '已由省级登记中心确认' },
      { id: 'B-UB-HIGH', name: 'UB% 部位不明比例偏高', type: 'REGISTRY_QUALITY', point: 'UB_RATE',
        scope: '登记处（全癌种合计）', method: 'RATE比率上限', threshold: 5, unit: '%', minSample: 50, severity: 'ATTENTION',
        window: '年度', basis: 'C80 原发部位不明病例占比上限 5%，超标提示编码与诊断信息不足',
        params: 'UB%＞5%关注级；＞8%紧急级', confirm: '已由省级登记中心确认' },
      { id: 'B-OU-HIGH', name: 'O&U% 其他及不明比例偏高', type: 'REGISTRY_QUALITY', point: 'OU_RATE',
        scope: '登记处（全癌种合计）', method: 'RATE比率上限', threshold: 5, unit: '%', minSample: 50, severity: 'ATTENTION',
        window: '年度', basis: 'C26/C39/C48/C75/C76-C80 等其他及未指明部位病例占比上限 5%（国家登记质量评价参考）',
        params: 'O&U%＞5%关注级；＞8%紧急级', confirm: '已由省级登记中心确认' },
      { id: 'B-AGE-UNKNOWN', name: '年龄不明率超标', type: 'REGISTRY_QUALITY', point: 'AGE_UNKNOWN',
        scope: '登记处（全癌种合计）', method: 'RATE比率上限', threshold: 1, unit: '%', minSample: 50, severity: 'ATTENTION',
        window: '年度', basis: '年龄缺失将导致标化率不可计算，占比上限 1%（国家登记质量评价参考）',
        params: '年龄不明率＞1%关注级；＞2%紧急级', confirm: '已由省级登记中心确认' },
      { id: 'B-DCN-OPEN', name: '死亡补发病（DCN）未闭环', type: 'REGISTRY_QUALITY', point: 'DCN_TRACEBACK',
        scope: '登记处（死亡库比对结果）', method: 'RATE比率上限', threshold: 20, unit: '%', minSample: 10, severity: 'ATTENTION',
        window: '年度（季度预评）', basis: '死亡库中未匹配到发病记录的病例应回溯补发病；未闭环率上限 20%',
        params: '未闭环率＞20%关注级；＞40%紧急级。未闭环病例最终会计入 DCO%', confirm: '已由省级登记中心确认' },
      { id: 'B-COMPLETENESS', name: '发病登记完整性不足', type: 'REGISTRY_QUALITY', point: 'COMPLETENESS',
        scope: '登记处（全癌种合计）', method: 'REFERENCE参考值比较', threshold: 25, unit: '%', minSample: 100, severity: 'ATTENTION',
        window: '年度', basis: '粗发病率显著低于同类地区参考水平，提示漏报而非真实低发',
        params: '低于参考水平25%关注级；低于40%紧急级。需与 M/I、DCO% 联合研判', confirm: '已由省级登记中心确认' },

      /* ---------- C 疾病信号预警（地区 × 癌种 × 年度） ---------- */
      { id: 'C-ASR-TREND', name: '标化发病率持续偏离', type: 'DISEASE_SIGNAL', point: 'ASR_TREND',
        scope: '省定重点癌种 × 地市', method: 'TREND多期趋势', threshold: 20, unit: '%', minSample: 30, severity: 'ATTENTION',
        window: '年度（连续3年）', basis: '中标发病率连续3年同向变化且累计偏离≥20%，方视为趋势信号',
        params: '必须连续3年同向；单年跳变不触发。累计偏离≥35%升紧急级', confirm: '待省级专家组论证' },
      { id: 'C-CLUSTER', name: '地区聚集（标化率持续高于全省）', type: 'DISEASE_SIGNAL', point: 'SPATIAL_CLUSTER',
        scope: '省定重点癌种 × 县区', method: 'SIR标化比', threshold: 1.5, unit: '倍', minSample: 20, severity: 'ATTENTION',
        window: '年度（连续3年）', basis: '以全省为参照的标化发病比 SIR≥1.5 且 95%CI 下限＞1，连续3年成立',
        params: 'SIR≥2.0 或涉及职业/环境相关癌种升紧急级；结案需专家组论证', confirm: '待省级专家组论证' },
      { id: 'C-AGE-PROFILE', name: '年龄别发病构成异常', type: 'DISEASE_SIGNAL', point: 'AGE_PROFILE',
        scope: '省定重点癌种 × 地市', method: 'DISTRIBUTION分布偏离', threshold: 8, unit: '个百分点', minSample: 30, severity: 'ATTENTION',
        window: '年度', basis: '早发（＜50岁）病例占比偏离全省同癌种水平≥8个百分点',
        params: '需先排除年龄不明率超标与人口分母错误后才提交专家组', confirm: '待省级专家组论证' },
      { id: 'C-MORT-TREND', name: '标化死亡率持续上升', type: 'DISEASE_SIGNAL', point: 'MORTALITY_TREND',
        scope: '省定重点癌种 × 地市', method: 'TREND多期趋势', threshold: 15, unit: '%', minSample: 20, severity: 'ATTENTION',
        window: '年度（连续3年）', basis: '中标死亡率连续3年上升且累计升幅≥15%，与发病趋势联合研判生存变化',
        params: '若同期发病率未同向上升，优先核查随访与死因编码质量', confirm: '待省级专家组论证' },
      { id: 'C-DENOMINATOR', name: '人口分母异常（率值不可信）', type: 'DISEASE_SIGNAL', point: 'DENOMINATOR',
        scope: '地区人口基数', method: 'YOY同比', threshold: 5, unit: '%', minSample: 0, severity: 'URGENT',
        window: '年度', basis: '人口基数年度变动超过 5% 缺乏行政区划或普查依据时，本地区所有率值不可用',
        params: '触发后自动为同地区在途信号预警加上「分母待核」标注', confirm: '已由省级登记中心确认' },
      { id: 'C-INC-RATE-DEV', name: '发病率偏离近三年基线', type: 'DISEASE_SIGNAL', point: 'INC_RATE_BASELINE',
        scope: '省定重点癌种 × 地市', method: 'BASELINE近3年均值基线', threshold: 20, unit: '%', minSample: 30, severity: 'ATTENTION',
        window: '年度（对比近3年均值）', basis: '粗发病率偏离本地区近三年均值≥20%时发起研判线索；单年偏离不定性为疾病信号，结案需专家组论证',
        params: '偏离≥20%关注级；≥35%升紧急级。年病例数不足30例不参与评价', confirm: '待省级专家组论证' },
      { id: 'C-MOR-RATE-DEV', name: '死亡率偏离近三年基线', type: 'DISEASE_SIGNAL', point: 'MOR_RATE_BASELINE',
        scope: '省定重点癌种 × 地市', method: 'BASELINE近3年均值基线', threshold: 15, unit: '%', minSample: 30, severity: 'ATTENTION',
        window: '年度（对比近3年均值）', basis: '粗死亡率偏离本地区近三年均值≥15%时发起研判线索；与发病趋势及随访质量联合研判',
        params: '偏离≥15%关注级；≥30%升紧急级。年死亡数不足30例不参与评价', confirm: '待省级专家组论证' },
      { id: 'C-QUARTER-PREVIEW', name: '季度趋势预评（线索）', type: 'DISEASE_SIGNAL', point: 'QUARTER_PREVIEW',
        scope: '省定重点癌种 × 地市', method: 'TREND季度累计率', threshold: 25, unit: '%', minSample: 20, severity: 'INFO',
        window: '季度（年内累计外推）', basis: '为避免疾病信号拖到年报出来才发现，季度对年内累计率做趋势预评。但季度数据不完整、受上报节奏影响大，只能产出"研判线索"，严禁据此结案或对外发布为疾病流行结论——必须等年度数据齐备后由 C 层年度规则重新判定并经专家组论证',
        params: '年内累计率外推偏离近3年同期≥25%时提示线索；仅提示级（INFO），不自动升级、不自动结案、不生成对外结论。年内累计不足20例不参与', confirm: '待省级专家组论证' },
      { id: 'B-MI-TOTAL', name: 'M/I 死亡发病比（全癌种合计）', type: 'REGISTRY_QUALITY', point: 'MI_TOTAL',
        scope: '登记处（全癌种合计）', method: 'RANGE参考区间', threshold: 0.15, unit: '（偏离比例）', minSample: 200, severity: 'ATTENTION',
        window: '年度', basis: '全癌种合计 M/I 参考 0.45～0.70，偏离上下限 15% 判定；总量偏低提示死亡漏报，偏高提示发病漏报',
        params: '高于上限 15% 关注级；偏离超过 30% 升紧急级', confirm: '待省级登记中心确认' },
      { id: 'B-DCN-CANCER', name: 'DCN 未闭环（分癌种）', type: 'REGISTRY_QUALITY', point: 'DCN_CANCER',
        scope: '登记处 × 癌种（死亡库比对结果）', method: 'RATE比率上限', threshold: 20, unit: '%', minSample: 20, severity: 'ATTENTION',
        window: '年度', basis: '死亡库中未匹配到发病记录且未回溯补发病的病例占比，分癌种观察可定位到具体病种与科室',
        params: '未闭环率＞20%关注级；＞40%紧急级。比对命中不足20例不参与评价', confirm: '待省级登记中心确认' },
      { id: 'B-MV-CANCER', name: '分癌种形态学确诊比例偏低', type: 'REGISTRY_QUALITY', point: 'MV_CANCER',
        scope: '登记处 × 主要癌种', method: 'RATE比率下限', threshold: 66, unit: '%', minSample: 50, severity: 'ATTENTION',
        window: '年度', basis: '分癌种 MV% 低于 66% 时，该癌种诊断依据可信度不足，单癌种异常比合计值更能定位问题科室',
        params: 'MV%＜66%关注级；＜55%紧急级。年病例不足50例不参与', confirm: '待省级登记中心确认' },
      { id: 'ASSIGN-STALE', name: '重点预警长期未接收', type: 'REGISTRY_OPERATION', point: 'ASSIGN_STALE',
        scope: '全部未接收预警', method: 'STATE状态停留', threshold: 7, unit: '日', minSample: 0, severity: 'ATTENTION',
        window: '每日扫描', basis: '关注级及以上预警生成后超过7日仍未接收，说明责任分工或通知渠道存在问题',
        params: '超过7日未接收关注级；超过15日升紧急级。提示级线索不参与', confirm: '待省级登记中心确认' },
      { id: 'A-DCN-MONTH', name: '死亡补发病回溯逾期（月度）', type: 'REGISTRY_OPERATION', point: 'DCN_MONTHLY',
        scope: '登记处（死亡库比对结果）', method: 'RATE比率上限', threshold: 15, unit: '%', minSample: 30, severity: 'ATTENTION',
        window: '月度', basis: '死亡库比对出的病例应在30日内回溯补发病；超过30日未回填占比超过15%即触发，避免拖到年报才集中追赶',
        params: '超30日未回填＞15%关注级；＞30%紧急级。比对病例不足30例不参与', confirm: '待省级登记中心确认' }
    ];
    defs.forEach(def => {
      rules.push({
        id: def.id, ruleName: def.name, warningType: def.type, monitorPoint: def.point,
        dimensionScope: def.scope, compareMethod: def.method,
        thresholdValue: def.threshold, unit: def.unit, minSampleSize: def.minSample,
        defaultSeverity: def.severity, observeWindow: def.window, basis: def.basis,
        isEnabled: true, effectiveDate: '2026-01-01', activeVersion: 2, requiresSample: def.minSample > 0,
        updatedBy: '业务配置员', updatedAt: dateAt(-9, 10, 20),
        params: def.params, confirmation: '原型示例，尚未关联业务确认文件',
        falsePositiveCount: 0, reviewedCount: 0,
        history: [
          { version: 1, time: dateAt(-45, 9, 0), operator: '产品负责人', detail: '按三层预警框架创建（依据：' + def.basis + '）' },
          { version: 2, time: dateAt(-9, 10, 20), operator: '业务配置员', detail: '生效日期确认为 2026-01-01' }
        ],
        thresholdDisplay() { return this.thresholdValue + this.unit; }
      });
    });
  }

  /* ==================== 数据源（Mock：江西省口径） ==================== */
  /* A 层：机构 × 月 */
  const orgOperationStats = [
    { org: '南昌大学第一附属医院', city: '南昌市', current: 148, prev: 155, baseline12: 162, timeliness: 96.2, zeroMonths: 0, xiechaOverdue: 0, backlog: 12, backlogDays: 5 },
    { org: '江西省肿瘤医院', city: '南昌市', current: 386, prev: 371, baseline12: 402, timeliness: 98.1, zeroMonths: 0, xiechaOverdue: 0, backlog: 24, backlogDays: 7 },
    { org: '赣州市人民医院', city: '赣州市', current: 62, prev: 129, baseline12: 138, timeliness: 88.4, zeroMonths: 0, xiechaOverdue: 2, backlog: 9, backlogDays: 4 },
    { org: '九江市第一人民医院', city: '九江市', current: 95, prev: 98, baseline12: 104, timeliness: 72.6, zeroMonths: 0, xiechaOverdue: 1, backlog: 18, backlogDays: 9 },
    { org: '上饶市广丰区人民医院', city: '上饶市', current: 0, prev: 0, baseline12: 46, timeliness: 0, zeroMonths: 3, xiechaOverdue: 0, backlog: 0, backlogDays: 0 },
    { org: '宜春市袁州区中医院', city: '宜春市', current: 0, prev: 0, baseline12: 21, timeliness: 0, zeroMonths: 2, xiechaOverdue: 0, backlog: 0, backlogDays: 0 },
    { org: '吉安市中心人民医院', city: '吉安市', current: 88, prev: 90, baseline12: 92, timeliness: 91.5, zeroMonths: 0, xiechaOverdue: 6, backlog: 15, backlogDays: 11 },
    { org: '抚州市第一人民医院', city: '抚州市', current: 71, prev: 74, baseline12: 76, timeliness: 93.8, zeroMonths: 0, xiechaOverdue: 0, backlog: 86, backlogDays: 21 },
    { org: '新余市人民医院', city: '新余市', current: 96, prev: 41, baseline12: 44, timeliness: 94.1, zeroMonths: 0, xiechaOverdue: 0, backlog: 7, backlogDays: 3,
      momNote: '上月起接入院内病理系统自动抽取，历史积压病例集中补报' },
    { org: '鹰潭市人民医院', city: '鹰潭市', current: 58, prev: 36, baseline12: 39, timeliness: 92.4, zeroMonths: 0, xiechaOverdue: 1, backlog: 11, backlogDays: 6,
      momNote: '疑似同一批报告卡重复入库，需核对院内唯一号去重情况' }
  ];

  /* B 层：登记处 × 癌种 × 年度。mv/dco/ub/ou/ageUnknown 为例数，inc/death 为发病与死亡例数 */
  const MI_REFERENCE = {
    'C34 肺': { low: 0.55, high: 0.85 },
    'C16 胃': { low: 0.50, high: 0.80 },
    'C22 肝': { low: 0.70, high: 0.95 },
    'C50 乳腺': { low: 0.15, high: 0.35 },
    'C18 结肠': { low: 0.30, high: 0.55 },
    '全癌种合计': { low: 0.45, high: 0.70 }
  };
  /* 运行环境数据：多数对象达标；萍乡 C34 发病漏报（低于下限），宜春 C18 死亡漏报（高于上限），作对照观察 */
  const registryQualityStats = [
    { registry: '南昌市登记处', cancer: 'C34 肺', inc: 1268, death: 812, mv: 1042, dco: 74, refIncRate: 182.0, incRate: 179.4 },
    { registry: '南昌市登记处', cancer: 'C50 乳腺', inc: 736, death: 142, mv: 692, dco: 11, refIncRate: 182.0, incRate: 179.4 },
    { registry: '赣州市登记处', cancer: 'C34 肺', inc: 964, death: 705, mv: 561, dco: 168, refIncRate: 165.0, incRate: 152.8 },
    { registry: '赣州市登记处', cancer: 'C16 胃', inc: 518, death: 402, mv: 336, dco: 62, refIncRate: 165.0, incRate: 152.8 },
    { registry: '九江市登记处', cancer: 'C22 肝', inc: 402, death: 396, mv: 214, dco: 88, refIncRate: 166.0, incRate: 164.7 },
    { registry: '上饶市登记处', cancer: 'C34 肺', inc: 812, death: 498, mv: 604, dco: 96, refIncRate: 168.0, incRate: 169.5 },
    { registry: '宜春市登记处', cancer: 'C18 结肠', inc: 286, death: 182, mv: 238, dco: 9, refIncRate: 162.0, incRate: 160.9 },
    { registry: '萍乡市登记处', cancer: 'C34 肺', inc: 214, death: 96, mv: 118, dco: 41, refIncRate: 170.0, incRate: 118.6 }
  ];
  /* B 层：登记处全癌种合计口径（UB / O&U / 年龄不明 / DCN / 完整性） */
  const registryOverallStats = [
    { registry: '南昌市登记处', total: 11584, ub: 208, ou: 792, ageUnknown: 46, dcnTotal: 186, dcnOpen: 18, incRate: 181.2, refIncRate: 182.0, pop: 6400000 },
    { registry: '赣州市登记处', total: 13750, ub: 866, ou: 1622, ageUnknown: 402, dcnTotal: 312, dcnOpen: 138, incRate: 152.8, refIncRate: 168.0, pop: 9000000 },
    { registry: '九江市登记处', total: 7576, ub: 318, ou: 704, ageUnknown: 92, dcnTotal: 168, dcnOpen: 62, incRate: 164.7, refIncRate: 166.0, pop: 4600000 },
    { registry: '上饶市登记处', total: 10848, ub: 402, ou: 1188, ageUnknown: 118, dcnTotal: 204, dcnOpen: 26, incRate: 169.5, refIncRate: 168.0, pop: 6400000 },
    { registry: '萍乡市登记处', total: 2135, ub: 96, ou: 244, ageUnknown: 31, dcnTotal: 74, dcnOpen: 21, incRate: 118.6, refIncRate: 170.0, pop: 1800000 }
  ];

  /* C 层：地区 × 癌种 × 年度。asr 为中标发病率序列（近5年，末位为最新），mortAsr 为中标死亡率序列 */
  const diseaseSignalStats = [
    { region: '赣州市信丰县', cancer: 'C15 食管', level: '县区', asr: [12.4, 14.1, 16.8, 19.6, 22.9], provinceAsr: 11.8, mortAsr: [9.8, 10.4, 11.6, 12.9, 14.1], cases: 168, expected: 86, ciLow: 1.68, earlyShare: 6.2, provinceEarlyShare: 5.8, context: '' },
    { region: '九江市都昌县', cancer: 'C22 肝', level: '县区', asr: [28.6, 29.4, 31.2, 33.8, 35.1], provinceAsr: 21.4, mortAsr: [26.1, 27.0, 28.4, 30.2, 31.6], cases: 214, expected: 132, ciLow: 1.42, earlyShare: 18.4, provinceEarlyShare: 12.6, context: '' },
    { region: '南昌市', cancer: 'C50 乳腺', level: '地市', asr: [38.2, 41.6, 46.8, 52.4, 58.1], provinceAsr: 42.6, mortAsr: [8.4, 8.2, 8.1, 7.9, 7.8], cases: 736, expected: 612, ciLow: 1.08, earlyShare: 31.2, provinceEarlyShare: 28.4, context: '2024年起承接城市癌症早诊早治项目（乳腺筛查）' },
    { region: '上饶市', cancer: 'C34 肺', level: '地市', asr: [56.2, 55.8, 56.4, 56.1, 55.9], provinceAsr: 54.8, mortAsr: [41.2, 42.8, 44.6, 46.9, 48.2], cases: 812, expected: 794, ciLow: 0.96, earlyShare: 9.1, provinceEarlyShare: 8.8, context: '' },
    { region: '宜春市', cancer: 'C16 胃', level: '地市', asr: [24.1, 23.6, 24.4, 23.9, 24.2], provinceAsr: 25.1, mortAsr: [18.2, 18.0, 18.4, 18.1, 18.3], cases: 286, expected: 298, ciLow: 0.88, earlyShare: 7.4, provinceEarlyShare: 7.9, context: '' },
    { region: '吉安市', cancer: 'C34 肺', level: '地市', asr: [51.4, 52.1, 51.8, 52.6, 52.2], provinceAsr: 54.8, mortAsr: [38.4, 39.1, 38.8, 39.4, 39.0], cases: 604, expected: 628, ciLow: 0.92, earlyShare: 42.6, provinceEarlyShare: 8.8, context: '' },
    { region: '萍乡市', cancer: 'C34 肺', level: '地市', asr: [46.8, 42.1, 37.6, 33.2, 29.4], provinceAsr: 54.8, mortAsr: [34.2, 33.8, 33.1, 32.6, 32.0], cases: 214, expected: 268, ciLow: 0.72, earlyShare: 8.6, provinceEarlyShare: 8.8, context: '' }
  ];
  /* B 层新增：M/I 全癌种合计（登记处年度）。inc 发病例数，death 死亡例数，按全癌种参考区间判定 */
  const registryTotalQuality = [
    { registry: '南昌市登记处', inc: 11584, death: 7390 },   /* M/I 0.64 达标 */
    { registry: '赣州市登记处', inc: 13750, death: 4680 },   /* M/I 0.34 低于下限 0.383：死亡漏报或随访不足 */
    { registry: '九江市登记处', inc: 7576, death: 6350 },    /* M/I 0.84 高于上限 0.805：发病漏报 */
    { registry: '上饶市登记处', inc: 10848, death: 7289 },   /* M/I 0.67 达标 */
    { registry: '萍乡市登记处', inc: 2135, death: 1089 }     /* M/I 0.51 达标 */
  ];
  /* B 层新增：DCN 分癌种（登记处 × 癌种）。比对命中 dcnTotal，未回溯闭合 dcnOpen */
  const dcnCancerStats = [
    { registry: '赣州市登记处', cancer: 'C34 肺', dcnTotal: 126, dcnOpen: 62, note: '死亡库比对的肺癌病例多来自县域，随访员缺口导致未回溯' },
    { registry: '九江市登记处', cancer: 'C22 肝', dcnTotal: 58, dcnOpen: 21, note: '部分病例只在死因监测系统有记录，需院端补发病' },
    { registry: '萍乡市登记处', cancer: 'C16 胃', dcnTotal: 22, dcnOpen: 3, note: '总体积压较小，重点在个案回访' }
  ];
  /* C 层新增：登记处级年度粗发病率/粗死亡率序列（近4年，末位为最新），用于近三年基线偏离规则。
     incSeries / morSeries 均为 /10万；checksExpected 为与规则联动的说明。
     备注：演示口径，正式数据以年报为准。 */
  const baselineRateStats = [
    { region: '抚州市', level: '地市', cancer: 'C34 肺', incSeries: [62.4, 61.8, 63.1, 54.2], morSeries: [42.1, 42.6, 43.0, 43.8], cases: 412, note: '粗发病率较近三年均值下降约 14% 以下时，需排除上报延迟' },
    { region: '上饶市', level: '地市', cancer: 'C18 结肠', incSeries: [18.2, 18.6, 18.9, 23.4], morSeries: [9.4, 9.6, 9.7, 10.1], cases: 286, note: '粗发病率较近三年均值上升 20% 以上，需结合筛查项目研判' },
    { region: '宜春市', level: '地市', cancer: 'C16 胃', incSeries: [24.6, 24.2, 24.0, 24.1], morSeries: [18.2, 18.4, 18.5, 21.8], cases: 302, note: '发病率平稳但死亡率上升，优先核查死因编码与随访质量' },
    { region: '吉安市', level: '地市', cancer: 'C50 乳腺', incSeries: [29.4, 30.1, 30.8, 31.2], morSeries: [7.2, 7.1, 7.0, 6.9], cases: 268, note: '对照样本：发病与死亡均平稳' },
    { region: '九江市', level: '地市', cancer: 'C15 食管', incSeries: [15.8, 15.4, 15.1, 16.0], morSeries: [12.6, 12.4, 12.2, 12.3], cases: 186, note: '对照样本：接近近三年均值' }
  ];

  /* C 层：人口分母核查 */
  const populationChecks = [
    { region: '萍乡市', year: '2025', pop: 1800000, prevPop: 1620000, evidence: '', note: '' },
    { region: '新余市', year: '2025', pop: 1200000, prevPop: 1188000, evidence: '2024年统计年鉴', note: '' }
  ];

  /* A 层新增：国家上报批次状态（NCCR）。status: SUBMITTED/RETURNED/VALIDATE_FAILED/PENDING，daysToDeadline 为距报送窗口截止天数 */
  const nccrBatches = [
    { batch: '2024年度发病数据包', scope: '全省11地市', status: 'PENDING', daysToDeadline: 5, note: '上饶、宜春两地登记处数据包尚未并入省级汇总' },
    { batch: '2024年度死亡数据包', scope: '全省11地市', status: 'RETURNED', daysToDeadline: 12, note: '国家平台退回：死因编码 ICD-10 第4位缺失记录占比超限' },
    { batch: '2023年度发病数据包（补报）', scope: '赣州市登记处', status: 'VALIDATE_FAILED', daysToDeadline: 20, note: '数据包校验未通过：发病日期早于出生日期逻辑错误 46 条' }
  ];

  /* A 层新增：随访失访与死亡证明回收（区县登记处 / 季度）。lostRate 失访率%，dcReturnOverdueDays 死亡证明回收最长超期天数，enrolled 随访在册例数 */
  const followupStats = [
    { registry: '赣州市登记处', city: '赣州市', enrolled: 2860, lostRate: 24.6, dcReturnOverdueDays: 42, note: '县域随访员配置不足，部分乡镇连续两季度未开展主动随访' },
    { registry: '上饶市登记处', city: '上饶市', enrolled: 2140, lostRate: 38.2, dcReturnOverdueDays: 18, note: '外出务工人口占比高，电话随访接通率低' },
    { registry: '九江市登记处', city: '九江市', enrolled: 1680, lostRate: 11.4, dcReturnOverdueDays: 36, note: '失访率达标，但公安死亡证明回收渠道存在延迟' },
    { registry: '南昌市登记处', city: '南昌市', enrolled: 3200, lostRate: 8.6, dcReturnOverdueDays: 9, note: '' }
  ];

  /* C 层新增：季度趋势预评（年内累计率外推 vs 近3年同期）。cumRate 年内累计率，sameQBaseline 近3年同期均值，quarter 当前季度 */
  const quarterPreview = [
    { region: '赣州市信丰县', cancer: 'C15 食管', level: '县区', quarter: 'Q3', cumRate: 18.6, sameQBaseline: 13.8, cases: 126, note: '与年度 ASR 趋势信号方向一致，可作为年度研判的提前线索' },
    { region: '九江市都昌县', cancer: 'C22 肝', level: '县区', quarter: 'Q3', cumRate: 27.4, sameQBaseline: 21.0, cases: 158, note: '' },
    { region: '抚州市', cancer: 'C16 胃', level: '地市', quarter: 'Q3', cumRate: 14.2, sameQBaseline: 20.1, cases: 88, note: '年内累计偏低疑为上报节奏滞后，非真实下降，需待四季度数据补齐' }
  ];

  /* A 层新增：死亡补发病（DCN）按月回溯进度，按登记处。total 本月死亡库比对病例，closed 已回填发病，overdue 超过30日未回填。用于「死亡补发病回溯逾期」规则 */
  const dcnMonthly = [
    { registry: '赣州市登记处', city: '赣州市', total: 96, closed: 44, overdue: 38, note: '随访员缺口集中在县域，超30日病例以乡镇卫生院上报为主' },
    { registry: '九江市登记处', city: '九江市', total: 58, closed: 39, overdue: 12, note: '已建立院端补报提醒，个别病例仍在等待病理' },
    { registry: '南昌市登记处', city: '南昌市', total: 120, closed: 112, overdue: 3, note: '对照样本：回溯基本按期完成' }
  ];

  /* ==================== 预警与工单生成 ==================== */
  function createTicket(warning, created) {
    const meta = TYPE_META[warning.type];
    const ticket = {
      id: 'TCK-' + (++ticketSeq).toString().padStart(5, '0'),
      warningId: warning.id, type: warning.type, severity: warning.severity,
      status: 'PENDING', ownerOrg: warning.responsibleEntity || String(warning.targetId).split('|')[0], ownerRole: meta.firstOwner,
      assigneeUser: '', createdAt: created,
      slaDeadline: warning.observationOnly ? null : slaDeadline(warning.type, warning.severity, created),
      verificationResult: '', handlingNote: '', expertReviewNote: '', escalatedFrom: '', returnCount: 0,
      history: [{ time: created, action: '生成工单', detail: '按 ' + meta.code + ' 层责任矩阵自动派单至 ' + meta.firstOwner + '（' + meta.window + '口径）' }]
    };
    tickets.unshift(ticket);
    logAction({ time: created, layer: meta.code, ticketId: ticket.id, warningId: warning.id, action: '自动派单', to: meta.firstOwner, reason: '预警触发' });
    return ticket;
  }

  function createWarning(rule, payload) {
    if (!rule) return null;
    const created = payload.triggerTime || new Date();
    const dedupeKey = [rule.id, payload.targetId, payload.period || ''].join('|');
    const businessKey = /^B-MV-/.test(rule.id)
      ? ['MV', payload.targetId.replace(/\|MV分癌种$/, ''), payload.period || ''].join('|') : dedupeKey;
    const existing = warnings.find(item => item.businessKey === businessKey || item.dedupeKey === dedupeKey);
    if (existing) {
      existing.matchedRuleIds = Array.from(new Set((existing.matchedRuleIds || [existing.ruleId]).concat(rule.id)));
      if (currentRun) currentRun.duplicateCount++;
      return null;
    }
    const warning = {
      id: 'WRN-' + (++warningSeq).toString().padStart(5, '0'),
      ruleId: rule.id, ruleName: rule.ruleName, type: rule.warningType,
      monitorPoint: rule.monitorPoint, judgeBasis: rule.basis, observeWindow: rule.observeWindow,
      targetType: payload.targetType, targetId: payload.targetId, targetLabel: payload.targetLabel,
      responsibleEntity: payload.responsibleEntity || String(payload.targetId).split('|')[0],
      period: payload.period || '', metricValue: payload.metricValue, metricLabel: payload.metricLabel,
      thresholdSnapshot: payload.thresholdSnapshot || rule.thresholdDisplay(),
      severity: payload.severity || rule.defaultSeverity, status: 'PENDING',
      triggerTime: created,
      contextFlag: payload.contextFlag || '',
      denominatorFlag: !!payload.denominatorFlag,
      relatedWarningId: payload.relatedWarningId || '',
      observationOnly: !!payload.observationOnly || rule.id === 'C-QUARTER-PREVIEW',
      ruleVersion: rule.activeVersion || rule.history.length,
      parameterSnapshot: {
        threshold: rule.thresholdValue, unit: rule.unit, minSample: rule.minSampleSize,
        defaultSeverity: rule.defaultSeverity, effectiveDate: rule.effectiveDate,
        method: rule.compareMethod, scope: rule.dimensionScope
      },
      dataSource: TYPE_META[rule.warningType].source, dataMode: '示例数据',
      dataBatch: 'DEMO-' + (payload.period || '演示批次'),
      dedupeKey, businessKey, matchedRuleIds: [rule.id], snapshot: payload.snapshot || {}, evidence: payload.evidence || [],
      history: [{ time: created, action: '触发预警', detail: rule.ruleName + '命中，阈值快照：' + (payload.thresholdSnapshot || rule.thresholdDisplay()) + '；判定依据：' + rule.basis }]
    };
    if (payload.contextFlag) warning.history.push({ time: created, action: '情景标注', detail: payload.contextFlag + '（级别已自动下调一级）' });
    warnings.unshift(warning);
    createTicket(warning, new Date(created.getTime() + 60 * 1000));
    return warning;
  }

  /* ==================== A 层引擎：登记运行监测 ==================== */
  function runOperationEngine() {
    let created = 0;
    const period = PERIOD_MONTH;
    orgOperationStats.forEach(function (m) {
      const zeroRule = findRule('A-ZERO-REPORT');
      if (zeroRule.isEnabled && m.zeroMonths >= zeroRule.thresholdValue) {
        const severity = m.zeroMonths >= 3 ? 'URGENT' : 'ATTENTION';
        if (createWarning(zeroRule, {
          targetType: 'ORG', targetId: m.org, targetLabel: period + ' 连续零报 ' + m.zeroMonths + ' 个月', period,
          metricValue: m.zeroMonths, metricLabel: '连续零报 ' + m.zeroMonths + ' 个月', severity,
          snapshot: { 所属地市: m.city, 连续零报: m.zeroMonths + '个月', 近12月同期基线: m.baseline12 + '例/月', 触发线: zeroRule.thresholdDisplay(), 升级线: '3个月' },
          evidence: makeEvidence([['本月上报', m.current + '例'], ['近12月同期基线', m.baseline12 + '例'], ['核实要求', '确认是否停诊、机构撤并或账号失效']])
        })) created++;
      }
      const timeRule = findRule('A-TIMELINESS');
      if (timeRule.isEnabled && m.current >= timeRule.minSampleSize && m.timeliness < timeRule.thresholdValue) {
        const severity = m.timeliness < 75 ? 'URGENT' : 'ATTENTION';
        if (createWarning(timeRule, {
          targetType: 'ORG', targetId: m.org, targetLabel: period + ' 上报及时率 ' + n1(m.timeliness) + '%', period,
          metricValue: m.timeliness, metricLabel: '及时率 ' + n1(m.timeliness) + '%', severity,
          snapshot: { 所属地市: m.city, 及时率: n1(m.timeliness) + '%', 及时率下限: timeRule.thresholdDisplay(), 紧急线: '75%', 本月上报量: m.current + '例', 参评门槛: timeRule.minSampleSize + '例' },
          evidence: makeEvidence([['及时口径', '确诊后30日内上报'], ['本月及时率', n1(m.timeliness) + '%'], ['本月上报量', m.current + '例']])
        })) created++;
      }
      const volRule = findRule('A-VOLUME-DROP');
      if (volRule.isEnabled && m.baseline12 > 0 && m.baseline12 * 12 >= volRule.minSampleSize && m.zeroMonths === 0) {
        const deviation = (m.current - m.baseline12) / m.baseline12 * 100;
        if (deviation <= -volRule.thresholdValue) {
          const severity = deviation <= -60 ? 'URGENT' : 'ATTENTION';
          if (createWarning(volRule, {
            targetType: 'ORG', targetId: m.org, targetLabel: period + ' 上报量低于同期基线 ' + n1(Math.abs(deviation)) + '%', period,
            metricValue: deviation, metricLabel: '偏离基线 ' + percent(deviation), severity,
            snapshot: { 所属地市: m.city, 本月上报: m.current + '例', 近12月同期基线: m.baseline12 + '例', 偏离幅度: percent(deviation), 触发线: '-' + volRule.thresholdDisplay(), 紧急线: '-60%' },
            evidence: makeEvidence([['比较口径', '本机构近12个月同期基线（非上月环比）'], ['偏离幅度', percent(deviation)], ['核实要求', '区分诊疗量变化、系统对接中断与漏报']])
          })) created++;
        }
      }
      const momRule = findRule('A-VOLUME-MOM');
      if (momRule.isEnabled && m.prev >= momRule.minSampleSize) {
        const mom = (m.current - m.prev) / m.prev * 100;
        if (mom >= momRule.thresholdValue) {
          const severity = mom >= 100 ? 'URGENT' : 'ATTENTION';
          if (createWarning(momRule, {
            targetType: 'ORG', targetId: m.org, targetLabel: period + ' 上报量环比上升 ' + n1(mom) + '%', period,
            metricValue: mom, metricLabel: '环比 ' + percent(mom), severity,
            snapshot: { 所属地市: m.city, 本月上报: m.current + '例', 上月上报: m.prev + '例', 环比幅度: percent(mom), 近12月同期基线: m.baseline12 + '例', 触发线: '+' + momRule.thresholdDisplay(), 紧急线: '+100%', 参评门槛: '上月≥' + momRule.minSampleSize + '例' },
            evidence: makeEvidence([
              ['比较口径', '本月与上月上报量环比（监测上报行为，不是发病率环比）'],
              ['环比幅度', percent(mom)],
              ['初步线索', m.momNote || '待核实'],
              ['核实要求', '按序排除三种数据原因：① 集中补报（核对报告卡确诊日期分布）② 重复入库（核对院内唯一号去重）③ 上报口径或机构范围变更。三者均排除后方可提交 C 层疾病信号研判']
            ])
          })) created++;
        }
      }
      const xieRule = findRule('A-XIECHA-OVERDUE');
      if (xieRule.isEnabled && m.xiechaOverdue > 0) {
        const severity = m.xiechaOverdue >= 5 ? 'URGENT' : 'ATTENTION';
        if (createWarning(xieRule, {
          targetType: 'ORG', targetId: m.org, targetLabel: period + ' 协查超期 ' + m.xiechaOverdue + ' 件', period,
          metricValue: m.xiechaOverdue, metricLabel: '超期 ' + m.xiechaOverdue + ' 件', severity,
          snapshot: { 所属地市: m.city, 超期件数: m.xiechaOverdue + '件', 回复时限: xieRule.thresholdDisplay() + '（工作日）', 升级线: '5件' },
          evidence: makeEvidence([['超期协查', m.xiechaOverdue + '件'], ['时限口径', '协查函发出后15个工作日'], ['关联模块', '报告卡管理 · 信息协查']])
        })) created++;
      }
      const backRule = findRule('A-AUDIT-BACKLOG');
      if (backRule.isEnabled && (m.backlog >= backRule.thresholdValue || m.backlogDays >= 15)) {
        const severity = m.backlog >= 80 ? 'ATTENTION' : 'INFO';
        if (createWarning(backRule, {
          targetType: 'ORG', targetId: m.org, targetLabel: period + ' 审核积压 ' + m.backlog + ' 张', period,
          metricValue: m.backlog, metricLabel: '积压 ' + m.backlog + ' 张 / 最长 ' + m.backlogDays + ' 日', severity,
          snapshot: { 所属地市: m.city, 待审张数: m.backlog + '张', 最长停留: m.backlogDays + '日', 触发线: backRule.thresholdDisplay() + ' 或 15日', 关注线: '80张' },
          evidence: makeEvidence([['待审报告卡', m.backlog + '张'], ['最长停留', m.backlogDays + '日'], ['处理入口', '审核质控 · 待办工作台']])
        })) created++;
      }
    });

    /* A 层：重点预警长期未接收（每日扫描未接收的关注级及以上预警） */
    const staleRule = findRule('ASSIGN-STALE');
    if (staleRule && staleRule.isEnabled) {
      const now = Date.now();
      warnings.forEach(function (w) {
        if (w.observationOnly || w.ruleId === 'ASSIGN-STALE' || w.severity === 'INFO' || w.status === 'CLOSED') return;
        const tk = tickets.find(function (t) { return t.warningId === w.id; });
        if (!tk || tk.status !== 'PENDING') return;
        const delayDays = (now - new Date(w.triggerTime).getTime()) / 86400000;
        if (delayDays < staleRule.thresholdValue) return;
        const severity = delayDays >= 15 ? 'URGENT' : staleRule.defaultSeverity;
        if (createWarning(staleRule, {
          targetType: 'ORG', targetId: (w.targetId || w.id) + '|未接收', targetLabel: (w.ruleName || '预警') + ' 生成后 ' + Math.floor(delayDays) + ' 日未接收', period,
          metricValue: Math.floor(delayDays), metricLabel: '停留 ' + Math.floor(delayDays) + ' 日未接收', severity,
          relatedWarningId: w.id,
          snapshot: { 原预警: w.id + ' ' + w.ruleName, 原预警告级别: w.severity, 首办责任: tk.ownerOrg, 首办岗位: tk.ownerRole, 触发时间: fmtTime(w.triggerTime), 停留天数: Math.floor(delayDays) + ' 日', 触发线: staleRule.thresholdDisplay() },
          evidence: makeEvidence([
            ['定位', '原预警 ' + w.id + ' 仍处于未接收，先确认责任方后回填接收'],
            ['核查要求', '若原预警已通过其他渠道处理，应先补充处理记录再关闭'],
            ['提醒', '此条用于提醒分工与通知渠道，不代替原预警的处置结论']
          ])
        })) created++;
      });
    }
    if (staleRule && staleRule.isEnabled && !warnings.some(function (w) { return w.ruleId === 'ASSIGN-STALE' && w.status !== 'CLOSED'; })) {
      /* 演示兜底：现有数据未出现长期未接收时，用一条明确标注的演示样本说明该规则 */
      createWarning(staleRule, {
        targetType: 'ORG', targetId: '演示|未接收', targetLabel: '演示样本：重点预警生成后超 7 日未接收', period: '2026Q3',
        metricValue: 9, metricLabel: '停留 9 日未接收', severity: 'ATTENTION',
        snapshot: { 说明: '演示样本，用于展示「长期未接收」提醒机制', 触发线: staleRule.thresholdDisplay(), 处置建议: '先确认责任方是否收到通知，再回填接收或补充处理记录' },
        evidence: makeEvidence([['定位', '先找原预警确认是否已被其他渠道处理'], ['核实要求', '责任分工与通知渠道问题应反馈至登记中心'], ['提醒', '本规则只做提醒，不改变原预警状态']])
      });
    }

    /* A-NCCR-SUBMIT：国家上报批次异常（临近截止未提交 / 被退回 / 校验未过） */
    const nccrRule = findRule('A-NCCR-SUBMIT');
    if (nccrRule && nccrRule.isEnabled) {
      const stateText = { PENDING: '待提交', RETURNED: '已被国家平台退回', VALIDATE_FAILED: '数据包校验未通过', SUBMITTED: '已提交' };
      nccrBatches.forEach(function (b) {
        const nearDeadline = b.status === 'PENDING' && b.daysToDeadline <= nccrRule.thresholdValue;
        const abnormal = b.status === 'RETURNED' || b.status === 'VALIDATE_FAILED';
        if (!nearDeadline && !abnormal) return;
        const severity = (abnormal || b.daysToDeadline <= 3) ? 'URGENT' : 'ATTENTION';
        const reason = abnormal ? stateText[b.status] : ('距报送截止仅 ' + b.daysToDeadline + ' 日仍未提交');
        if (createWarning(nccrRule, {
          targetType: 'NCCR_BATCH', targetId: b.batch, responsibleEntity: '省级登记中心',
          targetLabel: b.batch + ' · ' + reason, period: PERIOD_YEAR,
          metricValue: b.daysToDeadline, metricLabel: stateText[b.status] + '（距截止 ' + b.daysToDeadline + ' 日）', severity,
          snapshot: { 上报批次: b.batch, 覆盖范围: b.scope, 批次状态: stateText[b.status], 距截止天数: b.daysToDeadline + '日', 触发线: '待提交≤' + nccrRule.thresholdDisplay() + ' 或 退回/校验未过', 紧急条件: '≤3日 或 被退回 或 校验未过' },
          evidence: makeEvidence([['当前状态', stateText[b.status]], ['问题说明', b.note || '-'], ['后果', '错过国家报送窗口将导致全省该年度数据无法纳入国家肿瘤登记库'], ['处理入口', '国家肿瘤数据上报 · 上报记录']])
        })) created++;
      });
    }

    /* A-FOLLOWUP-LOST：随访失访率超标 / 死亡证明回收超期 */
    const fuRule = findRule('A-FOLLOWUP-LOST');
    if (fuRule && fuRule.isEnabled) {
      followupStats.forEach(function (s) {
        if (s.enrolled < fuRule.minSampleSize) return;
        const lostHit = s.lostRate > fuRule.thresholdValue;
        const dcHit = s.dcReturnOverdueDays > 30;
        if (!lostHit && !dcHit) return;
        const severity = s.lostRate > 35 ? 'URGENT' : 'ATTENTION';
        const parts = [];
        if (lostHit) parts.push('失访率 ' + n1(s.lostRate) + '%');
        if (dcHit) parts.push('死亡证明回收超期 ' + s.dcReturnOverdueDays + ' 日');
        if (createWarning(fuRule, {
          targetType: 'REGISTRY', targetId: s.registry + '|随访', responsibleEntity: s.registry,
          targetLabel: '季度随访履职：' + parts.join(' · '), period: PERIOD_YEAR + 'Q3',
          metricValue: s.lostRate, metricLabel: parts.join(' · '), severity,
          snapshot: { 登记处: s.registry, 所属地市: s.city, 随访在册: s.enrolled + '例', 失访率: n1(s.lostRate) + '%', 失访率上限: fuRule.thresholdDisplay(), 紧急线: '35%', 死亡证明回收最长超期: s.dcReturnOverdueDays + '日', 回收时限: '30日' },
          evidence: makeEvidence([['失访率', n1(s.lostRate) + '%（上限 ' + fuRule.thresholdDisplay() + '）'], ['死亡证明回收最长超期', s.dcReturnOverdueDays + '日'], ['情况说明', s.note || '-'], ['后果', '失访拉低生存分析可信度、使 M/I 比失真；死亡证明回收延迟拖慢死亡补发病（DCN）闭环'], ['处理入口', '随访结局管理 · 随访任务列表']])
        })) created++;
      });
    }

    /* A 层：死亡补发病回溯逾期（月度，按月核对30日回填进度） */
    const dcnMonthRule = findRule('A-DCN-MONTH');
    if (dcnMonthRule && dcnMonthRule.isEnabled) {
      dcnMonthly.forEach(function (s) {
        if (s.total < dcnMonthRule.minSampleSize) return;
        const lateRate = s.overdue / s.total * 100;
        if (lateRate <= dcnMonthRule.thresholdValue) return;
        const severity = lateRate > 30 ? 'URGENT' : dcnMonthRule.defaultSeverity;
        if (createWarning(dcnMonthRule, {
          targetType: 'REGISTRY', targetId: s.registry + '|DCN月度', targetLabel: PERIOD_YEAR + 'Q3 ' + s.registry + ' 死亡补发病超30日未回填 ' + n1(lateRate) + '%', period: PERIOD_YEAR + 'Q3',
          metricValue: lateRate, metricLabel: '逾期 ' + n1(lateRate) + '%（' + s.overdue + '/' + s.total + '）', severity,
          snapshot: { 登记处: s.registry, 所属地市: s.city, 本月比对病例: s.total + '例', 已回填: s.closed + '例', 超30日未回填: s.overdue + '例', 逾期占比: n1(lateRate) + '%', 触发线: dcnMonthRule.thresholdDisplay() },
          evidence: makeEvidence([['指标依据', dcnMonthRule.basis], ['逾期病例', s.overdue + '例'], ['情况说明', s.note || '-'], ['处理入口', '随访结局管理 · 死亡补发病回溯']])
        })) created++;
      });
    }

    return created;
  }

  /* ==================== B 层引擎：登记质量预警 ==================== */
  function runQualityEngine() {
    let created = 0;
    const period = PERIOD_YEAR;

    registryQualityStats.forEach(function (s) {
      const target = s.registry + '|' + s.cancer;
      const mvRate = s.inc ? s.mv / s.inc * 100 : 0;
      const dcoRate = s.inc ? s.dco / s.inc * 100 : 0;
      const mi = s.inc ? s.death / s.inc : 0;

      const mvRule = findRule('B-MV-LOW');
      if (mvRule.isEnabled && s.inc >= mvRule.minSampleSize && mvRate < mvRule.thresholdValue) {
        const severity = mvRate < 55 ? 'URGENT' : 'ATTENTION';
        if (createWarning(mvRule, {
          targetType: 'REGISTRY_CANCER', targetId: target, targetLabel: period + '年 ' + s.registry + ' ' + s.cancer + ' MV% ' + n1(mvRate) + '%', period,
          metricValue: mvRate, metricLabel: 'MV% ' + n1(mvRate) + '%', severity,
          snapshot: { 登记处: s.registry, 癌种: s.cancer, 形态学确诊: s.mv + '例', 发病例数: s.inc + '例', 'MV%': n1(mvRate) + '%', 考核下限: mvRule.thresholdDisplay(), 紧急线: '55%' },
          evidence: makeEvidence([['指标依据', mvRule.basis], ['形态学确诊/发病', s.mv + ' / ' + s.inc + ' 例'], ['核实要求', '核对病理报告获取渠道与诊断依据编码']])
        })) created++;
      }

      const dcoRule = findRule('B-DCO-HIGH');
      if (dcoRule.isEnabled && s.inc >= dcoRule.minSampleSize && dcoRate > dcoRule.thresholdValue) {
        const severity = dcoRate > 25 ? 'URGENT' : 'ATTENTION';
        if (createWarning(dcoRule, {
          targetType: 'REGISTRY_CANCER', targetId: target, targetLabel: period + '年 ' + s.registry + ' ' + s.cancer + ' DCO% ' + n1(dcoRate) + '%', period,
          metricValue: dcoRate, metricLabel: 'DCO% ' + n1(dcoRate) + '%', severity,
          snapshot: { 登记处: s.registry, 癌种: s.cancer, 仅死亡证明来源: s.dco + '例', 发病例数: s.inc + '例', 'DCO%': n1(dcoRate) + '%', 考核上限: dcoRule.thresholdDisplay(), 紧急线: '25%' },
          evidence: makeEvidence([['指标依据', dcoRule.basis], ['DCO 例数', s.dco + '例'], ['联合研判', '与死亡补发病未闭环率一并核查']])
        })) created++;
      }

      const miRule = findRule('B-MI-RATIO');
      const ref = MI_REFERENCE[s.cancer];
      if (miRule.isEnabled && ref && s.inc >= miRule.minSampleSize) {
        const tol = miRule.thresholdValue;
        const highLine = ref.high * (1 + tol);
        const lowLine = ref.low * (1 - tol);
        let hint = '';
        if (mi > highLine) hint = '高于参考上限，提示发病漏报';
        else if (mi < lowLine) hint = '低于参考下限，提示死亡漏报或随访不足';
        if (hint) {
          if (createWarning(miRule, {
            targetType: 'REGISTRY_CANCER', targetId: target, targetLabel: period + '年 ' + s.registry + ' ' + s.cancer + ' M/I ' + n2(mi), period,
            metricValue: mi, metricLabel: 'M/I ' + n2(mi), severity: miRule.defaultSeverity,
            thresholdSnapshot: '参考区间 ' + n2(ref.low) + '~' + n2(ref.high) + '（容差' + (tol * 100) + '%）',
            snapshot: { 登记处: s.registry, 癌种: s.cancer, 'M/I 比': n2(mi), 参考区间: n2(ref.low) + ' ~ ' + n2(ref.high), 判定容差: (tol * 100) + '%', 提示: hint },
            evidence: makeEvidence([['指标依据', miRule.basis], ['死亡/发病', s.death + ' / ' + s.inc + ' 例'], ['方向提示', hint]])
          })) created++;
        }
      }

      /* B 层：分癌种 MV%（单癌种视角，用于定位具体病种的诊断依据问题） */
      const mvCancerRule = findRule('B-MV-CANCER');
      if (mvCancerRule && mvCancerRule.isEnabled && s.inc >= mvCancerRule.minSampleSize && mvRate < mvCancerRule.thresholdValue) {
        const severity = mvRate < 55 ? 'URGENT' : mvCancerRule.defaultSeverity;
        if (createWarning(mvCancerRule, {
          targetType: 'REGISTRY_CANCER', targetId: target + '|MV分癌种', targetLabel: period + '年 ' + s.registry + ' ' + s.cancer + ' MV% ' + n1(mvRate) + '%（分癌种）', period,
          metricValue: mvRate, metricLabel: 'MV% ' + n1(mvRate) + '%', severity,
          snapshot: { 登记处: s.registry, 癌种: s.cancer, 形态学确诊: s.mv + '例', 发病例数: s.inc + '例', 'MV%': n1(mvRate) + '%', 考核下限: mvCancerRule.thresholdDisplay(), 紧急线: '55%' },
          evidence: makeEvidence([['指标依据', mvCancerRule.basis], ['形态学确诊/发病', s.mv + ' / ' + s.inc + ' 例'], ['核实要求', '核对病理报告获取渠道与诊断依据编码']])
        })) created++;
      }
    });

    registryOverallStats.forEach(function (s) {
      const ubRate = s.total ? s.ub / s.total * 100 : 0;
      const ouRate = s.total ? s.ou / s.total * 100 : 0;
      const ageRate = s.total ? s.ageUnknown / s.total * 100 : 0;
      const dcnRate = s.dcnTotal ? s.dcnOpen / s.dcnTotal * 100 : 0;
      const compRule = findRule('B-COMPLETENESS');
      if (compRule.isEnabled && s.total >= compRule.minSampleSize && s.pop > 0 && s.refIncRate > 0) {
        const actualRate = s.total / s.pop * 100000;
        const gap = (actualRate - s.refIncRate) / s.refIncRate * 100;
        if (gap <= -compRule.thresholdValue && createWarning(compRule, {
          targetType: 'REGISTRY', targetId: s.registry + '|完整性', period,
          targetLabel: period + '年 ' + s.registry + ' 全癌种粗发病率低于参考水平 ' + n1(Math.abs(gap)) + '%',
          metricValue: gap, metricLabel: '低于参考 ' + n1(Math.abs(gap)) + '%',
          severity: gap <= -40 ? 'URGENT' : 'ATTENTION',
          snapshot: { 登记处: s.registry, 癌种: '全癌种合计', 发病例数: s.total + '例', 人口分母: s.pop + '人',
            本地粗发病率: n1(actualRate) + '/10万', 同类地区参考: n1(s.refIncRate) + '/10万', 差距: percent(gap) },
          evidence: makeEvidence([['计算口径', '全癌种发病例数 ÷ 同年度人口 × 100000'],
            ['指标依据', compRule.basis], ['联合研判', '结合 M/I、DCO% 和人口分母核查结果']])
        })) created++;
      }

      const ubRule = findRule('B-UB-HIGH');
      if (ubRule.isEnabled && s.total >= ubRule.minSampleSize && ubRate > ubRule.thresholdValue) {
        const severity = ubRate > 8 ? 'URGENT' : 'ATTENTION';
        if (createWarning(ubRule, {
          targetType: 'REGISTRY', targetId: s.registry, targetLabel: period + '年 ' + s.registry + ' UB% ' + n1(ubRate) + '%', period,
          metricValue: ubRate, metricLabel: 'UB% ' + n1(ubRate) + '%', severity,
          snapshot: { 登记处: s.registry, 部位不明例数: s.ub + '例', 全癌种合计: s.total + '例', 'UB%': n1(ubRate) + '%', 考核上限: ubRule.thresholdDisplay(), 紧急线: '8%' },
          evidence: makeEvidence([['指标依据', ubRule.basis], ['C80 例数', s.ub + '例'], ['核实要求', '回溯原始诊断信息，避免以 C80 兜底编码']])
        })) created++;
      }
      const ouRule = findRule('B-OU-HIGH');
      if (ouRule.isEnabled && s.total >= ouRule.minSampleSize && ouRate > ouRule.thresholdValue) {
        const severity = ouRate > 8 ? 'URGENT' : 'ATTENTION';
        if (createWarning(ouRule, {
          targetType: 'REGISTRY', targetId: s.registry + '|O&U', targetLabel: period + '年 ' + s.registry + ' O&U% ' + n1(ouRate) + '%', period,
          metricValue: ouRate, metricLabel: 'O&U% ' + n1(ouRate) + '%', severity,
          snapshot: { 登记处: s.registry, 其他及不明: s.ou + '例', 全癌种合计: s.total + '例', 'O&U%': n1(ouRate) + '%', 考核上限: ouRule.thresholdDisplay(), 紧急线: '8%' },
          evidence: makeEvidence([['指标依据', ouRule.basis], ['其他及不明例数', s.ou + '例'], ['核实要求', '核对 ICD-10 归类与部位字典映射']])
        })) created++;
      }
      const ageRule = findRule('B-AGE-UNKNOWN');
      if (ageRule.isEnabled && s.total >= ageRule.minSampleSize && ageRate > ageRule.thresholdValue) {
        const severity = ageRate > 2 ? 'URGENT' : 'ATTENTION';
        if (createWarning(ageRule, {
          targetType: 'REGISTRY', targetId: s.registry + '|年龄不明', targetLabel: period + '年 ' + s.registry + ' 年龄不明率 ' + n1(ageRate) + '%', period,
          metricValue: ageRate, metricLabel: '年龄不明率 ' + n1(ageRate) + '%', severity,
          snapshot: { 登记处: s.registry, 年龄不明: s.ageUnknown + '例', 全癌种合计: s.total + '例', 年龄不明率: n1(ageRate) + '%', 考核上限: ageRule.thresholdDisplay(), 紧急线: '2%' },
          evidence: makeEvidence([['指标依据', ageRule.basis], ['影响', '年龄别与标化率不可计算，将影响 C 层信号研判'], ['核实要求', '优先从身份证号与出生日期回补']])
        })) created++;
      }
      const dcnRule = findRule('B-DCN-OPEN');
      if (dcnRule.isEnabled && s.dcnTotal >= dcnRule.minSampleSize && dcnRate > dcnRule.thresholdValue) {
        const severity = dcnRate > 40 ? 'URGENT' : 'ATTENTION';
        if (createWarning(dcnRule, {
          targetType: 'REGISTRY', targetId: s.registry + '|DCN', targetLabel: period + '年 ' + s.registry + ' DCN 未闭环 ' + n1(dcnRate) + '%', period,
          metricValue: dcnRate, metricLabel: '未闭环 ' + n1(dcnRate) + '%（' + s.dcnOpen + '/' + s.dcnTotal + '）', severity,
          snapshot: { 登记处: s.registry, 待回溯: s.dcnOpen + '例', 比对命中: s.dcnTotal + '例', 未闭环率: n1(dcnRate) + '%', 考核上限: dcnRule.thresholdDisplay(), 紧急线: '40%' },
          evidence: makeEvidence([['指标依据', dcnRule.basis], ['未回溯病例', s.dcnOpen + '例'], ['后果', '未闭环病例将计入 DCO%，直接拉低可靠性指标']])
        })) created++;
      }
    });

    /* B 层：M/I 全癌种合计（总量视角，防止单癌种达标掩盖整体漏报） */
    const miTotalRule = findRule('B-MI-TOTAL');
    const totalRef = MI_REFERENCE['全癌种合计'];
    registryTotalQuality.forEach(function (s) {
      if (!miTotalRule || !miTotalRule.isEnabled || !totalRef || s.inc < miTotalRule.minSampleSize) return;
      const mi = s.death / s.inc;
      const tol = miTotalRule.thresholdValue;
      const highLine = totalRef.high * (1 + tol);
      const lowLine = totalRef.low * (1 - tol);
      let hint = '';
      if (mi > highLine) hint = '高于参考上限，提示发病漏报';
      else if (mi < lowLine) hint = '低于参考下限，提示死亡漏报或随访不足';
      if (!hint) return;
      if (createWarning(miTotalRule, {
        targetType: 'REGISTRY', targetId: s.registry + '|MI全癌种', targetLabel: period + '年 ' + s.registry + ' 全癌种 M/I ' + n2(mi), period,
        metricValue: mi, metricLabel: 'M/I ' + n2(mi), severity: miTotalRule.defaultSeverity,
        thresholdSnapshot: '参考区间 ' + n2(totalRef.low) + '~' + n2(totalRef.high) + '（容差' + (tol * 100) + '%）',
        snapshot: { 登记处: s.registry, 全癌种发病: s.inc + '例', 全癌种死亡: s.death + '例', 'M/I 比': n2(mi), 参考区间: n2(totalRef.low) + ' ~ ' + n2(totalRef.high), 判定容差: (tol * 100) + '%', 提示: hint },
        evidence: makeEvidence([['指标依据', miTotalRule.basis], ['死亡/发病', s.death + ' / ' + s.inc + ' 例'], ['方向提示', hint]])
      })) created++;
    });

    /* B 层：DCN 未闭环分癌种（定位到具体病种，便于院内分派） */
    const dcnCancerRule = findRule('B-DCN-CANCER');
    dcnCancerStats.forEach(function (s) {
      if (!dcnCancerRule || !dcnCancerRule.isEnabled || s.dcnTotal < dcnCancerRule.minSampleSize) return;
      const rate = s.dcnOpen / s.dcnTotal * 100;
      if (rate <= dcnCancerRule.thresholdValue) return;
      const severity = rate > 40 ? 'URGENT' : dcnCancerRule.defaultSeverity;
      if (createWarning(dcnCancerRule, {
        targetType: 'REGISTRY_CANCER', targetId: s.registry + '|' + s.cancer + '|DCN', targetLabel: period + '年 ' + s.registry + ' ' + s.cancer + ' DCN 未闭环 ' + n1(rate) + '%', period,
        metricValue: rate, metricLabel: '未闭环 ' + n1(rate) + '%（' + s.dcnOpen + '/' + s.dcnTotal + '）', severity,
        snapshot: { 登记处: s.registry, 癌种: s.cancer, 待回溯: s.dcnOpen + '例', 比对命中: s.dcnTotal + '例', 未闭环率: n1(rate) + '%', 考核上限: dcnCancerRule.thresholdDisplay() },
        evidence: makeEvidence([['指标依据', dcnCancerRule.basis], ['未回溯病例', s.dcnOpen + '例'], ['情况说明', s.note || '-']])
      })) created++;
    });
    return created;
  }

  /* ==================== C 层引擎：疾病信号预警 ==================== */
  function trendInfo(series) {
    if (!Array.isArray(series) || series.length < 4) return null;
    const tail = series.slice(-4); /* 需要 3 个变化区间 = 连续3年同向 */
    const diffs = [];
    for (let i = 1; i < tail.length; i++) diffs.push(tail[i] - tail[i - 1]);
    const allUp = diffs.every(function (d) { return d > 0; });
    const allDown = diffs.every(function (d) { return d < 0; });
    if (!allUp && !allDown) return null;
    const from = tail[0];
    const to = tail[tail.length - 1];
    if (!from) return null;
    return { direction: allUp ? 'up' : 'down', from, to, changePct: (to - from) / from * 100, years: diffs.length };
  }

  function denominatorSuspectRegions() {
    const rule = findRule('C-DENOMINATOR');
    const set = {};
    populationChecks.forEach(function (p) {
      if (!p.prevPop) return;
      const change = (p.pop - p.prevPop) / p.prevPop * 100;
      if (Math.abs(change) > rule.thresholdValue && !p.evidence) set[p.region] = change;
    });
    return set;
  }

  /* C 层：近三年基线偏离。最近一年 vs 前 3 年均值，返回偏离百分比 */
  function baselineDev(series) {
    if (!Array.isArray(series) || series.length < 4) return null;
    const latest = series[series.length - 1];
    const prior = series.slice(-4, -1);
    const mean = prior.reduce(function (a, b) { return a + b; }, 0) / prior.length;
    if (!mean) return null;
    return { latest: latest, mean: mean, prior: prior, devPct: (latest - mean) / mean * 100 };
  }

  function runBaselineEngine() {
    let created = 0;
    const period = PERIOD_YEAR;
    const incRule = findRule('C-INC-RATE-DEV');
    const morRule = findRule('C-MOR-RATE-DEV');
    baselineRateStats.forEach(function (s) {
      const inc = baselineDev(s.incSeries);
      if (incRule && incRule.isEnabled && inc && s.cases >= incRule.minSampleSize && Math.abs(inc.devPct) >= incRule.thresholdValue) {
        const severity = Math.abs(inc.devPct) >= 35 ? 'URGENT' : incRule.defaultSeverity;
        if (createWarning(incRule, {
          targetType: 'REGION_CANCER', targetId: s.region + '|' + s.cancer + '|发病基线',
          targetLabel: period + '年 ' + s.region + ' ' + s.cancer + ' 粗发病率偏离近三年均值 ' + percent(inc.devPct),
          period, metricValue: inc.devPct, metricLabel: '偏离 ' + percent(inc.devPct) + '（近3年均值 ' + n1(inc.mean) + '）', severity,
          snapshot: { 地区: s.region, 癌种: s.cancer, 粗发病率序列: s.incSeries.join(' → ') + ' /10万', 本年: n1(inc.latest) + '/10万', 近三年均值: n1(inc.mean) + '/10万', 偏离幅度: percent(inc.devPct), 触发线: '±' + incRule.thresholdDisplay() },
          evidence: makeEvidence([
            ['判定依据', incRule.basis],
            ['粗发病率序列', s.incSeries.join(' → ') + ' /10万'],
            ['情况说明', s.note || '-'],
            ['研判要求', '先排除上报延迟与人口分母错误，再判断是否为疾病趋势变化']
          ])
        })) created++;
      }
      const mor = baselineDev(s.morSeries);
      if (morRule && morRule.isEnabled && mor && s.cases >= morRule.minSampleSize && Math.abs(mor.devPct) >= morRule.thresholdValue && mor.devPct > 0) {
        const severity = Math.abs(mor.devPct) >= 30 ? 'URGENT' : morRule.defaultSeverity;
        if (createWarning(morRule, {
          targetType: 'REGION_CANCER', targetId: s.region + '|' + s.cancer + '|死亡基线',
          targetLabel: period + '年 ' + s.region + ' ' + s.cancer + ' 粗死亡率偏离近三年均值 ' + percent(mor.devPct),
          period, metricValue: mor.devPct, metricLabel: '偏离 ' + percent(mor.devPct) + '（近3年均值 ' + n1(mor.mean) + '）', severity,
          snapshot: { 地区: s.region, 癌种: s.cancer, 粗死亡率序列: s.morSeries.join(' → ') + ' /10万', 本年: n1(mor.latest) + '/10万', 近三年均值: n1(mor.mean) + '/10万', 偏离幅度: percent(mor.devPct), 触发线: '+' + morRule.thresholdDisplay() },
          evidence: makeEvidence([
            ['判定依据', morRule.basis],
            ['情况说明', s.note || '-'],
            ['研判要求', '先核查随访与死因编码质量，再判断是否为生存变化']
          ])
        })) created++;
      }
    });
    return created;
  }

  function runSignalEngine() {
    let created = 0;
    const period = PERIOD_YEAR;
    const denomRule = findRule('C-DENOMINATOR');

    /* 先跑分母核查：其结论会给同地区信号预警打「分母待核」标注 */
    populationChecks.forEach(function (p) {
      if (!denomRule.isEnabled || !p.prevPop) return;
      const change = (p.pop - p.prevPop) / p.prevPop * 100;
      if (Math.abs(change) > denomRule.thresholdValue && !p.evidence) {
        if (createWarning(denomRule, {
          targetType: 'REGION_POP', targetId: p.region + '|人口基数', targetLabel: period + '年 ' + p.region + ' 人口基数变动 ' + percent(change), period,
          metricValue: change, metricLabel: '人口基数 ' + percent(change), severity: denomRule.defaultSeverity,
          snapshot: { 地区: p.region, 本年人口: p.pop.toLocaleString('zh-CN'), 上年人口: p.prevPop.toLocaleString('zh-CN'), 变动幅度: percent(change), 触发线: '±' + denomRule.thresholdDisplay(), 依据材料: '缺失' },
          evidence: makeEvidence([['指标依据', denomRule.basis], ['人口基数变动', p.prevPop.toLocaleString('zh-CN') + ' → ' + p.pop.toLocaleString('zh-CN')], ['影响范围', '该地区所有发病率、死亡率、标化率均不可用'], ['处理入口', '基础数据 · 人口基数管理']])
        })) created++;
      }
    });
    const suspectDenominator = denominatorSuspectRegions();

    diseaseSignalStats.forEach(function (s) {
      const denomSuspect = Object.keys(suspectDenominator).some(function (r) { return s.region.indexOf(r) === 0; });
      const baseSnapshot = { 地区: s.region, 癌种: s.cancer, 层级: s.level, 观察窗口: '年度（近5年序列）' };

      /* C-ASR-TREND：中标发病率连续3年同向且累计偏离超阈值 */
      const trendRule = findRule('C-ASR-TREND');
      if (trendRule.isEnabled && s.cases >= trendRule.minSampleSize) {
        const t = trendInfo(s.asr);
        if (t && Math.abs(t.changePct) >= trendRule.thresholdValue) {
          let severity = Math.abs(t.changePct) >= 35 ? 'URGENT' : trendRule.defaultSeverity;
          if (s.context) severity = downgrade(severity);
          if (createWarning(trendRule, {
            targetType: 'REGION_CANCER', targetId: s.region + '|' + s.cancer + '|ASR趋势',
            targetLabel: period + '年 ' + s.region + ' ' + s.cancer + ' 中标发病率连续' + t.years + '年' + (t.direction === 'up' ? '上升' : '下降'),
            period, metricValue: t.changePct, metricLabel: '累计' + percent(t.changePct) + '（连续' + t.years + '年）', severity,
            contextFlag: s.context, denominatorFlag: denomSuspect,
            snapshot: Object.assign({}, baseSnapshot, {
              中标发病率序列: s.asr.join(' → ') + ' /10万',
              累计变化: percent(t.changePct), 全省水平: n1(s.provinceAsr) + '/10万',
              触发条件: '连续3年同向且累计偏离≥' + trendRule.thresholdDisplay(), 紧急线: '35%',
              情景标注: s.context || '无', 分母状态: denomSuspect ? '分母待核（该地区人口基数异常）' : '正常'
            }),
            evidence: makeEvidence([
              ['判定依据', trendRule.basis],
              ['中标发病率序列', s.asr.join(' → ')],
              ['与全省比较', n1(s.asr[s.asr.length - 1]) + ' vs 全省 ' + n1(s.provinceAsr) + ' /10万'],
              ['研判要求', '结案须选择结论口径并附专家组论证记录']
            ])
          })) created++;
        }
      }

      /* C-CLUSTER：SIR 及 95%CI 下限 */
      const clusterRule = findRule('C-CLUSTER');
      if (clusterRule.isEnabled && s.cases >= clusterRule.minSampleSize && s.expected > 0) {
        const sir = s.cases / s.expected;
        if (sir >= clusterRule.thresholdValue && s.ciLow > 1) {
          const occupational = ['C15 食管', 'C22 肝', 'C34 肺'].indexOf(s.cancer) >= 0;
          let severity = (sir >= 2.0 || occupational) ? 'URGENT' : clusterRule.defaultSeverity;
          if (s.context) severity = downgrade(severity);
          if (createWarning(clusterRule, {
            targetType: 'REGION_CANCER', targetId: s.region + '|' + s.cancer + '|聚集',
            targetLabel: period + '年 ' + s.region + ' ' + s.cancer + ' 标化发病比 SIR ' + n2(sir),
            period, metricValue: sir, metricLabel: 'SIR ' + n2(sir) + '（95%CI下限 ' + n2(s.ciLow) + '）', severity,
            contextFlag: s.context, denominatorFlag: denomSuspect, observationOnly: true,
            thresholdSnapshot: 'SIR≥' + clusterRule.thresholdDisplay() + ' 且 CI下限＞1',
            snapshot: Object.assign({}, baseSnapshot, {
              实际例数: s.cases + '例', 期望例数: n1(s.expected) + '例', SIR: n2(sir),
              '95%CI下限': n2(s.ciLow), 触发线: 'SIR≥' + clusterRule.thresholdDisplay(),
              紧急条件: 'SIR≥2.0 或职业/环境相关癌种',
              职业环境相关: occupational ? '是' : '否',
              情景标注: s.context || '无', 分母状态: denomSuspect ? '分母待核' : '正常'
            }),
            evidence: makeEvidence([
              ['判定依据', clusterRule.basis],
              ['实际/期望例数', s.cases + ' / ' + n1(s.expected) + ' 例'],
              ['持续性', '当前示例仅有单年度 SIR 与预置 CI，缺少逐年序列；作为待年度核查线索'],
              ['研判要求', occupational ? '职业/环境相关癌种，建议联动环境与职业史专项调查' : '需排除上报行为改变后提交专家组']
            ])
          })) created++;
        }
      }

      /* C-AGE-PROFILE：早发病例占比偏离 */
      const ageRule = findRule('C-AGE-PROFILE');
      if (ageRule.isEnabled && s.cases >= ageRule.minSampleSize) {
        const gap = s.earlyShare - s.provinceEarlyShare;
        if (Math.abs(gap) >= ageRule.thresholdValue) {
          let severity = ageRule.defaultSeverity;
          if (s.context) severity = downgrade(severity);
          if (createWarning(ageRule, {
            targetType: 'REGION_CANCER', targetId: s.region + '|' + s.cancer + '|年龄构成',
            targetLabel: period + '年 ' + s.region + ' ' + s.cancer + ' 早发病例占比偏离 ' + n1(gap) + ' 个百分点',
            period, metricValue: gap, metricLabel: '早发占比 ' + n1(s.earlyShare) + '%（全省 ' + n1(s.provinceEarlyShare) + '%）', severity,
            contextFlag: s.context, denominatorFlag: denomSuspect,
            snapshot: Object.assign({}, baseSnapshot, {
              '早发（＜50岁）占比': n1(s.earlyShare) + '%', 全省同癌种: n1(s.provinceEarlyShare) + '%',
              偏离: n1(gap) + '个百分点', 触发线: '±' + ageRule.thresholdDisplay(),
              前置排除项: '年龄不明率超标、人口分母错误',
              分母状态: denomSuspect ? '分母待核' : '正常'
            }),
            evidence: makeEvidence([
              ['判定依据', ageRule.basis],
              ['早发占比对比', n1(s.earlyShare) + '% vs 全省 ' + n1(s.provinceEarlyShare) + '%'],
              ['研判要求', '先确认 B 层年龄不明率达标，再判断是否为真实年龄构成变化']
            ])
          })) created++;
        }
      }

      /* C-MORT-TREND：中标死亡率连续上升 */
      const mortRule = findRule('C-MORT-TREND');
      if (mortRule.isEnabled && s.cases >= mortRule.minSampleSize) {
        const mt = trendInfo(s.mortAsr);
        if (mt && mt.direction === 'up' && mt.changePct >= mortRule.thresholdValue) {
          const incTrend = trendInfo(s.asr);
          const incAligned = incTrend && incTrend.direction === 'up';
          let severity = mortRule.defaultSeverity;
          if (s.context) severity = downgrade(severity);
          if (createWarning(mortRule, {
            targetType: 'REGION_CANCER', targetId: s.region + '|' + s.cancer + '|死亡趋势',
            targetLabel: period + '年 ' + s.region + ' ' + s.cancer + ' 中标死亡率连续' + mt.years + '年上升',
            period, metricValue: mt.changePct, metricLabel: '累计' + percent(mt.changePct) + '（连续' + mt.years + '年）', severity,
            contextFlag: s.context, denominatorFlag: denomSuspect,
            snapshot: Object.assign({}, baseSnapshot, {
              中标死亡率序列: s.mortAsr.join(' → ') + ' /10万',
              累计升幅: percent(mt.changePct), 触发线: mortRule.thresholdDisplay(),
              发病是否同向: incAligned ? '是（发病同期上升）' : '否（发病未同向上升）',
              优先核查: incAligned ? '疾病负担真实上升可能性' : '随访完整性与死因编码质量',
              分母状态: denomSuspect ? '分母待核' : '正常'
            }),
            evidence: makeEvidence([
              ['判定依据', mortRule.basis],
              ['中标死亡率序列', s.mortAsr.join(' → ')],
              ['发病趋势', incAligned ? '同期上升' : '未同向上升'],
              ['研判要求', incAligned ? '与发病趋势合并研判疾病负担' : '先核查随访与死因编码，再判断生存恶化']
            ])
          })) created++;
        }
      }
    });

    /* C-QUARTER-PREVIEW：季度趋势预评——只产线索，强制 INFO、不升级、不结案 */
    const qpRule = findRule('C-QUARTER-PREVIEW');
    if (qpRule && qpRule.isEnabled) {
      quarterPreview.forEach(function (q) {
        if (q.cases < qpRule.minSampleSize || !q.sameQBaseline) return;
        const dev = (q.cumRate - q.sameQBaseline) / q.sameQBaseline * 100;
        if (Math.abs(dev) < qpRule.thresholdValue) return;
        if (createWarning(qpRule, {
          targetType: 'REGION_CANCER', targetId: q.region + '|' + q.cancer + '|季度预评',
          targetLabel: PERIOD_YEAR + '年' + q.quarter + ' ' + q.region + ' ' + q.cancer + ' 累计率预评偏离 ' + percent(dev) + '（线索）',
          period: PERIOD_YEAR + q.quarter,
          metricValue: dev, metricLabel: '季度累计率偏离 ' + percent(dev) + '（仅线索）',
          severity: 'INFO', /* 强制提示级：季度预评绝不自动升级为关注/紧急 */
          snapshot: Object.assign({}, { 地区: q.region, 癌种: q.cancer, 层级: q.level }, {
            统计口径: PERIOD_YEAR + '年' + q.quarter + ' 年内累计率',
            年内累计率: n1(q.cumRate) + '/10万', 近3年同期均值: n1(q.sameQBaseline) + '/10万',
            偏离幅度: percent(dev), 提示线: '±' + qpRule.thresholdDisplay(),
            性质: '研判线索（非结论）', 处置约束: '不自动升级 · 不自动结案 · 不对外发布'
          }),
          evidence: makeEvidence([
            ['判定依据', qpRule.basis],
            ['年内累计率 vs 近3年同期', n1(q.cumRate) + ' vs ' + n1(q.sameQBaseline) + ' /10万'],
            ['线索说明', q.note || '-'],
            ['⚠ 处置红线', '季度数据不完整，本条仅为提示性线索；严禁据此结案或对外发布为疾病流行结论，须待年度数据齐备后由 C 层年度规则重新判定并经专家组论证']
          ])
        })) created++;
      });
    }

    return created;
  }

  function runAllEngines() {
    applyDueRuleVersions();
    const run = { time: new Date(), operator: currentOperator(), status: 'COMPLETED', newCount: 0, duplicateCount: 0, mode: '示例数据计算' };
    const beforeCount = warnings.length;
    currentRun = run;
    try {
      runOperationEngine(); runQualityEngine(); runSignalEngine(); runBaselineEngine();
    } catch (error) {
      run.status = 'FAILED'; run.error = error.message;
    } finally { run.newCount = warnings.length - beforeCount; currentRun = null; warningRuns.unshift(run); }
    toast(run.status === 'FAILED' ? '本次示例计算失败，请查看执行记录'
      : '示例计算完成：新增 ' + run.newCount + ' 条，重复命中 ' + run.duplicateCount + ' 条', run.status === 'FAILED' ? 'error' : 'success');
    renderPage(state.page);
  }
  function runLayerEngine(type) {
    applyDueRuleVersions();
    const count = type === 'REGISTRY_OPERATION' ? runOperationEngine()
      : type === 'REGISTRY_QUALITY' ? runQualityEngine()
        : runSignalEngine() + runBaselineEngine();
    toast(count ? TYPE_META[type].label + '计算完成，新增 ' + count + ' 条' : TYPE_META[type].label + '本轮无新命中');
    renderPage(state.page);
  }

  function scanOverdue() {
    let count = 0;
    const now = Date.now();
    tickets.forEach(function (ticket) {
      if (['CLOSED', 'ESCALATED'].includes(ticket.status) || !ticket.slaDeadline || new Date(ticket.slaDeadline).getTime() >= now) return;
      const warning = findWarning(ticket.warningId);
      const meta = TYPE_META[ticket.type];
      ticket.status = 'ESCALATED';
      ticket.escalatedFrom = ticket.escalatedFrom || ticket.ownerRole;
      ticket.ownerRole = meta.escalateOwner;
      ticket.history.push({ time: new Date(), action: '超时升级', detail: 'SLA（' + slaText(ticket.type, ticket.severity) + '）超时，推送至' + meta.escalateOwner });
      if (warning) {
        warning.status = 'ESCALATED';
        warning.history.push({ time: new Date(), action: '工单升级', detail: ticket.id + '超时升级至' + meta.escalateOwner });
      }
      logAction({ layer: meta.code, ticketId: ticket.id, warningId: ticket.warningId, action: '超时自动升级', from: ticket.escalatedFrom, to: meta.escalateOwner, reason: slaText(ticket.type, ticket.severity) + '内未完成响应' });
      count++;
    });
    toast(count ? '已升级 ' + count + ' 张超时工单' : '暂无新的超时工单');
    renderPage(state.page);
  }

  /* ==================== 统计分析联动：M/I 判定与工单生成 ==================== */
  /* 供统计分析页复用：按癌种参考区间判定 M/I（实时读取当前规则配置），色带 ok|watch|abnormal */
  function miJudge(cancer, inc, death) {
    const rule = findRule('B-MI-RATIO');
    const ref = MI_REFERENCE[cancer];
    if (!rule || !rule.isEnabled || !ref || !inc || inc < rule.minSampleSize) return null;
    const tol = rule.thresholdValue;
    const mi = death / inc;
    const highLine = ref.high * (1 + tol);
    const lowLine = ref.low * (1 - tol);
    let band = 'ok', hint = '';
    if (mi > highLine) { band = 'abnormal'; hint = '高于参考上限，提示发病漏报'; }
    else if (mi < lowLine) { band = 'abnormal'; hint = '低于参考下限，提示死亡漏报或随访不足'; }
    else if (mi > ref.high || mi < ref.low) { band = 'watch'; }
    let dev = null;
    if (band === 'abnormal') {
      dev = mi < ref.low
        ? { dir: '低于参考下限', abs: ref.low - mi, pct: (ref.low - mi) / ref.low * 100 }
        : { dir: '高于参考上限', abs: mi - ref.high, pct: (mi - ref.high) / ref.high * 100 };
    }
    return {
      ruleId: rule.id, ruleName: rule.ruleName, severity: rule.defaultSeverity,
      severityLabel: (SEVERITY_META[rule.defaultSeverity] || {}).label || rule.defaultSeverity,
      basis: rule.basis, minSample: rule.minSampleSize,
      kind: 'mi', cancer, inc, death, mi, ref, tol, highLine, lowLine, band, hint, dev
    };
  }
  /* 供统计分析页联动：按 dedupeKey 复用已有预警（含工单），无则建预警+工单（createWarning 内部自动派单） */
  function createStatsWarning(ruleId, payload) {
    const rule = findRule(ruleId);
    if (!rule) return null;
    const key = [ruleId, payload.targetId, payload.period || ''].join('|');
    const existing = warnings.find(item => item.dedupeKey === key);
    if (existing) return { warning: existing, ticket: findTicketByWarning(existing.id), created: false };
    const w = createWarning(rule, payload);
    return w ? { warning: w, ticket: findTicketByWarning(w.id), created: true } : null;
  }
  /* 供统计分析页复用：率值（发病率/死亡率）与近三年基线的偏离判定，色带 ok|watch|abnormal
     阈值口径与 A 层基线类规则一致：unit '%'，thresholdValue 按百分数比较 */
  function devJudge(ruleId, cancer, metricLabel, current, baseline) {
    const rule = findRule(ruleId);
    if (!rule || !rule.isEnabled || !baseline || baseline <= 0) return null;
    const tol = rule.thresholdValue;
    const dev = (current - baseline) / baseline * 100;
    let band = 'ok', hint = '';
    if (dev > tol) { band = 'abnormal'; hint = metricLabel + '高于近三年基线阈值，需区分真实升高、筛查项目影响或上报行为改变'; }
    else if (dev < -tol) { band = 'abnormal'; hint = metricLabel + '低于近三年基线阈值，提示漏报、随访不足或口径变化'; }
    else if (Math.abs(dev) >= tol * 0.6) { band = 'watch'; }
    const devInfo = {
      dir: dev >= 0 ? '高于三年基线' : '低于三年基线',
      abs: Math.abs(current - baseline), pct: Math.abs(dev)
    };
    return {
      kind: 'rate', ruleId: rule.id, ruleName: rule.ruleName, severity: rule.defaultSeverity,
      severityLabel: (SEVERITY_META[rule.defaultSeverity] || {}).label || rule.defaultSeverity,
      basis: rule.basis, minSample: rule.minSampleSize,
      cancer, metricLabel, current, baseline, tol, dev, band, hint, dev: devInfo
    };
  }

  /* ==================== 种子数据：制造若干已流转的样例 ==================== */
  function seedData() {
    runOperationEngine();
    runQualityEngine();
    runSignalEngine();
    runBaselineEngine();

    /* 样例1：B 层 MV% 已完成整改并关闭 */
    const closed = warnings.find(function (w) { return w.ruleId === 'B-MV-LOW' && w.targetId.indexOf('赣州') === 0; });
    if (closed) {
      const t = findTicketByWarning(closed.id);
      closed.status = 'CLOSED';
      t.status = 'CLOSED';
      t.createdAt = dateAt(-32, 9, 10);
      t.slaDeadline = addWorkDays(t.createdAt, 10);
      t.feedbackAt = dateAt(-21, 14, 30);
      t.closedAt = dateAt(-18, 10, 5);
      closed.triggerTime = dateAt(-32, 9, 0);
      t.verificationResult = '属实-已修正复算达标';
      t.closureReason = 'RESOLVED';
      t.recalculation = { before: closed.metricValue, after: 71.4, evidence: '示例病理字段映射修正批次', mode: '前端手工核对示例' };
      t.handlingNote = '示例整改：修正病理诊断依据字段映射并回溯补录，复算 MV% 由 ' + n1(closed.metricValue) + '% 升至 71.4%。';
      t.history.push(
        { time: t.feedbackAt, action: '提交反馈', detail: '结论：属实-口径或编码问题；' + t.handlingNote },
        { time: t.closedAt, action: '复核关闭', detail: '省级登记中心复算确认达标，预警关闭' }
      );
      closed.history.push({ time: t.closedAt, action: '预警关闭', detail: t.id + ' 复算 MV% 达标' });
      const r = findRule('B-MV-LOW');
      r.reviewedCount += 1;
      logAction({ time: t.closedAt, layer: 'B', ticketId: t.id, warningId: closed.id, action: '复核关闭', from: '已反馈', to: '已关闭', reason: '复算达标' });
    }

    /* 样例2：A 层零报工单超时升级至地市登记处 */
    const escalated = warnings.find(function (w) { return w.ruleId === 'A-ZERO-REPORT' && w.targetId.indexOf('宜春') === 0; });
    if (escalated) {
      const t = findTicketByWarning(escalated.id);
      escalated.status = 'ESCALATED';
      t.status = 'ESCALATED';
      t.createdAt = dateAt(-9, 8, 30);
      escalated.triggerTime = dateAt(-9, 8, 0);
      t.slaDeadline = addWorkDays(t.createdAt, 3);
      t.escalatedFrom = TYPE_META.REGISTRY_OPERATION.firstOwner;
      t.ownerRole = TYPE_META.REGISTRY_OPERATION.escalateOwner;
      t.history.push({ time: dateAt(-3, 9, 0), action: '超时升级', detail: '超过3个工作日未接收，升级推送至地市登记处' });
      logAction({ time: dateAt(-3, 9, 0), layer: 'A', ticketId: t.id, warningId: escalated.id, action: '超时自动升级', from: t.escalatedFrom, to: t.ownerRole, reason: 'SLA 3个工作日超时' });
    }

    /* 样例3：有多年度序列的趋势信号进入专家组论证（已反馈待复核） */
    const signal = warnings.find(function (w) { return w.ruleId === 'C-ASR-TREND' && w.targetId.indexOf('赣州市信丰县') === 0; });
    if (signal) {
      const t = findTicketByWarning(signal.id);
      signal.status = 'FEEDBACK';
      t.status = 'FEEDBACK';
      t.createdAt = dateAt(-26, 9, 0);
      signal.triggerTime = dateAt(-26, 8, 50);
      t.slaDeadline = addWorkDays(t.createdAt, 20);
      t.assigneeUser = '赣州市疾控 · 刘工';
      t.feedbackAt = dateAt(-6, 16, 20);
      t.verificationResult = '疑似真实升高';
      t.handlingNote = '示例研判：已核对现有标化发病率序列，连续三年同向变化。建议继续核对上报行为、人口基数和登记质量后提交专家组。';
      t.expertReviewNote = '省级专家组初审意见：同意「疑似真实升高」，要求补充近5年乡镇级病例地址核准结果后再定稿。';
      t.history.push(
        { time: dateAt(-24, 10, 0), action: '接收工单', detail: '赣州市疾控确认接收' },
        { time: t.feedbackAt, action: '提交研判', detail: '结论：疑似真实升高；' + t.handlingNote },
        { time: dateAt(-4, 15, 0), action: '专家组论证', detail: t.expertReviewNote }
      );
      signal.history.push({ time: t.feedbackAt, action: '研判反馈', detail: t.id + '：疑似真实升高，待专家组定稿' });
      logAction({ time: t.feedbackAt, layer: 'C', ticketId: t.id, warningId: signal.id, action: '提交反馈', from: '处理中', to: '已反馈', reason: '疑似真实升高' });
    }

    /* 样例4：C 层乳腺癌趋势因筛查项目被判定为筛查影响并关闭（记为误报口径外的情景结论） */
    const screen = warnings.find(function (w) { return w.ruleId === 'C-ASR-TREND' && w.targetId.indexOf('南昌市|C50') === 0; });
    if (screen) {
      const t = findTicketByWarning(screen.id);
      screen.status = 'CLOSED';
      t.status = 'CLOSED';
      t.createdAt = dateAt(-40, 9, 0);
      t.slaDeadline = addWorkDays(t.createdAt, 20);
      t.feedbackAt = dateAt(-22, 11, 0);
      t.closedAt = dateAt(-15, 9, 40);
      screen.triggerTime = dateAt(-40, 8, 50);
      t.closureReason = 'REVIEWED';
      t.verificationResult = '筛查项目影响';
      t.handlingNote = '南昌市 2024 年起承接城市癌症早诊早治项目，乳腺筛查覆盖 40-69 岁女性 12.6 万人，早期病例检出增加。同期中标死亡率连续下降，符合筛查引起的发病率前移特征。';
      t.expertReviewNote = '省级专家组结论：判定为筛查项目导致的发病率前移，非真实疾病负担上升；建议后续按「筛查覆盖人群/非覆盖人群」分层监测。';
      t.history.push(
        { time: t.feedbackAt, action: '提交研判', detail: '结论：筛查项目影响；' + t.handlingNote },
        { time: dateAt(-17, 14, 0), action: '专家组论证', detail: t.expertReviewNote },
        { time: t.closedAt, action: '复核关闭', detail: '专家组论证通过，转入分层监测清单' }
      );
      screen.history.push({ time: t.closedAt, action: '预警关闭', detail: t.id + ' 专家组判定为筛查影响' });
      const r = findRule('C-ASR-TREND');
      r.reviewedCount += 1;
      logAction({ time: t.closedAt, layer: 'C', ticketId: t.id, warningId: screen.id, action: '复核关闭', from: '已反馈', to: '已关闭', reason: '筛查项目影响' });
    }

    /* 样例5：A 层协查超期被判定误报（协查已回复但回执未入库） */
    const falsePositive = warnings.find(function (w) { return w.ruleId === 'A-XIECHA-OVERDUE' && w.targetId.indexOf('九江') === 0; });
    if (falsePositive) {
      const t = findTicketByWarning(falsePositive.id);
      falsePositive.status = 'CLOSED';
      t.status = 'CLOSED';
      t.createdAt = dateAt(-19, 9, 0);
      t.slaDeadline = addWorkDays(t.createdAt, 3);
      t.feedbackAt = dateAt(-17, 10, 20);
      t.closedAt = dateAt(-16, 9, 15);
      falsePositive.triggerTime = dateAt(-19, 8, 50);
      t.closureReason = 'FALSE_POSITIVE';
      t.verificationResult = '误报';
      t.handlingNote = '协查回执已于时限内提交，因附件上传失败未写入协查库，回执原件与提交时间戳已提供。';
      t.history.push(
        { time: t.feedbackAt, action: '提交反馈', detail: '结论：误报；' + t.handlingNote },
        { time: t.closedAt, action: '复核关闭', detail: '确认误报，已计入规则误报率并提请修复协查附件上传' }
      );
      const r = findRule('A-XIECHA-OVERDUE');
      r.reviewedCount += 1;
      r.falsePositiveCount += 1;
      logAction({ time: t.closedAt, layer: 'A', ticketId: t.id, warningId: falsePositive.id, action: '复核关闭', from: '已反馈', to: '已关闭', reason: '误报' });
    }
  }

  /* ==================== 通用 UI 片段 ==================== */
  function waHeader(title, subtitle, actions) {
    return '<div class="wa-head"><div><div class="wa-title">' + esc(title) + '</div>' + (subtitle ? '<div class="wa-sub">' + subtitle + '</div>' : '') + '</div><div class="wa-actions">' + actions.join('') + '</div></div>';
  }
  function waKpi(label, value, meta, tone, drill) {
    const clickable = drill ? ' wa-kpi-click' : '';
    const hint = '';
    const click = drill ? ' onclick="waKpiDrill(\'' + drill.group + "','" + drill.key + "','" + drill.value + "')\"" : '';
    return '<div class="wa-kpi' + clickable + '"' + click + '><div class="wa-kpi-label">' + esc(label) + '</div><div class="wa-kpi-value ' + (tone || '') + '">' + value + '</div><div class="wa-kpi-meta">' + esc(meta) + '</div>' + hint + '</div>';
  }
  /* KPI 钻取：设筛选条件后重渲染当前页，并滚动到表格区 */
  function waKpiDrill(group, key, value) {
    if (group === '_nav') { closeWarningModals(); if (window.navigateTo) navigateTo(value); return; }
    state[group][key] = value;
    renderPage(state.page);
    setTimeout(function () {
      const tbl = document.querySelector('#pageContainer .wa-table-wrap');
      if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }
  function waModal(title, body, foot, narrow) {
    const mask = document.createElement('div');
    mask.className = 'wa-modal-mask';
    mask.innerHTML = '<div class="wa-modal' + (narrow ? ' narrow' : '') + '"><div class="wa-modal-head"><div class="wa-modal-title">' + esc(title) + '</div><button class="wa-close" aria-label="关闭">×</button></div><div class="wa-modal-body">' + body + '</div>' + (foot ? '<div class="wa-modal-foot">' + foot + '</div>' : '') + '</div>';
    mask.addEventListener('click', function (event) { if (event.target === mask) mask.remove(); });
    mask.querySelector('.wa-close').addEventListener('click', function () { mask.remove(); });
    const host = document.getElementById('pageContainer');
    (host || document.body).appendChild(mask);
    return mask;
  }
  function waSetFilter(group, key, value) { state[group][key] = value; renderPage(state.page); }
  function waOnKeyword(el, group) {
    state[group].keyword = el.value;
    if (!el.id) el.id = 'waKw-' + group;
    const refocus = function () {
      const node = document.getElementById(el.id);
      if (node) { node.focus(); const len = node.value.length; if (node.setSelectionRange) node.setSelectionRange(len, len); }
    };
    if (typeof window.autoQuery === 'function') window.autoQuery(function () { renderPage(state.page); refocus(); });
    else { renderPage(state.page); refocus(); }
  }
  function waSetRecordType(value) { state.record.type = value; renderPage('warning-records'); }
  function waSetRuleType(value) { state.rule.type = value; renderPage('warning-rules'); }
  function waGo(type) { state.record.type = type; navigateTo('warning-records'); }
  function closeWarningModals() { document.querySelectorAll('.wa-modal-mask').forEach(function (mask) { mask.remove(); }); }
  function waNavigate(pageId) { closeWarningModals(); navigateTo(pageId); }
  function layerTabs(current, handler) {
    return [['ALL', '全部']].concat(TYPE_KEYS.map(function (k) { return [k, TYPE_META[k].code + ' ' + TYPE_META[k].short]; }))
      .map(function (item) {
        return '<button class="wa-tab' + (current === item[0] ? ' active' : '') + '" onclick="' + handler + '(\'' + item[0] + '\')">' + item[1] + '</button>';
      }).join('');
  }
  function filteredWarnings() {
    const f = state.record; const keyword = f.keyword.trim().toLowerCase();
    return warnings.filter(function (item) {
      return (f.type === 'ALL' || item.type === f.type)
        && (f.severity === 'ALL' || item.severity === f.severity)
        && (f.status === 'ALL' || item.status === f.status)
        && (!f.dateFrom || new Date(item.triggerTime) >= new Date(f.dateFrom + 'T00:00:00'))
        && (!keyword || [item.id, item.ruleName, item.targetId, item.metricLabel].join(' ').toLowerCase().includes(keyword));
    }).sort(function (a, b) { return new Date(b.triggerTime) - new Date(a.triggerTime); });
  }
  function ticketIsOverdue(ticket) {
    return !!ticket.slaDeadline && ticket.status !== 'CLOSED' && new Date(ticket.slaDeadline).getTime() < Date.now();
  }
  function ticketDeadlineTime(ticket) {
    return ticket.slaDeadline ? new Date(ticket.slaDeadline).getTime() : Infinity;
  }
  function filteredTickets() {
    const f = state.ticket; const keyword = f.keyword.trim().toLowerCase();
    const list = tickets.filter(function (ticket) {
      const warning = findWarning(ticket.warningId) || {};
      return (f.type === 'ALL' || ticket.type === f.type)
        && (f.severity === 'ALL' || ticket.severity === f.severity)
        && (f.status === 'ALL' || ticket.status === f.status)
        && (!keyword || [ticket.id, ticket.warningId, ticket.ownerOrg, ticket.ownerRole, warning.targetLabel || ''].join(' ').toLowerCase().includes(keyword));
    });
    const byCreatedDesc = function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); };
    if (f.sort === 'deadline') {
      list.sort(function (a, b) { return ticketDeadlineTime(a) - ticketDeadlineTime(b) || byCreatedDesc(a, b); });
    } else if (f.sort === 'overdue') {
      list.sort(function (a, b) {
        const oa = ticketIsOverdue(a) ? 0 : 1, ob = ticketIsOverdue(b) ? 0 : 1;
        if (oa !== ob) return oa - ob;
        return ticketDeadlineTime(a) - ticketDeadlineTime(b) || byCreatedDesc(a, b);
      });
    } else {
      list.sort(byCreatedDesc);
    }
    return list;
  }
  function ticketActions(ticket) {
    let html = '<button class="btn btn-ghost btn-xs" onclick="showTicketDetail(\'' + ticket.id + '\')">详情</button>';
    if (ticket.status === 'PENDING') html += ' <button class="btn btn-primary btn-xs" onclick="receiveTicket(\'' + ticket.id + '\')">接收</button>';
    if (['PROCESSING', 'ESCALATED'].includes(ticket.status)) html += ' <button class="btn btn-primary btn-xs" onclick="openFeedbackModal(\'' + ticket.id + '\')">' + (ticket.status === 'ESCALATED' ? '补充反馈' : (ticket.type === 'DISEASE_SIGNAL' ? '提交研判' : '核实反馈')) + '</button>';
    if (ticket.status === 'FEEDBACK') html += ' <button class="btn btn-primary btn-xs" onclick="openReviewModal(\'' + ticket.id + '\')">复核</button>';
    return html;
  }

  /* ==================== 页面：预警记录 ==================== */
  function renderRecords() {
    const activeMeta = state.record.type === 'ALL' ? null : TYPE_META[state.record.type];
    const rows = filteredWarnings().map(function (item) {
      const ticket = findTicketByWarning(item.id);
      const flags = [];
      if (item.contextFlag) flags.push('<div class="wa-target">情景：' + esc(item.contextFlag) + '（已降级）</div>');
      if (item.denominatorFlag) flags.push('<div class="wa-target" style="color:#b54708">分母待核</div>');
      return '<tr>' +
        '<td><button class="wa-id" onclick="showWarningDetail(\'' + item.id + '\')">' + item.id + '</button><div class="wa-target">' + esc(item.period || '-') + ' · ' + esc(item.observeWindow || '-') + '</div></td>' +
        '<td class="wa-main">' + layerBadge(item.type) + '<div style="margin-top:4px;font-weight:600">' + esc(item.ruleName) + '</div></td>' +
        '<td class="wa-main">' + esc(item.targetLabel) + '<div class="wa-target">' + esc(item.targetId) + '</div></td>' +
        '<td class="wa-metric">' + esc(item.metricLabel) + '<div class="wa-threshold">阈值：' + esc(item.thresholdSnapshot) + '</div><div class="wa-basis">' + esc(item.judgeBasis || '') + '</div></td>' +
        '<td class="wa-nowrap">' + severityBadge(item.severity) + flags.join('') + '</td>' +
        '<td class="wa-nowrap">' + warningStatusBadge(item.status) + '</td>' +
        '<td class="wa-nowrap">' + fmtTime(item.triggerTime) + '</td>' +
        '<td class="wa-actions-cell"><button class="btn btn-ghost btn-xs" onclick="showWarningDetail(\'' + item.id + '\')">详情</button>' + (ticket && ticket.status !== 'CLOSED' ? ' <button class="btn btn-outline btn-xs" onclick="showTicketDetail(\'' + ticket.id + '\')">工单</button>' : '') + '</td>' +
        '</tr>';
    }).join('');
    const sevOptions = [['ALL', '全部级别'], ['INFO', '提示级'], ['ATTENTION', '关注级'], ['URGENT', '紧急级']].map(function (o) { return '<option value="' + o[0] + '"' + (state.record.severity === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    const statusOptions = [['ALL', '全部状态']].concat(Object.keys(WARNING_STATUS_META).map(function (k) { return [k, WARNING_STATUS_META[k].label]; })).map(function (o) { return '<option value="' + o[0] + '"' + (state.record.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    const filter = '<div class="wa-filter">' +
      '<div class="form-group"><label>级别</label><select onchange="waSetFilter(\'record\',\'severity\',this.value)">' + sevOptions + '</select></div>' +
      '<div class="form-group"><label>状态</label><select onchange="waSetFilter(\'record\',\'status\',this.value)">' + statusOptions + '</select></div>' +
      '<div class="form-group"><label>触发起始日</label><input type="date" value="' + esc(state.record.dateFrom) + '" onchange="waSetFilter(\'record\',\'dateFrom\',this.value)"></div>' +
      '<div class="form-group"><label>检索</label><input id="waKw-record" value="' + esc(state.record.keyword) + '" placeholder="预警ID / 规则 / 对象 / 指标" oninput="waOnKeyword(this,\'record\')"></div>' +
      '<div class="filter-actions" style="grid-column:span 2"><button class="btn btn-outline btn-sm" onclick="waResetRecordFilter()">重置</button>' +
      '<button class="btn btn-outline btn-sm" onclick="runAllEngines()">重跑三层</button>' +
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'warning-tickets\')">处置工单</button></div></div>';
    const layerNote = activeMeta
      ? '<div class="wa-callout info" style="margin-bottom:12px"><strong>' + activeMeta.code + ' · ' + esc(activeMeta.label) + '</strong>（' + esc(activeMeta.window) + '）<br>' + esc(activeMeta.desc) + '<br>预警对象：' + esc(activeMeta.object) + ' · 数据来源：' + esc(activeMeta.source) + ' · 首办责任方：' + esc(activeMeta.firstOwner) + ' · 归口复核：' + esc(activeMeta.finalOwner) + '</div>'
      : '';
    return '<div class="wa-page"><div class="wa-tabs">' + layerTabs(state.record.type, 'waSetRecordType') + '</div>' + layerNote + filter +
      '<div class="wa-table-wrap"><table class="wa-table"><thead><tr><th class="code">预警ID / 周期</th><th class="txt">层级 / 规则</th><th class="txt">预警对象</th><th class="code">实际值 / 阈值 / 判定依据</th><th class="code">级别</th><th class="code">状态</th><th class="code">触发时间</th><th class="ops">操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8"><div class="wa-empty">暂无符合条件的预警记录</div></td></tr>') + '</tbody></table></div></div>';
  }
  function waResetRecordFilter() {
    state.record = { type: state.record.type, severity: 'ALL', status: 'ALL', keyword: '', dateFrom: '' };
    renderPage('warning-records');
  }

  /* ==================== 页面：处置工单 ==================== */
  function renderTickets() {
    const counts = { PENDING: 0, PROCESSING: 0, FEEDBACK: 0, ESCALATED: 0 };
    tickets.forEach(function (t) { if (counts[t.status] !== undefined) counts[t.status]++; });
    const overdue = overdueTicketCount();
    const kpis = [
      waKpi('待接收', counts.PENDING, '首办责任方尚未确认', '', { group: 'ticket', key: 'status', value: 'PENDING' }),
      waKpi('处理中', counts.PROCESSING, '已接收，核实/研判中', '', { group: 'ticket', key: 'status', value: 'PROCESSING' }),
      waKpi('已反馈', counts.FEEDBACK, '等待归口复核', '', { group: 'ticket', key: 'status', value: 'FEEDBACK' }),
      waKpi('已升级', counts.ESCALATED, '超时或多次退回仲裁', counts.ESCALATED ? 'danger' : '', { group: 'ticket', key: 'status', value: 'ESCALATED' }),
      waKpi('超时未闭环', overdue, '按分层 SLA 判定', overdue ? 'danger' : '', { group: 'ticket', key: 'sort', value: 'overdue' })
    ].join('');
    const rows = filteredTickets().map(function (ticket) {
      const warning = findWarning(ticket.warningId) || {};
      const meta = TYPE_META[ticket.type];
      const isOverdue = ticket.slaDeadline && ticket.status !== 'CLOSED' && new Date(ticket.slaDeadline).getTime() < Date.now();
      return '<tr>' +
        '<td><button class="wa-id" onclick="showTicketDetail(\'' + ticket.id + '\')">' + ticket.id + '</button><div class="wa-target">' + esc(warning.id || '-') + '</div></td>' +
        '<td class="wa-main">' + layerBadge(ticket.type) + '<div style="margin-top:4px">' + esc(warning.targetLabel || '-') + '</div></td>' +
        '<td class="wa-main">' + esc(ticket.ownerRole) + '<div class="wa-target">' + esc(ticket.ownerOrg) + '</div></td>' +
        '<td class="wa-nowrap">' + severityBadge(ticket.severity) + '<div class="wa-target">' + esc(slaText(ticket.type, ticket.severity)) + '</div></td>' +
        '<td class="wa-nowrap">' + fmtTime(ticket.slaDeadline) + (isOverdue ? '<div class="wa-target" style="color:#b42335">已超时</div>' : '') + '</td>' +
        '<td class="wa-nowrap">' + ticketStatusBadge(ticket.status) + '</td>' +
        '<td class="wa-main">' + esc(ticket.verificationResult || '-') + (ticket.expertReviewNote ? '<div class="wa-target">已附专家组意见</div>' : (meta.requireExpertReview && ticket.status === 'FEEDBACK' ? '<div class="wa-target" style="color:#b54708">待专家组论证</div>' : '')) + '</td>' +
        '<td class="wa-actions-cell">' + ticketActions(ticket) + '</td>' +
        '</tr>';
    }).join('');
    const sevOptions = [['ALL', '全部级别'], ['INFO', '提示级'], ['ATTENTION', '关注级'], ['URGENT', '紧急级']].map(function (o) { return '<option value="' + o[0] + '"' + (state.ticket.severity === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    const statusOptions = [['ALL', '全部状态']].concat(Object.keys(TICKET_STATUS_META).map(function (k) { return [k, TICKET_STATUS_META[k].label]; })).map(function (o) { return '<option value="' + o[0] + '"' + (state.ticket.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    const sortOptions = [['overdue', '超时优先'], ['deadline', 'SLA 最近'], ['created', '最新创建']].map(function (o) { return '<option value="' + o[0] + '"' + (state.ticket.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    const filter = '<div class="wa-filter">' +
      '<div class="form-group"><label>级别</label><select onchange="waSetFilter(\'ticket\',\'severity\',this.value)">' + sevOptions + '</select></div>' +
      '<div class="form-group"><label>状态</label><select onchange="waSetFilter(\'ticket\',\'status\',this.value)">' + statusOptions + '</select></div>' +
      '<div class="form-group"><label>排序</label><select onchange="waSetFilter(\'ticket\',\'sort\',this.value)">' + sortOptions + '</select></div>' +
      '<div class="form-group" style="grid-column:span 2"><label>检索</label><input id="waKw-ticket" value="' + esc(state.ticket.keyword) + '" placeholder="工单 / 预警 / 责任方 / 对象" oninput="waOnKeyword(this,\'ticket\')"></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="waResetTicketFilter()">重置</button></div></div>';
    return '<div class="wa-page">' + waHeader('处置工单',
      '待接收 → 处理中 → 已反馈 → 已关闭；SLA 按层级设定（A 最快 24 小时，B 最长 10 个工作日，C 最长 20 个工作日），超时自动升级。C 层结案必须附专家组论证记录。', [
      '<button class="btn btn-outline btn-sm" onclick="scanOverdue()">扫描超时</button>'
    ]) + '<div class="wa-kpis">' + kpis + '</div><div class="wa-tabs">' + layerTabs(state.ticket.type, 'waSetTicketType') + '</div>' + filter +
      '<div class="wa-table-wrap"><table class="wa-table"><thead><tr><th class="txt">工单 / 预警</th><th class="txt">层级 / 对象</th><th class="txt">当前责任方</th><th class="code">级别 / 时限</th><th class="code">响应截止</th><th class="code">状态</th><th class="txt">结论口径</th><th class="ops">操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8"><div class="wa-empty">暂无符合条件的工单</div></td></tr>') + '</tbody></table></div></div>';
  }
  function waSetTicketType(value) { state.ticket.type = value; renderPage('warning-tickets'); }
  function waResetTicketFilter() {
    state.ticket = { type: state.ticket.type, severity: 'ALL', status: 'ALL', keyword: '', sort: state.ticket.sort || 'overdue' };
    renderPage('warning-tickets');
  }
  function waResetRuleFilter() {
    state.rule = { type: state.rule.type, keyword: '', enabledOnly: false };
    renderPage('warning-rules');
  }

  /* ==================== 页面：规则配置 ==================== */
  function renderRules() {
    const keyword = state.rule.keyword.trim().toLowerCase();
    const rows = rules.filter(function (rule) {
      return (state.rule.type === 'ALL' || rule.warningType === state.rule.type)
        && (!state.rule.enabledOnly || rule.isEnabled)
        && (!keyword || [rule.id, rule.ruleName, rule.monitorPoint].join(' ').toLowerCase().includes(keyword));
    }).map(function (rule) {
      const open = warnings.filter(function (item) { return item.ruleId === rule.id && item.status !== 'CLOSED'; }).length;
      const reviewed = rule.reviewedCount;
      const falseRate = reviewed ? Math.round(rule.falsePositiveCount / reviewed * 100) : 0;
      const enabledClass = rule.isEnabled ? 'badge-success' : 'badge-muted';
      return '<tr>' +
        '<td><button class="wa-id" onclick="openRuleModal(\'' + rule.id + '\')">' + rule.id + '</button></td>' +
        '<td class="wa-main"><strong>' + esc(rule.ruleName) + '</strong><div class="wa-basis">' + esc(rule.basis) + '</div></td>' +
        '<td>' + layerBadge(rule.warningType) + '<div class="wa-target">' + esc(rule.observeWindow) + '</div></td>' +
        '<td class="wa-main">' + esc(SEVERITY_META[rule.defaultSeverity].label) + '<div class="wa-target">' + esc(rule.dimensionScope) + '</div></td>' +
        '<td class="wa-metric">' + rule.thresholdValue + esc(rule.unit) + '<div class="wa-threshold">最小样本：' + rule.minSampleSize + '</div><div class="wa-threshold">' + esc(rule.compareMethod) + '</div></td>' +
        '<td class="wa-nowrap">' + open + '</td>' +
        '<td class="wa-nowrap">' + reviewed + ' / ' + rule.falsePositiveCount + '<div class="wa-target">误报率 ' + falseRate + '%</div></td>' +
        '<td class="wa-nowrap"><span class="badge ' + enabledClass + '">' + (rule.isEnabled ? '启用' : '停用') + '</span></td>' +
        '<td class="wa-actions-cell"><button class="btn btn-ghost btn-xs" onclick="openRuleModal(\'' + rule.id + '\')">详情</button> <button class="btn btn-outline btn-xs" onclick="toggleRule(\'' + rule.id + '\')">' + (rule.isEnabled ? '停用' : '启用') + '</button></td>' +
        '</tr>';
    }).join('');
    const hasFilter = state.rule.enabledOnly || state.rule.keyword.trim();
    const filter = '<div class="wa-filter"><div class="form-group" style="grid-column:span 3"><label>检索</label><input id="waKw-rule" value="' + esc(state.rule.keyword) + '" placeholder="规则ID / 名称 / 监测点" oninput="waOnKeyword(this,\'rule\')"></div><div class="filter-actions">' + (hasFilter ? '<button class="btn btn-outline btn-sm" onclick="waResetRuleFilter()">清除筛选</button> ' : '') + '<button class="btn btn-outline btn-sm" onclick="runAllEngines()">重跑三层</button></div></div>';
    const kpis = [
      waKpi('启用规则', rules.filter(function (r) { return r.isEnabled; }).length + ' / ' + rules.length, 'A ' + rules.filter(function (r) { return r.warningType === 'REGISTRY_OPERATION'; }).length + ' · B ' + rules.filter(function (r) { return r.warningType === 'REGISTRY_QUALITY'; }).length + ' · C ' + rules.filter(function (r) { return r.warningType === 'DISEASE_SIGNAL'; }).length + ' 条', '', { group: 'rule', key: 'enabledOnly', value: 'true' }),
      waKpi('待业务确认', rules.filter(function (r) { return r.confirmation.indexOf('待') === 0; }).length, '上线前需业务方书面确认', rules.some(function (r) { return r.confirmation.indexOf('待') === 0; }) ? 'warn' : '', { group: 'rule', key: 'keyword', value: '待' }),
      waKpi('在办预警', warnings.filter(function (item) { return item.status !== 'CLOSED'; }).length, '覆盖当前所有启用规则', '', { group: '_nav', key: 'tickets', value: 'warning-tickets' }),
      waKpi('误报 / 已复核', rules.reduce(function (s, r) { return s + r.falsePositiveCount; }, 0) + ' / ' + rules.reduce(function (s, r) { return s + r.reviewedCount; }, 0), '复核闭环后据此调整阈值'),
      waKpi('规则版本', rules.reduce(function (s, r) { return s + r.history.length; }, 0), '修改历史可回溯')
    ].join('');
    return '<div class="wa-page">' + waHeader('预警规则配置',
      '阈值取自《中国肿瘤登记年报》《IARC CI5》与省级考核口径；调整阈值不影响历史预警的快照值。<b>本页只配置聚合指标阈值</b>，单卡字段校验在「审核质控 · 质控规则」维护。', [
      '<button class="btn btn-primary btn-sm" onclick="runAllEngines()">重跑三层规则</button>'
    ]) + '<div class="wa-kpis">' + kpis + '</div><div class="wa-tabs">' + layerTabs(state.rule.type, 'waSetRuleType') + '</div>' + filter +
      '<div class="wa-table-wrap"><table class="wa-table"><thead><tr><th class="txt">规则ID</th><th class="txt">规则名称 / 判定依据</th><th class="txt">层级 / 窗口</th><th class="txt">默认级别 / 范围</th><th class="num">阈值 / 方法</th><th class="num">在办</th><th class="num">复核 / 误报</th><th class="code">状态</th><th class="ops">操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9"><div class="wa-empty">暂无规则</div></td></tr>') + '</tbody></table></div></div>';
  }

  /* ==================== 工单流转 ==================== */
  function receiveTicket(ticketId) {
    const ticket = findTicket(ticketId);
    if (!ticket) return;
    const meta = TYPE_META[ticket.type];
    const warning = findWarning(ticket.warningId);
    if (ticket.status !== 'PENDING') { toast('仅待接收记录可以接收', 'error'); return; }
    ticket.status = 'PROCESSING';
    ticket.assigneeUser = ticket.assigneeUser || currentOperator();
    ticket.history.push({ time: new Date(), action: '接收工单', detail: currentOperator() + '确认接收' });
    if (warning) {
      warning.status = 'PROCESSING';
      warning.history.push({ time: new Date(), action: '工单接收', detail: ticket.id + '已进入处理中' });
    }
    logAction({ layer: meta.code, ticketId: ticket.id, warningId: ticket.warningId, action: '接收', from: '待接收', to: '处理中' });
    toast('工单已接收');
    renderPage(state.page);
  }

  function openFeedbackModal(ticketId) {
    const ticket = findTicket(ticketId);
    if (!ticket) return;
    const meta = TYPE_META[ticket.type];
    const warning = findWarning(ticket.warningId) || {};
    const isSignal = ticket.type === 'DISEASE_SIGNAL';
    const options = meta.conclusions.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
    const checklist = isSignal
      ? '<div class="wa-section"><h4 class="wa-h">研判前置排除项（C 层必填）</h4><div style="display:grid;gap:8px">' +
        '<label class="wa-check"><input type="checkbox" id="waChkBehavior">已核实该地区上报机构数与上报行为近3年无明显变化（排除上报行为改变）</label>' +
        '<label class="wa-check"><input type="checkbox" id="waChkDenom">已核实人口基数有统计年鉴或普查依据（排除分母错误）</label>' +
        '<label class="wa-check"><input type="checkbox" id="waChkQuality">已核实该地区 B 层质量指标（年龄不明率、DCO%）达标（排除质量因素）</label>' +
        '</div></div>'
      : '';
    const denomWarn = warning.denominatorFlag
      ? '<div class="wa-callout" style="margin-bottom:12px"><strong>该地区人口分母待核。</strong>在分母预警关闭前，本预警的率值结论仅供参考，不建议直接判定为「疑似真实升高」。</div>'
      : '';
    const crossLayer = isSignal || ticket.type === 'REGISTRY_QUALITY'
      ? '<div class="wa-note" style="margin-top:8px">选择「上报行为改变」「口径或编码问题」或「属实-需系统支持」时，系统将自动向对应层级创建关联核查预警并派单。</div>'
      : '';
    const body = denomWarn +
      '<div class="wa-fields"><div class="wa-field"><div class="wa-field-label">预警对象</div><div class="wa-value">' + esc(warning.targetLabel || '-') + '</div></div>' +
      '<div class="wa-field"><div class="wa-field-label">实际值 / 阈值</div><div class="wa-value">' + esc(warning.metricLabel || '-') + ' / ' + esc(warning.thresholdSnapshot || '-') + '</div></div>' +
      '<div class="wa-field"><div class="wa-field-label">响应时限</div><div class="wa-value">' + esc(slaText(ticket.type, ticket.severity)) + '</div></div></div>' +
      '<div class="wa-callout info" style="margin:12px 0"><strong>判定依据：</strong>' + esc(warning.judgeBasis || '-') + '</div>' +
      checklist +
      '<div class="wa-form-grid"><div class="form-group full"><label>' + (isSignal ? '研判结论' : '核实结论') + ' *</label><select id="waResult">' + options + '</select></div></div>' +
      '<div class="form-group" style="margin-top:12px"><label>' + (isSignal ? '研判过程与依据' : '核实过程与整改动作') + ' *（不少于20字）</label><textarea id="waNote" rows="5" placeholder="' + (isSignal ? '请写明数据核对过程、排除项结论、可疑原因与建议下一步' : '请写明核实过程、数据来源、整改动作或误报依据') + '"></textarea></div>' +
      crossLayer;
    const foot = '<button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" onclick="submitFeedback(\'' + ticketId + '\')">' + (isSignal ? '提交研判' : '提交反馈') + '</button>';
    const mask = waModal((isSignal ? '信号研判 · ' : '核实反馈 · ') + ticketId, body, foot, true);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
    setTimeout(function () { const el = mask.querySelector('#waNote'); if (el) el.focus(); }, 50);
  }

  function submitFeedback(ticketId) {
    const ticket = findTicket(ticketId);
    if (!ticket) return;
    if (!['PROCESSING', 'ESCALATED'].includes(ticket.status)) { toast('请先接收记录再提交反馈', 'error'); return; }
    const result = document.getElementById('waResult').value;
    const note = document.getElementById('waNote').value.trim();
    if (!note || note.length < 20) { toast('说明不能少于20字', 'error'); return; }
    if (ticket.type === 'DISEASE_SIGNAL') {
      const b = document.getElementById('waChkBehavior');
      const d = document.getElementById('waChkDenom');
      const q = document.getElementById('waChkQuality');
      if (result === '疑似真实升高' && !(b && b.checked && d && d.checked && q && q.checked)) {
        toast('判定「疑似真实升高」前必须完成全部三项前置排除', 'error');
        return;
      }
      if (result === '疑似真实升高' && findWarning(ticket.warningId)?.denominatorFlag) {
        toast('人口分母仍待核，先完成分母专项核查或选择相应原因', 'error'); return;
      }
    }
    const meta = TYPE_META[ticket.type];
    const warning = findWarning(ticket.warningId);
    const time = new Date();
    ticket.status = 'FEEDBACK';
    ticket.verificationResult = result;
    ticket.handlingNote = note;
    ticket.feedbackAt = time;
    ticket.history.push({ time, action: ticket.type === 'DISEASE_SIGNAL' ? '提交研判' : '提交反馈', detail: '结论：' + result + '；' + note });
    if (warning) {
      warning.status = 'FEEDBACK';
      warning.history.push({ time, action: ticket.type === 'DISEASE_SIGNAL' ? '研判反馈' : '核实反馈', detail: ticket.id + '：' + result });
    }
    logAction({ layer: meta.code, ticketId: ticket.id, warningId: ticket.warningId, action: '提交反馈', from: '处理中', to: '已反馈', reason: result });
    maybeCreateCrossLayerWarning(warning, ticket, result);
    closeTopModal();
    toast(meta.requireExpertReview ? '研判已提交，等待专家组论证与归口复核' : '反馈已提交，等待归口复核');
    renderPage(state.page);
  }

  /* 跨层转办：结论指向另一层的根因时，自动建立关联核查预警 */
  function maybeCreateCrossLayerWarning(sourceWarning, sourceTicket, result) {
    if (!sourceWarning) return null;
    let targetRuleId = null;
    let reason = '';
    if (result === '上报行为改变') { targetRuleId = 'A-VOLUME-DROP'; reason = 'C 层研判指向上报行为改变，转 A 层核查上报连续性'; }
    else if (result === '属实-口径或编码问题') { targetRuleId = 'B-UB-HIGH'; reason = 'B 层结论指向编码口径问题，转编码与部位字典专项核查'; }
    else if (result === '编码口径变化') { targetRuleId = 'B-UB-HIGH'; reason = 'C 层研判指向编码口径变化，转 B 层核查部位编码归类'; }
    else if (result === '人口分母错误') { targetRuleId = 'C-DENOMINATOR'; reason = 'C 层研判指向人口分母错误，转分母专项核查'; }
    else if (result === '属实-需系统支持') { targetRuleId = 'A-AUDIT-BACKLOG'; reason = 'A 层结论指向系统支持问题，转本级流程与系统核查'; }
    if (!targetRuleId) return null;
    const rule = findRule(targetRuleId);
    if (!rule || rule.id === sourceWarning.ruleId) return null;
    const meta = TYPE_META[rule.warningType];
    const related = createWarning(rule, {
      targetType: 'CROSS_LAYER',
      targetId: sourceTicket.ownerOrg + '|关联核查|' + sourceWarning.id,
      targetLabel: sourceTicket.ownerOrg + ' 关联核查（源自 ' + sourceWarning.id + '）',
      period: sourceWarning.period,
      metricValue: 1, metricLabel: '跨层转办核查', severity: 'ATTENTION',
      triggerTime: new Date(),
      thresholdSnapshot: '跨层转办（不适用阈值）',
      snapshot: { 源预警: sourceWarning.id, 源层级: TYPE_META[sourceWarning.type].code + ' ' + TYPE_META[sourceWarning.type].short, 转办原因: reason, 目标层级: meta.code + ' ' + meta.short, 原责任方: sourceTicket.ownerRole },
      evidence: makeEvidence([['源预警', sourceWarning.id + '（' + sourceWarning.ruleName + '）'], ['转办原因', reason], ['核查要求', '核实根因并回写源预警结论']])
    });
    if (related) {
      sourceWarning.relatedWarningId = related.id;
      related.relatedWarningId = sourceWarning.id;
      logAction({ layer: meta.code, warningId: related.id, action: '跨层转办', from: TYPE_META[sourceWarning.type].code, to: meta.code, reason });
    }
    return related;
  }

  function openReviewModal(ticketId) {
    const ticket = findTicket(ticketId);
    if (!ticket) return;
    const meta = TYPE_META[ticket.type];
    const warning = findWarning(ticket.warningId) || {};
    const expertBlock = meta.requireExpertReview
      ? '<div class="form-group" style="margin-top:12px"><label>专家组论证记录 *（C 层结案必填，不少于15字）</label><textarea id="waExpertNote" rows="4" placeholder="请填写论证时间、参与专家、论证意见">' + esc(ticket.expertReviewNote || '') + '</textarea></div>'
      : '';
    const reasonOptions = ticket.type === 'REGISTRY_QUALITY'
      ? [['RESOLVED', '整改达标结束'], ['FALSE_POSITIVE', '误报结束'], ['FOLLOWUP', '转专项跟踪结束']]
      : [['REVIEWED', '核查完成'], ['FALSE_POSITIVE', '误报结束'], ['FOLLOWUP', '转专项跟踪结束']];
    const closureFields = '<div class="form-group" style="margin-top:12px"><label>结束原因 *</label><select id="waCloseReason">'
      + reasonOptions.map(([key, text]) => '<option value="' + key + '"' + (ticket.verificationResult === '误报' && key === 'FALSE_POSITIVE' ? ' selected' : '') + '>' + text + '</option>').join('') + '</select></div>'
      + (ticket.type === 'REGISTRY_QUALITY' ? '<div class="wa-form-grid" id="waRecalcFields"><div class="form-group"><label>整改后实际值（原指标单位） *</label><input id="waRecalcValue" type="number" step="0.01" placeholder="完整性请输入带符号的偏离百分比"></div><div class="form-group"><label>复算依据 / 数据批次 *</label><input id="waRecalcEvidence" placeholder="填写核对的数据批次与材料"></div></div>' : '')
      + '<div class="wa-form-grid" id="waFollowupFields" hidden><div class="form-group"><label>专项跟踪编号 *</label><input id="waFollowupRef" placeholder="关联预警或专项跟踪编号"></div><div class="form-group"><label>跟踪责任方 *</label><input id="waFollowupOwner" placeholder="责任机构或经办人"></div></div>';
    const body = '<div class="wa-fields">' +
      '<div class="wa-field"><div class="wa-field-label">结论口径</div><div class="wa-value">' + esc(ticket.verificationResult) + '</div></div>' +
      '<div class="wa-field"><div class="wa-field-label">反馈时间</div><div class="wa-value">' + fmtTime(ticket.feedbackAt) + '</div></div>' +
      '<div class="wa-field"><div class="wa-field-label">归口复核方</div><div class="wa-value">' + esc(meta.finalOwner) + '</div></div>' +
      '</div>' +
      '<div class="wa-callout" style="margin:12px 0"><strong>' + esc(warning.targetLabel || '') + '</strong><br>' + esc(ticket.handlingNote || '-') + '</div>' +
      expertBlock +
      closureFields +
      '<div class="form-group" style="margin-top:12px"><label>复核意见 *（不少于5字）</label><textarea id="waReviewNote" rows="3" placeholder="填写结束依据；退回时说明补充要求"></textarea></div>';
    const foot = '<button class="btn btn-ghost" data-close>取消</button><button class="btn btn-outline" onclick="returnTicket(\'' + ticket.id + '\')">退回补充</button><button class="btn btn-primary" onclick="closeTicket(\'' + ticket.id + '\')">确认关闭</button>';
    const mask = waModal('归口复核 · ' + ticketId, body, foot, true);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
    const updateClosureFields = () => {
      const reason = mask.querySelector('#waCloseReason').value;
      const recalc = mask.querySelector('#waRecalcFields'); if (recalc) recalc.hidden = reason !== 'RESOLVED';
      mask.querySelector('#waFollowupFields').hidden = reason !== 'FOLLOWUP';
    };
    mask.querySelector('#waCloseReason').addEventListener('change', updateClosureFields);
    updateClosureFields();
  }

  function closeTopModal() {
    const masks = document.querySelectorAll('.wa-modal-mask');
    if (masks.length) masks[masks.length - 1].remove();
  }

  function closeTicket(ticketId) {
    const ticket = findTicket(ticketId);
    if (!ticket) return;
    const meta = TYPE_META[ticket.type];
    const warning = findWarning(ticket.warningId);
    if (ticket.status !== 'FEEDBACK') { toast('仅已反馈记录可以复核结束', 'error'); return; }
    if (warning?.observationOnly) { toast('观察线索请使用结束观察入口，不作为疾病结论复核', 'error'); return; }
    const noteEl = document.getElementById('waReviewNote');
    const note = noteEl ? noteEl.value.trim() : '';
    if (note.length < 5) { toast('请填写复核意见（不少于5字）', 'error'); return; }
    const reason = document.getElementById('waCloseReason')?.value;
    if (!reason) { toast('请选择结束原因', 'error'); return; }
    let recalculation = null; let followup = null;
    if (reason === 'RESOLVED') {
      if (ticket.verificationResult !== '属实-已修正复算达标') { toast('仍在整改中的事项不能按达标结束，请退回补充或转专项跟踪', 'error'); return; }
      const input = document.getElementById('waRecalcValue');
      const after = input?.value.trim() ? Number(input.value) : NaN;
      const evidence = document.getElementById('waRecalcEvidence')?.value.trim() || '';
      if (!closurePass(warning, after)) { toast('请填写符合原触发规则的整改后实际值', 'error'); return; }
      if (evidence.length < 5) { toast('请填写复算依据或数据批次', 'error'); return; }
      recalculation = { before: warning.metricValue, after, evidence, mode: '前端手工核对示例', time: new Date() };
    }
    if (reason === 'FALSE_POSITIVE' && ticket.verificationResult !== '误报') { toast('误报结束应与反馈结论一致', 'error'); return; }
    if (reason === 'FOLLOWUP') {
      const reference = document.getElementById('waFollowupRef')?.value.trim() || '';
      const owner = document.getElementById('waFollowupOwner')?.value.trim() || '';
      if (!reference || !owner) { toast('请填写专项跟踪编号及责任方', 'error'); return; }
      followup = { reference, owner };
    }
    if (meta.requireExpertReview) {
      const expertEl = document.getElementById('waExpertNote');
      const expert = expertEl ? expertEl.value.trim() : '';
      if (expert.length < 15) { toast('C 层结案必须填写专家组论证记录（不少于15字）', 'error'); return; }
      ticket.expertReviewNote = expert;
      ticket.history.push({ time: new Date(), action: '专家组论证', detail: expert });
      logAction({ layer: meta.code, ticketId: ticket.id, warningId: ticket.warningId, action: '专家组论证', to: meta.arbiter, reason: expert.slice(0, 40) });
    }
    const time = new Date();
    ticket.status = 'CLOSED';
    ticket.closedBy = currentOperator();
    ticket.closedAt = time;
    ticket.closureReason = reason;
    ticket.reviewNote = note;
    ticket.recalculation = recalculation;
    ticket.followup = followup;
    ticket.history.push({ time, action: '复核关闭', detail: note || '归口复核确认，工单闭环' });
    if (warning) {
      warning.status = 'CLOSED';
      warning.history.push({ time, action: '预警关闭', detail: ticket.id + ' 经' + meta.finalOwner + '复核通过' });
    }
    const rule = findRule(warning && warning.ruleId);
    if (rule) {
      rule.reviewedCount++;
      if (ticket.verificationResult === '误报') rule.falsePositiveCount++;
    }
    logAction({ layer: meta.code, ticketId: ticket.id, warningId: ticket.warningId, action: '复核关闭', from: '已反馈', to: '已关闭', reason: ticket.verificationResult + (note ? '；' + note : '') });
    closeTopModal();
    toast('工单已关闭');
    renderPage(state.page);
  }

  function returnTicket(ticketId) {
    const ticket = findTicket(ticketId);
    if (!ticket) return;
    if (ticket.status !== 'FEEDBACK') { toast('仅已反馈记录可以退回补充', 'error'); return; }
    const meta = TYPE_META[ticket.type];
    const el = document.getElementById('waReviewNote');
    const reason = el ? el.value.trim() : '';
    if (!reason || reason.length < 5) { toast('退回原因不少于5字', 'error'); return; }
    const warning = findWarning(ticket.warningId);
    const time = new Date();
    ticket.returnCount++;
    if (ticket.returnCount >= 2) {
      ticket.status = 'ESCALATED';
      ticket.escalatedFrom = ticket.ownerRole;
      ticket.ownerRole = arbitrationOwner(ticket.type);
      ticket.history.push({ time, action: '转人工仲裁', detail: '第' + ticket.returnCount + '次退回，推送至' + ticket.ownerRole });
      if (warning) warning.status = 'ESCALATED';
      logAction({ layer: meta.code, ticketId, warningId: ticket.warningId, action: '多次退回仲裁', from: ticket.escalatedFrom, to: ticket.ownerRole, reason });
    } else {
      ticket.status = 'PROCESSING';
      ticket.history.push({ time, action: '退回补充', detail: reason });
      if (warning) warning.status = 'PROCESSING';
      logAction({ layer: meta.code, ticketId, warningId: ticket.warningId, action: '退回', from: '已反馈', to: '处理中', reason });
    }
    if (warning) warning.history.push({ time, action: '工单退回', detail: ticket.id + '：' + reason });
    closeTopModal();
    toast('工单已退回');
    renderPage(state.page);
  }

  function toggleRule(ruleId) {
    const rule = findRule(ruleId);
    if (!rule) return;
    rule.isEnabled = !rule.isEnabled;
    rule.updatedBy = currentOperator();
    rule.updatedAt = new Date();
    rule.history.push({ version: rule.history.length + 1, time: rule.updatedAt, operator: rule.updatedBy, detail: rule.isEnabled ? '重新启用' : '停用规则' });
    logAction({ layer: TYPE_META[rule.warningType].code, action: rule.isEnabled ? '启用规则' : '停用规则', from: rule.id, to: rule.isEnabled ? '启用' : '停用' });
    toast(rule.isEnabled ? '规则已启用' : '规则已停用');
    closeTopModal();
    renderPage(state.page);
  }

  /* ==================== 详情弹窗 ==================== */
  function showWarningDetail(warningId) {
    const item = findWarning(warningId);
    if (!item) return;
    const meta = TYPE_META[item.type];
    const rule = findRule(item.ruleId) || {};
    const ticket = findTicketByWarning(item.id);
    const fields = [
      { k: '预警ID', v: item.id },
      { k: '所属层级', html: layerBadge(item.type) + ' <span style="font-size:11px;color:#667085">' + esc(meta.label) + '</span>' },
      { k: '规则', v: item.ruleName },
      { k: '预警对象', v: item.targetLabel },
      { k: '对象标识', v: item.targetId },
      { k: '周期 / 观察窗口', v: (item.period || '-') + ' · ' + (item.observeWindow || '-') },
      { k: '状态', html: warningStatusBadge(item.status) },
      { k: '级别', html: severityBadge(item.severity) },
      { k: '响应时限', v: slaText(item.type, item.severity) },
      { k: '触发时间', v: fmtTime(item.triggerTime) },
      { k: '实际值', v: item.metricLabel },
      { k: '阈值快照', v: item.thresholdSnapshot },
      { k: '情景标注', v: item.contextFlag || '无' },
      { k: '分母状态', v: item.denominatorFlag ? '分母待核' : '正常' },
      { k: '关联预警', v: item.relatedWarningId || '-' }
    ];
    const snapshot = Object.keys(item.snapshot || {}).map(function (key) {
      return '<div class="wa-field"><div class="wa-field-label">' + esc(key) + '</div><div class="wa-value">' + esc(item.snapshot[key]) + '</div></div>';
    }).join('');
    const evidence = (item.evidence || []).map(function (row) {
      return '<tr><td style="width:28%;color:#667085">' + esc(row.label) + '</td><td>' + esc(row.value) + '</td></tr>';
    }).join('');
    const ruleBox = '<div class="wa-fields">' +
      '<div class="wa-field"><div class="wa-field-label">比较方法</div><div class="wa-value">' + esc(rule.compareMethod || '-') + '</div></div>' +
      '<div class="wa-field"><div class="wa-field-label">监测范围</div><div class="wa-value">' + esc(rule.dimensionScope || '-') + '</div></div>' +
      '<div class="wa-field"><div class="wa-field-label">最小样本量</div><div class="wa-value">' + esc(rule.minSampleSize == null ? '-' : rule.minSampleSize) + '</div></div>' +
      '<div class="wa-field"><div class="wa-field-label">默认级别</div><div class="wa-value">' + esc((SEVERITY_META[rule.defaultSeverity] || {}).label || '-') + '</div></div>' +
      '<div class="wa-field"><div class="wa-field-label">数据来源</div><div class="wa-value">' + esc(meta.source) + '</div></div>' +
      '<div class="wa-field"><div class="wa-field-label">业务确认</div><div class="wa-value">' + esc(rule.confirmation || '-') + '</div></div>' +
      '</div>';
    const history = item.history.map(function (entry) {
      return '<div class="wa-history-item"><strong>' + esc(entry.action) + '</strong><span class="wa-target">' + esc(fmtTime(entry.time)) + '</span><div style="margin-top:4px;color:#475569;font-size:12px">' + esc(entry.detail) + '</div></div>';
    }).join('');
    const fieldsHtml = fields.map(function (f) {
      return '<div class="wa-field"><div class="wa-field-label">' + esc(f.k) + '</div><div class="wa-value">' + (f.html || esc(f.v || '-')) + '</div></div>';
    }).join('');
    const basisHtml = '<div class="wa-callout info" style="margin:10px 0"><strong>判定依据：</strong>' + esc(item.judgeBasis || '-') + '<br><strong>责任链：</strong>' + esc(meta.firstOwner) + ' → ' + esc(meta.escalateOwner) + ' → ' + esc(meta.finalOwner) + '（仲裁：' + esc(meta.arbiter) + '）</div>';
    const denomHtml = item.denominatorFlag ? '<div class="wa-callout" style="margin:10px 0"><strong>该地区人口分母待核。</strong>相关率值在分母预警关闭前不可用于对外结论。</div>' : '';
    const ticketHtml = ticket ? '<div class="wa-callout info" style="margin:8px 0">对应工单 <strong>' + esc(ticket.id) + '</strong>：责任方 ' + esc(ticket.ownerRole) + '，SLA 截止 ' + fmtTime(ticket.slaDeadline) + '（' + TICKET_STATUS_META[ticket.status].label + '）</div>' : '';
    const body = '<div class="wa-fields">' + fieldsHtml + '</div>' + basisHtml + denomHtml + ticketHtml +
      '<div class="wa-section"><h4 class="wa-h">触发数据快照</h4><div class="wa-fields">' + snapshot + '</div></div>' +
      '<div class="wa-section"><h4 class="wa-h">核查证据</h4><table class="data-table" style="min-width:0"><tbody>' + (evidence || '<tr><td>无</td></tr>') + '</tbody></table></div>' +
      '<div class="wa-section"><h4 class="wa-h">规则快照</h4>' + ruleBox + '</div>' +
      '<div class="wa-section"><h4 class="wa-h">预警历史</h4><div class="wa-history">' + history + '</div></div>';
    const foot = ticket && ticket.status !== 'CLOSED'
      ? '<button class="btn btn-ghost" data-close>关闭</button><button class="btn btn-primary" onclick="closeWarningModals();showTicketDetail(\'' + ticket.id + '\')">查看工单</button>'
      : '<button class="btn btn-ghost" data-close>关闭</button>';
    const mask = waModal('预警详情 · ' + item.id, body, foot);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  function showTicketDetail(ticketId) {
    const ticket = findTicket(ticketId);
    if (!ticket) return;
    const warning = findWarning(ticket.warningId) || {};
    const meta = TYPE_META[ticket.type];
    const isOverdue = ticket.slaDeadline && ticket.status !== 'CLOSED' && new Date(ticket.slaDeadline).getTime() < Date.now();
    const flowIndex = function (s) { return ['PENDING', 'PROCESSING', 'FEEDBACK', 'CLOSED', 'ESCALATED'].indexOf(s); };
    const currentIdx = flowIndex(ticket.status);
    const flowHtml = ['PENDING', 'PROCESSING', 'FEEDBACK', 'CLOSED'].map(function (s) {
      const idx = flowIndex(s);
      let cls = '';
      if (idx < currentIdx && ticket.status !== 'ESCALATED') cls = 'done';
      else if (s === ticket.status) cls = 'active';
      return '<span class="wa-state ' + cls + '">' + TICKET_STATUS_META[s].label + '</span>';
    }).join('<span class="wa-arrow">→</span>');
    const escalation = ticket.status === 'ESCALATED' ? '<span class="wa-arrow">→</span><span class="wa-state alert">已升级 → ' + esc(ticket.ownerRole) + '</span>' : '';
    const fields = [
      { k: '工单ID', v: ticket.id },
      { k: '关联预警', v: warning.id || '-' },
      { k: '所属层级', html: layerBadge(ticket.type) },
      { k: '预警对象', v: warning.targetLabel || '-' },
      { k: '级别', html: severityBadge(ticket.severity) },
      { k: '状态', html: ticketStatusBadge(ticket.status) },
      { k: '响应时限', v: slaText(ticket.type, ticket.severity) + (isOverdue ? '（已超时）' : '') },
      { k: '当前责任方', v: ticket.ownerRole },
      { k: '责任对象', v: ticket.ownerOrg },
      { k: 'SLA 截止', v: fmtTime(ticket.slaDeadline) },
      { k: '创建时间', v: fmtTime(ticket.createdAt) },
      { k: '反馈时间', v: fmtTime(ticket.feedbackAt) },
      { k: '关闭时间', v: fmtTime(ticket.closedAt) },
      { k: '结论口径', v: ticket.verificationResult || '-' },
      { k: '处理人', v: ticket.assigneeUser || '-' },
      { k: '退回次数', v: String(ticket.returnCount || 0) }
    ];
    const fieldsHtml = fields.map(function (f) {
      return '<div class="wa-field"><div class="wa-field-label">' + esc(f.k) + '</div><div class="wa-value">' + (f.html || esc(f.v || '-')) + '</div></div>';
    }).join('');
    const noteHtml = ticket.handlingNote ? '<div class="wa-callout" style="margin:10px 0"><strong>' + (ticket.type === 'DISEASE_SIGNAL' ? '研判说明：' : '核实说明：') + '</strong>' + esc(ticket.handlingNote) + '</div>' : '';
    const expertHtml = ticket.expertReviewNote ? '<div class="wa-callout info" style="margin:10px 0"><strong>专家组论证记录：</strong>' + esc(ticket.expertReviewNote) + '</div>' : (meta.requireExpertReview && ticket.status !== 'CLOSED' ? '<div class="wa-callout" style="margin:10px 0">C 层工单结案前必须补充专家组论证记录。</div>' : '');
    const chainHtml = '<div class="wa-callout info" style="margin:10px 0"><strong>责任链：</strong>' + esc(meta.firstOwner) + ' → ' + esc(meta.escalateOwner) + ' → ' + esc(meta.finalOwner) + '（仲裁：' + esc(meta.arbiter) + '）<br><strong>可选结论口径：</strong>' + meta.conclusions.map(esc).join(' / ') + '</div>';
    const history = ticket.history.map(function (entry) {
      return '<div class="wa-history-item"><strong>' + esc(entry.action) + '</strong><span class="wa-target">' + esc(fmtTime(entry.time)) + '</span><div style="margin-top:4px;color:#475569;font-size:12px">' + esc(entry.detail) + '</div></div>';
    }).join('');
    const body = '<div class="wa-section"><div class="wa-flow">' + flowHtml + escalation + '</div></div><div class="wa-fields">' + fieldsHtml + '</div>' + noteHtml + expertHtml + chainHtml +
      '<div class="wa-section"><h4 class="wa-h">工单历史</h4><div class="wa-history">' + history + '</div></div>';
    let foot = '<button class="btn btn-ghost" data-close>关闭</button>';
    if (ticket.status === 'PENDING') foot += '<button class="btn btn-primary" onclick="receiveTicket(\'' + ticket.id + '\')">接收工单</button>';
    else if (['PROCESSING', 'ESCALATED'].includes(ticket.status)) foot += '<button class="btn btn-primary" onclick="closeWarningModals();openFeedbackModal(\'' + ticket.id + '\')">' + (ticket.type === 'DISEASE_SIGNAL' ? '提交研判' : '核实反馈') + '</button>';
    else if (ticket.status === 'FEEDBACK') foot += '<button class="btn btn-primary" onclick="closeWarningModals();openReviewModal(\'' + ticket.id + '\')">复核</button>';
    const mask = waModal('工单详情 · ' + ticket.id, body, foot);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  function openRuleModal(ruleId) {
    applyDueRuleVersions();
    const rule = findRule(ruleId);
    if (!rule) return;
    const meta = TYPE_META[rule.warningType];
    const edit = rule.pendingVersion || rule;
    const automatic = AUTO_SEVERITY_RULES.has(rule.id);
    const history = rule.history.map(function (item) {
      return '<div class="wa-history-item"><strong>v' + item.version + '</strong><span class="wa-target">' + esc(fmtTime(item.time)) + ' · ' + esc(item.operator) + '</span><div style="margin-top:4px;color:#475569;font-size:12px">' + esc(item.detail) + '</div></div>';
    }).join('');
    const severityOptions = Object.keys(SEVERITY_META).map(function (key) {
      return '<option value="' + key + '"' + (edit.defaultSeverity === key ? ' selected' : '') + '>' + SEVERITY_META[key].label + '</option>';
    }).join('');
    const info = [
      ['规则ID', rule.id], ['所属层级', meta.code + ' · ' + meta.label], ['监测点', rule.monitorPoint],
      ['比较方法', rule.compareMethod], ['监测范围', rule.dimensionScope], ['观察窗口', rule.observeWindow],
      ['数据来源', meta.source], ['业务确认', rule.confirmation]
    ].map(function (item) {
      return '<div class="wa-field"><div class="wa-field-label">' + esc(item[0]) + '</div><div class="wa-value">' + esc(item[1]) + '</div></div>';
    }).join('');
    const body = '<div class="wa-fields">' + info + '</div>' +
      '<div class="wa-callout info" style="margin:12px 0"><strong>判定依据：</strong>' + esc(rule.basis) + '<br><strong>当前执行条件：</strong>' + esc(executionDescription(rule)) + '</div>' +
      '<div class="wa-section"><h4 class="wa-h">版本参数</h4><div class="wa-form-grid">' +
      '<div class="form-group"><label>阈值（' + esc(rule.unit) + '）</label><input id="waRuleThreshold" type="number" min="0" step="0.01" value="' + esc(edit.thresholdValue) + '"></div>' +
      '<div class="form-group"><label>最小样本量</label><input id="waRuleMinSample" type="number" min="' + (rule.requiresSample ? 1 : 0) + '" step="1" value="' + esc(edit.minSampleSize) + '"></div>' +
      '<div class="form-group"><label>' + (automatic ? '基础级别（按规则自动分级）' : '默认级别') + '</label><select id="waRuleSeverity"' + (automatic ? ' disabled' : '') + '>' + severityOptions + '</select></div>' +
      '<div class="form-group"><label>生效日期</label><input id="waRuleEffectiveDate" type="date" value="' + esc(edit.effectiveDate) + '"></div>' +
      '<div class="form-group full"><label>参数变更原因 *</label><textarea id="waRuleChangeReason" rows="2" placeholder="说明本次调整的业务原因"></textarea></div>' +
      '</div></div>' +
      '<div class="wa-note">当前生效参数 v' + (rule.activeVersion || 2) + (rule.pendingVersion ? '；待生效参数 v' + rule.pendingVersion.activeVersion + '（' + esc(rule.pendingVersion.effectiveDate) + '）' : '') + '。本页为示例配置演示。</div>' +
      '<div class="wa-note">当前状态：' + (rule.isEnabled ? '启用' : '停用') + '；最近修改：' + esc(rule.updatedBy) + ' · ' + fmtTime(rule.updatedAt) + '。阈值调整仅影响后续计算，历史预警保留原快照。</div>' +
      '<div class="wa-section" style="margin-top:14px"><h4 class="wa-h">修改历史</h4><div class="wa-history">' + history + '</div></div>';
    const foot = '<button class="btn btn-ghost" data-close>关闭</button>' +
      '<button class="btn btn-outline" onclick="toggleRule(\'' + rule.id + '\')">' + (rule.isEnabled ? '停用规则' : '启用规则') + '</button>' +
      '<button class="btn btn-primary" onclick="saveRuleVersion(\'' + rule.id + '\')">保存为新版本</button>';
    const mask = waModal('规则配置 · ' + rule.id, body, foot);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  function saveRuleVersion(ruleId) {
    const rule = findRule(ruleId);
    if (!rule) return;
    const threshold = Number(document.getElementById('waRuleThreshold').value);
    const minSample = Number(document.getElementById('waRuleMinSample').value);
    const severity = document.getElementById('waRuleSeverity').value;
    const effectiveDate = document.getElementById('waRuleEffectiveDate').value;
    const reason = document.getElementById('waRuleChangeReason')?.value.trim() || '';
    if (!Number.isFinite(threshold) || threshold < 0) { toast('阈值必须是不小于0的数字', 'error'); return; }
    if (!Number.isInteger(minSample) || minSample < 0) { toast('最小样本量必须是不小于0的整数', 'error'); return; }
    if (!effectiveDate) { toast('请选择生效日期', 'error'); return; }
    if (reason.length < 4) { toast('请填写参数变更原因', 'error'); return; }
    if (rule.requiresSample && minSample < 1) { toast('本规则最小样本量至少为1', 'error'); return; }
    if (['A-TIMELINESS', 'A-FOLLOWUP-LOST', 'A-DCN-MONTH', 'B-MV-LOW', 'B-MV-CANCER', 'B-DCO-HIGH', 'B-UB-HIGH', 'B-OU-HIGH', 'B-AGE-UNKNOWN', 'B-DCN-OPEN', 'B-DCN-CANCER'].includes(rule.id) && threshold > 100) {
      toast('比率阈值须在0至100之间', 'error'); return;
    }
    if (/^B-MI-/.test(rule.id) && threshold > 1) { toast('M/I偏离比例须在0至1之间', 'error'); return; }
    if (['A-ZERO-REPORT', 'A-XIECHA-OVERDUE', 'A-AUDIT-BACKLOG', 'A-NCCR-SUBMIT', 'ASSIGN-STALE'].includes(rule.id) && !Number.isInteger(threshold)) {
      toast('周期或数量阈值须为整数', 'error'); return;
    }
    const current = rule.pendingVersion || rule;
    const changes = [];
    if (threshold !== current.thresholdValue) changes.push('阈值：' + current.thresholdValue + rule.unit + ' → ' + threshold + rule.unit);
    if (minSample !== current.minSampleSize) changes.push('最小样本量：' + current.minSampleSize + ' → ' + minSample);
    if (severity !== current.defaultSeverity) changes.push('默认级别：' + SEVERITY_META[current.defaultSeverity].label + ' → ' + SEVERITY_META[severity].label);
    if (effectiveDate !== current.effectiveDate) changes.push('生效日期：' + current.effectiveDate + ' → ' + effectiveDate);
    if (!changes.length) { toast('参数未变化，未创建新版本', 'error'); return; }
    const time = new Date();
    const next = { thresholdValue: threshold, minSampleSize: minSample, defaultSeverity: AUTO_SEVERITY_RULES.has(rule.id) ? rule.defaultSeverity : severity, effectiveDate, activeVersion: rule.history.length + 1 };
    if (effectiveDate > todayISO()) rule.pendingVersion = next;
    else { Object.assign(rule, next); delete rule.pendingVersion; }
    rule.updatedBy = currentOperator();
    rule.updatedAt = time;
    rule.history.push({ version: rule.history.length + 1, time, operator: currentOperator(), detail: '参数调整：' + changes.join('；') + '；原因：' + reason + (rule.pendingVersion ? '；待生效' : '；已生效') });
    logAction({ layer: TYPE_META[rule.warningType].code, action: '规则版本变更', from: 'v' + (rule.history.length - 1), to: 'v' + rule.history.length, reason: changes.join('；') });
    closeTopModal();
    toast('已保存示例参数 v' + rule.history.length + (rule.pendingVersion ? '，将在' + effectiveDate + '生效' : ''));
    renderPage(state.page);
  }

  /* ==================== 路由与导出 ==================== */
  function renderWarningPage(pageId) {
    if (!OWNED_IDS.includes(pageId)) return null;
    closeWarningModals();
    /* 数据统计副本入口（统计分析/报卡质量监测）：委托 DA 渲染，不改动预警模块自身状态 */
    if (pageId === 'mon-analysis-stats') return window.DA ? window.DA.render('analysis-stats') : null;
    if (pageId === 'mon-analysis-quality') return window.DA ? window.DA.render('analysis-quality') : null;
    state.page = pageId;
    if (pageId === 'warning-records') return renderRecords();
    if (pageId === 'warning-tickets') return renderTickets();
    if (pageId === 'warning-rules') return renderRules();
    return '<div class="wa-page"><div class="wa-empty">页面开发中</div></div>';
  }

  function bootWarningModule() {
    seedRules();
    seedData();
  }

  const publicApi = {
    rules, warnings, tickets, operationLogs, warningRuns, TYPE_META, SEVERITY_META,
    getWarningOperator: currentOperator, warningRuleDescription: executionDescription,
    runAllEngines, runLayerEngine, scanOverdue,
    waGo, waSetFilter, waOnKeyword, waSetRecordType, waSetRuleType, waSetTicketType, waResetRecordFilter, waResetTicketFilter, waResetRuleFilter, waNavigate, closeWarningModals, waKpiDrill,
    showWarningDetail, showTicketDetail, openRuleModal, saveRuleVersion, toggleRule,
    receiveTicket, openFeedbackModal, submitFeedback, openReviewModal, closeTicket, returnTicket,
    findRule, findWarning, findTicket, findTicketByWarning, miJudge, devJudge, createStatsWarning, renderWarningPage
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = publicApi;
  if (typeof window !== 'undefined') {
    Object.assign(window, publicApi);
    window.warningPageIds = OWNED_IDS.slice();
  }

  bootWarningModule();





})();
