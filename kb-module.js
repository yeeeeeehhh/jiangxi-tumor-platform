/* ============================================================
   科普与培训 · 内容知识库（kb-module.js）
   ------------------------------------------------------------
   定位：一个内容库，两类内容（科普 / 培训）。医生来看、来拿、来维护。
   侧导航 4 个页面（不用页内页签——板块里有什么，侧栏一眼看全）：
     1. kb-sci    科普内容   面向患者的图文/视频/折页，从这里取用
     2. kb-train  培训内容   课件/操作手册/SOP/教学视频，纯资源列表
     3. kb-mine   我的内容   我收藏的内容，按 科普内容 / 培训材料 分类回看
     4. kb-dict   分类维护   病种 / 使用场景 / 标签 三个字典

   两级库三条规则：
     · 省库对医院只读（省库行不出现编辑类按钮）
     · 收藏：把常用内容挑进「我的内容」，按科普 / 培训两类留着复用
     · 院内内容按 org 隔离，其他机构不可见

   状态只有两态：上架 / 下架（字段仍是 status: 启用 / 停用）。
   「依据出处」字段已整体移除：表单不再有这一栏，也不再作为上架门禁——
    内容的可信度由「来源平台 + 原文链接 + 发布日期」（转载件）和发布人 / 发布单位承担。
    存量数据里的 evidence 不删：详情页若历史上填过仍会展示，只是不再要求、不再补填。

   看 —— 预览 = 跳转到内容详情页（kb-detail.js），不再弹窗：
     列表行「预览」/ 图文卡片 / 首页资讯栏条目 → navigateTo('kb-detail|<内容编号>')
     详情页按内容形式分版式：视频 / 课件 / 操作手册 / 宣传折页 / 图文
     详情页是站内页面，#kb-detail|<编号> 可直达、刷新不丢；页内动作（收藏 / 取用 / 编辑）照旧走本文件

   对外导出：window.KB / window.kbPageIds / window.renderKBPage / window.kbOpenDetail
   兼容：window.renderHealthConsultPage（旧调用名）；kb-library / health-consult 与 17 个咨询旧 id 一律落到「科普内容」
   ============================================================ */
(function () {
  'use strict';

  /* ================= 样式 ================= */
  var CSS = [
    '.kb-page{min-width:0}',
    '.kb-note{border:1px solid #dbe6f5;border-left:4px solid #244765;border-radius:6px;background:#f4f8ff;padding:10px 14px;font-size:12.5px;color:#334155;line-height:1.65;margin-bottom:14px}',
    '.kb-note b{color:#244765}',
    /* 弹窗
       尺寸从 820px / 88vh 放大到 1080px / 92vh：
       新增内容表单有十来个字段，820px 下两列挤、一屏只看得到六七项，要滚很多次；
       1080px 宽后「受众 / 标签」这类点选区能一排放下，两列输入框也不再发窄。 */
    '.kb-mask{position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.5)}',
    '.kb-modal{width:min(1080px,96vw);max-height:94vh;display:flex;flex-direction:column;background:#fff;border-radius:10px;box-shadow:0 18px 50px rgba(15,23,42,.25)}',
    '.kb-modal.narrow{width:min(620px,96vw)}',
    '.kb-modal .hd{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px 26px;border-bottom:1px solid var(--border,#dfe5ec)}',
    '.kb-modal .hd .t{font-size:16px;font-weight:700;color:#1f2937}',
    '.kb-modal .hd .sub{font-size:12px;color:#94a3b8;font-weight:400;margin-left:10px}',
    '.kb-modal .x{width:30px;height:30px;border:0;border-radius:5px;background:#f2f4f7;color:#667085;font-size:16px;cursor:pointer}',
    '.kb-modal .bd{padding:22px 26px;overflow:auto;flex:1}',
    '.kb-modal .ft{display:flex;justify-content:flex-end;gap:10px;padding:14px 26px;border-top:1px solid var(--border,#dfe5ec);background:#fbfcfe;flex-wrap:wrap}',
    '.kb-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 26px}',
    '.kb-form .full{grid-column:1/-1}',
    '.kb-form label{display:block;font-size:12.5px;color:#475569;font-weight:600;margin-bottom:7px}',
    '.kb-form input:not([type=checkbox]),.kb-form select,.kb-form textarea{width:100%;border:1px solid #d1d8e0;border-radius:5px;background:#fff;color:#1f2937;font-size:13.5px;box-sizing:border-box;padding:0 11px;height:38px;font-family:inherit}',
    '.kb-form textarea{height:auto;min-height:96px;padding:10px 11px;resize:vertical;line-height:1.7}',
    '.kb-form .hint{font-size:11.5px;color:#94a3b8;margin-top:6px;line-height:1.6}',
    '.kb-form .req{color:#b42335}',
    '.kb-picks{display:flex;gap:8px;flex-wrap:wrap}',
    '.kb-picks button{border:1px solid #d1d8e0;background:#fff;color:#475569;border-radius:999px;padding:6px 14px;font-size:12.5px;cursor:pointer;line-height:1.5}',
    '.kb-picks button.on{background:#244765;border-color:#244765;color:#fff}',
    /* 表单内新建合集 */
    '.kb-col-field{display:flex;flex-direction:column;gap:10px}',
    '.kb-pick-empty{font-size:12px;color:#a3b1bf}',
    '.kb-col-new{display:flex;gap:10px;align-items:center}',
    '.kb-col-new input{flex:1 1 auto;min-width:0;height:36px;border:1px solid #d1d8e0;border-radius:5px;padding:0 11px;font-size:13px}',
    '.kb-col-new input:focus{outline:2px solid #b9e0e2;border-color:#168a94}',
    '.kb-col-new .btn{flex:0 0 auto}',
    /* 表单里的物料上传 */
    '.kb-up{display:flex;flex-direction:column;gap:12px}',
    '.kb-up-drop{display:flex;flex-direction:column;align-items:center;gap:7px;padding:28px 20px;border:1px dashed #cfdae6;border-radius:8px;background:#fbfcfe;cursor:pointer;transition:all .15s}',
    '.kb-up-drop:hover,.kb-up-drop.on{border-color:#244765;background:#f4f9ff}',
    '.kb-up-icon{font-size:20px;color:#8ba6bf}',
    '.kb-up-text{font-size:13.5px;color:#5f7285}',
    '.kb-up-tip{font-size:12px;color:#a3b1bf}',
    '.kb-up-list{display:flex;flex-wrap:wrap;gap:10px}',
    '.kb-up-chip{display:inline-flex;align-items:center;gap:8px;max-width:100%;padding:8px 11px;border:1px solid #e2e8ef;border-radius:6px;background:#fff;font-size:12.5px}',
    '.kb-up-chip i{font-style:normal;font-size:10px;font-weight:800;color:#4b6a8c;background:#eef3fa;border-radius:3px;padding:1px 5px}',
    '.kb-up-name{color:#293b51;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.kb-up-size{color:#a3b1bf;font-family:var(--font-num)}',
    '.kb-up-chip button{border:0;background:transparent;color:#b0bcc9;cursor:pointer;font-size:11px;padding:0 2px}',
    '.kb-up-chip button:hover{color:#b42335}',
    /* 合集封面 */
    '.kb-cover-field{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}',
    '.kb-cover-preview{width:224px;aspect-ratio:16/9;border:1px solid #d8e0ea;border-radius:8px;overflow:hidden;background:linear-gradient(135deg,#eef3f9,#dbe5f0);display:flex;align-items:center;justify-content:center;flex:0 0 auto}',
    '.kb-cover-preview img{width:100%;height:100%;object-fit:cover;display:block}',
    '.kb-cover-empty{text-align:center;font-size:12px;color:#7d8fa3;line-height:1.7}',
    '.kb-cover-empty em{font-style:normal;font-size:11px;color:#a3b1bf}',
    '.kb-cover-ops{display:flex;flex-direction:column;gap:8px;align-items:flex-start}',
    '.kb-cover-hint{font-size:11px;color:#94a3b8}',
    /* ---- 上下架维护 ---- */
    '.kb-shelf-sum{display:flex;align-items:center;gap:22px;flex-wrap:wrap;padding:2px 0 14px}',
    '.kb-shelf-kpi{display:flex;flex-direction:column;gap:2px;min-width:72px}',
    '.kb-shelf-kpi span{font-size:12px;color:#64748b}',
    '.kb-shelf-kpi b{font-size:22px;font-weight:800;color:#17233a;line-height:1.2}',
    '.kb-shelf-kpi b.warn{color:#a1541a}',
    '.kb-shelf-bulk{margin-left:auto;display:flex;gap:8px}',
    '.kb-shelf-tabs{display:flex;gap:0;margin-bottom:12px;border:1px solid var(--border);border-radius:6px;overflow:hidden;background:#fff;width:fit-content}',
    '.kb-shelf-tab{height:34px;padding:0 14px;border:0;border-right:1px solid var(--border);background:#fff;color:#64748b;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}',
    '.kb-shelf-tab:last-child{border-right:0}',
    '.kb-shelf-tab:hover{color:var(--primary);background:#f8fafc}',
    '.kb-shelf-tab.on{background:var(--primary);color:#fff}',
    '.kb-shelf-tab-n{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#eef2f7;color:#64748b;font-size:11px;font-weight:700}',
    '.kb-shelf-tab-n.warn{background:#fdefe2;color:#a1541a}',
    '.kb-shelf-tab.on .kb-shelf-tab-n{background:rgba(255,255,255,.24);color:#fff}',
    '.kb-shelf-why{max-width:190px}',
    '.kb-shelf-tag{display:inline-block;padding:2px 7px;margin:0 4px 4px 0;border-radius:4px;background:#fdefe2;color:#a1541a;font-size:11.5px;font-weight:600;white-space:nowrap}',
    '.kb-shelf-tag--hint{background:#eef2f7;color:#64748b;font-weight:500}',
    '.kb-shelf-row--warn td{background:#fffdf7}',
    /* ---- 表单里的标签：预置点选 + 自定义 ---- */
    '.kb-tagf{display:flex;flex-direction:column;gap:8px}',
    /* ---- 我的内容：页内三页签 ---- */
    '.kb-mine-tabs{display:flex;gap:0;margin-bottom:14px;border:1px solid var(--border);border-radius:6px;overflow:hidden;background:#fff;width:fit-content}',
    '.kb-mine-tab{height:36px;padding:0 16px;border:0;border-right:1px solid var(--border);background:#fff;color:#64748b;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}',
    '.kb-mine-tab:last-child{border-right:0}',
    '.kb-mine-tab:hover{color:var(--primary);background:#f8fafc}',
    '.kb-mine-tab.on{background:var(--primary);color:#fff}',
    '.kb-mine-tab-n{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#eef2f7;color:#64748b;font-size:11px;font-weight:700}',
    '.kb-mine-tab.on .kb-mine-tab-n{background:rgba(255,255,255,.24);color:#fff}',
    /* ---- 流水表格：下载 / 上传 共用 ---- */
    '.kb-rec-table{min-width:1180px}',
    '.kb-rec-table td{white-space:nowrap}',
    '.kb-rec-table td.kb-rec-main{white-space:normal;min-width:200px;max-width:340px}',
    '.kb-rec-table td.kb-rec-file{max-width:220px;overflow:hidden;text-overflow:ellipsis;color:#475569}',
    '.kb-rec-table td.num,.kb-rec-table th.num{text-align:right;font-variant-numeric:tabular-nums}',
    '.kb-rec-link{color:var(--primary);font-weight:600;cursor:pointer}',
    '.kb-rec-link:hover{text-decoration:underline}',
    '.kb-rec-sub{font-size:11.5px;color:#94a3b8;margin-top:2px;white-space:normal;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}',
    /* ---- 转载专区表格 ----
       左竖色条按来源平台着色（--rp-c），行左边界贴一条 3px，表头左侧留出同宽占位对齐。
       标题列给足宽度（多行摘要两行截断），其余列 nowrap，标签列允许换行。 */
    '.kb-rp-table{min-width:1040px}',
    /* 场景 / 受众两列是新加的（2026-10-23）：给它们收窄并允许换行，
       否则 10 列会把表撑出横向滚动，操作列被推出可视区（1366 宽下实测）。
       受众一列最多显示 2 个，多的用 +N 表示，完整值在详情页。 */
    '.kb-rp-table th.rp-col-narrow,.kb-rp-table td.rp-col-narrow{width:104px;max-width:104px}',
    '.kb-rp-table td.rp-col-narrow{white-space:normal}',
    /* 色条列只占 3px：表头首格也留这么宽，标题列和下面的标题才在同一条竖线上 */
    '.kb-rp-table th.rp-row-pc,.kb-rp-table td.rp-row-pc{width:3px;min-width:3px;max-width:3px;padding:0}',
    '.kb-rp-table td.rp-row-pc{position:relative}',
    '.kb-rp-table th.rp-row-main{padding-left:12px}',
    '.kb-rp-table td.rp-row-main{padding-left:12px}',
    '.kb-rp-table .rp-row-bar{position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:var(--rp-c,#244765)}',
    '.kb-rp-table tbody tr.rp-row:hover td{background:#f6f9fd}',
    '.kb-rp-table td.rp-row-main{white-space:normal;min-width:280px;max-width:460px}',
    '.kb-rp-table td.rp-row-main .kb-rec-link{font-size:13.5px;line-height:1.5}',
    '.kb-rp-table td.rp-row-main .kb-rec-sub{-webkit-line-clamp:2;line-height:1.55;margin-top:3px}',
    '.kb-rp-table td.rp-row-plat{white-space:nowrap}',
    '.kb-rp-table td.rp-row-plat b{font-weight:600;color:#334155}',
    '.kb-rp-table td.rp-row-tags{white-space:normal;min-width:96px}',
    '.kb-rp-table td.rp-row-tags .kbx-tag{display:inline-block;margin:1px 4px 1px 0}',
    '.kb-rp-table td.rp-nowrap{white-space:nowrap;color:#475569;font-variant-numeric:tabular-nums}',
    '.kb-rp-table td.rp-row-st{white-space:nowrap}',
    '.rp-st{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:4px;font-size:11.5px;font-weight:600}',
    '.rp-st--on{background:#e6f4ea;color:#1f6f4a}',
    '.rp-st--off{background:#eef2f7;color:#64748b}',
    '.kb-rp-table td.rp-row-ops{white-space:nowrap}',
    '.kbx-ico-row{display:inline-flex;align-items:center;gap:5px}',
    '.kbx-ico-row .kbx-ico{text-decoration:none}',
    /* ---- 使用统计 ---- */
    '.kb-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:16px}',
    '.kb-kpi{border:1px solid var(--border);border-radius:6px;background:#fff;padding:14px 16px}',
    '.kb-kpi-l{font-size:12.5px;color:#64748b}',
    '.kb-kpi-v{font-size:26px;font-weight:700;color:var(--primary);line-height:1.2;margin-top:6px;font-variant-numeric:tabular-nums}',
    '.kb-kpi-s{font-size:11.5px;color:#94a3b8;margin-top:6px}',
    '.kb-kpi-s b{font-weight:700}',
    '.kb-kpi-s .up{color:#15803d}.kb-kpi-s .down{color:#b42335}',
    '@media(max-width:1280px){.kb-kpis{grid-template-columns:repeat(2,1fr)}}',


    '.kb-chart{border:1px solid var(--border);border-radius:6px;background:#fff;padding:14px 16px}',
    '.kb-chart-hd{font-size:13px;font-weight:600;color:#334155;margin-bottom:4px}',
    '.kb-chart-sub{font-size:11.5px;color:#94a3b8;margin-bottom:10px}',












    /* 内容库排序条：夹在筛选条与卡片之间。不用下拉，四个选项一眼看全，切一下即时生效 */
    '.kb-sortbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:-2px 0 14px}',
    '.kb-sortbar-lb{font-size:12px;color:#667085;font-weight:600}',
    '.kb-sortbar-dir{height:26px;padding:0 10px;border:1px dashed #c7d3e0;border-radius:14px;background:#fff;color:#4b647d;font-size:12px;cursor:pointer}',
    '.kb-sortbar-dir:hover{border-color:var(--primary);color:var(--primary)}',
    '.kb-seg{height:26px;padding:0 12px;border:1px solid #d8dfe7;border-radius:14px;background:#fff;color:#4b647d;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s}',
    '.kb-seg:hover{border-color:var(--primary);color:var(--primary)}',
    '.kb-seg.on{background:var(--primary);border-color:var(--primary);color:#fff;font-weight:600}',
    '.kb-sort{cursor:pointer;user-select:none;white-space:nowrap}',
    '.kb-sort:hover{color:var(--primary)}',
    '.kb-sort.on{color:var(--primary);font-weight:700}',
    '.kb-usage .kb-rec-table{min-width:1080px}',
    /* ---- 科普 / 培训页的视角页签 ---- */
    '.kb-line-tabs{display:flex;gap:2px;margin:0 0 14px;border-bottom:1px solid #e2e8f0}',
    '.kb-line-tab{position:relative;display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;padding:11px 16px;font-size:14px;font-weight:500;color:#5f7285;cursor:pointer;white-space:nowrap;border-radius:6px 6px 0 0}',
    '.kb-line-tab:hover{background:#f4f8fb;color:var(--primary)}',
    '.kb-line-tab.on{color:var(--primary);font-weight:700}',
    '.kb-line-tab.on::after{content:"";position:absolute;left:12px;right:12px;bottom:-1px;height:2px;border-radius:2px;background:var(--primary)}',
    '.kb-line-tab-n{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:19px;padding:0 6px;border-radius:10px;background:#eef2f7;color:#64748b;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}',
    '.kb-line-tab.on .kb-line-tab-n{background:#e3edf7;color:var(--primary)}',
    '.kb-line-tab-n--warn{background:#fdefe2;color:#a1541a}',
    /* ---- 权威内容转载（rp = reprint）---- */
    '.kb-mine-tab-n--warn{background:#fdefe2;color:#a1541a}',
    '.rp-sec-h{margin:22px 0 10px;font-size:14px;font-weight:700;color:#1f2937;display:flex;align-items:baseline;gap:8px}',
    '.rp-sec-h span{font-size:11.5px;color:#94a3b8;font-weight:400}',
    '.rp-mask{position:fixed;inset:0;z-index:1400;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.5)}',
    '.rp-dialog{width:min(1080px,96vw);max-height:94vh;display:flex;flex-direction:column;background:#fff;border-radius:10px;box-shadow:0 18px 50px rgba(15,23,42,.28)}',
    /* 批量模式有 7 列表格，需要更宽 */
    '.rp-dialog--wide{width:min(1280px,96vw)}',
    '.rp-hd{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px 24px;border-bottom:1px solid var(--border,#dfe5ec)}',
    '.rp-hd .t{font-size:16px;font-weight:700;color:#1f2937}',
    '.rp-hd .sub{font-size:12px;color:#64748b;font-weight:400;margin-left:10px}',
    '.rp-x{width:28px;height:28px;border:0;border-radius:5px;background:#f2f4f7;color:#667085;font-size:16px;cursor:pointer}',
    '.rp-bd{padding:20px 24px 22px;overflow:auto;flex:1}',
    '.rp-ft{display:flex;justify-content:flex-end;align-items:center;gap:10px;padding:14px 24px;border-top:1px solid var(--border,#dfe5ec);background:#fbfcfe;flex-wrap:wrap}',
    '.rp-ft .rp-ft-l{margin-right:auto;font-size:12px;color:#64748b}',
    '.rp-ft .rp-ft-l b{color:#244765}',
    '.rp-step{display:flex;flex-direction:column;gap:10px;padding:16px 18px;border:1px solid #e3e9f0;border-radius:8px;margin-bottom:12px;background:#fff}',
    '.rp-step-hd{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#244765}',
    '.rp-step-hd i{width:20px;height:20px;border-radius:50%;background:#244765;color:#fff;font-style:normal;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}',
    '.rp-step-hd em{font-style:normal;font-size:11.5px;color:#94a3b8;font-weight:400}',
    '.rp-input-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.rp-input{flex:1 1 520px;min-width:0;height:38px;border:1px solid #d1d8e0;border-radius:6px;padding:0 10px;font-size:13px;font-family:inherit}',
    '.rp-input:focus{outline:2px solid #b9e0e2;border-color:#168a94}',
    '.rp-area{width:100%;box-sizing:border-box;min-height:130px;border:1px solid #d1d8e0;border-radius:6px;padding:10px;font-size:13px;line-height:1.7;font-family:inherit;resize:vertical}',
    '.rp-chip{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:12px;font-size:12px;font-weight:600;background:#eef2f7;color:#475569}',
    '.rp-chip.ok{background:#e8f6ee;color:#15803d}.rp-chip.bad{background:#fdecee;color:#b42335}.rp-chip.warn{background:#fdefe2;color:#a1541a}',
    '.rp-src{border:1px solid #dbe6f5;border-radius:8px;background:#f6f9ff;padding:10px 12px}',
    '.rp-src-row{display:flex;gap:8px;font-size:12.5px;line-height:1.8;color:#334155}',
    '.rp-src-row b{flex:0 0 62px;color:#64748b;font-weight:600}',
    '.rp-src-row span{min-width:0;word-break:break-all}',
    '.rp-rules{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}',
    '.rp-picks{display:flex;gap:8px;flex-wrap:wrap}',
    '.rp-picks button{border:1px solid #d1d8e0;background:#fff;color:#475569;border-radius:999px;padding:6px 14px;font-size:12.5px;cursor:pointer;line-height:1.5}',
    '.rp-picks button.on{background:#244765;border-color:#244765;color:#fff}',
    '.rp-picks button.low{border-color:#e0a86b;box-shadow:0 0 0 2px #fdefe2}',
    '.rp-picks button.low.on{box-shadow:none;background:#a1541a;border-color:#a1541a}',
    '.rp-field{display:grid;grid-template-columns:88px 1fr;gap:12px 16px;align-items:start;font-size:13.5px;margin-bottom:20px}',
    '.rp-field:last-child{margin-bottom:0}',
    '.rp-field--wide .k{grid-column:1}.rp-field--wide .v{grid-column:2}',
    /* 标签列：顶对齐 + 固定宽，「原文链接」四个字不换行 */
    '.rp-field > .k{color:#5b6673;font-weight:600;padding-top:8px;font-size:12.5px;white-space:nowrap}',
    '.rp-field > .v{min-width:0}',
    /* 输入类控件统一 34px 高，选项 chip 28px——两者视觉重量才一致 */
    /* 输入框在 .rp-field 里是普通块级子元素（不是 flex 子项），必须显式 width:100%，
       否则回落到浏览器默认的 169px，字段看着像被截断 */
    '.rp-field input.rp-input{height:38px;width:100%;box-sizing:border-box;flex:0 0 auto}',
    '.rp-block--link .rp-input{height:36px}',
    '.rp-picks button{height:28px;line-height:26px;padding:0 12px;font-size:12.5px}',
    /* 自定义值：跟在点选区下面一行，输入框短、不和正式字段抢注意力 */
    '.rp-custom{display:flex;gap:6px;align-items:center;margin-top:7px;max-width:320px}',
    '.rp-custom-in.rp-input{flex:1 1 auto;width:auto;height:28px!important;font-size:12.5px;padding:0 8px}',
    '.rp-custom .btn{flex:0 0 auto;height:28px}',
    '.rp-inline{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px}',
    '.rp-hint{font-size:11.5px;color:#94a3b8;line-height:1.5}',
    '.rp-more{margin:2px 0 12px;padding-left:88px;font-size:12.5px}',
    '.rp-more summary{cursor:pointer;color:#5b6673;user-select:none;padding:5px 0;list-style:none;display:inline-flex;align-items:center;gap:5px}',
    '.rp-more summary::-webkit-details-marker{display:none}',
    '.rp-more summary::before{content:"▸";font-size:10px;color:#94a3b8;transition:transform .15s}',
    '.rp-more[open] summary::before{transform:rotate(90deg)}',
    '.rp-more summary:hover{color:var(--primary)}',
    '.rp-more textarea{margin-top:8px;min-height:96px}',
    '.rp-foot-line{display:flex;align-items:center;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:12.5px;color:#334155}',
    '.rp-foot-line label{display:inline-flex;align-items:center;gap:6px;cursor:pointer}',
    /* 链接输入块：独占一行，视觉上像"输入来源"而不是又一个字段。
       选择器必须写成 .rp-block.rp-block--link：单类 .rp-block--link 与 .rp-block 同权重，
       而 .rp-block{display:flex} 在后面，会把这里的 display:block 覆盖掉。 */
    '.rp-block.rp-block--link{display:block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-bottom:16px}',
    '.rp-link-row{display:flex;gap:8px;align-items:center}',
    '.rp-link-row .rp-input{flex:1;min-width:0;background:#fff}',
    /* 两列并排（标题 / 来源） */
    '.rp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}',
    '.rp-grid2 .rp-field{margin-bottom:14px}',
    '@media(max-width:640px){.rp-grid2{grid-template-columns:1fr}}',
    '.rp-low{display:inline-flex;align-items:center;gap:4px;margin-left:6px;font-size:11px;color:#a1541a;background:#fdefe2;border-radius:4px;padding:1px 6px;font-weight:600}',
    '.rp-note{font-size:11.5px;color:#94a3b8;line-height:1.6}',
    '.rp-none{border:1px dashed #cfdae6;border-radius:8px;padding:18px;text-align:center;font-size:12.5px;color:#7d8fa3;background:#fbfcfe}',
    /* ---- 转载专区：区块头 / 表格列宽 ---- */
    /* 区块头：标题 + 计数 + 说明一行，替掉裸 h3 */
    '.rp-zone-hd{display:flex;align-items:flex-end;gap:10px;margin:22px 0 10px;padding-bottom:8px;border-bottom:2px solid #244765}',
    '.rp-zone-hd h3{margin:0;font-size:15px;font-weight:700;color:#17233a;letter-spacing:.2px}',
    '.rp-zone-hd .n{font-size:12px;color:#64748b;font-weight:500}',
    '.rp-zone-hd .tip{margin-left:auto;font-size:11.5px;color:#94a3b8}',
    /* 官方清单折叠块：日常是来看已转载的，进货口收起来；展开后是一张表。
       以前清单独占一个页面，为了「进货」这件事在侧导航里多一条菜单，代价太大。 */
    '.rp-feedbox{margin:18px 0 4px;border:1px solid #e3e9f0;border-radius:8px;background:#fff;overflow:hidden}',
    '.rp-feedbox>summary{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;list-style:none;background:#f8fafc;font-size:13px;color:#244765}',
    '.rp-feedbox>summary::-webkit-details-marker{display:none}',
    '.rp-feedbox>summary::before{content:"▸";color:#94a3b8;font-size:11px;transition:transform .15s}',
    '.rp-feedbox[open]>summary::before{transform:rotate(90deg)}',
    '.rp-feedbox>summary:hover{background:#f2f7fb}',
    '.rp-feedbox>summary>b{font-size:13.5px;font-weight:700}',
    '.rp-feedbox>summary .n{font-size:12px;color:#64748b;font-weight:400}',
    '.rp-feedbox>summary .tip{margin-left:auto;font-size:11.5px;color:#94a3b8;font-weight:400}',
    '.rp-feedbox-bd .table-wrap{border:0;border-radius:0}',
    /* 官方清单表：列宽固定，避免"来源"列被标题挤没 */
    '.rp-feed-table{min-width:960px}',
    '.rp-feed-table th:nth-child(1),.rp-feed-table td:nth-child(1){width:38%;min-width:280px;white-space:normal;line-height:1.5;padding-top:9px;padding-bottom:9px}',
    '.rp-feed-table th:nth-child(2),.rp-feed-table td:nth-child(2){width:15%;white-space:normal;line-height:1.5;padding-top:9px;padding-bottom:9px}',
    '.rp-feed-table th:nth-child(3),.rp-feed-table td:nth-child(3){width:10%;color:#64748b}',
    '.rp-feed-table th:nth-child(4),.rp-feed-table td:nth-child(4){width:8%;color:#64748b}',
    '.rp-feed-table th:nth-child(5),.rp-feed-table td:nth-child(5){width:10%;color:#64748b}',
    '.rp-feed-table th:nth-child(6),.rp-feed-table td:nth-child(6){width:11%;color:#64748b}',
    '.rp-feed-table th:nth-child(7),.rp-feed-table td:nth-child(7){width:8%;text-align:right}',
    '.rp-feed-table td.ops{text-align:right;white-space:nowrap}',
    '.rp-feed-table .ops .btn{margin-left:6px}',
    '.rp-feed-table tr:hover td{background:#f8fafc}',
    '.rp-feed-table .ttl{font-weight:600;color:#1f2937}',
    '.rp-feed-table .ttl .sub{display:block;font-weight:400;font-size:11.5px;color:#94a3b8;margin-top:2px}',
    /* 行高统一：标题长时换行，行高跟着长，但单元格上下留白一致，不能一行紧一行松 */
    '.rp-feed-table td{padding-top:10px;padding-bottom:10px;vertical-align:middle}',
    '.rp-feed-table td:first-child{vertical-align:top;padding-top:11px;padding-bottom:11px}',
    /* 状态徽章统一 */
    '.rp-st{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 8px;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap}',
    '.rp-st--on{background:#e8f6ee;color:#15803d}',
    '.rp-st--off{background:#eef2f7;color:#64748b}',
    '.rp-st--warn{background:#fdefe2;color:#a1541a}',
    '.rp-st--info{background:#eaf2fc;color:#244765}',
    '.rp-radio{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:#334155}',
    '.rp-radio label{display:inline-flex;align-items:center;gap:6px;cursor:pointer}',
    '.rp-block{display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;border-radius:6px;font-size:12.5px;line-height:1.6;margin-bottom:10px}',
    /* 带说明文字的提示块要左对齐：居中 + flex 会把句子拆成几段竖排，读起来断句错乱 */
    '.rp-block--doc{display:block;text-align:left}',
    '.rp-block.bad{background:#fdecee;color:#b42335;border:1px solid #f6cdd3}',
    '.rp-block.warn{background:#fdefe2;color:#a1541a;border:1px solid #f3d9bd}',
    '.rp-table td,.rp-table th{white-space:nowrap}',
    '.rp-table td.rp-t{white-space:normal;min-width:260px;max-width:420px}',
    '.rp-table .rp-sub{display:block;font-size:11px;color:#94a3b8;margin-top:2px;white-space:normal}',
    '.rp-table select{height:28px;border:1px solid #d1d8e0;border-radius:4px;font-size:12px;padding:0 6px;max-width:180px;background:#fff}',
    '.rp-table tr.rp-off td{background:#fffbf7}',
    '.rp-src-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}',
    '.rp-src-card{border:1px solid var(--border);border-radius:8px;background:#fff;overflow:hidden;display:flex;flex-direction:column}',
    '.rp-src-card-hd{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid #eef2f7;background:#f8fafc}',
    '.rp-src-card-hd b{font-size:13px;color:#1f2937}',
    '.rp-src-card-hd span{font-size:11.5px;color:#94a3b8}',
    '.rp-src-card-hd .rp-chip{margin-left:auto}',
    '.rp-src-item{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-bottom:1px solid #f2f5f9}',
    '.rp-src-item:last-child{border-bottom:0}',
    '.rp-src-item .m{flex:1;min-width:0}',
    '.rp-src-item .m b{display:block;font-size:12.5px;color:#1f2937;line-height:1.5;font-weight:600}',
    '.rp-src-item .m span{display:block;font-size:11px;color:#94a3b8;margin-top:3px}',
    '.rp-src-item .ops{display:flex;gap:6px;flex:0 0 auto}',
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.id = 'kb-module-styles';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
  /* 详情页样式在 kb-detail.css：必须有它，详情页才成页面；缺了也不崩，只是退回无样式 */
  if (!document.getElementById('kb-detail-css')) {
    var detailCss = document.createElement('link');
    detailCss.id = 'kb-detail-css'; detailCss.rel = 'stylesheet'; detailCss.href = 'kb-detail.css?v=20261025d';
    document.head.appendChild(detailCss);
  }

  /* ================= 工具 ================= */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function val(id) { var e = $(id); return e ? String(e.value).trim() : ''; }
  function say(msg, type) { if (window.toast) { window.toast(msg, type); } else { window.alert(msg); } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function nowStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function today() { return nowStr().slice(0, 10); }
  var SEQ = 3000;
  function nextId(p) { SEQ += 1; return p + SEQ; }
  function nextKbHId() { var seq = nextId(''); return 'KB-H-' + seq.slice(-4); } // 生成院内编号：KB-H-3001..
  function find(list, id) { for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; } return null; }
  function log(by, action, target) { KB.logs.unshift({ id: nextId('LOG-'), by: by, action: action, target: target, time: nowStr() }); }

  /* 状态色 */
  var STATUS_CLS = { '启用': 'ok', '停用': 'muted' };
  function stBadge(s) { return '<span class="badge badge-' + (STATUS_CLS[s] || 'neutral') + '">' + esc(s) + '</span>'; }

  /* ================= 账号 =================
     原型没有登录态：当前账号由顶栏身份切换（app.html 的 wbRoleDefs）派生，org 与之一一对应。
     「我的收藏 / 我的下载 / 我的上传」与「使用统计」全部按账号落账，所以账号必须是活的，
     不能再写死一个人——否则所有行为都记在同一个人头上，统计出来只有一个账号。

     ME 用 getter 而不是普通对象：文件里 19 处 ME.name、4 处 ME.org 都靠属性访问，
     改成 getter 后这些调用点一行都不用动，身份却跟着顶栏走。 */
  var KB_USERS = [
    /* id / 账号 / 姓名 / 机构 / 所属市 / 科室 / 角色 / 数据范围
       org 必须与 app.html 的 wbRoleDefs 各条 org 完全一致，currentUser() 才能对上。
       city 是 scope='city' 的收窄依据：市级登记处要看全市账号，不只自己那一个机构。 */
    { id: 'U-101', account: 'admin', name: '超级管理员', org: '江西省肿瘤登记中心', city: '省级', dept: '信息中心', role: 'admin', scope: 'province', status: '启用' },
    { id: 'U-102', account: 'lidoctor', name: '李医生', org: '南昌市东湖区登记处', city: '南昌市', dept: '肿瘤登记科', role: 'registry', scope: 'city', status: '启用' },
    { id: 'U-103', account: 'zhangsan', name: '张三', org: '南昌市登记处', city: '南昌市', dept: '肿瘤登记科', role: 'registry', scope: 'city', status: '启用' },
    { id: 'U-104', account: 'wangwu', name: '王五', org: '南昌大学第一附属医院', city: '南昌市', dept: '肿瘤科', role: 'hospital', scope: 'org', status: '启用' },
    { id: 'U-105', account: 'zhaoliu', name: '赵六', org: '系统治理', city: '省级', dept: '运维', role: 'admin', scope: 'province', status: '启用' },
    { id: 'U-106', account: 'lisi', name: '李四', org: '赣州市疾控中心', city: '赣州市', dept: '慢病科', role: 'registry', scope: 'city', status: '启用' },
    { id: 'U-107', account: 'sunqi', name: '孙七', org: '九江市第一人民医院', city: '九江市', dept: '肿瘤科', role: 'hospital', scope: 'org', status: '启用' },
    { id: 'U-108', account: 'zhouba', name: '周八', org: '上饶市中心医院', city: '上饶市', dept: '病案室', role: 'hospital', scope: 'org', status: '停用' }
  ];
  function findUser(id) { for (var i = 0; i < KB_USERS.length; i++) { if (KB_USERS[i].id === id) return KB_USERS[i]; } return null; }
  function userByOrg(org) { for (var i = 0; i < KB_USERS.length; i++) { if (KB_USERS[i].org === org) return KB_USERS[i]; } return null; }
  /* 上传人 / 上传机构（展示名）。
     内容只在 assets 里存 createdBy（账号 id），姓名与机构名在渲染时按 id 现取：
     改账号资料（换科室、调机构）时，历史内容上的归属跟着变，而不是冻结成一个当初的快照。
     取不到账号（账号被删）时才退回内容自身的 org。转载件「转载经手人」同理走 reprintedBy。 */
  function uploaderOf(a) {
    var u = a && findUser(isReprint(a) && a.reprintedBy ? a.reprintedBy : a.createdBy);
    return u ? u.name : (a && a.uploader) || '';
  }
  function uploaderOrgOf(a) {
    var u = a && findUser(isReprint(a) && a.reprintedBy ? a.reprintedBy : a.createdBy);
    return u ? u.org : ((a && a.org) || '');
  }
  function uploaderTimeOf(a) { return isReprint(a) ? (a.reprintedAt || a.createdAt || '') : (a.createdAt || ''); }
  /* 当前账号：顶栏身份 → 同 org 的账号；顶栏不可用（脚本先于 app.html 初始化）时回落默认账号 */
  function currentUser() {
    if (window.wbRoleDef) {
      try {
        var d = window.wbRoleDef();
        if (d && d.org) { var u = userByOrg(d.org); if (u) return u; }
      } catch (e) { }
    }
    return KB_USERS[1];
  }
  var ME = {
    get id() { return currentUser().id; },
    get account() { return currentUser().account; },
    get name() { return currentUser().name; },
    get org() { return currentUser().org; },
    get role() { return currentUser().role; },
    get scope() { return currentUser().scope; }
  };

  /* ================= 字典（分类维护页管理的四类字典） =================
     项结构对齐全站字典管理：{code, name, sort, status, remark}，status 只有 启用/禁用 */
  function d(code, name, sort, status, remark) {
    return { code: code, name: name, sort: sort, status: status || '启用', remark: remark || '' };
  }
  var DICT_TYPES = [
    { v: 'sites', t: '病种', prefix: 'SITE' },
    { v: 'scenes', t: '使用场景', prefix: 'SCENE' },
    { v: 'tags', t: '标签', prefix: 'TAG' },
    { v: 'kinds', t: '内容形式', prefix: 'KIND' },
    /* 官方来源白名单：remark 存 host（逗号分隔），转载通道只认这里 */
    { v: 'srcs', t: '官方来源', prefix: 'SRC' }
  ];
  var DICT = {
    sites: [
      d('C34', '肺', 1), d('C50', '乳腺', 2), d('C16', '结直肠', 3), d('C22', '肝', 4), d('C16.1', '胃', 5),
      d('C15', '食管', 6), d('C53', '宫颈', 7), d('C61', '前列腺', 8), d('ALL', '通用', 9, '启用', '不区分病种的通用材料')
    ],
    scenes: [
      d('S01', '随访宣教', 1), d('S02', '报告解读', 2), d('S03', '候诊播放', 3), d('S04', '公众号推文', 4),
      d('S05', '入院宣教', 5), d('S06', '编码答疑', 6), d('S07', '上岗培训', 7), d('S08', '填报规范', 8)
    ],
    tags: [
      d('T01', '随访', 1), d('T02', '复查', 2), d('T03', '饮食', 3), d('T04', '化疗', 4), d('T05', '放疗', 5),
      d('T06', '疼痛', 6), d('T07', '疫苗', 7), d('T08', '筛查', 8), d('T09', '编码', 9), d('T10', '报告卡', 10),
      d('T11', '重卡', 11), d('T12', '上报', 12), d('T13', '接口', 13)
    ],
    kinds: [
      d('K01', '文章', 1, '启用', '单篇长文：段落 / 小标题 / 列表，富文本编辑'),
      d('K02', '视频', 2),
      d('K04', '课件', 4), d('K05', '操作手册', 5), d('K06', '宣传折页', 6),
      d('K07', '图文', 7, '启用', '一段正文 + 一组图：小红书 / 九图科普那种')
    ],
    /* 官方来源白名单：转载通道只认这里的 host。为什么不按标题判：标题里写「国家癌症中心」的
       山寨公众号一大把，只有域名骗不了人。host 存在 remark 里（英文），与全站字典同构，
       增删改、启停、引用保护全部白送。 */
    srcs: [
      d('SRC01', '国家卫生健康委', 1, '启用', 'www.nhc.gov.cn,nhc.gov.cn'),
      d('SRC02', '国家癌症中心', 2, '启用', 'www.ncc-cn.org.cn,ncc-cn.org.cn'),
      d('SRC03', '中国疾控中心', 3, '启用', 'www.chinacdc.cn,chinacdc.cn'),
      d('SRC04', '江西省卫生健康委', 4, '启用', 'hc.jiangxi.gov.cn,wjw.jiangxi.gov.cn'),
      /* 没有「国家基本公共卫生服务项目」独立域：该项目信息经国家卫健委官网发布（SRC01 覆盖）。
         之前填的 www.nhs.gov.cn 是英国 NHS 的域名——白名单是安全边界，错一个域就等于放行了错站。 */
      d('SRC05', '中华医学会', 5, '启用', 'www.cma.org.cn'),
      d('SRC06', '江西省肿瘤登记中心', 6, '启用', 'www.jxzlyy.com')
    ]
  };
  /* ================= 受众（按内容线分两套） =================
     科普是发给患者和家属看的：按人群细分——老年、儿童、孕妇/哺乳期、慢病共病，
     再按「谁来用」分本人 / 家属 / 照护者 / 社区医生（后者是转述给患者听的）。
     培训是发给做登记工作的人看的：按岗位细分——登记员、编码员、临床/病案人员。
     原来两线共用一套「患者及家属 / 登记人员 / 临床医生 / 基层公卫」：
     科普侧没有老年、儿童、孕妇这些真正用得上的切分，培训侧又把「患者及家属」混在一个框里。
     取值仍以字符串存在审计用的 audiences 里，编辑时按两条线的并集匹配，老数据不会丢。 */
  var AUDIENCES = {
    '科普': ['老年人', '儿童青少年', '孕妇及哺乳期', '慢病共病患者', '普通人群', '患者本人', '家属 / 照护者', '社区医生 / 村医'],
    '培训': ['登记员 / 报告卡录入', '编码员 / 病案人员', '临床医生 / 护士', '基层公卫人员', '登记处管理人员', 'IT / 接口对接人员'],
    /* 旧术语：只用于表单开关 / 批量导入 / 存量回填的匹配，不再出现在新建表单里 */
    LEGACY: ['患者及家属', '登记人员', '基层公卫', '临床医生']
  };
  /* 某条内容线可选的受众；track 为空时给两条线的并集（批量导入等场景不知道内容线） */
  function audienceOptions(track) {
    if (track === '科普' || track === '培训') return AUDIENCES[track].slice();
    return AUDIENCES['科普'].concat(AUDIENCES['培训']);
  }
  /* 该内容线的默认受众。新增表单与转载表单都用它，
     两处各写一份默认值就会出现「新增默认 2 个、转载默认 0 个」的不一致。 */
  function defaultAudiences(track) {
    return track === '培训' ? ['登记员 / 报告卡录入'] : ['患者本人', '家属 / 照护者'];
  }
  /* 启用的项名（检索条件与新建表单的下拉/点选只认启用项） */
  function dictNames(dim) {
    return (DICT[dim] || []).filter(function (x) { return x.status === '启用'; })
      .slice().sort(function (a, b) { return a.sort - b.sort; }).map(function (x) { return x.name; });
  }
  function dictTypeMeta(dim) { for (var i = 0; i < DICT_TYPES.length; i++) { if (DICT_TYPES[i].v === dim) return DICT_TYPES[i]; } return { v: dim, t: dim, prefix: 'X' }; }

  /* ================= 数据 ================= */
  var KB = {
    me: ME,
    users: KB_USERS,
    dict: DICT,
    assets: [],
    logs: [],
    tab: 'sci',
    filters: {},
    pageNo: {},
    /* 内容库 / 转载专区的排序状态，按内容线各记一份：{ key, dir }。
       key = pub（默认：上架优先 + 发布日期倒序）/ dl（下载量）/ fav（收藏量）/ up（上传时间）。
       切换排序时关联的页码要一起归零，否则会停在高序号页上看着像「没有结果」。 */
    sort: {},
    mineView: 'fav',  /* 我的内容页内切换：fav 我的收藏 / download 我的下载 / upload 我的上传 */
    usageSt: null     /* 使用统计页筛选状态 */
  };
  window.KB = KB;
  /* 富文本编辑器的对外入口：社区主帖的正文要用同一套编辑器（同一形制、同一套粘贴清洗），
     不再给社区单独写一个 textarea。绑定事件必须调 bindRte()——richBox 只出静态 HTML。 */
  KB.richBox = richBox;
  KB.bindRte = bindRte;
  KB.rteHtml = function (id) {
    var el = document.getElementById(id);
    if (!el) return '';
    return String(el.innerHTML || '').trim();
  };

  /* ---------- 种子：科普 5 条（迁自旧 DB.edu）+ 院内 2 条 ---------- */
  KB.assets = [
    {
      id: 'KB-P-0001', track: '科普', kind: '文章', title: '肺结节随访指南：多大需要复查？',
      summary: '按结节大小与密度给出复查间隔建议，帮助体检人群正确看待肺结节。',
      body: '<h2>肺结节大多是良性的</h2><p>肺结节绝大多数为良性。一般小于 6mm 建议年度复查；6-8mm 建议 6-12 个月复查；大于 8mm 需 3 个月内复查并结合临床评估。</p><h3>就诊提示</h3><p>具体复查间隔请以胸外科或呼吸科主治医生意见为准。</p>',
      sites: ['肺'], scenes: ['报告解读', '随访宣教'], tags: ['随访', '复查'], audiences: ['普通人群', '患者本人'],
      lib: '省库', org: '江西省肿瘤登记中心', 
      status: '启用', publishedAt: '2026-08-20',
      evidence: '《肺结节诊治中国专家共识（2024 年版）》', attachments: [{ name: '肺结节随访间隔对照表.pdf', size: '216 KB' }],
      note: '按 2024 版共识调整 8mm 以上复查间隔'
    },
    {
      id: 'KB-P-0002', track: '科普', kind: '文章', title: '化疗后白细胞下降的饮食与防护',
      summary: '骨髓抑制期的营养支持与感染防护要点。',
      body: '<p>保证足量优质蛋白，食物彻底加热，避免生冷；外出佩戴口罩，勤洗手，减少去人群密集场所。</p><h3>什么时候要就诊</h3><p>体温超过 38℃ 或持续乏力加重，请立即联系主治医生。</p>',
      sites: ['通用'], scenes: ['随访宣教', '公众号推文'], tags: ['化疗', '饮食'], audiences: ['患者本人', '家属 / 照护者'],
      lib: '省库', org: '江西省肿瘤登记中心', 
      status: '启用', publishedAt: '2026-08-18',
      evidence: '《肿瘤患者化疗期间营养与感染防护专家共识（2024）》', attachments: [], note: ''
    },
    {
      id: 'KB-P-0003', track: '科普', kind: '视频', title: '放疗期间皮肤护理 5 要点',
      summary: '放射性皮肤反应的居家护理示范视频（时长 4 分 10 秒）。',
      body: '<p>保持清洁干燥、穿柔软棉质衣物、避免暴晒与摩擦、不自行涂抹刺激性药膏、及时告知放疗科医生。</p>',
      sites: ['通用'], scenes: ['候诊播放', '随访宣教'], tags: ['放疗'], audiences: ['患者本人', '家属 / 照护者'],
      lib: '省库', org: '江西省肿瘤登记中心', 
      status: '启用', publishedAt: '2025-08-15',
      evidence: '《肿瘤放射治疗护理规范》', attachments: [{ name: '放疗皮肤护理示范.mp4', size: '48.2 MB' }], note: ''
    },
    {
      id: 'KB-P-0004', track: '科普', kind: '文章', title: '乳腺癌术后可以接种流感疫苗吗？',
      summary: '术后患者接种灭活疫苗的注意事项问答。',
      body: '<p><b>问：</b>乳腺癌术后两年，能打流感疫苗吗？</p><p><b>答：</b>病情稳定、化疗结束 3 个月以上且免疫功能恢复者，通常可接种灭活疫苗；减毒活疫苗需先评估。接种前请咨询主治医生。</p>',
      sites: ['乳腺'], scenes: ['随访宣教', '公众号推文'], tags: ['疫苗', '复查'], audiences: ['患者本人', '家属 / 照护者', '老年人'],
      lib: '省库', org: '江西省肿瘤登记中心', 
      status: '停用', publishedAt: '',
      evidence: '《中国肿瘤患者疫苗接种专家共识》', attachments: [], note: ''
    },
    {
      id: 'KB-P-0005', track: '科普', kind: '文章', title: '癌痛规范化用药：会不会成瘾？',
      summary: '澄清癌痛治疗中最常见的用药误区。',
      body: '<p>在规范剂量与医嘱下使用阿片类药物治疗癌痛，成瘾发生率极低，不应因恐惧成瘾而忍痛。</p>',
      sites: ['通用'], scenes: ['随访宣教'], tags: ['疼痛'], audiences: ['患者本人', '家属 / 照护者', '老年人'],
      lib: '省库', org: '江西省肿瘤登记中心', 
      status: '停用', publishedAt: '',
      evidence: '', attachments: [], note: ''
    },
    {
      id: 'KB-H-0101', track: '科普', kind: '宣传折页', title: '复查别忘带这三样（本院版）',
      summary: '本院复查流程须知折页，含挂号窗口与影像科位置。',
      body: '<p>复查请携带：既往病理报告、影像胶片、医保卡。</p><h3>本院流程</h3><p>1) 门诊 3 号楼 2 层自助机取号；2) 影像科 4 层；3) 结果当日回诊室。咨询电话 0791-88600000。</p>',
      sites: ['通用'], scenes: ['入院宣教', '随访宣教'], tags: ['复查', '随访'], audiences: ['患者本人', '家属 / 照护者'],
      lib: '院内', org: '南昌大学第一附属医院',
      status: '启用', publishedAt: '2026-09-02',
      evidence: '院内门诊流程（2026 版）', attachments: [{ name: '复查须知折页.ai', size: '3.1 MB' }],
      note: '增加本院位置与咨询电话'
    },
    {
      id: 'KB-H-0102', track: '培训', kind: '操作手册', title: '本院报告卡退回复报操作指引',
      summary: '针对本院被退回报告卡的处置流程说明。',
      body: '<p>退回卡片须在 5 个工作日内处理：核对退回原因 → 修正字段 → 重新提交。</p>',
      sites: ['通用'], scenes: ['填报规范', '编码答疑'], tags: ['报告卡', '上报'], audiences: ['登记员 / 报告卡录入'],
      lib: '院内', org: '南昌大学第一附属医院',
      status: '停用', publishedAt: '',
      evidence: '', attachments: [], note: ''
    }
  ];

  /* ---------- 种子：培训 14 条（收编自 app.html 首页 wbNewsData 的 common/train/tech） ---------- */
  var TRAIN_SEED = [
    /* 原 common：高频业务问答 6 条 */
    { id: 'KB-T-0001', title: 'ICD10 编码为何显示为空？', kind: '文章', tags: ['编码'],
      body: '<h2>ICD10 编码为何显示为空？</h2><p>ICD-10 编码为空通常由以下原因造成：</p><ol><li>报告卡已填写诊断名称但未点击「自动编码」按钮；</li><li>诊断名称包含特殊字符或不规范用语，系统无法匹配编码库；</li><li>编码表（ICD-10 国标版）未更新到最新版本。</li></ol><h3>处理建议</h3><p>1) 在诊断字段中输入规范医学术语后点击「自动编码」；<br>2) 若仍为空，可手动从编码下拉中选择或联系编码维护员补录；<br>3) 定期同步国家癌症中心发布的 ICD-10 编码表。</p>',
      scenes: ['编码答疑'], publishedAt: '2026-08-12', evidence: '国家癌症中心 ICD-10 编码表（2026 同步版）',
      aud: ['编码员 / 病案人员', '登记员 / 报告卡录入'] },
    { id: 'KB-T-0002', title: '如何判断并处理疑似重卡？', kind: '文章', tags: ['重卡'],
      body: '<h2>如何判断并处理疑似重卡？</h2><p>系统通过「身份证号 + 姓名 + 性别」三要素自动识别疑似重复卡，可能的命中规则：</p><ul><li>完全三要素一致；</li><li>身份证号一致但姓名/性别不一致（疑似录入错误）；</li><li>姓名+性别+出生日期一致但身份证号为空。</li></ul><h3>处理流程</h3><p>进入「质控工作台 → 重卡管理」，逐条对比发病部位、确诊日期、报告单位等信息后选择「合并」「保留主卡」或「作废」并填写处理说明。</p>',
      scenes: ['编码答疑', '填报规范'], publishedAt: '2026-08-10', evidence: '重卡管理模块分析报告',
      aud: ['登记员 / 报告卡录入', '登记处管理人员'] },
    { id: 'KB-T-0003', title: '被退回的报告卡如何修改并重新提交？', kind: '文章', tags: ['报告卡', '上报'],
      body: '<h2>被退回的报告卡如何修改并重新提交？</h2><p>报告卡被退回后，可在「报告卡管理 → 待处理」列表中查看退回原因。处理步骤：</p><ol><li>点击卡片查看审核员填写的退回说明；</li><li>根据说明修改对应字段（常见：身份证号、地址、ICD 编码、确诊日期）；</li><li>点击「重新提交」进入下一级审核流程；</li><li>若对退回原因有异议，可通过「申诉」通道提交说明。</li></ol>',
      scenes: ['填报规范'], publishedAt: '2026-08-06', evidence: '《江西省肿瘤登记报告卡审核退回处理规范（2026）》',
      aud: ['登记员 / 报告卡录入'] },
    { id: 'KB-T-0004', title: '随访任务逾期未完成如何处理？', kind: '文章', tags: ['随访'],
      body: '<h2>随访任务逾期未完成如何处理？</h2><p>随访任务逾期常见原因：患者失联、患者已迁出辖区、家属拒绝随访等。处理建议：</p><ul><li>优先通过电话、短信、家属联系等多种方式尝试联系；</li><li>若连续 3 次无法联系，标记为「失访」并填写失访原因；</li><li>迁出辖区的患者，转出到新辖区登记处；</li><li>确属死亡的，联动「死亡信息」模块补录死亡资料。</li></ul>',
      scenes: ['填报规范'], publishedAt: '2026-07-28', evidence: '随访结局管理需求文档',
      aud: ['登记员 / 报告卡录入', '基层公卫人员'] },
    { id: 'KB-T-0005', title: '确诊日期与报告日期逻辑校验规则说明', kind: '文章', tags: ['报告卡'],
      body: '<h2>确诊日期与报告日期逻辑校验规则说明</h2><p>系统强制约束：确诊日期 ≤ 报告日期 ≤ 当前日期。三者关系必须符合时间先后顺序。</p><h3>常见错误情形</h3><ul><li>补报卡确诊日期晚于报告日期；</li><li>录入年份错误（手误将 2025 写成 2026）；</li><li>使用病理报告签发日期而非病理确诊日期。</li></ul><h3>处理建议</h3><p>以病历/病理报告上的「确诊日期」字段为准，修正后重新校验。</p>',
      scenes: ['编码答疑', '填报规范'], publishedAt: '2026-07-15', evidence: '《报告卡字段逻辑校验规则（2026 版）》',
      aud: ['登记员 / 报告卡录入', '临床医生 / 护士'] },
    { id: 'KB-T-0006', title: '现住址行政区划编码如何查询？', kind: '文章', tags: ['编码'],
      body: '<h2>现住址行政区划编码如何查询？</h2><p>行政区划编码采用国家统计局发布的 12 位统计用区划代码，可在系统中通过以下方式查询：</p><ol><li>在地址输入框逐级选择「省/市/县/乡镇/村」自动回填编码；</li><li>使用快捷搜索：输入乡镇/街道名称关键字；</li><li>从「基础数据 → 区划管理」下载最新区划对照表离线查询。</li></ol><p>注意：编码每年会因区划调整更新，请定期同步。</p>',
      scenes: ['编码答疑'], publishedAt: '2026-07-02', evidence: '国家统计局统计用区划代码',
      aud: ['登记员 / 报告卡录入', '基层公卫人员'] },
    /* 原 train：培训资料 4 条 */
    { id: 'KB-T-0007', title: '2026 肿瘤随访登记操作培训（视频）', kind: '视频', tags: ['随访', '上报'],
      body: '<p>覆盖随访任务列表、批量上传、计划制定与死因证填写的完整操作演示，时长 42 分钟。</p>',
      scenes: ['上岗培训'], publishedAt: '2026-08-10', evidence: '《2026 年全省肿瘤随访登记工作培训教材》', attachments: [{ name: '随访登记操作培训.mp4', size: '1.2 GB' }],
      aud: ['登记员 / 报告卡录入', '基层公卫人员'] },
    { id: 'KB-T-0008', title: '报告卡填报规范 PPT 合集', kind: '课件', tags: ['报告卡'],
      body: '<p>含必填字段口径、常见退回复种、编码规范三部分，可直接用于院内集中学习。</p>',
      scenes: ['上岗培训', '填报规范'], publishedAt: '2026-08-05', evidence: '《肿瘤登记报告卡填报规范（2026）· 江西省实施细则》', attachments: [{ name: '报告卡填报规范.pptx', size: '18.4 MB' }],
      aud: ['登记员 / 报告卡录入', '临床医生 / 护士'] },
    { id: 'KB-T-0009', title: '重卡识别与合并实操演示', kind: '视频', tags: ['重卡'],
      body: '<p>从查重结果列表到合并/保留主卡的逐步演示，含 3 个真实疑难样例。</p>',
      scenes: ['上岗培训'], publishedAt: '2026-07-30', evidence: '《肿瘤登记重卡识别与合并操作细则（2026）》', attachments: [{ name: '重卡合并演示.mp4', size: '620 MB' }],
      aud: ['登记员 / 报告卡录入', '登记处管理人员'] },
    { id: 'KB-T-0010', title: '国家上报门禁校验规则讲解', kind: '课件', tags: ['上报'],
      body: '<p>逐条讲解国家上报平台的字段级校验与拦截规则，附错误码对照。</p>',
      scenes: ['上岗培训', '填报规范'], publishedAt: '2026-07-25', evidence: '国家肿瘤登记上报平台校验说明',
      aud: ['登记员 / 报告卡录入', '登记处管理人员'] },
    /* 原 tech：技术指导 4 条 */
    { id: 'KB-T-0011', title: '医院 HIS 接口对接技术指引 v2.3', kind: '操作手册', tags: ['接口'],
      body: '<p>字段映射表、传输频次、异常重传机制与联调用例。</p>',
      scenes: ['上岗培训'], publishedAt: '2026-08-09', evidence: '《江西省肿瘤登记平台 HIS 接口规范 v2.3》', attachments: [{ name: 'HIS对接指引v2.3.pdf', size: '1.8 MB' }],
      aud: ['IT / 接口对接人员'] },
    { id: 'KB-T-0012', title: '重卡自动合并规则与人工复核说明', kind: '操作手册', tags: ['重卡'],
      body: '<p>自动合并的三档置信度阈值、必须人工复核的情形、回滚方式。</p>',
      scenes: ['编码答疑', '填报规范'], publishedAt: '2026-08-03', evidence: '《重卡自动合并置信度阈值与复核规则（2026）》',
      aud: ['登记处管理人员', '编码员 / 病案人员'] },
    { id: 'KB-T-0013', title: '数据校验引擎错误码对照表', kind: '操作手册', tags: ['上报', '编码'],
      body: '<p>校验引擎全部错误码的含义、触发条件、修正建议一览。</p>',
      scenes: ['编码答疑'], publishedAt: '2026-07-26', evidence: '《数据校验引擎错误码手册（2026）》',
      aud: ['IT / 接口对接人员', '编码员 / 病案人员'] },
    { id: 'KB-T-0014', title: '随访数据上报 API 接入示例', kind: '操作手册', tags: ['接口', '上报'],
      body: '<p>鉴权方式、上报接口入参出参、批量与幂等处理示例代码。</p>',
      scenes: ['上岗培训'], publishedAt: '2026-07-20', evidence: '《江西省肿瘤随访数据上报 API 接入文档 v2》',
      aud: ['IT / 接口对接人员'] }
  ];
  TRAIN_SEED.forEach(function (t) {
    KB.assets.push({
      id: t.id, track: '培训', kind: t.kind, title: t.title,
      summary: String(t.body).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').slice(0, 42) + '…',
      body: t.body, sites: ['通用'], scenes: t.scenes, tags: t.tags, audiences: t.aud || ['登记员 / 报告卡录入', '编码员 / 病案人员'],
      lib: '省库', org: '江西省肿瘤登记中心', 
      status: '启用', publishedAt: t.publishedAt,
      evidence: t.evidence || '', attachments: t.attachments || [], note: ''
    });
  });

  /* ---------- 种子补充：让六种形式都有真内容可看（详情页按形式分版式） ----------
     视频：章节要能对上时间点，所以正文每个 h2 就是一个章节；
     课件：slidesOf() 拿不到 slides 时按 h2/h3 + 段落切页，这里给分页明确的一版；
     手册：h3 小节 + 有序步骤 → 详情页自动渲染成「目录 + 可勾选清单」。 */
  function seedPatch(id, patch) {
    var a = find(KB.assets, id);
    if (!a) return;
    Object.keys(patch).forEach(function (k) { a[k] = patch[k]; });
  }
  seedPatch('KB-P-0003', {
    body: '<h2>保持清洁干燥</h2><p>照射野内皮肤每天用温水轻洗，洗后吸干，不要来回擦拭。洗澡水温不宜过高，避免用力搓洗照射区。</p><h2>穿柔软棉质衣物</h2><p>内衣、衣领选宽松纯棉，减少摩擦与闷汗；照射区皮肤如有破损，先咨询放疗科医生再穿。</p><h2>避免暴晒与摩擦</h2><p>照射野内不要贴膏药、不要用热水袋、不刮痧不按摩；外出打伞，避免阳光直射照射区。</p><h2>不自行涂抹刺激性药膏</h2><p>碘酒、酒精、红汞、风油精都不要涂；皮肤用药一律由放疗科医生开具，不要自行到药店买。</p><h2>出现反应及时告诉医生</h2><p>出现发红、发痒、脱皮、渗液或疼痛加重，当天就要告诉放疗科医生或护士，不要拖到下一次复查。</p>',
    summary: '放射性皮肤反应的居家护理示范视频（时长 4 分 10 秒）。'
  });
  seedPatch('KB-P-0004', {
    body: '<p>接种灭活流感疫苗通常不需要等待，但术后化疗期间免疫状态波动大，<b>接种前请务必先咨询主治医生</b>。</p><p>若已完成化疗且满 3 个月、血常规基本恢复，多数情况下可以接种灭活疫苗。</p><p>正在使用靶向药或内分泌治疗的患者，通常不影响接种灭活疫苗，但仍需主治医生评估。</p><p>减毒活疫苗（如鼻喷流感疫苗）<b>在免疫功能低下者中禁止接种</b>，请改用灭活疫苗。</p><p>注意：接种当天如有发热、正在使用大剂量糖皮质激素或刚刚结束放疗，应推迟接种。</p>'
  });
  seedPatch('KB-T-0008', {
    slides: [
      { cover: 1, title: '报告卡填报规范', sub: '2026 版 · 省肿瘤登记中心收集整理', bullets: ['必填字段口径', '常见退回与复种', '编码规范', '上报前自检清单'], tag: '封面' },
      { title: '一、必填字段口径', bullets: ['患者三要素：姓名、身份证号、性别，缺一不可', '发病部位：写到亚部位，如「肺 · 上叶」', '确诊日期：以病理报告确诊日期为准', '报告日期：以报卡提交日期为准，不得早于确诊日期'], tag: '第一章' },
      { title: '二、常见退回原因', bullets: ['ICD10 编码为空或与病理不符', '身份证号校验位错误（末位 X 未大写）', '住址未细化到乡镇/街道', '重复报卡：已由重卡管理合并，却被再次提交'], tag: '第二章' },
      { title: '三、ICD-10 与 ICD-O-3 编码规范', bullets: ['ICD-10：填写恶性肿瘤类目（C00–C97）', 'ICD-O-3 解剖学部位：4 位编码，如 C34.9', 'ICD-O-3 形态学：形态码 + 行为码，如 8140/3', '编码不确定时，先点「自动编码」，再对照编码库核对'], tag: '第三章' },
      { title: '四、上报前自检清单', bullets: ['五个必填字段是否齐全', '编码是否与病理一致', '日期逻辑是否成立', '是否命中重卡提示并已处理'], tag: '第四章' },
      { title: '小结与答疑', bullets: ['规范不是额外负担，是让退回复报少一半', '院内培训每季度一次，课件会在「培训内容」更新', '填报中遇到的问题，可在「技术指导」里检索', '培训结束后请完成 1 份练习卡'], tag: '小结' }
    ]
  });
  seedPatch('KB-H-0102', {
    body: '<p>被退回的报告卡须在 <b>5 个工作日内</b>处理完毕，逾期将计入本院上报及时率。</p><h3>一、查收退回卡</h3><ol><li>登录后进入「报告卡管理 › 上报数据管理」。</li><li>筛选「审核状态 = 退回」，按退回日期由早到晚处理。</li><li>点开卡片查看审核员填写的退回说明，逐条记下要改的字段。</li></ol><h3>二、核对退回原因</h3><ol><li>常见退回原因：身份证号校验位错误、ICD10 为空、确诊日期晚于报告日期。</li><li>先核对原始病历与病理报告，不以系统提示为准盲目修改。</li><li>对退回原因有异议时，点「申诉」并附病理报告截图。</li></ol><h3>三、修正字段并重新提交</h3><ol><li>在卡片编辑页修正对应字段，保存前先点「校验」。</li><li>校验通过后点「重新提交」，卡片进入上一级审核队列。</li><li>同一张卡当天不要重复提交两次，避免生成新的重卡。</li></ol><h3>四、确认处理结果</h3><ol><li>重新提交后 2 个工作日内回到「上报数据管理」确认审核通过。</li><li>仍被退回的卡，按第二次退回说明处理，并在院内登记本轮复核人。</li></ol>',
    evidence: '院内报告卡退回复报流程（2026-08 修订）',
    scenes: ['填报规范', '编码答疑']
  });
  var deepVid = KB.assets.filter(function (x) { return x.track === '培训' && x.kind === '视频' && x.id === 'KB-T-0007'; })[0];
  if (deepVid) {
    seedPatch('KB-T-0007', {
      body: '<h2>随访任务列表与筛选</h2><p>登录后从左侧「随访管理 › 随访任务」进入。默认按「本月到期、未完成」展示，可按登记处、随访结局、计划日期筛选。</p><h2>随访计划制定</h2><p>在「随访计划」页选择病种与随访间隔，系统按确诊日期自动生成任务；批量生成前先预览任务量，避免一次生成过多超出本机构处理能力。</p><h2>随访结果填写</h2><p>逐条打开任务，填写最后接触日期、结局状态（存活/死亡/失访），存活者需补填生存质量与复查情况。结局一旦保存即计入统计，填错需走更正流程。</p><h2>批量上传随访结果</h2><p>下载模板后按字段填报，上传时系统先做字段级校验；校验不通过的行会标红并给出行号，改完重新上传即可，已成功的行不会重复入库。</p><h2>死因证与死亡信息联动</h2><p>结局为「死亡」的任务，需同步填写根本死因与 ICD-10 死因编码；死亡日期缺失的会被质控规则拦截，无法进入年度汇总。</p>'
    });
  }

  /* ---------- 合集（多集）----------
     合集是独立的实体（对照 B 站 season）：有自己的 id / 名称 / 简介 / 封面 / 归属 / 状态，
     成员关系存在集合这一侧（members 数组），顺序就是播放顺序，可以人工拖动。
     内容自己不再带 series / episode 字段——一集可以同时进「放疗全程护理」和「2026 患者宣教精选」，
     也可以从合集里移出去而内容本身不受影响。 */
  seedPatch('KB-P-0003', {});
  KB.assets.push(
    {
      id: 'KB-P-0006', track: '科普', kind: '视频', title: '放疗前要做的三件事',
      summary: '定位前准备、皮肤与口腔预处理、必须提前告诉医生的情况（时长 3 分 20 秒）。',
      body: '<h2>定位前别乱涂东西</h2><p>定位和首次治疗当天，照射区皮肤不要涂护肤品、药膏或爽身粉，避免影响定位标记与体膜贴合。</p><h2>皮肤与口腔先预处理</h2><p>放疗前洗一次温水澡，穿宽松纯棉衣物；头颈部放疗患者提前做口腔检查，有龋齿或牙周炎的先处理。</p><h2>这几件事提前告诉医生</h2><p>怀孕、装有心脏起搏器、近期做过手术或有糖尿病，都要在定位前告知放疗科医生。</p>',
      sites: ['通用'], scenes: ['随访宣教', '候诊播放'], tags: ['放疗'], audiences: ['患者及家属'],
      lib: '省库', org: '江西省肿瘤登记中心', status: '启用', publishedAt: '2025-08-01',
      evidence: '《肿瘤放射治疗技术操作规范（2025 版）》', attachments: [{ name: '放疗全程护理_第1集.mp4', size: '32.6 MB' }], note: ''
    },
    {
      id: 'KB-P-0007', track: '科普', kind: '视频', title: '放疗期间的饮食安排',
      summary: '食欲下降、口干、口腔黏膜反应时怎么吃，体重掉了要尽早说（时长 5 分 05 秒）。',
      body: '<h2>食欲差时怎么吃</h2><p>少量多餐，一天 5～6 次，每次七八分饱；饭前半小时散步或做几次深呼吸，能改善食欲。</p><h2>口干与口腔黏膜反应</h2><p>少量多次饮水，随身带水杯；食物做得软烂湿润，避免过烫、过辣、过咸；饭后用温水或生理盐水漱口。</p><h2>体重掉了要尽快说</h2><p>一周内体重下降超过 2 公斤，或连续两天几乎吃不下，要及时找主管医生评估，必要时请营养科会诊。</p>',
      sites: ['通用'], scenes: ['随访宣教'], tags: ['放疗', '饮食'], audiences: ['患者及家属'],
      lib: '省库', org: '江西省肿瘤登记中心', status: '启用', publishedAt: '2025-08-22',
      evidence: '《肿瘤患者营养治疗指南（2024）》', attachments: [{ name: '放疗全程护理_第3集.mp4', size: '61.3 MB' }], note: ''
    },
    {
      id: 'KB-P-0008', track: '科普', kind: '视频', title: '放疗结束后如何复查',
      summary: '复查时间表、每次要带的材料、哪些情况不能等到预约日（时长 4 分 40 秒）。',
      body: '<h2>复查时间表</h2><p>放疗结束后第 1 个月首诊；之后前两年每 3 个月一次，第 3～5 年每半年一次，5 年以后每年一次。</p><h2>每次复查带什么</h2><p>出院小结、放疗记录单、既往影像胶片、最近一次血常规与肝肾功能结果，门诊卡别忘了带。</p><h2>哪些情况要提前就诊</h2><p>照射区皮肤渗液或破溃、持续发热、新出现的疼痛或咳嗽、体重明显下降，都不要等到预约日期。</p>',
      sites: ['通用'], scenes: ['随访宣教', '公众号推文'], tags: ['放疗', '复查'], audiences: ['患者及家属'],
      lib: '省库', org: '江西省肿瘤登记中心', status: '启用', publishedAt: '2025-09-05',
      evidence: '《肿瘤放射治疗患者随访管理专家共识》', attachments: [{ name: '放疗全程护理_第4集.mp4', size: '55.9 MB' }], note: ''
    }
  );

  /* ---------- 种子补充：把「图文」「宣传折页」补齐，并让课件带上讲课视频 ----------
     六种形式（文章 / 图文 / 视频 / 课件 / 操作手册 / 宣传折页）必须在列表里各有一条，
     详情页六套版式才有稳定的回归样本；原来「图文」一条都没有，图集版式等于没验证过。
     图集是「一段正文 + 一组图」，原型没有真实图片资源，用内联 SVG 占位图（data URL），
     每张图配一句说明——版式、配色、说明文字都按真实内容来做，换成真图只需替换 src。 */
  function phImg(title, hint, c1, c2) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>' +
      '<rect width="800" height="600" fill="url(#g)"/>' +
      '<circle cx="670" cy="110" r="130" fill="#ffffff" opacity="0.12"/>' +
      '<circle cx="120" cy="520" r="90" fill="#ffffff" opacity="0.08"/>' +
      '<text x="60" y="290" font-family="Microsoft YaHei,sans-serif" font-size="46" font-weight="bold" fill="#ffffff">' + title + '</text>' +
      '<text x="60" y="352" font-family="Microsoft YaHei,sans-serif" font-size="24" fill="#ffffff" opacity="0.85">' + hint + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  KB.assets.push(
    {
      id: 'KB-P-0009', track: '科普', kind: '图文', title: '5 个动作，把「放疗皮肤护理」存进手机',
      summary: '九图长图：每个动作一张图，配一句话，照着做就行。',
      body: '<p>放疗期间照射区皮肤怎么护理，很多患者记不住文字，记住图就容易多了。下面 5 张图对应 5 个动作，每张图下有一句话，做完一个打个勾。</p>',
      gallery: [
        { src: phImg('拿到护理卡', '护士会在首次放疗后发一张', '#6b8fb4', '#3d5a80'), caption: '① 拿到护理卡：首次放疗后护士会发一张，写着自己照射区的范围。' },
        { src: phImg('每天温水轻洗一次', '水温不烫手，洗完吸干', '#7aa5a8', '#3f6f72'), caption: '② 每天温水轻洗一次，洗后毛巾轻轻吸干，不要来回擦。' },
        { src: phImg('穿宽松纯棉衣物', '内衣衣领别勒住照射区', '#c7a27a', '#8a5e3b'), caption: '③ 穿宽松纯棉衣物，内衣、衣领不要勒住照射区。' },
        { src: phImg('不涂药膏不带膏药', '碘酒、酒精、风油精都不要', '#b47a8a', '#7a3f55'), caption: '④ 不要贴膏药、不要涂碘酒酒精风油精，用药由医生开。' },
        { src: phImg('有反应当天说', '发红渗液疼痛不要拖', '#a1541a', '#6e3410'), caption: '⑤ 出现发红、渗液、疼痛加重，当天告诉放疗科医生。' }
      ],
      sites: ['通用'], scenes: ['随访宣教', '公众号推文'], tags: ['放疗', '复查'], audiences: ['患者本人', '家属 / 照护者'],
      lib: '省库', org: '江西省肿瘤登记中心', status: '启用', publishedAt: '2026-09-18',
      evidence: '《肿瘤放射治疗护理规范》, 国家卫生健康委肿瘤防治科普要点',
      attachments: [], note: '九图科普'
    },
    {
      id: 'KB-P-0010', track: '科普', kind: '宣传折页', title: '出院后三天内要做的三件事（折页）',
      summary: '出院当天发的折页：三件必做的事、复诊怎么约、哪些情况马上回医院。',
      body: '<p>出院小结要收好；回家先量一次体温。</p>' +
        '<h3>出院后先做这三件</h3>' +
        '<p>一、把出院小结和用药单拍照存在手机相册，方便随时给医生看。</p>' +
        '<p>二、每天早晚各量一次体温，连续记 3 天，超过 38℃ 要联系主治医生。</p>' +
        '<p>三、按医嘱把下次复诊时间写进日历，并提前一天挂好号。</p>' +
        '<h3>怎么约复诊</h3>' +
        '<p>1) 打开医院公众号或 App，进入「预约挂号」。</p>' +
        '<p>2) 选择出院时告知的科室与医生，不要随意更换。</p>' +
        '<p>3) 复诊时带上出院小结、用药单和最近的检查报告。</p>' +
        '<h3>这些情况马上回医院</h3>' +
        '<p>发热超过 38℃ 且退不下来。</p>' +
        '<p>伤口红肿渗液、疼痛明显加重。</p>' +
        '<p>吃不下东西、一天呕吐 3 次以上。</p>' +
        '<p>出现呼吸困难或明显心慌。</p>',
      sites: ['通用'], scenes: ['入院宣教', '随访宣教'], tags: ['复查', '饮食'], audiences: ['患者本人', '家属 / 照护者', '老年人'],
      lib: '省库', org: '江西省肿瘤登记中心', status: '启用', publishedAt: '2026-09-25',
      evidence: '院内出院宣教规范（2026）', attachments: [{ name: '出院三天须知_正反面.pdf', size: '1.4 MB' }], note: '折页'
    },
    {
      id: 'KB-T-0015', track: '培训', kind: '宣传折页', title: '报告卡填报「一页纸」速查（培训折页）',
      summary: '贴在登记室墙上的速查折页：必填项、日期逻辑、编码口径三块。',
      body: '<p>拍照发给新同事，或打印后贴在登记室。</p>' +
        '<h3>五个必填项</h3>' +
        '<p>姓名、身份证号、性别：三要素齐全，身份证末位 X 要大写。</p>' +
        '<p>发病部位：写到亚部位，例如「肺 · 上叶」。</p>' +
        '<p>确诊日期与报告日期：确诊不得晚于报告。</p>' +
        '<h3>日期怎么填</h3>' +
        '<p>1) 确诊日期以病理报告为准，没有病理的以临床诊断为准。</p>' +
        '<p>2) 报告日期以实际提交日期为准，不是录入日期。</p>' +
        '<p>3) 补报卡的发病日期要按病历回溯，不要填成当月。</p>' +
        '<h3>编码口径</h3>' +
        '<p>ICD-10 填恶性肿瘤类目（C00–C97），不确定先点「自动编码」。</p>' +
        '<p>ICD-O-3 形态码按病理报告填写，如 8140/3。</p>',
      sites: ['通用'], scenes: ['上岗培训', '填报规范'], tags: ['报告卡', '编码'], audiences: ['登记员 / 报告卡录入', '编码员 / 病案人员'],
      lib: '省库', org: '江西省肿瘤登记中心', status: '启用', publishedAt: '2026-09-02',
      evidence: '《肿瘤登记报告卡填报规范（2026）· 江西省实施细则》', attachments: [{ name: '报告卡速查_一页纸.pdf', size: '860 KB' }], note: '培训折页'
    }
  );
  /* 课件带讲课视频：课件最常见的真实形态是「PPT + 现场录制的讲课视频」，
     列表与详情页都要能同时呈现两者，所以种子 1 号课件补上视频。 */
  seedPatch('KB-T-0008', {
    attachments: [{ name: '报告卡填报规范.pptx', size: '18.4 MB' }, { name: '报告卡填报规范_讲课录像.mp4', size: '286 MB' }]
  });

  /* ================= 合集实体表 =================
     id 前缀 CL-（Collection）；members 只存内容编号，顺序即播放顺序。
     合集也分省库 / 院内：省库合集院内只读，院内合集按 org 隔离——和内容同一套规则。 */
  KB.collections = [];
  /* 种子用了 CL-101 / CL-102，序号必须排在它们之后，否则新建第一条就会撞号（findCl 会命中旧的那条） */
  var CL_SEQ = 102;
  function nextClId() { CL_SEQ += 1; return 'CL-' + CL_SEQ; }
  KB.collections.push(
    {
      id: 'CL-101', name: '放疗全程护理', track: '科普',
      desc: '从定位前准备到放疗结束后的复查，一套讲完放疗患者最常问的五个问题。',
      cover: '', tags: ['放疗', '随访'],
      lib: '省库', org: '江西省肿瘤登记中心', status: '启用',
      createdAt: '2025-08-01', updatedAt: '2025-09-05',
      members: ['KB-P-0006', 'KB-P-0003', 'KB-P-0007', 'KB-P-0008']
    },
    {
      id: 'CL-102', name: '登记员上岗第一课', track: '培训',
      desc: '新入职登记员的第一课：随访登记全流程与重卡识别合并的实操演示。',
      cover: '', tags: ['上岗培训', '随访', '重卡'],
      lib: '省库', org: '江西省肿瘤登记中心', status: '启用',
      createdAt: '2026-07-30', updatedAt: '2026-08-10',
      members: ['KB-T-0007', 'KB-T-0009']
    }
  );
  function findCl(id) { for (var i = 0; i < KB.collections.length; i++) { if (KB.collections[i].id === id) return KB.collections[i]; } return null; }
  /* 某条内容所在的合集（可能多个）：列表角标、详情页合集条都从这里取 */
  function collectionsOf(assetId) {
    return KB.collections.filter(function (c) { return c.members.indexOf(assetId) >= 0; });
  }
  /* 合集里真正能显示的内容：成员编号 → 内容对象；下架/不可见的内容留空位但不显示 */
  function collectionItems(c) {
    return c.members.map(function (id) { return find(KB.assets, id); }).filter(function (a) { return a && visibleIn(a); });
  }

  /* ================= 行为事件表 =================
     「我的收藏 / 我的下载 / 我的上传」与「使用统计」的唯一数据源。
     与 KB.logs 分工明确：
       logs   = 后台操作审计（谁在什么时候改了哪条内容）
       events = 用户使用行为（谁在什么时候看/下了哪条内容）
     两套并存，统计只读 events。别合并——一条内容是「被 30 个人看过」还是「被编辑过 3 次」是两类事实。

     冗余存 org / track / kind：统计页按机构、内容线、形式三个维度聚合时不用回查账号表与资产表。 */
  KB.events = [];
  var EV_SEQ = 0;
  function nextEvId() { EV_SEQ += 1; return 'EV-' + ('000000' + EV_SEQ).slice(-6); }
  function dayOf(at) { return String(at || '').slice(0, 10); }
  function msOf(at) { return new Date(String(at || '').replace(' ', 'T')).getTime() || 0; }
  function assetMeta(id) {
    var a = find(KB.assets, id);
    return a ? { track: a.track, kind: a.kind } : { track: '', kind: '' };
  }

  /* 记一条行为。观看类做 30 分钟防刷：同账号 + 同内容 + 30 分钟内重复播放合并成一条，
     只把时长/进度往上抬，次数不增加。统一在这里判，各埋点不再各写一遍。 */
  function pushEvent(act, assetId, detail, uid, at) {
    var u = uid ? findUser(uid) : currentUser();
    if (!u) return null;
    var when = at || nowStr();
    detail = detail || {};
    if (act === '观看') {
      var now = msOf(when);
      var since = now - 30 * 60 * 1000;
      for (var i = 0; i < KB.events.length; i++) {
        var e = KB.events[i];
        if (e.act !== '观看' || e.uid !== u.id || e.assetId !== assetId) continue;
        var te = msOf(e.at);
        /* 只合并「不晚于本次、且在 30 分钟内」的那条。晚于本次的事件（种子数据里今天较晚时段的行）
           不能被吸收，否则后来的播放会把进度记到一条未来时间的记录上。 */
        if (te > now || te < since) continue;
        e.detail.seconds = Math.max(e.detail.seconds || 0, detail.seconds || 0);
        e.detail.pct = Math.max(e.detail.pct || 0, detail.pct || 0);
        if (detail.chapter && !e.detail.chapter) e.detail.chapter = detail.chapter;
        return e;
      }
    }
    var meta = assetMeta(assetId);
    var ev = {
      id: nextEvId(), at: when, day: dayOf(when),
      uid: u.id, org: u.org, city: u.city, act: act,
      assetId: assetId, track: meta.track, kind: meta.kind,
      detail: detail
    };
    KB.events.push(ev);
    return ev;
  }
  /* 取消收藏 = 删掉这条收藏事件（收藏量是"当前有效收藏"，不做历史快照） */
  function removeFavEvent(assetId, uid) {
    var u = uid ? findUser(uid) : currentUser();
    if (!u) return;
    for (var i = KB.events.length - 1; i >= 0; i--) {
      var e = KB.events[i];
      if (e.act === '收藏' && e.uid === u.id && e.assetId === assetId) KB.events.splice(i, 1);
    }
  }
  /* a.fav / a.favAt 降级成"当前账号是否收藏过"的导出缓存（卡片 ★ 角标要用），
     真值在 events 里。身份切换后必须重算一遍，否则角标还留着上一个人的收藏。 */
  function syncFavFlags() {
    var u = currentUser();
    for (var i = 0; i < KB.assets.length; i++) {
      var a = KB.assets[i], latest = '';
      for (var j = 0; j < KB.events.length; j++) {
        var e = KB.events[j];
        if (e.act === '收藏' && e.uid === u.id && e.assetId === a.id && String(e.at) > latest) latest = e.at;
      }
      a.fav = !!latest;
      a.favAt = latest;
    }
  }
  /* 数据范围收窄：省级看全省、市级看全市、院内只看本院。
     页面其余部分不重复判权——判漏一处就漏数据。
     市级按 city 而不是 org 收窄：市级登记处要看的是全市各家机构的人，只锁自己一个机构没意义。 */
  function scopedEvents(list) {
    var u = currentUser();
    var src = list || KB.events;
    if (u.scope === 'province') return src.slice();
    if (u.scope === 'city') return src.filter(function (e) { return e.city === u.city; });
    return src.filter(function (e) { return e.org === u.org; });
  }
  function myEvents(act) {
    var u = currentUser();
    return KB.events.filter(function (e) {
      return e.uid === u.id && (!act || e.act === act);
    }).sort(function (x, y) { return String(y.at).localeCompare(String(x.at)); });
  }

  /* 种子收藏先于事件表落地，这里补成事件，让「我的收藏」开页不空 */
  /* 最后两条是转载件：收藏列表里必须能看到转载内容（无封面的原文档也占一行，不能丢） */
  [['KB-P-0001', '2026-10-06 09:12'], ['KB-T-0001', '2026-10-07 14:02'], ['KB-T-0011', '2026-10-05 16:40']].forEach(function (x) {
    if (find(KB.assets, x[0])) pushEvent('收藏', x[0], {}, 'U-102', x[1]);
  });

  /* ---------- 种子事件：确定性生成，不用 Math.random ----------
     统计页没有历史数据就是一片空，演示价值为零；而随机数会让每次切页数字都跳、无法验收。
     所以用固定种子的线性同余：同一个种子永远得到同一批数。 */
  (function seedEvents() {
    var rnd = (function (seed) {
      var s = seed;
      return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    })(20261021);
    var ACTIVE = KB_USERS.filter(function (u) { return u.status === '启用'; });
    var W = { 'U-101': 22, 'U-102': 26, 'U-103': 18, 'U-104': 14, 'U-106': 10, 'U-105': 6, 'U-107': 4 };
    var HOT = { 'KB-P-0001': 9, 'KB-T-0007': 8, 'KB-P-0003': 7, 'KB-P-0006': 6, 'KB-T-0008': 5, 'KB-T-0001': 4, 'KB-P-0002': 4 };
    function weighted(list, weights, labelOf) {
      var total = 0, i;
      for (i = 0; i < list.length; i++) total += (weights[labelOf(list[i])] || 1);
      var r = rnd() * total;
      for (i = 0; i < list.length; i++) {
        r -= (weights[labelOf(list[i])] || 1);
        if (r <= 0) return list[i];
      }
      return list[list.length - 1];
    }
    /* 窗口 60 天而不是 30 天：KPI 的环比要拿「上一周期」比，只有 30 天数据时上一周期必然为空、
       四个卡片的环比就只能显示「—」。60 天刚好够「近 30 天 vs 前 30 天」。 */
    var NOW = new Date();
    var START = new Date(NOW.getTime() - 59 * 86400000);
    var acts = [['观看', 60], ['下载', 25], ['收藏', 10], ['上传', 5]];
    for (var d = 0; d < 60; d++) {
      var dt = new Date(START.getTime() + d * 86400000);
      var weekend = dt.getDay() === 0 || dt.getDay() === 6;
      /* 近 30 天是用户实际会看的那一段，给足量；前 30 天只用于环比，量级略低即可 */
      var base = d >= 30 ? 25 : 20;
      var n = Math.round((weekend ? base * 0.6 : base) + rnd() * 8);
      for (var k = 0; k < n; k++) {
        var u = weighted(ACTIVE, W, function (x) { return x.id; });
        /* 每条事件只能落在该账号看得见的内容上：省库全开，院内只认自己机构 */
        var pool = KB.assets.filter(function (a) { return a.lib === '省库' || a.org === u.org; });
        if (!pool.length) continue;
        var a2 = weighted(pool, HOT, function (x) { return x.id; });
        var act = weighted(acts, { '观看': 60, '下载': 25, '收藏': 10, '上传': 5 }, function (x) { return x[0]; })[0];
        var hh = 8 + Math.floor(rnd() * 12), mm = Math.floor(rnd() * 60);
        var at = dayOf(dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2)) +
          ' ' + ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2);
        /* 种子不能落在未来：今天那一档如果抽到比"此刻"还晚的钟点，就不生成。
           否则实时播放会被一条未来时间的记录吸走（30 分钟去重按时间窗判）。 */
        if (msOf(at) > NOW.getTime()) continue;
        var det = {};
        if (act === '观看') { det.seconds = 40 + Math.floor(rnd() * 420); det.pct = Math.min(100, det.seconds * 100 / (300 + Math.floor(rnd() * 300))); det.pct = Math.round(det.pct); }
        else if (act === '下载') {
          var f = (a2.attachments || [])[0];
          det = f ? { fileName: f.name, size: f.size || '—', via: '附件' } : { fileName: a2.title + '.txt', size: '—', via: '正文TXT' };
        }
        else if (act === '上传') det = { op: '新建' };
        pushEvent(act, a2.id, det, u.id, at);
      }
    }
    KB.events.sort(function (x, y) { return String(x.at).localeCompare(String(y.at)); });
  })();
  syncFavFlags();

  /* 种子内容回填上传人。
     「我的上传」只认 assets.createdBy，而种子是直接 push 的、没有这个字段——不回填的话页面永远空，
     但「使用统计」的上传数又是按事件算的，两处就会对不上（一边 24 一边 0）。

     分配规则说明：省库内容主要由省中心维护，但也刻意分几条给市级/院内账号，
     否则换到非省中心身份时「我的上传」全是空的，页面无法演示。
     院内内容归本院账号；本院账号不在账号表里时回落到省中心。 */
  (function seedCreators() {
    var provUser = KB_USERS.filter(function (u) { return u.org === '江西省肿瘤登记中心'; })[0] || KB_USERS[0];
    /* 省库种子里挑几条分给其他账号，让每个身份都有可看的上传记录（否则非省中心身份页面全空） */
    var lend = { 2: 'U-102', 3: 'U-102', 5: 'U-103', 6: 'U-103', 8: 'U-104', 9: 'U-104' };
    KB.assets.forEach(function (a, i) {
      if (a.createdBy) return;
      if (a.lib === '省库') {
        a.createdBy = lend[i] || provUser.id;
        a.createdAt = (a.publishedAt || '2026-08-01') + ' 09:00';
      } else {
        var owner = userByOrg(a.org) || provUser;
        a.createdBy = owner.id;
        a.createdAt = (a.publishedAt || '2026-08-01') + ' 10:30';
      }
      /* 上传人姓名与机构名一起落快照：渲染时优先按账号现取，这个快照只在账号被删后兜底 */
      var cu = findUser(a.createdBy);
      if (cu) { if (!a.uploader) a.uploader = cu.name; if (!a.uploaderOrg) a.uploaderOrg = cu.org; }
    });
    /* 合集同理：按归属机构找账号（省库合集归省中心，院内合集归本院账号），找得到就记创建人。
       找不到就不记 —— 卡片上宁可不显示，也不编一个人名上去。 */
    KB.collections.forEach(function (c) {
      if (c.createdBy) return;
      var owner = userByOrg(c.org);
      if (!owner) return;
      c.createdBy = owner.id;
      c.uploader = owner.name;
      c.uploaderOrg = owner.org;
    });
  })();

/* ===== RP PATCH BEGIN ===== */
  /* ================= 权威内容转载 · 数据层 =================
     转载件不是另一种内容，而是「院内内容 + 溯源字段」。归属必须是 lib:'院内' + 本院 org：
       · 放省库 → 上架/编辑按钮都不出现，转进来就锁死在下架态；
       · 新开一个 lib:'官方' → visibleIn / isMine / clEditable / actionBar 五处判据全要改。
     溯源字段：origin / source / snapshot / editorNote / publisher / publisherOrg；
     编号 KB-R-xxxx（R = Reprint）。 */

  /* 白名单：取启用项，remark 里逗号分隔的是 host。改名单走「分类维护」，这里不写死。 */
  function hostOf(url) {
    var m = String(url || '').match(/^(?:https?:\/\/)?([^\/?#]+)/i);
    return m ? m[1].toLowerCase().replace(/:\d+$/, '') : '';
  }
  function looksLikeUrl(s) { return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([\/?#]\S*)?$/i.test(String(s || '').trim()); }
  function normalizeUrl(s) {
    s = String(s || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    return s;
  }
  /* 命中白名单 → 规范平台名；否则 null（只认 host，不看标题） */
  function platformOf(url) {
    var host = hostOf(url);
    if (!host) return null;
    var list = DICT.srcs || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].status !== '启用') continue;
      var hosts = String(list[i].remark || '').split(/[,，\s]+/).map(function (h) { return h.trim().toLowerCase().replace(/^https?:\/\//, ''); }).filter(Boolean);
      for (var j = 0; j < hosts.length; j++) {
        /* 子域也算：article.ncc-cn.org.cn 命中 ncc-cn.org.cn；evil-ncc-cn.org.cn 不算 */
        if (host === hosts[j] || host.slice(-(hosts[j].length + 1)) === '.' + hosts[j]) return list[i].name;
      }
    }
    return null;
  }

  /* ---------- 官方内容源清单（原型是确定性种子；正式环境由后端巡检任务更新） ---------- */
  var OFFICIAL_FEED = [
    {
      sid: 'nhc-2026-1012-01', platform: '国家卫生健康委',
      url: 'https://www.nhc.gov.cn/xcs/kpzs/20261012/cancer-screening.html',
      title: '癌症早筛早诊早治：这几类人群应每年筛查一次', publishedAt: '2026-10-12',
      author: '国家卫生健康委宣传司', kinds: '文章', track: '科普',
      sites: ['通用'], scenes: ['报告解读', '公众号推文'], tags: ['筛查'],
      body: [
        ['p', '癌症防治的关键在「早」。多数常见肿瘤在早期发现并规范治疗后，五年生存率明显提高。'],
        ['h2', '哪些人需要定期筛查'],
        ['ul', ['40 岁以上且长期吸烟者，建议每年做一次低剂量螺旋 CT 筛查肺癌；', '有结直肠癌家族史或长期高脂饮食者，建议 45 岁起做肠镜筛查；', '女性 35 岁起定期做乳腺超声，40 岁起加做钼靶；', '有乙肝或丙肝感染史者，每半年做一次肝脏超声联合甲胎蛋白检查。']],
        ['h2', '筛查发现异常怎么办'],
        ['p', '筛查结果异常不等于确诊肿瘤，应按专科医生的建议进一步做病理学检查确认，不要自行复查或长期观察。'],
        ['p', '筛查应按医嘱定期进行，不要因为一次结果正常就长期不再检查。']
      ]
    },
    {
      sid: 'nhc-2026-0912-04', platform: '国家卫生健康委',
      url: 'https://www.nhc.gov.cn/xcs/kpzs/20260912/colon-screening.html',
      title: '结直肠癌筛查：从几岁开始、多久一次', publishedAt: '2026-09-12',
      author: '国家卫生健康委宣传司', kinds: '文章', track: '科普',
      sites: ['结直肠'], scenes: ['随访宣教', '报告解读'], tags: ['筛查', '复查'],
      body: [
        ['p', '结直肠癌是可以通过规范筛查显著降低发病与死亡风险的恶性肿瘤。'],
        ['h2', '从几岁开始查'],
        ['p', '一般人群建议 45 岁起接受结直肠癌筛查；有家族史、炎症性肠病史等高风险人群应提前开始并缩短间隔。'],
        ['h2', '查什么'],
        ['p', '结肠镜是金标准；不便做结肠镜的，可先做粪便隐血或粪便 DNA 检测，阳性者必须转做结肠镜。'],
        ['h2', '发现息肉怎么办'],
        ['p', '结肠镜下发现息肉一般可当场切除，并按病理结果与息肉性质确定复查间隔，不要因为切掉就不再复查。']
      ]
    },
    {
      sid: 'ncc-2026-0908-01', platform: '国家癌症中心',
      url: 'https://www.ncc-cn.org.cn/kepu/2026/0908/radiotherapy.html',
      title: '放射治疗期间的皮肤护理要点（视频）', publishedAt: '2026-09-08',
      author: '国家癌症中心健康教育处', kinds: '视频', track: '科普',
      sites: ['通用'], scenes: ['随访宣教', '候诊播放'], tags: ['放疗'],
      body: [
        ['h2', '保持照射野皮肤清洁干燥'],
        ['p', '照射区皮肤每日用温水轻洗，洗后用软毛巾吸干，不要来回擦拭。'],
        ['h2', '穿对衣服、避免刺激'],
        ['p', '选择宽松纯棉衣物，照射区不贴膏药、不涂碘酒与酒精，避免暴晒与热水袋。'],
        ['h2', '出现反应及时告诉医生'],
        ['p', '皮肤发红、脱皮、渗液或疼痛加重，当天就要告诉放疗科医生，不要自行用药。']
      ]
    },
    {
      sid: 'nhc-2026-0922-02', platform: '国家卫生健康委',
      url: 'https://www.nhc.gov.cn/fys/s3581/20260922/cervical.html',
      title: '宫颈癌筛查与 HPV 疫苗常见问题解答', publishedAt: '2026-09-22',
      author: '国家卫生健康委妇幼健康司', kinds: '文章', track: '科普',
      sites: ['宫颈'], scenes: ['随访宣教', '公众号推文'], tags: ['筛查', '疫苗'],
      body: [
        ['p', '宫颈癌是目前少数可以通过疫苗与筛查共同预防的恶性肿瘤。'],
        ['h2', '关于 HPV 疫苗'],
        ['ul', ['二价、四价、九价疫苗均可有效预防高危型 HPV 持续感染；', '已接种疫苗的女性仍需按年龄定期做宫颈癌筛查；', '接种前不必常规做 HPV 检测，但应按接种门诊要求如实告知病史。']],
        ['h2', '关于筛查'],
        ['p', '25～64 岁女性建议每 3～5 年做一次 HPV 检测或细胞学检查，具体间隔以当地筛查方案为准。']
      ]
    },
    {
      sid: 'nhc-2026-0830-03', platform: '国家卫生健康委',
      url: 'https://www.nhc.gov.cn/jkj/s7923/20260830/weight.html',
      title: '控制体重能降低哪些肿瘤风险', publishedAt: '2026-08-30',
      author: '国家卫生健康委疾控局', kinds: '文章', track: '科普',
      sites: ['通用'], scenes: ['公众号推文'], tags: ['饮食'],
      body: [
        ['p', '超重与肥胖与结直肠癌、乳腺癌（绝经后）、子宫内膜癌、肾癌等多种肿瘤的发病风险升高相关。'],
        ['h2', '怎么算超重'],
        ['p', '体质指数（BMI）= 体重（千克）÷ 身高（米）的平方。成年人 BMI 在 24 及以上属于超重，28 及以上属于肥胖。'],
        ['h2', '怎么做'],
        ['p', '每周至少 150 分钟中等强度身体活动，减少含糖饮料与加工肉类摄入，长期坚持比短期猛减更重要。']
      ]
    },
    {
      sid: 'ncc-2026-0715-02', platform: '国家癌症中心',
      url: 'https://www.ncc-cn.org.cn/kepu/2026/0715/pain.html',
      title: '癌痛治疗中的常见误区', publishedAt: '2026-07-15',
      author: '国家癌症中心', kinds: '文章', track: '科普',
      sites: ['通用'], scenes: ['随访宣教'], tags: ['疼痛'],
      body: [
        ['p', '疼痛是肿瘤患者最常见的症状之一，规范的镇痛治疗可以显著改善生活质量。'],
        ['h2', '误区一：用阿片类药物会成瘾'],
        ['p', '在医生指导下按规范剂量使用阿片类药物控制癌痛，成瘾发生率极低。因恐惧成瘾而忍痛，反而影响治疗与休息。'],
        ['h2', '误区二：疼了才吃药'],
        ['p', '持续性疼痛应按医嘱按时服药，而不是等疼痛加重再吃，否则疼痛控制会更困难。'],
        ['h2', '误区三：副作用无法耐受就停药'],
        ['p', '便秘、恶心等反应多数可以通过调整用药与对症处理改善，不要自行停药，应及时告诉医生。']
      ]
    },
    {
      sid: 'hcjx-2026-1005-01', platform: '江西省卫生健康委',
      url: 'https://hc.jiangxi.gov.cn/art/2026/10/5/cancer-health.html',
      title: '肿瘤患者秋冬季营养与免疫力维护提示', publishedAt: '2026-10-05',
      author: '江西省卫生健康委宣传处', kinds: '文章', track: '科普',
      sites: ['通用'], scenes: ['随访宣教', '入院宣教'], tags: ['饮食', '化疗'],
      body: [
        ['p', '秋冬季呼吸道感染高发，肿瘤患者在治疗期间免疫力相对较低，更需注意营养与防护。'],
        ['h2', '保证优质蛋白'],
        ['p', '每天摄入足量的蛋、奶、鱼、瘦肉与豆制品，食欲差时可少量多餐，必要时请营养科会诊。'],
        ['h2', '注意食品卫生'],
        ['p', '食物充分加热，不食用生冷与隔夜未冷藏的食物，瓜果洗净去皮。'],
        ['h2', '什么时候要就诊'],
        ['p', '体温超过 38℃、持续乏力加重或出现寒战，请立即联系主管医生，不要等到下次复诊。']
      ]
    },
    {
      sid: 'nhc-2026-0620-01', platform: '国家卫生健康委',
      url: 'https://www.nhc.gov.cn/xcs/kpzs/20260620/followup.html',
      title: '肿瘤患者复查怎么做、查什么', publishedAt: '2026-06-20',
      author: '国家卫生健康委宣传司', kinds: '文章', track: '科普',
      sites: ['通用'], scenes: ['随访宣教', '报告解读'], tags: ['复查', '随访'],
      body: [
        ['p', '治疗结束后的定期复查是肿瘤规范治疗的一部分，目的是尽早发现复发、转移与治疗相关并发症。'],
        ['h2', '复查间隔'],
        ['p', '一般治疗后前两年每 3 个月一次，第 3～5 年每半年一次，5 年以后每年一次；具体以主管医生意见为准。'],
        ['h2', '每次复查要带什么'],
        ['p', '出院小结、既往病理与影像资料、近期检验结果，方便医生对比判断。'],
        ['h2', '哪些情况要提前就诊'],
        ['p', '新出现的疼痛、持续咳嗽、体重明显下降或治疗部位异常，不要等到预约日期。']
      ]
    },
    {
      sid: 'cma-2026-0518-01', platform: '中华医学会',
      url: 'https://www.cma.org.cn/art/2026/5/18/guideline-smoking.html',
      title: '戒烟对肿瘤患者治疗与生存的影响', publishedAt: '2026-05-18',
      author: '中华医学会呼吸病学分会', kinds: '文章', track: '科普',
      sites: ['肺', '通用'], scenes: ['随访宣教', '公众号推文'], tags: ['筛查', '饮食'],
      body: [
        ['p', '确诊肿瘤后继续吸烟会降低治疗效果、增加并发症与复发风险，戒烟在任何阶段都不算晚。'],
        ['h2', '戒烟能带来哪些改变'],
        ['ul', ['改善术后肺部并发症风险；', '提高放疗敏感性、减少放射性肺损伤；', '改善食欲与体能，提升生活质量。']],
        ['h2', '怎么戒'],
        ['p', '可结合戒烟门诊的行为干预与规范药物治疗，不建议依靠「慢慢减量」自行硬扛。']
      ]
    },
    {
      sid: 'ncc-train-2026-0915-01', platform: '国家癌症中心',
      url: 'https://www.ncc-cn.org.cn/train/2026/0915/register-sop.html',
      title: '肿瘤登记报告卡填报规范（国家版培训课件）', publishedAt: '2026-09-15',
      author: '国家癌症中心肿瘤登记办公室', kinds: '课件', track: '培训',
      sites: ['通用'], scenes: ['填报规范', '上岗培训'], tags: ['报告卡', '上报'],
      body: [
        ['p', '本课件用于全国肿瘤登记人员的填报规范培训，可作为院内培训的讲义直接放映。'],
        ['h2', '一、必填字段口径'],
        ['ul', ['患者三要素：姓名、身份证号、性别，缺一不可；', '发病部位写到亚部位，如「肺 · 上叶」；', '确诊日期以病理报告确诊日期为准。']],
        ['h2', '二、常见退回原因'],
        ['ul', ['ICD10 编码为空或与病理不符；', '身份证号校验位错误（末位 X 未大写）；', '住址未细化到乡镇/街道。']],
        ['h2', '三、上报前自检'],
        ['p', '五个必填字段是否齐全、编码是否与病理一致、日期逻辑是否成立、是否命中重卡提示并已处理。']
      ]
    },
    {
      sid: 'nhc-train-2026-0802-01', platform: '国家卫生健康委',
      url: 'https://www.nhc.gov.cn/jkj/s3586/20260802/death-cert.html',
      title: '死亡医学证明书填写要点（培训）', publishedAt: '2026-08-02',
      author: '国家卫生健康委基层卫生健康司', kinds: '操作手册', track: '培训',
      sites: ['通用'], scenes: ['上岗培训', '填报规范'], tags: ['编码'],
      body: [
        ['p', '死亡医学证明书的填写直接影响根本死因统计，肿瘤死亡登记尤其要写清死因链。'],
        ['h3', '一、死亡原因栏'],
        ['ol', ['第一行写直接死因，如「呼吸衰竭」；', '第二行写引起直接死因的疾病，如「肺恶性肿瘤伴多器官转移」；', '根本死因写最后一行，并对应 ICD-10 编码。']],
        ['h3', '二、常见填写错误'],
        ['ol', ['只写「呼吸衰竭」不写根本病因；', '把临终表现（如心跳骤停）当作根本死因；', '死因编码与文字不一致。']],
        ['h3', '三、与发病数据的衔接'],
        ['ol', ['死亡登记中发现已登记肿瘤患者，自动关联随访结局；', '未登记过的肿瘤死亡，进入死亡补发病流程。']]
      ]
    }
  ];

  /* ---------- 转载台账（合规证据链，只追加） ---------- */
  KB.reprintLog = [];
  var RP_SEQ = 0;
  function nextRpId() { RP_SEQ += 1; return 'RP-' + ('000' + RP_SEQ).slice(-4); }
  function reprintLog(assetId, act, detail) {
    KB.reprintLog.push({ id: nextRpId(), assetId: assetId, act: act, uid: ME.id, at: nowStr(), detail: detail || {} });
  }
  /* 转载件判定：只有一个显式值「转载」；老数据没有该字段时一律当原创（见 backfillOrigin） */
  function isReprint(a) { return !!a && a.origin === '转载'; }
  function plusDays(dateStr, n) {
    var d = new Date(String(dateStr) + 'T09:00:00');
    if (isNaN(d.getTime())) return String(dateStr || today());
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  /* 复审机制已取消：转载件不再计算复审期，也不再在上架门禁里卡「待复审」。
     原 reviewDays() / shelfReview() 一并删除；存量数据的 reviewAt 字段保留但不读。 */
  function dueReview() { return false; }
  /* 来源文字：列表、详情、导出到处都用，不许各处自己拼 */
  function sourceText(a) {
    if (!a || !a.source) return '';
    return a.source.platform + '：' + (a.source.title || a.title) + '（' + (a.source.publishedAt || '') + '）';
  }
  function stripHtmlToText(html) {
    return String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h\d|li)>/gi, '\n').replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  /* 快照指纹：防的是「保存时正文和入库快照不一致」，不是防攻击者（那是后端签名的事） */
  function hashOf(s) {
    var h = 5381, str = String(s || '');
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return 'h' + (h >>> 0).toString(16) + '-' + str.length;
  }
  /* 结构化块 → 与手写正文同构的 HTML，详情页按形式的切分逻辑不用为转载件另写一套 */
  function blocksToHtml(blocks) {
    return (blocks || []).map(function (b) {
      var t = b[0], v = b[1];
      if (t === 'h2') return '<h2>' + esc(v) + '</h2>';
      if (t === 'h3') return '<h3>' + esc(v) + '</h3>';
      if (t === 'ul') return '<ul>' + v.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      if (t === 'ol') return '<ol>' + v.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
      return '<p>' + esc(v) + '</p>';
    }).join('');
  }
  function makeSource(platform, url, title, publishedAt, author, sourceId, basis) {
    return {
      platform: platform, host: hostOf(url), title: title || '', url: normalizeUrl(url || ''),
      publishedAt: publishedAt || '', author: author || platform,
      sourceId: sourceId || '', basis: basis || 'official'
    };
  }

  /* ---------- 自动整理：高置信自动填，低置信留白并标出来 ---------- */
  function autoFill(rec) {
    var text = String(rec.title || '') + '\n' + (rec.blocks || []).map(function (b) { return Array.isArray(b[1]) ? b[1].join(' ') : b[1]; }).join('\n');
    function hits(dim) {
      var out = [];
      (DICT[dim] || []).forEach(function (x) {
        if (x.status !== '启用') return;
        var n = x.name;
        if (dim === 'sites' && n === '通用') return;   /* 通用不算命中，没命中才回落到通用 */
        if (text.indexOf(n) >= 0) out.push(n);
      });
      return out;
    }
    var sites = hits('sites').slice(0, 3), scenes = hits('scenes').slice(0, 2), tags = hits('tags').slice(0, 3);
    return {
      kind: { v: rec.kind || '文章', low: !rec.kind },
      sites: { v: sites.length ? sites : ['通用'], low: !sites.length },
      scenes: { v: scenes, low: !scenes.length },
      tags: { v: tags, low: false },
      track: { v: rec.track || '科普', low: !rec.track },
      summary: { v: autoSummary(blocksToHtml(rec.blocks)), low: false },
      /* 只有正文型形式才提示"过短"；视频/课件给章节刻度就够 */
      bodyTooShort: ['文章', '操作手册', '宣传折页'].indexOf(rec.kind || '文章') >= 0 && stripHtmlToText(blocksToHtml(rec.blocks)).length < 120
    };
  }

  /* ---------- 解析器：链接 / 清单编号 → 结构化记录 ----------
     原型不联网：命中清单的直接取全文；其余白名单链接按 URL 生成确定性标题，正文标「待补」。
     正式环境换成 GET /reprint/parse?url=，字段保持一致即可。结果统一带 rec.source。

     【失败也要有出路】解析只是「省打字」，它失败不等于转载失败。所以失败一律返回
     { ok:false, code, why, hint, url, host } —— 前端据此给出「为什么失败 + 接下来做什么」，
     而不是只甩一行红字。code 清单：
       EMPTY      没填
       NOT_URL    粘的不是网址（但能从文本里抠出网址时先抠，见 extractUrl）
       NOT_WHITE  不在白名单（含公众号、搜索引擎、别家医院、山寨站）
       FETCH_FAIL 抓取失败（超时 / 403 / 需要登录 / 原文已删，正式环境由采集服务返回）
       NO_BODY    抓到了页面但拿不到正文（多为列表页、图片页、视频页） */
  var RP_CODES = { EMPTY: 'EMPTY', NOT_URL: 'NOT_URL', NOT_WHITE: 'NOT_WHITE', FETCH_FAIL: 'FETCH_FAIL', NO_BODY: 'NO_BODY' };
  /* 从一段文本里抠第一个网址：运营常把「转发语 + 链接」一起粘进来 */
  function extractUrl(text) {
    var m = String(text || '').match(/https?:\/\/[^\s，,。；;、"'<>）)】\]]+/i);
    return m ? m[0] : '';
  }
  /* 模拟真实抓取的失败面：原型里用固定规则演示「抓不到」长什么样。
     正式环境这些判断全部由采集服务做，前端只认 active/status。 */
  function simulateFetchFail(url) {
    var u = String(url || '').toLowerCase();
    if (/\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|zip)$/.test(u)) return '这个链接是文件（PDF / 图片等），不是网页，抓不到正文';
    if (/\/video\/|\/shipin\/|video\.|\/play\//.test(u)) return '这是视频播放页，抓不到正文（可手填：标题 + 原文链接 + 字幕或简介）';
    if (/login|passport|sso|signin/.test(u)) return '原文需要登录才能看，系统抓不到';
    if (/404|notfound|error/.test(u)) return '原文已删除或链接失效（404）';
    if (/list|index|column|search|tag\//.test(u)) return '抓到的是栏目 / 搜索页，不是单篇文章';
    return '';
  }
  function buildReprint(input) {
    var raw = String(input || '').trim();
    if (!raw) return { ok: false, code: RP_CODES.EMPTY, why: '还没有粘贴原文链接' };
    var bySid = OFFICIAL_FEED.filter(function (x) { return x.sid === raw; })[0];
    if (bySid) return buildFromFeed(bySid);
    /* 粘了「转发语 + 链接」时先抠网址，抠不到才判 NOT_URL */
    var onlyUrl = raw;
    if (!looksLikeUrl(raw)) {
      var got = extractUrl(raw);
      if (!got) {
        return {
          ok: false, code: RP_CODES.NOT_URL, why: '没识别出网址：' + raw.slice(0, 40),
          hint: '可以直接粘「文章链接」，也可以粘整段分享文案（系统会自动把里面的链接抠出来）；实在没有链接，就把下面几项手填了入库。'
        };
      }
      onlyUrl = got;
      raw = got;
    }
    var url = normalizeUrl(onlyUrl), platform = platformOf(url);
    var hit = OFFICIAL_FEED.filter(function (x) { return normalizeUrl(x.url) === url; })[0];
    if (hit) return buildFromFeed(hit);
    if (!platform) {
      var host = hostOf(url);
      return {
        ok: false, code: RP_CODES.NOT_WHITE,
        why: '不在官方来源白名单（' + host + '）',
        hint: '权威转载只收白名单内的官方原文。若这篇确属官方账号（如国家卫健委微信公众号）或有书面授权，' +
          '把标题、来源填好即可入库——非白名单来源必须填「授权说明」（下方有该输入框），合规审查要靠它自证来源。',
        url: url, host: host
      };
    }
    var bad = simulateFetchFail(url);
    if (bad) {
      return { ok: false, code: RP_CODES.FETCH_FAIL, why: bad, hint: '可以重试一次；或者把下面几项手填了入库（标题、来源必填，正文可贴可不贴）。', url: url, host: hostOf(url), platform: platform };
    }
    var seg = url.replace(/^https?:\/\/[^\/]+/, '').replace(/[\?#].*$/, '').split('/').filter(Boolean).pop() || '';
    var guess = '来自' + platform + '的官方科普（' + decodeURIComponent(seg || '首页').replace(/\.\w{2,5}$/, '').replace(/[-_]+/g, ' ') + '）';
    var rec = {
      fromFeed: false, platform: platform, url: url, host: hostOf(url), title: guess,
      publishedAt: '', author: platform, kind: '', track: '科普',
      blocks: []   /* 正文可选：不塞占位段，宁可为空并在详情页给出「看原文」入口 */
    };
    rec.source = makeSource(platform, url, guess, '', platform, '', 'official');
    /* 只拿到链接的记录：标题/日期/正文都要补，场景也识别不出来 → 给一个合理默认，
       否则用户不知道「使用场景」是空的需要自己点，点确认只会弹提示、看着像按钮坏了 */
    rec.auto = autoFill(rec);
    rec.auto.publishedAt = { v: '', low: true };
    rec.auto.title = { v: guess, low: true };
    if (!rec.auto.scenes || !rec.auto.scenes.v.length) {
      rec.auto.scenes = { v: ['随访宣教'], low: true };
    }
    /* 抓到了页面但没正文：明确标成「不完整」，弹窗里直接给补录框，别让它混进"解析成功" */
    return { ok: true, rec: rec, incomplete: true, missing: ['title', 'publishedAt', 'body'] };
  }
  function buildFromFeed(x) {
    var rec = {
      fromFeed: true, platform: x.platform, url: x.url, host: hostOf(x.url), title: x.title,
      publishedAt: x.publishedAt, author: x.author, kind: x.kinds, track: x.track, blocks: x.body
    };
    rec.source = makeSource(x.platform, x.url, x.title, x.publishedAt, x.author, x.sid, 'official');
    rec.auto = autoFill(rec);
    /* 清单里的病种是官方口径，置信度高；但字典里禁用了就不认，退回低置信 */
    var siteOk = (x.sites || []).every(function (s) { return dictNames('sites').indexOf(s) >= 0; });
    rec.auto.sites = { v: (x.sites || ['通用']).slice(), low: !siteOk };
    rec.auto.scenes = { v: (x.scenes || []).slice(), low: !(x.scenes || []).length };
    rec.auto.tags = { v: (x.tags || []).slice(), low: false };
    return { ok: true, rec: rec };
  }
  /* 去重：同一条官方原文只转一次（清单编号优先，网址兜底） */
  function findReprintBy(rec) {
    if (!rec) return null;
    var url = normalizeUrl(rec.url || '');
    return KB.assets.filter(function (a) {
      if (!isReprint(a) || !a.source) return false;
      if (rec.sourceId && a.source.sourceId === rec.sourceId) return true;
      return !!url && normalizeUrl(a.source.url) === url;
    })[0] || null;
  }

  /* ---------- 落地：去重 → 组装资产 → 过门禁 → 记台账 → 给「我的上传」记一条上传事件 ----------
     opts.body：人工转载 / 只拿到链接时用户在弹窗里补的正文（纯文本），由这里转成 HTML 并快照；
     opts.body 给了就必须有快照（requireSnapshot），否则等于又造一条待补件。 */
  function createReprint(rec, f, owner, track, opts) {
    opts = opts || {};
    owner = owner || currentUser();
    var dup = findReprintBy(rec.source || {});
    if (dup) { say('这条原文已经转载过：' + dup.id + '（' + dup.title + '）', 'error'); closeRp(); openDetail(dup.id); return null; }
    function textToHtml(txt) {
      var t = String(txt || '').trim();
      if (!t) return '';
      if (/<[a-z][a-z0-9]*[\s>]/i.test(t)) return t;   /* 已经是 HTML 就原样用 */
      return '<p>' + t.replace(/\r\n/g, '\n').split(/\n{2,}/).map(function (p) {
        return esc(p).replace(/\n/g, '<br>');
      }).join('</p><p>') + '</p>';
    }
    var body = opts.body ? textToHtml(opts.body) : blocksToHtml(rec.blocks || []);
    var plain = stripHtmlToText(body);
    /* 摘要规则与新增内容表单一致：有值用值，空则取正文首句。
       以前转载件恒为正文首句，列表里几条长文看着一模一样、也改不了。 */
    var summaryOut = String(f.summary || '').trim() || autoSummary(body);
    var a = {
      id: nextRpNo(),
      track: track === '培训' ? '培训' : '科普',
      kind: f.kind, title: rec.title || rec.source.title,
      summary: summaryOut, body: body,
      /* 场景 / 受众 / 标签都取表单值，与原创内容同一套字段（2026-10-23 起两条录入通道对齐）。
         受众没给时回落到内容线默认人群，不留空。 */
      sites: f.sites.slice(), scenes: (f.scenes || []).slice(), tags: f.tags.slice(),
      audiences: (f.audiences && f.audiences.length ? f.audiences : defaultAudiences(track)).slice(),
      /* 归属院内 + 本院：才可编辑可上架；省库会被锁死在下架态 */
      lib: '院内', org: owner.org, origin: '转载',
      source: {
        platform: rec.source.platform, host: rec.source.host || hostOf(rec.source.url),
        title: rec.source.title || rec.title, url: rec.source.url,
        publishedAt: rec.source.publishedAt, author: rec.source.author,
        sourceId: rec.source.sourceId || '', basis: rec.source.basis || 'official'
      },
      /* 快照生成规则（三种来源分开对待）：
         · 自动通道且清单里有全文（fromFeed）→ 直接有快照
         · 自动通道但只拿到链接、或人工转载（opts.body 有正文）→ 按用户补的正文生成快照
         · 授权件只填了溯源、正文留空 → 无快照，成为「待补录」件，上架前必须先补正文 */
      snapshot: (function () {
        if (plain.length < 30) return null;
        if (rec.fromFeed) return { hash: hashOf(body), plain: plain, blocks: rec.blocks, fetchedAt: nowStr() };
        if (opts.body) return { hash: hashOf(body), plain: plain, blocks: null, fetchedAt: nowStr() };
        return null;
      })(),
      editorNote: f.editorNote || '', attest: rec.attest || null,
      reprintedBy: owner.id, reprintedAt: nowStr(), copyCount: 0,
      /* 发布人 / 发布单位：不是原文的「作者」，是本机构把这条转载内容发到库里的责任人。
         发布人取操作账号，发布单位取该账号所属机构（机构名才是对外口径）。 */
      publisher: owner.name, publisherOrg: owner.org,
      createdBy: owner.id, uploader: owner.name, uploaderOrg: owner.org, createdAt: nowStr(),
      status: '停用', publishedAt: '',
      evidence: sourceText({ source: rec.source }),
      attachments: [], note: rec.manual ? '手填转载' : '转载入库',
      /* 自动抓取 / 人工补录，分开记：合规审查会问「哪些是系统抓的、哪些是人工贴的」 */
      captureMode: rec.manual ? 'manual' : (rec.fromFeed ? 'auto' : (opts.body ? 'auto+fill' : 'auto-link-only'))
    };
    KB.assets.push(a);
    reprintLog(a.id, '转载入库', { platform: a.source.platform, url: a.source.url });
    log(owner.name, '转载官方内容', a.id + ' ' + a.source.platform);
    pushEvent('上传', a.id, { op: '转载' }, owner.id);
    if (f.publish) {
      var why = shelfBlocker(a);
      if (!why) { a.status = '启用'; a.publishedAt = today(); log(owner.name, '上架内容', a.id); }
      else say('已入库，但上架被拦下：' + why, 'error');
    }
    syncHomeNews();
    return a;
  }

  /* ---------- 种子：3 条演示转载件 ----------
     一条正常在架、一条省管理员转的、一条只有来源没有快照（上架会被拦）。
     没有它们，转载视角与详情页的来源块没法演示。 */
  (function seedReprints() {
    var PROV_ORG = '江西省肿瘤登记中心';
    function make(id, sid, opts) {
      var x = OFFICIAL_FEED.filter(function (f) { return f.sid === sid; })[0];
      if (!x) return null;
      var body = blocksToHtml(x.body), plain = stripHtmlToText(body);
      return {
        id: id, track: x.track, kind: x.kinds, title: x.title,
        summary: autoSummary(body), body: body,
        /* scenes 留空：转载表单没有「使用场景」这一项，卡片和详情页都不该显示它。
           官方清单里有 scenes 字段，但那是给原创推荐用的，不能顺手带到转载件上。 */
        /* 种子转载件的场景留空：官方清单里的 scenes 是给原创推荐用的，不是本院填的，
           顺手带过来就成了"没人填过却当事实展示"。表单入库的转载件会带上真实场景。 */
        sites: (x.sites || ['通用']).slice(), scenes: [], tags: (x.tags || []).slice(),
        audiences: ['患者本人', '家属 / 照护者'],
        lib: '院内', org: opts.org || PROV_ORG, origin: '转载',
        source: makeSource(x.platform, x.url, x.title, x.publishedAt, x.author, x.sid, 'official'),
        snapshot: opts.noSnapshot ? null : { hash: hashOf(body), plain: plain, blocks: x.body, fetchedAt: opts.at },
        editorNote: opts.note || '', attest: null,
        reprintedBy: opts.by || 'U-101', reprintedAt: opts.at, copyCount: opts.copy || 0,
        publisher: (findUser(opts.by || 'U-101') || {}).name || '',
        publisherOrg: opts.org || PROV_ORG,
        status: opts.status, publishedAt: opts.status === '启用' ? opts.at.slice(0, 10) : '',
        evidence: sourceText({ source: { platform: x.platform, title: x.title, publishedAt: x.publishedAt } }),
        attachments: [], note: '转载入库',
        createdBy: opts.by || 'U-101', createdAt: opts.at,
        uploader: (findUser(opts.by || 'U-101') || {}).name || '',
        uploaderOrg: (findUser(opts.by || 'U-101') || {}).org || (opts.org || PROV_ORG)
      };
    }
    var seeds = [
      make('KB-R-0001', 'nhc-2026-0912-04', { at: '2026-09-10 10:20', by: 'U-102', org: '南昌市东湖区登记处', status: '启用', copy: 12 }),
      make('KB-R-0002', 'hcjx-2026-1005-01', { at: '2026-10-13 15:40', by: 'U-101', status: '启用', copy: 5 }),
      /* 第 3 条没有快照：它演示的是「上架被拦」，不是复审 */
      make('KB-R-0003', 'ncc-2026-0908-01', { at: '2026-10-18 09:05', by: 'U-102', org: '南昌市东湖区登记处', status: '停用', noSnapshot: true })
    ];
    seeds.forEach(function (a, i) {
      if (!a) return;
      KB.assets.push(a);
      KB.reprintLog.push({ id: 'RP-00' + (i + 1), assetId: a.id, act: '转载入库', uid: a.reprintedBy, at: a.reprintedAt, detail: { platform: a.source.platform } });
      if (a.copyCount) KB.reprintLog.push({ id: 'RP-01' + (i + 1), assetId: a.id, act: '复制外发', uid: a.reprintedBy, at: plusDays(a.reprintedAt.slice(0, 10), 1) + ' 11:00', detail: { channel: '微信', count: a.copyCount } });
    });
  })();

  /* 转载件的种子收藏：必须在 seedReprints() 之后写——转载件是后加入的，
     放前面会因为「内容还不存在」被 find() 判空而静默丢掉，收藏列表里也就看不到转载内容。 */
  [['KB-R-0001', '2026-10-08 10:15'], ['KB-R-0002', '2026-10-09 15:30']].forEach(function (x) {
    if (find(KB.assets, x[0])) pushEvent('收藏', x[0], {}, 'U-102', x[1]);
  });
  /* 存量回填 origin：规则写死、不猜。院内 KB-H-* 与省库 KB-P-* / KB-T-* 都是原创
     （KB-T-0001…0006 的出处是「ICD-10 编码表」这类文献，那是依据不是原文）。幂等。 */
  (function backfillOrigin() {
    KB.assets.forEach(function (a) { if (!a.origin) a.origin = '原创'; });
  })();
  /* 存量迁移：原来只有「图文」一种文章形态，现在它叫「文章」，「图文」改为图集。
     不迁的话历史文章会被当成图集渲染（正文空、图也空）。幂等。 */
  (function migrateKindWentuToArticle() {
    KB.assets.forEach(function (a) {
      if (a && a.kind === '图文' && !(a.gallery && a.gallery.length)) a.kind = '文章';
    });
  })();
  /* 存量回填「转载件不该有使用场景」的规则已废弃（2026-10-23）：
     转载表单现在也采集使用场景（与内容库筛选条对齐），再清空就会把用户填的场景抹掉。
     只清早期写死的那个值：旧版 createReprint 把场景固定成 ['随访宣教']，不是人填的，
     留着会被当作事实展示。只认这一种形态，用户改了任何一项都不再命中。幂等。 */
  (function backfillRpScenes() {
    KB.assets.forEach(function (a) {
      if (!a || a.origin !== '转载') return;
      if (a.scenes && a.scenes.length === 1 && a.scenes[0] === '随访宣教') a.scenes = [];
    });
  })();
  /* 存量回填发布人 / 发布单位（幂等，只补空值）：
     转载件 = 转载账号（reprintedBy）的姓名 + 所属机构；
     原创件 = 上架日志里的操作人 + 其所属机构，查不到上架日志就退到内容所属机构、发布人留空。
     发布单位总能给出（内容必有归属），发布人查不到就空着，不拿别的人名凑。 */
  (function backfillPublisher() {
    KB.assets.forEach(function (a) {
      if (!a) return;
      if (isReprint(a)) {
        if (!a.publisher) { var u = findUser(a.reprintedBy); if (u) a.publisher = u.name; }
        if (!a.publisherOrg) a.publisherOrg = a.org || '';
        return;
      }
      if (!a.publisherOrg) a.publisherOrg = a.org || '';
      if (!a.publisher) {
        for (var i = 0; i < KB.logs.length; i++) {
          var g = KB.logs[i];
          if (g.action === '上架内容' && g.target === a.id) { a.publisher = g.by; break; }
        }
      }
    });
  })();
/* ===== RP PATCH END ===== */

  /* 存量迁移：受众由一套旧术语拆成科普 / 培训两套（见 AUDIENCES）。幂等。
     映射写死、按内容线分开，不猜：
       患者及家属 → 科普：患者本人 + 家属 / 照护者；培训里同样的人 → 临床医生 / 护士（培训的对象是工作人员）
       登记人员   → 登记员 / 报告卡录入
       基层公卫   → 基层公卫人员
       临床医生   → 临床医生 / 护士
     同一内容因映射产生重复项时去重。 */
  var AUD_LEGACY_MAP = {
    '科普': { '患者及家属': ['患者本人', '家属 / 照护者'], '登记人员': ['社区医生 / 村医'], '基层公卫': ['社区医生 / 村医'], '临床医生': ['社区医生 / 村医'] },
    '培训': { '患者及家属': ['临床医生 / 护士'], '登记人员': ['登记员 / 报告卡录入'], '基层公卫': ['基层公卫人员'], '临床医生': ['临床医生 / 护士'] }
  };
  (function migrateAudiences() {
    KB.assets.forEach(function (a) {
      if (!a || !a.audiences || !a.audiences.length) return;
      var map = AUD_LEGACY_MAP[a.track] || AUD_LEGACY_MAP['科普'];
      var out = [];
      a.audiences.forEach(function (x) {
        (map[x] || [x]).forEach(function (y) { if (out.indexOf(y) < 0) out.push(y); });
      });
      a.audiences = out;
    });
  })();

  /* ================= 派生与门禁 ================= */
  /* 可见性：院内原创内容按机构隔离（谁能看谁的稿子）；转载件是官方权威科普，
     内容本身来自国家/省级平台，不属于任何一家登记处，所以全省共享——
     否则省管理员切过去看不到下级机构转的稿，也就无从上下架。 */
  function visibleIn(a) {
    if (isReprint(a)) return true;
    return a.lib === '省库' || a.org === ME.org;
  }

  /* ================= 筛选 / 分页 ================= */
  /* 内容库与转载专区共用同一套筛选条（关键词 / 病种 / 使用场景 / 形式 / 来源 / 状态）。
     2026-10-23 之前转载专区省掉了「使用场景」和「来源」两项，理由是转载件没有场景、
     来源恒为转载。但两个页签共用同一个 key（KB.filters[key]），少两个控件就意味着
     切页签时这两项筛选被静默保留却看不见，也改不回来；而且用户要在两处记两套控件。
     现在两侧控件一致：转载件的历史数据场景可能为空，选了场景就自然筛不出来，这是事实，不隐藏。 */
  function filterBar(key, track) {
    var f = KB.filters[key] || (KB.filters[key] = {});
    function sel(name, label, opts, def) {
      var cur = f[name] != null ? f[name] : (def || '');
      return '<div class="form-group"><label>' + label + '</label><select data-kbf="' + name + '">' +
        opts.map(function (o) { return '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
        '</select></div>';
    }
    var kw = f.kw || '';
    return '<div class="filter-toolbar" data-kbfilter="' + key + '">' +
      '<div class="form-group search-group"><label>关键词</label><input data-kbf="kw" value="' + esc(kw) + '" placeholder="标题 / 摘要 / 标签"></div>' +
      sel('site', '病种', ['全部病种'].concat(dictNames('sites'))) +
      sel('scene', '使用场景', ['全部场景'].concat(dictNames('scenes'))) +
      sel('kind', '形式', ['全部形式'].concat(dictNames('kinds'))) +
      sel('origin', '来源', ORIGIN_OPTS, '全部来源') +
      sel('status', '状态', ['全部状态', '上架', '下架'], '全部状态') +
      '<div class="filter-actions"><button class="btn btn-ghost btn-sm" data-kb="filterReset" data-arg="' + key + '">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="filter" data-arg="' + key + '">查询</button></div></div>';
  }
  /* 「来源」筛选：原创 / 转载是两件事（谁写的），与「形式」（这是什么）分两个下拉，不塞进形式里 */
  var ORIGIN_OPTS = ['全部来源', '原创', '转载'];
  /* 按字段表渲染筛选条（收藏页用） */
  function filterBarCustom(key, fields) {
    var f = KB.filters[key] || (KB.filters[key] = {});
    var html = fields.map(function (fd) {
      var cur = f[fd.k] != null ? f[fd.k] : (fd.def || '');
      if (fd.type === 'select') {
        return '<div class="form-group"><label>' + fd.label + '</label><select data-kbf="' + fd.k + '">' +
          fd.options.map(function (o) { return '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
          '</select></div>';
      }
      return '<div class="form-group search-group"><label>' + fd.label + '</label><input data-kbf="' + fd.k + '" value="' + esc(cur) + '" placeholder="' + esc(fd.ph || '') + '"></div>';
    }).join('');
    return '<div class="filter-toolbar" data-kbfilter="' + key + '">' + html +
      '<div class="filter-actions"><button class="btn btn-ghost btn-sm" data-kb="filterReset" data-arg="' + key + '">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="filter" data-arg="' + key + '">查询</button></div></div>';
  }
  function readFilter(key) {
    var box = document.querySelector('[data-kbfilter="' + key + '"]');
    if (!box) return;
    var f = KB.filters[key] || (KB.filters[key] = {});    box.querySelectorAll('[data-kbf]').forEach(function (el) { f[el.getAttribute('data-kbf')] = el.value; });
  }
  function pager(key, total, size) {
    var pages = Math.max(1, Math.ceil(total / size));
    var cur = KB.pageNo[key] || 1;
    if (cur > pages) cur = pages;
    return '<div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:12px 2px 0;font-size:12px;color:#64748b">' +
      '<span>第 ' + cur + ' / ' + pages + ' 页</span>' +
      '<button class="btn btn-ghost btn-xs" data-kb="page" data-arg="' + key + '|' + (cur - 1) + '"' + (cur <= 1 ? ' disabled' : '') + '>上一页</button>' +
      '<button class="btn btn-ghost btn-xs" data-kb="page" data-arg="' + key + '|' + (cur + 1) + '"' + (cur >= pages ? ' disabled' : '') + '>下一页</button></div>';
  }
  function slice(list, key, size) {
    var cur = KB.pageNo[key] || 1;
    return list.slice((cur - 1) * size, cur * size);
  }
  function applyFilter(list, key) {
    var f = KB.filters[key] || {};
    var kw = (f.kw || '').toLowerCase();
    return list.filter(function (a) {
      if (!visibleIn(a)) return false;
      if (f.site && f.site !== '全部病种' && a.sites.indexOf(f.site) < 0) return false;
      if (f.scene && f.scene !== '全部场景' && a.scenes.indexOf(f.scene) < 0) return false;
      if (f.kind && f.kind !== '全部形式' && a.kind !== f.kind) return false;
      if (f.origin && f.origin !== '全部来源' && (isReprint(a) ? '转载' : '原创') !== f.origin) return false;
      if (f.status && f.status !== '全部状态') { var wantOn = f.status === '上架'; if ((a.status === '启用') !== wantOn) return false; }
      if (kw && (a.title + a.summary + a.tags.join('') + (a.series || '')).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
  }

  /* 合集与内容共用同一套筛选条件：一张表里混排两种行，筛选必须都能命中 */
  function applyFilterToCollections(list, key) {
    var f = KB.filters[key] || {};
    var kw = (f.kw || '').toLowerCase();
    return list.filter(function (c) {
      if (!visibleIn(c)) return false;
      if (f.site && f.site !== '全部病种') return false;      /* 合集没有病种字段 */
      if (f.scene && f.scene !== '全部场景') return false;    /* 合集没有场景字段 */
      if (f.kind && f.kind !== '全部形式' && f.kind !== '合集') return false;
      /* 合集没有 origin：选了「原创 / 转载」时合集卡一律不出现，否则筛了等于没筛 */
      if (f.origin && f.origin !== '全部来源') return false;
      if (f.status && f.status !== '全部状态') { var wc = f.status === '上架'; if ((c.status === '启用') !== wc) return false; }
      if (kw && (c.name + ' ' + (c.desc || '') + ' ' + (c.tags || []).join(' ')).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
  }

  /* ================= 通用构件 ================= */
  /* 原生列表页形制：page-toolbar 只承载右上按钮（page-toolbar-title 全站 display:none，标题靠面包屑） */
  function heads(title, sub, acts) {
    return '<div class="page-toolbar"><div class="page-toolbar-title">' + title + '</div><div class="toolbar-actions">' + acts + '</div></div>';
  }
  function card(title, body, sub) {
    return '<div class="panel"><div class="panel-body">' + body + '</div></div>';
  }
  function table(headers, rows, emptyText, tight) {
    if (!rows.length) return '<div style="padding:22px;text-align:center;color:#64748b">' + (emptyText || '没有符合条件的内容') + '</div>';
    return '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }
  /* 原生 badge 承载病种/场景标签；blue 走 badge-info，其余 badge-neutral */
  function chips(arr, cls) { return (arr || []).map(function (t) { return '<span class="badge ' + (cls === 'blue' ? 'badge-info' : 'badge-neutral') + '" style="margin:0 4px 4px 0">' + esc(t) + '</span>'; }).join(''); }
  function act(text, action, arg, cls) { return '<button class="btn ' + (cls || 'btn-outline') + ' btn-sm" data-kb="' + action + '" data-arg="' + esc(arg) + '">' + text + '</button>'; }
  function opCell() { return '<div class="ops">' + Array.prototype.slice.call(arguments).filter(Boolean).join('') + '</div>'; }

  /* ---------- 弹窗 ---------- */
  function closeModal() { var m = document.querySelector('.kb-mask'); if (m) m.remove(); }
  function modal(title, sub, bodyHtml, ftHtml, wide) {
    var mask = document.createElement('div');
    mask.className = 'kb-mask';
    mask.innerHTML = '<div class="kb-modal' + (wide === false ? ' narrow' : '') + '">' +
      '<div class="hd"><div class="t">' + esc(title) + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</div>' +
      '<button class="x" data-kb="close">×</button></div>' +
      '<div class="bd">' + bodyHtml + '</div>' +
      (ftHtml ? '<div class="ft">' + ftHtml + '</div>' : '') + '</div>';
    document.body.appendChild(mask);
    mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(); });
    var first = mask.querySelector('input,textarea,select');
    if (first) setTimeout(function () { first.focus(); }, 30);
    return mask;
  }
  function confirmBox(title, msg, onOk) {
    modal(title, '', '<div style="font-size:13px;line-height:1.7;color:#334155">' + msg + '</div>',
      '<button class="btn btn-outline btn-sm" data-kb="close">取消</button><button class="btn btn-primary btn-sm" data-kb="confirmOk">确定</button>', false);
    KB._confirm = onOk;
  }

  /* 表单构件 */
  function fld(label, inner, full) { return '<div' + (full ? ' class="full"' : '') + '><label>' + label + '</label>' + inner + '</div>'; }
  function inp(id, v, ph) { return '<input id="' + id + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(ph || '') + '">'; }
  function sel1(id, opts, v) { return '<select id="' + id + '">' + opts.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'; }
  function ta(id, v, ph, rows) { return '<textarea id="' + id + '" rows="' + (rows || 4) + '" placeholder="' + esc(ph || '') + '">' + esc(v || '') + '</textarea>'; }
  function R(t) { return '<span class="req">*</span> ' + t; }

  /* ---------- 富文本正文 ----------
     为什么不用 textarea 让人手写 HTML：登记处的人不会写标签，而 Word 里复制来的内容
     在 textarea 里样式全丢、只剩一坨纯文本。
     contenteditable + document.execCommand 虽然被标了 deprecated，但在 Chromium 里
     是唯一零依赖的可行路径（原型不引第三方库）。存出来的仍是干净 HTML，详情页不用改。 */
  function richBox(id, html) {
    var tools = [
      ['bold', 'B', '加粗', '<b>B</b>'],
      ['h3', 'H', '小标题', 'H<span style="font-size:10px">3</span>'],
      ['insertUnorderedList', '•', '列表', '• 列表'],
      ['removeFormat', '⌫', '清格式', '⌫']
    ].map(function (t) {
      return '<button type="button" data-rte="' + t[0] + '" title="' + t[2] + '">' + t[3] + '</button>';
    }).join('');
    return '<div class="kb-rte" data-for="' + id + '">' +
      '<div class="kb-rte-bar">' + tools +
      '<button type="button" data-rte="para" title="正文段落">正文</button>' +
      '<span class="kb-rte-sep"></span>' +
      '<button type="button" data-rte="link" title="插入链接">链接</button>' +
      '</div>' +
      '<div class="kb-rte-area" id="' + id + '" contenteditable="true" ' +
      'data-placeholder="在这里写正文，或直接从 Word / 网页粘贴">' + String(html || '') + '</div>' +
      '</div>';
  }
  /* 光标位置：点了工具条再回到编辑区，不记住光标的话 execCommand 无从下手 */
  var _rteRange = null;
  function saveRteRange() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount) _rteRange = sel.getRangeAt(0).cloneRange();
  }
  function restoreRteRange(area) {
    var sel = window.getSelection();
    if (!sel) return;
    /* 当前选区就在这个编辑区里 → 直接用，它比缓存新 */
    if (sel.rangeCount) {
      var node = sel.getRangeAt(0).commonAncestorContainer;
      if (node && area && area.contains(node.nodeType === 3 ? node.parentNode : node)) return;
    }
    if (!_rteRange) return;
    sel.removeAllRanges(); sel.addRange(_rteRange);
  }
  function rteCmd(cmd, area) {
    if (!area) return;
    area.focus();
    restoreRteRange(area);
    if (cmd === 'h3') { document.execCommand('formatBlock', false, 'h3'); }
    else if (cmd === 'para') { document.execCommand('formatBlock', false, 'p'); }
    else if (cmd === 'link') {
      var url = window.prompt('链接地址（https:// 开头）', 'https://');
      if (url && /^https?:/i.test(url)) document.execCommand('createLink', false, url);
    } else { document.execCommand(cmd, false, null); }
    saveRteRange();
  }
  function bindRte() {
    document.querySelectorAll('.kb-rte').forEach(function (box) {
      var area = box.querySelector('.kb-rte-area');
      if (!area) return;
      box.querySelectorAll('[data-rte]').forEach(function (btn) {
        /* mousedown 而不是 click：click 会先让编辑区失焦、选区丢失 */
        btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
        btn.addEventListener('click', function (e) { e.preventDefault(); rteCmd(btn.getAttribute('data-rte'), area); });
      });
      area.addEventListener('keyup', saveRteRange);
      area.addEventListener('mouseup', saveRteRange);
      area.addEventListener('blur', saveRteRange);
      /* 粘贴：让人拿到的是「带格式的干净 HTML」，而不是一堆行内样式和 class */
      area.addEventListener('paste', function (e) {
        var cd = e.clipboardData;
        if (!cd) return;
        var html = cd.getData('text/html');
        var txt = cd.getData('text/plain');
        e.preventDefault();
        if (html) document.execCommand('insertHTML', false, cleanPastedHtml(html));
        else document.execCommand('insertText', false, txt);
      });
    });
  }
  /* 从 Word / 网页粘进来的 HTML 会带 mso-* 行内样式、Office 命名空间、大量 span。
     不过滤的话正文体积能翻好几倍，而且这些样式在详情页里也不该生效。 */
  function cleanPastedHtml(html) {
    var doc;
    try { doc = new DOMParser().parseFromString(String(html), 'text/html'); } catch (e) { return String(html); }
    var ALLOW = { P: 1, BR: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, H2: 1, H3: 1, H4: 1, UL: 1, OL: 1, LI: 1, A: 1, BLOCKQUOTE: 1, IMG: 1 };
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes || []).forEach(function (c) {
        if (c.nodeType === 3) return;
        if (c.nodeType !== 1) { c.remove(); return; }
        var tag = c.tagName;
        if (tag === 'STYLE' || tag === 'META' || tag === 'LINK' || tag === 'SCRIPT') { c.remove(); return; }
        walk(c);
        if (!ALLOW[tag]) {
          /* 不认识的标签拆开保留文字，不要整块丢掉 */
          while (c.firstChild) c.parentNode.insertBefore(c.firstChild, c);
          c.remove();
          return;
        }
        /* 属性只留必要项：图片 src、链接 href */
        Array.prototype.slice.call(c.attributes || []).forEach(function (at) {
          var keep = (tag === 'IMG' && at.name === 'src') || (tag === 'A' && at.name === 'href');
          if (!keep) c.removeAttribute(at.name);
        });
        /* Word 的 <b style="..."> 统一成 <strong>，<i> 成 <em>，样式表里才好统一 */
        if (tag === 'B') { var nb = doc.createElement('strong'); nb.innerHTML = c.innerHTML; c.parentNode.replaceChild(nb, c); }
        if (tag === 'I') { var ni = doc.createElement('em'); ni.innerHTML = c.innerHTML; c.parentNode.replaceChild(ni, c); }
      });
    };
    walk(doc.body);
    return doc.body.innerHTML;
  }

  /* ---------- 图集（图文形式） ----------
     小红书那种：一段正文 + 一组图。图是主体，正文只是引子。
     图片必须转成 dataURL 才显示得出来——附件历来只存文件名和大小，那只是「可下载的文件」。
     代价是占内存，所以原型阶段硬性限制：单张 ≤ 1 MB、每篇 ≤ 9 张，超了明确报错。 */
  var GALLERY_MAX = 9, GALLERY_MAX_BYTES = 1024 * 1024;
  function galleryBlock(a) {
    var list = KB._gallery || [];
    var cards = list.map(function (g, i) {
      return '<div class="kb-gi" data-gi="' + i + '">' +
        '<img src="' + esc(g.src) + '" alt="">' +
        '<div class="kb-gi-ops">' +
        (i > 0 ? '<button type="button" data-kb="galMove" data-arg="' + i + '|-1" title="前移">←</button>' : '') +
        (i < list.length - 1 ? '<button type="button" data-kb="galMove" data-arg="' + i + '|1" title="后移">→</button>' : '') +
        '<button type="button" data-kb="galRm" data-arg="' + i + '" title="移除">✕</button>' +
        '</div>' +
        '<input class="kb-gi-cap" data-gicap="' + i + '" value="' + esc(g.caption || '') + '" placeholder="配一句话（可选）" maxlength="60">' +
        '</div>';
    }).join('');
    return '<div class="full" id="kb-a-gallery">' +
      '<label>图片' + (list.length ? '<span class="kb-gal-n">' + list.length + ' / ' + GALLERY_MAX + '</span>' : '') + '</label>' +
      '<div class="kb-gal' + (list.length ? '' : ' is-empty') + '">' + cards +
      (list.length < GALLERY_MAX
        ? '<button type="button" class="kb-gal-add" data-kb="galAdd">＋<span>添加图片</span></button>'
        : '') +
      '</div>' +
      '<input type="file" id="kb-a-gallery-input" accept="image/png,image/jpeg,image/webp,image/gif" multiple style="display:none">' +
      '<div class="hint">最多 ' + GALLERY_MAX + ' 张，单张不超过 1 MB；拖动顺序用 ← → 调整</div>' +
      '</div>';
  }
  /* 这几个函数会被 FileReader 回调用到，而回调运行在全局作用域，
     拿不到模块内的函数声明——挂到 KB 上才能调到。 */
  KB.renderGallery = renderGallery;
  KB.addGalleryFiles = addGalleryFiles;
  KB.cleanPastedHtml = cleanPastedHtml;
  function renderGallery() {
    var box = $('kb-a-gallery');
    if (!box) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = galleryBlock(null);
    box.replaceWith(wrap.firstElementChild);
    bindGallery();
  }
  function bindGallery() {
    var inp = $('kb-a-gallery-input');
    if (!inp) return;
    inp.addEventListener('change', function () {
      addGalleryFiles(inp.files);
      inp.value = '';
    });
    document.querySelectorAll('[data-gicap]').forEach(function (el) {
      el.addEventListener('input', function () {
        var i = parseInt(el.getAttribute('data-gicap'), 10);
        if (KB._gallery && KB._gallery[i]) KB._gallery[i].caption = el.value;
      });
    });
  }
  function addGalleryFiles(files) {
    KB._gallery = KB._gallery || [];
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    var room = GALLERY_MAX - KB._gallery.length;
    if (room <= 0) { say('最多 ' + GALLERY_MAX + ' 张图片，先移除一些', 'error'); return; }
    var rejected = [], big = [], added = 0;
    list.slice(0, room).forEach(function (f) {
      if (!/^image\//.test(f.type)) { rejected.push(f.name); return; }
      if (f.size > GALLERY_MAX_BYTES) { big.push(f.name + '（' + fmtBytes(f.size) + '）'); return; }
      var r = new FileReader();
      r.onload = function () {
        KB._gallery.push({ src: String(r.result), caption: '', name: f.name });
        if (KB._gallery.length) renderGallery();
      };
      r.readAsDataURL(f);
      added++;
    });
    if (list.length > room) say('一次最多再加 ' + room + ' 张，其余请分批添加', 'info');
    if (rejected.length) say('不是图片，已跳过：' + rejected.join('、'), 'error');
    if (big.length) say('单张超过 1 MB，已跳过：' + big.join('、'), 'error');
    if (!added && !rejected.length && !big.length) say('没有可添加的图片', 'info');
  }
  function rmGallery(i) {
    if (!KB._gallery) return;
    KB._gallery.splice(parseInt(i, 10), 1);
    renderGallery();
  }
  function moveGallery(i, dir) {
    if (!KB._gallery) return;
    var j = i + (parseInt(dir, 10) || 0);
    if (j < 0 || j >= KB._gallery.length) return;
    var t = KB._gallery[i]; KB._gallery[i] = KB._gallery[j]; KB._gallery[j] = t;
    renderGallery();
  }

  /* 多选：以可点选 chip 承载，选中态写 data-pick */
  function pickBox(id, opts, chosen) {
    chosen = chosen || [];
    return '<div class="kb-picks" id="' + id + '">' + opts.map(function (o) {
      return '<button type="button" data-pick="' + esc(o) + '" class="' + (chosen.indexOf(o) >= 0 ? 'on' : '') + '">' + esc(o) + '</button>';
    }).join('') + '</div>';
  }
  function picked(id) { var out = []; var box = $(id); if (box) box.querySelectorAll('[data-pick].on').forEach(function (b) { out.push(b.getAttribute('data-pick')); }); return out; }

  /* 标签：预置标签点选 + 自定义补充。
     预置项来自「分类维护 › 标签」字典（只列启用项），点一下即选中。
     已不在字典里的历史标签（字典项后来被禁用）也照常显示并保持选中，
     否则编辑老内容时会把它的标签静默丢掉。 */
  function tagField(chosen) {
    chosen = chosen || [];
    var preset = dictNames('tags');
    var extra = chosen.filter(function (t) { return preset.indexOf(t) < 0; });
    var all = preset.concat(extra);
    return '<div class="kb-tagf">' +
      '<div class="kb-picks" id="kb-a-tags">' + all.map(function (t) {
        return '<button type="button" data-pick="' + esc(t) + '"' + (chosen.indexOf(t) >= 0 ? ' class="on"' : '') + '>' + esc(t) + '</button>';
      }).join('') + '</div>' +
      '<div class="kb-col-new">' +
      '<input id="kb-a-tags-new" placeholder="自定义标签，回车加入" maxlength="20">' +
      '<button type="button" class="btn btn-outline btn-xs" data-kb="formAddTag">＋ 加入</button>' +
      '</div>' +
      '<div class="hint">点选常用标签；没有合适的可自己加，加入后同样用于检索</div>' +
      '</div>';
  }
  /* 表单里新增标签：加进点选区并自动选中，重复的不再追加 */
  function formAddTag() {
    var el = $('kb-a-tags-new');
    var name = el ? String(el.value).trim() : '';
    if (!name) { say('先填标签名', 'error'); return; }
    var box = $('kb-a-tags');
    if (!box) return;
    var btn = box.querySelector('[data-pick="' + name.replace(/"/g, '') + '"]');
    if (btn) {
      btn.classList.add('on');
      if (el) el.value = '';
      say('已有标签「' + name + '」，已选中', 'info');
      return;
    }
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-pick', name);
    b.className = 'on';
    b.textContent = name;
    box.appendChild(b);
    if (el) el.value = '';
  }

  /* ================= 行渲染 ================= */
  /* 状态列只给 上架 / 已下架。门禁原因不在列表页挂第二个黄标——
     只在合集目录 / 加选列表里按需标注，列表页保持一列一义。 */
  function statusCell(a) {
    return stBadge(a.status);
  }
  /* ================= 页面 1 / 2 / 3：科普内容、培训内容、我的内容 =================
      三页统一为卡片形态：页头按钮 → 筛选条 → 卡片网格 → 分页。
      合集卡与内容卡同规格，合集排在前面。
      rpMode=true（转载专区视角）时走无封面的转载卡，且合集不参与。 */
  function cardsSection(list, cols, key, PAGE, rpMode, sortKey) {
    /* 转载专区走表格（一行一条 + 一个表头）：转载件字段少而齐（来源 / 原文日 / 形式 / 病种 / 标签），
        卡片会把每张都重复一遍同样的信息，横向扫读也不如列表快。原创内容仍是卡片。 */
    if (rpMode) return rpTableSection(list, key);
    var total = list.length;
    var cur = KB.pageNo[key] || 1;
    var pages = Math.max(1, Math.ceil(total / PAGE));
    if (cur > pages) { cur = pages; KB.pageNo[key] = cur; }
    var picks = list.slice((cur - 1) * PAGE, cur * PAGE);
    /* 按指标排序时不让合集卡置顶：排「下载量」却先出一张没有下载量的合集卡，等于没排 */
    var showCols = (sortKey && sortKey !== 'pub') ? [] : cols;
    var empty = total === 0 && !showCols.length && !hasAnyFilter(key);
    var emptyTip = '还没有内容，点右上「+ 新增」开始';
    var html = (picks.length || showCols.length) && window.KBDetail
      ? '<div class="kb-cards">' + window.KBDetail.cards(picks, showCols, false, { collections: showCols.length > 0 }) + '</div>'
      : '<div class="kb-empty">' + (empty
          ? emptyTip
          : '没有符合条件的内容 · <button class="btn btn-ghost btn-xs" data-kb="filterReset" data-arg="' + key + '">重置筛选</button>') + '</div>';
    if (window.KBDetail && window.KBDetail.hydrateCollectionCards && showCols.length) {
      setTimeout(function () { window.KBDetail.hydrateCollectionCards(showCols); }, 60);
    }
    return html + (total > PAGE
      ? '<div class="kb-list-foot"><span>共 ' + total + ' 条</span>' + pager(key, total, PAGE) + '</div>'
      : '');
  }

  /* ---------- 转载专区：表格形态 ----------
     一行一条，共用一个表头。列按「读者先看什么」排：
       左竖色条（平台色）→ 标题 → 来源 → 原文日期 → 形式 → 病种 → 标签 → 状态 → 操作。
     色条沿用原卡片的平台配色（RP_COLORS）：列表里照样能一眼分出国家卫健委 / 省卫健委 / 癌症中心。
     带出处复制 / 收藏 / 原文链接保留成图标按钮（在「操作」列），管理员多一个上下架。 */
  var RP_TABLE_PAGE = 10;
  /* 平台色：给每个来源一个稳定的竖色条颜色，一眼分平台。
     原卡片版在 kb-detail.js 里也有一份同样的表（卡片还没删干净之前两边要一致），
     列表版需要在这里自取，所以本文件单独存一份。 */
  var RP_COLORS = {
    '国家卫生健康委': '#1f6f4a', '国家癌症中心': '#1e4f7a', '中国疾控中心': '#2f6b3f',
    '江西省卫生健康委': '#7a3f1e', '中华医学会': '#5b3f7a', '江西省肿瘤登记中心': '#1e4f7a'
  };
  function rpColor(name) { return RP_COLORS[name] || '#244765'; }
  /* 窄列里的标签：最多两个，剩下的折成 +N。不做截断成「候诊播…」那种，
     截一半的词比 +N 更难认，而且点不开。 */
  function rpMiniTags(list) {
    var arr = (list || []).filter(Boolean);
    if (!arr.length) return '—';
    return arr.slice(0, 2).map(function (t) { return '<span class="kbx-tag kbx-tag--soft">' + esc(t) + '</span>'; }).join('') +
      (arr.length > 2 ? '<span class="kbx-tag kbx-tag--soft">+' + (arr.length - 2) + '</span>' : '');
  }
  function rpTableRow(a) {
    var s = a.source || {};
    var sites = (a.sites || []);
    var tags = (a.tags || []);
    var scenes = (a.scenes || []);
    var canToggle = canShelf(a);
    var copyBtn = '<button type="button" class="kbx-ico" title="带出处复制" data-kb="rpCopy" data-arg="' + esc(a.id) + '">⧉</button>';
    var favBtn = '<button type="button" class="kbx-ico' + (a.fav ? ' on' : '') + '" title="' + (a.fav ? '取消收藏' : '收藏') +
      '" data-kb="fav" data-arg="' + esc(a.id) + '">' + (a.fav ? '★' : '☆') + '</button>';
    var urlBtn = s.url ? '<a class="kbx-ico" title="查看原文" href="' + esc(s.url) + '" target="_blank" rel="noopener">↗</a>' : '';
    var shelfBtn = canToggle
      ? '<button type="button" class="kbx-ico' + (a.status === '启用' ? '' : ' on') + '" title="' +
        (a.status === '启用' ? '下架' : '上架') + '" data-kb="toggleStatus" data-arg="' + esc(a.id) + '">' +
        (a.status === '启用' ? '↓' : '↑') + '</button>' : '';
    return '<tr class="rp-row" style="--rp-c:' + rpColor(s.platform) + '">' +
      '<td class="rp-row-pc"><i class="rp-row-bar"></i></td>' +
      /* 主列：标题 + 摘要 + 「官方转载」角标。点击整块进详情，不另设「查看」按钮 */
      '<td class="kb-rec-main rp-row-main">' +
      '<span class="kb-rec-link" data-kb="open" data-arg="' + esc(a.id) + '">' + esc(a.title) + '</span>' +
      (a.summary ? '<div class="kb-rec-sub">' + esc(a.summary) + '</div>' : '') +
      '</td>' +
      '<td class="rp-row-plat"><b>' + esc(s.platform || '未注明来源') + '</b></td>' +
      '<td class="rp-nowrap">' + esc(s.publishedAt || '—') + '</td>' +
      '<td>' + esc(a.kind || '—') + '</td>' +
      '<td class="rp-row-tags">' + (sites.length ? sites.map(function (t) { return '<span class="kbx-tag">' + esc(t) + '</span>'; }).join('') : '—') + '</td>' +
      /* 使用场景：转载表单自 2026-10-23 起也采集，填了就要能看到。
         列窄，只显示前 2 个，多的折成 +N——完整值在详情页，这里给的是「有没有填」。
         「受众」列已按需求删除：表格只留决策需要的字段；受众在详情页与卡片信息条里看。 */
      '<td class="rp-row-tags rp-col-narrow">' + rpMiniTags(scenes) + '</td>' +

      '<td class="rp-row-tags">' + (tags.length ? tags.map(function (t) { return '<span class="kbx-tag kbx-tag--soft">' + esc(t) + '</span>'; }).join('') : '—') + '</td>' +
      '<td class="rp-row-st">' + (a.status === '启用'
        ? '<span class="rp-st rp-st--on">上架</span>'
        : '<span class="rp-st rp-st--off">已下架</span>') + '</td>' +
      '<td class="rp-row-ops"><div class="kbx-ico-row">' + copyBtn + favBtn + urlBtn + shelfBtn + '</div></td>' +
      '</tr>';
  }
  function rpTableSection(list, key) {
    var total = list.length;
    var cur = KB.pageNo[key] || 1;
    var pages = Math.max(1, Math.ceil(total / RP_TABLE_PAGE));
    if (cur > pages) { cur = pages; KB.pageNo[key] = cur; }
    var rows = list.slice((cur - 1) * RP_TABLE_PAGE, cur * RP_TABLE_PAGE).map(rpTableRow);
    var emptyTip = hasAnyFilter(key)
      ? '没有符合条件的内容 · <button class="btn btn-ghost btn-xs" data-kb="filterReset" data-arg="' + key + '">重置筛选</button>'
      : '还没有转载内容。点页头「⤓ 转载」粘贴官方原文链接即可转入。';
    var head = '<thead><tr>' +
      '<th class="rp-row-pc"></th>' +
      '<th>标题</th><th>来源</th><th>原文发布日期</th><th>形式</th><th>病种</th>' +
      '<th class="rp-col-narrow">使用场景</th><th>标签</th><th>状态</th><th>操作</th>' +
      '</tr></thead>';
    if (!rows.length) return '<div class="kb-empty">' + emptyTip + '</div>';
    return '<div class="table-wrap"><table class="data-table kb-rec-table kb-rp-table">' + head +
      '<tbody>' + rows.join('') + '</tbody></table></div>' +
      (total > RP_TABLE_PAGE
        ? '<div class="kb-list-foot"><span>共 ' + total + ' 条</span>' + pager(key, total, RP_TABLE_PAGE) + '</div>'
        : '');
  }
  /* ================= 内容库排序 =================
     可选：默认（上架优先 + 发布日期）、下载量、收藏量、上传时间。
     口径与「使用统计」一致，避免同一数字两处对不上：
       · 下载量 = 下载事件条数（同账号同内容不合并，统计页「下载总量」同此）
       · 收藏量 = 当前有效收藏条数（收藏事件减去取消收藏），不是所有人累计收藏次数
       · 上传时间 = 内容的上传时间；转载件按转载时间（入库那刻才有可能晚于原文发布日）
     全部指标先按全量事件算好再分页，不能只排当前页。 */
  var SORT_OPTS = [
    { k: 'pub', t: '默认' },
    { k: 'dl', t: '下载量' },
    { k: 'fav', t: '收藏量' },
    { k: 'up', t: '上传时间' }
  ];
  function assetMetric() {
    var m = {};
    KB.events.forEach(function (e) {
      var x = m[e.assetId] || (m[e.assetId] = { dl: 0, favOn: 0, favOff: 0 });
      if (e.act === '下载') x.dl++;
      else if (e.act === '收藏') x.favOn++;
      else if (e.act === '取消收藏') x.favOff++;
    });
    var out = {};
    Object.keys(m).forEach(function (id) {
      out[id] = { dl: m[id].dl, fav: Math.max(0, m[id].favOn - m[id].favOff) };
    });
    return out;
  }
  function sortState(track) { return KB.sort[track] || (KB.sort[track] = { key: 'pub', dir: -1 }); }
  /* 两条内容线各自的页码键。切换排序 / 方向时都要归零，否则停在高页码上会看起来「没有内容」。 */
  function resetLinePage(track) {
    KB.pageNo[track === '培训' ? 'kb-library:train' : 'kb-library:sci'] = 1;
  }
  function sortLabel(track) {
    var st = sortState(track);
    for (var i = 0; i < SORT_OPTS.length; i++) if (SORT_OPTS[i].k === st.key) return SORT_OPTS[i].t;
    return '默认';
  }
  /* 排序条：一组分段按钮 + 升降序切换。放在筛选条与卡片之间，切排序只重绘列表区。 */
  function sortBar(track) {
    var st = sortState(track);
    return '<div class="kb-sortbar">' +
      '<span class="kb-sortbar-lb">排序</span>' +
      SORT_OPTS.map(function (o) {
        return '<button type="button" class="kb-seg' + (o.k === st.key ? ' on' : '') + '" data-kb="sort" data-arg="' + track + '|' + o.k + '">' +
          esc(o.t) + '</button>';
      }).join('') +
      (st.key === 'pub' ? '' :
        '<button type="button" class="kb-sortbar-dir" data-kb="sortDir" data-arg="' + track + '" title="切换升序 / 降序">' +
        (st.dir === -1 ? '从高到低 ↓' : '从低到高 ↑') + '</button>') +
      '</div>';
  }
  function sortAssets(list, track) {
    var st = sortState(track);
    if (st.key === 'pub') return sortForList(list);
    var met = assetMetric();
    var zero = { dl: 0, fav: 0 };
    function keyOf(a) {
      if (st.key === 'up') return String(isReprint(a) ? (a.reprintedAt || a.createdAt || '') : (a.createdAt || ''));
      if (st.key === 'dl') return (met[a.id] || zero).dl;
      return (met[a.id] || zero).fav;
    }
    return list.slice().sort(function (x, y) {
      var a = keyOf(x), b = keyOf(y);
      var d = (st.key === 'up') ? a.localeCompare(b) : (a - b);
      if (d) return st.dir === -1 ? -d : d;
      /* 指标相同的，按默认顺序兜底，保证翻页时顺序稳定 */
      return String(x.id).localeCompare(String(y.id));
    });
  }
  function sortForList(list) {
    return list.slice().sort(function (x, y) {
      var sx = x.status === '启用' ? 0 : 1, sy = y.status === '启用' ? 0 : 1;
      if (sx !== sy) return sx - sy;
      /* 转载件的 publishedAt 是原文发布日期（很多是去年的稿），按它排会沉到最底，
         运营会以为「转了没生效」。同日期下按转进来的时间再排一次。 */
      var d = String(y.publishedAt).localeCompare(String(x.publishedAt));
      if (d) return d;
      return String(y.reprintedAt || '').localeCompare(String(x.reprintedAt || ''));
    });
  }
  /* ================= 科普 / 培训页的视角页签 =================
     转载不是独立模块：转载件就是这两页里的内容，列表 / 筛选 / 卡片 / 详情页全共用。
     这里只在同一页顶部多一个视角页签，切换只重渲染面板区，不跳页、不动面包屑：
       内容库   该内容线全部可见内容（原创 + 转载），卡片带封面，可用「来源」筛
       转载专区 只列该内容线**已经转载**的，无封面卡片（官方源拿不到封面，见 kb-detail.js 的 rpCard）
     两个数字都按「当前内容线 + 可见」统计，与列表渲染同口径——口径不一致会出现
     「tab 写 21 条、点进去只有 3 条」这种对不上的情况。 */
  function linePool(track) {
    return KB.assets.filter(function (a) { return a.track === track && visibleIn(a); });
  }
  function lineTabs(track) {
    var cur = KB.lineView || 'lib';
    var pool = linePool(track);
    var rp = pool.filter(isReprint);
    /* 页签只报总数，不挂角标：三个数字挤在一个页签里读不出层级，也不能点。 */
    return '<div class="kb-line-tabs">' +
      '<button type="button" class="kb-line-tab' + (cur === 'lib' ? ' on' : '') + '" data-kb="lineView" data-arg="lib">内容库' +
      '<span class="kb-line-tab-n">' + pool.length + '</span></button>' +
      '<button type="button" class="kb-line-tab' + (cur === 'reprint' ? ' on' : '') + '" data-kb="lineView" data-arg="reprint">转载专区' +
      '<span class="kb-line-tab-n">' + rp.length + '</span>' +
      '</button></div>';
  }
  /* 科普内容 */
  function sciPage() { return linePage('科普', 'kb-library:sci'); }
  /* 培训内容 */
  function libraryTab(track, key) { return linePage(track, key); }
  /* 一条内容线的一页：内容库 / 转载专区两种视角共用 */
  function linePage(track, key) {
    var PAGE = 9;
    var all = linePool(track);
    var rpMode = (KB.lineView || 'lib') === 'reprint';
    if (rpMode) {
      /* 转载专区：只列**已经转载**的，表格形态（一行一条 + 一个表头）。
         「官方可转载清单」已从本页移除：转到库里的才是资产，候选清单属于进货动作，
         不该和已转入的内容挤在一屏，也不用一屏看两份数据、两套按钮。
         原有的清单逻辑（rpFeedBlock）保留在文件里备用，本页不再渲染。 */
      var rpList = sortAssets(applyFilter(all.filter(isReprint), key), track);
      return '<div class="panel"><div class="panel-body">' + lineTabs(track) +
        filterBar(key, track) + sortBar(track) +
        cardsSection(rpList, [], key, PAGE, true) +
        '</div></div>';
    }
    /* 先排序再分页：cardsSection 里才切片，排序必须发生在切片之前，否则只排了当前页 */
    var list = sortAssets(applyFilter(all, key), track);
    var cols = applyFilterToCollections(KB.collections.filter(function (c) { return c.track === track; }), key);
    return '<div class="panel"><div class="panel-body">' + lineTabs(track) + filterBar(key, track) + sortBar(track) +
      cardsSection(list, cols, key, PAGE, false, sortState(track).key) + '</div></div>';
  }
  /* ================= 我的内容（页内三页签：收藏 / 下载 / 上传） =================
     三个视角是同一个人看自己的三种关系，不该占三条侧导航——侧栏留给"板块里有什么"，
     页签留给"同一个人身上的三个面"。切换只重渲染面板区，不跳页、不改面包屑。
     收藏 = 看内容（卡片形态，与科普/培训一致）；下载/上传 = 流水与资产（表格形态，卡片装不下字段）。 */
  var MINE_VIEWS = [
    { k: 'fav', t: '我的收藏', n: 'fav' },
    { k: 'download', t: '我的下载', n: 'dl' },
    { k: 'upload', t: '我的上传', n: 'up' }
  ];
  function mineCounts() {
    var u = currentUser();
    var dl = 0, up = 0;
    for (var i = 0; i < KB.events.length; i++) {
      var e = KB.events[i];
      if (e.uid !== u.id) continue;
      if (e.act === '下载') dl++;
    }
    for (var j = 0; j < KB.assets.length; j++) { if (KB.assets[j].createdBy === u.id) up++; }
    return { fav: myEvents('收藏').length, dl: dl, up: up };
  }
  function mineTabs() {
    var cur = KB.mineView || 'fav', c = mineCounts();
    return '<div class="kb-mine-tabs">' + MINE_VIEWS.map(function (v) {
      var n = c[v.n] || 0;
      return '<button type="button" class="kb-mine-tab' + (v.k === cur ? ' on' : '') + '" data-kb="mineView" data-arg="' + v.k + '">' +
        esc(v.t) + '<span class="kb-mine-tab-n">' + n + '</span></button>';
    }).join('') + '</div>';
  }
  function mineTab() {
    var view = KB.mineView || 'fav';
    var body = view === 'download' ? downloadPanel()
      : view === 'upload' ? uploadPanel()
        : favPanel();
    return '<div class="panel"><div class="panel-body">' + mineTabs() + body + '</div></div>';
  }

  /* ---------- 我的收藏：列表形态（与我的下载同一套）---------- */
  var FAV_FILTER = [
    { k: 'kw', label: '关键词', type: 'text', ph: '标题 / 摘要 / 标签' },
    { k: 'cat', label: '分类', type: 'select', options: ['全部分类', '科普内容', '培训材料'], def: '全部分类' },
    { k: 'kind', label: '形式', type: 'select', options: ['全部形式'].concat(dictNames('kinds')) },
    { k: 'site', label: '病种', type: 'select', options: ['全部病种'].concat(dictNames('sites')) },
    { k: 'scene', label: '使用场景', type: 'select', options: ['全部场景'].concat(dictNames('scenes')) }
  ];
  var FAV_KEY = 'kb-library:mine';
  /* 收藏真值在事件表：按当前账号的收藏事件倒序，再把内容对象取出来。
     不读 a.favAt——那是导出缓存，多人收藏同一条时会互相覆盖。
     返回 { a, at }：at 是收藏时间，列表要显示「什么时候收的」。 */
  function favEntries() {
    var f = KB.filters[FAV_KEY] || {};
    var kw = (f.kw || '').toLowerCase();
    var seen = {}, order = [];
    myEvents('收藏').forEach(function (e) {
      if (seen[e.assetId]) return;
      var a = find(KB.assets, e.assetId);
      if (!a || !visibleIn(a)) return;
      seen[e.assetId] = 1;
      order.push({ a: a, at: e.at });
    });
    return order.filter(function (x) {
      var a = x.a;
      if (f.cat === '科普内容' && a.track !== '科普') return false;
      if (f.cat === '培训材料' && a.track !== '培训') return false;
      if (f.kind && f.kind !== '全部形式' && a.kind !== f.kind) return false;
      if (f.site && f.site !== '全部病种' && (a.sites || []).indexOf(f.site) < 0) return false;
      if (f.scene && f.scene !== '全部场景' && (a.scenes || []).indexOf(f.scene) < 0) return false;
      if (kw && (a.title + a.summary + (a.tags || []).join('')).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
  }
  function favList() { return favEntries().map(function (x) { return x.a; }); }

  /* 我的收藏：列表形态，与「我的下载」同一套行骨架
     （时间 / 标题 / 内容线 / 形式 / 操作）。
     为什么从卡片改成列表：卡片只适合图文与合集，转载件没有封面、正文也可能只存了出处，
     卡片上看着就是一块空色块，收藏了什么读不出来；列表一行一条，标题、来源、时间都看得见，
     也便于按收藏时间排序与批量取消收藏。 */
  function favRow(x) {
    var a = x.a;
    var rp = isReprint(a);
    return '<tr>' +
      '<td class="rp-nowrap">' + esc(x.at || '—') + '</td>' +
      '<td class="kb-rec-main"><span class="kb-rec-link" data-kb="view" data-arg="' + esc(a.id) + '">' + esc(a.title) + '</span>' +
      (rp ? '<span class="rp-chip" style="height:17px;padding:0 6px;font-size:10.5px;margin-left:6px">转载·' + esc((a.source || {}).platform || '') + '</span>' : '') +
      (a.summary ? '<div class="kb-rec-sub">' + esc(favBrief(a)) + '</div>' : '') +
      '</td>' +
      '<td>' + esc(a.track || '—') + '</td>' +
      '<td>' + esc(a.kind || '—') + '</td>' +
      '<td class="ops">' + opCell(
        act('打开', 'view', a.id, 'btn-outline'),
        act('取消收藏', 'fav', a.id, 'btn-ghost')) + '</td>' +
      '</tr>';
  }
  /* 列表里的摘要压成一句：转载件的摘要常常是原文开头，太长会把行高撑开 */
  function favBrief(a) {
    var t = String(a.summary || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return t.length > 48 ? t.slice(0, 48) + '…' : t;
  }
  function favPanel() {
    var PAGE = 10;
    var list = favEntries();
    var total = list.length;
    var cur = KB.pageNo[FAV_KEY] || 1;
    var pages = Math.max(1, Math.ceil(total / PAGE));
    if (cur > pages) { cur = pages; KB.pageNo[FAV_KEY] = cur; }
    var rows = list.slice((cur - 1) * PAGE, cur * PAGE).map(favRow);
    var foot = '<div class="kb-list-foot"><span>共 ' + total + ' 条收藏</span>' + pager(FAV_KEY, total, PAGE) + '</div>';
    return filterBarCustom(FAV_KEY, FAV_FILTER) + grid(
      ['收藏时间', '内容标题', '内容线', '形式', '操作'],
      rows,
      '还没有收藏。在「科普内容」或「培训内容」里点卡片或详情页的 ☆ 收藏，会出现在这里。',
      foot);
  }

  /* ---------- 表格：下载 / 上传 / 统计三处共用的行骨架 ---------- */
  function grid(headers, rows, emptyHtml, footHtml) {
    if (!rows.length) return '<div class="kb-empty">' + (emptyHtml || '没有符合条件的内容') + '</div>' + (footHtml || '');
    return '<div class="table-wrap"><table class="data-table kb-rec-table"><thead><tr>' +
      headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' + (footHtml || '');
  }
  /* 下载记录筛选：只留「关键词」与「内容线」。
     「时间范围」「下载途径」已按需求删除——下载时间本来就在表格第一列、途径也在表格里，
     两个下拉都得先点「查询」才生效，不如直接看列表。留着旧值会导致筛选条件隐藏却仍然生效。 */
  var DL_FILTER = [
    { k: 'kw', label: '关键词', type: 'text', ph: '内容标题 / 文件名' },
    { k: 'track', label: '内容线', type: 'select', options: ['全部内容线', '科普', '培训'], def: '全部内容线' }
  ];
  var DL_KEY = 'kb-mine:download';
  /* 使用统计页仍在用：时间范围口径（近 7 / 30 / 90 天）与上一周期的起止日都靠它算 */
  function daysAgo(n) {
    var d = new Date(); d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function downloadList() {
    var f = KB.filters[DL_KEY] || {};
    var kw = (f.kw || '').toLowerCase();
    return myEvents('下载').filter(function (e) {
      if (f.track && f.track !== '全部内容线' && e.track !== f.track) return false;
      if (kw) {
        var a = find(KB.assets, e.assetId);
        var s = ((a ? a.title : '') + ' ' + (e.detail.fileName || '')).toLowerCase();
        if (s.indexOf(kw) < 0) return false;
      }
      return true;
    });
  }
  function downloadRow(e) {
    var a = find(KB.assets, e.assetId);
    var title = a ? a.title : '（内容已删除）';
    /* 流水表只留五个可见列：下载时间、内容标题、内容线、形式、操作。
       「下载途径」「文件名」「文件大小」「内容编号」都已删除——前三项是下载那一刻的明细，
       编号点标题进详情就能看到；逐行重复只占宽度，看不出规律。
       这些值仍随事件存着（导出报表要用），「再次下载」从 e.detail 取，不依赖可见列。 */
    return '<tr>' +
      '<td>' + esc(e.at) + '</td>' +
      '<td class="kb-rec-main">' + (a
        ? '<span class="kb-rec-link" data-kb="view" data-arg="' + esc(a.id) + '">' + esc(title) + '</span>'
        : '<span style="color:#94a3b8">' + esc(title) + '</span>') + '</td>' +
      '<td>' + esc(e.track || '—') + '</td>' +
      '<td>' + esc(e.kind || '—') + '</td>' +
      '<td class="ops">' + opCell(
        act('再次下载', 'dlAgain', e.assetId + '|' + (e.detail.fileName || '')),
        a ? act('打开详情', 'view', a.id, 'btn-ghost') : '') + '</td>' +
      '</tr>';
  }
  function downloadPanel() {
    var PAGE = 10;
    var list = downloadList();
    var total = list.length;
    var cur = KB.pageNo[DL_KEY] || 1;
    var pages = Math.max(1, Math.ceil(total / PAGE));
    if (cur > pages) { cur = pages; KB.pageNo[DL_KEY] = cur; }
    var rows = list.slice((cur - 1) * PAGE, cur * PAGE).map(downloadRow);
    var foot = '<div class="kb-list-foot"><span>共 ' + total + ' 条下载记录</span>' + pager(DL_KEY, total, PAGE) + '</div>';
    return filterBarCustom(DL_KEY, DL_FILTER) + grid(
      ['下载时间', '内容标题', '内容线', '形式', '操作'],
      rows,
      '还没有下载记录。在「科普内容」或「培训内容」里点卡片上的 ↓ 取用附件后，会出现在这里。',
      foot);
  }

  /* ---------- 我的上传：内容资产表，不是事件表 ----------
     上传的产物是内容本身，要能改能删，所以读 assets.createdBy；
     事件表里那条「上传」只用于统计计数。 */
  var UP_FILTER = [
    { k: 'kw', label: '关键词', type: 'text', ph: '标题 / 摘要 / 编号' },
    { k: 'track', label: '内容线', type: 'select', options: ['全部内容线', '科普', '培训'], def: '全部内容线' },
    { k: 'kind', label: '形式', type: 'select', options: ['全部形式'].concat(dictNames('kinds')) },
    { k: 'origin', label: '来源', type: 'select', options: ORIGIN_OPTS, def: '全部来源' },
    { k: 'status', label: '状态', type: 'select', options: ['全部状态', '上架', '下架'], def: '全部状态' }
  ];
  var UP_KEY = 'kb-mine:upload';
  function uploadList() {
    var u = currentUser();
    var f = KB.filters[UP_KEY] || {};
    var kw = (f.kw || '').toLowerCase();
    return KB.assets.filter(function (a) {
      if (a.createdBy !== u.id) return false;
      if (f.track && f.track !== '全部内容线' && a.track !== f.track) return false;
      if (f.kind && f.kind !== '全部形式' && a.kind !== f.kind) return false;
      if (f.origin && f.origin !== '全部来源' && (isReprint(a) ? '转载' : '原创') !== f.origin) return false;
      if (f.status && f.status !== '全部状态') { var wantOn = f.status === '上架'; if ((a.status === '启用') !== wantOn) return false; }
      if (kw && (a.title + a.summary + a.id).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    }).sort(function (x, y) { return String(y.createdAt || '').localeCompare(String(x.createdAt || '')); });
  }
  /* 单条内容的累计观看/下载：账号维度的聚合在「使用统计」，这里是内容粒度，粒度不同不重复 */
  function assetStats(assetId) {
    var view = 0, dl = 0;
    for (var i = 0; i < KB.events.length; i++) {
      var e = KB.events[i];
      if (e.assetId !== assetId) continue;
      if (e.act === '观看') view++;
      else if (e.act === '下载') dl++;
    }
    return { view: view, dl: dl };
  }
  function uploadRow(a) {
    var st = assetStats(a.id);
    var cls = (KB.collections.filter(function (c) { return c.members.indexOf(a.id) >= 0; })
      .map(function (c) { return c.name; }).join('、')) || '—';
    return '<tr>' +
      '<td>' + esc(a.id) + '</td>' +
      '<td class="kb-rec-main"><span class="kb-rec-link" data-kb="view" data-arg="' + esc(a.id) + '">' + esc(a.title) + '</span>' +
      '<div class="kb-rec-sub">' + esc(a.summary) + '</div></td>' +
      '<td>' + esc(a.track) + '</td>' +
      '<td>' + esc(a.kind) + (isReprint(a) ? ' <span class="rp-chip" style="height:18px;padding:0 6px;font-size:10.5px">转载</span>' : '') + '</td>' +
      '<td>' + statusCell(a) + '</td>' +
      /* 「上传人 / 上传机构」列已按需求删除：本页只列当前账号自己上传的内容，
         人必然是本人；机构在多数情况下与当前身份一致，占一列反而挤掉后面的统计列。
         需要看机构归属时，进详情页信息条或「使用统计」页。 */
      '<td>' + esc(a.createdAt || '—') + '</td>' +
      '<td class="kb-rec-file">' + esc(cls) + '</td>' +
      '<td class="num">' + st.view + '</td>' +
      '<td class="num">' + st.dl + (isReprint(a) && a.copyCount ? '<br><span style="font-size:11px;color:#94a3b8;font-weight:400">外发 ' + a.copyCount + ' 次</span>' : '') + '</td>' +
      '<td class="ops">' + opCell(
        act('预览', 'view', a.id, 'btn-outline'),
        act('编辑', 'edit', a.id),
        a.status === '启用' ? act('下架', 'toggleStatus', a.id, 'btn-ghost') : act('上架', 'toggleStatus', a.id, 'btn-ghost'),
        act('删除', 'del', a.id, 'btn-danger')) + '</td>' +
      '</tr>';
  }
  function uploadPanel() {
    var PAGE = 10;
    var list = uploadList();
    var total = list.length;
    var cur = KB.pageNo[UP_KEY] || 1;
    var pages = Math.max(1, Math.ceil(total / PAGE));
    if (cur > pages) { cur = pages; KB.pageNo[UP_KEY] = cur; }
    var rows = list.slice((cur - 1) * PAGE, cur * PAGE).map(uploadRow);
    var foot = '<div class="kb-list-foot"><span>共 ' + total + ' 条</span>' + pager(UP_KEY, total, PAGE) + '</div>';
    return filterBarCustom(UP_KEY, UP_FILTER) + grid(
      ['编号', '标题 / 摘要', '内容线', '形式', '状态', '上传时间', '所属合集', '累计观看', '累计下载', '操作'],
      rows,
      '你还没有上传内容。点右上「+ 新增科普内容 / + 新增培训内容」，或在「科普内容」页用「批量上传」。',
      foot);
  }

  /* 拦住上架的原因：只有 shelfBlocker 一个口径 */
  function shelfGate(a) {
    var why = shelfBlocker(a);
    return why ? [why] : [];
  }

  /* ================= 使用统计 =================
     口径四条（与页面副标题一致，改口径必须同时改文案，否则操作员会追问数字对不上）：
       1. 观看量 = 观看次数，不是人数（「观看账号数」列已按需求删除）
       2. 30 分钟内同账号同内容重复播放已在 pushEvent 里合并
       4. 收藏量 = 当前有效收藏条数，不做历史快照
     权限收窄统一在 scopedEvents()，本页其余部分不重复判权。 */
  var USAGE_KEY = 'kb-usage';
  function usageState() {
    /* view：页内两页签。content = 按内容统计（一行一条内容），org = 按机构统计（一行一家机构）。
       两条线共用同一份筛选与同一组 KPI，只是下面换了聚合维度，所以不拆成两个菜单项。 */
    var st = KB.usageSt || (KB.usageSt = { view: 'content', days: '近 30 天', track: '全部内容线', kind: '全部形式', sort: 'view', dir: -1, artSort: 'heat', artDir: -1, orgSort: 'view', orgDir: -1 });
    return st;
  }
  /* 读筛选条。统计页用自己的 data-kbu：选项随身份/字典变，走不了静态的 data-kbf。
     现有下拉只有时间范围、内容线、形式三项；机构 / 账号 / 行为已删除，对应的
     usageOrgs() / usageAccounts() 一并移除（页面不再需要生成这两组选项）。 */
  function readUsageBar() {
    var st = usageState();
    document.querySelectorAll('[data-kbu]').forEach(function (el) {
      st[el.getAttribute('data-kbu')] = el.value;
    });
  }
  /* 过滤后的范围。所有 KPI / 图 / 表都从这里出，保证"卡片数 = 表里加起来" */
  function usageScope() {
    var st = usageState();
    var since = '';
    if (st.days === '近 7 天') since = daysAgo(7);
    else if (st.days === '近 90 天') since = daysAgo(90);
    else if (st.days !== '全部') since = daysAgo(30);
    return scopedEvents().filter(function (e) {
      if (since && e.day < since) return false;
      if (st.track !== '全部内容线' && e.track !== st.track) return false;
      if (st.kind !== '全部形式' && e.kind !== st.kind) return false;
      /* 机构 / 账号 / 行为三个筛选已删除，这里不再按它们过滤。
         数据范围仍由 scopedEvents() 按当前身份收窄（院内只看本院、市级看本市、省级看全省），
         所以删下拉不会变成「看到不该看的数据」。 */
      return true;
    });
  }
  function usageAgg(list) {
    var acc = {
      view: 0, dl: 0, up: 0, fav: 0,
      users: {}, assets: {}, days: {}
    };
    list.forEach(function (e) {
      if (e.act === '观看') acc.view++;
      else if (e.act === '下载') acc.dl++;
      else if (e.act === '上传') acc.up++;
      else if (e.act === '收藏') acc.fav++;
      acc.users[e.uid] = 1;
      if (!acc.assets[e.assetId]) acc.assets[e.assetId] = { view: 0, dl: 0, fav: 0, users: {} };
      var s = acc.assets[e.assetId];
      if (e.act === '观看') { s.view++; s.users[e.uid] = 1; }
      else if (e.act === '下载') s.dl++;
      else if (e.act === '收藏') s.fav++;
      if (!acc.days[e.day]) acc.days[e.day] = { view: 0, dl: 0 };
      if (e.act === '观看') acc.days[e.day].view++;
      else if (e.act === '下载') acc.days[e.day].dl++;
    });
    return acc;
  }
  /* 上一周期同长度：用来算环比。没有上一周期数据就显示「—」，不编造 */
  /* 上一周期：口径必须与 usageScope() 完全一致，只把时间窗往前挪一格。
     少判一个条件，环比就会拿别的范围去比，涨跌幅是假的。 */
  /* 指标卡：三个维度各给一套口径，卡片一律从 usageAgg 出数，
     保证「卡片数 = 表里加起来」。.kb-kpis 是 4 列栅格，两套都只给 4 张。 */
  function usageKpiCards(a, defs) {
    return '<div class="kb-kpis">' + defs.map(function (d) {
      var cur = d.cur(a);
      return '<div class="kb-kpi"><div class="kb-kpi-l">' + d.label + '</div>' +
        '<div class="kb-kpi-v">' + cur + '</div>' +
        /* 环比（较上一周期 ±N%）已按需求删除，只保留口径说明 */
        (d.extra ? '<div class="kb-kpi-s">' + d.extra + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }
  /* 按内容统计的卡：沿用需求文档 4.8 的四卡口径，不在这里改数
     （收藏量在内容热度排行里已有列，不在卡上重复）。
     转载入库也记一条「上传」事件（op:'转载'）。不拆的话转载多的月份「上传内容数」会虚高、
     看着像本季原创产出，所以在副标题上单列。 */
  function usageKpisContent(a, list) {
    var rpUp = (list || []).filter(function (e) { return e.act === '上传' && e.detail && e.detail.op === '转载'; }).length;
    return usageKpiCards(a, [
      { label: '观看总次数', cur: function (x) { return x.view; }, extra: '含重复播放去重' },
      { label: '下载总量', cur: function (x) { return x.dl; } },
      { label: '上传内容数', cur: function (x) { return x.up; }, extra: '含停用草稿' + (rpUp ? '，其中转载 ' + rpUp : '') },
      { label: '活跃账号数', cur: function (x) { return Object.keys(x.users).length; } }
    ]);
  }
  /* 按机构统计的卡：机构数/账号数是这一侧独有的口径，观看与下载沿用同一套事件计数 */
  function usageKpisOrg(a, orgN) {
    return usageKpiCards(a, [
      { label: '活跃机构数', cur: function () { return orgN; }, extra: '周期内有行为' },
      { label: '活跃账号数', cur: function (x) { return Object.keys(x.users).length; } },
      { label: '观看总次数', cur: function (x) { return x.view; } },
      { label: '下载总量', cur: function (x) { return x.dl; } }
    ]);
  }
  /* 按用户统计的卡：三个维度共用观看与下载两个口径，只换第一张卡的「用户数」 */
  function usageKpisUser(a, userN) {
    return usageKpiCards(a, [
      { label: '活跃用户数', cur: function () { return userN; }, extra: '周期内有行为' },
      { label: '观看总次数', cur: function (x) { return x.view; } },
      { label: '下载总量', cur: function (x) { return x.dl; } },
      { label: '上传内容数', cur: function (x) { return x.up; }, extra: '含停用草稿' }
    ]);
  }
  /* 统计维度下拉。原先顶部是「按内容统计 / 按机构统计」两个页签，
     改成筛选条里的一个下拉：两件事本来就是「同一批数据换一种聚合维度」，
     做成页签会让人以为是两个页面；做成下拉后，筛选条、指标卡、唯一那张表排在一段里，
     并且只显示所选维度的表（原来按机构统计时同时出「机构排行」和「账号排行」两张表）。 */
  function usageDimSel(list) {
    var st = usageState();
    var view = (st.view === 'org' || st.view === 'user') ? st.view : 'content';
    var assetN = {}, orgN = {}, userN = {};
    list.forEach(function (e) { if (e.assetId) assetN[e.assetId] = 1; if (e.org) orgN[e.org] = 1; if (e.uid) userN[e.uid] = 1; });
    var defs = [
      { k: 'content', t: '按内容统计', n: Object.keys(assetN).length },
      { k: 'org', t: '按机构统计', n: Object.keys(orgN).length },
      { k: 'user', t: '按用户统计', n: Object.keys(userN).length }
    ];
    return '<div class="form-group"><label>统计维度</label><select data-kbu="view">' + defs.map(function (v) {
      return '<option value="' + v.k + '"' + (v.k === view ? ' selected' : '') + '>' + esc(v.t) + '（' + v.n + ' 条）</option>';
    }).join('') + '</select></div>';
  }
  function countOrgs(list) {
    var seen = {}, n = 0;
    (list || []).forEach(function (e) { if (e.org && !seen[e.org]) { seen[e.org] = 1; n++; } });
    return n;
  }

  function usagePage() {
    var st = usageState();
    var list = usageScope();
    var a = usageAgg(list);

  var ROLE_LABEL = { admin: '系统管理员', registry: '登记处', hospital: '医院用户' };
  function roleName(r) { return ROLE_LABEL[r] || r || '—'; }
  /* 筛选条：统计维度 + 时间范围 + 内容线 + 形式。
     「机构」「账号」「行为」已按需求删除——这三个维度在下面的表格里已经逐行给出
     （账号排行有机构/姓名列，内容热度排行有形式列），再放三个下拉既占地方，
     又必须点「查询」才生效，操作体验不如直接看表。
     数据范围仍按当前身份在 scopedEvents() 里收窄，删下拉不影响权限。
     「统计维度」放最左：它决定下面那张表是「一条内容一行」还是「一家机构一行」，是先于筛选的上下文。 */
    var filter = '<div class="filter-toolbar">' +
      usageDimSel(list) +
      '<div class="form-group"><label>时间范围</label><select data-kbu="days">' +
      ['近 7 天', '近 30 天', '近 90 天', '全部'].map(function (v) { return '<option' + (v === st.days ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label>内容线</label><select data-kbu="track">' +
      ['全部内容线', '科普', '培训'].map(function (v) { return '<option' + (v === st.track ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label>形式</label><select data-kbu="kind">' +
      ['全部形式'].concat(dictNames('kinds')).map(function (v) { return '<option' + (v === st.kind ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select></div>' +
      '<div class="filter-actions"><button class="btn btn-ghost btn-sm" data-kb="usageReset">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="usageQuery">查询</button></div></div>';

    /* 表一：账号使用排行 */
    var perUser = {};
    list.forEach(function (e) {
      if (!perUser[e.uid]) perUser[e.uid] = { view: 0, dl: 0, up: 0, fav: 0, last: '' };
      var r = perUser[e.uid];
      if (e.act === '观看') r.view++;
      else if (e.act === '下载') r.dl++;
      else if (e.act === '上传') r.up++;
      else if (e.act === '收藏') r.fav++;
      if (String(e.at) > r.last) r.last = e.at;
    });
    var accRows = Object.keys(perUser).map(function (uid) {
      var u = findUser(uid) || { name: '（已删除账号）', org: '—', role: '—', account: uid };
      return { uid: uid, u: u, r: perUser[uid] };
    });
    /* 「最后活跃」列已按需求删除：它只是给每行标个时间戳，不构成判断依据，
       还占掉本可以留给数值列的位置。事件里的时间字段仍保留，聚合时照旧取最大值。 */
    var sortKey = { view: 'view', dl: 'dl', up: 'up', fav: 'fav' }[st.sort] || 'view';
    accRows.sort(function (x, y) {
      return st.dir * (x.r[sortKey] - y.r[sortKey]);
    });
    /* grid() 会自己包 <th>，这里只返回列头内部内容，否则会变成 <th><th>… 的嵌套 */
    function th(label, key) {
      var on = st.sort === key;
      return '<span class="kb-sort' + (on ? ' on' : '') + '" data-kb="usageSort" data-arg="' + key + '">' +
        label + (on ? (st.dir === -1 ? ' ↓' : ' ↑') : '') + '</span>';
    }
    var accTable = grid(
      ['账号', '姓名', '机构', '角色', th('观看次数', 'view'), th('下载量', 'dl'), th('上传量', 'up'), th('收藏量', 'fav')],
      accRows.map(function (x) {
        return '<tr>' +
          '<td>' + esc(x.u.account) + '</td>' +
          '<td>' + esc(x.u.name) + '</td>' +
          '<td>' + esc(x.u.org) + '</td>' +
          '<td>' + esc(roleName(x.u.role)) + '</td>' +
          '<td class="num">' + x.r.view + '</td>' +
          '<td class="num">' + x.r.dl + '</td>' +
          '<td class="num">' + x.r.up + '</td>' +
          '<td class="num">' + x.r.fav + '</td>' +
          '</tr>';
      }),
      '所选范围内没有账号行为记录。',
      '');

    /* 表二：内容热度排行
       筛选：内容线（全部 / 科普 / 培训），排除合集这类非内容条目
       排序：综合热度 / 观看次数 / 下载量 / 收藏量（观看账号数列已按需求删除）
       完播率已按需求删除：它要求「观看进度」，而文章、图文、折页类内容没有进度概念，
       只对视频与课件有值，一列表里半数是「—」，反而让人以为数据缺失。 */
    var perAsset = Object.keys(a.assets).map(function (id) {
      var s = a.assets[id], art = find(KB.assets, id);
      return { id: id, s: s, art: art };
    }).filter(function (x) { return x.art; });
    /* 内容线筛选：影响排行表，不影响上方 KPI 与图表（那些是整体口径） */
    /* artTrack 已删除：内容线统一由上方筛选条的「内容线」控制，这里不再二次过滤 */
    var artRows = perAsset;
    /* 排序指标 */
    function artMetric(x, key) {
      if (key === 'view') return x.s.view;
      if (key === 'users') return Object.keys(x.s.users).length;
      if (key === 'dl') return x.s.dl;
      if (key === 'fav') return x.s.fav;
      return x.s.view + x.s.dl + x.s.fav;   /* heat：综合热度 */
    }
    var artSortKey = st.artSort || 'heat';
    var artDir = (st.artDir === 1 || st.artDir === -1) ? st.artDir : -1;
    /* artDir = -1 表示降序（指标大在前），1 表示升序 */
    artRows.sort(function (x, y) {
      var d = artMetric(x, artSortKey) - artMetric(y, artSortKey);
      return artDir === -1 ? -d : d;
    });

    function ath(label, key) {
      var on = artSortKey === key;
      return '<span class="kb-sort' + (on ? ' on' : '') + '" data-kb="artSort" data-art="' + key + '">' +
        label + (on ? (artDir === -1 ? ' ↓' : ' ↑') : '') + '</span>';
    }
    /* 「内容线：全部 / 科普 / 培训」切换条已按需求删除：
       筛选条里已经有一项「内容线」，这里再放一排按钮是同一件事的第二个入口，
       两边不同步还会出现「上面选培训、下面切全部」的矛盾状态。
       表格右上角的「共 N 条」也一并去掉——列表本身能数出来，不需要再报一遍。 */
    /* 排序条：与科普 / 培训内容页同一个组件、同一套文案，点了立刻重排，不再点列头找。
       列头仍可点，两个入口改的是同一份 artSort / artDir，不会各排各的。
       「综合热度」= 观看次数 + 下载量 + 收藏量，是默认口径。 */
    var ART_SORT_OPTS = [
      { k: 'heat', t: '综合热度' },
      { k: 'view', t: '观看次数' },
      { k: 'dl', t: '下载量' },
      { k: 'fav', t: '收藏量' }
    ];
    var artSortBar = '<div class="kb-sortbar">' +
      '<span class="kb-sortbar-lb">排序</span>' +
      ART_SORT_OPTS.map(function (o) {
        return '<button type="button" class="kb-seg' + (o.k === artSortKey ? ' on' : '') + '" data-kb="usageArtSort" data-arg="' + o.k + '">' + esc(o.t) + '</button>';
      }).join('') +
      '<button type="button" class="kb-sortbar-dir" data-kb="usageArtSortDir" title="切换升序 / 降序">' +
      (artDir === -1 ? '从高到低 ↓' : '从低到高 ↑') + '</button>' +
      '</div>';
    var artTable = artSortBar + grid(
      ['内容编号', '标题', ath('内容线', 'track'), ath('形式', 'kind'),
       ath('观看次数', 'view'),
       ath('下载量', 'dl'), ath('收藏量', 'fav')],
      artRows.slice(0, 20).map(function (x) {
        return '<tr>' +
          '<td>' + esc(x.id) + '</td>' +
          '<td class="kb-rec-main"><span class="kb-rec-link" data-kb="view" data-arg="' + esc(x.id) + '">' + esc(x.art.title) + '</span>' +
          (isReprint(x.art) ? '<span class="rp-chip" style="height:17px;padding:0 6px;font-size:10.5px;margin-left:6px">转载·' + esc((x.art.source || {}).platform || '') + '</span>' : '') + '</td>' +
          '<td>' + esc(x.art.track) + '</td>' +
          '<td>' + esc(x.art.kind) + '</td>' +
          '<td class="num">' + x.s.view + '</td>' +
          '<td class="num">' + x.s.dl + '</td>' +
          '<td class="num">' + x.s.fav + '</td>' +
          '</tr>';
      }),
      '所选范围内没有内容被使用。',
      '');

    /* 表三：机构使用排行（按机构统计页签）
       机构由事件里冗余的 e.org 聚合，不回查账号表——账号调岗后历史归属不该跟着漂。
       没看过的机构各项计数给 0 而不是「—」，因为 0 是事实。 */
    var perOrg = {};
    list.forEach(function (e) {
      var k = e.org || '（未标注机构）';
      if (!perOrg[k]) perOrg[k] = { view: 0, dl: 0, up: 0, fav: 0, last: '', users: {}, city: e.city || '', accounts: {} };
      var r = perOrg[k];
      if (e.act === '观看') r.view++;
      else if (e.act === '下载') r.dl++;
      else if (e.act === '上传') r.up++;
      else if (e.act === '收藏') r.fav++;
      r.users[e.uid] = 1;
      r.accounts[e.uid] = 1;
      if (String(e.at) > r.last) r.last = e.at;
    });
    var orgRows = Object.keys(perOrg).map(function (k) { return { org: k, r: perOrg[k] }; });
    function orgMetric(x, key) {
      if (key === 'view') return x.r.view;
      if (key === 'dl') return x.r.dl;
      if (key === 'up') return x.r.up;
      if (key === 'fav') return x.r.fav;
      if (key === 'users') return Object.keys(x.r.users).length;
      return x.r.view;   /* 默认按观看次数 */
    }
    var orgSortKey = st.orgSort || 'view';
    var orgDir = (st.orgDir === 1 || st.orgDir === -1) ? st.orgDir : -1;
    orgRows.sort(function (x, y) {
      /* 机构名按名称排，其余按数值排。不特判的话点「机构」列头会按观看次数重排，看着像没反应 */
      if (orgSortKey === 'org') return orgDir * String(x.org).localeCompare(String(y.org), 'zh');
      return orgDir * (orgMetric(x, orgSortKey) - orgMetric(y, orgSortKey));
    });
    function oth(label, key) {
      var on = orgSortKey === key;
      return '<span class="kb-sort' + (on ? ' on' : '') + '" data-kb="orgSort" data-org="' + key + '">' +
        label + (on ? (orgDir === -1 ? ' ↓' : ' ↑') : '') + '</span>';
    }
    /* 「操作」列（查看账号）已按需求删除：机构排行本来就是一行一家机构的汇总，
       下钻要另开一层视图，而这个按钮只是把维度切过去、范围并没有真的缩小，
       看着像能看明细、点进去还是这张表。机构名也不再可点，表格只读、只用来数。 */
    var orgTable = grid(
      [oth('机构', 'org'), '所属地市', oth('活跃账号数', 'users'), oth('观看次数', 'view'),
       oth('下载量', 'dl'), oth('上传量', 'up'), oth('收藏量', 'fav')],
      orgRows.map(function (x) {
        return '<tr>' +
          '<td class="kb-rec-main">' + esc(x.org) + '</td>' +
          '<td>' + esc(x.r.city || '—') + '</td>' +
          '<td class="num">' + Object.keys(x.r.users).length + '</td>' +
          '<td class="num">' + x.r.view + '</td>' +
          '<td class="num">' + x.r.dl + '</td>' +
          '<td class="num">' + x.r.up + '</td>' +
          '<td class="num">' + x.r.fav + '</td>' +
          '</tr>';
      }),
      '所选范围内没有机构行为记录。',
      '');

    /* 「使用趋势」「内容线 × 形式分布」两块图表已删除：
       统计页只留「指标卡（带环比）+ 排行表」，数据以表格为准，图表不再是排版主体。

       2026-10-23 拆成两个页内页签：
         按内容统计 = 一行一条内容（内容热度排行）
         按机构统计 = 一行一家机构（机构使用排行）+ 账号使用排行
       两侧共用同一份筛选范围与同一批事件，只是聚合维度不同，所以不拆菜单。 */
    /* 只出一张表：按内容统计 → 内容热度排行；按机构统计 → 机构使用排行。
       「账号使用排行」不再作为按机构统计的第二张表——它和机构排行讲的是同一批数据的不同切法，
       同屏两张表会让人以为是两件事。需要看账号维度时，在机构排行里点机构名下钻。 */
    var view = (st.view === 'org' || st.view === 'user') ? st.view : 'content';
    var head = filter;
    /* 三个维度各出一张表，不叠加：内容 → 内容热度排行；机构 → 机构使用排行；用户 → 用户使用排行。
       同一屏只给一个维度的明细，读者不必在两张表之间猜「哪一张才是这次的结论」。 */
    if (view === 'content') {
      return '<div class="kb-usage">' + head +
        usageKpisContent(a, list) +
        '<section class="kb-chart"><div class="kb-chart-hd">内容热度排行</div>' +
        '<div class="kb-chart-sub">一行一条内容；点列头可切换排序</div>' + artTable + '</section>' +
        '</div>';
    }
    if (view === 'user') {
      var userSeen = {};
      list.forEach(function (e) { if (e.uid) userSeen[e.uid] = 1; });
      return '<div class="kb-usage">' + head +
        usageKpisUser(a, Object.keys(userSeen).length) +
        '<section class="kb-chart"><div class="kb-chart-hd">用户使用排行</div>' +
        '<div class="kb-chart-sub">一行一个账号；观看量按次数计（同账号同内容 30 分钟内重复播放已合并）；点击列头可排序</div>' + accTable + '</section>' +
        '</div>';
    }
    return '<div class="kb-usage">' + head +
      usageKpisOrg(a, countOrgs(list)) +
      '<section class="kb-chart"><div class="kb-chart-hd">机构使用排行</div>' +
      '<div class="kb-chart-sub">一行一家机构；点列头可排序</div>' + orgTable + '</section>' +
      '</div>';
  }
  /* 是否处于筛选状态：空结果文案要分「没内容」和「筛不出来」 */
  function hasAnyFilter(key) {
    var f = KB.filters[key] || {};
    var picked = ['kw', 'site', 'scene', 'kind', 'origin'].some(function (k) {
      var v = f[k];
      return v && String(v).indexOf('全部') !== 0;
    });
    return picked || (f.status && f.status !== '全部状态');
  }
  /* 收藏列表相关的 FAV_FILTER / favList 已上移到「我的内容」段（页签需要先拿到计数） */

  /* ================= 合集 =================
     合集是一等对象（名称 / 简介 / 封面 / 成员顺序），但不再有独立的「合集管理」页：
       · 建合集 → 内容表单里的「＋ 新建并加入」
       · 成员增减 → 内容表单里的「归属合集」
       · 改简介 / 封面 / 名称、删合集 → 合集详情页顶部（本院可编辑时才出现）
       · 读者浏览 → 科普/培训列表的合集卡
     省库合集只读；院内合集按 org 隔离，与内容同一套规则。 */
  function clEditable(c) { return c.lib !== '省库' && c.org === ME.org; }

  /* 改合集信息（名称 / 内容线 / 状态 / 封面 / 简介 / 标签）
     入口只有一处：合集详情页顶部的「改信息」。合集本身不设独立管理页。
     封面：不传就留空，显示时自动取首集视频首帧；传了之后可以一键改回首帧。 */
  function coverField(c) {
    var has = c && c.cover;
    return '<div class="kb-cover-field">' +
      '<div class="kb-cover-preview" id="kb-cl-cover-preview">' +
      (has ? '<img src="' + esc(c.cover) + '" alt="">' : '<span class="kb-cover-empty">未上传<br><em>保存后自动取首集视频首帧</em></span>') +
      '</div>' +
      '<div class="kb-cover-ops">' +
      '<label class="btn btn-outline btn-sm" for="kb-cl-cover-file">选择图片</label>' +
      '<input type="file" id="kb-cl-cover-file" accept="image/png,image/jpeg,image/webp" style="display:none">' +
      (has ? '<button type="button" class="btn btn-ghost btn-sm" data-kb="clCoverReset" data-arg="' + esc(c.id) + '">改用首帧</button>' : '') +
      '<span class="kb-cover-hint">建议 16:9，JPG/PNG，≤ 3 MB</span>' +
      '</div></div>';
  }
  function bindCoverPicker() {
    var input = $('kb-cl-cover-file');
    if (!input) return;
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { say('只能选图片', 'error'); return; }
      if (f.size > 3 * 1024 * 1024) { say('封面图不能超过 3 MB', 'error'); return; }
      var r = new FileReader();
      r.onload = function () {
        KB._clCover = String(r.result);
        var box = $('kb-cl-cover-preview');
        if (box) box.innerHTML = '<img src="' + KB._clCover + '" alt="">';
        say('已选好封面，保存后生效', 'success');
      };
      r.readAsDataURL(f);
    });
  }
  /* 只用于编辑既有合集：新建合集的入口在内容表单的「＋ 新建并加入」 */
  function collectionForm(id) {
    var c = findCl(id);
    if (!c) return;
    KB._clCover = undefined;   /* 打开表单时清掉上次残留 */
    var body = '<div class="kb-form">' +
      fld(R('合集名称'), inp('kb-cl-name', c.name, '例如：放疗全程护理'), true) +
      fld('内容线', sel1('kb-cl-track', ['科普', '培训'], c.track) + '<div class="hint">合集只能收同一内容线的内容</div>') +
      fld('状态', sel1('kb-cl-status', ['启用', '停用'], c.status)) +
      fld('封面', coverField(c), true) +
      fld('简介', ta('kb-cl-desc', c.desc, '一句话说清这套合集包含什么、适合谁看', 3), true) +
      fld('标签', inp('kb-cl-tags', (c.tags || []).join('、'), '多个用、分隔')) +
      '<div class="full hint">成员在内容表单的「归属合集」里增删，播放顺序按入集先后。</div>' +
      '</div>';
    modal('编辑合集 · ' + c.id, c.name, body,
      '<button class="btn btn-outline btn-sm" data-kb="close">取消</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="clSave" data-arg="' + esc(c.id) + '">保存</button>');
    bindCoverPicker();
  }
  function collectionSave(id) {
    var c = findCl(id);
    if (!c) return;
    var name = val('kb-cl-name');
    if (!name) { say('合集名称不能为空', 'error'); return; }
    var dup = KB.collections.filter(function (x) { return x.name === name && x.id !== id && visibleIn(x); })[0];
    if (dup) { say('已有同名合集「' + name + '」，换个名字', 'error'); return; }
    var track = val('kb-cl-track');
    var moved = c.track !== track;
    c.name = name;
    c.track = track;
    c.status = val('kb-cl-status');
    c.desc = val('kb-cl-desc');
    c.tags = val('kb-cl-tags').split(/[、,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
    /* 选了新图才覆盖；没选图保持原样（「改用首帧」按钮负责把 cover 清空） */
    if (KB._clCover !== undefined && KB._clCover !== '') c.cover = KB._clCover;
    KB._clCover = undefined;
    c.updatedAt = today();
    log(ME.name, '编辑合集', c.id + ' ' + name);
    closeModal();
    say('已保存' + (moved ? '（内容线已改，原有成员可能不再匹配，请检查）' : ''), 'success');
    /* 停在合集详情页看结果，不弹回列表 */
    KB.colTrack = c.track;
    openCollection(c.id);
  }
  function collectionDelete(id) {
    var c = findCl(id);
    if (!c) return;
    if (!clEditable(c)) { say('省库合集只读，不能删除', 'error'); return; }
    confirmBox('删除合集', '确认删除合集「' + esc(c.name) + '」？<div style="margin-top:8px;color:#475467">合集里的 ' + c.members.length + ' 条内容不会被删除，只是不再属于这个合集。</div>', function () {
      KB.collections = KB.collections.filter(function (x) { return x.id !== id; });
      log(ME.name, '删除合集', c.name);
      closeModal();
      say('已删除合集', 'success');
      /* 合集没了，详情页留不住，回它所属的内容线 */
      goPage(c.track === '培训' ? 'kb-train' : 'kb-sci');
    });
  }

  /* ---------- 合集详情（读者视角）----------
     入口：科普/培训列表的合集卡。本院合集的编辑入口也在这里（顶部按钮）。 */
  function openCollection(id) {
    var c = findCl(id);
    if (!c || !visibleIn(c)) { say('未找到该合集', 'error'); return; }
    KB.colTrack = c.track;
    KB.colView = id;
    syncHash('kb-collection|' + id);
    if (window.navigateTo) { navigateTo('kb-collection|' + id); return; }
    renderKBPage('kb-collection|' + id);
  }
  function collectionCoverHtml(c) {
    /* 封面：上传图优先；没上传就用首集视频首帧；都没有就给形式占位 */
    if (c.cover) return '<div class="kb-col-cover has-img"><img src="' + esc(c.cover) + '" alt=""></div>';
    return '<div class="kb-col-cover" data-col-cover="' + esc(c.id) + '">' +
      '<span class="kbx-card-glyph">合集</span><span class="kb-col-cover-tip">未上传封面，将取首集视频首帧</span></div>';
  }
  function collectionView(id) {
    var c = findCl(id);
    if (!c) return '<div class="panel"><div class="panel-body">合集不存在</div></div>';
    /* 成员顺序按 c.members 走（不是按可见内容走），否则移出一个空位会让编号跳号 */
    var items = c.members.map(function (mid, idx) {
      var a = find(KB.assets, mid);
      return { a: a, idx: idx };
    });
    var shown = items.filter(function (x) { return x.a && visibleIn(x.a); });
    var online = shown.filter(function (x) { return x.a.status === '启用'; }).length;
    var editable = clEditable(c);
    var totalDur = shown.reduce(function (n, x) {
      var m = String(x.a.summary).match(/(\d+)\s*分\s*(\d+)?\s*秒|(\d+)\s*分钟/);
      return n + (m ? (m[1] !== undefined ? Number(m[1]) * 60 + Number(m[2] || 0) : Number(m[3]) * 60) : 0);
    }, 0);
    var durTxt = totalDur ? Math.round(totalDur / 60) + ' 分钟' : '';

    var rows = shown.map(function (x, n) {
      var a = x.a;
      /* 播放序号用「可见内容里的序号」，但移出/上移要用「members 里的真实下标」 */
      var ops = editable
        ? '<span class="kb-col-ep-ops">' +
            '<button class="btn btn-ghost btn-xs" data-kb="clMove" data-arg="' + esc(c.id) + '|' + x.idx + '|-1"' + (x.idx === 0 ? ' disabled' : '') + ' title="上移">↑</button>' +
            '<button class="btn btn-ghost btn-xs" data-kb="clMove" data-arg="' + esc(c.id) + '|' + x.idx + '|1"' + (x.idx === c.members.length - 1 ? ' disabled' : '') + ' title="下移">↓</button>' +
            '<button class="btn btn-ghost btn-xs" data-kb="clRemove" data-arg="' + esc(c.id) + '|' + esc(a.id) + '" title="从合集移出（内容本身保留）">移出</button>' +
          '</span>'
        : '';
      return '<div class="kb-col-ep">' +
        '<span class="kb-col-ep-no">' + String(n + 1).padStart(2, '0') + '</span>' +
        '<button class="kb-col-ep-play" data-kb="clPlay" data-arg="' + esc(a.id) + '" title="打开这一集">▶</button>' +
        '<span class="kb-col-ep-main"><b>' + esc(a.title) + '</b><span>' + esc(a.summary) + '</span></span>' +
        '<span class="kb-col-ep-meta">' + esc(a.kind) + (a.status === '启用' ? '' : ' · 已下架') + '</span>' +
        ops + '</div>';
    }).join('');

    /* 过不了上架门禁的成员单独提示：合集里挂着一条上不去的内容，管理员要知道。
       依据出处门禁撤销后，这里只可能因转载来源信息不全而被拦。 */
    var gated = shown.filter(function (x) { return !isOnShelf(x.a) && shelfGate(x.a).length; });
    var gateNote = gated.length && editable
      ? '<div class="kb-col-gate">有 ' + gated.length + ' 集因来源信息不全无法上架：' +
        gated.map(function (x) { return esc(x.a.title); }).join('、') +
        '<button class="btn btn-ghost btn-xs" data-kb="shelfFix" data-arg="' + esc(gated[0].a.id) + '">去核对来源</button></div>'
      : '';

    return '<div class="kb-col-view">' +
      '<div class="kb-col-top"><button class="btn btn-ghost btn-sm" data-kb="colBack">← 返回' + esc(c.track === '培训' ? '培训内容' : '科普内容') + '</button>' +
      /* 合集的全部维护入口都在这一行：合集不是独立页面，详情页就是它的维护台 */
      (editable ? '<span class="kb-col-tools">' +
        '<button class="btn btn-primary btn-sm" data-kb="clAddOpen" data-arg="' + esc(c.id) + '">+ 添加内容</button>' +
        '<button class="btn btn-outline btn-sm" data-kb="clEdit" data-arg="' + esc(c.id) + '">改信息</button>' +
        '<button class="btn btn-ghost btn-sm" data-kb="clDel" data-arg="' + esc(c.id) + '">删除合集</button>' +
      '</span>' : '') + '</div>' +
      '<div class="kb-col-hero">' + collectionCoverHtml(c) +
      '<div class="kb-col-hero-main"><div class="kb-col-kicker">合集 · ' + esc(c.track) + '</div>' +
      '<h1 class="kb-col-title">' + esc(c.name) + '</h1>' +
      '<div class="kb-col-meta">共 ' + shown.length + ' 集' + (online < shown.length ? ' · 在架 ' + online + ' 集' : '') +
      (durTxt ? ' · 约 ' + durTxt : '') + ' · ' + esc(c.org) + ' · 更新 ' + esc(c.updatedAt) + '</div>' +
      (c.desc ? '<p class="kb-col-desc">' + esc(c.desc) + '</p>' : '') +
      (c.tags && c.tags.length ? '<div class="kb-col-tags">' + c.tags.map(function (t) { return '<span class="kbx-chip">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
      (shown.length ? '<div class="kb-col-actions"><button class="btn btn-primary btn-sm" data-kb="clPlay" data-arg="' + esc(shown[0].a.id) + '">▶ 从第 1 集开始</button></div>' : '') +
      '</div></div>' +
      gateNote +
      '<div class="panel"><div class="panel-header">选集' +
      '<span style="font-weight:400;font-size:12px;color:#64748b">' +
      (editable ? '顺序即播放顺序，用 ↑ ↓ 调整' : '按合集顺序排列') + '</span></div>' +
      '<div class="panel-body kb-col-eps">' + (rows || '<div style="color:#64748b;padding:18px;text-align:center">这个合集还没有内容' +
        (editable ? '，点上方「+ 添加内容」从库里挑' : '') + '</div>') + '</div></div>' +
      '</div>';
  }
  /* 添加内容：只列同内容线、当前还不在这个合集里的可见内容。
     勾完追加到末尾；顺序之后可在详情页用 ↑ ↓ 调。 */
  function collectionAddPicker(id) {
    var c = findCl(id);
    if (!c || !clEditable(c)) return;
    /* 转载件不进合集：合集靠 members 顺序生成「第 N/M 集」，单篇转载塞进去会让章节号错位。
       要转整套官方系列，必须整组一起转并建一个院内合集。 */
    var pool = KB.assets.filter(function (a) {
      return visibleIn(a) && a.track === c.track && !isReprint(a) && c.members.indexOf(a.id) < 0;
    });
    var body;
    if (!pool.length) {
      body = '<div class="kb-note">这条内容线下的内容都已经在这个合集里了。' +
        '<br>需要新内容请到「' + (c.track === '培训' ? '培训内容' : '科普内容') + '」页新增或批量上传。</div>';
    } else {
      /* 按上架门禁结果标注：过不了门禁的（目前只剩转载来源不全）也要列出来并注明 */
      var rows = pool.map(function (a) {
        var gate = shelfGate(a);
        return '<label class="kb-addpick-row">' +
          '<input type="checkbox" data-addpick="' + esc(a.id) + '">' +
          '<span class="kb-addpick-t">' + esc(a.title) + '</span>' +
          (gate.length ? '<span class="kb-addpick-warn">' + esc(gate[0]) + '</span>' : '') +
          '<span class="kb-addpick-m">' + esc(a.kind) + ' · ' + esc(a.id) + ' · ' + (isOnShelf(a) ? '在架' : '已下架') + '</span>' +
          '</label>';
      }).join('');
      body = '<div class="kb-note">勾选要加进「' + esc(c.name) + '」的内容，会追加到合集末尾。' +
        '<br>合集只收同内容线（' + esc(c.track) + '）的内容，其它线的内容不会出现在这里。</div>' +
        '<div class="kb-addpick">' + rows + '</div>';
    }
    modal('添加内容到「' + c.name + '」', c.id + ' · 当前 ' + c.members.length + ' 集', body,
      '<button class="btn btn-outline btn-sm" data-kb="close">取消</button>' +
      (pool.length ? '<button class="btn btn-primary btn-sm" data-kb="clAddSave" data-arg="' + esc(id) + '">加入合集</button>' : ''),
      true);
  }
  function collectionAddSave(id) {
    var c = findCl(id); if (!c) return;
    var ids = [];
    document.querySelectorAll('[data-addpick]').forEach(function (el) { if (el.checked) ids.push(el.getAttribute('data-addpick')); });
    if (!ids.length) { say('先勾选要加入的内容', 'error'); return; }
    ids.forEach(function (x) { if (c.members.indexOf(x) < 0) c.members.push(x); });
    c.updatedAt = today();
    log(ME.name, '合集添加内容', c.name + ' +' + ids.length);
    closeModal();
    say('已往「' + c.name + '」加入 ' + ids.length + ' 条', 'success');
    openCollection(id);   /* 停在这个合集看结果，不回列表 */
  }
  /* 移出 / 调序：都在合集详情页就地完成 */
  function collectionMove(id, index, delta) {
    var c = findCl(id); if (!c) return;
    var to = index + delta;
    if (to < 0 || to >= c.members.length) return;
    var arr = c.members.splice(index, 1);
    c.members.splice(to, 0, arr[0]);
    c.updatedAt = today();
    openCollection(id);
  }
  function collectionRemoveMember(id, assetId) {
    var c = findCl(id); if (!c) return;
    var a = find(KB.assets, assetId);
    c.members = c.members.filter(function (x) { return x !== assetId; });
    c.updatedAt = today();
    log(ME.name, '移出合集', c.name + ' -' + assetId);
    say('已把《' + (a ? a.title : assetId) + '》移出合集（内容本身还在库里）', 'success');
    openCollection(id);
  }

  /* 合集封面异步补图：进页面后按需截首帧 */
  function hydrateCollectionCover(id) {
    var c = findCl(id); if (!c || c.cover || !window.KBDetail) return;
    setTimeout(function () {
      window.KBDetail.posterOf(c, function (url) {
        if (!url) return;
        var box = document.querySelector('[data-col-cover="' + id + '"]');
        if (!box) return;
        box.innerHTML = '<img src="' + url + '" alt="">';
        box.classList.add('has-img');
      });
    }, 80);
  }

  /* ================= 页面 4：分类维护（对齐全站字典管理形制） ================= */
  function dictRefs(dim, name) {
    /* 官方来源白名单挂在 a.source.platform 上，不挂在内容字段上，单独数；
       不处理的话删白名单项时「被几篇引用」恒为 0，删了还没人拦。 */
    if (dim === 'srcs') {
      return KB.assets.filter(function (a) { return isReprint(a) && a.source && a.source.platform === name; }).length;
    }
    return KB.assets.filter(function (a) { return a.status === '启用' && (a[dim] || []).indexOf(name) >= 0; }).length;
  }
  function dictTab() {
    var st = KB.dictState || (KB.dictState = { type: 'sites', kw: '' });
    var dim = st.type, data = DICT[dim] || [], q = (st.kw || '').trim().toLowerCase();
    var list = data.filter(function (x) { return !q || x.code.toLowerCase().indexOf(q) >= 0 || x.name.toLowerCase().indexOf(q) >= 0; })
      .slice().sort(function (a, b) { return a.sort - b.sort; });
    var body = list.map(function (x, n) {
      var i = data.indexOf(x), refs = dictRefs(dim, x.name);
      return '<tr><td>' + (n + 1) + '</td><td>' + esc(x.code) + '</td><td>' + esc(x.name) + '</td>' +
        '<td>' + x.sort + '</td>' +
        '<td><span class="badge ' + (x.status === '启用' ? 'badge-success' : 'badge-muted') + '">' + esc(x.status) + '</span></td>' +
        /* 「在架引用」列已删除：这一列只是给管理员看的统计数字，不是字典项本身的字段。 */
        '<td>' + esc(x.remark || '—') + '</td>' +
        '<td class="ops">' +
        '<button class="btn btn-primary btn-xs" data-kb="dictEdit" data-arg="' + dim + '|' + i + '">编辑</button> ' +
        '<button class="btn btn-xs ' + (x.status === '启用' ? 'btn-ghost' : 'btn-primary') + '" data-kb="dictToggle" data-arg="' + dim + '|' + i + '">' + (x.status === '启用' ? '禁用' : '启用') + '</button> ' +
        '<button class="btn btn-danger btn-xs" data-kb="dictDel" data-arg="' + dim + '|' + i + '">删除</button>' +
        '</td></tr>';
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:22px">暂无匹配字典项</td></tr>';

    var filter = '<div class="filter-toolbar">' +
      '<div class="form-group"><label>字典类型</label><select data-kbd="type" onchange="kbDictType()">' +
      DICT_TYPES.map(function (t) { return '<option value="' + t.v + '"' + (t.v === dim ? ' selected' : '') + '>' + t.t + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-group search-group"><label>检索内容</label><input value="' + esc(st.kw) + '" placeholder="编码 / 名称" data-kbd="kw"></div>' +
      '<div class="filter-actions">' +
      '<button class="btn btn-primary btn-sm" data-kb="dictQuery">查询</button>' +
      '<button class="btn btn-ghost btn-sm" data-kb="dictReset">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="dictAdd" data-arg="' + dim + '">+ 添加</button>' +
      '</div></div>';

    return '<div class="page-toolbar"><div class="page-toolbar-title"><span class="icon">●</span>分类维护' +
      '<span style="font-size:12px;color:#64748b;font-weight:400;margin-left:10px">当前字典：' + esc(dictTypeMeta(dim).t) + '</span></div></div>' +
      '<div class="panel"><div class="panel-body">' + filter +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      ['序号', '编码', '名称', '排序', '状态', '备注', '操作'].map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      '</div></div>';
  }

  /* 新增 / 编辑弹窗（form-grid 对齐全站字典表单） */
  function dictForm(dim, index) {
    var data = DICT[dim] || [], meta = dictTypeMeta(dim);
    var r = index == null
      ? { code: meta.prefix + '-' + pad(data.length + 1), name: '', sort: data.length + 1, status: '启用', remark: '' }
      : data[index];
    function fg(label, inner, req) {
      return '<div class="form-group"><label>' + label + (req ? ' <span class="required">*</span>' : '') + '</label>' + inner + '</div>';
    }
    var body = '<div class="form-grid">' +
      fg('编码', '<input id="kb-df-code" value="' + esc(r.code) + '">', true) +
      fg('名称', '<input id="kb-df-name" value="' + esc(r.name) + '">', true) +
      fg('排序', '<input id="kb-df-sort" type="number" value="' + r.sort + '">') +
      fg('状态', '<select id="kb-df-status"><option' + (r.status === '启用' ? ' selected' : '') + '>启用</option><option' + (r.status === '禁用' ? ' selected' : '') + '>禁用</option></select>') +
      '<div class="form-group full"><label>备注</label><textarea id="kb-df-remark">' + esc(r.remark || '') + '</textarea></div>' +
      '<div class="form-group full"><span style="font-size:11px;color:#94a3b8">改名会同步改写已引用该字典项的内容；被在架内容引用的项不能删除，只能先禁用。</span></div>' +
      '</div>';
    modal((index == null ? '新增' : '编辑') + meta.t + '字典项', meta.t + '字典', body,
      '<button class="btn btn-ghost btn-sm" data-kb="close">取消</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="dictSave" data-arg="' + dim + '|' + (index == null ? '' : index) + '">保存</button>', false);
  }
  function dictSave(dim, index) {
    var data = DICT[dim], meta = dictTypeMeta(dim);
    var code = val('kb-df-code'), name = val('kb-df-name');
    if (!code || !name) { say('编码与名称为必填', 'error'); return; }
    if (data.some(function (x, i) { return x.code === code && i !== index; })) { say('同一字典下编码不能重复', 'error'); return; }
    if (data.some(function (x, i) { return x.name === name && i !== index; })) { say('同一字典下名称不能重复', 'error'); return; }
    var item = { code: code, name: name, sort: Number(val('kb-df-sort')) || data.length + 1, status: val('kb-df-status'), remark: val('kb-df-remark') };
    if (index == null) { data.push(item); log(ME.name, '新增字典项', meta.t + '/' + name); }
    else {
      var old = data[index].name;
      data[index] = item;
      if (old !== name) {
        /* 改名 → 同步已引用该内容字段，避免内容静默失去分类 */
        var n = 0;
        if (dim === 'srcs') {
          /* 官方来源挂在 a.source.platform（不是 a[dim] 数组）：不单独同步的话，
             改名后转载件的来源还是旧名，按新名数引用数为 0 → 这一项能被删掉，来源失联 */
          KB.assets.forEach(function (a) {
            if (isReprint(a) && a.source && a.source.platform === old) {
              a.source.platform = name;
              a.evidence = sourceText(a);   /* 依据出处里也是旧平台名，一并重算 */
              n++;
            }
          });
        } else {
          KB.assets.forEach(function (a) {
            var arr = a[dim];
            if (arr && arr.indexOf) {
              var k = arr.indexOf(old);
              if (k >= 0) { arr[k] = name; n++; }
            }
          });
        }
        if (n) say('已同步 ' + n + ' 条内容的分类引用', 'info');
      }
      log(ME.name, '编辑字典项', meta.t + '/' + name);
    }
    closeModal(); refresh();
    say('保存成功', 'success');
  }
  function dictToggle(dim, index) {
    var x = DICT[dim][index];
    x.status = x.status === '启用' ? '禁用' : '启用';
    log(ME.name, x.status === '禁用' ? '禁用字典项' : '启用字典项', dictTypeMeta(dim).t + '/' + x.name);
    say('已' + x.status + '「' + x.name + '」，' + (x.status === '禁用' ? '检索条件与新建表单不再出现' : '重新可用'), 'success');
    refresh();
  }
  function dictDel(dim, index) {
    var data = DICT[dim], x = data[index], refs = dictRefs(dim, x.name);
    if (refs) { say('「' + x.name + '」被 ' + refs + ' 篇在架内容引用，不能删除；如不再使用请点「禁用」', 'error'); return; }
    if (window.showConfirm) {
      showConfirm('确认删除', '确定删除字典项「' + x.name + '（' + x.code + '）」？', function () {
        data.splice(index, 1); log(ME.name, '删除字典项', dictTypeMeta(dim).t + '/' + x.name);
        say('已删除', 'success'); refresh();
      });
    } else {
      data.splice(index, 1); say('已删除', 'success'); refresh();
    }
  }

  /* ================= 主渲染：4 个侧导航页面 ================= */
  var PAGES = {
    'kb-sci': {
      tab: 'sci', title: '科普内容',
      acts:         '<button class="btn btn-outline btn-sm" data-kb="reprint" data-arg="科普">⤓ 转载</button>' +
        '<button class="btn btn-import btn-sm" data-kb="bulk" data-arg="科普">批量上传</button>' +
        '<button class="btn btn-primary btn-sm" data-kb="new" data-arg="科普">+ 新增科普内容</button>'
    },
    'kb-train': {
      tab: 'train', title: '培训内容',
      acts:         '<button class="btn btn-outline btn-sm" data-kb="reprint" data-arg="培训">⤓ 转载</button>' +
        '<button class="btn btn-import btn-sm" data-kb="bulk" data-arg="培训">批量上传</button>' +
        '<button class="btn btn-primary btn-sm" data-kb="new" data-arg="培训">+ 新增培训内容</button>'
    },
    'kb-mine': {
      tab: 'mine', title: '我的内容',
      acts: ''
    },
    'kb-usage': {
      tab: 'usage', title: '使用统计',
      acts: '<button class="btn btn-outline btn-sm" data-kb="usageExport">导出统计报表</button>'
    },
    'kb-dict': {
      tab: 'dict', title: '分类维护', shell: true,
      acts: ''
    }
  };

  /* 合集不再是独立页面：入口在内容表单的「归属合集」和内容卡上。
     kb-collection|<编号> 仍保留，只用于打开某个合集的详情（读者视角）。 */
  KB.page = 'kb-sci';
  KB.detail = null;   /* 当前打开的内容编号；null = 不在详情页 */
  function refresh() { renderKBPage(KB.page); }
  /* 详情页里改数据（收藏 / 启停 / 编辑保存）：刷新的是详情页本身，别把读者弹回列表 */
  function refreshKeepDetail() {
    if (KB.detail) { renderKBPage('kb-detail|' + KB.detail); return; }
    refresh();
  }
  /* 跨页跳转走 navigateTo，保证侧导航高亮与面包屑一致 */
  function goPage(pageId) {
    KB.detail = null;
    syncHash(pageId);
    if (window.navigateTo) { navigateTo(pageId); }
    else { KB.page = pageId; KB.tab = PAGES[pageId].tab; refresh(); }
  }
  /* 预览 / 打开详情：kb-detail|<编号>。走 navigateTo 才能让侧导航、面包屑跟上；
     同时把地址栏 hash 同步成当前详情页（replaceState，不堆历史），刷新后仍停在这条内容上 */
  function openDetail(id) {
    if (!find(KB.assets, id)) { say('未找到该内容', 'error'); return; }
    syncHash('kb-detail|' + id);
    if (window.navigateTo) { navigateTo('kb-detail|' + id); return; }
    KB.detail = id; renderKBPage('kb-detail|' + id);
  }
  function backFromDetail() {
    var a = KB.detail ? find(KB.assets, KB.detail) : null;
    KB.detail = null;
    var pageId = a ? (a.track === '培训' ? 'kb-train' : 'kb-sci') : (KB.page || 'kb-sci');
    syncHash(pageId);
    if (window.navigateTo) { navigateTo(pageId); } else { KB.page = pageId; KB.tab = PAGES[pageId].tab; refresh(); }
  }
  function syncHash(id) {
    try { if (window.history && history.replaceState) history.replaceState(null, '', '#' + id); } catch (e) { }
  }
  /* 把内容库交给详情页渲染器：必须给同一个数组引用（KB.assets 只会 push/splice，不会整体换掉），
     详情页的合集成员、相关推荐才总能读到最新的库。模块先于渲染器加载，首次调用可能落空，
     由渲染器就绪后再调一次（见文件末尾的 KBDetailReady）。 */
  function injectDetail() {
    if (!window.KBDetail) return false;
    /* 第五个参数是转载扩展：详情页只负责按形式排版，来源行/编者按/转载声明/外发按钮由这里挂上去 */
    if (window.KBDetail.bind) window.KBDetail.bind(KB.assets, ME, log, KB.collections, window.KB_RP_EXT);
    else {
      window.KBDetail.assets = KB.assets; window.KBDetail.me = ME;
      window.KBDetail.log = log; window.KBDetail.collections = KB.collections;
    }
    return true;
  }
  function renderKBPage(pageId) {
    var el = $('pageContainer');
    if (!el) return;
    /* 社区咨询（kb-service.js）是「科普与培训」下的二级菜单，13 个三级页面由它自己渲染。
       这里只做兜底：首选分拣在 app.html 的 renderPage（那里能拿到当年真实的 window.HCService）。
       'health-consult' 在 kbPageIds 里，会进到本函数但走不到下面任何分支，原先会落到末尾 PAGES
       默认分支（「科普内容」），所以先把它归一成 kb-sci。 */
    if (window.HCService && typeof window.HCService.pageOf === 'function') {
      if (pageId === 'hc-service') { window.HCService.overview(); return; }
      if (window.HCService.pageOf(pageId) !== pageId) { window.HCService.render(pageId); return; }
    }
    if (pageId === 'health-consult') pageId = 'kb-sci';
    /* 科普 / 培训页的视角：lib 内容库 / reprint 转载专区。切页保留，不要每次重置 */
    KB.lineView = KB.lineView || 'lib';
    if (pageId === 'kb-library' || pageId === 'kb-shelf' || pageId === 'kb-sources') pageId = 'kb-sci';
    /* 转载弹窗没有独立页面 id：kb-reprint 打开空弹窗，kb-reprint|<网址> 直接解析带进来的网址。
       弹窗挂在 body 上，页面本体仍是当前内容线；已转载内容的浏览在「科普/培训」页的转载专区页签里，
       不再有独立的转载页面。 */
    if (pageId === 'kb-reprint' || pageId.indexOf('kb-reprint|') === 0) {
      var rpArg = pageId.indexOf('kb-reprint|') === 0 ? decodeURIComponent(pageId.slice('kb-reprint|'.length)) : '';
      var rpBase = KB.page === 'kb-train' ? 'kb-train' : 'kb-sci';
      pageId = rpBase;
      setTimeout(function () { if (!KB.rp) openReprint({ url: rpArg, track: rpBase === 'kb-train' ? '培训' : '科普' }); }, 0);
    }
    /* 详情页：kb-detail|<编号>。详情渲染在 kb-detail.js（含视频/问答/课件等六套版式） */
    if (pageId && pageId.indexOf('kb-detail|') === 0) {
      var did = pageId.slice('kb-detail|'.length);
      var hit = find(KB.assets, did);
      if (hit) {
        KB.page = hit.track === '培训' ? 'kb-train' : 'kb-sci';
        KB.tab = PAGES[KB.page].tab;
        KB.detail = did;
        if (window.KBDetail && window.KBDetail.render) {
          injectDetail();
          window.KBDetail.render(did);
        } else {
          /* 详情渲染器没加载：退回旧弹窗，至少不至于白屏 */
          el.innerHTML = '<div class="kb-page"><div class="kb-note">详情页组件未加载，已退回弹窗预览。</div></div>';
          KB.detail = null; viewAsset(did);
        }
        var mc0 = $('mainContent');
        if (mc0) mc0.scrollTop = 0;
        return;
      }
      say('未找到编号 ' + did + ' 的内容，已返回列表', 'error');
      KB.detail = null;
      pageId = 'kb-sci';
    }
    /* 合集详情（读者视角）：kb-collection|<合集编号> */
    if (pageId && pageId.indexOf('kb-collection|') === 0) {
      var cid = pageId.slice('kb-collection|'.length);
      var col = findCl(cid);
      if (col && visibleIn(col)) {
        KB.detail = null;
        KB.page = col.track === '培训' ? 'kb-train' : 'kb-sci';
        KB.tab = PAGES[KB.page].tab;
        KB.colView = cid;
        el.innerHTML = '<div class="kb-page">' + collectionView(cid) + '</div>';
        hydrateCollectionCover(cid);
        var mcC = $('mainContent');
        if (mcC) mcC.scrollTop = 0;
        return;
      }
      say('未找到该合集，已返回科普内容', 'error');
      KB.colView = null;
      pageId = 'kb-sci';
    }
    if (KB.detail && window.KBDetail && window.KBDetail.leave) window.KBDetail.leave();
    KB.detail = null;
    var cfg = PAGES[pageId] || PAGES[KB.page] || PAGES['kb-sci'];
    KB.page = PAGES[pageId] ? pageId : KB.page;
    KB.tab = cfg.tab;

    var body = cfg.tab === 'sci' ? sciPage()
      : cfg.tab === 'train' ? libraryTab('培训', 'kb-library:train', true)
        : cfg.tab === 'mine' ? mineTab()
              : cfg.tab === 'usage' ? usagePage()
              : dictTab();

    /* 配置页（分类维护）自带 page-toolbar，不再叠一层模块标题 */
    el.innerHTML = '<div class="kb-page">' + (cfg.shell ? body : heads(cfg.title, '', cfg.acts) + body) + '</div>';

    /* 使用统计的「统计维度」下拉即时生效：它换的是聚合维度，不是筛选条件，
       点完再点「查询」多一步很容易让人以为没反应。其余筛选项仍走「查询」。 */
    if (cfg.tab === 'usage') {
      var dimSel = el.querySelector('[data-kbu="view"]');
      if (dimSel) dimSel.addEventListener('change', function () {
        var vv = dimSel.value;
        usageState().view = (vv === 'org' || vv === 'user') ? vv : 'content';
        refresh();
      });
    }

    var mc = $('mainContent');
    if (mc) mc.scrollTop = 0;
  }

/* ---- RP UI BEGIN ---- */
  /* ================= 权威内容转载 · 界面 =================
     三条进料通道按「运营手里有什么」分：
       A 单条链接（主路径）：粘链接 → 解析 → 确认，0 次打字
       B 批量粘贴：一次 20 个链接，表格里勾选、批量设病种，一次入库
       C 授权转载：非白名单但拿到书面授权时用
     第四个是货架：科普/培训页的「引用他人内容」视角，列出本系统还没转的官方新内容。 */
  KB.rp = null;
  function nextRpNo() {
    var n = 0;
    KB.assets.forEach(function (a) { var m = /^KB-R-(\d+)$/.exec(a.id); if (m) n = Math.max(n, parseInt(m[1], 10)); });
    return 'KB-R-' + ('000' + (n + 1)).slice(-4);
  }
  function closeRp() {
    document.querySelectorAll('.rp-mask').forEach(function (x) { x.remove(); });
    KB.rp = null;
  }
  /* owner 在「打开这一刻」快照下来：顶栏身份切换是常驻的，保存时现取会把 A 身份打开的内容存到 B 机构 */
  function openReprint(opts) {
    opts = opts || {};
    KB.rp = { mode: opts.bulk ? 'bulk' : 'single', rec: null, rows: [], owner: currentUser(), track: opts.track || (KB.page === 'kb-train' ? '培训' : '科普'), batchUrl: '' };
    renderRp();
    if (opts.sid || opts.url) doParse(opts.sid || opts.url);
  }
  function renderRp() {
    var st = KB.rp; if (!st) return;
    closeRpKeepState();
    var sub = st.mode === 'bulk'
      ? '每行一个链接 —— 白名单外的会挂起并写明原因，不影响其它行入库'
      : '链接 · 标题 · 形式 · 标签 · 病种 · 来源 —— 解析成功会自动填好；正文一字不改';
    var mask = document.createElement('div');
    mask.className = 'rp-mask';
    mask.innerHTML = '<div class="rp-dialog' + (st.mode === 'bulk' ? ' rp-dialog--wide' : '') + '">' +
      '<div class="rp-hd"><div class="t">转载官方内容' +
      '<span class="sub">' + sub + '</span></div>' +
      '<div class="rp-hd-ops">' +
      (st.mode === 'bulk'
        ? '<button type="button" class="rp-mode" data-kb="rpSingleMode">← 单条</button>'
        : '<button type="button" class="rp-mode" data-kb="rpBulkMode">批量粘贴</button>') +
      '</div>' +
      '<button class="rp-x" data-kb="rpClose">×</button></div>' +
      '<div class="rp-bd">' + (st.mode === 'bulk' ? rpBulkBody() : rpSingleBody()) + '</div>' +
      '<div class="rp-ft">' + (st.mode === 'bulk' ? rpBulkFoot() : rpSingleFoot()) + '</div>' +
      '</div>';
    document.body.appendChild(mask);
    mask.addEventListener('click', function (e) { if (e.target === mask) closeRp(); });
    var first = mask.querySelector('.rp-input, .rp-area');
    if (first && !st.rec && !st.rows.length) setTimeout(function () { try { first.focus(); } catch (e) { } }, 30);
  }
  function closeRpKeepState() { document.querySelectorAll('.rp-mask').forEach(function (x) { x.remove(); }); }

  /* ================= 转载表单（极简） =================
     只留六项：链接、标题、形式、标签、病种、来源。
     解析成功时这六项全部自动填好，人看一眼点确认就行；解析不出来时也只有这几项要填
     （正文放折叠区，可选），不再有"内容线 / 使用场景 / 编者按 / 入库方式"这些要人做决策的项。
     默认：内容线 = 当前页；形式 = 文章；病种 = 通用；保存后是草稿（勾一下才直接上架）。 */
  function rpSingleBody() {
    var st = KB.rp, rec = st.rec, auto = (rec && rec.auto) || {};
    var isFail = !!(rec && rec.block);
    var incomplete = !!(rec && rec.incomplete);

    /* 第一行永远留链接：解析成功的也留着，方便核对与重新解析。
       解析成功后回填「抠出来的干净网址」——粘整段分享文案时原文案 957px 会横向滚出去，
       看不出到底取了哪个链接；回填后一眼能核对，也能直接改。 */
    var linkVal = st.urlInput || '';
    var got = (rec && rec.source && rec.source.url) || (rec && rec.url) || '';
    var hostShown = got ? hostOf(got) : '';
    var whitelisted = !!(rec && rec.source && (rec.source.basis || 'official') === 'official' && got);
    var html = '<div class="rp-block rp-block--link">' +
      '<div class="rp-link-row"><input class="rp-input" id="rp-url" value="' + esc(linkVal) + '" placeholder="粘贴官方原文链接，回车自动解析（整段分享文案也能粘）">' +
      '<button class="btn btn-outline btn-sm" data-kb="rpParse">解析</button></div>' +
      (got
        ? '<div class="rp-hint">' + (whitelisted
          ? '✓ 已识别：' + esc((rec.source && rec.source.platform) || '') + ' · ' + esc(hostShown) + '（白名单内官方域名）'
          : '已识别网址：' + esc(hostShown) + '（不在白名单，需填授权说明）') + '</div>'
        : '<div class="rp-hint">' + (isFail ? '解析不到就直接手填下面的字段，一样能入库' : '支持国家卫健委、国家癌症中心等官方域名；粘贴后回车即可自动填好下面几项') + '</div>') +
      '</div>';

    /* 失败提示压成一行，动作按钮跟在后面（不占一大块） */
    if (isFail) {
      html += '<div class="rp-block bad rp-block--doc">⛔ ' + esc(rec.why || rec.block || '解析失败') +
        (rec.hint ? '<br><span style="color:#8a5a3a">' + esc(rec.hint) + '</span>' : '') + '</div>';
      if (rec.url) {
        html += '<div class="rp-inline" style="margin:-4px 0 12px"><a class="btn btn-ghost btn-xs" href="' + esc(rec.url) + '" target="_blank" rel="noopener">打开原文自己复制</a>' +
          ((rec.code === 'FETCH_FAIL' || rec.code === 'NO_BODY') ? '<button class="btn btn-ghost btn-xs" data-kb="rpParse">重试一次</button>' : '') + '</div>';
      }
    }
    if (incomplete) {
      html += '<div class="rp-block warn rp-block--doc">⚠ 只拿到链接，标题没抓到（图片页 / 视频页 / 动态加载都会这样）。把标题填上就能入库，正文可以不填。</div>';
    }

    /* 标题独占一格；来源与发布日期各占一格并排。
       发布日期以前挤在「来源」格子里当第二行，两列网格里被压成 148px 的小框，
       和左边的「来源」不在同一基线上，看着像排错了行——独立成列后三项同高。 */
    var whitelistHit = !!(rec && rec.source && (rec.source.basis || 'official') === 'official');
    html += '<div class="rp-field"><div class="k">标题</div><div class="v">' +
      '<input class="rp-input" id="rp-title" value="' + esc((rec && rec.title) || '') + '" placeholder="原文标题（照抄，不改写）">' +
      (incomplete ? ' <span class="rp-low">未抓到，请照抄</span>' : '') + '</div></div>' +
      '<div class="rp-grid2">' +
      '<div class="rp-field"><div class="k">来源</div><div class="v">' +
      '<input class="rp-input" id="rp-platform" value="' + esc((rec && rec.source && rec.source.platform) || '') + '" placeholder="发布平台，如：国家卫生健康委">' +
      (whitelistHit ? '<div class="rp-inline"><span class="rp-st rp-st--info">白名单命中</span>' +
        '<span class="rp-hint">来源已按域名核验</span></div>' : '<div class="rp-inline"><span class="rp-hint">无网址可留空</span></div>') +
      '</div></div>' +
      '<div class="rp-field"><div class="k">发布日期</div><div class="v">' +
      '<input class="rp-input" id="rp-date" value="' + esc((rec && rec.source && rec.source.publishedAt) || '') + '" placeholder="2026-09-12">' +
      '<div class="rp-inline"><span class="rp-hint">原文的发布日，不是转载日</span></div>' +
      '</div></div></div>';

    /* 非白名单来源：必须能自证来源，否则合规审查无法通过——这一栏是硬要求，不是可选 */
    if (rec && rec.code === 'NOT_WHITE') {
      html += '<div class="rp-field"><div class="k">授权说明</div><div class="v">' +
        '<textarea class="rp-area" id="rp-note" rows="2" placeholder="谁授权的、什么时候、文件编号。例：经省卫健委宣传处 2026-10-20 书面同意转载，文件编号 JX-2026-101">' + esc((rec && rec.noteDraft) || '') + '</textarea>' +
        '<div class="rp-hint" style="color:#a1541a">非白名单来源必填：这条说明会随内容一起留存，供合规审查自证来源。</div></div></div>';
    }

    /* 形式 / 病种 / 使用场景 / 受众 / 标签：与「新增内容」表单同一套字段与选项，
       唯一差别是这里的选项自动取自解析结果（auto.*），人可改。
       使用场景曾经在转载表单里没有，理由是「转载件不归本院使用场景管」；但那导致
       与内容库筛选条对不上、也不能按场景归类。2026-10-23 起两边字段一致。 */
    var sitesChosen = rpNormalize((auto.sites && auto.sites.v) || ['通用'], 0, '通用');
    var scenesChosen = rpNormalize((auto.scenes && auto.scenes.v) || [], 0);
    var tagsChosen = rpNormalize((auto.tags && auto.tags.v) || [], 3);
    var tagsTrimmed = ((auto.tags && auto.tags.v) || []).length > tagsChosen.length;
    /* 受众按内容线取两套之一；转载解析不出受众，默认给该内容线的默认人群，
       用户可改。不默认留空的话，转载件的受众筛选永远搜不到它。 */
    var audOptions = audienceOptions(st.track);
    var audChosen = rpNormalize((auto.audiences && auto.audiences.v) || defaultAudiences(st.track), 0);
    audChosen.forEach(function (x) { if (audOptions.indexOf(x) < 0) audOptions.push(x); });

    html += '<div class="rp-field"><div class="k">形式</div><div class="v">' +
      rpPicks('rp-kind', dictNames('kinds'), [(rec && rec.kind) || '文章'], auto.kind && auto.kind.low, true) + '</div></div>';
    html += '<div class="rp-field"><div class="k">病种</div><div class="v">' +
      rpPicks('rp-sites', dictNames('sites'), sitesChosen, auto.sites && auto.sites.low, false, true, 0, '通用') +
      rpCustom('rp-sites', '＋ 自定义病种，回车加入') + '</div></div>';

    html += '<div class="rp-field"><div class="k">使用场景</div><div class="v">' +
      rpPicks('rp-scenes', dictNames('scenes'), scenesChosen, false, false, false, 0) +
      '<div class="rp-hint">本院打算怎么用这篇（候诊播放 / 随访宣教 / 公众号推文…），可多选；与内容库筛选同口径</div></div></div>';

    html += '<div class="rp-field"><div class="k">受众</div><div class="v">' +
      rpPicks('rp-aud', audOptions, audChosen, false, false, false, 0) +
      '<div class="rp-hint">' + (st.track === '培训'
        ? '培训面向做登记工作的人：按岗位选，可多选'
        : '科普面向患者与家属：按人群选，可多选；拿不准就选「普通人群」') + '</div></div></div>';

    html += '<div class="rp-field"><div class="k">标签</div><div class="v">' +
      rpPicks('rp-tags', dictNames('tags'), tagsChosen, false, false, false, 3) +
      rpCustom('rp-tags', '＋ 自定义标签，回车加入') +
      '<div class="rp-hint">最多 3 个，影响检索命中' +
      (tagsTrimmed ? '<span style="color:#a1541a">（原文标了 ' + ((auto.tags && auto.tags.v) || []).length + ' 个，已取前 3 个，可自行调整）</span>' : '') +
      '</div></div></div>';

    /* 摘要：与新增表单一致——可空，留空则由正文首句自动生成。
       转载件以前没有这一栏，摘要恒为正文首句，列表里几条长文看着一模一样。 */
    html += '<div class="rp-field"><div class="k">摘要</div><div class="v">' +
      '<textarea class="rp-area" id="rp-summary" rows="2" placeholder="列表里显示的一句话；不填则取正文首句">' + esc((rec && rec.summary) || '') + '</textarea>' +
      '</div></div>';

    /* 正文：可选，默认折叠，一句话说完——转载的核心是「链接 + 元信息」，
       正文只是合规留痕的附加项，不需要在入库这一步做决策。 */
    html += '<details class="rp-more">' +
      '<summary>正文（可选）</summary>' +
      '<textarea class="rp-area" id="rp-body" rows="3" placeholder="贴原文正文，生成快照并锁定不改；不贴也行">' + esc((rec && rec._fillBody) || '') + '</textarea>' +
      '</details>';

    return html;
  }
  /* 选项组：single=true 为单选；keep=true 时点已选项不取消（病种是必填，
     取消后校验会拦，用户会以为控件坏了）；max 有值时为多选上限；
     excl 指定一个互斥项（病种的「通用」）——它和其他项不能同时选中。 */
  function rpPicks(name, opts, chosen, low, single, keep, max, excl) {
    return '<div class="rp-picks"' + (single ? ' data-single="1"' : '') + (keep ? ' data-keep="1"' : '') +
      (max ? ' data-max="' + max + '"' : '') + (excl ? ' data-excl="' + esc(excl) + '"' : '') +
      ' data-rpick="' + name + '">' + rpAllOpts(opts, chosen).map(function (o) {
        var on = chosen.indexOf(o) >= 0;
        return '<button type="button" class="' + (on ? 'on' : '') + (low && !on ? ' low' : '') + '" data-pick="' + esc(o) + '">' + esc(o) + '</button>';
      }).join('') + '</div>';
  }
  /* 已选值里可能有字典里没有的（自定义病种/标签、或字典项后来被禁用）：
     必须一并渲染成选中状态，否则重绘一次就静默丢标签，人也不会发现。 */
  function rpAllOpts(opts, chosen) {
    var extras = (chosen || []).filter(function (x) { return opts.indexOf(x) < 0; });
    return opts.concat(extras);
  }
  /* 解析结果直接渲染成选中态之前先归一化：
     · 标签超上限时截到上限（否则一打开就是违规态，点确认才被拦）
     · 病种里同时有「通用」和具体病种时丢掉「通用」（互斥项不能共存） */
  function rpNormalize(list, max, excl) {
    var out = (list || []).filter(function (x, i, arr) { return x && arr.indexOf(x) === i; });
    if (excl && out.length > 1) {
      out = out.filter(function (x) { return x !== excl; });
    }
    if (!out.length) out = excl ? [excl] : [];
    if (max && out.length > max) out = out.slice(0, max);
    return out;
  }
  /* 自定义值入口：病种/标签的字典是有限的，官方原文常带新提法（如「肺癌筛查」「免疫治疗」），
     不给入口就只能硬塞进最接近的既有项，检索时永远搜不到。 */
  function rpCustom(name, ph) {
    return '<div class="rp-custom">' +
      '<input class="rp-input rp-custom-in" data-rpin="' + name + '" maxlength="16" placeholder="' + esc(ph) + '">' +
      '<button type="button" class="btn btn-outline btn-xs" data-kb="rpAddPick" data-arg="' + name + '">加入</button>' +
      '</div>';
  }
  /* 把一个自定义值加进点选区并选中；已在区内的直接选中。
     超出上限时不加，提示还差几个——静默截断会让人以为点了没反应。 */
  function rpAddPick(name) {
    var box = document.querySelector('[data-rpick="' + name + '"]');
    var inp = document.querySelector('[data-rpin="' + name + '"]');
    if (!box || !inp) return;
    var v = String(inp.value || '').trim().replace(/\s+/g, ' ');
    if (!v) { say('先填要自定义的名称', 'error'); return; }
    var same = null;
    box.querySelectorAll('[data-pick]').forEach(function (x) { if (x.getAttribute('data-pick') === v) same = x; });
    if (same) {
      same.classList.add('on');
      /* 自定义值也是「具体病种」，与「通用」互斥，同样要清掉它 */
      var ex = box.getAttribute('data-excl');
      if (ex && v !== ex) {
        var eb = box.querySelector('[data-pick="' + ex.replace(/"/g, '') + '"]');
        if (eb) eb.classList.remove('on');
      }
      inp.value = '';
      say('已有「' + v + '」，已选中', 'info');
      return;
    }
    var max = Number(box.getAttribute('data-max')) || 0;
    if (max && box.querySelectorAll('[data-pick].on').length >= max) {
      say('最多选 ' + max + ' 个，先取消一个再加', 'error');
      return;
    }
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-pick', v);
    b.className = 'on';
    b.textContent = v;
    box.appendChild(b);
    var ex2 = box.getAttribute('data-excl');
    if (ex2 && v !== ex2) {
      var eb2 = box.querySelector('[data-pick="' + ex2.replace(/"/g, '') + '"]');
      if (eb2) eb2.classList.remove('on');
    }
    inp.value = '';
  }
  /* 入库时把自定义值补齐进字典：分类维护页是字典的唯一出处，
     不补的话这个病种/标签只存在于这一条内容上，筛选下拉里永远看不到它。 */
  function registerDictValues(dim, names) {
    var added = [];
    (names || []).forEach(function (n) {
      var name = String(n || '').trim();
      if (!name) return;
      if (DICT[dim].some(function (x) { return x.name === name; })) return;
      var meta = dictTypeMeta(dim);
      var seq = DICT[dim].reduce(function (m, x) { return Math.max(m, Number(x.sort) || 0); }, 0) + 1;
      DICT[dim].push(d(meta.prefix + '-' + pad(seq), name, seq, '启用', ''));
      added.push(name);
      log(ME.name, '新增字典项', meta.t + '/' + name + '（转载自定义）');
    });
    return added;
  }
  /* 单条转载的底栏 */
  function rpSingleFoot() {
    var st = KB.rp;
    if (st.rec && st.rec.block) {
      return '<span class="rp-ft-l">解析没成功也能入库：把上面几项填好即可（存为草稿，可再上架）</span>' +
        '<button class="btn btn-outline btn-sm" data-kb="rpClose">取消</button>' +
        '<button class="btn btn-primary btn-sm" data-kb="rpConfirm">入库</button>';
    }
    if (st.rec) {
      var dup = findReprintBy(st.rec.source);
      if (dup) {
        return '<span class="rp-ft-l">该原文已转载过（' + esc(dup.id) + '）</span>' +
          '<button class="btn btn-outline btn-sm" data-kb="rpClose">取消</button>' +
          '<button class="btn btn-primary btn-sm" data-kb="rpOpenDup" data-arg="' + esc(dup.id) + '">打开原条</button>';
      }
      return '<span class="rp-ft-l">确认无误即可入库（存为草稿，可在列表里上架）</span>' +
        '<button class="btn btn-outline btn-sm" data-kb="rpClose">取消</button>' +
        '<button class="btn btn-primary btn-sm" data-kb="rpConfirm">确认转载</button>';
    }
    return '<span class="rp-ft-l">填好上面几项即可入库（存为草稿，可在列表里上架）</span>' +
      '<button class="btn btn-outline btn-sm" data-kb="rpClose">取消</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="rpConfirm">入库</button>';
  }
  function parseUrlInput() {
    var el = $('rp-url');
    if (el) KB.rp.urlInput = el.value;
    doParse(String((el ? el.value : KB.rp.urlInput) || '').trim());
  }
  function doParse(input) {
    var st = KB.rp; if (!st) return;
    if (!input) { say('请先粘贴原文链接', 'error'); return; }
    st.urlInput = input;
    /* 手动改过的值先存下来：重绘会把 DOM 整个换掉，它们的唯一载体是 DOM。
       换网址就是换文章，此时不沿用上一份草稿，否则会把上一篇的分类带过来。 */
    var draft = readRpDraft();
    var prevUrl = normalizeUrl((st.rec && ((st.rec.source && st.rec.source.url) || st.rec.url)) || '');
    var r = buildReprint(input);
    if (!r.ok) {
      /* 失败不终止：把 code/hint/url/source 一起带进状态，表单据此给出可点的下一步。
         source 要带上——非白名单时表单要显示「授权说明」，confirmReprint 也要靠它判断 basis。 */
      st.rec = {
        block: r.why, code: r.code, hint: r.hint, url: r.url, host: r.host, platform: r.platform,
        source: makeSource(r.platform || r.host || '', r.url || '', '', '', r.platform || r.host || '', '', r.code === 'NOT_WHITE' ? 'authored' : 'official')
      };
      st.rec.incomplete = true;
      /* 失败时也回填抠出来的网址（NOT_URL 时没有）；粘整段分享文案时才看得出系统取了哪个链接 */
      if (r.url) st.urlInput = r.url;
      if (prevUrl && normalizeUrl(r.url || '') === prevUrl) applyRpDraft(st.rec, draft);
      renderRp();
      say(r.why, 'error');
      return;
    }
    st.rec = r.rec;
    if (r.incomplete) st.rec.incomplete = true;
    /* 输入框回填干净网址：粘整段分享文案时，原文案在 576px 的框里横向滚出去，
       既看不出取了哪个链接，也没法核对。回填后还能手动改。 */
    st.urlInput = (r.rec.source && r.rec.source.url) || r.rec.url || st.urlInput;
    /* 解析成功后，把补录的正文暂存进 rec._fillBody，重绘时回填 */
    st.rec._fillBody = (st.rec._fillBody) || '';
    if (prevUrl && normalizeUrl((r.rec.source && r.rec.source.url) || '') === prevUrl) applyRpDraft(st.rec, draft);
    renderRp();
    say(r.incomplete ? '只拿到链接，标题请手填（正文可留空）' : '已解析：' + r.rec.source.platform, r.incomplete ? 'info' : 'success');
  }
  /* 取当前表单里人为填/点的值（重绘前先存下来）。 */
  function readRpDraft() {
    function picksOf(id) {
      var out = []; var b = document.querySelector('[data-rpick="' + id + '"]');
      if (b) b.querySelectorAll('[data-pick].on').forEach(function (x) { out.push(x.getAttribute('data-pick')); });
      return out;
    }
    function v(id) { var e = $(id); return e ? String(e.value).trim() : ''; }
    return {
      sites: picksOf('rp-sites'), tags: picksOf('rp-tags'),
      /* 解析重绘前先把新增的三项存下来，否则重解析一次人填的场景/受众/摘要全丢 */
      scenes: picksOf('rp-scenes'), audiences: picksOf('rp-aud'),
      title: v('rp-title'), platform: v('rp-platform'), date: v('rp-date'),
      summary: v('rp-summary'),
      note: v('rp-note'), body: v('rp-body')
    };
  }
  /* 把草稿写回解析结果：只覆盖人真的填过的项，空值不抹掉解析结果。 */
  function applyRpDraft(rec, d) {
    if (!rec || !d) return;
    rec.auto = rec.auto || {};
    if (d.sites.length) rec.auto.sites = { v: d.sites, low: !!(rec.auto.sites && rec.auto.sites.low) };
    if (d.tags.length) rec.auto.tags = { v: d.tags, low: false };
    if (d.scenes.length) rec.auto.scenes = { v: d.scenes, low: false };
    if (d.audiences.length) rec.auto.audiences = { v: d.audiences, low: false };
    if (d.title) { rec.title = d.title; if (rec.source) rec.source.title = d.title; }
    /* 摘要与其它项不同：它可能是人主动清空的，所以无条件按表单值写回
       （表单初值就取自 rec.summary，没动过时写回的是原值，不会丢）。
       用「空值不覆盖」的规则会让清空操作在重解析后复活。 */
    rec.summary = d.summary;
    if (d.platform) { rec.source = rec.source || makeSource('', '', '', '', '', '', 'official'); rec.source.platform = d.platform; }
    if (d.date) { rec.source = rec.source || makeSource('', '', '', '', '', '', 'official'); rec.source.publishedAt = d.date; }
    if (d.note) rec.noteDraft = d.note;
    if (d.body) rec._fillBody = d.body;
  }
  /* 校验失败不只是弹一句 toast：把那一格滚进视野并闪一下，避免"点了没反应"的错觉 */
  function rpNeedPick(sel, msg) {
    say(msg, 'error');
    var box = document.querySelector(sel);
    if (!box) return;
    try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }
    box.style.outline = '2px solid #b42335';
    box.style.outlineOffset = '2px';
    setTimeout(function () { box.style.outline = ''; }, 1600);
  }
  /* 读极简表单：链接/标题/形式/标签/病种/来源 + 可选正文 + 是否直接上架 */
  function readRpForm() {
    function v(id) { var e = $(id); return e ? String(e.value).trim() : ''; }
    function picksOf(id) {
      var out = []; var b = document.querySelector('[data-rpick="' + id + '"]');
      if (b) b.querySelectorAll('[data-pick].on').forEach(function (x) { out.push(x.getAttribute('data-pick')); });
      return out;
    }
    return {
      url: v('rp-url'), title: v('rp-title'), platform: v('rp-platform'),
      date: v('rp-date').replace(/[.\/]/g, '-'),
      kind: picksOf('rp-kind')[0] || '文章',
      sites: picksOf('rp-sites'), tags: picksOf('rp-tags'),
      /* 与新增表单同口径的新增项：使用场景 / 受众 / 摘要 */
      scenes: picksOf('rp-scenes'), audiences: picksOf('rp-aud'),
      summary: v('rp-summary'),
      body: v('rp-body'), note: v('rp-note'),
      /* 转载表单不再有上架勾选：一律存为草稿，上架在列表/详情页单独操作 */
      publish: false
    };
  }
  /* 确认入库（解析成功与手填共用一个出口） */
  function confirmReprint() {
    var st = KB.rp;
    if (!st || !st.rec) return;
    var f = readRpForm();
    if (!f.title) { rpNeedPick('#rp-title', '标题必填（照抄原文标题）'); return; }
    if (!f.platform) { rpNeedPick('#rp-platform', '来源必填——没有它这条内容没法证明出自官方'); return; }
    if (f.date && !/^\d{4}-\d{1,2}-\d{1,2}$/.test(f.date)) { rpNeedPick('#rp-date', '发布日期格式如 2026-09-12'); return; }
    if (!f.sites.length) { rpNeedPick('[data-rpick="rp-sites"]', '至少选 1 个病种（通用也可以）'); return; }
    if (f.tags.length > 3) { rpNeedPick('[data-rpick="rp-tags"]', '标签最多 3 个'); return; }

    /* 自定义病种/标签先入字典，再随内容一起落库——否则这条内容上的新词在筛选下拉里查不到。
       使用场景没有自定义入口（与新增表单一致），只能从字典选，无需补字典。 */
    registerDictValues('sites', f.sites);
    registerDictValues('tags', f.tags);

    var rec = st.rec;
    var authored = rec.code === 'NOT_WHITE' || (rec.source && rec.source.basis === 'authored');
    if (authored && !f.note) { rpNeedPick('#rp-note', '非白名单来源必须填授权说明'); return; }

    /* 用表单值覆盖解析结果：人在界面上改过的就是最终值 */
    rec.title = f.title;
    rec.kind = f.kind;
    if (!rec.source) rec.source = makeSource(f.platform, f.url, f.title, f.date || today(), f.platform, '', authored ? 'authored' : 'official');
    rec.source.platform = f.platform;
    rec.source.title = f.title;
    rec.source.url = f.url ? normalizeUrl(f.url) : rec.source.url;
    rec.source.host = rec.source.url ? hostOf(rec.source.url) : rec.source.host;
    if (f.date) rec.source.publishedAt = f.date;
    if (authored) rec.attest = { by: ME.id, at: nowStr(), note: f.note };
    /* 解析失败时内容是人填的：要记成 manual，否则合规审查会以为正文是系统抓的 */
    if (rec.block) { rec.manual = true; rec.blocks = f.body ? null : rec.blocks; }

    var created = createReprint(rec, {
      /* 与新增内容表单一致：场景、标签、受众、摘要都由表单落值。
         受众留空时回落到该内容线的默认人群，否则转载件按受众筛永远搜不到。 */
      track: st.track, kind: f.kind, sites: f.sites, scenes: f.scenes, tags: f.tags,
      audiences: f.audiences.length ? f.audiences : defaultAudiences(st.track),
      summary: f.summary,
      editorNote: '', publish: f.publish
    }, st.owner, st.track, f.body ? { body: f.body } : null);
    if (!created) return;
    closeRp();
    say('已入库 ' + created.id + '（' + (created.status === '启用' ? '已上架' : (created.snapshot ? '草稿' : '草稿 · 未存正文快照')) + '）', 'success');
    if (created.status === '启用') openDetail(created.id); else refresh();
  }
  /* ---------- 转载页签的「官方可转载清单」 ----------
     原来这是一个独立页面（侧导航 › 转载专区）。转载不是独立模块，进货口也不该单开一页：
     清单是「还没转的」，卡片是「已经转的」，两件事同属转载，同屏上下更好用。
     清单默认折叠——日常是来看已转载的，只有要进货时才展开。 */
  function rpFeedBlock(track) {
    var feed = OFFICIAL_FEED.filter(function (x) { return (x.track || '科普') === track; })
      .sort(function (a, b) { return b.publishedAt.localeCompare(a.publishedAt); });
    var un = feed.filter(function (x) { return !findReprintBy({ sourceId: x.sid, url: x.url }); }).length;
    /* 清单的搜索 / 来源筛选随统计条一起去掉了，这里不再二次过滤：
       计数与表体同源，避免「N 条」和表里行数对不上。 */
    var feed2 = feed;
    var rows = feed2.map(function (x) {
      var dup = findReprintBy({ sourceId: x.sid, url: x.url });
      return '<tr>' +
        '<td><span class="ttl">' + esc(x.title) + '</span>' +
        '<span class="sub">' + esc((x.sites || []).join('、') || '通用') + ' · ' + esc((x.tags || []).slice(0, 2).join('、') || '—') + '</span></td>' +
        '<td>' + esc(x.platform) + '</td>' +
        '<td>' + esc(x.publishedAt || '—') + '</td>' +
        '<td>' + esc(x.kinds) + '</td>' +
        '<td>' + esc((x.sites || []).join('、') || '通用') + '</td>' +
        '<td class="ops">' +
        '<a class="btn btn-ghost btn-xs" href="' + esc(x.url) + '" target="_blank" rel="noopener">原文</a>' +
        (dup
          ? '<button class="btn btn-ghost btn-xs" data-kb="view" data-arg="' + esc(dup.id) + '">已转载</button>'
          : '<button class="btn btn-primary btn-xs" data-kb="rpFromFeed" data-arg="' + esc(x.sid) + '">转载</button>') +
        '</td></tr>';
    }).join('');
    var feedTable = grid(['标题', '来源', '发布日期', '形式', '病种', '操作'], [rows], '官方清单为空。', '')
      .replace('<table class="data-table kb-rec-table">', '<table class="data-table kb-rec-table rp-feed-table">');
    return '<details class="rp-feedbox"' + (KB.rpFeedOpen ? ' open' : '') + '>' +
      '<summary data-kb="rpFeedToggle"><b>官方可转载清单</b>' +
      '<span class="n">' + feed2.length + ' 条，其中 ' + un + ' 条未转载</span>' +
      '<span class="tip">点「转载」自动解析并填好链接 / 标题 / 形式 / 病种 / 标签 / 来源</span></summary>' +
      '<div class="rp-feedbox-bd">' + feedTable + '</div>' +
      '</details>';
  }
  /* ---------- 批量粘贴：一次多条链接 ----------
     与单条同一套解析器；失败的行单列、标原因、不可勾选，不影响其它行入库。 */
  function rpBulkBody() {
    var st = KB.rp;
    var html = '<div class="rp-block rp-block--link"><div class="rp-link-row">' +
      '<textarea class="rp-area" id="rp-bulk" rows="5" placeholder="每行一个链接，最多 50 行">' + esc(st.batchUrl || '') + '</textarea>' +
      '<button class="btn btn-outline btn-sm" data-kb="rpBulkParse">开始解析</button></div>' +
      '<div class="rp-hint">白名单外的链接会被挂起并写明原因，不影响其它行入库</div></div>';
    if (!st.rows.length) return html;
    var rows = st.rows.map(function (r, i) {
      if (!r.ok) {
        return '<tr class="rp-off"><td><input type="checkbox" disabled></td>' +
          '<td class="rp-t">' + esc(r.input) + '<span class="rp-sub">⛔ ' + esc(r.why) + '</span></td>' +
          '<td><span class="rp-chip bad">挂起</span></td><td>—</td><td>—</td><td>—</td><td>—</td></tr>';
      }
      return '<tr>' +
        '<td><input type="checkbox" class="rp-ck" data-i="' + i + '"' + (r.off ? '' : ' checked') + '></td>' +
        '<td class="rp-t">' + esc(r.rec.title) + '<span class="rp-sub">' + esc(r.rec.source.url) + '</span></td>' +
        '<td><span class="rp-chip ok">' + esc(r.rec.source.platform) + '</span></td>' +
        '<td>' + esc(r.rec.kind) + '</td>' +
        '<td><select data-rpb="sites" data-i="' + i + '">' + dictNames('sites').map(function (s) {
          return '<option' + (r.sites.indexOf(s) >= 0 ? ' selected' : '') + '>' + esc(s) + '</option>';
        }).join('') + '</select></td>' +
        '<td>' + esc(r.rec.source.publishedAt || '—') + '</td>' +
        '<td>' + (r.dup ? '<span class="rp-chip warn">已转载</span>' : '<span class="rp-chip ok">可入库</span>') + '</td></tr>';
    }).join('');
    return html + '<div class="rp-step"><div class="rp-step-hd"><i>✓</i>逐条确认<em>病种可在行内改；「批量设病种」在底栏</em></div>' +
      '<div class="table-wrap"><table class="data-table rp-table"><thead><tr><th></th><th>标题 / 链接</th><th>来源</th><th>形式</th><th>病种</th><th>发布日期</th><th>校验</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }
  function rpBulkFoot() {
    var st = KB.rp;
    var ok = st.rows.filter(function (r) { return r.ok && !r.off; }).length;
    var bad = st.rows.filter(function (r) { return !r.ok; }).length;
    return '<span class="rp-ft-l">已选 <b>' + ok + '</b> 条（解析 ' + st.rows.length + ' 条' + (bad ? '，挂起 ' + bad + ' 条' : '') + '）</span>' +
      '<select id="rp-bulk-site" class="rp-input" style="flex:0 0 140px;height:32px"><option value="">批量设病种…</option>' +
      dictNames('sites').map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select>' +
      '<button class="btn btn-outline btn-sm" data-kb="rpClose">取消</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="rpBulkConfirm">入库</button>';
  }
  function readBulkInput() { var el = $('rp-bulk'); if (el) KB.rp.batchUrl = el.value; }
  function parseBulk() {
    readBulkInput();
    var lines = String(KB.rp.batchUrl || '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 50);
    if (!lines.length) { say('先粘贴链接', 'error'); return; }
    KB.rp.rows = lines.map(function (ln) {
      var r = buildReprint(ln);
      if (!r.ok) return { ok: false, input: ln, why: r.why };
      var auto = r.rec.auto || {};
      return {
        ok: true, input: ln, rec: r.rec, dup: !!findReprintBy(r.rec.source), off: false,
        sites: (auto.sites && auto.sites.v) || ['通用'],
        tags: (auto.tags && auto.tags.v) || []
      };
    });
    /* 默认勾上能入库的（去重命中的不勾）：解析完直接能点「入库」 */
    KB.rp.rows.forEach(function (r) { if (r.ok) r.off = !!r.dup; });
    renderRp();
    var canUse = KB.rp.rows.filter(function (r) { return r.ok && !r.dup; }).length;
    say('解析完成：可入库 ' + canUse + ' 条', canUse ? 'success' : 'info');
  }
  /* 行内改动在重绘前先收回状态，别一改就重置 */
  function syncBulkEdits() {
    document.querySelectorAll('[data-rpb]').forEach(function (el) {
      var i = parseInt(el.getAttribute('data-i'), 10), r = KB.rp.rows[i];
      if (!r || !r.ok) return;
      if (el.getAttribute('data-rpb') === 'sites') r.sites = [el.value];
    });
    document.querySelectorAll('.rp-ck').forEach(function (el) {
      var i = parseInt(el.getAttribute('data-i'), 10), r = KB.rp.rows[i];
      if (r && r.ok) r.off = !el.checked;
    });
    var siteSel = $('rp-bulk-site');
    if (siteSel && siteSel.value) { KB.rp.rows.forEach(function (r) { if (r.ok) r.sites = [siteSel.value]; }); siteSel.value = ''; }
  }
  function confirmBulk() {
    syncBulkEdits();
    /* 与单条一致：批量入库也一律是草稿，上架单独操作 */
    var pub = false;
    var todo = KB.rp.rows.filter(function (r) { return r.ok && !r.off; });
    if (!todo.length) { say('没有可入库的行：先勾选，或处理掉挂起的行', 'error'); return; }
    var owner = KB.rp.owner, made = 0, skipped = 0;
    todo.forEach(function (r) {
      if (!r.sites.length) { skipped++; return; }
      /* 批量行只采集病种，其余字段与单条走同一套默认值（场景留空、受众取内容线默认、
         摘要取正文首句），保证两条通道入库 出来的内容字段结构一致。
         以前这里显式写 scenes:[]、createReprint 内写死受众，两边都与单条不同。 */
      var a = createReprint(r.rec, {
        track: r.rec.track || KB.rp.track, kind: r.rec.kind, sites: r.sites, scenes: [],
        tags: r.tags, editorNote: '', publish: pub
      }, owner, r.rec.track || KB.rp.track);
      if (a) made++; else skipped++;
    });
    closeRp();
    say('批量转载完成：入库 ' + made + ' 条' + (skipped ? '，跳过 ' + skipped + ' 条' : '') + (pub ? '，已按「直接上架」处理' : '，均为草稿'), made ? 'success' : 'error');
    refresh();
  }

  /* 原文在外部站点：新窗口打开。不用 <a target=_blank> 统一写法是为了能在行内按钮里复用 act() */
  function openExternal(url) {
    if (!url) { say('这条没有记录原文链接', 'error'); return; }
    try { window.open(url, '_blank', 'noopener'); } catch (e) { say(url, 'info'); }
  }
  /* ---------- 外发：带出处复制 / 长图 ----------
     转载件复制出去必须带「来源 + 日期 + 原文链接 + 未作修改」，否则护士转发到群里就丢了溯源。 */
  function exportText(a) {
    var s = a.source || {};
    return '（原文）' + (s.title || a.title) + '\n' +
      '来源：' + (s.platform || '') + '　发布日期：' + (s.publishedAt || '') + '\n' +
      '原文链接：' + (s.url || '') + '\n' +
      '——以下为转载，内容未作修改——\n\n' +
      (a.editorNote ? '【编者按】' + a.editorNote + '\n\n' : '') + stripHtmlToText(a.body);
  }
  function copyTextWithTrack(txt, isRpCopy, id) {
    function ok() {
      if (isRpCopy) {
        var a = find(KB.assets, id);
        if (a) a.copyCount = (a.copyCount || 0) + 1;
        reprintLog(id, '复制外发', { channel: '复制文本' });
      }
      say(isRpCopy ? '已复制（含来源与原文链接），可直接粘贴' : '已复制正文，可直接粘贴', 'success');
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { say('浏览器不支持自动复制，请手动全选复制', 'error'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fallback);
    else fallback();
  }
  /* ---------- 详情页挂载：来源行 / 编者按 / 转载声明 / 外发按钮 ----------
     kb-detail.js 负责按形式排版，这里只往它的版式里插块，不改分支结构。 */
  function reprintSourceBar(a) {
    var s = a.source || {};
    /* 来源条分两层：主信息（转载自谁 · 原文发布日 · 原文链接）一行；
       辅助信息（原文作者 / 发布人 · 发布单位 / 快照状态）另起一行。
       「原文作者」是官方稿件的署名，「发布人 / 发布单位」是我方把这条发进库的责任主体，两者不能合并。 */
    return '<div class="kbx-srcbar" data-kbx-mount="srcbar">' +
      '<div class="kbx-srcbar-l1">' +
      '<span class="kbx-srcbar-tag">官方转载</span>' +
      '<span class="kbx-srcbar-main">转载自 <b>' + esc(s.platform || '未注明来源') + '</b>' +
      (s.publishedAt ? ' · 原文发布于 ' + esc(s.publishedAt) : '') + '</span>' +
      (s.url ? '<a class="kbx-srcbar-link" href="' + esc(s.url) + '" target="_blank" rel="noopener">查看原文 ↗</a>' : '') +
      '</div>' +
      '<div class="kbx-srcbar-l2">' +
      (s.author ? '<span>原文作者：' + esc(s.author) + '</span>' : '') +
      (a.publisher ? '<span class="kbx-srcbar-pub">发布人：' + esc(a.publisher) + '</span>' : '') +
      (a.publisherOrg ? '<span class="kbx-srcbar-pub">发布单位：' + esc(a.publisherOrg) + '</span>' : '') +
      /* 正文可以不填，所以「没快照」是正常态而不是错误——但要明说，
         让人知道这条的正文未经核验，别把它当已核过的稿子引用 */
      (!a.snapshot || !a.snapshot.hash ? '<span class="kbx-srcbar-muted">未存原文快照 · 正文未经核验</span>' : '') +
      '</div>' +
      '</div>';
  }
  function reprintEditorNote(a) {
    return a.editorNote ? '<div class="kbx-editor-note" data-kbx-mount="note"><b>编者按</b><span>' + esc(a.editorNote) + '</span></div>' : '';
  }
  function reprintDecl(a) {
    var s = a.source || {};
    /* 「未对正文作任何修改」只在对正文确实存在时才说得通。
       正文是选填的：没转正文的件必须明说「仅收录出处」，否则声明是在替不存在的正文背书。 */
    var hasBody = !!stripHtmlToText(String(a.body || ''));
    var snap = !!(a.snapshot && a.snapshot.hash);
    var claim = !hasBody
      ? '<p>本条<b>仅收录出处与元信息，未转载正文</b>；全文请点击上方原文链接到官方页面阅读。</p>'
      : (snap
        ? '<p>转载时<b>未对正文内容作任何修改</b>，并已留存原文快照（' + esc(a.snapshot.hash) + '）供日后核对。如原文已更新或下线，请以原文为准。</p>'
        : '<p>正文已按原文转载，但<b>未留存原文快照</b>；如原文已更新或下线，请以原文为准。</p>');
    return '<section class="kbx-reprint-decl" id="kbx-reprint-decl" data-kbx-mount="decl">' +
      '<b>转载声明</b>' +
      '<p>本文转载自 <span class="kbx-rd-plat">' + esc(s.platform || '') + '</span>' +
      (s.publishedAt ? '（' + esc(s.publishedAt) + '）' : '') +
      (s.author ? '，原文作者 ' + esc(s.author) : '') + '，原文链接 <a href="' + esc(s.url || '#') + '" target="_blank" rel="noopener">' + esc(s.url || '') + '</a>。</p>' +
      claim +
      (a.attest ? '<p class="kbx-rd-at">授权：' + esc(a.attest.note) + '（' + esc(a.attest.at) + '）</p>' : '') +
      '</section>';
  }
  /* 待补转载件补录发布日期：日期是元数据（可人工补），正文才是「一字不改」的对象。
     解析不出日期的兜底件/授权件靠它过门禁。 */
  function syncRpDate(a) {
    var el = $('kb-rp-date');
    if (!el) return true;
    var v0 = String(el.value || '').trim().replace(/[.\/]/g, '-');
    if (!v0) return true;
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(v0)) { say('发布日期格式应为 2026-09-12', 'error'); return false; }
    a.source.publishedAt = v0;
    a.evidence = sourceText(a);
    reprintLog(a.id, '补录发布日期', { publishedAt: v0 });
    return true;
  }
  /* 挂载：只认 kb-detail.js 预先埋好的两个标记位，不靠"找第一个 .kbx-prose"猜位置——
     详情页里正文容器不止一处（阅读版心、视频简介、课件说明、手册正文），猜错就会挂到看不见的区块上。
       来源行      → 插在标题区之后
       编者按      → 插在 <i data-kbx-rp="note"></i> 占位处
       转载声明    → 插在 <i data-kbx-rp="decl"></i> 占位处（文末，锚点 #kbx-reprint-decl 指向它）
       外发按钮    → 插进动作条的「外发」分组（#kbx-actbar-share），不跟读者的收藏/取用挤在一起 */
  function mountReprint(html, a) {
    var out = String(html || '');
    if (!isReprint(a)) return out;
    out = out.replace('</header>', '</header>' + reprintSourceBar(a));
    out = out.replace('<i data-kbx-rp="note"></i>', reprintEditorNote(a) || '');
    /* 用函数式替换：reprintDecl 里是正文/标题，可能带 $& $1 这类字符，
       直接当替换串传会被 String.replace 当成替换模式解析，声明块会错乱。 */
    out = out.replace('<i data-kbx-rp="decl"></i>', function () { return reprintDecl(a); });
    out = out.replace('<div class="kbx-actbar-grp kbx-actbar-grp--share" id="kbx-actbar-share"></div>',
      '<div class="kbx-actbar-grp kbx-actbar-grp--share" id="kbx-actbar-share">' +
      '<span class="kbx-actbar-lb">外发</span>' +
      '<button class="btn btn-ghost btn-sm" data-kb="rpCopy" data-arg="' + esc(a.id) + '">📋 带出处复制</button>' +
      '</div>');
    return out;
  }
/* ---- RP UI END ---- */

  /* ================= 动作：看 / 拿 / 改 / 养 / 补 ================= */
  /* 看 —— 预览：打开内容详情页（kb-detail.js 按内容形式分版式），不再弹窗 */
  function viewAsset(id) { openDetail(id); }

  /* 拿 —— 取用：复制正文 / 下载。每次下载落一条「下载」事件，「我的下载」与统计都从那里取 */
  /* 正文纯文本：下载 TXT、再次下载都走这里，保证两处导出的内容一致 */
  function plainOf(a) {
    return a.title + '\n\n' + String(a.body).replace(/<br\s*\/?>/g, '\n').replace(/<\/p>|<\/h2>|<\/h3>|<\/li>/g, '\n').replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  function pickAsset(id) {
    var a = find(KB.assets, id); if (!a) return;
    /* 转载件的「复制正文」必须带出处：原来复制出去是纯正文，转发到群里就没有来源了 */
    var plain = isReprint(a) ? exportText(a) : plainOf(a);
    var fileRow = (a.attachments || []).map(function (f) {
      return '<div class="kb-file"><span class="nm">' + esc(f.name) + ' <span style="color:#94a3b8;font-weight:400">' + esc(f.size || '') + '</span></span>' + act('下载', 'dl', a.id + '|' + f.name) + '</div>';
    }).join('');
    modal('取用「' + a.title + '」', a.id,
      '<div style="font-size:12px;color:#667085;font-weight:600;margin-bottom:6px">' +
      (isReprint(a) ? '正文（<b style="color:#244765">已附来源与原文链接</b>，可直接粘贴）' : '正文（可编辑后复制）') + '</div>' +
      '<textarea id="kb-pick-text" rows="12" style="width:100%;border:1px solid #d1d8e0;border-radius:6px;padding:10px;font-size:13px;line-height:1.7;box-sizing:border-box;font-family:inherit">' + esc(plain) + '</textarea>' +
      (fileRow ? '<div style="font-size:12px;color:#667085;font-weight:600;margin:14px 0 6px">附件</div>' + fileRow : ''),
      '<button class="btn btn-outline btn-sm" data-kb="close">关闭</button>' +
      '<button class="btn btn-outline btn-sm" data-kb="dlText" data-arg="' + esc(a.id) + '">下载 TXT</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="copy">' + (isReprint(a) ? '带出处复制' : '复制正文') + '</button>', false);
  }
  /* 「我的下载」里的再次下载：正文类可重生成；附件类原型没有真文件，据实说明，不假装能下 */
  function dlAgain(g) {
    var p = g.split('|'), id = p[0], fname = p[1] || '';
    var a = find(KB.assets, id);
    if (!a) { say('这条内容已被删除，无法再次下载', 'error'); return; }
    var txt = /\.txt$/i.test(fname);
    if (txt) { downloadText(fname || safeFileName(a.title) + '.txt', isReprint(a) ? exportText(a) : String(a.body).replace(/<[^>]*>/g, '')); }
    else { say('附件《' + (fname || '原文件') + '》已在详情页归档，请到内容详情页重新取用（原型不内置原文件）', 'info'); openDetail(id); return; }
    pushEvent('下载', a.id, { fileName: fname || (a.title + '.txt'), size: '—', via: txt ? '正文TXT' : '附件' });
    refresh();
  }
  function copyPickText() {
    var ta = $('kb-pick-text'); if (!ta) return;
    /* 从哪条内容打开的取用弹窗，就记在谁的头上：读弹窗里「下载 TXT」按钮的内容编号，
       不要读标题行——那里只写着「正文」，拿不到编号。 */
    var btn = document.querySelector('.kb-mask [data-kb="dlText"]');
    var id = btn ? btn.getAttribute('data-arg') : '';
    copyTextWithTrack(ta.value, !!(id && isReprint(find(KB.assets, id))), id);
  }
  /* 官方标题里常见半角冒号、斜杠（如「HPV 疫苗: 常见问题 / 第二版」），
     这类字符做文件名在 Windows 上会静默下载失败，统一换成全角 */
  function safeFileName(name) {
    return String(name || '未命名').replace(/[\\/:*?"<>|]/g, '／').replace(/[\r\n\t]+/g, ' ').slice(0, 80);
  }
  function downloadText(filename, text) {
    try {
      var blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click();
      setTimeout(function () { document.body.removeChild(link); URL.revokeObjectURL(url); }, 120);
      say('已下载 ' + filename, 'success');
    } catch (e) { say('当前环境不支持下载，请用复制', 'error'); }
  }

  /* 收藏 —— 我在库里挑出来留着用的内容。
     真值是 KB.events 里的「收藏」事件（带 uid，所以知道是谁收藏的）；
     a.fav / a.favAt 只是当前账号的导出缓存，给卡片 ★ 角标用。 */
  function toggleFav(id) {
    var a = find(KB.assets, id); if (!a) return;
    var on = !a.fav;
    if (on) pushEvent('收藏', a.id, {});
    else removeFavEvent(a.id);
    syncFavFlags();
    log(ME.name, on ? '收藏内容' : '取消收藏', a.id);
    say(on ? '已收藏《' + a.title + '》，在「我的内容」里可查' : '已取消收藏', 'success');
    refreshKeepDetail();
  }

  /* 养 —— 新建 / 编辑 */
  /* 归属合集：一个内容可以同时在多个合集里（B 站只能进一个，这里放开，因为同一集
     既要进「放疗全程护理」也要进「2026 患者宣教精选」）。勾选即可，顺序由合集页维护。 */
  function collectPicker(a) {
    var mine = (a ? collectionsOf(a.id) : []).map(function (c) { return c.id; });
    var usable = KB.collections.filter(function (c) { return visibleIn(c) && (c.lib === '省库' || c.org === ME.org); });
    var chips = usable.length
      ? usable.map(function (c) {
          var on = mine.indexOf(c.id) >= 0;
          return '<button type="button" data-pick="' + esc(c.id) + '" class="' + (on ? 'on' : '') + '">' +
            esc(c.name) + '<span class="kb-pick-n">' + c.members.length + '</span></button>';
        }).join('')
      : '<span class="kb-pick-empty">还没有合集</span>';
    /* 表单里直接建合集：建完立刻选中，不用另开页面 */
    return '<div class="kb-col-field">' +
      '<div class="kb-picks" id="kb-a-cols">' + chips + '</div>' +
      '<div class="kb-col-new">' +
      '<input id="kb-a-newcol" placeholder="新建合集名，如：放疗全程护理" maxlength="40">' +
      '<button type="button" class="btn btn-outline btn-xs" data-kb="formNewCol">＋ 新建并加入</button>' +
      '</div>' +
      '<div class="hint">可多选。合集简介 / 封面在该合集的详情页顶部「改信息」里填</div>' +
      '</div>';
  }
  /* 表单内新建合集：只建壳（停用），保存内容时由 syncMembership 入集 */
  /* 摘要留空时从正文取首句：去掉标签、截断到一行能显示的长度 */
  function autoSummary(bodyHtml) {
    var txt = String(bodyHtml || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!txt) return '';
    var first = (txt.match(/[^。！？.!?]+[。！？.!?]?/) || [txt])[0].trim();
    return first.length > 60 ? first.slice(0, 60) + '…' : first;
  }
  function formCreateCollection() {
    var el = $('kb-a-newcol');
    var name = el ? String(el.value).trim() : '';
    if (!name) { say('先填合集名', 'error'); return; }
    var dup = KB.collections.filter(function (c) { return c.name === name && visibleIn(c); })[0];
    if (dup) {
      /* 已存在就直接勾上，不再重复建 */
      var btn = document.querySelector('#kb-a-cols [data-pick="' + dup.id + '"]');
      if (btn) btn.classList.add('on');
      if (el) el.value = '';
      say('已有同名合集「' + name + '」，已为你选中', 'info');
      return;
    }
    var kindEl = $('kb-a-kind');
    var c = {
      id: nextClId(), name: name,
      track: KB._formTrack || '科普',
      desc: '', cover: '', tags: [],
      lib: '院内', org: ME.org, status: '停用',
      /* 合集也要记创建人：列表卡片要显示「谁建的」 */
      createdBy: ME.id, uploader: ME.name, uploaderOrg: ME.org,
      createdAt: today(), updatedAt: today(), members: []
    };
    KB.collections.push(c);
    log(ME.name, '表单内新建合集', c.id + ' ' + name);
    var box = $('kb-a-cols');
    if (box) {
      var empty = box.querySelector('.kb-pick-empty');
      if (empty) box.innerHTML = '';
      var btn2 = document.createElement('button');
      btn2.type = 'button';
      btn2.setAttribute('data-pick', c.id);
      btn2.className = 'on';
      btn2.innerHTML = esc(name) + '<span class="kb-pick-n">0</span>';
      box.appendChild(btn2);
    }
    if (el) el.value = '';
    say('已新建合集「' + name + '」并选中；保存内容后会入集', 'success');
  }

  /* ---------- 按形式决定要填什么 ----------
     各形式需要的字段不一样：视频要有片源和时长，图文要有正文，课件要有页数。
     表单据此显示/隐藏字段，并把必填项跟着调整——不能一张表问到底。 */
  var FORM_SPEC = {
    /* 两种「图文类」分开了：
       文章 = 单篇长文，正文是主体，用富文本编辑器写；
       图文 = 一段短正文 + 一组图（小红书 / 九图科普），图才是主体。 */
    '文章':     { body: true,  bodyReq: true,  file: '补充材料（可选）', duration: false, slides: false, rich: true,  tip: '正文是主体：支持加粗、小标题、列表，可直接粘贴 Word 内容' },
    '图文':     { body: true,  bodyReq: false, gallery: true, file: '',    duration: false, slides: false, tip: '一段正文 + 一组图：图是主体，最多 9 张，每张可配一句说明' },
    '视频':     { body: false, bodyReq: false, file: '视频文件',      duration: true,  slides: false, tip: '视频不需要正文；章节由正文小标题生成，没有就不显示章节' },
    '课件':     { body: false, bodyReq: false, file: '课件文件（PPT / PDF）', duration: false, slides: true, tip: '上传 PPT 或 PDF；页码取自文件，不需要手工填' },
    '操作手册': { body: true,  bodyReq: true,  file: '手册文件（PDF / Word）', duration: false, slides: false, tip: '正文写成带编号的步骤，详情页会渲染成可勾选清单' },
    '宣传折页': { body: true,  bodyReq: true,  file: '折页图片',      duration: false, slides: false, tip: '正文按句子分行，详情页会排成折页版面' }
  };
  /* 各内容形式可上传的物料 + 是否必须 */
  var FORM_UPLOAD = {
    /* name 是上传区标题（按形式各不相同），accept 决定能选什么，required 决定星号。
       图文没有这个区：图片走图集控件，留着只会多一个点了必报错的死控件。 */
    '文章':     { name: '补充材料', accept: '.jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx', tip: '图片或文档，可多份；不传也能保存', required: false },
    '图文':     { name: '图片', accept: '', tip: '', required: false, skip: true },
    '视频':     { name: '视频文件', accept: '.mp4,.mov,.avi,.webm,.mkv', tip: 'MP4 / MOV，可多选，一行一集', required: true },
    /* 课件常是两样东西一起给：PPT/PDF 本体 + 现场录制的讲课视频。
       所以放开成混合格式，并且 required 只要求「主文件」——具体是课件本体还是视频，见 collectForm 的 mainFileCheck。 */
    '课件':     { name: '课件文件', accept: '.pptx,.ppt,.pdf,.mp4,.mov,.avi,.webm,.mkv', tip: 'PPT / PDF 课件本体，可再加讲课视频（MP4 / MOV）；至少给一样', required: true, multi: true },
    '操作手册': { name: '手册文件', accept: '.pdf,.doc,.docx', tip: 'PDF / Word', required: true },
    '宣传折页': { name: '折页图片', accept: '.jpg,.jpeg,.png,.webp,.pdf', tip: '正反面可多张', required: true }
  };
  function formUpload(kind) { return FORM_UPLOAD[kind] || FORM_UPLOAD['文章']; }
  /* 课件的文件构成提示：本体（PPT/PDF）几个、视频几个、能不能播放。
     视频是「可选补充」——课件详情页会把它嵌在放映上方，没有就只放映课件。 */
  function deckMixHint(files) {
    files = files || [];
    var deck = 0, vid = 0, other = 0;
    files.forEach(function (f) {
      var n = f.name || '';
      if (/\.(pptx?|pdf)$/i.test(n)) deck++;
      else if (/\.(mp4|mov|avi|webm|mkv)$/i.test(n)) vid++;
      else other++;
    });
    var parts = [];
    parts.push('课件本体 ' + deck + ' 个');
    parts.push('讲课视频 ' + vid + ' 个');
    if (other) parts.push('其它 ' + other + ' 个');
    return parts.join(' · ') + (vid ? '（详情页会把视频放在放映上方，两个都能看）' : '（只放课件、不放视频也可以）');
  }
  function refreshDeckMixHint() {
    var el = $('kb-a-file-mix');
    if (el) el.textContent = deckMixHint(KB._files || []);
  }
  function formSpec(kind) { return FORM_SPEC[kind] || FORM_SPEC['文章']; }

  function assetForm(track, a) {
    var isTrain = track === '培训';
    var kind = a ? a.kind : (isTrain ? '操作手册' : '文章');
    /* 受众按内容线取两套之一。编辑老数据时，已选里若有旧术语（患者及家属 / 登记人员…），
       把它并进点选区并保持选中——否则打开表单一保存，旧值就被静默抹掉。 */
    var chosenAud = (a && a.audiences && a.audiences.length) ? a.audiences.slice() : (isTrain ? ['登记员 / 报告卡录入'] : ['患者本人', '家属 / 照护者']);
    var audOptions = audienceOptions(track);
    chosenAud.forEach(function (x) { if (audOptions.indexOf(x) < 0) audOptions.push(x); });
    var spec = formSpec(kind);
    /* 转载件：正文只读、来源区只读、物料不是必填、不进合集。病种/场景/标签仍可改——那是本院按自己的
       用法归类，不算改原文。正文只读是「原文一字不改」的物理保证。 */
    var isRp = isReprint(a);
    /* 待补录 = 转载件还没有原文快照。正文可选，所以这里不是错误态，
       只是「正文框开放可编辑，保存即锁定并生成快照」 */
    var rpNoSnap = isRp && !(a.snapshot && a.snapshot.hash);
    var rpSource = isRp ? '<div class="full"><label>来源（转载）</label><div class="rp-src">' +
      '<div class="rp-src-row"><b>发布平台</b><span>' + esc((a.source || {}).platform || '') + '</span></div>' +
      '<div class="rp-src-row"><b>原标题</b><span>' + esc((a.source || {}).title || '') + '</span></div>' +
      ((a.source || {}).publishedAt
        ? '<div class="rp-src-row"><b>发布时间</b><span>' + esc(a.source.publishedAt) + '</span></div>'
        /* 兜底件/授权件解析不出日期：门禁要求日期齐全，这里不给补录框就死锁。日期是元数据，可以人工补 */
        : '<div class="rp-src-row"><b>发布时间</b><span><input id="kb-rp-date" placeholder="原文发布日期，如 2026-09-12" style="height:28px;width:210px;border:1px solid #d1d8e0;border-radius:5px;padding:0 8px;font-size:12.5px"></span></div>') +
      '<div class="rp-src-row"><b>原文作者</b><span>' + esc((a.source || {}).author || '—') + '</span></div>' +
      '<div class="rp-src-row"><b>原文链接</b><span>' + esc((a.source || {}).url || '—') + '</span></div>' +
      '<div class="rp-src-row"><b>原文快照</b><span>' + (a.snapshot && a.snapshot.hash ? '已留存（' + esc(a.snapshot.hash) + '）' : '未留存（正文未核验，不影响上架）') + '</span></div>' +
      '</div><div class="hint">来源信息由转载通道写入，不可在此修改；原文如有更新，请重新转载。</div></div>' : '';
    /* 物料上传放在摘要之前：先传东西，再写说明，符合“先有内容再描述”的顺序。
       标签按形式取名字与必填状态：文章是可选「补充材料」，视频是必传「视频文件」……
       一刀切写「上传物料」会让人不知道要传什么，可选项还被顶上一个星号。 */
    var upSpec = formUpload(kind);
    var upLabel = isRp ? '补传原文文件（可选）'
      : (upSpec.required ? R(upSpec.name) : upSpec.name + '<span class="hint-inline">（可选）</span>');
    var uploadBlock = (upSpec.skip && !isRp) ? '' : '<div class="full">' +
      '<label id="kb-a-file-label">' + upLabel + '</label>' +
      '<div class="kb-up" id="kb-a-upload">' +
      '<div class="kb-up-drop" id="kb-a-drop">' +
      '<span class="kb-up-icon">⬆</span>' +
      '<span class="kb-up-text">点击选择文件，或拖拽到此处</span>' +
      '<span class="kb-up-tip" id="kb-a-upload-tip">' + esc(formUpload(kind).tip) + '</span>' +
      '<input type="file" id="kb-a-file-input" accept="' + formUpload(kind).accept + '" multiple style="display:none">' +
      '</div>' +
      '<div class="kb-up-list" id="kb-a-file-list">' + (a && a.attachments && a.attachments.length
        ? a.attachments.map(function (f, i) { return fileChip(f, i); }).join('') : '') + '</div>' +
      /* 课件允许「课件本体 + 讲课视频」一起传，这里把两类文件各传了几个说清楚，
         否则有人只看到一串文件名，不知道详情页会怎么呈现 */
      (kind === '课件' ? '<div class="hint" id="kb-a-file-mix">' + deckMixHint(a ? a.attachments : []) + '</div>' : '') +
      (isRp ? '<div class="hint">转载件没有原文件不影响上架，详情页会给出「查看原文」入口。</div>' : '') +
      '</div></div>';

    return '<div class="kb-form">' +
      /* 标题、形式整行：这两个决定后面显示哪些字段（形式一变，上传区和正文区都跟着换），
         放在半列里会让右侧空出一大块，也让读者误以为还有别的字段没显示。 */
      '<div class="full">' + fld(R('标题'), inp('kb-a-title', a ? a.title : '', isTrain ? '例如：报告卡填报规范（本院补充）' : '例如：复查为什么要空腹？'), true) + '</div>' +
      '<div class="full">' + fld(R('形式'), '<span id="kb-a-kind-wrap">' + sel1('kb-a-kind', dictNames('kinds'), kind) + '</span><div class="hint" id="kb-a-kind-tip">' + esc(spec.tip) + '</div>') + '</div>' +
      '<div class="full">' + fld(R('病种'), pickBox('kb-a-sites', dictNames('sites'), a ? a.sites : ['通用']) + '<div class="hint">点选，可多选；决定按病种检索能否命中</div>', true) + '</div>' +
      /* 使用场景：转载表单与新增表单都有这一项（2026-10-23 起两条录入通道对齐），
         编辑表单也不再对转载件藏起来——藏了就没法补填，也改不动。
         早于对齐入库的历史转载件场景可能为空，这里给空选择即可，不用默认值糊上去。 */
      '<div class="full">' + fld(R('使用场景'), pickBox('kb-a-scenes', dictNames('scenes'), a ? a.scenes : (isTrain ? ['上岗培训'] : ['随访宣教'])) + '<div class="hint">点选，可多选；与内容库筛选同口径</div>', true) + '</div>' +
      fld('受众', pickBox('kb-a-aud', audOptions, chosenAud) +
        '<div class="hint">' + (isTrain
          ? '培训面向做登记工作的人：按岗位选，可多选'
          : '科普面向患者与家属：按人群选，可多选；拿不准就选「普通人群」') + '</div>') +
      fld('标签', tagField(a ? a.tags : [])) +
      (isRp ? '<div class="full"><label>归属合集</label><div class="hint">转载内容为单篇，不进入合集；需要成套时请整组转载。</div></div>' : fld('归属合集（可选）', collectPicker(a), true)) +
      uploadBlock +
      fld('摘要', ta('kb-a-summary', a ? a.summary : '', '列表里显示的一句话，写清这篇解决什么问题；不填则取正文首句', 2)) +
      (spec.gallery ? galleryBlock(a) : '') +
      /* 转载待补录态无视形式都要显示正文框：视频/课件类形式平时没有正文（章节刻度可选），
         但不给正文框，「补原文快照」就没有入口，等于把这类待补件锁死（审计实测踩到） */
      '<div class="full" id="kb-a-body-wrap"' + (spec.body || rpNoSnap ? '' : ' style="display:none"') + (rpNoSnap ? ' data-rp-fill="1"' : '') + '>' +
      (isRp && !rpNoSnap
        ? '<label>正文（原文快照，只读）</label><textarea id="kb-a-body" readonly rows="8" style="background:#f8fafc;color:#475569">' + esc(String(a.body).replace(/<brs*\/?>/g, '\n')) + '</textarea>' +
          '<div class="hint">转载正文不可修改。需要补充说明请填「编者按」。</div>'
        : rpNoSnap
          /* 没有快照：正文框开放，想补就补（一保存即锁定），不补也能上架。
             转载补录保留文本框：原文要「一字不改」地贴进来，富文本编辑器反而会带入自己的样式。 */
          ? fld('正文（可选 · 补录原文）', ta('kb-a-body', String(a.body).replace(/<brs*\/?>/g, '\n'), '把官方原文粘贴进来（支持简单 HTML 或纯文本）。保存后正文生成原文快照并锁定，之后不可修改。', 8)) +
            '<div class="hint">这条还没有原文快照：留空不影响上架；填了就锁定为「一字不改」的留痕。</div>'
          : spec.rich
            /* 自有内容的正文：富文本编辑器。直接从 Word / 网页粘贴，浏览器会把加粗、标题、
               列表降级成干净 HTML，不用手写标签。 */
            ? fld('正文' + (spec.bodyReq ? '<span class="req">*</span>' : ''),
              richBox('kb-a-body', a ? String(a.body || '') : '') +
              '<div class="hint">支持加粗、小标题、列表、插入图片；可直接从 Word 或网页粘贴。</div>', spec.bodyReq)
            : fld('正文' + (spec.bodyReq ? '<span class="req">*</span>' : ''), ta('kb-a-body', a ? String(a.body).replace(/<brs*\/?>/g, '\n') : '', '支持简单 HTML（<p>/<h3>/<ul>），留空则直接编辑纯文本', 8), spec.bodyReq)) +
      '</div>' +
      (isRp ? fld('编者按', ta('kb-a-note', a.editorNote || '', '限 300 字。会显示在正文上方，用于说明本院为什么要转这篇、对患者有什么补充提醒', 2) + '<div class="hint">只写补充说明，不要把原文内容改写到编者按里。</div>', true) : '') +
      /* 「依据出处」一栏已移除（转载件的只读展示也一并去掉，来源信息已在下方的来源块里）。 */
      rpSource +
      '<div class="full hint">' + (isRp
        ? '转载件上架门禁：<b>原文链接 + 发布日期</b>齐备；非白名单来源另需<b>授权说明</b>（本次修改不会触碰原文快照）。'
        : '保存后为<b>下架</b>状态，确认无误后点「上架」。') + '</div>' +
      '</div>';
  }

  /* ---------- 表单里的物料上传 ----------
     表单持有 KB._files（待保存的物料数组），渲染成 chip 列表；
     选文件 / 拖拽都走 addFormFiles，移除走 removeFormFile。 */
  function fmtBytes(b) {
    if (!b && b !== 0) return '—';
    if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b > 1024) return (b / 1024).toFixed(0) + ' KB';
    return b + ' B';
  }
  function fileChip(f, i) {
    var ext = String(f.name).split('.').pop().toUpperCase();
    return '<span class="kb-up-chip"><i>' + esc(ext) + '</i>' +
      '<span class="kb-up-name" title="' + esc(f.name) + '">' + esc(f.name) + '</span>' +
      '<span class="kb-up-size">' + esc(f.size || '—') + '</span>' +
      '<button type="button" data-kb="rmFile" data-arg="' + i + '" title="移除">✕</button></span>';
  }
  function renderFormFiles() {
    var box = $('kb-a-file-list');
    if (!box) return;
    var files = KB._files || [];
    box.innerHTML = files.map(fileChip).join('');
  }
  function addFormFiles(list) {
    var kindEl = $('kb-a-kind');
    var kind = kindEl ? kindEl.value : '文章';
    var accept = formUpload(kind).accept.split(',');
    KB._files = KB._files || [];
    var added = 0, rejected = [];
    Array.prototype.forEach.call(list || [], function (f) {
      if (!f) return;
      var ok = accept.some(function (ext) { return f.name.toLowerCase().endsWith(ext.trim().toLowerCase()); });
      if (!ok) { rejected.push(f.name); return; }
      if (KB._files.some(function (x) { return x.name === f.name; })) return;
      KB._files.push({ name: f.name, size: fmtBytes(f.size), sizeBytes: f.size });
      added++;
    });
    if (rejected.length) say('格式不支持，已跳过：' + rejected.join('、'), 'error');
    if (added) say('已添加 ' + added + ' 个文件', 'success');
    renderFormFiles();
    refreshDeckMixHint();
    var box = $('kb-a-file-list');
    if (box && added) setTimeout(function () { try { box.scrollIntoView({ block: 'nearest' }); } catch (e) { } }, 60);
  }
  function removeFormFile(i) {
    if (!KB._files) return;
    KB._files.splice(parseInt(i, 10), 1);
    renderFormFiles();
    refreshDeckMixHint();
  }
  /* 绑定上传区：点击选文件、拖拽、移除 */
  function bindFormUpload() {
    var drop = $('kb-a-drop'), input = $('kb-a-file-input');
    if (!drop || !input) return;
    drop.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { addFormFiles(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('on'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('on'); });
    });
    drop.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) addFormFiles(e.dataTransfer.files);
    });
  }

  /* 切换形式时，按该形式的规格显隐正文、更新提示与附件说明 */
  function syncFormByKind() {
    var kindEl = document.getElementById('kb-a-kind');
    if (!kindEl) return;
    var spec = formSpec(kindEl.value);
    var wrap = document.getElementById('kb-a-body-wrap');
    var tip = document.getElementById('kb-a-kind-tip');
    var ftip = document.getElementById('kb-a-file-tip');
    /* 转载待补录的正文框不参与"按形式显隐"：切到视频类也别藏（它是补快照的唯一入口） */
    if (wrap) wrap.style.display = (spec.body || wrap.getAttribute('data-rp-fill')) ? '' : 'none';
    syncBodyControl(spec);
    /* 形式换到/离开「图文」时，图片区要跟着出现或消失 */
    var galEl = $('kb-a-gallery');
    if (spec.gallery && !galEl) {
      var host = document.getElementById('kb-a-summary') ? document.getElementById('kb-a-summary').closest('.kb-form') : null;
      if (host) {
        var d = document.createElement('div');
        d.innerHTML = galleryBlock(null);
        var anchor2 = wrap && wrap.parentNode;
        if (anchor2) anchor2.insertBefore(d.firstElementChild, wrap.nextSibling);
        bindGallery();
      }
    } else if (!spec.gallery && galEl) {
      galEl.remove();
    }
    if (tip) tip.textContent = spec.tip;
    if (ftip) ftip.textContent = spec.file;
    /* 上传控件按形式换 accept / 说明 / 标题，并在不需要它时整块隐藏 */
    var up = formUpload(kindEl.value);
    var upBox = document.getElementById('kb-a-upload');
    var upFull = upBox ? upBox.closest('.full') : null;
    if (upFull) upFull.style.display = up.skip ? 'none' : '';
    var lbl = document.getElementById('kb-a-file-label');
    if (lbl && !lbl.closest('.rp-src')) {
      lbl.innerHTML = up.required ? R(up.name) : up.name + '<span class="hint-inline">（可选）</span>';
    }
    var input = document.getElementById('kb-a-file-input');
    var utip = document.getElementById('kb-a-upload-tip');
    if (input) input.setAttribute('accept', up.accept);
    if (utip) utip.textContent = up.tip;
    /* 切到课件时，文件构成提示要跟着出现：表单初次渲染若是别的形式，这段提示根本没生成，
       只切显隐是不够的，得补一个节点进去；切走后隐藏即可（保留节点，切回来还在）。 */
    var mix = document.getElementById('kb-a-file-mix');
    var listBox = document.getElementById('kb-a-file-list');
    if (kindEl.value === '课件' && !mix && listBox && listBox.parentNode) {
      mix = document.createElement('div');
      mix.className = 'hint';
      mix.id = 'kb-a-file-mix';
      listBox.parentNode.insertBefore(mix, listBox.nextSibling);
    }
    if (mix) mix.style.display = (kindEl.value === '课件') ? '' : 'none';
    refreshDeckMixHint();
  }

  /* 正文控件随形式切换：文章用富文本区，其余用文本框。
     切换时把旧内容搬过去，不能让人白填一遍。 */
  /* HTML 还原成纯文本：<p>/<h3>/<li> 都是块级，各占一行；
     直接 strip 标签会把「标题正文列表」粘成一整句。 */
  function htmlToPlain(html) {
    return String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h[1-6]|li|div|blockquote)>/gi, '\n')
      .replace(/<\/ul>|<\/ol>/gi, '\n')
      .replace(/<li[^>]*>/gi, '· ')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '');
  }
  function syncBodyControl(spec) {
    var wrap = $('kb-a-body-wrap');
    if (!wrap) return;
    var area = $('kb-a-body');
    if (!area) return;
    var wantRich = !!spec.rich;
    var isRich = area.tagName === 'DIV';
    if (wantRich === isRich) return;
    /* 富文本区外面还包着一层 .kb-rte（工具条），换控件时要连它一起换掉，
       否则工具条会留在页面上，正文却是文本框，两样东西对不上。 */
    var old = isRich ? area.closest('.kb-rte') || area : area;
    /* 旧内容先取出来（富文本区是 innerHTML，文本框是 value） */
    var text = isRich ? area.innerHTML : String(area.value || '').replace(/\n/g, '<br>');
    var holder = document.createElement('div');
    holder.innerHTML = wantRich
      ? richBox('kb-a-body', text)
      : '<textarea id="kb-a-body" rows="8">' + esc(htmlToPlain(text)) + '</textarea>';
    var next = holder.firstElementChild;
    old.parentNode.replaceChild(next, old);
    /* 提示文字跟着控件走 */
    var hint = next.parentNode && next.parentNode.querySelector('.hint');
    if (!hint && next.nextElementSibling && next.nextElementSibling.classList.contains('hint')) hint = next.nextElementSibling;
    if (hint) {
      hint.textContent = wantRich
        ? '支持加粗、小标题、列表、插入图片；可直接从 Word 或网页粘贴。'
        : '一段简短说明，图才是主体；每张图的说明在下面填。';
    }
    if (wantRich) bindRte();
  }
  /* 勾选里的合集编号。新建时还没有内容编号，先记在 KB._pendingCols 里，保存拿到 id 后再入集 */
  function pickedCollections() {
    var out = [];
    var box = $('kb-a-cols');
    if (box) box.querySelectorAll('[data-pick].on').forEach(function (b) { out.push(b.getAttribute('data-pick')); });
    return out;
  }
  /* 把内容放进/移出合集，并保持原有顺序（移出再放回不该打乱排序） */
  function syncMembership(assetId, keepIds) {
    KB.collections.forEach(function (c) {
      var has = c.members.indexOf(assetId) >= 0;
      var want = keepIds.indexOf(c.id) >= 0;
      if (want && !has) { c.members.push(assetId); c.updatedAt = today(); }
      else if (!want && has) { c.members.splice(c.members.indexOf(assetId), 1); c.updatedAt = today(); }
    });
  }
  /* 正文取值：富文本区是 contenteditable 的 div，没有 .value，要读 innerHTML */
  function bodyHtmlOf() {
    var el = $('kb-a-body');
    if (!el) return '';
    if (el.tagName === 'TEXTAREA') return String(el.value || '').trim();
    return String(el.innerHTML || '').trim();
  }
  /* 富文本区「看着是空的」判定：只剩空段落 / <br> 时要当作没填，
     否则必填校验会被一片 <p><br></p> 骗过去。 */
  function isBlankHtml(html) {
    if (!html) return true;
    var t = String(html).replace(/<br\s*\/?>/gi, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    return !t && !/<img/i.test(html);
  }
  function collectForm(exist) {
    var t = val('kb-a-title'), s = val('kb-a-summary'), b = bodyHtmlOf();
    var kindNow = val('kb-a-kind'), specNow = formSpec(kindNow);
    var files = (KB._files || []).slice();
    var gallery = specNow.gallery ? (KB._gallery || []).slice() : [];
    /* 表单里的正文是把 <br> 换行还原成 \n 的文本，比对前先还原成同一种写法 */
    var originBody = exist ? String(exist.body || '').replace(/<br\s*\/?>/g, '\n') : '';
    if (!t) { say('标题为必填', 'error'); return null; }
    if (!s) s = autoSummary(b);   /* 摘要留空时取正文首句，列表里不至于显示空白 */
    if (specNow.bodyReq && isBlankHtml(b)) { say(kindNow + '需要填写正文', 'error'); return null; }
    /* 图文：图是主体，一张都没有就不成其为图文 */
    if (specNow.gallery && !gallery.length) { say('图文形式至少要加 1 张图片', 'error'); return null; }
    /* 转载件没有原文件是常态（官方视频往往只抓得到播放页），只提醒不拦 */
    var upNow = formUpload(kindNow);
    /* 课件是「课件本体 / 讲课视频」二选一必填（也可以两样都给）：
       只放个视频或只放个 PPT 都算有主体；一个都没有才拦。 */
    var hasMainFile = files.length > 0;
    if (kindNow === '课件') {
      hasMainFile = files.some(function (f) { return /\.(pptx?|pdf|mp4|mov|avi|webm|mkv)$/i.test(f.name); });
    }
    if (upNow.required && !hasMainFile && !isReprint(exist)) {
      say(kindNow === '课件'
        ? '课件至少要上传一样主文件：PPT / PDF 本体，或讲课视频'
        : kindNow + '需要上传' + upNow.name + '（' + upNow.tip + '）', 'error');
      return null;
    }
    if (formUpload(kindNow).required && !files.length && isReprint(exist)) say('转载件未附原文件：详情页将提供「查看原文」入口', 'info');
    var sites = picked('kb-a-sites'), scenes = picked('kb-a-scenes');
    if (!sites.length) { say('请至少选择 1 个病种，否则按病种检索永远搜不到', 'error'); return null; }
    /* 使用场景：原创件必填（校验拦）。转载件不强制——转载件的正文与归类由原文决定，
       提前入库补归类很常见，强制会把它卡在保存这一步；但字段本身两侧都有，
       填了就按填的存（2026-10-23 起转载表单也采集）。 */
    if (!scenes.length && !isReprint(exist)) { say('请至少选择 1 个使用场景', 'error'); return null; }
    /* 手写分页（seed 里的 slides）只在形式与正文都没动时保留，否则详情页回到按正文自动切页 */
    var slides = exist && exist.slides && val('kb-a-kind') === '课件' && b === originBody ? exist.slides : undefined;
    /* 富文本区给的就是 HTML，直接存；纯文本框仍按旧规则包段落 */
    var bodyEl = $('kb-a-body');
    var isRich = !!(bodyEl && bodyEl.tagName !== 'TEXTAREA');
    var bodyOut = isBlankHtml(b) ? '' : (isRich || /<[a-z][a-z]*>/i.test(b)
      ? b
      : '<p>' + b.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>');
    return {
      track: exist ? exist.track : (KB._formTrack || '科普'), kind: val('kb-a-kind'), title: t, summary: s,
      body: bodyOut,
      gallery: gallery,
      sites: sites, scenes: scenes, audiences: picked('kb-a-aud'),
      tags: picked('kb-a-tags'),
      /* 表单已不再采集依据出处：编辑时保留原值，新增时为空。不要写 undefined，
         否则 saveEdit 的字段覆盖会把历史出处一并清掉。 */
      evidence: (exist && exist.evidence) || '',
      attachments: files,
      slides: slides,
      editorNote: isReprint(exist) ? String(val('kb-a-note') || '').trim().slice(0, 300) : undefined,
      /* 合集归属单独取：它不写进内容本身，而是改合集的 members；转载件不进合集 */
      collections: isReprint(exist) ? [] : pickedCollections()
    };
  }
  function newAsset(track) {
    KB._editing = null;
    KB._formTrack = track || '科普';
    KB._files = [];
    modal('新增' + track + '内容', '保存后为下架状态，确认无误再上架', assetForm(track, null),
      '<button class="btn btn-outline btn-sm" data-kb="close">取消</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="saveNew">保存</button>');
    bindFormKind();
  }
  /* 形式下拉一变，正文/附件说明跟着变（视频不需要正文） */
  function bindFormKind() {
    bindFormUpload();
    bindTagEnter();
    bindRte();
    bindGallery();
    var el = document.getElementById('kb-a-kind');
    if (!el) return;
    el.addEventListener('change', syncFormByKind);
  }
  /* 自定义标签输入框：回车即加入，不用去点按钮 */
  function bindTagEnter() {
    var el = document.getElementById('kb-a-tags-new');
    if (!el) return;
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); formAddTag(); }
    });
  }
  function saveNewAsset() {
    var d = collectForm(null); if (!d) return;
    KB._files = [];
    KB._gallery = [];
    var id = nextKbHId();
    KB.assets.push({
      id: id, track: d.track, kind: d.kind, title: d.title, summary: d.summary, body: d.body,
      sites: d.sites, scenes: d.scenes, tags: d.tags, audiences: d.audiences,
      lib: '院内', org: ME.org,
      /* 上传人是「我的上传」的唯一判据：没有这个字段就只能算到机构，算不到人。
         uploader / uploaderOrg 存姓名与机构名快照，供账号被删后仍能显示归属。 */
      createdBy: ME.id, uploader: ME.name, uploaderOrg: ME.org, createdAt: nowStr(),
      status: '停用', publishedAt: '',
      evidence: d.evidence, attachments: d.attachments, slides: d.slides,
      /* 图集是内容主体的一部分（图片已存 dataURL），不是附件 */
      gallery: (d.gallery && d.gallery.length) ? d.gallery : undefined,
      note: '本院新建'
    });
    syncMembership(id, d.collections);
    log(ME.name, '新建内容', id);
    pushEvent('上传', id, { op: '新建' });
    closeModal(); syncHomeNews();
    /* 状态筛选默认就是「全部状态」，新建的停用内容直接可见，不用再动筛选 */
    say('已保存 ' + id + '（下架状态，可继续编辑后上架）', 'success');
    /* 刚建完就让人看一眼详情页：填的形式决定详情页长什么样，这里能立刻核对 */
    openDetail(id);
  }
  function editAsset(id) {
    var a = find(KB.assets, id); if (!a) return;
    if (a.lib === '省库') { say('省库内容只读；需要本院口径请在页头新建院内内容', 'error'); return; }
    KB._editing = id;
    KB._formTrack = a.track;
    KB._files = (a.attachments || []).slice();
    /* 图集是内容的一部分（图片已转 dataURL 存在 a.gallery），编辑时先拷进暂存，
       控件改动的是暂存，保存时整体回写 */
    KB._gallery = (a.gallery || []).map(function (g) { return { src: g.src, caption: g.caption || '', name: g.name || '' }; });
    modal('编辑' + a.track + '内容 · ' + a.id, a.status === '启用' ? '该内容处于上架中，修改即时生效' : '下架状态', assetForm(a.track, a),
      '<button class="btn btn-outline btn-sm" data-kb="close">取消</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="saveEdit">保存</button>');
    bindFormKind();
  }
  function saveEditAsset() {
    var a = find(KB.assets, KB._editing); if (!a) return;
    var d = collectForm(a); if (!d) return;
    KB._files = [];
    if (isReprint(a)) {
      if (a.snapshot && a.snapshot.hash) {
        /* 已有快照：正文不可变。保存前重算 hash 与入库快照比对，不一致即拒绝——
           防的是 devtools 改 DOM 绕过 readonly。 */
        if (hashOf(d.body) !== a.snapshot.hash) { say('原文快照被改动，转载件正文不可修改', 'error'); return; }
        if (!syncRpDate(a)) return;
        a.editorNote = d.editorNote || '';
        ['title', 'summary', 'sites', 'scenes', 'tags', 'audiences', 'kind'].forEach(function (k) { a[k] = d[k]; });
        a.attachments = d.attachments;
        a.note = nowStr() + ' 由 ' + ME.name + ' 编辑归类（正文未改）';
        reprintLog(a.id, '编辑归类', {});
        log(ME.name, '编辑转载归类', a.id);
        closeModal(); syncHomeNews();
        say('已保存（正文与来源不变）', 'success');
        refreshKeepDetail();
        return;
      }
      /* 无快照：正文可留空。留空就是「只存链接与元信息」，照样保存、照样能上架；
         填了才生成快照并锁定。以前这里强制 ≥30 字，等于把正文变成上架前的必填项。 */
      if (!syncRpDate(a)) return;
      var rpPlain = stripHtmlToText(d.body);
      a.editorNote = d.editorNote || '';
      ['title', 'summary', 'sites', 'scenes', 'tags', 'audiences', 'kind'].forEach(function (k) { a[k] = d[k]; });
      a.attachments = d.attachments;
      if (rpPlain.length < 30) {
        /* 没填（或填得太短，不足以构成快照）：只更新元信息 */
        a.note = nowStr() + ' 由 ' + ME.name + ' 编辑归类（无正文快照）';
        reprintLog(a.id, '编辑归类', {});
        log(ME.name, '编辑转载归类', a.id);
        closeModal(); syncHomeNews();
        say('已保存（未填正文，仍未存快照）', 'success');
        refreshKeepDetail();
        return;
      }
      a.body = d.body;
      a.snapshot = { hash: hashOf(d.body), plain: rpPlain, blocks: null, fetchedAt: nowStr() };
      a.summary = d.summary || a.summary;
      a.note = nowStr() + ' 由 ' + ME.name + ' 补录原文快照';
      reprintLog(a.id, '补录正文', { chars: rpPlain.length });
      log(ME.name, '转载补录正文', a.id);
      closeModal(); syncHomeNews();
      say('已保存：原文快照生成并锁定', 'success');
      refreshKeepDetail();
      return;
    }
    ['track', 'kind', 'title', 'summary', 'body', 'sites', 'scenes', 'tags', 'audiences', 'evidence', 'attachments'].forEach(function (k) { a[k] = d[k]; });
    if (d.gallery && d.gallery.length) a.gallery = d.gallery; else delete a.gallery;
    a.slides = d.slides;   /* 正文没动就保留手写分页；动了就退回自动切页 */
    syncMembership(a.id, d.collections);   /* 合集归属落在合集这一侧，内容本身不存 */
    a.note = nowStr() + ' 由 ' + ME.name + ' 更新';
    log(ME.name, '更新内容', a.id);
    closeModal(); syncHomeNews();
    say('已保存', 'success');
    refreshKeepDetail();
  }

  /* 养 —— 上架 / 下架（对外叫「上架」，内部仍是 status 的两态：启用=上架，停用=下架）
     「依据出处」门禁已撤：原创件不再卡出处即可上架；转载件仍要过来源门禁
     （原文链接 + 发布日期 + 非白名单需授权说明）。批量与单条走同一套判定。 */
  var SHELF_ON = '启用', SHELF_OFF = '停用';
  function isOnShelf(a) { return a.status === SHELF_ON; }
  /* 转载件的上下架权限：系统管理员（role=admin）全省可管，其余账号只管本机构转的。
     转载件本身全省可见（visibleIn 已放宽），但「能看」不等于「能下架别人的」——
     下级登记处转的稿被省里统一回收是合理的，反过来不行。 */
  function canShelf(a) {
    if (!a) return false;
    if (isReprint(a)) return ME.role === 'admin' || a.org === ME.org;
    return a.lib === '院内' && a.org === ME.org;
  }
  /* 上架门禁：返回 null 表示可以上架，否则返回拦住的原因 */
  function shelfBlocker(a) {
    if (!a) return '内容不存在';
    /* 转载专有条：三处调用（详情页 / 批量 / 列表）同一个函数，不会出现「这里上不去那里上得去」 */
    if (isReprint(a)) {
      var s = a.source || {};
      if (!s.url || !s.publishedAt) return '转载缺原文链接或发布日期';
      if (s.basis !== 'official' && !a.attest) return '非白名单来源，缺授权声明';
      /* 正文是可选项，快照不再是上架前提：没快照的件照样能上架，
         只在详情页标「未存快照」提示「正文未经核验」。
         但一旦存了快照，就用它反查正文有没有被改过——快照是防篡改的证据，不是入场券。 */
      if (a.snapshot && a.snapshot.hash) {
        /* 只有"正文即内容"的形式才按 120 字判过短（防止抓到列表页）；
           视频/课件的正文只是章节刻度，短不是问题 */
        if (['文章', '操作手册', '宣传折页'].indexOf(a.kind) >= 0 && (!a.snapshot.plain || a.snapshot.plain.length < 120)) return '原文正文过短（可能是列表页）';
      }
    }
    return null;
  }
  /* 真正落地：不弹框、不提示，供批量复用。返回 {ok:[], blocked:[{a,why}]} */
  function applyShelf(ids, on) {
    var ok = [], blocked = [];
    ids.forEach(function (id) {
      var a = find(KB.assets, id);
      if (!a) return;
      if (on) {
        var why = shelfBlocker(a);
        if (why) { blocked.push({ a: a, why: why }); return; }
        if (a.status !== SHELF_ON) {
          a.status = SHELF_ON;
          if (!a.publishedAt) a.publishedAt = today();
          /* 发布人 / 发布单位随「上架」这一刻落定：
             转载件在入库时已按转载账号记过，重新上架不覆盖（发布单位仍是转载方机构，不随操作者漂移）；
             原创件的发布者就是这次上架操作的人及其机构。 */
          if (isReprint(a)) {
            if (!a.publisher) a.publisher = ME.name;
            if (!a.publisherOrg) a.publisherOrg = ME.org;
          } else {
            a.publisher = ME.name;
            a.publisherOrg = ME.org;
            a.publishedBy = ME.id;
          }
          log(ME.name, '上架内容', a.id);
          ok.push(a);
        }
      } else {
        if (a.status !== SHELF_OFF) {
          a.status = SHELF_OFF;
          log(ME.name, '下架内容', a.id);
          ok.push(a);
        }
      }
    });
    if (ok.length) syncHomeNews();
    return { ok: ok, blocked: blocked };
  }
  /* 单条：带确认框的入口，列表 / 详情页都走它 */
  function setAssetStatus(id) {
    var a = find(KB.assets, id); if (!a) return;
    if (!canShelf(a)) {
      say(isReprint(a)
        ? '只有系统管理员或转载方本机构能上下架这条转载件'
        : '只能上下架本机构的内容', 'error');
      return;
    }
    if (isOnShelf(a)) {
      /* 转载件被省管理员下架时，说清这是全省共享的内容：下架对所有人都生效 */
      var isShared = isReprint(a) && a.org !== ME.org;
      confirmBox('下架确认', '下架后《' + esc(a.title) + '》不再出现在库内取用列表，已按它做过的宣教不受影响。' +
        (isShared ? '<div style="margin-top:8px;color:#a1541a">这条由「' + esc(a.org) + '」转载，转载件全省共享，下架对所有机构同时生效。</div>' : ''),
        function () {
          applyShelf([id], false);
          closeModal(); say('已下架', 'success'); refreshKeepDetail();
        });
      return;
    }
    /* 上架：只有转载件的来源门禁会拦（原创件已无出处要求） */
    var why = shelfBlocker(a);
    if (why) {
      var rpNext = '请核对来源与原文链接（来源栏在「编辑归类」底部只读展示）。';
      say('上架被拦下：' + why + '。' + rpNext, 'error');
      refreshKeepDetail(); return;
    }
    applyShelf([id], true);
    say('已上架：' + a.title, 'success');
    refreshKeepDetail();
  }
  function delAsset(id) {
    var a = find(KB.assets, id); if (!a) return;
    var inCols = collectionsOf(id).map(function (c) { return '「' + c.name + '」'; });
    confirmBox('删除确认', '确认删除 <b>' + esc(a.title) + '</b>？删除后不可恢复。' +
      (inCols.length ? '<div style="margin-top:8px;color:#a1541a">它同时在 ' + inCols.join('、') + ' 合集里，删除后会从这些合集中移除。</div>' : ''),
      function () {
        for (var i = 0; i < KB.assets.length; i++) { if (KB.assets[i].id === id) { KB.assets.splice(i, 1); break; } }
        /* 内容没了，合集里的引用要一起清掉，否则合集条会留一个打不开的空位 */
        KB.collections.forEach(function (c) {
          var k = c.members.indexOf(id);
          if (k >= 0) { c.members.splice(k, 1); c.updatedAt = today(); }
        });
        log(ME.name, '删除内容', id);
        closeModal(); syncHomeNews(); say('已删除', 'success');
        /* 在详情页里删掉的，留在这个页面就是一条空壳，回列表 */
        if (KB.detail === id) { backFromDetail(); return; }
        refresh();
      });
  }

  /* 读回分类维护页的筛选条（字典类型 / 检索词） */
  function readDictBar() {
    var st = KB.dictState || (KB.dictState = { type: 'sites', kw: '' });
    var t = document.querySelector('[data-kbd="type"]'), k = document.querySelector('[data-kbd="kw"]');
    if (t) st.type = t.value;
    if (k) st.kw = k.value;
  }

  /* ================= 首页资讯栏同源 ================= */
  function md(d) { var m = String(d || '').match(/(\d{2})-(\d{2})/); return m ? m[1] + '-' + m[2] : String(d || '').slice(5); }
  function homePick(rule) {
    return KB.assets
      .filter(function (a) {
        if (a.status !== '启用' || a.track !== '培训') return false;
        /* 首页资讯只放本院原创培训：转载稿不占首屏 */
        if (isReprint(a)) return false;
        if (rule.kind && a.kind !== rule.kind) return false;
        if (rule.kinds && rule.kinds.indexOf(a.kind) < 0) return false;
        if (rule.scene && (a.scenes || []).indexOf(rule.scene) < 0) return false;
        return true;
      })
      .sort(function (x, y) { return String(y.publishedAt).localeCompare(String(x.publishedAt)); })
      .slice(0, rule.limit);
  }
  var HOME_RULES = {
    common: { kind: '文章', limit: 6 },
    train: { kinds: ['视频', '课件'], limit: 4 },
    tech: { kinds: ['操作手册'], limit: 4 }
  };
  function syncHomeNews() {
    var data;
    try { data = (typeof wbNewsData !== 'undefined') ? wbNewsData : null; } catch (e) { data = null; }
    if (!data) return;
    var common = homePick(HOME_RULES.common).map(function (a) {
      return { title: a.title, meta: md(a.publishedAt), go: 'kb-detail|' + a.id, content: a.body };
    });
    var toRow = function (a) { return { title: a.title, meta: md(a.publishedAt), go: 'kb-detail|' + a.id }; };
    if (common.length) data.common = common;
    data.train = homePick(HOME_RULES.train).map(toRow);
    data.tech = homePick(HOME_RULES.tech).map(toRow);
  }

  /* 全局快捷键：任何页面 Ctrl/⌘ + Shift + V → 打开转载弹窗并尝试读剪贴板 */
  document.addEventListener('keydown', function (ev) {
    if (!(ev.ctrlKey || ev.metaKey) || !ev.shiftKey || (ev.key !== 'V' && ev.key !== 'v')) return;
    ev.preventDefault();
    if (KB.rp) return;
    openReprint({ track: KB.page === 'kb-train' ? '培训' : '科普' });
    setTimeout(function () {
      var txt = '';
      try { txt = navigator.clipboard.readText(); } catch (e) { txt = null; }
      if (txt && typeof txt.then === 'function') {
        txt.then(function (v) { v = String(v || '').trim(); if (looksLikeUrl(v) && $('rp-url')) doParse(v); }, function () { var el = $('rp-url'); if (el) el.focus(); });
      } else { var el = $('rp-url'); if (el) el.focus(); }
    }, 80);
  });
  /* 转载弹窗里的回车：链接框回车即解析；批量文本域 Ctrl+Enter 即解析 */
  document.addEventListener('keydown', function (ev) {
    if (!KB.rp || !ev.target) return;
    if (ev.target.id === 'rp-url' && ev.key === 'Enter') { ev.preventDefault(); parseUrlInput(); }
    var rpin = ev.target.getAttribute && ev.target.getAttribute('data-rpin');
    if (rpin && ev.key === 'Enter') { ev.preventDefault(); rpAddPick(rpin); }
    if (ev.target.id === 'rp-bulk' && ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); parseBulk(); }
  });

  /* ================= 事件委托 ================= */
  document.addEventListener('click', function (ev) {
    if (!ev.target || !ev.target.closest) return;

    var pick = ev.target.closest('[data-pick]');
    if (pick) {
      /* 单选组（如「形式」只能选一个）：先把兄弟项的 on 清掉再选中自己 */
      var box = pick.parentElement;
      if (box && box.getAttribute && box.getAttribute('data-single')) {
        box.querySelectorAll('[data-pick]').forEach(function (x) { x.classList.remove('on'); });
        pick.classList.add('on');
      } else if (box && box.getAttribute && box.getAttribute('data-keep') && pick.classList.contains('on')) {
        /* 必填组（如「病种」）：点已选项不取消——取消了校验会拦，用户会以为控件坏了 */
      } else {
        var cap = box && box.getAttribute ? Number(box.getAttribute('data-max')) || 0 : 0;
        var excl = box && box.getAttribute ? box.getAttribute('data-excl') : '';
        if (cap && !pick.classList.contains('on') && box.querySelectorAll('[data-pick].on').length >= cap) {
          say('最多选 ' + cap + ' 个，先取消一个再选', 'error');
          return;
        }
        /* 互斥项（病种的「通用」）：选它清空其它，选其它清掉它。
           否则一条内容会同时属于「通用」和「甲状腺」，按通用筛会筛出这条，语义自相矛盾。 */
        if (excl) {
          var isExcl = pick.getAttribute('data-pick') === excl;
          if (isExcl) {
            box.querySelectorAll('[data-pick].on').forEach(function (x) { x.classList.remove('on'); });
            pick.classList.add('on');
            return;
          }
          var exBtn = box.querySelector('[data-pick="' + excl.replace(/"/g, '') + '"]');
          if (exBtn) exBtn.classList.remove('on');
        }
        pick.classList.toggle('on');
      }
      return;
    }

    var cardLink = ev.target.closest('[data-kb="open"]');
    if (cardLink) { ev.preventDefault(); openDetail(cardLink.getAttribute('data-arg')); return; }

    var pageEl = ev.target.closest('.kbx-page');
    if (pageEl) {
      var hitBtn = ev.target.closest('[data-kb]');
      var verb0 = hitBtn ? hitBtn.getAttribute('data-kb') : '';
      if (window.KBDetail && ['videoPlay', 'videoMute', 'videoMark', 'slidePrev', 'slideNext', 'slideFull', 'slideStart', 'step'].indexOf(verb0) >= 0) {
        if (window.KBDetail.act) window.KBDetail.act(verb0, hitBtn.getAttribute('data-arg') || '');
        return;
      }
      if (verb0 === 'back') { backFromDetail(); return; }
    }

    var el = ev.target.closest('[data-kb]');
    if (!el) return;
    var g = el.getAttribute('data-arg') || '';
    switch (el.getAttribute('data-kb')) {
      case 'view': viewAsset(g); return;
      case 'pick': pickAsset(g); return;
      case 'copy': copyPickText(); return;
      case 'dl': {
        /* 附件下载：卡片 ↓、取用弹窗附件行、详情页侧栏附件都走这里。
           每下一次落一条「下载」事件，「我的下载」与「使用统计」都读它。 */
        var dp = g.split('|');
        var art = find(KB.assets, dp[0]);
        if (art) {
          var fname = dp[1] || ((art.attachments || [])[0] || {}).name || (art.title + '.txt');
          var fsize = ((art.attachments || []).filter(function (f) { return f.name === fname; })[0] || {}).size || '—';
          var isTxt = /\.txt$/i.test(fname);
          downloadText(fname, isTxt ? String(art.body).replace(/<[^>]*>/g, '') : plainOf(art));
          pushEvent('下载', art.id, { fileName: fname, size: fsize, via: isTxt ? '正文TXT' : '附件' });
          refreshKeepDetail();
        }
        return;
      }
      case 'dlText': {
        /* 取用弹窗的「下载 TXT」：明确标成正文途径，不和附件下载混在一起统计。
           转载件必须带出处下载——和「带出处复制」同一份文本，别修一处漏一处。 */
        var dt = find(KB.assets, g);
        if (dt) {
          var nm = safeFileName(dt.title) + '.txt';
          downloadText(nm, isReprint(dt) ? exportText(dt) : String(dt.body).replace(/<[^>]*>/g, ''));
          pushEvent('下载', dt.id, { fileName: nm, size: '—', via: '正文TXT' });
        }
        return;
      }
      case 'dlAgain': { dlAgain(g); return; }
      case 'fav': toggleFav(g); return;

      /* 我的内容：页内三页签 */
      case 'mineView': {
        KB.mineView = g;
        KB.pageNo['kb-library:mine'] = 1;
        KB.pageNo['kb-mine:download'] = 1;
        KB.pageNo['kb-mine:upload'] = 1;
        refresh(); return;
      }

      /* 使用统计 */
      case 'usageQuery': { readUsageBar(); KB.pageNo[USAGE_KEY] = 1; say('查询完成'); refresh(); return; }
      /* 重置只清筛选，不清页签：用户在「按机构统计」里点重置，不该被弹回「按内容统计」 */
      case 'usageReset': {
        var curView = usageState().view;
        KB.usageSt = null;
        usageState().view = curView;
        say('已重置筛选条件', 'info'); refresh(); return;
      }
      /* 统计维度已从页签改成筛选条里的下拉（data-kbu="view"），
         这个旧的页签动作保留为空实现，防止缓存里的旧页面点出「未知操作」。 */
      case 'usageView': return;
      case 'usageSort': {
        var st2 = usageState();
        if (st2.sort === g) st2.dir = -st2.dir; else { st2.sort = g; st2.dir = -1; }
        refresh(); return;
      }
      /* 机构排行点列头：取 data-org（列头是 <span data-org=…>，data-arg 不一定在） */
      case 'orgSort': {
        var ust = usageState();
        var keyO = el.getAttribute('data-org') || g;
        if (ust.orgSort === keyO) ust.orgDir = (ust.orgDir === -1 ? 1 : -1);
        else { ust.orgSort = keyO; ust.orgDir = -1; }
        refresh(); return;
      }
      /* 机构下钻（orgDrill）已删除：唯一入口是机构排行的「操作」列，
         而那列本身就是个名不副实的跳转（点了维度切过去，范围并没有缩小）。
         现在要看某家机构的账号，用筛选条的「统计维度 = 按用户统计」，用户表里带机构列。 */
      case 'usageExport': say('统计报表导出任务已提交（原型演示）', 'info'); return;
      case 'artSort': {
        var ub = usageState();
        var keyB = el.getAttribute('data-art') || g;
        if (ub.artSort === keyB) ub.artDir = (ub.artDir === -1 ? 1 : -1);
        else { ub.artSort = keyB; ub.artDir = -1; }
        refresh(); return;
      }
      /* 内容热度排行的排序条：选指标后固定按「大到小」，再点同一个指标才翻转方向。
         和列头点排序写的是同一对 artSort / artDir，两边状态永远一致。
         动作名不能叫 usageSort —— 上面那个同名 case 服务的是机构排行，switch 只会命中先到的那个。 */
      case 'usageArtSort': {
        var ubS = usageState();
        if (ubS.artSort === g) ubS.artDir = (ubS.artDir === -1 ? 1 : -1);
        else { ubS.artSort = g; ubS.artDir = -1; }
        refresh(); return;
      }
      case 'usageArtSortDir': {
        var ubD = usageState();
        ubD.artDir = (ubD.artDir === -1 ? 1 : -1);
        refresh(); return;
      }

      case 'reprint': openReprint({ track: g || '科普' }); return;
      /* 科普 / 培训页的视角页签：内容库 / 转载专区 */
      case 'lineView': KB.lineView = g; KB.pageNo['kb-library:sci'] = 1; KB.pageNo['kb-library:train'] = 1; refresh(); return;
      case 'reprintBulk': openReprint({ bulk: true, track: '科普' }); return;
      /* 清单展开/收起记进状态：重绘（筛选、分页、上下架）后要还原子原来的开合 */
      case 'rpFeedToggle': KB.rpFeedOpen = !KB.rpFeedOpen; refresh(); return;
      case 'rpFromFeed': openReprint({ sid: g }); return;
      case 'rpParse': parseUrlInput(); return;
      case 'rpClose': closeRp(); return;
      case 'rpAddPick': rpAddPick(g); return;
      case 'rpConfirm': confirmReprint(); return;
      case 'rpOpenDup': closeRp(); openDetail(g); return;
      case 'rpBulkMode': KB.rp.mode = 'bulk'; renderRp(); return;
      case 'rpSingleMode': KB.rp.mode = 'single'; renderRp(); return;
      case 'rpBulkParse': parseBulk(); return;
      case 'rpBulkConfirm': confirmBulk(); return;
      case 'rpAttest': openAttest(); return;
      case 'rpAttestSave': saveAttest(); return;
      /* 转载相关的动作：单条 / 批量 / 手填 / 授权 */
      case 'rpCopy': { var rpc = find(KB.assets, g); if (rpc) copyTextWithTrack(exportText(rpc), true, rpc.id); return; }
      case 'rpOpenUrl': openExternal(g); return;
      /* 合集目录里「补全来源后上架」的处理器（依据出处门禁已撤，只剩转载件的来源门禁） */
      case 'shelfFix': {
        var sfa = find(KB.assets, g);
        if (sfa && isReprint(sfa)) { say('转载内容拦的是来源信息：先补录原文或在详情页核对来源', 'error'); openDetail(g); return; }
        setAssetStatus(g); return;
      }
      case 'new': newAsset(g || '科普'); return;
      case 'saveNew': saveNewAsset(); return;
      case 'edit': editAsset(g); return;
      case 'saveEdit': saveEditAsset(); return;
      case 'toggleStatus': setAssetStatus(g); return;
      case 'del': delAsset(g); return;

      case 'bulk': {
        /* 先选内容形式再传物料（kb-bulk.js）。旧版「一个拖拽区认全部格式」已删：
           不同内容形式所需物料不同，混在一套表单里识别不准。 */
        window.KBBulk.open(g, '');
        return;
      }

      /* 合集 */
      case 'clEdit': collectionForm(g); return;
      case 'clSave': collectionSave(g || null); return;
      case 'clDel': collectionDelete(g); return;
      case 'clAddOpen': collectionAddPicker(g); return;
      case 'clAddSave': collectionAddSave(g); return;
      case 'clMove': { var mv = g.split('|'); collectionMove(mv[0], parseInt(mv[1], 10), parseInt(mv[2], 10)); return; }
      case 'clRemove': { var rm = g.split('|'); collectionRemoveMember(rm[0], rm[1]); return; }
      case 'clopen': openCollection(g); return;
      /* 合集详情里的 ▶（整集「从第 1 集开始」与每一集的 play）：都是打开这一集的详情页。
         少了这一条，合集里所有播放按钮都是死键——这是合集详情唯一的去处。 */
      case 'clPlay': openDetail(g); return;
      case 'colBack': goPage(KB.colTrack === '培训' ? 'kb-train' : 'kb-sci'); return;
      case 'clCoverReset': {
        var rc = findCl(g);
        if (rc) { rc.cover = ''; rc.updatedAt = today(); log(ME.name, '恢复首帧封面', rc.name); }
        closeModal(); say('已改回首集视频首帧', 'success'); KB.clOpen = g; refresh(); return;
      }

      /* 上下架维护 */
      case 'filter': readFilter(g); KB.pageNo[g] = 1; refresh(); return;
      case 'filterReset': KB.filters[g] = {}; KB.pageNo[g] = 1; refresh(); return;
      /* 排序：g = 内容线|排序键。换排序必须回到第 1 页，否则会停在旧页序的高页码上 */
      case 'sort': {
        var sk = g.split('|'), tr0 = sk[0], key0 = sk[1];
        var st0 = sortState(tr0);
        st0.key = key0; st0.dir = -1;
        resetLinePage(tr0);
        refresh(); return;
      }
      case 'sortDir': {
        var st1 = sortState(g);
        st1.dir = -st1.dir;
        resetLinePage(g);
        refresh(); return;
      }
      case 'page': { var pg = g.split('|'); KB.pageNo[pg[0]] = parseInt(pg[1], 10); refresh(); return; }

      case 'dictAdd': KB.dictState = KB.dictState || { type: 'sites', kw: '' }; readDictBar(); KB.dictState.type = g; dictForm(g, null); return;
      case 'dictEdit': { var p1 = g.split('|'); dictForm(p1[0], p1[1] === '' ? null : parseInt(p1[1], 10)); return; }
      case 'dictSave': { var p2 = g.split('|'); dictSave(p2[0], p2[1] === '' ? null : parseInt(p2[1], 10)); return; }
      case 'dictToggle': { var p3 = g.split('|'); dictToggle(p3[0], parseInt(p3[1], 10)); return; }
      case 'dictDel': { var p4 = g.split('|'); dictDel(p4[0], parseInt(p4[1], 10)); return; }
      case 'dictQuery': readDictBar(); refresh(); return;
      case 'dictReset': KB.dictState = { type: (KB.dictState || {}).type || 'sites', kw: '' }; refresh(); return;

      case 'rmFile': removeFormFile(g); return;
      case 'galAdd': { var gi = $('kb-a-gallery-input'); if (gi) gi.click(); else say('刷新一下再试', 'error'); return; }
      case 'galRm': rmGallery(g); return;
      case 'galMove': { var gp = g.split('|'); moveGallery(parseInt(gp[0], 10), gp[1]); return; }
      case 'formNewCol': formCreateCollection(); return;
      case 'formAddTag': formAddTag(); return;
      case 'confirmOk': {
        /* confirmBox 把回调寄存在 KB._confirm；不在这里调，确定按钮就是个死键 */
        var cb = KB._confirm;
        KB._confirm = null;
        if (typeof cb === 'function') cb();
        return;
      }
      case 'close': closeModal(); return;
      default: return;
    }
  });

  /* ================= 注册到全局 ================= */
  var LEGACY_IDS = [
    'consult-sessions', 'consult-analysis', 'community-management', 'consult-education',
    'consult-session', 'consult-message', 'consult-category', 'consult-assign-log',
    'analysis-raw-text', 'analysis-ai-result', 'analysis-hotspot', 'analysis-insight',
    'community-board', 'community-post', 'community-comment', 'community-user-log', 'community-recommend'
  ];
  window.kbPageIds = ['kb-sci', 'kb-train', 'kb-mine', 'kb-dict', 'kb-usage', 'kb-library', 'health-consult'].concat(LEGACY_IDS);
  window.kbDictType = function () { readDictBar(); refresh(); };
  window.renderKBPage = renderKBPage;
  window.renderHealthConsultPage = function (id) { renderKBPage(id); };
  window.KB_SYNC_HOME_NEWS = syncHomeNews;

  /* 给 kb-detail.js 用的行为埋点入口（观看在详情页触发） */
  KB.pushEvent = pushEvent;
  /* 转载接口：详情页挂载钩子、判定与台账（演示脚本 / 后续后端对接都用它） */
  KB.reprint = { isReprint: isReprint, sourceText: sourceText, log: reprintLog, dueReview: dueReview, open: openReprint, parse: buildReprint };
  /* 详情页挂载是异步注入的（KBDetailReady 回调里），扩展对象要在模块初始化时先备好，
     不能等 injectDetail —— 那条路径在某些加载顺序下不会带着 ext 跑。 */
  window.KB_RP_EXT = {
    isReprint: isReprint, mount: mountReprint, canShelf: canShelf,
    /* 详情页信息条要显示「上传人 · 上传机构 · 上传时间」：转载件用的是转载经手人与转载时间，
       判据在模块里（createdBy / reprintedBy），详情页只负责排版，所以从这里把取数函数递过去。 */
    uploaderOf: function (a) {
      /* 合集不是内容：没有 reprintedBy，按 createdBy 直接取 */
      if (a && !a.kind && a.members) {
        var cu = findUser(a.createdBy);
        return { name: (cu && cu.name) || a.uploader || '', org: (cu && cu.org) || a.uploaderOrg || a.org || '', at: a.createdAt || '' };
      }
      return { name: uploaderOf(a), org: uploaderOrgOf(a), at: uploaderTimeOf(a) };
    }
  };
  if (window.KBDetail) window.KBDetail.ext = window.KB_RP_EXT;
  KB.currentUser = currentUser;
  /* 顶栏切换身份后：收藏角标是"当前账号"的导出值，必须重算；统计与「我的」三页也要换口径。
     不接这一条，切完身份看到的还是上一个人的收藏与数据。 */
  window.KB_ON_USER_CHANGE = function () {
    syncFavFlags();
    KB.usageSt = null;
    if (KB.detail) refreshKeepDetail();
    else if (KB.page === 'kb-mine' || KB.page === 'kb-usage') refresh();
  };

  window.KBDetailReady = function () { injectDetail(); };

  injectDetail();
  syncHomeNews();
})();