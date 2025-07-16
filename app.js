// app.js
// Stock Market Prediction using Brain.js LSTMTimeStep, Chart.js, and Alpha Vantage API
// UI: TailwindCSS

// --- UI Elements ---
const form = document.getElementById('stock-form');
const symbolInput = document.getElementById('stock-symbol');
const loader = document.getElementById('loader');
const chartCanvas = document.getElementById('stock-chart');
const predictionOutput = document.getElementById('prediction-output');
const accuracyOutput = document.getElementById('accuracy-output');
const errorMessage = document.getElementById('error-message');
const openValue = document.getElementById('open-value');
const highValue = document.getElementById('high-value');
const lowValue = document.getElementById('low-value');
const closeValue = document.getElementById('close-value');
const predictBtn = document.getElementById('predict-btn');
const historicalBtn = document.getElementById('historical-btn');
// Remove percent elements
// const openPct = document.getElementById('open-pct');
// const highPct = document.getElementById('high-pct');
// const lowPct = document.getElementById('low-pct');
// const closePct = document.getElementById('close-pct');

let chart;

// --- Stock Info Card Elements ---
const stockInfoCard = document.getElementById('stock-info-card');
const stockLogo = document.getElementById('stock-logo');
const stockCompany = document.getElementById('stock-company');
const stockSymbolCard = document.getElementById('stock-symbol');
const stockPrice = document.getElementById('stock-price');
const stockCurrency = document.getElementById('stock-currency');
const stockChange = document.getElementById('stock-change');
const stockChangePct = document.getElementById('stock-change-pct');
const stockOpen = document.getElementById('stock-open');
const stockPrevClose = document.getElementById('stock-prevclose');
const stockVolume = document.getElementById('stock-volume');
const stockMarketCap = document.getElementById('stock-marketcap');
const stockDayRange = document.getElementById('stock-dayrange');
const stock52WeekRange = document.getElementById('stock-52weekrange');
let miniChart;

// --- Mock Data Fallback (OHLC) ---
const mockData = {
  dates: ["2024-07-01", "2024-07-02", "2024-07-03", "2024-07-04", "2024-07-05", "2024-07-06", "2024-07-07", "2024-07-08", "2024-07-09", "2024-07-10", "2024-07-11", "2024-07-12", "2024-07-13", "2024-07-14", "2024-07-15", "2024-07-16", "2024-07-17", "2024-07-18", "2024-07-19", "2024-07-20", "2024-07-21", "2024-07-22", "2024-07-23", "2024-07-24", "2024-07-25", "2024-07-26", "2024-07-27", "2024-07-28", "2024-07-29", "2024-07-30"],
  ohlc: [
    { open: 150, high: 152, low: 149, close: 151 },
    { open: 151, high: 153, low: 150, close: 152 },
    { open: 152, high: 154, low: 151, close: 153 },
    { open: 153, high: 155, low: 152, close: 154 },
    { open: 154, high: 156, low: 153, close: 155 },
    { open: 155, high: 157, low: 154, close: 156 },
    { open: 156, high: 158, low: 155, close: 157 },
    { open: 157, high: 159, low: 156, close: 158 },
    { open: 158, high: 160, low: 157, close: 159 },
    { open: 159, high: 161, low: 158, close: 160 },
    { open: 160, high: 162, low: 159, close: 161 },
    { open: 161, high: 163, low: 160, close: 162 },
    { open: 162, high: 164, low: 161, close: 163 },
    { open: 163, high: 165, low: 162, close: 164 },
    { open: 164, high: 166, low: 163, close: 165 },
    { open: 165, high: 167, low: 164, close: 166 },
    { open: 166, high: 168, low: 165, close: 167 },
    { open: 167, high: 169, low: 166, close: 168 },
    { open: 168, high: 170, low: 167, close: 169 },
    { open: 169, high: 171, low: 168, close: 170 },
    { open: 170, high: 172, low: 169, close: 171 },
    { open: 171, high: 173, low: 170, close: 172 },
    { open: 172, high: 174, low: 171, close: 173 },
    { open: 173, high: 175, low: 172, close: 174 },
    { open: 174, high: 176, low: 173, close: 175 },
    { open: 175, high: 177, low: 174, close: 176 },
    { open: 176, high: 178, low: 175, close: 177 },
    { open: 177, high: 179, low: 176, close: 178 },
    { open: 178, high: 180, low: 177, close: 179 },
    { open: 179, high: 181, low: 178, close: 180 }
  ]
};

// --- Normalization helpers ---
const SCALE = 200; // Use a value close to the max in your data for best results
function scaleDown(step) {
  return {
    open: step.open / SCALE,
    high: step.high / SCALE,
    low: step.low / SCALE,
    close: step.close / SCALE
  };
}
function scaleUp(step) {
  return {
    open: step.open * SCALE,
    high: step.high * SCALE,
    low: step.low * SCALE,
    close: step.close * SCALE
  };
}

// --- Fetch Historical OHLC Data from Twelve Data (DAILY) ---
async function fetchStockData(symbol) {
  const apiKey = '517d40f17afa4499a7ac512829fcde96'; // <-- Updated API key
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=60&apikey=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('Twelve Data API response:', data); // Debug log
    if (data.status === 'error') {
      showError('Twelve Data API Error: ' + data.message);
      throw new Error('API Error: ' + data.message);
    }
    if (!data.values || !Array.isArray(data.values) || data.values.length === 0) {
      throw new Error('API returned no data. Possible reasons: invalid symbol, rate limit exceeded, or unsupported market.');
    }
    // Parse and reverse to chronological order
    const allDates = data.values.map(v => v.datetime).reverse();
    const ohlc = data.values.map(v => ({
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close)
    })).reverse();
    return { dates: allDates, ohlc };
  } catch (err) {
    showError('API failed, using mock data. (' + err.message + ')');
    return mockData;
  }
}

// --- Prepare Data for LSTMTimeStep ---
function prepareSequences(scaledOhlc, windowSize = 5) {
  // Create overlapping windows for time series
  const sequences = [];
  for (let i = 0; i <= scaledOhlc.length - windowSize; i++) {
    sequences.push(scaledOhlc.slice(i, i + windowSize));
  }
  return sequences;
}

// --- Split Data into Train/Test ---
function splitTrainTest(sequences, testRatio = 0.2) {
  const n = sequences.length;
  const nTest = Math.max(1, Math.floor(n * testRatio));
  return {
    train: sequences.slice(0, n - nTest),
    test: sequences.slice(n - nTest)
  };
}

// --- Calculate RMSE for OHLC ---
function calcOHLC_RMSE(trueSeq, predSeq) {
  if (trueSeq.length !== predSeq.length) return null;
  let sum = 0, count = 0;
  for (let i = 0; i < trueSeq.length; i++) {
    for (const key of ['open', 'high', 'low', 'close']) {
      sum += Math.pow(trueSeq[i][key] - predSeq[i][key], 2);
      count++;
    }
  }
  return Math.sqrt(sum / count);
}

// --- Render Chart (show close price only for clarity) ---
function renderChart(dates, ohlc, predicted = [], predDates = []) {
  if (chart) chart.destroy();
  const closePrices = ohlc.map(x => x.close);
  const predCloses = predicted.map(x => x.close);
  const allDates = [...dates, ...predDates];
  const allY = [...closePrices, ...predCloses];
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  console.log('closePrices:', closePrices);
  console.log('predCloses:', predCloses);
  chart = new Chart(chartCanvas, {
    type: 'line',
    data: {
      labels: allDates,
      datasets: [
        {
          label: 'Historical Close',
          data: closePrices,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.07)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
        {
          label: 'Predicted Close',
          data: Array(dates.length).fill(null).concat(predCloses),
          borderColor: '#f59e42',
          backgroundColor: '#f59e42',
          borderDash: [5,5],
          fill: false,
          tension: 0.4,
          pointRadius: Array(dates.length).fill(0).concat(predCloses.map(() => 8)),
          showLine: false,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true },
      },
      scales: {
        x: { display: true },
        y: {
          display: true,
          min: minY - 2,
          max: maxY + 2
        }
      }
    }
  });
}

// --- UI Helpers ---
function setLoading(isLoading) {
  if (loader) loader.classList.toggle('hidden', !isLoading);
}
function showError(msg) {
  if (errorMessage) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
  }
}
function clearError() {
  if (errorMessage) {
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
  }
}

function setPctChange(el, pct) {
  if (pct === null || isNaN(pct)) {
    el.textContent = '';
    el.className = 'text-xs font-normal';
    return;
  }
  const pctStr = (pct > 0 ? '+' : '') + pct.toFixed(2) + '%';
  el.textContent = pctStr;
  if (pct > 0) {
    el.className = 'text-xs font-normal text-green-600';
  } else if (pct < 0) {
    el.className = 'text-xs font-normal text-red-600';
  } else {
    el.className = 'text-xs font-normal text-gray-500';
  }
}

function setOhlcColor(el, diff) {
  if (!el) return;
  if (diff > 0) {
    el.className = 'text-lg font-bold text-green-600';
  } else if (diff < 0) {
    el.className = 'text-lg font-bold text-red-600';
  } else {
    el.className = 'text-lg font-bold text-gray-500';
  }
}

function updateOhlcUI(ohlc) {
  if (!openValue || !highValue || !lowValue || !closeValue) return;
  const last = ohlc[ohlc.length - 1];
  const prev = ohlc.length > 1 ? ohlc[ohlc.length - 2] : null;
  openValue.textContent = last.open !== undefined ? last.open : '--';
  highValue.textContent = last.high !== undefined ? last.high : '--';
  lowValue.textContent = last.low !== undefined ? last.low : '--';
  closeValue.textContent = last.close !== undefined ? last.close : '--';
  if (prev) {
    setOhlcColor(openValue, last.open - prev.open);
    setOhlcColor(highValue, last.high - prev.high);
    setOhlcColor(lowValue, last.low - prev.low);
    setOhlcColor(closeValue, last.close - prev.close);
  } else {
    openValue.className = 'text-lg font-bold text-gray-500';
    highValue.className = 'text-lg font-bold text-gray-500';
    lowValue.className = 'text-lg font-bold text-gray-500';
    closeValue.className = 'text-lg font-bold text-gray-500';
  }
}

// --- Helper: Fetch company logo from Clearbit ---
function getLogoUrl(symbol) {
  // Try Clearbit, fallback to generic icon
  return `https://logo.clearbit.com/${symbol.toLowerCase()}.com`;
}

// --- Helper: Format large numbers ---
function formatNumber(n) {
  if (!n || isNaN(n)) return '--';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toLocaleString();
}

// --- Helper: Show and fill stock info card ---
function showStockInfoCard(symbol, ohlc, meta = {}) {
  if (!stockInfoCard) return;
  // Show card
  stockInfoCard.classList.remove('hidden');
  // Logo
  if (stockLogo) stockLogo.src = getLogoUrl(symbol);
  // Company name (fallback to symbol)
  if (stockCompany) stockCompany.textContent = meta.name || symbol;
  // Symbol
  if (stockSymbolCard) stockSymbolCard.textContent = symbol;
  // Price, change, open, prev close, etc.
  const last = ohlc[ohlc.length - 1];
  const prev = ohlc.length > 1 ? ohlc[ohlc.length - 2] : null;
  if (stockPrice) stockPrice.textContent = last.close !== undefined ? last.close : '--';
  if (stockCurrency) stockCurrency.textContent = meta.currency || 'USD';
  // Change and percent
  if (prev) {
    if (stockChange) {
      const change = last.close - prev.close;
      stockChange.textContent = (change > 0 ? '+' : '') + change.toFixed(2);
      stockChange.className = 'text-lg font-semibold ' + (change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500');
    }
    if (stockChangePct) {
      const pct = ((last.close - prev.close) / prev.close) * 100;
      stockChangePct.textContent = (pct > 0 ? '+' : '') + pct.toFixed(2) + '%';
      stockChangePct.className = 'text-sm ' + (pct > 0 ? 'text-green-600' : pct < 0 ? 'text-red-600' : 'text-gray-500');
    }
  } else {
    if (stockChange) {
      stockChange.textContent = '--';
      stockChange.className = 'text-lg font-semibold text-gray-500';
    }
    if (stockChangePct) {
      stockChangePct.textContent = '--';
      stockChangePct.className = 'text-sm text-gray-500';
    }
  }
  // Open, Prev Close, Volume
  if (stockOpen) stockOpen.textContent = last.open !== undefined ? last.open : '--';
  if (stockPrevClose) stockPrevClose.textContent = prev && prev.close !== undefined ? prev.close : '--';
  if (stockVolume) stockVolume.textContent = meta.volume ? formatNumber(meta.volume) : (last.volume ? formatNumber(last.volume) : '--');
  // Market Cap (fallback to --)
  if (stockMarketCap) stockMarketCap.textContent = meta.marketCap ? formatNumber(meta.marketCap) : '--';
  // Day Range
  if (stockDayRange) stockDayRange.textContent = (last.low !== undefined && last.high !== undefined) ? `${last.low} - ${last.high}` : '--';
  // 52 Week Range (fallback to --)
  if (stock52WeekRange) stock52WeekRange.textContent = meta.range52w || '--';
  // Mini chart
  if (miniChart) miniChart.destroy();
  const closes = ohlc.map(x => x.close);
  const labels = Array.from({length: closes.length}, (_, i) => i + 1);
  const miniChartCanvas = document.getElementById('stock-mini-chart');
  if (miniChartCanvas) {
    miniChart = new Chart(miniChartCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: closes,
          borderColor: '#FFD700',
          backgroundColor: 'rgba(255,215,0,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } },
        elements: { line: { borderJoinStyle: 'round' } },
        responsive: true,
        maintainAspectRatio: false,
      }
    });
  }
}

// --- Model/Data Cache ---
const modelCache = {};

// --- State ---
let latestFetched = null; // { dates, ohlc }
let latestNet = null;
let latestWindowSize = 5;
let latestSymbol = null;
let latestRmse = null;
let lastPrediction = null;

// --- Helper: Render only historical chart ---
function renderHistoricalOnly() {
  if (!latestFetched) return;
  renderChart(latestFetched.dates, latestFetched.ohlc, [], []);
  predictionOutput.textContent = '';
  accuracyOutput.textContent = '';
}

// --- Helper: Render prediction chart ---
function renderPrediction() {
  if (!latestFetched || !latestNet) return;
  const { dates, ohlc } = latestFetched;
  const net = latestNet;
  const windowSize = latestWindowSize;
  const scaledOhlc = ohlc.map(scaleDown);
  const lastWindow = scaledOhlc.slice(-windowSize);
  const nextScaled = net.run(lastWindow);
  const next = scaleUp(nextScaled);
  const nextDate = 'Next';
  lastPrediction = next;
  console.log('Predicted value:', next);
  renderChart(dates, ohlc, [next], [nextDate]);
  predictionOutput.textContent = `Predicted next close: $${next.close.toFixed(2)}`;
  if (latestRmse !== null) {
    accuracyOutput.textContent = `Test RMSE (lower is better): ${latestRmse.toFixed(4)}`;
  }
}

// --- Patch: Hide card by default ---
if (stockInfoCard) stockInfoCard.classList.add('hidden');

// --- Patch: Show card on search or popular stock click ---
// In form submit handler, after fetching data and updating UI:
// ... after updateOhlcUI(ohlc); ...
// showStockInfoCard(symbol, ohlc, meta);
// For now, meta will be minimal (symbol, currency, etc.)

// --- Main Form Handler ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading(true);
  clearError();
  predictionOutput.textContent = '';
  accuracyOutput.textContent = '';

  const symbol = symbolInput.value.trim().toUpperCase();
  if (!symbol.match(/^[A-Z.]{1,10}$/)) {
    setLoading(false);
    showError('Please enter a valid stock symbol.');
    return;
  }
  latestSymbol = symbol;

  // Check cache first
  if (modelCache[symbol]) {
    const { dates, ohlc, net, rmse } = modelCache[symbol];
    updateOhlcUI(ohlc);
    latestFetched = { dates, ohlc };
    latestNet = net;
    latestWindowSize = 5;
    latestRmse = rmse;
    renderHistoricalOnly();
    setLoading(false);
    return;
  }

  // 1. Fetch OHLC data
  const { dates, ohlc } = await fetchStockData(symbol);
  if (!ohlc || ohlc.length < 10) {
    setLoading(false);
    showError('Not enough data to predict.');
    return;
  }

  updateOhlcUI(ohlc);
  latestFetched = { dates, ohlc };

  // 2. Normalize
  const scaledOhlc = ohlc.map(scaleDown);

  // 3. Prepare sequences
  const windowSize = 5;
  latestWindowSize = windowSize;
  const sequences = prepareSequences(scaledOhlc, windowSize);
  if (sequences.length < 2) {
    setLoading(false);
    showError('Not enough data to predict.');
    return;
  }

  // 4. Split train/test
  const { train, test } = splitTrainTest(sequences, 0.2);

  // 5. Train LSTMTimeStep asynchronously
  setTimeout(() => {
    let net;
    try {
      net = new brain.recurrent.LSTMTimeStep({
        inputSize: 4,
        hiddenLayers: [6], // smaller network for speed
        outputSize: 4
      });
      net.train(train, {
        learningRate: 0.01, // slightly higher for speed
        errorThresh: 0.05, // higher for faster convergence
        iterations: 50, // limit iterations for speed
      });
    } catch (err) {
      setLoading(false);
      showError('Model training failed: ' + err.message);
      return;
    }
    latestNet = net;

    // 6. Test prediction (on test set)
    const testPreds = test.map(seq => net.run(seq.slice(0, windowSize - 1).concat([seq[windowSize - 2]])));
    const testTrue = test.map(seq => seq[windowSize - 1]);
    const rmse = calcOHLC_RMSE(testTrue, testPreds);
    latestRmse = rmse;

    // Cache model/data
    modelCache[symbol] = { dates, ohlc, net, rmse };
    // Only show historical data
    renderHistoricalOnly();
    setLoading(false);
  }, 10);
});

// Predict Values button handler
predictBtn.addEventListener('click', () => {
  if (!latestFetched || !latestNet) {
    showError('Please search for a stock first.');
    return;
  }
  setLoading(true);
  clearError();
  predictionOutput.textContent = '';
  accuracyOutput.textContent = '';
  renderPrediction();
  setLoading(false);
});

// Historical Data button handler
historicalBtn.addEventListener('click', () => {
  if (!latestFetched) return;
  renderHistoricalOnly();
});

// Force uppercase in the stock symbol input as the user types
symbolInput.addEventListener('input', function(e) {
  const start = this.selectionStart;
  const end = this.selectionEnd;
  this.value = this.value.toUpperCase();
  this.setSelectionRange(start, end);
}); 