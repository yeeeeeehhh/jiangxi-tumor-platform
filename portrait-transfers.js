/* 治疗机构变化：从治疗执行记录派生，独立于医院转诊/接诊数据。 */
(function(root){
  'use strict';
  function date(value){
    var s=String(value||'').slice(0,10),d=new Date(s+'T00:00:00Z');
    return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(d)&&d.toISOString().slice(0,10)===s?s:'';
  }
  function name(value){
    return String(value||'').trim().replace(/\s+/g,'').replace(/[（(](?:[\u4e00-\u9fa5]{2,8}省|北京市|上海市|天津市|重庆市)[）)]$/,'');
  }
  function derive(input,cutoff){
    var pending=[],byDay={},codesByName={},seen=new Set();
    var records=(input||[]).filter(function(r){return !['cancelled','planned','撤销','未执行','计划'].includes(r.status)});
    records.forEach(function(r){
      var n=name(r.hospital),code=String(r.hospitalCode||'').trim();
      if(n&&code){if(!codesByName[n])codesByName[n]=new Set();codesByName[n].add(code)}
    });
    records.forEach(function(r){
      var d=date(r.date),n=name(r.hospital),code=String(r.hospitalCode||'').trim();
      if(d&&cutoff&&d>cutoff)return;
      if(!d||(!n&&!code)){pending.push({record:r,reason:!d?'治疗日期缺失或无效':'治疗机构缺失'});return}
      if(!code&&codesByName[n]&&codesByName[n].size>1){pending.push({record:r,reason:'同名机构对应多个编码'});return}
      if(!code&&codesByName[n]&&codesByName[n].size===1)code=Array.from(codesByName[n])[0];
      var key=code?'code:'+code:'name:'+n;
      var raw=String(r.date||''),precise=/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw);
      var clock=precise?raw.slice(11,19):'';
      if(precise&&!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(clock)){pending.push({record:r,reason:'治疗时间无效'});return}
      var stamp=d+(precise?'T'+clock.padEnd(8,':00'):'');
      var signature=JSON.stringify([r.source||'',r.id||'',d,clock,key,r.mode||'',r.plan||'']);
      if(seen.has(signature))return;seen.add(signature);
      var row=Object.assign({},r,{date:d,stamp:stamp,precise:precise,hospital:n||code,key:key});
      (byDay[d]||(byDay[d]=[])).push(row);
    });
    var changes=[],ordered=[],previous=null;
    Object.keys(byDay).sort().forEach(function(d){
      var rows=byDay[d],orgs=new Set(rows.map(function(r){return r.key})),times={};
      rows.forEach(function(r){(times[r.stamp]||(times[r.stamp]=new Set())).add(r.key)});
      var ambiguous=orgs.size>1&&(rows.some(function(r){return !r.precise})||Object.keys(times).some(function(t){return times[t].size>1}));
      if(ambiguous){rows.forEach(function(r){pending.push({record:r,reason:'同日多机构治疗，缺少可判定先后的时间'})});previous=null;return}
      rows.sort(function(a,b){return a.stamp.localeCompare(b.stamp)});
      rows.forEach(function(row){
        ordered.push(row);
        if(previous&&previous.key!==row.key)changes.push({
          id:previous.stamp+'|'+previous.key+'>'+row.stamp+'|'+row.key,
          d:row.date,from:previous.hospital,to:row.hospital,previous:previous,current:row
        });
        previous=row;
      });
    });
    return {records:ordered,changes:changes,pending:pending,state:changes.length?true:pending.length?null:ordered.length?false:null};
  }
  var api={derive:derive,normalizeHospital:name};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SPTransfers=api;
})(typeof window==='object'?window:globalThis);
