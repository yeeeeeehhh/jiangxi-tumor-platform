/*
 * 质控规则配置模块（结构化模板版）
 * 预置校验模板 + 参数配置，全下拉选择，非技术人员可直接操作
 */
(function () {
  'use strict';

  /* 规则分组与六大绩效指标一一对应（配与看闭环）。
   * 旧九分类里 MDT/远程会诊/人群纳管/病案首页格式/报告卡单卡(身份证/电话/报卡时序/MV/DCO)
   * 等字段级规则，按条线归属移出到登记条线（报告卡质量监测·审核质控 / 预警模块），
   * 本页只保留「六大绩效判定规则」。 */
  var OWNED_IDS = ['qc-p1', 'qc-p2', 'qc-p3', 'qc-p4', 'qc-p5', 'qc-p6'];

  var CATEGORIES = [
    { id: 'qc-p1', label: '首次治疗前临床分期评估率' },
    { id: 'qc-p2', label: '首次非手术治疗前病理学诊断率' },
    { id: 'qc-p3', label: '术后病理 TNM 分期率' },
    { id: 'qc-p4', label: '围手术期死亡率' },
    { id: 'qc-p5', label: '首次靶向/免疫治疗前分子病理检测率' },
    { id: 'qc-p6', label: '术中淋巴结清扫规范率' }
  ];

  /* 各组的达标线口径与对应国考指标（来源：《三级公立医院绩效考核操作手册》肿瘤专业）。
     适用癌种不在此硬编，统一从 qcSpine 的 L1_IND[].cancers 取，保证与绩效页同源。 */
  var GROUP_META = {
    'qc-p1': { line: '≥ 86.4%', ind: 'NQ-01' },
    'qc-p2': { line: '≥ 91.2%', ind: 'NQ-02' },
    'qc-p3': { line: '≥ 88.7%', ind: 'NQ-03' },
    'qc-p4': { line: '≤ 0.42%', ind: 'NQ-04' },
    'qc-p5': { line: '≥ 79.5%', ind: 'NQ-05' },
    'qc-p6': { line: '≥ 84.1%', ind: 'NQ-06' }
  };
  /* 组 → 适用癌种（读数据脊柱，避免两处口径漂移） */
  function cancersOfGroup(catId) {
    var S = window.qcSpine;
    var meta = GROUP_META[catId] || {};
    var i = S && S.ind && meta.ind ? S.ind(meta.ind) : null;
    if (!i) return '—';
    return i.cancers.map(function (c) { return S.cancer(c).name; }).join('、') + '（' + i.cancers.length + ' 个）';
  }

  /* ==================== 校验模板 & 字段字典 ==================== */
  var TEMPLATES = [
    { id: 'required', label: '字段必填', needValue: false },
    { id: 'dict', label: '值在字典范围内', needValue: true, valueLabel: '允许值（逗号分隔）' },
    { id: 'date_not_before', label: '日期不早于另一字段', needValue: true, valueLabel: '参照字段' },
    { id: 'date_not_after', label: '日期不晚于另一字段', needValue: true, valueLabel: '参照字段' },
    { id: 'range', label: '数值范围', needValue: true, valueLabel: '范围（如 0-120）' },
    { id: 'regex', label: '格式正则校验', needValue: true, valueLabel: '正则表达式' },
    { id: 'cross', label: '两字段交叉校验', needValue: true, valueLabel: '关联字段' },
    { id: 'time_within', label: '时限内完成（X 小时/日）', needValue: true, valueLabel: '时限（如 8小时 / 48小时）', hasUnit: true },
    { id: 'threshold_gt', label: '阈值超过告警（>）', needValue: true, valueLabel: '阈值', hasUnit: true },
    { id: 'threshold_lt', label: '阈值低于告警（<）', needValue: true, valueLabel: '阈值', hasUnit: true }
  ];

  var FIELD_MAP = {
    'qc-p1': ['临床分期', '分期评估日期', '首次治疗日期', '诊断日期'],
    'qc-p2': ['病理诊断', '病理报告日期', '首次治疗日期', '病理诊断术语', '形态学编码', '部位编码'],
    'qc-p3': ['pTNM分期', 'T分期', 'N分期', 'M分期', 'AJCC版本'],
    'qc-p4': ['出院去向', '死亡日期', '手术日期', '首次病程记录时间', '入院时间'],
    'qc-p5': ['分子检测结果', '检测日期', '首次用药日期'],
    'qc-p6': ['清扫淋巴结数目', '病理检出数', '手术记录']
  };

  var SEVERITIES = [
    { id: 'block', label: '强拦截' },
    { id: 'warn', label: '弱提示' },
    { id: 'log', label: '仅记录' }
  ];

  function getTpl(id) { return TEMPLATES.find(function (t) { return t.id === id; }) || TEMPLATES[0]; }
  function getFieldLabel(catId, field) { return field || ''; }
  function getTplLabel(tplId) { var t = getTpl(tplId); return t ? t.label : tplId; }
  function getSevLabel(sevId) { var s = SEVERITIES.find(function (x) { return x.id === sevId; }); return s ? s.label : sevId; }

  /* 自动生成规则描述 */
  function autoDesc(category, targetField, tplId, checkValue, errorMsg) {
    var catLabel = '';
    CATEGORIES.forEach(function (c) { if (c.id === category) catLabel = c.label; });
    var tpl = getTpl(tplId);
    var desc = catLabel + '：' + targetField + '须满足【' + tpl.label + '】';
    if (tpl.needValue && checkValue) desc += '，参数为"' + checkValue + '"';
    if (errorMsg) desc += '。提示：' + errorMsg;
    return desc;
  }

  /* 每条规则附带对应的国考规则码（用于质控问题中心命中统计），如为空则直接按 rule.id 匹配 */
  function relForRule(rule) {
    if (rule.rel) return rule.rel;
    var match = { 'qc-p1': 'QC-L1-001', 'qc-p2': 'QC-L1-002', 'qc-p3': 'QC-L1-003',
      'qc-p4': 'QC-L1-004', 'qc-p5': 'QC-L1-005', 'qc-p6': 'QC-L1-006' }[rule.category];
    return match || rule.id;
  }

  /* ==================== 样式 ==================== */
  var style = document.createElement('style');
  style.textContent = '\
#pageContainer .qcr-page{display:block;min-height:calc(100vh - 120px)}\
#pageContainer .qcr-main{padding:0}\
#pageContainer .qcr-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}\
#pageContainer .qcr-title{font-size:16px;font-weight:700;color:#1e293b}\
#pageContainer .qcr-toolbar{display:flex;flex-wrap:wrap;gap:10px 12px;align-items:flex-end;padding:12px 14px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;margin-bottom:12px}\
#pageContainer .qcr-field{display:flex;flex-direction:column;gap:5px;min-width:0}\
#pageContainer .qcr-field.kw{flex:1 1 200px;min-width:160px}\
#pageContainer .qcr-field-label{font-size:12px;color:#667085}\
#pageContainer .qcr-field select,#pageContainer .qcr-field input:not([type=checkbox]):not([type=radio]){height:34px;padding:0 10px;border:1px solid var(--border);border-radius:4px;background:#fff;font-size:13px;color:#1e293b;min-width:130px;box-sizing:border-box}\
#pageContainer .qcr-field.kw input{min-width:0;width:100%}\
#pageContainer .qcr-field select:focus,#pageContainer .qcr-field input:focus{outline:none;border-color:var(--primary)}\
#pageContainer .qcr-field-actions{display:flex;gap:8px;align-items:flex-end}\
#pageContainer .qcr-tblwrap{overflow:auto;border:1px solid var(--border);border-radius:6px;background:#fff}\
#pageContainer .qcr-tbl{width:100%;min-width:960px;border-collapse:collapse}\
#pageContainer .qcr-tbl th{height:40px;padding:0 11px;text-align:left;background:#f8fafc;color:#5b6673;font-size:12px;font-weight:600;border-bottom:1px solid var(--border);white-space:nowrap}\
#pageContainer .qcr-tbl td{height:46px;padding:7px 11px;border-bottom:1px solid var(--border);color:#334155;font-size:13px;vertical-align:middle}\
#pageContainer .qcr-tbl tbody tr:hover{background:#f5f9ff}\
#pageContainer .qcr-link{background:none;border:0;padding:0;color:var(--primary);font-weight:600;font-size:13px;cursor:pointer}\
#pageContainer .qcr-link:hover{text-decoration:underline}\
#pageContainer .qcr-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 4px 2px;font-size:12px;color:#64748b}\
#pageContainer .qcr-pager{display:inline-flex;align-items:center;gap:6px}\
#pageContainer .qcr-pager-cur{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 6px;border-radius:4px;background:var(--primary);color:#fff;font-weight:600}\
#pageContainer .qcr-empty{padding:40px;text-align:center;color:#94a3b8;font-size:13px}\
#pageContainer .qcr-switch{position:relative;display:inline-block;width:38px;height:20px;flex:none}\
#pageContainer .qcr-switch input{opacity:0;width:0;height:0}\
#pageContainer .qcr-switch i{position:absolute;top:0;left:0;right:0;bottom:0;background:#cbd5e1;border-radius:20px;transition:.2s;cursor:pointer}\
#pageContainer .qcr-switch i:before{content:"";position:absolute;left:2px;top:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:.2s}\
#pageContainer .qcr-switch input:checked+i{background:var(--primary)}\
#pageContainer .qcr-switch input:checked+i:before{transform:translateX(18px)}\
.qcr-modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:1200;padding:24px}\
.qcr-modal-mask .qcr-modal{background:#fff;border-radius:8px;width:min(720px,100%);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 45px rgba(15,23,42,.25)}\
.qcr-modal-mask .qcr-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e2e8f0}\
.qcr-modal-mask .qcr-modal-title{font-size:15px;font-weight:700;color:#1e293b}\
.qcr-modal-mask .qcr-close{background:none;border:0;font-size:22px;line-height:1;color:#94a3b8;cursor:pointer}\
.qcr-modal-mask .qcr-modal-body{padding:15px 16px;overflow:auto}\
.qcr-modal-mask .qcr-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #e2e8f0;background:#fbfcfe}\
.qcr-modal-mask .qcr-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px 14px}\
.qcr-modal-mask .qcr-form-item{display:flex;flex-direction:column;gap:5px}\
.qcr-modal-mask .qcr-form-item label{font-size:12px;color:#667085}\
.qcr-modal-mask .qcr-form-item input,.qcr-modal-mask .qcr-form-item select,.qcr-modal-mask .qcr-form-item textarea{height:36px;padding:0 10px;border:1px solid #e2e8f0;border-radius:4px;font-size:13px;color:#1e293b;box-sizing:border-box;font-family:inherit;background:#fff}\
.qcr-modal-mask .qcr-form-item textarea{height:60px;padding:8px 10px;resize:vertical}\
.qcr-modal-mask .required{color:#dc2626}\
';
  document.head.appendChild(style);

  /* ==================== 工具函数 ==================== */
  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  var TONE = {
    '启用': 'success', '已启用': 'success',
    '停用': 'info', '已停用': 'info',
    '观察': 'warning',
    '强拦截': 'danger', '弱提示': 'warning', '仅记录': 'info'
  };
  function sb(s) { return '<span class="badge badge-' + (TONE[s] || 'info') + '">' + esc(s) + '</span>'; }

  /* ==================== 状态 ==================== */
  var state = { category: 'qc-p1', filters: {}, page: {} };

  /* ==================== 规则数据（结构化）====================
   * 设计原则（对应 附录_全站指标审计.md 第 8 节整改）：
   *   1. 不再硬编码 hitCount / fixRate（旧版两列纯造，无统计期、无分子分母、
   *      不可下钻）。命中数改为从质控问题中心 window.qcSpine.problems() 按规则号
   *      实时统计（statHitOf），带统计期；统计不到就显示"—"，不出假数。
   *   2. 阈值类规则（threshold_gt/lt）带单位 unit 与依据 basis，默认值统一对齐
   *      预警引擎 warning-module.js 口径（MV≥66 / DCO≤15），废弃原 QC 的 70 / 5 双标。
   *   3. 时限类规则（病程 8 小时、会诊 48 小时）改用 time_within 模板承载时限参数，
   *      不再只写在提示语文本里。 */
  var RULES = [
    /* —— qc-p1 首次治疗前临床分期评估率（QC-L1-001） —— */
    { id: 'R-P1-01', category: 'qc-p1', rel: 'QC-L1-001', name: '临床分期非空', targetField: '临床分期', tplId: 'required', checkValue: '', severity: 'block', errorMsg: '首次治疗前须完成临床分期评估，字段不得为空', status: '启用', period: '2026年度' },
    { id: 'R-P1-02', category: 'qc-p1', rel: 'QC-L1-001', name: '分期评估时间不晚于首次治疗', targetField: '分期评估日期', tplId: 'date_not_after', checkValue: '首次治疗日期', severity: 'block', errorMsg: '临床分期须在首次抗肿瘤治疗前完成', status: '启用', period: '2026年度' },
    /* —— qc-p2 首次非手术治疗前病理学诊断率（QC-L1-002） —— */
    { id: 'R-P2-01', category: 'qc-p2', rel: 'QC-L1-002', name: '病理诊断非空', targetField: '病理诊断', tplId: 'required', checkValue: '', severity: 'block', errorMsg: '首次非手术治疗前须取得病理学诊断', status: '启用', period: '2026年度' },
    { id: 'R-P2-02', category: 'qc-p2', rel: 'QC-L1-002', name: '病理报告不晚于首次治疗', targetField: '病理报告日期', tplId: 'date_not_after', checkValue: '首次治疗日期', severity: 'block', errorMsg: '病理报告日期须不晚于首次非手术治疗日期', status: '启用', period: '2026年度' },
    { id: 'R-P2-03', category: 'qc-p2', rel: 'QC-L1-002', name: '病理诊断术语规范', targetField: '病理诊断术语', tplId: 'dict', checkValue: 'ICD-O形态学字典', severity: 'warn', errorMsg: '病理诊断须使用 ICD-O 标准术语', status: '启用', period: '2026年度' },
    /* —— qc-p3 术后病理 TNM 分期率（QC-L1-003） —— */
    { id: 'R-P3-01', category: 'qc-p3', rel: 'QC-L1-003', name: 'pTNM 三项完整', targetField: 'pTNM分期', tplId: 'required', checkValue: '', severity: 'block', errorMsg: '术后病理报告须含 pT、pN、pM 三项分期', status: '启用', period: '2026年度' },
    { id: 'R-P3-02', category: 'qc-p3', rel: 'QC-L1-003', name: 'T 分期字典校验', targetField: 'T分期', tplId: 'dict', checkValue: 'T0,T1,T2,T3,T4,Tis,Tx', severity: 'block', errorMsg: 'T 分期取值不在合法范围内', status: '启用', period: '2026年度' },
    /* —— qc-p4 围手术期死亡率（QC-L1-004） —— */
    { id: 'R-P4-01', category: 'qc-p4', rel: 'QC-L1-004', name: '出院去向非空', targetField: '出院去向', tplId: 'required', checkValue: '', severity: 'block', errorMsg: '围手术期病例须完整记录出院去向，用于判定生存状态', status: '启用', period: '2026年度' },
    { id: 'R-P4-02', category: 'qc-p4', rel: 'QC-L1-004', name: '死亡日期不早于手术日期', targetField: '死亡日期', tplId: 'date_not_before', checkValue: '手术日期', severity: 'block', errorMsg: '死亡日期不得早于手术日期', status: '启用', period: '2026年度' },
    { id: 'R-P4-03', category: 'qc-p4', rel: 'QC-L1-004', name: '首次病程记录时限', targetField: '首次病程记录时间', tplId: 'time_within', checkValue: '8', unit: '小时', refField: '入院时间', severity: 'block', errorMsg: '首次病程记录须在入院 8 小时内完成', status: '启用', period: '2026年度' },
    /* —— qc-p5 首次靶向/免疫治疗前分子病理检测率（QC-L1-005） —— */
    { id: 'R-P5-01', category: 'qc-p5', rel: 'QC-L1-005', name: '分子检测结果非空', targetField: '分子检测结果', tplId: 'required', checkValue: '', severity: 'block', errorMsg: '首次靶向/免疫治疗前须完成分子病理检测', status: '启用', period: '2026年度' },
    { id: 'R-P5-02', category: 'qc-p5', rel: 'QC-L1-005', name: '检测日期不晚于首次用药', targetField: '检测日期', tplId: 'date_not_after', checkValue: '首次用药日期', severity: 'block', errorMsg: '分子检测须在首次靶向/免疫治疗用药前完成', status: '启用', period: '2026年度' },
    /* —— qc-p6 术中淋巴结清扫规范率（QC-L1-006） —— */
    { id: 'R-P6-01', category: 'qc-p6', rel: 'QC-L1-006', name: '清扫数目非空', targetField: '清扫淋巴结数目', tplId: 'required', checkValue: '', severity: 'block', errorMsg: '清扫淋巴结数目须完整填写', status: '启用', period: '2026年度' },
    { id: 'R-P6-02', category: 'qc-p6', rel: 'QC-L1-006', name: '清扫数目达标', targetField: '清扫淋巴结数目', tplId: 'range', checkValue: '12-99', severity: 'warn', errorMsg: '清扫淋巴结数目须达到癌种规范要求下限', status: '启用', period: '2026年度' }
  ];

  /* 规则命中数：从质控问题中心（window.qcSpine.problems()）按规则号实时统计。
   * 取不到脊柱（脚本未加载）或该规则无对应问题时返回 null → 界面显示"—"，
   * 绝不硬造数字。阈值类聚合规则本身没有"逐条命中"语义，返回 null。 */
  function statHitOf(rule) {
    if (rule.tplId === 'threshold_gt' || rule.tplId === 'threshold_lt') return null;
    var S = window.qcSpine;
    if (!S || typeof S.problems !== 'function') return null;
    try {
      var ps = S.problems();
      var hit = 0;
      var rel = relForRule(rule);
      ps.forEach(function (p) {
        var code = (p.rule && p.rule.code) || '';
        if (code === rel) hit++;
      });
      return hit;   /* 可能为 0，0 与 null 语义不同：0=统计到但无命中 */
    } catch (e) { return null; }
  }

  /* 自动补齐 description */
  RULES.forEach(function (r) { r.description = autoDesc(r.category, r.targetField, r.tplId, r.checkValue, r.errorMsg); });

  /* ==================== 弹窗 ==================== */
  function qcrModal(title, body, footHtml) {
    var mask = document.createElement('div');
    mask.className = 'qcr-modal-mask';
    mask.innerHTML = '<div class="qcr-modal"><div class="qcr-modal-head"><div class="qcr-modal-title">' + esc(title) + '</div><button class="qcr-close" aria-label="关闭">&times;</button></div><div class="qcr-modal-body">' + body + '</div>' + (footHtml ? '<div class="qcr-modal-foot">' + footHtml + '</div>' : '') + '</div>';
    mask.addEventListener('click', function (e) { if (e.target === mask) mask.remove(); });
    mask.querySelector('.qcr-close').addEventListener('click', function () { mask.remove(); });
    document.body.appendChild(mask);
    return mask;
  }
  function closeModals() { document.querySelectorAll('.qcr-modal-mask').forEach(function (m) { m.remove(); }); }

  function openRuleForm(rule) {
    var isEdit = !!rule;
    var catOpts = CATEGORIES.map(function (c) { return '<option value="' + c.id + '"' + ((rule && rule.category === c.id) || (!rule && state.category === c.id) ? ' selected' : '') + '>' + c.label + '</option>'; }).join('');
    var tplOpts = TEMPLATES.map(function (t) { return '<option value="' + t.id + '"' + (rule && rule.tplId === t.id ? ' selected' : '') + '>' + t.label + '</option>'; }).join('');
    var sevOpts = SEVERITIES.map(function (s) { return '<option value="' + s.id + '"' + (rule && rule.severity === s.id ? ' selected' : '') + '>' + s.label + '</option>'; }).join('');

    var curCat = rule ? rule.category : state.category;
    var fields = FIELD_MAP[curCat] || [];
    var fieldOpts = fields.map(function (f) { return '<option' + (rule && rule.targetField === f ? ' selected' : '') + '>' + f + '</option>'; }).join('');

    var curTpl = getTpl(rule ? rule.tplId : 'required');
    var cvDisplay = curTpl.needValue ? '' : ' style="display:none"';

    var body = '<div class="qcr-form">' +
      '<div class="qcr-form-item"><label>规则编号 <span class="required">*</span></label><input id="qf-id" value="' + esc(rule ? rule.id : '') + '" placeholder="如 R-H07"' + (isEdit ? ' readonly style="background:#f1f5f9"' : '') + '></div>' +
      '<div class="qcr-form-item"><label>所属质控域 <span class="required">*</span></label><select id="qf-category" onchange="window._qcrRebuildFields()">' + catOpts + '</select></div>' +
      '<div class="qcr-form-item"><label>规则名称 <span class="required">*</span></label><input id="qf-name" value="' + esc(rule ? rule.name : '') + '"></div>' +
      '<div class="qcr-form-item"><label>校验字段 <span class="required">*</span></label><select id="qf-field">' + fieldOpts + '</select></div>' +
      '<div class="qcr-form-item"><label>校验类型 <span class="required">*</span></label><select id="qf-tpl" onchange="window._qcrToggleCv()">' + tplOpts + '</select></div>' +
      '<div class="qcr-form-item" id="qf-cv-wrap"' + cvDisplay + '><label id="qf-cv-label">' + esc(curTpl.valueLabel || '校验值') + '</label><input id="qf-cv" value="' + esc(rule ? rule.checkValue : '') + '"></div>' +
      '<div class="qcr-form-item"><label>拦截级别 <span class="required">*</span></label><select id="qf-severity">' + sevOpts + '</select></div>' +
      '<div class="qcr-form-item"><label>状态</label><select id="qf-status">' + ['启用', '停用', '观察'].map(function (s) { return '<option' + (rule && rule.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
      '<div class="qcr-form-item" style="grid-column:1/-1"><label>错误提示语</label><textarea id="qf-error" placeholder="触发时给用户的提示文案">' + esc(rule ? rule.errorMsg : '') + '</textarea></div>' +
      '</div>';

    var mask = qcrModal(isEdit ? '编辑质控规则' : '新增质控规则', body,
      '<button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" data-save>保存</button>');

    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });

    window._qcrRebuildFields = function () {
      var cat = mask.querySelector('#qf-category').value;
      var fs = FIELD_MAP[cat] || [];
      var sel = mask.querySelector('#qf-field');
      sel.innerHTML = fs.map(function (f) { return '<option>' + f + '</option>'; }).join('');
    };

    window._qcrToggleCv = function () {
      var tpl = getTpl(mask.querySelector('#qf-tpl').value);
      var wrap = mask.querySelector('#qf-cv-wrap');
      var lbl = mask.querySelector('#qf-cv-label');
      if (tpl.needValue) {
        wrap.style.display = '';
        lbl.textContent = tpl.valueLabel || '校验值';
      } else {
        wrap.style.display = 'none';
        mask.querySelector('#qf-cv').value = '';
      }
    };

    mask.querySelector('[data-save]').addEventListener('click', function () {
      var vals = {
        id: mask.querySelector('#qf-id').value.trim(),
        category: mask.querySelector('#qf-category').value,
        name: mask.querySelector('#qf-name').value.trim(),
        targetField: mask.querySelector('#qf-field').value,
        tplId: mask.querySelector('#qf-tpl').value,
        checkValue: mask.querySelector('#qf-cv').value.trim(),
        severity: mask.querySelector('#qf-severity').value,
        status: mask.querySelector('#qf-status').value,
        errorMsg: mask.querySelector('#qf-error').value.trim()
      };
      if (!vals.id || !vals.name) { toast('请填写规则编号和规则名称', 'error'); return; }
      if (!vals.targetField) { toast('请选择校验字段', 'error'); return; }
      vals.description = autoDesc(vals.category, vals.targetField, vals.tplId, vals.checkValue, vals.errorMsg);
      if (isEdit) {
        Object.keys(vals).forEach(function (k) { rule[k] = vals[k]; });
      } else {
        vals.period = '2026年度';
        RULES.push(vals);
      }
      mask.remove();
      renderInto(state.category);
      toast(isEdit ? '规则已更新' : '规则已新增');
    });
  }

  /* ==================== 查询 / 翻页 ==================== */
  function getFilteredRules(catId) {
    var f = state.filters[catId] || {};
    var p = state.page[catId] || 1;
    var list = RULES.filter(function (r) {
      if (r.category !== catId) return false;
      if (f.tplId && f.tplId !== 'ALL' && r.tplId !== f.tplId) return false;
      if (f.severity && f.severity !== 'ALL' && r.severity !== f.severity) return false;
      if (f.status && f.status !== 'ALL' && r.status !== f.status) return false;
      if (f.kw) {
        var kw = f.kw.toLowerCase();
        if ([r.id, r.name, r.targetField, r.errorMsg].join(' ').toLowerCase().indexOf(kw) < 0) return false;
      }
      return true;
    });
    var total = list.length;
    var perPage = 10;
    var maxPage = Math.max(1, Math.ceil(total / perPage));
    if (p > maxPage) p = maxPage;
    state.page[catId] = p;
    var start = (p - 1) * perPage;
    return { list: list.slice(start, start + perPage), total: total, page: p, maxPage: maxPage };
  }

  function setFilter(catId, key, val) {
    if (!state.filters[catId]) state.filters[catId] = {};
    state.filters[catId][key] = val;
    state.page[catId] = 1;
  }

  /* ==================== 操作 ==================== */
  window.qcrToggle = function (id) {
    var r = RULES.find(function (x) { return x.id === id; });
    if (!r) return;
    r.status = r.status === '启用' ? '停用' : '启用';
    renderInto(state.category);
    toast(r.status === '启用' ? '已启用「' + r.name + '」' : '已停用「' + r.name + '」');
  };
  window.qcrDelete = function (id) {
    var r = RULES.find(function (x) { return x.id === id; });
    if (!r) return;
    var doDel = function () {
      var idx = RULES.indexOf(r);
      if (idx >= 0) RULES.splice(idx, 1);
      renderInto(state.category);
      toast('已删除规则「' + r.name + '」');
    };
    if (window.showConfirm) showConfirm('删除确认', '确定删除规则「' + r.name + '」吗？', doDel);
    else doDel();
  };
  window.qcrEdit = function (id) { var r = RULES.find(function (x) { return x.id === id; }); if (r) openRuleForm(r); };
  window.qcrAdd = function () { openRuleForm(null); };
  window.qcrSwitchCat = function (catId) { state.category = catId; renderInto(catId); };
  window.qcrSetFilter = function (catId, key, val) { setFilter(catId, key, val); };
  window.qcrQuery = function (catId) { renderInto(catId); };
  window.qcrReset = function (catId) { state.filters[catId] = {}; state.page[catId] = 1; renderInto(catId); };
  window.qcrGoPage = function (catId, p) { state.page[catId] = p; renderInto(catId); };

  /* ==================== 渲染 ==================== */
  function renderToolbar(catId) {
    var f = state.filters[catId] || {};
    function sel(key, label, opts) {
      var cur = f[key] || 'ALL';
      var o = [['ALL', '全部']].concat(opts.map(function (x) { return [x.id || x, x.label || x]; }));
      return '<div class="qcr-field"><span class="qcr-field-label">' + label + '</span><select onchange="qcrSetFilter(\'' + catId + '\',\'' + key + '\',this.value)">' + o.map(function (x) { return '<option value="' + x[0] + '"' + (cur === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>';
    }
    var kwVal = f.kw || '';
    return '<div class="qcr-toolbar">' +
      sel('tplId', '校验类型', TEMPLATES) +
      sel('severity', '拦截级别', SEVERITIES) +
      sel('status', '状态', [{ id: '启用', label: '启用' }, { id: '停用', label: '停用' }, { id: '观察', label: '观察' }]) +
      '<div class="qcr-field kw"><span class="qcr-field-label">搜索</span><input value="' + esc(kwVal) + '" placeholder="规则编号 / 名称 / 字段" onchange="qcrSetFilter(\'' + catId + '\',\'kw\',this.value)"></div>' +
      '<div class="qcr-field qcr-field-actions"><button class="btn btn-primary btn-sm" onclick="qcrQuery(\'' + catId + '\')">查询</button><button class="btn btn-ghost btn-sm" onclick="qcrReset(\'' + catId + '\')">重置</button></div>' +
      '</div>';
  }

  function renderTable(catId) {
    var result = getFilteredRules(catId);
    var list = result.list;
    var rows = list.map(function (r) {
      var switchHtml = '<label class="qcr-switch"><input type="checkbox"' + (r.status === '启用' ? ' checked' : '') + ' onchange="qcrToggle(\'' + r.id + '\')"><i></i></label>';
      /* 命中数：实时从问题中心统计，取不到显示"—"（不硬造）。阈值类聚合规则无逐条命中。 */
      var hit = statHitOf(r);
      var hitCell = (r.tplId === 'threshold_gt' || r.tplId === 'threshold_lt')
        ? '<span title="聚合指标阈值监测，无逐条命中记录，达标情况见③登记质控总览" style="color:#94a3b8;cursor:help">聚合监测</span>'
        : (hit == null ? '<span style="color:#cbd5e1">—</span>' : String(hit));
      /* 校验值：阈值类带单位，时限类带单位与参照字段 */
      var cv = r.checkValue || '';
      if ((r.tplId === 'threshold_gt' || r.tplId === 'threshold_lt') && cv) cv = cv + (r.unit || '');
      else if (r.tplId === 'time_within' && cv) cv = cv + (r.unit || '') + '（自' + (r.refField || '起点') + '）';
      var basisIcon = r.basis ? ' <span title="' + esc(r.basis) + '" style="cursor:help;color:#94a3b8">ⓘ</span>' : '';
      return '<tr>' +
        '<td><button class="qcr-link" onclick="qcrEdit(\'' + r.id + '\')">' + esc(r.id) + '</button></td>' +
        '<td>' + esc(r.name) + '</td>' +
        '<td>' + esc(r.targetField) + '</td>' +
        '<td>' + esc(getTplLabel(r.tplId)) + '</td>' +
        '<td>' + (cv ? esc(cv) : '-') + basisIcon + '</td>' +
        '<td>' + sb(getSevLabel(r.severity)) + '</td>' +
        '<td class="num">' + hitCell + '</td>' +
        '<td>' + esc(r.period || '—') + '</td>' +
        '<td>' + switchHtml + '</td>' +
        '<td><button class="qcr-link" onclick="qcrEdit(\'' + r.id + '\')">编辑</button> <button class="qcr-link" style="color:#dc2626" onclick="qcrDelete(\'' + r.id + '\')">删除</button></td>' +
        '</tr>';
    }).join('');

    var pager = '';
    if (result.maxPage > 1) {
      var btns = '';
      for (var i = 1; i <= result.maxPage; i++) {
        if (i === result.page) btns += '<span class="qcr-pager-cur">' + i + '</span>';
        else btns += '<button class="btn btn-ghost btn-xs" onclick="qcrGoPage(\'' + catId + '\',' + i + ')">' + i + '</button>';
      }
      pager = '<div class="qcr-foot"><span>共 ' + result.total + ' 条规则</span><span class="qcr-pager">' + btns + '</span></div>';
    } else {
      pager = '<div class="qcr-foot"><span>共 ' + result.total + ' 条规则</span><span></span></div>';
    }

    return renderToolbar(catId) +
      '<div class="qcr-tblwrap"><table class="qcr-tbl"><thead><tr>' +
      '<th>规则编号</th><th>规则名称</th><th>校验字段</th><th>校验类型</th><th>校验值</th><th>拦截级别</th><th class="num">命中数</th><th>统计期</th><th>启停</th><th>操作</th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="10"><div class="qcr-empty">暂无符合条件的规则</div></td></tr>') + '</tbody></table></div>' + pager;
  }

  function renderQCPage(pageId) {
    /* 'qc-rules' 是菜单三入口之一（规则配置主入口），落到当前/首个规则组；
       传入具体组 id（qc-p1…qc-p6）时切换分组；旧分类 id 一律回落到当前分组。 */
    if (pageId === 'qc-rules') {
      if (OWNED_IDS.indexOf(state.category) < 0) state.category = OWNED_IDS[0];
    } else if (OWNED_IDS.indexOf(pageId) >= 0) {
      state.category = pageId;
    }
    var catLabel = '';
    CATEGORIES.forEach(function (c) { if (c.id === state.category) catLabel = c.label; });
    var meta = GROUP_META[state.category] || {};
    var catTabs = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px">' + CATEGORIES.map(function (c) {
      var on = c.id === state.category;
      return '<button class="btn ' + (on ? 'btn-primary' : 'btn-ghost') + ' btn-sm" onclick="qcrSwitchCat(\'' + c.id + '\')">' + esc(c.label) + '</button>';
    }).join('') + '</div>';
    return '<div class="qcr-page">' +
      '<div class="qcr-main">' +
      '<div class="qcr-head"><div class="qcr-title">质控规则配置 · ' + esc(catLabel) + '</div><div><button class="btn btn-primary btn-sm" onclick="qcrAdd()">新增规则</button></div></div>' +
      '<div style="font-size:12.5px;color:#64748b;margin:-6px 0 12px">对应绩效指标达标线 <b>' + esc(meta.line || '—') + '</b>（来源：《三级公立医院绩效考核操作手册》肿瘤专业）。<br>' +
      '<b>适用癌种</b>：' + esc(cancersOfGroup(state.category)) + ' —— 本组规则对该范围内癌种统一生效；达标线作用于指标合计率，分癌种结果作短板定位。命中数取自质控问题中心。</div>' +
      catTabs +
      renderTable(state.category) +
      '</div></div>';
  }

  function renderInto(catId) {
    closeModals();
    if (catId) state.category = catId;
    var box = document.getElementById('pageContainer');
    if (!box) return;
    box.innerHTML = renderQCPage(state.category);
    try { box.scrollTop = 0; } catch (e) {}
    try { if (window.autoSizeSelects) window.autoSizeSelects(); } catch (e) {}
  }

  /* ==================== 对外暴露 ==================== */
  window.renderQCPage = renderQCPage;
  window.qcPageIds = OWNED_IDS.slice();
})();
