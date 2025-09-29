"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditViewProvider = void 0;
const vscode = require("vscode");
class CreditViewProvider {
    constructor(context) {
        this.context = context;
        this._context = context;
    }
    resolveWebviewView(webviewView, context, _token) {
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
                case 'refreshCredits':
                    await this.refreshCredits();
                    break;
            }
        });
        // 自动加载积分数据
        this.loadCredits();
    }
    async loadCredits() {
        try {
            const cachedData = this._context.globalState.get('88code_cached_credits');
            if (cachedData && cachedData.credits !== undefined) {
                const isRecent = Date.now() - cachedData.timestamp < 10 * 60 * 1000; // 10分钟内
                this.updateCreditsDisplay(cachedData.credits, !isRecent);
            }
            else {
                this.updateCreditsDisplay(null);
            }
        }
        catch (error) {
            console.error('加载积分数据失败:', error);
            this.updateCreditsDisplay(null);
        }
    }
    async refreshCredits() {
        try {
            // 触发积分刷新命令
            await vscode.commands.executeCommand('88code.refreshCredits');
            // 等待一小段时间让数据更新
            setTimeout(() => {
                this.loadCredits();
            }, 1000);
        }
        catch (error) {
            console.error('刷新积分失败:', error);
        }
    }
    updateCreditsDisplay(credits, isStale = false) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateCredits',
                credits: credits,
                isStale: isStale
            });
        }
    }
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>剩余积分</title>
            <style>
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
                    padding: 12px;
                    line-height: 1.4;
                }

                /* MD3 卡片样式 - 无阴影无描边 */
                .credit-card {
                    background-color: var(--vscode-input-background);
                    border-radius: 12px;
                    padding: 16px;
                    width: 100%;
                    transition: background-color 0.2s ease;
                    position: relative;
                    overflow: hidden;
                }

                .credit-card:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }

                /* 卡片头部 */
                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                }

                .card-icon {
                    font-size: 16px;
                    color: var(--vscode-textLink-foreground);
                }

                .card-title {
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--vscode-foreground);
                }

                /* 积分显示 */
                .credit-amount {
                    font-size: 24px;
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                    margin-bottom: 8px;
                    font-variant-numeric: tabular-nums;
                }

                .credit-label {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 16px;
                }

                /* 状态指示 */
                .status-indicator {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 12px;
                }

                .status-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background-color: var(--vscode-testing-iconPassed);
                }

                .status-dot.stale {
                    background-color: var(--vscode-editorWarning-foreground);
                }

                .status-dot.error {
                    background-color: var(--vscode-errorForeground);
                }

                /* 刷新按钮 */
                .refresh-button {
                    background: none;
                    border: none;
                    color: var(--vscode-textLink-foreground);
                    font-size: 12px;
                    cursor: pointer;
                    padding: 6px 12px;
                    border-radius: 6px;
                    transition: background-color 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    width: 100%;
                    justify-content: center;
                }

                .refresh-button:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                .refresh-button:active {
                    background-color: var(--vscode-button-secondaryBackground);
                }

                /* 加载状态 */
                .loading-spinner {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* 错误状态 */
                .error-state {
                    text-align: center;
                    color: var(--vscode-errorForeground);
                    font-size: 12px;
                    padding: 8px;
                }

                /* MD3 表面色彩处理 */
                .credit-card::before {
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
            </style>
        </head>
        <body>
            <div class="credit-card">
                <div class="card-header">
                    <span class="card-icon">💎</span>
                    <span class="card-title">剩余积分</span>
                </div>
                
                <div id="creditDisplay">
                    <div class="credit-amount" id="creditAmount">--</div>
                    <div class="credit-label">88CODE 积分</div>
                    <div class="status-indicator" id="statusIndicator">
                        <div class="status-dot" id="statusDot"></div>
                        <span id="statusText">正在加载...</span>
                    </div>
                </div>

                <button class="refresh-button" id="refreshBtn">
                    <span id="refreshIcon">🔄</span>
                    <span>刷新积分</span>
                </button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                // 刷新按钮事件
                document.getElementById('refreshBtn').addEventListener('click', () => {
                    const refreshIcon = document.getElementById('refreshIcon');
                    const statusText = document.getElementById('statusText');
                    
                    refreshIcon.classList.add('loading-spinner');
                    statusText.textContent = '正在刷新...';
                    
                    vscode.postMessage({
                        type: 'refreshCredits'
                    });
                });

                // 格式化积分数字
                function formatCredits(credits) {
                    if (credits === null || credits === undefined) {
                        return '--';
                    }
                    return credits.toLocaleString();
                }

                // 更新积分显示
                function updateCreditsDisplay(credits, isStale = false) {
                    const creditAmount = document.getElementById('creditAmount');
                    const statusDot = document.getElementById('statusDot');
                    const statusText = document.getElementById('statusText');
                    const refreshIcon = document.getElementById('refreshIcon');
                    
                    // 停止加载动画
                    refreshIcon.classList.remove('loading-spinner');
                    
                    if (credits !== null && credits !== undefined) {
                        creditAmount.textContent = formatCredits(credits);
                        
                        if (isStale) {
                            statusDot.className = 'status-dot stale';
                            statusText.textContent = '数据可能过期';
                        } else {
                            statusDot.className = 'status-dot';
                            statusText.textContent = '数据已更新';
                        }
                    } else {
                        creditAmount.textContent = '--';
                        statusDot.className = 'status-dot error';
                        statusText.textContent = '无法获取数据';
                    }
                }

                // 监听来自扩展的消息
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'updateCredits':
                            updateCreditsDisplay(message.credits, message.isStale);
                            break;
                    }
                });

                // 页面加载完成后请求数据
                window.addEventListener('load', () => {
                    // 初始状态已由后端处理
                });
            </script>
        </body>
        </html>`;
    }
}
exports.CreditViewProvider = CreditViewProvider;
CreditViewProvider.viewType = 'creditView';
//# sourceMappingURL=CreditViewProvider.js.map