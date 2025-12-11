document.addEventListener("DOMContentLoaded", function () {
  var pages = document.querySelectorAll(".page");
  var navButtons = document.querySelectorAll(".nav-button");

  function showPage(pageId) {
    pages.forEach(function (page) {
      if (page.id === pageId) {
        page.classList.add("active");
      } else {
        page.classList.remove("active");
      }
    });
  }

  navButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var target = button.getAttribute("data-target");
      navButtons.forEach(function (b) {
        b.classList.remove("active");
      });
      button.classList.add("active");
      showPage(target);
    });
  });

  var TICK_RULES = [
    { min: 1, max: 199, tick: 1 },
    { min: 200, max: 499, tick: 2 },
    { min: 500, max: 1999, tick: 5 },
    { min: 2000, max: 4999, tick: 10 },
    { min: 5000, max: Infinity, tick: 25 }
  ];

  function findRule(price) {
    for (var i = 0; i < TICK_RULES.length; i++) {
      var rule = TICK_RULES[i];
      if (price >= rule.min && price <= rule.max) {
        return rule;
      }
    }
    return null;
  }

  function getAraArbForStock(price) {
    var result = {
      ara: null,
      arb: null,
      rangeText: ""
    };
    if (!price || price <= 0) {
      return result;
    }

    if (price >= 50 && price <= 200) {
      result.ara = 35;
      result.arb = 15;
      result.rangeText = "Rp 50  Rp 200";
    } else if (price > 200 && price <= 5000) {
      result.ara = 25;
      result.arb = 15;
      result.rangeText = "> Rp 200  Rp 5.000";
    } else if (price > 5000) {
      result.ara = 20;
      result.arb = 15;
      result.rangeText = "> Rp 5.000";
    }

    return result;
  }

  function formatCurrency(value) {
    if (!isFinite(value)) {
      return "-";
    }
    try {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
      }).format(value);
    } catch (e) {
      return "Rp " + value.toLocaleString("id-ID");
    }
  }

  function formatNumber(value) {
    if (!isFinite(value)) {
      return "-";
    }
    try {
      return new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 0
      }).format(value);
    } catch (e) {
      return String(value);
    }
  }

  function formatPercent(value) {
    if (!isFinite(value)) {
      return "-";
    }
    var fixed = value.toFixed(2).replace(".", ",");
    return fixed + "%";
  }

  function setResult(elementId, text, isError) {
    var el = document.getElementById(elementId);
    if (!el) {
      return;
    }
    if (!text) {
      el.textContent = "";
      el.classList.add("empty");
      el.classList.remove("result-error");
      return;
    }
    el.textContent = text;
    el.classList.remove("empty");
    if (isError) {
      el.classList.add("result-error");
    } else {
      el.classList.remove("result-error");
    }
  }

  function buildFraksiTable() {
    var tbody = document.getElementById("fraksi-table-body");
    if (!tbody) {
      return;
    }
    tbody.innerHTML = "";

    TICK_RULES.forEach(function (rule) {
      var tr = document.createElement("tr");

      var priceCell = document.createElement("td");
      var tickCell = document.createElement("td");
      var percentCell = document.createElement("td");

      if (rule.max === Infinity) {
        priceCell.textContent = "" + formatNumber(rule.min) + " ke atas";
      } else {
        priceCell.textContent = formatNumber(rule.min) + " - " + formatNumber(rule.max);
      }

      tickCell.textContent = formatCurrency(rule.tick);

      var maxPercent = (rule.tick / rule.min) * 100;
      var percentText;
      if (rule.max === Infinity) {
        percentText = "maks " + formatPercent(maxPercent) + " (di harga " + formatNumber(rule.min) + ")";
      } else {
        var minPercent = (rule.tick / rule.max) * 100;
        percentText = formatPercent(maxPercent) + " - " + formatPercent(minPercent);
      }
      percentCell.textContent = percentText;

      tr.appendChild(priceCell);
      tr.appendChild(tickCell);
      tr.appendChild(percentCell);
      tbody.appendChild(tr);
    });
  }

  function calculateTicksBetweenPrices(fromPrice, toPrice) {
    if (!isFinite(fromPrice) || !isFinite(toPrice) || fromPrice <= 0 || toPrice <= 0) {
      return null;
    }
    if (fromPrice === toPrice) {
      return 0;
    }

    var direction = toPrice > fromPrice ? 1 : -1;
    var price = fromPrice;
    var ticks = 0;
    var safety = 0;

    while (price !== toPrice && safety < 1000000) {
      var rule = findRule(price);
      if (!rule || !rule.tick) {
        return null;
      }

      price += direction * rule.tick;
      ticks += direction;
      safety++;

      if ((direction > 0 && price > toPrice) || (direction < 0 && price < toPrice)) {
        return null;
      }
    }

    if (price !== toPrice) {
      return null;
    }

    return ticks;
  }

  function movePriceByTicks(startPrice, ticks) {
    if (!isFinite(startPrice) || startPrice <= 0 || !isFinite(ticks)) {
      return null;
    }

    if (ticks === 0) {
      return startPrice;
    }

    var direction = ticks > 0 ? 1 : -1;
    var steps = Math.abs(ticks);
    var price = startPrice;

    for (var i = 0; i < steps; i++) {
      var rule = findRule(price);
      if (!rule || !rule.tick) {
        return null;
      }
      price += direction * rule.tick;
      if (price <= 0) {
        return null;
      }
    }

    return price;
  }

  function initFraksiCalculator() {
    var input = document.getElementById("fraksi-price");
    var button = document.getElementById("fraksi-calc-btn");

    function calculate() {
      if (!input) {
        return;
      }
      var value = parseFloat(input.value.replace(",", "."));
      if (isNaN(value) || value <= 0) {
        setResult("fraksi-result", "Mohon masukkan harga yang valid.", true);
        return;
      }
      var rule = findRule(value);
      if (!rule) {
        setResult("fraksi-result", "Tidak ditemukan fraksi untuk harga tersebut.", true);
        return;
      }
      var percentPerTick = (rule.tick / value) * 100;
      var lines = [];
      lines.push("Harga: " + formatCurrency(value));
      lines.push("Fraksi / tick: " + formatCurrency(rule.tick));
      lines.push("Perubahan per 1 tick: " + formatPercent(percentPerTick));
      setResult("fraksi-result", lines.join("\n"), false);
    }

    if (button) {
      button.addEventListener("click", function () {
        calculate();
      });
    }

    if (input) {
      input.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
          calculate();
        }
      });
    }
  }

  function initTrailingStop() {
    var priceInput = document.getElementById("ts-price");
    var ticksInput = document.getElementById("ts-ticks");
    var button = document.getElementById("ts-calc-btn");
    var tableBody = document.getElementById("ts-table-body");

    function updateTrailingTable(basePrice, tickSize, trailingTicks) {
      if (!tableBody || !basePrice || !tickSize || !trailingTicks || trailingTicks <= 0) {
        return;
      }
      tableBody.innerHTML = "";

      var start = -(trailingTicks + 3);
      var end = -2;

      for (var offset = start; offset <= end; offset++) {
        var levelPrice = basePrice + offset * tickSize;
        if (levelPrice <= 0) {
          continue;
        }

        var diff = levelPrice - basePrice;
        var percent = (diff / basePrice) * 100;

        var tr = document.createElement("tr");
        if (offset === -trailingTicks) {
          tr.classList.add("ts-stop-row");
        }

        var posCell = document.createElement("td");
        var priceCell = document.createElement("td");
        var changeCell = document.createElement("td");

        posCell.textContent = offset + " tick";
        priceCell.textContent = formatCurrency(levelPrice);

        var sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
        var absPercent = Math.abs(percent);
        changeCell.textContent = (sign ? sign + " " : "") + formatPercent(absPercent);

        tr.appendChild(posCell);
        tr.appendChild(priceCell);
        tr.appendChild(changeCell);
        tableBody.appendChild(tr);
      }
    }

    function calculate() {
      if (!priceInput || !ticksInput) {
        return;
      }
      var price = parseFloat(priceInput.value.replace(",", "."));
      var ticks = parseFloat(ticksInput.value.replace(",", "."));

      if (isNaN(price) || price <= 0) {
        setResult("ts-result", "Mohon masukkan harga saat ini yang valid.", true);
        return;
      }
      if (isNaN(ticks) || ticks <= 0) {
        setResult("ts-result", "Mohon masukkan jumlah tick yang valid.", true);
        return;
      }

      var rule = findRule(price);
      if (!rule) {
        setResult("ts-result", "Tidak ditemukan fraksi untuk harga tersebut.", true);
        return;
      }

      var tickSize = rule.tick;
      var totalLoss = tickSize * ticks;
      var percent = (totalLoss / price) * 100;
      var stopPrice = price - totalLoss;

      var lines = [];
      lines.push("Harga saat ini: " + formatCurrency(price));
      lines.push("Tick: " + formatCurrency(tickSize));
      lines.push("Penurunan " + ticks + " tick: " + formatCurrency(totalLoss));
      lines.push("Persentase trailing stop: " + formatPercent(percent));
      lines.push("Level harga stop: " + formatCurrency(stopPrice));
      setResult("ts-result", lines.join("\n"), false);

      updateTrailingTable(price, tickSize, ticks);
    }

    if (button) {
      button.addEventListener("click", function () {
        calculate();
      });
    }

    [priceInput, ticksInput].forEach(function (input) {
      if (!input) {
        return;
      }
      input.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
          calculate();
        }
      });
    });
  }

  function initAraArb() {
    var priceInput = document.getElementById("ara-price");
    var button = document.getElementById("ara-arb-calc-btn");

    function getAraArbForStock(price) {
      var result = {
        ara: null,
        arb: null,
        rangeText: ""
      };
      if (!price || price <= 0) {
        return result;
      }

      if (price >= 50 && price <= 200) {
        result.ara = 35;
        result.arb = 15;
        result.rangeText = "Rp 50  Rp 200";
      } else if (price > 200 && price <= 5000) {
        result.ara = 25;
        result.arb = 15;
        result.rangeText = "> Rp 200  Rp 5.000";
      } else if (price > 5000) {
        result.ara = 20;
        result.arb = 15;
        result.rangeText = "> Rp 5.000";
      }

      return result;
    }

    function clearAraArbTable() {
      var tbody = document.getElementById("ara-arb-result-body");
      if (!tbody) {
        return;
      }
      tbody.innerHTML = "";
    }

    function updateAraArbTable(price, mapping, araPrice, arbPrice) {
      var tbody = document.getElementById("ara-arb-result-body");
      if (!tbody) {
        return;
      }
      tbody.innerHTML = "";

      function addRow(label, value) {
        var tr = document.createElement("tr");
        var labelCell = document.createElement("td");
        var valueCell = document.createElement("td");
        labelCell.textContent = label;
        valueCell.textContent = value;
        tr.appendChild(labelCell);
        tr.appendChild(valueCell);
        tbody.appendChild(tr);
      }

      addRow("Harga acuan", formatCurrency(price));
      addRow("Rentang harga (tabel IDX)", mapping.rangeText);
      addRow("ARA (" + formatPercent(mapping.ara) + ")", formatCurrency(araPrice));
      addRow("ARB (" + formatPercent(mapping.arb) + ")", formatCurrency(arbPrice));
    }

    function calculate() {
      if (!priceInput) {
        return;
      }
      var price = parseFloat(priceInput.value.replace(",", "."));

      if (isNaN(price) || price <= 0) {
        clearAraArbTable();
        setResult("ara-arb-result", "Mohon masukkan harga acuan yang valid.", true);
        return;
      }

      var mapping = getAraArbForStock(price);
      if (mapping.ara == null || mapping.arb == null) {
        clearAraArbTable();
        setResult("ara-arb-result", "Harga berada di luar rentang yang tercakup tabel Auto Rejection saham (mulai Rp 50 ke atas).", true);
        return;
      }

      var araPrice = price * (1 + mapping.ara / 100);
      var arbPrice = price * (1 - mapping.arb / 100);

      var lines = [];
      lines.push("Harga acuan: " + formatCurrency(price));
      lines.push("Rentang harga (tabel IDX): " + mapping.rangeText);
      lines.push("ARA (" + formatPercent(mapping.ara) + "): " + formatCurrency(araPrice));
      lines.push("ARB (" + formatPercent(mapping.arb) + "): " + formatCurrency(arbPrice));
      lines.push("");
      lines.push("Persentase ARA/ARB mengikuti tabel Auto Rejection IDX untuk saham (Papan Utama / Ekonomi Baru / Pengembangan).");
      setResult("ara-arb-result", lines.join("\n"), false);

      updateAraArbTable(price, mapping, araPrice, arbPrice);
    }

    if (button) {
      button.addEventListener("click", function () {
        calculate();
      });
    }

    if (priceInput) {
      priceInput.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
          calculate();
        }
      });
    }
  }

  function initGainCalculator() {
    var openInput = document.getElementById("gain-open");
    var targetInput = document.getElementById("gain-target");
    var button = document.getElementById("gain-calc-btn");
    var tableBody = document.getElementById("gain-table-body");

    function clearGainTable() {
      if (!tableBody) {
        return;
      }
      tableBody.innerHTML = "";
    }

    function addGainRow(priceValue, entryText, openText, isEntryRow, isOpenRow) {
      if (!tableBody) {
        return;
      }

      var tr = document.createElement("tr");
      if (isEntryRow) {
        tr.classList.add("gain-entry-row");
      }
      if (isOpenRow) {
        tr.classList.add("gain-open-row");
      }

      var priceCell = document.createElement("td");
      var entryCell = document.createElement("td");
      var openCell = document.createElement("td");

      priceCell.textContent = priceValue;
      entryCell.textContent = entryText;
      openCell.textContent = openText;

      tr.appendChild(priceCell);
      tr.appendChild(entryCell);
      tr.appendChild(openCell);
      tableBody.appendChild(tr);
    }

    function calculate() {
      if (!openInput || !targetInput) {
        return;
      }

      var openPrice = parseFloat(openInput.value.replace(",", "."));
      var targetPrice = parseFloat(targetInput.value.replace(",", "."));

      if (isNaN(openPrice) || openPrice <= 0) {
        clearGainTable();
        setResult("gain-result", "Mohon masukkan harga open yang valid.", true);
        return;
      }

      var araMapping = getAraArbForStock(openPrice);
      if (araMapping.ara == null || araMapping.arb == null) {
        clearGainTable();
        setResult("gain-result", "Harga open berada di luar rentang yang tercakup tabel Auto Rejection saham (mulai Rp 50 ke atas).", true);
        return;
      }

      if (isNaN(targetPrice) || targetPrice <= 0) {
        clearGainTable();
        setResult("gain-result", "Mohon masukkan harga target yang valid.", true);
        return;
      }

      var araPrice = openPrice * (1 + araMapping.ara / 100);
      var arbPrice = openPrice * (1 - araMapping.arb / 100);

      if (targetPrice > araPrice) {
        clearGainTable();
        setResult(
          "gain-result",
          "Harga target melebihi batas ARA dari harga open. Batas maksimum: " + formatCurrency(araPrice) + ".",
          true
        );
        return;
      }

      if (targetPrice < arbPrice) {
        clearGainTable();
        setResult(
          "gain-result",
          "Harga target berada di bawah batas ARB dari harga open. Batas minimum: " + formatCurrency(arbPrice) + ".",
          true
        );
        return;
      }

      var ticksOpenToEntry = calculateTicksBetweenPrices(openPrice, targetPrice);
      if (ticksOpenToEntry === null) {
        clearGainTable();
        setResult(
          "gain-result",
          "Harga target tidak sesuai dengan fraksi/tick dari harga open berdasarkan aturan fraksi harga.",
          true
        );
        return;
      }

      var diffOpenToEntry = targetPrice - openPrice;
      var percentOpenToEntry = (diffOpenToEntry / openPrice) * 100;

      var sign = diffOpenToEntry > 0 ? "+" : diffOpenToEntry < 0 ? "-" : "";
      var absPercent = Math.abs(percentOpenToEntry);
      var absTicks = Math.abs(ticksOpenToEntry);

      var lines = [];
      lines.push("Harga open: " + formatCurrency(openPrice));
      lines.push("Harga target: " + formatCurrency(targetPrice));
      lines.push("Rentang harga (tabel IDX): " + araMapping.rangeText);
      lines.push("Batas ARA: " + formatCurrency(araPrice) + " (" + formatPercent(araMapping.ara) + ")");
      lines.push("Batas ARB: " + formatCurrency(arbPrice) + " (" + formatPercent(araMapping.arb) + ")");
      lines.push(
        "Perubahan: " +
          (sign ? sign + " " : "") +
          formatCurrency(Math.abs(diffOpenToEntry)) +
          " (" +
          (ticksOpenToEntry > 0 ? "+" : ticksOpenToEntry < 0 ? "-" : "") +
          absTicks +
          " tick, " +
          (sign ? sign + " " : "") +
          formatPercent(absPercent) +
          ")"
      );

      setResult("gain-result", lines.join("\n"), false);

      clearGainTable();

      var levels = [];

      levels.push({ price: targetPrice, isEntry: true });

      var guard;
      var current;

      current = targetPrice;
      guard = 0;
      while (guard < 2000) {
        var nextDown = movePriceByTicks(current, -1);
        if (!nextDown || !isFinite(nextDown)) {
          break;
        }
        if (nextDown < arbPrice) {
          break;
        }
        levels.unshift({ price: nextDown, isEntry: false });
        current = nextDown;
        guard++;
      }

      current = targetPrice;
      guard = 0;
      while (guard < 2000) {
        var nextUp = movePriceByTicks(current, 1);
        if (!nextUp || !isFinite(nextUp)) {
          break;
        }
        if (nextUp > araPrice) {
          break;
        }
        levels.push({ price: nextUp, isEntry: false });
        current = nextUp;
        guard++;
      }

      for (var j = 0; j < levels.length; j++) {
        var level = levels[j];
        var levelPrice = level.price;

        var ticksFromEntry = calculateTicksBetweenPrices(targetPrice, levelPrice);
        var ticksFromOpen = calculateTicksBetweenPrices(openPrice, levelPrice);
        if (ticksFromEntry === null || ticksFromOpen === null) {
          continue;
        }

        var diffEntry = levelPrice - targetPrice;
        var diffOpen = levelPrice - openPrice;

        var percentEntry = (diffEntry / targetPrice) * 100;
        var percentOpen = (diffOpen / openPrice) * 100;

        var entryTicksSign = ticksFromEntry > 0 ? "+" : ticksFromEntry < 0 ? "-" : "";
        var openTicksSign = ticksFromOpen > 0 ? "+" : ticksFromOpen < 0 ? "-" : "";

        var entryPercentSign = percentEntry > 0 ? "+" : percentEntry < 0 ? "-" : "";
        var openPercentSign = percentOpen > 0 ? "+" : percentOpen < 0 ? "-" : "";

        var absEntryTicks = Math.abs(ticksFromEntry);
        var absOpenTicks = Math.abs(ticksFromOpen);
        var absEntryPercent = Math.abs(percentEntry);
        var absOpenPercent = Math.abs(percentOpen);

        var entryText =
          (entryTicksSign ? entryTicksSign + " " : "") +
          absEntryTicks +
          " tick (" +
          (entryPercentSign ? entryPercentSign + " " : "") +
          formatPercent(absEntryPercent) +
          ")";

        var openText =
          (openTicksSign ? openTicksSign + " " : "") +
          absOpenTicks +
          " tick (" +
          (openPercentSign ? openPercentSign + " " : "") +
          formatPercent(absOpenPercent) +
          ")";

        var isOpenRow = !level.isEntry && Math.abs(levelPrice - openPrice) < 0.0000001;

        addGainRow(formatCurrency(levelPrice), entryText, openText, level.isEntry, isOpenRow);
      }

      if (tableBody) {
        var entryRow = tableBody.querySelector(".gain-entry-row");
        if (entryRow && typeof entryRow.scrollIntoView === "function") {
          try {
            entryRow.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch (e) {
            entryRow.scrollIntoView();
          }
        }
      }
    }

    if (button) {
      button.addEventListener("click", function () {
        calculate();
      });
    }

    [openInput, targetInput].forEach(function (input) {
      if (!input) {
        return;
      }
      input.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
          calculate();
        }
      });
    });
  }

  function initFinansialFreedom() {
    var modalInput = document.getElementById("ff-modal");
    var yieldInput = document.getElementById("ff-yield");
    var taxInput = document.getElementById("ff-tax");
    var button = document.getElementById("ff-calc-btn");
    var tableBody = document.getElementById("ff-table-body");

    function clearTable() {
      if (!tableBody) {
        return;
      }
      tableBody.innerHTML = "";
    }

    function addRow(label, gross, tax, net) {
      if (!tableBody) {
        return;
      }
      var tr = document.createElement("tr");
      var labelCell = document.createElement("td");
      var grossCell = document.createElement("td");
      var taxCell = document.createElement("td");
      var netCell = document.createElement("td");

      labelCell.textContent = label;
      grossCell.textContent = gross;
      taxCell.textContent = tax;
      netCell.textContent = net;

      tr.appendChild(labelCell);
      tr.appendChild(grossCell);
      tr.appendChild(taxCell);
      tr.appendChild(netCell);
      tableBody.appendChild(tr);
    }

    function calculate() {
      if (!modalInput || !yieldInput || !taxInput) {
        return;
      }

      var modal = parseFloat(modalInput.value.replace(",", "."));
      var yieldPercent = parseFloat(yieldInput.value.replace(",", "."));
      var taxPercent = parseFloat(taxInput.value.replace(",", "."));

      if (isNaN(modal) || modal <= 0) {
        clearTable();
        setResult("ff-result", "Mohon masukkan nilai modal yang valid.", true);
        return;
      }

      if (isNaN(yieldPercent) || yieldPercent < 0) {
        clearTable();
        setResult("ff-result", "Mohon masukkan target dividend yield per tahun yang valid.", true);
        return;
      }

      if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) {
        clearTable();
        setResult("ff-result", "Mohon masukkan persentase pajak dividen yang valid (0-100%).", true);
        return;
      }

      var yearlyGross = modal * (yieldPercent / 100);
      var taxRate = taxPercent / 100;
      var yearlyTax = yearlyGross * taxRate;
      var yearlyNet = yearlyGross - yearlyTax;

      var monthlyGross = yearlyGross / 12;
      var monthlyTax = yearlyTax / 12;
      var monthlyNet = yearlyNet / 12;

      var dailyGross = yearlyGross / 365;
      var dailyTax = yearlyTax / 365;
      var dailyNet = yearlyNet / 365;

      var lines = [];
      lines.push("Modal: " + formatCurrency(modal));
      lines.push("Target dividend yield per tahun: " + formatPercent(yieldPercent));
      lines.push("Asumsi pajak dividen: " + formatPercent(taxPercent));
      lines.push("Perkiraan dividen bersih per tahun: " + formatCurrency(yearlyNet));
      lines.push("");
      lines.push("Catatan:");
      lines.push("- Perhitungan sederhana dengan asumsi yield flat sepanjang tahun.");
      lines.push("- Pajak mengikuti persentase yang kamu isi (misalnya 10% final untuk dividen saham Indonesia).");

      setResult("ff-result", lines.join("\n"), false);

      clearTable();
      addRow("Per tahun", formatCurrency(yearlyGross), formatCurrency(yearlyTax), formatCurrency(yearlyNet));
      addRow("Per bulan (12 bln)", formatCurrency(monthlyGross), formatCurrency(monthlyTax), formatCurrency(monthlyNet));
      addRow("Per hari (365 hari)", formatCurrency(dailyGross), formatCurrency(dailyTax), formatCurrency(dailyNet));
    }

    if (button) {
      button.addEventListener("click", function () {
        calculate();
      });
    }

    [modalInput, yieldInput, taxInput].forEach(function (input) {
      if (!input) {
        return;
      }
      input.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
          calculate();
        }
      });
    });
  }

  buildFraksiTable();
  initFraksiCalculator();
  initTrailingStop();
  initAraArb();
  initGainCalculator();
  initFinansialFreedom();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {
      // diamkan saja jika gagal; PWA bukan fitur kritikal
    });
  });
}
