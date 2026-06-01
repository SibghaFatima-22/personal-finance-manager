const API_URL = "http://localhost:3000/transactions";

// =======================
// GLOBAL STATE
// =======================

let allTransactions = [];
let financeChart;
let userCurrentPage = 1;

// =======================
// DOM ELEMENTS
// =======================

const transactionContainer = document.getElementById("transactionContainer");
const loadingMessage = document.getElementById("loadingMessage");
const errorMessage = document.getElementById("errorMessage");
const totalIncome = document.getElementById("totalIncome");
const totalExpense = document.getElementById("totalExpense");
const balance = document.getElementById("balance");
const transactionForm = document.getElementById("transactionForm");
const reportFilter = document.getElementById("reportFilter");
const filterType = document.getElementById("filterType");
const yearFilter = document.getElementById("yearFilter");
const userPagination = document.getElementById("userPagination");

// =======================
// FETCH DATA
// =======================

function updateYearFilterOptions() {
    const years = [...new Set(allTransactions.map(t => new Date(t.date).getFullYear()))].filter(Boolean);
    years.sort((a, b) => b - a);

    const currentYearVal = yearFilter.value;
    const currentOptions = Array.from(yearFilter.options).map(o => Number(o.value));

    if (JSON.stringify(years) === JSON.stringify(currentOptions) && yearFilter.options.length > 0) {
        return;
    }

    yearFilter.innerHTML = "";
    if (years.length === 0) {
        const option = document.createElement("option");
        option.value = new Date().getFullYear().toString();
        option.textContent = new Date().getFullYear();
        yearFilter.appendChild(option);
    } else {
        years.forEach(year => {
            const option = document.createElement("option");
            option.value = year;
            option.textContent = year;
            yearFilter.appendChild(option);
        });
    }

    if (currentYearVal && years.includes(Number(currentYearVal))) {
        yearFilter.value = currentYearVal;
    } else {
        yearFilter.value = yearFilter.options[0].value;
    }
}

async function fetchTransactions() {

try {

errorMessage.style.display = "none";
errorMessage.textContent = "";
loadingMessage.style.display = "block";

const response = await fetch(API_URL);

if (!response.ok) {
throw new Error("Fetch failed");
}

allTransactions = await response.json();

updateYearFilterOptions();

const selectedYear = Number(yearFilter.value);

let filteredTransactions = allTransactions.filter(
(transaction) => new Date(transaction.date).getFullYear() === selectedYear
);

const selectedType = filterType.value;

if (selectedType !== "All") {

filteredTransactions = filteredTransactions.filter(
(transaction) => transaction.type === selectedType
);

}

renderTransactions(filteredTransactions);
renderSummary(filteredTransactions);
renderChart(filteredTransactions);

}

catch(error) {

console.log("ERROR:", error);

errorMessage.style.display = "block";
errorMessage.textContent = error.message;

}

finally {

loadingMessage.style.display = "none";

}

}

// =======================
// RENDER TRANSACTIONS
// =======================

function renderTransactions(transactions) {

transactionContainer.innerHTML = "";
userPagination.innerHTML = "";

if (transactions.length === 0) {

transactionContainer.innerHTML = `
<h3>
No Transactions Found
</h3>
`;

return;

}

const totalItems = transactions.length;
const itemsPerPage = 5;
const totalPages = Math.ceil(totalItems / itemsPerPage);

if (userCurrentPage > totalPages) {
    userCurrentPage = totalPages;
}
if (userCurrentPage < 1) {
    userCurrentPage = 1;
}

const start = (userCurrentPage - 1) * itemsPerPage;
const end = start + itemsPerPage;
const paginatedTransactions = transactions.slice(start, end);

paginatedTransactions.forEach((transaction) => {

const card = document.createElement("div");

card.classList.add("transaction-card");

card.innerHTML = `

<div>

<h3>
${transaction.title}
</h3>

<p>
${transaction.category}
</p>

<p>
${transaction.date}
</p>

</div>

<div>

<strong>
${transaction.type}
</strong>

<h3>
Rs ${transaction.amount}
</h3>

</div>

`;

transactionContainer.appendChild(card);

});

if (totalPages > 1) {
    const prevBtn = document.createElement("button");
    prevBtn.textContent = "<";
    prevBtn.disabled = userCurrentPage === 1;
    prevBtn.addEventListener("click", () => {
        userCurrentPage--;
        renderTransactions(transactions);
    });

    const span = document.createElement("span");
    span.textContent = `Page ${userCurrentPage} of ${totalPages}`;

    const nextBtn = document.createElement("button");
    nextBtn.textContent = ">";
    nextBtn.disabled = userCurrentPage === totalPages;
    nextBtn.addEventListener("click", () => {
        userCurrentPage++;
        renderTransactions(transactions);
    });

    userPagination.appendChild(prevBtn);
    userPagination.appendChild(span);
    userPagination.appendChild(nextBtn);
}

}

// =======================
// SUMMARY
// =======================

function renderSummary(transactions) {

let income = 0;
let expense = 0;

transactions.forEach((transaction) => {

if (transaction.type === "Income") {

income += Number(transaction.amount);

}

else {

expense += Number(transaction.amount);

}

});

totalIncome.textContent = `Rs ${income}`;
totalExpense.textContent = `Rs ${expense}`;
balance.textContent = `Rs ${income-expense}`;

}

// =======================
// CHART
// =======================

function renderChart(transactions) {

const selectedReport = reportFilter.value;
const selectedYear = Number(yearFilter.value);
const now = new Date();

let labels = [];
let incomeData = [];
let expenseData = [];

if (selectedReport === "weekly") {
    const baseDate = new Date();
    baseDate.setFullYear(selectedYear);

    const dates = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        dates.push(d);
        labels.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    }

    incomeData = Array(7).fill(0);
    expenseData = Array(7).fill(0);

    transactions.forEach(t => {
        const tDate = new Date(t.date);
        for (let i = 0; i < 7; i++) {
            if (tDate.getDate() === dates[i].getDate() &&
                tDate.getMonth() === dates[i].getMonth() &&
                tDate.getFullYear() === dates[i].getFullYear()) {
                if (t.type === "Income") {
                    incomeData[i] += Number(t.amount);
                } else {
                    expenseData[i] += Number(t.amount);
                }
            }
        }
    });
} else if (selectedReport === "monthly") {
    labels = ["Week 1", "Week 2", "Week 3", "Week 4"];
    incomeData = Array(4).fill(0);
    expenseData = Array(4).fill(0);

    const targetMonth = now.getMonth();

    transactions.forEach(t => {
        const tDate = new Date(t.date);
        if (tDate.getFullYear() === selectedYear && tDate.getMonth() === targetMonth) {
            const day = tDate.getDate();
            let weekIndex = 0;
            if (day <= 7) weekIndex = 0;
            else if (day <= 14) weekIndex = 1;
            else if (day <= 21) weekIndex = 2;
            else weekIndex = 3;

            if (t.type === "Income") {
                incomeData[weekIndex] += Number(t.amount);
            } else {
                expenseData[weekIndex] += Number(t.amount);
            }
        }
    });
} else if (selectedReport === "yearly") {
    labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    incomeData = Array(12).fill(0);
    expenseData = Array(12).fill(0);

    transactions.forEach(t => {
        const tDate = new Date(t.date);
        if (tDate.getFullYear() === selectedYear) {
            const monthIndex = tDate.getMonth();
            if (t.type === "Income") {
                incomeData[monthIndex] += Number(t.amount);
            } else {
                expenseData[monthIndex] += Number(t.amount);
            }
        }
    });
}

const ctx = document.getElementById("financeChart");

if (!ctx) return;

if (financeChart) {

financeChart.destroy();

}

financeChart = new Chart(ctx, {

type: "line",

data: {

labels: labels,

datasets: [
    {
        label: "Income",
        data: incomeData,
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        tension: 0.3,
        fill: true
    },
    {
        label: "Expense",
        data: expenseData,
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        tension: 0.3,
        fill: true
    }
]

},

options: {
    responsive: true,
    plugins: {
        legend: {
            position: 'top',
        }
    },
    scales: {
        y: {
            beginAtZero: true
        }
    }
}

});

}

// =======================
// FORM SUBMIT
// =======================

transactionForm.addEventListener("submit",

async function(event) {

event.preventDefault();

const title = document.getElementById("title").value.trim();
const amount = document.getElementById("amount").value;
const type = document.getElementById("type").value;
const categorySelectValue = document.getElementById("category").value;
const customCategoryValue = document.getElementById("customCategory").value.trim();
const date = document.getElementById("date").value;
const notes = document.getElementById("notes").value;

let category = categorySelectValue;
if (category === "Other") {
    category = customCategoryValue;
}

if (!title || !amount || !type || !category || !date) {

alert("Fill all required fields.");

return;

}

const newTransaction = {

title,

amount: Number(amount),

type,

category,

date,

notes

};

try {

const response = await fetch(API_URL, {

method:"POST",

headers: {
"Content-Type":"application/json"
},

body: JSON.stringify(newTransaction)

});

if (!response.ok) {
throw new Error("POST failed");
}

        transactionForm.reset();
        userCurrentPage = 1;
        fetchTransactions();

}

catch(error) {

console.log("ERROR:", error);

errorMessage.style.display = "block";
errorMessage.textContent = error.message;

}

}
);

// =======================
// EVENT LISTENERS
// =======================

const categorySelect = document.getElementById("category");
const customCategoryInput = document.getElementById("customCategory");

categorySelect.addEventListener("change", function() {
    if (this.value === "Other") {
        customCategoryInput.style.display = "block";
        customCategoryInput.required = true;
    } else {
        customCategoryInput.style.display = "none";
        customCategoryInput.value = "";
        customCategoryInput.required = false;
    }
});

transactionForm.addEventListener("reset", function() {
    customCategoryInput.style.display = "none";
    customCategoryInput.value = "";
    customCategoryInput.required = false;
});

reportFilter.addEventListener("change", () => {
    userCurrentPage = 1;
    fetchTransactions();
});
filterType.addEventListener("change", () => {
    userCurrentPage = 1;
    fetchTransactions();
});
yearFilter.addEventListener("change", () => {
    userCurrentPage = 1;
    fetchTransactions();
});

// =======================
// INITIAL LOAD
// =======================

fetchTransactions();