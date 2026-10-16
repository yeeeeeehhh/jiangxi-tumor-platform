/* Focused report-card detail renderer: final card view + linked source data. */
(function(){
var detailStyle=document.createElement('style');
detailStyle.textContent='.report-tumor-record{margin-top:18px;border:1px solid #dfe8ed;border-radius:5px;overflow:hidden}.report-tumor-record:first-of-type{margin-top:0}.report-tumor-record .tumor-form-block{margin:0;padding:14px;border:0}'+
  /* 报告卡详情页只有一个肿瘤记录，外层再套一圈边框会与「基本信息」等无框区段不一致：
     去掉外框并让内层网格顶格对齐，使三段的左边界与列宽完全一致。 */
  '#report-card-tumor .report-tumor-record{border:0;border-radius:0;margin-top:0;overflow:visible}#report-card-tumor .report-tumor-record .tumor-form-block{padding:0}'+
  '.card-source-list{display:flex;flex-direction:column;gap:10px}.card-source-item{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 14px;border:1px solid #e0e8ed;border-radius:5px;background:#fbfdfd}.card-source-main{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}.card-source-id{color:var(--primary);font-weight:600;font-size:13px;text-decoration:none}.card-source-meta{font-size:12px;color:#66809b}.card-source-side{display:flex;align-items:center;gap:10px;flex-shrink:0}.card-source-version{font-size:12px;font-weight:600;color:#41586e}'+
  /* 版本内容弹窗（只读）：修订记录行可点击 + 弹窗内字段分组与差异标记。
     弹窗层 z-index 取 99，让 showConfirm 的 100 稳稳压在它上面——「使用此版本」的二次确认要盖在版本弹窗之上。 */
  '.data-table tr.card-version-row{cursor:pointer}.data-table tr.card-version-row:hover{background:#f1f7ff}'+
  '.card-version-modal{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:99;display:flex;align-items:center;justify-content:center;padding:20px}.card-version-modal .card-version-box{background:#fff;border-radius:8px;max-width:720px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden}.card-version-head{display:flex;align-items:center;gap:8px;padding:16px 20px;border-bottom:1px solid var(--border)}.card-version-head h3{font-size:16px;font-weight:600;color:var(--primary)}.card-version-close{margin-left:auto;width:30px;height:30px;border:0;border-radius:4px;background:transparent;color:#64748b;cursor:pointer;font-size:16px}.card-version-close:hover{background:#f1f5f9;color:var(--danger)}.card-version-body{padding:16px 20px;overflow-y:auto;flex:1}.card-version-meta{display:flex;flex-direction:column;gap:6px;padding-bottom:14px;border-bottom:1px solid var(--border);margin-bottom:14px;font-size:13px;line-height:1.6;color:#64748b}.card-version-meta span{color:#334155}.card-version-group{margin-bottom:14px}.card-version-group:last-child{margin-bottom:0}.card-version-group-title{font-size:13px;font-weight:600;color:#17324d;margin-bottom:8px;padding-left:8px;border-left:3px solid var(--primary)}.card-version-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 18px}.card-version-field{display:flex;gap:8px;font-size:13px;line-height:1.6;min-width:0}.card-version-field .k{flex:0 0 92px;color:#8295a7}.card-version-field .v{flex:1 1 auto;min-width:0;color:#17324d;font-weight:600;word-break:break-all}.card-version-field .v.empty{color:#b0bcc9;font-weight:400}.card-version-changed{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:3px;background:#fff4e5;color:#b54708;font-size:11px;font-weight:600;margin-left:6px}.card-version-prev{display:block;font-size:12px;font-weight:400;color:#98a2b3;margin-top:2px}.card-version-foot{display:flex;gap:10px;justify-content:flex-end;padding:12px 20px;border-top:1px solid var(--border);background:#f8fafc}'+
  '@media(max-width:760px){.report-tumor-record-head{display:block}.report-tumor-record-head .badge{display:inline-flex;margin-top:8px}.card-source-item{flex-direction:column;align-items:flex-start}.card-version-fields{grid-template-columns:minmax(0,1fr)}.card-version-field .k{flex:0 0 78px}}';
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
/* 保存修改时追加的真实修订记录：按卡缓存，与种子数据合并后一起展示。
   种子数据只作历史演示，新记录一律进这里，别再往种子里塞。 */
var cardRevisionStore={};
/* 当前操作人（原型单人演示，与站内其它模块同一口径） */
var CARD_REVISION_USER='省级登记中心 · 陈敏';
function cardRevisionNow(){
 var d=new Date(),p=function(n){return (n<10?'0':'')+n};
 return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
}
/* 追加一条修订记录：版本号在「种子 + 已追加」的末尾上 +1，保证序列连续不重号 */
window.appendCardRevision=function(cardId,reason){
 if(!cardId)return null;
 var card=(window.reportCardListData||[]).find(function(item){return item.id===cardId});
 var base=card?getCardRevisions(card):cardRevisionSeed.slice();
 var list=cardRevisionStore[cardId]=cardRevisionStore[cardId]||[];
 var lastVer=base.concat(list).reduce(function(max,item){return Math.max(max,item.ver)},1);
 var record={ver:lastVer+1,time:cardRevisionNow(),by:CARD_REVISION_USER,reason:reason||'信息纠错'};
 list.push(record);
 return record;
};
function getCardRevisions(card){
  if(!card)return [];
  /* 合并卡显示完整修订链，普通卡只显示本卡修订 */
  var isMerged=/合并/.test(cardTypeOf(card));
  var base=isMerged?cardRevisionSeed.slice():cardRevisionSeed.slice(1);
  /* 叠加保存修改时追加的真实记录，按版本号升序 */
  var added=(cardRevisionStore[card.id]||[]).slice();
  return base.concat(added).sort(function(a,b){return a.ver-b.ver});
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
/* ---------- 版本内容弹窗（只读） ----------
   点修订记录任意一行（含当前生效版本行）弹出该版本的字段快照，就地核对这一版保存了什么。
   详情页本身不切态——看历史版本不该把整页字段都换掉，弹窗看完即走。
   弹窗只读；要真回退仍走弹窗底部的「使用此版本」，再经一次二次确认，查看与回退两条路径互不影响。
   同一时刻只允许一个版本弹窗：连点其他行直接替换弹窗内容，不叠加。 */
/* 弹窗字段按登记表单分组，分组内顺序即展示顺序；两组合计 17 项，与 cardVersionFields 同一批字段 */
var CARD_VERSION_GROUPS=[
 ['发病人口信息',[['姓名','name'],['身份证号码','idNo'],['性别','sex'],['出生日期','birth'],['联系电话','phone'],['民族','nation'],['婚姻状况','marriage'],['职业','job'],['工作单位','workUnit'],['户籍地址','household'],['常住地址','residence']]],
 ['肿瘤报告信息',[['发病部位','site'],['病理类型','pathology'],['ICD10','icd10'],['确诊日期','diagnosisDate'],['报告单位','reportUnit'],['报告日期','reportDate']]]
];
/* 取值为空或快照未覆盖统一按「空」处理：不报错、不留空白格、不出现 undefined */
function cardVersionValueText(value){
  if(value===undefined||value===null)return '';
  return String(value).trim();
}
/* 单个字段：字段名 → 取值；空值显示「（空）」。与卡片当前值不同则追加「已变更」+ 灰字当前值。
   差异是拿快照与卡片现值的原始值比，不看展示文案，免得「（空）」被当成有效值。 */
function cardVersionCell(label,key,snap,card){
  var raw=cardVersionValueText(snap?snap[key]:undefined);
  var now=cardVersionValueText(card?card[key]:undefined);
  var changed=raw!==now;
  return '<div class="card-version-field"><span class="k">'+cardDetailEscape(label)+'</span><span class="v'+(raw===''?' empty':'')+'">'+
   (raw===''?'（空）':cardDetailEscape(raw))+
   (changed?'<span class="card-version-changed">已变更</span><span class="card-version-prev">当前：'+(now===''?'（空）':cardDetailEscape(now))+'</span>':'')+
   '</span></div>';
}
/** 关掉版本内容弹窗（二次确认用的是另一个弹窗，不受影响） */
function closeCardVersionModal(){
  var modals=document.querySelectorAll('.card-version-modal');
  for(var i=0;i<modals.length;i++)modals[i].remove();
}
/** 打开某版本的版本内容弹窗（只读）；连点其他行 = 替换内容，始终只有一个弹窗 */
function openCardVersionModal(cardId,ver){
  var card=(window.reportCardListData||[]).find(function(item){return item.id===cardId});
  if(!card){toast('未找到该报告卡','error');return}
  var target=getCardRevisions(card).filter(function(r){return r.ver===ver})[0];
  if(!target){toast('未找到该版本','error');return}
  var snap=getCardVersionSnapshot(card,ver);
  var isCurrent=getCardCurrentVersion(card)===ver;
  closeCardVersionModal();
  var groups=CARD_VERSION_GROUPS.map(function(group){
    return '<div class="card-version-group"><div class="card-version-group-title">'+group[0]+'</div><div class="card-version-fields">'+
     group[1].map(function(field){return cardVersionCell(field[0],field[1],snap,card)}).join('')+'</div></div>';
  }).join('');
  var modal=document.createElement('div');
  modal.className='card-version-modal';
  modal.innerHTML='<div class="card-version-box">'+
   '<div class="card-version-head"><h3>V'+cardDetailEscape(ver)+' 版本内容</h3>'+
   (isCurrent?'<span class="badge badge-success">当前版本</span>':'<span class="badge badge-warning">历史版本</span>')+
   '<button class="card-version-close" title="关闭" onclick="closeCardVersionModal()">✕</button></div>'+
   '<div class="card-version-body"><div class="card-version-meta">'+
   '<div>版本时间：<span>'+cardDetailEscape(target.time)+'</span></div>'+
   '<div>修改人：<span>'+cardDetailEscape(target.by)+'</span></div>'+
   '<div>修改原因：<span>'+cardDetailEscape(target.reason)+'</span></div>'+
   '</div>'+groups+'</div>'+
   '<div class="card-version-foot"><button class="btn btn-ghost" onclick="closeCardVersionModal()">关闭</button>'+
   /* 当前生效版本不给「使用此版本」：已经是它了，回退自己讲不通 */
   (isCurrent?'':'<button class="btn btn-primary" onclick="useCardVersion(\''+cardDetailEscape(card.id)+'\','+ver+')">使用此版本</button>')+
   '</div></div>';
  modal.addEventListener('click',function(e){if(e.target===modal)closeCardVersionModal()});
  document.body.appendChild(modal);
}
/* 使用某历史版本：把该版本快照写回卡片，并把"当前版本"指向它。
   取消二次确认就退回版本内容弹窗（showConfirm 只关自己那层，版本弹窗还留着，天然满足"取消则回到弹窗"）。 */
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
    /* 回退后连同版本内容弹窗一起关掉，再刷新详情页——页面上不该留着"看历史版本"的残留 */
    closeCardVersionModal();
    window.cardListDetail(cardId);
    toast('已切换到 V'+ver);
   });
}
/* 修订记录行：整行可点 = 弹窗查看该版本内容（只读，含当前生效版本行）；末列为版本操作——
   当前生效版本显示「当前版本」标记，历史版本显示「使用此版本」按钮（回退，需二次确认）。
   两个动作刻意分开：点行只是看，点按钮才改数据，避免"想核对一下"却把卡片回退了。
   按钮上加 event.stopPropagation()，否则点「使用此版本」会连带触发整行的弹窗。 */
function revisionRow(item,card){
  var isCurrent=getCardCurrentVersion(card)===item.ver;
  var ops=isCurrent
   ?'<span class="badge badge-success">当前版本</span>'
   :'<button class="btn btn-primary btn-xs" onclick="event.stopPropagation();useCardVersion(\''+cardDetailEscape(card.id)+'\','+item.ver+')">使用此版本</button>';
  return '<tr class="card-version-row"'+(isCurrent?' style="background:#f0fdf4"':'')+' title="点击查看 V'+cardDetailEscape(item.ver)+' 的版本内容"'+
   ' onclick="openCardVersionModal(\''+cardDetailEscape(card.id)+'\','+item.ver+')">'+
   '<td class="code">V'+cardDetailEscape(item.ver)+'</td><td class="code">'+cardDetailEscape(item.time)+'</td><td class="txt">'+cardDetailEscape(item.by)+'</td><td class="txt">'+cardDetailEscape(item.reason)+'</td><td class="ops">'+ops+'</td></tr>';
}
function cardTypeOf(card){return (card.cardType||'').replace(/<[^>]+>/g,'').trim()||'-'}
function subsite(card){if(card.site==='肺')return '上叶';if(card.site==='胃')return '胃窦';if(card.site==='肝')return '右叶';if(card.site==='乳房')return '左乳';return '-'}
function tumorFields(card){var diagnosis=(card.site||'-')+'恶性肿瘤（'+(card.icd10||'-')+'）';var topo=card.topoCode||(card.site==='肺'?'C34.9':card.site==='胃'?'C16.9':card.site==='肝'?'C22.0':card.site==='乳房'||card.site==='乳腺'?'C50.9':card.icd10||'-');var morphMap={'鳞状细胞癌':'8070/3','腺癌':'8140/3','小细胞癌':'8041/3','浸润性导管癌':'8500/3','导管癌':'8500/3'};var morph=card.morphCode||morphMap[card.pathology]||'8000/3';return [['发病部位（大类）',card.site],['亚部位',subsite(card)],['病理类型',card.pathology],['肿瘤解剖学部位代码 (ICD-O-3)',topo],['肿瘤形态学代码 (ICD-O-3)',morph],['行为','/3 恶性'],['分级','II级'],['诊断依据','病理学诊断'],['临床分期','IIb期'],['TNM-T','T2'],['TNM-N','N0'],['TNM-M','M0'],['确诊日期',card.diagnosisDate],['自动 ICD10',card.icd10],['ICD10 编码',card.icd10],['治疗信息','手术 + 化疗'],['诊断结果',diagnosis],['详细诊断结果',(card.site||'-')+'部 '+(card.pathology||'-')+'，分级 II 级'],['单位区划',card.region],['诊断单位',card.reportUnit],['门诊号',card.outpatientNo],['住院号',card.inpatientNo],['报告日期',card.reportDate],['报告医师',card.doctor]]}
/* 宽字段的选取要让「列宽总和」正好是 4 的整数倍，否则末行会留下半排空格：
   24 个字段中让 诊断结果 / 详细诊断结果 / 报告日期 / 报告医师 各占 2 列，
   合计 28 列 = 7 行整。 */
var TUMOR_WIDE_FIELDS=['诊断结果','详细诊断结果','报告日期','报告医师'];
function tumorRecord(card){return '<div class="report-tumor-record"><div class="tumor-form-block"><div class="tumor-form-grid">'+tumorFields(card).map(function(field){return tumorFormField(field[0],field[1],false,TUMOR_WIDE_FIELDS.indexOf(field[0])>-1,field[0]==='自动 ICD10')}).join('')+'</div></div></div>'}
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
  /* shown 保留为别名：详情页恒渲染卡片现值，看历史版本走「版本内容弹窗」，整页字段不跟着快照切。 */
  var shown=display;
  var follow=window.reportCardFollowup&&window.reportCardFollowup[display.id]?window.reportCardFollowup[display.id]:{};
  var age=shown.birth?Math.floor((new Date()-new Date(shown.birth))/(365.25*24*3600*1000))+'岁':'-';
  var cardType=cardTypeOf(display);
  var canEdit=typeof cardCanEdit==='function'&&cardCanEdit(display);
  /* 宽字段（{wide:2}）的选取要让「列宽总和」正好是 4 的整数倍，否则末行会留下半排空格。
     本组 21 个字段，其中 7 个占 2 列 → 28 列 = 7 行整；分行为
     编号/记录类型/姓名/证件类型 · 证件号/身份证/性别/出生日期 · 年龄+电话(2)+联系人关系
     · 联系人+联系人电话(2)+民族 · 婚姻/职业+工作单位(2) · 户籍(2)+详细户籍(2) · 常住(2)+详细常住(2) */
  var basic=[['报告卡编号',shown.id],['记录类型','发病报告卡'],['报卡类型',cardType],['姓名',shown.name],['其它证件类型',shown.otherIdType],['其它证件号码',shown.otherIdNo],['身份证号码',shown.idNo],['性别',shown.sex],['出生日期',shown.birth],['年龄',age],['联系电话',shown.phone,{wide:2}],['联系人关系',shown.contactRelation],['联系人',shown.contactName],['联系人电话',shown.contactPhone,{wide:2}],['民族',shown.nation],['婚姻状况',shown.marriage],['职业',shown.job],['工作单位',shown.workUnit,{wide:2}],['户籍地址',shown.household,{wide:2}],['详细户籍地址',shown.householdDetail,{wide:2}],['常住地址',shown.residence,{wide:2}],['详细常住地址',shown.residenceDetail,{wide:2}]];
  var followFields=[['最后接触日期',follow.dlc],['最后接触状态',follow.state],['生存月数',follow.surmonth],['死亡地点',follow.deadplace],['根本死因',follow.caus],['死因 ICD10',follow.causicd],['死亡日期',follow.deathda],['死亡报告医师',follow.deadDoct]];
  var actions='<button class="btn btn-ghost btn-sm" onclick="switchReportDataView(\'cards\')">返回报告卡列表</button>'+
    (canEdit?'<button class="btn btn-primary btn-sm" onclick="cardListEdit(\''+cardDetailEscape(display.id)+'\')">编辑报告卡</button>':'')+
    '<button class="btn btn-outline btn-sm" onclick="typeof jumpToFollowupByCard===\'function\'&&jumpToFollowupByCard(\''+cardDetailEscape(display.id)+'\')">随访单据</button>'+
    (follow.state==='死亡'?'<button class="btn btn-outline btn-sm" onclick="typeof jumpToDeathByCard===\'function\'&&jumpToDeathByCard(\''+cardDetailEscape(display.id)+'\')">死亡信息列表</button>':'');
  var sources=getLinkedSources(display,group);
  var sourceSection='<section class="card-detail-section" id="report-card-source"><div class="card-detail-section-title">关联上报数据'+(sources.length?'<span style="font-weight:400;font-size:12px;color:#66809b;margin-left:8px">共 '+sources.length+' 条</span>':'')+'</div><div class="card-source-list">'+(sources.length?sources.map(function(record){return sourceRow(record,display)}).join(''):'<div class="card-detail-empty">暂无关联上报数据</div>')+'</div></section>';
  var tumor='<section class="card-detail-section" id="report-card-tumor"><div class="card-detail-section-title">肿瘤报告信息</div>'+tumorRecord(shown)+'</section>';
  var followSection='<section class="card-detail-section" id="report-card-follow"><div class="card-detail-section-title">随访信息</div><div class="tumor-form-grid">'+followFields.map(function(f){return cardDetailField(f[0],f[1])}).join('')+'</div></section>';
  var revisions=getCardRevisions(display);
  var revisionSection='<section class="card-detail-section" id="report-card-revision"><div class="card-detail-section-title">修订记录'+(revisions.length?'<span style="font-weight:400;font-size:12px;color:#66809b;margin-left:8px">共 '+revisions.length+' 次</span>':'')+'</div><div class="table-wrap"><table class="data-table" style="min-width:560px"><thead><tr><th class="code">版本</th><th class="code">修改时间</th><th class="txt">修改人</th><th class="txt">修改原因</th><th class="ops">操作</th></tr></thead><tbody>'+(revisions.length?revisions.map(function(item){return revisionRow(item,display)}).join(''):'<tr><td colspan="5" style="text-align:center;color:#98a2b3">暂无修订记录</td></tr>')+'</tbody></table></div></section>';
  var nav='<nav class="card-detail-nav" aria-label="报告卡详情导航">'+cardDetailNavItem('report-card-basic','基本信息')+cardDetailNavItem('report-card-tumor','肿瘤报告信息')+cardDetailNavItem('report-card-follow','随访信息')+cardDetailNavItem('report-card-source','关联上报数据',sources.length||'')+cardDetailNavItem('report-card-revision','修订记录',revisions.length||'')+'</nav>';
  /* 摘要条承担原顶部标题的身份信息：姓名 + 编号 + 报告日期，报卡类型以状态徽章呈现。
     报卡类型不再在「基本信息」里重复出现，避免同一值在一屏内出现三次。 */
  var basicFields=basic.filter(function(field){return field[0]!=='报卡类型'});
  var main='<main class="card-detail-main" id="card-detail-main"><div class="card-detail-summary"><div><div class="card-detail-patient">'+cardDetailEscape(shown.name)+' <span style="font-size:13px;font-weight:500;color:#66809b">'+cardDetailEscape(shown.sex||'')+' · '+age+'</span></div><div class="card-detail-meta">报告卡编号：'+cardDetailEscape(shown.id)+'　报告日期：'+cardDetailValue(shown.reportDate)+'</div></div></div>'+cardDetailSection('report-card-basic','基本信息',basicFields)+tumor+followSection+sourceSection+revisionSection+'</main>';
  var aside='';
  document.getElementById('pageContainer').innerHTML='<div class="card-detail-page"><div class="card-detail-topbar"><div class="card-detail-title">报告卡详情 <span style="color:#9fb0bf;font-weight:400;margin:0 6px">/</span> <span style="color:#8295a7;font-weight:500">'+cardDetailEscape(display.name)+' · '+cardDetailEscape(display.id)+'</span></div><div class="card-detail-actions">'+actions+'</div></div><div class="card-detail-workspace">'+nav+main+aside+'</div></div>';
  setActiveMenu('datamgmt-card');updateBreadcrumb('datamgmt-card','报告卡详情');window.scrollTo(0,0);
  scrollCardDetailSection('report-card-basic');
};
/* 暴露给修订记录行的内联 onclick 使用（IIFE 内的函数默认不可见） */
window.useCardVersion=useCardVersion;
window.openCardVersionModal=openCardVersionModal;
window.closeCardVersionModal=closeCardVersionModal;
/* 只读访问器：供外部（校验脚本 / 其它模块）查某卡的完整修订链，不暴露内部 store */
window.getCardRevisions=function(cardId){
 var card=(window.reportCardListData||[]).find(function(item){return item.id===cardId});
 return card?getCardRevisions(card):[];
};
})();
