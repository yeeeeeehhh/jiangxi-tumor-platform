var fs = require("fs");
var s = fs.readFileSync("app.html", "utf8");
var lines = s.split("\n");
var mi = lines.findIndex(function (l) { return l.indexOf("markMenu") >= 0 && l.indexOf("function") >= 0; });
if (mi < 0) { console.log("MARKMENU NOT FOUND"); process.exit(1); }
var ms = mi;
while (ms > 0 && lines[ms].indexOf("/* ") < 0) ms--;
var me = mi;
while (me < lines.length && lines[me].indexOf("markMenu();") < 0) me++;
console.log("MARKMENU BLOCK: " + ms + "-" + me);
lines = lines.slice(0, ms).concat(lines.slice(me + 1));
var gi = lines.findIndex(function (l) { return l.indexOf("GROUP_FIRST") >= 0; });
if (gi < 0) { console.log("GROUPFIRST NOT FOUND"); process.exit(1); }
var gs = gi;
while (gs > 0 && lines[gs].indexOf("/* ") < 0) gs--;
var ge = gi;
while (ge < lines.length && lines[ge].indexOf("_prevRenderPage.apply") < 0) ge++;
console.log("GROUPFIRST BLOCK: " + gs + "-" + ge);
lines = lines.slice(0, gs).concat(lines.slice(ge + 1));
fs.writeFileSync("app.html", lines.join("\n"));
console.log("DEAD CODE CLEANED");
