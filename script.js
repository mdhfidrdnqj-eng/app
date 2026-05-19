/**
 * ============================================
 * VAULTX - FRONTEND APPLICATION
 * ============================================
 */

// متغيرات عامة
let currentUser = null;
let allCurrencies = [];
let userBalances = [];
let allTransactions = [];
let depositRequests = [];
let selectedImageBase64 = null;

// تهيئة التطبيق
async function init() {
    try {
        await authenticate();
        await loadData();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        
        setupEventListeners();
        showPage('home');
        
        showToast('مرحباً بك في GCOIN', 'success');
    } catch (error) {
        console.error(error);
        document.getElementById('loading').innerHTML = `
            <div class="logo-text">GCOIN</div>
            <div style="color:var(--red);margin-top:20px">خطأ في الاتصال</div>
            <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;background:var(--accent);border:none;border-radius:10px">إعادة المحاولة</button>
        `;
    }
}

// المصادقة
async function authenticate() {
    const tg = window.Telegram?.WebApp;
    let initData = '';
    
    if (tg) {
        tg.ready();
        tg.expand();
        initData = tg.initData;
    }
    
    if (!initData) {
        // وضع تجريبي
        const mockUser = {
            id: 6187252111,
            first_name: 'Admin',
            last_name: 'User'
        };
        initData = `user=${encodeURIComponent(JSON.stringify(mockUser))}&auth_date=${Math.floor(Date.now()/1000)}`;
    }
    
    const response = await fetch('/api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
    });
    
    const data = await response.json();
    if (data.success) {
        currentUser = data.user;
        updateHeader();
        
        if (currentUser.is_admin) {
            document.getElementById('adminNavBtn').style.display = 'flex';
        }
    } else {
        throw new Error('Auth failed');
    }
}

// تحميل البيانات
async function loadData() {
    const response = await fetch('/api/get_data.php');
    const data = await response.json();
    
    if (data.success) {
        allCurrencies = data.currencies;
        userBalances = data.balances;
        allTransactions = data.transactions;
        depositRequests = data.deposits;
        
        renderHome();
        renderMarket();
        renderWallet();
        renderHistory();
        renderDeposit();
        
        if (currentUser.is_admin) {
            renderAdmin();
        }
    }
}

// تحديث الهيدر
function updateHeader() {
    document.getElementById('hdr-name').textContent = currentUser.name || 'مستخدم';
    document.getElementById('hdr-role').textContent = currentUser.is_admin ? 'مدير' : 'عضو';
    
    const avatar = document.getElementById('hdr-avatar');
    if (currentUser.photo) {
        avatar.innerHTML = `<img src="${currentUser.photo}">`;
    } else {
        avatar.textContent = (currentUser.name?.charAt(0) || 'م');
    }
}

// عرض الصفحة الرئيسية
function renderHome() {
    const mainCurrency = allCurrencies.find(c => c.is_main);
    const myBalance = userBalances.find(b => b.currency_id === mainCurrency?.id)?.amount || 0;
    const myBalanceIqd = myBalance * 1000;
    
    // حساب إجمالي القيمة
    let totalValue = 0;
    for (const bal of userBalances) {
        const currency = allCurrencies.find(c => c.id === bal.currency_id);
        if (currency) totalValue += bal.amount * currency.price;
    }
    
    // آخر 5 معاملات
    const recentTxs = allTransactions.slice(0, 5);
    
    const html = `
        <div class="balance-card">
            <div class="balance-label">رصيد GCOIN</div>
            <div class="balance-amount">${myBalance.toFixed(2)} GCO</div>
            <div class="balance-currency">≈ ${myBalanceIqd.toLocaleString()} دينار عراقي</div>
            <div class="balance-actions" style="margin-top:16px">
                <button class="btn btn-primary" onclick="openSendModal()">📤 إرسال</button>
                <button class="btn btn-gold" onclick="showPage('deposit')">💳 شحن</button>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${totalValue.toFixed(2)}</div>
                <div class="stat-label">إجمالي المحفظة (GCO)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${allTransactions.length}</div>
                <div class="stat-label">عدد التحويلات</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${(totalValue * 1000).toLocaleString()}</div>
                <div class="stat-label">القيمة (دينار)</div>
            </div>
        </div>
        
        <div class="section-title">آخر التحويلات</div>
        ${recentTxs.length === 0 ? '<div class="empty-state">لا توجد تحويلات بعد</div>' : recentTxs.map(tx => renderTransaction(tx)).join('')}
        
        <div class="section-title">إجراءات سريعة</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <button class="btn btn-outline" onclick="openCreateCurrencyModal()">✦ إنشاء عملة</button>
            <button class="btn btn-outline" onclick="showPage('market')">📊 عرض السوق</button>
        </div>
    `;
    
    document.getElementById('page-home').innerHTML = html;
}

// عرض السوق (أول 10 عملات فقط)
function renderMarket() {
    const mainCurrency = allCurrencies.find(c => c.is_main);
    const otherCurrencies = allCurrencies.filter(c => !c.is_main && c.status === 'active').slice(0, 10);
    
    let html = `
        <div class="section-title">السوق</div>
        <div class="price-indicator">
            <div class="price-dot"></div>
            <div>الأسعار تتحدث تلقائياً مع كل تداول</div>
        </div>
    `;
    
    // العملة الرئيسية
    if (mainCurrency) {
        html += `
            <div class="balance-card" style="margin-bottom:16px;cursor:pointer" onclick="showCurrencyDetail('${mainCurrency.id}')">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                    <div class="currency-icon-placeholder">${mainCurrency.symbol}</div>
                    <div>
                        <div style="font-weight:700">${mainCurrency.name}</div>
                        <div style="font-size:0.75rem;color:var(--text2)">العملة الرئيسية</div>
                    </div>
                </div>
                <div class="balance-amount" style="font-size:1.5rem">${mainCurrency.price_display} ${mainCurrency.symbol}</div>
                <div style="font-size:0.75rem;margin-top:4px">≈ ${mainCurrency.price_iqd}</div>
            </div>
        `;
    }
    
    // باقي العملات
    html += `<div class="section-title">العملات المتداولة</div>`;
    
    if (otherCurrencies.length === 0) {
        html += '<div class="empty-state">لا توجد عملات في السوق بعد</div>';
    } else {
        for (const currency of otherCurrencies) {
            const myBal = userBalances.find(b => b.currency_id === currency.id)?.amount || 0;
            const changeClass = currency.price_change >= 0 ? 'up' : 'down';
            const changeSign = currency.price_change >= 0 ? '+' : '';
            
            html += `
                <div class="list-item" onclick="showCurrencyDetail('${currency.id}')">
                    <div class="currency-icon-placeholder">${currency.symbol.charAt(0)}</div>
                    <div class="list-item-content">
                        <div class="list-item-title">${currency.name}</div>
                        <div class="list-item-sub">${currency.symbol}</div>
                        ${myBal > 0 ? `<div class="list-item-sub" style="color:var(--gold)">رصيدك: ${myBal.toFixed(4)}</div>` : ''}
                    </div>
                    <div class="list-item-right">
                        <div class="list-item-amount" style="color:var(--accent)">${currency.price_display}</div>
                        <div class="currency-change ${changeClass}">${changeSign}${currency.price_change}%</div>
                    </div>
                </div>
            `;
        }
    }
    
    document.getElementById('page-market').innerHTML = html;
}

// عرض المحفظة
function renderWallet() {
    const myHoldings = userBalances.filter(b => b.amount > 0);
    const myCreatedCurrencies = allCurrencies.filter(c => c.created_by == currentUser.id && !c.is_main);
    
    const html = `
        <div class="section-title">أرصدتي</div>
        ${myHoldings.length === 0 ? '<div class="empty-state">لا توجد أرصدة</div>' : myHoldings.map(bal => {
            const currency = allCurrencies.find(c => c.id === bal.currency_id);
            if (!currency) return '';
            const valueInGco = bal.amount * currency.price;
            return `
                <div class="list-item" onclick="showCurrencyDetail('${currency.id}')">
                    <div class="currency-icon-placeholder">${currency.symbol.charAt(0)}</div>
                    <div class="list-item-content">
                        <div class="list-item-title">${currency.name} (${currency.symbol})</div>
                        <div class="list-item-sub">${bal.amount.toFixed(4)} ${currency.symbol}</div>
                    </div>
                    <div class="list-item-right">
                        <div class="list-item-amount">${valueInGco.toFixed(2)} GCO</div>
                        <button class="wallet-item-btn" onclick="event.stopPropagation();openSendForCurrency('${currency.id}')">إرسال</button>
                    </div>
                </div>
            `;
        }).join('')}
        
        <div class="section-title" style="margin-top:20px">عملاتي المنشأة</div>
        ${myCreatedCurrencies.length === 0 ? '<div class="empty-state">لم تنشئ أي عملات بعد</div>' : myCreatedCurrencies.map(c => `
            <div class="list-item" onclick="showCurrencyDetail('${c.id}')">
                <div class="currency-icon-placeholder">${c.symbol.charAt(0)}</div>
                <div class="list-item-content">
                    <div class="list-item-title">${c.name}</div>
                    <div class="list-item-sub">السعر: ${c.price_display} ${c.symbol} | السيولة: ${c.liquidity.toFixed(2)} GCO</div>
                </div>
                <div class="list-item-right">
                    <button class="wallet-item-btn" onclick="event.stopPropagation();openLiquidityForCurrency('${c.id}')">➕ سيولة</button>
                </div>
            </div>
        `).join('')}
        
        <div style="margin-top:20px">
            <button class="btn btn-gold btn-full" onclick="openCreateCurrencyModal()">✦ إنشاء عملة جديدة</button>
        </div>
    `;
    
    document.getElementById('page-wallet').innerHTML = html;
}

// عرض تاريخ المعاملات
function renderHistory() {
    if (allTransactions.length === 0) {
        document.getElementById('page-history').innerHTML = '<div class="empty-state">لا توجد معاملات بعد</div>';
        return;
    }
    
    const html = `
        <div class="section-title">سجل التحويلات</div>
        ${allTransactions.map(tx => renderTransaction(tx)).join('')}
    `;
    
    document.getElementById('page-history').innerHTML = html;
}

// عرض صفحة الشحن
function renderDeposit() {
    const pendingDeposits = depositRequests.filter(d => d.status === 'pending');
    const approvedDeposits = depositRequests.filter(d => d.status === 'approved');
    
    const html = `
        <div class="section-title">شحن الرصيد</div>
        
        <div class="balance-card" style="margin-bottom:20px">
            <div class="balance-label">تحويل بنكي يدوي</div>
            <div style="font-size:0.85rem;color:var(--text2);margin-bottom:16px">
                1 GCO = 1,000 دينار عراقي<br>
                قم بتحويل المبلغ إلى الحساب التالي ثم أرسل معلومات الدفع
            </div>
            <div style="background:var(--bg3);padding:12px;border-radius:12px;margin-bottom:16px">
                <div><strong>اسم البنك:</strong> الرافدين</div>
                <div><strong>اسم المستفيد:</strong> VaultX Exchange</div>
                <div><strong>رقم الحساب:</strong> 123456789012</div>
                <div><strong>الآي بان (IBAN):</strong> IQ98RAFB123456789012</div>
            </div>
            
            <div class="form-group">
                <label class="form-label">المبلغ بـ GCO</label>
                <input type="number" id="depositAmount" class="form-input" placeholder="مثال: 100">
            </div>
            <div class="form-group">
                <label class="form-label">رقم العملية / الإيصال</label>
                <input type="text" id="depositTransactionId" class="form-input" placeholder="رقم التحويل">
            </div>
            <div class="form-group">
                <label class="form-label">اسم المحول</label>
                <input type="text" id="depositSenderName" class="form-input" placeholder="اسمك الكامل">
            </div>
            <div class="form-group">
                <label class="form-label">صورة الإيصال</label>
                <div class="img-upload" id="depositImageUpload">
                    <input type="file" accept="image/*" id="depositImageInput">
                    <span>📷 اضغط لرفع صورة الإيصال</span>
                </div>
            </div>
            <button class="btn btn-primary btn-full" onclick="submitDeposit()">إرسال طلب الشحن</button>
        </div>
        
        <div class="section-title">طلبات الشحن السابقة</div>
        ${pendingDeposits.length === 0 && approvedDeposits.length === 0 ? '<div class="empty-state">لا توجد طلبات سابقة</div>' : ''}
        
        ${pendingDeposits.length > 0 ? `
            <div style="margin-bottom:16px">
                <div style="font-size:0.8rem;color:var(--gold);margin-bottom:8px">⏳ قيد المراجعة</div>
                ${pendingDeposits.map(d => `
                    <div class="list-item">
                        <div class="list-item-content">
                            <div class="list-item-title">${d.amount} GCO (${(d.amount * 1000).toLocaleString()} دينار)</div>
                            <div class="list-item-sub">رقم العملية: ${d.transaction_id}</div>
                            <div class="list-item-sub">${new Date(d.created_at * 1000).toLocaleDateString('ar')}</div>
                        </div>
                        <div class="badge blue">قيد الانتظار</div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
        
        ${approvedDeposits.length > 0 ? `
            <div>
                <div style="font-size:0.8rem;color:var(--green);margin-bottom:8px">✓ تم الموافقة</div>
                ${approvedDeposits.map(d => `
                    <div class="list-item">
                        <div class="list-item-content">
                            <div class="list-item-title">${d.amount} GCO (${(d.amount * 1000).toLocaleString()} دينار)</div>
                            <div class="list-item-sub">تمت الموافقة بتاريخ ${new Date(d.created_at * 1000).toLocaleDateString('ar')}</div>
                        </div>
                        <div class="badge green">مكتمل</div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    document.getElementById('page-deposit').innerHTML = html;
    
    // إعداد رفع الصورة
    document.getElementById('depositImageInput').onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(ev) {
                const uploadDiv = document.getElementById('depositImageUpload');
                uploadDiv.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover">`;
                window.depositImageBase64 = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
    };
}

// عرض صفحة الإدارة (لأدمن فقط)
async function renderAdmin() {
    // جلب الإحصائيات
    const statsRes = await fetch('/api/admin/get_stats.php');
    const statsData = await statsRes.json();
    
    // جلب طلبات العملات
    const requestsRes = await fetch('/api/admin/get_requests.php');
    const requestsData = await requestsRes.json();
    
    // جلب طلبات الشحن
    const depositsRes = await fetch('/api/admin/get_deposits.php');
    const depositsData = await depositsRes.json();
    
    // جلب المستخدمين
    const usersRes = await fetch('/api/admin/get_users.php');
    const usersData = await usersRes.json();
    
    const html = `
        <div class="section-title">لوحة التحكم</div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${statsData.stats?.total_users || 0}</div>
                <div class="stat-label">المستخدمين</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statsData.stats?.total_currencies || 0}</div>
                <div class="stat-label">العملات</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statsData.stats?.pending_requests || 0}</div>
                <div class="stat-label">طلبات عملات</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statsData.stats?.pending_deposits || 0}</div>
                <div class="stat-label">طلبات شحن</div>
            </div>
        </div>
        
        <div class="section-title">طلبات إنشاء العملات</div>
        ${requestsData.requests?.length === 0 ? '<div class="empty-state">لا توجد طلبات</div>' : requestsData.requests?.map(req => `
            <div class="request-card">
                <div class="request-header">
                    <strong>${req.name} (${req.symbol})</strong>
                    <span class="badge blue">قيد المراجعة</span>
                </div>
                <div style="font-size:0.8rem;margin-bottom:8px">الكمية: ${parseFloat(req.total_supply).toLocaleString()} | المنشئ: ${req.creator_name}</div>
                <div class="request-actions">
                    <button class="btn btn-success" onclick="approveCurrency(${req.id})">موافقة</button>
                    <button class="btn btn-danger" onclick="rejectCurrency(${req.id})">رفض</button>
                </div>
            </div>
        `).join('')}
        
        <div class="section-title">طلبات الشحن</div>
        ${depositsData.deposits?.length === 0 ? '<div class="empty-state">لا توجد طلبات</div>' : depositsData.deposits?.map(dep => `
            <div class="request-card">
                <div class="request-header">
                    <strong>${dep.amount} GCO (${(dep.amount * 1000).toLocaleString()} دينار)</strong>
                    <span class="badge blue">قيد المراجعة</span>
                </div>
                <div style="font-size:0.8rem;margin-bottom:8px">
                    المستخدم: ${dep.user_name}<br>
                    رقم العملية: ${dep.transaction_id}<br>
                    المحول: ${dep.sender_name}
                </div>
                ${dep.receipt_image ? `<div style="margin-bottom:8px"><a href="${dep.receipt_image}" target="_blank" style="color:var(--accent)">📷 عرض الإيصال</a></div>` : ''}
                <div class="request-actions">
                    <button class="btn btn-success" onclick="approveDeposit(${dep.id})">موافقة</button>
                </div>
            </div>
        `).join('')}
        
        <div class="section-title">المستخدمين</div>
        ${usersData.users?.slice(0, 10).map(user => `
            <div class="list-item">
                <div class="list-item-content">
                    <div class="list-item-title">${user.name} ${user.is_admin ? '(مدير)' : ''}</div>
                    <div class="list-item-sub">ID: ${user.id} | منذ: ${new Date(user.created_at * 1000).toLocaleDateString()}</div>
                </div>
                <div class="list-item-right">
                    <div class="list-item-amount">${user.total_balance} GCO</div>
                </div>
            </div>
        `).join('')}
    `;
    
    document.getElementById('page-admin').innerHTML = html;
}

// عرض تفاصيل العملة
async function showCurrencyDetail(currencyId) {
    const response = await fetch(`/api/get_currency_detail.php?id=${currencyId}`);
    const data = await response.json();
    
    if (!data.success) {
        showToast('خطأ في تحميل البيانات', 'error');
        return;
    }
    
    const currency = data.currency;
    const userBalance = data.user_balance;
    const isOwner = currency.created_by == currentUser.id;
    const changeClass = currency.price_change >= 0 ? 'up' : 'down';
    const changeSign = currency.price_change >= 0 ? '+' : '';
    
    const html = `
        <div style="text-align:center;margin-bottom:20px">
            <div class="currency-icon-placeholder" style="width:60px;height:60px;margin:0 auto 12px;font-size:1.5rem">
                ${currency.symbol.charAt(0)}
            </div>
            <div style="font-size:1.2rem;font-weight:700">${currency.name}</div>
            <div style="font-size:0.8rem;color:var(--text2)">${currency.symbol}</div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${currency.price_display}</div>
                <div class="stat-label">السعر (${currency.symbol})</div>
            </div>
            <div class="stat-card">
                <div class="stat-value ${changeClass}">${changeSign}${currency.price_change}%</div>
                <div class="stat-label">التغير</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${parseFloat(currency.total_supply).toLocaleString()}</div>
                <div class="stat-label">الكمية الكلية</div>
            </div>
        </div>
        
        <div class="list-item" style="margin-bottom:16px">
            <div class="list-item-content">
                <div class="list-item-title">رصيدك</div>
                <div class="list-item-sub">قيمة بـ GCO: ${(userBalance * currency.price).toFixed(4)}</div>
            </div>
            <div class="list-item-amount" style="color:var(--accent)">${userBalance.toFixed(4)} ${currency.symbol}</div>
        </div>
        
        <div class="mini-chart" id="priceChart" style="height:80px;margin-bottom:20px"></div>
        
        <div style="display:flex;gap:10px;margin-bottom:20px">
            <button class="btn btn-primary" style="flex:1" onclick="closeModal('currencyDetailModal');openSendForCurrency('${currency.id}')">📤 إرسال</button>
            ${isOwner ? `<button class="btn btn-gold" style="flex:1" onclick="closeModal('currencyDetailModal');openLiquidityForCurrency('${currency.id}')">💧 إضافة سيولة</button>` : ''}
        </div>
        
        <div class="section-title" style="font-size:0.9rem">آخر المعاملات</div>
        ${data.recent_transactions?.length === 0 ? '<div class="empty-state">لا توجد معاملات</div>' : data.recent_transactions?.map(tx => `
            <div class="list-item" style="padding:10px">
                <div class="list-item-content">
                    <div class="list-item-title">${tx.from_user_id == currentUser.id ? 'إرسال إلى' : 'استلام من'} ${tx.from_user_id == currentUser.id ? tx.to_name : tx.from_name}</div>
                    <div class="list-item-sub">${new Date(tx.ts * 1000).toLocaleString('ar')}</div>
                </div>
                <div class="list-item-amount" style="color:${tx.from_user_id == currentUser.id ? 'var(--red)' : 'var(--green)'}">
                    ${tx.from_user_id == currentUser.id ? '-' : '+'}${tx.amount}
                </div>
            </div>
        `).join('')}
    `;
    
    document.getElementById('currencyDetailContent').innerHTML = html;
    openModal('currencyDetailModal');
    
    // رسم الرسم البياني
    if (currency.price_history && currency.price_history.length > 0) {
        const max = Math.max(...currency.price_history);
        const min = Math.min(...currency.price_history);
        const range = max - min || 1;
        
        const bars = currency.price_history.map(v => {
            const height = ((v - min) / range * 60) + 10;
            return `<div class="chart-bar" style="height:${height}%"></div>`;
        }).join('');
        
        document.getElementById('priceChart').innerHTML = bars;
    }
}

// دوال مساعدة
function renderTransaction(tx) {
    const currency = allCurrencies.find(c => c.id === tx.currency_id);
    const isSent = tx.from_user_id == currentUser.id;
    const otherName = isSent ? `المستلم ${tx.to_user_id}` : `المرسل ${tx.from_user_id}`;
    const color = isSent ? 'var(--red)' : 'var(--green)';
    const sign = isSent ? '-' : '+';
    
    return `
        <div class="list-item">
            <div class="list-item-content">
                <div class="list-item-title">${isSent ? 'إرسال' : 'استلام'} ${currency?.name || 'عملة'}</div>
                <div class="list-item-sub">${otherName} ${tx.note ? '· ' + tx.note : ''}</div>
                <div class="list-item-sub">${new Date(tx.ts * 1000).toLocaleString('ar')}</div>
            </div>
            <div class="list-item-right">
                <div class="list-item-amount" style="color:${color}">${sign} ${tx.amount} ${currency?.symbol || ''}</div>
            </div>
        </div>
    `;
}

// إرسال عملة
async function sendCurrency() {
    const currencyId = document.getElementById('sendCurrency').value;
    const toUserId = parseInt(document.getElementById('sendToUserId').value);
    const amount = parseFloat(document.getElementById('sendAmount').value);
    const note = document.getElementById('sendNote').value;
    
    if (!currencyId || !toUserId || !amount || amount <= 0) {
        showToast('الرجاء تعبئة جميع الحقول', 'error');
        return;
    }
    
    const response = await fetch('/api/send.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_user_id: toUserId, currency_id: currencyId, amount, note })
    });
    
    const data = await response.json();
    if (data.success) {
        showToast('تم الإرسال بنجاح', 'success');
        closeModal('sendModal');
        await loadData();
    } else {
        showToast(data.error, 'error');
    }
}

// إنشاء عملة
async function createCurrency() {
    const name = document.getElementById('newCurrencyName').value;
    const symbol = document.getElementById('newCurrencySymbol').value.toUpperCase();
    const totalSupply = parseFloat(document.getElementById('newCurrencySupply').value);
    const description = document.getElementById('newCurrencyDesc').value;
    
    if (!name || !symbol || !totalSupply || totalSupply <= 0) {
        showToast('الرجاء تعبئة جميع الحقول', 'error');
        return;
    }
    
    const response = await fetch('/api/create_currency.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, symbol, total_supply: totalSupply, description, image: selectedImageBase64 })
    });
    
    const data = await response.json();
    if (data.success) {
        showToast(data.message, 'success');
        closeModal('createCurrencyModal');
        await loadData();
        
        // تفريغ الحقول
        document.getElementById('newCurrencyName').value = '';
        document.getElementById('newCurrencySymbol').value = '';
        document.getElementById('newCurrencySupply').value = '1000000';
        document.getElementById('newCurrencyDesc').value = '';
        document.getElementById('currencyImageUpload').innerHTML = `
            <input type="file" accept="image/*" id="currencyImageInput">
            <span>📷 اضغط لرفع صورة</span>
        `;
        selectedImageBase64 = null;
    } else {
        showToast(data.error, 'error');
    }
}

// إضافة سيولة
async function addLiquidity() {
    const currencyId = document.getElementById('liquidityCurrency').value;
    const amount = parseFloat(document.getElementById('liquidityAmount').value);
    
    if (!currencyId || !amount || amount <= 0) {
        showToast('الرجاء إدخال مبلغ صحيح', 'error');
        return;
    }
    
    const response = await fetch('/api/add_liquidity.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency_id: currencyId, amount })
    });
    
    const data = await response.json();
    if (data.success) {
        showToast('تمت إضافة السيولة بنجاح', 'success');
        closeModal('addLiquidityModal');
        await loadData();
    } else {
        showToast(data.error, 'error');
    }
}

// طلب شحن
async function submitDeposit() {
    const amount = parseFloat(document.getElementById('depositAmount').value);
    const transactionId = document.getElementById('depositTransactionId').value;
    const senderName = document.getElementById('depositSenderName').value;
    const imageBase64 = window.depositImageBase64;
    
    if (!amount || amount <= 0 || !transactionId || !senderName || !imageBase64) {
        showToast('الرجاء تعبئة جميع الحقول ورفع الإيصال', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('amount', amount);
    formData.append('transaction_id', transactionId);
    formData.append('sender_name', senderName);
    
    // تحويل base64 إلى ملف
    const blob = await (await fetch(imageBase64)).blob();
    formData.append('receipt_image', blob, 'receipt.jpg');
    
    const response = await fetch('/api/deposit.php', {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    if (data.success) {
        showToast(data.message, 'success');
        document.getElementById('depositAmount').value = '';
        document.getElementById('depositTransactionId').value = '';
        document.getElementById('depositSenderName').value = '';
        document.getElementById('depositImageUpload').innerHTML = `
            <input type="file" accept="image/*" id="depositImageInput">
            <span>📷 اضغط لرفع صورة الإيصال</span>
        `;
        window.depositImageBase64 = null;
        await loadData();
    } else {
        showToast(data.error, 'error');
    }
}

// دوال إدارية
async function approveCurrency(requestId) {
    const response = await fetch('/api/admin/approve_currency.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId })
    });
    
    const data = await response.json();
    if (data.success) {
        showToast('تمت الموافقة على العملة', 'success');
        await loadData();
        renderAdmin();
    }
}

async function rejectCurrency(requestId) {
    const response = await fetch('/api/admin/reject_currency.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId })
    });
    
    const data = await response.json();
    if (data.success) {
        showToast('تم رفض الطلب', 'info');
        renderAdmin();
    }
}

async function approveDeposit(depositId) {
    const response = await fetch('/api/admin/approve_deposit.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deposit_id: depositId })
    });
    
    const data = await response.json();
    if (data.success) {
        showToast('تمت الموافقة على الشحن', 'success');
        await loadData();
        renderAdmin();
    }
}

// دوال واجهة
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`page-${page}`).classList.add('active');
    const clickedBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => btn.getAttribute('data-page') === page);
    if (clickedBtn) clickedBtn.classList.add('active');
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function openSendModal() {
    const select = document.getElementById('sendCurrency');
    const myCurrencies = userBalances.filter(b => b.amount > 0);
    
    select.innerHTML = myCurrencies.map(b => {
        const currency = allCurrencies.find(c => c.id === b.currency_id);
        return `<option value="${b.currency_id}">${currency?.name} (${currency?.symbol}) - الرصيد: ${b.amount}</option>`;
    }).join('');
    
    openModal('sendModal');
}

function openSendForCurrency(currencyId) {
    openSendModal();
    setTimeout(() => {
        document.getElementById('sendCurrency').value = currencyId;
    }, 100);
}

function openCreateCurrencyModal() {
    openModal('createCurrencyModal');
    
    document.getElementById('currencyImageInput').onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(ev) {
                const uploadDiv = document.getElementById('currencyImageUpload');
                uploadDiv.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover">`;
                selectedImageBase64 = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
    };
}

function openLiquidityForCurrency(currencyId) {
    const select = document.getElementById('liquidityCurrency');
    const myCurrencies = allCurrencies.filter(c => c.created_by == currentUser.id && !c.is_main);
    
    select.innerHTML = myCurrencies.map(c => 
        `<option value="${c.id}">${c.name} (${c.symbol}) - السعر: ${c.price_display}</option>`
    ).join('');
    
    if (currencyId) {
        select.value = currencyId;
    }
    
    document.getElementById('liquidityAmount').value = '';
    document.getElementById('liquidityPreview').style.display = 'none';
    
    document.getElementById('liquidityAmount').oninput = function() {
        const amount = parseFloat(this.value);
        const currency = myCurrencies.find(c => c.id === select.value);
        if (amount && currency && currency.circulating_supply > 0) {
            const newPrice = (currency.liquidity + amount) / currency.circulating_supply;
            document.getElementById('liquidityPreview').style.display = 'block';
            document.getElementById('liquidityPreview').innerHTML = `
                السعر المتوقع بعد الإضافة: ${newPrice.toFixed(8)} ${currency.symbol}<br>
                زيادة بنسبة: ${(((newPrice - currency.price) / currency.price) * 100).toFixed(2)}%
            `;
        } else {
            document.getElementById('liquidityPreview').style.display = 'none';
        }
    };
    
    openModal('addLiquidityModal');
}

function setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');
            if (page) showPage(page);
        });
    });
    
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
}

// بدء التطبيق
init();