/* ============================================================
   健康咨询模块 - 完整实现（可交互）
   ------------------------------------------------------------
   菜单 4 个业务页面，页面内用页签承载原 20 项功能：

   1. consult-sessions     咨询会话管理  会话主记录 / 消息明细 /
                           问题分类体系 / 分配处理日志
   2. consult-analysis     咨询问题分析  原始问题文本 / 智能分析结果 /
                           健康热点统计 / 洞察应用建议
   3. community-management 互动社区管理  板块配置 / 主帖内容 /
                           评论与回复 / 用户行为日志 / 优质内容推荐
   4. consult-education    科普内容配置  科普文章库 / 专题与标签 /
                           发布与排期 / 效果统计

   本模块维护内存态数据（DB），所有操作（回复、分配、审核、
   新增/编辑/停用、发布、采纳建议等）都会真实改动数据并重渲染，
   且各页面之间存在业务联动：
     分析 → 热点统计 → 洞察建议 → 一键生成科普草稿 → 科普发布
     会话回复 → 可插入同分类已发布科普文章
   ============================================================ */
(function () {
  'use strict';

  /* ================= 注入样式 ================= */
  var css = [
    '.hc-page{min-width:0}',
    '.hc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px}',
    '.hc-head .t{font-size:20px;font-weight:700;color:#182230;line-height:1.25}',
    '.hc-head .s{margin-top:5px;font-size:12px;color:#667085;line-height:1.5}',
    '.hc-head .acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
    '.hc-tag{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:4px;background:#e8f2ff;color:#244765;font-size:12px;font-weight:600;white-space:nowrap}',
    '.hc-tabs{display:flex;gap:6px;flex-wrap:wrap;background:#fff;border:1px solid var(--border,#dfe5ec);border-radius:8px;padding:8px;margin-bottom:14px;box-shadow:var(--shadow-xs,0 1px 2px rgba(27,36,50,.05))}',
    '.hc-tab{border:0;background:transparent;color:#475569;font-size:13px;font-weight:600;padding:8px 14px;border-radius:6px;cursor:pointer;transition:background .12s,color .12s}',
    '.hc-tab:hover{background:#f1f5f9}',
    '.hc-tab.active{background:#244765;color:#fff}',
    '.hc-tab .n{display:inline-block;margin-left:6px;min-width:18px;height:18px;line-height:18px;text-align:center;border-radius:9px;background:#e3ebf5;color:#244765;font-size:11px;font-weight:700;padding:0 5px}',
    '.hc-tab.active .n{background:rgba(255,255,255,.22);color:#fff}',
    '.hc-card{background:#fff;border:1px solid var(--border,#dfe5ec);border-radius:8px;overflow:hidden;margin-bottom:16px}',
    '.hc-card .hd{min-height:44px;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 15px;border-bottom:1px solid var(--border,#dfe5ec)}',
    '.hc-card .hd .t{font-size:14px;font-weight:700;color:#1f2937}',
    '.hc-card .hd .sub{font-size:11px;font-weight:400;color:#94a3b8;margin-left:8px}',
    '.hc-card .bd{padding:14px 16px}',
    '.hc-filter{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 14px;padding:12px 14px;background:#f8fafc;border:1px solid var(--border,#dfe5ec);border-radius:8px;margin-bottom:14px}',
    '.hc-filter .fg{display:flex;flex-direction:column;gap:4px;flex:1 1 160px;min-width:140px;max-width:240px}',
    '.hc-filter .fg label{font-size:12px;color:#64748b;font-weight:500;line-height:1}',
    '.hc-filter select,.hc-filter input:not([type=checkbox]):not([type=radio]){width:100%;height:32px;padding:0 8px;border:1px solid #d1d5db;border-radius:4px;background:#fff;color:#1f2937;font-size:13px;box-sizing:border-box}',
    '.hc-filter select:focus,.hc-filter input:focus{outline:none;border-color:#3d5a80}',
    '.hc-filter input::placeholder{color:#9ca3af}',
    '.hc-filter .acts{display:flex;gap:8px;margin-left:auto;flex:0 0 auto}',
    '.hc-table-wrap{overflow-x:auto;border:1px solid var(--border,#dfe5ec);border-radius:8px;background:#fff}',
    '.hc-table{width:100%;min-width:1000px;border-collapse:collapse}',
    '.hc-table th{height:40px;padding:0 12px;background:#f8fafc;border-bottom:1px solid var(--border,#dfe5ec);color:#5b6673;font-size:12px;font-weight:600;text-align:left;white-space:nowrap}',
    '.hc-table td{height:46px;padding:7px 12px;border-bottom:1px solid #eef2f7;color:#334155;font-size:13px;vertical-align:middle}',
    '.hc-table tbody tr:hover{background:#f7fbff}',
    '.hc-table tbody tr:last-child td{border-bottom:0}',
    '.hc-table .clip{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.hc-table .ops{white-space:nowrap;display:flex;gap:6px;flex-wrap:wrap}',
    '.hc-empty{padding:38px 16px;text-align:center;color:#94a3b8;font-size:13px}',
    '.hc-bar{display:flex;align-items:flex-end;gap:10px;height:200px;padding:12px 8px 4px}',
    '.hc-bar .col{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px}',
    '.hc-bar .val{font-size:11px;font-weight:600;color:#334155;font-variant-numeric:tabular-nums}',
    '.hc-bar .track{width:100%;max-width:48px;flex:1;display:flex;align-items:flex-end;background:#f1f5f9;border-radius:4px 4px 0 0;overflow:hidden}',
    '.hc-bar .fill{width:100%;border-radius:4px 4px 0 0;transition:height .3s}',
    '.hc-bar .lab{font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
    '.hc-hbar{display:flex;flex-direction:column;gap:9px}',
    '.hc-hbar .row{display:grid;grid-template-columns:96px 1fr 62px;align-items:center;gap:10px;font-size:12px;color:#475569}',
    '.hc-hbar .tk{height:10px;background:#eef2f7;border-radius:999px;overflow:hidden}',
    '.hc-hbar .fl{height:100%;border-radius:999px;background:#3d5a80}',
    '.hc-hbar .vv{text-align:right;font-variant-numeric:tabular-nums;color:#334155;font-weight:600}',
    '.hc-twin{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:14px;align-items:start;margin-bottom:16px}',
    '.hc-meta{font-size:12px;color:#667085;line-height:1.7}',
    '.hc-chip{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:4px;background:#eef2f7;color:#475569;font-size:11px;font-weight:600;margin:0 4px 4px 0}',
    '.hc-chip.blue{background:#e8f2ff;color:#244765}.hc-chip.green{background:#e8f5e9;color:#2e7d32}.hc-chip.amber{background:#fff7db;color:#8a6100}',
    '.hc-note{border:1px solid #dbe6f5;border-left:4px solid #244765;border-radius:6px;background:#f4f8ff;padding:11px 14px;font-size:12.5px;color:#334155;line-height:1.65;margin-bottom:14px}',
    '.hc-note b{color:#244765}',
    '.hc-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}',
    '.hc-toolbar .l{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.hc-pager{display:flex;gap:6px;align-items:center;justify-content:flex-end;padding:10px 2px 0;font-size:12px;color:#667085}',
    '.hc-pager button{min-width:28px;height:28px;border:1px solid var(--border,#dfe5ec);background:#fff;border-radius:5px;color:#475569;cursor:pointer;font-size:12px}',
    '.hc-pager button.on{background:#244765;border-color:#244765;color:#fff}',
    '.hc-pager button[disabled]{opacity:.45;cursor:not-allowed}',
    /* 弹窗 */
    '.hc-modal-mask{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.5)}',
    '.hc-modal{width:min(780px,96vw);max-height:88vh;display:flex;flex-direction:column;background:#fff;border-radius:10px;box-shadow:0 18px 50px rgba(15,23,42,.25)}',
    '.hc-modal.wide{width:min(1020px,97vw)}',
    '.hc-modal .hd{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 18px;border-bottom:1px solid var(--border,#dfe5ec)}',
    '.hc-modal .hd .t{font-size:15px;font-weight:700;color:#1f2937}',
    '.hc-modal .hd .sub{font-size:11px;color:#94a3b8;font-weight:400;margin-left:8px}',
    '.hc-modal .x{width:28px;height:28px;border:0;border-radius:5px;background:#f2f4f7;color:#667085;font-size:16px;cursor:pointer}',
    '.hc-modal .bd{padding:16px 18px;overflow:auto;flex:1}',
    '.hc-modal .ft{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--border,#dfe5ec);background:#fbfcfe}',
    '.hc-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px}',
    '.hc-form .full{grid-column:1/-1}',
    '.hc-form label{display:block;font-size:12px;color:#475569;font-weight:600;margin-bottom:5px}',
    '.hc-form input:not([type=checkbox]):not([type=radio]),.hc-form select,.hc-form textarea{width:100%;border:1px solid #d1d8e0;border-radius:5px;background:#fff;color:#1f2937;font-size:13px;box-sizing:border-box;padding:0 9px;height:34px;font-family:inherit}',
    '.hc-form textarea{height:auto;min-height:88px;padding:8px 9px;resize:vertical;line-height:1.6}',
    '.hc-form .hint{font-size:11px;color:#94a3b8;margin-top:4px}',
    '.hc-form .req{color:#b42335}',
    '.hc-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px}',
    '.hc-kv .k{font-size:12px;color:#667085}',
    '.hc-kv .vl{font-size:13px;font-weight:600;color:#1f2937;margin-top:2px}',
    /* 会话消息流 */
    '.hc-thread{display:flex;flex-direction:column;gap:12px;max-height:340px;overflow:auto;padding:4px 2px}',
    '.hc-msg{display:flex;flex-direction:column;gap:4px;max-width:82%}',
    '.hc-msg .who{font-size:11px;color:#94a3b8}',
    '.hc-msg .bub{padding:9px 12px;border-radius:8px;background:#f3f6fa;color:#24313f;line-height:1.6;font-size:13px;white-space:pre-wrap;word-break:break-word}',
    '.hc-msg.mine{align-items:flex-end;margin-left:auto}',
    '.hc-msg.mine .bub{background:#e8f2ff;color:#1a3450}',
    '.hc-msg.sys .bub{background:#fff7db;color:#8a6100;font-size:12px}',
    '.hc-reply{border-top:1px solid var(--border,#dfe5ec);padding-top:12px;margin-top:12px}',
    '.hc-reply textarea{width:100%;min-height:92px;border:1px solid #d1d8e0;border-radius:6px;padding:9px 10px;font-size:13px;line-height:1.6;box-sizing:border-box;resize:vertical;font-family:inherit}',
    '.hc-reply .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:9px}',
    '.hc-reply select{height:32px;border:1px solid #d1d8e0;border-radius:5px;padding:0 8px;font-size:12px;background:#fff;max-width:320px}',
    '.hc-quick{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}',
    '.hc-quick button{border:1px dashed #c2d4e6;background:#fff;color:#3d5a80;border-radius:999px;padding:4px 10px;font-size:12px;cursor:pointer}',
    '.hc-quick button:hover{background:#f4f8ff}',
    '.hc-stack{display:flex;flex-direction:column;gap:10px}',
    '.hc-item{border:1px solid var(--border,#dfe5ec);border-radius:8px;padding:12px 14px;background:#fff}',
    '.hc-item .tt{font-size:13.5px;font-weight:700;color:#1f2937}',
    '.hc-item .ds{font-size:12.5px;color:#64748b;margin-top:5px;line-height:1.6}',
    '.hc-item .ft{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:9px;font-size:11.5px;color:#94a3b8}',
    '.hc-rank{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px dashed #eef2f7;font-size:13px}',
    '.hc-rank:last-child{border-bottom:0}',
    '.hc-rank .no{width:22px;height:22px;border-radius:5px;background:#eef2f7;color:#475569;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px}',
    '.hc-rank .no.top{background:#244765;color:#fff}',
    '.hc-rank .gr{margin-left:auto;color:#94a3b8;font-size:12px;font-variant-numeric:tabular-nums}',
    '@media(max-width:1100px){.hc-twin{grid-template-columns:1fr}.hc-filter{grid-template-columns:repeat(2,1fr)}.hc-form{grid-template-columns:1fr}}',
    '@media(max-width:680px){.hc-filter{grid-template-columns:1fr}.hc-kv{grid-template-columns:1fr}}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ================= 基础工具 ================= */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  function val(id) { var e = $(id); return e ? String(e.value).trim() : ''; }
  function say(msg, type) { if (window.toast) { window.toast(msg, type); } else { window.alert(msg); } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function now() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function today() { return now().slice(0, 10); }
  var SEQ = 2000;
  function nextId(p) { SEQ += 1; return p + SEQ; }
  function find(list, id) { for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; } return null; }
  function count(list, fn) { var n = 0; for (var i = 0; i < list.length; i++) { if (fn(list[i])) n += 1; } return n; }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function confirmBox(title, msg, onOk) {
    if (window.showConfirm) { window.showConfirm(title, msg, onOk); return; }
    if (window.confirm(msg)) { onOk(); }
  }
  function tone(text, t) {
    var c = t === 'success' ? 'badge-success' : t === 'info' ? 'badge-info' : t === 'danger' ? 'badge-danger' : t === 'warn' ? 'badge-caution' : t === 'orange' ? 'badge-orange' : 'badge-neutral';
    return '<span class="badge ' + c + '">' + esc(text) + '</span>';
  }
  var STATUS_TONE = {
    '已办结': 'success', '已回复': 'info', '处理中': 'warn', '待分配': 'orange', '已发布': 'success', '待审核': 'warn',
    '草稿': 'neutral', '已下架': 'danger', '已驳回': 'danger', '启用': 'success', '停用': 'warn', '已推荐': 'success',
    '已采纳': 'success', '已忽略': 'neutral', '待处理': 'orange', '已分析': 'info', '待分析': 'warn', '正常': 'success',
    '已屏蔽': 'danger', '待发布': 'warn', '失败': 'danger', '置顶': 'info'
  };
  function st(text) { return tone(text, STATUS_TONE[text] || 'neutral'); }
  function heads(title, sub, acts) {
    return '<div class="hc-head"><div><div class="t">' + esc(title) + '</div>' + (sub ? '<div class="s">' + esc(sub) + '</div>' : '') + '</div>' +
      '<div class="acts">' + (acts || '') + '<span class="hc-tag">健康咨询</span></div></div>';
  }
  function card(title, body, sub, extra) {
    return '<div class="hc-card"><div class="hd"><span class="t">' + esc(title) + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</span>' + (extra || '') + '</div><div class="bd">' + body + '</div></div>';
  }
  function table(headers, rowsHtml, emptyText) {
    if (!rowsHtml || rowsHtml.indexOf('<tr') < 0) return '<div class="hc-empty">' + esc(emptyText || '暂无数据') + '</div>';
    var th = headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('');
    return '<div class="hc-table-wrap"><table class="hc-table"><thead><tr>' + th + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
  }
  function ops() { return '<div class="ops">' + Array.prototype.slice.call(arguments).join('') + '</div>'; }
  function act(text, action, arg, cls) {
    return '<button class="btn ' + (cls || 'btn-ghost') + ' btn-xs" data-hc="' + esc(action) + '" data-arg="' + esc(arg || '') + '">' + esc(text) + '</button>';
  }
  function tabs(page, options) {
    return '<div class="hc-tabs">' + options.map(function (o) {
      return '<button type="button" class="hc-tab' + (HC.tab[page] === o.id ? ' active' : '') + '" data-hc-tab="' + page + '" data-hc-val="' + o.id + '">' +
        esc(o.label) + (o.n != null ? '<span class="n">' + esc(o.n) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function barChart(data, unit) {
    if (!data.length) return '<div class="hc-empty">暂无统计数据</div>';
    var max = Math.max.apply(null, data.map(function (d) { return d.v; })) || 1;
    var colors = ['#244765', '#3d5a80', '#5b8def', '#7fb4e8', '#94c2d9', '#b0d0a2', '#e0a96d', '#d98b8b', '#9a7bc1', '#6da8c9'];
    return '<div class="hc-bar">' + data.map(function (d, i) {
      var h = Math.max(3, Math.round(d.v / max * 100));
      return '<div class="col"><div class="val">' + esc(d.v) + (unit || '') + '</div><div class="track"><div class="fill" style="height:' + h + '%;background:' + colors[i % colors.length] + '"></div></div><div class="lab">' + esc(d.l) + '</div></div>';
    }).join('') + '</div>';
  }
  function hBars(data, unit) {
    if (!data.length) return '<div class="hc-empty">暂无统计数据</div>';
    var max = Math.max.apply(null, data.map(function (d) { return d.v; })) || 1;
    return '<div class="hc-hbar">' + data.map(function (d) {
      return '<div class="row"><span>' + esc(d.l) + '</span><span class="tk"><span class="fl" style="width:' + Math.max(2, Math.round(d.v / max * 100)) + '%"></span></span><span class="vv">' + esc(d.v) + (unit || '') + '</span></div>';
    }).join('') + '</div>';
  }
  function chips(arr, cls) { return (arr || []).map(function (t) { return '<span class="hc-chip ' + (cls || '') + '">' + esc(t) + '</span>'; }).join(''); }

  /* ---------- 带状态的筛选栏（值写入 HC.filters[key]） ---------- */
  function filterBar(key, fields) {
    var f = HC.filters[key] || (HC.filters[key] = {});
    var html = fields.map(function (fd) {
      var id = 'hc-f-' + key.replace(/[^a-zA-Z0-9]/g, '') + '-' + fd.k;
      fd.inputId = id;
      if (fd.type === 'select') {
        var cur = f[fd.k] == null ? fd.def : f[fd.k];
        var optList = typeof fd.options === 'function' ? fd.options() : fd.options;
        if (optList.indexOf(cur) < 0) { cur = optList[0]; }
        var opts = optList.map(function (o) { return '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('');
        return '<div class="fg"><label>' + esc(fd.label) + '</label><select id="' + id + '">' + opts + '</select></div>';
      }
      return '<div class="fg"><label>' + esc(fd.label) + '</label><input id="' + id + '" type="text" placeholder="' + esc(fd.ph || '') + '" value="' + esc(f[fd.k] || '') + '"></div>';
    }).join('');
    return '<div class="hc-filter">' + html +
      '<div class="acts"><button class="btn btn-outline btn-sm" data-hc="filterReset" data-arg="' + esc(key) + '">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-hc="filter" data-arg="' + esc(key) + '">查询</button></div></div>';
  }
  function readFilter(key, fields) {
    var f = HC.filters[key] || (HC.filters[key] = {});
    fields.forEach(function (fd) { var v = val(fd.inputId); if (v !== '') f[fd.k] = v; else f[fd.k] = fd.type === 'select' ? fd.def : ''; });
    HC.pageNo[key] = 1;
  }
  /* 读取筛选值：未设置时回退到该字段的默认值（否则首屏会把数据全部过滤掉） */
  function fv(key, k, def) {
    var f = HC.filters[key];
    var v = f && f[k] != null ? String(f[k]) : '';
    if (v === '') return def == null ? '' : def;
    return v;
  }
  function pager(key, total, size) {
    var pages = Math.max(1, Math.ceil(total / size));
    var cur = HC.pageNo[key] || 1;
    if (cur > pages) { cur = pages; HC.pageNo[key] = cur; }
    var btns = '';
    for (var i = 1; i <= pages; i++) {
      if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - cur) > 1) { if (i === 3) btns += '<span style="color:#94a3b8">…</span>'; continue; }
      btns += '<button class="' + (i === cur ? 'on' : '') + '" data-hc="page" data-arg="' + esc(key) + '|' + i + '">' + i + '</button>';
    }
    return '<div class="hc-pager"><span>共 ' + total + ' 条 · 第 ' + cur + '/' + pages + ' 页</span>' +
      '<button data-hc="page" data-arg="' + esc(key) + '|' + Math.max(1, cur - 1) + '"' + (cur === 1 ? ' disabled' : '') + '>‹</button>' + btns +
      '<button data-hc="page" data-arg="' + esc(key) + '|' + Math.min(pages, cur + 1) + '"' + (cur === pages ? ' disabled' : '') + '>›</button></div>';
  }
  function slice(list, key, size) {
    var cur = HC.pageNo[key] || 1;
    return list.slice((cur - 1) * size, cur * size);
  }

  /* ---------- 弹窗 ---------- */
  function closeModal() { var m = document.querySelector('.hc-modal-mask'); if (m) m.remove(); }
  function modal(title, sub, bodyHtml, okLabel, onOk, wide) {
    closeModal();
    var mask = document.createElement('div');
    mask.className = 'hc-modal-mask';
    mask.innerHTML = '<div class="hc-modal' + (wide ? ' wide' : '') + '">' +
      '<div class="hd"><span class="t">' + esc(title) + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</span><button class="x" data-hc="close">✕</button></div>' +
      '<div class="bd">' + bodyHtml + '</div>' +
      '<div class="ft"><button class="btn btn-ghost btn-sm" data-hc="close">关闭</button>' +
      (okLabel ? '<button class="btn btn-primary btn-sm" id="hc-modal-ok">' + esc(okLabel) + '</button>' : '') + '</div></div>';
    document.body.appendChild(mask);
    mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(); });
    if (okLabel) { mask.querySelector('#hc-modal-ok').onclick = function () { onOk && onOk(); }; }
    return mask;
  }
  function infoModal(title, sub, kvs) {
    var rows = kvs.map(function (kv) { return '<div><div class="k">' + esc(kv[0]) + '</div><div class="vl">' + kv[1] + '</div></div>'; }).join('');
    modal(title, sub, '<div class="hc-kv">' + rows + '</div>', null, null);
  }
  function formModal(title, sub, fieldsHtml, okLabel, onOk, wide) {
    var mask = modal(title, sub, '<div class="hc-form">' + fieldsHtml + '</div>', okLabel, onOk, wide);
    var first = mask.querySelector('input,textarea,select');
    if (first) { setTimeout(function () { first.focus(); }, 30); }
    return mask;
  }
  /* req() 产出的是 HTML 标记。label 走 esc() 会把 <span> 转义成正文显示出来，
     所以这里用占位符：先转义纯文本，再把占位符替换回真正的星号标记。 */
  var REQ_MARK = '\u0000REQ\u0000';
  function ff(label, inner, full) { return '<div' + (full ? ' class="full"' : '') + '><label>' + esc(label).split(REQ_MARK).join('<span class="req">*</span>') + '</label>' + inner + '</div>'; }
  function fi(id, v, ph, type) { return '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(ph || '') + '">'; }
  function fsel(id, opts, v) { return '<select id="' + id + '">' + opts.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'; }
  function fta(id, v, ph, rows) { return '<textarea id="' + id + '" rows="' + (rows || 4) + '" placeholder="' + esc(ph || '') + '">' + esc(v || '') + '</textarea>'; }
  function req(t) { return t + ' ' + REQ_MARK; }

  /* ================= 视图状态 ================= */
  var HC = {
    page: 'consult-sessions',
    tab: { 'consult-sessions': 'sessions', 'consult-analysis': 'raw', 'community-management': 'boards', 'consult-education': 'library' },
    filters: {},
    pageNo: {}
  };
  function refresh() { renderHealthConsultPage(HC.page); }
  function switchTab(page, val2) { HC.tab[page] = val2; HC.page = page; renderHealthConsultPage(page); }
  function logAction(user, action, target) { DB.userLogs.unshift({ id: nextId('UL-'), user: user || '管理员', action: action, target: target, time: now() }); }

  /* ================= 内存态数据（DB） ================= */
  var CATS = ['肿瘤防治', '康复随访', '健康科普', '心理支持'];
  var TOPICS = ['肺部结节', '化疗后调理', '乳腺复查', '放射治疗', '术后饮食', '免疫治疗', '心理支持', '复诊随访', '疼痛管理', '营养支持'];
  var DOCTORS = ['王医生', '李医生', '赵医生', '孙医生', '周医生', '吴医生'];
  var EDU_TYPES = ['图文', '视频', '问答', '直播回放'];
  var CHANNELS = ['患者端 App 首页', '微信公众号', '候诊大屏', '站内消息', '小程序'];

  var DB = {
    sessions: [
      { id: 'HC-2026-0001', user: '张女士', phone: '138****2210', cat: '肿瘤防治', topic: '肺部结节', q: '确诊肺腺癌后饮食方面需要注意什么？', status: '已回复', time: '2026-08-27 09:12', assignee: '王医生', priority: '低' },
      { id: 'HC-2026-0002', user: '李先生', phone: '139****8871', cat: '康复随访', topic: '化疗后调理', q: '化疗结束后白细胞偏低如何调理？', status: '处理中', time: '2026-08-27 10:45', assignee: '李医生', priority: '中' },
      { id: 'HC-2026-0003', user: '赵阿姨', phone: '136****3345', cat: '健康科普', topic: '乳腺复查', q: '乳腺癌术后可以接种流感疫苗吗？', status: '待分配', time: '2026-08-27 13:20', assignee: '', priority: '低' },
      { id: 'HC-2026-0004', user: '王先生', phone: '137****9023', cat: '肿瘤防治', topic: '肺部结节', q: '体检发现 8mm 肺结节，需要立即复查吗？会不会是恶性的？', status: '待分配', time: '2026-08-27 15:03', assignee: '', priority: '高' },
      { id: 'HC-2026-0005', user: '陈女士', phone: '158****1109', cat: '康复随访', topic: '放射治疗', q: '放疗期间皮肤出现红肿脱皮如何处理？', status: '已办结', time: '2026-08-26 15:40', assignee: '孙医生', priority: '中' },
      { id: 'HC-2026-0006', user: '刘先生', phone: '135****7788', cat: '心理支持', topic: '心理支持', q: '确诊后整夜失眠，总想着最坏的结果，怎么办？', status: '处理中', time: '2026-08-26 20:11', assignee: '周医生', priority: '高' },
      { id: 'HC-2026-0007', user: '孙阿姨', phone: '133****4521', cat: '康复随访', topic: '营养支持', q: '免疫治疗期间可以吃人参黄芪这类补品吗？', status: '已回复', time: '2026-08-25 11:02', assignee: '吴医生', priority: '低' },
      { id: 'HC-2026-0008', user: '周先生', phone: '186****9034', cat: '肿瘤防治', topic: '疼痛管理', q: '癌痛吃吗啡类止痛药会不会成瘾？', status: '待分配', time: '2026-08-25 08:30', assignee: '', priority: '中' }
    ],
    messages: [
      { id: 'MSG-1001', session: 'HC-2026-0001', from: '张女士', role: '用户', content: '确诊肺腺癌后，家人每天做很多补品，有没有需要忌口的？', time: '2026-08-27 09:12' },
      { id: 'MSG-1002', session: 'HC-2026-0001', from: '王医生', role: '客服', content: '建议清淡饮食，保证优质蛋白（鱼、蛋、瘦肉、豆制品），腌制与烟熏类尽量少吃。补品不建议自行大量服用，请把成分单带给主治医生确认。', time: '2026-08-27 09:30' },
      { id: 'MSG-1003', session: 'HC-2026-0002', from: '李先生', role: '用户', content: '化疗后白细胞 2.8，请问怎么提升？需要打升白针吗？', time: '2026-08-27 10:45' },
      { id: 'MSG-1004', session: 'HC-2026-0002', from: '李医生', role: '客服', content: '白细胞 2.8×10⁹/L 属于中度下降，建议 3 天内复查血常规，增加优质蛋白摄入，注意避免去人群密集处。是否使用升白药物需由主治医生判断。', time: '2026-08-27 11:02' },
      { id: 'MSG-1005', session: 'HC-2026-0004', from: '王先生', role: '用户', content: '8mm 肺结节会不会是恶性的？多久复查一次？', time: '2026-08-27 15:03' },
      { id: 'MSG-1006', session: 'HC-2026-0005', from: '陈女士', role: '用户', content: '放疗第 12 次，照射区域皮肤发红还有点脱皮，能涂东西吗？', time: '2026-08-26 15:40' },
      { id: 'MSG-1007', session: 'HC-2026-0005', from: '孙医生', role: '客服', content: '属于常见放射性皮肤反应。保持局部清洁干燥、穿柔软棉质衣物，可在放疗科指导下使用医用保湿敷料，切勿自行涂抹刺激性药膏。', time: '2026-08-26 16:05' },
      { id: 'MSG-1008', session: 'HC-2026-0006', from: '刘先生', role: '用户', content: '自从确诊以后每天睡不着，脑子里全是坏消息，家里人也跟着难受。', time: '2026-08-26 20:11' },
      { id: 'MSG-1009', session: 'HC-2026-0003', from: '赵阿姨', role: '用户', content: '乳腺癌术后两年了，今年想打流感疫苗，不知道行不行。', time: '2026-08-27 13:20' }
    ],
    categories: [
      { id: 'CAT-01', name: '肿瘤防治', desc: '确诊后治疗、用药、护理等问题', status: '启用', owner: '王医生' },
      { id: 'CAT-02', name: '康复随访', desc: '术后 / 放疗 / 化疗后的恢复与随访', status: '启用', owner: '李医生' },
      { id: 'CAT-03', name: '健康科普', desc: '体检报告解读、日常保健常识', status: '启用', owner: '赵医生' },
      { id: 'CAT-04', name: '心理支持', desc: '情绪疏导与心理关怀', status: '停用', owner: '周医生' }
    ],
    assigns: [
      { id: 'ASG-5001', session: 'HC-2026-0001', from: '客服组长', to: '王医生', note: '转肿瘤防治组处理', time: '2026-08-27 09:20' },
      { id: 'ASG-5002', session: 'HC-2026-0002', from: '系统', to: '李医生', note: '按问题分类自动匹配康复随访组', time: '2026-08-27 10:50' },
      { id: 'ASG-5003', session: 'HC-2026-0005', from: '客服组长', to: '孙医生', note: '放射性皮肤反应专项', time: '2026-08-26 15:50' },
      { id: 'ASG-5004', session: 'HC-2026-0006', from: '客服组长', to: '周医生', note: '高优先级：情绪类转心理支持组', time: '2026-08-26 20:30' }
    ],
    analysis: [],
    insights: [],
    boards: [],
    posts: [],
    comments: [],
    userLogs: [],
    recommends: [],
    edu: [],
    eduTopics: [],
    eduSchedule: []
  };

  DB.boards = [
    { id: 'BD-01', name: '康复互助圈', desc: '康复期患者经验分享与互助', status: '启用', moderator: '李医生' },
    { id: 'BD-02', name: '专家讲堂', desc: '权威医生专题科普讲座', status: '启用', moderator: '王医生' },
    { id: 'BD-03', name: '营养咨询', desc: '营养师在线答疑专区', status: '启用', moderator: '营养师小林' },
    { id: 'BD-04', name: '心情树洞', desc: '匿名倾诉与心理支持', status: '停用', moderator: '周医生' }
  ];
  DB.posts = [
    { id: 'PT-101', board: '康复互助圈', user: '阿诚', title: '放疗第三周的感受与经验', content: '记录一下这三周放疗的身体变化，给后面的病友一个参考。前两周基本没什么感觉，第三周开始照射区域皮肤发紧、颜色变深，食欲也差了一些。医生说是正常反应，坚持下来了。', views: 1280, likes: 210, status: '已发布', time: '2026-08-24 10:12' },
    { id: 'PT-102', board: '专家讲堂', user: '王医生', title: '免疫治疗副作用管理专题', content: '免疫相关不良反应可累及全身多个器官，早期识别是关键。常见包括皮肤反应、甲状腺功能异常、结肠炎、肺炎等，出现持续腹泻、气促、皮疹加重请及时就诊。', views: 3560, likes: 486, status: '已发布', time: '2026-08-23 09:00' },
    { id: 'PT-103', board: '营养咨询', user: '营养师小林', title: '化疗期一日三餐怎么吃', content: '化疗期间饮食核心是足量优质蛋白加食物安全。建议少食多餐，每天保证鸡蛋、鱼肉或瘦肉；所有食物彻底加热，避免生冷沙拉与隔夜菜。', views: 2030, likes: 322, status: '已发布', time: '2026-08-25 14:30' },
    { id: 'PT-104', board: '心情树洞', user: '匿名用户', title: '确诊后的失眠焦虑，想找个出口', content: '自从拿到病理报告，我就没有睡过一个整觉，总在想最坏的结果，家人安慰我也听不进去。', views: 640, likes: 98, status: '待审核', time: '2026-08-27 08:40' },
    { id: 'PT-105', board: '康复互助圈', user: '海阔天空', title: '复查指标正常，分享我的随访时间表', content: '把这两年的复查项目和时间整理成表格，方便大家对照。术后前两年每 3 个月一次，第 3-5 年每 6 个月一次。', views: 410, likes: 66, status: '待审核', time: '2026-08-27 12:05' }
  ];
  DB.comments = [
    { id: 'CM-201', post: 'PT-102', user: '刘海', content: '讲解得很详细，收藏了。', like: 15, time: '2026-08-27 10:20', status: '正常', replies: [{ user: '王医生', content: '感谢关注，具体用药请以主治医生意见为准。', time: '2026-08-27 10:40' }] },
    { id: 'CM-202', post: 'PT-103', user: '美玲', content: '请问放疗期间可以吃海鲜吗？', like: 6, time: '2026-08-27 11:40', status: '正常', replies: [] },
    { id: 'CM-203', post: 'PT-101', user: '老王', content: '感谢分享，给了我很大信心。', like: 22, time: '2026-08-27 14:02', status: '正常', replies: [] },
    { id: 'CM-204', post: 'PT-103', user: '匿名用户', content: '这里推荐的那个偏方根本没用，别信。', like: 1, time: '2026-08-27 16:15', status: '待审核', replies: [] }
  ];
  DB.userLogs = [
    { id: 'UL-301', user: '张女士', action: '发起咨询', target: 'HC-2026-0001', time: '2026-08-27 09:12' },
    { id: 'UL-302', user: '美玲', action: '发表评论', target: 'CM-202', time: '2026-08-27 11:40' },
    { id: 'UL-303', user: '赵阿姨', action: '点赞', target: 'PT-102', time: '2026-08-27 13:18' },
    { id: 'UL-304', user: '匿名用户', action: '举报内容', target: 'PT-104', time: '2026-08-27 15:02' }
  ];
  DB.recommends = [
    { id: 'RC-01', post: 'PT-102', reason: '播放量与互动率双高，知识性强', status: '已推荐' },
    { id: 'RC-02', post: 'PT-103', reason: '营养类干货，用户收藏较多', status: '已推荐' },
    { id: 'RC-03', post: 'PT-101', reason: '康复纪实，情感价值高', status: '待审核' }
  ];
  DB.edu = [
    { id: 'EDU-001', title: '肺结节随访指南：多大需要复查？', type: '图文', cat: '肿瘤防治', topic: '肺部结节', tags: ['肺结节', '随访', 'CT'], summary: '按结节大小与密度给出复查间隔建议，帮助体检人群正确看待肺结节。', content: '肺结节绝大多数为良性。一般小于 6mm 建议年度复查；6-8mm 建议 6-12 个月复查；大于 8mm 需 3 个月内复查并结合临床评估。', status: '已发布', views: 8620, likes: 934, author: '王医生', publishAt: '2026-08-20', top: true, source: '人工编辑' },
    { id: 'EDU-002', title: '化疗后白细胞下降的饮食与防护', type: '图文', cat: '康复随访', topic: '化疗后调理', tags: ['化疗', '白细胞', '饮食'], summary: '骨髓抑制期的营养支持与感染防护要点。', content: '保证足量优质蛋白，食物彻底加热，避免生冷；外出佩戴口罩，勤洗手，减少去人群密集场所。', status: '已发布', views: 5210, likes: 612, author: '李医生', publishAt: '2026-08-18', top: false, source: '人工编辑' },
    { id: 'EDU-003', title: '放疗期间皮肤护理 5 要点', type: '视频', cat: '康复随访', topic: '放射治疗', tags: ['放疗', '皮肤护理'], summary: '放射性皮肤反应的居家护理示范视频。', content: '保持清洁干燥、穿柔软棉质衣物、避免暴晒与摩擦、不自行涂抹刺激性药膏、及时告知放疗科医生。', status: '已发布', views: 3980, likes: 445, author: '孙医生', publishAt: '2026-08-15', top: false, source: '人工编辑' },
    { id: 'EDU-004', title: '乳腺癌术后疫苗接种须知', type: '问答', cat: '健康科普', topic: '乳腺复查', tags: ['乳腺癌', '疫苗'], summary: '术后患者接种流感疫苗等灭活疫苗的注意事项。', content: '病情稳定、化疗结束 3 个月以上且免疫功能恢复者，通常可接种灭活疫苗，接种前请咨询主治医生。', status: '待审核', views: 0, likes: 0, author: '赵医生', publishAt: '', top: false, source: '人工编辑' },
    { id: 'EDU-005', title: '癌痛规范化用药：会不会成瘾？', type: '图文', cat: '肿瘤防治', topic: '疼痛管理', tags: ['癌痛', '止痛', '阿片类'], summary: '澄清癌痛治疗中最常见的用药误区。', content: '在规范剂量与医嘱下使用阿片类药物治疗癌痛，成瘾发生率极低，不应因恐惧成瘾而忍痛。', status: '草稿', views: 0, likes: 0, author: '吴医生', publishAt: '', top: false, source: '人工编辑' }
  ];
  DB.eduTopics = [
    { id: 'TP-01', name: '肺部健康专题', desc: '肺结节筛查、肺癌早诊早治系列科普', status: '启用', owner: '王医生' },
    { id: 'TP-02', name: '治疗期支持专题', desc: '化疗、放疗、免疫治疗期间的居家管理', status: '启用', owner: '李医生' },
    { id: 'TP-03', name: '康复与随访专题', desc: '复查时间表、生活方式与回归社会', status: '启用', owner: '孙医生' },
    { id: 'TP-04', name: '心理关怀专题', desc: '情绪识别、家属沟通与专业求助渠道', status: '停用', owner: '周医生' }
  ];
  DB.eduSchedule = [
    { id: 'SC-01', edu: 'EDU-001', channel: '患者端 App 首页', date: '2026-08-28', status: '待发布' },
    { id: 'SC-02', edu: 'EDU-002', channel: '微信公众号', date: '2026-08-26', status: '已发布' },
    { id: 'SC-03', edu: 'EDU-003', channel: '候诊大屏', date: '2026-08-27', status: '失败' }
  ];

  /* ================= 派生统计 ================= */
  function catCount(name) { return count(DB.sessions, function (s) { return s.cat === name; }); }
  function boardPostCount(name) { return count(DB.posts, function (p) { return p.board === name; }); }
  function sessionMsgs(sid) { return DB.messages.filter(function (m) { return m.session === sid; }); }
  function lastMsg(sid) { var a = sessionMsgs(sid); return a.length ? a[a.length - 1] : null; }
  function pendingUserMsg(sid) { var a = sessionMsgs(sid); return a.length ? a[a.length - 1].role === '用户' : false; }
  function eduByCat(cat) { return DB.edu.filter(function (e) { return e.cat === cat && e.status === '已发布'; }); }
  function commentCount(postId) { return count(DB.comments, function (c) { return c.post === postId; }); }
  function replyCount(postId) { var n = 0; DB.comments.forEach(function (c) { if (c.post === postId) n += (c.replies || []).length; }); return n; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /* ---------- 生成分析样本（供热点统计与分析页使用） ---------- */
  (function seedAnalysis() {
    var intents = { '肺部结节': '复查建议', '化疗后调理': '康复指导', '乳腺复查': '接种咨询', '放射治疗': '不良反应处理', '术后饮食': '饮食建议', '免疫治疗': '用药咨询', '心理支持': '情绪疏导', '复诊随访': '随访安排', '疼痛管理': '用药安全', '营养支持': '营养指导' };
    var emotions = ['中性', '焦虑', '担忧', '急迫', '平和'];
    var urgencies = ['低', '中', '高'];
    var catOf = { '肺部结节': '肿瘤防治', '化疗后调理': '康复随访', '乳腺复查': '健康科普', '放射治疗': '康复随访', '术后饮食': '肿瘤防治', '免疫治疗': '康复随访', '心理支持': '心理支持', '复诊随访': '健康科普', '疼痛管理': '肿瘤防治', '营养支持': '康复随访' };
    var weights = [9, 7, 5, 4, 4, 3, 3, 2, 2, 2];
    var n = 0;
    for (var t = 0; t < TOPICS.length; t++) {
      for (var k = 0; k < weights[t]; k++) {
        n += 1;
        DB.analysis.push({
          id: 'AN-' + (9000 + n),
          session: 'HC-2026-' + pad2(((t * 3 + k) % 8) + 1),
          topic: TOPICS[t],
          raw: TOPICS[t] + '相关问题（样本 ' + (k + 1) + '）：想确认下一步该怎么处理？',
          label: catOf[TOPICS[t]],
          intent: intents[TOPICS[t]],
          emotion: emotions[(t + k) % emotions.length],
          urgency: urgencies[(t + k) % urgencies.length],
          confidence: 0.72 + ((t * 7 + k * 3) % 25) / 100,
          status: (t + k) % 6 === 0 ? '待分析' : '已分析',
          analyzedAt: '2026-08-' + pad(20 + (k % 8)) + ' ' + pad(8 + (k % 9)) + ':' + pad((k * 7) % 60)
        });
      }
    }
  })();

  /* ---------- 热点统计：完全由分析数据实时计算 ---------- */
  function hotspotData() {
    var map = {};
    DB.analysis.forEach(function (a) { if (a.status === '已分析') { map[a.topic] = (map[a.topic] || 0) + 1; } });
    return Object.keys(map).map(function (k) { return { l: k, v: map[k] }; }).sort(function (a, b) { return b.v - a.v; });
  }

  /* ---------- 洞察建议：基于热点自动生成，保留人工处理状态 ---------- */
  function rebuildInsights() {
    var hs = hotspotData();
    var total = hs.reduce(function (s, x) { return s + x.v; }, 0) || 1;
    var kept = {};
    DB.insights.forEach(function (i) { kept[i.topic] = i; });
    DB.insights = hs.slice(0, 6).map(function (h, i) {
      var share = pct(h.v, total);
      var old = kept[h.l];
      var tone = share >= 18 ? 'danger' : share >= 10 ? 'warn' : 'info';
      var content = '「' + h.l + '」近 30 天咨询 ' + h.v + ' 次，占比 ' + share + '%。' +
        (share >= 18 ? '建议新增专项科普内容并开通预约复查入口，同时固化标准应答话术。' : share >= 10 ? '建议补充图文科普，并在会话回复中优先关联推荐。' : '维持现有科普覆盖，观察趋势变化即可。');
      return {
        id: old ? old.id : 'IN-' + pad2(i + 1),
        topic: h.l,
        title: h.l + ' 咨询热度' + (share >= 18 ? '偏高' : share >= 10 ? '上升' : '平稳'),
        content: content, share: share, tone: tone,
        status: old ? old.status : '待处理',
        adoptedAt: old ? old.adoptedAt : '',
        eduId: old ? old.eduId : ''
      };
    });
  }
  rebuildInsights();

  /* ---------- 模拟智能分析引擎（关键词规则） ---------- */
  var AI_RULES = [
    { kw: ['结节', '复查', 'ct', '随访'], topic: '肺部结节', cat: '肿瘤防治', intent: '复查建议', urgency: '中' },
    { kw: ['白细胞', '中性粒', '骨髓', '升白'], topic: '化疗后调理', cat: '康复随访', intent: '康复指导', urgency: '高' },
    { kw: ['放疗', '皮肤', '灼伤', '脱皮'], topic: '放射治疗', cat: '康复随访', intent: '不良反应处理', urgency: '中' },
    { kw: ['免疫', '靶向', 'pd-1'], topic: '免疫治疗', cat: '康复随访', intent: '用药咨询', urgency: '中' },
    { kw: ['疼', '痛', '吗啡', '止痛'], topic: '疼痛管理', cat: '肿瘤防治', intent: '用药安全', urgency: '高' },
    { kw: ['睡不着', '失眠', '焦虑', '害怕', '抑郁'], topic: '心理支持', cat: '心理支持', intent: '情绪疏导', urgency: '高' },
    { kw: ['吃', '饮食', '忌口', '营养', '补品'], topic: '术后饮食', cat: '肿瘤防治', intent: '饮食建议', urgency: '低' },
    { kw: ['疫苗', '体检', '报告', '科普'], topic: '乳腺复查', cat: '健康科普', intent: '接种咨询', urgency: '低' }
  ];
  function aiAnalyze(text) {
    var t = String(text || '').toLowerCase();
    var hit = null;
    for (var i = 0; i < AI_RULES.length && !hit; i++) {
      for (var j = 0; j < AI_RULES[i].kw.length; j++) { if (t.indexOf(AI_RULES[i].kw[j]) >= 0) { hit = AI_RULES[i]; break; } }
    }
    var emotion = /急|马上|严重|怎么办|害怕|睡不着|疼/.test(t) ? '焦虑' : /？|\?/.test(t) ? '中性' : '平和';
    return {
      topic: hit ? hit.topic : '复诊随访',
      label: hit ? hit.cat : '健康科普',
      intent: hit ? hit.intent : '综合咨询',
      emotion: emotion,
      urgency: emotion === '焦虑' ? '高' : (hit ? hit.urgency : '低'),
      confidence: hit ? 0.93 : 0.61
    };
  }

  /* ============================================================
     业务动作（真实改动 DB 后重渲染）
     ============================================================ */

  /* ---------- 会话：回复消息 ---------- */
  var QUICK_REPLIES = [
    { t: '饮食建议', c: '建议清淡饮食、保证优质蛋白，避免腌制烟熏与生冷食物；具体补品请携带成分单咨询主治医生。' },
    { t: '复查提醒', c: '请按医嘱定期复查血常规与影像，如出现发热、出血点或明显气促请及时就诊。' },
    { t: '皮肤护理', c: '保持照射区域清洁干燥，穿柔软棉质衣物，避免暴晒与摩擦，勿自行涂抹刺激性药膏。' },
    { t: '心理疏导', c: '您的感受很多病友都经历过，建议与家人一起参加医院的心理支持门诊，我们也会持续跟进。' },
    { t: '转诊提示', c: '该问题需要结合您的检查资料由专科医生判断，已为您登记线下门诊预约意向。' }
  ];
  function openReply(sessionId, messageId) {
    var s = find(DB.sessions, sessionId);
    if (!s) { say('未找到会话 ' + sessionId, 'error'); return; }
    var thread = threadHtml(sessionId);
    var eduList = eduByCat(s.cat);
    var body =
      '<div class="hc-note"><b>' + esc(s.user) + '</b>（' + esc(s.phone) + '）· 分类 ' + esc(s.cat) + ' · 优先级 ' + esc(s.priority || '低') + '<br>' + esc(s.q) + '</div>' +
      '<div style="font-size:12px;color:#667085;font-weight:600;margin-bottom:8px">历史消息（' + sessionMsgs(sessionId).length + ' 条）</div>' +
      '<div class="hc-thread">' + thread + '</div>' +
      '<div class="hc-reply">' +
      '<label style="display:block;font-size:12px;color:#475569;font-weight:600;margin-bottom:5px">回复内容 <span class="req" style="color:#b42335">*</span></label>' +
      '<textarea id="hc-reply-text" placeholder="请输入回复内容，可点击下方快捷话术快速填充…"></textarea>' +
      '<div class="hc-quick">' + QUICK_REPLIES.map(function (q, i) { return '<button type="button" data-hc="quickReply" data-arg="' + i + '">+ ' + esc(q.t) + '</button>'; }).join('') + '</div>' +
      '<div class="row"><span style="font-size:12px;color:#667085">插入科普：</span>' +
      '<select id="hc-reply-edu"><option value="">— 选择已发布科普文章 —</option>' +
      (eduList.length ? eduList.map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(e.title) + '</option>'; }).join('') : '<option value="" disabled>（该分类暂无已发布科普）</option>') +
      '</select>' +
      '<button class="btn btn-outline btn-sm" data-hc="insertEdu">插入引用</button>' +
      '<span style="margin-left:auto;font-size:12px;color:#94a3b8">回复后状态将变更为「已回复」</span></div>' +
      '</div>';
    modal('回复咨询 · ' + sessionId, s.cat, body, '发送回复', function () { doSendReply(sessionId); }, true);
    if (messageId) { var ta = $('hc-reply-text'); if (ta) { ta.value = '关于您提到的问题：'; ta.focus(); } }
  }
  function threadHtml(sid) {
    var msgs = sessionMsgs(sid);
    if (!msgs.length) return '<div class="hc-empty">暂无消息记录</div>';
    return msgs.map(function (m) {
      var cls = m.role === '系统' ? 'sys' : (m.role === '客服' ? 'mine' : '');
      return '<div class="hc-msg ' + cls + '"><div class="who">' + esc(m.from) + ' · ' + esc(m.time) + '</div><div class="bub">' + esc(m.content) + '</div></div>';
    }).join('');
  }
  function doSendReply(sessionId) {
    var text = val('hc-reply-text');
    if (!text) { say('回复内容不能为空', 'error'); return; }
    var s = find(DB.sessions, sessionId);
    var who = s && s.assignee ? s.assignee : '客服';
    DB.messages.push({ id: nextId('MSG-'), session: sessionId, from: who, role: '客服', content: text, time: now() });
    if (s) {
      s.status = '已回复';
      if (!s.assignee) { s.assignee = who; DB.assigns.unshift({ id: nextId('ASG-'), session: sessionId, from: '系统', to: who, note: '回复时自动认领', time: now() }); }
      DB.analysis.push({ id: nextId('AN-'), session: sessionId, topic: s.topic || aiAnalyze(text).topic, raw: s.q, label: s.cat, intent: aiAnalyze(s.q).intent, emotion: aiAnalyze(s.q).emotion, urgency: aiAnalyze(s.q).urgency, confidence: aiAnalyze(s.q).confidence, status: '已分析', analyzedAt: now() });
      rebuildInsights();
    }
    logAction(who, '回复咨询', sessionId);
    closeModal();
    say('回复已发送至 ' + (s ? s.user : sessionId));
    refresh();
  }
  function insertEduRef() {
    var id = val('hc-reply-edu');
    if (!id) { say('请先选择要插入的科普文章', 'error'); return; }
    var e = find(DB.edu, id);
    var ta = $('hc-reply-text');
    if (!ta || !e) return;
    var ref = '\n【推荐科普】《' + e.title + '》' + e.summary;
    ta.value = (ta.value ? ta.value.replace(/\s+$/, '') : '') + ref;
    e.views += 1;
    say('已插入科普引用，浏览量 +1');
  }

  /* ---------- 会话：分配 / 办结 ---------- */
  function openAssign(sessionId) {
    var s = find(DB.sessions, sessionId);
    if (!s) return;
    var body =
      ff(req('处理人'), fsel('hc-assign-to', DOCTORS, s.assignee || DOCTORS[0])) +
      ff(req('分配方式'), fsel('hc-assign-from', ['客服组长', '系统', '科室主任'], '客服组长')) +
      ff(req('分配说明'), fi('hc-assign-note', '', '例如：转肿瘤防治组处理'), true) +
      '<div class="full hint" style="font-size:11px;color:#94a3b8">分配后会话状态将变更为「处理中」，并写入分配处理日志。</div>';
    formModal('分配会话 · ' + sessionId, s.user + ' · ' + s.cat, body, '确认分配', function () {
      var to = val('hc-assign-to'), note = val('hc-assign-note') || '人工分配';
      if (!to) { say('请选择处理人', 'error'); return; }
      s.assignee = to; s.status = '处理中';
      DB.assigns.unshift({ id: nextId('ASG-'), session: sessionId, from: val('hc-assign-from') || '客服组长', to: to, note: note, time: now() });
      DB.messages.push({ id: nextId('MSG-'), session: sessionId, from: '系统', role: '系统', content: '本会话已分配给 ' + to + '（' + note + '）', time: now() });
      logAction(to, '接收分配', sessionId);
      closeModal(); say('已分配给 ' + to); refresh();
    });
  }
  function closeSession(sessionId) {
    var s = find(DB.sessions, sessionId); if (!s) return;
    confirmBox('办结确认', '确认将会话 ' + sessionId + ' 标记为已办结？', function () {
      s.status = '已办结';
      DB.messages.push({ id: nextId('MSG-'), session: sessionId, from: '系统', role: '系统', content: '本次咨询已办结，感谢您的信任。', time: now() });
      logAction(s.assignee || '客服', '办结会话', sessionId);
      say('会话已办结'); refresh();
    });
  }
  function autoAssign() {
    var n = 0;
    DB.sessions.forEach(function (s) {
      if (s.status !== '待分配') return;
      var cat = DB.categories.filter(function (c) { return c.name === s.cat && c.status === '启用'; })[0];
      var to = cat && cat.owner ? cat.owner : DOCTORS[n % DOCTORS.length];
      s.assignee = to; s.status = '处理中'; n += 1;
      DB.assigns.unshift({ id: nextId('ASG-'), session: s.id, from: '系统', to: to, note: '按问题分类「' + s.cat + '」自动匹配', time: now() });
      DB.messages.push({ id: nextId('MSG-'), session: s.id, from: '系统', role: '系统', content: '系统已按分类自动指派给 ' + to, time: now() });
    });
    if (n) logAction('系统', '自动分配', n + ' 条会话');
    say(n ? '自动分配完成，共处理 ' + n + ' 条待分配会话' : '当前没有待分配的会话');
    refresh();
  }

  /* ---------- 问题分类：新增 / 编辑 / 启停 / 删除 ---------- */
  function openCategory(id) {
    var c = id ? find(DB.categories, id) : null;
    var body =
      ff(req('分类名称'), fi('hc-cat-name', c ? c.name : '', '例如：营养与饮食')) +
      ff(req('负责人'), fsel('hc-cat-owner', DOCTORS, c ? c.owner : DOCTORS[0])) +
      ff(req('分类说明'), fi('hc-cat-desc', c ? c.desc : '', '一句话描述该分类覆盖的问题范围'), true) +
      ff('状态', fsel('hc-cat-status', ['启用', '停用'], c ? c.status : '启用'));
    formModal(c ? '编辑分类 · ' + c.name : '新增问题分类', c ? c.id : '分类用于会话归集与自动分配', body, '保存', function () {
      var name = val('hc-cat-name'), desc = val('hc-cat-desc');
      if (!name) { say('分类名称不能为空', 'error'); return; }
      if (!c && DB.categories.some(function (x) { return x.name === name; })) { say('该分类名称已存在', 'error'); return; }
      if (c) { c.name = name; c.desc = desc; c.owner = val('hc-cat-owner'); c.status = val('hc-cat-status'); }
      else { DB.categories.push({ id: nextId('CAT-'), name: name, desc: desc, owner: val('hc-cat-owner'), status: val('hc-cat-status') }); if (CATS.indexOf(name) < 0) CATS.push(name); }
      closeModal(); say(c ? '分类已更新' : '分类已新增'); refresh();
    });
  }
  function toggleCategory(id) {
    var c = find(DB.categories, id); if (!c) return;
    c.status = c.status === '启用' ? '停用' : '启用';
    logAction('管理员', '切换分类状态', c.name);
    say('「' + c.name + '」已' + c.status); refresh();
  }
  function removeCategory(id) {
    var c = find(DB.categories, id); if (!c) return;
    var used = catCount(c.name);
    if (used) { say('该分类下仍有 ' + used + ' 条会话，无法删除，请先改为停用', 'error'); return; }
    confirmBox('删除确认', '确认删除分类「' + c.name + '」？', function () {
      DB.categories = DB.categories.filter(function (x) { return x.id !== id; });
      logAction('管理员', '删除分类', c.name);
      say('分类已删除'); refresh();
    });
  }

  /* ---------- 智能分析 ---------- */
  function runAnalysis(id) {
    var a = find(DB.analysis, id); if (!a) return;
    var r = aiAnalyze(a.raw);
    a.topic = r.topic; a.label = r.label; a.intent = r.intent; a.emotion = r.emotion; a.urgency = r.urgency; a.confidence = r.confidence;
    a.status = '已分析'; a.analyzedAt = now();
    rebuildInsights();
    logAction('智能分析引擎', '执行分析', a.id);
    say('分析完成：' + r.intent + ' / ' + r.emotion + ' / 紧急度 ' + r.urgency);
    refresh();
  }
  function runAllPending() {
    var n = 0;
    DB.analysis.forEach(function (a) { if (a.status === '待分析') { var r = aiAnalyze(a.raw); a.topic = r.topic; a.label = r.label; a.intent = r.intent; a.emotion = r.emotion; a.urgency = r.urgency; a.confidence = r.confidence; a.status = '已分析'; a.analyzedAt = now(); n += 1; } });
    rebuildInsights();
    say(n ? '批量分析完成，共处理 ' + n + ' 条待分析文本' : '没有待分析的文本');
    refresh();
  }
  function openReview(id) {
    var a = find(DB.analysis, id); if (!a) return;
    var body =
      '<div class="full hc-note"><b>原始文本：</b>' + esc(a.raw) + '</div>' +
      ff('识别意图', fi('hc-rv-intent', a.intent, '')) +
      ff('情绪识别', fsel('hc-rv-emotion', ['中性', '焦虑', '担忧', '平和'], a.emotion)) +
      ff('紧急程度', fsel('hc-rv-urgency', ['低', '中', '高'], a.urgency)) +
      ff('问题分类', fsel('hc-rv-label', CATS, a.label)) +
      ff('话题标签', fi('hc-rv-topic', a.topic, '用于热点统计')) +
      ff('置信度', fi('hc-rv-conf', (a.confidence * 100).toFixed(0), '0-100'));
    formModal('人工复核 · ' + a.id, '低置信度结果建议复核后入库', body, '保存复核', function () {
      a.intent = val('hc-rv-intent') || a.intent;
      a.emotion = val('hc-rv-emotion'); a.urgency = val('hc-rv-urgency');
      a.label = val('hc-rv-label'); a.topic = val('hc-rv-topic') || a.topic;
      a.confidence = Math.max(0, Math.min(100, parseInt(val('hc-rv-conf'), 10) || 0)) / 100;
      a.status = '已分析'; a.analyzedAt = now();
      rebuildInsights(); closeModal(); say('复核结果已保存'); refresh();
    });
  }

  /* ---------- 洞察建议：采纳 / 忽略 ---------- */
  function adoptInsight(id) {
    var it = find(DB.insights, id); if (!it) return;
    var catOfTopic = {};
    DB.analysis.forEach(function (a) { catOfTopic[a.topic] = a.label; });
    var body =
      '<div class="full hc-note"><b>' + esc(it.title) + '</b><br>' + esc(it.content) + '</div>' +
      ff(req('科普标题'), fi('hc-ad-title', it.topic + '：患者最关心的问题解答', ''), true) +
      ff('内容形式', fsel('hc-ad-type', EDU_TYPES, '图文')) +
      ff('关联问题分类', fsel('hc-ad-cat', CATS, catOfTopic[it.topic] || CATS[0])) +
      ff('发布人', fsel('hc-ad-author', DOCTORS, DOCTORS[0])) +
      ff('标签', fi('hc-ad-tags', it.topic, '多个标签用、分隔'), true) +
      '<div class="full hint" style="font-size:11px;color:#94a3b8">采纳后将自动生成一篇「草稿」状态的科普内容，可在「科普内容配置」中继续编辑并发布。</div>';
    formModal('采纳洞察建议 · ' + it.id, '一键转化为科普内容', body, '采纳并生成草稿', function () {
      var title = val('hc-ad-title');
      if (!title) { say('科普标题不能为空', 'error'); return; }
      var edu = {
        id: nextId('EDU-'), title: title, type: val('hc-ad-type'), cat: val('hc-ad-cat'), topic: it.topic,
        tags: (val('hc-ad-tags') || it.topic).split(/[、,，]/).filter(Boolean),
        summary: it.content, content: it.content, status: '草稿', views: 0, likes: 0,
        author: val('hc-ad-author'), publishAt: '', top: false, source: 'AI 洞察生成'
      };
      DB.edu.unshift(edu);
      it.status = '已采纳'; it.adoptedAt = now(); it.eduId = edu.id;
      logAction('运营', '采纳洞察建议', it.id + '→' + edu.id);
      closeModal(); say('已生成科普草稿《' + title + '》'); refresh();
    });
  }
  function ignoreInsight(id) {
    var it = find(DB.insights, id); if (!it) return;
    it.status = '已忽略'; it.adoptedAt = now();
    logAction('运营', '忽略洞察建议', it.id);
    say('建议已忽略'); refresh();
  }
  function restoreInsight(id) {
    var it = find(DB.insights, id); if (!it) return;
    it.status = '待处理'; it.adoptedAt = '';
    say('建议已恢复为待处理'); refresh();
  }

  /* ---------- 社区：板块 CRUD ---------- */
  function openBoard(id) {
    var b = id ? find(DB.boards, id) : null;
    var body =
      ff(req('板块名称'), fi('hc-bd-name', b ? b.name : '', '例如：病友家属交流区')) +
      ff(req('版主'), fsel('hc-bd-mod', DOCTORS.concat(['营养师小林']), b ? b.moderator : DOCTORS[0])) +
      ff(req('板块说明'), fi('hc-bd-desc', b ? b.desc : '', '一句话描述板块定位'), true) +
      ff('状态', fsel('hc-bd-status', ['启用', '停用'], b ? b.status : '启用'));
    formModal(b ? '编辑板块 · ' + b.name : '新增板块', '板块是社区内容的顶层归类', body, '保存', function () {
      var name = val('hc-bd-name');
      if (!name) { say('板块名称不能为空', 'error'); return; }
      if (!b && DB.boards.some(function (x) { return x.name === name; })) { say('板块名称已存在', 'error'); return; }
      if (b) { b.name = name; b.desc = val('hc-bd-desc'); b.moderator = val('hc-bd-mod'); b.status = val('hc-bd-status'); }
      else { DB.boards.push({ id: nextId('BD-'), name: name, desc: val('hc-bd-desc'), moderator: val('hc-bd-mod'), status: val('hc-bd-status') }); }
      closeModal(); say(b ? '板块已更新' : '板块已新增'); refresh();
    });
  }
  function toggleBoard(id) {
    var b = find(DB.boards, id); if (!b) return;
    b.status = b.status === '启用' ? '停用' : '启用';
    logAction('运营', '切换板块状态', b.name);
    say('「' + b.name + '」已' + b.status); refresh();
  }

  /* ---------- 社区：主帖审核 / 下架 / 推荐 ---------- */
  function openPost(id) {
    var p = find(DB.posts, id); if (!p) return;
    var cs = DB.comments.filter(function (c) { return c.post === id; });
    var body =
      '<div class="hc-note"><b>' + esc(p.title) + '</b><br>' + esc(p.content) + '</div>' +
      '<div class="hc-kv" style="margin-bottom:14px">' +
      '<div><div class="k">所属板块</div><div class="vl">' + esc(p.board) + '</div></div>' +
      '<div><div class="k">作者</div><div class="vl">' + esc(p.user) + '</div></div>' +
      '<div><div class="k">发布时间</div><div class="vl">' + esc(p.time) + '</div></div>' +
      '<div><div class="k">状态</div><div class="vl">' + st(p.status) + '</div></div>' +
      '<div><div class="k">浏览量</div><div class="vl">' + p.views + '</div></div>' +
      '<div><div class="k">点赞数</div><div class="vl">' + p.likes + '</div></div>' +
      '</div>' +
      '<div style="font-size:12px;color:#667085;font-weight:600;margin-bottom:8px">评论（' + cs.length + ' 条）</div>' +
      (cs.length ? '<div class="hc-stack">' + cs.map(function (c) {
        return '<div class="hc-item"><div class="tt">' + esc(c.user) + ' <span style="font-weight:400;color:#94a3b8;font-size:11px">' + esc(c.time) + '</span></div>' +
          '<div class="ds">' + esc(c.content) + '</div>' +
          ((c.replies || []).length ? '<div class="ds" style="color:#244765">' + c.replies.map(function (r) { return '↳ ' + esc(r.user) + '：' + esc(r.content); }).join('<br>') + '</div>' : '') +
          '<div class="ft">' + st(c.status) + '<span>点赞 ' + c.like + '</span>' + act('回复', 'replyComment', c.id) + '</div></div>';
      }).join('') + '</div>' : '<div class="hc-empty">该主帖暂无评论</div>');
    var acts = p.status === '待审核'
      ? '<button class="btn btn-primary btn-sm" data-hc="approvePost" data-arg="' + esc(p.id) + '">审核通过</button><button class="btn btn-ghost btn-sm" data-hc="rejectPost" data-arg="' + esc(p.id) + '">驳回</button>'
      : (p.status === '已发布' ? '<button class="btn btn-ghost btn-sm" data-hc="unpublishPost" data-arg="' + esc(p.id) + '">下架</button>' : '<button class="btn btn-primary btn-sm" data-hc="approvePost" data-arg="' + esc(p.id) + '">重新发布</button>');
    modal('主帖详情 · ' + p.id, p.board, body, null, null, true);
    var ft = document.querySelector('.hc-modal .ft');
    if (ft) { ft.innerHTML = '<button class="btn btn-ghost btn-sm" data-hc="close">关闭</button>' + acts; }
  }
  function approvePost(id) {
    var p = find(DB.posts, id); if (!p) return;
    p.status = '已发布'; p.time = now();
    logAction('运营', '审核通过主帖', id);
    closeModal(); say('主帖《' + p.title + '》已发布'); refresh();
  }
  function rejectPost(id) {
    var p = find(DB.posts, id); if (!p) return;
    var body = ff(req('驳回原因'), fta('hc-reject-reason', '', '请说明驳回原因，将通知作者'), true);
    formModal('驳回主帖 · ' + id, p.title, body, '确认驳回', function () {
      var r = val('hc-reject-reason');
      if (!r) { say('请填写驳回原因', 'error'); return; }
      p.status = '已驳回'; p.rejectReason = r;
      logAction('运营', '驳回主帖', id);
      closeModal(); say('主帖已驳回并通知作者'); refresh();
    });
  }
  function unpublishPost(id) {
    var p = find(DB.posts, id); if (!p) return;
    confirmBox('下架确认', '确认下架主帖《' + p.title + '》？', function () {
      p.status = '已下架';
      logAction('运营', '下架主帖', id);
      closeModal(); say('主帖已下架'); refresh();
    });
  }

  /* ---------- 社区：评论回复 / 屏蔽 / 删除 ---------- */
  function openCommentReply(id) {
    var c = find(DB.comments, id); if (!c) return;
    var body =
      '<div class="hc-note"><b>' + esc(c.user) + '：</b>' + esc(c.content) + '</div>' +
      ff(req('回复身份'), fsel('hc-cr-user', DOCTORS.concat(['运营小编']), DOCTORS[0])) +
      ff(req('回复内容'), fta('hc-cr-text', '', '请输入官方回复内容'), true) +
      '<div class="full hint" style="font-size:11px;color:#94a3b8">回复将展示在评论下方，并自动把该评论状态置为「正常」。</div>';
    formModal('回复评论 · ' + c.id, '主帖 ' + c.post, body, '发送回复', function () {
      var text = val('hc-cr-text');
      if (!text) { say('回复内容不能为空', 'error'); return; }
      c.replies = c.replies || [];
      c.replies.push({ user: val('hc-cr-user'), content: text, time: now() });
      if (c.status === '待审核') c.status = '正常';
      logAction(val('hc-cr-user'), '回复评论', c.id);
      closeModal(); say('回复已发布'); refresh();
    });
  }
  function approveComment(id) {
    var c = find(DB.comments, id); if (!c) return;
    c.status = '正常';
    logAction('运营', '审核通过评论', id);
    say('评论已通过'); refresh();
  }
  function hideComment(id) {
    var c = find(DB.comments, id); if (!c) return;
    c.status = c.status === '已屏蔽' ? '正常' : '已屏蔽';
    logAction('运营', c.status === '已屏蔽' ? '屏蔽评论' : '恢复评论', id);
    say(c.status === '已屏蔽' ? '评论已屏蔽' : '评论已恢复'); refresh();
  }
  function removeComment(id) {
    var c = find(DB.comments, id); if (!c) return;
    confirmBox('删除确认', '确认删除该评论及其 ' + (c.replies || []).length + ' 条回复？', function () {
      DB.comments = DB.comments.filter(function (x) { return x.id !== id; });
      logAction('运营', '删除评论', id);
      say('评论已删除'); refresh();
    });
  }
  function toggleRecommend(postId) {
    var r = DB.recommends.filter(function (x) { return x.post === postId; })[0];
    var p = find(DB.posts, postId);
    if (!p) return;
    if (!r) {
      DB.recommends.unshift({ id: nextId('RC-'), post: postId, reason: '人工推荐：' + p.title, status: '已推荐' });
      logAction('运营', '推荐内容', postId);
      say('已加入优质内容推荐');
    } else if (r.status === '已推荐') {
      r.status = '待审核'; say('已取消推荐');
    } else {
      r.status = '已推荐'; say('已设为推荐');
    }
    refresh();
  }

  /* ---------- 科普内容：CRUD / 发布 / 下架 / 置顶 ---------- */
  function openEdu(id) {
    var e = id ? find(DB.edu, id) : null;
    var body =
      ff(req('科普标题'), fi('hc-edu-title', e ? e.title : '', '例如：化疗期间为什么要定期查血常规？'), true) +
      ff(req('内容形式'), fsel('hc-edu-type', EDU_TYPES, e ? e.type : '图文')) +
      ff(req('关联问题分类'), fsel('hc-edu-cat', CATS, e ? e.cat : CATS[0])) +
      ff(req('话题标签'), fi('hc-edu-topic', e ? e.topic : '', '用于热点统计，如：肺部结节')) +
      ff(req('作者'), fsel('hc-edu-author', DOCTORS.concat(['营养师小林']), e ? e.author : DOCTORS[0])) +
      ff(req('内容摘要'), fta('hc-edu-summary', e ? e.summary : '', '列表与推送展示用，建议 60 字以内', 2), true) +
      ff(req('正文内容'), fta('hc-edu-content', e ? e.content : '', '支持多段落纯文本', 5), true) +
      ff('关键词标签', fi('hc-edu-tags', e ? e.tags.join('、') : '', '多个标签用、分隔'), true) +
      '<div class="full hint" style="font-size:11px;color:#94a3b8">保存后为「草稿」；已发布内容会被「咨询会话回复」自动引用推荐。</div>';
    formModal(e ? '编辑科普内容 · ' + e.id : '新增科普内容', e ? e.status : '科普内容可关联问题分类，供客服回复时一键引用', body, '保存', function () {
      var title = val('hc-edu-title'), summary = val('hc-edu-summary'), content = val('hc-edu-content');
      if (!title) { say('标题不能为空', 'error'); return; }
      if (!summary) { say('摘要不能为空', 'error'); return; }
      if (!content) { say('正文不能为空', 'error'); return; }
      var tags = (val('hc-edu-tags') || '').split(/[、,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (e) {
        e.title = title; e.type = val('hc-edu-type'); e.cat = val('hc-edu-cat'); e.topic = val('hc-edu-topic') || e.topic;
        e.author = val('hc-edu-author'); e.summary = summary; e.content = content; e.tags = tags;
      } else {
        DB.edu.unshift({ id: nextId('EDU-'), title: title, type: val('hc-edu-type'), cat: val('hc-edu-cat'), topic: val('hc-edu-topic') || '复诊随访', tags: tags, summary: summary, content: content, status: '草稿', views: 0, likes: 0, author: val('hc-edu-author'), publishAt: '', top: false, source: '人工编辑' });
      }
      logAction('运营', e ? '编辑科普内容' : '新增科普内容', title);
      closeModal(); say(e ? '内容已保存' : '草稿已创建'); refresh();
    }, true);
  }
  function submitEduReview(id) {
    var e = find(DB.edu, id); if (!e) return;
    e.status = '待审核';
    logAction('运营', '提交科普审核', e.title);
    say('已提交审核'); refresh();
  }
  function publishEdu(id) {
    var e = find(DB.edu, id); if (!e) return;
    e.status = '已发布'; e.publishAt = today();
    DB.eduSchedule.unshift({ id: nextId('SC-'), edu: e.id, channel: CHANNELS[0], date: today(), status: '已发布' });
    logAction('运营', '发布科普内容', e.title);
    say('《' + e.title + '》已发布，并生成站内排期'); refresh();
  }
  function unpublishEdu(id) {
    var e = find(DB.edu, id); if (!e) return;
    confirmBox('下架确认', '下架后该科普将不再出现在患者端与客服引用列表中，确认下架《' + e.title + '》？', function () {
      e.status = '已下架'; e.top = false;
      logAction('运营', '下架科普内容', e.title);
      say('内容已下架'); refresh();
    });
  }
  function toggleEduTop(id) {
    var e = find(DB.edu, id); if (!e) return;
    if (!e.top) { DB.edu.forEach(function (x) { x.top = false; }); e.top = true; say('已置顶《' + e.title + '》'); }
    else { e.top = false; say('已取消置顶'); }
    logAction('运营', e.top ? '置顶科普内容' : '取消置顶', e.title);
    refresh();
  }
  function removeEdu(id) {
    var e = find(DB.edu, id); if (!e) return;
    if (e.status === '已发布') { say('已发布内容请先下架再删除', 'error'); return; }
    confirmBox('删除确认', '确认删除科普内容《' + e.title + '》？', function () {
      DB.edu = DB.edu.filter(function (x) { return x.id !== id; });
      DB.eduSchedule = DB.eduSchedule.filter(function (x) { return x.edu !== id; });
      logAction('运营', '删除科普内容', e.title);
      say('内容已删除'); refresh();
    });
  }
  function openEduTopic(id) {
    var t = id ? find(DB.eduTopics, id) : null;
    var body =
      ff(req('专题名称'), fi('hc-tp-name', t ? t.name : '', '例如：早癌筛查月专题')) +
      ff(req('负责人'), fsel('hc-tp-owner', DOCTORS, t ? t.owner : DOCTORS[0])) +
      ff(req('专题说明'), fi('hc-tp-desc', t ? t.desc : '', '专题收录哪类科普内容'), true) +
      ff('状态', fsel('hc-tp-status', ['启用', '停用'], t ? t.status : '启用'));
    formModal(t ? '编辑专题 · ' + t.name : '新增科普专题', '专题用于把同主题科普聚合展示', body, '保存', function () {
      var name = val('hc-tp-name');
      if (!name) { say('专题名称不能为空', 'error'); return; }
      if (t) { t.name = name; t.desc = val('hc-tp-desc'); t.owner = val('hc-tp-owner'); t.status = val('hc-tp-status'); }
      else { DB.eduTopics.push({ id: nextId('TP-'), name: name, desc: val('hc-tp-desc'), owner: val('hc-tp-owner'), status: val('hc-tp-status') }); }
      closeModal(); say('专题已保存'); refresh();
    });
  }
  function toggleEduTopic(id) {
    var t = find(DB.eduTopics, id); if (!t) return;
    t.status = t.status === '启用' ? '停用' : '启用';
    say('「' + t.name + '」已' + t.status); refresh();
  }
  function openSchedule(id) {
    var sc = id ? find(DB.eduSchedule, id) : null;
    var published = DB.edu.filter(function (e) { return e.status === '已发布' || e.status === '待审核'; });
    if (!published.length) { say('请先创建科普内容', 'error'); return; }
    var body =
      ff(req('科普内容'), fsel('hc-sc-edu', published.map(function (e) { return e.id + ' ' + e.title; }), sc ? sc.edu : published[0].id)) +
      ff(req('发布渠道'), fsel('hc-sc-ch', CHANNELS, sc ? sc.channel : CHANNELS[0])) +
      ff(req('计划日期'), fi('hc-sc-date', sc ? sc.date : today(), '', 'date'));
    formModal(sc ? '编辑排期 · ' + sc.id : '新增发布排期', '排期到点后由运营执行发布', body, '保存排期', function () {
      var label = val('hc-sc-edu'), eduId = label.split(' ')[0];
      var obj = { id: sc ? sc.id : nextId('SC-'), edu: eduId, channel: val('hc-sc-ch'), date: val('hc-sc-date') || today(), status: sc ? sc.status : '待发布' };
      if (sc) { sc.edu = eduId; sc.channel = obj.channel; sc.date = obj.date; }
      else { DB.eduSchedule.unshift(obj); }
      logAction('运营', sc ? '调整发布排期' : '新增发布排期', eduId);
      closeModal(); say('排期已保存'); refresh();
    });
  }
  function publishNow(id) {
    var sc = find(DB.eduSchedule, id); if (!sc) return;
    var e = find(DB.edu, sc.edu);
    sc.status = '已发布'; sc.date = today();
    if (e && e.status !== '已发布') { e.status = '已发布'; e.publishAt = today(); }
    logAction('运营', '立即发布', sc.edu + '→' + sc.channel);
    say('已通过「' + sc.channel + '」发布'); refresh();
  }
  function retrySchedule(id) {
    var sc = find(DB.eduSchedule, id); if (!sc) return;
    sc.status = '已发布';
    logAction('运营', '重试发布', sc.edu);
    say('重试发布成功'); refresh();
  }
  function cancelSchedule(id) {
    var sc = find(DB.eduSchedule, id); if (!sc) return;
    DB.eduSchedule = DB.eduSchedule.filter(function (x) { return x.id !== id; });
    say('排期已取消'); refresh();
  }

  /* ============================================================
     页面 1：咨询会话管理
     ============================================================ */
  var F_SESSIONS = [
    { k: 'kw', label: '关键字', ph: '会话编号 / 咨询人 / 问题内容' },
    { k: 'cat', label: '问题分类', type: 'select', options: ['全部分类'].concat(CATS), def: '全部分类' },
    { k: 'status', label: '会话状态', type: 'select', options: ['全部状态', '待分配', '处理中', '已回复', '已办结'], def: '全部状态' },
    { k: 'assignee', label: '处理人', type: 'select', options: ['全部'].concat(DOCTORS), def: '全部' }
  ];
  function filteredSessions() {
    var key = 'consult-sessions:sessions';
    var kw = fv(key, 'kw').toLowerCase();
    var cat = fv(key, 'cat', '全部分类'), status = fv(key, 'status', '全部状态'), who = fv(key, 'assignee', '全部');
    return DB.sessions.filter(function (s) {
      if (cat !== '全部分类' && s.cat !== cat) return false;
      if (status !== '全部状态' && s.status !== status) return false;
      if (who !== '全部' && s.assignee !== who) return false;
      if (kw && (s.id + s.user + s.q + s.cat).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
  }
  function renderSessionsTab() {
    var key = 'consult-sessions:sessions';
    var list = filteredSessions();
    var rows = slice(list, key, 8).map(function (s) {
      var wait = pendingUserMsg(s.id);
      return '<tr><td><a href="javascript:void(0)" style="color:var(--primary);font-weight:600" data-hc="openSession" data-arg="' + esc(s.id) + '">' + esc(s.id) + '</a></td>' +
        '<td>' + esc(s.user) + '<div style="font-size:11px;color:#94a3b8">' + esc(s.phone) + '</div></td>' +
        '<td>' + esc(s.cat) + '</td>' +
        '<td class="clip" title="' + esc(s.q) + '">' + esc(s.q) + '</td>' +
        '<td>' + esc(s.topic || '—') + '</td>' +
        '<td>' + (s.priority === '高' ? tone('高', 'danger') : s.priority === '中' ? tone('中', 'warn') : tone('低', 'neutral')) + '</td>' +
        '<td>' + st(s.status) + (wait ? '<div style="font-size:11px;color:#b42335;margin-top:2px">待回复</div>' : '') + '</td>' +
        '<td>' + esc(s.assignee || '—') + '</td>' +
        '<td>' + esc(s.time) + '</td>' +
        '<td>' + ops(
          act('回复', 'reply', s.id, 'btn-primary'),
          s.status === '待分配' ? act('分配', 'assign', s.id, 'btn-outline') : act('改派', 'assign', s.id),
          s.status === '已回复' ? act('办结', 'closeSession', s.id) : act('详情', 'openSession', s.id)
        ) + '</td></tr>';
    }).join('');
    return filterBar(key, F_SESSIONS) +
      '<div class="hc-toolbar"><div class="l"><span style="font-size:12px;color:#667085">筛选结果 ' + list.length + ' 条</span></div>' +
      '<div class="l">' + act('自动分配待办', 'autoAssign', '', 'btn-outline') + act('导出会话', 'export', '会话主记录') + '</div></div>' +
      card('会话主记录', table(['会话编号', '咨询人', '问题分类', '咨询内容', '话题', '优先级', '状态', '处理人', '发起时间', '操作'], rows, '没有符合条件的会话，试试调整筛选条件') + pager(key, list.length, 8), '点击会话编号可查看完整消息流');
  }

  var F_MSGS = [
    { k: 'kw', label: '消息内容', ph: '输入关键词检索' },
    { k: 'session', label: '会话编号', ph: 'HC-2026-0001' },
    { k: 'role', label: '发送方', type: 'select', options: ['全部', '用户', '客服', '系统'], def: '全部' }
  ];
  function filteredMsgs() {
    var key = 'consult-sessions:messages';
    var kw = fv(key, 'kw').toLowerCase(), sid = fv(key, 'session').toLowerCase();
    var role = fv(key, 'role', '全部');
    return DB.messages.filter(function (m) {
      if (role !== '全部' && m.role !== role) return false;
      if (kw && m.content.toLowerCase().indexOf(kw) < 0) return false;
      if (sid && m.session.toLowerCase().indexOf(sid) < 0) return false;
      return true;
    }).slice().reverse();
  }
  function renderMessagesTab() {
    var key = 'consult-sessions:messages';
    var list = filteredMsgs();
    var rows = slice(list, key, 10).map(function (m) {
      return '<tr><td>' + esc(m.id) + '</td>' +
        '<td><a href="javascript:void(0)" style="color:var(--primary)" data-hc="openSession" data-arg="' + esc(m.session) + '">' + esc(m.session) + '</a></td>' +
        '<td>' + tone(m.role === '用户' ? '咨询人' : m.role === '系统' ? '系统' : '客服', m.role === '用户' ? 'info' : m.role === '系统' ? 'neutral' : 'success') + '</td>' +
        '<td>' + esc(m.from) + '</td>' +
        '<td class="clip" title="' + esc(m.content) + '">' + esc(m.content) + '</td>' +
        '<td>' + esc(m.time) + '</td>' +
        '<td>' + ops(m.role === '用户' ? act('回复', 'reply', m.session, 'btn-primary') : act('查看会话', 'openSession', m.session)) + '</td></tr>';
    }).join('');
    return filterBar(key, F_MSGS) +
      card('消息明细', table(['消息编号', '所属会话', '发送方', '发送人', '消息内容', '发送时间', '操作'], rows, '没有匹配的消息') + pager(key, list.length, 10), '最新消息优先展示');
  }
  function renderCategoryTab() {
    var rows = DB.categories.map(function (c) {
      var n = catCount(c.name);
      var eduN = count(DB.edu, function (e) { return e.cat === c.name && e.status === '已发布'; });
      return '<tr><td>' + esc(c.id) + '</td><td><strong>' + esc(c.name) + '</strong></td><td class="clip">' + esc(c.desc) + '</td>' +
        '<td>' + esc(c.owner) + '</td><td>' + n + '</td><td>' + eduN + '</td><td>' + st(c.status) + '</td>' +
        '<td>' + ops(act('编辑', 'editCat', c.id), act(c.status === '启用' ? '停用' : '启用', 'toggleCat', c.id), act('删除', 'delCat', c.id)) + '</td></tr>';
    }).join('');
    return '<div class="hc-toolbar"><div class="l"><span style="font-size:12px;color:#667085">分类决定会话归集与自动分配去向</span></div>' +
      '<div class="l">' + act('新增分类', 'newCat', '', 'btn-primary') + '</div></div>' +
      card('问题分类体系', table(['分类编号', '分类名称', '说明', '负责人', '会话数', '已发布科普', '状态', '操作'], rows));
  }
  var F_ASSIGN = [
    { k: 'kw', label: '会话编号', ph: 'HC-2026-…' },
    { k: 'to', label: '处理人', type: 'select', options: ['全部'].concat(DOCTORS), def: '全部' },
    { k: 'from', label: '分配来源', type: 'select', options: ['全部', '系统', '客服组长', '科室主任'], def: '全部' }
  ];
  function renderAssignTab() {
    var key = 'consult-sessions:assign';
    var kw = fv(key, 'kw').toLowerCase();
    var to = fv(key, 'to', '全部'), from = fv(key, 'from', '全部');
    var list = DB.assigns.filter(function (a) {
      if (to !== '全部' && a.to !== to) return false;
      if (from !== '全部' && a.from !== from) return false;
      if (kw && (a.session + a.note).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    var rows = slice(list, key, 10).map(function (a) {
      return '<tr><td>' + esc(a.id) + '</td>' +
        '<td><a href="javascript:void(0)" style="color:var(--primary)" data-hc="openSession" data-arg="' + esc(a.session) + '">' + esc(a.session) + '</a></td>' +
        '<td>' + tone(a.from, a.from === '系统' ? 'info' : 'neutral') + '</td><td>' + esc(a.to) + '</td>' +
        '<td class="clip" title="' + esc(a.note) + '">' + esc(a.note) + '</td><td>' + esc(a.time) + '</td>' +
        '<td>' + ops(act('回复', 'reply', a.session, 'btn-primary'), act('改派', 'assign', a.session)) + '</td></tr>';
    }).join('');
    var auto = count(DB.assigns, function (a) { return a.from === '系统'; });
    return filterBar(key, F_ASSIGN) +
      '<div class="hc-toolbar"><div class="l"></div><div class="l">' + act('自动分配待办', 'autoAssign', '', 'btn-outline') + '</div></div>' +
      card('分配处理日志', table(['日志编号', '会话编号', '分配来源', '处理人', '分配说明', '时间', '操作'], rows, '暂无分配记录') + pager(key, list.length, 10));
  }
  function renderConsultSessions() {
    var t = HC.tab['consult-sessions'];
    var body = t === 'sessions' ? renderSessionsTab() : t === 'messages' ? renderMessagesTab() : t === 'category' ? renderCategoryTab() : renderAssignTab();
    return heads('咨询会话管理', '会话主记录 · 消息明细 · 问题分类 · 分配处理，一站式完成受理与回复',
      '<button class="btn btn-primary btn-sm" data-hc="newSession">+ 代录入咨询</button>') +
      tabs('consult-sessions', [
        { id: 'sessions', label: '会话主记录', n: DB.sessions.length },
        { id: 'messages', label: '消息明细', n: DB.messages.length },
        { id: 'category', label: '问题分类体系', n: DB.categories.length },
        { id: 'assign', label: '分配处理日志', n: DB.assigns.length }
      ]) + body;
  }
  function openSessionDetail(id) {
    var s = find(DB.sessions, id); if (!s) { say('未找到会话', 'error'); return; }
    var a = DB.analysis.filter(function (x) { return x.session === id; }).slice(-1)[0];
    var eduList = eduByCat(s.cat);
    var body =
      '<div class="hc-kv" style="margin-bottom:14px">' +
      '<div><div class="k">咨询人</div><div class="vl">' + esc(s.user) + '（' + esc(s.phone) + '）</div></div>' +
      '<div><div class="k">问题分类 / 话题</div><div class="vl">' + esc(s.cat) + ' · ' + esc(s.topic || '—') + '</div></div>' +
      '<div><div class="k">状态</div><div class="vl">' + st(s.status) + '</div></div>' +
      '<div><div class="k">处理人</div><div class="vl">' + esc(s.assignee || '未分配') + '</div></div>' +
      '<div><div class="k">发起时间</div><div class="vl">' + esc(s.time) + '</div></div>' +
      '<div><div class="k">优先级</div><div class="vl">' + esc(s.priority || '低') + '</div></div>' +
      '</div>' +
      '<div class="hc-note"><b>咨询问题：</b>' + esc(s.q) + '</div>' +
      (a ? '<div class="hc-note" style="border-left-color:#2e7d32;background:#f2fbf3;border-color:#cfe8d2"><b>智能分析：</b>' + esc(a.intent) + ' · 情绪 ' + esc(a.emotion) + ' · 紧急度 ' + esc(a.urgency) + ' · 置信度 ' + Math.round(a.confidence * 100) + '%</div>' : '') +
      (eduList.length ? '<div style="font-size:12px;color:#667085;font-weight:600;margin:10px 0 6px">可引用的科普内容</div>' + chips(eduList.map(function (e) { return e.title; }), 'green') : '') +
      '<div style="font-size:12px;color:#667085;font-weight:600;margin:14px 0 8px">消息流（' + sessionMsgs(id).length + '）</div>' +
      '<div class="hc-thread">' + threadHtml(id) + '</div>';
    modal('会话详情 · ' + id, s.user, body, null, null, true);
    var ft = document.querySelector('.hc-modal .ft');
    if (ft) {
      ft.innerHTML = '<button class="btn btn-ghost btn-sm" data-hc="close">关闭</button>' +
        (s.status !== '已办结' ? '<button class="btn btn-outline btn-sm" data-hc="assign" data-arg="' + esc(id) + '">分配 / 改派</button><button class="btn btn-primary btn-sm" data-hc="reply" data-arg="' + esc(id) + '">回复咨询</button>' : '');
    }
  }
  function openNewSession() {
    var body =
      ff(req('咨询人姓名'), fi('hc-ns-user', '', '例如：李阿姨')) +
      ff(req('联系电话'), fi('hc-ns-phone', '', '138****0000')) +
      ff(req('问题分类'), fsel('hc-ns-cat', CATS, CATS[0])) +
      ff('优先级', fsel('hc-ns-pri', ['低', '中', '高'], '中')) +
      ff(req('咨询内容'), fta('hc-ns-q', '', '请如实记录患者或家属提出的问题', 4), true) +
      '<div class="full hint" style="font-size:11px;color:#94a3b8">保存后将自动生成会话编号与首条消息，并进入「待分配」队列。</div>';
    formModal('代录入咨询', '为电话 / 线下渠道来的咨询建立会话记录', body, '创建会话', function () {
      var user = val('hc-ns-user'), phone = val('hc-ns-phone'), q = val('hc-ns-q');
      if (!user || !q) { say('姓名与咨询内容必填', 'error'); return; }
      var id = 'HC-2026-' + pad2(DB.sessions.length + 1);
      var r = aiAnalyze(q);
      DB.sessions.unshift({ id: id, user: user, phone: phone || '—', cat: val('hc-ns-cat'), topic: r.topic, q: q, status: '待分配', time: now(), assignee: '', priority: val('hc-ns-pri') });
      DB.messages.push({ id: nextId('MSG-'), session: id, from: user, role: '用户', content: q, time: now() });
      DB.analysis.push({ id: nextId('AN-'), session: id, topic: r.topic, raw: q, label: val('hc-ns-cat'), intent: r.intent, emotion: r.emotion, urgency: r.urgency, confidence: r.confidence, status: '待分析', analyzedAt: '' });
      logAction('客服', '代录入咨询', id);
      closeModal(); say('会话 ' + id + ' 已创建'); refresh();
    });
  }

  /* ============================================================
     页面 2：咨询问题分析
     ============================================================ */
  var F_RAW = [
    { k: 'kw', label: '原始文本', ph: '输入关键词检索' },
    { k: 'status', label: '分析状态', type: 'select', options: ['全部', '待分析', '已分析'], def: '全部' },
    { k: 'label', label: '问题分类', type: 'select', options: ['全部'].concat(CATS), def: '全部' }
  ];
  function filteredAnalysis() {
    var key = 'consult-analysis:raw';
    var kw = fv(key, 'kw').toLowerCase();
    var status = fv(key, 'status', '全部'), label = fv(key, 'label', '全部');
    return DB.analysis.filter(function (a) {
      if (status !== '全部' && a.status !== status) return false;
      if (label !== '全部' && a.label !== label) return false;
      if (kw && (a.raw + a.session).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
  }
  function renderRawTab() {
    var key = 'consult-analysis:raw';
    var list = filteredAnalysis();
    var rows = slice(list, key, 10).map(function (a) {
      return '<tr><td>' + esc(a.id) + '</td>' +
        '<td><a href="javascript:void(0)" style="color:var(--primary)" data-hc="openSession" data-arg="' + esc(a.session) + '">' + esc(a.session) + '</a></td>' +
        '<td class="clip" title="' + esc(a.raw) + '">' + esc(a.raw) + '</td>' +
        '<td>' + esc(a.label) + '</td>' +
        '<td>' + st(a.status) + '</td>' +
        '<td>' + esc(a.analyzedAt || '—') + '</td>' +
        '<td>' + ops(a.status === '待分析' ? act('立即分析', 'analyze', a.id, 'btn-primary') : act('重新分析', 'analyze', a.id, 'btn-outline'), act('会话', 'openSession', a.session)) + '</td></tr>';
    }).join('');
    var pending = count(DB.analysis, function (a) { return a.status === '待分析'; });
    return filterBar(key, F_RAW) +
      '<div class="hc-toolbar"><div class="l"><span style="font-size:12px;color:#667085">原始文本来自会话与消息，自动去重入库</span></div>' +
      '<div class="l">' + act('批量分析待办', 'analyzeAll', '', 'btn-outline') + act('导出语料', 'export', '原始问题文本') + '</div></div>' +
      card('原始问题文本', table(['分析编号', '所属会话', '原始问题文本', '问题分类', '分析状态', '分析时间', '操作'], rows, '没有匹配的文本') + pager(key, list.length, 10));
  }
  var F_AI = [
    { k: 'kw', label: '关键字', ph: '文本 / 意图' },
    { k: 'urgency', label: '紧急程度', type: 'select', options: ['全部', '高', '中', '低'], def: '全部' },
    { k: 'emotion', label: '情绪识别', type: 'select', options: ['全部', '焦虑', '担忧', '急迫', '中性', '平和'], def: '全部' }
  ];
  function renderAiTab() {
    var key = 'consult-analysis:ai';
    var kw = fv(key, 'kw').toLowerCase();
    var urg = fv(key, 'urgency', '全部'), emo = fv(key, 'emotion', '全部');
    var list = DB.analysis.filter(function (a) {
      if (a.status !== '已分析') return false;
      if (urg !== '全部' && a.urgency !== urg) return false;
      if (emo !== '全部' && a.emotion !== emo) return false;
      if (kw && (a.raw + a.intent + a.topic).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    var rows = slice(list, key, 10).map(function (a) {
      var low = a.confidence < 0.7;
      return '<tr><td>' + esc(a.id) + '</td>' +
        '<td class="clip" title="' + esc(a.raw) + '">' + esc(a.raw) + '</td>' +
        '<td>' + esc(a.intent) + '</td>' +
        '<td>' + tone(a.emotion, a.emotion === '焦虑' || a.emotion === '急迫' ? 'orange' : 'neutral') + '</td>' +
        '<td>' + tone(a.urgency, a.urgency === '高' ? 'danger' : a.urgency === '中' ? 'warn' : 'success') + '</td>' +
        '<td><span style="font-variant-numeric:tabular-nums;color:' + (low ? '#b42335' : '#2e7d32') + ';font-weight:600">' + Math.round(a.confidence * 100) + '%</span>' + (low ? '<div style="font-size:11px;color:#b42335">建议人工复核</div>' : '') + '</td>' +
        '<td>' + esc(a.topic) + '</td>' +
        '<td>' + ops(act('复核', 'review', a.id), act('会话', 'openSession', a.session)) + '</td></tr>';
    }).join('');
    var done = count(DB.analysis, function (a) { return a.status === '已分析'; });
    var avg = done ? Math.round(DB.analysis.filter(function (a) { return a.status === '已分析'; }).reduce(function (s, a) { return s + a.confidence; }, 0) / done * 100) : 0;
    var lowN = count(DB.analysis, function (a) { return a.status === '已分析' && a.confidence < 0.7; });
    return filterBar(key, F_AI) +
      card('智能分析结果', table(['分析编号', '原始问题', '识别意图', '情绪', '紧急度', '置信度', '话题', '操作'], rows, '没有匹配的分析结果') + pager(key, list.length, 10));
  }
  function renderHotspotTab() {
    var key = 'consult-analysis:hotspot';
    var hs = hotspotData();
    var total = hs.reduce(function (s, x) { return s + x.v; }, 0) || 1;
    var top = hs[0] || { l: '—', v: 0 };
    var byCat = CATS.map(function (c) { return { l: c, v: count(DB.analysis, function (a) { return a.status === '已分析' && a.label === c; }) }; }).filter(function (x) { return x.v > 0; });
    return '<div class="hc-toolbar"><div class="l"><span style="font-size:12px;color:#667085">统计口径：已完成智能分析的咨询文本，实时计算</span></div>' +
      '<div class="l">' + act('刷新统计', 'refreshHot', '', 'btn-outline') + act('导出报表', 'export', '健康热点统计') + '</div></div>' +
      '<div class="hc-twin">' +
      card('话题咨询量分布', barChart(hs.slice(0, 8), ' 次')) +
      card('问题分类占比', hBars(byCat, ' 条') + '<div class="hc-meta" style="margin-top:12px">占比最高的分类将优先获得科普内容排期。</div>') +
      '</div>' +
      card('热点明细', table(['排名', '话题', '咨询量', '占比', '关联已发布科普', '操作'], hs.map(function (h, i) {
        var eduN = count(DB.edu, function (e) { return e.topic === h.l && e.status === '已发布'; });
        return '<tr><td>' + (i + 1) + '</td><td><strong>' + esc(h.l) + '</strong></td><td>' + h.v + '</td><td>' + pct(h.v, total) + '%</td>' +
          '<td>' + (eduN ? tone(eduN + ' 篇', 'success') : tone('内容缺口', 'danger')) + '</td>' +
          '<td>' + ops(act('新增科普', 'newEduFor', h.l, 'btn-outline'), act('查看文本', 'hotTexts', h.l)) + '</td></tr>';
      }).join(''), '暂无分析数据') + pager(key, hs.length, 10));
  }
  function renderInsightTab() {
    var rows = DB.insights.map(function (it) {
      var edu = it.eduId ? find(DB.edu, it.eduId) : null;
      return '<tr><td>' + esc(it.id) + '</td>' +
        '<td>' + tone(it.share >= 18 ? '高价值' : it.share >= 10 ? '值得关注' : '观察', it.tone === 'danger' ? 'danger' : it.tone === 'warn' ? 'warn' : 'info') + '</td>' +
        '<td><strong>' + esc(it.title) + '</strong><div style="font-size:11px;color:#94a3b8">话题：' + esc(it.topic) + ' · 占比 ' + it.share + '%</div></td>' +
        '<td class="clip" style="max-width:340px" title="' + esc(it.content) + '">' + esc(it.content) + '</td>' +
        '<td>' + st(it.status) + (edu ? '<div style="font-size:11px;color:#2e7d32">→ ' + esc(edu.id) + '</div>' : '') + '</td>' +
        '<td>' + esc(it.adoptedAt || '—') + '</td>' +
        '<td>' + ops(
          it.status === '待处理' ? act('采纳并生成科普', 'adopt', it.id, 'btn-primary') : act('查看科普', 'viewEdu', it.eduId || ''),
          it.status === '待处理' ? act('忽略', 'ignore', it.id) : act('恢复', 'restore', it.id)
        ) + '</td></tr>';
    }).join('');
    return '<div class="hc-note"><b>说明：</b>系统基于「智能分析结果」的话题聚合度自动生成运营建议，采纳后可一键生成科普内容草稿，形成「咨询 → 分析 → 建议 → 科普」闭环。</div>' +
      '<div class="hc-toolbar"><div class="l"><span style="font-size:12px;color:#667085">建议随热点统计实时重算</span></div>' +
      '<div class="l">' + act('重新生成建议', 'rebuildInsight', '', 'btn-outline') + '</div></div>' +
      card('洞察应用建议', table(['编号', '价值', '建议标题', '建议内容', '状态', '处理时间', '操作'], rows, '暂无建议，先执行智能分析'));
  }
  function renderConsultAnalysis() {
    var t = HC.tab['consult-analysis'];
    var body = t === 'raw' ? renderRawTab() : t === 'ai' ? renderAiTab() : t === 'hotspot' ? renderHotspotTab() : renderInsightTab();
    return heads('咨询问题分析', '原始文本 · 智能分析 · 健康热点 · 应用建议，一体化分析看板',
      '<button class="btn btn-outline btn-sm" data-hc="analyzeAll">批量分析待办</button>') +
      tabs('consult-analysis', [
        { id: 'raw', label: '原始问题文本', n: DB.analysis.length },
        { id: 'ai', label: '智能分析结果', n: count(DB.analysis, function (a) { return a.status === '已分析'; }) },
        { id: 'hotspot', label: '健康热点统计', n: hotspotData().length },
        { id: 'insight', label: '洞察应用建议', n: count(DB.insights, function (i) { return i.status === '待处理'; }) }
      ]) + body;
  }
  function openHotTexts(topic) {
    var list = DB.analysis.filter(function (a) { return a.topic === topic && a.status === '已分析'; });
    modal('话题明细 · ' + topic, '共 ' + list.length + ' 条咨询文本',
      list.length ? '<div class="hc-stack">' + list.map(function (a) {
        return '<div class="hc-item"><div class="tt">' + esc(a.raw) + '</div><div class="ft">' + tone(a.urgency, a.urgency === '高' ? 'danger' : 'neutral') + '<span>' + esc(a.session) + '</span><span>' + esc(a.analyzedAt) + '</span></div></div>';
      }).join('') + '</div>' : '<div class="hc-empty">暂无数据</div>', null, null, true);
  }

  /* ============================================================
     页面 3：互动社区管理
     ============================================================ */
  function renderBoardsTab() {
    var rows = DB.boards.map(function (b) {
      var pc = boardPostCount(b.name);
      var wait = count(DB.posts, function (p) { return p.board === b.name && p.status === '待审核'; });
      return '<tr><td>' + esc(b.id) + '</td><td><strong>' + esc(b.name) + '</strong></td><td class="clip">' + esc(b.desc) + '</td>' +
        '<td>' + esc(b.moderator) + '</td><td>' + pc + '</td><td>' + (wait ? tone(wait + ' 待审', 'warn') : tone('0', 'neutral')) + '</td>' +
        '<td>' + st(b.status) + '</td>' +
        '<td>' + ops(act('编辑', 'editBoard', b.id), act(b.status === '启用' ? '停用' : '启用', 'toggleBoard', b.id), act('查看主帖', 'boardPosts', b.name)) + '</td></tr>';
    }).join('');
    return '<div class="hc-toolbar"><div class="l"><span style="font-size:12px;color:#667085">共 ' + DB.boards.length + ' 个板块</span></div>' +
      '<div class="l">' + act('新增板块', 'newBoard', '', 'btn-primary') + '</div></div>' +
      card('板块配置', table(['板块编号', '板块名称', '板块说明', '版主', '主帖数', '待审', '状态', '操作'], rows));
  }
  var F_POSTS = [
    { k: 'kw', label: '标题 / 作者', ph: '输入关键词' },
    { k: 'board', label: '所属板块', type: 'select', options: function () { return ['全部'].concat(DB.boards.map(function (b) { return b.name; })); }, def: '全部' },
    { k: 'status', label: '状态', type: 'select', options: ['全部', '已发布', '待审核', '已驳回', '已下架'], def: '全部' }
  ];
  function renderPostsTab() {
    var key = 'community-management:posts';
    var kw = fv(key, 'kw').toLowerCase();
    var bd = fv(key, 'board', '全部'), status = fv(key, 'status', '全部');
    var list = DB.posts.filter(function (p) {
      if (bd !== '全部' && p.board !== bd) return false;
      if (status !== '全部' && p.status !== status) return false;
      if (kw && (p.title + p.user + p.content).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    var rows = slice(list, key, 8).map(function (p) {
      var rec = DB.recommends.filter(function (x) { return x.post === p.id; })[0];
      return '<tr><td>' + esc(p.id) + '</td><td>' + esc(p.board) + '</td><td>' + esc(p.user) + '</td>' +
        '<td class="clip" title="' + esc(p.title) + '"><a href="javascript:void(0)" style="color:var(--primary);font-weight:600" data-hc="viewPost" data-arg="' + esc(p.id) + '">' + esc(p.title) + '</a></td>' +
        '<td>' + p.views + '</td><td>' + p.likes + '</td><td>' + commentCount(p.id) + ' / ' + replyCount(p.id) + '</td>' +
        '<td>' + st(p.status) + (p.rejectReason ? '<div style="font-size:11px;color:#b42335">' + esc(p.rejectReason) + '</div>' : '') + '</td>' +
        '<td>' + esc(p.time) + '</td>' +
        '<td>' + ops(
          p.status === '待审核' ? act('通过', 'approvePost', p.id, 'btn-primary') : act('查看', 'viewPost', p.id),
          p.status === '待审核' ? act('驳回', 'rejectPost', p.id, 'btn-outline') : '',
          p.status === '已发布' ? act('下架', 'unpublishPost', p.id) : '',
          act(rec && rec.status === '已推荐' ? '取消推荐' : '推荐', 'recommend', p.id)
        ) + '</td></tr>';
    }).join('');
    return filterBar(key, F_POSTS) +
      card('主帖内容', table(['主帖编号', '所属板块', '作者', '标题', '浏览量', '点赞', '评论/回复', '状态', '发布时间', '操作'], rows, '没有符合条件的主帖') + pager(key, list.length, 8));
  }
  var F_COMMENTS = [
    { k: 'kw', label: '评论内容', ph: '输入关键词' },
    { k: 'post', label: '所属主帖', ph: 'PT-102' },
    { k: 'status', label: '状态', type: 'select', options: ['全部', '正常', '待审核', '已屏蔽'], def: '全部' }
  ];
  function renderCommentsTab() {
    var key = 'community-management:comments';
    var kw = fv(key, 'kw').toLowerCase(), pt = fv(key, 'post').toLowerCase();
    var status = fv(key, 'status', '全部');
    var list = DB.comments.filter(function (c) {
      if (status !== '全部' && c.status !== status) return false;
      if (kw && (c.content + c.user).toLowerCase().indexOf(kw) < 0) return false;
      if (pt && c.post.toLowerCase().indexOf(pt) < 0) return false;
      return true;
    });
    var rows = slice(list, key, 8).map(function (c) {
      var rep = c.replies || [];
      return '<tr><td>' + esc(c.id) + '</td>' +
        '<td><a href="javascript:void(0)" style="color:var(--primary)" data-hc="viewPost" data-arg="' + esc(c.post) + '">' + esc(c.post) + '</a></td>' +
        '<td>' + esc(c.user) + '</td>' +
        '<td class="clip" title="' + esc(c.content) + '">' + esc(c.content) + '</td>' +
        '<td>' + (rep.length ? '<div>' + rep.map(function (r) { return '<div style="font-size:12px">↳ <b>' + esc(r.user) + '</b>：' + esc(r.content) + '</div>'; }).join('') + '</div>' : '<span style="color:#94a3b8">未回复</span>') + '</td>' +
        '<td>' + c.like + '</td><td>' + st(c.status) + '</td><td>' + esc(c.time) + '</td>' +
        '<td>' + ops(act('回复', 'replyComment', c.id, 'btn-primary'), act(c.status === '已屏蔽' ? '恢复' : '屏蔽', 'hideComment', c.id), act('删除', 'delComment', c.id)) + '</td></tr>';
    }).join('');
    return filterBar(key, F_COMMENTS) +
      card('评论与回复', table(['评论编号', '所属主帖', '用户', '评论内容', '官方回复', '点赞', '状态', '时间', '操作'], rows, '没有匹配的评论') + pager(key, list.length, 8));
  }
  var F_LOGS = [
    { k: 'kw', label: '用户 / 目标', ph: '输入关键词' },
    { k: 'action', label: '行为类型', type: 'select', options: ['全部'].concat(['发起咨询', '回复咨询', '接收分配', '办结会话', '发表评论', '回复评论', '屏蔽评论', '删除评论', '审核通过主帖', '驳回主帖', '下架主帖', '推荐内容', '点赞', '举报内容', '新增科普内容', '编辑科普内容', '发布科普内容', '下架科普内容', '置顶科普内容', '取消置顶', '删除科普内容', '采纳洞察建议', '忽略洞察建议', '执行分析', '切换分类状态', '删除分类', '切换板块状态', '自动分配', '提交科普审核', '调整发布排期', '新增发布排期', '立即发布', '重试发布', '切换专题状态', '代录入咨询', '智能分析引擎']), def: '全部' }
  ];
  function renderUserLogTab() {
    var key = 'community-management:userlog';
    var kw = fv(key, 'kw').toLowerCase();
    var act2 = fv(key, 'action', '全部');
    var list = DB.userLogs.filter(function (u) {
      if (act2 !== '全部' && u.action !== act2) return false;
      if (kw && (u.user + u.target + u.action).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    var rows = slice(list, key, 10).map(function (u) {
      return '<tr><td>' + esc(u.id) + '</td><td>' + esc(u.user) + '</td><td>' + tone(u.action, /发布|回复|采纳|通过|分析/.test(u.action) ? 'success' : /删除|屏蔽|驳回|举报|下架/.test(u.action) ? 'danger' : 'info') + '</td>' +
        '<td class="clip">' + esc(u.target) + '</td><td>' + esc(u.time) + '</td>' +
        '<td>' + ops(act('详情', 'viewLog', u.id)) + '</td></tr>';
    }).join('');
    return filterBar(key, F_LOGS) +
      card('用户行为日志', table(['日志编号', '用户', '行为', '目标', '时间', '操作'], rows, '暂无行为日志') + pager(key, list.length, 10));
  }
  function renderRecommendTab() {
    var rows = DB.recommends.map(function (r) {
      var p = find(DB.posts, r.post);
      return '<tr><td>' + esc(r.id) + '</td>' +
        '<td>' + esc(r.post) + '</td>' +
        '<td class="clip">' + esc(p ? p.title : '（主帖已删除）') + '</td>' +
        '<td>' + esc(r.reason) + '</td>' +
        '<td>' + (p ? p.views : 0) + ' / ' + (p ? p.likes : 0) + '</td>' +
        '<td>' + st(r.status) + '</td>' +
        '<td>' + ops(act(r.status === '已推荐' ? '取消推荐' : '设为推荐', 'recommend', r.post, r.status === '已推荐' ? 'btn-ghost' : 'btn-primary'), act('查看主帖', 'viewPost', r.post)) + '</td></tr>';
    }).join('');
    return '<div class="hc-toolbar"><div class="l"><span style="font-size:12px;color:#667085">推荐位数量建议控制在 5 条以内</span></div>' +
      '<div class="l">' + act('按互动数据重算入围', 'rebuildRec', '', 'btn-outline') + '</div></div>' +
      card('优质内容推荐配置', table(['推荐编号', '关联主帖', '主帖标题', '推荐理由', '浏览/点赞', '状态', '操作'], rows, '暂无推荐内容'));
  }
  function rebuildRecommends() {
    DB.recommends = DB.posts.filter(function (p) { return p.status === '已发布'; })
      .sort(function (a, b) { return (b.views + b.likes * 5) - (a.views + a.likes * 5); })
      .slice(0, 5).map(function (p, i) {
        var old = DB.recommends.filter(function (r) { return r.post === p.id; })[0];
        return { id: old ? old.id : 'RC-' + pad2(i + 1), post: p.id, reason: '互动评分 ' + (p.views + p.likes * 5) + '（浏览 ' + p.views + ' / 点赞 ' + p.likes + '）', status: old ? old.status : '待审核' };
      });
    say('已按互动数据重算入围内容'); refresh();
  }
  function renderCommunity() {
    var t = HC.tab['community-management'];
    var body = t === 'boards' ? renderBoardsTab() : t === 'posts' ? renderPostsTab() : t === 'comments' ? renderCommentsTab() : t === 'userlog' ? renderUserLogTab() : renderRecommendTab();
    return heads('互动社区管理', '',
      '<button class="btn btn-outline btn-sm" data-hc="rebuildRec">重算优质内容</button>') +
      tabs('community-management', [
        { id: 'boards', label: '板块配置', n: DB.boards.length },
        { id: 'posts', label: '主帖内容', n: count(DB.posts, function (p) { return p.status === '待审核'; }) },
        { id: 'comments', label: '评论与回复', n: count(DB.comments, function (c) { return c.status === '待审核'; }) },
        { id: 'userlog', label: '用户行为日志', n: DB.userLogs.length },
        { id: 'recommend', label: '优质内容推荐', n: count(DB.recommends, function (r) { return r.status === '已推荐'; }) }
      ]) + body;
  }

  /* ============================================================
     页面 4：科普内容配置（新增）
     ============================================================ */
  var F_EDU = [
    { k: 'kw', label: '标题 / 摘要', ph: '输入关键词' },
    { k: 'type', label: '内容形式', type: 'select', options: ['全部'].concat(EDU_TYPES), def: '全部' },
    { k: 'cat', label: '关联分类', type: 'select', options: ['全部'].concat(CATS), def: '全部' },
    { k: 'status', label: '发布状态', type: 'select', options: ['全部', '草稿', '待审核', '已发布', '已下架'], def: '全部' }
  ];
  function renderEduLibraryTab() {
    var key = 'consult-education:library';
    var kw = fv(key, 'kw').toLowerCase();
    var type = fv(key, 'type', '全部'), cat = fv(key, 'cat', '全部'), status = fv(key, 'status', '全部');
    var list = DB.edu.filter(function (e) {
      if (type !== '全部' && e.type !== type) return false;
      if (cat !== '全部' && e.cat !== cat) return false;
      if (status !== '全部' && e.status !== status) return false;
      if (kw && (e.title + e.summary + e.tags.join('')).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    }).sort(function (a, b) { return (b.top ? 1 : 0) - (a.top ? 1 : 0); });
    var rows = slice(list, key, 8).map(function (e) {
      var refN = count(DB.messages, function (m) { return m.content.indexOf('《' + e.title + '》') >= 0; });
      return '<tr><td>' + esc(e.id) + (e.top ? '<div>' + tone('置顶', 'info') + '</div>' : '') + '</td>' +
        '<td class="clip" title="' + esc(e.summary) + '"><a href="javascript:void(0)" style="color:var(--primary);font-weight:600" data-hc="viewEdu" data-arg="' + esc(e.id) + '">' + esc(e.title) + '</a>' +
        '<div style="font-size:11px;color:#94a3b8;margin-top:2px">' + chips(e.tags) + '</div></td>' +
        '<td>' + esc(e.type) + '</td><td>' + esc(e.cat) + '</td><td>' + esc(e.topic) + '</td>' +
        '<td>' + tone(e.source, e.source.indexOf('AI') >= 0 ? 'info' : 'neutral') + '</td>' +
        '<td>' + e.views.toLocaleString('zh-CN') + ' / ' + e.likes + '</td>' +
        '<td>' + (refN ? tone(refN + ' 次引用', 'success') : '<span style="color:#94a3b8">0</span>') + '</td>' +
        '<td>' + st(e.status) + '</td><td>' + esc(e.publishAt || '—') + '</td>' +
        '<td>' + ops(
          e.status === '草稿' ? act('编辑', 'editEdu', e.id, 'btn-outline') : act('编辑', 'editEdu', e.id),
          e.status === '草稿' ? act('提交审核', 'submitEdu', e.id, 'btn-primary') : '',
          e.status === '待审核' ? act('发布', 'publishEdu', e.id, 'btn-primary') : '',
          e.status === '已发布' ? act('下架', 'unpublishEdu', e.id) : '',
          e.status === '已下架' ? act('重新发布', 'publishEdu', e.id, 'btn-primary') : '',
          e.status === '已发布' ? act(e.top ? '取消置顶' : '置顶', 'topEdu', e.id) : '',
          e.status === '已发布' ? '' : act('删除', 'delEdu', e.id)
        ) + '</td></tr>';
    }).join('');
    return filterBar(key, F_EDU) +
      '<div class="hc-toolbar"><div class="l"><span style="font-size:12px;color:#667085">已发布内容自动进入「咨询会话回复」的引用列表</span></div>' +
      '<div class="l">' + act('+ 新增科普内容', 'newEdu', '', 'btn-primary') + act('导出内容清单', 'export', '科普文章库') + '</div></div>' +
      card('科普文章库', table(['编号', '标题 / 标签', '形式', '关联分类', '话题', '来源', '浏览/点赞', '客服引用', '状态', '发布时间', '操作'], rows, '没有符合条件的科普内容') + pager(key, list.length, 8));
  }
  function renderEduTopicTab() {
    var rows = DB.eduTopics.map(function (t) {
      var items = count(DB.edu, function (e) { return e.status === '已发布' && (e.topic === t.name.replace('专题', '') || e.cat === t.name); });
      return '<tr><td>' + esc(t.id) + '</td><td><strong>' + esc(t.name) + '</strong></td><td class="clip">' + esc(t.desc) + '</td>' +
        '<td>' + esc(t.owner) + '</td><td>' + items + '</td><td>' + st(t.status) + '</td>' +
        '<td>' + ops(act('编辑', 'editTopic', t.id), act(t.status === '启用' ? '停用' : '启用', 'toggleTopic', t.id)) + '</td></tr>';
    }).join('');
    var tagMap = {};
    DB.edu.forEach(function (e) { (e.tags || []).forEach(function (t) { tagMap[t] = (tagMap[t] || 0) + 1; }); });
    var tagList = Object.keys(tagMap).map(function (k) { return { l: k, v: tagMap[k] }; }).sort(function (a, b) { return b.v - a.v; });
    return '<div class="hc-note"><b>说明：</b>专题把同主题科普聚合为患者端一个入口；标签用于智能匹配与检索。</div>' +
      '<div class="hc-toolbar"><div class="l"><span style="font-size:12px;color:#667085">共 ' + DB.eduTopics.length + ' 个专题</span></div>' +
      '<div class="l">' + act('新增专题', 'newTopic', '', 'btn-primary') + '</div></div>' +
      '<div class="hc-twin">' +
      card('科普专题配置', table(['专题编号', '专题名称', '专题说明', '负责人', '收录内容', '状态', '操作'], rows)) +
      card('内容标签云', (tagList.length ? hBars(tagList.slice(0, 10), ' 篇') : '<div class="hc-empty">暂无标签</div>') +
        '<div class="hc-meta" style="margin-top:12px">' + chips(tagList.map(function (x) { return x.l; }), 'blue') + '</div>') +
      '</div>';
  }
  var F_SCH = [
    { k: 'ch', label: '发布渠道', type: 'select', options: ['全部'].concat(CHANNELS), def: '全部' },
    { k: 'status', label: '排期状态', type: 'select', options: ['全部', '待发布', '已发布', '失败'], def: '全部' }
  ];
  function renderEduScheduleTab() {
    var key = 'consult-education:schedule';
    var ch = fv(key, 'ch', '全部'), status = fv(key, 'status', '全部');
    var list = DB.eduSchedule.filter(function (s) {
      if (ch !== '全部' && s.channel !== ch) return false;
      if (status !== '全部' && s.status !== status) return false;
      return true;
    });
    var rows = list.map(function (s) {
      var e = find(DB.edu, s.edu);
      return '<tr><td>' + esc(s.id) + '</td>' +
        '<td class="clip">' + esc(e ? e.title : '（内容已删除）') + '</td>' +
        '<td>' + esc(s.channel) + '</td><td>' + esc(s.date) + '</td><td>' + st(s.status) + '</td>' +
        '<td>' + ops(
          s.status !== '已发布' ? act('立即发布', 'publishNow', s.id, 'btn-primary') : act('查看内容', 'viewEdu', s.edu),
          s.status === '失败' ? act('重试', 'retrySch', s.id, 'btn-outline') : '',
          act('编辑', 'editSch', s.id), act('取消', 'cancelSch', s.id)
        ) + '</td></tr>';
    }).join('');
    return filterBar(key, F_SCH) +
      '<div class="hc-toolbar"><div class="l"><span style="font-size:12px;color:#667085">多渠道分发：同一内容可排期到不同渠道</span></div>' +
      '<div class="l">' + act('+ 新增排期', 'newSch', '', 'btn-primary') + '</div></div>' +
      card('发布与排期', table(['排期编号', '科普内容', '发布渠道', '计划日期', '状态', '操作'], rows, '暂无排期计划'));
  }
  function renderEduStatsTab() {
    var pub = DB.edu.filter(function (e) { return e.status === '已发布'; });
    var views = pub.reduce(function (s, e) { return s + e.views; }, 0);
    var likes = pub.reduce(function (s, e) { return s + e.likes; }, 0);
    var byCat = CATS.map(function (c) { return { l: c, v: pub.filter(function (e) { return e.cat === c; }).reduce(function (s, e) { return s + e.views; }, 0) }; }).filter(function (x) { return x.v > 0; });
    var byType = EDU_TYPES.map(function (t) { return { l: t, v: count(DB.edu, function (e) { return e.type === t; }) }; }).filter(function (x) { return x.v > 0; });
    var top5 = pub.slice().sort(function (a, b) { return b.views - a.views; }).slice(0, 5);
    var gap = hotspotData().slice(0, 8).filter(function (h) { return !count(DB.edu, function (e) { return e.topic === h.l && e.status === '已发布'; }); });
    return '<div class="hc-twin">' +
      card('分类浏览分布', hBars(byCat, ' 次')) +
      card('内容形式构成', hBars(byType, ' 篇')) +
      '</div>' +
      '<div class="hc-twin">' +
      card('浏览 TOP5', top5.length ? '<div>' + top5.map(function (e, i) {
        return '<div class="hc-rank"><span class="no' + (i === 0 ? ' top' : '') + '">' + (i + 1) + '</span><span>' + esc(e.title) + '</span><span class="gr">' + e.views.toLocaleString('zh-CN') + ' 次 · 赞 ' + e.likes + '</span></div>';
      }).join('') + '</div>' : '<div class="hc-empty">暂无已发布内容</div>') +
      card('待补充的热门话题', gap.length ? '<div>' + gap.map(function (h, i) {
        return '<div class="hc-rank"><span class="no' + (i === 0 ? ' top' : '') + '">' + (i + 1) + '</span><span>' + esc(h.l) + '</span><span class="gr">咨询 ' + h.v + ' 次</span>' + act('去创建', 'newEduFor', h.l, 'btn-outline') + '</div>';
      }).join('') + '</div>' : '<div class="hc-empty">热门话题均已覆盖</div>') +
      '</div>';
  }
  function renderConsultEducation() {
    var t = HC.tab['consult-education'];
    var body = t === 'library' ? renderEduLibraryTab() : t === 'topics' ? renderEduTopicTab() : t === 'schedule' ? renderEduScheduleTab() : renderEduStatsTab();
    return heads('科普内容配置', '科普文章库 · 专题与标签 · 发布与排期 · 效果统计，与咨询分析联动',
      '<button class="btn btn-primary btn-sm" data-hc="newEdu">+ 新增科普内容</button>') +
      tabs('consult-education', [
        { id: 'library', label: '科普文章库', n: DB.edu.length },
        { id: 'topics', label: '专题与标签', n: DB.eduTopics.length },
        { id: 'schedule', label: '发布与排期', n: count(DB.eduSchedule, function (s) { return s.status === '待发布'; }) },
        { id: 'stats', label: '效果统计' }
      ]) + body;
  }
  function viewEdu(id) {
    var e = find(DB.edu, id); if (!e) { say('未找到该科普内容', 'error'); return; }
    var refN = count(DB.messages, function (m) { return m.content.indexOf('《' + e.title + '》') >= 0; });
    modal('科普内容 · ' + e.id, e.status,
      '<div class="hc-note"><b>' + esc(e.title) + '</b><br>' + esc(e.summary) + '</div>' +
      '<div class="hc-kv" style="margin-bottom:14px">' +
      '<div><div class="k">内容形式</div><div class="vl">' + esc(e.type) + '</div></div>' +
      '<div><div class="k">关联问题分类</div><div class="vl">' + esc(e.cat) + '</div></div>' +
      '<div><div class="k">话题标签</div><div class="vl">' + esc(e.topic) + '</div></div>' +
      '<div><div class="k">作者 / 来源</div><div class="vl">' + esc(e.author) + ' · ' + esc(e.source) + '</div></div>' +
      '<div><div class="k">发布时间</div><div class="vl">' + esc(e.publishAt || '未发布') + '</div></div>' +
      '<div><div class="k">浏览 / 点赞 / 客服引用</div><div class="vl">' + e.views + ' / ' + e.likes + ' / ' + refN + '</div></div>' +
      '</div>' +
      '<div style="font-size:12px;color:#667085;font-weight:600;margin-bottom:6px">关键词标签</div>' + chips(e.tags, 'blue') +
      '<div style="font-size:12px;color:#667085;font-weight:600;margin:14px 0 6px">正文</div>' +
      '<div class="hc-meta" style="white-space:pre-wrap">' + esc(e.content) + '</div>', null, null, true);
  }
  function newEduFor(topic) {
    var catOf = {};
    DB.analysis.forEach(function (a) { catOf[a.topic] = a.label; });
    var body =
      ff(req('科普标题'), fi('hc-edu-title', topic + '：患者最关心的问题解答', ''), true) +
      ff(req('内容形式'), fsel('hc-edu-type', EDU_TYPES, '图文')) +
      ff(req('关联问题分类'), fsel('hc-edu-cat', CATS, catOf[topic] || CATS[0])) +
      ff(req('话题标签'), fi('hc-edu-topic', topic, '用于热点统计')) +
      ff(req('作者'), fsel('hc-edu-author', DOCTORS, DOCTORS[0])) +
      ff(req('内容摘要'), fta('hc-edu-summary', '针对「' + topic + '」的高频咨询，给出可执行的判断标准与处理建议。', '', 2), true) +
      ff(req('正文内容'), fta('hc-edu-content', '', '请输入正文', 5), true) +
      ff('关键词标签', fi('hc-edu-tags', topic, '多个标签用、分隔'), true);
    formModal('新增科普内容', '已预填热点话题：' + topic, body, '保存草稿', function () {
      var title = val('hc-edu-title'), summary = val('hc-edu-summary'), content = val('hc-edu-content');
      if (!title || !summary || !content) { say('标题、摘要、正文均为必填', 'error'); return; }
      DB.edu.unshift({
        id: nextId('EDU-'), title: title, type: val('hc-edu-type'), cat: val('hc-edu-cat'), topic: val('hc-edu-topic') || topic,
        tags: (val('hc-edu-tags') || topic).split(/[、,，]/).map(function (x) { return x.trim(); }).filter(Boolean),
        summary: summary, content: content, status: '草稿', views: 0, likes: 0, author: val('hc-edu-author'), publishAt: '', top: false, source: '热点补充'
      });
      logAction('运营', '新增科普内容', title);
      closeModal(); say('已创建草稿，可在文章库中提交审核'); refresh();
    }, true);
  }

  /* ============================================================
     路由与对外接口
     ============================================================ */
  var PAGE_MAP = {
    'consult-sessions': renderConsultSessions,
    'consult-analysis': renderConsultAnalysis,
    'community-management': renderCommunity,
    'consult-education': renderConsultEducation
  };
  /* 旧 20 页面 id 全部映射到新的 3+1 页面，保证历史链接与书签不失效 */
  var OLD_TO_NEW = {
    'consult-session': 'consult-sessions', 'consult-message': 'consult-sessions', 'consult-category': 'consult-sessions', 'consult-assign-log': 'consult-sessions',
    'analysis-raw-text': 'consult-analysis', 'analysis-ai-result': 'consult-analysis', 'analysis-hotspot': 'consult-analysis', 'analysis-insight': 'consult-analysis',
    'community-board': 'community-management', 'community-post': 'community-management', 'community-comment': 'community-management',
    'community-user-log': 'community-management', 'community-recommend': 'community-management'
  };
  var OLD_TO_TAB = {
    'consult-session': ['consult-sessions', 'sessions'], 'consult-message': ['consult-sessions', 'messages'],
    'consult-category': ['consult-sessions', 'category'], 'consult-assign-log': ['consult-sessions', 'assign'],
    'analysis-raw-text': ['consult-analysis', 'raw'], 'analysis-ai-result': ['consult-analysis', 'ai'],
    'analysis-hotspot': ['consult-analysis', 'hotspot'], 'analysis-insight': ['consult-analysis', 'insight'],
    'community-board': ['community-management', 'boards'], 'community-post': ['community-management', 'posts'],
    'community-comment': ['community-management', 'comments'], 'community-user-log': ['community-management', 'userlog'],
    'community-recommend': ['community-management', 'recommend']
  };
  function renderHealthConsultPage(pageId) {
    var target = OLD_TO_NEW[pageId] || pageId;
    if (OLD_TO_TAB[pageId]) { HC.tab[OLD_TO_TAB[pageId][0]] = OLD_TO_TAB[pageId][1]; }
    var el = $('pageContainer');
    if (target && PAGE_MAP[target]) {
      HC.page = target;
      if (el) el.innerHTML = PAGE_MAP[target]();
    } else if (el) {
      el.innerHTML = '<div class="hc-empty">健康咨询页面：' + esc(pageId) + ' 未实现</div>';
    }
    var mc = $('mainContent');
    if (mc) mc.scrollTop = 0;
  }

  /* ============================================================
     事件委托
     ============================================================ */
  document.addEventListener('click', function (ev) {
    if (!ev.target || !ev.target.closest) return;

    /* 页签切换 */
    var tab = ev.target.closest('[data-hc-tab]');
    if (tab) { switchTab(tab.getAttribute('data-hc-tab'), tab.getAttribute('data-hc-val')); return; }

    var el = ev.target.closest('[data-hc]');
    if (!el) return;
    var a = el.getAttribute('data-hc');
    var g = el.getAttribute('data-arg') || '';
    var key;

    var FILTER_MAP = { 'consult-sessions:sessions': F_SESSIONS, 'consult-sessions:messages': F_MSGS, 'consult-sessions:assign': F_ASSIGN, 'consult-analysis:raw': F_RAW, 'consult-analysis:ai': F_AI, 'community-management:posts': F_POSTS, 'community-management:comments': F_COMMENTS, 'community-management:userlog': F_LOGS, 'consult-education:library': F_EDU, 'consult-education:schedule': F_SCH };
    switch (a) {
      /* ---- 通用 ---- */
      case 'close': closeModal(); return;
      case 'reset': case 'filterReset':
        key = g;
        if (key && FILTER_MAP[key]) { HC.filters[key] = {}; HC.pageNo[key] = 1; }
        say('已重置筛选条件'); refresh(); return;
      case 'filter':
        key = g;
        if (key && FILTER_MAP[key]) { readFilter(key, FILTER_MAP[key]); say('查询完成，共匹配当前条件'); refresh(); }
        return;
      case 'page': {
        var parts = g.split('|');
        HC.pageNo[parts[0]] = parseInt(parts[1], 10) || 1;
        refresh(); return;
      }
      case 'export': say('「' + g + '」导出任务已提交，请到下载中心查看'); return;
      case 'query': say('查询成功，已按当前条件刷新'); return;

      /* ---- 会话 ---- */
      case 'reply': openReply(g); return;
      case 'quickReply': {
        var ta = $('hc-reply-text'); var q = QUICK_REPLIES[parseInt(g, 10)];
        if (ta && q) { ta.value = (ta.value ? ta.value.replace(/\s+$/, '') + '\n' : '') + q.c; ta.focus(); }
        return;
      }
      case 'insertEdu': insertEduRef(); return;
      case 'assign': openAssign(g); return;
      case 'closeSession': closeSession(g); return;
      case 'autoAssign': autoAssign(); return;
      case 'openSession': openSessionDetail(g); return;
      case 'newSession': openNewSession(); return;

      /* ---- 分类 ---- */
      case 'newCat': openCategory(null); return;
      case 'editCat': openCategory(g); return;
      case 'toggleCat': toggleCategory(g); return;
      case 'delCat': removeCategory(g); return;

      /* ---- 分析 ---- */
      case 'analyze': runAnalysis(g); return;
      case 'analyzeAll': runAllPending(); return;
      case 'review': openReview(g); return;
      case 'refreshHot': rebuildInsights(); say('热点统计已刷新'); refresh(); return;
      case 'hotTexts': openHotTexts(g); return;

      /* ---- 洞察 ---- */
      case 'adopt': adoptInsight(g); return;
      case 'ignore': ignoreInsight(g); return;
      case 'restore': restoreInsight(g); return;
      case 'rebuildInsight': rebuildInsights(); say('已按最新热点重算建议'); refresh(); return;

      /* ---- 社区 ---- */
      case 'newBoard': openBoard(null); return;
      case 'editBoard': openBoard(g); return;
      case 'toggleBoard': toggleBoard(g); return;
      case 'boardPosts':
        HC.filters['community-management:posts'] = { board: g, status: '全部', kw: '' };
        HC.tab['community-management'] = 'posts'; HC.pageNo['community-management:posts'] = 1;
        say('已按板块「' + g + '」筛选主帖'); refresh(); return;
      case 'viewPost': openPost(g); return;
      case 'approvePost': approvePost(g); return;
      case 'rejectPost': rejectPost(g); return;
      case 'unpublishPost': unpublishPost(g); return;
      case 'replyComment': openCommentReply(g); return;
      case 'approveComment': approveComment(g); return;
      case 'hideComment': hideComment(g); return;
      case 'delComment': removeComment(g); return;
      case 'recommend': toggleRecommend(g); return;
      case 'rebuildRec': rebuildRecommends(); return;
      case 'viewLog': {
        var lg = find(DB.userLogs, g);
        if (lg) { infoModal('行为日志 · ' + lg.id, lg.action, [['操作用户', esc(lg.user)], ['行为', esc(lg.action)], ['目标', esc(lg.target)], ['时间', esc(lg.time)], ['来源模块', '健康咨询'], ['结果', '成功']]); }
        return;
      }

      /* ---- 科普内容 ---- */
      case 'newEdu': openEdu(null); return;
      case 'editEdu': openEdu(g); return;
      case 'viewEdu': viewEdu(g); return;
      case 'submitEdu': submitEduReview(g); return;
      case 'publishEdu': publishEdu(g); return;
      case 'unpublishEdu': unpublishEdu(g); return;
      case 'topEdu': toggleEduTop(g); return;
      case 'delEdu': removeEdu(g); return;
      case 'newEduFor': newEduFor(g); return;
      case 'newTopic': openEduTopic(null); return;
      case 'editTopic': openEduTopic(g); return;
      case 'toggleTopic': toggleEduTopic(g); return;
      case 'newSch': openSchedule(null); return;
      case 'editSch': openSchedule(g); return;
      case 'publishNow': publishNow(g); return;
      case 'retrySch': retrySchedule(g); return;
      case 'cancelSch': cancelSchedule(g); return;
      default: say('功能演示：' + a); return;
    }
  });

  /* ================= 注册到全局 ================= */
  if (typeof window !== 'undefined') {
    window.renderHealthConsultPage = renderHealthConsultPage;
    window.HEALTH_CONSULT_DB = DB;
    window.HEALTH_CONSULT_STATE = HC;
  }
})();

