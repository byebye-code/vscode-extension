import * as vscode from 'vscode';

export class LoginViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'loginView';
    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;

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
                case 'saveToken':
                    await this.saveToken(data.token);
                    break;
            }
        });
    }

    private async saveToken(token: string) {
        try {
            // 基本验证token格式
            if (!token || token.trim().length < 10) {
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'tokenSaveError',
                        message: 'Token 格式无效，请检查后重试'
                    });
                }
                return;
            }

            // 清理token（去除首尾空格）
            const cleanToken = token.trim();
            
            // 保存token到全局状态
            await this._context.globalState.update('88code_token', cleanToken);
            
            // 设置登录状态
            await vscode.commands.executeCommand('setContext', '88code:loggedIn', true);
            
            // 通知积分服务启动
            await vscode.commands.executeCommand('88code.onLoginStatusChanged', true);
            
            // 显示成功消息
            vscode.window.showInformationMessage('Token 保存成功！88Code 插件已准备就绪。');
            
            // 通知前端保存成功
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'tokenSaveSuccess'
                });
            }
            
        } catch (error) {
            console.error('保存Token失败:', error);
            vscode.window.showErrorMessage(`保存Token失败: ${error}`);
            
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'tokenSaveError',
                    message: '保存失败，请重试'
                });
            }
        }
    }


    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>88Code Token 登录</title>
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
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                }

                .login-container {
                    max-width: 420px;
                    width: 100%;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                /* MD3 主标题卡片 */
                .header-card {
                    background-color: var(--vscode-input-background);
                    border-radius: 16px;
                    padding: 32px 24px;
                    position: relative;
                    overflow: hidden;
                    text-align: center;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
                }

                .header-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, 
                        rgba(var(--vscode-textLink-foreground), 0.05) 0%, 
                        transparent 50%);
                    pointer-events: none;
                }

                .logo-container {
                    margin-bottom: 20px;
                }


                .header-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin-bottom: 8px;
                }

                .header-subtitle {
                    font-size: 14px;
                    color: var(--vscode-descriptionForeground);
                    opacity: 0.8;
                }

                /* MD3 信息提示卡片 */
                .info-card {
                    background-color: var(--vscode-input-background);
                    border-radius: 12px;
                    padding: 20px;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
                }

                .info-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, 
                        rgba(var(--vscode-notificationsInfoIcon-foreground), 0.03) 0%, 
                        transparent 50%);
                    pointer-events: none;
                }

                .info-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }


                .info-title {
                    font-size: 16px;
                    font-weight: 500;
                    color: var(--vscode-foreground);
                }

                .info-steps {
                    list-style: none;
                    padding: 0;
                }

                .info-steps li {
                    padding: 6px 0;
                    font-size: 14px;
                    color: var(--vscode-descriptionForeground);
                    position: relative;
                    padding-left: 24px;
                }

                .info-steps li::before {
                    content: counter(step-counter);
                    counter-increment: step-counter;
                    position: absolute;
                    left: 0;
                    top: 6px;
                    background-color: var(--vscode-textLink-foreground);
                    color: var(--vscode-button-foreground);
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: 600;
                }

                .info-steps {
                    counter-reset: step-counter;
                }

                /* MD3 表单卡片 */
                .form-card {
                    background-color: var(--vscode-input-background);
                    border-radius: 12px;
                    padding: 24px;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
                }

                .form-card::before {
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

                .form-group {
                    margin-bottom: 24px;
                    position: relative;
                }

                .input-label {
                    display: block;
                    margin-bottom: 12px;
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--vscode-foreground);
                }

                .input-container {
                    position: relative;
                }

                .md3-textarea {
                    width: 100%;
                    min-height: 100px;
                    padding: 16px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 8px;
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    resize: vertical;
                    transition: all 0.2s ease;
                    outline: none;
                }

                .md3-textarea:focus {
                    border-color: var(--vscode-textLink-foreground);
                    box-shadow: 0 0 0 2px rgba(var(--vscode-textLink-foreground), 0.1);
                    transform: translateY(-1px);
                }

                .md3-textarea::placeholder {
                    color: var(--vscode-input-placeholderForeground);
                    opacity: 0.7;
                }

                .help-text {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 8px;
                    line-height: 1.5;
                    opacity: 0.8;
                }

                /* MD3 按钮 */
                .md3-button {
                    width: 100%;
                    padding: 16px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 24px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 48px;
                    position: relative;
                    overflow: hidden;
                }

                .md3-button::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
                    transform: translateX(-100%);
                    transition: transform 0.3s ease;
                }

                .md3-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }

                .md3-button:hover::before {
                    transform: translateX(100%);
                }

                .md3-button:active {
                    transform: translateY(0);
                }

                .md3-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }


                /* 状态消息 */
                .message-card {
                    margin-top: 20px;
                    padding: 16px;
                    border-radius: 8px;
                    font-size: 14px;
                    display: none;
                    align-items: center;
                    gap: 12px;
                }

                .success-message {
                    background-color: rgba(var(--vscode-testing-iconPassed), 0.1);
                    color: var(--vscode-testing-iconPassed);
                    border: 1px solid rgba(var(--vscode-testing-iconPassed), 0.2);
                }

                .error-message {
                    background-color: rgba(var(--vscode-errorForeground), 0.1);
                    color: var(--vscode-errorForeground);
                    border: 1px solid rgba(var(--vscode-errorForeground), 0.2);
                }

                .loading {
                    text-align: center;
                    margin: 20px 0;
                    color: var(--vscode-descriptionForeground);
                    font-size: 14px;
                }

                .loading-spinner {
                    animation: spin 1s linear infinite;
                    margin-right: 8px;
                    font-size: 16px;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* 响应式设计 */
                @media (max-width: 480px) {
                    body {
                        padding: 16px;
                    }
                    
                    .header-card {
                        padding: 24px 20px;
                        margin-bottom: 20px;
                    }
                    
                    .header-title {
                        font-size: 22px;
                    }
                    
                    .form-card, .info-card {
                        padding: 20px;
                    }
                    
                    .md3-button {
                        padding: 14px;
                        font-size: 15px;
                    }
                }

                /* VSCode 主题适配 */
                @media (prefers-color-scheme: dark) {
                    .header-card::before,
                    .info-card::before,
                    .form-card::before {
                        background: linear-gradient(135deg, 
                            rgba(255, 255, 255, 0.02) 0%, 
                            transparent 50%);
                    }
                }

                @media (prefers-color-scheme: light) {
                    .header-card::before,
                    .info-card::before,
                    .form-card::before {
                        background: linear-gradient(135deg, 
                            rgba(0, 0, 0, 0.02) 0%, 
                            transparent 50%);
                    }
                }
            </style>
        </head>
        <body>
            <div class="login-container">
                <!-- MD3 主标题卡片 -->
                <div class="header-card">
                    <div class="logo-container">
                        <div class="header-title">88CODE 登录</div>
                        <div class="header-subtitle">连接您的创作世界</div>
                    </div>
                </div>

                <!-- MD3 信息提示卡片 -->
                <div class="info-card">
                    <div class="info-header">
                        <span class="info-title">如何获取 Token</span>
                    </div>
                    <ol class="info-steps">
                        <li>访问 88Code 官网并正常登录</li>
                        <li>在浏览器开发者工具中查看网络请求</li>
                        <li>找到登录成功后返回的 token 值</li>
                        <li>将 token 粘贴到下方输入框中</li>
                    </ol>
                </div>

                <!-- MD3 表单卡片 -->
                <div class="form-card">
                    <form id="tokenForm">
                        <div class="form-group">
                            <label for="token" class="input-label">
                                请输入您的 88Code Token
                            </label>
                            <div class="input-container">
                                <textarea 
                                    id="token" 
                                    name="token" 
                                    class="md3-textarea"
                                    placeholder="请粘贴您的 88Code token..."
                                    required
                                ></textarea>
                            </div>
                            <div class="help-text">
                                Token 通常是一个32位的长字符串，非JWT格式！
                            </div>
                        </div>
                        
                        <button type="submit" id="saveBtn" class="md3-button">
                            保存 Token 并登录
                        </button>
                    </form>
                    
                    <!-- 状态消息 -->
                    <div id="successMessage" class="message-card success-message">
                        <span></span>
                    </div>
                    <div id="errorMessage" class="message-card error-message">
                        <span></span>
                    </div>
                    <div id="loading" class="loading" style="display: none;">
                        正在验证 Token...
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                // Token 验证函数
                function validateToken(token) {
                    // 基本验证：检查token是否为空或过短
                    if (!token || token.trim().length < 10) {
                        return { valid: false, message: 'Token 不能为空且长度至少为10个字符' };
                    }
                    
                    // 去除首尾空格
                    token = token.trim();
                    
                    // 简单格式检查（可以根据实际token格式调整）
                    if (token.length < 20) {
                        return { valid: false, message: 'Token 长度过短，请检查是否完整' };
                    }
                    
                    return { valid: true, message: 'Token 格式验证通过' };
                }

                // 页面加载完成后设置事件监听
                window.addEventListener('load', () => {
                    const tokenForm = document.getElementById('tokenForm');
                    const tokenInput = document.getElementById('token');
                    
                    // 为表单添加提交事件监听
                    tokenForm.addEventListener('submit', handleTokenSubmit);
                    
                    // 为token输入框添加实时验证
                    tokenInput.addEventListener('input', () => {
                        const errorMessage = document.getElementById('errorMessage');
                        const successMessage = document.getElementById('successMessage');
                        
                        // 清除之前的消息
                        errorMessage.style.display = 'none';
                        successMessage.style.display = 'none';
                    });
                });

                // 处理Token表单提交
                function handleTokenSubmit(e) {
                    e.preventDefault();
                    
                    const saveBtn = document.getElementById('saveBtn');
                    const loading = document.getElementById('loading');
                    const errorMessage = document.getElementById('errorMessage');
                    const successMessage = document.getElementById('successMessage');
                    const tokenInput = document.getElementById('token');
                    
                    // 重置状态
                    saveBtn.disabled = true;
                    loading.style.display = 'block';
                    errorMessage.style.display = 'none';
                    successMessage.style.display = 'none';
                    
                    const token = tokenInput.value.trim();
                    
                    // 验证Token
                    const validation = validateToken(token);
                    if (!validation.valid) {
                        loading.style.display = 'none';
                        saveBtn.disabled = false;
                        const errorText = errorMessage.querySelector('span');
                        errorText.textContent = validation.message;
                        errorMessage.style.display = 'flex';
                        return;
                    }
                    
                    // 发送Token到扩展
                    vscode.postMessage({
                        type: 'saveToken',
                        token: token
                    });
                }

                // 监听来自扩展的消息
                window.addEventListener('message', event => {
                    const message = event.data;
                    const loading = document.getElementById('loading');
                    const saveBtn = document.getElementById('saveBtn');
                    const errorMessage = document.getElementById('errorMessage');
                    const successMessage = document.getElementById('successMessage');
                    
                    switch (message.type) {
                        case 'tokenSaveSuccess':
                            loading.style.display = 'none';
                            const successText = successMessage.querySelector('span');
                            successText.textContent = 'Token 保存成功！正在跳转到仪表盘...';
                            successMessage.style.display = 'flex';
                            
                            // 2秒后自动隐藏成功消息
                            setTimeout(() => {
                                successMessage.style.display = 'none';
                            }, 2000);
                            break;
                            
                        case 'tokenSaveError':
                            loading.style.display = 'none';
                            saveBtn.disabled = false;
                            const errorText = errorMessage.querySelector('span');
                            errorText.textContent = message.message || 'Token 保存失败，请重试';
                            errorMessage.style.display = 'flex';
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }
}