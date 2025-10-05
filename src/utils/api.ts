/**
 * API 客户端工具模块
 * 处理与后端服务器的通信
 */

import * as https from 'https';
import { URL } from 'url';

// API 基础地址
const API_BASE_URL = 'https://88code.org';

/**
 * 后端标准响应格式 ResponseDTO
 */
interface ResponseDTO<T = any> {
    code: number;       // 0表示成功,非0表示失败
    ok: boolean;        // true表示成功
    msg: string;        // 消息文本
    data: T;            // 实际数据
}

/**
 * 验证码响应数据
 */
export interface CaptchaData {
    captchaBase64Image: string;  // Base64编码的验证码图片
    captchaUuid: string;          // 验证码唯一标识
    expireSeconds: number;        // 过期时间(秒)
}

/**
 * 登录请求数据
 */
export interface LoginRequest {
    loginName: string;      // 用户邮箱
    password: string;       // 加密后的密码
    loginDevice: number;    // 设备类型: 1=WEB端
    captchaCode: string;    // 验证码
    captchaUuid: string;    // 验证码UUID
}

/**
 * 登录响应数据
 */
export interface LoginData {
    token: string;                  // JWT Token
    loginName: string;              // 登录用户名
    actualName?: string;            // 真实姓名
    menuList?: any[];              // 菜单权限列表
    administratorFlag?: boolean;    // 是否管理员
}

/**
 * 执行 HTTP 请求
 * @param method HTTP 方法
 * @param path API 路径
 * @param token 可选的认证token
 * @param data 可选的请求体数据
 * @returns Promise<ResponseDTO>
 */
function httpRequest<T = any>(
    method: string,
    path: string,
    token?: string,
    data?: any
): Promise<ResponseDTO<T>> {
    return new Promise((resolve, reject) => {
        const url = `${API_BASE_URL}${path}`;
        const urlObj = new URL(url);
        const postData = data ? JSON.stringify(data) : undefined;

        const headers: any = {
            'Content-Type': 'application/json',
            'User-Agent': 'VSCode Extension'
        };

        // 如果有token,添加到请求头
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            headers['saToken'] = token;
        }

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
                    const response: ResponseDTO<T> = JSON.parse(body);

                    // 检查响应是否成功
                    if (!response.ok || response.code !== 0) {
                        reject(new Error(response.msg || `请求失败 (code: ${response.code})`));
                    } else {
                        resolve(response);
                    }
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

/**
 * 获取验证码
 * @returns Promise<CaptchaData>
 */
export async function getCaptcha(): Promise<CaptchaData> {
    const response = await httpRequest<CaptchaData>('GET', '/admin-api/login/getCaptcha');
    return response.data;
}

/**
 * 账号密码登录
 * @param loginRequest 登录请求数据
 * @returns Promise<LoginData>
 */
export async function login(loginRequest: LoginRequest): Promise<LoginData> {
    const response = await httpRequest<LoginData>('POST', '/admin-api/login', undefined, loginRequest);
    return response.data;
}
