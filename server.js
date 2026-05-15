const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 1. GET INVENTORY
app.get('/inventory/:email', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('shop_owner_email', req.params.email)
            .order('name', { ascending: true });
        if (error) throw error;
        res.json(data || []);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. BULK UPLOAD
app.post('/inventory/add-bulk', async (req, res) => {
    const { email, items } = req.body;
    try {
        const formatted = items.map(i => ({
            shop_owner_email: email,
            name: i.name,
            cost_price: parseFloat(i.cost_price) || 0,
            price: parseFloat(i.price) || 0,
            stock_quantity: parseInt(i.qty) || 0,
            expiry_date: i.expiry_date || null
        }));
        const { error } = await supabase.from('products').insert(formatted);
        if (error) throw error;
        res.status(200).send("Success");
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. BULK CASHOUT
app.post('/inventory/cashout-bulk', async (req, res) => {
    const { cart, email } = req.body;
    try {
        for (const item of cart) {
            const { data: p } = await supabase.from('products').select('*').eq('id', item.id).single();
            if (!p) continue;
            const profit = (Number(p.price) - Number(p.cost_price || 0)) * item.qtySold;
            await supabase.from('sales').insert([{
                item_name: p.name,
                quantity: item.qtySold,
                total_price: p.price * item.qtySold,
                net_profit: profit,
                shop_owner_email: email
            }]);
            await supabase.from('products').update({ stock_quantity: p.stock_quantity - item.qtySold }).eq('id', item.id);
        }
        res.status(200).send("Done");
    } catch (e) { res.status(500).send(e.message); }
});

// 4. ANALYTICS
app.get('/analytics/:email', async (req, res) => {
    try {
        const { data: sales } = await supabase.from('sales').select('*').eq('shop_owner_email', req.params.email);
        const rev = sales?.reduce((a, b) => a + Number(b.total_price || 0), 0) || 0;
        const prof = sales?.reduce((a, b) => a + Number(b.net_profit || 0), 0) || 0;
        const counts = {};
        sales?.forEach(s => {
            counts[s.item_name] = (counts[s.item_name] || 0) + (s.quantity || 0);
        });
        const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 5);
        res.json({ revenue: rev.toFixed(2), profit: prof.toFixed(2), topItems: top });
    } catch (e) { res.status(500).send(e.message); }
});

// --- ROUTES FOR HTML PAGES ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

// Catch-all route to prevent crashes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));