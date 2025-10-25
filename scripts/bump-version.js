#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 自动递增版本号脚本
 * 只递增最后一位数字，不允许进位
 * 作者: 猫娘浮浮酱 ฅ'ω'ฅ
 */

const packageJsonPath = path.join(__dirname, '../package.json');

try {
    // 读取 package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;
    
    console.log(`当前版本: ${currentVersion}`);
    
    // 解析版本号 (x.y.z)
    const versionParts = currentVersion.split('.');
    
    if (versionParts.length !== 3) {
        throw new Error('版本号格式必须是 x.y.z 格式');
    }
    
    // 递增最后一位数字，支持进位到中间位
    let major = parseInt(versionParts[0]);
    let minor = parseInt(versionParts[1]);
    let patch = parseInt(versionParts[2]);
    
    // 递增 patch 版本号
    patch += 1;
    
    // 如果 patch 达到 10，则进位到 minor
    if (patch >= 10) {
        patch = 0;
        minor += 1;
        console.log('⚠️  patch 版本已达到 9，进位到 minor 版本');
    }
    
    // 如果 minor 达到 10，则进位到 major
    if (minor >= 10) {
        minor = 0;
        major += 1;
        console.log('⚠️  minor 版本已达到 9，进位到 major 版本');
    }
    
    // 构造新版本号
    const newVersion = `${major}.${minor}.${patch}`;
    
    // 更新 package.json
    packageJson.version = newVersion;
    
    // 写回文件，保持格式化
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log(`✅ 版本号已更新: ${currentVersion} → ${newVersion}`);
    
} catch (error) {
    console.error('❌ 版本号递增失败:', error.message);
    process.exit(1);
}