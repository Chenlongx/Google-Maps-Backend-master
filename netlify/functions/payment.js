// 文件路径: netlify/functions/payment.js

const serverless = require('serverless-http');
const express = require('express');
const AlipaySdk = require('alipay-sdk').default;
const cors = require('cors');

const app = express();

// ====== 1. CORS 配置 (保持不变) ======
const allowedOrigins = [
    'http://localhost:8888',
    'https://google-maps-backend-master.netlify.app'
];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
app.use(cors(corsOptions));
app.use(express.json());

// ====== 2. 支付宝 SDK 初始化 (保持不变) ======
const alipaySdk = new AlipaySdk({
    appId: process.env.ALIPAY_APP_ID,
    privateKey: process.env.ALIPAY_PRIVATE_KEY.replace(/\\n/g, '\n'),
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, '\n'),
    gateway: 'https://openapi-sandbox.dl. Alipaydev.com/gateway.do',
});

// ====== 3. 创建支付路由 (保持不变) ======
const router = express.Router();
router.post('/create-payment', async (req, res) => {
    // ... 内部逻辑完全不变 ...
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
                notify_url: `https://google-maps-backend-master.netlify.app/.netlify/functions/alipay-notify`
            },
        });
        res.json({ success: true, qrCodeUrl: result.qrCode });
    } catch (error) {
        console.error('Alipay API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }
});

// ====== 4. 【重要】修正路由挂载方式 ======
// 创建一个基础路径 /api，并将 router 挂载到它下面
app.use('/api', router);

// 使用 serverless-http 导出 handler
module.exports.handler = serverless(app);