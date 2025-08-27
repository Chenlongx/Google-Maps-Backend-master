// 文件路径: netlify/functions/payment.js

// 引入 serverless-http 库来包装 express 应用
const serverless = require('serverless-http');
const express = require('express');
const AlipaySdk = require('alipay-sdk').default;
const cors = require('cors');

const app = express();

// ====== 1. 从环境变量安全地初始化支付宝 SDK ======
// Netlify 会自动将您在UI界面设置的环境变量注入到 process.env 对象中
const alipaySdk = new AlipaySdk({
    appId: process.env.ALIPAY_APP_ID,
    // process.env 读取的环境变量中的换行符 `\n` 会被转义成字符串 "\\n"
    // 我们需要用.replace(/\\n/g, '\n') 将其转换回真实的换行符
    privateKey: process.env.ALIPAY_PRIVATE_KEY.replace(/\\n/g, '\n'),
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, '\n'),
    // 网关需要指向您正在使用的环境（沙盒或生产）
    gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
});

// 使用 express.Router 来管理路由，这是一个好习惯
const router = express.Router();

router.use(express.json());
router.use(cors()); // 允许跨域请求

// ====== 2. 创建支付订单的 API 接口 ======
// 注意：路由路径不再需要 /api/ 前缀，因为 Netlify 的重定向规则会处理
router.post('/create-payment', async (req, res) => {
    const { productId, price, email } = req.body;

    if (!productId || !price || !email) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    const encodedEmail = Buffer.from(email).toString('base64');
    const outTradeNo = `${productId}-${Date.now()}-${encodedEmail}`;
    
    let subject = '未知商品';
    if (productId.startsWith('gmaps')) {
        subject = productId.includes('premium') ? 'Google Maps Scraper 高级版' : 'Google Maps Scraper 标准版';
    } else if (productId.startsWith('validator')) {
        subject = productId.includes('premium') ? 'Email Validator 高级版激活码' : 'Email Validator 标准版激活码';
    }

    try {
        const result = await alipaySdk.exec('alipay.trade.precreate', {
            bizContent: {
                out_trade_no: outTradeNo,
                total_amount: price,
                subject: subject,
                // 在回调通知中，您可以通过 notify_url 指定接收通知的地址
                // notify_url: 'https://YOUR_SITE_NAME.netlify.app/.netlify/functions/alipay-notify'
            },
        });

        res.json({ success: true, qrCodeUrl: result.qrCode });

    } catch (error) {
        console.error('Alipay API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }
});

// ====== 3. 将 Express 应用与 Netlify Function 结合 ======
// 将 Express 路由挂载到 /api/ 路径下
// 这样，Netlify 会将所有 /api/ 的请求都交给这个 Express 应用处理
app.use('/.netlify/functions/payment', router);

// 使用 serverless-http 导出 handler
module.exports.handler = serverless(app);