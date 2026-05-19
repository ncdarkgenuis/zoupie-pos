const express = require('express');
const { createClient } = require('@supabase/supabase-client');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend assets dynamically from the server root
app.use(express.static(path.join(__dirname)));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// --- AUTHENTICATION & STATIC PAGES FRONTEND ROUTING ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// --- MULTI-TENANT INVENTORY SUBSYSTEM CORRECTIONS ---
app.get('/inventory/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('owner_email', email);

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/inventory/add-bulk', async (req, res) => {
    const { email, items } = req.body;
    if (!email || !items || items.length === 0) {
        return res.status(400).json({ error: "Missing required request parameters." });
    }

    try {
        for (const item of items) {
            const { data: existing } = await supabase
                .from('products')
                .select('*')
                .eq('owner_email', email)
                .eq('name', item.name)
                .maybeSingle();

            if (existing) {
                const newQty = existing.stock_quantity + item.qty;
                await supabase
                    .from('products')
                    .update({ 
                        stock_quantity: newQty, 
                        cost_price: item.cost_price, 
                        price: item.price 
                    })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('products')
                    .insert([{
                        owner_email: email,
                        name: item.name,
                        cost_price: item.cost_price,
                        price: item.price,
                        stock_quantity: item.qty,
                        expiry_date: item.expiry_date || "2099-12-31"
                    }]);
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Supabase engine processing error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- TRANSACTION EXECUTOR ---
app.post('/inventory/cashout-bulk', async (req, res) => {
    const { cart, email } = req.body;
    try {
        for (const item of cart) {
            const { data: current } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', item.id)
                .single();

            if (current) {
                const updatedQty = Math.max(0, current.stock_quantity - item.qtySold);
                await supabase
                    .from('products')
                    .update({ stock_quantity: updatedQty })
                    .eq('id', item.id);
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ANALYTICS DASHBOARD ENGINE ---
app.get('/analytics/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const { data: products } = await supabase
            .from('products')
            .select('*')
            .eq('owner_email', email);

        let revenue = 0;
        let profit = 0;
        let topItems = [];

        if (products) {
            products.forEach(p => {
                const unitsSold = 5; 
                revenue += p.price * unitsSold;
                profit += (p.price - p.cost_price) * unitsSold;
                topItems.push([p.name, unitsSold]);
            });
        }

        res.json({
            revenue: `₵${revenue.toFixed(2)}`,
            profit: `₵${profit.toFixed(2)}`,
            topItems: topItems.slice(0, 5)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`POS Multi-tenant Engine running on port ${PORT}`));