// 管理员获取佣金列表
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
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, message: '只支持 GET 请求' }),
    };
  }

  try {
    const { 
      status = 'all',
      page = 1,
      limit = 20,
      startDate,
      endDate,
      agentId
    } = event.queryStringParameters || {};

    // 构建查询条件
    let query = supabase
      .from('commission_records')
      .select(`
        *,
        agent:agent_profiles(
          id,
          agent_code,
          real_name,
          level
        ),
        order:orders(
          order_number,
          product_name,
          amount,
          customer_id,
          created_at
        ),
        approver:user_roles!approved_by(
          user_id
        )
      `)
      .order('created_at', { ascending: false });

    // 状态筛选
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // 代理筛选
    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    // 日期筛选
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // 分页
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    query = query.range(from, to);

    const { data: commissionRecords, error: fetchError } = await query;

    if (fetchError) {
      console.error('获取佣金记录失败:', fetchError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '获取佣金记录失败: ' + fetchError.message 
        }),
      };
    }

    // 获取总数
    let countQuery = supabase
      .from('commission_records')
      .select('*', { count: 'exact', head: true });

    if (status !== 'all') {
      countQuery = countQuery.eq('status', status);
    }
    if (agentId) {
      countQuery = countQuery.eq('agent_id', agentId);
    }
    if (startDate) {
      countQuery = countQuery.gte('created_at', startDate);
    }
    if (endDate) {
      countQuery = countQuery.lte('created_at', endDate);
    }

    const { count } = await countQuery;

    // 计算统计数据
    const stats = {
      total: count || 0,
      pending: 0,
      approved: 0,
      paid: 0,
      rejected: 0,
      totalAmount: 0
    };

    if (commissionRecords) {
      commissionRecords.forEach(record => {
        const amount = parseFloat(record.commission_amount);
        stats.totalAmount += amount;
        
        switch (record.status) {
          case 'pending':
            stats.pending++;
            break;
          case 'approved':
            stats.approved++;
            break;
          case 'paid':
            stats.paid++;
            break;
          case 'rejected':
            stats.rejected++;
            break;
        }
      });
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        data: {
          records: commissionRecords || [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limitNum)
          },
          stats: {
            ...stats,
            totalAmount: stats.totalAmount.toFixed(2)
          }
        }
      }),
    };

  } catch (error) {
    console.error('获取佣金列表函数出错:', error);
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
