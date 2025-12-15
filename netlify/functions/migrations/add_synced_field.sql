-- ============================================
-- 添加 synced 字段用于本地同步标记
-- ============================================

-- 在 email_tracking_stats 表中添加 synced 字段
ALTER TABLE email_tracking_stats 
ADD COLUMN IF NOT EXISTS synced BOOLEAN DEFAULT FALSE;

ALTER TABLE email_tracking_stats 
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE;

-- 创建索引以加速已同步数据的清理
CREATE INDEX IF NOT EXISTS idx_stats_synced ON email_tracking_stats(synced);
