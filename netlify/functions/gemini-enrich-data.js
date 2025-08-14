const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require('@supabase/supabase-js');

// 初始化数据库和Gemini客户端
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(supabaseUrl, supabaseKey);


exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { user_id, companies } = JSON.parse(event.body);

        if (!user_id || !companies || !Array.isArray(companies) || companies.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: '请求参数不正确' }) };
        }
        
        // --- 1. 权限和Token余额验证 (服务器端再次验证，确保安全) ---
        let { data: user, error: userError } = await supabase
            .from('user_accounts') // 注意：这里应该用您存储终端用户的表名，比如 'users' 或 'user_accounts'
            .select('is_ai_authorized, ai_tokens_remaining')
            .eq('id', user_id)
            .single();

        if (userError || !user) {
            return { statusCode: 404, body: JSON.stringify({ success: false, message: '用户不存在' }) };
        }
        if (!user.is_ai_authorized) {
            return { statusCode: 403, body: JSON.stringify({ success: false, message: 'AI功能未授权' }) };
        }
        
        // 假设每个公司消耗1个点数
        const tokens_needed = companies.length;
        if (user.ai_tokens_remaining < tokens_needed) {
            return { statusCode: 402, body: JSON.stringify({ success: false, message: 'AI点数余额不足' }) };
        }

        // --- 2. 构建Gemini Prompt ---
        const companiesListString = JSON.stringify(companies.map(c => c.name), null, 2);
        const prompt = `
您是一个专业的数据查询与情报采集专家。请根据我提供的公司列表，使用全网互联网搜索查询它们的完整联系信息和贸易数据。
严格按照以下 JSON 模板返回，所有公司放在同一个数组中，所有字段必须包含，即使值为 null。
除 JSON 外不得输出任何额外说明。
JSON模板：
{
"公司": [
    {
        "name": "公司全名",
        "address": "公司地址",
        "phone": "主要电话",
        "email": "电子邮箱",
        "website": "官方网站链接",
        "facebook": "Facebook页面链接",
        "instagram": "Instagram 页面链接",
        "youtube": "YouTube 频道链接",
        "linkedin": "LinkedIn页面链接",
        "交易数据": {
            "出口国家": [], "进口国家": [], "产品类别": [], "年份": [], "总值": null
        }
    }
]
}
公司列表:
${companiesListString}
`;
        // --- 3. 调用Gemini API ---
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let aiJsonText = response.text();
        
        // 清理Gemini可能返回的包裹代码块的```json ... ```
        aiJsonText = aiJsonText.replace(/^```json\n/, '').replace(/\n```$/, '');

        let enrichedData;
        try {
            enrichedData = JSON.parse(aiJsonText);
        } catch (parseError) {
             throw new Error("AI未能返回有效的JSON数据格式。");
        }


        // --- 4. 更新用户Token余额 ---
        const tokens_used = tokens_needed;
        const new_tokens_remaining = user.ai_tokens_remaining - tokens_used;

        const { error: updateError } = await supabase
            .from('users') // 同样，用您的用户表名
            .update({ ai_tokens_remaining: new_tokens_remaining })
            .eq('id', user_id);

        if (updateError) {
            console.error("更新Token失败:", updateError);
            // 即使更新失败，也先把结果返回给用户，但需要记录这个错误
        }

        // --- 5. 返回成功响应 ---
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                data: enrichedData,
                tokens_used: tokens_used,
                tokens_remaining: new_tokens_remaining
            })
        };

    } catch (e) {
        console.error("AI处理时发生错误:", e);
        return { statusCode: 500, body: JSON.stringify({ success: false, message: `服务器内部错误: ${e.message}` }) };
    }
};