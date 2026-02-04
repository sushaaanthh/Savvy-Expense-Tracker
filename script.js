import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, deleteDoc, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- SECURE CONFIGURATION (Vite) ---
// These values are pulled from your local .env file
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

// STATE
let transactions = [];
let filteredTransactions = [];
let charts = { line: null, donut: null };
let monthlyBudget = localStorage.getItem('monthlyBudget') || 0;

// DOM ELEMENTS
const els = {
    landingScreen: document.getElementById('landing-screen'),
    loginScreen: document.getElementById('login-screen'),
    appScreen: document.getElementById('app-screen'),
    list: document.getElementById('list'),
    form: document.getElementById('form'),
    editId: document.getElementById('edit-id'),
    submitBtn: document.getElementById('submit-btn'),
    cancelBtn: document.getElementById('cancel-btn'),
    catSelect: document.getElementById('category'),
    filterPanel: document.getElementById('filter-panel'),
    toast: document.getElementById('toast'),
    balance: document.getElementById('balance-display'),
    inc: document.getElementById('money-plus'),
    exp: document.getElementById('money-minus'),
    statDaily: document.getElementById('stat-daily'),
    statTop: document.getElementById('stat-top'),
    statTopContainer: document.getElementById('stat-top-container'),
    budgetDisplay: document.getElementById('budget-display'),
    budgetBar: document.getElementById('budget-bar'),
    budgetStatus: document.getElementById('budget-status'),
    budgetWarning: document.getElementById('budget-warning'),
    fStart: document.getElementById('filter-date-start'),
    fEnd: document.getElementById('filter-date-end'),
    fCat: document.getElementById('filter-category'),
    fType: document.getElementById('filter-type'),
    filterBtn: document.getElementById('filter-icon-btn'),
    passToggle: document.getElementById('toggle-password'),
    passInput: document.getElementById('password'),
    voiceBtn: document.getElementById('voice-btn')
};

// CATEGORIES
const catOptions = {
    expense: ["Food 🍔", "Shopping 🛍️", "Transport 🚖", "Entertainment 🎉", "Health 💊", "Travel ✈️", "Education 📚"],
    bill: ["Rent 🏠", "Electricity ⚡", "Water 💧", "Internet 🌐", "Phone 📱", "Insurance 🛡️"],
    income: ["Salary 💰", "Investment 📈", "Freelance 💻", "Gift 🎁"]
};

// --- AUTH & NAVIGATION LOGIC ---

// 1. Check Auth Status on Load
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is logged in -> Go to App
        document.getElementById('welcome-msg').innerText = user.email.split('@')[0];
        els.landingScreen.classList.add('hidden');
        els.loginScreen.classList.add('hidden');
        els.appScreen.classList.remove('hidden');
        loadTransactions(user.uid);
        updateCategoryOptions('expense');
    } else {
        // User is NOT logged in -> Show Landing Page
        els.appScreen.classList.add('hidden');
        els.loginScreen.classList.add('hidden');
        els.landingScreen.classList.remove('hidden');
    }
});

// 2. Navigation Functions (Attached to Window for HTML access)
window.goToLogin = () => {
    els.landingScreen.classList.add('hidden');
    els.loginScreen.classList.remove('hidden');
};

window.goBackToLanding = () => {
    els.loginScreen.classList.add('hidden');
    els.landingScreen.classList.remove('hidden');
};

window.logout = () => signOut(auth);

// --- LOGIN LOGIC ---
els.passToggle.addEventListener('click', () => {
    const type = els.passInput.getAttribute('type') === 'password' ? 'text' : 'password';
    els.passInput.setAttribute('type', type);
    els.passToggle.classList.toggle('fa-eye-slash');
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // FIX: Remove spaces from username to prevent "Invalid Email" error
    const rawUsername = document.getElementById('username').value.trim();
    const cleanUsername = rawUsername.replace(/\s+/g, ''); 
    const email = cleanUsername + "@savvy.com";
    
    const pass = els.passInput.value.trim();

    if(pass.length < 6) return showToast("Password too short (min 6 chars)", "error");

    try { 
        await signInWithEmailAndPassword(auth, email, pass); 
    }
    catch (err) {
        console.error("Login Error:", err.code, err.message);

        if(err.code.includes('user-not-found') || err.code.includes('invalid-credential')) {
             try { 
                 await createUserWithEmailAndPassword(auth, email, pass); 
                 showToast("Account created!", "success");
             } 
             catch (regErr) { 
                 console.error("Registration Error:", regErr.code);
                 if (regErr.code === 'auth/email-already-in-use') {
                    showToast("User exists. Wrong password?", "error");
                 } else {
                    showToast(regErr.message, "error"); 
                 }
             }
        } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-login-credentials') {
            showToast("Wrong password for this user.", "error");
        } else { 
            showToast("Login failed: " + err.code, "error"); 
        }
    }
});

// CORE DATA
function loadTransactions(uid) {
    const q = query(collection(db, "transactions"), where("uid", "==", uid), orderBy("date", "desc"));
    onSnapshot(q, (snap) => {
        transactions = [];
        snap.forEach(doc => transactions.push({ id: doc.id, ...doc.data() }));
        filteredTransactions = [...transactions];
        updateUI();
    });
}

function updateCategoryOptions(type) {
    els.catSelect.innerHTML = '';
    (catOptions[type] || []).forEach(opt => {
        const el = document.createElement('option');
        el.value = opt;
        el.innerText = opt;
        els.catSelect.appendChild(el);
    });
    const allCats = new Set([...catOptions.expense, ...catOptions.bill, ...catOptions.income]);
    els.fCat.innerHTML = '<option value="all">All Categories</option>';
    allCats.forEach(c => els.fCat.appendChild(new Option(c, c)));
}

document.querySelectorAll('input[name="type"]').forEach(r => {
    r.addEventListener('change', (e) => updateCategoryOptions(e.target.value));
});

// UI UPDATES
function updateUI() {
    const data = filteredTransactions;
    const amounts = data.map(t => t.amount);
    const inc = amounts.filter(x => x > 0).reduce((a, b) => a + b, 0);
    const exp = amounts.filter(x => x < 0).reduce((a, b) => a + b, 0) * -1;
    const bal = inc - exp;

    animateValue(els.inc, `+${formatRupee(inc)}`);
    animateValue(els.exp, `-${formatRupee(exp)}`);
    animateValue(els.balance, formatRupee(bal));

    if (monthlyBudget > 0) {
        const pct = (exp / monthlyBudget) * 100;
        els.budgetDisplay.innerText = formatRupee(monthlyBudget);
        els.budgetBar.style.transition = 'none';
        els.budgetBar.style.width = '0%';
        setTimeout(() => {
            els.budgetBar.style.transition = 'width 1.5s cubic-bezier(0.65, 0, 0.35, 1)';
            els.budgetBar.style.width = `${Math.min(pct, 100)}%`;
        }, 50);
        els.budgetStatus.innerText = `${Math.round(pct)}% Used`;
        els.budgetWarning.classList.toggle('hidden', pct < 80);
        els.budgetBar.style.backgroundColor = pct > 100 ? '#C0392B' : (pct > 80 ? '#F39C12' : '#557C55');
    }

    if (els.fCat.value !== 'all') {
        els.statTopContainer.style.display = 'none';
    } else {
        els.statTopContainer.style.display = 'block';
        const catMap = {};
        data.filter(t => t.amount < 0).forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount); });
        els.statTop.innerText = Object.keys(catMap).sort((a,b) => catMap[b] - catMap[a])[0] || "--";
    }
    els.statDaily.innerText = formatRupee(exp / (new Date().getDate() || 1));

    els.list.innerHTML = '';
    if (!data.length) document.getElementById('empty-msg').style.display = 'block';
    else {
        document.getElementById('empty-msg').style.display = 'none';
        data.forEach((t, i) => {
            const item = document.createElement('li');
            item.style.animationDelay = `${i * 0.05}s`;
            item.innerHTML = `
                <div><b>${t.text}</b> <small style="color:#777">(${t.category})</small><div style="font-size:0.75rem; color:#999">${t.date}</div></div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="${t.amount > 0 ? 'text-green' : 'text-red'}" style="font-weight:bold;">${t.amount > 0 ? '+' : '-'} ${formatRupee(Math.abs(t.amount))}</span>
                    <button class="icon-btn" onclick="editTransaction('${t.id}')"><i class="fas fa-pen"></i></button>
                    <button class="icon-btn" onclick="removeTransaction('${t.id}')"><i class="fas fa-trash"></i></button>
                </div>`;
            els.list.appendChild(item);
        });
    }
    renderCharts(data);
}

function animateValue(obj, val) { obj.innerText = val; }

function renderCharts(data) {
    const dateMap = {};
    data.filter(t => t.amount < 0).forEach(t => { dateMap[t.date] = (dateMap[t.date] || 0) + Math.abs(t.amount); });
    const sortedDates = Object.keys(dateMap).sort();
    
    if(charts.line) charts.line.destroy();
    if(charts.donut) charts.donut.destroy();

    const ctxLine = document.getElementById('line-chart');
    charts.line = new Chart(ctxLine, {
        type: 'line',
        data: { labels: sortedDates, datasets: [{ 
            label: 'Spending', 
            data: sortedDates.map(d => dateMap[d]), 
            borderColor: '#2E4A2E',
            backgroundColor: 'rgba(85, 124, 85, 0.1)',
            fill: true,
            tension: 0.4
        }]},
        options: { 
            responsive: true, maintainAspectRatio: false,
            animation: { x: { type: 'number', easing: 'linear', duration: 1500, from: NaN, delay: 500 } },
            plugins: { legend: { display: false } }
        }
    });

    const catMap = {};
    data.filter(t => t.amount < 0).forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount); });
    
    const ctxDonut = document.getElementById('donut-chart');
    charts.donut = new Chart(ctxDonut, {
        type: 'doughnut',
        data: { 
            labels: Object.keys(catMap), 
            datasets: [{ 
                data: Object.values(catMap), 
                backgroundColor: ['#557C55', '#C0392B', '#2980B9', '#F39C12', '#8E44AD'],
                borderWidth: 0
            }] 
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            animation: { animateScale: true, animateRotate: true, duration: 1500, easing: 'easeInOutQuart' },
            plugins: { legend: { position: 'bottom', labels: { font: { family: 'Zilla Slab' }, usePointStyle: true } } }
        }
    });
}

// FORM & FILTERS
els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="type"]:checked').value;
    const text = document.getElementById('text').value;
    const amountVal = +document.getElementById('amount').value;
    const category = els.catSelect.value;
    const date = document.getElementById('date').value;
    const editId = els.editId.value;

    if (!text || !amountVal || !date) return alert("Fill all fields");

    let finalAmount = Math.abs(amountVal);
    if (type !== 'income') finalAmount = -finalAmount;

    const data = { uid: auth.currentUser.uid, text, amount: finalAmount, category, date, type };

    try {
        if (editId) await updateDoc(doc(db, "transactions", editId), data);
        else await addDoc(collection(db, "transactions"), data);
        window.resetForm();
    } catch (err) { console.error(err); }
});

window.resetForm = () => {
    els.form.reset();
    els.editId.value = '';
    els.submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Entry';
    els.cancelBtn.classList.add('hidden');
};

window.editTransaction = (id) => {
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    document.getElementById('text').value = t.text;
    document.getElementById('amount').value = Math.abs(t.amount);
    document.getElementById('date').value = t.date;
    els.editId.value = t.id;
    document.querySelector(`input[value="${t.type}"]`).checked = true;
    updateCategoryOptions(t.type);
    els.catSelect.value = t.category;
    els.submitBtn.innerHTML = '<i class="fas fa-check"></i> Update';
    els.cancelBtn.classList.remove('hidden');
    els.form.scrollIntoView({ behavior: 'smooth' });
};

window.removeTransaction = async (id) => {
    if (confirm("Delete this?")) await deleteDoc(doc(db, "transactions", id));
};

window.toggleFilters = () => els.filterPanel.classList.toggle('hidden');
window.applyFilters = () => {
    const start = els.fStart.value; const end = els.fEnd.value;
    const cat = els.fCat.value; const type = els.fType.value;
    filteredTransactions = transactions.filter(t => {
        let match = true;
        if (start && t.date < start) match = false;
        if (end && t.date > end) match = false;
        if (cat !== 'all' && t.category.split(' ')[0] !== cat.split(' ')[0]) match = false;
        if (type !== 'all' && t.type !== type) match = false;
        return match;
    });
    els.filterBtn.classList.add('active-filter');
    updateUI();
};
window.clearFilters = () => { els.fStart.value=''; els.fEnd.value=''; els.fCat.value='all'; els.fType.value='all'; filteredTransactions=[...transactions]; els.filterBtn.classList.remove('active-filter'); updateUI(); };
window.setBudget = () => { const v = prompt("Limit (₹):", monthlyBudget); if(v){monthlyBudget=+v; localStorage.setItem('monthlyBudget',v); updateUI();} };
window.printReport = () => window.print();
window.exportReport = () => {
    const csv = ["Date,Text,Category,Type,Amount", ...filteredTransactions.map(t => `${t.date},${t.text},${t.category},${t.type},${t.amount}`)].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv'})); a.download = 'savvy.csv'; a.click();
};

function formatRupee(v) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v); }
function showToast(msg, type) { els.toast.innerText = msg; els.toast.style.background = type === 'error' ? '#C0392B' : '#333'; els.toast.classList.add('show'); setTimeout(() => els.toast.classList.remove('show'), 3000); }

// VOICE LOGIC
if (window.SpeechRecognition || window.webkitSpeechRecognition) {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-IN';
    const synonyms = {
        'food': { type: 'expense', cat: 'Food 🍔' }, 'burger': { type: 'expense', cat: 'Food 🍔' }, 'lunch': { type: 'expense', cat: 'Food 🍔' }, 'dinner': { type: 'expense', cat: 'Food 🍔' },
        'rent': { type: 'bill', cat: 'Rent 🏠' }, 'house': { type: 'bill', cat: 'Rent 🏠' },
        'cab': { type: 'expense', cat: 'Transport 🚖' }, 'uber': { type: 'expense', cat: 'Transport 🚖' }, 
        'petrol': { type: 'expense', cat: 'Transport 🚖' }, 'diesel': { type: 'expense', cat: 'Transport 🚖' }, 'vehicle': { type: 'expense', cat: 'Transport 🚖' }, 'fuel': { type: 'expense', cat: 'Transport 🚖' },
        'salary': { type: 'income', cat: 'Salary 💰' }, 'money': { type: 'income', cat: 'Salary 💰' },
        'phone': { type: 'bill', cat: 'Phone 📱' }, 'recharge': { type: 'bill', cat: 'Phone 📱' },
        'shopping': { type: 'expense', cat: 'Shopping 🛍️' }, 'clothes': { type: 'expense', cat: 'Shopping 🛍️' }, 'buy': { type: 'expense', cat: 'Shopping 🛍️' }, 'bought': { type: 'expense', cat: 'Shopping 🛍️' }, 'mall': { type: 'expense', cat: 'Shopping 🛍️' }, 'store': { type: 'expense', cat: 'Shopping 🛍️' },
        'movie': { type: 'expense', cat: 'Entertainment 🎉' }, 'film': { type: 'expense', cat: 'Entertainment 🎉' }, 'cinema': { type: 'expense', cat: 'Entertainment 🎉' },
        'school': { type: 'expense', cat: 'Education 📚' }, 'college': { type: 'expense', cat: 'Education 📚' }, 'tuition': { type: 'expense', cat: 'Education 📚' },
        'doctor': { type: 'expense', cat: 'Health 💊' }, 'medicine': { type: 'expense', cat: 'Health 💊' }, 'hospital': { type: 'expense', cat: 'Health 💊' }
    };
    els.voiceBtn.addEventListener('click', () => { recognition.start(); els.voiceBtn.classList.add('voice-active'); });
    recognition.onresult = (e) => {
        const cmd = e.results[0][0].transcript.toLowerCase();
        const amt = cmd.match(/(\d+)/);
        if (amt) document.getElementById('amount').value = amt[0];
        for (const [key, val] of Object.entries(synonyms)) {
            if (cmd.includes(key)) {
                const radio = document.querySelector(`input[value="${val.type}"]`);
                radio.checked = true; radio.dispatchEvent(new Event('change')); 
                setTimeout(() => { els.catSelect.value = val.cat; }, 50);
                break;
            }
        }
        document.getElementById('text').value = cmd.charAt(0).toUpperCase() + cmd.slice(1);
        els.voiceBtn.classList.remove('voice-active');
    };
    recognition.onerror = () => { els.voiceBtn.classList.remove('voice-active'); };
}