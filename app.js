let localInventory = [];
let shoppingCart = [];

document.addEventListener('DOMContentLoaded', () => {
    const email = localStorage.getItem('shop_owner_email');
    if (!email) {
        window.location.href = '/login.html';
        return;
    }
    document.getElementById('user-display').innerText = `Workspace: ${email}`;
    pullLiveDashboardData();
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    
    if(tabId === 'floor') {
        document.getElementById('tab-floor').style.display = 'block';
        event.currentTarget.classList.add('active');
        pullLiveDashboardData();
    } else if (tabId === 'restock') {
        document.getElementById('tab-restock').style.display = 'block';
        event.currentTarget.classList.add('active');
        populateRestockDropdown();
    } else if (tabId === 'history') {
        document.getElementById('tab-history').style.display = 'block';
        event.currentTarget.classList.add('active');
    }
}

async function pullLiveDashboardData() {
    const email = localStorage.getItem('shop_owner_email');
    try {
        const invRes = await fetch(`/inventory/${email}`);
        localInventory = await invRes.json();
        renderActiveFloorInventory();

        const analyticsRes = await fetch(`/analytics/${email}`);
        const analytics = await analyticsRes.json();
        document.getElementById('metric-revenue').innerText = analytics.revenue;
        document.getElementById('metric-profit').innerText = analytics.profit;
    } catch (err) {
        console.error("Dashboard synchronization failure:", err);
    }
}

function renderActiveFloorInventory() {
    const tbody = document.getElementById('inventory-table-body');
    tbody.innerHTML = '';
    
    if(localInventory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No stock active. Open the Restock Tab to load items!</td></tr>`;
        return;
    }

    localInventory.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>₵${parseFloat(item.price).toFixed(2)}</td>
            <td><span style="font-weight:600; color:${item.stock_quantity < 5 ? '#ef4444':'#1e293b'}">${item.stock_quantity}</span></td>
            <td><button onclick="appendCartItem(${item.id})">Add to Cart</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function appendCartItem(id) {
    const product = localInventory.find(p => p.id === id);
    if (!product || product.stock_quantity <= 0) return;

    const existingCartItem = shoppingCart.find(c => c.id === id);
    if (existingCartItem) {
        if (existingCartItem.qtySold < product.stock_quantity) {
            existingCartItem.qtySold++;
        }
    } else {
        shoppingCart.push({ ...product, qtySold: 1 });
    }
    renderCartDisplay();
}

function modifyCartQty(id, delta) {
    const cartItem = shoppingCart.find(c => c.id === id);
    const product = localInventory.find(p => p.id === id);
    if (!cartItem) return;

    cartItem.qtySold += delta;
    if (cartItem.qtySold > product.stock_quantity) cartItem.qtySold = product.stock_quantity;
    
    if (cartItem.qtySold <= 0) {
        shoppingCart = shoppingCart.filter(c => c.id !== id);
    }
    renderCartDisplay();
}

function renderCartDisplay() {
    const container = document.getElementById('cart-container');
    container.innerHTML = '';
    let runningTotal = 0;

    shoppingCart.forEach(item => {
        const itemTotal = item.price * item.qtySold;
        runningTotal += itemTotal;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <span>${item.name}</span>
                <span>₵${itemTotal.toFixed(2)}</span>
            </div>
            <div class="cart-qty-controls">
                <button onclick="modifyCartQty(${item.id}, -1)">-</button>
                <input type="text" value="${item.qtySold}" readonly>
                <button onclick="modifyCartQty(${item.id}, 1)">+</button>
            </div>
        `;
        container.appendChild(div);
    });

    document.getElementById('cart-grand-total').innerText = `₵${runningTotal.toFixed(2)}`;
}

async function executeCashout() {
    if (shoppingCart.length === 0) return;
    const email = localStorage.getItem('shop_owner_email');

    try {
        const res = await fetch('/inventory/cashout-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: shoppingCart, email: email })
        });

        if (res.ok) {
            logReceiptToHistory(shoppingCart);
            shoppingCart = [];
            renderCartDisplay();
            pullLiveDashboardData();
        }
    } catch (err) {
        alert("Transaction failed to route.");
    }
}

function logReceiptToHistory(cart) {
    const tbody = document.getElementById('history-table-body');
    if (tbody.innerHTML.includes('No custom trades verified')) tbody.innerHTML = '';

    const timestamp = new Date().toLocaleTimeString();
    const itemNames = cart.map(c => `${c.name} (x${c.qtySold})`).join(', ');
    const totalCost = cart.reduce((sum, c) => sum + (c.price * c.qtySold), 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${timestamp}</td><td>${itemNames}</td><td><strong>₵${totalCost.toFixed(2)}</strong></td>`;
    tbody.insertBefore(tr, tbody.firstChild);
}

function toggleIntakeForm(isNew) {
    document.getElementById('group-select-existing').style.display = isNew ? 'none' : 'block';
    document.getElementById('group-new-name').style.display = isNew ? 'block' : 'none';
    document.getElementById('restock-form').reset();
    if(isNew) document.querySelectorAll('input[name="intake-type"]')[1].checked = true;
}

function populateRestockDropdown() {
    const select = document.getElementById('restock-select-item');
    select.innerHTML = '';
    localInventory.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.name;
        opt.innerText = item.name;
        select.appendChild(opt);
    });
}

async function submitStockAdjustment(event) {
    event.preventDefault();
    const email = localStorage.getItem('shop_owner_email');
    const type = document.querySelector('input[name="intake-type"]:checked').value;
    
    let itemName = type === 'new' 
        ? document.getElementById('restock-new-name').value.trim() 
        : document.getElementById('restock-select-item').value;

    const payload = {
        email: email,
        items: [{
            name: itemName,
            cost_price: parseFloat(document.getElementById('restock-cost').value),
            price: parseFloat(document.getElementById('restock-price').value),
            qty: parseInt(document.getElementById('restock-qty').value)
        }]
    };

    try {
        const res = await fetch('/inventory/add-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            document.getElementById('restock-form').reset();
            alert("Inventory updated smoothly!");
            switchTab('floor');
        } else {
            alert("Failed to update catalog stock parameters.");
        }
    } catch (err) {
        alert("Network routing crash during stock update operation.");
    }
}

function handleLogout() {
    localStorage.clear();
    window.location.href = '/login.html';
}