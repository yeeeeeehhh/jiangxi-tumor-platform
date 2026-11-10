/* 肿瘤专科画像 V14.8
   患者详情、画像指标总览、字段核对和导出共用 SP_PROFILE_FIELDS / spProfileRead。
   36 个显示字段按患者基础、肿瘤特征、诊疗过程、随访与结局组织。
   患者字段按患者标识去重且冲突单列；瘤例字段逐份统计，缺失不补零。
   当前使用内置样例记录；医保费用通过 SPCost 独立接入，单瘤例净额与画像相加对账。
   列表筛选不含分期：分期是肿瘤特征的分析维度，不是列表查询条件。
   列表关键字检索报告卡编号 / 姓名 / 身份证号，瘤种、地市、医院各有独立下拉。
   患者基础块「筛查信息」展示筛查机构、项目、时间、结果、建议五项。
   肿瘤特征块不含分期确认日期：stageDate 仅用于截止日过滤、时间线与瘤例排序。
   多原发瘤例切换键在顶部患者条，切换后四块画像同步变化。
*/
(function(){ 'use strict';
var SP_BUILD='V15.0-grouped-report@20261106';
if(typeof console!=='undefined')console.log('[specialty-portrait] '+SP_BUILD+' loaded');

/* ===================== 样式 ===================== */
var spStyle=document.createElement('style');
spStyle.textContent=`
.sp-filter-bar{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;padding:14px;background:var(--color-bg-subtle);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:14px}
.sp-filter-bar .form-group{width:170px}
.sp-filter-bar .form-group.wide{width:240px}
.sp-filter-actions{margin-left:auto;display:flex;gap:8px}
.sp-table-wrap{overflow-x:auto}
/* 列表首列「报告卡编号」：等宽数字 + 主题色下划线，明确是可点的跳转入口 */
.sp-card-no{color:var(--color-primary);font-family:var(--font-num);font-weight:600;text-decoration:none;white-space:nowrap}
.sp-card-no:hover{text-decoration:underline}
/* 就诊机构：多家时「主机构 + 等 N 家」，虚线下划线暗示可悬浮；浮层用 fixed 定位避免被表格滚动容器裁切 */
.sp-hosp{cursor:help;border-bottom:1px dashed rgba(15,23,42,.28);white-space:nowrap}
.sp-hosp-more{font-style:normal;margin-left:4px;color:var(--color-primary);font-size:11px;font-weight:600}
.sp-hosp-tip{position:fixed;z-index:1500;display:none;max-width:360px;background:var(--surface);border:1px solid var(--color-border);border-radius:8px;box-shadow:0 10px 28px rgba(15,23,42,.18);padding:9px 12px 9px 10px;pointer-events:none}
.sp-hosp-tip-t{font-size:11px;color:var(--color-text-muted);margin-bottom:4px}
.sp-hosp-tip ol{margin:0;padding-left:18px;font-size:12px;line-height:1.75;color:var(--color-text-title)}
.sp-stat-row{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;margin-bottom:18px}
.sp-stat-card{background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:14px 16px;box-shadow:var(--shadow-xs)}
.sp-stat-label{font-size:var(--fs-sm);color:var(--color-text-muted)}
.sp-stat-value{font-size:var(--fs-stat);font-weight:700;color:var(--color-primary);margin-top:4px;font-family:var(--font-num)}
.sp-stat-sub{font-size:var(--fs-xs);color:var(--color-text-muted);margin-top:4px}
.sp-mini-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.sp-mini{background:var(--color-bg-subtle);border-radius:var(--radius-sm);padding:10px 12px}
.sp-mini .k{font-size:var(--fs-xs);color:var(--color-text-muted)}
.sp-mini .v{font-size:18px;font-weight:700;font-family:var(--font-num);color:var(--color-text-title);margin-top:3px}
.sp-mini .v em{font-style:normal;font-size:11px;color:var(--color-text-muted)}
.sp-ov-grid{display:grid;grid-template-columns:minmax(340px,1.05fr) minmax(300px,1fr);gap:16px;margin-bottom:16px}
.sp-map-tip{display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.sp-map-tip .btn-sm{height:26px;padding:0 10px;font-size:12px}
.sp-mapsvg{display:block;width:100%;height:360px}
.sp-map-legend{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:8px 4px 0;font-size:var(--fs-xs);color:var(--color-text-muted)}
.sp-map-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.sp-ov-side{display:flex;flex-direction:column;gap:12px;min-width:0}
.sp-ov-side .panel{margin:0}
.sp-map-rank{display:flex;flex-direction:column;gap:9px}
.sp-map-rank-item{display:flex;align-items:center;gap:10px;cursor:pointer;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:7px 10px;background:var(--surface);transition:border-color var(--dur-fast),background var(--dur-fast)}
.sp-map-rank-item:hover{border-color:var(--color-primary)}
.sp-map-rank-item.sel{border-color:var(--color-primary);background:var(--color-primary-soft)}
.sp-map-rank-idx{width:20px;height:20px;border-radius:6px;background:var(--color-bg-subtle);color:var(--color-text-muted);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:var(--font-num);flex:0 0 20px}
.sp-map-rank-name{flex:1;min-width:0;font-size:var(--fs-sm);font-weight:600;color:var(--color-text-title);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-map-rank-val{font-size:var(--fs-sm);font-weight:700;color:var(--color-primary);font-family:var(--font-num)}
.sp-map-rank-sub{font-size:var(--fs-xs);color:var(--color-text-muted);font-family:var(--font-num)}
.sp-site-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px}
.sp-site-card{background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:14px 16px;box-shadow:var(--shadow-xs);cursor:pointer;transition:border-color var(--dur-fast)}
.sp-site-card:hover{border-color:var(--color-primary)}
.sp-site-card.sel{border-color:var(--color-primary);box-shadow:0 0 0 1px var(--color-primary)}
.sp-site-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.sp-site-dot{width:10px;height:10px;border-radius:3px;flex:0 0 10px}
.sp-site-name{font-size:var(--fs-body);font-weight:700;color:var(--color-text-title)}
.sp-site-head .spr-count{margin-left:auto}
.sp-site-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.sp-site-kpi{background:var(--color-bg-subtle);border-radius:var(--radius-xs);padding:8px 10px}
.sp-site-kpi .k{font-size:var(--fs-2xs);color:var(--color-text-muted)}
.sp-site-kpi .v{font-size:16px;font-weight:700;font-family:var(--font-num);color:var(--color-text-title);margin-top:2px}
.sp-site-kpi .v em{font-style:normal;font-size:11px;color:var(--color-text-muted);margin-left:2px}
.sp-domain-tabs{display:flex;gap:2px;border-bottom:2px solid var(--color-border);margin-bottom:16px;overflow-x:auto}
.sp-domain-tab{flex:0 0 auto;padding:10px 18px;border:0;background:transparent;color:var(--color-text-muted);cursor:pointer;font-weight:600;font-size:var(--fs-body);border-bottom:2px solid transparent;margin-bottom:-2px}
.sp-domain-tab:hover{color:var(--color-primary)}
.sp-domain-tab.active{color:var(--color-primary);border-bottom-color:var(--color-primary)}
.sp-2col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.sp-3col{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.spr-count{font-size:var(--fs-xs);color:var(--color-text-muted);font-weight:400;margin-left:8px}
/* ---- 配置质控补充组件 ---- */
.sp-progress{height:8px;border-radius:999px;background:var(--color-bg-subtle);overflow:hidden}
.sp-progress i{display:block;height:100%;border-radius:999px;transition:width .3s}
.sp-chart-empty{height:220px;display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:var(--fs-sm)}
.sp-btn-red{background:#dc2626!important;color:#fff!important;border-color:#dc2626!important}
.sp-btn-red:hover{background:#b91c1c!important;border-color:#b91c1c!important}
.sp-form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px 16px}
.sp-form-row{display:flex;flex-direction:column;gap:5px}
.sp-form-row label{font-size:var(--fs-xs);color:var(--color-text-muted)}
.sp-form-row input:not([type=checkbox]):not([type=radio]),.sp-form-row select{height:34px;padding:0 10px;border:1px solid var(--color-border-strong);border-radius:6px;font-size:var(--fs-body);background:var(--surface);color:var(--color-text-body)}
/* ---- 01 患者详情：摘要条 + 四块画像 + 时间线 ---- */
.sp-detail-shell{min-width:0}
.sp-detail-back{display:flex;align-items:center;margin-bottom:10px}
.sp-patient-strip{display:flex;align-items:center;flex-wrap:wrap;gap:12px 14px;padding:12px 16px;margin-bottom:14px;background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:var(--shadow-xs)}
.sp-patient-id{flex:1 1 240px;min-width:0}
.sp-patient-avatar{width:42px;height:42px;border-radius:50%;background:var(--color-primary-soft);color:var(--color-primary);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700}
.sp-patient-name{display:flex;align-items:baseline;gap:10px;min-width:0;font-size:var(--fs-h2);font-weight:700;color:var(--color-text-title);flex-wrap:wrap}
.sp-patient-meta{font-size:var(--fs-xs);font-weight:500;color:var(--color-text-muted);white-space:nowrap}
.sp-profile-blocks{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:16px}
.sp-profile-block{background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:var(--shadow-xs);min-width:0}
.sp-block-head{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--color-border);flex-wrap:wrap}
.sp-block-idx{width:22px;height:22px;border-radius:6px;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex:0 0 22px}
.sp-block-title{font-size:var(--fs-body);font-weight:700;color:var(--color-text-title)}
.sp-block-body{padding:12px 14px}
/* 多原发瘤例切换键：位于顶部患者条右侧，分段按钮形态，选中项当前瘤例高亮 */
.sp-tumor-switch{display:flex;align-items:center;gap:2px;margin-left:auto;flex-wrap:wrap;padding:2px;background:var(--color-bg-subtle);border:1px solid var(--color-border);border-radius:var(--radius-sm)}
.sp-tumor-switch-label{display:inline-flex;align-items:baseline;gap:4px;padding:0 7px 0 5px;font-size:var(--fs-2xs);color:var(--color-text-muted);white-space:nowrap;border-right:1px solid var(--color-border);margin-right:2px;height:22px;line-height:22px}
.sp-tumor-switch-label em{font-style:normal;font-family:var(--font-num);font-weight:700;color:var(--color-text-body)}
.sp-tumor-tab{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border:0;border-radius:var(--radius-xs);background:transparent;color:var(--color-text-body);font-family:inherit;font-size:var(--fs-2xs);line-height:1;cursor:pointer;transition:all var(--dur-fast);max-width:220px}
.sp-tumor-tab:hover{background:var(--color-primary-50);color:var(--color-primary)}
.sp-tumor-tab.active{background:var(--surface);color:var(--color-primary);font-weight:700;box-shadow:var(--shadow-xs),inset 0 0 0 1px var(--color-primary-300)}
.sp-tumor-tab-no{flex:0 0 auto;font-family:var(--font-num);font-weight:700;font-size:10px;padding:1px 4px;border-radius:3px;background:var(--color-gray-200);color:var(--color-text-muted)}
.sp-tumor-tab.active .sp-tumor-tab-no{background:var(--color-primary);color:#fff}
.sp-tumor-tab-txt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-tumor-tab-tag{flex:0 0 auto;font-size:10px;font-weight:500;padding:1px 4px;border-radius:3px;background:var(--color-primary-50);color:var(--color-primary);border:1px solid var(--color-primary-300)}
.sp-tumor-tab:focus-visible{outline:2px solid var(--color-primary);outline-offset:1px}
@media(max-width:900px){.sp-tumor-switch{margin-left:0;width:100%}.sp-tumor-tab{max-width:none;flex:1 1 auto;justify-content:center}}
/* 画像块内键值网格：两列定宽，避免 3 列时长值折行；长文本用 .sp-span 通栏 */
.sp-kv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 18px}
.sp-kv-grid.sp-cols-1{grid-template-columns:1fr}
.sp-kv-grid.sp-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.sp-sub-head{font-size:var(--fs-xs);font-weight:700;color:var(--color-primary);letter-spacing:.4px;margin:12px 0 6px;padding-left:8px;border-left:3px solid var(--color-primary)}
.sp-note-inline{margin-top:8px;font-size:var(--fs-xs);color:var(--color-text-muted);line-height:1.6}
.sp-kv-grid + .sp-sub-head{margin-top:14px}
.sp-block-body .sp-sub-head:first-child{margin-top:0}
.sp-kv-item{display:flex;flex-direction:column;gap:2px;padding:7px 0;border-bottom:1px dashed var(--color-border);min-width:0}
.sp-kv-item .k{font-size:var(--fs-xs);color:var(--color-text-muted)}
/* 值不拆词：中文可断行，英文/编码整体不断开（修正 C34.9 被拆成 C34. / 9） */
.sp-kv-item .v{font-size:var(--fs-body);color:var(--color-text-title);font-weight:500;overflow-wrap:break-word;word-break:normal;line-height:1.45}
/* 通栏项：长文本占满整行，不参与分栏 */
.sp-kv-item.sp-span{grid-column:1/-1;border-bottom:none;padding-bottom:0}
.sp-kv-item.sp-span + .sp-kv-item:not(.sp-span){border-top:1px dashed var(--color-border);margin-top:6px;padding-top:9px}
/* 键值同上行：键与值同行显示，用于短值（日期、编码），压缩高度 */
.sp-kv-item.sp-inline{flex-direction:row;align-items:baseline;gap:8px}
.sp-kv-item.sp-inline .k{flex:0 0 auto}
.sp-kv-item.sp-inline .v{flex:1 1 auto}
.sp-timeline{position:relative;padding-left:24px;margin:12px 0}
.sp-timeline::before{content:'';position:absolute;left:7px;top:4px;bottom:4px;width:2px;background:var(--color-border)}
.sp-tl-item{position:relative;padding-bottom:14px}
.sp-tl-item::before{content:'';position:absolute;left:-20px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--color-primary);border:2px solid var(--surface)}
.sp-tl-date{font-size:var(--fs-xs);color:var(--color-text-muted);margin-bottom:2px}
.sp-tl-content{font-size:var(--fs-body);color:var(--color-text-body)}
.sp-rpt-info{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:var(--fs-sm);color:var(--color-text-muted);margin-bottom:12px}
.sp-rpt-sec{margin-bottom:12px}
.sp-rpt-t{font-size:var(--fs-xs);font-weight:700;color:var(--color-text-title);margin-bottom:5px;display:flex;align-items:center;gap:6px}
.sp-rpt-t::before{content:'';width:3px;height:12px;background:var(--color-primary);border-radius:2px}
.sp-rpt-c{font-size:var(--fs-body);color:var(--color-text-body);line-height:1.75}
tr.sp-lab-abn>td{color:var(--color-danger-fg)}
.sp-abn-mark{color:var(--color-danger-fg);font-weight:700}
.sp-tl-item.sp-tl-exam::before{background:#f59e0b}
.sp-tl-item.sp-tl-ref::before{background:#14b8a6}
.sp-tl-legend{display:flex;gap:16px;font-size:var(--fs-xs);color:var(--color-text-muted);margin:2px 0 8px}
.sp-tl-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:1px}
.sp-ref-flow{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:12px 0 2px}
.sp-ref-node{background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:10px 12px}
.sp-ref-role{font-size:var(--fs-2xs);color:var(--color-text-muted)}
.sp-ref-name{font-size:var(--fs-body);font-weight:700;color:var(--color-text-title);margin-top:2px}
.sp-ref-line{font-size:var(--fs-xs);color:var(--color-primary);white-space:nowrap}
/* ---- 02 群体专科画像：总览KPI带 + 一句话摘要（页面焦点，非四维卡重复） ---- */
.sp-gp-empty{padding:40px 16px;text-align:center;font-size:var(--fs-body);color:var(--color-text-muted);line-height:2.1;background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:18px}
/* 总览 KPI 带：一行 8 项，值 + 与全省基准的差值 */
.sp-kpi-strip{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:0;background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:var(--shadow-xs);overflow:hidden;margin-bottom:14px}
.sp-kpi{position:relative;padding:12px 12px 11px;border-right:1px solid var(--color-border);min-width:0}
.sp-kpi:last-child{border-right:0}
.sp-kpi-k{font-size:var(--fs-2xs);color:var(--color-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:4px}
.sp-kpi-k i{width:7px;height:7px;border-radius:2px;flex:0 0 7px}
.sp-kpi-v{font-size:22px;font-weight:800;font-family:var(--font-num);color:var(--color-text-title);line-height:1.15;margin-top:4px;white-space:nowrap}
.sp-kpi-v em{font-style:normal;font-size:12px;font-weight:600;color:var(--color-text-muted);margin-left:1px}
.sp-kpi-sub{font-size:var(--fs-2xs);color:var(--color-text-muted);margin-top:3px;font-family:var(--font-num);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-kpi-sub b{font-weight:700}
.sp-kpi-sub .up{color:var(--color-danger-fg)}
.sp-kpi-sub .down{color:var(--color-success-fg)}
.sp-kpi-sub .flat{color:var(--color-text-muted)}
/* 指标达标状态标签：达标绿 / 预警琥珀 / 未达标红 */
.sp-kpi-tag{margin-left:auto;flex:0 0 auto;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.02em;white-space:nowrap}
.sp-kpi-success{background:rgba(16,185,129,.12);color:#047857}
.sp-kpi-caution{background:rgba(245,158,11,.14);color:#b45309}
.sp-kpi-danger{background:rgba(239,68,68,.12);color:#b91c1c}
/* 一句话摘要条 */
.sp-gp-summary{display:flex;align-items:flex-start;gap:12px;padding:13px 16px;background:var(--color-primary-soft);border:1px solid var(--color-border);border-left:3px solid var(--color-primary);border-radius:var(--radius-md);margin-bottom:16px}
.sp-gp-summary-ico{width:26px;height:26px;border-radius:7px;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex:0 0 26px}
.sp-gp-summary-txt{font-size:var(--fs-body);color:var(--color-text-body);line-height:1.7;min-width:0}
.sp-gp-summary-txt b{color:var(--color-text-title);font-weight:700}
.sp-gp-summary-txt em{font-style:normal;font-family:var(--font-num);font-weight:700;color:var(--color-primary)}
@media(max-width:1280px){.sp-kpi-strip{grid-template-columns:repeat(4,1fr)}.sp-kpi:nth-child(4n){border-right:0}.sp-kpi:nth-child(-n+4){border-bottom:1px solid var(--color-border)}}
@media(max-width:768px){.sp-kpi-strip{grid-template-columns:repeat(2,1fr)}.sp-kpi:nth-child(2n){border-right:0}}
/* ---- 防治链条级联漏斗：人群从「在管」到「随访在管」逐环转化，环间标流失（群体视角核心） ---- */
.sp-funnel{background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:var(--shadow-xs);padding:16px 18px 14px;margin-bottom:16px}
.sp-funnel-head{display:flex;align-items:baseline;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.sp-funnel-title{font-size:var(--fs-body);font-weight:700;color:var(--color-text-title)}
.sp-funnel-hint{font-size:var(--fs-xs);color:var(--color-text-muted)}
.sp-funnel-flow{display:flex;align-items:stretch;gap:0;overflow-x:auto;padding-bottom:4px}
.sp-fn-node{flex:1 1 0;min-width:118px;display:flex;flex-direction:column}
.sp-fn-bar{position:relative;height:74px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;padding:6px 8px;text-align:center;transition:transform var(--dur-fast)}
.sp-fn-bar:hover{transform:translateY(-2px)}
.sp-fn-n{font-size:26px;font-weight:800;font-family:var(--font-num);line-height:1.05}
.sp-fn-n em{font-style:normal;font-size:12px;font-weight:600;opacity:.85;margin-left:1px}
.sp-fn-k{font-size:var(--fs-xs);font-weight:600;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.sp-fn-rate{font-size:var(--fs-2xs);color:var(--color-text-muted);font-family:var(--font-num);text-align:center;margin-top:6px}
.sp-fn-rate b{font-weight:700;color:var(--color-text-title)}
.sp-fn-gap{flex:0 0 46px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:12px}
.sp-fn-gap-arrow{font-size:16px;color:var(--color-text-muted);line-height:1}
.sp-fn-gap-loss{font-size:var(--fs-2xs);font-family:var(--font-num);margin-top:3px;white-space:nowrap;font-weight:700}
.sp-fn-gap-loss.warn{color:var(--color-danger-fg)}
.sp-fn-gap-loss.ok{color:var(--color-text-muted)}
@media(max-width:900px){.sp-fn-node{min-width:104px}.sp-fn-gap{flex-basis:34px}}
@media(max-width:1280px){.sp-stat-row{grid-template-columns:repeat(3,1fr)}.sp-ov-grid{grid-template-columns:1fr}}
@media(max-width:900px){.sp-2col{grid-template-columns:1fr}.sp-3col{grid-template-columns:1fr}.sp-profile-blocks{grid-template-columns:1fr}}
@media(max-width:768px){.sp-stat-row{grid-template-columns:repeat(2,1fr)}.sp-filter-bar{flex-direction:column}.sp-filter-bar .form-group,.sp-filter-bar .form-group.wide{width:100%}.sp-filter-actions{margin-left:0;width:100%}.sp-mini-grid{grid-template-columns:repeat(2,1fr)}}
`;
document.head.appendChild(spStyle);


/* ===================== 一、数据层：患者画像 Schema（四维） ===================== */
var SP_CITIES=['南昌市','景德镇市','萍乡市','九江市','新余市','鹰潭市','赣州市','吉安市','宜春市','抚州市','上饶市'];
var SP_SITES=['肺','乳腺','肝','胃','结直肠','宫颈','食管'];
var SP_STAGE_GROUPS=['I期','II期','III期','IV期'];
var SP_STAGE_COLORS={'I期':'#10b981','II期':'#2563eb','III期':'#f59e0b','IV期':'#ef4444'};
var SP_HOSP_CITY={'江西省肿瘤医院':'南昌市','南昌市第一医院':'南昌市','赣州市人民医院':'赣州市','九江市第一人民医院':'九江市','上饶市肿瘤医院':'上饶市','宜春市人民医院':'宜春市','吉安市中心医院':'吉安市','抚州市第一医院':'抚州市','景德镇市第一医院':'景德镇市','萍乡市人民医院':'萍乡市','新余市人民医院':'新余市','鹰潭市人民医院':'鹰潭市'};
/* 就诊医院下拉选项：直接由机构-地市映射派生，按地市顺序排列，不另行硬编码一份名单 */
var SP_HOSPITALS=(function(){
  var arr=[];
  SP_CITIES.forEach(function(c){Object.keys(SP_HOSP_CITY).forEach(function(h){if(SP_HOSP_CITY[h]===c&&arr.indexOf(h)<0)arr.push(h)})});
  Object.keys(SP_HOSP_CITY).forEach(function(h){if(arr.indexOf(h)<0)arr.push(h)});
  return arr;
})();

var tumorEvents=[
{id:'TE001',reportCardNo:'JX-2026-000318',patient:'陈建国',sex:'男',age:63,idNo:'360102196305121234',region:'南昌市东湖区',city:'南昌市',insurance:'职工医保',firstHosp:'东湖区董家窑街道社区卫生服务中心',firstDate:'2026-01-18',hospital:'南昌市第一医院',
 site:'肺',laterality:'右肺上叶',path:'腺癌',grade:'中分化',tNm:'cT2aN2M0',stage:'III期',stageDate:'2026-01-28',multiPrimary:true,tumorSeq:1,
 treatMode:['手术','化疗'],mdt:true,
 symptom:'偶有干咳',pain:'轻度疼痛',nutrition:'中度营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'I度骨髓抑制',rehab:'康复中',supportive:'营养支持',
 lastFu:'2026-08-25',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'高血压 8 年、2 型糖尿病 5 年',smoke:'吸烟 30 年，20 支/日（未戒）',drink:'偶饮酒',family:'父亲患肺癌',diagBasis:'胸部 CT 增强 + 经皮肺穿刺病理 + 免疫组化',diagDate:'2026-02-02',tConfirm:'2026-02-02',metastasis:'区域淋巴结转移',treatMode:['手术','化疗'],referral:true,curPhase:'辅助化疗中',phaseTimeline:'手术(2026-02-05)→辅助化疗中(第3/6周期)',tFirst:'2026-01-18',tTreat:'2026-02-05',admCount:5,admDays:26,marker:'EGFR 19del 阳性；TTF-1(+)；PD-L1 TPS 35%',recurrence:false,recist:'SD',screenType:"低剂量螺旋 CT 肺癌筛查",screenDate:"2025-11-20",screenResult:"右肺上叶结节 8mm",screenOrg:'东湖区董家窑街道社区卫生服务中心',screenAdvice:"建议年度复查 CT，必要时穿刺活检",treatments:[{"mode":"手术","date":"2026-02-05","end":"2026-02-12","plan":"右肺上叶切除术 + 系统性淋巴结清扫","note":"术后病理 pT2aN2M0"},{"mode":"化疗","start":"2026-03-01","end":"2026-06-20","plan":"培美曲塞 + 顺铂（辅助化疗 4 周期）","note":"末次给药 2026-06-20，第 3/6 周期随访中"}],markerDate:'2026-02-02',recistDate:'2026-08-20',ecogDate:'2026-08-20',metaProgress:'无',diseaseProgress:false},
/* 同一患者（陈建国）第二原发：异时性多原发，由「肿瘤特征」块内切换键切换查看 */
{id:'TE001B',reportCardNo:'JX-2026-000902',patient:'陈建国',sex:'男',age:64,idNo:'360102196305121234',region:'南昌市东湖区',city:'南昌市',insurance:'职工医保',firstHosp:'东湖区董家窑街道社区卫生服务中心',firstDate:'2026-09-10',hospital:'江西省肿瘤医院',
 site:'结直肠',laterality:'升结肠',path:'腺癌',grade:'中分化',tNm:'pT2N0M0',stage:'I期',stageDate:'2026-09-18',multiPrimary:true,tumorSeq:2,tumorPattern:'异时性',
 treatMode:['手术'],mdt:true,
 symptom:'便潜血阳性，偶有腹胀',pain:'无痛',nutrition:'轻度营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-10-20',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'高血压 8 年、2 型糖尿病 5 年、原发性肺癌（2026 年）',smoke:'吸烟 30 年，20 支/日（未戒）',drink:'偶饮酒',family:'父亲患肺癌、哥哥患结肠癌',diagBasis:'结肠镜 + 活检病理 + 术后病理',diagDate:'2026-09-15',tConfirm:'2026-09-15',metastasis:'无远处转移',referral:false,curPhase:'术后随访中',phaseTimeline:'肠镜发现(2026-09-10)→手术(2026-09-22)→术后随访中',tFirst:'2026-09-10',tTreat:'2026-09-22',admCount:2,admDays:11,marker:'MSI-H（dMMR）；RAS/BRAF 野生型；MLH1/PMS2 缺失',recurrence:false,recist:'CR',screenType:"结肠镜（肺癌随访期间机会性筛查）",screenDate:"2026-09-10",screenResult:"升结肠 3.0cm 隆起型占位",screenOrg:'江西省肿瘤医院',screenAdvice:"建议活检明确病理并手术切除",treatments:[{"mode":"手术","date":"2026-09-22","end":"2026-09-29","plan":"腹腔镜右半结肠切除术 + D3 淋巴结清扫","note":"术后病理 pT2N0M0，MSI-H"}],markerDate:'2026-09-15',recistDate:'2026-10-20',ecogDate:'2026-10-20',metaProgress:'无',diseaseProgress:false},
{id:'TE002',reportCardNo:'JX-2026-000356',patient:'刘雅琴',sex:'女',age:47,idNo:'360702197808152345',region:'赣州市章贡区',city:'赣州市',insurance:'职工医保',firstHosp:'章贡区南外街道社区卫生服务中心',firstDate:'2026-03-20',hospital:'江西省肿瘤医院',
 site:'乳腺',laterality:'左乳',path:'浸润性导管癌',grade:'II级',tNm:'cT2N1M0',stage:'II期',stageDate:'2026-03-27',multiPrimary:false,
 treatMode:['手术','化疗','内分泌'],mdt:true,
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-08-24',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'甲状腺功能减退 3 年',smoke:'不吸烟',drink:'不饮酒',family:'母亲患乳腺癌',diagBasis:'乳腺钼靶 + 彩超 + 空芯针穿刺病理 + 免疫组化',diagDate:'2026-03-27',tConfirm:'2026-03-27',metastasis:'同侧腋窝淋巴结转移',treatMode:['手术','化疗','内分泌'],referral:true,curPhase:'内分泌维持中',phaseTimeline:'手术(2026-04-08)→化疗完成(2026-08-24)→内分泌维持中',tFirst:'2026-03-20',tTreat:'2026-04-08',admCount:8,admDays:23,marker:'ER 80%(+)；PR 60%(+)；HER2 2+ FISH 阴性；Ki-67 15%；Luminal B 型',recurrence:false,recist:'CR',screenType:"两癌筛查（乳腺钼靶 + 超声）",screenDate:"2026-03-18",screenResult:"左乳结节伴簇状钙化，BI-RADS 5",screenOrg:'章贡区南外街道社区卫生服务中心',screenAdvice:"建议空芯针穿刺活检",treatments:[{"mode":"手术","date":"2026-04-08","end":"2026-04-15","plan":"左乳癌改良根治术 + 前哨淋巴结活检","note":"术后病理浸润性导管癌 II 级"},{"mode":"化疗","start":"2026-04-28","end":"2026-08-24","plan":"AC-T 方案（表柔比星+环磷酰胺序贯多西他赛）","note":"化疗已结束"},{"mode":"内分泌","start":"2026-08-24","end":"","plan":"他莫昔芬（内分泌维持）","note":"Luminal B 型，维持治疗中"}],markerDate:'2026-03-27',recistDate:'2026-08-24',ecogDate:'2026-08-24',metaProgress:'无',diseaseProgress:false},
{id:'TE003',reportCardNo:'JX-2026-000781',patient:'赵德顺',sex:'男',age:74,idNo:'360402195502283456',region:'九江市浔阳区',city:'九江市',insurance:'城乡居民',firstHosp:'浔阳区甘棠街道卫生院',firstDate:'2026-07-08',hospital:'九江市第一人民医院',
 site:'胃',laterality:'胃窦',path:'低分化腺癌',grade:'低分化',tNm:'cT4aN2M1',stage:'IV期',stageDate:'2026-07-10',multiPrimary:false,
 treatMode:['化疗'],mdt:true,
 symptom:'上腹隐痛',pain:'中度疼痛',nutrition:'高度营养风险',physical:'ECOG 2',complication:'不全肠梗阻',ae:'II度骨髓抑制',rehab:'支持治疗为主',supportive:'肠外营养+安宁疗护',
 lastFu:'2026-08-26',followStatus:'随访中',vitalStatus:'存活（带瘤）',deathCause:'',lostFollow:false,pastHistory:'慢性萎缩性胃炎 10 年、幽门螺杆菌感染史',smoke:'吸烟 45 年，15 支/日（未戒）',drink:'饮白酒 30 年',family:'无肿瘤家族史',diagBasis:'胃镜 + 活检病理 + 全腹 CT 增强分期',diagDate:'2026-07-10',tConfirm:'2026-07-10',metastasis:'腹膜转移',treatMode:['化疗'],referral:true,curPhase:'姑息治疗中',phaseTimeline:'MDT评估(2026-07-12)→姑息一线化疗中(第3/6周期)',tFirst:'2026-07-08',tTreat:'2026-07-12',admCount:4,admDays:31,marker:'HER2 阴性；MSI-H（dMMR）；PD-L1 CPS 10',recurrence:false,recist:'PD',screenType:"上消化道癌机会性筛查（胃镜）",screenDate:"2026-06-30",screenResult:"胃窦黏膜萎缩伴肠化",screenOrg:'浔阳区甘棠街道卫生院',screenAdvice:"建议胃镜下多点活检",treatments:[{"mode":"化疗","start":"2026-07-12","end":"","plan":"XELOX + 纳武利尤单抗（姑息一线）","note":"MSI-H/dMMR，第 3/6 周期中"}],markerDate:'2026-07-10',recistDate:'2026-08-26',ecogDate:'2026-08-26',metaProgress:'腹膜转移',diseaseProgress:true},
{id:'TE004',reportCardNo:'JX-2026-000342',patient:'王秀兰',sex:'女',age:54,idNo:'361100198006125871',region:'上饶市信州区',city:'上饶市',insurance:'职工医保',firstHosp:'信州区西市街道社区卫生服务中心',firstDate:'2026-02-15',hospital:'上饶市肿瘤医院',
 site:'肝',laterality:'右肝后叶',path:'肝细胞癌',grade:'中分化',tNm:'cT3N0M0',stage:'III期',stageDate:'2026-02-20',multiPrimary:false,
 treatMode:['手术','介入'],mdt:true,
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-07-20',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'乙型肝炎 20 年、肝硬化 5 年',smoke:'不吸烟',drink:'已戒酒 5 年',family:'哥哥患肝癌',diagBasis:'上腹部 MRI 增强（LI-RADS 5）+ 术后病理',diagDate:'2026-02-20',tConfirm:'2026-02-20',metastasis:'无远处转移',treatMode:['手术','介入'],referral:true,curPhase:'术后随访中',phaseTimeline:'手术(2026-03-02)→TACE介入(2026-06-15)→术后随访中',tFirst:'2026-02-15',tTreat:'2026-03-02',admCount:4,admDays:19,marker:'AFP 412.5；DCP 156；HBsAg 阳性；HBV-DNA 2.3×10⁴',recurrence:false,recist:'CR',screenType:"肝癌高危人群筛查（超声 + AFP）",screenDate:"2026-01-10",screenResult:"右肝后叶低回声结节，AFP 升高",screenOrg:'信州区西市街道社区卫生服务中心',screenAdvice:"建议增强 MRI 明确诊断",treatments:[{"mode":"手术","date":"2026-03-02","end":"2026-03-12","plan":"右肝后叶切除术","note":"术后病理肝细胞癌，MVI M1"},{"mode":"介入","start":"2026-06-15","end":"2026-06-18","plan":"TACE 经导管肝动脉化疗栓塞","note":"术后 CT 复查疗效 CR"}],markerDate:'2026-02-20',recistDate:'2026-07-18',ecogDate:'2026-07-18',metaProgress:'无',diseaseProgress:false},
{id:'TE005',reportCardNo:'JX-2026-000488',patient:'李志强',sex:'男',age:66,idNo:'361000196011152330',region:'宜春市袁州区',city:'宜春市',insurance:'职工医保',firstHosp:'袁州区化成街道社区卫生服务中心',firstDate:'2026-04-12',hospital:'宜春市人民医院',
 site:'肺',laterality:'左肺下叶',path:'鳞状细胞癌',grade:'中分化',tNm:'cT2bN2M0',stage:'III期',stageDate:'2026-04-18',multiPrimary:false,
 treatMode:['手术','放疗','化疗'],mdt:true,
 symptom:'偶有胸闷',pain:'轻度疼痛',nutrition:'无营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'II度放射性食管炎',rehab:'康复中',supportive:'营养支持',
 lastFu:'2026-08-30',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'慢性阻塞性肺疾病 6 年、肺结核史',smoke:'吸烟 40 年，20 支/日（已戒 2 年）',drink:'偶饮酒',family:'无肿瘤家族史',diagBasis:'胸部 CT 增强 + 支气管镜活检病理',diagDate:'2026-04-18',tConfirm:'2026-04-18',metastasis:'区域淋巴结转移',treatMode:['手术','放疗','化疗'],referral:true,curPhase:'同步放化疗中',phaseTimeline:'手术(2026-05-10)→同步放化疗中(第4/6周期)',tFirst:'2026-04-12',tTreat:'2026-05-10',admCount:6,admDays:28,marker:'PD-L1 TPS 60%；p40(+)；未见 EGFR/ALK 突变',recurrence:false,recist:'PR',screenType:"低剂量螺旋 CT 肺癌筛查",screenDate:"2026-03-25",screenResult:"左肺下叶占位 3.1cm",screenOrg:'袁州区化成街道社区卫生服务中心',screenAdvice:"建议支气管镜检查及病理确诊",treatments:[{"mode":"手术","date":"2026-05-10","end":"2026-05-18","plan":"左肺下叶切除术 + 淋巴结清扫","note":"术后病理鳞状细胞癌"},{"mode":"放疗","start":"2026-06-15","end":"","plan":"胸部调强放疗（IMRT）","note":"同步放化疗，第 4/6 周期"},{"mode":"化疗","start":"2026-06-15","end":"","plan":"依托泊苷 + 顺铂（同步）","note":"同步放化疗，第 4/6 周期"}],markerDate:'2026-04-18',recistDate:'2026-08-30',ecogDate:'2026-08-30',metaProgress:'无',diseaseProgress:false},
{id:'TE006',reportCardNo:'JX-2026-000563',patient:'周桂香',sex:'女',age:69,idNo:'360300196509120826',region:'景德镇市珠山区',city:'景德镇市',insurance:'城镇居民',firstHosp:'珠山区里村街道社区卫生服务中心',firstDate:'2026-05-06',hospital:'景德镇市第一医院',
 site:'宫颈',laterality:'宫颈',path:'鳞状细胞癌',grade:'中分化',tNm:'cT2bN1M0',stage:'II期',stageDate:'2026-05-11',multiPrimary:false,
 treatMode:['手术','放疗'],mdt:false,
 symptom:'偶有接触性出血',pain:'轻度疼痛',nutrition:'无营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'I度骨髓抑制',rehab:'康复中',supportive:'无',
 lastFu:'2026-08-25',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'子宫肌瘤手术史、高血压 5 年',smoke:'不吸烟',drink:'不饮酒',family:'无肿瘤家族史',diagBasis:'宫颈活检病理 + 盆腔 MRI 分期',diagDate:'2026-05-11',tConfirm:'2026-05-11',metastasis:'区域淋巴结转移',treatMode:['手术','放疗'],referral:true,curPhase:'根治性放疗中',phaseTimeline:'手术(2026-05-20)→根治性放疗中(第3/6周期)',tFirst:'2026-05-06',tTreat:'2026-05-20',admCount:5,admDays:24,marker:'p16 阳性；HPV 16 型阳性；PD-L1 CPS 5',recurrence:false,recist:'CR',screenType:"两癌筛查（TCT + HPV）",screenDate:"2026-05-06",screenResult:"TCT 示 HSIL",screenOrg:'珠山区里村街道社区卫生服务中心',screenAdvice:"HPV16 阳性，建议阴道镜活检",treatments:[{"mode":"手术","date":"2026-05-20","end":"2026-05-27","plan":"广泛性子宫切除术 + 盆腔淋巴结清扫","note":"术后病理宫颈鳞癌"},{"mode":"放疗","start":"2026-06-20","end":"","plan":"盆腔外照射 + 后装腔内放疗","note":"根治性放疗，第 3/6 周期"}],markerDate:'2026-05-11',recistDate:'2026-08-25',ecogDate:'2026-08-25',metaProgress:'无',diseaseProgress:false},
{id:'TE007',reportCardNo:'JX-2026-000712',patient:'吴建国',sex:'男',age:58,idNo:'360500198108203456',region:'萍乡市安源区',city:'萍乡市',insurance:'职工医保',firstHosp:'安源区后埠街道社区卫生服务中心',firstDate:'2026-06-20',hospital:'南昌市第一医院',
 site:'结直肠',laterality:'直肠',path:'腺癌',grade:'中分化',tNm:'cT3N1M0',stage:'III期',stageDate:'2026-06-25',multiPrimary:false,
 treatMode:['手术','化疗'],mdt:true,
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-09-05',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'胆囊结石 6 年',smoke:'吸烟 25 年，10 支/日（未戒）',drink:'饮啤酒 20 年',family:'无肿瘤家族史',diagBasis:'结肠镜 + 活检病理 + 全腹 CT 分期',diagDate:'2026-06-25',tConfirm:'2026-06-25',metastasis:'区域淋巴结转移',treatMode:['手术','化疗'],referral:true,curPhase:'辅助化疗中',phaseTimeline:'手术(2026-07-02)→辅助化疗中(第2/6周期)',tFirst:'2026-06-20',tTreat:'2026-07-02',admCount:3,admDays:16,marker:'RAS 野生型；MSI-L（pMMR）；CEA 8.6',recurrence:false,recist:'SD',screenType:"结直肠癌筛查（便潜血 + 结肠镜）",screenDate:"2026-06-10",screenResult:"便潜血阳性，结肠镜见距肛门 7cm 占位",screenOrg:'安源区后埠街道社区卫生服务中心',screenAdvice:"建议活检明确病理",treatments:[{"mode":"手术","date":"2026-07-02","end":"2026-07-11","plan":"腹腔镜直肠癌根治术（Dixon）","note":"术后病理直肠腺癌 T3"},{"mode":"化疗","start":"2026-08-01","end":"","plan":"XELOX 方案（辅助化疗）","note":"第 2/6 周期中"}],markerDate:'2026-06-25',recistDate:'2026-09-05',ecogDate:'2026-09-05',metaProgress:'无',diseaseProgress:false},
{id:'TE008',reportCardNo:'JX-2026-000836',patient:'胡爱莲',sex:'女',age:61,idNo:'360800198209165234',region:'抚州市临川区',city:'抚州市',insurance:'城镇居民',firstHosp:'临川区青云街道社区卫生服务中心',firstDate:'2026-07-25',hospital:'江西省肿瘤医院',
 site:'乳腺',laterality:'右乳',path:'浸润性导管癌',grade:'III级',tNm:'cT2N2M1',stage:'IV期',stageDate:'2026-07-28',multiPrimary:false,
 treatMode:['化疗','靶向'],mdt:true,
 symptom:'骨转移灶疼痛',pain:'重度疼痛',nutrition:'中度营养风险',physical:'ECOG 2',complication:'病理性骨折(肋骨)',ae:'II度骨髓抑制',rehab:'支持治疗为主',supportive:'镇痛治疗',
 lastFu:'2026-09-02',followStatus:'随访中',vitalStatus:'存活（带瘤）',deathCause:'',lostFollow:false,pastHistory:'2 型糖尿病 10 年、骨质疏松',smoke:'不吸烟',drink:'不饮酒',family:'姐姐患乳腺癌',diagBasis:'钼靶/彩超 + 穿刺病理 + PET-CT 分期',diagDate:'2026-07-28',tConfirm:'2026-07-28',metastasis:'骨转移/肝转移',treatMode:['化疗','靶向'],referral:true,curPhase:'一线治疗中',phaseTimeline:'MDT评估(2026-07-30)→化疗+靶向治疗中(第2/6周期)',tFirst:'2026-07-25',tTreat:'2026-07-30',admCount:4,admDays:22,marker:'HER2 阴性；ER 40%(+)；BRCA1 未突变；PD-L1 CPS 20',recurrence:false,recist:'PR',screenType:"两癌筛查（乳腺钼靶 + 超声）",screenDate:"2026-07-18",screenResult:"右乳肿块伴多发钙化，BI-RADS 5",screenOrg:'临川区青云街道社区卫生服务中心',screenAdvice:"建议空芯针穿刺活检及免疫组化",treatments:[{"mode":"化疗","start":"2026-07-30","end":"","plan":"多西他赛 + 卡铂（一线）","note":"第 2/6 周期，疗效评价 PR"},{"mode":"靶向","start":"2026-08-10","end":"","plan":"曲妥珠单抗 + 帕妥珠单抗（抗 HER2）","note":"LVEF 58%，基线正常"}],markerDate:'2026-07-28',recistDate:'2026-09-01',ecogDate:'2026-09-01',metaProgress:'骨转移/肝转移',diseaseProgress:true},
{id:'TE009',reportCardNo:'JX-2026-000874',patient:'欧阳明轩',sex:'男',age:52,idNo:'362400197403121243',region:'吉安市吉州区',city:'吉安市',insurance:'城镇居民',firstHosp:'吉州区古南镇卫生院',firstDate:'2026-08-01',hospital:'吉安市中心医院',
 site:'食管',laterality:'胸中段食管',path:'鳞状细胞癌',grade:'中分化',tNm:'cT3N1M0',stage:'III期',stageDate:'2026-08-05',multiPrimary:false,
 treatMode:['放疗','化疗'],mdt:true,
 symptom:'进食梗阻感',pain:'轻度疼痛',nutrition:'中度营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'II度放射性食管炎',rehab:'康复中',supportive:'营养支持',
 lastFu:'2026-09-08',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'长期饮酒史、反流性食管炎',smoke:'吸烟 30 年，20 支/日（未戒）',drink:'饮白酒 25 年',family:'父亲患食管癌',diagBasis:'胃镜 + 活检病理 + 胸腹 CT 分期',diagDate:'2026-08-05',tConfirm:'2026-08-05',metastasis:'区域淋巴结转移',treatMode:['放疗','化疗'],referral:true,curPhase:'根治性同步放化疗中',phaseTimeline:'确诊(2026-08-05)→根治性同步放化疗中(第3/6周期)',tFirst:'2026-08-01',tTreat:'2026-08-08',admCount:3,admDays:18,marker:'PD-L1 CPS 15；p53 过表达；HER2 阴性',recurrence:false,recist:'PR',screenType:"上消化道癌机会性筛查（钡餐 + 胃镜）",screenDate:"2026-07-25",screenResult:"食管中段充盈缺损 6cm",screenOrg:'吉州区古南镇卫生院',screenAdvice:"建议胃镜活检明确病理",treatments:[{"mode":"放疗","start":"2026-08-08","end":"","plan":"食管癌根治性放疗（IMRT）","note":"同步放化疗，第 3/6 周期"},{"mode":"化疗","start":"2026-08-08","end":"","plan":"紫杉醇 + 顺铂（同步）","note":"同步放化疗，第 3/6 周期"}],markerDate:'2026-08-05',recistDate:'2026-09-08',ecogDate:'2026-09-08',metaProgress:'无',diseaseProgress:false},
{id:'TE010',reportCardNo:'JX-2026-000621',patient:'邓三妹',sex:'女',age:63,idNo:'360800196306128475',region:'抚州市临川区',city:'抚州市',insurance:'城镇居民',firstHosp:'临川区青云街道社区卫生服务中心',firstDate:'2026-06-01',hospital:'抚州市第一医院',
 site:'宫颈',laterality:'宫颈',path:'鳞状细胞癌',grade:'中分化',tNm:'cT2bN1M0',stage:'II期',stageDate:'2026-06-05',multiPrimary:false,
 treatMode:['手术','化疗'],mdt:true,
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'I度骨髓抑制',rehab:'康复良好',supportive:'无',
 lastFu:'2026-08-20',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'高血压 12 年',smoke:'不吸烟',drink:'不饮酒',family:'无肿瘤家族史',diagBasis:'宫颈活检病理 + 盆腔 MRI 分期',diagDate:'2026-06-05',tConfirm:'2026-06-05',metastasis:'区域淋巴结转移',treatMode:['手术','化疗'],referral:true,curPhase:'辅助化疗中',phaseTimeline:'手术(2026-06-12)→辅助化疗中(第2/6周期)',tFirst:'2026-06-01',tTreat:'2026-06-12',admCount:4,admDays:17,marker:'HPV 18 型阳性；p16 阳性；PD-L1 CPS 8',recurrence:false,recist:'CR',screenType:"两癌筛查（TCT + HPV）",screenDate:"2026-05-22",screenResult:"TCT 示 ASC-H",screenOrg:'临川区青云街道社区卫生服务中心',screenAdvice:"HPV18 阳性，建议阴道镜活检",treatments:[{"mode":"手术","date":"2026-06-12","end":"2026-06-20","plan":"广泛性子宫切除术 + 盆腔淋巴结清扫","note":"术后病理宫颈鳞癌"},{"mode":"化疗","start":"2026-07-10","end":"","plan":"顺铂 + 紫杉醇（辅助化疗）","note":"第 2/6 周期中"}],markerDate:'2026-06-05',recistDate:'2026-08-20',ecogDate:'2026-08-20',metaProgress:'无',diseaseProgress:false},
{id:'TE011',reportCardNo:'JX-2026-000589',patient:'赵梅英',sex:'女',age:59,idNo:'360200196602056578',region:'鹰潭市月湖区',city:'鹰潭市',insurance:'职工医保',firstHosp:'月湖区交通街道社区卫生服务中心',firstDate:'2026-05-18',hospital:'鹰潭市人民医院',
 site:'结直肠',laterality:'乙状结肠',path:'腺癌',grade:'中分化',tNm:'cT3N1M0',stage:'III期',stageDate:'2026-05-22',multiPrimary:false,
 treatMode:['手术','化疗'],mdt:false,
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-09-01',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'缺铁性贫血、结肠息肉切除史',smoke:'不吸烟',drink:'不饮酒',family:'母亲患结直肠癌',diagBasis:'结肠镜 + 活检病理 + 腹盆腔 CT 分期',diagDate:'2026-05-22',tConfirm:'2026-05-22',metastasis:'区域淋巴结转移',treatMode:['手术','化疗'],referral:true,curPhase:'术后随访中',phaseTimeline:'手术(2026-06-01)→辅助化疗完成(2026-08-28)→术后随访中',tFirst:'2026-05-18',tTreat:'2026-06-01',admCount:3,admDays:15,marker:'MSI-H（dMMR）；RAS/BRAF 野生型；CEA 6.2',recurrence:false,recist:'CR',screenType:"结直肠癌筛查（结肠镜）",screenDate:"2026-05-10",screenResult:"乙状结肠环周占位",screenOrg:'月湖区交通街道社区卫生服务中心',screenAdvice:"建议活检明确病理",treatments:[{"mode":"手术","date":"2026-06-01","end":"2026-06-10","plan":"腹腔镜乙状结肠癌根治术","note":"术后病理腺癌 T3"},{"mode":"化疗","start":"2026-06-28","end":"2026-08-28","plan":"XELOX 方案（辅助化疗 4 周期）","note":"辅助化疗已完成"}],markerDate:'2026-05-22',recistDate:'2026-09-01',ecogDate:'2026-09-01',metaProgress:'无',diseaseProgress:false},
{id:'TE012',reportCardNo:'JX-2026-000634',patient:'章含韵',sex:'女',age:45,idNo:'360502198301125628',region:'新余市渝水区',city:'新余市',insurance:'职工医保',firstHosp:'渝水区城北街道社区卫生服务中心',firstDate:'2026-06-08',hospital:'新余市人民医院',
 site:'乳腺',laterality:'左乳',path:'浸润性导管癌',grade:'II级',tNm:'cT1N0M0',stage:'I期',stageDate:'2026-06-12',multiPrimary:false,
 treatMode:['手术','放疗'],mdt:false,
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-06-21',followStatus:'失访',vitalStatus:'失访',deathCause:'',lostFollow:true,pastHistory:'无特殊既往史',smoke:'不吸烟',drink:'不饮酒',family:'无肿瘤家族史',diagBasis:'钼靶/彩超 + 穿刺病理 + 免疫组化',diagDate:'2026-06-12',tConfirm:'2026-06-12',metastasis:'无',treatMode:['手术'],referral:false,curPhase:'术后随访中',phaseTimeline:'手术(2026-06-20)→术后随访中',tFirst:'2026-06-08',tTreat:'2026-06-20',admCount:2,admDays:9,marker:'ER 90%(+)；PR 85%(+)；HER2 阴性；Ki-67 10%；Luminal A 型',recurrence:false,recist:'SD',screenType:"两癌筛查（乳腺超声）",screenDate:"2026-06-05",screenResult:"左乳结节 1.4cm，BI-RADS 5",screenOrg:'渝水区城北街道社区卫生服务中心',screenAdvice:"建议空芯针穿刺活检",treatments:[{"mode":"手术","date":"2026-06-20","end":"2026-06-26","plan":"左乳保乳手术 + 前哨淋巴结活检","note":"术后放疗计划因失访未执行"}],markerDate:'2026-06-12',recistDate:'2026-06-21',ecogDate:'2026-06-08',metaProgress:'无',diseaseProgress:false},
{id:'TE013',reportCardNo:'JX-2024-001127',patient:'陈爱国',sex:'男',age:78,idNo:'360103194805121237',region:'南昌市西湖区',city:'南昌市',insurance:'职工医保',firstHosp:'浙江大学医学院附属第一医院',provOut:true,firstDate:'2024-12-15',hospital:'南昌市第一医院',
 site:'肝',laterality:'右肝后叶',path:'肝细胞癌',grade:'中分化',tNm:'pT3N0M0',stage:'III期',stageDate:'2024-12-20',multiPrimary:false,
 treatMode:['手术'],mdt:false,
 symptom:'无',pain:'无痛',nutrition:'未填',physical:'ECOG 1',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-06-10',deathDate:'2026-06-10',followStatus:'死亡结案',vitalStatus:'死亡',deathCause:'肝功能衰竭',lostFollow:false,pastHistory:'乙型肝炎 30 年、肝硬化 10 年',smoke:'已戒烟 15 年',drink:'已戒酒 15 年',family:'弟弟患肝癌',diagBasis:'外院 MRI + 术后病理（外省手术）',diagDate:'2024-12-20',tConfirm:'2024-12-20',metastasis:'无远处转移',treatMode:['手术'],referral:true,curPhase:'术后随访中',phaseTimeline:'外省手术(2024-12-28)→回赣随访',tFirst:'2024-12-15',tTreat:'2024-12-28',admCount:6,admDays:38,marker:'AFP 268；HBsAg 阳性；术后病理 MVI M1',recurrence:false,recist:'PD',screenType:"肝癌高危人群筛查（超声 + AFP）",screenDate:"2024-11-28",screenResult:"右肝后叶占位 6.1cm",screenOrg:'西湖区桃源街道社区卫生服务中心',screenAdvice:"建议增强 MRI 明确诊断并评估手术",treatments:[{"mode":"手术","date":"2024-12-28","end":"2025-01-08","plan":"右肝后叶切除术（外省）","note":"术后病理肝细胞癌，MVI M0"}],markerDate:'2024-12-20',recistDate:'2026-05-20',ecogDate:'2026-06-10',metaProgress:'无',diseaseProgress:false}
];

/* 检查检验记录（按患者ID）。检查=所见+结论；检验=明细指标（↑↓+ 异常标红） */
var SP_EXAMS={
TE001:[
 {d:'2026-01-19',k:'检查',n:'胸部DR',org:'东湖区董家窑街道社区卫生服务中心',r:'右上肺结节样影，建议CT进一步明确',rid:'EX-CX20260119',dept:'全科医学科',dr:'社区全科医生',recog:'1',tech:'张海燕',review:'王军',purpose:'筛查发现右上肺结节，明确病变性质',body:'右肺上野',method:'数字X线摄影（正侧位）',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,
  j:'两肺纹理增粗，右上肺野近锁骨下区见约3.2cm×2.7cm结节样密度增高影，边界欠清；心影大致正常，肋膈角锐利。',
  y:'右上肺结节影，性质待定，建议胸部增强CT检查。'},
 {d:'2026-01-28',k:'检查',n:'胸部CT增强',org:'南昌市第一医院',r:'右上肺占位考虑恶性；右肺门及纵隔淋巴结转移',rid:'EX-20260128',dept:'肿瘤科',dr:'刘志远',recog:'1',tech:'张海燕',review:'王军',purpose:'明确结节性质及纵隔淋巴结分期',body:'右肺',method:'平扫+增强扫描',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'右上叶后段见约3.4cm×2.8cm不规则软组织密度影，分叶伴毛刺，不均匀强化；右肺门及4R、7组淋巴结增大，短径最大1.6cm；胸膜未见种植结节，双侧肾上腺及骨质未见异常。',
  y:'右上肺占位，考虑周围型肺癌；右肺门及纵隔淋巴结转移（cN2）；未见明确远处转移。'},
 {d:'2026-02-02',k:'检验',n:'CT引导经皮肺穿刺·病理',org:'南昌市第一医院',r:'浸润性腺癌（中分化），EGFR 19del阳性',rid:'IN-20260202',dept:'肿瘤科',dr:'刘志远',recog:'1',tech:'张海燕',sno:'JY20260202',review:'王军',remark:'结果无危急值',abn:true,hot:true,
  j:'大体：穿刺组织4条，长0.8~1.5cm。镜下：腺癌组织，中分化。',
  y:'（右上肺穿刺）浸润性腺癌，中分化。免疫组化：TTF-1(+)，NapsinA(+)，CK7(+)，Ki-67(约20%+)。基因检测：EGFR 19外显子缺失突变阳性。'},
 {d:'2026-02-03',k:'检验',n:'肿瘤标志物（肺癌组合）',org:'南昌市第一医院',r:'CEA 18.6↑，CYFRA21-1 9.3↑',rid:'IN-20260203',dept:'肿瘤科',dr:'刘志远',recog:'1',tech:'张海燕',sno:'JY20260203',review:'王军',remark:'结果无危急值',abn:true,
  items:[['CEA','18.6','ng/mL','0~5.0','↑'],['CYFRA21-1','9.3','ng/mL','0~3.3','↑'],['NSE','14.1','ng/mL','0~16.3',''],['SCC','1.0','ng/mL','0~1.5',''],['ProGRP','48','pg/mL','0~65','']],
  y:'CEA、CYFRA21-1显著升高，与肺占位性质相符，已留作疗效监测基线。'},
 {d:'2026-06-18',k:'检查',n:'头颅MRI增强+全身骨显像',org:'南昌市第一医院',r:'未见脑转移及骨转移征象（M0）',rid:'EX-20260618',dept:'肿瘤科',dr:'刘志远',recog:'1',tech:'张海燕',review:'王军',purpose:'分期检查，排除脑及骨转移',body:'颅脑,全身骨骼',method:'MRI增强+99mTc-MDP全身骨显像',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:false,hot:true,
  j:'双侧大脑、小脑及脑干未见异常强化灶；静注99mTc-MDP 3小时后全身骨显像未见异常放射性浓聚或稀疏区。',
  y:'未见脑及骨转移征象，完善分期：cT2aN2M0（III期）。'},
 {d:'2026-08-20',k:'检验',n:'血常规+生化（化疗第3周期前）',org:'南昌市第一医院',r:'WBC 3.2↓，PLT 98↓，ALT 56↑，Ⅰ度骨髓抑制',rid:'IN-20260820',dept:'肿瘤科',dr:'刘志远',recog:'1',tech:'张海燕',sno:'JY20260820',review:'王军',remark:'结果无危急值',abn:true,
  items:[['白细胞','3.2','×10⁹/L','3.5~9.5','↓'],['中性粒细胞绝对值','1.6','×10⁹/L','1.8~6.3','↓'],['血红蛋白','118','g/L','130~175','↓'],['血小板','98','×10⁹/L','125~350','↓'],['丙氨酸氨基转移酶','56','U/L','9~50','↑'],['肌酐','68','μmol/L','57~97','']],
  y:'Ⅰ度骨髓抑制伴轻度肝功能损害，予保肝升白治疗后按期进入第3周期辅助化疗。'}],
 TE001B:[
  {d:'2026-09-10',k:'检查',n:'肠镜+活检',org:'东湖区董家窑街道社区卫生服务中心',r:'升结肠隆起型占位 3.0cm；病理：中分化腺癌',rid:'EX-CX20260910',dept:'全科医学科',dr:'社区全科医生',recog:'1',tech:'张海燕',review:'王军',purpose:'肺癌随访期间便潜血阳性，明确病变性质',body:'升结肠',method:'结肠镜检查并活检',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
   j:'进镜至回盲部，升结肠见约3.0cm×2.6cm隆起型占位，表面不平、质脆易出血，肠腔无明显狭窄；活检6块；余结肠未见第二病灶。',
   y:'升结肠占位，活检：中分化腺癌。'},
  {d:'2026-09-15',k:'检验',n:'病理会诊+免疫组化',org:'江西省肿瘤医院',r:'腺癌（中分化）；MLH1/PMS2 缺失，MSI-H',rid:'IN-20260915',dept:'胃肠外科',dr:'黄丽萍',recog:'1',tech:'张海燕',sno:'JY20260915',review:'王军',remark:'结果无危急值',abn:true,hot:true,
   j:'镜下：腺癌组织，中分化，腺体排列紊乱。免疫组化：MLH1(-)，PMS2(-)，MSH2(+)，MSH6(+)，CDX-2(+)。',
   y:'（升结肠）中分化腺癌，MSI-H（dMMR）。结合既往原发性肺癌，符合多原发肿瘤（异时性）。'},
  {d:'2026-09-18',k:'检查',n:'胸腹盆CT增强（分期）',org:'江西省肿瘤医院',r:'升结肠壁增厚，未见远处转移；右肺术后改变',rid:'EX-20260918',dept:'胃肠外科',dr:'黄丽萍',recog:'1',tech:'张海燕',review:'王军',purpose:'结肠癌术前分期，排除远处转移',body:'升结肠,肝,肺',method:'平扫+增强扫描',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:false,hot:true,
   j:'升结肠壁局限性增厚约2.8cm，浆膜面光整；系膜区未见明确肿大淋巴结；肝、双肺未见转移灶，右肺术区未见复发征象。',
   y:'升结肠癌 cT2N0M0（I期），未见远处转移；右肺术后改变，无复发证据。'},
  {d:'2026-10-20',k:'检验',n:'血常规+肿瘤标志物（术后复查）',org:'江西省肿瘤医院',r:'血象正常，CEA 3.1、CA19-9 15.2 均在参考范围',rid:'IN-20261020',dept:'胃肠外科',dr:'黄丽萍',recog:'1',tech:'张海燕',sno:'JY20261020',review:'王军',remark:'结果无危急值',abn:false,
   items:[['白细胞','5.2','×10⁹/L','3.5~9.5',''],['血红蛋白','132','g/L','130~175',''],['CEA','3.1','ng/mL','0~5.0',''],['CA19-9','15.2','U/mL','0~27.0','']],
   y:'术后恢复良好，血象与肿瘤标志物正常，按 I 期结肠癌随访计划管理。'}],
TE002:[
 {d:'2026-03-20',k:'检查',n:'乳腺钼靶（双侧）',org:'章贡区南外街道社区卫生服务中心',r:'左乳结节伴簇状钙化，BI-RADS 5',rid:'EX-CX20260320',dept:'全科医学科',dr:'社区全科医生',recog:'1',tech:'张海燕',review:'王军',purpose:'两癌筛查发现左乳结节，明确性质',body:'双侧乳腺',method:'全数字化乳腺X线摄影',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,
  j:'左乳外上象限见约2.5cm×2.0cm高密度结节影，边缘毛刺，伴簇状细小钙化；双乳背景腺体c型。',
  y:'左乳外上象限占位伴簇状钙化，BI-RADS 5，建议穿刺活检。'},
 {d:'2026-03-25',k:'检查',n:'乳腺及腋窝淋巴结彩超',org:'江西省肿瘤医院',r:'左乳实性占位；左腋窝异常淋巴结，考虑转移',rid:'EX-20260325',dept:'乳腺外科',dr:'黄丽萍',recog:'1',tech:'张海燕',review:'王军',purpose:'评估占位性质及腋窝淋巴结状态',body:'左乳,左腋窝',method:'彩色多普勒超声',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'左乳外上象限低回声结节2.6cm×1.9cm，形态不规则、边界毛刺、纵横比>1，CDFI血流2级；左腋窝见4枚皮质增厚淋巴结，最大短径1.4cm。',
  y:'左乳占位 BI-RADS 5；左腋窝淋巴结异常，考虑转移（cN1）。'},
 {d:'2026-03-27',k:'检验',n:'左乳肿块空芯针穿刺·病理',org:'江西省肿瘤医院',r:'浸润性导管癌（II级），Luminal B型（HER2阴性）',rid:'IN-20260327',dept:'乳腺外科',dr:'黄丽萍',recog:'1',tech:'张海燕',sno:'JY20260327',review:'王军',remark:'结果无危急值',abn:true,hot:true,
  j:'大体：穿刺组织6条。镜下：浸润性导管癌，II级。',
  y:'（左乳）浸润性导管癌，II级。ER(约80%+)，PR(约60%+)，HER2(2+，FISH阴性)，Ki-67(约15%+)。分子分型：Luminal B型（HER2阴性）。'},
 {d:'2026-08-22',k:'检验',n:'血常规+肿瘤标志物（化疗结束后）',org:'江西省肿瘤医院',r:'血象恢复，CA15-3、CEA均在参考范围内',rid:'IN-20260822',dept:'乳腺外科',dr:'黄丽萍',recog:'1',tech:'张海燕',sno:'JY20260822',review:'王军',remark:'结果无危急值',abn:false,
  items:[['白细胞','4.3','×10⁹/L','3.5~9.5',''],['中性粒细胞绝对值','2.4','×10⁹/L','1.8~6.3',''],['CA15-3','18.6','U/mL','0~25.0',''],['CEA','3.2','ng/mL','0~5.0','']],
  y:'化疗结束后血象恢复，肿瘤标志物正常，进入内分泌维持治疗阶段。'}],
TE003:[
 {d:'2026-07-09',k:'检查',n:'胃镜+活检',org:'九江市第一人民医院',r:'胃窦溃疡浸润型占位；病理：低分化腺癌',rid:'EX-20260709',dept:'消化内科',dr:'郑海涛',recog:'1',tech:'张海燕',review:'王军',purpose:'上腹隐痛伴纳差，明确胃部病变病理',body:'胃窦',method:'内镜下活检',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'胃窦见约4.5cm×3.8cm不规则溃疡型病变，覆白苔，边缘堤样隆起，质脆易出血，幽门变形、腔隙狭窄，活检6块。',
  y:'胃窦占位（溃疡浸润型），活检：低分化腺癌。'},
 {d:'2026-07-10',k:'检查',n:'全腹CT增强（分期）',org:'九江市第一人民医院',r:'胃窦壁增厚；腹膜多发结节伴少量腹水，考虑腹膜转移',rid:'EX-20260710',dept:'消化内科',dr:'郑海涛',recog:'1',tech:'张海燕',review:'王军',purpose:'胃癌术前分期评估',body:'上腹部,盆腔',method:'平扫+增强扫描',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'胃窦壁不均匀增厚最厚约2.1cm，浆膜面模糊；大网膜及腹膜见多发结节样增厚，最大1.2cm；盆腔少量积液；肝脾未见占位，腹膜后未见明显肿大淋巴结。',
  y:'胃窦癌伴腹膜多发转移、少量腹水，分期cT4aN2M1（IV期）。'},
 {d:'2026-07-11',k:'检验',n:'肿瘤标志物组合',org:'九江市第一人民医院',r:'CEA 46.2↑，CA19-9 385.6↑',rid:'IN-20260711',dept:'消化内科',dr:'郑海涛',recog:'1',tech:'张海燕',sno:'JY20260711',review:'王军',remark:'结果无危急值',abn:true,
  items:[['CEA','46.2','ng/mL','0~5.0','↑'],['CA19-9','385.6','U/mL','0~27.0','↑'],['CA72-4','41.2','U/mL','0~6.9','↑'],['AFP','3.8','ng/mL','0~7.0','']],
  y:'CEA、CA19-9显著升高，作为姑息化疗疗效监测基线。'},
 {d:'2026-08-24',k:'检验',n:'血常规+生化（姑息化疗第3周期前）',org:'九江市第一人民医院',r:'Hb 92↓，Alb 31.2↓，中度贫血伴低蛋白血症',rid:'IN-20260824',dept:'消化内科',dr:'郑海涛',recog:'1',tech:'张海燕',sno:'JY20260824',review:'王军',remark:'结果无危急值',abn:true,
  items:[['血红蛋白','92','g/L','130~175','↓'],['白蛋白','31.2','g/L','40.0~55.0','↓'],['前白蛋白','128','mg/L','200~430','↓'],['钾','3.6','mmol/L','3.5~5.3',''],['肌酐','64','μmol/L','57~97','']],
  y:'肿瘤消耗合并不全肠梗阻摄入不足，中度贫血、低蛋白血症，NRS2002评分4分，加强肠外营养支持。'}],
TE004:[
 {d:'2026-02-18',k:'检查',n:'上腹部MRI增强（肝胆特异对比剂）',org:'上饶市肿瘤医院',r:'右肝后叶占位5.2cm，快进快出，考虑肝细胞癌',rid:'EX-20260218',dept:'肝胆外科',dr:'方国安',recog:'1',tech:'张海燕',review:'王军',purpose:'肝占位定性及可切除性评估',body:'肝右叶',method:'MRI动态增强',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'肝右叶后段(S6/7)见约5.2cm×4.6cm类圆形异常信号，T1WI稍低、T2WI稍高，动脉期明显不均匀强化，门脉期廓清，DWI受限；余肝信号不均提示肝纤维化；未见子灶及门脉癌栓。',
  y:'右肝后叶占位符合肝细胞癌（LI-RADS 5）；肝硬化背景；未见肝内子灶及血管侵犯。'},
 {d:'2026-02-19',k:'检验',n:'肿瘤标志物+乙肝病毒学+肝功能',org:'上饶市肿瘤医院',r:'AFP 412.5↑↑，HBV-DNA 2.3×10⁴↑，Alb 34.0↓',rid:'IN-20260219',dept:'肝胆外科',dr:'方国安',recog:'1',tech:'张海燕',sno:'JY20260219',review:'王军',remark:'结果无危急值',abn:true,
  items:[['甲胎蛋白(AFP)','412.5','ng/mL','0~7.0','↑'],['异常凝血酶原(DCP)','156','ng/mL','0~40','↑'],['乙肝表面抗原(HBsAg)','阳性','','阴性','+'],['HBV-DNA','2.3×10⁴','IU/mL','低于检测下限','↑'],['白蛋白','34.0','g/L','40.0~55.0','↓'],['总胆红素','18.6','μmol/L','3.4~17.1','↑']],
  y:'AFP、DCP显著升高支持肝癌诊断；HBV复制活跃，已加用恩替卡韦抗病毒；肝功能Child-Pugh A级(6分)。'},
 {d:'2026-03-06',k:'检验',n:'肝部分切除术后·病理',org:'上饶市肿瘤医院',r:'肝细胞癌（中分化），MVI M1，切缘阴性',rid:'IN-20260306',dept:'肝胆外科',dr:'方国安',recog:'1',tech:'张海燕',sno:'JY20260306',review:'王军',remark:'结果无危急值',abn:true,hot:true,
  j:'大体：距肝切缘1.0cm见6.0cm×5.2cm灰红色肿物，质脆。镜下：中分化肝细胞癌，梁索状结构。',
  y:'（右肝）肝细胞癌，中分化，伴微血管侵犯（MVI M1，低危组），切缘阴性，背景肝硬化。术后分期pT3N0M0（III期）。'},
 {d:'2026-07-18',k:'检查',n:'TACE术后CT增强复查',org:'上饶市肿瘤医院',r:'碘油沉积密实，未见活性强化灶，疗效CR',rid:'EX-20260718',dept:'肝胆外科',dr:'方国安',recog:'1',tech:'张海燕',review:'王军',purpose:'TACE术后疗效评估',body:'肝右叶',method:'平扫+增强扫描',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:false,hot:true,
  j:'原S6/7瘤灶区碘油沉积密实，动脉期及门脉期未见异常强化残留灶；余肝脏未见新发占位；无新增腹水。',
  y:'TACE后改变，瘤灶坏死完全（mRECIST CR），继续定期随访。'},
 {d:'2026-07-20',k:'检验',n:'AFP复查',org:'上饶市肿瘤医院',r:'AFP 6.8，降至正常',rid:'IN-20260720',dept:'肝胆外科',dr:'方国安',recog:'1',tech:'张海燕',sno:'JY20260720',review:'王军',remark:'结果无危急值',abn:false,
  items:[['甲胎蛋白(AFP)','6.8','ng/mL','0~7.0',''],['异常凝血酶原(DCP)','38','ng/mL','0~40','']],
  y:'术后联合TACE治疗后AFP降至参考范围内，生化指标有效。'}],
TE005:[
 {d:'2026-04-14',k:'检查',n:'胸部CT增强',org:'宜春市人民医院',r:'左肺下叶占位3.1cm；左肺门淋巴结增大',rid:'EX-20260414',dept:'胸外科',dr:'甘伟民',recog:'1',tech:'张海燕',review:'王军',purpose:'明确结节性质及纵隔淋巴结分期',body:'右肺',method:'平扫+增强扫描',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'左肺下叶背段见约3.1cm×2.6cm类圆形实性占位，边界模糊，中度不均匀强化；左肺门见1.5cm肿大淋巴结，4R组淋巴结增大。',
  y:'左肺下叶占位考虑恶性，伴肺门及纵隔淋巴结转移（cT2bN2M0）。'},
 {d:'2026-04-17',k:'检查',n:'支气管镜+活检',org:'宜春市人民医院',r:'左下叶支气管新生物；病理：鳞状细胞癌',rid:'EX-20260417',dept:'胸外科',dr:'甘伟民',recog:'1',tech:'张海燕',review:'王军',purpose:'获取病理确诊',body:'左肺下叶支气管',method:'支气管镜下活检',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'镜下：左下叶支气管开口见息肉样新生物，表面坏死渗出，管腔狭窄，活检6块。',
  y:'左下叶支气管恶性肿瘤，活检：中分化鳞状细胞癌（p40+，CK5/6+）。'},
 {d:'2026-05-08',k:'检验',n:'术前组合（血象+凝血+标志物）',org:'宜春市人民医院',r:'SCC 6.8↑，CYFRA21-1 8.2↑；血象凝血正常',rid:'IN-20260508',dept:'胸外科',dr:'甘伟民',recog:'1',tech:'张海燕',sno:'JY20260508',review:'王军',remark:'结果无危急值',abn:true,
  items:[['SCC','6.8','ng/mL','0~1.5','↑'],['CYFRA21-1','8.2','ng/mL','0~3.3','↑'],['白细胞','5.8','×10⁹/L','3.5~9.5',''],['血小板','210','×10⁹/L','125~350',''],['凝血四项','未见异常','','','']],
  y:'鳞癌相关标志物升高；术前血象、凝血正常，符合手术条件，2026-05-10行左下叶袖式切除。'},
 {d:'2026-08-28',k:'检验',n:'血常规（同步放化疗第4周期前）',org:'宜春市人民医院',r:'WBC 2.9↓，Hb 108↓，Ⅱ度骨髓抑制',rid:'IN-20260828',dept:'胸外科',dr:'甘伟民',recog:'1',tech:'张海燕',sno:'JY20260828',review:'王军',remark:'结果无危急值',abn:true,
  items:[['白细胞','2.9','×10⁹/L','3.5~9.5','↓'],['中性粒细胞绝对值','1.4','×10⁹/L','1.8~6.3','↓'],['血红蛋白','108','g/L','130~175','↓'],['血小板','112','×10⁹/L','125~350','↓'],['前白蛋白','186','mg/L','200~430','↓']],
  y:'放化疗相关Ⅱ度骨髓抑制，合并Ⅱ度放射性食管炎进食减少，暂停本周期，G-CSF及营养支持后复评。'}],
TE006:[
 {d:'2026-05-06',k:'检验',n:'宫颈癌筛查（TCT+HPV）',org:'珠山区里村街道社区卫生服务中心',r:'TCT示HSIL；HPV16阳性；SCC 9.6↑',rid:'IN-CX20260506',dept:'全科医学科',dr:'社区全科医生',recog:'1',tech:'张海燕',sno:'JY20260506',review:'王军',remark:'结果无危急值',abn:true,hot:true,
  items:[['液基细胞学(TCT)','HSIL（高度鳞状上皮内病变）','','NILM','+'],['高危型HPV','HPV16阳性','','阴性','+'],['SCC','9.6','ng/mL','0~1.5','↑']],
  y:'细胞学HSIL伴HPV16感染、SCC升高，转诊阴道镜下定位活检。'},
 {d:'2026-05-09',k:'检验',n:'阴道镜下宫颈活检·病理',org:'景德镇市第一医院',r:'宫颈鳞状细胞癌（中-低分化）',rid:'IN-20260509',dept:'妇科',dr:'饶慧敏',recog:'1',tech:'张海燕',sno:'JY20260509',review:'王军',remark:'结果无危急值',abn:true,hot:true,
  j:'阴道镜下3、6、9、12点转化区醋酸白试验阳性、碘试验不着色，4点取组织。镜下：鳞状细胞癌，中-低分化。',
  y:'（宫颈）鳞状细胞癌，中-低分化；浸润深度约8mm，未见脉管侵犯。'},
 {d:'2026-05-11',k:'检查',n:'盆腔MRI增强',org:'景德镇市第一医院',r:'宫颈肿物3.6cm累及阴道上1/3；盆腔淋巴结可疑转移',rid:'EX-20260511',dept:'妇科',dr:'饶慧敏',recog:'1',tech:'张海燕',review:'王军',purpose:'宫颈癌分期评估',body:'宫颈,盆腔',method:'MRI动态增强',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'宫颈管内见约3.6cm×3.0cm T2WI稍高信号肿物，向下累及阴道上1/3，未达下1/3，宫旁脂肪间隙清晰；盆腔见2枚短径1.1cm淋巴结。',
  y:'宫颈癌，分期cT2bN1M0（II期）。'},
 {d:'2026-08-25',k:'检验',n:'血常规（放疗中期）',org:'景德镇市第一医院',r:'WBC 3.4↓，Ⅰ度骨髓抑制',rid:'IN-20260825',dept:'妇科',dr:'饶慧敏',recog:'1',tech:'张海燕',sno:'JY20260825',review:'王军',remark:'结果无危急值',abn:true,
  items:[['白细胞','3.4','×10⁹/L','3.5~9.5','↓'],['中性粒细胞绝对值','1.8','×10⁹/L','1.8~6.3',''],['血小板','132','×10⁹/L','125~350',''],['血红蛋白','112','g/L','115~150','↓']],
  y:'放疗期间Ⅰ度骨髓抑制，予升白对症治疗，按计划完成根治性外照射。'}],
TE007:[
 {d:'2026-06-22',k:'检查',n:'结肠镜+活检',org:'南昌市第一医院',r:'距肛门7cm溃疡型占位；病理：直肠腺癌（中分化）',rid:'EX-20260622',dept:'肿瘤科',dr:'刘志远',recog:'1',tech:'张海燕',review:'王军',purpose:'便血伴排便习惯改变，明确病理',body:'直肠',method:'内镜下活检',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'进镜8~10cm于直肠中上段见环腔生长溃疡型占位，表面污秽苔，质脆易出血，肠腔狭窄；活检8块；余结肠未见第二病灶。',
  y:'直肠中上段占位，活检：中分化腺癌。'},
 {d:'2026-06-24',k:'检查',n:'直肠高分辨MRI',org:'南昌市第一医院',r:'肿瘤突破固有肌层（T3），MRF阴性；可疑系膜淋巴结2枚',rid:'EX-20260624',dept:'肿瘤科',dr:'刘志远',recog:'1',tech:'张海燕',review:'王军',purpose:'直肠癌局部分期及环周切缘评估',body:'直肠',method:'高分辨MRI',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'直肠中上段壁不规则增厚并强化，最厚1.6cm，侵及浆膜下脂肪层（T3b）；直肠系膜筋膜(MRF)及脏层腹膜未受累；系膜内2枚形态不规则淋巴结（最大0.9cm）。',
  y:'直肠中分化腺癌 cT3N1M0（III期）；MRF(-)，经MDT讨论直接手术+术后辅助化疗。'},
 {d:'2026-06-25',k:'检验',n:'肿瘤标志物组合',org:'南昌市第一医院',r:'CEA 12.3↑，CA19-9 28.6↑',rid:'IN-20260625',dept:'肿瘤科',dr:'刘志远',recog:'1',tech:'张海燕',sno:'JY20260625',review:'王军',remark:'结果无危急值',abn:true,
  items:[['CEA','12.3','ng/mL','0~5.0','↑'],['CA19-9','28.6','U/mL','0~27.0','↑'],['白细胞','5.4','×10⁹/L','3.5~9.5','']],
  y:'CEA明显升高，留作术后辅助化疗疗效监测基线。'},
 {d:'2026-09-03',k:'检验',n:'血常规+肝肾功能（辅助化疗第2周期前）',org:'南昌市第一医院',r:'血象及肝肾功能正常，按期化疗',rid:'IN-20260903',dept:'肿瘤科',dr:'刘志远',recog:'1',tech:'张海燕',sno:'JY20260903',review:'王军',remark:'结果无危急值',abn:false,
  items:[['白细胞','4.1','×10⁹/L','3.5~9.5',''],['中性粒细胞绝对值','2.6','×10⁹/L','1.8~6.3',''],['血小板','186','×10⁹/L','125~350',''],['丙氨酸氨基转移酶','22','U/L','9~50','']],
  y:'第2周期XELOX方案辅助化疗前评估合格，按期治疗中。'}],
TE008:[
 {d:'2026-07-25',k:'检查',n:'乳腺钼靶（双侧）',org:'临川区青云街道社区卫生服务中心',r:'右乳肿块伴多发钙化，BI-RADS 5',rid:'EX-CX20260725',dept:'全科医学科',dr:'社区全科医生',recog:'1',tech:'张海燕',review:'王军',purpose:'两癌筛查发现左乳结节，明确性质',body:'双侧乳腺',method:'全数字化乳腺X线摄影',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,
  j:'右乳外上象限致密结节约3.0cm×2.4cm，边缘毛刺，伴多发簇状钙化；左乳未见明确病变。',
  y:'右乳占位 BI-RADS 5，建议穿刺活检。'},
 {d:'2026-07-28',k:'检验',n:'右乳肿块空芯针穿刺·病理',org:'江西省肿瘤医院',r:'浸润性导管癌（III级），HER2 3+（HER2过表达型）',rid:'IN-20260728',dept:'乳腺外科',dr:'黄丽萍',recog:'1',tech:'张海燕',sno:'JY20260728',review:'王军',remark:'结果无危急值',abn:true,hot:true,
  j:'大体：穿刺组织5条，部分灰白质硬。镜下：浸润性导管癌，III级，核分裂活跃。',
  y:'（右乳）浸润性导管癌，III级。ER(约10%+)，PR(-)，HER2(3+)，Ki-67(约45%+)。分子分型：HER2过表达型。'},
 {d:'2026-07-28',k:'检查',n:'全身骨显像（ECT）',org:'江西省肿瘤医院',r:'右4-6肋、T12、L3骨转移；肝S7转移灶2.1cm',rid:'EX-20260728',dept:'乳腺外科',dr:'黄丽萍',recog:'1',tech:'张海燕',review:'王军',purpose:'骨转移评估',body:'全身骨骼,上腹部',method:'99mTc-MDP全身骨显像',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'ECT：右侧第4~6肋骨、T12及L3椎体见异常放射性浓聚。CT：肝S7见约2.1cm×1.8cm低密度灶，动脉期边缘轻度强化，延迟期近等密度，考虑转移；双肺未见明确结节。',
  y:'乳腺癌伴多发骨转移、肝转移，分期cT2N2M1（IV期）。'},
 {d:'2026-08-10',k:'检查',n:'心脏彩超（曲妥珠单抗基线）',org:'江西省肿瘤医院',r:'LVEF 58%，心功能正常',rid:'EX-20260810',dept:'乳腺外科',dr:'黄丽萍',recog:'1',tech:'张海燕',review:'王军',purpose:'抗HER2治疗前心功能基线评估',body:'心脏',method:'经胸超声心动图',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:false,hot:true,
  j:'各房室腔不大，二尖瓣轻度反流，LVEF 58%。',
  y:'基线心功能正常（LVEF≥50%），可启动抗HER2靶向治疗，每3个月复查心功能。'},
 {d:'2026-09-01',k:'检查',n:'胸腹盆CT（疗效再评价）',org:'江西省肿瘤医院',r:'原发灶及肝转移灶缩小，疗效评价PR',rid:'EX-20260901',dept:'乳腺外科',dr:'黄丽萍',recog:'1',tech:'张海燕',review:'王军',purpose:'靶向治疗疗效评价',body:'右乳,肝,盆腔',method:'平扫+增强扫描',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:false,hot:true,
  j:'右乳原发灶2.2cm×1.6cm（缩小约30%），肝S7病灶1.3cm（缩小约40%）；未见新发转移；骨转移灶范围无扩大。',
  y:'一线化疗+抗HER2靶向2周期，疗效评价部分缓解（PR），维持原方案。'}],
TE009:[
 {d:'2026-08-02',k:'检查',n:'上消化道钡餐',org:'吉安市中心医院',r:'食管中段狭窄伴6cm充盈缺损，考虑恶性',rid:'EX-20260802',dept:'胸外科',dr:'欧阳锋',recog:'1',tech:'张海燕',review:'王军',purpose:'吞咽梗阻病因评估',body:'食管胸中段',method:'气钡双重造影',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,
  j:'胸中段食管局限性狭窄，管壁僵硬，见约6cm不规则充盈缺损，黏膜破坏中断，近端食管轻度扩张。',
  y:'胸中段食管占位性病变伴狭窄，考虑食管癌。'},
 {d:'2026-08-05',k:'检查',n:'胃镜+活检',org:'吉安市中心医院',r:'胸中段食管缩窄型新生物；病理：鳞状细胞癌',rid:'EX-20260805',dept:'胸外科',dr:'欧阳锋',recog:'1',tech:'张海燕',review:'王军',purpose:'上腹隐痛伴纳差，明确胃部病变病理',body:'胃窦',method:'内镜下活检',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'距门齿26~32cm见环周生长缩窄型新生物，表面溃烂覆白苔，管腔狭窄，镜身勉强通过；活检8块。',
  y:'胸中段食管鳞状细胞癌，中分化。'},
 {d:'2026-08-07',k:'检查',n:'胸部CT增强（分期）',org:'吉安市中心医院',r:'食管中段壁增厚1.8cm；隆突下淋巴结转移；无远处转移',rid:'EX-20260807',dept:'胸外科',dr:'欧阳锋',recog:'1',tech:'张海燕',review:'王军',purpose:'食管癌分期评估',body:'食管,纵隔',method:'平扫+增强扫描',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'食管胸中段壁不均匀增厚最厚约1.8cm，与气管膜部脂肪间隙变窄但未见明确侵犯；隆突下及下段食管旁2枚短径1.3cm淋巴结；肝、肺、骨未见转移征象。',
  y:'食管中段癌 cT3N1M0（III期），无手术指征，MDT建议根治性同步放化疗。'},
 {d:'2026-09-06',k:'检验',n:'血常规+生化（同步放化疗第3周期）',org:'吉安市中心医院',r:'WBC 3.5↓，前白蛋白118↓，Ⅰ度骨髓抑制伴中度营养风险',rid:'IN-20260906',dept:'胸外科',dr:'欧阳锋',recog:'1',tech:'张海燕',sno:'JY20260906',review:'王军',remark:'结果无危急值',abn:true,
  items:[['白细胞','3.5','×10⁹/L','3.5~9.5',''],['中性粒细胞绝对值','1.8','×10⁹/L','1.8~6.3',''],['前白蛋白','118','mg/L','200~430','↓'],['白蛋白','34.8','g/L','40.0~55.0','↓']],
  y:'Ⅱ度放射性食管炎伴经口摄入下降，中度营养风险，留置鼻饲管行肠内营养，同步放化疗继续。'}],
TE010:[
 {d:'2026-06-01',k:'检验',n:'宫颈癌筛查（TCT+HPV）',org:'临川区青云街道社区卫生服务中心',r:'TCT示ASC-H；HPV18阳性；SCC 7.4↑',rid:'IN-CX20260601',dept:'全科医学科',dr:'社区全科医生',recog:'1',tech:'张海燕',sno:'JY20260601',review:'王军',remark:'结果无危急值',abn:true,
  items:[['液基细胞学(TCT)','ASC-H（不除外高度病变）','','NILM','+'],['高危型HPV','HPV18阳性','','阴性','+'],['SCC','7.4','ng/mL','0~1.5','↑']],
  y:'细胞学异常伴HPV18感染、SCC升高，转诊阴道镜下活检。'},
 {d:'2026-06-04',k:'检验',n:'阴道镜下宫颈活检·病理',org:'抚州市第一医院',r:'宫颈鳞状细胞癌（中分化）',rid:'IN-20260604',dept:'妇科',dr:'雷秀英',recog:'1',tech:'张海燕',sno:'JY20260604',review:'王军',remark:'结果无危急值',abn:true,hot:true,
  j:'醋酸白及碘试验不着色区取3点组织。镜下：中分化鳞状细胞癌。',
  y:'（宫颈）中分化鳞状细胞癌，浸润深度约9mm。'},
 {d:'2026-06-05',k:'检查',n:'盆腔MRI增强',org:'抚州市第一医院',r:'宫颈肿物3.8cm累及阴道上1/3；闭孔淋巴结增大',rid:'EX-20260605',dept:'妇科',dr:'雷秀英',recog:'1',tech:'张海燕',review:'王军',purpose:'宫颈癌分期评估',body:'宫颈,盆腔',method:'MRI动态增强',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'宫颈见约3.8cm×3.2cm混杂信号肿物，累及阴道上1/3，右侧闭孔见短径1.2cm淋巴结，宫旁脂肪间隙清楚。',
  y:'宫颈癌 cT2bN1M0（II期）。'},
 {d:'2026-08-15',k:'检验',n:'血常规（辅助化疗第2周期前）',org:'抚州市第一医院',r:'WBC 3.5↓，Ⅰ度骨髓抑制',rid:'IN-20260815',dept:'妇科',dr:'雷秀英',recog:'1',tech:'张海燕',sno:'JY20260815',review:'王军',remark:'结果无危急值',abn:true,
  items:[['白细胞','3.5','×10⁹/L','3.5~9.5',''],['中性粒细胞绝对值','1.8','×10⁹/L','1.8~6.3',''],['血小板','128','×10⁹/L','125~350','']],
  y:'轻度骨髓抑制，利可君口服对症处理后按期完成第2周期辅助化疗。'}],
TE011:[
 {d:'2026-05-19',k:'检查',n:'结肠镜+活检',org:'鹰潭市人民医院',r:'乙状结肠环周占位；病理：腺癌（中分化）',rid:'EX-20260519',dept:'胃肠外科',dr:'桂建平',recog:'1',tech:'张海燕',review:'王军',purpose:'便血伴排便习惯改变，明确病理',body:'直肠',method:'内镜下活检',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'距肛门25~32cm乙状结肠见环腔生长隆缩型病变，表面溃疡，肠腔狭窄；活检7块；余结直肠未见异常。',
  y:'乙状结肠癌（中分化腺癌）。'},
 {d:'2026-05-21',k:'检查',n:'胸腹盆CT增强（分期）',org:'鹰潭市人民医院',r:'乙状结肠壁增厚（T3）伴肠旁淋巴结；肝肺骨无转移',rid:'EX-20260521',dept:'胃肠外科',dr:'桂建平',recog:'1',tech:'张海燕',review:'王军',purpose:'明确病变性质及范围',body:'检查部位',method:'平扫',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'乙状结肠壁不规则增厚最厚约1.5cm，浆膜面模糊，肠旁脂肪内3枚小淋巴结；肝、双肺、骨骼未见转移征象。',
  y:'乙状结肠癌 cT3N1M0（III期）。'},
 {d:'2026-08-28',k:'检验',n:'辅助化疗结束复查组合',org:'鹰潭市人民医院',r:'CEA 3.2正常，血象肝肾功能正常',rid:'IN-20260828',dept:'胃肠外科',dr:'桂建平',recog:'1',tech:'张海燕',sno:'JY20260828',review:'王军',remark:'结果无危急值',abn:false,
  items:[['CEA','3.2','ng/mL','0~5.0',''],['CA19-9','12.4','U/mL','0~27.0',''],['白细胞','5.2','×10⁹/L','3.5~9.5',''],['血小板','204','×10⁹/L','125~350','']],
  y:'完成全部周期辅助化疗，标志物及血象正常，转入术后随访阶段。'}],
TE012:[
 {d:'2026-06-08',k:'检查',n:'乳腺彩超',org:'渝水区城北街道社区卫生服务中心',r:'左乳结节1.4cm，BI-RADS 5',rid:'EX-CX20260608',dept:'门诊',dr:'社区全科医生',recog:'1',tech:'张海燕',review:'王军',purpose:'明确病变性质及范围',body:'检查部位',method:'平扫',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,
  j:'左乳外上象限低回声结节1.4cm×1.0cm，形态不规则、边界毛刺，后方回声轻度衰减，血流2级。',
  y:'左乳结节 BI-RADS 5，建议穿刺活检。'},
 {d:'2026-06-12',k:'检验',n:'左乳结节穿刺·病理',org:'新余市人民医院',r:'浸润性导管癌（II级），Luminal A样',rid:'IN-20260612',dept:'乳腺外科',dr:'章明华',recog:'1',tech:'张海燕',sno:'JY20260612',review:'王军',remark:'结果无危急值',abn:true,hot:true,
  j:'大体：穿刺组织4条。镜下：浸润性导管癌，II级。',
  y:'（左乳）浸润性导管癌，II级。ER(约90%+)，PR(约70%+)，HER2(1-)，Ki-67(约10%+)。'},
 {d:'2026-06-18',k:'检验',n:'术前血常规+凝血',org:'新余市人民医院',r:'术前评估未见异常',rid:'IN-20260618',dept:'乳腺外科',dr:'章明华',recog:'1',tech:'张海燕',sno:'JY20260618',review:'王军',remark:'结果无危急值',abn:false,
  items:[['白细胞','5.6','×10⁹/L','3.5~9.5',''],['血红蛋白','124','g/L','115~150',''],['血小板','226','×10⁹/L','125~350',''],['凝血四项','未见异常','','','']],
  y:'术前评估合格，2026-06-20行保乳手术+前哨淋巴结活检。术后计划复查未见记录。'}],
TE013:[
 {d:'2024-12-18',k:'检查',n:'肝脏MRI增强',org:'浙江大学医学院附属第一医院',r:'右肝后叶占位6.1cm，快进快出，考虑肝细胞癌',rid:'EX-20241218',dept:'肝胆胰外科',dr:'徐正宇',recog:'1',tech:'张海燕',review:'王军',purpose:'肝占位定性及分期',body:'肝右叶',method:'MRI动态增强',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,hot:true,
  j:'肝右叶后段(S7)见约6.1cm×5.6cm肿物，动脉期明显强化、门脉期廓清伴假包膜强化；肝硬化背景、脾大；未见肝内播散及血管侵犯征象。',
  y:'右肝占位符合肝细胞癌（BCLC A期）；肝硬化、脾大。'},
 {d:'2025-01-06',k:'检验',n:'外省术后病理（转档）',org:'浙江大学医学院附属第一医院',r:'肝细胞癌（中分化），MVI M0，切缘阴性',rid:'IN-20250106',dept:'肝胆胰外科',dr:'徐正宇',recog:'1',tech:'张海燕',sno:'JY20250106',review:'王军',remark:'结果无危急值',abn:true,hot:true,
  j:'大体：右肝叶切除标本，肿物6.3cm。镜下：中分化肝细胞癌。',
  y:'（右肝）肝细胞癌，中分化，MVI M0，切缘1.2cm阴性；背景小结节型肝硬化。'},
 {d:'2026-05-28',k:'检验',n:'肝功能+肿瘤标志物（回赣随访）',org:'南昌市第一医院',r:'TBil 86.4↑，Alb 26.0↓，INR 1.6↑，肝功能失代偿',rid:'IN-20260528',dept:'肿瘤科',dr:'刘志远',recog:'1',tech:'张海燕',sno:'JY20260528',review:'王军',remark:'结果无危急值',abn:true,hot:true,
  items:[['总胆红素','86.4','μmol/L','3.4~17.1','↑'],['直接胆红素','42.1','μmol/L','0~6.8','↑'],['白蛋白','26.0','g/L','40.0~55.0','↓'],['INR','1.6','','0.8~1.2','↑'],['甲胎蛋白(AFP)','58.2','ng/mL','0~7.0','↑'],['血红蛋白','98','g/L','130~175','↓']],
  y:'未见肿瘤复发证据，但肝硬化基础致肝功能进行性恶化，Child-Pugh C级，反复腹水及消化道出血，对症保肝治疗。'},
 {d:'2026-06-05',k:'检查',n:'腹部彩超',org:'南昌市第一医院',r:'肝硬化失代偿：中量腹水、脾大、门脉高压',rid:'EX-20260605',dept:'肿瘤科',dr:'刘志远',recog:'1',tech:'张海燕',review:'王军',purpose:'肝硬化及腹水评估',body:'肝,脾,腹腔',method:'彩色多普勒超声',rmk:'影像资料按省影像云规范上传，报告经审核签发',abn:true,
  j:'肝脏表面不光滑，回声增粗不均，未见明确占位；腹腔中量液性暗区；脾厚5.8cm，门静脉主干内径1.7cm。',
  y:'肝硬化失代偿期、脾大、门静脉高压、中量腹水。（2026-06-10 患者死于肝功能衰竭）'}]
};
/* 演示数据的治疗执行机构。明确补在每条治疗记录上，不从转诊记录或报告机构推断。 */
var SP_DEMO_TREATMENT_ORGS={
 TE001:['南昌市第一医院','南昌市第一医院'],TE001B:['江西省肿瘤医院'],
 TE002:['江西省肿瘤医院','赣州市人民医院','赣州市人民医院'],TE003:['九江市第一人民医院'],
 TE004:['上饶市肿瘤医院','江西省肿瘤医院'],TE005:['宜春市人民医院','江西省肿瘤医院','江西省肿瘤医院'],
 TE006:['景德镇市第一医院','江西省肿瘤医院'],TE007:['南昌市第一医院','萍乡市人民医院'],
 TE008:['江西省肿瘤医院','江西省肿瘤医院'],TE009:['吉安市中心医院','吉安市中心医院'],
 TE010:['抚州市第一医院','江西省肿瘤医院'],TE011:['鹰潭市人民医院','鹰潭市人民医院'],
 TE012:['新余市人民医院'],TE013:['浙江大学医学院附属第一医院']
};
tumorEvents.forEach(function(e){
 (e.treatments||[]).forEach(function(t,i){
  t.hospital=SP_DEMO_TREATMENT_ORGS[e.id][i];t.recordId=e.id+'-TX-'+(i+1);t.source='治疗执行记录（示例）';
 });
});
/* 分次执行记录展示 A→B→A；与疗程起止记录分别保留，按实际执行日排序。 */
tumorEvents[0].treatmentVisits=[
 {recordId:'TE001-EXEC-2',date:'2026-04-01',hospital:'江西省肿瘤医院',mode:'化疗',plan:'辅助化疗第2次执行',source:'治疗执行记录（示例）'},
 {recordId:'TE001-EXEC-3',date:'2026-05-04',hospital:'南昌市第一医院',mode:'化疗',plan:'辅助化疗第3次执行',source:'治疗执行记录（示例）'},
 {recordId:'TE001-EXEC-4',date:'2026-06-20',hospital:'南昌市第一医院',mode:'化疗',plan:'辅助化疗第4次执行',source:'治疗执行记录（示例）'}
];
/* 费用分析由 SPCost 提供，演示与真实接入状态明确区分。 */

/* ===================== 二、工具与聚合引擎 ===================== */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function badge(text,cls){return '<span class="badge '+(cls||'badge-neutral')+'">'+esc(text)+'</span>'}
function spToday(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function spDate(v){
  var s=String(v||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
  var n=Date.parse(s+'T00:00:00Z');
  return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?s:null;
}
function spKnown(v){return v!==null&&v!==undefined&&String(v).trim()!==''&&!/^(未填|不详|未知|未记录|unknown)$/i.test(String(v).trim())}
function spBool(v){
  if(v===true||v===1||v==='1'||v==='是'||v==='有'||v==='true')return true;
  if(v===false||v===0||v==='0'||v==='否'||v==='无'||v==='false')return false;
  return null;
}
function spCutoff(){return (_spSub!=='overview'&&!_wbOverviewSelection)?spToday():(spDate(_spScope&&_spScope.cutoff)||spToday())}
function spDiagnosisDate(e){return spDate(e.diagDate)||spDate(e.tConfirm)}
var _spAnonymousKeys=new WeakMap(),_spAnonymousIndex=0;
function spAnonymousKey(e){
  if(!_spAnonymousKeys.has(e))_spAnonymousKeys.set(e,'anonymous:'+ ++_spAnonymousIndex);
  return _spAnonymousKeys.get(e);
}
function spPatientKey(e){
  return String([e.empi,e.patientId,e.idNo].find(spKnown)||('record:'+(spKnown(e.id)?e.id:spAnonymousKey(e))));
}
function spTumorKey(e){return spPatientKey(e)+'|'+String([e.tumorId,e.id].find(spKnown)||spAnonymousKey(e))}
/* 报告卡编号：一个瘤例对应一张登记报告卡（同一患者多原发按瘤例分别编号），
   列表首列用它做跳转详情的主键；数据侧未登记时显示「—」，不臆造编号 */
function spReportCardNo(e){return e&&spKnown(e.reportCardNo)?String(e.reportCardNo).trim():'—'}

/* ==================== 就诊机构（患者层面合并 + 悬浮展开全部） ====================
   一个患者可能在多家医院登记/就诊（多原发在不同医院确诊、外省术后转回、转诊链），
   列表只显示「主机构 + 等 N 家」，鼠标悬浮时用浮层列出全部机构。
   口径：只统计医院（名称含「医院」），社区卫生服务中心/卫生院等基层首诊机构不混进来，
   避免几乎每个患者都变成「等 2 家」而失去信息量。 */
function spIsHospitalOrg(name){
  var s=String(name==null?'':name).trim();
  return !!s&&/医院/.test(s)&&!/卫生院|社区卫生服务中心|社区卫生服务站|疾病预防控制|疾控/.test(s);
}
/* 机构名归一：去掉结尾的省份括注（「浙江大学医学院附属第一医院（浙江省）」→「…第一医院」），
   否则同一家医院在首诊机构与转诊记录里写法不同，会被当成两家 */
function spNormHospital(name){
  return String(name==null?'':name).trim().replace(/[（(](?:[^（）()]*省|北京市|天津市|上海市|重庆市)[）)]\s*$/,'');
}
/* 患者全部就诊医院：当前瘤例的报告机构排第一，再按瘤例/转诊顺序补齐 */
function spPatientHospitals(e){
  var out=[],add=function(h){
    var s=spNormHospital(h);
    if(!spIsHospitalOrg(s)||out.indexOf(s)>=0)return;
    out.push(s);
  };
  add(e&&spRecordValue(e,'hospital',['hospitalDate']));
  spPatientTumors(e).forEach(function(t){
    add(spRecordValue(t,'hospital',['hospitalDate']));add(spRecordValue(t,'firstHosp',['firstDate']));
    spTreatmentEntries(t).forEach(function(r){add(r.hospital)});
  });
  return out;
}
/* 单元格/键值共用：单家直接显示；多家显示「主机构 + 等 N 家」并挂悬浮浮层 */
function spHospSpan(e){
  var list=spPatientHospitals(e);
  if(!list.length)return '—';
  if(list.length===1)return esc(list[0]);
  return '<span class="sp-hosp" data-sp-hosp="'+esc(list.join('|'))+'" onmouseenter="window._spHospTipShow(this)" onmouseleave="window._spHospTipHide()">'+
    esc(list[0])+'<em class="sp-hosp-more">等'+list.length+'家</em></span>';
}
var _spHospTipEl=null;
function spHospTipEl(){
  if(!_spHospTipEl){
    _spHospTipEl=document.createElement('div');
    _spHospTipEl.className='sp-hosp-tip';
    document.body.appendChild(_spHospTipEl);
  }
  return _spHospTipEl;
}
window._spHospTipShow=function(el){
  var list=String(el.getAttribute('data-sp-hosp')||'').split('|').filter(Boolean);
  if(!list.length)return;
  var tip=spHospTipEl();
  tip.innerHTML='<div class="sp-hosp-tip-t">就诊机构 · 共 '+list.length+' 家</div>'+
    '<ol>'+list.map(function(h){return '<li>'+esc(h)+'</li>'}).join('')+'</ol>';
  tip.style.display='block';
  var r=el.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight;
  var left=Math.max(8,Math.min(r.left,window.innerWidth-tw-12));
  /* 默认挂在元素下方（不遮挡表头），下方放不下再翻到上方 */
  var top=r.bottom+8;
  if(top+th>window.innerHeight-8)top=Math.max(8,r.top-th-8);
  tip.style.left=left+'px';tip.style.top=top+'px';
};
window._spHospTipHide=function(){if(_spHospTipEl)_spHospTipEl.style.display='none'};
function spUpdatedDate(e){return spDate(String(e.updatedAt||'').slice(0,10))}
function spRecordValue(e,key,dateFields){
  var fields=(dateFields||[]).concat(['updatedAt']),dated=fields.find(function(f){return spKnown(e[f])});
  var d=dated?(dated==='updatedAt'?spUpdatedDate(e):spDate(e[dated])):null;
  if(dated&&(!d||d>spCutoff()))return null;
  if(!dated&&spCutoff()<spToday())return null;
  return e[key];
}
function spUnique(list,key){
  var by=new Map();
  (list||[]).forEach(function(e){
    var k=key(e),prev=by.get(k);
    var date=Date.parse(spUpdatedDate(e)?e.updatedAt:spDate(e.lastFu)||spDiagnosisDate(e)||'')||0;
    var old=prev&&(Date.parse(spUpdatedDate(prev)?prev.updatedAt:spDate(prev.lastFu)||spDiagnosisDate(prev)||'')||0);
    if(!prev||date>=old)by.set(k,e);
  });
  return Array.from(by.values());
}
function spPersons(list){return spUnique(list,spPatientKey)}
function spStage(e){
  var v=spRecordValue(e,'stage',['stageDate']);
  if(v===null)return '不详';
  if(spBool(e.stageApplicable)===false||v==='不适用')return '不适用';
  var s=String(v||'').trim().replace(/Ⅳ/g,'IV').replace(/Ⅲ/g,'III').replace(/Ⅱ/g,'II').replace(/Ⅰ/g,'I');
  var m=/^(IV|III|II|I)(?:[ABCabc123]*)期?$/.exec(s);
  return m?m[1]+'期':'不详';
}
function spEarly(e){return spStage(e)==='I期'||spStage(e)==='II期'}
function spLate(e){return spStage(e)==='IV期'}
function spGeoClass(e){
  var hc=SP_HOSP_CITY[spRecordValue(e,'hospital',['hospitalDate'])];
  if(!spKnown(e.city)||!hc)return '不详';
  return hc===e.city?'市域内':'跨市';
}
function spOutCity(e){return spGeoClass(e)==='跨市'}
function spVital(e){
  var cut=spCutoff(),fu=spDate(e.lastFu),death=spDate(e.deathDate),diag=spDiagnosisDate(e);
  if((death&&diag&&death<diag)||(fu&&diag&&fu<diag))return '不详';
  if(death&&death<=cut)return '死亡';
  if((death&&death>cut)||(fu&&fu>cut)||!fu)return '不详';
  var v=String(e.vitalStatus||'').trim();
  if(v==='死亡')return '不详';
  if(v==='存活'||v==='存活（带瘤）')return v;
  return '不详';
}
function spLost(e){
  var d=spDate(e.lostConfirmedDate);
  if(d&&d>spCutoff())return null;
  if(spDate(e.lastFu)&&e.lastFu>spCutoff())return null;
  var b=spBool(spRecordValue(e,'lostFollow',['lostConfirmedDate','lostStatusDate']));
  if(b!==null)return b;
  var status=spRecordValue(e,'followStatus',['lostConfirmedDate','followStatusDate']);
  if(status==='失访')return true;
  if(status==='随访中'||status==='死亡结案')return false;
  return null;
}
function spBirthDate(e){
  var d=spDate(e.birthDate);
  if(d)return d;
  var s=String(e.idNo||'');
  return s.length===18?spDate(s.slice(6,10)+'-'+s.slice(10,12)+'-'+s.slice(12,14)):null;
}
function spAge(e){
  var birth=spBirthDate(e),at=spDiagnosisDate(e);
  if(birth&&at){
    if(birth>at)return null;
    var n=Number(at.slice(0,4))-Number(birth.slice(0,4))-(at.slice(5)<birth.slice(5)?1:0);
    return n>=0&&n<=120?n:null;
  }
  return null;
}
function spMedian(values){
  var a=values.filter(function(v){return typeof v==='number'&&Number.isFinite(v)}).sort(function(x,y){return x-y}),n=a.length;
  return n?(n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2):null;
}
function spPercentile(values,p){
  var a=values.slice().sort(function(x,y){return x-y});
  if(!a.length)return null;
  var i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);
  return a[lo]+(a[hi]-a[lo])*(i-lo);
}
function spTreatmentEntries(e){
  var diagnosis=spDiagnosisDate(e),death=spDate(e.deathDate),cut=spCutoff();
  return (Array.isArray(e.treatments)?e.treatments:[]).concat(Array.isArray(e.treatmentVisits)?e.treatmentVisits:[]).filter(function(t){
    var d=spDate(String(t.executedAt||t.date||t.start||'').slice(0,10));
    return !/^(planned|cancelled|canceled|pending|not_performed|计划|已撤销|未执行)$/.test(t.status||'')&&d&&d<=cut&&(!diagnosis||d>=diagnosis)&&(!death||d<=death);
  });
}
function spTreatmentModes(e){
  var entries=spTreatmentEntries(e);
  var modes=entries.map(function(t){return t.mode});
  if(!Array.isArray(e.treatments)){
    var d=spDate(e.tTreat),diagnosis=spDiagnosisDate(e),death=spDate(e.deathDate);
    if(d&&d<=spCutoff()&&(!diagnosis||d>=diagnosis)&&(!death||d<=death))modes=Array.isArray(e.treatMode)?e.treatMode:[];
  }
  return Array.from(new Set(modes.filter(spKnown))).sort();
}
function spHasMode(e,m){return spTreatmentModes(e).indexOf(m)>=0}
function spInterval(e,from,to){
  var a=from==='diagDate'?spDiagnosisDate(e):spDate(e[from]);
  var b=to==='tTreat'?spFirstTreat(e):(to==='diagDate'?spDiagnosisDate(e):spDate(e[to]));
  if(!a||!b||a>spCutoff()||b>spCutoff())return {value:null,status:'缺失或未到时点'};
  if(b<a)return {value:null,status:'日期冲突'};
  var diag=spDiagnosisDate(e),death=spDate(e.deathDate);
  if(to==='tTreat'&&((diag&&(b<diag||(from==='firstDate'&&a>diag)))||(death&&b>death)))return {value:null,status:'日期冲突'};
  return {value:(Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000,status:'可计算'};
}
function spIntervalStats(list,from,to){
  var rows=list.map(function(e){return spInterval(e,from,to)}),values=rows.map(function(r){return r.value}).filter(function(v){return v!==null});
  return {n:values.length,unknown:list.length-values.length,conflicts:rows.filter(function(r){return r.status==='日期冲突'}).length,
    median:spMedian(values),p75:spPercentile(values,.75),p90:spPercentile(values,.9)};
}
function spMaskIdNo(v){var s=String(v||'');return s.length>=10?s.slice(0,6)+'********'+s.slice(-4):s}
/* EMPI 患者主索引：与登记报告卡口径一致，由身份证号后 8 位推导（不额外采集） */
function spEmpi(e){return 'MPI-'+String(e.idNo||'').slice(-8)}
/* ICD-O-3 部位码 / 形态学码：复用登记报告卡既有推导口径（report-card-detail.js），不额外采集 */
var SP_TOPO_CODE={'肺':'C34.9','支气管':'C34.9','胃':'C16.9','肝':'C22.0','乳腺':'C50.9','乳房':'C50.9','宫颈':'C53.9','结直肠':'C18.9','结肠':'C18.9','直肠':'C20.9','食管':'C15.9','前列腺':'C61','甲状腺':'C73.9'};
var SP_MORPH_CODE={'鳞状细胞癌':'8070/3','腺癌':'8140/3','小细胞癌':'8041/3','浸润性导管癌':'8500/3','导管癌':'8500/3','肝细胞癌':'8170/3'};
/* 「结直肠」是分组癌种，编码要按具体原发部位分流：直肠/肛管 C20，结肠各段 C18。
   原来只按 site 取码，直肠道病例一律给 C18 - 列表把 ICD-10 摆在原发部位旁边后就会露馅。 */
function spTopoCode(e){
  var s=e.site||'',lat=e.laterality||'';
  if(s==='结直肠'||s==='结肠'||s==='直肠'||/直肠|肛管/.test(lat))return /直肠|肛管/.test(lat)||s==='直肠'?'C20.9':'C18.9';
  return SP_TOPO_CODE[s]||'';
}
function spMorphCode(e){
  if(SP_MORPH_CODE[e.path])return SP_MORPH_CODE[e.path];
  if(/腺癌/.test(e.path||''))return '8140/3';
  if(/鳞/.test(e.path||''))return '8070/3';
  if(/癌/.test(e.path||''))return '8000/3';
  return '';
}

/* 瘤种全称：部位 + 病理，仅在病理已含该部位词时去重（肝 + 肝细胞癌 → 肝细胞癌） */function spTumorName(e){
  var s=e.site||'',p=e.path||'';
  if(!s)return p;
  if(!p)return s;
  if(p.indexOf(s)===0)return p;          /* 病理已以部位词开头，直接用病理 */
  if(s.indexOf(p)===0)return s;
  if(/^(原发|继发|转移)/.test(p))return s+p;
  return s+p;
}
/* 治疗方式分项：按画像口径分六类（手术/放疗/化疗/靶向/免疫/内分泌）分别标注
   有 / 明确无 / 未记录——六类独立判定，存在一种不代表其他已开展或未开展；
   「明确无」必须有明确未开展记录（e.modesNotDone），仅有实施记录缺失时只能标「未记录」 */
var SP_MODES=['手术','放疗','化疗','靶向','免疫','内分泌'];
function spModeFlags(e){
  return SP_MODES.map(function(m){
    var state=spModeState(e,m),has=state==='有',no=state==='明确无';
    return '<div class="sp-kv-item sp-inline"><span class="k">'+esc(m)+'</span><span class="v">'+
      (has?badge('有','badge-success'):no?badge('明确无','badge-neutral'):badge(state||'未记录','badge-caution'))+'</span></div>';
  }).join('');
}
function spModeState(e,mode){
  var has=spHasMode(e,mode),no=spRecordValue(e,'modesNotDone',['modesNotDoneDate']);
  no=Array.isArray(no)&&no.indexOf(mode)>=0;
  return has&&no?'记录冲突':has?'有':no?'明确无':null;
}
/* 六类以外的治疗记录（如介入、消融）：按实际记录展示，不并入六类统计 */
function spOtherModes(e){
  return spTreatmentModes(e).filter(function(m){return SP_MODES.indexOf(m)<0});
}
/* 首次治疗日期：取全部治疗明细中最早的起始日 */
function spFirstTreat(e){
  var ds=spTreatmentEntries(e).map(function(t){return spDate(String(t.executedAt||t.date||t.start||'').slice(0,10))}).sort();
  if(Array.isArray(e.treatments)||Array.isArray(e.treatmentVisits))return ds[0]||'';
  var d=spDate(e.tTreat),diag=spDiagnosisDate(e),death=spDate(e.deathDate);
  return d&&d<=spCutoff()&&(!diag||d>=diag)&&(!death||d<=death)?d:'';
}
/* ICD-10：由 ICD-O-3 部位码截取主码（C34.9 → C34），与病案/影像口径一致 */
function spIcd10(e){var c=spTopoCode(e);return c?c.split('.')[0]:''}
/* 筛查参与状态：由筛查时间/方式推导；「未参与」与「不详」严格区分 */
function spScreenStatus(e){
  var participated=spRecordValue(e,'screenParticipated',['screenDate']);
  var type=spRecordValue(e,'screenType',['screenDate']);
  if(spBool(participated)===false)return '未参与';
  if(spBool(participated)===true||(spDate(e.screenDate)&&e.screenDate<=spCutoff())||spKnown(type))return '有筛查记录';
  return '不详';
}
/* 病理类型：去掉与病理名重复的分化描述（如「低分化腺癌（低分化）」→「低分化腺癌」） */
function spPathText(e){
  var p=e.path||'',g=e.grade||'';
  if(!spKnown(p))return '';
  if(!g)return p;
  if(p.indexOf(g)>=0)return p;          /* 病理名已含分化程度，不再追加 */
  if(/^[中低高]分化$/.test(g))return p+(/分化/.test(p)?'':'（'+g+'）');
  return p+'（'+g+'）';
}
/* 诊断依据使用明确记录，不从肿瘤名称或推导编码反推病理证实。 */
function spDiagBasisType(e){
  var type=String(e.diagBasisType||'').trim(),text=String(e.diagBasis||'').trim();
  if(/^(病理学诊断|组织学|细胞学)$/.test(type))return '病理学诊断';
  if(type==='临床诊断')return '临床诊断';
  if(!spKnown(text))return '不详';
  if(/临床诊断/.test(text))return '临床诊断';
  if(/未.*病理|无.*病理|待.*病理/.test(text))return '不详';
  return /病理|活检/.test(text)?'病理学诊断':'临床诊断';
}
/* 分级：取 e.grade（如「中分化」「II级」），作为「临床分期」位置的展示项 */
function spGradeText(e){
  return (e&&e.grade)||'—';
}
/* 生存时间：确诊日期 → 死亡日期（已死亡）或末次随访日期（存活/失访），自动推算，不手工录入 */
function spSurvival(e){
  var start=spDiagnosisDate(e),dead=spVital(e)==='死亡';
  var end=dead?spDate(e.deathDate):spDate(e.lastFu);
  if(!start||!end||start>end||end>spCutoff()||(e.vitalStatus==='死亡'&&!dead))return {text:'—',n:null,alive:null};
  var months=+((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/(86400000*30.44)).toFixed(1);
  return {text:months+' 个月（截至'+(dead?'死亡':'末次随访')+'）',n:months,alive:dead?false:/^存活/.test(spVital(e))?true:null};
}
function spScopeEvents(sc){
  sc=sc||{};
  var cut=spDate(sc.cutoff)||spCutoff();
  var snapshots=tumorEvents.filter(function(e){var updated=spDate(String(e.updatedAt||'').slice(0,10));return !updated||updated<=cut});
  return spUnique(snapshots,spTumorKey).filter(function(e){
    var d=spDiagnosisDate(e);
    if(d&&d>cut)return false;
    if(sc.from&&(!d||d<sc.from))return false;
    if(sc.to&&(!d||d>sc.to))return false;
    if(sc.city&&e.city!==sc.city)return false;
    if(sc.site&&e.site!==sc.site)return false;
    if(sc.hospital&&spPatientHospitals(e).indexOf(spNormHospital(sc.hospital))<0)return false;
    return true;
  });
}
/* V14：详情、总览、证据明细和 CSV 共用字段读取器，不以管理指标名替代记录事实。 */
function spProfileDate(e,key){
  var d=key==='diagDate'?spDiagnosisDate(e):spDate(e[key]);
  return d&&d<=spCutoff()?d:null;
}
function spFollowState(e){
  if(spVital(e)==='死亡')return '死亡结案';
  if(spRecordValue(e,'followStatus',['followStatusDate','lastFu'])==='死亡结案')return null;
  var lost=spLost(e);
  return lost===true?'失访':lost===false?'随访中':null;
}
var SP_PROFILE_FIELDS=[];
function spDefineField(key,label,dim,read,source,rule,unit,kind){
  SP_PROFILE_FIELDS.push({key:key,label:label,dim:dim,read:read,source:source,rule:rule||'按画像同名字段逐条统计；未记录单列',unit:unit||'瘤例',kind:kind||'category'});
}
spDefineField('sex','性别','患者基础',function(e){return /^(男|女)$/.test(e.sex)?e.sex:null},'sex','按患者去重；同一患者多瘤例记录不一致时单列待核对','患者');
spDefineField('age','确诊时年龄','患者基础',spAge,'birthDate / idNo + diagDate','出生日期至当前瘤例确诊日期的周岁；一个患者多个原发可有不同确诊年龄','瘤例','number');
spDefineField('region','户籍地','患者基础',function(e){return e.region},'region','按画像户籍地统计；同一患者多条不同地址不合并为确定值','患者');
spDefineField('hospital','就诊机构','患者基础',function(e){return spPatientHospitals(e)},'hospital / firstHosp + treatments.hospital + treatmentVisits.hospital','与画像列出的全部就诊机构一致；一人可计入多家机构，人数不可相加','患者','multiple');
spDefineField('insurance','医保类型','患者基础',function(e){return e.insurance},'insurance','按患者去重；同一患者不同险种记录单列待核对','患者');
/* 筛查机构取筛查记录本身的实施机构；未记录时不回退到就诊机构，避免把「在哪治病」当成「在哪筛查」 */
spDefineField('screenorg','筛查机构','患者基础',function(e){return spRecordValue(e,'screenOrg',['screenDate'])},'筛查管理数据-筛查记录的医疗机构','与画像筛查记录的实施机构一致；缺失单列未记录，不用就诊机构替代','瘤例');
[['screentype','筛查项目','screenType'],['screendate','筛查时间','screenDate'],['screenresult','筛查结果','screenResult'],['screenadvice','筛查建议','screenAdvice']].forEach(function(f){
  spDefineField(f[0],f[1],'患者基础',function(e){return f[2]==='screenDate'?spProfileDate(e,f[2]):spRecordValue(e,f[2],['screenDate'])},f[2],'与画像筛查记录一致；统计截止日以后的记录不纳入','瘤例',f[2]==='screenDate'?'date':f[0]==='screentype'?'category':'text');
});
spDefineField('site','原发部位','肿瘤特征',function(e){return e.laterality},'laterality','采用画像的具体原发部位；不以癌种分组 site 替代');
spDefineField('path','病理类型','肿瘤特征',spPathText,'path + grade','与画像病理类型展示文本一致；分级另列');
spDefineField('icd10','ICD-10','肿瘤特征',spIcd10,'spIcd10(site, laterality)','沿用画像编码映射结果，不从 TNM 或分级推断');
spDefineField('icdo3topo','ICD-O-3 部位码','肿瘤特征',spTopoCode,'spTopoCode(site, laterality)');
spDefineField('icdo3morph','ICD-O-3 形态码','肿瘤特征',spMorphCode,'spMorphCode(path)');
spDefineField('grade','分级','肿瘤特征',spGradeText,'grade','直接读取分级，与分期期别分别统计');
spDefineField('tnm','TNM','肿瘤特征',function(e){return spBool(e.stageApplicable)===false?'不适用':spRecordValue(e,'tNm',['stageDate'])},'tNm + stageDate','检查 TNM 字段本身是否有记录；不使用分期期别代替 TNM');
spDefineField('stage','分期期别','肿瘤特征',spStage,'stage + stageDate','I / II / III / IV 期为记录构成；不能直接当作早诊率或远处转移率');
spDefineField('diagdate','确诊日期','肿瘤特征',function(e){return spProfileDate(e,'diagDate')},'diagDate / tConfirm',null,'瘤例','date');
spDefineField('diag_basis','诊断依据','肿瘤特征',function(e){return spKnown(spRecordValue(e,'diagBasisType',['diagDate']))||spKnown(spRecordValue(e,'diagBasis',['diagDate']))?spDiagBasisType(e):null},'diagBasisType / diagBasis','明确病理或临床诊断依据的记录构成；不使用推导编码反推病理证实');
spDefineField('tfirst','首次治疗日期','诊疗过程',spFirstTreat,'treatments / treatmentVisits / tTreat','取截止日前实际执行且时序有效的最早治疗日期；排除计划、撤销和未执行记录','瘤例','date');
spDefineField('diag_to_treat','确诊至首次治疗','诊疗过程',function(e){return spInterval(e,'diagDate','tTreat').value},'diagDate + 首次治疗日期','按同一瘤例有效日期相减，单位天；日期缺失或冲突不计入中位数','瘤例','number');
spDefineField('referral','治疗机构变化','诊疗过程',function(e){var r=spInstitutionChanges(e,spCutoff());return r.state===null?null:r.state?'有变化':'未观察到变化'},'患者全部 treatments / treatmentVisits','按患者全部有效治疗的时间序列判断；一人多瘤例仅计一次','患者');
spDefineField('mdt','MDT','诊疗过程',function(e){var b=spBool(spRecordValue(e,'mdt',['mdtRecordedDate','mdtDate']));return b===null?null:b?'已开展':'明确未开展'},'mdt + mdtRecordedDate / mdtDate','区分已开展、明确未开展、未记录；记录构成不替代符合适应证的覆盖率');
SP_MODES.forEach(function(mode,i){spDefineField('mode'+i,mode,'诊疗过程',function(e){return spModeState(e,mode)},'治疗执行记录 + modesNotDone','只依据本项治疗记录：有、明确无、未记录；其他治疗存在不能证明本项未开展')});
spDefineField('vital','生存状态','随访与结局',spVital,'vitalStatus + lastFu + deathDate','按当前瘤例的随访记录统计；失访属于随访状态，不等于死亡');
spDefineField('followstate','随访状态','随访与结局',spFollowState,'followStatus / lostFollow + lastFu + deathDate','将随访状态与生存状态分开；未记录不推断为随访中');
spDefineField('lastfu','末次随访日期','随访与结局',function(e){var d=spProfileDate(e,'lastFu'),diag=spDiagnosisDate(e);return d&&(!diag||d>=diag)?d:null},'lastFu','有效日期不早于当前瘤例确诊日期、不晚于截止日','瘤例','date');
spDefineField('survival','观察时长（推算）','随访与结局',function(e){return spSurvival(e).n},'diagDate + deathDate / lastFu','确诊至死亡或末次随访的月数；不代表 1 / 3 / 5 年生存率','瘤例','number');
function spDeathFieldApplies(e){return spVital(e)==='死亡'||spRecordValue(e,'vitalStatus',['lastFu'])==='死亡'}
spDefineField('deathdate','死亡日期','随访与结局',function(e){return spDeathFieldApplies(e)?spProfileDate(e,'deathDate'):'不适用'},'deathDate','仅对有死亡记录的瘤例适用，日期缺失或冲突单列','瘤例','date');
spDefineField('death','死亡原因','随访与结局',function(e){return spDeathFieldApplies(e)?e.deathCause:'不适用'},'deathCause','仅对有死亡记录的瘤例适用；不详死因保留为缺失','瘤例','text');
/* 分区、详情字段和总览选项集中定义，避免两端各自维护不同字段。 */
var SP_PROFILE_SECTIONS=[
  {key:'burden',label:'患者基础',groups:[
    {keys:['sex','age','region','hospital','insurance']},
    {title:'筛查信息',keys:['screenorg','screentype','screendate','screenresult','screenadvice']}
  ],charts:[
    {keys:['sex','insurance','screentype'],layout:'sp-compact-rounds'},
    {keys:['age','region']},
    {keys:['hospital','screenorg']}
  ],tables:[
    {title:'人口特征',keys:['sex','age','insurance']},
    {title:'地域与就诊',keys:['region','hospital']},
    {title:'筛查分布',keys:['screenorg','screentype']}
  ],records:{title:'筛查记录',keys:['screenorg','screentype','screendate','screenresult','screenadvice']}},
  {key:'tumor',label:'肿瘤特征',groups:[
    {title:'瘤种、分级与分期',keys:['site','path','icd10','icdo3topo','icdo3morph','grade','tnm','stage','diagdate','diag_basis']}
  ],charts:[
    {keys:['stage','grade','diag_basis'],layout:'sp-compact-rounds'},
    {keys:['site','path']}
  ],tables:[
    {title:'分期与诊断',keys:['stage','grade','diag_basis']},
    {title:'肿瘤分布',keys:['site','path']}
  ],records:{title:'分期与编码明细',keys:['tnm','stage','diagdate','icd10','icdo3topo','icdo3morph']}},
  {key:'treat',label:'诊疗过程',groups:[
    {title:'治疗与 MDT',keys:['tfirst','diag_to_treat','mdt']},
    {title:'治疗方式',keys:['mode0','mode1','mode2','mode3','mode4','mode5'],columns:' sp-cols-3'}
  ],charts:[
    {keys:['mdt','referral'],layout:'sp-process-rounds'},
    {kind:'treatment'},
    {keys:['diag_to_treat','tfirst']}
  ],tables:[
    {title:'诊疗协同',keys:['mdt','referral']},
    {title:'治疗方式',kind:'treatment'},
    {title:'治疗时序',keys:['diag_to_treat','tfirst']}
  ]},
  {key:'outcome',label:'随访与结局',groups:[
    {keys:['vital','followstate','lastfu','survival','deathdate','death']}
  ],charts:[
    {keys:['vital','followstate'],layout:'sp-process-rounds'},
    {keys:['lastfu','survival']}
  ],tables:[
    {title:'随访结局',keys:['vital','followstate']},
    {title:'随访时间',keys:['lastfu','survival']}
  ],records:{title:'死亡记录',keys:['deathdate','death'],deathsOnly:true}}
];
function spProfileSection(key){return SP_PROFILE_SECTIONS.find(function(s){return s.key===key})}
function spProfileSectionBody(e,key){
  return spProfileSection(key).groups.map(function(group){return (group.title?spSub(group.title):'')+'<div class="sp-kv-grid'+(group.columns||'')+'">'+group.keys.map(function(k){return spProfileKv(e,k)}).join('')+'</div>'}).join('');
}
function spProfileField(key){return SP_PROFILE_FIELDS.find(function(f){return f.key===key})}
function spProfileRead(e,key){
  var f=spProfileField(key),v=f.read(e);
  var dateKey={screendate:'screenDate',diagdate:'diagDate',lastfu:'lastFu',deathdate:'deathDate'}[key];
  if(dateKey&&spKnown(e[dateKey])&&v!=='不适用'){
    var date=spDate(e[dateKey]),diagnosis=spDiagnosisDate(e);
    if(!date||((key==='lastfu'||key==='deathdate')&&diagnosis&&date<diagnosis))return {value:null,text:'日期冲突',state:'conflict'};
  }
  var missing=v===null||v===undefined||v===''||v==='—'||v==='不详'||v==='未记录'||(Array.isArray(v)&&!v.length)||(!Array.isArray(v)&&!spKnown(v));
  var state=missing?'missing':v==='记录冲突'?'conflict':v==='不适用'?'na':'valid';
  var text=state==='missing'?'未记录':Array.isArray(v)?v.join('、'):String(v);
  if(state==='valid'&&f.kind==='number')text+=key==='age'?' 岁':key==='diag_to_treat'?' 天':' 个月';
  return {value:missing?null:v,text:text,state:state};
}
function spProfileKv(e,key){var f=spProfileField(key),r=spProfileRead(e,key);return '<div class="sp-kv-item sp-inline" data-profile-field="'+key+'"><span class="k">'+f.label+'</span><span class="v">'+esc(r.text)+'</span></div>'}
function spFieldBands(key){
  return key==='age'?['0–39 岁','40–49 岁','50–59 岁','60–69 岁','70 岁及以上']:key==='diag_to_treat'?['0–7 天','8–14 天','15–30 天','超过 30 天']:['不足 6 个月','6–11.9 个月','12–23.9 个月','24 个月及以上'];
}
function spFieldSummary(list,key){
  var f=spProfileField(key),rows=spUnique(list,spTumorKey).map(function(e){return {event:e,events:[e],result:spProfileRead(e,key)}});
  if(f.unit==='患者'){
    var by=new Map();rows.forEach(function(r){var k=spPatientKey(r.event);if(!by.has(k))by.set(k,[]);by.get(k).push(r)});
    rows=Array.from(by.values()).map(function(group){
      var values=Array.from(new Set(group.map(function(r){return JSON.stringify(Array.isArray(r.result.value)?r.result.value.slice().sort():r.result.value)})));
      return {event:group[0].event,events:group.map(function(r){return r.event}),result:values.length>1?{value:null,text:'多瘤例记录不一致',state:'conflict'}:group[0].result};
    });
  }
  var buckets=new Map(),valid=0,missing=0,na=0,conflict=0,numbers=[];
  rows.forEach(function(row){
    var r=row.result;
    if(r.state==='valid')valid++;else if(r.state==='na')na++;else if(r.state==='conflict')conflict++;else missing++;
    if(r.state==='valid'&&f.kind==='number')numbers.push(r.value);
    var labels=r.state!=='valid'?[r.text]:f.kind==='multiple'?r.value:[f.kind==='date'?r.value.slice(0,7):f.kind==='number'?(key==='age'?r.value<40?'0–39 岁':r.value<50?'40–49 岁':r.value<60?'50–59 岁':r.value<70?'60–69 岁':'70 岁及以上':key==='diag_to_treat'?r.value<=7?'0–7 天':r.value<=14?'8–14 天':r.value<=30?'15–30 天':'超过 30 天':r.value<6?'不足 6 个月':r.value<12?'6–11.9 个月':r.value<24?'12–23.9 个月':'24 个月及以上'):r.text];
    row.buckets=labels;
    labels.forEach(function(label){if(!buckets.has(label))buckets.set(label,{label:label,count:0,state:r.state});buckets.get(label).count++});
  });
  var bands=spFieldBands(key);
  return {field:f,rows:rows,total:rows.length,valid:valid,missing:missing,na:na,conflict:conflict,median:spMedian(numbers),buckets:Array.from(buckets.values()).sort(function(a,b){return (a.state==='valid'?0:1)-(b.state==='valid'?0:1)||(f.kind==='date'?a.label.localeCompare(b.label):f.kind==='number'?bands.indexOf(a.label)-bands.indexOf(b.label):b.count-a.count)})};
}
/* ---- 兼容既有指标消费者的字段字典 ----
   label/dim 用于明细表「画像字段」列，src 为该字段在业务系统中的取数来源 ---- */
var SP_PORTRAIT_FIELDS={
 empi:{label:'患者主索引/脱敏身份证',dim:'患者基础',src:'患者主索引'},
 sex:{label:'性别',dim:'患者基础',src:'患者主索引/报告卡'},
 birth:{label:'出生日期（推导确诊时年龄）',dim:'患者基础',src:'患者主索引'},
 region:{label:'户籍地（区县/地市）',dim:'患者基础',src:'报告卡'},
 hospital:{label:'实际就诊医院',dim:'患者基础',src:'门急诊/住院/治疗执行记录'},
 insurance:{label:'医保类型',dim:'患者基础',src:'医保结算数据'},
 screen:{label:'筛查记录（项目/机构/时间/结果/建议）',dim:'患者基础',src:'筛查管理数据'},
 site:{label:'原发部位/病理类型',dim:'肿瘤特征',src:'报告卡/病理报告'},
 tumor:{label:'患者主索引 + 原发肿瘤/瘤例标识',dim:'肿瘤特征',src:'报告卡主卡/瘤例标识'},
 code:{label:'ICD-10/ICD-O-3 编码与分级',dim:'肿瘤特征',src:'报告卡/病理报告'},
 stage:{label:'分期期别',dim:'肿瘤特征',src:'分期记录'},
 diagDate:{label:'确诊日期',dim:'肿瘤特征',src:'报告卡'},
 diagBasis:{label:'诊断依据',dim:'肿瘤特征',src:'报告卡/病理报告'},
 treat:{label:'治疗执行记录（六类方式/执行日期/执行机构）',dim:'诊疗过程',src:'手术/放疗/药物治疗执行记录'},
 mdt:{label:'MDT 会诊记录',dim:'诊疗过程',src:'MDT 与转诊管理'},
 referral:{label:'治疗机构变化',dim:'诊疗过程',src:'治疗执行记录（患者级时间序列自动生成）'},
 vital:{label:'生存状态',dim:'随访与结局',src:'随访与死亡登记'},
 lastfu:{label:'末次随访日期 / 随访状态',dim:'随访与结局',src:'随访管理数据'},
 death:{label:'死亡日期与死因',dim:'随访与结局',src:'随访与死亡登记'}
};
/* 指标 → 画像字段：未在此登记的指标不得出现在汇总页与导出文件中 */
var SP_METRIC_FIELD={
 patients:'empi',tumors:'tumor',periodDiagnosed:'diagDate',active:'lastfu',alive:'vital',dead:'death',
 lost:'lastfu',vitalUnknown:'vital',early:'stage',late:'stage',stageMissing:'stage',screen:'screen',basis:'diagBasis',
 mdt:'mdt',referral:'referral',started:'treat',combo:'treat',
 mode0:'treat',mode1:'treat',mode2:'treat',mode3:'treat',mode4:'treat',mode5:'treat',
 follow:'lastfu',lostRatio:'lastfu',local:'hospital',cross:'hospital',knownAlive:'vital',
 complete:'empi',dateConflicts:'treat'
};
/* 画像未采集字段：只列缺口与受影响指标，一律不生成数值 */
var SP_GAP_FIELDS=[
 {field:'历史首次确诊日期',src:'需历史恶性肿瘤确诊记录（画像未采集）',affect:'首次新确诊患者数'},
 {field:'随访任务与完成证据',src:'随访管理数据-随访任务表（未接入）',affect:'按期随访完成率'},
 {field:'在管状态',src:'随访管理数据-管理状态字段（未采集）',affect:'随访在管患者数'},
 {field:'既往史',src:'报告卡（画像未采集）',affect:'既往史构成'},
 {field:'症状',src:'门急诊/入院记录（画像未采集）',affect:'症状记录状态'},
 {field:'ECOG 体能评分',src:'病程记录（画像未采集）',affect:'体能状态分层'},
 {field:'营养风险筛查',src:'营养评估记录（画像未采集）',affect:'营养风险分层'},
 {field:'RECIST 疗效评价',src:'影像/病程记录（画像未采集）',affect:'疾病评价构成'},
 {field:'复发/进展/转移评价',src:'随访与病程记录（画像未采集）',affect:'复发、进展、转移记录占比'},
 {field:'姑息/安宁疗护阶段',src:'病程与支持治疗记录（画像未采集）',affect:'姑息与安宁疗护记录占比'},
 {field:'初诊远处转移标志',src:'分期记录（可由 M1 判定，未单列字段）',affect:'初诊远处转移占比'},
 {field:'既往外省诊疗标志',src:'转院记录（可判跨省转诊，未单列字段）',affect:'既往外省诊疗占比'},
 {field:'发现途径',src:'筛查/门诊记录（画像未采集）',affect:'发现途径构成'},
  {field:'随访时间到事件序列',src:'随访与死亡登记（未接入）',affect:'1/3/5 年生存率'},
 {field:'治疗周期与不良反应分级',src:'病程/医嘱（未接入）',affect:'治疗完成率、不良反应发生率'}
];
function spFieldOf(id){var k=SP_METRIC_FIELD[id],f=k?SP_PORTRAIT_FIELDS[k]:null;return f||{label:'—',dim:'—',src:'—'}}
/* ---- 指标口径与达标线：对齐《卫健领导关注指标总表》中标注「画像已有」的指标 ----
   dir:'up' 越高越好 / 'down' 越低越好；target 为参考基准（取自指标总表）；
   判定：达标 / 预警（偏离基准但未越过警戒线）/ 未达标 / 无基准；无基准指标只报值不判达标 ---- */
var SP_METRIC_KPI={};
/* 达标判定：返回 {state,label,tone}；无基准返回 neutral */
function spKpiJudge(id,m){
  var cfg=SP_METRIC_KPI[id];
  if(!cfg||m.value===null||cfg.target===null)return {state:'',label:'',tone:''};
  var v=m.value,ok=cfg.dir==='up'?v>=cfg.target:v<=cfg.target;
  if(ok)return {state:'pass',label:'达标',tone:'success'};
  /* 警戒线：向上指标低于基准 20% 及以上、向下指标高于基准 50% 及以上判未达标，其间为预警 */
  var gap=cfg.dir==='up'?(cfg.target-v)/cfg.target:(v-cfg.target)/cfg.target;
  return gap>=0.2?{state:'fail',label:'未达标',tone:'danger'}:{state:'warn',label:'预警',tone:'caution'};
}
/* 指标卡：值 + 达标状态 + 基准 + 有效分母，带 hover 口径与画像字段 */
function spKpiCard(agg,id){
  var m=agg.metrics[id],j=spKpiJudge(id,m),cfg=SP_METRIC_KPI[id]||{};
  var action=m.value!==null&&m.ids.length?' onclick="window._spMetricPatients(\''+id+'\')" tabindex="0" role="button" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();window._spMetricPatients(\''+id+'\')}"':'';
  return '<div class="sp-kpi'+(action?' sp-kpi-action':'')+'"'+action+' title="'+esc((cfg.kpi||m.name)+'｜口径：'+m.definition+'；画像字段：'+m.field+'（'+m.fieldSrc+'）'+(cfg.ref?'；来源：'+cfg.ref:''))+'">'+
    '<div class="sp-kpi-k"><span class="sp-kpi-k-t">'+esc(cfg.kpi||m.name)+'</span>'+(j.label?'<span class="sp-kpi-tag sp-kpi-'+j.tone+'">'+j.label+'</span>':'')+'</div>'+
    '<div class="sp-kpi-v">'+(m.value===null?'—':spNumber(m.value))+(m.value===null?'':'<em>'+m.unit+'</em>')+'</div>'+
    '<div class="sp-kpi-sub">'+esc(spMetricEvidence(m))+'</div>'+
    '<div class="sp-kpi-sub">基准 '+(cfg.targetText?esc(cfg.targetText):'—')+'</div></div>';
}
/* 治疗机构变化为患者级事实；群体统计沿用截止日，详情显示截至今天的患者全部治疗。 */
function spInstitutionChanges(e,cutoff){
 var rows=[],tumors=spPatientTumors(e);
 if(!tumors.length&&e)tumors=[e];
 tumors.forEach(function(t){
  (t.treatments||[]).concat(t.treatmentVisits||[]).forEach(function(r){
   var executed=spDate(String(r.executedAt||r.date||r.start||'').slice(0,10)),diagnosis=spDiagnosisDate(t),death=spDate(t.deathDate);
   if(executed&&((diagnosis&&executed<diagnosis)||(death&&executed>death)))return;
   rows.push({id:r.recordId||r.id,source:r.source||'治疗执行记录',date:r.executedAt||r.date||r.start,
    hospital:r.hospital,hospitalCode:r.hospitalCode,mode:r.mode,plan:r.plan,status:r.status,tumorId:t.id,tumorName:spTumorName(t)});
  });
 });
 return window.SPTransfers?window.SPTransfers.derive(rows,cutoff||spCutoff()):{records:[],changes:[],pending:[],state:null};
}
function spReferralState(e){return spInstitutionChanges(e,spCutoff()).state}
function spAgg(list){
  list=spUnique(list||[],spTumorKey);
  var persons=spPersons(list),n=list.length,pn=persons.length,metrics={};
  function count(id,name,value,unit,definition,predicate,rows){
    var m={id:id,name:name,value:value,numerator:value,denominator:null,unknown:0,notApplicable:0,unit:unit,
      statisticalUnit:unit==='人'?'患者':'瘤例',definition:definition,status:value===null?'未接入':'可计算',
      ids:predicate?(rows||persons).filter(predicate).map(function(e){return e.id}).filter(spKnown):[]};
    metrics[id]=m;return m;
  }
  function ratio(id,name,rows,judge,definition,unit){
    var yes=[],unknown=0,na=0,known=0;
    rows.forEach(function(e){
      var v=judge(e);
      if(v==='不适用'){na++;return}
      if(v===null||v===undefined){unknown++;return}
      known++;if(v===true)yes.push(e);
    });
    var m={id:id,name:name,value:known?+(yes.length/known*100).toFixed(1):null,numerator:yes.length,denominator:known,
      unknown:unknown,notApplicable:na,unit:'%',statisticalUnit:unit||'瘤例',definition:definition,
      status:known?'可计算':'有效数据不足',ids:yes.map(function(e){return e.id}).filter(spKnown)};
    metrics[id]=m;return m;
  }
  function recordedBool(key,dates){return function(e){return spBool(spRecordValue(e,key,dates))}}
  var alive=persons.filter(function(e){return /^存活/.test(spVital(e))}).length;
  var dead=persons.filter(function(e){return spVital(e)==='死亡'}).length;
  var lost=persons.filter(function(e){return spLost(e)===true&&spVital(e)!=='死亡'}).length;
  /* 在管 = 画像「随访工作状态」为随访中，且生存状态已知存活、未失访；不引入画像外字段 */
  var active=function(e){return /^存活/.test(spVital(e))&&spLost(e)===false&&e.followStatus==='随访中'};
  count('patients','纳入患者数',pn,'人','统一患者标识去重',function(){return true});
  count('tumors','纳入瘤例数',n,'例','患者标识 + 原发肿瘤/记录标识去重',function(){return true},list);
  var from=(_spScope&&_spScope.from)||spCutoff().slice(0,4)+'-01-01',to=(_spScope&&_spScope.to)||spCutoff();
  var period=function(e){return list.some(function(t){var d=spDiagnosisDate(t);return spPatientKey(t)===spPatientKey(e)&&!!d&&d>=from&&d<=to})};
  count('periodDiagnosed','期内确诊记录患者数',persons.filter(period).length,'人','当前记录确诊日期在 '+from+' 至 '+to,period);
  count('active','随访在管存活患者',persons.filter(active).length,'人','已知存活、未失访且随访工作状态为随访中',active);
  count('alive','已知存活患者',alive,'人','截止日前有效末次随访明确存活',function(e){return /^存活/.test(spVital(e))});
  count('dead','已登记死亡患者',dead,'人','有效死亡日期不晚于截止日',function(e){return spVital(e)==='死亡'});
  count('lost','失访记录患者',lost,'人','明确失访记录且未死亡结案',function(e){return spLost(e)===true&&spVital(e)!=='死亡'});
  count('vitalUnknown','生存状态不详患者',pn-alive-dead,'人','无可用时点或生存状态不详',function(e){return spVital(e)==='不详'});
  ratio('early','记录早期分期占比',list,function(e){var s=spStage(e);return s==='不适用'?s:s==='不详'?null:spEarly(e)},'I/II期 / 已知且适用的分期瘤例');
  ratio('late','记录 IV 期占比',list,function(e){var s=spStage(e);return s==='不适用'?s:s==='不详'?null:spLate(e)},'IV期 / 已知且适用的分期瘤例');
  /* 兼容历史调用的期别缺失统计；实际 TNM 字段统计由 spFieldSummary 提供。 */
  ratio('stageMissing','分期期别未记录占比',list,function(e){var s=spStage(e);return s==='不适用'?'不适用':(s==='不详'?true:false)},'无有效分期瘤例 / 全部纳入瘤例');
  ratio('screen','队列筛查记录覆盖',persons,function(e){return spScreenStatus(e)==='有筛查记录'},'有筛查记录患者 / 纳入患者','患者');
  ratio('basis','病理学诊断记录占比',list,function(e){var v=spDiagBasisType(e);return v==='不详'?null:v==='病理学诊断'},'有明确病理/活检依据 / 诊断依据已知瘤例');
  ratio('mdt','MDT 记录占比',list,recordedBool('mdt',['mdtRecordedDate','mdtDate']),'截止日前MDT明确为是 / MDT字段已知瘤例');
  ratio('referral','治疗机构变化患者占比',persons,function(e){return spReferralState(e)},'截至统计日有治疗机构变化的患者 / 治疗机构变化状态可判定患者（按患者去重）','患者');
  ratio('started','治疗启动记录覆盖',list,function(e){return spTreatmentEntries(e).length>0||(!Array.isArray(e.treatments)&&spTreatmentModes(e).length>0)},'有有效且截止日前的治疗开始记录 / 纳入瘤例');
  ratio('combo','多方式治疗记录占比',list,function(e){var a=spTreatmentModes(e);return a.length?a.length>=2:null},'至少两种不同治疗类别 / 有有效治疗方式的瘤例');
  /* 治疗方式按画像六类口径：手术/放疗/化疗/靶向/免疫/内分泌；介入等不属六类，不参与占比 */
  SP_MODES.forEach(function(mode,i){
    ratio('mode'+i,mode+'记录占比',list,function(e){var state=spModeState(e,mode);return state==='有'?true:state==='明确无'?false:null},'有该方式记录 / 该方式明确为有或无的瘤例');
  });
  ratio('follow','随访日期记录覆盖',persons,function(e){var d=spDate(e.lastFu),diag=spDiagnosisDate(e);return !!d&&d<=spCutoff()&&(!diag||d>=diag)},'有有效末次随访日期 / 纳入患者','患者');
  ratio('lostRatio','失访记录患者占比',persons,function(e){return spVital(e)==='死亡'?'不适用':spLost(e)},'明确失访 / 非死亡且失访状态已知患者','患者');
  ratio('local','市域内就诊记录占比',list,function(e){var s=spGeoClass(e);return s==='不详'?null:s==='市域内'},'现就诊医院与户籍地市相同 / 两地市均可判定瘤例');
  ratio('cross','跨市就诊记录占比',list,function(e){var s=spGeoClass(e);return s==='不详'?null:s==='跨市'},'现就诊医院与户籍地市不同 / 两地市均可判定瘤例');
  ratio('knownAlive','已知状态中存活占比',persons,function(e){var v=spVital(e);return v==='不详'?null:v!=='死亡'},'已知存活 / 生存状态已知患者；非生存率','患者');
  ratio('complete','关键字段完整患者比例',persons,function(e){
    return list.filter(function(t){return spPatientKey(t)===spPatientKey(e)}).every(function(t){return spCoreChecks(t).every(function(c){return c.ok})});
  },'本人全部瘤例的适用关键字段均有效 / 纳入患者','患者');
  /* 随访任务表不在画像字段内：按期随访完成率不做估算，仅在缺口清单中列明 */
  var ages=persons.map(spAge).filter(function(v){return v!==null});
  var conflicts=list.filter(function(e){
    var a=spInterval(e,'firstDate','diagDate'),b=spInterval(e,'diagDate','tTreat'),first=spFirstTreat(e),death=spDate(e.deathDate);
    var diag=spDiagnosisDate(e);
    var invalid=(Array.isArray(e.treatments)?e.treatments:[]).some(function(t){
      var d=spDate(t.start)||spDate(t.date);
      return d&&d<=spCutoff()&&((diag&&d<diag)||(death&&d>death));
    });
    return a.status==='日期冲突'||b.status==='日期冲突'||invalid||!!(death&&first&&first<=spCutoff()&&first>death);
  });
  count('dateConflicts','诊疗日期冲突瘤例',conflicts.length,'例','首诊、确诊、首治顺序倒挂或截止日前治疗发生于确诊前/死亡后',function(e){return conflicts.indexOf(e)>=0},list);
  /* 每个指标挂上对应画像字段与取数来源，明细表/CSV 与页面共用同一份溯源信息 */
  Object.keys(SP_METRIC_FIELD).forEach(function(id){
    var m=metrics[id];if(!m)return;
    var f=SP_PORTRAIT_FIELDS[SP_METRIC_FIELD[id]];
    m.field=f.label;m.fieldDim=f.dim;m.fieldSrc=f.src;
  });
  return {total:pn,tumorTotal:n,persons:persons,list:list,metrics:metrics,alive:alive,dead:dead,lost:lost,active:metrics.active.value,
    male:persons.filter(function(e){return e.sex==='男'}).length,female:persons.filter(function(e){return e.sex==='女'}).length,
    medianAge:spMedian(ages),ageUnknown:pn-ages.length,newYear:metrics.periodDiagnosed.value,
    earlyRate:metrics.early.value,lateRate:metrics.late.value,mdtRate:metrics.mdt.value,comboRate:metrics.combo.value,
    crossCityRate:metrics.cross.value,localTreatRate:metrics.local.value,
    surgeryRate:metrics.mode0.value,radioRate:metrics.mode1.value,chemoRate:metrics.mode2.value,targetRate:metrics.mode3.value,
    immunoRate:metrics.mode4.value,endocrineRate:metrics.mode5.value,
    referralRate:metrics.referral.value,fuRate:metrics.follow.value,lostRate:metrics.lostRatio.value,
    deathRate:pn?+(dead/pn*100).toFixed(1):null,effSurvival:metrics.knownAlive.value};
}
function spCoreChecks(e){
  var vital=spVital(e),first=spFirstTreat(e);
  return [
    {name:'患者标识',ok:spKnown(e.empi||e.patientId||e.idNo)},
    {name:'性别',ok:e.sex==='男'||e.sex==='女'},
    {name:'出生日期',ok:spAge(e)!==null},
    {name:'户籍地市',ok:spKnown(e.city)},
    {name:'就诊医院',ok:spKnown(e.hospital)},
    {name:'确诊日期',ok:!!spDiagnosisDate(e)},
    {name:'瘤种',ok:spKnown(e.site)},
    {name:'诊断依据',ok:spDiagBasisType(e)!=='不详'},
    {name:'分期记录',ok:spStage(e)!=='不详'},
    {name:'治疗状态',ok:!!(spTreatmentModes(e).length||spKnown(e.treatmentStatus))&&(!first||spInterval(e,'diagDate','tTreat').value!==null)},
    {name:'随访日期',ok:!!spDate(e.lastFu)&&e.lastFu<=spCutoff()&&(!spDiagnosisDate(e)||e.lastFu>=spDiagnosisDate(e))},
    {name:'生存状态',ok:vital!=='不详'},
    {name:'死亡日期与死因',ok:vital!=='死亡'||!!(spDate(e.deathDate)&&spKnown(e.deathCause))}
  ];
}
function spAgeDist(list){
  list=spPersons(list);
  var groups=[['0-39',0,39],['40-49',40,49],['50-59',50,59],['60-69',60,69],['70及以上',70,120],['不详',null,null]];
  return groups.map(function(g){
    var sub=list.filter(function(e){var a=spAge(e);return g[1]===null?a===null:a!==null&&a>=g[1]&&a<=g[2]});
    return {k:g[0],m:sub.filter(function(e){return e.sex==='男'}).length,f:sub.filter(function(e){return e.sex==='女'}).length,u:sub.filter(function(e){return e.sex!=='男'&&e.sex!=='女'}).length,n:sub.length};
  });
}
function spSiteRows(list){
  var sites=Array.from(new Set(list.map(function(e){return spKnown(e.site)?e.site:'不详'})));
  return sites.map(function(s){
    var sub=list.filter(function(e){return (spKnown(e.site)?e.site:'不详')===s});
    return {site:s,n:sub.length,agg:spAgg(sub),list:sub};
  }).filter(function(r){return r.n>0});
}
function spCityRows(list){
  var cities=Array.from(new Set(SP_CITIES.concat(list.map(function(e){return spKnown(e.city)?e.city:'不详'}))));
  return cities.map(function(c){
    var sub=list.filter(function(e){return (spKnown(e.city)?e.city:'不详')===c});
    return {city:c,n:sub.length,agg:spAgg(sub),list:sub};
  });
}
function spStageItems(list){
  return SP_STAGE_GROUPS.concat(['不详','不适用']).map(function(s){
    return {k:s,v:list.filter(function(e){return spStage(e)===s}).length,color:SP_STAGE_COLORS[s]||'#94a3b8'};
  });
}
function spMini(label,value){
  return '<div class="sp-mini"><div class="k">'+esc(label)+'</div><div class="v">'+value+'</div></div>';
}
function spPanel(title,body){
  return '<div class="panel"><div class="panel-header"><span>'+esc(title)+'</span></div><div class="panel-body">'+body+'</div></div>';
}
/* 段内分块标题（带序号 + 副说明） */
function spGpHead(no,title,sub){
  return '<div class="sp-gp-head"><span class="sp-gp-no">'+esc(no)+'</span><span>'+esc(title)+
    (sub?'<span class="sp-gp-sub">'+esc(sub)+'</span>':'')+'</span></div>';
}


/* ===================== 三、图表构件（纯 CSS/SVG，无依赖） ===================== */
var SP_CHART_COLORS=['#2563eb','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ef4444','#14b8a6','#f97316'];
function spChartEmpty(){return '<div style="height:170px;display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:var(--fs-sm)">暂无数据</div>'}
/* 环形饼图 items:[{k,v}] */
function spPie(items,unit){
  items=(items||[]).filter(function(x){return x.v>0});
  var total=items.reduce(function(s,x){return s+x.v},0);
  if(!total)return spChartEmpty();
  var acc=0,stops=[];
  items.forEach(function(x,i){
    var c=x.color||SP_CHART_COLORS[i%SP_CHART_COLORS.length];
    var from=acc/total*360;acc+=x.v;var to=acc/total*360;
    stops.push(c+' '+from.toFixed(2)+'deg '+to.toFixed(2)+'deg');
  });
  var legend=items.map(function(x,i){
    var c=x.color||SP_CHART_COLORS[i%SP_CHART_COLORS.length];
    return '<div class="sp-legend-item"><span class="sp-legend-dot" style="background:'+c+'"></span><span>'+esc(x.k)+'</span><span class="sp-legend-val">'+x.v+'</span><span class="sp-legend-pct">'+(x.v/total*100).toFixed(0)+'%</span></div>';
  }).join('');
  return '<div class="sp-chart-body"><div class="sp-pie" style="background:conic-gradient('+stops.join(',')+')"><div class="sp-pie-center">'+total+'<small>'+esc(unit||'例')+'</small></div></div><div class="sp-legend">'+legend+'</div></div>';
}
/* 横向柱 items:[{k,v,suffix}] suffix 默认 ' 例'；pct=true 时值为百分比；labWide=true 时标签列加宽（放区县等长文本） */
function spHBar(items,pct,labWide){
  items=(items||[]).filter(function(x){return x.v===null||(Number.isFinite(x.v)&&x.v>=0)});
  if(!items.length)return spChartEmpty();
  var max=pct?100:(Math.max.apply(null,items.map(function(x){return x.v||0}))||1);
  return '<div class="sp-hbars'+(labWide?' wide-lab':'')+'">'+items.map(function(x){
    var val=x.v===null?'不可计算':(pct?x.v+'%':x.v);
    return '<div class="sp-hbar-row"><div class="sp-hbar-lab" title="'+esc(x.k)+'">'+esc(x.k)+'</div><div class="sp-hbar-track"><div class="sp-hbar-fill" style="width:'+(x.v===null?0:Math.round(x.v/max*100))+'%"></div></div><div class="sp-hbar-num">'+val+'</div></div>';
  }).join('')+'</div>';
}
/* 纵向柱 items:[{k,v}] */
function spVBar(items){
  items=(items||[]).filter(function(x){return x.v>0});
  if(!items.length)return spChartEmpty();
  var max=Math.max.apply(null,items.map(function(x){return x.v}));
  return '<div class="sp-vbars">'+items.map(function(x){
    return '<div class="sp-vbar"><div class="sp-vbar-num">'+x.v+'</div><div class="sp-vbar-fill" style="height:'+Math.max(6,Math.round(x.v/max*100))+'%"></div><div class="sp-vbar-lab" title="'+esc(x.k)+'">'+esc(x.k)+'</div></div>';
  }).join('')+'</div>';
}
/* 100% 堆叠条 items:[{k,v,color}]，withLegend 控制图例 */
function spStack(items,withLegend){
  items=(items||[]).filter(function(x){return x.v>0});
  var total=items.reduce(function(s,x){return s+x.v},0);
  if(!total)return spChartEmpty();
  var segs=items.map(function(x){
    var pct=x.v/total*100;
    return '<div class="sp-stack-seg" style="width:'+pct.toFixed(2)+'%;background:'+x.color+'" title="'+esc(x.k)+'：'+x.v+' 例">'+(pct>=9?x.v:'')+'</div>';
  }).join('');
  var h='<div class="sp-stack-bar">'+segs+'</div>';
  if(withLegend!==false){
    h+='<div class="sp-legend" style="margin-top:10px">'+items.map(function(x){
      return '<div class="sp-legend-item"><span class="sp-legend-dot" style="background:'+x.color+'"></span><span>'+esc(x.k)+'</span><span class="sp-legend-val">'+x.v+'</span><span class="sp-legend-pct">'+(x.v/total*100).toFixed(0)+'%</span></div>';
    }).join('')+'</div>';
  }
  return h;
}
/* hex → rgba */
function spRgba(hex,a){
  var n=parseInt(String(hex).replace('#',''),16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';
}
/* 路径节点条：环节例数+占首环节比例，分档着色（≥90 绿 / 60-89 琥珀 / <60 红） */
function spSteps(steps){
  var total=steps.length?steps[0].n:0;
  return '<div class="sp-steps">'+steps.map(function(s){
    var pct=total?Math.round(s.n/total*100):0;
    var c=pct>=90?'#10b981':pct>=60?'#f59e0b':'#ef4444';
    return '<div class="sp-step" style="border-left:4px solid '+c+'" title="'+esc(s.label)+'：'+s.n+' 例（占在管 '+pct+'%）">'+
      '<div class="sp-step-n" style="color:'+c+'">'+s.n+'</div>'+
      '<div class="sp-step-k">'+esc(s.label)+'</div>'+
      '<div class="sp-step-p">'+pct+'%</div></div>';
  }).join('')+'</div>';
}
/* 诊疗时效（群体口径）：首诊→确诊、确诊→首治 两段中位天数对比条。
   V11.4 改版：原逐例患者双段条（带姓名、点击直达个体画像）属个体视角，移出群体总览页 */
function spJourney(list){
  var rows=[['首诊 → 确诊',spIntervalStats(list,'firstDate','diagDate')],
    ['确诊 → 首治',spIntervalStats(list,'diagDate','tTreat')],
    ['首诊 → 首治',spIntervalStats(list,'firstDate','tTreat')]];
  return spSimpleTable(['时间段','有效瘤例','中位天数','P75','P90','不可用 / 冲突'],rows.map(function(r){
    var s=r[1];
    return [r[0],s.n,spNumber(s.median),spNumber(s.p75),spNumber(s.p90),s.unknown+' / '+s.conflicts];
  }));
}
/* 中位天数（字段名对字段名） */
function spMedDays(list,from,to){
  var s=spIntervalStats(list,from,to);
  return s.median===null?'不可计算':spNumber(s.median)+'<em> 天</em>';
}
/* 热力矩阵：colLabels 列名，rows[{label,cells:[n]}]，baseColors 每列基色，色深=数值 */
function spHeat(colLabels,rows,baseColors){
  var max=0;
  rows.forEach(function(r){r.cells.forEach(function(c){if(c>max)max=c})});
  max=max||1;
  var head='<tr><th class="rlab"></th>'+colLabels.map(function(c){return '<th>'+esc(c)+'</th>'}).join('')+'</tr>';
  var body=rows.map(function(r){
    var tds=r.cells.map(function(c,i){
      if(!c)return '<td class="cell zero" title="'+esc(r.label)+' · '+esc(colLabels[i])+'：0 例">–</td>';
      var alpha=0.15+Math.min(1,c/max)*0.75;
      return '<td class="cell" style="background:'+spRgba(baseColors[i],alpha)+';'+(alpha>0.6?'color:#fff':'')+'" title="'+esc(r.label)+' · '+esc(colLabels[i])+'：'+c+' 例">'+c+'</td>';
    }).join('');
    return '<tr><td class="rlab">'+esc(r.label)+'</td>'+tds+'</tr>';
  }).join('');
  return '<div class="sp-heat-wrap"><table class="sp-heat"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>';
}
/* 各瘤种分期构成 100% 堆叠条：每行一个瘤种，段=各分期占比，色=分期色。
   小样本（N≈13）下比热力色深可读，直接指向「哪个瘤种发现得晚」。
   rows:[{label,n,cells:[各分期例数]}]，stages 列名，colors 分期色 */
function spSiteStageStack(rows,stages,colors){
  if(!rows.length)return spChartEmpty();
  var maxN=Math.max.apply(null,rows.map(function(r){return r.n}))||1;
  /* 顶部图例 */
  var legend='<div class="sp-ss-legend">'+stages.map(function(s,i){
    return '<span class="sp-ss-leg"><i style="background:'+colors[i]+'"></i>'+esc(s)+'</span>';
  }).join('')+'</div>';
  var body=rows.map(function(r){
    var segs=r.cells.map(function(c,i){
      if(!c)return '';
      var pct=c/r.n*100;
      return '<div class="sp-ss-seg" style="width:'+pct.toFixed(2)+'%;background:'+colors[i]+'" title="'+esc(r.label)+' · '+esc(stages[i])+'：'+c+' 例（'+Math.round(pct)+'%）">'+(pct>=16?c:'')+'</div>';
    }).join('');
    /* 条宽按例数占最大瘤种比例，保留「谁人多」的量级感，最低 30% 以保证短瘤种可读 */
    var barW=Math.max(30,Math.round(r.n/maxN*100));
    return '<div class="sp-ss-row"><div class="sp-ss-lab" title="'+esc(r.label)+'">'+esc(r.label)+'</div>'+
      '<div class="sp-ss-track" style="width:'+barW+'%">'+segs+'</div>'+
      '<div class="sp-ss-num">'+r.n+' 例</div></div>';
  }).join('');
  return '<div class="sp-ss-wrap">'+legend+'<div class="sp-ss-body">'+body+'</div></div>';
}
/* 地市综合对照：患者数 + 可选指标内嵌条形，城市名可下钻
   keys 指定要显示的列（early/late/cross/fu），缺省=全部；用于按链条段裁剪，避免早诊指标与段②重复 */
function spCityCompare(cityRows,keys){
  var rows=cityRows.filter(function(r){return r.n>0}).sort(function(a,b){return b.n-a.n});
  if(!rows.length)return spChartEmpty();
  var maxN=Math.max.apply(null,rows.map(function(r){return r.n}));
  var allCols={
    early:{k:'记录早期占比',color:'#10b981',get:function(r){return {txt:spMetricValue(r.agg.metrics.early)+' ('+r.agg.metrics.early.numerator+'/'+r.agg.metrics.early.denominator+')',pct:r.agg.earlyRate}}},
    late:{k:'记录 IV 期占比',color:'#64748b',get:function(r){return {txt:spMetricValue(r.agg.metrics.late),pct:r.agg.lateRate}}},
    cross:{k:'跨市就诊记录占比',color:'#f59e0b',get:function(r){return {txt:spMetricValue(r.agg.metrics.cross)+' ('+r.agg.metrics.cross.numerator+'/'+r.agg.metrics.cross.denominator+')',pct:r.agg.crossCityRate}}},
    fu:{k:'随访日期记录覆盖',color:'#0ea5e9',get:function(r){return {txt:spMetricValue(r.agg.metrics.follow)+' ('+r.agg.metrics.follow.numerator+'/'+r.agg.metrics.follow.denominator+')',pct:r.agg.fuRate}}}
  };
  var order=keys&&keys.length?keys:['early','late','cross','fu'];
  var cols=[{k:'患者 / 瘤例',color:'#2563eb',get:function(r){return {txt:r.agg.total+' 人 / '+r.n+' 例',pct:r.n/maxN*100}}}]
    .concat(order.map(function(k){return allCols[k]}).filter(Boolean));
  var head='<tr><th>地市</th>'+cols.map(function(c){return '<th>'+esc(c.k)+'</th>'}).join('')+'</tr>';
  var body=rows.map(function(r){
    var tds=cols.map(function(c){
      var m=c.get(r);
      return '<td><div class="sp-cmp-metric"><div class="sp-cmp-bar"><i style="width:'+Math.min(100,Math.round(m.pct))+'%;background:'+c.color+'"></i></div><span class="sp-cmp-val">'+m.txt+'</span></div></td>';
    }).join('');
    return '<tr><td class="sp-cmp-city" onclick="window._spDrillCity(\''+esc(r.city)+'\')" title="下钻 '+esc(r.city)+'">'+esc(r.city)+'</td>'+tds+'</tr>';
  }).join('');
  return '<div class="sp-cmp-wrap"><table class="sp-cmp"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>';
}
/* 图表 CSS（饼/柱/堆叠等） */
var spChartStyle=document.createElement('style');spChartStyle.textContent=`
.sp-chart-body{display:flex;align-items:center;gap:20px;min-height:200px;padding:6px 2px}
.sp-pie{position:relative;width:160px;height:160px;flex:0 0 160px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(15,23,42,.06)}
.sp-pie-center{position:absolute;inset:34%;background:var(--surface);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font-num);font-weight:700;font-size:var(--fs-body);color:var(--color-text-title);box-shadow:inset 0 0 0 1px rgba(15,23,42,.05)}
.sp-pie-center small{font-size:var(--fs-xs);font-weight:500;color:var(--color-text-muted)}
.sp-legend{display:flex;flex-direction:column;gap:9px;font-size:var(--fs-sm);flex:1;min-width:0}
.sp-legend-item{display:flex;align-items:center;gap:8px;color:var(--color-text-body)}
.sp-legend-dot{width:10px;height:10px;border-radius:3px;flex:0 0 10px}
.sp-legend-val{margin-left:auto;font-family:var(--font-num);font-weight:700;color:var(--color-text-title)}
.sp-legend-pct{font-size:var(--fs-xs);color:var(--color-text-muted);width:42px;text-align:right;font-family:var(--font-num)}
.sp-hbars{display:flex;flex-direction:column;gap:13px;padding:6px 2px}
.sp-hbar-row{display:flex;align-items:center;gap:10px}
.sp-hbar-lab{width:72px;flex:0 0 72px;text-align:right;font-size:var(--fs-sm);color:var(--color-text-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-hbars.wide-lab .sp-hbar-lab{width:110px;flex:0 0 110px}
/* 段内分块标题：比 sp-sec 更醒目，用于段①两块划分 */
.sp-gp-head{display:flex;align-items:center;gap:10px;margin:22px 0 12px;font-size:14px;font-weight:700;color:var(--color-text-title)}
.sp-gp-head:first-child{margin-top:4px}
.sp-gp-head .sp-gp-no{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:var(--color-primary);color:#fff;font-size:12px;font-weight:700}
.sp-gp-head .sp-gp-sub{font-size:12px;font-weight:400;color:var(--color-text-muted);margin-left:10px}
.sp-gp-head:after{content:'';flex:1;height:1px;background:var(--color-border)}
.sp-hbar-track{flex:1;height:16px;background:var(--color-bg-subtle);border-radius:8px;overflow:hidden}
.sp-hbar-fill{height:100%;border-radius:8px;background:linear-gradient(90deg,#2563eb,#60a5fa)}
.sp-hbar-num{width:52px;flex:0 0 52px;font-size:var(--fs-sm);font-weight:700;color:var(--color-text-title);font-family:var(--font-num)}
/* 复合构成面板小节标题 */
.sp-sec{display:flex;align-items:center;gap:8px;margin:14px 0 8px;font-size:var(--fs-xs);font-weight:700;color:var(--color-text-title);letter-spacing:.04em}
.sp-sec:first-child{margin-top:2px}
.sp-sec:before{content:'';width:3px;height:12px;border-radius:2px;background:var(--color-primary)}
.sp-sec:after{content:'';flex:1;height:1px;background:var(--color-border)}
/* 年龄金字塔：中轴年龄段，男左女右条形向外伸展，任意面板宽度不换行 */
.sp-age-row{display:grid;grid-template-columns:1fr 64px 1fr;gap:8px;align-items:center}
.sp-age-side{display:flex;align-items:center;gap:6px;min-width:0}
.sp-age-track{flex:1;height:10px;border-radius:5px;background:var(--color-bg-subtle);display:flex;min-width:0;overflow:hidden}
.sp-age-track.m{justify-content:flex-end}
.sp-age-fill{height:100%;border-radius:5px}
.sp-age-fill.m{background:linear-gradient(270deg,#60a5fa,#2563eb)}
.sp-age-fill.f{background:linear-gradient(90deg,#f9a8d4,#ec4899)}
.sp-age-num{flex:0 0 auto;font-size:var(--fs-xs);color:var(--color-text-muted);font-family:var(--font-num);white-space:nowrap}
.sp-age-lab{text-align:center;min-width:0}
.sp-age-lab .k{font-size:var(--fs-sm);font-weight:600;color:var(--color-text-body);white-space:nowrap}
.sp-age-lab .n{font-size:var(--fs-2xs);color:var(--color-text-muted);font-family:var(--font-num);margin-top:1px}
.sp-age-cap{align-items:center}
.sp-age-cap .sp-age-side:first-child{justify-content:flex-end}
.sp-age-legend{display:inline-flex;align-items:center;gap:5px;font-size:var(--fs-xs);font-weight:600;color:var(--color-text-body);white-space:nowrap}
.sp-age-legend i{width:8px;height:8px;border-radius:2px;display:inline-block}
.sp-age-legend i.m{background:#2563eb}
.sp-age-legend i.f{background:#ec4899}
/* ---- V11.2 信息密度构件：路径节点条 / 诊疗旅程 / 热力矩阵 / 地市对照表 ---- */
.sp-steps{display:flex;align-items:stretch;padding:8px 2px 4px;overflow-x:auto}
.sp-step{flex:1;min-width:104px;background:var(--color-primary-soft);border:1px solid var(--color-border);border-radius:10px;padding:10px 12px;margin-right:30px;position:relative;white-space:nowrap}
.sp-step:last-child{margin-right:0}
.sp-step:after{content:'▸';position:absolute;right:-24px;top:50%;transform:translateY(-50%);color:var(--color-text-muted);font-size:14px}
.sp-step:last-child:after{content:''}
.sp-step-n{font-size:24px;font-weight:800;font-family:var(--font-num);line-height:1.15}
.sp-step-k{font-size:var(--fs-sm);font-weight:600;color:var(--color-text-body);margin-top:2px}
.sp-step-p{font-size:var(--fs-2xs);color:var(--color-text-muted);font-family:var(--font-num)}
.sp-jour{display:flex;flex-direction:column;gap:7px;padding:4px 2px}
.sp-jour-row{display:grid;grid-template-columns:92px 1fr 118px;gap:10px;align-items:center}
.sp-jour-name{font-size:var(--fs-xs);color:var(--color-text-body);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-jour-track{height:18px;background:var(--color-bg-subtle);border-radius:9px;overflow:hidden;display:flex}
.sp-jour-a{background:linear-gradient(90deg,#60a5fa,#2563eb)}
.sp-jour-b{background:linear-gradient(90deg,#fbbf24,#f59e0b)}
.sp-jour-num{font-family:var(--font-num);font-size:var(--fs-xs);color:var(--color-text-muted);white-space:nowrap}
.sp-jour-cap{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.sp-jour-cap .sp-legend{flex-direction:row;gap:16px;flex:0 0 auto}
.sp-heat-wrap{overflow-x:auto}
.sp-heat{border-collapse:separate;border-spacing:4px;width:100%;min-width:460px}
.sp-heat th{font-size:var(--fs-xs);font-weight:600;color:var(--color-text-muted);text-align:center;padding:2px 4px;white-space:nowrap}
.sp-heat th.rlab{text-align:right;padding-right:8px}
.sp-heat td.rlab{font-size:var(--fs-sm);font-weight:600;color:var(--color-text-body);text-align:right;padding-right:8px;white-space:nowrap}
.sp-heat td.cell{height:42px;min-width:58px;text-align:center;vertical-align:middle;border-radius:7px;font-family:var(--font-num);font-weight:700;font-size:var(--fs-sm);color:var(--color-text-title)}
.sp-heat td.cell.zero{background:var(--color-bg-subtle);color:var(--color-text-muted);font-weight:400}
.sp-cmp-wrap{overflow-x:auto}
.sp-cmp{width:100%;border-collapse:collapse;min-width:660px}
.sp-cmp th{font-size:var(--fs-xs);font-weight:600;color:var(--color-text-muted);text-align:left;padding:6px 10px;white-space:nowrap;border-bottom:1px solid var(--color-border)}
.sp-cmp td{padding:8px 10px;border-bottom:1px solid var(--color-border);white-space:nowrap}
.sp-cmp tr:last-child td{border-bottom:0}
.sp-cmp-city{font-weight:600;color:var(--color-text-title);cursor:pointer}
.sp-cmp-city:hover{color:var(--color-primary);text-decoration:underline}
.sp-cmp-metric{display:flex;align-items:center;gap:8px}
.sp-cmp-bar{flex:0 0 72px;height:8px;border-radius:4px;background:var(--color-bg-subtle);overflow:hidden}
.sp-cmp-bar i{display:block;height:100%;border-radius:4px}
.sp-cmp-val{font-family:var(--font-num);font-size:var(--fs-xs);font-weight:600;color:var(--color-text-body);min-width:46px}
.sp-vbars{display:flex;align-items:flex-end;gap:20px;height:200px;padding:10px 8px 0;flex:1}
.sp-vbar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}
.sp-vbar-num{font-size:var(--fs-xs);font-weight:700;color:var(--color-text-title);margin-bottom:5px;font-family:var(--font-num)}
.sp-vbar-fill{width:100%;max-width:48px;border-radius:6px 6px 0 0;background:linear-gradient(180deg,#60a5fa,#2563eb)}
.sp-vbar-lab{font-size:var(--fs-xs);color:var(--color-text-muted);margin-top:8px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-stack-bar{display:flex;height:30px;border-radius:8px;overflow:hidden;background:var(--color-bg-subtle)}
.sp-stack-seg{display:flex;align-items:center;justify-content:center;color:#fff;font-size:var(--fs-xs);font-weight:700;font-family:var(--font-num);min-width:0}
/* 各瘤种分期构成堆叠条 */
.sp-ss-wrap{padding:6px 2px 2px}
.sp-ss-legend{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px dashed var(--color-border)}
.sp-ss-leg{display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-xs);color:var(--color-text-body)}
.sp-ss-leg i{width:10px;height:10px;border-radius:3px;flex:0 0 10px}
.sp-ss-body{display:flex;flex-direction:column;gap:11px}
.sp-ss-row{display:flex;align-items:center;gap:10px}
.sp-ss-lab{width:84px;flex:0 0 84px;text-align:right;font-size:var(--fs-sm);color:var(--color-text-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-ss-track{display:flex;height:22px;border-radius:6px;overflow:hidden;background:var(--color-bg-subtle);min-width:0}
.sp-ss-seg{display:flex;align-items:center;justify-content:center;color:#fff;font-size:var(--fs-2xs);font-weight:700;font-family:var(--font-num);min-width:0}
.sp-ss-num{width:52px;flex:0 0 52px;font-size:var(--fs-xs);font-weight:700;color:var(--color-text-title);font-family:var(--font-num);white-space:nowrap}
/* 需关注提示（画像速览短板，轻量导航 chip；非正式告警） */
.sp-notes-wrap{margin-top:16px;padding:14px 16px;background:var(--color-bg-subtle);border:1px solid var(--color-border);border-radius:10px}
.sp-notes-head{display:flex;align-items:baseline;gap:10px;margin-bottom:11px}
.sp-notes-head>span:first-child{font-size:var(--fs-sm);font-weight:700;color:var(--color-text-title)}
.sp-notes-sub{font-size:var(--fs-2xs);color:var(--color-text-muted)}
.sp-notes{display:flex;flex-wrap:wrap;gap:9px}
.sp-note{display:inline-flex;align-items:center;gap:9px;padding:7px 11px;border-radius:8px;border:1px solid var(--color-border);background:var(--surface);cursor:pointer;font-size:var(--fs-xs);line-height:1.4;transition:border-color .15s,box-shadow .15s,transform .15s}
.sp-note:hover{box-shadow:0 2px 8px rgba(15,23,42,.1);transform:translateY(-1px)}
.sp-note-seg{flex:0 0 auto;font-weight:700;padding:1px 7px;border-radius:5px;font-size:var(--fs-2xs)}
.sp-note-msg{color:var(--color-text-body)}
.sp-note-go{flex:0 0 auto;color:var(--color-primary);font-weight:600}
.sp-note-danger{border-color:rgba(239,68,68,.4)}
.sp-note-danger .sp-note-seg{background:rgba(239,68,68,.12);color:#dc2626}
.sp-note-caution{border-color:rgba(245,158,11,.4)}
.sp-note-caution .sp-note-seg{background:rgba(245,158,11,.14);color:#b45309}
.sp-notes-clean{margin-top:16px;display:flex;align-items:center;gap:9px;padding:13px 16px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.3);border-radius:10px;font-size:var(--fs-sm);color:#047857}
.sp-notes-clean .sp-notes-ico{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#10b981;color:#fff;font-size:12px;font-weight:700}
/* 指标明细表（可读 + 可复制 + 可导出） */
.sp-mt-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.sp-mt-title{font-size:var(--fs-body);font-weight:700;color:var(--color-text-title)}
.sp-mt-sub{margin-top:4px;font-size:var(--fs-xs);color:var(--color-text-muted)}
.sp-mt-actions{display:flex;gap:8px;flex:0 0 auto}
.sp-mt-table td.sp-mt-note{color:var(--color-text-muted);font-size:var(--fs-xs)}
.sp-mt-table td.sp-mt-src{font-size:var(--fs-xs);color:var(--color-text-body);white-space:normal;min-width:110px}
.sp-mt-table td.sp-mt-name{min-width:150px;white-space:normal}
.sp-mt-table td.sp-mt-kpi{font-weight:700;white-space:nowrap}
.sp-mt-table tr.sp-mt-grouprow td{background:var(--color-bg-subtle);font-weight:700;color:var(--color-text-title);font-size:var(--fs-sm);letter-spacing:.02em}
.sp-overview-title{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.sp-overview-title h2{margin:0;font-size:18px}
.sp-overview-title>span{font-size:12px;color:var(--color-text-muted)}
.sp-kpi-k{white-space:normal;overflow:visible;min-height:34px;line-height:1.4;font-size:12px;align-items:flex-start}
.sp-kpi-k .sp-kpi-tag{margin-left:0}
.sp-kpi-k-t{flex:1 1 auto;min-width:0}
.sp-kpi-v{min-height:28px}
.sp-kpi-sub{white-space:normal;overflow:visible;line-height:1.5;min-height:18px}
.sp-kpi-action{cursor:pointer}
.sp-kpi-action:hover{background:var(--color-bg-subtle)}
.sp-kpi-action:focus-visible{outline:2px solid var(--color-primary);outline-offset:-3px}
.sp-overview-grid{margin:16px 0}
.sp-overview-mini{margin:16px 0}
.sp-metric-evidence{font-size:11px;color:var(--color-text-muted);margin-top:5px;line-height:1.5}
.sp-overview-table{min-width:580px;width:100%}
.sp-overview-table th,.sp-overview-table td{white-space:normal;word-break:normal;overflow-wrap:anywhere}
.sp-table-empty{text-align:center;color:var(--color-text-muted);padding:22px}
.sp-mt-table td.sp-mt-note{white-space:normal;min-width:240px;max-width:340px}
.sp-filter-bar input[type=date]{width:100%;min-width:0;box-sizing:border-box}
.sp-filter-bar .sp-filter-actions{flex-wrap:wrap}
.sp-overview-context{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;font-size:12px;color:var(--color-text-muted)}
@media(max-width:1100px){.sp-overview-mini{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.sp-overview-mini{grid-template-columns:1fr}.sp-kpi-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-kpi{padding:10px}.sp-gp-summary{padding:10px}}
`;
document.head.appendChild(spChartStyle);


/* ===================== 四、江西地图（复用 jx-geo.js 边界数据） ===================== */
var _spMapProjCache=null;
function spProject(){
  if(_spMapProjCache)return _spMapProjCache;
  var G=window.JX_GEO;
  if(!G)return null;
  var b=G.bbox,midLat=(b[1]+b[3])/2,c=Math.cos(midLat*Math.PI/180),k=118,pad=30;
  var lon=(b[2]-b[0])*c,lat=b[3]-b[1];
  _spMapProjCache={w:Math.round(lon*k+pad*2),h:Math.round(lat*k+pad*2),
    x:function(lng){return (lng-b[0])*c*k+pad},
    y:function(la){return (b[3]-la)*k+pad}};
  return _spMapProjCache;
}
var _spMapPathCache=null;
function spCityPath(city){
  var p=spProject();if(!p)return '';
  var d=[];
  city.rings.forEach(function(poly){poly.forEach(function(ring){
    for(var i=0;i<ring.length;i++)d.push((i?'L':'M')+p.x(ring[i][0]).toFixed(1)+' '+p.y(ring[i][1]).toFixed(1));
    d.push('Z');
  })});
  return d.join('');
}
var _spMapPathCache=null;
function spMapPaths(){
  if(_spMapPathCache||!window.JX_GEO)return _spMapPathCache;
  _spMapPathCache={};
  window.JX_GEO.cities.forEach(function(c){_spMapPathCache[c.full]=spCityPath(c)});
  return _spMapPathCache;
}
var SP_MAP_NUDGE={'萍乡市':[-16,4],'新余市':[16,-2],'鹰潭市':[14,-4],'景德镇市':[10,-12],'南昌市':[-10,0]};
var SP_MAP_RAMP=['#eff6ff','#dbeafe','#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#1d4ed8'];
function spMapRamp(vals,v){
  vals=vals.filter(function(x){return x!==null&&Number.isFinite(x)});
  if(v===null||!vals.length)return '#e2e8f0';
  var lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals);
  if(hi===lo)return SP_MAP_RAMP[3];
  var t=(v-lo)/(hi-lo);
  return SP_MAP_RAMP[Math.max(0,Math.min(6,Math.round(t*6)))];
}
/* 地图面板：scope 事件列表 + 指标(metric) + 回调 */
var SP_MAP_METRICS={'患者规模':{get:function(r){return r.agg.total},fmt:function(v){return v+' 人'},w:0},
 '记录 IV 期占比':{get:function(r){return r.agg.lateRate},fmt:function(v){return v===null?'不可计算':v+'%'},w:1},
 '随访日期记录覆盖':{get:function(r){return r.agg.fuRate},fmt:function(v){return v===null?'不可计算':v+'%'},w:1},
 '跨市就诊记录占比':{get:function(r){return r.agg.crossCityRate},fmt:function(v){return v===null?'不可计算':v+'%'},w:1}};
function spMapPanel(list,metric,scopeCity){
  var paths=spMapPaths(),p=spProject();
  if(!paths||!p)return '<div class="sp-chart-empty">地图组件未加载</div>';
  var rows=spCityRows(list);
  var vals=rows.map(function(r){return SP_MAP_METRICS[metric].get(r)});
  var g='',labels='';
  rows.forEach(function(r,i){
    var geo=window.JX_GEO.cities.find(function(c){return c.full===r.city});
    if(!paths[r.city]||!geo)return;
    var v=vals[i],col=spMapRamp(vals,v),on=r.city===scopeCity;
    g+='<path d="'+paths[r.city]+'" data-sp-city="'+esc(r.city)+'" fill="'+col+'" stroke="'+(on?'#1d4ed8':'#ffffff')+'" stroke-width="'+(on?2.2:1.2)+'" style="cursor:pointer"/>';
    var nud=SP_MAP_NUDGE[r.city]||[0,0];
    var cx=p.x(geo.centroid[0])+nud[0],cy=p.y(geo.centroid[1])+nud[1];
    labels+='<g style="pointer-events:none"><text x="'+cx.toFixed(1)+'" y="'+(cy-5).toFixed(1)+'" text-anchor="middle" font-size="11" fill="#334155" font-weight="600">'+r.city.replace('市','')+'</text>'+
      '<text x="'+cx.toFixed(1)+'" y="'+(cy+9).toFixed(1)+'" text-anchor="middle" font-size="10" fill="#1d4ed8" font-family="var(--font-num)">'+SP_MAP_METRICS[metric].fmt(v)+'</text></g>';
  });
  var tip='<div class="sp-map-tip">'+
    Object.keys(SP_MAP_METRICS).map(function(m){
      return '<button class="btn '+(m===metric?'btn-primary':'btn-ghost')+' btn-sm" onclick="window._spMapMetric(\''+m+'\')">'+m+'</button>';
    }).join('')+'</div>';
  var legend='<div class="sp-map-legend"><span>低</span>'+SP_MAP_RAMP.map(function(c){return '<i style="background:'+c+'"></i>'}).join('')+'<span>高</span><span><i style="background:#e2e8f0"></i>不可计算</span></div>';
  return tip+'<svg class="sp-mapsvg" viewBox="0 0 '+p.w+' '+p.h+'" preserveAspectRatio="xMidYMid meet">'+g+labels+'</svg>'+legend;
}
/* 绑定地图点击（渲染后调用一次，全局委托） */
(function(){
  var bound=false;
  window._spBindMap=function(){
    if(bound)return;bound=true;
    document.addEventListener('click',function(e){
      var t=e.target.closest?e.target.closest('[data-sp-city]'):null;
      if(t)window._spDrillCity(t.getAttribute('data-sp-city'));
    });
  };
})();


/* ===================== 五、02 群体专科画像（板块01四维画像的总结归纳） ===================== */
var _spScope={city:'',site:'',hospital:'',from:'',to:'',cutoff:spToday()};
var _spMapMetricKey='患者规模';
var _spDomain='burden';
var _spOverviewView='table';
var _spStatExpanded=Object.create(null);
/* 总览四个业务分区和医保费用共用视图状态；字段定义保留在数据层。 */
var SP_DOMAINS=SP_PROFILE_SECTIONS.map(function(s){return {key:s.key,label:s.label}}).concat([{key:'cost',label:'医保费用'}]);

function spScopeBar(){
  function options(values,current,all){return '<option value="">'+all+'</option>'+values.map(function(v){return '<option value="'+esc(v)+'"'+(v===current?' selected':'')+'>'+esc(v)+'</option>'}).join('')}
  var cities=Array.from(new Set(SP_CITIES.concat(tumorEvents.map(function(e){return e.city}).filter(spKnown))));
  var sites=Array.from(new Set(SP_SITES.concat(tumorEvents.map(function(e){return e.site}).filter(spKnown))));
  var hospitals=Array.from(new Set(SP_HOSPITALS.concat(tumorEvents.map(function(e){return e.hospital}).filter(spKnown))));
  return '<div class="sp-filter-bar">'+
    '<div class="form-group"><label>户籍地市</label><select id="spScopeCity" onchange="window._spScopeField(\'city\',this.value)">'+options(cities,_spScope.city,'全省')+'</select></div>'+
    '<div class="form-group"><label>瘤种</label><select id="spScopeSite" onchange="window._spScopeField(\'site\',this.value)">'+options(sites,_spScope.site,'全部病种')+'</select></div>'+
    '<div class="form-group"><label>就诊医院</label><select id="spScopeHospital" onchange="window._spScopeField(\'hospital\',this.value)">'+options(hospitals,_spScope.hospital,'全部医院')+'</select></div>'+
    '<div class="form-group"><label>确诊开始日期</label><input type="date" id="spScopeFrom" value="'+esc(_spScope.from)+'" onchange="window._spScopeField(\'from\',this.value)"></div>'+
    '<div class="form-group"><label>确诊结束日期</label><input type="date" id="spScopeTo" value="'+esc(_spScope.to)+'" onchange="window._spScopeField(\'to\',this.value)"></div>'+
    '<div class="form-group"><label>统计截止日</label><input type="date" id="spScopeCutoff" value="'+esc(_spScope.cutoff)+'" max="'+spToday()+'" onchange="window._spScopeField(\'cutoff\',this.value)"></div>'+
    '<div class="sp-filter-actions"><button class="btn btn-ghost btn-sm" onclick="window._spScopeReset()">重置</button></div>'+
  '</div>';
}
function spScopeLabel(){
  var a=[];
  a.push(_spScope.city||'全省');
  if(_spScope.site)a.push(_spScope.site);
  if(_spScope.hospital)a.push(_spScope.hospital);
  a.push((_spScope.from||'全部历史')+' 至 '+(_spScope.to||'截止日'));
  a.push('截止 '+spCutoff());
  return a.join(' · ');
}

/* ---- 一句话摘要：把当前范围的群体画像口语化归纳（页面开场，替代重复的四维卡） ---- */
function spGroupSummary(list,agg,siteRows,cityRows){
  var covered=cityRows.filter(function(r){return r.n>0&&r.city!=='不详'}).length;
  var txt='纳入 <em>'+agg.total+'</em> 人 / <em>'+agg.tumorTotal+'</em> 瘤例，户籍涉及 <em>'+covered+'</em> 个地市。'+
    '已知存活 <b>'+agg.alive+'</b> 人，死亡结案 <b>'+agg.dead+'</b> 人，生存状态不详 <b>'+(agg.total-agg.alive-agg.dead)+'</b> 人；'+
    '另有失访记录 <b>'+agg.lost+'</b> 人。';
  return '<div class="sp-gp-summary"><div class="sp-gp-summary-txt">'+txt+'</div></div>';
}
/* ---- 链条节点指标带：一行 8 项，按防治链条（负担→发现→诊疗→结局→公平）取节点指标，
   值旁标与全省同瘤种基准的差值；已在全省时不显示差值 ---- */
/* 八项核心概况：按《卫健领导关注指标总表》中「画像已有」的官方指标口径，
   每项带参考基准与达标判定；画像未采集的指标不再进指标带 */
function spKpiStrip(list,agg){
  return '<div class="sp-kpi-strip">'+['early','late','stageMissing','basis','mdt','follow','lostRatio','local'].map(function(id){
    return spKpiCard(agg,id);
  }).join('')+'</div>';
}

/* 旧级联漏斗停用：MDT和多方式治疗不是人人必经的路径节点。 */
function spCareCascade(list){
  return '';
}

function spCostContext(list){var people=spPersons(list);return {patientKeys:people.map(spPatientKey),tumorIds:list.map(function(e){return e.id}),patientEventKeys:list.reduce(function(map,e){map[e.id]=spPatientKey(e);return map},{}),cohortSize:people.length,cutoff:spCutoff()}}
function spOverviewViewToggle(){
  return '<div class="sp-overview-view" role="group" aria-label="总览视图">'+['table','chart'].map(function(view){
    var icon='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">'+(view==='table'?'<rect x="3" y="3" width="14" height="14" rx="1.5"/><path d="M3 8h14M3 12.5h14M9 8v9"/>':'<path d="M3 3v14h14M7 13V9M11 13V5M15 13V7"/>')+'</svg>';
    return '<button type="button" data-overview-view="'+view+'" aria-pressed="'+(_spOverviewView===view)+'" aria-controls="spDomainBody" onclick="window._spSetOverviewView(this.dataset.overviewView)">'+icon+(view==='table'?'表格视图':'图表视图')+'</button>';
  }).join('')+'</div>';
}
function renderOverview(){
  var list=spScopeEvents(_spScope);
  var h='<div class="sp-overview-v14"><div class="sp-overview-title"><h2>画像指标总览</h2><div class="sp-overview-actions"><span>示例数据</span>'+spOverviewViewToggle()+'</div></div>'+spScopeBar();
  h+='<div class="sp-domain-tabs" role="tablist" aria-label="画像分析维度"'+(_spOverviewView==='table'?' hidden':'')+'>'+SP_DOMAINS.map(function(d){var active=_spDomain===d.key;return '<button type="button" id="spDomainTab-'+d.key+'" class="sp-domain-tab'+(active?' active':'')+'" role="tab" aria-controls="spDomainBody" aria-selected="'+active+'" aria-pressed="'+active+'" tabindex="'+(active?0:-1)+'" data-domain="'+d.key+'" onkeydown="window._spDomainKey(event,this)" onclick="window._spSetDomain(\''+d.key+'\')">'+d.label+'</button>'}).join('')+'</div>';
  h+='<div id="spDomainBody"'+(_spOverviewView==='chart'?' role="tabpanel" aria-labelledby="spDomainTab-'+_spDomain+'"':'')+'>'+spDomainPanel(list)+'</div>';
  return h+'</div>';
}

/* ---- 五段面板：按肿瘤防治链条组织（疾病负担/早期发现/规范诊疗/生存结局/资源与公平） ----
   全部复用既有图表构件，按链条逻辑归位；数字由个体画像队列实时聚合，不新增采集 */
function spNumber(v){return v===null||v===undefined?'不可计算':String(Math.round(v*10)/10)}
function spMetricValue(m){return m.value===null?m.status:spNumber(m.value)+' '+m.unit}
function spMetricEvidence(m){
  if(m.value===null)return m.status+(m.unknown?' · 不详 '+m.unknown:'');
  return (m.denominator!==null?m.numerator+' / '+m.denominator+' '+(m.statisticalUnit||'瘤例'):'')+
    (m.unknown?' · 不详 '+m.unknown:'')+(m.notApplicable?' · 不适用 '+m.notApplicable:'');
}
function spMetricCards(agg,ids){
  return '<div class="sp-mini-grid sp-overview-mini">'+ids.map(function(id){
    var m=agg.metrics[id];
    return '<div class="sp-mini" title="'+esc(m.definition)+'"><div class="k">'+esc(m.name)+'</div>'+
      '<div class="v">'+esc(spMetricValue(m))+'</div><div class="sp-metric-evidence">'+esc(spMetricEvidence(m))+'</div></div>';
  }).join('')+'</div>';
}
/* 段内指标卡：与顶部指标带同一口径（官方指标名 + 基准 + 达标判定） */
function spKpiStripOf(agg,ids){
  return '<div class="sp-kpi-strip">'+ids.map(function(id){return spKpiCard(agg,id)}).join('')+'</div>';
}
function spDistribution(list,fn){
  var values=new Map();
  list.forEach(function(e){var k=fn(e);k=spKnown(k)?String(k):'不详';values.set(k,(values.get(k)||0)+1)});
  return Array.from(values,function(r){return {k:r[0],v:r[1]}}).sort(function(a,b){return b.v-a.v});
}
function spTreatmentLabel(e){var a=spTreatmentModes(e);return a.length?a.join(' + '):(spRecordValue(e,'treatmentStatus',['treatmentStatusDate'])||'未见有效启动记录')}
function spFollowGap(e){
  var d=spDate(e.lastFu),diag=spDiagnosisDate(e);
  if(!d||d>spCutoff()||(diag&&d<diag))return '日期不详或冲突';
  if(spVital(e)==='死亡')return '死亡结案';
  var days=(Date.parse(spCutoff()+'T00:00:00Z')-Date.parse(d+'T00:00:00Z'))/86400000;
  return days<=30?'0–30 天':days<=90?'31–90 天':days<=180?'91–180 天':'超过 180 天';
}
function spSimpleTable(headers,rows){
  return '<div class="sp-table-wrap"><table class="data-table sp-overview-table"><thead><tr>'+
    headers.map(function(h){return '<th>'+esc(h)+'</th>'}).join('')+'</tr></thead><tbody>'+
    (rows.length?rows.map(function(row){return '<tr>'+row.map(function(v){return '<td>'+esc(v)+'</td>'}).join('')+'</tr>'}).join(''):
      '<tr><td colspan="'+headers.length+'" class="sp-table-empty">无纳入记录</td></tr>')+'</tbody></table></div>';
}
function spDiagYear(e){var d=spDiagnosisDate(e);return d?d.slice(0,4):'不详'}
/* 观察时长：确诊日期 → 死亡日期（已死亡）或末次随访日期，只用画像字段推算，不代表生存率 */
function spObserveBand(e){
  var s=spSurvival(e);
  if(s.n===null)return '日期缺失或冲突';
  var m=s.n;
  return m<6?'<6 个月':m<12?'6–11 个月':m<24?'12–23 个月':'≥24 个月';
}
function spFieldLink(key,bucket,label,cls,ariaLabel){
  return '<button type="button" class="sp-field-link '+(cls||'')+'"'+(ariaLabel?' aria-label="'+esc(ariaLabel)+'"':'')+' data-field-key="'+key+'" data-field-bucket="'+bucket+'" onclick="window._spFieldEvidence(this.dataset.fieldKey,Number(this.dataset.fieldBucket))">'+esc(label)+'</button>';
}
/* 图形只负责表达，所有分段继续使用同一字段汇总及原始 bucket 索引下钻。 */
var SP_FIELD_PALETTE=['#4b82dc','#35a69d','#8d78cb','#d59b40','#ce718d','#549eb9'];
function spFieldColor(key,b,i){
  if(b.state!=='valid')return b.state==='conflict'?'#c3784b':b.state==='na'?'#cbd3de':'#a9b5c6';
  var colors={sex:{'女':'#ce718d','男':'#4b82dc'},stage:{'I期':'#35a69d','II期':'#4b82dc','III期':'#d59b40','IV期':'#ce718d'},insurance:{'职工医保':'#4b82dc','城镇居民':'#35a69d','城乡居民':'#8d78cb'},mdt:{'已开展':'#35a69d','明确未开展':'#8d78cb'},referral:{'有变化':'#4b82dc','未观察到变化':'#35a69d'},vital:{'存活':'#35a69d','存活（带瘤）':'#4b82dc','死亡':'#8d78cb'},followstate:{'随访中':'#35a69d','失访':'#d59b40','死亡结案':'#8d78cb'}};
  if(/^mode\d+$/.test(key))return b.label==='有'?'#4b82dc':'#35a69d';
  if(colors[key]&&colors[key][b.label])return colors[key][b.label];
  /* 长类别字段用名称决定颜色，筛选后同一类别仍保留颜色。 */
  var hash=0;for(var n=0;n<b.label.length;n++)hash=(hash*31+b.label.charCodeAt(n))>>>0;
  return SP_FIELD_PALETTE[(key==='region'||key==='hospital'||key==='screenorg'||key==='site'||key==='tnm'||key==='path'?hash:i)%SP_FIELD_PALETTE.length];
}
function spFieldChartAction(s,b,i){
  var unit=s.field.unit==='患者'?'人':'例',label=b.label+'：'+b.count+' '+unit+'，'+(b.count/s.total*100).toFixed(1)+'%，查看记录';
  return ' class="sp-chart-hit" role="button" tabindex="0" aria-label="'+esc(label)+'" data-field-key="'+s.field.key+'" data-field-bucket="'+i+'" onclick="window._spFieldEvidence(this.dataset.fieldKey,Number(this.dataset.fieldBucket))" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.dispatchEvent(new MouseEvent(\'click\',{bubbles:true}))}"';
}
function spFieldLegend(s,onlyOther){
  var unit=s.field.unit==='患者'?'人':'例';
  return '<div class="sp-chart-legend'+(onlyOther?' sp-chart-exceptions':'')+'">'+s.buckets.map(function(b,i){
    if(onlyOther&&b.state==='valid')return '';
    return '<div class="sp-chart-legend-row"><i style="background:'+spFieldColor(s.field.key,b,i)+'"></i>'+spFieldLink(s.field.key,i,b.label)+'<strong>'+b.count+'<small> '+unit+'</small></strong><span>'+(b.count/s.total*100).toFixed(1)+'%</span></div>';
  }).join('')+'</div>';
}
function spFieldRoundChart(s,pie){
  var angle=-Math.PI/2,offset=0,unit=s.field.unit==='患者'?'人':'例';
  var slices=s.buckets.map(function(b,i){
    var share=b.count/s.total,color=spFieldColor(s.field.key,b,i),action=spFieldChartAction(s,b,i),segment;
    if(pie){
      var end=angle+share*Math.PI*2;
      segment=share===1?'<circle cx="110" cy="110" r="91" fill="'+color+'"'+action+'/>':'<path d="M110 110 L'+(110+91*Math.cos(angle)).toFixed(3)+' '+(110+91*Math.sin(angle)).toFixed(3)+' A91 91 0 '+(share>0.5?1:0)+' 1 '+(110+91*Math.cos(end)).toFixed(3)+' '+(110+91*Math.sin(end)).toFixed(3)+' Z" fill="'+color+'" stroke="var(--color-bg-surface)" stroke-width="2"'+action+'/>';
      if(share>=0.1){var mid=(angle+end)/2,r=share===1?0:58;segment+='<text x="'+(110+r*Math.cos(mid)).toFixed(2)+'" y="'+(115+r*Math.sin(mid)).toFixed(2)+'" class="sp-pie-share">'+(share*100).toFixed(1)+'%</text>'}
      angle=end;
    }else{
      segment='<circle cx="110" cy="110" r="80" fill="none" stroke="'+color+'" stroke-width="28" pathLength="100" stroke-dasharray="'+(share*100)+' '+(100-share*100)+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 110 110)"'+action+'/>';offset+=share*100;
    }
    return segment;
  }).join('');
  return '<div class="sp-round-chart"><svg viewBox="0 0 220 220" role="group" aria-label="'+s.field.label+(pie?'饼图':'环图')+'">'+slices+(!pie?'<text x="110" y="108" class="sp-ring-total">'+s.total+'</text><text x="110" y="132" class="sp-ring-caption">'+unit+'</text>':'')+'</svg>'+spFieldLegend(s,false)+'</div>';
}
function spFieldBarChart(s){
  var max=Math.max.apply(null,s.buckets.map(function(b){return b.count}).concat([1])),unit=s.field.unit==='患者'?'人':'例';
  return '<div class="sp-field-bars">'+s.buckets.map(function(b,i){return '<div class="sp-field-bar-row'+(b.state==='valid'?'':' is-missing')+'">'+spFieldLink(s.field.key,i,b.label)+'<div class="sp-field-track" aria-hidden="true"><i style="width:'+(b.count/max*100)+'%;background:'+spFieldColor(s.field.key,b,i)+'"></i></div><strong>'+b.count+'<small> '+unit+'</small></strong><span>'+(b.count/s.total*100).toFixed(1)+'%</span></div>'}).join('')+'</div>';
}
function spFieldColumns(s){
  var key=s.field.key,bands=spFieldBands(key);
  var max=Math.max.apply(null,s.buckets.filter(function(b){return b.state==='valid'}).map(function(b){return b.count}).concat([1]));
  return '<div class="sp-column-chart" role="group" aria-label="'+s.field.label+'分布柱状图">'+bands.map(function(label,i){
    var index=s.buckets.findIndex(function(b){return b.label===label}),b=index<0?{label:label,count:0,state:'valid'}:s.buckets[index],color=SP_FIELD_PALETTE[i%SP_FIELD_PALETTE.length];
    return '<div class="sp-column-item"><div class="sp-column-plot"><'+(index<0?'div':'button type="button"')+' class="sp-column-bar" style="height:'+(b.count/max*100)+'%;--bar-color:'+color+'"'+(index<0?'':' aria-label="'+label+'：'+b.count+' 例，查看记录" data-field-key="'+key+'" data-field-bucket="'+index+'" onclick="window._spFieldEvidence(this.dataset.fieldKey,Number(this.dataset.fieldBucket))"')+'><span>'+b.count+'<small> 例</small></span></'+(index<0?'div':'button')+'></div><div class="sp-column-label">'+(index<0?esc(label):spFieldLink(key,index,label))+'</div><span class="sp-column-percent">'+(b.count/s.total*100).toFixed(1)+'%</span></div>';
  }).join('')+'</div>'+spFieldLegend(s,true);
}
function spFieldDateChart(s){
  var items=s.buckets.map(function(b,i){return {label:b.label,count:b.count,state:b.state,index:i}}).filter(function(b){return b.state==='valid'}),h='';
  if(items.length){
    function month(label){return Number(label.slice(0,4))*12+Number(label.slice(5,7))-1}
    var first=month(items[0].label),last=month(items[items.length-1].label),span=Math.max(1,last-first),max=Math.max.apply(null,items.map(function(b){return b.count})),ticks=Math.min(4,max),points=[];
    /* 连续月份内没有当前队列记录的月份计为 0；保留真实时间间距。 */
    for(var m=first;m<=last;m++){var label=Math.floor(m/12)+'-'+String(m%12+1).padStart(2,'0'),found=items.find(function(b){return b.label===label});points.push({label:label,count:found?found.count:0,index:found?found.index:-1,x:first===last?236:36+(m-first)/span*400,y:158-(found?found.count:0)/max*116})}
    var line=points.map(function(p,i){return (i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)}).join(' ');
    h='<svg class="sp-date-chart" viewBox="0 0 470 202" role="group" aria-label="'+s.field.label+'按月分布">';
    for(var t=0;t<=ticks;t++){var value=Math.round(max*t/ticks),y=158-value/max*116;h+='<line x1="36" x2="436" y1="'+y+'" y2="'+y+'" class="sp-chart-gridline"/><text x="24" y="'+(y+4)+'" text-anchor="end">'+value+'</text>'}
    h+='<text x="36" y="18">瘤例数</text><path d="'+line+' L'+points[points.length-1].x+' 158 L'+points[0].x+' 158 Z" fill="'+(s.field.key==='lastfu'?'#35a69d':'#4b82dc')+'" opacity=".10"/><path d="'+line+'" fill="none" stroke="'+(s.field.key==='lastfu'?'#35a69d':'#4b82dc')+'" stroke-width="2.5"/>';
    points.forEach(function(p,i){
      if(p.index>=0)h+='<circle cx="'+p.x+'" cy="'+p.y+'" r="5" fill="var(--color-bg-surface)" stroke="'+(s.field.key==='lastfu'?'#35a69d':'#4b82dc')+'" stroke-width="2.5"'+spFieldChartAction(s,s.buckets[p.index],p.index)+'/><text x="'+p.x+'" y="'+(p.y-12)+'" text-anchor="middle" class="sp-date-count">'+p.count+'</text>';
      var step=Math.max(1,Math.ceil((points.length-1)/4));if(i===0||i===points.length-1||(i%step===0&&points.length-1-i>=step/2))h+='<text x="'+p.x+'" y="184" text-anchor="middle">'+p.label+'</text>';
    });
    h+='</svg>';
  }else h='<div class="sp-field-empty">暂无有效日期记录</div>';
  return h+spFieldLegend(s,true)+(items.length?'<details class="sp-chart-data"><summary>查看各月记录</summary><div class="sp-chart-months">'+items.map(function(b){return '<span>'+spFieldLink(s.field.key,b.index,b.label)+'<strong>'+b.count+' 例</strong></span>'}).join('')+'</div></details>':'');
}
function spFieldTreatmentChart(list){
  return '<div class="sp-treatment-chart"><div class="sp-treatment-legend"><span><i style="background:#4b82dc"></i>有记录</span><span><i style="background:#35a69d"></i>明确无</span><span><i style="background:#a9b5c6"></i>未记录</span><span><i style="background:#c3784b"></i>冲突</span></div>'+SP_MODES.map(function(mode,i){
    var s=spFieldSummary(list,'mode'+i),yes=s.buckets.find(function(b){return b.label==='有'}),ordered=s.buckets.map(function(b,index){return {b:b,index:index}}).sort(function(a,b){var order=function(x){return x.label==='有'?0:x.label==='明确无'?1:x.state==='missing'?2:3};return order(a.b)-order(b.b)});
    return '<div class="sp-treatment-row">'+spFieldLink(s.field.key,-1,mode)+'<div class="sp-treatment-stack">'+ordered.map(function(row){var b=row.b,pct=b.count/s.total*100;return '<button type="button" style="width:'+pct+'%;background:'+spFieldColor(s.field.key,b,row.index)+'" aria-label="'+mode+'，'+b.label+'：'+b.count+' 例，查看记录" title="'+b.label+'：'+b.count+' 例（'+pct.toFixed(1)+'%）" data-field-key="'+s.field.key+'" data-field-bucket="'+row.index+'" onclick="window._spFieldEvidence(this.dataset.fieldKey,Number(this.dataset.fieldBucket))">'+(pct>=7?b.count:'')+'</button>'}).join('')+'</div><strong>'+(s.total?((yes?yes.count:0)/s.total*100).toFixed(1)+'%':'—')+'</strong></div>';
  }).join('')+'</div>';
}
function spFieldCard(list,key,title){
  var s=spFieldSummary(list,key),f=s.field,unit=f.unit==='患者'?'人':'例';
  var type=f.kind==='number'?'column':f.kind==='date'?'line':['sex','stage'].indexOf(key)>=0?'pie':['insurance','grade','diag_basis','mdt','referral','vital','followstate'].indexOf(key)>=0?'donut':'bar';
  var body=!s.buckets.length?'<div class="sp-field-empty">暂无纳入记录</div>':type==='pie'||type==='donut'?spFieldRoundChart(s,type==='pie'):type==='column'?spFieldColumns(s):type==='line'?spFieldDateChart(s):spFieldBarChart(s);
  var names={sex:'性别',age:'确诊年龄',insurance:'医保类型',region:'户籍地',hospital:'就诊机构',screenorg:'筛查机构',screentype:'筛查项目',stage:'分期',grade:'分级',site:'原发部位',diag_basis:'诊断依据',path:'病理类型',tnm:'TNM 分期',diagdate:'确诊月份',mdt:'MDT 会诊',referral:'治疗机构变化',tfirst:'首次治疗月份',diag_to_treat:'确诊至首治间隔',vital:'生存状态',followstate:'随访状态',lastfu:'末次随访月份',survival:'观察时长'};
  return '<section class="panel sp-field-card" data-overview-field="'+key+'" data-chart-type="'+type+'"><div class="panel-header"><h3>'+esc(title||names[key]||f.label)+'</h3><div class="sp-chart-tools"><span>'+unit+'</span>'+spFieldLink(key,-1,'明细')+'</div></div><div class="panel-body">'+
    (f.kind==='number'?'<div class="sp-field-median"><span>中位数</span><strong>'+(s.median===null?'—':spNumber(s.median))+'</strong><span>'+(key==='age'?'岁':key==='diag_to_treat'?'天':'个月')+'</span></div>':'')+
    body+'</div></section>';
}
function spOverviewTreatment(list){
  return '<section class="panel sp-overview-treatment"><div class="panel-header"><span>治疗方式</span><span class="sp-treatment-unit">例 / 有记录占比</span></div>'+spFieldTreatmentChart(list)+'<details class="sp-treatment-details"><summary>查看明细</summary><div class="sp-table-wrap"><table class="data-table sp-field-table"><thead><tr><th>治疗方式</th><th>有记录</th><th>占比</th><th>明确无</th><th>未记录</th><th>冲突</th><th>明细</th></tr></thead><tbody>'+SP_MODES.map(function(mode,i){var key='mode'+i,s=spFieldSummary(list,key),yes=s.rows.filter(function(r){return r.result.value==='有'}).length,no=s.rows.filter(function(r){return r.result.value==='明确无'}).length;return '<tr><td>'+mode+'</td><td>'+yes+' 例</td><td>'+(s.total?(yes/s.total*100).toFixed(1)+'%':'—')+'</td><td>'+no+'</td><td class="sp-field-missing">'+s.missing+'</td><td>'+s.conflict+'</td><td>'+spFieldLink(key,-1,'查看记录')+'</td></tr>'}).join('')+'</tbody></table></div></details></section>';
}
function spOverviewRecords(list,section){
  var config=section.records,rows=spUnique(list,spTumorKey).filter(function(e){return !config.deathsOnly||spDeathFieldApplies(e)});
  return '<details class="sp-overview-records" data-record-section="'+section.key+'"><summary>'+config.title+'<span>'+rows.length+' 例</span></summary><div class="sp-table-wrap"><table class="data-table sp-field-table"><thead><tr><th>患者</th><th>原发部位</th>'+config.keys.map(function(k){return '<th data-record-field="'+k+'">'+esc(spProfileField(k).label)+'</th>'}).join('')+'<th>画像</th></tr></thead><tbody>'+(rows.length?rows.map(function(e){return '<tr data-record-event="'+esc(e.id)+'"><td>'+esc(e.patient)+'</td><td>'+esc(spProfileRead(e,'site').text)+'</td>'+config.keys.map(function(k){return '<td data-record-value="'+k+'">'+esc(spProfileRead(e,k).text)+'</td>'}).join('')+'<td><button type="button" class="sp-field-link" data-event-id="'+esc(e.id)+'" onclick="window._spEvidencePatient(this.dataset.eventId)">查看画像</button></td></tr>'}).join(''):'<tr><td colspan="'+(config.keys.length+3)+'" class="sp-field-empty">暂无死亡记录</td></tr>')+'</tbody></table></div></details>';
}
/* 表格和图表使用同一字段汇总；补零行只补展示，不新增证据 bucket。 */
function spFieldTableBuckets(s){
  var rows=s.buckets.map(function(b,i){return {label:b.label,count:b.count,state:b.state,index:i}}),valid=rows.filter(function(b){return b.state==='valid'});
  if(s.field.kind==='number'){
    return spFieldBands(s.field.key).map(function(label){return valid.find(function(b){return b.label===label})||{label:label,count:0,state:'valid',index:-1}}).concat(rows.filter(function(b){return b.state!=='valid'}));
  }
  if(s.field.kind==='date'&&valid.length){
    function month(label){return Number(label.slice(0,4))*12+Number(label.slice(5,7))-1}
    var months=[],last=month(valid[valid.length-1].label);
    for(var m=month(valid[0].label);m<=last;m++){
      var label=Math.floor(m/12)+'-'+String(m%12+1).padStart(2,'0');
      months.push(valid.find(function(b){return b.label===label})||{label:label,count:0,state:'valid',index:-1});
    }
    return months.concat(rows.filter(function(b){return b.state!=='valid'}));
  }
  return rows;
}
function spStatCount(s,b,index){
  var unit=s.field.unit==='患者'?'人':'例';
  return index<0?'<span class="sp-stat-zero">'+b.count+'</span>':spFieldLink(s.field.key,index,String(b.count),'sp-stat-count-link',s.field.label+'，'+b.label+'：'+b.count+' '+unit+'，查看记录');
}
/* 一个字段对应同一总表内的一组行；所有分类完整展开，原 bucket 索引保持不变。 */
function spSummaryFieldRows(list,key){
  var s=spFieldSummary(list,key),f=s.field,unit=f.unit==='患者'?'人':'例',rows=spFieldTableBuckets(s);
  if(!rows.length)rows=[{label:'暂无纳入记录',count:0,state:'empty',index:-1}];
  var titles={age:'确诊年龄',stage:'分期期别',mdt:'MDT 会诊',tfirst:'首次治疗月份',diag_to_treat:'确诊至首治间隔',lastfu:'末次随访月份',survival:'观察时长'};
  var median=f.kind==='number'?'<span class="sp-stat-median">中位数 <strong>'+(s.median===null?'—':spNumber(s.median))+'</strong> '+(key==='age'?'岁':key==='diag_to_treat'?'天':'个月')+'</span>':'';
  var hint=key==='hospital'?'<span class="sp-summary-hint">一人可计入多家机构，人数与占比不相加。</span>':'';
  return '<tbody data-stat-field="'+key+'" id="spStatRows-'+key+'">'+rows.map(function(b,i){
    return '<tr data-stat-bucket="'+b.index+'" data-stat-state="'+b.state+'">'+
      (i===0?'<th scope="rowgroup" rowspan="'+rows.length+'" class="sp-summary-metric" title="'+esc(f.rule)+'">'+spFieldLink(key,-1,titles[key]||f.label)+median+hint+'</th>':'')+
      '<th scope="row" class="sp-stat-category">'+esc(b.label)+'</th><td class="sp-stat-number"><span data-stat-count>'+spStatCount(s,b,b.index)+'</span><small> '+unit+'</small></td><td class="sp-stat-number" data-stat-share>'+(s.total?(b.count/s.total*100).toFixed(1)+'%':'—')+'</td>'+
      (i===0?'<td rowspan="'+rows.length+'" class="sp-stat-number sp-summary-total" data-stat-total>'+s.total+' '+unit+'</td>':'')+'</tr>';
  }).join('')+'</tbody>';
}
function spOverviewStatsTable(list){
  var rows=SP_PROFILE_SECTIONS.map(function(section){
    var fields=SP_PROFILE_FIELDS.filter(function(f){return f.dim===section.label});
    return '<tbody data-summary-section="'+section.key+'"><tr class="sp-summary-section"><th colspan="5" scope="colgroup">'+esc(section.label)+'<span>'+fields.length+' 项指标</span></th></tr></tbody>'+fields.map(function(f){return spSummaryFieldRows(list,f.key)}).join('');
  }).join('');
  rows+=window.SPCost&&window.SPCost.renderPopulationRows?window.SPCost.renderPopulationRows(spCostContext(list)):'<tbody data-summary-section="cost"><tr class="sp-summary-section"><th colspan="5" scope="colgroup">医保费用</th></tr><tr><td colspan="5" class="sp-field-empty">医保费用模块未加载</td></tr></tbody>';
  return '<div class="sp-overview-stats"><div class="sp-summary-toolbar"><strong>全部画像指标</strong><span>四类画像与医保费用在同一张表中查看 · 点击数量查看记录</span></div><div class="sp-summary-scroll" tabindex="0" role="region" aria-label="全部画像指标统计表，可滚动"><table class="sp-stat-table sp-summary-table" id="spOverviewTable"><caption class="sp-sr-only">画像指标总览，当前范围 '+esc(spScopeLabel())+'</caption><colgroup><col class="sp-summary-metric-col"><col class="sp-summary-category-col"><col class="sp-summary-value-col"><col class="sp-summary-share-col"><col class="sp-summary-total-col"></colgroup><thead><tr><th scope="col">画像指标</th><th scope="col">分类 / 分段 / 月份</th><th scope="col" class="sp-stat-number">数量 / 金额</th><th scope="col" class="sp-stat-number">占比</th><th scope="col" class="sp-stat-number">纳入总数 / 基数</th></tr></thead>'+rows+'</table></div><p class="sp-stat-table-note">各指标使用各自纳入总数计算占比，未记录、冲突及不适用项均保留；费用占比以医疗总费用为基数。</p></div>';
}
function spDomainPanel(list){
  if(!list.length)return '<div class="sp-gp-empty">当前范围无纳入画像。<br><button class="btn btn-outline btn-sm" onclick="window._spScopeReset()">重置筛选条件</button></div>';
  if(_spOverviewView==='table')return spOverviewStatsTable(list);
  if(_spDomain==='cost')return window.SPCost&&window.SPCost.renderPopulation?window.SPCost.renderPopulation(spCostContext(list),{view:'chart'}):'<div class="sp-field-empty">医保费用模块未加载</div>';
  var section=spProfileSection(_spDomain);
  if(!section){_spDomain='burden';section=spProfileSection('burden')}
  var h=section.charts.map(function(group){
    if(group.kind==='treatment')return spOverviewTreatment(list);
    return '<div class="sp-field-grid '+(group.layout||'')+'">'+group.keys.map(function(k){return spFieldCard(list,k)}).join('')+'</div>';
  }).join('');
  return h+(section.records?spOverviewRecords(list,section):'');
}
function spMetricsFlatRows(){
  var list=spScopeEvents(_spScope),out=[['分区','画像字段','统计项','数值','单位','统计对象','分母','有效记录','未记录','冲突','不适用','字段来源','统计口径','范围','统计截止日','口径版本','数据来源']];
  function add(f,label,value,unit,s,rule){out.push([f.dim,f.label,label,value,unit,f.unit,s.total,s.valid,s.missing,s.conflict,s.na,f.source,rule||f.rule,spScopeLabel(),spCutoff(),'V14','内置样例'])}
  SP_PROFILE_FIELDS.forEach(function(f){var s=spFieldSummary(list,f.key);add(f,'有效记录',s.valid,f.unit==='患者'?'人':'例',s);s.buckets.forEach(function(b){add(f,b.label,b.count,f.unit==='患者'?'人':'例',s)});if(f.kind==='number')add(f,'中位数',s.median===null?'—':s.median,f.key==='age'?'岁':f.key==='diag_to_treat'?'天':'个月',s)});
  if(window.SPCost){
    var m=window.SPCost.populationModel(spCostContext(list)),a=m.stats,has=a&&a.count;
    function costRow(label,value,unit,den,rule){out.push(['医保费用分析',label,label,value===null?'—':value,unit,'患者 / 结算',den===null?'':den,'','','','','医保结算',rule||'仅统计明确关联单一瘤例的结算净额；共同费用另列',spScopeLabel(),m.asOf,'V14',m.demo?'演示结算':m.available?'已接入结算':'未接入'])}
    costRow('群体累计医疗费用',has?a.total/100:null,'元',null);
    costRow('费用覆盖患者',m.available?m.patients:null,'人',m.cohort);
    costRow('人均医疗费用',has&&m.patients?Math.round(a.total/m.patients)/100:null,'元',m.patients);
    costRow('个人支付占比',has&&a.paymentComplete?+(a.personal/a.total*100).toFixed(1):null,'%',has?a.total/100:null);
    costRow('省外费用占比',has&&a.outOfProvince!==null?+(a.outOfProvince/a.total*100).toFixed(1):null,'%',has?a.total/100:null);
    if(has){
      [['医保基金支付',a.fund],['个人支付',a.personal],['其他保障支付',a.other]].forEach(function(r){costRow(r[0],a.paymentComplete?r[1]/100:null,'元',null);costRow(r[0]+'占比',a.paymentComplete?+(r[1]/a.total*100).toFixed(1):null,'%',a.total/100)});
      ['药品费','检查检验费','治疗费','手术费','耗材费','其他费用'].forEach(function(label){var v=a.itemsComplete?(a.items[label]||0):null;costRow(label,v===null?null:v/100,'元',null);costRow(label+'占比',v===null?null:+(v/a.total*100).toFixed(1),'%',a.total/100)});
      costRow('共同关联费用',m.sharedTotal/100,'元',null,'多瘤例共同结算单列，不纳入主统计');
    }
  }
  return out;
}
window._spFieldEvidence=function(key,bucket){
  if(!spProfileField(key))return;
  var list=spScopeEvents(_spScope),s=spFieldSummary(list,key),selected=bucket>=0?s.buckets[bucket]:null;
  var rows=selected?s.rows.filter(function(r){return r.buckets.indexOf(selected.label)>=0}):s.rows;
  var body='<div class="sp-evidence-context"><strong>'+s.field.label+(selected?' / '+esc(selected.label):'')+'</strong><p>当前 '+rows.length+' '+(s.field.unit==='患者'?'人':'例')+' · 截至 '+spCutoff()+'</p></div><div class="sp-table-wrap"><table class="data-table sp-field-table"><thead><tr><th>患者 / 报告卡</th><th>原发部位</th><th>'+s.field.label+'</th><th>患者画像</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+esc(r.event.patient)+'<small class="sp-evidence-sub">'+esc(r.events.map(spReportCardNo).join('、'))+'</small></td><td>'+esc(r.events.map(function(e){return e.laterality||'未记录'}).join('、'))+'</td><td>'+esc(r.result.text)+(r.result.state==='conflict'?'<small class="sp-evidence-sub">'+r.events.map(function(e){return esc(spReportCardNo(e)+': '+spProfileRead(e,key).text)}).join('<br>')+'</small>':'')+'</td><td>'+r.events.map(function(e){return '<button class="sp-field-link" data-event-id="'+esc(e.id)+'" onclick="window._spEvidencePatient(this.dataset.eventId)">查看画像'+(r.events.length>1?' · '+esc(e.laterality||e.site):'')+'</button>'}).join('<br>')+'</td></tr>'}).join('')+'</tbody></table></div>';
  var mask=spModal(s.field.label+'明细',body,'<button class="btn btn-ghost" data-sp-close>关闭</button>');
  mask.classList.add('sp-field-evidence');mask.setAttribute('role','dialog');mask.setAttribute('aria-modal','true');mask.setAttribute('aria-label',s.field.label+'明细');
  var opener=document.activeElement;mask.querySelector('button').focus();
  mask.addEventListener('keydown',function(e){if(e.key==='Escape'){mask.remove();if(opener&&opener.isConnected)opener.focus()}if(e.key==='Tab'){var buttons=Array.from(mask.querySelectorAll('button')),first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
};
window._spEvidencePatient=function(id){
  var list=spScopeEvents(_spScope);if(!list.some(function(e){return e.id===id}))return;
  _wbOverviewSelection={scope:Object.assign({},_spScope),ids:list.map(function(e){return e.id}),label:spScopeLabel()};
  _wbFilters={q:'',site:'',city:'',hospital:'',fu:'',mp:''};_wbDetail=id;
  if(typeof navigateTo==='function')navigateTo('sp-patients');else{_spSub='workbench';spRefresh()}
};

function spIssuesPanel(list,siteRows,cityRows){
  var gAgg=spAgg(list);
  var issues=[];
  /* 段② 早期发现：地区晚期偏高 */
  cityRows.filter(function(r){return r.n>0&&r.agg.lateRate>=50}).forEach(function(r){
    issues.push({tone:'danger',type:'早期发现',msg:esc(r.city)+'晚期（Ⅳ期）占比 '+r.agg.lateRate+'%，高于全省平均（'+gAgg.lateRate+'%）',act:'early',city:r.city,site:''});
  });
  /* 段⑤ 资源与公平：病种外流偏高 */
  siteRows.filter(function(r){var out=r.list.filter(spOutCity).length;return r.n>=2&&out/r.n>=0.5}).forEach(function(r){
    issues.push({tone:'caution',type:'资源与公平',msg:esc(r.site)+'癌跨市就医率 '+Math.round(r.list.filter(spOutCity).length/r.n*100)+'%',act:'equity',city:'',site:r.site});
  });
  /* 段④ 生存结局：机构失访 */
  var hospLost={};list.filter(function(e){return e.lostFollow}).forEach(function(e){hospLost[e.hospital]=(hospLost[e.hospital]||0)+1});
  Object.keys(hospLost).forEach(function(hp){
    issues.push({tone:'caution',type:'生存结局',msg:esc(hp)+' '+hospLost[hp]+' 例失访',act:'outcome',city:'',site:''});
  });
  if(!issues.length){
    return '<div class="sp-notes sp-notes-clean"><span class="sp-notes-ico">✓</span>当前范围（'+esc(spScopeLabel())+'）画像各环节未见明显短板</div>';
  }
  var chips=issues.map(function(it){
    return '<button class="sp-note sp-note-'+it.tone+'" onclick="window._spGoIssue(\''+it.act+'\',\''+esc(it.city)+'\',\''+esc(it.site)+'\')" title="跳转到「'+esc(it.type)+'」并带筛选查看患者">'+
      '<span class="sp-note-seg">'+esc(it.type)+'</span>'+
      '<span class="sp-note-msg">'+it.msg+'</span>'+
      '<span class="sp-note-go">查看 ›</span></button>';
  }).join('');
  return '<div class="sp-notes-wrap"><div class="sp-notes-head"><span>需关注提示</span><span class="sp-notes-sub">画像速览短板 · 点击跳对应环节查看患者（正式阈值告警见「预警监测」模块）</span></div><div class="sp-notes">'+chips+'</div></div>';
}


/* ===================== 六、01 患者专科画像 ===================== */
var _wbFilters={q:'',site:'',city:'',hospital:'',fu:'',mp:''};
var _wbDetail=null;
var _wbOverviewSelection=null;

function spWbFiltered(){
  var source=_wbOverviewSelection?spScopeEvents(_wbOverviewSelection.scope).filter(function(e){return _wbOverviewSelection.ids.indexOf(e.id)>=0}):spUnique(tumorEvents,spTumorKey);
  return source.filter(function(e){
    var q=_wbFilters.q;
    if(q){
      /* 关键字按报告卡编号 / 姓名 / 身份证号匹配；瘤种、地市、医院各有独立下拉，不再挤在关键字里重复一遍 */
      var hit=[spReportCardNo(e),e.patient,e.idNo].some(function(x){return String(x||'').toUpperCase().indexOf(q.toUpperCase())>=0});
      if(!hit)return false;
    }
    if(_wbFilters.site&&e.site!==_wbFilters.site)return false;
    if(_wbFilters.city&&e.city!==_wbFilters.city)return false;
    if(_wbFilters.hospital&&spPatientHospitals(e).indexOf(spNormHospital(_wbFilters.hospital))<0)return false;
    if(_wbFilters.fu&&spFollowState(e)!==_wbFilters.fu)return false;
    var mp=spIsMultiPrimary(e);
    if(_wbFilters.mp==='是'&&!mp)return false;
    if(_wbFilters.mp==='否'&&mp)return false;
    return true;
  });
}
function spFuCls(e){
  if(e.followStatus==='失访')return 'badge-danger';
  if(e.followStatus==='死亡结案')return 'badge-neutral';
  return 'badge-success';
}
/* 列表页「随访状态」列：单标签，取生存状态值（存活 / 存活（带瘤）/ 失访 / 死亡） */
function spFuVitalCell(e){
  var v=spLost(e)===true&&spVital(e)!=='死亡'?'失访':spVital(e);
  var cls=v==='死亡'?'badge-neutral':(v==='失访'?'badge-danger':(v.indexOf('带瘤')>=0?'badge-caution':'badge-success'));
  return badge(v,cls);
}
/* 列表页「是否多原发」列：该患者在本队列内≥2 个独立瘤例，或瘤例本身标记为多原发 → 是 */
function spIsMultiPrimary(e){
  if(!e)return false;
  return e.multiPrimary===true||spPatientTumors(e).length>1;
}
function spMultiCell(e){
  var yes=spIsMultiPrimary(e);
  return '<span class="badge '+(yes?'badge-caution':'badge-neutral')+'">'+(yes?'是':'否')+'</span>';
}
function renderWorkbench(){
  if(_wbDetail){
    var source=_wbOverviewSelection?spScopeEvents(_wbOverviewSelection.scope):spUnique(tumorEvents,spTumorKey);
    var ev=source.filter(function(e){return e.id===_wbDetail})[0];
    if(ev)return spDetailPage(ev);
  }
  var list=spWbFiltered();
  var sites=Array.from(new Set(SP_SITES.concat(tumorEvents.map(function(e){return e.site}).filter(spKnown))));
  var bar='<div class="sp-filter-bar">'+
    '<div class="form-group wide"><label>关键字</label><input id="spWbQ" placeholder="报告卡编号 / 姓名 / 身份证号" value="'+esc(_wbFilters.q)+'"></div>'+
    '<div class="form-group"><label>瘤种</label><select id="spWbSite"><option value="">全部</option>'+sites.map(function(s){return '<option'+(s===_wbFilters.site?' selected':'')+'>'+esc(s)+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>地市</label><select id="spWbCity"><option value="">全部</option>'+SP_CITIES.map(function(c){return '<option'+(c===_wbFilters.city?' selected':'')+'>'+c+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>医院</label><select id="spWbHospital"><option value="">全部</option>'+SP_HOSPITALS.map(function(h){return '<option'+(h===_wbFilters.hospital?' selected':'')+'>'+esc(h)+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>随访状态</label><select id="spWbFu"><option value="">全部</option>'+['随访中','失访','死亡结案'].map(function(s){return '<option'+(s===_wbFilters.fu?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>是否多原发</label><select id="spWbMp"><option value="">全部</option>'+['是','否'].map(function(s){return '<option'+(s===_wbFilters.mp?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
    '<div class="sp-filter-actions"><button class="btn btn-ghost btn-sm" onclick="window._spWbReset()">重置</button><button class="btn btn-primary btn-sm" onclick="window._spWbQuery()">查询</button></div>'+
  '</div>';
  var rows=list.map(function(e){
    /* 首列报告卡编号是本行的跳转入口：点编号进该瘤例的画像详情（stopPropagation 避免与整行点击叠加） */
    return '<tr style="cursor:pointer" onclick="window._spOpenDetail(\''+e.id+'\')">'+
      '<td class="code"><a href="javascript:void(0)" class="sp-card-no" title="查看该报告卡的画像详情" onclick="event.stopPropagation();window._spOpenDetail(\''+e.id+'\')">'+esc(spReportCardNo(e))+'</a></td>'+
      '<td style="font-weight:600">'+esc(e.patient)+'</td><td>'+esc(e.sex)+'</td>'+
      /* 确诊日期紧挨「确诊时年龄」放在其左侧：日期是原始事实，年龄由它推算，先因后果 */
      '<td class="code">'+esc(spDiagnosisDate(e)||'—')+'</td><td>'+spNumber(spAge(e))+'</td>'+
      '<td>'+esc(e.city)+'</td><td>'+spHospSpan(e)+'</td>'+
      /* 原发部位取画像详情里同一个字段（laterality：右肺上叶/左乳/胃窦…），
         ICD10 沿用 spIcd10 的既有口径（由部位码截主码，C34.9→C34），与详情页「ICD-10」一致 */
      '<td>'+esc(e.laterality||e.site||'—')+'</td>'+
      '<td class="code" title="'+esc('癌种 '+e.site+' · ICD-O-3 部位码 '+(spTopoCode(e)||'—'))+'">'+esc(spIcd10(e)||'—')+'</td>'+
      '<td>'+esc(e.path)+'</td>'+
      '<td>'+spMultiCell(e)+'</td>'+
      '<td>'+spFuVitalCell(e)+'</td>'+    '</tr>';
  }).join('');
  var table='<div class="panel"><div class="panel-header"><span>患者列表<span class="spr-count">共 '+list.length+' 例 · 全部 '+tumorEvents.length+' 例</span></span></div>'+
    '<div class="sp-table-wrap"><table class="data-table" style="min-width:1120px"><thead><tr><th class="code">报告卡编号</th><th class="txt">患者</th><th class="code">性别</th><th class="code">确诊日期</th><th class="num">确诊时年龄</th><th class="txt">户籍地市</th><th class="txt">就诊医院</th><th class="txt">原发部位</th><th class="code">ICD-10</th><th>病理</th><th class="code">是否多原发</th><th class="code">随访状态</th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="12" style="text-align:center;color:var(--color-text-muted);padding:30px 0">无符合条件的患者</td></tr>')+
    '</tbody></table></div></div>';
  var context=_wbOverviewSelection?'<div class="sp-overview-context"><span>总览队列 · '+esc(_wbOverviewSelection.label)+'</span>'+
    '<button class="btn btn-ghost btn-sm" onclick="navigateTo(\'sp-overview\')">返回总览</button></div>':'';
  return context+bar+table;
}

/* ---- 详情：摘要条 + 四块画像 + 时间线 ---- */
function spProfileCompleteness(e){
  var checks=spCoreChecks(e),ok=checks.filter(function(c){return c.ok}).length;
  return {ok:ok,n:checks.length,rate:Math.round(ok/checks.length*100)};
}

function spKv(label,value,raw){
  return '<div class="sp-kv-item"><span class="k">'+esc(label)+'</span><span class="v">'+(raw?value:(esc(value)||'—'))+'</span></div>';
}
/* 键值同行（短值：日期/编码/类别），压缩纵向高度 */
function spKvI(label,value,raw){
  return '<div class="sp-kv-item sp-inline"><span class="k">'+esc(label)+'</span><span class="v">'+(raw?value:(esc(value)||'—'))+'</span></div>';
}
/* 块内分组小标题 + 通栏长文项（用于诊断依据/时间线等长文本） */
function spSub(title){
  return '<div class="sp-sub-head">'+esc(title)+'</div>';
}
function spTimeline(e){
  var nodes=[{d:e.firstDate,c:'首诊 · '+e.firstHosp}];
  if(e.stageDate)nodes.push({d:e.stageDate,c:'明确诊断 · '+spTumorName(e)+' '+e.stage});
  var segs=(e.phaseTimeline||'').split('→');
  segs.forEach(function(s){
    var m=s.match(/(.+?)\((\d{4}-\d{2}-\d{2})\)/);
    if(m)nodes.push({d:m[2],c:m[1]});
  });
  (SP_EXAMS[e.id]||[]).forEach(function(x){if(x.hot)nodes.push({d:x.d,c:(x.k==='检查'?'检查 · ':'检验 · ')+x.n+'：'+x.r,t:1})});
  spInstitutionChanges(e).changes.forEach(function(x){nodes.push({d:x.d,c:'治疗机构变化 · '+x.from+' → '+x.to+'（'+x.current.tumorName+'）',t:2})});
  nodes.push({d:e.lastFu,c:'最近随访 · '+e.followStatus});
  var seen={},uniq=[];
  nodes.forEach(function(nd){
    var k=nd.d+'|'+nd.c;
    if(!seen[k]){seen[k]=1;uniq.push(nd)}
  });
  uniq.sort(function(a,b){return a.d<b.d?-1:1});
  return '<div class="sp-tl-legend"><span><i style="background:var(--color-primary)"></i>诊疗节点</span><span><i style="background:#f59e0b"></i>检查检验（影像/检验）</span><span><i style="background:#14b8a6"></i>治疗机构变化（患者全部治疗）</span></div><div class="sp-timeline">'+uniq.map(function(nd){
    return '<div class="sp-tl-item'+(nd.t===1?' sp-tl-exam':nd.t===2?' sp-tl-ref':'')+'"><div class="sp-tl-date">'+esc(nd.d)+'</div><div class="sp-tl-content">'+esc(nd.c)+'</div></div>';
  }).join('')+'</div>';
}
function spExamTable(pid){
  var list=SP_EXAMS[pid]||[];
  if(!list.length)return '<div class="sp-chart-empty">暂无检查检验记录</div>';
  return '<div class="sp-table-wrap"><table class="data-table" style="min-width:620px"><thead><tr><th style="width:96px">时间</th><th style="width:60px">类型</th><th style="width:210px">项目</th><th class="txt">结果（结论）</th><th style="width:88px">操作</th></tr></thead><tbody>'+
  list.map(function(x,i){
    return '<tr><td>'+esc(x.d)+'</td><td>'+badge(x.k,x.k==='检查'?'badge-info':'badge-accent')+'</td><td>'+esc(x.n)+'<div style="font-size:var(--fs-2xs);color:var(--color-text-muted)">'+esc(x.org)+'</div></td><td class="txt"'+((x.abn)?' style="color:var(--color-danger-fg)"':'')+'>'+esc(x.r)+'</td><td class="ops"><button class="btn btn-ghost btn-xs" onclick="window._spExamView(\''+pid+'\','+i+')">查看结果</button></td></tr>';
  }).join('')+'</tbody></table></div>';
}
function spRefTable(pid){
 var e=tumorEvents.find(function(t){return t.id===pid}),derived=spInstitutionChanges(e),list=derived.changes;
 var note='<p class="sp-transfer-note">按患者全部治疗执行记录的时间顺序生成，治疗机构变化即记一条；同院连续治疗合并，跨院后返回保留记录。仅表示观察到的机构变化。</p>';
 if(derived.pending.length)note+='<details class="sp-transfer-note"><summary>'+derived.pending.length+' 条治疗记录待补全或确认时序</summary><ul>'+derived.pending.map(function(x){return '<li>'+esc(x.record.date||'日期未记录')+' · '+esc(x.record.hospital||'机构未记录')+' · '+esc(x.reason)+'</li>'}).join('')+'</ul></details>';
 if(!list.length)return note+'<div class="sp-chart-empty">'+(derived.state===null?'治疗记录不足，暂无法判定机构变化':'已有治疗记录未观察到机构变化')+'</div>';
 return note+'<div class="sp-table-wrap"><table class="data-table" style="min-width:760px"><thead><tr><th>变化日期</th><th>前次治疗机构</th><th>本次治疗机构</th><th>治疗依据</th><th>来源</th></tr></thead><tbody>'+list.map(function(x){
  return '<tr><td>'+esc(x.d)+'</td><td>'+esc(x.from)+'<div class="sp-transfer-evidence">前次治疗 '+esc(x.previous.date)+'</div></td><td>'+esc(x.to)+'<div class="sp-transfer-evidence">本次治疗 '+esc(x.current.date)+'</div></td><td>'+esc(x.previous.mode||'治疗')+' → '+esc(x.current.mode||'治疗')+'<div class="sp-transfer-evidence">'+esc(x.current.tumorName)+' · '+esc(x.current.plan||'—')+'</div></td><td>自动生成<div class="sp-transfer-evidence">治疗执行记录</div></td></tr>';
 }).join('')+'</tbody></table></div>';
}
function spRptSec(title,bodyHtml){return '<div class="sp-rpt-sec"><div class="sp-rpt-t">'+esc(title)+'</div><div class="sp-rpt-c">'+bodyHtml+'</div></div>'}
/* ================= 检查检验结果弹窗：字段严格对齐《江西省全民健康信息平台数据接口规范 V3.1》 =================
   对照口径（只展示接口文档存在的字段，不新增任何自定义字段）：
   · 检查 → 检查记录 examination_record（CDR_5411）  + 检查项目 examination_exam
   · 检验 → 检验记录 inspection_record（CDR_5401）   + 检验结果(常规) inspection_test_res
   影像 → 检查记录.image_link / innet_image_link / doc_format（附件类型 14DICOM）与 8.3 DICOM 影像采集接口
   注意：SP_EXAMS / tumorEvents / esc / badge 均为本 IIFE 私有，故必须内联，不可拆成外部脚本。 */
/* ---- 影像材料登记表：key = 检查日期|检查项目名（对应 检查记录.image_link / innet_image_link 所指的 DICOM 影像） ----
   src: 影像地址（data URI / 相对路径 / PACS 预览图 URL）  roi: 病灶标注（相对主图百分比）  size: 报告中的测量值  series: 序列 */
var EXAM_IMAGES = {
  '2026-01-19|胸部DR': {
    src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="760" height="760" viewBox="0 0 400 400">' +
      '<rect width="400" height="400" fill="#0d0d0d"/>' +
      '<ellipse cx="200" cy="212" rx="150" ry="176" fill="#1b1b1b"/>' +
      '<ellipse cx="140" cy="196" rx="62" ry="120" fill="#2c2c2c"/>' +
      '<ellipse cx="262" cy="196" rx="62" ry="120" fill="#2c2c2c"/>' +
      '<path d="M140 92 Q140 220 150 300" stroke="#3a3a3a" stroke-width="7" fill="none"/>' +
      '<path d="M262 92 Q262 220 252 300" stroke="#3a3a3a" stroke-width="7" fill="none"/>' +
      '<path d="M155 132 L185 146 M155 162 L188 174 M155 192 L186 202" stroke="#4a4a4a" stroke-width="4" fill="none"/>' +
      '<path d="M247 132 L217 146 M247 162 L214 174 M247 192 L216 202" stroke="#4a4a4a" stroke-width="4" fill="none"/>' +
      '<ellipse cx="200" cy="206" rx="46" ry="68" fill="#242424"/>' +
      '<ellipse cx="232" cy="150" rx="31" ry="27" fill="#737373" opacity="0.94"/>' +
      '<ellipse cx="232" cy="150" rx="31" ry="27" fill="none" stroke="#d0d0d0" stroke-width="1.3" stroke-dasharray="5 4"/>' +
      '<text x="20" y="32" fill="#8a8a8a" font-size="14" font-family="sans-serif">L</text>' +
      '<text x="368" y="32" fill="#8a8a8a" font-size="14" font-family="sans-serif">R</text>' +
      '<text x="20" y="386" fill="#6a6a6a" font-size="10" font-family="sans-serif">120kVp 4mAs STAND</text>' +
      '</svg>'),
    roi: { x: 58, y: 37, r: 11 },
    size: '3.2 × 2.7 cm'
  },
  '2026-01-28|胸部CT增强': {
    src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="760" height="760" viewBox="0 0 400 400">' +
      '<rect width="400" height="400" fill="#0b0b0b"/>' +
      '<ellipse cx="200" cy="200" rx="168" ry="158" fill="#202020"/>' +
      '<ellipse cx="200" cy="210" rx="150" ry="128" fill="#141414"/>' +
      '<ellipse cx="128" cy="205" rx="52" ry="86" fill="#2a2a2a" opacity="0.85"/>' +
      '<ellipse cx="272" cy="205" rx="52" ry="86" fill="#2a2a2a" opacity="0.85"/>' +
      '<path d="M150 240 Q200 268 250 240" stroke="#3d3d3d" stroke-width="8" fill="none"/>' +
      '<ellipse cx="200" cy="200" rx="30" ry="40" fill="#1c1c1c"/>' +
      '<ellipse cx="258" cy="152" rx="34" ry="30" fill="#8a8a8a" opacity="0.95"/>' +
      '<ellipse cx="258" cy="152" rx="34" ry="30" fill="none" stroke="#e0e0e0" stroke-width="1.3" stroke-dasharray="5 4"/>' +
      '<ellipse cx="176" cy="118" rx="17" ry="15" fill="#6f6f6f" opacity="0.9"/>' +
      '<ellipse cx="176" cy="118" rx="17" ry="15" fill="none" stroke="#cfcfcf" stroke-width="1.2" stroke-dasharray="4 3"/>' +
      '<text x="20" y="32" fill="#8a8a8a" font-size="14" font-family="sans-serif">L</text>' +
      '<text x="368" y="32" fill="#8a8a8a" font-size="14" font-family="sans-serif">R</text>' +
      '<text x="20" y="386" fill="#6a6a6a" font-size="10" font-family="sans-serif">WL 40 WW 400 CE</text>' +
      '</svg>'),
    roi: { x: 64, y: 38, r: 12 },
    size: '3.4 × 2.8 cm'
  }
};

var SP_PACS_STORE_CODE = '123502004266007916';   /* 影像云索引「存储单位代码」示例值（接口文档 8.x 影像云索引规则） */

/* 由结果提示（↑↓+）判定检查结果代码 CC04_30_017：1正常 2异常 3不确定 */
function spResCode(s) { return (s === '↑' || s === '↓' || s === '+') ? '2' : '1'; }

/* 按检查项目名称取影像材料（影像链接） */
function spExamImage(x) {
  var hit = null;
  Object.keys(EXAM_IMAGES).forEach(function (key) {
    if (hit) return;
    var parts = key.split('|');
    if (parts[0] === x.d && parts[1] === x.n) hit = EXAM_IMAGES[key];
  });
  return hit;
}
/* 影像云索引：身份证类型(6)-证件号码(34)-检查日期时间(14)-成像设备代码(13)-检查部位代码(9)-存储单位代码(18)，共 94 位 */
function spCloudIndex(e, x) {
  return spF('111') + '-' + spF(e && e.idNo || '', 34) + '-' + spF(x.d.replace(/\D/g, '') + '000000', 14) +
    '-' + spF('0', 13) + '-' + spF('0', 9) + '-' + spF(SP_PACS_STORE_CODE, 18);
}
function spF(v, n) { v = String(v == null ? '' : v); while (v.length < n) v += ' '; return v.slice(0, n); }

/* ---- 检验结果(常规)检出的定性/定量结果，统一展示为字符 ---- */
function spLabResultText(it) { return String(it[1] == null ? '' : it[1]); }

/* 通用「字段」表：rows = [[中文名称, 节点标识(仅代码留档，不展示), 值], ...]；界面只显示中文名称 */
function spFldTable(rows) {
  var body = rows.map(function (r) {
    var v = (r[2] === undefined || r[2] === null || r[2] === '') ? '—' : r[2];
    return '<tr><th class="spfx-k">' + esc(r[0]) + '</th><td class="spfx-v txt">' + (/^—$/.test(v) ? '—' : esc(String(v))) + '</td></tr>';
  }).join('');
  return '<div class="sp-table-wrap"><table class="data-table spfx-table"><tbody>' + body + '</tbody></table></div>';
}
function spFxRow(label, code, val) { return [label, code, val]; }

/* ---- 患者与就诊：检查/检验记录公共字段（只留认人认机构必需的字段） ---- */
function spVisitRows(e, x) {
  return [
    spFxRow('患者姓名', 'name', e && e.patient),
    spFxRow('性别名称', 'sex_name', e && e.sex),
    spFxRow('年龄（岁）', 'age', e ? e.age : ''),
    spFxRow('就诊机构名称', 'visit_org_name', x.org),
    spFxRow('检查/检验报告机构名称', 'report_organization_name', x.org)
  ];
}
function spJoinRows(list) { return list.map(function (r) { return r[2]; }).join(' / '); }

/* ---- 检查记录 examination_record + 检查项目 examination_exam ---- */
function spReportExam(e, x) {
  var html = '';
  html += '<div class="sp-rpt-sec"><div class="sp-rpt-t">患者与就诊信息</div><div class="sp-rpt-c">' +
    spFldTable(spVisitRows(e, x)) + '</div></div>';

  /* 签名（检查医师/技师/报告医师/审核医师）、编码类、链接类、备注类字段不进弹窗，接口直连时由对接层统一映射 */
  html += '<div class="sp-rpt-sec"><div class="sp-rpt-t">检查报告信息</div><div class="sp-rpt-c">' +
    spFldTable([
      spFxRow('记录名称', 'record_title', x.n),
      spFxRow('检查日期时间', 'execute_date', x.d),
      spFxRow('报告单编号', 'report_id', x.rid),
      spFxRow('检查申请科室名称', 'request_dept_name', x.dept),
      spFxRow('检查报告科室名称', 'report_dept_name', x.dept),
      spFxRow('检查目的', 'examination_purpose', x.purpose),
      spFxRow('检查报告结果（客观）', 'examination_display', x.j),
      spFxRow('检查报告结果（主观）', 'examination_result', x.y),
      spFxRow('参考意见或建议', 'suggestion', x.sug)
    ]) + '</div></div>';

  /* 检查项目（examination_exam）：表头即接口字段中文名称 */
  html += '<div class="sp-rpt-sec"><div class="sp-rpt-t">检查项目</div><div class="sp-rpt-c">' +
    '<div class="sp-table-wrap"><table class="data-table" style="min-width:420px"><thead><tr>' +
    '<th class="txt" style="width:34%">检查项目名称</th><th>检查部位名称</th><th>检查方法名称</th><th style="width:96px">检查结果名称</th>' +
    '</tr></thead><tbody><tr>' +
    '<td class="txt">' + esc(x.n) + '</td><td>' + esc(x.body || '—') + '</td><td>' + esc(x.method || '—') + '</td>' +
    '<td' + (x.abn ? ' style="color:var(--color-danger-fg);font-weight:700"' : '') + '>' + esc(x.abn ? '异常' : '正常') + '</td>' +
    '</tr></tbody></table></div></div></div>';

  return html;
}

/* ---- 检验记录 inspection_record + 检验结果(常规) inspection_test_res ---- */
function spReportLab(e, x) {
  var html = '';
  html += '<div class="sp-rpt-sec"><div class="sp-rpt-t">患者与就诊信息</div><div class="sp-rpt-c">' +
    spFldTable(spVisitRows(e, x)) + '</div></div>';

  /* 签名（检验医师/技师/报告/审核）、标本过程类、打印/自动审核标志、链接类字段不进弹窗 */
  html += '<div class="sp-rpt-sec"><div class="sp-rpt-t">检验报告信息</div><div class="sp-rpt-c">' +
    spFldTable([
      spFxRow('项目名', 'project_name', x.n),
      spFxRow('检验日期', 'inspection_date', x.d),
      spFxRow('检验报告单编号', 'report_id', x.rid),
      spFxRow('检验申请科室', 'request_dept_name', x.dept),
      spFxRow('检验报告科室', 'report_dept_name', x.dept),
      spFxRow('检验异常标志', 'exception_flag', x.abn ? '异常' : '正常'),
      spFxRow('检验报告结果-客观所见', 'report_result', x.j),
      spFxRow('检验报告结果-主观提示', 'report_subjectivity_result', x.y)
    ]) + '</div></div>';

  /* 检验结果(常规)（inspection_test_res）：无明细指标时，以记录级结果作为单条结果呈现 */
  var rows = x.items || [[x.n, x.r, '', '', x.abn ? '↑' : '']];
  var hasItems = !!x.items;
  var trs = rows.map(function (it) {
    var flag = it[4] || '', ab = spResCode(flag) === '2';
    var res = spLabResultText(it);
    return '<tr' + (ab ? ' class="sp-lab-abn"' : '') + '>' +
      '<td class="txt">' + esc(it[0]) + '</td>' +
      '<td style="font-weight:700">' + esc(res) + '</td>' +
      '<td>' + esc(it[2] || '—') + '</td>' +
      '<td>' + esc(it[3] || '—') + '</td>' +
      '<td>' + esc(ab ? '异常' : '正常') + '</td>' +
      '<td style="font-weight:700">' + (flag === '↑' || flag === '+' ? '<span style="color:var(--color-danger-fg)">' + esc(flag) + '</span>' : flag === '↓' ? '<span style="color:var(--color-primary)">↓</span>' : '') + '</td>' +
      '</tr>';
  }).join('');
  html += '<div class="sp-rpt-sec"><div class="sp-rpt-t">检验结果（常规）</div><div class="sp-rpt-c">' +
    '<div class="sp-table-wrap"><table class="data-table" style="min-width:560px"><thead><tr>' +
    '<th class="txt" style="width:32%">检验项目名称</th><th style="width:130px">检验定量结果</th><th style="width:90px">计量单位</th>' +
    '<th style="width:112px">参考值范围</th><th style="width:82px">检验结果名称</th><th style="width:48px">结果标识</th>' +
    '</tr></thead><tbody>' + trs + '</tbody></table></div>' +
    (hasItems ? '' : '<div class="spfx-note-line">该报告未回传逐项检验结果，以上为报告级结果。</div>') +
    '</div></div>';
  return html;
}

/* ---- 结论小结：只拼接口字段值（检验报告结果-主观提示 / 检查报告结果（主观）） ---- */
function spReportSummary(x) {
  if (x.k === '检查') return x.abn ? '<span class="sp-abn-mark">' + esc(x.y) + '</span>' : esc(x.y);
  return x.items ? esc(x.y) : (x.abn ? '<span class="sp-abn-mark">' + esc(x.r) + '</span>' : esc(x.r));
}

/* ---- 主入口：检查检验结果查看器（表格内 onclick="window._spExamView(...)" 调用）---- */
function _spExamView(pid, i) {
  var x = (SP_EXAMS[pid] || [])[i]; if (!x) return;
  var e = tumorEvents.filter(function (t) { return t.id === pid; })[0];
  var img = x.k === '检查' ? spExamImage(x) : null;
  var hasImg = x.k === '检查';

  var info = [
    ['患者', e ? e.patient + '（' + e.sex + '，' + e.age + '岁）' : pid],
    ['日期', x.d],
    ['类别', x.k],
    ['机构', x.org]
  ].map(function (r) { return '<span><b>' + esc(r[0]) + '</b>' + esc(r[1]) + '</span>'; }).join('');

  var body = (x.k === '检查' ? spReportExam(e, x) : spReportLab(e, x));
  body += '<div class="sp-rpt-sec"><div class="sp-rpt-t">结论小结</div><div class="sp-rpt-c">' + spReportSummary(x) + '</div></div>';

  spModalWide(
    '检查检验结果 · ' + x.n,
    '<div class="spvw' + (hasImg ? '' : ' spvw-narrow') + '">' +
    (hasImg ? spImagingPane(x, img, e) : '') +
    '<section class="spvw-pane spvw-pane-rpt">' +
    '<div class="spvw-rpt-body"><div class="spvw-info">' + info + '</div>' + body + '</div>' +
    '</section></div>',
    '<button class="btn btn-ghost btn-sm" data-sp-close>关闭</button>'
  );
}
window._spExamView = _spExamView;

/* ---- 影像阅片：只保留 放大 / 缩小 / 全屏 三个操作（全屏后再点一次退出，Esc 退出） ---- */
function spImagingPane(x, img, e) {
  var head = '<div class="spvw-pane-head"><span class="spvw-pane-title">影像资料</span>' +
    '<span class="spvw-pane-sub">' + esc(x.n) + ' · ' + esc(x.d) + '</span></div>';
  var zoomTools = [
    ['−', '缩小', 'data-sp-zoom="-1"'],
    ['+', '放大', 'data-sp-zoom="1"'],
    ['⛶', '全屏', 'data-sp-full="1"']
  ].map(function (t) {
    return '<button class="spvw-tool" type="button" ' + t[2] + ' title="' + t[1] + '">' +
      '<i>' + t[0] + '</i><span>' + t[1] + '</span></button>';
  }).join('');

  /* 影像云索引（接口文档 8.x 影像云索引规则）：按检查记录可定位 DICOM 原始序列 */
  var idx = spCloudIndex(e, x);

  if (!img) {
    return '<section class="spvw-pane spvw-pane-img">' + head +
      '<div class="spvw-viewer"><div class="spvw-noimg">' +
      '<div class="spvw-noimg-ico">🗂</div>' +
      '<div class="spvw-noimg-t">暂无影像</div>' +
      '<div class="spvw-noimg-h">该检查未回传影像，可查看右侧报告</div>' +
      '</div>' +
      '<div class="spvw-index"><span>影像云索引</span><code>' + esc(idx) + '</code></div>' +
      '</div></section>';
  }

  var roiStyle = img.roi
    ? 'left:' + img.roi.x + '%;top:' + img.roi.y + '%;width:' + (img.roi.r * 2) + '%;padding-bottom:' + (img.roi.r * 2) + '%'
    : '';

  return '<section class="spvw-pane spvw-pane-img">' + head +
    '<div class="spvw-viewer">' +
    '<div class="spvw-stage">' +
    '<div class="spvw-zoomwrap">' +
    '<img class="spvw-img" src="' + img.src + '" alt="' + esc(x.n) + '">' +
    (roiStyle ? '<div class="spvw-roi" style="' + roiStyle + '"></div>' : '') +
    '</div>' +
    '<div class="spvw-ovl">' +
    '<div>检查项目：' + esc(x.n) + '</div>' +
    '<div>检查日期：' + esc(x.d) + '</div>' +
    '<div>检查机构：' + esc(x.org) + '</div>' +
    '</div>' +
    (img.size ? '<div class="spvw-measure">◉ ' + esc(img.size) + '</div>' : '') +
    '</div>' +
    '<div class="spvw-tools">' + zoomTools + '</div>' +
    '<div class="spvw-index"><span>影像云索引</span><code>' + esc(idx) + '</code></div>' +
    '</div></section>';
}

/* ---- 宽幅模态：与 spModal 同交互（点遮罩/×/关闭按钮关闭），仅尺寸与结构升级 ---- */
function spModalWide(title, bodyHtml, foot) {
  var mask = document.createElement('div');
  mask.className = 'spvw-mask';
  var box = document.createElement('div');
  box.className = 'spvw-box';
  box.innerHTML =
    '<div class="spvw-head">' +
    '<div class="spvw-head-t">' + esc(title) + '</div>' +
    '<button class="spvw-x" type="button" aria-label="关闭">×</button>' +
    '</div>' +
    '<div class="spvw-body">' + bodyHtml + '</div>' +
    (foot ? '<div class="spvw-foot">' + foot + '</div>' : '');
  mask.appendChild(box);
  mask.addEventListener('click', function (ev) { if (ev.target === mask) mask.remove(); });
  box.querySelector('.spvw-x').addEventListener('click', function () { mask.remove(); });
  box.querySelectorAll('[data-sp-close]').forEach(function (b) { b.addEventListener('click', function () { mask.remove(); }); });

  /* 放大 / 缩小 / 全屏 */
  var wrap = box.querySelector('.spvw-zoomwrap');
  var img = wrap && wrap.querySelector('.spvw-img');
  var zoom = 1, baseW = 100, baseH = 100;
  function applyZoom() {
    if (!img) return;
    img.style.width = (baseW * zoom) + '%';
    img.style.height = (baseH * zoom) + '%';
    wrap.classList.toggle('zoomed', zoom > 1);
  }
  box.querySelectorAll('[data-sp-zoom]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!img) return;
      var full = box.classList.contains('spvw-full');
      zoom = Math.min(4, Math.max(0.5, zoom + (Number(b.getAttribute('data-sp-zoom')) > 0 ? 0.25 : -0.25)));
      if (full) { baseW = 100; baseH = 100; }   /* 全屏下按舞台铺满再缩放 */
      applyZoom();
    });
  });
  var fullBtn = box.querySelector('[data-sp-full]');
  function toggleFull() {
    var on = box.classList.toggle('spvw-full');
    if (fullBtn) { fullBtn.querySelector('span').textContent = on ? '退出全屏' : '全屏'; fullBtn.classList.toggle('active', on); }
    zoom = 1; baseW = 100; baseH = 100; applyZoom();
  }
  if (fullBtn) fullBtn.addEventListener('click', toggleFull);
  mask.__spEsc = function (ev) {
    if (ev.key !== 'Escape') return;
    if (box.classList.contains('spvw-full')) { toggleFull(); ev.preventDefault(); }
    else { mask.remove(); }
  };
  document.addEventListener('keydown', mask.__spEsc);

  var mo = new MutationObserver(function () {
    if (!document.body.contains(mask)) { document.removeEventListener('keydown', mask.__spEsc); mo.disconnect(); }
  });
  mo.observe(document.body, { childList: true });

  (document.getElementById('pageContainer') || document.body).appendChild(mask);
  return mask;
}

/* ---- 样式注入（复用站点设计令牌） ---- */
(function () {
  var old = document.getElementById('spvw-style'); if (old) old.remove();
  var st = document.createElement('style');
  st.id = 'spvw-style';
  st.textContent = `
.spvw-mask{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:1200;padding:24px}
.spvw-box{display:flex;flex-direction:column;width:min(1240px,100%);height:min(92vh,900px);background:var(--surface);border-radius:var(--radius-lg);box-shadow:0 24px 60px rgba(15,23,42,.34);overflow:hidden;transition:width .18s ease,height .18s ease,border-radius .18s ease}
.spvw-box.spvw-full{width:100vw;height:100vh;border-radius:0}
.spvw-mask:has(.spvw-full){padding:0}
.spvw-head{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--color-border);flex:0 0 auto;background:var(--surface)}
.spvw-head-t{font-size:var(--fs-h2);font-weight:var(--fw-bold);color:var(--color-text-title)}
.spvw-x{width:30px;height:30px;border:0;border-radius:var(--radius-sm);background:transparent;color:var(--color-text-muted);cursor:pointer;font-size:20px;line-height:1;transition:background var(--dur-fast)}
.spvw-x:hover{background:var(--color-gray-100);color:var(--color-text-title)}
.spvw-body{flex:1 1 auto;min-height:0;overflow:hidden;padding:0}
.spvw-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--color-border);flex:0 0 auto;background:var(--surface)}

.spvw{display:grid;grid-template-columns:minmax(380px,460px) 1fr;height:100%;min-height:0}
.spvw.spvw-narrow{grid-template-columns:1fr}
.spvw-pane{min-width:0;min-height:0;display:flex;flex-direction:column}
.spvw-pane-img{border-right:1px solid var(--color-border);background:var(--color-gray-25)}
.spvw-pane-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px;border-bottom:1px solid var(--color-border);flex:0 0 auto}
.spvw-pane-title{display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);font-weight:var(--fw-bold);color:var(--color-text-title)}
.spvw-pane-title::before{content:'';width:3px;height:12px;background:var(--color-primary);border-radius:2px}
.spvw-pane-sub{font-size:var(--fs-xs);color:var(--color-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spvw-viewer{padding:14px;display:flex;flex-direction:column;gap:10px;overflow:auto;min-height:0}

.spvw-stage{position:relative;width:100%;aspect-ratio:1/1;background:#0a0a0a;border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--color-gray-300)}
.spvw-zoomwrap{position:absolute;inset:0;overflow:auto;display:flex;align-items:flex-start;justify-content:center}
.spvw-zoomwrap.zoomed{align-items:flex-start}
.spvw-img{width:100%;height:100%;object-fit:contain;display:block;flex:0 0 auto}
.spvw-ovl{position:absolute;left:10px;top:10px;background:rgba(0,0,0,.62);color:#fff;font-size:10px;line-height:1.65;padding:7px 9px;border-radius:var(--radius-xs);max-width:78%;pointer-events:none;backdrop-filter:blur(3px)}
.spvw-ovl div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spvw-roi{position:absolute;border:2px dashed #ef4444;border-radius:50%;box-sizing:border-box;animation:spvwPulse 2s infinite;pointer-events:none}
@keyframes spvwPulse{0%,100%{opacity:1}50%{opacity:.5}}
.spvw-measure{position:absolute;right:10px;bottom:10px;background:rgba(220,38,38,.92);color:#fff;font-size:var(--fs-xs);font-weight:var(--fw-bold);padding:6px 10px;border-radius:var(--radius-sm);display:flex;align-items:center;gap:5px;pointer-events:none}

.spvw-tools{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.spvw-tool{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 2px;border:1px solid var(--color-border);background:var(--surface);border-radius:var(--radius-sm);font-size:var(--fs-2xs);color:var(--color-text-body);cursor:pointer;font-family:inherit;transition:all var(--dur-fast)}
.spvw-tool i{font-style:normal;font-size:14px;line-height:1;font-weight:var(--fw-bold)}
.spvw-tool:hover{border-color:var(--color-primary-300);color:var(--color-primary);background:var(--color-primary-50)}
.spvw-tool.active{background:var(--color-primary);border-color:var(--color-primary);color:var(--color-text-invert)}

.spvw-index{display:flex;flex-direction:column;gap:3px;font-size:var(--fs-2xs);color:var(--color-text-muted)}
.spvw-index code{display:block;font-family:ui-monospace,Consolas,monospace;font-size:10px;line-height:1.5;color:var(--color-text-body);background:var(--color-gray-100);border-radius:var(--radius-xs);padding:6px 8px;word-break:break-all}

.spvw-noimg{width:100%;aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:var(--color-gray-100);border:1px dashed var(--color-gray-300);border-radius:var(--radius-md);color:var(--color-text-muted);text-align:center;padding:20px}
.spvw-noimg-ico{font-size:30px;opacity:.5}
.spvw-noimg-t{font-size:var(--fs-body);font-weight:var(--fw-semibold);color:var(--color-text-body)}
.spvw-noimg-h{font-size:var(--fs-xs)}

.spvw-pane-rpt{background:var(--surface)}
.spvw-rpt-body{padding:16px 20px 22px;overflow:auto;min-height:0;flex:1 1 auto}
.spvw-info{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:var(--fs-sm);color:var(--color-text-body);margin-bottom:14px;padding-bottom:12px;border-bottom:1px dashed var(--color-border)}
.spvw-info b{color:var(--color-text-muted);font-weight:var(--fw-medium);margin-right:4px}

.sp-rpt-sec{margin-bottom:14px}
.sp-rpt-t{display:flex;align-items:baseline;gap:8px;font-size:var(--fs-sm);font-weight:var(--fw-bold);color:var(--color-text-title);margin-bottom:8px;padding-left:8px;border-left:3px solid var(--color-primary)}
.sp-rpt-c{font-size:var(--fs-sm);color:var(--color-text-body);line-height:1.7}
.spfx-note-line{margin-top:6px;font-size:var(--fs-2xs);color:var(--color-text-muted)}
.sp-table-wrap .spfx-table{width:100%;max-width:100%;table-layout:fixed;min-width:0}
.sp-table-wrap .spfx-table td.spfx-v,.sp-table-wrap .spfx-table th.spfx-k{white-space:normal;word-break:break-word;line-height:1.6;height:auto;padding-top:8px;padding-bottom:8px;vertical-align:top}
.spfx-table th.spfx-k{width:236px;font-weight:var(--fw-medium);color:var(--color-text-muted);font-size:var(--fs-xs);vertical-align:middle;background:var(--color-gray-25);white-space:nowrap}
.spfx-table th.spfx-k i{display:inline;font-style:normal;font-size:10px;font-family:ui-monospace,Consolas,monospace;color:var(--color-gray-400);font-weight:var(--fw-regular);margin-left:8px}
.spfx-table td.spfx-v{font-size:var(--fs-xs);line-height:1.65}

@media(max-width:1080px){
  .spvw{grid-template-columns:1fr;overflow:auto}
  .spvw-pane-img{border-right:0;border-bottom:1px solid var(--color-border)}
  .spvw-stage{aspect-ratio:16/10}
  .spvw-noimg{aspect-ratio:16/10}
}
`;
  document.head.appendChild(st);
})();

window._spRefView=function(pid,i){
 var e=tumorEvents.find(function(t){return t.id===pid});if(!e)return;
 var x=spInstitutionChanges(e).changes[i];if(!x)return;
 var body='<div class="sp-kv-grid">'+spKv('变化日期',x.d)+spKv('前次治疗机构',x.from)+spKv('本次治疗机构',x.to)+spKv('前次治疗',x.previous.date+' · '+(x.previous.mode||'治疗'))+spKv('本次治疗',x.current.date+' · '+(x.current.mode||'治疗'))+spKv('生成依据','按治疗执行时间识别机构变化')+'</div>';
 spModal('治疗机构变化',body,'<button class="btn btn-ghost btn-sm" data-sp-close>关闭</button>');
};
function spBlock(idx,title,bodyHtml){
  return '<div class="sp-profile-block"><div class="sp-block-head"><span class="sp-block-idx">'+idx+'</span><span class="sp-block-title">'+esc(title)+'</span></div><div class="sp-block-body">'+bodyHtml+'</div></div>';
}
/* 同一患者的全部瘤例（多原发）：按确诊日期升序、同日期按原发序号，首例为「原发」，其余为「第 N 原发」 */
function spPatientTumors(e){
  if(!e)return [];
  var pk=spPatientKey(e);
  var list=spUnique(tumorEvents.filter(function(x){var d=spDiagnosisDate(x),u=spUpdatedDate(x);return spPatientKey(x)===pk&&(!d||d<=spCutoff())&&(!u||u<=spCutoff())}),spTumorKey);
  list.forEach(function(x){x.__ord=spDate(spDiagnosisDate(x))||spDate(x.stageDate)||spDate(x.firstDate)||''});
  list.sort(function(a,b){
    if(a.__ord!==b.__ord)return a.__ord<b.__ord?-1:1;
    return (Number(a.tumorSeq)||0)-(Number(b.tumorSeq)||0);
  });
  return list;
}
function spTumorLabel(e,i){
  var seq=Number(e.tumorSeq);
  var n=seq>0?seq:(i+1);
  return n<=1?'原发':'第 '+n+' 原发';
}
/* 瘤例编号（与报告卡瘤序一致）：首例 T，其余 T2、T3… */
function spTumorNo(i){return i<=0?'T':'T'+(i+1)}
function spTumorSwitch(e){
  var list=spPatientTumors(e);
  if(list.length<2)return '';
  var multi=list.some(function(x){return x.multiPrimary===true});
  return '<div class="sp-tumor-switch" role="tablist" aria-label="多原发瘤例切换">'+
    '<span class="sp-tumor-switch-label">'+(multi?'多原发':'瘤例')+'<em>'+list.length+' 个瘤例</em></span>'+
    list.map(function(x,i){
      var on=x.id===e.id;
      return '<button type="button" role="tab" class="sp-tumor-tab'+(on?' active':'')+'" aria-selected="'+(on?'true':'false')+'" '+
        'title="'+esc('切换至 '+spTumorLabel(x,i)+'：'+spTumorName(x)+'（'+spStage(x)+'）')+'" '+
        'onclick="window._spSwitchTumor(\''+esc(x.id)+'\')">'+
        '<span class="sp-tumor-tab-no">'+esc(spTumorNo(i))+'</span>'+
        '<span class="sp-tumor-tab-txt">'+esc(x.laterality||x.site||'未填部位')+
        (on?'<span class="sp-tumor-tab-tag">'+esc(spTumorLabel(x,i))+'</span>':'')+'</span>'+
        '</button>';
    }).join('')+
    '</div>';
}
function spDetailPage(e){
  var tumors=spPatientTumors(e);
  var head=(_wbOverviewSelection?'<div class="sp-overview-context"><span>总览核对 · 截至 '+spCutoff()+' · '+esc(_wbOverviewSelection.label)+'</span><button class="btn btn-ghost btn-sm" onclick="navigateTo(\'sp-overview\')">返回总览</button></div>':'')+'<div class="sp-detail-back"><button class="btn btn-ghost btn-sm" onclick="window._spBackList()">← 返回患者列表</button></div>'+
    '<div class="sp-patient-strip">'+
    '<div class="sp-patient-avatar">'+esc(e.patient.charAt(0))+'</div>'+
    '<div class="sp-patient-id"><div class="sp-patient-name">'+esc(e.patient)+'<span class="sp-patient-meta">'+esc(spMaskIdNo(e.idNo))+' · '+esc(spEmpi(e))+'</span></div></div>'+
    spTumorSwitch(e)+
    '</div>';
  var b1=spProfileSectionBody(e,'burden');
  var b2=spProfileSectionBody(e,'tumor');
  var others=spOtherModes(e);
  var b3=spProfileSectionBody(e,'treat')+
    (others.length?'<div class="sp-note-inline">六类以外记录：'+esc(others.join('、'))+'（按实际记录展示）</div>':'');
  var b5=spProfileSectionBody(e,'outcome');
  var blocks='<div class="sp-profile-blocks">'+
    spBlock(1,'患者基础',b1)+
    spBlock(2,'肿瘤特征',b2)+
    spBlock(3,'诊疗过程',b3)+
    spBlock(4,'随访与结局',b5)+
    '</div>';
  var rfList=spInstitutionChanges(e).changes;
  var exP=spPanel('检查检验记录',spExamTable(e.id));
  var rfP=spPanel('治疗机构变化（'+rfList.length+'条）',spRefTable(e.id));
  var tl=spPanel('画像时间线',spTimeline(e));
  var cost=window.SPCost?window.SPCost.render(e,{patientKey:spPatientKey(e),patientTumorIds:spPatientTumors(e).map(function(t){return t.id}),today:spCutoff()}):'';
  return '<div class="sp-detail-shell">'+head+blocks+cost+exP+rfP+tl+'</div>';
}


/* ===================== 七、03 画像配置 ===================== */
var _spCfgTab='elem';
var SP_CFG_TABS=[{key:'elem',label:'画像要素'},{key:'rule',label:'映射规则'},{key:'nlp',label:'NLP 提取'},{key:'ver',label:'版本与归档'}];

/* 覆盖判定字段库：新增要素时从下拉选择，覆盖率按数据实时计算 */
var SP_ELEM_FIELD_MAP=[]; // 下方与当前画像字段统一生成。
function spFieldFn(fkey){
  var aliases={site_path:'site',modes:'tfirst'},key=aliases[fkey]||fkey;
  if(spProfileField(key))return function(e){var r=spProfileRead(e,key);return r.state==='valid'||r.state==='na'};
  return function(){return false};
}
var SP_DIMS=['患者基础','肿瘤特征','诊疗过程','随访与结局'];
var SP_SOURCES=['登记报告卡','筛查管理数据','病理报告数据','TNM分期质控','病案首页数据','MDT与转诊管理','治疗执行记录','随访管理数据','随访与死亡登记','医保结算数据'];

/* 画像要素元数据（工作副本：可新增/编辑/启停） */
var _spElements=[
 {id:'PE01',dim:'患者基础',name:'性别',src:'登记报告卡',fkey:'sex',on:true},
 {id:'PE02',dim:'患者基础',name:'年龄（分层变量）',src:'登记报告卡',fkey:'age',on:true},
 {id:'PE03',dim:'患者基础',name:'户籍地（聚合维度）',src:'登记报告卡',fkey:'region',on:true},
 {id:'PE04',dim:'患者基础',name:'就诊机构（聚合维度）',src:'登记报告卡',fkey:'hospital',on:true},
 {id:'PE05',dim:'患者基础',name:'医保类型',src:'医保结算数据',fkey:'insurance',on:true},
 {id:'PE06',dim:'患者基础',name:'筛查机构',src:'筛查管理数据',fkey:'screenorg',on:true},
 {id:'PE07',dim:'患者基础',name:'筛查方式',src:'筛查管理数据',fkey:'screentype',on:true},
 {id:'PE08',dim:'患者基础',name:'筛查时间',src:'筛查管理数据',fkey:'screendate',on:true},
 {id:'PE09',dim:'患者基础',name:'筛查结果',src:'筛查管理数据',fkey:'screenresult',on:true},
 {id:'PE10',dim:'患者基础',name:'筛查建议',src:'筛查管理数据',fkey:'screenadvice',on:true},
 {id:'DE01',dim:'肿瘤特征',name:'原发部位、病理类型（瘤种分层）',src:'病理报告数据',fkey:'site_path',on:true},
 {id:'DE01a',dim:'肿瘤特征',name:'ICD-10',src:'登记报告卡',fkey:'icd10',on:true},
 {id:'DE01b',dim:'肿瘤特征',name:'ICD-O-3 部位码',src:'登记报告卡',fkey:'icdo3topo',on:true},
 {id:'DE01c',dim:'肿瘤特征',name:'ICD-O-3 形态码',src:'病理报告数据',fkey:'icdo3morph',on:true},
 {id:'DE02',dim:'肿瘤特征',name:'分期期别',src:'TNM分期质控',fkey:'stage',on:true},
 {id:'DE03',dim:'肿瘤特征',name:'确诊日期（时间类指标起点）',src:'登记报告卡',fkey:'diagdate',on:true},
 {id:'DE04',dim:'肿瘤特征',name:'分级',src:'登记报告卡',fkey:'grade',on:true},
 {id:'DE05',dim:'肿瘤特征',name:'诊断依据',src:'登记报告卡',fkey:'diag_basis',on:true},
 {id:'TR02',dim:'诊疗过程',name:'治疗方式分项（六类）',src:'病案首页数据',fkey:'modes',on:true},
 {id:'TR03',dim:'诊疗过程',name:'MDT',src:'MDT与转诊管理',fkey:'mdt',on:true},
 {id:'TR04',dim:'诊疗过程',name:'首次治疗日期（治疗及时性）',src:'病案首页数据',fkey:'tfirst',on:true},
 {id:'TR04a',dim:'诊疗过程',name:'确诊至首次治疗间隔（推算）',src:'报告卡 + 治疗执行记录',fkey:'diag_to_treat',on:true},
 {id:'TR05',dim:'诊疗过程',name:'治疗机构是否变化',src:'治疗执行记录',fkey:'referral',on:true},
 {id:'FU01',dim:'随访与结局',name:'生存状态',src:'随访与死亡登记',fkey:'vital',on:true},
 {id:'FU02',dim:'随访与结局',name:'末次随访日期',src:'随访管理数据',fkey:'lastfu',on:true},
 {id:'FU06',dim:'随访与结局',name:'观察时长（推算）',src:'随访与死亡登记',fkey:'survival',on:true},
 {id:'FU07',dim:'随访与结局',name:'死亡原因',src:'随访与死亡登记',fkey:'death',on:true}
];
/* 将现有配置标识映射到当前显示字段，新增字段沿用维度与来源。 */
(function(){
  var previous=_spElements,aliases={site:'site_path',tfirst:'tfirst'};
  var sources={'患者基础':'登记报告卡','肿瘤特征':'登记报告卡','诊疗过程':'治疗执行记录','随访与结局':'随访与死亡登记'};
  _spElements=SP_PROFILE_FIELDS.map(function(f,i){var old=previous.find(function(e){return e.fkey===(aliases[f.key]||f.key)});return {id:old?old.id:'PF'+String(i+1).padStart(2,'0'),dim:f.dim,name:f.label,src:old?old.src:sources[f.dim],fkey:f.key,on:old?old.on:true}});
  SP_ELEM_FIELD_MAP=SP_PROFILE_FIELDS.map(function(f){return {key:f.key,name:f.label,fn:function(e){var r=spProfileRead(e,f.key);return r.state==='valid'||r.state==='na'}}});
})();
/* 画像维度映射规则（工作副本） */
var _spMapRules=[
 {id:'MR01',dim:'患者基础',input:'出生日期 / 身份证 + 确诊日期',out:'确诊时年龄',logic:'按当前瘤例的确诊日期计算周岁，不使用原记录 age 或当前年龄替代',on:true},
 {id:'MR02',dim:'患者基础',input:'患者标识 + 同名画像字段',out:'人口字段去重',logic:'同一患者只计一次；多个瘤例值不一致时单列冲突，不静默覆盖',on:true},
 {id:'MR03',dim:'肿瘤特征',input:'原发部位 + 病理类型',out:'ICD-10 / ICD-O-3 编码',logic:'复用画像当前编码映射；详细部位、分级、TNM 与期别分别保留',on:true},
 {id:'MR04',dim:'肿瘤特征',input:'stage / tNm / grade',out:'期别、TNM、分级记录构成',logic:'分别读取对应字段，不互相替代；记录构成不直接判为早诊率或转移率',on:true},
 {id:'MR-TX-ORG',dim:'诊疗过程',input:'患者主索引 + 实际治疗日期 + 机构',out:'治疗机构变化',logic:'同一患者全部瘤例实际治疗按时间排序；相邻机构变化生成记录，时序不明待核对',on:true},
 {id:'MR07',dim:'诊疗过程',input:'各项治疗执行记录 + 明确未开展记录',out:'治疗方式三态',logic:'每项独立判定有、明确无、未记录；其他方式有记录不能证明本项为无',on:true},
 {id:'MR09',dim:'诊疗过程',input:'确诊日期 + 实际治疗执行日期',out:'首次治疗日期与确诊至首治间隔',logic:'排除计划、撤销、未执行和截止日之后的记录；日期冲突不参与计算',on:true},
 {id:'MR-FU',dim:'随访与结局',input:'生存状态 + 失访记录 + 随访 / 死亡日期',out:'生存状态与随访状态',logic:'两类状态分别展示；失访不等于死亡，缺失日期不生成已知历史结局',on:true},
 {id:'MR12',dim:'随访与结局',input:'确诊日期 + 死亡 / 末次随访日期',out:'观察时长',logic:'有效日期差换算月数，零天保留零；不替代长期生存率',on:true},
 {id:'MR13',dim:'指标汇总',input:'37 个同源画像字段 + 统计范围',out:'画像总览 / 核对记录 / CSV',logic:'共用字段读取、统计对象、分母与截止日；费用仅累计明确归属单瘤例的净额，共同费用单列',on:true}
];
var SP_RULE_TEMPLATES=['按行政区划聚合','拼接生成结论行','区间映射为分层','关键字匹配打标','计数聚合为占比','任一阳性即标记'];
/* NLP 结构化提取结果：原文片段 → 画像要素，状态可采纳/忽略 */
var _spNlp=[
 {id:'NLP01',src:'病理报告 · 陈建国',snippet:'（右肺上叶）浸润性腺癌，腺泡型+乳头型，中分化',el:'病理类型/分化程度',val:'腺癌 · 中分化',conf:96,st:'已采纳'},
 {id:'NLP02',src:'出院小结 · 赵德顺',snippet:'胃窦低分化腺癌，腹膜多发转移结节',el:'转移',val:'腹膜转移',conf:92,st:'已采纳'},
 {id:'NLP03',src:'影像报告 · 王秀兰',snippet:'右肝后叶占位，考虑 HCC，邻近无卫星灶',el:'瘤种/部位',val:'肝 · 右肝后叶',conf:89,st:'待确认'},
 {id:'NLP04',src:'门诊病历 · 欧阳明轩',snippet:'进食梗阻感 2 月，胸中段食管占位',el:'症状',val:'进食梗阻感',conf:85,st:'待确认'},
 {id:'NLP05',src:'检验报告 · 李志强',snippet:'血常规 WBC 3.2×10⁹/L，II 度骨髓抑制',el:'治疗不良反应',val:'II度骨髓抑制',conf:91,st:'已采纳'},
 {id:'NLP06',src:'随访记录 · 刘雅琴',snippet:'内分泌维持中，未见复发征象',el:'复发',val:'暂无复发记录',conf:94,st:'已采纳'}
];
/* 智能校验：实时按数据执行 */
function spCheckFields(keys){return tumorEvents.filter(function(e){return keys.some(function(k){var r=spProfileRead(e,k);return r.state==='missing'||r.state==='conflict'})})}
function spCheckResult(rows,ok){return {bad:rows,detail:rows.length?rows.map(function(e){return e.patient}).join('、'):ok}}
var SP_CHECKS=[
 {id:'R001',name:'分期期别缺失',run:function(){return spCheckResult(spCheckFields(['stage']),'分期期别完整')}},
 {id:'R002',name:'形态学 ICD-O-3 无法编码',run:function(){return spCheckResult(spCheckFields(['icdo3morph']),'形态学编码完整')}},
 {id:'R003',name:'原发部位 ICD-10 无法编码',run:function(){return spCheckResult(spCheckFields(['icd10']),'原发部位编码完整')}},
 {id:'R004',name:'诊断依据缺失',run:function(){return spCheckResult(spCheckFields(['diag_basis']),'诊断依据齐全')}},
 {id:'R006',name:'未见有效治疗执行记录',run:function(){return spCheckResult(spCheckFields(['tfirst']),'全部瘤例有有效治疗执行记录')}},
 {id:'R007',name:'首次治疗日期缺失',run:function(){return spCheckResult(spCheckFields(['tfirst']),'首次治疗日期可推算')}},
 {id:'R008',name:'确诊至首次治疗不可计算',run:function(){return spCheckResult(spCheckFields(['diag_to_treat']),'有效诊疗日期可计算间隔')}},
 {id:'R011',name:'末次随访超 90 天未更新',run:function(){var bad=tumorEvents.filter(function(e){var r=spProfileRead(e,'lastfu');return spFollowState(e)==='随访中'&&(r.state!=='valid'||(Date.parse(spCutoff())-Date.parse(r.value))/86400000>90)});return spCheckResult(bad,'当前随访中记录均在 90 天内更新')}},
 {id:'R012',name:'死亡日期 / 原因未填写',run:function(){return spCheckResult(spCheckFields(['deathdate','death']),'已确认死亡记录的日期与原因完整')}},
 {id:'R013',name:'观察时长无法推算',run:function(){return spCheckResult(spCheckFields(['survival']),'观察时长可推算')}}
];
var _spCheckTime='2026-09-11 08:30';
var SP_ELEM_CHECK={stage:'R001',icdo3morph:'R002',icd10:'R003',diag_basis:'R004',tfirst:'R007',diag_to_treat:'R008',lastfu:'R011',deathdate:'R012',death:'R012',survival:'R013'};
function spCheck(id){return SP_CHECKS.filter(function(c){return c.id===id})[0];}
/* 画像版本：含变更明细 */
var SP_VERSIONS=[
  {v:'V14.8',time:'2026-11-03',by:'管理员',desc:'检查检验记录面板标题去掉「（6条 · 点击查看结果）」',cur:true,changes:[
    '按业务确认，详情页「检查检验记录」面板标题只保留名称，去掉括号内的条数与操作提示',
    '条数属表格信息，逐行可见，写在标题里会随记录增减变化而抖动；「点击查看结果」与每行右侧的「查看结果」按钮重复',
    '同时清理只为拼这个标题而存在的 exList 变量，spExamTable 仍按 SP_EXAMS 自行取数',
    '「治疗机构变化（N 条）」保留条数：该面板首屏可能折叠且条数代表派生记录量，与检查表性质不同']},
  {v:'V14.7',time:'2026-11-03',by:'管理员',desc:'肿瘤特征块删除「分期确认日期」一项',cur:false,changes:[
    '按业务确认，块2「瘤种、分级与分期」删除「分期确认日期」：TNM 与分期期别已能判定分期是否成立，单独再列一个日期属于同一判定链上的重复展示',
    '字段定义 stagedate 一并删除（SP_PROFILE_FIELDS 由 37 项减为 36 项、详情展示由 36 项减为 35 项），配置页要素 DE02a「分期确认日期（分期有效性判定）」同步移除',
    '校验规则 R001 由「分期期别 / 分期确认日期缺失」改为「分期期别缺失」，SP_ELEM_CHECK 去掉 stagedate 绑定；分期缺失判定不再要求该日期',
    '总览「肿瘤特征」下方「分期与编码明细」表去掉该列；spProfileRead 的日期冲突检查去掉 stagedate 分支，不留失效键',
    '底层 stageDate 数据保留：TNM 与分期期别的截止日过滤、画像时间线的「明确诊断」节点、多原发瘤例排序仍按它取值，属过程数据而非展示字段',
    '肿瘤特征块由 11 项减为 10 项：原发部位 / 病理类型 / ICD-10 / ICD-O-3 部位码 / ICD-O-3 形态码 / 分级 / TNM / 分期期别 / 确诊日期 / 诊断依据']},
  {v:'V14.6',time:'2026-11-03',by:'管理员',desc:'患者基础块「筛查参与」改为「筛查机构」，展示筛查实施机构',cur:false,changes:[
    '按业务确认，块1「筛查参与」一项改为「筛查机构」：原值是「有筛查记录 / 未参与 / 不详」的状态判定，与同组的筛查项目、时间、结果、建议并列时既非字段也非事实，改用筛查记录上的实施机构',
    '取数改为筛查记录的医疗机构（screenOrg），与筛查项目 / 时间 / 结果 / 建议同源；缺失显示「未记录」，不回退到就诊机构，避免把「在哪治病」当成「在哪筛查」',
    '小标题由「筛查参与信息」改为「筛查信息」：本组已无参与状态项，保留原标题会名实不符',
    '总览「患者基础」段原「筛查参与」环图改为「筛查机构」条形图（13 家机构），末组「就诊医院 / 筛查项目」保持两列',
    '筛查参与状态口径（spScreenStatus）与指标「队列筛查记录覆盖」保留在聚合层，仅不再占据详情键值位与总览图表位',
    '14 例样例按各自筛查项目补筛查机构：肺癌/肝癌/结直肠癌等机会性筛查取首诊社区卫生服务中心，结肠癌机会性筛查取省肿瘤医院',
    '画像字段仍为 37 项、详情展示 36 项（互换而非新增），配置页要素 PE06 同步更名为「筛查机构」']},
  {v:'V14.5',time:'2026-11-03',by:'管理员',desc:'患者专科画像列表关键字改为按报告卡编号 / 姓名 / 身份证号检索',cur:false,changes:[
    '关键字占位提示由「姓名 / 地区 / 瘤种 / 医院」改为「报告卡编号 / 姓名 / 身份证号」，与 spWbFiltered 实际匹配字段一致',
    '匹配字段收敛为报告卡编号、姓名、身份证号三项：瘤种、地市、医院已有各自下拉，关键字再重复匹配属同一条件两条路径，命中来源难判断',
    '报告卡编号与身份证号按不区分大小写匹配，兼容身份证末位 x / X 与卡片编号录入不一致',
    '地区（户籍地市及区县）不再由关键字命中，改由「地市」下拉过滤；筛选栏仍为 6 项条件、条件间「与」关系不变',
    '重置、查询、总览下钻（_spGpToPatients）与证据弹窗（_spEvidencePatient）读写同一 _wbFilters.q，交互行为不变']},
  {v:'V14.4',time:'2026-11-02',by:'管理员',desc:'画像详情删除「治疗机构变化」一项，小标题改为「治疗与 MDT」',cur:false,changes:[
    '按业务确认，诊疗过程块内删除「治疗机构变化 有变化 / 未观察到变化」：该值由患者全部治疗的机构时间序列自动派生，属于过程明细，放在四块画像的键值位与「首次治疗日期」「MDT」并列会被当成一条采集字段',
    '机构变化本身不丢失：页面下方仍有「治疗机构变化（N 条）」明细表与画像时间线的机构变化节点，逐条给出 A→B 的日期与去向',
    '小标题随之由「治疗与转诊」改为「治疗与 MDT」——本组已不含转诊相关项，避免名实不符',
    '字段定义、指标（治疗机构变化患者占比）、总览图表与配置页要素 TR05 均保留，只去掉详情页这一处展示位',
    '诊疗过程块由 6 项减为 5 项（首次治疗日期 / 确诊至首次治疗 / MDT 会诊 + 六类治疗方式）']},
  {v:'V14.3',time:'2026-11-02',by:'管理员',desc:'画像详情「治疗方式（六类）」文案去掉（六类）括注',cur:false,changes:[
    '按业务确认，诊疗过程块内小标题由「治疗方式（六类）」改为「治疗方式」：手术/放疗/化疗/靶向/免疫/内分泌六个分项已由字段本身逐一列出，括注重复且占位',
    '只改展示文案，不改口径：六类仍各自独立判定「有 / 明确无 / 未记录」，介入等六类以外记录仍单独一行按实际展示',
    '画像指标汇总的治疗堆叠图与配置页「治疗方式分项（六类）」要素名保持不变——那里需要点明统计口径，详情页是记录展示，不必再标类数']},
  {v:'V14.2',time:'2026-11-02',by:'管理员',desc:'多原发瘤例切换键上移至患者信息条，肿瘤特征块头恢复纯标题',cur:false,changes:[
    '按业务确认，多原发切换键从「肿瘤特征」块头右侧移到页面顶部患者信息条右侧：切换的是整页画像（四块内容都随之变化），放在块 2 的标题旁会误读成只切换肿瘤特征',
    '患者条由两列改为三列（头像 / 姓名+身份信息 / 切换键），切换键仍右对齐；块 2 块头去掉追加区，spBlockWith 一并删除，块标题回到「编号 + 标题」两段结构',
    '≤900px 窄屏降级：患者条回两列，切换键整行换行到姓名下方，页签自动等宽，不挤压姓名与脱敏号',
    '单瘤例患者仍不渲染切换键，患者条自动收为两列，版式与改动前一致',
    '切换、页签高亮、跨患者拦截等行为不变，仅位置与容器变化']},
  {v:'V14.1',time:'2026-11-02',by:'管理员',desc:'患者专科画像列表移除「分期」筛选条件',cur:false,changes:[
    '按业务确认，患者列表筛选栏删除「分期」下拉：分期是肿瘤特征的分析维度，放在列表查询条件里与「瘤种/地市/医院/随访状态/是否多原发」这类对象属性并列不成立',
    '同步清理 _wbFilters.stage 字段与 spWbFiltered 中的分期判定、_spWbQuery/_spWbReset/_spGpToPatients/_spEvidencePatient 的 stage 赋值，不留失效状态位',
    '筛选栏由 7 项减为 6 项：关键字 / 瘤种 / 地市 / 医院 / 随访状态 / 是否多原发，其余条件组合与「与」关系不变',
    '分期构成、早诊率、IV 期占比等分期相关指标与图表不受影响（仍见画像指标汇总与详情页肿瘤特征）']},
  {v:'V14.0',time:'2026-10-30',by:'管理员',desc:'画像字段与指标总览同源，支持逐项核对与费用对账',cur:false,changes:['37 个画像字段共用读取器，详情、总览、缺失统计及导出一致','按四个画像分区重组总览，移除无依据的官方基准与达标判定','治疗方式区分有、明确无、未记录；TNM、分级与期别独立统计','生存状态与随访状态分开，补充死亡日期并明确观察时长的计算','单瘤例医保净额与画像相加一致，共同费用单列说明','详情页记录表标题由「转院就诊记录」改为「治疗机构变化」，与时间线图例和群体指标口径统一，表格内容与派生规则不变']},
  {v:'V13.6',time:'2026-10-30',by:'管理员',desc:'总览医保费用分析展示演示计算结果并醒目标注统计口径',cur:false,changes:['总览无真实结算接口时也展示样例累计费用、覆盖人数、人均费用、个人支付与省外费用占比及支付/费用类别构成','样例仅用于演示计算口径，不代表真实总体统计或正式监管结论；真实统计仍严格只纳入 mode=live 结算']},
  {v:'V13.3',time:'2026-10-30',by:'管理员',desc:'患者详情展示卫健委视角的医疗费用概览；转院记录按治疗机构变化自动生成',cur:false,changes:['费用概览仅保留累计医疗费用、个人支付及占比、次均住院费用、省外医疗费用及占比，按当前瘤例累计展示，移除筛选和结算操作，演示数据明确标注','按患者治疗执行时间排序，连续同院合并，A→B→A生成两次变化，同日多机构时序不明时待确认','详情、时间线和群体治疗机构变化指标共用派生规则；不再依赖医院转诊数据']},
  {v:'V13.2',time:'2026-10-30',by:'管理员',desc:'指标口径改为对齐《卫健领导关注指标总表》：指标名、计算口径、参考基准与达标判定均取自总表，删除无业务价值的构成图',cur:false,changes:[
   '新增 SP_METRIC_KPI：9 个官方指标（早诊率、IV 期占比、TNM 分期缺失率、病理确诊率 MV%、MDT 覆盖率、随访覆盖率、失访率、县域内就诊率、省内跨市就医率）逐项绑定官方指标名、计算口径、参考基准与指标总表出处',
   '新增 spKpiJudge 达标判定：按「越高越好/越低越好」方向与基准比较，输出 达标 / 预警 / 未达标；无基准指标只报值不判达标，避免自造结论',
   '顶部八项核心概况与各段指标卡统一改用官方指标口径，每张卡显示「数值 + 有效分母 + 参考基准 + 达标标签」，hover 显示官方口径与画像字段来源',
   '新增 TNM 分期缺失率指标（总表 B 类★核心项）：分母排除「不适用」瘤种，分子为分期不详瘤例',
   '删除「确诊年份构成」「户籍区县构成」两图：前者对群体分析无决策价值，后者与地市下钻重复；段①改为 年龄构成 / 年龄与性别 / 医保类型 / 瘤种构成 / 分期构成 / 关键字段有效情况',
   '段②新增「分瘤种早诊情况」（早诊率 / IV 期占比 / 分期缺失率）与「分地市早诊差异（按 IV 期占比降序）」，把总表里的地区与病种差异落成可对标表',
   '段③指标卡改为 病理确诊率 / MDT 覆盖率 / 多方式治疗率 / 治疗启动覆盖，去掉无基准的转诊占比与日期冲突卡（保留为表内明细）',
   '段④缺口清单按总表口径改写为 5 年相对生存率、随访新增转移/复发风险、治疗完成与不良反应发生率、生存随访完成率（满 5 年）',
   '指标明细表新增「参考基准」「达标判定」两列，分组按总表分类改名 B 早期发现 / C 规范诊疗 / D 随访管理 / E 就医流向；CSV 同步输出官方指标名、基准与判定',
   '分瘤种与分地市矩阵增加「分期缺失率」列，早诊率列名改为官方叫法，便于直接对照总表']},
  {v:'V13.1',time:'2026-10-30',by:'管理员',desc:'指标汇总改为严格按专科画像字段取数：每项指标可溯源，画像未采集字段不再生成数值',cur:false,changes:[
   '新增画像字段字典 SP_PORTRAIT_FIELDS 与指标映射 SP_METRIC_FIELD：指标汇总的唯一取数白名单，逐项对应画像四块展示字段及业务来源',
   '指标明细表与 CSV 新增「画像字段」「字段来源」两列，任一数字都能反查到画像详情页的哪一项、从哪个系统取数',
   '删除画像未采集字段支撑的指标：既往史构成、症状记录、发现途径、初诊远处转移、既往外省诊疗、ECOG/营养、RECIST 疗效、复发/进展/转移、姑息/安宁疗护',
   '删除无取数基础的指标：首次新确诊患者数（缺历史首次确诊日期）、按期随访完成率（缺随访任务表）、随访在管患者数（缺管理状态字段）',
   '「在管」改为按画像随访工作状态=随访中且存活、未失访判定；「转诊记录占比」改为按有效转院就诊记录判定，分母为转诊状态可判定瘤例',
   '新增第六组「画像未采集字段」：只列字段、来源与受影响指标，一律不生成数值，便于按缺口补数据字典与接口',
   '治疗方式按画像口径收敛为六类（手术/放疗/化疗/靶向/免疫/内分泌），介入等非六类记录按实际展示但不参与占比',
   '患者画像「肿瘤特征」补分期期别与分期确认日期，「诊疗过程」补确诊至首次治疗间隔与转诊记录，使汇总的早晚期占比、诊疗时效、转诊占比有对应展示项',
   '八项核心概况改为 患者数/瘤例数/早期占比/IV期占比/治疗启动覆盖/MDT占比/随访覆盖/失访占比，全部落在画像字段上',
   '段②段③段④的图表位补入「确诊年份构成」「分瘤种筛查覆盖」「首次治疗日期可推算情况」「观察时长分组」，替换被删除的无依据图表',
   '配置页同步：治疗方式要素改称「六类」，诊断依据覆盖率改由 spDiagBasisType 判定，转诊覆盖率改按转院记录判定']},
  {v:'V13.0',time:'2026-10-25',by:'管理员',desc:'患者群体总览统计口径修订与原型同步优化',cur:false,changes:[
   '统一患者/瘤例去重、确诊区间和截止日，区分存活、死亡、失访与在管记录',
   '各指标标明有效分母、不详与不适用；年龄和诊疗时效直接按有效日期计算',
   '取消无依据达标结论、累计漏斗和固定费用估算，正式生存与费用明确显示数据缺口',
   '保留五组分析；总览、明细与CSV共享统计口径，支持独立筛选和患者下钻',
   '历史统计缺少日期或快照证据的状态归为不详，截止日后事件不纳入统计']},
  {v:'V12.9',time:'2026-10-22 15:00',by:'管理员',desc:'块2 肿瘤特征字段调整：临床分期位改显示「分级」，诊断依据单列，删除分期类型与分期时间',cur:false,changes:[
   '「临床分期」位置改为展示「分级」（取 e.grade，如「中分化」「II级」），标签与取值同步替换',
   '「分期依据」改名为「诊断依据」，口径不变：有病灶形态学编码（ICD-O-3）即判为病理学诊断，否则为临床诊断；随位置调整移至该行末列，保留单列一项、不跨行',
   '删除「分期类型」（初诊分期/治疗后重新分期）与「分期时间」两项，块 2 由 11 项减为 9 项',
   '清理随之失效的 spStageBasisType、spStageTiming 两个函数；段②「确诊依据构成」改由新增的 spDiagBasisType 承接，口径不变',
   '配置页同步：画像要素 DE04/DE05 替换为「分级」「诊断依据」两项（DE06 删除），覆盖判定字段库 stagebasis/stagedate/stagetype 改为 grade/diag_basis，要素-校验绑定诊断依据沿用 R004',
   '完整度仍按画像块展示项统计（未纳入分级、诊断依据），口径与本次改动前一致',
   '块标题右侧的状态标签（职工医保 / III期 / MDT / 随访中+存活）一并移除：这些值与块内字段重复，且样式各自不同显得杂乱；spBlock 去掉 tags 形参与 .sp-block-tags 样式',
   '检查检验记录表移除「画像依据」「异常」「未见异常」三个标签：异常改为结果文字标红（沿用表内 tr.sp-lab-abn 的红色口径），「项目」列的灰色机构名保留',
   '检查结果弹窗同步：顶部信息条与「结论小结」去掉「画像依据 / 结果异常 / 未见异常」标签，异常时只把结论与「结果异常」字样标红']},
 {v:'V12.8',time:'2026-10-09 15:00',by:'管理员',desc:'患者专科画像筛选栏新增「医院」筛选：按就诊医院精确过滤患者列表',cur:false,changes:[
  '问题：列表页已展示「就诊医院」列，但筛选栏只能按地市粗筛；同一地市下有多家医院（如南昌市同时有江西省肿瘤医院与南昌市第一医院），无法只看某一家机构的收治患者',
  '筛选栏在「地市」与「随访状态」之间新增「医院」下拉（标准 170px 档，与其它条件同宽同高），取值精确匹配 e.hospital，与关键字/瘤种/分期/地市/随访状态各条件为「与」关系',
  '选项来源新增 SP_HOSPITALS：由既有机构-地市映射 SP_HOSP_CITY 按地市顺序派生，不另行硬编码一份医院名单，避免两处名单漂移',
  '查询/重置同步接入 _wbFilters.hospital：查询读 spWbHospital 当前值，重置清空该条件并恢复全量',
  '群体画像→患者列表的下钻（_spGpToPatients）同步补 hospital 空值，保持筛选状态对象结构完整',
  '地市与医院为两个独立条件、不做联动过滤：可单用、可叠用（地市+医院=同一地市内某机构）；选择与地市不符的医院时结果为 0 例并提示「无符合条件的患者」，行为可预期',
  '版式：医院下拉用标准 170px 档（未用 wide 240px）——6 项加按钮仍收在同一行，筛选栏高度与改动前一致（91px），不改动任何 CSS；最长机构名「九江市第一人民医院」120px < 可用 150px，不会被截断']},
 {v:'V12.7',time:'2026-10-02 17:30',by:'管理员',desc:'新增「指标明细表」Tab：全部聚合指标列成可读表格，支持整表 CSV 导出与一键复制到 Excel',cur:false,changes:[
  '问题：群体画像各图形页（饼/条/漏斗/热力）利于读趋势，但数字散落在图里，难以整体导出或粘进报表',
  '五段 Tab 后新增第 6 个「指标明细表」Tab：把总览 KPI 带 + 五段的全部聚合指标按「人群/发现/诊疗/结局/公平」五组列成「指标 / 数值 / 口径」三列表',
  '追加分病种明细表（例数/早诊率/晚期占比/随访覆盖率/观察生存率）与分地市明细表（例数/早诊率/晚期占比/跨市就医率/随访覆盖率）',
  '顶部提供「导出 CSV」（带 UTF-8 BOM，Excel 直接打开不乱码；文件名含当前范围与日期）与「复制全部」（Tab 分隔，可直接粘进 Excel）两个动作',
  '当前地市/瘤种筛选同步作用于本表与导出——导出的永远是当前范围的口径；表格与导出数据同源 spAgg/spSiteRows/spCityRows，确保图表与导出完全一致',
  '新增 spMetricsGroups（数据）/spMetricsTable（渲染）/spMetricsFlatRows（扁平化供导出复制共用）与 _spExportMetricsCSV/_spCopyMetrics 两个窗口方法；全部由既有字段聚合，不新增采集']},
 {v:'V12.6',time:'2026-10-02 16:30',by:'管理员',desc:'段①版式微调：年龄结构+居住地并排一行，医保/瘤谱/分期三饼并排一行，需关注提示下线',cur:false,changes:[
  'A 人群特征：年龄结构（男/女）与居住地分布（区/县）并排一行（sp-2col），医保从本块移出',
  'B 病情构成：医保类型构成、瘤谱构成、分期谱构成三饼并排一行（新增 sp-3col 栅格），其下为各瘤种分期构成堆叠条',
  '移除页面底部「需关注提示」整块（spIssuesPanel 不再在 renderOverview 调用），短板导航交由各 Tab 自身与预警模块承担',
  '新增 .sp-3col 栅格样式（含 ≤900px 单列降级）；全部由既有字段实时聚合，不新增采集']},
 {v:'V12.5',time:'2026-10-02 15:00',by:'管理员',desc:'段①信息升级：热力矩阵→各瘤种分期堆叠条、医保独立成饼、重点问题降格为需关注提示',cur:false,changes:[
  '问题1：「瘤种×分期热力矩阵」在 N≈13 队列下 max 例数仅 2-3，色深拉不出梯度、28 格大半为「–」，是视觉噪声且与上方两饼信息重叠',
  '替换为「各瘤种分期构成」100% 堆叠条（spSiteStageStack）：每行一瘤种、条宽=例数量级、段=各分期占比，小样本下可读，直接指向「哪个瘤种发现得晚」，与段②早诊形成因果线',
  '问题2：「人群基础构成」原把医保+居住地塞一个面板。医保类别少，拆出独立做饼（与瘤谱饼/分期饼视觉节奏统一）；居住地长尾，保留横向条单独成行；年龄金字塔与医保饼并排',
  '保持「A 人群特征 / B 病情构成」语义分块不变——医保饼仍在 A 块、不与 B 块两饼并排，避免打破分块语义',
  '问题3：「重点问题」原为类告警表格，与预警模块（地市级聚合阈值+工单流转）性质重叠但口径更薄弱。降格为轻量「需关注提示」chip 组，明确定位为「画像速览短板·导航」，点击仍带筛选跳对应 Tab 并回跳患者列表（个体闭环是预警给不了的独有价值）',
  '提示文案标注「正式阈值告警见预警监测模块」，两边名实分离；无短板时显示绿色「各环节未见明显短板」',
  '全部由患者画像既有字段实时聚合，不新增采集字段；spHeat 构件保留（段④分期×结局仍在用）']},
 {v:'V12.4',time:'2026-10-01 10:30',by:'管理员',desc:'段①板块划分重构：按「人群特征 + 病情构成」两块组织，「疾病负担」改名「人群与病情构成」',cur:false,changes:[
  '问题：段①按「手上有什么字段」平铺，把人群特征、病情构成、临床状态、就诊途径四类性质不同的内容塞进同一个叫「疾病负担」的抽屉，且顶部 4 个小指标与年龄金字塔重复讲年龄性别',
  '段①内部明确分两块：A「人群特征」（在管规模/年龄性别/中位年龄/共病 + 医保/居住地）B「病情构成」（瘤谱/分期谱/瘤种×分期热力矩阵）',
  '顶部小指标 8→4：移除与年龄金字塔重复的「主力年龄段」「65 岁及以上」等，只留在管患者、男/女、中位年龄、有基础疾病',
  '「因症就诊（发现时症状状态）」移入段②早期发现，与「筛查参与」配对成完整的「发现途径」，不再把同一件事劈在两段',
  'SP_DOMAINS burden 标签「疾病负担」→「人群与病情构成」，重点问题扫描类型同步，名实相符（本段本就是病例组合描述，非流行病学负担）',
  '新增构件 spGpHead 与 .sp-gp-head 样式（块标题带序号 + 副说明）；spPanel 等其它构件不变',
  '基础疾病保留在段①人群特征——共病率是「这群人是谁」的特征；症状不单列，作为段②发现途径的判定依据',
  '全部由个体画像既有字段实时聚合，不新增采集字段']},
 {v:'V12.3',time:'2026-10-01 10:00',by:'管理员',desc:'段①「疾病负担」补全人群画像维度：新增老龄化、居住地、基础病与症状负担',cur:false,changes:[
  '问题：段①「疾病负担」人群描述仅「年龄结构 + 医保类型」两块，与「画像」定位不符，也撑不起「负担」二字',
  '小指标带 4 项扩为 8 项：保留在管患者/病种数/男女人数/主力年龄段，新增中位年龄、65 岁及以上（例数与占比）、有基础疾病（既往史）、因症就诊（有症状）',
  '新增「居住地分布（区/县）」横向条形，与医保类型合并为「人群基础构成」复合面板（.sp-sec 小节分隔），补齐空间维度',
  '新增 spHBar 第三参数 labWide：标签列 72px→110px，解决「抚州市临川区」等长标签被省略号截断；默认行为不变，不影响其他调用点',
  '全部新增指标由患者画像既有字段（age/region/pastHistory/symptom）实时聚合，不新增采集字段',
  '口径说明：合并基础疾病以既往史是否含「无特殊」判定；因症就诊以症状记载非空且非「无」判定，与筛查发现互补',
  '评估后移除：曾试加的「体能状态 ECOG」「营养风险分布」两块身体负担面板，业务确认不纳入本段']},
 {v:'V11.4',time:'2026-09-24 12:00',by:'管理员',desc:'板块02设计修正：诊疗时效图改为群体口径，移除逐例患者行',cur:false,changes:[
  '「诊疗路径」Tab 的「诊疗时效」图原为逐例患者双段条：每行一位患者姓名、可点击直达个体画像——把板块①的个体视角混入了板块②群体总览，N 例即 N 行，数据量增长后面板不可用',
  '改为群体口径：首诊→确诊、确诊→首治两段中位天数对比条（同一尺度），标题同步去掉「按总时长降序」',
  '新增区域级预警信息：总时长中位数、超 30 天（区域管理阈值）例数与占比，替代原逐例标注',
  '移除群体→个体直达事件 _spGpOpenPatient 与配套 hover 样式；诊疗旅程姓名点击入口下线，群体→明细统一走患者列表与病种卡筛选',
  '全部指标仍由患者画像字段实时聚合，不新增采集字段']},
 {v:'V11.3',time:'2026-09-24 11:00',by:'管理员',desc:'板块02人群结构 Tab 版式修复：单饼图大格子改为复合构成面板',cur:false,changes:[
  '「人群结构」Tab 右栏原为单独「医保类型构成」环图：13 例仅 3 类医保，160px 环图 + 3 行图例在半宽面板内大片留白，与左侧年龄金字塔高度失衡',
  '改为「人群基础构成（性别 / 医保 / 筛查）」复合面板：性别构成堆叠条（男蓝/女粉）、医保类型横向条形（按例数降序）、筛查参与堆叠条（已参与/不详），三段小节标题分隔',
  '筛查参与口径对齐个体画像块1「筛查参与信息」：有筛查方式记录=已参与，无记录=不详，不计入参与率分母，不新增采集字段',
  '新增 .sp-sec 小节标题样式（主题色竖条 + 分隔线），用于复合面板内多段区分']},
 {v:'V11.0',time:'2026-09-24 09:00',by:'管理员',desc:'块1 新增筛查参与信息；块2 加回 ICD-10 与 ICD-O-3 编码',cur:false,changes:[
  '块 1 患者基础新增「筛查参与信息」子题，含五项：筛查参与（已参与/未参与/不详）、筛查方式、筛查时间、筛查结果、筛查建议',
  '「已参与」与「未参与」「不详」严格区分：有筛查记录=已参与；明确标注未参与=未参与；无记录=不详，不计入参与率分母',
  '块 2 肿瘤特征加回 ICD-10、ICD-O-3 部位码、ICD-O-3 形态码三项（V9.0 瘦身时曾移出，V9.3 移除档案面板后从界面消失）',
  'ICD 编码由部位与病理文本自动映射（复用登记报告卡既有推导口径），非新增采集字段；ICD-10 取 ICD-O-3 部位码主码',
  '数据补齐：13 例患者补筛查方式/时间/结果/建议四项，依据各自已有的转诊事由与检查记录（如宫颈癌患者的 TCT+HPV 两癌筛查记录）',
  '筛查结果与筛查建议拆为两个独立字段，确保一格一值（原「TCT 示 HSIL；HPV16 阳性，建议阴道镜活检」为多值）',
  '配置页同步：画像要素 19→27 项、覆盖判定字段库 20→27 项，患者基础 5→10 项、肿瘤特征 4→9 项',
  'SP_SOURCES 数据来源新增「筛查管理数据」',
  '修复字段库首项多余逗号导致的空元素（原 [, ,] 使覆盖率统计出现空条目）']},
 {v:'V11.2',time:'2026-09-24 10:30',by:'管理员',desc:'板块02信息密度升级：新增路径节点条/诊疗时效旅程/热力矩阵/地市对照四类构件，替换低密度小图形',cur:false,changes:[
  '新增「诊疗路径覆盖」节点条：在管/基层首诊/转诊/规范治疗/MDT/综合治疗/随访覆盖七环节例数与占比同屏，占比分档着色（≥90% 绿 / 60-89% 琥珀 / <60% 红），薄弱环节一眼可见',
  '新增「诊疗时效」旅程图：每例患者首诊→确诊（蓝）→首治（琥珀）双段条按总时长降序，标注中位总时长；点击患者姓名直达板块①该患者个体画像详情（群体→个体闭环补全）',
  '指标区新增两个时效 KPI：首诊→确诊中位天数、确诊→首治中位天数（由 firstDate/diagDate/tTreat 实时计算）',
  '新增热力矩阵构件并两处应用：瘤种×分期矩阵（替代原逐病种堆叠条组）、分期×结局矩阵，色深=例数、空格灰显，比多组小图更易横向对比',
  '新增「地市综合对照」表：患者数/早期占比/晚期占比/跨市就医率/随访覆盖率五指标内嵌条形，城市名可点击下钻，替代原仅有患者数的地区分布条形图',
  '随访与结局 Tab 新增「当前结局状态构成」环图（存活/带瘤/死亡/失访）；全部数据仍由患者画像字段实时聚合，不新增采集字段']},
 {v:'V11.1',time:'2026-09-24 09:00',by:'管理员',desc:'群体画像卡细节打磨：维度卡与四维 Tab 双向联动高亮，标签口径与镜像关系表达统一',cur:false,changes:[
  '维度卡与四维 Tab 双向联动：点击 Tab 或维度卡，两者同步高亮（主题色左边框 + 序号反白），当前查看维度一目了然',
  '维度卡标题重排为两行：主行=群体维度名（人群结构/瘤种与分期/诊疗路径/随访与结局），副行标注「镜像自个体画像 · 患者基础」等来源块，替代原单行「患者基础 → 人群结构」易折行写法',
  '维度卡 hover 显示「查看 →」角标、激活时显示「正在查看」，明确可点击性；点击后滚动定位到 Tab 行而非面板，激活 Tab 与内容同屏可见',
  '摘要区增加「一句话画像」引导徽章；随访与结局维度卡标签口径统一为比率（失访率/死亡率），与其他维度一致',
  '空状态升级：范围无患者时给出范围提示 + 「重置筛选条件」一键操作，替代原单行灰字',
  '修复「年龄结构（男/女）」版式错乱：原单行内联布局（男条+男N+女条+女N 一字排开）在半宽面板内放不下导致全部换行、0 值条形消失；重构为年龄金字塔——中轴年龄段+合计小字，男左女右条形从中轴向两侧伸展、同一尺度缩放，顶部男/女图例，任意面板宽度不换行',
  '重点问题类型列与四维 Tab 完全对齐（原「综合」改为「人群结构」），并将循环内重复聚合提出，仅口径文案与交互优化，指标计算逻辑不变']},
 {v:'V11.0',time:'2026-09-24 08:00',by:'管理员',desc:'板块02重定位为「群体专科画像」：与患者画像四维同构，新增群体画像卡与明细回跳闭环',cur:false,changes:[
  '板块02由「画像指标汇总」更名为「群体专科画像」，定位为板块01患者画像的总结归纳：个体读"值"，群体读"分布与率"',
  '新增顶部「群体画像卡」：一句话自然语言归纳（在管数/年龄段/性别/瘤种/分期/主流方案/随访覆盖）+ 四维特征标签，视觉结构与患者详情页四块画像同构，点击维度卡切换对应四维 Tab',
  '六大板块归并为四维 Tab：人群底数→人群结构；病情分期+瘤种构成→瘤种与分期；就医流向+诊疗模式+经济负担→诊疗路径；随访与结局不变；Tab 序与个体画像四块一致',
  '重点病种画像卡由页面平铺移入「瘤种与分期」Tab，并新增「诊断依据构成」（病理学/临床）面板，对齐个体画像诊断依据字段',
  '页面顺序调整为：范围筛选 → 群体画像卡 → 核心 KPI → 四维 Tab → 地图排行 → 重点问题',
  '新增群体→明细闭环：群体画像卡「查看患者明细」按钮带当前地市/瘤种筛选条件跳回板块01患者列表；重点问题「查看」同步指向新四维 Tab',
  '全部指标口径不变，仍由患者画像字段实时聚合，不新增采集字段']},
 {v:'V10.6',time:'2026-09-24 07:00',by:'管理员',desc:'块3 字段顺序调整：MDT 移至「是否发生转诊」之后',cur:false,changes:[
  '「治疗与转诊」组内字段顺序调整为：首次治疗日期 → 确诊→首次治疗 → 是否发生转诊 → MDT',
  '调整理由：把治疗及时性两项与转诊、MDT 两项按「治疗—转诊—多学科」的语义顺序排列，转诊与 MDT 相邻便于对照阅读',
  '仅调整展示顺序，字段取值、数据口径与配置页元数据均不变']},
 {v:'V10.5',time:'2026-09-24 06:30',by:'管理员',desc:'移除「治疗状态」：该值系由当前方案正则推导，信息量低于原字段',cur:false,changes:[
  '块 3 治疗与转诊组移除「治疗状态」项，该组余 MDT、首次治疗日期、确诊→首次治疗、是否发生转诊四项',
  '移除原因：该值并非采集字段，而是由 curPhase（当前方案）做关键字匹配推导而来（含「中」结尾→治疗进行中、「随访」→治疗结束、「维持」→维持治疗中），属信息降级',
  '原 5 类取值（治疗进行中/维持治疗中/治疗结束随访中/失访状态不明/治疗终止死亡）与 curPhase 原值重复，其中失访、死亡两类已由块 4「生存状态」覆盖',
  '清理 spTreatStatus 函数；配置页同步：画像要素 20→19 项、覆盖判定字段库 21→20 项，诊疗过程维度 5→4 项',
  '完整度口径同步移除该项',
  '注：curPhase 数据字段保留在患者记录中（13/13 有值），指标汇总的姑息治疗率统计口径不受影响']},
 {v:'V10.4',time:'2026-09-24 05:30',by:'管理员',desc:'块3 布局调整：治疗方式三项同行，转诊并入治疗与转诊并简化为是否',cur:false,changes:[
  '治疗方式（手术/放疗/化疗）由纵向排列改为三列同行展示，新增 sp-cols-3 网格应用',
  '「是否发生转诊」由独立「转诊轨迹」子题并入「治疗与转诊」组，与治疗状态、MDT、首次治疗日期、确诊→首次治疗同组呈现',
  '转诊取值简化为「是 / 否」，移除转诊层级路径（原「基层 → 市级 → 基层」）与徽标',
  '块 3 子题由三个（治疗与转诊、治疗方式、转诊轨迹）减为两个，结构更紧凑',
  '配置页同步：要素与字段库名称由「转诊轨迹（是否转诊 + 层级）」改为「是否发生转诊」',
  '清理随之失效的 spReferralPath（转诊层级路径推导）、spOrgTier（机构层级归类）、spKvHtml（HTML 通栏项）三个函数',
  '注：转院层级信息仍在患者详情页「转院就诊记录」表与「画像时间线」中完整呈现，仅画像块不再展示']},
 {v:'V10.3',time:'2026-09-24 04:30',by:'管理员',desc:'治疗方式收敛为手术/放疗/化疗三项；随访与结局移除转归三项',cur:false,changes:[
  '治疗方式分项由五项（手术/放疗/化疗/靶向/免疫）收敛为三项：手术、放疗、化疗',
  '块 4 随访与结局移除「复发」「转移」「疾病进展」三项，仅保留生存状态、末次随访日期、生存时间（推算）、死亡原因',
  '配置页同步：画像要素 23→20 项、覆盖判定字段库 24→21 项，随访与结局维度 7→4 项',
  '完整度口径同步移除转归三项',
  '注：recurrence / metaProgress / diseaseProgress 数据字段保留在患者记录中（13/13 有值），仅不再作为画像要素展示；指标汇总的复发率/转移率/进展率统计口径不受影响']},
 {v:'V10.2',time:'2026-09-24 03:30',by:'管理员',desc:'一格一值：拆开所有多值单元格，一个字段只承载一项信息',cur:false,changes:[
  '「分期依据 / 评估时间」拆为三项：分期依据（病理学诊断/临床诊断）、分期时间、分期类型（初诊分期/治疗后重新分期）',
  '「性别 / 年龄」拆为性别、年龄两项',
  '「户籍地 / 区县」拆为独立的户籍地一项',
  '「疾病转归（复发 / 转移证据）」拆为三项：复发、转移、疾病进展',
  '修复病理类型与分化程度重复展示：「低分化腺癌（低分化）」→「低分化腺癌」；病理名已含分化描述时不再追加括号',
  '新增 spPathText：病理类型去重复构造；spStageBasisType/spStageTiming 承接原 spStageBasis 的两项职责',
  '配置页同步：画像要素 18→23 项、覆盖判定字段库 18→23 项（性别/年龄分列、分期拆三项、转归拆三项）',
  '清理孤儿函数 spDiseaseOutcome、spKvRow（其职责已由拆分后的独立字段承接）',
  '新增回归断言：扫描全部 13 例，任一单元格值不得含 · | ； 等分隔符，从机制上防止再次出现多值挤一格']},
 {v:'V10.1',time:'2026-09-24 02:30',by:'管理员',desc:'移除分子标志物要素',cur:false,changes:[
  '块 2 肿瘤特征移除「分子标志物」及其子题，该块余 6 项：原发部位、病理类型、临床分期、TNM、确诊日期、分期依据/评估时间',
  '配置页同步：画像要素 19→18 项、覆盖判定字段库 19→18 项、校验规则 13→12 条（移除 R005 分子标志物三要素校验）',
  '移除映射规则 MR05（分子标志物三要素）',
  '重建要素-校验绑定 SP_ELEM_CHECK：原绑定引用了 marker/site/path/diagbasis/treat/treatdate/nodes/recist/ecog 等已失效 key，现按 18 项要素与 12 条规则重新对齐，无失效项',
  '清理孤儿函数 spMarkerRows、spLastTreat',
  '注：marker 数据字段保留在患者记录中（13/13 有值），仅不再作为画像要素展示与统计']},
 {v:'V10.0',time:'2026-09-24 01:00',by:'管理员',desc:'画像字段按最终清单定稿：19 项，每项明确展示用途与统计口径',cur:false,changes:[
  '块1 患者基础：性别、年龄（分层变量）、户籍地/区县（聚合维度）、就诊机构（聚合维度）、医保类型',
  '块2 肿瘤特征：原发部位、病理类型、临床分期、TNM、确诊日期、分期依据/评估时间、分子标志物',
  '块3 诊疗过程：治疗状态、治疗方式分项、MDT、首次治疗日期（治疗及时性）、转诊轨迹',
  '块4 随访与结局：生存状态、末次随访日期（失访率）、生存时间（推算）、疾病转归（复发/转移证据）、死亡原因',
  '新增「确诊日期」：所有时间类指标的起点',
  '新增「分期依据 / 评估时间」：自动判定「初诊分期」或「治疗后重新分期」',
  '新增「首次治疗日期」及派生指标「确诊→首次治疗」间隔，用于治疗及时性评价',
  '「累计治疗方式」拆细为手术/放疗/化疗/靶向/免疫五项分别标注 有/无，严格区分「无」与「未记录」，便于计算治疗方案规范率',
  '新增「转诊轨迹」：由转院记录自动推导层级路径（基层→区县→市级→省级/省外）',
  '转诊层级判定修正：先判省外再判省内层级，避免外省三甲被误判为「省级」',
  '「生存时间」标注为推算值，由确诊日期与死亡/末次随访日期算得',
  '新增 spKvHtml 构件：通栏项值为可信 HTML 时不做转义']},
 {v:'V9.4',time:'2026-09-23 23:50',by:'管理员',desc:'详情页患者基础块：「所在地区」改为「户籍地」，与列表页「户籍地市」列口径统一',cur:false,changes:[
  '块 1 患者基础：「所在地区」→「户籍地」（取值仍为 e.region，如「南昌市东湖区」）',
  '措辞对齐：患者列表列头原已使用「户籍地市」口径（取 e.city，如「南昌市」），详情页此前写作「所在地区」易被误读为常住/现居地',
  '本次仅改标签文案，不改数据字段与取值，列表/汇总/质控口径不受影响']},
 {v:'V9.3',time:'2026-09-23 23:20',by:'管理员',desc:'移除「完整档案」折叠面板，详情页只保留画像主体与三张记录表',cur:false,changes:[
  '整块移除「完整档案（编码 / 日期 / 诊疗台账）」折叠面板',
  '随之移除的展示项：身份与编码（出生日期/身份证号/机构层级/户籍地市/ICD-10/ICD-O-3 部位码与形态码/分化程度）、时间节点（首诊/确诊/分期确认/首次治疗/末次随访/RECIST 评价/ECOG 评估/分子检测/死亡）、诊断依据全文、分子标志物清单、诊疗台账（各方式方案与起止、累计线数、转诊）、随访与生存明细',
  '详情页信息层级简化为：患者条 + 四块画像 + 检查检验记录 / 转院就诊记录 / 画像时间线',
  '清理随之失效的代码：spFullRecord、spPanelFold 及折叠样式；顺带清理历史遗留的孤儿函数 spIcd10、spRecist、spRecistCls、spBirth、spOrgLevel、spStableBadge、spEcg、spPlanText、spTreatRows、spFirstTreat、spLineCount、spRecistText、spMarkerDetail、spLastTreatText、spLastTreatRange',
  '注：被移除项的数据字段均保留在患者记录中，患者列表、指标汇总与质控校验的口径不受影响（ICD 编码派生能力保留，供聚合使用）']},
 {v:'V9.2',time:'2026-09-23 22:40',by:'管理员',desc:'随访与结局块精简：移除疾病状态与 ECOG 体能评分',cur:false,changes:[
  '块 4 随访与结局移除「疾病状态（RECIST）」与「ECOG 体能」两项，保留生存状态、生存时间、疾病转归（3 项）',
  '上述两项在「完整档案 → 随访与生存」中补充展示具体值（疾病状态 RECIST 结果、ECOG 体能评分），确保数据可查、不丢失',
  'RECIST 评价日期与 ECOG 评估日期原已在档案「时间节点」中，保持不变']},
 {v:'V9.1',time:'2026-09-23 22:00',by:'管理员',desc:'顶部患者条简化：主索引上提至姓名行，移除右侧重复标签',cur:false,changes:[
  '脱敏主索引由画像块 1 上提至顶部患者条姓名行，与性别、年龄、身份证号同行展示',
  '块 1 患者基础：移除「脱敏主索引」项，保留性别/年龄、医保类型、所在地区、就诊机构（4 项）',
  '移除顶部患者条右侧的瘤种/分期/病理标签——该三项与画像块 2「肿瘤特征」重复，无信息增量',
  '画像完整度指标保留在顶部条右侧',
  '移除随之失效的 .sp-patient-badges 样式及其响应式规则']},
 {v:'V9.0',time:'2026-09-23 21:00',by:'管理员',desc:'画像瘦身：四块只留描述患者本人的要素，台账与编码收进折叠档案',cur:false,changes:[
  '画像定位校正：画像用于快速读懂"这是个什么样的患者"，而非记录诊疗流水；日期、编码、方案属台账，不进画像',
  '块1 患者基础：性别/年龄、医保类型、所在地区、就诊机构、脱敏主索引（5 项）',
  '块2 肿瘤特征：原发部位、病理类型、临床分期、TNM、分子标志物（5 项）',
  '块3 诊疗过程：治疗状态、累计治疗方式、MDT、最近一次治疗（4 项）——移出该次起止、累计线数、首次治疗日期、治疗明细、转诊',
  '块4 随访与结局：生存状态、生存时间、疾病状态、ECOG 体能、疾病转归（5 项）——移出末次随访日期、RECIST 评价日期、死亡日期',
  '分子标志物由逐条展开改为一⾏摘要（项目 结果 并列），完整三要素清单移入档案，避免条目数多寡撑高整块',
  '新增「完整档案」折叠面板（默认收起）：收纳身份与编码、时间节点、诊断依据、分子标志物清单、诊疗台账、随访与生存明细',
  '新增 spPanelFold 折叠面板构件与对应样式（点击标题展开/收起）',
  '四块合计由 20 项降至 19 项，但移出主视图的台账项达 20+ 项；每块稳定 4–6 项，一屏可读',
  '数据未删减：所有移出项均可在「完整档案」中查阅，导出与聚合口径不变']},
 {v:'V8.4',time:'2026-09-23 19:30',by:'管理员',desc:'详情页四块排版重构：消除长值折行与参差列宽',cur:false,changes:[
  '修正 word-break:break-all 导致编码被硬拆（ICD-O-3 C34.9 曾被断成「C34.」+「9」两行），改为 overflow-wrap:break-word + word-break:normal',
  '键值网格由 auto-fill 不定列改为固定两列（minmax(0,1fr)），列宽稳定、不再参差',
  '新增通栏项样式 .sp-span：长文本（脱敏主索引、诊断依据、最近一次治疗、治疗明细、疾病转归）占满整行，不再挤在半列内折行',
  '新增同行键值样式 .sp-inline：短值（日期/编码/类别）键与值同行，压缩纵向高度',
  '原发部位不再把「ICD-10 C34 / ICD-O-3 C34.9」塞进同一格，拆为原发部位、ICD-10、ICD-O-3 部位码、ICD-O-3 形态码四项',
  '「形态学 ICD-O-3」拆为「病理类型」与编码两行，避免病理名与编码挤压',
  '「区县 + 机构层级」拆为区县、机构层级两项；「出生日期（63岁，系统推导）」拆为出生日期与年龄（系统推导）',
  '疾病状态与 RECIST 评价日期拆为两项，ECOG 与评估日期合并为一项',
  '修正块 4 与块 2、块 3 中通栏项落在网格容器外导致 div 不闭合的问题（13 例全部平衡）']},
 {v:'V8.3',time:'2026-09-23 18:00',by:'管理员',desc:'列表页「随访状态」改为单标签，取消随访/生存双标签重复展示',cur:false,changes:[
  '「随访与生存」列改回「随访状态」，单标签展示，不再并列两枚标签',
  '取值改用生存状态（存活 / 存活（带瘤）/ 失访 / 死亡）——原随访状态「随访中」已隐含存活，与生存状态重复',
  '保留「存活（带瘤）」标注：该区别反映肿瘤未根治状态，具有临床意义，不因合并展示而丢失',
  '标签配色随取值区分：存活=绿、存活（带瘤）=橙、失访=红、死亡=灰']},
 {v:'V8.2',time:'2026-09-23 17:00',by:'管理员',desc:'患者列表列结构调整：拆分部位/病理、合并随访与生存、新增就诊医院',cur:false,changes:[
  '「部位+病理」拆分为「部位」与「病理」两列，便于按亚部位与病理类型分别查阅',
  '移除「当前阶段」列：该列属诊疗过程内页信息，列表层以「治疗方式」与随访结局为主',
  '「随访状态」与「生存状态」合并为「随访与生存」一列（两枚标签并排），压缩列宽；失访者两者同义时只显示一次',
  '新增「就诊医院」列，紧邻户籍地市，便于比对属地就医与跨市/跨省就医',
  '列顺序调整为：患者/性别/年龄/户籍地市/就诊医院/瘤种/部位/病理/分期/治疗方式/随访与生存（共 11 列）',
  '移除随「当前阶段」一并失效的 spPhaseCls 样式函数']},
 {v:'V8.1',time:'2026-09-23 15:00',by:'管理员',desc:'诊疗过程改为「最近一次治疗」口径，消除不可界定的开放区间',cur:false,changes:[
  '诊疗过程取消「每种治疗方式 首次治疗日期 ~ 至今」的写法——手术等一次性事件本无开放区间，原写法产生"手术持续至今"的自相矛盾',
  '改为「最近一次治疗」：取全部治疗明细中执行到最后一天的一条，展示日期 + 方式 + 方案，并给出该次真实起止',
  '新增「累计治疗方式」：按时间顺序列出全部方式名称，保留"治过什么"的全貌，不因只显最近一次而丢失',
  '新增「治疗明细」子块：每种方式一行，手术为单日期或住院区间，放化疗/靶向为各自真实起止，不再共用首次治疗日',
  '首次治疗日期降级为推算值（取各方式最早起始日），不再手工录入',
  '数据补齐：13 例患者新增 treatments 明细，各方式起止取自其 phaseTimeline 节点与检查检验实际日期',
  '修正：原「手术 2026-02-05 ~ 至今、化疗 2026-02-05 ~ 至今」为同一 tTreat 变量派生的假数据，已按真实治疗史重建',
  '累计治疗线数改为按治疗明细推算，同日启动的同步放化疗合并为一线',
  '同日结束多条治疗时，仍在进行中的一条优先作为「最近一次治疗」',
  '数据修正：章含韵 treatMode 原列有「放疗」，但该患者术后放疗尚未执行即失访，已按实际治疗剔除（treatMode 应反映已发生的治疗）']},
 {v:'V8.0',time:'2026-09-23 10:00',by:'管理员',desc:'画像标签按业务确认的最终口径定稿：四类维度 20 项标签，补齐病程与结局要素',cur:false,changes:[
  '患者基础：脱敏主索引、出生日期（年龄由系统推导，不双写）、性别、医保类型、区县+机构层级',
  '肿瘤特征：原发部位 ICD-10、形态学 ICD-O-3、诊断依据、临床分期+分期确认日期、分子标志物（项目名+结果+检测日期三要素，缺一不可）',
  '诊疗过程：首次治疗日期、治疗方式（多值，按「方案+起止日期」结构化记录）、当前方案、治疗状态、治疗线数（推算值）、MDT/转诊（可选）',
  '随访与结局：末次随访日期、生存状态、疾病状态（RECIST+评价日期）、ECOG+评估日期、死亡日期/原因',
  '新增派生能力：ICD-O-3 部位码与形态学码由部位/病理文本自动映射，ICD-10 取部位码主码（复用登记报告卡口径）',
  '新增派生能力：治疗线数由「方案+起止日期」结构化记录推算，不手工录入',
  '新增派生能力：出生日期由身份证号 7–14 位推导，年龄改为展示期推导值，消除双写不一致',
  '数据补齐：13 例患者补齐 RECIST 疗效评价+评价日期、ECOG 评估日期、分子标志物检测日期',
  '数据修正：陈建国分期确认日期由 2026-06-18 更正为 2026-01-28（原值晚于首次治疗 2026-02-05，违反分期早于治疗）',
  '画像要素 15→20 项；映射规则 11→13 条；校验规则 8→13 条',
  '肿瘤特征移除 TNM 独立项（并入临床分期括号展示）、移除独立诊断日期（改用分期确认日期）']},
 {v:'V7.0',time:'2026-09-22 18:00',by:'系统',desc:'画像四类要素定稿：按业务确认口径收敛为 15 项',cur:false,changes:['四项画像块定稿为：患者基础 / 肿瘤特征 / 诊疗过程 / 随访与结局（第三块由「诊疗特征」更名为「诊疗过程」）','患者基础：年龄、性别、居住地、医保、EMPI（移除既往史、吸烟饮酒、家族史）','肿瘤特征：部位、形态学、病理类型、TNM 分期、诊断依据和诊断日期（移除分化程度、多原发）','诊疗过程：首诊/确诊/首次治疗时间节点、治疗方式、MDT、转诊轨迹','随访与结局：随访状态、生存时间、死亡原因（移除最近随访时间、失访标记、生存状态）','画像要素 18→15 项；移除既往史/吸烟饮酒/家族史后，原危险因素完整性校验合并进诊断依据校验','校验规则重建为 8 条，新增时间节点倒挂校验','注：被移出画像的字段（既往史、吸烟饮酒、家族史、分化程度、多原发等）数据仍保留在患者记录中，供患者列表与指标汇总页使用']},
 {v:'V6.9',time:'2026-09-22 17:00',by:'系统',desc:'画像要素按「免计算 / 抗多院干扰 / 免合并」三准则收敛',cur:false,time:'2026-09-22 15:30',by:'系统',desc:'按数据可获取性精简画像要素：裁撤 5 项难采集字段',cur:false,time:'2026-09-22 10:00',by:'系统',desc:'画像四类要素重构：患者基础/肿瘤特征/诊疗特征/随访与结局',cur:false,changes:['四类画像要素按业务口径重构为「患者基础、肿瘤特征、诊疗特征、随访与结局」','患者基础新增 EMPI 主索引、既往史、合并症、吸烟饮酒、家族史','肿瘤特征新增分子标志物、诊断依据与诊断日期','诊疗特征新增首诊/确诊/首次治疗三时间节点、住院次数/天数/费用','随访与结局新增随访依从性、生存时间、死亡原因','块内按子主题分组展示，长文本字段通栏呈现','新增 R007–R011 五项完整性校验']},
 {v:'V6.6',time:'2026-09-19 14:30',by:'系统',desc:'画像维度精简：诊疗特征与患者状态合并为「诊疗与现状」',cur:false,changes:['诊疗与现状合并为一块，五维画像改为四维','现状仅保留体能（ECOG）/营养风险/疼痛程度三项结构化评估','去除症状、康复、支持治疗等动态或与他块重叠的展示项','状态稳定度改按疼痛/营养/ECOG≥2 判定','新增R007现状评估完整性校验']},
 {v:'V6.0',time:'2026-09-11 10:00',by:'系统',desc:'画像架构升级：五维患者画像 + 指标汇总 + 配置质控三层',changes:['新增五维患者画像页（含画像时间线）','新增画像指标汇总六大板块与全省地图','画像配置迁移为四页签管理','要素/映射规则支持增删改与启停']},
 {v:'V5.1',time:'2026-09-03 15:20',by:'管理员',desc:'患者详情记录页签精简，质控子页并入详情页签',changes:['删除独立质控子页','详情页签合并筛查记录','时间线增加疗效评价节点']},
 {v:'V5.0',time:'2026-08-28 10:00',by:'系统',desc:'个案画像模型升级，新增评估与治疗要素',changes:['新增患者状态维度','新增营养/疼痛评估要素','随访要素扩展结局事件']},
 {v:'V4.2',time:'2026-08-25 14:30',by:'张医生',desc:'更新疗效评价，补充分子检测要素',changes:['补充分子检测字段','疗效评价规则更新','修正分期字段字典']}
];
/* 画像归档：含归档时点统计 */
var SP_ARCHIVES=[
 {id:'AR-2026-08',range:'2026-08 全省月度归档',events:86,note:'含死亡结案与失访封存',stats:{cities:11,sites:7,fuRate:92.4,earlyRate:31.2,score:94.2}},
 {id:'AR-2026-Q2',range:'2026年二季度归档',events:241,note:'季度画像基线',stats:{cities:11,sites:7,fuRate:91.8,earlyRate:30.5,score:92.9}},
 {id:'AR-2025-Y',range:'2025年度终末归档',events:913,note:'年终画像归档快照',stats:{cities:11,sites:7,fuRate:90.2,earlyRate:29.8,score:91.3}}
];
var _spMetaFilter={q:'',dim:''};
var _spRuleFilter={q:'',dim:''};

function renderConfig(){
  var h='<div class="sp-domain-tabs">'+SP_CFG_TABS.map(function(t){
    return '<button class="sp-domain-tab'+(_spCfgTab===t.key?' active':'')+'" onclick="window._spCfgTabSwitch(\''+t.key+'\')">'+t.label+'</button>';
  }).join('')+'</div><div id="spCfgBody">'+spCfgPanel()+'</div>';
  return h;
}
function spCfgPanel(){
  function spSel(id,cur,opts,placeholder,fn){
    return '<select id="'+id+'" onchange="'+fn+'"><option value="">'+esc(placeholder)+'</option>'+opts.map(function(o){return '<option'+(cur===o?' selected':'')+'>'+esc(o)+'</option>'}).join('')+'</select>';
  }
  /* ---- 页签一：要素与规则 ---- */
if(_spCfgTab==='elem'){
    var f=_spMetaFilter;
    var els=_spElements.filter(function(el){
      if(f.dim&&el.dim!==f.dim)return false;
      if(f.q&&(el.id+el.name+el.src).indexOf(f.q)<0)return false;
      return true;
    });
    var elRows=els.map(function(el){
      var ok=tumorEvents.filter(spFieldFn(el.fkey)).length;
      var cov=Math.round(ok/tumorEvents.length*100);
      var col=cov>=95?'var(--color-success-solid)':cov>=80?'var(--color-caution-solid)':'var(--color-danger-solid)';
      return '<tr><td>'+esc(el.id)+'</td><td>'+esc(el.dim)+'</td><td style="font-weight:600">'+esc(el.name)+'</td><td>'+esc(el.src)+'</td>'+
        '<td><div style="display:flex;align-items:center;gap:8px"><div class="sp-progress" style="flex:1"><i style="width:'+cov+'%;background:'+col+'"></i></div><span style="font-family:var(--font-num);font-weight:700;color:'+col+'">'+cov+'%</span></div></td>'+
        '<td class="ops">'+(function(){var rid=SP_ELEM_CHECK[el.fkey];if(!rid)return '—';var cr=spCheck(rid).run(),cb=cr.bad.length;return cb?'<button class="btn btn-ghost btn-xs" style="color:var(--color-danger-fg)" onclick="window._spCheckView(\''+rid+'\')">异常 '+cb+' 例</button>':badge('通过','badge-success')})()+'</td>'+
        '<td>'+(el.on?badge('已启用','badge-success'):badge('已停用','badge-gray'))+'</td>'+
        '<td style="white-space:nowrap">'+
          '<button class="btn btn-ghost btn-xs" onclick="window._spElemView(\''+esc(el.id)+'\')">查看</button> '+
          '<button class="btn btn-ghost btn-xs" onclick="window._spElemEdit(\''+esc(el.id)+'\')">编辑</button> '+
          '<button class="btn btn-ghost btn-xs" onclick="window._spElemToggle(\''+esc(el.id)+'\')">'+(el.on?'停用':'启用')+'</button>'+
        '</td></tr>';
    }).join('');
    if(!elRows)elRows='<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:24px 0">无匹配要素</td></tr>';
    return '<div class="panel">'+
        '<div class="panel-header"><span>画像要素元数据<span class="spr-count">'+els.length+' 条</span></span></div>'+
        '<div class="panel-body">'+
          '<div class="sp-filter-bar">'+
            '<div class="form-group wide"><label>关键字</label><input id="spMetaQ" placeholder="编号 / 名称 / 来源" value="'+esc(f.q)+'"></div>'+
            '<div class="form-group"><label>维度</label>'+spSel('spMetaDim',f.dim,SP_DIMS,'全部维度','window._spMetaFilterSet()')+'</div>'+
            '<div class="sp-filter-actions"><button class="btn btn-outline" onclick="window._spMetaReset()">重置</button><button class="btn btn-primary" onclick="window._spElemAdd()">新增要素</button></div>'+
          '</div>'+
          '<div class="sp-table-wrap"><table class="data-table" style="min-width:896px"><thead><tr><th style="width:72px">编号</th><th style="width:90px">维度</th><th class="txt">要素名称</th><th style="width:120px">数据来源</th><th style="width:190px">覆盖率</th><th style="width:96px">校验</th><th style="width:76px">状态</th><th style="width:150px">操作</th></tr></thead><tbody>'+elRows+'</tbody></table></div>'+
        '</div>'+
      '</div>';
  }
  if(_spCfgTab==='rule'){
    var rf=_spRuleFilter;
    var rules=_spMapRules.filter(function(r){
      if(rf.dim&&r.dim!==rf.dim)return false;
      if(rf.q&&(r.id+r.input+r.out+r.logic).indexOf(rf.q)<0)return false;
      return true;
    });
    var ruleRows=rules.map(function(r){
      return '<tr><td>'+esc(r.id)+'</td><td>'+esc(r.dim)+'</td><td class="txt">'+esc(r.input)+'</td><td style="font-weight:600">'+esc(r.out)+'</td><td style="white-space:normal">'+esc(r.logic)+'</td>'+
        '<td>'+(r.on?badge('已启用','badge-success'):badge('已停用','badge-gray'))+'</td>'+
        '<td style="white-space:nowrap">'+
          '<button class="btn btn-ghost btn-xs" onclick="window._spRuleView(\''+esc(r.id)+'\')">查看</button> '+
          '<button class="btn btn-ghost btn-xs" onclick="window._spRuleEdit(\''+esc(r.id)+'\')">编辑</button> '+
          '<button class="btn btn-ghost btn-xs" onclick="window._spToggleRule(\''+esc(r.id)+'\')">'+(r.on?'停用':'启用')+'</button>'+
        '</td></tr>';
    }).join('');
    if(!ruleRows)ruleRows='<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:24px 0">无匹配规则</td></tr>';
    return '<div class="panel">'+
        '<div class="panel-header"><span>画像维度映射规则<span class="spr-count">'+rules.length+' 条</span></span></div>'+
        '<div class="panel-body">'+
          '<div class="sp-filter-bar">'+
            '<div class="form-group wide"><label>关键字</label><input id="spRuleQ" placeholder="编号 / 输入 / 结论" value="'+esc(rf.q)+'"></div>'+
            '<div class="form-group"><label>维度</label>'+spSel('spRuleDim',rf.dim,SP_DIMS.concat(['指标汇总']),'全部维度','window._spRuleFilterSet()')+'</div>'+
            '<div class="sp-filter-actions"><button class="btn btn-outline" onclick="window._spRuleReset()">重置</button><button class="btn btn-primary" onclick="window._spRuleAdd()">新增规则</button></div>'+
          '</div>'+
          '<div class="sp-table-wrap"><table class="data-table" style="min-width:784px"><thead><tr><th style="width:72px">规则号</th><th style="width:90px">维度</th><th class="txt">输入要素</th><th class="txt">画像结论</th><th class="txt">映射逻辑</th><th style="width:76px">状态</th><th style="width:150px">操作</th></tr></thead><tbody>'+ruleRows+'</tbody></table></div>'+
        '</div>'+
      '</div>';
  }
  if(_spCfgTab==='nlp'){
    var nlpRows=_spNlp.map(function(n){
      var stCol=n.st==='已采纳'?'badge-success':n.st==='已忽略'?'badge-gray':'badge-warning';
      return '<tr><td>'+esc(n.id)+'</td><td>'+esc(n.src)+'</td><td class="txt" style="white-space:normal;color:var(--color-text-muted)">'+esc(n.snippet)+'</td><td class="txt" style="font-weight:600">'+esc(n.el)+' → '+esc(n.val)+'</td>'+
        '<td class="txt"><span style="font-family:var(--font-num);font-weight:700;color:'+(n.conf>=90?'var(--color-success-solid)':'var(--color-caution-solid)')+'">'+n.conf+'%</span></td>'+
        '<td>'+badge(n.st,stCol)+'</td>'+
        '<td style="white-space:nowrap">'+(n.st==='待确认'?
          '<button class="btn btn-ghost btn-xs" onclick="window._spNlpSet(\''+n.id+'\',\'已采纳\')">采纳</button> <button class="btn btn-ghost btn-xs" onclick="window._spNlpSet(\''+n.id+'\',\'已忽略\')">忽略</button>':'—')+'</td></tr>';
    }).join('');
    return '<div class="panel">'+
        '<div class="panel-header"><span>NLP 结构化提取结果<span class="spr-count">待确认 '+_spNlp.filter(function(n){return n.st==='待确认'}).length+' 条</span></span></div>'+
        '<div class="panel-body"><div class="sp-table-wrap"><table class="data-table" style="min-width:784px"><thead><tr><th style="width:74px">编号</th><th style="width:130px">来源</th><th class="txt">原文片段</th><th style="width:200px">提取要素 → 值</th><th style="width:70px">置信度</th><th style="width:76px">状态</th><th style="width:110px">操作</th></tr></thead><tbody>'+nlpRows+'</tbody></table></div></div>'+
      '</div>';
  }

  /* ---- 页签四：版本与归档 ---- */
  if(_spCfgTab==='ver'){
    var verRows=SP_VERSIONS.map(function(v){
      return '<tr><td style="font-weight:700">'+esc(v.v)+(v.cur?' '+badge('当前','badge-success'):'')+'</td><td>'+esc(v.time)+'</td><td>'+esc(v.by)+'</td><td class="txt" style="white-space:normal">'+esc(v.desc)+'</td>'+
        '<td class="ops"><button class="btn btn-ghost btn-xs" onclick="window._spVerView(\''+esc(v.v)+'\')">查看</button></td></tr>';
    }).join('');
    var arcRows=SP_ARCHIVES.map(function(a){
      return '<tr><td>'+esc(a.id)+'</td><td class="txt">'+esc(a.range)+'</td><td>'+a.events+' 例</td><td class="txt" style="white-space:normal">'+esc(a.note)+'</td>'+
        '<td style="white-space:nowrap"><button class="btn btn-ghost btn-xs" onclick="window._spArcView(\''+esc(a.id)+'\')">查看</button> <button class="btn btn-ghost btn-xs" onclick="window._spArcDownload(\''+esc(a.id)+'\')">下载</button></td></tr>';
    }).join('');
    return '<div class="sp-2col">'+
      '<div class="panel"><div class="panel-header"><span>画像版本</span></div><div class="panel-body"><div class="sp-table-wrap"><table class="data-table" style="min-width:620px"><thead><tr><th style="width:110px">版本</th><th style="width:140px">更新时间</th><th style="width:80px">更新人</th><th class="txt">变更摘要</th><th style="width:60px">操作</th></tr></thead><tbody>'+verRows+'</tbody></table></div></div></div>'+
      '<div class="panel"><div class="panel-header"><span>画像归档</span><button class="btn btn-outline btn-sm" onclick="window._spDoArchive()">执行归档</button></div><div class="panel-body"><div class="sp-table-wrap"><table class="data-table" style="min-width:620px"><thead><tr><th style="width:110px">归档编号</th><th class="txt">归档范围</th><th style="width:80px">画像数</th><th class="txt">说明</th><th style="width:120px">操作</th></tr></thead><tbody>'+arcRows+'</tbody></table></div></div></div>'+
    '</div>';
  }
  return '';
}

/* ===================== 八、交互与主入口 ===================== */
function spRefresh(){
  var main=document.getElementById('spMainContent');
  if(main)main.innerHTML=render();
}
window._spSetScope=function(city,site){
  if(city!==null&&city!==undefined)_spScope.city=city;
  if(site!==null&&site!==undefined)_spScope.site=site;
  spRefresh();
};
window._spScopeField=function(field,value){
  if(['city','site','hospital','from','to','cutoff'].indexOf(field)<0)return;
  var next=Object.assign({},_spScope);
  next[field]=field==='cutoff'?(value||spToday()):value;
  if((next.from&&!spDate(next.from))||(next.to&&!spDate(next.to))||!spDate(next.cutoff)||
    next.cutoff>spToday()||(next.from&&next.to&&next.from>next.to)||(next.from&&next.from>next.cutoff)||(next.to&&next.to>next.cutoff)){
    if(typeof toast==='function')toast('确诊日期区间须按时间顺序，且不晚于统计截止日','error');
    spRefresh();return;
  }
  _spScope=next;spRefresh();
};
window._spScopeReset=function(){
  _spScope={city:'',site:'',hospital:'',from:'',to:'',cutoff:spToday()};
  spRefresh();
};
window._spDrillCity=function(city){
  _spScope.city=(_spScope.city===city?'':city);
  spRefresh();
};
window._spMapMetric=function(m){
  _spMapMetricKey=m;spRefresh();
  window._spBindMap();
};
window._spSetOverviewView=function(view){
  if((view!=='table'&&view!=='chart')||view===_spOverviewView)return;
  _spOverviewView=view;
  var body=document.getElementById('spDomainBody');
  if(body){
    body.innerHTML=spDomainPanel(spScopeEvents(_spScope));
    if(view==='chart'){body.setAttribute('role','tabpanel');body.setAttribute('aria-labelledby','spDomainTab-'+_spDomain)}
    else{body.removeAttribute('role');body.removeAttribute('aria-labelledby')}
  }
  var tabs=document.querySelector('#spMainContent .sp-domain-tabs');
  if(tabs)tabs.hidden=view==='table';
  var buttons=document.querySelectorAll('#spMainContent [data-overview-view]');
  for(var i=0;i<buttons.length;i++)buttons[i].setAttribute('aria-pressed',String(buttons[i].dataset.overviewView===view));
};
window._spSetDomain=function(d){
  if(!SP_DOMAINS.some(function(item){return item.key===d}))return;
  _spDomain=d;
  var tabs=document.querySelectorAll('#spMainContent .sp-domain-tab');
  for(var i=0;i<tabs.length;i++){
    var selected=tabs[i].dataset.domain===d;
    tabs[i].classList.toggle('active',selected);tabs[i].setAttribute('aria-pressed',String(selected));
    tabs[i].setAttribute('aria-selected',String(selected));tabs[i].tabIndex=selected?0:-1;
  }
  var body=document.getElementById('spDomainBody');
  if(body&&_spOverviewView==='chart'){
    body.innerHTML=spDomainPanel(spScopeEvents(_spScope));
    body.setAttribute('aria-labelledby','spDomainTab-'+d);
    var tabsBox=document.querySelector('#spMainContent .sp-domain-tabs');
    (tabsBox||body).scrollIntoView({block:'start',behavior:'smooth'});
  }
};
window._spDomainKey=function(event,tab){
  var index=SP_DOMAINS.findIndex(function(d){return d.key===tab.dataset.domain}),next;
  if(event.key==='ArrowRight')next=(index+1)%SP_DOMAINS.length;
  else if(event.key==='ArrowLeft')next=(index-1+SP_DOMAINS.length)%SP_DOMAINS.length;
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=SP_DOMAINS.length-1;
  else return;
  event.preventDefault();window._spSetDomain(SP_DOMAINS[next].key);
  document.getElementById('spDomainTab-'+SP_DOMAINS[next].key).focus({preventScroll:true});
};
window._spGoIssue=function(domain,city,site){
  if(city)_spScope.city=city;
  if(site)_spScope.site=site;
  spRefresh();
  window._spSetDomain(domain);
};
/* 群体 → 明细闭环：带当前地市/瘤种筛选条件跳回板块01患者列表 */
window._spGpToPatients=function(){
  _wbDetail=null;
  _wbFilters={q:'',site:_spScope.site,city:_spScope.city,hospital:'',fu:''};
  _wbOverviewSelection={scope:Object.assign({},_spScope),ids:spScopeEvents(_spScope).map(function(e){return e.id}),label:spScopeLabel()};
  if(typeof navigateTo==='function')navigateTo('sp-patients');
  else{_spSub='workbench';spRefresh();}
};
window._spMetricPatients=function(id){
  var list=spScopeEvents(_spScope),agg=spAgg(list),m=agg.metrics[id];
  if(!m||m.value===null)return;
  var matches=list.filter(function(e){return m.ids.indexOf(e.id)>=0});
  var rows=spPersons(matches);
  var body='<div class="sp-overview-context"><span>'+esc(m.name)+' · '+esc(spMetricEvidence(m))+'</span><span>对应 '+rows.length+' 人</span></div>'+
    '<div class="sp-table-wrap"><table class="data-table sp-overview-table"><thead><tr><th>患者</th><th>瘤种</th><th>确诊日期</th><th>生存状态</th><th>画像</th></tr></thead><tbody>'+
    (rows.length?rows.map(function(e){return '<tr><td>'+esc(e.patient)+'</td><td>'+esc(e.site)+'</td><td>'+esc(spDiagnosisDate(e)||'不详')+'</td><td>'+esc(spVital(e))+
      '</td><td><button class="btn btn-ghost btn-xs" onclick="window._spGoPatient(\''+esc(e.id)+'\')">查看</button></td></tr>'}).join(''):
      '<tr><td colspan="5" class="sp-table-empty">无对应患者</td></tr>')+'</tbody></table></div>';
  spModal(m.name,body,'<button class="btn btn-ghost" data-sp-close>关闭</button>');
};
window._spWbQuery=function(){
  var g=function(id){var el=document.getElementById(id);return el?String(el.value||'').trim():''};
  _wbFilters={q:g('spWbQ'),site:g('spWbSite'),city:g('spWbCity'),hospital:g('spWbHospital'),fu:g('spWbFu'),mp:g('spWbMp')};
  spRefresh();
};
window._spWbReset=function(){
  _wbOverviewSelection=null;_wbFilters={q:'',site:'',city:'',hospital:'',fu:'',mp:''};spRefresh();
};
window._spOpenDetail=function(id){
  _wbDetail=id;spRefresh();
  var sc=document.getElementById('spMainContent');
  if(sc&&sc.scrollIntoView)sc.scrollIntoView({block:'start'});
};
window._spBackList=function(){
  _wbDetail=null;spRefresh();
};
/* 多原发瘤例切换：只换当前查看的瘤例 id，页内上下文（总览队列/筛选）保持不变 */
window._spSwitchTumor=function(id){
  if(!id||id===_wbDetail)return;
  var src=_wbOverviewSelection?spScopeEvents(_wbOverviewSelection.scope):spUnique(tumorEvents,spTumorKey);
  var cur=src.filter(function(x){return x.id===_wbDetail})[0];
  var next=tumorEvents.filter(function(x){return x.id===id})[0];
  if(!cur||!next||spPatientKey(cur)!==spPatientKey(next))return;
  _wbDetail=id;spRefresh();
  var sc=document.getElementById('spMainContent');
  if(sc&&sc.scrollIntoView)sc.scrollIntoView({block:'start'});
};
function spModal(title,bodyHtml,foot){
  var mask=document.createElement('div');
  mask.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:1200;padding:24px';
  var box=document.createElement('div');
  box.style.cssText='background:var(--surface);border-radius:12px;width:min(720px,100%);max-height:86vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(15,23,42,.3)';
  box.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--color-border)"><div style="font-size:16px;font-weight:700;color:var(--color-text-title)">'+esc(title)+'</div><button style="width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:var(--color-text-muted);cursor:pointer;font-size:20px">×</button></div>'+
    '<div style="padding:16px 18px;overflow:auto">'+bodyHtml+'</div>'+
    (foot?'<div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--color-border)">'+foot+'</div>':'');
  mask.appendChild(box);
  mask.addEventListener('click',function(e){if(e.target===mask)mask.remove()});
  box.querySelector('button').addEventListener('click',function(){mask.remove()});
  box.querySelectorAll('[data-sp-close]').forEach(function(btn){btn.addEventListener('click',function(){mask.remove()})});
  (document.getElementById('pageContainer')||document.body).appendChild(mask);
  return mask;
}
window._spCfgTabSwitch=function(t){
  _spCfgTab=t;spRefresh();
};
/* ---- 要素 CRUD ---- */
window._spMetaFilterSet=function(){
  var g=function(id){var el=document.getElementById(id);return el?String(el.value||'').trim():''};
  _spMetaFilter={q:g('spMetaQ'),dim:g('spMetaDim')};spRefresh();
};
window._spMetaReset=function(){_spMetaFilter={q:'',dim:''};spRefresh();};
window._spElemToggle=function(id){
  var el=_spElements.filter(function(x){return x.id===id})[0];if(!el)return;
  el.on=!el.on;spRefresh();toast('要素 '+id+' 已'+(el.on?'启用':'停用'));
};
function spElemFormBody(el){
  var dimOpts=SP_DIMS.map(function(d){return '<option'+(el&&el.dim===d?' selected':'')+'>'+esc(d)+'</option>'}).join('');
  var srcOpts=SP_SOURCES.map(function(s){return '<option'+(el&&el.src===s?' selected':'')+'>'+esc(s)+'</option>'}).join('');
  var fOpts=SP_ELEM_FIELD_MAP.map(function(f){return '<option value="'+f.key+'"'+(el&&el.fkey===f.key?' selected':'')+'>'+esc(f.name)+'</option>'}).join('');
  return '<div class="sp-form-grid">'+
    '<div class="sp-form-row"><label>维度</label><select id="spf_dim">'+dimOpts+'</select></div>'+
    '<div class="sp-form-row"><label>要素名称</label><input id="spf_name" placeholder="如：治疗不良反应" value="'+(el?esc(el.name):'')+'"></div>'+
    '<div class="sp-form-row"><label>数据来源</label><select id="spf_src">'+srcOpts+'</select></div>'+
    '<div class="sp-form-row"><label>覆盖判定</label><select id="spf_fkey">'+fOpts+'</select></div>'+
  '</div>';
}
window._spElemAdd=function(){
  spModal('新增画像要素',spElemFormBody(null),
    '<button class="btn btn-ghost" data-sp-close>取消</button><button class="btn btn-primary" onclick="window._spElemSave()">保存</button>');
};
window._spElemEdit=function(id){
  var el=_spElements.filter(function(x){return x.id===id})[0];if(!el)return;
  spModal('编辑画像要素 · '+id,spElemFormBody(el),
    '<button class="btn btn-ghost" data-sp-close>取消</button><button class="btn btn-primary" onclick="window._spElemSave(\''+id+'\')">保存</button>');
};
window._spElemSave=function(id){
  var g=function(x){var el=document.getElementById(x);return el?String(el.value||'').trim():''};
  var name=g('spf_name');
  if(!name){toast('请填写要素名称');return;}
  var rec={dim:g('spf_dim'),name:name,src:g('spf_src'),fkey:g('spf_fkey'),on:true};
  if(id){
    var el=_spElements.filter(function(x){return x.id===id})[0];
    if(el){el.dim=rec.dim;el.name=rec.name;el.src=rec.src;el.fkey=rec.fkey;}
    toast('要素 '+id+' 已更新');
  }else{
    var n=1;_spElements.forEach(function(x){var m=/\d+$/.exec(x.id);if(m)n=Math.max(n,parseInt(m[0],10)+1)});
    var nid='PE'+String(n).padStart(2,'0');
    _spElements.push({id:nid,dim:rec.dim,name:rec.name,src:rec.src,fkey:rec.fkey,on:true});
    toast('新增要素 '+nid+' 成功');
  }
  document.querySelectorAll('[data-sp-close]').forEach(function(b){b.click()});
  spRefresh();
};
window._spElemView=function(id){
  var el=_spElements.filter(function(x){return x.id===id})[0];if(!el)return;
  var fn=spFieldFn(el.fkey);
  var ok=tumorEvents.filter(fn),miss=tumorEvents.filter(function(e){return !fn(e)});
  var cov=Math.round(ok.length/tumorEvents.length*100);
  var body='<div class="sp-kv-grid" style="grid-template-columns:repeat(2,1fr)">'+
    spKv('编号',el.id)+spKv('维度',el.dim)+spKv('数据来源',el.src)+spKv('覆盖判定',el.name)+
    spKv('覆盖率',cov+'%（'+ok.length+'/'+tumorEvents.length+'）')+spKv('状态',el.on?'已启用':'已停用')+
    '</div>'+
    '<div style="margin-top:14px"><div style="font-weight:700;margin-bottom:8px">缺失该要素的患者（'+miss.length+' 例）</div>'+
    (miss.length?'<div class="sp-table-wrap"><table class="data-table" style="min-width:620px"><thead><tr><th class="txt">姓名</th><th class="txt">医院</th><th class="txt">地区</th><th class="ops">操作</th></tr></thead><tbody>'+
      miss.map(function(e){return '<tr><td class="txt">'+esc(e.patient)+'</td><td class="txt">'+esc(e.hospital)+'</td><td class="txt">'+esc(e.city)+'</td><td class="ops"><button class="btn btn-ghost btn-xs" onclick="window._spGoPatient(\''+e.id+'\')">打开画像</button></td></tr>'}).join('')+
      '</tbody></table></div>':'<div style="color:var(--color-success-fg);font-size:13px">全部患者均已覆盖</div>')+'</div>';
  spModal('画像要素明细 · '+el.id,body,'<button class="btn btn-ghost" data-sp-close>关闭</button>');
};
/* ---- 映射规则 CRUD ---- */
window._spRuleFilterSet=function(){
  var g=function(id){var el=document.getElementById(id);return el?String(el.value||'').trim():''};
  _spRuleFilter={q:g('spRuleQ'),dim:g('spRuleDim')};spRefresh();
};
window._spRuleReset=function(){_spRuleFilter={q:'',dim:''};spRefresh();};
window._spToggleRule=function(id){
  var r=_spMapRules.filter(function(x){return x.id===id})[0];if(!r)return;
  r.on=!r.on;spRefresh();toast('映射规则 '+id+' 已'+(r.on?'启用':'停用'));
};
function spRuleFormBody(r){
  var dimOpts=SP_DIMS.concat(['指标汇总']).map(function(d){return '<option'+(r&&r.dim===d?' selected':'')+'>'+esc(d)+'</option>'}).join('');
  var logics=SP_RULE_TEMPLATES.slice();
  if(r&&logics.indexOf(r.logic)<0)logics.push(r.logic);
  var lOpts=logics.map(function(t){return '<option'+(r&&r.logic===t?' selected':'')+'>'+esc(t)+'</option>'}).join('');
  return '<div class="sp-form-grid">'+
    '<div class="sp-form-row"><label>维度</label><select id="spf_rdim">'+dimOpts+'</select></div>'+
    '<div class="sp-form-row"><label>映射逻辑</label><select id="spf_rlogic">'+lOpts+'</select></div>'+
    '<div class="sp-form-row"><label>输入要素</label><input id="spf_rin" placeholder="如：TNM + 临床分期" value="'+(r?esc(r.input):'')+'"></div>'+
    '<div class="sp-form-row"><label>画像结论</label><input id="spf_rout" placeholder="如：早期/晚期分层" value="'+(r?esc(r.out):'')+'"></div>'+
  '</div>';
}
window._spRuleAdd=function(){
  spModal('新增映射规则',spRuleFormBody(null),
    '<button class="btn btn-ghost" data-sp-close>取消</button><button class="btn btn-primary" onclick="window._spRuleSave()">保存</button>');
};
window._spRuleEdit=function(id){
  var r=_spMapRules.filter(function(x){return x.id===id})[0];if(!r)return;
  spModal('编辑映射规则 · '+id,spRuleFormBody(r),
    '<button class="btn btn-ghost" data-sp-close>取消</button><button class="btn btn-primary" onclick="window._spRuleSave(\''+id+'\')">保存</button>');
};
window._spRuleSave=function(id){
  var g=function(x){var el=document.getElementById(x);return el?String(el.value||'').trim():''};
  var input=g('spf_rin'),out=g('spf_rout');
  if(!input||!out){toast('请填写输入要素与画像结论');return;}
  if(id){
    var r=_spMapRules.filter(function(x){return x.id===id})[0];
    if(r){r.dim=g('spf_rdim');r.input=input;r.out=out;r.logic=g('spf_rlogic');}
    toast('规则 '+id+' 已更新');
  }else{
    var n=1;_spMapRules.forEach(function(x){var m=/\d+$/.exec(x.id);if(m)n=Math.max(n,parseInt(m[0],10)+1)});
    var nid='MR'+String(n).padStart(2,'0');
    _spMapRules.push({id:nid,dim:g('spf_rdim'),input:input,out:out,logic:g('spf_rlogic'),on:true});
    toast('新增规则 '+nid+' 成功');
  }
  document.querySelectorAll('[data-sp-close]').forEach(function(b){b.click()});
  spRefresh();
};
window._spRuleView=function(id){
  var r=_spMapRules.filter(function(x){return x.id===id})[0];if(!r)return;
  var body='<div class="sp-kv-grid" style="grid-template-columns:1fr">'+
    spKv('规则号',r.id)+spKv('维度',r.dim)+spKv('输入要素',r.input)+spKv('画像结论',r.out)+spKv('映射逻辑',r.logic)+spKv('状态',r.on?'已启用':'已停用')+
    '</div>';
  spModal('映射规则明细 · '+r.id,body,'<button class="btn btn-ghost" data-sp-close>关闭</button>');
};
/* ---- NLP 提取 ---- */
window._spNlpSet=function(id,st){
  var n=_spNlp.filter(function(x){return x.id===id})[0];if(!n)return;
  n.st=st;spRefresh();toast('提取结果 '+id+' 已'+st);
};
/* ---- 校验与报告 ---- */
window._spCheckView=function(id){
  var c=SP_CHECKS.filter(function(x){return x.id===id})[0];if(!c)return;
  var res=c.run();
  var body='<div class="sp-kv-grid" style="grid-template-columns:repeat(2,1fr)">'+
    spKv('校验项',c.name)+spKv('执行时间',_spCheckTime)+spKv('异常数',res.bad.length+' 例')+spKv('结论',res.detail)+
    '</div>'+
    (res.bad.length?'<div style="margin-top:14px"><div style="font-weight:700;margin-bottom:8px">异常患者</div>'+
      '<div class="sp-table-wrap"><table class="data-table" style="min-width:620px"><thead><tr><th class="txt">姓名</th><th class="txt">医院</th><th class="txt">地区</th><th class="ops">操作</th></tr></thead><tbody>'+
      res.bad.map(function(e){return '<tr><td class="txt">'+esc(e.patient)+'</td><td class="txt">'+esc(e.hospital)+'</td><td class="txt">'+esc(e.city)+'</td><td class="ops"><button class="btn btn-ghost btn-xs" onclick="window._spGoPatient(\''+e.id+'\')">打开画像</button></td></tr>'}).join('')+
      '</tbody></table></div>':'');
  spModal('校验明细 · '+id+' '+c.name,body,'<button class="btn btn-ghost" data-sp-close>关闭</button>');
};
window._spGoPatient=function(pid){
  document.querySelectorAll('[data-sp-close]').forEach(function(b){b.click()});
  _wbDetail=pid;
  if(_spSub==='overview'){
    var selected=spScopeEvents(_spScope);
    _wbOverviewSelection={scope:Object.assign({},_spScope),ids:selected.map(function(e){return e.id}),label:spScopeLabel()};
  }else if(_spSub==='config')_wbOverviewSelection=null;
  if(typeof navigateTo==='function')navigateTo('sp-patients');
  else{_spSub='workbench';spRefresh();}
};
window.SpecialtyRiskSource={
  list:function(){return tumorEvents.map(function(e){return {
    id:e.id,patient:e.patient,site:e.site,hospital:e.hospital,region:e.region||e.city,
    screenResult:e.screenResult,followStatus:e.followStatus,lastFu:e.lastFu,dead:e.vitalStatus==='死亡'
  }})},
  open:function(id){if(!tumorEvents.some(function(e){return e.id===id}))return false;window._spGoPatient(id);return true}
};
function spDownload(name,text){
  var blob=new Blob(['\ufeff'+text],{type:'text/plain;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href)},4000);
}
/* ---- 指标明细表导出 ---- */
function spCsvCell(v){
  v=String(v==null?'':v);
  return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
}
window._spExportMetricsCSV=function(){
  var rows=spMetricsFlatRows();
  var csv=rows.map(function(r){return r.map(spCsvCell).join(',')}).join('\r\n');
  var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  var scope=spScopeLabel().replace(/\s·\s/g,'_').replace(/\s+/g,'');
  a.download='画像指标明细_'+scope+'_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href)},4000);
  if(typeof toast==='function')toast('指标明细 CSV 已导出（当前范围：'+spScopeLabel()+'）');
};
window._spCopyMetrics=function(){
  var rows=spMetricsFlatRows();
  /* Tab 分隔，便于直接粘进 Excel */
  var tsv=rows.map(function(r){return r.join('\t')}).join('\n');
  function done(){if(typeof toast==='function')toast('指标明细已复制到剪贴板，可直接粘贴到 Excel');}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(tsv).then(done,function(){spCopyFallback(tsv);done();});
  }else{spCopyFallback(tsv);done();}
};
function spCopyFallback(text){
  var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.left='-9999px';
  document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(e){}document.body.removeChild(ta);
}
/* ---- 版本与归档 ---- */
window._spVerView=function(v){
  var ver=SP_VERSIONS.filter(function(x){return x.v===v})[0];if(!ver)return;
  var body='<div class="sp-kv-grid" style="grid-template-columns:repeat(2,1fr)">'+
    spKv('版本号',ver.v)+spKv('更新时间',ver.time)+spKv('更新人',ver.by)+spKv('变更摘要',ver.desc)+
    '</div>'+
    '<div style="margin-top:14px"><div style="font-weight:700;margin-bottom:8px">变更明细</div><ul style="margin:0;padding-left:20px">'+
    (ver.changes||[]).map(function(c){return '<li style="font-size:13px;color:var(--color-text-body);padding:3px 0">'+esc(c)+'</li>'}).join('')+'</ul></div>';
  spModal('画像版本 · '+ver.v,body,'<button class="btn btn-ghost" data-sp-close>关闭</button>');
};
window._spArcView=function(id){
  var a=SP_ARCHIVES.filter(function(x){return x.id===id})[0];if(!a)return;
  var s=a.stats||{};
  var body='<div class="sp-kv-grid" style="grid-template-columns:repeat(2,1fr)">'+
    spKv('归档编号',a.id)+spKv('归档范围',a.range)+spKv('画像数',a.events+' 例')+spKv('说明',a.note)+
    spKv('覆盖地市',(s.cities||11)+' 个')+spKv('覆盖病种',(s.sites||7)+' 种')+
    spKv('随访覆盖率',(s.fuRate!=null?s.fuRate+'%':'—'))+spKv('早期占比',(s.earlyRate!=null?s.earlyRate+'%':'—'))+
    spKv('归档质量分',(s.score!=null?s.score+'%':'—'))+
    '</div>';
  spModal('画像归档 · '+a.id,body,'<button class="btn btn-ghost" data-sp-close>关闭</button><button class="btn btn-primary" onclick="window._spArcDownload(\''+id+'\')">下载归档包</button>');
};
window._spArcDownload=function(id){
  var a=SP_ARCHIVES.filter(function(x){return x.id===id})[0];if(!a)return;
  var s=a.stats||{};
  spDownload(id+'.txt','江西省肿瘤专科画像归档\n归档编号：'+a.id+'\n归档范围：'+a.range+'\n画像数：'+a.events+' 例\n覆盖地市：'+(s.cities||11)+' 个\n覆盖病种：'+(s.sites||7)+' 种\n随访覆盖率：'+(s.fuRate!=null?s.fuRate+'%':'—')+'\n早期占比：'+(s.earlyRate!=null?s.earlyRate+'%':'—')+'\n归档质量分：'+(s.score!=null?s.score+'%':'—')+'\n—— 江西省肿瘤防治中心');
  toast('归档包 '+id+' 已下载');
};
window._spDoArchive=function(){
  var scopeSel='<select id="spf_arcScope"><option>全省 · 2026-09</option><option>南昌市</option><option>赣州市</option><option>九江市</option></select>';
  spModal('执行画像归档','<div class="sp-form-grid"><div class="sp-form-row"><label>归档范围</label>'+scopeSel+'</div></div><div style="margin-top:10px;font-size:13px;color:var(--color-text-muted)">归档将按当前数据实时计算统计量并封存快照。</div>',
    '<button class="btn btn-ghost" data-sp-close>取消</button><button class="btn btn-primary" onclick="window._spArchiveConfirm()">确认归档</button>');
};
window._spArchiveConfirm=function(){
  var el=document.getElementById('spf_arcScope');
  var scope=el?el.value:'全省 · 2026-09';
  var list=scope.indexOf('全省')>=0?tumorEvents:tumorEvents.filter(function(e){return e.city===scope});
  var a=spAgg(list);
  var ym='2026-09';
  SP_ARCHIVES.unshift({id:'AR-'+ym+'-'+scope.slice(0,2),range:scope+' 实时归档',events:a.total,note:'刚刚执行 · 实时画像封存',stats:{cities:scope.indexOf('全省')>=0?11:1,sites:7,fuRate:a.fuRate,earlyRate:a.earlyRate,score:Math.round((a.fuRate*0.4+a.earlyRate*0.3+95*0.3)*10)/10}});
  document.querySelectorAll('[data-sp-close]').forEach(function(b){b.click()});
  spRefresh();
  toast('画像归档完成：共 '+SP_ARCHIVES.length+' 份归档快照');
};

/* ---- 主入口：app.html 传入 sub = workbench / overview / config ---- */
var _spSub='workbench';
function render(sub){
  if(sub)_spSub=sub;
  window._spBindMap();
  var content='';
  if(_spSub==='workbench')content=renderWorkbench();
  else if(_spSub==='overview')content=renderOverview();
  else if(_spSub==='config')content=renderConfig();
  return '<div style="padding:0"><div id="spMainContent">'+content+'</div></div>';
}
window.renderSpecialtyPortrait=render;
/* 调试导出：仅供本地回归测试读取内部状态，不影响业务逻辑 */
if(window.__SP_TEST__){window.__SP_TEST__={SP_PROFILE_SECTIONS:function(){return SP_PROFILE_SECTIONS},tumorEvents:function(){return tumorEvents},spDetailPage:function(e){return spDetailPage(e)},spProfileCompleteness:function(e){return spProfileCompleteness(e)},spDiagBasisType:function(e){return spDiagBasisType(e)},spGradeText:function(e){return spGradeText(e)},_spElements:function(){return _spElements},SP_ELEM_CHECK:function(){return SP_ELEM_CHECK},SP_ELEM_FIELD_MAP:function(){return SP_ELEM_FIELD_MAP},spFieldFn:function(k){return spFieldFn(k)},spCheck:function(id){return spCheck(id)},spKpiJudge:function(id,m){return spKpiJudge(id,m)},SP_METRIC_KPI:function(){return SP_METRIC_KPI},spStage:function(e){return spStage(e)},spAgg:function(l){return spAgg(l)},spScopeEvents:function(){return spScopeEvents({})},spMetricsFlatRows:function(){return spMetricsFlatRows()},spDomainPanel:function(d,view){_spDomain=d;if(view==='table'||view==='chart')_spOverviewView=view;return spDomainPanel(spScopeEvents(_spScope))},SP_PORTRAIT_FIELDS:function(){return SP_PORTRAIT_FIELDS},SP_METRIC_FIELD:function(){return SP_METRIC_FIELD},SP_GAP_FIELDS:function(){return SP_GAP_FIELDS},spModeFlags:function(e){return spModeFlags(e)},spOtherModes:function(e){return spOtherModes(e)},spInstitutionChanges:spInstitutionChanges,spReferralState:spReferralState,spRefTable:spRefTable,spTimeline:spTimeline,spPatientKey:spPatientKey,spProfileFields:function(){return SP_PROFILE_FIELDS},spProfileRead:spProfileRead,spFieldSummary:spFieldSummary,spFirstTreat:spFirstTreat,spModeState:spModeState,spCostContext:spCostContext};}
})();
