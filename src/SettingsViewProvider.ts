import * as vscode from 'vscode';

export class SettingsViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'settingsView';
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
                case 'saveSettings':
                    await this.saveSettings(data.settings);
                    break;
                case 'requestSettings':
                    await this.sendSettings();
                    break;
            }
        });
    }

    private async saveSettings(settings: any) {
        try {
            await this._context.globalState.update('88code_statusbar_settings', settings);

            // 通知 CreditService 更新设置
            await vscode.commands.executeCommand('88code.updateSettings', settings);

            vscode.window.showInformationMessage('设置已保存！');
        } catch (error) {
            vscode.window.showErrorMessage(`保存设置失败: ${error}`);
        }
    }

    private async sendSettings() {
        try {
            const settings = this._context.globalState.get('88code_statusbar_settings');
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'loadSettings',
                    settings: settings
                });
            }
        } catch (error) {
            console.error('发送设置失败:', error);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>88CODE 设置</title>
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

                .settings-container {
                    max-width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .settings-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin-bottom: 8px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--vscode-panel-border);
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

                .setting-description {
                    display: block;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 8px;
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
                    padding: 8px 0;
                }

                .setting-checkbox input[type="checkbox"] {
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                }

                .save-button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    padding: 10px 24px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    width: 100%;
                    margin-top: 8px;
                }

                .save-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }

                .save-button:active {
                    transform: translateY(1px);
                }

                .example-box {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 3px solid var(--vscode-textLink-foreground);
                    padding: 12px;
                    margin-top: 12px;
                    border-radius: 4px;
                }

                .example-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                    margin-bottom: 8px;
                }

                .example-text {
                    font-size: 12px;
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-editor-font-family);
                }
            </style>
        </head>
        <body>
            <div class="settings-container">
                <div class="settings-title"><i class="fas fa-cog icon"></i>状态栏设置</div>

                <div class="setting-group">
                    <label class="setting-label">前缀文字</label>
                    <span class="setting-description">显示在余额金额前面的文字</span>
                    <input type="text" id="prefixText" class="setting-input" placeholder="剩余余额: " />
                </div>

                <div class="setting-group">
                    <label class="setting-label">后缀文字</label>
                    <span class="setting-description">显示在余额金额后面的文字</span>
                    <input type="text" id="suffixText" class="setting-input" placeholder=" 哦~" />
                </div>

                <div class="example-box">
                    <div class="example-title">📝 预览效果</div>
                    <div class="example-text" id="previewText">剩余余额: $114.514</div>
                </div>

                <div class="setting-group">
                    <label class="setting-checkbox">
                        <input type="checkbox" id="showDecrease" checked />
                        <span>显示余额减少提示</span>
                    </label>
                    <span class="setting-description">余额减少时显示变化金额（橙色）</span>
                </div>

                <div class="setting-group">
                    <label class="setting-checkbox">
                        <input type="checkbox" id="showIncrease" checked />
                        <span>显示余额增加提示</span>
                    </label>
                    <span class="setting-description">余额增加时显示变化金额（绿色）</span>
                </div>

                <div class="setting-group">
                    <label class="setting-checkbox">
                        <input type="checkbox" id="showStatusBarTotal" />
                        <span>状态栏显示总金额</span>
                    </label>
                    <span class="setting-description">在状态栏显示所有套餐的总余额（勾选后显示总和，不勾选则显示当前套餐余额）</span>
                </div>

                <button id="saveBtn" class="save-button">
                    <i class="fas fa-save icon"></i>保存设置
                </button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                const prefixInput = document.getElementById('prefixText');
                const suffixInput = document.getElementById('suffixText');
                const showDecreaseCheckbox = document.getElementById('showDecrease');
                const showIncreaseCheckbox = document.getElementById('showIncrease');
                const showStatusBarTotalCheckbox = document.getElementById('showStatusBarTotal');
                const previewText = document.getElementById('previewText');
                const saveBtn = document.getElementById('saveBtn');

                // 更新预览
                function updatePreview() {
                    const prefix = prefixInput.value || '剩余余额: ';
                    const suffix = suffixInput.value || '';
                    previewText.textContent = prefix + '$114.514' + suffix;
                }

                // 监听输入变化
                prefixInput.addEventListener('input', updatePreview);
                suffixInput.addEventListener('input', updatePreview);

                // 保存设置
                saveBtn.addEventListener('click', function() {
                    const settings = {
                        prefixText: prefixInput.value,
                        suffixText: suffixInput.value,
                        showDecrease: showDecreaseCheckbox.checked,
                        showIncrease: showIncreaseCheckbox.checked,
                        showStatusBarTotal: showStatusBarTotalCheckbox.checked
                    };

                    vscode.postMessage({
                        type: 'saveSettings',
                        settings: settings
                    });
                });

                // 加载已保存的设置
                window.addEventListener('message', function(event) {
                    const message = event.data;
                    if (message.type === 'loadSettings') {
                        const settings = message.settings;
                        if (settings) {
                            prefixInput.value = settings.prefixText || '';
                            suffixInput.value = settings.suffixText || '';
                            showDecreaseCheckbox.checked = settings.showDecrease !== false;
                            showIncreaseCheckbox.checked = settings.showIncrease !== false;
                            showStatusBarTotalCheckbox.checked = settings.showStatusBarTotal === true;
                            updatePreview();
                        }
                    }
                });

                // 页面加载时请求设置
                window.addEventListener('load', () => {
                    vscode.postMessage({
                        type: 'requestSettings'
                    });
                });
            </script>
        </body>
        </html>`;
    }

    public dispose() {
        // 清理资源
    }
}
