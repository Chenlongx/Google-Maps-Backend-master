// functions/validate.js
const { createClient } = require('@supabase/supabase-js');

// 请确保您已在 Netlify 后台的 “Site settings” > “Build & deploy” > “Environment”
// 中设置了这两个环境变量，而不是将密钥硬编码在代码中。
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async function(event, context) {
  // 这是一个安全检查，确保只接受 POST 方法的请求
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ success: false, message: 'Method Not Allowed' }) 
    };
  }

  try {
    const { licenseKey, machineId } = JSON.parse(event.body);

    // 检查Python客户端是否发送了必要的信息
    if (!licenseKey || !machineId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ success: false, message: '请求中缺少激活码或机器码。' }) 
      };
    }

    // 核心逻辑：在数据库中查找匹配的许可证
    const { data: license, error } = await supabase
      .from('licenses')      // 从 'licenses' 表中
      .select('*')           // 选择所有列
      .eq('key', licenseKey) // 条件：'key' 字段等于传入的 licenseKey
      .single();              // 期望只找到一条记录

    // 1. 检查激活码是否存在
    if (error || !license) {
      return { 
        statusCode: 404, // Not Found
        body: JSON.stringify({ success: false, message: '此激活码不存在。' }) 
      };
    }

    // 2. 检查机器码是否与数据库中记录的匹配
    if (license.machine_id !== machineId) {
        return { 
          statusCode: 403, // Forbidden
          body: JSON.stringify({ success: false, message: '此激活码与当前设备不匹配，可能已在别处使用。' }) 
        };
    }

    // 3. 检查激活码的状态是否为 'active' (例如，管理员可能已手动将其吊销)
    if (license.status !== 'active') {
        return { 
          statusCode: 403, // Forbidden
          body: JSON.stringify({ success: false, message: `此激活码已被禁用，当前状态为 "${license.status}"。` }) 
        };
    }

    // 4. (可选) 检查是否已过期
    if (license.expiry_date && new Date(license.expiry_date) < new Date()) {
       // 如果已过期，顺便更新一下数据库中的状态
       await supabase
        .from('licenses')
        .update({ status: 'expired' })
        .eq('key', licenseKey);
       return { 
         statusCode: 403, // Forbidden
         body: JSON.stringify({ success: false, message: '此激活码已过期。' }) 
        };
    }

    // 如果以上所有检查都通过，证明许可证完全有效
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: '许可证有效。' })
    };

  } catch (err) {
    console.error('Validation error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: '服务器内部错误，请联系技术支持。' })
    };
  }
};