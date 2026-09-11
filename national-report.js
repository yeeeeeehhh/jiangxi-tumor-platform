/**
 * 国家肿瘤数据上报（国家癌症中心 NCCR 上报闭环）
 * 一级导航：国家肿瘤数据上报 → 数据预览 / 上报记录 / 上报列表
 * 实现：结构化重写（数据层 nccrData 与渲染分离 + 逐交互 loading/空态/错误态 + 隐私脱敏）
 * 依据 docs/国家肿瘤数据上报_模块细化设计.md（PRD 收敛版）与 docs/国家肿瘤数据上报_交互实现规划.md
 *
 * 一期范围：Level 0–3 全部交互 + 系统配置 + 横切规范。
 * 后置（不做）：M2 排名 / M3 趋势 / M9 真实 API。
 * 数据说明：nccrData 内为【原型演示数据】，真实接入仅替换 nccrData 取数实现，UI 不动。
 */
(function () {
  'use strict';

  /* ===================== 1. 样式块（集中，替换散落 inline） ===================== */
  var st = document.getElementById('nccrReportStyles');
  if (!st) {
    st = document.createElement('style');
    st.id = 'nccrReportStyles';
    document.head.appendChild(st);
  }
  st.textContent =
    '.nccr-hint{font-size:12px;color:#667085;line-height:1.5}' +
    '.nccr-count{margin-bottom:8px;color:#667085;font-size:13px}' +
    '.nccr-row-ops{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}' +
    '.nccr-tone-ok{color:#027a48;font-weight:600}.nccr-tone-warn{color:#b54708;font-weight:600}.nccr-tone-bad{color:#b42318;font-weight:600}' +
    '.nccr-section{margin-bottom:18px}' +
    '.nccr-section-title{font-size:13px;font-weight:600;color:#1f2937;margin:0 0 10px}' +
    '.nccr-pkg-grid{display:flex;flex-wrap:wrap;gap:10px}' +
    '.nccr-pkg-card{border:1px solid var(--border);border-radius:8px;padding:10px 12px;min-width:210px;cursor:pointer;background:#fff;transition:border-color .15s,background .15s}' +
    '.nccr-pkg-card:hover{border-color:#9db8dc}' +
    '.nccr-pkg-card.checked{border-color:var(--primary);background:#f5f9ff}' +
    '.nccr-pkg-card .ttl{font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px}' +
    '.nccr-pkg-card .desc{font-size:12px;color:#667085;margin-top:5px;line-height:1.5}' +
    '.nccr-inline-error{color:#b42318;font-size:12px;margin-top:5px;min-height:0}' +
    '.nccr-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.72);z-index:6;font-size:13px;color:#475467;border-radius:8px}' +
    '.nccr-spinner{width:18px;height:18px;border:2px solid #cbd5e1;border-top-color:#185fa5;border-radius:50%;animation:nccrSpin .7s linear infinite;margin-right:8px}' +
    '@keyframes nccrSpin{to{transform:rotate(360deg)}}' +
    '.btn.is-loading{opacity:.65;pointer-events:none}' +
    '.nccr-frozen-tag{display:inline-block;font-size:12px;color:#b42318;font-weight:600;margin-left:8px}' +
    '.nccr-mask{filter:blur(4px);user-select:none}' +
    '.nccr-detail-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 18px;margin-bottom:14px;font-size:13px}' +
    '.nccr-detail-meta .k{color:#667085}.nccr-detail-meta .v{color:#1f2937;font-weight:500}' +
    '.nccr-empty{text-align:center;color:#64748b;padding:36px 16px}' +
    '.nccr-empty .btn{margin-top:12px}' +
    '.cd-field-error{color:#b42318;font-size:12px;margin-top:4px;display:none}' +
    '.analysis-kpi{border:1px solid var(--border);border-radius:8px;padding:12px 14px;background:#fff}' +
    '.analysis-kpi-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:14px}' +
    '.nccr-grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}' +
    '.nccr-span-2{grid-column:1/-1}' +
    '.nccr-page-title{font-size:15px;font-weight:600;color:#1f2937;margin:0 0 4px}' +
    '.nccr-page-sub{font-size:12px;color:#667085;margin:0 0 14px}';

  /* ===================== 2. 工具函数 ===================== */
  var e = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function pad2(n) { return String(n).padStart(2, '0'); }

  /* ===================== 3. 配置 ===================== */
  var TEMPLATE_VERSION = 'NCCR-2024-v1';
  var A_HEADERS = ['登记处编码','国家登记流水号','省内报告卡编号','姓名','证件类型','证件号码','性别','出生日期','实足年龄','民族','婚姻状况','职业','工作单位','联系电话','联系人关系','联系人','联系人电话','户籍区划码','户籍详细地址','常住区划码','常住详细地址','城乡','解剖学部位ICD-O-3','形态学编码','行为','分级','侧位','诊断依据','DCO标志','确诊日期','ICD10','TNM-T','TNM-N','TNM-M','治疗方式','诊断结果','详细诊断','诊断单位编码','诊断单位名称','门诊号','住院号','报告医师','报告日期','多原发序号','检查状态','更新日期','重卡标记'];
  var B_HEADERS = ['登记处编码','国家登记流水号','省内报告卡编号','最后接触日期','最后接触状态','生存月数','死亡地点','根本死因分类','死因ICD10','死亡日期','死亡报告医师'];
  var C_HEADERS = ['登记处编码','区划码','年份','性别','年龄组代码','年龄组名称','人口数'];
  var D_HEADERS = ['登记处编码','统计年','发病数','肿瘤死亡数','MV%','HV%','DCO%','UB%','O&U%','M/I','质量结论'];
  var AGE19 = ['0岁','1-4岁','5-9岁','10-14岁','15-19岁','20-24岁','25-29岁','30-34岁','35-39岁','40-44岁','45-49岁','50-54岁','55-59岁','60-64岁','65-69岁','70-74岁','75-79岁','80-84岁','85岁及以上'];

  var nccrConfig = {
    templateVersion: TEMPLATE_VERSION,
    defaultTransport: 'file',
    httpEnabled: true,
    httpBaseUrl: 'https://www.nccr.org.cn/api/v1',
    sftpEnabled: false,
    sftpHost: '',
    timelinessMonths: 30,
    thresholds: {
      mvPass: 66, mvWarn: 60,
      dcoBlock: 15,
      miPassLow: 0.60, miPassHigh: 0.80,
      miWarnLow: 0.50, miWarnHigh: 0.90,
      sitePass: 1, siteWarn: 3,
      basisBlock: 5
    }
  };

  /* ===================== 4. 数据层 nccrData（演示数据 + 取数 stub） ===================== */
  // 预览：登记处年度质量快照（与门禁口径同源）【原型演示数据】
  var DEMO_SNAPSHOTS = [
    { year: 2024, code: '360100001', name: '南昌市肿瘤登记中心', mv: 68.5, dco: 2.8, mi: 0.62, ub: 1.2, ou: 0.8, incidence: 1256, death: 780, popOk: true, candidates: 1256 },
    { year: 2024, code: '360700001', name: '赣州市肿瘤登记中心', mv: 64.2, dco: 4.1, mi: 0.69, ub: 2.1, ou: 1.5, incidence: 890, death: 610, popOk: true, candidates: 890 },
    { year: 2024, code: '360400001', name: '九江市肿瘤登记中心', mv: 70.1, dco: 3.2, mi: 0.71, ub: 0.9, ou: 0.6, incidence: 620, death: 440, popOk: true, candidates: 620 },
    { year: 2024, code: '360000001', name: '江西省肿瘤登记中心（汇总）', mv: 66.8, dco: 3.5, mi: 0.65, ub: 1.5, ou: 1.0, incidence: 4200, death: 2730, popOk: true, candidates: 4200 },
    { year: 2023, code: '360000001', name: '江西省肿瘤登记中心（汇总）', mv: 58.0, dco: 16.2, mi: 0.42, ub: 6.0, ou: 3.5, incidence: 4100, death: 1722, popOk: false, candidates: 4100 }
  ];

  var REGISTRY_NAMES = {
    '360100001': '南昌市肿瘤登记中心',
    '360700001': '赣州市肿瘤登记中心',
    '360400001': '九江市肿瘤登记中心',
    '360000001': '江西省肿瘤登记中心（汇总）'
  };

  function demoMetricsFor(registry) {
    if (registry === '360000001') return { mv: 58.0, dco: 16.2, mi: 0.42, ub: 6.0, ou: 3.5, incidence: 4200, death: 1764 };
    if (registry === '360700001') return { mv: 64.2, dco: 4.1, mi: 0.69, ub: 2.1, ou: 1.5, incidence: 890, death: 610 };
    return { mv: 68.5, dco: 2.8, mi: 0.62, ub: 1.2, ou: 0.8, incidence: 1256, death: 780 };
  }

  // 上报批次【原型演示数据】
  var DEMO_BATCHES = [
    {
      id: 'NCCR-JX-2024-0001', year: 2024, registry: '360100001', registryName: '南昌市肿瘤登记中心',
      packages: ['A', 'B', 'C', 'D'], templateVersion: TEMPLATE_VERSION, transport: 'file',
      status: '已回执归档', gate: 'pass', caseCount: 1256,
      metrics: { mv: 68.5, dco: 2.8, mi: 0.62, ub: 1.2, ou: 0.8, incidence: 1256, death: 780 },
      caseErrors: [], fileName: '41_360100001_2024_ABCD_NCCR-2024-v1_20260315103000.csv', fileHash: 'a1b2c3d4e5f67890',
      remoteRef: '', receiptNo: 'NCCR-R-20260320-001', receiptStatus: 'accepted', receiptRemark: '国家平台受理通过',
      createdBy: '省级上报岗', createdAt: '2026-03-10 09:20', exportedAt: '2026-03-15 10:30', remark: '2024年度南昌包',
      forcePassBy: '', forcePassReason: '', forcePassAt: '', frozen: true, individualCheck: null, popCheck: null, receiptAt: '2026-03-20 14:00', deliver: { channel: 'file', at: '2026-03-15 10:30', by: '省级上报岗' }
    },
    {
      id: 'NCCR-JX-2024-0002', year: 2024, registry: '360700001', registryName: '赣州市肿瘤登记中心',
      packages: ['A', 'B', 'D'], templateVersion: TEMPLATE_VERSION, transport: 'http',
      status: '待投递', gate: 'warn', caseCount: 890,
      metrics: { mv: 64.2, dco: 4.1, mi: 0.69, ub: 2.1, ou: 1.5, incidence: 890, death: 610 },
      caseErrors: [{ sourceId: 'JX-2024-000188', ruleId: 'G-C04', message: '形态学编码缺失' }, { sourceId: 'JX-2024-000201', ruleId: 'G-C07', message: 'DCO 缺死亡日期' }],
      fileName: '', fileHash: '', remoteRef: '', receiptNo: '', receiptStatus: '', receiptRemark: '',
      forcePassBy: '', forcePassReason: '', forcePassAt: '', frozen: false, individualCheck: null, popCheck: null, receiptAt: '', deliver: null,
      createdBy: '省级上报岗', createdAt: '2026-07-20 14:10', exportedAt: '', remark: '赣州包 MV% 偏低'
    },
    {
      id: 'NCCR-JX-2023-0003', year: 2023, registry: '360000001', registryName: '江西省肿瘤登记中心（汇总）',
      packages: ['A', 'B', 'C', 'D'], templateVersion: TEMPLATE_VERSION, transport: 'file',
      status: '门禁未过·待整改', gate: 'block', caseCount: 0,
      metrics: { mv: 58.0, dco: 16.2, mi: 0.42, ub: 6.0, ou: 3.5, incidence: 4200, death: 1764 },
      caseErrors: [{ sourceId: '—', ruleId: 'Q-MV', message: 'MV%=58.0% 低于阻断线 60%' }, { sourceId: '—', ruleId: 'Q-DCO', message: 'DCO%=16.2% 高于 15%' }, { sourceId: '—', ruleId: 'Q-MI', message: 'M/I=0.42 低于 0.50' }],
      fileName: '', fileHash: '', remoteRef: '', receiptNo: '', receiptStatus: '', receiptRemark: '',
      forcePassBy: '', forcePassReason: '', forcePassAt: '', frozen: false, individualCheck: null, popCheck: null, receiptAt: '', deliver: null,
      createdBy: '省级上报岗', createdAt: '2026-07-28 11:00', exportedAt: '', remark: '演示阻断批次'
    }
  ];

  var nccrData = {
    snapshots: DEMO_SNAPSHOTS.slice(),
    batches: DEMO_BATCHES.slice(),
    // —— 取数 stub（真实接入时替换实现，UI 不变）——
    getSnapshots: function (year) {
      return this.snapshots.filter(function (r) { return String(r.year) === String(year); });
    },
    getSnapshot: function (code, year) {
      return this.snapshots.filter(function (r) { return r.code === code && String(r.year) === String(year); })[0] || null;
    },
    listBatches: function () { return this.batches.slice(); },
    getBatch: function (id) { return this.batches.filter(function (b) { return b.id === id; })[0] || null; },
    upsert: function (b) {
      var i = this.batches.findIndex(function (x) { return x.id === b.id; });
      if (i >= 0) this.batches[i] = b; else this.batches.unshift(b);
      return b;
    },
    nextSeq: function (year) {
      var max = 0;
      this.batches.forEach(function (b) { if (String(b.year) === String(year)) { var n = parseInt(String(b.id).split('-').pop(), 10); if (!isNaN(n)) max = Math.max(max, n); } });
      return pad2(max + 1);
    }
  };

  /* ===================== 5. 状态与权限 ===================== */
  var nccrState = {
    page: 'nccr-list',
    view: 'list',
    selectedId: null,
    fromPage: 'nccr-list',
    detailTab: 'cases',
    previewYear: '2024',
    previewRegion: '',
    filters: { year: '', gate: '', status: '', keyword: '' },
    recordFilters: { year: '', receipt: '', keyword: '' },
    form: { year: '2024', registry: '360100001', packages: ['A', 'B', 'C', 'D'], transport: 'file', remark: '' }
  };

  /* ===================== 6. 展示辅助 ===================== */
  function packageLabel(codes) {
    var map = { A: '报告卡个案', B: '随访死亡', C: '人口数据', D: '质量报告' };
    return (codes || []).map(function (c) { return map[c] || c; }).join('、') || '—';
  }
  function transportLabel(t) {
    if (t === 'http') return '在线推送';
    if (t === 'sftp') return '文件服务器上传';
    return '下载文件';
  }
  function statusLabel(s) {
    var map = { '草稿': '未开始', '门禁中': '质量检查中', '待投递': '待上报', '已投递': '已导出', '已回执归档': '上报完成', '已退回': '国家退回', '门禁未过·待整改': '质量未达标', '已作废': '已取消' };
    return map[s] || s;
  }
  function gateBadge(g) {
    if (g === 'pass') return '<span class="badge badge-success">可以上报</span>';
    if (g === 'warn') return '<span class="badge badge-warning">有风险</span>';
    if (g === 'block') return '<span class="badge badge-danger">不能上报</span>';
    return '<span class="badge badge-muted">未检查</span>';
  }
  function statusBadge(s) {
    var map = { '草稿': 'badge-muted', '门禁中': 'badge-info', '待投递': 'badge-warning', '已投递': 'badge-primary', '已回执归档': 'badge-success', '已退回': 'badge-danger', '门禁未过·待整改': 'badge-danger', '已作废': 'badge-muted' };
    return '<span class="badge ' + (map[s] || 'badge-muted') + '">' + e(statusLabel(s)) + '</span>';
  }
  function levelLabel(level) {
    if (level === 'pass') return '<span class="badge badge-success">可报</span>';
    if (level === 'warn') return '<span class="badge badge-warning">有风险</span>';
    return '<span class="badge badge-danger">不能报</span>';
  }
  function nextStepHint(b) {
    if (b.status === '已作废') return '已取消';
    if (b.status === '已回执归档') return '已完成';
    if (b.status === '已退回') return '请修正后重新上报';
    if (b.status === '已投递') return '下一步：登记国家回执';
    if (b.status === '草稿' || !b.gate) return '下一步：检查质量';
    if (b.gate === 'block') return '质量未达标，请先改数据';
    if (b.gate === 'warn' && !b.forcePassBy) return '下一步：确认风险后上报';
    if (b.status === '待投递') return '下一步：导出并上报';
    return '—';
  }
  function isWorkBatch(b) { return ['草稿', '门禁中', '待投递', '已投递', '已退回', '门禁未过·待整改'].indexOf(b.status) >= 0; }
  function isRecordBatch(b) { return ['已投递', '已回执归档', '已退回', '已作废'].indexOf(b.status) >= 0; }

  function metricTone(kind, val) {
    var t = nccrConfig.thresholds;
    if (kind === 'mv') return val >= t.mvPass ? 'ok' : val >= t.mvWarn ? 'warn' : 'bad';
    if (kind === 'dco') return val <= t.dcoBlock ? 'ok' : 'bad';
    if (kind === 'mi') {
      if (val >= t.miPassLow && val <= t.miPassHigh) return 'ok';
      if (val >= t.miWarnLow && val <= t.miWarnHigh) return 'warn';
      return 'bad';
    }
    if (kind === 'ub') return val < t.basisBlock ? 'ok' : 'bad';
    if (kind === 'ou') return val < t.sitePass ? 'ok' : val <= t.siteWarn ? 'warn' : 'bad';
    return 'ok';
  }
  function toneClass(tone) { return tone === 'ok' ? 'nccr-tone-ok' : tone === 'warn' ? 'nccr-tone-warn' : 'nccr-tone-bad'; }

  function kpi(label, value, tone) {
    var color = tone === 'ok' ? '#027a48' : tone === 'warn' ? '#b54708' : '#b42318';
    return '<div class="analysis-kpi"><div class="analysis-kpi-label" style="font-size:12px;color:#667085">' + label + '</div><div class="analysis-kpi-value" style="font-size:22px;font-weight:700;color:' + color + '">' + value + '</div></div>';
  }

  function emptyState(text, actionHtml) {
    return '<div class="nccr-empty"><div style="font-size:14px">' + e(text) + '</div>' + (actionHtml || '') + '</div>';
  }

  function nccrRefresh(extra) {
    var page = nccrState.page || 'nccr-list';
    if (extra) nccrState.view = extra;
    renderPage(page);
  }

  /* ===================== 7. 指标计算 ===================== */
  function computeGate(metrics) {
    var t = nccrConfig.thresholds;
    var reasons = [];
    var level = 'pass';
    function raise(to, msg) { reasons.push(msg); if (to === 'block') level = 'block'; else if (to === 'warn' && level !== 'block') level = 'warn'; }
    if (metrics.mv < t.mvWarn) raise('block', 'MV%=' + metrics.mv + '% < ' + t.mvWarn);
    else if (metrics.mv < t.mvPass) raise('warn', 'MV%=' + metrics.mv + '% 未达 ' + t.mvPass);
    if (metrics.dco > t.dcoBlock) raise('block', 'DCO%=' + metrics.dco + '% > ' + t.dcoBlock);
    if (metrics.mi < t.miWarnLow || metrics.mi > t.miWarnHigh) raise('block', 'M/I=' + metrics.mi + ' 超出 [' + t.miWarnLow + ',' + t.miWarnHigh + ']');
    else if (metrics.mi < t.miPassLow || metrics.mi > t.miPassHigh) raise('warn', 'M/I=' + metrics.mi + ' 不在 NCCR 纳入区间 [' + t.miPassLow + ',' + t.miPassHigh + ']');
    if (metrics.ou > t.siteWarn) raise('block', 'O&U%=' + metrics.ou + '% > ' + t.siteWarn);
    else if (metrics.ou >= t.sitePass) raise('warn', 'O&U%=' + metrics.ou + '% ≥ ' + t.sitePass);
    if (metrics.ub >= t.basisBlock) raise('block', 'UB%=' + metrics.ub + '% ≥ ' + t.basisBlock);
    return { level: level, reasons: reasons };
  }
  function snapshotLevel(m) { return computeGate(m).level; }

  // M4 个案门禁预检：对勾选范围已锁定的报告卡逐卡跑硬校验（原型用演示规则模拟）
  function runIndividualCheck(batch) {
    var total = batch.caseCount || 0;
    var failList = [];
    if (batch.registry === '360700001' && batch.year === 2024) {
      failList.push({ cardId: 'JX-2024-000188', ruleId: 'G-C04', message: '形态学编码缺失（ICD-O-3 必填）' });
      failList.push({ cardId: 'JX-2024-000201', ruleId: 'G-C07', message: 'DCO 病例缺死亡日期' });
    }
    if (batch.gate === 'block') {
      failList.push({ cardId: '—', ruleId: 'G-C01', message: '存在未确认核对/锁定的卡片' });
    }
    return { total: total, fail: failList.length, failList: failList };
  }

  // M5 人口分母完整性校验：勾选 C 包时校验 19 年龄组×性别是否齐全
  function checkPopulation(batch) {
    if ((batch.packages || []).indexOf('C') < 0) return { complete: true, missingGroups: [], skipped: true };
    var snap = nccrData.getSnapshot(batch.registry, batch.year);
    if (snap && snap.popOk === false) {
      return { complete: false, missingGroups: ['男性 0–4 岁', '女性 85 岁及以上'] };
    }
    return { complete: true, missingGroups: [] };
  }

  function canDeliver(batch) {
    if (batch.gate === 'block') return false;
    if (batch.gate === 'warn' && !batch.forcePassBy) return false;
    return batch.status === '待投递' || batch.status === '已投递';
  }

  /* ===================== M14 时效催办（30 个月） ===================== */
  function nccrDeadline(year) {
    var d = new Date(Number(year), 11, 31); // 当年 12-31
    d.setMonth(d.getMonth() + Number(nccrConfig.timelinessMonths || 30));
    d.setDate(30);
    return d;
  }
  function nccrTimeliness(year) {
    var now = new Date();
    var dl = nccrDeadline(year);
    var monthsLeft = Math.round((dl - now) / (1000 * 60 * 60 * 24 * 30.44));
    var level = monthsLeft < 0 ? 'bad' : monthsLeft <= 6 ? 'warn' : 'ok';
    var y = dl.getFullYear(), m = pad2(dl.getMonth() + 1), day = pad2(dl.getDate());
    return { deadline: y + '-' + m + '-' + day, monthsLeft: monthsLeft < 0 ? 0 : monthsLeft, level: level };
  }
  function nccrTimelinessBanner() {
    var years = Array.from(new Set(nccrData.snapshots.map(function (s) { return s.year; }))).sort();
    var items = years.map(function (y) {
      var t = nccrTimeliness(y);
      var tone = t.level === 'bad' ? 'nccr-tone-bad' : t.level === 'warn' ? 'nccr-tone-warn' : 'nccr-tone-ok';
      var txt = t.level === 'bad'
        ? (y + ' 年度已超 30 个月时效，请尽快补报')
        : (y + ' 年度上报截止约 ' + t.deadline + '（剩余约 ' + t.monthsLeft + ' 个月）');
      return '<span class="' + tone + '">● ' + txt + '</span>';
    });
    return '<div class="nccr-hint" style="margin-bottom:10px;display:flex;gap:20px;flex-wrap:wrap;border-left:3px solid #f2a33c;padding-left:10px;background:#fffaf0">' + items.join('') + '</div>';
  }

  /* ===================== 8. CSV 与样例数据 ===================== */
  function csvEscape(v) {
    var s = String(v == null ? '' : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function downloadCsv(filename, headers, rows) {
    var lines = [headers.join(',')];
    rows.forEach(function (row) { lines.push(row.map(csvEscape).join(',')); });
    var bom = '﻿';
    var blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function sampleARows(batch) {
    return [
      [batch.registry, 'JX' + batch.year + '00000001', 'JX-' + batch.year + '-000091', '张伟', '01', '360102196503121234', '1', '1965-03-12', '59', '01', '2', '6', '', '13800001111', '5', '张芳', '13900002222', '360102', '董家窑街道XX号', '360102', '董家窑街道XX号', '1', 'C34.1', '8070', '3', '2', '1', '7', '0', batch.year + '-03-15', 'C34.1', 'T2', 'N1', 'M0', '1;2', '肺恶性肿瘤', '右肺上叶鳞状细胞癌', '360100H001', '江西省肿瘤医院', 'MZ240501', 'ZY240088', '王医生', batch.year + '-03-18', '1', '2', '2026-07-31', '0'],
      [batch.registry, 'JX' + batch.year + '00000002', 'JX-' + batch.year + '-000102', '李娜', '01', '360103197808152345', '2', '1978-08-15', '46', '01', '2', '2', '', '13800003333', '', '', '', '360103', '站前西路XX号', '360103', '站前西路XX号', '1', 'C50.9', '8500', '3', '2', '2', '7', '0', batch.year + '-05-20', 'C50.9', 'T1', 'N0', 'M0', '1', '乳房恶性肿瘤', '左乳浸润性导管癌', '360100H002', '南昌大学第一附属医院', 'MZ240622', 'ZY240103', '李医生', batch.year + '-05-22', '1', '1', '2026-07-31', '0']
    ];
  }
  function sampleBRows(batch) {
    return [
      [batch.registry, 'JX' + batch.year + '00000001', 'JX-' + batch.year + '-000091', (batch.year + 1) + '-12-01', '1', '21', '', '', '', '', ''],
      [batch.registry, 'JX' + batch.year + '00000002', 'JX-' + batch.year + '-000102', (batch.year + 1) + '-08-10', '3', '15', '1', '1', 'C50.9', (batch.year + 1) + '-08-10', '周医生']
    ];
  }
  function sampleCRows(batch) {
    var rows = [];
    AGE19.forEach(function (name, i) {
      var code = pad2(i);
      rows.push([batch.registry, batch.registry.slice(0, 6), String(batch.year), '1', code, name, String(3000 + i * 400)]);
      rows.push([batch.registry, batch.registry.slice(0, 6), String(batch.year), '2', code, name, String(2800 + i * 380)]);
    });
    return rows;
  }
  function sampleDRows(batch) {
    var m = batch.metrics;
    return [[batch.registry, String(batch.year), String(m.incidence), String(m.death), m.mv.toFixed(2), (m.mv - 6).toFixed(2), m.dco.toFixed(2), m.ub.toFixed(2), m.ou.toFixed(2), m.mi.toFixed(2), batch.gate]];
  }
  function hashStub(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    return ('00000000' + (h >>> 0).toString(16)).slice(-8) + Date.now().toString(16).slice(-8);
  }

  /* ===================== 9. loading 辅助 ===================== */
  function nccrSetLoading(on, msg) {
    var panel = document.querySelector('#pageContainer .panel');
    if (!panel) return;
    var ex = panel.querySelector('.nccr-loading');
    if (on) {
      if (!ex) {
        panel.style.position = 'relative';
        var d = document.createElement('div');
        d.className = 'nccr-loading';
        d.innerHTML = '<span class="nccr-spinner"></span>' + e(msg || '处理中…');
        panel.appendChild(d);
      }
    } else if (ex) { ex.remove(); }
  }

  /* ===================== 10. 页面渲染 ===================== */
  function nccrToolbar(actionsHtml) {
    return '<div class="page-toolbar"><div class="toolbar-actions">' + (actionsHtml || '') + '</div></div>';
  }

  function filteredBatches() {
    var f = nccrState.filters;
    return nccrData.listBatches().filter(function (b) {
      if (!isWorkBatch(b)) return false;
      if (f.year && String(b.year) !== f.year) return false;
      if (f.gate && b.gate !== f.gate) return false;
      if (f.status && b.status !== f.status) return false;
      if (f.keyword) {
        var k = f.keyword.trim();
        if (b.id.indexOf(k) < 0 && (b.receiptNo || '').indexOf(k) < 0 && b.registryName.indexOf(k) < 0) return false;
      }
      return true;
    });
  }
  function filteredRecords() {
    var f = nccrState.recordFilters;
    return nccrData.listBatches().filter(function (b) {
      if (!isRecordBatch(b)) return false;
      if (f.year && String(b.year) !== f.year) return false;
      if (f.receipt === 'accepted' && b.receiptStatus !== 'accepted') return false;
      if (f.receipt === 'partial' && b.receiptStatus !== 'partial') return false;
      if (f.receipt === 'rejected' && b.status !== '已退回' && b.receiptStatus !== 'rejected') return false;
      if (f.receipt === 'pending' && b.status !== '已投递') return false;
      if (f.keyword) {
        var k = f.keyword.trim();
        if (b.id.indexOf(k) < 0 && (b.receiptNo || '').indexOf(k) < 0 && b.registryName.indexOf(k) < 0) return false;
      }
      return true;
    });
  }

  function renderList() {
    var list = filteredBatches();
    var rows = list.map(function (b) {
      return '<tr>' +
        '<td><a href="javascript:void(0)" style="color:var(--primary)" onclick="nccrOpenDetail(\'' + b.id + '\')">' + e(b.id) + '</a></td>' +
        '<td>' + b.year + '</td>' +
        '<td>' + e(b.registryName) + '</td>' +
        '<td>' + e(packageLabel(b.packages)) + '</td>' +
        '<td>' + (b.caseCount || '—') + '</td>' +
        '<td>' + gateBadge(b.gate) + '</td>' +
        '<td>' + statusBadge(b.status) + '</td>' +
        '<td class="sticky-col">' + renderListRowOps(b) + '</td></tr>';
    }).join('');

    if (!rows) {
      rows = '<tr><td colspan="8">' + emptyState('暂无上报任务。', '<button class="btn btn-primary btn-sm" onclick="nccrNew()">+ 新建上报</button>') + '</td></tr>';
    }

    var f = nccrState.filters;
    return nccrToolbar(
      '<button class="btn btn-outline btn-sm" onclick="nccrDownloadTemplate()">下载空白模板</button>' +
      '<button class="btn btn-primary btn-sm" onclick="nccrNew()">+ 新建上报</button>'
    ) +
      '<div class="panel"><div class="panel-header">上报列表</div><div class="panel-body">' +
      '<div class="filter-toolbar">' +
      '<div class="form-group"><label>统计年</label><select onchange="nccrState.filters.year=this.value;nccrRefresh()"><option value="">全部</option><option value="2024"' + (f.year === '2024' ? ' selected' : '') + '>2024</option><option value="2023"' + (f.year === '2023' ? ' selected' : '') + '>2023</option></select></div>' +
      '<div class="form-group"><label>质量结果</label><select onchange="nccrState.filters.gate=this.value;nccrRefresh()"><option value="">全部</option><option value="pass"' + (f.gate === 'pass' ? ' selected' : '') + '>可以上报</option><option value="warn"' + (f.gate === 'warn' ? ' selected' : '') + '>有风险</option><option value="block"' + (f.gate === 'block' ? ' selected' : '') + '>不能上报</option></select></div>' +
      '<div class="form-group"><label>进度</label><select onchange="nccrState.filters.status=this.value;nccrRefresh()"><option value="">全部</option><option value="草稿"' + (f.status === '草稿' ? ' selected' : '') + '>未开始</option><option value="门禁中"' + (f.status === '门禁中' ? ' selected' : '') + '>质量检查中</option><option value="门禁未过·待整改"' + (f.status === '门禁未过·待整改' ? ' selected' : '') + '>质量未达标</option><option value="待投递"' + (f.status === '待投递' ? ' selected' : '') + '>待上报</option><option value="已投递"' + (f.status === '已投递' ? ' selected' : '') + '>已导出待回执</option><option value="已退回"' + (f.status === '已退回' ? ' selected' : '') + '>国家退回</option></select></div>' +
      '<div class="form-group search-group"><label>搜索</label><input placeholder="编号 / 回执号 / 登记处" value="' + e(f.keyword) + '" onkeydown="if(event.key===\'Enter\'){nccrState.filters.keyword=this.value;nccrRefresh()}"></div>' +
      '<div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="nccrState.filters.keyword=document.querySelector(\'#pageContainer .search-group input\').value;nccrRefresh()">查询</button><button class="btn btn-ghost btn-sm" onclick="nccrState.filters={year:\'\',gate:\'\',status:\'\',keyword:\'\'};nccrRefresh()">重置</button></div>' +
      '</div>' +
      '<div class="nccr-count">共 ' + list.length + ' 条待处理 / 进行中任务（已完成的在「上报记录」）</div>' +
      nccrTimelinessBanner() +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>编号</th><th>年份</th><th>登记处</th><th>上报内容</th><th>病例数</th><th>质量</th><th>进度</th><th class="sticky-col">操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '</div></div>';
  }

  function renderListRowOps(b) {
    var primary = listPrimaryAction(b);
    var html = '<div class="nccr-row-ops"><button class="btn btn-ghost btn-xs" onclick="nccrOpenDetail(\'' + b.id + '\')">详情</button>';
    if (primary) {
      html += '<button class="btn ' + primary.cls + ' btn-xs" onclick="' + primary.fn + '(\'' + b.id + '\')">' + primary.label + '</button>';
    }
    html += '</div>';
    return html;
  }

  function listPrimaryAction(b) {
    if (b.status === '草稿' || (b.status === '待投递' && (!b.gate || b.gate === 'block'))) return { cls: 'btn-outline', fn: 'nccrRunGate', label: '质控' };
    if (b.status === '待投递' && b.gate === 'warn' && !b.forcePassBy) return { cls: 'btn-warning', fn: 'nccrForcePass', label: '确认风险' };
    if (b.status === '待投递' && canDeliver(b)) return { cls: 'btn-primary', fn: 'nccrDeliver', label: '上报' };
    if (b.status === '已投递') return { cls: 'btn-primary', fn: 'nccrReceipt', label: '登记回执' };
    if (b.status === '已退回') return { cls: 'btn-outline', fn: 'nccrClone', label: '以此新建' };
    if (b.status === '已回执归档' && (b.fileName || b.exportedAt)) return { cls: 'btn-outline', fn: 'nccrDownload', label: '下载' };
    return null;
  }

  function renderPreview() {
    var year = nccrState.previewYear || '2024';
    var region = nccrState.previewRegion || '';
    var rows = nccrData.getSnapshots(year);
    if (!rows.length) {
      return nccrToolbar('<button class="btn btn-primary btn-sm" onclick="nccrNew()">+ 新建上报</button>') +
        '<div class="panel"><div class="panel-header">数据预览</div><div class="panel-body">' +
        emptyState('该统计年暂无预览数据（演示数据仅含 2023 / 2024）。') + '</div></div>';
    }
    var province = rows.filter(function (r) { return r.code === '360000001'; })[0] || null;
    var cities = rows.filter(function (r) { return r.code !== '360000001'; });
    if (!province && cities.length) {
      province = {
        name: '全省（演示汇总）', code: '360000001', year: Number(year),
        mv: cities.reduce(function (s, x) { return s + x.mv; }, 0) / cities.length,
        dco: cities.reduce(function (s, x) { return s + x.dco; }, 0) / cities.length,
        mi: cities.reduce(function (s, x) { return s + x.mi; }, 0) / cities.length,
        ub: cities.reduce(function (s, x) { return s + x.ub; }, 0) / cities.length,
        ou: cities.reduce(function (s, x) { return s + x.ou; }, 0) / cities.length,
        incidence: cities.reduce(function (s, x) { return s + x.incidence; }, 0),
        death: cities.reduce(function (s, x) { return s + x.death; }, 0),
        popOk: cities.every(function (x) { return x.popOk; }),
        candidates: cities.reduce(function (s, x) { return s + x.candidates; }, 0)
      };
    }
    var focus = province, tableSource = cities.length ? cities : rows;
    if (region === '360000001') { focus = province; tableSource = cities.length ? cities : (province ? [province] : []); }
    else if (region) { var hit = rows.filter(function (r) { return r.code === region; })[0] || null; focus = hit; tableSource = hit ? [hit] : []; }

    var level = focus ? snapshotLevel(focus) : 'block';
    var scopeLabel = !region || region === '360000001' ? '全省' : (focus ? focus.name.replace(/肿瘤登记中心.*$/, '') : '所选区域');
    var summaryKpis =
      '<div class="analysis-kpi-row">' +
      kpi(scopeLabel + '结论（' + year + '）', focus ? levelLabel(level) : '—', level === 'pass' ? 'ok' : level === 'warn' ? 'warn' : 'bad') +
      kpi('纳入候选病例', focus ? String(focus.candidates) : '—', 'ok') +
      kpi('人口数据', focus && focus.popOk ? '19 组齐全' : '不齐全', focus && focus.popOk ? 'ok' : 'bad') +
      '</div>';
    var metricKpis = focus ? (
      '<div class="analysis-kpi-row">' +
      kpi('病理确诊率 MV%', focus.mv.toFixed(1) + '%', metricTone('mv', focus.mv)) +
      kpi('仅死亡补发 DCO%', focus.dco.toFixed(1) + '%', metricTone('dco', focus.dco)) +
      kpi('死亡/发病比 M/I', focus.mi.toFixed(2), metricTone('mi', focus.mi)) +
      kpi('诊断依据不明 UB%', focus.ub.toFixed(1) + '%', metricTone('ub', focus.ub)) +
      kpi('部位与形态不明 O&U%', focus.ou.toFixed(1) + '%', metricTone('ou', focus.ou)) +
      '</div>'
    ) : '';

    var regionOpts = [
      { code: '', name: '全部' }, { code: '360000001', name: '江西省（全省）' },
      { code: '360100001', name: '南昌市' }, { code: '360400001', name: '九江市' }, { code: '360700001', name: '赣州市' }
    ];
    var regionSelect = regionOpts.map(function (o) { return '<option value="' + o.code + '"' + (region === o.code ? ' selected' : '') + '>' + o.name + '</option>'; }).join('');

    var tableRows = tableSource.map(function (r) {
      var lv = snapshotLevel(r);
      return '<tr>' +
        '<td>' + e(r.name) + '</td><td>' + r.incidence + '</td><td>' + r.death + '</td>' +
        '<td class="' + toneClass(metricTone('mv', r.mv)) + '">' + r.mv.toFixed(1) + '%</td>' +
        '<td class="' + toneClass(metricTone('dco', r.dco)) + '">' + r.dco.toFixed(1) + '%</td>' +
        '<td class="' + toneClass(metricTone('mi', r.mi)) + '">' + r.mi.toFixed(2) + '</td>' +
        '<td class="' + toneClass(metricTone('ub', r.ub)) + '">' + r.ub.toFixed(1) + '%</td>' +
        '<td class="' + toneClass(metricTone('ou', r.ou)) + '">' + r.ou.toFixed(1) + '%</td>' +
        '<td>' + (r.popOk ? '齐全' : '缺') + '</td>' +
        '<td>' + levelLabel(lv) + '</td>' +
        '<td class="sticky-col">' + '<button class="btn btn-primary btn-xs" onclick="nccrGoListForRegistry(\'' + r.code + '\',\'' + r.year + '\')">去组批上报</button>' + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="11">' + emptyState('该筛选条件下暂无数据') + '</td></tr>';

    return nccrToolbar(
      '<button class="btn btn-primary btn-sm" onclick="nccrState.filters.year=nccrState.previewYear||\'2024\';nccrNew()">+ 新建上报</button>'
    ) +
      '<div class="panel"><div class="panel-header">数据预览</div><div class="panel-body">' +
      '<div class="filter-toolbar">' +
      '<div class="form-group"><label>统计年</label><select onchange="nccrState.previewYear=this.value;nccrRefresh()"><option value="2024"' + (year === '2024' ? ' selected' : '') + '>2024</option><option value="2023"' + (year === '2023' ? ' selected' : '') + '>2023</option></select></div>' +
      '<div class="form-group"><label>区域</label><select onchange="nccrState.previewRegion=this.value;nccrRefresh()">' + regionSelect + '</select></div>' +
      '<div class="filter-actions"><span class="nccr-hint" style="align-self:center">参考线：MV% ≥ 66%；DCO% &lt; 15%；M/I 约 0.60～0.80</span></div>' +
      '</div>' +
      summaryKpis + metricKpis +
      '<div style="font-size:15px;font-weight:600;margin:16px 0 10px;color:#1f2937">分登记处对比</div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>登记处</th><th>发病数</th><th>肿瘤死亡</th><th>MV%</th><th>DCO%</th><th>M/I</th><th>UB%</th><th>O&U%</th><th>人口</th><th>结论</th><th class="sticky-col">操作</th>' +
      '</tr></thead><tbody>' + tableRows + '</tbody></table></div>' +
      '</div></div>';
  }

  function renderRecords() {
    var list = filteredRecords();
    var f = nccrState.recordFilters;
    var receiptMap = { accepted: '全部受理', partial: '部分成功', rejected: '退回' };
    var rows = list.map(function (b) {
      var ops = ['<button class="btn btn-ghost btn-xs" onclick="nccrOpenDetail(\'' + b.id + '\')">详情</button>'];
      if (b.fileName || b.status === '已投递' || b.status === '已回执归档') ops.push('<button class="btn btn-ghost btn-xs" onclick="nccrDownload(\'' + b.id + '\')">下载</button>');
      if (b.status === '已投递') ops.push('<button class="btn btn-primary btn-xs" onclick="nccrReceipt(\'' + b.id + '\')">登记回执</button>');
      if (b.status === '已退回') ops.push('<button class="btn btn-outline btn-xs" onclick="nccrClone(\'' + b.id + '\')">以此新建</button>');
      return '<tr>' +
        '<td><a href="javascript:void(0)" style="color:var(--primary)" onclick="nccrOpenDetail(\'' + b.id + '\')">' + e(b.id) + '</a></td>' +
        '<td>' + b.year + '</td><td>' + e(b.registryName) + '</td><td>' + e(packageLabel(b.packages)) + '</td>' +
        '<td>' + (b.caseCount || '—') + '</td><td>' + e(transportLabel(b.transport)) + '</td><td>' + e(b.exportedAt || '—') + '</td>' +
        '<td>' + e(b.receiptNo || '—') + '</td>' +
        '<td>' + e(receiptMap[b.receiptStatus] || (b.status === '已投递' ? '待回执' : statusLabel(b.status))) + '</td>' +
        '<td>' + statusBadge(b.status) + '</td>' +
        '<td class="sticky-col">' + ops.join(' ') + '</td></tr>';
    }).join('') || '<tr><td colspan="11">' + emptyState('暂无历史上报。完成后的批次会出现在这里。', '<button class="btn btn-primary btn-sm" onclick="nccrNew()">+ 新建上报</button>') + '</td></tr>';

    return nccrToolbar(
      '<button class="btn btn-primary btn-sm" onclick="nccrNew()">+ 新建上报</button>'
    ) +
      '<div class="panel"><div class="panel-header">上报记录</div><div class="panel-body">' +
      '<div class="filter-toolbar">' +
      '<div class="form-group"><label>统计年</label><select onchange="nccrState.recordFilters.year=this.value;nccrRefresh()"><option value="">全部</option><option value="2024"' + (f.year === '2024' ? ' selected' : '') + '>2024</option><option value="2023"' + (f.year === '2023' ? ' selected' : '') + '>2023</option></select></div>' +
      '<div class="form-group"><label>回执结果</label><select onchange="nccrState.recordFilters.receipt=this.value;nccrRefresh()"><option value="">全部</option><option value="pending"' + (f.receipt === 'pending' ? ' selected' : '') + '>待回执</option><option value="accepted"' + (f.receipt === 'accepted' ? ' selected' : '') + '>全部受理</option><option value="partial"' + (f.receipt === 'partial' ? ' selected' : '') + '>部分成功</option><option value="rejected"' + (f.receipt === 'rejected' ? ' selected' : '') + '>退回</option></select></div>' +
      '<div class="form-group search-group"><label>搜索</label><input placeholder="编号 / 回执号 / 登记处" value="' + e(f.keyword) + '" onkeydown="if(event.key===\'Enter\'){nccrState.recordFilters.keyword=this.value;nccrRefresh()}"></div>' +
      '<div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="nccrState.recordFilters.keyword=document.querySelector(\'#pageContainer .search-group input\').value;nccrRefresh()">查询</button><button class="btn btn-ghost btn-sm" onclick="nccrState.recordFilters={year:\'\',receipt:\'\',keyword:\'\'};nccrRefresh()">重置</button></div>' +
      '</div>' +
      '<div class="nccr-count">共 ' + list.length + ' 条</div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>上报编号</th><th>年份</th><th>登记处</th><th>上报内容</th><th>病例数</th><th>方式</th><th>上报时间</th><th>回执号</th><th>受理结果</th><th>进度</th><th class="sticky-col">操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '</div></div>';
  }

  function renderForm() {
    var form = nccrState.form;
    var pkgMeta = [
      { code: 'A', title: '报告卡个案', desc: '从已核对/已锁定的肿瘤报告卡导出发病明细' },
      { code: 'B', title: '随访死亡', desc: '报告卡对应的随访结局与死因' },
      { code: 'C', title: '人口数据', desc: '分年龄组人口（国家要求 19 组×性别）' },
      { code: 'D', title: '质量报告', desc: '整包 MV%、DCO%、M/I 等汇总，不是个案' }
    ];
    var pkgCards = pkgMeta.map(function (p) {
      var checked = form.packages.indexOf(p.code) >= 0 ? ' checked' : '';
      return '<label class="nccr-pkg-card' + (checked ? ' checked' : '') + '" data-code="' + p.code + '">' +
        '<span class="ttl"><input type="checkbox" class="nccr-pkg" value="' + p.code + '"' + checked + ' style="margin:0" onchange="this.closest(\'.nccr-pkg-card\').classList.toggle(\'checked\', this.checked)">' + p.title + '</span>' +
        '<div class="desc">' + p.desc + '</div></label>';
    }).join('');
    return nccrToolbar(
      '<button class="btn btn-ghost btn-sm" onclick="nccrBackList()">← 返回列表</button>'
    ) +
      '<div class="panel"><div class="panel-header">新建上报</div><div class="panel-body">' +
      '<div class="nccr-section"><div class="nccr-section-title">① 选择范围</div>' +
      '<div class="nccr-grid-2">' +
      '<div class="form-group"><label>统计年度 <span class="required">*</span></label><select id="nccrYear"><option' + (form.year === '2024' ? ' selected' : '') + '>2024</option><option' + (form.year === '2023' ? ' selected' : '') + '>2023</option><option' + (form.year === '2025' ? ' selected' : '') + '>2025</option></select></div>' +
      '<div class="form-group"><label>登记处 <span class="required">*</span></label><select id="nccrRegistry">' +
      // 上报单位 = 肿瘤登记处（population-based registry）；全省汇总(360000001)仅作预览聚合，不作为可组批上报的登记处
      Object.keys(REGISTRY_NAMES).filter(function (k) { return k !== '360000001'; }).map(function (k) { return '<option value="' + k + '"' + (form.registry === k ? ' selected' : '') + '>' + REGISTRY_NAMES[k] + '</option>'; }).join('') +
      '</select><div class="nccr-hint">上报单位是以人群为基础的「肿瘤登记处」，由省级中心统一向国家平台投递。全省汇总仅用于预览。</div></div>' +
      '</div></div>' +
      '<div class="nccr-section"><div class="nccr-section-title">② 选择上报内容</div>' +
      '<div class="nccr-pkg-grid">' + pkgCards + '</div>' +
      '<div class="nccr-inline-error" id="nccrPkgErr"></div>' +
      '<div class="nccr-hint">勾选「人口数据（C）」时，系统将在质控阶段校验 19 年龄组 × 性别是否齐全，缺失将阻断上报。</div></div>' +
      '<div class="nccr-section"><div class="nccr-section-title">③ 确认与提交</div>' +
      '<div class="nccr-grid-2">' +
      '<div class="form-group"><label>怎么报</label><select id="nccrTransport">' +
      '<option value="file"' + (form.transport === 'file' ? ' selected' : '') + '>下载文件，再手工导入国家平台</option>' +
      '<option value="http"' + (form.transport === 'http' ? ' selected' : '') + '>系统在线推送到国家平台</option>' +
      '<option value="sftp"' + (form.transport === 'sftp' ? ' selected' : '') + '>上传到指定文件服务器</option>' +
      '</select><div class="nccr-hint">日常优先用「下载文件」；接口开通后再用在线推送。</div></div>' +
      '<div class="form-group"><label>模板版本</label><input value="' + TEMPLATE_VERSION + '" disabled><div class="nccr-hint">国家正式模板下发后会替换。</div></div>' +
      '<div class="form-group nccr-span-2"><label>备注</label><textarea id="nccrRemark" rows="2" placeholder="可选">' + e(form.remark || '') + '</textarea></div>' +
      '</div></div>' +
      '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn btn-ghost btn-sm" onclick="nccrBackList()">取消</button>' +
      '<button class="btn btn-outline btn-sm" onclick="nccrSaveDraft(false)">先保存</button>' +
      '<button class="btn btn-primary btn-sm" onclick="nccrSaveDraft(true)">保存并检查质量</button>' +
      '</div></div></div>';
  }

  function casePreviewRows(batch) {
    var a = sampleARows(batch), b = sampleBRows(batch);
    return a.map(function (row, i) {
      var follow = b[i] || [];
      return {
        cardId: row[2], name: row[3], sex: row[6] === '1' ? '男' : '女', age: row[8],
        idNo: row[5], site: row[22], morph: row[23], icd10: row[30], diagDate: row[29],
        basis: row[27], dco: row[28] === '1' ? '是' : '否', hospital: row[38],
        followState: follow[4] === '3' ? '死亡' : follow[4] === '1' ? '存活' : '—', deathDate: follow[9] || '—'
      };
    });
  }

  function maskName(n) { return n ? n.charAt(0) + '*' : '—'; }
  function maskId(id) { return id && id.length >= 8 ? id.slice(0, 3) + '***********' + id.slice(-4) : (id || '—'); }

  function renderCasePreview(b, showPlain) {
    if ((b.packages || []).indexOf('A') < 0) {
      return '<p class="nccr-hint">本批未勾选「报告卡个案」，因此没有发病明细。可在新建时勾选，或到「报告卡管理 → 报告卡列表」查看全部卡片。</p>' +
        '<button class="btn btn-outline btn-sm" onclick="navigateTo(\'datamgmt-card\')">打开报告卡列表</button>';
    }
    var cases = casePreviewRows(b);
    var more = Math.max(0, (b.caseCount || cases.length) - cases.length);
    var rows = cases.map(function (c) {
      var name = showPlain ? c.name : maskName(c.name);
      var idno = showPlain ? c.idNo : maskId(c.idNo);
      return '<tr>' +
        '<td><a href="javascript:void(0)" style="color:var(--primary)" onclick="nccrOpenCard(\'' + e(c.cardId) + '\')">' + e(c.cardId) + '</a></td>' +
        '<td>' + e(name) + '</td><td>' + e(c.sex) + '</td><td>' + e(c.age) + '</td>' +
        '<td>' + e(idno) + '</td><td>' + e(c.icd10) + '</td><td>' + e(c.site) + '</td><td>' + e(c.morph) + '</td>' +
        '<td>' + e(c.diagDate) + '</td><td>' + e(c.dco) + '</td><td>' + e(c.followState) + '</td><td>' + e(c.hospital) + '</td>' +
        '</tr>';
    }).join('');
    var plainBtn = showPlain
      ? '<button class="btn btn-ghost btn-sm" onclick="nccrTogglePlain(false)">隐藏明文</button>'
      : '<button class="btn btn-outline btn-sm" onclick="nccrTogglePlain(true)">显示明文（授权）</button>';
    return '<p style="margin:0 0 10px;font-size:13px;color:#475467;line-height:1.6">下面是本批将报给国家的<strong>报告卡个案</strong>（原型先展示样例 ' + cases.length + ' 条' +
      (more ? '，本批合计约 ' + b.caseCount + ' 条' : '') + '）。姓名与证件号默认脱敏，导出需授权。</p>' +
      '<div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-outline btn-sm" onclick="navigateTo(\'datamgmt-card\')">打开报告卡列表</button>' +
      plainBtn +
      ((b.packages || []).indexOf('A') >= 0 ? '<button class="btn btn-ghost btn-sm" onclick="nccrDownload(\'' + b.id + '\')">下载本批个案 CSV</button>' : '') +
      '</div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>省内报告卡编号</th><th>姓名</th><th>性别</th><th>年龄</th><th>证件号</th><th>ICD-10</th><th>部位</th><th>形态学</th><th>确诊日期</th><th>DCO</th><th>随访</th><th>诊断单位</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderDetailTabs(active) {
    var tabs = [{ id: 'cases', label: '本批个案' }, { id: 'quality', label: '质量指标' }, { id: 'issues', label: '问题清单' }];
    return '<div class="report-data-tabs" role="tablist">' + tabs.map(function (t) {
      return '<button type="button" class="report-data-tab' + (active === t.id ? ' active' : '') + '" onclick="nccrDetailTab(\'' + t.id + '\')">' + t.label + '</button>';
    }).join('') + '</div>';
  }

  function renderDetailIssues(b) {
    var ic = b.individualCheck;
    var icHtml = ic ? (
      '<div class="nccr-section"><div class="nccr-section-title">个案门禁预检（M4）</div>' +
      '<div class="nccr-hint" style="margin-bottom:8px">已锁定卡片 ' + ic.total + ' 张，未通过 ' + ic.fail + ' 张' +
      (ic.fail ? '，<span class="nccr-tone-bad">须整改后方可投递</span>' : '，<span class="nccr-tone-ok">全部通过</span>') + '</div>' +
      (ic.fail ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>报告卡</th><th>规则</th><th>说明</th></tr></thead><tbody>' +
        ic.failList.map(function (x) { return '<tr><td>' + e(x.cardId) + '</td><td>' + e(x.ruleId) + '</td><td>' + e(x.message) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '')
    ) : '<div class="nccr-hint">尚未运行质量检查。</div>';

    var pc = b.popCheck;
    var pcHtml = pc ? (
      '<div class="nccr-section"><div class="nccr-section-title">人口分母校验（M5）</div>' +
      (pc.skipped ? '<div class="nccr-hint">本批未勾选人口包（C），跳过校验。</div>'
        : (pc.complete ? '<div class="nccr-tone-ok">19 年龄组 × 性别 人口齐全。</div>'
          : '<div class="nccr-tone-bad">人口缺失：' + pc.missingGroups.join('、') + '，不能上报。</div>'))
    ) : '<div class="nccr-hint">尚未运行质量检查。</div>';

    var errRows = (b.caseErrors || []).map(function (x) {
      return '<tr><td>' + e(x.ruleId) + '</td><td>' + e(x.sourceId) + '</td><td>' + e(x.message) + '</td></tr>';
    }).join('') || '<tr><td colspan="3" style="text-align:center;color:#64748b">暂无问题</td></tr>';

    return icHtml + pcHtml +
      '<div class="nccr-section"><div class="nccr-section-title">年包门禁问题（M7）</div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>规则</th><th>报告卡</th><th>说明</th></tr></thead><tbody>' + errRows + '</tbody></table></div></div>';
  }

  function renderDetail() {
    var b = nccrData.getBatch(nccrState.selectedId);
    if (!b) return renderList();
    var m = b.metrics, tab = nccrState.detailTab || 'cases';
    var receiptMap = { accepted: '全部受理', partial: '部分成功', rejected: '已退回' };

    var meta =
      '<div class="nccr-detail-meta">' +
      '<div><span class="k">编号</span> <span class="v">' + e(b.id) + '</span></div>' +
      '<div><span class="k">登记处</span> <span class="v">' + e(b.registryName) + '</span></div>' +
      '<div><span class="k">统计年</span> <span class="v">' + b.year + '</span></div>' +
      '<div><span class="k">上报内容</span> <span class="v">' + e(packageLabel(b.packages)) + '</span></div>' +
      '<div><span class="k">质量结论</span> <span class="v">' + gateBadge(b.gate) + '</span></div>' +
      '<div><span class="k">进度</span> <span class="v">' + statusBadge(b.status) + (b.frozen ? '<span class="nccr-frozen-tag">● 已冻结</span>' : '') + '</span></div>' +
      (b.revisionOf ? '<div><span class="k">修订自</span> <span class="v">' + e(b.revisionOf) + '</span></div>' : '') +
      '</div>';

    var actions = '<button class="btn btn-ghost btn-sm" onclick="nccrBackList()">← 返回</button>';
    if ((b.status === '草稿' || b.status === '待投递')) actions += ' <button class="btn btn-outline btn-sm" onclick="nccrRunGate(\'' + b.id + '\')">质控</button>';
    if (b.status === '待投递' && b.gate === 'warn' && !b.forcePassBy) actions += ' <button class="btn btn-warning btn-sm" onclick="nccrForcePass(\'' + b.id + '\')">确认风险</button>';
    if (canDeliver(b) && b.status === '待投递') actions += ' <button class="btn btn-primary btn-sm" onclick="nccrDeliver(\'' + b.id + '\')">上报</button>';
    if (b.status === '已投递') actions += ' <button class="btn btn-primary btn-sm" onclick="nccrReceipt(\'' + b.id + '\')">登记回执</button>';
    if ((b.fileName || b.status === '已投递' || b.status === '已回执归档')) actions += ' <button class="btn btn-outline btn-sm" onclick="nccrDownload(\'' + b.id + '\')">下载</button>';
    if (b.status === '草稿') actions += ' <button class="btn btn-danger btn-sm" onclick="nccrVoid(\'' + b.id + '\')">取消</button>';
    if ((b.status === '已回执归档' || b.status === '已退回' || b.status === '已投递')) actions += ' <button class="btn btn-outline btn-sm" onclick="nccrClone(\'' + b.id + '\')">以此新建</button>';

    var qualityBlock =
      '<div class="analysis-kpi-row">' +
      kpi('病理确诊率 MV%', m.mv.toFixed(1) + '%', m.mv >= 66 ? 'ok' : m.mv >= 60 ? 'warn' : 'bad') +
      kpi('仅死亡补发 DCO%', m.dco.toFixed(1) + '%', m.dco <= 15 ? 'ok' : 'bad') +
      kpi('死亡/发病比 M/I', m.mi.toFixed(2), m.mi >= 0.6 && m.mi <= 0.8 ? 'ok' : 'warn') +
      kpi('诊断依据不明 UB%', m.ub.toFixed(1) + '%', m.ub < 5 ? 'ok' : 'bad') +
      kpi('部位与形态不明 O&U%', m.ou.toFixed(1) + '%', m.ou < 1 ? 'ok' : m.ou <= 3 ? 'warn' : 'bad') +
      '</div>' +
      '<p class="nccr-hint">参考线：MV% ≥ 66%；DCO% &lt; 15%；M/I 约在 0.60～0.80。</p>' +
      (b.fileName ? '<div style="font-size:13px;margin-top:8px">已生成文件：' + e(b.fileName) + '</div>' : '') +
      (b.remoteRef ? '<div style="font-size:13px;margin-top:4px">推送单号：' + e(b.remoteRef) + '</div>' : '') +
      (b.receiptNo ? '<div style="font-size:13px;margin-top:4px">国家回执：' + e(b.receiptNo) + ' · ' + e(receiptMap[b.receiptStatus] || b.receiptStatus) + ' — ' + e(b.receiptRemark) + '</div>' : '') +
      (b.frozen ? '<div style="font-size:13px;margin-top:4px;color:#b42318">● 批次已冻结（已投递），内容不可改写</div>' : '');

    var tabBody = tab === 'quality' ? qualityBlock : tab === 'issues' ? renderDetailIssues(b) : renderCasePreview(b, nccrState.detailShowPlain);

    return nccrToolbar(actions) +
      '<div class="panel"><div class="panel-header">上报详情</div><div class="panel-body">' +
      meta + renderDetailTabs(tab) + tabBody +
      '</div></div>';
  }

  function renderPageContent() {
    if (nccrState.page === 'nccr-preview') return renderPreview();
    if (nccrState.page === 'nccr-records') { if (nccrState.view === 'detail') return renderDetail(); return renderRecords(); }
    if (nccrState.view === 'form') return renderForm();
    if (nccrState.view === 'detail') return renderDetail();
    return renderList();
  }

  /* ===================== 11. 交互动作 ===================== */
  window.renderNationalReportPage = renderPageContent;
  window.nccrRefresh = nccrRefresh;


  window.nccrGoListForRegistry = function (code, year) {
    nccrState.filters.year = String(year || '');
    nccrState.previewYear = String(year || nccrState.previewYear || '2024');
    nccrState.form.registry = code;
    nccrState.form.year = String(year || nccrState.form.year || '2024');
    navigateTo('nccr-list');
    nccrNew();
    toast('已带入登记处与年份，请确认后保存');
  };
  window.nccrBackList = function () {
    var p = nccrState.fromPage || 'nccr-list';
    nccrState.view = 'list'; nccrState.selectedId = null; navigateTo(p);
  };
  window.nccrNew = function () {
    nccrState.page = 'nccr-list'; nccrState.view = 'form';
    nccrState.form = {
      year: nccrState.filters.year || nccrState.previewYear || '2024',
      registry: nccrState.form.registry || nccrState.previewRegion || '360100001',
      packages: ['A', 'B', 'C', 'D'], transport: 'file', remark: ''
    };
    nccrRefresh();
  };
  window.nccrOpenDetail = function (id) {
    nccrState.fromPage = nccrState.page || 'nccr-list';
    var b = nccrData.getBatch(id);
    if (b && isRecordBatch(b) && !isWorkBatch(b)) nccrState.page = 'nccr-records';
    else if (b && isWorkBatch(b)) nccrState.page = 'nccr-list';
    nccrState.view = 'detail'; nccrState.selectedId = id; nccrState.detailTab = 'cases'; nccrState.detailShowPlain = false;
    nccrRefresh();
  };
  window.nccrDetailTab = function (tab) { nccrState.detailTab = tab; nccrRefresh(); };
  window.nccrTogglePlain = function (on) { nccrState.detailShowPlain = on; if (on) { showConfirm('授权查看明文', '报告卡含个人敏感信息，将临时展示姓名与证件号明文，仅限授权用途。', function () { nccrRefresh(); }); } else { nccrRefresh(); } };

  // 打开单张报告卡详情，复用平台已有的 cardListDetail 组件
  window.nccrOpenCard = function (cardId) {
    var b = nccrData.getBatch(nccrState.selectedId);
    if (!b) { toast('未找到对应批次', 'error'); return; }
    var aRows = sampleARows(b);
    var bRows = sampleBRows(b);
    var row = aRows.filter(function (r) { return r[2] === cardId; })[0];
    if (!row) { toast('演示数据中未包含该卡片明细', 'error'); return; }

    // 复用平台报告卡详情组件：把本批 A/B 包样例数据转换成 reportCardListData / reportCardFollowup
    var followMap = {};
    var cards = aRows.map(function (r, i) {
      var follow = bRows[i] || [];
      var id = r[2];
      followMap[id] = {
        dlc: follow[3] || '',
        state: follow[4] || '',
        surmonth: follow[5] || '',
        deadplace: follow[6] || '',
        caus: follow[7] || '',
        causicd: follow[8] || '',
        deathda: follow[9] || '',
        deadDoct: follow[10] || ''
      };
      return {
        id: id,
        name: r[3],
        otherIdType: r[4] || '',
        otherIdNo: '',
        idNo: r[5],
        sex: r[6] === '1' ? '男' : '女',
        birth: r[7],
        age: r[8],
        phone: r[13] || '',
        contactRelation: r[14] || '',
        contactName: r[15] || '',
        contactPhone: r[16] || '',
        nation: r[9] || '',
        marriage: r[10] || '',
        job: r[11] || '',
        workUnit: r[12] || '',
        household: (r[17] || '') + (r[18] || ''),
        householdDetail: r[18] || '',
        residence: (r[19] || '') + (r[20] || ''),
        residenceDetail: r[20] || '',
        site: r[22] || '',
        pathology: r[36] || r[35] || '',
        icd10: r[30] || '',
        topoCode: r[22] || '',
        morphCode: r[23] || '',
        diagnosisDate: r[29] || '',
        reportDate: r[42] || '',
        reportUnit: r[38] || '',
        doctor: r[41] || '',
        outpatientNo: r[39] || '',
        inpatientNo: r[40] || '',
        region: r[17] || '',
        cardType: '肿瘤报告卡',
        recordType: '发病'
      };
    });

    window.reportCardListData = cards;
    window.reportCardFollowup = followMap;

    if (typeof cardListDetail === 'function') {
      cardListDetail(cardId);
    } else {
      toast('报告卡详情组件未加载', 'error');
    }
  };

  window.nccrSaveDraft = function (runGate) {
    var year = document.getElementById('nccrYear').value;
    var registry = document.getElementById('nccrRegistry').value;
    var transport = document.getElementById('nccrTransport').value;
    var remark = (document.getElementById('nccrRemark').value || '').trim();
    var pkgs = Array.from(document.querySelectorAll('.nccr-pkg:checked')).map(function (x) { return x.value; });
    var errEl = document.getElementById('nccrPkgErr');
    if (!pkgs.length) { if (errEl) errEl.textContent = '请至少勾选一项上报内容'; toast('请至少勾选一项上报内容', 'error'); return; }
    if (errEl) errEl.textContent = '';
    var seq = nccrData.nextSeq(year);
    var id = 'NCCR-JX-' + year + '-' + seq;
    var metrics = demoMetricsFor(registry);
    var batch = {
      id: id, year: Number(year), registry: registry, registryName: REGISTRY_NAMES[registry] || registry,
      packages: pkgs, templateVersion: TEMPLATE_VERSION, transport: transport,
      status: '草稿', gate: '', caseCount: metrics.incidence, metrics: metrics,
      caseErrors: [], fileName: '', fileHash: '', remoteRef: '', receiptNo: '', receiptStatus: '', receiptRemark: '',
      createdBy: '省级上报岗', createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      exportedAt: '', remark: remark, forcePassBy: '', forcePassReason: '', forcePassAt: '',
      frozen: false, individualCheck: null, popCheck: null, receiptAt: '', deliver: null
    };
    nccrData.upsert(batch);
    toast('已创建 ' + id);
    if (runGate) { nccrState.selectedId = id; window.nccrRunGate(id); }
    else { nccrState.view = 'detail'; nccrState.selectedId = id; nccrRefresh(); }
  };

  window.nccrRunGate = function (id) {
    var b = nccrData.getBatch(id);
    if (!b) return;
    if (b.frozen) { toast('批次已冻结，不可再检查', 'error'); return; }
    b.status = '门禁中'; nccrRefresh();
    nccrSetLoading(true, '质量检查中…');
    setTimeout(function () {
      b.individualCheck = runIndividualCheck(b);
      b.popCheck = checkPopulation(b);
      var g = computeGate(b.metrics);
      var level = g.level, reasons = g.reasons.slice();
      if (b.popCheck && b.popCheck.complete === false) { level = 'block'; reasons.push('人口分母缺失：' + b.popCheck.missingGroups.join('、')); }
      b.gate = level;
      b.caseErrors = reasons.map(function (msg, i) { return { sourceId: '—', ruleId: 'Q-' + (i + 1), message: msg }; });
      if (b.registry === '360700001' && !b.caseErrors.some(function (x) { return x.sourceId !== '—'; })) {
        b.caseErrors = b.caseErrors.concat([
          { sourceId: 'JX-2024-000188', ruleId: 'G-C04', message: '形态学编码缺失' },
          { sourceId: 'JX-2024-000201', ruleId: 'G-C07', message: 'DCO 缺死亡日期' }
        ]);
      }
      b.status = level === 'block' ? '门禁未过·待整改' : '待投递';
      nccrSetLoading(false);
      nccrState.view = 'detail'; nccrState.selectedId = id;
      var msg = level === 'pass' ? '质量达标，可以上报' : level === 'warn' ? '存在风险，需确认后才能上报' : '质量未达标（含个案/分母问题），不能上报';
      toast(msg, level === 'pass' ? '' : 'error');
      nccrRefresh();
    }, 700);
  };

  // M8 强制放行：模态填原因（替代 window.prompt）
  window.nccrForcePass = function (id) {
    var b = nccrData.getBatch(id);
    if (!b || b.gate !== 'warn') return;
    if (b.frozen) { toast('批次已冻结，不可操作', 'error'); return; }
    var overlay = document.createElement('div');
    overlay.className = 'cd-overlay nccr-modal'; overlay.style.zIndex = '10000';
    overlay.innerHTML = '<div class="cd-dialog" style="max-width:520px"><div class="cd-header"><span>确认风险并放行</span><span class="cd-close" onclick="this.closest(\'.cd-overlay\').remove()">×</span></div>' +
      '<div class="cd-body"><p style="margin:0 0 12px;font-size:13px;color:#475467">当前质量未完全达标（例如 MV% 未达 66%）。继续上报需填写原因并留痕，仅省级上报岗可操作。</p>' +
      '<div class="form-group"><label>放行原因 <span class="required">*</span></label><textarea id="nccrFpReason" rows="3" placeholder="如：已完成补核，同意带风险上报"></textarea></div>' +
      '<div class="cd-field-error" id="nccrFpErr">请填写放行原因</div></div>' +
      '<div class="cd-header" style="border-top:1px solid #e2e8f0;border-bottom:0;justify-content:flex-end;gap:8px">' +
      '<button class="btn btn-ghost btn-sm" onclick="this.closest(\'.cd-overlay\').remove()">取消</button>' +
      '<button class="btn btn-warning btn-sm" id="nccrFpSave">确认放行</button></div></div>';
    document.body.appendChild(overlay);
    document.getElementById('nccrFpSave').onclick = function () {
      var reason = document.getElementById('nccrFpReason').value.trim();
      var err = document.getElementById('nccrFpErr');
      if (!reason) { err.style.display = 'block'; return; }
      b.forcePassBy = '省级上报岗';
      b.forcePassReason = reason;
      b.forcePassAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
      b.status = '待投递';
      overlay.remove();
      toast('已确认，可以继续上报');
      nccrRefresh();
    };
  };

  window.nccrDeliver = function (id) {
    var b = nccrData.getBatch(id);
    if (!b) return;
    if (b.frozen) { toast('批次已冻结，不可重复投递', 'error'); return; }
    if (b.gate === 'block') { toast('质量未达标，不能上报', 'error'); return; }
    if (b.individualCheck && b.individualCheck.fail > 0) { toast('存在 ' + b.individualCheck.fail + ' 条未通过个案门禁，请先整改后再投递', 'error'); return; }
    if (b.popCheck && b.popCheck.complete === false) { toast('人口分母缺失，不能上报：' + b.popCheck.missingGroups.join('、'), 'error'); return; }
    if (b.gate === 'warn' && !b.forcePassBy) { toast('请先确认风险', 'error'); return; }
    showConfirm('确认上报', '将生成「' + packageLabel(b.packages) + '」文件（模板 ' + b.templateVersion + '），方式：' + transportLabel(b.transport) + '。<br>病例明细含个人信息，仅限授权用途，请确认。', function () {
      window.nccrDownload(id);
      var ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14);
      b.fileName = '41_' + b.registry + '_' + b.year + '_' + b.packages.join('') + '_' + b.templateVersion + '_' + ts + '.csv';
      b.fileHash = hashStub(b.fileName + b.id);
      b.exportedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
      b.deliver = { channel: b.transport, at: b.exportedAt, by: '省级上报岗' };
      if (b.transport === 'http') { b.remoteRef = 'REMOTE-' + ts; toast('已模拟在线推送，单号 ' + b.remoteRef + '。下一步：登记回执'); }
      else if (b.transport === 'sftp') { b.remoteRef = 'SFTP-' + ts; toast('已模拟上传到文件服务器。下一步：登记回执'); }
      else { toast('文件已下载，请登录国家平台手工导入。下一步：登记回执'); }
      b.status = '已投递'; b.frozen = true;
      nccrState.view = 'detail'; nccrState.selectedId = id;
      nccrRefresh();
    });
  };

  window.nccrDownload = function (id) {
    var b = nccrData.getBatch(id);
    if (!b) return;
    if ((b.packages || []).indexOf('A') >= 0) downloadCsv('A_发病个案_' + b.id + '.csv', A_HEADERS, sampleARows(b));
    if ((b.packages || []).indexOf('B') >= 0) setTimeout(function () { downloadCsv('B_死亡随访_' + b.id + '.csv', B_HEADERS, sampleBRows(b)); }, 200);
    if ((b.packages || []).indexOf('C') >= 0) setTimeout(function () { downloadCsv('C_人口_' + b.id + '.csv', C_HEADERS, sampleCRows(b)); }, 400);
    if ((b.packages || []).indexOf('D') >= 0) setTimeout(function () { downloadCsv('D_质控摘要_' + b.id + '.csv', D_HEADERS, sampleDRows(b)); }, 600);
  };

  window.nccrDownloadTemplate = function () {
    downloadCsv('A_发病个案_NCCR-2024-v1.csv', A_HEADERS, sampleARows({ registry: '360100001', year: 2024 }));
    setTimeout(function () {
      downloadCsv('字段说明_NCCR-2024-v1.csv', ['上报内容', '中文列名', '说明'], A_HEADERS.map(function (h) { return ['报告卡个案', h, '见 docs/templates/nccr']; }));
    }, 250);
    toast('已下载空白模板（报告卡个案 + 字段说明）');
  };

  // M10/M11 回执登记
  window.nccrReceipt = function (id) {
    var b = nccrData.getBatch(id);
    if (!b) return;
    var overlay = document.createElement('div');
    overlay.className = 'cd-overlay nccr-modal'; overlay.style.zIndex = '10000';
    overlay.innerHTML = '<div class="cd-dialog" style="max-width:520px"><div class="cd-header"><span>登记国家回执</span><span class="cd-close" onclick="this.closest(\'.cd-overlay\').remove()">×</span></div>' +
      '<div class="cd-body"><p style="margin:0 0 12px;font-size:13px;color:#475467">把国家平台返回的受理结果记在这里，方便以后查。</p><div class="form-grid">' +
      '<div class="form-group"><label>回执号 <span class="required">*</span></label><input id="nccrReceiptNo" value="' + e(b.remoteRef || ('NCCR-R-' + Date.now().toString().slice(-8))) + '"></div>' +
      '<div class="form-group"><label>受理结果</label><select id="nccrReceiptStatus"><option value="accepted">全部受理</option><option value="partial">部分成功</option><option value="rejected">退回</option></select></div>' +
      '<div class="form-group full"><label>说明</label><textarea id="nccrReceiptRemark" rows="3">国家平台回执</textarea></div>' +
      '</div></div>' +
      '<div class="cd-header" style="border-top:1px solid #e2e8f0;border-bottom:0;justify-content:flex-end;gap:8px">' +
      '<button class="btn btn-ghost btn-sm" onclick="this.closest(\'.cd-overlay\').remove()">取消</button>' +
      '<button class="btn btn-primary btn-sm" id="nccrReceiptSave">保存</button></div></div>';
    document.body.appendChild(overlay);
    document.getElementById('nccrReceiptSave').onclick = function () {
      var no = document.getElementById('nccrReceiptNo').value.trim();
      var st = document.getElementById('nccrReceiptStatus').value;
      var rm = document.getElementById('nccrReceiptRemark').value.trim();
      if (!no) { toast('请填写回执号', 'error'); return; }
      b.receiptNo = no; b.receiptStatus = st; b.receiptRemark = rm;
      b.receiptAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
      b.status = st === 'rejected' ? '已退回' : '已回执归档';
      overlay.remove();
      if (b.status === '已回执归档') { toast('上报完成，已记入上报记录'); nccrState.fromPage = 'nccr-records'; }
      else { toast('已记为国家退回'); nccrState.fromPage = 'nccr-list'; }
      nccrState.view = 'list'; nccrState.selectedId = null; navigateTo(b.status === '已回执归档' ? 'nccr-records' : 'nccr-list');
    };
  };

  window.nccrVoid = function (id) {
    var b = nccrData.getBatch(id);
    if (b && b.frozen) { toast('批次已冻结，不可作废', 'error'); return; }
    showConfirm('取消上报', '确定取消 ' + id + ' 吗？', function () {
      var bb = nccrData.getBatch(id);
      if (bb) bb.status = '已作废';
      toast('已取消');
      nccrBackList();
    });
  };

  // M12 退回补报：复制为新批次
  window.nccrClone = function (id) {
    var src = nccrData.getBatch(id);
    if (!src) return;
    var seq = nccrData.nextSeq(src.year);
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = 'NCCR-JX-' + src.year + '-' + seq;
    copy.status = '草稿'; copy.gate = '';
    copy.fileName = ''; copy.fileHash = ''; copy.remoteRef = '';
    copy.receiptNo = ''; copy.receiptStatus = ''; copy.exportedAt = '';
    copy.forcePassBy = ''; copy.forcePassReason = ''; copy.frozen = false;
    copy.createdAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
    copy.createdBy = '省级上报岗';
    copy.remark = '复制自 ' + src.id;
    copy.revisionOf = src.id;
    copy.individualCheck = null; copy.popCheck = null; copy.receiptAt = ''; copy.deliver = null;
    nccrData.upsert(copy);
    toast('已复制为 ' + copy.id);
    nccrState.fromPage = 'nccr-list'; nccrState.page = 'nccr-list';
    nccrOpenDetail(copy.id);
  };

  /* ===================== 12. 系统配置 · 平台上报（M17） ===================== */
  window.renderNccrPlatformConfigTab = function () {
    var c = nccrConfig;
    return '<div class="nccr-grid-2" style="max-width:900px">' +
      '<div class="form-group"><label>默认模板版本</label><input id="nccrCfgTpl" value="' + e(c.templateVersion) + '"></div>' +
      '<div class="form-group"><label>时效提示（诊断年后月数）</label><input id="nccrCfgMonths" type="number" value="' + c.timelinessMonths + '"></div>' +
      '<div class="form-group"><label>默认怎么报</label><select id="nccrCfgTransport"><option value="file"' + (c.defaultTransport === 'file' ? ' selected' : '') + '>下载文件</option><option value="http"' + (c.defaultTransport === 'http' ? ' selected' : '') + '>在线推送</option><option value="sftp"' + (c.defaultTransport === 'sftp' ? ' selected' : '') + '>文件服务器</option></select></div>' +
      '<div class="form-group"><label>启用在线推送</label><select id="nccrCfgHttp"><option value="1"' + (c.httpEnabled ? ' selected' : '') + '>是</option><option value="0"' + (!c.httpEnabled ? ' selected' : '') + '>否</option></select></div>' +
      '<div class="form-group nccr-span-2"><label>国家平台接口地址</label><input id="nccrCfgUrl" value="' + e(c.httpBaseUrl) + '"></div>' +
      '<div class="form-group"><label>病理确诊率 MV% 达标线</label><input id="nccrCfgMv" type="number" value="' + c.thresholds.mvPass + '"></div>' +
      '<div class="form-group"><label>仅死亡补发 DCO% 上限</label><input id="nccrCfgDco" type="number" value="' + c.thresholds.dcoBlock + '"></div>' +
      '<div class="form-group"><label>死亡/发病比 M/I 下限</label><input id="nccrCfgMiL" type="number" step="0.01" value="' + c.thresholds.miPassLow + '"></div>' +
      '<div class="form-group"><label>死亡/发病比 M/I 上限</label><input id="nccrCfgMiH" type="number" step="0.01" value="' + c.thresholds.miPassHigh + '"></div>' +
      '</div>' +
      '<div style="margin-top:16px"><button class="btn btn-primary btn-sm" onclick="nccrSaveConfig()">保存</button> ' +
      '<button class="btn btn-outline btn-sm" onclick="nccrDownloadTemplate()">下载空白模板</button></div>' +
      '<p style="margin-top:12px;font-size:12px;color:#667085">空白模板在 docs/templates/nccr/。国家正式模板下发后替换即可。</p>';
  };

  window.nccrSaveConfig = function () {
    nccrConfig.templateVersion = document.getElementById('nccrCfgTpl').value.trim() || TEMPLATE_VERSION;
    nccrConfig.timelinessMonths = Number(document.getElementById('nccrCfgMonths').value) || 30;
    nccrConfig.defaultTransport = document.getElementById('nccrCfgTransport').value;
    nccrConfig.httpEnabled = document.getElementById('nccrCfgHttp').value === '1';
    nccrConfig.httpBaseUrl = document.getElementById('nccrCfgUrl').value.trim();
    nccrConfig.thresholds.mvPass = Number(document.getElementById('nccrCfgMv').value) || 66;
    nccrConfig.thresholds.dcoBlock = Number(document.getElementById('nccrCfgDco').value) || 15;
    nccrConfig.thresholds.miPassLow = Number(document.getElementById('nccrCfgMiL').value) || 0.6;
    nccrConfig.thresholds.miPassHigh = Number(document.getElementById('nccrCfgMiH').value) || 0.8;
    toast('平台上报配置已保存');
  };

  /* ===================== 13. 路由挂接 ===================== */
  function ensureNccrMenu() {
    if (typeof menuData === 'undefined') return;
    var has = menuData.some(function (m) { return m.id === 'nccr'; });
    if (!has) {
      var idx = menuData.findIndex(function (m) { return m.id === 'analysis'; });
      var item = {
        id: 'nccr', label: '国家肿瘤数据上报', icon: '●',
        children: [
          { id: 'nccr-preview', label: '数据预览' },
          { id: 'nccr-records', label: '上报记录' },
          { id: 'nccr-list', label: '上报列表' }
        ]
      };
      if (idx >= 0) menuData.splice(idx + 1, 0, item);
      else menuData.push(item);
    }
    menuData.forEach(function (m) {
      if (!m.children) return;
      m.children = m.children.filter(function (c) { return c.id !== 'data-report'; });
    });
  }
  ensureNccrMenu();
  if (document.getElementById('sidebarMenu') && document.getElementById('sidebarMenu').children.length) {
    var active = (document.querySelector('.menu-item.active') || {}).dataset;
    active = active && active.id;
    var sm = document.getElementById('sidebarMenu');
    sm.innerHTML = '';
    buildMenu(menuData, sm);
    if (active) setActiveMenu(active);
  }

  var baseNav = navigateTo;
  navigateTo = function (id) {
    if (id === 'data-report') id = 'nccr-list';
    if (id === 'nccr-preview' || id === 'nccr-records' || id === 'nccr-list') {
      nccrState.page = id; nccrState.view = 'list'; nccrState.selectedId = null;
    }
    baseNav(id);
  };

  var sysCfgTab = 'platform';
  window.nccrSysCfgTab = function (tab) { sysCfgTab = tab; renderPage('system-config'); };

  function renderSystemConfigPage() {
    var tabs = [{ id: 'platform', label: '平台上报' }, { id: 'general', label: '一般设置' }];
    var tabHtml = '<div class="report-data-tabs" role="tablist" style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:16px">' +
      tabs.map(function (t) {
        return '<button class="report-data-tab' + (sysCfgTab === t.id ? ' active' : '') + '" style="appearance:none;border:0;background:transparent;padding:11px 16px;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2px solid ' + (sysCfgTab === t.id ? 'var(--primary)' : 'transparent') + ';color:' + (sysCfgTab === t.id ? 'var(--primary)' : '#667085') + '" onclick="nccrSysCfgTab(\'' + t.id + '\')">' + t.label + '</button>';
      }).join('') + '</div>';
    var body = sysCfgTab === 'platform'
      ? renderNccrPlatformConfigTab()
      : '<div style="color:#667085;font-size:14px">一般系统参数仍由原系统配置维护。国家上报相关项请使用「平台上报」页签。</div>';
    return '<div class="panel"><div class="panel-body">' + tabHtml + body + '</div></div>';
  }

  var baseRender = renderPage;
  renderPage = function (id) {
    if (id === 'data-report') id = 'nccr-list';
    if (id === 'nccr-preview' || id === 'nccr-records' || id === 'nccr-list') {
      nccrState.page = id;
      document.getElementById('pageContainer').innerHTML = renderPageContent();
      setActiveMenu(id);
      if (typeof nccrExpandMenu === 'function') nccrExpandMenu(id);
      else { var mi = document.querySelector('.menu-item[data-id="' + id + '"]'); if (mi) { var p = mi.parentElement && mi.parentElement.parentElement; if (p && p.classList.contains('submenu')) { p.classList.add('open'); var h = p.previousElementSibling; if (h && h.classList.contains('menu-item')) h.classList.add('expanded'); } } }
      if (typeof updateBreadcrumb === 'function') {
        var extra = null;
        if (id === 'nccr-list' && nccrState.view === 'form') extra = '新建上报';
        if ((id === 'nccr-list' || id === 'nccr-records') && nccrState.view === 'detail') extra = '上报详情';
        updateBreadcrumb(id, extra);
      }
      if (typeof autoSizeSelects === 'function') autoSizeSelects();
      return;
    }
    if (id === 'system-config') {
      document.getElementById('pageContainer').innerHTML = renderSystemConfigPage();
      setActiveMenu('system-config');
      if (typeof updateBreadcrumb === 'function') updateBreadcrumb('system-config');
      if (typeof autoSizeSelects === 'function') autoSizeSelects();
      return;
    }
    baseRender(id);
  };

  window.nccrConfig = nccrConfig;
  window.nccrData = nccrData;
  window.nccrState = nccrState;
})();
