// netlify/functions/alipay-notify.js

const AlipaySdk = require('alipay-sdk').default;
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// ==========================================================
//  辅助函数
// ==========================================================

// 生成一个简单的随机密码
function generatePassword() {
    return Math.random().toString(36).slice(-8);
}

// ==========================================================
//  核心业务逻辑处理函数
// ==========================================================
async function processBusinessLogic(orderParams) {
    // 初始化 Supabase 和 Resend
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const resend = new Resend(process.env.RESEND_API_KEY);

    const outTradeNo = orderParams.get('out_trade_no');
    const customerEmail = Buffer.from(outTradeNo.split('-')[2], 'base64').toString('ascii');
    const productId = orderParams.get('subject');

    let emailSubject = '';
    let emailHtml = '';

    // ------------------------------------------------------
    //  业务逻辑：地图抓取器 (开通账号)
    // ------------------------------------------------------
    if (productId.includes('Google Maps Scraper')) {
        const password = generatePassword();
        const userType = productId.includes('高级版') ? 'premium' : 'standard';
        
        // 设置30天后过期
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        const { data, error } = await supabase.from('user_accounts').insert({
            account: customerEmail,
            password: password, // 注意：实际生产中应存储哈希后的密码
            user_type: userType,
            status: 'active',
            expiry_at: expiryDate.toISOString()
        }).select();

        if (error) {
            throw new Error(`Failed to create user account for ${customerEmail}: ${error.message}`);
        }

        console.log(`Successfully created account for ${customerEmail}`);
        
        emailSubject = '您的 Google Maps Scraper 账户已成功开通！';
        emailHtml = `<h1>欢迎！</h1>
                     <p>您的账户 (${customerEmail}) 已成功开通。</p>
                     <p><strong>登录密码:</strong> ${password}</p>
                     <p>请登录网站开始使用，并及时修改您的密码。</p>
                     <p>感谢您的支持！</p>`;

    // ------------------------------------------------------
    //  业务逻辑：邮箱验证器 (发放激活码)
    // ------------------------------------------------------
    } else if (productId.includes('Email Validator')) {
        // 1. 从数据库中找一个可用的激活码
        const { data: license, error: findError } = await supabase
            .from('licenses')
            .select('key')
            .eq('status', 'available') // 假设'available'是可用状态
            .limit(1)
            .single();

        if (findError || !license) {
            // 【重要】没有可用的激活码了！需要通知管理员
            console.error('CRITICAL: No available license keys in the database!');
            // 此处应添加给管理员发邮件或发通知的逻辑
            throw new Error('No available license keys.');
        }

        const activationCode = license.key;

        // 2. 将这个激活码标记为已使用
        const { error: updateError } = await supabase
            .from('licenses')
            .update({ 
                status: 'activated', 
                activation_date: new Date().toISOString(),
                customer_email: customerEmail // 记录使用者
            })
            .eq('key', activationCode);
        
        if (updateError) {
            throw new Error(`Failed to update license key status for ${activationCode}: ${updateError.message}`);
        }

        console.log(`Successfully assigned license key ${activationCode} to ${customerEmail}`);
        
        emailSubject = '您的 Email Validator 激活码';
        emailHtml = `<h1>感谢您的购买！</h1>
                     <p>您的激活码是：<strong>${activationCode}</strong></p>
                     <p>请在软件中使用此激活码激活。祝您使用愉快！</p>`;
    }

    if (!emailSubject || !customerEmail) {
        console.error('Email subject or recipient is missing.');
        return;
    }

    // 3. 发送邮件
    await resend.emails.send({
        from: 'LeadScout <your-verified-domain.com>', // 替换为您在 Resend 验证过的发件域名
        to: customerEmail,
        subject: emailSubject,
        html: emailHtml,
    });
    console.log(`Purchase notification email sent successfully to ${customerEmail}`);
}


// ==========================================================
//  Netlify Function 主处理逻辑
// ==========================================================
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    
    const alipaySdk = new AlipaySdk({
        appId: process.env.ALIPAY_APP_ID,
        privateKey: process.env.ALIPAY_PRIVATE_KEY.replace(/\\n/g, '\n'),
        alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, '\n'),
        gateway: process.env.ALIPAY_GATEWAY
    });
    
    try {
        const params = new URLSearchParams(event.body);
        const paramsJSON = Object.fromEntries(params.entries());

        const isSignVerified = alipaySdk.checkNotifySign(paramsJSON);
        if (!isSignVerified) {
            console.error('Alipay sign verification failed.');
            return { statusCode: 200, body: 'failure' };
        }

        const tradeStatus = params.get('trade_status');
        if (tradeStatus === 'TRADE_SUCCESS') {
            console.log('Payment successful. Processing business logic...');

            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
            const outTradeNo = params.get('out_trade_no');

            // 更新订单状态为 'completed'
            const { error } = await supabase
                .from('orders')
                .update({ status: 'completed' })
                .eq('out_trade_no', outTradeNo);

            if (error) {
                console.error(`Failed to update order status for ${outTradeNo}:`, error.message);
                // 即使数据库更新失败，也需要继续尝试执行业务逻辑，但要记录错误
            }

            // 执行业务逻辑：开通账号/发激活码，并发送邮件
            await processBusinessLogic(params);
        }

        return { statusCode: 200, body: 'success' };

    } catch (error) {
        console.error('Error processing Alipay notification:', error);
        return { statusCode: 200, body: 'failure' };
    }
};