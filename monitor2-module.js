/* ============================================================
   监测预警2 —— 卫健委端「检测预警、记录追溯、多维统计、督办整改」
   全闭环一体化模块（依据《卫健委肿瘤综合平台落地方案》需求文档实现）
   页面：
     m2-hall      监督整改调度大厅（处室工作台）
     m2-records   预警记录中心（全量台账 + 档案溯源抽屉）
     m2-stats     预警统计与报表中心（五大维度 + 交叉热力矩阵 + 一键通报）
     m2-hospital  机构端·医院整改协同工作台
     m2-rules     预警规则库（三大方向 13 条规则与触发判定）
   工单状态机：S0触发→S1下发→S2整改中→S3待审核→S4销号 / S5逾期
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 样式 ---------------- */
  var css = [
    '.m2-page{min-width:0}',
    '.m2-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px}',
    '.m2-head .t{font-size:20px;font-weight:700;color:#182230;line-height:1.25}',
    '.m2-head .s{margin-top:5px;font-size:12px;color:#667085;line-height:1.5}',
    '.m2-head .acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center}',
    '.m2-tag{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:4px;background:#e8f2ff;color:#244765;font-size:12px;font-weight:600;white-space:nowrap}',
    '.m2-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px}',
    '.m2-kpi{background:#fff;border:1px solid var(--border,#dfe5ec);border-radius:8px;padding:13px 15px}',
    '.m2-kpi .l{font-size:12px;color:#667085}',
    '.m2-kpi .v{margin-top:5px;font-size:23px;font-weight:700;color:#182230;font-variant-numeric:tabular-nums}',
    '.m2-kpi .v.red{color:#b42335}.m2-kpi .v.yellow{color:#b54708}.m2-kpi .v.green{color:#2e7d32}.m2-kpi .v.blue{color:#244765}',
    '.m2-kpi .m{margin-top:4px;font-size:11px;color:#94a3b8;min-height:15px}',
    '.m2-card{background:#fff;border:1px solid var(--border,#dfe5ec);border-radius:8px;overflow:hidden;margin-bottom:14px}',
    '.m2-card .hd{min-height:44px;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 15px;border-bottom:1px solid var(--border,#dfe5ec)}',
    '.m2-card .hd .t{font-size:14px;font-weight:700;color:#1f2937}',
    '.m2-card .hd .sub{font-size:11px;font-weight:400;color:#94a3b8;margin-left:8px}',
    '.m2-card .bd{padding:14px 16px}',
    '.m2-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}',
    '.m2-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;align-items:start}',
    '.m2-grid13{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:14px;align-items:start}',
    '.m2-filter{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;align-items:end;padding:13px 15px;background:#f8fafc;border:1px solid var(--border,#dfe5ec);border-radius:8px;margin-bottom:14px}',
    '.m2-filter .fg{display:flex;flex-direction:column;gap:5px;min-width:0}',
    '.m2-filter .fg label{font-size:12px;color:#475569;font-weight:600}',
    '.m2-filter select,.m2-filter input{width:100%;height:34px;padding:0 9px;border:1px solid #d1d8e0;border-radius:5px;background:#fff;color:#1f2937;font-size:13px;box-sizing:border-box}',
    '.m2-filter .acts{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px}',
    '.m2-table-wrap{overflow-x:auto;border:1px solid var(--border,#dfe5ec);border-radius:8px;background:#fff}',
    '.m2-table{width:100%;min-width:900px;border-collapse:collapse}',
    '.m2-table th{height:40px;padding:0 11px;background:#f8fafc;border-bottom:1px solid var(--border,#dfe5ec);color:#5b6673;font-size:12px;font-weight:600;text-align:left;white-space:nowrap;vertical-align:middle}',
    '.m2-table td{padding:7px 11px;border-bottom:1px solid #eef2f7;color:#334155;font-size:13px;vertical-align:middle}',
    '.m2-table tbody tr:hover{background:#f7fbff}',
    '.m2-table tbody tr:last-child td{border-bottom:0}',
    '.m2-table td.num,.m2-table th.num{text-align:right;font-variant-numeric:tabular-nums}',
    '.m2-table td.ops,.m2-table th.ops{text-align:center;white-space:nowrap}',
    '.m2-lv-red{display:inline-block;padding:2px 8px;border-radius:4px;background:#fee4e2;color:#b42335;font-size:12px;font-weight:700}',
    '.m2-lv-yellow{display:inline-block;padding:2px 8px;border-radius:4px;background:#fef0c7;color:#b54708;font-size:12px;font-weight:700}',
    '.m2-lv-blue{display:inline-block;padding:2px 8px;border-radius:4px;background:#e0eaff;color:#3538cd;font-size:12px;font-weight:700}',
    '.m2-lv-green{display:inline-block;padding:2px 8px;border-radius:4px;background:#d3f4df;color:#127d3f;font-size:12px;font-weight:700}',
    '.m2-lv-gray{display:inline-block;padding:2px 8px;border-radius:4px;background:#eaecf0;color:#475467;font-size:12px;font-weight:700}',
    '.m2-bar{display:flex;align-items:flex-end;gap:8px;height:180px;padding:10px 4px 2px}',
    '.m2-bar .col{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;cursor:pointer}',
    '.m2-bar .val{font-size:11px;font-weight:600;color:#334155;font-variant-numeric:tabular-nums}',
    '.m2-bar .track{width:100%;max-width:44px;flex:1;display:flex;flex-direction:column;justify-content:flex-end;background:#f1f5f9;border-radius:4px 4px 0 0;overflow:hidden}',
    '.m2-bar .fill{width:100%;border-radius:4px 4px 0 0;transition:height .3s}',
    '.m2-bar .lab{font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
    '.m2-bar .fill .seg-red{background:#d92d20}.m2-bar .fill .seg-yellow{background:#f79009}.m2-bar .fill .seg-blue{background:#2e90fa}',
    '.m2-line{width:100%;height:auto;display:block}',
    '.m2-pie{display:flex;align-items:center;gap:18px;flex-wrap:wrap}',
    '.m2-pie .leg{display:flex;flex-direction:column;gap:7px}',
    '.m2-pie .leg .it{display:flex;align-items:center;gap:7px;font-size:12px;color:#334155}',
    '.m2-pie .leg .it .sw{width:11px;height:11px;border-radius:3px}',
    '.m2-pie .leg .it b{margin-left:auto;font-variant-numeric:tabular-nums}',
    '.m2-funnel{display:flex;flex-direction:column;gap:6px}',
    '.m2-funnel .row{display:flex;align-items:center;gap:10px}',
    '.m2-funnel .bar{height:26px;border-radius:4px;display:flex;align-items:center;padding:0 10px;color:#fff;font-size:12px;font-weight:600;min-width:52px;transition:width .3s}',
    '.m2-funnel .nm{width:150px;font-size:12px;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.m2-heat{width:100%;border-collapse:collapse;font-size:11px}',
    '.m2-heat th{padding:6px 5px;color:#5b6673;font-weight:600;white-space:nowrap;text-align:center;background:#f8fafc}',
    '.m2-heat td{padding:0;text-align:center;border:1px solid #f1f5f9}',
    '.m2-heat td.cell{width:66px;height:30px;cursor:pointer;font-weight:700;color:#182230;font-variant-numeric:tabular-nums}',
    '.m2-heat td.rowhd{background:#f8fafc;text-align:left;padding:6px 8px;color:#1f2937;font-weight:600;white-space:nowrap}',
    '.m2-drawer-mask{position:fixed;inset:0;z-index:1200;background:rgba(15,23,42,.45)}',
    '.m2-drawer{position:fixed;top:0;right:0;bottom:0;z-index:1201;width:min(720px,94vw);background:#fff;box-shadow:-12px 0 40px rgba(15,23,42,.18);display:flex;flex-direction:column}',
    '.m2-drawer .hd{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border,#dfe5ec)}',
    '.m2-drawer .hd .t{font-size:15px;font-weight:700;color:#1f2937}',
    '.m2-drawer .hd .x{width:28px;height:28px;border:0;border-radius:5px;background:#f2f4f7;color:#667085;font-size:16px;cursor:pointer}',
    '.m2-drawer .bd{flex:1;overflow:auto;padding:16px 18px}',
    '.m2-timeline{position:relative;margin:6px 0 0 5px;padding-left:20px;border-left:2px solid #dfe5ec}',
    '.m2-timeline .ev{position:relative;margin-bottom:14px}',
    '.m2-timeline .ev::before{content:"";position:absolute;left:-26px;top:4px;width:10px;height:10px;border-radius:50%;background:#244765;border:2px solid #fff;box-shadow:0 0 0 2px #dfe5ec}',
    '.m2-timeline .ev .tm{font-size:11px;color:#94a3b8}',
    '.m2-timeline .ev .tt{font-size:13px;font-weight:600;color:#1f2937;margin-top:1px}',
    '.m2-timeline .ev .ds{font-size:12px;color:#667085;margin-top:2px}',
    '.m2-kv{display:grid;grid-template-columns:110px 1fr;gap:7px 12px;font-size:13px;margin-bottom:10px}',
    '.m2-kv .k{color:#667085}.m2-kv .v{color:#1f2937;font-weight:600}',
    '.m2-evi{border:1px dashed #c7d0da;border-radius:7px;padding:11px 13px;margin-bottom:12px;background:#fbfcfe}',
    '.m2-evi .tt{font-size:12px;font-weight:700;color:#244765;margin-bottom:6px}',
    '.m2-evi .tx{font-size:12px;color:#475467;line-height:1.65;white-space:pre-wrap}',
    '.m2-wm{display:inline-block;margin-top:8px;font-size:10px;color:#94a3b8;border:1px solid #e2e8f0;padding:2px 7px;border-radius:3px}',
    '.m2-modal-mask{position:fixed;inset:0;z-index:1220;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.5)}',
    '.m2-modal{width:min(780px,96vw);max-height:86vh;overflow:auto;background:#fff;border-radius:10px;box-shadow:0 18px 50px rgba(15,23,42,.25)}',
    '.m2-modal .hd{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:13px 18px;background:#fff;border-bottom:1px solid var(--border,#dfe5ec)}',
    '.m2-modal .hd .t{font-size:15px;font-weight:700;color:#1f2937}',
    '.m2-modal .hd .x{width:28px;height:28px;border:0;border-radius:5px;background:#f2f4f7;color:#667085;font-size:16px;cursor:pointer}',
    '.m2-modal .bd{padding:16px 18px}',
    '.m2-msg{font-size:12px;color:#667085;line-height:1.7}',
    '.m2-status{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600}',
    '.m2-st-s0{background:#e0eaff;color:#3538cd}.m2-st-s1{background:#fef0c7;color:#b54708}.m2-st-s2{background:#e0eaff;color:#1849a9}',
    '.m2-st-s3{background:#fef0c7;color:#b54708}.m2-st-s4{background:#d3f4df;color:#127d3f}.m2-st-s5{background:#fee4e2;color:#b42335}',
    '.m2-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}',
    '.m2-tabs .tb{height:32px;padding:0 14px;border:1px solid var(--border,#dfe5ec);border-radius:6px;background:#fff;color:#334155;font-size:13px;cursor:pointer;font-weight:600}',
    '.m2-tabs .tb.on{background:#244765;border-color:#244765;color:#fff}',
    '.m2-gridmap{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}',
    '.m2-mapcell{border:1px solid var(--border,#dfe5ec);border-radius:8px;padding:10px 12px;background:#fff}',
    '.m2-mapcell .nm{font-size:12px;font-weight:700;color:#1f2937}',
    '.m2-mapcell .lights{display:flex;gap:4px;margin-top:7px;flex-wrap:wrap}',
    '.m2-light{width:9px;height:9px;border-radius:50%}',
    '.m2-light.red{background:#d92d20;box-shadow:0 0 6px #d92d2088;animation:m2pulse 1.4s infinite}',
    '.m2-light.yellow{background:#f79009;box-shadow:0 0 6px #f7900988;animation:m2pulse 1.4s infinite}',
    '.m2-light.green{background:#12b76a}',
    '.m2-light.blue{background:#2e90fa}',
    '@keyframes m2pulse{50%{opacity:.35}}',
    '.m2-dl-list{display:flex;flex-direction:column;gap:8px}',
    '.m2-dl-it{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--border,#dfe5ec);border-radius:7px;padding:10px 13px;font-size:13px;color:#1f2937;background:#fbfcfe}',
    '@media(max-width:1100px){.m2-grid2,.m2-grid3,.m2-grid13{grid-template-columns:1fr}.m2-gridmap{grid-template-columns:repeat(2,1fr)}}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------------- 基础工具 ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function heads(title, sub, acts) {
    return '<div class="m2-head"><div><div class="t">' + esc(title) + '</div><div class="s">' + esc(sub) + '</div></div><div class="acts">' + (acts || '<span class="m2-tag">卫健委监管闭环</span>') + '</div></div>';
  }
  function kpis(items) {
    return '<div class="m2-kpis">' + items.map(function (x) {
      return '<div class="m2-kpi"><div class="l">' + esc(x.l) + '</div><div class="v ' + (x.tone || '') + '">' + esc(x.v) + '</div><div class="m">' + esc(x.m || '') + '</div></div>';
    }).join('') + '</div>';
  }
  function card(title, body, sub) {
    return '<div class="m2-card"><div class="hd"><span class="t">' + esc(title) + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</span></div><div class="bd">' + body + '</div></div>';
  }
  function table(headers, rowsHtml, minWidth) {
    var th = headers.map(function (h) { return '<th class="' + (h.charAt(0) === '#' ? 'num' : h === '操作' ? 'ops' : '') + '">' + esc(h.replace(/^#/, '')) + '</th>'; }).join('');
    return '<div class="m2-table-wrap"><table class="m2-table"' + (minWidth ? ' style="min-width:' + minWidth + 'px"' : '') + '><thead><tr>' + th + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
  }
  function btn(text, act, arg, primary) {
    return '<button class="btn ' + (primary ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-m2="' + esc(act) + '" data-arg="' + esc(arg || '') + '">' + esc(text) + '</button>';
  }
  function lvBadge(lv) {
    if (lv === '红牌') return '<span class="m2-lv-red">红牌</span>';
    if (lv === '黄牌') return '<span class="m2-lv-yellow">黄牌</span>';
    if (lv === '蓝牌') return '<span class="m2-lv-blue">蓝牌</span>';
    return '<span class="m2-lv-gray">' + esc(lv) + '</span>';
  }
  function stBadge(st) {
    var map = { '预警触发·待成案': 'm2-st-s0', '督办已下发·待签收': 'm2-st-s1', '机构已签收·整改中': 'm2-st-s2', '机构已整改·待审核': 'm2-st-s3', '审核通过·已销号': 'm2-st-s4', '整改逾期·红色追责': 'm2-st-s5' };
    return '<span class="m2-status ' + (map[st] || 'm2-st-s0') + '">' + esc(st) + '</span>';
  }
  function filterBar(fields) {
    var html = fields.map(function (f) {
      if (f.type === 'select') {
        var opts = f.options.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('');
        return '<div class="fg"><label>' + esc(f.label) + '</label><select>' + opts + '</select></div>';
      }
      return '<div class="fg"><label>' + esc(f.label) + '</label><input type="text" placeholder="' + esc(f.placeholder || '') + '"></div>';
    }).join('');
    return '<div class="m2-filter">' + html + '<div class="acts">' + btn('重置', 'reset') + btn('查询', 'query', '', true) + '</div></div>';
  }
  function lineChart(points, color) {
    var W = 640, H = 210, P = { t: 18, r: 16, b: 30, l: 40 };
    var vals = points.map(function (p) { return p.v; });
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    if (max === min) { max += 1; min -= 1; }
    var iw = W - P.l - P.r, ih = H - P.t - P.b, n = points.length;
    var xs = points.map(function (_, i) { return P.l + (n <= 1 ? iw / 2 : iw * i / (n - 1)); });
    var ys = points.map(function (p) { return P.t + ih - (p.v - min) / (max - min) * ih; });
    var pts = xs.map(function (x, i) { return x.toFixed(1) + ',' + ys[i].toFixed(1); }).join(' ');
    var dots = xs.map(function (x, i) { return '<circle cx="' + x.toFixed(1) + '" cy="' + ys[i].toFixed(1) + '" r="3" fill="' + (color || '#244765') + '"/>'; }).join('');
    var grid = '', lab = '';
    for (var t = 0; t <= 4; t++) {
      var y = P.t + ih * t / 4, val = max - (max - min) * t / 4;
      grid += '<line x1="' + P.l + '" y1="' + y.toFixed(1) + '" x2="' + (W - P.r) + '" y2="' + y.toFixed(1) + '" stroke="#eef2f7"/>';
      lab += '<text x="' + (P.l - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="10" fill="#94a3b8">' + val.toFixed(1) + '</text>';
    }
    var xlabs = points.map(function (p, i) {
      if (n > 10 && i % 2 === 1) return '';
      return '<text x="' + xs[i].toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="#94a3b8">' + esc(p.l) + '</text>';
    }).join('');
    return '<svg class="m2-line" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' + grid + lab + '<polyline points="' + pts + '" fill="none" stroke="' + (color || '#244765') + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>' + dots + xlabs + '</svg>';
  }
  function pieChart(items, colors) {
    var total = items.reduce(function (a, b) { return a + b.v; }, 0) || 1;
    var cx = 80, cy = 80, r = 66, ang = -Math.PI / 2, segs = '';
    items.forEach(function (it, i) {
      var a2 = ang + it.v / total * Math.PI * 2;
      var large = (a2 - ang) > Math.PI ? 1 : 0;
      var x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang);
      var x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      segs += '<path d="M' + cx + ',' + cy + ' L' + x1.toFixed(1) + ',' + y1.toFixed(1) + ' A' + r + ',' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(1) + ',' + y2.toFixed(1) + ' Z" fill="' + colors[i % colors.length] + '" stroke="#fff" stroke-width="2"/>';
      ang = a2;
    });
    var leg = items.map(function (it, i) {
      return '<div class="it"><span class="sw" style="background:' + colors[i % colors.length] + '"></span>' + esc(it.l) + '<b>' + it.v + '（' + Math.round(it.v / total * 100) + '%）</b></div>';
    }).join('');
    return '<div class="m2-pie"><svg width="160" height="160" viewBox="0 0 160 160">' + segs + '</svg><div class="leg">' + leg + '</div></div>';
  }
  function stackedBar(data, unit) {
    var max = Math.max.apply(null, data.map(function (d) { return d.r + d.y + d.b; })) || 1;
    return '<div class="m2-bar">' + data.map(function (d) {
      var h = Math.max(4, Math.round((d.r + d.y + d.b) / max * 100));
      var hr = d.r / (d.r + d.y + d.b) * 100, hy = d.y / (d.r + d.y + d.b) * 100;
      return '<div class="col" data-m2="drill" data-arg="' + esc(d.l) + '"><div class="val">' + (d.r + d.y + d.b) + (unit || '') + '</div><div class="track" style="height:' + h + '%"><div class="fill" style="height:100%"><div class="seg-red" style="height:' + hr + '%"></div><div class="seg-yellow" style="height:' + hy + '%"></div><div class="seg-blue" style="height:' + (100 - hr - hy) + '%"></div></div></div><div class="lab">' + esc(d.l) + '</div></div>';
    }).join('') + '</div>';
  }
  function toast(msg) {
    var c = document.getElementById('m2Toast');
    if (!c) { c = document.createElement('div'); c.id = 'm2Toast'; c.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:1400;display:flex;flex-direction:column;gap:8px'; document.body.appendChild(c); }
    var t = document.createElement('div');
    t.style.cssText = 'background:#182230;color:#fff;padding:10px 16px;border-radius:6px;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.2)';
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 320); }, 2200);
  }
  function closeAll() {
    document.querySelectorAll('.m2-drawer-mask,.m2-drawer,.m2-modal-mask').forEach(function (n) { n.remove(); });
  }

  /* ---------------- 静态数据：13 条预警规则（对齐文档第一章） ---------------- */
  var RULES = [
    { no: 'DIR1-01', dir: '公卫与癌情监测', name: '区域重点癌种早诊率跌破考核红线预警', lv: '红牌（考核）', scope: '疾控处、防癌办 → 区县卫健局/定点医院', limit: '30日内提交早筛补救方案', freq: '季度跑批', std: '早诊率 ≥ 55.0%', formula: '早诊率 = 分期0/I期及特定早中期病例数 ÷ 已明确分期的新发病例数' },
    { no: 'DIR1-02', dir: '公卫与癌情监测', name: '民生实事早筛任务进度严重滞后预警', lv: '红牌（考核）', scope: '公卫处、重大项目办 → 任务承担医院/社区', limit: '15日内组织辖区集中筛查', freq: '月度核算', std: '(月序/12 − 完成率) ≤ 15%', formula: '时间进度 − 实际完成率 > 15% 即触发' },
    { no: 'DIR1-03', dir: '公卫与癌情监测', name: '初筛阳性人群精查失管率超标预警（重筛轻治）', lv: '黄牌（整改）', scope: '疾控处 → 筛查定点医院、基层社卫', limit: '10日内完成阳性居民追访', freq: '月度核算', std: '失管率 ≤ 60.0%', formula: '超60天未精查阳性居民数 ÷ 初筛阳性总人数' },
    { no: 'DIR1-04', dir: '公卫与癌情监测', name: '街道/乡镇单癌种发病聚集性激增预警（舆情防范）', lv: '红牌（突发）', scope: '疾控处、公卫处 → 区县疾控流调队', limit: '7日内流行病学现场核查', freq: '季度跑批', std: '单街镇单癌种 <10例 且环比+3年均值 ≤30% 且 < +2σ', formula: '新发确诊 ≥10例 且（增幅 >30% 或 标化率超全区均值 +2σ）' },
    { no: 'DIR2-01', dir: '医疗质量与执业合规', name: '医院级"首次抗肿瘤治疗前病理确诊率"不达标', lv: '红牌（国考）', scope: '医政处、肿瘤质控中心 → 违规公立/民营医院', limit: '15日内提交医务处病历自查报告', freq: '月度跑批', std: '三级 ≥90.0% / 二级 ≥85.0%', formula: '治疗前180天内无阳性病理记录比例过高即触发' },
    { no: 'DIR2-02', dir: '医疗质量与执业合规', name: '限制级抗肿瘤药"无基因靶点检测违规使用"高发', lv: '红牌（行风）', scope: '医政处、药政处 → 医院院长、药事委员会', limit: '7日内停权自查并问责涉事医生', freq: '月度跑批', std: '违规处方占比 ≤ 5.0%', formula: '"未检先开"+"检测阴性仍开药"处方占比 > 5%' },
    { no: 'DIR2-03', dir: '医疗质量与执业合规', name: '早期低危肿瘤患者高价检测（NGS/PET-CT）滥用', lv: '黄牌（控费）', scope: '医政处、驻委纪检组 → 异常科室及所在医院', limit: '15日内提交合理检查专项整改', freq: '月度跑批', std: '开单率 ≤ 同级均值 ×2.0', formula: 'Ⅰ期低危手术患者 NGS大Panel / 全身PET-CT 开单率超均值2倍' },
    { no: 'DIR2-04', dir: '医疗质量与执业合规', name: '跨院肿瘤检查检验"拒不互认/重复开单"排名垫底', lv: '黄牌（整改）', scope: '体改处、医政处 → 互认率倒数前三公立医院', limit: '10日内整改系统拦截与考核', freq: '月度跑批', std: '互认采纳率 ≥ 80.0%', formula: '14天内已完成他院检测的患者重复开单 / 恶意豁免排名前三' },
    { no: 'DIR3-01', dir: '数据汇聚与平台协同', name: '医院检验/病理数据上传中断（前置机断流）预警', lv: '红牌（运行）', scope: '信息统计处 → 涉事医院分管信息院长', limit: '24小时内恢复数据通道', freq: '每日凌晨跑批', std: 'PIS>0 且 LIS ≥ 近30日均值30%', formula: '连续2个工作日 PIS上传=0 或 LIS跌破均值30%' },
    { no: 'DIR3-02', dir: '数据汇聚与平台协同', name: '自动生成报卡"核心临床要素残缺（空值率超标）"预警', lv: '黄牌（数据源）', scope: '统计处、肿瘤登记处 → 医院医务处、病案室', limit: '15日内治理电子病历结构化', freq: '月度跑批', std: 'TNM空值率 ≤20%，8000/3占比 ≤15%', formula: 'TNM分期空值率 >20% 或 ICD-O-3 未特指率 >15%' },
    { no: 'DIR3-03', dir: '数据汇聚与平台协同', name: '门诊/出院恶性诊断"长期无病理/无治疗支撑"多发', lv: '黄牌（防假卡）', scope: '肿瘤登记处 → 疑似诊断滥用严重的医院', limit: '10日内完成存量假阳性卡清理', freq: '月度跑批', std: '假阳性成卡占比 ≤ 10.0%', formula: '90天回溯无病理且无放化疗/手术记录的报卡占比 >10%' },
    { no: 'DIR3-04', dir: '数据汇聚与平台协同', name: '卫健委督办工单签收或整改超时未反馈预警', lv: '红色追责', scope: '委办公室、政务督查室 → 拖延不办的机构主要领导', limit: '启动行政约谈并通报全区', freq: '每日扫描', std: '3个工作日内签收 / 期限内反馈', formula: '超3日未签收或超期未提交整改报告即升级红色逾期' }
  ];

  /* ---------------- 静态数据：预警记录台账（演示） ---------------- */
  var RECORDS = [
    { id: 'ALT-20261021-00892', time: '2026-10-21 02:30:15', lv: '红牌', dir: '公卫与癌情监测', rule: 'DIR1-01', org: '南昌县卫健局', dept: '辖区定点医院', trig: '48.2%', std: '≥55.0%', cases: 86, doc: '卫健肿督[2026]045号', final: '持续整改中', st: '机构已签收·整改中', close: '—' },
    { id: 'ALT-20261021-00891', time: '2026-10-21 02:31:02', lv: '红牌', dir: '数据汇聚与平台协同', rule: 'DIR3-01', org: '九江市第二人民医院', dept: '信息科（前置机）', trig: 'PIS 连续2日=0', std: 'PIS>0', cases: 2, doc: '卫健肿督[2026]044号', final: '系统自动销号', st: '审核通过·已销号', close: '10-22 03:00 系统自动复核销号' },
    { id: 'ALT-20261021-00890', time: '2026-10-21 02:33:40', lv: '黄牌', dir: '医疗质量与执业合规', rule: 'DIR2-02', org: '赣州市肿瘤医院', dept: '药学部·肿瘤内科', trig: '6.8%', std: '≤5.0%', cases: 14, doc: '卫健肿督[2026]043号', final: '持续整改中', st: '机构已签收·整改中', close: '—' },
    { id: 'ALT-20261020-00888', time: '2026-10-20 02:10:11', lv: '黄牌', dir: '公卫与癌情监测', rule: 'DIR1-03', org: '青山湖区社区卫生服务中心', dept: '早筛门诊', trig: '63.5%', std: '≤60.0%', cases: 31, doc: '卫健肿督[2026]042号', final: '人工审核通过结案', st: '审核通过·已销号', close: '10-19 16:20 医政处王处长人工审结' },
    { id: 'ALT-20261020-00887', time: '2026-10-20 02:12:45', lv: '红牌', dir: '医疗质量与执业合规', rule: 'DIR2-01', org: '上饶市立医院（三级）', dept: '医务处', trig: '确诊率 87.4%', std: '≥90.0%', cases: 52, doc: '卫健肿督[2026]041号', final: '逾期转行政约谈', st: '整改逾期·红色追责', close: '已抄送政务督查室' },
    { id: 'ALT-20261019-00885', time: '2026-10-19 02:05:33', lv: '黄牌', dir: '数据汇聚与平台协同', rule: 'DIR3-02', org: '景德镇市第一人民医院', dept: '病案室', trig: 'TNM空值率 24.6%', std: '≤20.0%', cases: 118, doc: '卫健肿督[2026]040号', final: '持续整改中', st: '机构已整改·待审核', close: '—' },
    { id: 'ALT-20261019-00884', time: '2026-10-19 02:07:20', lv: '蓝牌', dir: '数据汇聚与平台协同', rule: 'DIR3-03', org: '宜春市人民医院', dept: '门诊部', trig: '假阳性占比 8.1%', std: '≤10.0%', cases: 12, doc: '日常监测备案', final: '系统自动销号', st: '审核通过·已销号', close: '10-20 03:00 系统自动复核销号' },
    { id: 'ALT-20261018-00882', time: '2026-10-18 02:40:08', lv: '红牌', dir: '公卫与癌情监测', rule: 'DIR1-04', org: '新建区·长堎街道', dept: '区疾控流调队', trig: '肺癌 11例/季，较3年均值+38%', std: '<10例或≤30%', cases: 11, doc: '卫健肿督[2026]039号', final: '人工审核通过结案', st: '审核通过·已销号', close: '10-17 11:05 疾控处李处长审结' },
    { id: 'ALT-20261018-00881', time: '2026-10-18 02:42:50', lv: '黄牌', dir: '医疗质量与执业合规', rule: 'DIR2-03', org: '抚州市第一医院', dept: '胸外科', trig: '开单率 均值×2.4', std: '≤均值×2.0', cases: 9, doc: '卫健肿督[2026]038号', final: '医院申诉豁免', st: '审核通过·已销号', close: '10-16 09:40 申诉成立·豁免结案' },
    { id: 'ALT-20261017-00879', time: '2026-10-17 02:20:18', lv: '红色追责', dir: '数据汇聚与平台协同', rule: 'DIR3-04', org: '鹰潭市人民医院', dept: '院办', trig: '超5日未签收', std: '3个工作日内', cases: 1, doc: '卫健肿督[2026]037号', final: '逾期转行政约谈', st: '整改逾期·红色追责', close: '已启动院长约谈' }
  ];

  /* ---------------- 静态数据：督办工单（调度大厅 / 机构端） ---------------- */
  var ORDERS = [
    { no: '卫健肿督[2026]045号', rule: 'DIR1-01 早诊率红线', org: '南昌县卫健局', lv: '红牌', st: '机构已签收·整改中', dept: '疾控处', ddl: '2026-11-20', signed: '10-24', report: '', days: '剩余 18 天' },
    { no: '卫健肿督[2026]044号', rule: 'DIR3-01 前置机断流', org: '九江市第二人民医院', lv: '红牌', st: '审核通过·已销号', dept: '信息统计处', ddl: '10-22 24:00', signed: '10-21', report: '已提交·自动复核达标', days: '已销号' },
    { no: '卫健肿督[2026]043号', rule: 'DIR2-02 靶向药未检先开', org: '赣州市肿瘤医院', lv: '红牌', st: '机构已签收·整改中', dept: '医政处', ddl: '2026-10-28', signed: '10-23', report: '', days: '剩余 3 天' },
    { no: '卫健肿督[2026]041号', rule: 'DIR2-01 治疗前病理确诊率', org: '上饶市立医院', lv: '红牌', st: '整改逾期·红色追责', dept: '医政处', ddl: '2026-10-16', signed: '10-08', report: '', days: '逾期 4 天 · 已抄送督查室' },
    { no: '卫健肿督[2026]040号', rule: 'DIR3-02 报卡要素残缺', org: '景德镇市第一人民医院', lv: '黄牌', st: '机构已整改·待审核', dept: '统计处', ddl: '2026-10-30', signed: '10-20', report: '《整改报告》+ 病历清单已上传', days: '待局端审核' },
    { no: '卫健肿督[2026]038号', rule: 'DIR2-03 高价检测滥用', org: '抚州市第一医院', lv: '黄牌', st: '审核通过·已销号', dept: '医政处', ddl: '2026-10-25', signed: '10-13', report: '申诉：临床必需·佐证齐全', days: '申诉豁免结案' },
    { no: '卫健肿督[2026]037号', rule: 'DIR3-04 工单超时未反馈', org: '鹰潭市人民医院', lv: '红色追责', st: '整改逾期·红色追责', dept: '委办公室', ddl: '2026-10-15', signed: '未签收', report: '', days: '超5日未签收 · 已启动约谈' }
  ];

  var DIRECTIONS = ['公卫与癌情监测', '医疗质量与执业合规', '数据汇聚与平台协同'];

  /* ==================== 页面 1：监督整改调度大厅 ==================== */
  var HALL_DEPT = '全部处室';
  function renderHall() {
    var depts = ['全部处室', '疾控处', '医政处', '公卫处', '信息统计处', '委办公室'];
    var tabs = '<div class="m2-tabs">' + depts.map(function (d) {
      return '<button class="tb' + (d === HALL_DEPT ? ' on' : '') + '" data-m2="halldept" data-arg="' + esc(d) + '">' + esc(d) + '</button>';
    }).join('') + '</div>';
    var list = ORDERS.filter(function (o) { return HALL_DEPT === '全部处室' || o.dept === HALL_DEPT; });
    var tr = list.map(function (o) {
      return '<tr><td>' + esc(o.no) + '</td><td>' + esc(o.rule) + '</td><td>' + esc(o.org) + '</td><td>' + lvBadge(o.lv) + '</td><td>' + stBadge(o.st) + '</td><td>' + esc(o.dept) + '</td><td>' + esc(o.signed) + '</td><td>' + esc(o.report || '—') + '</td><td>' + esc(o.days) + '</td><td class="ops">' +
        (o.st === '预警触发·待成案' ? btn('签发督办单', 'dispatch', o.no, true) : '') +
        (o.st === '机构已整改·待审核' ? btn('审核自查报告', 'review', o.no, true) + ' ' + btn('退回重改', 'reject', o.no) : '') +
        (o.st === '审核通过·已销号' ? btn('查看归档', 'archive', o.no) : '') +
        (o.st === '机构已签收·整改中' ? btn('调取证据链', 'evidence', o.no) : '') +
        (o.st === '整改逾期·红色追责' ? btn('启动约谈', 'summon', o.no, true) : '') +
        '</td></tr>';
    }).join('');
    var funnelData = [
      { n: '预警触发·待成案', v: 4, c: '#3538cd' },
      { n: '督办已下发·待签收', v: 2, c: '#d92d20' },
      { n: '机构已签收·整改中', v: 9, c: '#1849a9' },
      { n: '机构已整改·待审核', v: 3, c: '#f79009' },
      { n: '整改逾期·红色追责', v: 2, c: '#b42335' },
      { n: '审核通过·已销号', v: 18, c: '#12b76a' }
    ];
    var maxv = 18;
    var funnel = '<div class="m2-funnel">' + funnelData.map(function (f) {
      return '<div class="row"><span class="nm">' + esc(f.n) + '</span><div class="bar" style="width:' + Math.max(18, f.v / maxv * 260) + 'px;background:' + f.c + '">' + f.v + '</div></div>';
    }).join('') + '</div>';
    return heads('监督整改调度大厅', '卫健委处室核心工作台 · 状态漏斗流转 · 一键调取脱敏证据链生成红头督办单') +
      tabs +
      '<div class="m2-grid13"><div>' +
      kpis([
        { l: '在办督办单', v: '20', m: '本月新增 14' },
        { l: '待签收', v: '2', m: '3天签收倒计时', tone: 'yellow' },
        { l: '待审核', v: '3', m: '医院已提报', tone: 'blue' },
        { l: '已逾期', v: '2', m: '红色追责中', tone: 'red' },
        { l: '本月销号', v: '18', m: '自动销号 12 / 人工 6', tone: 'green' }
      ]) +
      card('督办工单调度列表', table(['公文编号', '触发规则', '涉事机构', '等级', '闭环状态', '主办处室', '签收时间', '整改报告', '时限/剩余', '操作'], tr, 1280)) +
      '</div><div>' +
      card('闭环状态漏斗（全部处室）', funnel) +
      card('销号方式统计（双轨制）', pieChart([{ l: '系统自动复核销号', v: 12 }, { l: '人工审核结案', v: 5 }, { l: '申诉豁免结案', v: 1 }], ['#2e90fa', '#244765', '#94a3b8'])) +
      card('操作说明', '<div class="m2-msg">① 待成案：一键调取脱敏证据链 → 处长/分管局长电子签名 → 签发红头督办单；<br>② 待审核：审阅医院上传的《自查整改报告》与佐证 → 通过销号 / 退回重改（时限不顺延）；<br>③ 逾期：系统自动升级红色状态并抄送政务督查室启动约谈。</div>') +
      '</div></div>';
  }

  /* ==================== 页面 2：预警记录中心 ==================== */
  function renderRecords() {
    var tr = RECORDS.map(function (x) {
      return '<tr><td style="white-space:nowrap">' + esc(x.id) + '</td><td style="white-space:nowrap">' + esc(x.time) + '</td><td>' + lvBadge(x.lv) + '</td><td>' + esc(x.dir) + '</td><td style="white-space:nowrap">' + esc(x.rule) + '</td><td>' + esc(x.org) + (x.dept && x.dept !== '辖区定点医院' ? ' - ' + esc(x.dept) : '') + '</td><td style="white-space:nowrap">' + esc(x.trig) + ' <span style="color:#94a3b8">vs ' + esc(x.std) + '</span></td><td class="num">' + x.cases + '</td><td>' + esc(x.doc) + '</td><td>' + (x.final === '系统自动销号' || x.final === '人工审核通过结案' ? '<span class="m2-lv-green">' + esc(x.final) + '</span>' : x.final === '医院申诉豁免' ? '<span class="m2-lv-gray">' + esc(x.final) + '</span>' : '<span class="m2-lv-red">' + esc(x.final) + '</span>') + '</td><td style="font-size:12px;color:#667085">' + esc(x.close) + '</td><td class="ops">' + btn('证据链', 'drawer', x.id) + ' ' + btn('档案PDF', 'pdf', x.id) + ' ' + btn('流转', 'drawer', x.id) + '</td></tr>';
    }).join('');
    return heads('预警记录中心', '法定历史台账 · 每条预警不可篡改全量归档，带时间戳证据链档案库，支撑责任倒查与信访复核') +
      filterBar([
        { label: '统计时间范围', type: 'select', options: ['2026-10', '2026-Q3', '2026 年', '自定义日历跨度'] },
        { label: '机构类型', type: 'select', options: ['全部机构类型', '公立三甲', '公立二级', '民营医院', '社区卫生服务中心'] },
        { label: '监管方向', type: 'select', options: ['全部方向'].concat(DIRECTIONS) },
        { label: '具体规则', type: 'select', options: ['全部规则'].concat(RULES.map(function (r) { return r.no + ' ' + r.name; })) },
        { label: '预警级别', type: 'select', options: ['全部级别', '红牌', '黄牌', '蓝牌'] },
        { label: '终态结果', type: 'select', options: ['全部终态', '系统自动销号', '人工审核通过结案', '医院申诉豁免', '逾期转行政约谈', '持续整改中'] },
        { label: '患者主索引/病历号/处方号', placeholder: '支持模糊检索定位具体个案' }
      ]) +
      kpis([
        { l: '本月归档预警', v: '89', m: '红 21 / 黄 54 / 蓝 14' },
        { l: '已闭环销号', v: '71', m: '闭环率 79.8%', tone: 'green' },
        { l: '申诉豁免', v: '4', m: '驳回 1 / 成立 3' },
        { l: '逾期约谈', v: '5', m: '已通报全区', tone: 'red' }
      ]) +
      card('全景预警记录主数据表格', table(['预警流水号', '触发时间戳', '等级', '监管方向', '规则编号', '涉事主体', '触发值 vs 阈值', '#关联个案', '督办文号', '闭环终态', '销号时间与方式', '操作'], tr, 1500)) +
      '<div class="m2-msg">全量台账仅可追加不可修改；删除与编辑按钮不提供。点击「证据链 / 流转」查看单条预警的全景档案溯源抽屉。</div>';
  }

  function openRecordDrawer(id) {
    closeAll();
    var r = RECORDS.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var mask = document.createElement('div');
    mask.className = 'm2-drawer-mask';
    mask.setAttribute('data-m2', 'close');
    var drawer = document.createElement('div');
    drawer.className = 'm2-drawer';
    drawer.innerHTML =
      '<div class="hd"><span class="t">预警档案溯源 · ' + esc(r.id) + '</span><button class="x" data-m2="close">×</button></div>' +
      '<div class="bd">' +
      '<div class="m2-kv">' +
      '<div class="k">预警规则</div><div class="v">' + esc(r.rule) + ' ' + esc((RULES.filter(function (x) { return x.no === r.rule; })[0] || {}).name || '') + '</div>' +
      '<div class="k">触发值 / 阈值</div><div class="v">' + esc(r.trig) + ' vs ' + esc(r.std) + '</div>' +
      '<div class="k">涉事主体</div><div class="v">' + esc(r.org) + (r.dept ? ' - ' + esc(r.dept) : '') + '</div>' +
      '<div class="k">关联个案</div><div class="v">' + r.cases + ' 条</div>' +
      '<div class="k">督办文号</div><div class="v">' + esc(r.doc) + '</div>' +
      '<div class="k">闭环终态</div><div class="v">' + esc(r.final) + '</div>' +
      '</div>' +
      card('第一区 · 触发原始证据（系统抓取快照）',
        '<div class="m2-evi"><div class="tt">处方/化验/病理原始数据快照</div><div class="tx">触发时刻 2026-10-21 02:30:15，系统自前置机抓取该机构上报的全量底层数据：\n· 涉事门诊处方 14 条（限制级靶向药，其中分子病理库比对"未检先开"9 条、"检测阴性仍开药" 5 条）；\n· 关联患者主索引 12 个，检验报告 L-8812~L-8823；\n· 病理报告 PR-2026-3391（阴性，2026-09-30）。</div><span class="m2-wm">卫健委数据存证水印 · SHA-256 不可篡改 · 已上链存证</span></div>') +
      card('第二区 · 完整流转时间轴（履职留痕）',
        '<div class="m2-timeline">' +
        '<div class="ev"><div class="tm">2026-10-21 02:30:15</div><div class="tt">系统跑批触发 · 建档</div><div class="ds">规则引擎命中，生成预警流水 ' + esc(r.id) + '</div></div>' +
        '<div class="ev"><div class="tm">2026-10-21 09:12</div><div class="tt">专员审发 · 红头督办单签发</div><div class="ds">处长/分管局长电子签名，公文号 ' + esc(r.doc) + '</div></div>' +
        '<div class="ev"><div class="tm">2026-10-23 15:40</div><div class="tt">医院签收</div><div class="ds">医务处在线签收，启动整改倒计时</div></div>' +
        '<div class="ev"><div class="tm">（进行中）</div><div class="tt">机构自查整改中</div><div class="ds">系统每日凌晨复核底层数据是否恢复达标</div></div>' +
        '</div>') +
      card('第三区 · 留存附件下载',
        '<div class="m2-dl-list">' +
        '<div class="m2-dl-it"><span>《行政监督整改通知书》（红头文件盖章扫描件）</span>' + btn('下载', 'pdf', r.id) + '</div>' +
        '<div class="m2-dl-it"><span>医院《自查整改报告》盖章扫描件（医院上传后出现）</span>' + btn('下载', 'pdf', r.id) + '</div>' +
        '<div class="m2-dl-it"><span>佐证材料打包（处方清单 / 病历清单 / 制度修订文件）</span>' + btn('打包下载', 'pdf', r.id) + '</div>' +
        '</div>') +
      '</div>';
    document.body.appendChild(mask);
    document.body.appendChild(drawer);
  }

  /* ==================== 页面 3：预警统计与报表中心 ==================== */
  var STATS_TAB = 1;
  function renderStats() {
    var tabs = '<div class="m2-tabs">' + [
      [1, '① 机构红黑榜'], [2, '② 方向与规则结构'], [3, '③ 时序趋势收敛'], [4, '④ 区县分布'], [5, '⑤ 闭环效能']
    ].map(function (x) { return '<button class="tb' + (STATS_TAB === x[0] ? ' on' : '') + '" data-m2="statstab" data-arg="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var body = '';
    if (STATS_TAB === 1) {
      var rank = [
        { h: '上饶市立医院', r: 5, y: 3, b: 2, t: '62%', ok: '88%', late: 2, avg: '96h' },
        { h: '南昌县定点医院群', r: 4, y: 4, b: 1, t: '71%', ok: '92%', late: 1, avg: '78h' },
        { h: '九江市第二人民医院', r: 3, y: 2, b: 3, t: '80%', ok: '95%', late: 0, avg: '52h' },
        { h: '赣州市肿瘤医院', r: 3, y: 3, b: 2, t: '75%', ok: '90%', late: 0, avg: '61h' },
        { h: '景德镇市第一人民医院', r: 2, y: 3, b: 2, t: '84%', ok: '93%', late: 0, avg: '55h' },
        { h: '抚州市第一医院', r: 1, y: 2, b: 2, t: '88%', ok: '96%', late: 0, avg: '40h' }
      ];
      var tr = rank.map(function (x, i) {
        return '<tr><td class="num">' + (i + 1) + '</td><td>' + esc(x.h) + '</td><td class="num"><span class="m2-lv-red">' + x.r + '</span> <span class="m2-lv-yellow">' + x.y + '</span> <span class="m2-lv-blue">' + x.b + '</span></td><td class="num">' + x.t + '</td><td class="num">' + x.ok + '</td><td class="num">' + x.late + '</td><td class="num">' + x.avg + '</td><td class="ops">' + btn('下钻', 'drill', x.h) + '</td></tr>';
      }).join('');
      body = kpis([
        { l: '本月红牌最多的医院', v: '上饶市立医院', m: '红5 黄3，逾期2次', tone: 'red' },
        { l: '整改及时率第一', v: '抚州市第一医院', m: '88% · 平均响应 40h', tone: 'green' },
        { l: '全区平均整改达标率', v: '91.5%', m: '环比 +2.3pp', tone: 'green' }
      ]) +
        '<div class="m2-grid13">' +
        card('各机构红/黄/蓝牌堆叠排行', stackedBar(rank.map(function (x) { return { l: x.h.replace('市立医院', '市立').replace('人民医院', '人民').replace('第一医院', '一院').replace('定点医院群', '定点群'), r: x.r, y: x.y, b: x.b }; })), '点击柱体下钻至明细台账') +
        card('医院红黑榜与考核排行', table(['#排名', '机构', '红/黄/蓝', '#整改及时率', '#整改达标率', '#历史逾期', '#平均响应时长', '操作'], tr)) +
        '</div>';
    } else if (STATS_TAB === 2) {
      var top = [
        { n: 'DIR2-02 靶向药未检先开', v: 41 },
        { n: 'DIR1-03 早筛精查脱失', v: 26 },
        { n: 'DIR2-01 治疗前病理缺确诊', v: 18 },
        { n: 'DIR3-02 报卡要素残缺', v: 14 },
        { n: 'DIR2-03 高价检测滥用', v: 11 },
        { n: 'DIR3-01 前置机断流', v: 8 },
        { n: '其他', v: 9 }
      ];
      var maxv = 41;
      var pareto = '<div class="m2-funnel">' + top.map(function (x, i) {
        var colors = ['#d92d20', '#f79009', '#2e90fa', '#244765', '#7fb4e8', '#94a3b8', '#c7d0da'];
        return '<div class="row"><span class="nm">' + esc(x.n) + '</span><div class="bar" style="width:' + Math.max(30, x.v / maxv * 300) + 'px;background:' + colors[i % colors.length] + '">' + x.v + ' 起</div></div>';
      }).join('') + '</div>';
      body = '<div class="m2-grid2">' +
        card('三大监管方向预警占比', pieChart([{ l: '公卫与癌情监测', v: 28 }, { l: '医疗质量与执业合规', v: 44 }, { l: '数据汇聚与平台协同', v: 17 }], ['#2e90fa', '#d92d20', '#f79009'])) +
        card('Top 10 高频触发违规行为帕累托图', pareto) +
        '</div>' +
        card('专项治理建议', '<div class="m2-msg">靶向药"未检先开"占比 40%，建议由医政处、药政处联合启动【全区合理用药专项治理行动】，并对违规医生暂停限制级药物处方权。</div>');
    } else if (STATS_TAB === 3) {
      body = '<div class="m2-grid2">' +
        card('全区近 12 个月红黄牌预警发生量', lineChart([
          { l: '11月', v: 52 }, { l: '12月', v: 48 }, { l: '1月', v: 55 }, { l: '2月', v: 41 },
          { l: '3月', v: 46 }, { l: '4月', v: 38 }, { l: '5月', v: 35 }, { l: '6月', v: 31 },
          { l: '7月', v: 29 }, { l: '8月', v: 26 }, { l: '9月', v: 24 }, { l: '10月', v: 22 }
        ], '#d92d20'), '监管治理成效：逐月显著下降') +
        card('全区治疗前病理确诊率逐月改善收敛', lineChart([
          { l: '11月', v: 84.1 }, { l: '12月', v: 85.3 }, { l: '1月', v: 86.0 }, { l: '2月', v: 86.8 },
          { l: '3月', v: 87.5 }, { l: '4月', v: 88.2 }, { l: '5月', v: 89.0 }, { l: '6月', v: 89.4 },
          { l: '7月', v: 90.1 }, { l: '8月', v: 90.8 }, { l: '9月', v: 91.5 }, { l: '10月', v: 92.1 }
        ], '#12b76a'), '已收敛至考核线 90% 之上') +
        '</div>' +
        kpis([
          { l: '医院"吃牌率"环比', v: '-8.7%', m: '连续 4 个月下降', tone: 'green' },
          { l: '红牌发生量同比', v: '-31%', m: '去年同期 32 起', tone: 'green' },
          { l: '用于汇报', v: '可直接导出', m: '向主管市长/省卫健委汇报监管政绩' }
        ]);
    } else if (STATS_TAB === 4) {
      var zones = [
        { n: '东湖区', ok: 82, done: 91, loss: 41 },
        { n: '西湖区', ok: 88, done: 86, loss: 38 },
        { n: '青云谱区', ok: 76, done: 78, loss: 55 },
        { n: '青山湖区', ok: 79, done: 84, loss: 52 },
        { n: '新建区', ok: 71, done: 69, loss: 63 },
        { n: '南昌县', ok: 68, done: 64, loss: 66 },
        { n: '进贤县', ok: 74, done: 72, loss: 58 },
        { n: '安义县', ok: 85, done: 83, loss: 44 }
      ];
      var tr = zones.map(function (z) {
        return '<tr><td>' + esc(z.n) + ' 卫健局</td><td class="num">' + z.ok + '%</td><td class="num">' + z.done + '%</td><td class="num">' + z.loss + '%</td><td class="ops">' + btn('下钻', 'drill', z.n) + '</td></tr>';
      }).join('');
      body = '<div class="m2-grid13">' +
        card('各区县早筛任务完成率横向对比', stackedBar(zones.map(function (z) { return { l: z.n, r: Math.round(z.done / 100 * 12), y: Math.round((88 - z.ok) / 100 * 12), b: Math.round(z.ok / 100 * 12) }; }))) +
        card('区县横向平衡分析表', table(['区县卫健局', '#早诊率达标率', '#早筛完成率', '#基层高危失管率', '操作'], tr)) +
        '</div>' +
        '<div class="m2-msg">用于季度例会对各区县卫健局局长横向评比与约谈；新建区、南昌县两片早诊率低于 55% 红线（图中红段占比高）。</div>';
    } else {
      var funnelData = [
        { n: '待成案', v: 4, c: '#3538cd' }, { n: '待签收', v: 2, c: '#7fb4e8' },
        { n: '整改中', v: 9, c: '#1849a9' }, { n: '待审核', v: 3, c: '#f79009' },
        { n: '已逾期', v: 2, c: '#b42335' }, { n: '已销号', v: 18, c: '#12b76a' }
      ];
      var funnel = '<div class="m2-funnel">' + funnelData.map(function (f) {
        return '<div class="row"><span class="nm">' + esc(f.n) + '</span><div class="bar" style="width:' + Math.max(18, f.v / 18 * 260) + 'px;background:' + f.c + '">' + f.v + '</div></div>';
      }).join('') + '</div>';
      body = '<div class="m2-grid2">' +
        card('督办工单状态漏斗分布', funnel) +
        card('自动销号 vs 人工审结', pieChart([{ l: '系统自动销号', v: 67 }, { l: '人工审结', v: 28 }, { l: '申诉结案', v: 5 }], ['#2e90fa', '#244765', '#94a3b8'])) +
        '</div>' +
        kpis([
          { l: '自动销号比例', v: '67%', m: '底层数据自动复核达标', tone: 'green' },
          { l: '平均办结时长', v: '6.4 天', m: '环比 -1.2 天', tone: 'green' },
          { l: '申诉成功率', v: '55%', m: '防止行政积压', tone: 'blue' }
        ]);
    }
    var heatOrgs = ['上饶市立医院', '赣州市肿瘤医院', '南昌县定点医院群', '九江市第二人民', '景德镇市第一人民'];
    var heatRules = ['DIR1-01', 'DIR1-03', 'DIR2-01', 'DIR2-02', 'DIR2-03', 'DIR3-01', 'DIR3-02'];
    var heatData = [
      [3, 1, 4, 1, 0, 2, 2],
      [1, 2, 2, 4, 1, 1, 2],
      [4, 3, 1, 1, 0, 0, 1],
      [1, 0, 1, 1, 1, 3, 1],
      [0, 1, 2, 0, 1, 1, 3]
    ];
    function heatColor(v) {
      if (v >= 4) return '#fee4e2';
      if (v >= 3) return '#ffe8e1';
      if (v >= 2) return '#fef0c7';
      if (v >= 1) return '#fff9e8';
      return '#ffffff';
    }
    var heat = '<table class="m2-heat"><thead><tr><th style="text-align:left">机构 \\ 规则</th>' + heatRules.map(function (r) { return '<th>' + r + '</th>'; }).join('') + '</tr></thead><tbody>' +
      heatData.map(function (row, i) {
        return '<tr><td class="rowhd">' + esc(heatOrgs[i]) + '</td>' + row.map(function (v, j) {
          return '<td class="cell" style="background:' + heatColor(v) + '" data-m2="drill" data-arg="' + esc(heatOrgs[i] + ' × ' + heatRules[j]) + '">' + (v || '') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
    return heads('预警统计与报表中心', '五大维度统计分析 · 交叉热力矩阵 · 一键生成法定监管通报月报') +
      tabs + body +
      '<div class="m2-grid13">' +
      card('机构 × 规则 预警频次交叉热力矩阵', heat + '<div class="m2-msg" style="margin-top:8px">点击任一单元格瞬间下钻至预警记录台账展示明细个案。</div>') +
      '<div>' +
      card('一键生成行政通报报表',
        '<div class="m2-filter" style="grid-template-columns:1fr 1fr">' +
        '<div class="fg"><label>统计月份</label><select><option>2026 年 10 月</option><option>2026 年 9 月</option><option>2026 年 Q3</option></select></div>' +
        '<div class="fg"><label>报表格式</label><select><option>Word（上报委主任办公会）</option><option>PDF</option><option>Excel</option></select></div>' +
        '<div class="acts">' + btn('一键生成通报分析报告', 'report', '2026-10', true) + '</div></div>' +
        '<div class="m2-msg">系统自动组装：机构预警总数排行、红黑榜名单、高发违规问题前三名、未整改逾期机构名单，渲染为《全区肿瘤医疗质量与公卫早筛监管月报》。</div>') +
      card('本月红黑榜速览', '<div class="m2-kv">' +
        '<div class="k">红榜（0 红牌）</div><div class="v" style="color:#127d3f">安义县卫健局 · 进贤县卫健局</div>' +
        '<div class="k">黑榜（红牌最多）</div><div class="v" style="color:#b42335">上饶市立医院（5红）</div>' +
        '<div class="k">逾期未整改</div><div class="v" style="color:#b42335">上饶市立医院 · 鹰潭市人民医院</div>' +
        '</div>') +
      '</div></div>';
  }

  /* ==================== 页面 4：机构端·医院整改协同工作台 ==================== */
  function renderHospital() {
    var mine = ORDERS.filter(function (o) { return ['机构已签收·整改中', '机构已整改·待审核', '整改逾期·红色追责'].indexOf(o.st) >= 0; });
    var tr = mine.map(function (o) {
      return '<tr><td>' + esc(o.no) + '</td><td>' + esc(o.rule) + '</td><td>' + lvBadge(o.lv) + '</td><td>' + stBadge(o.st) + '</td><td>' + esc(o.ddl) + '</td><td>' + esc(o.days) + '</td><td class="ops">' + btn('拆解分派', 'assign', o.no) + ' ' + btn('填写整改总结', 'submit', o.no, true) + '</td></tr>';
    }).join('');
    return heads('机构端 · 医院整改协同工作台', '医院院长/医务处：签收督办单 → 拆解分派临床科室自查 → 在线填写整改总结 → 上传佐证 → 分管副院长电子签章提报') +
      kpis([
        { l: '本院在办督办单', v: String(mine.length), m: '含逾期 0 件', tone: 'blue' },
        { l: '整改完成率', v: '83%', m: '本年度累计', tone: 'green' },
        { l: '平均签收时长', v: '1.2 天', m: '要求 ≤3 个工作日', tone: 'green' },
        { l: '累计吃牌', v: '红2 黄3', m: '挂钩年度绩效考核', tone: 'yellow' }
      ]) +
      card('待整改督办单', table(['公文编号', '触发规则', '等级', '状态', '整改期限', '时限/剩余', '操作'], tr)) +
      '<div class="m2-grid2">' +
      card('院内拆解分派', '<div class="m2-msg">医务处将督办单拆解至涉事临床科室自查（如：药学部→限制级用药台账复核；病案室→电子病历结构化补录）。科室负责人在系统内接单并反馈。</div>') +
      card('整改提报要求', '<div class="m2-msg">在线填写《整改总结》并上传：自查病历清单、制度修订文件、外院凭证或系统修复佐证（前置机日志截图等）。提报后进入局端待审核队列，审核不通过将退回重改且时限不顺延。</div>') +
      '</div>';
  }

  /* ==================== 页面 5：预警规则库 ==================== */
  function renderRules() {
    var tr = RULES.map(function (x) {
      return '<tr><td style="white-space:nowrap">' + esc(x.no) + '</td><td>' + esc(x.dir) + '</td><td style="max-width:260px">' + esc(x.name) + '</td><td>' + lvBadge(x.lv.replace(/（.*?）/, '')) + '<span style="font-size:11px;color:#94a3b8">' + esc(x.lv.match(/（.*?）/) ? x.lv.match(/（.*?）/)[0] : '') + '</span></td><td style="max-width:220px">' + esc(x.scope) + '</td><td class="num" style="white-space:nowrap">' + esc(x.limit) + '</td><td>' + esc(x.freq) + '</td><td style="max-width:200px;font-size:12px">' + esc(x.std) + '</td><td class="ops">' + btn('判定规则', 'rule', x.no) + '</td></tr>';
    }).join('');
    return heads('三大方向预警指标库与行政触发标准', '按疾控处 / 医政处 / 信息统计处职能分工构建 13 条核心预警规则，锁定辖区医疗机构与下级卫健行政区划') +
      kpis([
        { l: '方向一 · 公卫与癌情监测', v: '4', m: 'DIR1-01 ~ DIR1-04', tone: 'blue' },
        { l: '方向二 · 医疗质量与合规', v: '4', m: 'DIR2-01 ~ DIR2-04', tone: 'yellow' },
        { l: '方向三 · 数据汇聚与协同', v: '4', m: 'DIR3-01 ~ DIR3-03', tone: 'green' },
        { l: '全程督办追责', v: '1', m: 'DIR3-04 红色追责', tone: 'red' }
      ]) +
      card('预警矩阵总览', table(['预警编号', '监管方向', '核心预警指标', '预警等级', '涉及处室与监管对象', '行政督办要求（整改时限）', '跑批频率', '考核阈值', '操作'], tr, 1400));
  }

  function openRuleModal(no) {
    closeAll();
    var r = RULES.filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var mask = document.createElement('div');
    mask.className = 'm2-modal-mask';
    mask.innerHTML = '<div class="m2-modal"><div class="hd"><span class="t">' + esc(r.no) + ' · 触发判定详细规则</span><button class="x" data-m2="close">×</button></div><div class="bd">' +
      '<div class="m2-kv">' +
      '<div class="k">指标名称</div><div class="v">' + esc(r.name) + '</div>' +
      '<div class="k">预警等级</div><div class="v">' + lvBadge(r.lv.replace(/（.*?）/, '')) + ' ' + esc(r.lv) + '</div>' +
      '<div class="k">监管对象</div><div class="v">' + esc(r.scope) + '</div>' +
      '<div class="k">督办时限</div><div class="v">' + esc(r.limit) + '</div>' +
      '<div class="k">跑批频率</div><div class="v">' + esc(r.freq) + '</div>' +
      '</div>' +
      card('触发判定公式', '<div class="m2-msg" style="font-size:13px;color:#1f2937">' + esc(r.formula) + '</div>') +
      card('考核标准阈值', '<div class="m2-msg" style="font-size:13px;color:#1f2937">' + esc(r.std) + '</div>') +
      '</div></div>';
    mask.addEventListener('click', function (ev) { if (ev.target === mask) closeAll(); });
    document.body.appendChild(mask);
  }

  /* ---------------- 路由与导出 ---------------- */
  var ROUTES = {
    'm2-hall': renderHall,
    'm2-records': renderRecords,
    'm2-stats': renderStats,
    'm2-hospital': renderHospital,
    'm2-rules': renderRules
  };
  function renderPage(id) { return ROUTES[id] ? ROUTES[id]() : null; }

  /* ---------------- 交互 ---------------- */
  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-m2]') : null;
    if (!el) return;
    var action = el.getAttribute('data-m2');
    var arg = el.getAttribute('data-arg') || '';
    switch (action) {
      case 'close': closeAll(); return;
      case 'reset': toast('已重置筛选条件'); return;
      case 'query': toast('查询成功，已按当前条件刷新台账'); return;
      case 'halldept': HALL_DEPT = arg; if (window.navigateTo) window.navigateTo('m2-hall'); return;
      case 'statstab': STATS_TAB = parseInt(arg, 10) || 1; if (window.navigateTo) window.navigateTo('m2-stats'); return;
      case 'drawer': openRecordDrawer(arg); return;
      case 'rule': openRuleModal(arg); return;
      case 'pdf': toast('已生成《预警事件档案 PDF》并开始下载（演示）'); return;
      case 'drill': toast('已下钻至预警记录台账：' + arg + ' 明细个案'); if (window.navigateTo) window.navigateTo('m2-records'); return;
      case 'dispatch': toast('已调取脱敏证据链并生成红头督办单 ' + arg + '，等待处长电子签名（演示）'); return;
      case 'review': toast('已打开医院《自查整改报告》审核页：' + arg + '（演示）'); return;
      case 'reject': toast('已退回重改，整改时限不顺延：' + arg); return;
      case 'archive': toast('已打开结案归档卷宗：' + arg + '（演示）'); return;
      case 'evidence': toast('已调取脱敏证据链：' + arg + '（演示）'); return;
      case 'summon': toast('已向 ' + arg + ' 主要领导发起行政约谈，并通报全区'); return;
      case 'assign': toast('已打开院内拆解分派表单：' + arg + '（演示）'); return;
      case 'submit': toast('已打开《整改总结》在线填写页，提交后由分管副院长电子签章（演示）'); return;
      case 'report': toast('正在组装《全区肿瘤医疗质量与公卫早筛监管月报（' + arg + '）》：机构排行、红黑榜、高发问题前三、逾期名单 → Word 渲染完成，开始下载（演示）'); return;
    }
  });

  if (typeof window !== 'undefined') {
    window.monitor2PageIds = Object.keys(ROUTES);
    window.renderMonitor2Page = renderPage;
  }
})();
