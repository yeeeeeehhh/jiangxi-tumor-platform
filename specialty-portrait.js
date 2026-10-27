/* 肿瘤专科画像 V8 — 患者画像 / 指标汇总 / 配置质控 三层架构
   01 患者专科画像：四维画像（患者基础/肿瘤特征/诊疗过程/随访与结局）+ 画像时间线
      患者基础：脱敏主索引、出生日期（年龄由系统推导，不双写）、性别、医保类型、区县+机构层级
      肿瘤特征：原发部位 ICD-10、形态学 ICD-O-3、诊断依据、临床分期+分期确认日期、
                分子标志物（项目名+结果+检测日期三要素，缺一不可）
      诊疗过程：MDT、首次治疗日期、是否发生转诊、治疗方式（手术/放疗/化疗）
      随访与结局：末次随访日期、生存状态、疾病状态（RECIST+评价日期）、
                  ECOG+评估日期、死亡日期/原因
      派生规则：ICD-O-3 部位码/形态学码由部位与病理文本自动映射，ICD-10 取部位码主码；
               出生日期由身份证号 7–14 位推导；治疗线数由"方案+起止日期"记录推算；
               生存时间由确诊日期与死亡/末次随访日期自动推算。以上均不额外采集。
      注：被移出画像的字段（既往史、吸烟饮酒、家族史、分化程度、多原发、
          住院次数天数费用、TNM 独立项等）数据仍保留在患者记录中，
          供患者列表与指标汇总页使用；详见版本 V8.0 变更记录。
   02 患者群体总览：范围筛选 → 事实摘要 → 八项核心概况 → 五组分析与指标明细
      按患者/瘤例分别去重，比例提供有效分母、不详及不适用，历史状态需日期或快照证据。
      五组：人群与病情构成 / 发现与诊断 / 诊疗过程 / 随访与结局 / 就医与可及性。
      记录占比不替代正式质量、生存或筛查成效指标；费用未接入时不生成估算值。
      总览、CSV与患者下钻使用同一纳入范围及统计结果。
      患者列表列：患者/性别/年龄/户籍地市/就诊医院/瘤种/部位/病理/分期/随访状态
      列表筛选：关键字 / 瘤种 / 分期 / 地市 / 医院 / 随访状态（条件为「与」关系）
   03 画像配置：要素元数据 / 映射规则 / 智能校验 / 质控报告 / 预警 / 版本 / 归档
   当前使用内置样例记录，不代表已经接入生产数据 */
(function(){ 'use strict';
var SP_BUILD='V13.0-overview-statistics@20261025a';
if(typeof console!=='undefined')console.log('[specialty-portrait] '+SP_BUILD+' loaded');

/* ===================== 样式 ===================== */
var spStyle=document.createElement('style');
spStyle.textContent=`
.sp-filter-bar{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;padding:14px;background:var(--color-bg-subtle);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:14px}
.sp-filter-bar .form-group{width:170px}
.sp-filter-bar .form-group.wide{width:240px}
.sp-filter-actions{margin-left:auto;display:flex;gap:8px}
.sp-table-wrap{overflow-x:auto}
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
.sp-patient-strip{display:grid;grid-template-columns:auto minmax(240px,1fr);align-items:center;gap:14px;padding:12px 16px;margin-bottom:14px;background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:var(--shadow-xs)}
.sp-patient-avatar{width:42px;height:42px;border-radius:50%;background:var(--color-primary-soft);color:var(--color-primary);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700}
.sp-patient-name{display:flex;align-items:baseline;gap:10px;min-width:0;font-size:var(--fs-h2);font-weight:700;color:var(--color-text-title);flex-wrap:wrap}
.sp-patient-meta{font-size:var(--fs-xs);font-weight:500;color:var(--color-text-muted);white-space:nowrap}
.sp-profile-blocks{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:16px}
.sp-profile-block{background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:var(--shadow-xs);min-width:0}
.sp-block-head{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--color-border);flex-wrap:wrap}
.sp-block-idx{width:22px;height:22px;border-radius:6px;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex:0 0 22px}
.sp-block-title{font-size:var(--fs-body);font-weight:700;color:var(--color-text-title)}
.sp-block-body{padding:12px 14px}
/* 多原发瘤例切换键：位于「肿瘤特征」块头右侧，分段按钮形态，选中项当前瘤例高亮 */
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
@media(max-width:900px){.sp-2col{grid-template-columns:1fr}.sp-3col{grid-template-columns:1fr}.sp-profile-blocks{grid-template-columns:1fr}.sp-patient-strip{grid-template-columns:auto 1fr}}
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
{id:'TE001',patient:'陈建国',sex:'男',age:63,idNo:'360102196305121234',region:'南昌市东湖区',city:'南昌市',insurance:'职工医保',firstHosp:'东湖区董家窑街道社区卫生服务中心',firstDate:'2026-01-18',hospital:'南昌市第一医院',
 site:'肺',laterality:'右肺上叶',path:'腺癌',grade:'中分化',tNm:'cT2aN2M0',stage:'III期',stageDate:'2026-01-28',multiPrimary:true,tumorSeq:1,
 treatMode:['手术','化疗'],mdt:true,
 symptom:'偶有干咳',pain:'轻度疼痛',nutrition:'中度营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'I度骨髓抑制',rehab:'康复中',supportive:'营养支持',
 lastFu:'2026-08-25',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'高血压 8 年、2 型糖尿病 5 年',smoke:'吸烟 30 年，20 支/日（未戒）',drink:'偶饮酒',family:'父亲患肺癌',diagBasis:'胸部 CT 增强 + 经皮肺穿刺病理 + 免疫组化',diagDate:'2026-02-02',tConfirm:'2026-02-02',metastasis:'区域淋巴结转移',treatMode:['手术','化疗'],referral:true,curPhase:'辅助化疗中',phaseTimeline:'手术(2026-02-05)→辅助化疗中(第3/6周期)',tFirst:'2026-01-18',tTreat:'2026-02-05',admCount:5,admDays:26,marker:'EGFR 19del 阳性；TTF-1(+)；PD-L1 TPS 35%',recurrence:false,recist:'SD',screenType:"低剂量螺旋 CT 肺癌筛查",screenDate:"2025-11-20",screenResult:"右肺上叶结节 8mm",screenAdvice:"建议年度复查 CT，必要时穿刺活检",treatments:[{"mode":"手术","date":"2026-02-05","end":"2026-02-12","plan":"右肺上叶切除术 + 系统性淋巴结清扫","note":"术后病理 pT2aN2M0"},{"mode":"化疗","start":"2026-03-01","end":"2026-06-20","plan":"培美曲塞 + 顺铂（辅助化疗 4 周期）","note":"末次给药 2026-06-20，第 3/6 周期随访中"}],markerDate:'2026-02-02',recistDate:'2026-08-20',ecogDate:'2026-08-20',metaProgress:'无',diseaseProgress:false},
/* 同一患者（陈建国）第二原发：异时性多原发，由「肿瘤特征」块内切换键切换查看 */
{id:'TE001B',patient:'陈建国',sex:'男',age:64,idNo:'360102196305121234',region:'南昌市东湖区',city:'南昌市',insurance:'职工医保',firstHosp:'东湖区董家窑街道社区卫生服务中心',firstDate:'2026-09-10',hospital:'江西省肿瘤医院',
 site:'结直肠',laterality:'升结肠',path:'腺癌',grade:'中分化',tNm:'pT2N0M0',stage:'I期',stageDate:'2026-09-18',multiPrimary:true,tumorSeq:2,tumorPattern:'异时性',
 treatMode:['手术'],mdt:true,
 symptom:'便潜血阳性，偶有腹胀',pain:'无痛',nutrition:'轻度营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-10-20',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'高血压 8 年、2 型糖尿病 5 年、原发性肺癌（2026 年）',smoke:'吸烟 30 年，20 支/日（未戒）',drink:'偶饮酒',family:'父亲患肺癌、哥哥患结肠癌',diagBasis:'结肠镜 + 活检病理 + 术后病理',diagDate:'2026-09-15',tConfirm:'2026-09-15',metastasis:'无远处转移',referral:false,curPhase:'术后随访中',phaseTimeline:'肠镜发现(2026-09-10)→手术(2026-09-22)→术后随访中',tFirst:'2026-09-10',tTreat:'2026-09-22',admCount:2,admDays:11,marker:'MSI-H（dMMR）；RAS/BRAF 野生型；MLH1/PMS2 缺失',recurrence:false,recist:'CR',screenType:"结肠镜（肺癌随访期间机会性筛查）",screenDate:"2026-09-10",screenResult:"升结肠 3.0cm 隆起型占位",screenAdvice:"建议活检明确病理并手术切除",treatments:[{"mode":"手术","date":"2026-09-22","end":"2026-09-29","plan":"腹腔镜右半结肠切除术 + D3 淋巴结清扫","note":"术后病理 pT2N0M0，MSI-H"}],markerDate:'2026-09-15',recistDate:'2026-10-20',ecogDate:'2026-10-20',metaProgress:'无',diseaseProgress:false},
{id:'TE002',patient:'刘雅琴',sex:'女',age:47,idNo:'360702197808152345',region:'赣州市章贡区',city:'赣州市',insurance:'职工医保',firstHosp:'章贡区南外街道社区卫生服务中心',firstDate:'2026-03-20',hospital:'江西省肿瘤医院',
 site:'乳腺',laterality:'左乳',path:'浸润性导管癌',grade:'II级',tNm:'cT2N1M0',stage:'II期',stageDate:'2026-03-27',multiPrimary:false,
 treatMode:['手术','化疗','内分泌'],mdt:true,
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-08-24',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'甲状腺功能减退 3 年',smoke:'不吸烟',drink:'不饮酒',family:'母亲患乳腺癌',diagBasis:'乳腺钼靶 + 彩超 + 空芯针穿刺病理 + 免疫组化',diagDate:'2026-03-27',tConfirm:'2026-03-27',metastasis:'同侧腋窝淋巴结转移',treatMode:['手术','化疗','内分泌'],referral:true,curPhase:'内分泌维持中',phaseTimeline:'手术(2026-04-08)→化疗完成(2026-08-24)→内分泌维持中',tFirst:'2026-03-20',tTreat:'2026-04-08',admCount:8,admDays:23,marker:'ER 80%(+)；PR 60%(+)；HER2 2+ FISH 阴性；Ki-67 15%；Luminal B 型',recurrence:false,recist:'CR',screenType:"两癌筛查（乳腺钼靶 + 超声）",screenDate:"2026-03-18",screenResult:"左乳结节伴簇状钙化，BI-RADS 5",screenAdvice:"建议空芯针穿刺活检",treatments:[{"mode":"手术","date":"2026-04-08","end":"2026-04-15","plan":"左乳癌改良根治术 + 前哨淋巴结活检","note":"术后病理浸润性导管癌 II 级"},{"mode":"化疗","start":"2026-04-28","end":"2026-08-24","plan":"AC-T 方案（表柔比星+环磷酰胺序贯多西他赛）","note":"化疗已结束"},{"mode":"内分泌","start":"2026-08-24","end":"","plan":"他莫昔芬（内分泌维持）","note":"Luminal B 型，维持治疗中"}],markerDate:'2026-03-27',recistDate:'2026-08-24',ecogDate:'2026-08-24',metaProgress:'无',diseaseProgress:false},
{id:'TE003',patient:'赵德顺',sex:'男',age:74,idNo:'360402195502283456',region:'九江市浔阳区',city:'九江市',insurance:'城乡居民',firstHosp:'浔阳区甘棠街道卫生院',firstDate:'2026-07-08',hospital:'九江市第一人民医院',
 site:'胃',laterality:'胃窦',path:'低分化腺癌',grade:'低分化',tNm:'cT4aN2M1',stage:'IV期',stageDate:'2026-07-10',multiPrimary:false,
 treatMode:['化疗'],mdt:true,
 symptom:'上腹隐痛',pain:'中度疼痛',nutrition:'高度营养风险',physical:'ECOG 2',complication:'不全肠梗阻',ae:'II度骨髓抑制',rehab:'支持治疗为主',supportive:'肠外营养+安宁疗护',
 lastFu:'2026-08-26',followStatus:'随访中',vitalStatus:'存活（带瘤）',deathCause:'',lostFollow:false,pastHistory:'慢性萎缩性胃炎 10 年、幽门螺杆菌感染史',smoke:'吸烟 45 年，15 支/日（未戒）',drink:'饮白酒 30 年',family:'无肿瘤家族史',diagBasis:'胃镜 + 活检病理 + 全腹 CT 增强分期',diagDate:'2026-07-10',tConfirm:'2026-07-10',metastasis:'腹膜转移',treatMode:['化疗'],referral:true,curPhase:'姑息治疗中',phaseTimeline:'MDT评估(2026-07-12)→姑息一线化疗中(第3/6周期)',tFirst:'2026-07-08',tTreat:'2026-07-12',admCount:4,admDays:31,marker:'HER2 阴性；MSI-H（dMMR）；PD-L1 CPS 10',recurrence:false,recist:'PD',screenType:"上消化道癌机会性筛查（胃镜）",screenDate:"2026-06-30",screenResult:"胃窦黏膜萎缩伴肠化",screenAdvice:"建议胃镜下多点活检",treatments:[{"mode":"化疗","start":"2026-07-12","end":"","plan":"XELOX + 纳武利尤单抗（姑息一线）","note":"MSI-H/dMMR，第 3/6 周期中"}],markerDate:'2026-07-10',recistDate:'2026-08-26',ecogDate:'2026-08-26',metaProgress:'腹膜转移',diseaseProgress:true},
{id:'TE004',patient:'王秀兰',sex:'女',age:54,idNo:'361100198006125871',region:'上饶市信州区',city:'上饶市',insurance:'职工医保',firstHosp:'信州区西市街道社区卫生服务中心',firstDate:'2026-02-15',hospital:'上饶市肿瘤医院',
 site:'肝',laterality:'右肝后叶',path:'肝细胞癌',grade:'中分化',tNm:'cT3N0M0',stage:'III期',stageDate:'2026-02-20',multiPrimary:false,
 treatMode:['手术','介入'],mdt:true,
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-07-20',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'乙型肝炎 20 年、肝硬化 5 年',smoke:'不吸烟',drink:'已戒酒 5 年',family:'哥哥患肝癌',diagBasis:'上腹部 MRI 增强（LI-RADS 5）+ 术后病理',diagDate:'2026-02-20',tConfirm:'2026-02-20',metastasis:'无远处转移',treatMode:['手术','介入'],referral:true,curPhase:'术后随访中',phaseTimeline:'手术(2026-03-02)→TACE介入(2026-06-15)→术后随访中',tFirst:'2026-02-15',tTreat:'2026-03-02',admCount:4,admDays:19,marker:'AFP 412.5；DCP 156；HBsAg 阳性；HBV-DNA 2.3×10⁴',recurrence:false,recist:'CR',screenType:"肝癌高危人群筛查（超声 + AFP）",screenDate:"2026-01-10",screenResult:"右肝后叶低回声结节，AFP 升高",screenAdvice:"建议增强 MRI 明确诊断",treatments:[{"mode":"手术","date":"2026-03-02","end":"2026-03-12","plan":"右肝后叶切除术","note":"术后病理肝细胞癌，MVI M1"},{"mode":"介入","start":"2026-06-15","end":"2026-06-18","plan":"TACE 经导管肝动脉化疗栓塞","note":"术后 CT 复查疗效 CR"}],markerDate:'2026-02-20',recistDate:'2026-07-18',ecogDate:'2026-07-18',metaProgress:'无',diseaseProgress:false},
{id:'TE005',patient:'李志强',sex:'男',age:66,idNo:'361000196011152330',region:'宜春市袁州区',city:'宜春市',insurance:'职工医保',firstHosp:'袁州区化成街道社区卫生服务中心',firstDate:'2026-04-12',hospital:'宜春市人民医院',
 site:'肺',laterality:'左肺下叶',path:'鳞状细胞癌',grade:'中分化',tNm:'cT2bN2M0',stage:'III期',stageDate:'2026-04-18',multiPrimary:false,
 treatMode:['手术','放疗','化疗'],mdt:true,
 symptom:'偶有胸闷',pain:'轻度疼痛',nutrition:'无营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'II度放射性食管炎',rehab:'康复中',supportive:'营养支持',
 lastFu:'2026-08-30',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'慢性阻塞性肺疾病 6 年、肺结核史',smoke:'吸烟 40 年，20 支/日（已戒 2 年）',drink:'偶饮酒',family:'无肿瘤家族史',diagBasis:'胸部 CT 增强 + 支气管镜活检病理',diagDate:'2026-04-18',tConfirm:'2026-04-18',metastasis:'区域淋巴结转移',treatMode:['手术','放疗','化疗'],referral:true,curPhase:'同步放化疗中',phaseTimeline:'手术(2026-05-10)→同步放化疗中(第4/6周期)',tFirst:'2026-04-12',tTreat:'2026-05-10',admCount:6,admDays:28,marker:'PD-L1 TPS 60%；p40(+)；未见 EGFR/ALK 突变',recurrence:false,recist:'PR',screenType:"低剂量螺旋 CT 肺癌筛查",screenDate:"2026-03-25",screenResult:"左肺下叶占位 3.1cm",screenAdvice:"建议支气管镜检查及病理确诊",treatments:[{"mode":"手术","date":"2026-05-10","end":"2026-05-18","plan":"左肺下叶切除术 + 淋巴结清扫","note":"术后病理鳞状细胞癌"},{"mode":"放疗","start":"2026-06-15","end":"","plan":"胸部调强放疗（IMRT）","note":"同步放化疗，第 4/6 周期"},{"mode":"化疗","start":"2026-06-15","end":"","plan":"依托泊苷 + 顺铂（同步）","note":"同步放化疗，第 4/6 周期"}],markerDate:'2026-04-18',recistDate:'2026-08-30',ecogDate:'2026-08-30',metaProgress:'无',diseaseProgress:false},
{id:'TE006',patient:'周桂香',sex:'女',age:69,idNo:'360300196509120826',region:'景德镇市珠山区',city:'景德镇市',insurance:'城镇居民',firstHosp:'珠山区里村街道社区卫生服务中心',firstDate:'2026-05-06',hospital:'景德镇市第一医院',
 site:'宫颈',laterality:'宫颈',path:'鳞状细胞癌',grade:'中分化',tNm:'cT2bN1M0',stage:'II期',stageDate:'2026-05-11',multiPrimary:false,
 treatMode:['手术','放疗'],mdt:false,
 symptom:'偶有接触性出血',pain:'轻度疼痛',nutrition:'无营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'I度骨髓抑制',rehab:'康复中',supportive:'无',
 lastFu:'2026-08-25',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'子宫肌瘤手术史、高血压 5 年',smoke:'不吸烟',drink:'不饮酒',family:'无肿瘤家族史',diagBasis:'宫颈活检病理 + 盆腔 MRI 分期',diagDate:'2026-05-11',tConfirm:'2026-05-11',metastasis:'区域淋巴结转移',treatMode:['手术','放疗'],referral:true,curPhase:'根治性放疗中',phaseTimeline:'手术(2026-05-20)→根治性放疗中(第3/6周期)',tFirst:'2026-05-06',tTreat:'2026-05-20',admCount:5,admDays:24,marker:'p16 阳性；HPV 16 型阳性；PD-L1 CPS 5',recurrence:false,recist:'CR',screenType:"两癌筛查（TCT + HPV）",screenDate:"2026-05-06",screenResult:"TCT 示 HSIL",screenAdvice:"HPV16 阳性，建议阴道镜活检",treatments:[{"mode":"手术","date":"2026-05-20","end":"2026-05-27","plan":"广泛性子宫切除术 + 盆腔淋巴结清扫","note":"术后病理宫颈鳞癌"},{"mode":"放疗","start":"2026-06-20","end":"","plan":"盆腔外照射 + 后装腔内放疗","note":"根治性放疗，第 3/6 周期"}],markerDate:'2026-05-11',recistDate:'2026-08-25',ecogDate:'2026-08-25',metaProgress:'无',diseaseProgress:false},
{id:'TE007',patient:'吴建国',sex:'男',age:58,idNo:'360500198108203456',region:'萍乡市安源区',city:'萍乡市',insurance:'职工医保',firstHosp:'安源区后埠街道社区卫生服务中心',firstDate:'2026-06-20',hospital:'南昌市第一医院',
 site:'结直肠',laterality:'直肠',path:'腺癌',grade:'中分化',tNm:'cT3N1M0',stage:'III期',stageDate:'2026-06-25',multiPrimary:false,
 treatMode:['手术','化疗'],mdt:true,
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-09-05',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'胆囊结石 6 年',smoke:'吸烟 25 年，10 支/日（未戒）',drink:'饮啤酒 20 年',family:'无肿瘤家族史',diagBasis:'结肠镜 + 活检病理 + 全腹 CT 分期',diagDate:'2026-06-25',tConfirm:'2026-06-25',metastasis:'区域淋巴结转移',treatMode:['手术','化疗'],referral:true,curPhase:'辅助化疗中',phaseTimeline:'手术(2026-07-02)→辅助化疗中(第2/6周期)',tFirst:'2026-06-20',tTreat:'2026-07-02',admCount:3,admDays:16,marker:'RAS 野生型；MSI-L（pMMR）；CEA 8.6',recurrence:false,recist:'SD',screenType:"结直肠癌筛查（便潜血 + 结肠镜）",screenDate:"2026-06-10",screenResult:"便潜血阳性，结肠镜见距肛门 7cm 占位",screenAdvice:"建议活检明确病理",treatments:[{"mode":"手术","date":"2026-07-02","end":"2026-07-11","plan":"腹腔镜直肠癌根治术（Dixon）","note":"术后病理直肠腺癌 T3"},{"mode":"化疗","start":"2026-08-01","end":"","plan":"XELOX 方案（辅助化疗）","note":"第 2/6 周期中"}],markerDate:'2026-06-25',recistDate:'2026-09-05',ecogDate:'2026-09-05',metaProgress:'无',diseaseProgress:false},
{id:'TE008',patient:'胡爱莲',sex:'女',age:61,idNo:'360800198209165234',region:'抚州市临川区',city:'抚州市',insurance:'城镇居民',firstHosp:'临川区青云街道社区卫生服务中心',firstDate:'2026-07-25',hospital:'江西省肿瘤医院',
 site:'乳腺',laterality:'右乳',path:'浸润性导管癌',grade:'III级',tNm:'cT2N2M1',stage:'IV期',stageDate:'2026-07-28',multiPrimary:false,
 treatMode:['化疗','靶向'],mdt:true,
 symptom:'骨转移灶疼痛',pain:'重度疼痛',nutrition:'中度营养风险',physical:'ECOG 2',complication:'病理性骨折(肋骨)',ae:'II度骨髓抑制',rehab:'支持治疗为主',supportive:'镇痛治疗',
 lastFu:'2026-09-02',followStatus:'随访中',vitalStatus:'存活（带瘤）',deathCause:'',lostFollow:false,pastHistory:'2 型糖尿病 10 年、骨质疏松',smoke:'不吸烟',drink:'不饮酒',family:'姐姐患乳腺癌',diagBasis:'钼靶/彩超 + 穿刺病理 + PET-CT 分期',diagDate:'2026-07-28',tConfirm:'2026-07-28',metastasis:'骨转移/肝转移',treatMode:['化疗','靶向'],referral:true,curPhase:'一线治疗中',phaseTimeline:'MDT评估(2026-07-30)→化疗+靶向治疗中(第2/6周期)',tFirst:'2026-07-25',tTreat:'2026-07-30',admCount:4,admDays:22,marker:'HER2 阴性；ER 40%(+)；BRCA1 未突变；PD-L1 CPS 20',recurrence:false,recist:'PR',screenType:"两癌筛查（乳腺钼靶 + 超声）",screenDate:"2026-07-18",screenResult:"右乳肿块伴多发钙化，BI-RADS 5",screenAdvice:"建议空芯针穿刺活检及免疫组化",treatments:[{"mode":"化疗","start":"2026-07-30","end":"","plan":"多西他赛 + 卡铂（一线）","note":"第 2/6 周期，疗效评价 PR"},{"mode":"靶向","start":"2026-08-10","end":"","plan":"曲妥珠单抗 + 帕妥珠单抗（抗 HER2）","note":"LVEF 58%，基线正常"}],markerDate:'2026-07-28',recistDate:'2026-09-01',ecogDate:'2026-09-01',metaProgress:'骨转移/肝转移',diseaseProgress:true},
{id:'TE009',patient:'欧阳明轩',sex:'男',age:52,idNo:'362400197403121243',region:'吉安市吉州区',city:'吉安市',insurance:'城镇居民',firstHosp:'吉州区古南镇卫生院',firstDate:'2026-08-01',hospital:'吉安市中心医院',
 site:'食管',laterality:'胸中段食管',path:'鳞状细胞癌',grade:'中分化',tNm:'cT3N1M0',stage:'III期',stageDate:'2026-08-05',multiPrimary:false,
 treatMode:['放疗','化疗'],mdt:true,
 symptom:'进食梗阻感',pain:'轻度疼痛',nutrition:'中度营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'II度放射性食管炎',rehab:'康复中',supportive:'营养支持',
 lastFu:'2026-09-08',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'长期饮酒史、反流性食管炎',smoke:'吸烟 30 年，20 支/日（未戒）',drink:'饮白酒 25 年',family:'父亲患食管癌',diagBasis:'胃镜 + 活检病理 + 胸腹 CT 分期',diagDate:'2026-08-05',tConfirm:'2026-08-05',metastasis:'区域淋巴结转移',treatMode:['放疗','化疗'],referral:true,curPhase:'根治性同步放化疗中',phaseTimeline:'确诊(2026-08-05)→根治性同步放化疗中(第3/6周期)',tFirst:'2026-08-01',tTreat:'2026-08-08',admCount:3,admDays:18,marker:'PD-L1 CPS 15；p53 过表达；HER2 阴性',recurrence:false,recist:'PR',screenType:"上消化道癌机会性筛查（钡餐 + 胃镜）",screenDate:"2026-07-25",screenResult:"食管中段充盈缺损 6cm",screenAdvice:"建议胃镜活检明确病理",treatments:[{"mode":"放疗","start":"2026-08-08","end":"","plan":"食管癌根治性放疗（IMRT）","note":"同步放化疗，第 3/6 周期"},{"mode":"化疗","start":"2026-08-08","end":"","plan":"紫杉醇 + 顺铂（同步）","note":"同步放化疗，第 3/6 周期"}],markerDate:'2026-08-05',recistDate:'2026-09-08',ecogDate:'2026-09-08',metaProgress:'无',diseaseProgress:false},
{id:'TE010',patient:'邓三妹',sex:'女',age:63,idNo:'360800196306128475',region:'抚州市临川区',city:'抚州市',insurance:'城镇居民',firstHosp:'临川区青云街道社区卫生服务中心',firstDate:'2026-06-01',hospital:'抚州市第一医院',
 site:'宫颈',laterality:'宫颈',path:'鳞状细胞癌',grade:'中分化',tNm:'cT2bN1M0',stage:'II期',stageDate:'2026-06-05',multiPrimary:false,
 treatMode:['手术','化疗'],mdt:true,
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'I度骨髓抑制',rehab:'康复良好',supportive:'无',
 lastFu:'2026-08-20',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'高血压 12 年',smoke:'不吸烟',drink:'不饮酒',family:'无肿瘤家族史',diagBasis:'宫颈活检病理 + 盆腔 MRI 分期',diagDate:'2026-06-05',tConfirm:'2026-06-05',metastasis:'区域淋巴结转移',treatMode:['手术','化疗'],referral:true,curPhase:'辅助化疗中',phaseTimeline:'手术(2026-06-12)→辅助化疗中(第2/6周期)',tFirst:'2026-06-01',tTreat:'2026-06-12',admCount:4,admDays:17,marker:'HPV 18 型阳性；p16 阳性；PD-L1 CPS 8',recurrence:false,recist:'CR',screenType:"两癌筛查（TCT + HPV）",screenDate:"2026-05-22",screenResult:"TCT 示 ASC-H",screenAdvice:"HPV18 阳性，建议阴道镜活检",treatments:[{"mode":"手术","date":"2026-06-12","end":"2026-06-20","plan":"广泛性子宫切除术 + 盆腔淋巴结清扫","note":"术后病理宫颈鳞癌"},{"mode":"化疗","start":"2026-07-10","end":"","plan":"顺铂 + 紫杉醇（辅助化疗）","note":"第 2/6 周期中"}],markerDate:'2026-06-05',recistDate:'2026-08-20',ecogDate:'2026-08-20',metaProgress:'无',diseaseProgress:false},
{id:'TE011',patient:'赵梅英',sex:'女',age:59,idNo:'360200196602056578',region:'鹰潭市月湖区',city:'鹰潭市',insurance:'职工医保',firstHosp:'月湖区交通街道社区卫生服务中心',firstDate:'2026-05-18',hospital:'鹰潭市人民医院',
 site:'结直肠',laterality:'乙状结肠',path:'腺癌',grade:'中分化',tNm:'cT3N1M0',stage:'III期',stageDate:'2026-05-22',multiPrimary:false,
 treatMode:['手术','化疗'],mdt:false,
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-09-01',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'缺铁性贫血、结肠息肉切除史',smoke:'不吸烟',drink:'不饮酒',family:'母亲患结直肠癌',diagBasis:'结肠镜 + 活检病理 + 腹盆腔 CT 分期',diagDate:'2026-05-22',tConfirm:'2026-05-22',metastasis:'区域淋巴结转移',treatMode:['手术','化疗'],referral:true,curPhase:'术后随访中',phaseTimeline:'手术(2026-06-01)→辅助化疗完成(2026-08-28)→术后随访中',tFirst:'2026-05-18',tTreat:'2026-06-01',admCount:3,admDays:15,marker:'MSI-H（dMMR）；RAS/BRAF 野生型；CEA 6.2',recurrence:false,recist:'CR',screenType:"结直肠癌筛查（结肠镜）",screenDate:"2026-05-10",screenResult:"乙状结肠环周占位",screenAdvice:"建议活检明确病理",treatments:[{"mode":"手术","date":"2026-06-01","end":"2026-06-10","plan":"腹腔镜乙状结肠癌根治术","note":"术后病理腺癌 T3"},{"mode":"化疗","start":"2026-06-28","end":"2026-08-28","plan":"XELOX 方案（辅助化疗 4 周期）","note":"辅助化疗已完成"}],markerDate:'2026-05-22',recistDate:'2026-09-01',ecogDate:'2026-09-01',metaProgress:'无',diseaseProgress:false},
{id:'TE012',patient:'章含韵',sex:'女',age:45,idNo:'360502198301125628',region:'新余市渝水区',city:'新余市',insurance:'职工医保',firstHosp:'渝水区城北街道社区卫生服务中心',firstDate:'2026-06-08',hospital:'新余市人民医院',
 site:'乳腺',laterality:'左乳',path:'浸润性导管癌',grade:'II级',tNm:'cT1N0M0',stage:'I期',stageDate:'2026-06-12',multiPrimary:false,
 treatMode:['手术','放疗'],mdt:false,
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-06-21',followStatus:'失访',vitalStatus:'失访',deathCause:'',lostFollow:true,pastHistory:'无特殊既往史',smoke:'不吸烟',drink:'不饮酒',family:'无肿瘤家族史',diagBasis:'钼靶/彩超 + 穿刺病理 + 免疫组化',diagDate:'2026-06-12',tConfirm:'2026-06-12',metastasis:'无',treatMode:['手术'],referral:false,curPhase:'术后随访中',phaseTimeline:'手术(2026-06-20)→术后随访中',tFirst:'2026-06-08',tTreat:'2026-06-20',admCount:2,admDays:9,marker:'ER 90%(+)；PR 85%(+)；HER2 阴性；Ki-67 10%；Luminal A 型',recurrence:false,recist:'SD',screenType:"两癌筛查（乳腺超声）",screenDate:"2026-06-05",screenResult:"左乳结节 1.4cm，BI-RADS 5",screenAdvice:"建议空芯针穿刺活检",treatments:[{"mode":"手术","date":"2026-06-20","end":"2026-06-26","plan":"左乳保乳手术 + 前哨淋巴结活检","note":"术后放疗计划因失访未执行"}],markerDate:'2026-06-12',recistDate:'2026-06-21',ecogDate:'2026-06-08',metaProgress:'无',diseaseProgress:false},
{id:'TE013',patient:'陈爱国',sex:'男',age:78,idNo:'360103194805121237',region:'南昌市西湖区',city:'南昌市',insurance:'职工医保',firstHosp:'浙江大学医学院附属第一医院',provOut:true,firstDate:'2024-12-15',hospital:'南昌市第一医院',
 site:'肝',laterality:'右肝后叶',path:'肝细胞癌',grade:'中分化',tNm:'pT3N0M0',stage:'III期',stageDate:'2024-12-20',multiPrimary:false,
 treatMode:['手术'],mdt:false,
 symptom:'无',pain:'无痛',nutrition:'未填',physical:'ECOG 1',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-06-10',deathDate:'2026-06-10',followStatus:'死亡结案',vitalStatus:'死亡',deathCause:'肝功能衰竭',lostFollow:false,pastHistory:'乙型肝炎 30 年、肝硬化 10 年',smoke:'已戒烟 15 年',drink:'已戒酒 15 年',family:'弟弟患肝癌',diagBasis:'外院 MRI + 术后病理（外省手术）',diagDate:'2024-12-20',tConfirm:'2024-12-20',metastasis:'无远处转移',treatMode:['手术'],referral:true,curPhase:'术后随访中',phaseTimeline:'外省手术(2024-12-28)→回赣随访',tFirst:'2024-12-15',tTreat:'2024-12-28',admCount:6,admDays:38,marker:'AFP 268；HBsAg 阳性；术后病理 MVI M1',recurrence:false,recist:'PD',screenType:"肝癌高危人群筛查（超声 + AFP）",screenDate:"2024-11-28",screenResult:"右肝后叶占位 6.1cm",screenAdvice:"建议增强 MRI 明确诊断并评估手术",treatments:[{"mode":"手术","date":"2024-12-28","end":"2025-01-08","plan":"右肝后叶切除术（外省）","note":"术后病理肝细胞癌，MVI M0"}],markerDate:'2024-12-20',recistDate:'2026-05-20',ecogDate:'2026-06-10',metaProgress:'无',diseaseProgress:false}
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
/* 转院/转诊就诊记录（按患者ID） */
var SP_REFERRALS={
TE001:[
 {d:'2026-01-19',dir:'上转',from:'东湖区董家窑街道社区卫生服务中心',to:'南昌市第一医院',reason:'胸部DR发现右上肺结节性质待定，需增强CT及病理确诊',mat:'DR影像报告、社区筛查记录',status:'已接诊，2026-01-28完成增强CT评估'},
 {d:'2026-06-20',dir:'下转',from:'南昌市第一医院',to:'东湖区董家窑街道社区卫生服务中心',reason:'术后辅助化疗期，转回社区协同随访与症状监测',mat:'手术记录、化疗方案单',status:'社区已接收，每2周协同随访'}],
TE002:[
 {d:'2026-03-21',dir:'上转',from:'章贡区南外街道社区卫生服务中心',to:'江西省肿瘤医院',reason:'两癌筛查发现左乳结节BI-RADS 5，需穿刺确诊并规范治疗',mat:'钼靶影像、两癌筛查单',status:'已接诊，完成穿刺确诊'}],
TE003:[
 {d:'2026-07-08',dir:'上转',from:'浔阳区甘棠街道卫生院',to:'九江市第一人民医院',reason:'上腹隐痛伴纳差2月，需胃镜及腹部CT评估',mat:'卫生院门诊记录',status:'已接诊，完成胃镜确诊'}],
TE004:[
 {d:'2026-02-15',dir:'上转',from:'信州区西市街道社区卫生服务中心',to:'上饶市肿瘤医院',reason:'腹部超声发现肝占位，需增强MRI确诊并评估手术',mat:'超声报告',status:'已接诊，完成分期评估'}],
TE005:[
 {d:'2026-04-12',dir:'上转',from:'袁州区化成街道社区卫生服务中心',to:'宜春市人民医院',reason:'胸闷伴干咳加重，胸部CT见左下肺占位，需专科确诊',mat:'社区首诊记录',status:'已接诊，完成气管镜活检'}],
TE006:[
 {d:'2026-05-06',dir:'上转',from:'珠山区里村街道社区卫生服务中心',to:'景德镇市第一医院',reason:'两癌筛查TCT示HSIL、HPV16阳性，需阴道镜评估活检',mat:'TCT/HPV报告',status:'已接诊，完成阴道镜活检'}],
TE007:[
 {d:'2026-06-20',dir:'跨市上转',from:'萍乡市安源区后埠街道社区卫生服务中心',to:'南昌市第一医院',reason:'便血伴排便习惯改变，粪隐血阳性，需肠镜及结直肠专科诊治',mat:'隐血检验单、社区首诊记录',status:'已接诊，完成根治性手术'},
 {d:'2026-08-10',dir:'下转',from:'南昌市第一医院',to:'萍乡市安源区后埠街道社区卫生服务中心',reason:'辅助化疗期返回萍乡居住，转回社区协同随访管理',mat:'手术病理、化疗记录单',status:'社区已接收，远程随访'}],
TE008:[
 {d:'2026-07-25',dir:'跨市上转',from:'抚州市临川区青云街道社区卫生服务中心',to:'江西省肿瘤医院',reason:'右乳肿块可疑恶性伴骨痛，需穿刺确诊、HER2检测及全身治疗',mat:'钼靶报告',status:'已接诊，确诊IV期后收入院'}],
TE009:[
 {d:'2026-08-01',dir:'上转',from:'吉州区古南镇卫生院',to:'吉安市中心医院',reason:'进行性吞咽梗阻，钡餐见食管中段狭窄，需胃镜及分期评估',mat:'钡餐报告',status:'已接诊，完成活检及MDT'}],
TE010:[
 {d:'2026-06-01',dir:'上转',from:'临川区青云街道社区卫生服务中心',to:'抚州市第一医院',reason:'两癌筛查TCT示ASC-H、HPV18阳性，需阴道镜活检',mat:'TCT/HPV报告',status:'已接诊，完成活检确诊'}],
TE011:[
 {d:'2026-05-18',dir:'上转',from:'月湖区交通街道社区卫生服务中心',to:'鹰潭市人民医院',reason:'排便习惯改变伴粪隐血阳性，需肠镜检查',mat:'隐血检验单',status:'已接诊，完成肠镜活检'}],
TE012:[],
TE013:[
 {d:'2025-01-06',dir:'跨省转入',from:'浙江大学医学院附属第一医院（浙江省）',to:'南昌市第一医院',reason:'肝癌外省术后回赣，转入参保地进行术后随访与慢病管理',mat:'外省术后病理、出院小结、影像光盘',status:'已接诊建档，纳入回赣随访管理'}]
};


/* 病种费用参数（诊疗路径·费用面） */
var SP_SITE_COST={
 '肺':{ip:52000,drug:38,ins:58},'乳腺':{ip:46000,drug:42,ins:61},'肝':{ip:58000,drug:35,ins:55},
 '胃':{ip:49000,drug:40,ins:57},'结直肠':{ip:44000,drug:36,ins:60},'宫颈':{ip:36000,drug:31,ins:64},'食管':{ip:41000,drug:33,ins:59}
};
var SP_MODE_COST=[
 {mode:'手术',cost:46000,unit:'次'},{mode:'放疗',cost:33000,unit:'全程'},{mode:'化疗',cost:21000,unit:'年累计'},
 {mode:'靶向',cost:86000,unit:'年累计'},{mode:'免疫',cost:92000,unit:'年累计'},{mode:'内分泌',cost:12000,unit:'年累计'},{mode:'介入',cost:38000,unit:'次'}
];


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
function spCutoff(){return spDate(_spScope&&_spScope.cutoff)||spToday()}
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
  var v=spRecordValue(e,spKnown(e.initialStage)?'initialStage':'stage',['initialStageDate','stageDate']);
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
function spDistant(e){return spBool(e.distantAtDiagnosis)===true}
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
  return (Array.isArray(e.treatments)?e.treatments:[]).filter(function(t){
    var d=spDate(t.start)||spDate(t.date);
    return d&&d<=cut&&(!diagnosis||d>=diagnosis)&&(!death||d<=death);
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
function spTopoCode(e){return SP_TOPO_CODE[e.site]||''}
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
/* 治疗方式分项：手术/放疗/化疗 分别标注 有/无——用于计算治疗方案规范率
   区分「无」与「未记录」：无 = 已确认未开展；未记录 = 数据缺失，不计入分母 */
var SP_MODES=['手术','放疗','化疗'];
function spModeFlags(e){
  var modes=spTreatmentModes(e),known=modes.length>0;
  return SP_MODES.map(function(m){
    var has=modes.indexOf(m)>=0;
    var cls=has?'badge-success':'badge-neutral';
    return '<div class="sp-kv-item sp-inline"><span class="k">'+esc(m)+'</span><span class="v">'+
      (has?badge('有',cls):(known?badge('未见记录','badge-neutral'):badge('未记录','badge-caution')))+'</span></div>';
  }).join('');
}
/* 首次治疗日期：取全部治疗明细中最早的起始日 */
function spFirstTreat(e){
  var list=Array.isArray(e.treatments)?e.treatments:null;
  var ds=list?list.map(function(t){return spDate(t.start)||spDate(t.date)}).filter(Boolean).sort():[];
  return list?(ds[0]||''):(spDate(e.tTreat)||'');
}
/* ICD-10：由 ICD-O-3 部位码截取主码（C34.9 → C34），与病案/影像口径一致 */
function spIcd10(e){var c=spTopoCode(e);return c?c.split('.')[0]:''}
/* 筛查参与状态：由筛查时间/方式推导；「未参与」与「不详」严格区分 */
function spScreenStatus(e){
  var participated=spRecordValue(e,'screenParticipated',['screenDate']);
  var type=spRecordValue(e,'screenType',['screenDate']);
  if(spBool(participated)===false)return '未参与';
  if((spDate(e.screenDate)&&e.screenDate<=spCutoff())||spKnown(type))return '有筛查记录';
  return '不详';
}
/* 病理类型：去掉与病理名重复的分化描述（如「低分化腺癌（低分化）」→「低分化腺癌」） */
function spPathText(e){
  var p=e.path||'',g=e.grade||'';
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
  var start=e.diagDate||e.stageDate||e.tConfirm;
  var end=e.vitalStatus==='死亡'?(e.deathDate||e.lastFu):e.lastFu;
  if(!start||!end)return {text:'—',n:null,alive:null};
  var d1=new Date(start),d2=new Date(end);
  if(isNaN(d1)||isNaN(d2)||d2<d1)return {text:'—',n:null,alive:null};
  var months=Math.max(1,Math.round((d2-d1)/(1000*60*60*24*30.44)));
  var dead=e.vitalStatus==='死亡';
  var lost=e.lostFollow||e.vitalStatus==='失访';
  return {text:dead?('生存 '+months+' 个月（死亡）'):lost?('随访 '+months+' 个月（失访）'):(months>=12?('生存 '+(months/12).toFixed(1)+' 年'):('生存 '+months+' 个月')),n:months,alive:!dead};
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
    if(sc.hospital&&e.hospital!==sc.hospital)return false;
    return true;
  });
}
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
  var active=function(e){return /^存活/.test(spVital(e))&&spLost(e)===false&&(e.managementStatus==='在管'||e.followStatus==='随访中')};
  count('patients','纳入患者数',pn,'人','统一患者标识去重',function(){return true});
  count('tumors','纳入瘤例数',n,'例','患者标识 + 原发肿瘤/记录标识去重',function(){return true},list);
  var from=(_spScope&&_spScope.from)||spCutoff().slice(0,4)+'-01-01',to=(_spScope&&_spScope.to)||spCutoff();
  var period=function(e){return list.some(function(t){var d=spDiagnosisDate(t);return spPatientKey(t)===spPatientKey(e)&&!!d&&d>=from&&d<=to})};
  count('periodDiagnosed','期内确诊记录患者数',persons.filter(period).length,'人','当前记录确诊日期在 '+from+' 至 '+to,period);
  var firstKnown=persons.filter(function(e){return !!spDate(e.firstCancerDiagnosisDate)}).length;
  var first=function(e){var d=spDate(e.firstCancerDiagnosisDate);return !!d&&d>=from&&d<=to};
  count('newPatients','首次新确诊患者数',firstKnown===pn&&pn?persons.filter(first).length:null,'人','需要历史首次恶性肿瘤确诊日期',first);
  metrics.newPatients.unknown=pn-firstKnown;
  count('active','随访在管存活患者',persons.filter(active).length,'人','已知存活、非失访且明确在管/随访中',active);
  count('alive','已知存活患者',alive,'人','截止日前有效末次随访明确存活',function(e){return /^存活/.test(spVital(e))});
  count('dead','已登记死亡患者',dead,'人','有效死亡日期不晚于截止日',function(e){return spVital(e)==='死亡'});
  count('lost','失访记录患者',lost,'人','明确失访记录且未死亡结案',function(e){return spLost(e)===true&&spVital(e)!=='死亡'});
  count('vitalUnknown','生存状态不详患者',pn-alive-dead,'人','无可用时点或生存状态不详',function(e){return spVital(e)==='不详'});
  ratio('early','记录早期分期占比',list,function(e){var s=spStage(e);return s==='不适用'?s:s==='不详'?null:spEarly(e)},'I/II期 / 已知且适用的分期瘤例');
  ratio('late','记录 IV 期占比',list,function(e){var s=spStage(e);return s==='不适用'?s:s==='不详'?null:spLate(e)},'IV期 / 已知且适用的分期瘤例');
  ratio('distant','初诊远处转移记录占比',list,recordedBool('distantAtDiagnosis'),'明确初诊远处转移 / 初诊转移状态已知瘤例');
  ratio('screen','队列筛查记录覆盖',persons,function(e){return spScreenStatus(e)==='有筛查记录'},'有筛查记录患者 / 纳入患者','患者');
  ratio('basis','病理学诊断记录占比',list,function(e){var v=spDiagBasisType(e);return v==='不详'?null:v==='病理学诊断'},'有明确病理/活检依据 / 诊断依据已知瘤例');
  ratio('mdt','MDT 记录占比',list,recordedBool('mdt',['mdtRecordedDate','mdtDate']),'截止日前MDT明确为是 / MDT字段已知瘤例');
  ratio('referral','转诊记录占比',list,recordedBool('referral',['referralRecordedDate','referralDate']),'截止日前明确转诊 / 转诊状态已知瘤例');
  ratio('started','治疗启动记录覆盖',list,function(e){return spTreatmentEntries(e).length>0||(!Array.isArray(e.treatments)&&spTreatmentModes(e).length>0)},'有有效且截止日前的治疗开始记录 / 纳入瘤例');
  ratio('combo','多方式治疗记录占比',list,function(e){var a=spTreatmentModes(e);return a.length?a.length>=2:null},'至少两种不同治疗类别 / 有有效治疗方式的瘤例');
  ['手术','放疗','化疗','靶向','免疫','内分泌','介入'].forEach(function(mode,i){
    ratio('mode'+i,mode+'记录占比',list,function(e){return spTreatmentModes(e).length?spHasMode(e,mode):null},'含该方式 / 有有效治疗方式的瘤例');
  });
  ratio('palliative','姑息治疗记录占比',list,function(e){var v=spRecordValue(e,'curPhase',['phaseDate']);return spKnown(v)?String(v).indexOf('姑息')>=0:null},'明确姑息阶段 / 治疗阶段已知瘤例');
  ratio('hospice','安宁疗护记录占比',list,function(e){var v=spRecordValue(e,'supportive',['supportiveDate']);return spKnown(v)?String(v).indexOf('安宁')>=0:null},'明确安宁疗护 / 支持治疗字段已知瘤例');
  ratio('follow','随访日期记录覆盖',persons,function(e){var d=spDate(e.lastFu),diag=spDiagnosisDate(e);return !!d&&d<=spCutoff()&&(!diag||d>=diag)},'有有效末次随访日期 / 纳入患者','患者');
  ratio('lostRatio','失访记录患者占比',persons,function(e){return spVital(e)==='死亡'?'不适用':spLost(e)},'明确失访 / 非死亡且失访状态已知患者','患者');
  ratio('recurrence','复发记录占比',list,recordedBool('recurrence',['recurrenceRecordedDate','recurrenceDate']),'截止日前明确复发 / 复发状态已知瘤例');
  ratio('progress','进展记录占比',list,recordedBool('diseaseProgress',['progressRecordedDate','progressDate']),'截止日前明确进展 / 进展状态已知瘤例');
  ratio('metastasis','转移记录占比',list,function(e){var v=spRecordValue(e,'metaProgress',['metastasisRecordedDate','metastasisDate']);return spKnown(v)?spBool(v)===false?false:true:null},'有转移记录 / 转移字段已知瘤例；不代表随访新增转移');
  ratio('local','市域内就诊记录占比',list,function(e){var s=spGeoClass(e);return s==='不详'?null:s==='市域内'},'现就诊医院与户籍地市相同 / 两地市均可判定瘤例');
  ratio('cross','跨市就诊记录占比',list,function(e){var s=spGeoClass(e);return s==='不详'?null:s==='跨市'},'现就诊医院与户籍地市不同 / 两地市均可判定瘤例');
  ratio('historicProvince','既往外省诊疗记录占比',persons,recordedBool('provOut'),'明确曾在外省诊疗 / 既往跨省字段已知患者','患者');
  ratio('knownAlive','已知状态中存活占比',persons,function(e){var v=spVital(e);return v==='不详'?null:v!=='死亡'},'已知存活 / 生存状态已知患者；非生存率','患者');
  ratio('complete','关键字段完整患者比例',persons,function(e){
    return list.filter(function(t){return spPatientKey(t)===spPatientKey(e)}).every(function(t){return spCoreChecks(t).every(function(c){return c.ok})});
  },'本人全部瘤例的适用关键字段均有效 / 纳入患者','患者');
  var tasks=[],taskKeys=new Set(),taskSources=new Set();
  list.forEach(function(e){
    if(!Array.isArray(e.followupTasks))return;
    taskSources.add(spPatientKey(e));
    e.followupTasks.forEach(function(t){
      var key=spPatientKey(e)+'|'+String(spKnown(t.id)?t.id:spAnonymousKey(t));
      if(taskKeys.has(key))return;
      taskKeys.add(key);
      var end=spDate(t.windowEnd)||spDate(t.dueDate);
      var created=spDate(t.createdDate),cancelled=spDate(t.cancelledDate);
      var cancel=t.status==='已取消'&&(cancelled?cancelled<=spCutoff():spCutoff()===spToday());
      if(end&&end<=spCutoff()&&(!created||created<=end)&&spBool(t.applicable)!==false&&!cancel)tasks.push({patient:e,task:t,end:end});
    });
  });
  var timely=tasks.filter(function(r){
    var t=r.task,d=spDate(t.completedDate),start=spDate(t.windowStart)||spDate(t.createdDate)||spDiagnosisDate(r.patient);
    var evidence=spDate(t.evidenceDate);
    return !!d&&!!start&&d>=start&&d<=r.end&&(!evidence||evidence<=spCutoff())&&!!(t.evidenceId||t.followupRecordId||t.hasEvidence===true);
  });
  metrics.timely={id:'timely',name:'按期随访完成率',value:tasks.length?+(timely.length/tasks.length*100).toFixed(1):null,
    numerator:timely.length,denominator:tasks.length,unknown:pn-taskSources.size,notApplicable:0,unit:'%',statisticalUnit:'随访任务',
    definition:'有有效证据且在任务窗口内完成 / 已到期适用任务；不详为任务源未接入患者数',status:taskSources.size?(tasks.length?'可计算':'无到期任务'):'未接入',
    ids:Array.from(new Set(timely.map(function(r){return r.patient.id})))};
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
  return {total:pn,tumorTotal:n,persons:persons,list:list,metrics:metrics,alive:alive,dead:dead,lost:lost,active:metrics.active.value,
    male:persons.filter(function(e){return e.sex==='男'}).length,female:persons.filter(function(e){return e.sex==='女'}).length,
    medianAge:spMedian(ages),ageUnknown:pn-ages.length,newYear:metrics.periodDiagnosed.value,
    earlyRate:metrics.early.value,lateRate:metrics.late.value,mdtRate:metrics.mdt.value,comboRate:metrics.combo.value,
    crossCityRate:metrics.cross.value,crossProvRate:metrics.historicProvince.value,localTreatRate:metrics.local.value,
    surgeryRate:metrics.mode0.value,radioRate:metrics.mode1.value,chemoRate:metrics.mode2.value,targetRate:metrics.mode3.value,
    immunoRate:metrics.mode4.value,endocrineRate:metrics.mode5.value,interRate:metrics.mode6.value,
    referralRate:metrics.referral.value,pallRate:metrics.palliative.value,fuRate:metrics.follow.value,lostRate:metrics.lostRatio.value,
    recurRate:metrics.recurrence.value,metaRate:metrics.metastasis.value,progRate:metrics.progress.value,
    distantRate:metrics.distant.value,deathRate:pn?+(dead/pn*100).toFixed(1):null,effSurvival:metrics.knownAlive.value};
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
.sp-mt-table tr.sp-mt-grouprow td{background:var(--color-bg-subtle);font-weight:700;color:var(--color-text-title);font-size:var(--fs-sm);letter-spacing:.02em}
.sp-overview-title{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.sp-overview-title h2{margin:0;font-size:18px}
.sp-overview-title>span{font-size:12px;color:var(--color-text-muted)}
.sp-kpi-k{white-space:normal;overflow:visible;min-height:34px;line-height:1.4;font-size:12px}
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
/* 保留五组分析结构，描述记录事实，不对无适用规则的全队列作达标评价。 */
var SP_DOMAINS=[
 {key:'burden',label:'人群与病情构成'},{key:'early',label:'发现与诊断'},
 {key:'treat',label:'诊疗过程'},{key:'outcome',label:'随访与结局'},
 {key:'equity',label:'就医与可及性'},{key:'metrics',label:'指标明细表'}
];

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
    '<div class="sp-filter-actions"><button class="btn btn-ghost btn-sm" onclick="window._spScopeReset()">重置</button>'+
    '<button class="btn btn-outline btn-sm" onclick="window._spGpToPatients()">查看患者</button>'+
    '<button class="btn btn-primary btn-sm" onclick="window._spExportMetricsCSV()">导出 CSV</button></div>'+
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
function spKpiStrip(list,agg){
  return '<div class="sp-kpi-strip">'+['patients','newPatients','active','early','started','timely','lostRatio','complete'].map(function(id){
    var m=agg.metrics[id],sub=spMetricEvidence(m);
    if(id==='patients')sub=agg.tumorTotal+' 瘤例';
    if(id==='newPatients'&&m.value===null)sub='期内确诊记录 '+agg.metrics.periodDiagnosed.value+' 人';
    var action=m.value!==null&&m.ids.length?' onclick="window._spMetricPatients(\''+id+'\')" tabindex="0" role="button" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();window._spMetricPatients(\''+id+'\')}"':'';
    return '<div class="sp-kpi'+(action?' sp-kpi-action':'')+'"'+action+' title="'+esc(m.definition+'；'+spMetricEvidence(m))+'">'+
      '<div class="sp-kpi-k">'+esc(m.name)+'</div><div class="sp-kpi-v">'+(m.value===null?'—':spNumber(m.value))+
      (m.value===null?'':'<em>'+m.unit+'</em>')+'</div><div class="sp-kpi-sub">'+esc(sub)+'</div>'+
      (m.value===null?'<div class="sp-kpi-sub">'+esc(id==='newPatients'?'历史首次确诊未接入':m.status==='未接入'?'随访任务未接入':m.status)+'</div>':'')+'</div>';
  }).join('')+'</div>';
}

/* 旧级联漏斗停用：MDT和多方式治疗不是人人必经的路径节点。 */
function spCareCascade(list){
  return '';
}

function renderOverview(){
  var list=spScopeEvents(_spScope);
  var agg=spAgg(list);
  var siteRows=spSiteRows(list);
  var cityRows=spCityRows(list);
  var h='<div class="sp-overview-title"><h2>患者群体总览</h2><span>内置样例 · 统计口径 V13.0 · 截止 '+spCutoff()+'</span></div>'+spScopeBar();
  if(!list.length){
    h+='<div class="sp-gp-empty">当前范围无纳入记录<br>'+
      '<button class="btn btn-outline btn-sm" style="margin-top:10px" onclick="window._spScopeReset()">重置筛选条件</button></div>';
    return h;
  }
  /* 开场：一句话摘要 → 链条节点指标带 → 防治链条级联漏斗（群体视角核心） */
  h+=spKpiStrip(list,agg);
  /* 五段 Tabs：疾病负担 → 早期发现 → 规范诊疗 → 生存结局 → 资源与公平 */
  h+='<div class="sp-domain-tabs">'+SP_DOMAINS.map(function(d){
    return '<button class="sp-domain-tab'+(_spDomain===d.key?' active':'')+'" onclick="window._spSetDomain(\''+d.key+'\')">'+d.label+'</button>';
  }).join('')+'</div>';
  h+='<div id="spDomainBody">'+spDomainPanel(list,agg,siteRows,cityRows)+'</div>';
  return h;
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
function spDistribution(list,fn){
  var values=new Map();
  list.forEach(function(e){var k=fn(e);k=spKnown(k)?String(k):'不详';values.set(k,(values.get(k)||0)+1)});
  return Array.from(values,function(r){return {k:r[0],v:r[1]}}).sort(function(a,b){return b.v-a.v});
}
function spHistoryState(e){
  if(!spKnown(e.pastHistory))return '不详';
  return /^(无|无特殊既往史|无既往史|无基础疾病)$/.test(String(e.pastHistory).trim())?'明确无既往史':'有既往史记录';
}
function spSymptomState(e){return !spKnown(e.symptom)?'不详':e.symptom==='无'?'明确无症状记录':'有症状记录'}
function spTreatmentLabel(e){var a=spTreatmentModes(e);return a.length?a.join(' + '):(spRecordValue(e,'treatmentStatus',['treatmentStatusDate'])||'未见有效启动记录')}
function spPhysicalState(e){return spRecordValue(e,'physical',['ecogDate'])}
function spNutritionState(e){return spRecordValue(e,'nutrition',['nutritionDate'])}
function spRecistState(e){
  var d=spDate(e.recistDate),diag=spDiagnosisDate(e);
  return d&&d<=spCutoff()&&(!diag||d>=diag)&&['CR','PR','SD','PD','NE'].indexOf(e.recist)>=0?e.recist:'不详';
}
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
function spDomainPanel(list,agg,siteRows,cityRows){

  /* ========== 段① 人群与病情构成：在管一群什么样的人、什么瘤、什么期 ==========
     内部两块：A 人群特征（人口学/社会属性/共病）B 病情构成（瘤谱/分期）；
     发现途径（症状/筛查）归属段②。原称「疾病负担」，V12.4 改名以名副其实。 */
  if(_spDomain==='burden'){
    var people=agg.persons,ages=spAgeDist(people);
    var history=spDistribution(people,spHistoryState);
    var checks=spCoreChecks({}).map(function(c){
      var good=list.filter(function(e){return spCoreChecks(e).find(function(x){return x.name===c.name}).ok}).length;
      return [c.name,good+' / '+list.length,list.length-good];
    });
    return spGpHead('A','人口学与社会属性','患者口径')+
      '<div class="sp-mini-grid sp-overview-mini">'+spMini('确诊时中位年龄',spNumber(agg.medianAge)+'<em> 岁</em>')+
      spMini('年龄不详',agg.ageUnknown+'<em> 人</em>')+spMini('男 / 女',agg.male+' / '+agg.female+'<em> 人</em>')+
      spMini('性别不详',(agg.total-agg.male-agg.female)+'<em> 人</em>')+'</div>'+
      '<div class="sp-2col sp-overview-grid">'+
        spPanel('确诊时年龄构成（人）',spHBar(ages.map(function(a){return {k:a.k,v:a.n}}),false,true))+
        spPanel('年龄与性别',spSimpleTable(['年龄段','男','女','不详','合计'],ages.map(function(a){return [a.k,a.m,a.f,a.u,a.n]})))+
        spPanel('医保类型构成',spPie(spDistribution(people,function(e){return e.insurance}),'人'))+
        spPanel('户籍区县构成',spHBar(spDistribution(people,function(e){return e.region}),false,true))+
        spPanel('既往史记录',spPie(history,'人'))+
        spPanel('关键字段有效情况',spSimpleTable(['字段','有效瘤例 / 总瘤例','缺失或冲突'],checks))+
      '</div>'+spGpHead('B','肿瘤与分期记录','瘤例口径')+
      '<div class="sp-2col sp-overview-grid">'+
        spPanel('瘤种构成',spPie(siteRows.map(function(r){return {k:r.site,v:r.n}})))+
        spPanel('分期记录构成',spPie(spStageItems(list)))+
      '</div>'+spPanel('分瘤种分期记录',spSimpleTable(['瘤种','瘤例数','I期','II期','III期','IV期','不详','不适用'],siteRows.map(function(r){
        return [r.site,r.n].concat(SP_STAGE_GROUPS.concat(['不详','不适用']).map(function(s){return r.list.filter(function(e){return spStage(e)===s}).length}));
      })));
  }

  /* ========== 段② 早期发现：发现得早不早（筛查 → 早诊 → 地区/病种差异） ==========
     注：分期构成（首诊分期）归属段①「疾病负担」，本段不再重复饼图，只用早诊率数值与差异表 */
  if(_spDomain==='early'){
    return spMetricCards(agg,['screen','early','late','distant'])+
      '<div class="sp-2col sp-overview-grid">'+
        spPanel('筛查记录状态',spPie(spDistribution(agg.persons,spScreenStatus),'人'))+
        spPanel('诊断依据记录',spPie(spDistribution(list,spDiagBasisType)))+
        spPanel('发现途径记录',spPie(spDistribution(list,function(e){return e.discoveryMode})))+
        spPanel('症状记录状态',spPie(spDistribution(agg.persons,spSymptomState),'人'))+
      '</div>'+spPanel('分瘤种分期对照',spSimpleTable(['瘤种','瘤例数','早期占比','分子 / 有效分母','IV期占比','分期不详'],siteRows.map(function(r){
        var m=r.agg.metrics.early;
        return [r.site,r.n,spMetricValue(m),m.numerator+' / '+m.denominator,spMetricValue(r.agg.metrics.late),m.unknown];
      })))+'<div class="sp-overview-grid">'+spPanel('诊断时效（天）',spJourney(list))+'</div>';
  }

  /* ========== 段③ 规范诊疗：治得规不规范、卡在哪一环（时效 + 模式） ========== */
  if(_spDomain==='treat'){
    var modes=['mode0','mode1','mode2','mode3','mode4','mode5','mode6'].map(function(id){return agg.metrics[id]});
    var combos=spDistribution(list,spTreatmentLabel);
    return spMetricCards(agg,['mdt','combo','referral','dateConflicts'])+
      spPanel('诊疗时效（天）',spJourney(list))+
      '<div class="sp-2col sp-overview-grid">'+
        spPanel('治疗方式记录占比',spSimpleTable(['治疗方式','占比','分子 / 有效分母','不详'],modes.map(function(m){
          return [m.name,spMetricValue(m),m.numerator+' / '+m.denominator,m.unknown];
        })))+
        spPanel('治疗模式组合',spSimpleTable(['治疗组合/状态','瘤例数','占纳入瘤例'],combos.map(function(r){
          return [r.k,r.v,spNumber(r.v/agg.tumorTotal*100)+'%'];
        })))+
        spPanel('就诊医院构成（瘤例）',spHBar(spDistribution(list,function(e){return e.hospital}),false,true))+
        spPanel('体能与营养记录',spSimpleTable(['记录类别','状态','瘤例数'],
          spDistribution(list,spPhysicalState).map(function(r){return ['ECOG记录',r.k,r.v]})
            .concat(spDistribution(list,spNutritionState).map(function(r){return ['营养记录',r.k,r.v]}))))+
      '</div>'+spMetricCards(agg,['palliative','hospice']);
  }

  /* ========== 段④ 生存结局：结局好不好（生存 + 复发进展死亡） ========== */
  if(_spDomain==='outcome'){
    var gaps=spDistribution(agg.persons,spFollowGap);
    return spMetricCards(agg,['follow','timely','lost','vitalUnknown'])+
      '<div class="sp-2col sp-overview-grid">'+
        spPanel('生存状态记录',spPie(spDistribution(agg.persons,spVital),'人'))+
        spPanel('末次随访距截止日',spHBar(gaps,false,true))+
        spPanel('疾病评价记录',spPie(spDistribution(list,spRecistState)))+
        spPanel('分瘤种结局记录',spSimpleTable(['瘤种','患者数','已知存活','已登记死亡','生存不详','失访记录'],siteRows.map(function(r){
          return [r.site,r.agg.total,r.agg.alive,r.agg.dead,r.agg.total-r.agg.alive-r.agg.dead,r.agg.lost];
        })))+
      '</div>'+spMetricCards(agg,['recurrence','progress','metastasis'])+
      spPanel('专业结局指标数据状态',spSimpleTable(['指标','状态'],[
        ['1 / 3 / 5 年总体生存率','尚未建立时间到事件分析队列'],
        ['随访新增转移 / 复发风险','起点与事件日期未接入'],
        ['治疗完成与不良反应发生率','治疗周期、分级与适用分母未接入']
      ]));
  }

  /* ========== 段⑤ 资源与公平：资源与可及性均不均衡（地图 + 流向 + 费用） ========== */
  if(_spDomain==='equity'){
    /* 地图 + 地市排行 */
    var mapBlock='<div class="sp-ov-grid" style="margin-bottom:16px">'+
      '<div class="panel"><div class="panel-header"><span>全省分布 · '+esc(_spMapMetricKey)+'</span></div><div class="panel-body">'+spMapPanel(list,_spMapMetricKey,_spScope.city)+'</div></div>'+
      '<div class="sp-ov-side"><div class="panel"><div class="panel-header"><span>地市数据'+(_spScope.city?'<span class="spr-count">当前：'+esc(_spScope.city)+'</span>':'')+'</span></div><div class="panel-body">'+
        '<div class="sp-map-rank">'+cityRows.filter(function(r){return r.n>0}).sort(function(a,b){return SP_MAP_METRICS[_spMapMetricKey].get(b)-SP_MAP_METRICS[_spMapMetricKey].get(a)}).slice(0,6).map(function(r,i){
          var v=SP_MAP_METRICS[_spMapMetricKey].get(r);
          return '<div class="sp-map-rank-item'+(r.city===_spScope.city?' sel':'')+'" onclick="window._spDrillCity(\''+esc(r.city)+'\')">'+
            '<span class="sp-map-rank-idx">'+(i+1)+'</span><span class="sp-map-rank-name">'+esc(r.city)+'</span>'+
            '<span class="sp-map-rank-sub">'+r.agg.total+' 人</span><span class="sp-map-rank-val">'+SP_MAP_METRICS[_spMapMetricKey].fmt(v)+'</span></div>';
        }).join('')+'</div></div></div>'+
      '<div class="panel"><div class="panel-header"><span>当前范围</span></div><div class="panel-body"><div class="sp-kv-grid">'+
        '<div class="sp-kv-item"><span class="k">统计范围</span><span class="v">'+esc(spScopeLabel())+'</span></div>'+
        '<div class="sp-kv-item"><span class="k">纳入患者 / 瘤例</span><span class="v">'+agg.total+' 人 / '+agg.tumorTotal+' 例</span></div>'+
        '<div class="sp-kv-item"><span class="k">市域内就诊记录占比</span><span class="v">'+esc(spMetricValue(agg.metrics.local))+'</span></div>'+
        '<div class="sp-kv-item"><span class="k">地址不详瘤例</span><span class="v">'+agg.metrics.local.unknown+' 例</span></div>'+
      '</div></div></div></div>'+
    '</div>';
    /* 流出病种 */
    var outRows=siteRows.filter(function(r){return r.list.some(spOutCity)}).map(function(siteRow){
      var s=siteRow.site;
      var tos={};siteRow.list.filter(spOutCity).forEach(function(e){tos[e.hospital]=(tos[e.hospital]||0)+1});
      return '<tr><td>'+esc(s)+'</td><td>'+siteRow.n+'</td><td>'+esc(spMetricValue(siteRow.agg.metrics.cross))+'</td><td>'+esc(Object.keys(tos).join('、')||'—')+'</td></tr>';
    }).join('');
    return mapBlock+
    spPanel('地市同口径对照',spCityCompare(cityRows,['cross','fu']))+
    '<div class="sp-overview-grid">'+spMetricCards(agg,['cross','historicProvince'])+
      spPanel('跨市就诊瘤种与医院','<div class="sp-table-wrap"><table class="data-table sp-overview-table"><thead><tr><th>瘤种</th><th>纳入瘤例</th><th>跨市记录占比</th><th>就诊医院</th></tr></thead><tbody>'+
        (outRows||'<tr><td colspan="4" class="sp-table-empty">无跨市就诊记录</td></tr>')+'</tbody></table></div>')+
      spPanel('费用与三级流向数据状态',spSimpleTable(['数据项','状态'],[
        ['次均住院费用 / 跨区域费用差异','实际住院结算记录未接入'],
        ['药品等费用项目构成','费用项目明细未接入'],
        ['医保、个人及其他支付方构成','实际支付金额未接入'],
        ['县域内诊疗 / 首次治疗跨省流向','机构县区码与诊疗事件所在地未接入']
      ]))+'</div>';
  }

  /* ========== 段⑥ 指标明细表：全部聚合指标按维度列成可读、可复制、可导出的表 ==========
     解决「画像指标汇总数据不好导出」：图形页读趋势，本页读数字 + 一键导 CSV */
  if(_spDomain==='metrics'){
    return spMetricsTable(list,agg,siteRows,cityRows);
  }

  return '';
}

/* ---- 指标明细表：把总览/五段的全部聚合指标汇成分组表格，支持整表 CSV 导出 ----
   数据与各图形页同源（spAgg/spSiteRows/spCityRows），一处口径，确保图表与导出一致 ---- */
function spMetricsGroups(list,agg,siteRows,cityRows){
  function metricRow(m){return [m.name,spMetricValue(m),m.definition,m.numerator===null?'':m.numerator,
    m.denominator===null?'':m.denominator,m.unknown,m.status,m.unit,m.statisticalUnit||m.unit,m.notApplicable]}
  function group(name,ids){return {group:name,rows:ids.map(function(id){return metricRow(agg.metrics[id])})}}
  function scalar(name,value,unit,definition,n,unknown){
    return [name,value===null?'不可计算':spNumber(value)+' '+unit,definition,'',n===undefined?'':n,unknown||0,
      value===null?'有效数据不足':'可计算',unit,unit==='人'?'患者':'瘤例',0];
  }
  function distribution(group,records,label,fn,unit){
    spDistribution(records,fn).forEach(function(r){group.rows.push(scalar(label+' · '+r.k,r.v,unit||'例','当前纳入范围构成',records.length,0))});
  }
  var groups=[
    group('一、队列与数据完整度',['patients','tumors','periodDiagnosed','newPatients','active','complete','dateConflicts']),
    group('二、发现与诊断',['screen','early','late','distant','basis']),
    group('三、诊疗过程',['started','mdt','combo','referral','palliative','hospice','mode0','mode1','mode2','mode3','mode4','mode5','mode6']),
    group('四、随访与结局',['alive','dead','vitalUnknown','lost','follow','timely','lostRatio','recurrence','progress','metastasis']),
    group('五、就医与可及性',['local','cross','historicProvince'])
  ];
  groups[0].rows.push(scalar('确诊时中位年龄',agg.medianAge,'岁','由出生日期与确诊日期推导；取有效患者中位数',agg.total-agg.ageUnknown,agg.ageUnknown));
  distribution(groups[0],agg.persons,'性别',function(e){return e.sex},'人');
  distribution(groups[0],agg.persons,'医保类型',function(e){return e.insurance},'人');
  distribution(groups[0],agg.persons,'户籍区县',function(e){return e.region},'人');
  distribution(groups[0],agg.persons,'既往史记录',spHistoryState,'人');
  spAgeDist(agg.persons).forEach(function(a){
    [['合计',a.n],['男',a.m],['女',a.f],['性别不详',a.u]].forEach(function(r){groups[0].rows.push(scalar('年龄 '+a.k+' · '+r[0],r[1],'人','确诊时年龄，患者去重',agg.total,0))});
  });
  spCoreChecks({}).forEach(function(c){
    var good=list.filter(function(e){return spCoreChecks(e).find(function(x){return x.name===c.name}).ok}).length;
    groups[0].rows.push(['关键字段 · '+c.name,good+' / '+list.length,'有效瘤例 / 全部瘤例',good,list.length,list.length-good,'可计算','例','瘤例',0]);
  });
  distribution(groups[1],list,'分期',spStage);
  distribution(groups[1],list,'诊断依据',spDiagBasisType);
  distribution(groups[1],agg.persons,'筛查状态',spScreenStatus,'人');
  distribution(groups[1],list,'发现途径',function(e){return e.discoveryMode});
  distribution(groups[1],agg.persons,'症状记录',spSymptomState,'人');
  [['首诊 → 确诊','firstDate','diagDate'],['确诊 → 首治','diagDate','tTreat'],['首诊 → 首治','firstDate','tTreat']].forEach(function(r){
    var s=spIntervalStats(list,r[1],r[2]);
    [['中位',s.median],['P75',s.p75],['P90',s.p90]].forEach(function(v){groups[2].rows.push(scalar(r[0]+' · '+v[0],v[1],'天','同一瘤例的有效日期差；日期冲突不计入',s.n,s.unknown))});
  });
  distribution(groups[2],list,'治疗组合/状态',spTreatmentLabel);
  distribution(groups[2],list,'ECOG记录',spPhysicalState);
  distribution(groups[2],list,'营养记录',spNutritionState);
  distribution(groups[3],agg.persons,'生存状态',spVital,'人');
  distribution(groups[3],agg.persons,'随访日期间隔',spFollowGap,'人');
  distribution(groups[3],list,'疾病评价记录',spRecistState);
  distribution(groups[4],list,'就诊医院',function(e){return e.hospital});
  [['实际住院与费用','结算记录未接入'],['县域与首次治疗跨省流向','机构县区码与事件所在地未接入']].forEach(function(r){
    groups[4].rows.push([r[0],'未接入',r[1],'','','','未接入','','',0]);
  });
  var siteDetail={group:'六、分瘤种指标',cols:['瘤种','患者数','瘤例数','记录早期占比','早期分子 / 分母','分期不详','记录 IV 期占比','随访日期记录覆盖'],matrix:
    siteRows.slice().sort(function(a,b){return b.n-a.n}).map(function(r){
      var m=r.agg.metrics.early;
      return [r.site,r.agg.total,r.n,spMetricValue(m),m.numerator+' / '+m.denominator,m.unknown,spMetricValue(r.agg.metrics.late),spMetricValue(r.agg.metrics.follow)];
    })};
  var cityDetail={group:'七、分地市指标',cols:['户籍地市','患者数','瘤例数','记录早期占比','分期不详','跨市记录占比','地址不详','随访日期记录覆盖'],matrix:
    cityRows.filter(function(r){return r.n>0}).sort(function(a,b){return b.n-a.n}).map(function(r){
      return [r.city,r.agg.total,r.n,spMetricValue(r.agg.metrics.early),r.agg.metrics.early.unknown,spMetricValue(r.agg.metrics.cross),
        r.agg.metrics.cross.unknown,spMetricValue(r.agg.metrics.follow)];
    })};
  return {groups:groups,siteDetail:siteDetail,cityDetail:cityDetail};
}
function spMetricsTable(list,agg,siteRows,cityRows){
  var m=spMetricsGroups(list,agg,siteRows,cityRows);
  /* 概览型分组：三列（指标 / 数值 / 口径） */
  var ovBody=m.groups.map(function(g){
    var head='<tr class="sp-mt-grouprow"><td colspan="7">'+esc(g.group)+'</td></tr>';
    var rows=g.rows.map(function(r){
      return '<tr>'+[r[0],r[1],r[3],r[4],r[5],r[6],r[2]].map(function(v,i){return '<td class="'+(i===6?'sp-mt-note':'')+'">'+esc(v)+'</td>'}).join('')+'</tr>';
    }).join('');
    return head+rows;
  }).join('');
  var ovTable='<div class="sp-table-wrap"><table class="data-table sp-mt-table" style="min-width:980px"><thead><tr><th>指标</th><th>数值</th><th>分子</th><th>有效分母 / 样本</th><th>不详 / 不可用</th><th>状态</th><th>口径</th></tr></thead><tbody>'+ovBody+'</tbody></table></div>';
  /* 明细矩阵表 */
  function matrixTable(d){
    var head='<tr>'+d.cols.map(function(c,i){return '<th class="'+(i===0?'txt':'num')+'">'+esc(c)+'</th>'}).join('')+'</tr>';
    var body=d.matrix.length?d.matrix.map(function(row){
      return '<tr>'+row.map(function(c,i){return '<td class="'+(i===0?'txt':'num')+'">'+esc(String(c))+'</td>'}).join('')+'</tr>';
    }).join(''):'<tr><td colspan="'+d.cols.length+'" style="text-align:center;color:var(--color-text-muted)">暂无数据</td></tr>';
    return '<div class="sp-table-wrap"><table class="data-table sp-mt-table" style="min-width:560px"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>';
  }
  var scopeTxt=esc(spScopeLabel());
  var head='<div class="sp-mt-head"><div><div class="sp-mt-title">画像指标明细表</div>'+
    '<div class="sp-mt-sub">当前范围：<b>'+scopeTxt+'</b> · '+agg.total+' 人 / '+agg.tumorTotal+' 瘤例 · 内置样例 · 口径 V13.0</div></div>'+
    '<div class="sp-mt-actions"><button class="btn btn-primary btn-sm" onclick="window._spExportMetricsCSV()">导出 CSV</button>'+
    '<button class="btn btn-outline btn-sm" onclick="window._spCopyMetrics()">复制全部</button></div></div>';
  return head+
    spPanel('汇总指标',ovTable)+
    '<div style="height:16px"></div>'+spPanel(m.siteDetail.group,matrixTable(m.siteDetail))+
    '<div style="height:16px"></div>'+spPanel(m.cityDetail.group,matrixTable(m.cityDetail));
}
/* 把指标明细整理成「分组 / 指标 / 数值 / 口径」的扁平行，供 CSV 与复制共用 */
function spMetricsFlatRows(){
  var list=spScopeEvents(_spScope);
  var m=spMetricsGroups(list,spAgg(list),spSiteRows(list),spCityRows(list));
  var out=[['分组','指标','数值','单位','统计对象','分子','有效分母/样本','不详/不可用','不适用','状态','口径','范围','统计截止日','口径版本','数据来源']];
  function row(group,name,value,unit,obj,num,den,unknown,na,status,definition){
    out.push([group,name,String(value),unit,obj,String(num===undefined?'':num),String(den===undefined?'':den),
      String(unknown===undefined?'':unknown),String(na||0),status,definition,spScopeLabel(),spCutoff(),'V13.0','内置样例']);
  }
  m.groups.forEach(function(g){
    g.rows.forEach(function(r){row(g.group,r[0],r[1],r[7],r[8],r[3],r[4],r[5],r[9],r[6],r[2])});
  });
  /* 分组明细也保留原指标的有效分母与缺失数。 */
  [[m.siteDetail.group,spSiteRows(list),'site',['patients','tumors','early','late','follow']],
    [m.cityDetail.group,spCityRows(list).filter(function(r){return r.n>0}),'city',['patients','tumors','early','cross','follow']]].forEach(function(d){
    d[1].forEach(function(r){
      d[3].forEach(function(id){
        var metric=r.agg.metrics[id];
        row(d[0],r[d[2]]+' · '+metric.name,spMetricValue(metric),metric.unit,metric.statisticalUnit||metric.unit,
          metric.numerator,metric.denominator===null?'':metric.denominator,metric.unknown,metric.notApplicable,metric.status,metric.definition);
      });
    });
  });
  return out;
}

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
var _wbFilters={q:'',site:'',stage:'',city:'',hospital:'',fu:'',mp:''};
var _wbDetail=null;
var _wbOverviewSelection=null;

function spWbFiltered(){
  var source=_wbOverviewSelection?spScopeEvents(_wbOverviewSelection.scope).filter(function(e){return _wbOverviewSelection.ids.indexOf(e.id)>=0}):spUnique(tumorEvents,spTumorKey);
  return source.filter(function(e){
    var q=_wbFilters.q;
    if(q){
      var hit=[e.patient,e.region,e.site,e.path,e.hospital].some(function(x){return String(x||'').indexOf(q)>=0});
      if(!hit)return false;
    }
    if(_wbFilters.site&&e.site!==_wbFilters.site)return false;
    if(_wbFilters.stage&&spStage(e)!==_wbFilters.stage)return false;
    if(_wbFilters.city&&e.city!==_wbFilters.city)return false;
    if(_wbFilters.hospital&&e.hospital!==_wbFilters.hospital)return false;
    if(_wbFilters.fu&&e.followStatus!==_wbFilters.fu)return false;
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
    '<div class="form-group wide"><label>关键字</label><input id="spWbQ" placeholder="姓名 / 地区 / 瘤种 / 医院" value="'+esc(_wbFilters.q)+'"></div>'+
    '<div class="form-group"><label>瘤种</label><select id="spWbSite"><option value="">全部</option>'+sites.map(function(s){return '<option'+(s===_wbFilters.site?' selected':'')+'>'+esc(s)+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>分期</label><select id="spWbStage"><option value="">全部</option>'+SP_STAGE_GROUPS.map(function(s){return '<option'+(s===_wbFilters.stage?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>地市</label><select id="spWbCity"><option value="">全部</option>'+SP_CITIES.map(function(c){return '<option'+(c===_wbFilters.city?' selected':'')+'>'+c+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>医院</label><select id="spWbHospital"><option value="">全部</option>'+SP_HOSPITALS.map(function(h){return '<option'+(h===_wbFilters.hospital?' selected':'')+'>'+esc(h)+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>随访状态</label><select id="spWbFu"><option value="">全部</option>'+['随访中','失访','死亡结案'].map(function(s){return '<option'+(s===_wbFilters.fu?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>是否多原发</label><select id="spWbMp"><option value="">全部</option>'+['是','否'].map(function(s){return '<option'+(s===_wbFilters.mp?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
    '<div class="sp-filter-actions"><button class="btn btn-ghost btn-sm" onclick="window._spWbReset()">重置</button><button class="btn btn-primary btn-sm" onclick="window._spWbQuery()">查询</button></div>'+
  '</div>';
  var rows=list.map(function(e){
    return '<tr style="cursor:pointer" onclick="window._spOpenDetail(\''+e.id+'\')">'+
      '<td style="font-weight:600">'+esc(e.patient)+'</td><td>'+esc(e.sex)+'</td><td>'+spNumber(spAge(e))+'</td>'+
      '<td>'+esc(e.city)+'</td><td>'+esc(e.hospital||'—')+'</td>'+
      '<td>'+esc(e.site)+'</td><td>'+esc(e.laterality)+'</td><td>'+esc(e.path)+'</td>'+
      '<td>'+esc(spStage(e))+'</td>'+'<td>'+spMultiCell(e)+'</td>'+
      '<td>'+spFuVitalCell(e)+'</td>'+    '</tr>';
  }).join('');
  var table='<div class="panel"><div class="panel-header"><span>患者列表<span class="spr-count">共 '+list.length+' 例 · 全部 '+tumorEvents.length+' 例</span></span></div>'+
    '<div class="sp-table-wrap"><table class="data-table" style="min-width:1120px"><thead><tr><th class="txt">患者</th><th class="code">性别</th><th class="num">确诊时年龄</th><th class="txt">户籍地市</th><th class="txt">就诊医院</th><th class="txt">瘤种</th><th class="txt">部位</th><th>病理</th><th class="code">分期</th><th class="code">是否多原发</th><th class="code">随访状态</th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="11" style="text-align:center;color:var(--color-text-muted);padding:30px 0">无符合条件的患者</td></tr>')+
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
  (SP_REFERRALS[e.id]||[]).forEach(function(x){nodes.push({d:x.d,c:'转诊('+x.dir+') · '+x.from+' → '+x.to,t:2})});
  nodes.push({d:e.lastFu,c:'最近随访 · '+e.followStatus});
  var seen={},uniq=[];
  nodes.forEach(function(nd){
    var k=nd.d+'|'+nd.c;
    if(!seen[k]){seen[k]=1;uniq.push(nd)}
  });
  uniq.sort(function(a,b){return a.d<b.d?-1:1});
  return '<div class="sp-tl-legend"><span><i style="background:var(--color-primary)"></i>诊疗节点</span><span><i style="background:#f59e0b"></i>检查检验（影像/检验）</span><span><i style="background:#14b8a6"></i>转诊</span></div><div class="sp-timeline">'+uniq.map(function(nd){
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
  var list=SP_REFERRALS[pid]||[];
  if(!list.length)return '<div class="sp-chart-empty">无转院就诊记录（本机构直接建档管理）</div>';
  /* 「类型」列已移除：转出→转入的方向本身已表达上/下转；「操作」列已移除：详情内容在此表内已展示完整 */
  return '<div class="sp-table-wrap"><table class="data-table" style="min-width:560px"><thead><tr><th style="width:96px">时间</th><th style="width:38%">转出 → 转入</th><th class="txt">事由/目的</th><th style="width:240px">接诊状态</th></tr></thead><tbody>'+
  list.map(function(x){
    return '<tr><td>'+esc(x.d)+'</td><td>'+esc(x.from)+'<span style="color:var(--color-primary);padding:0 6px">→</span>'+esc(x.to)+'</td><td class="txt">'+esc(x.reason)+'</td><td>'+esc(x.status)+'</td></tr>';
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
  var x=(SP_REFERRALS[pid]||[])[i];if(!x)return;
  var e=tumorEvents.filter(function(t){return t.id===pid})[0];
  var body='<div class="sp-rpt-info"><span>患者：'+esc(e?e.patient:pid)+'</span><span>转诊时间：'+esc(x.d)+'</span><span>类型：'+esc(x.dir)+'</span></div>'+
    '<div class="sp-ref-flow"><div class="sp-ref-node"><div class="sp-ref-role">转出机构</div><div class="sp-ref-name">'+esc(x.from)+'</div></div><div class="sp-ref-line">——'+esc(x.dir)+'——▶</div><div class="sp-ref-node"><div class="sp-ref-role">转入机构</div><div class="sp-ref-name">'+esc(x.to)+'</div></div></div>'+
    '<div class="sp-kv-grid" style="margin-top:14px">'+spKv('事由/目的',x.reason)+spKv('接诊状态',x.status)+spKv('随转材料',x.mat)+spKv('画像联动','该转诊事件已并入画像时间线')+'</div>';
  spModal('转院就诊记录 · '+x.d,body,'<button class="btn btn-ghost btn-sm" data-sp-close>关闭</button>');
};
function spBlock(idx,title,bodyHtml){
  return '<div class="sp-profile-block"><div class="sp-block-head"><span class="sp-block-idx">'+idx+'</span><span class="sp-block-title">'+esc(title)+'</span></div><div class="sp-block-body">'+bodyHtml+'</div></div>';
}
/* 带块头追加区的画像块：extra 渲染在标题右侧（如多原发瘤例切换键） */
function spBlockWith(idx,title,bodyHtml,extra){
  if(!extra)return spBlock(idx,title,bodyHtml);
  return '<div class="sp-profile-block"><div class="sp-block-head"><span class="sp-block-idx">'+idx+'</span><span class="sp-block-title">'+esc(title)+'</span>'+extra+'</div><div class="sp-block-body">'+bodyHtml+'</div></div>';
}
/* 同一患者的全部瘤例（多原发）：按确诊日期升序、同日期按原发序号，首例为「原发」，其余为「第 N 原发」 */
function spPatientTumors(e){
  if(!e)return [];
  var pk=spPatientKey(e);
  var list=spUnique(tumorEvents.filter(function(x){return spPatientKey(x)===pk}),spTumorKey);
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
  var head='<div class="sp-detail-back"><button class="btn btn-ghost btn-sm" onclick="window._spBackList()">← 返回患者列表</button></div>'+
    '<div class="sp-patient-strip">'+
    '<div class="sp-patient-avatar">'+esc(e.patient.charAt(0))+'</div>'+
    '<div style="min-width:0"><div class="sp-patient-name">'+esc(e.patient)+'<span class="sp-patient-meta">'+esc(spMaskIdNo(e.idNo))+' · '+esc(spEmpi(e))+'</span></div></div>'+
    '</div>';
  /* 1 患者基础：一眼认清"这是谁"——性别年龄、户籍地、医保、就诊机构；筛查参与属预防端信息 */
  var b1='<div class="sp-kv-grid">'+
    spKvI('性别',e.sex)+
    spKvI('确诊时年龄',spNumber(spAge(e))+' 岁')+
    spKvI('户籍地',e.region)+
    spKvI('就诊机构',e.hospital||'—')+
    spKvI('医保类型',e.insurance)+
    '</div>'+
    spSub('筛查参与信息')+
    '<div class="sp-kv-grid">'+
    spKvI('筛查参与',spScreenStatus(e))+
    spKvI('筛查方式',e.screenType||'—')+
    spKvI('筛查时间',e.screenDate||'—')+
    spKvI('筛查结果',e.screenResult||'—')+
    spKvI('筛查建议',e.screenAdvice||'—')+
    '</div>';
  /* 2 肿瘤特征：瘤种身份（原发部位+病理类型）+ 编码（ICD-10、ICD-O-3）+ 分级/TNM + 确诊日期 + 诊断依据
     多原发：同一患者多个瘤例时，块头出现瘤例切换键，切换后本块（及全页瘤例级信息）随之切换 */
  var curIdx=Math.max(0,tumors.map(function(x){return x.id}).indexOf(e.id));
  var b2=spSub('瘤种与分期')+'<div class="sp-kv-grid">'+
    spKvI('原发部位',e.laterality)+
    spKvI('病理类型',spPathText(e))+
    spKvI('ICD-10',spIcd10(e)||'—')+
    spKvI('ICD-O-3 部位码',spTopoCode(e)||'—')+
    spKvI('ICD-O-3 形态码',spMorphCode(e)||'—')+
    spKvI('分级',spGradeText(e))+
    spKvI('TNM',e.tNm||'—')+
    spKvI('确诊日期',e.diagDate||'—')+
    spKvI('诊断依据',spDiagBasisType(e))+
    (tumors.length>1?spKvI('瘤例序号',spTumorNo(curIdx)+' · '+spTumorLabel(e,curIdx)+' / 共 '+tumors.length+' 例'):'')+
    '</div>';
  /* 3 诊疗过程：治疗与转诊（治疗方式三项同行；转诊仅记是否） */
  var referral=spBool(spRecordValue(e,'referral',['referralRecordedDate','referralDate']));
  var mdt=spBool(spRecordValue(e,'mdt',['mdtRecordedDate','mdtDate']));
  var b3=spSub('治疗与转诊')+'<div class="sp-kv-grid">'+
    spKvI('首次治疗日期',spFirstTreat(e)||'—')+
    spKvI('是否发生转诊',referral===null?'不详':referral?'是':'否')+
    spKvI('MDT',mdt===null?'不详':mdt?'已开展':'未开展')+
    '</div>'+
    spSub('治疗方式')+
    '<div class="sp-kv-grid sp-cols-3">'+spModeFlags(e)+'</div>';
  /* 4 随访与结局：现在什么状态、活多久了 */
  var surv=spSurvival(e);
  var b5='<div class="sp-kv-grid">'+
    spKvI('生存状态',e.vitalStatus+(e.lostFollow?'（失访）':''))+
    spKvI('末次随访日期',e.lastFu||'—')+
    spKvI('生存时间（推算）',surv.text)+
    spKvI('死亡原因',e.vitalStatus==='死亡'?(e.deathCause||'—'):'—')+
    '</div>';
  var blocks='<div class="sp-profile-blocks">'+
    spBlock(1,'患者基础',b1)+
    spBlockWith(2,'肿瘤特征',b2,spTumorSwitch(e))+
    spBlock(3,'诊疗过程',b3)+
    spBlock(4,'随访与结局',b5)+
    '</div>';
  var exList=SP_EXAMS[e.id]||[],rfList=SP_REFERRALS[e.id]||[];
  var exP=spPanel('检查检验记录（'+exList.length+'条 · 点击查看结果）',spExamTable(e.id));
  var rfP=spPanel('转院就诊记录（'+rfList.length+'条）',spRefTable(e.id));
  var tl=spPanel('画像时间线',spTimeline(e));
  return '<div class="sp-detail-shell">'+head+blocks+exP+rfP+tl+'</div>';
}


/* ===================== 七、03 画像配置 ===================== */
var _spCfgTab='elem';
var SP_CFG_TABS=[{key:'elem',label:'画像要素'},{key:'rule',label:'映射规则'},{key:'nlp',label:'NLP 提取'},{key:'ver',label:'版本与归档'}];

/* 覆盖判定字段库：新增要素时从下拉选择，覆盖率按数据实时计算 */
var SP_ELEM_FIELD_MAP=[
 {key:'sex',name:'性别',fn:function(e){return e.sex}},
 {key:'age',name:'年龄（分层变量）',fn:function(e){return e.age}},
 {key:'region',name:'户籍地/区县（聚合维度）',fn:function(e){return e.region}},
 {key:'hospital',name:'就诊机构（聚合维度）',fn:function(e){return e.hospital}},
 {key:'insurance',name:'医保类型',fn:function(e){return e.insurance}},
 {key:'screen',name:'筛查参与',fn:function(e){return e.screenDate||e.screenType}},
 {key:'screentype',name:'筛查方式',fn:function(e){return e.screenType}},
 {key:'screendate',name:'筛查时间',fn:function(e){return e.screenDate}},
 {key:'screenresult',name:'筛查结果',fn:function(e){return e.screenResult}},
 {key:'screenadvice',name:'筛查建议',fn:function(e){return e.screenAdvice}},
 {key:'site_path',name:'原发部位、病理类型（瘤种分层）',fn:function(e){return e.laterality&&e.path}},
 {key:'icd10',name:'ICD-10',fn:function(e){return spTopoCode(e)}},
 {key:'icdo3topo',name:'ICD-O-3 部位码',fn:function(e){return spTopoCode(e)}},
 {key:'icdo3morph',name:'ICD-O-3 形态码',fn:function(e){return spMorphCode(e)}},
 {key:'stage',name:'临床分期、TNM（早晚期占比）',fn:function(e){return e.stage&&e.tNm}},
 {key:'diagdate',name:'确诊日期（时间类指标起点）',fn:function(e){return e.diagDate}},
 {key:'grade',name:'分级（分化程度）',fn:function(e){return e.grade}},
 {key:'diag_basis',name:'诊断依据',fn:function(e){return spMorphCode(e)}},
 {key:'modes',name:'治疗方式分项（手术/放疗/化疗）',fn:function(e){return e.treatments&&e.treatments.length}},
 {key:'mdt',name:'MDT（开展率）',fn:function(e){return e.mdt!==undefined}},
 {key:'tfirst',name:'首次治疗日期（治疗及时性）',fn:function(e){return e.treatments&&e.treatments.length}},
 {key:'referral',name:'是否发生转诊',fn:function(e){return e.referral!==undefined}},
 {key:'vital',name:'生存状态',fn:function(e){return e.vitalStatus}},
 {key:'lastfu',name:'末次随访日期（失访率）',fn:function(e){return e.lastFu}},
 {key:'survival',name:'生存时间（自动推算）',fn:function(e){return spSurvival(e).n!==null}},
 {key:'death',name:'死亡原因',fn:function(e){return e.vitalStatus!=='死亡'||!!e.deathCause}}
];
function spFieldFn(fkey){var f=SP_ELEM_FIELD_MAP.filter(function(x){return x.key===fkey})[0];return f?f.fn:function(){return true};}
var SP_DIMS=['患者基础','肿瘤特征','诊疗过程','随访与结局'];
var SP_SOURCES=['登记报告卡','筛查管理数据','病理报告数据','TNM分期质控','病案首页数据','MDT与转诊管理','随访管理数据','随访与死亡登记','医保结算数据'];

/* 画像要素元数据（工作副本：可新增/编辑/启停） */
var _spElements=[
 {id:'PE01',dim:'患者基础',name:'性别',src:'登记报告卡',fkey:'sex',on:true},
 {id:'PE02',dim:'患者基础',name:'年龄（分层变量）',src:'登记报告卡',fkey:'age',on:true},
 {id:'PE03',dim:'患者基础',name:'户籍地（聚合维度）',src:'登记报告卡',fkey:'region',on:true},
 {id:'PE04',dim:'患者基础',name:'就诊机构（聚合维度）',src:'登记报告卡',fkey:'hospital',on:true},
 {id:'PE05',dim:'患者基础',name:'医保类型',src:'医保结算数据',fkey:'insurance',on:true},
 {id:'PE06',dim:'患者基础',name:'筛查参与',src:'筛查管理数据',fkey:'screen',on:true},
 {id:'PE07',dim:'患者基础',name:'筛查方式',src:'筛查管理数据',fkey:'screentype',on:true},
 {id:'PE08',dim:'患者基础',name:'筛查时间',src:'筛查管理数据',fkey:'screendate',on:true},
 {id:'PE09',dim:'患者基础',name:'筛查结果',src:'筛查管理数据',fkey:'screenresult',on:true},
 {id:'PE10',dim:'患者基础',name:'筛查建议',src:'筛查管理数据',fkey:'screenadvice',on:true},
 {id:'DE01',dim:'肿瘤特征',name:'原发部位、病理类型（瘤种分层）',src:'病理报告数据',fkey:'site_path',on:true},
 {id:'DE01a',dim:'肿瘤特征',name:'ICD-10',src:'登记报告卡',fkey:'icd10',on:true},
 {id:'DE01b',dim:'肿瘤特征',name:'ICD-O-3 部位码',src:'登记报告卡',fkey:'icdo3topo',on:true},
 {id:'DE01c',dim:'肿瘤特征',name:'ICD-O-3 形态码',src:'病理报告数据',fkey:'icdo3morph',on:true},
 {id:'DE02',dim:'肿瘤特征',name:'临床分期、TNM（早晚期占比）',src:'TNM分期质控',fkey:'stage',on:true},
 {id:'DE03',dim:'肿瘤特征',name:'确诊日期（时间类指标起点）',src:'登记报告卡',fkey:'diagdate',on:true},
 {id:'DE04',dim:'肿瘤特征',name:'分级',src:'登记报告卡',fkey:'grade',on:true},
 {id:'DE05',dim:'肿瘤特征',name:'诊断依据',src:'登记报告卡',fkey:'diag_basis',on:true},
 {id:'TR02',dim:'诊疗过程',name:'治疗方式分项（手术/放疗/化疗）',src:'病案首页数据',fkey:'modes',on:true},
 {id:'TR03',dim:'诊疗过程',name:'MDT（开展率）',src:'MDT与转诊管理',fkey:'mdt',on:true},
 {id:'TR04',dim:'诊疗过程',name:'首次治疗日期（治疗及时性）',src:'病案首页数据',fkey:'tfirst',on:true},
 {id:'TR05',dim:'诊疗过程',name:'是否发生转诊',src:'MDT与转诊管理',fkey:'referral',on:true},
 {id:'FU01',dim:'随访与结局',name:'生存状态',src:'随访与死亡登记',fkey:'vital',on:true},
 {id:'FU02',dim:'随访与结局',name:'末次随访日期（失访率）',src:'随访管理数据',fkey:'lastfu',on:true},
 {id:'FU06',dim:'随访与结局',name:'生存时间（自动推算）',src:'随访与死亡登记',fkey:'survival',on:true},
 {id:'FU07',dim:'随访与结局',name:'死亡原因',src:'随访与死亡登记',fkey:'death',on:true}
];
/* 画像维度映射规则（工作副本） */
var _spMapRules=[
 {id:'MR01',dim:'患者基础',input:'身份证号',out:'脱敏主索引 + 出生日期',logic:'主索引复用登记报告卡后8位口径；出生日期取身份证7–14位；年龄由系统按当前日期推导，不双写',on:true},
 {id:'MR02',dim:'患者基础',input:'性别 + 医保类型 + 区县/机构',out:'人群属性分组',logic:'按区县 × 机构层级 × 医保类型自动归组',on:true},
 {id:'MR03',dim:'肿瘤特征',input:'发病部位 + 病理类型',out:'ICD-10 / ICD-O-3 编码',logic:'由部位文本映射 ICD-O-3 部位码，再截主码为 ICD-10；形态学由病理类型映射四位码 + 行为位 /3',on:true},
 {id:'MR04',dim:'肿瘤特征',input:'临床分期 + 分期确认日期',out:'早晚期分层',logic:'I/II期 → 早期；IV期 → 晚期；分期确认日期须早于首次治疗日期',on:true},
 {id:'MR06',dim:'诊疗过程',input:'治疗明细（方式 + 起止日期）',out:'最近一次治疗',logic:'取执行到最后一天（end 优先，其次 start/date）的一条作为最近一次治疗；手术为单日期，放化疗为起止区间',on:true},
 {id:'MR07',dim:'诊疗过程',input:'治疗方式组合',out:'治疗模式分类',logic:'≥2种方式 → 综合治疗；含靶向/免疫 → 精准治疗',on:true},
 {id:'MR08',dim:'诊疗过程',input:'治疗明细 + 治疗状态 + 生存状态',out:'累计治疗线数（推算值）',logic:'按治疗明细条数计基础线数；治疗状态含二线/三线关键词时递增',on:true},
 {id:'MR09',dim:'诊疗过程',input:'治疗明细（各方式最早起始日）',out:'首次治疗日期（推算值）',logic:'取全部治疗方式中最早的起始日，不手工录入',on:true},
 {id:'MR09',dim:'随访与结局',input:'末次随访日期 + 生存状态',out:'随访状态结论',logic:'失访标记 → 失访率分母',on:true},
 {id:'MR10',dim:'随访与结局',input:'RECIST 评价 + 评价日期',out:'疾病状态',logic:'CR/PR/SD/PD 四分类，与评价日期成对展示',on:true},
 {id:'MR11',dim:'随访与结局',input:'ECOG + 评估日期',out:'体能状态分层',logic:'ECOG ≥2 判为需重点关注，参与状态稳定度判定',on:true},
 {id:'MR12',dim:'随访与结局',input:'确诊日期 + 死亡日期/末次随访',out:'生存时间',logic:'自动推算：死亡取确诊→死亡月数；存活取确诊→末次随访月数',on:true},
 {id:'MR13',dim:'指标汇总',input:'患者画像全量字段',out:'省/市/院/病种聚合指标',logic:'按行政区划、机构、瘤种三维实时聚合',on:true}
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
var SP_CHECKS=[
 {id:'R001',name:'临床分期/分期确认日期缺失',run:function(){var bad=tumorEvents.filter(function(e){return !e.stage||!e.stageDate});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient}).join('、'):'全部患者分期及确认日期完整'}}},
 {id:'R002',name:'形态学 ICD-O-3 无法编码',run:function(){var bad=tumorEvents.filter(function(e){return !spMorphCode(e)});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient+'（'+e.path+'）'}).join('、'):'全部患者形态学可编码'}}},
 {id:'R003',name:'原发部位 ICD-10 无法编码',run:function(){var bad=tumorEvents.filter(function(e){return !spTopoCode(e)});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient+'（'+e.site+'）'}).join('、'):'全部患者部位可编码'}}},
 {id:'R004',name:'诊断依据缺失',run:function(){var bad=tumorEvents.filter(function(e){return !e.diagBasis});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient}).join('、'):'诊断依据齐全'}}},
 {id:'R006',name:'治疗方式缺失',run:function(){var bad=tumorEvents.filter(function(e){return !e.treatMode||!e.treatMode.length});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient}).join('、'):'全部患者均有治疗记录'}}},
 {id:'R007',name:'首次治疗日期缺失（无法算治疗及时性）',run:function(){var bad=tumorEvents.filter(function(e){return !spFirstTreat(e)});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient}).join('、'):'全部患者首次治疗日期可推算'}}},
 {id:'R008',name:'治疗日期倒挂（首次治疗早于确诊/分期确认）',run:function(){var bad=tumorEvents.filter(function(e){return (e.tConfirm&&e.tTreat&&e.tConfirm>e.tTreat)||(e.stageDate&&e.tTreat&&e.stageDate>e.tTreat)});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient+'（首次治疗'+e.tTreat+'）'}).join('、'):'确诊/分期确认均不晚于首次治疗'}}},
 {id:'R009',name:'疾病状态未评价（RECIST）',run:function(){var bad=tumorEvents.filter(function(e){return !e.recist||!e.recistDate});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient}).join('、'):'全部患者均有 RECIST 评价及日期'}}},
 {id:'R010',name:'ECOG 体能评分缺失',run:function(){var bad=tumorEvents.filter(function(e){return !e.physical||!e.ecogDate});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient}).join('、'):'ECOG 及评估日期齐全'}}},
 {id:'R011',name:'末次随访超90天未更新',run:function(){var bad=tumorEvents.filter(function(e){return e.followStatus==='随访中'&&e.lastFu<'2026-06-13'});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient+'（'+e.lastFu+'）'}).join('、'):'随访更新及时'}}},
 {id:'R012',name:'死亡日期/原因未填写',run:function(){var bad=tumorEvents.filter(function(e){return e.vitalStatus==='死亡'&&(!e.deathDate||!e.deathCause)});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient}).join('、'):'死亡日期与原因均已登记'}}},
 {id:'R013',name:'生存时间无法推算',run:function(){var bad=tumorEvents.filter(function(e){return spSurvival(e).n===null});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient}).join('、'):'全部患者生存时间可自动推算'}}}
];
var _spCheckTime='2026-09-11 08:30';
var SP_ELEM_CHECK={stage:'R001',site_path:'R002',diag_basis:'R004',modes:'R006',tfirst:'R007',lastfu:'R011',death:'R012',survival:'R013'};
function spCheck(id){return SP_CHECKS.filter(function(c){return c.id===id})[0];}
/* 画像版本：含变更明细 */
var SP_VERSIONS=[
  {v:'V13.0',time:'2026-10-25',by:'管理员',desc:'患者群体总览统计口径修订与原型同步优化',cur:true,changes:[
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
window._spSetDomain=function(d){
  _spDomain=d;
  var body=document.getElementById('spDomainBody');
  if(body){
    var list=spScopeEvents(_spScope);
    body.innerHTML=spDomainPanel(list,spAgg(list),spSiteRows(list),spCityRows(list));
    var tabs=document.querySelectorAll('#spMainContent .sp-domain-tab');
    for(var i=0;i<tabs.length;i++){
      if(tabs[i].getAttribute('onclick').indexOf("'"+d+"'")>=0)tabs[i].classList.add('active');
      else tabs[i].classList.remove('active');
    }
    /* 滚动定位到 Tab 行：点击后既能看到激活的 Tab 又能看到面板内容 */
    var tabsBox=document.querySelector('#spMainContent .sp-domain-tabs');
    (tabsBox||body).scrollIntoView({block:'start',behavior:'smooth'});
  }
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
  _wbFilters={q:'',site:_spScope.site,stage:'',city:_spScope.city,hospital:'',fu:''};
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
  _wbFilters={q:g('spWbQ'),site:g('spWbSite'),stage:g('spWbStage'),city:g('spWbCity'),hospital:g('spWbHospital'),fu:g('spWbFu'),mp:g('spWbMp')};
  spRefresh();
};
window._spWbReset=function(){
  _wbOverviewSelection=null;_wbFilters={q:'',site:'',stage:'',city:'',hospital:'',fu:'',mp:''};spRefresh();
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
if(window.__SP_TEST__){window.__SP_TEST__={tumorEvents:function(){return tumorEvents},spDetailPage:function(e){return spDetailPage(e)},spProfileCompleteness:function(e){return spProfileCompleteness(e)},spDiagBasisType:function(e){return spDiagBasisType(e)},spGradeText:function(e){return spGradeText(e)},_spElements:function(){return _spElements},SP_ELEM_CHECK:function(){return SP_ELEM_CHECK},SP_ELEM_FIELD_MAP:function(){return SP_ELEM_FIELD_MAP},spFieldFn:function(k){return spFieldFn(k)},spCheck:function(id){return spCheck(id)}};}
})();
