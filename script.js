import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, deleteDoc, doc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBEySSLpXQH2VW_YtFGKYo_ahiPkotS0VU",
    authDomain: "savvy-tracker-d97d9.firebaseapp.com",
    projectId: "savvy-tracker-d97d9",
    storageBucket: "savvy-tracker-d97d9.firebasestorage.app",
    messagingSenderId: "533272468228",
    appId: "1:533272468228:web:20f38c93b747e07121ce51",
    measurementId: "G-Y0W400VL63"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const budgetDisplayEl = document.getElementById('budget-display');
const budgetStatusEl = document.getElementById('budget-status');
const budgetBar = document.getElementById('budget-bar');
const money_plus = document.getElementById('money-plus');
const money_minus = document.getElementById('money-minus');
const list = document.getElementById('list');
const form = document.getElementById('form');
const emptyMsg = document.getElementById('empty-msg');
const categorySelect = document.getElementById('category');

// CATEGORY DEFINITIONS
const catOptions = {
    expense: ["Food 🍔", "Shopping 🛍️", "Transport 🚖", "Entertainment 🎉", "Health 💊", "Travel ✈️"],
    bill: ["Rent 🏠", "Electricity ⚡", "Water 💧", "Internet 🌐", "Phone 📱", "Insurance 🛡️"],
    income: ["Salary 💰", "Investment Returns 📈"]
};

let transactions = [];
let chartInstance = null;
let monthlyBudget = 0;
let unsubscribe = null;

// Auth Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('welcome-msg').innerText = user.email.split('@')[0];
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        loadTransactions(user.uid);
        updateCategoryOptions('expense'); // Default init
    } else {
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        transactions = [];
    }
});

// Category Updater
function updateCategoryOptions(type) {
    categorySelect.innerHTML = '';
    const opts = catOptions[type] || [];
    opts.forEach(opt => {
        const el = document.createElement('option');
        el.value = opt;
        el.innerText = opt;
        categorySelect.appendChild(el);
    });
}

// Event Listeners for Type Toggle
document.querySelectorAll('input[name="type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        updateCategoryOptions(e.target.value);
    });
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('button');
    const oldHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
    const email = document.getElementById('username').value.trim() + "@savvy.com";
    const pass = document.getElementById('password').value.trim();
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
        if(err.code.includes('user-not-found') || err.code.includes('invalid-credential')) {
             try { await createUserWithEmailAndPassword(auth, email, pass); } 
             catch (regErr) { alert(regErr.message); }
        } else {
            alert(err.message);
        }
    }
    btn.innerHTML = oldHTML;
});

// Load Data
function loadTransactions(uid) {
    const q = query(collection(db, "transactions"), where("uid", "==", uid), orderBy("date", "desc"));
    unsubscribe = onSnapshot(q, (snap) => {
        transactions = [];
        snap.forEach(doc => transactions.push({ id: doc.id, ...doc.data() }));
        updateUI();
    });
}

// Add Transaction
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="type"]:checked').value;
    const text = document.getElementById('text').value;
    const amountVal = +document.getElementById('amount').value;
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;

    if(!text || !amountVal) return;

    // Logic: Expenses AND Bills are negative. Income is positive.
    let finalAmount = Math.abs(amountVal);
    if (type === 'expense' || type === 'bill') {
        finalAmount = -finalAmount;
    }

    await addDoc(collection(db, "transactions"), {
        uid: auth.currentUser.uid,
        text, 
        amount: finalAmount,
        category, 
        date,
        type // Storing specific type 'bill', 'expense', or 'income'
    });
    
    document.getElementById('text').value = '';
    document.getElementById('amount').value = '';
});

// Update UI
function updateUI() {
    const amounts = transactions.map(t => t.amount);
    
    // Income is anything positive
    const income = amounts.filter(item => item > 0).reduce((acc, item) => (acc += item), 0);
    // Expenses + Bills (anything negative)
    const expense = (amounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0) * -1);

    money_plus.innerText = `+${formatRupee(income)}`;
    money_minus.innerText = `-${formatRupee(expense)}`;

    // Budget Logic
    if(monthlyBudget > 0) {
        const pct = (expense / monthlyBudget) * 100;
        budgetDisplayEl.innerText = formatRupee(monthlyBudget);
        budgetBar.style.width = `${Math.min(pct, 100)}%`;
        
        if (pct > 100) {
            budgetBar.style.backgroundColor = '#C0392B';
            budgetStatusEl.innerText = "Over Limit";
            budgetStatusEl.style.background = "#FDEDEC";
            budgetStatusEl.style.color = "#C0392B";
        } else {
            budgetBar.style.backgroundColor = '#557C55';
            budgetStatusEl.innerText = `${Math.round(pct)}% Used`;
            budgetStatusEl.style.background = "#E8F8F5";
            budgetStatusEl.style.color = "#557C55";
        }
    } else {
        budgetDisplayEl.innerText = "Set Limit";
        budgetStatusEl.innerText = "--";
    }

    // List
    list.innerHTML = '';
    if(transactions.length === 0) emptyMsg.style.display = 'block';
    else {
        emptyMsg.style.display = 'none';
        transactions.forEach((t, index) => {
            const item = document.createElement('li');
            item.style.animationDelay = `${index * 0.1}s`;
            
            // Determine Color based on type
            let amountColor = '#557C55'; // Sage Green (Income)

            if (t.type === 'expense') amountColor = '#C0392B'; // Red
            if (t.type === 'bill') amountColor = '#2980B9'; // Blue for Bills

            item.innerHTML = `
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:700; color:#2C3E2C;">${t.text}</span>
                    <span style="font-size:0.8rem; color:#7D8C7D;">${t.category} • ${t.date}</span>
                </div>
                <span style="font-weight:700; color:${amountColor}">
                    ${t.amount < 0 ? '-' : '+'} ${formatRupee(Math.abs(t.amount))}
                </span>
            `;
            list.appendChild(item);
        });
    }

    renderChart(transactions);
}

function renderChart(txns) {
    const ctx = document.getElementById('expense-chart');
    if(!ctx) return;

    // Filter Expenses AND Bills for the chart
    const outflows = txns.filter(t => t.amount < 0);
    const categories = {};
    outflows.forEach(t => {
        if(categories[t.category]) categories[t.category] += Math.abs(t.amount);
        else categories[t.category] = Math.abs(t.amount);
    });

    const colors = ['#557C55', '#8FBC8F', '#A9BA9D', '#D2B48C', '#8B4513', '#6B8E23', '#2980B9', '#5DADE2'];

    if(chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories),
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '75%',
            layout: { padding: 10 },
            animation: { animateScale: true, animateRotate: true }
        }
    });
}

function formatRupee(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

window.setBudget = () => {
    const input = prompt("Enter Monthly Spending Limit (₹):", monthlyBudget || 0);
    if(input) { monthlyBudget = +input; updateUI(); }
}

window.logout = () => signOut(auth);

// ==========================================
// CSV EXPORT FUNCTION (FIXED)
// ==========================================
window.exportData = () => {
    if (transactions.length === 0) {
        alert("No data to export!");
        return;
    }

    // 1. Define Headers
    const headers = ["Date", "Description", "Category", "Type", "Amount (INR)"];
    
    // 2. Map data to CSV rows
    const rows = transactions.map(t => [
        t.date,
        `"${t.text.replace(/"/g, '""')}"`, // Escape quotes in description
        t.category,
        t.type.toUpperCase(),
        t.amount
    ]);

    // 3. Combine headers and rows
    const csvContent = [
        headers.join(","), 
        ...rows.map(r => r.join(","))
    ].join("\n");

    // 4. Create Blob
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    // 5. Trigger Download
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `savvy_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};