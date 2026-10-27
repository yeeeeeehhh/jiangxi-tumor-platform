/* ============================================================================
 * qc-issues.js — 整改问题（六大绩效质控的问题闭环）
 *
 * 单一来源：window.qcSpine.problems()，且只展示 layer==='L1'（六大绩效）的问题，
 * 与「六大绩效质控」异常明细同源。规则配置、异常明细、整改问题三点一线：
 *   判（规则）→ 看（异常明细）→ 改（这里）。
 *
 * 页签按状态：全部 / 待处理 / 整改中 / 待复核 / 已关闭 / 已逾期。
 * 暴露：window.qcIssues = { pageIds:['qc-issues'], render, state }
 * ========================================================================== */
(function () {
  'use strict';
  var S = window.qcSpine, U = window.qcUI;

  var J = { tab: '全部', page: 1 };

  function list() {
    return S.problems().filter(function (p) { return p.layer === 'L1'; });
  }

  function statOf(ps) {
    var m = { 待处理: 0, 整改中: 0, 待复核: 0, 已关闭: 0, 已逾期: 0 };
    ps.forEach(function (p) { if (m[p.status] != null) m[p.status]++; });
    var total = ps.length;
    var closed = m['已关闭'];
    return { m: m, total: total, closed: closed, closeRate: total ? Math.round(closed / total * 1000) / 10 : 0 };
  }

  function activeList(ps) {
    if (J.tab === '全部') return ps;
    return ps.filter(function (p) { return p.status === J.tab; });
  }

  /* 返回目标：台账里最近一条病例级整改来自哪个模块，就返回哪个模块。
     MDT 病例整改与六大绩效病例整改同池（qcSpine.problems），
     不区分会让用户点「返回」后跳到无关页面。 */
  function backTarget() {
    var all = S.problems();
    for (var i = all.length - 1; i >= 0; i--) {
      if (all[i].source !== 'case') continue;
      if (String(all[i].module || '').indexOf('MDT') === 0) return 'qc-mdt-ind01';
      return 'qc-pf-nq01';
    }
    return 'qc-pf-nq01';
  }
  function backLabel() {
    return backTarget() === 'qc-mdt-ind01' ? 'MDT质控' : '六大绩效质控';
  }

  function problemModal(p) {
    var rule = p.rule || {};
    var logs = (p.logs && p.logs.length ? p.logs : (p.statusLog || []).map(function (x) {
      return { t: x.at, who: x.actor, what: x.action };
    })).map(function (l) {
      return '<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px dashed #eef2f7">' +
        '<div style="flex:none;color:#94a3b8;font-size:12px">' + S.esc(l.t) + '</div>' +
        '<div style="flex:1"><b style="font-size:12.5px">' + S.esc(l.who) + '</b>' +
        '<div style="font-size:12.5px;color:#475569">' + S.esc(l.what) + '</div></div></div>';
    }).join('');
    var body = '<div style="font-size:13px;color:#334155;line-height:1.8">' +
      '<b>问题编号</b>：' + S.esc(p.code) + '<br>' +
      '<b>问题描述</b>：' + S.esc(p.desc) + '<br>' +
      '<b>关联指标</b>：' + S.esc(p.obj || '—') + '<br>' +
      '<b>责任机构</b>：' + S.esc(p.orgName || '—') + '<br>' +
      '<b>发现日期</b>：' + S.esc(p.foundDate) + '　<b>整改期限</b>：' + S.esc(p.dueDate) + '<br>' +
      '<b>触发规则</b>：' + S.esc((rule.code || '') + ' ' + (rule.name || '')) +
      '<br><b>判定条件</b>：' + S.esc(rule.cond || '—') +
      '</div>' +
      '<div style="margin-top:12px;border-top:1px solid #eef2f7;padding-top:8px"><b style="font-size:12.5px;color:#1f2937">处理记录</b>' +
      (logs || '<div style="color:#94a3b8;font-size:12.5px;padding:4px 0">（暂无）</div>') + '</div>';
    U.modal('整改问题 · ' + S.esc(p.code), body);
  }

  function render(pageId) {
    var ps = list();
    var st = statOf(ps);
    var tabs = [
      ['全部', st.total], ['待处理', st.m['待处理']], ['整改中', st.m['整改中']],
      ['待复核', st.m['待复核']], ['已关闭', st.m['已关闭']], ['已逾期', st.m['已逾期']]
    ];
    /* 页签用站内统一的 .qc-tabs（与「指标分析」「被质控数据明细」一致）。
       原先用的 .qc-pf-seg 已在 qc-performance.js 侧删除，本页引用就成为无样式裸按钮。 */
    var tabHtml = '<div class="qc-tabs">' + tabs.map(function (t) {
      return '<button class="' + (J.tab === t[0] ? 'on' : '') + '" data-qc="qi:tab:' + t[0] + '">' +
        t[0] + '（' + S.fmt(t[1]) + '）</button>';
    }).join('') + '</div>';

    var act = activeList(ps);
    var pg = U.slice(act, J.page, 20);
    var rows = pg.rows.map(function (p) {
      var overdue = p.status === '已逾期';
      return {
        cells: [
          { h: '<code>' + S.esc(p.code) + '</code>', cls: 'txt' },
          { h: S.esc(p.obj || '—'), cls: 'txt' },
          { h: S.esc(p.desc), cls: 'txt' },
          { h: S.esc(p.orgName || '—'), cls: 'txt' },
          { h: S.esc(p.foundDate), cls: 'num' },
          { h: overdue ? '<span style="color:#b42335;font-weight:600">' + S.esc(p.dueDate) + '</span>' : S.esc(p.dueDate), cls: 'num' },
          { h: U.statusBadge(p.status), cls: 'center' },
          { h: U.link('查看', 'qi:detail:' + p.code) + ' ' +
               '<button class="qc-link" data-qc="qi:work:' + p.code + '" style="color:#b54708">处置</button>', cls: 'num act' }
        ],
        cls: overdue ? 'abn-row' : ''
      };
    });
    /* fit: true —— 8 列按内容测算列宽，避免横向溢出把「操作」列挤出可视区；
       容器过窄时由 min-width 触发横向滚动，而不是压扁列宽。 */
    var table = U.table(
      ['问题编号', '关联指标', '问题描述', '责任机构', '#发现日期', '#整改期限', '状态', '操作'],
      rows, { compact: true, fit: true, empty: '该状态下暂无问题' });

    /* 卡片不带标题栏（与六大绩效各表一致：标题信息在页头/页签里已表达） */
    var card = U.card('', tabHtml + table + U.pager(act.length, J.page, 20, 'qip'));

    /* 状态统计用统一 KPI 组件（与六大绩效、质控问题中心同款），不再手写卡片样式 */
    var kpiHtml = U.kpis([
      { l: '待处理', v: S.fmt(st.m['待处理']), unit: '条', tone: 'warn', m: '等待下发整改', action: 'qi:tab:待处理' },
      { l: '整改中', v: S.fmt(st.m['整改中']), unit: '条', tone: 'info', m: '医疗机构整改中', action: 'qi:tab:整改中' },
      { l: '待复核', v: S.fmt(st.m['待复核']), unit: '条', tone: 'info', m: '等待质控中心复核', action: 'qi:tab:待复核' },
      { l: '已关闭', v: S.fmt(st.m['已关闭']), unit: '条', tone: 'up', m: '复核通过并闭环', action: 'qi:tab:已关闭' },
      { l: '已逾期', v: S.fmt(st.m['已逾期']), unit: '条', tone: 'bad', m: '超过整改期限', action: 'qi:tab:已逾期' },
      { l: '闭环率', v: S.f1(st.closeRate), unit: '%', tone: 'up', m: st.closed + ' / ' + st.total + ' 已闭环' }
    ], 6);

    return '<div class="qc-page">' +
      /* 页头只留标题 + 返回按钮（副标题与右上标签按全模块统一规范移除）。
         来源可能是六大绩效，也可能是 MDT 质控（病例整改入同一台账）——
         按当前台账里最近一条病例级问题的 module 决定返回目标。 */
      U.head('整改问题', '', '', false,
        '<button class="btn btn-ghost btn-sm" data-qc="qi:toPerf">← 返回' + S.esc(backLabel()) + '</button>') +
      kpiHtml +
      card +
      '</div>';
  }

  /* 处置弹窗：按当前状态给出合法流转动作 + 意见输入 + 处置留痕列表 */
  function workModal(p) {
    var acts = [];
    if (p.status === '待处理' || p.status === '已逾期') acts.push(['发起整改', '整改中']);
    if (p.status === '整改中') acts.push(['提交复核', '待复核']);
    if (p.status === '待复核') { acts.push(['复核通过', '已关闭']); acts.push(['退回重整', '退回']); }
    if (!acts.length) acts.push(['重新打开', '整改中']);
    var logHtml = (p.statusLog || []).map(function (l) {
      return '<div style="font-size:12px;color:#475569;padding:3px 0;border-bottom:1px dashed #eef2f7">' +
        S.esc(l.at) + ' · ' + S.esc(l.actor) + '：' + S.esc(l.action) + '</div>';
    }).join('') || '<div style="font-size:12px;color:#94a3b8">（暂无处置记录）</div>';
    U.modal('处置 · ' + S.esc(p.code),
      '<div style="font-size:12.5px;color:#475569;line-height:2">' +
      '当前状态：' + U.statusBadge(p.status) +
      (p.caseKey ? '<br>来源病例：' + S.esc(p.caseKey) + '（' + S.esc(p.mrn || '') + '）' : '') +
      '<div style="margin-top:8px">' + logHtml + '</div>' +
      '<div style="margin-top:10px"><label style="font-size:12px;color:#94a3b8">处置意见</label>' +
      '<textarea id="qi-note" style="width:100%;min-height:54px" placeholder="填写整改措施/复核意见（可空）"></textarea></div>' +
      '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
      acts.map(function (x) {
        return '<button class="btn btn-primary btn-sm" data-qc="qi:trans:' + S.esc(p.code) + ':' + x[1] + '">' + x[0] + '</button>';
      }).join('') + '</div>' +
      '<br><span style="color:#94a3b8">（状态流转已在本原型内生效；正式环境落库、账号与权限审计见《口径与计算规则》文档 §6）</span></div>');
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-qc]') : null;
    if (!el) return;
    var a = el.getAttribute('data-qc');
    if (a.indexOf('qi:') !== 0 && a.indexOf('qip:') !== 0) return;

    if (a.indexOf('qi:tab:') === 0) { J.tab = a.slice('qi:tab:'.length); J.page = 1; window.renderPage('qc-issues'); return; }
    if (a.indexOf('qip:page:') === 0 || a.indexOf('qi:page:') === 0) {
      J.page = parseInt(a.split(':')[2], 10) || 1; window.renderPage('qc-issues'); return;
    }
    if (a.indexOf('qi:detail:') === 0) {
      var code = a.slice('qi:detail:'.length);
      var p = list().filter(function (x) { return x.code === code; })[0];
      if (p) problemModal(p);
      return;
    }
    if (a.indexOf('qi:work:') === 0) {
      var code2 = a.slice('qi:work:'.length);
      var p2 = list().filter(function (x) { return x.code === code2; })[0];
      if (p2) workModal(p2);
      return;
    }
    /* 审核修复 B02：处置按钮真正落状态——待处理→整改中→待复核→已关闭，
       退回则回到整改中；每次流转记录处置人/时间/意见（statusLog）。 */
    if (a.indexOf('qi:trans:') === 0) {
      var seg = a.split(':');
      var st = seg.pop();
      var code = seg.slice(2).join(':');
      var noteEl = document.getElementById('qi-note');
      var note = noteEl && noteEl.value ? String(noteEl.value).trim() : '';
      if (st === '退回' || st === '重整') { st = '整改中'; note = ('退回重整：' + (note || '复核不通过')); }
      var okTr = S.setProblemStatus(code, st, '质控管理员（演示账号）', note);
      if (U.closeModal) U.closeModal();
      window.renderPage('qc-issues');
      U.toast(okTr ? '状态已更新：' + st + '（处置记录已留痕）' : '流转失败：状态或问题编号无效');
      return;
    }
    /* 六维三级菜单化后无总览页，「返回」回到来源模块（六大绩效 / MDT） */
    if (a === 'qi:toPerf') { window.navigateTo(backTarget()); return; }
  });

  window.qcIssues = {
    pageIds: ['qc-issues'],
    render: render,
    state: J,
    openProblem: function (code, mode) {
      var ps = list(), index = ps.findIndex(function (p) { return p.code === code; });
      if (index < 0) return false;
      J.tab = '全部'; J.page = Math.floor(index / 20) + 1;
      window.navigateTo('qc-issues');
      if (mode === 'work') workModal(ps[index]); else problemModal(ps[index]);
      return true;
    }
  };
})();
