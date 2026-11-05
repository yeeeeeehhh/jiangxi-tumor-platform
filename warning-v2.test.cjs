/* Run: node --test app/warning-v2.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./warning-v2-model.js');
const months = (x,prev=x) => [{...prev,period:'2026-08'},{...x,period:'2026-09'}];
const quarters = (x,prev=x) => [{...prev,period:'2026-Q2'},{...x,period:'2026-Q3'}];
const memory = () => {const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};

test('五类30点、17个本地条件，专业规则不冒充数值自动监测',()=>{
  assert.equal(M.domains.length,5);assert.equal(M.rules.length,30);
  assert.equal(new Set(M.rules.map(r=>r.id)).size,30);
  assert.equal(M.rules.filter(r=>r.spec).length,17);
  assert.equal(M.getRule('E04').subrules.length,5);
  for(const r of M.rules.filter(r=>!r.spec))assert.equal(M.evaluate(r.id,months({n:100,count:100})).level,'OBSERVE');
  for(const r of M.rules)assert.ok(r.scope&&r.attention&&r.high&&r.release&&r.owner);
  assert.ok(!M.getRule('C04').high.includes('年度归属'));
});
for(const r of M.rules.filter(r=>r.spec))test(r.id+' 默认参数合法，缺分母/缺分子不产生预警',()=>{
  assert.deepEqual(M.validateParams(r,r.spec),[]);
  assert.notEqual(M.evaluate(r.id,M.sampleInput(r.id)).level,'UNEVALUABLE');
  let s=M.sampleInput(r.id);s[1].n=0;assert.equal(M.evaluate(r.id,s).level,'UNEVALUABLE');
  s=M.sampleInput(r.id);delete s[1][['low','progress','quality','decrease'].includes(r.spec.kind)?'completed':'count'];
  assert.equal(M.evaluate(r.id,s).level,'UNEVALUABLE');
});
test('B02 比例与人数双门槛，重点单期触发',()=>{
  assert.equal(M.evaluate('B02',months({n:50,count:10})).level,'ATTENTION');
  assert.equal(M.evaluate('B02',months({n:30,count:6})).level,'NORMAL');
  assert.equal(M.evaluate('B02',months({n:100,count:35}).slice(1)).level,'HIGH');
  assert.equal(M.evaluate('B02',months({n:50,count:10}).slice(1)).level,'OBSERVE');
});
test('重复、缺口、逆序和错频周期不能拼接成连续关注',()=>{
  const x={n:50,count:10};
  for(const periods of [['2026-09','2026-09'],['2026-07','2026-09'],['2026-09','2026-08']]){
    assert.equal(M.evaluate('B02',periods.map(period=>({...x,period}))).level,'OBSERVE');
  }
  assert.equal(M.evaluate('B02',quarters(x)).level,'UNEVALUABLE');
  assert.equal(M.evaluate('B02',[{...x,period:'2026-13'}]).level,'UNEVALUABLE');
  assert.equal(M.evaluate('B02',[{...x,period:'2025-12'},{...x,period:'2026-01'}]).level,'ATTENTION');
});
test('配置三期后，试算输入与持续周期同步扩展',()=>{
  const input=M.sampleInput('B02',3);
  assert.deepEqual(input.map(x=>x.period),['2026-07','2026-08','2026-09']);
  assert.equal(M.evaluate('B02',input,{periods:3}).level,'ATTENTION');
  assert.equal(M.evaluate('B02',input.slice(1),{periods:3}).level,'OBSERVE');
  assert.equal(M.sampleInput('C07',12).length,12);
});
test('B01 正式截止日补充条件不受50人门槛约束',()=>{
  assert.equal(M.evaluate('B01',months({n:5,completed:4,overdueDays:1}).slice(1)).level,'ATTENTION');
  assert.equal(M.evaluate('B01',months({n:5,completed:4,overdueDays:31}).slice(1)).level,'HIGH');
  assert.equal(M.evaluate('B01',months({n:5,completed:5,overdueDays:31})).level,'NORMAL');
});
test('低向指标的等值边界使用严格小于',()=>{
  assert.equal(M.evaluate('B04',quarters({n:100,completed:80})).level,'NORMAL');
  assert.equal(M.evaluate('B04',quarters({n:100,completed:79})).level,'ATTENTION');
  assert.equal(M.evaluate('B04',quarters({n:100,completed:60})).level,'ATTENTION');
  assert.equal(M.evaluate('B04',quarters({n:100,completed:59})).level,'HIGH');
});
test('Q 保留正式分母，Pmax防止未知资料误报，样本不足不能判重点',()=>{
  let result=M.evaluate('C01',quarters({n:100,completed:83,unknown:2}));
  assert.equal(result.level,'ATTENTION');assert.equal(result.current.observed,83);assert.equal(result.current.value,5);
  assert.equal(M.evaluate('C01',quarters({n:100,completed:84,unknown:2})).level,'OBSERVE');
  assert.equal(M.evaluate('C01',quarters({n:100,completed:70,unknown:6})).level,'UNEVALUABLE');
  assert.equal(M.evaluate('C01',quarters({n:100,completed:80,unknown:0})).level,'HIGH');
  assert.equal(M.evaluate('C01',quarters({n:30,completed:20,unknown:0})).level,'ATTENTION');
  assert.equal(M.evaluate('C01',quarters({n:100,completed:99,unknown:2})).level,'UNEVALUABLE');
});
test('B03 项目目标与未知比例门槛独立于临床Q',()=>{
  assert.equal(M.getRule('B03').spec.target,55);
  assert.equal(M.evaluate('B03',quarters({n:100,completed:40,unknown:10})).level,'ATTENTION');
  assert.equal(M.evaluate('B03',quarters({n:100,completed:40,unknown:11})).level,'UNEVALUABLE');
});
test('D01/D02 采用当期与基期缺失的保守界限',()=>{
  let r=M.evaluate('D01',quarters({n:200,count:30,unknown:10,baseline:10,baselineUnknown:5}));
  assert.equal(r.level,'OBSERVE');assert.equal(r.current.value,.5);
  assert.equal(M.evaluate('D01',quarters({n:200,count:30,unknown:11,baseline:10})).level,'UNEVALUABLE');
  assert.equal(M.evaluate('D01',quarters({n:200,count:50,baseline:10})).level,'HIGH');
  r=M.evaluate('D02',quarters({n:200,completed:70,unknown:10,baseline:45,baselineUnknown:5}));
  assert.equal(r.level,'OBSERVE');assert.equal(r.current.value,2.75);
  assert.equal(M.evaluate('D02',quarters({n:200,completed:70,baseline:50})).level,'HIGH');
});
test('来源未到齐、人数越界、非整数都不可评价',()=>{
  for(const x of [{n:100,count:35,complete:false},{n:100,count:101},{n:100,count:-1},{n:100,count:35.5}])assert.equal(M.evaluate('B02',months(x)).level,'UNEVALUABLE');
});
test('E06 确认失访达到单期重点可独立触发',()=>{
  assert.equal(M.evaluate('E06',quarters({n:100,count:20,lost:20}).slice(1)).level,'HIGH');
  assert.equal(M.evaluate('E06',quarters({n:100,count:10,lost:10})).level,'ATTENTION');
  assert.equal(M.evaluate('E06',quarters({n:100,count:10,lost:10},{n:100,count:20,lost:0})).level,'OBSERVE');
  assert.equal(M.evaluate('E06',quarters({n:100,count:10,lost:11})).level,'UNEVALUABLE');
});
test('流向的已核实分母门槛独立于覆盖率门槛',()=>{
  assert.equal(M.evaluate('D01',quarters({n:100,count:30,unknown:5,baseline:10})).level,'UNEVALUABLE');
});
test('配置校验、版本历史、持久化及历史快照冻结',()=>{
  const storage=memory(),store=M.createStore(storage),before=store.all().find(r=>r.ruleId==='C01');
  const original=store.config('C01');
  assert.ok(store.updateConfig('C01',{enabled:true,params:original.params},'短').error);
  for(const patch of [{high:3},{minN:0},{periods:1.5},{maxUnknown:101},{target:0},{highN:10},{kind:'late'}])assert.ok(store.updateConfig('C01',{enabled:true,params:{...original.params,...patch}},'校验不合规参数').error);
  assert.ok(store.updateConfig('C01',{enabled:false,params:{...original.params,target:92}},'本地测试目标调整').value);
  const restored=M.createStore(storage);assert.equal(restored.config('C01').version,2);assert.equal(restored.config('C01').enabled,false);
  assert.equal(restored.ruleHistory().length,1);assert.equal(restored.config('C01').params.target,92);
  assert.deepEqual(restored.all().find(r=>r.id===before.id).ruleSnapshot,before.ruleSnapshot);
});
test('核查闭环、退回、重复提交与观察记录隔离',()=>{
  const storage=memory(),s=M.createStore(storage),id='WV2-0001',at='2026-10-30T10:00:00+08:00';
  assert.ok(s.transition(id,'feedback',{note:'提前反馈不应被允许'},at).error);
  assert.ok(s.transition(id,'start',{note:'组织属地核对服务情况',deadline:'2026-10-29'},at).error);
  assert.ok(s.transition(id,'start',{note:'组织属地核对服务情况',deadline:'2026-02-30'},at).error);
  assert.equal(s.transition(id,'start',{note:'组织属地核对服务情况',deadline:'2026-11-06',actor:'医政经办岗'},at).value.status,'PROCESSING');
  assert.ok(s.transition(id,'start',{note:'重复启动核查不应允许',deadline:'2026-11-06'},at).error);
  assert.ok(s.transition(id,'feedback',{note:'核查结果已经完成并补正',result:'已落实改进',evidence:''},at).error);
  const feedback={note:'核查结果已经完成并补正',result:'已落实改进',evidence:'演示核查报告2026'};
  assert.equal(s.transition(id,'feedback',feedback,at).value.status,'REVIEW');
  assert.ok(s.transition(id,'close',{note:'来源已经核对符合解除条件'},at).error);
  assert.equal(s.transition(id,'return',{note:'请补充原始来源与有效证据'},at).value.status,'PROCESSING');
  s.transition(id,'feedback',feedback,at);
  assert.equal(s.transition(id,'close',{note:'已核对来源并确认符合解除条件',confirmed:true},at).value.status,'CLOSED');
  assert.equal(M.createStore(storage).all().find(r=>r.id===id).logs.length,6);
  assert.ok(s.transition('WV2-0014','start',{note:'观察不能作为正式整改事件',deadline:'2026-11-06'},at).error);
  assert.ok(s.transition('WV2-0018','start',{note:'缺资料不能作为正式整改事件',deadline:'2026-11-06'},at).error);
});
test('汇总、筛选与事件状态一致，按事项而非病例累加',()=>{
  const list=M.seedRecords(),s=M.summary(list);
  assert.deepEqual(s,{total:24,open:19,high:7,pending:7,review:2,closed:2,observe:3,regions:11});
  assert.equal(M.filter(list,{status:'OPEN'}).length,s.open);
  assert.equal(M.filter(list,{region:'南昌市',status:'OPEN'}).length,2);
  assert.equal(M.filter(list,{keyword:'C01'}).length,1);
  assert.equal(M.filter(list,{ruleId:'B02'}).length,3);
  assert.equal(M.filter(list,{from:'2026-10-01'}).length,22);
  assert.equal(M.filter(list,{domain:'A',level:'HIGH'}).length,1);
});
test('损坏/受限存储有可见错误，导出保留中文和防公式注入',()=>{
  assert.match(M.createStore({getItem:()=>'{'}).storageError(),/读取失败/);
  const s=M.createStore({getItem:()=>null,setItem:()=>{throw Error('quota');}});
  s.updateConfig('E01',{enabled:false},'暂时停止纳入范围');assert.match(s.storageError(),/未能保存/);
  const csv=M.csv([['事项','说明'],['=1+1','中文,"引号"\n换行']]);
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"中文,""引号""\n换行"'));
});
