const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://zoupie-pos.onrender.com';

let cart = [];

// --- 1. ROUTING VIEWS CONTROL ---
function switchView(viewId) {
    document.querySelectorAll('.view-panel').forEach(panel => panel.style.display = 'none');
    const target = document.getElementById(`${viewId}-view`);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
    
    // Safety check to highlight menu items correctly
    if (event && event.currentTarget && event.currentTarget.classList.contains('sidebar-item')) {
        event.currentTarget.classList.add('active');
    }

    if (viewId === 'floor') {
        loadInventory();
        loadAnalytics();
    } else if (viewId === 'history') {
        loadSalesHistory();
    } else if (viewId === 'stock-mgmt') {
        loadInventorySelects();
    }
}

// --- 2. AUTHENTICATION ---
async function login(email, password) {
    const loginBtn = document.querySelector('button[onclick*="login"]');
    if (loginBtn) loginBtn.innerText = "Verifying...";
    try {
        const response = await fetch(`${API_URL}/inventory/${email}`);
        if (!response.ok) throw new Error("Server issue.");
        localStorage.setItem('shop_owner_email', email);
        window.location.href = '/dashboard';
    } catch (error) {
        console.error(error);
        alert("Could not connect to the server.");
        if (loginBtn) loginBtn.innerText = "Login";
    }
}

// --- 3. INVENTORY LOADER ---
async function loadInventory() {
    const email = localStorage.getItem('shop_owner_email');
    if (!email) { window.location.href = '/'; return; }
    try {
        const response = await fetch(`${API_URL}/inventory/${email}`);
        const products = await response.json();
        const tableBody = document.getElementById('inventory-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        products.forEach(p => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${p.name}</td>
                <td>${Number(p.price).toFixed(2)}</td>
                <td>${p.stock_quantity}</td>
                <td><button onclick="addToCart('${p.id}', '${p.name}', ${p.price}, ${p.stock_quantity})">Add to Cart</button></td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) { console.error("Error loading inventory:", error); }
}

// --- 4. ADVANCED TERMINAL CART MECHANICS ---
function addToCart(id, name, price, maxStock) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        if (existing.qtySold >= maxStock) { alert("Cannot exceed available stock physical limits!"); return; }
        existing.qtySold++;
    } else {
        if (maxStock <= 0) { alert("Item is completely out of stock!"); return; }
        cart.push({ id, name, price, qtySold: 1, maxStock });
    }
    renderCart();
}

function updateCartQty(id, newQty) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    let val = parseInt(newQty) || 0;
    if (val <= 0) {
        cart = cart.filter(i => i.id !== id);
    } else if (val > item.maxStock) {
        alert(`Only ${item.maxStock} items available in active physical stock.`);
        item.qtySold = item.maxStock;
    } else {
        item.qtySold = val;
    }
    renderCart();
}

// Fixed minor typographic reference to ensure seamless cart button increments
function adjustCartQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    updateCartQty(id, item.qtySold + delta);
}

function renderCart() {
    const cartDiv = document.getElementById('cart-container');
    if (!cartDiv) return;
    cartDiv.innerHTML = '';
    let grandTotal = 0;
    
    cart.forEach(item => {
        grandTotal += item.price * item.qtySold;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <span class="cart-item-name">${item.name}</span>
                <span class="cart-item-price">₵${(item.price * item.qtySold).toFixed(2)}</span>
            </div>
            <div class="cart-qty-controls">
                <button onclick="adjustCartQty('${item.id}', -1)">-</button>
                <input type="number" value="${item.qtySold}" min="0" onchange="updateCartQty('${item.id}', this.value)">
                <button onclick="adjustCartQty('${item.id}', 1)">+</button>
            </div>
        `;
        cartDiv.appendChild(div);
    });
    const totalDiv = document.getElementById('cart-grand-total');
    if (totalDiv) totalDiv.innerText = grandTotal.toFixed(2);
}

// --- 5. CASHOUT & RECEIPT PRINT LOOP ---
async function processBulkCashout() {
    if (cart.length === 0) { alert("Your transaction cart is currently empty!"); return; }
    const email = localStorage.getItem('shop_owner_email');
    
    try {
        const response = await fetch(`${API_URL}/inventory/cashout-bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: cart, email: email })
        });
        
        if (response.ok) {
            generateReceiptPopup();
            cart = [];
            renderCart();
            loadInventory();
            loadAnalytics();
        } else { alert("Cashout failed to process."); }
    } catch (error) { console.error("Cashout system error:", error); }
}

function generateReceiptPopup() {
    let receiptWindow = window.open('', 'PRINT', 'height=600,width=400');
    let rowsHtml = cart.map(i => `
        <tr>
            <td style="padding:5px 0;">${i.name} x${i.qtySold}</td>
            <td style="text-align:right; padding:5px 0;">₵${(i.price * i.qtySold).toFixed(2)}</td>
        </tr>`).join('');
    let total = cart.reduce((a, b) => a + (b.price * b.qtySold), 0).toFixed(2);

    receiptWindow.document.write(`
        <html>
        <head><title>Receipt</title></head>
        <body style="font-family:monospace; padding:20px; color:#333;" onload="window.print();window.close()">
            <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:10px; margin-bottom:10px;">
                <h2 style="margin:0 0 5px 0;">SHOPFLOW-PRO</h2>
                <p style="margin:0; font-size:12px;">Transaction Invoice Receipt</p>
                <p style="margin:5px 0 0 0; font-size:11px;">Date: ${new Date().toLocaleString()}</p>
            </div>
            <table style="width:100%; font-size:14px; border-collapse:collapse;">${rowsHtml}</table>
            <div style="border-top:1px dashed #000; margin-top:10px; padding-top:10px; text-align:right; font-weight:bold; font-size:16px;">
                Grand Total: ₵${total}
            </div>
            <div style="text-align:center; margin-top:30px; font-size:12px; border-top:1px solid #eee; padding-top:10px;">
                Thank you for your business!
            </div>
        </body>
        </html>
    `);
    receiptWindow.document.close();
}

// --- 6. FLEXIBLE STOCK UPGRADES & NEW ITEMS UPSERT ---
function toggleRestockMode(mode) {
    const existingGroup = document.getElementById('group-existing-item');
    const newGroup = document.getElementById('group-new-item');
    const pricingGroup = document.getElementById('group-pricing-fields');
    
    if (mode === 'new') {
        existingGroup.style.display = 'none';
        newGroup.style.display = 'block';
        pricingGroup.style.display = 'grid';
    } else {
        existingGroup.style.display = 'block';
        newGroup.style.display = 'none';
        pricingGroup.style.display = 'none';
    }
}

async function loadInventorySelects() {
    const email = localStorage.getItem('shop_owner_email');
    try {
        const response = await fetch(`${API_URL}/inventory/${email}`);
        const products = await response.json();
        const select = document.getElementById('stock-item-select');
        if (!select) return;
        
        select.innerHTML = '<option value="" disabled selected>-- Choose an existing stock item --</option>' + 
            products.map(p => `<option value="${p.name}" data-cost="${p.cost_price}" data-price="${p.price}" data-expiry="${p.expiry_date || ''}">${p.name} (Current: ${p.stock_quantity})</option>`).join('');
    } catch (e) { console.error(e); }
}

async function submitStockAdjustment() {
    const mode = document.querySelector('input[name="restock-mode"]:checked').value;
    const qtyInput = parseInt(document.getElementById('stock-qty-input').value) || 0;
    const email = localStorage.getItem('shop_owner_email');
    
    if (qtyInput <= 0) { alert("Please input a valid positive quantity entry amount."); return; }
    
    let itemsArray = [];
    
    if (mode === 'existing') {
        const itemSelect = document.getElementById('stock-item-select');
        if (!itemSelect.value) { alert("Please choose an existing product base line."); return; }
        const selectedOption = itemSelect.options[itemSelect.selectedIndex];
        
        itemsArray.push({
            name: itemSelect.value,
            cost_price: parseFloat(selectedOption.getAttribute('data-cost')) || 0,
            price: parseFloat(selectedOption.getAttribute('data-price')) || 0,
            qty: qtyInput,
            expiry_date: selectedOption.getAttribute('data-expiry') || null
        });
    } else {
        // Create an entirely new product row entry through the matching bulk API system wrapper
        const newName = document.getElementById('stock-new-name').value.trim();
        const costPrice = parseFloat(document.getElementById('stock-cost-price').value) || 0;
        const salePrice = parseFloat(document.getElementById('stock-sale-price').value) || 0;
        
        if (!newName) { alert("Please provide a name for the new inventory item."); return; }
        if (salePrice <= 0) { alert("Please input a valid selling price target configuration."); return; }
        
        itemsArray.push({
            name: newName,
            cost_price: costPrice,
            price: salePrice,
            qty: qtyInput,
            expiry_date: null
        });
    }
    
    try {
        const response = await fetch(`${API_URL}/inventory/add-bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, items: itemsArray })
        });
        if (response.ok) {
            alert(mode === 'existing' ? "Inventory stock stacked successfully!" : "New workspace product cataloged successfully!");
            // Form field cleanup routines
            document.getElementById('stock-qty-input').value = '';
            document.getElementById('stock-new-name').value = '';
            document.getElementById('stock-cost-price').value = '';
            document.getElementById('stock-sale-price').value = '';
            
            loadInventorySelects();
        } else { alert("Failed to update catalog stock parameters."); }
    } catch (error) { console.error(error); }
}

// --- 7. REVENUE PERFORMANCE ANALYTICS ---
async function loadAnalytics() {
    const email = localStorage.getItem('shop_owner_email');
    try {
        const response = await fetch(`${API_URL}/analytics/${email}`);
        const data = await response.json();
        if (document.getElementById('total-revenue')) document.getElementById('total-revenue').innerText = data.revenue;
        if (document.getElementById('net-profit')) document.getElementById('net-profit').innerText = data.profit;
    } catch (error) { console.error("Analytics error:", error); }
}

// --- 8. TRANSACTION LOGS HISTORY ---
async function loadSalesHistory() {
    const email = localStorage.getItem('shop_owner_email');
    try {
        const response = await fetch(`${API_URL}/analytics/${email}`);
        const data = await response.json();
        const historyBody = document.getElementById('history-table-body');
        if (!historyBody) return;
        historyBody.innerHTML = '';
        
        if (data.topItems && data.topItems.length > 0) {
            data.topItems.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${item[0]}</td><td>${item[1]} units sold</td><td>Processed</td>`;
                historyBody.appendChild(row);
            });
        } else {
            historyBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">No sales entries recorded in this shift cycle yet.</td></tr>`;
        }
    } catch (e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('inventory-table-body')) {
        loadInventory();
        loadAnalytics();
    }
});