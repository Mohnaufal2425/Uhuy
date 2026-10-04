let scenarioCounter = 0;

const SCENARIO_COLORS = ["#C9A24B", "#6C93E0", "#4CAE7C", "#D0685F", "#A78BD6", "#4FB8C4"];

const DEFAULT_SCENARIOS = [
    {
        name: "Conservative",
        initialCapital: 5_000_000,
        days: 30,
        winRate: 55,
        profitMin: 300_000,
        profitMax: 800_000,
        lossMin: 200_000,
        lossMax: 500_000
    },
    {
        name: "Aggressive",
        initialCapital: 5_000_000,
        days: 30,
        winRate: 60,
        profitMin: 1_000_000,
        profitMax: 3_000_000,
        lossMin: 500_000,
        lossMax: 1_500_000
    }
];


document.addEventListener("DOMContentLoaded", () => {

    DEFAULT_SCENARIOS.forEach(addScenarioCard);
    updateScenarioCount();

    document.getElementById("addScenario")
        .addEventListener("click", () => {
            addScenarioCard();
            updateScenarioCount();
        });

    document.getElementById("runAllSimulations")
        .addEventListener("click", runAllSimulations);

    document.getElementById("detailScenarioSelect")
        .addEventListener("change", onDetailScenarioChange);

});


/* ====================================================================
   Scenario card creation / removal
   ==================================================================== */

function addScenarioCard(defaults = {}) {

    scenarioCounter += 1;
    const id = `scenario-${scenarioCounter}`;

    const d = {
        name: defaults.name || `Scenario ${scenarioCounter}`,
        initialCapital: defaults.initialCapital ?? 5_000_000,
        days: defaults.days ?? 30,
        winRate: defaults.winRate ?? 60,
        profitMin: defaults.profitMin ?? 500_000,
        profitMax: defaults.profitMax ?? 1_500_000,
        lossMin: defaults.lossMin ?? 300_000,
        lossMax: defaults.lossMax ?? 800_000
    };

    const card = document.createElement("div");
    card.className = "scenario-card";
    card.dataset.scenarioId = id;

    card.innerHTML = `

        <div class="scenario-card-header">
            <input type="text" class="scenario-name" value="${d.name}">
            <button type="button" class="btn-remove-scenario" title="Remove scenario">✕</button>
        </div>

        <div class="scenario-fields">

            <div class="field">
                <label>Starting Capital</label>
                <div class="input-money">
                    <span>Rp</span>
                    <input type="number" class="f-capital" value="${d.initialCapital}" min="0" step="100000">
                </div>
            </div>

            <div class="field">
                <label>Days</label>
                <input type="number" class="f-days" value="${d.days}" min="1" max="365" step="1">
            </div>

            <div class="field">
                <label>Win Rate (%)</label>
                <input type="number" class="f-winrate" value="${d.winRate}" min="0" max="100" step="1">
            </div>

            <div class="field"></div>

            <div class="field">
                <label>Min Profit / Win Day</label>
                <div class="input-money">
                    <span>Rp</span>
                    <input type="number" class="f-profit-min" value="${d.profitMin}" min="0" step="50000">
                </div>
            </div>

            <div class="field">
                <label>Max Profit / Win Day</label>
                <div class="input-money">
                    <span>Rp</span>
                    <input type="number" class="f-profit-max" value="${d.profitMax}" min="0" step="50000">
                </div>
            </div>

            <div class="field">
                <label>Min Loss / Loss Day</label>
                <div class="input-money">
                    <span>Rp</span>
                    <input type="number" class="f-loss-min" value="${d.lossMin}" min="0" step="50000">
                </div>
            </div>

            <div class="field">
                <label>Max Loss / Loss Day</label>
                <div class="input-money">
                    <span>Rp</span>
                    <input type="number" class="f-loss-max" value="${d.lossMax}" min="0" step="50000">
                </div>
            </div>

        </div>

    `;

    card.querySelector(".btn-remove-scenario")
        .addEventListener("click", () => {
            card.remove();
            updateScenarioCount();
        });

    document.getElementById("scenarioList").appendChild(card);

}

function updateScenarioCount() {

    const count = document.querySelectorAll(".scenario-card").length;

    document.getElementById("scenarioCountLabel").textContent = count;

    document.getElementById("runAllSimulations").disabled = count === 0;

}


/* ====================================================================
   Reading scenarios from the DOM
   ==================================================================== */

function readScenarioCards() {

    const cards = document.querySelectorAll(".scenario-card");
    const scenarios = [];

    cards.forEach(card => {

        const get = selector => Number(card.querySelector(selector).value);

        scenarios.push({
            id: card.dataset.scenarioId,
            name: card.querySelector(".scenario-name").value.trim() || "Untitled",
            initialCapital: get(".f-capital"),
            days: get(".f-days"),
            winRate: get(".f-winrate") / 100,
            profitMin: get(".f-profit-min"),
            profitMax: get(".f-profit-max"),
            lossMin: get(".f-loss-min"),
            lossMax: get(".f-loss-max")
        });

    });

    return scenarios;

}


/* ====================================================================
   Run all scenarios
   ==================================================================== */

let lastResults = [];

function runAllSimulations() {

    const scenarios = readScenarioCards();

    if (scenarios.length === 0) {

        alert("Add at least one scenario first.");
        return;

    }

    const nSimInput = document.getElementById("globalNumSimulations");
    const nSim = Math.max(1, Math.min(5000, Math.round(Number(nSimInput.value)) || 1));
    nSimInput.value = nSim;

    for (const scenario of scenarios) {

        const errors = validateScenario(scenario);

        if (errors.length > 0) {

            alert(`"${scenario.name}": ${errors.join(" ")}`);
            return;

        }

    }

    lastResults = scenarios.map((scenario, index) => {

        const engineResult = runScenarioSimulations(scenario, nSim);
        const percentiles = computePercentilesPerDay(engineResult.allBalancePaths, scenario.days);
        const summary = summarizeFromPercentiles(percentiles, scenario.initialCapital);
        const riskOfRuin = computeRiskOfRuin(engineResult.allBalancePaths, scenario.initialCapital);
        const color = SCENARIO_COLORS[index % SCENARIO_COLORS.length];

        return {
            scenario,
            nSim: engineResult.nSim,
            rows: engineResult.rows,
            percentiles,
            summary,
            riskOfRuin,
            color
        };

    });

    document.getElementById("emptyPlaceholder").hidden = true;
    document.getElementById("comparisonPanel").hidden = false;
    document.getElementById("detailPanel").hidden = false;

    renderComparisonTable(lastResults);

    try {

        if (typeof Chart === "undefined") {

            throw new Error("Chart.js failed to load from CDN.");

        }

        renderComparisonChart(lastResults);

    } catch (err) {

        console.error(err);
        const chartFrame = document.querySelector(".chart-frame");
        if (chartFrame) {
            chartFrame.innerHTML =
                '<p class="placeholder-note">Chart could not be loaded (no internet connection to the CDN?). The comparison table and day-by-day detail below are unaffected.</p>';
        }

    }

    populateDetailSelector(lastResults);
    renderDetailTable(lastResults[0]);

}


/* ====================================================================
   Detail selector
   ==================================================================== */

function populateDetailSelector(results) {

    const select = document.getElementById("detailScenarioSelect");

    select.innerHTML = "";

    results.forEach((result, index) => {

        const option = document.createElement("option");
        option.value = index;
        option.textContent = result.scenario.name;
        select.appendChild(option);

    });

}

function onDetailScenarioChange(event) {

    const index = Number(event.target.value);
    const result = lastResults[index];

    if (result) {

        renderDetailTable(result);

    }

}
