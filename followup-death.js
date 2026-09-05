/**
 * 随访信息上传数据层 + 与死亡信息互跳
 * 随访主表 / 死亡=死亡子集视图 / 死因匹配回写
 */
(function () {
  'use strict';

  var CONTACT = ['存活', '死亡', '移居', '失访', '不详'];
  var CHECK = ['未校验', '校验通过', '校验错误'];
  var SOURCES = ['报卡录入', '批量导入', '死因回写', '电话随访', '门诊随访', '入户调查', '被动比对'];

  window.followupRecordState = window.followupRecordState || {
    checkStatus: '', status: '', cardType: '', keyword: '', reportCardId: '', view: 'list'
  };
  window.deathRegFilters = window.deathRegFilters || {
    validation: '全部', exist: '全部', dateType: '死亡日期', keyword: '', view: 'list'
  };
  window.deathInfoState = window.deathInfoState || {
    checkStatus: '', source: '', causeLinked: '', keyword: '', reportCardId: ''
  };
  window.deathCauseState = window.deathCauseState || {
    matchStatus: '', diseaseType: '', keyword: ''
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function badge(text, type) {
    return '<span class="badge badge-' + type + '">' + esc(text) + '</span>';
  }
  function contactBadge(s) {
    if (s === '存活') return badge(s, 'success');
    if (s === '死亡') return badge(s, 'danger');
    if (s === '移居') return badge(s, 'info');
    if (s === '失访') return badge(s, 'warning');
    return badge(s || '不详', 'muted');
  }
  function checkBadge(s) {
    if (s === '校验通过') return badge(s, 'success');
    if (s === '校验错误') return badge(s, 'danger');
    return badge(s || '未校验', 'warning');
  }
  function matchBadge(s) {
    return s === '已匹配' ? badge(s, 'success') : badge(s || '未匹配', 'warning');
  }
  function ageOf(birth) {
    if (!birth) return '-';
    return Math.floor((new Date() - new Date(birth)) / (365.25 * 24 * 3600 * 1000));
  }
  function surMonths(diag, end) {
    if (!diag || !end || end === '-') return '-';
    var m = Math.round((new Date(end) - new Date(diag)) / (30 * 24 * 3600 * 1000));
    return m < 0 ? '-' : m + '月';
  }
  function regionCascader() {
    return typeof renderRegionCascader === 'function' ? renderRegionCascader() : '<input>';
  }
  function opt(list, cur, allLabel) {
    return [''].concat(list).map(function (v) {
      return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' +
        (v || allLabel) + '</option>';
    }).join('');
  }

  function fallbackCards() {
    return [
      { id: 'JX-2026-000091', name: '张伟', sex: '男', birth: '1965-03-12', idNo: '360102196503121234', phone: '13800000001', diagnosisDate: '2026-03-15', site: '肺', icd10: 'C34.9', region: '南昌市东湖区', reportDate: '2026-06-15', doctor: '王医生', reportUnit: '江西省肿瘤医院', cardType: '原始卡', checkStatus: '警告' },
      { id: 'JX-2026-000092', name: '张伟', sex: '男', birth: '1965-03-12', idNo: '360102196503121234', phone: '13800000001', diagnosisDate: '2026-04-20', site: '肺', icd10: 'C34.9', region: '南昌市东湖区', reportDate: '2026-06-13', doctor: '李医生', reportUnit: '南昌大学第一附属医院', cardType: '补报卡', checkStatus: '通过' },
      { id: 'JX-2026-000102', name: '李娜', sex: '女', birth: '1978-08-15', idNo: '360103197808152345', phone: '13700000001', diagnosisDate: '2026-02-20', site: '乳房', icd10: 'C50.9', region: '南昌市西湖区', reportDate: '2026-06-14', doctor: '张医生', reportUnit: '南昌大学第一附属医院', cardType: '原始卡', checkStatus: '通过' },
      { id: 'JX-2026-000118', name: '王强', sex: '男', birth: '1990-02-28', idNo: '360702199002283456', phone: '13600000001', diagnosisDate: '2026-01-15', site: '胃', icd10: 'C16.9', region: '赣州市章贡区', reportDate: '2026-06-12', doctor: '刘医生', reportUnit: '赣州市中心医院', cardType: '补报卡', checkStatus: '错误' },
      { id: 'JX-2026-000125', name: '刘洋', sex: '男', birth: '1988-06-07', idNo: '360104198806074567', phone: '13500000001', diagnosisDate: '2026-04-01', site: '肝', icd10: 'C22.0', region: '南昌市青云谱区', reportDate: '2026-06-10', doctor: '吴医生', reportUnit: '南昌市中心医院', cardType: '补报卡', checkStatus: '通过' },
      { id: 'JX-2026-000133', name: '陈静', sex: '女', birth: '1985-03-25', idNo: '360102198503255678', phone: '13900000005', diagnosisDate: '2026-03-20', site: '结直肠', icd10: 'C18.9', region: '南昌市东湖区', reportDate: '2026-06-08', doctor: '孙医生', reportUnit: '江西省肿瘤医院', cardType: '合并卡', checkStatus: '警告' }
    ];
  }

  function seedFollowupFromCards() {
    var cards = (window.reportCardListData && window.reportCardListData.length)
      ? window.reportCardListData
      : fallbackCards();
    var followMap = window.reportCardFollowup || {};
    // 保证死亡演示卡有完整死因
    if (!followMap['JX-2026-000125'] || followMap['JX-2026-000125'].state !== '死亡') {
      followMap['JX-2026-000125'] = {
        dlc: '2026-06-10', state: '死亡', deadplace: '医院', caus: '肝恶性肿瘤',
        causicd: 'C22.0', deathda: '2026-06-28', deadDoct: '吴医生'
      };
      window.reportCardFollowup = followMap;
    }
    var list = cards.map(function (c) {
      var f = followMap[c.id] || {};
      var status = f.state || '存活';
      var isDead = status === '死亡';
      return {
        id: c.id,
        reportCardId: c.id,
        name: c.name,
        sex: c.sex,
        birth: c.birth,
        idNo: c.idNo,
        phone: c.phone || '-',
        contactName: (c.contactName || (c.name + '的家属')),
        contactPhone: c.contactPhone || '13900000000',
        diagDate: c.diagnosisDate,
        site: c.site,
        icd10: c.icd10,
        region: c.region,
        lastContact: f.dlc || c.reportDate || '-',
        status: status,
        deathDate: isDead ? (f.deathda || '-') : '-',
        cause: isDead ? (f.caus || '-') : '-',
        causeIcd: isDead ? (f.causicd || '-') : '-',
        place: isDead ? (f.deadplace || '-') : '-',
        doctor: f.deadDoct && f.deadDoct !== '-' ? f.deadDoct : (c.doctor || '-'),
        unit: c.reportUnit,
        reportDate: c.reportDate,
        cardType: (c.cardType || '').replace(/<[^>]+>/g, '').trim() || '原始卡',
        checkStatus: isDead && (!f.causicd || f.causicd === '-') ? '校验错误' :
          (String(c.checkStatus || '').indexOf('错误') >= 0 ? '校验错误' :
            String(c.checkStatus || '').indexOf('警告') >= 0 ? '未校验' : '校验通过'),
        source: isDead && f.caus ? '报卡录入' : '报卡录入',
        event: '无',
        reporter: '上报员'
      };
    });

    // 补充演示：失访 / 移居 / 死因回写待核对
    var extras = [
      {
        id: 'JX-2026-000148', reportCardId: 'JX-2026-000148', name: '陈国强', sex: '男', birth: '1968-11-02',
        idNo: '360403196811021122', phone: '13611112222', contactName: '陈国强家属', contactPhone: '13611113333',
        diagDate: '2025-01-25', site: '胃', icd10: 'C16.9', region: '九江市浔阳区',
        lastContact: '2026-05-14', status: '失访', deathDate: '-', cause: '-', causeIcd: '-', place: '-',
        doctor: '王医生', unit: '九江市肿瘤登记中心', reportDate: '2025-02-01', cardType: '原始卡',
        checkStatus: '未校验', source: '电话随访', event: '无', reporter: '王上报员'
      },
      {
        id: 'JX-2026-000156', reportCardId: 'JX-2026-000156', name: '赵敏', sex: '女', birth: '1972-04-18',
        idNo: '360102197204183321', phone: '13722223333', contactName: '赵敏家属', contactPhone: '13722224444',
        diagDate: '2024-09-10', site: '乳腺', icd10: 'C50.9', region: '南昌市东湖区',
        lastContact: '2026-03-01', status: '移居', deathDate: '-', cause: '-', causeIcd: '-', place: '-',
        doctor: '周医生', unit: '南昌市东湖区疾控', reportDate: '2024-09-20', cardType: '原始卡',
        checkStatus: '校验通过', source: '门诊随访', event: '无', reporter: '周上报员'
      },
      {
        id: 'JX-2026-000179', reportCardId: 'JX-2026-000179', name: '王建国', sex: '男', birth: '1959-07-21',
        idNo: '360103195907211234', phone: '13833334444', contactName: '王建国家属', contactPhone: '13833335555',
        diagDate: '2024-11-06', site: '肺', icd10: 'C34.9', region: '南昌市东湖区',
        lastContact: '2026-06-10', status: '死亡', deathDate: '2026-06-28', cause: '肺恶性肿瘤',
        causeIcd: 'C34.9', place: '医院', doctor: '李医生', unit: '南昌市东湖区疾控',
        reportDate: '2024-11-20', cardType: '原始卡', checkStatus: '未校验', source: '死因回写',
        event: '转移', reporter: '系统'
      }
    ];
    extras.forEach(function (e) {
      if (!list.some(function (x) { return x.id === e.id; })) list.push(e);
    });
    return list;
  }

  function ensureFollowupStore() {
    if (window.__fuDeathBizSeeded) {
      return window.followupData;
    }
    var seeded = seedFollowupFromCards();
    if (!Array.isArray(window.followupData)) window.followupData = [];
    // 就地替换，保留 followup-module.js 对同一数组的引用
    window.followupData.length = 0;
    seeded.forEach(function (r) { window.followupData.push(r); });
    window.__fuDeathBizSeeded = true;
    syncCardFollowupMap();
    return window.followupData;
  }

  function syncCardFollowupMap() {
    window.reportCardFollowup = window.reportCardFollowup || {};
    (window.followupData || []).forEach(function (r) {
      var cid = r.reportCardId || r.id;
      window.reportCardFollowup[cid] = {
        dlc: r.lastContact,
        state: r.status,
        deadplace: r.place || '-',
        caus: r.cause || '-',
        causicd: r.causeIcd || '-',
        deathda: r.deathDate || '-',
        deadDoct: r.doctor || '-',
        surmonth: surMonths(r.diagDate, r.status === '死亡' ? r.deathDate : r.lastContact)
      };
    });
  }
  window.syncFollowupToCardArchive = syncCardFollowupMap;
  window.ensureFollowupStore = ensureFollowupStore;

  function alignPlanTasks() {
    var list = window.followupPlanData;
    if (!Array.isArray(list)) return;
    // 若计划仍是旧编号样例，重建为与报告卡/随访主表一致
    if (!list.length || String(list[0].id || '').indexOf('JX-2026') < 0) {
      var data = window.followupData || [];
      var alive = data.filter(function (r) { return r.status === '存活' || r.status === '失访'; });
      var deadPending = data.filter(function (r) { return r.status === '死亡' && r.checkStatus !== '校验通过'; });
      var seeded = [];
      if (deadPending[0]) {
        seeded.push({
          tid: 'FU-D1', id: deadPending[0].id, patient: deadPending[0].name, diag: deadPending[0].site,
          diagDate: deadPending[0].diagDate, region: deadPending[0].region, nextDate: '2026-07-20',
          type: '死亡核实', channel: '被动', method: '被动比对', assignee: '李上报员',
          unit: deadPending[0].unit, status: '待执行', priority: 1
        });
      }
      if (alive[0]) {
        seeded.push({
          tid: 'FU-L1', id: alive[0].id, patient: alive[0].name, diag: alive[0].site,
          diagDate: alive[0].diagDate, region: alive[0].region, nextDate: '2026-06-01',
          type: '失访追踪', channel: '主动', method: '入户调查', assignee: '刘上报员',
          unit: alive[0].unit, status: '逾期', priority: 2
        });
      }
      alive.slice(0, 3).forEach(function (r, i) {
        seeded.push({
          tid: 'FU-A' + (i + 1), id: r.id, patient: r.name, diag: r.site,
          diagDate: r.diagDate, region: r.region, nextDate: '2026-07-' + String(15 + i).padStart(2, '0'),
          type: i === 0 ? '首次随访' : '年度随访', channel: i ? '被动' : '主动',
          method: i ? '被动比对' : '电话随访', assignee: r.reporter || '上报员',
          unit: r.unit, status: '待执行', priority: 3 + i
        });
      });
      list.length = 0;
      seeded.forEach(function (t) { list.push(t); });
    }
  }

  function seedDeathCausePool() {
    if (window.deathCausePool && window.deathCausePool.length) return window.deathCausePool;
    var cards = window.reportCardListData || [];
    var byId = {};
    cards.forEach(function (c) { byId[c.idNo] = c; });
    window.deathCausePool = [
      {
        mid: 'DC-001', name: '刘洋', idNo: '360104198806074567', sex: '男', birth: '1988-06-07',
        region: '南昌市青云谱区', deathDate: '2026-06-28', cause: '肿瘤', causeIcd: 'C22.0', place: '医院',
        diseaseType: '肿瘤', existStatus: '存在', matchStatus: '已匹配',
        linkedCardId: 'JX-2026-000125', importTime: '2026-07-02 09:20', unit: '青云谱区疾控', doctor: '吴医生'
      },
      {
        mid: 'DC-002', name: '王建国', idNo: '360103195907211234', sex: '男', birth: '1959-07-21',
        region: '南昌市东湖区', deathDate: '2026-06-28', cause: '肿瘤', causeIcd: 'C34.9', place: '医院',
        diseaseType: '肿瘤', existStatus: '存在', matchStatus: '未匹配',
        linkedCardId: '', importTime: '2026-07-10 14:05', unit: '东湖区疾控', doctor: '外部'
      },
      {
        mid: 'DC-003', name: '张伟', idNo: '360102196503121234', sex: '男', birth: '1965-03-12',
        region: '南昌市东湖区', deathDate: '2026-07-08', cause: '肿瘤', causeIcd: 'C34.9', place: '家中',
        diseaseType: '肿瘤', existStatus: '存在', matchStatus: '未匹配',
        linkedCardId: '', importTime: '2026-07-12 11:30', unit: '东湖区疾控', doctor: '外部'
      },
      {
        mid: 'DC-004', name: '无名氏甲', idNo: '410888199001011234', sex: '男', birth: '1990-01-01',
        region: '赣州市章贡区', deathDate: '2026-05-20', cause: '其他疾病', causeIcd: 'I21.9', place: '医院',
        diseaseType: '其它疾病', existStatus: '不存在', matchStatus: '未匹配',
        linkedCardId: '', importTime: '2026-07-15 16:40', unit: '章贡区疾控', doctor: '外部'
      },
      {
        mid: 'DC-005', name: '李娜', idNo: '360103197808152345', sex: '女', birth: '1978-08-15',
        region: '南昌市西湖区', deathDate: '2026-07-18', cause: '肿瘤', causeIcd: 'C50.9', place: '疗养院',
        diseaseType: '肿瘤', existStatus: '存在', matchStatus: '未匹配',
        linkedCardId: '', importTime: '2026-07-20 08:55', unit: '西湖区疾控', doctor: '外部'
      }
    ];
    return window.deathCausePool;
  }

  function store() { return ensureFollowupStore(); }
  function deathRows() { return store().filter(function (r) { return r.status === '死亡'; }); }

  function ensureStyles() {
    if (document.getElementById('fu-death-styles')) return;
    var s = document.createElement('style');
    s.id = 'fu-death-styles';
    s.textContent =
      '.fu-biz-hint{background:#f8fafc;border:1px solid #e8eef4;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#475569;line-height:1.55}' +
      '.fu-biz-hint strong{color:#1e293b}' +
      '.fu-modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:4000;display:flex;align-items:center;justify-content:center;padding:20px}' +
      '.fu-modal{background:#fff;border-radius:10px;width:min(720px,96vw);max-height:90vh;overflow:auto;box-shadow:0 20px 50px rgba(15,23,42,.2)}' +
      '.fu-modal-h{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #eef2f7;font-weight:700}' +
      '.fu-modal-b{padding:16px 18px}.fu-modal-f{padding:12px 18px;border-top:1px solid #eef2f7;display:flex;justify-content:flex-end;gap:8px}' +
      '.card-detail-page{background:#f4f7f9;min-height:calc(100vh - 130px)}.card-detail-topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:18px}' +
      '.card-detail-kicker{font-size:13px;color:#66809b;margin-top:5px}.card-detail-title{font-size:24px;line-height:1.2;color:#102a43;font-weight:700}' +
      '.card-detail-actions{display:flex;gap:8px;align-items:center}.card-detail-section-title{font-size:15px;font-weight:700;color:#17324d}' +
      '.card-detail-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px}' +
      '.card-detail-field{display:flex;flex-direction:column;gap:4px;padding:10px 12px;background:#f8fafc;border:1px solid #eef2f7;border-radius:6px}' +
      '.card-detail-field-label{font-size:12px;color:#64748b}.card-detail-field-value{font-size:13px;font-weight:600;color:#1f2937}' +
      '.step-btn:disabled{cursor:default;opacity:1}';
    document.head.appendChild(s);
  }

  function closeBizModal() {
    document.querySelectorAll('.fu-modal-mask').forEach(function (el) { el.remove(); });
  }

  /** 打开报告卡档案 */
  window.openReportCardFromBiz = function (cardId) {
    closeBizModal();
    if ((!window.reportCardListData || !window.reportCardListData.length) && typeof renderReportCardList === 'function') {
      try { renderReportCardList(); } catch (e) { /* ignore */ }
    }
    var cards = window.reportCardListData || [];
    if (!cards.some(function (c) { return c.id === cardId; })) {
      toast('原型中暂无该报告卡档案，已打开报告卡列表', 'warning');
      navigateTo('datamgmt-card');
      return;
    }
    if (typeof cardListDetail === 'function') cardListDetail(cardId);
    else navigateTo('datamgmt-card');
  };

  /** 从报告卡跳到随访 / 死亡模块并带编号过滤 */
  window.jumpToFollowupByCard = function (cardId) {
    window.followupRecordState = window.followupRecordState || {};
    window.followupRecordState.view = 'list';
    window.followupRecordState.reportCardId = cardId || '';
    window.followupRecordState.keyword = cardId || '';
    navigateTo('followup');
  };
  window.jumpToDeathByCard = function (cardId) {
    window.deathInfoState = window.deathInfoState || {};
    window.deathInfoState.reportCardId = cardId || '';
    window.deathInfoState.keyword = cardId || '';
    navigateTo('death-info');
  };
  window.jumpToDeathCause = function () {
    if (typeof openDeathCauseView === 'function') openDeathCauseView();
    else navigateTo('death-info');
  };

  function findRec(id) {
    return store().find(function (x) { return x.id === id || x.reportCardId === id; });
  }

  /** 报告卡第三步「随访报告信息」共享字段（随访添加 / 死因登记添加 / 报卡第三步共用） */
  window.renderFollowupReportFormFields = function (opts) {
    opts = opts || {};
    var p = opts.prefix || 'fuRpt';
    var v = opts.values || {};
    window.followupReportFormMode = opts.requireFollowupDate ? 'followup' : 'other';
    var req = typeof requiredMark === 'function' ? requiredMark() : '<span class="required">*</span>';
    var statusOpts = ['请选择', '存活', '死亡', '移居', '失访', '不详'];
    var placeOpts = ['请选择', '医院', '家中', '其他', '不详'];
    var causeOpts = ['请选择', '肿瘤', '心脑血管疾病', '呼吸系统疾病', '其他'];
    var lostReasonOpts = ['请选择', '电话无法接通', '地址变更无法联系', '拒访', '迁居外地', '其他'];
    function sel(id, label, list, cur) {
      return '<select id="' + p + id + '" data-required="' + label + '">' +
        list.map(function (o) {
          var isPh = o === '请选择';
          var selected = isPh ? (!cur || cur === '-' || cur === '') : (cur === o);
          return '<option' + (selected ? ' selected' : '') + (isPh ? ' value=""' : '') + '>' + o + '</option>';
        }).join('') + '</select>';
    }
    function dateVal(x) {
      return (x && x !== '-') ? esc(x) : '';
    }
    return '<div class="form-grid">' +
      '<div class="form-group"><label>最后接触日期 ' + req + '</label>' +
      '<input type="date" id="' + p + 'LastContact" data-required="最后接触日期" value="' + dateVal(v.lastContact) + '"></div>' +
      '<div class="form-group"><label>最后接触状态 ' + req + '</label>' + sel('Status', '最后接触状态', statusOpts, v.status).replace('<select ', '<select onchange="if(typeof toggleFollowupFormFields===\'function\')toggleFollowupFormFields()" ') + '</div>' +
      '<div class="form-group" data-field="lostReason"><label>失访原因</label>' + sel('LostReason', '失访原因', lostReasonOpts, v.lostReason) + '</div>' +
      '<div class="form-group" data-field="deathPlace"><label>死亡地点 ' + req + '</label>' + sel('Place', '死亡地点', placeOpts, v.place) + '</div>' +
      '<div class="form-group" data-field="deathCause"><label>根本死因 ' + req + '</label>' + sel('Cause', '根本死因', causeOpts, v.cause) + '</div>' +
      '<div class="form-group" data-field="deathIcd"><label>死因ICD10编码 ' + req + '</label>' +
      '<input id="' + p + 'CauseIcd" placeholder="死因ICD10编码" data-required="死因ICD10编码" value="' +
      esc((v.causeIcd && v.causeIcd !== '-') ? v.causeIcd : '') + '"></div>' +
      '<div class="form-group" data-field="deathDate"><label>死亡日期 ' + req + '</label>' +
      '<input type="date" id="' + p + 'DeathDate" data-required="死亡日期" value="' + dateVal(v.deathDate) + '"></div>' +
      '<div class="form-group"><label>死亡报告医师</label>' +
      '<input id="' + p + 'Doctor" placeholder="死亡报告医师" value="' + esc(v.doctor || '') + '"></div>' +
      '</div>';
  };

  window.renderFollowupReportSection = function (opts) {
    opts = opts || {};
    var active = opts.activeSection !== false;
    var sid = opts.sectionId || 'entry-followup';
    return '<section class="entry-section' + (active ? ' active' : '') + '" id="' + sid + '" data-step="2">' +
      '<div class="entry-section-title">随访报告信息</div>' +
      window.renderFollowupReportFormFields(opts) +
      '</section>';
  };

  /** 根据"最后接触状态"动态显隐死亡字段组和失访原因字段（需求§7.2/F-03.02.04） */
  window.toggleFollowupFormFields = function () {
    var statusEl = document.getElementById('fuRptStatus');
    if (!statusEl) return;
    var status = statusEl.value || '';
    var deathFields = ['deathPlace', 'deathCause', 'deathIcd', 'deathDate'];
    deathFields.forEach(function (key) {
      var el = document.querySelector('[data-field="' + key + '"]');
      if (el) el.style.display = (status === '死亡') ? '' : 'none';
    });
    var lostEl = document.querySelector('[data-field="lostReason"]');
    if (lostEl) lostEl.style.display = (status === '失访') ? '' : 'none';
    /* 非死亡时自动清空死亡相关值 */
    if (status !== '死亡') {
      ['fuRptPlace', 'fuRptCause', 'fuRptCauseIcd', 'fuRptDeathDate'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = ''; }
      });
    }
    if (status !== '失访') {
      var lr = document.getElementById('fuRptLostReason');
      if (lr) lr.selectedIndex = 0;
    }
  };

  window.readFollowupReportForm = function (prefix) {
    var p = prefix || 'fuRpt';
    function val(id) {
      var el = document.getElementById(p + id);
      return el ? (el.value || '').trim() : '';
    }
    return {
      followupDate: '',
      lastContact: val('LastContact'),
      status: val('Status'),
      lostReason: val('LostReason'),
      place: val('Place'),
      cause: val('Cause'),
      causeIcd: val('CauseIcd'),
      deathDate: val('DeathDate'),
      doctor: val('Doctor')
    };
  };

  window.validateFollowupReportForm = function (prefix) {
    var data = window.readFollowupReportForm(prefix);
    var missing = [];
    if (!data.lastContact) missing.push('最后接触日期');
    if (!data.status) missing.push('最后接触状态');
    if (data.status === '失访' && !data.lostReason) missing.push('失访原因');
    if (data.status === '死亡') {
      if (!data.place) missing.push('死亡地点');
      if (!data.cause) missing.push('根本死因');
      if (!data.causeIcd) missing.push('死因ICD10编码');
      if (!data.deathDate) missing.push('死亡日期');
      if (data.deathDate && data.lastContact && data.lastContact > data.deathDate) {
        toast('最后接触日期不得晚于死亡日期', 'error');
        return null;
      }
      if (data.deathDate && data.lastContact && data.lastContact !== data.deathDate) toast('死亡日期与最后接触日期不一致，请核对', 'warning');
    } else {
      /* 非死亡：自动清空死亡相关字段（与报告卡 §8.2 / 本模块 §5.3.1 一致） */
      data.place = '';
      data.cause = '';
      data.causeIcd = '';
      data.deathDate = '';
    }
    if (missing.length) {
      toast('请完善必填项：' + missing.join('、'), 'error');
      return null;
    }
    return data;
  };

  window.followupEntryContext = window.followupEntryContext || {
    mode: 'deathReg', followupId: '', backPage: 'death-register'
  };

  window.closeFollowupDetail = function () {
    var back = window._fuDetailBack || 'followup';
    window._fuDetailBack = null;
    navigateTo(back);
  };

  /** 查看随访记录：整页仅展示随访记录列表（字段与登记「随访报告信息」一致） */
  window.followupDetail = function (id) {
    ensureStyles();
    var r = findRec(id);
    if (!r) { toast('未找到随访记录', 'error'); return; }
    closeBizModal();
    window._fuDetailBack = currentPageId() || 'followup';
    if (!Array.isArray(r.events)) {
      r.events = [{
        id: 'EV-' + (r.id || 'X') + '-1',
        lastContact: r.lastContact || r.reportDate || '-',
        status: r.status || '存活',
        place: r.place || '-',
        cause: r.cause || '-',
        causeIcd: r.causeIcd || '-',
        deathDate: r.deathDate || '-',
        doctor: r.doctor || '-'
      }];
    }
    var events = r.events.slice().sort(function (a, b) {
      var da = a.lastContact || a.date || '';
      var db = b.lastContact || b.date || '';
      return String(db).localeCompare(String(da));
    });
    function cell(v) { return esc(v == null || v === '' ? '-' : v); }
    var eventRows = events.map(function (e, i) {
      if (!e.id) e.id = 'EV-' + r.id + '-' + Date.now() + '-' + i;
      var delBtn = (i === 0 && events.length > 1)
        ? '<button class="btn btn-danger btn-xs" onclick="followupDeleteLatestEvent(\'' + esc(r.id) + '\',\'' + esc(e.id) + '\')">删除</button>'
        : '<span style="color:#94a3b8">—</span>';
      return '<tr><td>' + (i + 1) + '</td>' +
        '<td>' + cell(e.lastContact || e.date) + '</td>' +
        '<td>' + contactBadge(e.status) + '</td>' +
        '<td>' + cell(e.place) + '</td>' +
        '<td>' + cell(e.cause) + '</td>' +
        '<td>' + cell(e.causeIcd) + '</td>' +
        '<td>' + cell(e.deathDate) + '</td>' +
        '<td>' + cell(e.doctor) + '</td>' +
        '<td class="sticky-col" style="white-space:nowrap">' + delBtn + '</td></tr>';
    }).join('') || '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">暂无随访记录</td></tr>';
    var actions =
      '<button class="btn btn-ghost btn-sm" onclick="closeFollowupDetail()">返回列表</button>' +
      '<button class="btn btn-primary btn-sm" onclick="followupAddRecord(\'' + esc(r.id) + '\')">添加随访记录</button>';
    var html =
      '<div class="card-detail-page">' +
      '<div class="card-detail-topbar"><div><div class="card-detail-title">查看随访记录</div>' +
      '<div class="card-detail-kicker">' + esc(r.name) + ' · ' + esc(r.id) + ' · ' + contactBadge(r.status) + '</div></div>' +
      '<div class="card-detail-actions">' + actions + '</div></div>' +
      '<div class="panel"><div class="panel-body">' +
      '<div class="card-detail-section-title" style="margin-bottom:12px">随访记录（共 ' + events.length + ' 条）' +
      (events.length > 1 ? '· 仅最新一条可删除' : '') + '</div>' +
      '<div class="table-wrap" style="border:1px solid #e2e8f0;border-radius:6px;overflow:auto">' +
      '<table class="data-table" style="margin:0;min-width:1080px"><thead><tr>' +
      '<th>序号</th><th>最后接触日期</th><th>最后接触状态</th><th>死亡地点</th><th>根本死因</th><th>死因ICD10编码</th><th>死亡日期</th><th>死亡报告医师</th><th class="sticky-col">操作</th>' +
      '</tr></thead><tbody>' + eventRows + '</tbody></table></div>' +
      '</div></div></div>';
    var box = document.getElementById('pageContainer');
    if (box) box.innerHTML = html;
    setActiveMenu(window._fuDetailBack);
    updateBreadcrumb(window._fuDetailBack, '查看随访记录');
    window.scrollTo(0, 0);
  };

  /** 删除最新一条随访记录，并回滚档案当前状态为次新记录 */
  window.followupDeleteLatestEvent = function (recId, eventId) {
    var r = findRec(recId);
    if (!r || !Array.isArray(r.events) || r.events.length <= 1) {
      toast('仅剩一条随访记录时不可删除', 'warning');
      return;
    }
    var sorted = r.events.slice().sort(function (a, b) {
      var da = a.lastContact || a.date || '';
      var db = b.lastContact || b.date || '';
      return String(db).localeCompare(String(da));
    });
    var latest = sorted[0];
    if (!latest || (eventId && latest.id !== eventId)) {
      toast('只能删除最新一条随访记录', 'error');
      return;
    }
    var tipDate = latest.lastContact || latest.date || '-';
    var tipStatus = latest.status || '-';
    showConfirm(
      '删除确认',
      '确定删除最新一条随访记录？\n最后接触日期：' + tipDate + '　状态：' + tipStatus + '\n删除后将回退为上一条随访的当前状态。',
      function () {
        var idx = r.events.indexOf(latest);
        if (idx < 0) idx = r.events.findIndex(function (e) { return e.id === latest.id; });
        if (idx >= 0) r.events.splice(idx, 1);
        var next = r.events.slice().sort(function (a, b) {
          var da = a.lastContact || a.date || '';
          var db = b.lastContact || b.date || '';
          return String(db).localeCompare(String(da));
        })[0];
        if (next) {
          r.lastContact = next.lastContact || next.date || r.lastContact;
          r.status = next.status || r.status;
          r.place = next.place || '-';
          r.cause = next.cause || '-';
          r.causeIcd = next.causeIcd || '-';
          r.deathDate = next.deathDate || '-';
          r.doctor = next.doctor || r.doctor;
        } else {
          r.lastContact = '-';
          r.status = '不详';
          r.place = '-';
          r.cause = '-';
          r.causeIcd = '-';
          r.deathDate = '-';
        }
        syncCardFollowupMap();
        toast('已删除最新随访记录');
        followupDetail(recId);
      }
    );
  };

  /** 添加随访记录：跳转报告卡第三步同款「随访报告信息」整页 */
  window.followupAddRecord = function (id) {
    var r = findRec(id);
    if (!r) { toast('未找到随访档案', 'error'); return; }
    closeBizModal();
    window.followupEntryContext = {
      mode: 'followup',
      followupId: r.id,
      backPage: window._fuDetailBack || currentPageId() || 'followup',
      prefill: {
        lastContact: r.lastContact,
        status: r.status,
        place: r.place,
        cause: r.cause,
        causeIcd: r.causeIcd || r.icd10,
        deathDate: r.deathDate,
        doctor: r.doctor,
        name: r.name,
        idNo: r.idNo,
        sex: r.sex,
        birth: r.birth,
        unit: r.unit,
        region: r.region
      }
    };
    navigateTo('death-entry');
    if (typeof updateBreadcrumb === 'function') {
      updateBreadcrumb(window.followupEntryContext.backPage === 'death-info' ? 'death-info' : 'followup', '添加随访记录');
    }
    if (typeof setActiveMenu === 'function') {
      setActiveMenu(window.followupEntryContext.backPage === 'death-info' ? 'death-info' : 'followup');
    }
  };

  window.followupEdit = function (id) { return followupAddRecord(id); };

  /** 保存随访报告信息到主表 + events */
  window.saveFollowupReportToRecord = function (id, data) {
    var r = findRec(id);
    if (!r) return false;
    if (!Array.isArray(r.events)) r.events = [];

    var histDates = r.events.map(function (e) {
      return e.lastContact || e.date || '';
    }).filter(function (d) { return d && d !== '-'; });
    if (r.lastContact && r.lastContact !== '-') histDates.push(r.lastContact);
    var histMax = histDates.length
      ? histDates.slice().sort(function (a, b) { return String(b).localeCompare(String(a)); })[0]
      : '';
    if (histMax && data.lastContact && data.lastContact < histMax) {
      toast('当前提交的接触日期早于历史最后接触日期（' + histMax + '）', 'error');
      return false;
    }

    r.events.push({
      id: 'EV-' + r.id + '-' + (r.events.length + 1),
      followupDate: data.followupDate || '-',
      lastContact: data.lastContact || '-',
      status: data.status || '-',
      lostReason: data.status === '失访' ? (data.lostReason || '-') : '-',
      place: data.status === '死亡' ? (data.place || '-') : '-',
      cause: data.status === '死亡' ? (data.cause || '-') : '-',
      causeIcd: data.status === '死亡' ? (data.causeIcd || '-') : '-',
      deathDate: data.status === '死亡' ? (data.deathDate || '-') : '-',
      doctor: data.doctor || '-'
    });
    r.followupDate = data.followupDate || r.followupDate || data.lastContact;
    r.lastContact = data.lastContact;
    r.status = data.status;
    r.doctor = data.doctor || r.doctor;
    r.source = '电话随访';
    if (data.status === '死亡') {
      r.deathDate = data.deathDate || '-';
      r.place = data.place || '-';
      r.cause = data.cause || '-';
      r.causeIcd = data.causeIcd || '-';
      r.checkStatus = (!data.causeIcd) ? '校验错误' : '未校验';
      store().forEach(function (x) {
        if (x.idNo && r.idNo && x.idNo === r.idNo && x.id !== r.id) {
          x.status = '死亡';
          x.lastContact = data.lastContact;
          x.deathDate = data.deathDate;
          x.place = data.place;
          x.cause = data.cause;
          x.causeIcd = data.causeIcd;
          x.doctor = data.doctor || x.doctor;
          x.source = '电话随访';
        }
      });
    } else {
      r.deathDate = '-';
      r.place = '-';
      r.cause = '-';
      r.causeIcd = '-';
    }
    syncCardFollowupMap();
    return true;
  };

  window.fuSaveEdit = function () {
    toast('请使用「添加随访记录」整页表单', 'warning');
  };

  window.followupDelete = function (id) {
    showConfirm('删除确认', '确定删除随访档案 ' + id + '？', function () {
      var i = store().findIndex(function (x) { return x.id === id; });
      if (i >= 0) store().splice(i, 1);
      syncCardFollowupMap();
      toast('已删除');
      renderPage('followup');
    });
  };

  window.followupVerify = function (id) {
    var r = findRec(id);
    if (!r) return;
    if (r.status === '死亡' && (!r.causeIcd || r.causeIcd === '-')) {
      r.checkStatus = '校验错误';
      toast('死因ICD缺失，校验错误', 'error');
    } else {
      r.checkStatus = '校验通过';
      toast('核对通过');
    }
    syncCardFollowupMap();
    renderPage(currentPageId() || 'followup');
  };

  function currentPageId() {
    var a = document.querySelector('.menu-item.active');
    return a && a.dataset ? a.dataset.id : '';
  }

  window.fuBatchFilters = window.fuBatchFilters || {
    validation: '全部', exist: '全部', dateType: '上传日期', keyword: ''
  };
  window.fuBatchTempRecords = window.fuBatchTempRecords || [];

  /** 入口：进整页并自动拉起选文件弹窗（下载模板仍在随访列表工具栏） */
  window.followupOpenBatchUpload = function () {
    navigateTo('followup-upload');
    if (typeof setActiveMenu === 'function') setActiveMenu('followup');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('followup', '批量上传');
    setTimeout(function () {
      if (typeof followupBatchOpenImport === 'function') followupBatchOpenImport();
    }, 60);
  };

  /** 随访专用批量模板（与死因模板独立）：Name/Indno/Dlc/State/Deathda/Caus/CausICD10/DeadPlace/DeRepDoct */
  window.downloadFollowupBatchTemplate = function () {
    toast('随访批量模板下载中…（姓名/身份证号/最后接触日期/最后接触状态/死亡日期/根本死因/死因ICD10/死亡地点/报告医生）');
  };

  function visibleFuBatchRows() {
    var f = window.fuBatchFilters || {};
    return (window.fuBatchTempRecords || []).filter(function (r) {
      if (r.validation === '已处理') return false;
      if (f.validation && f.validation !== '全部' && r.validation !== f.validation) return false;
      if (f.exist && f.exist !== '全部' && r.exist !== f.exist) return false;
      if (f.keyword) {
        var kw = f.keyword;
        if ([r.name, r.idNo, r.status, r.cause, r.causeIcd, r.doctor, r.fileName].join(' ').indexOf(kw) < 0) return false;
      }
      return true;
    });
  }

  function fuBatchValidationBadge(v) {
    if (typeof validationBadge === 'function' && v !== '不存在') return validationBadge(v);
    if (v === '通过') return badge('通过', 'success');
    if (v === '警告') return badge('警告', 'warning');
    if (v === '不存在') return badge('不存在', 'warning');
    if (v === '错误') return badge('错误', 'danger');
    return badge(v || '-', 'muted');
  }

  function fuBatchExistBadge(v) {
    if (v === '存在') return badge('存在', 'success');
    if (v === '不存在') return badge('不存在', 'warning');
    return badge(v || '-', 'muted');
  }

  function renderFuBatchTable(rows) {
    /* 列与随访批量模板一致：不携带肿瘤学字段（发病部位/ICD10/确诊日期等） */
    var headers = [
      '校验状态', '存在状态',
      '姓名', '身份证号', '最后接触日期', '最后接触状态', '死亡日期',
      '根本死因', '死因ICD10', '死亡地点', '报告医生',
      '上传日期'
    ];
    var colCount = headers.length + 2;
    var body = rows.length
      ? rows.map(function (r) {
        return '<tr>' +
          '<td><input type="checkbox" ' + (r.checked ? 'checked' : '') +
          ' onchange="followupBatchToggle(' + r.id + ',this.checked)"></td>' +
          '<td>' + fuBatchValidationBadge(r.validation) + '</td>' +
          '<td>' + fuBatchExistBadge(r.exist) + '</td>' +
          '<td>' + esc(r.name) + '</td>' +
          '<td>' + esc(r.idNo) + '</td>' +
          '<td>' + esc(r.lastContact || '-') + '</td>' +
          '<td>' + esc(r.status || '-') + '</td>' +
          '<td>' + esc(r.deathDate || '-') + '</td>' +
          '<td>' + esc(r.cause || '-') + '</td>' +
          '<td>' + esc(r.causeIcd || '-') + '</td>' +
          '<td>' + esc(r.place || '-') + '</td>' +
          '<td>' + esc(r.doctor || '-') + '</td>' +
          '<td>' + esc((r.uploadTime || '').slice(0, 10) || '-') + '</td>' +
          '<td class="sticky-col" style="white-space:nowrap">' +
          '<button class="btn btn-ghost btn-xs" onclick="followupBatchEditRow(' + r.id + ')">编辑</button> ' +
          '<button class="btn btn-danger btn-xs" onclick="followupBatchDeleteOne(' + r.id + ')">删除</button>' +
          '</td></tr>';
      }).join('')
      : '<tr><td colspan="' + colCount + '" style="text-align:center;color:#94a3b8;padding:36px">' +
        '暂无待处理数据，请先选择随访批量模板文件上传　' +
        '<button class="btn btn-primary btn-xs" onclick="followupBatchOpenImport()">选择文件</button>' +
        '</td></tr>';

    return '' +
      '<div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px">' +
      '<div class="table-wrap"><table class="data-table" style="margin:0;min-width:1400px"><thead><tr>' +
      '<th style="width:36px"><input type="checkbox" onchange="followupBatchToggleAll(this.checked)"></th>' +
      headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '<th class="sticky-col">操作</th></tr></thead><tbody>' + body + '</tbody></table></div></div>';
  }

  window.renderFollowupUploadPage = function () {
    ensureStyles();
    ensureFollowupStore();
    var f = window.fuBatchFilters;
    var rows = visibleFuBatchRows();
    var checkedCount = (window.fuBatchTempRecords || []).filter(function (r) {
      return r.checked && r.validation !== '已处理';
    }).length;
    var region = typeof renderRegionCascader === 'function' ? renderRegionCascader() : regionCascader();

    function sel(id, opts, cur, onchange) {
      return '<select id="' + id + '" onchange="' + onchange + '">' +
        opts.map(function (x) {
          return '<option' + (cur === x ? ' selected' : '') + '>' + x + '</option>';
        }).join('') + '</select>';
    }

    var batch = checkedCount > 0
      ? '<div class="void-batch-bar"><div class="void-batch-info">已选择 <strong>' + checkedCount +
        '</strong> 条记录（仅校验「通过 / 警告」且存在匹配的可入库随访主表）</div>' +
        '<div class="void-batch-actions">' +
        '<button class="btn btn-outline btn-sm" onclick="followupBatchExportExcel()">导出 Excel</button>' +
        '<button class="btn btn-primary btn-sm" onclick="followupBatchApplyValidated()">批量上传</button>' +
        '<button class="btn btn-danger btn-sm" onclick="followupBatchDeleteSelected()">批量删除</button>' +
        '</div></div>'
      : '';

    /* 进入本页后不再展示「批量登记 / 模板下载」；模板下载在随访列表工具栏 */
    return '<div class="page-toolbar"><div class="toolbar-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="navigateTo(\'followup\');setActiveMenu(\'followup\');updateBreadcrumb(\'followup\')">← 返回列表</button>' +
      '</div></div>' +
      '<div class="panel"><div class="panel-body">' +
      '<div class="filter-toolbar">' +
      '<div class="form-group region-filter"><label>过滤行政区划</label>' + region + '</div>' +
      '<div class="form-group"><label>存在状态</label>' +
      sel('fuBatchExistFilter', ['全部', '存在', '不存在'], f.exist, 'followupBatchQuery()') + '</div>' +
      '<div class="form-group"><label>校验状态</label>' +
      sel('fuBatchValFilter', ['全部', '通过', '警告', '错误', '不存在'], f.validation, 'followupBatchQuery()') + '</div>' +
      '<div class="form-group search-group"><label>检索内容</label>' +
      '<input id="fuBatchKeyword" placeholder="姓名 / 身份证号" value="' + esc(f.keyword || '') +
      '" onkeydown="if(event.key===\'Enter\')followupBatchQuery()"></div>' +
      '<div class="filter-actions"><button class="btn btn-ghost btn-sm" onclick="followupBatchReset()">重置</button></div>' +
      '</div>' + batch + renderFuBatchTable(rows) +
      '</div></div>';
  };

  window.followupBatchQuery = function () {
    var f = window.fuBatchFilters;
    f.validation = (document.getElementById('fuBatchValFilter') || {}).value || '全部';
    f.exist = (document.getElementById('fuBatchExistFilter') || {}).value || '全部';
    f.keyword = ((document.getElementById('fuBatchKeyword') || {}).value || '').trim();
    renderPage('followup-upload');
    if (typeof setActiveMenu === 'function') setActiveMenu('followup');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('followup', '批量上传');
  };

  window.followupBatchReset = function () {
    window.fuBatchFilters = { validation: '全部', exist: '全部', dateType: '上传日期', keyword: '' };
    (window.fuBatchTempRecords || []).forEach(function (r) { r.checked = false; });
    renderPage('followup-upload');
    if (typeof setActiveMenu === 'function') setActiveMenu('followup');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('followup', '批量上传');
    toast('筛选条件已重置');
  };

  window.followupBatchToggle = function (id, checked) {
    var row = (window.fuBatchTempRecords || []).find(function (r) { return r.id === id; });
    if (row) row.checked = checked;
  };

  window.followupBatchToggleAll = function (checked) {
    visibleFuBatchRows().forEach(function (r) { r.checked = checked; });
    renderPage('followup-upload');
    if (typeof setActiveMenu === 'function') setActiveMenu('followup');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('followup', '批量上传');
  };

  window.followupBatchDeleteOne = function (id) {
    var row = (window.fuBatchTempRecords || []).find(function (r) { return r.id === id; });
    if (row) { row.validation = '已处理'; row.checked = false; }
    renderPage('followup-upload');
    if (typeof setActiveMenu === 'function') setActiveMenu('followup');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('followup', '批量上传');
    toast('临时数据已删除');
  };

  /** 编辑批量行：与「添加随访记录」同一整页（报告卡第三步表单） */
  window.followupBatchEditRow = function (id) {
    var row = (window.fuBatchTempRecords || []).find(function (r) { return r.id === id; });
    if (!row || row.validation === '已处理') {
      toast('未找到该行', 'error');
      return;
    }
    window.followupEntryContext = {
      mode: 'fuBatchEdit',
      batchTempId: row.id,
      followupId: row.matchedId || '',
      backPage: 'followup-upload',
      prefill: {
        lastContact: row.lastContact !== '-' ? row.lastContact : '',
        status: row.status !== '-' ? row.status : '',
        place: row.place !== '-' ? row.place : '',
        cause: row.cause !== '-' ? row.cause : '',
        causeIcd: row.causeIcd !== '-' ? row.causeIcd : '',
        deathDate: row.deathDate !== '-' ? row.deathDate : '',
        doctor: row.doctor || '',
        name: row.name,
        idNo: row.idNo,
        sex: row.sex !== '-' ? row.sex : '',
        birth: row.birth !== '-' ? row.birth : '',
        unit: row.unit !== '-' ? row.unit : ''
      }
    };
    navigateTo('death-entry');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('followup', '编辑批量上传行');
    if (typeof setActiveMenu === 'function') setActiveMenu('followup');
  };

  /** 保存编辑：写回临时行并重新校验，返回批量上传整页 */
  window.followupBatchSaveEdit = function (batchTempId, data) {
    var row = (window.fuBatchTempRecords || []).find(function (r) { return r.id === batchTempId; });
    if (!row) {
      toast('未找到该行', 'error');
      return false;
    }
    var draft = {
      rowNo: row.rowNo,
      name: data.name || row.name,
      idNo: data.idNo || row.idNo,
      lastContact: data.lastContact,
      status: data.status,
      deathDate: data.deathDate || '',
      cause: data.cause || '',
      causeIcd: data.causeIcd || '',
      place: data.place || ''
    };
    var v = validateFollowupUploadRow(draft);
    row.name = v.name;
    row.idNo = v.idNo;
    row.lastContact = v.lastContact;
    row.status = v.status;
    row.deathDate = v.deathDate;
    row.cause = v.cause;
    row.causeIcd = v.causeIcd;
    row.place = v.place;
    row.doctor = data.doctor || row.doctor || '';
    row.validation = v.level;
    row.exist = v.exist;
    row.level = v.level;
    row.checkStatus = v.checkStatus;
    row.error = (v.messages || []).join('；');
    row.matchedId = v.matchedId;
    row.matchedIds = v.matchedIds || [];
    toast('已保存，校验状态：' + v.level);
    navigateTo('followup-upload');
    if (typeof setActiveMenu === 'function') setActiveMenu('followup');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('followup', '批量上传');
    return true;
  };

  window.followupBatchDeleteSelected = function () {
    var sel = (window.fuBatchTempRecords || []).filter(function (r) { return r.checked && r.validation !== '已处理'; });
    if (!sel.length) { toast('请先选择要删除的记录', 'error'); return; }
    showConfirm('批量删除', '确定删除选中的 ' + sel.length + ' 条临时数据？', function () {
      sel.forEach(function (r) { r.validation = '已处理'; r.checked = false; });
      renderPage('followup-upload');
      if (typeof setActiveMenu === 'function') setActiveMenu('followup');
      if (typeof updateBreadcrumb === 'function') updateBreadcrumb('followup', '批量上传');
      toast('已删除 ' + sel.length + ' 条');
    });
  };

  window.followupBatchExportExcel = function () {
    var rows = (window.fuBatchTempRecords || []).filter(function (r) { return r.checked && r.validation !== '已处理'; });
    if (!rows.length) { toast('请先选择要导出的记录', 'error'); return; }
    toast('已导出 ' + rows.length + ' 条记录');
  };

  /** 与报告卡一致：小弹窗仅选文件，确认后落入整页列表 */
  window.followupBatchOpenImport = function () {
    window.fuBatchPickState = { fileName: '' };
    renderFollowupBatchPickDialog();
  };

  function renderFollowupBatchPickDialog() {
    document.querySelectorAll('.bi-overlay').forEach(function (o) { o.remove(); });
    var st = window.fuBatchPickState || { fileName: '' };
    var overlay = document.createElement('div');
    overlay.className = 'bi-overlay';
    overlay.innerHTML =
      '<div class="bi-dialog">' +
      '<div class="bi-header"><span>随访批量上传</span><span class="bi-close" onclick="followupBatchClosePick()">×</span></div>' +
      '<div class="bi-body">' +
      '<div class="bi-upload-zone ' + (st.fileName ? 'has-file' : '') + '" id="fuUploadZone" onclick="document.getElementById(\'fuBatchFileInput\').click()">' +
      '<div class="bi-upload-icon">📄</div>' +
      '<div class="bi-upload-text">' + (st.fileName ? '已选择文件' : '点击或拖拽文件到此处上传') + '</div>' +
      (st.fileName
        ? '<div class="bi-upload-filename">' + esc(st.fileName) + '</div>'
        : '<div class="bi-upload-hint">支持 .xlsx / .xls / .csv；请按模板填写：姓名、身份证号、最后接触日期、最后接触状态、死亡日期、根本死因、死因ICD10、死亡地点、报告医生</div>') +
      '</div>' +
      '<input type="file" id="fuBatchFileInput" style="display:none" accept=".xlsx,.xls,.csv" onchange="followupBatchOnFileSelected(this)">' +
      '</div>' +
      '<div class="bi-footer">' +
      '<button class="btn btn-ghost btn-sm" onclick="followupBatchClosePick()">取消</button>' +
      '<button class="btn btn-primary btn-sm" onclick="followupBatchConfirmParse()" ' +
      (st.fileName ? '' : 'disabled') + '>确定添加</button>' +
      '</div></div>';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) followupBatchClosePick();
    });
    document.body.appendChild(overlay);
  }

  window.followupBatchClosePick = function () {
    document.querySelectorAll('.bi-overlay').forEach(function (o) { o.remove(); });
  };

  window.followupBatchOnFileSelected = function (input) {
    if (!input || !input.files || !input.files[0]) return;
    window.fuBatchPickState = { fileName: input.files[0].name };
    renderFollowupBatchPickDialog();
  };

  window.followupBatchConfirmParse = function () {
    var name = (window.fuBatchPickState && window.fuBatchPickState.fileName) || '';
    if (!name) { toast('请先选择文件', 'error'); return; }
    followupBatchSimulateParse(name);
  };

  /** 匹配键：姓名 + 身份证号；返回全部命中灶（多原发全灶） */
  function findMatchedFollowupsByNameId(name, idNo) {
    var n = String(name || '').trim();
    var id = String(idNo || '').trim();
    if (!n || !id) return [];
    return store().filter(function (x) {
      return String(x.idNo || '').trim() === id && String(x.name || '').trim() === n;
    });
  }

  function followupBatchSimulateParse(fileName) {
    ensureFollowupStore();
    var today = new Date().toISOString().slice(0, 10);
    var uploadTime = new Date().toISOString().slice(0, 16).replace('T', ' ');
    var demos = [
      {
        rowNo: 2, name: '张伟', idNo: '360102196503121234', lastContact: today,
        status: '存活', deathDate: '', cause: '', causeIcd: '', place: '', doctor: '王医生'
      },
      {
        rowNo: 3, name: '李娜', idNo: '360103197808152345', lastContact: '2025-01-01',
        status: '存活', deathDate: '', cause: '', causeIcd: '', place: '', doctor: '李医生'
      },
      {
        rowNo: 4, name: '王强', idNo: '360702199002283456', lastContact: '2026-06-01',
        status: '失访', deathDate: '', cause: '', causeIcd: '', place: '', doctor: '张医生'
      },
      {
        rowNo: 5, name: '刘洋', idNo: '360104198806074567', lastContact: '2026-06-28',
        status: '死亡', deathDate: '2026-06-28', cause: '肝恶性肿瘤', causeIcd: 'C22.0', place: '医院', doctor: '赵医生'
      },
      {
        rowNo: 6, name: '测试缺项', idNo: '360102196503129999', lastContact: '2026-07-01',
        status: '死亡', deathDate: '2026-07-01', cause: '肿瘤', causeIcd: '', place: '医院', doctor: ''
      },
      {
        rowNo: 7, name: '未知患者', idNo: '410199199001011234', lastContact: today,
        status: '存活', deathDate: '', cause: '', causeIcd: '', place: '', doctor: ''
      }
    ];
    var base = Date.now();
    demos.forEach(function (d, i) {
      var v = validateFollowupUploadRow(d);
      window.fuBatchTempRecords.push({
        id: base + i + 1,
        checked: false,
        validation: v.level,
        exist: v.exist,
        name: v.name,
        idNo: v.idNo,
        status: v.status,
        lastContact: v.lastContact,
        deathDate: v.deathDate,
        cause: v.cause,
        causeIcd: v.causeIcd,
        place: v.place,
        doctor: d.doctor || '-',
        uploadType: '批量上传',
        uploadTime: uploadTime,
        fileName: fileName || '随访上传.xlsx',
        rowNo: v.rowNo,
        error: (v.messages || []).join('；'),
        matchedId: v.matchedId,
        matchedIds: v.matchedIds || [],
        level: v.level,
        checkStatus: v.checkStatus,
        raw: v.raw
      });
    });
    followupBatchClosePick();
    renderPage('followup-upload');
    if (typeof setActiveMenu === 'function') setActiveMenu('followup');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('followup', '批量上传');
    toast('解析完成，' + demos.length + ' 条数据已填充到列表，请检查校验状态');
  }

  function validateFollowupUploadRow(row) {
    var errors = [];
    var warns = [];
    var name = String(row.name || '').trim();
    var idNo = String(row.idNo || '').trim();
    var status = String(row.status || '').trim();
    var lastContact = String(row.lastContact || '').trim();
    var deathDate = String(row.deathDate || '').trim();
    var cause = String(row.cause || '').trim();
    var causeIcd = String(row.causeIcd || '').trim();
    var place = String(row.place || '').trim();

    if (!name) errors.push('姓名为空');
    if (!idNo) errors.push('身份证号为空');
    else if (!/^\d{17}[\dXx]$/.test(idNo)) errors.push('身份证号格式不正确');

    if (!lastContact) errors.push('最后接触日期为空');
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(lastContact)) errors.push('最后接触日期格式应为 YYYY-MM-DD');

    if (!status) errors.push('最后接触状态为空');
    else if (CONTACT.indexOf(status) < 0) errors.push('最后接触状态不在允许取值内');

    /* 匹配键：姓名 + 身份证号（多原发返回全部灶） */
    var matchedList = (name && idNo && /^\d{17}[\dXx]$/.test(idNo))
      ? findMatchedFollowupsByNameId(name, idNo)
      : [];
    var matched = matchedList[0] || null;
    var matchedIds = matchedList.map(function (x) { return x.id; });
    var notExist = !!(name && idNo && /^\d{17}[\dXx]$/.test(idNo) && !matchedList.length);

    if (status === '死亡') {
      if (!deathDate) errors.push('死亡结局须填写死亡日期');
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(deathDate)) errors.push('死亡日期格式不正确');
      if (!cause) errors.push('死亡结局须填写根本死因');
      if (!causeIcd) errors.push('死亡结局须填写死因 ICD10');
      if (!place) errors.push('死亡结局须填写死亡地点');
      if (deathDate && lastContact && deathDate !== lastContact) {
        warns.push('死亡日期与最后接触日期不一致');
      }
      if (deathDate && lastContact && /^\d{4}-\d{2}-\d{2}$/.test(deathDate) &&
          /^\d{4}-\d{2}-\d{2}$/.test(lastContact) && lastContact > deathDate) {
        errors.push('最后接触日期不得晚于死亡日期');
      }
      if (cause && /肿瘤|癌|肉瘤|白血病|淋巴瘤/.test(cause) && causeIcd &&
          !/^[CDcd]/.test(causeIcd)) {
        errors.push('根本死因为肿瘤时，死因 ICD10 须以 C 或 D 开头');
      }
    }

    /* 全灶校验：历史接触取最晚；确诊/死亡日期对每一灶检查 */
    if (matchedList.length && lastContact && /^\d{4}-\d{2}-\d{2}$/.test(lastContact)) {
      var maxHist = '';
      matchedList.forEach(function (m) {
        var lc = m.lastContact && m.lastContact !== '-' ? m.lastContact : '';
        if (lc && (!maxHist || lc > maxHist)) maxHist = lc;
        if (m.diagDate && lastContact < m.diagDate) {
          warns.push('最后接触日期早于确诊日期（' + m.diagDate + (matchedList.length > 1 ? '，灶 ' + m.id : '') + '）');
        }
        if (status === '死亡' && deathDate && m.diagDate && deathDate < m.diagDate) {
          errors.push('死亡日期不得早于确诊日期' + (matchedList.length > 1 ? '（灶 ' + m.id + '）' : ''));
        }
      });
      if (maxHist && lastContact < maxHist) {
        errors.push('当前提交的接触日期早于历史最后接触日期（' + maxHist + '）');
      }
    }

    var level;
    if (errors.length) level = '错误';
    else if (notExist) level = '不存在';
    else if (warns.length) level = '警告';
    else level = '通过';

    var messages = errors.concat(warns);
    if (notExist && messages.indexOf('系统中无匹配随访记录（姓名+身份证号）') < 0) {
      messages = ['系统中无匹配随访记录（姓名+身份证号）'].concat(messages);
    }
    return {
      rowNo: row.rowNo,
      name: name || '-',
      idNo: idNo || '-',
      lastContact: lastContact || '-',
      status: status || '-',
      deathDate: deathDate || '-',
      cause: cause || '-',
      causeIcd: causeIcd || '-',
      place: place || '-',
      matchedId: matched ? matched.id : '',
      matchedIds: matchedIds,
      exist: matchedList.length ? '存在' : '不存在',
      level: level,
      messages: messages,
      checkStatus: level === '错误' || level === '不存在' ? '校验错误' : (level === '警告' ? '未校验' : '校验通过'),
      raw: row
    };
  }

  window.followupBatchApplyValidated = function () {
    ensureFollowupStore();
    var checked = (window.fuBatchTempRecords || []).filter(function (r) {
      return r.checked && r.validation !== '已处理';
    });
    if (!checked.length) { toast('请先选择要上传的记录', 'error'); return; }
    var okRows = checked.filter(function (r) {
      return (r.validation === '通过' || r.validation === '警告') && r.exist === '存在';
    });
    if (!okRows.length) {
      toast('选中的记录均不可入库（须通过/警告且系统中存在匹配档案）', 'error');
      return;
    }
    var updatedRows = 0;
    var updatedFoci = 0;
    var uploadDate = new Date().toISOString().slice(0, 10);
    okRows.forEach(function (r) {
      var foci = (r.matchedIds && r.matchedIds.length)
        ? store().filter(function (x) { return r.matchedIds.indexOf(x.id) >= 0; })
        : findMatchedFollowupsByNameId(r.name, r.idNo);
      if (!foci.length) return;
      foci.forEach(function (rec) {
        rec.lastContact = r.lastContact;
        rec.status = r.status;
        rec.source = '批量导入';
        rec.checkStatus = r.checkStatus;
        rec.uploadDate = uploadDate;
        if (r.doctor && r.doctor !== '-') rec.doctor = r.doctor;
        if (r.status === '死亡') {
          rec.deathDate = r.deathDate || '-';
          rec.cause = r.cause || '-';
          rec.causeIcd = r.causeIcd || '-';
          rec.place = r.place || '-';
        } else {
          rec.deathDate = '-';
          rec.cause = '-';
          rec.causeIcd = '-';
          rec.place = '-';
        }
        updatedFoci++;
      });
      r.validation = '已处理';
      r.checked = false;
      updatedRows++;
    });
    syncCardFollowupMap();
    renderPage('followup-upload');
    if (typeof setActiveMenu === 'function') setActiveMenu('followup');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('followup', '批量上传');
    toast('已入库 ' + updatedRows + ' 条上传行，全灶更新 ' + updatedFoci + ' 灶（其余选中项已跳过）');
  };

  window.renderFollowupRecords = function () {
    ensureStyles();
    ensureFollowupStore();
    var st = window.followupRecordState;
    var rowsData = store().filter(function (r) {
      if (st.status && r.status !== st.status) return false;
      if (st.cardType && r.cardType !== st.cardType) return false;
      if (st.reportCardId && r.reportCardId !== st.reportCardId && r.id !== st.reportCardId) return false;
      if (st.keyword) {
        var kw = st.keyword;
        if ([r.id, r.reportCardId, r.name, r.idNo, r.site, r.unit].join(' ').indexOf(kw) < 0) return false;
      }
      return true;
    });
    var filterHint = st.reportCardId
      ? '<div style="margin-bottom:10px;font-size:13px;color:#475569">已按报告卡 <strong>' + esc(st.reportCardId) +
        '</strong> 过滤　<button class="btn btn-ghost btn-xs" onclick="followupRecordState.reportCardId=\'\';followupRecordState.keyword=\'\';renderPage(\'followup\')">清除</button></div>'
      : '';

    var rows = rowsData.map(function (r) {
      var uploadDate = r.uploadDate || r.reportDate || '-';
      return '<tr>' +
        '<td><a href="javascript:void(0)" style="color:var(--primary)" onclick="followupDetail(\'' + esc(r.id) + '\')">' + esc(r.id) + '</a></td>' +
        '<td>' + esc(r.name) + '</td>' +
        '<td>' + esc(r.idNo || '-') + '</td>' +
        '<td>' + esc(r.sex) + '</td>' +
        '<td>' + ageOf(r.birth) + '</td>' +
        '<td>' + esc(r.birth || '-') + '</td>' +
        '<td>' + esc(r.site || '-') + '</td>' +
        '<td>' + esc(r.icd10 || '-') + '</td>' +
        '<td>' + esc(r.diagDate || '-') + '</td>' +
        '<td>' + contactBadge(r.status) + '</td>' +
        '<td>' + esc(r.lastContact || '-') + '</td>' +
        '<td>' + esc(r.unit || '-') + '</td>' +
        '<td>' + esc(r.cardType || '-') + '</td>' +
        '<td>' + esc(r.source || '报卡录入') + '</td>' +
        '<td>' + esc(uploadDate) + '</td>' +
        '<td class="sticky-col" style="white-space:nowrap">' +
        '<button class="btn btn-ghost btn-xs" onclick="followupDetail(\'' + esc(r.id) + '\')">查看</button> ' +
        '<button class="btn btn-primary btn-xs" onclick="followupAddRecord(\'' + esc(r.id) + '\')">添加</button>' +
        '</td></tr>';
    }).join('') || '<tr><td colspan="16" style="text-align:center;color:#94a3b8;padding:28px">无匹配记录</td></tr>';

    return filterHint +
      '<div class="page-toolbar"><div class="toolbar-actions">' +
      '<button class="btn btn-import btn-sm" onclick="followupOpenBatchUpload()">批量上传</button>' +
      '<button class="btn btn-outline btn-sm" onclick="downloadFollowupBatchTemplate()">模板下载</button>' +
      '</div></div>' +
      '<div class="panel"><div class="panel-body">' +
      '<div class="filter-toolbar">' +
      '<div class="form-group region-filter" style="min-width:200px"><label>行政区划</label>' + regionCascader() + '</div>' +
      '<div class="form-group"><label>最后接触状态</label><select onchange="followupRecordState.status=this.value;renderPage(\'followup\')">' +
      opt(CONTACT, st.status, '全部') + '</select></div>' +
      '<div class="form-group"><label>报卡类型</label><select onchange="followupRecordState.cardType=this.value;renderPage(\'followup\')">' +
      opt(['原始卡', '补报卡', '合并卡'], st.cardType, '全部') + '</select></div>' +
      '<div class="form-group search-group"><label>检索</label><input placeholder="登记编号 / 姓名 / 身份证号" value="' + esc(st.keyword || '') +
      '" onkeydown="if(event.key===\'Enter\'){followupRecordState.keyword=this.value;renderPage(\'followup\')}"></div>' +
      '<div class="filter-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="followupRecordState={status:\'\',cardType:\'\',keyword:\'\',reportCardId:\'\',view:\'list\'};renderPage(\'followup\')">重置</button>' +
      '</div>' +
      '</div>' +
      '<div style="margin-bottom:8px;color:#667085;font-size:13px">共 ' + rowsData.length + ' 条 · 死亡 ' +
      rowsData.filter(function (x) { return x.status === '死亡'; }).length + ' 条</div>' +
      '<div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px"><div class="table-wrap"><table class="data-table" style="margin:0;min-width:2000px"><thead><tr>' +
      '<th>报告卡编号</th><th>姓名</th><th>身份证号码</th><th>性别</th><th>年龄</th><th>出生日期</th><th>发病部位</th><th>ICD10</th>' +
      '<th>确诊日期</th><th>最后接触状态</th><th>最后接触时间</th><th>报告单位</th><th>报卡类型</th><th>来源类型</th><th>上传日期</th>' +
      '<th class="sticky-col" style="width:200px">操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="void-pagination"><div class="void-pagination-info">共' + rowsData.length + '条记录，第1/1页</div>' +
      '<div class="void-pagination-controls"><button onclick="toast(\'已是第一页\')">‹</button><input type="text" value="1" readonly><button onclick="toast(\'已是最后一页\')">›</button></div></div>' +
      '</div></div>';
  };

  // 死亡信息列表 / 死因管理 UI 见 death-module.js（数据层仍在本文件 ensureFollowupStore 等）

  window.closeBizModal = closeBizModal;

  // 路由：followup-upload 整页（若 app.html renderPage 未声明分支，仍可渲染）
  (function patchFollowupUploadRoute() {
    function install() {
      var prev = window.renderPage;
      if (typeof prev !== 'function' || prev.__fuUploadPatched) return;
      var wrapped = function (id) {
        if (id === 'followup-upload' && typeof window.renderFollowupUploadPage === 'function') {
          var box = document.getElementById('pageContainer');
          if (box) box.innerHTML = window.renderFollowupUploadPage();
          return;
        }
        return prev.apply(this, arguments);
      };
      wrapped.__fuUploadPatched = true;
      window.renderPage = wrapped;
    }
    install();
    setTimeout(install, 0);
    setTimeout(install, 200);
  })();

  // 初始化：覆盖早期简陋样例
  ensureFollowupStore();
  alignPlanTasks();
  seedDeathCausePool();
})();
