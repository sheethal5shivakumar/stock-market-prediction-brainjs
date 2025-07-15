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

let chart;

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
  const apiKey = '47d6ae14f24140819ca0084cd038f199'; // <-- User's real Twelve Data API key
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
          backgroundColor: 'rgba(245,158,66,0.1)',
          borderDash: [5,5],
          fill: false,
          tension: 0.4,
          pointRadius: 0,
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
        y: { display: true }
      }
    }
  });
}

// --- UI Helpers ---
function setLoading(isLoading) {
  loader.classList.toggle('hidden', !isLoading);
}
function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove('hidden');
}
function clearError() {
  errorMessage.textContent = '';
  errorMessage.classList.add('hidden');
}

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

  // 1. Fetch OHLC data
  const { dates, ohlc } = await fetchStockData(symbol);
  if (!ohlc || ohlc.length < 10) {
    setLoading(false);
    showError('Not enough data to predict.');
    return;
  }

  // 2. Normalize
  const scaledOhlc = ohlc.map(scaleDown);

  // 3. Prepare sequences
  const windowSize = 5;
  const sequences = prepareSequences(scaledOhlc, windowSize);
  if (sequences.length < 2) {
    setLoading(false);
    showError('Not enough data to predict.');
    return;
  }

  // 4. Split train/test
  const { train, test } = splitTrainTest(sequences, 0.2);

  // 5. Train LSTMTimeStep
  let net;
  try {
    net = new brain.recurrent.LSTMTimeStep({
      inputSize: 4,
      hiddenLayers: [8, 8],
      outputSize: 4
    });
    net.train(train, {
      learningRate: 0.005,
      errorThresh: 0.02,
    });
  } catch (err) {
    setLoading(false);
    showError('Model training failed: ' + err.message);
    return;
  }

  // 6. Test prediction (on test set)
  const testPreds = test.map(seq => net.run(seq.slice(0, windowSize - 1).concat([seq[windowSize - 2]])));
  const testTrue = test.map(seq => seq[windowSize - 1]);
  const rmse = calcOHLC_RMSE(testTrue, testPreds);

  // 7. Predict next period (using last window)
  const lastWindow = scaledOhlc.slice(-windowSize);
  const nextScaled = net.run(lastWindow);
  const next = scaleUp(nextScaled);
  const nextDate = 'Next';

  // 8. Render chart (historical + prediction)
  renderChart(
    dates,
    ohlc,
    [next],
    [nextDate]
  );

  // 9. Show prediction and accuracy
  predictionOutput.textContent = `Predicted next close: $${next.close.toFixed(2)}`;
  if (rmse !== null) {
    accuracyOutput.textContent = `Test RMSE (lower is better): ${rmse.toFixed(4)}`;
  }

  setLoading(false);
});

// Force uppercase in the stock symbol input as the user types
symbolInput.addEventListener('input', function(e) {
  const start = this.selectionStart;
  const end = this.selectionEnd;
  this.value = this.value.toUpperCase();
  this.setSelectionRange(start, end);
}); 