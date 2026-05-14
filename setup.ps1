# Movie Note - 环境配置脚本
# 以管理员身份运行此脚本以安装必要的构建工具

Write-Host "=== Movie Note 环境配置 ===" -ForegroundColor Cyan

# 1. 检查 Node.js
Write-Host "`n[1/3] 检查 Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  Node.js $nodeVersion 已安装" -ForegroundColor Green
} catch {
    Write-Host "  Node.js 未安装，请从 https://nodejs.org 下载安装" -ForegroundColor Red
}

# 2. 检查 Rust
Write-Host "`n[2/3] 检查 Rust..." -ForegroundColor Yellow
try {
    $rustVersion = rustc --version
    Write-Host "  $rustVersion 已安装" -ForegroundColor Green
} catch {
    Write-Host "  Rust 未安装，正在安装..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://sh.rustup.rs" -OutFile "$env:TEMP\rustup-init.exe"
    & "$env:TEMP\rustup-init.exe" -y
    $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
}

# 3. 检查 Visual Studio Build Tools
Write-Host "`n[3/3] 检查 Visual Studio Build Tools..." -ForegroundColor Yellow
$vsPath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vsPath) {
    $vcTools = & $vsPath -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -latest -property installationPath
    if ($vcTools) {
        Write-Host "  VC Build Tools 已安装: $vcTools" -ForegroundColor Green
    } else {
        Write-Host "  VC Build Tools 未安装" -ForegroundColor Red
        Write-Host "  请运行 Visual Studio Installer 并安装「使用 C++ 的桌面开发」工作负载" -ForegroundColor Yellow
        Write-Host "  或运行: winget install Microsoft.VisualStudio.2022.BuildTools" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Visual Studio Installer 未找到" -ForegroundColor Red
    Write-Host "  请安装 Visual Studio Build Tools:" -ForegroundColor Yellow
    Write-Host "  https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022" -ForegroundColor Yellow
}

# 安装 npm 依赖
Write-Host "`n安装前端依赖..." -ForegroundColor Yellow
npm install

Write-Host "`n=== 配置完成 ===" -ForegroundColor Cyan
Write-Host "运行 'npm run dev' 启动前端开发服务器" -ForegroundColor White
Write-Host "运行 'npm run tauri dev' 启动完整 Tauri 应用（需要 Rust 和 VC Tools）" -ForegroundColor White
