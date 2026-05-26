const API_URL = "http://localhost:3000/transactions";

// =======================
// GLOBAL STATE
// =======================

let allTransactions = [];
let financeChart;

// =======================
// DOM ELEMENTS
// =======================

const transactionContainer =
document.getElementById("transactionContainer");

const loadingMessage =
document.getElementById("loadingMessage");

const errorMessage =
document.getElementById("errorMessage");

const totalIncome =
document.getElementById("totalIncome");

const totalExpense =
document.getElementById("totalExpense");

const balance =
document.getElementById("balance");

const transactionForm =
document.getElementById("transactionForm");

const reportFilter =
document.getElementById("reportFilter");

const filterType =
document.getElementById("filterType");


// =======================
// FETCH DATA
// =======================

async function fetchTransactions()
{

try
{

errorMessage.style.display =
"none";

errorMessage.textContent =
"";

loadingMessage.style.display =
"block";

const response =
await fetch(API_URL);

if(!response.ok)
{
throw new Error(
"Fetch failed"
);
}

allTransactions =
await response.json();



// FILTER TRANSACTIONS

let filteredTransactions =
[...allTransactions];

const selectedType =
filterType.value;

if(
selectedType !== "All"
)
{

filteredTransactions =
filteredTransactions.filter(
(transaction)=>

transaction.type === selectedType
);

}



renderTransactions(
filteredTransactions
);

renderSummary(
filteredTransactions
);

renderChart(
filteredTransactions
);

}

catch(error)
{

console.log(
"ERROR:",
error
);

errorMessage.style.display =
"block";

errorMessage.textContent =
error.message;

}

finally
{

loadingMessage.style.display =
"none";

}

}



// =======================
// RENDER TRANSACTIONS
// =======================

function renderTransactions(
transactions
)
{

transactionContainer.innerHTML =
"";

if(
transactions.length===0
)
{

transactionContainer.innerHTML =
`
<h3>
No Transactions Found
</h3>
`;

return;

}

transactions.forEach(
(transaction)=>
{

const card =
document.createElement(
"div"
);

card.classList.add(
"transaction-card"
);

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

transactionContainer.appendChild(
card
);

}
);

}



// =======================
// SUMMARY
// =======================

function renderSummary(
transactions
)
{

let income=0;
let expense=0;

transactions.forEach(
(transaction)=>
{

if(
transaction.type==="Income"
)
{

income +=
Number(
transaction.amount
);

}

else
{

expense +=
Number(
transaction.amount
);

}

}
);

totalIncome.textContent =
`Rs ${income}`;

totalExpense.textContent =
`Rs ${expense}`;

balance.textContent =
`Rs ${income-expense}`;

}



// =======================
// CHART
// =======================

function renderChart(
transactions
)
{

const selectedReport =
reportFilter.value;

const now =
new Date();

let income=0;
let expense=0;



const filtered =
transactions.filter(
(transaction)=>
{

const transactionDate =
new Date(
transaction.date
);



if(
selectedReport==="weekly"
)
{

const diffDays =

(now-transactionDate)

/

(1000*60*60*24);

return diffDays<=7;

}



if(
selectedReport==="monthly"
)
{

return(

transactionDate.getMonth()

===

now.getMonth()

&&

transactionDate.getFullYear()

===

now.getFullYear()

);

}



if(
selectedReport==="yearly"
)
{

return(

transactionDate.getFullYear()

===

now.getFullYear()

);

}

return true;

}
);



filtered.forEach(
(transaction)=>
{

if(
transaction.type==="Income"
)
{

income +=
Number(
transaction.amount
);

}

else
{

expense +=
Number(
transaction.amount
);

}

}
);



const ctx =
document.getElementById(
"financeChart"
);

if(!ctx)
return;

if(financeChart)
{

financeChart.destroy();

}

financeChart =
new Chart(ctx,{

type:"bar",

data:{

labels:[

"Income",

"Expense"

],

datasets:[{

label:
selectedReport,

data:[

income,

expense

]

}]

}

});

}



// =======================
// FORM SUBMIT
// =======================

transactionForm.addEventListener(
"submit",

async function(event)
{

event.preventDefault();

const title =
document.getElementById(
"title"
).value.trim();

const amount =
document.getElementById(
"amount"
).value;

const type =
document.getElementById(
"type"
).value;

const category =
document.getElementById(
"category"
).value;

const date =
document.getElementById(
"date"
).value;

const notes =
document.getElementById(
"notes"
).value;



if(
!title||
!amount||
!type||
!category||
!date
)
{

alert(
"Fill all required fields."
);

return;

}



const newTransaction = {

title,

amount:
Number(amount),

type,

category,

date,

notes

};



try
{

const response =
await fetch(
API_URL,
{

method:"POST",

headers:{

"Content-Type":
"application/json"

},

body:
JSON.stringify(
newTransaction
)

}
);

if(!response.ok)
{
throw new Error(
"POST failed"
);
}

transactionForm.reset();

fetchTransactions();

}

catch(error)
{

console.log(
"ERROR:",
error
);

errorMessage.style.display=
"block";

errorMessage.textContent=
error.message;

}

}
);



// =======================
// EVENT LISTENERS
// =======================

reportFilter
.addEventListener(
"change",
fetchTransactions
);

filterType
.addEventListener(
"change",
fetchTransactions
);



// =======================
// INITIAL LOAD
// =======================

fetchTransactions();