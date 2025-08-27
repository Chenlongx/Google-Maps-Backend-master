// 文件路径: netlify/functions/alipay-notify.js

const AlipaySdk = require('alipay-sdk').default;
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// ==========================================================
//  邮件发送函数 (使用 Resend)
// ==========================================================
async function sendPurchaseEmail(orderParams) {
    // 从环境变量中读取 Resend API Key
    const resend = new Resend(process.env.RESEND_API_KEY);

    const outTradeNo = orderParams.get('out_trade_no');
    // 在创建订单时，我们把用户邮箱编码到了订单号中，现在解析出来
    const customerEmail = Buffer.from(outTradeNo.split('-')[2], 'base64').toString('ascii');
    const productId = orderParams.get('subject'); // 商品名称

    let emailSubject = '';
    let emailHtml = '';

    if (productId.includes('Google Maps Scraper')) {
        emailSubject = '您的 Google Maps Scraper 账户已成功开通！';
        emailHtml = `<h1>欢迎！</h1><p>您的账户 (${customerEmail}) 已成功开通。请登录网站开始使用。</p><p>感谢您的支持！</p>`;

    } else if (productId.includes('Email Validator')) {
        // 为邮箱验证器生成一个唯一的激活码
        const activationCode = `VALIDATOR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        emailSubject = '您的 Email Validator 激活码';
        emailHtml = `<h1>感谢您的购买！</h1><p>您的激活码是：<strong>${activationCode}</strong></p><p>请在软件中使用此激活码激活。祝您使用愉快！</p>`;

        // TODO: (可选) 将激活码和用户信息存入您的 Supabase 数据库
        // const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        // await supabase.from('licenses').insert([{ code: activationCode, email: customerEmail, product_id: productId }]);
    }

    if (!emailSubject || !customerEmail) {
        console.error('Email subject or recipient is missing.');
        return;
    }

    try {
        await resend.emails.send({
            from: 'LeadScout <mediamingle.cn>', // 请替换为您在 Resend 验证过的发件域名
            to: customerEmail,
            subject: emailSubject,
            html: emailHtml,
        });
        console.log(`Purchase notification email sent successfully to ${customerEmail}`);
    } catch (error) {
        console.error('Failed to send email via Resend:', error);
    }
}


// ==========================================================
//  Netlify Function 主处理逻辑
// ==========================================================
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 从环境变量初始化支付宝 SDK
    const alipaySdk = new AlipaySdk({
        appId: process.env.ALIPAY_APP_ID,
        privateKey: process.env.ALIPAY_PRIVATE_KEY.replace(/\\n/g, '\n'),
        alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, '\n'),
        gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
    });

    try {
        const params = new URLSearchParams(event.body);
        const paramsJSON = Object.fromEntries(params.entries());

        // 1. 验证签名，确保是支付宝发来的合法通知
        const isSignVerified = alipaySdk.checkNotifySign(paramsJSON);
        if (!isSignVerified) {
            console.error('Alipay sign verification failed.');
            return { statusCode: 200, body: 'failure' };
        }

        // 2. 检查交易状态
        const tradeStatus = params.get('trade_status');
        if (tradeStatus === 'TRADE_SUCCESS') {
            console.log('Payment successful. Processing business logic...');

            // 3. 执行业务逻辑：发送邮件
            await sendPurchaseEmail(params);

            // TODO: (可选) 在这里添加将订单信息存入 Supabase 的代码
        }

        // 4. 向支付宝返回 'success'
        return { statusCode: 200, body: 'success' };

    } catch (error) {
        console.error('Error processing Alipay notification:', error);
        return { statusCode: 200, body: 'failure' };
    }
};