/* ====================================================================
   Format helpers
   ==================================================================== */

function formatCurrency(value) {

    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(value);

}

function applyDirectionClass(element, value) {

    element.classList.remove("profit", "loss");

    if (value > 0) {

        element.classList.add("profit");

    } else if (value < 0) {

        element.classList.add("loss");

    }

}


/* ====================================================================
   Simulation core
   ==================================================================== */

function randomBetween(min, max) {

    return min + Math.random() * (max - min);

}

// Runs one day-by-day random walk for a single scenario, with full detail
// (result/change per day). Used when nSim === 1.
// Compounding: each day's change is applied to the CURRENT balance.
function runCapitalSimulation(params) {

    const {
        initialCapital,
        days,
        winRate,
        profitMin,
        profitMax,
        lossMin,
        lossMax
    } = params;

    let balance = initialCapital;

    const rows = [
        { day: 0, result: "START", change: 0, balance }
    ];

    for (let day = 1; day <= days; day++) {

        const isWin = Math.random() < winRate;

        const change = isWin
            ? randomBetween(profitMin, profitMax)
            : -randomBetween(lossMin, lossMax);

        balance = Math.max(balance + change, 0);

        rows.push({
            day,
            result: isWin ? "WIN" : "LOSS",
            change,
            balance
        });

    }

    return rows;

}

// Same random walk, but only returns the balance at each day (lighter
// weight, used when running many simulations for Monte Carlo).
function simulateBalancesOnly(params) {

    const { initialCapital, days, winRate, profitMin, profitMax, lossMin, lossMax } = params;

    let balance = initialCapital;
    const balances = [balance];

    for (let day = 1; day <= days; day++) {

        const isWin = Math.random() < winRate;

        const change = isWin
            ? randomBetween(profitMin, profitMax)
            : -randomBetween(lossMin, lossMax);

        balance = Math.max(balance + change, 0);

        balances.push(balance);

    }

    return balances;

}

// Runs a scenario either as a single detailed path (nSim === 1) or as a
// batch of Monte Carlo paths (nSim > 1). Always returns allBalancePaths so
// downstream summary/percentile code works the same either way.
function runScenarioSimulations(scenario, nSim) {

    if (nSim <= 1) {

        const rows = runCapitalSimulation(scenario);

        return {
            nSim: 1,
            rows,
            allBalancePaths: [rows.map(r => r.balance)]
        };

    }

    const allBalancePaths = [];

    for (let i = 0; i < nSim; i++) {

        allBalancePaths.push(simulateBalancesOnly(scenario));

    }

    return { nSim, allBalancePaths };

}

function percentileOf(sortedValues, p) {

    const idx = Math.min(Math.floor(p * (sortedValues.length - 1)), sortedValues.length - 1);
    return sortedValues[idx];

}

// Computes P5/P25/median/P75/P95 balance for every day across all paths.
function computePercentilesPerDay(allBalancePaths, days) {

    const result = [];

    for (let day = 0; day <= days; day++) {

        const values = allBalancePaths.map(path => path[day]).sort((a, b) => a - b);

        result.push({
            day,
            p5: percentileOf(values, 0.05),
            p25: percentileOf(values, 0.25),
            median: percentileOf(values, 0.50),
            p75: percentileOf(values, 0.75),
            p95: percentileOf(values, 0.95)
        });

    }

    return result;

}

// Percentage of paths where balance dropped to <=5% of starting capital
// at any point during the simulation.
function computeRiskOfRuin(allBalancePaths, initialCapital) {

    if (allBalancePaths.length === 0) return 0;

    const threshold = initialCapital * 0.05;
    const ruined = allBalancePaths.filter(path => Math.min(...path) <= threshold).length;

    return (ruined / allBalancePaths.length) * 100;

}

function summarizeRows(rows, initialCapital) {

    const finalBalance = rows[rows.length - 1].balance;
    const netChange = finalBalance - initialCapital;
    const growthPct = initialCapital > 0
        ? (netChange / initialCapital) * 100
        : 0;
    const lowestBalance = Math.min(...rows.map(row => row.balance));

    return { finalBalance, netChange, growthPct, lowestBalance };

}

// Unified summary built from percentiles — works whether nSim is 1 or many.
function summarizeFromPercentiles(percentiles, initialCapital) {

    const final = percentiles[percentiles.length - 1];
    const netChangeMedian = final.median - initialCapital;
    const growthPctMedian = initialCapital > 0
        ? (netChangeMedian / initialCapital) * 100
        : 0;

    return {
        finalBalanceMedian: final.median,
        finalBalanceP5: final.p5,
        finalBalanceP95: final.p95,
        netChangeMedian,
        growthPctMedian
    };

}


/* ====================================================================
   Validation
   ==================================================================== */

function validateScenario(scenario) {

    const errors = [];

    if (!Number.isFinite(scenario.initialCapital) || scenario.initialCapital < 0) {
        errors.push("Starting capital must be a valid non-negative number.");
    }

    if (!Number.isFinite(scenario.days) || scenario.days < 1) {
        errors.push("Days must be at least 1.");
    }

    if (!Number.isFinite(scenario.winRate) || scenario.winRate < 0 || scenario.winRate > 1) {
        errors.push("Win rate must be between 0 and 100%.");
    }

    if (!Number.isFinite(scenario.profitMin) || !Number.isFinite(scenario.profitMax) ||
        scenario.profitMin > scenario.profitMax) {
        errors.push("Min profit cannot be greater than max profit.");
    }

    if (!Number.isFinite(scenario.lossMin) || !Number.isFinite(scenario.lossMax) ||
        scenario.lossMin > scenario.lossMax) {
        errors.push("Min loss cannot be greater than max loss.");
    }

    return errors;

}


/* ====================================================================
   Rendering: comparison table
   ==================================================================== */

function renderComparisonTable(results) {

    const tbody = document.getElementById("comparisonTableBody");

    tbody.innerHTML = "";

    results.forEach(result => {

        const { scenario, summary, color, riskOfRuin, nSim } = result;

        const tr = document.createElement("tr");

        const finalBalanceCell = nSim > 1
            ? `${formatCurrency(summary.finalBalanceMedian)}
               <span class="range-sub">P5 ${formatCurrency(summary.finalBalanceP5)} — P95 ${formatCurrency(summary.finalBalanceP95)}</span>`
            : formatCurrency(summary.finalBalanceMedian);

        const netChange = summary.netChangeMedian;
        const growthPct = summary.growthPctMedian;

        tr.innerHTML = `

            <td>
                <span class="scenario-swatch" style="background:${color}"></span>
                ${scenario.name}
            </td>

            <td>${(scenario.winRate * 100).toFixed(0)}%</td>

            <td>${finalBalanceCell}</td>

            <td class="${netChange > 0 ? "profit delta" : netChange < 0 ? "loss delta" : ""}">
                ${netChange >= 0 ? "+" : ""}${formatCurrency(netChange)}
            </td>

            <td class="${growthPct > 0 ? "profit delta" : growthPct < 0 ? "loss delta" : ""}">
                ${growthPct >= 0 ? "+" : ""}${growthPct.toFixed(1)}%
            </td>

            <td>${riskOfRuin.toFixed(1)}%</td>

        `;

        tr.querySelector("td:first-child").style.display = "flex";
        tr.querySelector("td:first-child").style.alignItems = "center";
        tr.querySelector("td:first-child").style.gap = "8px";

        tbody.appendChild(tr);

    });

}


/* ====================================================================
   Rendering: comparison chart
   ==================================================================== */

let comparisonChartInstance = null;

function hexToRgba(hex, alpha) {

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;

}

function renderComparisonChart(results) {

    const ctx = document.getElementById("comparisonChart").getContext("2d");

    if (comparisonChartInstance) {

        comparisonChartInstance.destroy();

    }

    const gridColor = "rgba(255, 255, 255, 0.06)";
    const tickColor = "#8B93A6";

    const maxDays = Math.max(...results.map(r => r.percentiles.length - 1));
    const labels = Array.from({ length: maxDays + 1 }, (_, i) => `Day ${i}`);

    const datasets = [];

    results.forEach(result => {

        const { scenario, percentiles, color, nSim } = result;

        if (nSim > 1) {

            // Upper bound (P95) — invisible line, establishes the fill target
            datasets.push({
                label: "",
                data: percentiles.map(p => p.p95),
                borderColor: "transparent",
                backgroundColor: "transparent",
                pointRadius: 0,
                fill: false,
                order: 2
            });

            // Lower bound (P5) — fills up to the P95 dataset above it,
            // creating the shaded pesimis-optimis band.
            datasets.push({
                label: "",
                data: percentiles.map(p => p.p5),
                borderColor: "transparent",
                backgroundColor: hexToRgba(color, 0.12),
                pointRadius: 0,
                fill: "-1",
                order: 2
            });

        }

        // Median line — always drawn, on top.
        datasets.push({
            label: scenario.name,
            data: percentiles.map(p => p.median),
            borderColor: color,
            backgroundColor: "transparent",
            borderWidth: 2.2,
            pointRadius: 0,
            fill: false,
            tension: 0.15,
            order: 1
        });

    });

    comparisonChartInstance = new Chart(ctx, {

        type: "line",

        data: { labels, datasets },

        options: {
            responsive: true,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: "top",
                    labels: {
                        boxWidth: 12,
                        font: { size: 11, family: "Inter" },
                        color: tickColor,
                        filter: item => item.text !== ""
                    }
                },
                tooltip: {
                    backgroundColor: "#1F2430",
                    borderColor: "#2A3040",
                    borderWidth: 1,
                    titleColor: "#EDEFF3",
                    bodyColor: "#EDEFF3",
                    filter: item => item.dataset.label !== "",
                    callbacks: {
                        label: context => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: tickColor,
                        font: { family: "JetBrains Mono", size: 10.5 },
                        callback: value => formatCurrency(value)
                    }
                },
                x: {
                    grid: { color: gridColor },
                    ticks: {
                        color: tickColor,
                        font: { family: "JetBrains Mono", size: 10.5 },
                        maxTicksLimit: 10
                    }
                }
            }
        }

    });

}


/* ====================================================================
   Rendering: day-by-day detail table
   ==================================================================== */

function renderDetailTableSingle(rows) {

    document.getElementById("detailTableHead").innerHTML = `
        <tr>
            <th>Day</th>
            <th>Result</th>
            <th>Change</th>
            <th>Balance</th>
        </tr>
    `;

    const tbody = document.getElementById("detailTableBody");

    tbody.innerHTML = "";

    rows
        .filter(row => row.day > 0)
        .forEach(row => {

            const tr = document.createElement("tr");

            const changeClass = row.change > 0
                ? "profit delta"
                : row.change < 0
                    ? "loss delta"
                    : "";

            const resultClass = row.result === "WIN" ? "buy" : "sell";

            tr.innerHTML = `

                <td>Day ${row.day}</td>

                <td><span class="side-badge ${resultClass}">${row.result}</span></td>

                <td class="${changeClass}">
                    ${row.change >= 0 ? "+" : ""}${formatCurrency(row.change)}
                </td>

                <td>${formatCurrency(row.balance)}</td>

            `;

            tbody.appendChild(tr);

        });

}

function renderDetailTablePercentiles(percentiles) {

    document.getElementById("detailTableHead").innerHTML = `
        <tr>
            <th>Day</th>
            <th>P5 (Pessimistic)</th>
            <th>P25</th>
            <th>Median</th>
            <th>P75</th>
            <th>P95 (Optimistic)</th>
        </tr>
    `;

    const tbody = document.getElementById("detailTableBody");

    tbody.innerHTML = "";

    percentiles
        .filter(row => row.day > 0)
        .forEach(row => {

            const tr = document.createElement("tr");

            tr.innerHTML = `

                <td>Day ${row.day}</td>
                <td>${formatCurrency(row.p5)}</td>
                <td>${formatCurrency(row.p25)}</td>
                <td>${formatCurrency(row.median)}</td>
                <td>${formatCurrency(row.p75)}</td>
                <td>${formatCurrency(row.p95)}</td>

            `;

            tbody.appendChild(tr);

        });

}

function renderDetailTable(result) {

    if (result.nSim > 1) {

        renderDetailTablePercentiles(result.percentiles);

    } else {

        renderDetailTableSingle(result.rows);

    }

}
