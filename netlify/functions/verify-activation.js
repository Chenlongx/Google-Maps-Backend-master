const { createClient } = require('@supabase/supabase-js');

// 初始化Supabase客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  // 设置CORS头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // 只允许POST请求
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'Method not allowed' 
      })
    };
  }

  try {
    // 解析请求体
    const requestData = JSON.parse(event.body);
    const { 
      activation_code, 
      machine_id, 
      timestamp, 
      software_version 
    } = requestData;

    // 验证必需参数
    if (!activation_code || !machine_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: '激活码和机器ID是必需的'
        })
      };
    }

    console.log(`验证激活码请求: ${activation_code}, 机器ID: ${machine_id}`);

    // 查询激活码
    const { data: activationCode, error: queryError } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('code', activation_code)
      .single();

    if (queryError) {
      console.error('查询激活码失败:', queryError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: '查询激活码失败'
        })
      };
    }

    // 检查激活码是否存在
    if (!activationCode) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          message: '激活码不存在'
        })
      };
    }

    // 检查激活码状态
    if (activationCode.status !== 'active') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          message: '激活码已失效'
        })
      };
    }

    // 检查激活码是否过期
    const now = new Date();
    const expiryDate = new Date(activationCode.expiry_date);
    
    if (now > expiryDate) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          message: '激活码已过期'
        })
      };
    }

    // 检查是否已被使用
    if (activationCode.used_at) {
      // 如果已被使用，检查机器ID是否匹配
      if (activationCode.user_email !== machine_id) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            message: '激活码已被其他设备使用'
          })
        };
      }
    } else {
      // 首次使用，记录使用信息
      const { error: updateError } = await supabase
        .from('activation_codes')
        .update({
          used_at: now.toISOString(),
          user_email: machine_id,
          user_name: `用户_${machine_id.substring(0, 8)}`,
          notes: `首次激活 - 软件版本: ${software_version || '1.0.0'}`
        })
        .eq('code', activation_code);

      if (updateError) {
        console.error('更新激活码使用信息失败:', updateError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            message: '更新激活信息失败'
          })
        };
      }
    }

    // 计算剩余天数
    const remainingDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

    // 返回成功响应
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: '激活码验证成功',
        activation_info: {
          activation_code: activationCode.code,
          expiry_time: activationCode.expiry_date,
          remaining_days: remainingDays,
          user_info: {
            name: activationCode.user_name || `用户_${machine_id.substring(0, 8)}`,
            email: activationCode.user_email || machine_id,
            machine_id: machine_id
          },
          software_version: software_version || '1.0.0',
          activated_at: activationCode.used_at || now.toISOString()
        }
      })
    };

  } catch (error) {
    console.error('激活码验证异常:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: '服务器内部错误'
      })
    };
  }
};
