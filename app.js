const form = document.querySelector('#trade-form');
const codeInput = document.querySelector('#stock-code');
const quantityInput = document.querySelector('#share-quantity');
const purchaseDateInput = document.querySelector('#purchase-date');
const payoutDateInput = document.querySelector('#payout-date');
const purchasePriceInput = document.querySelector('#purchase-price');
const payoutPriceInput = document.querySelector('#payout-price');
const statusOutput = document.querySelector('#form-status');
const sourceOutput = document.querySelector('#result-source');
const allowanceOutput = document.querySelector('#allowance-amount');
const allowanceYenOutput = document.querySelector('#allowance-yen');
const profitOutput = document.querySelector('#profit-amount');
const quantityOutput = document.querySelector('#quantity-result');
const purchaseResult = document.querySelector('#purchase-price-result');
const payoutResult = document.querySelector('#payout-price-result');
const messageOutput = document.querySelector('#result-message');
const candidateStatus = document.querySelector('#candidate-status');

const STOCK_CANDIDATES = [
  ['1301', '極洋'], ['1332', 'ニッスイ'], ['1605', 'INPEX'], ['1801', '大成建設'],
  ['1802', '大林組'], ['1803', '清水建設'], ['1925', '大和ハウス'], ['1928', '積水ハウス'],
  ['2502', 'アサヒGHD'], ['2503', 'キリンHD'], ['285A', 'キオクシアHD'], ['2914', 'JT'],
  ['3382', 'セブン＆アイ'], ['4063', '信越化学'], ['4502', '武田薬品'], ['4503', 'アステラス'],
  ['4519', '中外製薬'], ['4568', '第一三共'], ['4661', 'OLC'], ['5401', '日本製鉄'],
  ['6098', 'リクルートHD'], ['6367', 'ダイキン'], ['6501', '日立'], ['6503', '三菱電機'],
  ['6594', 'ニデック'], ['6701', 'NEC'], ['6752', 'パナソニックHD'], ['6758', 'ソニーG'],
  ['6861', 'キーエンス'], ['6920', 'レーザーテック'], ['6954', 'ファナック'], ['7011', '三菱重工'],
  ['7201', '日産自動車'], ['7203', 'トヨタ'], ['7267', 'ホンダ'], ['7733', 'オリンパス'],
  ['7741', 'HOYA'], ['7751', 'キヤノン'], ['7974', '任天堂'], ['8001', '伊藤忠'],
  ['8002', '丸紅'], ['8031', '三井物産'], ['8035', '東京エレクトロン'], ['8058', '三菱商事'],
  ['8267', 'イオン'], ['8306', '三菱UFJ'], ['8316', '三井住友FG'], ['8411', 'みずほFG'],
  ['8766', '東京海上HD'], ['8801', '三井不動産'], ['9020', 'JR東日本'], ['9021', 'JR西日本'],
  ['9022', 'JR東海'], ['9432', 'NTT'], ['9433', 'KDDI'], ['9434', 'ソフトバンク'],
  ['9613', 'NTTデータG'], ['9983', 'ファーストリテイリング'], ['9984', 'ソフトバンクG'],
];

const candidateGrid = document.querySelector('#stock-candidate-grid');
const stockCodeList = document.querySelector('#stock-code-list');
const candidateCodes = new Set();

function addDatalistCandidate(code, name) {
  if (candidateCodes.has(code)) return false;
  candidateCodes.add(code);
  const option = document.createElement('option');
  option.value = code;
  option.label = name;
  stockCodeList.append(option);
  return true;
}

STOCK_CANDIDATES.forEach(([code, name]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.stockCode = code;
  button.textContent = `${code} ${name}`;
  candidateGrid.append(button);
  addDatalistCandidate(code, name);
});

document.querySelectorAll('[data-stock-code]').forEach((button) => {
  button.addEventListener('click', () => {
    codeInput.value = button.dataset.stockCode;
    codeInput.focus();
  });
});

async function loadFullStockCandidates() {
  try {
    const response = await fetch('https://te-chan.github.io/JP-CompanyCode/company_list.csv', { cache: 'no-store' });
    if (!response.ok) throw new Error('候補一覧を取得できませんでした');
    const lines = (await response.text()).split(/\r?\n/).slice(1);
    lines.forEach((line) => {
      const separator = line.indexOf(',');
      if (separator < 1) return;
      const code = line.slice(0, separator).trim().toUpperCase();
      const name = line.slice(separator + 1).trim();
      if (/^(?:\d{4}|\d{3}[A-Z])$/.test(code)) addDatalistCandidate(code, name);
    });
    candidateStatus.textContent = `公開コード ${candidateCodes.size.toLocaleString('ja-JP')}件を入力候補に追加済み`;
  } catch (error) {
    candidateStatus.textContent = '主要銘柄の候補を表示中（一覧の読み込みに失敗しました）';
  }
}

loadFullStockCandidates();

const formatPoints = (value) => new Intl.NumberFormat('ja-JP', {
  maximumFractionDigits: 0,
}).format(Math.round(value));

const formatPrice = (value) => new Intl.NumberFormat('ja-JP', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(value);

const toDateValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);
purchaseDateInput.value = toDateValue(thirtyDaysAgo);
payoutDateInput.value = toDateValue(today);
payoutDateInput.min = purchaseDateInput.value;

purchaseDateInput.addEventListener('change', () => {
  payoutDateInput.min = purchaseDateInput.value;
  if (payoutDateInput.value < purchaseDateInput.value) payoutDateInput.value = purchaseDateInput.value;
});

function normalizeSymbol(value) {
  const symbol = value.trim().toUpperCase();
  if (/^(?:\d{4}|\d{3}[A-Z])$/.test(symbol)) return `${symbol}.T`;
  return symbol;
}

function unixSeconds(dateValue, endOfDay = false) {
  const suffix = endOfDay ? 'T23:59:59' : 'T00:00:00';
  return Math.floor(new Date(`${dateValue}${suffix}`).getTime() / 1000);
}

async function fetchPrices(symbol, from, to) {
  const params = new URLSearchParams({
    period1: String(unixSeconds(from)),
    period2: String(unixSeconds(to, true) + 86400),
    interval: '1d',
    events: 'history',
    includeAdjustedClose: 'true',
  });
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error('株価データを取得できませんでした');
  const payload = await response.json();
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const points = timestamps.map((timestamp, index) => ({ timestamp, close: closes[index] }))
    .filter((point) => Number.isFinite(point.close));
  if (!points.length) throw new Error('指定期間の株価データがありません');
  const purchaseTimestamp = unixSeconds(from);
  const payoutTimestamp = unixSeconds(to, true);
  const purchasePoint = points.find((point) => point.timestamp >= purchaseTimestamp) || points[0];
  const payoutPoint = [...points].reverse().find((point) => point.timestamp <= payoutTimestamp) || points.at(-1);
  return { purchasePrice: Math.round(purchasePoint.close), payoutPrice: Math.round(payoutPoint.close) };
}

function setStatus(message, type = '') {
  statusOutput.textContent = message;
  statusOutput.dataset.type = type;
}

function renderResult({ purchasePrice, payoutPrice, quantity, source }) {
  const profit = (payoutPrice - purchasePrice) * quantity;
  // 損失が出た場合は、お小遣いを絶対にマイナスにしない。
  const allowance = profit > 0 ? Math.round(profit * 0.01) : 0;
  const hasProfit = profit >= 0;

  allowanceOutput.textContent = formatPoints(allowance);
  // 仮想ポイントは 1pt = 1円として円換算する。
  allowanceYenOutput.textContent = formatPoints(allowance);
  profitOutput.textContent = `${hasProfit ? '+' : ''}${formatPoints(profit)} pt`;
  profitOutput.dataset.negative = String(!hasProfit);
  quantityOutput.textContent = formatPrice(quantity);
  purchaseResult.textContent = formatPrice(purchasePrice);
  payoutResult.textContent = formatPrice(payoutPrice);
  sourceOutput.textContent = source === 'manual' ? 'MANUAL' : 'AUTO';
  messageOutput.innerHTML = hasProfit
    ? 'この期間の利益から<br /><strong>1%がお小遣い</strong>になります。'
    : 'この期間はマイナスのため、<br /><strong>お小遣いは 0円（0 pt）</strong>です。';
}

function calculateManualPreview() {
  const purchasePrice = Number(purchasePriceInput.value);
  const payoutPrice = Number(payoutPriceInput.value);
  const quantity = Number(quantityInput.value);
  if (purchasePrice > 0 && payoutPrice > 0 && Number.isInteger(quantity) && quantity > 0) {
    renderResult({
      purchasePrice: Math.round(purchasePrice),
      payoutPrice: Math.round(payoutPrice),
      quantity,
      source: 'manual',
    });
    setStatus('手入力の価格で自動計算しました。', 'success');
  }
}

[purchasePriceInput, payoutPriceInput, quantityInput].forEach((input) => {
  input.addEventListener('input', calculateManualPreview);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const symbol = normalizeSymbol(codeInput.value);
  const quantity = Number(quantityInput.value);
  const from = purchaseDateInput.value;
  const to = payoutDateInput.value;
  const manualPurchase = Number(purchasePriceInput.value);
  const manualPayout = Number(payoutPriceInput.value);
  const hasManualPurchase = manualPurchase > 0;
  const hasManualPayout = manualPayout > 0;

  if (hasManualPurchase !== hasManualPayout) {
    setStatus('購入価格と判定価格を両方入力してください。', 'error');
    return;
  }
  const useManualPrices = hasManualPurchase && hasManualPayout;
  if (!useManualPrices && (!symbol || !from || !to || to < from)) {
    setStatus('銘柄コードと日付を確認してください。', 'error');
    return;
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    setStatus('購入株数を1株以上の整数で入力してください。', 'error');
    return;
  }

  setStatus('株価データを取得しています…');
  let prices;
  let source = 'auto';
  try {
    if (useManualPrices) {
      prices = { purchasePrice: Math.round(manualPurchase), payoutPrice: Math.round(manualPayout) };
      source = 'manual';
    } else {
      prices = await fetchPrices(symbol, from, to);
    }
    renderResult({ ...prices, quantity, source });
    setStatus(source === 'manual' ? '手入力の価格で計算しました。' : `${symbol} の株価で計算しました。`, 'success');
  } catch (error) {
    setStatus('株価を取得できませんでした。価格を手入力して再計算してください。', 'error');
    sourceOutput.textContent = 'WAITING';
  }
});
