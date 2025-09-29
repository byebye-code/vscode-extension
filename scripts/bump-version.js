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
    
    // 递增最后一位数字，不允许进位
    let lastPart = parseInt(versionParts[2]);
    
    // 如果最后一位已经是9，则设置为0（不进位）
    if (lastPart >= 9) {
        lastPart = 0;
        console.log('⚠️  最后一位已达到9，重置为0（不进位）');
    } else {
        lastPart += 1;
    }
    
    // 构造新版本号
    const newVersion = `${versionParts[0]}.${versionParts[1]}.${lastPart}`;
    
    // 更新 package.json
    packageJson.version = newVersion;
    
    // 写回文件，保持格式化
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log(`✅ 版本号已更新: ${currentVersion} → ${newVersion}`);
    
} catch (error) {
    console.error('❌ 版本号递增失败:', error.message);
    process.exit(1);
}