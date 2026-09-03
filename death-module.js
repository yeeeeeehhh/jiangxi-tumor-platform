/**
 * 死亡信息管理 — 与随访分菜单，共用随访主表：
 *   死亡信息列表 = 死亡结局列表 + 外部死因匹配（同一页切换）
 *   死因登记 = 外部死因录入/上传通道
 */
(function () {
  'use strict';

  // ---------- 状态 ----------
  window.deathRegFilters = window.deathRegFilters || {
    validation: '全部', exist: '全部', dateType: '死亡日期', keyword: '', view: 'list'
  };
  window.deathInfoState = window.deathInfoState || {
    checkStatus: '', source: '', causeLinked: '', keyword: '', reportCardId: '', view: 'list'
  };
  window.deathCauseState = window.deathCauseState || {
    validation: '', sourceType: '', matchStatus: '', keyword: ''
  };
  window.deathVoidList = window.deathVoidList || []; // 已废弃，保留兼容

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function badge(text, type) {
    return '<span class="badge badge-' + type + '">' + esc(text) + '</span>';
  }
  function valBadge(v) {
    if (v === '通过' || v === '校验通过') return badge('通过', 'success');
    if (v === '错误' || v === '校验错误') return badge('错误', 'danger');
    if (v === '警告') return badge('警告', 'warning');
    if (v === '已处理') return badge('已处理', 'muted');
    return badge(v || '未校验', 'warning');
  }
  function matchBadge(s) {
    return s === '已匹配' ? badge('已匹配', 'success') : badge(s || '未匹配', 'warning');
  }
  function checkBadge(s) {
    if (s === '校验通过') return badge(s, 'success');
    if (s === '校验错误') return badge(s, 'danger');
    return badge(s || '未校验', 'warning');
  }
  function contactBadge(s) {
    if (s === '死亡') return badge(s, 'danger');
    return badge(s || '-', 'muted');
  }
  function surMonths(diag, end) {
    if (!diag || !end || end === '-') return '-';
    var m = Math.round((new Date(end) - new Date(diag)) / (30 * 24 * 3600 * 1000));
    return m < 0 ? '-' : m + '月';
  }
  function opt(list, cur, allLabel) {
    return [''].concat(list).map(function (v) {
      return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' +
        (v || allLabel) + '</option>';
    }).join('');
  }
  function bizHint(html) {
    return '<div class="fu-biz-hint" style="background:#f8fafc;border:1px solid #e8eef4;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#475569;line-height:1.55">' + html + '</div>';
  }
  function ageOf(birth) {
    if (!birth) return '-';
    return Math.floor((new Date() - new Date(birth)) / (365.25 * 24 * 3600 * 1000));
  }
  function region() {
    return typeof renderRegionCascader === 'function' ? renderRegionCascader() : '<input>';
  }
  function dateRange(id, s, e) {
    return typeof renderDateRangePicker === 'function'
      ? renderDateRangePicker(id, s || '', e || '')
      : '<input type="date">';
  }
  function pager(n) {
    return '<div class="void-pagination"><div class="void-pagination-info">共' + n +
      '条记录，第1/1页</div><div class="void-pagination-controls"><button onclick="toast(\'已是第一页\')">‹</button>' +
      '<input type="text" value="1" readonly><button onclick="toast(\'已是最后一页\')">›</button></div></div>';
  }

  // ---------- 共用：随访死亡子集 ----------
  function followStore() {
    if (typeof window.ensureFollowupStore === 'function') return window.ensureFollowupStore();
    return window.followupData || [];
  }
  function deathLiveRows() {
    return followStore().filter(function (r) {
      return r.status === '死亡' && !r.voided;
    });
  }
  function findDeath(id) {
    return followStore().find(function (r) { return r.id === id || r.reportCardId === id; });
  }
  function syncArchive() {
    if (typeof window.syncFollowupToCardArchive === 'function') window.syncFollowupToCardArchive();
  }

  // ---------- 死因登记临时队列（≈ hisRecords） ----------
  function seedRegQueue() {
    if (window.deathRegRecords && window.deathRegRecords.length) return;
    window.deathRegRecords = [
      {
        id: 9001, checked: false, validation: '错误', exist: '存在', uploadType: '死因上传',
        name: '赵伟', idNo: '410105196509051234', sex: '男', birth: '1965-09-05',
        lastContact: '2026-06-12', deathDate: '2026-06-12', cause: '肿瘤', causeIcd: '', place: '医院',
        region: '郑州市金水区', unit: '金水区疾控', doctor: '外部',
        uploadTime: '2026-07-20 09:18', fileName: 'Death_20260720.xlsx', rowNo: 8,
        error: '死因ICD10 为空'
      },
      {
        id: 9002, checked: false, validation: '通过', exist: '存在', uploadType: '死因上传',
        name: '王建国', idNo: '410102195907211234', sex: '男', birth: '1959-07-21',
        lastContact: '2026-06-28', deathDate: '2026-06-28', cause: '肿瘤', causeIcd: 'C34.9', place: '医院',
        region: '郑州市金水区', unit: '金水区疾控', doctor: '外部',
        uploadTime: '2026-07-20 09:18', fileName: 'Death_20260720.xlsx', rowNo: 9, error: ''
      },
      {
        id: 9003, checked: false, validation: '通过', exist: '不存在', uploadType: '死因上传',
        name: '无名氏甲', idNo: '410888199001011234', sex: '男', birth: '1990-01-01',
        lastContact: '2026-05-20', deathDate: '2026-05-20', cause: '其他疾病', causeIcd: 'I21.9', place: '医院',
        region: '洛阳市洛龙区', unit: '洛龙区疾控', doctor: '外部',
        uploadTime: '2026-07-20 09:18', fileName: 'Death_20260720.xlsx', rowNo: 10, error: ''
      },
      {
        id: 9004, checked: false, validation: '警告', exist: '存在', uploadType: '死因上传',
        name: '李娜', idNo: '410102197808152345', sex: '女', birth: '1978-08-15',
        lastContact: '2026-07-18', deathDate: '2026-07-18', cause: '肿瘤', causeIcd: 'C50.9', place: '疗养院',
        region: '郑州市中原区', unit: '中原区疾控', doctor: '外部',
        uploadTime: '2026-07-21 11:02', fileName: 'Death_20260721.xlsx', rowNo: 3,
        error: '死亡日期晚于上传日超过 7 天'
      }
    ];
  }

  // ---------- 死因管理池（≈ sourceDataRecords） ----------
  function seedCausePool() {
    if (window.deathCausePool && window.deathCausePool.length) return window.deathCausePool;
    window.deathCausePool = [
      {
        mid: 'DC-001', name: '刘洋', idNo: '410104198806074567', sex: '男', birth: '1988-06-07',
        region: '郑州市二七区', deathDate: '2026-06-28', cause: '肿瘤', causeIcd: 'C22.0', place: '医院',
        diseaseType: '肿瘤', existStatus: '存在', matchStatus: '已匹配', validation: '通过',
        linkedCardId: 'HN-2026-000125', importTime: '2026-07-02 09:20', unit: '二七区疾控',
        doctor: '吴医生', sourceType: '死因上传', fileName: 'Death_0702.xlsx', rowNo: 12, voided: false
      },
      {
        mid: 'DC-002', name: '王建国', idNo: '410102195907211234', sex: '男', birth: '1959-07-21',
        region: '郑州市金水区', deathDate: '2026-06-28', cause: '肿瘤', causeIcd: 'C34.9', place: '医院',
        diseaseType: '肿瘤', existStatus: '存在', matchStatus: '未匹配', validation: '通过',
        linkedCardId: '', importTime: '2026-07-10 14:05', unit: '金水区疾控',
        doctor: '外部', sourceType: '死因上传', fileName: 'Death_0710.xlsx', rowNo: 5, voided: false
      },
      {
        mid: 'DC-003', name: '张伟', idNo: '410105196503121234', sex: '男', birth: '1965-03-12',
        region: '郑州市金水区', deathDate: '2026-07-08', cause: '肿瘤', causeIcd: 'C34.9', place: '家中',
        diseaseType: '肿瘤', existStatus: '存在', matchStatus: '未匹配', validation: '通过',
        linkedCardId: '', importTime: '2026-07-12 11:30', unit: '金水区疾控',
        doctor: '外部', sourceType: '死因上传', fileName: 'Death_0712.xlsx', rowNo: 2, voided: false
      },
      {
        mid: 'DC-004', name: '无名氏甲', idNo: '410888199001011234', sex: '男', birth: '1990-01-01',
        region: '洛阳市洛龙区', deathDate: '2026-05-20', cause: '其他疾病', causeIcd: 'I21.9', place: '医院',
        diseaseType: '其它疾病', existStatus: '不存在', matchStatus: '未匹配', validation: '通过',
        linkedCardId: '', importTime: '2026-07-15 16:40', unit: '洛龙区疾控',
        doctor: '外部', sourceType: '接口', fileName: 'CDC_Death.csv', rowNo: 88, voided: false
      },
      {
        mid: 'DC-005', name: '李娜', idNo: '410102197808152345', sex: '女', birth: '1978-08-15',
        region: '郑州市中原区', deathDate: '2026-07-18', cause: '肿瘤', causeIcd: 'C50.9', place: '疗养院',
        diseaseType: '肿瘤', existStatus: '存在', matchStatus: '未匹配', validation: '警告',
        linkedCardId: '', importTime: '2026-07-20 08:55', unit: '中原区疾控',
        doctor: '外部', sourceType: '批量导入', fileName: 'Death_0720.xlsx', rowNo: 1, voided: false
      }
    ];
    return window.deathCausePool;
  }

  function liveCausePool() {
    return seedCausePool().filter(function (r) { return !r.voided; });
  }

  // ==================== 1. 死因登记（≈ 报告卡登记） ====================
  function visibleReg() {
    seedRegQueue();
    var f = window.deathRegFilters;
    return window.deathRegRecords.filter(function (r) {
      if (r.validation === '已处理') return false;
      if (f.validation !== '全部' && r.validation !== f.validation) return false;
      if (f.keyword) {
        var kw = f.keyword;
        if ([r.name, r.idNo, r.causeIcd, String(r.id)].join(' ').indexOf(kw) < 0) return false;
      }
      return true;
    });
  }

  function renderRegTable(rows) {
    var body = rows.map(function (r) {
      return '<tr>' +
        '<td><input type="checkbox" ' + (r.checked ? 'checked' : '') +
        ' onchange="deathRegToggle(' + r.id + ',this.checked)"></td>' +
        '<td>' + valBadge(r.validation) + '</td>' +
        '<td>' + badge(r.exist === '存在' ? '已存在' : '不存在', r.exist === '存在' ? 'success' : 'muted') + '</td>' +
        '<td>' + esc(r.name) + '</td><td>' + esc(r.idNo) + '</td><td>' + esc(r.sex) + '</td>' +
        '<td>' + esc(r.birth) + '</td><td>' + esc(r.lastContact || r.deathDate || '-') + '</td><td>' + esc(r.deathDate) + '</td>' +
        '<td>' + esc(r.cause) + '</td><td>' + esc(r.causeIcd || '-') + '</td><td>' + esc(r.place) + '</td>' +
        '<td>' + esc(r.unit) + '</td><td>' + esc(r.uploadTime) + '</td>' +
        '<td style="max-width:180px;color:#b91c1c;font-size:12px">' + esc(r.error || '-') + '</td>' +
        '<td class="sticky-col"><button class="btn btn-ghost btn-xs" onclick="deathRegEditRow(' + r.id + ')">编辑</button> ' +
        '<button class="btn btn-danger btn-xs" onclick="deathRegDeleteOne(' + r.id + ')">删除</button></td></tr>';
    }).join('') || '<tr><td colspan="16" style="text-align:center;padding:36px;color:#98a2b3">暂无临时数据，请从死亡信息列表点击「批量登记」上传　' +
      '<button class="btn btn-primary btn-xs" onclick="deathRegOpenImport()">选择文件</button></td></tr>';

    return '<div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px">' +
      '<div class="table-wrap"><table class="data-table" style="margin:0;min-width:1680px"><thead><tr>' +
      '<th style="width:36px"><input type="checkbox" onchange="deathRegToggleAll(this.checked)"></th>' +
      '<th>校验状态</th><th>存在状态</th><th>姓名</th><th>身份证号</th><th>性别</th><th>出生日期</th>' +
      '<th>最后接触日期</th><th>死亡日期</th><th>根本死因</th><th>死因ICD</th><th>死亡地点</th><th>报告单位</th><th>上传时间</th><th>错误说明</th>' +
      '<th class="sticky-col" style="width:140px">操作</th></tr></thead><tbody>' + body + '</tbody></table></div></div>';
  }

  /** 死亡信息列表入口：进临时表整页并自动拉起选文件弹窗（两表：临时表 ≠ 死亡列表主表） */
  window.deathOpenBatchRegister = function () {
    window.__deathBiPending = true;
    navigateTo('death-register');
    if (typeof setActiveMenu === 'function') setActiveMenu('death-info');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('death-info', '批量登记');
    setTimeout(function () {
      if (typeof deathRegOpenImport === 'function') deathRegOpenImport();
    }, 60);
  };

  function stayOnDeathRegPage() {
    renderPage('death-register');
    if (typeof setActiveMenu === 'function') setActiveMenu('death-info');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('death-info', '批量登记');
  }

  window.renderDeathRegister = function () {
    seedRegQueue();
    var rows = visibleReg();
    var checked = window.deathRegRecords.filter(function (r) { return r.checked && r.validation !== '已处理'; }).length;
    var f = window.deathRegFilters;
    var batch = checked > 0
      ? '<div class="void-batch-bar"><div class="void-batch-info">已选择 <strong>' + checked +
        '</strong> 条临时数据（仅校验「通过」可入库到死因匹配池；入库≠进入死亡信息列表）</div><div class="void-batch-actions">' +
        '<button class="btn btn-outline btn-sm" onclick="toast(\'导出 Excel 中...\')">导出 Excel</button>' +
        '<button class="btn btn-primary btn-sm" onclick="deathRegBatchUpload()">批量入库</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deathRegBatchDelete()">批量删除</button></div></div>'
      : '';

    return '<div class="page-toolbar"><div class="toolbar-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="navigateTo(\'death-info\');setActiveMenu(\'death-info\');updateBreadcrumb(\'death-info\')">← 返回死亡信息列表</button>' +
      '</div></div>' +
      '<div class="panel"><div class="panel-body">' +
      '<div class="filter-toolbar">' +
      '<div class="form-group region-filter"><label>过滤行政区划</label>' + region() + '</div>' +
      '<div class="form-group"><label>校验状态</label><select id="deathValFilter" onchange="deathRegQuery()">' +
      ['全部', '通过', '警告', '错误'].map(function (x) {
        return '<option' + (f.validation === x ? ' selected' : '') + '>' + x + '</option>';
      }).join('') + '</select></div>' +
      '<div class="form-group"><label>日期类型</label><select id="deathDateType"><option>死亡日期</option><option>上传日期</option></select></div>' +
      '<div class="form-group date-group"><label>日期</label>' + dateRange('dr_death_reg', '', '') + '</div>' +
      '<div class="form-group search-group"><label>检索内容</label>' +
      '<input id="deathRegKeyword" placeholder="姓名 / 身份证号" value="' + esc(f.keyword) +
      '" onkeydown="if(event.key===\'Enter\')deathRegQuery()"></div>' +
      '<div class="filter-actions"><button class="btn btn-ghost btn-sm" onclick="deathRegReset()">重置</button></div>' +
      '</div>' + batch + renderRegTable(rows) + pager(rows.length) +
      '</div></div>';
  };

  window.deathRegQuery = function () {
    var f = window.deathRegFilters;
    f.validation = (document.getElementById('deathValFilter') || {}).value || '全部';
    f.keyword = ((document.getElementById('deathRegKeyword') || {}).value || '').trim();
    stayOnDeathRegPage();
  };
  window.deathRegReset = function () {
    window.deathRegFilters = { validation: '全部', exist: '全部', dateType: '死亡日期', keyword: '', view: 'list' };
    (window.deathRegRecords || []).forEach(function (r) { r.checked = false; });
    stayOnDeathRegPage();
    toast('筛选条件已重置');
  };
  window.deathRegToggle = function (id, checked) {
    var row = (window.deathRegRecords || []).find(function (r) { return r.id === id; });
    if (row) row.checked = checked;
  };
  window.deathRegToggleAll = function (checked) {
    visibleReg().forEach(function (r) { r.checked = checked; });
    stayOnDeathRegPage();
  };
  window.deathRegDeleteOne = function (id) {
    var row = (window.deathRegRecords || []).find(function (r) { return r.id === id; });
    if (row) { row.validation = '已处理'; row.checked = false; }
    stayOnDeathRegPage();
    toast('临时数据已删除');
  };

  /** 临时表行编辑：进入与随访「添加」相同的随访报告信息整页 */
  window.deathRegEditRow = function (id) {
    var row = (window.deathRegRecords || []).find(function (r) { return r.id === id; });
    if (!row) { toast('未找到该行', 'error'); return; }
    window.followupEntryContext = {
      mode: 'deathRegEdit',
      batchTempId: row.id,
      backPage: 'death-register',
      prefill: {
        name: row.name,
        idNo: row.idNo,
        sex: row.sex,
        birth: row.birth,
        lastContact: row.lastContact,
        status: '死亡',
        place: row.place,
        cause: row.cause,
        causeIcd: row.causeIcd,
        deathDate: row.deathDate,
        doctor: row.doctor
      }
    };
    navigateTo('death-entry');
    if (typeof setActiveMenu === 'function') setActiveMenu('death-info');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('death-info', '编辑死因临时行');
  };

  window.deathRegBatchDelete = function () {
    var sel = (window.deathRegRecords || []).filter(function (r) { return r.checked; });
    if (!sel.length) { toast('请先选择要删除的记录', 'error'); return; }
    showConfirm('批量删除', '确定删除选中的 ' + sel.length + ' 条临时数据？', function () {
      sel.forEach(function (r) { r.validation = '已处理'; r.checked = false; });
      stayOnDeathRegPage();
      toast('已删除 ' + sel.length + ' 条');
    });
  };
  window.deathRegBatchUpload = function () {
    var checked = (window.deathRegRecords || []).filter(function (r) { return r.checked; });
    if (!checked.length) { toast('请先选择要入库的记录', 'error'); return; }
    var passed = checked.filter(function (r) { return r.validation === '通过'; });
    if (!passed.length) { toast('选中的记录均未通过校验，无法入库', 'error'); return; }
    seedCausePool();
    passed.forEach(function (r, i) {
      window.deathCausePool.push({
        mid: 'DC-N' + String(Date.now()).slice(-5) + i,
        name: r.name, idNo: r.idNo, sex: r.sex, birth: r.birth, region: r.region,
        deathDate: r.deathDate, lastContact: r.lastContact || r.deathDate,
        cause: r.cause, causeIcd: r.causeIcd, place: r.place,
        diseaseType: r.cause === '肿瘤' ? '肿瘤' : '其它疾病',
        existStatus: r.exist, matchStatus: '未匹配', validation: r.validation,
        linkedCardId: '', importTime: r.uploadTime, unit: r.unit, doctor: r.doctor,
        sourceType: r.uploadType || '死因上传', fileName: r.fileName, rowNo: r.rowNo, voided: false
      });
      r.validation = '已处理';
      r.checked = false;
    });
    toast('入库成功 ' + passed.length + ' 条，请在死亡信息列表中匹配回写');
    setTimeout(function () { openDeathCauseView(); }, 500);
  };
  /** 单条「添加」已从工具栏移除；若仍调用则进入同款随访报告信息页 */
  window.deathRegAddOne = function () {
    window.followupEntryContext = {
      mode: 'deathReg',
      backPage: 'death-register',
      prefill: { status: '死亡' }
    };
    navigateTo('death-entry');
    if (typeof setActiveMenu === 'function') setActiveMenu('death-info');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('death-info', '死因信息录入');
  };

  window.renderDeathEntryForm = function () {
    var ctx = window.followupEntryContext || { mode: 'deathReg', backPage: 'death-register', prefill: {} };
    var mode = ctx.mode || 'deathReg';
    var pre = ctx.prefill || {};
    var isFu = mode === 'followup' || mode === 'fuBatchEdit';
    var isDeathEdit = mode === 'deathRegEdit';
    var tip = mode === 'fuBatchEdit'
      ? '<li>本页与报告卡登记第三步「随访报告信息」字段一致；保存后写回批量上传临时行并重新校验。</li><li>带红色 <span class="required">*</span> 为必填；状态=死亡时死亡相关字段条件必填。</li>'
      : (isDeathEdit
        ? '<li>本页与报告卡登记第三步「随访报告信息」字段一致；保存后写回死因临时表该行并重新校验。</li><li>带红色 <span class="required">*</span> 为必填。</li>'
        : (isFu
          ? '<li>本页与报告卡登记第三步「随访报告信息」字段一致；保存后追加接触事件并刷新档案当前状态。</li><li>带红色 <span class="required">*</span> 为必填；状态=死亡时死亡相关字段条件必填。</li>'
          : '<li>本页与报告卡登记第三步「随访报告信息」字段一致；提交后进入死因入站临时队列。</li><li>带红色 <span class="required">*</span> 为必填；校验通过后方可批量入库。</li>'));
    var summary = isFu
      ? '<div style="margin-bottom:14px;padding:10px 12px;background:#f8fafc;border:1px solid #e8eef4;border-radius:6px;font-size:13px;color:#475569">' +
        '患者：<strong>' + esc(pre.name || '-') + '</strong>' +
        (ctx.followupId ? ' · ' + esc(ctx.followupId) : '') +
        (pre.idNo ? ' · ' + esc(pre.idNo) : '') +
        (mode === 'fuBatchEdit' ? '　<span style="color:#667085">（批量上传行编辑）</span>' : '') +
        '</div>'
      : '<div class="form-grid" style="margin-bottom:8px">' +
        '<div class="form-group"><label>姓名 <span class="required">*</span></label><input id="deName" placeholder="请输入姓名" value="' + esc(pre.name || '') + '"></div>' +
        '<div class="form-group"><label>身份证号 <span class="required">*</span></label><input id="deIdNo" placeholder="18位身份证号" value="' + esc(pre.idNo || '') + '"></div>' +
        '<div class="form-group"><label>性别</label><select id="deSex"><option value="">请选择</option><option' + (pre.sex === '男' ? ' selected' : '') + '>男</option><option' + (pre.sex === '女' ? ' selected' : '') + '>女</option></select></div>' +
        '<div class="form-group"><label>出生日期</label><input type="date" id="deBirth" value="' + esc((pre.birth && pre.birth !== '-') ? pre.birth : '') + '"></div>' +
        '</div>';
    var formBody = typeof renderFollowupReportSection === 'function'
      ? renderFollowupReportSection({ prefix: 'fuRpt', values: pre, activeSection: true, requireFollowupDate: isFu })
      : '<div class="entry-section-title">随访报告信息</div>';
    var submitLabel = mode === 'fuBatchEdit' || isDeathEdit ? '保存'
      : (mode === 'followup' ? '保存随访记录' : '提交到登记队列');
    var backLabel = mode === 'fuBatchEdit' ? '返回批量上传'
      : (isDeathEdit || mode === 'deathReg' ? '返回死因临时表' : '返回列表');
    return '<div class="page-toolbar"><div class="toolbar-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="followupEntryGoBack()">← ' + backLabel + '</button>' +
      '</div></div>' +
      '<div class="entry-alert"><div class="entry-alert-title">⚠ 提示！</div><ol>' + tip + '</ol></div>' +
      '<div class="panel entry-form-panel"><div class="panel-body">' +
      '<div class="entry-step-tabs" id="followupEntryTabs"><div class="step-tabs-inner">' +
      '<button type="button" class="step-btn done" disabled title="请在报告卡登记中填写"><span class="step-index">1</span><span>发病人口信息</span></button>' +
      '<button type="button" class="step-btn done" disabled title="请在报告卡登记中填写"><span class="step-index">2</span><span>肿瘤报告信息</span></button>' +
      '<button type="button" class="step-btn active"><span class="step-index">3</span><span>随访报告信息</span></button>' +
      '</div></div>' +
      summary + formBody +
      '<div class="form-actions">' +
      '<button class="btn btn-primary" onclick="deathEntrySubmit()">' + submitLabel + '</button>' +
      '<button class="btn btn-ghost" onclick="deathEntryReset()">重置</button>' +
      '</div>' +
      '</div></div>' +
      '<script>if(typeof toggleFollowupFormFields==="function")setTimeout(toggleFollowupFormFields,50);<\/script>';
  };

  window.followupEntryGoBack = function () {
    var ctx = window.followupEntryContext || {};
    var back = ctx.backPage || 'followup';
    if (back === 'followup-upload') {
      navigateTo('followup-upload');
      if (typeof setActiveMenu === 'function') setActiveMenu('followup');
      if (typeof updateBreadcrumb === 'function') updateBreadcrumb('followup', '批量上传');
      return;
    }
    if (back === 'death-register') {
      navigateTo('death-register');
      if (typeof setActiveMenu === 'function') setActiveMenu('death-info');
      if (typeof updateBreadcrumb === 'function') updateBreadcrumb('death-info', '批量登记');
      return;
    }
    navigateTo(back);
    if (typeof setActiveMenu === 'function') setActiveMenu(back === 'death-info' ? 'death-info' : (back === 'followup-tasks' ? 'followup-tasks' : 'followup'));
    if (back === 'followup-tasks' && typeof updateBreadcrumb === 'function') updateBreadcrumb('followup-tasks');
  };

  window.deathEntryReset = function () {
    var ctx = window.followupEntryContext || {};
    if (ctx.mode === 'deathReg' || ctx.mode === 'deathRegEdit') {
      ['deName', 'deIdNo', 'deBirth'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      var sex = document.getElementById('deSex');
      if (sex) sex.selectedIndex = 0;
    }
    ['fuRptLastContact', 'fuRptCauseIcd', 'fuRptDeathDate', 'fuRptDoctor'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['fuRptStatus', 'fuRptPlace', 'fuRptCause'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.selectedIndex = 0;
    });
    toast('表单已重置');
  };

  window.deathEntrySubmit = function () {
    var ctx = window.followupEntryContext || { mode: 'deathReg' };
    var data = typeof validateFollowupReportForm === 'function' ? validateFollowupReportForm('fuRpt') : null;
    if (!data) return;

    if (ctx.mode === 'fuBatchEdit') {
      if (!ctx.batchTempId || typeof followupBatchSaveEdit !== 'function') {
        toast('未找到批量上传行', 'error');
        return;
      }
      followupBatchSaveEdit(ctx.batchTempId, data);
      return;
    }

    if (ctx.mode === 'followup') {
      if (!ctx.followupId || typeof saveFollowupReportToRecord !== 'function') {
        toast('未找到随访档案', 'error');
        return;
      }
      if (!saveFollowupReportToRecord(ctx.followupId, data)) {
        return;
      }
      if (ctx.taskId && typeof completeFollowupTask === 'function') completeFollowupTask(ctx.taskId, data);
      toast(data.status === '死亡' ? '已添加随访记录，死亡结局已同步至死亡信息列表' : '已添加随访记录');
      var back = ctx.backPage || 'followup';
      if (back === 'followup-tasks') {
        navigateTo('followup-tasks');
        if (typeof setActiveMenu === 'function') setActiveMenu('followup-tasks');
        if (typeof updateBreadcrumb === 'function') updateBreadcrumb('followup-tasks');
      } else if (back === 'followup' || back === 'death-info') {
        window._fuDetailBack = back;
        if (typeof followupDetail === 'function') followupDetail(ctx.followupId);
        else navigateTo(back);
      } else {
        navigateTo(back);
      }
      return;
    }

    // 死因临时行编辑：写回临时表并重校验
    if (ctx.mode === 'deathRegEdit') {
      seedRegQueue();
      var editRow = (window.deathRegRecords || []).find(function (r) { return r.id === ctx.batchTempId; });
      if (!editRow) { toast('未找到该行', 'error'); return; }
      var nameE = (document.getElementById('deName') || {}).value || editRow.name || '';
      var idNoE = (document.getElementById('deIdNo') || {}).value || editRow.idNo || '';
      if (!nameE.trim() || !idNoE.trim()) {
        toast('请填写姓名和身份证号', 'error');
        return;
      }
      editRow.name = nameE.trim();
      editRow.idNo = idNoE.trim();
      editRow.sex = (document.getElementById('deSex') || {}).value || editRow.sex;
      editRow.birth = (document.getElementById('deBirth') || {}).value || editRow.birth;
      editRow.lastContact = data.lastContact;
      editRow.deathDate = data.deathDate;
      editRow.cause = data.cause;
      editRow.causeIcd = data.causeIcd;
      editRow.place = data.place;
      editRow.doctor = data.doctor || editRow.doctor;
      if (!/^\d{17}[\dXx]$/.test(editRow.idNo)) {
        editRow.validation = '错误';
        editRow.error = '身份证号格式不正确';
      } else if (!data.deathDate || !data.causeIcd) {
        editRow.validation = '错误';
        editRow.error = '死亡结局须填写死亡日期与死因 ICD10';
      } else {
        editRow.validation = '通过';
        editRow.error = '';
      }
      var cardsE = window.reportCardListData || [];
      editRow.exist = (cardsE.some(function (c) { return c.idNo === editRow.idNo; }) ||
        (window.followupData || []).some(function (f) { return f.idNo === editRow.idNo; })) ? '存在' : '不存在';
      toast('已保存，校验状态：' + editRow.validation);
      stayOnDeathRegPage();
      return;
    }

    // 死因登记队列（手工录入）
    seedRegQueue();
    var name = (document.getElementById('deName') || {}).value || '';
    var idNo = (document.getElementById('deIdNo') || {}).value || '';
    var sex = (document.getElementById('deSex') || {}).value || '';
    var birth = (document.getElementById('deBirth') || {}).value || '';
    if (!name.trim() || !idNo.trim()) {
      toast('请填写姓名和身份证号', 'error');
      return;
    }
    var cards = window.reportCardListData || [];
    if ((!cards.length) && typeof renderReportCardList === 'function') {
      try { renderReportCardList(); cards = window.reportCardListData || []; } catch (e) { /* ignore */ }
    }
    var existInCard = cards.some(function (c) { return c.idNo === idNo; }) ||
      (window.followupData || []).some(function (f) { return f.idNo === idNo; });
    var validation = '通过';
    var error = '';
    if (!/^\d{17}[\dXx]$/.test(idNo)) {
      validation = '错误';
      error = '身份证号格式不正确';
    } else if (data.cause === '肿瘤' && data.causeIcd && data.causeIcd.charAt(0).toUpperCase() !== 'C' &&
      data.causeIcd.charAt(0).toUpperCase() !== 'D') {
      validation = '警告';
      error = '根本死因为肿瘤，但 ICD 非常见肿瘤编码';
    }
    var matched = (window.followupData || []).find(function (f) { return f.idNo === idNo; });
    window.deathRegRecords.push({
      id: Date.now(),
      checked: false,
      validation: validation,
      exist: existInCard ? '存在' : '不存在',
      uploadType: '手工录入',
      name: name.trim(),
      idNo: idNo.trim(),
      sex: sex || (matched && matched.sex) || '',
      birth: birth || (matched && matched.birth) || '',
      lastContact: data.lastContact,
      deathDate: data.deathDate,
      cause: data.cause,
      causeIcd: data.causeIcd,
      place: data.place,
      region: (matched && matched.region) || '郑州市金水区',
      unit: (matched && matched.unit) || '手工录入',
      doctor: data.doctor || '手工录入',
      uploadTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
      fileName: '-',
      rowNo: '-',
      error: error
    });
    toast(validation === '通过' ? '已提交到死因登记队列' : '已提交（校验' + validation + '），请在列表中修正');
    stayOnDeathRegPage();
  };

  window.deathRegOpenImport = function () {
    window.__deathBiPending = true;
    if (typeof openBatchImportDialog === 'function') {
      openBatchImportDialog();
      setTimeout(function () {
        var h = document.querySelector('.bi-header span');
        if (h) h.textContent = '死因批量登记';
      }, 50);
      var base = window.biParseFile;
      if (typeof base === 'function' && !window.__deathBiHooked) {
        window.__deathBiHooked = true;
        window.biParseFile = function () {
          if (window.__deathBiPending) {
            window.__deathBiPending = false;
            seedRegQueue();
            var now = new Date().toISOString().slice(0, 16).replace('T', ' ');
            var name = (window.biState && biState.fileName) || 'Death_import.xlsx';
            window.deathRegRecords.push(
              {
                id: Date.now() + 1, checked: false, validation: '通过', exist: '存在', uploadType: '批量登记',
                name: '张伟', idNo: '410105196503121234', sex: '男', birth: '1965-03-12',
                lastContact: '2026-07-08', deathDate: '2026-07-08', cause: '肿瘤', causeIcd: 'C34.9', place: '家中',
                region: '郑州市金水区', unit: '金水区疾控', doctor: '外部',
                uploadTime: now, fileName: name, rowNo: 1, error: ''
              },
              {
                id: Date.now() + 2, checked: false, validation: '错误', exist: '存在', uploadType: '批量登记',
                name: '测试缺项', idNo: '410105196503129999', sex: '男', birth: '1965-03-12',
                lastContact: '2026-07-01', deathDate: '2026-07-01', cause: '肿瘤', causeIcd: '', place: '医院',
                region: '郑州市金水区', unit: '金水区疾控', doctor: '外部',
                uploadTime: now, fileName: name, rowNo: 2, error: '死因ICD10 为空'
              }
            );
            if (typeof closeBatchImportDialog === 'function') closeBatchImportDialog();
            stayOnDeathRegPage();
            toast('解析完成，已填充到死因临时表');
            return;
          }
          return base.apply(this, arguments);
        };
      }
    } else {
      toast('请选择死因 Excel（统一模板）');
    }
  };

  // ==================== 2. 死亡信息列表（死亡结局 + 外部死因匹配） ====================
  window.openDeathCauseView = function () {
    window.deathInfoState = window.deathInfoState || {};
    window.deathInfoState.view = 'cause';
    setActiveMenu('death-info');
    renderPage('death-info');
    updateBreadcrumb('death-info');
  };
  window.closeDeathCauseView = function () {
    window.deathInfoState.view = 'list';
    renderPage('death-info');
  };

  window.renderDeathInfo = function () {
    if ((window.deathInfoState.view || 'list') === 'cause') {
      return renderDeathCause();
    }
    var st = window.deathInfoState;
    var pool = liveCausePool();
    var rows = deathLiveRows().filter(function (r) {
      if (st.reportCardId && r.reportCardId !== st.reportCardId && r.id !== st.reportCardId) return false;
      if (st.checkStatus && r.checkStatus !== st.checkStatus) return false;
      if (st.source && (r.source || '') !== st.source) return false;
      if (st.causeLinked === 'yes') {
        if (!pool.some(function (c) { return c.linkedCardId === (r.reportCardId || r.id); })) return false;
      }
      if (st.causeLinked === 'no') {
        if (pool.some(function (c) { return c.linkedCardId === (r.reportCardId || r.id); })) return false;
      }
      if (st.keyword && [r.id, r.name, r.idNo, r.site].join(' ').indexOf(st.keyword) < 0) return false;
      return true;
    });

    var filterHint = st.reportCardId
      ? '<div style="margin-bottom:10px;font-size:13px;color:#475569">已按报告卡 <strong>' + esc(st.reportCardId) +
        '</strong> 过滤　<button class="btn btn-ghost btn-xs" onclick="deathInfoState.reportCardId=\'\';deathInfoState.keyword=\'\';renderPage(\'death-info\')">清除</button></div>'
      : '';

    var tableRows = rows.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td>' +
        '<td>' + checkBadge(r.checkStatus) + '</td>' +
        '<td><a href="javascript:void(0)" style="color:var(--primary)" onclick="deathInfoDetail(\'' + esc(r.id) + '\')">' + esc(r.id) + '</a></td>' +
        '<td>' + esc(r.name) + '</td><td>' + esc(r.sex) + '</td><td>' + ageOf(r.birth) + '</td>' +
        '<td>' + esc(r.diagDate) + '</td><td>' + esc(r.icd10 || '-') + '</td>' +
        '<td>' + esc(r.lastContact) + '</td><td>' + contactBadge('死亡') + '</td>' +
        '<td>' + esc(r.deathDate) + '</td><td>' + esc(r.cause) + '</td><td>' + esc(r.causeIcd || '-') + '</td>' +
        '<td>' + esc(r.place || '-') + '</td><td>' + esc(surMonths(r.diagDate, r.deathDate)) + '</td>' +
        '<td class="sticky-col" style="white-space:nowrap">' +
        '<button class="btn btn-ghost btn-xs" onclick="followupDetail(\'' + esc(r.id) + '\')">操作</button>' +
        '</td></tr>';
    }).join('') || '<tr><td colspan="16" style="text-align:center;padding:36px;color:#98a3b8">暂无死亡结局记录。可在随访中将结局改为「死亡」，或由外部死因匹配回写。</td></tr>';

    return filterHint +
      '<div class="page-toolbar"><div class="toolbar-actions">' +
      '<button class="btn btn-outline btn-sm" onclick="downloadTemplate()">模板下载</button>' +
      '<button class="btn btn-import btn-sm" onclick="deathOpenBatchRegister()">批量登记</button>' +
      '</div></div>' +
      '<div class="panel"><div class="panel-body">' +
      '<div class="filter-toolbar">' +
      '<div class="form-group region-filter" style="min-width:200px"><label>行政区划</label>' + region() + '</div>' +
      '<div class="form-group"><label>校验状态</label><select onchange="deathInfoState.checkStatus=this.value;renderPage(\'death-info\')">' +
      opt(['未校验', '校验通过', '校验错误'], st.checkStatus, '全部') + '</select></div>' +
      '<div class="form-group"><label>死因</label><select onchange="deathInfoState.causeLinked=this.value;renderPage(\'death-info\')">' +
      '<option value="">全部</option>' +
      '<option value="yes"' + (st.causeLinked === 'yes' ? ' selected' : '') + '>已匹配死因</option>' +
      '<option value="no"' + (st.causeLinked === 'no' ? ' selected' : '') + '>未匹配死因</option>' +
      '</select></div>' +
      '<div class="form-group"><label>日期类型</label><select><option>死亡日期</option><option>最后接触日期</option></select></div>' +
      '<div class="form-group date-group"><label>日期区间</label>' + dateRange('dr_death_info', '2026-06-01', '2026-07-31') + '</div>' +
      '<div class="form-group search-group"><label>检索</label>' +
      '<input type="text" placeholder="报告卡编号 / 姓名 / 身份证号" value="' + esc(st.keyword || '') +
      '" onkeydown="if(event.key===\'Enter\'){deathInfoState.keyword=this.value;renderPage(\'death-info\')}"></div>' +
      '<div class="filter-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="deathInfoState={checkStatus:\'\',source:\'\',causeLinked:\'\',keyword:\'\',reportCardId:\'\',view:\'list\'};renderPage(\'death-info\')">重置</button>' +
      '<button class="btn btn-outline btn-sm" onclick="toast(\'导出Excel中...\')">导出Excel</button>' +
      '</div>' +
      '</div>' +
      '<div style="margin-bottom:8px;color:#667085;font-size:13px">共 ' + rows.length + ' 条（随访结局=死亡 · 主表子集，非死因临时表）</div>' +
      '<div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px">' +
      '<div class="table-wrap"><table class="data-table" style="margin:0;min-width:1500px"><thead><tr>' +
      '<th>序号</th><th>校验状态</th><th>报告卡编号</th><th>姓名</th><th>性别</th><th>年龄</th><th>诊断日期</th><th>ICD10</th>' +
      '<th>最后接触</th><th>结局</th><th>死亡日期</th><th>根本死因</th><th>死因ICD</th><th>死亡地点</th><th>生存月数</th>' +
      '<th class="sticky-col" style="width:220px">操作</th></tr></thead><tbody>' + tableRows + '</tbody></table></div></div>' +
      pager(rows.length) +
      '</div></div>';
  };

  window.deathInfoDetail = function (id) {
    if (typeof openReportCardFromBiz === 'function') openReportCardFromBiz(id);
    else if (typeof cardListDetail === 'function') cardListDetail(id);
    else if (typeof followupDetail === 'function') followupDetail(id);
    else toast('未找到报告卡 ' + id, 'error');
  };

  window.deathInfoEdit = function (id) {
    if (typeof followupAddRecord === 'function') followupAddRecord(id);
    else if (typeof followupEdit === 'function') followupEdit(id);
    else toast('请在随访信息上传中添加随访记录', 'warning');
  };

  window.deathInfoVerify = function (id) {
    if (typeof followupVerify === 'function') followupVerify(id);
    else toast('核对完成', 'success');
  };

  // ==================== 外部死因匹配（死亡信息列表内视图） ====================
  window.renderDeathCause = function () {
    var st = window.deathCauseState;
    var poolAll = liveCausePool();
    var unmatched = poolAll.filter(function (r) { return r.matchStatus === '未匹配'; }).length;
    var rows = poolAll.filter(function (r) {
      if (st.validation && r.validation !== st.validation) return false;
      if (st.sourceType && r.sourceType !== st.sourceType) return false;
      if (st.matchStatus && r.matchStatus !== st.matchStatus) return false;
      if (st.keyword && [r.mid, r.name, r.idNo, r.linkedCardId].join(' ').indexOf(st.keyword) < 0) return false;
      return true;
    });

    var tableRows = rows.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td>' +
        '<td><a href="javascript:void(0)" style="color:var(--primary)" onclick="deathCauseDetail(\'' + esc(r.mid) + '\')">' + esc(r.mid) + '</a></td>' +
        '<td>' + badge(r.existStatus === '存在' ? '库内存在' : '库内不存在', r.existStatus === '存在' ? 'success' : 'muted') + '</td>' +
        '<td>' + matchBadge(r.matchStatus) + '</td>' +
        '<td>' + esc(r.name) + '</td><td>' + esc(r.idNo) + '</td><td>' + esc(r.sex) + '</td>' +
        '<td>' + esc(r.deathDate) + '</td><td>' + esc(r.cause) + '</td><td>' + esc(r.causeIcd) + '</td>' +
        '<td>' + esc(r.place) + '</td><td>' + esc(r.sourceType) + '</td>' +
        '<td>' + (r.linkedCardId
          ? '<a href="javascript:void(0)" style="color:var(--primary)" onclick="openReportCardFromBiz(\'' + esc(r.linkedCardId) + '\')">' + esc(r.linkedCardId) + '</a>'
          : '-') + '</td>' +
        '<td>' + esc(r.importTime.slice(0, 10)) + '</td>' +
        '<td class="sticky-col" style="white-space:nowrap">' +
        (r.matchStatus === '未匹配'
          ? '<button class="btn btn-primary btn-xs" onclick="deathCauseMatchOne(\'' + esc(r.mid) + '\')">匹配回写</button> '
          : '<button class="btn btn-ghost btn-xs" onclick="jumpToDeathByCard(\'' + esc(r.linkedCardId || '') + '\')">死亡列表</button> ') +
        '<button class="btn btn-ghost btn-xs" onclick="deathCauseDetail(\'' + esc(r.mid) + '\')">详情</button>' +
        '</td></tr>';
    }).join('') || '<tr><td colspan="15" style="text-align:center;padding:36px;color:#98a3b8">暂无外部死因数据。请先在「死因登记」上传或录入。</td></tr>';

    return '<div class="page-toolbar"><div class="toolbar-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="closeDeathCauseView()">返回列表</button>' +
      '<button class="btn btn-outline btn-sm" onclick="toast(\'导出Excel中...\')">导出Excel</button>' +
      '<button class="btn btn-primary btn-sm" onclick="deathCauseMatchBatch()">匹配更新' +
      (unmatched ? '（' + unmatched + '）' : '') + '</button>' +
      '</div></div>' +
      '<div class="panel"><div class="panel-body">' +
      '<div class="filter-toolbar">' +
      '<div class="form-group region-filter" style="min-width:200px"><label>行政区划</label>' + region() + '</div>' +
      '<div class="form-group"><label>校验状态</label><select onchange="deathCauseState.validation=this.value;renderPage(\'death-info\')">' +
      opt(['通过', '警告', '错误'], st.validation, '全部') + '</select></div>' +
      '<div class="form-group"><label>来源类型</label><select onchange="deathCauseState.sourceType=this.value;renderPage(\'death-info\')">' +
      opt(['死因上传', '批量导入', '接口', '单条登记'], st.sourceType, '全部') + '</select></div>' +
      '<div class="form-group"><label>匹配状态</label><select onchange="deathCauseState.matchStatus=this.value;renderPage(\'death-info\')">' +
      opt(['未匹配', '已匹配'], st.matchStatus, '全部') + '</select></div>' +
      '<div class="form-group"><label>日期类型</label><select><option>导入日期</option><option>死亡日期</option></select></div>' +
      '<div class="form-group date-group"><label>日期区间</label>' + dateRange('dr_death_cause', '', '') + '</div>' +
      '<div class="form-group search-group"><label>检索</label>' +
      '<input type="text" placeholder="死因编号 / 姓名 / 身份证号" value="' + esc(st.keyword || '') +
      '" onkeydown="if(event.key===\'Enter\'){deathCauseState.keyword=this.value;renderPage(\'death-info\')}"></div>' +
      '<div class="filter-actions"><button class="btn btn-ghost btn-sm" onclick="deathCauseState={validation:\'\',sourceType:\'\',matchStatus:\'\',keyword:\'\'};renderPage(\'death-info\')">重置</button></div>' +
      '</div>' +
      '<div style="margin-bottom:8px;color:#667085;font-size:13px">共 ' + rows.length + ' 条外部死因</div>' +
      '<div class="table-wrap"><table class="data-table" style="margin:0;min-width:1300px"><thead><tr>' +
      '<th>序号</th><th>死因编号</th><th>存在状态</th><th>匹配状态</th><th>姓名</th><th>身份证号</th><th>性别</th>' +
      '<th>死亡日期</th><th>根本死因</th><th>死因ICD</th><th>死亡地点</th><th>来源类型</th><th>关联报告卡</th><th>导入日期</th>' +
      '<th class="sticky-col" style="width:180px">操作</th></tr></thead><tbody>' + tableRows + '</tbody></table></div></div></div>';
  };

  window.deathCauseDetail = function (mid) {
    var r = seedCausePool().find(function (x) { return x.mid === mid; });
    if (!r) return;
    var link = r.linkedCardId
      ? '<button class="btn btn-ghost btn-xs" onclick="openReportCardFromBiz(\'' + esc(r.linkedCardId) + '\')">' + esc(r.linkedCardId) + '</button>'
      : '<span style="color:#98a2b3">尚未匹配报告卡</span>';
    document.querySelectorAll('.fu-modal-mask,.cd-overlay').forEach(function (el) { el.remove(); });
    document.body.insertAdjacentHTML('beforeend',
      '<div class="fu-modal-mask" onclick="if(event.target===this)this.remove()"><div class="fu-modal" style="width:min(720px,96vw)">' +
      '<div class="fu-modal-h"><span>死因详情 · ' + esc(r.mid) + '</span><span class="cd-close" onclick="this.closest(\'.fu-modal-mask\').remove()">×</span></div>' +
      '<div class="fu-modal-b">' +
      '<div style="margin-bottom:12px">' + valBadge(r.validation) + ' ' + matchBadge(r.matchStatus) +
      ' ' + badge(r.existStatus === '存在' ? '库内存在' : '库内不存在', r.existStatus === '存在' ? 'success' : 'muted') + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      [['姓名', r.name], ['身份证号', r.idNo], ['死亡日期', r.deathDate], ['根本死因', r.cause],
        ['死因ICD', r.causeIcd], ['死亡地点', r.place], ['来源', r.sourceType], ['导入时间', r.importTime],
        ['关联报告卡', '']].map(function (f, i) {
        if (i === 8) {
          return '<div style="grid-column:1/-1;background:#f8fafc;border:1px solid #eef2f7;border-radius:6px;padding:10px 12px">' +
            '<div style="font-size:12px;color:#64748b;margin-bottom:4px">关联报告卡</div><div>' + link + '</div></div>';
        }
        return '<div style="background:#f8fafc;border:1px solid #eef2f7;border-radius:6px;padding:10px 12px">' +
          '<div style="font-size:12px;color:#64748b;margin-bottom:4px">' + esc(f[0]) + '</div>' +
          '<div style="font-weight:600;font-size:13px">' + esc(f[1]) + '</div></div>';
      }).join('') +
      '</div></div><div class="fu-modal-f">' +
      '<button class="btn btn-ghost btn-sm" onclick="this.closest(\'.fu-modal-mask\').remove()">关闭</button>' +
      (r.matchStatus === '未匹配'
        ? '<button class="btn btn-primary btn-sm" onclick="this.closest(\'.fu-modal-mask\').remove();deathCauseMatchOne(\'' + esc(r.mid) + '\')">匹配更新</button>'
        : '<button class="btn btn-outline btn-sm" onclick="this.closest(\'.fu-modal-mask\').remove();jumpToDeathByCard(\'' + esc(r.linkedCardId || '') + '\')">死亡信息列表</button>') +
      '</div></div></div>');
  };

  window.deathCauseMatchOne = function (mid) {
    var cause = seedCausePool().find(function (x) { return x.mid === mid; });
    if (!cause || cause.matchStatus === '已匹配') { toast('已匹配或不存在'); return; }
    var res = applyCauseToFollowup(cause);
    if (!res.ok) { toast('匹配失败：' + res.reason, 'error'); return; }
    toast('已匹配并回写随访，可在死亡信息列表查看：' + res.cardId);
    renderPage('death-info');
  };

  window.deathCauseMatchBatch = function () {
    var list = liveCausePool().filter(function (r) { return r.matchStatus === '未匹配'; });
    if (!list.length) { toast('没有未匹配记录'); return; }
    showConfirm('匹配更新', '将对 ' + list.length + ' 条未匹配死因按身份证精确匹配并回写随访？', function () {
      var ok = 0, fail = 0;
      list.forEach(function (c) {
        if (applyCauseToFollowup(c).ok) ok++; else fail++;
      });
      toast('匹配完成：成功 ' + ok + '，失败 ' + fail + (ok ? '。回写记录已在死亡信息列表可见' : ''));
      window.deathInfoState.view = 'list';
      renderPage('death-info');
    });
  };

  function applyCauseToFollowup(cause) {
    // 1) 已有随访记录：按身份证回写
    var hit = followStore().find(function (f) { return f.idNo === cause.idNo; });
    if (hit) {
      if (cause.name && hit.name && cause.name !== hit.name) {
        return { ok: false, reason: '姓名与随访记录不一致' };
      }
      hit.status = '死亡';
      hit.voided = false;
      hit.lastContact = cause.lastContact || cause.deathDate;
      hit.deathDate = cause.deathDate;
      hit.cause = cause.cause === '肿瘤' ? ((hit.site || '') + '恶性肿瘤') : cause.cause;
      hit.causeIcd = cause.causeIcd;
      hit.place = cause.place;
      hit.source = '死因回写';
      hit.checkStatus = '未校验';
      cause.matchStatus = '已匹配';
      cause.linkedCardId = hit.reportCardId || hit.id;
      cause.existStatus = '存在';
      syncArchive();
      return { ok: true, cardId: hit.id };
    }
    // 2) 报告卡库精确匹配后新建随访死亡记录
    if ((!window.reportCardListData || !window.reportCardListData.length) && typeof renderReportCardList === 'function') {
      try { renderReportCardList(); } catch (e) { /* ignore */ }
    }
    var cards = window.reportCardListData || [];
    var matched = cards.filter(function (c) { return c.idNo === cause.idNo; });
    if (!matched.length) return { ok: false, reason: '报告卡库无此身份证' };
    if (cause.name && matched[0].name && cause.name !== matched[0].name) {
      return { ok: false, reason: '姓名与报告卡不一致' };
    }
    var card = matched[0];
    var rec = {
      id: card.id, reportCardId: card.id, name: card.name, sex: card.sex, birth: card.birth,
      idNo: card.idNo, diagDate: card.diagnosisDate, site: card.site, icd10: card.icd10,
      region: card.region, unit: card.reportUnit, doctor: card.doctor, reportDate: card.reportDate,
      cardType: (card.cardType || '').replace(/<[^>]+>/g, '').trim() || '原始卡',
      status: '死亡', voided: false, lastContact: cause.lastContact || cause.deathDate, deathDate: cause.deathDate,
      cause: cause.cause === '肿瘤' ? ((card.site || '') + '恶性肿瘤') : cause.cause,
      causeIcd: cause.causeIcd, place: cause.place, source: '死因回写', checkStatus: '未校验',
      event: '无', reporter: '系统'
    };
    followStore().push(rec);
    cause.matchStatus = '已匹配';
    cause.linkedCardId = card.id;
    cause.existStatus = '存在';
    syncArchive();
    return { ok: true, cardId: card.id };
  }

  // ---------- 跳转 ----------
  window.jumpToDeathByCard = function (cardId) {
    window.deathInfoState = window.deathInfoState || {};
    window.deathInfoState.view = 'list';
    window.deathInfoState.reportCardId = cardId || '';
    window.deathInfoState.keyword = cardId || '';
    navigateTo('death-info');
  };
  window.jumpToDeathCause = function () { openDeathCauseView(); };

  var _origNav = window.navigateTo;
  if (typeof _origNav === 'function') {
    window.navigateTo = function (id) {
      if (id === 'death-cause') {
        window.deathInfoState = window.deathInfoState || {};
        window.deathInfoState.view = 'cause';
        return _origNav('death-info');
      }
      if (id === 'death-info') {
        window.deathInfoState = window.deathInfoState || {};
        window.deathInfoState.view = 'list';
      }
      if (id === 'death-register') {
        window.deathRegFilters = window.deathRegFilters || {};
        window.deathRegFilters.view = 'list';
      }
      if (id === 'followup') {
        window.followupRecordState = window.followupRecordState || {};
        window.followupRecordState.view = 'list';
      }
      return _origNav(id);
    };
  }

  // 兼容：直接 renderPage('death-cause') 时并入死亡信息列表匹配视图
  var _origRender = window.renderPage;
  if (typeof _origRender === 'function') {
    window.renderPage = function (id) {
      if (id === 'death-cause') {
        window.deathInfoState = window.deathInfoState || {};
        window.deathInfoState.view = 'cause';
        id = 'death-info';
      }
      return _origRender(id);
    };
  }

  // 初始化
  seedRegQueue();
  seedCausePool();
})();
