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

// ELEMENTS
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

let transactions = [];
let chartInstance = null;
let monthlyBudget = 0;
let unsubscribe = null;

// AUTH
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('welcome-msg').innerText = user.email.split('@')[0];
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        loadTransactions(user.uid);
    } else {
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        transactions = [];
    }
});

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

// DATA
function loadTransactions(uid) {
    const q = query(collection(db, "transactions"), where("uid", "==", uid), orderBy("date", "desc"));
    unsubscribe = onSnapshot(q, (snap) => {
        transactions = [];
        snap.forEach(doc => transactions.push({ id: doc.id, ...doc.data() }));
        updateUI();
    });
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="type"]:checked').value;
    const text = document.getElementById('text').value;
    const amount = +document.getElementById('amount').value;
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;

    if(!text || !amount) return;

    await addDoc(collection(db, "transactions"), {
        uid: auth.currentUser.uid,
        text, 
        amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
        category, 
        date,
        type
    });
    
    document.getElementById('text').value = '';
    document.getElementById('amount').value = '';
});

// UI
function updateUI() {
    const amounts = transactions.map(t => t.amount);
    
    const income = amounts.filter(item => item > 0).reduce((acc, item) => (acc += item), 0);
    const expense = (amounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0) * -1);

    // Update Income/Expense Text (Green/Red)
    money_plus.innerText = `+${formatRupee(income)}`;
    money_minus.innerText = `-${formatRupee(expense)}`;

    // Budget Logic
    if(monthlyBudget > 0) {
        const pct = (expense / monthlyBudget) * 100;
        budgetDisplayEl.innerText = formatRupee(monthlyBudget);
        budgetBar.style.width = `${Math.min(pct, 100)}%`;
        
        if (pct > 100) {
            budgetBar.style.backgroundColor = '#C0392B'; // Red
            budgetStatusEl.innerText = "Over Limit";
            budgetStatusEl.style.background = "#FDEDEC";
            budgetStatusEl.style.color = "#C0392B";
        } else {
            budgetBar.style.backgroundColor = '#557C55'; // Sage
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
            item.innerHTML = `
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:700; color:#2C3E2C;">${t.text}</span>
                    <span style="font-size:0.8rem; color:#7D8C7D;">${t.category} • ${t.date}</span>
                </div>
                <span style="font-weight:700; color:${t.amount < 0 ? '#C0392B' : '#27AE60'}">
                    ${t.amount < 0 ? '-' : '+'} ${formatRupee(Math.abs(t.amount))}
                </span>
            `;
            list.appendChild(item);
        });
    }

    renderChart(transactions);
}

// Chart - Earth Tones Only
function renderChart(txns) {
    const ctx = document.getElementById('expense-chart');
    if(!ctx) return;

    const expenses = txns.filter(t => t.amount < 0);
    const categories = {};
    expenses.forEach(t => {
        if(categories[t.category]) categories[t.category] += Math.abs(t.amount);
        else categories[t.category] = Math.abs(t.amount);
    });

    // Sage, Green, Beige, Brown
    const colors = ['#557C55', '#8FBC8F', '#A9BA9D', '#D2B48C', '#8B4513', '#6B8E23', '#F5F5DC'];

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
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}

function formatRupee(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

window.setBudget = () => {
    const input = prompt("Enter Monthly Spending Limit (₹):", monthlyBudget || 0);
    if(input) {
        monthlyBudget = +input;
        updateUI();
    }
}

window.logout = () => signOut(auth);
window.exportData = () => alert("Downloading CSV...");