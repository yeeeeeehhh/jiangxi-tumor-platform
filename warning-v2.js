/* 预警检测V2：卫健职能监管工作台。独立路由、数据模型和本地配置。 */
(function () {
  'use strict';
  const M = window.WarningV2Model;
  let storage;
  try { storage = window.localStorage; } catch (_) { storage = {getItem(){return null;},setItem(){throw new Error('unavailable');}}; }
  const store = M.createStore(storage);
  const S = { route:'wv2-overview', region:'', filters:{}, page:1, rules:{domain:'',keyword:'',readiness:'',enabled:''} };
  const regions = ['南昌市','景德镇市','萍乡市','九江市','新余市','鹰潭市','赣州市','吉安市','宜春市','抚州市','上饶市'];
  const levels = {HIGH:'重点预警',ATTENTION:'关注预警',OBSERVE:'观察线索',UNEVALUABLE:'不可评价',NORMAL:'未触发'};
  const statuses = {PENDING:'待核查',PROCESSING:'核查中',REVIEW:'待复核',CLOSED:'已结束',OBSERVING:'持续观察'};
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = v => E(M.pretty(Number(v)));
  const badge = (code,text) => '<span class="wv2-badge '+E(code)+'">'+E(text||levels[code]||statuses[code]||code)+'</span>';
  const date = v => v ? new Date(v).toLocaleString('zh-CN',{hour12:false}).replace(/:\d{2}$/, '') : '—';
  const opt = (items,value,all) => (all!=null?'<option value="">'+E(all)+'</option>':'')+items.map(x=>{const a=Array.isArray(x)?x:[x,x];return '<option value="'+E(a[0])+'"'+(value===a[0]?' selected':'')+'>'+E(a[1])+'</option>';}).join('');
  const btn = (text,action,id='',primary=false) => '<button type="button" class="wv2-btn'+(primary?' wv2-btn-primary':'')+'" data-wv2="'+E(action)+'" data-id="'+E(id)+'">'+E(text)+'</button>';
  const link = (route,text,cls='') => '<a class="'+cls+'" href="#'+E(route)+'">'+E(text)+'</a>';
  const panel = (title,body,extra='',cls='') => '<section class="wv2-panel '+cls+'"><div class="wv2-panel-head"><h2>'+E(title)+'</h2>'+extra+'</div>'+body+'</section>';
  const empty = (title='没有符合条件的事项',hint='调整筛选条件后重新查看。') => '<div class="wv2-empty"><h3>'+E(title)+'</h3><p>'+E(hint)+'</p></div>';
  const isOpen = r => r.status!=='CLOSED'&&['HIGH','ATTENTION'].includes(r.level);
  const overdue = r => r.deadline&&['PROCESSING','REVIEW'].includes(r.status)&&r.deadline<M.AS_OF;
  const statusBadge = r => badge(r.status)+(overdue(r)?' '+badge('overdue','核查逾期'):'');
  const fact = (name,value,large=false) => '<dl class="wv2-fact"><dt>'+E(name)+'</dt><dd'+(large?' class="wv2-metric"':'')+'>'+E(value)+'</dd></dl>';
  const definition = (name,text) => '<div class="wv2-definition"><h3>'+E(name)+'</h3><p>'+E(text)+'</p></div>';
  function header(title,subtitle,active) {
    return '<div class="wv2-head"><div><div class="wv2-eyebrow">江西省 · 卫健职能监管</div><h1>'+E(title)+'</h1><p class="wv2-subtitle">'+E(subtitle)+'</p></div><div class="wv2-head-right"><span class="wv2-demo">演示数据 · 本机保存</span><p class="wv2-muted wv2-small" style="margin-top:7px">监测批次 '+M.AS_OF+'</p></div></div><nav class="wv2-nav" aria-label="预警检测V2导航">'+[['wv2-overview','监管总览'],['wv2-records','预警记录'],['wv2-rules','规则中心']].map(([id,text])=>'<a href="#'+id+'"'+(id===active?' aria-current="page"':'')+'>'+text+'</a>').join('')+'</nav>';
  }
  function setRecords(values) { S.filters={...values};S.page=1;go('wv2-records'); }
  function domainTabs(type,selected,counts) {
    return '<div class="wv2-tabs" aria-label="监管领域筛选">'+[['','全部领域'],...M.domains.map(d=>[d.id,d.short])].map(([id,name])=>'<button type="button" class="wv2-tab" data-wv2="'+type+'" data-id="'+id+'" aria-pressed="'+(selected===id)+'">'+name+(counts?'<small>'+counts(id)+'</small>':'')+'</button>').join('')+'</div>';
  }
  function overview() {
    const records = M.filter(store.all(),{region:S.region}),sum=M.summary(records),active=records.filter(isOpen);
    const top = active.slice(0,5);
    const kpis = [['当前在办事项',sum.open,'按监管事项计数','open'],['其中重点预警',sum.high,'达到重点条件','high'],['待启动核查',sum.pending,'需要归口职能介入','pending'],['涉及地区',sum.regions,'当前在办事项覆盖','regions']];
    const dist=regions.map(region=>({region,list:active.filter(r=>r.region===region)})).filter(x=>x.list.length).sort((a,b)=>b.list.length-a.list.length);
    const max=Math.max(1,...dist.map(x=>x.list.length));
    const bars=dist.map(x=>{const h=x.list.filter(r=>r.level==='HIGH').length;return '<button class="wv2-bar-row" data-wv2="region-records" data-id="'+x.region+'" aria-label="查看'+x.region+x.list.length+'条在办事项"><span>'+x.region+'</span><span class="wv2-bar-track"><span class="wv2-bar-high" style="width:'+h/max*100+'%"></span><span class="wv2-bar-main" style="width:'+(x.list.length-h)/max*100+'%"></span></span><strong class="wv2-num">'+x.list.length+'</strong></button>';}).join('');
    return header('预警检测V2','掌握辖区防治风险，明确监管重点，跟踪核查落实。','wv2-overview')+
      '<div class="wv2-row wv2-between"><div class="wv2-row"><label class="wv2-small wv2-muted" for="wv2-region">监管范围</label><select id="wv2-region" class="wv2-select" data-wv2-change="overview-region">'+opt(regions,S.region,'江西省 · 全部地区')+'</select></div>'+btn('查看全部记录','all-records')+'</div>'+
      '<div class="wv2-kpis">'+kpis.map(([name,n,hint,key])=>'<button class="wv2-kpi '+(key==='high'?'is-high':'')+'" data-wv2="kpi" data-id="'+key+'"><span>'+name+'</span><strong class="wv2-num">'+n+'</strong><small>'+hint+'</small></button>').join('')+'</div>'+
      '<div class="wv2-section-title"><h2>五大监管领域</h2><span class="wv2-muted wv2-small">'+M.rules.length+' 个预警点 · 点击查看在办事项</span></div><div class="wv2-domains">'+M.domains.map(d=>{const s=M.summary(records.filter(r=>r.domain===d.id));return '<button class="wv2-domain" data-wv2="domain-records" data-id="'+d.id+'"><span class="wv2-domain-id">领域 '+d.id+' · '+M.rules.filter(r=>r.domain===d.id).length+' 个预警点</span><h3>'+d.short+'</h3><div class="wv2-domain-count"><strong>'+s.open+'</strong><span>在办 / 重点 '+s.high+'</span></div><p>'+d.question+'</p></button>';}).join('')+'</div>'+
      '<div class="wv2-overview-grid">'+panel('优先核查事项',top.length?top.map(r=>'<a href="#wv2-record|'+r.id+'" class="wv2-priority"><div class="wv2-row wv2-between"><span class="wv2-small wv2-muted">'+E(M.getDomain(r.domain).short)+'</span>'+badge(r.level)+'</div><div class="wv2-priority-title" style="margin-top:8px">'+E(r.title)+'</div><p>'+E(r.summary)+'</p><div class="wv2-priority-meta"><span>'+E(r.owner)+'</span><span>'+r.orgCount+' 家涉及单位</span><span>'+statuses[r.status]+'</span></div></a>').join(''):empty('当前范围暂无在办预警','可在预警记录中查看观察线索和历史事项。'),btn('全部在办 '+sum.open,'open-records'))+
      '<div class="wv2-stack">'+panel('地区分布','<div class="wv2-distribution">'+(bars||empty('暂无在办事项',''))+'</div>','<div class="wv2-legend"><span><i class="high"></i>重点</span><span><i></i>关注</span></div>')+
      panel('核查进展','<div class="wv2-panel-body">'+['PENDING','PROCESSING','REVIEW','CLOSED'].map(k=>'<div class="wv2-status-row">'+badge(k)+'<button class="wv2-link wv2-num" data-wv2="status-records" data-id="'+k+'">'+records.filter(r=>r.status===k).length+' 项</button></div>').join('')+'<div class="wv2-status-row"><span class="wv2-small wv2-muted">观察 / 不可评价</span><button class="wv2-link" data-wv2="status-records" data-id="OBSERVING">'+sum.observe+' 项</button></div></div>')+'</div></div>'+
      '<p class="wv2-footer-note">事项以地区、机构和适用队列为监管对象；同一事项可关联多家机构，涉及人数不跨事项直接累加。当前为固定演示批次，未连接生产监测源。</p>';
  }
  function recordRows(list) {
    return '<div class="wv2-table-wrap"><table class="wv2-table wv2-table-records"><thead><tr><th>预警事项 / 触发依据</th><th>监管对象</th><th>级别</th><th>核查状态</th><th>发现日期 / 归口</th><th>操作</th></tr></thead><tbody>'+list.map(r=>'<tr><td>'+link('wv2-record|'+r.id,r.title,'wv2-table-title')+'<div class="wv2-muted">'+E(r.summary)+'</div><div class="wv2-table-detail">'+E(r.ruleId+' · '+M.getDomain(r.domain).short+' · '+r.period)+'</div></td><td>'+E(r.area)+'<div class="wv2-table-detail">'+E(r.cancer)+'</div><div class="wv2-table-detail">'+r.orgCount+' 家涉及单位</div></td><td>'+badge(r.level)+'</td><td>'+statusBadge(r)+(r.deadline?'<div class="wv2-table-detail">期限 '+E(r.deadline)+'</div>':'')+'</td><td>'+E(r.found)+'<div class="wv2-table-detail">'+E(r.owner)+'</div></td><td>'+link('wv2-record|'+r.id,'查看')+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function recordsPage() {
    const all=store.all(),f=S.filters,list=M.filter(all,f),pages=Math.max(1,Math.ceil(list.length/8));S.page=Math.min(S.page,pages);
    return header('预警记录','从具体问题进入：查明事实、协调责任、复核改进。','wv2-records')+
      domainTabs('records-domain',f.domain||'',id=>M.filter(all,{...f,domain:id}).length)+
      '<section class="wv2-panel"><form class="wv2-filters" id="wv2-record-filters"><label class="wv2-field"><span>地区</span><select name="region">'+opt(regions,f.region,'全部地区')+'</select></label><label class="wv2-field"><span>预警级别</span><select name="level">'+opt(Object.entries(levels).filter(x=>x[0]!=='NORMAL'),f.level,'全部级别')+'</select></label><label class="wv2-field"><span>核查状态</span><select name="status">'+opt([['OPEN','全部在办'],...Object.entries(statuses)],f.status,'全部状态')+'</select></label><label class="wv2-field wv2-search"><span>关键词</span><input name="keyword" value="'+E(f.keyword)+'" placeholder="事项、癌种、归口职能或规则编号"></label><button class="wv2-btn wv2-btn-primary" type="submit">查询</button>'+btn('重置','reset-records')+'</form><div class="wv2-panel-head"><div><strong>'+list.length+'</strong> <span class="wv2-muted wv2-small">条记录'+(f.ruleId?' · 规则 '+E(f.ruleId):'')+'</span></div>'+btn('导出当前结果','export-records')+'</div>'+(list.length?recordRows(list.slice((S.page-1)*8,S.page*8)):empty())+'<div class="wv2-pager"><span>每页 8 条 · 第 '+S.page+' / '+pages+' 页</span><div class="wv2-row"><button class="wv2-btn" data-wv2="page" data-id="-1"'+(S.page===1?' disabled':'')+'>上一页</button><button class="wv2-btn" data-wv2="page" data-id="1"'+(S.page===pages?' disabled':'')+'>下一页</button></div></div></section><p class="wv2-footer-note">重点 / 关注描述业务风险；核查逾期单独标记。观察与不可评价记录不进入整改闭环。</p>';
  }
  function conditions(rule,params) {
    const d=params?M.describe(params):null;
    return '<div class="wv2-rule-conditions"><div class="wv2-condition is-attention"><h3>'+badge('ATTENTION')+'</h3><p>'+E(d?.attention||rule.attention)+'</p></div><div class="wv2-condition is-high"><h3>'+badge('HIGH')+'</h3><p>'+E(d?.high||rule.high)+'</p></div></div>'+(d?definition('评价门槛',d.gate):'')+(params?.target!=null?'<p class="wv2-footer-note">当前演示目标 T = '+params.target+'%，须按癌种、适用场景与正式依据校准。</p>':'')+(params?.kind==='progress'?definition('到期任务补充条件','正式任务截止后仍有欠量直接关注；超过30日仍有欠量直接重点。'):params?.kind==='followup'?definition('确认失访补充条件','确认失访≥10%且≥10人，连续2季度关注；≥20%且≥20人，单季度重点。'): '');
  }
  const nextActions={D01:'组织属地核查省外首治的病期结构、合理转诊和服务缺口，协调专科能力与医联体支持。',D02:'按县域适宜服务范围核对流向，分析承接下降原因，明确县级机构和上级帮扶职责。',B01:'核对正式阶段任务、项目供给和属地组织情况，形成分地区推进措施。',B02:'核查筛查阳性队列的精查计划及跨院完成记录，协调项目单位与接诊机构落实衔接。',E05:'先核对人口年份、区划及登记范围，修复分母后重算所有受影响率值。',E07:'核对已核实死亡批次和同步期限，督促责任单位完成回写并复查受影响结局。'};
  function recordDetail(id) {
    const r=store.all().find(x=>x.id===id);if(!r)return header('记录不存在','请返回记录列表重新选择。','wv2-records')+link('wv2-records','返回预警记录','wv2-btn');
    const rule=M.getRule(r.ruleId),snap=r.ruleSnapshot,flow=r.status==='PENDING'?btn('开始核查','workflow-start',r.id,true):r.status==='PROCESSING'?btn('提交核查反馈','workflow-feedback',r.id,true):r.status==='REVIEW'?btn('复核结束','workflow-close',r.id,true)+btn('退回补充','workflow-return',r.id):'';
    const evidence=r.series?'<div class="wv2-table-wrap"><table class="wv2-table"><thead><tr><th>独立评价周期</th><th>原始人数 / 保守判断依据</th><th>条件核验</th></tr></thead><tbody>'+r.series.map(x=>{const m=M.measure(snap.params,x);return '<tr><td>'+E(x.period)+'</td><td>'+E(m.error||m.basis)+'</td><td>'+badge(m.error?'UNEVALUABLE':m.high?'HIGH':m.attention?'ATTENTION':'NORMAL',m.error?'不可评价':m.high?'达到重点幅度':m.attention?'达到关注幅度':'未达幅度')+'</td></tr>';}).join('')+'</tbody></table></div>':'<div class="wv2-panel-body"><div class="wv2-note"><strong>专业来源结果示例</strong><p>'+E(r.summary)+'</p><p>正式使用需关联专业报告、来源批次、统计模型版本或已核实事件编号。</p></div></div>';
    const timeline='<ol class="wv2-timeline">'+[...r.logs].reverse().map(l=>'<li><h3>'+E(l.type)+'</h3><small>'+E(date(l.at)+' · '+l.actor)+'</small><p class="wv2-prewrap">'+E(l.text)+'</p></li>').join('')+'</ol>';
    return header('预警事项详情','依据留痕、职责归口、核查结果可追溯。','wv2-records')+link('wv2-records','返回预警记录','wv2-back')+
      '<section class="wv2-panel"><div class="wv2-panel-body"><div class="wv2-row wv2-between"><div class="wv2-row">'+badge(r.level)+statusBadge(r)+'<span class="wv2-muted wv2-small">'+r.id+'</span></div><div class="wv2-row"><span class="wv2-small wv2-muted">发现于 '+r.found+'</span>'+flow+'</div></div><h2 class="wv2-detail-title" style="margin-top:12px">'+E(r.title)+'</h2><div class="wv2-facts">'+fact('本期指标',r.metric,true)+fact('评价对象',r.area+' · '+r.cancer)+fact('归口职能',r.owner)+fact('评价周期',r.period)+fact('来源类型',r.evidenceMode)+fact('涉及单位',r.orgCount+' 家（演示）')+'</div></div></section>'+
      '<div class="wv2-detail-grid"><div class="wv2-stack" style="display:flex;flex-direction:column">'+panel('触发事实与独立周期','<div class="wv2-panel-body"><p>'+E(r.summary)+'</p><p class="wv2-muted wv2-small">'+E(r.reason)+'</p></div>'+evidence)+
      panel('命中规则快照 · V'+snap.version,'<div class="wv2-panel-body"><h3 style="margin-bottom:14px">'+E(r.ruleId+' '+rule.name)+'</h3>'+conditions({...rule,attention:snap.attention,high:snap.high},snap.params)+definition('适用对象与计算范围',rule.scope)+definition('排除与核实事项',rule.note||rule.excluded)+'<p class="wv2-footer-note">后续调整规则参数，不改变本条记录的历史触发快照。</p></div>',link('wv2-rule|'+r.ruleId,'查看现行规则'))+
      panel('涉及单位与核查职责','<div class="wv2-panel-body">'+r.organizations.map(o=>'<div class="wv2-related"><span>'+E(o.name)+'</span><span class="wv2-muted">'+E(o.role)+'</span></div>').join('')+'<p class="wv2-footer-note">此处为演示单位。病例与业务记录在正式接入后作为逐项核查证据。</p></div>')+'</div><div class="wv2-stack">'+
      panel('监管核查安排','<div class="wv2-panel-body"><h3>'+E(r.owner)+'</h3><p class="wv2-muted wv2-small" style="margin-top:9px">'+E(nextActions[r.ruleId]||rule.action)+'</p>'+definition('经办岗位',r.person||'由归口职能组织安排')+definition('核查期限',r.deadline||'启动核查时确定')+(flow?'':r.status==='CLOSED'?definition('复核结论',r.conclusion):'<div class="wv2-note" style="margin-top:16px">先补足可评价事实或独立周期，再判断是否形成正式预警。</div>')+'</div>')+
      (r.feedback?panel('已提交的核查反馈','<div class="wv2-panel-body">'+badge('REVIEW',r.feedback.result)+definition('核查说明',r.feedback.note)+definition('材料依据',r.feedback.evidence)+'</div>'):'')+
      panel('办理轨迹','<div class="wv2-panel-body">'+timeline+'</div>')+'</div></div>';
  }
  function rulesPage() {
    const f=S.rules;
    const list=M.rules.filter(r=>(!f.domain||r.domain===f.domain)&&(!f.keyword||[r.id,r.name,r.scope,r.owner].join(' ').toLowerCase().includes(f.keyword.toLowerCase()))&&(!f.readiness||(f.readiness==='numeric'?!!r.spec:!r.spec))&&(!f.enabled||(f.enabled==='on')===store.config(r.id).enabled));
    return header('规则中心','定义监管范围、触发条件和核查口径。','wv2-rules')+
      '<div class="wv2-note"><strong>30 个预警点，按监管业务分别定义。</strong> 其中 17 个支持本地管理条件试算，13 个需专业统计或业务来源核查。数值阈值为项目建议校准值；目标 T 需附正式适用依据。</div><div style="margin-top:17px">'+domainTabs('rules-domain',f.domain,id=>M.rules.filter(r=>!id||r.domain===id).length)+'</div>'+
      '<section class="wv2-panel"><form class="wv2-filters" id="wv2-rule-filters"><label class="wv2-field"><span>验证方式</span><select name="readiness">'+opt([['numeric','可本地试算'],['professional','需专业来源']],f.readiness,'全部方式')+'</select></label><label class="wv2-field"><span>范围配置</span><select name="enabled">'+opt([['on','已纳入'],['off','已停用']],f.enabled,'全部配置')+'</select></label><label class="wv2-field wv2-search"><span>查找预警点</span><input name="keyword" value="'+E(f.keyword)+'" placeholder="规则编号、名称或适用对象"></label><button class="wv2-btn wv2-btn-primary" type="submit">查询</button>'+btn('重置','reset-rules')+'</form><div class="wv2-panel-head"><span class="wv2-muted wv2-small">共 <strong>'+list.length+'</strong> 个预警点</span>'+btn('导出规则目录','export-rules')+'</div>'+(list.length?'<div class="wv2-table-wrap"><table class="wv2-table wv2-table-rules"><thead><tr><th>预警点 / 归口职能</th><th>范围与计算对象</th><th>验证方式</th><th>范围配置</th><th>操作</th></tr></thead><tbody>'+list.map(r=>{const cfg=store.config(r.id);return '<tr><td>'+link('wv2-rule|'+r.id,r.id+' '+r.name,'wv2-table-title')+'<div class="wv2-table-detail">'+E(M.getDomain(r.domain).short+' · '+r.owner)+'</div></td><td>'+E(r.scope)+'</td><td>'+badge(r.spec?'PROCESSING':'OBSERVE',r.spec?'可本地试算':'需专业来源')+'</td><td>'+badge(cfg.enabled?'NORMAL':'UNEVALUABLE',cfg.enabled?'已纳入':'已停用')+'<div class="wv2-table-detail">V'+cfg.version+'</div></td><td>'+link('wv2-rule|'+r.id,'查看规则')+'</td></tr>';}).join('')+'</tbody></table></div>':empty('没有符合条件的规则'))+'</section>';
  }
  function ruleDetail(id) {
    const r=M.getRule(id);if(!r)return header('规则不存在','请返回规则中心重新选择。','wv2-rules')+link('wv2-rules','返回规则中心','wv2-btn');
    const cfg=store.config(id),domain=M.getDomain(r.domain),history=store.ruleHistory().filter(h=>h.ruleId===id),count=store.all().filter(x=>x.ruleId===id).length;
    return header('预警规则详情',domain.name+' · '+r.owner,'wv2-rules')+link('wv2-rules','返回规则中心','wv2-back')+
      '<section class="wv2-panel"><div class="wv2-panel-body"><div class="wv2-row wv2-between"><div class="wv2-row">'+badge(cfg.enabled?'NORMAL':'UNEVALUABLE',cfg.enabled?'已纳入监管范围':'已停用')+badge('OBSERVE',r.readiness)+'<span class="wv2-muted wv2-small">V'+cfg.version+'</span></div>'+'<div class="wv2-row">'+(r.spec?btn('打开规则试算','simulate',id):'')+btn('调整规则配置','config',id,true)+'</div>'+'</div><h2 class="wv2-detail-title" style="margin-top:12px">'+E(id+' '+r.name)+'</h2><p class="wv2-subtitle">'+E(domain.question)+'</p></div></section>'+
      '<div class="wv2-detail-grid"><div class="wv2-stack" style="display:flex;flex-direction:column">'+panel('监管范围与触发条件','<div class="wv2-panel-body">'+definition('计算对象与周期',r.scope)+'<div style="margin-top:17px">'+conditions(r,cfg.params)+'</div>'+definition('专项约束',r.note||r.excluded)+definition('解除与复核',r.release)+
      (r.subrules?'<div class="wv2-definition"><h3>E04 独立细则</h3>'+r.subrules.map(s=>'<div class="wv2-condition" style="margin-top:10px"><h3>'+E(s.name)+'</h3><p>'+E(s.scope)+'</p><p>关注：'+E(s.attention)+'</p><p>重点：'+E(s.high)+'</p></div>').join('')+'</div>':'')+
      '<details class="wv2-guidance"><summary>查看本领域的完整口径、缺失保护与解除要求</summary>'+(domain.guidance||[]).map(p=>'<p>'+E(p)+'</p>').join('')+'</details></div>')+
      panel('规则版本记录','<div class="wv2-panel-body">'+(history.length?'<ol class="wv2-timeline">'+history.map(h=>'<li><h3>V'+h.before.version+' → V'+h.after.version+' · '+(h.after.enabled?'纳入范围':'停用')+'</h3><small>'+E(date(h.at))+'</small><p>'+E(h.note)+'</p>'+Object.keys(h.after.params||{}).filter(k=>h.before.params?.[k]!==h.after.params[k]).map(k=>'<p>'+E(paramLabel(k,h.after.params))+'：'+E(h.before.params?.[k])+' → '+E(h.after.params[k])+'</p>').join('')+'</li>').join('')+'</ol>':'<p class="wv2-muted wv2-small">V1 · 项目确认的预警点与规则明细，尚无本机配置变更。</p>')+'</div>')+'</div><div class="wv2-stack">'+
      panel('条件验证','<div class="wv2-panel-body">'+(r.spec?'<p class="wv2-muted wv2-small">输入独立周期人数，核验比例、样本门槛、缺失保护与持续条件。</p>':'<div class="wv2-note">本规则需要专业统计或正式业务来源。当前仅展示规则与来源要求。</div>')+definition('业务来源',r.source)+definition('监管动作',r.action)+'</div>')+
      panel('关联监管事项','<div class="wv2-panel-body"><div class="wv2-row wv2-between"><strong style="font-size:28px" class="wv2-num">'+count+'</strong>'+btn('查看关联记录','rule-records',id)+'</div><p class="wv2-footer-note">含历史、在办和观察记录。</p></div>')+
      panel('配置适用边界','<div class="wv2-panel-body"><p class="wv2-muted wv2-small">范围、规则版本与核查记录在本机保存。现有记录保留触发时的参数快照；生产使用需接入来源、权限、调度与审计服务。</p></div>')+'</div></div>';
  }
  function render() {
    const container=document.getElementById('pageContainer');if(!container)return;
    let html=S.route==='wv2-overview'?overview():S.route==='wv2-records'?recordsPage():S.route==='wv2-rules'?rulesPage():S.route.startsWith('wv2-record|')?recordDetail(S.route.split('|')[1]):ruleDetail(S.route.split('|')[1]);
    container.innerHTML='<div class="wv2" id="wv2-root">'+html+(store.storageError()?'<div class="wv2-error" role="alert">'+E(store.storageError())+'</div>':'')+'</div>';
  }
  function go(route) {
    if(route==='warning-v2')route='wv2-overview';closeDialog();S.route=route;
    const menu=route.startsWith('wv2-record')?'wv2-records':route.startsWith('wv2-rule')?'wv2-rules':'wv2-overview';
    if(decodeURIComponent(location.hash.slice(1))!==route)history.pushState(null,'','#'+route);
    window.setActiveMenu(menu);window.updateBreadcrumb(menu,route.includes('|')?'详情':undefined);render();
    const main=document.getElementById('mainContent');if(main)main.scrollTop=0;
  }
  let dialog,returnFocus;
  function closeDialog() { if(dialog){dialog.close();dialog.remove();dialog=null;returnFocus?.focus();} }
  function openDialog(title,body,footer,formId='') {
    closeDialog();returnFocus=document.activeElement;dialog=document.createElement('dialog');dialog.className='wv2-dialog';dialog.setAttribute('aria-labelledby','wv2-dialog-title');
    dialog.innerHTML='<div class="wv2">'+(formId?'<form id="'+formId+'">':'')+'<div class="wv2-dialog-head"><h2 id="wv2-dialog-title">'+E(title)+'</h2>'+btn('关闭','close-dialog')+'</div><div class="wv2-dialog-body">'+body+'<div class="wv2-error" id="wv2-form-error" role="alert"></div></div><div class="wv2-dialog-foot">'+footer+'</div>'+(formId?'</form>':'')+'</div>';
    document.body.appendChild(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});dialog.showModal();
  }
  function error(text) {const el=document.getElementById('wv2-form-error');if(el){el.textContent=text;el.scrollIntoView({block:'nearest'});}}
  let toastTimer;
  function toast(text) {let el=document.getElementById('wv2-toast');if(!el){el=document.createElement('div');el.id='wv2-toast';el.className='wv2-toast';el.setAttribute('role','status');document.body.appendChild(el);}el.textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.textContent='';},4000);}
  const numericField = (name,label,value,step='1',extra='') => '<label class="wv2-field"><span>'+E(label)+'</span><input type="number" name="'+E(name)+'" value="'+E(value)+'" min="0" step="'+step+'" required '+extra+'></label>';
  function paramLabel(k,p) {
    const lower=['low','progress'].includes(p.kind),unit=['quality','increase','decrease'].includes(p.kind)?'百分点':'%';
    return {attention:'关注'+(lower?'比例上限':'偏差 / 比例下限')+'（'+unit+'）',high:'重点'+(lower?'比例上限':'偏差 / 比例下限')+'（'+unit+'）',minN:'每期最小适用分母',attCount:lower?'关注未完成人数门槛':'关注相关人数门槛',highCount:lower?'重点未完成人数门槛':p.kind==='quality'?'重点已核实不符合人数门槛':'重点相关人数门槛',periods:'关注连续期数',target:'演示目标 T（%）',maxUnknown:'待核验比例上限（%）',highN:'重点最小适用分母'}[k]||k;
  }
  function configDialog(id) {
    const r=M.getRule(id),cfg=store.config(id);
    const fields=cfg.params?Object.keys(cfg.params).filter(k=>k!=='kind').map(k=>numericField(k,paramLabel(k,cfg.params),cfg.params[k],['attention','high','target','maxUnknown'].includes(k)?'0.1':'1')).join(''):'';
    openDialog('调整 '+id+' 规则配置','<input type="hidden" name="ruleId" value="'+id+'"><div class="wv2-note">'+E(r.name)+'<p>参数作为本地管理试算条件。调整仅作用于后续试算，历史记录保持原快照。</p></div><div class="wv2-form-grid"><label class="wv2-check wv2-span-full"><input type="checkbox" name="enabled"'+(cfg.enabled?' checked':'')+'>纳入监管范围（本机配置）</label>'+fields+'<label class="wv2-field wv2-span-full"><span>变更依据（必填，至少5字）</span><textarea name="note" minlength="5" required placeholder="填写适用依据、调整原因及目标来源"></textarea></label></div>',btn('取消','close-dialog')+'<button class="wv2-btn wv2-btn-primary" type="submit">保存为 V'+(cfg.version+1)+'</button>','wv2-config-form');
  }
  function simulateDialog(id) {
    const r=M.getRule(id),cfg=store.config(id);if(!r.spec)return;
    const p=cfg.params,samples=M.sampleInput(id,p.periods);
    const periodFields=samples.map((x,i)=>'<section class="wv2-sim-period"><h3>'+(i===samples.length-1?'本次评价周期':'前 '+(samples.length-1-i)+' 个独立周期')+'</h3><div class="wv2-form-grid"><label class="wv2-field wv2-span-full"><span>周期（按规则填写 YYYY-MM 或 YYYY-Qn）</span><input name="period'+i+'" value="'+x.period+'" required></label>'+numericField('n'+i,'完整适用人数 N',x.n)+(['low','progress','quality','decrease'].includes(p.kind)?numericField('completed'+i,p.kind==='quality'?'有证据符合人数 F':p.kind==='decrease'?'县内完成人数':'按期完成人数',x.completed):numericField('count'+i,p.kind==='increase'?'省外首治人数':'未按期完成人数',x.count))+(['quality','increase','decrease'].includes(p.kind)?numericField('unknown'+i,'待核验 / 未知人数 U',x.unknown):'')+(['increase','decrease'].includes(p.kind)?numericField('baseline'+i,'同口径基期比例（%）',x.baseline,'0.1')+numericField('baselineUnknown'+i,'基期未知去向比例（%）',x.baselineUnknown,'0.1'):'')+(p.kind==='followup'?numericField('lost'+i,'按规范确认失访人数',x.lost):'')+(p.kind==='progress'?numericField('overdueDays'+i,'正式截止后天数（未到期填0）',x.overdueDays):'')+'<label class="wv2-check wv2-span-full"><input type="checkbox" name="complete'+i+'" checked>本周期来源已齐备且口径可比</label></div></section>').join('');
    openDialog(id+' · 管理条件试算','<input type="hidden" name="ruleId" value="'+id+'"><div class="wv2-note">'+E(r.name)+' · V'+cfg.version+'<p>'+E(cfg.enabled?'试算只展示条件结果，不生成或发送监管事项。':'本规则已停用，以下仅用于离线验证条件，不形成有效预警。')+'</p></div>'+(p.target!=null?'<p class="wv2-footer-note">演示目标 T = '+p.target+'%；正式指标为 F/N，缺失保护按 (F+U)/N 判断。</p>':'')+'<input type="hidden" name="seriesLength" value="'+samples.length+'">'+'<div class="wv2-form-grid">'+periodFields+'</div><div id="wv2-sim-result" aria-live="polite"></div>',btn('关闭','close-dialog')+'<button type="submit" class="wv2-btn wv2-btn-primary">运行试算</button>','wv2-sim-form');
  }
  function workflowDialog(id,action) {
    const r=store.all().find(x=>x.id===id);if(!r)return;
    const names={start:'开始核查',feedback:'提交核查反馈',close:'复核结束',return:'退回补充'};
    const due=new Date();due.setDate(due.getDate()+7);const dueString=due.getFullYear()+'-'+String(due.getMonth()+1).padStart(2,'0')+'-'+String(due.getDate()).padStart(2,'0');
    let fields='<label class="wv2-field"><span>经办岗位</span><input name="actor" value="'+E(r.person||r.owner)+'" required></label>';
    if(action==='start')fields+='<label class="wv2-field"><span>核查期限</span><input name="deadline" type="date" value="'+dueString+'" required></label>';
    if(action==='feedback')fields+='<label class="wv2-field"><span>核查结果</span><select name="result">'+opt(['已落实改进','数据修正','核实不适用','转持续监测'],'已落实改进')+'</select></label><label class="wv2-field wv2-span-full"><span>材料或来源依据（至少5字）</span><input name="evidence" minlength="5" required placeholder="材料名称、来源批次或核查记录编号"></label>';
    fields+='<label class="wv2-field wv2-span-full"><span>'+(action==='close'?'复核结论与解除依据':'核查说明')+'（至少8字）</span><textarea name="note" minlength="8" required placeholder="说明核实事实、责任安排及后续措施"></textarea></label>';
    if(action==='close')fields+='<label class="wv2-check wv2-span-full"><input name="confirmed" type="checkbox" required>已核对原始来源、规则解除条件和反馈依据，保留历史异常事实。</label>';
    openDialog(names[action],'<input type="hidden" name="recordId" value="'+E(id)+'"><input type="hidden" name="action" value="'+action+'"><div class="wv2-note">'+E(r.title)+(action==='close'?'<p>'+E(M.getRule(r.ruleId).release)+'</p>':'')+'<p>本次操作仅登记本机核查流程。</p></div><div class="wv2-form-grid">'+fields+'</div>',btn('取消','close-dialog')+'<button type="submit" class="wv2-btn wv2-btn-primary">'+names[action]+'</button>','wv2-workflow-form');
  }
  function download(name,rows) {
    const blob=new Blob([M.csv(rows)],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出 '+(rows.length-1)+' 条结果');
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-wv2]');if(!b)return;const action=b.dataset.wv2,id=b.dataset.id;e.preventDefault();
    if(action==='close-dialog')return closeDialog();
    if(action==='all-records')return setRecords({region:S.region});
    if(action==='open-records')return setRecords({region:S.region,status:'OPEN'});
    if(action==='domain-records')return setRecords({region:S.region,domain:id,status:'OPEN'});
    if(action==='region-records')return setRecords({region:id,status:'OPEN'});
    if(action==='status-records')return setRecords({region:S.region,status:id});
    if(action==='rule-records')return setRecords({ruleId:id});
    if(action==='kpi')return setRecords({region:S.region,status:id==='pending'?'PENDING':'OPEN',level:id==='high'?'HIGH':''});
    if(action==='records-domain'){S.filters.domain=id;S.page=1;return render();}
    if(action==='rules-domain'){S.rules.domain=id;return render();}
    if(action==='reset-records'){S.filters={};S.page=1;return render();}
    if(action==='reset-rules'){S.rules={domain:'',keyword:'',readiness:'',enabled:''};return render();}
    if(action==='page'){S.page+=Number(id);return render();}
    if(action==='config')return configDialog(id);
    if(action==='simulate')return simulateDialog(id);
    if(action.startsWith('workflow-'))return workflowDialog(id,action.slice(9));
    if(action==='export-records'){const rows=M.filter(store.all(),S.filters);return download('预警检测V2_监管事项_'+M.AS_OF+'.csv',[['演示记录编号','预警事项','规则编号','领域','地区','癌种/队列','评价周期','发现日期','业务级别','核查状态','归口职能','触发依据','规则版本','核查期限'],...rows.map(r=>[r.id,r.title,r.ruleId,M.getDomain(r.domain).name,r.area,r.cancer,r.period,r.found,levels[r.level],statuses[r.status],r.owner,r.summary,'V'+r.ruleSnapshot.version,r.deadline])]);}
    if(action==='export-rules')return download('预警检测V2_规则目录_'+M.AS_OF+'.csv',[['编号','预警点','监管领域','计算范围','现行关注条件','现行重点条件','验证方式','归口职能','本机版本','范围配置'],...M.rules.map(r=>{const c=store.config(r.id),d=M.describe(c.params);return[r.id,r.name,M.getDomain(r.domain).name,r.scope,d?.attention||r.attention,d?.high||r.high,r.readiness,r.owner,'V'+c.version,c.enabled?'已纳入':'已停用'];})]);
  });
  document.addEventListener('change',e=>{if(e.target.dataset.wv2Change==='overview-region'){S.region=e.target.value;render();}});
  document.addEventListener('submit',e=>{
    if(!e.target.id?.startsWith('wv2-'))return;e.preventDefault();const data=Object.fromEntries(new FormData(e.target));
    if(e.target.id==='wv2-record-filters'){S.filters={...S.filters,...data};S.page=1;return render();}
    if(e.target.id==='wv2-rule-filters'){S.rules={...S.rules,...data};return render();}
    if(e.target.id==='wv2-config-form'){
      const cfg=store.config(data.ruleId),params=M.clone(cfg.params);if(params)Object.keys(params).forEach(k=>{if(k!=='kind')params[k]=Number(data[k]);});
      const result=store.updateConfig(data.ruleId,{enabled:data.enabled==='on',params},data.note);if(result.error)return error(result.error);closeDialog();render();toast(store.storageError()||'规则配置已保存，历史记录保持原快照');return;
    }
    if(e.target.id==='wv2-workflow-form'){
      const result=store.transition(data.recordId,data.action,{...data,confirmed:data.confirmed==='on'});if(result.error)return error(result.error);closeDialog();render();toast(store.storageError()||'核查记录已更新');return;
    }
    if(e.target.id==='wv2-sim-form'){
      const cfg=store.config(data.ruleId),series=Array.from({length:Math.min(12,Number(data.seriesLength)||2)},(_,i)=>{const x={period:data['period'+i],complete:data['complete'+i]==='on'};['n','completed','count','unknown','baseline','baselineUnknown','lost','overdueDays'].forEach(k=>{if(data[k+i]!=null)x[k]=Number(data[k+i]);});return x;});
      const result=M.evaluate(data.ruleId,series,cfg.params);document.getElementById('wv2-form-error').textContent='';
      const resultEl=document.getElementById('wv2-sim-result');resultEl.innerHTML='<div class="wv2-sim-result">'+badge(result.level,cfg.enabled?result.label:'离线验证 · '+result.label)+'<h3>'+E(result.reason)+'</h3>'+result.checks.map((c,i)=>'<p class="wv2-small">'+E(series[i].period)+'：'+E(c.error||c.basis)+'</p>').join('')+'<p class="wv2-footer-note">未创建预警记录，未发送通知。</p></div>';resultEl.scrollIntoView({block:'nearest'});
    }
  });
  const matches = id => typeof id==='string'&&(id==='warning-v2'||/^wv2-(overview|records|rules)$/.test(id)||/^wv2-(record|rule)\|/.test(id));
  const originalNavigate=window.navigateTo,originalRender=window.renderPage;
  window.navigateTo=function(id){if(matches(id))return go(id);closeDialog();if(document.getElementById('wv2-root')&&/^#wv2-/.test(location.hash)&&typeof id==='string')history.pushState(null,'','#'+id);return originalNavigate.apply(this,arguments);};
  window.renderPage=function(id){if(matches(id))return go(id);return originalRender.apply(this,arguments);};
  window.addEventListener('hashchange',()=>{const id=decodeURIComponent(location.hash.slice(1));if(matches(id))go(id);else if(document.getElementById('wv2-root')&&id)window.navigateTo(id);});
  window.WarningV2={navigate:go};
})();
