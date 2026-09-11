/* 待办工作台 + 随访管理（随访信息上传 / 随访计划） */
(function () {
  'use strict';

  window.todoWorkbenchState = window.todoWorkbenchState || { tab: 'audit' };
  window.followupPlanState = window.followupPlanState || { type: '', status: '', keyword: '', view: 'list', selected: [] };
  if (!Array.isArray(window.followupPlanState.selected)) window.followupPlanState.selected = [];
  window.followupRecordState = window.followupRecordState || { status: '', keyword: '' };

  var OUTCOME = ['存活', '死亡', '迁出', '失访', '拒访', '不详'];
  var METHODS = ['被动比对', '电话随访', '门诊随访', '入户调查'];
  var TASK_TYPES = ['首次随访', '年度随访', '重点癌种随访', '死亡核实', '失访追踪'];
  var KEY_SITES = ['肺', '乳腺', '乳房', '结直肠', '胃', '肝', '宫颈'];

  function badge(text, type) {
    return '<span class="badge badge-' + type + '">' + text + '</span>';
  }
  function outcomeBadge(s) {
    if (s === '存活') return badge(s, 'success');
    if (s === '死亡') return badge(s, 'danger');
    if (s === '迁出') return badge(s, 'info');
    if (s === '失访' || s === '拒访') return badge(s, 'warning');
    return badge(s || '不详', 'muted');
  }
  function typeBadge(t) {
    if (t === '死亡核实') return badge(t, 'warning');
    if (t === '失访追踪') return badge(t, 'danger');
    if (t === '重点癌种随访') return badge(t, 'info');
    return badge(t, 'info');
  }
  function statusBadge(s) {
    if (s === '逾期') return badge('逾期', 'danger');
    if (s === '已完成') return badge('已完成', 'success');
    if (s === '已关闭') return badge('已关闭', 'muted');
    if (s === '退回') return badge('退回', 'warning');
    return badge('待执行', 'warning');
  }

  if (!window.followupData || !window.followupData.length) {
    window.followupData = [
      { id: 'JX20240001', name: '张伟', sex: '男', diagDate: '2024-03-15', site: '肺', region: '南昌市东湖区', lastContact: '2026-01-10', status: '存活', deathDate: '-', doctor: '王医生', unit: '南昌市东湖区疾控', event: '无', source: '电话随访', reporter: '张上报员' },
      { id: 'JX20240004', name: '李娜', sex: '女', diagDate: '2024-05-20', site: '乳腺', region: '南昌市西湖区', lastContact: '2025-11-02', status: '死亡', deathDate: '2025-11-02', doctor: '李医生', unit: '南昌市西湖区疾控', event: '转移', source: '死因比对', reporter: '系统' },
      { id: 'JX20240006', name: '王强', sex: '男', diagDate: '2024-01-15', site: '胃', region: '赣州市章贡区', lastContact: '2025-06-18', status: '失访', deathDate: '-', doctor: '刘医生', unit: '赣州市章贡区卫健委', event: '无', source: '失访认定', reporter: '刘上报员' },
      { id: 'JX20240008', name: '赵敏', sex: '女', diagDate: '2025-08-12', site: '结直肠', region: '南昌市青云谱区', lastContact: '2025-11-20', status: '存活', deathDate: '-', doctor: '周医生', unit: '南昌市青云谱区疾控', event: '无', source: '门诊随访', reporter: '周上报员' },
      { id: 'JX20240010', name: '孙丽', sex: '女', diagDate: '2025-02-08', site: '肝', region: '九江市浔阳区', lastContact: '2025-09-01', status: '迁出', deathDate: '-', doctor: '陈医生', unit: '九江市浔阳区疾控', event: '无', source: '民政比对', reporter: '系统' },
      { id: 'JX20240012', name: '周杰', sex: '男', diagDate: '2025-10-01', site: '肺', region: '南昌市东湖区', lastContact: '2025-10-01', status: '存活', deathDate: '-', doctor: '王医生', unit: '南昌市东湖区疾控', event: '无', source: '新发入库', reporter: '系统' }
    ];
  }
  var followupData = window.followupData;

  function seedTasks() {
    return [
      { tid: 'FU-001', id: 'JX20240004', patient: '李娜', diag: '乳腺', diagDate: '2024-05-20', region: '南昌市西湖区', nextDate: '2026-06-28', type: '死亡核实', channel: '被动', method: '被动比对', assignee: '李上报员', unit: '南昌市西湖区疾控', status: '待执行', priority: 1 },
      { tid: 'FU-002', id: 'JX20240006', patient: '王强', diag: '胃', diagDate: '2024-01-15', region: '赣州市章贡区', nextDate: '2026-06-01', type: '失访追踪', channel: '主动', method: '入户调查', assignee: '刘上报员', unit: '赣州市章贡区卫健委', status: '逾期', priority: 2 },
      { tid: 'FU-003', id: 'JX20240012', patient: '周杰', diag: '肺', diagDate: '2025-10-01', region: '南昌市东湖区', nextDate: '2026-01-01', type: '首次随访', channel: '被动', method: '被动比对', assignee: '张上报员', unit: '南昌市东湖区疾控', status: '待执行', priority: 3 },
      { tid: 'FU-004', id: 'JX20240008', patient: '赵敏', diag: '结直肠', diagDate: '2025-08-12', region: '南昌市青云谱区', nextDate: '2026-05-20', type: '重点癌种随访', channel: '主动', method: '电话随访', assignee: '周上报员', unit: '南昌市青云谱区疾控', status: '待执行', priority: 3 },
      { tid: 'FU-005', id: 'JX20240001', patient: '张伟', diag: '肺', diagDate: '2024-03-15', region: '南昌市东湖区', nextDate: '2026-07-10', type: '年度随访', channel: '被动', method: '被动比对', assignee: '张上报员', unit: '南昌市东湖区疾控', status: '待执行', priority: 4 },
      { tid: 'FU-006', id: 'JX20240008', patient: '赵敏', diag: '结直肠', diagDate: '2025-08-12', region: '南昌市青云谱区', nextDate: '2026-08-12', type: '年度随访', channel: '被动', method: '被动比对', assignee: '周上报员', unit: '南昌市青云谱区疾控', status: '待执行', priority: 4 }
    ];
  }

  var seeded = seedTasks();
  if (typeof followupPlanData !== 'undefined' && Array.isArray(followupPlanData)) {
    if (!followupPlanData.length || !followupPlanData[0].tid) {
      followupPlanData.length = 0;
      seeded.forEach(function (t) { followupPlanData.push(t); });
    }
    window.followupPlanData = followupPlanData;
  } else if (!window.followupPlanData || !window.followupPlanData[0] || !window.followupPlanData[0].tid) {
    window.followupPlanData = seeded;
  }
  function planList() {
    return (typeof followupPlanData !== 'undefined' && Array.isArray(followupPlanData)) ? followupPlanData : window.followupPlanData;
  }
  function openTasks() {
    return planList().filter(function (t) { return t.status === '待执行' || t.status === '逾期'; });
  }

  function ensureStyles() {
    if (document.getElementById('fu-v2-styles')) return;
    var s = document.createElement('style');
    s.id = 'fu-v2-styles';
    s.textContent =
      '.fu-seg{display:inline-flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;background:#fff}' +
      '.fu-seg button{border:0;background:transparent;padding:8px 16px;font-size:13px;font-weight:600;color:#64748b;cursor:pointer}' +
      '.fu-seg button+button{border-left:1px solid var(--border)}' +
      '.fu-seg button.active{background:var(--primary);color:#fff}' +
      '.fu-seg button .n{margin-left:6px;opacity:.85;font-weight:500}' +
      '.fu-modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:220;display:flex;align-items:center;justify-content:center}' +
      '.fu-modal{background:#fff;border-radius:8px;width:520px;max-width:94vw;box-shadow:0 8px 32px rgba(0,0,0,.2)}' +
      '.fu-modal-h{padding:14px 18px;border-bottom:1px solid var(--border);font-weight:600;display:flex;justify-content:space-between;align-items:center}' +
      '.fu-modal-b{padding:16px 18px}' +
      '.fu-modal-f{padding:12px 18px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px}' +
      '.fc-table{min-width:0}' +
      '.fc-table th,.fc-table td{padding:0 10px}' +
      '.fc-int{display:inline-flex;align-items:center;gap:6px}' +
      '.fc-int input{width:66px;height:30px;border:1px solid var(--border);border-radius:4px;padding:0 6px;font-size:13px;text-align:center;background:#fff;color:#1f2937}' +
      '.fc-int input:focus{outline:0;border-color:var(--primary)}' +
      '.fc-int input:disabled{background:#f5f7fa;color:#94a3b8;border-style:dashed}' +
      '.fc-int span{font-size:13px;color:#475569}';
    document.head.appendChild(s);
  }

  function closeFuModal() {
    document.querySelectorAll('.fu-modal-mask').forEach(function (el) { el.remove(); });
  }

  function openExecuteModal(tid, fromTodo) {
    var t = planList().find(function (x) { return x.tid === tid; });
    if (!t) { toast('未找到任务', 'error'); return; }
    closeFuModal();
    ensureStyles();
    var outcomeOpts = OUTCOME.map(function (o) {
      return '<option' + (o === '存活' ? ' selected' : '') + '>' + o + '</option>';
    }).join('');
    var methodOpts = METHODS.map(function (m) {
      return '<option' + (m === t.method ? ' selected' : '') + '>' + m + '</option>';
    }).join('');
    document.body.insertAdjacentHTML('beforeend',
      '<div class="fu-modal-mask" onclick="if(event.target===this)closeFuModal()">' +
      '<div class="fu-modal"><div class="fu-modal-h"><span>执行随访</span><span class="cd-close" onclick="closeFuModal()">×</span></div>' +
      '<div class="fu-modal-b">' +
      '<div style="margin-bottom:14px;font-size:13px;color:#475569">' + t.patient + ' · ' + t.diag + '　' + t.id + '　' + typeBadge(t.type) + '</div>' +
      '<div class="form-grid" style="grid-template-columns:1fr 1fr">' +
      '<div class="form-group"><label>随访方式</label><select id="fuExecMethod">' + methodOpts + '</select></div>' +
      '<div class="form-group"><label>接触日期</label><input type="date" id="fuExecDate" value="2026-07-22"></div>' +
      '<div class="form-group"><label>结局</label><select id="fuExecOutcome" onchange="fuExecOutcomeToggle()">' + outcomeOpts + '</select></div>' +
      '<div class="form-group" id="fuDeathWrap" style="display:none"><label>死亡日期</label><input type="date" id="fuExecDeath"></div>' +
      '<div class="form-group"><label>事件</label><select id="fuExecEvent"><option>无</option><option>复发</option><option>转移</option></select></div>' +
      '</div></div>' +
      '<div class="fu-modal-f"><button class="btn btn-ghost btn-sm" onclick="closeFuModal()">取消</button>' +
      '<button class="btn btn-primary btn-sm" onclick="fuConfirmExecute(\'' + tid + '\',' + !!fromTodo + ')">确认入库</button></div>' +
      '</div></div>');
    fuExecOutcomeToggle();
  }

  function fuExecOutcomeToggle() {
    var v = (document.getElementById('fuExecOutcome') || {}).value;
    var wrap = document.getElementById('fuDeathWrap');
    if (wrap) wrap.style.display = v === '死亡' ? '' : 'none';
  }

  function fuConfirmExecute(tid, fromTodo) {
    var t = planList().find(function (x) { return x.tid === tid; });
    if (!t) return;
    var outcome = (document.getElementById('fuExecOutcome') || {}).value || '存活';
    var method = (document.getElementById('fuExecMethod') || {}).value || '电话随访';
    var date = (document.getElementById('fuExecDate') || {}).value || '2026-07-22';
    var death = (document.getElementById('fuExecDeath') || {}).value || date;
    var event = (document.getElementById('fuExecEvent') || {}).value || '无';
    t.status = '已完成';
    t.method = method;
    t.channel = method === '被动比对' ? '被动' : '主动';
    t.outcome = outcome;
    var rec = followupData.find(function (r) { return r.id === t.id; });
    if (rec) {
      rec.lastContact = date;
      rec.status = outcome === '迁出' ? '移居' : outcome;
      rec.deathDate = outcome === '死亡' ? death : '-';
      if (outcome === '死亡') {
        rec.place = rec.place && rec.place !== '-' ? rec.place : '医院';
        rec.cause = rec.cause && rec.cause !== '-' ? rec.cause : ((rec.site || '') + '恶性肿瘤');
        rec.causeIcd = rec.causeIcd && rec.causeIcd !== '-' ? rec.causeIcd : (rec.icd10 || '-');
        rec.checkStatus = (!rec.causeIcd || rec.causeIcd === '-') ? '校验错误' : (rec.checkStatus || '未校验');
      }
      rec.event = event;
      rec.source = method;
      rec.doctor = t.assignee;
      if (typeof window.syncFollowupToCardArchive === 'function') window.syncFollowupToCardArchive();
    }
    if (outcome === '死亡') {
      planList().forEach(function (x) {
        if (x.id === t.id && x.tid !== tid && (x.status === '待执行' || x.status === '逾期')) x.status = '已关闭';
      });
    }
    closeFuModal();
    toast(outcome === '死亡' ? ('已入库：' + t.patient + ' → 死亡（可在死亡信息列表查看）') : ('已入库：' + t.patient + ' → ' + outcome));
    renderPage(fromTodo ? 'quality-todo' : 'followup-plan');
  }

  function fuReturnTask(tid, fromTodo) {
    var t = planList().find(function (x) { return x.tid === tid; });
    if (!t) return;
    showConfirm('退回任务', '确定退回 ' + t.patient + ' 的「' + t.type + '」？', function () {
      t.status = '退回';
      toast('已退回');
      renderPage(fromTodo ? 'quality-todo' : 'followup-plan');
    });
  }

  function setTodoTab(tab) {
    window.todoWorkbenchState.tab = tab;
    renderPage('quality-todo');
  }

  function sortOpen(list) {
    return list.slice().sort(function (a, b) {
      var ao = a.status === '逾期' ? 0 : 1;
      var bo = b.status === '逾期' ? 0 : 1;
      return ao - bo || (a.priority || 9) - (b.priority || 9);
    });
  }

  // ---------- 待办工作台 ----------
  window.renderQualityTodo = function () {
    ensureStyles();
    var tab = window.todoWorkbenchState.tab || 'audit';
    var auditData = typeof qualityTaskData !== 'undefined' ? qualityTaskData : [];
    var fuTodos = sortOpen(openTasks());

    var seg =
      '<div class="fu-seg">' +
      '<button class="' + (tab === 'audit' ? 'active' : '') + '" onclick="setTodoTab(\'audit\')">报卡审核<span class="n">' + auditData.length + '</span></button>' +
      '<button class="' + (tab === 'followup' ? 'active' : '') + '" onclick="setTodoTab(\'followup\')">随访任务<span class="n">' + fuTodos.length + '</span></button>' +
      '</div>';

    var toolbar =
      '<div class="page-toolbar"><div>' + seg + '</div><div class="toolbar-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="renderPage(\'quality-todo\')">刷新</button>' +
      '</div></div>';

    if (tab === 'audit') {
      var stats = ['待县区审核', '待市级审核', '待省级终审'].map(function (s) {
        var cnt = auditData.filter(function (t) { return t.type === s; }).length;
        return '<div class="dup-stat-card"><div class="dup-stat-label">' + s + '</div><div class="dup-stat-value">' + cnt + '</div></div>';
      }).join('') +
        '<div class="dup-stat-card danger"><div class="dup-stat-label">合计</div><div class="dup-stat-value">' + auditData.length + '</div></div>';
      var rows = auditData.map(function (t) {
        return '<tr><td>' + qualityTaskBadge(t.type) + '</td><td><a href="javascript:void(0)" style="color:var(--primary)">' + t.id +
          '</a></td><td>' + t.desc + '</td><td>' + t.source + '</td><td>' + t.time + '</td><td>' +
          '<button class="btn btn-primary btn-xs" onclick="toast(\'处理任务：' + t.id + '\')">处理</button> ' +
          '<button class="btn btn-ghost btn-xs" onclick="toast(\'任务已退回\')">退回</button></td></tr>';
      }).join('');
      return toolbar +
        '<div class="cards" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:14px">' + stats + '</div>' +
        '<div class="panel"><div class="panel-body">' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>任务类型</th><th>业务编号</th><th>任务说明</th><th>来源</th><th>时间</th><th style="width:160px">操作</th></tr></thead><tbody>' +
        rows + '</tbody></table></div></div></div>';
    }

    var overdue = fuTodos.filter(function (t) { return t.status === '逾期'; }).length;
    var passive = fuTodos.filter(function (t) { return t.channel === '被动'; }).length;
    var deathV = fuTodos.filter(function (t) { return t.type === '死亡核实'; }).length;
    var statsFu =
      '<div class="dup-stat-card danger"><div class="dup-stat-label">待办</div><div class="dup-stat-value">' + fuTodos.length + '</div></div>' +
      '<div class="dup-stat-card danger"><div class="dup-stat-label">逾期</div><div class="dup-stat-value">' + overdue + '</div></div>' +
      '<div class="dup-stat-card success"><div class="dup-stat-label">被动优先</div><div class="dup-stat-value">' + passive + '</div></div>' +
      '<div class="dup-stat-card warning"><div class="dup-stat-label">死亡核实</div><div class="dup-stat-value">' + deathV + '</div></div>';

    var rows = fuTodos.map(function (t) {
      return '<tr><td>' + typeBadge(t.type) + '</td><td><a href="javascript:void(0)" style="color:var(--primary)">' + t.id +
        '</a></td><td>' + t.patient + '</td><td>' + t.diag + '</td><td>' + (t.channel === '被动' ? badge('被动', 'success') : badge('主动', 'info')) +
        '</td><td>' + t.method + '</td><td>' + t.unit + '</td><td>' + t.assignee + '</td><td>' + t.nextDate +
        '</td><td>' + statusBadge(t.status) + '</td><td>' +
        '<button class="btn btn-primary btn-xs" onclick="openExecuteModal(\'' + t.tid + '\',true)">处理</button> ' +
        '<button class="btn btn-ghost btn-xs" onclick="fuReturnTask(\'' + t.tid + '\',true)">退回</button></td></tr>';
    }).join('') || '<tr><td colspan="11" style="text-align:center;color:#94a3b8;padding:28px">暂无随访待办</td></tr>';

    return toolbar +
      '<div class="cards" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:14px">' + statsFu + '</div>' +
      '<div class="panel"><div class="panel-body">' +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>类型</th><th>登记编号</th><th>姓名</th><th>部位</th><th>渠道</th><th>方式</th><th>单位</th><th>上报员</th><th>应访日期</th><th>状态</th><th style="width:140px">操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="void-pagination"><div class="void-pagination-info">共 ' + fuTodos.length + ' 条待办</div></div>' +
      '</div></div>';
  };

  // ---------- 随访计划（含批量派发） ----------
  window.closeFollowupBatchView = function () {
    window.followupPlanState.view = 'list';
    renderPage('followup-plan');
  };

  window.openFollowupBatchView = function () {
    window.followupPlanState.view = 'batch';
    setActiveMenu('followup-plan');
    renderPage('followup-plan');
    updateBreadcrumb('followup-plan');
  };

  window.renderFollowupPlan = function () {
    ensureStyles();
    if ((window.followupPlanState.view || 'list') === 'batch') {
      return renderFollowupBatch();
    }
    var st = window.followupPlanState;
    if (!Array.isArray(st.selected)) st.selected = [];
    var list = planList().filter(function (t) {
      if (st.type && t.type !== st.type) return false;
      if (st.status && t.status !== st.status) return false;
      if (st.keyword && [t.id, t.patient, t.unit, t.assignee].join(' ').indexOf(st.keyword) < 0) return false;
      return true;
    });
    list.sort(function (a, b) {
      var rank = function (s) { return s === '逾期' ? 0 : s === '待执行' ? 1 : 2; };
      return rank(a.status) - rank(b.status) || (a.priority || 9) - (b.priority || 9);
    });

    var typeOpts = [''].concat(TASK_TYPES).map(function (t) {
      return '<option value="' + t + '"' + (st.type === t ? ' selected' : '') + '>' + (t || '全部类型') + '</option>';
    }).join('');
    var statusOpts = ['', '待执行', '逾期', '已完成', '退回', '已关闭'].map(function (t) {
      return '<option value="' + t + '"' + (st.status === t ? ' selected' : '') + '>' + (t || '全部状态') + '</option>';
    }).join('');

    var selected = st.selected;
    var allChecked = list.length > 0 && list.every(function (t) { return selected.indexOf(t.tid) >= 0; });
    var rows = list.map(function (t) {
      var checked = selected.indexOf(t.tid) >= 0;
      var ops = (t.status === '待执行' || t.status === '逾期')
        ? '<button class="btn btn-primary btn-xs" onclick="openExecuteModal(\'' + t.tid + '\',false)">执行</button> <button class="btn btn-ghost btn-xs" onclick="fuReturnTask(\'' + t.tid + '\',false)">退回</button>'
        : '<button class="btn btn-ghost btn-xs" onclick="followupDetail(\'' + t.id + '\')">查看</button>';
      return '<tr>' +
        '<td style="width:40px"><input type="checkbox" class="fu-plan-check" data-tid="' + t.tid + '" ' + (checked ? 'checked' : '') +
        ' onchange="fuPlanToggleOne(\'' + t.tid + '\',this.checked)"></td>' +
        '<td>' + typeBadge(t.type) + '</td><td><a href="javascript:void(0)" style="color:var(--primary)" onclick="typeof openReportCardFromBiz===\'function\'?openReportCardFromBiz(\'' + t.id + '\'):toast(\'' + t.id + '\')">' + t.id +
        '</a></td><td>' + t.patient + '</td><td>' + t.diag + '</td><td>' + t.nextDate + '</td><td>' +
        (t.channel === '被动' ? badge('被动', 'success') : badge('主动', 'info')) + '</td><td>' + t.method +
        '</td><td>' + t.unit + '</td><td>' + t.assignee + '</td><td>' + statusBadge(t.status) + '</td><td>' + ops + '</td></tr>';
    }).join('') || '<tr><td colspan="12" style="text-align:center;color:#94a3b8;padding:28px">无匹配任务</td></tr>';

    var selCount = selected.length;
    var batchBar = selCount
      ? '<div class="void-batch-bar" style="margin-bottom:12px"><div class="void-batch-info">已选 <strong>' + selCount +
        '</strong> 条</div><div class="void-batch-actions">' +
        '<button class="btn btn-primary btn-sm" onclick="fuPlanBatchExecute()">批量执行</button> ' +
        '<button class="btn btn-outline btn-sm" onclick="fuPlanBatchReturn()">批量退回</button> ' +
        '<button class="btn btn-ghost btn-sm" onclick="fuPlanClearSelected()">取消选择</button>' +
        '</div></div>'
      : '';

    return '<div class="panel"><div class="panel-body">' +
      '<div class="filter-toolbar">' +
      '<div class="form-group"><label>任务类型</label><select onchange="followupPlanState.type=this.value;renderPage(\'followup-plan\')">' + typeOpts + '</select></div>' +
      '<div class="form-group"><label>状态</label><select onchange="followupPlanState.status=this.value;renderPage(\'followup-plan\')">' + statusOpts + '</select></div>' +
      '<div class="form-group search-group"><label>检索</label><input placeholder="编号 / 姓名 / 单位" value="' + (st.keyword || '').replace(/"/g, '&quot;') +
      '" onkeydown="if(event.key===\'Enter\'){followupPlanState.keyword=this.value;renderPage(\'followup-plan\')}"></div>' +
      '<div class="filter-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="followupPlanState.type=\'\';followupPlanState.status=\'\';followupPlanState.keyword=\'\';followupPlanState.selected=[];followupPlanState.view=\'list\';renderPage(\'followup-plan\')">重置</button>' +
      '<button class="btn btn-outline btn-sm" onclick="openFollowupBatchView()">批量派发</button>' +
      '</div>' +
      '</div>' + batchBar +
      '<div style="margin-bottom:8px;color:#667085;font-size:13px">共 ' + list.length + ' 条任务' +
      (selCount ? ' · 已选 ' + selCount + ' 条' : '') + '</div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th style="width:40px"><input type="checkbox" ' + (allChecked ? 'checked' : '') + ' onchange="fuPlanToggleAll(this.checked)" title="全选"></th>' +
      '<th>类型</th><th>登记编号</th><th>姓名</th><th>部位</th><th>应访日期</th><th>渠道</th><th>方式</th><th>单位</th><th>上报员</th><th>状态</th><th style="width:140px">操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="void-pagination"><div class="void-pagination-info">共' + list.length + '条记录，第1/1页</div>' +
      '<div class="void-pagination-controls"><button onclick="toast(\'已是第一页\')">‹</button><input type="text" value="1" readonly><button onclick="toast(\'已是最后一页\')">›</button></div></div>' +
      '</div></div>';
  };

  window.fuPlanToggleOne = function (tid, checked) {
    var st = window.followupPlanState;
    if (!Array.isArray(st.selected)) st.selected = [];
    var i = st.selected.indexOf(tid);
    if (checked && i < 0) st.selected.push(tid);
    if (!checked && i >= 0) st.selected.splice(i, 1);
    renderPage('followup-plan');
  };

  window.fuPlanToggleAll = function (checked) {
    var st = window.followupPlanState;
    var list = planList().filter(function (t) {
      if (st.type && t.type !== st.type) return false;
      if (st.status && t.status !== st.status) return false;
      if (st.keyword && [t.id, t.patient, t.unit, t.assignee].join(' ').indexOf(st.keyword) < 0) return false;
      return true;
    });
    st.selected = checked ? list.map(function (t) { return t.tid; }) : [];
    renderPage('followup-plan');
  };

  window.fuPlanClearSelected = function () {
    window.followupPlanState.selected = [];
    renderPage('followup-plan');
  };

  window.fuPlanBatchExecute = function () {
    var sel = (window.followupPlanState.selected || []).slice();
    var runnable = sel.map(function (tid) {
      return planList().find(function (t) { return t.tid === tid; });
    }).filter(function (t) {
      return t && (t.status === '待执行' || t.status === '逾期');
    });
    if (!runnable.length) {
      toast('所选任务均不可执行', 'error');
      return;
    }
    openExecuteModal(runnable[0].tid, false);
    toast('已打开首条可执行任务（共 ' + runnable.length + ' 条待执行）');
  };

  window.fuPlanBatchReturn = function () {
    var sel = (window.followupPlanState.selected || []).slice();
    var runnable = sel.map(function (tid) {
      return planList().find(function (t) { return t.tid === tid; });
    }).filter(function (t) {
      return t && (t.status === '待执行' || t.status === '逾期');
    });
    if (!runnable.length) {
      toast('所选任务均不可退回', 'error');
      return;
    }
    showConfirm('批量退回', '确定退回选中的 ' + runnable.length + ' 条任务？', function () {
      runnable.forEach(function (t) { t.status = '退回'; });
      window.followupPlanState.selected = [];
      toast('已退回 ' + runnable.length + ' 条');
      renderPage('followup-plan');
    });
  };

  // ---------- 随访信息上传（兜底；正式交互由 followup-death.js 覆盖） ----------
  window.followupDetail = function (id) {
    if (typeof window.ensureFollowupStore === 'function') { /* noop keep API */ }
    toast('请刷新页面后重试（随访详情由主模块提供）', 'warning');
  };

  /** 由 followup-death.js 覆盖为整页表单；此处仅作兜底跳转 */
  window.followupAddRecord = function (id) {
    if (typeof window.saveFollowupReportToRecord === 'function') {
      /* followup-death 已加载时不应走到这里；若走到则尝试整页入口 */
      var store = window.followupData || [];
      var r = store.find(function (x) { return x.id === id; });
      if (!r) { toast('未找到记录', 'error'); return; }
      window.followupEntryContext = {
        mode: 'followup',
        followupId: r.id,
        backPage: 'followup',
        prefill: {
          lastContact: r.lastContact, status: r.status, place: r.place,
          cause: r.cause, causeIcd: r.causeIcd || r.icd10, deathDate: r.deathDate,
          doctor: r.doctor, name: r.name, idNo: r.idNo, sex: r.sex, birth: r.birth
        }
      };
      navigateTo('death-entry');
      return;
    }
    toast('随访添加模块未加载，请刷新页面', 'error');
  };

  window.followupEdit = function (id) { return followupAddRecord(id); };

  window.fuSaveEdit = function () {
    toast('请使用「添加随访记录」整页表单', 'warning');
  };

  window.followupDelete = function (id) {
    showConfirm('删除确认', '确定删除 ' + id + '？', function () {
      var i = followupData.findIndex(function (x) { return x.id === id; });
      if (i >= 0) followupData.splice(i, 1);
      toast('已删除');
      renderPage('followup');
    });
  };

  window.renderFollowupRecords = function () {
    ensureStyles();
    var st = window.followupRecordState;
    var rowsData = followupData.filter(function (r) {
      if (st.status && r.status !== st.status) return false;
      if (st.keyword && [r.id, r.name, r.site, r.unit].join(' ').indexOf(st.keyword) < 0) return false;
      return true;
    });
    var statusOpts = [''].concat(OUTCOME).map(function (s) {
      return '<option value="' + s + '"' + (st.status === s ? ' selected' : '') + '>' + (s || '全部结局') + '</option>';
    }).join('');
    var rows = rowsData.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td><td><a href="javascript:void(0)" style="color:var(--primary)" onclick="followupDetail(\'' + r.id + '\')">' + r.id +
        '</a></td><td>' + r.name + '</td><td>' + r.sex + '</td><td>' + r.diagDate + '</td><td>' + r.site + '</td><td>' + r.lastContact +
        '</td><td>' + outcomeBadge(r.status) + '</td><td>' + ((r.event && r.event !== '无') ? r.event : '-') + '</td><td>' + r.deathDate +
        '</td><td>' + (r.source || '-') + '</td><td>' + r.doctor + '</td><td>' + r.unit +
        '</td><td><button class="btn btn-ghost btn-xs" onclick="followupDetail(\'' + r.id + '\')">查看</button> ' +
        '<button class="btn btn-primary btn-xs" onclick="followupAddRecord(\'' + r.id + '\')">添加</button></td></tr>';
    }).join('') || '<tr><td colspan="14" style="text-align:center;color:#94a3b8;padding:28px">无记录</td></tr>';

    return '<div class="page-toolbar"><div class="toolbar-actions">' +
      '<button class="btn btn-outline btn-sm" onclick="downloadTemplate()">下载模板</button>' +
      '</div></div>' +
      '<div class="panel"><div class="panel-body">' +
      '<div class="filter-toolbar">' +
      '<div class="form-group region-filter" style="min-width:200px"><label>行政区划</label>' +
      (typeof renderRegionCascader === 'function' ? renderRegionCascader() : '<input>') + '</div>' +
      '<div class="form-group"><label>随访年份</label><select><option>2026</option><option>2025</option><option>2024</option></select></div>' +
      '<div class="form-group"><label>结局</label><select onchange="followupRecordState.status=this.value;renderPage(\'followup\')">' + statusOpts + '</select></div>' +
      '<div class="form-group search-group"><label>检索</label><input placeholder="登记编号 / 姓名" value="' + (st.keyword || '').replace(/"/g, '&quot;') +
      '" onkeydown="if(event.key===\'Enter\'){followupRecordState.keyword=this.value;renderPage(\'followup\')}"></div>' +
      '<div class="filter-actions"><button class="btn btn-ghost btn-sm" onclick="followupRecordState={status:\'\',keyword:\'\'};renderPage(\'followup\')">重置</button></div>' +
      '</div>' +
      '<div style="margin-bottom:8px;color:#667085;font-size:13px">共 ' + rowsData.length + ' 条记录</div>' +
      '<div class="table-wrap"><table class="data-table" style="min-width:1180px"><thead><tr>' +
      '<th>序号</th><th>登记编号</th><th>姓名</th><th>性别</th><th>诊断日期</th><th>部位</th><th>最后接触</th><th>结局</th><th>事件</th><th>死亡日期</th><th>来源</th><th>医师</th><th>单位</th><th>操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="void-pagination"><div class="void-pagination-info">共' + rowsData.length + '条记录，第1/1页</div>' +
      '<div class="void-pagination-controls"><button onclick="toast(\'已是第一页\')">‹</button><input type="text" value="1" readonly><button onclick="toast(\'已是最后一页\')">›</button></div></div>' +
      '</div></div>';
  };

  // ---------- 批量派发（随访计划内视图） ----------
  window.renderFollowupBatch = function () {
    ensureStyles();
    var candidates = followupData.filter(function (r) { return r.status === '存活' || r.status === '失访' || r.status === '拒访'; });
    var typeOpts = TASK_TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('');
    var methodOpts = METHODS.map(function (m) { return '<option>' + m + '</option>'; }).join('');
    var checkRows = candidates.map(function (r, i) {
      return '<tr><td><input type="checkbox" class="batch-followup-check" data-id="' + r.id + '" ' + (i < 3 ? 'checked' : '') +
        ' onchange="followupBatchUpdateCount()"></td><td>' + r.id + '</td><td>' + r.name + '</td><td>' + r.site +
        '</td><td>' + r.lastContact + '</td><td>' + outcomeBadge(r.status) + '</td>' +
        '<td><select id="batchType_' + i + '">' + typeOpts + '</select></td>' +
        '<td><select id="batchMethod_' + i + '">' + methodOpts + '</select></td>' +
        '<td><input type="date" id="batchDate_' + i + '" value="2026-07-30" style="width:140px"></td></tr>';
    }).join('');

    return '<div class="page-toolbar"><div class="toolbar-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="closeFollowupBatchView()">返回计划</button>' +
      '</div></div>' +
      '<div class="panel"><div class="panel-body">' +
      '<div class="void-batch-bar"><div class="void-batch-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="document.querySelectorAll(\'.batch-followup-check\').forEach(function(c){c.checked=true});followupBatchUpdateCount()">全选</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="document.querySelectorAll(\'.batch-followup-check\').forEach(function(c){c.checked=false});followupBatchUpdateCount()">取消</button>' +
      '<button class="btn btn-primary btn-sm" onclick="followupBatchExecute()">确认派发</button>' +
      '</div></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th style="width:36px"><input type="checkbox" onclick="document.querySelectorAll(\'.batch-followup-check\').forEach(function(c){c.checked=this.checked}.bind(this));followupBatchUpdateCount()"></th>' +
      '<th>登记编号</th><th>姓名</th><th>部位</th><th>最后接触</th><th>结局</th><th>任务类型</th><th>方式</th><th>应访日期</th>' +
      '</tr></thead><tbody>' + checkRows + '</tbody></table></div></div></div>';
  };

  window.followupBatchUpdateCount = function () {
    var el = document.getElementById('batchCount');
    if (el) el.textContent = document.querySelectorAll('.batch-followup-check:checked').length;
  };

  window.followupBatchExecute = function () {
    var checks = Array.prototype.slice.call(document.querySelectorAll('.batch-followup-check:checked'));
    if (!checks.length) { toast('请至少选择一条', 'error'); return; }
    showConfirm('派发确认', '将选中的 ' + checks.length + ' 条派发为随访计划任务？', function () {
      var added = 0;
      var boxes = document.querySelectorAll('.batch-followup-check');
      checks.forEach(function (chk) {
        var id = chk.getAttribute('data-id');
        var idx = Array.prototype.indexOf.call(boxes, chk);
        var r = followupData.find(function (x) { return x.id === id; });
        if (!r) return;
        var type = (document.getElementById('batchType_' + idx) || {}).value || '年度随访';
        var method = (document.getElementById('batchMethod_' + idx) || {}).value || '被动比对';
        var nextDate = (document.getElementById('batchDate_' + idx) || {}).value || '2026-07-30';
        if (planList().some(function (t) { return t.id === id && t.type === type && (t.status === '待执行' || t.status === '逾期'); })) return;
        planList().push({
          tid: 'FU-B' + String(Date.now()).slice(-4) + added,
          id: r.id, patient: r.name, diag: r.site, diagDate: r.diagDate, region: r.region,
          nextDate: nextDate, type: type, channel: method === '被动比对' ? '被动' : '主动',
          method: method, assignee: r.reporter || '上报员', unit: r.unit, status: '待执行', priority: 3
        });
        added++;
      });
      toast('已派发 ' + added + ' 条到随访计划');
      window.followupPlanState.view = 'list';
      renderPage('followup-plan');
    });
  };

  window.followupTaskState = window.followupTaskState || {
    year: '2026', type: '', status: 'open', region: '', deadline: '', keyword: '', page: 1
  };
  window.followupTaskData = window.followupTaskData || [
    { tid: 'FT-2026-0001', reportCardNo: 'RC-2024-0021', year: '2026', type: '年度随访', status: '待完成', dueDate: '2026-08-15', region: '南昌市东湖区', unit: '南昌市东湖区疾控', id: 'JX20240001', name: '张伟', sex: '男', birth: '1980-06-12', idNo: '360102198006121234', address: '南昌市东湖区阳明路88号', phone: '138****2266', diagnosis: '肺癌', icd10: 'C34.9', diagDate: '2024-03-15', lastFollowup: '2026-01-10', lastContactStatus: '存活', history: [{ date: '2026-01-10', status: '存活', note: '电话随访，患者一般情况稳定' }] },
    { tid: 'FT-2026-0002', reportCardNo: 'RC-2026-0084', year: '2026', type: '初访', status: '待完成', dueDate: '2026-08-20', region: '南昌市西湖区', unit: '南昌市西湖区疾控', id: 'JX20240004', name: '李娜', sex: '女', birth: '1975-09-24', idNo: '360103197509241235', address: '南昌市西湖区抚生路16号', phone: '139****7712', diagnosis: '乳腺癌', icd10: 'C50.9', diagDate: '2026-07-22', lastFollowup: '-', lastContactStatus: '', history: [] },
    { tid: 'FT-2026-0003', reportCardNo: 'RC-2024-0106', year: '2026', type: '年度随访', status: '逾期', dueDate: '2026-07-31', region: '赣州市章贡区', unit: '赣州市章贡区卫健委', id: 'JX20240006', name: '王强', sex: '男', birth: '1968-02-11', idNo: '360702196802111236', address: '赣州市章贡区长征大道20号', phone: '136****9035', diagnosis: '胃癌', icd10: 'C16.9', diagDate: '2024-01-15', lastFollowup: '2025-06-18', lastContactStatus: '失访', history: [{ date: '2025-06-18', status: '失访', note: '电话无法接通' }] },
    { tid: 'FT-2026-0004', reportCardNo: 'RC-2025-0128', year: '2026', type: '年度随访', status: '已完成', dueDate: '2026-06-30', region: '南昌市青云谱区', unit: '南昌市青云谱区疾控', id: 'JX20240008', name: '赵敏', sex: '女', birth: '1986-11-03', idNo: '360104198611031237', address: '南昌市青云谱区三店西路9号', phone: '137****1188', diagnosis: '结直肠癌', icd10: 'C18.9', diagDate: '2025-08-12', lastFollowup: '2026-06-20', lastContactStatus: '存活', history: [{ date: '2026-06-20', status: '存活', note: '门诊随访' }], completedAt: '2026-06-20' },
    { tid: 'FT-2026-0005', reportCardNo: 'RC-2025-0150', year: '2026', type: '年度随访', status: '待完成', dueDate: '2026-09-30', region: '九江市浔阳区', unit: '九江市浔阳区疾控', id: 'JX20240010', name: '孙丽', sex: '女', birth: '1972-04-18', idNo: '360403197204181238', address: '九江市浔阳区自由路7号', phone: '135****4821', diagnosis: '肝癌', icd10: 'C22.9', diagDate: '2025-02-08', lastFollowup: '2025-09-01', lastContactStatus: '移居', history: [{ date: '2025-09-01', status: '迁居', note: '已迁出本辖区' }] },
    { tid: 'FT-2026-0006', reportCardNo: 'RC-2026-0212', year: '2026', type: '初访', status: '待完成', dueDate: '2026-08-28', region: '南昌市东湖区', unit: '南昌市东湖区疾控', id: 'JX20240012', name: '周杰', sex: '男', birth: '1990-07-09', idNo: '360102199007091239', address: '南昌市东湖区永外正街12号', phone: '158****6604', diagnosis: '肺癌', icd10: 'C34.9', diagDate: '2026-07-30', lastFollowup: '-', lastContactStatus: '', history: [] },
    { tid: 'FT-2025-0007', reportCardNo: 'RC-2023-0301', year: '2025', type: '年度随访', status: '已完成', dueDate: '2025-12-31', region: '南昌市东湖区', unit: '南昌市东湖区疾控', id: 'JX20230021', name: '陈国强', sex: '男', birth: '1966-03-20', idNo: '360102196603201240', address: '南昌市东湖区榕门路31号', phone: '139****5202', diagnosis: '肺癌', icd10: 'C34.9', diagDate: '2023-04-02', lastFollowup: '2025-11-18', lastContactStatus: '存活', history: [{ date: '2025-11-18', status: '存活', note: '电话随访' }], completedAt: '2025-11-18' },
    { tid: 'FT-2025-0008', reportCardNo: 'RC-2023-0344', year: '2025', type: '年度随访', status: '已完成', dueDate: '2025-12-31', region: '赣州市章贡区', unit: '赣州市章贡区卫健委', id: 'JX20230024', name: '刘芳', sex: '女', birth: '1981-12-08', idNo: '360702198112081241', address: '赣州市章贡区政和路5号', phone: '186****3019', diagnosis: '乳腺癌', icd10: 'C50.9', diagDate: '2023-06-18', lastFollowup: '2025-10-09', lastContactStatus: '存活', history: [{ date: '2025-10-09', status: '存活', note: '门诊随访' }], completedAt: '2025-10-09' },
    { tid: 'FT-2026-0009', reportCardNo: 'RC-2024-0455', year: '2026', type: '年度随访', status: '已终止', dueDate: '2026-12-31', region: '赣州市章贡区', unit: '赣州市章贡区卫健委', id: 'JX20240066', name: '周明', sex: '男', birth: '1958-05-14', idNo: '360702195805141230', address: '赣州市章贡区赣江源大道30号', phone: '137****8801', diagnosis: '食管癌', icd10: 'C15.9', diagDate: '2024-02-20', lastFollowup: '2025-07-10', lastContactStatus: '失访', history: [{ date: '2024-12-05', status: '失访', note: '电话无法接通' }, { date: '2025-07-10', status: '失访', note: '地址变更无法联系' }], terminateReason: '连续3年失访' }
  ];

  function followupTaskEsc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function ensureFollowupTaskStyles() {
    if (document.getElementById('followup-task-styles')) return;
    var style = document.createElement('style');
    style.id = 'followup-task-styles';
    style.textContent = '.fu-task-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:14px}.fu-task-stat{background:#fff;border-radius:10px;padding:14px 16px;position:relative;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}.fu-task-stat::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:4px 0 0 4px}.fu-task-stat:nth-child(1)::before{background:#3b82f6}.fu-task-stat:nth-child(2)::before{background:#22c55e}.fu-task-stat:nth-child(3)::before{background:#f59e0b}.fu-task-stat:nth-child(4)::before{background:#ef4444}.fu-task-stat:nth-child(5)::before{background:#8b5cf6}.fu-task-stat-label{font-size:12px;color:#94a3b8;font-weight:500;letter-spacing:.3px}.fu-task-stat-value{font-size:28px;font-weight:800;color:#1e293b;margin-top:4px;line-height:1.1}.fu-task-stat:nth-child(1) .fu-task-stat-value{color:#3b82f6}.fu-task-stat:nth-child(2) .fu-task-stat-value{color:#22c55e}.fu-task-stat:nth-child(3) .fu-task-stat-value{color:#f59e0b}.fu-task-stat:nth-child(4) .fu-task-stat-value{color:#ef4444}.fu-task-stat:nth-child(5) .fu-task-stat-value{color:#8b5cf6}.fu-task-stat-sub{font-size:11px;color:#cbd5e1;margin-top:4px}.fu-task-progress{height:6px;background:#f1f5f9;border-radius:999px;overflow:hidden;margin-top:6px}.fu-task-progress span{display:block;height:100%;background:linear-gradient(90deg,#22c55e,#4ade80);border-radius:999px;transition:width .4s ease}.fu-task-table{table-layout:auto}.fu-task-table th:last-child,.fu-task-table td:last-child{position:sticky;right:0;background:#fff;z-index:1}.fu-task-table thead th:last-child{background:#f8fafc;z-index:2}.fu-task-table td{vertical-align:middle}.fu-task-patient{font-weight:600;color:#1e293b}.fu-task-meta{font-size:12px;color:#64748b;margin-top:2px}.fu-task-address{max-width:180px;overflow:hidden;text-overflow:ellipsis}.fu-task-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:220;display:flex;align-items:center;justify-content:center}.fu-task-modal{background:#fff;border-radius:8px;width:720px;max-width:94vw;max-height:86vh;overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,.2)}.fu-task-modal-head{padding:14px 18px;border-bottom:1px solid var(--border);font-weight:600;display:flex;justify-content:space-between}.fu-task-modal-body{padding:16px 18px}.fu-task-modal-foot{padding:12px 18px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px}.fu-task-history-row{display:grid;grid-template-columns:120px 90px 1fr;gap:12px;padding:11px 0;border-bottom:1px solid #eef2f7;font-size:13px}.fu-task-history-row:last-child{border-bottom:0}@media(max-width:900px){.fu-task-stats{grid-template-columns:repeat(2,1fr)}.fu-task-history-row{grid-template-columns:1fr;gap:3px}}';
    document.head.appendChild(style);
  }

  function followupTaskStatusBadge(status) {
    if (status === '已完成') return badge(status, 'success');
    if (status === '逾期') return badge(status, 'danger');
    if (status === '已终止') return badge(status + (status.terminateReason ? '' : ''), 'muted');
    if (status === '已关闭') return badge(status, 'muted');
    return badge(status || '待完成', 'warning');
  }

  function followupTaskList() {
    var state = window.followupTaskState;
    return (window.followupTaskData || []).filter(function (task) {
      if (state.year && task.year !== state.year) return false;
      if (state.type && task.type !== state.type) return false;
      if (state.status === 'open' && task.status !== '待完成' && task.status !== '逾期') return false;
      if (state.status && state.status !== 'open' && task.status !== state.status) return false;
      if (state.region && task.region !== state.region) return false;
      if (state.deadline === 'overdue' && task.status !== '逾期') return false;
      if (state.deadline === 'near' && (task.dueDate < '2026-08-06' || task.dueDate > '2026-08-13')) return false;
      if (state.deadline === 'month' && (task.dueDate < '2026-08-01' || task.dueDate > '2026-08-31')) return false;
      if (state.keyword && [task.tid, task.id, task.name, task.idNo, task.diagnosis, task.icd10, task.address, task.phone].join(' ').indexOf(state.keyword) < 0) return false;
      return true;
    });
  }

  window.renderFollowupTasks = function () {
    ensureFollowupTaskStyles();
    var state = window.followupTaskState;
    var list = followupTaskList();
    var allForStats = (window.followupTaskData || []).filter(function (task) {
      if (state.year && task.year !== state.year) return false;
      if (state.type && task.type !== state.type) return false;
      if (state.region && task.region !== state.region) return false;
      return true;
    });
    var completed = allForStats.filter(function (task) { return task.status === '已完成'; }).length;
    var overdue = allForStats.filter(function (task) { return task.status === '逾期'; }).length;
    var remaining = allForStats.filter(function (task) { return task.status === '待完成' || task.status === '逾期'; }).length;
    var rate = allForStats.length ? Math.round(completed / allForStats.length * 100) : 0;
    var years = ['2026', '2025', '2024'];
    var regions = Array.from(new Set((window.followupTaskData || []).map(function (task) { return task.region; })));
    var options = function (values, current, placeholder) {
      return '<option value="">' + placeholder + '</option>' + values.map(function (value) { return '<option value="' + followupTaskEsc(value) + '"' + (current === value ? ' selected' : '') + '>' + followupTaskEsc(value) + '</option>'; }).join('');
    };
    var rows = list.map(function (task, index) {
      var canExecute = task.status === '待完成' || task.status === '逾期';
      var actionBtn = canExecute
        ? '<button class="btn btn-primary btn-xs" onclick="openFollowupTaskExecute(\'' + task.tid + '\')">执行随访</button> '
        : '<button class="btn btn-ghost btn-xs" onclick="openFollowupTaskHistory(\'' + task.tid + '\')">查看记录</button> ';
      var lcStatus = task.lastContactStatus ? outcomeBadge(task.lastContactStatus) : '<span style="color:#94a3b8">—</span>';
      return '<tr>' +
        '<td style="font-size:12px"><a href="javascript:void(0)" style="color:var(--primary)" onclick="typeof openReportCardFromBiz===\'function\'?openReportCardFromBiz(\'' + followupTaskEsc(task.id) + '\'):toast(\'报卡详情：' + followupTaskEsc(task.reportCardNo || task.id) + '\')">' + followupTaskEsc(task.reportCardNo || task.id) + '</a></td>' +
        '<td>' + typeBadge(task.type) + '</td>' +
        '<td>' + followupTaskStatusBadge(task.status) + '</td>' +
        '<td>' + followupTaskEsc(task.lastFollowup) + '</td>' +
        '<td>' + lcStatus + '</td>' +
        '<td><span class="fu-task-patient">' + followupTaskEsc(task.name) + '</span></td>' +
        '<td>' + followupTaskEsc(task.sex) + '</td>' +
        '<td>' + followupTaskEsc(task.birth) + '</td>' +
        '<td>' + followupTaskEsc(task.idNo) + '</td>' +
        '<td class="fu-task-address" title="' + followupTaskEsc(task.address) + '">' + followupTaskEsc(task.address) + '</td>' +
        '<td>' + followupTaskEsc(task.phone) + '</td>' +
        '<td>' + followupTaskEsc(task.diagnosis) + '</td>' +
        '<td>' + followupTaskEsc(task.icd10) + '</td>' +
        '<td>' + followupTaskEsc(task.diagDate) + '</td>' +
        '<td>' + followupTaskEsc(task.dueDate) + '</td>' +
        '<td>' + followupTaskEsc(task.region) + '</td>' +
        '<td><button class="btn btn-ghost btn-xs" onclick="openFollowupTaskHistory(\'' + task.tid + '\')">随访历史</button> ' + actionBtn + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="17" style="text-align:center;color:#94a3b8;padding:36px">' + (state.status === 'open' ? '暂无待随访任务' : '暂无匹配的待随访任务') + '</td></tr>';
    var keyword = followupTaskEsc(state.keyword || '');
    return '<div class="fu-task-stats"><div class="fu-task-stat"><div class="fu-task-stat-label">应随访数</div><div class="fu-task-stat-value">' + allForStats.length + '</div><div class="fu-task-stat-sub">当前筛选范围</div></div><div class="fu-task-stat success"><div class="fu-task-stat-label">已完成数</div><div class="fu-task-stat-value">' + completed + '</div><div class="fu-task-stat-sub">已完成本年度任务</div></div><div class="fu-task-stat warning"><div class="fu-task-stat-label">剩余数</div><div class="fu-task-stat-value">' + remaining + '</div><div class="fu-task-stat-sub">待完成 + 逾期</div></div><div class="fu-task-stat danger"><div class="fu-task-stat-label">逾期数</div><div class="fu-task-stat-value">' + overdue + '</div><div class="fu-task-stat-sub">超过应访截止日期</div></div><div class="fu-task-stat"><div class="fu-task-stat-label">完成率</div><div class="fu-task-stat-value">' + rate + '%</div><div class="fu-task-progress"><span style="width:' + rate + '%"></span></div></div></div>' +
      '<div class="panel"><div class="panel-body"><div class="filter-toolbar"><div class="form-group"><label>随访年度</label><select onchange="followupTaskState.year=this.value;followupTaskState.page=1;renderPage(\'followup-tasks\')">' + options(years, state.year, '全部年度') + '</select></div><div class="form-group"><label>任务类型</label><select onchange="followupTaskState.type=this.value;followupTaskState.page=1;renderPage(\'followup-tasks\')">' + options(['初访', '年度随访'], state.type, '全部类型') + '</select></div><div class="form-group region-filter" style="min-width:200px"><label>行政区划</label>' + (typeof renderRegionCascader === 'function' ? renderRegionCascader() : '<input>') + '</div><div class="form-group"><label>登记处</label><select onchange="followupTaskState.region=this.value;followupTaskState.page=1;renderPage(\'followup-tasks\')">' + options(regions, state.region, '全部登记处') + '</select></div><div class="form-group"><label>应访截止</label><select onchange="followupTaskState.deadline=this.value;followupTaskState.page=1;renderPage(\'followup-tasks\')"><option value="">全部日期</option><option value="overdue"' + (state.deadline === 'overdue' ? ' selected' : '') + '>已逾期</option><option value="near"' + (state.deadline === 'near' ? ' selected' : '') + '>未来7天</option><option value="month"' + (state.deadline === 'month' ? ' selected' : '') + '>本月截止</option></select></div><div class="form-group search-group"><label>关键字</label><input value="' + keyword + '" placeholder="姓名 / 身份证号 / 诊断" onkeydown="if(event.key===\'Enter\'){followupTaskState.keyword=this.value.trim();followupTaskState.page=1;renderPage(\'followup-tasks\')}"></div><div class="filter-actions"><button class="btn btn-ghost btn-sm" onclick="resetFollowupTaskFilters()">重置</button><button class="btn btn-outline btn-sm" onclick="exportFollowupTasks()">导出 Excel</button></div></div><div style="margin:4px 0 10px;color:#667085;font-size:13px">共 ' + list.length + ' 条，其中逾期 ' + list.filter(function(t){return t.status==='逾期'}).length + ' 条 · 当前账号仅展示本登记处管辖范围</div><div class="table-wrap"><table class="data-table fu-task-table" style="min-width:2200px"><thead><tr><th>报告卡编号</th><th>任务类型</th><th>状态</th><th>末次随访日期</th><th>末次随访状态</th><th>姓名</th><th>性别</th><th>出生日期</th><th>身份证号</th><th>常住地址</th><th>联系电话</th><th>诊断名称</th><th>ICD-10</th><th>发病日期</th><th>应访截止</th><th>所属登记处</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="void-pagination"><div class="void-pagination-info">共' + list.length + '条记录</div><div class="void-pagination-controls"><button onclick="toast(\'已是第一页\')">‹</button><input type="text" value="1" readonly><button onclick="toast(\'已是最后一页\')">›</button></div></div></div></div>';
  };

  window.resetFollowupTaskFilters = function () {
    window.followupTaskState = { year: '2026', type: '', status: 'open', region: '', deadline: '', keyword: '', page: 1 };
    renderPage('followup-tasks');
  };

  window.openFollowupTaskExecute = function (tid) {
    var task = (window.followupTaskData || []).find(function (item) { return item.tid === tid; });
    if (!task) { toast('未找到随访任务', 'error'); return; }
    var record = (window.followupData || []).find(function (item) { return item.id === task.id; }) || {};
    window.followupEntryContext = { mode: 'followup', taskId: task.tid, followupId: task.id, backPage: 'followup-tasks', prefill: { followupDate: '', lastContact: '', status: '', lostReason: '', place: '', cause: '', causeIcd: '', deathDate: '', doctor: record.doctor || '', name: task.name, idNo: task.idNo, sex: task.sex, birth: task.birth, unit: task.unit, region: task.region } };
    navigateTo('death-entry');
    setActiveMenu('followup-tasks');
    updateBreadcrumb('followup-tasks', '执行随访');
  };

  window.completeFollowupTask = function (tid, data) {
    var tasks = window.followupTaskData || [];
    var task = tasks.find(function (item) { return item.tid === tid; });
    if (!task) return false;
    if (data.lastContact && data.lastContact < task.diagDate) toast('最后接触日期早于发病日期，请核对病例信息', 'warning');

    /* 连续3年失访判定（需求§9.2）：检查该报告卡历史中最近连续失访年数 */
    if (data.status === '失访') {
      var hist = task.history || [];
      var consecLost = 0;
      for (var h = hist.length - 1; h >= 0; h--) {
        if (hist[h].status === '失访') consecLost++;
        else break;
      }
      /* 历史已有2次连续失访 + 本次 = 连续3年 */
      if (consecLost >= 2) {
        var confirmed = confirm('该病例已连续3个随访年度结局均为失访，保存后将终止主动随访、不再进入待随访列表。\n\n确定继续保存？');
        if (!confirmed) return false;
        task.status = '已终止';
        task.terminateReason = '连续3年失访';
        task.completedAt = new Date().toISOString().slice(0, 10);
        task.outcome = data.status;
        toast('已连续3年失访，任务已终止', 'warning');
        window.followupTaskState.page = 1;
        return true;
      }
    }

    /* 正常闭环：标记为已完成（不从数组中移除，需求§7.4"保存即完成"） */
    task.status = '已完成';
    task.completedAt = new Date().toISOString().slice(0, 10);
    task.outcome = data.status;

    /* 死亡人级传播（需求§9.1/§12.2）：同人全部灶未完成任务终止 */
    if (data.status === '死亡') {
      tasks.forEach(function (item) {
        if (item.id === task.id && item.tid !== tid && (item.status === '待完成' || item.status === '逾期')) {
          item.status = '已终止';
          item.terminateReason = '患者死亡';
        }
      });
    }
    window.followupTaskState.page = 1;
    return true;
  };

  window.openFollowupTaskHistory = function (tid) {
    var task = (window.followupTaskData || []).find(function (item) { return item.tid === tid; });
    if (!task) { toast('未找到随访任务', 'error'); return; }
    if (typeof window.followupRecordState !== 'undefined') window.followupRecordState.keyword = task.id;
    navigateTo('followup');
    if (typeof setActiveMenu === 'function') setActiveMenu('followup');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('followup', '随访记录');
  };

  window.exportFollowupTasks = function () {
    var list = followupTaskList();
    var headers = ['任务编号', '随访年度', '任务类型', '任务状态', '应访截止', '登记处', '登记编号', '姓名', '性别', '出生日期', '身份证号', '常住地址', '联系电话', '诊断名称', 'ICD-10编码', '发病日期', '末次随访日期'];
    var lines = [headers].concat(list.map(function (task) { return [task.tid, task.year, task.type, task.status, task.dueDate, task.region, task.id, task.name, task.sex, task.birth, task.idNo, task.address, task.phone, task.diagnosis, task.icd10, task.diagDate, task.lastFollowup]; })).map(function (row) { return row.map(function (cell) { return '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"'; }).join(','); });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '待随访任务_' + (window.followupTaskState.year || '全部') + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast('已导出当前筛选结果');
  };
  window.closeFuModal = closeFuModal;
  window.openExecuteModal = openExecuteModal;
  window.fuExecOutcomeToggle = fuExecOutcomeToggle;
  window.fuConfirmExecute = fuConfirmExecute;
  window.fuReturnTask = fuReturnTask;
  window.setTodoTab = setTodoTab;

  var _origNav = window.navigateTo;
  if (typeof _origNav === 'function') {
    window.navigateTo = function (id) {
      if (id === 'followup-batch') {
        window.followupPlanState = window.followupPlanState || {};
        window.followupPlanState.view = 'batch';
        return _origNav('followup-plan');
      }
      if (id === 'followup-plan') {
        window.followupPlanState = window.followupPlanState || {};
        window.followupPlanState.view = 'list';
      }
      return _origNav(id);
    };
  }

  // ---------- 随访周期管理（癌种 → 随访间隔期） ----------
  window.followupCycleState = window.followupCycleState || { cancer: '', status: '' };

  var CYCLE_DEFAULTS = [
    { id: 'FC-001', cancer: '鼻咽恶性肿瘤', icd: 'C11.9', interval: 3, status: '启用' },
    { id: 'FC-002', cancer: '唇、口腔恶性肿瘤', icd: 'C06.9', interval: 3, status: '启用' },
    { id: 'FC-003', cancer: '食管恶性肿瘤', icd: 'C15.9', interval: 3, status: '启用' },
    { id: 'FC-004', cancer: '胃恶性肿瘤', icd: 'C16.9', interval: 3, status: '启用' },
    { id: 'FC-005', cancer: '结直肠恶性肿瘤', icd: 'C18.9', interval: 3, status: '启用' },
    { id: 'FC-006', cancer: '肝和肝内胆管恶性肿瘤', icd: 'C22.9', interval: 2, status: '启用' },
    { id: 'FC-007', cancer: '胰腺恶性肿瘤', icd: 'C25.9', interval: 2, status: '启用' },
    { id: 'FC-008', cancer: '喉恶性肿瘤', icd: 'C32.9', interval: 3, status: '启用' },
    { id: 'FC-009', cancer: '气管、支气管和肺恶性肿瘤', icd: 'C34.9', interval: 3, status: '启用' },
    { id: 'FC-010', cancer: '骨及关节软骨恶性肿瘤', icd: 'C41.9', interval: 3, status: '停用' },
    { id: 'FC-011', cancer: '皮肤黑色素瘤', icd: 'C43.9', interval: 6, status: '停用' },
    { id: 'FC-012', cancer: '乳腺恶性肿瘤', icd: 'C50.9', interval: 3, status: '启用' },
    { id: 'FC-013', cancer: '子宫颈恶性肿瘤', icd: 'C53.9', interval: 3, status: '启用' },
    { id: 'FC-014', cancer: '子宫体恶性肿瘤', icd: 'C54.9', interval: 6, status: '启用' },
    { id: 'FC-015', cancer: '卵巢恶性肿瘤', icd: 'C56.9', interval: 3, status: '启用' },
    { id: 'FC-016', cancer: '前列腺恶性肿瘤', icd: 'C61.9', interval: 6, status: '启用' },
    { id: 'FC-017', cancer: '肾恶性肿瘤', icd: 'C64.9', interval: 6, status: '启用' },
    { id: 'FC-018', cancer: '膀胱恶性肿瘤', icd: 'C67.9', interval: 3, status: '启用' },
    { id: 'FC-019', cancer: '中枢神经系统恶性肿瘤', icd: 'C72.9', interval: 3, status: '启用' },
    { id: 'FC-020', cancer: '甲状腺恶性肿瘤', icd: 'C73.9', interval: 12, status: '启用' },
    { id: 'FC-021', cancer: '淋巴瘤', icd: 'C85.9', interval: 3, status: '启用' },
    { id: 'FC-022', cancer: '白血病', icd: 'C95.9', interval: 1, status: '启用' },
    { id: 'FC-023', cancer: '其他及不明部位恶性肿瘤', icd: 'C97.9', interval: 6, status: '停用' }
  ];
  if (!Array.isArray(window.followupCycleData)) {
    window.followupCycleData = JSON.parse(JSON.stringify(CYCLE_DEFAULTS));
  }

  function fcEsc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  window.renderFollowupCycle = function () {
    ensureStyles();
    var st = window.followupCycleState;
    var all = window.followupCycleData || [];
    var kw = String(st.cancer || '').trim().toLowerCase();
    var list = all.filter(function (r) {
      if (kw && (r.cancer + ' ' + r.icd).toLowerCase().indexOf(kw) < 0) return false;
      if (st.status && r.status !== st.status) return false;
      return true;
    });
    var statusOpts = '<option value="">全部状态</option>' + ['启用', '停用'].map(function (s) {
      return '<option value="' + s + '"' + (st.status === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
    var rows = list.map(function (r) {
      var off = r.status !== '启用';
      return '<tr>' +
        '<td>' + fcEsc(r.cancer) + '</td>' +
        '<td>' + fcEsc(r.icd) + '</td>' +
        '<td><span class="fc-int"><input type="number" min="1" max="60" value="' + (r.interval == null ? '' : r.interval) + '"' +
          (off ? ' disabled' : '') + ' onchange="fcSetInterval(\'' + r.id + '\',this.value)"><span>月</span></span></td>' +
        '<td>' + (off ? badge('停用', 'muted') : badge('启用', 'success')) + '</td>' +
        '<td style="white-space:nowrap"><button class="btn btn-ghost btn-xs" onclick="fcToggleStatus(\'' + r.id + '\')">' + (off ? '启用' : '停用') + '</button>' +
        '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:36px">暂无匹配的随访周期配置</td></tr>';

    return '<div class="panel"><div class="panel-body">' +
      '<div class="filter-toolbar">' +
      '<div class="form-group search-group"><label>癌种</label><input placeholder="癌种名称 / ICD-10 编码" value="' + fcEsc(st.cancer || '') +
      '" onkeydown="if(event.key===\'Enter\'){followupCycleState.cancer=this.value.trim();renderPage(\'followup-cycle\')}"></div>' +
      '<div class="form-group"><label>状态</label><select onchange="followupCycleState.status=this.value;renderPage(\'followup-cycle\')">' + statusOpts + '</select></div>' +
      '</div>' +
      '<div style="margin-bottom:8px;color:#667085;font-size:13px">共 ' + list.length + ' 个癌种 · 启用 ' +
      list.filter(function (r) { return r.status === '启用'; }).length + ' 个</div>' +
      '<div class="table-wrap"><table class="data-table fc-table"><thead><tr>' +
      '<th>癌种</th><th style="width:96px">ICD-10</th><th style="width:150px">随访间隔期</th>' +
      '<th style="width:88px">状态</th><th style="width:118px">操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="void-pagination"><div class="void-pagination-info">共' + list.length + '条记录，第1/1页</div>' +
      '<div class="void-pagination-controls"><button onclick="toast(\'已是第一页\')">‹</button><input type="text" value="1" readonly><button onclick="toast(\'已是最后一页\')">›</button></div></div>' +
      '</div></div>';
  };

  window.fcSetInterval = function (id, value) {
    var rec = (window.followupCycleData || []).filter(function (r) { return r.id === id; })[0];
    if (!rec) return;
    var n = parseInt(value, 10);
    if (!(n > 0) || n > 60) {
      rec.interval = null;
      renderPage('followup-cycle');
      toast(rec.cancer + ' 随访间隔期待配置', 'warning');
      return;
    }
    rec.interval = n;
    renderPage('followup-cycle');
    toast(rec.cancer + ' 随访间隔期已设为 ' + n + ' 个月');
  };
  window.fcToggleStatus = function (id) {
    var rec = (window.followupCycleData || []).filter(function (r) { return r.id === id; })[0];
    if (!rec) return;
    if (rec.status === '启用' && !(rec.interval > 0)) { toast(rec.cancer + ' 尚未填写随访间隔期', 'error'); return; }
    rec.status = rec.status === '启用' ? '停用' : '启用';
    renderPage('followup-cycle');
    toast(rec.cancer + ' 已' + rec.status);
  };

  var _orig = window.renderPage;
  if (typeof _orig === 'function') {
    window.renderPage = function (id) {
      if (id === 'followup-cycle') {
        var pc = document.getElementById('pageContainer');
        if (pc) pc.innerHTML = window.renderFollowupCycle();
        if (typeof autoSizeSelects === 'function') autoSizeSelects();
        var mc = document.getElementById('mainContent');
        if (mc) mc.scrollTop = 0;
        return;
      }
      if (id === 'followup-batch') {
        window.followupPlanState = window.followupPlanState || {};
        window.followupPlanState.view = 'batch';
        id = 'followup-plan';
      }
      _orig(id);
      if (id === 'followup-plan' && (window.followupPlanState.view || '') === 'batch') {
        setTimeout(followupBatchUpdateCount, 0);
      }
    };
  }
})();
