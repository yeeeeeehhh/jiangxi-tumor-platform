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

  function problemModal(p) {
    var rule = p.rule || {};
    var logs = (p.logs || []).map(function (l) {
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
    var tabHtml = '<div class="qc-pf-seg" style="margin-bottom:8px">' + tabs.map(function (t) {
      return '<button class="' + (J.tab === t[0] ? 'on' : '') + '" data-qc="qi:tab:' + t[0] + '">' + t[0] + '（' + t[1] + '）</button>';
    }).join('') + '</div>';

    var act = activeList(ps);
    var pg = U.slice(act, J.page, 20);
    var rows = pg.rows.map(function (p) {
      var overdue = p.status === '已逾期';
      return {
        cells: [
          { h: '<code>' + S.esc(p.code) + '</code>' },
          S.esc(p.obj || '—'),
          { h: S.esc(p.desc) },
          S.esc(p.orgName || '—'),
          { h: S.esc(p.foundDate), cls: 'num' },
          { h: overdue ? '<span style="color:#b42335;font-weight:600">' + S.esc(p.dueDate) + '</span>' : S.esc(p.dueDate), cls: 'num' },
          { h: U.statusBadge(p.status) },
          { h: U.link('查看', 'qi:detail:' + p.code) + ' <button class="qc-link" data-qc="qi:work:' + p.code + '" style="color:#b54708">处置</button>' }
        ],
        cls: overdue ? 'abn-row' : ''
      };
    });
    var table = U.table(
      ['问题编号', '关联指标', '问题描述', '责任机构', '#发现日期', '#整改期限', '状态', '操作'],
      rows, { compact: true, empty: '该状态下暂无问题' });

    var card = U.card('问题台账', tabHtml + table + U.pager(act.length, J.page, 20, 'qip'), null,
      '<span style="font-size:12.5px;color:#64748b">闭环率 <b style="color:#2e7d32">' + st.closeRate + '%</b>（' + st.closed + ' / ' + st.total + '）</span>');

    return '<div class="qc-page">' +
      U.head('整改问题', '六大绩效质控发现问题的整改闭环台账（与异常明细同源）。',
        '', '质控管理',
        '<button class="btn btn-ghost btn-sm" data-qc="qi:toPerf">返回六大绩效质控</button>') +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
      [
        ['待处理', st.m['待处理'], '#b54708'],
        ['整改中', st.m['整改中'], '#244765'],
        ['待复核', st.m['待复核'], '#5b3fa0'],
        ['已关闭', st.m['已关闭'], '#2e7d32'],
        ['已逾期', st.m['已逾期'], '#b42335']
      ].map(function (x) {
        return '<div style="flex:0 0 auto;min-width:120px;border:1px solid var(--border);border-radius:8px;padding:10px 14px;background:#fff">' +
          '<div style="font-size:22px;font-weight:800;color:' + x[2] + '">' + S.fmt(x[1]) + '</div>' +
          '<div style="font-size:12px;color:#64748b">' + x[0] + '</div></div>';
      }).join('') + '</div>' +
      card +
      '</div>';
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
      if (p2) {
        U.modal('处置 · ' + S.esc(p2.code),
          '<div style="font-size:12.5px;color:#475569;line-height:2">' +
          '当前状态：' + U.statusBadge(p2.status) + '<br>' +
          '演示流转：' +
          '<button class="btn btn-ghost btn-sm" style="margin:0 6px">发起整改</button>' +
          '<button class="btn btn-ghost btn-sm" style="margin:0 6px">复核通过</button>' +
          '<button class="btn btn-ghost btn-sm" style="margin:0 6px">退回重整</button>' +
          '<br><span style="color:#94a3b8">（原型演示，状态更新将在正式数据接入后落库）</span></div>');
      }
      return;
    }
    if (a === 'qi:toPerf') { window.navigateTo('qc-performance'); return; }
  });

  window.qcIssues = {
    pageIds: ['qc-issues'],
    render: render,
    state: J
  };
})();