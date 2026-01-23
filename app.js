document.addEventListener("DOMContentLoaded", function () {
  var pages = document.querySelectorAll(".page");
  var navButtons = document.querySelectorAll(".nav-button");

  var ACTIVE_PAGE_STORAGE_KEY = "cuan-hunter.activePage";
  var COMPOUNDING_STORAGE_KEY = "cuan-hunter.compounding";

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {}
  }

  function showPage(pageId) {
    pages.forEach(function (page) {
      if (page.id === pageId) {
        page.classList.add("active");
      } else {
        page.classList.remove("active");
      }
    });

    navButtons.forEach(function (button) {
      if (button.getAttribute("data-target") === pageId) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });

    writeStorage(ACTIVE_PAGE_STORAGE_KEY, pageId);
  }

  var savedPage = readStorage(ACTIVE_PAGE_STORAGE_KEY);
  if (savedPage) {
    var savedPageEl = document.getElementById(savedPage);
    if (savedPageEl && savedPageEl.classList.contains("page")) {
      showPage(savedPage);
    }
  }

  navButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var target = button.getAttribute("data-target");
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

  function initPartialTakeProfit() {
    var buyInput = document.getElementById("ptp-buy");
    var lotsInput = document.getElementById("ptp-lots");
    var sellInput = document.getElementById("ptp-sell");
    var percentRange = document.getElementById("ptp-percent-range");
    var percentValue = document.getElementById("ptp-percent-value");
    var button = document.getElementById("ptp-calc-btn");

    var errorBox = document.getElementById("ptp-error");
    var resultBox = document.getElementById("ptp-result");
    var profitEl = document.getElementById("ptp-profit");
    var diffEl = document.getElementById("ptp-diff");
    var sisaLotEl = document.getElementById("ptp-sisa-lot");
    var bapEl = document.getElementById("ptp-bap");
    var modalRemainEl = document.getElementById("ptp-modal-remaining");

    function updatePercentLabel(value) {
      if (percentValue) {
        percentValue.textContent = value + "%";
      }
    }

    if (percentRange) {
      updatePercentLabel(percentRange.value);
      percentRange.addEventListener("input", function () {
        updatePercentLabel(percentRange.value);
      });
    }

    function clearResult() {
      if (resultBox) {
        resultBox.classList.add("empty");
      }
    }

    function calculate() {
      if (!buyInput || !lotsInput || !sellInput || !percentRange) {
        return;
      }

      var buy = parseFloat(buyInput.value.replace(",", "."));
      var lots = parseFloat(lotsInput.value.replace(",", "."));
      var sell = parseFloat(sellInput.value.replace(",", "."));
      var percent = parseFloat(percentRange.value);

      clearResult();
      setResult("ptp-error", "", false);

      if (!isFinite(buy) || buy <= 0 || !isFinite(lots) || lots <= 0 || !isFinite(sell) || sell <= 0) {
        setResult("ptp-error", "Mohon isi semua field dengan angka yang valid.", true);
        return;
      }

      if (sell <= buy) {
        setResult("ptp-error", "Harga jual harus lebih tinggi dari harga beli.", true);
        return;
      }

      if (!isFinite(percent) || percent <= 0 || percent > 100) {
        setResult("ptp-error", "Persentase jual harus 1-100%.", true);
        return;
      }

      var LEMBAR_PER_LOT = 100;

      var lotDijual = (lots * percent) / 100;
      var sisaLot = lots - lotDijual;

      var lembarDijual = lotDijual * LEMBAR_PER_LOT;
      var lembarSisa = sisaLot * LEMBAR_PER_LOT;

      var profitPerLembar = sell - buy;
      var totalProfit = profitPerLembar * lembarDijual;

      var diffPercent = ((sell - buy) / buy) * 100;

      var modalSisaLot = buy * lembarSisa;
      var modalTersisaSetelahProfit = modalSisaLot - totalProfit;
      var hargaBap = lembarSisa > 0 ? modalTersisaSetelahProfit / lembarSisa : NaN;

      if (resultBox) {
        resultBox.classList.remove("empty");
      }
      if (profitEl) {
        profitEl.textContent = formatCurrency(totalProfit);
      }
      if (diffEl) {
        diffEl.textContent = formatPercent(diffPercent);
      }
      if (sisaLotEl) {
        sisaLotEl.textContent = sisaLot.toFixed(2) + " lot";
      }
      if (bapEl) {
        bapEl.textContent = isFinite(hargaBap) ? formatCurrency(hargaBap) : "-";
      }
      if (modalRemainEl) {
        modalRemainEl.textContent = formatCurrency(modalTersisaSetelahProfit);
      }
    }

    if (button) {
      button.addEventListener("click", function () {
        calculate();
      });
    }

    [buyInput, lotsInput, sellInput].forEach(function (input) {
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

  function initCompounding() {
    var modalInput = document.getElementById("cmp-modal");
    var dailyInput = document.getElementById("cmp-daily");
    var daysInput = document.getElementById("cmp-days");
    var monthsInput = document.getElementById("cmp-months");
    var modeSelect = document.getElementById("cmp-mode");
    var takeProfitAmountInput = document.getElementById("cmp-tp-amount");
    var takeProfitPeriodSelect = document.getElementById("cmp-tp-period");
    var button = document.getElementById("cmp-calc-btn");
    var monthBody = document.getElementById("cmp-month-table-body");
    var dayBody = document.getElementById("cmp-day-table-body");

    var hasCalculated = false;

    function clearTables() {
      if (monthBody) {
        monthBody.innerHTML = "";
      }
      if (dayBody) {
        dayBody.innerHTML = "";
      }
    }

    function saveState(hasCalculated) {
      var state = {
        modal: modalInput ? modalInput.value : "",
        daily: dailyInput ? dailyInput.value : "",
        days: daysInput ? daysInput.value : "",
        months: monthsInput ? monthsInput.value : "",
        mode: modeSelect ? modeSelect.value : "",
        takeProfitAmount: takeProfitAmountInput ? takeProfitAmountInput.value : "",
        takeProfitPeriod: takeProfitPeriodSelect ? takeProfitPeriodSelect.value : "",
        hasCalculated: !!hasCalculated
      };

      writeStorage(COMPOUNDING_STORAGE_KEY, JSON.stringify(state));
    }

    function restoreState() {
      var raw = readStorage(COMPOUNDING_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        return null;
      }

      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      if (modalInput && parsed.modal != null) {
        modalInput.value = parsed.modal;
      }
      if (dailyInput && parsed.daily != null) {
        dailyInput.value = parsed.daily;
      }
      if (daysInput && parsed.days != null) {
        daysInput.value = parsed.days;
      }
      if (monthsInput && parsed.months != null) {
        monthsInput.value = parsed.months;
      }
      if (modeSelect && parsed.mode) {
        modeSelect.value = parsed.mode;
      }
      if (takeProfitAmountInput && parsed.takeProfitAmount != null) {
        takeProfitAmountInput.value = parsed.takeProfitAmount;
      }
      if (takeProfitPeriodSelect && parsed.takeProfitPeriod) {
        takeProfitPeriodSelect.value = parsed.takeProfitPeriod;
      }

      return parsed;
    }

    function calculate() {
      if (!modalInput || !dailyInput || !daysInput || !monthsInput || !modeSelect || !takeProfitAmountInput || !takeProfitPeriodSelect) {
        return;
      }

      var modal = parseFloat(modalInput.value.replace(",", "."));
      var dailyPercent = parseFloat(dailyInput.value.replace(",", "."));
      var daysPerMonth = parseInt(daysInput.value, 10);
      var months = parseInt(monthsInput.value, 10);
      var mode = modeSelect.value;

      var takeProfitAmount = parseFloat(takeProfitAmountInput.value.replace(",", "."));
      if (isNaN(takeProfitAmount)) {
        takeProfitAmount = 0;
      }
      var takeProfitPeriod = takeProfitPeriodSelect.value;

      hasCalculated = true;
      saveState(true);

      if (isNaN(modal) || modal <= 0) {
        clearTables();
        setResult("cmp-result", "Mohon masukkan modal awal yang valid.", true);
        return;
      }

      if (isNaN(dailyPercent) || dailyPercent < 0) {
        clearTables();
        setResult("cmp-result", "Mohon masukkan target cuan harian yang valid.", true);
        return;
      }

      if (isNaN(daysPerMonth) || daysPerMonth <= 0 || daysPerMonth > 31) {
        clearTables();
        setResult("cmp-result", "Mohon masukkan jumlah hari bursa per bulan yang valid (1-31).", true);
        return;
      }

      if (isNaN(months) || months <= 0 || months > 60) {
        clearTables();
        setResult("cmp-result", "Mohon masukkan durasi bulan yang valid (1-60).", true);
        return;
      }

      if (mode !== "reinvest" && mode !== "withdraw") {
        clearTables();
        setResult("cmp-result", "Mohon pilih mode profit harian yang valid.", true);
        return;
      }

      if (!isFinite(takeProfitAmount) || takeProfitAmount < 0) {
        clearTables();
        setResult("cmp-result", "Mohon masukkan take profit (Rp) yang valid.", true);
        return;
      }

      if (takeProfitPeriod !== "daily" && takeProfitPeriod !== "monthly") {
        clearTables();
        setResult("cmp-result", "Mohon pilih periode take profit yang valid.", true);
        return;
      }

      var dailyRate = dailyPercent / 100;
      var initialModal = modal;
      var capital = modal;
      var profitCumulative = 0;
      var profitTakenCumulative = 0;
      var totalDays = daysPerMonth * months;

      clearTables();

      var monthFragment = document.createDocumentFragment();
      var dayFragment = document.createDocumentFragment();

      for (var monthIndex = 1; monthIndex <= months; monthIndex++) {
        var monthStartCapital = capital;
        var monthStartProfit = profitCumulative;
        var monthStartTaken = profitTakenCumulative;

        for (var dayIndex = 1; dayIndex <= daysPerMonth; dayIndex++) {
          var dayStartCapital = capital;
          var profitDay = dayStartCapital * dailyRate;
          var takenToday = 0;

          if (mode === "withdraw") {
            takenToday = profitDay;
            profitCumulative += profitDay;
            profitTakenCumulative += takenToday;
          } else {
            if (takeProfitAmount > 0 && takeProfitPeriod === "daily") {
              takenToday = Math.min(takeProfitAmount, profitDay);
            }

            var reinvestProfit = profitDay - takenToday;
            if (reinvestProfit < 0) {
              reinvestProfit = 0;
            }
            capital = dayStartCapital + reinvestProfit;

            profitCumulative += profitDay;
            profitTakenCumulative += takenToday;

            if (takeProfitAmount > 0 && takeProfitPeriod === "monthly" && dayIndex === daysPerMonth) {
              var profitMonthGrossSoFar = profitCumulative - monthStartProfit;
              var takenThisMonth = Math.min(takeProfitAmount, profitMonthGrossSoFar);
              capital = capital - takenThisMonth;
              profitTakenCumulative += takenThisMonth;
              takenToday += takenThisMonth;
            }
          }

          var totalAsset = initialModal + profitCumulative;

          if (dayBody) {
            var dayTr = document.createElement("tr");

            var dayLabelCell = document.createElement("td");
            var dayStartCell = document.createElement("td");
            var dayProfitCell = document.createElement("td");
            var dayTakenCell = document.createElement("td");
            var dayEndCell = document.createElement("td");
            var dayCumCell = document.createElement("td");
            var dayAssetCell = document.createElement("td");

            dayLabelCell.textContent = "B" + monthIndex + " H" + dayIndex;
            dayStartCell.textContent = formatCurrency(dayStartCapital);
            dayProfitCell.textContent = formatCurrency(profitDay);
            dayTakenCell.textContent = formatCurrency(takenToday);
            dayEndCell.textContent = formatCurrency(capital);
            dayCumCell.textContent = formatCurrency(profitCumulative);
            dayAssetCell.textContent = formatCurrency(totalAsset);

            dayTr.appendChild(dayLabelCell);
            dayTr.appendChild(dayStartCell);
            dayTr.appendChild(dayProfitCell);
            dayTr.appendChild(dayTakenCell);
            dayTr.appendChild(dayEndCell);
            dayTr.appendChild(dayCumCell);
            dayTr.appendChild(dayAssetCell);

            dayFragment.appendChild(dayTr);
          }
        }

        var monthEndCapital = capital;
        var profitMonth = profitCumulative - monthStartProfit;
        var takenMonth = profitTakenCumulative - monthStartTaken;
        var monthTotalAsset = initialModal + profitCumulative;
        var growthTotal = (monthTotalAsset / initialModal - 1) * 100;

        if (monthBody) {
          var monthTr = document.createElement("tr");

          var monthCell = document.createElement("td");
          var monthStartCell = document.createElement("td");
          var monthProfitCell = document.createElement("td");
          var monthTakenCell = document.createElement("td");
          var monthCumCell = document.createElement("td");
          var monthTakenCumCell = document.createElement("td");
          var monthEndCell = document.createElement("td");
          var monthAssetCell = document.createElement("td");
          var monthGrowthCell = document.createElement("td");

          monthCell.textContent = "Bulan " + monthIndex;
          monthStartCell.textContent = formatCurrency(monthStartCapital);
          monthProfitCell.textContent = formatCurrency(profitMonth);
          monthTakenCell.textContent = formatCurrency(takenMonth);
          monthCumCell.textContent = formatCurrency(profitCumulative);
          monthTakenCumCell.textContent = formatCurrency(profitTakenCumulative);
          monthEndCell.textContent = formatCurrency(monthEndCapital);
          monthAssetCell.textContent = formatCurrency(monthTotalAsset);
          monthGrowthCell.textContent = formatPercent(growthTotal);

          monthTr.appendChild(monthCell);
          monthTr.appendChild(monthStartCell);
          monthTr.appendChild(monthProfitCell);
          monthTr.appendChild(monthTakenCell);
          monthTr.appendChild(monthCumCell);
          monthTr.appendChild(monthTakenCumCell);
          monthTr.appendChild(monthEndCell);
          monthTr.appendChild(monthAssetCell);
          monthTr.appendChild(monthGrowthCell);

          monthFragment.appendChild(monthTr);
        }
      }

      if (monthBody) {
        monthBody.appendChild(monthFragment);
      }
      if (dayBody) {
        dayBody.appendChild(dayFragment);
      }

      var finalTotalAsset = initialModal + profitCumulative;
      var finalGrowth = (finalTotalAsset / initialModal - 1) * 100;

      var avgProfitDay = profitCumulative / totalDays;
      var avgProfitMonth = profitCumulative / months;
      var profitNotTaken = profitCumulative - profitTakenCumulative;

      var takeProfitText;
      if (mode === "withdraw") {
        takeProfitText = "Semua profit (mode modal tetap)";
      } else if (takeProfitAmount > 0) {
        takeProfitText = formatCurrency(takeProfitAmount) + " / " + (takeProfitPeriod === "daily" ? "hari" : "bulan");
      } else {
        takeProfitText = "-";
      }

      var lines = [];
      lines.push("Modal awal: " + formatCurrency(initialModal));
      lines.push("Target cuan harian: " + formatPercent(dailyPercent));
      lines.push("Hari bursa per bulan: " + daysPerMonth);
      lines.push("Durasi: " + months + " bulan (" + totalDays + " hari bursa)");
      lines.push("Mode: " + (mode === "reinvest" ? "Reinvest (compounding)" : "Ambil profit (modal tetap)"));
      lines.push("Take profit: " + takeProfitText);
      lines.push("Total profit: " + formatCurrency(profitCumulative));
      lines.push("Total profit diambil: " + formatCurrency(profitTakenCumulative));
      lines.push("Profit belum diambil: " + formatCurrency(profitNotTaken));
      lines.push("Modal akhir: " + formatCurrency(capital));
      lines.push("Total aset akhir: " + formatCurrency(finalTotalAsset));
      lines.push("Growth total: " + formatPercent(finalGrowth));
      lines.push("Rata-rata profit per hari: " + formatCurrency(avgProfitDay));
      lines.push("Rata-rata profit per bulan: " + formatCurrency(avgProfitMonth));
      lines.push("");
      lines.push("Catatan:");
      lines.push("- Simulasi ini tidak memperhitungkan fee broker, pajak, slippage, atau loss.");
      lines.push("- Hari bursa diasumsikan selalu tercapai sesuai input.");
      setResult("cmp-result", lines.join("\n"), false);
    }

    if (button) {
      button.addEventListener("click", function () {
        calculate();
      });
    }

    [modalInput, dailyInput, daysInput, monthsInput, takeProfitAmountInput].forEach(function (input) {
      if (!input) {
        return;
      }
      input.addEventListener("input", function () {
        saveState(hasCalculated);
      });
    });

    [modeSelect, takeProfitPeriodSelect].forEach(function (select) {
      if (!select) {
        return;
      }
      select.addEventListener("change", function () {
        saveState(hasCalculated);
      });
    });

    [modalInput, dailyInput, daysInput, monthsInput, takeProfitAmountInput].forEach(function (input) {
      if (!input) {
        return;
      }
      input.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
          calculate();
        }
      });
    });

    var restored = restoreState();
    if (restored && restored.hasCalculated) {
      hasCalculated = true;
      calculate();
    }

  }

  buildFraksiTable();
  initFraksiCalculator();
  initTrailingStop();
  initAraArb();
  initGainCalculator();
  initPartialTakeProfit();
  initFinansialFreedom();
  initCompounding();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {
      // diamkan saja jika gagal; PWA bukan fitur kritikal
    });
  });
}
