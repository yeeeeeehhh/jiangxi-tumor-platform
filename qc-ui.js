/* ============================================================================
 * qc-ui.js — 质控管理 · 共用渲染层
 *
 * 只做渲染，不算业务数字。所有取数一律回到 window.qcSpine。
 * 提供：页头/面包屑/KPI 卡/卡片/表格/筛选条/分页/徽标/弹窗/柱状/折线/时间轴。
 *
 * 暴露：window.qcUI
 * ========================================================================== */
(function () {
  'use strict';

  var S = window.qcSpine;
  var esc = S.esc, fmt = S.fmt;

  /* ==================== 样式（统一 qc- 前缀，避免污染全站） ==================== */
  var CSS = [
    '#pageContainer .qc-page{min-width:0}',
    /* 页头 */
    '#pageContainer .qc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px}',
    '#pageContainer .qc-head .t{font-size:20px;font-weight:700;color:#182230;line-height:1.25}',
    '#pageContainer .qc-head .s{margin-top:5px;font-size:12px;color:#667085;line-height:1.55}',
    '#pageContainer .qc-head .acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
    '#pageContainer .qc-tag{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:4px;background:#e8f2ff;color:#244765;font-size:12px;font-weight:600;white-space:nowrap}',
    '#pageContainer .qc-tag.l1{background:#e8f2ff;color:#244765}',
    '#pageContainer .qc-tag.l2{background:#fdf0e6;color:#9a5b1a}',
    '#pageContainer .qc-tag.l3{background:#eaf7ec;color:#2b6b34}',
    '#pageContainer .qc-tag.l4{background:#f0eafb;color:#5b3fa0}',
    '#pageContainer .qc-tag.l5{background:#fdecef;color:#a3253b}',
    /* 筛选条 */
    /* 筛选条：字段数不固定（1~6），列数由 JS 按实际字段数设置 --qc-fcols，
       否则固定 6 列时 4 个字段会空出两列、把「重置/查询」挤到第二行。 */
    '#pageContainer .qc-filter{display:grid;grid-template-columns:repeat(var(--qc-fcols,4),minmax(0,1fr)) auto;gap:10px;align-items:end;padding:13px 15px;background:#f8fafc;border:1px solid var(--border);border-radius:8px;margin-bottom:14px}',
    '#pageContainer .qc-filter .fg{display:flex;flex-direction:column;gap:5px;min-width:0}',
    '#pageContainer .qc-filter .fg label{font-size:12px;color:#475569;font-weight:600}',
    '#pageContainer .qc-filter select,#pageContainer .qc-filter input{width:100%;height:34px;padding:0 9px;border:1px solid #d1d8e0;border-radius:5px;background:#fff;color:#1f2937;font-size:13px;box-sizing:border-box}',
    /* .acts 是 grid item：默认 stretch 会被同行 .fg（label+控件≈53px）拉高，
       窄屏独占一行时就会在按钮下方露出空白带。固定自身高度并底对齐即可。 */
    '#pageContainer .qc-filter .acts{display:flex;justify-content:flex-end;align-items:center;gap:8px;grid-column:auto;align-self:end;height:34px}',
    '#pageContainer .qc-filter .acts .btn{height:34px}',
    /* KPI */
    '#pageContainer .qc-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:16px}',
    '#pageContainer .qc-kpis.g3{grid-template-columns:repeat(3,minmax(0,1fr))}',
    '#pageContainer .qc-kpis.g4{grid-template-columns:repeat(4,minmax(0,1fr))}',
    '#pageContainer .qc-kpis.g5{grid-template-columns:repeat(5,minmax(0,1fr))}',
    '#pageContainer .qc-kpi{background:#fff;border:1px solid var(--border);border-radius:8px;padding:13px 15px;cursor:default}',
    '#pageContainer .qc-kpi.click{cursor:pointer;transition:box-shadow .16s,border-color .16s}',
    '#pageContainer .qc-kpi.click:hover{border-color:#9dc0e8;box-shadow:0 3px 12px rgba(36,71,101,.1)}',
    '#pageContainer .qc-kpi .l{font-size:12px;color:#667085;line-height:1.4;min-height:17px}',
    '#pageContainer .qc-kpi .v{margin-top:5px;font-size:23px;font-weight:700;color:#182230;font-variant-numeric:tabular-nums;line-height:1.15}',
    '#pageContainer .qc-kpi .v.up{color:#2e7d32}#pageContainer .qc-kpi .v.warn{color:#b54708}',
    '#pageContainer .qc-kpi .v.bad{color:#b42335}#pageContainer .qc-kpi .v.info{color:#244765}',
    '#pageContainer .qc-kpi .v em{font-size:12px;font-style:normal;font-weight:600;color:#94a3b8;margin-left:3px}',
    '#pageContainer .qc-kpi .m{margin-top:5px;font-size:11px;color:#94a3b8;min-height:15px;line-height:1.45}',
    '#pageContainer .qc-kpi .m b{color:#475569;font-weight:600}',
    /* 卡片 */
    '#pageContainer .qc-card{background:#fff;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px}',
    '#pageContainer .qc-card .hd{min-height:44px;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 15px;border-bottom:1px solid var(--border);flex-wrap:wrap}',
    '#pageContainer .qc-card .hd .t{font-size:14px;font-weight:700;color:#1f2937}',
    '#pageContainer .qc-card .hd .sub{font-size:11px;font-weight:400;color:#94a3b8;margin-left:8px}',
    '#pageContainer .qc-card .hd .tools{display:flex;gap:6px;align-items:center}',
    '#pageContainer .qc-card .bd{padding:14px 16px}',
    '#pageContainer .qc-card .bd.flush{padding:0}',
    '#pageContainer .qc-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}',
    '#pageContainer .qc-grid13{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:14px;align-items:start}',
    /* 表格 */
    '#pageContainer .qc-tw{overflow-x:auto}',
    '#pageContainer table.qc-tbl{width:100%;min-width:900px;border-collapse:collapse}',
    '#pageContainer table.qc-tbl th{height:40px;padding:0 12px;background:#f8fafc;border-bottom:1px solid var(--border);color:#5b6673;font-size:12px;font-weight:600;text-align:left;white-space:nowrap}',
    '#pageContainer table.qc-tbl td{height:46px;padding:7px 12px;border-bottom:1px solid #eef2f7;color:#334155;font-size:13px;vertical-align:middle}',
    '#pageContainer table.qc-tbl tbody tr:hover{background:#f7fbff}',
    '#pageContainer table.qc-tbl tbody tr:last-child td{border-bottom:0}',
    '#pageContainer table.qc-tbl td.num,#pageContainer table.qc-tbl th.num{text-align:right;font-variant-numeric:tabular-nums}',
    '#pageContainer table.qc-tbl td.mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}',
    '#pageContainer table.qc-tbl tr.abn-row{background:#fffbfb}',
    '#pageContainer table.qc-tbl.compact td{height:40px;font-size:12.5px}',
    '#pageContainer .qc-link{background:none;border:0;padding:0;color:var(--primary);font-weight:600;font-size:13px;cursor:pointer;font-family:inherit}',
    '#pageContainer .qc-link:hover{text-decoration:underline}',
    '#pageContainer .qc-link.mut{color:#64748b;font-weight:500}',
    /* 分页 / 空态 */
    '#pageContainer .qc-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 15px;font-size:12px;color:#64748b;border-top:1px solid var(--border)}',
    '#pageContainer .qc-pager{display:inline-flex;align-items:center;gap:6px}',
    '#pageContainer .qc-pager b{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 6px;border-radius:4px;background:var(--primary);color:#fff;font-weight:600}',
    '#pageContainer .qc-empty{padding:38px;text-align:center;color:#94a3b8;font-size:13px}',
    /* 图表 */
    '#pageContainer .qc-bar{display:flex;align-items:flex-end;gap:8px;height:180px;padding:10px 6px 2px}',
    '#pageContainer .qc-bar .col{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px}',
    '#pageContainer .qc-bar .val{font-size:11px;font-weight:600;color:#334155;font-variant-numeric:tabular-nums}',
    '#pageContainer .qc-bar .track{width:100%;max-width:42px;flex:1;display:flex;align-items:flex-end;background:#f1f5f9;border-radius:4px 4px 0 0;overflow:hidden}',
    '#pageContainer .qc-bar .fill{width:100%;border-radius:4px 4px 0 0;background:#244765}',
    '#pageContainer .qc-bar .lab{font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
    '#pageContainer .qc-line{width:100%;height:auto;display:block}',
    /* 进度条 */
    '#pageContainer .qc-prog{display:flex;align-items:center;gap:8px;min-width:110px}',
    '#pageContainer .qc-prog .bar{flex:1;height:6px;border-radius:3px;background:#eef2f7;overflow:hidden}',
    '#pageContainer .qc-prog .bar i{display:block;height:100%;border-radius:3px;background:var(--primary)}',
    '#pageContainer .qc-prog .pc{font-size:12px;color:#475569;font-variant-numeric:tabular-nums;min-width:38px;text-align:right}',
    /* 键值 / 定义块 */
    '#pageContainer .qc-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px 18px}',
    '#pageContainer .qc-kv.c3{grid-template-columns:repeat(3,minmax(0,1fr))}',
    '#pageContainer .qc-kv .k{font-size:12px;color:#667085}',
    '#pageContainer .qc-kv .vl{font-size:13px;font-weight:600;color:#1f2937;margin-top:2px;word-break:break-all}',
    '#pageContainer .qc-note{padding:11px 13px;background:#f8fafc;border:1px solid #e6edf5;border-left:3px solid var(--primary);border-radius:0 6px 6px 0;font-size:12.5px;color:#475569;line-height:1.65}',
    '#pageContainer .qc-note.warn{background:#fffbf5;border-color:#f0e0c8;border-left-color:#d98b2b}',
    '#pageContainer .qc-def{font-size:13px;color:#334155;line-height:1.7}',
    '#pageContainer .qc-def b{color:#1f2937}',
    /* 时间轴 */
    '#pageContainer .qc-tl{position:relative;padding:6px 0 2px 0}',
    '#pageContainer .qc-tl:before{content:"";position:absolute;left:9px;top:14px;bottom:14px;width:2px;background:#e6edf5}',
    '#pageContainer .qc-tl .it{position:relative;padding:0 0 16px 34px}',
    '#pageContainer .qc-tl .it:last-child{padding-bottom:0}',
    '#pageContainer .qc-tl .dot{position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid var(--primary)}',
    '#pageContainer .qc-tl .it.ok .dot{background:var(--primary)}',
    '#pageContainer .qc-tl .it.miss .dot{border-color:#d98b2b;background:#fff}',
    '#pageContainer .qc-tl .it.bad .dot{border-color:#d1435b;background:#d1435b}',
    '#pageContainer .qc-tl .tt{font-size:13px;font-weight:600;color:#1f2937}',
    '#pageContainer .qc-tl .dd{font-size:12px;color:#64748b;margin-top:3px;line-height:1.6}',
    '#pageContainer .qc-tl .dt{font-size:12px;color:#94a3b8;font-variant-numeric:tabular-nums;margin-top:2px}',
    /* 判定块 */
    '#pageContainer .qc-judge{border:1px solid #e6edf5;border-radius:8px;overflow:hidden}',
    '#pageContainer .qc-judge .row{display:grid;grid-template-columns:120px minmax(0,1fr);border-bottom:1px solid #eef2f7}',
    '#pageContainer .qc-judge .row:last-child{border-bottom:0}',
    '#pageContainer .qc-judge .row .k{padding:10px 13px;background:#f8fafc;font-size:12px;color:#667085;font-weight:600}',
    '#pageContainer .qc-judge .row .v{padding:10px 13px;font-size:13px;color:#334155;line-height:1.6}',
    '#pageContainer .qc-judge .row.res .v{font-weight:700}',
    '#pageContainer .qc-judge .row.res .v.bad{color:#b42335}#pageContainer .qc-judge .row.res .v.ok{color:#2e7d32}',
    /* 分层数据（质控相关 → 标准化 → 原始） */
    '#pageContainer .qc-layer{border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:12px;background:#fff}',
    '#pageContainer .qc-layer .lh{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;background:#f8fafc;border-bottom:1px solid var(--border);cursor:pointer}',
    '#pageContainer .qc-layer .lh .lt{font-size:13px;font-weight:700;color:#1f2937}',
    '#pageContainer .qc-layer .lh .ls{font-size:11px;color:#94a3b8;font-weight:400;margin-left:8px}',
    '#pageContainer .qc-layer .lh .ar{font-size:11px;color:#94a3b8}',
    '#pageContainer .qc-layer .lb{padding:0}',
    '#pageContainer .qc-layer.collapsed .lb{display:none}',
    /* 内联标签页 */
    '#pageContainer .qc-tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:14px;flex-wrap:wrap}',
    '#pageContainer .qc-tabs button{height:36px;padding:0 14px;border:0;background:none;font-size:13px;color:#64748b;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit;font-weight:600}',
    '#pageContainer .qc-tabs button.on{color:var(--primary);border-bottom-color:var(--primary)}',
    /* 分段器 */
    '#pageContainer .qc-seg{display:inline-flex;border:1px solid #d1d8e0;border-radius:5px;overflow:hidden}',
    '#pageContainer .qc-seg button{height:28px;padding:0 11px;border:0;background:#fff;font-size:12px;color:#475569;cursor:pointer;font-family:inherit;border-right:1px solid #e6edf5}',
    '#pageContainer .qc-seg button:last-child{border-right:0}',
    '#pageContainer .qc-seg button.on{background:var(--primary);color:#fff}',
    /* 矩阵热力 */
    '#pageContainer table.qc-matrix{width:100%;border-collapse:separate;border-spacing:2px;min-width:760px}',
    '#pageContainer table.qc-matrix th{padding:6px 8px;font-size:11px;color:#5b6673;font-weight:600;white-space:nowrap;text-align:center}',
    '#pageContainer table.qc-matrix th.rh{text-align:left;position:sticky;left:0;background:#fff;z-index:1}',
    '#pageContainer table.qc-matrix td.rh{font-size:12px;color:#334155;font-weight:600;white-space:nowrap;padding:6px 10px;text-align:left;position:sticky;left:0;background:#fff;z-index:1}',
    '#pageContainer table.qc-matrix td.cell{text-align:center;font-variant-numeric:tabular-nums;cursor:pointer;font-size:12px;font-weight:600;padding:8px 6px;border-radius:4px;transition:transform .1s}',
    '#pageContainer table.qc-matrix td.cell:hover{transform:scale(1.06);box-shadow:0 0 0 2px rgba(36,71,101,.25)}',
    '#pageContainer .qc-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:#94a3b8;padding:8px 4px 0}',
    '#pageContainer .qc-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}',
    /* 结论洞察横幅 */
    '#pageContainer .qc-insight{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:8px;background:linear-gradient(180deg,#f5f9ff,#eef4fb);border:1px solid #dce8f6;margin-bottom:16px}',
    '#pageContainer .qc-insight.good{background:linear-gradient(180deg,#f2faf3,#eaf6ec);border-color:#cfe8d3}',
    '#pageContainer .qc-insight.warn{background:linear-gradient(180deg,#fffaf3,#fdf3e6);border-color:#f0e0c8}',
    '#pageContainer .qc-insight.bad{background:linear-gradient(180deg,#fdf5f6,#fbecef);border-color:#f2d3da}',
    '#pageContainer .qc-insight .ic{flex:none;width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:17px;background:#fff;border:1px solid rgba(0,0,0,.05)}',
    '#pageContainer .qc-insight .bd{flex:1;min-width:0}',
    '#pageContainer .qc-insight .tt{font-size:13.5px;font-weight:700;color:#1f2937;margin-bottom:4px}',
    '#pageContainer .qc-insight .dd{font-size:12.5px;color:#475569;line-height:1.7}',
    '#pageContainer .qc-insight .dd b{color:#182230}',
    '#pageContainer .qc-insight .dd .up{color:#2e7d32;font-weight:700}',
    '#pageContainer .qc-insight .dd .dn{color:#b42335;font-weight:700}',
    /* 评级卡 */
    '#pageContainer .qc-score{display:flex;align-items:center;gap:16px;padding:16px 18px}',
    '#pageContainer .qc-score .ring{flex:none}',
    '#pageContainer .qc-score .meta{flex:1;min-width:0}',
    '#pageContainer .qc-score .grade{font-size:26px;font-weight:800;line-height:1;letter-spacing:.5px}',
    '#pageContainer .qc-score .gl{font-size:12px;color:#667085;margin-top:6px;line-height:1.6}',
    /* 达标差距条（diverging） */
    '#pageContainer .qc-dv{display:flex;flex-direction:column;gap:9px}',
    '#pageContainer .qc-dv .row{display:grid;grid-template-columns:120px 1fr 62px;align-items:center;gap:10px}',
    '#pageContainer .qc-dv .lb{font-size:12px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#pageContainer .qc-dv .tk{position:relative;height:16px;background:#f1f5f9;border-radius:3px}',
    '#pageContainer .qc-dv .tk:before{content:"";position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;background:#c3ccd6}',
    '#pageContainer .qc-dv .fill{position:absolute;top:0;bottom:0;border-radius:3px}',
    '#pageContainer .qc-dv .vv{font-size:12px;font-variant-numeric:tabular-nums;text-align:right;font-weight:600}',
    /* 排名榜（好/差） */
    '#pageContainer .qc-rank{display:flex;flex-direction:column;gap:7px}',
    '#pageContainer .qc-rank .it{display:grid;grid-template-columns:22px 1fr auto;gap:9px;align-items:center;font-size:12.5px}',
    '#pageContainer .qc-rank .no{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;background:#94a3b8}',
    '#pageContainer .qc-rank .it.top .no{background:#2e7d32}#pageContainer .qc-rank .it.bot .no{background:#b42335}',
    '#pageContainer .qc-rank .nm{color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#pageContainer .qc-rank .vl{font-variant-numeric:tabular-nums;font-weight:700;color:#1f2937}',
    /* 弹窗 */
    '.qc-modal-mask{position:fixed;inset:0;z-index:1250;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.5)}',
    '.qc-modal{width:min(880px,96vw);max-height:88vh;display:flex;flex-direction:column;background:#fff;border-radius:10px;box-shadow:0 18px 50px rgba(15,23,42,.28)}',
    '.qc-modal .hd{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 18px;border-bottom:1px solid var(--border);flex:none}',
    '.qc-modal .hd .t{font-size:15px;font-weight:700;color:#1f2937}',
    '.qc-modal .x{width:28px;height:28px;border:0;border-radius:5px;background:#f2f4f7;color:#667085;font-size:16px;cursor:pointer;line-height:1}',
    '.qc-modal .x:hover{background:#e7ebf1;color:#1f2937}',
    '.qc-modal .bd{padding:16px 18px;overflow:auto;flex:1}',
    '.qc-modal .ft{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--border);background:#fbfcfe;flex:none}',
    /* Toast */
    '#qcToast{position:fixed;right:20px;bottom:20px;z-index:1400;display:flex;flex-direction:column;gap:8px}',
    '#qcToast .tt{background:#182230;color:#fff;padding:10px 16px;border-radius:6px;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.2);opacity:0;transform:translateY(6px);transition:opacity .2s,transform .2s}',
    '#qcToast .tt.on{opacity:1;transform:none}',
    /* 响应式 */
    /* 窄屏：字段按 3 列换行，操作按钮跨末行右对齐。
       注意 grid 上是 align-items:end，跨行的 .acts 会贴到该行底部，
       因此这里显式给 align-self:start，避免按钮与末行字段之间被拉出空白带。 */
    '@media(max-width:1280px){#pageContainer .qc-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}#pageContainer .qc-filter{grid-template-columns:repeat(3,minmax(0,1fr));row-gap:10px}#pageContainer .qc-filter .acts{grid-column:1/-1;justify-content:flex-end;align-self:end}}',
    '@media(max-width:900px){#pageContainer .qc-kpis,#pageContainer .qc-kpis.g5,#pageContainer .qc-kpis.g4{grid-template-columns:repeat(2,minmax(0,1fr))}#pageContainer .qc-grid2,#pageContainer .qc-grid13{grid-template-columns:1fr}#pageContainer .qc-filter{grid-template-columns:repeat(2,minmax(0,1fr))}#pageContainer .qc-filter .acts{grid-column:1/-1}#pageContainer .qc-kv,#pageContainer .qc-kv.c3{grid-template-columns:1fr}}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ==================== 基础件 ==================== */

  function badge(text, tone) {
    var m = {
      success: 'badge-success', info: 'badge-info', danger: 'badge-danger',
      warn: 'badge-caution', caution: 'badge-caution', orange: 'badge-orange',
      accent: 'badge-accent', neutral: 'badge-neutral'
    };
    return '<span class="badge ' + (m[tone] || m.neutral) + '">' + esc(text) + '</span>';
  }
  function link(text, action) {
    return '<button class="qc-link" data-qc="' + esc(action) + '">' + esc(text) + '</button>';
  }
  function btn(text, action, cls) {
    return '<button class="btn ' + (cls || 'btn-ghost btn-sm') + '" data-qc="' + esc(action) + '">' + esc(text) + '</button>';
  }
  function verdictBadge(v) {
    return badge(S.V_LABEL[v] || v, S.V_TONE[v] || 'neutral');
  }
  function statusBadge(st) {
    var m = {
      '待处理': 'caution', '整改中': 'orange', '待复核': 'accent', '已关闭': 'success', '已逾期': 'danger',
      '已完成': 'success', '进行中': 'info', '未开始': 'neutral', '待下发': 'neutral',
      '正常': 'success', '告警': 'caution', '异常': 'danger'
    };
    return badge(st, m[st] || 'neutral');
  }

  /* 页头。layer: l1..l5 决定标签配色 */
  function head(title, sub, layer, layerName, acts) {
    return '<div class="qc-head"><div><div class="t">' + esc(title) + '</div>' +
      (sub ? '<div class="s">' + esc(sub) + '</div>' : '') + '</div>' +
      '<div class="acts"><span class="qc-tag ' + (layer || '') + '">' + esc(layerName || '质控管理') + '</span>' +
      (acts || '') + '</div></div>';
  }

  function kpis(items, cols) {
    var g = cols === 3 ? 'g3' : cols === 4 ? 'g4' : cols === 5 ? 'g5' : '';
    return '<div class="qc-kpis ' + g + '">' + items.map(function (x) {
      var tc = x.tone || '';
      var act = x.action ? ' data-qc="' + esc(x.action) + '"' : '';
      return '<div class="qc-kpi' + (x.action ? ' click' : '') + '"' + act + '>' +
        '<div class="l">' + esc(x.l) + '</div>' +
        '<div class="v ' + tc + '">' + esc(x.v) + (x.unit ? '<em>' + esc(x.unit) + '</em>' : '') + '</div>' +
        '<div class="m">' + (x.m || '') + '</div></div>';
    }).join('') + '</div>';
  }

  function card(title, body, sub, tools, flush) {
    return '<div class="qc-card"><div class="hd"><span class="t">' + esc(title) +
      (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</span>' +
      (tools ? '<span class="tools">' + tools + '</span>' : '') + '</div>' +
      '<div class="bd' + (flush ? ' flush' : '') + '">' + body + '</div></div>';
  }

  /* 表格。# 前缀 → 右对齐数字列；cells 可以是字符串或 {h:html, cls, raw} */
  function table(headers, rows, opt) {
    opt = opt || {};
    var th = headers.map(function (h) {
      var t = String(h), num = t.charAt(0) === '#';
      return '<th class="' + (num ? 'num' : '') + '">' + esc(t.replace(/^#/, '')) + '</th>';
    }).join('');
    var body = rows.length ? rows.map(function (r) {
      var cells = r.cells || r;
      var cls = r.cls || '';
      return '<tr class="' + cls + '">' + cells.map(function (c, i) {
        if (c && typeof c === 'object') {
          return '<td class="' + (c.cls || '') + '">' + (c.h || '') + '</td>';
        }
        var isNum = String(headers[i]).charAt(0) === '#';
        return '<td class="' + (isNum ? 'num' : '') + '">' + (c == null ? '-' : esc(c)) + '</td>';
      }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="' + headers.length + '"><div class="qc-empty">' +
      esc(opt.empty || '暂无符合条件的记录') + '</div></td></tr>';
    return '<div class="qc-tw"><table class="qc-tbl' + (opt.compact ? ' compact' : '') + '"><thead><tr>' +
      th + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  /* 筛选条：fields = [{key,label,type:'select'|'text',options:[{v,l}],value,ph}] */
  function filterBar(fields, pageKey, extraActs) {
    var html = fields.map(function (f) {
      if (f.type === 'select') {
        var opts = (f.options || []).map(function (o) {
          var v = o.v == null ? o : o.v, l = o.l == null ? o : o.l;
          return '<option value="' + esc(v) + '"' + (String(f.value) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>';
        }).join('');
        return '<div class="fg"><label>' + esc(f.label) + '</label><select data-qcf="' + esc(f.key) + '">' + opts + '</select></div>';
      }
      return '<div class="fg"><label>' + esc(f.label) + '</label><input type="text" data-qcf="' + esc(f.key) +
        '" value="' + esc(f.value || '') + '" placeholder="' + esc(f.ph || '') + '"></div>';
    }).join('');
    return '<div class="qc-filter" style="--qc-fcols:' + Math.max(1, fields.length) + '">' + html + '<div class="acts">' +
      (extraActs || '') +
      btn('重置', 'filter:reset:' + pageKey) +
      '<button class="btn btn-primary btn-sm" data-qc="filter:apply:' + esc(pageKey) + '">查询</button>' +
      '</div></div>';
  }

  /* 分页条。动作格式统一为 "<pageKey>:page:<n>"，与各模块的点击监听一致。 */
  function pager(total, page, per, pageKey) {
    var max = Math.max(1, Math.ceil(total / per));
    if (page > max) page = max;
    var btns = '';
    for (var i = 1; i <= max && i <= 8; i++) {
      if (i === page) btns += '<b>' + i + '</b>';
      else btns += '<button class="btn btn-ghost" style="height:28px;padding:0 9px" data-qc="' + esc(pageKey) + ':page:' + i + '">' + i + '</button>';
    }
    if (max > 8) btns += '<span style="color:#94a3b8">…共 ' + max + ' 页</span>';
    return '<div class="qc-foot"><span>共 ' + fmt(total) + ' 条</span><span class="qc-pager">' + btns + '</span></div>';
  }
  /* 内存分页 */
  function slice(list, page, per) {
    var max = Math.max(1, Math.ceil(list.length / per));
    if (page > max) page = max;
    if (page < 1) page = 1;
    return { rows: list.slice((page - 1) * per, page * per), page: page, max: max, total: list.length };
  }

  /* 柱状图：data=[{l,v}], opt={unit,color,colors,fmt} */
  function barChart(data, opt) {
    opt = opt || {};
    var vals = data.map(function (d) { return Number(d.v) || 0; });
    var max = Math.max.apply(null, vals.concat([0.0001]));
    var colors = opt.colors || ['#244765', '#3d5a80', '#5b8def', '#7fb4e8', '#94c2d9', '#b0d0a2', '#e0a96d', '#d98b8b', '#9a7bc1', '#6da8c9', '#84a9ac', '#c9a0a0'];
    return '<div class="qc-bar" style="height:' + (opt.height || 180) + 'px">' + data.map(function (d, i) {
      var h = Math.max(3, Math.round((Number(d.v) || 0) / max * 100));
      var show = opt.fmt ? opt.fmt(d.v) : (d.v == null ? '-' : (Number(d.v) % 1 === 0 ? fmt(d.v) : S.f1(d.v)));
      return '<div class="col" title="' + esc(d.l + '：' + d.v) + '">' +
        '<div class="val">' + esc(show) + (opt.unit || '') + '</div>' +
        '<div class="track"><div class="fill" style="height:' + h + '%;background:' + (d.color || (opt.color || colors[i % colors.length])) + '"></div></div>' +
        '<div class="lab">' + esc(d.l) + '</div></div>';
    }).join('') + '</div>';
  }

  /* 折线图：points=[{l,v}]，支持多序列 series=[{name,points,color}] */
  function lineChart(points, opt) {
    opt = opt || {};
    var series = opt.series || [{ points: points, color: '#244765', name: '' }];
    var W = opt.w || 660, H = opt.h || 210, P = { t: 18, r: 16, b: 30, l: 42 };
    var all = [];
    series.forEach(function (s) { s.points.forEach(function (p) { all.push(Number(p.v) || 0); }); });
    var max = Math.max.apply(null, all.concat([1])), min = Math.min.apply(null, all.concat([0]));
    if (max === min) { max += 1; min = Math.max(0, min - 1); }
    var span = max - min;
    max += span * 0.08; min = Math.max(0, min - span * 0.08);
    var iw = W - P.l - P.r, ih = H - P.t - P.b;
    var n = series[0].points.length;
    function X(i) { return P.l + (n <= 1 ? iw / 2 : iw * i / (n - 1)); }
    function Y(v) { return P.t + ih - (v - min) / (max - min) * ih; }
    var grid = '', lab = '';
    for (var t = 0; t <= 4; t++) {
      var y = P.t + ih * t / 4, val = max - (max - min) * t / 4;
      grid += '<line x1="' + P.l + '" y1="' + y.toFixed(1) + '" x2="' + (W - P.r) + '" y2="' + y.toFixed(1) + '" stroke="#eef2f7"/>';
      lab += '<text x="' + (P.l - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="10" fill="#94a3b8">' +
        (val >= 100 ? Math.round(val) : val.toFixed(1)) + '</text>';
    }
    var xlabs = series[0].points.map(function (p, i) {
      if (n > 12 && i % 2 === 1) return '';
      return '<text x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="#94a3b8">' + esc(p.l) + '</text>';
    }).join('');
    var paths = series.map(function (s) {
      var pts = s.points.map(function (p, i) { return X(i).toFixed(1) + ',' + Y(Number(p.v) || 0).toFixed(1); }).join(' ');
      var dots = s.points.map(function (p, i) {
        return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(Number(p.v) || 0).toFixed(1) + '" r="2.8" fill="' + (s.color || '#244765') + '"/>';
      }).join('');
      return '<polyline points="' + pts + '" fill="none" stroke="' + (s.color || '#244765') +
        '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' + dots;
    }).join('');
    var legend = series.length > 1 ? '<div class="qc-legend">' + series.map(function (s) {
      return '<span><i style="background:' + (s.color || '#244765') + '"></i>' + esc(s.name || '') + '</span>';
    }).join('') + '</div>' : '';
    return '<svg class="qc-line" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
      grid + lab + paths + xlabs + '</svg>' + legend;
  }

  /* 进度条 */
  function progress(pct, tone) {
    var p = Math.max(0, Math.min(100, Number(pct) || 0));
    var color = tone || (p >= 90 ? '#2e7d32' : p >= 70 ? '#244765' : p >= 50 ? '#d98b2b' : '#d1435b');
    return '<div class="qc-prog"><span class="bar"><i style="width:' + p + '%;background:' + color + '"></i></span>' +
      '<span class="pc">' + S.f1(p) + '%</span></div>';
  }

  /* 键值块 */
  function kv(pairs, cols) {
    return '<div class="qc-kv' + (cols === 3 ? ' c3' : '') + '">' + pairs.map(function (p) {
      return '<div><div class="k">' + esc(p[0]) + '</div><div class="vl">' + (p[1] == null ? '-' : p[1]) + '</div></div>';
    }).join('') + '</div>';
  }

  /* 说明条 */
  function note(html, warn) {
    return '<div class="qc-note' + (warn ? ' warn' : '') + '">' + html + '</div>';
  }

  /* 两栏栅格（卡片并排） */
  function grid2(a, b) {
    return '<div class="qc-grid2">' + a + b + '</div>';
  }
  /* 主次两栏栅格 */
  function grid13(a, b) {
    return '<div class="qc-grid13">' + a + b + '</div>';
  }

  /* 规则判定块：回答"检查什么/依据什么规则/实际数据/为什么异常" */
  function judgeBlock(rule, actual, resText, reason) {
    var ok = resText === '符合';
    return '<div class="qc-judge">' +
      '<div class="row"><div class="k">质控规则</div><div class="v">' +
      (rule ? '<b>' + esc(rule.name) + '</b>' + (rule.code ? '（' + esc(rule.code) + '）' : '') : '-') + '</div></div>' +
      '<div class="row"><div class="k">规则版本</div><div class="v">' + esc(rule && rule.ver ? rule.ver : '-') + '</div></div>' +
      '<div class="row"><div class="k">检查字段</div><div class="v">' + esc(rule && rule.field ? rule.field : '-') + '</div></div>' +
      '<div class="row"><div class="k">判定条件</div><div class="v">' + esc(rule && rule.cond ? rule.cond : '-') + '</div></div>' +
      '<div class="row"><div class="k">实际数据</div><div class="v">' + (actual || '-') + '</div></div>' +
      '<div class="row res"><div class="k">系统判定</div><div class="v ' + (ok ? 'ok' : 'bad') + '">' + esc(resText || '-') + '</div></div>' +
      '<div class="row"><div class="k">异常原因</div><div class="v">' + (reason ? esc(reason) : '—') + '</div></div>' +
      '</div>';
  }

  /* 分层折叠块：质控相关数据 → 标准化数据 → 原始数据 */
  function layerBlock(title, sub, bodyHtml, collapsed, key) {
    return '<div class="qc-layer' + (collapsed ? ' collapsed' : '') + '" data-qck="' + esc(key || '') + '">' +
      '<div class="lh" data-qc="layer:toggle:' + esc(key || '') + '">' +
      '<span><span class="lt">' + esc(title) + '</span>' + (sub ? '<span class="ls">' + esc(sub) + '</span>' : '') + '</span>' +
      '<span class="ar">' + (collapsed ? '展开 ▾' : '收起 ▴') + '</span></div>' +
      '<div class="lb">' + bodyHtml + '</div></div>';
  }

  /* 时间轴：items=[{title,date,desc,state:'ok'|'miss'|'bad'}] */
  function timeline(items) {
    return '<div class="qc-tl">' + items.map(function (it) {
      return '<div class="it ' + (it.state || 'ok') + '"><span class="dot"></span>' +
        '<div class="tt">' + esc(it.title) + '</div>' +
        (it.date ? '<div class="dt">' + esc(it.date) + '</div>' : '') +
        (it.desc ? '<div class="dd">' + it.desc + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }

  /* 矩阵热力单元格着色 */
  function heat(value, dir, base) {
    if (value == null) return '';
    var good, bad, mid;
    if (dir === 'down') { good = value <= base * 0.8; bad = value >= base * 1.3; mid = !good && !bad; }
    else { good = value >= base + 3; bad = value <= base - 6; mid = !good && !bad; }
    if (good) return 'background:#eaf7ec;color:#2b6b34';
    if (bad) return 'background:#fdecef;color:#a3253b';
    return 'background:#fffbf5;color:#8a6314';
  }

  /* ==================== 分析型组件 ==================== */

  /* 结论洞察横幅：把"这堆数字说明了什么"直接讲出来。
     items=[{tone:'good|warn|bad|info', icon, tt, dd(html)}] */
  function insight(item) {
    var icon = item.icon || (item.tone === 'good' ? '✓' : item.tone === 'bad' ? '!' : item.tone === 'warn' ? '⚠' : 'ℹ');
    return '<div class="qc-insight ' + (item.tone || 'info') + '">' +
      '<div class="ic">' + icon + '</div>' +
      '<div class="bd"><div class="tt">' + item.tt + '</div>' +
      '<div class="dd">' + item.dd + '</div></div></div>';
  }
  function insights(list) { return list.map(insight).join(''); }

  /* 综合评级环：score 0~100 → 环形进度 + 等级字母 */
  function scoreRing(score, size) {
    size = size || 92;
    var s = Math.max(0, Math.min(100, Number(score) || 0));
    var grade = s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'E';
    var color = s >= 90 ? '#2e7d32' : s >= 80 ? '#3f8f4a' : s >= 70 ? '#d98b2b' : s >= 60 ? '#c9702a' : '#b42335';
    var r = (size - 12) / 2, cx = size / 2, circ = 2 * Math.PI * r;
    var off = circ * (1 - s / 100);
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="#eef2f7" stroke-width="9"/>' +
      '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="9" stroke-linecap="round" ' +
      'stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 ' + cx + ' ' + cx + ')"/>' +
      '<text x="' + cx + '" y="' + (cx - 4) + '" text-anchor="middle" font-size="' + (size * 0.30) + '" font-weight="800" fill="' + color + '">' + grade + '</text>' +
      '<text x="' + cx + '" y="' + (cx + 15) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#475569">' + S.f1(s) + '</text>' +
      '</svg>';
  }

  /* 评级卡：环 + 说明 */
  function scoreCard(score, title, lines) {
    return '<div class="qc-score"><div class="ring">' + scoreRing(score) + '</div>' +
      '<div class="meta"><div class="grade" style="color:' + (score >= 80 ? '#2e7d32' : score >= 60 ? '#d98b2b' : '#b42335') + '">' + esc(title) + '</div>' +
      '<div class="gl">' + (lines || []).map(function (l) { return l; }).join('<br>') + '</div></div></div>';
  }

  /* 达标差距条（diverging bar）：以基准为中轴，正向绿右伸、负向红左伸。
     data=[{l, gap, val, unit}]，gap 为与基准的差值（正=达标以上）。 */
  function divergeBars(data, opt) {
    opt = opt || {};
    var maxAbs = Math.max.apply(null, data.map(function (d) { return Math.abs(Number(d.gap) || 0); }).concat([opt.min || 1]));
    return '<div class="qc-dv">' + data.map(function (d) {
      var g = Number(d.gap) || 0;
      var w = Math.min(50, Math.abs(g) / maxAbs * 50);
      var pos = g >= 0;
      var color = pos ? '#2e7d32' : '#c8384b';
      var fill = pos
        ? 'left:50%;width:' + w + '%;background:' + color
        : 'right:50%;width:' + w + '%;background:' + color;
      return '<div class="row"><span class="lb" title="' + esc(d.l) + '">' + esc(d.l) + '</span>' +
        '<span class="tk"><span class="fill" style="' + fill + '"></span></span>' +
        '<span class="vv" style="color:' + color + '">' + (g >= 0 ? '+' : '') + S.f1(g) + (d.unit || '') + '</span></div>';
    }).join('') + '</div>';
  }

  /* 好/差排名榜：data=[{name,val,unit}]，已按需要排序；kind='top'|'bot' 决定配色 */
  function rankList(data, kind, opt) {
    opt = opt || {};
    return '<div class="qc-rank">' + data.map(function (d, i) {
      return '<div class="it ' + (kind || '') + '"><span class="no">' + (i + 1) + '</span>' +
        '<span class="nm" title="' + esc(d.name) + '">' + esc(d.name) + '</span>' +
        '<span class="vl">' + (opt.fmt ? opt.fmt(d.val) : (S.f1(d.val) + (d.unit || ''))) + '</span></div>';
    }).join('') + '</div>';
  }

  /* 热力矩阵：rows=[{label, cells:[{v, style, title, action}]}], cols=表头数组 */
  function matrix(cols, rows, opt) {
    opt = opt || {};
    var head = '<tr><th class="rh">' + esc(opt.corner || '') + '</th>' +
      cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r) {
      return '<tr><td class="rh" title="' + esc(r.label) + '">' + esc(r.label) + '</td>' +
        r.cells.map(function (c) {
          var act = c.action ? ' data-qc="' + esc(c.action) + '"' : '';
          return '<td class="cell" style="' + (c.style || '') + '" title="' + esc(c.title || '') + '"' + act + '>' +
            (c.v == null ? '—' : c.v) + '</td>';
        }).join('') + '</tr>';
    }).join('');
    return '<div class="qc-tw"><table class="qc-matrix"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      (opt.legend !== false ? '<div class="qc-legend"><span><i style="background:#eaf7ec"></i>达标/优</span>' +
        '<span><i style="background:#fffbf5"></i>临界</span><span><i style="background:#fdecef"></i>未达标/差</span>' +
        (opt.note ? '<span style="margin-left:auto">' + esc(opt.note) + '</span>' : '') + '</div>' : '');
  }

  /* ==================== 弹窗 / Toast ==================== */
  function modal(title, bodyHtml, footerHtml) {
    closeModal();
    var mask = document.createElement('div');
    mask.className = 'qc-modal-mask';
    mask.innerHTML = '<div class="qc-modal"><div class="hd"><span class="t">' + esc(title) + '</span>' +
      '<button class="x" data-qc="modal:close" title="关闭" aria-label="关闭">×</button></div>' +
      '<div class="bd">' + bodyHtml + '</div>' +
      (footerHtml ? '<div class="ft">' + footerHtml + '</div>' : '') + '</div>';
    document.body.appendChild(mask);
    return mask;
  }
  function closeModal() {
    var m = document.querySelectorAll('.qc-modal-mask');
    for (var i = 0; i < m.length; i++) m[i].remove();
  }
  /* 关闭交互统一挂载：点 × / 点遮罩空白 / Esc。
     各质控层的事件代理只认自己的前缀（l1: / pf: / qi: …），
     不会处理 modal:close，因此这里必须独立绑定，否则弹窗关不掉。 */
  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-qc="modal:close"]') : null;
    if (el) { closeModal(); return; }
    if (ev.target && ev.target.classList && ev.target.classList.contains('qc-modal-mask')) closeModal();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' || ev.key === 'Esc') closeModal();
  });
  function toast(msg) {
    var box = document.getElementById('qcToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'qcToast';
      document.body.appendChild(box);
    }
    var el = document.createElement('div');
    el.className = 'tt';
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('on'); });
    setTimeout(function () {
      el.classList.remove('on');
      setTimeout(function () { el.remove(); }, 240);
    }, 2200);
  }

  /* ==================== 对外暴露 ==================== */
  window.qcUI = {
    badge: badge, link: link, btn: btn, verdictBadge: verdictBadge, statusBadge: statusBadge,
    head: head, kpis: kpis, card: card, table: table, filterBar: filterBar,
    pager: pager, slice: slice, barChart: barChart, lineChart: lineChart,
    progress: progress, kv: kv, note: note, judgeBlock: judgeBlock,
    layerBlock: layerBlock, timeline: timeline, heat: heat,
    grid2: grid2, grid13: grid13,
    insight: insight, insights: insights,
    scoreRing: scoreRing, scoreCard: scoreCard,
    divergeBars: divergeBars, rankList: rankList, matrix: matrix,
    modal: modal, closeModal: closeModal, toast: toast
  };
})();
