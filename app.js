// Dynamic API URL selection: uses live Render URL when deployed, defaults to localhost for local testing
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://zoupie-pos.onrender.com';

// Global cart array for checkout
let cart = [];

// --- 1. AUTHENTICATION / LOGIN ---
async function login(email, password) {
    const loginBtn = document.querySelector('button[onclick*="login"]');
    if (loginBtn) loginBtn.innerText = "Verifying...";

    try {
        // We ping the inventory route to see if the shop profile exists
        const response = await fetch(`${API_URL}/inventory/${email}`);
        if (!response.ok) throw new Error("Server communication issue.");
        
        const products = await response.json();
        
        // Save session email to localStorage for dashboard use
        localStorage.setItem('shop_owner_email', email);
        window.location.href = '/dashboard';
    } catch (error) {
        console.error(error);
        alert("Could not connect to the server. Make sure your database and Render backend are fully awake!");
        if (loginBtn) loginBtn.innerText = "Login";
    }
}

// --- 2. FETCH AND RENDER INVENTORY ---
async function loadInventory() {
    const email = localStorage.getItem('shop_owner_email');
    if (!email) {
        window.location.href = '/login';
        return;
    }

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
    } catch (error) {
        console.error("Error loading inventory:", error);
    }
}

// --- 3. BULK INVENTORY UPLOAD ---
async function uploadBulkItems(itemsArray) {
    const email = localStorage.getItem('shop_owner_email');
    try {
        const response = await fetch(`${API_URL}/inventory/add-bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, items: itemsArray })
        });
        
        if (response.ok) {
            alert("Bulk items added successfully!");
            loadInventory();
        } else {
            alert("Failed to upload bulk items.");
        }
    } catch (error) {
        console.error("Bulk upload error:", error);
    }
}

// --- 4. CART & BULK CASHOUT FLOOR LOGIC ---
function addToCart(id, name, price, maxStock) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        if (existing.qtySold >= maxStock) {
            alert("Cannot exceed available stock physical limits!");
            return;
        }
        existing.qtySold++;
    } else {
        if (maxStock <= 0) {
            alert("Item is completely out of stock!");
            return;
        }
        cart.push({ id, name, price, qtySold: 1 });
    }
    renderCart();
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
            <span>${item.name} (x${item.qtySold})</span>
            <span>₵${(item.price * item.qtySold).toFixed(2)}</span>
        `;
        cartDiv.appendChild(div);
    });
    
    const totalDiv = document.getElementById('cart-grand-total');
    if (totalDiv) totalDiv.innerText = grandTotal.toFixed(2);
}

async function processBulkCashout() {
    if (cart.length === 0) {
        alert("Your transaction cart is currently empty!");
        return;
    }
    
    const email = localStorage.getItem('shop_owner_email');
    try {
        const response = await fetch(`${API_URL}/inventory/cashout-bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: cart, email: email })
        });
        
        if (response.ok) {
            alert("Transaction finalized successfully!");
            cart = [];
            renderCart();
            loadInventory();
            loadAnalytics(); // Refresh analytics grid if open
        } else {
            alert("Cashout failed to process.");
        }
    } catch (error) {
        console.error("Cashout system error:", error);
    }
}

// --- 5. DASHBOARD PERFORMANCE ANALYTICS ---
async function loadAnalytics() {
    const email = localStorage.getItem('shop_owner_email');
    try {
        const response = await fetch(`${API_URL}/analytics/${email}`);
        const data = await response.json();
        
        if (document.getElementById('total-revenue')) {
            document.getElementById('total-revenue').innerText = data.revenue;
        }
        if (document.getElementById('net-profit')) {
            document.getElementById('net-profit').innerText = data.profit;
        }
    } catch (error) {
        console.error("Analytics loading error:", error);
    }
}

// Auto-load matching UI elements depending on active dashboard context
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('inventory-table-body')) {
        loadInventory();
        loadAnalytics();
    }
});
        
