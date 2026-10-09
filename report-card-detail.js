/* Focused report-card detail renderer: final card view + linked source data. */
(function(){
var detailStyle=document.createElement('style');
detailStyle.textContent='.report-tumor-record{margin-top:18px;border:1px solid #dfe8ed;border-radius:5px;overflow:hidden}.report-tumor-record:first-of-type{margin-top:0}.report-tumor-record .tumor-form-block{margin:0;padding:14px;border:0}.card-source-list{display:flex;flex-direction:column;gap:10px}.card-source-item{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 14px;border:1px solid #e0e8ed;border-radius:5px;background:#fbfdfd}.card-source-main{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}.card-source-id{color:var(--primary);font-weight:600;font-size:13px;text-decoration:none}.card-source-meta{font-size:12px;color:#66809b}.card-source-side{display:flex;align-items:center;gap:10px;flex-shrink:0}.card-source-version{font-size:12px;font-weight:600;color:#41586e}@media(max-width:760px){.report-tumor-record-head{display:block}.report-tumor-record-head .badge{display:inline-flex;margin-top:8px}.card-source-item{flex-direction:column;align-items:flex-start}}';
document.head.appendChild(detailStyle);

/* 合并关系（原型数据）：人工合并卡作为最终报告卡，统一管理同患者的原始卡/补报卡 */
var MERGE_FINAL_ID='JX-2026-000094';
var MERGE_MANAGED_IDS=['JX-2026-000091','JX-2026-000092','JX-2026-000093'];
window.ensureReportCardMergeGroup=function(rows){
  rows=rows||[];
  var final=rows.find(function(card){return card.id===MERGE_FINAL_ID});
  if(!final){
    final={id:MERGE_FINAL_ID,name:'张伟',sex:'男',birth:'1965-03-12',idNo:'360102196503121234',phone:'13800000001',job:'工人',nation:'汉族',marriage:'已婚',workUnit:'南昌第一机械厂',household:'江西省/南昌市/东湖区/董家窑街道',residence:'江西省/南昌市/东湖区/阳明路/民巷社区',site:'肺',pathology:'鳞状细胞癌',icd10:'C34.9',diagnosisDate:'2026-03-15',outpatientNo:'MZ240501',inpatientNo:'ZY240088',reportDate:'2026-06-20',doctor:'王医生',reportUnit:'江西省肿瘤医院',region:'南昌市东湖区',cardType:'<span class="badge badge-success">人工合并卡</span>',checkStatus:'<span class="badge badge-success">通过</span>',auditStatus:'<span class="badge badge-success">已核对</span>',errors:[],managedCards:MERGE_MANAGED_IDS.slice()};
    rows.push(final);
  }
  MERGE_MANAGED_IDS.forEach(function(id){var managed=rows.find(function(card){return card.id===id});if(managed&&!managed.managedBy)managed.managedBy=MERGE_FINAL_ID});
  if(window.reportCardFollowup&&!window.reportCardFollowup[MERGE_FINAL_ID])window.reportCardFollowup[MERGE_FINAL_ID]={dlc:'2026-06-15',state:'存活',deadplace:'-',caus:'-',causicd:'-',deathda:'-',deadDoct:'-'};
  return final;
};
ensureReportCardMergeGroup(window.reportCardListData);

function getMergeGroup(card){
  var cards=window.reportCardListData||[];
  var finalId=card&&card.managedBy?card.managedBy:(card&&card.managedCards?card.id:null);
  if(!finalId)return null;
  var final=cards.find(function(item){return item.id===finalId});
  if(!final)return null;
  var managed=(final.managedCards||[]).map(function(id){return cards.find(function(item){return item.id===id})}).filter(Boolean);
  return {final:final,managed:managed};
}
function getLinkedSources(display,group){
  var ids=[display.id].concat(group?group.managed.map(function(card){return card.id}):[]);
  return (typeof sourceDataRecords==='undefined'?[]:sourceDataRecords).filter(function(record){
    return (record.linkedCards||[]).some(function(cardId){return ids.indexOf(cardId)>-1});
  });
}
/* ---------- 报告卡修订记录 / 版本回滚 ----------
   每个版本保存该卡在该版本时的字段快照，支持「使用此版本」回滚。
   快照按报告卡编号 + 版本号缓存在 cardVersionStore，回滚后把快照字段写回卡片。 */
var cardVersionStore={};
/* 参与版本追踪的字段（与登记表单一致，回滚时整组覆盖） */
var cardVersionFields=['name','idNo','sex','birth','phone','nation','marriage','job','workUnit','household','residence','site','pathology','icd10','diagnosisDate','reportUnit','reportDate'];
var cardRevisionSeed=[
 {ver:2,time:'2026-06-22 10:15:32',by:'王医生',reason:'病理报告回补：补充病理类型与分级'},
 {ver:3,time:'2026-06-25 09:08:11',by:'李管理员',reason:'重卡合并：与 JX-2026-000093 合并'}
];
function getCardRevisions(card){
  if(!card)return [];
  /* 合并卡显示完整修订链，普通卡只显示本卡修订 */
  var isMerged=/合并/.test(cardTypeOf(card));
  return isMerged?cardRevisionSeed.slice():cardRevisionSeed.slice(1);
}
/* 取某版本的字段快照；未初始化过则按当前卡生成稳定的历史快照 */
function getCardVersionSnapshot(card,ver){
  var key=card.id||'__new__';
  cardVersionStore[key]=cardVersionStore[key]||{};
  if(cardVersionStore[key][ver])return cardVersionStore[key][ver];
  var snap={};cardVersionFields.forEach(function(f){snap[f]=card[f]});
  /* V2 代表"回补前"：病理类型与分级为空 */
  if(ver===2){snap.pathology='';snap.icd10=card.icd10;snap.site=card.site;snap.idNo=card.idNo}
  cardVersionStore[key][ver]=snap;
  return snap;
}
/* 当前生效版本号（默认取修订链中最新的一版） */
function getCardCurrentVersion(card){
  var revs=getCardRevisions(card);
  if(!revs.length)return 0;
  var key=card.id||'__new__';
  var cur=cardVersionStore[key]&&cardVersionStore[key].__current;
  return cur||revs[revs.length-1].ver;
}
/* 使用某历史版本：把该版本快照写回卡片，并把"当前版本"指向它 */
function useCardVersion(cardId,ver){
  var card=(window.reportCardListData||[]).find(function(item){return item.id===cardId});
  if(!card){toast('未找到该报告卡','error');return}
  var revs=getCardRevisions(card);
  var target=revs.filter(function(r){return r.ver===ver})[0];
  if(!target){toast('未找到该版本','error');return}
  var snap=getCardVersionSnapshot(card,ver);
  var cur=getCardCurrentVersion(card);
  if(cur===ver){toast('当前已是 V'+ver,'warning');return}
  showConfirm('使用此版本',
   '确定要使用 <strong>V'+ver+'</strong> 吗？<br><br>'+
   '<span style="color:#475467">版本时间：</span>'+cardDetailEscape(target.time)+'<br>'+
   '<span style="color:#475467">修改人：</span>'+cardDetailEscape(target.by)+'<br>'+
   '<span style="color:#475467">修改原因：</span>'+cardDetailEscape(target.reason)+'<br><br>'+
   '<span style="color:#b54708">该版本的字段值将覆盖当前内容，原当前版本（V'+cur+'）仍保留在修订记录中可再切回。</span>',
   function(){
    cardVersionFields.forEach(function(f){if(snap[f]!==undefined)card[f]=snap[f]});
    cardVersionStore[card.id]=cardVersionStore[card.id]||{};
    cardVersionStore[card.id].__current=ver;
    window.cardListDetail(cardId);
    toast('已切换到 V'+ver);
   });
}
/* 修订记录行：末列为版本操作——当前生效版本显示「当前版本」标记，历史版本显示「使用此版本」按钮 */
function revisionRow(item,card){
  var isCurrent=getCardCurrentVersion(card)===item.ver;
  var ops=isCurrent
   ?'<span class="badge badge-success">当前版本</span>'
   :'<button class="btn btn-primary btn-xs" onclick="useCardVersion(\''+cardDetailEscape(card.id)+'\','+item.ver+')">使用此版本</button>';
  return '<tr'+(isCurrent?' style="background:#f0fdf4"':'')+'><td class="code">V'+cardDetailEscape(item.ver)+'</td><td class="code">'+cardDetailEscape(item.time)+'</td><td class="txt">'+cardDetailEscape(item.by)+'</td><td class="txt">'+cardDetailEscape(item.reason)+'</td><td class="ops">'+ops+'</td></tr>';
}
function cardTypeOf(card){return (card.cardType||'').replace(/<[^>]+>/g,'').trim()||'-'}
function subsite(card){if(card.site==='肺')return '上叶';if(card.site==='胃')return '胃窦';if(card.site==='肝')return '右叶';if(card.site==='乳房')return '左乳';return '-'}
function tumorFields(card){var diagnosis=(card.site||'-')+'恶性肿瘤（'+(card.icd10||'-')+'）';var topo=card.topoCode||(card.site==='肺'?'C34.9':card.site==='胃'?'C16.9':card.site==='肝'?'C22.0':card.site==='乳房'||card.site==='乳腺'?'C50.9':card.icd10||'-');var morphMap={'鳞状细胞癌':'8070/3','腺癌':'8140/3','小细胞癌':'8041/3','浸润性导管癌':'8500/3','导管癌':'8500/3'};var morph=card.morphCode||morphMap[card.pathology]||'8000/3';return [['发病部位（大类）',card.site],['亚部位',subsite(card)],['病理类型',card.pathology],['肿瘤解剖学部位代码 (ICD-O-3)',topo],['肿瘤形态学代码 (ICD-O-3)',morph],['行为','/3 恶性'],['分级','II级'],['诊断依据','病理学诊断'],['临床分期','IIb期'],['TNM-T','T2'],['TNM-N','N0'],['TNM-M','M0'],['确诊日期',card.diagnosisDate],['自动 ICD10',card.icd10],['ICD10 编码',card.icd10],['治疗信息','手术 + 化疗'],['诊断结果',diagnosis],['详细诊断结果',(card.site||'-')+'部 '+(card.pathology||'-')+'，分级 II 级'],['单位区划',card.region],['诊断单位',card.reportUnit],['门诊号',card.outpatientNo],['住院号',card.inpatientNo],['报告日期',card.reportDate],['报告医师',card.doctor]]}
function tumorRecord(card){return '<div class="report-tumor-record"><div class="tumor-form-block"><div class="tumor-form-grid">'+tumorFields(card).map(function(field){return tumorFormField(field[0],field[1],false,field[0]==='诊断结果'||field[0]==='详细诊断结果',field[0]==='自动 ICD10')}).join('')+'</div></div></div>'}
/* 关联上报数据行：只展示源数据编号（可点）、上报单位、上报时间 + 查看按钮。
   其余信息（来源类型、批次、文件名与行号、关联卡、校验状态、版本号）在源数据详情页查看。 */
function sourceRow(record,display){
  return '<div class="card-source-item"><div class="card-source-main"><a class="card-source-id" href="javascript:void(0)" onclick="openSourceDataDetail(\''+record.id+'\')">'+record.id+'</a><span class="card-source-meta">'+cardDetailValue(record.org)+' · 上报 '+cardDetailValue(record.uploadTime)+'</span></div><div class="card-source-side"><button class="btn btn-ghost btn-xs" onclick="openSourceDataDetail(\''+record.id+'\')">查看完整信息</button></div></div>'
}
window.openCardDetailDialogById=function(id){  var card=(window.reportCardListData||[]).find(function(item){return item.id===id});
  if(!card){toast('未找到该报告卡','error');return}
  if(typeof openCardDetailDialog==='function')openCardDetailDialog(card);else toast('打开报告卡详情失败','error')
};

window.cardListDetail=function(id){
  var cards=window.reportCardListData||[];
  var current=cards.find(function(card){return card.id===id});
  if(!current){toast('未找到该报告卡','error');return}
  ensureReportCardMergeGroup(cards);
  var group=getMergeGroup(current);
  var display=group?group.final:current;
  var entered=group&&current.id!==display.id?current:null;
  var follow=window.reportCardFollowup&&window.reportCardFollowup[display.id]?window.reportCardFollowup[display.id]:{};
  var age=display.birth?Math.floor((new Date()-new Date(display.birth))/(365.25*24*3600*1000))+'岁':'-';
  var cardType=cardTypeOf(display);
  var canEdit=typeof cardCanEdit==='function'&&cardCanEdit(display);
  var basic=[['报告卡编号',display.id],['记录类型','发病报告卡'],['报卡类型',cardType],['姓名',display.name],['其它证件类型',display.otherIdType],['其它证件号码',display.otherIdNo],['身份证号码',display.idNo],['性别',display.sex],['出生日期',display.birth],['年龄',age],['联系电话',display.phone],['联系人关系',display.contactRelation],['联系人',display.contactName],['联系人电话',display.contactPhone],['民族',display.nation],['婚姻状况',display.marriage],['职业',display.job],['工作单位',display.workUnit],['户籍地址',display.household],['详细户籍地址',display.householdDetail],['常住地址',display.residence],['详细常住地址',display.residenceDetail]];
  var followFields=[['最后接触日期',follow.dlc],['最后接触状态',follow.state],['生存月数',follow.surmonth],['死亡地点',follow.deadplace],['根本死因',follow.caus],['死因 ICD10',follow.causicd],['死亡日期',follow.deathda],['死亡报告医师',follow.deadDoct]];
  var actions='<button class="btn btn-ghost btn-sm" onclick="switchReportDataView(\'cards\')">返回报告卡列表</button>'+
    (canEdit?'<button class="btn btn-primary btn-sm" onclick="cardListEdit(\''+cardDetailEscape(display.id)+'\')">编辑报告卡</button>':'')+
    '<button class="btn btn-outline btn-sm" onclick="typeof jumpToFollowupByCard===\'function\'&&jumpToFollowupByCard(\''+cardDetailEscape(display.id)+'\')">随访单据</button>'+
    (follow.state==='死亡'?'<button class="btn btn-outline btn-sm" onclick="typeof jumpToDeathByCard===\'function\'&&jumpToDeathByCard(\''+cardDetailEscape(display.id)+'\')">死亡信息列表</button>':'');
  var sources=getLinkedSources(display,group);
  var sourceSection='<section class="card-detail-section" id="report-card-source"><div class="card-detail-section-title">关联上报数据'+(sources.length?'<span style="font-weight:400;font-size:12px;color:#66809b;margin-left:8px">共 '+sources.length+' 条</span>':'')+'</div><div class="card-source-list">'+(sources.length?sources.map(function(record){return sourceRow(record,display)}).join(''):'<div class="card-detail-empty">暂无关联上报数据</div>')+'</div></section>';
  var tumor='<section class="card-detail-section" id="report-card-tumor"><div class="card-detail-section-title">肿瘤报告信息</div>'+tumorRecord(display)+'</section>';
  var followSection='<section class="card-detail-section" id="report-card-follow"><div class="card-detail-section-title">随访信息</div><div class="card-detail-fields">'+followFields.map(function(f){return cardDetailField(f[0],f[1])}).join('')+'</div></section>';
  var revisions=getCardRevisions(display);
  var revisionSection='<section class="card-detail-section" id="report-card-revision"><div class="card-detail-section-title">修订记录'+(revisions.length?'<span style="font-weight:400;font-size:12px;color:#66809b;margin-left:8px">共 '+revisions.length+' 次</span>':'')+'</div><div class="table-wrap"><table class="data-table" style="min-width:560px"><thead><tr><th class="code">版本</th><th class="code">修改时间</th><th class="txt">修改人</th><th class="txt">修改原因</th><th class="ops">操作</th></tr></thead><tbody>'+(revisions.length?revisions.map(function(item){return revisionRow(item,display)}).join(''):'<tr><td colspan="5" style="text-align:center;color:#98a2b3">暂无修订记录</td></tr>')+'</tbody></table></div></section>';
  var notice='';
  var nav='<nav class="card-detail-nav" aria-label="报告卡详情导航">'+cardDetailNavItem('report-card-basic','基本信息')+cardDetailNavItem('report-card-tumor','肿瘤报告信息')+cardDetailNavItem('report-card-follow','随访信息')+cardDetailNavItem('report-card-source','关联上报数据',sources.length||'')+cardDetailNavItem('report-card-revision','修订记录',revisions.length||'')+'</nav>';
  /* 摘要条承担原顶部标题的身份信息：姓名 + 编号 + 报告日期，报卡类型以状态徽章呈现。
     报卡类型不再在「基本信息」里重复出现，避免同一值在一屏内出现三次。 */
  var basicFields=basic.filter(function(field){return field[0]!=='报卡类型'});
  var main='<main class="card-detail-main" id="card-detail-main"><div class="card-detail-summary"><div><div class="card-detail-patient">'+cardDetailEscape(display.name)+' <span style="font-size:13px;font-weight:500;color:#66809b">'+cardDetailEscape(display.sex||'')+' · '+age+'</span></div><div class="card-detail-meta">报告卡编号：'+cardDetailEscape(display.id)+'　报告日期：'+cardDetailValue(display.reportDate)+'</div></div></div>'+cardDetailSection('report-card-basic','基本信息',basicFields)+tumor+followSection+sourceSection+revisionSection+'</main>';
  var aside='';
  document.getElementById('pageContainer').innerHTML='<div class="card-detail-page"><div class="card-detail-topbar"><div class="card-detail-title">报告卡详情 <span style="color:#9fb0bf;font-weight:400;margin:0 6px">/</span> <span style="color:#8295a7;font-weight:500">'+cardDetailEscape(display.name)+' · '+cardDetailEscape(display.id)+'</span></div><div class="card-detail-actions">'+actions+'</div></div>'+notice+'<div class="card-detail-workspace">'+nav+main+aside+'</div></div>';
  setActiveMenu('datamgmt-card');updateBreadcrumb('datamgmt-card','报告卡详情');window.scrollTo(0,0);scrollCardDetailSection('report-card-basic');
};
/* 暴露给修订记录行的内联 onclick 使用（IIFE 内的函数默认不可见） */
window.useCardVersion=useCardVersion;
})();
