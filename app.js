// Check if user is logged in
const userId = localStorage.getItem('shopFlowUserId');
const shopName = localStorage.getItem('shopFlowName');

if (!userId) {
    window.location.href = "/signup";
}

document.querySelector('h1').innerText = `ShopFlow: ${shopName}`;

let inventory = [];
let salesHistory = [];
let currentBill = [];

const itemGrid = document.getElementById('item-grid');
const billContainer = document.getElementById('bill-items');
const totalDisplay = document.getElementById('bill-total');
const historyBody = document.getElementById('history-body');

async function init() {
    const [prodRes, salesRes] = await Promise.all([
        fetch(`/api/products/${userId}`),
        fetch(`/api/sales/${userId}`)
    ]);
    inventory = await prodRes.json();
    salesHistory = await salesRes.json();
    renderAll();
    renderHistory();
    updateStats();
}

// LOGOUT FUNCTION
window.logout = () => {
    localStorage.clear();
    window.location.href = "/signup";
};

// MODIFIED SAVE (Includes userId)
document.getElementById('add-item-form').onsubmit = async (e) => {
    e.preventDefault();
    const itemData = {
        userId: userId,
        id: document.getElementById('edit-item-id').value || null,
        name: document.getElementById('item-name').value,
        price: parseFloat(document.getElementById('item-price').value),
        stock: parseInt(document.getElementById('item-stock').value)
    };
    await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData)
    });
    document.getElementById('modal-overlay').style.display = 'none';
    init();
};

// ... (Rest of your rendering and bill logic remains the same)
init();
