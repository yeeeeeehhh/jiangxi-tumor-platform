var fs = require("fs");
var s = fs.readFileSync("app.html", "utf8");
var n = 0;
s = s.replace("    /* \u7ed9\u300c\u9886\u5bfc\u51b3\u7b56\u300d\u4e8c\u7ea7\u5206\u7ec4\u52a0\\\"\u65b0\\\"\u89d2\u6807 \u2014\u2014 \u9886\u5bfc\u5165\u53e3\u4e0d\u8be5\u88ab\u57cb\u6ca1\u5728\u8fd0\u7ef4\u83dc\u5355\u91cc\u3002\r\n     * \u53ea\u6807\u5206\u7ec4\u8282\u70b9\uff0c\u5b50\u9879\u4e0d\u6807\uff0c\u907f\u514d\u89c6\u89c9\u566a\u97f3\u3002 */\r\n    function markMenu() {\r\n      var el = document.querySelector(\u0027.menu-item[data-id=\"decision-group\"]\u0027);\r\n      if (!el || el.querySelector(\u0027.dk-badge\u0027)) return;\r\n      var b = document.createElement(\u0027span\u0027);\r\n      b.className = \u0027dk-badge\u0027;\r\n      b.textContent = \u0027\u65b0\u0027;\r\n      b.style.cssText = \u0027margin-left:auto;margin-right:6px;font-size:10px;line-height:1;padding:2px 5px;\u0027 +\r\n        \u0027border-radius:8px;background:rgba(37,99,235,.12);color:#2563eb;font-weight:600\u0027;\r\n      // \u63d2\u5728\u7bad\u5934\u524d\u9762\uff08\u7bad\u5934\u662f margin-left:auto\uff0c\u76f4\u63a5 append \u4f1a\u88ab\u6324\u5230\u6700\u53f3\uff09\r\n      var arrow = el.querySelector(\u0027.arrow\u0027);\r\n      if (arrow) el.insertBefore(b, arrow); else el.appendChild(b);\r\n    }\r\n\r\n", function (m) { n++; return ""; });
if (n !== 1) { console.log("MARKMENU FAIL:" + n); process.exit(1); }
n = 0;
s = s.replace("    /* \u300c\u9886\u5bfc\u51b3\u7b56\u300d\u5206\u7ec4\u672c\u8eab\u4e0d\u662f\u9875\u9762\uff0c\u70b9\u51fb\u65f6\u9ed8\u8ba4\u5c55\u5f00\u5373\u53ef\uff08buildMenu \u5df2\u5904\u7406\uff09\uff1b\r\n     * \u4f46\u82e5\u7528\u6237\u4ece\u6df1\u94fe\u6216\u7a0b\u5e8f\u5316\u5bfc\u822a\u843d\u5230\u5206\u7ec4 id \u4e0a\uff0c\u91cd\u5b9a\u5411\u5230\u5b83\u7684\u7b2c\u4e00\u4e2a\u5b50\u9875\uff0c\u907f\u514d\u767d\u5c4f\u3002 */\r\n    var GROUP_FIRST = { \u0027decision-group\u0027: \u0027decision-home\u0027 };\r\n    var _prevRenderPage = renderPage;\r\n    renderPage = function (id) {\r\n      if (GROUP_FIRST[id]) return _prevRenderPage.call(this, GROUP_FIRST[id]);\r\n      return _prevRenderPage.apply(this, arguments);\r\n    };\r\n\r\n", function (m) { n++; return ""; });
if (n !== 1) { console.log("GROUPFIRST FAIL:" + n); process.exit(1); }
n = 0;
s = s.replace("      document.addEventListener(\u0027DOMContentLoaded\u0027, function () { setTimeout(gotoDeep, 0); setTimeout(markMenu, 0); });", function (m) { n++; return "      document.addEventListener(\u0027DOMContentLoaded\u0027, function () { setTimeout(gotoDeep, 0); });"; });
if (n !== 1) { console.log("DCL FAIL:" + n); process.exit(1); }
n = 0;
s = s.replace("      setTimeout(gotoDeep, 0);\r\n      setTimeout(markMenu, 0);", function (m) { n++; return "      setTimeout(gotoDeep, 0);"; });
if (n !== 1) { console.log("ELSE FAIL:" + n); process.exit(1); }
fs.writeFileSync("app.html", s);
console.log("DEAD CODE CLEANED");
