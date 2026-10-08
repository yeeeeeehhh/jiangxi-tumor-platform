/**
 * 国家肿瘤数据上报（省平台 → 国家癌症中心 NCCR）
 * 一级导航三板块：新增上报 nccr-new ／ 上报记录 nccr-records ／ 上报合规性 nccr-compliance
 *
 * 口径来源（本文件不存阈值副本）：
 *   质量阈值   → window.dictQuality（字典管理·群体质量指标，逐条带出处）
 *   登记处主数据 → window.CK.META（驾驶舱同源 11 设区市：MV/DCO/M-I/UB/病例上报率）
 *   应报例数   → window.DKH_DATA.cityRows（附表1 同源）
 *   覆盖率达标线 → window.DKH_DATA.qc.nccrMin
 * 批次台账 nccrData.batches 是本模块单一数据源，三个板块都由它派生：
 *   待上报 + 已上报 → 新增上报；已完成 + 已退回 + 已取消 → 上报记录（互斥，不重复出现）。
 * 台账内为【原型演示数据】，真实接入只换 ledger() 的取数实现，UI 不动。
 */
(function () {
  'use strict';

  /* ===================== 1. 样式 ===================== */
  var st = document.getElementById('nccrReportStyles');
  if (!st) { st = document.createElement('style'); st.id = 'nccrReportStyles'; document.head.appendChild(st); }
  st.textContent = [
    '.nccr-hint{font-size:12px;color:#667085;line-height:1.5}',
    '.nccr-count{margin-bottom:8px;color:#667085;font-size:13px}',
    '.nccr-row-ops{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}',
    '.nccr-section{margin-bottom:18px}',
    '.nccr-section-title{font-size:13px;font-weight:600;color:#1f2937;margin:0 0 10px}',
    '.nccr-pkg-grid{display:flex;flex-wrap:wrap;gap:10px}',
    '.nccr-pkg-card{border:1px solid var(--border);border-radius:8px;padding:10px 12px;min-width:210px;cursor:pointer;background:#fff;transition:border-color .15s,background .15s}',
    '.nccr-pkg-card:hover{border-color:#9db8dc}',
    '.nccr-pkg-card.checked{border-color:var(--primary);background:#f5f9ff}',
    '.nccr-pkg-card .ttl{font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px}',
    '.nccr-inline-error{color:#b42318;font-size:12px;margin-top:5px}',
    '.nccr-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.72);z-index:6;font-size:13px;color:#475467;border-radius:8px}',
    '.nccr-spinner{width:18px;height:18px;border:2px solid #cbd5e1;border-top-color:#185fa5;border-radius:50%;animation:nccrSpin .7s linear infinite;margin-right:8px}',
    '@keyframes nccrSpin{to{transform:rotate(360deg)}}',
    '.nccr-empty{text-align:center;color:#64748b;padding:36px 16px}',
    '.nccr-empty .btn{margin-top:12px}',
    '.nccr-grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
    '.nccr-span-2{grid-column:1/-1}',
    '.nccr-kpi{border:1px solid var(--border);border-radius:8px;padding:12px 14px;background:#fff}',
    '.nccr-kpi-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:14px}',
    '.nccr-kpi .l{font-size:12px;color:#667085}',
    '.nccr-kpi .v{font-size:22px;font-weight:700;margin-top:2px}',
    '.nccr-light{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:12px;font-weight:700;cursor:default}',
    '.nccr-light.ok{background:#e6f4ec;color:#027a48}',
    '.nccr-light.warn{background:#fdf3e2;color:#b54708}',
    '.nccr-light.bad{background:#fdeceb;color:#b42318}',
    '.nccr-light.na{background:#f1f5f9;color:#94a3b8}',
    '.nccr-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 18px;margin-bottom:14px;font-size:13px}',
    '.nccr-meta .k{color:#667085}.nccr-meta .v{color:#1f2937;font-weight:500}',
    '.nccr-tl{list-style:none;margin:0;padding:0;font-size:13px}',
    '.nccr-tl li{position:relative;padding:0 0 12px 18px;border-left:2px solid #e2e8f0}',
    '.nccr-tl li:last-child{border-left-color:transparent;padding-bottom:0}',
    '.nccr-tl li:before{content:"";position:absolute;left:-6px;top:3px;width:10px;height:10px;border-radius:50%;background:#cbd5e1}',
    '.nccr-tl .t{color:#667085;font-size:12px}',
    'details.nccr-fold{border:1px solid var(--border);border-radius:8px;margin-bottom:10px;background:#fff}',
    'details.nccr-fold>summary{padding:10px 12px;font-size:13px;font-weight:600;color:#1f2937;cursor:pointer;list-style:none}',
    'details.nccr-fold>summary::-webkit-details-marker{display:none}',
    'details.nccr-fold>summary:before{content:"\\25B8  ";color:#98a2b3}',
    'details.nccr-fold[open]>summary:before{content:"\\25BE  "}',
    'details.nccr-fold>.bd{padding:0 12px 12px}',
    '.nccr-pkg-list{display:flex;flex-direction:column;gap:16px}',
    '.nccr-pkg-block{border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#fff}',
    '.nccr-pkg-head{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8fafc;border-bottom:1px solid var(--border)}',
    '.nccr-pkg-tag{display:inline-block;min-width:26px;height:22px;line-height:22px;text-align:center;border-radius:4px;background:var(--primary);color:#fff;font-size:12px;font-weight:700}',
    '.nccr-pkg-title{font-size:13px;color:#1f2937;margin:0}',
    '.nccr-pkg-meta{font-size:12px;color:#64748b}',
    '.nccr-pkg-spacer{flex:1}',
    '.nccr-pkg-block .table-wrap{border-radius:0;border-top:0}',
    '.cd-field-error{color:#b42318;font-size:12px;margin-top:4px;display:none}'
  ].join('');

  /* ===================== 2. 工具 ===================== */
  var e = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtInt(n) { return String(n == null ? 0 : n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmtDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function toDate(s) { return new Date(String(s || '').replace(/-/g, '/').slice(0, 19)); }
  function nowStr() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
  function shiftDays(s, n) {
    if (!s) return '';
    var d = toDate(s); d.setDate(d.getDate() + n);
    return fmtDate(d) + String(s).slice(10);
  }
  function emptyState(text, actionHtml) {
    return '<div class="nccr-empty"><div style="font-size:14px">' + e(text) + '</div>' + (actionHtml || '') + '</div>';
  }
  function kpi(label, value, tone, tip) {
    var color = tone === 'ok' ? '#027a48' : tone === 'warn' ? '#b54708' : tone === 'bad' ? '#b42318' : '#475467';
    return '<div class="nccr-kpi"' + (tip ? ' title="' + e(tip) + '"' : '') + '><div class="l">' + e(label) + '</div><div class="v" style="color:' + color + '">' + value + '</div></div>';
  }

  /* ===================== 3. 配置（不含质量阈值） ===================== */
  var nccrConfig = {
    templateVersion: 'NCCR-2024-v1',
    nationalVersion: 'NCCR-2024-v1',
    defaultTransport: 'file',
    httpEnabled: true,
    httpBaseUrl: 'https://www.nccr.org.cn/api/v1',
    timelinessMonths: 30
  };

  var A_HEADERS = ['登记处编码', '国家登记流水号', '省内报告卡编号', '姓名', '证件类型', '证件号码', '性别', '出生日期', '实足年龄', '民族', '婚姻状况', '职业', '工作单位', '联系电话', '联系人关系', '联系人', '联系人电话', '户籍区划码', '户籍详细地址', '常住区划码', '常住详细地址', '城乡', '解剖学部位ICD-O-3', '形态学编码', '行为', '分级', '侧位', '诊断依据', 'DCO标志', '确诊日期', 'ICD10', 'TNM-T', 'TNM-N', 'TNM-M', '治疗方式', '诊断结果', '详细诊断', '诊断单位编码', '诊断单位名称', '门诊号', '住院号', '报告医师', '报告日期', '多原发序号', '检查状态', '更新日期', '重卡标记'];
  var B_HEADERS = ['登记处编码', '国家登记流水号', '省内报告卡编号', '最后接触日期', '最后接触状态', '生存月数', '死亡地点', '根本死因分类', '死因ICD10', '死亡日期', '死亡报告医师'];
  var C_HEADERS = ['登记处编码', '区划码', '年份', '性别', '年龄组代码', '年龄组名称', '人口数'];
  var D_HEADERS = ['登记处编码', '统计年', '发病数', '肿瘤死亡数', 'MV%', 'HV%', 'DCO%', 'UB%', 'O&U%', 'M/I', '质量结论'];
  var AGE19 = ['0岁', '1-4岁', '5-9岁', '10-14岁', '15-19岁', '20-24岁', '25-29岁', '30-34岁', '35-39岁', '40-44岁', '45-49岁', '50-54岁', '55-59岁', '60-64岁', '65-69岁', '70-74岁', '75-79岁', '80-84岁', '85岁及以上'];

  /* ===================== 4. 阈值判定（唯一来源：字典 QUALITY） ===================== */
  function dictItem(id) {
    var list = window.dictQuality || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function judgeMetric(id, val) {
    var q = dictItem(id);
    if (!q) return { tone: 'na', rule: id, name: id, text: '—', tip: id + ' 未在质量字典中定义' };
    if (!q.th || val == null) return { tone: 'na', rule: q.id, name: q.name, text: '待接入', tip: q.name + '：本站暂无同源数据，不参与判定' };
    var t = q.th, tone;
    if (t.dir === 'min') tone = val >= t.ok ? 'ok' : val >= t.block ? 'warn' : 'bad';
    else if (t.dir === 'max') tone = val <= t.ok ? 'ok' : val <= t.block ? 'warn' : 'bad';
    else tone = (val >= t.ok[0] && val <= t.ok[1]) ? 'ok' : (val >= t.block[0] && val <= t.block[1]) ? 'warn' : 'bad';
    var unit = id === 'Q-MI' ? '' : '%';
    return {
      tone: tone, rule: q.id, name: q.name, text: val + unit,
      tip: q.name + ' ' + val + unit + '\n目标 ' + q.target + '｜红线 ' + q.redline + '\n出处 ' + q.basis
    };
  }
  var TONE_RANK = { ok: 0, warn: 1, bad: 2 };
  function worst(tones) {
    var judged = (tones || []).filter(function (t) { return t !== 'na'; });
    if (!judged.length) return 'na';
    var w = 'ok';
    judged.forEach(function (t) { if (TONE_RANK[t] > TONE_RANK[w]) w = t; });
    return w;
  }
  function coverMin() {
    var d = window.DKH_DATA;
    return (d && d.qc && Number(d.qc.nccrMin)) || 98;
  }
  function deadline(year) {
    var d = new Date(Number(year), 11, 1);
    d.setMonth(d.getMonth() + Number(nccrConfig.timelinessMonths || 30) + 1);
    d.setDate(0);
    return d;
  }
  function light(d) {
    var glyph = { ok: '✓', warn: '!', bad: '✕', na: '–' }[d.tone] || '–';
    return '<span class="nccr-light ' + d.tone + '" title="' + e(d.text + '\n' + d.tip) + '">' + glyph + '</span>';
  }

  /* ===================== 5. 登记处主数据 ===================== */
  function registryList() {
    var meta = (window.CK && window.CK.META) || {};
    var rows = (window.DKH_DATA && window.DKH_DATA.cityRows) || [];
    var byCode = {};
    rows.forEach(function (r) { byCode[String(r['行政区划代码'])] = r; });
    return Object.keys(meta).sort().map(function (code) {
      var m = meta[code], r = byCode[code];
      var cases = r ? parseInt(String(r['新发例数']).replace(/[^0-9]/g, ''), 10) : Math.round(m.pop * 100 / 1e5 * m.crude * 100);
      return {
        code: code, name: m.f + '肿瘤登记处', short: m.f,
        cases: cases || 0, sent: Math.round((cases || 0) * (m.nccr || 0) / 100),
        mv: m.mv, dco: m.dco, mi: m.mi, ub: m.ub, cover: m.nccr
      };
    });
  }
  function registryByCode(code) {
    var list = registryList();
    for (var i = 0; i < list.length; i++) if (list[i].code === code) return list[i];
    return null;
  }

  /* ===================== 6. 五维合规判定 ===================== */
  function judgeCover(reg, batch) {
    var min = coverMin(), v = reg.cover;
    var d = {
      tone: v >= min ? 'ok' : v >= min - 3 ? 'warn' : 'bad',
      text: v.toFixed(1) + '%',
      tip: '病例上报率 ' + v.toFixed(1) + '%\n应报 ' + fmtInt(reg.cases) + ' 例，实报 ' + fmtInt(reg.sent) + ' 例\n达标线 ' + min + '%'
    };
    if (batch && batch.popGap && (batch.packages || []).indexOf('C') >= 0) {
      d.tone = 'bad';
      d.tip += '\n' + batch.popGap;
    }
    return d;
  }
  function judgeTimely(reg, batch) {
    var year = batch ? batch.year : Number(nccrState.year);
    var dl = deadline(year), ds = fmtDate(dl), overdue = new Date() > dl;
    if (!batch) return overdue
      ? { tone: 'bad', text: '超期未报', tip: '截止 ' + ds + ' 已过，尚未生成上报批次' }
      : { tone: 'warn', text: '待报送', tip: '尚未生成上报批次，截止 ' + ds };
    if (batch.revisionOf) return { tone: 'ok', text: '重报', tip: '由 ' + batch.revisionOf + ' 退回后重报，报送时效沿用原批次' };
    if (!batch.exportedAt) return overdue
      ? { tone: 'bad', text: '超期未投', tip: '截止 ' + ds + ' 已过，批次尚未投递' }
      : { tone: 'warn', text: '未投递', tip: '批次已生成未投递，截止 ' + ds };
    return toDate(batch.exportedAt) <= dl
      ? { tone: 'ok', text: '按期', tip: batch.exportedAt + ' 投递\n早于截止 ' + ds }
      : { tone: 'bad', text: '超期', tip: batch.exportedAt + ' 投递\n晚于截止 ' + ds };
  }
  function judgeQuality(reg) {
    var items = [
      judgeMetric('Q-MV', reg.mv), judgeMetric('Q-DCO', reg.dco),
      judgeMetric('Q-MI', reg.mi), judgeMetric('Q-BASIS', reg.ub),
      judgeMetric('Q-SITE', null)
    ];
    var tone = worst(items.map(function (x) { return x.tone; }));
    var hit = items.filter(function (x) { return x.tone === 'bad' || x.tone === 'warn'; });
    return {
      tone: tone, items: items,
      text: tone === 'na' ? '待接入' : tone === 'ok' ? '达标' : hit.length + ' 项未达',
      tip: items.map(function (x) { return x.name + '：' + x.text; }).join('\n')
    };
  }
  function judgeFormat(batch) {
    if (!batch) return { tone: 'na', text: '—', tip: '尚未生成上报批次' };
    if (batch.templateVersion !== nccrConfig.nationalVersion) {
      return { tone: 'bad', text: '模板过期', tip: '批次模板 ' + batch.templateVersion + '\n国家现行 ' + nccrConfig.nationalVersion };
    }
    if (!batch.fileName) return { tone: 'warn', text: '未出包', tip: '模板版本一致，尚未生成上报文件' };
    return { tone: 'ok', text: '合规', tip: '模板 ' + batch.templateVersion + '\n文件 ' + batch.fileName + '\n校验码 ' + batch.fileHash };
  }
  var RECEIPT = { accepted: ['ok', '全部受理'], partial: ['warn', '部分受理'], rejected: ['bad', '退回'] };
  function judgeAccept(batch) {
    if (!batch) return { tone: 'na', text: '—', tip: '尚未报送' };
    if (!batch.exportedAt) return { tone: 'na', text: '—', tip: '尚未投递' };
    if (!batch.receiptNo) return { tone: 'warn', text: '待回执', tip: batch.exportedAt + ' 已投递\n国家回执未登记' };
    var m = RECEIPT[batch.receiptResult] || ['warn', batch.receiptResult || '待回执'];
    return { tone: m[0], text: m[1], tip: '回执号 ' + batch.receiptNo + '｜' + m[1] + (batch.receiptRemark ? '\n' + batch.receiptRemark : '') };
  }
  function evaluate(reg, batch) {
    var d = {
      cover: judgeCover(reg, batch), timely: judgeTimely(reg, batch), quality: judgeQuality(reg),
      format: judgeFormat(batch), accept: judgeAccept(batch)
    };
    // 未投递 / 未出包 / 待回执只是流程进行中，不算违规；只有触红线才拉低综合结论
    var flow = [d.timely, d.format, d.accept].map(function (x) { return x.tone === 'bad' ? 'bad' : 'ok'; });
    d.overall = worst([d.cover.tone, d.quality.tone].concat(flow));
    return d;
  }
  function overallBadge(tone) {
    var m = { ok: ['badge-success', '合规'], warn: ['badge-warning', '有风险'], bad: ['badge-danger', '不合规'], na: ['badge-muted', '未评估'] };
    var x = m[tone] || m.na;
    return '<span class="badge ' + x[0] + '">' + x[1] + '</span>';
  }

  /* ===================== 7. 批次台账 ===================== */
  // 【原型演示数据】年度批次：登记处码 / 内容 / 状态 / 投递时间 / 回执号 / 受理结果 / 回执说明
  var LEDGER = {
    2024: [
      ['360100', 'ABCD', '已完成', '2026-03-12 10:30', 'NCCR-R-20260318-001', 'accepted', '国家平台受理通过'],
      ['360400', 'ABCD', '已完成', '2026-03-18 14:05', 'NCCR-R-20260324-006', 'accepted', '国家平台受理通过'],
      ['360200', 'ABCD', '已完成', '2026-03-25 09:40', 'NCCR-R-20260401-011', 'accepted', '国家平台受理通过'],
      ['360500', 'ABCD', '已完成', '2026-04-02 16:20', 'NCCR-R-20260409-014', 'accepted', '国家平台受理通过'],
      ['360600', 'ABCD', '已上报', '2026-08-30 11:15', '', '', ''],
      ['360700', 'ABD', '已上报', '2026-09-05 15:50', '', '', ''],
      ['360900', 'ABCD', '已退回', '2026-04-20 10:00', 'NCCR-R-20260428-021', 'rejected', 'C 包人口分母缺 2 个年龄组，退回补正'],
      ['360800', 'ABCD', '待上报', '', '', '', ''],
      ['360300', 'ABCD', '待上报', '', '', '', ''],
      ['361000', 'ABCD', '待上报', '', '', '', '']
    ],
    2023: [
      ['360100', 'ABCD', '已完成', '2025-03-10 09:20', 'NCCR-R-20250316-002', 'accepted', '国家平台受理通过'],
      ['360400', 'ABCD', '已完成', '2025-03-14 10:10', 'NCCR-R-20250320-005', 'accepted', '国家平台受理通过'],
      ['360200', 'ABCD', '已完成', '2025-03-22 15:30', 'NCCR-R-20250329-009', 'accepted', '国家平台受理通过'],
      ['360500', 'ABCD', '已完成', '2025-04-01 09:05', 'NCCR-R-20250408-013', 'partial', '个案表 12 条字段缺失，其余受理'],
      ['360600', 'ABCD', '已完成', '2025-04-06 14:40', 'NCCR-R-20250412-017', 'accepted', '国家平台受理通过'],
      ['360700', 'ABCD', '已完成', '2025-04-15 11:00', 'NCCR-R-20250422-020', 'accepted', '国家平台受理通过'],
      ['360800', 'ABCD', '已完成', '2025-05-08 16:25', 'NCCR-R-20250515-026', 'accepted', '国家平台受理通过'],
      ['360300', 'ABCD', '已完成', '2025-05-20 10:35', 'NCCR-R-20250527-030', 'accepted', '国家平台受理通过'],
      ['360900', 'ABCD', '已退回', '2025-06-02 09:50', 'NCCR-R-20250609-034', 'rejected', '个案表证件号码校验位错误 37 条，退回补正'],
      ['361000', 'ABCD', '待上报', '', '', '', '']
    ]
  };
  // 判定逻辑自然算不出来的历史留痕：C 包人口分母缺口
  var LEDGER_PATCH = {
    'NCCR-JX-2024-09': { popGap: '人口分母缺「女性 85 岁及以上」「男性 0 岁」2 个年龄组' }
  };

  function hashStub(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    return ('00000000' + (h >>> 0).toString(16)).slice(-8) + 'f3a9c1d2';
  }
  function makeBatch(year, seq, spec) {
    var code = spec[0], pkgs = spec[1].split(''), state = spec[2];
    var exportedAt = spec[3] || '', receiptNo = spec[4] || '';
    var reg = registryByCode(code) || { name: code, cases: 0, sent: 0 };
    var id = 'NCCR-JX-' + year + '-' + pad2(seq);
    var b = {
      id: id, year: year, registry: code, registryName: reg.name,
      packages: pkgs, transport: 'file', templateVersion: nccrConfig.nationalVersion,
      state: state, compliance: '',
      caseCount: reg.cases, sentCount: reg.sent, issues: [],
      fileName: '', fileHash: '', createdAt: shiftDays(exportedAt || (year + '-07-01 09:00'), -5),
      createdBy: '省级上报岗', exportedAt: exportedAt,
      receiptNo: receiptNo, receiptResult: spec[5] || '', receiptRemark: spec[6] || '',
      receiptAt: receiptNo ? shiftDays(exportedAt, 6) : '',
      remoteRef: '', riskAck: null, popGap: '', revisionOf: '', remark: ''
    };
    if (exportedAt) {
      var ts = exportedAt.replace(/[-: ]/g, '').slice(0, 14);
      b.fileName = '41_' + code + '_' + year + '_' + pkgs.join('') + '_' + b.templateVersion + '_' + ts + '.csv';
      b.fileHash = hashStub(b.fileName);
    }
    var p = LEDGER_PATCH[id];
    if (p && p.popGap) b.popGap = p.popGap;
    runCheck(b);
    // 有风险却已投递的批次必须留有确认记录，否则违反 canDeliver 的规则
    if (b.compliance === 'warn' && b.exportedAt) {
      var w = b.issues.filter(function (i) { return i.level === 'warn'; })[0];
      b.riskAck = {
        by: '省级上报岗', at: shiftDays(b.exportedAt, -1),
        reason: (w ? w.text : '存在风险提示') + '，已与登记处核对后按现状报送'
      };
    }
    return b;
  }
  var _ledger = null;
  function ledger() {
    if (!_ledger && registryList().length) {
      _ledger = [];
      Object.keys(LEDGER).forEach(function (y) {
        LEDGER[y].forEach(function (s, i) { _ledger.push(makeBatch(Number(y), i + 1, s)); });
      });
    }
    return _ledger || [];
  }
  var nccrData = {
    list: function () { return ledger().slice(); },
    get: function (id) { var l = ledger(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; },
    byRegistry: function (code, year) {
      var l = ledger();
      for (var i = 0; i < l.length; i++) if (l[i].registry === code && String(l[i].year) === String(year)) return l[i];
      return null;
    },
    add: function (b) { ledger().unshift(b); return b; },
    nextSeq: function (year) {
      var max = 0;
      ledger().forEach(function (b) {
        if (String(b.year) === String(year)) { var n = parseInt(String(b.id).split('-').pop(), 10); if (!isNaN(n)) max = Math.max(max, n); }
      });
      return pad2(max + 1);
    }
  };

  /* ===================== 8. 状态 ===================== */
  var OPEN_STATES = ['待上报', '已上报'];
  var CLOSED_STATES = ['已完成', '已退回', '已取消'];
  function isOpen(b) { return OPEN_STATES.indexOf(b.state) >= 0; }
  function isClosed(b) { return CLOSED_STATES.indexOf(b.state) >= 0; }
  function nextStep(b) {
    if (b.state === '已取消') return '已取消';
    if (b.state === '已完成') return '已归档';
    if (b.state === '已退回') return '修正后重报';
    if (b.state === '已上报') return '登记国家回执';
    if (!b.compliance) return '先做合规校验';
    if (b.compliance === 'block') return '整改后重新校验';
    if (b.compliance === 'warn' && !b.riskAck) return '风险确认后上报';
    return '可上报';
  }

  var nccrState = {
    page: 'nccr-new', view: 'list', selectedId: null, fromPage: 'nccr-new',
    year: '2024',
    recordFilters: { year: '', registry: '', result: '', keyword: '' },
    form: { year: '2024', registry: '360100', packages: ['A', 'B', 'C', 'D'], transport: 'file', remark: '' }
  };

  function nccrRefresh() { renderPage(nccrState.page || 'nccr-new'); }
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
    } else if (ex) ex.remove();
  }
  function toolbar(html) { return '<div class="page-toolbar"><div class="toolbar-actions">' + (html || '') + '</div></div>'; }
  function packageLabel(codes) {
    var map = { A: '报告卡个案', B: '随访死亡', C: '人口数据', D: '质量报告' };
    return (codes || []).map(function (c) { return map[c] || c; }).join('、') || '—';
  }
  function transportLabel(t) { return t === 'http' ? '在线推送' : t === 'sftp' ? '文件服务器' : '下载文件'; }
  function stateBadge(s) {
    var m = { '待上报': 'badge-warning', '已上报': 'badge-primary', '已完成': 'badge-success', '已退回': 'badge-danger', '已取消': 'badge-muted' };
    return '<span class="badge ' + (m[s] || 'badge-muted') + '">' + e(s) + '</span>';
  }
  function complianceBadge(c) {
    if (!c) return '<span class="badge badge-muted">未校验</span>';
    var m = { pass: ['badge-success', '合规'], warn: ['badge-warning', '有风险'], block: ['badge-danger', '不合规'] };
    var x = m[c] || m.pass;
    return '<span class="badge ' + x[0] + '">' + x[1] + '</span>';
  }
  function yearOptions(sel, withAll) {
    var ys = [2025, 2024, 2023];
    return (withAll ? '<option value="">全部</option>' : '') + ys.map(function (y) {
      return '<option value="' + y + '"' + (String(sel) === String(y) ? ' selected' : '') + '>' + y + '</option>';
    }).join('');
  }

  /* ===================== 9. 合规校验 ===================== */
  function collectIssues(b) {
    var reg = registryByCode(b.registry);
    if (!reg) return [];
    var out = [];
    var t = judgeTimely(reg, b);
    if (t.tone === 'bad') out.push({ dim: '时效', level: 'bad', text: t.text + '：' + t.tip.replace(/\n/g, '，') });
    var c = judgeCover(reg);
    if (c.tone === 'bad') out.push({ dim: '覆盖', level: 'bad', text: '病例上报率 ' + c.text + '，低于达标线 ' + coverMin() + '%' });
    else if (c.tone === 'warn') out.push({ dim: '覆盖', level: 'warn', text: '病例上报率 ' + c.text + '，未达 ' + coverMin() + '%' });
    if ((b.packages || []).indexOf('C') >= 0 && b.popGap) out.push({ dim: '覆盖', level: 'bad', text: b.popGap });
    judgeQuality(reg).items.forEach(function (it) {
      var q = dictItem(it.rule);
      if (it.tone === 'bad') out.push({ dim: '质量', level: 'bad', rule: it.rule, text: it.name + ' ' + it.text + '，触红线（' + (q ? q.redline : '') + '）' });
      else if (it.tone === 'warn') out.push({ dim: '质量', level: 'warn', rule: it.rule, text: it.name + ' ' + it.text + '，未达目标（' + (q ? q.target : '') + '）' });
      else if (it.tone === 'na') out.push({ dim: '质量', level: 'na', rule: it.rule, text: it.name + '本站暂无同源数据，不参与判定' });
    });
    if (b.templateVersion !== nccrConfig.nationalVersion) {
      out.push({ dim: '格式模板', level: 'bad', text: '批次模板 ' + b.templateVersion + ' 与国家现行 ' + nccrConfig.nationalVersion + ' 不一致' });
    }
    return out;
  }
  function runCheck(b) {
    b.issues = collectIssues(b);
    var lv = b.issues.length ? worst(b.issues.map(function (x) { return x.level; })) : 'ok';
    b.compliance = lv === 'bad' ? 'block' : lv === 'warn' ? 'warn' : 'pass';
    return b;
  }
  function canDeliver(b) {
    if (b.state !== '待上报') return false;
    if (b.compliance === 'block' || !b.compliance) return false;
    if (b.compliance === 'warn' && !b.riskAck) return false;
    return true;
  }
  function primaryAction(b) {
    if (b.state === '待上报' && (!b.compliance || b.compliance === 'block')) return { cls: 'btn-outline', fn: 'nccrCheck', label: '合规校验' };
    if (b.state === '待上报' && b.compliance === 'warn' && !b.riskAck) return { cls: 'btn-warning', fn: 'nccrAckRisk', label: '风险确认' };
    if (canDeliver(b)) return { cls: 'btn-primary', fn: 'nccrDeliver', label: '上报' };
    if (b.state === '已上报') return { cls: 'btn-primary', fn: 'nccrReceipt', label: '登记回执' };
    if (b.state === '已退回') return { cls: 'btn-outline', fn: 'nccrRedo', label: '重报' };
    return null;
  }

  /* ===================== 10. CSV ===================== */
  function csvEscape(v) {
    var s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadCsv(filename, headers, rows) {
    var lines = [headers.join(',')];
    rows.forEach(function (r) { lines.push(r.map(csvEscape).join(',')); });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function sampleARows(b) {
    return [
      [b.registry, 'JX' + b.year + '00000001', 'JX-' + b.year + '-000091', '张伟', '01', '360102196503121234', '1', '1965-03-12', '59', '01', '2', '6', '', '13800001111', '5', '张芳', '13900002222', '360102', '董家窑街道XX号', '360102', '董家窑街道XX号', '1', 'C34.1', '8070', '3', '2', '1', '7', '0', b.year + '-03-15', 'C34.1', 'T2', 'N1', 'M0', '1;2', '肺恶性肿瘤', '右肺上叶鳞状细胞癌', '360100H001', '江西省肿瘤医院', 'MZ240501', 'ZY240088', '王医生', b.year + '-03-18', '1', '2', '2026-07-31', '0'],
      [b.registry, 'JX' + b.year + '00000002', 'JX-' + b.year + '-000102', '李娜', '01', '360103197808152345', '2', '1978-08-15', '46', '01', '2', '2', '', '13800003333', '', '', '', '360103', '站前西路XX号', '360103', '站前西路XX号', '1', 'C50.9', '8500', '3', '2', '2', '7', '0', b.year + '-05-20', 'C50.9', 'T1', 'N0', 'M0', '1', '乳房恶性肿瘤', '左乳浸润性导管癌', '360100H002', '南昌大学第一附属医院', 'MZ240622', 'ZY240103', '李医生', b.year + '-05-22', '1', '1', '2026-07-31', '0']
    ];
  }
  function sampleBRows(b) {
    return [
      [b.registry, 'JX' + b.year + '00000001', 'JX-' + b.year + '-000091', (b.year + 1) + '-12-01', '1', '21', '', '', '', '', ''],
      [b.registry, 'JX' + b.year + '00000002', 'JX-' + b.year + '-000102', (b.year + 1) + '-08-10', '3', '15', '1', '1', 'C50.9', (b.year + 1) + '-08-10', '周医生']
    ];
  }
  function sampleCRows(b) {
    var rows = [];
    AGE19.forEach(function (name, i) {
      var code = pad2(i);
      rows.push([b.registry, b.registry.slice(0, 6), String(b.year), '1', code, name, String(3000 + i * 400)]);
      rows.push([b.registry, b.registry.slice(0, 6), String(b.year), '2', code, name, String(2800 + i * 380)]);
    });
    return rows;
  }
  function sampleDRows(b) {
    var reg = registryByCode(b.registry) || { mv: 0, dco: 0, mi: 0, ub: 0 };
    return [[b.registry, String(b.year), String(b.caseCount), String(Math.round(b.caseCount * reg.mi)),
      reg.mv.toFixed(2), '', reg.dco.toFixed(2), reg.ub.toFixed(2), '', reg.mi.toFixed(2),
      b.compliance === 'pass' ? '达标' : b.compliance === 'warn' ? '有风险' : b.compliance === 'block' ? '不达标' : '未校验']];
  }
  function maskName(n) { return n ? n.charAt(0) + '*' : '—'; }
  function maskId(id) { return id && id.length >= 8 ? id.slice(0, 3) + '***********' + id.slice(-4) : (id || '—'); }

  /* ===================== 11. 页① 新增上报 ===================== */
  function openBatches() { return nccrData.list().filter(isOpen); }

  function renderOpenPanel() {
    var list = openBatches();
    var dl24 = fmtDate(deadline(2024));
    var rows = list.map(function (b) {
      var act = primaryAction(b);
      var ops = '<div class="nccr-row-ops"><button class="btn btn-ghost btn-xs" onclick="nccrOpenDetail(\'' + b.id + '\')">详情</button>' +
        (act ? '<button class="btn ' + act.cls + ' btn-xs" onclick="' + act.fn + '(\'' + b.id + '\')">' + act.label + '</button>' : '') +
        '</div>';
      return '<tr>' +
        '<td class="txt"><a href="javascript:void(0)" style="color:var(--primary)" onclick="nccrOpenDetail(\'' + b.id + '\')">' + e(b.id) + '</a></td>' +
        '<td class="txt">' + e(b.registryName) + '<span style="color:#98a2b3"> · ' + b.year + '</span></td>' +
        '<td class="txt">' + e(packageLabel(b.packages)) + '</td>' +
        '<td class="num">' + fmtInt(b.caseCount) + '</td>' +
        '<td class="num">' + complianceBadge(b.compliance) + '</td>' +
        '<td class="code">' + stateBadge(b.state) + '</td>' +
        '<td class="txt">' + e(nextStep(b)) + '</td>' +
        '<td class="sticky-col">' + ops + '</td></tr>';
    }).join('') || '<tr><td colspan="8">' + emptyState('没有进行中的上报任务，可在下方新建。') + '</td></tr>';

    return '<div class="panel"><div class="panel-header">进行中的上报</div><div class="panel-body">' +
      '<div class="nccr-count">共 ' + list.length + ' 个批次待处理　｜　2024 年度报送截止 ' + dl24 + '</div>' +
      '<div class="table-wrap"><table class="data-table" style="min-width:960px"><thead><tr>' +
      '<th class="txt">批次号</th><th class="txt">登记处</th><th class="txt">上报内容</th><th class="num">应报例数</th><th class="num">合规判定</th><th class="code">状态</th><th class="txt">下一步</th><th class="sticky-col">操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '</div></div>';
  }

  /* 报送范围确定后，按所选年度 + 登记处列出报告卡清单与相关数据概览 */
  function renderFormPreview() {
    var year = nccrState.form.year, code = nccrState.form.registry;
    var reg = registryByCode(code);
    if (!reg) {
      return '<div class="nccr-section"><div class="nccr-section-title">② 报告卡清单与相关数据</div>' +
        '<div class="nccr-hint">请选择统计年度与肿瘤登记处后查看报告卡清单。</div></div>';
    }
    var min = coverMin();
    var coverTone = reg.cover >= min ? 'ok' : reg.cover >= min - 3 ? 'warn' : 'bad';
    var kpis = '<div class="nccr-kpi-row">' +
      kpi('应报例数', fmtInt(reg.cases), '', year + ' 年度预计应报病例数') +
      kpi('已报例数', fmtInt(reg.sent), '', '已上报病例数') +
      kpi('病例上报率', reg.cover.toFixed(1) + '%', coverTone, '达标线 ' + min + '%') +
      kpi('MV%', reg.mv.toFixed(2) + '%', '', '病理/细胞学证实比例') +
      kpi('DCO%', reg.dco.toFixed(2) + '%', '', '仅死亡补发病比例') +
      kpi('M/I', reg.mi.toFixed(2), '', '死亡发病比') +
      '</div>';
    // 复用个案抽样数据，构造脱敏报告卡清单（预览）
    var fakeB = { registry: code, year: Number(year) };
    var a = sampleARows(fakeB), f = sampleBRows(fakeB);
    var rows = a.map(function (r, i) {
      var fo = f[i] || [];
      return '<tr><td class="txt">' + e(r[2]) + '</td><td class="txt">' + e(maskName(r[3])) + '</td>' +
        '<td class="code">' + (r[6] === '1' ? '男' : '女') + '</td><td class="num">' + e(r[8]) + '</td>' +
        '<td class="txt">' + e(maskId(r[5])) + '</td><td class="txt">' + e(r[30]) + '</td><td class="txt">' + e(r[22]) + '</td>' +
        '<td class="code">' + e(r[29]) + '</td><td class="code">' + (fo[4] === '3' ? '死亡' : fo[4] === '1' ? '存活' : '—') + '</td>' +
        '<td class="txt">' + e(r[38]) + '</td></tr>';
    }).join('');
    var tbl = '<div class="table-wrap" style="margin-top:10px"><table class="data-table" style="min-width:1080px"><thead><tr>' +
      '<th class="txt">省内报告卡编号</th><th class="txt">姓名</th><th class="code">性别</th><th class="num">年龄</th><th class="txt">证件号</th><th class="txt">ICD-10</th><th class="txt">部位</th><th class="code">确诊日期</th><th class="code">随访</th><th class="txt">诊断单位</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    var hint = '<div class="nccr-hint" style="margin-top:8px">以上为该登记处 ' + year + ' 年度报告卡抽样（脱敏），仅用于上报前预览；完整清单可在「报告卡管理 › 报告卡列表」按登记处与年度筛选查看。</div>';
    return '<div class="nccr-section"><div class="nccr-section-title">② 报告卡清单与相关数据</div>' +
      kpis + tbl + hint + '</div>';
  }

  function renderFormPanel() {
    var form = nccrState.form;
    var regs = registryList();
    var pkgMeta = [
      { code: 'A', title: '报告卡个案', tip: '从已核对/已锁定的肿瘤报告卡导出发病明细' },
      { code: 'B', title: '随访死亡', tip: '报告卡对应的随访结局与死因' },
      { code: 'C', title: '人口数据', tip: '分年龄组人口，国家要求 19 组 × 性别' },
      { code: 'D', title: '质量报告', tip: '整包 MV%、DCO%、M/I 等汇总，不是个案' }
    ];
    var pkgCards = pkgMeta.map(function (p) {
      var on = form.packages.indexOf(p.code) >= 0;
      return '<label class="nccr-pkg-card' + (on ? ' checked' : '') + '" title="' + e(p.tip) + '">' +
        '<span class="ttl"><input type="checkbox" class="nccr-pkg" value="' + p.code + '"' + (on ? ' checked' : '') + ' style="margin:0" onchange="this.closest(\'.nccr-pkg-card\').classList.toggle(\'checked\',this.checked)">' + p.title + '</span></label>';
    }).join('');

    return '<div class="panel"><div class="panel-header">新建上报</div><div class="panel-body">' +
      '<div class="nccr-section"><div class="nccr-section-title">① 报送范围</div>' +
      '<div class="nccr-grid-2">' +
      '<div class="form-group"><label>统计年度 <span class="required">*</span></label><select id="nccrYear" onchange="nccrState.form.year=this.value;nccrRefresh()">' + yearOptions(form.year, false) + '</select></div>' +
      '<div class="form-group"><label>肿瘤登记处 <span class="required">*</span></label><select id="nccrRegistry" onchange="nccrState.form.registry=this.value;nccrRefresh()">' +
      regs.map(function (r) { return '<option value="' + r.code + '"' + (form.registry === r.code ? ' selected' : '') + '>' + e(r.name) + '</option>'; }).join('') +
      '</select></div></div></div>' +
      renderFormPreview() +
      '<div class="nccr-section"><div class="nccr-section-title">③ 上报内容</div>' +
      '<div class="nccr-pkg-grid">' + pkgCards + '</div>' +
      '<div class="nccr-inline-error" id="nccrPkgErr"></div></div>' +
      '<div class="nccr-section"><div class="nccr-section-title">④ 报送方式</div>' +
      '<div class="nccr-grid-2">' +
      '<div class="form-group"><label>方式</label><select id="nccrTransport">' +
      '<option value="file"' + (form.transport === 'file' ? ' selected' : '') + '>下载文件，再手工导入国家平台</option>' +
      '<option value="http"' + (form.transport === 'http' ? ' selected' : '') + (nccrConfig.httpEnabled ? '' : ' disabled') + '>系统在线推送到国家平台</option>' +
      '<option value="sftp"' + (form.transport === 'sftp' ? ' selected' : '') + '>上传到指定文件服务器</option>' +
      '</select></div>' +
      '<div class="form-group"><label>模板版本</label><input value="' + e(nccrConfig.nationalVersion) + '" disabled></div>' +
      '<div class="form-group nccr-span-2"><label>备注</label><textarea id="nccrRemark" rows="2" placeholder="可选">' + e(form.remark || '') + '</textarea></div>' +
      '</div></div>' +
      '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn btn-ghost btn-sm" onclick="nccrResetForm()">重置</button>' +
      '<button class="btn btn-primary btn-sm" onclick="nccrCreate()">保存并做合规校验</button>' +
      '</div></div></div>';
  }

  function renderNewPage() {
    return toolbar('<button class="btn btn-outline btn-sm" onclick="nccrDownloadTemplate()">下载空白模板</button>') +
      renderFormPanel();
  }

  /* ===================== 12. 页② 上报记录 ===================== */
  function filteredRecords() {
    var f = nccrState.recordFilters;
    return nccrData.list().filter(function (b) {
      if (!isClosed(b)) return false;
      if (f.year && String(b.year) !== f.year) return false;
      if (f.registry && b.registry !== f.registry) return false;
      if (f.result === 'accepted' && b.receiptResult !== 'accepted') return false;
      if (f.result === 'partial' && b.receiptResult !== 'partial') return false;
      if (f.result === 'rejected' && b.state !== '已退回') return false;
      if (f.result === 'void' && b.state !== '已取消') return false;
      if (f.keyword) {
        var k = f.keyword.trim();
        if (b.id.indexOf(k) < 0 && (b.receiptNo || '').indexOf(k) < 0 && b.registryName.indexOf(k) < 0) return false;
      }
      return true;
    });
  }
  function renderRecords() {
    var list = filteredRecords(), f = nccrState.recordFilters, regs = registryList();
    var rows = list.map(function (b) {
      var ops = '<div class="nccr-row-ops"><button class="btn btn-ghost btn-xs" onclick="nccrOpenDetail(\'' + b.id + '\')">详情</button>' +
        (b.fileName ? '<button class="btn btn-ghost btn-xs" onclick="nccrDownload(\'' + b.id + '\')">下载</button>' : '') +
        (b.state === '已退回' ? '<button class="btn btn-outline btn-xs" onclick="nccrRedo(\'' + b.id + '\')">重报</button>' : '') +
        '</div>';
      var result = b.state === '已取消' ? '已取消' : ((RECEIPT[b.receiptResult] || ['', '—'])[1]);
      return '<tr>' +
        '<td class="txt"><a href="javascript:void(0)" style="color:var(--primary)" onclick="nccrOpenDetail(\'' + b.id + '\')">' + e(b.id) + '</a></td>' +
        '<td class="code">' + b.year + '</td>' +
        '<td class="txt">' + e(b.registryName) + '</td>' +
        '<td class="txt">' + e(packageLabel(b.packages)) + '</td>' +
        '<td class="num">' + fmtInt(b.caseCount) + '</td>' +
        '<td class="code">' + e(b.exportedAt || '—') + '</td>' +
        '<td class="txt">' + e(b.receiptNo || '—') + '</td>' +
        '<td class="code">' + e(result) + '</td>' +
        '<td class="code">' + stateBadge(b.state) + '</td>' +
        '<td class="sticky-col">' + ops + '</td></tr>';
    }).join('') || '<tr><td colspan="10">' + emptyState('没有符合条件的上报记录。', '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'nccr-new\')">去新增上报</button>') + '</td></tr>';

    return toolbar('<button class="btn btn-primary btn-sm" onclick="navigateTo(\'nccr-new\')">新增上报</button>' +
      '<button class="btn btn-outline btn-sm" onclick="nccrExportRecords()">导出台账</button>') +
      '<div class="panel"><div class="panel-header">上报记录</div><div class="panel-body">' +
      '<div class="filter-toolbar">' +
      '<div class="form-group"><label>统计年</label><select onchange="nccrState.recordFilters.year=this.value;nccrRefresh()">' + yearOptions(f.year, true) + '</select></div>' +
      '<div class="form-group"><label>登记处</label><select onchange="nccrState.recordFilters.registry=this.value;nccrRefresh()"><option value="">全部</option>' +
      regs.map(function (r) { return '<option value="' + r.code + '"' + (f.registry === r.code ? ' selected' : '') + '>' + e(r.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label>国家受理结果</label><select onchange="nccrState.recordFilters.result=this.value;nccrRefresh()">' +
      '<option value="">全部</option>' +
      ['accepted|全部受理', 'partial|部分受理', 'rejected|退回', 'void|已取消'].map(function (o) {
        var p = o.split('|'); return '<option value="' + p[0] + '"' + (f.result === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
      }).join('') + '</select></div>' +
      '<div class="form-group search-group"><label>搜索</label><input placeholder="批次号 / 回执号 / 登记处" value="' + e(f.keyword) + '" onkeydown="if(event.key===\'Enter\'){nccrState.recordFilters.keyword=this.value;nccrRefresh()}"></div>' +
      '<div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="nccrState.recordFilters.keyword=document.querySelector(\'#pageContainer .search-group input\').value;nccrRefresh()">查询</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="nccrState.recordFilters={year:\'\',registry:\'\',result:\'\',keyword:\'\'};nccrRefresh()">重置</button></div>' +
      '</div>' +
      '<div class="nccr-count">共 ' + list.length + ' 条</div>' +
      '<div class="table-wrap"><table class="data-table" style="min-width:1180px"><thead><tr>' +
      '<th class="txt">批次号</th><th class="code">统计年</th><th class="txt">登记处</th><th class="txt">上报内容</th><th class="num">应报例数</th><th class="code">上报时间</th><th class="txt">回执号</th><th class="code">受理结果</th><th class="code">状态</th><th class="sticky-col">操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '</div></div>';
  }

  /* ===================== 13. 页③ 上报合规性 ===================== */
  function complianceRows(year) {
    var regs = registryList();
    return regs.map(function (r) {
      var b = nccrData.byRegistry(r.code, year);
      return { reg: r, batch: b, dims: evaluate(r, b) };
    });
  }
  function renderCompliance() {
    var year = nccrState.year;
    var rows = complianceRows(year);
    if (!rows.length) {
      return '<div class="panel"><div class="panel-header">上报合规性</div><div class="panel-body">' + emptyState('登记处主数据未加载。') + '</div></div>';
    }
    var total = rows.length;
    var sent = rows.filter(function (x) { return x.batch && x.batch.exportedAt; }).length;
    var onTime = rows.filter(function (x) { return x.batch && x.batch.exportedAt && x.dims.timely.tone === 'ok'; }).length;
    var qOk = rows.filter(function (x) { return x.dims.quality.tone === 'ok'; }).length;
    var receipted = rows.filter(function (x) { return x.batch && x.batch.receiptNo; });
    var accepted = receipted.filter(function (x) { return x.batch.receiptResult === 'accepted'; }).length;
    var overallBad = rows.filter(function (x) { return x.dims.overall === 'bad'; }).length;

    var kpis = '<div class="nccr-kpi-row">' +
      kpi('登记处已报送', sent + '/' + total, sent === total ? 'ok' : sent ? 'warn' : 'bad', year + ' 年度已生成并投递批次的登记处数') +
      kpi('按时报送', onTime + '/' + (sent || 0), onTime === sent ? 'ok' : 'warn', '投递日早于报送截止（诊断年后 ' + nccrConfig.timelinessMonths + ' 个月）') +
      kpi('质量合规', qOk + '/' + total, qOk === total ? 'ok' : qOk ? 'warn' : 'bad', '按字典群体质量指标判定，MV%／DCO%／M-I／诊断依据不明四项全部达标') +
      kpi('国家受理', accepted + '/' + (receipted.length || 0), accepted === receipted.length ? 'ok' : 'warn', '已登记回执中结果为「全部受理」的批次数') +
      kpi('不合规登记处', String(overallBad), overallBad ? 'bad' : 'ok', '五维中任一维触红线的登记处数') +
      '</div>';

    var tableRows = rows.map(function (x) {
      var r = x.reg, b = x.batch, d = x.dims;
      var ops = '<div class="nccr-row-ops">' +
        (b ? '<button class="btn btn-ghost btn-xs" onclick="nccrOpenDetail(\'' + b.id + '\')">批次</button>' : '') +
        '<button class="btn btn-primary btn-xs" onclick="nccrGoNew(\'' + r.code + '\',' + year + ')">去上报</button></div>';
      return '<tr>' +
        '<td class="txt">' + e(r.name) + '</td>' +
        '<td class="num" title="应报 ' + fmtInt(r.cases) + ' 例，实报 ' + fmtInt(r.sent) + ' 例">' + fmtInt(r.sent) + ' / ' + fmtInt(r.cases) + '</td>' +
        '<td class="num">' + light(d.cover) + '</td>' +
        '<td class="num">' + light(d.timely) + '</td>' +
        '<td class="num">' + light(d.quality) + '</td>' +
        '<td class="num">' + light(d.format) + '</td>' +
        '<td class="num">' + light(d.accept) + '</td>' +
        '<td class="code">' + overallBadge(d.overall) + '</td>' +
        '<td class="code">' + (b ? stateBadge(b.state) : '<span class="badge badge-muted">未生成批次</span>') + '</td>' +
        '<td class="sticky-col">' + ops + '</td></tr>';
    }).join('');

    return '<div class="panel"><div class="panel-header">上报合规性</div><div class="panel-body">' +
      '<div class="filter-toolbar">' +
      '<div class="form-group"><label>统计年</label><select onchange="nccrState.year=this.value;nccrRefresh()">' + yearOptions(year, false) + '</select></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="nccrExportCompliance()">导出合规清单</button></div>' +
      '</div>' +
      kpis +
      '<div class="table-wrap"><table class="data-table" style="min-width:1120px"><thead><tr>' +
      '<th class="txt">肿瘤登记处</th><th class="num">实报 / 应报例数</th><th class="num">覆盖</th><th class="num">时效</th><th class="num">质量</th><th class="num">格式模板</th><th class="num">国家受理</th><th class="code">综合结论</th><th class="code">批次状态</th><th class="sticky-col">操作</th>' +
      '</tr></thead><tbody>' + tableRows + '</tbody></table></div>' +
      renderIssuePanel(rows, year) +
      '</div></div>';
  }

  function issueRows(rows) {
    var out = [];
    rows.forEach(function (x) {
      var reg = x.reg, b = x.batch;
      if (!b) {
        out.push({ reg: reg.name, dim: '时效', level: x.dims.timely.tone, text: x.dims.timely.tip.replace(/\n/g, '，'), state: '未生成批次' });
        x.dims.quality.items.forEach(function (it) {
          if (it.tone !== 'bad' && it.tone !== 'warn') return;
          var q = dictItem(it.rule);
          out.push({
            reg: reg.name, dim: '质量', level: it.tone, state: '未生成批次',
            text: it.name + ' ' + it.text + '，' + (it.tone === 'bad' ? '触红线（' + q.redline + '）' : '未达目标（' + q.target + '）')
          });
        });
        return;
      }
      collectIssues(b).forEach(function (i) {
        if (i.level === 'na') return;
        out.push({ reg: reg.name, dim: i.dim, level: i.level, text: i.text, state: b.state });
      });
    });
    var rank = { bad: 0, warn: 1, na: 2, ok: 3 };
    return out.sort(function (a, b) { return rank[a.level] - rank[b.level]; });
  }
  function renderIssuePanel(rows, year) {
    var list = issueRows(rows);
    if (!list.length) return '<div style="margin-top:18px"><div class="nccr-section-title">' + year + ' 年度不合规问题</div><div class="nccr-hint">全部登记处五维合规，无需整改。</div></div>';
    var trs = list.map(function (i) {
      var tone = i.level === 'bad' ? 'badge-danger' : 'badge-warning';
      return '<tr><td class="txt">' + e(i.reg) + '</td><td class="code">' + e(i.dim) + '</td>' +
        '<td class="code"><span class="badge ' + tone + '">' + (i.level === 'bad' ? '红线' : '风险') + '</span></td>' +
        '<td class="txt">' + e(i.text) + '</td>' +
        '<td class="txt">' + (i.level === 'bad' ? '阻断国家受理' : '报送前需整改') + '</td>' +
        '<td class="code">' + e(i.state) + '</td></tr>';
    }).join('');
    return '<details class="nccr-fold" open style="margin-top:18px"><summary>' + year + ' 年度不合规问题（' + list.length + ' 条）</summary><div class="bd">' +
      '<div class="table-wrap"><table class="data-table" style="min-width:900px"><thead><tr>' +
      '<th class="txt">登记处</th><th class="code">合规维度</th><th class="code">级别</th><th class="txt">问题</th><th class="txt">影响</th><th class="code">批次状态</th>' +
      '</tr></thead><tbody>' + trs + '</tbody></table></div></div></details>';
  }

  /* ===================== 14. 批次详情（单页折叠） ===================== */
  function timeline(b) {
    var t = [{ at: b.createdAt, by: b.createdBy, act: '创建批次' }];
    if (b.compliance) t.push({ at: b.createdAt, by: b.createdBy, act: '合规校验：' + ({ pass: '合规', warn: '有风险', block: '不合规' }[b.compliance] || '未校验') });
    if (b.riskAck) t.push({ at: b.riskAck.at, by: b.riskAck.by, act: '风险确认上报：' + b.riskAck.reason });
    if (b.exportedAt) t.push({ at: b.exportedAt, by: b.createdBy, act: '投递国家平台（' + transportLabel(b.transport) + '）' });
    if (b.receiptAt) t.push({ at: b.receiptAt, by: '国家癌症中心', act: '回执 ' + b.receiptNo + '：' + ((RECEIPT[b.receiptResult] || ['', b.receiptResult])[1]) + (b.receiptRemark ? '（' + b.receiptRemark + '）' : '') });
    if (b.state === '已取消') t.push({ at: b.voidAt || b.createdAt, by: b.createdBy, act: '取消批次' });
    if (b.revisionOf) t.push({ at: b.createdAt, by: b.createdBy, act: '由 ' + b.revisionOf + ' 重报生成' });
    return t.sort(function (x, y) { return String(x.at) < String(y.at) ? -1 : 1; });
  }

  function renderDetail() {
    var b = nccrData.get(nccrState.selectedId);
    if (!b) return nccrState.page === 'nccr-records' ? renderRecords() : renderNewPage();
    var reg = registryByCode(b.registry);
    var dims = reg ? evaluate(reg, b) : null;
    var act = primaryAction(b);

    var acts = '<button class="btn btn-ghost btn-sm" onclick="nccrBack()">← 返回</button>';
    if (b.state === '待上报') acts += ' <button class="btn btn-outline btn-sm" onclick="nccrCheck(\'' + b.id + '\')">合规校验</button>';
    if (act && act.fn !== 'nccrCheck') acts += ' <button class="btn ' + act.cls + ' btn-sm" onclick="' + act.fn + '(\'' + b.id + '\')">' + act.label + '</button>';
    if (b.fileName) acts += ' <button class="btn btn-outline btn-sm" onclick="nccrDownload(\'' + b.id + '\')">下载上报文件</button>';
    if (b.state === '待上报') acts += ' <button class="btn btn-danger btn-sm" onclick="nccrVoid(\'' + b.id + '\')">取消批次</button>';

    var meta = '<div class="nccr-meta">' +
      '<div><span class="k">批次号</span> <span class="v">' + e(b.id) + '</span></div>' +
      '<div><span class="k">登记处</span> <span class="v">' + e(b.registryName) + '</span></div>' +
      '<div><span class="k">统计年</span> <span class="v">' + b.year + '</span></div>' +
      '<div><span class="k">上报内容</span> <span class="v">' + e(packageLabel(b.packages)) + '</span></div>' +
      '<div><span class="k">应报例数</span> <span class="v">' + fmtInt(b.caseCount) + '</span></div>' +
      '<div><span class="k">报送方式</span> <span class="v">' + e(transportLabel(b.transport)) + '</span></div>' +
      '<div><span class="k">状态</span> <span class="v">' + stateBadge(b.state) + '</span></div>' +
      '<div><span class="k">合规判定</span> <span class="v">' + complianceBadge(b.compliance) + '</span></div>' +
      '<div><span class="k">报送截止</span> <span class="v">' + fmtDate(deadline(b.year)) + '</span></div>' +
      '</div>';

    var dimTable = dims ? '<div class="table-wrap"><table class="data-table" style="min-width:720px"><thead><tr>' +
      '<th class="txt">合规维度</th><th class="num">判定</th><th class="txt">结果</th><th class="txt">依据</th></tr></thead><tbody>' +
      [['覆盖', dims.cover], ['时效', dims.timely], ['质量', dims.quality], ['格式模板', dims.format], ['国家受理', dims.accept]].map(function (p) {
        return '<tr><td class="txt">' + p[0] + '</td><td class="num">' + light(p[1]) + '</td><td class="txt">' + e(p[1].text) + '</td>' +
          '<td class="txt nccr-hint">' + e(p[1].tip).replace(/\n/g, '；') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '';

    var issueList = (b.issues || []).length
      ? '<div class="table-wrap"><table class="data-table" style="min-width:720px"><thead><tr><th class="code">维度</th><th class="txt">问题</th></tr></thead><tbody>' +
      b.issues.map(function (i) {
        return '<tr><td class="code">' + e(i.dim) + (i.level === 'na' ? '<span class="badge badge-muted" style="margin-left:6px">不判定</span>' : '') + '</td><td class="txt">' + e(i.text) + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="nccr-hint">尚未做合规校验。</div>';

    var fileBlock = b.fileName
      ? '<div class="nccr-meta" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      '<div><span class="k">上报文件</span> <span class="v">' + e(b.fileName) + '</span></div>' +
      '<div><span class="k">校验码</span> <span class="v">' + e(b.fileHash) + '</span></div>' +
      '<div><span class="k">模板版本</span> <span class="v">' + e(b.templateVersion) + '</span></div>' +
      '<div><span class="k">投递时间</span> <span class="v">' + e(b.exportedAt) + '</span></div></div>'
      : '<div class="nccr-hint">尚未生成上报文件。</div>';

    var receiptBlock = b.receiptNo
      ? '<div class="nccr-meta" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      '<div><span class="k">回执号</span> <span class="v">' + e(b.receiptNo) + '</span></div>' +
      '<div><span class="k">受理结果</span> <span class="v">' + e((RECEIPT[b.receiptResult] || ['', '—'])[1]) + '</span></div>' +
      '<div><span class="k">回执时间</span> <span class="v">' + e(b.receiptAt) + '</span></div>' +
      '<div><span class="k">国家说明</span> <span class="v">' + e(b.receiptRemark || '—') + '</span></div></div>'
      : '<div class="nccr-hint">' + (b.exportedAt ? '已投递，国家回执未登记。' : '尚未投递。') + '</div>';

    var tl = '<ul class="nccr-tl">' + timeline(b).map(function (t) {
      return '<li><div>' + e(t.act) + '</div><div class="t">' + e(t.at) + '　' + e(t.by) + '</div></li>';
    }).join('') + '</ul>';

    var dataBlock = reportDataBlock(b);

    return toolbar(acts) +
      '<div class="panel"><div class="panel-header">批次详情</div><div class="panel-body">' +
      meta +
      '<details class="nccr-fold"><summary>合规体检</summary><div class="bd">' + dimTable + '<div style="height:12px"></div>' + issueList + '</div></details>' +
      '<details class="nccr-fold"><summary>报送文件</summary><div class="bd">' + fileBlock + '</div></details>' +
      '<details class="nccr-fold"><summary>国家回执</summary><div class="bd">' + receiptBlock + '</div></details>' +
      '<details class="nccr-fold" open><summary>上报数据明细</summary><div class="bd">' + dataBlock + '</div></details>' +
      '<details class="nccr-fold"><summary>操作留痕</summary><div class="bd">' + tl + '</div></details>' +
      '</div></div>';
  }

  // 上报数据明细：按 A/B/C/D 数据包分别完整列出全部字段与全部行
  function reportDataBlock(b) {
    var p = b.packages || [];
    if (!p.length) return '<div class="nccr-hint">本批未选择上报内容。</div>';
    var blocks = [];
    if (p.indexOf('A') >= 0) blocks.push(pkgTable(b, 'A', '报告卡个案（发病明细）', A_HEADERS, sampleARows(b)));
    if (p.indexOf('B') >= 0) blocks.push(pkgTable(b, 'B', '随访死亡（结局与死因）', B_HEADERS, sampleBRows(b)));
    if (p.indexOf('C') >= 0) blocks.push(pkgTable(b, 'C', '人口数据（分年龄组 · 性别）', C_HEADERS, sampleCRows(b)));
    if (p.indexOf('D') >= 0) blocks.push(pkgTable(b, 'D', '质量报告（汇总指标）', D_HEADERS, sampleDRows(b)));
    return '<div class="nccr-pkg-list">' + blocks.join('') + '</div>';
  }

  function pkgTable(b, code, title, headers, rows) {
    var headHtml = headers.map(function (h) { return '<th class="txt">' + e(h) + '</th>'; }).join('');
    var bodyHtml = rows.map(function (r) {
      return '<tr>' + r.map(function (c) {
        return '<td class="txt">' + e(c == null ? '' : String(c)) + '</td>';
      }).join('') + '</tr>';
    }).join('') || '<tr><td class="txt" colspan="' + headers.length + '" style="text-align:center;color:#94a3b8">暂无数据</td></tr>';
    return '<div class="nccr-pkg-block">' +
      '<div class="nccr-pkg-head">' +
      '<span class="nccr-pkg-tag">' + code + '</span>' +
      '<b class="nccr-pkg-title">' + e(title) + '</b>' +
      '<span class="nccr-pkg-meta">' + rows.length + ' 行 · ' + headers.length + ' 列</span>' +
      '<span class="nccr-pkg-spacer"></span>' +
      '<button class="btn btn-ghost btn-xs" onclick="nccrDownloadPkg(\'' + b.id + '\',\'' + code + '\')">导出本包</button>' +
      '</div>' +
      '<div class="table-wrap"><table class="data-table" style="min-width:' + Math.max(680, headers.length * 88) + 'px"><thead><tr>' + headHtml + '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
      '</div>';
  }

  /* ===================== 15. 路由渲染 ===================== */
  function renderPageContent() {
    if (nccrState.view === 'detail' && nccrState.page !== 'nccr-compliance') return renderDetail();
    if (nccrState.page === 'nccr-records') return renderRecords();
    if (nccrState.page === 'nccr-compliance') return renderCompliance();
    return renderNewPage();
  }

  /* ===================== 16. 交互 ===================== */
  window.nccrRefresh = nccrRefresh;
  window.nccrState = nccrState;
  window.nccrData = nccrData;
  window.nccrConfig = nccrConfig;

  window.nccrGoNew = function (code, year) {
    if (code) nccrState.form.registry = code;
    if (year) nccrState.form.year = String(year);
    nccrState.view = 'list'; nccrState.selectedId = null;
    navigateTo('nccr-new');
    if (code) toast('已带入登记处与统计年');
  };
  window.nccrOpenDetail = function (id) {
    var b = nccrData.get(id);
    nccrState.fromPage = b && isClosed(b) ? 'nccr-records' : 'nccr-new';
    nccrState.page = nccrState.fromPage;
    nccrState.view = 'detail'; nccrState.selectedId = id;
    nccrRefresh();
  };
  window.nccrBack = function () {
    nccrState.view = 'list'; nccrState.selectedId = null;
    navigateTo(nccrState.fromPage || 'nccr-new');
  };
  window.nccrResetForm = function () {
    nccrState.form = { year: '2024', registry: '360100', packages: ['A', 'B', 'C', 'D'], transport: 'file', remark: '' };
    nccrRefresh(); toast('已重置');
  };

  window.nccrCreate = function () {
    var year = document.getElementById('nccrYear').value;
    var registry = document.getElementById('nccrRegistry').value;
    var transport = document.getElementById('nccrTransport').value;
    var remark = (document.getElementById('nccrRemark').value || '').trim();
    var pkgs = Array.prototype.map.call(document.querySelectorAll('.nccr-pkg:checked'), function (x) { return x.value; });
    var errEl = document.getElementById('nccrPkgErr');
    if (!pkgs.length) { if (errEl) errEl.textContent = '请至少勾选一项上报内容'; toast('请至少勾选一项上报内容', 'error'); return; }
    if (errEl) errEl.textContent = '';
    var exist = nccrData.byRegistry(registry, year);
    if (exist && isOpen(exist)) { toast('该登记处 ' + year + ' 年度已有进行中批次 ' + exist.id, 'error'); nccrOpenDetail(exist.id); return; }
    var reg = registryByCode(registry) || { name: registry, cases: 0, sent: 0 };
    var id = 'NCCR-JX-' + year + '-' + nccrData.nextSeq(year);
    var b = nccrData.add({
      id: id, year: Number(year), registry: registry, registryName: reg.name,
      packages: pkgs, transport: transport, templateVersion: nccrConfig.templateVersion,
      state: '待上报', compliance: '', caseCount: reg.cases, sentCount: reg.sent, issues: [],
      fileName: '', fileHash: '', createdAt: nowStr(), createdBy: '省级上报岗',
      exportedAt: '', receiptNo: '', receiptResult: '', receiptRemark: '', receiptAt: '',
      remoteRef: '', riskAck: null, popGap: '', revisionOf: exist && exist.state === '已退回' ? exist.id : '', remark: remark
    });
    toast('已创建 ' + id);
    nccrState.fromPage = 'nccr-new'; nccrState.page = 'nccr-new';
    nccrState.view = 'detail'; nccrState.selectedId = b.id;
    window.nccrCheck(b.id);
  };

  window.nccrCheck = function (id) {
    var b = nccrData.get(id);
    if (!b) return;
    if (b.state !== '待上报') { toast('该批次已投递，不可重新校验', 'error'); return; }
    nccrSetLoading(true, '合规校验中…');
    setTimeout(function () {
      runCheck(b);
      nccrSetLoading(false);
      nccrState.view = 'detail'; nccrState.selectedId = id;
      var msg = b.compliance === 'pass' ? '合规，可以上报' : b.compliance === 'warn' ? '存在风险，需确认后才能上报' : '不合规，需整改后重新校验';
      toast(msg, b.compliance === 'pass' ? '' : 'error');
      nccrRefresh();
    }, 600);
  };

  window.nccrAckRisk = function (id) {
    var b = nccrData.get(id);
    if (!b || b.compliance !== 'warn' || b.state !== '待上报') return;
    var ov = document.createElement('div');
    ov.className = 'cd-overlay nccr-modal'; ov.style.zIndex = '10000';
    ov.innerHTML = '<div class="cd-dialog" style="max-width:520px"><div class="cd-header"><span>风险确认上报</span><span class="cd-close" onclick="this.closest(\'.cd-overlay\').remove()">×</span></div>' +
      '<div class="cd-body"><p style="margin:0 0 12px;font-size:13px;color:#475467">本批判定为有风险，继续上报需填写放行原因。</p>' +
      '<div class="form-group"><label>放行原因 <span class="required">*</span></label><textarea id="nccrAckReason" rows="3" placeholder="如：已完成补核，同意带风险报送"></textarea></div>' +
      '<div class="cd-field-error" id="nccrAckErr">请填写放行原因</div></div>' +
      '<div class="cd-header" style="border-top:1px solid #e2e8f0;border-bottom:0;justify-content:flex-end;gap:8px">' +
      '<button class="btn btn-ghost btn-sm" onclick="this.closest(\'.cd-overlay\').remove()">取消</button>' +
      '<button class="btn btn-warning btn-sm" id="nccrAckSave">确认</button></div></div>';
    document.body.appendChild(ov);
    document.getElementById('nccrAckSave').onclick = function () {
      var reason = document.getElementById('nccrAckReason').value.trim();
      if (!reason) { document.getElementById('nccrAckErr').style.display = 'block'; return; }
      b.riskAck = { by: '省级上报岗', reason: reason, at: nowStr() };
      ov.remove(); toast('已确认风险，可以上报'); nccrRefresh();
    };
  };

  window.nccrDeliver = function (id) {
    var b = nccrData.get(id);
    if (!b) return;
    if (!canDeliver(b)) { toast('当前状态不可上报', 'error'); return; }
    showConfirm('确认上报', '将生成「' + packageLabel(b.packages) + '」文件（模板 ' + b.templateVersion + '），方式：' + transportLabel(b.transport) + '。<br>病例明细含个人信息，仅限授权用途。', function () {
      window.nccrDownload(id);
      var ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14);
      b.fileName = '41_' + b.registry + '_' + b.year + '_' + b.packages.join('') + '_' + b.templateVersion + '_' + ts + '.csv';
      b.fileHash = hashStub(b.fileName + b.id);
      b.exportedAt = nowStr();
      b.state = '已上报';
      runCheck(b);
      if (b.transport === 'http') { b.remoteRef = 'REMOTE-' + ts; toast('已模拟在线推送，单号 ' + b.remoteRef); }
      else if (b.transport === 'sftp') toast('已模拟上传到文件服务器');
      else toast('文件已下载，请登录国家平台手工导入');
      nccrState.view = 'detail'; nccrState.selectedId = id;
      nccrRefresh();
    });
  };

  window.nccrDownload = function (id) {
    var b = nccrData.get(id);
    if (!b) return;
    var p = b.packages || [];
    if (p.indexOf('A') >= 0) downloadCsv('A_发病个案_' + b.id + '.csv', A_HEADERS, sampleARows(b));
    if (p.indexOf('B') >= 0) setTimeout(function () { downloadCsv('B_死亡随访_' + b.id + '.csv', B_HEADERS, sampleBRows(b)); }, 200);
    if (p.indexOf('C') >= 0) setTimeout(function () { downloadCsv('C_人口_' + b.id + '.csv', C_HEADERS, sampleCRows(b)); }, 400);
    if (p.indexOf('D') >= 0) setTimeout(function () { downloadCsv('D_质量报告_' + b.id + '.csv', D_HEADERS, sampleDRows(b)); }, 600);
  };

  // 单包导出：详情页"上报数据明细"里按数据包单独导出
  window.nccrDownloadPkg = function (id, code) {
    var b = nccrData.get(id);
    if (!b) return;
    if ((b.packages || []).indexOf(code) < 0) { toast('该批次未含 ' + code + ' 包', 'error'); return; }
    var map = {
      A: ['A_发病个案_' + b.id + '.csv', A_HEADERS, sampleARows(b)],
      B: ['B_死亡随访_' + b.id + '.csv', B_HEADERS, sampleBRows(b)],
      C: ['C_人口_' + b.id + '.csv', C_HEADERS, sampleCRows(b)],
      D: ['D_质量报告_' + b.id + '.csv', D_HEADERS, sampleDRows(b)]
    };
    var m = map[code];
    if (!m) return;
    downloadCsv(m[0], m[1], m[2]);
    toast('已导出 ' + code + ' 包（' + m[2].length + ' 行）');
  };

  window.nccrDownloadTemplate = function () {
    var v = nccrConfig.nationalVersion;
    var packs = [
      ['A_发病个案', A_HEADERS, '报告卡个案'],
      ['B_死亡随访', B_HEADERS, '随访死亡'],
      ['C_人口', C_HEADERS, '人口数据'],
      ['D_质量报告', D_HEADERS, '质量报告']
    ];
    packs.forEach(function (p, i) {
      setTimeout(function () { downloadCsv(p[0] + '_' + v + '.csv', p[1], []); }, i * 200);
    });
    var dict = [];
    packs.forEach(function (p) { p[1].forEach(function (h) { dict.push([p[2], h]); }); });
    setTimeout(function () { downloadCsv('字段说明_' + v + '.csv', ['上报内容', '中文列名'], dict); }, packs.length * 200);
    toast('已下载空白模板（4 个上报内容 + 字段说明）');
  };

  window.nccrReceipt = function (id) {
    var b = nccrData.get(id);
    if (!b || b.state !== '已上报') return;
    var ov = document.createElement('div');
    ov.className = 'cd-overlay nccr-modal'; ov.style.zIndex = '10000';
    ov.innerHTML = '<div class="cd-dialog" style="max-width:520px"><div class="cd-header"><span>登记国家回执</span><span class="cd-close" onclick="this.closest(\'.cd-overlay\').remove()">×</span></div>' +
      '<div class="cd-body"><div class="form-grid">' +
      '<div class="form-group"><label>回执号 <span class="required">*</span></label><input id="nccrReceiptNo" value="' + e(b.remoteRef || ('NCCR-R-' + fmtDate(new Date()).replace(/-/g, '') + '-' + b.id.slice(-2))) + '"></div>' +
      '<div class="form-group"><label>受理结果</label><select id="nccrReceiptResult"><option value="accepted">全部受理</option><option value="partial">部分受理</option><option value="rejected">退回</option></select></div>' +
      '<div class="form-group full"><label>国家说明</label><textarea id="nccrReceiptRemark" rows="3"></textarea></div>' +
      '</div></div>' +
      '<div class="cd-header" style="border-top:1px solid #e2e8f0;border-bottom:0;justify-content:flex-end;gap:8px">' +
      '<button class="btn btn-ghost btn-sm" onclick="this.closest(\'.cd-overlay\').remove()">取消</button>' +
      '<button class="btn btn-primary btn-sm" id="nccrReceiptSave">保存</button></div></div>';
    document.body.appendChild(ov);
    document.getElementById('nccrReceiptSave').onclick = function () {
      var no = document.getElementById('nccrReceiptNo').value.trim();
      if (!no) { toast('请填写回执号', 'error'); return; }
      b.receiptNo = no;
      b.receiptResult = document.getElementById('nccrReceiptResult').value;
      b.receiptRemark = document.getElementById('nccrReceiptRemark').value.trim();
      b.receiptAt = nowStr();
      b.state = b.receiptResult === 'rejected' ? '已退回' : '已完成';
      ov.remove();
      toast(b.state === '已完成' ? '上报完成，已记入上报记录' : '已记为国家退回');
      nccrState.view = 'list'; nccrState.selectedId = null;
      navigateTo('nccr-records');
    };
  };

  window.nccrRedo = function (id) {
    var src = nccrData.get(id);
    if (!src) return;
    var reg = registryByCode(src.registry) || { name: src.registry, cases: 0, sent: 0 };
    var nid = 'NCCR-JX-' + src.year + '-' + nccrData.nextSeq(src.year);
    var b = nccrData.add({
      id: nid, year: src.year, registry: src.registry, registryName: reg.name,
      packages: src.packages.slice(), transport: src.transport, templateVersion: nccrConfig.templateVersion,
      state: '待上报', compliance: '', caseCount: reg.cases, sentCount: reg.sent, issues: [],
      fileName: '', fileHash: '', createdAt: nowStr(), createdBy: '省级上报岗',
      exportedAt: '', receiptNo: '', receiptResult: '', receiptRemark: '', receiptAt: '',
      remoteRef: '', riskAck: null, popGap: '', revisionOf: src.id, remark: '由 ' + src.id + ' 重报'
    });
    toast('已生成重报批次 ' + nid);
    nccrState.fromPage = 'nccr-new'; nccrState.page = 'nccr-new';
    nccrState.view = 'detail'; nccrState.selectedId = b.id;
    window.nccrCheck(b.id);
  };

  window.nccrVoid = function (id) {
    var b = nccrData.get(id);
    if (!b || b.state !== '待上报') { toast('只有待上报的批次可以取消', 'error'); return; }
    showConfirm('取消批次', '确定取消 ' + id + ' 吗？取消后记入上报记录。', function () {
      var bb = nccrData.get(id);
      bb.state = '已取消'; bb.voidAt = nowStr();
      toast('已取消');
      nccrState.view = 'list'; nccrState.selectedId = null;
      navigateTo('nccr-records');
    });
  };

  window.nccrExportRecords = function () {
    var list = filteredRecords();
    downloadCsv('国家上报台账_' + new Date().toISOString().slice(0, 10) + '.csv',
      ['批次号', '统计年', '登记处', '上报内容', '应报例数', '上报时间', '方式', '回执号', '受理结果', '状态', '模板版本', '文件校验码'],
      list.map(function (b) {
        return [b.id, b.year, b.registryName, packageLabel(b.packages), b.caseCount, b.exportedAt || '',
          transportLabel(b.transport), b.receiptNo || '', (RECEIPT[b.receiptResult] || ['', ''])[1], b.state, b.templateVersion, b.fileHash || ''];
      }));
    toast('已导出 ' + list.length + ' 条台账');
  };

  window.nccrExportCompliance = function () {
    var rows = complianceRows(nccrState.year);
    var head = ['统计年', '肿瘤登记处', '应报例数', '实报例数', '病例上报率%', '覆盖', '时效', '质量', '格式模板', '国家受理', '综合结论', '批次号', '批次状态'];
    var label = { ok: '合规', warn: '有风险', bad: '不合规', na: '未评估' };
    downloadCsv('上报合规性_' + nccrState.year + '_' + new Date().toISOString().slice(0, 10) + '.csv', head,
      rows.map(function (x) {
        var d = x.dims;
        return [nccrState.year, x.reg.name, x.reg.cases, x.reg.sent, x.reg.cover.toFixed(1),
          label[d.cover.tone], label[d.timely.tone], label[d.quality.tone], label[d.format.tone], label[d.accept.tone],
          label[d.overall], x.batch ? x.batch.id : '', x.batch ? x.batch.state : '未生成批次'];
      }));
    toast('已导出 ' + rows.length + ' 个登记处的合规清单');
  };

  /* ===================== 17. 系统配置 · 平台上报 ===================== */
  window.renderNccrPlatformConfigTab = function () {
    var c = nccrConfig;
    return '<div class="nccr-grid-2" style="max-width:900px">' +
      '<div class="form-group"><label>国家现行模板版本</label><input id="nccrCfgNational" value="' + e(c.nationalVersion) + '"></div>' +
      '<div class="form-group"><label>本平台默认模板版本</label><input id="nccrCfgTpl" value="' + e(c.templateVersion) + '"></div>' +
      '<div class="form-group"><label>报送时限（诊断年后月数）</label><input id="nccrCfgMonths" type="number" value="' + c.timelinessMonths + '"></div>' +
      '<div class="form-group"><label>默认报送方式</label><select id="nccrCfgTransport">' +
      '<option value="file"' + (c.defaultTransport === 'file' ? ' selected' : '') + '>下载文件</option>' +
      '<option value="http"' + (c.defaultTransport === 'http' ? ' selected' : '') + '>在线推送</option>' +
      '<option value="sftp"' + (c.defaultTransport === 'sftp' ? ' selected' : '') + '>文件服务器</option></select></div>' +
      '<div class="form-group"><label>启用在线推送</label><select id="nccrCfgHttp"><option value="1"' + (c.httpEnabled ? ' selected' : '') + '>是</option><option value="0"' + (!c.httpEnabled ? ' selected' : '') + '>否</option></select></div>' +
      '<div class="form-group"><label>国家平台接口地址</label><input id="nccrCfgUrl" value="' + e(c.httpBaseUrl) + '"></div>' +
      '</div>' +
      '<div style="margin-top:16px;display:flex;gap:8px">' +
      '<button class="btn btn-primary btn-sm" onclick="nccrSaveConfig()">保存</button>' +
      '<button class="btn btn-outline btn-sm" onclick="nccrDownloadTemplate()">下载空白模板</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="navigateTo(\'dict-quality\')">质量阈值见字典管理</button></div>';
  };

  window.nccrSaveConfig = function () {
    nccrConfig.nationalVersion = document.getElementById('nccrCfgNational').value.trim() || nccrConfig.nationalVersion;
    nccrConfig.templateVersion = document.getElementById('nccrCfgTpl').value.trim() || nccrConfig.nationalVersion;
    nccrConfig.timelinessMonths = Number(document.getElementById('nccrCfgMonths').value) || 30;
    nccrConfig.defaultTransport = document.getElementById('nccrCfgTransport').value;
    nccrConfig.httpEnabled = document.getElementById('nccrCfgHttp').value === '1';
    nccrConfig.httpBaseUrl = document.getElementById('nccrCfgUrl').value.trim();
    nccrState.form.transport = nccrConfig.defaultTransport;
    toast('平台上报配置已保存');
  };

  /* ===================== 18. 菜单与路由 ===================== */
  var CHILDREN = [
    { id: 'nccr-new', label: '新增上报' },
    { id: 'nccr-records', label: '上报记录' },
    { id: 'nccr-compliance', label: '上报合规性' }
  ];
  var PAGE_IDS = CHILDREN.map(function (c) { return c.id; });
  var ALIAS = {
    'data-report': 'nccr-new', 'nccr-list': 'nccr-new', 'nccr-preview': 'nccr-compliance',
    'nccr-compare': 'nccr-compliance', 'nccr-quality': 'nccr-compliance'
  };
  function normalizeId(id) { return ALIAS[id] || id; }

  function ensureMenu() {
    if (typeof menuData === 'undefined') return;
    var item = menuData.filter(function (m) { return m.id === 'nccr'; })[0];
    if (!item) {
      var idx = menuData.findIndex(function (m) { return m.id === 'analysis'; });
      item = { id: 'nccr', label: '国家肿瘤数据上报', icon: '●', children: CHILDREN };
      if (idx >= 0) menuData.splice(idx + 1, 0, item); else menuData.push(item);
    } else {
      item.children = CHILDREN;
    }
    menuData.forEach(function (m) {
      if (!m.children) return;
      m.children = m.children.filter(function (c) { return c.id !== 'data-report'; });
    });
  }
  ensureMenu();
  if (document.getElementById('sidebarMenu') && document.getElementById('sidebarMenu').children.length) {
    var act = (document.querySelector('.menu-item.active') || {}).dataset;
    act = act && act.id;
    var sm = document.getElementById('sidebarMenu');
    sm.innerHTML = '';
    buildMenu(menuData, sm);
    if (act) setActiveMenu(act);
  }

  var baseNav = navigateTo;
  navigateTo = function (id) {
    id = normalizeId(id);
    if (PAGE_IDS.indexOf(id) >= 0) { nccrState.page = id; nccrState.view = 'list'; nccrState.selectedId = null; }
    baseNav(id);
  };

  var sysCfgTab = 'platform';
  window.nccrSysCfgTab = function (tab) { sysCfgTab = tab; renderPage('system-config'); };

  function renderSystemConfigPage() {
    var tabs = [{ id: 'platform', label: '平台上报' }, { id: 'general', label: '一般设置' }];
    var tabHtml = '<div class="report-data-tabs" role="tablist" style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:16px">' +
      tabs.map(function (t) {
        var on = sysCfgTab === t.id;
        return '<button class="report-data-tab' + (on ? ' active' : '') + '" style="appearance:none;border:0;background:transparent;padding:11px 16px;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2px solid ' + (on ? 'var(--primary)' : 'transparent') + ';color:' + (on ? 'var(--primary)' : '#667085') + '" onclick="nccrSysCfgTab(\'' + t.id + '\')">' + t.label + '</button>';
      }).join('') + '</div>';
    var body = sysCfgTab === 'platform'
      ? renderNccrPlatformConfigTab()
      : '<div style="color:#667085;font-size:14px">一般系统参数仍由原系统配置维护。</div>';
    return '<div class="panel"><div class="panel-body">' + tabHtml + body + '</div></div>';
  }

  var baseRender = renderPage;
  renderPage = function (id) {
    id = normalizeId(id);
    if (PAGE_IDS.indexOf(id) >= 0) {
      nccrState.page = id;
      document.getElementById('pageContainer').innerHTML = renderPageContent();
      setActiveMenu(id);
      var mi = document.querySelector('.menu-item[data-id="' + id + '"]');
      if (mi) {
        var sub = mi.parentElement && mi.parentElement.parentElement;
        if (sub && sub.classList.contains('submenu')) {
          sub.classList.add('open');
          var head = sub.previousElementSibling;
          if (head && head.classList.contains('menu-item')) head.classList.add('expanded');
        }
      }
      if (typeof updateBreadcrumb === 'function') updateBreadcrumb(id, nccrState.view === 'detail' ? '批次详情' : null);
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
})();
