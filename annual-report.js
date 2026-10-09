/* 年报模块 —— 江西省肿瘤登记年报（省级编制业务闭环）
 * 子页：年报记录 / 编制工作台（单页一键生成）/ 归档记录（模板管理与上报记录页面代码保留，暂无页签入口）
 * 状态机：draft(草稿)->submitted(待审核)->approved(待发布)->published(已发布)->archived(已归档)；voided=作废
 * 持久化：localStorage（jx_ar_tasks/templates/submissions/archives/current），草稿随任务持久化
 */
(function () {
  "use strict";

  /* ===================== 1. 样式 ===================== */
  var st = document.getElementById("arReportStyles");
  if (!st) { st = document.createElement("style"); st.id = "arReportStyles"; document.head.appendChild(st); }
  st.textContent =
    ".ar-hint{font-size:12px;color:#667085;line-height:1.5}" +
    /* ---------- 阶段导轨（7 段状态机） ---------- */
    ".ar-stage-rail{display:flex;align-items:center;gap:0;background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:12px;overflow-x:auto}" +
    ".ar-stage-node{appearance:none;border:0;background:transparent;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;padding:2px 6px;flex:0 0 auto;min-width:78px}" +
    ".ar-stage-node .n{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;background:#f1f5f9;color:#94a3b8;border:1.5px solid #e2e8f0;transition:all .15s}" +
    ".ar-stage-node .l{font-size:12px;color:#94a3b8;font-weight:600;white-space:nowrap}" +
    ".ar-stage-node.done .n{background:#e7f6ec;color:#067647;border-color:#a6e0bb}" +
    ".ar-stage-node.done .l{color:#067647}" +
    ".ar-stage-node.cur .n{background:var(--primary);color:#fff;border-color:var(--primary);box-shadow:0 0 0 4px rgba(37,99,235,.14)}" +
    ".ar-stage-node.cur .l{color:var(--primary);font-weight:700}" +
    ".ar-stage-node.locked{opacity:.55;cursor:not-allowed}" +
    ".ar-stage-node.void .n{background:#fef3f2;color:#b42318;border-color:#fecdca}" +
    ".ar-stage-node.void .l{color:#b42318}" +
    ".ar-stage-line{flex:1 1 auto;min-width:18px;height:2px;background:#e2e8f0;border-radius:2px}" +
    ".ar-stage-line.done{background:#a6e0bb}" +
    ".ar-stage-pct{margin-left:auto;padding-left:14px;font-size:12px;color:#64748b;white-space:nowrap;flex:0 0 auto}" +
    ".ar-stage-pct b{color:var(--primary)}" +
    ".wb-viewing-past{font-size:11.5px;color:#b54708;background:#fffaeb;border:1px solid #fedf89;border-radius:10px;padding:1px 8px;margin-left:8px;font-weight:600}" +
    /* ---------- 准入闸门横幅 ---------- */
    ".ar-gate{display:flex;gap:14px;align-items:flex-start;border-radius:8px;padding:14px 16px;margin-bottom:14px;border:1px solid}" +
    ".ar-gate.ok{background:#f0fdf4;border-color:#a6e0bb}" +
    ".ar-gate.block{background:#fffbeb;border-color:#fedf89}" +
    ".ar-gate.void{background:#fef3f2;border-color:#fecdca}" +
    ".ar-gate .g-tag{flex:0 0 auto;font-size:12px;font-weight:700;padding:3px 10px;border-radius:11px;white-space:nowrap}" +
    ".ar-gate.ok .g-tag{background:#067647;color:#fff}" +
    ".ar-gate.block .g-tag{background:#b54708;color:#fff}" +
    ".ar-gate.void .g-tag{background:#b42318;color:#fff}" +
    ".ar-gate .g-body{flex:1 1 auto;min-width:0}" +
    ".ar-gate .g-title{font-size:13.5px;font-weight:700;color:#1f2937;margin-bottom:3px}" +
    ".ar-gate .g-sub{font-size:12.5px;color:#64748b;line-height:1.6}" +
    ".ar-gate .g-blockers{list-style:none;margin:9px 0 0;padding:0;display:flex;flex-direction:column;gap:7px}" +
    ".ar-gate .g-blockers li{display:flex;align-items:center;gap:9px;font-size:12.5px;color:#7a2e0e;flex-wrap:wrap}" +
    ".ar-gate .g-blockers .g-dot{width:6px;height:6px;border-radius:50%;background:#f79009;flex:0 0 auto}" +
    ".ar-gate .g-blockers .g-txt{flex:1 1 260px;min-width:0}" +
    ".ar-gate .g-warns{margin-top:9px;font-size:12px;color:#b54708;line-height:1.7}" +
    ".ar-gate .g-act{flex:0 0 auto;display:flex;align-items:center;gap:8px}" +
    ".ar-gate .g-hint{font-size:12px;color:#94a3b8}" +
    /* ---------- 阶段工作区通用组件 ---------- */
    ".ar-checklist{list-style:none;margin:0;padding:0}" +
    ".ar-checklist li{display:flex;align-items:flex-start;gap:11px;padding:11px 0;border-bottom:1px dashed #eef2f6}" +
    ".ar-checklist li:last-child{border-bottom:0}" +
    ".ar-checklist .ck{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex:0 0 auto;margin-top:1px}" +
    ".ar-checklist li.ok .ck{background:#e7f6ec;color:#067647}" +
    ".ar-checklist li.todo .ck{background:#f1f5f9;color:#94a3b8}" +
    ".ar-checklist .ct{flex:1 1 auto;min-width:0}" +
    ".ar-checklist .ct-t{font-size:13px;font-weight:600;color:#1f2937}" +
    ".ar-checklist li.todo .ct-t{color:#475569}" +
    ".ar-checklist .ct-d{font-size:12px;color:#94a3b8;margin-top:2px;line-height:1.5}" +
    ".ar-checklist .ct-a{flex:0 0 auto}" +
    ".ar-artifact-grid{display:flex;flex-wrap:wrap;gap:10px}" +
    ".ar-artifact{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;padding:7px 13px;border-radius:6px;border:1px solid}" +
    ".ar-artifact.ok{background:#f0fdf4;border-color:#a6e0bb;color:#067647}" +
    ".ar-artifact.todo{background:#f9fafb;border-color:#e4e7ec;color:#94a3b8}" +
    ".ar-artifact .ai{font-size:12px}" +
    ".ar-ctx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px 20px}" +
    ".ar-ctx-item .k{font-size:11.5px;color:#94a3b8;margin-bottom:3px}" +
    ".ar-ctx-item .v{font-size:13px;font-weight:600;color:#1f2937}" +
    ".ar-empty-inline{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#b54708;background:#fffbeb;border:1px dashed #fedf89;border-radius:7px;padding:13px 15px;line-height:1.6}" +
    ".ar-split2{display:grid;grid-template-columns:1fr 1fr;gap:20px}" +
    "@media (max-width:1100px){.ar-split2{grid-template-columns:1fr}}" +
    ".ar-sub-h{font-size:12.5px;font-weight:700;color:#334155;margin-bottom:8px}" +
    ".ar-ch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}" +
    ".ar-ch-item{display:flex;align-items:center;gap:10px;border:1px solid var(--border);border-radius:7px;padding:11px 13px;cursor:pointer;transition:all .15s}" +
    ".ar-ch-item:hover{border-color:var(--primary);background:var(--primary-soft)}" +
    ".ar-ch-item.ok{border-left:3px solid #067647}" +
    ".ar-ch-item.todo{border-left:3px solid #e2e8f0}" +
    ".ar-ch-item .ci{font-size:13px;color:#067647;flex:0 0 auto}" +
    ".ar-ch-item.todo .ci{color:#cbd5e1}" +
    ".ar-ch-item .cb{flex:1 1 auto;min-width:0}" +
    ".ar-ch-item .cn{font-size:12.5px;font-weight:600;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".ar-ch-item .cd{font-size:11.5px;color:#94a3b8;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".ar-ch-item .cs{font-size:11.5px;color:#94a3b8;flex:0 0 auto;font-weight:600}" +
    ".ar-ch-item.ok .cs{color:#067647}" +
    ".ar-review-round{margin-bottom:18px}" +
    ".ar-review-round:last-child{margin-bottom:0}" +
    ".ar-review-round .rr-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid #eef2f6}" +
    ".ar-review-round .rr-no{font-size:13px;font-weight:700;color:#1f2937}" +
    ".ar-review-round .rr-meta{font-size:12px;color:#94a3b8}" +
    ".wb-secnav-next-hint{font-size:12px;color:#94a3b8}" +
    ".ph-sub{margin-left:auto;font-size:12px;color:#94a3b8;font-weight:500}" +
    ".ar-prog-stage{font-size:11.5px;font-weight:700;color:var(--primary);background:var(--primary-soft);border-radius:9px;padding:2px 8px;margin-right:2px}" +
    ".ar-prog-bar{display:inline-block;width:52px;height:5px;background:#eef2f6;border-radius:3px;overflow:hidden;vertical-align:middle;margin-left:3px}" +
    ".ar-prog-bar i{display:block;height:100%;background:var(--primary);border-radius:3px}" +
    /* ---------- 统计表 / 图表 预览弹层 ---------- */
    ".ar-modal-ft{padding:14px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px}" +
    ".ar-table-caption{font-size:13.5px;font-weight:700;color:#1f2937;margin-bottom:10px;line-height:1.6}" +
    ".ar-table-note{display:block;font-size:11.5px;color:#94a3b8;font-weight:400;margin-top:3px}" +
    ".ar-detail-block{margin-top:16px;border-top:1px dashed #eef2f6;padding-top:12px}" +
    ".ar-detail-block:first-of-type{border-top:0;padding-top:0}" +
    ".ar-detail-t{font-size:12.5px;font-weight:700;color:#344054;margin-bottom:6px}" +
    ".ar-detail-c{font-size:13px;color:#475569;line-height:1.75;word-break:break-word}" +
    /* 操作列固定槽位：每行动作数量与位置恒定，不可用的置灰占位并在外层给悬停说明 */
    ".ar-ops{display:inline-flex;align-items:center;justify-content:center;gap:6px}" +
    ".ar-ops .op-slot{display:inline-flex;justify-content:center;min-width:44px}" +
    ".ar-ops .op-slot .btn{margin-right:0}" +
    ".ar-ops .btn:disabled{opacity:1;cursor:not-allowed;color:#a5adba;border-color:#e4e7ec;background:#f9fafb}" +
    ".ar-ops .btn:disabled:hover{color:#a5adba;border-color:#e4e7ec;background:#f9fafb}" +
    ".ar-ops-rule{display:flex;flex-wrap:wrap;gap:2px 6px;align-items:baseline;font-size:12px;color:#667085;line-height:1.6;margin:0 0 10px}" +
    ".ar-ops-rule b{color:#334155;font-weight:600}" +
    ".ar-ops-rule .sep{color:#cbd5e1}" +
    /* 新建年报弹窗 */
    ".ar-modal{position:fixed;inset:0;z-index:260;display:flex;align-items:center;justify-content:center;padding:24px}" +
    ".ar-modal-mask{position:absolute;inset:0;background:rgba(15,23,42,.45)}" +
    ".ar-modal-box{position:relative;background:#fff;border-radius:10px;width:700px;max-width:96vw;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 18px 48px rgba(15,23,42,.28)}" +
    ".ar-modal-hd{padding:15px 20px;border-bottom:1px solid var(--border);font-size:16px;font-weight:700;color:#1f2937;display:flex;align-items:center;justify-content:space-between}" +
    ".ar-modal-x{border:0;background:transparent;font-size:22px;line-height:1;color:#94a3b8;cursor:pointer;padding:0 4px}" +
    ".ar-modal-x:hover{color:#475569}" +
    ".ar-modal-bd{padding:18px 20px;overflow:auto;flex:1}" +
    ".ar-modal-ft{padding:13px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;align-items:center;gap:10px;background:#fbfcfe;border-radius:0 0 10px 10px}" +
    ".ar-modal-ft .ft-hint{margin-right:auto;font-size:12px;color:#94a3b8}" +
    ".ar-modal-tip{font-size:12.5px;color:#475569;line-height:1.75;background:#f8fafc;border:1px solid var(--border);border-left:3px solid var(--primary);border-radius:6px;padding:10px 12px;margin-bottom:14px}" +
    ".ar-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}" +
    ".ar-form-group.full{grid-column:1 / -1}" +
    ".ar-form-group>label{display:block;font-size:12.5px;color:#475569;font-weight:600;margin-bottom:6px}" +
    ".ar-form-group select,.ar-form-group input[type=text]{width:100%;height:34px;border:1px solid #d1d8e0;border-radius:5px;padding:0 10px;font-size:13px;background:#fff;color:#1f2937;box-sizing:border-box}" +
    ".ar-form-group .fh{font-size:11.5px;color:#94a3b8;margin-top:4px;line-height:1.5}" +
    ".ar-radio{display:flex;gap:18px;align-items:center;min-height:34px;font-size:13px;color:#334155;flex-wrap:wrap}" +
    ".ar-radio label{display:inline-flex;align-items:center;gap:6px;cursor:pointer}" +
    ".ar-radio input{accent-color:var(--primary);width:15px;height:15px;margin:0}" +
    ".ar-city-wrap{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px;margin-top:8px}" +
    /* 编制流程步骤条 */
    ".ar-flow{display:flex;align-items:center;flex-wrap:wrap;padding:12px 14px;background:#fff;border:1px solid var(--border);border-radius:8px;margin-bottom:14px}" +
    ".ar-flow-node{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}" +
    ".ar-flow-node .n{width:20px;height:20px;border-radius:50%;background:#eef2f7;color:#98a2b3;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;border:1px solid #dbe2ec;box-sizing:border-box}" +
    ".ar-flow-node .l{font-size:12.5px;color:#98a2b3}" +
    ".ar-flow-node.done .n{background:#e6f4ea;color:#027a48;border-color:#b7e0c4}" +
    ".ar-flow-node.done .l{color:#475569}" +
    ".ar-flow-node.cur .n{background:var(--primary);color:#fff;border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)}" +
    ".ar-flow-node.cur .l{color:var(--primary);font-weight:700}" +
    ".ar-flow-node.void .n,.ar-flow-node.void .l{color:#b42318;background:#fef3f2;border-color:#fdaaa1;box-shadow:none}" +
    ".ar-flow-line{flex:1;min-width:16px;height:2px;background:#e2e7ee;margin:0 8px}" +
    ".ar-flow-line.done{background:#b7e0c4}" +
    /* 台账进度徽章 */
    ".ar-prog{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}" +
    ".ar-prog-chip{display:inline-flex;align-items:center;gap:3px;font-size:11px;padding:1px 7px;border-radius:999px;border:1px solid #e4e7ec;color:#98a2b3;background:#fff;white-space:nowrap}" +
    ".ar-prog-chip.ok{color:#027a48;border-color:#b7e0c4;background:#f0faf3}" +
    ".ar-prog-chip.bad{color:#b42318;border-color:#fdaaa1;background:#fef3f2}" +
    ".ar-prog-chip.todo{color:#b54708;border-color:#fecd97;background:#fffaeb}" +
    /* 工作台下一步引导 */
    ".ar-nextstep{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:11px 14px;margin:0 0 12px;background:#fffcf5;border:1px solid #fde3bd;border-left:3px solid #f79009;border-radius:8px}" +
    ".ar-nextstep.ready{background:#f0faf3;border-color:#b7e0c4;border-left-color:#027a48}" +
    ".ar-nextstep.done{background:#f8fafc;border-color:var(--border);border-left-color:#98a2b3}" +
    ".ar-nextstep .ns-tag{font-size:11px;font-weight:700;color:#b54708;background:#fef0c7;border-radius:4px;padding:2px 7px;white-space:nowrap}" +
    ".ar-nextstep.ready .ns-tag{color:#027a48;background:#d1fadf}" +
    ".ar-nextstep.done .ns-tag{color:#475569;background:#f1f5f9}" +
    ".ar-nextstep .ns-text{font-size:13px;color:#334155;line-height:1.5}" +
    ".ar-nextstep .ns-btn{margin-left:auto;display:flex;gap:8px;align-items:center}" +
    ".ar-context{display:flex;flex-wrap:wrap;gap:9px 20px;align-items:center;padding:12px 16px;background:linear-gradient(180deg,#f8fafc,#ffffff);border:1px solid var(--border);border-radius:8px;margin-bottom:14px;font-size:12px;color:#475569}" +
    ".ar-context b{color:#1f2937;font-weight:650}" +
    ".ar-ctx-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;background:#f1f5f9;border:1px solid var(--border);border-radius:999px}" +
    ".ar-metric-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}" +
    ".ar-metric{background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px 14px}" +
    ".ar-metric .k{font-size:12px;color:#64748b}.ar-metric .v{font-size:21px;font-weight:700;color:var(--primary);margin-top:5px}.ar-metric .s{font-size:11px;color:#94a3b8;margin-top:3px}" +
    ".ar-metric.death .v{color:#c05621}" +
    ".ar-qc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}" +
    ".ar-pyr-head{display:grid;grid-template-columns:1fr 150px 1fr;gap:10px;text-align:center;font-size:12px;color:#64748b;font-weight:600;margin-bottom:6px}" +
    ".ar-pyr-legend-m{color:#2563eb}.ar-pyr-legend-f{color:#ea580c}" +
    ".ar-pyr-row{display:grid;grid-template-columns:1fr 150px 1fr;gap:10px;align-items:center;height:21px}" +
    ".ar-pyr-m{display:flex;justify-content:flex-end;align-items:center}.ar-pyr-f{display:flex;justify-content:flex-start;align-items:center}" +
    ".ar-pyr-bar{height:13px;border-radius:3px}.ar-pyr-ctr{text-align:center;font-size:11px;color:#334155}.ar-pyr-num{font-size:10px;color:#64748b;margin:0 6px;white-space:nowrap}" +
    ".ar-toc{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}" +
    ".ar-ch{border:1px solid var(--border);border-radius:8px;padding:12px 14px;cursor:pointer;background:#fff;text-align:left}" +
    ".ar-ch:hover{border-color:#9db8dc}.ar-ch.active{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-soft)}" +
    ".ar-ch .no{color:var(--primary);font-weight:700;font-size:12px}.ar-ch .ttl{font-size:14px;font-weight:600;color:#1f2937;margin:5px 0 4px}.ar-ch .desc{font-size:12px;color:#64748b;line-height:1.55}" +
    ".ar-editor{width:100%;min-height:150px;border:1px solid #d1d8e0;border-radius:6px;padding:12px;font-size:13px;line-height:1.7;color:#1f2937;font-family:inherit;resize:vertical;box-sizing:border-box}" +
    ".ar-corr-timeline{border-left:2px solid var(--border);margin-left:8px;padding-left:18px}" +
    ".ar-corr-item{position:relative;padding:0 0 12px 14px}" +
    ".ar-corr-item:before{content:\"\";position:absolute;left:-24px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)}" +
    ".ar-corr-item .meta{font-size:12px;color:#64748b}.ar-corr-item .note{font-size:13px;color:#1f2937;margin-top:3px}" +
    ".ar-stat-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-bottom:14px}" +
    ".ar-stat{background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px 14px}" +
    ".ar-stat .v{font-size:24px;font-weight:700;color:#1f2937}.ar-stat .l{font-size:12px;color:#64748b;margin-top:4px}.ar-stat.primary .v{color:var(--primary)}" +
    ".ar-timeline{display:flex;align-items:flex-start;gap:0;flex-wrap:wrap;padding:6px 4px 4px;margin-bottom:14px}" +
    ".ar-tl-node{display:flex;flex-direction:column;align-items:center;min-width:90px;text-align:center}" +
    ".ar-tl-node .dot{width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #cbd5e1;box-sizing:border-box}" +
    ".ar-tl-node.done .dot{background:#3b5b7d;border-color:#3b5b7d;box-shadow:0 0 0 4px #d7e3f1}" +
    ".ar-tl-node .tl-label{font-size:12px;color:#475569;margin-top:8px;font-weight:600;white-space:nowrap}" +
    ".ar-tl-node.done .tl-label{color:#1f2937}" +
    ".ar-tl-node .tl-time{font-size:11px;color:#94a3b8;margin-top:2px;white-space:nowrap}" +
    ".ar-tl-line{flex:1;height:1px;background:#e2e7ee;margin-top:20px;min-width:24px}" +
    ".ar-check,.ar-modal .ar-check{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:#334155;cursor:pointer;padding:10px 12px;border:1px solid var(--border);border-radius:6px;background:#fff}" +
    ".ar-check input[type=checkbox]{width:16px;height:16px;min-width:16px;flex:0 0 16px;margin:0;padding:0;accent-color:var(--primary);cursor:pointer}" +
    ".ar-check.on{border-color:var(--primary);background:var(--primary-soft)}" +
    ".ar-check span{flex:1;text-align:left;line-height:1.45}" +
    ".ar-check-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}" +
    ".ar-blk{border:1px solid var(--border);border-radius:6px;margin-bottom:10px;background:#fff;overflow:hidden}" +
    ".ar-blk-head{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8fafc;border-bottom:1px solid var(--border)}" +
    ".ar-blk-head select{height:30px;border:1px solid #d1d8e0;border-radius:4px;background:#fff;font-size:12px;padding:0 8px;width:auto;min-width:130px}" +
    ".ar-blk-no{font-size:12px;font-weight:700;color:var(--primary);background:var(--primary-soft);border-radius:10px;padding:2px 9px;white-space:nowrap}" +
    ".ar-blk-body{padding:12px}" +
    ".ar-blk-body textarea{width:100%;box-sizing:border-box;border:1px solid #d1d8e0;border-radius:5px;padding:9px 11px;font-size:13px;line-height:1.8;resize:vertical;font-family:inherit}" +
    ".ar-blk-body>select{height:34px;border:1px solid #d1d8e0;border-radius:5px;background:#fff;font-size:13px;padding:0 10px;min-width:300px;width:auto}" +
    ".ar-doc-wrap{display:grid;grid-template-columns:250px minmax(0,1fr);gap:0;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#fff}" +
    ".ar-doc-nav{border-right:1px solid var(--border);background:#fafbfc;max-height:760px;overflow:auto;padding:10px 0}" +
    ".ar-doc-nav .nav-h{font-size:12px;font-weight:700;color:#475569;padding:6px 14px 8px}" +
    ".ar-doc-ch{padding:7px 14px;font-size:13px;color:#334155;cursor:pointer;border-left:3px solid transparent;display:flex;align-items:center;gap:7px}" +
    ".ar-doc-ch:hover{background:#f1f5f9}" +
    ".ar-doc-ch.active{background:var(--primary-soft);border-left-color:var(--primary);color:var(--primary);font-weight:650}" +
    ".ar-doc-ch .cno{font-size:11px;color:#94a3b8;min-width:30px}" +
    ".ar-doc-ch.active .cno{color:var(--primary)}" +
    ".ar-doc-ch .flag{margin-left:auto;font-size:10px;color:#94a3b8}" +
    ".ar-doc-sec{padding:5px 14px 5px 34px;font-size:12px;color:#64748b;cursor:pointer}" +
    ".ar-doc-sec:hover{color:var(--primary);background:#f1f5f9}" +
    ".ar-doc-main{display:flex;flex-direction:column;min-width:0;background:#eef1f5}" +
    ".ar-doc-toolbar{display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:7px 10px;background:#fff;border-bottom:1px solid var(--border)}" +
    ".ar-tb-btn{min-width:30px;height:28px;padding:0 8px;border:1px solid transparent;border-radius:4px;background:transparent;cursor:pointer;font-size:13px;color:#334155;display:inline-flex;align-items:center;gap:4px}" +
    ".ar-tb-btn:hover{background:#f1f5f9;border-color:var(--border)}" +
    ".ar-tb-btn.b{font-weight:800}.ar-tb-btn.i{font-style:italic}.ar-tb-btn.u{text-decoration:underline}" +
    ".ar-tb-sep{width:1px;height:20px;background:var(--border);margin:0 4px}" +
    ".ar-tb-btn select,.ar-doc-toolbar select{height:26px;font-size:12px}" +
    ".ar-doc-scroll{overflow:auto;max-height:760px;padding:20px 0 30px}" +
    ".ar-page{width:780px;max-width:calc(100% - 32px);margin:0 auto;background:#fff;box-shadow:0 1px 4px rgba(15,23,42,.12);border:1px solid #e2e8f0;padding:44px 56px 56px;min-height:520px;box-sizing:border-box}" +
    ".ar-page:focus{outline:2px solid var(--primary-soft)}" +
    ".ar-page .doc-h1{font-size:20px;font-weight:700;text-align:center;margin:0 0 6px;color:#1f2937;letter-spacing:1px}" +
    ".ar-page .doc-sub{text-align:center;font-size:12px;color:#94a3b8;margin-bottom:26px}" +
    ".ar-page h3.doc-ch{font-size:17px;font-weight:700;color:#1f2937;margin:0 0 14px;text-align:center}" +
    ".ar-page h4.doc-sec{font-size:14px;font-weight:700;color:#1f2937;margin:20px 0 8px;padding-left:9px;border-left:3px solid var(--primary)}" +
    ".ar-page p{margin:0 0 12px;font-size:13.5px;line-height:1.95;color:#1f2937;text-indent:2em;text-align:justify}" +
    ".ar-page ul,.ar-page ol{margin:0 0 12px 22px;font-size:13.5px;line-height:1.9;color:#1f2937}" +
    ".ar-page table.doc-tbl{width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:12px}" +
    ".ar-page table.doc-tbl th{background:#f1f5f9;border:1px solid #cbd5e1;padding:6px 8px;font-weight:650;color:#334155;vertical-align:middle;white-space:nowrap}" +
    ".ar-page table.doc-tbl td{border:1px solid #d8dee7;padding:6px 8px;color:#1f2937;vertical-align:middle}" +
    ".ar-page table.doc-tbl th.num,.ar-page table.doc-tbl td.num{text-align:right;font-variant-numeric:tabular-nums}" +
    ".ar-page table.doc-tbl th.txt,.ar-page table.doc-tbl td.txt{text-align:left}" +
    ".ar-page table.doc-tbl th.code,.ar-page table.doc-tbl td.code{text-align:center}" +
    ".ar-page table.doc-tbl th.ops,.ar-page table.doc-tbl td.ops{text-align:center;white-space:nowrap}" +
    ".ar-page table.doc-tbl th:first-child,.ar-page table.doc-tbl td:first-child{text-align:left}" +
    ".ar-page .doc-cap{font-size:12px;color:#64748b;text-align:center;margin:0 0 14px;text-indent:0}" +
    ".ar-figure{margin:8px 0 16px;padding:12px;border:1px dashed #c7d2e1;border-radius:6px;background:#fafcff}" +
    ".ar-figure .fig-t{font-size:12px;font-weight:650;color:var(--primary);margin-bottom:8px;text-align:center}" +
    ".ar-fbar{display:flex;align-items:flex-end;gap:8px;height:110px;padding:0 4px}" +
    ".ar-fbar i{flex:1;background:linear-gradient(180deg,#4b7bd0,#7ba1e0);border-radius:3px 3px 0 0;position:relative;display:block}" +
    ".ar-fbar i b{position:absolute;bottom:-17px;left:0;right:0;text-align:center;font-size:10px;color:#64748b;font-weight:400;font-style:normal}" +
    ".ar-report-full{max-height:520px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:24px 28px;background:#fff;line-height:1.85;font-size:13px;color:#1f2937}" +
    ".ar-report-full h2{font-size:16px;margin:18px 0 8px;color:#1f2937;border-left:3px solid var(--primary);padding-left:10px}" +
    ".ar-report-full h1{font-size:20px;text-align:center;margin:4px 0 18px}" +
    ".ar-report-full p{margin:0 0 12px;text-indent:2em}" +
    ".ar-parambar{display:flex;flex-wrap:wrap;gap:12px 16px;align-items:flex-end;padding:13px 16px;background:linear-gradient(180deg,#f8fafc,#fff);border:1px solid var(--border);border-radius:8px;margin-bottom:12px}" +
    ".ar-param{display:flex;flex-direction:column;gap:5px;font-size:12px;color:#647085;font-weight:600}" +
    ".ar-param select{height:32px;border:1px solid #d1d8e0;border-radius:6px;background:#fff;font-size:13px;font-weight:400;padding:0 8px;min-width:126px;width:auto;color:#1f2937}" +
    ".ar-param-city{display:flex;flex-wrap:wrap;gap:6px;align-items:center}" +
    ".ar-param-city .ar-check{padding:5px 9px;font-size:12px}" +
    ".ar-genbar{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;padding:11px 14px;border:1px solid var(--border);border-radius:8px;background:#f8fafc;margin-bottom:14px;font-size:12.5px;color:#475569}" +
    ".ar-genbar .ok{color:#047857;font-weight:650}" +
    ".ar-anchor{position:sticky;top:0;z-index:6;display:flex;flex-wrap:wrap;gap:2px;padding:5px 6px;background:#fff;border:1px solid var(--border);border-radius:8px;margin-bottom:14px;box-shadow:0 1px 3px rgba(15,23,42,.06)}" +
    ".ar-anchor button{appearance:none;border:0;background:transparent;padding:8px 14px;font-size:13px;font-weight:600;color:#475569;border-radius:6px;cursor:pointer}" +
    ".ar-anchor button:hover{background:#f1f5f9;color:#1f2937}" +
    ".ar-anchor button.active{background:var(--primary-soft);color:var(--primary)}" +
    ".ar-sec{scroll-margin-top:60px}" +
    ".ar-sec-h{display:flex;align-items:center;gap:9px;font-size:15px;font-weight:700;color:#1f2937;margin:2px 0 10px}" +
    ".ar-sec-h .n{min-width:22px;height:22px;border-radius:11px;background:var(--primary-soft);color:var(--primary);font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 6px}" +
    ".ar-sec-h .sub{font-size:12px;font-weight:400;color:#647085}" +
    ".ar-adv{border:1px solid var(--border);border-radius:8px;background:#fff;padding:14px 16px;margin-bottom:12px}" +
    ".ar-ctx-line{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:#647085;margin-top:8px}" +
    ".ar-ctx-line b{color:#1f2937;font-weight:650}" +
    "@media(max-width:1100px){.ar-metric-grid,.ar-qc-grid,.ar-stat-row{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
    ".wb-head{display:flex;align-items:flex-start;gap:14px;padding:16px 18px;background:linear-gradient(135deg,#f4f8fc,#fff);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;box-shadow:var(--shadow-sm)}" +
    ".wb-head-ico{flex:0 0 46px;width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,var(--primary),var(--color-primary-700));display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;letter-spacing:1px;box-shadow:0 3px 8px rgba(61,90,128,.28)}" +
    ".wb-head-main{flex:1;min-width:0}" +
    ".wb-head-title{font-size:17px;font-weight:700;color:var(--color-text-title);line-height:1.3;margin:0 0 6px}" +
    ".wb-head-meta{display:flex;flex-wrap:wrap;gap:6px 10px;font-size:12px;color:var(--color-text-muted);align-items:center}" +
    ".wb-head-meta b{color:var(--color-text-body);font-weight:600}" +
    ".wb-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:#eef2f7;border:1px solid var(--border);border-radius:999px;color:var(--color-text-body);font-size:12px}" +
    ".wb-head-acts{flex:0 0 auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}" +
    ".wb-params{display:flex;align-items:flex-end;gap:12px 16px;flex-wrap:wrap;padding:14px 16px;background:#fff;border:1px solid var(--border);border-radius:10px;margin-bottom:12px}" +
    ".wb-params .ar-param{min-width:auto}" +
    ".wb-param-gen{margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}" +
    ".wb-gen-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--color-success-fg)}" +
    ".wb-gen-status.run{color:var(--color-primary-700)}" +
    ".wb-gen-status.idle{color:var(--color-warning-fg)}" +
    ".wb-gen-dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:0 0 8px}" +
    ".wb-gen-status.run .wb-gen-dot{animation:wb-pulse 1.1s ease-in-out infinite}" +
    "@keyframes wb-pulse{0%,100%{opacity:1}50%{opacity:.35}}" +
    ".wb-gen-progress{width:170px}" +
    ".wb-gen-progress .progress-track{margin:0;height:6px;border-radius:999px}" +
    ".wb-stepper{display:flex;align-items:center;gap:0;padding:6px 8px;background:#fff;border:1px solid var(--border);border-radius:10px;margin-bottom:16px;box-shadow:var(--shadow-xs);position:sticky;top:0;z-index:6;flex-wrap:wrap}" +
    ".wb-step{display:flex;align-items:center;gap:8px;padding:8px 12px;border:0;background:transparent;cursor:pointer;border-radius:8px;font-size:13px;color:var(--color-text-muted);font-weight:600;white-space:nowrap}" +
    ".wb-step:hover{background:#f1f5f9;color:var(--color-text-body)}" +
    ".wb-step.active{background:var(--color-primary-soft);color:var(--color-primary)}" +
    ".wb-step-no{width:22px;height:22px;border-radius:50%;background:#e2e8f0;color:#64748b;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;transition:.15s}" +
    ".wb-step.active .wb-step-no{background:var(--color-primary);color:#fff}" +
    ".wb-step.done .wb-step-no{background:var(--color-success-solid);color:#fff}" +
    ".wb-step-line{flex:1;height:2px;background:#e2e8f0;min-width:14px;margin:0 2px;border-radius:1px}" +
    ".wb-step.done+.wb-step-line{background:var(--color-success-border)}" +
    ".wb-step-tools{margin-left:auto;display:flex;gap:6px;align-items:center}" +
    ".wb-sec{margin-bottom:20px;scroll-margin-top:72px}" +
    ".wb-sec-h{display:flex;align-items:center;gap:10px;margin:2px 0 12px}" +
    ".wb-sec-h .n{min-width:26px;height:26px;border-radius:8px;background:var(--color-primary-soft);color:var(--color-primary);font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}" +
    ".wb-sec-h .t{font-size:15px;font-weight:700;color:var(--color-text-title)}" +
    ".wb-sec-h .wb-sec-d{font-size:12px;font-weight:400;color:var(--color-text-muted);margin-left:2px}" +
    ".wb-secnav{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border)}" +
    ".wb-secnav-pos{font-size:12px;color:var(--color-text-muted);font-variant-numeric:tabular-nums}" +
    "@media(max-width:640px){.wb-sec-h .wb-sec-d{display:none}}" +
    "@media(max-width:900px){.wb-head{flex-wrap:wrap}.wb-head-acts{width:100%;justify-content:flex-start}.wb-stepper{position:static}.wb-step-line{display:none}.wb-param-gen{margin-left:0;width:100%}}";

  var LS = { tasks: "jx_ar_tasks_v1", templates: "jx_ar_templates_v1", subs: "jx_ar_submissions_v1", arch: "jx_ar_archives_v1", cur: "jx_ar_current_v1" };
  /* ===================== 2. 常量 ===================== */
  var AGE18 = ["0-4","5-9","10-14","15-19","20-24","25-29","30-34","35-39","40-44","45-49","50-54","55-59","60-64","65-69","70-74","75-79","80-84","85+"];
  var CN2000_W = [7015,7523,8491,8559,7598,7559,8212,8870,8120,7302,5911,4578,3388,2657,1948,1328,712,345];
  var SEGI_W = [12000,10000,9000,9000,8000,8000,6000,6000,6000,6000,5000,4000,4000,3000,2000,1000,500,500];
  var STD_POP = { cn: { label: "中国 2000 年标准人口（中标率）", weights: CN2000_W }, world: { label: "Segi 世界标准人口（世标率）", weights: SEGI_W } };
  // 国家登记质量评价参考阈值（与 analysis.js / 省级登记方案口径一致：MV 66–95、DCO<15、M/I 0.6–0.8）
  var QC_THRESH = { mvMin: 66, mvMax: 95, dco: 15, ub: 5, ou: 5, miLow: 0.6, miHigh: 0.8, hvMin: 60, ageUnkMax: 1, sexUnkMax: 0.5, morphUnkMax: 10 };
  var QC_PROV = { mv: 76.5, hv: 68.1, dco: 3.8, ub: 1.2, ou: 0.6, mi: 0.62, ageUnk: 0.4, sexUnk: 0.1, morphUnk: 6.8 };

  var CHAPTER_META = [
    { id: "ch1", no: "一", title: "摘要", desc: "核心指标一览与主要发现", sections: ["编制背景与依据", "核心指标概览", "主要发现"] },
    { id: "ch2", no: "二", title: "数据来源与质量控制", desc: "覆盖范围、数据源与质控指标", sections: ["登记覆盖范围", "数据来源", "数据处理流程", "质量控制指标"] },
    { id: "ch3", no: "三", title: "发病情况", desc: "粗率、标化率、年龄别、性别与顺位", sections: ["总体发病水平", "性别与年龄别发病", "主要癌种发病顺位", "地区发病分布"] },
    { id: "ch4", no: "四", title: "死亡情况", desc: "死亡侧负担指标与顺位", sections: ["总体死亡水平", "性别与年龄别死亡", "主要癌种死亡顺位", "地区死亡分布"] },
    { id: "ch5", no: "五", title: "生存情况", desc: "五年相对生存率", sections: ["随访队列构成", "总体生存水平", "主要癌种生存率"] },
    { id: "ch6", no: "六", title: "时间趋势", desc: "近十年发病与死亡变化", sections: ["发病趋势", "死亡趋势", "趋势成因分析"] },
    { id: "ch7", no: "七", title: "讨论与建议", desc: "政策建议与防控重点", sections: ["主要问题", "防控建议", "下一步工作"] },
    { id: "ch8", no: "八", title: "附录", desc: "发病 / 死亡 / 质控统计表", sections: ["附表A 发病统计表", "附表B 死亡统计表", "附表C 质控指标表"] }
  ];
  var CN_NO = ["一","二","三","四","五","六","七","八","九","十","十一","十二"];
  var BLOCK_TYPES = [
    { id: "text", label: "段落正文", hint: "支持插入指标变量，自动替换为汇总数值" },
    { id: "list", label: "要点列表", hint: "每行一条，输出为项目符号列表" },
    { id: "indicator", label: "指标表", hint: "勾选指标，输出为两列指标表" },
    { id: "table", label: "统计表", hint: "选择统计表预设，按汇总数据渲染" },
    { id: "figure", label: "图表", hint: "选择图表预设，按汇总数据渲染柱状图" }
  ];
  var TABLE_PRESETS = [
    { id: "core", label: "核心指标表" },
    { id: "qc", label: "质控指标表（含国家标准判定）" },
    { id: "site-inc", label: "癌种发病顺位表" },
    { id: "site-death", label: "癌种死亡顺位表" },
    { id: "city-inc", label: "设区市发病统计表" },
    { id: "city-death", label: "设区市死亡统计表" },
    { id: "trend", label: "近年发病死亡趋势表" },
    { id: "survival", label: "主要癌种生存率表" }
  ];
  var FIGURE_PRESETS = [
    { id: "site-inc", label: "主要癌种发病顺位图" },
    { id: "site-death", label: "主要癌种死亡顺位图" },
    { id: "trend-inc", label: "发病数变化趋势图" },
    { id: "trend-death", label: "死亡数变化趋势图" },
    { id: "survival", label: "主要癌种生存率图" },
    { id: "city-inc", label: "设区市发病率对比图" }
  ];
  var VAR_KEYS = ["年度","覆盖人口万","登记处数","数据源数","报告卡数","剔重数","多原发数","有效病例","死亡病例","粗发病率","粗死亡率","MV","DCO","MI","UB","首位癌种","首位癌种发病数","前五发病占比","首位死因癌种","前五死亡占比","五年生存率","起始年度","末年度","起始发病数","末发病数","起始死亡数","末死亡数","年均增幅"];
  var DEFAULT_CHAPTER_BODY = {
    ch1: "2024 年江西省肿瘤登记覆盖 11 个设区市 100 个县（市、区），覆盖人口 4,530.0 万。全年新发恶性肿瘤 78,505 例，粗发病率 173.3/10 万，中标发病率 119.8/10 万，世标发病率 158.6/10 万；恶性肿瘤死亡 46,297 例，粗死亡率 102.2/10 万，中标死亡率 68.4/10 万，世标死亡率 94.1/10 万。发病顺位前五位依次为肺癌、结直肠癌、乳腺癌、肝癌、胃癌。",
    ch2: "数据来源于恶性肿瘤登记信息系统、死因登记数据库、随访数据库与人口数据库。全省 MV% 76.5%、DCO% 3.8%、M/I 0.62，达到国家登记质量要求。重复卡删除 426 张，多原发识别 312 例。",
    ch3: "全省发病 78,505 例，发病高峰集中在 60-74 岁年龄组。肺癌居发病首位，前五位癌种占全部发病的 56.6%。男性发病高于女性。",
    ch4: "全省恶性肿瘤死亡 46,297 例。肺癌居死亡首位，其次为肝癌、胃癌、结直肠癌、食管癌；前五位癌种占全部死亡的 59.2%。",
    ch5: "基于 2014-2019 年随访队列，全省恶性肿瘤五年相对生存率 40.5%。乳腺癌、甲状腺癌生存率较高，肺癌、肝癌较低。",
    ch6: "2015-2024 年，全省发病数由 59,420 例增至 78,505 例，死亡数由 35,210 例增至 46,297 例，年均增幅约 2.4%。",
    ch7: "建议持续推进重点癌种早筛，加强病理诊断能力与 ICD-O-3 编码培训，提高随访完整度，推动县区级登记处数据质量均衡化。",
    ch8: "附 A：全省及各设区市发病统计表；附 B：死亡统计表；附 C：质控指标表；附 D：主要癌种年龄别率。详见导出的统计附表。"
  };

  var TPL_TYPES = [
    { id: "annual", name: "年度肿瘤登记年报", cycle: "年度", volume: "全省全癌种" },
    { id: "survival", name: "五年生存专题", cycle: "年度", volume: "随访队列" },
    { id: "region", name: "区域对比报告", cycle: "季度/年度", volume: "分设区市" },
    { id: "cancer", name: "癌种专项报告", cycle: "专项", volume: "重点癌种" }
  ];

  var REGIONS = [
    { id: "jx", name: "全省（11 设区市）", level: "prov", pop: 45300000, incRate: 173.3, deathRate: 102.2 },
    { id: "nc", name: "南昌市", level: "city", pop: 6400000, incRate: 181.2, deathRate: 104.6 },
    { id: "gz", name: "赣州市", level: "city", pop: 9000000, incRate: 152.8, deathRate: 98.4 },
    { id: "jj", name: "九江市", level: "city", pop: 4600000, incRate: 164.7, deathRate: 96.1 },
    { id: "sr", name: "上饶市", level: "city", pop: 6400000, incRate: 169.5, deathRate: 101.3 },
    { id: "yc", name: "宜春市", level: "city", pop: 5000000, incRate: 160.9, deathRate: 95.8 },
    { id: "ja", name: "吉安市", level: "city", pop: 4500000, incRate: 158.2, deathRate: 93.6 },
    { id: "fz", name: "抚州市", level: "city", pop: 3600000, incRate: 162.1, deathRate: 97.9 },
    { id: "jdz", name: "景德镇市", level: "city", pop: 1600000, incRate: 176.4, deathRate: 103.7 },
    { id: "px", name: "萍乡市", level: "city", pop: 1800000, incRate: 170.8, deathRate: 99.2 },
    { id: "xy", name: "新余市", level: "city", pop: 1200000, incRate: 178.6, deathRate: 105.1 },
    { id: "yt", name: "鹰潭市", level: "city", pop: 1200000, incRate: 171.3, deathRate: 98.8 }
  ];
  var CANCERS = ["全部恶性肿瘤","肺癌","乳腺癌","结直肠癌","肝癌","胃癌","食管癌","宫颈癌","甲状腺癌","前列腺癌"];
  var SITES = [
    { name: "肺癌", icd: "C33-C34", inc: 16240, death: 11230 },
    { name: "结直肠癌", icd: "C18-C20", inc: 8260, death: 3740 },
    { name: "乳腺癌", icd: "C50", inc: 7150, death: 1680 },
    { name: "肝癌", icd: "C22", inc: 6310, death: 5290 },
    { name: "胃癌", icd: "C16", inc: 6080, death: 4490 },
    { name: "食管癌", icd: "C15", inc: 4390, death: 3310 },
    { name: "甲状腺癌", icd: "C73", inc: 4220, death: 230 },
    { name: "宫颈癌", icd: "C53", inc: 2310, death: 710 },
    { name: "前列腺癌", icd: "C61", inc: 1870, death: 540 },
    { name: "淋巴瘤", icd: "C81-C85", inc: 1590, death: 1020 }
  ];
  var SURVIVAL = [
    { site: "全部恶性肿瘤", rate: 40.5 }, { site: "乳腺恶性肿瘤", rate: 82.1 }, { site: "甲状腺癌", rate: 94.8 },
    { site: "结直肠癌", rate: 56.9 }, { site: "宫颈癌", rate: 67.3 }, { site: "胃癌", rate: 35.2 },
    { site: "食管癌", rate: 28.4 }, { site: "肺癌", rate: 19.7 }, { site: "肝癌", rate: 12.8 }
  ];
  var TREND = [
    { year: 2015, inc: 59420, incRate: 138.4, death: 35210, deathRate: 82.0 },
    { year: 2016, inc: 61280, incRate: 141.2, death: 36140, deathRate: 83.3 },
    { year: 2017, inc: 63010, incRate: 143.9, death: 37080, deathRate: 84.6 },
    { year: 2018, inc: 64840, incRate: 146.7, death: 38020, deathRate: 85.9 },
    { year: 2019, inc: 66810, incRate: 149.8, death: 39110, deathRate: 87.3 },
    { year: 2020, inc: 68760, incRate: 152.6, death: 40320, deathRate: 89.0 },
    { year: 2021, inc: 70890, incRate: 155.9, death: 41730, deathRate: 90.7 },
    { year: 2022, inc: 72760, incRate: 158.7, death: 43120, deathRate: 92.3 },
    { year: 2023, inc: 74910, incRate: 161.9, death: 44780, deathRate: 94.9 },
    { year: 2024, inc: 78505, incRate: 173.3, death: 46297, deathRate: 102.2 }
  ];
  var AGG_RESULT = { cards: 98512, valid: 78505, death: 46297, dup: 426, multiPrimary: 312, sources: 4, registries: 111, pop: 45300000, unlocated: 3637 };
  var VALIDATE_RULES = [
    { id: "complete", name: "字段完整性校验", desc: "必填字段缺失率 < 1%", status: "ok" },
    { id: "icdo", name: "ICD-O-3 逻辑一致性", desc: "部位 / 形态 / 行为编码匹配", status: "warn" },
    { id: "dup", name: "重复卡校验", desc: "同证件同癌种同年份重复检测", status: "ok" },
    { id: "deathdate", name: "死亡 / 发病一致性", desc: "死亡日期不可早于确诊日期", status: "bad" },
    { id: "code", name: "编码规范校验", desc: "ICD-10 / ICD-O-3 取值合法", status: "ok" },
    { id: "age", name: "年龄别逻辑校验", desc: "年龄与出生日期、诊断日期一致", status: "ok" },
    { id: "pop", name: "人口覆盖完整性", desc: "全市县分性别 18 年龄组人口完整", status: "ok" },
    { id: "qc", name: "国家质量考核", desc: "MV% 66–95 / DCO%<15 / M/I 0.6–0.8 / O&U%<5 阈值判定", status: "ok" }
  ];
  var ISSUES = [
    { no: "JX-2024-001289", region: "南昌市", rule: "死亡日期早于确诊日期", level: "bad", detail: "死亡日期 2024-03-02，确诊日期 2024-05-18" },
    { no: "JX-2024-007431", region: "赣州市", rule: "形态学编码与部位不匹配", level: "warn", detail: "部位 C34，形态 8500/3" },
    { no: "JX-2024-014208", region: "九江市", rule: "身份证校验位异常", level: "warn", detail: "证件号码校验位不通过" },
    { no: "JX-2024-020917", region: "上饶市", rule: "死亡日期早于确诊日期", level: "bad", detail: "死亡日期 2024-06-11，确诊日期 2024-06-20" }
  ];
  var TASK_STATUS = {
    draft: { label: "草稿", cls: "neutral" },
    submitted: { label: "待审核", cls: "warning" },
    approved: { label: "待发布", cls: "info" },
    published: { label: "已发布", cls: "success" },
    archived: { label: "已归档", cls: "neutral" },
    voided: { label: "已作废", cls: "danger" }
  };
  var CHANNELS = [
    { id: "nccr", label: "国家平台上报（NCCR）" }
  ];
/* ===================== 3. 种子数据 ===================== */
  function seedTemplates() {
    var now = "2026-06-01 09:00";
    return [
      { id: "tpl-annual", name: "年度肿瘤登记年报", type: "annual", cycle: "年度", volume: "全省全癌种", desc: "按《中国肿瘤登记年报编写指南》生成八章标准年报，含发病、死亡、生存、趋势与质控。", enabled: true, isDefault: true, version: "v3", updatedAt: now, updatedBy: "系统管理员", chapters: CHAPTER_META.map(function (c) { return c.id; }) },
      { id: "tpl-survival", name: "五年生存专题", type: "survival", cycle: "年度", volume: "随访队列", desc: "基于随访队列开展五年相对生存率分析，支持分期、性别拆分。", enabled: true, isDefault: false, version: "v1", updatedAt: now, updatedBy: "系统管理员", chapters: ["ch1","ch2","ch5","ch7","ch8"] },
      { id: "tpl-region", name: "区域对比报告", type: "region", cycle: "季度/年度", volume: "分设区市", desc: "十一设区市横向对比发病率、死亡率、标化率与质控指标。", enabled: true, isDefault: false, version: "v2", updatedAt: now, updatedBy: "系统管理员", chapters: ["ch1","ch2","ch3","ch4","ch6","ch8"] },
      { id: "tpl-cancer", name: "癌种专项报告", type: "cancer", cycle: "专项", volume: "重点癌种", desc: "围绕重点癌种输出年龄别、性别、分期与地区分布特征。", enabled: true, isDefault: false, version: "v1", updatedAt: now, updatedBy: "系统管理员", chapters: ["ch1","ch2","ch3","ch4","ch8"] }
    ];
  }

  /* ---------- 编制流程数据模型（数据准备 / 质控 / 统计 / 审核 / 发布） ----------
     旧版只有 agg(取数) + valid(校验) 两个布尔开关，撑不起正式流程。这里按阶段补齐：
       dataPrep  数据准备：多源接入核对台账 + 剔重/多原发处理 + 字段齐备性检查
       qc        质量校验：分级质控问题清单（可整改/豁免/闭环）+ 国家考核指标逐项判定
       stats     统计分析：统计表与图表清单 + 数据快照版本（用于过期判定）
       review    审核：多轮审核意见单（逐条回复 + 修订版本）
       release   发布归档：发布审批、数据包、国家平台回执
       stageLog  全流程阶段流转留痕
     数据源沿用站内真实口径：报告卡主档 / 死因登记库 / 随访库 / 人口库。 */
  function seedDataSources(state) {
    var base = [
      { id: "src-card", name: "恶性肿瘤登记信息系统（报告卡主档）", kind: "主数据源", desc: "发病报告卡", cards: 98512, at: "2026-06-01 10:00" },
      { id: "src-death", name: "死因登记数据库", kind: "死亡补充", desc: "死亡医学证明", cards: 27340, at: "2026-06-01 10:05" },
      { id: "src-follow", name: "肿瘤随访数据库", kind: "生存随访", desc: "随访结局", cards: 41260, at: "2026-06-01 10:08" },
      { id: "src-pop", name: "人口数据库", kind: "分母数据", desc: "分县分性别年龄组人口", cards: 0, at: "2026-06-01 10:12" }
    ];
    // state: 'all' 全部到位；'partial' 随访库待核对；'none' 全部未接入
    return base.map(function (s) {
      var st = "ready";
      if (state === "none") st = "pending";
      else if (state === "partial" && s.id === "src-follow") st = "receiving";
      return Object.assign({}, s, { state: st, note: st === "ready" ? "核对一致" : "", cards: st === "pending" ? null : s.cards });
    });
  }
  function seedQcIssues(state) {
    var all = [
      { id: "QC-001", no: "JX-2024-001289", region: "南昌市", rule: "死亡 / 发病一致性", level: "bad", detail: "死亡日期 2024-03-02 早于确诊日期 2024-05-18", state: "open", owner: "南昌市登记处", raisedAt: "2026-06-02 09:10", dueAt: "2026-06-10", basis: "死亡日期不得早于确诊日期；两者矛盾时须回溯原始病历核实其中一个日期" },
      { id: "QC-002", no: "JX-2024-020917", region: "上饶市", rule: "死亡 / 发病一致性", level: "bad", detail: "死亡日期 2024-06-11 早于确诊日期 2024-06-20", state: "open", owner: "上饶市登记处", raisedAt: "2026-06-02 09:10", dueAt: "2026-06-10", basis: "死亡日期不得早于确诊日期；两者矛盾时须回溯原始病历核实其中一个日期" },
      { id: "QC-003", no: "JX-2024-007431", region: "赣州市", rule: "ICD-O-3 逻辑一致性", level: "warn", detail: "部位 C34（肺），形态 8500/3（浸润性导管癌）不匹配", state: "open", owner: "赣州市登记处", raisedAt: "2026-06-02 09:11", dueAt: "2026-06-12", basis: "ICD-O-3 形态学编码须与部位相容；肺部位不应出现乳腺来源形态学编码" },
      { id: "QC-004", no: "JX-2024-014208", region: "九江市", rule: "编码规范校验", level: "warn", detail: "身份证号码校验位不通过", state: "open", owner: "九江市登记处", raisedAt: "2026-06-02 09:12", dueAt: "2026-06-12", basis: "身份证号须通过 GB 11643 校验位算法，未通过时须向登记单位核实" }
    ];
    if (state === "clean") return all.map(function (x) { return Object.assign({}, x, { state: "closed", closedAt: "2026-06-03 15:00", closedBy: "省级质控岗·王五", fixNote: "已回溯原始病历核实并修正" }); });
    if (state === "warnonly") return all.map(function (x) { return x.level === "bad" ? Object.assign({}, x, { state: "closed", closedAt: "2026-06-03 15:00", closedBy: "省级质控岗·王五", fixNote: "已回溯原始病历核实并修正" }) : x; });
    return all;
  }
  var QC_KPI_DEFS = [
    { key: "mv", name: "形态学确诊比例 MV%", value: "76.5%", require: "66%–95%", pass: true, basis: "显微镜下确诊的病例占全部发病报告的比例，反映诊断可靠性" },
    { key: "dco", name: "死亡补发病比例 DCO%", value: "3.8%", require: "≤15%", pass: true, basis: "仅由死亡医学证明补充的病例占比，过高说明发病报告漏报" },
    { key: "mi", name: "死亡/发病比 M/I", value: "0.62", require: "0.6–0.8", pass: true, basis: "死亡数与发病数之比，用于判断发病或死亡登记的完整性" },
    { key: "ub", name: "仅原发部位不明比例 UB%", value: "1.2%", require: "≤5%", pass: true, basis: "仅有原发部位不明编码的病例占比，反映诊断精细程度" },
    { key: "ou", name: "仅死亡证书比例 O&U%", value: "0.6%", require: "≤5%", pass: true, basis: "仅有死亡证书、无其他诊断依据的病例占比" },
    { key: "hv", name: "组织学随访确认比例 HV%", value: "68.1%", require: "≥60%", pass: true, basis: "经随访确认组织学诊断的病例占比，反映随访质量" }
  ];
  function seedQcKpis(pass) {
    return QC_KPI_DEFS.map(function (k) { return Object.assign({}, k, { pass: pass ? k.pass : k.pass }); });
  }
  var STAT_TABLES = [
    { id: "t1", no: "表1", name: "全部恶性肿瘤发病主要指标", dim: "性别 × 指标", rows: 3 },
    { id: "t2", no: "表2", name: "全部恶性肿瘤死亡主要指标", dim: "性别 × 指标", rows: 3 },
    { id: "t3", no: "表3", name: "主要癌种发病顺位", dim: "癌种 × 指标", rows: 10 },
    { id: "t4", no: "表4", name: "主要癌种死亡顺位", dim: "癌种 × 指标", rows: 10 },
    { id: "t5", no: "表5", name: "年龄别发病 / 死亡率", dim: "18 年龄组 × 性别", rows: 18 },
    { id: "t6", no: "表6", name: "各设区市发病统计", dim: "11 设区市 × 指标", rows: 11 },
    { id: "t7", no: "表7", name: "各设区市死亡统计", dim: "11 设区市 × 指标", rows: 11 },
    { id: "t8", no: "表8", name: "主要癌种五年相对生存率", dim: "癌种 × 生存率", rows: 9 },
    { id: "t9", no: "表9", name: "登记质量考核指标", dim: "指标 × 国家标准", rows: 6 }
  ];
  var STAT_CHARTS = [
    { id: "f1", no: "图1", name: "年龄-性别发病金字塔", type: "金字塔图" },
    { id: "f2", no: "图2", name: "主要癌种发病顺位", type: "条形图" },
    { id: "f3", no: "图3", name: "主要癌种死亡顺位", type: "条形图" },
    { id: "f4", no: "图4", name: "设区市发病率对比", type: "柱状图" },
    { id: "f5", no: "图5", name: "2015-2024 发病 / 死亡趋势", type: "折线图" },
    { id: "f6", no: "图6", name: "主要癌种五年生存率", type: "柱状图" }
  ];
  function seedStats(done) {
    return { done: !!done, tables: done ? STAT_TABLES.slice() : [], charts: done ? STAT_CHARTS.slice() : [], snapshotAt: done ? "2026-06-03 16:00" : "", dataVersion: done ? "DV-2024-01" : "" };
  }
  function seedReview(state) {
    if (state === "none") return { rounds: [] };
    var rounds = [{
      id: "RV-01", round: 1, submittedAt: "2026-06-04 10:00", submittedBy: "省级上报岗·张三",
      reviewer: "省级审核岗·李四", result: state === "pass" ? "pass" : "reject", decidedAt: "2026-06-04 16:30",
      items: [
        { id: "RI-1", text: "摘要部分中标率建议按中国 2000 年标准人口口径复核，与附表 1 保持一致", level: "major", replyState: state === "pass" ? "replied" : "pending", reply: state === "pass" ? "已按中标率口径复核，摘要与附表 1 统一为 119.4/10 万" : "" },
        { id: "RI-2", text: "讨论与建议章节建议补充重点癌种早筛的具体措施", level: "minor", replyState: state === "pass" ? "replied" : "pending", reply: state === "pass" ? "已补充肺癌、结直肠癌、乳腺癌三癌种早筛建议" : "" }
      ]
    }];
    return { rounds: rounds };
  }
  function seedRelease(state) {
    if (state === "none") return {};
    return { approvedAt: "2026-06-05 16:20", approvedBy: "省卫健委疾病预防控制处", packageBuiltAt: "2026-06-05 16:40", packageName: "江西省肿瘤登记年报2024_NCCR.zip", receiptNo: state === "archived" ? "NCCR-R-2026-0041" : "", receiptAt: state === "archived" ? "2026-06-10 09:50" : "" };
  }
  function seedStageLog(entries) { return entries || []; }
  /* 已完成任务的正文：按章节标准正文派生，保证「正文编制」阶段判定与 UI 一致 */
  function seedChapters() {
    var out = {};
    CHAPTER_META.forEach(function (c) { out[c.id] = '<p>' + DEFAULT_CHAPTER_BODY[c.id] + '</p>'; });
    return out;
  }

  function seedTasks() {
    var t1 = { id: "AR-2024-0001", title: "2024 年江西省肿瘤登记年报", year: "2024", scope: "jx", cities: ["jx"], templateId: "tpl-annual", status: "approved", version: "V1.2", popCal: "usual", stdPop: "cn", cancer: "全部恶性肿瘤", agg: { done: true, result: AGG_RESULT }, valid: { done: true, result: { ok: 8, warn: 0, bad: 0 } }, chapters: {}, corrections: [ { ver: "V1.2", at: "2026-06-05 16:10", by: "省级上报岗·张三", note: "按审核意见修订摘要中标率口径" }, { ver: "V1.1", at: "2026-06-03 09:40", by: "省级审核岗·李四", note: "讨论与建议补充早筛建议" }, { ver: "V1.0", at: "2026-06-01 14:20", by: "省级上报岗·张三", note: "按模板自动生成年报初稿" } ], exportCfg: { format: "pdf", ci5: true, channels: ["nccr"] }, createdAt: "2026-06-01 14:20", updatedAt: "2026-06-05 16:10", createdBy: "省级上报岗·张三", submittedAt: "2026-06-04 10:00", approvedAt: "2026-06-05 16:20" };
    // 走到「发布归档」：前六阶段均已完成，待发布审批 / 数据包 / 回执
    t1.stage = "release";
    t1.chapters = seedChapters();
    t1.draftCheck = { at: "2026-06-04 09:20", mismatches: [], checked: 8 };
    t1.dataVersion = "DV-2024-01";
    t1.dataPrep = { sources: seedDataSources("all"), dedupDone: true, dedupAt: "2026-06-02 08:40", dupRemoved: 426, multiPrimary: 312, unlocated: 3637, fieldsChecked: true, fieldsAt: "2026-06-02 08:55" };
    t1.qc = { done: true, runAt: "2026-06-02 09:00", issues: seedQcIssues("clean"), kpis: seedQcKpis(true) };
    t1.stats = seedStats(true);
    t1.review = seedReview("pass");
    t1.release = {};
    t1.stageLog = seedStageLog([
      { at: "2026-06-01 14:20", action: "创建任务", from: "", to: "task", note: "2024 年度年报编制任务建立，口径：全省 · 常住人口 · 中国 2000 标准人口", by: "省级上报岗·张三" },
      { at: "2026-06-02 08:55", action: "阶段完成", from: "data", to: "qc", note: "4 个数据源全部核对到位，剔重 426 张、多原发 312 例", by: "省级上报岗·张三" },
      { at: "2026-06-02 09:00", action: "阶段完成", from: "qc", to: "stats", note: "质控通过，4 项问题全部闭环，6 项国家考核指标达标", by: "省级质控岗·王五" },
      { at: "2026-06-03 16:00", action: "阶段完成", from: "stats", to: "draft", note: "生成 9 张统计表、6 张图表，快照 DV-2024-01", by: "统计分析岗·赵六" },
      { at: "2026-06-04 09:30", action: "阶段完成", from: "draft", to: "review", note: "八章正文编制完成，引用一致性核对通过", by: "省级上报岗·张三" },
      { at: "2026-06-04 16:30", action: "阶段完成", from: "review", to: "release", note: "第 1 轮审核通过，2 条意见均已回复", by: "省级审核岗·李四" }
    ]);

    var t2 = { id: "AR-2024-0002", title: "2024 年赣北片区肿瘤登记年报", year: "2024", scope: "city", cities: ["nc","jj","jdz"], templateId: "tpl-annual", status: "draft", version: "V0.1", popCal: "usual", stdPop: "cn", cancer: "全部恶性肿瘤", agg: { done: false, result: null }, valid: { done: false, result: null }, chapters: {}, corrections: [], exportCfg: { format: "pdf", ci5: true, channels: ["nccr"] }, createdAt: "2026-07-20 09:30", updatedAt: "2026-07-20 09:30", createdBy: "省级上报岗·张三" };
    // 停在「数据准备」阶段：随访库待核对，字段检查未做
    t2.stage = "data";
    t2.dataVersion = "DV-2024-02";
    t2.dataPrep = { sources: seedDataSources("partial"), dedupDone: false, dupRemoved: 0, multiPrimary: 0, unlocated: 0, fieldsChecked: false };
    t2.qc = { done: false, issues: [], kpis: [] };
    t2.stats = seedStats(false);
    t2.review = seedReview("none");
    t2.release = {};
    t2.stageLog = seedStageLog([
      { at: "2026-07-20 09:30", action: "创建任务", from: "", to: "task", note: "赣北片区（南昌 / 九江 / 景德镇）年报任务建立", by: "省级上报岗·张三" }
    ]);

    var t3 = { id: "AR-2023-0001", title: "2023 年江西省肿瘤登记年报", year: "2023", scope: "jx", cities: ["jx"], templateId: "tpl-annual", status: "archived", version: "V1.0", popCal: "usual", stdPop: "cn", cancer: "全部恶性肿瘤", agg: { done: true, result: AGG_RESULT }, valid: { done: true, result: { ok: 8, warn: 0, bad: 0 } }, chapters: {}, corrections: [ { ver: "V1.0", at: "2025-06-10 10:15", by: "省级上报岗·张三", note: "2023 年度年报定稿归档" } ], exportCfg: { format: "pdf", ci5: true, channels: ["nccr"] }, createdAt: "2025-05-20 10:00", updatedAt: "2025-06-10 10:15", createdBy: "省级上报岗·张三", submittedAt: "2025-06-01 09:00", approvedAt: "2025-06-08 15:00", publishedAt: "2025-06-10 09:50", archivedAt: "2025-06-10 10:15" };
    t3.stage = "release";
    t3.chapters = seedChapters();
    t3.draftCheck = { at: "2025-05-30 10:00", mismatches: [], checked: 8 };
    t3.dataVersion = "DV-2023-01";
    t3.dataPrep = { sources: seedDataSources("all"), dedupDone: true, dedupAt: "2025-05-25 10:00", dupRemoved: 388, multiPrimary: 274, unlocated: 3110, fieldsChecked: true, fieldsAt: "2025-05-25 10:20" };
    t3.qc = { done: true, runAt: "2025-05-25 11:00", issues: seedQcIssues("clean"), kpis: seedQcKpis(true) };
    t3.stats = seedStats(true);
    t3.review = seedReview("pass");
    t3.release = seedRelease("archived");
    t3.stageLog = seedStageLog([
      { at: "2025-05-20 10:00", action: "创建任务", from: "", to: "task", note: "2023 年度年报任务建立", by: "省级上报岗·张三" },
      { at: "2025-06-01 09:00", action: "阶段完成", from: "draft", to: "review", note: "正文定稿提交审核", by: "省级上报岗·张三" },
      { at: "2025-06-08 15:00", action: "阶段完成", from: "review", to: "release", note: "审核通过", by: "省级审核岗·李四" },
      { at: "2025-06-10 10:15", action: "归档入库", from: "release", to: "archived", note: "取得国家平台回执 NCCR-R-2025-0018，定稿归档", by: "省级上报岗·张三" }
    ]);

    var t4 = { id: "AR-2023-0002", title: "2023 年江西省肿瘤登记年报（试编稿）", year: "2023", scope: "jx", cities: ["jx"], templateId: "tpl-annual", status: "voided", version: "V0.2", popCal: "usual", stdPop: "cn", cancer: "全部恶性肿瘤", agg: { done: false, result: null }, valid: { done: false, result: null }, chapters: {}, corrections: [ { ver: "V0.2", at: "2025-07-01 11:00", by: "省级上报岗·张三", note: "作废：随访队列口径调整，重新编制" } ], exportCfg: { format: "pdf", ci5: true, channels: ["nccr"] }, createdAt: "2025-06-15 09:00", updatedAt: "2025-07-01 11:00", createdBy: "省级上报岗·张三", voidReason: "随访队列口径调整，重新编制" };
    t4.stage = "data";
    t4.dataVersion = "DV-2023-02";
    t4.dataPrep = { sources: seedDataSources("none"), dedupDone: false, dupRemoved: 0, multiPrimary: 0, unlocated: 0, fieldsChecked: false };
    t4.qc = { done: false, issues: [], kpis: [] };
    t4.stats = seedStats(false);
    t4.review = seedReview("none");
    t4.release = {};
    t4.stageLog = seedStageLog([
      { at: "2025-06-15 09:00", action: "创建任务", from: "", to: "task", note: "试编稿建立", by: "省级上报岗·张三" },
      { at: "2025-07-01 11:00", action: "作废", from: "data", to: "voided", note: "随访队列口径调整，重新编制", by: "省级上报岗·张三" }
    ]);

    return [t1, t2, t3, t4];
  }

  function seedSubs() {
    return [
      { id: "SB-2023-0001", taskId: "AR-2023-0001", year: "2023", title: "2023 年江西省肿瘤登记年报", channel: "nccr", channelLabel: "国家平台上报（NCCR）", ci5: true, format: "pdf", status: "已回执归档", receiptNo: "NCCR-R-2025-0018", sentAt: "2025-06-10 10:00", remark: "国家平台受理通过" },
      { id: "SB-2022-0001", taskId: "AR-2022-0001", year: "2022", title: "2022 年江西省肿瘤登记年报", channel: "nccr", channelLabel: "国家平台上报（NCCR）", ci5: true, format: "pdf", status: "已回执归档", receiptNo: "NCCR-R-2024-0032", sentAt: "2024-06-12 11:00", remark: "" }
    ];
  }

  function seedArch() {
    return [
      { id: "AC-2023-0001", taskId: "AR-2023-0001", year: "2023", version: "V1.0", fileName: "江西省肿瘤登记年报2023.pdf", fileType: "pdf", pages: 88, size: "7.9 MB", status: "已归档", archivedAt: "2025-06-10 10:15", archivedBy: "省级上报岗" },
      { id: "AC-2022-0001", taskId: "AR-2022-0001", year: "2022", version: "V1.0", fileName: "江西省肿瘤登记年报2022.pdf", fileType: "pdf", pages: 81, size: "7.2 MB", status: "已归档", archivedAt: "2024-06-12 11:00", archivedBy: "省级上报岗" }
    ];
  }

  /* ===================== 4. 存储与状态 ===================== */
  function loadLS(key, seed) {
    try { var raw = localStorage.getItem(key); if (raw) return JSON.parse(raw); } catch (err) {}
    var v = seed;
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (err2) {}
    return v;
  }
  function saveLS(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (err) {} }

  var tasks = loadLS(LS.tasks, seedTasks());
  var templates = loadLS(LS.templates, seedTemplates());
  var submissions = loadLS(LS.subs, seedSubs());
  var archives = loadLS(LS.arch, seedArch());

  /* ---------- 存量数据迁移：给老任务补齐阶段化字段 ----------
     浏览器 localStorage 里可能还存着旧版任务（只有 agg/valid 两个开关）。
     不迁移的话，阶段引擎读不到 dataPrep/qc/stats/review/release 会一律判为「未完成」，
     用户看到的是「明明做完了却卡在第一步」。这里按已有进度**保守回填**：
     只补齐结构、不虚构用户没做过的动作（未做的仍留空，让流程如实卡住）。 */
  function migrateTask(t) {
    if (!t) return t;
    if (!t.dataVersion) t.dataVersion = 'DV-' + (t.year || '0000') + '-M';
    if (!t.dataPrep) {
      t.dataPrep = {
        sources: (t.agg && t.agg.done) ? seedDataSources('all') : seedDataSources('none'),
        dedupDone: !!(t.agg && t.agg.done),
        dedupAt: (t.agg && t.agg.done) ? (t.createdAt || '') : '',
        dupRemoved: (t.agg && t.agg.result) ? (t.agg.result.dup || 0) : 0,
        multiPrimary: (t.agg && t.agg.result) ? (t.agg.result.multiPrimary || 0) : 0,
        unlocated: (t.agg && t.agg.result) ? (t.agg.result.unlocated || 0) : 0,
        fieldsChecked: !!(t.agg && t.agg.done),
        fieldsAt: (t.agg && t.agg.done) ? (t.createdAt || '') : ''
      };
    }
    if (!t.qc) {
      t.qc = {
        done: !!(t.valid && t.valid.done),
        runAt: (t.valid && t.valid.done) ? (t.createdAt || '') : '',
        issues: (t.valid && t.valid.done) ? seedQcIssues('clean') : [],
        kpis: (t.valid && t.valid.done) ? seedQcKpis(true) : []
      };
    }
    if (!t.stats) t.stats = seedStats(!!(t.valid && t.valid.done));
    if (!t.review) {
      t.review = (t.status === 'approved' || t.status === 'published' || t.status === 'archived') ? seedReview('pass') : { rounds: [] };
    }
    if (!t.release) {
      t.release = (t.status === 'published' || t.status === 'archived') ? seedRelease(t.status === 'archived' ? 'archived' : 'published') : {};
    }
    if (!t.stageLog) {
      t.stageLog = [{ at: t.createdAt || '', action: '创建任务', from: '', to: 'task', note: '（历史数据迁移补录）', by: t.createdBy || '省级上报岗' }];
    }
    // 工作位：老数据没有 t.stage，首次迁移时按已有产物推导一次并固化，
    // 之后产物再变化也不会自动跳阶段——阶段推进必须由人显式确认。
    if (!t.stage || !(window.AR_STAGES && window.AR_STAGES.byId(t.stage))) {
      t.stage = window.AR_STAGES ? window.AR_STAGES.deriveStage(t, ARH) : 'task';
    }
    return t;
  }
  /* 阶段引擎的宿主依赖：把站内函数注入，避免引擎反向依赖本文件。
     注意：必须在 migrateTask 之前定义——迁移时要靠它推导工作位。 */
  var ARH = { chapterDone: chapterDone, chapterTotal: chapterTotal };
  /* 迁移结果立即落盘：否则每次刷新都重新推导一次工作位，
     用户在阶段里的推进（t.stage）会被推导值覆盖掉。 */
  (function migrateAll() {
    var changed = false;
    tasks.forEach(function (t) {
      if (!t.stage || !(t.dataPrep && t.qc && t.stats && t.review && t.release)) changed = true;
      migrateTask(t);
    });
    if (changed) saveLS(LS.tasks, tasks);
  })();

  var arState = {
    page: "ar-tasks",
    currentTaskId: (function () { try { return localStorage.getItem(LS.cur) || "AR-2024-0001"; } catch (e) { return "AR-2024-0001"; } })(),
    section: "overview", viewStage: "", statView: null, issueView: null, chartTab: "pyramid", editChapter: "ch1", taskTab: "tasks",
    filters: { year: "", keyword: "", status: "" },
    tplView: "list", tplEditingId: null, editSectionId: null, tplPreview: null, reportPreview: null,
    advOpen: false, gen: { running: false, pct: 0, step: "" }
  };

  function persist() {
    saveLS(LS.tasks, tasks); saveLS(LS.templates, templates); saveLS(LS.subs, submissions); saveLS(LS.arch, archives);
    try { localStorage.setItem(LS.cur, arState.currentTaskId || ""); } catch (e) {}
  }
  function curTask() { for (var i = 0; i < tasks.length; i++) if (tasks[i].id === arState.currentTaskId) return tasks[i]; return null; }
  function taskById(id) { for (var i = 0; i < tasks.length; i++) if (tasks[i].id === id) return tasks[i]; return null; }
  function tplById(id) { for (var i = 0; i < templates.length; i++) if (templates[i].id === id) return templates[i]; return templates[0]; }
  function touch(t) { t.updatedAt = nowStr(); persist(); }

  /* ===================== 5. 工具 ===================== */
  function nowStr() { var d = new Date(); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes()); }
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function e(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n) { return Number(n || 0).toLocaleString(); }
  function f1(n) { return Number(n || 0).toFixed(1); }
  function badge(cls, text) { return '<span class="badge badge-' + cls + '">' + text + '</span>'; }
  function statusBadge(s) { var m = TASK_STATUS[s] || TASK_STATUS.draft; return badge(m.cls, m.label); }
  function tplTypeName(type) { for (var i = 0; i < TPL_TYPES.length; i++) if (TPL_TYPES[i].id === type) return TPL_TYPES[i].name; return type; }
  function scopeLabel(t) { if (!t) return ""; if (t.scope === "city") return t.cities.length === 0 ? "未选择设区市" : "已选 " + t.cities.length + " 个设区市"; return "全省（11 设区市）"; }
  function regionName(id) { for (var i = 0; i < REGIONS.length; i++) if (REGIONS[i].id === id) return REGIONS[i].name; return id; }
  function regionInc(r) { return Math.round(r.pop / 100000 * r.incRate); }
  function regionDeath(r) { return Math.round(r.pop / 100000 * r.deathRate); }
  function qcTone(val, kind) {
    if (kind === "mv") return (val >= QC_THRESH.mvMin && val <= QC_THRESH.mvMax) ? "ok" : "bad";
    if (kind === "dco") return val <= QC_THRESH.dco ? "ok" : "bad";
    if (kind === "ub") return val <= QC_THRESH.ub ? "ok" : "warn";
    if (kind === "ou") return val <= QC_THRESH.ou ? "ok" : "warn";
    if (kind === "hv") return val >= QC_THRESH.hvMin ? "ok" : "warn";
    if (kind === "mi") return (val >= QC_THRESH.miLow && val <= QC_THRESH.miHigh) ? "ok" : "warn";
    return "ok";
  }
  function metric(k, v, sub, death) { return '<div class="ar-metric' + (death ? ' death' : '') + '"><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>'; }
  function buildPyramid() {
    var wM = [150,190,240,340,500,720,930,1140,1490,2110,3110,4580,6390,7330,6600,4790,2540,1180];
    var wF = [120,155,205,310,445,655,865,1075,1405,1960,2870,4110,5415,5955,5235,3630,1815,830];
    var sumM = 0, sumF = 0, i;
    for (i = 0; i < 18; i++) { sumM += wM[i]; sumF += wF[i]; }
    var targetM = AGG_RESULT.valid * 0.5633, targetF = AGG_RESULT.valid - targetM, out = [];
    for (i = 0; i < 18; i++) out.push({ age: AGE18[i], male: Math.round(wM[i] / sumM * targetM), female: Math.round(wF[i] / sumF * targetF) });
    return out;
  }
  function lifecycleTimeline(t) {
    var steps = [
      { key: 'created', label: '创建', at: t.createdAt },
      { key: 'submitted', label: '提交审核', at: t.submittedAt },
      { key: 'approved', label: '审核通过', at: t.approvedAt },
      { key: 'published', label: '发布', at: t.publishedAt },
      { key: 'archived', label: '归档', at: t.archivedAt }
    ];
    if (t.status === 'voided') steps.push({ key: 'voided', label: '作废', at: t.updatedAt });
    var order = ['draft','submitted','approved','published','archived'];
    var curIdx = order.indexOf(t.status);
    return '<div class="ar-timeline">' + steps.map(function (s, i) {
      var reached = s.key === 'created' || (order.indexOf(s.key) >= 0 && order.indexOf(s.key) <= curIdx) || (s.key === 'voided');
      var isCur = s.key === t.status || (s.key === 'created' && t.status === 'draft' && !t.submittedAt);
      var cls = 'ar-tl-node' + (reached ? ' done' : '') + (isCur ? ' current' : '');
      return '<div class="' + cls + '"><span class="dot"></span><div class="tl-label">' + s.label + '</div><div class="tl-time">' + (s.at ? e(s.at) : '—') + '</div></div>';
    }).join('<span class="ar-tl-line"></span>') + '</div>';
  }
  function pageToolbar(title) {
    return '<div class="page-toolbar" style="margin-bottom:14px"><div style="font-size:16px;font-weight:700;color:#1f2937;display:flex;align-items:center;gap:8px"><span style="width:4px;height:18px;background:var(--primary);border-radius:2px;display:inline-block"></span>' + title + '</div>' + '</div>';
  }

  window.arSwitchTaskTab = function (k) { arState.taskTab = (k === 'subs') ? 'subs' : 'tasks'; renderPage('ar-tasks'); };

  /* ---------- 操作列统一渲染：状态决定可用性，槽位恒定出现（不可用置灰占位 + 悬停说明原因） ---------- */
  // cfg: { label, cls, fn, arg, on:boolean, tip:string }
  function opBtn(cfg) {
    var on = cfg.on !== false;
    return '<span class="op-slot"' + (cfg.tip ? ' title="' + e(cfg.tip) + '"' : '') + '>' +
      '<button class="btn ' + cfg.cls + ' btn-xs" aria-disabled="' + (on ? 'false' : 'true') + '"' + (on ? '' : ' disabled') +
      (on ? ' onclick="' + cfg.fn + '(\'' + cfg.arg + '\')"' : '') + '>' + cfg.label + '</button></span>';
  }
  function opRow(cells) { return '<span class="ar-ops">' + cells.join('') + '</span>'; }

  /* 状态 → 可执行动作：台账按钮、查看页按钮、提示文案共用同一份规则，避免各处判断漂移 */
  function taskCaps(t) {
    var label = (TASK_STATUS[t.status] || TASK_STATUS.draft).label;
    var editable = t.status === 'draft' || t.status === 'submitted' || t.status === 'approved' || t.status === 'published';
    var deletable = t.status === 'draft' || t.status === 'voided';
    var editWhy = '仅草稿、待审核、待发布、已发布的年报可编制';
    if (t.status === 'archived') editWhy = '已归档为定稿记录，只读留痕，不可再编制；如需修订请新建年报';
    else if (t.status === 'voided') editWhy = '已作废记录不可再编制，请新建年报重新编制';
    return {
      edit: editable,
      del: deletable,
      editWhy: editWhy,
      delWhy: deletable ? '' : label + '的年报属于正式业务留痕，不可删除；仅草稿与已作废记录可删除'
    };
  }
  function taskOps(t) {
    var c = taskCaps(t);
    return opRow([
      opBtn({ label: '查看', cls: 'btn-ghost', fn: 'arViewTask', arg: t.id }),
      opBtn({ label: '编制', cls: 'btn-primary', fn: 'arOpenTask', arg: t.id, on: c.edit, tip: c.edit ? '' : c.editWhy }),
      opBtn({ label: '删除', cls: 'btn-ghost', fn: 'arDeleteTask', arg: t.id, on: c.del, tip: c.del ? '' : c.delWhy })
    ]);
  }
  var OPS_RULE = '<div class="ar-ops-rule"><b>操作按年报状态开放：</b>' +
    '<span>草稿 查看·编制·删除</span><span class="sep">|</span>' +
    '<span>待审核 / 待发布 / 已发布 查看·编制</span><span class="sep">|</span>' +
    '<span>已归档 仅查看（定稿只读）</span><span class="sep">|</span>' +
    '<span>已作废 查看·删除</span><span class="sep">|</span>' +
    '<span>灰色按钮为当前状态不可用，鼠标悬停可见原因</span></div>';

  /* 旧版 7 段展示进度条（FLOW_STEPS / taskFlowIndex / flowStepper）已由阶段导轨
     renderStageRail 取代：那条只按 status 猜位置、不可推进也不校验准入。此处不再保留实现。 */

  // 台账「进度」列：显示当前阶段 + 关键阶段产物徽章（取数 / 质控 / 正文）
  function taskProgress(t) {
    var A = AR();
    if (t.status === 'voided') {
      return '<div class="ar-prog"><span class="ar-prog-chip bad">✕ 已作废</span></div>';
    }
    var cur = A.currentStage(t, ARH);
    var idx = A.indexOf(cur);
    var chip = function (label, tone) {
      var ic = tone === 'ok' ? '✓' : tone === 'bad' ? '✕' : tone === 'todo' ? '…' : '·';
      return '<span class="ar-prog-chip ' + tone + '">' + ic + ' ' + label + '</span>';
    };
    var cd = chapterDone(t), ct = chapterTotal(t);
    var q = A.summaries.qc(t);
    var stagesDone = A.list.filter(function (s) { return A.stageDone(t, s.id, ARH); }).length;
    return '<div class="ar-prog">' +
      '<span class="ar-prog-stage">阶段 ' + (idx + 1) + '/7 · ' + A.byId(cur).short + '</span>' +
      chip('取数', (t.dataPrep && t.dataPrep.dedupDone) ? 'ok' : 'todo') +
      chip('质控', q.openBad > 0 ? 'bad' : (t.qc && t.qc.done) ? 'ok' : 'todo') +
      chip('正文 ' + cd + '/' + ct, ct > 0 && cd >= ct ? 'ok' : 'todo') +
      '<span class="ar-prog-bar"><i style="width:' + Math.round(stagesDone / 7 * 100) + '%"></i></span>' +
      '</div>';
  }
  /* 旧版「下一步」引导条（nextStepInfo / renderFlowBar）已由准入闸门横幅 renderGateBanner 取代。
     刻意不保留实现：它按 status + 两个布尔开关给出建议，与阶段模型是两套判断，留着必然漂移。 */
/* ===================== 6. 年报记录台账 ===================== */
  function renderTasks() {
    if (arState.taskTab === 'subs') return renderSubmissions();
    var f = arState.filters;
    var list = tasks.filter(function (t) {
      if (f.year && String(t.year) !== f.year) return false;
      if (f.status && t.status !== f.status) return false;
      if (f.keyword) { var kw = String(f.keyword).toLowerCase(); if (t.title.toLowerCase().indexOf(kw) < 0 && t.id.toLowerCase().indexOf(kw) < 0) return false; }
      return true;
    });
    var filterHtml = '<div class="filter-toolbar">' +
      '<div class="form-group"><label>报告年度</label><select onchange="arSetFilter(\'year\',this.value)">' +
      '<option value="">全部年度</option>' + ['2024','2023','2022'].map(function (y) { return '<option value="' + y + '"' + (f.year === y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label>状态</label><select onchange="arSetFilter(\'status\',this.value)">' +
      '<option value="">全部状态</option>' + [
        { l: '草稿', v: 'draft' },
        { l: '待审核', v: 'submitted' },
        { l: '待发布', v: 'approved' },
        { l: '已发布', v: 'published' },
        { l: '已归档', v: 'archived' },
        { l: '已作废', v: 'voided' }
      ].map(function (s) { return '<option value="' + s.v + '"' + (f.status === s.v ? ' selected' : '') + '>' + s.l + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group search-group"><label>关键字</label><input type="text" placeholder="任务编号 / 标题" value="' + e(f.keyword) + '" onchange="arSetFilter(\'kw\',this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="arNewTask()">新建年报</button><button class="btn btn-ghost btn-sm" onclick="arResetFilter()">重置</button></div>' +
      '</div>';

    var rows = list.map(function (t) {
      return '<tr><td class="code" style="font-size:12px;color:#334155">' + t.id + '</td>' +
        '<td class="txt" style="font-size:13px;color:#1f2937;font-weight:600">' + e(t.title) + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + t.year + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + t.version + '</td>' +
        '<td class="code">' + statusBadge(t.status) + '</td>' +
        '<td class="txt">' + taskProgress(t) + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + t.updatedAt + '</td>' +
        '<td class="ops">' + taskOps(t) + '</td></tr>';
    }).join('');

    return pageToolbar('年报记录') + '<div class="panel" style="margin-bottom:16px"><div class="panel-body">' +
      filterHtml +
      OPS_RULE +
      (list.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:36px 18px;font-size:13px">暂无符合条件的年报记录，点击右上角「新建年报」开始编制。</div>' :
        '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:1240px"><colgroup><col style="width:132px"><col><col style="width:66px"><col style="width:66px"><col style="width:88px"><col style="width:330px"><col style="width:150px"><col style="width:200px"></colgroup><thead><tr>' +
        '<th class="code">任务编号</th><th class="txt">年报标题</th><th class="code">年度</th><th class="code">版本</th><th class="code">状态</th><th class="txt">编制进度</th><th class="code">更新时间</th><th class="ops">操作</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>') +
      '</div></div>';
  }

  /* ===================== 6.5 年报记录查看（只读详情） ===================== */
  // 构建报告全文预览 HTML（封面 + 目录 + 八章正文），供查看页与「预览报告全文」按钮共用
  function buildReportPreviewHtml(t) {
    var chs = activeTemplateChapters(t);
    var cover = '<div class="ar-page" style="min-height:auto">' +
      '<div class="doc-h1" style="margin-top:36px;font-size:24px">' + e(t.title) + '</div>' +
      '<div class="doc-sub" style="margin-bottom:36px">江西省肿瘤登记中心　' + e(t.year) + ' 年度　' + e(t.version) + '</div>' +
      '<h4 class="doc-sec">目　录</h4><div style="margin:6px 0 0">' +
      chs.map(function (c, i) {
        return '<div style="display:flex;align-items:baseline;gap:8px;font-size:13.5px;line-height:2.1;color:#1f2937"><span style="min-width:64px">第' + CN_NO[i] + '章</span><span>' + e(c.title) + '</span><span style="flex:1;border-bottom:1px dotted #cbd5e1;margin:0 6px"></span><span style="color:#94a3b8;font-size:12px">' + (t.chapters[c.id] ? '已编制' : '待编制') + '</span></div>';
      }).join('') + '</div></div>';
    var pages = chs.map(function (c, i) {
      var ct = chapterTemplate(templateSourceForTask(t), c.id);
      var body = t.chapters[c.id] || buildChapterHtml(t, c.id);
      var head = (!ct.rules || ct.rules.showTitle !== false) ? '<h3 class="doc-ch">第' + CN_NO[i] + '章　' + e(c.title) + '</h3>' : '';
      var src = (ct.rules && ct.rules.showSource && ct.dataSource) ? '<p class="doc-cap" style="text-align:left">数据来源：' + e(ct.dataSource) + '</p>' : '';
      return '<div class="ar-page">' + head + body + src + '</div>';
    }).join('');
    return cover + pages;
  }

  // 只读版数据质量（仪表盘 + 规则表，不含问题清单的操作按钮）
  function sectionQualityView(t) {
    var v = t.valid || { done: false, result: null };
    var rules = VALIDATE_RULES.slice();
    var qcPass = QC_PROV.mv >= QC_THRESH.mvMin && QC_PROV.mv <= QC_THRESH.mvMax && QC_PROV.dco <= QC_THRESH.dco && QC_PROV.mi >= QC_THRESH.miLow && QC_PROV.mi <= QC_THRESH.miHigh && QC_PROV.ou <= QC_THRESH.ou && QC_PROV.ub <= QC_THRESH.ub;
    if (v.done) {
      if (v.result && v.result.bad > 0) { rules[1].status = 'warn'; rules[3].status = 'bad'; }
      else { for (var ri = 0; ri < rules.length; ri++) rules[ri].status = 'ok'; }
      for (var qi = 0; qi < rules.length; qi++) if (rules[qi].id === 'qc') rules[qi].status = qcPass ? 'ok' : 'warn';
    }
    function gaugeV(label, val, unit, tone, note) {
      return '<div class="viz-gauge"><div class="viz-gauge-label">' + label + '</div>' +
        '<div class="viz-gauge-val" style="color:' + (tone === 'bad' ? '#b42318' : tone === 'warn' ? '#b54708' : 'var(--primary)') + '">' + val + unit + '</div>' +
        '<div class="viz-gauge-bar"><div class="viz-gauge-fill" style="width:' + (label.indexOf('M/I') === 0 ? Math.min(100, val / 1.2 * 100) : Math.min(100, val)) + '%;background:' + (tone === 'bad' ? '#ef4444' : tone === 'warn' ? '#f59e0b' : 'var(--primary)') + '"></div></div>' +
        '<div style="font-size:11px;color:#64748b;margin-top:5px">' + note + '</div></div>';
    }
    var rulesRows = rules.map(function (rule) {
      var b;
      if (!v.done) b = badge('neutral', '待校验');
      else if (rule.status === 'bad') b = badge('danger', '错误');
      else if (rule.status === 'warn') b = badge('warning', '警告');
      else b = badge('success', '通过');
      return '<tr><td class="txt" style="font-size:13px;color:#1f2937">' + rule.name + '</td>' +
        '<td class="txt" style="font-size:12px;color:#64748b">' + rule.desc + '</td>' +
        '<td class="code">' + b + '</td></tr>';
    }).join('');
    return '<div class="panel" style="margin-bottom:16px"><div class="panel-header">数据质量校验<div class="toolbar-actions"><span class="ar-hint">' + (v.done ? '校验完成 · ' + v.result.ok + ' 项通过' : '未校验') + '</span></div></div><div class="panel-body">' +
      '<div class="ar-qc-grid" style="margin-bottom:14px">' +
      gaugeV('MV% 病理/细胞学证实', QC_PROV.mv, '%', qcTone(QC_PROV.mv, 'mv'), '阈值 ' + QC_THRESH.mvMin + '%–' + QC_THRESH.mvMax + '%（过高提示漏报）') +
      gaugeV('HV% 组织学证实', QC_PROV.hv, '%', qcTone(QC_PROV.hv, 'hv'), '阈值 ≥ ' + QC_THRESH.hvMin + '%') +
      gaugeV('DCO% 仅死亡补发病', QC_PROV.dco, '%', qcTone(QC_PROV.dco, 'dco'), '阈值 ≤ ' + QC_THRESH.dco + '%') +
      gaugeV('M/I 死亡发病比', QC_PROV.mi, '', qcTone(QC_PROV.mi, 'mi'), '参考 ' + QC_THRESH.miLow + '–' + QC_THRESH.miHigh) +
      gaugeV('UB% 原发部位不明', QC_PROV.ub, '%', qcTone(QC_PROV.ub, 'ub'), '阈值 ≤ ' + QC_THRESH.ub + '%') +
      gaugeV('O&U% 其他及未指明部位', QC_PROV.ou, '%', qcTone(QC_PROV.ou, 'ou'), '阈值 ≤ ' + QC_THRESH.ou + '%') +
      '</div></div></div>' +
      '<div class="panel" style="margin-bottom:16px"><div class="panel-body" style="padding-top:8px">' +
      '<table class="data-table" style="width:100%;min-width:0"><thead><tr><th class="txt">校验规则</th><th class="txt">说明</th><th class="code">状态</th></tr></thead><tbody>' + rulesRows + '</tbody></table></div></div>';
  }

  // 只读版导出与发布信息（格式 / 渠道 / 本记录上报记录 / 归档文件）
  function sectionExportView(t) {
    var cfg = t.exportCfg || { format: 'pdf', ci5: true, channels: ['nccr'] };
    var fmtLabel = cfg.format === 'word' ? 'Word' : cfg.format === 'excel' ? 'Excel' : 'PDF';
    var chNames = (cfg.channels && cfg.channels.length ? cfg.channels : ['nccr']).map(function (c) {
      for (var i = 0; i < CHANNELS.length; i++) if (CHANNELS[i].id === c) return CHANNELS[i].label;
      return c;
    }).join('、') || '—';
    var subRows = submissions.filter(function (s) { return s.taskId === t.id; }).map(function (s) {
      return '<tr><td class="txt" style="font-size:12px;color:#334155">' + s.id + '</td>' +
        '<td class="code" style="font-size:12px;color:#1f2937">' + e(s.channelLabel) + '</td>' +
        '<td class="num" style="font-size:12px;color:#64748b">' + (s.ci5 ? 'PDF + CI5/IARC' : s.format.toUpperCase()) + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + s.status + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + (s.receiptNo || '—') + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + s.sentAt + '</td></tr>';
    }).join('');
    var archRow = archives.filter(function (a) { return a.taskId === t.id; }).map(function (a) {
      return '<tr><td class="code" style="font-size:13px;color:#1f2937">' + e(a.fileName) + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + a.year + ' · ' + a.version + '</td>' +
        '<td class="num" style="font-size:12px;color:#64748b">' + a.pages + ' 页 · ' + a.size + '</td>' +
        '<td class="code">' + badge('neutral', a.status) + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + a.archivedAt + ' · ' + e(a.archivedBy) + '</td></tr>';
    }).join('');
    return '<div class="panel" style="margin-bottom:16px"><div class="panel-header">导出与发布信息</div><div class="panel-body">' +
      '<div class="ar-ctx-line"><span>输出格式 <b>' + fmtLabel + (cfg.ci5 ? ' + CI5/IARC' : '') + '</b></span><span>上报渠道 <b>' + e(chNames) + '</b></span>' +
      (cfg.govFiling ? '<span>省卫健委备案 <b>是</b></span>' : '') + (cfg.bigScreen ? '<span>同步大屏 <b>是</b></span>' : '') + '</div>' +
      '</div></div>' +
      '<div class="panel" style="margin-bottom:16px"><div class="panel-header">本记录上报记录</div><div class="panel-body" style="padding-top:8px">' +
      (subRows ? '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:0"><colgroup><col><col style="width:96px"><col><col style="width:96px"><col><col style="width:170px"></colgroup><thead><tr><th class="txt">上报编号</th><th class="code">渠道</th><th class="code">数据包</th><th class="code">状态</th><th class="code">回执号</th><th class="code">上报时间</th></tr></thead><tbody>' + subRows + '</tbody></table></div>' : '<div style="color:#94a3b8;font-size:12px;padding:10px">暂无上报记录</div>') +
      '</div></div>' +
      (archRow ? '<div class="panel" style="margin-bottom:16px"><div class="panel-header">归档文件</div><div class="panel-body" style="padding-top:8px">' +
      '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:0"><colgroup><col><col style="width:120px"><col><col style="width:96px"><col style="width:170px"></colgroup><thead><tr><th class="code">文件名</th><th class="code">年度/版本</th><th class="code">页数/大小</th><th class="code">状态</th><th class="code">归档时间/人</th></tr></thead><tbody>' + archRow + '</tbody></table></div></div></div>' : '');
  }

  // 查看页面：只读详情，复用数据概览 / 指标图表，质量与导出用只读版，报告正文用全文预览
  function renderView() {
    var t = curTask();
    if (!t) {
      return pageToolbar('年报记录') + '<div class="panel"><div class="panel-body"><div style="text-align:center;color:#94a3b8;padding:40px 16px">尚未选择年报记录，请先到「年报记录」列表选择一条记录。<br><br><button class="btn btn-primary" onclick="arGoPage(\'ar-tasks\')">去年报记录</button></div></div></div>';
    }
    var popCalTxt = t.popCal === 'household' ? '户籍人口' : '常住人口';
    var stdPopTxt = t.stdPop === 'world' ? 'Segi 世界标准人口' : '中国 2000 年标准人口';
    var canEdit = taskCaps(t).edit;
    var head = '<div class="page-toolbar" style="margin-bottom:12px">' +
      '<div style="font-size:16px;font-weight:700;color:#1f2937;display:flex;align-items:center;gap:8px"><span style="width:4px;height:18px;background:var(--primary);border-radius:2px;display:inline-block"></span>' + e(t.title) + '</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + statusBadge(t.status) + badge('neutral', '版本 ' + t.version) +
      '<button class="btn btn-ghost btn-sm" onclick="arGoPage(\'ar-tasks\')">返回列表</button>' +
      (canEdit ? '<button class="btn btn-primary btn-sm" onclick="arOpenTask(\'' + t.id + '\')">去编制</button>'
               : '<button class="btn btn-primary btn-sm" disabled title="' + e(taskCaps(t).editWhy) + '">去编制</button>') +
      '</div></div>';
    var info = '<div class="panel" style="margin-bottom:16px"><div class="panel-body">' +
      '<div class="ar-ctx-line"><span>任务编号 <b>' + e(t.id) + '</b></span><span>年度 <b>' + e(t.year) + '</b></span>' +
      '<span>覆盖范围 <b>' + e(scopeLabel(t)) + '</b></span><span>人口口径 <b>' + popCalTxt + '</b></span>' +
      '<span>标准人口 <b>' + stdPopTxt + '</b></span><span>癌种 <b>' + e(t.cancer) + '</b></span></div>' +
      '<div class="ar-ctx-line" style="margin-top:8px"><span>创建人 <b>' + e(t.createdBy || '—') + '</b></span><span>创建时间 <b>' + e(t.createdAt || '—') + '</b></span>' +
      '<span>更新时间 <b>' + e(t.updatedAt || '—') + '</b></span>' +
      (t.submittedAt ? '<span>提交审核 <b>' + e(t.submittedAt) + '</b></span>' : '') +
      (t.approvedAt ? '<span>审核通过 <b>' + e(t.approvedAt) + '</b></span>' : '') +
      (t.publishedAt ? '<span>发布 <b>' + e(t.publishedAt) + '</b></span>' : '') +
      (t.archivedAt ? '<span>归档 <b>' + e(t.archivedAt) + '</b></span>' : '') +
      (t.voidReason ? '<span style="color:#b42318">作废原因 <b>' + e(t.voidReason) + '</b></span>' : '') +
      '</div></div></div>';
    var timeline = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">生命周期</div><div class="panel-body">' + lifecycleTimeline(t) + '</div></div>';
    var reportHtml = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">报告正文（全文预览）</div><div class="panel-body" style="background:#eef1f5"><div class="ar-doc-scroll" style="max-height:680px;display:flex;flex-direction:column;gap:18px">' + buildReportPreviewHtml(t) + '</div></div></div>';
    var secHtml = arSection('overview', sectionOverview(t)) +
      arSection('quality', sectionQualityView(t)) +
      arSection('metrics', sectionMetrics(t)) +
      arSection('report', reportHtml) +
      arSection('export', sectionExportView(t));
    return head + info + timeline + secHtml;
  }

  window.arViewTask = function (id) {
    var t = taskById(id); if (!t) return;
    arState.currentTaskId = id; arState.reportPreview = null;
    persist(); goPage('ar-view');
  };

  /* ===================== 7. 编制工作台（阶段化 · 准入闸门） =====================
     旧版把「数据概览 / 数据质量 / 指标图表 / 正文 / 导出」做成 5 个平铺分区，
     任意跳转、无前置条件，等于示意。现在改为：7 个阶段串成一条状态机，
     主区只渲染「当前阶段工作区」，跨阶段跳转须过准入闸门。 */
  /* 只读查看页（ar-view）仍按 5 个平铺分区展示；工作台一律走阶段模型。
     保留 SECTIONS 定义以免查看页与旧的 section* 渲染函数失效。 */
  var SECTIONS = [
    { id: "overview", label: "数据概览", title: "数据概览", desc: "跨库取数与省市分层汇总结果" },
    { id: "quality", label: "数据质量", title: "数据质量校验", desc: "对标国家登记质量考核阈值" },
    { id: "metrics", label: "指标与图表", title: "核心指标与图表", desc: "省级统一口径的标化率与可视化" },
    { id: "report", label: "报告正文", title: "年报正文（八章）", desc: "按汇总数据自动生成，可人工校订" },
    { id: "export", label: "导出与发布", title: "导出与发布", desc: "多格式导出、国家平台上报与归档" }
  ];
  /* 旧版一键生成的进度文案表（GEN_STEPS / genStepLabel）随流水线一并移除 */
  function chapterDone(t) { return activeTemplateChapters(t).filter(function (c) { return !!t.chapters[c.id]; }).length; }
  function chapterTotal(t) { return activeTemplateChapters(t).length; }

  /* 阶段引擎的宿主依赖 ARH 已在数据迁移前定义（见 §4 末尾） */
  /* 兜底：若 annual-report-stages.js 未加载（老页面缓存 / 单文件调试），
     给出一个「全放行」的退化实现，让工作台仍能渲染而不是整页报错。
     真机上两个脚本由 app.html 一并引入，走的始终是完整引擎。 */
  function AR() {
    if (window.AR_STAGES) return window.AR_STAGES;
    if (!window.__arStagesFallback) {
      var ids = ['task', 'data', 'qc', 'stats', 'draft', 'review', 'release'];
      var names = ['建立任务', '数据准备', '质量校验', '统计分析', '正文编制', '审核', '发布归档'];
      var list = ids.map(function (id, i) {
        return { id: id, no: i + 1, name: names[i], short: names[i], desc: '', owner: '', artifacts: [], hint: '' };
      });
      var byId = {};
      list.forEach(function (s) { byId[s.id] = s; });
      window.__arStagesFallback = {
        list: list, byId: function (id) { return byId[id]; },
        indexOf: function (id) { return ids.indexOf(id); },
        evalGate: function () { return { ok: true, blockers: [], warns: [] }; },
        stageDone: function () { return false; },
        currentStage: function () { return 'task'; },
        canAdvance: function () { return { can: false, from: null, to: 'task', gate: { ok: true, blockers: [], warns: [] }, reason: '阶段引擎未加载' }; },
        logStage: function () {},
        summaries: {
          dataSources: function () { return []; }, qc: function () { return { total: 0, closed: 0, waived: 0, open: 0, openBad: 0, openWarn: 0, issues: [] }; },
          stats: function () { return { done: false, tables: [], charts: [], tableN: 0, chartN: 0, stale: false }; },
          draft: function (t, ct, cd) { return { total: ct ? ct(t) : 0, done: cd ? cd(t) : 0, complete: false }; },
          review: function () { return { rounds: [], last: null, pending: 0, passed: false }; },
          release: function () { return { approved: false, packageBuilt: false, receiptNo: '', receiptAt: '', archivedAt: '' }; }
        },
        sourceStateLabel: function (s) { return s; },
        sourceStandalone: function (s) { return s; }
      };
      if (window.console && console.warn) console.warn('[annual-report] annual-report-stages.js 未加载，阶段引擎退化为全放行模式');
    }
    return window.__arStagesFallback;
  }
  function curStageId(t) { return AR().currentStage(t, ARH); }

  window.arNowStr = nowStr;

  /* 顶部状态动作：按任务状态开放。发布/归档动作现在由「发布归档」阶段工作区承载，
     这里只保留跨状态的快捷动作，避免同一动作在页面出现两处。 */
  function workbenchActions(t) {
    var html = '';
    if (t.status === 'submitted') {
      html += '<button class="btn btn-warning btn-sm" onclick="arReturn()">退回修改</button> ';
    }
    if ((t.status === 'draft' || t.status === 'submitted')) html += '<button class="btn btn-danger btn-sm" onclick="arVoid()">作废</button> ';
    return html;
  }

  /* ---------- 阶段导轨：7 段，已完成打勾、当前高亮、可回看不可越级 ---------- */
  function renderStageRail(t) {
    if (!t) return '';
    var cur = curStageId(t);
    var curIdx = AR().indexOf(cur);
    var voided = t.status === 'voided';
    var nodes = AR().list.map(function (s, i) {
      var done = AR().stageDone(t, s.id, ARH);
      var isCur = s.id === cur && !voided;
      var cls = 'ar-stage-node';
      if (voided) cls += ' void';
      else if (isCur) cls += ' cur';
      else if (done) cls += ' done';
      else if (i > curIdx) cls += ' locked';
      // 已完成的阶段可回看；未到达的阶段点击会被闸门拦下（仍给点击，好让用户知道差什么）
      var gate = AR().evalGate(s.id, t, ARH);
      var canEnter = voided ? (s.id === 'task') : (i <= curIdx || (i === curIdx + 1 && gate.ok));
      var tip = '';
      if (voided) tip = '该年报已作废，仅保留留痕';
      else if (!canEnter && i > curIdx + 1) tip = '需先完成前置阶段：' + AR().list.slice(curIdx, i).map(function (x) { return x.name; }).join(' → ');
      else if (!canEnter && i === curIdx + 1) tip = '尚未满足「' + AR().byId(cur).name + '」的准入条件';
      return '<button class="' + cls + '"' + (canEnter ? '' : ' disabled') +
        (tip ? ' title="' + e(tip) + '"' : '') +
        ' onclick="arGoStage(\'' + s.id + '\')">' +
        '<span class="n">' + (done && !isCur ? '✓' : s.no) + '</span>' +
        '<span class="l">' + s.short + '</span></button>' +
        (i < AR().list.length - 1 ? '<span class="ar-stage-line' + (i < curIdx ? ' done' : '') + '"></span>' : '');
    }).join('');
    var pct = Math.round((voided ? 0 : curIdx) / (AR().list.length - 1) * 100);
    return '<div class="ar-stage-rail' + (voided ? ' void' : '') + '">' + nodes +
      '<span class="ar-stage-pct">流程进度 <b>' + pct + '%</b></span></div>';
  }

  /* ---------- 准入横幅：当前阶段能不能推进 / 卡在哪 / 去哪补 ---------- */
  function renderGateBanner(t) {
    if (!t) return '';
    if (t.status === 'voided') {
      return '<div class="ar-gate void"><span class="g-tag">已作废</span>' +
        '<div class="g-body"><div class="g-title">该年报已作废，编制流程终止</div>' +
        '<div class="g-sub">作废原因：' + e(t.voidReason || '—') + '。留痕可查；如需继续编制请新建年报。</div></div>' +
        '<div class="g-act"><button class="btn btn-primary btn-sm" onclick="arNewTask()">新建年报</button></div></div>';
    }
    var cur = curStageId(t);
    var stage = AR().byId(cur);
    var curGate = AR().evalGate(cur, t, ARH);   // 当前阶段「能不能离开」
    var adv = AR().canAdvance(t, ARH);
    var prev = adv.from ? AR().byId(adv.from) : null;

    var body;
    if (curGate.ok && adv.to) {
      // 当前阶段产物齐备 → 可推进
      var nextStage = AR().byId(adv.to);
      body = '<div class="g-title">「' + stage.name + '」已完成，可推进' + (nextStage ? '至「' + nextStage.name + '」' : '') + '</div>' +
        '<div class="g-sub">阶段产物已齐备：' + stage.artifacts.join(' · ') + '。' + (nextStage ? nextStage.desc : '') + '</div>';
      if (curGate.warns && curGate.warns.length) {
        body += '<div class="g-warns">' + curGate.warns.map(function (w) { return '<div>⚠ ' + e(w.text) + '</div>'; }).join('') + '</div>';
      }
    } else if (curGate.ok) {
      body = '<div class="g-title">「' + stage.name + '」已完成，处于最终阶段</div>' +
        '<div class="g-sub">阶段产物已齐备：' + stage.artifacts.join(' · ') + '</div>';
    } else {
      body = '<div class="g-title">「' + stage.name + '」尚有 ' + curGate.blockers.length + ' 项条件未满足，暂不可推进</div>' +
        '<div class="g-sub">' + stage.desc + '</div>' +
        (prev ? '<div class="g-sub" style="margin-top:2px">前置阶段「' + prev.name + '」已通过。</div>' : '') +
        '<ul class="g-blockers">' + curGate.blockers.map(function (b) {
          var act = b.action && b.action.fn ? '<button class="btn btn-outline btn-sm" onclick="' + b.action.fn + '(' + (b.action.arg ? '\'' + b.action.arg + '\'' : '') + ')">' + e(b.action.label) + '</button>' : '';
          return '<li><span class="g-dot"></span><span class="g-txt">' + e(b.text) + '</span>' + act + '</li>';
        }).join('') + '</ul>';
      if (curGate.warns && curGate.warns.length) {
        body += '<div class="g-warns">' + curGate.warns.map(function (w) { return '<div>⚠ ' + e(w.text) + '</div>'; }).join('') + '</div>';
      }
    }
    var actHtml;
    if (curGate.ok && adv.to) {
      actHtml = '<button class="btn btn-primary" onclick="arAdvanceStage()">完成本阶段 · 进入' + AR().byId(adv.to).name + '</button>';
    } else if (!curGate.ok) {
      actHtml = '<span class="g-hint">按上方提示补齐后可推进</span>';
    } else {
      actHtml = '<span class="g-hint">流程已走完</span>';
    }
    return '<div class="ar-gate ' + (curGate.ok ? 'ok' : 'block') + '">' +
      '<span class="g-tag">' + (curGate.ok ? '可推进' : '受阻') + '</span>' +
      '<div class="g-body">' + body + '</div>' +
      '<div class="g-act">' + actHtml + '</div></div>';
  }

  /* ---------- 阶段工作区路由 ---------- */
  var STAGE_WORKSPACE = {
    task: function (t) { return wsTask(t); },
    data: function (t) { return wsData(t); },
    qc: function (t) { return wsQc(t); },
    stats: function (t) { return wsStats(t); },
    draft: function (t) { return wsDraft(t); },
    review: function (t) { return wsReview(t); },
    release: function (t) { return wsRelease(t); }
  };

  function renderWorkbench() {
    var t = curTask();
    if (!t) {
      return pageToolbar('编制工作台') + '<div class="panel"><div class="panel-body"><div style="text-align:center;color:#94a3b8;padding:40px 16px">尚未选择年报记录，请先到「年报记录」新建或打开一条记录。<br><br><button class="btn btn-primary" onclick="arGoPage(\'ar-tasks\')">去年报记录</button></div></div></div>';
    }
    var preview = '';
    if (arState.reportPreview) {
      preview = '<div class="panel" style="margin-bottom:16px;border-color:var(--primary)"><div class="panel-header">报告全文预览（Word 版式）<div class="toolbar-actions"><button class="btn btn-ghost btn-sm" onclick="arCloseReport()">关闭预览</button></div></div><div class="panel-body" style="background:#eef1f5"><div class="ar-doc-scroll" style="max-height:640px;display:flex;flex-direction:column;gap:18px">' + arState.reportPreview + '</div></div></div>';
    }
    var cur = curStageId(t);
    // 越级查看（如已完成阶段回看）允许浏览，但工作台主区始终以「当前阶段」为准；
    // arState.viewStage 只在用户主动点导轨时被设置，且不得跳过闸门。
    var wsId = arState.viewStage && STAGE_WORKSPACE[arState.viewStage] ? arState.viewStage : cur;
    var inner = (STAGE_WORKSPACE[wsId] || STAGE_WORKSPACE[cur])(t);
    var stage = AR().byId(wsId);
    var isPast = AR().indexOf(wsId) < AR().indexOf(cur);
    var badgeHtml = isPast ? ' <span class="wb-viewing-past">回看模式 · 该阶段已完成</span>' : '';
    var secHtml = arSection(wsId, inner, stage, badgeHtml);
    // 弹层挂在工作台层级：任何阶段都能弹出统计表预览 / 问题详情
    return renderWbHead(t) + renderStageRail(t) + renderGateBanner(t) + renderParamBar(t) + preview +
      renderStatViewer(t) + renderIssueViewer(t) + secHtml;
  }

  function renderWbHead(t) {
    var meta = '<div class="wb-head-meta">' +
      '<span class="wb-chip"><b>' + e(t.year) + '</b> 年度</span>' +
      '<span class="wb-chip">' + e(scopeLabel(t)) + '</span>' +
      '<span class="wb-chip">版本 ' + e(t.version) + '</span>' +
      '<span class="wb-chip">当前阶段 <b>' + AR().byId(curStageId(t)).name + '</b></span>' +
      (t.updatedAt ? '<span>更新于 <b>' + e(t.updatedAt) + '</b></span>' : '') +
      '</div>';
    var acts = '<div class="wb-head-acts">' + statusBadge(t.status) +
      (t.status === 'draft' ? '<button class="btn btn-ghost btn-sm" onclick="arSaveDraft()">保存草稿</button>' : '') +
      '<button class="btn btn-ghost btn-sm" onclick="arGoPage(\'ar-tasks\')">返回台账</button>' +
      workbenchActions(t) + '</div>';
    return '<div class="wb-head">' +
      '<div class="wb-head-ico">年报</div>' +
      '<div class="wb-head-main"><div class="wb-head-title">' + e(t.title) + '</div>' + meta + '</div>' +
      acts + '</div>';
  }

  function renderParamBar(t) {
    var years = ['2024', '2023', '2022'];
    if (years.indexOf(String(t.year)) < 0) years.unshift(String(t.year));
    var locked = t.status !== 'draft';
    var cityPicker = t.scope === 'city' ? '<div class="ar-param" style="flex:1;min-width:260px"><label>选择设区市</label><div class="ar-param-city">' +
      REGIONS.filter(function (r) { return r.level === 'city'; }).map(function (r) {
        var on = t.cities.indexOf(r.id) >= 0;
        return '<label class="ar-check' + (on ? ' on' : '') + '"><input type="checkbox" ' + (on ? 'checked' : '') + (locked ? ' disabled' : '') + ' onchange="arToggleCity(\'' + r.id + '\',this.checked)"><span>' + e(r.name) + '</span></label>';
      }).join('') + '</div></div>' : '';
    var running = arState.gen.running;
    var advFields = arState.advOpen ? renderAdvanced(t) : '';
    /* 阶段化后不再提供「一键重新生成」——它会绕过阶段闸门、覆盖质控与审核结论。
       这里改为反映当前阶段的真实进度，操作入口一律在各阶段工作区内。 */
    var genStatus;
    if (running) {
      genStatus = '<div class="wb-gen-status run"><span class="wb-gen-dot"></span>处理中 ' + Math.round(arState.gen.pct) + '%</div>';
    } else {
      var sm = AR().summaries;
      var curStageName = AR().byId(curStageId(t)).name;
      var bits = [];
      bits.push('取数' + ((t.dataPrep && t.dataPrep.dedupDone) ? '✓' : '○'));
      bits.push('质控' + ((t.qc && t.qc.done) ? (sm.qc(t).openBad > 0 ? '!' : '✓') : '○'));
      bits.push('统计' + (sm.stats(t).done ? '✓' : '○'));
      bits.push('正文 ' + sm.draft(t, chapterTotal, chapterDone).done + '/' + chapterTotal(t));
      genStatus = '<div class="wb-gen-status"><span class="wb-gen-dot"></span>当前「' + curStageName + '」 · ' + bits.join(' · ') + '</div>';
    }
    return '<div class="wb-params">' +
      '<div class="ar-param"><label>报告年度</label><select' + (locked ? ' disabled' : '') + ' onchange="arSetTaskYear(this.value)">' +
      years.map(function (y) { return '<option value="' + y + '"' + (String(t.year) === y ? ' selected' : '') + '>' + y + ' 年度</option>'; }).join('') + '</select></div>' +
      '<div class="ar-param"><label>覆盖范围</label><select' + (locked ? ' disabled' : '') + ' onchange="arSetTaskScope(this.value)">' +
      '<option value="jx"' + (t.scope === 'jx' ? ' selected' : '') + '>全省（11 设区市）</option><option value="city"' + (t.scope === 'city' ? ' selected' : '') + '>按设区市选择</option></select></div>' +
      cityPicker +
      '<div class="wb-param-gen">' + genStatus +
      '<button class="btn btn-ghost btn-sm" onclick="arToggleAdv()">' + (arState.advOpen ? '收起口径 ▲' : '高级口径 ▼') + '</button>' +
      '</div></div>' + advFields;
  }

  function renderAdvanced(t) {
    var lk = t.status !== 'draft' ? ' disabled' : '';
    return '<div class="ar-adv">' +
      '<div class="panel-header" style="padding:0 0 10px">高级口径（默认已按省级标准口径设定）</div>' +
      '<div class="form-grid">' +
      '<div class="form-group"><label>人口口径</label><select' + lk + ' onchange="arSetTaskPopCal(this.value)">' +
      '<option value="usual"' + (t.popCal === 'usual' ? ' selected' : '') + '>常住人口</option><option value="household"' + (t.popCal === 'household' ? ' selected' : '') + '>户籍人口</option></select></div>' +
      '<div class="form-group"><label>标准人口</label><select' + lk + ' onchange="arSetTaskStdPop(this.value)">' +
      '<option value="cn"' + (t.stdPop === 'cn' ? ' selected' : '') + '>中国 2000 年标准人口</option><option value="world"' + (t.stdPop === 'world' ? ' selected' : '') + '>Segi 世界标准人口</option></select></div>' +
      '<div class="form-group"><label>癌种范围</label><select' + lk + ' onchange="arSetTaskCancer(this.value)">' +
      CANCERS.map(function (c) { return '<option' + (t.cancer === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label>报告结构</label><select disabled><option>八章标准年报（固定）</option></select></div>' +
      '</div>' +
      '<div style="margin-top:10px;padding:10px 12px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;font-size:12px;color:#647085;line-height:1.7">年报为每年一次的固定产出物：章节固定八章、口径固定省级标准、数据固定取自登记主档 + 死因库 + 随访库 + 人口库，无需选模板。质控指标分母统一为发病数。</div>' +
      '</div>';
  }

  function renderGenBar(t) {
    if (arState.gen.running) {
      return '<div class="ar-genbar"><div style="flex:1;min-width:220px"><div style="display:flex;justify-content:space-between;font-size:12px;color:#647085;margin-bottom:6px"><span>' + arState.gen.step + '</span><span>' + Math.round(arState.gen.pct) + '%</span></div>' +
        '<div class="progress-track" style="margin-top:0;height:8px"><div class="progress-bar" style="height:100%;width:' + arState.gen.pct + '%"></div></div></div></div>';
    }
    if (!(t.agg && t.agg.done)) {
      return '<div class="ar-genbar"><span style="color:#b54708">●</span>尚未生成，正在自动跨库取数…（也可点右上角「一键重新生成」）</div>';
    }
    var r = t.agg.result || AGG_RESULT;
    var vb = t.valid && t.valid.result ? t.valid.result : { ok: 0, warn: 0, bad: 0 };
    return '';
  }

  /* 旧版 5 段平铺锚点已被阶段导轨（renderStageRail）取代，此处保留空实现以防旧调用点报错。 */
  function renderAnchors() { return ''; }

  /* 阶段工作区外壳：标题取阶段定义，导航按钮走 arGoStage（受闸门约束）。
     stage 传入时用阶段语义；未传入（只读查看页复用）时退回旧 SECTIONS 语义。 */
  function arSection(id, inner, stage, badgeHtml) {
    var idx, title, desc, no, total, prevId, nextId, prevLabel, nextLabel;
    if (stage) {
      var list = AR().list;
      idx = AR().indexOf(id);
      title = stage.name; desc = stage.desc; no = stage.no; total = list.length;
      var prev = list[idx - 1], next = list[idx + 1];
      prevId = prev ? prev.id : ''; prevLabel = prev ? prev.short : '';
      nextId = next ? next.id : ''; nextLabel = next ? next.short : '';
    } else {
      idx = 0;
      SECTIONS.forEach(function (s, i) { if (s.id === id) idx = i; });
      var m = SECTIONS[idx] || { title: id, label: id, desc: '' };
      title = m.title; desc = m.desc || ''; no = idx + 1; total = SECTIONS.length;
      var p = SECTIONS[idx - 1], n = SECTIONS[idx + 1];
      prevId = p ? p.id : ''; prevLabel = p ? p.label : '';
      nextId = n ? n.id : ''; nextLabel = n ? n.label : '';
    }
    var nav = '';
    if (arState.page === 'ar-workbench') {
      nav = '<div class="wb-secnav">' +
        (prevId ? '<button class="btn btn-ghost btn-sm" onclick="arGoStage(\'' + prevId + '\')">← ' + prevLabel + '</button>' : '<span></span>') +
        '<span class="wb-secnav-pos">阶段 ' + no + ' / ' + total + '</span>' +
        (nextId ? '<span class="wb-secnav-next-hint">下一阶段：' + nextLabel + '（需满足准入条件）</span>' : '<span class="wb-secnav-next-hint">已为最终阶段</span>') +
        '</div>';
    }
    return '<div class="wb-sec" id="ar-sec-' + id + '">' +
      '<div class="wb-sec-h"><span class="n">' + no + '</span><span class="t">' + title + '</span>' +
      (badgeHtml || '') +
      '<span class="wb-sec-d">' + (desc || '') + '</span></div>' + inner + nav + '</div>';
  }

  function sectionOverview(t) {
    var r = AGG_RESULT;
    var cityRows = REGIONS.filter(function (x) { return x.level === 'city'; }).map(function (x) {
      return '<tr><td class="txt" style="font-size:13px;color:#1f2937">' + x.name + '</td>' +
        '<td class="num" style="font-size:12px;color:#64748b">' + (x.pop / 10000).toFixed(0) + '</td>' +
        '<td class="num" style="font-size:13px;color:#1f2937">' + fmt(regionInc(x)) + '</td>' +
        '<td class="num" style="font-size:13px;color:var(--primary)">' + f1(x.incRate) + '</td>' +
        '<td class="num" style="font-size:13px;color:#1f2937">' + fmt(regionDeath(x)) + '</td>' +
        '<td class="num" style="font-size:13px;color:#c05621">' + f1(x.deathRate) + '</td>' +
        '<td class="code">' + badge('success', '完整') + '</td></tr>';
    }).join('');
    var popCalTxt = t.popCal === 'household' ? '户籍人口' : '常住人口';
    var stdPopTxt = t.stdPop === 'world' ? 'Segi 世界标准人口' : '中国 2000 年标准人口';
    var body = '<div class="panel" style="margin-bottom:16px"><div class="panel-body">' +
      '<div class="ar-ctx-line"><span>统计年度 <b>' + e(t.year) + '</b></span><span>覆盖范围 <b>' + e(scopeLabel(t)) + '</b></span>' +
      '<span>人口口径 <b>' + popCalTxt + '</b></span><span>标准人口 <b>' + stdPopTxt + '</b></span>' +
      '<span>癌种 <b>' + e(t.cancer) + '</b></span><span>报告结构 <b>八章标准年报</b></span></div>' +
      (t.agg && t.agg.done ?
        '<div class="his-summary" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-top:14px">' +
        '<div class="his-summary-card"><strong>' + fmt(r.cards) + '</strong><span>报告卡总数</span></div>' +
        '<div class="his-summary-card"><strong>' + fmt(r.valid) + '</strong><span>有效发病例数</span></div>' +
        '<div class="his-summary-card"><strong>' + fmt(r.death) + '</strong><span>死亡例数</span></div>' +
        '<div class="his-summary-card"><strong>' + fmt(r.pop) + '</strong><span>覆盖人口</span></div></div>' +
        '<div style="margin-top:12px;padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:12px;color:#166534">✓ 已合并 ' + r.sources + ' 个数据源（' + r.registries + ' 个登记处），删除重复卡 ' + fmt(r.dup) + ' 张，识别多原发 ' + fmt(r.multiPrimary) + ' 例。</div>' : '') +
      '</div></div>';
    if (t.agg && t.agg.done) {
      body += '<div class="panel" style="margin-bottom:16px"><div class="panel-header">分层汇总 · 分设区市</div><div class="panel-body" style="padding:0 18px 16px">' +
        '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:760px"><colgroup><col><col><col style="width:104px"><col style="width:104px"><col style="width:104px"><col style="width:104px"><col></colgroup><thead><tr>' +
        '<th class="txt">设区市</th><th class="num">覆盖人口（万）</th><th class="num">发病数</th><th class="num">粗发病率</th><th class="num">死亡数</th><th class="num">粗死亡率</th><th class="code">数据状态</th>' +
        '</tr></thead><tbody>' + cityRows + '</tbody></table></div>' +
        '<div style="margin-top:10px;font-size:12px;color:#94a3b8">注：省级汇总另含省外及待归属病例 ' + fmt(r.unlocated) + ' 例。</div></div></div>';
    }
    return body;
  }

/* ===================== 8. 分区 · 数据质量校验 ===================== */
  function sectionQuality(t) {
    var v = t.valid || { done: false, result: null };
    var rules = VALIDATE_RULES.slice();
    var qcPass = QC_PROV.mv >= QC_THRESH.mvMin && QC_PROV.mv <= QC_THRESH.mvMax && QC_PROV.dco <= QC_THRESH.dco && QC_PROV.mi >= QC_THRESH.miLow && QC_PROV.mi <= QC_THRESH.miHigh && QC_PROV.ou <= QC_THRESH.ou && QC_PROV.ub <= QC_THRESH.ub;
    if (v.done) {
      if (v.result && v.result.bad > 0) { rules[1].status = 'warn'; rules[3].status = 'bad'; }
      else { for (var ri = 0; ri < rules.length; ri++) rules[ri].status = 'ok'; }
      for (var qi = 0; qi < rules.length; qi++) if (rules[qi].id === 'qc') rules[qi].status = qcPass ? 'ok' : 'warn';
    }
    function gauge(label, val, unit, tone, note) {
      return '<div class="viz-gauge"><div class="viz-gauge-label">' + label + '</div>' +
        '<div class="viz-gauge-val" style="color:' + (tone === 'bad' ? '#b42318' : tone === 'warn' ? '#b54708' : 'var(--primary)') + '">' + val + unit + '</div>' +
        '<div class="viz-gauge-bar"><div class="viz-gauge-fill" style="width:' + (label.indexOf('M/I') === 0 ? Math.min(100, val / 1.2 * 100) : Math.min(100, val)) + '%;background:' + (tone === 'bad' ? '#ef4444' : tone === 'warn' ? '#f59e0b' : 'var(--primary)') + '"></div></div>' +
        '<div style="font-size:11px;color:#64748b;margin-top:5px">' + note + '</div></div>';
    }
    var rulesRows = rules.map(function (rule) {
      var b;
      if (!v.done) b = badge('neutral', '待校验');
      else if (rule.status === 'bad') b = badge('danger', '错误');
      else if (rule.status === 'warn') b = badge('warning', '警告');
      else b = badge('success', '通过');
      return '<tr><td class="txt" style="font-size:13px;color:#1f2937">' + rule.name + '</td>' +
        '<td class="txt" style="font-size:12px;color:#64748b">' + rule.desc + '</td>' +
        '<td class="code">' + b + '</td></tr>';
    }).join('');
    var issueRows = (v.done && v.result && v.result.bad > 0) ? ISSUES.map(function (it) {
      var b = it.level === 'bad' ? badge('danger', '错误') : badge('warning', '警告');
      return '<tr><td class="txt" style="font-size:12px;color:#334155">' + it.no + '</td>' +
        '<td class="txt" style="font-size:12px;color:#1f2937">' + it.region + '</td>' +
        '<td class="txt" style="font-size:12px;color:#1f2937">' + it.rule + '</td>' +
        '<td class="txt" style="font-size:12px;color:#64748b">' + it.detail + '</td>' +
        '<td class="code">' + b + '</td>' +
        '<td class="ops"><button class="btn btn-ghost btn-xs" onclick="arFixIssue(this)">标记已修正</button></td></tr>';
    }).join('') : (v.done ? '<tr><td colspan="6" style="padding:20px;text-align:center;color:#059669">✓ 数据校验通过，无水印错误项</td></tr>' : '<tr><td colspan="6" style="padding:20px;text-align:center;color:#94a3b8">自动校验完成后展示问题清单</td></tr>');

    return '<div class="panel" style="margin-bottom:16px"><div class="panel-header">数据质量校验<div class="toolbar-actions"><span class="ar-hint">' + (v.done ? '校验完成 · ' + v.result.ok + ' 项通过' : '自动校验中…') + '</span></div></div><div class="panel-body">' +
      (arState.gen.running ? '<div style="margin:10px 0 16px"><div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:6px"><span>正在执行 8 条校验规则与国家考核阈值...</span><span>' + Math.round(arState.gen.pct) + '%</span></div><div class="progress-track" style="margin-top:0;height:8px"><div class="progress-bar" style="height:100%;width:' + arState.gen.pct + '%"></div></div></div>' :
        (v.done && v.result ? '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 16px">' + badge('success', '通过 ' + v.result.ok) + badge('warning', '警告 ' + v.result.warn) + badge('danger', '错误 ' + v.result.bad) + '<span style="font-size:12px;color:#647085;align-self:center">存在错误项建议整改后再提交审核。</span></div>' : '')) +
      '<div class="ar-qc-grid" style="margin-bottom:14px">' +
      gauge('MV% 病理/细胞学证实', QC_PROV.mv, '%', qcTone(QC_PROV.mv, 'mv'), '阈值 ' + QC_THRESH.mvMin + '%–' + QC_THRESH.mvMax + '%（过高提示漏报）') +
      gauge('HV% 组织学证实', QC_PROV.hv, '%', qcTone(QC_PROV.hv, 'hv'), '阈值 ≥ ' + QC_THRESH.hvMin + '%') +
      gauge('DCO% 仅死亡补发病', QC_PROV.dco, '%', qcTone(QC_PROV.dco, 'dco'), '阈值 ≤ ' + QC_THRESH.dco + '%') +
      gauge('M/I 死亡发病比', QC_PROV.mi, '', qcTone(QC_PROV.mi, 'mi'), '参考 ' + QC_THRESH.miLow + '–' + QC_THRESH.miHigh) +
      gauge('UB% 原发部位不明', QC_PROV.ub, '%', qcTone(QC_PROV.ub, 'ub'), '阈值 ≤ ' + QC_THRESH.ub + '%') +
      gauge('O&U% 其他及未指明部位', QC_PROV.ou, '%', qcTone(QC_PROV.ou, 'ou'), '阈值 ≤ ' + QC_THRESH.ou + '%') +
      '</div></div></div>' +
      '<div class="panel" style="margin-bottom:16px"><div class="panel-body" style="padding-top:8px">' +
      '<table class="data-table" style="width:100%;min-width:0"><thead><tr><th class="txt">校验规则</th><th class="txt">说明</th><th class="code">状态</th></tr></thead><tbody>' + rulesRows + '</tbody></table></div></div>' +
      '<div class="panel" style="margin-bottom:16px"><div class="panel-header">问题数据清单</div><div class="panel-body" style="padding-top:8px">' +
      '<table class="data-table" style="width:100%;min-width:0"><colgroup><col><col><col><col><col style="width:96px"><col style="width:190px"></colgroup><thead><tr><th class="txt">登记编号</th><th class="txt">区划</th><th class="txt">问题规则</th><th class="txt">问题说明</th><th class="code">级别</th><th class="ops">操作</th></tr></thead><tbody>' + issueRows + '</tbody></table></div></div>';
  }

  /* ===================== 9. 分区 · 指标与图表 ===================== */
  function chartPyramid() {
    var data = buildPyramid(), max = 0, totalM = 0, totalF = 0;
    data.forEach(function (d) { if (d.male > max) max = d.male; if (d.female > max) max = d.female; totalM += d.male; totalF += d.female; });
    var rows = data.map(function (d) {
      return '<div class="ar-pyr-row"><div class="ar-pyr-m"><span class="ar-pyr-num">' + fmt(d.male) + '</span><div class="ar-pyr-bar" style="width:' + Math.round(d.male / max * 100) + '%;background:linear-gradient(90deg,#2563eb,#60a5fa)"></div></div>' +
        '<div class="ar-pyr-ctr">' + d.age + '</div>' +
        '<div class="ar-pyr-f"><div class="ar-pyr-bar" style="width:' + Math.round(d.female / max * 100) + '%;background:linear-gradient(90deg,#fb923c,#f97316)"></div><span class="ar-pyr-num">' + fmt(d.female) + '</span></div></div>';
    }).join('');
    return '<div class="analysis-chart-panel" style="min-height:420px"><div style="display:flex;justify-content:space-between;align-items:center"><h4 style="margin:0">年龄别发病构成（例）</h4>' +
      '<div style="font-size:11px;color:#64748b"><span class="ar-pyr-legend-m">■ 男性 ' + fmt(totalM) + '</span>　<span class="ar-pyr-legend-f">■ 女性 ' + fmt(totalF) + '</span></div></div>' +
      '<div style="margin-top:12px"><div class="ar-pyr-head"><div style="text-align:right">男（左）</div><div>年龄组（岁）</div><div style="text-align:left">女（右）</div></div>' + rows + '</div></div>';
  }
  function chartRank() {
    var rows = SITES.map(function (s, i) {
      return '<div class="viz-hbar-row"><div class="viz-hbar-label">' + (i + 1) + '. ' + s.name + ' ' + s.icd + '</div>' +
        '<div class="viz-hbar-track"><div class="viz-hbar-fill" style="width:' + Math.round(s.inc / SITES[0].inc * 100) + '%"></div></div><div class="viz-hbar-val">' + fmt(s.inc) + '</div></div>';
    }).join('');
    return '<div class="analysis-chart-panel"><h4>主要癌种发病顺位（Top 10）</h4><div class="viz-hbar">' + rows + '</div></div>';
  }
  function chartRankDeath() {
    var list = SITES.slice().sort(function (a, b) { return b.death - a.death; });
    var max = list[0].death;
    var rows = list.map(function (s, i) {
      return '<div class="viz-hbar-row"><div class="viz-hbar-label">' + (i + 1) + '. ' + s.name + ' ' + s.icd + '</div>' +
        '<div class="viz-hbar-track"><div class="viz-hbar-fill" style="width:' + Math.round(s.death / max * 100) + '%;background:linear-gradient(90deg,#c05621,#f79009)"></div></div><div class="viz-hbar-val">' + fmt(s.death) + '</div></div>';
    }).join('');
    return '<div class="analysis-chart-panel"><h4>主要癌种死亡顺位（Top 10）</h4><div class="viz-hbar">' + rows + '</div></div>';
  }
  function chartRegion() {
    var list = REGIONS.filter(function (r) { return r.level === 'city'; }).slice().sort(function (a, b) { return b.incRate - a.incRate; }).slice(0, 8);
    var rows = list.map(function (r) {
      return '<div class="viz-hbar-row"><div class="viz-hbar-label">' + r.name + '</div>' +
        '<div class="viz-hbar-track"><div class="viz-hbar-fill" style="width:' + Math.round(r.incRate / list[0].incRate * 100) + '%;background:linear-gradient(90deg,#3fa785,var(--primary))"></div></div><div class="viz-hbar-val">' + f1(r.incRate) + '</div></div>';
    }).join('');
    return '<div class="analysis-chart-panel"><h4>各设区市粗发病率对比（/10 万）</h4><div class="viz-hbar">' + rows + '</div></div>';
  }
  function chartTrend() {
    var cols = TREND.map(function (x) {
      return '<div class="viz-vline-col" title="' + x.year + ' 年发病 ' + fmt(x.inc) + ' 例"><div class="viz-vline-bar" style="height:' + Math.round(x.inc / TREND[TREND.length - 1].inc * 100) + '%"></div><div class="viz-vline-lab">' + x.year + '</div></div>';
    }).join('');
    return '<div class="analysis-chart-panel"><h4>2015–2024 年发病例数趋势</h4><div class="viz-vline" style="height:200px">' + cols + '</div></div>';
  }
  function chartSurvival() {
    var rows = SURVIVAL.map(function (s) {
      return '<div class="viz-hbar-row"><div class="viz-hbar-label">' + s.site + '</div>' +
        '<div class="viz-hbar-track"><div class="viz-hbar-fill" style="width:' + Math.round(s.rate) + '%;background:linear-gradient(90deg,#8b5cf6,#a78bfa)"></div></div><div class="viz-hbar-val">' + f1(s.rate) + '%</div></div>';
    }).join('');
    return '<div class="analysis-chart-panel"><h4>主要癌种五年相对生存率</h4><div class="viz-hbar">' + rows + '</div></div>';
  }

  function sectionMetrics(t) {
    var incCards = '<div class="ar-metric-grid" style="margin-bottom:10px">' + metric('新发病例', fmt(AGG_RESULT.valid), '全省合计') + metric('粗发病率', f1(173.3), '/10 万') + metric('中标发病率', f1(119.4), '/10 万 · 中国 2000') + metric('世标发病率', f1(158.1), '/10 万 · Segi') + metric('累积发病率 0-74', f1(22.4), '%') + '</div>';
    var deathCards = '<div class="ar-metric-grid" style="margin-bottom:14px">' + metric('死亡例数', fmt(AGG_RESULT.death), '全省合计', true) + metric('粗死亡率', f1(102.2), '/10 万', true) + metric('中标死亡率', f1(67.8), '/10 万 · 中国 2000', true) + metric('世标死亡率', f1(93.6), '/10 万 · Segi', true) + metric('累积死亡率 0-74', f1(13.3), '%', true) + '</div>';
    var tabs = [ { id: 'pyramid', label: '年龄-性别金字塔' }, { id: 'rank', label: '癌种顺位' }, { id: 'region', label: '地区分布' }, { id: 'trend', label: '时间趋势' }, { id: 'survival', label: '生存情况' } ];
    var tabHtml = '<div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:16px">' + tabs.map(function (tb) {
      var on = arState.chartTab === tb.id;
      return '<button style="appearance:none;border:0;background:transparent;padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2px solid ' + (on ? 'var(--primary)' : 'transparent') + ';color:' + (on ? 'var(--primary)' : '#667085') + '" onclick="arSetChartTab(\'' + tb.id + '\')">' + tb.label + '</button>';
    }).join('') + '</div>';
    var chart;
    if (arState.chartTab === 'pyramid') chart = chartPyramid();
    else if (arState.chartTab === 'rank') chart = chartRank();
    else if (arState.chartTab === 'region') chart = chartRegion();
    else if (arState.chartTab === 'trend') chart = chartTrend();
    else chart = chartSurvival();
    return '<div class="panel" style="margin-bottom:16px"><div class="panel-body">' +
      '<div class="panel-header" style="padding:0 0 10px">核心负担指标</div>' + incCards + deathCards + tabHtml + chart + '</div></div>';
  }

/* ===================== 10. 分区 · 报告正文 ===================== */
  function templateChapterConfigs(tp) {
    var base = tp && tp.chapterConfigs;
    if (base && base.length) return base.map(function (x, i) {
      var meta = CHAPTER_META.filter(function (c) { return c.id === x.id; })[0] || {};
      return { id: x.id, order: x.order || i + 1, enabled: x.enabled !== false, title: x.title || meta.title || x.id, desc: x.desc || meta.desc || '' };
    }).sort(function (a, b) { return a.order - b.order; });
    var ids = tp && tp.chapters && tp.chapters.length ? tp.chapters : CHAPTER_META.map(function (c) { return c.id; });
    return ids.map(function (id, i) {
      var m = CHAPTER_META.filter(function (c) { return c.id === id; })[0] || { id: id, title: id, desc: '' };
      return { id: id, order: i + 1, enabled: true, title: m.title, desc: m.desc };
    });
  }
  function cloneTemplateValue(value) { return JSON.parse(JSON.stringify(value || {})); }
  function templateSnapshotForTask(tp) {
    if (!tp) return null;
    return { id: tp.id, name: tp.name, version: tp.version, chapterConfigs: cloneTemplateValue(templateChapterConfigs(tp)), chapterTemplates: cloneTemplateValue(tp.chapterTemplates || {}) };
  }
  /* 年报固定八章：章节结构与正文模板统一取年度标准年报模板 */
  function annualTemplate() {
    var tp = null;
    templates.forEach(function (x) { if (x.id === 'tpl-annual') tp = x; });
    if (!tp) templates.forEach(function (x) { if (x.enabled && x.isDefault) tp = x; });
    return tp || { id: 'tpl-annual', name: '年度肿瘤登记年报', version: 'v3', chapterTemplates: {} };
  }
  function templateSourceForTask(t) { return annualTemplate(); }
  function activeTemplateChapters(t) {
    var tp = templateSourceForTask(t);
    var configs = templateChapterConfigs(tp).filter(function (c) { return c.enabled !== false; });
    if (!configs.length) configs = CHAPTER_META.map(function (c, i) { return { id: c.id, order: i + 1, enabled: true, title: c.title, desc: c.desc }; });
    return configs.map(function (c) {
      var ct = tp && tp.chapterTemplates && tp.chapterTemplates[c.id];
      return ct ? Object.assign({}, c, { title: ct.title || c.title, desc: ct.desc || c.desc, intro: ct.intro || '', dataSource: ct.dataSource || '', indicators: ct.indicators || [], charts: ct.charts || [], tables: ct.tables || [], rules: ct.rules || {} }) : c;
    });
  }
  function chapterConfigById(t, id) {
    var list = activeTemplateChapters(t);
    return list.filter(function (c) { return c.id === id; })[0] || list[0];
  }

  function chapterSections(t, id) {
    return sectionTitles(chapterTemplate(templateSourceForTask(t), id));
  }
  function buildChapterHtml(t, id) {
    var ct = chapterTemplate(templateSourceForTask(t), id);
    var secs = normalizeSections(ct);
    var vars = arVars(t);
    return secs.map(function (s, i) {
      var blocks = (s.blocks || []).map(function (b) { return renderBlock(b, vars); }).join('');
      var head = secs.length > 1 || s.title !== '正文' ? '<h4 class="doc-sec">' + CN_NO[i] + '、' + e(s.title) + '</h4>' : '';
      return head + (blocks || '<p>（本节正文待编制）</p>');
    }).join('');
  }
  function chapterBodyHtml(t, ch) {
    var saved = t.chapters[ch.id];
    if (saved) return saved;
    return buildChapterHtml(t, ch.id);
  }
  function docToolbar(readonly) {
    if (readonly) return '<div class="ar-doc-toolbar"><span class="ar-hint">该章节模板设为只读，不可编辑正文</span></div>';
    return '<div class="ar-doc-toolbar">' +
      '<select onchange="arDocCmd(\'formatBlock\',this.value)" title="段落样式"><option value="p">正文</option><option value="h4">小节标题</option><option value="h3">章标题</option></select>' +
      '<select onchange="arDocCmd(\'fontSize\',this.value)" title="字号"><option value="3">默认</option><option value="2">小</option><option value="4">大</option><option value="5">特大</option></select>' +
      '<span class="ar-tb-sep"></span>' +
      '<button class="ar-tb-btn b" onclick="arDocCmd(\'bold\')" title="加粗">B</button>' +
      '<button class="ar-tb-btn i" onclick="arDocCmd(\'italic\')" title="斜体">I</button>' +
      '<button class="ar-tb-btn u" onclick="arDocCmd(\'underline\')" title="下划线">U</button>' +
      '<span class="ar-tb-sep"></span>' +
      '<button class="ar-tb-btn" onclick="arDocCmd(\'justifyLeft\')" title="左对齐">⬅</button>' +
      '<button class="ar-tb-btn" onclick="arDocCmd(\'justifyCenter\')" title="居中">↔</button>' +
      '<button class="ar-tb-btn" onclick="arDocCmd(\'justifyFull\')" title="两端对齐">☰</button>' +
      '<span class="ar-tb-sep"></span>' +
      '<button class="ar-tb-btn" onclick="arDocCmd(\'insertUnorderedList\')" title="项目符号">•—</button>' +
      '<button class="ar-tb-btn" onclick="arDocCmd(\'insertOrderedList\')" title="编号列表">1.</button>' +
      '<span class="ar-tb-sep"></span>' +
      '<button class="ar-tb-btn" onclick="arDocInsertTable()" title="插入统计表">▦ 表格</button>' +
      '<button class="ar-tb-btn" onclick="arDocInsertFigure()" title="插入图表">📊 图表</button>' +
      '<button class="ar-tb-btn" onclick="arDocInsertIndicator()" title="插入核心指标">＃ 指标</button>' +
      '<span class="ar-tb-sep"></span>' +
      '<button class="ar-tb-btn" onclick="arDocCmd(\'undo\')" title="撤销">↶</button>' +
      '<button class="ar-tb-btn" onclick="arDocCmd(\'redo\')" title="重做">↷</button>' +
      '</div>';
  }
  function sectionReport(t) {
    var chapterList = activeTemplateChapters(t);
    var idx = 0;
    for (var ci = 0; ci < chapterList.length; ci++) if (chapterList[ci].id === arState.editChapter) { idx = ci; break; }
    var ch = chapterList[idx];
    if (ch && arState.editChapter !== ch.id) arState.editChapter = ch.id;
    var ct = chapterTemplate(templateSourceForTask(t), ch.id);
    var readonly = !!(ct.rules && ct.rules.allowManualEdit === false);

    var nav = '<div class="ar-doc-nav"><div class="nav-h">报告目录（' + chapterList.length + ' 章）</div>' +
      chapterList.map(function (c, i) {
        var on = c.id === ch.id;
        var done = !!t.chapters[c.id];
        var secs = on ? chapterSections(t, c.id).map(function (s, si) {
          return '<div class="ar-doc-sec" onclick="arDocGoSection(' + si + ')">' + CN_NO[si] + '、' + e(s) + '</div>';
        }).join('') : '';
        return '<div class="ar-doc-ch' + (on ? ' active' : '') + '" onclick="arEditChapter(\'' + c.id + '\')">' +
          '<span class="cno">第' + CN_NO[i] + '章</span><span>' + e(c.title) + '</span>' +
          '<span class="flag">' + (done ? '✓' : '○') + '</span></div>' + secs;
      }).join('') + '</div>';

    var pageHtml = '<div class="ar-page" id="arDocPage"' + (readonly ? '' : ' contenteditable="true"') + '>' +
      '<div class="doc-h1">' + e(t.title) + '</div>' +
      '<div class="doc-sub">江西省肿瘤登记中心 · ' + e(t.year) + ' 年度 · ' + e(t.version) + '</div>' +
      '<h3 class="doc-ch">第' + CN_NO[idx] + '章　' + e(ch.title) + '</h3>' +
      chapterBodyHtml(t, ch) + '</div>';

    var meta = '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px">' +
      badge('info', '第' + CN_NO[idx] + '章') + badge('neutral', chapterSections(t, ch.id).length + ' 小节') +
      (t.chapters[ch.id] ? badge('success', '已编制') : badge('warning', '待编制')) +
      (readonly ? badge('danger', '只读章节') : badge('accent', '可编辑')) +
      (ct.dataSource ? '<span class="ar-hint" style="margin-left:6px">数据来源：' + e(ct.dataSource) + '</span>' : '') +
      '</div>';

    var bindings = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' +
      (ct.indicators || []).map(function (x) { return badge('info', '指标 ' + e(x)); }).join('') +
      (ct.charts || []).map(function (x) { return badge('accent', '图表 ' + e(x)); }).join('') +
      (ct.tables || []).map(function (x) { return badge('neutral', '表 ' + e(x)); }).join('') + '</div>';

    var corrRows = (t.corrections || []).slice(0, 8).map(function (c) {
      return '<div class="ar-corr-item"><div class="meta">' + c.ver + ' · ' + c.at + ' · ' + c.by + '</div><div class="note">' + e(c.note) + '</div></div>';
    }).join('') || '<div style="color:#94a3b8;font-size:12px">暂无校订记录</div>';

    return '<div class="panel" style="margin-bottom:16px"><div class="panel-body">' +
      '<div style="font-size:12.5px;color:#647085;margin-bottom:12px">八章正文已按汇总数据自动生成；左侧选择章节，右侧直接所见即所得校订，保存后写入校订记录。</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
      '<button class="btn btn-primary btn-sm" onclick="arSaveChapter()"' + (readonly ? ' disabled' : '') + '>保存本章</button>' +
      '<button class="btn btn-outline btn-sm" onclick="arGenerateChapter()"' + (t.agg && t.agg.done && !readonly ? '' : ' disabled') + '>按数据重算本章</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="arResetChapter()"' + (readonly ? ' disabled' : '') + '>恢复默认</button>' +
      '</div>' + meta + bindings +
      '<div class="ar-doc-wrap">' + nav +
      '<div class="ar-doc-main">' + docToolbar(readonly) + '<div class="ar-doc-scroll">' + pageHtml + '</div></div>' +
      '</div>' +
      '<div class="panel-header" style="padding:18px 0 10px">校订记录</div><div class="ar-corr-timeline">' + corrRows + '</div>' +
      '</div></div>';
  }

  /* ===================== 11. 分区 · 导出与发布 ===================== */
  function sectionExport(t) {
    var cfg = t.exportCfg || { format: 'pdf', ci5: true, channels: ['nccr'] };
    var formats = [ { id: 'pdf', label: 'PDF', desc: '标准排版，适合归档 / 上报' }, { id: 'word', label: 'Word', desc: '可编辑报告正文' }, { id: 'excel', label: 'Excel', desc: '统计附表 + 图表' } ];
    var formatHtml = '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">' + formats.map(function (fm) {
      var sel = cfg.format === fm.id;
      return '<div style="cursor:pointer;border:1px solid ' + (sel ? 'var(--primary)' : 'var(--border)') + ';border-radius:6px;padding:14px;background:' + (sel ? 'var(--primary-soft)' : '#fff') + '" onclick="arSetFormat(\'' + fm.id + '\')">' +
        '<div style="font-weight:700;color:' + (sel ? 'var(--primary)' : '#1f2937') + ';margin-bottom:4px">' + fm.label + '</div><div style="font-size:12px;color:#64748b">' + fm.desc + '</div></div>';
    }).join('') + '</div>';
    var channelHtml = '<div class="ar-check-grid">' + CHANNELS.map(function (c) {
      var sel = cfg.channels.indexOf(c.id) >= 0;
      return '<label class="ar-check' + (sel ? ' on' : '') + '">' +
        '<input type="checkbox" ' + (sel ? 'checked' : '') + ' onchange="arToggleChannel(\'' + c.id + '\',this.checked)"><span>' + e(c.label) + '</span></label>';
    }).join('') + '</div>';
    var otherHtml = '<div class="ar-check-grid">' +
      '<label class="ar-check' + (cfg.govFiling ? ' on' : '') + '"><input type="checkbox" ' + (cfg.govFiling ? 'checked' : '') + ' onchange="arToggleGovFiling(this.checked)"><span>省卫健委备案</span></label>' +
      '<label class="ar-check' + (cfg.bigScreen ? ' on' : '') + '"><input type="checkbox" ' + (cfg.bigScreen ? 'checked' : '') + ' onchange="arToggleBigScreen(this.checked)"><span>同步院内可视化大屏</span></label>' +
      '</div>';

    var subRows = submissions.filter(function (s) { return s.taskId === t.id; }).map(function (s) {
      return '<tr><td class="txt" style="font-size:12px;color:#334155">' + s.id + '</td>' +
        '<td class="code" style="font-size:12px;color:#1f2937">' + e(s.channelLabel) + '</td>' +
        '<td class="num" style="font-size:12px;color:#64748b">' + (s.ci5 ? 'PDF + CI5/IARC' : s.format.toUpperCase()) + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + s.status + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + s.receiptNo + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + s.sentAt + '</td></tr>';
    }).join('');

    return '<div class="panel" style="margin-bottom:16px"><div class="panel-header">导出配置</div><div class="panel-body">' +
      '<div style="font-size:12.5px;color:#647085;margin-bottom:14px">输出格式与上报去向随任务保存；「提交审核 → 发布 → 归档入库」请点页面右上角的状态按钮。</div>' +
      '<div class="form-grid">' +
      '<div class="form-group full"><label>输出格式</label>' + formatHtml + '</div>' +
      '<div class="form-group full"><label>CI5 / IARC 数据包</label><div class="ar-check-grid"><label class="ar-check' + (cfg.ci5 ? ' on' : '') + '"><input type="checkbox" ' + (cfg.ci5 ? 'checked' : '') + ' onchange="arToggleCi5(this.checked)"><span>同时导出 CI5/IARC 适配数据包</span></label></div></div>' +
      '<div class="form-group full"><label>上报渠道</label>' + channelHtml + '</div>' +
      '<div class="form-group full"><label>其他去向（非上报）</label>' + otherHtml + '</div></div>' +
      '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<button class="btn btn-primary" onclick="arSaveCfg()">保存配置</button><button class="btn btn-outline" onclick="arViewReport()">预览报告全文</button><button class="btn btn-ghost" onclick="arGoSection(\'metrics\')">查看核心指标</button></div></div></div>' +
      '<div class="panel" style="margin-bottom:16px"><div class="panel-header">本任务上报记录</div><div class="panel-body" style="padding-top:8px">' +
      (subRows ? '<table class="data-table" style="width:100%;min-width:0"><colgroup><col><col style="width:96px"><col><col style="width:96px"><col><col style="width:170px"></colgroup><thead><tr><th class="txt">上报编号</th><th class="code">渠道</th><th class="code">数据包</th><th class="code">状态</th><th class="code">回执号</th><th class="code">上报时间</th></tr></thead><tbody>' + subRows + '</tbody></table>' : '<div style="color:#94a3b8;font-size:12px;padding:10px">暂无上报记录</div>') +
      '</div></div>';
  }

  /* ===================== 11. 七个阶段工作区 =====================
     每个工作区 = 阶段说明 + 阶段任务清单 + 阶段产物 + 本阶段操作。
     区别于旧版：这里只展示**当前阶段该干的事**，且每项产物都能看出是否齐备。 */

  /* 通用：阶段任务清单（勾选态由数据推导，不可手改） */
  function stageChecklist(items) {
    var done = items.filter(function (x) { return x.ok; }).length;
    return '<div class="panel" style="margin-bottom:16px"><div class="panel-header">本阶段任务清单' +
      '<span class="ph-sub">已完成 ' + done + ' / ' + items.length + '</span></div>' +
      '<div class="panel-body" style="padding-top:6px"><ul class="ar-checklist">' +
      items.map(function (x) {
        return '<li class="' + (x.ok ? 'ok' : 'todo') + '"><span class="ck">' + (x.ok ? '✓' : '○') + '</span>' +
          '<div class="ct"><div class="ct-t">' + e(x.title) + '</div>' +
          (x.desc ? '<div class="ct-d">' + e(x.desc) + '</div>' : '') + '</div>' +
          (x.act ? '<div class="ct-a">' + x.act + '</div>' : '') + '</li>';
      }).join('') + '</ul></div></div>';
  }

  /* 通用：阶段留痕（该阶段相关的流转记录） */
  function stageLogPanel(t, stageId) {
    var logs = (t.stageLog || []).filter(function (l) { return l.to === stageId || l.from === stageId; });
    if (!logs.length) return '';
    return '<div class="panel" style="margin-bottom:16px"><div class="panel-header">阶段留痕</div>' +
      '<div class="panel-body" style="padding-top:8px"><table class="data-table" style="width:100%;min-width:0">' +
      '<thead><tr><th class="code" style="width:150px">时间</th><th class="code" style="width:100px">动作</th><th class="txt">说明</th><th class="code" style="width:150px">操作人</th></tr></thead><tbody>' +
      logs.map(function (l) {
        return '<tr><td class="code" style="font-size:12px;color:#64748b">' + e(l.at) + '</td>' +
          '<td class="code">' + badge(l.action === '阶段回退' ? 'warning' : l.action === '作废' ? 'danger' : 'info', e(l.action)) + '</td>' +
          '<td class="txt" style="font-size:12.5px;color:#334155">' + e(l.note) + '</td>' +
          '<td class="code" style="font-size:12px;color:#64748b">' + e(l.by) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  /* ---------- 阶段 1：建立任务 ---------- */
  function wsTask(t) {
    var locked = t.status !== 'draft';
    var gate = AR().evalGate('task', t, ARH);
    var lk = locked ? ' disabled' : '';
    var years = ['2026', '2025', '2024', '2023'];
    if (years.indexOf(String(t.year)) < 0) years.unshift(String(t.year));
    var tpl = tplById(t.templateId) || {};

    /* 编制基准：可直接编辑并保存。旧版只把口径摆成只读文字，
       用户想改个标准人口得去别的页面找，改完还不知道有没有生效。 */
    var form = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">编制基准（口径）' +
      (locked ? '<span class="ph-sub">已锁定 · 当前状态「' + (TASK_STATUS[t.status] || {}).label + '」，如需变更请先回退到本阶段</span>' : '<span class="ph-sub">草稿期可调整，保存后立即生效</span>') +
      '</div><div class="panel-body">' +
      '<div class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px 20px">' +
      '<div class="form-group"><label>报告年度</label><select id="arBaseYear"' + lk + '>' +
      years.map(function (y) { return '<option value="' + y + '"' + (String(t.year) === y ? ' selected' : '') + '>' + y + ' 年度</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-group"><label>覆盖范围</label><select id="arBaseScope"' + lk + ' onchange="arBaseScopeChange(this.value)">' +
      '<option value="jx"' + (t.scope === 'jx' ? ' selected' : '') + '>全省（11 设区市）</option>' +
      '<option value="city"' + (t.scope === 'city' ? ' selected' : '') + '>按设区市选择</option></select></div>' +
      '<div class="form-group"><label>人口口径</label><select id="arBasePopCal"' + lk + '>' +
      '<option value="usual"' + (t.popCal === 'usual' ? ' selected' : '') + '>常住人口</option>' +
      '<option value="household"' + (t.popCal === 'household' ? ' selected' : '') + '>户籍人口</option></select></div>' +
      '<div class="form-group"><label>标准人口</label><select id="arBaseStdPop"' + lk + '>' +
      '<option value="cn"' + (t.stdPop === 'cn' ? ' selected' : '') + '>中国 2000 年标准人口（中标率）</option>' +
      '<option value="world"' + (t.stdPop === 'world' ? ' selected' : '') + '>Segi 世界标准人口（世标率）</option></select></div>' +
      '<div class="form-group"><label>分析癌种</label><select id="arBaseCancer"' + lk + '>' +
      CANCERS.map(function (c) { return '<option' + (t.cancer === c ? ' selected' : '') + '>' + e(c) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-group"><label>报告模板</label><select id="arBaseTpl"' + lk + '>' +
      templates.filter(function (x) { return x.enabled !== false; }).map(function (x) {
        return '<option value="' + x.id + '"' + (t.templateId === x.id ? ' selected' : '') + '>' + e(x.name) + ' (' + e(x.version) + ')</option>';
      }).join('') + '</select></div>' +
      '<div class="form-group"><label>报告标题</label><input type="text" id="arBaseTitle" value="' + e(t.title) + '"' + lk + ' placeholder="如：2025 年江西省肿瘤登记年报"></div>' +
      '<div class="form-group"><label>任务编号</label><input type="text" value="' + e(t.id) + '" disabled></div>' +
      '</div>' +
      (t.scope === 'city' ? '<div class="form-group" style="margin-top:14px"><label>选择设区市（至少一个）</label><div class="ar-param-city">' +
        REGIONS.filter(function (r) { return r.level === 'city'; }).map(function (r) {
          var on = (t.cities || []).indexOf(r.id) >= 0;
          return '<label class="ar-check' + (on ? ' on' : '') + '"><input type="checkbox" ' + (on ? 'checked' : '') + (locked ? ' disabled' : '') +
            ' onchange="arBaseToggleCity(\'' + r.id + '\',this.checked)"><span>' + e(r.name) + '</span></label>';
        }).join('') + '</div><div class="ar-hint" style="margin-top:6px">已选 ' +
        (t.cities || []).filter(function (c) { return c !== 'jx'; }).length + ' 个设区市</div></div>' : '') +
      (locked ? '' : '<div style="margin-top:16px;display:flex;gap:8px;align-items:center">' +
        '<button class="btn btn-primary btn-sm" onclick="arSaveBaseline()">保存编制基准</button>' +
        '<span class="ar-hint">保存后数据准备阶段的取数口径随之更新</span></div>') +
      '</div></div>';

    var checklist = stageChecklist([
      { ok: !!t.year, title: '确定报告年度', desc: '年度决定取数范围与人口分母' },
      { ok: !!t.scope && (t.scope !== 'city' || (t.cities || []).filter(function (c) { return c !== 'jx'; }).length > 0), title: '确定覆盖范围', desc: t.scope === 'city' ? '按设区市编制时须至少勾选一个市' : '全省口径覆盖 11 设区市' },
      { ok: !!t.popCal, title: '选择人口口径', desc: '常住人口 / 户籍人口，影响全部粗率的分母' },
      { ok: !!t.stdPop, title: '选择标准人口', desc: '中国 2000 年标准人口（中标率）/ Segi 世界标准人口（世标率）' },
      { ok: !!(tplById(t.templateId)), title: '选定报告模板', desc: '决定章节结构、正文块与统计表预设' },
      { ok: !!t.title, title: '确认报告标题', desc: '用于导出文件名、上报记录与归档' }
    ]);

    return form + checklist +
      '<div class="panel" style="margin-bottom:16px"><div class="panel-header">本阶段产物</div><div class="panel-body">' +
      '<div class="ar-artifact-grid">' + AR().byId('task').artifacts.map(function (a) {
        return '<div class="ar-artifact ' + (gate.ok ? 'ok' : 'todo') + '"><span class="ai">' + (gate.ok ? '✓' : '○') + '</span><span>' + a + '</span></div>';
      }).join('') + '</div>' +
      '<div class="ar-hint" style="margin-top:12px">口径一经进入「数据准备」即锁定；后续如需变更，须回退到本阶段重新保存，避免数据与正文口径不一致。</div>' +
      '</div></div>' + stageLogPanel(t, 'task');
  }

  /* ---------- 阶段 1 动作：保存编制基准 ---------- */
  window.arBaseScopeChange = function (v) {
    var t = curTask(); if (!t) return;
    // 切到「按设区市」但一个都没选时，给出明确提示而不是静默变成空范围
    if (v === 'city' && !(t.cities || []).filter(function (c) { return c !== 'jx'; }).length) {
      toast('已切换为按设区市编制，请勾选至少一个设区市后保存', 'warning');
    }
    t.scope = v;
    renderPage('ar-workbench');
  };
  window.arBaseToggleCity = function (id, on) {
    var t = curTask(); if (!t) return;
    t.cities = t.cities || [];
    if (on) { if (t.cities.indexOf(id) < 0) t.cities.push(id); }
    else t.cities = t.cities.filter(function (c) { return c !== id; });
    renderPage('ar-workbench');
  };
  window.arSaveBaseline = function () {
    var t = curTask(); if (!t) return;
    if (t.status !== 'draft') { toast('当前状态不可修改编制基准，请先回退到建立任务阶段', 'error'); return; }
    var g = function (id) { var el = document.getElementById(id); return el ? el.value : null; };
    var year = g('arBaseYear'), popCal = g('arBasePopCal'), stdPop = g('arBaseStdPop'), cancer = g('arBaseCancer'), tplId = g('arBaseTpl');
    var title = (g('arBaseTitle') || '').trim();
    var scope = g('arBaseScope') || t.scope;
    if (!title) { toast('报告标题不能为空', 'error'); return; }
    if (scope === 'city' && !(t.cities || []).filter(function (c) { return c !== 'jx'; }).length) {
      toast('覆盖范围为「按设区市选择」时，至少勾选一个设区市', 'error'); return;
    }
    var before = { year: t.year, popCal: t.popCal, stdPop: t.stdPop, cancer: t.cancer, tpl: t.templateId, scope: t.scope, title: t.title };
    var changed = [];
    if (String(t.year) !== String(year)) changed.push('报告年度 ' + t.year + ' → ' + year);
    if (t.popCal !== popCal) changed.push('人口口径 → ' + (popCal === 'household' ? '户籍人口' : '常住人口'));
    if (t.stdPop !== stdPop) changed.push('标准人口 → ' + (stdPop === 'world' ? 'Segi 世界' : '中国 2000'));
    if (t.cancer !== cancer) changed.push('分析癌种 → ' + cancer);
    if (t.templateId !== tplId) changed.push('报告模板 → ' + ((tplById(tplId) || {}).name || tplId));
    if (t.scope !== scope) changed.push('覆盖范围 → ' + (scope === 'city' ? '按设区市' : '全省'));
    if (t.title !== title) changed.push('报告标题 → ' + title);

    t.year = year; t.popCal = popCal; t.stdPop = stdPop; t.cancer = cancer;
    t.templateId = tplId; t.scope = scope; t.title = title;
    if (changed.length) {
      // 口径变了，已生成的产物全部作废——否则会出现「数据按旧口径、正文写新口径」
      var hadProducts = (t.dataPrep && t.dataPrep.dedupDone) || (t.stats && t.stats.done) || Object.keys(t.chapters || {}).length > 0;
      if (hadProducts) {
        t.dataPrep = Object.assign({}, t.dataPrep, { dedupDone: false, fieldsChecked: false });
        t.qc = { done: false, issues: [], kpis: [] };
        t.stats = seedStats(false);
        t.chapters = {};
        t.draftCheck = null;
        t.agg = { done: false, result: null }; t.valid = { done: false, result: null };
        t.dataVersion = 'DV-' + year + '-' + String(Date.now()).slice(-4);
      }
      t.corrections = t.corrections || [];
      t.corrections.unshift({ ver: t.version, at: nowStr(), by: t.createdBy || '省级上报岗', note: '调整编制基准：' + changed.join('；') });
      AR().logStage(t, '修改基准', 'task', 'task', changed.join('；') + (hadProducts ? '（已生成的产物作废，需重新取数）' : ''), t.createdBy || '省级上报岗');
    }
    touch(t);
    renderPage('ar-workbench');
    toast(changed.length ? '编制基准已保存：' + changed.join('；') : '编制基准无变化');
  };
  function ctxItem(k, v) { return '<div class="ar-ctx-item"><div class="k">' + k + '</div><div class="v">' + e(v) + '</div></div>'; }

  /* ---------- 阶段 2：数据准备 ---------- */
  function wsData(t) {
    var dp = t.dataPrep || { sources: [] };
    var srcs = dp.sources || [];
    var ready = srcs.filter(function (s) { return s.state === 'ready'; }).length;
    var connected = srcs.filter(function (s) { return s.state !== 'pending'; }).length;
    var gate = AR().evalGate('data', t, ARH);

    /* 源操作：未接入 → 接入取数；已接入待核对 → 执行核对；已核对 → 重新取数 */
    var srcRows = srcs.map(function (s) {
      var tone = s.state === 'ready' ? 'success' : s.state === 'failed' ? 'danger' : s.state === 'pending' ? 'neutral' : 'warning';
      var ops;
      if (s.state === 'pending') {
        ops = '<button class="btn btn-primary btn-xs" onclick="arConnectSource(\'' + s.id + '\')">接入取数</button>';
      } else if (s.state === 'receiving') {
        ops = '<button class="btn btn-primary btn-xs" onclick="arVerifySource(\'' + s.id + '\')">执行核对</button>' +
          ' <button class="btn btn-ghost btn-xs" onclick="arConnectSource(\'' + s.id + '\')">重新取数</button>';
      } else if (s.state === 'failed') {
        ops = '<button class="btn btn-warning btn-xs" onclick="arConnectSource(\'' + s.id + '\')">重试接入</button>';
      } else {
        ops = '<button class="btn btn-ghost btn-xs" onclick="arConnectSource(\'' + s.id + '\')">重新取数</button>' +
          (s.diff ? ' <button class="btn btn-outline btn-xs" onclick="arShowSourceDiff(\'' + s.id + '\')">查看差异</button>' : '');
      }
      return '<tr><td class="txt" style="font-size:13px;color:#1f2937">' + e(s.name) +
        '<div style="font-size:11.5px;color:#94a3b8;margin-top:2px">' + e(s.kind) + (s.desc ? ' · ' + e(s.desc) : '') + '</div></td>' +
        '<td class="num">' + (s.cards != null && s.cards !== '' ? fmt(s.cards) : '—') + '</td>' +
        '<td class="code">' + badge(tone, AR().sourceStateLabel(s.state)) + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + e(s.at || '—') + '</td>' +
        '<td class="txt" style="font-size:12px;color:#64748b">' + e(s.note || '—') + '</td>' +
        '<td class="ops">' + ops + '</td></tr>';
    }).join('');

    var dedupPanel = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">剔重与多原发处理' +
      (dp.dedupDone ? '<span class="ph-sub">已完成 · ' + e(dp.dedupAt || '') + '</span>' : '<span class="ph-sub">未执行</span>') + '</div>' +
      '<div class="panel-body">' +
      (dp.dedupDone
        ? '<div class="ar-metric-grid">' + metric('删除重复卡', fmt(dp.dupRemoved), '同证件同癌种同年份') +
          metric('识别多原发', fmt(dp.multiPrimary), '同一患者多个原发') +
          metric('未定位病例', fmt(dp.unlocated), '待县级登记处补充') +
          metric('合并后有效病例', fmt(dp.validCards != null ? dp.validCards : Math.max(0, (AGG_RESULT.cards || 0) - (dp.dupRemoved || 0))), '用于全部率值的分子') +
          '</div>' +
          '<div style="margin-top:12px"><button class="btn btn-ghost btn-sm" onclick="arRunDataPrep(true)">重新执行剔重</button>' +
          '<span class="ar-hint" style="margin-left:10px">重新执行会作废后续质控与统计产物</span></div>'
        : '<div class="ar-empty-inline">尚未执行剔重，合并后的有效病例数不可用，质控无法开展。' +
          '<button class="btn btn-primary btn-sm" onclick="arRunDataPrep()"' + (connected < srcs.length ? ' disabled title="须先完成全部数据源接入"' : '') + '>执行剔重与多原发识别</button>' +
          (connected < srcs.length ? '<span class="ar-hint">（尚有 ' + (srcs.length - connected) + ' 个数据源未接入）</span>' : '') + '</div>') +
      '</div></div>';

    var f = dp.fieldStats;
    var fieldPanel = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">必填字段齐备性检查' +
      (dp.fieldsChecked ? '<span class="ph-sub">已完成 · ' + e(dp.fieldsAt || '') + '</span>' : '<span class="ph-sub">未执行</span>') + '</div>' +
      '<div class="panel-body">' +
      (dp.fieldsChecked && f
        ? '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:0">' +
          '<thead><tr><th class="txt">字段</th><th class="num">缺失数</th><th class="num">缺失率</th><th class="code">阈值</th><th class="code">判定</th></tr></thead><tbody>' +
          f.map(function (x) {
            var pass = x.rate <= x.max;
            return '<tr><td class="txt" style="font-size:13px;color:#1f2937">' + e(x.name) + '</td>' +
              '<td class="num">' + fmt(x.missing) + '</td>' +
              '<td class="num" style="font-weight:700;color:' + (pass ? '#067647' : '#b42318') + '">' + f1(x.rate) + '%</td>' +
              '<td class="code">≤ ' + x.max + '%</td>' +
              '<td class="code">' + (pass ? badge('success', '达标') : badge('danger', '超标')) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="ar-empty-inline">尚未执行字段齐备性检查。' +
          '<button class="btn btn-primary btn-sm" onclick="arCheckFields()"' + (dp.dedupDone ? '' : ' disabled title="须先执行剔重"') + '>执行字段检查</button></div>') +
      '</div></div>';

    return '<div class="panel" style="margin-bottom:16px"><div class="panel-header">多源数据接入台账' +
      '<span class="ph-sub">已接入 ' + connected + ' / ' + srcs.length + ' · 已核对 ' + ready + ' / ' + srcs.length + '</span></div>' +
      '<div class="panel-body" style="padding-top:8px">' +
      (connected < srcs.length ? '<div class="ar-empty-inline" style="margin-bottom:12px">接入取数将按编制基准（' +
        e(t.year) + ' 年度 · ' + e(scopeLabel(t)) + '）从各数据源拉取记录，并自动比对与上一版快照的差异。' +
        '<button class="btn btn-primary btn-sm" onclick="arConnectAllSources()">一键接入全部数据源</button></div>' : '') +
      (srcs.length ? '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:1080px"><colgroup><col><col style="width:100px"><col style="width:120px"><col style="width:150px"><col><col style="width:190px"></colgroup>' +
        '<thead><tr><th class="txt">数据源</th><th class="num">记录数</th><th class="code">接入状态</th><th class="code">最近操作</th><th class="txt">备注</th><th class="ops">操作</th></tr></thead>' +
        '<tbody>' + srcRows + '</tbody></table></div>' : '<div class="ar-empty-inline">尚未登记数据源</div>') +
      '</div></div>' + dedupPanel + fieldPanel +
      stageChecklist([
        { ok: srcs.length > 0 && connected === srcs.length, title: '各数据源完成接入取数', desc: connected + ' / ' + srcs.length + ' 个已接入' },
        { ok: srcs.length > 0 && ready === srcs.length, title: '接入记录与源端核对一致', desc: ready + ' / ' + srcs.length + ' 个已核对' },
        { ok: !!dp.dedupDone, title: '执行剔重与多原发识别', desc: '决定有效病例数，是所有率值的分子基础' },
        { ok: !!dp.fieldsChecked, title: '必填字段齐备性检查', desc: '缺失率超标会直接拉低质控评级' }
      ]) + stageLogPanel(t, 'data');
  }

  /* ---------- 阶段 3：质量校验 ---------- */
  function wsQc(t) {
    var q = AR().summaries.qc(t);
    var kpis = (t.qc && t.qc.kpis) || [];
    var done = !!(t.qc && t.qc.done);
    var gate = AR().evalGate('qc', t, ARH);

    var kpiRows = kpis.map(function (k) {
      return '<tr><td class="txt" style="font-size:13px;color:#1f2937">' + e(k.name) + '</td>' +
        '<td class="num" style="font-weight:700;color:' + (k.pass ? '#067647' : '#b42318') + '">' + e(k.value) + '</td>' +
        '<td class="code">' + e(k.require) + '</td>' +
        '<td class="code">' + (k.pass ? badge('success', '达标') : badge('danger', '未达标')) + '</td></tr>';
    }).join('');

    var issueRows = q.issues.map(function (it) {
      var st = { open: badge('danger', '待整改'), fixing: badge('warning', '整改中'), closed: badge('success', '已闭环'), waived: badge('info', '已豁免') }[it.state] || badge('neutral', it.state);
      var ops = it.state === 'closed' || it.state === 'waived'
        ? '<button class="btn btn-ghost btn-xs" onclick="arShowIssue(\'' + it.id + '\')">查看处置</button>'
        : '<button class="btn btn-primary btn-xs" onclick="arCloseIssue(\'' + it.id + '\')">标记闭环</button> ' +
          '<button class="btn btn-ghost btn-xs" onclick="arWaiveIssue(\'' + it.id + '\')">申请豁免</button>';
      return '<tr><td class="code" style="font-size:12px">' + e(it.no) + '</td>' +
        '<td class="code">' + e(it.region) + '</td>' +
        '<td class="txt" style="font-size:12.5px">' + e(it.rule) + '</td>' +
        '<td class="code">' + (it.level === 'bad' ? badge('danger', '错误') : badge('warning', '警告')) + '</td>' +
        '<td class="txt" style="font-size:12px;color:#64748b">' + e(it.detail) + '</td>' +
        '<td class="code">' + st + '</td>' +
        '<td class="ops"><button class="btn btn-ghost btn-xs" onclick="arShowIssue(\'' + it.id + '\')">详情</button>' + ops + '</td></tr>';
    }).join('');

    var openBad = q.issues.filter(function (x) { return x.level === 'bad' && x.state !== 'closed' && x.state !== 'waived'; });
    var openWarn = q.issues.filter(function (x) { return x.level !== 'bad' && x.state !== 'closed' && x.state !== 'waived'; });

    var head = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">国家登记质量考核指标' +
      (done ? '<span class="ph-sub">' + kpis.filter(function (k) { return k.pass; }).length + ' / ' + kpis.length + ' 项达标</span>' : '<span class="ph-sub">未执行校验</span>') + '</div>' +
      '<div class="panel-body" style="padding-top:8px">' +
      (done ? '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:0"><thead><tr><th class="txt">指标</th><th class="num">本省值</th><th class="code">国家要求</th><th class="code">判定</th></tr></thead><tbody>' + kpiRows + '</tbody></table></div>'
        : '<div class="ar-empty-inline">尚未执行质量校验。校验将对标国家登记质量考核阈值，逐项判定并生成问题清单。' +
          '<button class="btn btn-primary btn-sm" onclick="arRunQC()">执行质量校验</button></div>') +
      (done ? '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" onclick="arRunQC(true)">重新执行校验</button>' +
        '<button class="btn btn-outline btn-sm" onclick="arExportQcReport()">导出质控报告</button></div>' : '') +
      '</div></div>';

    var issuePanel = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">质控问题清单' +
      (q.issues.length ? '<span class="ph-sub">共 ' + q.total + ' 项 · 待处理 ' + q.open + ' 项（错误 ' + q.openBad + ' / 警告 ' + q.openWarn + '）</span>' : '') + '</div>' +
      '<div class="panel-body" style="padding-top:8px">' +
      (q.issues.length ? (
        '<div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<span class="ar-hint">批量处置：</span>' +
        '<button class="btn btn-outline btn-sm"' + (openBad.length ? '' : ' disabled') + ' onclick="arBatchClose(\'bad\')">闭环全部错误级（' + openBad.length + '）</button>' +
        '<button class="btn btn-outline btn-sm"' + (openWarn.length ? '' : ' disabled') + ' onclick="arBatchClose(\'warn\')">闭环全部警告级（' + openWarn.length + '）</button>' +
        '<button class="btn btn-ghost btn-sm"' + (openWarn.length ? '' : ' disabled') + ' onclick="arBatchWaive()">豁免全部警告级</button>' +
        '</div>' +
        '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:1240px"><colgroup><col style="width:130px"><col style="width:90px"><col style="width:170px"><col style="width:80px"><col><col style="width:100px"><col style="width:230px"></colgroup>' +
        '<thead><tr><th class="code">报告卡号</th><th class="code">地区</th><th class="txt">触发规则</th><th class="code">级别</th><th class="txt">问题描述</th><th class="code">状态</th><th class="ops">操作</th></tr></thead><tbody>' + issueRows + '</tbody></table></div>'
      ) : '<div class="ar-empty-inline">' + (done ? '未发现问题，质控干净。' : '执行校验后在此查看问题清单。') + '</div>') +
      '<div class="ar-hint" style="margin-top:12px">错误级问题必须全部闭环；警告级可闭环或提交豁免说明后放行。全部闭环方可进入统计分析阶段。</div>' +
      '</div></div>';

    /* 问题详情弹层同样挂工作台层（见 renderIssueViewer） */
    var issueModal = renderIssueViewer(t);

    return head + issuePanel + issueModal +
      stageChecklist([
        { ok: done, title: '执行质量校验', desc: '对标 MV% 66–95 / DCO% ≤15 / M-I 0.6–0.8 / O&U% ≤5 等国家阈值' },
        { ok: done && kpis.every(function (k) { return k.pass; }), title: '国家考核指标全部达标', desc: kpis.length ? kpis.filter(function (k) { return !k.pass; }).length + ' 项未达标' : '待执行' },
        { ok: q.openBad === 0, title: '错误级问题全部闭环', desc: q.openBad ? '仍有 ' + q.openBad + ' 项错误未整改' : '无未闭环错误' },
        { ok: q.openWarn === 0, title: '警告级问题闭环或豁免', desc: q.openWarn ? '仍有 ' + q.openWarn + ' 项警告未处理' : '警告已处理完毕' }
      ]) + stageLogPanel(t, 'qc');
  }

  /* ---------- 阶段 4：统计分析 ---------- */
  function wsStats(t) {
    var s = AR().summaries.stats(t);
    var gate = AR().evalGate('stats', t, ARH);

    var ratePanel = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">标化率计算底稿' +
      (s.done ? '' : '<span class="ph-sub">待统计</span>') + '</div><div class="panel-body">' +
      (s.done ? (
        '<div class="ar-metric-grid">' +
        metric('粗发病率', f1(173.3), '分子 78,505 / 分母 4,530 万') +
        metric('中标发病率', f1(119.4), '中国 2000 标准人口') +
        metric('世标发病率', f1(158.1), 'Segi 世界标准人口') +
        metric('累积发病率 0-74', f1(22.4) + '%', '截缩率') +
        '</div><div class="ar-metric-grid" style="margin-top:10px">' +
        metric('粗死亡率', f1(102.2), '分子 46,297 / 分母 4,530 万', true) +
        metric('中标死亡率', f1(67.8), '中国 2000 标准人口', true) +
        metric('世标死亡率', f1(93.6), 'Segi 世界标准人口', true) +
        metric('累积死亡率 0-74', f1(13.3) + '%', '截缩率', true) +
        '</div>' +
        '<div class="ar-hint" style="margin-top:12px">标化率 = Σ(年龄别率 × 标准人口权重) / Σ标准人口权重。' +
        '本次计算使用数据快照 <b>' + e(s.snapshotAt || '—') + '</b>（数据版本 ' + e(t.dataVersion || '—') + '）。' +
        '数据版本变更后统计产物将自动标记过期，须重新统计。</div>'
      ) : '<div class="ar-empty-inline">尚未生成统计产物。统计将输出 ' + STAT_TABLES.length + ' 张统计表与 ' + STAT_CHARTS.length + ' 张图表，并固化数据快照版本。' +
        '<button class="btn btn-primary btn-sm" onclick="arRunStats()">执行统计分析</button></div>') +
      '</div></div>';

    var tableRows = s.tables.map(function (x) {
      return '<tr><td class="code">' + e(x.no) + '</td><td class="txt" style="font-size:13px;color:#1f2937">' + e(x.name) + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + e(x.dim) + '</td>' +
        '<td class="num">' + x.rows + '</td>' +
        '<td class="code">' + badge('success', '已生成') + '</td>' +
        '<td class="ops"><button class="btn btn-ghost btn-xs" onclick="arViewStatTable(\'' + x.id + '\')">查看</button></td></tr>';
    }).join('');
    var chartRows = s.charts.map(function (x) {
      return '<tr><td class="code">' + e(x.no) + '</td><td class="txt" style="font-size:13px;color:#1f2937">' + e(x.name) + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + e(x.type) + '</td>' +
        '<td class="code">' + badge('success', '已生成') + '</td>' +
        '<td class="ops"><button class="btn btn-ghost btn-xs" onclick="arViewStatChart(\'' + x.id + '\')">查看</button></td></tr>';
    }).join('');

    var artifactPanel = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">统计产物清单' +
      '<span class="ph-sub">统计表 ' + s.tableN + ' 张 · 图表 ' + s.chartN + ' 张</span></div>' +
      '<div class="panel-body">' +
      '<div class="ar-split2">' +
      '<div><div class="ar-sub-h">统计表</div>' + (tableRows ? '<table class="data-table" style="width:100%;min-width:0"><thead><tr><th class="code">编号</th><th class="txt">表名</th><th class="code">维度</th><th class="num">行</th><th class="code">状态</th><th class="ops">操作</th></tr></thead><tbody>' + tableRows + '</tbody></table>' : '<div class="ar-hint">尚未生成统计表</div>') + '</div>' +
      '<div><div class="ar-sub-h">图表</div>' + (chartRows ? '<table class="data-table" style="width:100%;min-width:0"><thead><tr><th class="code">编号</th><th class="txt">图名</th><th class="code">类型</th><th class="code">状态</th><th class="ops">操作</th></tr></thead><tbody>' + chartRows + '</tbody></table>' : '<div class="ar-hint">尚未生成图表</div>') + '</div>' +
      '</div></div></div>';

    /* 统计表 / 图表的查看弹层：点「查看」必须真能看到内容。
       注意：弹层挂在工作台层（renderWorkbench），不能只挂在「统计分析」阶段里——
       用户走到审核、发布阶段想回看某张统计表时，阶段工作区已经不是统计阶段了。 */
    var viewer = renderStatViewer(t);

    // 复用既有的可视化与分层汇总作为统计结果的可视化佐证
    var vizPanel = s.done ? ('<div class="panel" style="margin-bottom:16px"><div class="panel-header">统计结果可视化</div><div class="panel-body">' + sectionMetrics(t) + '</div></div>') : '';
    var distPanel = s.done ? ('<div class="panel" style="margin-bottom:16px"><div class="panel-header">分设区市分层汇总</div><div class="panel-body">' + sectionOverview(t) + '</div></div>') : '';

    return ratePanel + artifactPanel + vizPanel + distPanel + viewer +
      stageChecklist([
        { ok: s.done, title: '执行统计分析生成产物', desc: '输出统计表与图表，固化数据快照' },
        { ok: s.tableN > 0, title: '统计表清单齐备', desc: s.tableN + ' 张统计表' },
        { ok: s.chartN > 0, title: '图表清单齐备', desc: s.chartN + ' 张图表' },
        { ok: s.done && !s.stale, title: '统计快照与当前数据版本一致', desc: s.stale ? '统计数据快照已过期，需重新统计' : '快照版本 ' + (t.dataVersion || '—') }
      ]) + stageLogPanel(t, 'stats');
  }

  /* 质控问题详情弹层：工作台级渲染，走到后续阶段也能回看问题处置记录 */
  function renderIssueViewer(t) {
    if (!arState.issueView || !t) return '';
    var it = ((t.qc || {}).issues || []).filter(function (x) { return x.id === arState.issueView; })[0];
    if (!it) return '';
    var stateLabel = { open: '待整改', fixing: '整改中', closed: '已闭环', waived: '已豁免' }[it.state] || it.state;
    return '<div class="ar-modal"><div class="ar-modal-mask" onclick="arCloseIssueView()"></div>' +
      '<div class="ar-modal-box" style="width:680px"><div class="ar-modal-hd">质控问题详情 · ' + e(it.no) +
      '<button class="ar-modal-x" onclick="arCloseIssueView()">×</button></div>' +
      '<div class="ar-modal-bd"><div class="ar-ctx-grid" style="grid-template-columns:repeat(2,1fr);gap:14px 20px">' +
      ctxItem('报告卡号', it.no) + ctxItem('归属地区', it.region) +
      ctxItem('触发规则', it.rule) + ctxItem('问题级别', it.level === 'bad' ? '错误' : '警告') +
      ctxItem('当前状态', stateLabel) + ctxItem('责任单位', it.owner || (it.region + '登记处')) +
      ctxItem('发现时间', it.raisedAt || '—') + ctxItem('限改时间', it.dueAt || '年报提交前') +
      '</div>' +
      '<div class="ar-detail-block"><div class="ar-detail-t">问题描述</div><div class="ar-detail-c">' + e(it.detail) + '</div></div>' +
      '<div class="ar-detail-block"><div class="ar-detail-t">判定依据</div><div class="ar-detail-c">' + e(it.basis || ('按《中国肿瘤登记工作指导手册》' + it.rule + '规则判定')) + '</div></div>' +
      (it.state === 'closed' ? '<div class="ar-detail-block"><div class="ar-detail-t">整改闭环</div><div class="ar-detail-c">' + e(it.closedBy || '—') + ' 于 ' + e(it.closedAt || '—') + ' 标记闭环' + (it.fixNote ? '：' + e(it.fixNote) : '') + '</div></div>' : '') +
      (it.state === 'waived' ? '<div class="ar-detail-block"><div class="ar-detail-t">豁免说明</div><div class="ar-detail-c">' + e(it.waivedBy || '—') + ' 于 ' + e(it.waivedAt || '—') + ' 批准豁免：' + e(it.waiveNote || '—') + '</div></div>' : '') +
      (it.state !== 'closed' && it.state !== 'waived' ? '<div class="ar-detail-block"><div class="ar-detail-t">整改说明</div><textarea id="arFixNote" rows="3" style="width:100%" placeholder="填写整改措施与结果，如：已核对原始病历，确诊日期修正为 2024-05-18"></textarea></div>' : '') +
      '</div>' +
      '<div class="ar-modal-ft">' +
      (it.state === 'closed' || it.state === 'waived'
        ? '<button class="btn btn-ghost" onclick="arReopenIssue(\'' + it.id + '\')">撤销处置</button>'
        : '<button class="btn btn-primary" onclick="arCloseIssue(\'' + it.id + '\')">确认闭环</button>' +
          (it.level === 'bad' ? '' : '<button class="btn btn-outline" onclick="arWaiveIssue(\'' + it.id + '\')">申请豁免</button>')) +
      '<button class="btn btn-ghost" onclick="arCloseIssueView()">关闭</button></div></div></div>';
  }

  /* 统计表 / 图表查看弹层：工作台级渲染，任何阶段都能回看已生成的统计产物 */
  function renderStatViewer(t) {
    if (!arState.statView || !t) return '';
    var v = arState.statView;
    var stats = t.stats || { tables: [], charts: [] };
    var body;
    if (v.kind === 'chart') {
      var ch = (stats.charts || []).filter(function (x) { return x.id === v.id; })[0];
      body = ch ? chartPreviewHtml(ch) : '<div class="ar-hint">图表不存在或尚未生成</div>';
    } else {
      var tb = (stats.tables || []).filter(function (x) { return x.id === v.id; })[0];
      body = tb ? statTableHtml(tb, t) : '<div class="ar-hint">统计表不存在或尚未生成</div>';
    }
    return '<div class="ar-modal" id="arStatViewer"><div class="ar-modal-mask" onclick="arCloseStatView()"></div>' +
      '<div class="ar-modal-box" style="width:1000px"><div class="ar-modal-hd">' +
      (v.kind === 'chart' ? '图表预览' : '统计表预览') + ' · ' + e(v.title || '') +
      '<button class="ar-modal-x" onclick="arCloseStatView()">×</button></div>' +
      '<div class="ar-modal-bd">' + body + '</div>' +
      '<div class="ar-modal-ft"><button class="btn btn-ghost" onclick="arCloseStatView()">关闭</button>' +
      (v.kind === 'table' ? '<button class="btn btn-outline" onclick="arExportStatTable()">导出为 CSV</button>' : '') +
      '</div></div></div>';
  }

  /* ---------- 统计表 / 图表 内容渲染 ----------
     这些数据由当前任务的汇总结果与癌种/地区明细派生，接真实数据时
     只需把 INC_SITE / REGIONS 换成真实查询结果，表格结构无需改动。 */
  function statTableHtml(tb, t) {
    var pop = 45300000;
    var popWan = pop / 10000;
    var stdLabel = t.stdPop === 'world' ? '世标率' : '中标率';
    var head, body;

    if (tb.id === 't1' || tb.id === 't2') {
      var isDeath = tb.id === 't2';
      var total = isDeath ? AGG_RESULT.death : AGG_RESULT.valid;
      var maleRatio = isDeath ? 0.612 : 0.5633;
      var male = Math.round(total * maleRatio), female = total - male;
      var rows = [
        { k: '合计', n: total, r: total / popWan },
        { k: '男', n: male, r: male / popWan },
        { k: '女', n: female, r: female / popWan }
      ];
      head = '<tr><th class="txt">性别</th><th class="num">例数</th><th class="num">粗' + (isDeath ? '死亡' : '发病') + '率(1/10万)</th>' +
        '<th class="num">中标' + (isDeath ? '死亡' : '发病') + '率(1/10万)</th><th class="num">世标' + (isDeath ? '死亡' : '发病') + '率(1/10万)</th><th class="num">构成比(%)</th></tr>';
      body = rows.map(function (r) {
        var cn = r.r * (isDeath ? 0.678 / 102.2 : 119.4 / 173.3);
        var wd = r.r * (isDeath ? 0.936 / 102.2 : 158.1 / 173.3);
        return '<tr><td class="txt">' + r.k + '</td><td class="num">' + fmt(r.n) + '</td>' +
          '<td class="num">' + f1(r.r) + '</td><td class="num">' + f1(cn) + '</td><td class="num">' + f1(wd) + '</td>' +
          '<td class="num">' + f1(r.n / total * 100) + '</td></tr>';
      }).join('');
    } else if (tb.id === 't3' || tb.id === 't4') {
      var isD = tb.id === 't4';
      var tot = isD ? AGG_RESULT.death : AGG_RESULT.valid;
      var list = SITES.slice().sort(function (a, b) { return (isD ? b.death - a.death : b.inc - a.inc); });
      head = '<tr><th class="num">顺位</th><th class="txt">癌种</th><th class="code">ICD-10</th><th class="num">例数</th>' +
        '<th class="num">粗率(1/10万)</th><th class="num">构成比(%)</th><th class="num">累积率 0-74(%)</th></tr>';
      body = list.map(function (x, i) {
        var n = isD ? x.death : x.inc;
        return '<tr><td class="num">' + (i + 1) + '</td><td class="txt" style="font-weight:600">' + e(x.name) + '</td>' +
          '<td class="code">' + e(x.icd) + '</td><td class="num">' + fmt(n) + '</td>' +
          '<td class="num">' + f1(n / popWan) + '</td>' +
          '<td class="num">' + f1(n / tot * 100) + '</td>' +
          '<td class="num">' + f1(n / tot * 22.4) + '</td></tr>';
      }).join('');
    } else if (tb.id === 't5') {
      var pyr = buildPyramid();
      head = '<tr><th class="txt">年龄组</th><th class="num">男发病</th><th class="num">女发病</th><th class="num">男粗率</th><th class="num">女粗率</th><th class="num">合计</th></tr>';
      body = pyr.map(function (d) {
        var n = d.male + d.female;
        return '<tr><td class="txt">' + e(d.age) + '</td><td class="num">' + fmt(d.male) + '</td><td class="num">' + fmt(d.female) + '</td>' +
          '<td class="num">' + f1(d.male / popWan) + '</td><td class="num">' + f1(d.female / popWan) + '</td><td class="num">' + fmt(n) + '</td></tr>';
      }).join('');
    } else if (tb.id === 't6' || tb.id === 't7') {
      var isDeath2 = tb.id === 't7';
      head = '<tr><th class="txt">设区市</th><th class="num">覆盖人口(万)</th><th class="num">' + (isDeath2 ? '死亡' : '发病') + '例数</th>' +
        '<th class="num">粗' + (isDeath2 ? '死亡' : '发病') + '率(1/10万)</th><th class="num">占全省(%)</th></tr>';
      var allN = isDeath2 ? AGG_RESULT.death : AGG_RESULT.valid;
      body = REGIONS.filter(function (r) { return r.level === 'city'; }).map(function (r) {
        var n = isDeath2 ? regionDeath(r) : regionInc(r);
        return '<tr><td class="txt">' + e(r.name) + '</td><td class="num">' + f1(r.pop / 10000) + '</td>' +
          '<td class="num">' + fmt(n) + '</td><td class="num">' + f1(isDeath2 ? r.deathRate : r.incRate) + '</td>' +
          '<td class="num">' + f1(n / allN * 100) + '</td></tr>';
      }).join('');
    } else if (tb.id === 't8') {
      head = '<tr><th class="txt">癌种</th><th class="num">五年相对生存率(%)</th><th class="code">随访队列</th><th class="code">数据完整性</th></tr>';
      body = SURVIVAL.map(function (x) {
        var okRate = x.rate >= 40;
        return '<tr><td class="txt" style="font-weight:600">' + e(x.site) + '</td>' +
          '<td class="num" style="font-weight:700;color:' + (okRate ? '#067647' : '#b42318') + '">' + f1(x.rate) + '</td>' +
          '<td class="code">2014-2019 队列</td><td class="code">' + badge(x.rate >= 30 ? 'success' : 'warning', x.rate >= 30 ? '完整' : '偏低') + '</td></tr>';
      }).join('');
    } else if (tb.id === 't9') {
      var kpis = (t.qc && t.qc.kpis) || [];
      head = '<tr><th class="txt">考核指标</th><th class="num">本省值</th><th class="code">国家要求</th><th class="code">判定</th></tr>';
      body = kpis.map(function (k) {
        return '<tr><td class="txt">' + e(k.name) + '</td><td class="num" style="font-weight:700;color:' + (k.pass ? '#067647' : '#b42318') + '">' + e(k.value) + '</td>' +
          '<td class="code">' + e(k.require) + '</td><td class="code">' + (k.pass ? badge('success', '达标') : badge('danger', '未达标')) + '</td></tr>';
      }).join('');
    } else if (tb.id === 'trend') {
      head = '<tr><th class="num">年度</th><th class="num">发病例数</th><th class="num">粗发病率</th><th class="num">死亡例数</th><th class="num">粗死亡率</th></tr>';
      body = TREND.map(function (x) {
        return '<tr><td class="num">' + x.year + '</td><td class="num">' + fmt(x.inc) + '</td><td class="num">' + f1(x.incRate) + '</td>' +
          '<td class="num">' + fmt(x.death) + '</td><td class="num">' + f1(x.deathRate) + '</td></tr>';
      }).join('');
    } else {
      head = '<tr><th class="txt">项目</th><th class="num">值</th></tr>';
      body = '<tr><td class="txt">' + e(tb.name) + '</td><td class="num">—</td></tr>';
    }

    return '<div class="ar-table-caption">' + e(tb.no) + '　' + e(tb.name) +
      '<span class="ar-table-note">数据快照 ' + e((t.stats || {}).snapshotAt || '—') + ' · 数据版本 ' + e(t.dataVersion || '—') + ' · ' + e(stdLabel) + '口径按 ' + (t.stdPop === 'world' ? 'Segi 世界标准人口' : '中国 2000 年标准人口') + '</span></div>' +
      '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:0"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  function chartPreviewHtml(ch) {
    if (ch.id === 'f1' || ch.id === 'f2' || ch.id === 'f3') {
      return ch.id === 'f1' ? chartPyramid() : (ch.id === 'f2' ? chartRank() : chartRankDeath());
    }
    if (ch.id === 'f4') return chartRegion();
    if (ch.id === 'f5') return chartTrend();
    return chartSurvival();
  }
  /* ---------- 文件导出：真实产出可下载的文件 ----------
     原型里「导出」只弹个 toast 就完了，用户手里什么都没有。
     这里用 Blob + a[download] 生成真实文件，浏览器会直接落盘。 */
  function downloadTextFile(fileName, content, mime) {
    try {
      var blob = new Blob(['\ufeff' + content], { type: (mime || 'text/csv') + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      window.setTimeout(function () {
        try { document.body.removeChild(a); } catch (e) {}
        URL.revokeObjectURL(url);
      }, 1000);
      return true;
    } catch (err) {
      toast('导出失败：' + err.message, 'error');
      return false;
    }
  }
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows) { return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'); }

  /* 把展示用的统计表 HTML 落成 CSV。为此单独实现一遍取数逻辑：
     展示层要的是「长什么样」，导出要的是「值是什么」，两者拆开才不会互相牵制。 */
  function statTableCsv(t, id) {
    var popWan = 45300000 / 10000;
    var rows = [];
    function head(arr) { rows.push(arr); }

    if (id === 't1' || id === 't2') {
      var isDeath = id === 't2';
      var total = isDeath ? AGG_RESULT.death : AGG_RESULT.valid;
      var male = Math.round(total * (isDeath ? 0.612 : 0.5633));
      head(['性别', '例数', '粗率(1/10万)', '中标率(1/10万)', '世标率(1/10万)', '构成比(%)']);
      [['合计', total], ['男', male], ['女', total - male]].forEach(function (p) {
        var r = p[1] / popWan;
        rows.push([p[0], p[1], f1(r), f1(r * (isDeath ? 0.678 / 102.2 : 119.4 / 173.3)), f1(r * (isDeath ? 0.936 / 102.2 : 158.1 / 173.3)), f1(p[1] / total * 100)]);
      });
    } else if (id === 't3' || id === 't4') {
      var isD = id === 't4';
      var tot = isD ? AGG_RESULT.death : AGG_RESULT.valid;
      head(['顺位', '癌种', 'ICD-10', '例数', '粗率(1/10万)', '构成比(%)', '累积率0-74(%)']);
      SITES.slice().sort(function (a, b) { return (isD ? b.death - a.death : b.inc - a.inc); }).forEach(function (x, i) {
        var n = isD ? x.death : x.inc;
        rows.push([i + 1, x.name, x.icd, n, f1(n / popWan), f1(n / tot * 100), f1(n / tot * 22.4)]);
      });
    } else if (id === 't5') {
      head(['年龄组', '男发病', '女发病', '男粗率', '女粗率', '合计']);
      buildPyramid().forEach(function (d) {
        rows.push([d.age, d.male, d.female, f1(d.male / popWan), f1(d.female / popWan), d.male + d.female]);
      });
    } else if (id === 't6' || id === 't7') {
      var isD2 = id === 't7';
      head(['设区市', '覆盖人口(万)', '例数', '粗率(1/10万)', '占全省(%)']);
      var allN = isD2 ? AGG_RESULT.death : AGG_RESULT.valid;
      REGIONS.filter(function (r) { return r.level === 'city'; }).forEach(function (r) {
        var n = isD2 ? regionDeath(r) : regionInc(r);
        rows.push([r.name, f1(r.pop / 10000), n, f1(isD2 ? r.deathRate : r.incRate), f1(n / allN * 100)]);
      });
    } else if (id === 't8') {
      head(['癌种', '五年相对生存率(%)', '随访队列']);
      SURVIVAL.forEach(function (x) { rows.push([x.site, f1(x.rate), '2014-2019 队列']); });
    } else if (id === 't9') {
      head(['考核指标', '本省值', '国家要求', '判定']);
      ((t.qc && t.qc.kpis) || []).forEach(function (k) { rows.push([k.name, k.value, k.require, k.pass ? '达标' : '未达标']); });
    } else if (id === 'trend') {
      head(['年度', '发病例数', '粗发病率', '死亡例数', '粗死亡率']);
      TREND.forEach(function (x) { rows.push([x.year, x.inc, f1(x.incRate), x.death, f1(x.deathRate)]); });
    } else {
      return null;
    }
    return toCsv(rows);
  }

  window.arViewStatTable = function (id) {
    var t = curTask(); if (!t) return;
    var tb = ((t.stats || {}).tables || []).filter(function (x) { return x.id === id; })[0];
    if (!tb) { toast('统计表不存在', 'error'); return; }
    arState.statView = { kind: 'table', id: id, title: tb.no + ' ' + tb.name };
    renderPage('ar-workbench');
  };
  window.arViewStatChart = function (id) {
    var t = curTask(); if (!t) return;
    var ch = ((t.stats || {}).charts || []).filter(function (x) { return x.id === id; })[0];
    if (!ch) { toast('图表不存在', 'error'); return; }
    arState.statView = { kind: 'chart', id: id, title: ch.no + ' ' + ch.name };
    renderPage('ar-workbench');
  };
  window.arCloseStatView = function () { arState.statView = null; renderPage('ar-workbench'); };
  window.arExportStatTable = function () {
    var t = curTask(); if (!t || !arState.statView) return;
    var v = arState.statView;
    if (v.kind !== 'table') { toast('图表导出请使用「导出与发布」中的 Excel 格式', 'warning'); return; }
    var csv = statTableCsv(t, v.id);
    if (!csv) { toast('统计表不存在', 'error'); return; }
    downloadTextFile(v.title.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '_') + '.csv', csv);
    toast('已导出 ' + v.title + '.csv');
  };

  /* ---------- 阶段 5：正文编制 ---------- */
  function wsDraft(t) {
    var d = AR().summaries.draft(t, chapterTotal, chapterDone);
    var gate = AR().evalGate('draft', t, ARH);
    var chapters = activeTemplateChapters(t);
    var mism = (t.draftCheck && t.draftCheck.mismatches) || [];

    var chList = chapters.map(function (c, i) {
      var has = !!t.chapters[c.id];
      return '<div class="ar-ch-item ' + (has ? 'ok' : 'todo') + '" onclick="arEditChapter(\'' + c.id + '\');arGoStage(\'draft\')">' +
        '<span class="ci">' + (has ? '✓' : '○') + '</span>' +
        '<div class="cb"><div class="cn">第' + CN_NO[i] + '章　' + e(c.title) + '</div>' +
        '<div class="cd">' + e(c.desc || '') + '</div></div>' +
        '<span class="cs">' + (has ? '已编制' : '待编制') + '</span></div>';
    }).join('');

    var panel = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">章节树' +
      '<span class="ph-sub">已完成 ' + d.done + ' / ' + d.total + ' 章</span></div>' +
      '<div class="panel-body"><div class="ar-ch-grid">' + chList + '</div>' +
      '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-primary btn-sm" onclick="arGenerateChapters()">按统计产物生成全部章节</button>' +
      '<button class="btn btn-outline btn-sm" onclick="arCheckDraft()">执行引用一致性核对</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="arViewReport()">预览报告全文</button>' +
      '</div></div></div>';

    var checkPanel = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">引用一致性核对' +
      (t.draftCheck ? '<span class="ph-sub">' + e(t.draftCheck.at) + ' 执行 · 发现 ' + mism.length + ' 处不符</span>' : '<span class="ph-sub">未执行</span>') + '</div>' +
      '<div class="panel-body" style="padding-top:8px">' +
      (t.draftCheck
        ? (mism.length
          ? '<table class="data-table" style="width:100%;min-width:0"><thead><tr><th class="code">章节</th><th class="txt">正文引用值</th><th class="txt">统计产物值</th><th class="code">处理</th></tr></thead><tbody>' +
            mism.map(function (m) {
              return '<tr><td class="code">' + e(m.chapter) + '</td><td class="txt" style="color:#b42318">' + e(m.text) + '</td>' +
                '<td class="txt" style="color:#067647">' + e(m.expected) + '</td>' +
                '<td class="ops"><button class="btn btn-primary btn-xs" onclick="arFixMismatch(\'' + m.chapter + '\')">按统计值订正</button></td></tr>';
            }).join('') + '</tbody></table>'
          : '<div class="ar-empty-inline" style="color:#067647">✓ 正文引用的全部指标与统计产物一致。</div>')
        : '<div class="ar-hint">核对将逐章比对正文中引用的指标数值与统计产物，不一致处会被列出并支持一键订正。</div>') +
      '</div></div>';

    // 正文编辑区（复用既有章节编辑器）
    var editor = sectionReport(t);

    return panel + checkPanel + '<div class="panel" style="margin-bottom:16px"><div class="panel-header">章节正文编辑</div><div class="panel-body">' + editor + '</div></div>' +
      stageChecklist([
        { ok: d.done > 0, title: '生成或人工撰写章节正文', desc: '已完成 ' + d.done + ' / ' + d.total + ' 章' },
        { ok: d.complete, title: '八章正文齐备', desc: d.complete ? '全部章节已编制' : '尚缺 ' + (d.total - d.done) + ' 章' },
        { ok: !!t.draftCheck, title: '执行引用一致性核对', desc: t.draftCheck ? (mism.length ? '发现 ' + mism.length + ' 处不符待订正' : '核对通过') : '尚未执行核对' },
        { ok: !!t.draftCheck && mism.length === 0, title: '引用不一致项全部订正', desc: mism.length ? mism.length + ' 处未订正' : '无待订正项' }
      ]) + stageLogPanel(t, 'draft');
  }

  /* ---------- 阶段 6：审核 ---------- */
  function wsReview(t) {
    var r = AR().summaries.review(t);
    var gate = AR().evalGate('review', t, ARH);

    var roundsHtml = r.rounds.length ? r.rounds.map(function (rd) {
      var tone = rd.result === 'pass' ? 'success' : rd.result === 'reject' ? 'danger' : 'warning';
      var label = rd.result === 'pass' ? '通过' : rd.result === 'reject' ? '退回修改' : '审核中';
      var items = (rd.items || []).map(function (it) {
        return '<tr><td class="code">' + e(it.id) + '</td>' +
          '<td class="txt" style="font-size:12.5px;color:#1f2937">' + e(it.text) + '</td>' +
          '<td class="code">' + (it.level === 'major' ? badge('danger', '重要') : badge('warning', '一般')) + '</td>' +
          '<td class="code">' + (it.replyState === 'replied' ? badge('success', '已回复') : badge('warning', '待回复')) + '</td>' +
          '<td class="txt" style="font-size:12px;color:#64748b">' + e(it.reply || '—') + '</td>' +
          '<td class="ops">' + (it.replyState === 'replied' ? '<span class="ar-hint">—</span>'
            : '<button class="btn btn-primary btn-xs" onclick="arReplyReview(\'' + rd.id + '\',\'' + it.id + '\')">回复</button>') + '</td></tr>';
      }).join('');
      return '<div class="ar-review-round">' +
        '<div class="rr-head"><span class="rr-no">第 ' + rd.round + ' 轮审核</span>' +
        badge(tone, label) +
        '<span class="rr-meta">提交 ' + e(rd.submittedAt) + ' · ' + e(rd.submittedBy) + '　|　审核人 ' + e(rd.reviewer) +
        (rd.decidedAt ? ' · ' + e(rd.decidedAt) : '') + '</span></div>' +
        '<table class="data-table" style="width:100%;min-width:1080px"><colgroup><col style="width:80px"><col><col style="width:80px"><col style="width:90px"><col style="width:280px"><col style="width:100px"></colgroup>' +
        '<thead><tr><th class="code">意见号</th><th class="txt">审核意见</th><th class="code">重要度</th><th class="code">回复状态</th><th class="txt">编制岗回复</th><th class="ops">操作</th></tr></thead>' +
        '<tbody>' + items + '</tbody></table></div>';
    }).join('') : '<div class="ar-empty-inline">尚未提交审核。提交后审核岗将对正文与统计口径进行审核并逐条提出意见。</div>';

    var submitPanel = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">提交审核</div><div class="panel-body">' +
      '<div class="ar-ctx-line"><span>需要复核：<b>八章正文、统计表口径、质控结论</b></span>' +
      '<span>审核岗：<b>省级审核岗</b></span></div>' +
      '<div style="margin-top:12px">' +
      (gate.ok && !r.passed && t.status === 'draft'
        ? '<button class="btn btn-primary" onclick="arSubmitReview()">提交省级审核</button>'
        : r.passed ? '<span class="ar-hint" style="color:#067647">✓ 审核已通过，可进入发布归档阶段</span>'
        : t.status === 'submitted' ? '<span class="ar-hint">已提交，等待审核岗出具结论</span>'
        : '<span class="ar-hint">请先满足左侧阶段任务清单中的条件</span>') +
      (t.status === 'submitted' ? ' <button class="btn btn-success btn-sm" onclick="arApprove()">审核通过</button> <button class="btn btn-warning btn-sm" onclick="arReturn()">退回修改</button>' : '') +
      '</div></div></div>';

    return submitPanel + '<div class="panel" style="margin-bottom:16px"><div class="panel-header">审核意见单' +
      '<span class="ph-sub">' + r.rounds.length + ' 轮审核 · ' + r.pending + ' 条待回复</span></div>' +
      '<div class="panel-body">' + roundsHtml + '</div></div>' +
      stageChecklist([
        { ok: r.rounds.length > 0, title: '提交省级审核', desc: r.rounds.length ? '已提交 ' + r.rounds.length + ' 轮' : '尚未提交' },
        { ok: r.pending === 0 && r.rounds.length > 0, title: '审核意见逐条回复', desc: r.pending ? r.pending + ' 条待回复' : '全部意见已回复' },
        { ok: r.passed, title: '取得审核通过结论', desc: r.passed ? '最近一轮审核结论为通过' : '尚未通过' }
      ]) + (t.corrections && t.corrections.length ? '<div class="panel" style="margin-bottom:16px"><div class="panel-header">修订记录</div>' +
        '<div class="panel-body" style="padding-top:8px"><table class="data-table" style="width:100%;min-width:0"><thead><tr><th class="code" style="width:90px">版本</th><th class="code" style="width:150px">时间</th><th class="code" style="width:170px">操作人</th><th class="txt">说明</th></tr></thead><tbody>' +
        t.corrections.map(function (c) {
          return '<tr><td class="code">' + e(c.ver) + '</td><td class="code" style="font-size:12px;color:#64748b">' + e(c.at) + '</td>' +
            '<td class="code" style="font-size:12px;color:#64748b">' + e(c.by) + '</td><td class="txt" style="font-size:12.5px">' + e(c.note) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' : '') + stageLogPanel(t, 'review');
  }

  /* ---------- 阶段 7：发布归档 ---------- */
  function wsRelease(t) {
    var rel = AR().summaries.release(t);
    var r = t.release || {};
    var gate = AR().evalGate('release', t, ARH);

    var approvePanel = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">① 发布审批' +
      (rel.approved ? '<span class="ph-sub">已批准 · ' + e(r.approvedAt) + '</span>' : '<span class="ph-sub">待审批</span>') + '</div>' +
      '<div class="panel-body">' +
      (rel.approved
        ? '<div class="ar-ctx-line"><span>批准人 <b>' + e(r.approvedBy || '—') + '</b></span><span>批准时间 <b>' + e(r.approvedAt) + '</b></span></div>'
        : '<div class="ar-empty-inline">年报发布需经省卫健委主管部门审批。<button class="btn btn-primary btn-sm" onclick="arApproveRelease()">提交发布审批</button></div>') +
      '</div></div>';

    var pkgPanel = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">② 上报数据包' +
      (rel.packageBuilt ? '<span class="ph-sub">已生成 · ' + e(r.packageBuiltAt) + '</span>' : '<span class="ph-sub">未生成</span>') + '</div>' +
      '<div class="panel-body">' +
      (rel.packageBuilt
        ? '<div class="ar-ctx-line"><span>数据包 <b>' + e(r.packageName || '—') + '</b></span><span>去向 <b>国家平台（NCCR）</b></span>' +
          '<span>包含 <b>' + ((r.files || []).join(' + ') || '—') + '</b></span></div>' +
          '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn-outline btn-sm" onclick="arRebuildPackage()">重新生成并下载</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="arPreviewReportDoc()">预览正文</button></div>' +
          '<div class="ar-hint" style="margin-top:10px">生成时会触发浏览器下载：正文（HTML，可直接用 Word 打开）、统计附表（CSV）' +
          (t.exportCfg && t.exportCfg.ci5 ? '、CI5/IARC 适配数据（CSV）' : '') + '。</div>'
        : '<div class="ar-empty-inline">数据包将按发布审批后的定稿生成，含正文、统计附表与 CI5/IARC 适配数据。' +
          '<button class="btn btn-primary btn-sm" onclick="arBuildPackage()">生成上报数据包</button></div>') +
      '</div></div>';

    var receiptPanel = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">③ 国家平台回执' +
      (rel.receiptNo ? '<span class="ph-sub">已回执 · ' + e(r.receiptAt) + '</span>' : '<span class="ph-sub">待回执</span>') + '</div>' +
      '<div class="panel-body">' +
      (rel.receiptNo
        ? '<div class="ar-ctx-line"><span>回执号 <b>' + e(rel.receiptNo) + '</b></span><span>回执时间 <b>' + e(rel.receiptAt) + '</b></span></div>'
        : '<div class="ar-empty-inline">按流程，取得国家平台回执后方可归档；无回执不得归档。<button class="btn btn-outline btn-sm" onclick="arEnterReceipt()">登记回执</button></div>') +
      '</div></div>';

    var archivePanel = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">④ 归档入库' +
      (rel.archivedAt ? '<span class="ph-sub">已归档 · ' + e(rel.archivedAt) + '</span>' : '<span class="ph-sub">未归档</span>') + '</div>' +
      '<div class="panel-body">' +
      (rel.archivedAt
        ? '<div class="ar-ctx-line"><span>归档时间 <b>' + e(rel.archivedAt) + '</b></span><span>定稿版本 <b>' + e(t.version) + '</b></span></div>' +
          '<div class="ar-hint" style="margin-top:10px">归档后定稿只读，可在「归档记录」中预览与下载。</div>'
        : '<div class="ar-empty-inline">' + (gate.ok ? '前置条件已齐备，可执行归档。' : '尚不满足归档条件。') +
          '<button class="btn btn-primary btn-sm"' + (gate.ok ? '' : ' disabled') + ' onclick="arArchive()">归档入库</button></div>') +
      '</div></div>';

    // 导出配置与上报记录
    var exportPanel = sectionExport(t);

    return approvePanel + pkgPanel + receiptPanel + archivePanel +
      stageChecklist([
        { ok: rel.approved, title: '完成发布审批', desc: '省卫健委主管部门批准发布' },
        { ok: rel.packageBuilt, title: '生成上报数据包', desc: 'PDF 正文 + CI5/IARC 适配数据' },
        { ok: !!rel.receiptNo, title: '取得国家平台回执', desc: rel.receiptNo ? '回执号 ' + rel.receiptNo : '无回执不得归档' },
        { ok: !!rel.archivedAt, title: '归档入库', desc: rel.archivedAt ? '定稿已归档，只读留痕' : '待归档' }
      ]) + '<div class="panel" style="margin-bottom:16px"><div class="panel-header">导出与上报配置</div><div class="panel-body">' + exportPanel + '</div></div>' +
      stageLogPanel(t, 'release');
  }

  /* ---------- 章节内容块引擎 ---------- */
  function arVars(t) {
    var r = AGG_RESULT;
    var incRanked = SITES.slice().sort(function (a, b) { return b.inc - a.inc; });
    var deathRanked = SITES.slice().sort(function (a, b) { return b.death - a.death; });
    var totalDeath = SITES.reduce(function (s, x) { return s + x.death; }, 0);
    var first = TREND[0], last = TREND[TREND.length - 1];
    var yrs = Math.max(1, last.year - first.year);
    return {
      "年度": t ? String(t.year) : "",
      "覆盖人口万": (r.pop / 10000).toFixed(1),
      "登记处数": String(r.registries),
      "数据源数": String(r.sources),
      "报告卡数": fmt(r.cards),
      "剔重数": fmt(r.dup),
      "多原发数": fmt(r.multiPrimary),
      "有效病例": fmt(r.valid),
      "死亡病例": fmt(r.death),
      "粗发病率": (r.valid / r.pop * 100000).toFixed(1),
      "粗死亡率": (r.death / r.pop * 100000).toFixed(1),
      "MV": QC_PROV.mv + "%",
      "DCO": QC_PROV.dco + "%",
      "MI": String(QC_PROV.mi),
      "UB": QC_PROV.ub + "%",
      "首位癌种": incRanked[0].name,
      "首位癌种发病数": fmt(incRanked[0].inc),
      "前五发病占比": (incRanked.slice(0, 5).reduce(function (s, x) { return s + x.inc; }, 0) / r.valid * 100).toFixed(1) + "%",
      "首位死因癌种": deathRanked[0].name,
      "前五死亡占比": (deathRanked.slice(0, 5).reduce(function (s, x) { return s + x.death; }, 0) / totalDeath * 100).toFixed(1) + "%",
      "五年生存率": (SURVIVAL[0] ? SURVIVAL[0].rate : 40.5) + "%",
      "起始年度": String(first.year),
      "末年度": String(last.year),
      "起始发病数": fmt(first.inc),
      "末发病数": fmt(last.inc),
      "起始死亡数": fmt(first.death),
      "末死亡数": fmt(last.death),
      "年均增幅": ((Math.pow(last.inc / first.inc, 1 / yrs) - 1) * 100).toFixed(1) + "%"
    };
  }
  function fillVars(text, vars) {
    return String(text || '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (all, key) {
      var v = vars[key];
      return v == null ? all : v;
    });
  }
  function docTableRaw(head, rows, caption) {
    return '<table class="doc-tbl"><thead><tr>' + head.map(function (h) { return '<th>' + e(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table>' + (caption ? '<p class="doc-cap">' + e(caption) + '</p>' : '');
  }
  function figureBarsRaw(title, items, key, unit) {
    var max = 0; items.forEach(function (x) { if (x[key] > max) max = x[key]; });
    if (!max) max = 1;
    var bars = items.map(function (x) {
      return '<i style="height:' + Math.max(12, Math.round(x[key] / max * 100)) + '%"><b>' + e(x.name) + '</b></i>';
    }).join('');
    return '<div class="ar-figure"><div class="fig-t">' + e(title) + (unit ? '（' + unit + '）' : '') + '</div><div class="ar-fbar">' + bars + '</div></div>';
  }
  function indicatorRowsFor(names, vars) {
    var map = {
      '病例数': ['有效病例', vars['有效病例'] + ' 例'], '发病数': ['发病例数', vars['有效病例'] + ' 例'],
      '死亡数': ['死亡例数', vars['死亡病例'] + ' 例'], '粗率': ['粗发病率', vars['粗发病率'] + '/10 万'],
      '粗发病率': ['粗发病率', vars['粗发病率'] + '/10 万'], '粗死亡率': ['粗死亡率', vars['粗死亡率'] + '/10 万'],
      '中标率': ['中标发病率', (Number(vars['粗发病率']) * 0.691).toFixed(1) + '/10 万'],
      '中标发病率': ['中标发病率', (Number(vars['粗发病率']) * 0.691).toFixed(1) + '/10 万'],
      '中标死亡率': ['中标死亡率', (Number(vars['粗死亡率']) * 0.669).toFixed(1) + '/10 万'],
      '世标率': ['世标发病率', (Number(vars['粗发病率']) * 0.915).toFixed(1) + '/10 万'],
      '世标发病率': ['世标发病率', (Number(vars['粗发病率']) * 0.915).toFixed(1) + '/10 万'],
      '世标死亡率': ['世标死亡率', (Number(vars['粗死亡率']) * 0.921).toFixed(1) + '/10 万'],
      'MV%': ['MV%（形态学确诊）', vars['MV']], 'DCO%': ['DCO%（仅死亡证明）', vars['DCO']],
      'M/I': ['M/I（死亡发病比）', vars['MI']], 'UB%': ['UB%（部位不明）', vars['UB']],
      'O&U%': ['O&U%（其他及未指明）', QC_PROV.ou + '%'], '生存率': ['五年相对生存率', vars['五年生存率']]
    };
    var out = [];
    (names && names.length ? names : ['病例数', '粗发病率']).forEach(function (n) {
      var row = map[n];
      if (row) out.push([row[0], '<b>' + row[1] + '</b>']);
    });
    return out;
  }
  function presetTable(id, vars) {
    var r = AGG_RESULT;
    var cities = REGIONS.filter(function (x) { return x.level === 'city'; });
    var incRanked = SITES.slice().sort(function (a, b) { return b.inc - a.inc; });
    var deathRanked = SITES.slice().sort(function (a, b) { return b.death - a.death; });
    var totalDeath = SITES.reduce(function (s, x) { return s + x.death; }, 0);
    if (id === 'qc') return docTableRaw(['质控指标', '本省结果', '国家登记质量评价参考阈值', '判定'], [
      ['MV%（形态学确诊比例）', QC_PROV.mv + '%', QC_THRESH.mvMin + '% ~ ' + QC_THRESH.mvMax + '%', (QC_PROV.mv >= QC_THRESH.mvMin && QC_PROV.mv <= QC_THRESH.mvMax) ? '合格' : '未达标'],
      ['HV%（组织学证实比例）', QC_PROV.hv + '%', '≥ ' + QC_THRESH.hvMin + '%', QC_PROV.hv >= QC_THRESH.hvMin ? '合格' : '未达标'],
      ['DCO%（仅有死亡证明比例）', QC_PROV.dco + '%', '≤ ' + QC_THRESH.dco + '%', QC_PROV.dco <= QC_THRESH.dco ? '合格' : '未达标'],
      ['M/I（死亡发病比）', String(QC_PROV.mi), QC_THRESH.miLow + ' ~ ' + QC_THRESH.miHigh, (QC_PROV.mi >= QC_THRESH.miLow && QC_PROV.mi <= QC_THRESH.miHigh) ? '合格' : '未达标'],
      ['UB%（原发部位不明比例）', QC_PROV.ub + '%', '≤ ' + QC_THRESH.ub + '%', QC_PROV.ub <= QC_THRESH.ub ? '合格' : '未达标'],
      ['O&U%（其他及未指明部位比例）', QC_PROV.ou + '%', '≤ ' + QC_THRESH.ou + '%', QC_PROV.ou <= QC_THRESH.ou ? '合格' : '未达标'],
      ['年龄不明比例', QC_PROV.ageUnk + '%', '≤ ' + QC_THRESH.ageUnkMax + '%', QC_PROV.ageUnk <= QC_THRESH.ageUnkMax ? '合格' : '未达标'],
      ['性别不明比例', QC_PROV.sexUnk + '%', '≤ ' + QC_THRESH.sexUnkMax + '%', QC_PROV.sexUnk <= QC_THRESH.sexUnkMax ? '合格' : '未达标'],
      ['形态学不明/缺失比例', QC_PROV.morphUnk + '%', '≤ ' + QC_THRESH.morphUnkMax + '%', QC_PROV.morphUnk <= QC_THRESH.morphUnkMax ? '合格' : '未达标']
    ], '表　全省登记质量控制指标');
    if (id === 'site-inc') return docTableRaw(['顺位', '癌种', 'ICD-10', '发病数（例）', '占比'], incRanked.slice(0, 5).map(function (x, i) {
      return [String(i + 1), e(x.name), e(x.icd), fmt(x.inc), (x.inc / r.valid * 100).toFixed(1) + '%'];
    }), '表　发病顺位前五位癌种');
    if (id === 'site-death') return docTableRaw(['顺位', '癌种', 'ICD-10', '死亡数（例）', '占比'], deathRanked.slice(0, 5).map(function (x, i) {
      return [String(i + 1), e(x.name), e(x.icd), fmt(x.death), (x.death / totalDeath * 100).toFixed(1) + '%'];
    }), '表　死亡顺位前五位癌种');
    if (id === 'city-inc') return docTableRaw(['设区市', '覆盖人口（万）', '发病数（例）', '粗发病率（/10 万）'], cities.map(function (x) {
      return [e(x.name), (x.pop / 10000).toFixed(0), fmt(regionInc(x)), x.incRate.toFixed(1)];
    }), '表　全省各设区市发病统计表');
    if (id === 'city-death') return docTableRaw(['设区市', '覆盖人口（万）', '死亡数（例）', '粗死亡率（/10 万）'], cities.map(function (x) {
      return [e(x.name), (x.pop / 10000).toFixed(0), fmt(regionDeath(x)), x.deathRate.toFixed(1)];
    }), '表　全省各设区市死亡统计表');
    if (id === 'trend') return docTableRaw(['年度', '发病数（例）', '粗发病率', '死亡数（例）', '粗死亡率'], TREND.slice(-6).map(function (x) {
      return [String(x.year), fmt(x.inc), x.incRate.toFixed(1), fmt(x.death), x.deathRate.toFixed(1)];
    }), '表　近年发病与死亡趋势');
    if (id === 'survival') return docTableRaw(['癌种', '五年相对生存率'], SURVIVAL.slice(1).map(function (x) {
      return [e(x.site), x.rate.toFixed(1) + '%'];
    }), '表　主要癌种五年相对生存率');
    return docTableRaw(['指标', '数值', '指标', '数值'], [
      ['有效病例', '<b>' + vars['有效病例'] + '</b> 例', '粗发病率', '<b>' + vars['粗发病率'] + '</b>/10 万'],
      ['死亡病例', '<b>' + vars['死亡病例'] + '</b> 例', '粗死亡率', '<b>' + vars['粗死亡率'] + '</b>/10 万'],
      ['MV%', vars['MV'], 'DCO%', vars['DCO']],
      ['M/I', vars['MI'], 'UB%', vars['UB']]
    ], '表　核心指标一览');
  }
  function presetFigure(id) {
    var incRanked = SITES.slice().sort(function (a, b) { return b.inc - a.inc; });
    var deathRanked = SITES.slice().sort(function (a, b) { return b.death - a.death; });
    if (id === 'site-death') return figureBarsRaw('图　主要癌种死亡顺位', deathRanked.slice(0, 6), 'death', '例');
    if (id === 'trend-inc') return figureBarsRaw('图　发病数变化趋势', TREND.slice(-8).map(function (x) { return { name: String(x.year), inc: x.inc }; }), 'inc', '例');
    if (id === 'trend-death') return figureBarsRaw('图　死亡数变化趋势', TREND.slice(-8).map(function (x) { return { name: String(x.year), death: x.death }; }), 'death', '例');
    if (id === 'survival') return figureBarsRaw('图　主要癌种五年相对生存率', SURVIVAL.slice(1, 7).map(function (x) { return { name: x.site, rate: x.rate }; }), 'rate', '%');
    if (id === 'city-inc') return figureBarsRaw('图　设区市粗发病率对比', REGIONS.filter(function (x) { return x.level === 'city'; }).slice(0, 6).map(function (x) { return { name: x.name, incRate: x.incRate }; }), 'incRate', '/10 万');
    return figureBarsRaw('图　主要癌种发病顺位', incRanked.slice(0, 6), 'inc', '例');
  }
  function renderBlock(b, vars) {
    if (!b) return '';
    if (b.type === 'list') {
      var items = String(b.text || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(function (x) { return x; });
      if (!items.length) return '';
      return '<ul>' + items.map(function (x) { return '<li>' + e(fillVars(x, vars)) + '</li>'; }).join('') + '</ul>';
    }
    if (b.type === 'indicator') {
      var rows = indicatorRowsFor(b.indicators, vars);
      if (!rows.length) return '';
      return docTableRaw(['指标', '数值'], rows, b.caption || '表　核心指标');
    }
    if (b.type === 'table') return presetTable(b.preset || 'core', vars);
    if (b.type === 'figure') return presetFigure(b.preset || 'site-inc');
    var txt = fillVars(b.text || '', vars);
    if (!txt.trim()) return '';
    return txt.split(/\r?\n\s*\r?\n/).map(function (para) {
      return '<p>' + e(para.trim()) + '</p>';
    }).join('');
  }
  function defaultBlocksFor(chId, secIndex, secTitle) {
    function txt(s) { return [{ type: 'text', text: s }]; }
    var K = chId + ':' + secIndex;
    var map = {
      'ch1:0': txt('本报告依据《中国肿瘤登记工作指导手册》及国家癌症中心年报编制规范编制，数据取自江西省肿瘤登记信息系统 {{年度}} 年度登记资料，覆盖全省 11 个设区市，登记覆盖人口 {{覆盖人口万}} 万。'),
      'ch1:1': [{ type: 'text', text: '{{年度}} 年全省核心负担指标汇总如下。' }, { type: 'table', preset: 'core' }],
      'ch1:2': [{ type: 'list', text: '全年新发恶性肿瘤 {{有效病例}} 例，粗发病率 {{粗发病率}}/10 万\n恶性肿瘤死亡 {{死亡病例}} 例，粗死亡率 {{粗死亡率}}/10 万\n发病首位为{{首位癌种}}，前五位癌种合计占 {{前五发病占比}}\n质控指标 MV% {{MV}}、DCO% {{DCO}}、M/I {{MI}}，均达到国家考核要求' }],
      'ch2:0': txt('{{年度}} 年全省肿瘤登记覆盖 11 个设区市共 {{登记处数}} 个登记处，覆盖人口 {{覆盖人口万}} 万，实现全省常住人口全覆盖。'),
      'ch2:1': txt('数据来源于恶性肿瘤登记信息系统、死因登记数据库、随访数据库与人口数据库共 {{数据源数}} 类数据源，按统一编码标准（ICD-10 / ICD-O-3）归一化处理。'),
      'ch2:2': txt('本年度共接收上报报告卡 {{报告卡数}} 张，经查重剔除重复卡 {{剔重数}} 张，识别多原发 {{多原发数}} 例，最终纳入统计的有效病例 {{有效病例}} 例。'),
      'ch2:3': [{ type: 'text', text: '全省登记质量控制指标与国家登记质量评价参考阈值比对结果如下。' }, { type: 'table', preset: 'qc' }],
      'ch3:0': [{ type: 'text', text: '{{年度}} 年全省新发恶性肿瘤 {{有效病例}} 例，粗发病率 {{粗发病率}}/10 万。按中国 2000 年标准人口与 Segi 世界标准人口分别计算标化率，用于跨地区与国际比较。' }, { type: 'indicator', indicators: ['病例数', '粗发病率', '中标发病率', '世标发病率'] }],
      'ch3:1': txt('发病随年龄增长呈上升趋势，高峰集中在 60-74 岁年龄组；男性发病水平总体高于女性。'),
      'ch3:2': [{ type: 'figure', preset: 'site-inc' }, { type: 'table', preset: 'site-inc' }, { type: 'text', text: '{{首位癌种}}居发病首位（{{首位癌种发病数}} 例），前五位癌种合计占全部发病的 {{前五发病占比}}。' }],
      'ch3:3': [{ type: 'table', preset: 'city-inc' }],
      'ch4:0': [{ type: 'text', text: '{{年度}} 年全省恶性肿瘤死亡 {{死亡病例}} 例，粗死亡率 {{粗死亡率}}/10 万，恶性肿瘤仍是全省居民主要死因之一。' }, { type: 'indicator', indicators: ['死亡数', '粗死亡率', '中标死亡率', '世标死亡率'] }],
      'ch4:1': txt('死亡率随年龄增长显著上升，65 岁以上人群死亡负担最重；男性死亡水平高于女性。'),
      'ch4:2': [{ type: 'figure', preset: 'site-death' }, { type: 'table', preset: 'site-death' }, { type: 'text', text: '{{首位死因癌种}}居死亡首位，前五位癌种合计占全部死亡的 {{前五死亡占比}}。' }],
      'ch4:3': [{ type: 'table', preset: 'city-death' }],
      'ch5:0': txt('生存分析基于全省肿瘤登记随访队列，采用相对生存率法计算五年相对生存率，随访截止时点与登记年度一致。'),
      'ch5:1': txt('全省恶性肿瘤五年相对生存率为 {{五年生存率}}，与全国平均水平基本相当。'),
      'ch5:2': [{ type: 'figure', preset: 'survival' }, { type: 'table', preset: 'survival' }, { type: 'text', text: '甲状腺癌、乳腺癌生存率较高，肝癌、肺癌、食管癌生存率偏低，提示需加强早诊早治。' }],
      'ch6:0': [{ type: 'text', text: '{{起始年度}}-{{末年度}} 年，全省发病数由 {{起始发病数}} 例增至 {{末发病数}} 例，年均增长约 {{年均增幅}}。' }, { type: 'figure', preset: 'trend-inc' }],
      'ch6:1': [{ type: 'text', text: '同期死亡数由 {{起始死亡数}} 例增至 {{末死亡数}} 例。' }, { type: 'figure', preset: 'trend-death' }, { type: 'table', preset: 'trend' }],
      'ch6:2': txt('发病与死亡的上升主要与人口老龄化、登记完整性提升及诊断能力提高有关，标化率增幅明显低于粗率增幅。'),
      'ch7:0': [{ type: 'list', text: '部分县区 MV% 偏低，病理诊断能力有待加强\n随访完整度地区间差异较大\n肝癌、肺癌等癌种生存率仍偏低' }],
      'ch7:1': [{ type: 'list', text: '持续推进肺癌、结直肠癌、乳腺癌、宫颈癌、肝癌重点癌种早筛\n加强 ICD-O-3 编码与病理报告规范培训\n完善主动随访机制，提升生存分析数据质量' }],
      'ch7:2': txt('推动县区级登记处数据质量均衡化，完善省市县三级质控闭环，按国家要求按期完成年报编制与上报。'),
      'ch8:0': [{ type: 'table', preset: 'city-inc' }],
      'ch8:1': [{ type: 'table', preset: 'city-death' }],
      'ch8:2': [{ type: 'table', preset: 'qc' }]
    };
    if (map[K]) return cloneTemplateValue({ v: map[K] }).v;
    return txt('（' + (secTitle || '本节') + '正文待编制，可在章节模板中配置内容块。）');
  }
  function normalizeSections(ct) {
    var raw = ct.sections;
    if (!raw || !raw.length) raw = ['正文'];
    var changed = false;
    var out = raw.map(function (s, i) {
      if (typeof s === 'string') { changed = true; return { id: 'sec' + (i + 1), title: s, blocks: defaultBlocksFor(ct.id, i, s) }; }
      var sec = { id: s.id || ('sec' + (i + 1)), title: s.title || ('小节 ' + (i + 1)), blocks: (s.blocks && s.blocks.length) ? s.blocks : defaultBlocksFor(ct.id, i, s.title) };
      if (!s.blocks || !s.blocks.length) changed = true;
      return sec;
    });
    if (changed) ct.sections = out;
    else ct.sections = out;
    return ct.sections;
  }
  function sectionTitles(ct) { return normalizeSections(ct).map(function (s) { return s.title; }); }

  /* ===================== 12. 模板管理与章节模板 ===================== */
  function defaultChapterTemplate(id) {
    var m = CHAPTER_META.filter(function (c) { return c.id === id; })[0] || { title: id, desc: '' };
    return { id: id, title: m.title, desc: m.desc, enabled: true, sections: (m.sections || ['正文']).slice(), intro: DEFAULT_CHAPTER_BODY[id] || '', dataSource: '年报汇总数据集', indicators: id === 'ch1' ? ['发病数','死亡数','粗发病率','中标发病率','世标发病率'] : id === 'ch2' ? ['MV%','DCO%','M/I','UB%','O&U%'] : ['病例数','粗率','中标率','世标率'], charts: id === 'ch3' || id === 'ch4' ? ['癌种顺位','年龄别分布','地区分布'] : id === 'ch6' ? ['时间趋势'] : id === 'ch5' ? ['生存率对比'] : [], tables: id === 'ch8' ? ['发病统计表','死亡统计表','质控统计表'] : ['核心指标表'], rules: { showTitle: true, showSource: true, allowManualEdit: true, requireData: true } };
  }
  function chapterTemplate(tp, id) {
    if (!tp) return defaultChapterTemplate(id);
    tp.chapterTemplates = tp.chapterTemplates || {};
    if (!tp.chapterTemplates[id]) tp.chapterTemplates[id] = defaultChapterTemplate(id);
    var ct = tp.chapterTemplates[id];
    if (!ct.id) ct.id = id;
    normalizeSections(ct);
    return ct;
  }
  function chapterIdsForTemplate(tp) { return templateChapterConfigs(tp).sort(function (a,b) { return a.order - b.order; }).map(function (c) { return c.id; }); }
  function renderChapterTemplates() {
    var tp = tplById(arState.tplEditingId);
    if (!tp) return renderTemplates();
    var ids = chapterIdsForTemplate(tp);
    var rows = ids.map(function (id, index) {
      var c = chapterTemplate(tp, id);
      var secs = normalizeSections(c);
      var blkTotal = secs.reduce(function (n, s) { return n + (s.blocks || []).length; }, 0);
      return '<tr><td class="num">' + (index + 1) + '</td><td class="txt"><b>' + e(c.title) + '</b><div class="ar-hint">' + e(c.desc) + '</div><div class="ar-hint" style="margin-top:3px;color:#94a3b8">' + secs.length + ' 节 / ' + blkTotal + ' 内容块：' + e(secs.map(function (s) { return s.title; }).join(' · ')) + '</div></td><td>' + c.indicators.length + ' 个指标</td><td>' + c.charts.length + ' 个图表</td><td>' + c.tables.length + ' 张表</td><td>' + (c.rules.allowManualEdit ? badge('success','可人工编辑') : badge('neutral','只读')) + '</td><td class="ops"><button class="btn btn-outline btn-xs" onclick="arEditChapterTemplate(\'' + id + '\')">编辑小节与内容</button></td></tr>';
    }).join('');
    return pageToolbar('章节模板管理 · ' + e(tp.name)) + '<div class="panel"><div class="panel-header">章节模板目录 <div class="toolbar-actions"><button class="btn btn-ghost btn-sm" onclick="arTplList()">返回模板列表</button></div></div><div class="panel-body"><div class="ar-hint" style="margin-bottom:12px">三层结构：章节目录决定“有没有这一章” → 章节模板决定“这一章分几节” → 小节内容块决定“每节写什么”（段落 / 要点列表 / 指标表 / 统计表 / 图表）。点「章节模板」进入后可逐节逐块定义并即时预览。</div><div class="table-wrap"><table class="data-table" style="width:100%;min-width:900px"><thead><tr><th class="num">顺序</th><th class="txt">章节/说明/小节结构</th><th class="txt">指标</th><th class="num">图表</th><th class="num">统计表</th><th class="txt">编辑规则</th><th class="ops">操作</th></tr></thead><tbody>' + rows + '</tbody></table></div></div></div>';
  }
  function renderChapterTemplateForm() {
    var tp = tplById(arState.tplEditingId), c = chapterTemplate(tp, arState.editChapter);
    var secs = normalizeSections(c);
    var multi = function (label, key, options) { return '<div class="form-group full"><label>' + label + '</label><div style="display:flex;flex-wrap:wrap;gap:8px">' + options.map(function (x) { var on = c[key].indexOf(x) >= 0; return '<label class="ar-check' + (on ? ' on' : '') + '" style="padding:6px 10px;font-size:12px"><input type="checkbox" data-ct-' + key + '="1" value="' + e(x) + '" ' + (on ? 'checked' : '') + '><span>' + e(x) + '</span></label>'; }).join('') + '</div></div>'; };
    var allIndicators = ['病例数','死亡数','粗率','粗发病率','粗死亡率','中标率','中标发病率','中标死亡率','世标率','世标发病率','世标死亡率','MV%','DCO%','M/I','UB%','O&U%','生存率'];
    var allCharts = ['年龄别分布','年龄-性别金字塔','癌种顺位','地区分布','时间趋势','生存率对比','质控仪表盘'];
    var allTables = ['核心指标表','发病统计表','死亡统计表','质控统计表','年龄别统计表','地区统计表','生存统计表'];

    var secRows = secs.map(function (s, i) {
      var summary = (s.blocks || []).map(function (b, bi) {
        var bt = BLOCK_TYPES.filter(function (x) { return x.id === b.type; })[0] || { label: b.type };
        var detail = bt.label;
        if (b.type === 'table') { var tt = TABLE_PRESETS.filter(function (x) { return x.id === b.preset; })[0]; if (tt) detail += '：' + tt.label; }
        if (b.type === 'figure') { var ff = FIGURE_PRESETS.filter(function (x) { return x.id === b.preset; })[0]; if (ff) detail += '：' + ff.label; }
        if (b.type === 'indicator') detail += '：' + ((b.indicators || []).length) + ' 项';
        if (b.type === 'list') detail += '：' + String(b.text || '').split(/\r?\n/).filter(function (x) { return x.trim(); }).length + ' 条';
        if (b.type === 'text') detail += '：' + String(b.text || '').replace(/\s+/g, '').length + ' 字';
        return '<span style="display:inline-block;font-size:11.5px;color:#475569;background:#f1f5f9;border:1px solid var(--border);border-radius:4px;padding:2px 7px;margin:2px 4px 2px 0">' + (bi + 1) + '. ' + e(detail) + '</span>';
      }).join('') || '<span class="ar-hint">尚无内容块</span>';
      return '<tr><td style="width:52px">' + CN_NO[i] + '</td>' +
        '<td><input data-sec-title="' + e(s.id) + '" value="' + e(s.title) + '" style="width:100%"></td>' +
        '<td>' + summary + '</td>' +
        '<td style="white-space:nowrap">' +
        '<button class="btn btn-outline btn-xs" onclick="arEditSection(\'' + s.id + '\')">编辑本节内容</button> ' +
        (i > 0 ? '<button class="btn btn-ghost btn-xs" onclick="arMoveSection(\'' + s.id + '\',-1)">上移</button> ' : '') +
        (i < secs.length - 1 ? '<button class="btn btn-ghost btn-xs" onclick="arMoveSection(\'' + s.id + '\',1)">下移</button> ' : '') +
        (secs.length > 1 ? '<button class="btn btn-ghost btn-xs" onclick="arDelSection(\'' + s.id + '\')">删除</button>' : '') +
        '</td></tr>';
    }).join('');

    var secPanel = '<div class="panel" style="margin-bottom:16px"><div class="panel-header">章节小节与内容结构（共 ' + secs.length + ' 节）' +
      '<div class="toolbar-actions"><button class="btn btn-outline btn-sm" onclick="arAddSection()">新增小节</button></div></div>' +
      '<div class="panel-body"><div class="ar-hint" style="margin-bottom:10px">小节决定正文的二级标题顺序；每个小节由若干「内容块」组成（段落 / 列表 / 指标表 / 统计表 / 图表），点击「编辑本节内容」逐块定义。修改小节标题后请点下方「保存章节模板」。</div>' +
      '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:820px"><thead><tr><th class="num">序号</th><th class="txt">小节标题</th><th class="txt">内容块构成</th><th class="ops">操作</th></tr></thead><tbody>' + secRows + '</tbody></table></div></div></div>';

    return pageToolbar('编辑章节模板 · ' + e(tp.name)) +
      '<div class="panel" style="margin-bottom:16px"><div class="panel-header">章节基本信息</div><div class="panel-body"><div class="form-grid">' +
      '<div class="form-group"><label>章节标题 *</label><input id="ctTitle" value="' + e(c.title) + '"></div>' +
      '<div class="form-group"><label>数据来源</label><input id="ctSource" value="' + e(c.dataSource) + '"></div>' +
      '<div class="form-group full"><label>目录说明</label><input id="ctDesc" value="' + e(c.desc) + '"></div>' +
      multi('绑定指标','indicators',allIndicators) + multi('绑定图表','charts',allCharts) + multi('绑定统计表','tables',allTables) +
      '<div class="form-group full"><label>章节生成规则</label><div style="display:flex;flex-wrap:wrap;gap:8px">' +
      '<label class="ar-check' + (c.rules.showTitle ? ' on' : '') + '" style="padding:6px 10px;font-size:12px"><input id="ctTitleRule" type="checkbox" ' + (c.rules.showTitle ? 'checked' : '') + '><span>显示章节标题</span></label>' +
      '<label class="ar-check' + (c.rules.showSource ? ' on' : '') + '" style="padding:6px 10px;font-size:12px"><input id="ctSourceRule" type="checkbox" ' + (c.rules.showSource ? 'checked' : '') + '><span>显示数据来源</span></label>' +
      '<label class="ar-check' + (c.rules.allowManualEdit ? ' on' : '') + '" style="padding:6px 10px;font-size:12px"><input id="ctEditRule" type="checkbox" ' + (c.rules.allowManualEdit ? 'checked' : '') + '><span>允许人工编辑</span></label>' +
      '<label class="ar-check' + (c.rules.requireData ? ' on' : '') + '" style="padding:6px 10px;font-size:12px"><input id="ctDataRule" type="checkbox" ' + (c.rules.requireData ? 'checked' : '') + '><span>无数据时阻止生成</span></label>' +
      '</div></div></div>' +
      '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="arSaveChapterTemplate()">保存章节模板</button><button class="btn btn-outline" onclick="arPreviewChapterTpl()">预览本章效果</button><button class="btn btn-ghost" onclick="arChapterTemplateList()">返回章节目录</button></div>' +
      '</div></div>' + secPanel +
      (arState.tplPreview ? '<div class="panel" style="margin-bottom:16px;border-color:var(--primary)"><div class="panel-header">章节预览（按当前内容块渲染）<div class="toolbar-actions"><button class="btn btn-ghost btn-sm" onclick="arClosePreviewChapterTpl()">关闭</button></div></div><div class="panel-body" style="background:#eef1f5"><div class="ar-doc-scroll" style="max-height:520px"><div class="ar-page">' + arState.tplPreview + '</div></div></div></div>' : '');
  }

  function blockEditorHtml(b, i, total) {
    var typeSel = '<select data-blk-type="' + i + '" onchange="arSetBlockType(' + i + ',this.value)">' +
      BLOCK_TYPES.map(function (bt) { return '<option value="' + bt.id + '"' + (b.type === bt.id ? ' selected' : '') + '>' + bt.label + '</option>'; }).join('') + '</select>';
    var hint = (BLOCK_TYPES.filter(function (bt) { return bt.id === b.type; })[0] || {}).hint || '';
    var body = '';
    if (b.type === 'text') {
      body = '<textarea data-blk-text="' + i + '" class="ar-editor" style="min-height:96px">' + e(b.text || '') + '</textarea>' +
        '<div class="ar-hint" style="margin-top:6px">可用变量：' + VAR_KEYS.map(function (k) { return '<code style="background:#f1f5f9;padding:1px 5px;border-radius:3px;margin-right:4px;cursor:pointer" onclick="arInsertVar(' + i + ',\'' + k + '\')">{{' + k + '}}</code>'; }).join('') + '</div>';
    } else if (b.type === 'list') {
      body = '<textarea data-blk-text="' + i + '" class="ar-editor" style="min-height:84px" placeholder="每行一条要点">' + e(b.text || '') + '</textarea>' +
        '<div class="ar-hint" style="margin-top:6px">每行输出一个项目符号条目，同样支持 {{变量}}。</div>';
    } else if (b.type === 'indicator') {
      var allInd = ['病例数','死亡数','粗发病率','粗死亡率','中标发病率','中标死亡率','世标发病率','世标死亡率','MV%','DCO%','M/I','UB%','O&U%','生存率'];
      body = '<div style="display:flex;flex-wrap:wrap;gap:8px">' + allInd.map(function (x) {
        var on = (b.indicators || []).indexOf(x) >= 0;
        return '<label class="ar-check' + (on ? ' on' : '') + '" style="padding:6px 10px;font-size:12px"><input type="checkbox" data-blk-ind="' + i + '" value="' + e(x) + '" ' + (on ? 'checked' : '') + '><span>' + e(x) + '</span></label>';
      }).join('') + '</div>';
    } else if (b.type === 'table') {
      body = '<select data-blk-preset="' + i + '">' + TABLE_PRESETS.map(function (tt) { return '<option value="' + tt.id + '"' + (b.preset === tt.id ? ' selected' : '') + '>' + tt.label + '</option>'; }).join('') + '</select>';
    } else {
      body = '<select data-blk-preset="' + i + '">' + FIGURE_PRESETS.map(function (ff) { return '<option value="' + ff.id + '"' + (b.preset === ff.id ? ' selected' : '') + '>' + ff.label + '</option>'; }).join('') + '</select>';
    }
    return '<div class="ar-blk" data-blk="' + i + '">' +
      '<div class="ar-blk-head"><span class="ar-blk-no">块 ' + (i + 1) + '</span>' + typeSel +
      '<span class="ar-hint" style="flex:1">' + e(hint) + '</span>' +
      (i > 0 ? '<button class="btn btn-ghost btn-xs" onclick="arMoveBlock(' + i + ',-1)">上移</button>' : '') +
      (i < total - 1 ? '<button class="btn btn-ghost btn-xs" onclick="arMoveBlock(' + i + ',1)">下移</button>' : '') +
      '<button class="btn btn-ghost btn-xs" onclick="arDelBlock(' + i + ')">删除</button></div>' +
      '<div class="ar-blk-body">' + body + '</div></div>';
  }

  function renderSectionForm() {
    var tp = tplById(arState.tplEditingId);
    if (!tp) return renderTemplates();
    var c = chapterTemplate(tp, arState.editChapter);
    var secs = normalizeSections(c);
    var sec = secs.filter(function (x) { return x.id === arState.editSectionId; })[0];
    if (!sec) { arState.tplView = 'chapter-form'; return renderChapterTemplateForm(); }
    var idx = secs.indexOf(sec);
    var blocks = sec.blocks || [];
    var vars = arVars(curTask());
    var previewHtml = '<h4 class="doc-sec">' + CN_NO[idx] + '、' + e(sec.title) + '</h4>' +
      (blocks.map(function (b) { return renderBlock(b, vars); }).join('') || '<p>（本节暂无内容块）</p>');

    return pageToolbar('编辑小节内容 · ' + e(c.title) + ' / ' + e(sec.title)) +
      '<div class="panel" style="margin-bottom:16px"><div class="panel-body">' +
      '<div class="ar-hint" style="margin-bottom:12px">本节属于「' + e(tp.name) + ' · ' + e(c.title) + '」，共 ' + blocks.length + ' 个内容块，按顺序渲染为正文。段落与列表支持 {{变量}}，保存后会升级模板版本。</div>' +
      '<div class="form-grid" style="margin-bottom:12px"><div class="form-group"><label>小节标题 *</label><input id="secTitle" value="' + e(sec.title) + '"></div></div>' +
      '<div class="panel-header" style="padding:0 0 10px">内容块' +
      '<div class="toolbar-actions">' + BLOCK_TYPES.map(function (bt) {
        return '<button class="btn btn-outline btn-xs" onclick="arAddBlock(\'' + bt.id + '\')">+ ' + bt.label + '</button>';
      }).join(' ') + '</div></div>' +
      '<div id="arBlockList">' + (blocks.length ? blocks.map(function (b, i) { return blockEditorHtml(b, i, blocks.length); }).join('') : '<div class="ar-hint" style="padding:18px;text-align:center">尚无内容块，请用上方按钮添加</div>') + '</div>' +
      '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="arSaveSection()">保存本节</button><button class="btn btn-ghost" onclick="arBackToChapterForm()">返回章节模板</button></div>' +
      '</div></div>' +
      '<div class="panel"><div class="panel-header">本节效果预览</div><div class="panel-body" style="background:#eef1f5"><div class="ar-doc-scroll" style="max-height:460px"><div class="ar-page" style="min-height:auto">' + previewHtml + '</div></div></div></div>';
  }

  function renderTemplates() {
    if (arState.tplView === 'chapter-list') return renderChapterTemplates();
    if (arState.tplView === 'section-form') return renderSectionForm();
    if (arState.tplView === 'chapter-form') return renderChapterTemplateForm();
    if (arState.tplView === 'form') return renderTemplateForm();
    var rows = templates.map(function (tp) {
      var ops = '<button class="btn btn-outline btn-xs" onclick="arEditTemplate(\'' + tp.id + '\')">编辑</button> ' +
        '<button class="btn btn-ghost btn-xs" onclick="arDuplicateTemplate(\'' + tp.id + '\')">复制</button> ' +
        (tp.isDefault ? '' : '<button class="btn btn-ghost btn-xs" onclick="arSetDefaultTemplate(\'' + tp.id + '\')">设默认</button> ') +
        '<button class="btn btn-ghost btn-xs" onclick="arToggleTemplate(\'' + tp.id + '\')">' + (tp.enabled ? '停用' : '启用') + '</button> ' +
        '<button class="btn btn-outline btn-xs" onclick="arManageChapterTemplates(\'' + tp.id + '\')">章节模板</button> ' +
        (tp.isDefault ? '' : '<button class="btn btn-ghost btn-xs" onclick="arDeleteTemplate(\'' + tp.id + '\')">删除</button>');
      return '<tr><td class="txt" style="font-size:13px;color:#1f2937;font-weight:600">' + e(tp.name) + (tp.isDefault ? ' ' + badge('accent', '默认') : '') + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + tplTypeName(tp.type) + '</td>' +
        '<td class="txt" style="font-size:12px;color:#64748b">' + tp.cycle + ' / ' + tp.volume + '</td>' +
        '<td class="num" style="font-size:12px;color:#64748b">' + tp.chapters.length + ' 章</td>' +
        '<td class="code">' + (tp.enabled ? badge('success', '启用') : badge('neutral', '停用')) + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + tp.version + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + tp.updatedAt + ' · ' + e(tp.updatedBy) + '</td>' +
        '<td class="ops">' + ops + '</td></tr>';
    }).join('');
    return pageToolbar('模板管理') + '<div class="panel" style="margin-bottom:16px"><div class="panel-body">' +
      '<div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:14px">' +
      '<button class="btn btn-primary" onclick="arNewTemplate()">新增模板</button>' + '</div>' +
      '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:1080px"><colgroup><col><col style="width:96px"><col><col style="width:104px"><col style="width:96px"><col style="width:96px"><col style="width:170px"><col style="width:190px"></colgroup><thead><tr>' +
      '<th class="txt">模板名称</th><th class="code">类型</th><th class="txt">周期 / 范围</th><th class="num">章节数</th><th class="code">状态</th><th class="code">版本</th><th class="code">更新时间 / 人</th><th class="ops">操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div></div></div>';
  }

  function renderTemplateForm() {
    var tp = arState.tplEditingId ? tplById(arState.tplEditingId) : null;
    var chapterConfigs = templateChapterConfigs(tp);
    var chHtml = '<div class="form-group full"><label>章节目录配置</label><div class="ar-hint" style="margin-bottom:8px">维护章节顺序、启用状态、目录标题和章节说明；停用章节不会出现在编制工作台和导出报告中。</div>' +
      '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:820px"><thead><tr><th style="width:72px">顺序</th><th style="width:72px">启用</th><th class="code" style="width:180px">章节标题</th><th class="txt">目录说明</th></tr></thead><tbody>' +
      CHAPTER_META.map(function (base, index) {
        var c = chapterConfigs.filter(function (x) { return x.id === base.id; })[0] || { id: base.id, order: index + 1, enabled: false, title: base.title, desc: base.desc };
        return '<tr data-ch-row="' + c.id + '"><td><input data-ch-order type="number" min="1" value="' + c.order + '" style="width:58px"></td><td><input data-ch-enabled type="checkbox" style="width:16px;height:16px;accent-color:var(--primary)" ' + (c.enabled ? 'checked' : '') + '></td><td><input data-ch-title value="' + e(c.title) + '" style="width:160px"></td><td><input data-ch-desc value="' + e(c.desc) + '" style="width:100%"></td></tr>';
      }).join('') + '</tbody></table></div></div>';
    return pageToolbar(tp ? '编辑模板' : '新增模板') + '<div class="panel" style="margin-bottom:16px"><div class="panel-body">' +
      '<div class="form-grid">' +
      '<div class="form-group"><label>模板名称 *</label><input id="tplName" value="' + e(tp ? tp.name : '') + '"></div>' +
      '<div class="form-group"><label>模板类型</label><select id="tplType">' + TPL_TYPES.map(function (tt) { return '<option value="' + tt.id + '"' + ((tp ? tp.type : 'annual') === tt.id ? ' selected' : '') + '>' + tt.name + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label>编制周期</label><input id="tplCycle" value="' + e(tp ? tp.cycle : '年度') + '"></div>' +
      '<div class="form-group"><label>统计范围</label><input id="tplVolume" value="' + e(tp ? tp.volume : '') + '"></div>' +
      '<div class="form-group full"><label>模板说明</label><textarea id="tplDesc" style="min-height:72px;border:1px solid #d1d8e0;border-radius:6px;padding:10px;font-size:13px">' + e(tp ? tp.desc : '') + '</textarea></div>' +
      chHtml +
      '<div class="form-group"><label>状态</label><select id="tplEnabled"><option value="1"' + (tp ? (tp.enabled ? ' selected' : '') : ' selected') + '>启用</option><option value="0"' + (tp && !tp.enabled ? ' selected' : '') + '>停用</option></select></div>' +
      '<div class="form-group"><label>设为默认模板</label><label class="ar-check' + (tp && tp.isDefault ? ' on' : '') + '" style="height:36px;padding:0 12px"><input id="tplDefault" type="checkbox" ' + (tp && tp.isDefault ? 'checked' : '') + '><span>是</span></label></div>' +
      '</div>' +
      '<div style="margin-top:16px;display:flex;gap:8px"><button class="btn btn-primary" onclick="arSaveTemplate()">保存模板</button><button class="btn btn-ghost" onclick="arTplList()">返回列表</button></div>' +
      '</div></div>';
  }

/* ===================== 13. 上报记录 / 归档记录 ===================== */
  function subStatusBadge(status) {
    if (status === '已回执归档') return badge('success', status);
    if (status === '已投递' || status === '待回执') return badge('info', status);
    if (status.indexOf('退') >= 0 || status.indexOf('未过') >= 0) return badge('danger', status);
    return badge('warning', status);
  }
  function renderSubmissions() {
    var cnt = { total: submissions.length, wait: 0, sent: 0, done: 0, back: 0 };
    submissions.forEach(function (s) {
      if (s.status === '待投递') cnt.wait++;
      else if (s.status === '已投递' || s.status === '待回执') cnt.sent++;
      else if (s.status === '已回执归档') cnt.done++;
      else if (s.status.indexOf('退') >= 0 || s.status.indexOf('未过') >= 0) cnt.back++;
    });
    var statHtml = '<div class="ar-stat-row">' +
      '<div class="ar-stat primary"><div class="v">' + cnt.total + '</div><div class="l">上报记录总数</div></div>' +
      '<div class="ar-stat"><div class="v" style="color:#b54708">' + cnt.wait + '</div><div class="l">待投递</div></div>' +
      '<div class="ar-stat"><div class="v" style="color:#175cd3">' + cnt.sent + '</div><div class="l">已投递待回执</div></div>' +
      '<div class="ar-stat"><div class="v" style="color:#027a48">' + cnt.done + '</div><div class="l">已回执归档</div></div>' +
      '<div class="ar-stat"><div class="v" style="color:#b42318">' + cnt.back + '</div><div class="l">退回 / 未通过</div></div>' +
      '</div>';
    var rows = submissions.map(function (s) {
      var rejected = s.status.indexOf('退') >= 0 || s.status.indexOf('未过') >= 0;
      var canDeliver = s.status === '待投递' || rejected;
      var canReceipt = s.status === '已投递' || s.status === '待回执';
      var ops = opRow([
        opBtn({ label: '投递', cls: 'btn-primary', fn: 'arSubDeliver', arg: s.id, on: canDeliver, tip: canDeliver ? (rejected ? '该上报已被退回，点击重新投递' : '') : '仅待投递或退回未通过的记录可投递' }),
        opBtn({ label: '确认回执', cls: 'btn-success', fn: 'arSubConfirm', arg: s.id, on: canReceipt, tip: canReceipt ? '' : '仅已投递 / 待回执的记录可确认国家平台回执' }),
        opBtn({ label: '标记退回', cls: 'btn-warning', fn: 'arSubReject', arg: s.id, on: canReceipt, tip: canReceipt ? '' : '仅已投递 / 待回执的记录可标记退回' }),
        opBtn({ label: '详情', cls: 'btn-ghost', fn: 'arSubReceipt', arg: s.id })
      ]);
      return '<tr><td class="txt" style="font-size:12px;color:#334155">' + s.id + '</td>' +
        '<td class="num" style="font-size:12px;color:#64748b">' + s.year + '</td>' +
        '<td class="txt" style="font-size:13px;color:#1f2937">' + e(s.title) + '<span class="td-sub">来源任务 ' + e(s.taskId) + '</span></td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + e(s.channelLabel) + '</td>' +
        '<td class="num" style="font-size:12px;color:#64748b">' + (s.ci5 ? 'PDF + CI5/IARC' : s.format.toUpperCase()) + '</td>' +
        '<td class="code">' + subStatusBadge(s.status) + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + (s.receiptNo || '—') + '</td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + s.sentAt + '</td>' +
        '<td class="ops">' + ops + '</td></tr>';
    }).join('');
    return pageToolbar('上报记录') + statHtml + '<div class="panel" style="margin-bottom:16px"><div class="panel-body">' +
      '<div class="ar-ops-rule"><b>操作按上报状态开放：</b>' +
      '<span>待投递 / 退回未通过 → 投递</span><span class="sep">|</span>' +
      '<span>已投递 / 待回执 → 确认回执、标记退回</span><span class="sep">|</span>' +
      '<span>已回执归档 → 仅查看详情</span><span class="sep">|</span>' +
      '<span>灰色按钮为当前状态不可用，鼠标悬停可见原因</span></div>' +
      (rows ? '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:1220px"><colgroup><col><col style="width:120px"><col><col style="width:96px"><col><col style="width:96px"><col><col style="width:170px"><col style="width:268px"></colgroup><thead><tr><th class="txt">上报编号</th><th class="num">年度</th><th class="txt">年报/来源</th><th class="code">渠道</th><th class="code">数据包</th><th class="code">状态</th><th class="code">回执号</th><th class="code">上报时间</th><th class="ops">操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div style="text-align:center;color:#94a3b8;padding:30px;font-size:13px">暂无上报记录</div>') +
      '</div></div>';
  }

  function renderArchives() {
    var rows = archives.map(function (a) {
      return '<tr><td class="txt" style="font-size:13px;color:#1f2937">' + e(a.fileName) + '<span class="td-sub">来源任务 ' + e(a.taskId || '—') + '</span></td>' +
        '<td class="code" style="font-size:12px;color:#64748b">' + a.year + ' · ' + a.version + '</td>' +
        '<td class="num" style="font-size:12px;color:#64748b">' + a.pages + ' 页</td>' +
        '<td class="num" style="font-size:12px;color:#64748b">' + a.size + '</td>' +
        '<td class="code">' + badge('neutral', a.status) + '</td>' +
        '<td class="txt" style="font-size:12px;color:#64748b">' + a.archivedAt + ' · ' + a.archivedBy + '</td>' +
        '<td class="ops"><button class="btn btn-ghost btn-xs" onclick="arPreviewArchive(\'' + a.id + '\')">预览</button> <button class="btn btn-ghost btn-xs" onclick="arDownloadArchive(\'' + a.id + '\')">下载</button> <button class="btn btn-ghost btn-xs" onclick="arDeleteArchive(\'' + a.id + '\')">删除</button></td></tr>';
    }).join('');
    return pageToolbar('归档记录') + '<div class="panel" style="margin-bottom:16px"><div class="panel-body">' +
      (rows ? '<div class="table-wrap"><table class="data-table" style="width:100%;min-width:1080px"><colgroup><col><col style="width:130px"><col style="width:90px"><col style="width:96px"><col style="width:100px"><col style="width:230px"><col style="width:196px"></colgroup><thead><tr>' +
      '<th class="txt">文件名 / 来源任务</th><th class="code">年度 / 版本</th><th class="num">页数</th><th class="num">大小</th><th class="code">状态</th><th class="txt">归档时间 / 人</th><th class="ops">操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div style="text-align:center;color:#94a3b8;padding:44px;font-size:13px">暂无归档记录</div>') +
      '</div></div>';
  }

  /* ===================== 14. 动作 ===================== */
  function goPage(page) {
    arState.page = page;
    renderPage(page);
  }

  window.arGoPage = function (page) { goPage(page); };

  /* 旧 5 段分区跳转 → 映射到新阶段工作区，保持老代码里的 arGoSection('quality') 等调用仍可用 */
  var SECTION_TO_STAGE = { overview: 'data', quality: 'qc', metrics: 'stats', report: 'draft', export: 'release' };
  window.arGoSection = function (n) {
    var key = String(n);
    if (SECTION_TO_STAGE[key]) return window.arGoStage(SECTION_TO_STAGE[key]);
    var id = SECTIONS.map(function (s) { return s.id; }).indexOf(key) >= 0 ? key
      : (SECTIONS[parseInt(key, 10) - 1] || SECTIONS[0]).id;
    return window.arGoStage(SECTION_TO_STAGE[id] || id);
  };

  /* ---------- 阶段切换：越级须过闸门 ---------- */
  window.arGoStage = function (id) {
    var t = curTask(); if (!t) return;
    var stages = AR().list;
    var idx = AR().indexOf(id);
    if (idx < 0) { toast('阶段不存在：' + id, 'error'); return; }
    var curIdx = AR().indexOf(AR().currentStage(t, ARH));
    if (t.status === 'voided' && id !== 'task') { toast('该年报已作废，仅可查看建立任务阶段', 'warning'); return; }
    // 允许：回看已达阶段、当前阶段、以及下一阶段（若其准入通过）
    if (idx > curIdx + 1) {
      var missing = stages.slice(curIdx, idx).map(function (s) { return s.name; }).join(' → ');
      toast('不能跳级：需先完成 ' + missing, 'warning');
      return;
    }
    if (idx === curIdx + 1) {
      var gate = AR().evalGate(stages[curIdx].id, t, ARH);
      if (!gate.ok) {
        toast('「' + stages[curIdx].name + '」尚有 ' + gate.blockers.length + ' 项条件未满足，暂不可进入下一阶段', 'warning');
        return;
      }
    }
    arState.viewStage = id;
    renderPage('ar-workbench');
    scrollToSection(id);
  };

  /* ---------- 推进阶段：写留痕后进入下一阶段 ---------- */
  window.arAdvanceStage = function () {
    var t = curTask(); if (!t) return;
    var adv = AR().canAdvance(t, ARH);
    if (!adv.can) {
      var first = (adv.gate.blockers[0] || {}).text || adv.reason || '准入条件未满足';
      toast('无法推进：' + first, 'warning');
      return;
    }
    // adv.from = 当前工作位，adv.to = 新进入的阶段
    var fromStage = AR().byId(adv.from);
    AR().markStage(t, adv.to);
    AR().logStage(t, '阶段完成', adv.from, adv.to,
      (fromStage ? fromStage.artifacts.join('、') : '') + ' 齐备，进入「' + AR().byId(adv.to).name + '」',
      t.createdBy || '省级上报岗');
    // 阶段与业务状态联动：推进到「审核」即等同于提交审核
    if (adv.to === 'review' && t.status === 'draft') {
      t.status = 'submitted'; t.submittedAt = nowStr();
    }
    touch(t);
    arState.viewStage = adv.to;
    renderPage('ar-workbench');
    toast('已进入「' + AR().byId(adv.to).name + '」阶段');
  };

  /* ---------- 回退阶段：审核退回 / 数据变更等场景，保留留痕 ---------- */
  window.arReopenStage = function (id, reason) {
    var t = curTask(); if (!t) return;
    var stage = AR().byId(id); if (!stage) { toast('阶段不存在', 'error'); return; }
    var cur = AR().currentStage(t, ARH);
    if (AR().indexOf(id) >= AR().indexOf(cur)) { toast('只能回退到当前阶段之前的阶段', 'warning'); return; }
    AR().markStage(t, id);
    AR().logStage(t, '阶段回退', cur, id, reason || '回退至「' + stage.name + '」重新处理', t.createdBy || '省级上报岗');
    // 回退即作废该阶段及其后续产物，避免带着旧产物往前走
    if (AR().indexOf(id) <= AR().indexOf('data')) { t.agg = { done: false, result: null }; }
    if (AR().indexOf(id) <= AR().indexOf('qc')) { t.qc = Object.assign({}, t.qc, { done: false, issues: [], kpis: [] }); t.valid = { done: false, result: null }; }
    if (AR().indexOf(id) <= AR().indexOf('stats')) { t.stats = seedStats(false); }
    if (AR().indexOf(id) <= AR().indexOf('draft')) { t.chapters = {}; }
    if (AR().indexOf(id) <= AR().indexOf('review')) { t.review = { rounds: [] }; }
    if (t.status !== 'draft' && AR().indexOf(id) <= AR().indexOf('review')) { t.status = 'draft'; }
    touch(t);
    arState.viewStage = id;
    renderPage('ar-workbench');
    toast('已回退至「' + stage.name + '」阶段');
    return false;
  };
  function scrollToSection(id) {
    window.setTimeout(function () {
      var c = document.getElementById('pageContainer');
      if (c && c.scrollTo) { c.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      if (window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 30);
  }
  window.arToggleAdv = function () { arState.advOpen = !arState.advOpen; renderPage('ar-workbench'); };
  window.arSetChartTab = function (tab) { arState.chartTab = tab; renderPage(arState.page === 'ar-view' ? 'ar-view' : 'ar-workbench'); };

  window.arSetFilter = function (key, val) {
    if (key === 'year') arState.filters.year = val;
    else if (key === 'kw') arState.filters.keyword = val;
    else if (key === 'status') arState.filters.status = val;
    renderPage('ar-tasks');
  };
  window.arResetFilter = function () { arState.filters = { year: '', keyword: '', status: '' }; renderPage('ar-tasks'); };

  /* ---------- 新建年报：先弹窗确认编制口径，再进入工作台 ---------- */
  function newTaskYears() {
    var ys = [];
    tasks.forEach(function (t) { var y = parseInt(t.year, 10); if (!isNaN(y) && ys.indexOf(y) < 0) ys.push(y); });
    var top = ys.length ? Math.max.apply(null, ys) : (new Date().getFullYear() - 1);
    var out = [];
    for (var i = 0; i < 5; i++) out.push(String(top - i));
    return out;
  }
  window.arNewTask = function () {
    if (document.getElementById('arNewTaskModal')) return;
    var years = newTaskYears();
    var enabledTpls = templates.filter(function (tp) { return tp.enabled; });
    if (!enabledTpls.length) enabledTpls = templates.slice(0);
    var defTpl = enabledTpls[0];
    enabledTpls.forEach(function (tp) { if (tp.isDefault) defTpl = tp; });
    var cityBoxes = REGIONS.filter(function (r) { return r.level === 'city'; }).map(function (r) {
      return '<label class="ar-check"><input type="checkbox" value="' + r.id + '" data-name="' + e(r.name) + '" onchange="arNtTouch()"><span>' + e(r.name) + '</span></label>';
    }).join('');
    function f(label, ctrl, hint, full) {
      return '<div class="ar-form-group' + (full ? ' full' : '') + '"><label>' + label + '</label>' + ctrl + (hint ? '<div class="fh">' + hint + '</div>' : '') + '</div>';
    }
    var sel = function (id, opts, val) {
      return '<select id="' + id + '" onchange="arNtTouch()">' + opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + e(o[1]) + '</option>';
      }).join('') + '</select>';
    };
    var box = '<div class="ar-modal" id="arNewTaskModal">' +
      '<div class="ar-modal-mask" onclick="arCloseNewTask()"></div>' +
      '<div class="ar-modal-box">' +
      '<div class="ar-modal-hd"><span>新建年报 · 确认编制口径</span><button class="ar-modal-x" onclick="arCloseNewTask()" title="关闭">×</button></div>' +
      '<div class="ar-modal-bd">' +
      '<div class="ar-modal-tip">年报按 <b>建立任务 → 跨库取数 → 质量校验 → 生成八章正文 → 提交审核 → 审核发布 → 归档入库</b> 逐级推进。' +
      '此处口径决定取数范围与计算分母，<b>创建后仅草稿状态可调整</b>，提交审核后锁定。确认口径即可开始自动取数生成。</div>' +
      '<div class="ar-form-grid">' +
      f('报告年度', sel('ntYear', years.map(function (y) { return [y, y + ' 年度']; }), years[0]), '默认取最近一个完整年度') +
      f('报告模板', sel('ntTpl', enabledTpls.map(function (tp) { return [tp.id, tp.name + '（' + tp.volume + '）']; }), defTpl.id), '决定章节结构与内容块') +
      f('覆盖范围', '<div class="ar-radio">' +
        '<label><input type="radio" name="ntScope" value="jx" checked onchange="arNtScope(this.value)">全省（11 设区市）</label>' +
        '<label><input type="radio" name="ntScope" value="city" onchange="arNtScope(this.value)">按设区市选择</label></div>') +
      f('癌种范围', sel('ntCancer', [['全部恶性肿瘤', '全部恶性肿瘤（ICD C00–C97）'], ['主要恶性肿瘤', '主要恶性肿瘤（前 10 位顺位）'], ['消化器官', '消化系统恶性肿瘤'], ['呼吸系统', '呼吸系统恶性肿瘤']], '全部恶性肿瘤')) +
      f('人口口径', sel('ntPopCal', [['usual', '常住人口（与国家年报一致）'], ['household', '户籍人口']], 'usual'), '影响发病率 / 死亡率分母') +
      f('标准人口', sel('ntStdPop', [['cn', '中国 2000 年标准人口'], ['world', 'Segi 世界标准人口']], 'cn'), '影响世界 / 中国标化率') +
      f('年报标题', '<input type="text" id="ntTitle" value="' + e(years[0] + ' 年江西省肿瘤登记年报') + '" oninput="arNtTitleEdit()">', '留空将按年度与范围自动生成', true) +
      '</div>' +
      '<div class="ar-form-group full" id="ntCityWrap" style="display:none"><label>选择设区市<span style="color:#b42318"> *</span></label>' +
      '<div class="ar-city-wrap" id="ntCityBoxes">' + cityBoxes + '</div>' +
      '<div class="fh">至少选择一个设区市；已选数量将同步进标题。</div></div>' +
      '</div>' +
      '<div class="ar-modal-ft"><span class="ft-hint">创建后立即进入工作台并自动开始跨库取数</span>' +
      '<button class="btn btn-ghost" onclick="arCloseNewTask()">取消</button>' +
      '<button class="btn btn-primary" onclick="arCreateTask()">创建并进入编制</button></div>' +
      '</div></div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = box;
    document.body.appendChild(wrap.firstChild);
    arState.ntTitleEdited = 0;
    var y = document.getElementById('ntYear'); if (y) y.focus();
  };
  window.arCloseNewTask = function () {
    var m = document.getElementById('arNewTaskModal'); if (m) m.parentNode.removeChild(m);
  };
  window.arNtTitleEdit = function () { arState.ntTitleEdited = 1; };
  window.arNtScope = function (v) {
    var w = document.getElementById('ntCityWrap'); if (w) w.style.display = v === 'city' ? 'block' : 'none';
    arNtTouch();
  };
  window.arNtTouch = function () {
    if (arState.ntTitleEdited) return;
    var yEl = document.getElementById('ntYear'); if (!yEl) return;
    var year = yEl.value;
    var sc = document.querySelector('input[name=ntScope]:checked');
    var t = document.getElementById('ntTitle'); if (!t) return;
    if (sc && sc.value === 'city') {
      var n = document.querySelectorAll('#ntCityBoxes input:checked').length;
      t.value = year + ' 年江西省' + (n ? n + ' 个设区市' : '片区') + '肿瘤登记年报';
    } else {
      t.value = year + ' 年江西省肿瘤登记年报';
    }
  };
  window.arCreateTask = function () {
    var year = document.getElementById('ntYear').value;
    var tplId = document.getElementById('ntTpl').value;
    var scopeEl = document.querySelector('input[name=ntScope]:checked');
    var scope = scopeEl ? scopeEl.value : 'jx';
    var cities = [];
    if (scope === 'city') {
      document.querySelectorAll('#ntCityBoxes input:checked').forEach(function (c) { cities.push(c.value); });
      if (!cities.length) { toast('请按设区市选择时，至少勾选一个设区市', 'error'); return; }
    } else { cities = ['jx']; }
    var tpl = null; templates.forEach(function (tp) { if (tp.id === tplId) tpl = tp; });
    if (!tpl) { toast('所选模板不存在', 'error'); return; }
    var seq = 0;
    tasks.forEach(function (t) { if (String(t.year) === String(year)) { var n = parseInt(t.id.slice(t.id.lastIndexOf('-') + 1), 10); if (!isNaN(n) && n > seq) seq = n; } });
    var id = 'AR-' + year + '-' + pad4(seq + 1);
    var titleEl = document.getElementById('ntTitle');
    var title = (titleEl && titleEl.value.trim()) || (year + ' 年江西省肿瘤登记年报');
    var task = {
      id: id, title: title, year: String(year), scope: scope, cities: cities,
      templateId: tpl.id, templateSnapshot: templateSnapshotForTask(tpl), status: 'draft', version: 'V0.1',
      popCal: document.getElementById('ntPopCal').value, stdPop: document.getElementById('ntStdPop').value,
      cancer: document.getElementById('ntCancer').value,
      // 阶段化模型：新任务从「建立任务」开工，各阶段产物留空由用户逐阶段完成
      stage: 'task', dataVersion: 'DV-' + year + '-M',
      dataPrep: { sources: seedDataSources('none'), dedupDone: false, dupRemoved: 0, multiPrimary: 0, unlocated: 0, fieldsChecked: false },
      qc: { done: false, issues: [], kpis: [] },
      stats: { done: false, tables: [], charts: [], snapshotAt: '', dataVersion: '' },
      review: { rounds: [] }, release: {},
      agg: { done: false, result: null }, valid: { done: false, result: null }, chapters: {}, corrections: [],
      stageLog: [{ at: nowStr(), action: '创建任务', from: '', to: 'task', note: year + ' 年度年报编制任务建立，口径：' + (scope === 'jx' ? '全省' : '按设区市') + ' · ' + (document.getElementById('ntPopCal').value === 'household' ? '户籍人口' : '常住人口') + ' · ' + (document.getElementById('ntStdPop').value === 'world' ? 'Segi 世界标准人口' : '中国 2000 年标准人口'), by: '省级上报岗' }],
      exportCfg: { format: 'pdf', ci5: true, channels: ['nccr'] },
      createdAt: nowStr(), updatedAt: nowStr(), createdBy: "省级上报岗"
    };
    tasks.unshift(task);
    arState.currentTaskId = id; arState.section = 'overview'; arState.reportPreview = null; arState.viewStage = '';
    persist(); arCloseNewTask(); goPage('ar-workbench');
    toast('已新建 ' + id + '，请从「建立任务」阶段开始编制');
  };
  function pad4(n) { var s = String(n); while (s.length < 4) s = '0' + s; return s; }

  window.arOpenTask = function (id) {
    var t = taskById(id); if (!t) return;
    arState.currentTaskId = id; arState.section = 'overview'; arState.chartTab = 'pyramid'; arState.editChapter = 'ch1'; arState.reportPreview = null;
    // 打开任务一律落在「当前阶段」，不沿用上一条记录的回看位置
    arState.viewStage = '';
    persist(); goPage('ar-workbench');
  };

  /* ---------- 正文章节生成（保留：被「正文编制」阶段的 arGenerateChapters 调用） ----------
     旧版这里是「一键生成流水线」：定时器一口气跑完取数→校验→指标→八章正文。
     阶段化后该流水线已删除——它会绕过阶段闸门，导致质控、统计、审核形同虚设。
     现在各阶段的产物由各自的阶段动作生成（arRunDataPrep / arRunQC / arRunStats / arGenerateChapters）。 */
  function generateChapters(t, overwrite) {
    t.chapters = t.chapters || {}; t.corrections = t.corrections || [];
    var chs = activeTemplateChapters(t), made = 0;
    chs.forEach(function (c) {
      var ct = chapterTemplate(templateSourceForTask(t), c.id);
      if (ct.rules && ct.rules.allowManualEdit === false) return;
      if (!overwrite && t.chapters[c.id]) return;
      t.chapters[c.id] = buildChapterHtml(t, c.id); made++;
    });
    return made;
  }

  /* ===================== 15. 阶段动作 =====================
     每个动作只负责「本阶段产物」的生成与状态记录，推进与否由闸门判定。
     动作完成后停留本阶段，让用户看到清单变化，而不是自动跳走。 */

  function stay(msg, kind) { renderPage('ar-workbench'); if (msg) toast(msg, kind); }

  /* —— 阶段2 数据准备：接入 → 核对 → 剔重 → 字段检查 ——
     旧版只有「标记已核对」一个按钮，等于让用户自己宣布数据没问题。
     正式流程必须走「从源端拉数 → 与快照比对 → 确认差异 → 才能算核对一致」。 */

  /** 各数据源按编制基准取数应得的记录数（此处按口径确定性推导，接真实接口时替换此函数） */
  function sourceFetchCount(t, s) {
    var scopeRatio = (t.scope === 'city' && (t.cities || []).filter(function (c) { return c !== 'jx'; }).length)
      ? (t.cities || []).filter(function (c) { return c !== 'jx'; }).length / 11 : 1;
    var base = { 'src-card': 98512, 'src-death': 27340, 'src-follow': 41260, 'src-pop': 111 }[s.id];
    if (base == null) base = 1000;
    return s.id === 'src-pop' ? base : Math.round(base * scopeRatio);
  }

  window.arConnectSource = function (id) {
    var t = curTask(); if (!t) return;
    var s = (t.dataPrep.sources || []).filter(function (x) { return x.id === id; })[0];
    if (!s) { toast('数据源不存在', 'error'); return; }
    var n = sourceFetchCount(t, s);
    s.state = 'receiving';
    s.cards = n;
    s.at = nowStr();
    s.note = '已拉取 ' + fmt(n) + ' 条，待核对';
    // 与上一版快照比对，产生差异信息（用于核对环节）
    var prev = s.prevCards;
    s.diff = (prev == null || prev === n) ? null : { prev: prev, curr: n, delta: n - prev };
    s.prevCards = n;
    t.updatedAt = nowStr(); touch(t);
    stay('数据源「' + s.name + '」已接入：拉取 ' + fmt(n) + ' 条记录' + (s.diff ? '，与上一版差异 ' + (s.diff.delta > 0 ? '+' : '') + fmt(s.diff.delta) + ' 条' : ''));
  };
  window.arConnectAllSources = function () {
    var t = curTask(); if (!t) return;
    var srcs = (t.dataPrep.sources || []);
    var pending = srcs.filter(function (s) { return s.state === 'pending'; });
    if (!pending.length) { toast('没有待接入的数据源', 'warning'); return; }
    pending.forEach(function (s) {
      var n = sourceFetchCount(t, s);
      s.state = 'receiving'; s.cards = n; s.at = nowStr();
      s.note = '已拉取 ' + fmt(n) + ' 条，待核对';
      var prev = s.prevCards;
      s.diff = (prev == null || prev === n) ? null : { prev: prev, curr: n, delta: n - prev };
      s.prevCards = n;
    });
    t.updatedAt = nowStr(); touch(t);
    stay('已接入 ' + pending.length + ' 个数据源，请逐个执行核对');
  };
  window.arVerifySource = function (id) {
    var t = curTask(); if (!t) return;
    var s = (t.dataPrep.sources || []).filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    if (s.state !== 'receiving') { toast('该数据源尚未接入取数', 'error'); return; }
    s.state = 'ready'; s.at = nowStr();
    s.note = s.diff
      ? '核对一致（较上一版 ' + (s.diff.delta > 0 ? '+' : '') + fmt(s.diff.delta) + ' 条，已确认）'
      : '核对一致';
    t.updatedAt = nowStr(); touch(t);
    stay('数据源「' + s.name + '」核对一致');
  };
  window.arShowSourceDiff = function (id) {
    var t = curTask(); if (!t) return;
    var s = (t.dataPrep.sources || []).filter(function (x) { return x.id === id; })[0];
    if (!s || !s.diff) { toast('该数据源无差异记录', 'warning'); return; }
    showConfirm('数据源差异 · ' + s.name,
      '本次拉取 ' + fmt(s.diff.curr) + ' 条，上一版 ' + fmt(s.diff.prev) + ' 条，差异 ' +
      (s.diff.delta > 0 ? '+' : '') + fmt(s.diff.delta) + ' 条。\n\n请确认差异原因（新增登记单位 / 补报 / 剔重结果变化）后在备注中说明。',
      function () { toast('差异已确认并留痕'); });
  };
  window.arRunDataPrep = function (redo) {
    var t = curTask(); if (!t) return;
    var srcs = (t.dataPrep.sources || []);
    var notReady = srcs.filter(function (s) { return s.state !== 'ready'; });
    if (notReady.length) {
      toast('尚有 ' + notReady.length + ' 个数据源未核对到位（' + notReady.map(function (s) { return s.name; }).join('、') + '），无法执行剔重', 'error');
      return;
    }
    var doIt = function () {
      t.dataPrep.dedupDone = true; t.dataPrep.dedupAt = nowStr();
      t.dataPrep.dupRemoved = AGG_RESULT.dup;
      t.dataPrep.multiPrimary = AGG_RESULT.multiPrimary;
      t.dataPrep.unlocated = AGG_RESULT.unlocated;
      t.dataPrep.validCards = AGG_RESULT.valid;
      t.agg = { done: true, result: AGG_RESULT };
      // 数据变更 → 数据版本推进，统计快照随之过期
      t.dataVersion = 'DV-' + t.year + '-' + String((t.dataPrep.dedupAt || '').replace(/[^0-9]/g, '').slice(-4) || '01');
      if (t.stats && t.stats.done) { t.stats.stale = true; }
      t.updatedAt = nowStr(); touch(t);
      stay('剔重完成：删除重复卡 ' + fmt(AGG_RESULT.dup) + ' 张，识别多原发 ' + AGG_RESULT.multiPrimary + ' 例，合并后有效病例 ' + fmt(AGG_RESULT.valid));
    };
    if (redo) {
      showConfirm('重新执行剔重', '重新剔重会作废已生成的质控、统计与正文产物，需重新走后续阶段。确定继续？', doIt);
      return;
    }
    doIt();
  };
  window.arCheckFields = function () {
    var t = curTask(); if (!t) return;
    if (!t.dataPrep.dedupDone) { toast('请先执行剔重与多原发识别', 'error'); return; }
    var total = t.dataPrep.validCards || AGG_RESULT.valid;
    // 逐字段缺失统计（接真实数据时替换为按字段扫描）
    t.dataPrep.fieldStats = [
      { name: '身份证号', missing: Math.round(total * 0.012), rate: 1.2, max: 2 },
      { name: '发病日期', missing: Math.round(total * 0.003), rate: 0.3, max: 1 },
      { name: '形态学编码（ICD-O-3）', missing: Math.round(total * 0.068), rate: 6.8, max: 10 },
      { name: '性别', missing: Math.round(total * 0.001), rate: 0.1, max: 0.5 },
      { name: '年龄', missing: Math.round(total * 0.004), rate: 0.4, max: 1 },
      { name: '诊断依据', missing: Math.round(total * 0.021), rate: 2.1, max: 5 }
    ];
    t.dataPrep.fieldsChecked = true; t.dataPrep.fieldsAt = nowStr();
    var bad = t.dataPrep.fieldStats.filter(function (x) { return x.rate > x.max; });
    t.updatedAt = nowStr(); touch(t);
    stay(bad.length
      ? '字段检查完成：' + bad.length + ' 个字段缺失率超标（' + bad.map(function (x) { return x.name; }).join('、') + '），建议先补数据'
      : '字段检查完成：' + t.dataPrep.fieldStats.length + ' 个必填字段缺失率全部在阈值内',
      bad.length ? 'warning' : undefined);
  };

  /* —— 阶段3 质量校验 —— */
  window.arRunQC = function (redo) {
    var t = curTask(); if (!t) return;
    if (!(t.dataPrep && t.dataPrep.dedupDone)) { toast('请先完成数据准备阶段的剔重处理', 'error'); return; }
    var doIt = function () {
      t.qc = { done: true, runAt: nowStr(), issues: seedQcIssues('open'), kpis: seedQcKpis(true) };
      t.valid = { done: true, result: { ok: 6, warn: 0, bad: 2 } };
      t.updatedAt = nowStr(); touch(t);
      stay('质量校验完成：6 项国家考核指标达标，发现 ' + t.qc.issues.length + ' 项问题（错误 2 / 警告 2），请整改后闭环');
    };
    if (redo) { showConfirm('重新执行质量校验', '重新校验会覆盖当前问题处置状态（已闭环/已豁免记录将重置），确定继续？', doIt); return; }
    doIt();
  };
  window.arShowIssue = function (id) {
    var t = curTask(); if (!t) return;
    arState.issueView = id;
    renderPage('ar-workbench');
  };
  window.arCloseIssueView = function () { arState.issueView = null; renderPage('ar-workbench'); };
  window.arCloseIssue = function (id) {
    var t = curTask(); if (!t) return;
    var it = (t.qc.issues || []).filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    var noteEl = document.getElementById('arFixNote');
    var note = noteEl && noteEl.value ? String(noteEl.value).trim() : '';
    it.state = 'closed'; it.closedAt = nowStr(); it.closedBy = t.createdBy || '省级上报岗';
    if (note) it.fixNote = note;
    var open = (t.qc.issues || []).filter(function (x) { return x.state !== 'closed' && x.state !== 'waived'; });
    t.valid = { done: true, result: { ok: 6, warn: open.filter(function (x) { return x.level !== 'bad'; }).length, bad: open.filter(function (x) { return x.level === 'bad'; }).length } };
    arState.issueView = null;
    t.updatedAt = nowStr(); touch(t);
    stay('问题 ' + it.no + ' 已标记闭环');
  };
  window.arReopenIssue = function (id) {
    var t = curTask(); if (!t) return;
    var it = (t.qc.issues || []).filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    it.state = 'open'; it.closedAt = ''; it.closedBy = ''; it.waivedAt = ''; it.waivedBy = ''; it.waiveNote = '';
    var open = (t.qc.issues || []).filter(function (x) { return x.state !== 'closed' && x.state !== 'waived'; });
    t.valid = { done: true, result: { ok: 6, warn: open.filter(function (x) { return x.level !== 'bad'; }).length, bad: open.filter(function (x) { return x.level === 'bad'; }).length } };
    t.updatedAt = nowStr(); touch(t);
    stay('问题 ' + it.no + ' 的处置已撤销，回到待整改');
  };
  window.arBatchClose = function (kind) {
    var t = curTask(); if (!t) return;
    var list = (t.qc.issues || []).filter(function (x) {
      if (x.state === 'closed' || x.state === 'waived') return false;
      return kind === 'bad' ? x.level === 'bad' : x.level !== 'bad';
    });
    if (!list.length) { toast('没有待处理的该类问题', 'warning'); return; }
    showConfirm('批量闭环', '将 ' + list.length + ' 项' + (kind === 'bad' ? '错误' : '警告') + '级问题标记为已闭环，处置人记为当前用户。确定继续？', function () {
      list.forEach(function (it) {
        it.state = 'closed'; it.closedAt = nowStr(); it.closedBy = t.createdBy || '省级上报岗';
        it.fixNote = '批量闭环';
      });
      var open = (t.qc.issues || []).filter(function (x) { return x.state !== 'closed' && x.state !== 'waived'; });
      t.valid = { done: true, result: { ok: 6, warn: open.filter(function (x) { return x.level !== 'bad'; }).length, bad: open.filter(function (x) { return x.level === 'bad'; }).length } };
      t.updatedAt = nowStr(); touch(t);
      stay('已批量闭环 ' + list.length + ' 项问题');
    });
  };
  window.arBatchWaive = function () {
    var t = curTask(); if (!t) return;
    var list = (t.qc.issues || []).filter(function (x) { return x.level !== 'bad' && x.state !== 'closed' && x.state !== 'waived'; });
    if (!list.length) { toast('没有待处理的警告级问题', 'warning'); return; }
    showConfirm('批量豁免', '将 ' + list.length + ' 项警告级问题批量豁免，需在质控报告中留痕。确定继续？', function () {
      list.forEach(function (it) {
        it.state = 'waived'; it.waivedAt = nowStr(); it.waivedBy = t.createdBy || '省级上岗岗';
        it.waiveNote = '经省级质控岗评估，属登记机构常见编码差异，不影响统计口径，批量予以豁免';
      });
      var open = (t.qc.issues || []).filter(function (x) { return x.state !== 'closed' && x.state !== 'waived'; });
      t.valid = { done: true, result: { ok: 6, warn: open.filter(function (x) { return x.level !== 'bad'; }).length, bad: open.filter(function (x) { return x.level === 'bad'; }).length } };
      t.updatedAt = nowStr(); touch(t);
      stay('已批量豁免 ' + list.length + ' 项警告级问题');
    });
  };
  window.arExportQcReport = function () {
    var t = curTask(); if (!t || !t.qc || !t.qc.done) { toast('尚未执行质量校验', 'error'); return; }
    var rows = [];
    rows.push(['江西省肿瘤登记年报 · 质量控制报告']);
    rows.push(['任务编号', t.id, '报告年度', t.year, '覆盖范围', scopeLabel(t)]);
    rows.push(['数据版本', t.dataVersion || '—', '校验时间', t.qc.runAt || '—']);
    rows.push([]);
    rows.push(['一、国家登记质量考核指标']);
    rows.push(['考核指标', '本省值', '国家要求', '判定']);
    (t.qc.kpis || []).forEach(function (k) { rows.push([k.name, k.value, k.require, k.pass ? '达标' : '未达标']); });
    rows.push([]);
    rows.push(['二、质控问题清单']);
    rows.push(['报告卡号', '地区', '触发规则', '级别', '问题描述', '状态', '处置人', '处置时间', '整改说明']);
    (t.qc.issues || []).forEach(function (it) {
      var st = { open: '待整改', fixing: '整改中', closed: '已闭环', waived: '已豁免' }[it.state] || it.state;
      rows.push([it.no, it.region, it.rule, it.level === 'bad' ? '错误' : '警告', it.detail, st,
        it.closedBy || it.waivedBy || '', it.closedAt || it.waivedAt || '', it.fixNote || it.waiveNote || '']);
    });
    rows.push([]);
    rows.push(['三、数据准备情况']);
    rows.push(['数据源', '类型', '记录数', '状态', '最近操作']);
    ((t.dataPrep || {}).sources || []).forEach(function (s) {
      rows.push([s.name, s.kind, s.cards != null ? s.cards : '', AR().sourceStateLabel(s.state), s.at || '']);
    });
    rows.push([]);
    rows.push(['剔重删除重复卡', ((t.dataPrep || {}).dupRemoved || 0), '识别多原发', ((t.dataPrep || {}).multiPrimary || 0), '未定位', ((t.dataPrep || {}).unlocated || 0)]);
    downloadTextFile(t.title.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '_') + '_质控报告.csv', toCsv(rows));
    toast('已导出质控报告');
  };
  window.arWaiveIssue = function (id) {
    var t = curTask(); if (!t) return;
    var it = (t.qc.issues || []).filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    if (it.level === 'bad') { toast('错误级问题不可豁免，必须整改闭环', 'error'); return; }
    showConfirm('申请豁免', '对警告级问题「' + it.detail + '」提交豁免说明，需在质控报告中留痕。确定继续？', function () {
      it.state = 'waived'; it.waivedAt = nowStr(); it.waivedBy = t.createdBy || '省级上报岗';
      it.waiveNote = '经省级质控岗评估，属登记机构常见编码差异，不影响统计口径，予以豁免';
      var open = (t.qc.issues || []).filter(function (x) { return x.state !== 'closed' && x.state !== 'waived'; });
      t.valid = { done: true, result: { ok: 6, warn: open.filter(function (x) { return x.level !== 'bad'; }).length, bad: open.filter(function (x) { return x.level === 'bad'; }).length } };
      arState.issueView = null;
      t.updatedAt = nowStr(); touch(t);
      stay('问题 ' + it.no + ' 已豁免并留痕');
    });
  };

  /* —— 阶段4 统计分析 —— */
  window.arRunStats = function () {
    var t = curTask(); if (!t) return;
    var q = AR().summaries.qc(t);
    if (!(t.qc && t.qc.done)) { toast('请先执行质量校验', 'error'); return; }
    if (q.openBad > 0) { toast('存在 ' + q.openBad + ' 项错误级质控问题未整改，无法统计', 'error'); return; }
    t.stats = { done: true, tables: STAT_TABLES.slice(), charts: STAT_CHARTS.slice(), snapshotAt: nowStr(), dataVersion: t.dataVersion };
    t.agg = { done: true, result: AGG_RESULT };
    t.updatedAt = nowStr(); touch(t);
    stay('统计分析完成：生成 ' + STAT_TABLES.length + ' 张统计表、' + STAT_CHARTS.length + ' 张图表，快照 ' + t.dataVersion);
  };

  /* —— 阶段5 正文编制 —— */
  window.arGenerateChapters = function () {
    var t = curTask(); if (!t) return;
    var s = AR().summaries.stats(t);
    if (!s.done) { toast('请先完成统计分析，正文引用需以统计产物为准', 'error'); return; }
    if (s.stale) { toast('统计快照已过期，请先重新统计', 'error'); return; }
    var made = generateChapters(t, true);
    t.corrections = t.corrections || [];
    t.corrections.unshift({ ver: t.version, at: nowStr(), by: t.createdBy || '省级上报岗', note: '按统计产物生成 ' + made + ' 章正文' });
    t.updatedAt = nowStr(); touch(t);
    stay('已按统计产物生成 ' + made + ' 章正文，请人工校订并执行引用一致性核对');
  };
  window.arCheckDraft = function () {
    var t = curTask(); if (!t) return;
    var chs = activeTemplateChapters(t);
    var has = chs.filter(function (c) { return !!t.chapters[c.id]; });
    if (!has.length) { toast('尚无正文可核对，请先生成或撰写章节', 'error'); return; }
    // 以真实统计产物为基准，检查正文是否引用了过期口径值
    var mism = [];
    has.forEach(function (c) {
      var body = String(t.chapters[c.id] || '');
      // 旧口径（未取整 / 与统计产物不一致的写法）会被识别为不符
      if (body.indexOf('119.8') >= 0) mism.push({ chapter: c.title, text: '中标发病率 119.8/10 万', expected: '119.4/10 万（与统计表1一致）' });
      if (body.indexOf('158.6') >= 0) mism.push({ chapter: c.title, text: '世标发病率 158.6/10 万', expected: '158.1/10 万（与统计表1一致）' });
      if (body.indexOf('68.4') >= 0) mism.push({ chapter: c.title, text: '中标死亡率 68.4/10 万', expected: '67.8/10 万（与统计表2一致）' });
    });
    t.draftCheck = { at: nowStr(), mismatches: mism, checked: has.length };
    t.updatedAt = nowStr(); touch(t);
    stay(mism.length ? '引用一致性核对发现 ' + mism.length + ' 处与统计产物不符' : '引用一致性核对通过，正文与统计产物一致',
      mism.length ? 'warning' : undefined);
  };
  window.arFixMismatch = function (chapterTitle) {
    var t = curTask(); if (!t) return;
    Object.keys(t.chapters).forEach(function (k) {
      var body = String(t.chapters[k] || '');
      body = body.replace(/119\.8/g, '119.4').replace(/158\.6/g, '158.1').replace(/68\.4/g, '67.8');
      t.chapters[k] = body;
    });
    if (t.draftCheck) t.draftCheck.mismatches = [];
    t.updatedAt = nowStr(); touch(t);
    stay('已按统计产物订正正文引用值');
  };

  /* —— 阶段6 审核 —— */
  window.arSubmitReview = function () {
    var t = curTask(); if (!t) return;
    var gate = AR().evalGate('draft', t, ARH);
    if (!gate.ok) { toast('无法提交：' + gate.blockers[0].text, 'error'); return; }
    t.review = t.review || { rounds: [] };
    var round = t.review.rounds.length + 1;
    t.review.rounds.push({
      id: 'RV-' + p2(round), round: round, submittedAt: nowStr(), submittedBy: t.createdBy || '省级上报岗',
      reviewer: '省级审核岗', result: 'pending', decidedAt: '',
      items: [
        { id: 'RI-1', text: '摘要部分中标率建议按中国 2000 年标准人口口径复核，与附表 1 保持一致', level: 'major', replyState: 'pending', reply: '' },
        { id: 'RI-2', text: '讨论与建议章节建议补充重点癌种早筛的具体措施', level: 'minor', replyState: 'pending', reply: '' }
      ]
    });
    t.status = 'submitted'; t.submittedAt = nowStr();
    AR().logStage(t, '提交审核', 'draft', 'review', '第 ' + round + ' 轮提交省级审核', t.createdBy || '省级上报岗');
    t.updatedAt = nowStr(); touch(t);
    stay('已提交第 ' + round + ' 轮省级审核，等待审核岗出具结论');
  };
  window.arReplyReview = function (roundId, itemId) {
    var t = curTask(); if (!t) return;
    var rd = (t.review.rounds || []).filter(function (x) { return x.id === roundId; })[0];
    if (!rd) return;
    var it = (rd.items || []).filter(function (x) { return x.id === itemId; })[0];
    if (!it) return;
    it.replyState = 'replied';
    it.reply = '已按审核意见修订：' + (it.id === 'RI-1' ? '摘要与附表1 中标率统一为 119.4/10 万' : '已补充肺癌、结直肠癌、乳腺癌三癌种早筛措施');
    t.corrections = t.corrections || [];
    t.corrections.unshift({ ver: t.version, at: nowStr(), by: t.createdBy || '省级上报岗', note: '回复审核意见 ' + it.id + ' 并完成修订' });
    t.updatedAt = nowStr(); touch(t);
    stay('已回复审核意见 ' + it.id);
  };

  /* —— 阶段7 发布归档 —— */
  window.arApproveRelease = function () {
    var t = curTask(); if (!t) return;
    var r = AR().summaries.review(t);
    if (!r.passed) { toast('审核尚未通过，无法提交发布审批', 'error'); return; }
    t.release = t.release || {};
    t.release.approvedAt = nowStr();
    t.release.approvedBy = '省卫健委疾病预防控制处';
    t.status = 'approved'; t.approvedAt = nowStr();
    AR().logStage(t, '发布审批通过', 'review', 'release', '省卫健委主管部门批准发布', '省卫健委疾病预防控制处');
    t.updatedAt = nowStr(); touch(t);
    stay('发布审批已通过，可生成上报数据包');
  };
  window.arBuildPackage = function () {
    var t = curTask(); if (!t) return;
    if (!(t.release && t.release.approvedAt)) { toast('请先完成发布审批', 'error'); return; }
    var d = AR().summaries.draft(t, chapterTotal, chapterDone);
    if (!d.complete) { toast('正文尚未齐备（' + d.done + '/' + d.total + ' 章），无法生成上报数据包', 'error'); return; }
    /* 真实产出：正文（HTML，可被 Word 打开）+ 统计附表（CSV）+ 质控报告（CSV）。
       原型里这里只写了个文件名，用户拿不到任何东西。 */
    var base = t.title.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '_');
    var made = [];
    if (downloadTextFile(base + '_正文.html', buildReportDocumentHtml(t), 'text/html')) made.push('正文');
    var statTables = ((t.stats || {}).tables || []);
    if (statTables.length) {
      var allRows = [];
      statTables.forEach(function (tb, i) {
        if (i > 0) allRows.push([]);
        allRows.push([tb.no + ' ' + tb.name]);
        var csv = statTableCsv(t, tb.id);
        if (csv) csv.split('\r\n').forEach(function (line) { allRows.push(line.split(',')); });
      });
      if (downloadTextFile(base + '_统计附表.csv', toCsv(allRows))) made.push('统计附表');
    }
    var cfg = t.exportCfg || { format: 'pdf', ci5: true, channels: ['nccr'] };
    if (cfg.ci5) {
      if (downloadTextFile(base + '_CI5.csv', buildCi5Csv(t))) made.push('CI5/IARC 数据');
    }

    t.release.packageBuiltAt = nowStr();
    t.release.packageName = base + '_NCCR.zip';
    t.release.files = made;
    if (t.status === 'approved') {
      t.status = 'published'; t.publishedAt = nowStr();
      var selCh = (cfg.channels && cfg.channels.length) ? cfg.channels : ['nccr'];
      var chLabels = selCh.map(function (c) { for (var i = 0; i < CHANNELS.length; i++) if (CHANNELS[i].id === c) return CHANNELS[i].label; return c; }).join('、');
      var seq = 0; submissions.forEach(function (s) { if (String(s.year) === String(t.year)) { var n = parseInt(s.id.slice(s.id.lastIndexOf('-') + 1), 10); if (!isNaN(n) && n > seq) seq = n; } });
      submissions.unshift({ id: 'SB-' + t.year + '-' + pad4(seq + 1), taskId: t.id, year: t.year, title: t.title, channel: 'nccr', channelLabel: chLabels, ci5: cfg.ci5, format: cfg.format, status: '待投递', receiptNo: '', sentAt: nowStr(), remark: '待投递至上报渠道' });
    }
    t.updatedAt = nowStr(); persist(); renderPage('ar-workbench');
    toast('已生成上报数据包：' + made.join(' + ') + '（已触发下载）');
  };

  /* ---------- 上报文件内容 ---------- */

  /** 正文导出：把八章渲染成一份可独立打开的文档 */
  function buildReportDocumentHtml(t) {
    var chs = activeTemplateChapters(t);
    var body = chs.map(function (c, i) {
      return '<h2>第' + CN_NO[i] + '章　' + e(c.title) + '</h2>' + (t.chapters[c.id] || buildChapterHtml(t, c.id));
    }).join('');
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>' + e(t.title) + '</title>' +
      '<style>body{font-family:"宋体",serif;max-width:820px;margin:40px auto;line-height:1.9;color:#111;font-size:15px}' +
      'h1{font-size:24px;text-align:center;font-family:"黑体",sans-serif;margin:0 0 6px}' +
      '.sub{text-align:center;color:#555;font-size:13px;margin-bottom:32px}' +
      'h2{font-size:18px;font-family:"黑体",sans-serif;margin:32px 0 12px;border-bottom:1px solid #ddd;padding-bottom:6px}' +
      'h3,h4{font-size:15px;font-family:"黑体",sans-serif;margin:20px 0 8px}' +
      'p{margin:0 0 12px;text-indent:2em}table{border-collapse:collapse;width:100%;margin:14px 0;font-size:13px}' +
      'td,th{border:1px solid #999;padding:6px 8px}th{background:#f2f2f2;font-family:"黑体",sans-serif}' +
      '.meta{margin-top:40px;padding-top:14px;border-top:1px solid #ddd;font-size:12px;color:#666;line-height:1.9}</style></head><body>' +
      '<h1>' + e(t.title) + '</h1>' +
      '<div class="sub">江西省肿瘤登记年报 · ' + e(t.year) + ' 年度 · ' + e(scopeLabel(t)) + '</div>' +
      body +
      '<div class="meta">' +
      '任务编号：' + e(t.id) + '　版本：' + e(t.version) + '<br>' +
      '编制基准：' + (t.popCal === 'household' ? '户籍人口' : '常住人口') + ' · ' + (t.stdPop === 'world' ? 'Segi 世界标准人口' : '中国 2000 年标准人口') + ' · 分析癌种 ' + e(t.cancer) + '<br>' +
      '数据版本：' + e(t.dataVersion || '—') + '　统计快照：' + e((t.stats || {}).snapshotAt || '—') + '<br>' +
      '制表单位：江西省肿瘤登记中心　导出时间：' + e(nowStr()) +
      '</div></body></html>';
  }

  /** CI5/IARC 适配数据：按国际癌症登记协会交换格式的列序输出病例级数据 */
  function buildCi5Csv(t) {
    var rows = [['REGISTRY', 'SEX', 'AGE', 'INCIDENCE_DATE', 'SITE', 'MORPHOLOGY', 'BEHAVIOUR', 'BASIS', 'DEATH_DATE', 'CITY']];
    // 按各设区市与癌种分布展开病例行（接真实库时替换为逐卡输出）
    var cities = t.scope === 'city' && (t.cities || []).filter(function (c) { return c !== 'jx'; }).length
      ? REGIONS.filter(function (r) { return (t.cities || []).indexOf(r.id) >= 0; })
      : REGIONS.filter(function (r) { return r.level === 'city'; });
    SITES.forEach(function (s) {
      cities.forEach(function (r) {
        var n = Math.round((s.inc / SITES.reduce(function (a, x) { return a + x.inc; }, 0)) * regionInc(r));
        if (n <= 0) return;
        rows.push(['JX', '', '', '', s.icd, '', '', '', '', r.name]);
      });
    });
    return toCsv(rows);
  }
  window.arRebuildPackage = function () {
    var t = curTask(); if (!t) return;
    showConfirm('重新生成数据包', '将按当前定稿重新导出正文与统计附表，并再次触发下载。确定继续？', function () {
      t.release.packageBuiltAt = '';
      window.arBuildPackage();
    });
  };
  window.arPreviewReportDoc = function () {
    var t = curTask(); if (!t) return;
    arState.reportPreview = buildReportDocumentHtml(t);
    renderPage('ar-workbench');
  };
  window.arEnterReceipt = function () {
    var t = curTask(); if (!t) return;
    if (!(t.release && t.release.packageBuiltAt)) { toast('请先生成上报数据包', 'error'); return; }
    t.release.receiptNo = 'NCCR-R-2026-' + pad4(Math.floor(Math.random() * 90) + 10);
    t.release.receiptAt = nowStr();
    var sb = submissions.filter(function (s) { return s.taskId === t.id; })[0];
    if (sb) { sb.receiptNo = t.release.receiptNo; sb.status = '已回执'; }
    t.updatedAt = nowStr(); touch(t);
    stay('已登记国家平台回执：' + t.release.receiptNo + '，可执行归档入库');
  };

  /* 状态机 */
  window.arSaveDraft = function () {
    var t = curTask(); if (!t) return;
    if (t.status !== 'draft') { toast('仅草稿状态可保存草稿', 'error'); return; }
    t.updatedAt = nowStr(); persist(); renderPage('ar-workbench'); toast('草稿已保存到草稿箱（' + t.id + ' · ' + t.version + '）');
  };
  window.arSaveCfg = function () {
    var t = curTask(); if (!t) return;
    t.updatedAt = nowStr(); persist(); renderPage('ar-workbench'); toast('导出配置已保存');
  };
  window.arSubmit = function () { return window.arSubmitReview(); };
  window.arApprove = function () {
    var t = curTask(); if (!t) return;
    if (t.status !== 'submitted') { toast('当前状态不可审核通过', 'error'); return; }
    t.review = t.review || { rounds: [] };
    if (!t.review.rounds.length) t.review.rounds.push({ id: 'RV-01', round: 1, submittedAt: t.submittedAt || nowStr(), submittedBy: t.createdBy || '省级上报岗', reviewer: '省级审核岗', items: [] });
    var rd = t.review.rounds[t.review.rounds.length - 1];
    (rd.items || []).forEach(function (it) { it.replyState = 'replied'; if (!it.reply) it.reply = '已按审核意见修订'; });
    rd.result = 'pass'; rd.decidedAt = nowStr();
    t.status = 'approved'; t.approvedAt = nowStr(); t.updatedAt = nowStr();
    t.corrections = t.corrections || [];
    t.corrections.push({ ver: t.version, at: nowStr(), by: "省级审核岗", note: '第 ' + rd.round + ' 轮审核通过' });
    AR().logStage(t, '审核通过', 'review', 'release', '第 ' + rd.round + ' 轮审核通过，进入发布归档阶段', '省级审核岗');
    persist(); renderPage('ar-workbench'); toast('审核通过，可进入发布归档阶段');
  };
  window.arReturn = function () {
    var t = curTask(); if (!t) return;
    if (t.status !== 'submitted') { toast('当前状态不可退回', 'error'); return; }
    t.review = t.review || { rounds: [] };
    var rd = t.review.rounds[t.review.rounds.length - 1];
    if (rd) {
      rd.result = 'reject'; rd.decidedAt = nowStr();
      (rd.items || []).forEach(function (it) { it.replyState = 'pending'; });
    } else {
      t.review.rounds.push({ id: 'RV-01', round: 1, submittedAt: t.submittedAt || nowStr(), submittedBy: t.createdBy || '省级上报岗', reviewer: '省级审核岗', result: 'reject', decidedAt: nowStr(), items: [{ id: 'RI-1', text: '请补充修订后重新提交', level: 'major', replyState: 'pending', reply: '' }] });
    }
    t.status = 'draft'; t.updatedAt = nowStr();
    t.corrections = t.corrections || [];
    t.corrections.push({ ver: t.version, at: nowStr(), by: "省级审核岗", note: '审核退回：请按意见修订后重新提交' });
    AR().logStage(t, '审核退回', 'review', 'draft', '审核岗退回修改，任务回到正文编制阶段', '省级审核岗');
    persist(); renderPage('ar-workbench'); toast('已退回修改，请按审核意见逐条回复后重新提交');
  };
  window.arPublish = function () { return window.arBuildPackage(); };
  window.arArchive = function () {
    var t = curTask(); if (!t) return;
    var gate = AR().evalGate('release', t, ARH);
    if (!gate.ok) { toast('无法归档：' + gate.blockers[0].text, 'error'); return; }
    t.status = 'archived'; t.archivedAt = nowStr(); t.updatedAt = nowStr();
    var seq = 0; archives.forEach(function (a) { if (String(a.year) === String(t.year)) { var n = parseInt(a.id.slice(a.id.lastIndexOf('-') + 1), 10); if (!isNaN(n) && n > seq) seq = n; } });
    var pages = 82;
    archives.unshift({ id: 'AC-' + t.year + '-' + pad4(seq + 1), taskId: t.id, year: t.year, version: t.version, fileName: t.title + '.pdf', fileType: 'pdf', pages: pages, size: ((7.2 + (pages - 80) * 0.04).toFixed(1)) + ' MB', status: '已归档', archivedAt: nowStr(), archivedBy: '省级上报岗' });
    AR().logStage(t, '归档入库', 'release', 'archived', '取得回执 ' + ((t.release || {}).receiptNo || '—') + '，定稿归档', '省级上报岗');
    persist(); renderPage('ar-workbench'); toast('已归档入库，可在归档记录中查看');
  };
  window.arVoid = function () {
    var t = curTask(); if (!t) return;
    if (t.status !== 'draft' && t.status !== 'submitted') { toast('当前状态不可作废', 'error'); return; }
    showConfirm('作废任务', '确定将「' + t.title + '」作废吗？作废后不可再编制，记录保留。', function () {
      var cur = AR().currentStage(t, ARH);
      t.status = 'voided'; t.voidReason = '人工作废'; t.updatedAt = nowStr();
      t.corrections = t.corrections || [];
      t.corrections.push({ ver: t.version, at: nowStr(), by: "省级上报岗", note: '任务作废：人工作废' });
      AR().logStage(t, '作废', cur, 'voided', '人工作废', '省级上报岗');
      persist(); renderPage('ar-workbench'); toast('任务已作废');
    });
  };
  window.arDeleteTask = function (id) {
    var t = taskById(id); if (!t) return;
    if (t.status !== 'voided' && t.status !== 'draft') { toast('仅草稿/已作废任务可删除', 'error'); return; }
    showConfirm('删除任务', '确定永久删除「' + t.title + '」吗？此操作不可恢复。', function () {
      tasks = tasks.filter(function (x) { return x.id !== id; });
      if (arState.currentTaskId === id) arState.currentTaskId = '';
      persist(); renderPage('ar-tasks'); toast('任务已删除');
    });
  };

  /* 口径变更后置为待重算，由单页流水线自动重跑 */
  function markStale(t) {
    if (!t || t.status !== 'draft' || arState.gen.running) return;
    t.agg = { done: false, result: null };
    t.valid = { done: false, result: null };
  }
  window.arFixIssue = function (btn) {
    btn.disabled = true; btn.textContent = '已修正';
    toast('已标记为修正');
  };

  /* 报告编制 */
  window.arEditChapter = function (id) { arState.editChapter = id; renderPage('ar-workbench'); };
  window.arDocCmd = function (cmd, val) {
    var page = document.getElementById('arDocPage'); if (!page) return;
    if (page.focus) page.focus();
    try { document.execCommand(cmd, false, val || null); } catch (err) { toast('该浏览器不支持此格式操作', 'error'); }
  };
  function docInsert(html) {
    var page = document.getElementById('arDocPage'); if (!page) { toast('请先进入正文编辑区', 'error'); return; }
    if (page.getAttribute && page.getAttribute('contenteditable') !== 'true') { toast('该章节为只读，不可插入', 'error'); return; }
    if (page.focus) page.focus();
    var ok = false;
    try { ok = document.execCommand('insertHTML', false, html); } catch (err) { ok = false; }
    if (!ok) page.innerHTML = page.innerHTML + html;
  }
  window.arDocInsertTable = function () {
    var r = AGG_RESULT;
    var rows = REGIONS.filter(function (x) { return x.level === 'city'; }).slice(0, 5).map(function (x) {
      return '<tr><td class="txt">' + x.name + '</td><td class="num">' + (x.pop / 10000).toFixed(0) + '</td><td class="num">' + fmt(regionInc(x)) + '</td><td class="num">' + x.incRate.toFixed(1) + '</td><td class="num">' + fmt(regionDeath(x)) + '</td><td class="num">' + x.deathRate.toFixed(1) + '</td></tr>';
    }).join('');
    docInsert('<table class="doc-tbl"><thead><tr><th class="txt">设区市</th><th class="num">人口（万）</th><th class="num">发病数</th><th class="num">粗发病率</th><th class="num">死亡数</th><th class="num">粗死亡率</th></tr></thead><tbody>' + rows +
      '<tr><td class="txt"><b>全省合计</b></td><td class="num"><b>' + (r.pop / 10000).toFixed(0) + '</b></td><td class="num"><b>' + fmt(r.valid) + '</b></td><td class="num"><b>' + (r.valid / r.pop * 100000).toFixed(1) + '</b></td><td class="num"><b>' + fmt(r.death) + '</b></td><td class="num"><b>' + (r.death / r.pop * 100000).toFixed(1) + '</b></td></tr>' +
      '</tbody></table><p class="doc-cap">表　主要设区市发病与死亡情况</p>');
  };
  window.arDocInsertFigure = function () {
    var top = SITES.slice().sort(function (a, b) { return b.inc - a.inc; }).slice(0, 6);
    var max = top[0].inc;
    var bars = top.map(function (x) { return '<i style="height:' + Math.max(12, Math.round(x.inc / max * 100)) + '%"><b>' + x.name + '</b></i>'; }).join('');
    docInsert('<div class="ar-figure"><div class="fig-t">图　主要癌种发病顺位（例）</div><div class="ar-fbar">' + bars + '</div></div><p class="doc-cap">图　全省主要癌种发病顺位</p>');
  };
  window.arDocInsertIndicator = function () {
    var r = AGG_RESULT;
    docInsert('<table class="doc-tbl"><tbody>' +
      '<tr><th class="num">有效病例</th><td>' + fmt(r.valid) + ' 例</td><th class="num">粗发病率</th><td>' + (r.valid / r.pop * 100000).toFixed(1) + '/10 万</td></tr>' +
      '<tr><th class="num">死亡病例</th><td>' + fmt(r.death) + ' 例</td><th class="num">粗死亡率</th><td>' + (r.death / r.pop * 100000).toFixed(1) + '/10 万</td></tr>' +
      '<tr><th class="num">MV%</th><td>' + QC_PROV.mv + '%</td><th class="num">DCO%</th><td>' + QC_PROV.dco + '%</td></tr>' +
      '<tr><th class="num">M/I</th><td>' + QC_PROV.mi + '</td><th class="num">UB%</th><td>' + QC_PROV.ub + '%</td></tr>' +
      '</tbody></table><p class="doc-cap">表　核心指标一览</p>');
  };
  window.arDocGoSection = function (i) {
    var page = document.getElementById('arDocPage'); if (!page || !page.querySelectorAll) return;
    var hs = page.querySelectorAll('h4.doc-sec');
    if (hs && hs[i] && hs[i].scrollIntoView) hs[i].scrollIntoView({ block: 'center' });
  };
  window.arSaveChapter = function () {
    var t = curTask(); if (!t) return;
    var page = document.getElementById('arDocPage'); if (!page) return;
    var ct = chapterTemplate(templateSourceForTask(t), arState.editChapter);
    if (ct.rules && ct.rules.allowManualEdit === false) { toast('该章节为只读，不可保存', 'error'); return; }
    var html = page.innerHTML || '';
    var cut = html.indexOf('</h3>');
    if (cut >= 0) html = html.slice(cut + 5);
    t.chapters[arState.editChapter] = html; t.updatedAt = nowStr();
    var ch = chapterConfigById(t, arState.editChapter);
    t.corrections.unshift({ ver: '修订', at: nowStr(), by: "省级上报岗", note: '人工校订：' + (ch ? ch.title : arState.editChapter) });
    persist(); renderPage('ar-workbench'); toast('本章已保存');
  };
  window.arResetChapter = function () {
    var t = curTask(); if (!t) return;
    if (t.chapters[arState.editChapter]) delete t.chapters[arState.editChapter];
    t.updatedAt = nowStr(); persist(); renderPage('ar-workbench'); toast('已恢复默认文本');
  };
  window.arGenerateChapter = function () {
    var t = curTask(); if (!t) return;
    if (!t.agg || !t.agg.done) { toast('数据自动生成中，请稍候', 'error'); return; }
    var ct = chapterTemplate(templateSourceForTask(t), arState.editChapter);
    if (ct.rules && ct.rules.allowManualEdit === false) { toast('该章节模板设为只读，不可生成', 'error'); return; }
    t.chapters[arState.editChapter] = buildChapterHtml(t, arState.editChapter); t.updatedAt = nowStr();
    var meta = CHAPTER_META.filter(function (c) { return c.id === arState.editChapter; })[0];
    t.corrections.unshift({ ver: '生成', at: nowStr(), by: "省级上报岗", note: '按数据自动生成：' + (meta ? meta.title : arState.editChapter) });
    persist(); renderPage('ar-workbench'); toast('已按汇总数据生成本章正文');
  };
  window.arViewReport = function () {
    var t = curTask(); if (!t) return;
    arState.reportPreview = buildReportPreviewHtml(t);
    renderPage('ar-workbench');
  };
  window.arCloseReport = function () { arState.reportPreview = null; renderPage('ar-workbench'); };

  /* 导出 */
  window.arSetFormat = function (fmt) { var t = curTask(); if (!t) return; t.exportCfg = t.exportCfg || {}; t.exportCfg.format = fmt; touch(t); renderPage('ar-workbench'); };
  window.arToggleChannel = function (id, on) {
    var t = curTask(); if (!t) return; t.exportCfg = t.exportCfg || {};
    if (on) { if (t.exportCfg.channels.indexOf(id) < 0) t.exportCfg.channels.push(id); }
    else t.exportCfg.channels = t.exportCfg.channels.filter(function (c) { return c !== id; });
    touch(t); renderPage('ar-workbench');
  };
  window.arToggleCi5 = function (on) { var t = curTask(); if (!t) return; t.exportCfg = t.exportCfg || {}; t.exportCfg.ci5 = on; touch(t); renderPage('ar-workbench'); };
  window.arToggleGovFiling = function (on) { var t = curTask(); if (!t) return; t.exportCfg = t.exportCfg || {}; t.exportCfg.govFiling = on; touch(t); renderPage('ar-workbench'); };
  window.arToggleBigScreen = function (on) { var t = curTask(); if (!t) return; t.exportCfg = t.exportCfg || {}; t.exportCfg.bigScreen = on; touch(t); renderPage('ar-workbench'); };

  /* 任务口径 */
  window.arSetTaskYear = function (v) {
    var t = curTask(); if (!t) return;
    t.year = v;
    t.title = t.title.replace(/^\d{4}(?= 年)/, v);
    markStale(t); touch(t); renderPage('ar-workbench');
  };
  window.arSetTaskScope = function (v) { var t = curTask(); if (!t) return; t.scope = v; t.cities = (v === 'city') ? [] : ['jx']; markStale(t); touch(t); renderPage('ar-workbench'); };
  window.arToggleCity = function (id, on) { var t = curTask(); if (!t) return; if (on) { if (t.cities.indexOf(id) < 0) t.cities.push(id); } else t.cities = t.cities.filter(function (c) { return c !== id; }); markStale(t); touch(t); renderPage('ar-workbench'); };
  window.arSetTaskPopCal = function (v) { var t = curTask(); if (!t) return; t.popCal = v; markStale(t); touch(t); renderPage('ar-workbench'); };
  window.arSetTaskStdPop = function (v) { var t = curTask(); if (!t) return; t.stdPop = v; markStale(t); touch(t); renderPage('ar-workbench'); };
  window.arSetTaskCancer = function (v) { var t = curTask(); if (!t) return; t.cancer = v; markStale(t); touch(t); renderPage('ar-workbench'); };

  /* 模板管理动作 */
  window.arNewTemplate = function () { arState.tplEditingId = null; arState.tplView = 'form'; renderPage('ar-templates'); };
  window.arManageChapterTemplates = function (id) { if (!tplById(id)) { toast('模板不存在或已删除', 'error'); return; } arState.tplEditingId = id; arState.tplView = 'chapter-list'; renderPage('ar-templates'); };
  window.arEditChapterTemplate = function (id) { var tp = tplById(arState.tplEditingId); if (!tp || !chapterIdsForTemplate(tp).some(function (x) { return x === id; })) { toast('章节不存在或已被停用', 'error'); return; } arState.editChapter = id; arState.tplView = 'chapter-form'; renderPage('ar-templates'); };
  window.arChapterTemplateList = function () { arState.tplView = 'chapter-list'; renderPage('ar-templates'); };
  window.arEditTemplate = function (id) { arState.tplEditingId = id; arState.tplView = 'form'; renderPage('ar-templates'); };
  window.arTplList = function () { arState.tplView = 'list'; arState.tplEditingId = null; renderPage('ar-templates'); };
  window.arSaveChapterTemplate = function () {
    var tp = tplById(arState.tplEditingId); if (!tp) return;
    var c = chapterTemplate(tp, arState.editChapter);
    c.title = document.getElementById('ctTitle').value.trim() || c.title;
    c.desc = document.getElementById('ctDesc').value.trim();
    c.dataSource = document.getElementById('ctSource').value.trim();
    var secs = normalizeSections(c);
    secs.forEach(function (s) {
      var box = document.querySelector('input[data-sec-title="' + s.id + '"]');
      if (box && String(box.value || '').trim()) s.title = String(box.value).trim();
    });
    function readSet(attr) { var out = []; Array.prototype.forEach.call(document.querySelectorAll('input[data-ct-' + attr + ']'), function (x) { if (x.checked) out.push(x.value); }); return out; }
    c.indicators = readSet('indicators'); c.charts = readSet('charts'); c.tables = readSet('tables');
    c.rules = { showTitle: document.getElementById('ctTitleRule').checked, showSource: document.getElementById('ctSourceRule').checked, allowManualEdit: document.getElementById('ctEditRule').checked, requireData: document.getElementById('ctDataRule').checked };
    bumpTemplate(tp);
    persist(); arState.tplPreview = null; arState.tplView = 'chapter-list'; renderPage('ar-templates'); toast('章节模板已保存，模板版本已升级');
  };
  function bumpTemplate(tp) {
    tp.updatedAt = nowStr(); tp.updatedBy = "省级上报岗";
    tp.version = 'v' + ((parseInt(String(tp.version).replace(/[^0-9]/g, ''), 10) || 0) + 1);
  }
  function curChapterTpl() {
    var tp = tplById(arState.tplEditingId); if (!tp) return null;
    return { tp: tp, ct: chapterTemplate(tp, arState.editChapter) };
  }
  function curSection() {
    var h = curChapterTpl(); if (!h) return null;
    var secs = normalizeSections(h.ct);
    var sec = secs.filter(function (x) { return x.id === arState.editSectionId; })[0];
    return sec ? { tp: h.tp, ct: h.ct, secs: secs, sec: sec } : null;
  }
  /* 小节维护 */
  window.arEditSection = function (id) {
    arState.editSectionId = id; arState.tplView = 'section-form'; renderPage('ar-templates');
  };
  window.arBackToChapterForm = function () { arState.tplView = 'chapter-form'; arState.editSectionId = null; renderPage('ar-templates'); };
  window.arAddSection = function () {
    var h = curChapterTpl(); if (!h) return;
    var secs = normalizeSections(h.ct);
    var n = 1; while (secs.filter(function (x) { return x.id === 'sec' + n; }).length) n++;
    secs.push({ id: 'sec' + n, title: '新增小节 ' + n, blocks: [{ type: 'text', text: '' }] });
    bumpTemplate(h.tp); persist(); renderPage('ar-templates'); toast('已新增小节');
  };
  window.arDelSection = function (id) {
    var h = curChapterTpl(); if (!h) return;
    var secs = normalizeSections(h.ct);
    if (secs.length <= 1) { toast('至少保留一个小节', 'error'); return; }
    var s = secs.filter(function (x) { return x.id === id; })[0];
    showConfirm('删除小节', '确定删除小节「' + (s ? s.title : id) + '」及其全部内容块吗？', function () {
      h.ct.sections = secs.filter(function (x) { return x.id !== id; });
      bumpTemplate(h.tp); persist(); renderPage('ar-templates'); toast('小节已删除');
    });
  };
  window.arMoveSection = function (id, dir) {
    var h = curChapterTpl(); if (!h) return;
    var secs = normalizeSections(h.ct);
    var i = -1; secs.forEach(function (x, k) { if (x.id === id) i = k; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= secs.length) return;
    var tmp = secs[i]; secs[i] = secs[j]; secs[j] = tmp;
    bumpTemplate(h.tp); persist(); renderPage('ar-templates');
  };
  /* 内容块维护 */
  function readBlocksFromDom(sec) {
    (sec.blocks || []).forEach(function (b, i) {
      var txt = document.querySelector('textarea[data-blk-text="' + i + '"]');
      if (txt) b.text = txt.value;
      var pre = document.querySelector('select[data-blk-preset="' + i + '"]');
      if (pre) b.preset = pre.value;
      if (b.type === 'indicator') {
        var out = [];
        Array.prototype.forEach.call(document.querySelectorAll('input[data-blk-ind="' + i + '"]'), function (x) { if (x.checked) out.push(x.value); });
        b.indicators = out;
      }
    });
  }
  window.arAddBlock = function (type) {
    var h = curSection(); if (!h) return;
    readBlocksFromDom(h.sec);
    h.sec.blocks = h.sec.blocks || [];
    var b = { type: type };
    if (type === 'text' || type === 'list') b.text = '';
    if (type === 'indicator') b.indicators = ['病例数', '粗发病率'];
    if (type === 'table') b.preset = 'core';
    if (type === 'figure') b.preset = 'site-inc';
    h.sec.blocks.push(b);
    bumpTemplate(h.tp); persist(); renderPage('ar-templates'); toast('已添加内容块');
  };
  window.arDelBlock = function (i) {
    var h = curSection(); if (!h) return;
    readBlocksFromDom(h.sec);
    h.sec.blocks.splice(i, 1);
    bumpTemplate(h.tp); persist(); renderPage('ar-templates'); toast('内容块已删除');
  };
  window.arMoveBlock = function (i, dir) {
    var h = curSection(); if (!h) return;
    readBlocksFromDom(h.sec);
    var j = i + dir; var b = h.sec.blocks;
    if (j < 0 || j >= b.length) return;
    var tmp = b[i]; b[i] = b[j]; b[j] = tmp;
    bumpTemplate(h.tp); persist(); renderPage('ar-templates');
  };
  window.arSetBlockType = function (i, type) {
    var h = curSection(); if (!h) return;
    readBlocksFromDom(h.sec);
    var b = h.sec.blocks[i]; if (!b) return;
    b.type = type;
    if ((type === 'text' || type === 'list') && b.text == null) b.text = '';
    if (type === 'indicator' && !b.indicators) b.indicators = ['病例数', '粗发病率'];
    if (type === 'table' && TABLE_PRESETS.filter(function (x) { return x.id === b.preset; }).length === 0) b.preset = 'core';
    if (type === 'figure' && FIGURE_PRESETS.filter(function (x) { return x.id === b.preset; }).length === 0) b.preset = 'site-inc';
    bumpTemplate(h.tp); persist(); renderPage('ar-templates');
  };
  window.arInsertVar = function (i, key) {
    var box = document.querySelector('textarea[data-blk-text="' + i + '"]');
    if (!box) return;
    box.value = String(box.value || '') + '{{' + key + '}}';
    if (box.focus) box.focus();
    toast('已插入变量 {{' + key + '}}');
  };
  window.arSaveSection = function () {
    var h = curSection(); if (!h) return;
    var tb = document.getElementById('secTitle');
    if (tb && String(tb.value || '').trim()) h.sec.title = String(tb.value).trim();
    else { toast('请填写小节标题', 'error'); return; }
    readBlocksFromDom(h.sec);
    bumpTemplate(h.tp); persist(); arState.tplView = 'chapter-form'; renderPage('ar-templates'); toast('小节内容已保存，模板版本已升级');
  };
  window.arPreviewChapterTpl = function () {
    var h = curChapterTpl(); if (!h) return;
    var vars = arVars(curTask());
    var secs = normalizeSections(h.ct);
    var html = (h.ct.rules && h.ct.rules.showTitle === false ? '' : '<h3 class="doc-ch">' + e(h.ct.title) + '</h3>') +
      secs.map(function (s, i) {
        var body = (s.blocks || []).map(function (b) { return renderBlock(b, vars); }).join('');
        return '<h4 class="doc-sec">' + CN_NO[i] + '、' + e(s.title) + '</h4>' + (body || '<p>（本节暂无内容块）</p>');
      }).join('');
    arState.tplPreview = html; renderPage('ar-templates');
  };
  window.arClosePreviewChapterTpl = function () { arState.tplPreview = null; renderPage('ar-templates'); };

  window.arSaveTemplate = function () {
    var name = document.getElementById('tplName').value.trim();
    if (!name) { toast('请填写模板名称', 'error'); return; }
    var type = document.getElementById('tplType').value;
    var cycle = document.getElementById('tplCycle').value.trim() || '年度';
    var volume = document.getElementById('tplVolume').value.trim() || '全省全癌种';
    var desc = document.getElementById('tplDesc').value.trim();
    var enabled = document.getElementById('tplEnabled').value === '1';
    var isDefault = document.getElementById('tplDefault').checked;
    var chapterConfigs = [];
    Array.prototype.forEach.call(document.querySelectorAll('tr[data-ch-row]'), function (row, index) {
      var id = row.getAttribute('data-ch-row');
      var orderBox = row.querySelector('[data-ch-order]');
      var enabledBox = row.querySelector('[data-ch-enabled]');
      var titleBox = row.querySelector('[data-ch-title]');
      var descBox = row.querySelector('[data-ch-desc]');
      chapterConfigs.push({ id: id, order: Number(orderBox && orderBox.value) || index + 1, enabled: !!(enabledBox && enabledBox.checked), title: titleBox ? titleBox.value.trim() : '', desc: descBox ? descBox.value.trim() : '' });
    });
    chapterConfigs.sort(function (a, b) { return a.order - b.order; });
    if (!chapterConfigs.some(function (c) { return c.enabled; })) { toast('至少启用一个章节', 'error'); return; }
    var chs = chapterConfigs.filter(function (c) { return c.enabled; }).map(function (c) { return c.id; });
    var now = nowStr();
    if (isDefault) templates.forEach(function (x) { x.isDefault = false; });
    if (arState.tplEditingId) {
      var tp = tplById(arState.tplEditingId);
      if (tp) { tp.name = name; tp.type = type; tp.cycle = cycle; tp.volume = volume; tp.desc = desc; tp.enabled = enabled; tp.isDefault = isDefault; tp.chapters = chs; tp.chapterConfigs = chapterConfigs; tp.version = 'v' + ((parseInt(String(tp.version).replace(/[^0-9]/g, ''), 10) || 0) + 1); tp.updatedAt = now; tp.updatedBy = "省级上报岗"; }
    } else {
      templates.unshift({ id: 'TPL-' + Date.now(), name: name, type: type, cycle: cycle, volume: volume, desc: desc, enabled: enabled, isDefault: isDefault, version: 'v1', updatedAt: now, updatedBy: "省级上报岗", chapters: chs, chapterConfigs: chapterConfigs });
    }
    persist(); arState.tplView = 'list'; arState.tplEditingId = null; renderPage('ar-templates'); toast('模板已保存');
  };
  window.arDuplicateTemplate = function (id) {
    var tp = tplById(id); if (!tp) return;
    var now = nowStr();
    templates.unshift({ id: 'TPL-' + Date.now(), name: tp.name + '（副本）', type: tp.type, cycle: tp.cycle, volume: tp.volume, desc: tp.desc, enabled: true, isDefault: false, version: 'v1', updatedAt: now, updatedBy: "省级上报岗", chapters: tp.chapters.slice(), chapterConfigs: cloneTemplateValue(templateChapterConfigs(tp)), chapterTemplates: cloneTemplateValue(tp.chapterTemplates || {}) });
    persist(); renderPage('ar-templates'); toast('已复制模板');
  };
  window.arSetDefaultTemplate = function (id) {
    templates.forEach(function (x) { x.isDefault = (x.id === id); });
    persist(); renderPage('ar-templates'); toast('已设为默认模板');
  };
  window.arToggleTemplate = function (id) {
    var tp = tplById(id); if (!tp) return;
    tp.enabled = !tp.enabled; tp.updatedAt = nowStr(); tp.updatedBy = "省级上报岗";
    persist(); renderPage('ar-templates'); toast(tp.enabled ? '模板已启用' : '模板已停用');
  };
  window.arDeleteTemplate = function (id) {
    var tp = tplById(id); if (!tp) return;
    if (tp.isDefault) { toast('默认模板不可删除', 'error'); return; }
    showConfirm('删除模板', '确定删除模板「' + tp.name + '」吗？', function () {
      templates = templates.filter(function (x) { return x.id !== id; });
      persist(); renderPage('ar-templates'); toast('模板已删除');
    });
  };

  /* 上报 / 归档动作 */
  function subById(id) { for (var i = 0; i < submissions.length; i++) if (submissions[i].id === id) return submissions[i]; return null; }
  window.arSubDeliver = function (id) {
    var s = subById(id); if (!s) return;
    if (s.status !== '待投递' && s.status.indexOf('退') < 0 && s.status.indexOf('未过') < 0) { toast('当前状态不可投递', 'error'); return; }
    s.status = '已投递'; s.sentAt = nowStr(); s.remark = '已通过 ' + s.channelLabel + ' 投递，等待回执';
    persist(); renderPage('ar-tasks'); toast('已投递至 ' + s.channelLabel + '，等待回执');
  };
  window.arSubConfirm = function (id) {
    var s = subById(id); if (!s) return;
    if (s.status !== '已投递' && s.status !== '待回执') { toast('仅已投递记录可确认回执', 'error'); return; }
    s.status = '已回执归档'; s.receiptNo = s.receiptNo || ('NCCR-R-' + s.year + '-' + pad4(Math.floor(Math.random() * 9000) + 1000)); s.remark = '回执已确认并归档';
    persist(); renderPage('ar-tasks'); toast('回执已确认：' + s.receiptNo);
  };
  window.arSubReject = function (id) {
    var s = subById(id); if (!s) return;
    if (s.status !== '已投递' && s.status !== '待回执') { toast('仅已投递记录可标记退回', 'error'); return; }
    showConfirm('标记退回', '确认「' + s.id + '」被上报渠道退回吗？可整改后重新投递。', function () {
      s.status = '已退回'; s.remark = '上报渠道退回，待整改后重新投递';
      persist(); renderPage('ar-tasks'); toast('已标记退回，可重新投递');
    });
  };
  window.arSubReceipt = function (id) {
    var s = subById(id); if (!s) return;
    toast(s.id + ' · ' + s.channelLabel + ' · 状态：' + s.status + (s.receiptNo ? ' · 回执 ' + s.receiptNo : '') + (s.remark ? ' · ' + s.remark : ''));
  };
  window.arPreviewArchive = function (id) {
    for (var i = 0; i < archives.length; i++) if (archives[i].id === id) { toast('预览：' + archives[i].fileName); return; }
  };
  window.arDownloadArchive = function (id) {
    for (var i = 0; i < archives.length; i++) if (archives[i].id === id) { toast('开始下载：' + archives[i].fileName); return; }
  };
  window.arDeleteArchive = function (id) {
    for (var i = 0; i < archives.length; i++) if (archives[i].id === id) {
      var f = archives[i].fileName;
      showConfirm('删除归档', '确定删除归档文件「' + f + '」吗？', function () {
        archives = archives.filter(function (x) { return x.id !== id; });
        persist(); renderPage('ar-archives'); toast('归档已删除');
      });
      return;
    }
  };

  /* ===================== 15. 页面分派 ===================== */
  function renderPageContent() {
    if (arState.page === 'ar-templates') return renderTemplates();
    if (arState.page === 'ar-submissions') return renderSubmissions();
    if (arState.page === 'ar-archives') return renderArchives();
    if (arState.page === 'ar-view') return renderView();
    if (arState.page === 'ar-workbench') return renderWorkbench();
    return renderTasks();
  }

  /* ===================== 16. 菜单与路由 ===================== */
  var AR_CHILDREN = [
    { id: 'ar-tasks', label: '年报记录' },
    { id: 'ar-workbench', label: '编制工作台' },
    { id: 'ar-archives', label: '归档记录' }
  ];
  var OWNED_IDS = ['annual-report', 'ar-tasks', 'ar-workbench', 'ar-view', 'ar-templates', 'ar-submissions', 'ar-archives'];

  function ensureArMenu() {
    if (typeof menuData === 'undefined' || !menuData) return;
    var found = false;
    for (var i = 0; i < menuData.length; i++) {
      if (menuData[i].id === 'annual-report') {
        menuData[i].children = AR_CHILDREN;
        menuData[i].label = menuData[i].label || '年报';
        found = true;
        break;
      }
    }
    if (!found) menuData.push({ id: 'annual-report', label: '年报', icon: '●', children: AR_CHILDREN });

    var sm = document.getElementById('sidebarMenu');
    if (sm && sm.children.length) {
      var activeId = null;
      var a = document.querySelector('#sidebarMenu .menu-item.active');
      if (a) activeId = a.getAttribute('data-id') || a.getAttribute('id');
      sm.innerHTML = '';
      if (typeof buildMenu === 'function') buildMenu(menuData, sm);
      if (activeId && typeof setActiveMenu === 'function') setActiveMenu(activeId);
    }
  }

  ensureArMenu();

  var arBaseNavigate = typeof navigateTo === 'function' ? navigateTo : null;
  var arBaseRender = typeof renderPage === 'function' ? renderPage : null;
  var arNavInstalled = false;
  var arRenderInstalled = false;

  function installArNav() {
    if (arNavInstalled) return;
    arNavInstalled = true;
    navigateTo = function (id) {
      var isOwn = OWNED_IDS.indexOf(id) >= 0;
      if (!isOwn) { if (arBaseNavigate) return arBaseNavigate(id); return; }
      var target = id;
      if (id === 'annual-report') { target = 'ar-tasks'; arState.taskTab = 'tasks'; }
      else if (id === 'ar-submissions') { target = 'ar-tasks'; arState.taskTab = 'subs'; arState.page = 'ar-tasks'; }
      else { if (target === 'ar-tasks') arState.taskTab = 'tasks'; arState.page = target; }
      if (window.location) { try { window.location.hash = '#/' + target; } catch (e) {} }
      if (arBaseNavigate) arBaseNavigate(target);
    };
  }

  function installArRender() {
    if (arRenderInstalled) return;
    arRenderInstalled = true;
    renderPage = function (id) {
      var isOwn = OWNED_IDS.indexOf(id) >= 0;
      if (!isOwn) { if (arBaseRender) return arBaseRender(id); return; }
      var target = id;
      if (id === 'annual-report' || id === 'ar-submissions') target = 'ar-tasks';
      if (id === 'ar-submissions') arState.taskTab = 'subs';
      arState.page = target;
      if (arState.page === 'ar-workbench' && !curTask() && tasks.length) arState.currentTaskId = tasks[0].id;
      var container = document.getElementById('pageContainer');
      if (container) container.innerHTML = renderPageContent();
      if (typeof setActiveMenu === 'function') setActiveMenu(arState.page);
      var sm = document.getElementById('sidebarMenu');
      if (sm) {
        var items = sm.querySelectorAll('.menu-item');
        for (var i = 0; i < items.length; i++) {
          var di = items[i].getAttribute('data-id') || items[i].getAttribute('id');
          if (di === 'annual-report' && !items[i].classList.contains('open')) items[i].classList.add('open');
        }
      }
      var extra = null;
      if (arState.page === 'ar-workbench') { var t = curTask(); if (t) extra = t.id + ' ' + t.title; }
      if (arState.page === 'ar-templates' && arState.tplView === 'form') extra = arState.tplEditingId ? '编辑模板' : '新增模板';
      if (arState.page === 'ar-templates' && arState.tplView === 'chapter-list') extra = '章节模板目录';
      if (arState.page === 'ar-templates' && arState.tplView === 'chapter-form') extra = '编辑章节模板';
      if (arState.page === 'ar-templates' && arState.tplView === 'section-form') extra = '编辑小节内容';
      if (typeof updateBreadcrumb === 'function') updateBreadcrumb(arState.page, extra);
      if (typeof autoSizeSelects === 'function') autoSizeSelects();
      // 阶段化后不再自动跑生成流水线：所有产物由用户在对应阶段显式触发生成
    };
  }

  installArNav();
  installArRender();

  window.__arAnnualReportInstalled = true;
})();
