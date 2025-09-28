// 管理员更新系统配置
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

exports.handler = async (event, context) => {
  // CORS 预检请求处理
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, message: '只支持 POST 请求' }),
    };
  }

  try {
    const {
      adminUserId,
      configs // 配置数组 [{key: 'default_commission_rate', value: {rate: 15.00}}]
    } = JSON.parse(event.body || '{}');

    if (!adminUserId || !configs || !Array.isArray(configs)) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '管理员ID和配置数据不能为空' 
        }),
      };
    }

    // 1. 验证管理员权限
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role_name')
      .eq('user_id', adminUserId)
      .eq('role_name', 'admin')
      .single();

    if (!adminRole) {
      return {
        statusCode: 403,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '只有管理员才能更新系统配置' 
        }),
      };
    }

    // 2. 验证配置数据
    const validConfigKeys = [
      'default_commission_rate',
      'min_withdrawal_amount',
      'max_withdrawal_amount',
      'withdrawal_fee_rate',
      'agent_levels'
    ];

    for (const config of configs) {
      if (!config.key || !validConfigKeys.includes(config.key)) {
        return {
          statusCode: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ 
            success: false, 
            message: `无效的配置键: ${config.key}` 
          }),
        };
      }

      if (!config.value) {
        return {
          statusCode: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ 
            success: false, 
            message: `配置 ${config.key} 的值不能为空` 
          }),
        };
      }

      // 验证特定配置的值
      switch (config.key) {
        case 'default_commission_rate':
          if (typeof config.value.rate !== 'number' || config.value.rate < 0 || config.value.rate > 100) {
            return {
              statusCode: 400,
              headers: { "Access-Control-Allow-Origin": "*" },
              body: JSON.stringify({ 
                success: false, 
                message: '默认分佣比例必须在 0-100 之间' 
              }),
            };
          }
          break;
        case 'min_withdrawal_amount':
        case 'max_withdrawal_amount':
          if (typeof config.value.amount !== 'number' || config.value.amount < 0) {
            return {
              statusCode: 400,
              headers: { "Access-Control-Allow-Origin": "*" },
              body: JSON.stringify({ 
                success: false, 
                message: `${config.key} 必须是大于等于0的数字` 
              }),
            };
          }
          break;
        case 'withdrawal_fee_rate':
          if (typeof config.value.rate !== 'number' || config.value.rate < 0 || config.value.rate > 100) {
            return {
              statusCode: 400,
              headers: { "Access-Control-Allow-Origin": "*" },
              body: JSON.stringify({ 
                success: false, 
                message: '提现手续费比例必须在 0-100 之间' 
              }),
            };
          }
          break;
        case 'agent_levels':
          if (!Array.isArray(config.value.levels)) {
            return {
              statusCode: 400,
              headers: { "Access-Control-Allow-Origin": "*" },
              body: JSON.stringify({ 
                success: false, 
                message: '代理层级配置必须是数组' 
              }),
            };
          }
          for (const level of config.value.levels) {
            if (typeof level.level !== 'number' || typeof level.rate !== 'number' || 
                level.rate < 0 || level.rate > 100) {
              return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ 
                  success: false, 
                  message: '代理层级配置格式错误' 
                }),
              };
            }
          }
          break;
      }
    }

    // 3. 批量更新配置
    const updatePromises = configs.map(config => 
      supabase
        .from('system_config')
        .upsert({
          config_key: config.key,
          config_value: config.value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'config_key'
        })
    );

    const results = await Promise.all(updatePromises);
    
    // 检查是否有错误
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('更新配置失败:', errors);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '更新配置失败: ' + errors[0].error.message 
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        message: '系统配置更新成功',
        data: {
          updatedCount: configs.length,
          configs: configs.map(config => ({
            key: config.key,
            value: config.value
          }))
        }
      }),
    };

  } catch (error) {
    console.error('更新系统配置函数出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        success: false, 
        message: '服务器内部错误', 
        error: error.message 
      }),
    };
  }
};
