(function(){
var style=document.createElement('style');
style.textContent='.report-card-tabs{display:flex;align-items:end;gap:4px;overflow-x:auto;border-bottom:1px solid #dfe8ed;margin:0 -20px 16px;padding:0 20px;scrollbar-width:thin}.report-card-tab{flex:0 0 auto;border:0;border-bottom:2px solid transparent;background:transparent;color:#60788f;padding:10px 13px 9px;cursor:pointer;font-size:13px;white-space:nowrap}.report-card-tab:hover{background:#f4f8fa;color:#0b7180}.report-card-tab.active{border-bottom-color:#168a94;color:#087c89;font-weight:700}.report-card-tab small{display:block;font-size:11px;color:#8295a7;font-weight:400;margin-top:3px}.report-card-tab.active small{color:#5e9498}';
document.head.appendChild(style);

function activateReportCardTab(section,cardId){
  section.querySelectorAll('.report-card-tab').forEach(function(tab){tab.classList.toggle('active',tab.dataset.cardId===cardId)});
  section.querySelectorAll('.report-tumor-record').forEach(function(record){record.hidden=record.dataset.cardId!==cardId});
}
function setupReportCardTabs(currentId){
  var section=document.getElementById('report-card-tumor');
  if(!section)return;
  var records=Array.from(section.querySelectorAll('.report-tumor-record'));
  if(records.length<2)return;
  var tabs=document.createElement('div');
  tabs.className='report-card-tabs';
  tabs.setAttribute('role','tablist');
  records.forEach(function(record,index){
    var title=record.querySelector('.report-tumor-record-title');
    var meta=record.querySelector('.report-tumor-record-meta');
    var cardId=(title&&title.textContent.split('：')[1]||'报告卡 '+(index+1)).trim();
    record.dataset.cardId=cardId;
    var tab=document.createElement('button');
    tab.type='button';tab.className='report-card-tab';tab.dataset.cardId=cardId;tab.setAttribute('role','tab');
    tab.innerHTML='报告卡 '+cardId+'<small>'+(meta?meta.textContent.replace('报告日期：','').split('　')[0]:'')+'</small>';
    tab.onclick=function(){activateReportCardTab(section,cardId)};
    tabs.appendChild(tab);
  });
  section.insertBefore(tabs,records[0]);
  activateReportCardTab(section,currentId);
}
var baseCardListDetail=window.cardListDetail;
window.cardListDetail=function(id){baseCardListDetail(id);setupReportCardTabs(id)};
})();
