(function () {
  "use strict";

  var BASE_YEAR = 2025;
  var HOURS_MULTIPLIER = 52.176; // average weeks/year, accounts for leap-ish drift

  var LEVELS = Object.keys(PAYSCALES).sort();

  var state = {
    level: "ALL",
    term: 4,
    mode: "consistent",
    consistentPct: 2,
    steppedPct: {},   // { 1: 2.5, 2: 1.8, ... } keyed by year-of-term (1-indexed)
    basis: "annual",
    hoursPerWeek: 37.5
  };

  // ---------- data helpers ----------

  function getBaseEntry(level) {
    var entries = PAYSCALES[level];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].date.indexOf(String(BASE_YEAR)) === 0) return entries[i];
    }
    return entries[entries.length - 1];
  }

  function getStepKeys(level) {
    var base = getBaseEntry(level);
    return Object.keys(base)
      .filter(function (k) { return k.indexOf("step") === 0; })
      .sort(function (a, b) {
        return parseInt(a.replace("step", ""), 10) - parseInt(b.replace("step", ""), 10);
      });
  }

  function getPercentagesArray() {
    var arr = [];
    for (var y = 1; y <= state.term; y++) {
      if (state.mode === "consistent") {
        arr.push(state.consistentPct);
      } else {
        var v = state.steppedPct[y];
        arr.push(typeof v === "number" && !isNaN(v) ? v : 0);
      }
    }
    return arr;
  }

  // cumulative multiplier per projected year index (1..term), relative to base
  function getCumulativeMultipliers(percentages) {
    var out = [];
    var running = 1;
    for (var i = 0; i < percentages.length; i++) {
      running = running * (1 + percentages[i] / 100);
      out.push(running);
    }
    return out;
  }

  // returns [{year, values:{step1:..}, isBase}], year 0 = BASE_YEAR
  function project(level, percentages) {
    var base = getBaseEntry(level);
    var stepKeys = getStepKeys(level);
    var results = [{ year: BASE_YEAR, values: cloneSteps(base, stepKeys), isBase: true }];
    var current = cloneSteps(base, stepKeys);
    for (var i = 0; i < percentages.length; i++) {
      var pct = percentages[i];
      var next = {};
      stepKeys.forEach(function (k) {
        next[k] = current[k] * (1 + pct / 100);
      });
      results.push({ year: BASE_YEAR + i + 1, values: next, isBase: false });
      current = next;
    }
    return results;
  }

  function cloneSteps(entry, stepKeys) {
    var out = {};
    stepKeys.forEach(function (k) { out[k] = entry[k]; });
    return out;
  }

  function toHourly(annualValue) {
    return annualValue / (state.hoursPerWeek * HOURS_MULTIPLIER);
  }

  function displayValue(annualValue) {
    return state.basis === "hourly" ? toHourly(annualValue) : annualValue;
  }

  function formatMoney(value) {
    if (state.basis === "hourly") {
      return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return "$" + Math.round(value).toLocaleString("en-US");
  }

  function formatDelta(value) {
    var sign = value >= 0 ? "+" : "\u2212";
    var abs = Math.abs(value);
    var body = state.basis === "hourly"
      ? abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : Math.round(abs).toLocaleString("en-US");
    return sign + "$" + body;
  }

  function formatPct(p) {
    var sign = p >= 0 ? "+" : "\u2212";
    return sign + Math.abs(p).toFixed(2) + "%";
  }

  // ---------- rendering ----------

  function renderStepInputs() {
    var container = document.getElementById("stepped-years");
    container.innerHTML = "";
    for (var y = 1; y <= state.term; y++) {
      var row = document.createElement("div");
      row.className = "stepped-row";

      var label = document.createElement("label");
      var calYear = BASE_YEAR + y;
      label.textContent = "Y" + y + " (" + calYear + ")";
      label.setAttribute("for", "step-y" + y);

      var input = document.createElement("input");
      input.type = "number";
      input.step = "0.1";
      input.id = "step-y" + y;
      input.value = state.steppedPct[y] !== undefined ? state.steppedPct[y] : state.consistentPct;
      state.steppedPct[y] = parseFloat(input.value);

      input.addEventListener("input", function (e) {
        var idx = parseInt(e.target.id.replace("step-y", ""), 10);
        state.steppedPct[idx] = parseFloat(e.target.value) || 0;
        render();
      });

      row.appendChild(label);
      row.appendChild(input);
      container.appendChild(row);
    }
  }

  function yearHeaderCell(year, cumPct, isBase) {
    var th = document.createElement("th");
    th.className = "year-cell";
    var main = document.createTextNode(String(year));
    th.appendChild(main);
    if (!isBase) {
      var delta = document.createElement("span");
      delta.className = "delta";
      if (cumPct < 0) delta.style.color = "var(--flag)";
      delta.textContent = formatPct(cumPct) + " vs " + BASE_YEAR;
      th.appendChild(delta);
    } else {
      var baseTag = document.createElement("span");
      baseTag.className = "delta";
      baseTag.style.color = "var(--ink-soft)";
      baseTag.textContent = "base year";
      th.appendChild(baseTag);
    }
    return th;
  }

  function renderOverviewTable(percentages) {
    var table = document.getElementById("ledger-table");
    table.innerHTML = "";
    var multipliers = getCumulativeMultipliers(percentages);

    var caption = document.createElement("caption");
    caption.textContent = "Lowest and highest step per level, " + (state.basis === "hourly" ? "hourly wage" : "annual salary") + ".";
    table.appendChild(caption);

    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    var corner = document.createElement("th");
    corner.className = "row-label";
    corner.textContent = "Level";
    headRow.appendChild(corner);
    headRow.appendChild(yearHeaderCell(BASE_YEAR, 0, true));
    for (var y = 1; y <= state.term; y++) {
      headRow.appendChild(yearHeaderCell(BASE_YEAR + y, (multipliers[y - 1] - 1) * 100, false));
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    var prevHigh = {}; // level -> previous year's high (for delta)

    LEVELS.forEach(function (level) {
      var stepKeys = getStepKeys(level);
      var results = project(level, percentages);
      var tr = document.createElement("tr");

      var labelTd = document.createElement("td");
      labelTd.className = "row-label";
      labelTd.textContent = level.replace("MT", "MT-");
      tr.appendChild(labelTd);

      results.forEach(function (r, idx) {
        var low = r.values[stepKeys[0]];
        var high = r.values[stepKeys[stepKeys.length - 1]];
        var td = document.createElement("td");
        if (idx === 0) td.className = "base-col";

        var lowD = displayValue(low), highD = displayValue(high);
        td.innerHTML = formatMoney(lowD) +
          '<span class="range-sep">\u2013</span>' + formatMoney(highD);

        if (idx > 0) {
          var prev = prevHigh[level];
          var delta = highD - prev;
          var deltaSpan = document.createElement("span");
          deltaSpan.className = "cell-delta" + (delta < 0 ? " flag" : "");
          deltaSpan.textContent = formatDelta(delta) + " high/yr";
          td.appendChild(deltaSpan);
        }
        prevHigh[level] = highD;

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function renderLevelTable(level, percentages) {
    var table = document.getElementById("ledger-table");
    table.innerHTML = "";
    var multipliers = getCumulativeMultipliers(percentages);
    var stepKeys = getStepKeys(level);
    var results = project(level, percentages);

    var caption = document.createElement("caption");
    caption.textContent = level.replace("MT", "MT-") + " — every step, " +
      (state.basis === "hourly" ? "hourly wage" : "annual salary") + ".";
    table.appendChild(caption);

    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    var corner = document.createElement("th");
    corner.className = "row-label";
    corner.textContent = "Step";
    headRow.appendChild(corner);
    headRow.appendChild(yearHeaderCell(BASE_YEAR, 0, true));
    for (var y = 1; y <= state.term; y++) {
      headRow.appendChild(yearHeaderCell(BASE_YEAR + y, (multipliers[y - 1] - 1) * 100, false));
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    stepKeys.forEach(function (stepKey, stepIdx) {
      var tr = document.createElement("tr");
      var labelTd = document.createElement("td");
      labelTd.className = "row-label";
      labelTd.textContent = "Step " + (stepIdx + 1);
      tr.appendChild(labelTd);

      var prevVal = null;
      results.forEach(function (r, idx) {
        var val = displayValue(r.values[stepKey]);
        var td = document.createElement("td");
        if (idx === 0) td.className = "base-col";
        td.innerHTML = formatMoney(val);
        if (idx > 0) {
          var delta = val - prevVal;
          var deltaSpan = document.createElement("span");
          deltaSpan.className = "cell-delta" + (delta < 0 ? " flag" : "");
          deltaSpan.textContent = formatDelta(delta);
          td.appendChild(deltaSpan);
        }
        prevVal = val;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function renderStamp(percentages) {
    var stampText = document.getElementById("stamp-text");
    var multipliers = getCumulativeMultipliers(percentages);
    var totalPct = (multipliers[multipliers.length - 1] - 1) * 100;
    var modeLabel = state.mode === "consistent" ? (state.consistentPct + "%/yr flat") : "stepped";
    stampText.textContent = state.term + "-YR \u00B7 " + modeLabel + " \u00B7 " + formatPct(totalPct) + " total";
  }

  function renderHeader() {
    var title = document.getElementById("results-title");
    var scope = document.getElementById("results-scope");
    if (state.level === "ALL") {
      title.textContent = "All levels \u2014 overview";
      scope.textContent = "MT-03 through MT-07 \u00B7 lowest & highest step";
    } else {
      title.textContent = state.level.replace("MT", "MT-") + " \u2014 all steps";
      scope.textContent = getStepKeys(state.level).length + " steps \u00B7 " + state.term + "-year projection";
    }
  }

  function render() {
    var percentages = getPercentagesArray();
    renderHeader();
    renderStamp(percentages);
    if (state.level === "ALL") {
      renderOverviewTable(percentages);
    } else {
      renderLevelTable(state.level, percentages);
    }
  }

  // ---------- wiring ----------

  function populateLevelSelect() {
    var select = document.getElementById("level-select");
    LEVELS.forEach(function (level) {
      var opt = document.createElement("option");
      opt.value = level;
      opt.textContent = level.replace("MT", "MT-");
      select.appendChild(opt);
    });
    select.addEventListener("change", function (e) {
      state.level = e.target.value;
      render();
    });
  }

  function wireControls() {
    var termInput = document.getElementById("term-input");
    termInput.addEventListener("input", function (e) {
      var v = parseInt(e.target.value, 10);
      state.term = (v && v > 0) ? Math.min(v, 15) : 1;
      renderStepInputs();
      render();
    });

    var modeToggle = document.getElementById("mode-toggle");
    modeToggle.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        modeToggle.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        state.mode = btn.getAttribute("data-mode");
        document.getElementById("consistent-field").style.display = state.mode === "consistent" ? "" : "none";
        document.getElementById("stepped-field").style.display = state.mode === "stepped" ? "" : "none";
        render();
      });
    });

    var consistentInput = document.getElementById("consistent-input");
    consistentInput.addEventListener("input", function (e) {
      state.consistentPct = parseFloat(e.target.value) || 0;
      render();
    });

    var wageRadios = document.querySelectorAll('input[name="wage-basis"]');
    wageRadios.forEach(function (r) {
      r.addEventListener("change", function (e) {
        state.basis = e.target.value;
        document.getElementById("hours-field").style.display = state.basis === "hourly" ? "" : "none";
        render();
      });
    });

    var hoursInput = document.getElementById("hours-input");
    hoursInput.addEventListener("input", function (e) {
      var v = parseFloat(e.target.value);
      state.hoursPerWeek = (v && v > 0) ? v : 37.5;
      render();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    populateLevelSelect();
    wireControls();
    renderStepInputs();
    render();
  });
})();
