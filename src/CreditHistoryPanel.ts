import * as vscode from 'vscode';
import * as https from 'https';
import { URL } from 'url';

export class CreditHistoryPanel {
    private _panel?: vscode.WebviewPanel;
    private _context: vscode.ExtensionContext;
    private _currentFilters = {
        timeRange: 'all',
        operationType: 'all'
    };

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public async show() {
        if (this._panel) {
            this._panel.reveal(vscode.ViewColumn.One);
            return;
        }

        this._panel = vscode.window.createWebviewPanel(
            'creditHistory',
            '💰 额度变化记录',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this._panel.webview.html = this._getLoadingHtml();

        this._panel.onDidDispose(() => {
            this._panel = undefined;
        });

        // 加载积分历史数据
        await this.loadCreditHistory();

        // 监听来自 webview 的消息
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'loadPage':
                    await this.loadCreditHistory(message.pageNum);
                    break;
                case 'refresh':
                    await this.loadCreditHistory(1);
                    break;
                case 'filterChange':
                    this._currentFilters = message.filters;
                    await this.loadCreditHistory(1);
                    break;
                case 'openDocs':
                    vscode.env.openExternal(vscode.Uri.parse('https://docs.88code.org/'));
                    break;
            }
        });
    }

    private async loadCreditHistory(pageNum: number = 1) {
        try {
            const token = this._context.globalState.get('88code_token') as string;
            if (!token) {
                vscode.window.showErrorMessage('未找到登录令牌，请重新登录');
                return;
            }

            // 构建 URL
            let url = '';
            const params = new URLSearchParams();
            params.append('pageNum', pageNum.toString());
            params.append('pageSize', '20');

            // 时间范围筛选
            if (this._currentFilters.timeRange !== 'all') {
                const timeRange = this.getTimeRange(this._currentFilters.timeRange);
                params.append('startTime', timeRange.start);
                params.append('endTime', timeRange.end);
                url = `https://88code.org/admin-api/cc-admin/system/subscription/my/credit-history/range?${params.toString()}`;
            } else {
                // 操作类型筛选
                if (this._currentFilters.operationType !== 'all') {
                    params.append('operationType', this._currentFilters.operationType);
                }
                url = `https://88code.org/admin-api/cc-admin/system/subscription/my/credit-history?${params.toString()}`;
            }

            const response = await this.httpRequestWithAuth('GET', url, token);

            if (response.ok && response.data) {
                if (this._panel) {
                    this._panel.webview.html = this._getHistoryHtml(response.data);
                    // 通知 webview 数据已加载，滚动到顶部
                    setTimeout(() => {
                        if (this._panel) {
                            this._panel.webview.postMessage({ type: 'scrollToTop' });
                        }
                    }, 100);
                }
            } else {
                vscode.window.showErrorMessage(`加载额度变化记录失败: ${response.msg || '未知错误'}`);
            }
        } catch (error) {
            console.error('加载额度变化记录失败:', error);
            vscode.window.showErrorMessage(`加载额度变化记录失败: ${error}`);
        }
    }

    private getTimeRange(type: string): { start: string; end: string } {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        if (type === 'today') {
            // 今天：00:00:00 到 23:59:59
            return {
                start: `${year}-${month}-${day} 00:00:00`,
                end: `${year}-${month}-${day} 23:59:59`
            };
        } else if (type === 'week') {
            // 本周：7天前到现在
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const wYear = weekAgo.getFullYear();
            const wMonth = String(weekAgo.getMonth() + 1).padStart(2, '0');
            const wDay = String(weekAgo.getDate()).padStart(2, '0');
            const wHour = String(weekAgo.getHours()).padStart(2, '0');
            const wMin = String(weekAgo.getMinutes()).padStart(2, '0');
            const wSec = String(weekAgo.getSeconds()).padStart(2, '0');
            
            const nHour = String(now.getHours()).padStart(2, '0');
            const nMin = String(now.getMinutes()).padStart(2, '0');
            const nSec = String(now.getSeconds()).padStart(2, '0');
            
            return {
                start: `${wYear}-${wMonth}-${wDay} ${wHour}:${wMin}:${wSec}`,
                end: `${year}-${month}-${day} ${nHour}:${nMin}:${nSec}`
            };
        } else if (type === 'month') {
            // 本月：30天前到现在
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const mYear = monthAgo.getFullYear();
            const mMonth = String(monthAgo.getMonth() + 1).padStart(2, '0');
            const mDay = String(monthAgo.getDate()).padStart(2, '0');
            const mHour = String(monthAgo.getHours()).padStart(2, '0');
            const mMin = String(monthAgo.getMinutes()).padStart(2, '0');
            const mSec = String(monthAgo.getSeconds()).padStart(2, '0');
            
            const nHour = String(now.getHours()).padStart(2, '0');
            const nMin = String(now.getMinutes()).padStart(2, '0');
            const nSec = String(now.getSeconds()).padStart(2, '0');
            
            return {
                start: `${mYear}-${mMonth}-${mDay} ${mHour}:${mMin}:${mSec}`,
                end: `${year}-${month}-${day} ${nHour}:${nMin}:${nSec}`
            };
        }

        return { start: '', end: '' };
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

    private _getLoadingHtml(): string {
        return `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>额度变化记录</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                }
                .loading {
                    text-align: center;
                }
                .spinner {
                    border: 4px solid rgba(255,255,255,0.1);
                    border-radius: 50%;
                    border-top: 4px solid var(--vscode-button-background);
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin: 20px auto;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="loading">
                <div class="spinner"></div>
                <p>加载额度变化记录中...</p>
            </div>
        </body>
        </html>`;
    }

    private _getHistoryHtml(data: any): string {
        const { list, pageNum, pageSize, total, pages } = data;

        return `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>额度变化记录</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
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
                    padding: 20px;
                    line-height: 1.5;
                }

                .container {
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 16px;
                    border-bottom: 2px solid var(--vscode-panel-border);
                }

                .header-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .header-info {
                    font-size: 13px;
                    color: var(--vscode-descriptionForeground);
                }

                .refresh-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .refresh-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }

                .docs-btn {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .docs-btn:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                .filters-container {
                    background-color: var(--vscode-input-background);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                    display: flex;
                    gap: 20px;
                    align-items: center;
                    flex-wrap: wrap;
                }

                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .filter-label {
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--vscode-foreground);
                }

                .filter-select {
                    background-color: var(--vscode-dropdown-background);
                    color: var(--vscode-dropdown-foreground);
                    border: 1px solid var(--vscode-dropdown-border);
                    border-radius: 4px;
                    padding: 6px 12px;
                    font-size: 13px;
                    cursor: pointer;
                    outline: none;
                    min-width: 120px;
                }

                .filter-select:focus {
                    border-color: var(--vscode-focusBorder);
                }

                .table-container {
                    background-color: var(--vscode-input-background);
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                }

                thead {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }

                th {
                    padding: 12px 8px;
                    text-align: left;
                    font-weight: 600;
                    font-size: 13px;
                    white-space: nowrap;
                }

                td {
                    padding: 12px 8px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    font-size: 12px;
                }

                tbody tr:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }

                tbody tr:last-child td {
                    border-bottom: none;
                }

                .operation-type {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                }

                .operation-type.api-call {
                    background-color: rgba(33, 150, 243, 0.2);
                    color: #2196F3;
                }

                .operation-type.reset {
                    background-color: rgba(76, 175, 80, 0.2);
                    color: #4CAF50;
                }

                .time-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .time-relative {
                    font-size: 12px;
                    color: var(--vscode-foreground);
                }

                .time-absolute {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                }

                .token-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .token-item {
                    font-size: 11px;
                }

                .credit-change {
                    font-weight: 600;
                    font-size: 13px;
                }

                .credit-change.positive {
                    color: #4CAF50;
                }

                .credit-change.negative {
                    color: #FF9800;
                }

                .credit-remaining {
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                }

                .pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 12px;
                    margin-top: 20px;
                    padding: 16px;
                }

                .page-btn {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: 4px;
                    padding: 6px 12px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .page-btn:hover:not(:disabled) {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                .page-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .page-info {
                    font-size: 13px;
                    color: var(--vscode-descriptionForeground);
                }

                .model-name {
                    font-family: monospace;
                    font-size: 11px;
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 2px 6px;
                    border-radius: 3px;
                }

                .key-name {
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                }

                .cost-value {
                    font-weight: 600;
                    color: #E74C3C;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div>
                        <div class="header-title">
                            <i class="fas fa-history"></i>
                            额度变化记录
                        </div>
                        <div class="header-info">
                            共 ${total} 条记录
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button class="docs-btn" onclick="openDocs()">
                            <i class="fas fa-book"></i>
                            查看文档
                        </button>
                        <button class="refresh-btn" onclick="refreshData()">
                            <i class="fas fa-sync"></i>
                            刷新
                        </button>
                    </div>
                </div>

                <div class="filters-container">
                    <div class="filter-group">
                        <span class="filter-label">时间范围：</span>
                        <select class="filter-select" id="timeRangeFilter" onchange="onFilterChange()">
                            <option value="all" ${this._currentFilters.timeRange === 'all' ? 'selected' : ''}>全部时间</option>
                            <option value="today" ${this._currentFilters.timeRange === 'today' ? 'selected' : ''}>今天</option>
                            <option value="week" ${this._currentFilters.timeRange === 'week' ? 'selected' : ''}>本周</option>
                            <option value="month" ${this._currentFilters.timeRange === 'month' ? 'selected' : ''}>本月</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <span class="filter-label">操作类型：</span>
                        <select class="filter-select" id="operationTypeFilter" onchange="onFilterChange()">
                            <option value="all" ${this._currentFilters.operationType === 'all' ? 'selected' : ''}>全部</option>
                            <option value="API_CALL" ${this._currentFilters.operationType === 'API_CALL' ? 'selected' : ''}>API调用</option>
                            <option value="MANUAL_RESET" ${this._currentFilters.operationType === 'MANUAL_RESET' ? 'selected' : ''}>手动重置</option>
                        </select>
                    </div>
                </div>

                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>操作类型</th>
                                <th>API密钥</th>
                                <th>时间</th>
                                <th>模型</th>
                                <th>输入/输出 Tokens</th>
                                <th>缓存创建/读取</th>
                                <th>成本</th>
                                <th>变化额度</th>
                                <th>剩余额度</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this._renderHistoryRows(list)}
                        </tbody>
                    </table>
                </div>

                <div class="pagination">
                    <button class="page-btn" onclick="loadPage(1)" ${pageNum === 1 ? 'disabled' : ''}>
                        <i class="fas fa-angle-double-left"></i> 首页
                    </button>
                    <button class="page-btn" onclick="loadPage(${pageNum - 1})" ${pageNum === 1 ? 'disabled' : ''}>
                        <i class="fas fa-angle-left"></i> 上一页
                    </button>
                    <span class="page-info">第 ${pageNum} / ${pages} 页</span>
                    <button class="page-btn" onclick="loadPage(${pageNum + 1})" ${pageNum === pages ? 'disabled' : ''}>
                        下一页 <i class="fas fa-angle-right"></i>
                    </button>
                    <button class="page-btn" onclick="loadPage(${pages})" ${pageNum === pages ? 'disabled' : ''}>
                        末页 <i class="fas fa-angle-double-right"></i>
                    </button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function loadPage(pageNum) {
                    vscode.postMessage({
                        type: 'loadPage',
                        pageNum: pageNum
                    });
                }

                function refreshData() {
                    vscode.postMessage({
                        type: 'refresh'
                    });
                }

                function openDocs() {
                    vscode.postMessage({
                        type: 'openDocs'
                    });
                }

                function onFilterChange() {
                    const timeRange = document.getElementById('timeRangeFilter').value;
                    const operationType = document.getElementById('operationTypeFilter').value;
                    
                    vscode.postMessage({
                        type: 'filterChange',
                        filters: {
                            timeRange: timeRange,
                            operationType: operationType
                        }
                    });
                }

                // 格式化相对时间
                function formatRelativeTime(dateStr) {
                    const date = new Date(dateStr);
                    const now = new Date();
                    const diffMs = now.getTime() - date.getTime();
                    const diffMins = Math.floor(diffMs / (1000 * 60));
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                    if (diffMins < 1) {
                        return '刚刚';
                    } else if (diffMins < 60) {
                        return diffMins + '分钟前';
                    } else if (diffHours < 24) {
                        return diffHours + '小时前';
                    } else if (diffDays < 7) {
                        return diffDays + '天前';
                    } else {
                        return date.toLocaleDateString();
                    }
                }

                // 监听来自扩展的消息
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'scrollToTop':
                            // 平滑滚动到页面顶部
                            window.scrollTo({
                                top: 0,
                                behavior: 'smooth'
                            });
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }

    private _renderHistoryRows(list: any[]): string {
        if (!list || list.length === 0) {
            return `<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--vscode-descriptionForeground);">暂无记录</td></tr>`;
        }

        return list.map(item => {
            const isPositive = item.creditChange > 0;
            const changeClass = isPositive ? 'positive' : 'negative';
            const changeSymbol = isPositive ? '+' : '';
            
            const operationType = item.operationType === 'API_CALL' ? 'api-call' : 'reset';

            // 格式化时间
            const date = new Date(item.createdAt);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            let relativeTime = '';
            if (diffMins < 1) {
                relativeTime = '刚刚';
            } else if (diffMins < 60) {
                relativeTime = diffMins + '分钟前';
            } else if (diffHours < 24) {
                relativeTime = diffHours + '小时前';
            } else if (diffDays < 7) {
                relativeTime = diffDays + '天前';
            } else {
                relativeTime = diffDays + '天前';
            }

            const absoluteTime = item.createdAt.substring(5).replace(' ', ' '); // MM-DD HH:MM:SS

            return `
            <tr>
                <td>
                    <span class="operation-type ${operationType}">
                        ${item.operationTypeDesc || item.operationType}
                    </span>
                </td>
                <td>
                    <span class="key-name">${item.keyName || '-'}</span>
                </td>
                <td>
                    <div class="time-info">
                        <span class="time-relative">${relativeTime}</span>
                        <span class="time-absolute">${absoluteTime}</span>
                    </div>
                </td>
                <td>
                    <span class="model-name">${item.requestModel || '-'}</span>
                </td>
                <td>
                    <div class="token-info">
                        <div class="token-item">输入: ${(item.inputTokens || 0).toLocaleString()}</div>
                        <div class="token-item">输出: ${(item.outputTokens || 0).toLocaleString()}</div>
                    </div>
                </td>
                <td>
                    <div class="token-info">
                        <div class="token-item">创建: ${(item.cacheCreateTokens || 0).toLocaleString()}</div>
                        <div class="token-item">读取: ${(item.cacheReadTokens || 0).toLocaleString()}</div>
                    </div>
                </td>
                <td>
                    <span class="cost-value">$${(item.totalCost || 0).toFixed(6)}</span>
                </td>
                <td>
                    <span class="credit-change ${changeClass}">
                        ${changeSymbol}$${Math.abs(item.creditChange).toFixed(4)}
                    </span>
                </td>
                <td>
                    <span class="credit-remaining">$${(item.remainingCredits || 0).toFixed(4)}</span>
                </td>
            </tr>`;
        }).join('');
    }

    public dispose() {
        if (this._panel) {
            this._panel.dispose();
            this._panel = undefined;
        }
    }
}
