@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo 启动江西肿瘤登记平台...
echo 访问地址：http://localhost:8017/app.html
echo 关闭窗口 = 停止服务
echo.
start "" http://localhost:8017/app.html
node _srv.js
