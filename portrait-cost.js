/* 卫健委视角的患者医疗费用概览。真实接口通过 SPCost.setData({mode:'live',connected,updatedAt,records}) 注入。
   金额单位元；退款传正数，按 originalId 冲减原结算。按原结算日期统计截至数据日的净额。
   未注入数据时使用明确标注的静态演示记录，不从治疗次数/险种估算真实费用。 */
(function(root){
  'use strict';
  var PAY=['fund','other','account','cash'];
  var CATEGORIES=['药品费','检查检验费','治疗费','手术费','耗材费','其他费用'];
  var VISIT_TYPES=['住院','门诊慢特病','普通门急诊'];
  var COLORS=['var(--color-primary)','var(--color-warning-solid)','var(--color-success-solid)','var(--color-primary-300)','var(--color-primary-500)','var(--color-gray-400)'];
  var current=null,dataset=null,overviewContext=null,overviewUnit='yuan',overviewView='table';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function day(v){var s=String(v||'').slice(0,10),d=new Date(s+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(d)&&d.toISOString().slice(0,10)===s?s:''}
  function cents(v){if(v===null||v===undefined||v===''||typeof v==='boolean')return null;var n=Number(v);return Number.isFinite(n)&&n>=0&&Number.isSafeInteger(Math.round(n*100))?Math.round(n*100):null}
  function money(v){return v===null||v===undefined?'—':(v/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}
  function percent(a,b){return a===null||!b?'—':(a/b*100).toFixed(1)+'%'}
  function recordKey(r){return r.canonicalId?'canonical:'+r.canonicalId:JSON.stringify([r.source||'',r.hospitalCode||r.hospital||'',r.id||''])}
  function normalize(input,asOf){
    var unique=new Map(),issues=[],refunds=[];
    (input||[]).forEach(function(r){
      if(!r||!r.id||!day(r.date)){issues.push('结算标识或日期缺失');return}
      if(r.date.slice(0,10)>asOf)return;
      var key=recordKey(r),old=unique.get(key);
      if(!old||String(r.updatedAt||r.date)>=String(old.updatedAt||old.date))unique.set(key,r);
    });
    var result=[];
    unique.forEach(function(r,key){
      if(r.status==='refund'){refunds.push(r);return}
      if(r.status!=='settled')return;
      var total=cents(r.total);
      if(total===null){issues.push('结算总额缺失或无效');return}
      var row=Object.assign({},r,{key:key,date:day(r.date),total:total,tumorIds:Array.isArray(r.tumorIds)?r.tumorIds:[],refundCount:0});
      PAY.forEach(function(k){row[k]=cents(r[k])});
      row.items=Array.isArray(r.items)?r.items.map(function(x){return {id:x.id,itemCode:x.itemCode,category:CATEGORIES.includes(x.category)?x.category:'其他费用',name:x.name||x.category,amount:cents(x.amount)}}):null;
      row.otherBreakdown=Array.isArray(r.otherBreakdown)?r.otherBreakdown.map(function(x){return {name:x.name,amount:cents(x.amount)}}):null;
      result.push(row);
    });
    refunds.forEach(function(r){
      var target=result.find(function(x){return r.originalCanonicalId?x.canonicalId===r.originalCanonicalId:x.id===r.originalId&&x.source===r.source&&(x.hospitalCode||x.hospital)===(r.hospitalCode||r.hospital)});
      if(!target){issues.push('退款未关联有效原结算');return}
      var total=cents(r.total);
      if(total===null||total>target.total){issues.push('退款金额无效，原结算待核对');target.invalid=true;return}
      target.total-=total;target.refundCount++;
      PAY.forEach(function(k){var n=cents(r[k]);target[k]=target[k]===null||n===null?null:target[k]-n;if(target[k]!==null&&target[k]<0)target.invalid=true});
      if(target.items&&Array.isArray(r.items)){
        r.items.forEach(function(item){var cat=CATEGORIES.includes(item.category)?item.category:'其他费用',n=cents(item.amount);
          if(n===null){target.items=null;return}
          if(!target.items)return;
          var matches=target.items.filter(function(x){return x.category===cat&&(item.id?x.id===item.id:item.itemCode?x.itemCode===item.itemCode:item.name?x.name===item.name:true)});
          if(!n)return;
          if(matches.length!==1||matches[0].amount===null||matches[0].amount<n){target.items=null;return}
          matches[0].amount-=n;
        });
      }else target.items=null;
      target.otherBreakdown=null;
    });
    result=result.filter(function(r){if(r.invalid){issues.push('退款支付拆分冲突');return false}return true});
    result.forEach(function(r){
      r.paymentComplete=PAY.every(function(k){return r[k]!==null})&&PAY.reduce(function(s,k){return s+r[k]},0)===r.total;
      r.itemsComplete=!!r.items&&r.items.every(function(x){return x.amount!==null})&&r.items.reduce(function(s,x){return s+x.amount},0)===r.total;
      r.personal=r.account===null||r.cash===null?null:r.account+r.cash;
    });
    return {records:result,issues:issues};
  }
  function scopeRows(records,tumorId){
    return records.filter(function(r){return r.tumorIds.length===1&&r.tumorIds[0]===tumorId});
  }
  var PROVINCES={'11':'北京市','12':'天津市','13':'河北省','14':'山西省','15':'内蒙古自治区','21':'辽宁省','22':'吉林省','23':'黑龙江省','31':'上海市','32':'江苏省','33':'浙江省','34':'安徽省','35':'福建省','36':'江西省','37':'山东省','41':'河南省','42':'湖北省','43':'湖南省','44':'广东省','45':'广西壮族自治区','46':'海南省','50':'重庆市','51':'四川省','52':'贵州省','53':'云南省','54':'西藏自治区','61':'陕西省','62':'甘肃省','63':'青海省','64':'宁夏回族自治区','65':'新疆维吾尔自治区','71':'台湾省','81':'香港特别行政区','82':'澳门特别行政区'};
  function hospitalProvince(r){
    var code=String(r.hospitalProvinceCode||'').trim();
    if(code)return /^(\d{2}|\d{6})$/.test(code)&&PROVINCES[code.slice(0,2)]?code.slice(0,2):null;
    var region=String(r.region||'').trim();
    return Object.keys(PROVINCES).find(function(k){return PROVINCES[k]===region})||null;
  }
  function sum(rows,key){return rows.some(function(r){return r[key]===null||r[key]===undefined})?null:rows.reduce(function(s,r){return s+r[key]},0)}
  function aggregate(rows){
    var active=rows.filter(function(r){return r.total>0}),stays=active.filter(function(r){return r.type==='住院'}),admissions=new Set(stays.map(function(r){return JSON.stringify([r.hospitalCode||r.hospital,r.encounterId])})),admissionsKnown=stays.every(function(r){return !!r.encounterId&&!!(r.hospitalCode||r.hospital)});
    var complete=rows.every(function(r){return r.paymentComplete}),itemsComplete=rows.every(function(r){return r.itemsComplete}),result={total:sum(rows,'total'),fund:sum(rows,'fund'),other:sum(rows,'other'),account:sum(rows,'account'),cash:sum(rows,'cash'),personal:sum(rows,'personal'),paymentComplete:complete,itemsComplete:itemsComplete,admissions:admissionsKnown?admissions.size:null,count:active.length,items:{},visitTypes:{},months:{}};
    result.average=stays.length&&admissionsKnown?Math.round(sum(stays,'total')/admissions.size):null;
    rows.forEach(function(r){var m=r.date.slice(0,7),bucket=result.months[m]||(result.months[m]={total:0,fund:0,other:0,account:0,cash:0,unknown:0});bucket.total+=r.total;
      if(r.paymentComplete)PAY.forEach(function(k){bucket[k]+=r[k]});else bucket.unknown+=r.total;
      if(itemsComplete)(r.items||[]).forEach(function(x){result.items[x.category]=(result.items[x.category]||0)+x.amount});
      var visitType=VISIT_TYPES.includes(r.type)?r.type:'类型待确认';
      result.visitTypes[visitType]=(result.visitTypes[visitType]||0)+r.total;
    });
    // 省外以医疗机构所在地相对江西判定，不使用患者户籍或参保地。
    result.regionMissing=active.filter(function(r){return hospitalProvince(r)===null}).length;
    result.outOfProvince=result.regionMissing?null:active.filter(function(r){return hospitalProvince(r)!=='36'}).reduce(function(total,r){return total+r.total},0);
    result.inProvince=result.outOfProvince===null?null:result.total-result.outOfProvince;
    return result;
  }
  function demo(){
    var rows=[],a='南昌市第一医院',b='江西省肿瘤医院';
    function add(id,owner,tumors,date,hospital,type,diagnosis,total,pay,items,extra){
      rows.push(Object.assign({id:id,patientEventId:owner,tumorIds:tumors,date:date,hospital:hospital,type:type,diagnosis:diagnosis,total:total,fund:pay[0],other:pay[1],account:pay[2],cash:pay[3],items:CATEGORIES.map(function(c,i){return {category:c,amount:items[i]||0}}),encounterId:'VISIT-'+id,insurance:'职工医保',region:'江西省',source:'演示结算数据',status:'settled',updatedAt:date},extra||{}));
    }
    add('D001','TE001',['TE001'],'2026-02-12',a,'住院','肺腺癌',48600,[34020,2000,3580,9000],[8600,5600,5800,12000,13000,3600],{otherBreakdown:[{name:'补充保障',amount:2000}]});
    add('D002','TE001',['TE001'],'2026-03-03',a,'门诊慢特病','肺癌辅助化疗',12680,[8500,800,1380,2000],[9600,1080,1200,0,500,300]);
    add('D003','TE001',['TE001'],'2026-04-02',b,'门诊慢特病','肺癌辅助化疗',13480,[9100,1000,1380,2000],[10200,1080,1400,0,500,300]);
    add('D004','TE001',['TE001'],'2026-05-05',a,'门诊慢特病','肺癌辅助化疗',11800,[8000,800,1000,2000],[8500,1100,1400,0,500,300]);
    add('D005','TE001',['TE001'],'2026-06-20',a,'门诊慢特病','肺癌辅助化疗',10960,[7400,600,960,2000],[8000,960,1200,0,500,300]);
    add('D006','TE001',['TE001'],'2026-08-20',a,'普通门急诊','肺癌术后复查',1860,[900,0,660,300],[300,1360,0,0,0,200]);
    add('D007','TE001',['TE001B'],'2026-09-29',b,'住院','升结肠腺癌',36800,[25760,1000,3040,7000],[5800,4000,3500,10000,10500,3000]);
    add('D008','TE001',[],'2026-10-08',a,'普通门急诊','高血压',360,[180,0,180,0],[300,0,0,0,0,60],{attribution:'非肿瘤费用'});
    add('D009','TE001',['TE001','TE001B'],'2026-10-20',b,'普通门急诊','多原发肿瘤共同复查',1600,[800,0,500,300],[200,1200,0,0,0,200]);
    add('D010','TE001',['TE001'],'2026-06-21',a,'门诊慢特病','退费',460,[300,0,160,0],[200,260,0,0,0,0],{status:'refund',originalId:'D005'});
    add('D011','TE001',['TE001'],'2026-03-02',a,'门诊慢特病','已撤销旧结算',12680,[8500,800,1380,2000],[9600,1080,1200,0,500,300],{status:'cancelled',encounterId:'VISIT-D002'});
    add('D012','TE001',[],'2026-10-22',b,'普通门急诊','诊断关联待补充',680,[300,0,180,200],[200,400,0,0,0,80],{attribution:'待确认归属'});
    var specimens=[['TE002','2026-04-15',b,'乳腺癌',32600,[22820,1000,2780,6000],[5000,4000,3000,9000,9000,2600]],['TE003','2026-07-20','九江市第一人民医院','胃癌',21800,[13080,2000,0,6720],[13000,2800,3000,0,1500,1500]],['TE004','2026-03-12','上饶市肿瘤医院','肝癌',42800,[29960,1000,3840,8000],[6000,5000,4800,12000,12000,3000]],['TE005','2026-05-18','宜春市人民医院','肺癌',45600,[31920,1000,4680,8000],[7000,4500,4500,12000,14600,3000]],['TE006','2026-05-27','景德镇市第一医院','宫颈癌',28600,[17160,2000,0,9440],[5000,4000,3000,8000,6000,2600]],['TE007','2026-07-11',a,'直肠癌',39800,[27860,1000,2940,8000],[6000,4500,3500,11000,11800,3000]],['TE008','2026-08-15',b,'乳腺癌',24600,[14760,3000,0,6840],[16000,2600,3000,0,1500,1500]],['TE009','2026-08-18','吉安市中心医院','食管癌',18600,[11160,1500,0,5940],[7000,2000,7000,0,1000,1600]],['TE010','2026-06-20','抚州市第一医院','宫颈癌',27800,[16680,2000,0,9120],[4000,3800,3000,8000,6500,2500]],['TE011','2026-06-10','鹰潭市人民医院','结肠癌',35600,[24920,1000,2680,7000],[5000,4000,3500,10000,10600,2500]],['TE012','2026-06-26','新余市人民医院','乳腺癌',22600,[15820,0,2780,4000],[4000,3000,2500,7000,4100,2000]],['TE013','2025-01-08','浙江大学医学院附属第一医院','肝癌',58600,[35160,3000,2440,18000],[8000,6600,7000,16000,16000,5000]]];
    specimens.forEach(function(x,i){add('S'+i,x[0],[x[0]],x[1],x[2],'住院',x[3],x[4],x[5],x[6],{insurance:['TE003','TE006','TE008','TE009','TE010'].includes(x[0])?'城乡居民医保':'职工医保',region:x[0]==='TE013'?'浙江省':'江西省'})});
    return {mode:'demo',connected:true,updatedAt:'2026-10-30',records:rows};
  }
  function data(){if(dataset)return dataset;if(root.SP_COST_DATA)return root.SP_COST_DATA;dataset=demo();return dataset}
  function contextRows(ctx){var d=data();return (d.connected===false?[]:d.records||[]).filter(function(r){return d.mode==='demo'?ctx.patientTumorIds.includes(r.patientEventId):r.patientKey===ctx.patientKey})}
  function model(ctx){
    var d=data(),today=ctx.today,asOf=day(d.updatedAt)&&day(d.updatedAt)<today?day(d.updatedAt):today;
    var normalized=normalize(contextRows(ctx),asOf),records=normalized.records,rows=scopeRows(records,ctx.tumorId);
    return {data:d,asOf:asOf,rows:rows,stats:aggregate(rows),issues:normalized.issues,
      pending:records.filter(function(r){return !r.tumorIds.length&&r.attribution!=='非肿瘤费用'}).length,
      shared:records.filter(function(r){return r.tumorIds.length>1&&r.tumorIds.includes(ctx.tumorId)}).length};
  }
  function populationModel(ctx){
    var d=data(),today=ctx.cutoff||ctx.today,asOf=day(d.updatedAt)&&day(d.updatedAt)<today?day(d.updatedAt):today;
    var demoMode=d.mode==='demo',keys=new Set(ctx.patientKeys||[]),tumors=new Set(ctx.tumorIds||[]),eventKeys=ctx.patientEventKeys||{};
    if((d.mode!=='live'&&!demoMode)||d.connected===false)return {available:false,demo:false,asOf:asOf,stats:null,patients:0,cohort:ctx.cohortSize||0,shared:0,pending:0,issues:[]};
    var source=(d.records||[]).filter(function(r){return demoMode?!!eventKeys[r.patientEventId]||(Array.isArray(r.tumorIds)&&r.tumorIds.some(function(id){return tumors.has(id)})):keys.has(r.patientKey)});
    var normalized=normalize(source,asOf),records=normalized.records;
    // 主统计与个体画像相加一致；多瘤例共同费用单列，不分摊或混入主金额。
    var linked=records.filter(function(r){return r.tumorIds.length===1&&tumors.has(r.tumorIds[0])});
    var shared=records.filter(function(r){return r.tumorIds.length>1&&r.tumorIds.some(function(id){return tumors.has(id)})});
    function patientKey(r){
      if(!demoMode)return r.patientKey;
      var matched=r.tumorIds.find(function(id){return tumors.has(id)&&eventKeys[id]});
      return matched?eventKeys[matched]:(r.patientEventId||r.tumorIds[0]||r.key);
    }
    var active=linked.filter(function(r){return r.total>0}),patientKeys=new Set(active.map(patientKey));
    return {available:true,demo:demoMode,asOf:asOf,stats:aggregate(linked),patients:patientKeys.size,cohort:ctx.cohortSize||keys.size,
      shared:shared.length,sharedTotal:sum(shared,'total'),
      pending:records.filter(function(r){return !r.tumorIds.length&&r.attribution!=='非肿瘤费用'}).length,issues:normalized.issues};
  }
  function overviewTable(label,headers,rows,cls){
    return '<div class="sp-table-wrap" tabindex="0" role="region" aria-label="'+esc(label)+'，可横向滚动"><table class="data-table sp-field-table sp-cost-stat-table '+(cls||'')+'"><thead><tr>'+headers.map(function(header,i){return '<th scope="col"'+(i?' class="sp-stat-number"':'')+'>'+esc(header)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+row.map(function(value,i){return '<td'+(i?' class="sp-stat-number"':'')+'>'+(i?value:esc(value))+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>';
  }
  function populationContent(){
    var m=populationModel(overviewContext),a=m.stats;
    if(!m.available){
      return '<div class="sp-cost-overview-state"><strong>医保结算数据未接入</strong></div>';
    }
    if(!a.count)return '<div class="sp-cost-overview-state"><strong>当前范围暂无已关联的有效医保费用</strong></div>';
    var total=a.total,availableTotal=total!==null,coverage=m.patients+' / '+m.cohort+' 人';
    var personalShare=a.paymentComplete?percent(a.personal,total):'—',outShare=a.outOfProvince===null?'—':percent(a.outOfProvince,total);
    var totalValue=availableTotal?overviewAmount(total):'—';
    var perPatient=m.patients&&availableTotal?overviewAmount(Math.round(total/m.patients)):'—';
    var rows=[
      ['医疗总费用',totalValue],
      ['有结算患者',coverage],
      ['人均医疗费用',perPatient],
      ['个人支付占比',personalShare],
      ['省外费用占比',outShare]
    ];
    var cards=overviewView==='chart'?rows.map(function(x){return '<div class="sp-cost-kpi"><div class="k">'+x[0]+'</div><div class="v">'+x[1]+'</div></div>'}).join(''):'';
    var payment=[{label:'医保基金支付',value:a.fund,color:'var(--color-primary)'},{label:'个人支付',value:a.personal,color:'var(--color-warning-solid)'},{label:'其他保障支付',value:a.other,color:'var(--color-accent)'}];
    var paymentBody='<div class="sp-cost-overview-empty">支付构成数据待补全或核对</div>';
    if(a.paymentComplete){
      if(overviewView==='table'){
        var paymentRows=payment.map(function(entry){return [entry.label,overviewAmount(entry.value),percent(entry.value,total)]});
        paymentRows.push(['其中：个人账户支付',overviewAmount(a.account),percent(a.account,total)],['其中：现金支付',overviewAmount(a.cash),percent(a.cash,total)]);
        paymentBody=overviewTable('支付构成统计表',['支付项目','金额','占总费用'],paymentRows);
      }else{
        var end=0,stops=payment.map(function(entry){var start=end;end+=entry.value/total*100;return entry.color+' '+start+'% '+end+'%'});
        paymentBody='<div class="sp-cost-overview-payment"><div class="sp-cost-ring" style="background:conic-gradient('+stops.join(',')+')" aria-hidden="true"><div><strong>'+percent(a.fund,total)+'</strong><span>医保基金支付占比</span></div></div>'+
          '<ul class="sp-cost-overview-legend">'+payment.map(function(entry){return '<li style="--cost-color:'+entry.color+'"><span class="sp-cost-row-label"><i class="sp-cost-dot" aria-hidden="true"></i>'+entry.label+'</span><strong>'+percent(entry.value,total)+'</strong><span class="sp-cost-legend-amount">'+overviewAmount(entry.value)+'</span></li>'}).join('')+'</ul></div>'+
          '<div class="sp-cost-payment-summary"><span>个人账户<strong>'+overviewAmount(a.account)+'</strong></span><span>现金支付<strong>'+overviewAmount(a.cash)+'</strong></span></div>';
      }
    }
    var categories=CATEGORIES.map(function(label){return {label:label,value:a.items[label]||0}}).sort(function(x,y){return y.value-x.value});
    var categoryBody='<div class="sp-cost-overview-empty">费用类别数据待补全或核对</div>';
    if(a.itemsComplete){
      categoryBody=overviewView==='table'?overviewTable('费用类别统计表',['费用类别','金额','占总费用'],categories.map(function(entry){return [entry.label,overviewAmount(entry.value),percent(entry.value,total)]})):
        '<div class="sp-cost-ranking-head"><span>费用类别</span><span>金额 / 占总费用</span></div><ol class="sp-cost-ranking">'+categories.map(function(entry,i){
          return '<li><span class="sp-cost-rank-number">'+(i+1)+'</span><span class="sp-cost-rank-label">'+entry.label+'</span><div class="sp-cost-row-track" aria-hidden="true"><span style="width:'+(entry.value/total*100)+'%"></span></div><span class="sp-cost-row-amount">'+overviewAmount(entry.value)+'</span><strong class="sp-cost-row-share">'+percent(entry.value,total)+'</strong></li>';
        }).join('')+'</ol>';
    }
    var notes=[];
    if(m.shared)notes.push('多瘤例共同费用：'+overviewAmount(m.sharedTotal)+'（'+m.shared+' 笔）');
    if(m.pending)notes.push('待确认归属：'+m.pending+' 笔');
    if(m.issues.length)notes.push('待核对结算：'+m.issues.length+' 项');
    var oldBasis=root.document&&root.document.getElementById('spCostOverviewBasis');
    var content=overviewView==='table'?'<div class="sp-cost-report"><section aria-labelledby="spCostSummaryTitle"><h4 id="spCostSummaryTitle">费用概况</h4>'+overviewTable('医保费用概览统计表',['指标','统计值'],rows,'sp-cost-summary-table')+'<div class="sp-cost-payments"><h4 id="spCostOverviewPayment">支付构成</h4>'+paymentBody+'</div></section><section aria-labelledby="spCostOverviewCategories"><h4 id="spCostOverviewCategories">费用类别</h4>'+categoryBody+'</section></div>':
      '<div class="sp-cost-kpis sp-cost-overview-kpis">'+cards+'</div><div class="sp-cost-overview-distributions"><section aria-labelledby="spCostOverviewPayment"><div class="sp-cost-breakdown-heading"><h4 id="spCostOverviewPayment">支付构成</h4></div>'+paymentBody+'</section><section aria-labelledby="spCostOverviewCategories"><div class="sp-cost-breakdown-heading"><h4 id="spCostOverviewCategories">费用类别</h4></div>'+categoryBody+'</section></div>';
    return '<div class="sp-cost-context"><div class="sp-cost-overview-tools"><div class="sp-cost-unit" role="group" aria-label="费用金额单位">'+['yuan','wan'].map(function(unit){return '<button type="button" aria-pressed="'+(overviewUnit===unit)+'" onclick="SPCost.setOverviewUnit(\''+unit+'\')">'+(unit==='yuan'?'元':'万元')+'</button>'}).join('')+'</div></div></div>'+content+
      (notes.length?'<details class="sp-cost-overview-basis" id="spCostOverviewBasis"'+(oldBasis&&oldBasis.open?' open':'')+'><summary><span>未计入总额的费用</span></summary><div>'+notes.map(function(note){return '<p>'+note+'</p>'}).join('')+'</div></details>':'');
  }
  function overviewAmount(value){return (overviewUnit==='wan'?(value/1000000).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}):money(value))+'<small>'+(overviewUnit==='wan'?'万元':'元')+'</small>'}
  function setOverviewUnit(unit){if(unit!=='yuan'&&unit!=='wan')return;overviewUnit=unit;refreshPopulation();var active=root.document&&root.document.querySelector('.sp-cost-unit button[aria-pressed="true"]');if(active)active.focus({preventScroll:true})}
  function renderPopulation(ctx,options){overviewContext=ctx||{};overviewView=options&&options.view==='chart'?'chart':'table';return '<section class="panel sp-cost sp-cost-overview" aria-label="群体医保费用分析"><div class="panel-header"><h3>医保费用分析</h3></div><div class="panel-body" id="spCostOverviewBody">'+populationContent()+'</div></section>'}
  function refreshPopulation(){var el=root.document&&root.document.getElementById('spCostOverviewBody');if(el&&overviewContext)el.innerHTML=populationContent()}
  function metric(label,value,sub,title){
    return '<div class="sp-cost-kpi" title="'+esc(title)+'"><div class="k">'+esc(label)+'</div><div class="v">'+esc(value)+'<small>元</small></div><div class="s">'+esc(sub)+'</div></div>';
  }
  function breakdownList(entries,total,bars){
    return '<ul class="sp-cost-distribution">'+entries.map(function(entry){
      var share=percent(entry.value,total),width=entry.value/total*100;
      return '<li class="sp-cost-distribution-row" style="--cost-color:'+entry.color+'"><div class="sp-cost-row-label"><i class="sp-cost-dot" aria-hidden="true"></i>'+esc(entry.label)+'</div><span class="sp-cost-row-amount">'+money(entry.value)+'<small>元</small></span><strong class="sp-cost-row-share">'+share+'</strong>'+
        (bars?'<div class="sp-cost-row-track" aria-hidden="true"><span style="width:'+width+'%"></span></div>':'')+'</li>';
    }).join('')+'</ul>';
  }
  function stackedBar(entries,total){
    return '<div class="sp-cost-stack" aria-hidden="true">'+entries.map(function(entry){return '<span style="width:'+(entry.value/total*100)+'%;background:'+entry.color+'"></span>'}).join('')+'</div>';
  }
  function breakdown(id,title,note,body,empty){
    return '<section class="sp-cost-breakdown" data-cost-breakdown="'+id+'" aria-labelledby="spCost-'+id+'"><div class="sp-cost-breakdown-heading"><h4 id="spCost-'+id+'">'+title+'</h4><span>'+note+'</span></div>'+
      (empty?'<div class="sp-cost-breakdown-empty">'+empty+'</div>':body)+'</section>';
  }
  function distributions(a,available){
    var empty=!available?'结算数据未接入':!a.total?'暂无可分析的有效费用':'';
    var paymentEmpty=empty||(!a.paymentComplete?'支付构成数据待补全或核对':''),itemsEmpty=empty||(!a.itemsComplete?'费用分类数据待补全或核对':'');
    var regionEmpty=empty||(a.regionMissing?'就医地区待补全':'');
    var payment=[{label:'医保基金支付',value:a.fund,color:COLORS[0]},{label:'个人支付',value:a.personal,color:COLORS[1]},{label:'其他保障支付',value:a.other,color:COLORS[2]}];
    var items=CATEGORIES.map(function(label,i){return {label:label,value:a.items[label]||0,color:COLORS[i]}});
    var visits=VISIT_TYPES.concat(a.visitTypes['类型待确认']?['类型待确认']:[]).map(function(label,i){return {label:label,value:a.visitTypes[label]||0,color:COLORS[i]}});
    var regions=[{label:'省内就医',value:a.inProvince,color:COLORS[0]},{label:'省外就医',value:a.outOfProvince,color:COLORS[1]}];
    var paymentBody='';
    if(!paymentEmpty){
      var end=0,stops=payment.map(function(entry){var start=end;end+=entry.value/a.total*100;return entry.color+' '+start+'% '+end+'%'});
      paymentBody='<div class="sp-cost-payment"><div class="sp-cost-ring" style="background:conic-gradient('+stops.join(',')+')" aria-hidden="true"><div><strong>'+percent(a.personal,a.total)+'</strong><span>个人支付占比</span></div></div>'+breakdownList(payment,a.total,false)+'</div><p class="sp-cost-explain">个人支付含个人账户及现金支付</p>';
    }
    return '<div class="sp-cost-breakdowns">'+
      breakdown('payment','支付构成','看患者费用负担',paymentBody,paymentEmpty)+
      breakdown('items','费用类别构成','看费用主要花在哪里',itemsEmpty?'':breakdownList(items,a.total,true),itemsEmpty)+
      breakdown('visits','就诊类型费用占比','看住院与门诊费用分布',empty?'':stackedBar(visits,a.total)+breakdownList(visits,a.total,false),empty)+
      breakdown('regions','省内外费用占比','以医疗机构所在地判定',regionEmpty?'':stackedBar(regions,a.total)+breakdownList(regions,a.total,false),regionEmpty)+
      '</div><div class="sp-cost-basis">各项占比均以当前瘤例累计医疗费用为分母；四舍五入可能存在尾差。</div>';
  }
  function content(){
    var m=model(current),a=m.stats,available=m.data.connected!==false;
    var amount=function(v){return available?money(v):'—'};
    var ownShare=available&&a.paymentComplete?percent(a.personal,a.total):'—';
    var outShare=available?percent(a.outOfProvince,a.total):'—';
    var status=!available?'未接入':m.data.mode==='demo'?'示例数据':'医保结算';
    var info=[];
    if(!available)info.push('结算数据未接入');
    else if(!m.rows.length)info.push('暂无明确关联当前瘤例的有效结算');
    if(m.pending||m.shared)info.push('部分费用归属待确认');
    if(m.issues.length)info.push('部分结算数据待核对');
    var details='患者另有 '+m.pending+' 笔未明确归属费用；当前瘤例涉及 '+m.shared+' 笔共同费用，均未重复分摊。'+(m.issues.length?' '+m.issues.length+' 项结算数据待核对。':'');
    var personalSub=!available?'待接入':a.personal===null?'个人支付数据待补全':!a.paymentComplete?'支付数据待核对':'占总费用 '+ownShare;
    var staySub=!available?'待接入':a.admissions===null?'住院就诊标识待补全':a.admissions?'累计 '+a.admissions+' 次住院':'暂无有效住院结算';
    var outSub=!available?'待接入':a.regionMissing?'就医地区待补全':'占总费用 '+outShare;
    return '<div class="sp-cost-context"><span class="sp-cost-note">当前瘤例累计 · 截至 '+esc(day(m.data.updatedAt)?m.asOf:'数据日期未提供')+'</span><span class="badge '+(m.data.mode==='demo'&&available?'badge-caution':'badge-info')+'">'+status+'</span></div>'+
      '<div class="sp-cost-kpis">'+
      metric('累计医疗费用',amount(a.total),'已接入的相关就诊费用','当前瘤例全部已接入有效结算的累计净额，退款已冲减；不含未明确归属及多瘤例共同费用。')+
      metric('个人支付',amount(a.personal),personalSub,'个人账户与个人现金支付合计；占比为同一批结算的个人支付合计除以医疗总费用。')+
      metric('次均住院费用',amount(a.average),staySub,'住院净费用合计除以按机构与就诊标识去重的有效住院次数。')+
      metric('省外医疗费用',amount(a.outOfProvince),outSub,'按医疗机构所在地判定江西省外就医费用及其占总费用比例；地区缺失时不推断。')+
      '</div>'+distributions(a,available)+(info.length?'<div class="sp-cost-footnote" title="'+esc(details)+'">'+esc(info.join(' · '))+'</div>':'');
  }
  function render(e,ctx){
    current=Object.assign({},ctx,{tumorId:e.id});
    return '<section class="panel sp-cost" id="spCostPanel" aria-label="医疗费用概览"><div class="panel-header"><span>医疗费用概览</span></div><div class="panel-body" id="spCostBody">'+content()+'</div></section>';
  }
  function refresh(){var el=root.document&&root.document.getElementById('spCostBody');if(el&&current)el.innerHTML=content()}
  var api={render:render,renderPopulation:renderPopulation,populationModel:populationModel,setOverviewUnit:setOverviewUnit,setData:function(value){dataset=value;refresh();refreshPopulation()},normalize:normalize,scopeRows:scopeRows,aggregate:aggregate,demo:demo,model:model};
  root.SPCost=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
