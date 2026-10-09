/* 肿瘤专科画像 V8 — 患者画像 / 指标汇总 / 配置质控 三层架构
   01 患者专科画像：四维画像（患者基础/肿瘤特征/诊疗过程/随访与结局）+ 画像时间线
      患者基础：脱敏主索引、出生日期（年龄由系统推导，不双写）、性别、医保类型、区县+机构层级
      肿瘤特征：原发部位 ICD-10、形态学 ICD-O-3、诊断依据、临床分期+分期确认日期、
                分子标志物（项目名+结果+检测日期三要素，缺一不可）
      诊疗过程：MDT、首次治疗日期、确诊→首次治疗、是否发生转诊、治疗方式（手术/放疗/化疗）
      随访与结局：末次随访日期、生存状态、疾病状态（RECIST+评价日期）、
                  ECOG+评估日期、死亡日期/原因
      派生规则：ICD-O-3 部位码/形态学码由部位与病理文本自动映射，ICD-10 取部位码主码；
               出生日期由身份证号 7–14 位推导；治疗线数由"方案+起止日期"记录推算；
               生存时间由确诊日期与死亡/末次随访日期自动推算。以上均不额外采集。
      注：被移出画像的字段（既往史、吸烟饮酒、家族史、分化程度、多原发、
          住院次数天数费用、TNM 独立项等）数据仍保留在患者记录中，
          供患者列表与指标汇总页使用；详见版本 V8.0 变更记录。
   02 群体专科画像：按肿瘤防治链条（cancer care continuum）读人群——个体读"值"，群体读"一条防治链上哪一环在掉人、掉多少"
      页面顺序：范围筛选 → 一句话摘要（口语化归纳 + 自动挑偏离最大的短板）→
      链条节点指标带（8 项，带 vs 全省同瘤种基准差值）→ 防治链条级联漏斗（逐环累积达标、标环间流失）→
      五段 Tab → 重点问题闭环
      五段 Tab（防治链条）：① 疾病负担（人群/瘤谱/分期，性别唯一出处=年龄金字塔）
        ② 早期发现（筛查/早诊率/地区病种差异，分期饼归段①不重复）
        ③ 规范诊疗（确诊/时效/MDT/治疗模式）④ 生存结局（随访/生存/复发死亡）
        ⑤ 资源与公平（地图/就医流向/费用，地理与费用图唯一归此段）
      全省→地市→病种聚合，每个数字可下钻，「查看」带筛选条件回跳板块01患者列表
      指标唯一归属见同目录《群体专科画像_重构方案.md》第六节
      患者列表列：患者/性别/年龄/户籍地市/就诊医院/瘤种/部位/病理/分期/治疗方式/随访状态
   03 画像配置：要素元数据 / 映射规则 / 智能校验 / 质控报告 / 预警 / 版本 / 归档
   全部指标由患者画像字段实时聚合，不重复采集数据 */
(function(){ 'use strict';
var SP_BUILD='V12.4-blocksplit@20261001a';
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
.sp-patient-strip{display:grid;grid-template-columns:auto minmax(240px,1.25fr) minmax(300px,1fr) auto;align-items:center;gap:14px;padding:12px 16px;margin-bottom:14px;background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:var(--shadow-xs)}
.sp-patient-avatar{width:42px;height:42px;border-radius:50%;background:var(--color-primary-soft);color:var(--color-primary);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700}
.sp-patient-name{display:flex;align-items:baseline;gap:10px;min-width:0;font-size:var(--fs-h2);font-weight:700;color:var(--color-text-title);flex-wrap:wrap}
.sp-patient-meta{font-size:var(--fs-xs);font-weight:500;color:var(--color-text-muted);white-space:nowrap}
.sp-patient-sub{margin-top:3px;font-size:var(--fs-xs);color:var(--color-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-patient-score{text-align:right;min-width:50px}
.sp-patient-score .k{font-size:var(--fs-2xs);color:var(--color-text-muted)}
.sp-patient-score .v{font-size:24px;font-weight:700;font-family:var(--font-num);color:var(--color-primary);line-height:1.05}
.sp-profile-blocks{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:16px}
.sp-profile-block{background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:var(--shadow-xs);min-width:0}
.sp-block-head{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--color-border);flex-wrap:wrap}
.sp-block-idx{width:22px;height:22px;border-radius:6px;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex:0 0 22px}
.sp-block-title{font-size:var(--fs-body);font-weight:700;color:var(--color-text-title)}
.sp-block-tags{margin-left:auto;display:flex;gap:5px;flex-wrap:wrap}
.sp-block-body{padding:12px 14px}
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
.sp-hot{display:inline-block;font-size:10px;line-height:14px;color:var(--color-primary);border:1px solid var(--color-primary);border-radius:4px;padding:0 4px;margin-left:6px;vertical-align:1px;white-space:nowrap}
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

var tumorEvents=[
{id:'TE001',patient:'陈建国',sex:'男',age:63,idNo:'360102196305121234',region:'南昌市东湖区',city:'南昌市',insurance:'职工医保',firstHosp:'东湖区董家窑街道社区卫生服务中心',firstDate:'2026-01-18',hospital:'南昌市第一医院',
 site:'肺',laterality:'右肺上叶',path:'腺癌',grade:'中分化',tNm:'cT2aN2M0',stage:'III期',stageDate:'2026-01-28',multiPrimary:false,
 treatMode:['手术','化疗'],mdt:true,
 symptom:'偶有干咳',pain:'轻度疼痛',nutrition:'中度营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'I度骨髓抑制',rehab:'康复中',supportive:'营养支持',
 lastFu:'2026-08-25',followStatus:'随访中',vitalStatus:'存活',deathCause:'',lostFollow:false,pastHistory:'高血压 8 年、2 型糖尿病 5 年',smoke:'吸烟 30 年，20 支/日（未戒）',drink:'偶饮酒',family:'父亲患肺癌',diagBasis:'胸部 CT 增强 + 经皮肺穿刺病理 + 免疫组化',diagDate:'2026-02-02',tConfirm:'2026-02-02',metastasis:'区域淋巴结转移',treatMode:['手术','化疗'],referral:true,curPhase:'辅助化疗中',phaseTimeline:'手术(2026-02-05)→辅助化疗中(第3/6周期)',tFirst:'2026-01-18',tTreat:'2026-02-05',admCount:5,admDays:26,marker:'EGFR 19del 阳性；TTF-1(+)；PD-L1 TPS 35%',recurrence:false,recist:'SD',screenType:"低剂量螺旋 CT 肺癌筛查",screenDate:"2025-11-20",screenResult:"右肺上叶结节 8mm",screenAdvice:"建议年度复查 CT，必要时穿刺活检",treatments:[{"mode":"手术","date":"2026-02-05","end":"2026-02-12","plan":"右肺上叶切除术 + 系统性淋巴结清扫","note":"术后病理 pT2aN2M0"},{"mode":"化疗","start":"2026-03-01","end":"2026-06-20","plan":"培美曲塞 + 顺铂（辅助化疗 4 周期）","note":"末次给药 2026-06-20，第 3/6 周期随访中"}],markerDate:'2026-02-02',recistDate:'2026-08-20',ecogDate:'2026-08-20',metaProgress:'无',diseaseProgress:false},
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
 {d:'2026-01-19',k:'检查',n:'胸部DR',org:'东湖区董家窑街道社区卫生服务中心',r:'右上肺结节样影，建议CT进一步明确',abn:true,
  j:'两肺纹理增粗，右上肺野近锁骨下区见约3.2cm×2.7cm结节样密度增高影，边界欠清；心影大致正常，肋膈角锐利。',
  y:'右上肺结节影，性质待定，建议胸部增强CT检查。'},
 {d:'2026-01-28',k:'检查',n:'胸部CT增强',org:'南昌市第一医院',r:'右上肺占位考虑恶性；右肺门及纵隔淋巴结转移',abn:true,hot:true,
  j:'右上叶后段见约3.4cm×2.8cm不规则软组织密度影，分叶伴毛刺，不均匀强化；右肺门及4R、7组淋巴结增大，短径最大1.6cm；胸膜未见种植结节，双侧肾上腺及骨质未见异常。',
  y:'右上肺占位，考虑周围型肺癌；右肺门及纵隔淋巴结转移（cN2）；未见明确远处转移。'},
 {d:'2026-02-02',k:'检验',n:'CT引导经皮肺穿刺·病理',org:'南昌市第一医院',r:'浸润性腺癌（中分化），EGFR 19del阳性',abn:true,hot:true,
  j:'大体：穿刺组织4条，长0.8~1.5cm。镜下：腺癌组织，中分化。',
  y:'（右上肺穿刺）浸润性腺癌，中分化。免疫组化：TTF-1(+)，NapsinA(+)，CK7(+)，Ki-67(约20%+)。基因检测：EGFR 19外显子缺失突变阳性。'},
 {d:'2026-02-03',k:'检验',n:'肿瘤标志物（肺癌组合）',org:'南昌市第一医院',r:'CEA 18.6↑，CYFRA21-1 9.3↑',abn:true,
  items:[['CEA','18.6','ng/mL','0~5.0','↑'],['CYFRA21-1','9.3','ng/mL','0~3.3','↑'],['NSE','14.1','ng/mL','0~16.3',''],['SCC','1.0','ng/mL','0~1.5',''],['ProGRP','48','pg/mL','0~65','']],
  y:'CEA、CYFRA21-1显著升高，与肺占位性质相符，已留作疗效监测基线。'},
 {d:'2026-06-18',k:'检查',n:'头颅MRI增强+全身骨显像',org:'南昌市第一医院',r:'未见脑转移及骨转移征象（M0）',abn:false,hot:true,
  j:'双侧大脑、小脑及脑干未见异常强化灶；静注99mTc-MDP 3小时后全身骨显像未见异常放射性浓聚或稀疏区。',
  y:'未见脑及骨转移征象，完善分期：cT2aN2M0（III期）。'},
 {d:'2026-08-20',k:'检验',n:'血常规+生化（化疗第3周期前）',org:'南昌市第一医院',r:'WBC 3.2↓，PLT 98↓，ALT 56↑，Ⅰ度骨髓抑制',abn:true,
  items:[['白细胞','3.2','×10⁹/L','3.5~9.5','↓'],['中性粒细胞绝对值','1.6','×10⁹/L','1.8~6.3','↓'],['血红蛋白','118','g/L','130~175','↓'],['血小板','98','×10⁹/L','125~350','↓'],['丙氨酸氨基转移酶','56','U/L','9~50','↑'],['肌酐','68','μmol/L','57~97','']],
  y:'Ⅰ度骨髓抑制伴轻度肝功能损害，予保肝升白治疗后按期进入第3周期辅助化疗。'}],
TE002:[
 {d:'2026-03-20',k:'检查',n:'乳腺钼靶（双侧）',org:'章贡区南外街道社区卫生服务中心',r:'左乳结节伴簇状钙化，BI-RADS 5',abn:true,
  j:'左乳外上象限见约2.5cm×2.0cm高密度结节影，边缘毛刺，伴簇状细小钙化；双乳背景腺体c型。',
  y:'左乳外上象限占位伴簇状钙化，BI-RADS 5，建议穿刺活检。'},
 {d:'2026-03-25',k:'检查',n:'乳腺及腋窝淋巴结彩超',org:'江西省肿瘤医院',r:'左乳实性占位；左腋窝异常淋巴结，考虑转移',abn:true,hot:true,
  j:'左乳外上象限低回声结节2.6cm×1.9cm，形态不规则、边界毛刺、纵横比>1，CDFI血流2级；左腋窝见4枚皮质增厚淋巴结，最大短径1.4cm。',
  y:'左乳占位 BI-RADS 5；左腋窝淋巴结异常，考虑转移（cN1）。'},
 {d:'2026-03-27',k:'检验',n:'左乳肿块空芯针穿刺·病理',org:'江西省肿瘤医院',r:'浸润性导管癌（II级），Luminal B型（HER2阴性）',abn:true,hot:true,
  j:'大体：穿刺组织6条。镜下：浸润性导管癌，II级。',
  y:'（左乳）浸润性导管癌，II级。ER(约80%+)，PR(约60%+)，HER2(2+，FISH阴性)，Ki-67(约15%+)。分子分型：Luminal B型（HER2阴性）。'},
 {d:'2026-08-22',k:'检验',n:'血常规+肿瘤标志物（化疗结束后）',org:'江西省肿瘤医院',r:'血象恢复，CA15-3、CEA均在参考范围内',abn:false,
  items:[['白细胞','4.3','×10⁹/L','3.5~9.5',''],['中性粒细胞绝对值','2.4','×10⁹/L','1.8~6.3',''],['CA15-3','18.6','U/mL','0~25.0',''],['CEA','3.2','ng/mL','0~5.0','']],
  y:'化疗结束后血象恢复，肿瘤标志物正常，进入内分泌维持治疗阶段。'}],
TE003:[
 {d:'2026-07-09',k:'检查',n:'胃镜+活检',org:'九江市第一人民医院',r:'胃窦溃疡浸润型占位；病理：低分化腺癌',abn:true,hot:true,
  j:'胃窦见约4.5cm×3.8cm不规则溃疡型病变，覆白苔，边缘堤样隆起，质脆易出血，幽门变形、腔隙狭窄，活检6块。',
  y:'胃窦占位（溃疡浸润型），活检：低分化腺癌。'},
 {d:'2026-07-10',k:'检查',n:'全腹CT增强（分期）',org:'九江市第一人民医院',r:'胃窦壁增厚；腹膜多发结节伴少量腹水，考虑腹膜转移',abn:true,hot:true,
  j:'胃窦壁不均匀增厚最厚约2.1cm，浆膜面模糊；大网膜及腹膜见多发结节样增厚，最大1.2cm；盆腔少量积液；肝脾未见占位，腹膜后未见明显肿大淋巴结。',
  y:'胃窦癌伴腹膜多发转移、少量腹水，分期cT4aN2M1（IV期）。'},
 {d:'2026-07-11',k:'检验',n:'肿瘤标志物组合',org:'九江市第一人民医院',r:'CEA 46.2↑，CA19-9 385.6↑',abn:true,
  items:[['CEA','46.2','ng/mL','0~5.0','↑'],['CA19-9','385.6','U/mL','0~27.0','↑'],['CA72-4','41.2','U/mL','0~6.9','↑'],['AFP','3.8','ng/mL','0~7.0','']],
  y:'CEA、CA19-9显著升高，作为姑息化疗疗效监测基线。'},
 {d:'2026-08-24',k:'检验',n:'血常规+生化（姑息化疗第3周期前）',org:'九江市第一人民医院',r:'Hb 92↓，Alb 31.2↓，中度贫血伴低蛋白血症',abn:true,
  items:[['血红蛋白','92','g/L','130~175','↓'],['白蛋白','31.2','g/L','40.0~55.0','↓'],['前白蛋白','128','mg/L','200~430','↓'],['钾','3.6','mmol/L','3.5~5.3',''],['肌酐','64','μmol/L','57~97','']],
  y:'肿瘤消耗合并不全肠梗阻摄入不足，中度贫血、低蛋白血症，NRS2002评分4分，加强肠外营养支持。'}],
TE004:[
 {d:'2026-02-18',k:'检查',n:'上腹部MRI增强（肝胆特异对比剂）',org:'上饶市肿瘤医院',r:'右肝后叶占位5.2cm，快进快出，考虑肝细胞癌',abn:true,hot:true,
  j:'肝右叶后段(S6/7)见约5.2cm×4.6cm类圆形异常信号，T1WI稍低、T2WI稍高，动脉期明显不均匀强化，门脉期廓清，DWI受限；余肝信号不均提示肝纤维化；未见子灶及门脉癌栓。',
  y:'右肝后叶占位符合肝细胞癌（LI-RADS 5）；肝硬化背景；未见肝内子灶及血管侵犯。'},
 {d:'2026-02-19',k:'检验',n:'肿瘤标志物+乙肝病毒学+肝功能',org:'上饶市肿瘤医院',r:'AFP 412.5↑↑，HBV-DNA 2.3×10⁴↑，Alb 34.0↓',abn:true,
  items:[['甲胎蛋白(AFP)','412.5','ng/mL','0~7.0','↑'],['异常凝血酶原(DCP)','156','ng/mL','0~40','↑'],['乙肝表面抗原(HBsAg)','阳性','','阴性','+'],['HBV-DNA','2.3×10⁴','IU/mL','低于检测下限','↑'],['白蛋白','34.0','g/L','40.0~55.0','↓'],['总胆红素','18.6','μmol/L','3.4~17.1','↑']],
  y:'AFP、DCP显著升高支持肝癌诊断；HBV复制活跃，已加用恩替卡韦抗病毒；肝功能Child-Pugh A级(6分)。'},
 {d:'2026-03-06',k:'检验',n:'肝部分切除术后·病理',org:'上饶市肿瘤医院',r:'肝细胞癌（中分化），MVI M1，切缘阴性',abn:true,hot:true,
  j:'大体：距肝切缘1.0cm见6.0cm×5.2cm灰红色肿物，质脆。镜下：中分化肝细胞癌，梁索状结构。',
  y:'（右肝）肝细胞癌，中分化，伴微血管侵犯（MVI M1，低危组），切缘阴性，背景肝硬化。术后分期pT3N0M0（III期）。'},
 {d:'2026-07-18',k:'检查',n:'TACE术后CT增强复查',org:'上饶市肿瘤医院',r:'碘油沉积密实，未见活性强化灶，疗效CR',abn:false,hot:true,
  j:'原S6/7瘤灶区碘油沉积密实，动脉期及门脉期未见异常强化残留灶；余肝脏未见新发占位；无新增腹水。',
  y:'TACE后改变，瘤灶坏死完全（mRECIST CR），继续定期随访。'},
 {d:'2026-07-20',k:'检验',n:'AFP复查',org:'上饶市肿瘤医院',r:'AFP 6.8，降至正常',abn:false,
  items:[['甲胎蛋白(AFP)','6.8','ng/mL','0~7.0',''],['异常凝血酶原(DCP)','38','ng/mL','0~40','']],
  y:'术后联合TACE治疗后AFP降至参考范围内，生化指标有效。'}],
TE005:[
 {d:'2026-04-14',k:'检查',n:'胸部CT增强',org:'宜春市人民医院',r:'左肺下叶占位3.1cm；左肺门淋巴结增大',abn:true,hot:true,
  j:'左肺下叶背段见约3.1cm×2.6cm类圆形实性占位，边界模糊，中度不均匀强化；左肺门见1.5cm肿大淋巴结，4R组淋巴结增大。',
  y:'左肺下叶占位考虑恶性，伴肺门及纵隔淋巴结转移（cT2bN2M0）。'},
 {d:'2026-04-17',k:'检查',n:'支气管镜+活检',org:'宜春市人民医院',r:'左下叶支气管新生物；病理：鳞状细胞癌',abn:true,hot:true,
  j:'镜下：左下叶支气管开口见息肉样新生物，表面坏死渗出，管腔狭窄，活检6块。',
  y:'左下叶支气管恶性肿瘤，活检：中分化鳞状细胞癌（p40+，CK5/6+）。'},
 {d:'2026-05-08',k:'检验',n:'术前组合（血象+凝血+标志物）',org:'宜春市人民医院',r:'SCC 6.8↑，CYFRA21-1 8.2↑；血象凝血正常',abn:true,
  items:[['SCC','6.8','ng/mL','0~1.5','↑'],['CYFRA21-1','8.2','ng/mL','0~3.3','↑'],['白细胞','5.8','×10⁹/L','3.5~9.5',''],['血小板','210','×10⁹/L','125~350',''],['凝血四项','未见异常','','','']],
  y:'鳞癌相关标志物升高；术前血象、凝血正常，符合手术条件，2026-05-10行左下叶袖式切除。'},
 {d:'2026-08-28',k:'检验',n:'血常规（同步放化疗第4周期前）',org:'宜春市人民医院',r:'WBC 2.9↓，Hb 108↓，Ⅱ度骨髓抑制',abn:true,
  items:[['白细胞','2.9','×10⁹/L','3.5~9.5','↓'],['中性粒细胞绝对值','1.4','×10⁹/L','1.8~6.3','↓'],['血红蛋白','108','g/L','130~175','↓'],['血小板','112','×10⁹/L','125~350','↓'],['前白蛋白','186','mg/L','200~430','↓']],
  y:'放化疗相关Ⅱ度骨髓抑制，合并Ⅱ度放射性食管炎进食减少，暂停本周期，G-CSF及营养支持后复评。'}],
TE006:[
 {d:'2026-05-06',k:'检验',n:'宫颈癌筛查（TCT+HPV）',org:'珠山区里村街道社区卫生服务中心',r:'TCT示HSIL；HPV16阳性；SCC 9.6↑',abn:true,hot:true,
  items:[['液基细胞学(TCT)','HSIL（高度鳞状上皮内病变）','','NILM','+'],['高危型HPV','HPV16阳性','','阴性','+'],['SCC','9.6','ng/mL','0~1.5','↑']],
  y:'细胞学HSIL伴HPV16感染、SCC升高，转诊阴道镜下定位活检。'},
 {d:'2026-05-09',k:'检验',n:'阴道镜下宫颈活检·病理',org:'景德镇市第一医院',r:'宫颈鳞状细胞癌（中-低分化）',abn:true,hot:true,
  j:'阴道镜下3、6、9、12点转化区醋酸白试验阳性、碘试验不着色，4点取组织。镜下：鳞状细胞癌，中-低分化。',
  y:'（宫颈）鳞状细胞癌，中-低分化；浸润深度约8mm，未见脉管侵犯。'},
 {d:'2026-05-11',k:'检查',n:'盆腔MRI增强',org:'景德镇市第一医院',r:'宫颈肿物3.6cm累及阴道上1/3；盆腔淋巴结可疑转移',abn:true,hot:true,
  j:'宫颈管内见约3.6cm×3.0cm T2WI稍高信号肿物，向下累及阴道上1/3，未达下1/3，宫旁脂肪间隙清晰；盆腔见2枚短径1.1cm淋巴结。',
  y:'宫颈癌，分期cT2bN1M0（II期）。'},
 {d:'2026-08-25',k:'检验',n:'血常规（放疗中期）',org:'景德镇市第一医院',r:'WBC 3.4↓，Ⅰ度骨髓抑制',abn:true,
  items:[['白细胞','3.4','×10⁹/L','3.5~9.5','↓'],['中性粒细胞绝对值','1.8','×10⁹/L','1.8~6.3',''],['血小板','132','×10⁹/L','125~350',''],['血红蛋白','112','g/L','115~150','↓']],
  y:'放疗期间Ⅰ度骨髓抑制，予升白对症治疗，按计划完成根治性外照射。'}],
TE007:[
 {d:'2026-06-22',k:'检查',n:'结肠镜+活检',org:'南昌市第一医院',r:'距肛门7cm溃疡型占位；病理：直肠腺癌（中分化）',abn:true,hot:true,
  j:'进镜8~10cm于直肠中上段见环腔生长溃疡型占位，表面污秽苔，质脆易出血，肠腔狭窄；活检8块；余结肠未见第二病灶。',
  y:'直肠中上段占位，活检：中分化腺癌。'},
 {d:'2026-06-24',k:'检查',n:'直肠高分辨MRI',org:'南昌市第一医院',r:'肿瘤突破固有肌层（T3），MRF阴性；可疑系膜淋巴结2枚',abn:true,hot:true,
  j:'直肠中上段壁不规则增厚并强化，最厚1.6cm，侵及浆膜下脂肪层（T3b）；直肠系膜筋膜(MRF)及脏层腹膜未受累；系膜内2枚形态不规则淋巴结（最大0.9cm）。',
  y:'直肠中分化腺癌 cT3N1M0（III期）；MRF(-)，经MDT讨论直接手术+术后辅助化疗。'},
 {d:'2026-06-25',k:'检验',n:'肿瘤标志物组合',org:'南昌市第一医院',r:'CEA 12.3↑，CA19-9 28.6↑',abn:true,
  items:[['CEA','12.3','ng/mL','0~5.0','↑'],['CA19-9','28.6','U/mL','0~27.0','↑'],['白细胞','5.4','×10⁹/L','3.5~9.5','']],
  y:'CEA明显升高，留作术后辅助化疗疗效监测基线。'},
 {d:'2026-09-03',k:'检验',n:'血常规+肝肾功能（辅助化疗第2周期前）',org:'南昌市第一医院',r:'血象及肝肾功能正常，按期化疗',abn:false,
  items:[['白细胞','4.1','×10⁹/L','3.5~9.5',''],['中性粒细胞绝对值','2.6','×10⁹/L','1.8~6.3',''],['血小板','186','×10⁹/L','125~350',''],['丙氨酸氨基转移酶','22','U/L','9~50','']],
  y:'第2周期XELOX方案辅助化疗前评估合格，按期治疗中。'}],
TE008:[
 {d:'2026-07-25',k:'检查',n:'乳腺钼靶（双侧）',org:'临川区青云街道社区卫生服务中心',r:'右乳肿块伴多发钙化，BI-RADS 5',abn:true,
  j:'右乳外上象限致密结节约3.0cm×2.4cm，边缘毛刺，伴多发簇状钙化；左乳未见明确病变。',
  y:'右乳占位 BI-RADS 5，建议穿刺活检。'},
 {d:'2026-07-28',k:'检验',n:'右乳肿块空芯针穿刺·病理',org:'江西省肿瘤医院',r:'浸润性导管癌（III级），HER2 3+（HER2过表达型）',abn:true,hot:true,
  j:'大体：穿刺组织5条，部分灰白质硬。镜下：浸润性导管癌，III级，核分裂活跃。',
  y:'（右乳）浸润性导管癌，III级。ER(约10%+)，PR(-)，HER2(3+)，Ki-67(约45%+)。分子分型：HER2过表达型。'},
 {d:'2026-07-28',k:'检查',n:'全身骨显像+上腹部CT增强',org:'江西省肿瘤医院',r:'右4-6肋、T12、L3骨转移；肝S7转移灶2.1cm',abn:true,hot:true,
  j:'ECT：右侧第4~6肋骨、T12及L3椎体见异常放射性浓聚。CT：肝S7见约2.1cm×1.8cm低密度灶，动脉期边缘轻度强化，延迟期近等密度，考虑转移；双肺未见明确结节。',
  y:'乳腺癌伴多发骨转移、肝转移，分期cT2N2M1（IV期）。'},
 {d:'2026-08-10',k:'检查',n:'心脏彩超（曲妥珠单抗基线）',org:'江西省肿瘤医院',r:'LVEF 58%，心功能正常',abn:false,hot:true,
  j:'各房室腔不大，二尖瓣轻度反流，LVEF 58%。',
  y:'基线心功能正常（LVEF≥50%），可启动抗HER2靶向治疗，每3个月复查心功能。'},
 {d:'2026-09-01',k:'检查',n:'胸腹盆CT疗效再评价',org:'江西省肿瘤医院',r:'原发灶及肝转移灶缩小，疗效评价PR',abn:false,hot:true,
  j:'右乳原发灶2.2cm×1.6cm（缩小约30%），肝S7病灶1.3cm（缩小约40%）；未见新发转移；骨转移灶范围无扩大。',
  y:'一线化疗+抗HER2靶向2周期，疗效评价部分缓解（PR），维持原方案。'}],
TE009:[
 {d:'2026-08-02',k:'检查',n:'上消化道钡餐',org:'吉安市中心医院',r:'食管中段狭窄伴6cm充盈缺损，考虑恶性',abn:true,
  j:'胸中段食管局限性狭窄，管壁僵硬，见约6cm不规则充盈缺损，黏膜破坏中断，近端食管轻度扩张。',
  y:'胸中段食管占位性病变伴狭窄，考虑食管癌。'},
 {d:'2026-08-05',k:'检查',n:'胃镜+活检',org:'吉安市中心医院',r:'胸中段食管缩窄型新生物；病理：鳞状细胞癌',abn:true,hot:true,
  j:'距门齿26~32cm见环周生长缩窄型新生物，表面溃烂覆白苔，管腔狭窄，镜身勉强通过；活检8块。',
  y:'胸中段食管鳞状细胞癌，中分化。'},
 {d:'2026-08-07',k:'检查',n:'胸部CT增强（分期）',org:'吉安市中心医院',r:'食管中段壁增厚1.8cm；隆突下淋巴结转移；无远处转移',abn:true,hot:true,
  j:'食管胸中段壁不均匀增厚最厚约1.8cm，与气管膜部脂肪间隙变窄但未见明确侵犯；隆突下及下段食管旁2枚短径1.3cm淋巴结；肝、肺、骨未见转移征象。',
  y:'食管中段癌 cT3N1M0（III期），无手术指征，MDT建议根治性同步放化疗。'},
 {d:'2026-09-06',k:'检验',n:'血常规+生化（同步放化疗第3周期）',org:'吉安市中心医院',r:'WBC 3.5↓，前白蛋白118↓，Ⅰ度骨髓抑制伴中度营养风险',abn:true,
  items:[['白细胞','3.5','×10⁹/L','3.5~9.5',''],['中性粒细胞绝对值','1.8','×10⁹/L','1.8~6.3',''],['前白蛋白','118','mg/L','200~430','↓'],['白蛋白','34.8','g/L','40.0~55.0','↓']],
  y:'Ⅱ度放射性食管炎伴经口摄入下降，中度营养风险，留置鼻饲管行肠内营养，同步放化疗继续。'}],
TE010:[
 {d:'2026-06-01',k:'检验',n:'宫颈癌筛查（TCT+HPV）',org:'临川区青云街道社区卫生服务中心',r:'TCT示ASC-H；HPV18阳性；SCC 7.4↑',abn:true,
  items:[['液基细胞学(TCT)','ASC-H（不除外高度病变）','','NILM','+'],['高危型HPV','HPV18阳性','','阴性','+'],['SCC','7.4','ng/mL','0~1.5','↑']],
  y:'细胞学异常伴HPV18感染、SCC升高，转诊阴道镜下活检。'},
 {d:'2026-06-04',k:'检验',n:'阴道镜下宫颈活检·病理',org:'抚州市第一医院',r:'宫颈鳞状细胞癌（中分化）',abn:true,hot:true,
  j:'醋酸白及碘试验不着色区取3点组织。镜下：中分化鳞状细胞癌。',
  y:'（宫颈）中分化鳞状细胞癌，浸润深度约9mm。'},
 {d:'2026-06-05',k:'检查',n:'盆腔MRI增强',org:'抚州市第一医院',r:'宫颈肿物3.8cm累及阴道上1/3；闭孔淋巴结增大',abn:true,hot:true,
  j:'宫颈见约3.8cm×3.2cm混杂信号肿物，累及阴道上1/3，右侧闭孔见短径1.2cm淋巴结，宫旁脂肪间隙清楚。',
  y:'宫颈癌 cT2bN1M0（II期）。'},
 {d:'2026-08-15',k:'检验',n:'血常规（辅助化疗第2周期前）',org:'抚州市第一医院',r:'WBC 3.5↓，Ⅰ度骨髓抑制',abn:true,
  items:[['白细胞','3.5','×10⁹/L','3.5~9.5',''],['中性粒细胞绝对值','1.8','×10⁹/L','1.8~6.3',''],['血小板','128','×10⁹/L','125~350','']],
  y:'轻度骨髓抑制，利可君口服对症处理后按期完成第2周期辅助化疗。'}],
TE011:[
 {d:'2026-05-19',k:'检查',n:'结肠镜+活检',org:'鹰潭市人民医院',r:'乙状结肠环周占位；病理：腺癌（中分化）',abn:true,hot:true,
  j:'距肛门25~32cm乙状结肠见环腔生长隆缩型病变，表面溃疡，肠腔狭窄；活检7块；余结直肠未见异常。',
  y:'乙状结肠癌（中分化腺癌）。'},
 {d:'2026-05-21',k:'检查',n:'胸腹盆CT增强（分期）',org:'鹰潭市人民医院',r:'乙状结肠壁增厚（T3）伴肠旁淋巴结；肝肺骨无转移',abn:true,hot:true,
  j:'乙状结肠壁不规则增厚最厚约1.5cm，浆膜面模糊，肠旁脂肪内3枚小淋巴结；肝、双肺、骨骼未见转移征象。',
  y:'乙状结肠癌 cT3N1M0（III期）。'},
 {d:'2026-08-28',k:'检验',n:'辅助化疗结束复查组合',org:'鹰潭市人民医院',r:'CEA 3.2正常，血象肝肾功能正常',abn:false,
  items:[['CEA','3.2','ng/mL','0~5.0',''],['CA19-9','12.4','U/mL','0~27.0',''],['白细胞','5.2','×10⁹/L','3.5~9.5',''],['血小板','204','×10⁹/L','125~350','']],
  y:'完成全部周期辅助化疗，标志物及血象正常，转入术后随访阶段。'}],
TE012:[
 {d:'2026-06-08',k:'检查',n:'乳腺彩超',org:'渝水区城北街道社区卫生服务中心',r:'左乳结节1.4cm，BI-RADS 5',abn:true,
  j:'左乳外上象限低回声结节1.4cm×1.0cm，形态不规则、边界毛刺，后方回声轻度衰减，血流2级。',
  y:'左乳结节 BI-RADS 5，建议穿刺活检。'},
 {d:'2026-06-12',k:'检验',n:'左乳结节穿刺·病理',org:'新余市人民医院',r:'浸润性导管癌（II级），Luminal A样',abn:true,hot:true,
  j:'大体：穿刺组织4条。镜下：浸润性导管癌，II级。',
  y:'（左乳）浸润性导管癌，II级。ER(约90%+)，PR(约70%+)，HER2(1-)，Ki-67(约10%+)。'},
 {d:'2026-06-18',k:'检验',n:'术前血常规+凝血',org:'新余市人民医院',r:'术前评估未见异常',abn:false,
  items:[['白细胞','5.6','×10⁹/L','3.5~9.5',''],['血红蛋白','124','g/L','115~150',''],['血小板','226','×10⁹/L','125~350',''],['凝血四项','未见异常','','','']],
  y:'术前评估合格，2026-06-20行保乳手术+前哨淋巴结活检。术后计划复查未见记录。'}],
TE013:[
 {d:'2024-12-18',k:'检查',n:'肝脏MRI增强',org:'浙江大学医学院附属第一医院',r:'右肝后叶占位6.1cm，快进快出，考虑肝细胞癌',abn:true,hot:true,
  j:'肝右叶后段(S7)见约6.1cm×5.6cm肿物，动脉期明显强化、门脉期廓清伴假包膜强化；肝硬化背景、脾大；未见肝内播散及血管侵犯征象。',
  y:'右肝占位符合肝细胞癌（BCLC A期）；肝硬化、脾大。'},
 {d:'2025-01-06',k:'检验',n:'外省术后病理（转档）',org:'浙江大学医学院附属第一医院',r:'肝细胞癌（中分化），MVI M0，切缘阴性',abn:true,hot:true,
  j:'大体：右肝叶切除标本，肿物6.3cm。镜下：中分化肝细胞癌。',
  y:'（右肝）肝细胞癌，中分化，MVI M0，切缘1.2cm阴性；背景小结节型肝硬化。'},
 {d:'2026-05-28',k:'检验',n:'肝功能+肿瘤标志物（回赣随访）',org:'南昌市第一医院',r:'TBil 86.4↑，Alb 26.0↓，INR 1.6↑，肝功能失代偿',abn:true,hot:true,
  items:[['总胆红素','86.4','μmol/L','3.4~17.1','↑'],['直接胆红素','42.1','μmol/L','0~6.8','↑'],['白蛋白','26.0','g/L','40.0~55.0','↓'],['INR','1.6','','0.8~1.2','↑'],['甲胎蛋白(AFP)','58.2','ng/mL','0~7.0','↑'],['血红蛋白','98','g/L','130~175','↓']],
  y:'未见肿瘤复发证据，但肝硬化基础致肝功能进行性恶化，Child-Pugh C级，反复腹水及消化道出血，对症保肝治疗。'},
 {d:'2026-06-05',k:'检查',n:'腹部彩超',org:'南昌市第一医院',r:'肝硬化失代偿：中量腹水、脾大、门脉高压',abn:true,
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
function spHasMode(e,m){return (e.treatMode||[]).indexOf(m)>=0}
function spEarly(e){return e.stage==='I期'||e.stage==='II期'}
function spLate(e){return e.stage==='IV期'}
function spOutCity(e){var hc=SP_HOSP_CITY[e.hospital];return !!hc&&hc!==e.city}
function spDistant(e){return /(骨|肝|肺|脑|腹膜)转移/.test(e.metastasis||'')}
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
  var list=e.treatments||[];
  var known=list.length>0||(e.treatMode&&e.treatMode.length>0)||!!e.curPhase;
  var done={};
  list.forEach(function(t){done[t.mode]=1});
  (e.treatMode||[]).forEach(function(m){done[m]=1});
  return SP_MODES.map(function(m){
    var has=!!done[m];
    var cls=has?'badge-success':'badge-neutral';
    return '<div class="sp-kv-item sp-inline"><span class="k">'+esc(m)+'</span><span class="v">'+
      (has?badge('有',cls):(known?badge('无','badge-neutral'):badge('未记录','badge-caution')))+'</span></div>';
  }).join('');
}
/* 首次治疗日期：取全部治疗明细中最早的起始日 */
function spFirstTreat(e){
  var list=e.treatments||[];
  var ds=list.map(function(t){return t.start||t.date}).filter(Boolean).sort();
  return ds.length?ds[0]:(e.tTreat||'');
}
/* 确诊到首次治疗间隔：治疗及时性指标 */
function spTreatInterval(e){
  var a=e.diagDate||e.tConfirm,b=spFirstTreat(e);
  if(!a||!b)return '—';
  var d1=new Date(a),d2=new Date(b);
  if(isNaN(d1)||isNaN(d2)||d2<d1)return '—';
  var days=Math.round((d2-d1)/86400000);
  return days+' 天';
}
/* ICD-10：由 ICD-O-3 部位码截取主码（C34.9 → C34），与病案/影像口径一致 */
function spIcd10(e){var c=spTopoCode(e);return c?c.split('.')[0]:''}
/* 筛查参与状态：由筛查时间/方式推导；「未参与」与「不详」严格区分 */
function spScreenStatus(e){
  if(e.screenDate||e.screenType)return e.screenParticipated===false?'未参与':'已参与';
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
/* 分期依据：取病理学诊断或临床诊断，单独一项 */
function spStageBasisType(e){
  return spMorphCode(e)?'病理学诊断':'临床诊断';
}
/* 分期类型：初诊分期 / 治疗后重新分期（由分期时间与首次治疗日期比较判定） */
function spStageTiming(e){
  var t=e.stageDate,first=(e.treatments||[]).map(function(x){return x.start||x.date}).filter(Boolean).sort()[0]||e.tTreat;
  if(!t)return '—';
  return (first&&t>first)?'治疗后重新分期':'初诊分期';
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
  return tumorEvents.filter(function(e){
    if(sc.city&&e.city!==sc.city)return false;
    if(sc.site&&e.site!==sc.site)return false;
    return true;
  });
}
function spAgg(list){
  var n=list.length;
  function rate(f){return n?+(list.filter(f).length/n*100).toFixed(1):0}
  var alive=list.filter(function(e){return e.vitalStatus.indexOf('存活')>=0}).length;
  var lost=list.filter(function(e){return e.lostFollow}).length;
  return {
    total:n,
    male:list.filter(function(e){return e.sex==='男'}).length,
    female:list.filter(function(e){return e.sex==='女'}).length,
    newYear:list.filter(function(e){return (e.stageDate||'').indexOf('2026')===0}).length,
    earlyRate:rate(spEarly),lateRate:rate(spLate),
    crossCityRate:rate(spOutCity),crossProvRate:rate(function(e){return !!e.provOut}),
    localTreatRate:rate(function(e){return !spOutCity(e)}),
    surgeryRate:rate(function(e){return spHasMode(e,'手术')}),
    radioRate:rate(function(e){return spHasMode(e,'放疗')}),
    chemoRate:rate(function(e){return spHasMode(e,'化疗')}),
    targetRate:rate(function(e){return spHasMode(e,'靶向')}),
    immunoRate:rate(function(e){return spHasMode(e,'免疫')}),
    endocrineRate:rate(function(e){return spHasMode(e,'内分泌')}),
    interRate:rate(function(e){return spHasMode(e,'介入')}),
    mdtRate:rate(function(e){return !!e.mdt}),
    referralRate:rate(function(e){return !!e.referral}),
    comboRate:rate(function(e){return (e.treatMode||[]).length>=2}),
    pallRate:rate(function(e){return e.curPhase.indexOf('姑息')>=0||e.supportive.indexOf('安宁')>=0}),
    fuRate:rate(function(e){return e.followStatus!=='失访'}),
    lostRate:rate(function(e){return e.lostFollow}),
    recurRate:rate(function(e){return !!e.recurrence}),
    metaRate:rate(function(e){return !!e.metaProgress&&e.metaProgress!=='无'}),
    progRate:rate(function(e){return !!e.diseaseProgress}),
    distantRate:rate(spDistant),
    deathRate:rate(function(e){return e.vitalStatus==='死亡'}),
    alive:alive,lost:lost,dead:list.filter(function(e){return e.vitalStatus==='死亡'}).length,
    effSurvival:(n-lost)?+(alive/(n-lost)*100).toFixed(1):0
  };
}
function spAgeDist(list){
  var groups=[['0-39',0,39],['40-49',40,49],['50-59',50,59],['60-69',60,69],['70及以上',70,200]];
  return groups.map(function(g){
    var sub=list.filter(function(e){return e.age>=g[1]&&e.age<=g[2]});
    return {k:g[0],m:sub.filter(function(e){return e.sex==='男'}).length,f:sub.filter(function(e){return e.sex==='女'}).length,n:sub.length};
  });
}
function spSiteRows(list){
  return SP_SITES.map(function(s){
    var sub=list.filter(function(e){return e.site===s});
    return {site:s,n:sub.length,agg:spAgg(sub),list:sub};
  }).filter(function(r){return r.n>0});
}
function spCityRows(list){
  return SP_CITIES.map(function(c){
    var sub=list.filter(function(e){return e.city===c});
    return {city:c,n:sub.length,agg:spAgg(sub),list:sub};
  });
}
function spStageItems(list){
  return SP_STAGE_GROUPS.map(function(s){
    return {k:s,v:list.filter(function(e){return e.stage===s}).length,color:SP_STAGE_COLORS[s]};
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
function spPie(items){
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
  return '<div class="sp-chart-body"><div class="sp-pie" style="background:conic-gradient('+stops.join(',')+')"><div class="sp-pie-center">'+total+'<small>例</small></div></div><div class="sp-legend">'+legend+'</div></div>';
}
/* 横向柱 items:[{k,v,suffix}] suffix 默认 ' 例'；pct=true 时值为百分比；labWide=true 时标签列加宽（放区县等长文本） */
function spHBar(items,pct,labWide){
  items=(items||[]).filter(function(x){return x.v>0});
  if(!items.length)return spChartEmpty();
  var max=Math.max.apply(null,items.map(function(x){return x.v}));
  return '<div class="sp-hbars'+(labWide?' wide-lab':'')+'">'+items.map(function(x){
    var val=pct?x.v+'%':x.v;
    return '<div class="sp-hbar-row"><div class="sp-hbar-lab" title="'+esc(x.k)+'">'+esc(x.k)+'</div><div class="sp-hbar-track"><div class="sp-hbar-fill" style="width:'+Math.max(4,Math.round(x.v/max*100))+'%"></div></div><div class="sp-hbar-num">'+val+'</div></div>';
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
  var rows=list.map(function(e){
    var d0=new Date(e.firstDate),d1=new Date(e.diagDate||e.stageDate),d2=new Date(e.tTreat);
    if(isNaN(d0)||isNaN(d1)||isNaN(d2))return null;
    return {a:Math.max(0,(d1-d0)/86400000),b:Math.max(0,(d2-d1)/86400000)};
  }).filter(Boolean);
  if(!rows.length)return spChartEmpty();
  function med(arr){
    var s=arr.slice().sort(function(x,y){return x-y}),n=s.length;
    return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;
  }
  var medA=med(rows.map(function(r){return r.a})),medB=med(rows.map(function(r){return r.b}));
  var max=Math.max(medA,medB)||1;
  /* 超阈值预警：总时长中位 >30 天（区域级管理阈值，非个体诊疗建议） */
  var over=rows.filter(function(r){return r.a+r.b>30}).length;
  var pctOver=rows.length?Math.round(over/rows.length*100):0;
  var cap='<div class="sp-jour-cap">'+
    '<div class="sp-legend">'+
      '<div class="sp-legend-item"><span class="sp-legend-dot" style="background:#2563eb"></span><span>首诊 → 确诊（中位）</span></div>'+
      '<div class="sp-legend-item"><span class="sp-legend-dot" style="background:#f59e0b"></span><span>确诊 → 首治（中位）</span></div>'+
    '</div><span class="sp-jour-num">总时长中位 '+Math.round(medA+medB)+' 天 · '+over+' 例超 30 天（'+pctOver+'%）</span></div>';
  var body=[medA,medB].map(function(v,i){
    return '<div class="sp-jour-row">'+
      '<div class="sp-jour-name" style="cursor:default">'+(i?'确诊 → 首治':'首诊 → 确诊')+'</div>'+
      '<div class="sp-jour-track">'+
        '<div class="sp-jour-'+(i?'b':'a')+'" style="width:'+(v/max*100).toFixed(2)+'%"></div>'+
      '</div>'+
      '<div class="sp-jour-num">'+Math.round(v)+' 天</div>'+
    '</div>';
  }).join('');
  return cap+'<div class="sp-jour">'+body+'</div>';
}
/* 中位天数（字段名对字段名） */
function spMedDays(list,from,to){
  var ds=list.map(function(e){
    var a=new Date(e[from]),b=new Date(e[to]);
    if(isNaN(a)||isNaN(b))return null;
    return (b-a)/86400000;
  }).filter(function(x){return x!=null&&x>=0}).sort(function(x,y){return x-y});
  if(!ds.length)return '—';
  var m=ds.length%2?ds[(ds.length-1)/2]:(ds[ds.length/2-1]+ds[ds.length/2])/2;
  return Math.round(m)+'<em> 天</em>';
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
    early:{k:'早期占比 Ⅰ+Ⅱ',color:'#10b981',get:function(r){return {v:r.agg.earlyRate,txt:r.agg.earlyRate+'%',pct:r.agg.earlyRate}}},
    late:{k:'晚期占比 Ⅳ',color:'#ef4444',get:function(r){return {v:r.agg.lateRate,txt:r.agg.lateRate+'%',pct:r.agg.lateRate}}},
    cross:{k:'跨市就医率',color:'#f59e0b',get:function(r){return {v:r.agg.crossCityRate,txt:r.agg.crossCityRate+'%',pct:r.agg.crossCityRate}}},
    fu:{k:'随访覆盖率',color:'#0ea5e9',get:function(r){return {v:r.agg.fuRate,txt:r.agg.fuRate+'%',pct:r.agg.fuRate}}}
  };
  var order=keys&&keys.length?keys:['early','late','cross','fu'];
  var cols=[{k:'患者数',color:'#2563eb',get:function(r){return {v:r.n,txt:r.n+' 例',pct:r.n/maxN*100}}}]
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
  var lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals);
  if(hi===lo)return SP_MAP_RAMP[3];
  var t=(v-lo)/(hi-lo);
  return SP_MAP_RAMP[Math.max(0,Math.min(6,Math.round(t*6)))];
}
/* 地图面板：scope 事件列表 + 指标(metric) + 回调 */
var SP_MAP_METRICS={'患者规模':{get:function(r){return r.n},fmt:function(v){return v+' 例'},w:0},
 '晚期占比':{get:function(r){return r.agg.lateRate},fmt:function(v){return v+'%'},w:1},
 '随访覆盖率':{get:function(r){return r.agg.fuRate},fmt:function(v){return v+'%'},w:1},
 '跨市就医率':{get:function(r){return r.agg.crossCityRate},fmt:function(v){return v+'%'},w:1}};
function spMapPanel(list,metric,scopeCity){
  var paths=spMapPaths(),p=spProject();
  if(!paths||!p)return '<div class="sp-chart-empty">地图组件未加载</div>';
  var rows=spCityRows(list);
  var vals=rows.map(function(r){return SP_MAP_METRICS[metric].get(r)});
  var g='',labels='';
  rows.forEach(function(r,i){
    var v=vals[i],col=spMapRamp(vals,v),on=r.city===scopeCity;
    g+='<path d="'+paths[r.city]+'" data-sp-city="'+esc(r.city)+'" fill="'+col+'" stroke="'+(on?'#1d4ed8':'#ffffff')+'" stroke-width="'+(on?2.2:1.2)+'" style="cursor:pointer"/>';
    var nud=SP_MAP_NUDGE[r.city]||[0,0];
    var cx=p.x(window.JX_GEO.cities[i]&&0),cy=0;
    var geo=window.JX_GEO.cities.filter(function(c){return c.full===r.city})[0];
    if(geo){cx=p.x(geo.centroid[0])+nud[0];cy=p.y(geo.centroid[1])+nud[1];}
    labels+='<g style="pointer-events:none"><text x="'+cx.toFixed(1)+'" y="'+(cy-5).toFixed(1)+'" text-anchor="middle" font-size="11" fill="#334155" font-weight="600">'+r.city.replace('市','')+'</text>'+
      '<text x="'+cx.toFixed(1)+'" y="'+(cy+9).toFixed(1)+'" text-anchor="middle" font-size="10" fill="#1d4ed8" font-family="var(--font-num)">'+SP_MAP_METRICS[metric].fmt(v)+'</text></g>';
  });
  var tip='<div class="sp-map-tip">'+
    Object.keys(SP_MAP_METRICS).map(function(m){
      return '<button class="btn '+(m===metric?'btn-primary':'btn-ghost')+' btn-sm" onclick="window._spMapMetric(\''+m+'\')">'+m+'</button>';
    }).join('')+'</div>';
  var legend='<div class="sp-map-legend"><span>低</span>'+SP_MAP_RAMP.map(function(c){return '<i style="background:'+c+'"></i>'}).join('')+'<span>高</span><span style="margin-left:auto">点击地市可下钻查看该地市画像指标</span></div>';
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
var _spScope={city:'',site:''};
var _spMapMetricKey='患者规模';
var _spDomain='burden';
/* 五段 Tab：按肿瘤防治链条（cancer care continuum）组织群体视角
   疾病负担 → 早期发现 → 规范诊疗 → 生存结局 → 资源与公平
   个体读"值"，群体读"一条防治链上哪一环在掉人、掉多少"；
   全部由个体画像字段实时聚合，不新增采集 */
var SP_DOMAINS=[
 {key:'burden',label:'人群与病情构成'},{key:'early',label:'早期发现'},
 {key:'treat',label:'规范诊疗'},{key:'outcome',label:'生存结局'},
 {key:'equity',label:'资源与公平'},{key:'metrics',label:'指标明细表'}
];

function spScopeBar(){
  var cityOpts='<option value="">全省</option>'+SP_CITIES.map(function(c){return '<option'+(c===_spScope.city?' selected':'')+'>'+c+'</option>'}).join('');
  var siteOpts='<option value="">全部病种</option>'+SP_SITES.map(function(s){return '<option'+(s===_spScope.site?' selected':'')+'>'+s+'</option>'}).join('');
  return '<div class="sp-filter-bar">'+
    '<div class="form-group"><label>地市</label><select id="spScopeCity" onchange="window._spSetScope(this.value,\'\')">'+cityOpts+'</select></div>'+
    '<div class="form-group"><label>瘤种</label><select onchange="window._spSetScope(\'\',this.value)">'+siteOpts+'</select></div>'+
    '<div class="sp-filter-actions"><button class="btn btn-ghost btn-sm" onclick="window._spSetScope(\'\',\'\')">重置</button></div>'+
  '</div>';
}
function spScopeLabel(){
  var a=[];
  a.push(_spScope.city||'全省');
  if(_spScope.site)a.push(_spScope.site+'癌');
  return a.join(' · ');
}

/* ---- 一句话摘要：把当前范围的群体画像口语化归纳（页面开场，替代重复的四维卡） ---- */
function spGroupSummary(list,agg,siteRows,cityRows){
  var topAge=spAgeDist(list).slice().sort(function(a,b){return b.n-a.n})[0];
  var sexName=agg.male>=agg.female?'男':'女';
  var sexPct=Math.round(Math.max(agg.male,agg.female)/agg.total*100);
  var topSite=siteRows.slice().sort(function(a,b){return b.n-a.n})[0];
  var topSitePct=Math.round(topSite.n/agg.total*100);
  var covered=cityRows.filter(function(r){return r.n>0}).length;
  /* 收尾：按防治链条逐段体检，挑「偏离度最大」的一项作为最该说的短板；均达标才说平稳
     判据全部为区域管理阈值（非个体诊疗建议），与重点问题扫描口径一致 */
  var cands=[];
  if(agg.lateRate>=40)cands.push({sev:agg.lateRate,txt:'晚期（Ⅳ期）占比 <em>'+agg.lateRate+'%</em>，早诊筛查是首要短板'});
  if(agg.earlyRate<40&&agg.total>=3)cands.push({sev:60-agg.earlyRate,txt:'早诊率仅 <em>'+agg.earlyRate+'%</em>（早期 Ⅰ+Ⅱ），关口需前移'});
  if(agg.mdtRate<60)cands.push({sev:60-agg.mdtRate,txt:'MDT 覆盖率 <em>'+agg.mdtRate+'%</em>，多学科协作待规范'});
  if(agg.crossCityRate>=30)cands.push({sev:agg.crossCityRate,txt:'跨市就医率 <em>'+agg.crossCityRate+'%</em>，本地承接能力待提升'});
  if(agg.lostRate>=8)cands.push({sev:agg.lostRate*4,txt:'失访率 <em>'+agg.lostRate+'%</em>，随访管理需加强'});
  var flag;
  if(cands.length){cands.sort(function(a,b){return b.sev-a.sev});flag=cands[0].txt;}
  else flag='早诊率 <em>'+agg.earlyRate+'%</em>、随访覆盖 <em>'+agg.fuRate+'%</em>、观察生存率 <em>'+agg.effSurvival+'%</em>，各环节均达标';
  var txt='当前范围 <b>'+esc(spScopeLabel())+'</b> 共 <em>'+agg.total+'</em> 例在管患者，覆盖 <em>'+covered+'</em> 个设区市；'+
    '以 <b>'+sexName+'性</b>（<em>'+sexPct+'%</em>）、<b>'+esc(topAge.k)+'</b> 年龄段为主，'+
    '首位瘤种 <b>'+esc(topSite.site)+'癌</b>（<em>'+topSitePct+'%</em>）。'+flag+'。';
  return '<div class="sp-gp-summary"><div class="sp-gp-summary-ico">概</div><div class="sp-gp-summary-txt">'+txt+'</div></div>';
}
/* ---- 链条节点指标带：一行 8 项，按防治链条（负担→发现→诊疗→结局→公平）取节点指标，
   值旁标与全省同瘤种基准的差值；已在全省时不显示差值 ---- */
function spKpiStrip(list,agg){
  var atProvince=!_spScope.city;
  var base=atProvince?agg:spAgg(spScopeEvents({city:'',site:_spScope.site}));
  /* cat 颜色对应防治链条段：负担=靛 发现=蓝 诊疗=青 结局=绿 公平=琥珀；good=true 越高越好 */
  var defs=[
    {k:'早诊率 Ⅰ+Ⅱ',cat:'#2563eb',v:agg.earlyRate,b:base.earlyRate,unit:'%',good:true},
    {k:'首诊远处转移率',cat:'#2563eb',v:agg.distantRate,b:base.distantRate,unit:'%',good:false},
    {k:'MDT 覆盖率',cat:'#0891b2',v:agg.mdtRate,b:base.mdtRate,unit:'%',good:true},
    {k:'综合治疗率',cat:'#0891b2',v:agg.comboRate,b:base.comboRate,unit:'%',good:true},
    {k:'随访覆盖率',cat:'#10b981',v:agg.fuRate,b:base.fuRate,unit:'%',good:true},
    {k:'观察生存率',cat:'#10b981',v:agg.effSurvival,b:base.effSurvival,unit:'%',good:true},
    {k:'县域内就诊率',cat:'#f59e0b',v:agg.localTreatRate,b:base.localTreatRate,unit:'%',good:true},
    {k:'跨市就医率',cat:'#f59e0b',v:agg.crossCityRate,b:base.crossCityRate,unit:'%',good:false}
  ];
  return '<div class="sp-kpi-strip">'+defs.map(function(d){
    var sub;
    if(atProvince){sub='<span class="flat">全省基准</span>';}
    else{
      var diff=+(d.v-d.b).toFixed(1);
      if(diff===0)sub='<span class="flat">持平全省</span>';
      else{
        var favorable=d.good?diff>0:diff<0;
        var arrow=diff>0?'▲':'▼';
        sub='<span class="'+(favorable?'down':'up')+'">'+arrow+' '+Math.abs(diff)+d.unit+' <b>vs 全省</b></span>';
      }
    }
    return '<div class="sp-kpi"><div class="sp-kpi-k"><i style="background:'+d.cat+'"></i>'+esc(d.k)+'</div>'+
      '<div class="sp-kpi-v">'+d.v+'<em>'+d.unit+'</em></div>'+
      '<div class="sp-kpi-sub">'+sub+'</div></div>';
  }).join('')+'</div>';
}

/* ---- 防治链条级联漏斗：人群从「在管」逐环累积达标到「规范治疗且随访在管」，环间标流失 ----
   群体视角的核心读法——每一环是「同时满足前面所有条件」的严格子集，故单调递减；
   看整条链哪一环在掉人、掉多少。点击任一节点跳到对应链条段 Tab。 */
function spCareCascade(list){
  var N=list.length||1;
  /* 累积嵌套条件：cond(e) 需在满足前序全部条件的前提下再判定，保证子集单调递减 */
  var steps=[
    {k:'在管患者',color:'#334155',dom:'burden',cond:function(e){return true;}},
    {k:'病理确诊',color:'#2563eb',dom:'early',cond:function(e){return !!spMorphCode(e);}},
    {k:'接受治疗',color:'#0891b2',dom:'treat',cond:function(e){return (e.treatMode||[]).length>0;}},
    {k:'MDT 评估',color:'#0e7490',dom:'treat',cond:function(e){return !!e.mdt;}},
    {k:'综合治疗',color:'#0d9488',dom:'treat',cond:function(e){return (e.treatMode||[]).length>=2;}},
    {k:'随访在管',color:'#10b981',dom:'outcome',cond:function(e){return e.followStatus!=='失访'&&e.vitalStatus!=='死亡';}}
  ];
  /* 逐环累积：cur = 上一环通过者中再满足本环条件的子集 */
  var cur=list.slice();
  var nodes=steps.map(function(st,i){
    cur=cur.filter(st.cond);
    return {k:st.k,color:st.color,dom:st.dom,n:cur.length};
  });
  var flow='';
  nodes.forEach(function(nd,i){
    var rate=Math.round(nd.n/N*100);
    flow+='<div class="sp-fn-node" onclick="window._spSetDomain(\''+nd.dom+'\')" style="cursor:pointer" title="点击查看「'+esc(SP_DOMAINS.filter(function(d){return d.key===nd.dom})[0].label)+'」段">'+
      '<div class="sp-fn-bar" style="background:'+nd.color+'"><div class="sp-fn-n">'+nd.n+'<em>例</em></div><div class="sp-fn-k">'+esc(nd.k)+'</div></div>'+
      '<div class="sp-fn-rate">占在管 <b>'+rate+'%</b></div></div>';
    if(i<nodes.length-1){
      var loss=nd.n-nodes[i+1].n;
      var lossPct=nd.n?Math.round(loss/nd.n*100):0;
      var warn=lossPct>=25;
      flow+='<div class="sp-fn-gap"><div class="sp-fn-gap-arrow">→</div>'+
        '<div class="sp-fn-gap-loss '+(warn?'warn':'ok')+'">'+(loss>0?'−'+loss+' ('+lossPct+'%)':'0')+'</div></div>';
    }
  });
  return '<div class="sp-funnel"><div class="sp-funnel-head">'+
    '<span class="sp-funnel-title">防治链条级联</span>'+
    '<span class="sp-funnel-hint">在管人群沿「确诊 → 治疗 → MDT → 综合治疗 → 随访在管」逐环累积达标（每环为前环的子集），箭头下为环间流失；点击节点查看该段明细</span>'+
    '</div><div class="sp-funnel-flow">'+flow+'</div></div>';
}

function renderOverview(){
  var list=spScopeEvents(_spScope);
  var agg=spAgg(list);
  var siteRows=spSiteRows(list);
  var cityRows=spCityRows(list);
  var h=spScopeBar();
  if(!list.length){
    h+='<div class="sp-gp-empty">当前范围（'+esc(spScopeLabel())+'）无在管患者，无法聚合群体画像<br>'+
      '<button class="btn btn-outline btn-sm" style="margin-top:10px" onclick="window._spSetScope(\'\',\'\')">重置筛选条件</button></div>';
    return h;
  }
  /* 开场：一句话摘要 → 链条节点指标带 → 防治链条级联漏斗（群体视角核心） */
  h+=spGroupSummary(list,agg,siteRows,cityRows);
  h+=spKpiStrip(list,agg);
  h+=spCareCascade(list);
  /* 五段 Tabs：疾病负担 → 早期发现 → 规范诊疗 → 生存结局 → 资源与公平 */
  h+='<div class="sp-domain-tabs">'+SP_DOMAINS.map(function(d){
    return '<button class="sp-domain-tab'+(_spDomain===d.key?' active':'')+'" onclick="window._spSetDomain(\''+d.key+'\')">'+d.label+'</button>';
  }).join('')+'</div>';
  h+='<div id="spDomainBody">'+spDomainPanel(list,agg,siteRows,cityRows)+'</div>';
  return h;
}


/* ---- 五段面板：按肿瘤防治链条组织（疾病负担/早期发现/规范诊疗/生存结局/资源与公平） ----
   全部复用既有图表构件，按链条逻辑归位；数字由个体画像队列实时聚合，不新增采集 */
function spDomainPanel(list,agg,siteRows,cityRows){

  /* ========== 段① 人群与病情构成：在管一群什么样的人、什么瘤、什么期 ==========
     内部两块：A 人群特征（人口学/社会属性/共病）B 病情构成（瘤谱/分期）；
     发现途径（症状/筛查）归属段②。原称「疾病负担」，V12.4 改名以名副其实。 */
  if(_spDomain==='burden'){
    var ages=spAgeDist(list);
    var insDist={};list.forEach(function(e){insDist[e.insurance]=(insDist[e.insurance]||0)+1});
    var insItems=Object.keys(insDist).map(function(k){return {k:k,v:insDist[k]}});
    var maxAge=Math.max.apply(null,ages.map(function(a){return Math.max(a.m,a.f)}))||1;
    var ageCap='<div class="sp-age-row sp-age-cap">'+
      '<div class="sp-age-side"><span class="sp-age-legend"><i class="m"></i>男</span></div><div></div>'+
      '<div class="sp-age-side"><span class="sp-age-legend"><i class="f"></i>女</span></div></div>';
    var ageRows=ages.map(function(a){
      return '<div class="sp-age-row">'+
        '<div class="sp-age-side"><span class="sp-age-num">男'+a.m+'</span>'+
          '<div class="sp-age-track m"><div class="sp-age-fill m" style="width:'+Math.round(a.m/maxAge*100)+'%"></div></div></div>'+
        '<div class="sp-age-lab"><div class="k">'+esc(a.k)+'</div><div class="n">'+a.n+' 例</div></div>'+
        '<div class="sp-age-side"><div class="sp-age-track f"><div class="sp-age-fill f" style="width:'+Math.round(a.f/maxAge*100)+'%"></div></div>'+
          '<span class="sp-age-num">女'+a.f+'</span></div>'+
      '</div>';
    }).join('');
    /* 医保构成（性别已由左侧年龄金字塔按男/女拆分表达，此处不再重复放性别堆叠条） */
    /* ---- 人群特征补充：中位年龄 / 基础疾病 / 居住地 ----
       全部由个体画像既有字段实时聚合，不新增采集字段；
       「因症就诊（症状）」归属段②早期发现，与筛查途径配对，本段不再统计 */
    /* 中位年龄 */
    var ageVals=list.map(function(e){return e.age}).sort(function(a,b){return a-b});
    var medAge=ageVals[Math.floor((ageVals.length-1)/2)];
    /* 合并基础疾病：既往史（pastHistory）明确写「无特殊」记为无，其余为有 */
    var baseDis=list.filter(function(e){return ((e.pastHistory||'').indexOf('无特殊')<0)}).length;
    /* 居住地（区县）分布 */
    var regDist={};list.forEach(function(e){var k=(e.region||'不详');regDist[k]=(regDist[k]||0)+1});
    var regItems=Object.keys(regDist).map(function(k){return {k:k,v:regDist[k]}}).sort(function(a,b){return b.v-a.v});
    function pctOf(n){return list.length?Math.round(n/list.length*100):0}
    /* 各瘤种分期构成：100% 堆叠条（替代原色深热力矩阵，小样本下更可读） */
    var ssStages=SP_STAGE_GROUPS;
    var ssColors=SP_STAGE_GROUPS.map(function(s){return SP_STAGE_COLORS[s]});
    var ssRows=siteRows.map(function(r){
      var cells=SP_STAGE_GROUPS.map(function(s){return r.list.filter(function(e){return e.stage===s}).length});
      return {label:r.site+'癌',n:r.n,cells:cells};
    }).sort(function(a,b){return b.n-a.n});
    /* 段①两块：人群特征（是谁）+ 病情构成（得什么病、什么程度）。
       年龄性别以金字塔为主，顶部小指标不重复画同一信息。 */
    return spGpHead('A','人群特征','在管患者的人口学与社会属性 · 共病情况')+
      '<div class="sp-mini-grid" style="margin-bottom:16px">'+
        spMini('在管患者',agg.total+'<em> 例</em>')+spMini('男 / 女',agg.male+' / '+agg.female)+
        spMini('中位年龄',medAge+'<em> 岁</em>')+
        spMini('有基础疾病（既往史）',baseDis+'<em> 例</em> · '+pctOf(baseDis)+'<em>%</em>')+
      '</div><div class="sp-2col" style="margin-bottom:16px">'+
        spPanel('年龄结构（男/女）','<div class="sp-hbars">'+ageCap+ageRows+'</div>')+
        spPanel('居住地分布（区/县）',spHBar(regItems,false,true))+
      '</div>'+
      spGpHead('B','病情构成','医保 · 瘤谱 · 分期谱 · 各瘤种分期构成')+
      '<div class="sp-3col" style="margin-bottom:16px">'+
        spPanel('医保类型构成',spPie(insItems.slice().sort(function(a,b){return b.v-a.v}).map(function(x){return {k:x.k,v:x.v}})))+
        spPanel('瘤谱构成（病种）',spPie(siteRows.map(function(r){return {k:r.site+'癌',v:r.n}})))+
        spPanel('分期谱构成',spPie(spStageItems(list)))+
      '</div>'+spPanel('各瘤种分期构成（条宽=例数，段=各分期占比）',spSiteStageStack(ssRows,ssStages,ssColors));
  }

  /* ========== 段② 早期发现：发现得早不早（筛查 → 早诊 → 地区/病种差异） ==========
     注：分期构成（首诊分期）归属段①「疾病负担」，本段不再重复饼图，只用早诊率数值与差异表 */
  if(_spDomain==='early'){
    var scrOn=list.filter(function(e){return (e.screenType||'').trim()}).length;
    var scrItems=[{k:'已参与（有筛查记录）',v:scrOn,color:'#10b981'},{k:'不详（无记录）',v:list.length-scrOn,color:'#94a3b8'}];
    /* 发现时症状状态：有症状（因症就诊）/ 无症状——与筛查途径配对，自段①迁入 */
    var sympN=list.filter(function(e){return (e.symptom||'').trim()&&e.symptom!=='无'}).length;
    var sympItems=[{k:'有症状（因症就诊）',v:sympN,color:'#f59e0b'},{k:'无症状',v:list.length-sympN,color:'#10b981'}];
    /* 诊断依据构成：病理学 / 临床 */
    var basisDist={};list.forEach(function(e){var b=spStageBasisType(e);basisDist[b]=(basisDist[b]||0)+1});
    var basisItems=Object.keys(basisDist).map(function(k){return {k:k,v:basisDist[k]}});
    /* 地区早诊差异 */
    var cityEarly=cityRows.filter(function(r){return r.n>0}).sort(function(a,b){return b.agg.lateRate-a.agg.lateRate}).map(function(r){
      return '<tr><td class="txt">'+esc(r.city)+'</td><td class="num">'+r.n+'</td><td class="num">'+r.agg.earlyRate+'%</td><td'+(r.agg.lateRate>=50?' style="color:var(--color-danger-fg);font-weight:700"':'')+'>'+r.agg.lateRate+'%</td></tr>';
    }).join('');
    /* 病种早诊对照：各病种早期占比横向条 */
    var siteEarly=siteRows.map(function(r){return {k:r.site+'癌',v:r.agg.earlyRate}}).sort(function(a,b){return b.v-a.v});
    return '<div class="sp-mini-grid" style="margin-bottom:16px">'+
      spMini('筛查参与率',(agg.total?Math.round(scrOn/agg.total*100):0)+'<em>%</em>')+
      spMini('早诊率（Ⅰ+Ⅱ期）',agg.earlyRate+'<em>%</em>')+
      spMini('晚期占比（Ⅳ期）',agg.lateRate+'<em>%</em>')+
      spMini('首诊远处转移率',agg.distantRate+'<em>%</em>')+
    '</div><div class="sp-2col" style="margin-bottom:16px">'+
      spPanel('筛查、发现途径与确诊依据','<div class="sp-sec">筛查记录覆盖</div>'+spStack(scrItems)+
        '<div class="sp-sec">发现时症状状态（因症就诊 / 无症状）</div>'+spStack(sympItems)+
        '<div class="sp-sec">确诊依据构成（病理学 / 临床）</div>'+spHBar(basisItems.slice().sort(function(a,b){return b.v-a.v})))+
      spPanel('各病种早诊率（早期 Ⅰ+Ⅱ 占比）',spHBar(siteEarly,true))+
    '</div>'+
      spPanel('地区早诊差异（晚期占比降序，城市名可下钻）','<div class="sp-table-wrap"><table class="data-table" style="min-width:520px"><thead><tr><th class="txt">地市</th><th class="num">患者数</th><th class="num">早期占比</th><th class="num">晚期占比</th></tr></thead><tbody>'+cityEarly+'</tbody></table></div>');
  }

  /* ========== 段③ 规范诊疗：治得规不规范、卡在哪一环（时效 + 模式） ========== */
  if(_spDomain==='treat'){
    var hospDist={};list.forEach(function(e){hospDist[e.hospital]=(hospDist[e.hospital]||0)+1});
    var modeRates=[['手术治疗率',agg.surgeryRate],['放疗率',agg.radioRate],['化疗率',agg.chemoRate],['靶向治疗率',agg.targetRate],['免疫治疗率',agg.immunoRate],['内分泌治疗率',agg.endocrineRate],['介入治疗率',agg.interRate]];
    var comboDist={};list.forEach(function(e){comboDist[e.treatMode.join('+')||'未治疗']=(comboDist[e.treatMode.join('+')||'未治疗']||0)+1});
    var comboRows=Object.keys(comboDist).map(function(k){return {k:k,v:comboDist[k]}}).sort(function(a,b){return b.v-a.v});
    return '<div class="sp-mini-grid" style="margin-bottom:16px">'+
      spMini('病理确诊率',(agg.total?Math.round(list.filter(function(e){return !!spMorphCode(e)}).length/agg.total*100):0)+'<em>%</em>')+
      spMini('MDT 覆盖率',agg.mdtRate+'<em>%</em>')+
      spMini('综合治疗率（≥2种）',agg.comboRate+'<em>%</em>')+
      spMini('转诊率',agg.referralRate+'<em>%</em>')+
      spMini('姑息/安宁占比',agg.pallRate+'<em>%</em>')+
      spMini('手术治疗率',agg.surgeryRate+'<em>%</em>')+
      spMini('首诊→确诊（中位）',spMedDays(list,'firstDate','diagDate'))+
      spMini('确诊→首治（中位）',spMedDays(list,'diagDate','tTreat'))+
    '</div>'+
    spPanel('诊疗时效（中位）：首诊 → 确诊 → 首治',spJourney(list))+
    '<div style="height:16px"></div><div class="sp-2col">'+
      spPanel('治疗方式应用率',spHBar(modeRates.map(function(x){return {k:x[0],v:x[1]}}),true))+
      spPanel('治疗模式组合','<div class="sp-table-wrap"><table class="data-table" style="min-width:520px"><thead><tr><th class="txt">治疗组合</th><th class="num">例数</th><th class="num">占比</th></tr></thead><tbody>'+comboRows.map(function(x){return '<tr><td class="txt">'+esc(x.k)+'</td><td class="num">'+x.v+'</td><td class="num">'+Math.round(x.v/list.length*100)+'%</td></tr>'}).join('')+'</tbody></table></div>')+
    '</div><div style="height:16px"></div>'+
      spPanel('主要治疗医院',spHBar(Object.keys(hospDist).map(function(k){return {k:k,v:hospDist[k]}}).sort(function(a,b){return b.v-a.v})));
  }

  /* ========== 段④ 生存结局：结局好不好（生存 + 复发进展死亡） ========== */
  if(_spDomain==='outcome'){
    var siteFuRows=siteRows.map(function(r){
      var alive=r.list.filter(function(e){return e.vitalStatus.indexOf('存活')>=0}).length;
      var dead=r.list.filter(function(e){return e.vitalStatus==='死亡'}).length;
      var lost=r.list.filter(function(e){return e.lostFollow}).length;
      return '<tr><td class="txt">'+esc(r.site+'癌')+'</td><td class="num">'+r.n+'</td><td class="num" style="color:var(--color-success-fg)">'+alive+'</td><td'+(dead?' style="color:var(--color-danger-fg);font-weight:600"':'')+'>'+dead+'</td><td'+(lost?' style="color:var(--color-caution-fg);font-weight:600"':'')+'>'+lost+'</td><td class="num">'+(r.n-lost?Math.round(alive/(r.n-lost)*100):0)+'%</td></tr>';
    }).join('');
    var aliveN=list.filter(function(e){return e.vitalStatus==='存活'}).length;
    var withTumorN=list.filter(function(e){return e.vitalStatus==='存活（带瘤）'}).length;
    var outcomeItems=[
      {k:'存活',v:aliveN,color:'#10b981'},
      {k:'存活（带瘤）',v:withTumorN,color:'#f59e0b'},
      {k:'死亡',v:agg.dead,color:'#64748b'},
      {k:'失访',v:agg.lost,color:'#ef4444'}
    ];
    var outCols=['存活','带瘤','死亡','失访'];
    var outColors=['#10b981','#f59e0b','#64748b','#ef4444'];
    var stageOutcomeRows=SP_STAGE_GROUPS.map(function(s){
      var sub=list.filter(function(e){return e.stage===s});
      return {label:s,cells:[
        sub.filter(function(e){return e.vitalStatus==='存活'}).length,
        sub.filter(function(e){return e.vitalStatus==='存活（带瘤）'}).length,
        sub.filter(function(e){return e.vitalStatus==='死亡'}).length,
        sub.filter(function(e){return e.lostFollow}).length
      ]};
    });
    return '<div class="sp-mini-grid" style="margin-bottom:16px">'+
      spMini('随访覆盖率',agg.fuRate+'<em>%</em>')+spMini('失访率',agg.lostRate+'<em>%</em>')+
      spMini('复发率',agg.recurRate+'<em>%</em>')+spMini('远处转移率',agg.metaRate+'<em>%</em>')+
      spMini('疾病进展率',agg.progRate+'<em>%</em>')+spMini('死亡率',agg.deathRate+'<em>%</em>')+
      spMini('观察生存率',agg.effSurvival+'<em>%</em>')+spMini('在管存活',agg.alive+'<em> 例</em>')+
    '</div><div class="sp-2col" style="margin-bottom:16px">'+
      spPanel('当前结局状态构成',spPie(outcomeItems))+
      spPanel('分期 × 结局热力矩阵（色深=例数，–为 0 例）',spHeat(outCols,stageOutcomeRows,outColors))+
    '</div><div class="panel"><div class="panel-header"><span>不同病种结局差异</span></div><div class="panel-body"><div class="sp-table-wrap"><table class="data-table" style="min-width:672px"><thead><tr><th class="txt">病种</th><th class="num">患者数</th><th class="num">存活</th><th class="num">死亡</th><th class="num">失访</th><th class="num">观察生存率</th></tr></thead><tbody>'+siteFuRows+'</tbody></table></div></div></div>';
  }

  /* ========== 段⑤ 资源与公平：资源与可及性均不均衡（地图 + 流向 + 费用） ========== */
  if(_spDomain==='equity'){
    /* 地图 + 地市排行 */
    var mapBlock='<div class="sp-ov-grid" style="margin-bottom:16px">'+
      '<div class="panel"><div class="panel-header"><span>全省分布 · '+esc(_spMapMetricKey)+'</span></div><div class="panel-body">'+spMapPanel(list,_spMapMetricKey,_spScope.city)+'</div></div>'+
      '<div class="sp-ov-side"><div class="panel"><div class="panel-header"><span>地市排行'+(_spScope.city?'<span class="spr-count">当前：'+esc(_spScope.city)+'</span>':'')+'</span></div><div class="panel-body">'+
        '<div class="sp-map-rank">'+cityRows.filter(function(r){return r.n>0}).sort(function(a,b){return SP_MAP_METRICS[_spMapMetricKey].get(b)-SP_MAP_METRICS[_spMapMetricKey].get(a)}).slice(0,6).map(function(r,i){
          var v=SP_MAP_METRICS[_spMapMetricKey].get(r);
          return '<div class="sp-map-rank-item'+(r.city===_spScope.city?' sel':'')+'" onclick="window._spDrillCity(\''+esc(r.city)+'\')">'+
            '<span class="sp-map-rank-idx">'+(i+1)+'</span><span class="sp-map-rank-name">'+esc(r.city)+'</span>'+
            '<span class="sp-map-rank-sub">'+r.n+' 例</span><span class="sp-map-rank-val">'+SP_MAP_METRICS[_spMapMetricKey].fmt(v)+'</span></div>';
        }).join('')+'</div></div></div>'+
      '<div class="panel"><div class="panel-header"><span>当前范围</span></div><div class="panel-body"><div class="sp-kv-grid">'+
        '<div class="sp-kv-item"><span class="k">统计范围</span><span class="v">'+esc(spScopeLabel())+'</span></div>'+
        '<div class="sp-kv-item"><span class="k">在管患者</span><span class="v">'+agg.total+' 例</span></div>'+
        '<div class="sp-kv-item"><span class="k">县域内就诊率</span><span class="v">'+agg.localTreatRate+'%</span></div>'+
        '<div class="sp-kv-item"><span class="k">跨市 / 跨省就医率</span><span class="v">'+agg.crossCityRate+'% / '+agg.crossProvRate+'%</span></div>'+
      '</div></div></div></div>'+
    '</div>';
    /* 流出病种 */
    var outSites={};list.filter(spOutCity).forEach(function(e){outSites[e.site]=(outSites[e.site]||0)+1});
    var outRows=Object.keys(outSites).map(function(s){
      var siteRow=siteRows.filter(function(r){return r.site===s})[0]||{n:1};
      var tos={};list.filter(function(e){return e.site===s&&spOutCity(e)}).forEach(function(e){tos[e.hospital]=(tos[e.hospital]||0)+1});
      return '<tr><td>'+esc(s+'癌')+'</td><td>'+siteRow.n+'</td><td style="color:var(--color-danger-fg);font-weight:600">'+Math.round(outSites[s]/siteRow.n*100)+'%</td><td>'+esc(Object.keys(tos).join('、')||'—')+'</td></tr>';
    }).join('');
    /* 费用 */
    var siteCost=siteRows.map(function(r){var c=SP_SITE_COST[r.site];return {k:r.site+'癌',v:Math.round(c.ip/1000)}}).sort(function(a,b){return b.v-a.v});
    var avg={drug:0,ins:0,op:0};
    siteRows.forEach(function(r){avg.drug+=SP_SITE_COST[r.site].drug*r.n;avg.ins+=SP_SITE_COST[r.site].ins*r.n});
    if(list.length){avg.drug=Math.round(avg.drug/list.length);avg.ins=Math.round(avg.ins/list.length);avg.op=100-avg.ins;}
    var localAvg=Math.round(list.filter(function(e){return !spOutCity(e)}).reduce(function(s,e){return s+SP_SITE_COST[e.site].ip},0)/Math.max(1,list.filter(function(e){return !spOutCity(e)}).length));
    var outAvg=Math.round(localAvg*1.28/1000);
    var modeCostRows=SP_MODE_COST.map(function(m){
      var used=list.filter(function(e){return spHasMode(e,m.mode)}).length;
      return '<tr><td class="code">'+esc(m.mode)+'</td><td class="num" style="font-family:var(--font-num);font-weight:600">¥'+m.cost.toLocaleString()+'</td><td class="txt">'+esc(m.unit)+'</td><td class="num">'+(used?used+' 例':'—')+'</td></tr>';
    }).join('');
    return mapBlock+
    spPanel('地市综合对照（跨市就医率 / 随访覆盖率，城市名可下钻）',spCityCompare(cityRows,['cross','fu']))+
    '<div style="height:16px"></div><div class="sp-2col">'+
      spPanel('主要流出病种','<div class="sp-table-wrap"><table class="data-table" style="min-width:520px"><thead><tr><th class="txt">病种</th><th class="num">患者数</th><th class="num">跨市占比</th><th class="txt">主要流向医院</th></tr></thead><tbody>'+(outRows||'<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted)">无跨市就医患者</td></tr>')+'</tbody></table></div>')+
      spPanel('跨区域就医费用差异（千元）',spVBar([{k:'本地就诊',v:Math.round(localAvg/1000)},{k:'跨市就诊',v:outAvg}]))+
    '</div><div class="sp-2col" style="margin-top:16px">'+
      spPanel('病种次均住院费用（千元）',spHBar(siteCost))+
      spPanel('费用结构（加权平均）',spStack([{k:'药品费用占比',v:avg.drug,color:'#2563eb'},{k:'医保支付比例',v:avg.ins,color:'#10b981'},{k:'患者自付比例',v:avg.op,color:'#f59e0b'}]))+
    '</div><div style="height:16px"></div>'+
      spPanel('不同治疗模式费用','<div class="sp-table-wrap"><table class="data-table" style="min-width:520px"><thead><tr><th class="code">治疗方式</th><th class="num">次/年均费用</th><th class="txt">口径</th><th class="num">应用患者</th></tr></thead><tbody>'+modeCostRows+'</tbody></table></div>');
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
  function pct(v){return v+'%';}
  function medDaysNum(from,to){
    var ds=list.map(function(e){var a=new Date(e[from]),b=new Date(e[to]);if(isNaN(a)||isNaN(b))return null;return (b-a)/86400000;}).filter(function(x){return x!=null&&x>=0}).sort(function(x,y){return x-y});
    if(!ds.length)return '—';
    var m=ds.length%2?ds[(ds.length-1)/2]:(ds[ds.length/2-1]+ds[ds.length/2])/2;
    return Math.round(m)+' 天';
  }
  var pathN=list.filter(function(e){return !!spMorphCode(e)}).length;
  var scrN=list.filter(function(e){return (e.screenType||'').trim()}).length;
  /* 概览型指标分组：{group, rows:[[指标, 数值, 口径/说明]]} */
  var groups=[
    {group:'一、人群与病情构成',rows:[
      ['在管患者数',agg.total+' 例','当前范围在管全部患者'],
      ['男 / 女',agg.male+' / '+agg.female+' 例','性别构成'],
      ['病种数',siteRows.length+' 种','覆盖瘤种数'],
      ['覆盖设区市',cityRows.filter(function(r){return r.n>0}).length+' 个','有在管患者的地市数']
    ]},
    {group:'二、早期发现',rows:[
      ['筛查参与率',pct(agg.total?Math.round(scrN/agg.total*100):0),'有筛查记录 / 在管'],
      ['早诊率（Ⅰ+Ⅱ期）',pct(agg.earlyRate),'早期例数 / 在管'],
      ['晚期占比（Ⅳ期）',pct(agg.lateRate),'Ⅳ期例数 / 在管'],
      ['首诊远处转移率',pct(agg.distantRate),'首诊即远处转移 / 在管']
    ]},
    {group:'三、规范诊疗',rows:[
      ['病理确诊率',pct(agg.total?Math.round(pathN/agg.total*100):0),'有形态学编码 / 在管'],
      ['MDT 覆盖率',pct(agg.mdtRate),'经 MDT 评估 / 在管'],
      ['综合治疗率（≥2 种）',pct(agg.comboRate),'治疗方式≥2 种 / 在管'],
      ['转诊率',pct(agg.referralRate),'有转诊轨迹 / 在管'],
      ['姑息 / 安宁占比',pct(agg.pallRate),'姑息或安宁疗护 / 在管'],
      ['手术治疗率',pct(agg.surgeryRate),'含手术 / 在管'],
      ['放疗率',pct(agg.radioRate),'含放疗 / 在管'],
      ['化疗率',pct(agg.chemoRate),'含化疗 / 在管'],
      ['靶向治疗率',pct(agg.targetRate),'含靶向 / 在管'],
      ['免疫治疗率',pct(agg.immunoRate),'含免疫 / 在管'],
      ['内分泌治疗率',pct(agg.endocrineRate),'含内分泌 / 在管'],
      ['介入治疗率',pct(agg.interRate),'含介入 / 在管'],
      ['首诊 → 确诊（中位）',medDaysNum('firstDate','diagDate'),'中位天数'],
      ['确诊 → 首治（中位）',medDaysNum('diagDate','tTreat'),'中位天数']
    ]},
    {group:'四、生存结局',rows:[
      ['随访覆盖率',pct(agg.fuRate),'非失访 / 在管'],
      ['失访率',pct(agg.lostRate),'失访 / 在管'],
      ['复发率',pct(agg.recurRate),'有复发记录 / 在管'],
      ['远处转移率',pct(agg.metaRate),'随访期远处转移 / 在管'],
      ['疾病进展率',pct(agg.progRate),'疾病进展 / 在管'],
      ['死亡率',pct(agg.deathRate),'死亡 / 在管'],
      ['观察生存率',pct(agg.effSurvival),'存活 /（在管−失访）'],
      ['在管存活',agg.alive+' 例','当前存活在管']
    ]},
    {group:'五、资源与公平',rows:[
      ['县域内就诊率',pct(agg.localTreatRate),'本地就诊 / 在管'],
      ['跨市就医率',pct(agg.crossCityRate),'跨市就诊 / 在管'],
      ['跨省就医率',pct(agg.crossProvRate),'跨省就诊 / 在管']
    ]}
  ];
  /* 分病种明细 */
  var siteDetail={group:'六、分病种指标（例数 / 早诊率 / 晚期占比 / 随访覆盖率 / 观察生存率）',cols:['病种','患者数','早诊率','晚期占比','随访覆盖率','观察生存率'],matrix:
    siteRows.slice().sort(function(a,b){return b.n-a.n}).map(function(r){
      return [r.site+'癌',r.n,r.agg.earlyRate+'%',r.agg.lateRate+'%',r.agg.fuRate+'%',r.agg.effSurvival+'%'];
    })};
  /* 分地市明细 */
  var cityDetail={group:'七、分地市指标（例数 / 早诊率 / 晚期占比 / 跨市就医率 / 随访覆盖率）',cols:['地市','患者数','早诊率','晚期占比','跨市就医率','随访覆盖率'],matrix:
    cityRows.filter(function(r){return r.n>0}).sort(function(a,b){return b.n-a.n}).map(function(r){
      return [r.city,r.n,r.agg.earlyRate+'%',r.agg.lateRate+'%',r.agg.crossCityRate+'%',r.agg.fuRate+'%'];
    })};
  return {groups:groups,siteDetail:siteDetail,cityDetail:cityDetail};
}
function spMetricsTable(list,agg,siteRows,cityRows){
  var m=spMetricsGroups(list,agg,siteRows,cityRows);
  /* 概览型分组：三列（指标 / 数值 / 口径） */
  var ovBody=m.groups.map(function(g){
    var head='<tr class="sp-mt-grouprow"><td colspan="3">'+esc(g.group)+'</td></tr>';
    var rows=g.rows.map(function(r){
      return '<tr><td class="txt">'+esc(r[0])+'</td><td class="num">'+esc(String(r[1]))+'</td><td class="txt sp-mt-note">'+esc(r[2])+'</td></tr>';
    }).join('');
    return head+rows;
  }).join('');
  var ovTable='<div class="sp-table-wrap"><table class="data-table sp-mt-table" style="min-width:560px"><thead><tr><th class="txt">指标</th><th class="num">数值</th><th class="txt">口径 / 说明</th></tr></thead><tbody>'+ovBody+'</tbody></table></div>';
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
    '<div class="sp-mt-sub">当前范围：<b>'+scopeTxt+'</b> · 共 '+agg.total+' 例在管 · 与各图形页同源实时聚合，口径一致</div></div>'+
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
  var out=[['分组','指标','数值','口径/说明']];
  m.groups.forEach(function(g){
    g.rows.forEach(function(r){out.push([g.group,r[0],String(r[1]),r[2]]);});
  });
  /* 明细矩阵：分组名 + 列头 + 每行拼成「列=值」描述，保留结构又能单元格化 */
  [m.siteDetail,m.cityDetail].forEach(function(d){
    out.push([d.group,'','','']);
    out.push(['','','', d.cols.join(' / ')]);
    d.matrix.forEach(function(row){
      out.push([d.group,String(row[0]),row.slice(1).join(' / '),d.cols.slice(1).join(' / ')]);
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
var _wbFilters={q:'',site:'',stage:'',city:'',fu:''};
var _wbDetail=null;

function spWbFiltered(){
  return tumorEvents.filter(function(e){
    var q=_wbFilters.q;
    if(q){
      var hit=[e.patient,e.region,e.site,e.path,e.hospital].some(function(x){return String(x||'').indexOf(q)>=0});
      if(!hit)return false;
    }
    if(_wbFilters.site&&e.site!==_wbFilters.site)return false;
    if(_wbFilters.stage&&e.stage!==_wbFilters.stage)return false;
    if(_wbFilters.city&&e.city!==_wbFilters.city)return false;
    if(_wbFilters.fu&&e.followStatus!==_wbFilters.fu)return false;
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
  var v=e.vitalStatus||'';
  var cls=v==='死亡'?'badge-neutral':(v==='失访'?'badge-danger':(v.indexOf('带瘤')>=0?'badge-caution':'badge-success'));
  return badge(v,cls);
}
function renderWorkbench(){
  if(_wbDetail){
    var ev=tumorEvents.filter(function(e){return e.id===_wbDetail})[0];
    if(ev)return spDetailPage(ev);
  }
  var list=spWbFiltered();
  var bar='<div class="sp-filter-bar">'+
    '<div class="form-group wide"><label>关键字</label><input id="spWbQ" placeholder="姓名 / 地区 / 瘤种 / 医院" value="'+esc(_wbFilters.q)+'"></div>'+
    '<div class="form-group"><label>瘤种</label><select id="spWbSite"><option value="">全部</option>'+SP_SITES.map(function(s){return '<option'+(s===_wbFilters.site?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>分期</label><select id="spWbStage"><option value="">全部</option>'+SP_STAGE_GROUPS.map(function(s){return '<option'+(s===_wbFilters.stage?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>地市</label><select id="spWbCity"><option value="">全部</option>'+SP_CITIES.map(function(c){return '<option'+(c===_wbFilters.city?' selected':'')+'>'+c+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>随访状态</label><select id="spWbFu"><option value="">全部</option>'+['随访中','失访','死亡结案'].map(function(s){return '<option'+(s===_wbFilters.fu?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
    '<div class="sp-filter-actions"><button class="btn btn-ghost btn-sm" onclick="window._spWbReset()">重置</button><button class="btn btn-primary btn-sm" onclick="window._spWbQuery()">查询</button></div>'+
  '</div>';
  var rows=list.map(function(e){
    return '<tr style="cursor:pointer" onclick="window._spOpenDetail(\''+e.id+'\')">'+
      '<td style="font-weight:600">'+esc(e.patient)+'</td><td>'+esc(e.sex)+'</td><td>'+e.age+'</td>'+
      '<td>'+esc(e.city)+'</td><td>'+esc(e.hospital||'—')+'</td>'+
      '<td>'+esc(e.site)+'</td><td>'+esc(e.laterality)+'</td><td>'+esc(e.path)+'</td>'+
      '<td>'+esc(e.stage)+'</td><td>'+e.treatMode.map(function(m){return badge(m,'badge-info')}).join(' ')+'</td>'+
      '<td>'+spFuVitalCell(e)+'</td>'+    '</tr>';
  }).join('');
  var table='<div class="panel"><div class="panel-header"><span>患者列表<span class="spr-count">共 '+list.length+' 例 · 全部 '+tumorEvents.length+' 例</span></span></div>'+
    '<div class="sp-table-wrap"><table class="data-table" style="min-width:1232px"><thead><tr><th class="txt">患者</th><th class="code">性别</th><th class="num">年龄</th><th class="txt">户籍地市</th><th class="txt">就诊医院</th><th class="txt">瘤种</th><th class="txt">部位</th><th>病理</th><th class="code">分期</th><th class="code">治疗方式</th><th class="code">随访状态</th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="11" style="text-align:center;color:var(--color-text-muted);padding:30px 0">无符合条件的患者</td></tr>')+
    '</tbody></table></div></div>';
  return bar+table;
}

/* ---- 详情：摘要条 + 四块画像 + 时间线 ---- */
function spProfileCompleteness(e){
  /* 按四类画像要素的实际纳入口径统计（与画像块展示项一一对应） */
  var req=[e.sex,e.age,e.region,e.hospital,e.insurance,(e.screenDate||e.screenType),
    e.laterality,e.path,e.stage,e.tNm,e.diagDate,e.stageDate,
    e.treatments&&e.treatments.length,e.mdt,spFirstTreat(e),
    e.referral!==undefined,e.vitalStatus,e.lastFu,
    spSurvival(e).n!==null,
    (e.vitalStatus!=='死亡'||!!e.deathCause)];
  var ok=req.filter(function(v){return v&&v!=='未填'}).length;
  return {ok:ok,n:req.length,rate:Math.round(ok/req.length*100)};
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
  return '<div class="sp-tl-legend"><span><i style="background:var(--color-primary)"></i>诊疗节点</span><span><i style="background:#f59e0b"></i>检查检验（画像依据）</span><span><i style="background:#14b8a6"></i>转诊</span></div><div class="sp-timeline">'+uniq.map(function(nd){
    return '<div class="sp-tl-item'+(nd.t===1?' sp-tl-exam':nd.t===2?' sp-tl-ref':'')+'"><div class="sp-tl-date">'+esc(nd.d)+'</div><div class="sp-tl-content">'+esc(nd.c)+'</div></div>';
  }).join('')+'</div>';
}
function spDirBadge(d){
  return badge(d,d.indexOf('下转')>=0?'badge-accent':d.indexOf('跨')>=0?'badge-caution':'badge-info');
}
function spExamTable(pid){
  var list=SP_EXAMS[pid]||[];
  if(!list.length)return '<div class="sp-chart-empty">暂无检查检验记录</div>';
  return '<div class="sp-table-wrap"><table class="data-table" style="min-width:620px"><thead><tr><th style="width:96px">时间</th><th style="width:60px">类型</th><th style="width:210px">项目</th><th class="txt">结果（结论）</th><th style="width:88px">操作</th></tr></thead><tbody>'+
  list.map(function(x,i){
    return '<tr><td>'+esc(x.d)+'</td><td>'+badge(x.k,x.k==='检查'?'badge-info':'badge-accent')+'</td><td>'+esc(x.n)+(x.hot?'<span class="sp-hot">画像依据</span>':'')+'<div style="font-size:var(--fs-2xs);color:var(--color-text-muted)">'+esc(x.org)+'</div></td><td class="txt">'+esc(x.r)+' '+(x.abn?badge('异常','badge-caution'):badge('未见异常','badge-success'))+'</td><td class="ops"><button class="btn btn-ghost btn-xs" onclick="window._spExamView(\''+pid+'\','+i+')">查看结果</button></td></tr>';
  }).join('')+'</tbody></table></div>';
}
function spRefTable(pid){
  var list=SP_REFERRALS[pid]||[];
  if(!list.length)return '<div class="sp-chart-empty">无转院就诊记录（本机构直接建档管理）</div>';
  return '<div class="sp-table-wrap"><table class="data-table" style="min-width:672px"><thead><tr><th style="width:96px">时间</th><th style="width:88px">类型</th><th style="width:36%">转出 → 转入</th><th class="txt">事由/目的</th><th style="width:190px">接诊状态</th><th style="width:72px">操作</th></tr></thead><tbody>'+
  list.map(function(x,i){
    return '<tr><td>'+esc(x.d)+'</td><td>'+spDirBadge(x.dir)+'</td><td>'+esc(x.from)+'<span style="color:var(--color-primary);padding:0 6px">→</span>'+esc(x.to)+'</td><td class="txt">'+esc(x.reason)+'</td><td>'+esc(x.status)+'</td><td class="ops"><button class="btn btn-ghost btn-xs" onclick="window._spRefView(\''+pid+'\','+i+')">查看</button></td></tr>';
  }).join('')+'</tbody></table></div>';
}
function spRptSec(title,bodyHtml){return '<div class="sp-rpt-sec"><div class="sp-rpt-t">'+esc(title)+'</div><div class="sp-rpt-c">'+bodyHtml+'</div></div>'}
/* ================= 检查检验结果：宽幅阅片式查看器（内联于 IIFE，可访问私有数据） =================
   替换原 spModal(min(720px,100%)×86vh 单栏) —— 影像与报告挤在一起导致信息显示不全。
   注意：SP_EXAMS / tumorEvents / esc / badge / spRptSec 均为本 IIFE 私有，故必须内联，不可拆成外部脚本。 */
/* ---- 影像材料登记表：key = 检查日期|检查项目名 ----------------------
   src   : 影像地址（可为 data URI、相对路径、或 PACS 预览图 URL）
   series: 序列数组 [{name:'正位PA', src:'...', note:''}]
   roi   : 病灶标注，相对主图百分比 {x,y,r}（0~100）
   size  : 测量值文案
   --------------------------------------------------------------------- */
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
    size: '3.2 × 2.7 cm',
    series: [{ name: '正位 PA' }, { name: '侧位 LAT' }, { name: '局部放大' }, { name: '历史对比 2025-06' }]
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
    size: '3.4 × 2.8 cm',
    series: [{ name: '肺窗' }, { name: '纵隔窗' }, { name: '增强动脉期' }, { name: '冠状位 MPR' }, { name: '淋巴结 4R' }]
  }
};

/* 按检查类型推断阅片位占位说明（无图时使用） */
function spImgPlaceholder(kind) {
  if (kind === '检验') return null;
  if (/CT/i.test(kind)) return { tip: 'CT 断层影像', hint: '可接入 PACS 调阅原始 DICOM 序列' };
  if (/MRI|MR/i.test(kind)) return { tip: 'MRI 断层影像', hint: '可接入 PACS 调阅原始 DICOM 序列' };
  if (/DR|X线|钼靶|X光/i.test(kind)) return { tip: 'X 线 / DR 影像', hint: '可接入 PACS 调阅原始影像' };
  if (/骨显像|ECT|PET/i.test(kind)) return { tip: '核医学影像', hint: '可接入 PACS 调阅原始影像' };
  return { tip: '影像资料', hint: '可接入 PACS 调阅原始影像' };
}

/* ---- 阅片器（左栏） ---- */
function spImagingPane(x) {
  var img = EXAM_IMAGES[x.d + '|' + x.n];
  var ph = spImgPlaceholder(x.k);
  var head = '<div class="spvw-pane-head"><span class="spvw-pane-title">影像资料</span>' +
    '<span class="spvw-pane-sub">' + esc(x.n) + ' · ' + esc(x.d) + '</span></div>';

  if (!img) {
    if (!ph) return '';
    return '<section class="spvw-pane spvw-pane-img">' + head +
      '<div class="spvw-viewer"><div class="spvw-noimg">' +
      '<div class="spvw-noimg-ico">🖼</div>' +
      '<div class="spvw-noimg-t">' + esc(ph.tip) + '</div>' +
      '<div class="spvw-noimg-h">' + esc(ph.hint) + '</div>' +
      '</div></div></section>';
  }

  var roiStyle = img.roi
    ? 'left:' + img.roi.x + '%;top:' + img.roi.y + '%;width:' + (img.roi.r * 2) + '%;padding-bottom:' + (img.roi.r * 2) + '%'
    : '';
  var tools = [
    ['🔍', '原始', 1], ['✨', '增强', 0], ['⚖', '对比', 0], ['📏', '测量', 0],
    ['◐', '窗宽', 0], ['☀', '窗位', 0], ['↻', '翻转', 0], ['⤢', '全屏', 0]
  ].map(function (t) {
    return '<button class="spvw-tool' + (t[2] ? ' active' : '') + '" type="button">' +
      '<i>' + t[0] + '</i><span>' + t[1] + '</span></button>';
  }).join('');

  var thumbs = (img.series || []).map(function (s, i) {
    return '<div class="spvw-thumb' + (i === 0 ? ' active' : '') + '">' + esc(s.name) + '</div>';
  }).join('');

  return '<section class="spvw-pane spvw-pane-img">' + head +
    '<div class="spvw-viewer">' +
    '<div class="spvw-stage">' +
    '<img class="spvw-img" src="' + img.src + '" alt="' + esc(x.n) + '">' +
    '<div class="spvw-ovl">' +
    '<div>STUDY: ' + esc(x.n) + '</div>' +
    '<div>DATE: ' + esc(x.d) + '</div>' +
    '<div>ORG: ' + esc(x.org) + '</div>' +
    '</div>' +
    (roiStyle ? '<div class="spvw-roi" style="' + roiStyle + '"></div>' : '') +
    (img.size ? '<div class="spvw-measure">◉ ' + esc(img.size) + '</div>' : '') +
    '</div>' +
    '<div class="spvw-tools">' + tools + '</div>' +
    (thumbs ? '<div class="spvw-thumbs">' + thumbs + '</div>' : '') +
    '</div></section>';
}

/* ---- 主入口：检查检验结果查看器（表格内 onclick="window._spExamView(...)" 调用）---- */
function _spExamView(pid, i) {
  var x = (SP_EXAMS[pid] || [])[i]; if (!x) return;
  var e = tumorEvents.filter(function (t) { return t.id === pid; })[0];
  var hasImg = !!EXAM_IMAGES[x.d + '|' + x.n] || !!spImgPlaceholder(x.k);

  /* 顶部患者信息条 */
  var info = '<div class="spvw-info">' +
    '<span><b>患者</b>' + esc(e ? e.patient + '（' + e.sex + '，' + e.age + '岁）' : pid) + '</span>' +
    '<span><b>时间</b>' + esc(x.d) + '</span>' +
    '<span><b>类型</b>' + esc(x.k) + '</span>' +
    '<span><b>机构</b>' + esc(x.org) + '</span>' +
    (x.hot ? '<span>' + badge('画像依据', 'badge-info') + '</span>' : '') +
    (x.abn ? '<span>' + badge('结果异常', 'badge-caution') : '<span>' + badge('未见异常', 'badge-success')) + '</span>' +
    '</div>';

  /* 报告正文 */
  var body = '';
  if (x.items) {
    body += '<div class="sp-rpt-sec"><div class="sp-rpt-t">检验结果明细</div><div class="sp-table-wrap">' +
      '<table class="data-table" style="min-width:620px"><thead><tr><th class="txt">项目</th><th style="width:130px">结果</th><th style="width:86px">单位</th><th style="width:110px">参考区间</th><th style="width:44px">提示</th></tr></thead><tbody>' +
      x.items.map(function (it) {
        var f = it[4] || '', ab = f === '↑' || f === '↓' || f === '+';
        return '<tr' + (ab ? ' class="sp-lab-abn"' : '') + '><td class="txt">' + esc(it[0]) + '</td><td style="font-weight:700">' + esc(String(it[1])) + '</td><td>' + esc(it[2] || '—') + '</td><td>' + esc(it[3] || '—') + '</td><td style="font-weight:700">' +
          (f === '↑' || f === '+' ? '<span style="color:var(--color-danger-fg)">' + (f === '+' ? '+' : '↑') + '</span>' : f === '↓' ? '<span style="color:var(--color-primary)">↓</span>' : '') +
          '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  } else if (x.j) {
    body += spRptSec(x.k === '检查' ? '检查所见' : '大体与镜下所见', esc(x.j));
  }
  if (x.y) body += spRptSec(x.items ? '结果说明' : (x.k === '检查' ? '影像/内镜结论' : '诊断意见'), esc(x.y));
  body += spRptSec('结论小结', esc(x.r) + ' ' + (x.abn ? badge('结果异常', 'badge-caution') : badge('未见异常', 'badge-success')));

  /* 结论区高亮（异常时）：文案按检查/检验区分，不硬套「影像」二字 */
  if (x.abn) {
    var isExam = x.k === '检查';
    var alertT = isExam
      ? '本项检查结果异常，建议结合影像所见与临床进一步评估'
      : '本项检验结果异常，建议结合临床与既往基线进一步评估';
    var alertC = isExam
      ? '请主管医师确认后续诊疗路径；如需多学科讨论可在 MDT 模块发起。'
      : '如为疗效监测指标，建议与基线值及既往趋势对比判读。';
    body += '<div class="spvw-alert"><span class="spvw-alert-ico">⚠</span><div>' +
      '<div class="spvw-alert-t">' + alertT + '</div>' +
      '<div class="spvw-alert-c">' + alertC + '</div>' +
      '</div></div>';
  }

  var foot = '<button class="btn btn-ghost btn-sm" data-sp-close>关闭</button>' +
    (hasImg && x.k === '检查' ? '<button class="btn btn-ghost btn-sm" type="button">调阅 PACS 原始影像</button>' : '') +
    '<button class="btn btn-primary btn-sm" type="button">导出报告 PDF</button>';

  spModalWide(
    '检查检验结果 · ' + x.n,
    '<div class="spvw' + (hasImg ? '' : ' spvw-narrow') + '">' +
    (hasImg ? spImagingPane(x) : '') +
    '<section class="spvw-pane spvw-pane-rpt">' +
    '<div class="spvw-rpt-body">' + info + body + '</div>' +
    '</section></div>',
    foot
  );
}
window._spExamView = _spExamView;

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
  /* 阅片器轻交互：工具切换 / 序列切换 */
  box.querySelectorAll('.spvw-tool').forEach(function (b) {
    b.addEventListener('click', function () {
      box.querySelectorAll('.spvw-tool').forEach(function (t) { t.classList.remove('active'); });
      this.classList.add('active');
    });
  });
  box.querySelectorAll('.spvw-thumb').forEach(function (t) {
    t.addEventListener('click', function () {
      box.querySelectorAll('.spvw-thumb').forEach(function (o) { o.classList.remove('active'); });
      this.classList.add('active');
    });
  });
  (document.getElementById('pageContainer') || document.body).appendChild(mask);
  return mask;
}

/* ---- 样式注入（复用站点设计令牌） ---- */
(function () {
  if (document.getElementById('spvw-style')) return;
  var st = document.createElement('style');
  st.id = 'spvw-style';
  st.textContent = `
.spvw-mask{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:1200;padding:24px}
.spvw-box{display:flex;flex-direction:column;width:min(1240px,100%);height:min(92vh,900px);background:var(--surface);border-radius:var(--radius-lg);box-shadow:0 24px 60px rgba(15,23,42,.34);overflow:hidden}
.spvw-head{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--color-border);flex:0 0 auto;background:var(--surface)}
.spvw-head-t{font-size:var(--fs-h2);font-weight:var(--fw-bold);color:var(--color-text-title)}
.spvw-x{width:30px;height:30px;border:0;border-radius:var(--radius-sm);background:transparent;color:var(--color-text-muted);cursor:pointer;font-size:20px;line-height:1;transition:background var(--dur-fast)}
.spvw-x:hover{background:var(--color-gray-100);color:var(--color-text-title)}
.spvw-body{flex:1 1 auto;min-height:0;overflow:hidden;padding:0}
.spvw-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--color-border);flex:0 0 auto;background:var(--surface)}

.spvw{display:grid;grid-template-columns:minmax(340px,400px) 1fr;height:100%;min-height:0}
.spvw.spvw-narrow{grid-template-columns:1fr}
.spvw-pane{min-width:0;min-height:0;display:flex;flex-direction:column}
.spvw-pane-img{border-right:1px solid var(--color-border);background:var(--color-gray-25)}
.spvw-pane-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px;border-bottom:1px solid var(--color-border);flex:0 0 auto}
.spvw-pane-title{display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);font-weight:var(--fw-bold);color:var(--color-text-title)}
.spvw-pane-title::before{content:'';width:3px;height:12px;background:var(--color-primary);border-radius:2px}
.spvw-pane-sub{font-size:var(--fs-xs);color:var(--color-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spvw-viewer{padding:14px;display:flex;flex-direction:column;gap:10px;overflow:auto;min-height:0}

.spvw-stage{position:relative;width:100%;aspect-ratio:1/1;background:#0a0a0a;border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--color-gray-300)}
.spvw-img{width:100%;height:100%;object-fit:cover;display:block}
.spvw-ovl{position:absolute;left:10px;top:10px;background:rgba(0,0,0,.62);color:#fff;font-size:10px;line-height:1.65;padding:7px 9px;border-radius:var(--radius-xs);max-width:78%;backdrop-filter:blur(3px)}
.spvw-ovl div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spvw-roi{position:absolute;border:2px dashed #ef4444;border-radius:50%;box-sizing:border-box;animation:spvwPulse 2s infinite;pointer-events:none}
@keyframes spvwPulse{0%,100%{opacity:1}50%{opacity:.5}}
.spvw-measure{position:absolute;right:10px;bottom:10px;background:rgba(220,38,38,.92);color:#fff;font-size:var(--fs-xs);font-weight:var(--fw-bold);padding:6px 10px;border-radius:var(--radius-sm);display:flex;align-items:center;gap:5px}

.spvw-tools{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.spvw-tool{display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 2px;border:1px solid var(--color-border);background:var(--surface);border-radius:var(--radius-sm);font-size:var(--fs-2xs);color:var(--color-text-body);cursor:pointer;font-family:inherit;transition:all var(--dur-fast)}
.spvw-tool i{font-style:normal;font-size:13px;line-height:1}
.spvw-tool:hover{border-color:var(--color-primary-300);color:var(--color-primary);background:var(--color-primary-50)}
.spvw-tool.active{background:var(--color-primary);border-color:var(--color-primary);color:var(--color-text-invert)}

.spvw-thumbs{display:flex;gap:7px;overflow-x:auto;padding-bottom:2px}
.spvw-thumb{flex:0 0 auto;min-width:74px;height:54px;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px;background:var(--color-gray-100);border:2px solid var(--color-border);border-radius:var(--radius-sm);font-size:var(--fs-2xs);color:var(--color-text-muted);cursor:pointer;transition:all var(--dur-fast);line-height:1.25}
.spvw-thumb:hover{border-color:var(--color-gray-400)}
.spvw-thumb.active{border-color:var(--color-primary);color:var(--color-primary);background:var(--color-primary-50)}

.spvw-noimg{width:100%;aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:var(--color-gray-100);border:1px dashed var(--color-gray-300);border-radius:var(--radius-md);color:var(--color-text-muted);text-align:center;padding:20px}
.spvw-noimg-ico{font-size:30px;opacity:.5}
.spvw-noimg-t{font-size:var(--fs-body);font-weight:var(--fw-semibold);color:var(--color-text-body)}
.spvw-noimg-h{font-size:var(--fs-xs)}

.spvw-pane-rpt{background:var(--surface)}
.spvw-rpt-body{padding:16px 20px 22px;overflow:auto;min-height:0;flex:1 1 auto}
.spvw-info{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:var(--fs-sm);color:var(--color-text-body);margin-bottom:14px;padding-bottom:12px;border-bottom:1px dashed var(--color-border)}
.spvw-info b{color:var(--color-text-muted);font-weight:var(--fw-medium);margin-right:4px}

.spvw-alert{display:flex;gap:10px;align-items:flex-start;margin-top:14px;padding:12px 14px;background:var(--color-danger-bg);border:1px solid var(--color-danger-border);border-left:3px solid var(--color-danger-solid);border-radius:0 var(--radius-md) var(--radius-md) 0}
.spvw-alert-ico{font-size:15px;line-height:1.4}
.spvw-alert-t{font-size:var(--fs-sm);font-weight:var(--fw-semibold);color:var(--color-danger-fg)}
.spvw-alert-c{font-size:var(--fs-xs);color:var(--color-text-muted);margin-top:3px;line-height:1.6}

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
function spBlock(idx,title,tags,bodyHtml){
  return '<div class="sp-profile-block"><div class="sp-block-head"><span class="sp-block-idx">'+idx+'</span><span class="sp-block-title">'+esc(title)+'</span><span class="sp-block-tags">'+tags+'</span></div><div class="sp-block-body">'+bodyHtml+'</div></div>';
}
function spDetailPage(e){
  var cmp=spProfileCompleteness(e);
  var head='<div class="sp-detail-back"><button class="btn btn-ghost btn-sm" onclick="window._spBackList()">← 返回患者列表</button></div>'+
    '<div class="sp-patient-strip">'+
    '<div class="sp-patient-avatar">'+esc(e.patient.charAt(0))+'</div>'+
    '<div style="min-width:0"><div class="sp-patient-name">'+esc(e.patient)+'<span class="sp-patient-meta">'+esc(e.sex)+' · '+e.age+'岁 · '+esc(spMaskIdNo(e.idNo))+' · '+esc(spEmpi(e))+'</span></div>'+
    '<div class="sp-patient-sub">'+esc(e.region)+' · '+esc(e.insurance)+' · 确诊 '+esc(e.diagDate||e.stageDate||'—')+'</div></div>'+
    '<div class="sp-patient-score"><div class="k">画像完整度</div><div class="v">'+cmp.rate+'%</div></div>'+
    '</div>';
  /* 1 患者基础：一眼认清"这是谁"——性别年龄、户籍地、医保、就诊机构；筛查参与属预防端信息 */
  var b1='<div class="sp-kv-grid">'+
    spKvI('性别',e.sex)+
    spKvI('年龄',e.age+' 岁')+
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
  /* 2 肿瘤特征：瘤种身份（部位+病理+分化）+ 分期 + 时间起点 */
  var b2=spSub('瘤种与分期')+'<div class="sp-kv-grid">'+
    spKvI('原发部位',e.laterality)+
    spKvI('病理类型',spPathText(e))+
    spKvI('ICD-10',spIcd10(e)||'—')+
    spKvI('ICD-O-3 部位码',spTopoCode(e)||'—')+
    spKvI('ICD-O-3 形态码',spMorphCode(e)||'—')+
    spKvI('临床分期',e.stage)+
    spKvI('TNM',e.tNm||'—')+
    spKvI('确诊日期',e.diagDate||'—')+
    spKvI('分期依据',spStageBasisType(e))+
    spKvI('分期时间',e.stageDate||e.diagDate||'—')+
    spKvI('分期类型',spStageTiming(e))+
    '</div>';
  /* 3 诊疗过程：治疗与转诊（治疗方式三项同行；转诊仅记是否） */
  var b3=spSub('治疗与转诊')+'<div class="sp-kv-grid">'+
    spKvI('首次治疗日期',spFirstTreat(e)||'—')+
    spKvI('确诊→首次治疗',spTreatInterval(e))+
    spKvI('是否发生转诊',e.referral?'是':'否')+
    spKvI('MDT',e.mdt?'已开展':'未开展')+
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
    spBlock(1,'患者基础',badge(e.insurance,'badge-accent'),b1)+
    spBlock(2,'肿瘤特征',badge(e.stage,spEarly(e)?'badge-success':'badge-caution'),b2)+
    spBlock(3,'诊疗过程',e.mdt?badge('MDT','badge-info'):badge('未记录MDT','badge-neutral'),b3)+
    spBlock(4,'随访与结局',badge(e.followStatus,spFuCls(e))+badge(e.vitalStatus,'badge-neutral'),b5)+
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
 {key:'stagebasis',name:'分期依据',fn:function(e){return e.stage&&e.stageDate}},
 {key:'stagedate',name:'分期时间',fn:function(e){return e.stageDate}},
 {key:'stagetype',name:'分期类型（初诊/再分期）',fn:function(e){return e.stageDate}},
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
 {id:'DE04',dim:'肿瘤特征',name:'分期依据',src:'TNM分期质控',fkey:'stagebasis',on:true},
 {id:'DE05',dim:'肿瘤特征',name:'分期时间',src:'TNM分期质控',fkey:'stagedate',on:true},
 {id:'DE06',dim:'肿瘤特征',name:'分期类型（初诊/再分期）',src:'TNM分期质控',fkey:'stagetype',on:true},
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
var SP_ELEM_CHECK={stage:'R001',site_path:'R002',stagebasis:'R004',modes:'R006',tfirst:'R007',lastfu:'R011',death:'R012',survival:'R013'};
function spCheck(id){return SP_CHECKS.filter(function(c){return c.id===id})[0];}
/* 画像版本：含变更明细 */
var SP_VERSIONS=[
 {v:'V12.7',time:'2026-10-02 17:30',by:'管理员',desc:'新增「指标明细表」Tab：全部聚合指标列成可读表格，支持整表 CSV 导出与一键复制到 Excel',cur:true,changes:[
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
  if(city!==''&&city!==null&&city!==undefined)_spScope.city=city;
  if(site!==''&&site!==null&&site!==undefined)_spScope.site=site;
  if(city===''&&site===''){_spScope={city:'',site:''}}
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
  _wbFilters={q:'',site:_spScope.site,stage:'',city:_spScope.city,fu:''};
  if(typeof navigateTo==='function')navigateTo('sp-patients');
  else spRefresh();
};
window._spWbQuery=function(){
  var g=function(id){var el=document.getElementById(id);return el?String(el.value||'').trim():''};
  _wbFilters={q:g('spWbQ'),site:g('spWbSite'),stage:g('spWbStage'),city:g('spWbCity'),fu:g('spWbFu')};
  spRefresh();
};
window._spWbReset=function(){
  _wbFilters={q:'',site:'',stage:'',city:'',fu:''};spRefresh();
};
window._spOpenDetail=function(id){
  _wbDetail=id;spRefresh();
  var sc=document.getElementById('spMainContent');
  if(sc&&sc.scrollIntoView)sc.scrollIntoView({block:'start'});
};
window._spBackList=function(){
  _wbDetail=null;spRefresh();
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
  if(typeof navigateTo==='function')navigateTo('sp-patients');
  else{_spSub='workbench';spRefresh();}
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
})();
