// 文件路径: netlify/functions/payment.js

// 引入 serverless-http 库来包装 express 应用
const serverless = require('serverless-http');
const express = require('express');
const AlipaySdk = require('alipay-sdk').default;
const cors = require('cors');

const app = express();

// ====== 1. 从环境变量安全地初始化支付宝 SDK ======
const alipaySdk = new AlipaySdk({
    appId: process.env.ALIPAY_APP_ID,
    privateKey: process.env.ALIPAY_PRIVATE_KEY.replace(/\\n/g, '\n'),
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, '\n'),
    gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
});

// ====== 2. 【重要】配置 CORS 跨域许可 ======
// 为开发环境和生产环境都配置允许的源
const allowedOrigins = [
    'http://localhost:8888', // 允许您本地开发服务器的地址
    'https://google-maps-backend-master.netlify.app' // 【重要】您网站最终部署的线上地址
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
// 在所有路由之前应用 CORS 配置
app.use(cors(corsOptions));
app.use(express.json());


// ====== 3. 创建支付订单的 API 接口 ======
// 使用 Express Router 来管理路由
const router = express.Router();
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
                // 回调通知地址，支付成功后支付宝会请求这个地址
                notify_url: `https://google-maps-backend-master.netlify.app/.netlify/functions/alipay-notify`
            },
        });

        res.json({ success: true, qrCodeUrl: result.qrCode });

    } catch (error) {
        console.error('Alipay API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }
});


// ====== 4. 将 Express 应用与 Netlify Function 结合 ======
// 将路由挂载到应用的根路径
app.use('/.netlify/functions/payment', router);

// 使用 serverless-http 导出 handler，这是 Netlify 运行函数的入口
module.exports.handler = serverless(app);