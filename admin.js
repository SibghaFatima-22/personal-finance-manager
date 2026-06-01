const API_URL = "http://localhost:3000/transactions";

const tableBody = document.getElementById("adminTableBody");
const transactionCount = document.getElementById("transactionCount");
const adminIncome = document.getElementById("adminIncome");
const adminExpense = document.getElementById("adminExpense");
const editForm = document.getElementById("editForm");
const searchInput = document.getElementById("searchInput");
const filterTypeSelect = document.getElementById("filterTypeSelect");
const sortSelect = document.getElementById("sortSelect");
const adminPagination = document.getElementById("adminPagination");

let adminCurrentPage = 1;

// FETCH

async function fetchAdmin() {

    try {

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Fetch failed");
        }

        let transactions = await response.json();

        // SEARCH

        const searchValue = searchInput.value.trim().toLowerCase();

        if (searchValue !== "") {

            transactions = transactions.filter((transaction) =>

                transaction.title.toLowerCase().startsWith(searchValue)

            );

        }

        // TYPE FILTER

        const filterTypeValue = filterTypeSelect.value;

        if (filterTypeValue !== "All") {

            transactions = transactions.filter((transaction) =>

                transaction.type === filterTypeValue

            );

        }

        // SORT

        if (sortSelect.value === "amountAsc") {

            transactions.sort((a, b) => a.amount - b.amount);

        } 
        
        else if (sortSelect.value === "amountDesc") {

            transactions.sort((a, b) => b.amount - a.amount);

        } 
        
        else if (sortSelect.value === "title") {

            transactions.sort((a, b) =>
                a.title.localeCompare(b.title)
            );

        }

        renderTable(transactions);
        renderStats(transactions);

    } 
    
    catch (error) {

        console.error(error);

    }

}

// TABLE

function renderTable(transactions) {

    tableBody.innerHTML = "";
    adminPagination.innerHTML = "";

    const totalItems = transactions.length;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (adminCurrentPage > totalPages) {
        adminCurrentPage = totalPages;
    }
    if (adminCurrentPage < 1) {
        adminCurrentPage = 1;
    }

    const start = (adminCurrentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedTransactions = transactions.slice(start, end);

    paginatedTransactions.forEach((transaction) => {

        const row = document.createElement("tr");

        row.innerHTML = `

        <td>${transaction.title}</td>

        <td>Rs ${transaction.amount}</td>

        <td>${transaction.type}</td>

        <td>

            <button
                class="edit-btn"
                data-id="${transaction.id}"
                data-title="${transaction.title}"
                data-amount="${transaction.amount}">
                Edit
            </button>

            <button
                class="delete-btn"
                data-id="${transaction.id}">
                Delete
            </button>

        </td>

        `;

        tableBody.appendChild(row);

    });

    document.querySelectorAll(".edit-btn").forEach((btn) => {

        btn.addEventListener("click", function () {

            loadEdit(
                this.dataset.id,
                this.dataset.title,
                this.dataset.amount
            );

        });

    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {

        btn.addEventListener("click", function () {

            deleteTransaction(this.dataset.id);

        });

    });

    if (totalPages > 1) {
        const prevBtn = document.createElement("button");
        prevBtn.textContent = "<";
        prevBtn.disabled = adminCurrentPage === 1;
        prevBtn.addEventListener("click", () => {
            adminCurrentPage--;
            renderTable(transactions);
        });

        const span = document.createElement("span");
        span.textContent = `Page ${adminCurrentPage} of ${totalPages}`;

        const nextBtn = document.createElement("button");
        nextBtn.textContent = ">";
        nextBtn.disabled = adminCurrentPage === totalPages;
        nextBtn.addEventListener("click", () => {
            adminCurrentPage++;
            renderTable(transactions);
        });

        adminPagination.appendChild(prevBtn);
        adminPagination.appendChild(span);
        adminPagination.appendChild(nextBtn);
    }

}

// STATS

function renderStats(transactions) {

    transactionCount.textContent = transactions.length;

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

    adminIncome.textContent = `Rs ${income}`;
    adminExpense.textContent = `Rs ${expense}`;

}

// LOAD EDIT

function loadEdit(id, title, amount) {

    const editTitle = document.getElementById("editTitle");
    const editAmount = document.getElementById("editAmount");

    document.getElementById("editId").value = id;
    editTitle.value = title;
    editAmount.value = amount;

    editTitle.disabled = false;
    editAmount.disabled = false;

}

// PATCH

editForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const id = document.getElementById("editId").value;

    const title = document.getElementById("editTitle").value;

    const amount = Number(
        document.getElementById("editAmount").value.trim()
    );

    try {

        const response = await fetch(`${API_URL}/${id}`, {

            method: "PATCH",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                title,
                amount
            })

        });

        if (!response.ok) {
            throw new Error("Update failed");
        }

        fetchAdmin();
        editForm.reset();
        document.getElementById("editTitle").disabled = true;
        document.getElementById("editAmount").disabled = true;

    } 
    
    catch (error) {

        alert(error.message);

    }

});

// DELETE

async function deleteTransaction(id) {

    const confirmDelete = confirm("Delete transaction?");

    if (!confirmDelete) {
        return;
    }

    try {

        const response = await fetch(`${API_URL}/${id}`, {

            method: "DELETE"

        });

        if (!response.ok) {
            throw new Error("Delete failed");
        }

        fetchAdmin();

    } 
    
    catch (error) {

        alert(error.message);

    }

}

// INITIAL

searchInput.addEventListener("input", () => {
    adminCurrentPage = 1;
    fetchAdmin();
});

filterTypeSelect.addEventListener("change", () => {
    adminCurrentPage = 1;
    fetchAdmin();
});

sortSelect.addEventListener("change", () => {
    adminCurrentPage = 1;
    fetchAdmin();
});

fetchAdmin();