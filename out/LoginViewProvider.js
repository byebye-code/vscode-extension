"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginViewProvider = void 0;
const vscode = require("vscode");
const api_1 = require("./utils/api");
const encrypt_1 = require("./utils/encrypt");
class LoginViewProvider {
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
                case 'saveToken':
                    await this.saveToken(data.token);
                    break;
                case 'getCaptcha':
                    await this.handleGetCaptcha();
                    break;
                case 'accountLogin':
                    await this.handleAccountLogin(data.username, data.password, data.captchaCode, data.captchaUuid);
                    break;
            }
        });
    }
    async saveToken(token) {
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
        }
        catch (error) {
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
    /**
     * 获取验证码
     */
    async handleGetCaptcha() {
        try {
            const captchaData = await (0, api_1.getCaptcha)();
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'captchaData',
                    data: captchaData
                });
            }
        }
        catch (error) {
            console.error('获取验证码失败:', error);
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'captchaError',
                    message: error instanceof Error ? error.message : '获取验证码失败'
                });
            }
        }
    }
    /**
     * 处理账号密码登录
     */
    async handleAccountLogin(username, password, captchaCode, captchaUuid) {
        try {
            // 验证输入
            if (!username || !password || !captchaCode) {
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'loginError',
                        message: '请填写完整的登录信息'
                    });
                }
                return;
            }
            // 加密密码
            const encryptedPassword = (0, encrypt_1.encryptData)(password);
            if (!encryptedPassword) {
                throw new Error('密码加密失败');
            }
            // 调用登录接口
            const loginData = await (0, api_1.login)({
                loginName: username,
                password: encryptedPassword,
                loginDevice: 1,
                captchaCode: captchaCode,
                captchaUuid: captchaUuid
            });
            // 保存token
            await this._context.globalState.update('88code_token', loginData.token);
            // 设置登录状态
            await vscode.commands.executeCommand('setContext', '88code:loggedIn', true);
            // 通知积分服务启动
            await vscode.commands.executeCommand('88code.onLoginStatusChanged', true);
            // 显示成功消息
            vscode.window.showInformationMessage(`登录成功！欢迎 ${loginData.actualName || loginData.loginName}`);
            // 通知前端登录成功
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'loginSuccess',
                    data: loginData
                });
            }
        }
        catch (error) {
            console.error('账号密码登录失败:', error);
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'loginError',
                    message: error instanceof Error ? error.message : '登录失败，请检查用户名和密码'
                });
            }
        }
    }
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>88Code 登录</title>
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
            padding: 20px 16px;
            line-height: 1.6;
        }

        .login-container {
            max-width: 400px;
            margin: 0 auto;
        }

        /* 标题卡片 */
        .header-card {
            background-color: var(--vscode-input-background);
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .header-title {
            font-size: 22px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .header-subtitle {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }

        /* Tab 切换 */
        .tab-container {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            background-color: var(--vscode-input-background);
            padding: 4px;
            border-radius: 8px;
        }

        .tab-button {
            flex: 1;
            padding: 10px;
            background: transparent;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: var(--vscode-descriptionForeground);
            transition: all 0.2s;
        }

        .tab-button.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .tab-button:hover:not(.active) {
            background-color: var(--vscode-button-hoverBackground);
            opacity: 0.7;
        }

        /* 表单卡片 */
        .form-card {
            background-color: var(--vscode-input-background);
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .form-section {
            display: none;
        }

        .form-section.active {
            display: block;
        }

        .form-group {
            margin-bottom: 16px;
        }

        .input-label {
            display: block;
            margin-bottom: 8px;
            font-size: 13px;
            font-weight: 500;
        }

        .md3-input,
        .md3-textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 6px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            transition: all 0.2s;
            outline: none;
        }

        .md3-textarea {
            min-height: 80px;
            resize: vertical;
        }

        .md3-input:focus,
        .md3-textarea:focus {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }

        .captcha-container {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .captcha-input {
            flex: 1;
        }

        .captcha-image {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: 6px;
            border: 1px solid var(--vscode-input-border);
            object-fit: cover;
        }

        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 6px;
        }

        /* 按钮 */
        .md3-button {
            width: 100%;
            padding: 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
            margin-top: 8px;
        }

        .md3-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .md3-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* 消息提示 */
        .message-card {
            margin-top: 16px;
            padding: 12px;
            border-radius: 6px;
            font-size: 13px;
            display: none;
        }

        .message-card.show {
            display: block;
        }

        .success-message {
            background-color: rgba(0, 200, 0, 0.1);
            color: #00c800;
            border: 1px solid rgba(0, 200, 0, 0.3);
        }

        .error-message {
            background-color: rgba(255, 0, 0, 0.1);
            color: #ff6b6b;
            border: 1px solid rgba(255, 0, 0, 0.3);
        }

        .loading {
            text-align: center;
            margin: 16px 0;
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            display: none;
        }

        .loading.show {
            display: block;
        }

        /* 信息提示卡片（仅Token模式） */
        .info-card {
            background-color: var(--vscode-input-background);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .info-title {
            font-weight: 500;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .info-steps {
            list-style: decimal;
            padding-left: 20px;
        }

        .info-steps li {
            padding: 4px 0;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <!-- 标题 -->
        <div class="header-card">
            <div class="header-title">88CODE 登录</div>
            <div class="header-subtitle">连接您的创作世界</div>
        </div>

        <!-- Tab 切换 -->
        <div class="tab-container">
            <button class="tab-button active" data-tab="account">账号密码登录</button>
            <button class="tab-button" data-tab="token">Token 登录</button>
        </div>

        <!-- 账号密码登录表单 -->
        <div class="form-card">
            <div id="accountSection" class="form-section active">
                <form id="accountForm">
                    <div class="form-group">
                        <label for="username" class="input-label">用户名（邮箱）</label>
                        <input
                            type="email"
                            id="username"
                            class="md3-input"
                            placeholder="请输入邮箱地址"
                            required
                        />
                    </div>

                    <div class="form-group">
                        <label for="password" class="input-label">密码</label>
                        <input
                            type="password"
                            id="password"
                            class="md3-input"
                            placeholder="请输入密码"
                            required
                        />
                    </div>

                    <div class="form-group">
                        <label for="captchaCode" class="input-label">验证码</label>
                        <div class="captcha-container">
                            <input
                                type="text"
                                id="captchaCode"
                                class="md3-input captcha-input"
                                placeholder="请输入验证码"
                                required
                            />
                            <div id="captchaWrapper" style="position: relative; width: 100px; height: 38px;" title="点击刷新验证码">
                                <img
                                    id="captchaImage"
                                    class="captcha-image"
                                    alt="验证码"
                                    style="display: none;"
                                />
                                <div id="captchaLoading" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 6px; font-size: 11px; color: var(--vscode-descriptionForeground);">
                                    加载中...
                                </div>
                            </div>
                        </div>
                        <div class="help-text">点击验证码区域可刷新</div>
                    </div>

                    <button type="submit" id="loginBtn" class="md3-button">
                        登录
                    </button>
                </form>
            </div>

            <!-- Token 登录表单 -->
            <div id="tokenSection" class="form-section">
                <div class="info-card">
                    <div class="info-title">如何获取 Token</div>
                    <ol class="info-steps">
                        <li>访问 88Code 官网并正常登录</li>
                        <li>在浏览器开发者工具中查看网络请求</li>
                        <li>找到登录成功后返回的 token 值</li>
                        <li>将 token 粘贴到下方输入框中</li>
                    </ol>
                </div>

                <form id="tokenForm">
                    <div class="form-group">
                        <label for="token" class="input-label">请输入您的 88Code Token</label>
                        <textarea
                            id="token"
                            class="md3-textarea"
                            placeholder="请粘贴您的 88Code token..."
                            required
                        ></textarea>
                        <div class="help-text">
                            Token 通常是一个32位的长字符串，非JWT格式！
                        </div>
                    </div>

                    <button type="submit" id="saveBtn" class="md3-button">
                        保存 Token 并登录
                    </button>
                </form>
            </div>

            <!-- 状态消息 -->
            <div id="successMessage" class="message-card success-message"></div>
            <div id="errorMessage" class="message-card error-message"></div>
            <div id="loading" class="loading">正在处理...</div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let captchaUuid = '';

        // Tab 切换
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;

                // 更新 tab 按钮状态
                document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
                button.classList.add('active');

                // 切换表单显示
                document.querySelectorAll('.form-section').forEach(section => section.classList.remove('active'));
                document.getElementById(tab + 'Section').classList.add('active');

                // 清除消息
                clearMessages();

                // 如果切换到账号密码登录，获取验证码
                if (tab === 'account') {
                    getCaptcha();
                }
            });
        });

        // 页面加载时获取验证码
        window.addEventListener('load', () => {
            getCaptcha();

            // 验证码区域点击刷新（绑定到 wrapper 上）
            const captchaWrapper = document.getElementById('captchaWrapper');
            if (captchaWrapper) {
                captchaWrapper.style.cursor = 'pointer';
                captchaWrapper.addEventListener('click', getCaptcha);
            }

            // 表单提交事件
            document.getElementById('accountForm').addEventListener('submit', handleAccountLogin);
            document.getElementById('tokenForm').addEventListener('submit', handleTokenSubmit);
        });

        // 获取验证码
        function getCaptcha() {
            // 重置加载状态
            const captchaImg = document.getElementById('captchaImage');
            const captchaLoading = document.getElementById('captchaLoading');

            if (captchaImg) {
                captchaImg.style.display = 'none';
            }
            if (captchaLoading) {
                captchaLoading.style.display = 'flex';
                captchaLoading.textContent = '加载中...';
                captchaLoading.style.color = 'var(--vscode-descriptionForeground)';
                captchaLoading.style.cursor = 'default';
                captchaLoading.onclick = null;
            }

            vscode.postMessage({ type: 'getCaptcha' });
        }

        // 账号密码登录
        function handleAccountLogin(e) {
            e.preventDefault();

            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const captchaCode = document.getElementById('captchaCode').value.trim();

            if (!username || !password || !captchaCode) {
                showError('请填写完整的登录信息');
                return;
            }

            if (!captchaUuid) {
                showError('验证码未加载，请刷新后重试');
                return;
            }

            setLoading(true);
            document.getElementById('loginBtn').disabled = true;

            vscode.postMessage({
                type: 'accountLogin',
                username,
                password,
                captchaCode,
                captchaUuid
            });
        }

        // Token 登录
        function handleTokenSubmit(e) {
            e.preventDefault();

            const token = document.getElementById('token').value.trim();

            if (!token || token.length < 10) {
                showError('Token 不能为空且长度至少为10个字符');
                return;
            }

            setLoading(true);
            document.getElementById('saveBtn').disabled = true;

            vscode.postMessage({
                type: 'saveToken',
                token
            });
        }

        // 监听来自扩展的消息
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'captchaData':
                    captchaUuid = message.data.captchaUuid;
                    const captchaImg = document.getElementById('captchaImage');
                    const captchaLoading = document.getElementById('captchaLoading');

                    captchaImg.src = message.data.captchaBase64Image;
                    captchaImg.style.display = 'block';
                    if (captchaLoading) {
                        captchaLoading.style.display = 'none';
                    }
                    break;

                case 'captchaError':
                    const captchaLoadingError = document.getElementById('captchaLoading');
                    if (captchaLoadingError) {
                        captchaLoadingError.textContent = '加载失败';
                        captchaLoadingError.style.color = 'var(--vscode-errorForeground)';
                        captchaLoadingError.style.cursor = 'pointer';
                        captchaLoadingError.onclick = getCaptcha;
                    }
                    showError(message.message || '获取验证码失败，点击验证码区域重试');
                    break;

                case 'loginSuccess':
                    setLoading(false);
                    showSuccess('登录成功！欢迎使用 88Code');
                    setTimeout(() => {
                        document.getElementById('captchaCode').value = '';
                    }, 1000);
                    break;

                case 'loginError':
                    setLoading(false);
                    document.getElementById('loginBtn').disabled = false;
                    showError(message.message || '登录失败');
                    getCaptcha(); // 刷新验证码
                    break;

                case 'tokenSaveSuccess':
                    setLoading(false);
                    showSuccess('Token 保存成功！88Code 插件已准备就绪');
                    break;

                case 'tokenSaveError':
                    setLoading(false);
                    document.getElementById('saveBtn').disabled = false;
                    showError(message.message || 'Token 保存失败');
                    break;
            }
        });

        // 工具函数
        function showSuccess(msg) {
            clearMessages();
            const el = document.getElementById('successMessage');
            el.textContent = msg;
            el.classList.add('show');
        }

        function showError(msg) {
            clearMessages();
            const el = document.getElementById('errorMessage');
            el.textContent = msg;
            el.classList.add('show');
        }

        function setLoading(show) {
            const el = document.getElementById('loading');
            if (show) {
                el.classList.add('show');
            } else {
                el.classList.remove('show');
            }
        }

        function clearMessages() {
            document.getElementById('successMessage').classList.remove('show');
            document.getElementById('errorMessage').classList.remove('show');
            document.getElementById('loading').classList.remove('show');
        }
    </script>
</body>
</html>`;
    }
}
exports.LoginViewProvider = LoginViewProvider;
LoginViewProvider.viewType = 'loginView';
//# sourceMappingURL=LoginViewProvider.js.map