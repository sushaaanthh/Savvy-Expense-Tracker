// --- DOM Elements ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('login-error');
const welcomeMsg = document.getElementById('welcome-msg');

const balanceEl = document.getElementById('balance');
const money_plus = document.getElementById('money-plus');
const money_minus = document.getElementById('money-minus');
const budgetDisplay = document.getElementById('budget-display');
const budgetBar = document.getElementById('budget-bar');
const budgetAlert = document.getElementById('budget-alert');

const list = document.getElementById('list');
const form = document.getElementById('form');
const text = document.getElementById('text');
const amount = document.getElementById('amount');
const category = document.getElementById('category');
const dateInput = document.getElementById('date');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit');
const formTitle = document.getElementById('form-title');

const searchInput = document.getElementById('search');
const sortFilter = document.getElementById('sort-filter');
const emptyMsg = document.getElementById('empty-msg');

// --- State ---
let currentUser = localStorage.getItem('savvy_user');
let transactions = [];
let monthlyBudget = 0;
let editMode = false;
let editId = null;
let expenseChart = null;

// --- Helper: Format as Indian Rupee ---
function formatRupee(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(amount);
}

// --- Init ---
function init() {
    dateInput.valueAsDate = new Date(); // Default to today
    if (currentUser) {
        showApp();
    } else {
        showLogin();
    }
}

// --- Auth Logic (Updated) ---
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = usernameInput.value.trim();
    const pass = passwordInput.value.trim();

    // Industry Logic: Password must be first 4 letters of username
    // Note: If username is "Bob", substring(0,4) is "Bob".
    const expectedPass = user.substring(0, 4);

    if (user && pass === expectedPass) {
        // Success
        currentUser = user;
        localStorage.setItem('savvy_user', user);
        loginError.classList.add('hidden');
        showApp();
    } else {
        // Failure
        loginError.classList.remove('hidden');
        loginError.innerHTML = `<i class="fas fa-circle-exclamation"></i> Password must be first 4 letters of username ("${expectedPass}")`;
        
        // Shake Animation
        const btn = loginForm.querySelector('button');
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 300);
    }
});

function logout() {
    if(confirm("Are you sure you want to logout?")) {
        currentUser = null;
        localStorage.removeItem('savvy_user');
        showLogin();
    }
}

function showLogin() {
    appScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    usernameInput.value = '';
    passwordInput.value = '';
    loginError.classList.add('hidden');
}

function showApp() {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    welcomeMsg.innerText = `Hello, ${currentUser}`;

    const storedData = localStorage.getItem(`savvy_data_${currentUser}`);
    const storedBudget = localStorage.getItem(`savvy_budget_${currentUser}`);
    
    transactions = storedData ? JSON.parse(storedData) : [];
    monthlyBudget = storedBudget ? +storedBudget : 0;
    
    renderHistory();
    updateValues();
    updateBudgetUI();
}

// --- Transactions ---
function addTransaction(e) {
    e.preventDefault();

    if (text.value.trim() === '' || amount.value.trim() === '') return;

    const type = document.querySelector('input[name="type"]:checked').value;
    let txnAmount = +amount.value;
    
    if (type === 'expense') txnAmount = -Math.abs(txnAmount);
    else txnAmount = Math.abs(txnAmount);

    if (editMode) {
        const index = transactions.findIndex(t => t.id === editId);
        transactions[index] = { 
            id: editId, 
            text: text.value, 
            amount: txnAmount, 
            category: category.value,
            date: dateInput.value,
            type: type
        };
        cancelEdit();
    } else {
        const transaction = {
            id: generateID(),
            text: text.value,
            amount: txnAmount,
            category: category.value,
            date: dateInput.value || new Date().toISOString().split('T')[0],
            type: type
        };
        transactions.push(transaction);
    }

    updateLocalStorage();
    renderHistory();
    updateValues();
    
    text.value = '';
    amount.value = '';
    dateInput.valueAsDate = new Date();
}

function editTransaction(id) {
    const txn = transactions.find(t => t.id === id);
    if (!txn) return;

    editMode = true;
    editId = id;
    
    text.value = txn.text;
    amount.value = Math.abs(txn.amount);
    category.value = txn.category;
    dateInput.value = txn.date;
    
    if (txn.amount < 0) {
        document.getElementById('type-expense').click();
    } else {
        document.getElementById('type-income').click();
    }

    submitBtn.innerText = "Update Transaction";
    submitBtn.style.background = "#f39c12"; 
    cancelEditBtn.classList.remove('hidden');
    formTitle.innerText = "Edit Transaction";
    form.scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    editMode = false;
    editId = null;
    text.value = '';
    amount.value = '';
    submitBtn.innerText = "Add Transaction";
    submitBtn.style.background = ""; 
    cancelEditBtn.classList.add('hidden');
    formTitle.innerText = "Add Transaction";
}

function generateID() {
    return Math.floor(Math.random() * 100000000);
}

function removeTransaction(id) {
    if(confirm("Delete this transaction?")) {
        transactions = transactions.filter(transaction => transaction.id !== id);
        updateLocalStorage();
        renderHistory();
        updateValues();
    }
}

function updateLocalStorage() {
    localStorage.setItem(`savvy_data_${currentUser}`, JSON.stringify(transactions));
}

// --- Render & UI ---
function renderHistory() {
    list.innerHTML = '';
    
    const searchTerm = searchInput.value.toLowerCase();
    let filtered = transactions.filter(t => t.text.toLowerCase().includes(searchTerm));

    const sortType = sortFilter.value;
    filtered.sort((a, b) => {
        if(sortType === 'latest') return new Date(b.date) - new Date(a.date);
        if(sortType === 'oldest') return new Date(a.date) - new Date(b.date);
        if(sortType === 'highest') return Math.abs(b.amount) - Math.abs(a.amount);
        if(sortType === 'lowest') return Math.abs(a.amount) - Math.abs(b.amount);
    });

    if (filtered.length === 0) {
        emptyMsg.style.display = 'block';
    } else {
        emptyMsg.style.display = 'none';
        filtered.forEach(addTransactionDOM);
    }
}

function addTransactionDOM(transaction) {
    const item = document.createElement('li');
    item.classList.add(transaction.amount < 0 ? 'minus' : 'plus');

    item.innerHTML = `
        <div class="list-info">
            <span>${transaction.text}</span>
            <span class="list-sub">${getIcon(transaction.category)} ${transaction.category} • ${transaction.date}</span>
        </div>
        <div style="display:flex; align-items:center;">
            <span class="amount" style="font-weight:bold; color:${transaction.amount < 0 ? 'var(--danger)' : 'var(--success)'}">
                ${transaction.amount < 0 ? '-' : '+'}${formatRupee(Math.abs(transaction.amount))}
            </span>
            <button class="action-btn edit-btn" onclick="editTransaction(${transaction.id})"><i class="fas fa-pen"></i></button>
            <button class="action-btn delete-btn" onclick="removeTransaction(${transaction.id})"><i class="fas fa-trash"></i></button>
        </div>
    `;
    list.appendChild(item);
}

function getIcon(cat) {
    const map = { 'Food':'🍔', 'Rent':'🏠', 'Transport':'🚗', 'Entertainment':'🎬', 'Shopping':'🛍️', 'Health':'💊', 'Salary':'💰', 'Investment':'📈', 'Other':'🔌' };
    return map[cat] || '⏺️';
}

function updateValues() {
    const amounts = transactions.map(t => t.amount);
    const total = amounts.reduce((acc, item) => (acc += item), 0);
    const income = amounts.filter(item => item > 0).reduce((acc, item) => (acc += item), 0);
    const expense = (amounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0) * -1);

    balanceEl.innerText = formatRupee(total);
    money_plus.innerText = `+${formatRupee(income)}`;
    money_minus.innerText = `-${formatRupee(expense)}`;

    updateBudgetUI(expense);
    renderChart();
}

function setBudget() {
    const input = prompt("Enter your monthly expense budget (₹):", monthlyBudget);
    if(input !== null && !isNaN(input)) {
        monthlyBudget = +input;
        localStorage.setItem(`savvy_budget_${currentUser}`, monthlyBudget);
        updateValues();
    }
}

function updateBudgetUI(totalExpense) {
    if(totalExpense === undefined) {
        const amounts = transactions.map(t => t.amount);
        totalExpense = (amounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0) * -1);
    }

    budgetDisplay.innerText = formatRupee(monthlyBudget);
    
    if(monthlyBudget > 0) {
        const pct = (totalExpense / monthlyBudget) * 100;
        budgetBar.style.width = `${Math.min(pct, 100)}%`;
        
        if(pct > 100) {
            budgetBar.style.backgroundColor = "var(--danger)";
            budgetAlert.innerText = "⚠️ Budget Exceeded!";
            budgetAlert.style.color = "var(--danger)";
        } else if (pct > 80) {
            budgetBar.style.backgroundColor = "var(--warning)";
            budgetAlert.innerText = "⚠️ Nearing limit";
        } else {
            budgetBar.style.backgroundColor = "var(--success)";
            budgetAlert.innerText = "Within safe limits";
            budgetAlert.style.color = "#999";
        }
    } else {
        budgetBar.style.width = '0%';
        budgetAlert.innerText = "No budget set";
    }
}

// --- Chart ---
function renderChart() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    const categories = {};
    transactions.forEach(t => {
        if(t.amount < 0) {
            if(categories[t.category]) categories[t.category] += Math.abs(t.amount);
            else categories[t.category] = Math.abs(t.amount);
        }
    });

    const labels = Object.keys(categories);
    const data = Object.values(categories);

    if (expenseChart) expenseChart.destroy();

    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses',
                data: data,
                backgroundColor: [
                    '#2E7D32', '#66BB6A', '#F9A825', '#C62828', '#1565C0', '#6A1B9A', '#455A64', '#FF7043', '#78909C'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } }
            }
        }
    });
}

function exportData() {
    if (transactions.length === 0) {
        alert("No data to export");
        return;
    }
    let csvContent = "data:text/csv;charset=utf-8,ID,Date,Description,Category,Type,Amount (INR)\n";
    transactions.forEach(t => {
        const row = `${t.id},${t.date},${t.text},${t.category},${t.type},${t.amount}`;
        csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `savvy_${currentUser}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Events
form.addEventListener('submit', addTransaction);

// Start
init();