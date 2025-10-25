"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnouncementNotificationService = void 0;
const vscode = require("vscode");
const https = require("https");
const url_1 = require("url");
class AnnouncementNotificationService {
    constructor(context) {
        this._context = context;
    }
    /**
     * 启动服务，检查是否有新公告需要显示
     */
    async start() {
        try {
            const token = this._context.globalState.get('88code_token');
            if (!token) {
                console.log('未登录，跳过公告弹窗');
                return;
            }
            // 获取最新公告
            const latestAnnouncement = await this.fetchLatestAnnouncement(token);
            if (!latestAnnouncement) {
                console.log('没有公告可显示');
                return;
            }
            // 检查是否已经显示过这个公告
            const lastShownAnnouncementId = this._context.globalState.get('88code_last_shown_announcement_id');
            if (lastShownAnnouncementId === latestAnnouncement.announcementId) {
                console.log('最新公告已经显示过，跳过');
                return;
            }
            // 显示公告弹窗
            this.showAnnouncementPanel(latestAnnouncement);
            // 记录已显示的公告ID
            await this._context.globalState.update('88code_last_shown_announcement_id', latestAnnouncement.announcementId);
        }
        catch (error) {
            console.error('启动公告通知服务失败:', error);
        }
    }
    /**
     * 获取最新公告
     */
    async fetchLatestAnnouncement(token) {
        try {
            const response = await this.httpRequestWithAuth('GET', 'https://88code.org/admin-api/announcement/queryEnabledList', token);
            if (response.ok && response.data && response.data.length > 0) {
                // 返回第一条公告（最新的）
                return response.data[0];
            }
            return null;
        }
        catch (error) {
            console.error('获取最新公告失败:', error);
            return null;
        }
    }
    /**
     * 显示公告面板
     */
    showAnnouncementPanel(announcement) {
        // 如果已经有面板打开，先关闭
        if (this._panel) {
            this._panel.dispose();
        }
        // 创建新的 WebviewPanel
        this._panel = vscode.window.createWebviewPanel('announcementNotification', '📢 88Code 最新公告', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        // 设置 HTML 内容
        this._panel.webview.html = this.getWebviewContent(announcement);
        // 监听面板关闭事件
        this._panel.onDidDispose(() => {
            this._panel = undefined;
        });
        // 监听来自 webview 的消息
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'close':
                    this._panel?.dispose();
                    break;
                case 'dontShowAgain':
                    // 标记不再显示
                    await this._context.globalState.update('88code_disable_announcement_notification', true);
                    this._panel?.dispose();
                    vscode.window.showInformationMessage('已关闭公告弹窗，可在设置中重新启用');
                    break;
            }
        });
    }
    /**
     * 生成 Webview 内容
     */
    getWebviewContent(announcement) {
        return `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>88Code 公告</title>
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
                    padding: 24px;
                    line-height: 1.6;
                }

                .announcement-container {
                    max-width: 800px;
                    margin: 0 auto;
                }

                .announcement-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                    padding-bottom: 16px;
                    border-bottom: 2px solid var(--vscode-panel-border);
                }

                .announcement-icon {
                    font-size: 32px;
                }

                .announcement-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    flex: 1;
                }

                .announcement-meta {
                    display: flex;
                    gap: 16px;
                    font-size: 13px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 20px;
                }

                .announcement-content {
                    background-color: var(--vscode-input-background);
                    border-radius: 8px;
                    padding: 24px;
                    margin-bottom: 24px;
                    font-size: 14px;
                    line-height: 1.8;
                    max-height: 60vh;
                    overflow-y: auto;
                }

                .announcement-content h1,
                .announcement-content h2,
                .announcement-content h3 {
                    margin-top: 20px;
                    margin-bottom: 12px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }

                .announcement-content h1 {
                    font-size: 22px;
                }

                .announcement-content h2 {
                    font-size: 20px;
                }

                .announcement-content h3 {
                    font-size: 18px;
                }

                .announcement-content h1:first-child,
                .announcement-content h2:first-child,
                .announcement-content h3:first-child {
                    margin-top: 0;
                }

                .announcement-content p {
                    margin-bottom: 12px;
                }

                .announcement-content ul,
                .announcement-content ol {
                    margin-left: 24px;
                    margin-bottom: 12px;
                }

                .announcement-content li {
                    margin-bottom: 6px;
                }

                .announcement-content code {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-family: var(--vscode-editor-font-family);
                    font-size: 13px;
                }

                .announcement-content pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 16px;
                    border-radius: 6px;
                    overflow-x: auto;
                    margin: 12px 0;
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
                    border-left: 4px solid var(--vscode-textLink-foreground);
                    padding-left: 16px;
                    margin: 12px 0;
                    color: var(--vscode-descriptionForeground);
                }

                .announcement-content strong {
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }

                .button-group {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }

                .button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }

                .button.secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }

                .button.secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                .tip {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    text-align: center;
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid var(--vscode-panel-border);
                }
            </style>
        </head>
        <body>
            <div class="announcement-container">
                <div class="announcement-header">
                    <span class="announcement-icon">📢</span>
                    <h1 class="announcement-title">${this.escapeHtml(announcement.title)}</h1>
                </div>

                <div class="announcement-meta">
                    <span>📅 ${this.formatDate(announcement.updateTime || announcement.createTime)}</span>
                </div>

                <div class="announcement-content" id="announcementContent">
                    ${this.renderMarkdown(announcement.content || '')}
                </div>

                <div class="button-group">
                    <button class="button secondary" id="dontShowBtn">不再显示启动公告</button>
                    <button class="button" id="closeBtn">我知道了</button>
                </div>

                <div class="tip">
                    💡 提示：您可以随时在侧边栏的"公告"菜单中查看所有公告
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('closeBtn').addEventListener('click', () => {
                    vscode.postMessage({ type: 'close' });
                });

                document.getElementById('dontShowBtn').addEventListener('click', () => {
                    vscode.postMessage({ type: 'dontShowAgain' });
                });
            </script>
        </body>
        </html>`;
    }
    /**
     * 渲染 Markdown 内容
     */
    renderMarkdown(content) {
        // 使用简单的 HTML 实体转义来处理，实际渲染在前端进行
        return `<div id="markdown-content"></div>
        <script>
            // 等待 marked.js 加载完成
            if (typeof marked !== 'undefined') {
                document.getElementById('markdown-content').innerHTML = marked.parse(\`${content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`);
            } else {
                // 如果 marked.js 未加载，显示原始文本
                document.getElementById('markdown-content').textContent = \`${content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
            }
        </script>`;
    }
    /**
     * 转义 HTML 特殊字符
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }
    /**
     * 格式化日期
     */
    formatDate(dateStr) {
        if (!dateStr)
            return '-';
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    /**
     * HTTP 请求（带认证）
     */
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
    /**
     * 停止服务
     */
    dispose() {
        if (this._panel) {
            this._panel.dispose();
            this._panel = undefined;
        }
    }
}
exports.AnnouncementNotificationService = AnnouncementNotificationService;
//# sourceMappingURL=AnnouncementNotificationService.js.map