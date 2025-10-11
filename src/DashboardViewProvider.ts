import * as vscode from 'vscode';
import * as https from 'https';
import { URL } from 'url';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'dashboardView';
    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;
    private _refreshTimer?: NodeJS.Timer;

    constructor(private readonly context: vscode.ExtensionContext) {
        this._context = context;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.context.extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'loadDashboard':
                    await this.loadDashboard();
                    break;
                case 'logout':
                    await this.logout();
                    break;
                // 重置余额功能已禁用
                // case 'resetCredits':
                //     await this.resetCredits();
                //     break;
            }
        });

        // 自动加载仪表盘数据
        this.loadDashboard();
        
        // 启动定时刷新
        this.startPeriodicRefresh();
    }

    public async refresh() {
        await this.loadDashboard();
    }

    private async loadDashboard() {
        try {
            const token = this._context.globalState.get('88code_token') as string;
            if (!token) {
                throw new Error('未找到登录令牌');
            }

            // 并发获取仪表盘数据、积分数据和 Codex 数据
            const [dashboardResponse, creditsResponse, codexResponse] = await Promise.all([
                this.httpRequestWithAuth('GET', 'https://www.88code.org/admin-api/cc-admin/user/dashboard', token),
                this.httpRequestWithAuth('GET', 'https://www.88code.org/admin-api/cc-admin/system/subscription/my/credit-history?pageNum=1&pageSize=20', token),
                this.httpRequestWithAuth('GET', 'https://www.88code.org/admin-api/cc-admin/user/openai-daily-usage', token)
            ]);
            
            // 提取余额信息
            let credits = 0;
            if (creditsResponse.ok && creditsResponse.data && creditsResponse.data.list && creditsResponse.data.list.length > 0) {
                credits = creditsResponse.data.list[0].remainingCredits || 0;
            }

            // 提取 Codex 信息
            let codexRemaining = 0;
            let codexLimit = 0;
            if (codexResponse.ok && codexResponse.data) {
                const { used, limit } = codexResponse.data;
                codexRemaining = limit - used;
                codexLimit = limit;
            }

            // 合并数据发送给前端
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'dashboardData',
                    data: {
                        ...dashboardResponse.data,
                        credits: credits,
                        codex: {
                            remaining: codexRemaining,
                            limit: codexLimit
                        }
                    }
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`加载仪表盘失败: ${error}`);
        }
    }

    private async logout() {
        // 停止定时刷新
        this.stopPeriodicRefresh();

        await this._context.globalState.update('88code_token', undefined);
        await vscode.commands.executeCommand('setContext', '88code:loggedIn', false);
        vscode.window.showInformationMessage('已退出登录');
    }

    private async resetCredits() {
        await vscode.commands.executeCommand('88code.resetCredits');
        // 重置后刷新仪表盘数据
        setTimeout(() => {
            this.loadDashboard();
        }, 1000);
    }

    private httpRequestWithAuth(method: string, url: string, token: string, data?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const postData = data ? JSON.stringify(data) : undefined;

            const headers: any = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'saToken': token,
                'User-Agent': 'VSCode Extension'
            };

            if (postData) {
                headers['Content-Length'] = Buffer.byteLength(postData);
            }

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: headers
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);
                        resolve(response);
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (postData) {
                req.write(postData);
            }
            req.end();
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>88CODE 仪表盘</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                .icon {
                    margin-right: 6px;
                }
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 16px;
                    line-height: 1.5;
                }

                .dashboard-container {
                    max-width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                /* 卡片容器：增加卡片之间的间距 */
                #dashboardContent {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 28px; /* 增加卡片垂直间距 */
                    padding: 8px 0; /* 上下添加内边距，左右保持0 */
                }

                /* 取消页面顶部标题与分割线（原 .header 已移除） */

                /* MD3 积分卡片 */
                .credit-card {
                    background-color: var(--vscode-input-background);
                    border-radius: 12px;
                    padding: 20px;
                    margin: 12px 0; /* 上下外边距，左右保持0 */
                    position: relative;
                    overflow: hidden;
                    transition: all 0.2s ease;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
                }

                .credit-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, 
                        rgba(var(--vscode-textLink-foreground), 0.03) 0%, 
                        transparent 50%);
                    pointer-events: none;
                }

                .credit-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .credit-icon {
                    font-size: 24px;
                }

                .credit-title {
                    font-size: 16px;
                    font-weight: 500;
                    color: var(--vscode-foreground);
                }

                .credit-amount {
                    font-size: 32px;
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                    margin-bottom: 8px;
                    font-variant-numeric: tabular-nums;
                    transition: all 0.3s ease;
                }

                /* 余额变化提示样式 - 显示在副标题中 */
                .credit-change {
                    font-size: 13px;
                    font-weight: 600;
                    margin: 0 4px;
                    display: inline-block;
                    animation: fadeIn 0.3s ease;
                }

                .credit-change.positive {
                    color: #4caf50; /* 绿色 - 增加 */
                }

                .credit-change.negative {
                    color: #ff9800; /* 橙色 - 减少 */
                }

                /* 淡入动画 */
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: scale(0.8);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                /* 淡出动画 */
                @keyframes fadeOut {
                    from {
                        opacity: 1;
                        transform: scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: scale(0.8);
                    }
                }

                .credit-change.fade-out {
                    animation: fadeOut 0.3s ease forwards;
                }

                .credit-subtitle {
                    font-size: 14px;
                    color: var(--vscode-descriptionForeground);
                }

                .credit-actions {
                    margin-top: 12px;
                    display: flex;
                    justify-content: flex-end;
                }

                .credit-reset-btn {
                    font-size: 12px;
                    padding: 6px 12px;
                    border-radius: 16px;
                    min-width: auto;
                    flex: none;
                }

                .button-icon {
                    font-size: 14px;
                }

                /* 设置面板样式 */
                .settings-panel {
                    margin-top: 8px;
                }

                .settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    user-select: none;
                    margin-bottom: 0;
                }

                .settings-header:hover {
                    opacity: 0.8;
                }

                .collapse-icon {
                    font-size: 14px;
                    transition: transform 0.3s ease;
                }

                .collapse-icon.collapsed {
                    transform: rotate(-90deg);
                }

                .settings-content {
                    max-height: 500px;
                    overflow: hidden;
                    transition: max-height 0.3s ease, opacity 0.3s ease;
                    opacity: 1;
                    padding-top: 16px;
                }

                .settings-content.collapsed {
                    max-height: 0;
                    opacity: 0;
                    padding-top: 0;
                }

                .setting-group {
                    margin-bottom: 16px;
                }

                .setting-label {
                    display: block;
                    font-size: 13px;
                    color: var(--vscode-foreground);
                    margin-bottom: 6px;
                    font-weight: 500;
                }

                .setting-input {
                    width: 100%;
                    padding: 8px 12px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    font-size: 13px;
                    font-family: var(--vscode-font-family);
                    outline: none;
                    transition: border-color 0.2s ease;
                }

                .setting-input:focus {
                    border-color: var(--vscode-focusBorder);
                }

                .setting-input::placeholder {
                    color: var(--vscode-input-placeholderForeground);
                }

                .setting-checkbox {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    color: var(--vscode-foreground);
                }

                .setting-checkbox input[type="checkbox"] {
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                }

                .settings-save-btn {
                    width: 100%;
                    margin-top: 8px;
                }

                /* MD3 数据卡片 */
                .data-card {
                    background-color: var(--vscode-input-background);
                    border-radius: 12px;
                    padding: 16px;
                    margin: 12px 0; /* 上下外边距，左右保持0 */
                    position: relative;
                    overflow: hidden;
                    transition: all 0.2s ease;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
                }

                .data-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, 
                        rgba(var(--vscode-textLink-foreground), 0.02) 0%, 
                        transparent 50%);
                    pointer-events: none;
                }

                .data-card:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }

                .card-title {
                    font-size: 16px;
                    font-weight: 500;
                    color: var(--vscode-foreground);
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .card-icon {
                    font-size: 16px;
                }

                .metric-grid {
                    display: grid;
                    gap: 12px;
                }

                .metric-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }

                .metric-item:last-child {
                    border-bottom: none;
                }

                .metric-label {
                    font-size: 14px;
                    color: var(--vscode-foreground);
                    font-weight: 400;
                }

                .metric-value {
                    font-size: 14px;
                    font-weight: 600;
                    font-variant-numeric: tabular-nums;
                    color: var(--vscode-textLink-foreground);
                }

                .metric-value.cost {
                    color: var(--vscode-errorForeground);
                }

                .metric-value.positive {
                    color: var(--vscode-testing-iconPassed);
                }

                /* 按钮组 */
                .button-group {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                    margin: 12px 0; /* 上下外边距，左右保持0 */
                }

                /* MD3 按钮 */
                .md3-button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 20px;
                    padding: 10px 24px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    justify-content: center;
                    min-height: 40px;
                    flex: 1;
                }

                .md3-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                }

                .md3-button:active {
                    transform: translateY(0);
                }

                .md3-button.secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }

                .md3-button.secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                /* 加载状态 */
                .loading {
                    text-align: center;
                    padding: 40px;
                    color: var(--vscode-descriptionForeground);
                    font-size: 14px;
                }

                .loading-spinner {
                    animation: spin 1s linear infinite;
                    margin-right: 8px;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* 响应式设计 */
                @media (max-width: 300px) {
                    .dashboard-container {
                        gap: 12px;
                    }
                    
                    .credit-card, .data-card {
                        padding: 12px;
                    }
                    
                    .credit-amount {
                        font-size: 28px;
                    }
                }

                /* VSCode 主题适配 */
                @media (prefers-color-scheme: dark) {
                    .credit-card::before {
                        background: linear-gradient(135deg, 
                            rgba(255, 255, 255, 0.02) 0%, 
                            transparent 50%);
                    }
                }

                @media (prefers-color-scheme: light) {
                    .credit-card::before {
                        background: linear-gradient(135deg, 
                            rgba(0, 0, 0, 0.02) 0%, 
                            transparent 50%);
                    }
                }
            </style>
        </head>
        <body>
            <div class="dashboard-container">
                
                <div id="loading" class="loading">
                    加载仪表盘数据中...
                </div>
                
                <div id="dashboardContent" style="display: none;">
                    <!-- MD3 余额卡片 -->
                    <div class="credit-card">
                        <div class="credit-header">
                            <span class="credit-title">剩余余额</span>
                        </div>
                        <div class="credit-amount" id="remainingCredits">-</div>
                        <div class="credit-subtitle">
                            您的可用额度<span id="creditChange"></span>（美元）
                        </div>
                        <!-- 重置余额按钮已隐藏 -->
                        <!-- <div class="credit-actions">
                            <button id="resetCreditsBtn" class="md3-button credit-reset-btn">
                                <span class="button-icon"><i class="fas fa-sync"></i></span>
                                重置余额
                            </button>
                        </div> -->
                    </div>

                    <!-- MD3 Codex 用量卡片 - 已隐藏 -->
                    <!-- <div class="credit-card">
                        <div class="credit-header">
                            <span class="credit-title">Codex 剩余用量</span>
                        </div>
                        <div class="credit-amount" id="codexUsage">-</div>
                        <div class="credit-subtitle">今日 OpenAI 余额</div>
                    </div> -->

                    <!-- 今日活动卡片 -->
                    <div class="data-card">
                        <div class="card-title">
                            今日活动
                        </div>
                        <div class="metric-grid">
                            <div class="metric-item">
                                <span class="metric-label">今日请求</span>
                                <span class="metric-value" id="todayRequests">-</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">今日 Token</span>
                                <span class="metric-value" id="todayTokens">-</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">今日费用</span>
                                <span class="metric-value cost" id="todayCost">-</span>
                            </div>
                        </div>
                    </div>

                    <!-- 使用统计卡片 -->
                    <div class="data-card">
                        <div class="card-title">
                            使用统计
                        </div>
                        <div class="metric-grid">
                            <div class="metric-item">
                                <span class="metric-label">API 密钥总数</span>
                                <span class="metric-value" id="totalApiKeys">-</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">活跃 API 密钥</span>
                                <span class="metric-value positive" id="activeApiKeys">-</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">总使用费用</span>
                                <span class="metric-value cost" id="totalCost">-</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">总请求数</span>
                                <span class="metric-value" id="totalRequests">-</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">总 Token 数</span>
                                <span class="metric-value" id="totalTokens">-</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">输入 Token</span>
                                <span class="metric-value" id="inputTokens">-</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">输出 Token</span>
                                <span class="metric-value" id="outputTokens">-</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">缓存创建 Token</span>
                                <span class="metric-value" id="cacheCreateTokens">-</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">缓存读取 Token</span>
                                <span class="metric-value" id="cacheReadTokens">-</span>
                            </div>
                        </div>
                    </div>

                    <div class="button-group">
                        <button id="refreshBtn" class="md3-button">
                            刷新数据
                        </button>
                        <button id="logoutBtn" class="md3-button secondary">
                            退出登录
                        </button>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                // 退出登录
                document.getElementById('logoutBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        type: 'logout'
                    });
                });

                // 刷新数据
                document.getElementById('refreshBtn').addEventListener('click', () => {
                    document.getElementById('loading').style.display = 'block';
                    document.getElementById('dashboardContent').style.display = 'none';
                    vscode.postMessage({
                        type: 'loadDashboard'
                    });
                });

                // 重置余额按钮事件已注释
                // document.getElementById('resetCreditsBtn').addEventListener('click', () => {
                //     vscode.postMessage({
                //         type: 'resetCredits'
                //     });
                // });

                // 格式化数字 - 仪表盘使用K/M格式
                function formatNumber(num) {
                    if (num >= 1000000) {
                        return (num / 1000000).toFixed(1) + 'M';
                    } else if (num >= 1000) {
                        return (num / 1000).toFixed(1) + 'K';
                    }
                    return num.toLocaleString();
                }

                // 格式化余额 - 显示完整数字（美元）
                function formatCredits(credits) {
                    return '$' + credits.toString();
                }

                // 存储上一次的余额，用于检测变化
                let previousCredits = null;
                let hideChangeTimer = null;

                // 更新余额显示，包含变化提示
                function updateCreditsDisplay(credits) {
                    const creditElement = document.getElementById('remainingCredits');
                    const changeElement = document.getElementById('creditChange');
                    if (!creditElement || !changeElement) return;

                    // 更新余额数值
                    creditElement.textContent = formatCredits(credits);

                    // 计算余额变化
                    let changeHtml = '';
                    if (previousCredits !== null && previousCredits !== credits) {
                        const change = credits - previousCredits;
                        if (change < 0) {
                            // 余额减少：橙色显示负值
                            changeHtml = '<span class="credit-change negative">(' + change + ')</span>';
                        } else if (change > 0) {
                            // 余额增加：绿色显示正值
                            changeHtml = '<span class="credit-change positive">(+' + change + ')</span>';
                        }
                    }

                    // 更新变化提示到副标题中间
                    changeElement.innerHTML = changeHtml;

                    // 如果有变化，1秒后隐藏变化提示
                    if (changeHtml) {
                        // 清除之前的定时器
                        if (hideChangeTimer) {
                            clearTimeout(hideChangeTimer);
                        }

                        // 1秒后隐藏变化提示
                        hideChangeTimer = setTimeout(function() {
                            const change = changeElement.querySelector('.credit-change');
                            if (change) {
                                // 添加淡出动画
                                change.classList.add('fade-out');

                                // 动画完成后移除元素
                                setTimeout(function() {
                                    changeElement.innerHTML = '';
                                }, 300); // 等待淡出动画完成
                            }
                        }, 1000);
                    }

                    // 保存当前余额
                    previousCredits = credits;
                }

                // 监听来自扩展的消息
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'dashboardData':
                            updateDashboard(message.data);
                            break;
                    }
                });

                function updateDashboard(data) {
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('dashboardContent').style.display = 'block';

                    // 余额显示 - 使用完整数字（美元格式），带变化提示
                    if (data.credits !== undefined) {
                        updateCreditsDisplay(data.credits);
                    }

                    // Codex 用量显示 - 已隐藏，注释掉相关代码
                    // if (data.codex && data.codex.remaining !== undefined && data.codex.limit !== undefined) {
                    //     const codexText = '$' + data.codex.remaining.toFixed(2) + '/$' + data.codex.limit.toFixed(2);
                    //     document.getElementById('codexUsage').textContent = codexText;
                    // }
                    
                    // 概览信息
                    document.getElementById('totalApiKeys').textContent = data.overview.totalApiKeys;
                    document.getElementById('activeApiKeys').textContent = data.overview.activeApiKeys;
                    document.getElementById('totalCost').textContent = '$' + data.overview.cost.toFixed(2);
                    
                    // 使用统计 - 使用K/M格式
                    document.getElementById('totalRequests').textContent = formatNumber(data.overview.totalRequestsUsed);
                    document.getElementById('totalTokens').textContent = formatNumber(data.overview.totalTokensUsed);
                    document.getElementById('inputTokens').textContent = formatNumber(data.overview.totalInputTokensUsed);
                    document.getElementById('outputTokens').textContent = formatNumber(data.overview.totalOutputTokensUsed);
                    document.getElementById('cacheCreateTokens').textContent = formatNumber(data.overview.totalCacheCreateTokensUsed);
                    document.getElementById('cacheReadTokens').textContent = formatNumber(data.overview.totalCacheReadTokensUsed);
                    
                    // 今日活动 - 使用K/M格式
                    document.getElementById('todayRequests').textContent = formatNumber(data.recentActivity.requestsToday);
                    document.getElementById('todayTokens').textContent = formatNumber(data.recentActivity.tokensToday);
                    document.getElementById('todayCost').textContent = '$' + data.recentActivity.cost.toFixed(6);
                }

                // 页面加载完成后自动加载数据
                window.addEventListener('load', () => {
                    vscode.postMessage({
                        type: 'loadDashboard'
                    });
                });
            </script>
        </body>
        </html>`;
    }

    private startPeriodicRefresh() {
        // 每2秒自动刷新仪表盘数据
        this._refreshTimer = setInterval(async () => {
            try {
                await this.loadDashboard();
            } catch (error) {
                console.log('定时刷新仪表盘失败:', error);
            }
        }, 2 * 1000);
    }

    private stopPeriodicRefresh() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = undefined;
        }
    }

    public dispose() {
        this.stopPeriodicRefresh();
    }
}
