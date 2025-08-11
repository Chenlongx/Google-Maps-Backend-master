const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');  // 用于密码哈希处理

const uri = "mongodb+srv://aa2231401652:4tvpB576PH2tI3mo@googlemaps.omgzf.mongodb.net/?retryWrites=true&w=majority&appName=GoogleMaps";

// Netlify Functions 不需要使用 Express app，而是直接导出一个 handler 函数
exports.handler = async (event, context) => {
    // 解析请求体
    const { username, password, device_id } = JSON.parse(event.body);

    // 检查请求体中的必填字段
    if (!username || !password || !device_id) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "请输入用户名、密码和设备ID" })
        };
    }

    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        // 连接到 MongoDB 服务器
        await client.connect();
        console.log("成功连接到数据库");

        // 选择数据库和集合
        const database = client.db("user_management");
        const regularUsersCollection = database.collection("trial_users");

        // 检查设备ID是否已经存在
        const existingUser = await regularUsersCollection.findOne({ device_id: device_id });

        if (existingUser) {
            // 如果设备ID已经存在，返回错误信息
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "设备ID已注册，无法重复注册" })
            };
        }

        // 对密码进行哈希处理
        const hashedPassword = await bcrypt.hash(password, 10); // 盐值强度为10

        // 创建新用户对象
        const newUser = {
            username: username,
            password: hashedPassword, // 存储哈希后的密码
            device_id: device_id,     // 存储设备ID
            user_type: "trial_users", // 用户类型为管理员
            created_at: new Date(),   // 注册时间
            updated_at: new Date(),   // 更新时间
            status: "active"          // 用户激活状态 （active / inactive / suspended）
        };

        // 向数据库中插入新用户
        await regularUsersCollection.insertOne(newUser);
        console.log("插入一名试用用户");

        // 返回注册成功的响应
        return {
            statusCode: 201,
            body: JSON.stringify({ message: "注册成功，请登录" })
        };

    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "服务器内部错误" })
        };
    } finally {
        // 关闭 MongoDB 客户端连接
        await client.close();
    }
};