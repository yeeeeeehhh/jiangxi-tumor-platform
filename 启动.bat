@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo 启动江西肿瘤登记平台...
echo 访问地址：http://localhost:8017/app.html
echo 关闭窗口 = 停止服务
echo.
rem 延迟 3 秒再开浏览器，等服务真正监听 8017，避免打开时拿到空白页
start /min cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:8017/app.html"
node _srv.js
