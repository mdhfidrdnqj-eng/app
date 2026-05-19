-- إنشاء قاعدة البيانات


-- جدول المستخدمين
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    photo TEXT,
    is_admin INT DEFAULT 0,
    created_at INT NOT NULL
);

-- جدول العملات
CREATE TABLE IF NOT EXISTS currencies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    price DECIMAL(20,8) DEFAULT 0,
    total_supply DECIMAL(20,2) DEFAULT 0,
    circulating_supply DECIMAL(20,2) DEFAULT 0,
    liquidity DECIMAL(20,8) DEFAULT 0,
    is_main INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_by BIGINT,
    created_at INT,
    image TEXT,
    description TEXT,
    price_history TEXT,
    trade_count INT DEFAULT 0
);

-- جدول الأرصدة
CREATE TABLE IF NOT EXISTS balances (
    user_id BIGINT,
    currency_id VARCHAR(50),
    amount DECIMAL(20,8) DEFAULT 0,
    PRIMARY KEY (user_id, currency_id)
);

-- جدول المعاملات
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_user_id BIGINT,
    to_user_id BIGINT,
    currency_id VARCHAR(50),
    amount DECIMAL(20,8),
    note TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    ts INT
);

-- جدول طلبات إنشاء العملات
CREATE TABLE IF NOT EXISTS currency_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    symbol VARCHAR(10),
    total_supply DECIMAL(20,2),
    description TEXT,
    image TEXT,
    created_by BIGINT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at INT
);

-- جدول طلبات الشحن
CREATE TABLE IF NOT EXISTS deposit_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    amount DECIMAL(20,8),
    amount_iqd DECIMAL(20,2),
    transaction_id VARCHAR(100),
    sender_name VARCHAR(255),
    receipt_image TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at INT,
    admin_note TEXT
);

-- إضافة الأدمن (استبدل 6187252111 برقم التليجرام الخاص بك)
INSERT INTO users (id, name, is_admin, created_at) VALUES (6187252111, 'Admin', 1, UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE is_admin = 1;

-- إضافة العملة الرئيسية GCOIN
INSERT INTO currencies (id, name, symbol, price, total_supply, circulating_supply, liquidity, is_main, status, created_at, price_history, trade_count) 
VALUES ('gco_main', 'GCOIN', 'GCO', 1000, 999999999, 1000000, 1000000000, 1, 'active', UNIX_TIMESTAMP(), '[1000,1000,1000,1000,1000,1000,1000]', 0);