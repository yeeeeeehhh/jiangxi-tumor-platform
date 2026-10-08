var fs = require("fs");
var NEW = "      { id: \u0027decision-home\u0027, label: \u0027决策总览\u0027 },\r\n      { id: \u0027decision-kpi\u0027, label: \u0027指标达标看板\u0027 },\r\n      { id: \u0027decision-flow\u0027, label: \u0027患者流向分析\u0027 },\r\n      { id: \u0027decision-gov\u0027, label: \u0027数据治理\u0027 }";
var OLD = "      { id: \u0027decision-kpi\u0027, label: \u0027指标达标看板\u0027 },\r\n      { id: \u0027decision-flow\u0027, label: \u0027患者流向分析\u0027 },\r\n      { id: \u0027decision-drill\u0027, label: \u0027流向 · 地市与区县\u0027 }";
var files = ["analysis.js", "app.html"];
files.forEach(function (f) {
  var s = fs.readFileSync(f, "utf8");
  var cnt = s.split(OLD).length - 1;
  if (cnt !== 1) { console.log(f + " MENU FAIL:" + cnt); process.exit(1); }
  s = s.replace(OLD, NEW);
  fs.writeFileSync(f, s);
  console.log(f + " OK");
});
