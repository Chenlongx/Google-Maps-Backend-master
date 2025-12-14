-- ============================================
-- 邮件追踪功能 - Supabase 数据库迁移脚本
-- ============================================

-- 1. 追踪令牌表 - 存储每封邮件的唯一追踪标识
-- 注意: user_id 字段存储的是 licenses 表的 id 或 key
CREATE TABLE IF NOT EXISTS email_tracking_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    campaign_id INTEGER NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,  -- 关联 licenses.id 或 licenses.key
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- 索引
    CONSTRAINT unique_campaign_recipient UNIQUE (campaign_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_tokens_token ON email_tracking_tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON email_tracking_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_campaign_id ON email_tracking_tokens(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON email_tracking_tokens(expires_at);

-- 2. 追踪日志表 - 临时存储追踪事件 (批量聚合前)
CREATE TABLE IF NOT EXISTS email_tracking_logs (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(64) NOT NULL,
    event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('open', 'click')),
    ip_address INET,
    user_agent TEXT,
    clicked_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    
    -- 索引
    CONSTRAINT fk_log_token FOREIGN KEY (token) REFERENCES email_tracking_tokens(token) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_logs_token ON email_tracking_logs(token);
CREATE INDEX IF NOT EXISTS idx_logs_processed ON email_tracking_logs(processed);
CREATE INDEX IF NOT EXISTS idx_logs_created ON email_tracking_logs(created_at);

-- 3. 追踪统计表 - 聚合后的统计数据
CREATE TABLE IF NOT EXISTS email_tracking_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,  -- 关联 licenses.id 或 licenses.key
    campaign_id INTEGER NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    first_open_at TIMESTAMP WITH TIME ZONE,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 唯一约束
    CONSTRAINT unique_stats_recipient UNIQUE (campaign_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_stats_user_id ON email_tracking_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_stats_campaign_id ON email_tracking_stats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_stats_last_activity ON email_tracking_stats(last_activity_at);

-- 4. 用户追踪配额表 - 免费/付费限制
CREATE TABLE IF NOT EXISTS user_tracking_quotas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,  -- 关联 licenses.id 或 licenses.key
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 唯一约束: 每用户每天一条记录
    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_quotas_user_date ON user_tracking_quotas(user_id, date);

-- ============================================
-- RLS 策略 (Row Level Security)
-- ============================================

-- 启用 RLS
ALTER TABLE email_tracking_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tracking_quotas ENABLE ROW LEVEL SECURITY;

-- 追踪令牌: 允许服务端读写
CREATE POLICY "Allow service role full access on tokens"
    ON email_tracking_tokens
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 追踪日志: 允许服务端读写
CREATE POLICY "Allow service role full access on logs"
    ON email_tracking_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 追踪统计: 允许服务端读写 (user_id 是 VARCHAR，不能用 auth.uid() 比较)
CREATE POLICY "Allow service role full access on stats"
    ON email_tracking_stats
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 配额表: 允许服务端读写 (user_id 是 VARCHAR，不能用 auth.uid() 比较)
CREATE POLICY "Allow service role full access on quotas"
    ON user_tracking_quotas
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 定时清理任务 (可选 - pg_cron)
-- ============================================

-- 清理过期令牌 (每天凌晨执行)
-- SELECT cron.schedule('clean-expired-tokens', '0 3 * * *', $$
--     DELETE FROM email_tracking_tokens WHERE expires_at < NOW() - INTERVAL '7 days';
-- $$);

-- 清理已处理的日志 (每天执行)
-- SELECT cron.schedule('clean-processed-logs', '0 4 * * *', $$
--     DELETE FROM email_tracking_logs WHERE processed = true AND created_at < NOW() - INTERVAL '30 days';
-- $$);

-- ============================================
-- 完成
-- ============================================
-- 运行此脚本后，请在 Supabase Dashboard 中验证表已创建
-- 然后将 TRACKING_SECRET 添加到 Netlify 环境变量
