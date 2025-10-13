exports.handler = async (event, context) => {
  // 设置CORS头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  // 只允许GET请求
  if (event.httpMethod !== 'GET') {
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
    // 获取当前服务器时间
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000); // Unix时间戳（秒）
    const isoString = now.toISOString(); // ISO格式时间

    console.log(`服务器时间请求: ${isoString}`);

    // 返回服务器时间
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        timestamp: timestamp,
        iso_string: isoString,
        timezone: 'UTC',
        server: 'google-maps-backend-master.netlify.app'
      })
    };

  } catch (error) {
    console.error('获取服务器时间异常:', error);
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
