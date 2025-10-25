import * as vscode from 'vscode';

export class FriendLinksViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'friendLinksView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // 监听来自 webview 的消息
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'openLink':
                    vscode.env.openExternal(vscode.Uri.parse(data.url));
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // 友链数据
        const friendLinks = [
            {
                title: '88code Desktop',
                description: '88code Claude Code 和 Codex 配置工具',
                url: 'https://github.com/byebye-code/88code-desktop',
                icon: 'fa-desktop'
            },
            {
                title: '88code Status（VS Code 扩展）',
                description: '一个轻量的插件，在 VS Code 右下角状态栏展示 88code 订阅余额，支持手动刷新与定时自动刷新。',
                url: 'https://github.com/byebye-code/88code-status-vscode-extension',
                icon: 'fa-plug'
            },
            {
                title: 'byebyecode',
                description: '88code定制Claude Code 状态栏工具，基于CCometixLine实现',
                url: 'https://github.com/byebye-code/byebyecode',
                icon: 'fa-code'
            },
            {
                title: '88code文档站',
                description: '稳定、优惠的企业级Claude Code/Codex 官方中转站',
                url: 'https://docs.88code.org/',
                icon: 'fa-book'
            }
        ];

        // 将友链数据序列化为 JSON 字符串，传递给前端
        const friendLinksJson = JSON.stringify(friendLinks);

        return `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>友链</title>
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
                    padding: 16px;
                    line-height: 1.5;
                }

                .header {
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }

                .header-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .links-container {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .link-card {
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                    overflow: hidden;
                }

                .link-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 4px;
                    height: 100%;
                    background: var(--vscode-textLink-foreground);
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }

                .link-card:hover {
                    border-color: var(--vscode-textLink-foreground);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                }

                .link-card:hover::before {
                    opacity: 1;
                }

                .link-card:active {
                    transform: translateY(0);
                }

                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 8px;
                }

                .card-icon {
                    font-size: 20px;
                    color: var(--vscode-textLink-foreground);
                    width: 24px;
                    text-align: center;
                }

                .card-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    flex: 1;
                }

                .card-arrow {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    transition: transform 0.2s ease;
                }

                .link-card:hover .card-arrow {
                    transform: translateX(4px);
                }

                .card-description {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    line-height: 1.6;
                    padding-left: 34px;
                }

                .empty-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--vscode-descriptionForeground);
                }

                .empty-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                    opacity: 0.5;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-title">
                    <i class="fas fa-link"></i>
                    友情链接
                </div>
            </div>

            <div class="links-container" id="linksContainer">
                <!-- 友链卡片将通过 JavaScript 动态插入 -->
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                // 友链数据（从后端传入）
                const friendLinks = ${friendLinksJson};

                // Fisher-Yates 洗牌算法 - 随机打乱数组
                function shuffleArray(array) {
                    const shuffled = [...array];
                    for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                    }
                    return shuffled;
                }

                // 渲染友链卡片
                function renderFriendLinks() {
                    const container = document.getElementById('linksContainer');
                    
                    if (!friendLinks || friendLinks.length === 0) {
                        container.innerHTML = \`
                            <div class="empty-state">
                                <div class="empty-icon"><i class="fas fa-link"></i></div>
                                <p>暂无友链</p>
                            </div>
                        \`;
                        return;
                    }

                    // 随机打乱友链顺序
                    const shuffledLinks = shuffleArray(friendLinks);

                    // 生成卡片 HTML
                    container.innerHTML = shuffledLinks.map(link => \`
                        <div class="link-card" data-url="\${link.url}">
                            <div class="card-header">
                                <i class="fas \${link.icon} card-icon"></i>
                                <div class="card-title">\${link.title}</div>
                                <i class="fas fa-arrow-right card-arrow"></i>
                            </div>
                            <div class="card-description">\${link.description}</div>
                        </div>
                    \`).join('');

                    // 绑定点击事件
                    document.querySelectorAll('.link-card').forEach(card => {
                        card.addEventListener('click', function() {
                            const url = this.getAttribute('data-url');
                            vscode.postMessage({
                                type: 'openLink',
                                url: url
                            });
                        });
                    });
                }

                // 页面加载时渲染友链
                renderFriendLinks();
            </script>
        </body>
        </html>`;
    }
}
