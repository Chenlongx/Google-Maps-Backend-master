// functions/generateWhatsAppLicense.js (已修正为Token验证)
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        persistSession: false
    }
});

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // --- 核心修改：从验证密码改为验证Token ---

    // 1. 从请求头中获取并验证 Token
    const authorizationHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authorizationHeader) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: '未提供Token，请登录' }) };
    }
    const token = authorizationHeader.split(' ')[1];
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Token 格式不正确' }) };
    }
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Token 无效或已过期' }) };
    }

    // --- Token验证通过 ---

    // 2. 从请求体中获取参数
    const { count, licenseType, expiryDays } = JSON.parse(event.body);

    if (!count || count <= 0 || count > 100) {
        return { statusCode: 400, body: JSON.stringify({ success: false, message: '请输入一个1到100之间的有效数量。' }) };
    }

    // 验证 licenseType
    const validTypes = ['trial', 'standard', 'premium'];
    const type = validTypes.includes(licenseType) ? licenseType : 'standard';

    try {
        // 计算到期时间
        let expiryDate = null;
        if (type === 'trial') {
            // 试用码默认 3 天
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + (expiryDays || 3));
        } else if (expiryDays && expiryDays > 0) {
            // 正式码如果指定了天数
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + expiryDays);
        }
        // 如果 expiryDays 未指定且非试用，则 expiryDate 为 null（永久）

        const licensesToInsert = [];
        for (let i = 0; i < count; i++) {
            const { data: newKey, error: rpcError } = await supabase.rpc('generate_whatsapp_key');
            if (rpcError) {
                throw new Error(`调用数据库函数失败: ${rpcError.message}`);
            }

            const licenseData = {
                key: newKey,
                notes: type === 'trial' ? '试用激活码' : (type === 'premium' ? '高级版激活码' : '标准版激活码'),
                status: 'available'
            };

            if (expiryDate) {
                licenseData.expiry_date = expiryDate.toISOString();
            }

            licensesToInsert.push(licenseData);
        }

        const { error } = await supabase
            .from('whatsapp_activation_code')
            .insert(licensesToInsert);

        if (error) {
            throw error;
        }

        const typeLabel = type === 'trial' ? '试用' : (type === 'premium' ? '高级版' : '标准版');
        const expiryInfo = expiryDate ? `，有效期至 ${expiryDate.toLocaleDateString('zh-CN')}` : '（永久有效）';

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: `成功生成 ${count} 个${typeLabel}激活码${expiryInfo}` })
        };

    } catch (err) {
        console.error('生成WhatsApp激活码失败:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: `生成失败: ${err.message}` })
        };
    }
};