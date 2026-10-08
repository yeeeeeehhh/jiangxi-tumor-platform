var fs = require("fs");
var s = fs.readFileSync("app.html", "utf8");
var n = 0;
s = s.replace("      \u0027decision-gov\u0027: { title: \u0027数据治理\u0027, mod: \u0027DKV\u0027, view: \u0027gov\u0027 },\r\n", function (m) { n++; return ""; });
if (n !== 1) { console.log("PAGES DEL FAIL:" + n); process.exit(1); }
n = 0;
s = s.replace("drill: \u0027decision-flow\u0027, gov: \u0027decision-gov\u0027 ", function (m) { n++; return "drill: \u0027decision-flow\u0027 "; });
if (n !== 1) { console.log("DEEPLINK DEL FAIL:" + n); process.exit(1); }
n = 0;
s = s.replace("      {id:\u0027decision-flow\u0027,label:\u0027患者流向分析\u0027},\r\n      {id:\u0027decision-gov\u0027,label:\u0027数据治理\u0027},", function (m) { n++; return "      {id:\u0027decision-flow\u0027,label:\u0027患者流向分析\u0027},"; });
if (n !== 1) { console.log("MENU DEL FAIL:" + n); process.exit(1); }
fs.writeFileSync("app.html", s);
console.log("APP CLEAN OK");
var a = fs.readFileSync("analysis.js", "utf8");
n = 0;
a = a.replace("      { id: \u0027decision-flow\u0027, label: \u0027患者流向分析\u0027 },\r\n      { id: \u0027decision-gov\u0027, label: \u0027数据治理\u0027 }", function (m) { n++; return "      { id: \u0027decision-flow\u0027, label: \u0027患者流向分析\u0027 }"; });
if (n !== 1) { console.log("ANALYSIS MENU FAIL:" + n); process.exit(1); }
fs.writeFileSync("analysis.js", a);
console.log("ANALYSIS CLEAN OK");
