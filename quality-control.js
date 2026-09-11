/*
 * 质控规则配置模块（结构化模板版）
 * 预置校验模板 + 参数配置，全下拉选择，非技术人员可直接操作
 */
(function () {
  'use strict';

  var OWNED_IDS = [
    'qc-homepage', 'qc-confirmed', 'qc-pathology', 'qc-tnm', 'qc-course',
    'qc-mdt', 'qc-remote', 'qc-cohort', 'qc-global'
  ];

  var CATEGORIES = [
    { id: 'qc-homepage', label: '病案首页质控' },
    { id: 'qc-confirmed', label: '确诊病例质控' },
    { id: 'qc-pathology', label: '病理信息质控' },
    { id: 'qc-tnm', label: 'TNM分期质控' },
    { id: 'qc-course', label: '专病病程质控' },
    { id: 'qc-mdt', label: 'MDT多学科诊疗质控' },
    { id: 'qc-remote', label: '远程会诊质控' },
    { id: 'qc-cohort', label: '人群纳管与分组质控' },
    { id: 'qc-global', label: '全域数据质控与绩效监测' }
  ];

  /* ==================== 校验模板 & 字段字典 ==================== */
  var TEMPLATES = [
    { id: 'required', label: '字段必填', needValue: false },
    { id: 'dict', label: '值在字典范围内', needValue: true, valueLabel: '允许值（逗号分隔）' },
    { id: 'date_not_before', label: '日期不早于另一字段', needValue: true, valueLabel: '参照字段' },
    { id: 'date_not_after', label: '日期不晚于另一字段', needValue: true, valueLabel: '参照字段' },
    { id: 'range', label: '数值范围', needValue: true, valueLabel: '范围（如 0-120）' },
    { id: 'regex', label: '格式正则校验', needValue: true, valueLabel: '正则表达式' },
    { id: 'cross', label: '两字段交叉校验', needValue: true, valueLabel: '关联字段' },
    { id: 'threshold_gt', label: '阈值超过告警（>）', needValue: true, valueLabel: '阈值' },
    { id: 'threshold_lt', label: '阈值低于告警（<）', needValue: true, valueLabel: '阈值' }
  ];

  var FIELD_MAP = {
    'qc-homepage': ['主要诊断编码', '身份证号', '出院日期', '入院日期', '手术操作编码', '性别', '年龄', '联系电话'],
    'qc-confirmed': ['确诊依据', '确诊日期', '报卡日期', 'ICD编码', '诊断名称', '原发部位'],
    'qc-pathology': ['病理诊断术语', '部位编码', '形态学编码', 'ER', 'PR', 'HER2', 'Ki-67'],
    'qc-tnm': ['TNM模板版本', 'T分期', 'N分期', 'M分期', 'AJCC版本'],
    'qc-course': ['首次病程记录时间', '入院时间', '术前小结内容', '手术指征', '拟施术式', '风险评估'],
    'qc-mdt': ['申请学科列表', 'MDT结论结构', 'TNM分期'],
    'qc-remote': ['专家职称', '受邀机构', '反馈时间', '会诊排定时间'],
    'qc-cohort': ['高危标准条件', '干预策略', '分组标识'],
    'qc-global': ['MV%', 'DCO%', '病案首页合格率']
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
  var state = { category: 'qc-homepage', filters: {}, page: {} };

  /* ==================== Mock 规则数据（结构化） ==================== */
  var RULES = [
    { id: 'R-H01', category: 'qc-homepage', name: '主要诊断编码必填校验', targetField: '主要诊断编码', tplId: 'required', checkValue: '', severity: 'block', errorMsg: '主要诊断 ICD-10 编码不得为空', status: '启用', hitCount: 1248, fixRate: 99.2 },
    { id: 'R-H02', category: 'qc-homepage', name: '身份证号格式校验', targetField: '身份证号', tplId: 'regex', checkValue: '^\\d{17}[\\dXx]$', severity: 'block', errorMsg: '身份证号码须满足 18 位校验位算法', status: '启用', hitCount: 856, fixRate: 98.7 },
    { id: 'R-H03', category: 'qc-homepage', name: '出院日期不得早于入院日期', targetField: '出院日期', tplId: 'date_not_before', checkValue: '入院日期', severity: 'block', errorMsg: '出院日期不能早于入院日期', status: '启用', hitCount: 342, fixRate: 97.1 },
    { id: 'R-H04', category: 'qc-homepage', name: '手术操作编码与诊断匹配', targetField: '手术操作编码', tplId: 'cross', checkValue: '主要诊断编码', severity: 'warn', errorMsg: '手术操作编码应与主要诊断存在合理关联', status: '启用', hitCount: 189, fixRate: 88.4 },
    { id: 'R-H05', category: 'qc-homepage', name: '年龄与性别交叉校验', targetField: '年龄', tplId: 'cross', checkValue: '性别', severity: 'warn', errorMsg: '年龄与性别不匹配，请核实', status: '启用', hitCount: 67, fixRate: 95.5 },
    { id: 'R-H06', category: 'qc-homepage', name: '联系电话格式校验', targetField: '联系电话', tplId: 'regex', checkValue: '^1\\d{10}$|^0\\d{2,3}-?\\d{7,8}$', severity: 'log', errorMsg: '联系电话格式不正确', status: '观察', hitCount: 213, fixRate: 72.3 },
    { id: 'R-C01', category: 'qc-confirmed', name: '确诊依据必填校验', targetField: '确诊依据', tplId: 'required', checkValue: '', severity: 'block', errorMsg: '确诊依据不得为空', status: '启用', hitCount: 42, fixRate: 92.9 },
    { id: 'R-C02', category: 'qc-confirmed', name: '确诊日期不得晚于报卡日期', targetField: '确诊日期', tplId: 'date_not_after', checkValue: '报卡日期', severity: 'block', errorMsg: '确诊日期不能晚于报卡日期', status: '启用', hitCount: 18, fixRate: 94.4 },
    { id: 'R-C03', category: 'qc-confirmed', name: 'ICD 编码字典校验', targetField: 'ICD编码', tplId: 'dict', checkValue: 'ICD-10标准字典', severity: 'block', errorMsg: 'ICD 编码不在标准字典范围内', status: '启用', hitCount: 28, fixRate: 71.4 },
    { id: 'R-C04', category: 'qc-confirmed', name: '多原发癌双重核算', targetField: '原发部位', tplId: 'cross', checkValue: 'ICD编码', severity: 'warn', errorMsg: '疑似重复统计，请人工复核', status: '观察', hitCount: 9, fixRate: 66.7 },
    { id: 'R-P01', category: 'qc-pathology', name: '病理诊断术语规范', targetField: '病理诊断术语', tplId: 'dict', checkValue: 'ICD-O形态学字典', severity: 'block', errorMsg: '病理诊断须使用 ICD-O 标准术语', status: '启用', hitCount: 258, fixRate: 96.5 },
    { id: 'R-P02', category: 'qc-pathology', name: '部位编码与形态学编码一致性', targetField: '部位编码', tplId: 'cross', checkValue: '形态学编码', severity: 'block', errorMsg: '部位编码与形态学编码不匹配', status: '启用', hitCount: 34, fixRate: 88.2 },
    { id: 'R-P03', category: 'qc-pathology', name: '免疫组化 ER 必填', targetField: 'ER', tplId: 'required', checkValue: '', severity: 'warn', errorMsg: '特定癌种须包含 ER 指标', status: '启用', hitCount: 61, fixRate: 79.4 },
    { id: 'R-T01', category: 'qc-tnm', name: 'TNM 模板适用性校验', targetField: 'TNM模板版本', tplId: 'cross', checkValue: 'AJCC版本', severity: 'block', errorMsg: '所选 TNM 模板与 AJCC 版本不匹配', status: '启用', hitCount: 176, fixRate: 94.3 },
    { id: 'R-T02', category: 'qc-tnm', name: 'T 分期取值范围校验', targetField: 'T分期', tplId: 'dict', checkValue: 'T0,T1,T2,T3,T4,Tis,Tx', severity: 'block', errorMsg: 'T 分期取值不在合法范围内', status: '启用', hitCount: 89, fixRate: 97.8 },
    { id: 'R-B01', category: 'qc-course', name: '首次病程记录时限校验', targetField: '首次病程记录时间', tplId: 'date_not_before', checkValue: '入院时间', severity: 'block', errorMsg: '首次病程记录须在入院 8 小时内完成', status: '启用', hitCount: 312, fixRate: 93.6 },
    { id: 'R-B02', category: 'qc-course', name: '术前小结完整性校验', targetField: '术前小结内容', tplId: 'required', checkValue: '', severity: 'warn', errorMsg: '术前小结缺少核心要素', status: '启用', hitCount: 145, fixRate: 89.0 },
    { id: 'R-M01', category: 'qc-mdt', name: 'MDT 申请学科覆盖度', targetField: '申请学科列表', tplId: 'required', checkValue: '', severity: 'warn', errorMsg: 'MDT 申请须至少包含外科、内科、影像三大学科', status: '启用', hitCount: 96, fixRate: 85.4 },
    { id: 'R-M02', category: 'qc-mdt', name: 'MDT 结论结构化校验', targetField: 'MDT结论结构', tplId: 'required', checkValue: '', severity: 'warn', errorMsg: 'MDT 结论须以结构化字段录入', status: '观察', hitCount: 23, fixRate: 69.6 },
    { id: 'R-R01', category: 'qc-remote', name: '远程会诊专家资质校验', targetField: '专家职称', tplId: 'dict', checkValue: '副主任医师,主任医师', severity: 'block', errorMsg: '受邀专家须具备副主任医师及以上职称', status: '启用', hitCount: 54, fixRate: 98.1 },
    { id: 'R-R02', category: 'qc-remote', name: '会诊反馈时限监控', targetField: '反馈时间', tplId: 'date_not_before', checkValue: '会诊排定时间', severity: 'warn', errorMsg: '受邀机构须在 48 小时内反馈', status: '启用', hitCount: 37, fixRate: 91.9 },
    { id: 'R-N01', category: 'qc-cohort', name: '高危人群纳管标准校验', targetField: '高危标准条件', tplId: 'required', checkValue: '', severity: 'block', errorMsg: '纳管对象须满足高危标准条件', status: '启用', hitCount: 218, fixRate: 96.3 },
    { id: 'R-N02', category: 'qc-cohort', name: '干预策略分配完整性', targetField: '干预策略', tplId: 'required', checkValue: '', severity: 'warn', errorMsg: '已分组人群须绑定干预策略', status: '启用', hitCount: 64, fixRate: 87.5 },
    { id: 'R-G01', category: 'qc-global', name: 'MV% 阈值监测', targetField: 'MV%', tplId: 'threshold_lt', checkValue: '70', severity: 'warn', errorMsg: '病理诊断占比低于 70%，触发预警', status: '启用', hitCount: 12, fixRate: 100 },
    { id: 'R-G02', category: 'qc-global', name: 'DCO% 阈值监测', targetField: 'DCO%', tplId: 'threshold_gt', checkValue: '5', severity: 'warn', errorMsg: '仅死亡证明病例占比超过 5%，触发预警', status: '启用', hitCount: 8, fixRate: 100 },
    { id: 'R-G03', category: 'qc-global', name: '病案首页合格率阈值监测', targetField: '病案首页合格率', tplId: 'threshold_lt', checkValue: '90', severity: 'warn', errorMsg: '病案首页质控合格率低于 90%，触发黄色预警', status: '启用', hitCount: 15, fixRate: 86.7 }
  ];

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
        vals.hitCount = 0;
        vals.fixRate = 0;
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
      return '<tr>' +
        '<td><button class="qcr-link" onclick="qcrEdit(\'' + r.id + '\')">' + esc(r.id) + '</button></td>' +
        '<td>' + esc(r.name) + '</td>' +
        '<td>' + esc(r.targetField) + '</td>' +
        '<td>' + esc(getTplLabel(r.tplId)) + '</td>' +
        '<td>' + esc(r.checkValue || '-') + '</td>' +
        '<td>' + sb(getSevLabel(r.severity)) + '</td>' +
        '<td class="num">' + r.hitCount + '</td>' +
        '<td class="num">' + r.fixRate + '%</td>' +
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
      '<th>规则编号</th><th>规则名称</th><th>校验字段</th><th>校验类型</th><th>校验值</th><th>拦截级别</th><th class="num">触发次数</th><th class="num">修复率</th><th>启停</th><th>操作</th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="10"><div class="qcr-empty">暂无符合条件的规则</div></td></tr>') + '</tbody></table></div>' + pager;
  }

  function renderQCPage(pageId) {
    if (OWNED_IDS.indexOf(pageId) >= 0 && pageId !== state.category) {
      state.category = pageId;
    }
    var catLabel = '';
    CATEGORIES.forEach(function (c) { if (c.id === state.category) catLabel = c.label; });
    return '<div class="qcr-page">' +
      '<div class="qcr-main">' +
      '<div class="qcr-head"><div class="qcr-title">质控规则配置 · ' + esc(catLabel) + '</div><div><button class="btn btn-primary btn-sm" onclick="qcrAdd()">新增规则</button></div></div>' +
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
