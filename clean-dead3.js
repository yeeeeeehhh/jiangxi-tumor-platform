var fs = require("fs");
var lines = fs.readFileSync("app.html", "utf8").split("\n");
function delBlock(startMark, endMark) {
  var si = lines.findIndex(function (l) { return l.indexOf(startMark) >= 0; });
  if (si < 0) { console.log("START NOT FOUND: " + startMark); process.exit(1); }
  var ei = si;
  while (ei < lines.length && lines[ei].indexOf(endMark) < 0) ei++;
  if (ei >= lines.length) { console.log("END NOT FOUND"); process.exit(1); }
  if (lines[ei + 1] && lines[ei + 1].trim() === "") ei++;
  console.log("DEL BLOCK: " + si + "-" + ei + " | " + lines[si].trim().slice(0, 30));
  lines = lines.slice(0, si).concat(lines.slice(ei + 1));
}
delBlock("\u9886\u5bfc\u5165\u53e3\u4e0d\u8be5\u88ab\u57cb\u6ca1", "    }");
delBlock("\u5206\u7ec4\u672c\u8eab\u4e0d\u662f\u9875\u9762", "    };");
lines = lines.filter(function (l) { return l.indexOf("setTimeout(markMenu, 0)") < 0; });
fs.writeFileSync("app.html", lines.join("\n"));
console.log("DEAD CODE CLEANED");
