"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnouncementViewProvider = void 0;
const https = require("https");
const url_1 = require("url");
class AnnouncementViewProvider {
    constructor(context) {
        this.context = context;
        this._announcements = [];
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
                case 'loadAnnouncements':
                    await this.loadAnnouncements();
                    break;
                case 'refresh':
                    await this.loadAnnouncements();
                    break;
            }
        });
        // 自动加载公告数据
        this.loadAnnouncements();
        // 启动定时刷新（每半小时）
        this.startPeriodicRefresh();
    }
    async refresh() {
        await this.loadAnnouncements();
    }
    async loadAnnouncements() {
        try {
            const token = this._context.globalState.get('88code_token');
            if (!token) {
                throw new Error('未找到登录令牌');
            }
            const response = await this.httpRequestWithAuth('GET', 'https://88code.org/admin-api/announcement/queryEnabledList', token);
            if (response.ok && response.data) {
                this._announcements = response.data;
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'announcementsData',
                        data: this._announcements
                    });
                }
            }
            else {
                console.error('加载公告失败:', response.msg);
            }
        }
        catch (error) {
            console.error('加载公告失败:', error);
        }
    }
    httpRequestWithAuth(method, url, token, data) {
        return new Promise((resolve, reject) => {
            const urlObj = new url_1.URL(url);
            const postData = data ? JSON.stringify(data) : undefined;
            const headers = {
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
                    }
                    catch (error) {
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
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>88CODE 公告</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
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
                    padding: 16px;
                    line-height: 1.5;
                }

                .announcement-container {
                    max-width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .header-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }

                .refresh-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 16px;
                    padding: 6px 16px;
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

                .announcement-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .announcement-card {
                    background-color: var(--vscode-input-background);
                    border-radius: 12px;
                    padding: 16px;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.2s ease;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
                    cursor: pointer;
                }

                .announcement-card:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }

                .announcement-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 12px;
                }

                .announcement-title {
                    font-size: 15px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    flex: 1;
                    line-height: 1.4;
                }

                .announcement-icon {
                    color: var(--vscode-textLink-foreground);
                    font-size: 12px;
                    transition: transform 0.3s ease;
                    margin-left: 8px;
                    flex-shrink: 0;
                }

                .announcement-card.expanded .announcement-icon {
                    transform: rotate(180deg);
                }

                .announcement-meta {
                    display: flex;
                    gap: 16px;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 12px;
                }

                .announcement-date {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .announcement-content {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                    font-size: 14px;
                    line-height: 1.6;
                    color: var(--vscode-foreground);
                }

                .announcement-card.expanded .announcement-content {
                    max-height: 2000px;
                    padding-top: 8px;
                    border-top: 1px solid var(--vscode-panel-border);
                }

                .announcement-content h1,
                .announcement-content h2,
                .announcement-content h3 {
                    margin-top: 16px;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }

                .announcement-content h1 {
                    font-size: 20px;
                }

                .announcement-content h2 {
                    font-size: 18px;
                }

                .announcement-content h3 {
                    font-size: 16px;
                }

                .announcement-content p {
                    margin-bottom: 8px;
                }

                .announcement-content ul,
                .announcement-content ol {
                    margin-left: 20px;
                    margin-bottom: 8px;
                }

                .announcement-content li {
                    margin-bottom: 4px;
                }

                .announcement-content code {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-family: var(--vscode-editor-font-family);
                    font-size: 13px;
                }

                .announcement-content pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 12px;
                    border-radius: 6px;
                    overflow-x: auto;
                    margin: 8px 0;
                }

                .announcement-content pre code {
                    background-color: transparent;
                    padding: 0;
                }

                .announcement-content a {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                }

                .announcement-content a:hover {
                    text-decoration: underline;
                }

                .announcement-content blockquote {
                    border-left: 3px solid var(--vscode-textLink-foreground);
                    padding-left: 12px;
                    margin: 8px 0;
                    color: var(--vscode-descriptionForeground);
                }

                .empty-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--vscode-descriptionForeground);
                }

                .empty-state-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                    opacity: 0.5;
                }

                .empty-state-text {
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="announcement-container">
                <div class="header">
                    <div class="header-title">
                        <i class="fas fa-bullhorn"></i> 公告
                    </div>
                    <button id="refreshBtn" class="refresh-btn">
                        <i class="fas fa-sync"></i>
                        刷新
                    </button>
                </div>
                
                <div id="loading" class="loading">
                    <i class="fas fa-spinner loading-spinner"></i>
                    加载公告中...
                </div>
                
                <div id="announcementList" class="announcement-list" style="display: none;"></div>
                
                <div id="emptyState" class="empty-state" style="display: none;">
                    <div class="empty-state-icon">
                        <i class="fas fa-inbox"></i>
                    </div>
                    <div class="empty-state-text">暂无公告</div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                // 刷新按钮
                document.getElementById('refreshBtn').addEventListener('click', () => {
                    document.getElementById('loading').style.display = 'block';
                    document.getElementById('announcementList').style.display = 'none';
                    document.getElementById('emptyState').style.display = 'none';
                    vscode.postMessage({
                        type: 'refresh'
                    });
                });

                // 格式化日期
                function formatDate(dateStr) {
                    if (!dateStr) return '-';
                    const date = new Date(dateStr);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return \`\${year}-\${month}-\${day}\`;
                }

                // 渲染公告列表
                function renderAnnouncements(announcements) {
                    document.getElementById('loading').style.display = 'none';
                    
                    if (!announcements || announcements.length === 0) {
                        document.getElementById('emptyState').style.display = 'block';
                        document.getElementById('announcementList').style.display = 'none';
                        return;
                    }

                    document.getElementById('emptyState').style.display = 'none';
                    document.getElementById('announcementList').style.display = 'flex';

                    const listContainer = document.getElementById('announcementList');
                    listContainer.innerHTML = '';

                    announcements.forEach((announcement, index) => {
                        const card = document.createElement('div');
                        card.className = 'announcement-card';
                        card.dataset.id = announcement.announcementId;

                        const header = document.createElement('div');
                        header.className = 'announcement-header';

                        const title = document.createElement('div');
                        title.className = 'announcement-title';
                        title.textContent = announcement.title;

                        const icon = document.createElement('i');
                        icon.className = 'fas fa-chevron-down announcement-icon';

                        header.appendChild(title);
                        header.appendChild(icon);

                        const meta = document.createElement('div');
                        meta.className = 'announcement-meta';

                        const date = document.createElement('div');
                        date.className = 'announcement-date';
                        date.innerHTML = \`<i class="fas fa-calendar-alt"></i> \${formatDate(announcement.updateTime || announcement.createTime)}\`;

                        meta.appendChild(date);

                        const content = document.createElement('div');
                        content.className = 'announcement-content';
                        
                        // 使用 marked 渲染 markdown
                        if (announcement.content) {
                            content.innerHTML = marked.parse(announcement.content);
                        }

                        card.appendChild(header);
                        card.appendChild(meta);
                        card.appendChild(content);

                        // 点击展开/收起
                        card.addEventListener('click', () => {
                            card.classList.toggle('expanded');
                        });

                        listContainer.appendChild(card);
                    });
                }

                // 监听来自扩展的消息
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'announcementsData':
                            renderAnnouncements(message.data);
                            break;
                    }
                });

                // 页面加载完成后自动加载数据
                window.addEventListener('load', () => {
                    vscode.postMessage({
                        type: 'loadAnnouncements'
                    });
                });
            </script>
        </body>
        </html>`;
    }
    startPeriodicRefresh() {
        // 每半小时自动刷新公告数据
        const THIRTY_MINUTES = 30 * 60 * 1000;
        this._refreshTimer = setInterval(async () => {
            try {
                await this.loadAnnouncements();
            }
            catch (error) {
                console.log('定时刷新公告失败:', error);
            }
        }, THIRTY_MINUTES);
    }
    stopPeriodicRefresh() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = undefined;
        }
    }
    dispose() {
        this.stopPeriodicRefresh();
    }
}
exports.AnnouncementViewProvider = AnnouncementViewProvider;
AnnouncementViewProvider.viewType = 'announcementView';
//# sourceMappingURL=AnnouncementViewProvider.js.map