// Detect if running locally or on deployed site
const hostname = window.location.hostname;
const IS_VERCEL = hostname.includes('vercel.app');
const IS_LOCAL = !IS_VERCEL && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.'));

// 🔴 YOUR RENDER BACKEND URL
const PROD_BACKEND_URL = 'https://vendor-qr-system-1.onrender.com';

// API endpoint (REST)
const API_URL = IS_LOCAL
    ? `http://${hostname}:8000`
    : PROD_BACKEND_URL;

// WebSocket endpoint (Real-time updates)
const WS_URL = IS_LOCAL
    ? `ws://${hostname}:8000/ws`
    : PROD_BACKEND_URL.replace('https', 'wss').replace('http', 'ws') + '/ws';

let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentCategory = 'All';
let menuSearchQuery = '';
let menuQuickFilter = 'all';
let selectedPayment = 'Cash';

// --- TABLE IDENTIFICATION & SESSION HELPERS ---
function getTableNumber() {
    const urlParams = new URLSearchParams(window.location.search);
    const tableParam = urlParams.get('table');
    if (tableParam) {
        const parsed = parseInt(tableParam);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 7) {
            sessionStorage.setItem('table_number', parsed);
            localStorage.setItem('table_number', parsed);
            return parsed;
        }
    }
    const saved = sessionStorage.getItem('table_number') || localStorage.getItem('table_number');
    if (saved) {
        const parsed = parseInt(saved);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 7) {
            return parsed;
        }
    }
    return 1;
}

function goBackToMenu() {
    const tableNum = getTableNumber();
    window.location.href = `menu.html?table=${tableNum}`;
}

function goToCart() {
    const tableNum = getTableNumber();
    window.location.href = `cart.html?table=${tableNum}`;
}

// --- SHARED UTILS ---

const MENU_IMAGE_OVERRIDES = {
    'F&F Pizza': 'supreme_symphony_pizza_item_1773810880152.png',
    'Hot Shot Burger': 'mexi_zing_burger_item_1773810830391.png',
    'Paneer Tikka Burger': 'crispy_paneer_burger_item_1773810860006.png'
};

const DEFAULT_CATEGORY_IMAGES = [
    ['Appetizers Non-Veg', 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=640&q=80'],
    ['Appetizers Veg', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=640&q=80'],
    ['Tandoors & Grills', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=640&q=80'],
    ['Salads', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=640&q=80'],
    ['Sides', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=640&q=80'],
    ['Burgers Non-Veg', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=640&q=80'],
    ['Burgers Veg', 'https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=640&q=80'],
    ['Sandwiches', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=640&q=80'],
    ['Chinese Court', 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=640&q=80'],
    ['Continental Court', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=640&q=80'],
    ['Soup', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=640&q=80'],
    ['Indian Gravies', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=640&q=80'],
    ['Indian Rice', 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=640&q=80'],
    ['Wrap', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=640&q=80'],
    ['Omelets', 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=640&q=80'],
    ['Juices and Mocktails', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=640&q=80'],
    ['Smoothies', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=640&q=80'],
    ['Desserts', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=640&q=80'],
    ['French Delicacies', 'https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=640&q=80'],
    ['Beverages', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=640&q=80'],
    ['Add Ons', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=640&q=80']
];

const FALLBACK_MENU_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=640&q=80';

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function getImageUrl(item) {
    const categoryImage = DEFAULT_CATEGORY_IMAGES.find(([category]) => item.category?.startsWith(category))?.[1];
    const suppliedImage = item.image_url && item.image_url !== 'string' ? item.image_url : '';
    const imageUrl = suppliedImage || MENU_IMAGE_OVERRIDES[item.name] || categoryImage || FALLBACK_MENU_IMAGE;
    if (!imageUrl) return '';
    return (imageUrl.startsWith('http') || imageUrl.startsWith('data:'))
        ? imageUrl
        : `images/${imageUrl}`;
}

function getCategoryIcon(category) {
    const iconMap = [
        [/^All$/, '🍽️'],
        [/Burger/i, '🍔'],
        [/Pizza/i, '🍕'],
        [/Wrap/i, '🌯'],
        [/Sandwich|Toast/i, '🥪'],
        [/Appetizer|Sides/i, '🍟'],
        [/Tandoor|Grill/i, '🔥'],
        [/Salad/i, '🥗'],
        [/Chinese|Noodle|Rice/i, '🍜'],
        [/Continental|Pasta/i, '🍝'],
        [/Soup/i, '🍲'],
        [/Indian|Gravies/i, '🍛'],
        [/Omelet/i, '🍳'],
        [/Juice|Mocktail|Smoothie|Beverage|Coffee|Tea/i, '🥤'],
        [/Dessert|French/i, '🍨'],
        [/Add Ons/i, '➕']
    ];
    const match = iconMap.find(([pattern]) => pattern.test(category));
    return match ? match[1] : '🥘';
}

function getDietType(item) {
    const text = `${item.category || ''} ${item.name || ''}`.toLowerCase();
    if (text.includes('non-veg') || text.includes('chicken') || text.includes('fish') || text.includes('prawn') || text.includes('egg')) {
        return 'nonveg';
    }
    return 'veg';
}

function isPopularItem(item) {
    const popularNames = window.popularItemNames || [];
    return popularNames.includes(item.name) || /burger|pizza|combo|f&f|special|signature/i.test(item.name || '');
}

function updateLocalStorage() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// --- MENU PAGE LOGIC ---

async function loadMenu() {
    try {
        const tableNum = getTableNumber();
        const tableLabel = document.getElementById('current-table-label');
        if (tableLabel) tableLabel.innerText = `Ordering for Table ${tableNum}`;

        const response = await fetch(`${API_URL}/menu`);
        if (!response.ok) throw new Error('Failed to fetch menu');
        const items = await response.json();
        window.menuItems = items;
        renderCategories(items);
        applyCustomerMenuView();

        // Fetch wait time
        const waitRes = await fetch(`${API_URL}/wait-time`);
        const waitData = await waitRes.json();
        const waitEl = document.getElementById('menu-wait-time');
        if (waitEl) waitEl.querySelector('span:last-child').innerText = `Wait: ~${waitData.estimated_wait_minutes} mins`;
        
        // Fetch active session running bill for this table
        try {
            const sessRes = await fetch(`${API_URL}/tables/${tableNum}/session`);
            if (sessRes.ok) {
                const sessData = await sessRes.json();
                const runningBar = document.getElementById('table-running-bar');
                if (runningBar) {
                    if (sessData.has_active_session && sessData.total_amount > 0) {
                        const tableBarNum = document.getElementById('table-bar-number');
                        const tableRunAmt = document.getElementById('table-running-amount');
                        if (tableBarNum) tableBarNum.innerText = `Table ${tableNum}`;
                        if (tableRunAmt) tableRunAmt.innerText = `₹${sessData.total_amount}`;
                        runningBar.style.display = 'flex';
                    } else {
                        runningBar.style.display = 'none';
                    }
                }
            }
        } catch (e) {
            console.warn("Could not check table session", e);
        }

        updateLoyaltyUI();
        loadTopItems();
    } catch (err) {
        console.error(err);
        document.getElementById('menu-container').innerHTML = '<p style="text-align:center; padding:20px;">Could not load menu. Make sure the backend is running.</p>';
    }
}

function createFoodCard(item) {
    const finalImageUrl = getImageUrl(item);
    const categoryIcon = getCategoryIcon(item.category);
    const description = item.description || item.category;
    const isAvailable = item.is_available;
    const dietType = getDietType(item);

    const card = document.createElement('div');
    card.className = `food-card animate-fade-in ${!isAvailable ? 'sold-out' : ''}`;
    card.onclick = () => openFoodDetail(item.id);
    card.innerHTML = `
        <div class="food-img-container">
            ${finalImageUrl
                ? `<img src="${escapeHtml(finalImageUrl)}" class="food-img" alt="${escapeHtml(item.name)}">`
                : `<div class="food-img-placeholder"><span>${categoryIcon}</span></div>`
            }
            <div class="diet-badge diet-${dietType}">${dietType === 'veg' ? 'VEG' : 'NON-VEG'}</div>
            <div class="availability-badge ${isAvailable ? 'badge-available' : 'badge-soldout'}">
                <span class="badge-dot"></span>
                ${isAvailable ? 'AVAILABLE' : 'OUT OF STOCK'}
            </div>
        </div>
        <div class="food-details">
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(description)}</p>
        </div>
        <div class="food-card-footer">
            <span class="food-price">₹${item.price}</span>
            ${isAvailable ? `
                <div class="add-btn" onclick="addToCart(${item.id}, event)" title="Add to cart">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </div>
            ` : `
                <div class="add-btn disabled" title="Currently unavailable">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
            `}
        </div>
    `;
    return card;
}

function getFilteredMenuItems() {
    let items = [...(window.menuItems || [])];
    const query = menuSearchQuery.trim().toLowerCase();

    if (currentCategory !== 'All') {
        items = items.filter(item => item.category === currentCategory);
    }

    if (query) {
        items = items.filter(item =>
            (item.name || '').toLowerCase().includes(query) ||
            (item.description || '').toLowerCase().includes(query) ||
            (item.category || '').toLowerCase().includes(query)
        );
    }

    if (menuQuickFilter === 'veg') {
        items = items.filter(item => getDietType(item) === 'veg');
    } else if (menuQuickFilter === 'nonveg') {
        items = items.filter(item => getDietType(item) === 'nonveg');
    } else if (menuQuickFilter === 'under200') {
        items = items.filter(item => Number(item.price) <= 200);
    } else if (menuQuickFilter === 'popular') {
        items = items.filter(isPopularItem);
    }

    return items;
}

function applyCustomerMenuView() {
    renderMenu(getFilteredMenuItems());
    document.querySelectorAll('.category-pill').forEach(t => {
        t.classList.toggle('active', t.dataset.category === currentCategory);
    });
}

function renderMenu(items) {
    const container = document.getElementById('menu-container');
    if (!container) return;

    container.innerHTML = '';

    const categories = [...new Set(items.map(i => i.category))];
    categories.forEach(cat => {
        const catItems = items.filter(i => i.category === cat);
        if (catItems.length === 0) return;

        const header = document.createElement('div');
        header.id = `category-${cat.replace(/[^a-zA-Z0-9]/g, '-')}`;
        header.style.gridColumn = '1 / -1';
        header.style.marginTop = '25px';
        header.style.marginBottom = '10px';
        header.style.borderBottom = '2px solid rgba(255, 94, 0, 0.1)';
        header.style.paddingBottom = '10px';
        header.innerHTML = `<h2 style="font-size: 1.4rem; color: var(--primary); display: flex; align-items: center; gap: 8px;"><span>${getCategoryIcon(cat)}</span> ${escapeHtml(cat)}</h2>`;
        container.appendChild(header);

        catItems.forEach(item => {
            container.appendChild(createFoodCard(item));
        });
    });
}

function renderCategories(items) {
    const container = document.getElementById('category-tabs');
    if (!container) return;

    // Get unique categories
    const categories = ['All', ...new Set(items.map(i => i.category))];

    container.innerHTML = categories.map(cat => `
        <div class="category-pill ${cat === currentCategory ? 'active' : ''}" data-category="${escapeHtml(cat)}" onclick='filterMenu(${JSON.stringify(cat).replace(/'/g, "&#39;")})'>
            <span>${getCategoryIcon(cat)}</span> ${escapeHtml(cat)}
        </div>
    `).join('');
}

function filterMenu(category) {
    currentCategory = category;
    document.querySelectorAll('.category-pill').forEach(t => {
        const isActive = t.dataset.category === category;
        t.classList.toggle('active', isActive);
        if (isActive) t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });

    applyCustomerMenuView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function searchMenu(query) {
    menuSearchQuery = query || '';
    applyCustomerMenuView();
}

function setMenuQuickFilter(filter, btn) {
    menuQuickFilter = filter;
    document.querySelectorAll('.quick-filter').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    applyCustomerMenuView();
}

function addToCart(itemId, event, quantity = 1) {
    if (event) event.stopPropagation();
    const item = window.menuItems.find(i => i.id === itemId);
    if (!item || !item.is_available) return;
    const existing = cart.find(c => c.id === itemId);

    // Animation: Fly to cart
    if (event) {
        const btn = event.currentTarget || event.target;
        const img = btn.closest('.food-card').querySelector('.food-img');
        if (img) animateFlyToCart(img);
    }

    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({ ...item, quantity });
    }

    updateLocalStorage();
    updateCartUI();
    showToast(`Added ${quantity} x ${item.name} to cart`);

    // Smart Suggestion
    showSuggestions(item);
}

function animateFlyToCart(img) {
    const cartBubble = document.getElementById('cart-float');
    if (!cartBubble) return;

    const clone = img.cloneNode();
    const rect = img.getBoundingClientRect();
    const cartRect = cartBubble.getBoundingClientRect();

    clone.classList.add('flying-img');
    clone.style.top = `${rect.top}px`;
    clone.style.left = `${rect.left}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;

    document.body.appendChild(clone);

    setTimeout(() => {
        clone.style.top = `${cartRect.top + 10}px`;
        clone.style.left = `${cartRect.left + 10}px`;
        clone.style.width = '20px';
        clone.style.height = '20px';
        clone.style.opacity = '0';
    }, 10);

    setTimeout(() => {
        clone.remove();
        cartBubble.classList.add('bounce');
        setTimeout(() => cartBubble.classList.remove('bounce'), 500);
    }, 800);
}

function openFoodDetail(itemId) {
    const item = (window.menuItems || []).find(i => i.id === itemId);
    const overlay = document.getElementById('item-detail-overlay');
    const modal = document.getElementById('item-detail-modal');
    if (!item || !overlay || !modal) return;

    const finalImageUrl = getImageUrl(item);
    const dietType = getDietType(item);
    const suggestions = getSuggestedItems(item, 3);

    modal.innerHTML = `
        <button type="button" class="detail-close" onclick="closeItemDetail()">&times;</button>
        <div class="detail-media">
            ${finalImageUrl
                ? `<img src="${escapeHtml(finalImageUrl)}" alt="${escapeHtml(item.name)}">`
                : `<div class="detail-placeholder">${getCategoryIcon(item.category)}</div>`
            }
        </div>
        <div class="detail-body">
            <div class="detail-tags">
                <span class="diet-badge static diet-${dietType}">${dietType === 'veg' ? 'VEG' : 'NON-VEG'}</span>
                <span>${escapeHtml(item.category)}</span>
                ${isPopularItem(item) ? '<span>Popular</span>' : ''}
            </div>
            <h2>${escapeHtml(item.name)}</h2>
            <p>${escapeHtml(item.description || item.category)}</p>
            <div class="detail-price-row">
                <strong>₹${item.price}</strong>
                <div class="detail-qty">
                    <button type="button" onclick="changeDetailQty(-1)">-</button>
                    <span id="detail-qty-value">1</span>
                    <button type="button" onclick="changeDetailQty(1)">+</button>
                </div>
            </div>
            ${suggestions.length ? `
                <div class="detail-pairings">
                    <span>Pairs well with</span>
                    <div>
                        ${suggestions.map(s => `<button type="button" onclick="addToCart(${s.id}, event)">${escapeHtml(s.name)} · ₹${s.price}</button>`).join('')}
                    </div>
                </div>
            ` : ''}
            <button type="button" class="detail-add-btn" ${item.is_available ? '' : 'disabled'} onclick="addDetailItemToCart(${item.id}, event)">
                ${item.is_available ? 'Add to Cart' : 'Currently Unavailable'}
            </button>
        </div>
    `;
    overlay.style.display = 'flex';
}

function closeItemDetail() {
    const overlay = document.getElementById('item-detail-overlay');
    if (overlay) overlay.style.display = 'none';
}

function changeDetailQty(delta) {
    const el = document.getElementById('detail-qty-value');
    if (!el) return;
    const next = Math.max(1, Math.min(20, parseInt(el.innerText || '1') + delta));
    el.innerText = next;
}

function addDetailItemToCart(itemId, event) {
    const qtyEl = document.getElementById('detail-qty-value');
    const quantity = Math.max(1, parseInt(qtyEl?.innerText || '1'));
    addToCart(itemId, event, quantity);
    closeItemDetail();
}

function getSuggestedItems(addedItem, limit = 2) {
    const items = (window.menuItems || []).filter(i => i.id !== addedItem.id && i.is_available);
    const addedCategory = (addedItem.category || '').toLowerCase();

    let preferred = [];
    if (/burger|wrap|sandwich|pizza|tandoor|grill|chinese|continental|indian/.test(addedCategory)) {
        preferred = items.filter(i => /beverage|juice|mocktail|smoothie|dessert|add ons|sides/i.test(i.category || ''));
    } else if (/beverage|juice|mocktail|smoothie/.test(addedCategory)) {
        preferred = items.filter(i => /burger|sandwich|wrap|sides|appetizers/i.test(i.category || ''));
    } else if (/dessert/.test(addedCategory)) {
        preferred = items.filter(i => /beverage|coffee|tea|smoothie/i.test(`${i.category} ${i.name}`));
    }

    const fallback = items.filter(isPopularItem);
    return [...preferred, ...fallback]
        .filter((item, index, arr) => arr.findIndex(i => i.id === item.id) === index)
        .slice(0, limit);
}

function showSuggestions(addedItem) {
    const overlay = document.getElementById('suggestion-overlay');
    if (!overlay) return;

    const container = document.getElementById('suggestion-list');
    container.innerHTML = '';

    const suggestions = getSuggestedItems(addedItem, 2);

    if (suggestions.length === 0) return;

    suggestions.forEach(s => {
        const finalImageUrl = getImageUrl(s);

        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `
            ${finalImageUrl
                ? `<img src="${escapeHtml(finalImageUrl)}" class="suggestion-img" alt="${escapeHtml(s.name)}">`
                : `<div class="suggestion-img suggestion-img-placeholder">${getCategoryIcon(s.category)}</div>`
            }
            <div style="flex:1;">
                <h4 style="font-size:0.9rem;">${escapeHtml(s.name)}</h4>
                <p style="font-size:0.8rem; color:var(--primary); font-weight:700;">₹${s.price}</p>
            </div>
            <button onclick="addToCart(${s.id}); closeSuggestions();" class="add-btn" style="width:32px; height:32px;">+</button>
        `;
        container.appendChild(div);
    });

    overlay.style.display = 'flex';
}

function closeSuggestions() {
    const overlay = document.getElementById('suggestion-overlay');
    if (overlay) overlay.style.display = 'none';
}

function updateCartUI() {
    const floatBar = document.getElementById('cart-float');
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.style.display = totalQty > 0 ? 'inline-flex' : 'none';
        cartCount.innerText = totalQty;
    }
    if (!floatBar) return;

    if (totalQty > 0) {
        floatBar.style.display = 'flex';
        floatBar.innerHTML = `
            <div class="cart-drawer-summary">
                <span id="float-qty-bubble">${totalQty}</span>
                <div>
                    <strong>${totalQty} item${totalQty === 1 ? '' : 's'} in cart</strong>
                    <span>₹${totalPrice} total</span>
                </div>
            </div>
            <button type="button">Checkout</button>
        `;
    } else {
        floatBar.style.display = 'none';
    }
}

// --- CART PAGE LOGIC ---

function renderCartPage() {
    const tableNum = getTableNumber();
    const cartTableLabel = document.getElementById('cart-table-label');
    if (cartTableLabel) cartTableLabel.innerText = `Table ${tableNum}`;

    const container = document.getElementById('cart-items-container');
    const emptyMsg = document.getElementById('empty-cart');
    const summary = document.getElementById('cart-summary');

    if (!container) return;

    if (cart.length === 0) {
        container.style.display = 'none';
        summary.style.display = 'none';
        emptyMsg.style.display = 'block';
        return;
    }

    container.innerHTML = '';
    emptyMsg.style.display = 'none';
    summary.style.display = 'block';

    let total = 0;
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        const div = document.createElement('div');
        div.className = 'cart-item animate-fade-in';
        div.innerHTML = `
            <div>
                <h4 style="font-weight: 700;">${item.name}</h4>
                <p style="color: var(--primary); font-weight: 800; font-size: 0.9rem;">₹${item.price}</p>
            </div>
            <div class="qty-control">
                <button onclick="changeQty(${item.id}, -1)" class="qty-btn">-</button>
                <span style="font-weight: 800;">${item.quantity}</span>
                <button onclick="changeQty(${item.id}, 1)" class="qty-btn">+</button>
            </div>
        `;
        container.appendChild(div);
    });

    document.getElementById('subtotal').innerText = `₹${total}`;
    document.getElementById('total').innerText = `₹${total}`;
    document.querySelectorAll('.pay-amount').forEach(el => el.innerText = total);
}

function changeQty(id, delta) {
    const index = cart.findIndex(i => i.id === id);
    if (index === -1) return;

    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }

    updateLocalStorage();
    renderCartPage();
}

function selectPayment(method) {
    selectedPayment = method;
    document.getElementById('method-cash').classList.toggle('active', method === 'Cash');
    document.getElementById('method-upi').classList.toggle('active', method === 'UPI');
}

async function placeOrder() {
    if (cart.length === 0) return;

    const tableNum = getTableNumber();

    // If UPI is selected and we are NOT on the payment page yet, redirect there
    if (selectedPayment === 'UPI' && !window.location.href.includes('payment.html')) {
        const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        window.location.href = `payment.html?amount=${total}&table=${tableNum}`;
        return;
    }

    const btn = document.getElementById('place-order-btn') || document.getElementById('confirm-payment-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Placing Order...';
    }

    const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    // If we are on payment page, payment_method must be UPI
    const method = window.location.href.includes('payment.html') ? 'UPI' : selectedPayment;

    const payload = {
        table_number: tableNum,
        total_amount: total,
        payment_method: method,
        items: cart.map(i => ({ menu_item_id: i.id, quantity: i.quantity })),
        is_loyalty_boosted: parseInt(localStorage.getItem('loyalty_stamps') || '0') >= 5
    };

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to place order');
        
        if (response.ok) {
            const order = await response.json();
            
            // Loyalty Logic: Increment stamp count
            let stamps = parseInt(localStorage.getItem('loyalty_stamps') || '0');
            stamps = (stamps + 1) % 6; // Reset after 5 stamps
            localStorage.setItem('loyalty_stamps', stamps);
            
            // Clear cart
            cart = [];
            updateLocalStorage();

            window.location.href = `confirmation.html?id=${order.id}&table=${tableNum}`;
        }
    } catch (err) {
        console.error(err);
        alert('Could not place order. Please try again.');
        if (btn) {
            btn.disabled = false;
            btn.innerText = window.location.href.includes('payment.html') ? 'I Have Paid - Place Order' : 'Confirm & Place Order';
        }
    }
}

// --- CONFIRMATION PAGE LOGIC ---

async function trackOrder(orderId) {
    const updateProgress = (status) => {
        const steps = ['Pending', 'Preparing', 'Ready'];
        const line = document.querySelector('.tracker-line-progress');
        const currentIdx = steps.indexOf(status);

        if (line) line.style.width = `${(currentIdx / (steps.length - 1)) * 100}%`;

        document.querySelectorAll('.tracker-step').forEach((step, idx) => {
            step.classList.toggle('active', idx === currentIdx);
            step.classList.toggle('completed', idx < currentIdx);
        });
    };

    const updateUI = (order) => {
        document.getElementById('order-token').innerText = order.token_number;
        const statusEl = document.getElementById('order-status');
        statusEl.innerText = order.status;
        statusEl.className = `badge badge-${order.status.toLowerCase()}`;
        updateProgress(order.status);
        
        const tableNum = order.table_number || getTableNumber();
        const confTableLabel = document.getElementById('confirmation-table-label');
        if (confTableLabel) confTableLabel.innerText = `Table ${tableNum}`;

        // Fetch active session running bill for this table
        fetch(`${API_URL}/tables/${tableNum}/session`)
            .then(res => res.json())
            .then(sessData => {
                if (sessData.has_active_session && sessData.total_amount > 0) {
                    const sessBox = document.getElementById('confirmation-session-info');
                    const sessAmt = document.getElementById('confirmation-running-total');
                    if (sessBox && sessAmt) {
                        sessAmt.innerText = `₹${sessData.total_amount}`;
                        sessBox.style.display = 'block';
                    }
                }
            }).catch(() => {});

        // Reveal feedback section if order is completed
        if (order.status === 'Ready' || order.status === 'Delivered') {
            const feedbackSec = document.getElementById('feedback-section');
            if (feedbackSec) feedbackSec.style.display = 'block';
        }
    };

    // Initial load
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}`);
        const order = await res.json();
        updateUI(order);

        // Fetch wait time
        const waitRes = await fetch(`${API_URL}/wait-time`);
        const waitData = await waitRes.json();
        const waitEl = document.getElementById('wait-time');
        if (waitEl) waitEl.innerText = `~${waitData.estimated_wait_minutes} mins`;
    } catch (e) { }

    // Listen for real-time status updates via WebSocket
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'STATUS_UPDATE' && data.order_id == orderId) {
            const statusEl = document.getElementById('order-status');
            statusEl.innerText = data.status;
            statusEl.className = `badge badge-${data.status.toLowerCase()}`;
            updateProgress(data.status);
            if (data.status === 'Ready' || data.status === 'Delivered') {
                showToast("Your food is ready for pickup!");
                const feedbackSec = document.getElementById('feedback-section');
                if (feedbackSec) feedbackSec.style.display = 'block';
            }
        }
    };
}

// --- VENDOR DASHBOARD LOGIC ---

let vendorOrders = [];
let vendorTables = [];
let selectedVendorTableNumber = null;

async function initVendorDashboard() {
    loadVendorOrders();
    loadVendorTables();
    loadMenuForManagement();
    populateVendorCategorySelect();
    generateVendorQR();
    
    // Refresh QR code every 30 seconds with a visual countdown
    let timeLeft = 30;
    const updateCountdown = () => {
        const timerEl = document.querySelector('#qr-refresh-timer span:last-child');
        if (timerEl) timerEl.innerText = `Refreshing in ${timeLeft}s`;
        
        const progressEl = document.getElementById('qr-progress-bar');
        if (progressEl) progressEl.style.width = `${(timeLeft / 30) * 100}%`;
        
        if (timeLeft <= 0) {
            generateVendorQR();
            timeLeft = 30;
        }
        timeLeft--;
    };
    setInterval(updateCountdown, 1000);

    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_ORDER') {
            vendorOrders.unshift(data.order);
            if (data.table) {
                upsertVendorTable(data.table);
            } else {
                loadVendorTables();
            }
            notifyNewVendorOrder(data.order);
            renderVendorOrders();
        } else if (data.type === 'STATUS_UPDATE') {
            const order = vendorOrders.find(o => o.id === data.order_id);
            if (order) {
                order.status = data.status;
                renderVendorOrders();
            }
            loadVendorTables();
        } else if (data.type === 'TABLE_UPDATE' && data.table) {
            upsertVendorTable(data.table);
        }
    };

    setInterval(loadVendorTables, 30000);
}

function notifyNewVendorOrder(order) {
    const sound = document.getElementById('order-sound');
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => { });
    }

    const banner = document.getElementById('vendor-new-order-banner');
    if (!banner) return;
    const title = document.getElementById('vendor-new-order-title');
    const detail = document.getElementById('vendor-new-order-detail');
    const itemCount = (order.items || []).reduce((sum, item) => sum + item.quantity, 0);
    if (title) title.innerText = `New Order: Token #${order.token_number}`;
    if (detail) detail.innerText = `${itemCount} item${itemCount === 1 ? '' : 's'} · ₹${order.total_amount} · Table ${order.table_number || 1}`;
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 8000);
}

async function loadVendorOrders() {
    try {
        const response = await fetch(`${API_URL}/orders`);
        vendorOrders = await response.json();
        renderVendorOrders();
    } catch (e) {
        console.error("Dashboard failed to load orders", e);
    }
}

function renderVendorOrders() {
    const container = document.getElementById('vendor-order-list');
    if (!container) return;

    if (vendorOrders.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">No orders yet today.</div>';
        return;
    }

    // Update Stats
    const todaySales = vendorOrders.reduce((sum, o) => o.status !== 'Cancelled' ? sum + o.total_amount : sum, 0);
    document.getElementById('stats-orders').innerText = vendorOrders.length;
    document.getElementById('stats-sales').innerText = `₹${todaySales}`;

    // Filter active orders
    const activeOrders = vendorOrders.filter(o => o.status !== 'Ready' && o.status !== 'Delivered' && o.status !== 'Cancelled');
    document.getElementById('order-count-badge').innerText = activeOrders.length;

    // Update Batch Summary Bar
    updateBatchSummary(activeOrders);

    if (activeOrders.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 100px 20px;">
                <div style="font-size: 4rem; opacity: 0.2; margin-bottom: 20px;">🍱</div>
                <h3 style="color: white; font-weight: 800;">Kitchen is Clear</h3>
                <p style="color: var(--text-muted);">New orders will appear here automatically.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    activeOrders.forEach(order => {
        const orderAgeMins = (new Date() - new Date(order.timestamp)) / 60000;
        const isHeatAlert = orderAgeMins > 10; // Old order alert after 10 mins

        const card = document.createElement('div');
        card.className = `order-card animate-fade-in ${isHeatAlert ? 'heat-alert' : ''}`;
        card.id = `order-${order.id}`;

        const itemsHtml = order.items.map(i => `
            <div class="order-item-row" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px 0;">
                <span style="font-weight:700;">${i.quantity}x ${i.menu_item.name}</span>
                <span style="color:#94A3B8;">₹${i.menu_item.price * i.quantity}</span>
            </div>
        `).join('');

        const time = new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let actionButton = '';
        if (order.status === 'Pending') {
            actionButton = `<button class="action-btn-main btn-start" onclick="updateStatus(${order.id}, 'Preparing')">🔥 Start Cooking</button>`;
        } else if (order.status === 'Preparing') {
            actionButton = `<button class="action-btn-main btn-ready" onclick="updateStatus(${order.id}, 'Ready')">✅ Ready for Pickup</button>`;
        }

        card.innerHTML = `
            <div class="order-header" style="margin-bottom: 15px;">
                <div>
                    <span class="order-id" style="font-size: 1.4rem;">Token #${order.token_number}</span>
                    <p style="font-size: 0.8rem; color: #94A3B8; margin-top: 4px;">Placed ${Math.floor(orderAgeMins)}m ago (${time})</p>
                </div>
                <span class="badge badge-${order.status.toLowerCase()}" style="font-size: 0.7rem;">${order.status}</span>
            </div>
            
            <div class="order-items-list" style="margin-bottom: 15px;">
                ${itemsHtml}
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
                ${order.payment_method === 'UPI' ? '<span style="background:rgba(59, 130, 246, 0.1); color:#60A5FA; padding:4px 10px; border-radius:6px; font-size:0.7rem; font-weight:800; border:1px solid rgba(59, 130, 246, 0.2);">💳 UPI PAID</span>' : ''}
                ${order.items.reduce((s, i) => s + i.quantity, 0) <= 2 ? '<span style="background:rgba(16, 185, 129, 0.1); color:#34D399; padding:4px 10px; border-radius:6px; font-size:0.7rem; font-weight:800; border:1px solid rgba(16, 185, 129, 0.2);">⚡ FAST TRACK</span>' : ''}
                ${order.is_loyalty_boosted ? '<span style="background:rgba(139, 92, 246, 0.1); color:#A78BFA; padding:4px 10px; border-radius:6px; font-size:0.7rem; font-weight:800; border:1px solid rgba(139, 92, 246, 0.2);">👑 LOYALTY</span>' : ''}
            </div>

            ${actionButton}
            
            <button class="btn-outline" style="width: 100%; margin-top: 10px; border-color: #334155; color: #94A3B8; font-size: 0.75rem; border-radius: 8px; padding: 5px;" onclick="updateStatus(${order.id}, 'Cancelled')">Cancel Order</button>
        `;
        container.appendChild(card);
    });
}

function updateBatchSummary(orders) {
    const bar = document.getElementById('batch-prep-bar');
    if (!bar) return;

    if (orders.length === 0) {
        bar.style.display = 'none';
        return;
    }

    const itemCounts = {};
    orders.forEach(o => {
        o.items.forEach(i => {
            const name = i.menu_item.name;
            itemCounts[name] = (itemCounts[name] || 0) + i.quantity;
        });
    });

    const pills = Object.entries(itemCounts).map(([name, count]) => `
        <div class="batch-pill">
            <span style="opacity: 0.7;">${count}x</span> ${name}
        </div>
    `).join('');

    bar.innerHTML = `<span style="font-size: 0.8rem; font-weight: 800; color: #94A3B8; margin-right: 10px;">PREP TOTALS:</span> ${pills}`;
    bar.style.display = 'flex';
}

async function updateStatus(orderId, status) {
    const card = document.getElementById(`order-${orderId}`);

    // Optimistically update local state for immediate feedback
    const order = vendorOrders.find(o => o.id === orderId);
    if (order) {
        order.status = status;

        // If it's a "terminal" status for the vendor view, animate removal
        if (status === 'Ready' || status === 'Delivered' || status === 'Cancelled') {
            if (card) {
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9) translateY(20px)';
                card.style.pointerEvents = 'none';

                setTimeout(() => {
                    renderVendorOrders();
                }, 400); // Match CSS transition
            } else {
                renderVendorOrders();
            }
        } else {
            renderVendorOrders();
        }
    }

    try {
        const response = await fetch(`${API_URL}/orders/${orderId}/status?status=${status}`, { method: 'PATCH' });
        if (!response.ok) throw new Error("Update failed");
    } catch (e) {
        console.error("Status update failed", e);
        // On error, reload to sync state
        loadVendorOrders();
    }
}

// --- DINING TABLES & RUNNING BILL LOGIC ---

function formatMoney(amount) {
    return `₹${Number(amount || 0).toFixed(0)}`;
}

function formatTableTime(value) {
    if (!value) return 'Not started';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not started';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getTableStatusLabel(table) {
    if (!table.active_session_id || table.order_count === 0) return 'Available';
    if (table.pending_count > 0) return 'Preparing';
    if (table.visual_state === 'red') return 'Bill Due';
    return 'Active';
}

function upsertVendorTable(table) {
    const normalized = {
        ...table,
        table_number: Number(table.table_number),
        running_total: Number(table.running_total || 0),
        order_count: Number(table.order_count || 0),
        pending_count: Number(table.pending_count || 0),
        visual_state: table.visual_state || 'gray'
    };

    const index = vendorTables.findIndex(t => t.table_number === normalized.table_number);
    if (index >= 0) {
        vendorTables[index] = normalized;
    } else {
        vendorTables.push(normalized);
    }
    vendorTables.sort((a, b) => a.table_number - b.table_number);
    renderVendorTables();

    if (selectedVendorTableNumber === normalized.table_number) {
        openTableOrdersModal(normalized.table_number, true);
    }
}

async function loadVendorTables() {
    const grid = document.getElementById('vendor-tables-grid');
    if (!grid) return;

    try {
        const response = await fetch(`${API_URL}/tables`);
        if (!response.ok) throw new Error('Could not load tables');
        vendorTables = await response.json();
        renderVendorTables();
    } catch (e) {
        console.error('Failed to load dining tables', e);
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:36px; color:#F87171; background:#1E293B; border:1px solid #334155; border-radius:18px;">
                Could not load table bills. Check that the backend is running, then refresh.
            </div>
        `;
    }
}

function renderVendorTables() {
    const grid = document.getElementById('vendor-tables-grid');
    if (!grid) return;

    const tables = [...vendorTables].sort((a, b) => a.table_number - b.table_number);
    if (tables.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);">
                No table data found yet.
            </div>
        `;
        return;
    }

    grid.innerHTML = tables.map(table => {
        const state = table.visual_state || 'gray';
        const statusLabel = getTableStatusLabel(table);
        const canOpenBill = table.active_session_id && table.order_count > 0;
        const pendingText = table.pending_count > 0
            ? `${table.pending_count} pending`
            : (table.order_count > 0 ? 'All orders ready/served' : 'No active orders');

        return `
            <div class="table-card state-${escapeHtml(state)}">
                <div>
                    <div class="table-card-header">
                        <div class="table-card-title"><span>🪑</span> Table ${table.table_number}</div>
                        <span class="table-status-pill">${escapeHtml(statusLabel)}</span>
                    </div>
                    <div class="table-card-metrics">
                        <div class="table-orders-count">
                            ${table.order_count} order${table.order_count === 1 ? '' : 's'} &bull; ${escapeHtml(pendingText)}
                        </div>
                        <div class="table-running-total">${formatMoney(table.running_total)}</div>
                        <div style="font-size:0.78rem; color:#64748B; margin-top:4px;">
                            Session: ${table.active_session_id ? `#${table.active_session_id} since ${formatTableTime(table.started_at)}` : 'none'}
                        </div>
                    </div>
                </div>
                <div class="table-card-actions">
                    <button class="btn-table-action btn-view-orders" onclick="openTableOrdersModal(${table.table_number})">
                        View Orders
                    </button>
                    <button class="btn-table-action btn-view-bill" onclick="openTableBillModal(${table.table_number})" ${canOpenBill ? '' : 'disabled style="opacity:0.45; cursor:not-allowed;"'}>
                        Bill
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function openTableOrdersModal(tableNumber, silent = false) {
    selectedVendorTableNumber = tableNumber;
    const modal = document.getElementById('table-orders-modal');
    const title = document.getElementById('modal-table-title');
    const subtitle = document.getElementById('modal-table-subtitle');
    const body = document.getElementById('modal-table-body');
    const total = document.getElementById('modal-table-total');
    const payment = document.getElementById('modal-table-payment');

    if (!modal || !body) return;
    if (!silent) modal.style.display = 'flex';
    if (title) title.innerText = `TABLE ${tableNumber}`;
    body.innerHTML = '<div style="text-align:center; padding:28px; color:#94A3B8;">Loading table orders...</div>';

    try {
        const response = await fetch(`${API_URL}/tables/${tableNumber}/session`);
        if (!response.ok) throw new Error('Could not load table session');
        const session = await response.json();

        if (subtitle) {
            subtitle.innerText = session.has_active_session
                ? `Active Session #${session.session_id} • Started: ${formatTableTime(session.started_at)}`
                : 'No active session';
        }
        if (total) total.innerText = formatMoney(session.total_amount);
        if (payment) {
            payment.innerText = session.payment_status || 'UNPAID';
            payment.style.color = session.payment_status === 'PAID' ? '#34D399' : '#F87171';
        }

        const orders = session.orders || [];
        if (!session.has_active_session || orders.length === 0) {
            body.innerHTML = `
                <div style="text-align:center; padding:42px 20px; color:#94A3B8;">
                    <div style="font-size:2rem; margin-bottom:8px;">🪑</div>
                    <strong style="color:#F8FAFC;">No running orders for this table</strong>
                    <p style="margin-top:6px;">New orders from Table ${tableNumber} will appear here.</p>
                </div>
            `;
            return;
        }

        body.innerHTML = orders.map(order => {
            const items = (order.items || []).map(item => {
                const name = item.menu_item ? item.menu_item.name : 'Menu item';
                const unitPrice = item.unit_price ?? (item.menu_item ? item.menu_item.price : 0);
                return `
                    <div style="display:flex; justify-content:space-between; gap:12px; color:#CBD5E1; font-size:0.9rem; padding:4px 0;">
                        <span>${item.quantity}x ${escapeHtml(name)}</span>
                        <span>${formatMoney(unitPrice * item.quantity)}</span>
                    </div>
                `;
            }).join('');

            return `
                <div style="background:#0F172A; border:1px solid #334155; border-radius:14px; padding:16px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:10px;">
                        <div>
                            <strong style="color:#F8FAFC; font-size:1.05rem;">Token #${order.token_number}</strong>
                            <div style="color:#64748B; font-size:0.78rem;">${formatTableTime(order.timestamp)}</div>
                        </div>
                        <span class="badge badge-${String(order.status || '').toLowerCase()}" style="font-size:0.7rem;">${escapeHtml(order.status)}</span>
                    </div>
                    ${items}
                    <div style="display:flex; justify-content:space-between; border-top:1px dashed #334155; margin-top:10px; padding-top:10px; font-weight:800;">
                        <span>Total</span>
                        <span style="color:#FF8533;">${formatMoney(order.total_amount)}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Failed to load table orders', e);
        body.innerHTML = '<div style="text-align:center; padding:32px; color:#F87171;">Could not load this table session.</div>';
    }
}

function closeTableOrdersModal() {
    selectedVendorTableNumber = null;
    const modal = document.getElementById('table-orders-modal');
    if (modal) modal.style.display = 'none';
}

function openTableBillFromModal() {
    if (selectedVendorTableNumber) openTableBillModal(selectedVendorTableNumber);
}

async function openTableBillModal(tableNumber) {
    selectedVendorTableNumber = tableNumber;
    const modal = document.getElementById('table-bill-modal');
    const receipt = document.getElementById('bill-receipt-content');
    if (!modal || !receipt) return;

    modal.style.display = 'flex';
    receipt.innerHTML = '<div style="text-align:center; padding:20px;">Loading bill...</div>';

    try {
        const response = await fetch(`${API_URL}/tables/${tableNumber}/bill`);
        if (!response.ok) throw new Error('Could not load bill');
        const bill = await response.json();
        const items = bill.items || [];

        receipt.innerHTML = `
            <div style="text-align:center;">
                <h2 style="margin:0; font-size:1.35rem;">${escapeHtml(bill.restaurant_name || 'Food and Food')}</h2>
                <p style="margin:4px 0 0;">Table ${bill.table_number} • Session #${bill.session_id}</p>
                <p style="margin:4px 0 0; font-size:0.8rem;">${new Date(bill.generated_at).toLocaleString()}</p>
            </div>
            <div class="bill-divider"></div>
            ${items.length > 0 ? items.map(item => `
                <div class="bill-item-row">
                    <span>${escapeHtml(item.name)} x${item.quantity}</span>
                    <span>${formatMoney(item.subtotal)}</span>
                </div>
            `).join('') : '<p style="text-align:center;">No billable items.</p>'}
            <div class="bill-divider"></div>
            <div class="bill-item-row" style="font-weight:800; font-size:1.1rem;">
                <span>Grand Total</span>
                <span>${formatMoney(bill.grand_total)}</span>
            </div>
            <div style="margin-top:14px; text-align:center; font-size:0.85rem;">
                Payment: ${escapeHtml(bill.payment_status || 'UNPAID')}
            </div>
        `;
    } catch (e) {
        console.error('Failed to load bill', e);
        receipt.innerHTML = '<div style="text-align:center; color:#B91C1C;">Could not load bill for this table.</div>';
    }
}

function closeTableBillModal() {
    const modal = document.getElementById('table-bill-modal');
    if (modal) modal.style.display = 'none';
}

async function closeTableFromModal() {
    if (!selectedVendorTableNumber) return;
    const tableNumber = selectedVendorTableNumber;
    if (!confirm(`Mark Table ${tableNumber} as paid and close the session?`)) return;

    try {
        const response = await fetch(`${API_URL}/tables/${tableNumber}/close`, { method: 'POST' });
        if (!response.ok) throw new Error('Could not close table');
        const result = await response.json();
        if (result.table) upsertVendorTable(result.table);
        closeTableOrdersModal();
        closeTableBillModal();
        showToast(`Table ${tableNumber} closed`);
        loadVendorTables();
    } catch (e) {
        console.error('Failed to close table', e);
        showToast('Could not close this table');
    }
}

function printBillReceipt() {
    window.print();
}

// User's exact ordered category definitions with emojis
const VENDOR_CATEGORY_SPECS = [
    { name: "All", icon: "🍽️" },
    { name: "Appetizers Non-Veg", icon: "🍟" },
    { name: "Appetizers Veg", icon: "🍟" },
    { name: "Tandoors & Grills Non-Veg", icon: "🔥" },
    { name: "Salads", icon: "🥗" },
    { name: "Sides", icon: "🍟" },
    { name: "Burgers Non-Veg", icon: "🍔" },
    { name: "Burgers Veg", icon: "🍔" },
    { name: "Sandwiches Non-Veg", icon: "🥪" },
    { name: "Sandwiches Veg", icon: "🥪" },
    { name: "Chinese Court Non-Veg", icon: "🍜" },
    { name: "Continental Court Non-Veg", icon: "🍝" },
    { name: "Chinese Court Veg", icon: "🍜" },
    { name: "Continental Court Veg", icon: "🍝" },
    { name: "Soup Veg", icon: "🍲" },
    { name: "Soup Non-Veg", icon: "🍲" },
    { name: "Indian Gravies Veg", icon: "🍛" },
    { name: "Indian Gravies Non-Veg", icon: "🍛" },
    { name: "Indian Rice Veg", icon: "🍜" },
    { name: "Indian Rice Non-Veg", icon: "🍜" },
    { name: "Wrap Non-Veg", icon: "🌯" },
    { name: "Wrap Veg", icon: "🌯" },
    { name: "Omelets", icon: "🍳" },
    { name: "Juices and Mocktails", icon: "🥤" },
    { name: "Smoothies", icon: "🥤" },
    { name: "Desserts", icon: "🍨" },
    { name: "French Delicacies", icon: "🍨" },
    { name: "Beverages", icon: "🥤" },
    { name: "Add Ons", icon: "➕" }
];

let vendorActiveCategory = "All";
let vendorStatusFilter = 'all'; // 'all' | 'available' | 'soldout'
let vendorOpenCategories = new Set(); // tracks open category accordion sections

async function loadMenuForManagement() {
    try {
        const response = await fetch(`${API_URL}/menu`);
        const items = await response.json();
        window.vendorFullMenu = items;
        
        renderVendorCategoryBar(items);
        updateVendorMenuStats(items);
        applyVendorFilters();
    } catch (e) {
        console.error("Failed to load menu for management", e);
    }
}

function renderVendorCategoryBar(items) {
    const bar = document.getElementById('vendor-category-bar');
    if (!bar) return;

    // Get item counts per category
    const catCounts = {};
    items.forEach(i => {
        catCounts[i.category] = (catCounts[i.category] || 0) + 1;
    });

    bar.innerHTML = VENDOR_CATEGORY_SPECS.map(spec => {
        const count = spec.name === "All" ? items.length : (catCounts[spec.name] || 0);
        const isActive = vendorActiveCategory === spec.name;
        return `
            <button type="button" class="vendor-cat-pill ${isActive ? 'active' : ''}" onclick="selectVendorCategory('${escapeHtml(spec.name)}', this)">
                <span>${spec.icon}</span>
                <span>${escapeHtml(spec.name)}</span>
                <span class="cat-count-badge">${count}</span>
            </button>
        `;
    }).join('');
}

function selectVendorCategory(catName, btn) {
    vendorActiveCategory = catName;
    document.querySelectorAll('.vendor-cat-pill').forEach(b => b.classList.remove('active'));
    if (btn) {
        btn.classList.add('active');
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    applyVendorFilters();
}

function updateVendorMenuStats(items) {
    const total = items.length;
    const available = items.filter(i => i.is_available).length;
    const soldout = total - available;

    const totalEl = document.getElementById('vendor-stat-total');
    const availEl = document.getElementById('vendor-stat-available');
    const soldEl = document.getElementById('vendor-stat-soldout');
    
    if (totalEl) totalEl.innerText = `Total: ${total}`;
    if (availEl) availEl.innerText = `In Stock: ${available}`;
    if (soldEl) soldEl.innerText = `Sold Out: ${soldout}`;
}

function setVendorStatusFilter(filter, btn) {
    vendorStatusFilter = filter;
    document.querySelectorAll('.vendor-filter-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    applyVendorFilters();
}

function handleVendorFilterChange() {
    const searchInput = document.getElementById('vendor-menu-search');
    const clearBtn = document.getElementById('vendor-search-clear');
    if (clearBtn && searchInput) {
        clearBtn.style.display = searchInput.value ? 'block' : 'none';
    }
    applyVendorFilters();
}

function clearVendorSearch() {
    const searchInput = document.getElementById('vendor-menu-search');
    const clearBtn = document.getElementById('vendor-search-clear');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    applyVendorFilters();
}

function applyVendorFilters() {
    if (!window.vendorFullMenu) return;
    
    const searchInput = document.getElementById('vendor-menu-search');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    let filtered = window.vendorFullMenu.filter(item => {
        // Status filter
        if (vendorStatusFilter === 'available' && !item.is_available) return false;
        if (vendorStatusFilter === 'soldout' && item.is_available) return false;
        
        // Category selection filter (if not "All")
        if (vendorActiveCategory !== 'All' && item.category !== vendorActiveCategory) return false;
        
        // Search query
        if (query) {
            const matchesName = item.name && item.name.toLowerCase().includes(query);
            const matchesCategory = item.category && item.category.toLowerCase().includes(query);
            const matchesDesc = item.description && item.description.toLowerCase().includes(query);
            if (!matchesName && !matchesCategory && !matchesDesc) return false;
        }
        
        return true;
    });
    
    renderMenuManagementGrouped(filtered, Boolean(query));
}

function renderMenuManagementGrouped(items, isSearching) {
    const container = document.getElementById('vendor-menu-management');
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 48px 20px; background: #0F172A; border-radius: 18px; border: 1.5px dashed #334155;">
                <div style="font-size: 2.2rem; margin-bottom: 8px;">🔍</div>
                <div style="font-weight: 700; color: #F8FAFC; font-size: 1.05rem;">No dishes match your selection</div>
                <p style="color: #94A3B8; font-size: 0.85rem; margin-top: 4px;">Try selecting "All" or clearing the search query.</p>
                <button type="button" class="btn-vendor-action" onclick="clearVendorSearch(); selectVendorCategory('All', document.querySelector('.vendor-cat-pill'));" style="margin-top: 14px;">
                    Reset to All Items
                </button>
            </div>
        `;
        return;
    }

    // Group items by category according to VENDOR_CATEGORY_SPECS order
    const categoryOrder = VENDOR_CATEGORY_SPECS.map(s => s.name).filter(n => n !== 'All');
    
    // Grouping
    const grouped = {};
    items.forEach(i => {
        const cat = i.category || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(i);
    });

    const activeCategories = categoryOrder.filter(cat => grouped[cat] && grouped[cat].length > 0);
    // Include any categories present in items but not in predefined specs
    Object.keys(grouped).forEach(cat => {
        if (!activeCategories.includes(cat)) activeCategories.push(cat);
    });

    container.innerHTML = activeCategories.map(cat => {
        const catItems = grouped[cat];
        const spec = VENDOR_CATEGORY_SPECS.find(s => s.name === cat) || { name: cat, icon: '🥘' };
        const inStockCount = catItems.filter(i => i.is_available).length;
        const soldOutCount = catItems.length - inStockCount;
        const safeId = cat.replace(/[^a-zA-Z0-9]/g, '-');

        return `
            <div class="vendor-cat-section" id="vendor-sec-${safeId}">
                <!-- Category Section Header -->
                <div class="vendor-cat-header">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 1.6rem;">${spec.icon}</span>
                        <div>
                            <span style="font-size: 1.15rem; font-weight: 800; color: white;">${escapeHtml(cat)}</span>
                            <span style="font-size: 0.82rem; color: #94A3B8; margin-left: 8px;">(${catItems.length} dishes)</span>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <span style="font-size: 0.78rem; font-weight: 700; color: #34D399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 5px 12px; border-radius: 8px;">
                            ● ${inStockCount} In Stock
                        </span>
                        ${soldOutCount > 0 ? `
                            <span style="font-size: 0.78rem; font-weight: 700; color: #F87171; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); padding: 5px 12px; border-radius: 8px;">
                                ○ ${soldOutCount} Sold Out
                            </span>
                        ` : ''}
                    </div>
                </div>

                <!-- Category Items Grid -->
                <div class="vendor-cat-body">
                    <div class="vendor-menu-grid">
                        ${catItems.map(item => `
                            <div class="menu-manage-item ${item.is_available ? '' : 'sold-out'}" onclick="toggleItemAvailability(${item.id}, ${item.is_available})">
                                <div style="position: relative; flex-shrink: 0;">
                                    ${getImageUrl(item)
                                        ? `<img class="manage-item-img" src="${escapeHtml(getImageUrl(item))}" style="width: 68px; height: 68px; border-radius: 14px; object-fit: cover; border: 1px solid #334155;" alt="${escapeHtml(item.name)}">`
                                        : `<div class="vendor-menu-placeholder manage-item-img" style="width: 68px; height: 68px; border-radius: 14px; font-size: 1.8rem; display: flex; align-items: center; justify-content: center; background: #1E293B;">${getCategoryIcon(item.category)}</div>`
                                    }
                                </div>
                                
                                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px;">
                                    <div class="manage-item-title" style="font-size: 0.98rem; font-weight: 700; line-height: 1.35; word-break: break-word;">
                                        ${escapeHtml(item.name)}
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                        <span class="manage-item-tag" style="font-size: 0.74rem; padding: 3px 9px; border-radius: 6px; font-weight: 600;">${escapeHtml(item.category)}</span>
                                        <span style="font-size: 0.92rem; font-weight: 800; color: #FF4D00;">₹${item.price}</span>
                                    </div>
                                </div>

                                <div class="vendor-item-actions" onclick="event.stopPropagation()">
                                    <button type="button" onclick="openMenuItemEditor(${item.id})" title="Edit item">Edit</button>
                                    <button type="button" class="danger" onclick="deleteMenuItem(${item.id})" title="Delete item">Delete</button>
                                </div>

                                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0;">
                                    <div class="manage-toggle-switch ${item.is_available ? 'active' : ''}" title="Click to toggle availability"></div>
                                    <span style="font-size: 0.74rem; font-weight: 800; color: ${item.is_available ? '#34D399' : '#F87171'};">
                                        ${item.is_available ? 'In Stock' : 'Sold Out'}
                                    </span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function toggleItemAvailability(itemId, currentStatus) {
    // Optimistic UI update in memory
    const newStatus = !currentStatus;
    if (window.vendorFullMenu) {
        const item = window.vendorFullMenu.find(i => i.id === itemId);
        if (item) {
            item.is_available = newStatus;
            updateVendorMenuStats(window.vendorFullMenu);
            applyVendorFilters();
        }
    }

    try {
        const response = await fetch(`${API_URL}/menu/${itemId}/availability?is_available=${newStatus}`, { method: 'PATCH' });
        if (!response.ok) throw new Error("Update failed");
        showToast(`Item marked as ${newStatus ? 'In Stock' : 'Sold Out'}`);
    } catch (e) {
        console.error("Toggle failed, reverting", e);
        showToast("Failed to update status. Reverting...");
        loadMenuForManagement();
    }
}

function populateVendorCategorySelect() {
    const select = document.getElementById('vendor-edit-category');
    if (!select) return;
    select.innerHTML = VENDOR_CATEGORY_SPECS
        .filter(spec => spec.name !== 'All')
        .map(spec => `<option value="${escapeHtml(spec.name)}">${escapeHtml(spec.name)}</option>`)
        .join('');
}

function openMenuItemEditor(itemId = null) {
    populateVendorCategorySelect();
    const modal = document.getElementById('vendor-item-modal');
    const title = document.getElementById('vendor-item-modal-title');
    const form = document.getElementById('vendor-item-form');
    const item = itemId ? (window.vendorFullMenu || []).find(i => i.id === itemId) : null;
    if (!modal || !form) return;

    form.reset();
    document.getElementById('vendor-edit-item-id').value = item ? item.id : '';
    document.getElementById('vendor-edit-name').value = item ? item.name : '';
    document.getElementById('vendor-edit-description').value = item ? item.description : '';
    document.getElementById('vendor-edit-price').value = item ? item.price : '';
    document.getElementById('vendor-edit-category').value = item ? item.category : 'Appetizers Veg';
    document.getElementById('vendor-edit-image').value = item ? (item.image_url || '') : '';
    document.getElementById('vendor-edit-available').checked = item ? Boolean(item.is_available) : true;
    if (title) title.innerText = item ? 'Edit Menu Item' : 'Add Menu Item';
    modal.style.display = 'flex';
}

function closeMenuItemEditor() {
    const modal = document.getElementById('vendor-item-modal');
    if (modal) modal.style.display = 'none';
}

async function saveMenuItem(event) {
    event.preventDefault();
    const id = document.getElementById('vendor-edit-item-id').value;
    const payload = {
        name: document.getElementById('vendor-edit-name').value.trim(),
        description: document.getElementById('vendor-edit-description').value.trim(),
        price: Number(document.getElementById('vendor-edit-price').value),
        category: document.getElementById('vendor-edit-category').value,
        image_url: document.getElementById('vendor-edit-image').value.trim(),
        is_available: document.getElementById('vendor-edit-available').checked
    };

    if (!payload.name || !payload.description || Number.isNaN(payload.price)) {
        showToast('Please fill all required item fields');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/menu${id ? `/${id}` : ''}`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const detail = await response.json().catch(() => ({}));
            throw new Error(detail.detail || 'Could not save item');
        }
        closeMenuItemEditor();
        showToast(id ? 'Menu item updated' : 'Menu item added');
        loadMenuForManagement();
    } catch (e) {
        console.error('Menu item save failed', e);
        showToast(e.message || 'Could not save item');
    }
}

async function deleteMenuItem(itemId) {
    const item = (window.vendorFullMenu || []).find(i => i.id === itemId);
    const name = item ? item.name : 'this item';
    if (!confirm(`Delete ${name}? Items used in existing orders cannot be deleted.`)) return;

    try {
        const response = await fetch(`${API_URL}/menu/${itemId}`, { method: 'DELETE' });
        if (!response.ok) {
            const detail = await response.json().catch(() => ({}));
            throw new Error(detail.detail || 'Could not delete item');
        }
        showToast('Menu item deleted');
        loadMenuForManagement();
    } catch (e) {
        console.error('Menu item delete failed', e);
        showToast(e.message || 'Could not delete item');
    }
}

async function loadTopItems() {
    try {
        const response = await fetch(`${API_URL}/analytics/top-items`);
        const data = await response.json();
        window.popularItemNames = (data || []).map(item => item.name);
        renderTopItems(data);
        if (menuQuickFilter === 'popular') applyCustomerMenuView();
    } catch (e) { }
}

function renderTopItems(data) {
    const container = document.getElementById('top-items-list');
    const section = document.getElementById('top-selling-section');
    if (!container) return;

    if (!data || data.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }

    if (section) section.style.display = 'block';

    container.innerHTML = data.map((item, idx) => `
        <div style="background: rgba(255,255,255,0.12); padding: 10px 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.15); min-width: 120px; flex-shrink: 0; backdrop-filter: blur(4px);">
            <div style="font-size: 1.2rem; margin-bottom: 3px;">${idx === 0 ? '👑' : '🔥'}</div>
            <div style="font-size: 0.9rem; font-weight: 700; color: white; white-space: nowrap;">${escapeHtml(item.name)}</div>
            <div style="font-size: 0.75rem; color: #FED7AA; font-weight: 600; margin-top: 2px;">${item.count} orders today</div>
        </div>
    `).join('');
}

function updateLoyaltyUI() {
    const section = document.getElementById('loyalty-section');
    const container = document.getElementById('stamps-container');
    const label = document.getElementById('stamps-needed');
    if (!section || !container) return;

    const stamps = parseInt(localStorage.getItem('loyalty_stamps') || '0');
    section.style.display = 'block';

    let html = '';
    for (let i = 1; i <= 5; i++) {
        const isEarned = i <= stamps;
        html += `
            <div style="width: 35px; height: 35px; background: ${isEarned ? 'var(--primary)' : 'white'}; border: 2px solid ${isEarned ? 'var(--primary)' : '#E2E8F0'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; color: ${isEarned ? 'white' : '#CBD5E1'};">
                ${isEarned ? '🥘' : '◯'}
            </div>
        `;
    }
    container.innerHTML = html;
    
    if (stamps >= 5) {
        label.innerText = "FREE ITEM UNLOCKED! 🎉";
        label.style.color = "var(--success)";
    } else {
        label.innerText = `${5 - stamps} orders to go!`;
        label.style.color = "var(--primary)";
    }
}

function openQRModal() {
    const modal = document.getElementById('qr-modal');
    if (modal) {
        modal.style.display = 'flex';
        generateVendorQR();
    }
}

function closeQRModal() {
    const modal = document.getElementById('qr-modal');
    if (modal) modal.style.display = 'none';
}

function addTableQR(tableNum) {
    const grid = document.getElementById('all-qrs-grid');
    if (!grid) return;
    const card = document.createElement('div');
    card.className = 'qr-card';
    const label = document.createElement('p');
    label.className = 'qr-label';
    label.textContent = `Table ${tableNum}`;
    const qrDiv = document.createElement('div');
    new QRCode(qrDiv, {
        text: `${window.location.origin}/menu.html?table=${tableNum}`,
        width: 150,
        height: 150,
        colorDark: "#1E293B",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
    });
    card.appendChild(label);
    card.appendChild(qrDiv);
    grid.appendChild(card);
}

function openAllTableQRsModal() {
    const grid = document.getElementById('all-qrs-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 1; i <= 7; i++) {
        addTableQR(i);
    }
    const modal = document.getElementById('all-qrs-modal');
    if (modal) modal.style.display = 'flex';
}

function closeAllTableQRsModal() {
    const modal = document.getElementById('all-qrs-modal');
    if (modal) modal.style.display = 'none';
}

function printAllTableQRs() {
    const modal = document.getElementById('all-qrs-modal');
    if (modal && modal.style.display !== 'flex') {
        openAllTableQRsModal();
    }
    setTimeout(() => {
        window.print();
    }, 300);
}

function generateVendorQR() {
    const container = document.getElementById("qrcode");
    if (!container) return;

    container.innerHTML = "";

    // Get current origin for local/prod testing support
    const currentOrigin = window.location.origin;
    // Add a unique timestamp to make the URL/QR dynamic
    const timestamp = Math.floor(Date.now() / 1000);
    const menuUrl = `${currentOrigin}/menu.html?v=${timestamp}`;
    
    console.log("Generating dynamic QR for:", menuUrl);

    new QRCode(container, {
        text: menuUrl,
        width: 256,
        height: 256,
        colorDark: "#1E293B",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    // Optional: Update the visible URL text if it exists in a modal
    const urlText = document.querySelector('.qr-modal .url-display');
    if (urlText) urlText.innerText = menuUrl;
}

function downloadQRCode() {
    const container = document.getElementById("qrcode");
    const img = container.querySelector("img");
    const canvas = container.querySelector("canvas");

    const dataUrl = img ? img.src : (canvas ? canvas.toDataURL("image/png") : null);

    if (dataUrl) {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "FoodAndFood_Vendor_QR.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function printQRCode() {
    const container = document.getElementById("qrcode");
    const img = container.querySelector("img");
    const canvas = container.querySelector("canvas");
    const qrSrc = img ? img.src : (canvas ? canvas.toDataURL("image/png") : "");

    if (!qrSrc) return;

    const currentOrigin = window.location.origin;
    const menuUrl = `${currentOrigin}/menu.html`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Print Menu QR - Food and Food</title>
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
                <style>
                    body { 
                        display: flex; 
                        flex-direction: column; 
                        align-items: center; 
                        justify-content: center; 
                        height: 100vh; 
                        font-family: 'Outfit', sans-serif; 
                        text-align: center; 
                        background: #F8FAFC;
                        color: #1E293B;
                    }
                    .qr-card {
                        background: white;
                        padding: 40px;
                        border-radius: 40px;
                        box-shadow: 0 20px 50px rgba(0,0,0,0.1);
                        border: 2px solid #E2E8F0;
                    }
                    img { 
                        width: 400px; 
                        height: 400px; 
                        margin-bottom: 30px; 
                        padding: 20px;
                        background: white;
                        border-radius: 20px;
                    }
                    h1 { 
                        margin: 0; 
                        font-size: 32px; 
                        font-weight: 800;
                        color: #FF4D00; 
                    }
                    p { 
                        font-size: 18px; 
                        color: #64748B; 
                        margin-top: 10px; 
                        font-weight: 600;
                    }
                    .url {
                        margin-top: 20px;
                        font-size: 14px;
                        color: #94A3B8;
                        text-transform: lowercase;
                    }
                </style>
            </head>
            <body>
                <div class="qr-card">
                    <h1>Scan to View Menu</h1>
                    <p>Place your order directly from your phone!</p>
                    <img src="${qrSrc}" />
                    <div class="url">${menuUrl}</div>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() { window.close(); };
                    }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

// --- FEEDBACK LOGIC ---
let selectedRating = 0;

function setRating(stars) {
    selectedRating = stars;
    const starElements = document.querySelectorAll('.star');
    starElements.forEach((s, idx) => {
        s.innerText = idx < stars ? '⭐' : '☆';
        s.style.color = idx < stars ? '#FFD700' : '#CBD5E1';
    });
    
    const submitBtn = document.getElementById('submit-feedback');
    if (submitBtn) submitBtn.style.display = 'inline-block';
}

async function submitFeedback() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');
    
    if (!orderId || selectedRating === 0) return;

    try {
        const response = await fetch(`${API_URL}/ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id: parseInt(orderId),
                stars: selectedRating
            })
        });

        if (response.ok) {
            document.getElementById('feedback-section').innerHTML = `
                <p style="color: var(--success); font-weight: 700;">Thank you for your feedback! ❤️</p>
            `;
        }
    } catch (e) {
        console.error("Failed to submit feedback", e);
    }
}
